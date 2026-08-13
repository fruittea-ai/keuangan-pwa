import { useEffect, useState } from "react";
import BottomNavigation from "./components/BottomNavigation";
import Dashboard from "./pages/Dashboard";
import AddTransaction from "./pages/AddTransaction";
import AddTransfer from "./pages/AddTransfer";
import Transactions from "./pages/Transactions";
import Reports from "./pages/Reports";
import Budgets from "./pages/Budgets";
import Settings from "./pages/Settings";
import {
  getDashboard,
  getTransactions,
  getAccounts,
  getCategories,
  getAccountBalances,
  getBudgets,
  createTransaction,
  createTransfer,
  createBudget,
  API_URL
} from "./services/api";
import { addToQueue, getCache, setCache, getQueue } from "./services/storage";
import { syncQueue } from "./services/sync";

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [budgetMonth, setBudgetMonth] = useState(new Date().toISOString().slice(0, 7));
  const [dashboard, setDashboard] = useState(() => getCache("dashboard"));
  const [transactions, setTransactions] = useState(() => getCache("transactions", []));
  const [accounts, setAccounts] = useState(() => getCache("accounts", []));
  const [categories, setCategories] = useState(() => getCache("categories", []));
  const [accountBalances, setAccountBalances] = useState(() => getCache("accountBalances", []));
  const [budgets, setBudgets] = useState(() => getCache("budgets", []));
  const [loading, setLoading] = useState(!dashboard);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(getQueue().length);

  async function loadData() {
    if (!API_URL) {
      setLoading(false);
      setError("VITE_API_URL belum dikonfigurasi.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [dash, trx, acc, cat, bal, bud] = await Promise.all([
        getDashboard(),
        getTransactions(),
        getAccounts(),
        getCategories(),
        getAccountBalances(),
        getBudgets()
      ]);

      setDashboard(dash.data);
      setTransactions(trx.data || []);
      setAccounts(acc.data || []);
      setCategories(cat.data || []);
      setAccountBalances(bal.data || []);
      setBudgets(bud.data || []);

      setCache("dashboard", dash.data);
      setCache("transactions", trx.data || []);
      setCache("accounts", acc.data || []);
      setCache("categories", cat.data || []);
      setCache("accountBalances", bal.data || []);
      setCache("budgets", bud.data || []);
      setPending(getQueue().length);
    } catch (err) {
      setError(`${err.message} Menampilkan data terakhir yang tersimpan.`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    if (!API_URL || !navigator.onLine) return;

    const result = await syncQueue();
    setPending(result.pending);

    if (result.synced > 0) {
      await loadData();
    }
  }

  useEffect(() => {
    loadData();

    const goOnline = async () => {
      setOnline(true);
      setError("");
      await handleSync();
      await loadData();
    };

    const goOffline = () => {
      setOnline(false);
      setError("Offline. Transaksi baru akan disimpan di perangkat.");
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    const interval = setInterval(handleSync, 30000);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(interval);
    };
  }, []);

  async function saveTransfer(transfer) {
    setSaving(true);
    setError("");

    const payload = { ...transfer, action: "create_transfer" };

    try {
      if (!API_URL || !navigator.onLine) {
        addToQueue(payload);
        setPending(getQueue().length);
        setError("Offline. Transfer disimpan sementara dan akan disinkronkan otomatis.");
        setPage("dashboard");
        return;
      }

      await createTransfer(payload);
      await loadData();
      setPage("dashboard");
    } catch (err) {
      addToQueue(payload);
      setPending(getQueue().length);
      setError(`${err.message} Transfer disimpan sementara dan akan dicoba lagi otomatis.`);
      setPage("dashboard");
    } finally {
      setSaving(false);
    }
  }

  async function saveBudget(budget) {
    setSaving(true);
    setError("");
    const payload = { ...budget, action: "upsert_budget" };
    try {
      if (!API_URL || !navigator.onLine) {
        addToQueue(payload);
        setPending(getQueue().length);
        setError("Offline. Anggaran disimpan sementara dan akan disinkronkan otomatis.");
        return;
      }
      await createBudget(payload);
      await loadData();
    } catch (err) {
      addToQueue(payload);
      setPending(getQueue().length);
      setError(`${err.message} Anggaran disimpan sementara dan akan dicoba lagi otomatis.`);
    } finally {
      setSaving(false);
    }
  }

  async function saveTransaction(transaction) {
    setSaving(true);
    setError("");

    try {
      if (!API_URL || !navigator.onLine) {
        addToQueue(transaction);
        setPending(getQueue().length);
        setError("Offline. Transaksi disimpan sementara dan akan disinkronkan otomatis.");
        setPage("dashboard");
        return;
      }

      await createTransaction(transaction);
      await loadData();
      setPage("dashboard");
    } catch (err) {
      addToQueue(transaction);
      setPending(getQueue().length);
      setError(`${err.message} Transaksi disimpan sementara dan akan dicoba lagi otomatis.`);
      setPage("dashboard");
    } finally {
      setSaving(false);
    }
  }

  function renderPage() {
    switch (page) {
      case "transactions":
        return <Transactions transactions={transactions} loading={loading} />;
      case "add":
        return (
          <AddTransaction
            accounts={accounts}
            categories={categories}
            onSave={saveTransaction}
            saving={saving}
            onTransfer={() => setPage("transfer")}
          />
        );
      case "transfer":
        return (
          <AddTransfer
            accounts={accounts}
            onSave={saveTransfer}
            saving={saving}
          />
        );
      case "reports":
        return <Reports dashboard={dashboard} transactions={transactions} accountBalances={accountBalances} categories={categories} onBudget={() => setPage("budgets")} />;
      case "budgets":
        return <Budgets month={budgetMonth} setMonth={setBudgetMonth} categories={categories} budgets={budgets.filter(b => String(b.month || "").slice(0, 7) === budgetMonth)} transactions={transactions} onSave={saveBudget} saving={saving} />;
      case "settings":
        return <Settings apiUrl={API_URL} online={online} pending={pending} onSync={handleSync} />;
      default:
        return (
          <Dashboard
            dashboard={dashboard}
            transactions={transactions}
            accountBalances={accountBalances}
            categories={categories}
            budgets={budgets}
            loading={loading}
            onAdd={() => setPage("add")}
            onTransfer={() => setPage("transfer")}
          />
        );
    }
  }

  return (
    <div className="app-shell">
      <div className={`connection-status ${online ? "online" : "offline"}`}>
        {online ? "Online" : "Offline"}
        {pending > 0 ? ` · ${pending} menunggu sinkronisasi` : ""}
      </div>
      {error && <div className="error-banner">{error}</div>}
      {renderPage()}
      <BottomNavigation page={page} setPage={setPage} />
    </div>
  );
}
