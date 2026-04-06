import { resolvePlatformApiBaseUrl } from "../platform/apiResolver";

const TOKEN_KEY = "WASI_BANKING_ACCESS_TOKEN";

const getToken = () =>
  typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;

export const clearAdminSession = () => {
  if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY);
};

const request = async (path, init = {}) => {
  const token = getToken();
  const res = await fetch(`${resolvePlatformApiBaseUrl()}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...init,
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.success) {
    if (res.status === 401) clearAdminSession();
    throw new Error(payload?.error || `HTTP ${res.status}`);
  }
  return payload.data;
};

/* ── Auth ─────────────────────────────────────────────── */
export const loginAdmin = async (username, password) => {
  const res = await fetch(`${resolvePlatformApiBaseUrl()}/api/v1/banking/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok || !data?.data?.accessToken) throw new Error(data?.error || "Login failed");
  window.localStorage.setItem(TOKEN_KEY, data.data.accessToken);
  return data.data.user;
};

export const fetchCurrentUser = () => request("/api/v1/banking/auth/me");

/* ── Audit ────────────────────────────────────────────── */
export const fetchAuditSummary = () => request("/api/v1/admin/audit/summary");
export const searchAuditLogs = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/api/v1/admin/audit/search?${qs}`);
};

/* ── Users ────────────────────────────────────────────── */
export const fetchUsers = (limit = 100) => request(`/api/v1/admin/users?limit=${limit}`);
export const updateUserRole = (userId, role) =>
  request(`/api/v1/admin/users/${userId}/role`, {
    method: "POST",
    body: JSON.stringify({ role }),
  });
export const updateUserStatus = (userId, isActive) =>
  request(`/api/v1/admin/users/${userId}/status`, {
    method: "POST",
    body: JSON.stringify({ is_active: isActive }),
  });

/* ── Alerts ───────────────────────────────────────────── */
export const fetchAlerts = (limit = 50, unread = false) =>
  request(`/api/v1/admin/alerts?limit=${limit}${unread ? "&unread=true" : ""}`);
export const acknowledgeAlert = (alertId) =>
  request(`/api/v1/admin/alerts/${alertId}/acknowledge`, { method: "POST" });

/* ── Health ───────────────────────────────────────────── */
export const fetchPlatformHealth = () => request("/api/v1/platform/health");

/* ── Transactions Export ──────────────────────────────── */
export const exportTransactionsCsv = async () => {
  const token = getToken();
  const res = await fetch(
    `${resolvePlatformApiBaseUrl()}/api/v1/banking/transactions/export?format=csv`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );
  if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wasi_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
