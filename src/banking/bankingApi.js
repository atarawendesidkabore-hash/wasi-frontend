const DEFAULT_API_BASE_URL = "http://localhost:8010";
const ACCESS_TOKEN_STORAGE_KEY = "WASI_BANKING_ACCESS_TOKEN";

const resolveApiBaseUrl = () => {
  const explicitWindowValue =
    typeof window !== "undefined" &&
    typeof window.WASI_BANKING_API_URL === "string"
      ? window.WASI_BANKING_API_URL
      : null;
  const envValue =
    typeof import.meta !== "undefined" &&
    import.meta?.env &&
    typeof import.meta.env.VITE_WASI_BANKING_API_URL === "string"
      ? import.meta.env.VITE_WASI_BANKING_API_URL
      : null;
  const explicitStorageValue =
    typeof window !== "undefined"
      ? window.localStorage.getItem("WASI_BANKING_API_URL")
      : null;

  const baseUrl =
    explicitWindowValue || envValue || explicitStorageValue || DEFAULT_API_BASE_URL;
  return baseUrl.replace(/\/+$/, "");
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
};

const request = async (path, init = {}) => {
  const token = getAccessToken();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...(init.headers || {}),
    },
    ...init,
  });

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

export const postDeposit = async ({
  accountId,
  amountCentimes,
  description = "Manual deposit",
}) => {
  const data = await request("/api/v1/banking/deposit", {
    method: "POST",
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
}) => {
  const data = await request("/api/v1/banking/withdraw", {
    method: "POST",
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
}) => {
  const data = await request("/api/v1/banking/transfer", {
    method: "POST",
    body: JSON.stringify({
      fromAccountId,
      toAccountId,
      amountCentimes: amountCentimes.toString(),
      description,
    }),
  });
  return toBigIntState(data.state);
};
