const API_URL = import.meta.env.VITE_API_URL || "";
const REQUEST_TIMEOUT = 15000;

function jsonp(action, params = {}) {
  if (!API_URL) return Promise.reject(new Error("VITE_API_URL belum dikonfigurasi."));

  return new Promise((resolve, reject) => {
    const callbackName = `__keuangan_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const query = new URLSearchParams({
      action, ...params, callback: callbackName, _: String(Date.now())
    });
    const script = document.createElement("script");

    function cleanup() {
      clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    }

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Request API timeout."));
    }, REQUEST_TIMEOUT);

    window[callbackName] = (data) => {
      cleanup();
      if (!data?.success) {
        reject(new Error(data?.error || data?.message || "API mengembalikan error."));
        return;
      }
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Gagal menghubungi Google Apps Script."));
    };

    script.src = `${API_URL}${API_URL.includes("?") ? "&" : "?"}${query}`;
    document.head.appendChild(script);
  });
}

async function request(url, options = {}) {
  if (!url) throw new Error("VITE_API_URL belum dikonfigurasi.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) throw new Error(`API HTTP ${response.status}`);

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || data.message || "API mengembalikan error.");
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Request API timeout.");
    if (!navigator.onLine) throw new Error("Perangkat sedang offline.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export const healthCheck = () => jsonp("health");
export const getDashboard = () => jsonp("dashboard");
export const getTransactions = (params = {}) => jsonp("transactions", params);
export const getAccounts = () => jsonp("accounts");
export const getAccountBalances = () => jsonp("account_balances");
export const getCategories = () => jsonp("categories");
export const getMonthlyReport = (month) => jsonp("monthly_report", month ? { month } : {});
export const getBudgets = (month) => jsonp("budgets", month ? { month } : {});

export const createTransaction = (transaction) => request(API_URL, {
  method: "POST",
  headers: { "Content-Type": "text/plain;charset=utf-8" },
  body: JSON.stringify({ action: "create_transaction", ...transaction })
});

export const createBudget = (budget) => request(API_URL, {
  method: "POST",
  headers: { "Content-Type": "text/plain;charset=utf-8" },
  body: JSON.stringify({ action: "upsert_budget", ...budget })
});

export const createTransfer = (transfer) => request(API_URL, {
  method: "POST",
  headers: { "Content-Type": "text/plain;charset=utf-8" },
  body: JSON.stringify({ action: "create_transfer", ...transfer })
});

export { API_URL };
