import cors from "cors";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Run banking API on a dedicated port to avoid clashing with wasi-backend-api.
const PORT = Number(process.env.BANKING_API_PORT ?? process.env.PORT ?? 8010);
const MAX_SAFE_AMOUNT_CENTIMES = BigInt(Number.MAX_SAFE_INTEGER);
const DB_PATH =
  process.env.BANKING_DB_PATH ??
  path.join(__dirname, "data", "wasi_banking.sqlite");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    holder TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('CHECKING','SAVINGS','BUSINESS')),
    currency TEXT NOT NULL CHECK (currency = 'XOF'),
    balance_centimes TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (
      kind IN ('DEPOSIT','WITHDRAWAL','TRANSFER_IN','TRANSFER_OUT')
    ),
    amount_centimes TEXT NOT NULL,
    description TEXT NOT NULL,
    transfer_group_id TEXT,
    created_at_utc TEXT NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_account_time
  ON transactions(account_id, created_at_utc DESC);

  CREATE INDEX IF NOT EXISTS idx_transactions_time
  ON transactions(created_at_utc DESC);
`);

const ensureSeedData = () => {
  const countRow = db.prepare("SELECT COUNT(*) AS count FROM accounts").get();
  if (Number(countRow?.count ?? 0) > 0) {
    return;
  }

  const now = new Date().toISOString();
  const seedAccounts = [
    {
      id: "fd43f43e-d0f7-4be3-9769-34bd4eebbc0b",
      holder: "Thomas Kabore",
      type: "CHECKING",
      currency: "XOF",
      balanceCentimes: "125000000",
    },
    {
      id: "05729563-6d54-4742-9d16-d2f29e5fd2e9",
      holder: "Thomas Kabore",
      type: "SAVINGS",
      currency: "XOF",
      balanceCentimes: "345500000",
    },
    {
      id: "7f3ec2be-3f2d-4994-9fdc-9603d2f12950",
      holder: "WASI SARL",
      type: "BUSINESS",
      currency: "XOF",
      balanceCentimes: "789250000",
    },
  ];

  const insertAccount = db.prepare(`
    INSERT INTO accounts (
      id, holder, type, currency, balance_centimes, created_at_utc, updated_at_utc
    ) VALUES (
      @id, @holder, @type, @currency, @balanceCentimes, @createdAtUtc, @updatedAtUtc
    )
  `);

  const insertMany = db.transaction((accounts) => {
    for (const account of accounts) {
      insertAccount.run({
        ...account,
        createdAtUtc: now,
        updatedAtUtc: now,
      });
    }
  });

  insertMany(seedAccounts);
};

ensureSeedData();

class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const success = (res, data, statusCode = 200) =>
  res.status(statusCode).json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });

const failure = (res, statusCode, error) =>
  res.status(statusCode).json({
    success: false,
    data: null,
    error,
    timestamp: new Date().toISOString(),
  });

const parseAmountCentimes = (value) => {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new ApiError(400, "amountCentimes must be a string or integer number.");
  }

  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) {
    throw new ApiError(400, "amountCentimes must be a positive integer in centimes.");
  }

  const amount = BigInt(normalized);
  if (amount <= 0n || amount > MAX_SAFE_AMOUNT_CENTIMES) {
    throw new ApiError(400, "amountCentimes is out of supported bounds.");
  }

  return amount;
};

const getAccountOrThrow = (accountId) => {
  const row = db.prepare("SELECT * FROM accounts WHERE id = ?").get(accountId);
  if (!row) {
    throw new ApiError(404, "Account not found.");
  }
  return row;
};

const serializeAccount = (row) => ({
  id: row.id,
  holder: row.holder,
  type: row.type,
  currency: row.currency,
  balanceCentimes: row.balance_centimes,
  createdAtUtc: row.created_at_utc,
  updatedAtUtc: row.updated_at_utc,
});

const serializeTransaction = (row) => ({
  id: row.id,
  accountId: row.account_id,
  kind: row.kind,
  amountCentimes: row.amount_centimes,
  description: row.description,
  transferGroupId: row.transfer_group_id ?? null,
  createdAtUtc: row.created_at_utc,
});

const getState = (limit = 100) => {
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 100;
  const accounts = db
    .prepare("SELECT * FROM accounts ORDER BY holder ASC, type ASC")
    .all()
    .map(serializeAccount);
  const transactions = db
    .prepare("SELECT * FROM transactions ORDER BY created_at_utc DESC LIMIT ?")
    .all(safeLimit)
    .map(serializeTransaction);
  return { accounts, transactions };
};

const updateAccountBalance = db.prepare(`
  UPDATE accounts
  SET balance_centimes = @balanceCentimes, updated_at_utc = @updatedAtUtc
  WHERE id = @id
`);

const insertTransaction = db.prepare(`
  INSERT INTO transactions (
    id, account_id, kind, amount_centimes, description, transfer_group_id, created_at_utc
  ) VALUES (
    @id, @accountId, @kind, @amountCentimes, @description, @transferGroupId, @createdAtUtc
  )
`);

app.get("/api/health", (_req, res) => {
  success(res, {
    service: "wasi-banking-api",
    status: "ok",
    database: DB_PATH,
  });
});

app.get("/api/v1/banking/state", (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 100);
    success(res, getState(limit));
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    failure(res, statusCode, error.message ?? "Unknown error");
  }
});

app.post("/api/v1/banking/deposit", (req, res) => {
  try {
    const { accountId, amountCentimes, description } = req.body ?? {};
    if (!accountId || typeof accountId !== "string") {
      throw new ApiError(400, "accountId is required.");
    }

    const amount = parseAmountCentimes(amountCentimes);
    const note = typeof description === "string" && description.trim()
      ? description.trim()
      : "Manual deposit";

    const transactionResult = db.transaction(() => {
      const account = getAccountOrThrow(accountId);
      const nextBalance = BigInt(account.balance_centimes) + amount;

      if (nextBalance > MAX_SAFE_AMOUNT_CENTIMES) {
        throw new ApiError(400, "Resulting balance exceeds supported bounds.");
      }

      const now = new Date().toISOString();
      updateAccountBalance.run({
        id: accountId,
        balanceCentimes: nextBalance.toString(),
        updatedAtUtc: now,
      });
      const transaction = {
        id: randomUUID(),
        accountId,
        kind: "DEPOSIT",
        amountCentimes: amount.toString(),
        description: note,
        transferGroupId: null,
        createdAtUtc: now,
      };
      insertTransaction.run(transaction);
      return transaction;
    })();

    success(res, {
      transaction: serializeTransaction({
        ...transactionResult,
        account_id: transactionResult.accountId,
        amount_centimes: transactionResult.amountCentimes,
        transfer_group_id: transactionResult.transferGroupId,
        created_at_utc: transactionResult.createdAtUtc,
      }),
      state: getState(100),
    });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    failure(res, statusCode, error.message ?? "Unknown error");
  }
});

app.post("/api/v1/banking/withdraw", (req, res) => {
  try {
    const { accountId, amountCentimes, description } = req.body ?? {};
    if (!accountId || typeof accountId !== "string") {
      throw new ApiError(400, "accountId is required.");
    }

    const amount = parseAmountCentimes(amountCentimes);
    const note = typeof description === "string" && description.trim()
      ? description.trim()
      : "Manual withdrawal";

    const transactionResult = db.transaction(() => {
      const account = getAccountOrThrow(accountId);
      const currentBalance = BigInt(account.balance_centimes);

      if (currentBalance < amount) {
        throw new ApiError(400, "Insufficient funds.");
      }

      const nextBalance = currentBalance - amount;
      const now = new Date().toISOString();
      updateAccountBalance.run({
        id: accountId,
        balanceCentimes: nextBalance.toString(),
        updatedAtUtc: now,
      });
      const transaction = {
        id: randomUUID(),
        accountId,
        kind: "WITHDRAWAL",
        amountCentimes: amount.toString(),
        description: note,
        transferGroupId: null,
        createdAtUtc: now,
      };
      insertTransaction.run(transaction);
      return transaction;
    })();

    success(res, {
      transaction: serializeTransaction({
        ...transactionResult,
        account_id: transactionResult.accountId,
        amount_centimes: transactionResult.amountCentimes,
        transfer_group_id: transactionResult.transferGroupId,
        created_at_utc: transactionResult.createdAtUtc,
      }),
      state: getState(100),
    });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    failure(res, statusCode, error.message ?? "Unknown error");
  }
});

app.post("/api/v1/banking/transfer", (req, res) => {
  try {
    const { fromAccountId, toAccountId, amountCentimes, description } = req.body ?? {};

    if (!fromAccountId || typeof fromAccountId !== "string") {
      throw new ApiError(400, "fromAccountId is required.");
    }
    if (!toAccountId || typeof toAccountId !== "string") {
      throw new ApiError(400, "toAccountId is required.");
    }
    if (fromAccountId === toAccountId) {
      throw new ApiError(400, "Cannot transfer to the same account.");
    }

    const amount = parseAmountCentimes(amountCentimes);
    const note = typeof description === "string" && description.trim()
      ? description.trim()
      : "Internal transfer";

    const transferResult = db.transaction(() => {
      const fromAccount = getAccountOrThrow(fromAccountId);
      const toAccount = getAccountOrThrow(toAccountId);

      const fromBalance = BigInt(fromAccount.balance_centimes);
      const toBalance = BigInt(toAccount.balance_centimes);
      if (fromBalance < amount) {
        throw new ApiError(400, "Insufficient funds.");
      }

      const nextFrom = fromBalance - amount;
      const nextTo = toBalance + amount;
      if (nextTo > MAX_SAFE_AMOUNT_CENTIMES) {
        throw new ApiError(400, "Resulting destination balance exceeds supported bounds.");
      }

      const now = new Date().toISOString();
      const transferGroupId = randomUUID();
      updateAccountBalance.run({
        id: fromAccountId,
        balanceCentimes: nextFrom.toString(),
        updatedAtUtc: now,
      });
      updateAccountBalance.run({
        id: toAccountId,
        balanceCentimes: nextTo.toString(),
        updatedAtUtc: now,
      });

      const transferOut = {
        id: randomUUID(),
        accountId: fromAccountId,
        kind: "TRANSFER_OUT",
        amountCentimes: amount.toString(),
        description: `${note} -> ${toAccount.holder}`,
        transferGroupId,
        createdAtUtc: now,
      };
      const transferIn = {
        id: randomUUID(),
        accountId: toAccountId,
        kind: "TRANSFER_IN",
        amountCentimes: amount.toString(),
        description: `${note} <- ${fromAccount.holder}`,
        transferGroupId,
        createdAtUtc: now,
      };

      insertTransaction.run(transferOut);
      insertTransaction.run(transferIn);
      return { transferOut, transferIn };
    })();

    success(res, {
      transactions: [
        serializeTransaction({
          ...transferResult.transferOut,
          account_id: transferResult.transferOut.accountId,
          amount_centimes: transferResult.transferOut.amountCentimes,
          transfer_group_id: transferResult.transferOut.transferGroupId,
          created_at_utc: transferResult.transferOut.createdAtUtc,
        }),
        serializeTransaction({
          ...transferResult.transferIn,
          account_id: transferResult.transferIn.accountId,
          amount_centimes: transferResult.transferIn.amountCentimes,
          transfer_group_id: transferResult.transferIn.transferGroupId,
          created_at_utc: transferResult.transferIn.createdAtUtc,
        }),
      ],
      state: getState(100),
    });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    failure(res, statusCode, error.message ?? "Unknown error");
  }
});

app.use((_req, res) => {
  failure(res, 404, "Route not found.");
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`WASI Banking API listening on http://localhost:${PORT}`);
});
