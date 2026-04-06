import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import express from "express";

import {
  AFRICA_MICROFINANCE_URL,
  buildQuestionContext,
  ingestAfricaMicrofinanceIndex,
  loadAfricaMicrofinanceIndex,
} from "../archives-bf-ai/lib/africa-microfinance-repository.mjs";
import { formatContextChunks, normalizeText } from "../archives-bf-ai/lib/search-utils.mjs";
import {
  LEGAL_CODE_DEFINITIONS,
  buildLegalCodeQuestionContext,
  detectRelevantLegalCodeKeys,
  ingestLegalCodeIndex,
  loadLegalCodeIndex,
  resolveLegalCodePdfPath,
} from "./lib/legal-codes-repository.mjs";
import { createWasiCoreStore } from "./lib/wasi-core-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = __dirname;
const knowledgeRoot = path.resolve(projectRoot, "../archives-bf-ai");
const dexManifestPath = path.resolve(projectRoot, "../wasi-dex/exports/afex_all54_manifest.json");
const SOURCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SOURCE_REFRESH_CHECK_MS = 60 * 60 * 1000;

dotenv.config({ path: path.join(projectRoot, ".env") });

for (const fallbackPath of [
  path.join(projectRoot, ".env"),
  path.resolve(projectRoot, "../microfinance-app/.env"),
  path.resolve(projectRoot, "../archives-bf-ai/.env"),
]) {
  if (!existsSync(fallbackPath)) {
    continue;
  }

  try {
    const parsed = dotenv.parse(readFileSync(fallbackPath, "utf8"));
    if (!process.env.ANTHROPIC_API_KEY && parsed.ANTHROPIC_API_KEY) {
      process.env.ANTHROPIC_API_KEY = parsed.ANTHROPIC_API_KEY;
    }
    if (!process.env.ANTHROPIC_MODEL && parsed.ANTHROPIC_MODEL) {
      process.env.ANTHROPIC_MODEL = parsed.ANTHROPIC_MODEL;
    }
    if (!process.env.PORT && parsed.PORT) {
      process.env.PORT = parsed.PORT;
    }
  } catch {
    // Ignore unreadable fallback configuration files.
  }
}

const PORT = Number(process.env.PORT || 3200);
const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;
const wasiCore = createWasiCoreStore({
  projectRoot,
  manifestPath: dexManifestPath,
  filename: process.env.WASI_CORE_DB_PATH || undefined,
});

const COVERAGE_LABELS = {
  deep: "Couverture nationale approfondie",
  regional: "Couverture régionale BCEAO / UMOA / UEMOA",
  directory: "Couverture annuaire pays UA",
};

const COVERAGE_BASE_SCORES = {
  deep: 84,
  regional: 70,
  directory: 54,
};

const COVERAGE_SUMMARIES = {
  deep: "Le pays dispose d'une couverture nationale plus riche dans la base IA, avec des sources officielles directement exploitables.",
  regional:
    "Le pays est couvert à travers le cadre régional BCEAO / UMOA / UEMOA, utile pour l'analyse microfinance mais à compléter selon le besoin national.",
  directory:
    "La base IA connaît le pays au niveau institutionnel continental, mais la réglementation microfinance nationale n'est pas encore indexée en profondeur.",
};

const HTML_NAME_ALIASES = new Map(
  [
    ["Cote d'Ivoire", "Côte d’Ivoire"],
    ["Guinee", "Guinea"],
    ["Guinee-Bissau", "Guinea-Bissau"],
    ["Guinee Equatoriale", "Equatorial Guinea"],
    ["RD Congo", "DR Congo"],
    ["Erythree", "Eritrea"],
    ["Egypte", "Egypt"],
    ["Algerie", "Algeria"],
    ["Maurice", "Mauritius"],
    ["Comores", "Comoros"],
    ["Cap-Vert", "Cabo Verde"],
    ["Centrafrique", "Central African Republic"],
    ["Afrique du Sud", "South Africa"],
    ["Soudan du Sud", "South Sudan"],
    ["Sierra Leone", "Sierra Leone"],
    ["Eswatini", "Eswatini"],
  ].map(([left, right]) => [normalizeText(left), normalizeText(right)]),
);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toConversationTranscript(history = []) {
  return history
    .slice(-8)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n");
}

function toAnthropicMessages(history = []) {
  return history
    .slice(-8)
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim(),
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));
}

function extractTextContent(message) {
  return (message.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function readBearerToken(request) {
  const raw = request.get("authorization") || "";
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function attachSessionUser(request, _response, next) {
  const token = readBearerToken(request);
  const session = token ? wasiCore.getSession(token) : null;
  request.wasiSession = session;
  request.wasiUser = session?.user || null;
  next();
}

function requireRole(...roles) {
  const allowed = new Set(roles);
  return (request, response, next) => {
    if (!request.wasiUser) {
      response.status(401).json({ error: "Authentification requise." });
      return;
    }
    if (allowed.size && !allowed.has(request.wasiUser.roleId)) {
      response.status(403).json({ error: "Droit insuffisant pour cette opération." });
      return;
    }
    next();
  };
}

function buildCoreSessionPayload(request) {
  if (!request.wasiSession || !request.wasiUser) {
    return null;
  }

  return {
    user: request.wasiUser,
    tokenExpiresAt: request.wasiSession.expiresAt,
    tokenIssuedAt: request.wasiSession.issuedAt,
  };
}

function buildCoreBootstrapPayload(request) {
  return {
    session: buildCoreSessionPayload(request),
    roles: wasiCore.listRoles(),
    modules: wasiCore.listModules(),
    market: wasiCore.getMarketSummary(),
    audit: wasiCore.getAuditSummary(),
    demoUsers: wasiCore.listDemoUsers(),
    source: buildSourcePayload(),
    database: {
      driver: "node:sqlite",
      path: wasiCore.dbPath,
    },
  };
}

function mapLegacyRoleInput(value) {
  const normalized = String(value || "").trim().toUpperCase();
  switch (normalized) {
    case "MANAGER":
      return "admin";
    case "TELLER":
      return "microfinance";
    case "CLIENT":
      return "investor";
    default:
      return String(value || "").trim().toLowerCase();
  }
}

function toLegacyRole(roleId) {
  switch (roleId) {
    case "admin":
    case "analyst":
      return "MANAGER";
    case "microfinance":
      return "TELLER";
    default:
      return "CLIENT";
  }
}

function auditEntriesToLegacy(entries) {
  return entries.map((entry) => ({
    id: entry.id,
    action: entry.action,
    status: entry.status,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    detail_json: entry.detailJson || JSON.stringify(entry.detail || null),
    created_at_utc: entry.createdAtUtc || entry.createdAt,
    actor_username: entry.actorUsername || entry.actorName || null,
  }));
}

function ordersToCsv(orders) {
  const lines = [
    [
      "id",
      "portfolio_id",
      "user_id",
      "ticker",
      "side",
      "quantity",
      "limit_price",
      "status",
      "channel",
      "created_at",
      "updated_at",
    ].join(","),
  ];

  for (const order of orders) {
    const values = [
      order.id,
      order.portfolioId,
      order.userId,
      order.ticker,
      order.side,
      order.quantity,
      order.limitPrice,
      order.status,
      order.channel,
      order.createdAt,
      order.updatedAt,
    ].map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`);
    lines.push(values.join(","));
  }

  return lines.join("\n");
}

function getSourceTimestamp(indexDocument) {
  if (!indexDocument?.ingestedAt) {
    return null;
  }

  const value = Date.parse(indexDocument.ingestedAt);
  return Number.isFinite(value) ? value : null;
}

function getSourceAgeHours(indexDocument) {
  const timestamp = getSourceTimestamp(indexDocument);
  if (!timestamp) {
    return null;
  }

  return Math.max(0, (Date.now() - timestamp) / (60 * 60 * 1000));
}

function sourceIsStale(indexDocument) {
  const timestamp = getSourceTimestamp(indexDocument);
  if (!timestamp) {
    return true;
  }

  return Date.now() - timestamp >= SOURCE_MAX_AGE_MS;
}

function getNextRefreshDueAt(indexDocument) {
  const timestamp = getSourceTimestamp(indexDocument);
  if (!timestamp) {
    return null;
  }

  return new Date(timestamp + SOURCE_MAX_AGE_MS).toISOString();
}

function translateKeySourceLabel(label) {
  switch (label) {
    case "African Union member states":
      return "États membres de l'Union africaine";
    case "Burkina Faso Ministry of Finance":
      return "Ministère des finances du Burkina Faso";
    case "BCEAO UMOA member states":
      return "États membres BCEAO / UMOA";
    case "BCEAO SFD regulation":
      return "Réglementation BCEAO des SFD";
    default:
      return label;
  }
}

function getLegalCodeIndex(definition) {
  return legalCodeIndexes.get(definition.key) || null;
}

function getLegalCodeError(definition) {
  return legalCodeIndexErrors.get(definition.key) || null;
}

function getLegalCodeRefreshState(definition) {
  return legalCodeRefreshStates.get(definition.key) || {
    inProgress: false,
    lastRefreshStartedAt: null,
    lastRefreshCompletedAt: null,
    lastRefreshReason: null,
    lastRefreshError: null,
    sourcePath: null,
    refreshRequired: true,
  };
}

function buildLegalCodeSourcePayload(definition) {
  const indexDocument = getLegalCodeIndex(definition);
  const refreshState = getLegalCodeRefreshState(definition);
  const indexError = getLegalCodeError(definition);

  return {
    id: definition.id,
    key: definition.key,
    title: indexDocument?.title || definition.title,
    sourceLabel: indexDocument?.sourceLabel || definition.sourceLabel,
    archiveUrl: indexDocument?.siteUrl || definition.siteUrl || null,
    siteUrl: indexDocument?.siteUrl || definition.siteUrl || null,
    embeddedAssetPath: indexDocument?.sourceFile?.path || null,
    storageMode: indexDocument?.sourceFile?.storageMode || "embedded-index",
    capturedAt: indexDocument?.ingestedAt || refreshState.lastRefreshCompletedAt || null,
    articleCount: indexDocument?.articleCount || 0,
    chunkCount: indexDocument?.chunkCount || 0,
    editionDate: indexDocument?.editionDate || null,
    lastModificationDate: indexDocument?.lastModificationDate || null,
    sourceReady: Boolean(indexDocument),
    sourceError: indexError ? indexError.message : null,
    refreshInProgress: refreshState.inProgress,
    lastRefreshAt: refreshState.lastRefreshCompletedAt || null,
    lastRefreshStartedAt: refreshState.lastRefreshStartedAt || null,
    lastRefreshReason: refreshState.lastRefreshReason || null,
    lastRefreshError: refreshState.lastRefreshError || null,
    refreshRequired: Boolean(refreshState.refreshRequired),
  };
}

function buildSourcePayload() {
  const legalCodeSources = LEGAL_CODE_DEFINITIONS.map((definition) => buildLegalCodeSourcePayload(definition));
  const commerceCodeSource = legalCodeSources.find((item) => item.key === "commerce") || null;
  const civilCodeSource = legalCodeSources.find((item) => item.key === "civil") || null;
  const penalCodeSource = legalCodeSources.find((item) => item.key === "penal") || null;
  const travailCodeSource = legalCodeSources.find((item) => item.key === "travail") || null;

  return {
    title: sourceIndex?.title || "WASI AI",
    sourceLabel: "Base officielle WASI AI Afrique",
    archiveUrl: sourceIndex?.siteUrl || AFRICA_MICROFINANCE_URL,
    capturedAt: sourceIndex?.ingestedAt || sourceRefreshState.lastRefreshCompletedAt || null,
    countryCount: sourceIndex?.countryCount || 0,
    documentCount: sourceIndex?.documentCount || 0,
    keySources: (sourceIndex?.keySources || []).map((item) => ({
      ...item,
      label: translateKeySourceLabel(item.label),
    })),
    aiEnabled: Boolean(anthropic),
    model: anthropic ? model : null,
    sourceReady: Boolean(sourceIndex),
    sourceError: sourceIndexError ? sourceIndexError.message : null,
    sourceAgeHours: getSourceAgeHours(sourceIndex),
    refreshInProgress: sourceRefreshState.inProgress,
    lastRefreshAt: sourceRefreshState.lastRefreshCompletedAt || null,
    lastRefreshStartedAt: sourceRefreshState.lastRefreshStartedAt || null,
    lastRefreshReason: sourceRefreshState.lastRefreshReason || null,
    lastRefreshError: sourceRefreshState.lastRefreshError || null,
    nextRefreshDueAt: getNextRefreshDueAt(sourceIndex),
    refreshRequired: !sourceIndex || sourceIsStale(sourceIndex),
    commerceCode: commerceCodeSource,
    civilCode: civilCodeSource,
    penalCode: penalCodeSource,
    travailCode: travailCodeSource,
    legalCodes: legalCodeSources,
    apps: wasiCore.listModules(),
    knowledgeBases: [
      {
        id: "africa-microfinance",
        title: sourceIndex?.title || "WASI AI Afrique",
        sourceLabel: "Base officielle WASI AI Afrique",
        sourceReady: Boolean(sourceIndex),
        sourceError: sourceIndexError ? sourceIndexError.message : null,
        refreshRequired: !sourceIndex || sourceIsStale(sourceIndex),
      },
      ...legalCodeSources,
    ],
  };
}

function normalizeCountryLookup(value) {
  const normalized = normalizeText(value);
  return HTML_NAME_ALIASES.get(normalized) || normalized;
}

function findIndexedCountry(name) {
  if (!sourceIndex?.countries?.length || !name) {
    return null;
  }

  const lookup = normalizeCountryLookup(name);
  return (
    sourceIndex.countries.find((country) => normalizeText(country.shortName) === lookup) ||
    sourceIndex.countries.find((country) => normalizeText(country.officialName) === lookup) ||
    sourceIndex.countries.find((country) =>
      (country.aliases || []).some((alias) => normalizeText(alias) === lookup),
    ) ||
    null
  );
}

function buildCountrySignalPayload(inputCountry) {
  const indexedCountry = findIndexedCountry(inputCountry.name);
  const juridicalScore = Number(inputCountry.juridique);
  const integrationScore = Number(inputCountry.integration);
  const baseScore = Number(inputCountry.baseScore);
  const coupPenalty = inputCountry.coup ? -4 : 1;
  const coverageLevel = indexedCountry?.coverageLevel || "directory";
  const coverageScore = COVERAGE_BASE_SCORES[coverageLevel] || COVERAGE_BASE_SCORES.directory;
  const bceaoSignal = indexedCountry?.bceaoFrameworkApplies ? 78 : 58;
  const authoritySignal = indexedCountry?.financeAuthority ? 84 : 56;
  const legalReadiness = Math.round(
    coverageScore * 0.42 +
      (Number.isFinite(juridicalScore) ? juridicalScore : 50) * 0.22 +
      (Number.isFinite(integrationScore) ? integrationScore : 50) * 0.16 +
      bceaoSignal * 0.12 +
      authoritySignal * 0.08,
  );
  const aiAdjustment = clamp(Math.round((legalReadiness - 60) / 7) + coupPenalty, -8, 10);
  const finalScore = clamp((Number.isFinite(baseScore) ? baseScore : 50) + aiAdjustment, 0, 100);

  const officialSources = (sourceIndex?.documents || [])
    .filter((document) => {
      const countries = document.countries || [];
      return (
        countries.includes(indexedCountry?.shortName) ||
        (indexedCountry?.bceaoFrameworkApplies && document.authority === "BCEAO")
      );
    })
    .slice(0, 4)
    .map((document) => ({
      id: document.id,
      title: document.title,
      authority: document.authority,
      url: document.sourceUrl,
    }));

  const frameworks = [];
  if (indexedCountry?.financeAuthority) {
    frameworks.push(indexedCountry.financeAuthority.name);
  }
  if (indexedCountry?.bceaoFrameworkApplies) {
    frameworks.push("Cadre BCEAO / UMOA / UEMOA");
  }
  if (!indexedCountry?.bceaoFrameworkApplies) {
    frameworks.push("Analyse microfinance à compléter par les autorités nationales");
  }
  frameworks.push(COVERAGE_LABELS[coverageLevel] || COVERAGE_LABELS.directory);

  const summaryParts = [
    COVERAGE_SUMMARIES[coverageLevel] || COVERAGE_SUMMARIES.directory,
    indexedCountry?.bceaoFrameworkApplies
      ? "Le cadre BCEAO peut nourrir le score WASI sur le volet institutionnel et prudentiel."
      : "Le score WASI IA reste prudent car le cadre prudentiel microfinance doit être confirmé au niveau national.",
    indexedCountry?.financeAuthority
      ? `Le ministère indexé renforce la traçabilité institutionnelle pour ${indexedCountry.shortName}.`
      : "L'IA dispose surtout d'un repère continental et régional, avec moins d'appui ministériel directement indexé.",
  ];

  return {
    code: inputCountry.code,
    name: inputCountry.name,
    baseScore: Number.isFinite(baseScore) ? baseScore : 50,
    aiAdjustment,
    finalScore,
    legalReadiness,
    coverageLevel,
    coverageLabel: COVERAGE_LABELS[coverageLevel] || COVERAGE_LABELS.directory,
    coverageNote:
      indexedCountry?.coverageNote ||
      "Couverture non détaillée. Le score IA repose surtout sur le profil pays et les signaux disponibles.",
    summary: summaryParts.join(" "),
    regulator: indexedCountry?.financeAuthority?.name || null,
    bceaoApplies: Boolean(indexedCountry?.bceaoFrameworkApplies),
    frameworks,
    officialSources,
    countryFound: Boolean(indexedCountry),
    matchedCountryName: indexedCountry?.shortName || null,
  };
}

function buildMatchedCountrySummary(matchedCountries) {
  return (
    matchedCountries
      .map(
        (country) =>
          `- ${country.shortName} | région : ${country.region} | UMOA : ${country.isUmoaMember ? "oui" : "non"} | couverture : ${country.coverageLevel}`,
      )
      .join("\n") || "Aucun pays n'a été identifié explicitement."
  );
}

function buildMatchedDocumentSummary(matchedDocuments) {
  return (
    matchedDocuments
      .map((document) => `- ${document.title} | autorité : ${document.authority} | type : ${document.documentType}`)
      .join("\n") || "Aucun document officiel n'a été identifié explicitement."
  );
}

function buildMatchedArticleSummary(matchedArticles) {
  return (
    matchedArticles
      .map(
        (article) =>
          `- ${article.codeTitle} | ${article.articleCode} | pages : ${article.pageStart}-${article.pageEnd} | chemin : ${article.headingPath || "non precise"}`,
      )
      .join("\n") || "Aucun article juridique francais n'a ete identifie explicitement."
  );
}

function normalizeRequestedCountryFocus(value) {
  if (!value) {
    return null;
  }

  const normalized = normalizeText(value);
  return normalized === "afrique" ? null : value;
}

function buildLocalChatFallback({
  message,
  countryFocus,
  countrySignal,
  contextChunks,
  matchedCountries,
  matchedArticles = [],
}) {
  const focusLabel = countryFocus || matchedCountries[0]?.shortName || "l'Afrique";
  const citations = contextChunks.slice(0, 3).map((chunk) => `[${chunk.id}]`).join(" ");

  if (matchedArticles.length) {
    const articleLabels = matchedArticles
      .slice(0, 3)
      .map((article) => `${article.codeTitle} ${article.articleCode}`)
      .join(", ");
    const excerpt = contextChunks
      .filter((chunk) => chunk.articleCode)
      .slice(0, 2)
      .map(
        (chunk) =>
          `${chunk.codeTitle} ${chunk.articleCode} : ${String(chunk.text || "").replace(/\s+/g, " ").slice(0, 280)}...`,
      )
      .join("\n");

    return [
      `Base juridique mobilisee : ${articleLabels}.`,
      excerpt || "Aucun extrait textuel n'a pu etre produit a partir des segments juridiques indexes.",
      citations ? `Citations : ${citations}` : "Aucune citation textuelle n'a pu etre extraite.",
      `Question recue : ${message}`,
    ].join("\n\n");
  }

  const scoreText = countrySignal
    ? `Score WASI IA ${countrySignal.finalScore}/100, soit ${countrySignal.aiAdjustment >= 0 ? "+" : ""}${countrySignal.aiAdjustment} point(s) par rapport au score de base.`
    : "Le score WASI IA n'a pas pu être enrichi pour ce pays faute de correspondance explicite.";

  return [
    `Synthèse WASI AI pour ${focusLabel}. ${scoreText}`,
    countrySignal?.summary || "La base officielle disponible reste partielle et l'analyse doit rester prudente.",
    citations ? `Sources mobilisées : ${citations}` : "Aucune citation officielle précise n'a pu être extraite.",
    `Question reçue : ${message}`,
  ].join("\n\n");
}

let sourceIndex = null;
let sourceIndexError = null;

try {
  sourceIndex = await loadAfricaMicrofinanceIndex(knowledgeRoot);
} catch (error) {
  sourceIndexError = error;
}

const sourceRefreshState = {
  inProgress: false,
  lastRefreshStartedAt: null,
  lastRefreshCompletedAt: sourceIndex?.ingestedAt || null,
  lastRefreshReason: sourceIndex ? "startup-load" : null,
  lastRefreshError: sourceIndexError ? sourceIndexError.message : null,
};

let refreshPromise = null;

async function refreshSourceIndex({ force = false, reason = "manual" } = {}) {
  if (refreshPromise) {
    return refreshPromise;
  }

  const needsRefresh = force || !sourceIndex || sourceIsStale(sourceIndex);
  if (!needsRefresh) {
    return { refreshed: false, sourceIndex };
  }

  sourceRefreshState.inProgress = true;
  sourceRefreshState.lastRefreshStartedAt = new Date().toISOString();
  sourceRefreshState.lastRefreshReason = reason;
  sourceRefreshState.lastRefreshError = null;

  refreshPromise = (async () => {
    try {
      const { document } = await ingestAfricaMicrofinanceIndex(knowledgeRoot);
      sourceIndex = document;
      sourceIndexError = null;
      sourceRefreshState.lastRefreshCompletedAt = document.ingestedAt || new Date().toISOString();
      return { refreshed: true, sourceIndex: document };
    } catch (error) {
      sourceIndexError = error;
      sourceRefreshState.lastRefreshError = error.message;
      throw error;
    } finally {
      sourceRefreshState.inProgress = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function triggerRefreshIfStale(reason) {
  if (refreshPromise || (sourceIndex && !sourceIsStale(sourceIndex))) {
    return;
  }

  void refreshSourceIndex({ force: !sourceIndex, reason }).catch((error) => {
    console.error(`Source refresh failed (${reason})`, error);
  });
}

async function ensureSourceIndexAvailable(reason) {
  if (sourceIndex) {
    triggerRefreshIfStale(reason);
    return true;
  }

  try {
    await refreshSourceIndex({ force: true, reason });
  } catch {
    // The caller will handle the stored error below.
  }

  return Boolean(sourceIndex);
}

triggerRefreshIfStale("startup");
const refreshTimer = setInterval(() => {
  triggerRefreshIfStale("interval");
}, SOURCE_REFRESH_CHECK_MS);
refreshTimer.unref?.();

const legalCodeIndexes = new Map();
const legalCodeIndexErrors = new Map();
const legalCodeRefreshStates = new Map();
const legalCodeRefreshPromises = new Map();

for (const definition of LEGAL_CODE_DEFINITIONS) {
  let indexDocument = null;
  let indexError = null;

  try {
    indexDocument = await loadLegalCodeIndex(projectRoot, definition);
  } catch (error) {
    indexError = error;
  }

  legalCodeIndexes.set(definition.key, indexDocument);
  legalCodeIndexErrors.set(definition.key, indexError);
  legalCodeRefreshStates.set(definition.key, {
    inProgress: false,
    lastRefreshStartedAt: null,
    lastRefreshCompletedAt: indexDocument?.ingestedAt || null,
    lastRefreshReason: indexDocument ? "startup-load" : null,
    lastRefreshError: indexError ? indexError.message : null,
    sourcePath: indexDocument?.sourceFile?.path || null,
    refreshRequired: !indexDocument,
  });
}

async function computeLegalCodeRefreshRequired(definition) {
  const refreshState = getLegalCodeRefreshState(definition);
  const indexDocument = getLegalCodeIndex(definition);

  try {
    const resolvedPath = await resolveLegalCodePdfPath(projectRoot, definition);
    const descriptor = statSync(resolvedPath);
    const cachedTimestamp = Number(indexDocument?.sourceFile?.lastModifiedMs || 0);

    refreshState.sourcePath = resolvedPath;
    refreshState.refreshRequired = !indexDocument || descriptor.mtimeMs > cachedTimestamp;
    return refreshState.refreshRequired;
  } catch (error) {
    if (!indexDocument) {
      legalCodeIndexErrors.set(definition.key, error);
      refreshState.lastRefreshError = error.message;
      refreshState.refreshRequired = true;
      return true;
    }

    refreshState.refreshRequired = false;
    return false;
  }
}

async function refreshLegalCodeIndex(definition, { force = false, reason = "manual" } = {}) {
  const currentPromise = legalCodeRefreshPromises.get(definition.key);
  if (currentPromise) {
    return currentPromise;
  }

  const refreshState = getLegalCodeRefreshState(definition);
  const indexDocument = getLegalCodeIndex(definition);
  const needsRefresh = force || (await computeLegalCodeRefreshRequired(definition));
  if (!needsRefresh) {
    return { refreshed: false, legalCodeIndex: indexDocument };
  }

  refreshState.inProgress = true;
  refreshState.lastRefreshStartedAt = new Date().toISOString();
  refreshState.lastRefreshReason = reason;
  refreshState.lastRefreshError = null;

  const refreshPromise = (async () => {
    try {
      const { document } = await ingestLegalCodeIndex(projectRoot, definition);
      legalCodeIndexes.set(definition.key, document);
      legalCodeIndexErrors.set(definition.key, null);
      refreshState.lastRefreshCompletedAt = document.ingestedAt || new Date().toISOString();
      refreshState.sourcePath = document.sourceFile?.path || refreshState.sourcePath;
      refreshState.refreshRequired = false;
      return { refreshed: true, legalCodeIndex: document };
    } catch (error) {
      legalCodeIndexErrors.set(definition.key, error);
      refreshState.lastRefreshError = error.message;
      refreshState.refreshRequired = true;
      throw error;
    } finally {
      refreshState.inProgress = false;
      legalCodeRefreshPromises.delete(definition.key);
    }
  })();

  legalCodeRefreshPromises.set(definition.key, refreshPromise);
  return refreshPromise;
}

async function ensureLegalCodeIndexAvailable(definition, reason) {
  if (getLegalCodeIndex(definition)) {
    const refreshRequired = await computeLegalCodeRefreshRequired(definition);
    if (refreshRequired && !legalCodeRefreshPromises.get(definition.key)) {
      void refreshLegalCodeIndex(definition, { reason }).catch((error) => {
        console.error(`${definition.title} refresh failed (${reason})`, error);
      });
    }
    return true;
  }

  try {
    await refreshLegalCodeIndex(definition, { force: true, reason });
  } catch {
    // The caller will rely on the stored error.
  }

  return Boolean(getLegalCodeIndex(definition));
}

async function ensureAllLegalCodeIndexesAvailable(reason) {
  await Promise.all(LEGAL_CODE_DEFINITIONS.map((definition) => ensureLegalCodeIndexAvailable(definition, reason)));
}

function triggerManualKnowledgeBaseRefresh(reason = "manual-api") {
  void refreshSourceIndex({ force: true, reason }).catch((error) => {
    console.error(`Source refresh failed (${reason})`, error);
  });

  for (const definition of LEGAL_CODE_DEFINITIONS) {
    void refreshLegalCodeIndex(definition, { reason }).catch((error) => {
      console.error(`${definition.title} refresh failed (${reason})`, error);
    });
  }
}

void ensureAllLegalCodeIndexesAvailable("startup");

const app = express();

app.use((request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Access-Control-Request-Private-Network",
  );
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Vary", "Origin, Access-Control-Request-Private-Network");
  if (request.get("access-control-request-private-network") === "true") {
    response.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  next();
});

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(attachSessionUser);
app.use(express.static(projectRoot));

app.get("/api/core/bootstrap", async (request, response) => {
  await ensureSourceIndexAvailable("core-bootstrap");
  await ensureAllLegalCodeIndexesAvailable("core-bootstrap");
  response.json(buildCoreBootstrapPayload(request));
});

app.post("/api/core/auth/demo-login", async (request, response) => {
  const accessCode =
    typeof request.body?.accessCode === "string" ? request.body.accessCode.trim() : "";

  if (!accessCode) {
    response.status(400).json({ error: "accessCode is required." });
    return;
  }

  const login = wasiCore.loginDemo(accessCode, {
    ip: request.ip,
    userAgent: request.get("user-agent") || null,
  });

  if (!login) {
    response.status(401).json({ error: "Code d'accès démo invalide." });
    return;
  }

  await ensureSourceIndexAvailable("core-login");
  await ensureAllLegalCodeIndexesAvailable("core-login");
  response.json({
    ok: true,
    token: login.token,
    session: {
      user: login.user,
      tokenIssuedAt: login.session.issuedAt,
      tokenExpiresAt: login.session.expiresAt,
    },
    bootstrap: buildCoreBootstrapPayload({
      ...request,
      wasiUser: login.user,
      wasiSession: login.session,
    }),
  });
});

app.get("/api/core/session", (request, response) => {
  if (!request.wasiUser) {
    response.status(401).json({ error: "Aucune session active." });
    return;
  }

  response.json(buildCoreSessionPayload(request));
});

app.get("/api/core/modules", (request, response) => {
  response.json({
    modules: wasiCore.listModules(),
  });
});

app.get("/api/core/market/summary", (request, response) => {
  response.json({
    market: wasiCore.getMarketSummary(),
  });
});

app.get("/api/health", (_request, response) => {
  response.json(wasiCore.getHealth());
});

app.post("/api/auth/login", async (request, response) => {
  const identity =
    typeof request.body?.username === "string"
      ? request.body.username.trim()
      : typeof request.body?.email === "string"
        ? request.body.email.trim()
        : "";
  const password = typeof request.body?.password === "string" ? request.body.password : "";

  if (!identity || !password) {
    response.status(400).json({ detail: "username/email and password are required." });
    return;
  }

  const login = wasiCore.loginWithPassword(identity, password, {
    ip: request.ip,
    userAgent: request.get("user-agent") || null,
  });

  if (!login) {
    response.status(401).json({ detail: "Identifiants invalides." });
    return;
  }

  response.json({
    access_token: login.token,
    token_type: "bearer",
    user: login.user,
  });
});

app.get("/api/auth/me", (request, response) => {
  if (!request.wasiUser) {
    response.status(401).json({ detail: "Not authenticated." });
    return;
  }

  response.json({
    id: request.wasiUser.id,
    username: request.wasiUser.username,
    email: request.wasiUser.email,
    role: toLegacyRole(request.wasiUser.roleId),
    role_id: request.wasiUser.roleId,
    tier: request.wasiUser.roleLabel,
  });
});

app.get("/api/v1/market/funds", (request, response) => {
  response.json({
    funds: wasiCore.listFunds(),
  });
});

app.get("/api/v1/stock-market/listings", (request, response) => {
  response.json({
    listings: wasiCore.listStockMarketListings(),
  });
});

app.get("/api/v1/stock-market/issuers", (request, response) => {
  response.json({
    issuers: wasiCore.listIssuers(),
    admissionCases: wasiCore.listAdmissionCases(),
  });
});

app.get("/api/v1/stock-market/portfolio", (request, response) => {
  const userId = request.wasiUser?.id || "usr_investor_001";
  const portfolio = wasiCore.getPortfolioForUser(userId) || wasiCore.getPortfolioForUser("usr_investor_001");
  response.json({
    portfolio,
  });
});

app.get("/api/v1/watchlists", (request, response) => {
  response.json({
    watchlists: wasiCore.listWatchlists(),
  });
});

app.get("/api/core/audit", requireRole("admin", "analyst"), (request, response) => {
  const limit = clamp(Number(request.query.limit || 25), 1, 100);
  response.json({
    audit: wasiCore.listAudit(limit),
    summary: wasiCore.getAuditSummary(),
  });
});

app.get("/api/v1/admin/audit/summary", requireRole("admin", "analyst"), (request, response) => {
  const summary = wasiCore.getAuditSummary();
  const recentFailures = auditEntriesToLegacy(
    wasiCore.searchAudit({ status: "FAILURE", limit: 8 }),
  );
  response.json({
    totalEntries: summary.total,
    last24h: summary.last24h,
    failureCount: summary.failureCount,
    recentFailures,
  });
});

app.get("/api/v1/admin/audit/search", requireRole("admin", "analyst"), (request, response) => {
  const action = typeof request.query.action === "string" ? request.query.action.trim() : "";
  const status = typeof request.query.status === "string" ? request.query.status.trim() : "";
  const limit = clamp(Number(request.query.limit || 50), 1, 100);
  response.json({
    entries: auditEntriesToLegacy(wasiCore.searchAudit({ action, status, limit })),
  });
});

app.get("/api/v1/admin/users", requireRole("admin", "analyst"), (request, response) => {
  response.json({
    users: wasiCore.listUsers().map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      role: toLegacyRole(user.roleId),
      role_id: user.roleId,
      is_active: user.isActive,
    })),
  });
});

app.post("/api/v1/admin/users/:id/role", requireRole("admin"), (request, response) => {
  const roleId = mapLegacyRoleInput(request.body?.role);
  wasiCore.updateUserRole(request.params.id, roleId, request.wasiUser.id);
  response.json({ ok: true });
});

app.post("/api/v1/admin/users/:id/status", requireRole("admin"), (request, response) => {
  const isActive = Boolean(request.body?.is_active);
  wasiCore.updateUserStatus(request.params.id, isActive, request.wasiUser.id);
  response.json({ ok: true });
});

app.get("/api/v1/admin/alerts", requireRole("admin", "analyst"), (request, response) => {
  const limit = clamp(Number(request.query.limit || 50), 1, 100);
  response.json({
    alerts: wasiCore.listAlerts(limit),
  });
});

app.post("/api/v1/admin/alerts/:id/acknowledge", requireRole("admin", "analyst"), (request, response) => {
  wasiCore.acknowledgeAlert(request.params.id, request.wasiUser.id);
  response.json({ ok: true });
});

app.get("/api/v1/banking/transactions/export", requireRole("admin", "analyst"), (request, response) => {
  const csv = ordersToCsv(wasiCore.listOrders());
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader("Content-Disposition", "attachment; filename=\"wasi_transactions.csv\"");
  response.send(csv);
});

app.get("/api/source", async (_request, response) => {
  await ensureSourceIndexAvailable("source-status");
  await ensureAllLegalCodeIndexesAvailable("source-status");
  response.json({
    ...buildSourcePayload(),
    siteUrl: AFRICA_MICROFINANCE_URL,
  });
});

app.post("/api/source/refresh", async (_request, response) => {
  try {
    triggerManualKnowledgeBaseRefresh("manual-api");
    wasiCore.logAudit({
      actorUserId: _request.wasiUser?.id || null,
      action: "source.refresh.manual",
      entityType: "source-index",
      entityId: "knowledge-bases",
      detail: {
        reason: "manual-api",
        knowledgeBases: ["africa-microfinance", ...LEGAL_CODE_DEFINITIONS.map((definition) => definition.id)],
        mode: "background",
      },
    });
    response.status(202).json({
      ok: true,
      refreshAccepted: true,
      ...buildSourcePayload(),
      siteUrl: AFRICA_MICROFINANCE_URL,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error.message,
      ...buildSourcePayload(),
      siteUrl: AFRICA_MICROFINANCE_URL,
    });
  }
});

app.post("/api/intelligence/countries", async (request, response) => {
  const countries = Array.isArray(request.body?.countries) ? request.body.countries : [];
  if (!countries.length) {
    response.status(400).json({ error: "countries is required." });
    return;
  }

  if (!(await ensureSourceIndexAvailable("country-signals"))) {
    response.status(503).json({
      error:
        sourceIndexError?.message ||
        "La base officielle WASI AI n'est pas prête. Lancez d'abord l'ingestion des sources.",
    });
    return;
  }

  wasiCore.logAudit({
    actorUserId: request.wasiUser?.id || null,
    action: "intelligence.country_signals",
    entityType: "country-signal",
    entityId: "batch",
    detail: {
      countryCount: countries.length,
    },
  });

  response.json({
    countries: countries.map((country) => buildCountrySignalPayload(country)),
    source: buildSourcePayload(),
  });
});

app.post("/wasi/chat", async (request, response) => {
  const message = typeof request.body?.message === "string" ? request.body.message.trim() : "";
  const history = Array.isArray(request.body?.history) ? request.body.history : [];
  const countryFocus =
    typeof request.body?.country_focus === "string" && request.body.country_focus.trim()
      ? normalizeRequestedCountryFocus(request.body.country_focus.trim())
      : null;
  const countryProfile =
    request.body?.country_profile && typeof request.body.country_profile === "object"
      ? request.body.country_profile
      : null;

  if (!message) {
    response.status(400).json({ error: "message is required." });
    return;
  }

  const effectiveQuestion =
    countryFocus && !normalizeText(message).includes(normalizeText(countryFocus))
      ? `${message}\n\nFocus pays prioritaire : ${countryFocus}`
      : message;

  const africaReady = await ensureSourceIndexAvailable("wasi-chat");
  const requestedLegalCodeKeys = detectRelevantLegalCodeKeys(effectiveQuestion, legalCodeIndexes);
  const requestedLegalCodeDefinitions = LEGAL_CODE_DEFINITIONS.filter((definition) =>
    requestedLegalCodeKeys.includes(definition.key),
  );
  const legalCodeAvailability = await Promise.all(
    requestedLegalCodeDefinitions.map((definition) => ensureLegalCodeIndexAvailable(definition, "wasi-chat")),
  );
  const readyLegalCodeDefinitions = requestedLegalCodeDefinitions.filter((_, index) => legalCodeAvailability[index]);

  if (!africaReady && !readyLegalCodeDefinitions.length) {
    const firstLegalCodeError = requestedLegalCodeDefinitions
      .map((definition) => getLegalCodeError(definition))
      .find(Boolean);
    response.status(503).json({
      error:
        sourceIndexError?.message ||
        firstLegalCodeError?.message ||
        "Aucune base WASI exploitable n'est prete. Rechargez les sources puis reessayez.",
      source: buildSourcePayload(),
    });
    return;
  }

  let africaContextChunks = [];
  let matchedCountries = [];
  let matchedDocuments = [];
  if (africaReady) {
    const africaContext = await buildQuestionContext(knowledgeRoot, sourceIndex, effectiveQuestion);
    africaContextChunks = africaContext.contextChunks;
    matchedCountries = africaContext.matchedCountries;
    matchedDocuments = africaContext.matchedDocuments;
  }

  let matchedArticles = [];
  const legalCodeContextChunks = [];
  for (const definition of readyLegalCodeDefinitions) {
    const indexDocument = getLegalCodeIndex(definition);
    if (!indexDocument) {
      continue;
    }

    const legalCodeContext = await buildLegalCodeQuestionContext(indexDocument, effectiveQuestion);
    legalCodeContextChunks.push(...legalCodeContext.contextChunks);

    for (const article of legalCodeContext.matchedArticles) {
      if (
        !matchedArticles.some(
          (item) => item.codeId === article.codeId && item.articleLookupKey === article.articleLookupKey,
        )
      ) {
        matchedArticles.push(article);
      }
    }
  }

  const contextChunks = Array.from(
    [...africaContextChunks, ...legalCodeContextChunks].reduce((map, chunk) => {
      const existing = map.get(chunk.id);
      if (!existing || (chunk.score || 0) > (existing.score || 0)) {
        map.set(chunk.id, chunk);
      }
      return map;
    }, new Map()).values(),
  )
    .sort((left, right) => (right.score || 0) - (left.score || 0))
    .slice(0, 8);

  const signalLookupCountry =
    countryProfile ||
    (countryFocus
      ? {
          code: null,
          name: countryFocus,
          baseScore: 50,
          coup: false,
          juridique: 50,
          integration: 50,
        }
      : null);
  const countrySignal = signalLookupCountry ? buildCountrySignalPayload(signalLookupCountry) : null;
  const knowledgeBasesUsed = [
    ...(africaReady ? ["africa-microfinance"] : []),
    ...readyLegalCodeDefinitions.map((definition) => definition.id),
  ];
  const auditEntityId = matchedArticles[0]?.articleCode || countryFocus || "general";

  if (!anthropic) {
    wasiCore.logAudit({
      actorUserId: request.wasiUser?.id || null,
      action: "ai.chat.local_fallback",
      entityType: "chat",
      entityId: auditEntityId,
      detail: {
        matchedCountries: matchedCountries.map((country) => country.shortName),
        matchedArticles: matchedArticles.map((article) => article.articleCode),
        knowledgeBasesUsed,
      },
    });
    response.json({
      reply: buildLocalChatFallback({
        message,
        countryFocus,
        countrySignal,
        contextChunks,
        matchedCountries,
        matchedArticles,
      }),
      citations: contextChunks.slice(0, 6),
      matchedCountries,
      matchedDocuments,
      matchedArticles,
      countrySignal,
      source: buildSourcePayload(),
      groundedOnly: true,
      model: null,
    });
    return;
  }

  const instructions = [
    "Tu es WASI AI, la couche d'intelligence documentaire de la plateforme WASI.",
    "Tu peux t'appuyer sur les sources officielles africaines WASI et sur quatre codes francais embarques: code de commerce, code civil, code penal et code du travail.",
    "Réponds toujours en français dans un style net, stratégique et agréable à lire.",
    "Privilégie des paragraphes courts et des puces simples quand elles sont utiles.",
    "N'utilise pas de titres markdown, pas de tableaux markdown et pas de mise en forme lourde.",
    "Garde la réponse concise et directement exploitable dans une interface produit.",
    "Quand un pays ne dispose que d'une couverture annuaire ou régionale, indique-le clairement.",
    "Ne présente pas un cadre régional comme une loi nationale si le contexte ne le permet pas.",
    "N'applique jamais par défaut un code francais a un pays africain sans le dire explicitement.",
    "Quand le contexte juridique provient d'un code francais embarque, cite le code et les articles concernes puis distingue le texte source de ton interpretation operationnelle.",
    "Appuie chaque affirmation factuelle issue du contexte officiel avec des identifiants de citation entre crochets, par exemple [country-burkina-faso-profile].",
    "N'invente ni règles, ni institutions, ni dates, ni autorités nationales au-dela du contexte fourni.",
    "Quand la question porte sur le score WASI, explique en quoi la couche IA ajuste le score de base: gouvernance réglementaire, cadre prudentiel, traçabilité institutionnelle, profondeur des sources.",
    "Ne dis jamais que ton analyse remplace un avis juridique ou réglementaire formel.",
  ].join(" ");

  const prompt = [
    "Base(s) mobilisee(s) :",
    knowledgeBasesUsed.join(", ") || "Aucune base explicite mobilisee.",
    "",
    "Contexte officiel :",
    formatContextChunks(contextChunks) || "Aucun contexte officiel exploitable n'a ete trouve.",
    "",
    "Codes juridiques francais mobilises :",
    readyLegalCodeDefinitions.map((definition) => `- ${definition.title}`).join("\n") || "Aucun code juridique francais mobilise.",
    "",
    "Pays repérés :",
    buildMatchedCountrySummary(matchedCountries),
    "",
    "Documents officiels repérés :",
    buildMatchedDocumentSummary(matchedDocuments),
    "",
    "Articles du Code de commerce reperes :",
    buildMatchedArticleSummary(matchedArticles),
    "",
    "Signal WASI IA du pays focal :",
    countrySignal ? JSON.stringify(countrySignal, null, 2) : "Aucun signal pays spécifique n'a été construit.",
    "",
    "Profil WASI local du pays focal :",
    countryProfile ? JSON.stringify(countryProfile, null, 2) : "Aucun profil local pays n'a été fourni.",
    "",
    "Conversation récente :",
    toConversationTranscript(history) || "Aucun échange préalable.",
    "",
    `Question utilisateur : ${message}`,
  ].join("\n");

  try {
    const aiResponse = await anthropic.messages.create({
      model,
      system: instructions,
      max_tokens: 950,
      messages: [
        ...toAnthropicMessages(history),
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const reply = extractTextContent(aiResponse) || "Je n'ai pas pu produire une réponse exploitable à partir des sources officielles.";

    wasiCore.logAudit({
      actorUserId: request.wasiUser?.id || null,
      action: "ai.chat.grounded",
      entityType: "chat",
      entityId: auditEntityId,
      detail: {
        matchedCountries: matchedCountries.map((country) => country.shortName),
        matchedArticles: matchedArticles.map((article) => article.articleCode),
        knowledgeBasesUsed,
        citationCount: contextChunks.slice(0, 8).length,
      },
    });

    response.json({
      reply,
      citations: contextChunks.slice(0, 8),
      matchedCountries,
      matchedDocuments,
      matchedArticles,
      countrySignal,
      source: buildSourcePayload(),
      groundedOnly: true,
      model,
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({
      error: "La requête WASI AI a échoué. Vérifiez la configuration Anthropic puis réessayez.",
      citations: contextChunks.slice(0, 6),
      matchedArticles,
      countrySignal,
      source: buildSourcePayload(),
    });
  }
});

app.get("/", (_request, response) => {
  response.sendFile(path.join(projectRoot, "wasi-platform-index.html"));
});

app.get("/wasi-core-console", (_request, response) => {
  response.redirect("/wasi-core-console.html");
});

app.listen(PORT, () => {
  console.log(`WASI AI disponible sur http://localhost:${PORT}`);
});
