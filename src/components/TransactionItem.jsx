function money(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

export default function TransactionItem({ transaction }) {
  const income = transaction.type === "INCOME";

  return (
    <div className="transaction-item">
      <div>
        <strong>{transaction.description || "Tanpa keterangan"}</strong>
        <small>{transaction.date} · {transaction.category_id}</small>
      </div>
      <strong className={income ? "income" : "expense"}>
        {income ? "+" : "-"} {money(transaction.amount)}
      </strong>
    </div>
  );
}