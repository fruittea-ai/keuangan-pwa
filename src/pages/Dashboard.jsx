import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Landmark,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  CheckCircle2
} from "lucide-react";
import TransactionItem from "../components/TransactionItem";

function money(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function monthKey(value) {
  const s = String(value || "");
  const m = s.match(/^(\d{4}-\d{2})/);
  return m ? m[1] : "";
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function shiftMonth(month, delta) {
  const [year, mon] = month.split("-").map(Number);
  const d = new Date(year, mon - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function categoryName(categories, id) {
  const item = categories.find(c =>
    String(c.category_id || c.id || c.kode || "") === String(id || "")
  );
  return item?.name || item?.category_name || item?.nama || id || "Tanpa kategori";
}

export default function Dashboard({
  dashboard,
  transactions,
  accountBalances = [],
  categories = [],
  budgets = [],
  loading,
  onAdd,
  onTransfer
}) {
  if (loading && !dashboard) {
    return <div className="page"><div className="loading">Memuat dashboard...</div></div>;
  }

  const income = dashboard?.total_income || 0;
  const expense = dashboard?.total_expense || 0;
  const net = dashboard?.net_cash_flow || 0;

  const thisMonth = currentMonth();
  const prevMonth = shiftMonth(thisMonth, -1);

  const currentTransactions = transactions.filter(t => monthKey(t.date) === thisMonth);
  const previousTransactions = transactions.filter(t => monthKey(t.date) === prevMonth);

  const currentIncome = currentTransactions
    .filter(t => t.type === "INCOME")
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);

  const currentExpense = currentTransactions
    .filter(t => t.type === "EXPENSE")
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);

  const previousExpense = previousTransactions
    .filter(t => t.type === "EXPENSE")
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);

  const expenseChange = previousExpense > 0
    ? ((currentExpense - previousExpense) / previousExpense) * 100
    : null;

  const expenseCategoryIds = new Set(
    categories
      .filter(c => {
        const type = String(c.type ?? c.category_type ?? c.transaction_type ?? c.jenis ?? "")
          .trim().toUpperCase();
        return !type || type === "EXPENSE" || type === "EXPENSES" || type === "PENGELUARAN";
      })
      .map(c => String(c.category_id || c.id || c.kode || ""))
  );

  const monthBudgets = budgets.filter(
    b => monthKey(b.month) === thisMonth &&
      expenseCategoryIds.has(String(b.category_id || ""))
  );
  const totalBudget = monthBudgets.reduce((s, b) => s + (Number(b.amount) || 0), 0);

  const spentByCategory = {};
  currentTransactions
    .filter(t => t.type === "EXPENSE")
    .forEach(t => {
      const key = String(t.category_id || t.category || "");
      spentByCategory[key] = (spentByCategory[key] || 0) + (Number(t.amount) || 0);
    });

  const budgetRows = monthBudgets.map(b => {
    const key = String(b.category_id || "");
    const budget = Number(b.amount) || 0;
    const spent = spentByCategory[key] || 0;
    const pct = budget > 0 ? (spent / budget) * 100 : 0;
    return {
      ...b,
      name: categoryName(categories, key),
      budget,
      spent,
      pct
    };
  });

  const overBudget = budgetRows.filter(x => x.pct >= 100);
  const nearBudget = budgetRows.filter(x => x.pct >= 80 && x.pct < 100);
  const safeBudget = budgetRows.filter(x => x.pct < 80);

  let health = "safe";
  if (overBudget.length) health = "over";
  else if (nearBudget.length) health = "near";

  const healthTitle = health === "over"
    ? `${overBudget.length} kategori melewati anggaran`
    : health === "near"
      ? `${nearBudget.length} kategori mendekati batas`
      : monthBudgets.length
        ? "Anggaran bulan ini masih aman"
        : "Belum ada anggaran bulan ini";

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Keuangan</span>
          <h1>Dashboard</h1>
        </div>
        <div className="header-actions">
          <button className="icon-button" onClick={onTransfer} title="Transfer antar akun">⇄</button>
          <button className="icon-button" onClick={onAdd} title="Tambah transaksi">+</button>
        </div>
      </header>

      <section className="balance-card">
        <div className="card-label"><Wallet size={18} /> Arus kas bersih</div>
        <div className="balance">{money(net)}</div>
        <div className="balance-note">Total pemasukan dikurangi total pengeluaran</div>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon income-bg"><ArrowUpRight size={18} /></div>
          <span>Pemasukan</span>
          <strong>{money(income)}</strong>
        </div>
        <div className="stat-card">
          <div className="stat-icon expense-bg"><ArrowDownLeft size={18} /></div>
          <span>Pengeluaran</span>
          <strong>{money(expense)}</strong>
        </div>
      </section>

      <section className={`smart-card smart-${health}`}>
        <div className="smart-icon">
          {health === "over" ? <AlertTriangle size={20} /> :
           health === "near" ? <AlertTriangle size={20} /> :
           <CheckCircle2 size={20} />}
        </div>
        <div className="smart-content">
          <strong>{healthTitle}</strong>
          <span>
            {monthBudgets.length
              ? `${money(currentExpense)} terpakai dari ${money(totalBudget)} anggaran`
              : "Atur anggaran kategori untuk mendapatkan peringatan otomatis."}
          </span>
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <h2>Bulan ini</h2>
          <span>{thisMonth}</span>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon income-bg"><TrendingUp size={18} /></div>
            <span>Pemasukan bulan ini</span>
            <strong>{money(currentIncome)}</strong>
          </div>

          <div className="stat-card">
            <div className="stat-icon expense-bg">
              {expenseChange !== null && expenseChange <= 0
                ? <TrendingDown size={18} />
                : <TrendingUp size={18} />}
            </div>
            <span>Pengeluaran bulan ini</span>
            <strong>{money(currentExpense)}</strong>
            <small className={
              expenseChange === null ? "muted" :
              expenseChange > 0 ? "change-up" : "change-down"
            }>
              {expenseChange === null
                ? "Belum ada pembanding bulan lalu"
                : `${expenseChange > 0 ? "Naik" : "Turun"} ${Math.abs(expenseChange).toFixed(0)}% vs bulan lalu`}
            </small>
          </div>
        </div>
      </section>

      {budgetRows.length > 0 && (
        <section className="section">
          <div className="section-title">
            <h2>Pantauan anggaran</h2>
            <span>{budgetRows.length} kategori</span>
          </div>

          <div className="smart-budget-list">
            {budgetRows
              .sort((a, b) => b.pct - a.pct)
              .slice(0, 5)
              .map(row => (
                <div className="smart-budget-row" key={`${row.month}-${row.category_id}`}>
                  <div className="smart-budget-head">
                    <span>{row.name}</span>
                    <strong>{money(row.spent)} / {money(row.budget)}</strong>
                  </div>
                  <div className="progress">
                    <div
                      className={row.pct >= 100 ? "budget-bar over" : row.pct >= 80 ? "budget-bar near" : "budget-bar"}
                      style={{ width: `${Math.min(row.pct, 100)}%` }}
                    />
                  </div>
                  <small className={row.pct >= 100 ? "budget-over" : row.pct >= 80 ? "budget-near" : "budget-safe"}>
                    {row.pct >= 100
                      ? `Melebihi ${money(row.spent - row.budget)}`
                      : `Sisa ${money(row.budget - row.spent)}`}
                  </small>
                </div>
              ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-title">
          <h2>Saldo akun</h2>
          <span>{accountBalances.length} akun</span>
        </div>
        <div className="account-grid">
          {accountBalances.map((account) => (
            <div className="account-card" key={account.account_id || account.id}>
              <div className="account-card-top">
                <div className="account-icon"><Landmark size={17} /></div>
                <span>{account.name || account.account_name || account.account_id || account.id}</span>
              </div>
              <strong>{money(account.balance)}</strong>
              <small>
                Pemasukan {money(account.income)} · Pengeluaran {money(account.expense)}
              </small>
            </div>
          ))}
          {!accountBalances.length && <div className="empty">Belum ada akun aktif.</div>}
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <h2>Transaksi terbaru</h2>
          <span>{transactions.length} transaksi</span>
        </div>
        <div className="transaction-list">
          {transactions.slice(0, 5).map((item) => (
            <TransactionItem key={item.transaction_id || item.id} transaction={item} />
          ))}
          {!transactions.length && <div className="empty">Belum ada transaksi.</div>}
        </div>
      </section>
    </div>
  );
}
