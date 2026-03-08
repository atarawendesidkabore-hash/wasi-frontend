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
const DEX_SIDE_BUY = "BUY";
const DEX_SIDE_SELL = "SELL";
const DEX_STATUS_OPEN = "OPEN";
const DEX_STATUS_PARTIAL = "PARTIAL";
const DEX_STATUS_FILLED = "FILLED";
const DEX_STATUS_CANCELLED = "CANCELLED";

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

  CREATE TABLE IF NOT EXISTS etf_tokens (
    symbol TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'BROAD',
    fee_bps INTEGER NOT NULL DEFAULT 35,
    underlying TEXT NOT NULL DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1,
    last_price_centimes TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dex_wallets (
    user_id TEXT PRIMARY KEY,
    xof_balance_centimes TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dex_positions (
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    quantity_units TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL,
    PRIMARY KEY (user_id, symbol),
    FOREIGN KEY (symbol) REFERENCES etf_tokens(symbol)
  );

  CREATE TABLE IF NOT EXISTS dex_orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('BUY','SELL')),
    limit_price_centimes TEXT NOT NULL,
    quantity_units TEXT NOT NULL,
    remaining_quantity_units TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('OPEN','PARTIAL','FILLED','CANCELLED')),
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL,
    FOREIGN KEY (symbol) REFERENCES etf_tokens(symbol)
  );

  CREATE INDEX IF NOT EXISTS idx_dex_orders_symbol_side_status
  ON dex_orders(symbol, side, status, created_at_utc ASC);

  CREATE INDEX IF NOT EXISTS idx_dex_orders_user_status
  ON dex_orders(user_id, status, created_at_utc DESC);

  CREATE TABLE IF NOT EXISTS dex_trades (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    buy_order_id TEXT NOT NULL,
    sell_order_id TEXT NOT NULL,
    buyer_user_id TEXT NOT NULL,
    seller_user_id TEXT NOT NULL,
    price_centimes TEXT NOT NULL,
    quantity_units TEXT NOT NULL,
    notional_centimes TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    FOREIGN KEY (symbol) REFERENCES etf_tokens(symbol)
  );

  CREATE INDEX IF NOT EXISTS idx_dex_trades_symbol_time
  ON dex_trades(symbol, created_at_utc DESC);

  CREATE INDEX IF NOT EXISTS idx_dex_trades_user_time
  ON dex_trades(buyer_user_id, seller_user_id, created_at_utc DESC);
`);

const ensureDexSchema = () => {
  const columns = db
    .prepare("PRAGMA table_info(etf_tokens)")
    .all()
    .map((column) => column.name);

  const addColumnIfMissing = (columnName, ddl) => {
    if (!columns.includes(columnName)) {
      db.exec(`ALTER TABLE etf_tokens ADD COLUMN ${ddl}`);
      columns.push(columnName);
    }
  };

  addColumnIfMissing("category", "category TEXT NOT NULL DEFAULT 'BROAD'");
  addColumnIfMissing("fee_bps", "fee_bps INTEGER NOT NULL DEFAULT 35");
  addColumnIfMissing("underlying", "underlying TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing("is_active", "is_active INTEGER NOT NULL DEFAULT 1");
};

ensureDexSchema();
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_etf_tokens_category_active
  ON etf_tokens(category, is_active, symbol);
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

const DEX_SEED_TOKENS = [
  { symbol: "WASI-COMP", name: "WASI Composite Index ETF", category: "BROAD", feeBps: 35, underlying: "Full 16-country WASI Composite", lastPriceCentimes: "824000" },
  { symbol: "WASI-PRI", name: "Primary Tier ETF", category: "REGIONAL", feeBps: 40, underlying: "NG 37.3%, CI 29.3%, GH 20%, SN 13.3%", lastPriceCentimes: "876000" },
  { symbol: "WASI-SEC", name: "Secondary Tier ETF", category: "REGIONAL", feeBps: 50, underlying: "BF/ML/GN/BJ/TG basket", lastPriceCentimes: "742000" },
  { symbol: "WASI-TER", name: "Tertiary Tier ETF", category: "REGIONAL", feeBps: 60, underlying: "NE/MR/GW/SL/LR/GM/CV equal-weight", lastPriceCentimes: "611000" },
  { symbol: "WASI-UEMOA", name: "UEMOA Zone ETF", category: "REGIONAL", feeBps: 40, underlying: "UEMOA weighted basket", lastPriceCentimes: "835000" },
  { symbol: "WASI-WAMZ", name: "WAMZ Zone ETF", category: "REGIONAL", feeBps: 45, underlying: "WAMZ weighted basket", lastPriceCentimes: "902000" },
  { symbol: "WASI-SHIP", name: "Shipping Index ETF", category: "SECTOR", feeBps: 45, underlying: "shipping_score", lastPriceCentimes: "918000" },
  { symbol: "WASI-TRADE", name: "Trade Index ETF", category: "SECTOR", feeBps: 45, underlying: "trade_score", lastPriceCentimes: "887000" },
  { symbol: "WASI-INFRA", name: "Infrastructure Index ETF", category: "SECTOR", feeBps: 45, underlying: "infrastructure_score", lastPriceCentimes: "854000" },
  { symbol: "WASI-ECON", name: "Economic Index ETF", category: "SECTOR", feeBps: 45, underlying: "economic_score", lastPriceCentimes: "829000" },
  { symbol: "WASI-TRANS", name: "Transport Composite ETF", category: "SECTOR", feeBps: 50, underlying: "transport_composite", lastPriceCentimes: "868000" },
  { symbol: "WASI-COCOA", name: "Cocoa ETF", category: "COMMODITY", feeBps: 50, underlying: "Cocoa price (CI/GH export)", lastPriceCentimes: "1095000" },
  { symbol: "WASI-BRENT", name: "Brent Crude ETF", category: "COMMODITY", feeBps: 50, underlying: "Brent oil price (NG export)", lastPriceCentimes: "734000" },
  { symbol: "WASI-GOLD", name: "Gold ETF", category: "COMMODITY", feeBps: 45, underlying: "Gold price (ML/BF/GN export)", lastPriceCentimes: "2312000" },
  { symbol: "WASI-AGRI", name: "Agriculture Basket ETF", category: "COMMODITY", feeBps: 55, underlying: "Cocoa 50%, Cotton 25%, Coffee 25%", lastPriceCentimes: "1024000" },
  { symbol: "WASI-METALS", name: "Metals Basket ETF", category: "COMMODITY", feeBps: 50, underlying: "Gold 60%, Iron Ore 40%", lastPriceCentimes: "1786000" },
  { symbol: "WASI-CMDTY", name: "All Commodities ETF", category: "COMMODITY", feeBps: 55, underlying: "Equal-weight commodity basket", lastPriceCentimes: "1268000" },
  { symbol: "WASI-EQ", name: "Pan-African Equity ETF", category: "EQUITY", feeBps: 50, underlying: "NGX 50%, BRVM 30%, GSE 20%", lastPriceCentimes: "988000" },
  { symbol: "WASI-NGX", name: "Nigeria Equity ETF", category: "EQUITY", feeBps: 45, underlying: "NGX All-Share Index", lastPriceCentimes: "1004000" },
  { symbol: "WASI-BRVM", name: "BRVM Equity ETF", category: "EQUITY", feeBps: 45, underlying: "BRVM Composite", lastPriceCentimes: "963000" },
  { symbol: "WASI-GSE", name: "Ghana Equity ETF", category: "EQUITY", feeBps: 45, underlying: "GSE Composite", lastPriceCentimes: "845000" },
  { symbol: "WASI-MOM", name: "Momentum ETF", category: "STRATEGY", feeBps: 65, underlying: "Top 5 countries by MoM improvement", lastPriceCentimes: "972000" },
  { symbol: "WASI-VAL", name: "Value ETF", category: "STRATEGY", feeBps: 65, underlying: "Undervalued countries vs market", lastPriceCentimes: "836000" },
  { symbol: "WASI-LVOL", name: "Low Volatility ETF", category: "STRATEGY", feeBps: 55, underlying: "5 least volatile countries", lastPriceCentimes: "801000" },
  { symbol: "WASI-CORR", name: "Corridor ETF", category: "STRATEGY", feeBps: 60, underlying: "Top-rated ECOWAS corridors", lastPriceCentimes: "889000" },
  { symbol: "WASI-RISK", name: "Risk-Adjusted ETF", category: "STRATEGY", feeBps: 60, underlying: "Inverse risk-weighted countries", lastPriceCentimes: "842000" },
  { symbol: "WASI-NG", name: "Nigeria ETF", category: "COUNTRY", feeBps: 40, underlying: "WASI Nigeria country index", lastPriceCentimes: "970000" },
  { symbol: "WASI-CI", name: "Cote d'Ivoire ETF", category: "COUNTRY", feeBps: 40, underlying: "WASI Cote d'Ivoire country index", lastPriceCentimes: "942000" },
  { symbol: "WASI-GH", name: "Ghana ETF", category: "COUNTRY", feeBps: 40, underlying: "WASI Ghana country index", lastPriceCentimes: "901000" },
  { symbol: "WASI-SN", name: "Senegal ETF", category: "COUNTRY", feeBps: 45, underlying: "WASI Senegal country index", lastPriceCentimes: "845000" },
  { symbol: "WASI-BF", name: "Burkina Faso ETF", category: "COUNTRY", feeBps: 55, underlying: "WASI Burkina Faso country index", lastPriceCentimes: "736000" },
  { symbol: "WASI-ML", name: "Mali ETF", category: "COUNTRY", feeBps: 55, underlying: "WASI Mali country index", lastPriceCentimes: "702000" },
  { symbol: "WASI-GN", name: "Guinea ETF", category: "COUNTRY", feeBps: 55, underlying: "WASI Guinea country index", lastPriceCentimes: "718000" },
  { symbol: "WASI-BJ", name: "Benin ETF", category: "COUNTRY", feeBps: 55, underlying: "WASI Benin country index", lastPriceCentimes: "763000" },
  { symbol: "WASI-TG", name: "Togo ETF", category: "COUNTRY", feeBps: 55, underlying: "WASI Togo country index", lastPriceCentimes: "754000" },
  { symbol: "WASI-NE", name: "Niger ETF", category: "COUNTRY", feeBps: 60, underlying: "WASI Niger country index", lastPriceCentimes: "621000" },
  { symbol: "WASI-MR", name: "Mauritania ETF", category: "COUNTRY", feeBps: 60, underlying: "WASI Mauritania country index", lastPriceCentimes: "648000" },
  { symbol: "WASI-GW", name: "Guinea-Bissau ETF", category: "COUNTRY", feeBps: 65, underlying: "WASI Guinea-Bissau country index", lastPriceCentimes: "584000" },
  { symbol: "WASI-SL", name: "Sierra Leone ETF", category: "COUNTRY", feeBps: 60, underlying: "WASI Sierra Leone country index", lastPriceCentimes: "607000" },
  { symbol: "WASI-LR", name: "Liberia ETF", category: "COUNTRY", feeBps: 60, underlying: "WASI Liberia country index", lastPriceCentimes: "615000" },
  { symbol: "WASI-GM", name: "Gambia ETF", category: "COUNTRY", feeBps: 65, underlying: "WASI Gambia country index", lastPriceCentimes: "598000" },
  { symbol: "WASI-CV", name: "Cabo Verde ETF", category: "COUNTRY", feeBps: 65, underlying: "WASI Cabo Verde country index", lastPriceCentimes: "669000" },
];

const DEX_SEED_WALLETS = [
  { userId: "usr-client-demo", xofBalanceCentimes: "4500000000" },
  { userId: "usr-teller-demo", xofBalanceCentimes: "6500000000" },
  { userId: "usr-manager-demo", xofBalanceCentimes: "12000000000" },
];

const DEX_SEED_POSITIONS = [
  { userId: "usr-client-demo", symbol: "WASI-COMP", quantityUnits: "800" },
  { userId: "usr-client-demo", symbol: "WASI-BRVM", quantityUnits: "650" },
  { userId: "usr-client-demo", symbol: "WASI-COCOA", quantityUnits: "240" },
  { userId: "usr-teller-demo", symbol: "WASI-NG", quantityUnits: "500" },
  { userId: "usr-teller-demo", symbol: "WASI-AGRI", quantityUnits: "300" },
  { userId: "usr-manager-demo", symbol: "WASI-COMP", quantityUnits: "1200" },
  { userId: "usr-manager-demo", symbol: "WASI-GOLD", quantityUnits: "75" },
  { userId: "usr-manager-demo", symbol: "WASI-EQ", quantityUnits: "600" },
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

const ensureDexSeedData = () => {
  const now = new Date().toISOString();
  const upsertToken = db.prepare(`
    INSERT INTO etf_tokens (
      symbol, name, category, fee_bps, underlying, is_active,
      last_price_centimes, created_at_utc, updated_at_utc
    ) VALUES (
      @symbol, @name, @category, @feeBps, @underlying, 1,
      @lastPriceCentimes, @createdAtUtc, @updatedAtUtc
    )
    ON CONFLICT(symbol) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      fee_bps = excluded.fee_bps,
      underlying = excluded.underlying,
      is_active = 1,
      updated_at_utc = excluded.updated_at_utc
  `);
  const markAllTokensInactive = db.prepare(`
    UPDATE etf_tokens
    SET is_active = 0, updated_at_utc = @updatedAtUtc
  `);
  const syncTokenCatalog = db.transaction((tokens) => {
    markAllTokensInactive.run({ updatedAtUtc: now });
    for (const token of tokens) {
      upsertToken.run({
        ...token,
        createdAtUtc: now,
        updatedAtUtc: now,
      });
    }
  });
  syncTokenCatalog(DEX_SEED_TOKENS);

  const walletCountRow = db.prepare("SELECT COUNT(*) AS count FROM dex_wallets").get();
  if (Number(walletCountRow?.count ?? 0) === 0) {
    const insertWallet = db.prepare(`
      INSERT INTO dex_wallets (
        user_id, xof_balance_centimes, created_at_utc, updated_at_utc
      ) VALUES (
        @userId, @xofBalanceCentimes, @createdAtUtc, @updatedAtUtc
      )
    `);
    const insertWallets = db.transaction((wallets) => {
      for (const wallet of wallets) {
        insertWallet.run({
          ...wallet,
          createdAtUtc: now,
          updatedAtUtc: now,
        });
      }
    });
    insertWallets(DEX_SEED_WALLETS);
  }

  const insertPositionIfMissing = db.prepare(`
    INSERT OR IGNORE INTO dex_positions (
      user_id, symbol, quantity_units, created_at_utc, updated_at_utc
    ) VALUES (
      @userId, @symbol, @quantityUnits, @createdAtUtc, @updatedAtUtc
    )
  `);
  const insertPositions = db.transaction((positions) => {
    for (const position of positions) {
      insertPositionIfMissing.run({
        ...position,
        createdAtUtc: now,
        updatedAtUtc: now,
      });
    }
  });
  insertPositions(DEX_SEED_POSITIONS);
};

ensureDexSeedData();

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

const parseQuantityUnits = (value) => {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new ApiError(400, "quantityUnits must be a string or integer number.");
  }

  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) {
    throw new ApiError(400, "quantityUnits must be a positive integer.");
  }

  const quantity = BigInt(normalized);
  if (quantity <= 0n || quantity > MAX_SAFE_AMOUNT_CENTIMES) {
    throw new ApiError(400, "quantityUnits is out of supported bounds.");
  }

  return quantity;
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

const listEtfTokens = db.prepare(`
  SELECT symbol, name, category, fee_bps, underlying, last_price_centimes, updated_at_utc
  FROM etf_tokens
  WHERE is_active = 1
  ORDER BY symbol ASC
`);

const getEtfTokenBySymbol = db.prepare(`
  SELECT symbol, name, category, fee_bps, underlying, last_price_centimes, updated_at_utc
  FROM etf_tokens
  WHERE symbol = ? AND is_active = 1
`);

const updateEtfTokenLastPrice = db.prepare(`
  UPDATE etf_tokens
  SET last_price_centimes = @lastPriceCentimes, updated_at_utc = @updatedAtUtc
  WHERE symbol = @symbol
`);

const insertDexWalletIfMissing = db.prepare(`
  INSERT OR IGNORE INTO dex_wallets (
    user_id, xof_balance_centimes, created_at_utc, updated_at_utc
  ) VALUES (
    @userId, '0', @createdAtUtc, @updatedAtUtc
  )
`);

const getDexWalletByUser = db.prepare(`
  SELECT user_id, xof_balance_centimes, updated_at_utc
  FROM dex_wallets
  WHERE user_id = ?
`);

const updateDexWalletBalance = db.prepare(`
  UPDATE dex_wallets
  SET xof_balance_centimes = @xofBalanceCentimes, updated_at_utc = @updatedAtUtc
  WHERE user_id = @userId
`);

const listDexPositionsByUser = db.prepare(`
  SELECT p.user_id, p.symbol, p.quantity_units, p.updated_at_utc
  FROM dex_positions p
  INNER JOIN etf_tokens t ON t.symbol = p.symbol
  WHERE p.user_id = ? AND t.is_active = 1
  ORDER BY p.symbol ASC
`);

const getDexPositionByUserAndSymbol = db.prepare(`
  SELECT user_id, symbol, quantity_units, created_at_utc, updated_at_utc
  FROM dex_positions
  WHERE user_id = ? AND symbol = ?
`);

const upsertDexPosition = db.prepare(`
  INSERT INTO dex_positions (
    user_id, symbol, quantity_units, created_at_utc, updated_at_utc
  ) VALUES (
    @userId, @symbol, @quantityUnits, @createdAtUtc, @updatedAtUtc
  )
  ON CONFLICT(user_id, symbol) DO UPDATE SET
    quantity_units = excluded.quantity_units,
    updated_at_utc = excluded.updated_at_utc
`);

const insertDexOrder = db.prepare(`
  INSERT INTO dex_orders (
    id, user_id, symbol, side, limit_price_centimes, quantity_units,
    remaining_quantity_units, status, created_at_utc, updated_at_utc
  ) VALUES (
    @id, @userId, @symbol, @side, @limitPriceCentimes, @quantityUnits,
    @remainingQuantityUnits, @status, @createdAtUtc, @updatedAtUtc
  )
`);

const getDexOrderById = db.prepare(`
  SELECT *
  FROM dex_orders
  WHERE id = ?
`);

const updateDexOrderState = db.prepare(`
  UPDATE dex_orders
  SET remaining_quantity_units = @remainingQuantityUnits,
      status = @status,
      updated_at_utc = @updatedAtUtc
  WHERE id = @id
`);

const listDexUserOpenOrders = db.prepare(`
  SELECT *
  FROM dex_orders
  WHERE user_id = ? AND status IN ('OPEN','PARTIAL')
  ORDER BY created_at_utc DESC
`);

const listDexOpenOrdersForBook = db.prepare(`
  SELECT symbol, side, limit_price_centimes, remaining_quantity_units, created_at_utc
  FROM dex_orders
  WHERE symbol = ? AND side = ? AND status IN ('OPEN','PARTIAL')
  ORDER BY
    CASE
      WHEN ? = 'BUY' THEN CAST(limit_price_centimes AS INTEGER) * -1
      ELSE CAST(limit_price_centimes AS INTEGER)
    END ASC,
    created_at_utc ASC
`);

const listDexMatchingSellOrders = db.prepare(`
  SELECT *
  FROM dex_orders
  WHERE symbol = ?
    AND side = 'SELL'
    AND status IN ('OPEN','PARTIAL')
    AND CAST(limit_price_centimes AS INTEGER) <= CAST(? AS INTEGER)
  ORDER BY CAST(limit_price_centimes AS INTEGER) ASC, created_at_utc ASC
`);

const listDexMatchingBuyOrders = db.prepare(`
  SELECT *
  FROM dex_orders
  WHERE symbol = ?
    AND side = 'BUY'
    AND status IN ('OPEN','PARTIAL')
    AND CAST(limit_price_centimes AS INTEGER) >= CAST(? AS INTEGER)
  ORDER BY CAST(limit_price_centimes AS INTEGER) DESC, created_at_utc ASC
`);

const listDexOpenBuyRowsByUser = db.prepare(`
  SELECT remaining_quantity_units, limit_price_centimes
  FROM dex_orders
  WHERE user_id = ? AND side = 'BUY' AND status IN ('OPEN','PARTIAL')
`);

const listDexOpenSellRowsByUserAndSymbol = db.prepare(`
  SELECT remaining_quantity_units
  FROM dex_orders
  WHERE user_id = ? AND symbol = ? AND side = 'SELL' AND status IN ('OPEN','PARTIAL')
`);

const insertDexTrade = db.prepare(`
  INSERT INTO dex_trades (
    id, symbol, buy_order_id, sell_order_id, buyer_user_id, seller_user_id,
    price_centimes, quantity_units, notional_centimes, created_at_utc
  ) VALUES (
    @id, @symbol, @buyOrderId, @sellOrderId, @buyerUserId, @sellerUserId,
    @priceCentimes, @quantityUnits, @notionalCentimes, @createdAtUtc
  )
`);

const listDexRecentTrades = db.prepare(`
  SELECT *
  FROM dex_trades
  WHERE symbol = ?
  ORDER BY created_at_utc DESC
  LIMIT ?
`);

const listDexRecentTradesByUser = db.prepare(`
  SELECT *
  FROM dex_trades
  WHERE buyer_user_id = ? OR seller_user_id = ?
  ORDER BY created_at_utc DESC
  LIMIT ?
`);

const listDexRecentTradesGlobal = db.prepare(`
  SELECT *
  FROM dex_trades
  ORDER BY created_at_utc DESC
  LIMIT ?
`);

const serializeDexOrder = (row) => ({
  id: row.id,
  userId: row.user_id,
  symbol: row.symbol,
  side: row.side,
  limitPriceCentimes: row.limit_price_centimes,
  quantityUnits: row.quantity_units,
  remainingQuantityUnits: row.remaining_quantity_units,
  status: row.status,
  createdAtUtc: row.created_at_utc,
  updatedAtUtc: row.updated_at_utc,
});

const serializeDexTrade = (row) => ({
  id: row.id,
  symbol: row.symbol,
  buyOrderId: row.buy_order_id,
  sellOrderId: row.sell_order_id,
  buyerUserId: row.buyer_user_id,
  sellerUserId: row.seller_user_id,
  priceCentimes: row.price_centimes,
  quantityUnits: row.quantity_units,
  notionalCentimes: row.notional_centimes,
  createdAtUtc: row.created_at_utc,
});

const ensureDexWallet = (userId, timestampUtc = new Date().toISOString()) => {
  insertDexWalletIfMissing.run({
    userId,
    createdAtUtc: timestampUtc,
    updatedAtUtc: timestampUtc,
  });
  const wallet = getDexWalletByUser.get(userId);
  if (!wallet) {
    throw new ApiError(500, "DEX wallet not available.");
  }
  return wallet;
};

const getReservedBuyNotionalCentimes = (userId) =>
  listDexOpenBuyRowsByUser
    .all(userId)
    .reduce(
      (sum, row) =>
        sum +
        BigInt(row.remaining_quantity_units) * BigInt(row.limit_price_centimes),
      0n
    );

const getReservedSellUnits = (userId, symbol) =>
  listDexOpenSellRowsByUserAndSymbol
    .all(userId, symbol)
    .reduce((sum, row) => sum + BigInt(row.remaining_quantity_units), 0n);

const getAvailableDexBalanceCentimes = (userId) => {
  const wallet = ensureDexWallet(userId);
  const total = BigInt(wallet.xof_balance_centimes);
  const reserved = getReservedBuyNotionalCentimes(userId);
  const available = total - reserved;
  return available > 0n ? available : 0n;
};

const getAvailableDexUnits = (userId, symbol) => {
  const position = getDexPositionByUserAndSymbol.get(userId, symbol);
  const total = position ? BigInt(position.quantity_units) : 0n;
  const reserved = getReservedSellUnits(userId, symbol);
  const available = total - reserved;
  return available > 0n ? available : 0n;
};

const applyDexWalletDelta = (userId, deltaCentimes, timestampUtc) => {
  const wallet = ensureDexWallet(userId, timestampUtc);
  const next = BigInt(wallet.xof_balance_centimes) + deltaCentimes;
  if (next < 0n) {
    throw new ApiError(400, "Insufficient wallet balance for settlement.");
  }
  if (next > MAX_SAFE_AMOUNT_CENTIMES) {
    throw new ApiError(400, "Wallet balance exceeds supported bounds.");
  }
  updateDexWalletBalance.run({
    userId,
    xofBalanceCentimes: next.toString(),
    updatedAtUtc: timestampUtc,
  });
};

const applyDexPositionDelta = (userId, symbol, deltaUnits, timestampUtc) => {
  const current = getDexPositionByUserAndSymbol.get(userId, symbol);
  const currentUnits = current ? BigInt(current.quantity_units) : 0n;
  const next = currentUnits + deltaUnits;
  if (next < 0n) {
    throw new ApiError(400, `Insufficient ${symbol} units for settlement.`);
  }
  upsertDexPosition.run({
    userId,
    symbol,
    quantityUnits: next.toString(),
    createdAtUtc: current?.created_at_utc ?? timestampUtc,
    updatedAtUtc: timestampUtc,
  });
};

const getDexBestBidAsk = (symbol) => {
  const bid = db
    .prepare(
      `SELECT limit_price_centimes FROM dex_orders
       WHERE symbol = ? AND side = 'BUY' AND status IN ('OPEN','PARTIAL')
       ORDER BY CAST(limit_price_centimes AS INTEGER) DESC, created_at_utc ASC
       LIMIT 1`
    )
    .get(symbol);
  const ask = db
    .prepare(
      `SELECT limit_price_centimes FROM dex_orders
       WHERE symbol = ? AND side = 'SELL' AND status IN ('OPEN','PARTIAL')
       ORDER BY CAST(limit_price_centimes AS INTEGER) ASC, created_at_utc ASC
       LIMIT 1`
    )
    .get(symbol);
  return {
    bestBidCentimes: bid?.limit_price_centimes ?? null,
    bestAskCentimes: ask?.limit_price_centimes ?? null,
  };
};

const getDexMarketStats = (symbol) => {
  const last24h = Date.now() - 24 * 60 * 60 * 1000;
  const trades = listDexRecentTrades.all(symbol, 500);
  let volumeUnits = 0n;
  let volumeNotionalCentimes = 0n;
  for (const trade of trades) {
    if (Date.parse(trade.created_at_utc) < last24h) {
      continue;
    }
    volumeUnits += BigInt(trade.quantity_units);
    volumeNotionalCentimes += BigInt(trade.notional_centimes);
  }
  return {
    volume24hUnits: volumeUnits.toString(),
    turnover24hCentimes: volumeNotionalCentimes.toString(),
  };
};

const getDexMarkets = () =>
  listEtfTokens.all().map((token) => {
    const spread = getDexBestBidAsk(token.symbol);
    const stats = getDexMarketStats(token.symbol);
    return {
      symbol: token.symbol,
      name: token.name,
      category: token.category,
      feeBps: token.fee_bps,
      underlying: token.underlying,
      lastPriceCentimes: token.last_price_centimes,
      updatedAtUtc: token.updated_at_utc,
      ...spread,
      ...stats,
    };
  });

const getDexOrderBook = (symbol, depth = 10) => {
  const safeDepth = Number.isFinite(depth) ? Math.min(Math.max(depth, 1), 50) : 10;
  const aggregateSide = (side) => {
    const rows = listDexOpenOrdersForBook.all(symbol, side, side);
    const grouped = new Map();
    for (const row of rows) {
      const key = row.limit_price_centimes;
      const qty = BigInt(row.remaining_quantity_units);
      grouped.set(key, (grouped.get(key) ?? 0n) + qty);
    }
    const entries = [...grouped.entries()].map(([priceCentimes, quantityUnits]) => ({
      priceCentimes,
      quantityUnits: quantityUnits.toString(),
    }));
    entries.sort((a, b) => {
      const left = BigInt(a.priceCentimes);
      const right = BigInt(b.priceCentimes);
      if (left === right) return 0;
      if (side === DEX_SIDE_BUY) {
        return left > right ? -1 : 1;
      }
      return left < right ? -1 : 1;
    });
    return entries.slice(0, safeDepth);
  };

  return {
    symbol,
    bids: aggregateSide(DEX_SIDE_BUY),
    asks: aggregateSide(DEX_SIDE_SELL),
  };
};

const getDexPortfolio = (userId) => {
  const wallet = ensureDexWallet(userId);
  const positions = listDexPositionsByUser
    .all(userId)
    .map((row) => ({
      symbol: row.symbol,
      quantityUnits: row.quantity_units,
      updatedAtUtc: row.updated_at_utc,
      markPriceCentimes: getEtfTokenBySymbol.get(row.symbol)?.last_price_centimes ?? null,
    }))
    .filter((position) => BigInt(position.quantityUnits) > 0n);

  const openOrders = listDexUserOpenOrders.all(userId).map(serializeDexOrder);
  const recentTrades = listDexRecentTradesByUser
    .all(userId, userId, 20)
    .map(serializeDexTrade);

  return {
    wallet: {
      userId: wallet.user_id,
      xofBalanceCentimes: wallet.xof_balance_centimes,
      availableXofCentimes: getAvailableDexBalanceCentimes(userId).toString(),
    },
    positions,
    openOrders,
    recentTrades,
  };
};

const executeDexOrderPlacement = ({ userId, symbol, side, quantityUnits, limitPriceCentimes }) =>
  db.transaction(() => {
    const token = getEtfTokenBySymbol.get(symbol);
    if (!token) {
      throw new ApiError(404, `Unknown ETF symbol: ${symbol}`);
    }

    const requiredNotional = quantityUnits * limitPriceCentimes;
    if (side === DEX_SIDE_BUY) {
      const available = getAvailableDexBalanceCentimes(userId);
      if (available < requiredNotional) {
        throw new ApiError(400, "Insufficient available XOF balance for this BUY order.");
      }
    } else {
      const availableUnits = getAvailableDexUnits(userId, symbol);
      if (availableUnits < quantityUnits) {
        throw new ApiError(400, "Insufficient available ETF units for this SELL order.");
      }
    }

    const now = new Date().toISOString();
    const orderId = randomUUID();
    insertDexOrder.run({
      id: orderId,
      userId,
      symbol,
      side,
      limitPriceCentimes: limitPriceCentimes.toString(),
      quantityUnits: quantityUnits.toString(),
      remainingQuantityUnits: quantityUnits.toString(),
      status: DEX_STATUS_OPEN,
      createdAtUtc: now,
      updatedAtUtc: now,
    });

    const matches =
      side === DEX_SIDE_BUY
        ? listDexMatchingSellOrders.all(symbol, limitPriceCentimes.toString())
        : listDexMatchingBuyOrders.all(symbol, limitPriceCentimes.toString());

    let remaining = quantityUnits;
    const executedTrades = [];

    for (const maker of matches) {
      if (remaining <= 0n) break;
      if (maker.user_id === userId) continue;

      const makerRemaining = BigInt(maker.remaining_quantity_units);
      if (makerRemaining <= 0n) continue;

      const tradedQuantity = makerRemaining < remaining ? makerRemaining : remaining;
      const tradePrice = BigInt(maker.limit_price_centimes);
      const notional = tradedQuantity * tradePrice;
      const tradeTimestamp = new Date().toISOString();

      const buyerUserId = side === DEX_SIDE_BUY ? userId : maker.user_id;
      const sellerUserId = side === DEX_SIDE_SELL ? userId : maker.user_id;
      const buyOrderId = side === DEX_SIDE_BUY ? orderId : maker.id;
      const sellOrderId = side === DEX_SIDE_SELL ? orderId : maker.id;

      applyDexWalletDelta(buyerUserId, -notional, tradeTimestamp);
      applyDexWalletDelta(sellerUserId, notional, tradeTimestamp);
      applyDexPositionDelta(buyerUserId, symbol, tradedQuantity, tradeTimestamp);
      applyDexPositionDelta(sellerUserId, symbol, -tradedQuantity, tradeTimestamp);

      const makerNextRemaining = makerRemaining - tradedQuantity;
      updateDexOrderState.run({
        id: maker.id,
        remainingQuantityUnits: makerNextRemaining.toString(),
        status: makerNextRemaining === 0n ? DEX_STATUS_FILLED : DEX_STATUS_PARTIAL,
        updatedAtUtc: tradeTimestamp,
      });

      insertDexTrade.run({
        id: randomUUID(),
        symbol,
        buyOrderId,
        sellOrderId,
        buyerUserId,
        sellerUserId,
        priceCentimes: tradePrice.toString(),
        quantityUnits: tradedQuantity.toString(),
        notionalCentimes: notional.toString(),
        createdAtUtc: tradeTimestamp,
      });

      updateEtfTokenLastPrice.run({
        symbol,
        lastPriceCentimes: tradePrice.toString(),
        updatedAtUtc: tradeTimestamp,
      });

      executedTrades.push({
        symbol,
        buyOrderId,
        sellOrderId,
        buyerUserId,
        sellerUserId,
        priceCentimes: tradePrice.toString(),
        quantityUnits: tradedQuantity.toString(),
        notionalCentimes: notional.toString(),
        createdAtUtc: tradeTimestamp,
      });

      remaining -= tradedQuantity;
    }

    const finalStatus =
      remaining === 0n
        ? DEX_STATUS_FILLED
        : remaining === quantityUnits
          ? DEX_STATUS_OPEN
          : DEX_STATUS_PARTIAL;

    updateDexOrderState.run({
      id: orderId,
      remainingQuantityUnits: remaining.toString(),
      status: finalStatus,
      updatedAtUtc: new Date().toISOString(),
    });

    return {
      order: serializeDexOrder(getDexOrderById.get(orderId)),
      trades: executedTrades,
    };
  })();

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
    dex: "wasi-etf-orderbook-enabled",
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

app.get("/api/v1/dex/markets", (_req, res, next) => {
  try {
    const markets = getDexMarkets();
    success(res, {
      markets,
      recentTrades: listDexRecentTradesGlobal.all(50).map(serializeDexTrade),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/v1/dex/orderbook/:symbol", (req, res, next) => {
  try {
    const symbol = String(req.params.symbol || "").trim().toUpperCase();
    if (!symbol) {
      throw new ApiError(400, "symbol is required.");
    }
    if (!getEtfTokenBySymbol.get(symbol)) {
      throw new ApiError(404, `Unknown ETF symbol: ${symbol}`);
    }

    const depth = Number(req.query.depth ?? 12);
    success(res, {
      orderBook: getDexOrderBook(symbol, depth),
      recentTrades: listDexRecentTrades.all(symbol, 30).map(serializeDexTrade),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/v1/dex/portfolio", requireAuth, (req, res, next) => {
  try {
    success(res, {
      portfolio: getDexPortfolio(req.authUser.sub),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/v1/dex/orders", requireAuth, (req, res, next) => {
  try {
    const rawSymbol = String(req.body?.symbol || "").trim().toUpperCase();
    const rawSide = String(req.body?.side || "").trim().toUpperCase();
    if (!rawSymbol) {
      throw new ApiError(400, "symbol is required.");
    }
    if (![DEX_SIDE_BUY, DEX_SIDE_SELL].includes(rawSide)) {
      throw new ApiError(400, "side must be BUY or SELL.");
    }
    if (!getEtfTokenBySymbol.get(rawSymbol)) {
      throw new ApiError(404, `Unknown ETF symbol: ${rawSymbol}`);
    }

    const quantityUnits = parseQuantityUnits(req.body?.quantityUnits);
    const limitPriceCentimes = parseAmountCentimes(req.body?.limitPriceCentimes);
    const notional = quantityUnits * limitPriceCentimes;
    if (notional > MAX_SAFE_AMOUNT_CENTIMES) {
      throw new ApiError(400, "Order notional exceeds supported bounds.");
    }

    const result = executeIdempotentMutation({
      req,
      mutate: () => {
        const placement = executeDexOrderPlacement({
          userId: req.authUser.sub,
          symbol: rawSymbol,
          side: rawSide,
          quantityUnits,
          limitPriceCentimes,
        });

        return {
          order: placement.order,
          trades: placement.trades,
          orderBook: getDexOrderBook(rawSymbol, 12),
          market: getDexMarkets().find((market) => market.symbol === rawSymbol) ?? null,
          portfolio: getDexPortfolio(req.authUser.sub),
        };
      },
    });

    if (result.replayed) {
      res.set("X-Idempotency-Replayed", "true");
    }

    writeAuditLog({
      req,
      action: "DEX_ORDER_PLACE",
      resourceType: "DEX_ORDER",
      resourceId: result.payload.order?.id ?? null,
      status: AUDIT_SUCCESS,
      detail: {
        symbol: rawSymbol,
        side: rawSide,
        quantityUnits: quantityUnits.toString(),
        limitPriceCentimes: limitPriceCentimes.toString(),
        idempotencyKey: result.idempotencyKey,
        replayed: result.replayed,
      },
    });

    success(res, result.payload, result.statusCode);
  } catch (error) {
    writeAuditLog({
      req,
      action: "DEX_ORDER_PLACE",
      resourceType: "DEX_ORDER",
      resourceId: null,
      status: AUDIT_FAILURE,
      detail: {
        reason: error.message,
        body: req.body ?? null,
      },
    });
    next(error);
  }
});

app.post("/api/v1/dex/orders/:orderId/cancel", requireAuth, (req, res, next) => {
  try {
    const orderId = String(req.params.orderId || "").trim();
    if (!orderId) {
      throw new ApiError(400, "orderId is required.");
    }

    const result = executeIdempotentMutation({
      req,
      mutate: () => {
        const order = getDexOrderById.get(orderId);
        if (!order) {
          throw new ApiError(404, "Order not found.");
        }
        const isOwner = order.user_id === req.authUser.sub;
        const isManager = req.authUser.role === ROLE_MANAGER;
        if (!isOwner && !isManager) {
          throw new ApiError(403, "You can only cancel your own orders.");
        }
        if (![DEX_STATUS_OPEN, DEX_STATUS_PARTIAL].includes(order.status)) {
          throw new ApiError(400, "Only OPEN or PARTIAL orders can be cancelled.");
        }

        updateDexOrderState.run({
          id: orderId,
          remainingQuantityUnits: order.remaining_quantity_units,
          status: DEX_STATUS_CANCELLED,
          updatedAtUtc: new Date().toISOString(),
        });

        const refreshed = serializeDexOrder(getDexOrderById.get(orderId));
        return {
          order: refreshed,
          orderBook: getDexOrderBook(order.symbol, 12),
          portfolio: getDexPortfolio(req.authUser.sub),
        };
      },
    });

    if (result.replayed) {
      res.set("X-Idempotency-Replayed", "true");
    }

    writeAuditLog({
      req,
      action: "DEX_ORDER_CANCEL",
      resourceType: "DEX_ORDER",
      resourceId: orderId,
      status: AUDIT_SUCCESS,
      detail: {
        idempotencyKey: result.idempotencyKey,
        replayed: result.replayed,
      },
    });

    success(res, result.payload, result.statusCode);
  } catch (error) {
    writeAuditLog({
      req,
      action: "DEX_ORDER_CANCEL",
      resourceType: "DEX_ORDER",
      resourceId: req.params?.orderId ?? null,
      status: AUDIT_FAILURE,
      detail: {
        reason: error.message,
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
