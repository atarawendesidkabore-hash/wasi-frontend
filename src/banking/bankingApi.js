const DEFAULT_API_BASE_URL = "http://localhost:8010";

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

const request = async (path, init = {}) => {
  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    ...init,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
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

export const fetchBankingState = async (limit = 100) => {
  const data = await request(`/api/v1/banking/state?limit=${limit}`);
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
