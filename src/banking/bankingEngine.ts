/**
 * Core banking engine for the WASI desktop app.
 * Monetary amounts are represented as bigint in XOF centimes.
 */

export const MIN_MONETARY_AMOUNT_CENTIMES = 1n;
export const MAX_MONETARY_AMOUNT_CENTIMES = BigInt(Number.MAX_SAFE_INTEGER);

export type CurrencyCode = "XOF";
export type AccountType = "CHECKING" | "SAVINGS" | "BUSINESS";
export type TransactionKind =
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "TRANSFER_IN"
  | "TRANSFER_OUT";

export interface Account {
  id: string;
  holder: string;
  type: AccountType;
  currency: CurrencyCode;
  balanceCentimes: bigint;
}

export interface Transaction {
  id: string;
  accountId: string;
  kind: TransactionKind;
  amountCentimes: bigint;
  createdAtUtc: string;
  description: string;
}

export interface BankingState {
  accounts: Account[];
  transactions: Transaction[];
}

let transactionSequence = 0;

/**
 * Convert user amount input (example: "1250", "1250.50", "1250,5") to centimes.
 */
export const parseInputAmountToCentimes = (amountInput: string): bigint => {
  const normalized = amountInput.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Invalid amount format.");
  }

  const [wholePart, fractionalPart = ""] = normalized.split(".");
  const whole = BigInt(wholePart);
  const fractional = BigInt(fractionalPart.padEnd(2, "0"));
  const value = whole * 100n + fractional;

  validateMonetaryAmount(value);
  return value;
};

/**
 * Format XOF centimes as a human-readable value.
 */
export const formatXofCentimes = (amountCentimes: bigint): string => {
  const sign = amountCentimes < 0n ? "-" : "";
  const absValue = amountCentimes < 0n ? -amountCentimes : amountCentimes;
  const whole = absValue / 100n;
  const cents = absValue % 100n;
  const groupedWhole = whole
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  return `${sign}${groupedWhole}.${cents.toString().padStart(2, "0")} XOF`;
};

/**
 * Initialize the banking state with demo accounts.
 */
export const createInitialBankingState = (): BankingState => ({
  accounts: [
    {
      id: "acc_main",
      holder: "Thomas Kabore",
      type: "CHECKING",
      currency: "XOF",
      balanceCentimes: 125000000n,
    },
    {
      id: "acc_savings",
      holder: "Thomas Kabore",
      type: "SAVINGS",
      currency: "XOF",
      balanceCentimes: 345500000n,
    },
    {
      id: "acc_business",
      holder: "WASI SARL",
      type: "BUSINESS",
      currency: "XOF",
      balanceCentimes: 789250000n,
    },
  ],
  transactions: [],
});

/**
 * Apply a deposit to a target account.
 */
export const deposit = (
  state: BankingState,
  accountId: string,
  amountCentimes: bigint,
  description = "Deposit"
): BankingState => {
  validateMonetaryAmount(amountCentimes);
  const account = getAccountById(state, accountId);
  const updatedAccount: Account = {
    ...account,
    balanceCentimes: account.balanceCentimes + amountCentimes,
  };

  return applyStateUpdate(state, updatedAccount, {
    accountId,
    kind: "DEPOSIT",
    amountCentimes,
    description,
  });
};

/**
 * Apply a withdrawal to a target account.
 */
export const withdraw = (
  state: BankingState,
  accountId: string,
  amountCentimes: bigint,
  description = "Withdrawal"
): BankingState => {
  validateMonetaryAmount(amountCentimes);
  const account = getAccountById(state, accountId);
  if (account.balanceCentimes < amountCentimes) {
    throw new Error("Insufficient funds.");
  }

  const updatedAccount: Account = {
    ...account,
    balanceCentimes: account.balanceCentimes - amountCentimes,
  };

  return applyStateUpdate(state, updatedAccount, {
    accountId,
    kind: "WITHDRAWAL",
    amountCentimes,
    description,
  });
};

/**
 * Transfer funds from one account to another.
 */
export const transfer = (
  state: BankingState,
  fromAccountId: string,
  toAccountId: string,
  amountCentimes: bigint,
  description = "Internal transfer"
): BankingState => {
  if (fromAccountId === toAccountId) {
    throw new Error("Cannot transfer to the same account.");
  }
  validateMonetaryAmount(amountCentimes);

  const fromAccount = getAccountById(state, fromAccountId);
  const toAccount = getAccountById(state, toAccountId);

  if (fromAccount.balanceCentimes < amountCentimes) {
    throw new Error("Insufficient funds.");
  }

  const updatedAccounts = state.accounts.map((account) => {
    if (account.id === fromAccountId) {
      return {
        ...account,
        balanceCentimes: account.balanceCentimes - amountCentimes,
      };
    }
    if (account.id === toAccountId) {
      return {
        ...account,
        balanceCentimes: account.balanceCentimes + amountCentimes,
      };
    }
    return account;
  });

  const now = new Date().toISOString();
  const transferOut: Transaction = {
    id: buildTransactionId(),
    accountId: fromAccountId,
    kind: "TRANSFER_OUT",
    amountCentimes,
    createdAtUtc: now,
    description: `${description} -> ${toAccount.holder}`,
  };
  const transferIn: Transaction = {
    id: buildTransactionId(),
    accountId: toAccountId,
    kind: "TRANSFER_IN",
    amountCentimes,
    createdAtUtc: now,
    description: `${description} <- ${fromAccount.holder}`,
  };

  return {
    accounts: updatedAccounts,
    transactions: [transferOut, transferIn, ...state.transactions],
  };
};

const applyStateUpdate = (
  state: BankingState,
  updatedAccount: Account,
  transaction: Omit<Transaction, "id" | "createdAtUtc">
): BankingState => {
  const updatedAccounts = state.accounts.map((account) =>
    account.id === updatedAccount.id ? updatedAccount : account
  );
  const createdTransaction: Transaction = {
    ...transaction,
    id: buildTransactionId(),
    createdAtUtc: new Date().toISOString(),
  };

  return {
    accounts: updatedAccounts,
    transactions: [createdTransaction, ...state.transactions],
  };
};

const getAccountById = (state: BankingState, accountId: string): Account => {
  const account = state.accounts.find((candidate) => candidate.id === accountId);
  if (!account) {
    throw new Error("Account not found.");
  }
  return account;
};

const validateMonetaryAmount = (amountCentimes: bigint): void => {
  if (
    amountCentimes < MIN_MONETARY_AMOUNT_CENTIMES ||
    amountCentimes > MAX_MONETARY_AMOUNT_CENTIMES
  ) {
    throw new Error("Amount is out of supported bounds.");
  }
};

const buildTransactionId = (): string => {
  transactionSequence += 1;
  return `txn_${Date.now()}_${transactionSequence}`;
};
