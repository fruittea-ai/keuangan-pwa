const CONFIG = {
  SPREADSHEET_ID: '',
  SHEETS: {
    TRANSACTIONS: 'Transactions',
    ACCOUNTS: 'Accounts',
    CATEGORIES: 'Categories',
    TRANSFERS: 'Transfers',
    BUDGETS: 'Budgets',
    SETTINGS: 'Settings'
  }
};

function doGet(e) {
  const callback = String(e?.parameter?.callback || '').trim();

  if (callback && !/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return jsonResponse({ success: false, error: 'Invalid callback.' });
  }

  try {
    const action = e?.parameter?.action || 'health';
    let response;

    switch (action) {
      case 'health':
        response = {
          success: true,
          message: 'Keuangan API is running',
          timestamp: new Date().toISOString()
        };
        break;
      case 'transactions':
        response = getTransactionsData(e);
        break;
      case 'accounts':
        response = {
          success: true,
          data: readSheetObjects(CONFIG.SHEETS.ACCOUNTS)
            .filter(item => item.status === 'ACTIVE')
        };
        break;
      case 'account_balances':
        response = getAccountBalancesData();
        break;
      case 'categories':
        response = {
          success: true,
          data: readSheetObjects(CONFIG.SHEETS.CATEGORIES)
            .filter(item => item.status === 'ACTIVE')
        };
        break;
      case 'dashboard':
        response = getDashboardData();
        break;
      case 'monthly_report':
        response = getMonthlyReportData(e);
        break;
      case 'budgets':
        response = getBudgetsData(e);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return jsonResponse(response, callback);
  } catch (error) {
    return errorResponse(error, callback);
  }
}

function doPost(e) {
  try {
    if (!e?.postData?.contents) throw new Error('Request body kosong.');
    const body = JSON.parse(e.postData.contents);
    switch (body.action) {
      case 'create_transaction': return createTransaction(body);
      case 'create_transfer': return createTransfer(body);
      case 'upsert_budget': return upsertBudget(body);
      default: throw new Error(`Unknown action: ${body.action}`);
    }
  } catch (error) {
    return errorResponse(error);
  }
}

function getSpreadsheet() {
  return CONFIG.SPREADSHEET_ID
    ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  const sheet = getSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error(`Sheet "${name}" tidak ditemukan.`);
  return sheet;
}

function createTransaction(data) {
  validateTransaction(data);

  // Mencegah dua request bersamaan menulis pada baris yang sama.
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSheet(CONFIG.SHEETS.TRANSACTIONS);
    const now = new Date();
    const id = generateId('TRX');

    sheet.appendRow([
      id,
      data.date,
      data.type,
      data.category_id,
      data.account_id,
      Number(data.amount),
      data.description || '',
      data.notes || '',
      now,
      now,
      'ACTIVE'
    ]);

    SpreadsheetApp.flush();

    return jsonResponse({
      success: true,
      message: 'Transaksi berhasil disimpan',
      data: { transaction_id: id }
    });
  } finally {
    lock.releaseLock();
  }
}

function normalizeCategoryType(value) {
  const type = String(value || '').trim().toUpperCase();
  if (type === 'INCOME' || type === 'INCOMES' || type === 'PEMASUKAN') return 'INCOME';
  return 'EXPENSE';
}

function validateTransaction(data) {
  if (!data.date) throw new Error('Tanggal transaksi wajib diisi.');

  const transactionType = String(data.type || '').trim().toUpperCase();
  if (!['INCOME', 'EXPENSE'].includes(transactionType)) {
    throw new Error('type harus INCOME atau EXPENSE.');
  }

  if (!data.category_id) throw new Error('Kategori wajib diisi.');
  if (!data.account_id) throw new Error('Akun wajib diisi.');
  if (!Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0) {
    throw new Error('Nominal transaksi harus lebih besar dari 0.');
  }

  // Master kategori menjadi sumber kebenaran.
  const category = readSheetObjects(CONFIG.SHEETS.CATEGORIES)
    .find(item =>
      String(item.category_id || item.id || item.kode || '').trim() ===
      String(data.category_id).trim()
    );

  if (!category) throw new Error('Kategori transaksi tidak ditemukan.');

  const categoryType = normalizeCategoryType(
    category.type ??
    category.category_type ??
    category.transaction_type ??
    category.jenis
  );

  if (categoryType !== transactionType) {
    throw new Error(
      `Kategori "${category.name || category.category_name || data.category_id}" ` +
      `adalah kategori ${categoryType === 'INCOME' ? 'pemasukan' : 'pengeluaran'}.`
    );
  }
}

function getTransactionsData(e) {
  let data = readSheetObjects(CONFIG.SHEETS.TRANSACTIONS)
    .filter(item => item.status !== 'VOID');

  if (e?.parameter?.from) {
    data = data.filter(item => String(item.date).slice(0, 10) >= e.parameter.from);
  }
  if (e?.parameter?.to) {
    data = data.filter(item => String(item.date).slice(0, 10) <= e.parameter.to);
  }
  if (e?.parameter?.type) {
    data = data.filter(item => item.type === e.parameter.type);
  }

  data.reverse();
  return { success: true, count: data.length, data };
}

function getAccountBalancesData() {
  const accounts = readSheetObjects(CONFIG.SHEETS.ACCOUNTS)
    .filter(item => item.status === 'ACTIVE');
  const transactions = readSheetObjects(CONFIG.SHEETS.TRANSACTIONS)
    .filter(item => item.status !== 'VOID');
  const transfers = readSheetObjects(CONFIG.SHEETS.TRANSFERS);

  const result = accounts.map(account => {
    const id = String(account.account_id || account.id || account.kode || '');
    const opening = Number(
      account.opening_balance ??
      account.initial_balance ??
      account.saldo_awal ??
      account.balance ??
      0
    ) || 0;

    let income = 0;
    let expense = 0;
    let transferIn = 0;
    let transferOut = 0;

    transactions.forEach(item => {
      if (String(item.account_id) !== id) return;
      const amount = Number(item.amount) || 0;
      if (item.type === 'INCOME') income += amount;
      if (item.type === 'EXPENSE') expense += amount;
    });

    transfers.forEach(item => {
      if (String(item.to_account) === id) transferIn += Number(item.amount) || 0;
      if (String(item.from_account) === id) transferOut += Number(item.amount) || 0;
    });

    return {
      ...account,
      opening_balance: opening,
      income,
      expense,
      transfer_in: transferIn,
      transfer_out: transferOut,
      balance: opening + income - expense + transferIn - transferOut
    };
  });

  const total = result.reduce((sum, item) => sum + (Number(item.balance) || 0), 0);

  return { success: true, total_balance: total, data: result };
}

function getDashboardData() {
  const transactions = readSheetObjects(CONFIG.SHEETS.TRANSACTIONS)
    .filter(item => item.status !== 'VOID');

  let totalIncome = 0;
  let totalExpense = 0;

  transactions.forEach(item => {
    const amount = Number(item.amount) || 0;
    if (item.type === 'INCOME') totalIncome += amount;
    if (item.type === 'EXPENSE') totalExpense += amount;
  });

  return {
    success: true,
    data: {
      total_income: totalIncome,
      total_expense: totalExpense,
      net_cash_flow: totalIncome - totalExpense,
      transaction_count: transactions.length
    }
  };
}

function getMonthlyReportData(e) {
  const month = e?.parameter?.month || Utilities.formatDate(
    new Date(), Session.getScriptTimeZone(), 'yyyy-MM'
  );

  const transactions = readSheetObjects(CONFIG.SHEETS.TRANSACTIONS)
    .filter(item =>
      item.status !== 'VOID' &&
      String(item.date).slice(0, 7) === month
    );

  let income = 0;
  let expense = 0;

  transactions.forEach(item => {
    const amount = Number(item.amount) || 0;
    if (item.type === 'INCOME') income += amount;
    if (item.type === 'EXPENSE') expense += amount;
  });

  return {
    success: true,
    data: { month, income, expense, net_cash_flow: income - expense }
  };
}


function getBudgetsData(e) {
  const requestedMonth = String(e?.parameter?.month || '').trim();
  let raw = readSheetObjects(CONFIG.SHEETS.BUDGETS)
    .filter(item => String(item.status || 'ACTIVE').trim().toUpperCase() !== 'VOID')
    .map(item => ({ ...item, month: normalizeMonth(item.month) }));

  if (requestedMonth) {
    raw = raw.filter(item => item.month === requestedMonth);
  }

  // Satu kategori hanya boleh punya satu budget aktif per bulan.
  // Jika data lama terlanjur duplikat, tampilkan nilai dari baris terakhir.
  const byKey = {};
  raw.forEach(item => {
    const key = `${item.month}|${String(item.category_id || '').trim()}`;
    byKey[key] = item;
  });

  return { success: true, month: requestedMonth || null, data: Object.values(byKey) };
}

function normalizeMonth(value) {
  const s = String(value || '').trim();
  if (!s) return '';

  // Text such as 2026-08 or ISO dates such as 2026-08-01T00:00:00.
  const match = s.match(/^(\d{4}-\d{2})/);
  if (match) return match[1];

  // Fallback for Sheets values that arrive as Date objects.
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return Utilities.formatDate(
      date,
      Session.getScriptTimeZone(),
      'yyyy-MM'
    );
  }

  return s;
}

function upsertBudget(data) {
  const month = String(data.month || '').slice(0, 7);
  const categoryId = String(data.category_id || '').trim();
  const amount = Number(data.amount);
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Bulan anggaran tidak valid.');
  if (!categoryId) throw new Error('Kategori anggaran wajib diisi.');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Nominal anggaran harus lebih besar dari 0.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet(CONFIG.SHEETS.BUDGETS);
    const values = sheet.getDataRange().getValues();
    const headers = values[0] || [];
    const monthCol = headers.indexOf('month');
    const categoryCol = headers.indexOf('category_id');
    const amountCol = headers.indexOf('amount');
    const statusCol = headers.indexOf('status');
    if (monthCol < 0 || categoryCol < 0 || amountCol < 0) {
      throw new Error('Sheet Budgets harus memiliki header: month, category_id, amount.');
    }

    const matches = [];
    for (let i = 1; i < values.length; i++) {
      const active = statusCol < 0 || String(values[i][statusCol] || 'ACTIVE').trim().toUpperCase() !== 'VOID';
      const rowMonth = normalizeMonth(values[i][monthCol]);
      const rowCategory = String(values[i][categoryCol] || '').trim();
      if (rowMonth === month && rowCategory === categoryId && active) {
        matches.push(i);
      }
    }

    if (matches.length) {
      // Pakai baris terakhir sebagai record canonical dan nonaktifkan duplikat lama.
      const canonical = matches[matches.length - 1];
      sheet.getRange(canonical + 1, amountCol + 1).setValue(amount);
      if (statusCol >= 0) sheet.getRange(canonical + 1, statusCol + 1).setValue('ACTIVE');
      const updatedCol = headers.indexOf('updated_at');
      if (updatedCol >= 0) sheet.getRange(canonical + 1, updatedCol + 1).setValue(new Date());

      if (statusCol >= 0) {
        matches.slice(0, -1).forEach(rowIndex => {
          sheet.getRange(rowIndex + 1, statusCol + 1).setValue('VOID');
        });
      }

      SpreadsheetApp.flush();
      return jsonResponse({ success: true, message: 'Anggaran diperbarui dan duplikat dinonaktifkan', data: { month, category_id: categoryId, amount } });
    }

    const row = headers.map(h => {
      if (h === 'budget_id') return generateId('BDG');
      if (h === 'month') return month;
      if (h === 'category_id') return categoryId;
      if (h === 'amount') return amount;
      if (h === 'status') return 'ACTIVE';
      if (h === 'created_at' || h === 'updated_at') return new Date();
      return '';
    });
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    return jsonResponse({ success: true, message: 'Anggaran berhasil disimpan', data: { month, category_id: categoryId, amount } });
  } finally {
    lock.releaseLock();
  }
}

function createTransfer(data) {
  if (!data.date) throw new Error('Tanggal transfer wajib diisi.');
  if (!data.from_account) throw new Error('Akun asal wajib diisi.');
  if (!data.to_account) throw new Error('Akun tujuan wajib diisi.');
  if (data.from_account === data.to_account) {
    throw new Error('Akun asal dan tujuan tidak boleh sama.');
  }
  if (!Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0) {
    throw new Error('Nominal transfer harus lebih besar dari 0.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSheet(CONFIG.SHEETS.TRANSFERS);
    const id = generateId('TRF');

    sheet.appendRow([
      id,
      data.date,
      data.from_account,
      data.to_account,
      Number(data.amount),
      data.description || ''
    ]);

    SpreadsheetApp.flush();

    return jsonResponse({
      success: true,
      message: 'Transfer berhasil disimpan',
      data: { transfer_id: id }
    });
  } finally {
    lock.releaseLock();
  }
}

function getDashboard() {
  const transactions = readSheetObjects(CONFIG.SHEETS.TRANSACTIONS)
    .filter(item => item.status !== 'VOID');

  let totalIncome = 0;
  let totalExpense = 0;

  transactions.forEach(item => {
    const amount = Number(item.amount) || 0;
    if (item.type === 'INCOME') totalIncome += amount;
    if (item.type === 'EXPENSE') totalExpense += amount;
  });

  return jsonResponse({
    success: true,
    data: {
      total_income: totalIncome,
      total_expense: totalExpense,
      net_cash_flow: totalIncome - totalExpense,
      transaction_count: transactions.length
    }
  });
}

function getMonthlyReport(e) {
  const month = e?.parameter?.month || Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'yyyy-MM'
  );

  const transactions = readSheetObjects(CONFIG.SHEETS.TRANSACTIONS)
    .filter(item =>
      item.status !== 'VOID' &&
      String(item.date).slice(0, 7) === month
    );

  let income = 0;
  let expense = 0;

  transactions.forEach(item => {
    const amount = Number(item.amount) || 0;
    if (item.type === 'INCOME') income += amount;
    if (item.type === 'EXPENSE') expense += amount;
  });

  return jsonResponse({
    success: true,
    data: {
      month,
      income,
      expense,
      net_cash_flow: income - expense
    }
  });
}

function readSheetObjects(sheetName) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0];
  return values.slice(1).map(row => objectFromRow(headers, row));
}

function objectFromRow(headers, row) {
  const object = {};
  headers.forEach((header, index) => {
    let value = row[index];
    if (value instanceof Date) {
      value = Utilities.formatDate(
        value,
        Session.getScriptTimeZone(),
        "yyyy-MM-dd'T'HH:mm:ss"
      );
    }
    object[header] = value;
  });
  return object;
}

function generateId(prefix) {
  const timestamp = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'yyyyMMddHHmmssSSS'
  );
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${timestamp}-${random}`;
}

function jsonResponse(data, callback) {
  const payload = JSON.stringify(data);

  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${payload});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(error, callback) {
  console.error(error);
  return jsonResponse({
    success: false,
    error: error.message || String(error)
  }, callback);
}
