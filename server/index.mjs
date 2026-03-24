import cors from "cors";
import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";
import {
  SYSCOHADA_CLASS_LABELS,
  SYSCOHADA_SEED_ACCOUNTS,
} from "./data/syscohadaSeed.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadLocalEnv = () => {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
};

loadLocalEnv();

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const parseCsvValues = (value) =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const parseCentimeLimit = (value, fallback) => {
  const normalized = String(value ?? fallback).trim();
  if (!/^\d+$/.test(normalized)) return BigInt(fallback);
  const parsed = BigInt(normalized);
  return parsed > 0n ? parsed : BigInt(fallback);
};

const PORT = Number(process.env.BANKING_API_PORT ?? process.env.PORT ?? 8010);
const MAX_SAFE_AMOUNT_CENTIMES = BigInt(Number.MAX_SAFE_INTEGER);
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
const IS_PRODUCTION = String(process.env.NODE_ENV || "").toLowerCase() === "production";
const JWT_SECRET_FROM_ENV = String(process.env.BANKING_JWT_SECRET || "").trim();
if (IS_PRODUCTION && !JWT_SECRET_FROM_ENV) {
  throw new Error("BANKING_JWT_SECRET must be configured in production.");
}
const JWT_SECRET = JWT_SECRET_FROM_ENV || randomBytes(32).toString("hex");
const JWT_EXPIRES_IN = process.env.BANKING_JWT_EXPIRES_IN ?? "12h";
const PASSWORD_PEPPER = String(process.env.BANKING_PASSWORD_PEPPER || "");
if (IS_PRODUCTION && !PASSWORD_PEPPER) {
  console.warn("WARNING: BANKING_PASSWORD_PEPPER is not set. Set it for stronger password hashing.");
}
const AUTH_RATE_LIMIT_WINDOW_MS = Number(
  process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? 30 * 60 * 1000
);
const AUTH_RATE_LIMIT_MAX_ATTEMPTS = Number(
  process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS ?? 5
);
const PASSWORD_HASH_KEY_LENGTH = 64;
const PASSWORD_HASH_VERSION = "scrypt-v1";
const CLIENT_TRANSFER_MAX_CENTIMES = parseCentimeLimit(
  process.env.BANKING_CLIENT_TRANSFER_MAX_CENTIMES,
  "50000000"
);
const BANKING_APPROVAL_THRESHOLD_CENTIMES = parseCentimeLimit(
  process.env.BANKING_APPROVAL_THRESHOLD_CENTIMES,
  "100000000"
);
const LEGACY_DEFAULT_DEV_PASSWORD_SECRET = "";
const LEGACY_PASSWORD_SECRETS = [
  process.env.LEGACY_PASSWORD_SECRET,
  process.env.BANKING_JWT_SECRET,
  LEGACY_DEFAULT_DEV_PASSWORD_SECRET,
]
  .map((value) => String(value || "").trim())
  .filter(Boolean)
  .filter((value, index, array) => array.indexOf(value) === index);
const CORS_ALLOWED_ORIGINS = new Set(parseCsvValues(process.env.CORS_ALLOWED_ORIGINS));
const DB_PATH =
  process.env.BANKING_DB_PATH ??
  path.join(__dirname, "data", "wasi_banking.sqlite");
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_KEY =
  process.env.ANTHROPIC_API_KEY ??
  process.env.ANTROPIC_API_KEY ??
  "";
const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-20241022";
const DEFAULT_CHAT_MAX_TOKENS = 1024;
const MAX_CHAT_MAX_TOKENS = 4096;
const MAX_CHAT_MESSAGES = 20;
const OLLAMA_API_URL =
  process.env.OLLAMA_API_URL ?? "http://127.0.0.1:11434/api/chat";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.1:8b";
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS ?? 20000);
const RAW_LLM_PROVIDER = String(process.env.LLM_PROVIDER ?? "auto")
  .trim()
  .toLowerCase();
const LLM_PROVIDER = ["auto", "anthropic", "ollama", "snapshot"].includes(
  RAW_LLM_PROVIDER
)
  ? RAW_LLM_PROVIDER
  : "auto";

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
const APPROVAL_STATUS_PENDING = "PENDING";
const APPROVAL_STATUS_APPROVED = "APPROVED";
const APPROVAL_STATUS_REJECTED = "REJECTED";

if (!JWT_SECRET_FROM_ENV && !IS_PRODUCTION) {
  // eslint-disable-next-line no-console
  console.warn(
    "BANKING_JWT_SECRET not set. Using an ephemeral development secret for this process."
  );
}

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

  CREATE TABLE IF NOT EXISTS banking_operation_approvals (
    id TEXT PRIMARY KEY,
    operation_type TEXT NOT NULL CHECK (operation_type IN ('DEPOSIT','WITHDRAW','TRANSFER')),
    status TEXT NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    initiated_by_user_id TEXT NOT NULL,
    initiated_by_username TEXT,
    initiated_by_role TEXT,
    approved_by_user_id TEXT,
    approved_by_username TEXT,
    account_id TEXT,
    from_account_id TEXT,
    to_account_id TEXT,
    amount_centimes TEXT NOT NULL,
    description TEXT NOT NULL,
    request_body_json TEXT NOT NULL,
    decision_note TEXT,
    created_at_utc TEXT NOT NULL,
    decided_at_utc TEXT,
    updated_at_utc TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_banking_approvals_status_created
  ON banking_operation_approvals(status, created_at_utc DESC);

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

  CREATE TABLE IF NOT EXISTS platform_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('CLIENT','TELLER','MANAGER')),
    tier TEXT NOT NULL DEFAULT 'free',
    x402_balance REAL NOT NULL DEFAULT 10,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_platform_users_role_active
  ON platform_users(role, is_active, created_at_utc DESC);

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

  CREATE TABLE IF NOT EXISTS syscohada_accounts (
    code TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    class_number INTEGER NOT NULL CHECK (class_number BETWEEN 1 AND 8),
    category TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('DEBIT','CREDIT','BOTH')),
    normal_side TEXT NOT NULL DEFAULT 'DEBIT' CHECK (normal_side IN ('DEBIT','CREDIT','BOTH')),
    statement_section TEXT NOT NULL DEFAULT 'OTHER_ASSET',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_syscohada_accounts_class
  ON syscohada_accounts(class_number, code);

  CREATE TABLE IF NOT EXISTS accounting_journal_entries (
    id TEXT PRIMARY KEY,
    reference TEXT NOT NULL UNIQUE,
    journal_code TEXT NOT NULL DEFAULT 'OD',
    module_source TEXT NOT NULL,
    description TEXT NOT NULL,
    entry_date_utc TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('POSTED','DRAFT')),
    total_debit_centimes TEXT NOT NULL,
    total_credit_centimes TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_accounting_entries_date
  ON accounting_journal_entries(entry_date_utc DESC, created_at_utc DESC);

  CREATE TABLE IF NOT EXISTS accounting_journal_lines (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    account_code TEXT NOT NULL,
    line_label TEXT NOT NULL,
    debit_centimes TEXT NOT NULL,
    credit_centimes TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    FOREIGN KEY (entry_id) REFERENCES accounting_journal_entries(id),
    FOREIGN KEY (account_code) REFERENCES syscohada_accounts(code)
  );

  CREATE INDEX IF NOT EXISTS idx_accounting_lines_entry
  ON accounting_journal_lines(entry_id);

  CREATE INDEX IF NOT EXISTS idx_accounting_lines_account
  ON accounting_journal_lines(account_code, created_at_utc DESC);
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
const ensureComptaSchemaExtensions = () => {
  const accountColumns = db
    .prepare("PRAGMA table_info(syscohada_accounts)")
    .all()
    .map((column) => column.name);
  if (!accountColumns.includes("normal_side")) {
    db.exec(
      "ALTER TABLE syscohada_accounts ADD COLUMN normal_side TEXT NOT NULL DEFAULT 'DEBIT'"
    );
  }
  if (!accountColumns.includes("statement_section")) {
    db.exec(
      "ALTER TABLE syscohada_accounts ADD COLUMN statement_section TEXT NOT NULL DEFAULT 'OTHER_ASSET'"
    );
  }

  const journalColumns = db
    .prepare("PRAGMA table_info(accounting_journal_entries)")
    .all()
    .map((column) => column.name);
  if (!journalColumns.includes("journal_code")) {
    db.exec(
      "ALTER TABLE accounting_journal_entries ADD COLUMN journal_code TEXT NOT NULL DEFAULT 'OD'"
    );
  }
};

ensureComptaSchemaExtensions();

// ── 2FA / TOTP schema ────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS user_totp_secrets (
    user_id TEXT PRIMARY KEY,
    secret TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    verified_at_utc TEXT,
    created_at_utc TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES platform_users(id)
  );
`);
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_etf_tokens_category_active
  ON etf_tokens(category, is_active, symbol);
`);

const ACCOUNT_ID_MAIN = "fd43f43e-d0f7-4be3-9769-34bd4eebbc0b";
const ACCOUNT_ID_SAVINGS = "05729563-6d54-4742-9d16-d2f29e5fd2e9";
const ACCOUNT_ID_BUSINESS = "7f3ec2be-3f2d-4994-9fdc-9603d2f12950";

const DEMO_USER_DEFINITIONS = [
  {
    id: "usr-client-demo",
    username: "client_demo",
    passwordEnv: "WASI_DEMO_CLIENT_PASSWORD",
    displayName: "Client Demo",
    role: ROLE_CLIENT,
    accountIds: [ACCOUNT_ID_MAIN, ACCOUNT_ID_SAVINGS],
  },
  {
    id: "usr-teller-demo",
    username: "teller_demo",
    passwordEnv: "WASI_DEMO_TELLER_PASSWORD",
    displayName: "Teller Demo",
    role: ROLE_TELLER,
    accountIds: [ACCOUNT_ID_MAIN, ACCOUNT_ID_SAVINGS, ACCOUNT_ID_BUSINESS],
  },
  {
    id: "usr-manager-demo",
    username: "manager_demo",
    passwordEnv: "WASI_DEMO_MANAGER_PASSWORD",
    displayName: "Manager Demo",
    role: ROLE_MANAGER,
    accountIds: [ACCOUNT_ID_MAIN, ACCOUNT_ID_SAVINGS, ACCOUNT_ID_BUSINESS],
  },
];

const DEMO_MODE_REQUESTED = toBool(process.env.WASI_ALLOW_DEMO_USERS, false);
const DEMO_USERS = DEMO_USER_DEFINITIONS.map((user) => {
  const password = String(process.env[user.passwordEnv] || "").trim();
  if (!password) return null;
  return {
    ...user,
    password,
  };
}).filter(Boolean);

const ALLOW_DEMO_CREDENTIALS =
  DEMO_MODE_REQUESTED && DEMO_USERS.length === DEMO_USER_DEFINITIONS.length;

if (DEMO_MODE_REQUESTED && !ALLOW_DEMO_CREDENTIALS) {
  // eslint-disable-next-line no-console
  console.warn(
    "WASI_ALLOW_DEMO_USERS=true but one or more demo passwords are missing. Demo access has been disabled."
  );
}

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
  { symbol: "BRVM-C", name: "BRVM Composite Token", category: "INDEX", feeBps: 35, underlying: "BRVM Composite benchmark", lastPriceCentimes: "1016073" },
  { symbol: "GSE-CI", name: "GSE Composite Token", category: "INDEX", feeBps: 35, underlying: "GSE Composite benchmark", lastPriceCentimes: "341255" },
  { symbol: "NGX-ASI", name: "NGX All-Share Token", category: "INDEX", feeBps: 35, underlying: "NGX All-Share benchmark", lastPriceCentimes: "9843210" },
  { symbol: "UMOA-TITRES", name: "UMOA Titres Composite Token", category: "BOND", feeBps: 30, underlying: "UMOA sovereign debt composite", lastPriceCentimes: "15342" },
  { symbol: "WA-BOND-10Y", name: "West Africa Sovereign Bond 10Y Token", category: "BOND", feeBps: 30, underlying: "Regional sovereign bond basket (10Y)", lastPriceCentimes: "9786" },
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

const ACCOUNTING_SEED_ENTRIES = [
  {
    reference: "CAP-2026-001",
    journalCode: "BQ",
    moduleSource: "BANKING",
    description: "Apport initial en capital pour la plateforme WASI",
    entryDateUtc: "2026-01-03T09:00:00.000Z",
    lines: [
      { accountCode: "521000", lineLabel: "Apport en banque", debitCentimes: "20000000000", creditCentimes: "0" },
      { accountCode: "101000", lineLabel: "Capital social", debitCentimes: "0", creditCentimes: "20000000000" },
    ],
  },
  {
    reference: "WASI-2026-001",
    journalCode: "VT",
    moduleSource: "WASI",
    description: "Facturation abonnement intelligence economique",
    entryDateUtc: "2026-01-10T11:00:00.000Z",
    lines: [
      { accountCode: "521000", lineLabel: "Encaissement client", debitCentimes: "2450000000", creditCentimes: "0" },
      { accountCode: "707100", lineLabel: "Revenus services data", debitCentimes: "0", creditCentimes: "2076271186" },
      { accountCode: "443100", lineLabel: "TVA sur vente", debitCentimes: "0", creditCentimes: "373728814" },
    ],
  },
  {
    reference: "AFT-2026-001",
    journalCode: "VT",
    moduleSource: "AFRITRADE",
    description: "Commissions de trading clients",
    entryDateUtc: "2026-01-14T14:00:00.000Z",
    lines: [
      { accountCode: "521000", lineLabel: "Encaissement commissions", debitCentimes: "1850000000", creditCentimes: "0" },
      { accountCode: "706100", lineLabel: "Commissions bancaires et trading", debitCentimes: "0", creditCentimes: "1567796610" },
      { accountCode: "443100", lineLabel: "TVA sur commissions", debitCentimes: "0", creditCentimes: "282203390" },
    ],
  },
  {
    reference: "DEX-2026-001",
    journalCode: "VT",
    moduleSource: "DEX",
    description: "Frais ETF DEX encaisses",
    entryDateUtc: "2026-01-17T16:30:00.000Z",
    lines: [
      { accountCode: "521000", lineLabel: "Encaissement DEX", debitCentimes: "650000000", creditCentimes: "0" },
      { accountCode: "706200", lineLabel: "Frais DEX", debitCentimes: "0", creditCentimes: "550847457" },
      { accountCode: "443100", lineLabel: "TVA sur frais DEX", debitCentimes: "0", creditCentimes: "99152543" },
    ],
  },
  {
    reference: "CLD-2026-001",
    journalCode: "AC",
    moduleSource: "WASI",
    description: "Facture fournisseur infrastructure cloud",
    entryDateUtc: "2026-01-20T09:15:00.000Z",
    lines: [
      { accountCode: "601100", lineLabel: "Services cloud", debitCentimes: "420000000", creditCentimes: "0" },
      { accountCode: "445660", lineLabel: "TVA deductible", debitCentimes: "75600000", creditCentimes: "0" },
      { accountCode: "401100", lineLabel: "Dette fournisseur", debitCentimes: "0", creditCentimes: "495600000" },
    ],
  },
  {
    reference: "PAY-2026-001",
    journalCode: "BQ",
    moduleSource: "BANKING",
    description: "Reglement facture cloud",
    entryDateUtc: "2026-01-25T13:45:00.000Z",
    lines: [
      { accountCode: "401100", lineLabel: "Paiement fournisseur", debitCentimes: "495600000", creditCentimes: "0" },
      { accountCode: "521000", lineLabel: "Sortie bancaire", debitCentimes: "0", creditCentimes: "495600000" },
    ],
  },
  {
    reference: "SAL-2026-001",
    journalCode: "OD",
    moduleSource: "BANKING",
    description: "Paie equipe produit et operations",
    entryDateUtc: "2026-01-28T18:00:00.000Z",
    lines: [
      { accountCode: "661100", lineLabel: "Salaires", debitCentimes: "1200000000", creditCentimes: "0" },
      { accountCode: "521000", lineLabel: "Paiement salaires", debitCentimes: "0", creditCentimes: "1200000000" },
    ],
  },
  {
    reference: "TAX-2026-001",
    journalCode: "OD",
    moduleSource: "AFRITAX",
    description: "Provision fiscale mensuelle",
    entryDateUtc: "2026-01-31T17:00:00.000Z",
    lines: [
      { accountCode: "671200", lineLabel: "Provision fiscale", debitCentimes: "315000000", creditCentimes: "0" },
      { accountCode: "447000", lineLabel: "Etat - impots dus", debitCentimes: "0", creditCentimes: "315000000" },
    ],
  },
];

const COUNTRY_WEIGHTS = {
  CI: 0.22,
  GH: 0.15,
  TG: 0.03,
  SN: 0.1,
  NG: 0.28,
  BF: 0.04,
  ML: 0.04,
  GN: 0.04,
  BJ: 0.03,
  NE: 0.01,
  MR: 0.01,
  GW: 0.01,
  SL: 0.01,
  LR: 0.01,
  GM: 0.01,
  CV: 0.01,
};

const COUNTRY_BASE_SCORES = {
  CI: 89, GH: 88, TG: 82, SN: 79, NG: 77, BF: 71, ML: 68, GN: 65,
  BJ: 64, NE: 52, MR: 51, GW: 48, SL: 46, LR: 44, GM: 42, CV: 61,
};

const COUNTRY_NAMES = {
  CI: "Cote d'Ivoire",
  GH: "Ghana",
  TG: "Togo",
  SN: "Senegal",
  NG: "Nigeria",
  BF: "Burkina Faso",
  ML: "Mali",
  GN: "Guinee",
  BJ: "Benin",
  NE: "Niger",
  MR: "Mauritanie",
  GW: "Guinee-Bissau",
  SL: "Sierra Leone",
  LR: "Liberia",
  GM: "Gambie",
  CV: "Cap-Vert",
};

const COUNTRY_TO_ETF_SYMBOL = {
  CI: "WASI-CI",
  GH: "WASI-GH",
  TG: "WASI-TG",
  SN: "WASI-SN",
  NG: "WASI-NG",
  BF: "WASI-BF",
  ML: "WASI-ML",
  GN: "WASI-GN",
  BJ: "WASI-BJ",
  NE: "WASI-NE",
  MR: "WASI-MR",
  GW: "WASI-GW",
  SL: "WASI-SL",
  LR: "WASI-LR",
  GM: "WASI-GM",
  CV: "WASI-CV",
};

const MARKET_BOARD_SNAPSHOT = [
  { exchange: "BRVM", label: "BRVM Composite", symbol: "BRVM-C", level: 10160.73, change_pct: 2.65 },
  { exchange: "NGX", label: "NGX ASI", symbol: "NGX-ASI", level: 98432.1, change_pct: 0.84 },
  { exchange: "GSE", label: "GSE Composite", symbol: "GSE-CI", level: 3412.55, change_pct: -0.32 },
  { exchange: "UMOA", label: "UMOA Titres Composite", symbol: "UMOA-TITRES", level: 153.42, change_pct: 0.61 },
  { exchange: "WA-BOND", label: "West Africa Sovereign Bond 10Y", symbol: "WA-BOND-10Y", level: 97.86, change_pct: 0.24 },
];

const FINANCIAL_PRODUCTS_SNAPSHOT = [
  { code: "BRVM-C", type: "INDEX", venue: "BRVM", label: "BRVM Composite", tradableOnDex: true },
  { code: "GSE-CI", type: "INDEX", venue: "GSE", label: "GSE Composite", tradableOnDex: true },
  { code: "NGX-ASI", type: "INDEX", venue: "NGX", label: "NGX All Share", tradableOnDex: true },
  { code: "UMOA-TITRES", type: "BOND", venue: "UMOA Titres", label: "UMOA Titres Composite", tradableOnDex: true },
  { code: "WA-BOND-10Y", type: "BOND", venue: "Regional", label: "West Africa Sovereign Bond 10Y", tradableOnDex: true },
  { code: "WASI-COMP", type: "ETF", venue: "WASI DEX", label: "WASI Composite ETF", tradableOnDex: true },
  { code: "WASI-BRVM", type: "ETF", venue: "WASI DEX", label: "BRVM Equity ETF", tradableOnDex: true },
  { code: "WASI-GSE", type: "ETF", venue: "WASI DEX", label: "GSE Equity ETF", tradableOnDex: true },
  { code: "WASI-UEMOA", type: "ETF", venue: "WASI DEX", label: "UEMOA Zone ETF", tradableOnDex: true },
  { code: "WASI-COCOA", type: "ETF", venue: "WASI DEX", label: "Cocoa ETF", tradableOnDex: true },
];

const COMMODITY_SNAPSHOT = [
  { symbol: "COCOA", name: "Cocoa ICE", price: 8945, unit: "USD/t", chg_pct: 1.2, ytd_pct: 62.3 },
  { symbol: "BRENT", name: "Brent Crude", price: 72.4, unit: "USD/bbl", chg_pct: -0.8, ytd_pct: -8.2 },
  { symbol: "GOLD", name: "Gold Spot", price: 2312.5, unit: "USD/oz", chg_pct: 0.3, ytd_pct: 12.1 },
  { symbol: "COTTON", name: "Cotton #2", price: 0.84, unit: "USD/lb", chg_pct: -0.5, ytd_pct: -3.4 },
  { symbol: "COFFEE", name: "Robusta", price: 5180, unit: "USD/t", chg_pct: 2.1, ytd_pct: 45.8 },
  { symbol: "IRON", name: "Iron Ore 62", price: 108.5, unit: "USD/t", chg_pct: -1.3, ytd_pct: -12.7 },
  { symbol: "RUBBER", name: "Natural Rubber", price: 178.3, unit: "JPY/kg", chg_pct: 0.9, ytd_pct: 14.2 },
];

const NEWS_EVENT_SNAPSHOT = [
  { id: "evt-1", type: "NEWS", text: "BCEAO holds benchmark rate at 3.50%", impact: 1.2, country_code: "SN", severity: "LOW", timestamp: "14:32" },
  { id: "evt-2", type: "RISK", text: "Sahel security pressure weighs on logistics", impact: -1.5, country_code: "BF", severity: "HIGH", timestamp: "14:15" },
  { id: "evt-3", type: "DATA", text: "CI GDP growth revised to +6.8% YoY", impact: 1.8, country_code: "CI", severity: "MEDIUM", timestamp: "13:48" },
  { id: "evt-4", type: "TRADE", text: "BRVM turnover climbs on SOLIBRA and SGBCI", impact: 0.9, country_code: "CI", severity: "LOW", timestamp: "13:22" },
  { id: "evt-5", type: "DATA", text: "NG inflation eases for third month", impact: 1.1, country_code: "NG", severity: "MEDIUM", timestamp: "12:55" },
];

const MACRO_COUNTRY_SNAPSHOT = {
  CI: { gdp_growth: 6.7, inflation: 3.9, debt_to_gdp: 58.2, current_account: -3.1 },
  GH: { gdp_growth: 4.8, inflation: 18.2, debt_to_gdp: 76.4, current_account: -2.4 },
  TG: { gdp_growth: 5.4, inflation: 3.4, debt_to_gdp: 64.8, current_account: -4.2 },
  SN: { gdp_growth: 8.1, inflation: 2.9, debt_to_gdp: 72.3, current_account: -6.0 },
  NG: { gdp_growth: 3.2, inflation: 26.3, debt_to_gdp: 39.1, current_account: 1.8 },
  BF: { gdp_growth: 5.2, inflation: 3.8, debt_to_gdp: 59.4, current_account: -5.2 },
  ML: { gdp_growth: 4.1, inflation: 4.1, debt_to_gdp: 48.9, current_account: -7.0 },
  GN: { gdp_growth: 5.5, inflation: 8.7, debt_to_gdp: 42.6, current_account: -4.8 },
  BJ: { gdp_growth: 6.4, inflation: 2.7, debt_to_gdp: 54.3, current_account: -3.9 },
  NE: { gdp_growth: 6.0, inflation: 5.8, debt_to_gdp: 49.8, current_account: -8.5 },
  MR: { gdp_growth: 5.0, inflation: 4.6, debt_to_gdp: 47.4, current_account: -2.1 },
  GW: { gdp_growth: 4.0, inflation: 6.2, debt_to_gdp: 61.5, current_account: -11.0 },
  SL: { gdp_growth: 4.7, inflation: 19.9, debt_to_gdp: 83.4, current_account: -9.4 },
  LR: { gdp_growth: 4.1, inflation: 11.2, debt_to_gdp: 57.1, current_account: -7.8 },
  GM: { gdp_growth: 5.1, inflation: 9.6, debt_to_gdp: 70.2, current_account: -5.7 },
  CV: { gdp_growth: 4.3, inflation: 2.1, debt_to_gdp: 114.0, current_account: -8.2 },
};

const TRANSPORT_PROFILE_WEIGHTS = {
  COASTAL_MAJOR: { maritime: 0.35, air: 0.25, rail: 0.05, road: 0.35 },
  COASTAL_TRANSIT: { maritime: 0.3, air: 0.15, rail: 0.05, road: 0.5 },
  LANDLOCKED_RAIL: { maritime: 0.05, air: 0.15, rail: 0.35, road: 0.45 },
  LANDLOCKED_ROAD: { maritime: 0.05, air: 0.15, rail: 0.05, road: 0.75 },
  COASTAL_MINING: { maritime: 0.25, air: 0.15, rail: 0.1, road: 0.5 },
  SMALL_COASTAL: { maritime: 0.4, air: 0.3, rail: 0.0, road: 0.3 },
};

const TRANSPORT_COUNTRY_SNAPSHOT = {
  NG: {
    profile: "COASTAL_MAJOR",
    modes: { maritime: 78, air: 86, rail: 32, road: 82 },
    roadSource: "NBS exports corridor + CBN fuel trucking proxy",
    roadQuality: "A",
  },
  CI: {
    profile: "COASTAL_MAJOR",
    modes: { maritime: 84, air: 93, rail: 58, road: 76 },
    roadSource: "DGD CI + Port d'Abidjan hinterland transit",
    roadQuality: "A",
  },
  GH: {
    profile: "COASTAL_MAJOR",
    modes: { maritime: 72, air: 88, rail: 30, road: 79 },
    roadSource: "GSS Ghana + Ghana Ports hinterland",
    roadQuality: "A",
  },
  SN: {
    profile: "COASTAL_MAJOR",
    modes: { maritime: 75, air: 82, rail: 28, road: 74 },
    roadSource: "ANSD Tableau 6 + Port de Dakar dispatch",
    roadQuality: "B",
  },
  BJ: {
    profile: "COASTAL_TRANSIT",
    modes: { maritime: 68, air: 61, rail: 29, road: 74 },
    roadSource: "INStaD transit Niger + Port de Cotonou",
    roadQuality: "A",
  },
  TG: {
    profile: "COASTAL_TRANSIT",
    modes: { maritime: 71, air: 64, rail: 27, road: 78 },
    roadSource: "Port de Lome destination transit + INSEED Togo",
    roadQuality: "A",
  },
  BF: {
    profile: "LANDLOCKED_RAIL",
    modes: { maritime: 41, air: 52, rail: 69, road: 72 },
    roadSource: "DGD BF multi-corridor transit + SONABHY fuel proxy",
    roadQuality: "A",
  },
  ML: {
    profile: "LANDLOCKED_ROAD",
    modes: { maritime: 38, air: 48, rail: 24, road: 68 },
    roadSource: "Dakar/Bamako and Abidjan/Bamako corridor proxies",
    roadQuality: "B",
  },
  NE: {
    profile: "LANDLOCKED_ROAD",
    modes: { maritime: 36, air: 46, rail: 20, road: 66 },
    roadSource: "INStaD Benin transit + WAPCo pipeline cross-check",
    roadQuality: "A",
  },
  GN: {
    profile: "COASTAL_MINING",
    modes: { maritime: 70, air: 63, rail: 35, road: 71 },
    roadSource: "SMB-Winning logistics + BCRG trade flow proxy",
    roadQuality: "B",
  },
  MR: {
    profile: "COASTAL_MINING",
    modes: { maritime: 66, air: 57, rail: 33, road: 65 },
    roadSource: "PANPA hinterland + ONS Mauritanie transit proxy",
    roadQuality: "B",
  },
  SL: {
    profile: "COASTAL_MINING",
    modes: { maritime: 53, air: 49, rail: 19, road: 56 },
    roadSource: "Commodity logistics proxy (rutile/iron corridors)",
    roadQuality: "C",
  },
  LR: {
    profile: "COASTAL_MINING",
    modes: { maritime: 54, air: 46, rail: 18, road: 58 },
    roadSource: "Commodity logistics proxy (rubber/iron corridors)",
    roadQuality: "C",
  },
  GW: {
    profile: "SMALL_COASTAL",
    modes: { maritime: 45, air: 42, rail: 15, road: 50 },
    roadSource: "Customs/fuel proxy (low-frequency reporting)",
    roadQuality: "C",
  },
  GM: {
    profile: "SMALL_COASTAL",
    modes: { maritime: 52, air: 47, rail: 14, road: 55 },
    roadSource: "Customs/fuel proxy (cross-border trucks)",
    roadQuality: "C",
  },
  CV: {
    profile: "SMALL_COASTAL",
    modes: { maritime: 60, air: 68, rail: 8, road: 48 },
    roadSource: "Import/fuel proxy + airport/port dispatch blend",
    roadQuality: "B",
  },
};

const clampTransportIndex = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed * 10) / 10));
};

const deriveTransportTrend = (index) => {
  if (index >= 75) return "POSITIVE";
  if (index >= 55) return "STABLE";
  return "PRESSURED";
};

const defaultTransportModeSources = {
  maritime: {
    source: "WASI Shipping Index snapshot (port activity)",
    quality: "B",
  },
  air: {
    source: "Airport authority + ASECNA blended snapshot",
    quality: "B",
  },
  rail: {
    source: "SITARAIL and corridor rail proxy",
    quality: "B",
  },
  road: {
    source: "Customs transit + port hinterland + fuel + OPA proxy",
    quality: "B",
  },
};

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
      last_price_centimes = excluded.last_price_centimes,
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

const hashLegacyPassword = (password, secret) =>
  createHash("sha256").update(`${secret}:${String(password)}`).digest("hex");

const hashPassword = (password) => {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(
    String(password),
    `${PASSWORD_PEPPER}:${salt}`,
    PASSWORD_HASH_KEY_LENGTH
  ).toString("hex");
  return `${PASSWORD_HASH_VERSION}$${salt}$${derived}`;
};

const verifyPassword = (password, storedHash) => {
  const normalizedStoredHash = String(storedHash || "").trim();
  if (!normalizedStoredHash) {
    return { valid: false, needsRehash: false };
  }

  const [version, salt, derivedHex] = normalizedStoredHash.split("$");
  if (version === PASSWORD_HASH_VERSION && salt && derivedHex) {
    const derived = scryptSync(
      String(password),
      `${PASSWORD_PEPPER}:${salt}`,
      PASSWORD_HASH_KEY_LENGTH
    );
    const expected = Buffer.from(derivedHex, "hex");
    if (expected.length !== derived.length) {
      return { valid: false, needsRehash: false };
    }
    return {
      valid: timingSafeEqual(derived, expected),
      needsRehash: false,
    };
  }

  for (const secret of LEGACY_PASSWORD_SECRETS) {
    if (hashLegacyPassword(password, secret) === normalizedStoredHash) {
      return { valid: true, needsRehash: true };
    }
  }

  return { valid: false, needsRehash: false };
};

const ensurePlatformUsers = () => {
  if (!ALLOW_DEMO_CREDENTIALS) return;

  const upsertUser = db.prepare(`
    INSERT INTO platform_users (
      id, username, email, password_hash, role, tier, x402_balance, is_active, created_at_utc, updated_at_utc
    ) VALUES (
      @id, @username, @email, @passwordHash, @role, @tier, @x402Balance, 1, @createdAtUtc, @updatedAtUtc
    )
    ON CONFLICT(username) DO UPDATE SET
      email = excluded.email,
      password_hash = excluded.password_hash,
      role = excluded.role,
      tier = excluded.tier,
      x402_balance = excluded.x402_balance,
      is_active = 1,
      updated_at_utc = excluded.updated_at_utc
  `);

  const now = new Date().toISOString();
  const run = db.transaction((users) => {
    for (const user of users) {
      upsertUser.run({
        id: user.id,
        username: user.username,
        email: `${user.username}@wasi.local`,
        passwordHash: hashPassword(user.password),
        role: user.role,
        tier: "demo",
        x402Balance: 1000,
        createdAtUtc: now,
        updatedAtUtc: now,
      });
    }
  });

  run(DEMO_USERS);
};

ensurePlatformUsers();

const sumEntryLineDebits = (lines) =>
  lines.reduce((sum, line) => sum + BigInt(line.debitCentimes), 0n);

const sumEntryLineCredits = (lines) =>
  lines.reduce((sum, line) => sum + BigInt(line.creditCentimes), 0n);

const ensureComptaSeedData = () => {
  const now = new Date().toISOString();

  const upsertAccount = db.prepare(`
    INSERT INTO syscohada_accounts (
      code, label, class_number, category, kind, normal_side, statement_section, is_active, created_at_utc, updated_at_utc
    ) VALUES (
      @code, @label, @classNumber, @category, @kind, @normalSide, @statementSection, 1, @createdAtUtc, @updatedAtUtc
    )
    ON CONFLICT(code) DO UPDATE SET
      label = excluded.label,
      class_number = excluded.class_number,
      category = excluded.category,
      kind = excluded.kind,
      normal_side = excluded.normal_side,
      statement_section = excluded.statement_section,
      is_active = 1,
      updated_at_utc = excluded.updated_at_utc
  `);

  const ensureAccounts = db.transaction((rows) => {
    for (const row of rows) {
      upsertAccount.run({
        ...row,
        createdAtUtc: now,
        updatedAtUtc: now,
      });
    }
  });

  ensureAccounts(SYSCOHADA_SEED_ACCOUNTS);

  const entryCountRow = db
    .prepare("SELECT COUNT(*) AS count FROM accounting_journal_entries")
    .get();
  if (Number(entryCountRow?.count ?? 0) > 0) {
    return;
  }

  const insertEntry = db.prepare(`
    INSERT INTO accounting_journal_entries (
      id, reference, journal_code, module_source, description, entry_date_utc, status,
      total_debit_centimes, total_credit_centimes, created_at_utc, updated_at_utc
    ) VALUES (
      @id, @reference, @journalCode, @moduleSource, @description, @entryDateUtc, 'POSTED',
      @totalDebitCentimes, @totalCreditCentimes, @createdAtUtc, @updatedAtUtc
    )
  `);

  const insertLine = db.prepare(`
    INSERT INTO accounting_journal_lines (
      id, entry_id, account_code, line_label, debit_centimes, credit_centimes, created_at_utc
    ) VALUES (
      @id, @entryId, @accountCode, @lineLabel, @debitCentimes, @creditCentimes, @createdAtUtc
    )
  `);

  const seedEntries = db.transaction((entries) => {
    for (const entry of entries) {
      const totalDebitCentimes = sumEntryLineDebits(entry.lines).toString();
      const totalCreditCentimes = sumEntryLineCredits(entry.lines).toString();
      const entryId = randomUUID();

      insertEntry.run({
        id: entryId,
        reference: entry.reference,
        journalCode: entry.journalCode ?? "OD",
        moduleSource: entry.moduleSource,
        description: entry.description,
        entryDateUtc: entry.entryDateUtc,
        totalDebitCentimes,
        totalCreditCentimes,
        createdAtUtc: now,
        updatedAtUtc: now,
      });

      for (const line of entry.lines) {
        insertLine.run({
          id: randomUUID(),
          entryId,
          accountCode: line.accountCode,
          lineLabel: line.lineLabel,
          debitCentimes: line.debitCentimes,
          creditCentimes: line.creditCentimes,
          createdAtUtc: now,
        });
      }
    }
  });

  seedEntries(ACCOUNTING_SEED_ENTRIES);
};

ensureComptaSeedData();

class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const authFailureStore = new Map();
const resolveAuthRateLimitWindowMs = () =>
  Number.isFinite(AUTH_RATE_LIMIT_WINDOW_MS) && AUTH_RATE_LIMIT_WINDOW_MS >= 1000
    ? AUTH_RATE_LIMIT_WINDOW_MS
    : 15 * 60 * 1000;
const resolveAuthRateLimitMaxAttempts = () =>
  Number.isFinite(AUTH_RATE_LIMIT_MAX_ATTEMPTS) && AUTH_RATE_LIMIT_MAX_ATTEMPTS >= 1
    ? Math.trunc(AUTH_RATE_LIMIT_MAX_ATTEMPTS)
    : 8;

const getRequestIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.socket?.remoteAddress ?? "unknown";
};

const getAuthFailureKey = (req, username) =>
  `${getRequestIp(req)}:${String(username || "anonymous").trim().toLowerCase()}`;

const getAuthFailureRecord = (key, now = Date.now()) => {
  const windowMs = resolveAuthRateLimitWindowMs();
  const current = authFailureStore.get(key);
  if (!current || now - current.windowStartedAt > windowMs) {
    const fresh = { count: 0, windowStartedAt: now };
    authFailureStore.set(key, fresh);
    return fresh;
  }
  return current;
};

const assertAuthRateLimit = (req, username) => {
  const key = getAuthFailureKey(req, username);
  const record = getAuthFailureRecord(key);
  const maxAttempts = resolveAuthRateLimitMaxAttempts();
  if (record.count >= maxAttempts) {
    throw new ApiError(429, "Too many authentication attempts. Please retry later.");
  }
};

const recordAuthFailure = (req, username) => {
  const key = getAuthFailureKey(req, username);
  const record = getAuthFailureRecord(key);
  record.count += 1;
  authFailureStore.set(key, record);
  if (record.count >= 3 && typeof raiseAlert === "function") {
    raiseAlert({
      alertType: "FAILED_LOGIN_SPIKE",
      severity: record.count >= 5 ? "CRITICAL" : "WARNING",
      message: `${record.count} failed login attempts for "${username}" from ${getRequestIp(req)}`,
      detail: { username, ip: getRequestIp(req), attempts: record.count },
    });
  }
  return record.count;
};

const clearAuthFailures = (req, username) => {
  authFailureStore.delete(getAuthFailureKey(req, username));
};

/* ── Banking rate limiter (per-user, in-memory) ── */
const BANKING_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const BANKING_RATE_LIMIT_MAX = 10;
const bankingRateLimitStore = new Map();

const bankingRateLimit = (req, _res, next) => {
  try {
    const userId = req.authUser?.sub;
    if (!userId) return next();

    const now = Date.now();
    let record = bankingRateLimitStore.get(userId);

    if (!record || now - record.windowStartedAt > BANKING_RATE_LIMIT_WINDOW_MS) {
      record = { count: 0, windowStartedAt: now };
      bankingRateLimitStore.set(userId, record);
    }

    record.count += 1;

    if (record.count > BANKING_RATE_LIMIT_MAX) {
      throw new ApiError(
        429,
        `Rate limit exceeded. Maximum ${BANKING_RATE_LIMIT_MAX} banking operations per 5 minutes.`
      );
    }

    next();
  } catch (err) {
    next(err);
  }
};

const isCorsOriginAllowed = (origin) => {
  if (!origin) return !IS_PRODUCTION;
  if (CORS_ALLOWED_ORIGINS.size > 0) {
    return CORS_ALLOWED_ORIGINS.has(origin);
  }
  if (!IS_PRODUCTION) {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  }
  return false;
};

const app = express();
app.set("trust proxy", 1);
app.use(
  cors({
    origin(origin, callback) {
      callback(null, isCorsOriginAllowed(origin));
    },
    methods: ["GET", "POST"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Idempotency-Key",
      "X-Idempotency-Key",
    ],
  })
);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (IS_PRODUCTION) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

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

const serializeApproval = (row) => {
  let requestBody = null;
  try {
    requestBody = row.request_body_json ? JSON.parse(row.request_body_json) : null;
  } catch {
    requestBody = { raw: row.request_body_json };
  }

  return {
    id: row.id,
    operationType: row.operation_type,
    status: row.status,
    initiatedByUserId: row.initiated_by_user_id,
    initiatedByUsername: row.initiated_by_username,
    initiatedByRole: row.initiated_by_role,
    approvedByUserId: row.approved_by_user_id ?? null,
    approvedByUsername: row.approved_by_username ?? null,
    accountId: row.account_id ?? null,
    fromAccountId: row.from_account_id ?? null,
    toAccountId: row.to_account_id ?? null,
    amountCentimes: row.amount_centimes,
    description: row.description,
    requestBody,
    decisionNote: row.decision_note ?? null,
    createdAtUtc: row.created_at_utc,
    decidedAtUtc: row.decided_at_utc ?? null,
    updatedAtUtc: row.updated_at_utc,
  };
};

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

const parseNonNegativeAmountCentimes = (
  value,
  fieldName = "amountCentimes"
) => {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new ApiError(400, `${fieldName} must be a string or integer number.`);
  }

  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) {
    throw new ApiError(
      400,
      `${fieldName} must be a non-negative integer in centimes.`
    );
  }

  const amount = BigInt(normalized);
  if (amount > MAX_SAFE_AMOUNT_CENTIMES) {
    throw new ApiError(400, `${fieldName} exceeds supported bounds.`);
  }

  return amount;
};

const serializeSyscohadaAccount = (row) => ({
  code: row.code,
  label: row.label,
  classNumber: Number(row.class_number),
  classLabel: SYSCOHADA_CLASS_LABELS[Number(row.class_number)] ?? "Classe",
  category: row.category,
  kind: row.kind,
  normalSide: row.normal_side,
  statementSection: row.statement_section,
});

const serializeAccountingLine = (row) => ({
  entryId: row.entry_id,
  accountCode: row.account_code,
  lineLabel: row.line_label,
  debitCentimes: String(row.debit_centimes),
  creditCentimes: String(row.credit_centimes),
  createdAtUtc: row.created_at_utc,
});

const serializeAccountingEntry = (row) => ({
  id: row.id,
  reference: row.reference,
  journalCode: row.journal_code ?? "OD",
  moduleSource: row.module_source,
  description: row.description,
  entryDateUtc: row.entry_date_utc,
  status: row.status,
  totalDebitCentimes: String(row.total_debit_centimes),
  totalCreditCentimes: String(row.total_credit_centimes),
  createdAtUtc: row.created_at_utc,
  updatedAtUtc: row.updated_at_utc,
});

const buildRecentAccountingEntries = (limit = 8) => {
  const safeLimit = Number.isFinite(limit)
    ? Math.min(Math.max(limit, 1), 50)
    : 8;
  return listRecentAccountingEntries.all(safeLimit).map((row) => ({
    ...serializeAccountingEntry(row),
    lines: listAccountingLinesByEntryId
      .all(row.id)
      .map(serializeAccountingLine),
  }));
};

const buildComptaChart = () => {
  const accounts = listSyscohadaAccounts.all().map(serializeSyscohadaAccount);
  const countByClass = new Map(
    listSyscohadaClassCounts
      .all()
      .map((row) => [Number(row.class_number), Number(row.account_count)])
  );

  const classes = Object.keys(SYSCOHADA_CLASS_LABELS).map((classNumberRaw) => {
    const classNumber = Number(classNumberRaw);
    return {
      classNumber,
      classLabel: SYSCOHADA_CLASS_LABELS[classNumber],
      accountCount: countByClass.get(classNumber) ?? 0,
    };
  });

  return { classes, accounts };
};

const buildTrialBalanceSnapshot = () => {
  const rows = listTrialBalanceRows.all().map((row) => {
    const totalDebitCentimes = BigInt(row.total_debit_centimes ?? 0);
    const totalCreditCentimes = BigInt(row.total_credit_centimes ?? 0);
    const balanceSide =
      totalDebitCentimes === totalCreditCentimes
        ? "FLAT"
        : totalDebitCentimes > totalCreditCentimes
          ? "DEBIT"
          : "CREDIT";
    const balanceCentimes =
      totalDebitCentimes >= totalCreditCentimes
        ? totalDebitCentimes - totalCreditCentimes
        : totalCreditCentimes - totalDebitCentimes;

    return {
      code: row.code,
      label: row.label,
      classNumber: Number(row.class_number),
      classLabel: SYSCOHADA_CLASS_LABELS[Number(row.class_number)] ?? "Classe",
      category: row.category,
      kind: row.kind,
      normalSide: row.normal_side,
      statementSection: row.statement_section,
      totalDebitCentimes: totalDebitCentimes.toString(),
      totalCreditCentimes: totalCreditCentimes.toString(),
      balanceSide,
      balanceCentimes: balanceCentimes.toString(),
    };
  });

  const totals = rows.reduce(
    (accumulator, row) => ({
      totalDebitCentimes:
        accumulator.totalDebitCentimes + BigInt(row.totalDebitCentimes),
      totalCreditCentimes:
        accumulator.totalCreditCentimes + BigInt(row.totalCreditCentimes),
    }),
    { totalDebitCentimes: 0n, totalCreditCentimes: 0n }
  );

  return {
    rows,
    totals: {
      totalDebitCentimes: totals.totalDebitCentimes.toString(),
      totalCreditCentimes: totals.totalCreditCentimes.toString(),
      isBalanced:
        totals.totalDebitCentimes === totals.totalCreditCentimes,
    },
  };
};

const getDebitBalanceCentimes = (row) =>
  row && row.balanceSide === "DEBIT" ? BigInt(row.balanceCentimes) : 0n;

const getCreditBalanceCentimes = (row) =>
  row && row.balanceSide === "CREDIT" ? BigInt(row.balanceCentimes) : 0n;

const getSignedRowNetCentimes = (row) =>
  BigInt(row.totalDebitCentimes) - BigInt(row.totalCreditCentimes);

const sumRowsByPrefixes = (rows, prefixes, orientation = "DEBIT") =>
  rows.reduce((sum, row) => {
    if (!prefixes.some((prefix) => row.code.startsWith(prefix))) {
      return sum;
    }

    const signedNet = getSignedRowNetCentimes(row);
    return orientation === "DEBIT" ? sum + signedNet : sum - signedNet;
  }, 0n);

const sumRowsByStatementSections = (rows, sections, orientation = "DEBIT") =>
  rows.reduce((sum, row) => {
    if (!sections.includes(row.statementSection)) {
      return sum;
    }

    const signedNet = getSignedRowNetCentimes(row);
    return orientation === "DEBIT" ? sum + signedNet : sum - signedNet;
  }, 0n);

const buildIncomeStatementSnapshot = (trialBalance = buildTrialBalanceSnapshot()) => {
  const rows = trialBalance.rows;

  const salesRevenueCentimes = sumRowsByPrefixes(
    rows,
    ["701", "702", "703", "704", "706", "707", "708"],
    "CREDIT"
  );
  const stockAndProducedRevenueCentimes = sumRowsByPrefixes(
    rows,
    ["721", "731"],
    "CREDIT"
  );
  const otherOperatingRevenueCentimes = sumRowsByPrefixes(
    rows,
    ["751", "754", "781", "791"],
    "CREDIT"
  );
  const purchasesCentimes = sumRowsByPrefixes(
    rows,
    ["601", "602", "603", "604", "605", "606"],
    "DEBIT"
  );
  const transportCentimes = sumRowsByPrefixes(rows, ["611", "612", "613"], "DEBIT");
  const externalServicesCentimes = sumRowsByPrefixes(
    rows,
    [
      "621",
      "622",
      "623",
      "624",
      "625",
      "626",
      "627",
      "628",
      "631",
      "632",
      "633",
      "634",
      "635",
      "636",
      "637",
      "638",
    ],
    "DEBIT"
  );
  const taxesAndDutiesCentimes = sumRowsByPrefixes(
    rows,
    ["641", "645", "646"],
    "DEBIT"
  );
  const personnelCentimes = sumRowsByPrefixes(rows, ["661", "664", "665"], "DEBIT");
  const depreciationCentimes = sumRowsByPrefixes(rows, ["681", "691"], "DEBIT");
  const financialExpenseCentimes = sumRowsByPrefixes(
    rows,
    ["671", "672", "675"],
    "DEBIT"
  );
  const financialIncomeCentimes = sumRowsByPrefixes(rows, ["771"], "CREDIT");
  const incomeTaxCentimes = sumRowsByPrefixes(rows, ["695"], "DEBIT");
  const haoRevenueCentimes = sumRowsByPrefixes(rows, ["811", "881"], "CREDIT");
  const haoExpenseCentimes = sumRowsByPrefixes(rows, ["831", "871"], "DEBIT");

  const grossMarginCentimes = salesRevenueCentimes - purchasesCentimes;
  const valueAddedCentimes =
    salesRevenueCentimes +
    stockAndProducedRevenueCentimes +
    otherOperatingRevenueCentimes -
    purchasesCentimes -
    transportCentimes -
    externalServicesCentimes;
  const ebeCentimes =
    valueAddedCentimes - taxesAndDutiesCentimes - personnelCentimes;
  const operatingResultCentimes = ebeCentimes - depreciationCentimes;
  const financialResultCentimes =
    financialIncomeCentimes - financialExpenseCentimes;
  const ordinaryResultBeforeTaxCentimes =
    operatingResultCentimes + financialResultCentimes;
  const ordinaryResultAfterTaxCentimes =
    ordinaryResultBeforeTaxCentimes - incomeTaxCentimes;
  const haoResultCentimes = haoRevenueCentimes - haoExpenseCentimes;
  const netResultCentimes =
    ordinaryResultAfterTaxCentimes + haoResultCentimes;

  return {
    rows: [
      {
        code: "CA",
        label: "Chiffre d'affaires et prestations",
        amountCentimes: salesRevenueCentimes.toString(),
      },
      {
        code: "PS",
        label: "Production stockee et immobilisee",
        amountCentimes: (
          stockAndProducedRevenueCentimes + otherOperatingRevenueCentimes
        ).toString(),
      },
      {
        code: "ACH",
        label: "Achats consommes",
        amountCentimes: purchasesCentimes.toString(),
      },
      {
        code: "TRP",
        label: "Transports",
        amountCentimes: transportCentimes.toString(),
      },
      {
        code: "SE",
        label: "Services exterieurs et autres services",
        amountCentimes: externalServicesCentimes.toString(),
      },
      {
        code: "IT",
        label: "Impots et taxes",
        amountCentimes: taxesAndDutiesCentimes.toString(),
      },
      {
        code: "PER",
        label: "Charges de personnel",
        amountCentimes: personnelCentimes.toString(),
      },
      {
        code: "DAP",
        label: "Dotations aux amortissements et provisions",
        amountCentimes: depreciationCentimes.toString(),
      },
      {
        code: "RF",
        label: "Resultat financier",
        amountCentimes: financialResultCentimes.toString(),
      },
      {
        code: "HAO",
        label: "Resultat hors activites ordinaires",
        amountCentimes: haoResultCentimes.toString(),
      },
      {
        code: "IS",
        label: "Impot sur le resultat",
        amountCentimes: incomeTaxCentimes.toString(),
      },
      {
        code: "RN",
        label: "Resultat net",
        amountCentimes: netResultCentimes.toString(),
      },
    ],
    aggregates: {
      salesRevenueCentimes: salesRevenueCentimes.toString(),
      stockAndProducedRevenueCentimes:
        stockAndProducedRevenueCentimes.toString(),
      otherOperatingRevenueCentimes:
        otherOperatingRevenueCentimes.toString(),
      purchasesCentimes: purchasesCentimes.toString(),
      transportCentimes: transportCentimes.toString(),
      externalServicesCentimes: externalServicesCentimes.toString(),
      taxesAndDutiesCentimes: taxesAndDutiesCentimes.toString(),
      personnelCentimes: personnelCentimes.toString(),
      depreciationCentimes: depreciationCentimes.toString(),
      financialExpenseCentimes: financialExpenseCentimes.toString(),
      financialIncomeCentimes: financialIncomeCentimes.toString(),
      grossMarginCentimes: grossMarginCentimes.toString(),
      valueAddedCentimes: valueAddedCentimes.toString(),
      ebeCentimes: ebeCentimes.toString(),
      operatingResultCentimes: operatingResultCentimes.toString(),
      financialResultCentimes: financialResultCentimes.toString(),
      ordinaryResultBeforeTaxCentimes:
        ordinaryResultBeforeTaxCentimes.toString(),
      ordinaryResultAfterTaxCentimes:
        ordinaryResultAfterTaxCentimes.toString(),
      incomeTaxCentimes: incomeTaxCentimes.toString(),
      haoRevenueCentimes: haoRevenueCentimes.toString(),
      haoExpenseCentimes: haoExpenseCentimes.toString(),
      haoResultCentimes: haoResultCentimes.toString(),
      netResultCentimes: netResultCentimes.toString(),
    },
  };
};

const buildBalanceSheetSnapshot = (trialBalance = buildTrialBalanceSnapshot()) => {
  const rows = trialBalance.rows;
  const incomeStatement = buildIncomeStatementSnapshot(trialBalance);
  const postedCurrentResultCentimes = sumRowsByStatementSections(
    rows,
    ["CURRENT_RESULT"],
    "CREDIT"
  );
  const currentResultCentimes =
    postedCurrentResultCentimes !== 0n
      ? postedCurrentResultCentimes
      : BigInt(incomeStatement.aggregates.netResultCentimes);

  const fixedAssetGrossCentimes = sumRowsByStatementSections(
    rows,
    ["FIXED_ASSET"],
    "DEBIT"
  );
  const accumulatedDepreciationCentimes = sumRowsByStatementSections(
    rows,
    ["ACCUM_DEPRECIATION"],
    "CREDIT"
  );
  const fixedAssetNetCentimes =
    fixedAssetGrossCentimes - accumulatedDepreciationCentimes;

  const inventoryGrossCentimes = sumRowsByStatementSections(
    rows,
    ["INVENTORY"],
    "DEBIT"
  );
  const inventoryDepreciationCentimes = sumRowsByStatementSections(
    rows,
    ["INVENTORY_DEPRECIATION"],
    "CREDIT"
  );
  const inventoryNetCentimes =
    inventoryGrossCentimes - inventoryDepreciationCentimes;

  const receivablesCentimes = sumRowsByStatementSections(
    rows,
    ["RECEIVABLE", "TAX_RECEIVABLE", "OTHER_ASSET"],
    "DEBIT"
  );

  const cashNetCentimes = sumRowsByStatementSections(rows, ["CASH"], "DEBIT");
  const treasuryAssetCentimes =
    cashNetCentimes > 0n ? cashNetCentimes : 0n;
  const treasuryLiabilityCentimes =
    cashNetCentimes < 0n ? 0n - cashNetCentimes : 0n;

  const equityCentimes = sumRowsByStatementSections(
    rows,
    ["EQUITY"],
    "CREDIT"
  );
  const provisionsCentimes = sumRowsByStatementSections(
    rows,
    ["PROVISION"],
    "CREDIT"
  );
  const longTermLiabilitiesCentimes = sumRowsByStatementSections(
    rows,
    ["LONG_TERM_LIABILITY"],
    "CREDIT"
  );
  const currentLiabilitiesCentimes = sumRowsByStatementSections(
    rows,
    ["PAYABLE", "TAX_PAYABLE", "OTHER_LIABILITY"],
    "CREDIT"
  );

  const totalActifCentimes =
    fixedAssetNetCentimes +
    inventoryNetCentimes +
    receivablesCentimes +
    treasuryAssetCentimes;
  const totalPassifCentimes =
    equityCentimes +
    currentResultCentimes +
    provisionsCentimes +
    longTermLiabilitiesCentimes +
    currentLiabilitiesCentimes +
    treasuryLiabilityCentimes;

  return {
    actif: [
      {
        code: "AI",
        label: "Actif immobilise net",
        amountCentimes: fixedAssetNetCentimes.toString(),
        detail: {
          grossCentimes: fixedAssetGrossCentimes.toString(),
          depreciationCentimes: accumulatedDepreciationCentimes.toString(),
        },
      },
      {
        code: "ACS",
        label: "Stocks nets",
        amountCentimes: inventoryNetCentimes.toString(),
        detail: {
          grossCentimes: inventoryGrossCentimes.toString(),
          depreciationCentimes: inventoryDepreciationCentimes.toString(),
        },
      },
      {
        code: "ACR",
        label: "Creances et comptes de regularisation",
        amountCentimes: receivablesCentimes.toString(),
      },
      {
        code: "TRESO",
        label: "Tresorerie active",
        amountCentimes: treasuryAssetCentimes.toString(),
      },
    ],
    passif: [
      {
        code: "CP",
        label: "Capitaux propres hors resultat",
        amountCentimes: equityCentimes.toString(),
      },
      {
        code: "RN",
        label: "Resultat de l'exercice",
        amountCentimes: currentResultCentimes.toString(),
      },
      {
        code: "PROV",
        label: "Provisions pour risques et charges",
        amountCentimes: provisionsCentimes.toString(),
      },
      {
        code: "DLMT",
        label: "Dettes financieres et ressources durables",
        amountCentimes: longTermLiabilitiesCentimes.toString(),
      },
      {
        code: "DCT",
        label: "Dettes a court terme",
        amountCentimes: currentLiabilitiesCentimes.toString(),
      },
      {
        code: "TRESO-P",
        label: "Concours bancaires et tresorerie passive",
        amountCentimes: treasuryLiabilityCentimes.toString(),
      },
    ],
    totals: {
      totalActifCentimes: totalActifCentimes.toString(),
      totalPassifCentimes: totalPassifCentimes.toString(),
      differenceCentimes: (totalActifCentimes - totalPassifCentimes).toString(),
      isBalanced: totalActifCentimes === totalPassifCentimes,
    },
  };
};

const buildLedgerSnapshot = (accountCode, limit = 200) => {
  const account = getSyscohadaAccountByCode.get(accountCode);
  if (!account) {
    throw new ApiError(404, `Unknown SYSCOHADA account: ${accountCode}.`);
  }

  const safeLimit = Number.isFinite(limit)
    ? Math.min(Math.max(Number(limit), 1), 500)
    : 200;
  const ledgerRows = listLedgerLinesByAccountCode.all(accountCode);

  let runningBalanceCentimes = 0n;
  const entries = ledgerRows.map((row) => {
    runningBalanceCentimes +=
      BigInt(row.debit_centimes) - BigInt(row.credit_centimes);

    const counterpartLines = listAccountingLinesByEntryId
      .all(row.entry_id)
      .filter((line) => line.account_code !== accountCode)
      .map((line) => `${line.account_code} ${line.line_label}`);

    return {
      entryId: row.entry_id,
      reference: row.reference,
      journalCode: row.journal_code ?? "OD",
      moduleSource: row.module_source,
      description: row.description,
      entryDateUtc: row.entry_date_utc,
      lineLabel: row.line_label,
      debitCentimes: String(row.debit_centimes),
      creditCentimes: String(row.credit_centimes),
      counterpartSummary: counterpartLines.join(" | "),
      runningBalanceSide:
        runningBalanceCentimes === 0n
          ? "FLAT"
          : runningBalanceCentimes > 0n
            ? "DEBIT"
            : "CREDIT",
      runningBalanceCentimes:
        (runningBalanceCentimes >= 0n
          ? runningBalanceCentimes
          : 0n - runningBalanceCentimes
        ).toString(),
    };
  });

  const totalDebitCentimes = entries.reduce(
    (sum, row) => sum + BigInt(row.debitCentimes),
    0n
  );
  const totalCreditCentimes = entries.reduce(
    (sum, row) => sum + BigInt(row.creditCentimes),
    0n
  );

  return {
    account: serializeSyscohadaAccount(account),
    totals: {
      entryCount: entries.length,
      totalDebitCentimes: totalDebitCentimes.toString(),
      totalCreditCentimes: totalCreditCentimes.toString(),
      closingBalanceSide:
        runningBalanceCentimes === 0n
          ? "FLAT"
          : runningBalanceCentimes > 0n
            ? "DEBIT"
            : "CREDIT",
      closingBalanceCentimes:
        (runningBalanceCentimes >= 0n
          ? runningBalanceCentimes
          : 0n - runningBalanceCentimes
        ).toString(),
    },
    entries: entries.slice(-safeLimit).reverse(),
  };
};

const buildComptaStatements = (trialBalance = buildTrialBalanceSnapshot()) => {
  const incomeStatement = buildIncomeStatementSnapshot(trialBalance);
  const balanceSheet = buildBalanceSheetSnapshot(trialBalance);

  return {
    trialBalance,
    incomeStatement,
    balanceSheet,
  };
};

const buildAfriTaxSummary = (trialBalance = buildTrialBalanceSnapshot()) => {
  const rowByCode = new Map(trialBalance.rows.map((row) => [row.code, row]));

  const outputVatCentimes = getCreditBalanceCentimes(rowByCode.get("443100"));
  const inputVatCentimes = getDebitBalanceCentimes(rowByCode.get("445660"));
  const directTaxProvisionCentimes = getCreditBalanceCentimes(
    rowByCode.get("447000")
  );

  const revenueCentimes = trialBalance.rows
    .filter((row) => row.classNumber === 7)
    .reduce(
      (sum, row) =>
        sum +
        (BigInt(row.totalCreditCentimes) - BigInt(row.totalDebitCentimes)),
      0n
    );

  const expenseCentimes = trialBalance.rows
    .filter((row) => row.classNumber === 6)
    .reduce(
      (sum, row) =>
        sum +
        (BigInt(row.totalDebitCentimes) - BigInt(row.totalCreditCentimes)),
      0n
    );

  const preTaxResultCentimes = revenueCentimes - expenseCentimes;
  const vatDueCentimes =
    outputVatCentimes > inputVatCentimes
      ? outputVatCentimes - inputVatCentimes
      : 0n;

  return {
    taxYear: 2026,
    source: "wasi_compta_bridge",
    dataMode: "mvp_live",
    outputVatCentimes: outputVatCentimes.toString(),
    inputVatCentimes: inputVatCentimes.toString(),
    vatDueCentimes: vatDueCentimes.toString(),
    directTaxProvisionCentimes: directTaxProvisionCentimes.toString(),
    revenueCentimes: revenueCentimes.toString(),
    deductibleExpenseCentimes: expenseCentimes.toString(),
    preTaxResultCentimes: preTaxResultCentimes.toString(),
    filingCalendar: [
      {
        code: "TVA-MENSUELLE",
        label: "Declaration TVA mensuelle",
        dueDate: "2026-03-15",
        status: vatDueCentimes > 0n ? "A_PREPARER" : "A_VERIFIER",
      },
      {
        code: "IS-ACOMPTE-T1",
        label: "Acompte IS / BIC T1",
        dueDate: "2026-04-15",
        status: preTaxResultCentimes > 0n ? "SURVEILLANCE" : "AJUSTEMENT",
      },
      {
        code: "RETENUES-SOURCE",
        label: "Retenues a la source fournisseurs",
        dueDate: "2026-03-20",
        status: "CONTROLE",
      },
    ],
  };
};

const buildComptaBridgeSummary = (trialBalance = buildTrialBalanceSnapshot()) => {
  const journalEntriesCount = Number(
    countAccountingJournalEntries.get()?.count ?? 0
  );

  const bankLiquidityCentimes = listAllBankAccounts
    .all()
    .reduce((sum, row) => sum + BigInt(row.balance_centimes), 0n);

  const dexWalletLiquidityCentimes = listAllDexWallets
    .all()
    .reduce((sum, row) => sum + BigInt(row.xof_balance_centimes), 0n);

  const dexAumCentimes = listAllDexPositionsWithPrices
    .all()
    .reduce(
      (sum, row) =>
        sum + BigInt(row.quantity_units) * BigInt(row.last_price_centimes),
      0n
    );

  const rowByCode = new Map(trialBalance.rows.map((row) => [row.code, row]));
  const accountingCashLedgerCentimes = getDebitBalanceCentimes(
    rowByCode.get("521000")
  );
  const tax = buildAfriTaxSummary(trialBalance);
  const moduleBreakdown = listAccountingModuleBreakdown.all().map((row) => ({
    moduleSource: row.module_source,
    entryCount: Number(row.entry_count ?? 0),
    volumeCentimes: BigInt(row.volume_centimes ?? 0).toString(),
  }));

  return {
    modulesConnected: [
      "WASI",
      "BANKING",
      "AFRITRADE",
      "AFRITAX",
      "DEX",
    ],
    journalEntriesCount,
    accountingCashLedgerCentimes:
      accountingCashLedgerCentimes.toString(),
    bankLiquidityCentimes: bankLiquidityCentimes.toString(),
    dexWalletLiquidityCentimes: dexWalletLiquidityCentimes.toString(),
    dexAumCentimes: dexAumCentimes.toString(),
    vatDueCentimes: tax.vatDueCentimes,
    moduleBreakdown,
  };
};

const buildComptaOverview = () => {
  const chart = buildComptaChart();
  const trialBalance = buildTrialBalanceSnapshot();
  const tax = buildAfriTaxSummary(trialBalance);
  const bridge = buildComptaBridgeSummary(trialBalance);
  const journal = buildRecentAccountingEntries(8);

  const revenueCentimes = BigInt(tax.revenueCentimes);
  const expenseCentimes = BigInt(tax.deductibleExpenseCentimes);
  const preTaxResultCentimes = BigInt(tax.preTaxResultCentimes);

  return {
    chart,
    journal,
    trialBalance: {
      ...trialBalance,
      rows: trialBalance.rows.slice(0, 18),
    },
    tax,
    bridge,
    summary: {
      activeAccountsCount: chart.accounts.length,
      journalEntriesCount: bridge.journalEntriesCount,
      revenueCentimes: revenueCentimes.toString(),
      expenseCentimes: expenseCentimes.toString(),
      preTaxResultCentimes: preTaxResultCentimes.toString(),
      isBalanced: trialBalance.totals.isBalanced,
    },
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

const insertBankingApproval = db.prepare(`
  INSERT INTO banking_operation_approvals (
    id, operation_type, status, initiated_by_user_id, initiated_by_username, initiated_by_role,
    approved_by_user_id, approved_by_username, account_id, from_account_id, to_account_id,
    amount_centimes, description, request_body_json, decision_note, created_at_utc,
    decided_at_utc, updated_at_utc
  ) VALUES (
    @id, @operationType, @status, @initiatedByUserId, @initiatedByUsername, @initiatedByRole,
    @approvedByUserId, @approvedByUsername, @accountId, @fromAccountId, @toAccountId,
    @amountCentimes, @description, @requestBodyJson, @decisionNote, @createdAtUtc,
    @decidedAtUtc, @updatedAtUtc
  )
`);

const getBankingApprovalById = db.prepare(`
  SELECT *
  FROM banking_operation_approvals
  WHERE id = ?
  LIMIT 1
`);

const listBankingApprovalsByStatus = db.prepare(`
  SELECT *
  FROM banking_operation_approvals
  WHERE status = ?
  ORDER BY created_at_utc DESC
  LIMIT ?
`);

const listBankingApprovalsByInitiator = db.prepare(`
  SELECT *
  FROM banking_operation_approvals
  WHERE initiated_by_user_id = ?
    AND status = ?
  ORDER BY created_at_utc DESC
  LIMIT ?
`);

const updateBankingApprovalDecision = db.prepare(`
  UPDATE banking_operation_approvals
  SET status = @status,
      approved_by_user_id = @approvedByUserId,
      approved_by_username = @approvedByUsername,
      decision_note = @decisionNote,
      decided_at_utc = @decidedAtUtc,
      updated_at_utc = @updatedAtUtc
  WHERE id = @id
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

const insertPlatformUser = db.prepare(`
  INSERT INTO platform_users (
    id, username, email, password_hash, role, tier, x402_balance, is_active, created_at_utc, updated_at_utc
  ) VALUES (
    @id, @username, @email, @passwordHash, @role, @tier, @x402Balance, 1, @createdAtUtc, @updatedAtUtc
  )
`);

const updatePlatformUserPasswordHash = db.prepare(`
  UPDATE platform_users
  SET password_hash = @passwordHash, updated_at_utc = @updatedAtUtc
  WHERE id = @id
`);

const getPlatformUserByUsername = db.prepare(`
  SELECT *
  FROM platform_users
  WHERE lower(username) = lower(?)
  LIMIT 1
`);

const getPlatformUserByEmail = db.prepare(`
  SELECT *
  FROM platform_users
  WHERE lower(email) = lower(?)
  LIMIT 1
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

const listSyscohadaAccounts = db.prepare(`
  SELECT code, label, class_number, category, kind, normal_side, statement_section
  FROM syscohada_accounts
  WHERE is_active = 1
  ORDER BY code ASC
`);

const getSyscohadaAccountByCode = db.prepare(`
  SELECT code, label, class_number, category, kind, normal_side, statement_section
  FROM syscohada_accounts
  WHERE code = ? AND is_active = 1
  LIMIT 1
`);

const listSyscohadaClassCounts = db.prepare(`
  SELECT class_number, COUNT(*) AS account_count
  FROM syscohada_accounts
  WHERE is_active = 1
  GROUP BY class_number
  ORDER BY class_number ASC
`);

const countAccountingJournalEntries = db.prepare(`
  SELECT COUNT(*) AS count
  FROM accounting_journal_entries
  WHERE status = 'POSTED'
`);

const listAccountingModuleBreakdown = db.prepare(`
  SELECT
    module_source,
    COUNT(*) AS entry_count,
    COALESCE(SUM(CAST(total_debit_centimes AS INTEGER)), 0) AS volume_centimes
  FROM accounting_journal_entries
  WHERE status = 'POSTED'
  GROUP BY module_source
  ORDER BY module_source ASC
`);

const listRecentAccountingEntries = db.prepare(`
  SELECT *
  FROM accounting_journal_entries
  WHERE status = 'POSTED'
  ORDER BY entry_date_utc DESC, created_at_utc DESC
  LIMIT ?
`);

const getAccountingEntryByReference = db.prepare(`
  SELECT *
  FROM accounting_journal_entries
  WHERE reference = ?
  LIMIT 1
`);

const listAccountingLinesByEntryId = db.prepare(`
  SELECT entry_id, account_code, line_label, debit_centimes, credit_centimes, created_at_utc
  FROM accounting_journal_lines
  WHERE entry_id = ?
  ORDER BY rowid ASC
`);

const listLedgerLinesByAccountCode = db.prepare(`
  SELECT
    l.entry_id,
    l.account_code,
    l.line_label,
    l.debit_centimes,
    l.credit_centimes,
    l.created_at_utc,
    e.reference,
    e.journal_code,
    e.module_source,
    e.description,
    e.entry_date_utc
  FROM accounting_journal_lines l
  INNER JOIN accounting_journal_entries e
    ON e.id = l.entry_id
  WHERE e.status = 'POSTED' AND l.account_code = ?
  ORDER BY e.entry_date_utc ASC, e.created_at_utc ASC, l.rowid ASC
`);

const insertAccountingEntry = db.prepare(`
  INSERT INTO accounting_journal_entries (
    id, reference, journal_code, module_source, description, entry_date_utc, status,
    total_debit_centimes, total_credit_centimes, created_at_utc, updated_at_utc
  ) VALUES (
    @id, @reference, @journalCode, @moduleSource, @description, @entryDateUtc, @status,
    @totalDebitCentimes, @totalCreditCentimes, @createdAtUtc, @updatedAtUtc
  )
`);

const insertAccountingLine = db.prepare(`
  INSERT INTO accounting_journal_lines (
    id, entry_id, account_code, line_label, debit_centimes, credit_centimes, created_at_utc
  ) VALUES (
    @id, @entryId, @accountCode, @lineLabel, @debitCentimes, @creditCentimes, @createdAtUtc
  )
`);

const listTrialBalanceRows = db.prepare(`
  SELECT
    a.code,
    a.label,
    a.class_number,
    a.category,
    a.kind,
    a.normal_side,
    a.statement_section,
    COALESCE(
      SUM(
        CASE
          WHEN e.id IS NOT NULL THEN CAST(l.debit_centimes AS INTEGER)
          ELSE 0
        END
      ),
      0
    ) AS total_debit_centimes,
    COALESCE(
      SUM(
        CASE
          WHEN e.id IS NOT NULL THEN CAST(l.credit_centimes AS INTEGER)
          ELSE 0
        END
      ),
      0
    ) AS total_credit_centimes
  FROM syscohada_accounts a
  LEFT JOIN accounting_journal_lines l
    ON l.account_code = a.code
  LEFT JOIN accounting_journal_entries e
    ON e.id = l.entry_id AND e.status = 'POSTED'
  WHERE a.is_active = 1
  GROUP BY
    a.code,
    a.label,
    a.class_number,
    a.category,
    a.kind,
    a.normal_side,
    a.statement_section
  ORDER BY a.code ASC
`);

const listAllBankAccounts = db.prepare(`
  SELECT id, holder, type, currency, balance_centimes
  FROM accounts
  ORDER BY holder ASC, type ASC
`);

const listAllDexWallets = db.prepare(`
  SELECT user_id, xof_balance_centimes
  FROM dex_wallets
  ORDER BY user_id ASC
`);

const listAllDexPositionsWithPrices = db.prepare(`
  SELECT p.user_id, p.symbol, p.quantity_units, t.last_price_centimes
  FROM dex_positions p
  INNER JOIN etf_tokens t ON t.symbol = p.symbol
  WHERE t.is_active = 1
  ORDER BY p.user_id ASC, p.symbol ASC
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

const getDemoUserByUsername = (username) => {
  if (!ALLOW_DEMO_CREDENTIALS) return null;
  return DEMO_USERS.find((user) => user.username.toLowerCase() === username.toLowerCase()) ?? null;
};

const serializePlatformUser = (row) => ({
  id: row.id,
  username: row.username,
  email: row.email,
  role: row.role,
  tier: row.tier,
  x402_balance: Number(row.x402_balance),
  is_active: Boolean(row.is_active),
  created_at: row.created_at_utc,
});

const getDefaultAccountIdsForRole = (role) =>
  role === ROLE_CLIENT
    ? [ACCOUNT_ID_MAIN, ACCOUNT_ID_SAVINGS]
    : [ACCOUNT_ID_MAIN, ACCOUNT_ID_SAVINGS, ACCOUNT_ID_BUSINESS];

const buildPlatformAuthUser = (platformUser, overrides = {}) => ({
  id: platformUser.id,
  username: platformUser.username,
  displayName: platformUser.username,
  role: platformUser.role,
  tier: platformUser.tier,
  x402_balance: Number(platformUser.x402_balance),
  email: platformUser.email,
  accountIds: getDefaultAccountIdsForRole(platformUser.role),
  ...overrides,
});

const authenticatePlatformUser = (username, password) => {
  const platformUser = getPlatformUserByUsername.get(String(username));
  if (!platformUser || Number(platformUser.is_active) !== 1) {
    return null;
  }

  const verification = verifyPassword(password, platformUser.password_hash);
  if (!verification.valid) {
    return null;
  }

  if (verification.needsRehash) {
    updatePlatformUserPasswordHash.run({
      id: platformUser.id,
      passwordHash: hashPassword(password),
      updatedAtUtc: new Date().toISOString(),
    });
    return getPlatformUserByUsername.get(platformUser.username);
  }

  return platformUser;
};

const signAccessToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      username: user.username,
      displayName: user.displayName ?? user.username,
      role: user.role ?? ROLE_CLIENT,
      accountIds: user.accountIds ?? [],
      tier: user.tier ?? "free",
      x402_balance: typeof user.x402_balance === "number" ? user.x402_balance : Number(user.x402_balance ?? 0),
      email: user.email ?? null,
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

const formatCentimeAmount = (amountCentimes) => {
  const amount = BigInt(amountCentimes);
  const whole = amount / 100n;
  const fraction = amount % 100n;
  return `${whole.toString()}.${fraction.toString().padStart(2, "0")} XOF`;
};

const createPendingApprovalPayload = ({
  req,
  operationType,
  amountCentimes,
  description,
  requestBody,
  accountId = null,
  fromAccountId = null,
  toAccountId = null,
}) => {
  const now = new Date().toISOString();
  const approvalId = randomUUID();
  insertBankingApproval.run({
    id: approvalId,
    operationType,
    status: APPROVAL_STATUS_PENDING,
    initiatedByUserId: req.authUser?.sub ?? "anonymous",
    initiatedByUsername: req.authUser?.username ?? null,
    initiatedByRole: req.authUser?.role ?? null,
    approvedByUserId: null,
    approvedByUsername: null,
    accountId,
    fromAccountId,
    toAccountId,
    amountCentimes: amountCentimes.toString(),
    description,
    requestBodyJson: JSON.stringify(requestBody ?? {}),
    decisionNote: null,
    createdAtUtc: now,
    decidedAtUtc: null,
    updatedAtUtc: now,
  });

  return {
    approval: serializeApproval(getBankingApprovalById.get(approvalId)),
    state: getState(100, req.authUser),
    message: `${operationType} pending manager approval for ${formatCentimeAmount(amountCentimes)}.`,
  };
};

const executeDepositOperation = ({ accountId, amount, note, authUser }) => {
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
    state: getState(100, authUser),
  };
};

const executeWithdrawOperation = ({ accountId, amount, note, authUser }) => {
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
    state: getState(100, authUser),
  };
};

const executeTransferOperation = ({
  fromAccountId,
  toAccountId,
  amount,
  note,
  authUser,
}) => {
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
    state: getState(100, authUser),
  };
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

const toIsoMonth = (offsetFromNow = 0) => {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - offsetFromNow);
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
};

const buildCountryIndicesSnapshot = () => {
  const marketRows = listEtfTokens.all();
  const priceBySymbol = new Map(marketRows.map((row) => [row.symbol, BigInt(row.last_price_centimes)]));
  const indices = {};

  for (const [countryCode, baseScore] of Object.entries(COUNTRY_BASE_SCORES)) {
    const symbol = COUNTRY_TO_ETF_SYMBOL[countryCode];
    const price = symbol ? priceBySymbol.get(symbol) : null;
    if (price) {
      const derived = Number(price / 10000n);
      indices[countryCode] = Math.max(35, Math.min(99, derived));
    } else {
      indices[countryCode] = baseScore;
    }
  }
  return indices;
};

const buildComposite = (indices) =>
  Object.entries(COUNTRY_WEIGHTS).reduce(
    (sum, [countryCode, weight]) => sum + (Number(indices[countryCode] ?? 50) * weight),
    0
  );

const buildIndicesHistory = (months = 12) => {
  const currentIndices = buildCountryIndicesSnapshot();
  const compositeNow = buildComposite(currentIndices);
  const safeMonths = Number.isFinite(months) ? Math.min(Math.max(months, 1), 120) : 12;
  const rows = [];
  for (let i = safeMonths - 1; i >= 0; i -= 1) {
    const seasonal = Math.sin((safeMonths - i) / 2.7) * 1.8;
    rows.push({
      period_date: toIsoMonth(i),
      composite_value: Math.round((compositeNow - i * 0.35 + seasonal) * 10) / 10,
      source: "wasi_platform_snapshot",
    });
  }
  return rows;
};

const buildCountryHistory = (countryCode, months = 12) => {
  const safeCode = String(countryCode || "").trim().toUpperCase();
  const safeMonths = Number.isFinite(months) ? Math.min(Math.max(months, 1), 120) : 12;
  const currentIndices = buildCountryIndicesSnapshot();
  const base = Number(currentIndices[safeCode] ?? COUNTRY_BASE_SCORES[safeCode] ?? 50);
  const noiseSeed = safeCode.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5;
  const rows = [];
  for (let i = safeMonths - 1; i >= 0; i -= 1) {
    const seasonal = Math.sin((safeMonths - i + noiseSeed) / 2.4) * 1.4;
    rows.push({
      country_code: safeCode,
      period_date: toIsoMonth(i),
      value: Math.round((base - i * 0.22 + seasonal) * 10) / 10,
      source: "wasi_platform_snapshot",
    });
  }
  return rows;
};

const buildLiveSignals = () => {
  const indices = buildCountryIndicesSnapshot();
  return Object.entries(indices).map(([countryCode, value]) => {
    const eventImpact = NEWS_EVENT_SNAPSHOT
      .filter((event) => event.country_code === countryCode)
      .reduce((sum, event) => sum + Number(event.impact || 0), 0);
    const adjusted = Math.max(30, Math.min(100, value + eventImpact));
    return {
      country_code: countryCode,
      country_name: COUNTRY_NAMES[countryCode] ?? countryCode,
      base_index: value,
      adjustment: Math.round(eventImpact * 10) / 10,
      adjusted_index: Math.round(adjusted * 10) / 10,
      signal: adjusted >= 80 ? "BULLISH" : adjusted >= 65 ? "STABLE" : "CAUTION",
      timestamp: new Date().toISOString(),
    };
  });
};

const buildMacroByCountry = (countryCode) => {
  const safeCode = String(countryCode || "").trim().toUpperCase();
  return {
    country_code: safeCode,
    source: "wasi_platform_snapshot",
    ...(MACRO_COUNTRY_SNAPSHOT[safeCode] ?? {
      gdp_growth: 4.2,
      inflation: 6.0,
      debt_to_gdp: 58.0,
      current_account: -4.0,
    }),
  };
};

const buildBankContext = (countryCode) => {
  const macro = buildMacroByCountry(countryCode);
  const risk =
    macro.inflation > 15 || macro.debt_to_gdp > 90 ? "HIGH" : macro.inflation > 7 ? "MEDIUM" : "LOW";
  return {
    country_code: macro.country_code,
    risk_level: risk,
    advisory: risk === "HIGH"
      ? "Tighten lending standards and require collateral buffers."
      : risk === "MEDIUM"
        ? "Prefer short tenor working-capital products."
        : "Stable credit environment for SME growth products.",
    policy_rate_reference: 4.5,
    source: "wasi_platform_snapshot",
    timestamp: new Date().toISOString(),
  };
};

const buildTransportComparison = (countryCode) => {
  const safeCode = String(countryCode || "").trim().toUpperCase();
  const base = Number(buildCountryIndicesSnapshot()[safeCode] ?? 60);
  const snapshot = TRANSPORT_COUNTRY_SNAPSHOT[safeCode] ?? null;
  const profile = snapshot?.profile ?? "COASTAL_MAJOR";
  const weights =
    TRANSPORT_PROFILE_WEIGHTS[profile] ??
    TRANSPORT_PROFILE_WEIGHTS.COASTAL_MAJOR;

  const maritimeIndex = clampTransportIndex(
    snapshot?.modes?.maritime ?? Math.round(base + 4)
  );
  const airIndex = clampTransportIndex(
    snapshot?.modes?.air ?? Math.round(base - 2)
  );
  const railIndex = clampTransportIndex(
    snapshot?.modes?.rail ?? Math.round(base - 10)
  );
  const roadIndex = clampTransportIndex(
    snapshot?.modes?.road ?? Math.round(base + 1)
  );

  const transportComposite = clampTransportIndex(
    maritimeIndex * weights.maritime +
      airIndex * weights.air +
      railIndex * weights.rail +
      roadIndex * weights.road
  );

  const nowIso = new Date().toISOString();
  return {
    country_code: safeCode,
    transport_composite: transportComposite,
    country_profile: profile,
    profile_weights: weights,
    effective_weights: weights,
    methodology_version: "road-air-rail-v1.1",
    data_mode: "snapshot",
    source: "wasi_transport_snapshot",
    source_note:
      "Road index from customs transit + hinterland + fuel proxy, with corridor quality grading.",
    timestamp: nowIso,
    last_updated: nowIso,
    modes: {
      maritime: {
        index: maritimeIndex,
        trend: deriveTransportTrend(maritimeIndex),
        source: defaultTransportModeSources.maritime.source,
        quality: defaultTransportModeSources.maritime.quality,
      },
      air: {
        index: airIndex,
        trend: deriveTransportTrend(airIndex),
        source: defaultTransportModeSources.air.source,
        quality: defaultTransportModeSources.air.quality,
      },
      rail: {
        index: railIndex,
        trend: deriveTransportTrend(railIndex),
        source: defaultTransportModeSources.rail.source,
        quality: defaultTransportModeSources.rail.quality,
      },
      road: {
        index: roadIndex,
        trend: deriveTransportTrend(roadIndex),
        source: snapshot?.roadSource ?? defaultTransportModeSources.road.source,
        quality: snapshot?.roadQuality ?? defaultTransportModeSources.road.quality,
      },
    },
  };
};

const buildUssdAggregateSummary = () => {
  const indices = buildCountryIndicesSnapshot();
  const average = Object.values(indices).reduce((sum, value) => sum + Number(value), 0) / Object.keys(indices).length;
  return {
    source: "wasi_platform_snapshot",
    timestamp: new Date().toISOString(),
    total_sessions_24h: 18234,
    repayment_intent_rate: 73.2,
    average_country_index: Math.round(average * 10) / 10,
    top_countries: Object.entries(indices)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, value]) => ({ country_code: code, score: value })),
  };
};

const buildChatResponse = (queryText) => {
  const indices = buildCountryIndicesSnapshot();
  const top = Object.entries(indices).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const composite = Math.round(buildComposite(indices) * 10) / 10;
  const content =
    `Point de situation WASI : composite ${composite}. ` +
    `Pays en tete : ${top.map(([code, value]) => `${code} ${value}`).join(", ")}. ` +
    `Question recue : "${queryText}".`;

  return {
    id: randomUUID(),
    model: "wasi-platform-analyst",
    content: [{ type: "text", text: content }],
    source: "wasi_platform_snapshot",
    timestamp: new Date().toISOString(),
  };
};

const clampChatMaxTokens = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_CHAT_MAX_TOKENS;
  return Math.min(Math.max(Math.trunc(parsed), 64), MAX_CHAT_MAX_TOKENS);
};

const extractMessageText = (content) => {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n");
  }
  return String(content ?? "");
};

const toAnthropicMessages = (messages, promptFallback = "") => {
  const normalized = (Array.isArray(messages) ? messages : [])
    .map((entry) => {
      const role = entry?.role === "assistant" ? "assistant" : "user";
      const content = extractMessageText(entry?.content).trim();
      return content ? { role, content } : null;
    })
    .filter(Boolean)
    .slice(-MAX_CHAT_MESSAGES);

  if (normalized.length > 0) {
    return normalized;
  }

  const fallback = String(promptFallback || "").trim();
  return fallback ? [{ role: "user", content: fallback }] : [];
};

const buildAnthropicChatResponse = async ({
  systemPrompt,
  messages,
  maxTokens,
}) => {
  const payload = {
    model: ANTHROPIC_MODEL,
    max_tokens: clampChatMaxTokens(maxTokens),
    messages,
  };

  const safeSystem = String(systemPrompt || "").trim();
  if (safeSystem) {
    payload.system = safeSystem.slice(0, 24000);
  }

  const upstreamResponse = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  });

  const body = await upstreamResponse.json().catch(() => null);
  if (!upstreamResponse.ok) {
    const reason =
      body?.error?.message ||
      body?.error?.type ||
      `HTTP ${upstreamResponse.status}`;
    throw new ApiError(502, `Anthropic API error: ${reason}`);
  }

  const text = Array.isArray(body?.content)
    ? body.content
        .map((part) => (part?.type === "text" ? String(part.text || "") : ""))
        .filter(Boolean)
        .join("\n\n")
        .trim()
    : "";

  if (!text) {
    throw new ApiError(502, "Anthropic API returned empty content.");
  }

  return {
    id: body?.id || randomUUID(),
    model: body?.model || ANTHROPIC_MODEL,
    content: [{ type: "text", text }],
    source: "anthropic_api",
    timestamp: new Date().toISOString(),
  };
};

const toOllamaMessages = (messages, promptFallback = "", systemPrompt = "") => {
  const normalized = [];
  const safeSystem = String(systemPrompt || "").trim();
  if (safeSystem) {
    normalized.push({
      role: "system",
      content: safeSystem.slice(0, 24000),
    });
  }

  const chatMessages = toAnthropicMessages(messages, promptFallback);
  for (const message of chatMessages) {
    normalized.push(message);
  }
  return normalized;
};

const buildOllamaChatResponse = async ({
  systemPrompt,
  messages,
  queryText,
  maxTokens,
}) => {
  const ollamaMessages = toOllamaMessages(messages, queryText, systemPrompt);
  if (!ollamaMessages.length) {
    throw new ApiError(400, "messages or prompt is required.");
  }

  const controller = new AbortController();
  const timeoutMs =
    Number.isFinite(OLLAMA_TIMEOUT_MS) && OLLAMA_TIMEOUT_MS > 1000
      ? OLLAMA_TIMEOUT_MS
      : 20000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstreamResponse = await fetch(OLLAMA_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: ollamaMessages,
        options: {
          num_predict: clampChatMaxTokens(maxTokens),
        },
      }),
    });

    const body = await upstreamResponse.json().catch(() => null);
    if (!upstreamResponse.ok) {
      const reason = body?.error || `HTTP ${upstreamResponse.status}`;
      throw new ApiError(502, `Ollama API error: ${reason}`);
    }

    const text = String(body?.message?.content || "").trim();
    if (!text) {
      throw new ApiError(502, "Ollama API returned empty content.");
    }

    return {
      id: body?.created_at || randomUUID(),
      model: body?.model || OLLAMA_MODEL,
      content: [{ type: "text", text }],
      source: "ollama_api",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new ApiError(504, "Ollama API timeout.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const buildProviderChatResponse = async ({
  systemPrompt,
  messages,
  queryText,
  maxTokens,
}) => {
  const normalizedMessages = toAnthropicMessages(messages, queryText);
  if (!normalizedMessages.length) {
    throw new ApiError(400, "messages or prompt is required.");
  }

  const tryAnthropic = async () => {
    if (!ANTHROPIC_API_KEY) {
      throw new ApiError(500, "ANTHROPIC_API_KEY is not configured.");
    }
    return buildAnthropicChatResponse({
      systemPrompt,
      messages: normalizedMessages,
      maxTokens,
    });
  };

  const tryOllama = async () =>
    buildOllamaChatResponse({
      systemPrompt,
      messages: normalizedMessages,
      queryText,
      maxTokens,
    });

  if (LLM_PROVIDER === "snapshot") {
    return buildChatResponse(queryText);
  }

  if (LLM_PROVIDER === "ollama") {
    return tryOllama();
  }

  if (LLM_PROVIDER === "anthropic") {
    try {
      return await tryAnthropic();
    } catch (_anthropicError) {
      return tryOllama();
    }
  }

  if (ANTHROPIC_API_KEY) {
    try {
      return await tryAnthropic();
    } catch (_anthropicError) {
      // fallback to Ollama below
    }
  }

  try {
    return await tryOllama();
  } catch (_ollamaError) {
    return buildChatResponse(queryText);
  }
};

app.get("/api/health", (_req, res) => {
  success(res, {
    service: "wasi-platform-api",
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: IS_PRODUCTION ? "production" : "development",
  });
});

app.post("/api/auth/register", (req, res, next) => {
  try {
    const username = String(req.body?.username || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!username || username.length < 3) {
      throw new ApiError(400, "username must contain at least 3 characters.");
    }
    if (!email || !email.includes("@")) {
      throw new ApiError(400, "email is invalid.");
    }
    if (!password || password.length < 8) {
      throw new ApiError(400, "password must contain at least 8 characters.");
    }
    if (getPlatformUserByUsername.get(username)) {
      throw new ApiError(409, "username already exists.");
    }
    if (getPlatformUserByEmail.get(email)) {
      throw new ApiError(409, "email already exists.");
    }

    const now = new Date().toISOString();
    const userId = randomUUID();
    insertPlatformUser.run({
      id: userId,
      username,
      email,
      passwordHash: hashPassword(password),
      role: ROLE_CLIENT,
      tier: "free",
      x402Balance: 10,
      createdAtUtc: now,
      updatedAtUtc: now,
    });

    const saved = getPlatformUserByUsername.get(username);
    writeAuditLog({
      actorOverride: { id: userId, username, role: ROLE_CLIENT },
      action: "REGISTER",
      resourceType: "AUTH",
      resourceId: userId,
      status: AUDIT_SUCCESS,
      detail: { email },
    });

    res.status(201).json(serializePlatformUser(saved));
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", (req, res, next) => {
  const username = String(req.body?.username || "").trim();
  try {
    const password = String(req.body?.password || "");
    if (!username || !password) {
      throw new ApiError(400, "username and password are required.");
    }

    assertAuthRateLimit(req, username);

    const platformUser = authenticatePlatformUser(username, password);
    if (platformUser) {
      clearAuthFailures(req, username);
      const accessToken = signAccessToken(buildPlatformAuthUser(platformUser));
      writeAuditLog({
        actorOverride: { id: platformUser.id, username: platformUser.username, role: platformUser.role },
        action: "LOGIN",
        resourceType: "AUTH",
        status: AUDIT_SUCCESS,
      });
      return res.json({ access_token: accessToken, token_type: "bearer" });
    }

    const demoUser = getDemoUserByUsername(username);
    if (!demoUser || demoUser.password !== password) {
      throw new ApiError(401, "Incorrect username or password");
    }

    clearAuthFailures(req, username);
    const accessToken = signAccessToken({
      ...demoUser,
      tier: "demo",
      x402_balance: 1000,
      email: `${demoUser.username}@wasi.local`,
    });
    writeAuditLog({
      actorOverride: { id: demoUser.id, username: demoUser.username, role: demoUser.role },
      action: "LOGIN",
      resourceType: "AUTH",
      status: AUDIT_SUCCESS,
      detail: { mode: "demo" },
    });
    return res.json({ access_token: accessToken, token_type: "bearer" });
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) {
      recordAuthFailure(req, username);
    }
    next(error);
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const user = {
    id: req.authUser.sub,
    username: req.authUser.username,
    email: req.authUser.email ?? null,
    role: req.authUser.role ?? ROLE_CLIENT,
    tier: req.authUser.tier ?? "free",
    x402_balance: Number(req.authUser.x402_balance ?? 0),
    is_active: true,
    created_at: null,
  };
  res.json(user);
});

app.post("/api/auth/refresh", requireAuth, (req, res, next) => {
  try {
    const currentUser = req.authUser;
    const platformUser = db
      .prepare("SELECT * FROM platform_users WHERE id = ?")
      .get(currentUser.sub);

    if (platformUser && !platformUser.is_active) {
      throw new ApiError(401, "Account deactivated.");
    }

    const freshToken = signAccessToken({
      id: currentUser.sub,
      username: currentUser.username,
      displayName: currentUser.displayName,
      role: platformUser ? platformUser.role : currentUser.role,
      accountIds: currentUser.accountIds ?? [],
      tier: platformUser ? platformUser.tier : (currentUser.tier ?? "free"),
      x402_balance: platformUser
        ? platformUser.x402_balance
        : (currentUser.x402_balance ?? 0),
      email: platformUser ? platformUser.email : (currentUser.email ?? null),
    });

    res.json({ access_token: freshToken, token_type: "bearer" });
  } catch (error) {
    next(error);
  }
});

// ── 2FA / TOTP Endpoints ──────────────────────────────────────────────────

const generateTotpSecret = () => randomBytes(20).toString("hex");

const computeTotp = (secret, timeStep = 30) => {
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / timeStep);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(0, 0);
  counterBuffer.writeUInt32BE(counter, 4);
  const { createHmac } = require("node:crypto");
  const hmac = createHmac("sha1", Buffer.from(secret, "hex")).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24 | hmac[offset + 1] << 16 | hmac[offset + 2] << 8 | hmac[offset + 3]) % 1000000;
  return code.toString().padStart(6, "0");
};

const verifyTotp = (secret, code, windowSize = 1) => {
  const epoch = Math.floor(Date.now() / 1000);
  for (let i = -windowSize; i <= windowSize; i++) {
    const counter = Math.floor(epoch / 30) + i;
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeUInt32BE(0, 0);
    counterBuffer.writeUInt32BE(counter, 4);
    const hmac = createHash("sha1");
    const { createHmac: cHmac } = require("node:crypto");
    const h = cHmac("sha1", Buffer.from(secret, "hex")).update(counterBuffer).digest();
    const offset = h[h.length - 1] & 0x0f;
    const c = ((h[offset] & 0x7f) << 24 | h[offset + 1] << 16 | h[offset + 2] << 8 | h[offset + 3]) % 1000000;
    if (c.toString().padStart(6, "0") === code) return true;
  }
  return false;
};

const base32Encode = (buffer) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let result = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    result += alphabet[parseInt(chunk, 2)];
  }
  return result;
};

app.post("/api/auth/2fa/setup", requireAuth, (req, res, next) => {
  try {
    const userId = req.authUser.sub;
    const existing = db.prepare("SELECT * FROM user_totp_secrets WHERE user_id = ?").get(userId);
    if (existing?.enabled) {
      throw new ApiError(400, "2FA is already enabled.");
    }

    const secret = generateTotpSecret();
    const secretBase32 = base32Encode(Buffer.from(secret, "hex"));
    const otpauthUrl = `otpauth://totp/WASI:${encodeURIComponent(req.authUser.username)}?secret=${secretBase32}&issuer=WASI&digits=6&period=30`;

    if (existing) {
      db.prepare("UPDATE user_totp_secrets SET secret = ?, enabled = 0, verified_at_utc = NULL, created_at_utc = ? WHERE user_id = ?")
        .run(secret, new Date().toISOString(), userId);
    } else {
      db.prepare("INSERT INTO user_totp_secrets (user_id, secret, enabled, created_at_utc) VALUES (?, ?, 0, ?)")
        .run(userId, secret, new Date().toISOString());
    }

    success(res, { otpauthUrl, secret: secretBase32 });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/2fa/verify", requireAuth, (req, res, next) => {
  try {
    const userId = req.authUser.sub;
    const code = String(req.body?.code || "").trim();
    if (!/^\d{6}$/.test(code)) {
      throw new ApiError(400, "Code must be 6 digits.");
    }

    const record = db.prepare("SELECT * FROM user_totp_secrets WHERE user_id = ?").get(userId);
    if (!record) {
      throw new ApiError(400, "Run /api/auth/2fa/setup first.");
    }

    if (!verifyTotp(record.secret, code)) {
      throw new ApiError(401, "Invalid TOTP code.");
    }

    db.prepare("UPDATE user_totp_secrets SET enabled = 1, verified_at_utc = ? WHERE user_id = ?")
      .run(new Date().toISOString(), userId);

    writeAuditLog({
      req,
      action: "2FA_ENABLED",
      resourceType: "AUTH",
      resourceId: userId,
      status: AUDIT_SUCCESS,
    });

    success(res, { enabled: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/2fa/disable", requireAuth, (req, res, next) => {
  try {
    const userId = req.authUser.sub;
    const code = String(req.body?.code || "").trim();
    if (!/^\d{6}$/.test(code)) {
      throw new ApiError(400, "Code must be 6 digits.");
    }

    const record = db.prepare("SELECT * FROM user_totp_secrets WHERE user_id = ?").get(userId);
    if (!record?.enabled) {
      throw new ApiError(400, "2FA is not enabled.");
    }

    if (!verifyTotp(record.secret, code)) {
      throw new ApiError(401, "Invalid TOTP code.");
    }

    db.prepare("DELETE FROM user_totp_secrets WHERE user_id = ?").run(userId);

    writeAuditLog({
      req,
      action: "2FA_DISABLED",
      resourceType: "AUTH",
      resourceId: userId,
      status: AUDIT_SUCCESS,
    });

    success(res, { disabled: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/2fa/status", requireAuth, (req, res) => {
  const record = db.prepare("SELECT enabled, verified_at_utc FROM user_totp_secrets WHERE user_id = ?").get(req.authUser.sub);
  res.json({ enabled: !!record?.enabled, verifiedAt: record?.verified_at_utc ?? null });
});

app.post("/api/chat", requireAuth, async (req, res, next) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const lastUserMessage = [...messages].reverse().find((message) => message?.role === "user");
    const queryText = extractMessageText(
      lastUserMessage?.content || req.body?.prompt || ""
    ).slice(0, 400);

    const responsePayload = await buildProviderChatResponse({
      systemPrompt: req.body?.system,
      messages,
      queryText,
      maxTokens: req.body?.max_tokens,
    });
    return res.json(responsePayload);
  } catch (error) {
    next(error);
  }
});

app.get("/api/v1/platform/snapshot", requireAuth, (_req, res, next) => {
  try {
    const indices = buildCountryIndicesSnapshot();
    const composite = Math.round(buildComposite(indices) * 10) / 10;
    success(res, {
      source: "wasi_platform_snapshot",
      data_mode: "snapshot",
      timestamp: new Date().toISOString(),
      indices,
      composite,
      markets: getDexMarkets(),
      commodities: COMMODITY_SNAPSHOT,
      liveSignals: buildLiveSignals(),
      newsEvents: NEWS_EVENT_SNAPSHOT,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/indices/latest", requireAuth, (_req, res, next) => {
  try {
    success(res, {
      indices: buildCountryIndicesSnapshot(),
      source: "wasi_platform_snapshot",
      data_mode: "snapshot",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/indices/history", requireAuth, (req, res, next) => {
  try {
    const months = Number(req.query.months ?? 12);
    res.json(buildIndicesHistory(months));
  } catch (error) {
    next(error);
  }
});

app.get("/api/country/:countryCode/history", requireAuth, (req, res, next) => {
  try {
    const countryCode = String(req.params.countryCode || "").trim().toUpperCase();
    const months = Number(req.query.months ?? 12);
    res.json(buildCountryHistory(countryCode, months));
  } catch (error) {
    next(error);
  }
});

app.get("/api/markets/latest", requireAuth, (_req, res, next) => {
  try {
    res.json({
      source: "wasi_platform_snapshot",
      data_mode: "snapshot",
      timestamp: new Date().toISOString(),
      markets: MARKET_BOARD_SNAPSHOT.map((market) => ({
        ...market,
        data_mode: "snapshot",
        provider: "wasi_market_snapshot",
      })),
      products: FINANCIAL_PRODUCTS_SNAPSHOT,
      coverage: {
        exchanges: ["BRVM", "NGX", "GSE", "UMOA Titres"],
        assetTypes: ["INDEX", "ETF", "BOND", "COMMODITY"],
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/markets/divergence", requireAuth, (_req, res, next) => {
  try {
    const indices = buildCountryIndicesSnapshot();
    const rows = Object.entries(indices)
      .map(([country_code, value]) => ({
        country_code,
        country_name: COUNTRY_NAMES[country_code] ?? country_code,
        divergence_score: Math.round((value - 70) * 10) / 10,
        trend: value >= 80 ? "OUTPERFORM" : value >= 65 ? "NEUTRAL" : "UNDERPERFORM",
      }))
      .sort((a, b) => b.divergence_score - a.divergence_score)
      .slice(0, 10);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/v2/signals/live", requireAuth, (_req, res, next) => {
  try {
    res.json({
      source: "wasi_platform_snapshot",
      data_mode: "snapshot",
      timestamp: new Date().toISOString(),
      signals: buildLiveSignals(),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/v2/signals/events", requireAuth, (_req, res, next) => {
  try {
    res.json({
      source: "wasi_platform_snapshot",
      data_mode: "snapshot",
      timestamp: new Date().toISOString(),
      events: NEWS_EVENT_SNAPSHOT,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/v2/data/commodities/latest", requireAuth, (req, res, next) => {
  try {
    const limit = Number(req.query.limit ?? 200);
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 200;
    res.json({
      source: "wasi_platform_snapshot",
      data_mode: "snapshot",
      timestamp: new Date().toISOString(),
      prices: COMMODITY_SNAPSHOT.slice(0, safeLimit),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/v2/data/macro/:countryCode", requireAuth, (req, res, next) => {
  try {
    const countryCode = String(req.params.countryCode || "").trim().toUpperCase();
    res.json(buildMacroByCountry(countryCode));
  } catch (error) {
    next(error);
  }
});

app.get("/api/v2/bank/credit-context/:countryCode", requireAuth, (req, res, next) => {
  try {
    const countryCode = String(req.params.countryCode || "").trim().toUpperCase();
    res.json(buildBankContext(countryCode));
  } catch (error) {
    next(error);
  }
});

app.get("/api/v2/transport/mode-comparison/:countryCode", requireAuth, (req, res, next) => {
  try {
    const countryCode = String(req.params.countryCode || "").trim().toUpperCase();
    res.json(buildTransportComparison(countryCode));
  } catch (error) {
    next(error);
  }
});

app.get("/api/ussd/aggregate/summary", requireAuth, (_req, res, next) => {
  try {
    res.json(buildUssdAggregateSummary());
  } catch (error) {
    next(error);
  }
});

app.post("/api/v1/banking/auth/login", (req, res, next) => {
  const username = String(req.body?.username || "").trim();
  try {
    const password = String(req.body?.password || "");
    if (!username || !password) {
      throw new ApiError(400, "username and password are required.");
    }

    assertAuthRateLimit(req, username);

    const platformUser = authenticatePlatformUser(username, password);
    if (platformUser) {
      clearAuthFailures(req, username);
      const accessToken = signAccessToken(buildPlatformAuthUser(platformUser));
      writeAuditLog({
        actorOverride: { id: platformUser.id, username: platformUser.username, role: platformUser.role },
        action: "LOGIN",
        resourceType: "AUTH",
        status: AUDIT_SUCCESS,
        detail: { tokenExpiresIn: JWT_EXPIRES_IN },
      });
      success(res, {
        accessToken,
        tokenType: "Bearer",
        user: {
          id: platformUser.id,
          username: platformUser.username,
          displayName: platformUser.username,
          role: platformUser.role,
          accountIds: [ACCOUNT_ID_MAIN, ACCOUNT_ID_SAVINGS],
        },
      });
      return;
    }

    const user = getDemoUserByUsername(username);
    if (!user || user.password !== password) {
      writeAuditLog({
        actorOverride: { id: "anonymous", username, role: null },
        action: "LOGIN",
        resourceType: "AUTH",
        status: AUDIT_FAILURE,
        detail: { reason: "Invalid credentials." },
      });
      throw new ApiError(401, "Invalid credentials.");
    }

    clearAuthFailures(req, username);
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
    if (error instanceof ApiError && error.statusCode === 401) {
      recordAuthFailure(req, username);
    }
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
    tier: req.authUser.tier ?? "free",
    x402_balance: Number(req.authUser.x402_balance ?? 0),
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
            if (
              req.authUser?.role === ROLE_TELLER &&
              amount >= BANKING_APPROVAL_THRESHOLD_CENTIMES
            ) {
              return createPendingApprovalPayload({
                req,
                operationType: "DEPOSIT",
                amountCentimes: amount,
                description: note,
                requestBody: { accountId, amountCentimes: amount.toString(), description: note },
                accountId,
              });
            }

            return executeDepositOperation({
              accountId,
              amount,
              note,
              authUser: req.authUser,
            });
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
            if (
              req.authUser?.role === ROLE_TELLER &&
              amount >= BANKING_APPROVAL_THRESHOLD_CENTIMES
            ) {
              return createPendingApprovalPayload({
                req,
                operationType: "WITHDRAW",
                amountCentimes: amount,
                description: note,
                requestBody: { accountId, amountCentimes: amount.toString(), description: note },
                accountId,
              });
            }

            return executeWithdrawOperation({
              accountId,
              amount,
              note,
              authUser: req.authUser,
            });
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

app.post("/api/v1/banking/transfer", requireAuth, bankingRateLimit, (req, res, next) => {
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
    if (currentRole === ROLE_CLIENT && amount > CLIENT_TRANSFER_MAX_CENTIMES) {
      throw new ApiError(
        403,
        `Client transfer limit exceeded. Maximum allowed is ${formatCentimeAmount(
          CLIENT_TRANSFER_MAX_CENTIMES
        )}.`
      );
    }
    const note =
      typeof description === "string" && description.trim()
        ? description.trim()
        : "Internal transfer";

    const result = executeIdempotentMutation({
      req,
      mutate: () => {
        if (
          req.authUser?.role === ROLE_TELLER &&
          amount >= BANKING_APPROVAL_THRESHOLD_CENTIMES
        ) {
          return createPendingApprovalPayload({
            req,
            operationType: "TRANSFER",
            amountCentimes: amount,
            description: note,
            requestBody: {
              fromAccountId,
              toAccountId,
              amountCentimes: amount.toString(),
              description: note,
            },
            fromAccountId,
            toAccountId,
          });
        }

        return executeTransferOperation({
          fromAccountId,
          toAccountId,
          amount,
          note,
          authUser: req.authUser,
        });
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

    if (amount >= ALERT_THRESHOLDS.LARGE_TRANSFER_CENTIMES) {
      raiseAlert({
        alertType: "LARGE_TRANSFER",
        severity: "WARNING",
        message: `Large transfer of ${formatCentimeAmount(amount)} from ${fromAccountId} to ${toAccountId}`,
        userId: req.authUser.sub,
        detail: { fromAccountId, toAccountId, amountCentimes: amount.toString() },
      });
    }

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

app.get(
  "/api/v1/banking/approvals",
  requireAuth,
  requireRoles([ROLE_MANAGER]),
  (req, res, next) => {
    try {
      const rawStatus = String(req.query.status || APPROVAL_STATUS_PENDING)
        .trim()
        .toUpperCase();
      const status = [
        APPROVAL_STATUS_PENDING,
        APPROVAL_STATUS_APPROVED,
        APPROVAL_STATUS_REJECTED,
      ].includes(rawStatus)
        ? rawStatus
        : APPROVAL_STATUS_PENDING;
      const limit = Number(req.query.limit ?? 100);
      const safeLimit = Number.isFinite(limit)
        ? Math.min(Math.max(limit, 1), 500)
        : 100;
      const approvals = listBankingApprovalsByStatus
        .all(status, safeLimit)
        .map(serializeApproval);
      success(res, { approvals });
    } catch (error) {
      next(error);
    }
  }
);

app.get("/api/v1/banking/my-approvals", requireAuth, (req, res, next) => {
  try {
    const rawStatus = String(req.query.status || APPROVAL_STATUS_PENDING)
      .trim()
      .toUpperCase();
    const status = [
      APPROVAL_STATUS_PENDING,
      APPROVAL_STATUS_APPROVED,
      APPROVAL_STATUS_REJECTED,
    ].includes(rawStatus)
      ? rawStatus
      : APPROVAL_STATUS_PENDING;
    const limit = Number(req.query.limit ?? 100);
    const safeLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 500)
      : 100;
    const approvals = listBankingApprovalsByInitiator
      .all(req.authUser?.sub ?? "", status, safeLimit)
      .map(serializeApproval);
    success(res, { approvals });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/v1/banking/approvals/:approvalId/approve",
  requireAuth,
  requireRoles([ROLE_MANAGER]),
  (req, res, next) => {
    try {
      const approvalId = String(req.params.approvalId || "").trim();
      if (!approvalId) {
        throw new ApiError(400, "approvalId is required.");
      }

      const result = executeIdempotentMutation({
        req,
        mutate: () => {
          const approval = getBankingApprovalById.get(approvalId);
          if (!approval) {
            throw new ApiError(404, "Approval not found.");
          }
          if (approval.status !== APPROVAL_STATUS_PENDING) {
            throw new ApiError(400, "Approval is no longer pending.");
          }
          if (approval.initiated_by_user_id === req.authUser?.sub) {
            throw new ApiError(403, "Maker-checker violation: self-approval is not allowed.");
          }

          const requestBody = JSON.parse(approval.request_body_json || "{}");
          const amount = BigInt(approval.amount_centimes);
          const now = new Date().toISOString();
          let operationResult;

          if (approval.operation_type === "DEPOSIT") {
            operationResult = executeDepositOperation({
              accountId: approval.account_id,
              amount,
              note: approval.description,
              authUser: req.authUser,
            });
          } else if (approval.operation_type === "WITHDRAW") {
            operationResult = executeWithdrawOperation({
              accountId: approval.account_id,
              amount,
              note: approval.description,
              authUser: req.authUser,
            });
          } else if (approval.operation_type === "TRANSFER") {
            operationResult = executeTransferOperation({
              fromAccountId: approval.from_account_id,
              toAccountId: approval.to_account_id,
              amount,
              note: approval.description,
              authUser: req.authUser,
            });
          } else {
            throw new ApiError(400, "Unsupported approval type.");
          }

          updateBankingApprovalDecision.run({
            id: approvalId,
            status: APPROVAL_STATUS_APPROVED,
            approvedByUserId: req.authUser?.sub ?? null,
            approvedByUsername: req.authUser?.username ?? null,
            decisionNote: String(req.body?.decisionNote || "Approved").trim(),
            decidedAtUtc: now,
            updatedAtUtc: now,
          });

          return {
            approval: serializeApproval(getBankingApprovalById.get(approvalId)),
            requestBody,
            ...operationResult,
          };
        },
      });

      if (result.replayed) {
        res.set("X-Idempotency-Replayed", "true");
      }

      writeAuditLog({
        req,
        action: "APPROVAL_APPROVE",
        resourceType: "BANKING_APPROVAL",
        resourceId: approvalId,
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
        action: "APPROVAL_APPROVE",
        resourceType: "BANKING_APPROVAL",
        resourceId: req.params?.approvalId ?? null,
        status: AUDIT_FAILURE,
        detail: {
          reason: error.message,
        },
      });
      next(error);
    }
  }
);

app.post(
  "/api/v1/banking/approvals/:approvalId/reject",
  requireAuth,
  requireRoles([ROLE_MANAGER]),
  (req, res, next) => {
    try {
      const approvalId = String(req.params.approvalId || "").trim();
      if (!approvalId) {
        throw new ApiError(400, "approvalId is required.");
      }

      const result = executeIdempotentMutation({
        req,
        mutate: () => {
          const approval = getBankingApprovalById.get(approvalId);
          if (!approval) {
            throw new ApiError(404, "Approval not found.");
          }
          if (approval.status !== APPROVAL_STATUS_PENDING) {
            throw new ApiError(400, "Approval is no longer pending.");
          }
          if (approval.initiated_by_user_id === req.authUser?.sub) {
            throw new ApiError(403, "Maker-checker violation: self-rejection is not allowed.");
          }

          const now = new Date().toISOString();
          updateBankingApprovalDecision.run({
            id: approvalId,
            status: APPROVAL_STATUS_REJECTED,
            approvedByUserId: req.authUser?.sub ?? null,
            approvedByUsername: req.authUser?.username ?? null,
            decisionNote: String(req.body?.decisionNote || "Rejected").trim(),
            decidedAtUtc: now,
            updatedAtUtc: now,
          });

          return {
            approval: serializeApproval(getBankingApprovalById.get(approvalId)),
            state: getState(100, req.authUser),
          };
        },
      });

      if (result.replayed) {
        res.set("X-Idempotency-Replayed", "true");
      }

      writeAuditLog({
        req,
        action: "APPROVAL_REJECT",
        resourceType: "BANKING_APPROVAL",
        resourceId: approvalId,
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
        action: "APPROVAL_REJECT",
        resourceType: "BANKING_APPROVAL",
        resourceId: req.params?.approvalId ?? null,
        status: AUDIT_FAILURE,
        detail: {
          reason: error.message,
        },
      });
      next(error);
    }
  }
);

app.get("/api/v1/compta/overview", requireAuth, (req, res, next) => {
  try {
    success(res, buildComptaOverview());
  } catch (error) {
    next(error);
  }
});

app.get("/api/v1/compta/chart", requireAuth, (_req, res, next) => {
  try {
    success(res, buildComptaChart());
  } catch (error) {
    next(error);
  }
});

app.get("/api/v1/compta/journal", requireAuth, (req, res, next) => {
  try {
    const limit = Number(req.query.limit ?? 20);
    success(res, {
      entries: buildRecentAccountingEntries(limit),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/v1/compta/trial-balance", requireAuth, (_req, res, next) => {
  try {
    success(res, buildTrialBalanceSnapshot());
  } catch (error) {
    next(error);
  }
});

app.get("/api/v1/compta/ledger", requireAuth, (req, res, next) => {
  try {
    const accountCode = String(req.query.accountCode || "").trim();
    const limit = Number(req.query.limit ?? 200);
    if (!accountCode) {
      throw new ApiError(400, "accountCode is required.");
    }
    success(res, buildLedgerSnapshot(accountCode, limit));
  } catch (error) {
    next(error);
  }
});

app.get("/api/v1/compta/statements", requireAuth, (_req, res, next) => {
  try {
    const trialBalance = buildTrialBalanceSnapshot();
    success(res, {
      ...buildComptaStatements(trialBalance),
      tax: buildAfriTaxSummary(trialBalance),
      bridge: buildComptaBridgeSummary(trialBalance),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/v1/compta/bridge/summary", requireAuth, (_req, res, next) => {
  try {
    success(res, buildComptaBridgeSummary());
  } catch (error) {
    next(error);
  }
});

app.get("/api/v1/afritax/summary", requireAuth, (_req, res, next) => {
  try {
    const trialBalance = buildTrialBalanceSnapshot();
    success(res, {
      ...buildAfriTaxSummary(trialBalance),
      bridge: buildComptaBridgeSummary(trialBalance),
    });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/v1/compta/journal",
  requireAuth,
  requireRoles([ROLE_TELLER, ROLE_MANAGER]),
  (req, res, next) => {
    try {
      const rawReference = String(req.body?.reference || "").trim();
      const rawJournalCode = String(req.body?.journalCode || "OD")
        .trim()
        .toUpperCase();
      const rawDescription = String(req.body?.description || "").trim();
      const rawModuleSource = String(req.body?.moduleSource || "MANUAL")
        .trim()
        .toUpperCase();
      const rawEntryDateUtc = String(
        req.body?.entryDateUtc || new Date().toISOString()
      ).trim();
      const linesInput = Array.isArray(req.body?.lines) ? req.body.lines : [];

      if (!rawDescription) {
        throw new ApiError(400, "description is required.");
      }
      if (linesInput.length < 2) {
        throw new ApiError(400, "At least two journal lines are required.");
      }

      const allowedModuleSources = new Set([
        "BANKING",
        "WASI",
        "AFRITRADE",
        "AFRITAX",
        "DEX",
        "MANUAL",
      ]);
      if (!allowedModuleSources.has(rawModuleSource)) {
        throw new ApiError(400, "moduleSource is invalid.");
      }
      const allowedJournalCodes = new Set([
        "AC",
        "VT",
        "BQ",
        "CA",
        "OD",
        "AN",
        "EX",
      ]);
      if (!allowedJournalCodes.has(rawJournalCode)) {
        throw new ApiError(400, "journalCode is invalid.");
      }

      const parsedEntryDate = new Date(rawEntryDateUtc);
      if (Number.isNaN(parsedEntryDate.getTime())) {
        throw new ApiError(400, "entryDateUtc must be a valid ISO-8601 date.");
      }
      const entryDateUtc = parsedEntryDate.toISOString();

      const normalizedLines = linesInput.map((line, index) => {
        const accountCode = String(line?.accountCode || "").trim();
        const lineLabel = String(line?.lineLabel || "").trim();
        if (!accountCode) {
          throw new ApiError(
            400,
            `lines[${index}].accountCode is required.`
          );
        }
        const account = getSyscohadaAccountByCode.get(accountCode);
        if (!account) {
          throw new ApiError(
            404,
            `Unknown SYSCOHADA account: ${accountCode}.`
          );
        }

        const debitCentimes = parseNonNegativeAmountCentimes(
          line?.debitCentimes ?? "0",
          `lines[${index}].debitCentimes`
        );
        const creditCentimes = parseNonNegativeAmountCentimes(
          line?.creditCentimes ?? "0",
          `lines[${index}].creditCentimes`
        );

        if (
          (debitCentimes === 0n && creditCentimes === 0n) ||
          (debitCentimes > 0n && creditCentimes > 0n)
        ) {
          throw new ApiError(
            400,
            `lines[${index}] must contain either a debit or a credit amount.`
          );
        }

        return {
          accountCode,
          lineLabel: lineLabel || account.label,
          debitCentimes: debitCentimes.toString(),
          creditCentimes: creditCentimes.toString(),
        };
      });

      const totalDebitCentimes = sumEntryLineDebits(normalizedLines);
      const totalCreditCentimes = sumEntryLineCredits(normalizedLines);
      if (totalDebitCentimes === 0n || totalCreditCentimes === 0n) {
        throw new ApiError(400, "A journal entry must carry a non-zero amount.");
      }
      if (totalDebitCentimes !== totalCreditCentimes) {
        throw new ApiError(400, "Journal entry is not balanced.");
      }

      const result = executeIdempotentMutation({
        req,
        mutate: () => {
          const reference =
            rawReference ||
            `MAN-${new Date()
              .toISOString()
              .replace(/[-:TZ.]/g, "")
              .slice(0, 14)}`;

          if (getAccountingEntryByReference.get(reference)) {
            throw new ApiError(409, "reference already exists.");
          }

          const now = new Date().toISOString();
          const entryId = randomUUID();
          const postEntry = db.transaction(() => {
            insertAccountingEntry.run({
              id: entryId,
              reference,
              journalCode: rawJournalCode,
              moduleSource: rawModuleSource,
              description: rawDescription,
              entryDateUtc,
              status: "POSTED",
              totalDebitCentimes: totalDebitCentimes.toString(),
              totalCreditCentimes: totalCreditCentimes.toString(),
              createdAtUtc: now,
              updatedAtUtc: now,
            });

            for (const line of normalizedLines) {
              insertAccountingLine.run({
                id: randomUUID(),
                entryId,
                accountCode: line.accountCode,
                lineLabel: line.lineLabel,
                debitCentimes: line.debitCentimes,
                creditCentimes: line.creditCentimes,
                createdAtUtc: now,
              });
            }

            return {
              ...serializeAccountingEntry({
                id: entryId,
                reference,
                journal_code: rawJournalCode,
                module_source: rawModuleSource,
                description: rawDescription,
                entry_date_utc: entryDateUtc,
                status: "POSTED",
                total_debit_centimes: totalDebitCentimes.toString(),
                total_credit_centimes: totalCreditCentimes.toString(),
                created_at_utc: now,
                updated_at_utc: now,
              }),
              lines: listAccountingLinesByEntryId
                .all(entryId)
                .map(serializeAccountingLine),
            };
          });

          return {
            entry: postEntry(),
            overview: buildComptaOverview(),
          };
        },
      });

      if (result.replayed) {
        res.set("X-Idempotency-Replayed", "true");
      }

      writeAuditLog({
        req,
        action: "COMPTA_JOURNAL_POST",
        resourceType: "ACCOUNTING_ENTRY",
        resourceId: result.payload.entry?.id ?? null,
        status: AUDIT_SUCCESS,
        detail: {
          reference: result.payload.entry?.reference ?? rawReference ?? null,
          journalCode: rawJournalCode,
          moduleSource: rawModuleSource,
          idempotencyKey: result.idempotencyKey,
          replayed: result.replayed,
        },
      });

      success(res, result.payload, result.statusCode);
    } catch (error) {
      writeAuditLog({
        req,
        action: "COMPTA_JOURNAL_POST",
        resourceType: "ACCOUNTING_ENTRY",
        resourceId: null,
        status: AUDIT_FAILURE,
        detail: {
          reason: error.message,
          reference: req.body?.reference ?? null,
        },
      });
      next(error);
    }
  }
);

app.get("/api/v1/dex/markets", requireAuth, (_req, res, next) => {
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

app.get("/api/v1/dex/orderbook/:symbol", requireAuth, (req, res, next) => {
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

app.post("/api/v1/dex/orders", requireAuth, bankingRateLimit, (req, res, next) => {
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

// ── Audit Dashboard API ─────────────────────────────────────────────────────

app.get(
  "/api/v1/admin/audit/summary",
  requireAuth,
  requireRoles([ROLE_MANAGER]),
  (_req, res, next) => {
    try {
      const totalEntries = db
        .prepare("SELECT COUNT(*) AS count FROM audit_log")
        .get().count;
      const failureCount = db
        .prepare("SELECT COUNT(*) AS count FROM audit_log WHERE status = 'FAILURE'")
        .get().count;
      const last24h = db
        .prepare(
          "SELECT COUNT(*) AS count FROM audit_log WHERE created_at_utc > datetime('now', '-1 day')"
        )
        .get().count;
      const topActions = db
        .prepare(
          `SELECT action, status, COUNT(*) AS count FROM audit_log
           GROUP BY action, status ORDER BY count DESC LIMIT 20`
        )
        .all();
      const recentFailures = db
        .prepare(
          `SELECT * FROM audit_log WHERE status = 'FAILURE'
           ORDER BY created_at_utc DESC LIMIT 20`
        )
        .all()
        .map(serializeAuditEntry);
      success(res, {
        totalEntries,
        failureCount,
        last24h,
        topActions,
        recentFailures,
      });
    } catch (error) {
      next(error);
    }
  }
);

app.get(
  "/api/v1/admin/audit/search",
  requireAuth,
  requireRoles([ROLE_MANAGER]),
  (req, res, next) => {
    try {
      const action = req.query.action ? String(req.query.action).trim().toUpperCase() : null;
      const userId = req.query.user_id ? String(req.query.user_id).trim() : null;
      const status = req.query.status ? String(req.query.status).trim().toUpperCase() : null;
      const limit = Math.min(Math.max(Number(req.query.limit ?? 100), 1), 500);

      let sql = "SELECT * FROM audit_log WHERE 1=1";
      const params = [];
      if (action) { sql += " AND action = ?"; params.push(action); }
      if (userId) { sql += " AND actor_user_id = ?"; params.push(userId); }
      if (status) { sql += " AND status = ?"; params.push(status); }
      sql += " ORDER BY created_at_utc DESC LIMIT ?";
      params.push(limit);

      const entries = db.prepare(sql).all(...params).map(serializeAuditEntry);
      success(res, { entries });
    } catch (error) {
      next(error);
    }
  }
);

// ── Transaction Export (CSV) ────────────────────────────────────────────────

app.get("/api/v1/banking/transactions/export", requireAuth, (req, res, next) => {
  try {
    const format = String(req.query.format ?? "csv").toLowerCase();
    const limit = Math.min(Math.max(Number(req.query.limit ?? 500), 1), 5000);
    const userId = req.authUser.sub;

    const accountIds = db
      .prepare("SELECT id FROM accounts WHERE holder = ?")
      .all(userId)
      .map((row) => row.id);

    if (accountIds.length === 0) {
      throw new ApiError(404, "No accounts found.");
    }

    const placeholders = accountIds.map(() => "?").join(",");
    const transactions = db
      .prepare(
        `SELECT t.*, a.holder, a.currency FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         WHERE t.account_id IN (${placeholders})
         ORDER BY t.created_at_utc DESC LIMIT ?`
      )
      .all(...accountIds, limit);

    if (format === "csv") {
      const header = "id,account_id,kind,amount_centimes,description,transfer_group_id,created_at_utc";
      const rows = transactions.map(
        (t) =>
          `${t.id},${t.account_id},${t.kind},${t.amount_centimes},"${(t.description || "").replace(/"/g, '""')}",${t.transfer_group_id || ""},${t.created_at_utc}`
      );
      const csv = [header, ...rows].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="wasi_transactions_${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
    } else {
      success(res, { transactions });
    }
  } catch (error) {
    next(error);
  }
});

// ── Admin: User Management (RBAC) ──────────────────────────────────────────

app.get(
  "/api/v1/admin/users",
  requireAuth,
  requireRoles([ROLE_MANAGER]),
  (req, res, next) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit ?? 100), 1), 500);
      const users = db
        .prepare(
          `SELECT id, username, email, role, tier, is_active, created_at_utc, updated_at_utc
           FROM platform_users ORDER BY created_at_utc DESC LIMIT ?`
        )
        .all(limit);
      success(res, { users });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/v1/admin/users/:userId/role",
  requireAuth,
  requireRoles([ROLE_MANAGER]),
  (req, res, next) => {
    try {
      const targetUserId = String(req.params.userId).trim();
      const newRole = String(req.body?.role || "").trim().toUpperCase();
      if (![ROLE_CLIENT, ROLE_TELLER, ROLE_MANAGER].includes(newRole)) {
        throw new ApiError(400, "Invalid role. Must be CLIENT, TELLER, or MANAGER.");
      }
      if (targetUserId === req.authUser.sub) {
        throw new ApiError(400, "Cannot change your own role.");
      }

      const user = db
        .prepare("SELECT id, username, role FROM platform_users WHERE id = ?")
        .get(targetUserId);
      if (!user) {
        throw new ApiError(404, "User not found.");
      }

      const oldRole = user.role;
      db.prepare(
        "UPDATE platform_users SET role = ?, updated_at_utc = ? WHERE id = ?"
      ).run(newRole, new Date().toISOString(), targetUserId);

      writeAuditLog({
        req,
        action: "ADMIN_ROLE_CHANGE",
        resourceType: "PLATFORM_USER",
        resourceId: targetUserId,
        status: AUDIT_SUCCESS,
        detail: { username: user.username, oldRole, newRole },
      });

      success(res, { userId: targetUserId, username: user.username, oldRole, newRole });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/v1/admin/users/:userId/status",
  requireAuth,
  requireRoles([ROLE_MANAGER]),
  (req, res, next) => {
    try {
      const targetUserId = String(req.params.userId).trim();
      const isActive = req.body?.is_active === true || req.body?.is_active === 1 ? 1 : 0;

      if (targetUserId === req.authUser.sub) {
        throw new ApiError(400, "Cannot deactivate your own account.");
      }

      const user = db
        .prepare("SELECT id, username FROM platform_users WHERE id = ?")
        .get(targetUserId);
      if (!user) {
        throw new ApiError(404, "User not found.");
      }

      db.prepare(
        "UPDATE platform_users SET is_active = ?, updated_at_utc = ? WHERE id = ?"
      ).run(isActive, new Date().toISOString(), targetUserId);

      writeAuditLog({
        req,
        action: isActive ? "ADMIN_USER_ACTIVATE" : "ADMIN_USER_DEACTIVATE",
        resourceType: "PLATFORM_USER",
        resourceId: targetUserId,
        status: AUDIT_SUCCESS,
        detail: { username: user.username, is_active: isActive },
      });

      success(res, { userId: targetUserId, username: user.username, is_active: isActive });
    } catch (error) {
      next(error);
    }
  }
);

// ── Notifications: Security Alerts ──────────────────────────────────────────

const ALERT_THRESHOLDS = {
  LARGE_TRANSFER_CENTIMES: BigInt(process.env.ALERT_LARGE_TRANSFER_CENTIMES ?? "10000000"),
  FAILED_LOGIN_SPIKE: Number(process.env.ALERT_FAILED_LOGIN_SPIKE ?? 3),
};

db.exec(`
  CREATE TABLE IF NOT EXISTS security_alerts (
    id TEXT PRIMARY KEY,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('INFO','WARNING','CRITICAL')),
    message TEXT NOT NULL,
    user_id TEXT,
    detail_json TEXT,
    acknowledged INTEGER NOT NULL DEFAULT 0,
    created_at_utc TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_security_alerts_created
  ON security_alerts(created_at_utc DESC);
`);

const insertAlert = db.prepare(`
  INSERT INTO security_alerts (id, alert_type, severity, message, user_id, detail_json, created_at_utc)
  VALUES (@id, @alertType, @severity, @message, @userId, @detailJson, @createdAtUtc)
`);

const raiseAlert = ({ alertType, severity, message, userId = null, detail = null }) => {
  try {
    insertAlert.run({
      id: randomUUID(),
      alertType,
      severity,
      message,
      userId,
      detailJson: detail ? JSON.stringify(detail) : null,
      createdAtUtc: new Date().toISOString(),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("alert_write_failed", error.message);
  }
};

app.get(
  "/api/v1/admin/alerts",
  requireAuth,
  requireRoles([ROLE_MANAGER]),
  (req, res, next) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);
      const unacknowledgedOnly = req.query.unread === "true";
      const sql = unacknowledgedOnly
        ? "SELECT * FROM security_alerts WHERE acknowledged = 0 ORDER BY created_at_utc DESC LIMIT ?"
        : "SELECT * FROM security_alerts ORDER BY created_at_utc DESC LIMIT ?";
      const alerts = db.prepare(sql).all(limit);
      success(res, { alerts });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/v1/admin/alerts/:alertId/acknowledge",
  requireAuth,
  requireRoles([ROLE_MANAGER]),
  (req, res, next) => {
    try {
      const alertId = String(req.params.alertId).trim();
      const result = db
        .prepare("UPDATE security_alerts SET acknowledged = 1 WHERE id = ?")
        .run(alertId);
      if (result.changes === 0) {
        throw new ApiError(404, "Alert not found.");
      }
      success(res, { acknowledged: true });
    } catch (error) {
      next(error);
    }
  }
);

// ── Health / Status Dashboard ───────────────────────────────────────────────

app.get("/api/v1/platform/health", (_req, res, next) => {
  try {
    const userCount = db
      .prepare("SELECT COUNT(*) AS count FROM platform_users")
      .get().count;
    const accountCount = db
      .prepare("SELECT COUNT(*) AS count FROM accounts")
      .get().count;
    const transactionCount = db
      .prepare("SELECT COUNT(*) AS count FROM transactions")
      .get().count;
    const alertCount = db
      .prepare("SELECT COUNT(*) AS count FROM security_alerts WHERE acknowledged = 0")
      .get().count;
    const uptime = process.uptime();

    success(res, {
      status: "healthy",
      uptime: Math.floor(uptime),
      database: "connected",
      counts: { users: userCount, accounts: accountCount, transactions: transactionCount },
      unacknowledgedAlerts: alertCount,
      version: "1.0.0",
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const statusCode = error instanceof ApiError ? error.statusCode : 500;
  const safeMessage =
    error instanceof ApiError
      ? error.message
      : IS_PRODUCTION
        ? "Internal server error"
        : (error.message ?? "Unknown error");
  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error("[ERROR]", error);
  }
  failure(res, statusCode, safeMessage);
});

app.use((_req, res) => {
  failure(res, 404, "Route not found.");
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`WASI Platform API listening on http://localhost:${PORT}`);
});
