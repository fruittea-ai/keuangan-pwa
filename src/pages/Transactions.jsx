import TransactionItem from "../components/TransactionItem";

export default function Transactions({ transactions, loading }) {
  return (
    <div className="page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Keuangan</span>
          <h1>Riwayat</h1>
        </div>
      </header>

      <section className="transaction-list">
        {loading && <div className="loading">Memuat transaksi...</div>}
        {!loading && transactions.map(item => (
          <TransactionItem key={item.transaction_id} transaction={item} />
        ))}
        {!loading && !transactions.length && (
          <div className="empty">Belum ada transaksi.</div>
        )}
      </section>
    </div>
  );
}