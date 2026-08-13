import { BarChart3, Home, PlusCircle, Receipt, Settings } from "lucide-react";

export default function BottomNavigation({ page, setPage }) {
  const items = [
    ["dashboard", Home, "Home"],
    ["transactions", Receipt, "Riwayat"],
    ["add", PlusCircle, "Tambah"],
    ["reports", BarChart3, "Laporan"],
    ["settings", Settings, "Setting"]
  ];

  return (
    <nav className="bottom-nav">
      {items.map(([id, Icon, label]) => (
        <button
          key={id}
          className={page === id ? "nav-item active" : "nav-item"}
          onClick={() => setPage(id)}
        >
          <Icon size={20} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}