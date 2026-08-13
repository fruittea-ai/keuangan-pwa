import { useMemo, useState } from "react";
import {
  CalendarDays, ChevronDown, TrendingDown, TrendingUp, Wallet,
  ArrowUpRight, ArrowDownRight
} from "lucide-react";

function money(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function monthKey(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  if (!key) return "";
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" })
    .format(new Date(year, month - 1, 1));
}

function getDateKey(value) {
  const text = String(value || "");
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function Reports({
  dashboard,
  transactions = [],
  accountBalances = [],
  categories = [],
  onBudget
}) {
  const [month, setMonth] = useState(monthKey(new Date()));

  const categoryNames = useMemo(() => {
    const map = {};
    categories.forEach(c => {
      const id = c.category_id || c.id || c.kode;
      if (id) map[String(id)] = c.name || c.category_name || c.nama || id;
    });
    return map;
  }, [categories]);

  const report = useMemo(() => {
    const filtered = transactions.filter(t =>
      t.status !== "VOID" && getDateKey(t.date).slice(0, 7) === month
    );

    let income = 0;
    let expense = 0;
    const categoryMap = {};
    const days = {};

    filtered.forEach(t => {
      const amount = Number(t.amount) || 0;
      const day = getDateKey(t.date);

      if (t.type === "INCOME") income += amount;
      if (t.type === "EXPENSE") {
        expense += amount;
        const id = String(t.category_id || "");
        const name = categoryNames[id] || id || "Tanpa kategori";
        categoryMap[name] = (categoryMap[name] || 0) + amount;
      }

      if (day) {
        days[day] ||= { income: 0, expense: 0 };
        if (t.type === "INCOME") days[day].income += amount;
        if (t.type === "EXPENSE") days[day].expense += amount;
      }
    });

    return {
      filtered,
      income,
      expense,
      net: income - expense,
      categoryList: Object.entries(categoryMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
      dayList: Object.entries(days).sort(([a], [b]) => a.localeCompare(b)).slice(-14)
    };
  }, [transactions, month, categoryNames]);

  const maxCategory = report.categoryList[0]?.value || 1;
  const maxDay = Math.max(
    ...report.dayList.map(([, v]) => Math.max(v.income, v.expense)), 1
  );
  const totalBalance = accountBalances.reduce(
    (sum, a) => sum + (Number(a.balance) || 0), 0
  );

  const incomeRatio = report.income + report.expense
    ? (report.income / (report.income + report.expense)) * 100 : 0;

  return (
    <div className="page reports-page">
      <header className="reports-header">
        <div>
          <span className="eyebrow">Analisis keuangan</span>
          <h1>Laporan</h1>
        </div>
        <button className="secondary-button report-budget-button" onClick={onBudget}>
          Anggaran
        </button>
      </header>

      <section className="report-filter-card">
        <div className="report-filter-label">
          <CalendarDays size={17} />
          <span>Periode laporan</span>
        </div>
        <label className="report-month-control">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
          <ChevronDown size={16} />
        </label>
      </section>

      <section className="report-hero-new">
        <div>
          <span className="eyebrow">Arus kas bersih</span>
          <strong className={report.net >= 0 ? "positive" : "negative"}>{money(report.net)}</strong>
          <p>{monthLabel(month)}</p>
        </div>
        <div className={`report-net-icon ${report.net >= 0 ? "positive-icon" : "negative-icon"}`}>
          {report.net >= 0 ? <TrendingUp size={25} /> : <TrendingDown size={25} />}
        </div>
      </section>

      <section className="report-summary-grid">
        <div className="report-summary-card income-card">
          <div className="summary-top">
            <span>Pemasukan</span>
            <span className="summary-icon"><ArrowUpRight size={16} /></span>
          </div>
          <strong>{money(report.income)}</strong>
          <small>{report.filtered.filter(t => t.type === "INCOME").length} transaksi</small>
        </div>
        <div className="report-summary-card expense-card">
          <div className="summary-top">
            <span>Pengeluaran</span>
            <span className="summary-icon"><ArrowDownRight size={16} /></span>
          </div>
          <strong>{money(report.expense)}</strong>
          <small>{report.filtered.filter(t => t.type === "EXPENSE").length} transaksi</small>
        </div>
      </section>

      <section className="report-card report-balance-card">
        <div className="report-card-heading">
          <div>
            <span className="eyebrow">Ringkasan</span>
            <h2>Komposisi arus kas</h2>
          </div>
          <Wallet size={20} />
        </div>
        <div className="cash-flow-track">
          <div style={{ width: `${incomeRatio}%` }} />
        </div>
        <div className="cash-flow-legend">
          <span><i className="dot income-dot" /> Pemasukan <b>{incomeRatio.toFixed(0)}%</b></span>
          <span><i className="dot expense-dot" /> Pengeluaran <b>{(100 - incomeRatio).toFixed(0)}%</b></span>
        </div>
      </section>

      <section className="report-card">
        <div className="report-card-heading">
          <div>
            <span className="eyebrow">Pengeluaran</span>
            <h2>Berdasarkan kategori</h2>
          </div>
          <span className="report-count">{report.categoryList.length} kategori</span>
        </div>

        {report.categoryList.length ? (
          <div className="category-report-list">
            {report.categoryList.map((item, index) => (
              <div className="category-report-row" key={item.name}>
                <div className="category-rank">{index + 1}</div>
                <div className="category-report-main">
                  <div className="category-report-label">
                    <span>{item.name}</span>
                    <strong>{money(item.value)}</strong>
                  </div>
                  <div className="category-track">
                    <div style={{ width: `${Math.max(4, (item.value / maxCategory) * 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="report-empty">
            <TrendingDown size={20} />
            <strong>Belum ada pengeluaran</strong>
            <span>Belum ada transaksi pengeluaran pada {monthLabel(month)}.</span>
          </div>
        )}
      </section>

      <section className="report-card">
        <div className="report-card-heading">
          <div>
            <span className="eyebrow">Aktivitas harian</span>
            <h2>Tren 14 hari</h2>
          </div>
          <span className="report-count">Pemasukan vs pengeluaran</span>
        </div>

        {report.dayList.length ? (
          <div className="trend-chart">
            {report.dayList.map(([day, value]) => (
              <div className="trend-chart-row" key={day}>
                <span className="trend-date">{day.slice(8, 10)}</span>
                <div className="trend-chart-bars">
                  <div className="trend-bar income-trend" style={{ width: `${Math.max(value.income ? 4 : 0, (value.income / maxDay) * 100)}%` }} />
                  <div className="trend-bar expense-trend" style={{ width: `${Math.max(value.expense ? 4 : 0, (value.expense / maxDay) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="report-empty"><span>Belum ada aktivitas pada periode ini.</span></div>
        )}
        <div className="report-legend">
          <span><i className="dot income-dot" /> Pemasukan</span>
          <span><i className="dot expense-dot" /> Pengeluaran</span>
        </div>
      </section>

      <section className="report-card">
        <div className="report-card-heading">
          <div>
            <span className="eyebrow">Saldo</span>
            <h2>Posisi kas</h2>
          </div>
          <strong className="report-total-balance">{money(totalBalance)}</strong>
        </div>
        <div className="account-report-list">
          {accountBalances.map(account => (
            <div className="account-report-row" key={account.account_id || account.id}>
              <div className="account-report-name">
                <span className="account-report-icon"><Wallet size={15} /></span>
                <span>{account.name || account.account_name || account.account_id || account.id}</span>
              </div>
              <strong>{money(account.balance)}</strong>
            </div>
          ))}
          {!accountBalances.length && (
            <div className="report-empty"><span>Belum ada akun aktif.</span></div>
          )}
        </div>
      </section>

      <section className="report-note">
        <strong>Catatan laporan</strong>
        <p>
          Laporan dihitung dari transaksi aktif pada bulan yang dipilih.
          Transfer antar akun tidak dihitung sebagai pemasukan atau pengeluaran.
        </p>
      </section>
    </div>
  );
}
