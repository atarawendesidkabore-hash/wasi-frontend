import { resolvePlatformApiBaseUrl } from "../platform/apiResolver";

const ACCESS_TOKEN_STORAGE_KEY = "WASI_BANKING_ACCESS_TOKEN";
const WASI_TERMINAL_TOKEN_KEY = "wasi_token";
const WASI_TERMINAL_TOKEN_TS_KEY = "wasi_token_ts";

const resolveApiBaseUrl = () => {
  return resolvePlatformApiBaseUrl();
};

const getAccessToken = () => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
};

const setAccessToken = (token) => {
  if (typeof window === "undefined") {
    return;
  }
  if (!token) {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
};

export const clearBankingSession = () => {
  setAccessToken(null);
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(WASI_TERMINAL_TOKEN_KEY);
    window.sessionStorage.removeItem(WASI_TERMINAL_TOKEN_TS_KEY);
  }
};

export const syncWasiTerminalSession = () => {
  if (typeof window === "undefined") return false;
  const token = getAccessToken();
  if (!token) return false;
  window.sessionStorage.setItem(WASI_TERMINAL_TOKEN_KEY, token);
  window.sessionStorage.setItem(WASI_TERMINAL_TOKEN_TS_KEY, String(Date.now()));
  return true;
};

const request = async (path, init = {}) => {
  const { idempotencyKey = null, ...fetchInit } = init;
  const token = getAccessToken();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const idempotencyHeaders = idempotencyKey
    ? { "Idempotency-Key": idempotencyKey }
    : {};

  let response;

  try {
    response = await fetch(`${resolveApiBaseUrl()}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...idempotencyHeaders,
        ...(init.headers || {}),
      },
      ...fetchInit,
    });
  } catch {
    throw new Error(
      "API bancaire indisponible. Verifiez le backend local ou utilisez le mode demonstration."
    );
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    if (response.status === 401) {
      clearBankingSession();
    }
    const fallbackError = `HTTP ${response.status}`;
    throw new Error(payload?.error || fallbackError);
  }

  return payload.data;
};

const createIdempotencyKey = (prefix) => {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}-${Date.now()}`;
  return `${prefix}-${Date.now()}-${randomPart}`;
};

const toBigIntState = (state) => ({
  accounts: (state.accounts || []).map((account) => ({
    id: account.id,
    holder: account.holder,
    type: account.type,
    currency: account.currency,
    balanceCentimes: BigInt(account.balanceCentimes),
  })),
  transactions: (state.transactions || []).map((transaction) => ({
    id: transaction.id,
    accountId: transaction.accountId,
    kind: transaction.kind,
    amountCentimes: BigInt(transaction.amountCentimes),
    createdAtUtc: transaction.createdAtUtc,
    description: transaction.description,
    transferGroupId: transaction.transferGroupId || null,
  })),
});

export const loginBanking = async ({ username, password }) => {
  const data = await request("/api/v1/banking/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
    headers: {},
  });
  setAccessToken(data.accessToken);
  return data.user;
};

export const fetchBankingHealth = async () =>
  request("/api/health", {
    method: "GET",
    headers: {},
  });

export const fetchCurrentBankingUser = async () =>
  request("/api/v1/banking/auth/me", {
    method: "GET",
  });

export const fetchBankingState = async (limit = 100) => {
  const data = await request(`/api/v1/banking/state?limit=${limit}`, {
    method: "GET",
  });
  return toBigIntState(data);
};

export const fetchBankingApprovals = async ({
  status = "PENDING",
  limit = 100,
} = {}) => {
  const safeStatus = String(status || "PENDING").trim().toUpperCase();
  const safeLimit = Number.isFinite(Number(limit)) ? Number(limit) : 100;
  const data = await request(
    `/api/v1/banking/approvals?status=${encodeURIComponent(
      safeStatus
    )}&limit=${safeLimit}`,
    {
      method: "GET",
    }
  );
  return data.approvals || [];
};

export const fetchMyBankingApprovals = async ({
  status = "PENDING",
  limit = 100,
} = {}) => {
  const safeStatus = String(status || "PENDING").trim().toUpperCase();
  const safeLimit = Number.isFinite(Number(limit)) ? Number(limit) : 100;
  const data = await request(
    `/api/v1/banking/my-approvals?status=${encodeURIComponent(
      safeStatus
    )}&limit=${safeLimit}`,
    {
      method: "GET",
    }
  );
  return data.approvals || [];
};

export const fetchBankingAudit = async ({ limit = 100 } = {}) => {
  const safeLimit = Number.isFinite(Number(limit)) ? Number(limit) : 100;
  const data = await request(`/api/v1/banking/audit?limit=${safeLimit}`, {
    method: "GET",
  });
  return data.entries || [];
};

export const approveBankingApproval = async ({
  approvalId,
  decisionNote = "Approved from manager console",
  idempotencyKey = createIdempotencyKey("approval-approve"),
}) => {
  const data = await request(`/api/v1/banking/approvals/${approvalId}/approve`, {
    method: "POST",
    idempotencyKey,
    body: JSON.stringify({
      decisionNote,
    }),
  });
  return data;
};

export const rejectBankingApproval = async ({
  approvalId,
  decisionNote = "Rejected from manager console",
  idempotencyKey = createIdempotencyKey("approval-reject"),
}) => {
  const data = await request(`/api/v1/banking/approvals/${approvalId}/reject`, {
    method: "POST",
    idempotencyKey,
    body: JSON.stringify({
      decisionNote,
    }),
  });
  return data;
};

export const postDeposit = async ({
  accountId,
  amountCentimes,
  description = "Manual deposit",
  idempotencyKey = createIdempotencyKey("deposit"),
}) => {
  const data = await request("/api/v1/banking/deposit", {
    method: "POST",
    idempotencyKey,
    body: JSON.stringify({
      accountId,
      amountCentimes: amountCentimes.toString(),
      description,
    }),
  });
  return toBigIntState(data.state);
};

export const postWithdraw = async ({
  accountId,
  amountCentimes,
  description = "Manual withdrawal",
  idempotencyKey = createIdempotencyKey("withdraw"),
}) => {
  const data = await request("/api/v1/banking/withdraw", {
    method: "POST",
    idempotencyKey,
    body: JSON.stringify({
      accountId,
      amountCentimes: amountCentimes.toString(),
      description,
    }),
  });
  return toBigIntState(data.state);
};

export const postTransfer = async ({
  fromAccountId,
  toAccountId,
  amountCentimes,
  description = "Internal transfer",
  idempotencyKey = createIdempotencyKey("transfer"),
}) => {
  const data = await request("/api/v1/banking/transfer", {
    method: "POST",
    idempotencyKey,
    body: JSON.stringify({
      fromAccountId,
      toAccountId,
      amountCentimes: amountCentimes.toString(),
      description,
    }),
  });
  return toBigIntState(data.state);
};
