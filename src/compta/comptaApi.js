import { resolvePlatformApiBaseUrl } from "../platform/apiResolver";

const ACCESS_TOKEN_STORAGE_KEY = "WASI_BANKING_ACCESS_TOKEN";

const getAccessToken = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
};

const clearAccessToken = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
};

const request = async (path, init = {}) => {
  const token = getAccessToken();
  const response = await fetch(`${resolvePlatformApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    if (response.status === 401) {
      clearAccessToken();
    }
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }

  return payload.data;
};

const createIdempotencyKey = (prefix) => {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomPart}`;
};

export const fetchComptaOverview = async () =>
  request("/api/v1/compta/overview", { method: "GET" });

export const fetchComptaJournal = async (limit = 20) =>
  request(`/api/v1/compta/journal?limit=${limit}`, { method: "GET" });

export const fetchComptaTrialBalance = async () =>
  request("/api/v1/compta/trial-balance", { method: "GET" });

export const fetchAfriTaxSummary = async () =>
  request("/api/v1/afritax/summary", { method: "GET" });

export const postComptaJournalEntry = async ({
  reference,
  moduleSource = "MANUAL",
  description,
  entryDateUtc,
  lines,
  idempotencyKey = createIdempotencyKey("compta-entry"),
}) =>
  request("/api/v1/compta/journal", {
    method: "POST",
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      reference,
      moduleSource,
      description,
      entryDateUtc,
      lines,
    }),
  });
