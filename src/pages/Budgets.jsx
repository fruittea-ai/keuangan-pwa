import { useMemo, useState } from "react";
import { CalendarDays, Target } from "lucide-react";

function money(value) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function isExpenseCategory(category) {
  const type = String(
    category.type ??
    category.category_type ??
    category.transaction_type ??
    category.jenis ??
    ""
  ).trim().toUpperCase();

  // Jika master kategori belum punya kolom tipe, tetap kompatibel.
  return !type || type === "EXPENSE" || type === "EXPENSES" || type === "PENGELUARAN";
}

export default function Budgets({ month, setMonth, categories = [], budgets = [], transactions = [], onSave, saving }) {
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");

  const expenseCategories = useMemo(
    () => categories.filter(isExpenseCategory),
    [categories]
  );

  const names = useMemo(() => Object.fromEntries(expenseCategories.map(c => {
    const id = c.category_id || c.id || c.kode;
    return [String(id), c.name || c.category_name || c.nama || id];
  })), [expenseCategories]);

  const expenseByCategory = useMemo(() => {
    const result = {};
    transactions.forEach(t => {
      if (t.status === "VOID" || t.type !== "EXPENSE") return;
      if (String(t.date || "").slice(0, 7) !== month) return;
      const id = String(t.category_id || "");
      result[id] = (result[id] || 0) + (Number(t.amount) || 0);
    });
    return result;
  }, [transactions, month]);

  const rows = useMemo(() => {
    const grouped = {};
    budgets.forEach(b => {
      const id = String(b.category_id || "");
      // Jika API lama masih mengirim duplikat, nilai terakhir menjadi canonical.
      grouped[id] = b;
    });

    return Object.values(grouped).map(b => {
      const id = String(b.category_id || "");
      const budget = Number(b.amount) || 0;
      const spent = expenseByCategory[id] || 0;
      const percent = budget > 0 ? (spent / budget) * 100 : 0;
      return { ...b, id, budget, spent, percent };
    }).sort((a, b) => b.percent - a.percent);
  }, [budgets, expenseByCategory, expenseCategories]);

  function submit(e) {
    e.preventDefault();
    if (!categoryId || Number(amount) <= 0) return;
    onSave({ action: "upsert_budget", month, category_id: categoryId, amount: Number(amount) });
    setAmount("");
  }

  return <div className="page">
    <header className="topbar">
      <div><span className="eyebrow">Perencanaan</span><h1>Anggaran</h1></div>
      <label className="month-picker"><CalendarDays size={17}/><input type="month" value={month} onChange={e => setMonth(e.target.value)}/></label>
    </header>

    <section className="report-hero">
      <span className="eyebrow">Anggaran {month}</span>
      <strong>{money(rows.reduce((sum, row) => sum + row.budget, 0))}</strong>
      <span>Total batas pengeluaran kategori</span>
    </section>

    <form className="form-card budget-form" onSubmit={submit}>
      <div className="section-title"><h2>Atur anggaran</h2><Target size={18}/></div>
      <p className="form-help">Anggaran hanya untuk kategori pengeluaran. Kategori pemasukan seperti Gaji tidak ditampilkan di sini.</p>
      <label>Kategori
        <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required>
          <option value="">Pilih kategori</option>
          {expenseCategories.map(c => {
            const id = c.category_id || c.id || c.kode;
            return <option key={id} value={id}>{c.name || c.category_name || c.nama || id}</option>;
          })}
        </select>
      </label>
      <label>Anggaran bulanan
        <input type="number" min="1" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} placeholder="1500000" required/>
      </label>
      <button className="primary-button" disabled={saving}>{saving ? "Menyimpan..." : "Simpan anggaran"}</button>
    </form>

    <section className="report-card">
      <div className="section-title"><h2>Realisasi</h2><span>{rows.length} kategori</span></div>
      {rows.length ? rows.map(r => {
        const over = r.spent > r.budget;
        const near = !over && r.percent >= 80;
        const width = Math.min(100, Math.max(0, r.percent));
        return <div className="budget-row" key={r.id}>
          <div className="bar-label"><span>{names[r.id] || r.id || "Tanpa kategori"}</span><strong>{money(r.spent)} / {money(r.budget)}</strong></div>
          <div className="bar-track"><div className={over ? "budget-bar over" : near ? "budget-bar near" : "budget-bar"} style={{ width: `${width}%` }}/></div>
          <div className="budget-meta">
            <span>{Math.round(r.percent)}% terpakai</span>
            <strong className={over ? "budget-over" : near ? "budget-near" : "budget-safe"}>{over ? `Melebihi ${money(r.spent - r.budget)}` : `Sisa ${money(r.budget - r.spent)}`}</strong>
          </div>
        </div>;
      }) : <div className="empty">Belum ada anggaran untuk bulan ini.</div>}
    </section>
  </div>;
}
