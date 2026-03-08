import cors from "cors";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";

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

const PORT = Number(process.env.BANKING_API_PORT ?? process.env.PORT ?? 8010);
const MAX_SAFE_AMOUNT_CENTIMES = BigInt(Number.MAX_SAFE_INTEGER);
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
const JWT_SECRET = process.env.BANKING_JWT_SECRET ?? "wasi-dev-insecure-secret";
const JWT_EXPIRES_IN = process.env.BANKING_JWT_EXPIRES_IN ?? "12h";
const IS_PRODUCTION = String(process.env.NODE_ENV || "").toLowerCase() === "production";
const ALLOW_DEMO_CREDENTIALS = String(
  process.env.WASI_ALLOW_DEMO_USERS ?? (IS_PRODUCTION ? "false" : "true")
).toLowerCase() === "true";
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

const hashPassword = (password) =>
  createHash("sha256").update(`${JWT_SECRET}:${String(password)}`).digest("hex");

const ensurePlatformUsers = () => {
  if (!ALLOW_DEMO_CREDENTIALS) return;

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO platform_users (
      id, username, email, password_hash, role, tier, x402_balance, is_active, created_at_utc, updated_at_utc
    ) VALUES (
      @id, @username, @email, @passwordHash, @role, @tier, @x402Balance, 1, @createdAtUtc, @updatedAtUtc
    )
  `);

  const now = new Date().toISOString();
  const run = db.transaction((users) => {
    for (const user of users) {
      insertUser.run({
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

  run(AUTH_USERS);
};

ensurePlatformUsers();

class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

const insertPlatformUser = db.prepare(`
  INSERT INTO platform_users (
    id, username, email, password_hash, role, tier, x402_balance, is_active, created_at_utc, updated_at_utc
  ) VALUES (
    @id, @username, @email, @passwordHash, @role, @tier, @x402Balance, 1, @createdAtUtc, @updatedAtUtc
  )
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
  return AUTH_USERS.find((user) => user.username.toLowerCase() === username.toLowerCase()) ?? null;
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
    `WASI live snapshot: composite ${composite}. ` +
    `Top countries: ${top.map(([code, value]) => `${code} ${value}`).join(", ")}. ` +
    `Query received: "${queryText}".`;

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
    database: DB_PATH,
    auth: "jwt-rbac-enabled",
    idempotency: "required-for-mutations",
    auditLog: "immutable-enabled",
    dex: "wasi-etf-orderbook-enabled",
    marketSnapshot: "unified-platform-source",
    anthropicEnabled: Boolean(ANTHROPIC_API_KEY),
    ollamaConfigured: Boolean(OLLAMA_API_URL),
    llmProvider: LLM_PROVIDER,
    allowDemoUsers: ALLOW_DEMO_CREDENTIALS,
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
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    if (!username || !password) {
      throw new ApiError(400, "username and password are required.");
    }

    const platformUser = getPlatformUserByUsername.get(username);
    if (platformUser && Number(platformUser.is_active) === 1) {
      if (platformUser.password_hash !== hashPassword(password)) {
        throw new ApiError(401, "Incorrect username or password");
      }
      const accessToken = signAccessToken({
        id: platformUser.id,
        username: platformUser.username,
        displayName: platformUser.username,
        role: platformUser.role,
        tier: platformUser.tier,
        x402_balance: Number(platformUser.x402_balance),
        email: platformUser.email,
        accountIds: [ACCOUNT_ID_MAIN, ACCOUNT_ID_SAVINGS],
      });
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
  try {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      throw new ApiError(400, "username and password are required.");
    }

    const platformUser = getPlatformUserByUsername.get(String(username));
    if (platformUser && Number(platformUser.is_active) === 1) {
      if (platformUser.password_hash !== hashPassword(String(password))) {
        throw new ApiError(401, "Invalid credentials.");
      }
      const accessToken = signAccessToken({
        id: platformUser.id,
        username: platformUser.username,
        displayName: platformUser.username,
        role: platformUser.role,
        accountIds: [ACCOUNT_ID_MAIN, ACCOUNT_ID_SAVINGS],
        tier: platformUser.tier,
        x402_balance: Number(platformUser.x402_balance),
        email: platformUser.email,
      });
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

    const user = getDemoUserByUsername(String(username));
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
  console.log(`WASI Platform API listening on http://localhost:${PORT}`);
});
