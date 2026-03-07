import cors from "cors";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.BANKING_API_PORT ?? process.env.PORT ?? 8010);
const MAX_SAFE_AMOUNT_CENTIMES = BigInt(Number.MAX_SAFE_INTEGER);
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
const JWT_SECRET = process.env.BANKING_JWT_SECRET ?? "wasi-dev-insecure-secret";
const JWT_EXPIRES_IN = process.env.BANKING_JWT_EXPIRES_IN ?? "12h";
const DB_PATH =
  process.env.BANKING_DB_PATH ??
  path.join(__dirname, "data", "wasi_banking.sqlite");

const ROLE_CLIENT = "CLIENT";
const ROLE_TELLER = "TELLER";
const ROLE_MANAGER = "MANAGER";

const AUDIT_SUCCESS = "SUCCESS";
const AUDIT_FAILURE = "FAILURE";

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

  CREATE TABLE IF NOT EXISTS idempotency_records (
    id TEXT PRIMARY KEY,
    actor_user_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    response_status INTEGER NOT NULL,
    response_body TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    UNIQUE(actor_user_id, endpoint, idempotency_key)
  );

  CREATE INDEX IF NOT EXISTS idx_idempotency_created
  ON idempotency_records(created_at_utc DESC);

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    actor_user_id TEXT NOT NULL,
    actor_username TEXT,
    actor_role TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('SUCCESS','FAILURE')),
    detail_json TEXT,
    created_at_utc TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_audit_log_created
  ON audit_log(created_at_utc DESC);

  CREATE TRIGGER IF NOT EXISTS trg_audit_log_no_update
  BEFORE UPDATE ON audit_log
  BEGIN
    SELECT RAISE(ABORT, 'audit_log is immutable');
  END;

  CREATE TRIGGER IF NOT EXISTS trg_audit_log_no_delete
  BEFORE DELETE ON audit_log
  BEGIN
    SELECT RAISE(ABORT, 'audit_log is immutable');
  END;
`);

const ACCOUNT_ID_MAIN = "fd43f43e-d0f7-4be3-9769-34bd4eebbc0b";
const ACCOUNT_ID_SAVINGS = "05729563-6d54-4742-9d16-d2f29e5fd2e9";
const ACCOUNT_ID_BUSINESS = "7f3ec2be-3f2d-4994-9fdc-9603d2f12950";

const AUTH_USERS = [
  {
    id: "usr-client-demo",
    username: "client_demo",
    password: "client123",
    displayName: "Client Demo",
    role: ROLE_CLIENT,
    accountIds: [ACCOUNT_ID_MAIN, ACCOUNT_ID_SAVINGS],
  },
  {
    id: "usr-teller-demo",
    username: "teller_demo",
    password: "teller123",
    displayName: "Teller Demo",
    role: ROLE_TELLER,
    accountIds: [ACCOUNT_ID_MAIN, ACCOUNT_ID_SAVINGS, ACCOUNT_ID_BUSINESS],
  },
  {
    id: "usr-manager-demo",
    username: "manager_demo",
    password: "manager123",
    displayName: "Manager Demo",
    role: ROLE_MANAGER,
    accountIds: [ACCOUNT_ID_MAIN, ACCOUNT_ID_SAVINGS, ACCOUNT_ID_BUSINESS],
  },
];

const sanitizeUser = (user) => ({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
  role: user.role,
  accountIds: user.accountIds,
});

const ensureSeedData = () => {
  const countRow = db.prepare("SELECT COUNT(*) AS count FROM accounts").get();
  if (Number(countRow?.count ?? 0) > 0) {
    return;
  }

  const now = new Date().toISOString();
  const seedAccounts = [
    {
      id: ACCOUNT_ID_MAIN,
      holder: "Thomas Kabore",
      type: "CHECKING",
      currency: "XOF",
      balanceCentimes: "125000000",
    },
    {
      id: ACCOUNT_ID_SAVINGS,
      holder: "Thomas Kabore",
      type: "SAVINGS",
      currency: "XOF",
      balanceCentimes: "345500000",
    },
    {
      id: ACCOUNT_ID_BUSINESS,
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

const normalizeForHash = (value) => {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeForHash);
  }
  return Object.keys(value)
    .sort()
    .reduce((accumulator, key) => {
      accumulator[key] = normalizeForHash(value[key]);
      return accumulator;
    }, {});
};

const computeRequestHash = (body) => JSON.stringify(normalizeForHash(body ?? {}));

const parseIdempotencyKey = (req) => {
  const raw =
    req.headers["idempotency-key"] ??
    req.headers["x-idempotency-key"] ??
    null;

  if (!raw || typeof raw !== "string") {
    throw new ApiError(400, "Idempotency-Key header is required.");
  }

  const key = raw.trim();
  if (!key) {
    throw new ApiError(400, "Idempotency-Key header cannot be empty.");
  }
  if (key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    throw new ApiError(400, "Idempotency-Key header is too long.");
  }
  return key;
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

const serializeAuditEntry = (row) => {
  let detail = null;
  if (row.detail_json) {
    try {
      detail = JSON.parse(row.detail_json);
    } catch {
      detail = { raw: row.detail_json };
    }
  }

  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    actorUsername: row.actor_username,
    actorRole: row.actor_role,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    status: row.status,
    detail,
    createdAtUtc: row.created_at_utc,
  };
};

const getState = (limit = 100, authUser = null) => {
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 100;
  const allAccounts = db
    .prepare("SELECT * FROM accounts ORDER BY holder ASC, type ASC")
    .all()
    .map(serializeAccount);
  const allTransactions = db
    .prepare("SELECT * FROM transactions ORDER BY created_at_utc DESC")
    .all()
    .map(serializeTransaction);

  if (!authUser || authUser.role !== ROLE_CLIENT) {
    return {
      accounts: allAccounts,
      transactions: allTransactions.slice(0, safeLimit),
    };
  }

  const allowedAccountSet = new Set(authUser.accountIds || []);
  return {
    accounts: allAccounts.filter((account) => allowedAccountSet.has(account.id)),
    transactions: allTransactions
      .filter((transaction) => allowedAccountSet.has(transaction.accountId))
      .slice(0, safeLimit),
  };
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

const findIdempotencyRecord = db.prepare(`
  SELECT *
  FROM idempotency_records
  WHERE actor_user_id = ? AND endpoint = ? AND idempotency_key = ?
`);

const insertIdempotencyRecord = db.prepare(`
  INSERT INTO idempotency_records (
    id, actor_user_id, endpoint, idempotency_key, request_hash,
    response_status, response_body, created_at_utc
  ) VALUES (
    @id, @actorUserId, @endpoint, @idempotencyKey, @requestHash,
    @responseStatus, @responseBody, @createdAtUtc
  )
`);

const insertAuditLog = db.prepare(`
  INSERT INTO audit_log (
    id, actor_user_id, actor_username, actor_role, action,
    resource_type, resource_id, status, detail_json, created_at_utc
  ) VALUES (
    @id, @actorUserId, @actorUsername, @actorRole, @action,
    @resourceType, @resourceId, @status, @detailJson, @createdAtUtc
  )
`);

const getUserByUsername = (username) =>
  AUTH_USERS.find((user) => user.username.toLowerCase() === username.toLowerCase());

const signAccessToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      accountIds: user.accountIds,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

const parseBearerToken = (authorizationHeader) => {
  if (!authorizationHeader || typeof authorizationHeader !== "string") {
    return null;
  }
  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
};

const writeAuditLog = ({
  req = null,
  actorOverride = null,
  action,
  resourceType,
  resourceId = null,
  status = AUDIT_SUCCESS,
  detail = null,
}) => {
  try {
    const actor = actorOverride ?? req?.authUser ?? {};
    insertAuditLog.run({
      id: randomUUID(),
      actorUserId: actor.sub ?? actor.id ?? "anonymous",
      actorUsername: actor.username ?? null,
      actorRole: actor.role ?? null,
      action,
      resourceType,
      resourceId,
      status,
      detailJson: detail ? JSON.stringify(detail) : null,
      createdAtUtc: new Date().toISOString(),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("audit_log_write_failed", error.message);
  }
};

const executeIdempotentMutation = ({ req, mutate }) => {
  const actorUserId = req.authUser?.sub ?? "anonymous";
  const endpoint = req.path;
  const idempotencyKey = parseIdempotencyKey(req);
  const requestHash = computeRequestHash(req.body);

  const existingRecord = findIdempotencyRecord.get(
    actorUserId,
    endpoint,
    idempotencyKey
  );

  if (existingRecord) {
    if (existingRecord.request_hash !== requestHash) {
      throw new ApiError(
        409,
        "Idempotency key already used with a different request payload."
      );
    }

    const storedPayload = JSON.parse(existingRecord.response_body);
    return {
      replayed: true,
      idempotencyKey,
      statusCode: Number(existingRecord.response_status) || 200,
      payload: {
        ...storedPayload,
        idempotency: {
          key: idempotencyKey,
          replayed: true,
        },
      },
    };
  }

  const mutationPayload = mutate();
  const responsePayload = {
    ...mutationPayload,
    idempotency: {
      key: idempotencyKey,
      replayed: false,
    },
  };

  insertIdempotencyRecord.run({
    id: randomUUID(),
    actorUserId,
    endpoint,
    idempotencyKey,
    requestHash,
    responseStatus: 200,
    responseBody: JSON.stringify(responsePayload),
    createdAtUtc: new Date().toISOString(),
  });

  return {
    replayed: false,
    idempotencyKey,
    statusCode: 200,
    payload: responsePayload,
  };
};

const requireAuth = (req, _res, next) => {
  try {
    const token = parseBearerToken(req.headers.authorization);
    if (!token) {
      throw new ApiError(401, "Authentication token missing.");
    }

    const payload = jwt.verify(token, JWT_SECRET);
    req.authUser = payload;
    next();
  } catch (error) {
    writeAuditLog({
      req,
      action: "AUTH_ACCESS_DENIED",
      resourceType: "AUTH",
      status: AUDIT_FAILURE,
      detail: {
        path: req.path,
        reason: error.message,
      },
    });
    const statusCode =
      error instanceof ApiError ||
      error?.name === "JsonWebTokenError" ||
      error?.name === "TokenExpiredError"
        ? 401
        : 500;
    next(new ApiError(statusCode, "Unauthorized."));
  }
};

const requireRoles = (roles) => (req, _res, next) => {
  const currentRole = req.authUser?.role;
  if (!currentRole || !roles.includes(currentRole)) {
    writeAuditLog({
      req,
      action: "AUTH_ROLE_DENIED",
      resourceType: "AUTH",
      status: AUDIT_FAILURE,
      detail: {
        requiredRoles: roles,
        currentRole: currentRole ?? null,
        path: req.path,
      },
    });
    next(new ApiError(403, "Insufficient permissions."));
    return;
  }
  next();
};

app.get("/api/health", (_req, res) => {
  success(res, {
    service: "wasi-banking-api",
    status: "ok",
    database: DB_PATH,
    auth: "jwt-rbac-enabled",
    idempotency: "required-for-mutations",
    auditLog: "immutable-enabled",
  });
});

app.post("/api/v1/banking/auth/login", (req, res, next) => {
  try {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      throw new ApiError(400, "username and password are required.");
    }

    const user = getUserByUsername(String(username));
    if (!user || user.password !== String(password)) {
      writeAuditLog({
        actorOverride: { id: "anonymous", username: String(username), role: null },
        action: "LOGIN",
        resourceType: "AUTH",
        status: AUDIT_FAILURE,
        detail: { reason: "Invalid credentials." },
      });
      throw new ApiError(401, "Invalid credentials.");
    }

    const accessToken = signAccessToken(user);
    writeAuditLog({
      actorOverride: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      action: "LOGIN",
      resourceType: "AUTH",
      status: AUDIT_SUCCESS,
      detail: { tokenExpiresIn: JWT_EXPIRES_IN },
    });

    success(res, {
      accessToken,
      tokenType: "Bearer",
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/v1/banking/auth/me", requireAuth, (req, res) => {
  success(res, {
    id: req.authUser.sub,
    username: req.authUser.username,
    displayName: req.authUser.displayName,
    role: req.authUser.role,
    accountIds: req.authUser.accountIds,
  });
});

app.get("/api/v1/banking/state", requireAuth, (req, res, next) => {
  try {
    const limit = Number(req.query.limit ?? 100);
    success(res, getState(limit, req.authUser));
  } catch (error) {
    next(error);
  }
});

app.get(
  "/api/v1/banking/audit",
  requireAuth,
  requireRoles([ROLE_MANAGER]),
  (req, res, next) => {
    try {
      const limit = Number(req.query.limit ?? 100);
      const safeLimit = Number.isFinite(limit)
        ? Math.min(Math.max(limit, 1), 500)
        : 100;
      const rows = db
        .prepare("SELECT * FROM audit_log ORDER BY created_at_utc DESC LIMIT ?")
        .all(safeLimit);
      success(res, {
        entries: rows.map(serializeAuditEntry),
      });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/v1/banking/deposit",
  requireAuth,
  requireRoles([ROLE_TELLER, ROLE_MANAGER]),
  (req, res, next) => {
    try {
      const { accountId, amountCentimes, description } = req.body ?? {};
      if (!accountId || typeof accountId !== "string") {
        throw new ApiError(400, "accountId is required.");
      }

      const amount = parseAmountCentimes(amountCentimes);
      const note =
        typeof description === "string" && description.trim()
          ? description.trim()
          : "Manual deposit";

      const result = executeIdempotentMutation({
        req,
        mutate: () => {
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

          return {
            transaction: serializeTransaction({
              ...transactionResult,
              account_id: transactionResult.accountId,
              amount_centimes: transactionResult.amountCentimes,
              transfer_group_id: transactionResult.transferGroupId,
              created_at_utc: transactionResult.createdAtUtc,
            }),
            state: getState(100, req.authUser),
          };
        },
      });

      if (result.replayed) {
        res.set("X-Idempotency-Replayed", "true");
      }
      writeAuditLog({
        req,
        action: "DEPOSIT",
        resourceType: "ACCOUNT",
        resourceId: accountId,
        status: AUDIT_SUCCESS,
        detail: {
          amountCentimes: amount.toString(),
          idempotencyKey: result.idempotencyKey,
          replayed: result.replayed,
        },
      });

      success(res, result.payload, result.statusCode);
    } catch (error) {
      writeAuditLog({
        req,
        action: "DEPOSIT",
        resourceType: "ACCOUNT",
        resourceId: req.body?.accountId ?? null,
        status: AUDIT_FAILURE,
        detail: {
          reason: error.message,
          amountCentimes: req.body?.amountCentimes ?? null,
        },
      });
      next(error);
    }
  }
);

app.post(
  "/api/v1/banking/withdraw",
  requireAuth,
  requireRoles([ROLE_TELLER, ROLE_MANAGER]),
  (req, res, next) => {
    try {
      const { accountId, amountCentimes, description } = req.body ?? {};
      if (!accountId || typeof accountId !== "string") {
        throw new ApiError(400, "accountId is required.");
      }

      const amount = parseAmountCentimes(amountCentimes);
      const note =
        typeof description === "string" && description.trim()
          ? description.trim()
          : "Manual withdrawal";

      const result = executeIdempotentMutation({
        req,
        mutate: () => {
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

          return {
            transaction: serializeTransaction({
              ...transactionResult,
              account_id: transactionResult.accountId,
              amount_centimes: transactionResult.amountCentimes,
              transfer_group_id: transactionResult.transferGroupId,
              created_at_utc: transactionResult.createdAtUtc,
            }),
            state: getState(100, req.authUser),
          };
        },
      });

      if (result.replayed) {
        res.set("X-Idempotency-Replayed", "true");
      }
      writeAuditLog({
        req,
        action: "WITHDRAW",
        resourceType: "ACCOUNT",
        resourceId: accountId,
        status: AUDIT_SUCCESS,
        detail: {
          amountCentimes: amount.toString(),
          idempotencyKey: result.idempotencyKey,
          replayed: result.replayed,
        },
      });

      success(res, result.payload, result.statusCode);
    } catch (error) {
      writeAuditLog({
        req,
        action: "WITHDRAW",
        resourceType: "ACCOUNT",
        resourceId: req.body?.accountId ?? null,
        status: AUDIT_FAILURE,
        detail: {
          reason: error.message,
          amountCentimes: req.body?.amountCentimes ?? null,
        },
      });
      next(error);
    }
  }
);

app.post("/api/v1/banking/transfer", requireAuth, (req, res, next) => {
  try {
    const { fromAccountId, toAccountId, amountCentimes, description } = req.body ?? {};
    const currentRole = req.authUser?.role;

    if (!fromAccountId || typeof fromAccountId !== "string") {
      throw new ApiError(400, "fromAccountId is required.");
    }
    if (!toAccountId || typeof toAccountId !== "string") {
      throw new ApiError(400, "toAccountId is required.");
    }
    if (fromAccountId === toAccountId) {
      throw new ApiError(400, "Cannot transfer to the same account.");
    }

    if (![ROLE_CLIENT, ROLE_TELLER, ROLE_MANAGER].includes(currentRole)) {
      throw new ApiError(403, "Insufficient permissions.");
    }
    if (
      currentRole === ROLE_CLIENT &&
      !(req.authUser.accountIds || []).includes(fromAccountId)
    ) {
      throw new ApiError(403, "Client cannot transfer from this account.");
    }

    const amount = parseAmountCentimes(amountCentimes);
    const note =
      typeof description === "string" && description.trim()
        ? description.trim()
        : "Internal transfer";

    const result = executeIdempotentMutation({
      req,
      mutate: () => {
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
            throw new ApiError(
              400,
              "Resulting destination balance exceeds supported bounds."
            );
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

        return {
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
          state: getState(100, req.authUser),
        };
      },
    });

    if (result.replayed) {
      res.set("X-Idempotency-Replayed", "true");
    }
    writeAuditLog({
      req,
      action: "TRANSFER",
      resourceType: "ACCOUNT",
      resourceId: fromAccountId,
      status: AUDIT_SUCCESS,
      detail: {
        fromAccountId,
        toAccountId,
        amountCentimes: amount.toString(),
        idempotencyKey: result.idempotencyKey,
        replayed: result.replayed,
      },
    });

    success(res, result.payload, result.statusCode);
  } catch (error) {
    writeAuditLog({
      req,
      action: "TRANSFER",
      resourceType: "ACCOUNT",
      resourceId: req.body?.fromAccountId ?? null,
      status: AUDIT_FAILURE,
      detail: {
        reason: error.message,
        fromAccountId: req.body?.fromAccountId ?? null,
        toAccountId: req.body?.toAccountId ?? null,
        amountCentimes: req.body?.amountCentimes ?? null,
      },
    });
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const statusCode = error instanceof ApiError ? error.statusCode : 500;
  failure(res, statusCode, error.message ?? "Unknown error");
});

app.use((_req, res) => {
  failure(res, 404, "Route not found.");
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`WASI Banking API listening on http://localhost:${PORT}`);
});
