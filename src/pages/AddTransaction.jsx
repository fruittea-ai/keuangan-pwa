import { useMemo, useState } from "react";

function categoryType(category) {
  const type = String(
    category?.type ??
    category?.category_type ??
    category?.transaction_type ??
    category?.jenis ??
    ""
  ).trim().toUpperCase();

  if (type === "INCOME" || type === "INCOMES" || type === "PEMASUKAN") return "INCOME";
  return "EXPENSE";
}

export default function AddTransaction({ accounts, categories, onSave, saving, onTransfer }) {
  const normalizedCategories = useMemo(
    () => categories.map(c => ({ ...c, _type: categoryType(c) })),
    [categories]
  );

  const expenseCategories = normalizedCategories.filter(c => c._type === "EXPENSE");
  const incomeCategories = normalizedCategories.filter(c => c._type === "INCOME");

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: "EXPENSE",
    category_id: expenseCategories[0]?.category_id || "",
    account_id: accounts[0]?.account_id || "",
    amount: "",
    description: "",
    notes: ""
  });

  function update(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function changeType(type) {
    const list = type === "INCOME" ? incomeCategories : expenseCategories;
    setForm(prev => ({
      ...prev,
      type,
      category_id: list[0]?.category_id || ""
    }));
  }

  function submit(e) {
    e.preventDefault();
    if (!form.category_id) return;
    onSave({ ...form, amount: Number(form.amount) });
  }

  const currentCategories =
    form.type === "INCOME" ? incomeCategories : expenseCategories;

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Transaksi</span>
          <h1>Tambah</h1>
        </div>
      </header>

      <div className="secondary-action-row">
        <button type="button" className="secondary-button" onClick={onTransfer}>
          Transfer antar akun
        </button>
      </div>

      <form className="form-card" onSubmit={submit}>
        <div className="type-toggle">
          <button type="button" className={form.type === "EXPENSE" ? "selected expense-tab" : ""} onClick={() => changeType("EXPENSE")}>Pengeluaran</button>
          <button type="button" className={form.type === "INCOME" ? "selected income-tab" : ""} onClick={() => changeType("INCOME")}>Pemasukan</button>
        </div>

        <label>Tanggal
          <input type="date" value={form.date} onChange={e => update("date", e.target.value)} required />
        </label>

        <label>Nominal
          <input
            type="number"
            inputMode="numeric"
            min="1"
            placeholder="0"
            value={form.amount}
            onChange={e => update("amount", e.target.value)}
            required
          />
        </label>

        <label>
          Kategori
          <select value={form.category_id} onChange={e => update("category_id", e.target.value)} required>
            <option value="">Pilih kategori {form.type === "INCOME" ? "pemasukan" : "pengeluaran"}</option>
            {currentCategories.map(c => (
              <option key={c.category_id} value={c.category_id}>
                {c.name || c.category_name || c.nama || c.category_id}
              </option>
            ))}
          </select>
          <small className="form-help">
            {form.type === "INCOME"
              ? "Hanya kategori pemasukan yang ditampilkan."
              : "Hanya kategori pengeluaran yang ditampilkan."}
          </small>
        </label>

        <label>Akun
          <select value={form.account_id} onChange={e => update("account_id", e.target.value)} required>
            <option value="">Pilih akun</option>
            {accounts.map(a => (
              <option key={a.account_id} value={a.account_id}>{a.name}</option>
            ))}
          </select>
        </label>

        <label>Keterangan
          <input
            type="text"
            placeholder={form.type === "INCOME" ? "Contoh: Gaji bulan Agustus" : "Contoh: Makan siang"}
            value={form.description}
            onChange={e => update("description", e.target.value)}
          />
        </label>

        <label>Catatan
          <textarea
            rows="3"
            placeholder="Catatan tambahan..."
            value={form.notes}
            onChange={e => update("notes", e.target.value)}
          />
        </label>

        <button className="primary-button" disabled={saving || !form.category_id}>
          {saving ? "Menyimpan..." : "Simpan transaksi"}
        </button>
      </form>
    </div>
  );
}
