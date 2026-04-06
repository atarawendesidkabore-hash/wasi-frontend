import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const ROLE_SEEDS = [
  {
    id: "admin",
    label: "Administrateur",
    description: "Pilote le noyau WASI, les modules, les droits et la gouvernance produit.",
  },
  {
    id: "analyst",
    label: "Analyste",
    description: "Analyse les pays, relit les sources et supervise les signaux WASI.",
  },
  {
    id: "investor",
    label: "Investisseur",
    description: "Suit les marchés, les véhicules WASI et les opportunités d'investissement.",
  },
  {
    id: "institution",
    label: "Institution",
    description: "Représente une institution partenaire, un régulateur ou une place de marché.",
  },
  {
    id: "microfinance",
    label: "Microfinance",
    description: "Opère les flux de terrain, la conformité et les services financiers locaux.",
  },
  {
    id: "issuer",
    label: "Émetteur",
    description: "Prépare les dossiers de compartiment, d'admission et de cotation WASI.",
  },
];

const USER_SEEDS = [
  {
    id: "usr_admin_001",
    displayName: "Awa Administrateur",
    username: "wasi-admin",
    email: "admin@wasi.local",
    organization: "WASI Core",
    roleId: "admin",
    accessCode: "WASI-ADMIN-001",
    password: "WasiAdmin!2026",
  },
  {
    id: "usr_analyst_001",
    displayName: "Moussa Analyste",
    username: "wasi-analyste",
    email: "analyste@wasi.local",
    organization: "WASI Intelligence",
    roleId: "analyst",
    accessCode: "WASI-ANALYSTE-001",
    password: "WasiAnalyst!2026",
  },
  {
    id: "usr_investor_001",
    displayName: "Aminata Investisseur",
    username: "wasi-invest",
    email: "investisseur@wasi.local",
    organization: "WASI Capital",
    roleId: "investor",
    accessCode: "WASI-INVEST-001",
    password: "WasiInvest!2026",
  },
  {
    id: "usr_institution_001",
    displayName: "Jean Institution",
    username: "wasi-institution",
    email: "institution@wasi.local",
    organization: "WASI Partners",
    roleId: "institution",
    accessCode: "WASI-INSTIT-001",
    password: "WasiInstitution!2026",
  },
  {
    id: "usr_micro_001",
    displayName: "Mariam Microfinance",
    username: "wasi-micro",
    email: "microfinance@wasi.local",
    organization: "CIREX Microfinance",
    roleId: "microfinance",
    accessCode: "WASI-MICRO-001",
    password: "WasiMicro!2026",
  },
  {
    id: "usr_issuer_001",
    displayName: "Kader Émetteur",
    username: "wasi-emetteur",
    email: "emetteur@wasi.local",
    organization: "WASI Private Market",
    roleId: "issuer",
    accessCode: "WASI-ISSUER-001",
    password: "WasiIssuer!2026",
  },
];

const MODULE_SEEDS = [
  {
    key: "intelligence",
    title: "WASI Intelligence",
    audience: "Analystes, direction, investisseurs",
    route: "/",
    status: "active",
    sourceMode: "ai-plus-official-sources",
    summary: "Scoring pays, raisonnement IA, cadrage réglementaire et lecture stratégique.",
  },
  {
    key: "dex",
    title: "WASI DEX",
    audience: "Analystes, investisseurs",
    route: "/wasi-dex/wasi-app.html",
    status: "active",
    sourceMode: "versioned-market-data",
    summary: "Familles AFEX, profils export, comparaisons régionales et référence FX XOF.",
  },
  {
    key: "banking",
    title: "WASI Banking",
    audience: "Institutions financières",
    route: "/",
    status: "design-ready",
    sourceMode: "mixed-static-and-live",
    summary: "Cockpit bancaire et opérationnel relié à l'intelligence WASI.",
  },
  {
    key: "stock-market",
    title: "WASI Stock Market",
    audience: "Émetteurs, investisseurs, opérateurs de marché",
    route: "/",
    status: "design-ready",
    sourceMode: "mixed-static-and-live",
    summary: "Compartiments privés, admission, cotation, suivi et place de marché panafricaine.",
  },
  {
    key: "funds",
    title: "WASI Funds",
    audience: "Investisseurs, gérants",
    route: "/",
    status: "seeded",
    sourceMode: "seeded-products",
    summary: "Véhicules indiciels et paniers WASI adossés aux signaux produits.",
  },
  {
    key: "private-market",
    title: "WASI Private Market",
    audience: "Émetteurs, clients, investisseurs",
    route: "/microfinance-app/wasi-customer-portal.html",
    status: "active",
    sourceMode: "seeded-and-simulated",
    summary: "Souscription privée, portails clients et passerelles d'investissement.",
  },
  {
    key: "ecosystem",
    title: "WASI Ecosystem Hub",
    audience: "Pilotage groupe",
    route: "/ecosystem-hub/index.html",
    status: "active",
    sourceMode: "navigation-layer",
    summary: "Carte de l'écosystème et coordination des briques reliées.",
  },
  {
    key: "microfinance",
    title: "CIREX Microfinance",
    audience: "Réseaux microfinance, conformité, terrain",
    route: "/microfinance-app/index.html",
    status: "active",
    sourceMode: "operational-finance-data",
    summary: "Crédit, conformité, validation et relation client reliés à WASI.",
  },
  {
    key: "cli",
    title: "WASI CLI",
    audience: "Opérateurs terminal, analystes, supervision produit",
    route: "",
    status: "synced",
    sourceMode: "shared-local-bundle",
    summary: "Terminal Bloomberg-style synchronisé avec Excel, le web et la couche IA WASI.",
  },
];

const FUND_SEEDS = [
  {
    id: "fund_wasi_uemoa",
    ticker: "WASI-UEMOA",
    name: "WASI UEMOA Index Fund",
    strategy: "Indice large UEMOA",
    nav: 4850,
    change: 1.2,
    aum: "1.8 Mds",
    fees: "0.45%",
    score: 72,
    detail: {
      fullName: "WASI UEMOA Index Fund",
      benchmark: "Panier leaders UEMOA",
      currency: "XOF",
      domicile: "UEMOA",
      vehicle: "Fonds indiciel",
      replication: "Rules-based index tracking",
      rebalancing: "Trimestriel",
      reconstitution: "Annuel",
      weighting: "Capitalisation et résilience",
      constituents: [
        { name: "Banques UEMOA", category: "Finance", weight: 32, futures: false },
        { name: "Télécoms", category: "Services", weight: 24, futures: false },
        { name: "Agro-industrie", category: "Consommation", weight: 22, futures: false },
        { name: "Logistique", category: "Infra", weight: 22, futures: false },
      ],
      status: "Actif — base pilote WASI",
    },
  },
  {
    id: "fund_waex_family",
    ticker: "WAEX",
    name: "WAEX Family — Africa Export Index",
    strategy: "Famille indices export Afrique Ouest",
    nav: 10000,
    change: 1.4,
    aum: "Pré-lancement",
    fees: "0.50%",
    score: 68,
    detail: {
      fullName: "Africa Export Index Fund Family",
      benchmark: "WAEX Family",
      currency: "XOF",
      domicile: "Afrique / UEMOA",
      vehicle: "Famille de fonds indiciels",
      replication: "Rules-based index tracking par pays",
      rebalancing: "Trimestriel",
      reconstitution: "Annuel",
      weighting: "Tonnage export moyen 20 ans",
      constituents: [
        { name: "CIREX", category: "Côtier", weight: 40, futures: true },
        { name: "BUREX", category: "Enclavé", weight: 22, futures: false },
        { name: "GHAEX", category: "Croissance", weight: 20, futures: true },
        { name: "SENEX", category: "Diversifié", weight: 18, futures: false },
      ],
      status: "Pré-lancement — famille umbrella",
    },
  },
  {
    id: "fund_cirex",
    ticker: "CIREX",
    name: "CIREX Fund — CI Raw Export Index",
    strategy: "Matières premières export CI",
    nav: 10000,
    change: 1.8,
    aum: "Pré-lancement",
    fees: "0.60%",
    score: 72,
    detail: {
      fullName: "Cote d'Ivoire Raw Export Index Fund",
      benchmark: "CIREX Index",
      currency: "XOF",
      domicile: "Côte d'Ivoire / UEMOA",
      vehicle: "Fonds indiciel réglementé (concept)",
      replication: "Rules-based index tracking",
      rebalancing: "Trimestriel",
      reconstitution: "Annuel",
      weighting: "Pondération export moyen 20 ans",
      constituents: [
        { name: "Cacao", category: "Softs", weight: 33.9, futures: true },
        { name: "Caoutchouc", category: "Agri industriel", weight: 19.3, futures: true },
        { name: "Cajou", category: "Softs", weight: 15.1, futures: false },
        { name: "Pétrole", category: "Énergie", weight: 11.7, futures: true },
      ],
      status: "Pré-lancement — profil conceptuel",
    },
  },
];

const ISSUER_SEEDS = [
  {
    id: "iss_cirex_holdings",
    name: "CIREX Holdings",
    ticker: "CIRX",
    country: "Côte d'Ivoire",
    sector: "Finance",
    compartment: "Premier",
    wasiScore: "A-",
    status: "admission",
    targetRaiseXof: 850000000,
  },
  {
    id: "iss_agrolink",
    name: "AgroLink Croissance",
    ticker: "AGRL",
    country: "Côte d'Ivoire",
    sector: "Agro-industrie",
    compartment: "Growth",
    wasiScore: "B+",
    status: "book-building",
    targetRaiseXof: 420000000,
  },
  {
    id: "iss_solarbridge",
    name: "SolarBridge West Africa",
    ticker: "SOLB",
    country: "Sénégal",
    sector: "Énergie",
    compartment: "Venture",
    wasiScore: "B",
    status: "dossier",
    targetRaiseXof: 180000000,
  },
];

const ADMISSION_CASE_SEEDS = [
  {
    id: "adm_cirex_001",
    issuerId: "iss_cirex_holdings",
    stage: "Admission",
    compartment: "Premier",
    status: "en_revue",
    targetRaiseXof: 850000000,
    note: "Dossier quasi finalisé, validation marché attendue.",
  },
  {
    id: "adm_agrolink_001",
    issuerId: "iss_agrolink",
    stage: "Book Building",
    compartment: "Growth",
    status: "ouvert",
    targetRaiseXof: 420000000,
    note: "Fenêtre investisseur ouverte sur 15 jours.",
  },
  {
    id: "adm_solarbridge_001",
    issuerId: "iss_solarbridge",
    stage: "Analyse WASI",
    compartment: "Venture",
    status: "en_instruction",
    targetRaiseXof: 180000000,
    note: "Validation complémentaire des documents techniques.",
  },
];

const LISTING_SEEDS = [
  {
    id: "lst_cirx",
    issuerId: "iss_cirex_holdings",
    ticker: "CIRX",
    name: "CIREX Holdings",
    sector: "Finance",
    country: "Côte d'Ivoire",
    compartment: "Premier",
    price: 2500,
    change: 2.4,
    volume: 185000,
    score: "A-",
    marketCap: "12.8 Mds XOF",
  },
  {
    id: "lst_agrl",
    issuerId: "iss_agrolink",
    ticker: "AGRL",
    name: "AgroLink Croissance",
    sector: "Agro-industrie",
    country: "Côte d'Ivoire",
    compartment: "Growth",
    price: 1450,
    change: 1.6,
    volume: 92000,
    score: "B+",
    marketCap: "5.4 Mds XOF",
  },
  {
    id: "lst_solb",
    issuerId: "iss_solarbridge",
    ticker: "SOLB",
    name: "SolarBridge West Africa",
    sector: "Énergie",
    country: "Sénégal",
    compartment: "Venture",
    price: 980,
    change: 3.1,
    volume: 61000,
    score: "B",
    marketCap: "2.1 Mds XOF",
  },
  {
    id: "lst_kora",
    issuerId: null,
    ticker: "KORA",
    name: "Kora Logistics Hub",
    sector: "Logistique",
    country: "Ghana",
    compartment: "Growth",
    price: 1180,
    change: 0.8,
    volume: 74000,
    score: "B",
    marketCap: "3.6 Mds XOF",
  },
];

const PORTFOLIO_SEEDS = [
  {
    id: "port_core_investor",
    ownerUserId: "usr_investor_001",
    label: "Portefeuille Investisseur WASI",
    currency: "XOF",
  },
];

const HOLDING_SEEDS = [
  { portfolioId: "port_core_investor", ticker: "CIRX", name: "CIREX Holdings", category: "Premier", quantity: 600, averagePrice: 2310, currentPrice: 2500 },
  { portfolioId: "port_core_investor", ticker: "AGRL", name: "AgroLink Croissance", category: "Growth", quantity: 420, averagePrice: 1360, currentPrice: 1450 },
  { portfolioId: "port_core_investor", ticker: "SOLB", name: "SolarBridge West Africa", category: "Venture", quantity: 500, averagePrice: 940, currentPrice: 980 },
];

const ORDER_SEEDS = [
  { id: "ord_001", portfolioId: "port_core_investor", userId: "usr_investor_001", ticker: "CIRX", side: "buy", quantity: 600, limitPrice: 2310, status: "filled", channel: "wasi-stock-market" },
  { id: "ord_002", portfolioId: "port_core_investor", userId: "usr_investor_001", ticker: "AGRL", side: "buy", quantity: 420, limitPrice: 1360, status: "filled", channel: "wasi-stock-market" },
  { id: "ord_003", portfolioId: "port_core_investor", userId: "usr_investor_001", ticker: "SOLB", side: "buy", quantity: 500, limitPrice: 940, status: "filled", channel: "wasi-stock-market" },
];

const WATCHLIST_SEEDS = [
  {
    id: "watch_001",
    userId: "usr_analyst_001",
    name: "Surveillance marché WASI",
    symbols: ["CIRX", "AGRL", "SOLB", "WAEX", "CIREX"],
  },
];

const ALERT_SEEDS = [
  {
    id: "alert_001",
    severity: "WARNING",
    alertType: "SOURCE_REFRESH",
    message: "Une revue des sources officielles est attendue dans les prochaines 24 heures.",
    acknowledged: 0,
  },
  {
    id: "alert_002",
    severity: "INFO",
    alertType: "ADMISSION",
    message: "Le dossier CIREX Holdings approche du stade admission.",
    acknowledged: 0,
  },
];

function nowIso() {
  return new Date().toISOString();
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function safeParseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function derivePasswordSalt(userId) {
  return crypto.createHash("sha256").update(`wasi:${userId}`).digest("hex").slice(0, 16);
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), String(salt), 64).toString("hex");
}

function deriveMarketSummary(manifestPath) {
  const fallback = {
    familyName: "Africa Export Index Family",
    packageName: "AFEX All 54 Sovereign-State Library",
    countryCount: 54,
    subfamilyCount: 5,
    comparisonCurrency: "USD",
    generatedOn: null,
    regions: [
      { code: "WAEX", name: "West Africa Export Index Family", countryCount: 16 },
      { code: "EAEX", name: "East Africa Export Index Family", countryCount: 11 },
      { code: "SAEX", name: "Southern Africa Export Index Family", countryCount: 13 },
      { code: "CAEX", name: "Central Africa Export Index Family", countryCount: 8 },
      { code: "NAEX", name: "North Africa Export Index Family", countryCount: 6 },
    ],
  };

  if (!manifestPath) {
    return fallback;
  }

  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const regions = Array.isArray(manifest.subfamilies)
      ? manifest.subfamilies.map((item) => ({
          code: item.subfamily_code,
          name: item.subfamily_name,
          countryCount: Number(item.country_count || 0),
        }))
      : fallback.regions;

    return {
      familyName: manifest.family_name || fallback.familyName,
      packageName: manifest.package_name || fallback.packageName,
      countryCount: Number(manifest.country_count || fallback.countryCount),
      subfamilyCount: regions.length,
      comparisonCurrency: manifest.comparison_currency || fallback.comparisonCurrency,
      generatedOn: manifest.generated_on || null,
      regions,
    };
  } catch {
    return fallback;
  }
}

function hasColumn(db, tableName, columnName) {
  return db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .some((column) => column.name === columnName);
}

function ensureColumn(db, tableName, columnName, sqlDefinition) {
  if (!hasColumn(db, tableName, columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${sqlDefinition}`);
  }
}

export function createWasiCoreStore({ projectRoot, manifestPath, filename } = {}) {
  const dbPath = filename || path.join(projectRoot, "data", "wasi-core.db");
  if (dbPath !== ":memory:") {
    mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      username TEXT UNIQUE,
      email TEXT NOT NULL UNIQUE,
      organization TEXT NOT NULL,
      role_id TEXT NOT NULL,
      access_code TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      password_salt TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      last_login_at TEXT,
      FOREIGN KEY(role_id) REFERENCES roles(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS modules (
      module_key TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      audience TEXT NOT NULL,
      route TEXT NOT NULL,
      status TEXT NOT NULL,
      source_mode TEXT NOT NULL,
      summary TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS market_snapshots (
      snapshot_key TEXT PRIMARY KEY,
      as_of_date TEXT,
      payload_json TEXT NOT NULL,
      source_label TEXT NOT NULL,
      version_label TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id TEXT,
      action TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'SUCCESS',
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      detail_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(actor_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS funds (
      id TEXT PRIMARY KEY,
      ticker TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      strategy TEXT NOT NULL,
      nav REAL NOT NULL,
      change_pct REAL NOT NULL,
      aum_label TEXT NOT NULL,
      fee_label TEXT NOT NULL,
      score INTEGER NOT NULL,
      detail_json TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS issuers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ticker TEXT UNIQUE,
      country TEXT NOT NULL,
      sector TEXT NOT NULL,
      compartment TEXT NOT NULL,
      wasi_score TEXT NOT NULL,
      status TEXT NOT NULL,
      target_raise_xof REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admission_cases (
      id TEXT PRIMARY KEY,
      issuer_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      compartment TEXT NOT NULL,
      status TEXT NOT NULL,
      target_raise_xof REAL NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(issuer_id) REFERENCES issuers(id)
    );

    CREATE TABLE IF NOT EXISTS stock_market_listings (
      id TEXT PRIMARY KEY,
      issuer_id TEXT,
      ticker TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      sector TEXT NOT NULL,
      country TEXT NOT NULL,
      compartment TEXT NOT NULL,
      price REAL NOT NULL,
      change_pct REAL NOT NULL,
      volume INTEGER NOT NULL,
      score TEXT NOT NULL,
      market_cap TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(issuer_id) REFERENCES issuers(id)
    );

    CREATE TABLE IF NOT EXISTS portfolios (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      label TEXT NOT NULL,
      currency TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(owner_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS portfolio_holdings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      portfolio_id TEXT NOT NULL,
      ticker TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity REAL NOT NULL,
      average_price REAL NOT NULL,
      current_price REAL NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(portfolio_id) REFERENCES portfolios(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      portfolio_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      ticker TEXT NOT NULL,
      side TEXT NOT NULL,
      quantity REAL NOT NULL,
      limit_price REAL NOT NULL,
      status TEXT NOT NULL,
      channel TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(portfolio_id) REFERENCES portfolios(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS watchlists (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      symbols_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      severity TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      message TEXT NOT NULL,
      acknowledged INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      acknowledged_at TEXT
    );
  `);

  ensureColumn(db, "users", "username", "TEXT");
  ensureColumn(db, "users", "password_hash", "TEXT");
  ensureColumn(db, "users", "password_salt", "TEXT");
  ensureColumn(db, "audit_log", "status", "TEXT NOT NULL DEFAULT 'SUCCESS'");

  const insertRole = db.prepare(`
    INSERT OR IGNORE INTO roles (id, label, description)
    VALUES (?, ?, ?)
  `);
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (
      id, display_name, username, email, organization, role_id, access_code, password_hash, password_salt, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `);
  const updateUserCredentials = db.prepare(`
    UPDATE users
    SET username = ?, password_hash = ?, password_salt = ?, organization = ?, role_id = ?, access_code = ?
    WHERE id = ?
  `);
  const insertModule = db.prepare(`
    INSERT OR REPLACE INTO modules (
      module_key, title, audience, route, status, source_mode, summary, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const upsertSnapshot = db.prepare(`
    INSERT OR REPLACE INTO market_snapshots (
      snapshot_key, as_of_date, payload_json, source_label, version_label, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const upsertFund = db.prepare(`
    INSERT OR REPLACE INTO funds (
      id, ticker, name, strategy, nav, change_pct, aum_label, fee_label, score, detail_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const upsertIssuer = db.prepare(`
    INSERT OR REPLACE INTO issuers (
      id, name, ticker, country, sector, compartment, wasi_score, status, target_raise_xof, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const upsertAdmissionCase = db.prepare(`
    INSERT OR REPLACE INTO admission_cases (
      id, issuer_id, stage, compartment, status, target_raise_xof, note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const upsertListing = db.prepare(`
    INSERT OR REPLACE INTO stock_market_listings (
      id, issuer_id, ticker, name, sector, country, compartment, price, change_pct, volume, score, market_cap, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const upsertPortfolio = db.prepare(`
    INSERT OR REPLACE INTO portfolios (
      id, owner_user_id, label, currency, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const clearPortfolioHoldings = db.prepare(`
    DELETE FROM portfolio_holdings
    WHERE portfolio_id = ?
  `);
  const insertHolding = db.prepare(`
    INSERT INTO portfolio_holdings (
      portfolio_id, ticker, name, category, quantity, average_price, current_price, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertOrderSeed = db.prepare(`
    INSERT OR IGNORE INTO orders (
      id, portfolio_id, user_id, ticker, side, quantity, limit_price, status, channel, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const upsertWatchlist = db.prepare(`
    INSERT OR REPLACE INTO watchlists (
      id, user_id, name, symbols_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const upsertAlert = db.prepare(`
    INSERT OR REPLACE INTO alerts (
      id, severity, alert_type, message, acknowledged, created_at, acknowledged_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const role of ROLE_SEEDS) {
    insertRole.run(role.id, role.label, role.description);
  }

  for (const user of USER_SEEDS) {
    const passwordSalt = derivePasswordSalt(user.id);
    const passwordHash = hashPassword(user.password, passwordSalt);
    insertUser.run(
      user.id,
      user.displayName,
      user.username,
      user.email,
      user.organization,
      user.roleId,
      user.accessCode,
      passwordHash,
      passwordSalt,
      nowIso(),
    );
    updateUserCredentials.run(
      user.username,
      passwordHash,
      passwordSalt,
      user.organization,
      user.roleId,
      user.accessCode,
      user.id,
    );
  }

  for (const module of MODULE_SEEDS) {
    insertModule.run(
      module.key,
      module.title,
      module.audience,
      module.route,
      module.status,
      module.sourceMode,
      module.summary,
      nowIso(),
    );
  }

  const marketSummary = deriveMarketSummary(manifestPath);
  upsertSnapshot.run(
    "afex-market-summary",
    marketSummary.generatedOn,
    JSON.stringify(marketSummary),
    "AFEX manifest",
    `afex-${marketSummary.generatedOn || "snapshot"}`,
    nowIso(),
  );

  for (const fund of FUND_SEEDS) {
    upsertFund.run(
      fund.id,
      fund.ticker,
      fund.name,
      fund.strategy,
      fund.nav,
      fund.change,
      fund.aum,
      fund.fees,
      fund.score,
      JSON.stringify(fund.detail || null),
      nowIso(),
    );
  }

  for (const issuer of ISSUER_SEEDS) {
    upsertIssuer.run(
      issuer.id,
      issuer.name,
      issuer.ticker,
      issuer.country,
      issuer.sector,
      issuer.compartment,
      issuer.wasiScore,
      issuer.status,
      issuer.targetRaiseXof,
      nowIso(),
      nowIso(),
    );
  }

  for (const admissionCase of ADMISSION_CASE_SEEDS) {
    upsertAdmissionCase.run(
      admissionCase.id,
      admissionCase.issuerId,
      admissionCase.stage,
      admissionCase.compartment,
      admissionCase.status,
      admissionCase.targetRaiseXof,
      admissionCase.note,
      nowIso(),
      nowIso(),
    );
  }

  for (const listing of LISTING_SEEDS) {
    upsertListing.run(
      listing.id,
      listing.issuerId,
      listing.ticker,
      listing.name,
      listing.sector,
      listing.country,
      listing.compartment,
      listing.price,
      listing.change,
      listing.volume,
      listing.score,
      listing.marketCap,
      nowIso(),
    );
  }

  for (const portfolio of PORTFOLIO_SEEDS) {
    upsertPortfolio.run(
      portfolio.id,
      portfolio.ownerUserId,
      portfolio.label,
      portfolio.currency,
      nowIso(),
      nowIso(),
    );
    clearPortfolioHoldings.run(portfolio.id);
  }

  for (const holding of HOLDING_SEEDS) {
    insertHolding.run(
      holding.portfolioId,
      holding.ticker,
      holding.name,
      holding.category,
      holding.quantity,
      holding.averagePrice,
      holding.currentPrice,
      nowIso(),
    );
  }

  for (const order of ORDER_SEEDS) {
    insertOrderSeed.run(
      order.id,
      order.portfolioId,
      order.userId,
      order.ticker,
      order.side,
      order.quantity,
      order.limitPrice,
      order.status,
      order.channel,
      nowIso(),
      nowIso(),
    );
  }

  for (const watchlist of WATCHLIST_SEEDS) {
    upsertWatchlist.run(
      watchlist.id,
      watchlist.userId,
      watchlist.name,
      JSON.stringify(watchlist.symbols),
      nowIso(),
      nowIso(),
    );
  }

  for (const alert of ALERT_SEEDS) {
    upsertAlert.run(
      alert.id,
      alert.severity,
      alert.alertType,
      alert.message,
      alert.acknowledged,
      nowIso(),
      null,
    );
  }

  const selectSession = db.prepare(`
    SELECT
      sessions.token AS token,
      sessions.issued_at AS issuedAt,
      sessions.expires_at AS expiresAt,
      sessions.last_seen_at AS lastSeenAt,
      users.id AS id,
      users.display_name AS displayName,
      users.username AS username,
      users.email AS email,
      users.organization AS organization,
      users.role_id AS roleId,
      users.status AS status,
      users.last_login_at AS lastLoginAt,
      roles.label AS roleLabel
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    JOIN roles ON roles.id = users.role_id
    WHERE sessions.token = ?
    LIMIT 1
  `);

  const selectUserByAccessCode = db.prepare(`
    SELECT
      users.id AS id,
      users.display_name AS displayName,
      users.username AS username,
      users.email AS email,
      users.organization AS organization,
      users.role_id AS roleId,
      users.status AS status,
      users.password_hash AS passwordHash,
      users.password_salt AS passwordSalt,
      roles.label AS roleLabel
    FROM users
    JOIN roles ON roles.id = users.role_id
    WHERE users.access_code = ?
    LIMIT 1
  `);
  const selectUserByIdentity = db.prepare(`
    SELECT
      users.id AS id,
      users.display_name AS displayName,
      users.username AS username,
      users.email AS email,
      users.organization AS organization,
      users.role_id AS roleId,
      users.status AS status,
      users.password_hash AS passwordHash,
      users.password_salt AS passwordSalt,
      users.last_login_at AS lastLoginAt,
      roles.label AS roleLabel
    FROM users
    JOIN roles ON roles.id = users.role_id
    WHERE lower(users.username) = lower(?) OR lower(users.email) = lower(?)
    LIMIT 1
  `);

  const insertSession = db.prepare(`
    INSERT INTO sessions (token, user_id, issued_at, expires_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const touchSession = db.prepare(`
    UPDATE sessions
    SET last_seen_at = ?
    WHERE token = ?
  `);

  const touchUserLogin = db.prepare(`
    UPDATE users
    SET last_login_at = ?
    WHERE id = ?
  `);

  const insertAudit = db.prepare(`
    INSERT INTO audit_log (actor_user_id, action, status, entity_type, entity_id, detail_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const listRolesStmt = db.prepare(`
    SELECT id, label, description
    FROM roles
    ORDER BY label
  `);

  const listModulesStmt = db.prepare(`
    SELECT
      module_key AS key,
      title,
      audience,
      route,
      status,
      source_mode AS sourceMode,
      summary,
      updated_at AS updatedAt
    FROM modules
    ORDER BY title
  `);

  const listDemoUsersStmt = db.prepare(`
    SELECT
      users.id AS id,
      users.username AS username,
      users.display_name AS displayName,
      users.organization AS organization,
      users.role_id AS roleId,
      users.access_code AS accessCode,
      roles.label AS roleLabel
    FROM users
    JOIN roles ON roles.id = users.role_id
    ORDER BY roles.label, users.display_name
  `);

  const latestSnapshotStmt = db.prepare(`
    SELECT
      snapshot_key AS key,
      as_of_date AS asOfDate,
      payload_json AS payloadJson,
      source_label AS sourceLabel,
      version_label AS versionLabel,
      updated_at AS updatedAt
    FROM market_snapshots
    WHERE snapshot_key = ?
    LIMIT 1
  `);

  const auditSummaryStmt = db.prepare(`
    SELECT
      COUNT(*) AS total,
      COUNT(DISTINCT actor_user_id) AS activeActors,
      SUM(CASE WHEN created_at >= datetime('now', '-1 day') THEN 1 ELSE 0 END) AS last24h,
      SUM(CASE WHEN status = 'FAILURE' THEN 1 ELSE 0 END) AS failureCount,
      MAX(created_at) AS lastEventAt
    FROM audit_log
  `);

  const listAuditStmt = db.prepare(`
    SELECT
      audit_log.id AS id,
      audit_log.action AS action,
      audit_log.status AS status,
      audit_log.entity_type AS entityType,
      audit_log.entity_id AS entityId,
      audit_log.detail_json AS detailJson,
      audit_log.created_at AS createdAt,
      users.username AS actorUsername,
      users.display_name AS actorName,
      users.role_id AS actorRole
    FROM audit_log
    LEFT JOIN users ON users.id = audit_log.actor_user_id
    ORDER BY audit_log.id DESC
    LIMIT ?
  `);

  const searchAuditStmt = db.prepare(`
    SELECT
      audit_log.id AS id,
      audit_log.action AS action,
      audit_log.status AS status,
      audit_log.entity_type AS entityType,
      audit_log.entity_id AS entityId,
      audit_log.detail_json AS detailJson,
      audit_log.created_at AS createdAt,
      users.username AS actorUsername
    FROM audit_log
    LEFT JOIN users ON users.id = audit_log.actor_user_id
    WHERE (? = '' OR audit_log.action = ?)
      AND (? = '' OR audit_log.status = ?)
    ORDER BY audit_log.id DESC
    LIMIT ?
  `);

  const listUsersStmt = db.prepare(`
    SELECT
      id,
      username,
      email,
      role_id AS roleId,
      status,
      display_name AS displayName,
      organization
    FROM users
    ORDER BY username
  `);

  const updateUserRoleStmt = db.prepare(`
    UPDATE users
    SET role_id = ?
    WHERE id = ?
  `);

  const updateUserStatusStmt = db.prepare(`
    UPDATE users
    SET status = ?
    WHERE id = ?
  `);

  const listAlertsStmt = db.prepare(`
    SELECT
      id,
      severity,
      alert_type AS alertType,
      message,
      acknowledged,
      created_at AS createdAt,
      acknowledged_at AS acknowledgedAt
    FROM alerts
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const ackAlertStmt = db.prepare(`
    UPDATE alerts
    SET acknowledged = 1,
        acknowledged_at = ?
    WHERE id = ?
  `);

  const countUsersStmt = db.prepare(`SELECT COUNT(*) AS total FROM users`);
  const countPortfoliosStmt = db.prepare(`SELECT COUNT(*) AS total FROM portfolios`);
  const countOrdersStmt = db.prepare(`SELECT COUNT(*) AS total FROM orders`);
  const listFundsStmt = db.prepare(`
    SELECT
      id,
      ticker,
      name,
      strategy,
      nav,
      change_pct AS changePct,
      aum_label AS aum,
      fee_label AS fees,
      score,
      detail_json AS detailJson
    FROM funds
    ORDER BY score DESC, ticker
  `);
  const listListingsStmt = db.prepare(`
    SELECT
      id,
      issuer_id AS issuerId,
      ticker,
      name,
      sector,
      country,
      compartment,
      price,
      change_pct AS changePct,
      volume,
      score,
      market_cap AS marketCap
    FROM stock_market_listings
    ORDER BY compartment DESC, score DESC, ticker
  `);
  const listIssuersStmt = db.prepare(`
    SELECT
      id,
      name,
      ticker,
      country,
      sector,
      compartment,
      wasi_score AS wasiScore,
      status,
      target_raise_xof AS targetRaiseXof
    FROM issuers
    ORDER BY updated_at DESC, name
  `);
  const listAdmissionCasesStmt = db.prepare(`
    SELECT
      admission_cases.id AS id,
      admission_cases.issuer_id AS issuerId,
      issuers.name AS issuerName,
      admission_cases.stage AS stage,
      admission_cases.compartment AS compartment,
      admission_cases.status AS status,
      admission_cases.target_raise_xof AS targetRaiseXof,
      admission_cases.note AS note,
      admission_cases.updated_at AS updatedAt
    FROM admission_cases
    JOIN issuers ON issuers.id = admission_cases.issuer_id
    ORDER BY admission_cases.updated_at DESC
  `);
  const listWatchlistsStmt = db.prepare(`
    SELECT
      id,
      user_id AS userId,
      name,
      symbols_json AS symbolsJson,
      updated_at AS updatedAt
    FROM watchlists
    ORDER BY updated_at DESC
  `);
  const getPortfolioByUserStmt = db.prepare(`
    SELECT
      id,
      owner_user_id AS ownerUserId,
      label,
      currency,
      updated_at AS updatedAt
    FROM portfolios
    WHERE owner_user_id = ?
    LIMIT 1
  `);
  const listHoldingsStmt = db.prepare(`
    SELECT
      ticker,
      name,
      category,
      quantity,
      average_price AS averagePrice,
      current_price AS currentPrice,
      updated_at AS updatedAt
    FROM portfolio_holdings
    WHERE portfolio_id = ?
    ORDER BY ticker
  `);
  const listOrdersStmt = db.prepare(`
    SELECT
      id,
      portfolio_id AS portfolioId,
      user_id AS userId,
      ticker,
      side,
      quantity,
      limit_price AS limitPrice,
      status,
      channel,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM orders
    ORDER BY created_at DESC
  `);

  function logAudit({
    actorUserId = null,
    action,
    status = "SUCCESS",
    entityType,
    entityId = null,
    detail = null,
  }) {
    insertAudit.run(
      actorUserId,
      action,
      status,
      entityType,
      entityId,
      detail ? JSON.stringify(detail) : null,
      nowIso(),
    );
  }

  function serializeUser(user) {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      displayName: user.displayName,
      username: user.username || null,
      email: user.email,
      organization: user.organization,
      roleId: user.roleId,
      roleLabel: user.roleLabel,
      status: user.status,
      lastLoginAt: user.lastLoginAt || null,
    };
  }

  function createSessionForUser(user, action, metadata = {}) {
    const issuedAt = nowIso();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const token = `wasi_${crypto.randomUUID().replace(/-/g, "")}`;

    insertSession.run(token, user.id, issuedAt, expiresAt, issuedAt);
    touchUserLogin.run(issuedAt, user.id);
    logAudit({
      actorUserId: user.id,
      action,
      entityType: "session",
      entityId: token,
      detail: metadata,
    });

    return {
      token,
      session: {
        token,
        issuedAt,
        expiresAt,
      },
      user: {
        ...user,
        lastLoginAt: issuedAt,
      },
    };
  }

  function loginDemo(accessCode, metadata = {}) {
    const user = selectUserByAccessCode.get(normalizeCode(accessCode));
    if (!user) {
      return null;
    }

    return createSessionForUser(user, "auth.demo_login", metadata);
  }

  function loginWithPassword(identity, password, metadata = {}) {
    const user = selectUserByIdentity.get(String(identity || "").trim(), String(identity || "").trim());
    if (!user || user.status !== "active") {
      logAudit({
        actorUserId: null,
        action: "auth.password_login",
        status: "FAILURE",
        entityType: "session",
        entityId: String(identity || "").trim(),
        detail: { reason: "user_not_found_or_inactive", ...metadata },
      });
      return null;
    }

    const candidateHash = hashPassword(password, user.passwordSalt || derivePasswordSalt(user.id));
    if (candidateHash !== user.passwordHash) {
      logAudit({
        actorUserId: user.id,
        action: "auth.password_login",
        status: "FAILURE",
        entityType: "session",
        entityId: user.id,
        detail: { reason: "bad_password", ...metadata },
      });
      return null;
    }

    return createSessionForUser(user, "auth.password_login", metadata);
  }

  function getSession(token) {
    if (!token) {
      return null;
    }

    const session = selectSession.get(String(token).trim());
    if (!session) {
      return null;
    }

    if (Date.parse(session.expiresAt) <= Date.now()) {
      return null;
    }

    touchSession.run(nowIso(), session.token);
    return {
      token: session.token,
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt,
      lastSeenAt: session.lastSeenAt,
      user: serializeUser(session),
    };
  }

  function listRoles() {
    return listRolesStmt.all();
  }

  function listModules() {
    return listModulesStmt.all();
  }

  function listDemoUsers() {
    return listDemoUsersStmt.all();
  }

  function getMarketSummary() {
    const snapshot = latestSnapshotStmt.get("afex-market-summary");
    if (!snapshot) {
      return null;
    }

    return {
      ...safeParseJson(snapshot.payloadJson, {}),
      sourceLabel: snapshot.sourceLabel,
      versionLabel: snapshot.versionLabel,
      updatedAt: snapshot.updatedAt,
      asOfDate: snapshot.asOfDate,
    };
  }

  function getAuditSummary() {
    const row = auditSummaryStmt.get();
    return {
      total: Number(row?.total || 0),
      activeActors: Number(row?.activeActors || 0),
      last24h: Number(row?.last24h || 0),
      failureCount: Number(row?.failureCount || 0),
      lastEventAt: row?.lastEventAt || null,
    };
  }

  function listAudit(limit = 20) {
    return listAuditStmt.all(Number(limit || 20)).map((row) => ({
      id: row.id,
      action: row.action,
      status: row.status,
      entityType: row.entityType,
      entityId: row.entityId,
      detail: safeParseJson(row.detailJson, null),
      createdAt: row.createdAt,
      actorUsername: row.actorUsername || null,
      actorName: row.actorName || "Système",
      actorRole: row.actorRole || null,
    }));
  }

  function searchAudit({ action = "", status = "", limit = 50 } = {}) {
    return searchAuditStmt
      .all(action, action, status, status, Number(limit || 50))
      .map((row) => ({
        id: row.id,
        action: row.action,
        status: row.status,
        entityType: row.entityType,
        entityId: row.entityId,
        detailJson: row.detailJson,
        createdAtUtc: row.createdAt,
        actorUsername: row.actorUsername || null,
      }));
  }

  function listUsers() {
    return listUsersStmt.all().map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.roleId.toUpperCase(),
      roleId: user.roleId,
      isActive: user.status === "active",
      displayName: user.displayName,
      organization: user.organization,
    }));
  }

  function updateUserRole(userId, roleId, actorUserId = null) {
    updateUserRoleStmt.run(String(roleId || "").toLowerCase(), userId);
    logAudit({
      actorUserId,
      action: "admin.user_role_change",
      entityType: "user",
      entityId: userId,
      detail: { roleId },
    });
  }

  function updateUserStatus(userId, isActive, actorUserId = null) {
    updateUserStatusStmt.run(isActive ? "active" : "inactive", userId);
    logAudit({
      actorUserId,
      action: "admin.user_status_change",
      entityType: "user",
      entityId: userId,
      detail: { isActive },
    });
  }

  function listAlerts(limit = 50) {
    return listAlertsStmt.all(Number(limit || 50)).map((alert) => ({
      id: alert.id,
      severity: alert.severity,
      alert_type: alert.alertType,
      message: alert.message,
      acknowledged: Boolean(alert.acknowledged),
      created_at_utc: alert.createdAt,
      acknowledged_at_utc: alert.acknowledgedAt,
    }));
  }

  function acknowledgeAlert(alertId, actorUserId = null) {
    ackAlertStmt.run(nowIso(), alertId);
    logAudit({
      actorUserId,
      action: "admin.alert_ack",
      entityType: "alert",
      entityId: alertId,
      detail: { acknowledged: true },
    });
  }

  function getHealth() {
    return {
      status: "healthy",
      database: "sqlite",
      version: "wasi-core-1.1",
      uptime: process.uptime(),
      counts: {
        users: Number(countUsersStmt.get()?.total || 0),
        accounts: Number(countPortfoliosStmt.get()?.total || 0),
        transactions: Number(countOrdersStmt.get()?.total || 0),
      },
      unacknowledgedAlerts: listAlerts(200).filter((alert) => !alert.acknowledged).length,
    };
  }

  function listFunds() {
    return listFundsStmt.all().map((row) => ({
      id: row.id,
      ticker: row.ticker,
      name: row.name,
      strategy: row.strategy,
      nav: row.nav,
      change: row.changePct,
      aum: row.aum,
      fees: row.fees,
      score: row.score,
      detail: safeParseJson(row.detailJson, null),
    }));
  }

  function listStockMarketListings() {
    return listListingsStmt.all().map((row) => ({
      id: row.id,
      issuerId: row.issuerId,
      ticker: row.ticker,
      name: row.name,
      sector: row.sector,
      country: row.country,
      compartment: row.compartment,
      price: row.price,
      change: row.changePct,
      volume: row.volume,
      score: row.score,
      marketCap: row.marketCap,
    }));
  }

  function listIssuers() {
    return listIssuersStmt.all();
  }

  function listAdmissionCases() {
    return listAdmissionCasesStmt.all();
  }

  function listWatchlists() {
    return listWatchlistsStmt.all().map((row) => ({
      id: row.id,
      userId: row.userId,
      name: row.name,
      symbols: safeParseJson(row.symbolsJson, []),
      updatedAt: row.updatedAt,
    }));
  }

  function getPortfolioForUser(userId) {
    const portfolio = getPortfolioByUserStmt.get(userId);
    if (!portfolio) {
      return null;
    }

    const holdings = listHoldingsStmt.all(portfolio.id).map((row) => ({
      ticker: row.ticker,
      name: row.name,
      qty: row.quantity,
      pru: row.averagePrice,
      current: row.currentPrice,
      category: row.category,
      updatedAt: row.updatedAt,
    }));

    return {
      ...portfolio,
      holdings,
    };
  }

  function listOrders() {
    return listOrdersStmt.all();
  }

  return {
    db,
    dbPath,
    serializeUser,
    loginDemo,
    loginWithPassword,
    getSession,
    listRoles,
    listModules,
    listDemoUsers,
    getMarketSummary,
    getAuditSummary,
    listAudit,
    searchAudit,
    listUsers,
    updateUserRole,
    updateUserStatus,
    listAlerts,
    acknowledgeAlert,
    getHealth,
    listFunds,
    listStockMarketListings,
    listIssuers,
    listAdmissionCases,
    listWatchlists,
    getPortfolioForUser,
    listOrders,
    logAudit,
    close() {
      db.close();
    },
  };
}
