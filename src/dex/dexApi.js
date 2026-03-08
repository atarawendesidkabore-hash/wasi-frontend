const DEFAULT_DEX_API_BASE_URL = "http://localhost:8010";
const ACCESS_TOKEN_STORAGE_KEY = "WASI_BANKING_ACCESS_TOKEN";

const resolveDexApiBaseUrl = () => {
  const explicitWindowValue =
    typeof window !== "undefined" &&
    typeof window.WASI_DEX_API_URL === "string"
      ? window.WASI_DEX_API_URL
      : null;
  const envValue =
    typeof import.meta !== "undefined" &&
    import.meta?.env &&
    typeof import.meta.env.VITE_WASI_DEX_API_URL === "string"
      ? import.meta.env.VITE_WASI_DEX_API_URL
      : null;
  const explicitStorageValue =
    typeof window !== "undefined"
      ? window.localStorage.getItem("WASI_DEX_API_URL")
      : null;
  const sharedBankingValue =
    typeof window !== "undefined"
      ? window.localStorage.getItem("WASI_BANKING_API_URL")
      : null;

  const baseUrl =
    explicitWindowValue ||
    envValue ||
    explicitStorageValue ||
    sharedBankingValue ||
    DEFAULT_DEX_API_BASE_URL;
  return baseUrl.replace(/\/+$/, "");
};

const getAccessToken = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
};

const setAccessToken = (token) => {
  if (typeof window === "undefined") return;
  if (!token) {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
};

export const clearDexSession = () => {
  setAccessToken(null);
};

const request = async (path, init = {}) => {
  const { idempotencyKey = null, ...fetchInit } = init;
  const token = getAccessToken();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const idempotencyHeaders = idempotencyKey
    ? { "Idempotency-Key": idempotencyKey }
    : {};

  const response = await fetch(`${resolveDexApiBaseUrl()}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...idempotencyHeaders,
      ...(fetchInit.headers || {}),
    },
    ...fetchInit,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    if (response.status === 401) {
      clearDexSession();
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

export const fetchDexHealth = async () =>
  request("/api/health", {
    method: "GET",
    headers: {},
  });

export const loginDex = async ({ username, password }) => {
  const data = await request("/api/v1/banking/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
    headers: {},
  });
  setAccessToken(data.accessToken);
  return data.user;
};

export const fetchDexMe = async () =>
  request("/api/v1/banking/auth/me", {
    method: "GET",
  });

export const fetchDexMarkets = async () =>
  request("/api/v1/dex/markets", {
    method: "GET",
    headers: {},
  });

export const fetchDexOrderBook = async (symbol, depth = 12) =>
  request(`/api/v1/dex/orderbook/${encodeURIComponent(symbol)}?depth=${depth}`, {
    method: "GET",
    headers: {},
  });

export const fetchDexPortfolio = async () =>
  request("/api/v1/dex/portfolio", {
    method: "GET",
  });

export const placeDexOrder = async ({
  symbol,
  side,
  quantityUnits,
  limitPriceCentimes,
  idempotencyKey = createIdempotencyKey("dex-order"),
}) =>
  request("/api/v1/dex/orders", {
    method: "POST",
    idempotencyKey,
    body: JSON.stringify({
      symbol,
      side,
      quantityUnits,
      limitPriceCentimes,
    }),
  });

export const cancelDexOrder = async (
  orderId,
  { idempotencyKey = createIdempotencyKey("dex-cancel") } = {}
) =>
  request(`/api/v1/dex/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: "POST",
    idempotencyKey,
    body: JSON.stringify({}),
  });

