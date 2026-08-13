import { useState } from "react";

export default function AddTransfer({ accounts, onSave, saving }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    from_account: accounts[0]?.account_id || "",
    to_account: accounts[1]?.account_id || "",
    amount: "",
    description: ""
  });

  function update(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function submit(e) {
    e.preventDefault();
    if (form.from_account === form.to_account) return;
    onSave({
      action: "create_transfer",
      ...form,
      amount: Number(form.amount)
    });
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Perpindahan dana</span>
          <h1>Transfer</h1>
        </div>
      </header>

      <form className="form-card" onSubmit={submit}>
        <div className="transfer-hint">
          Transfer tidak dihitung sebagai pemasukan atau pengeluaran.
          Saldo akun asal berkurang dan akun tujuan bertambah.
        </div>

        <label>Tanggal
          <input
            type="date"
            value={form.date}
            onChange={e => update("date", e.target.value)}
            required
          />
        </label>

        <label>Dari akun
          <select
            value={form.from_account}
            onChange={e => update("from_account", e.target.value)}
            required
          >
            <option value="">Pilih akun asal</option>
            {accounts.map(a => (
              <option key={a.account_id || a.id} value={a.account_id || a.id}>
                {a.name || a.account_name || a.account_id || a.id}
              </option>
            ))}
          </select>
        </label>

        <div className="transfer-arrow">↓</div>

        <label>Ke akun
          <select
            value={form.to_account}
            onChange={e => update("to_account", e.target.value)}
            required
          >
            <option value="">Pilih akun tujuan</option>
            {accounts.map(a => (
              <option key={a.account_id || a.id} value={a.account_id || a.id}>
                {a.name || a.account_name || a.account_id || a.id}
              </option>
            ))}
          </select>
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

        <label>Keterangan
          <input
            type="text"
            placeholder="Contoh: Isi saldo GoPay"
            value={form.description}
            onChange={e => update("description", e.target.value)}
          />
        </label>

        <button
          className="primary-button"
          disabled={
            saving ||
            !form.from_account ||
            !form.to_account ||
            form.from_account === form.to_account
          }
        >
          {saving ? "Menyimpan..." : "Simpan transfer"}
        </button>

        {form.from_account === form.to_account && form.from_account && (
          <p className="form-error">Akun asal dan tujuan harus berbeda.</p>
        )}
      </form>
    </div>
  );
}
