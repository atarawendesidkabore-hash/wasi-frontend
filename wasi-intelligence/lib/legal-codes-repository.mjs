import os from "node:os";
import path from "node:path";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";

import { PDFParse } from "pdf-parse";

import { normalizeText, rankChunks } from "../../archives-bf-ai/lib/search-utils.mjs";

export const LEGAL_CODE_EMBEDDED_DIR = path.join("data", "legal");

export const LEGAL_CODE_DEFINITIONS = [
  {
    key: "commerce",
    id: "code-commerce-fr",
    title: "Code de commerce",
    sourceLabel: "Code de commerce francais",
    siteUrl: "https://codes.droit.org/",
    indexFile: "code-commerce-fr-index.json",
    candidateFilenames: [
      "Code de commerce_compressed.pdf",
      "Code de commerce.pdf",
      "code-de-commerce.pdf",
    ],
    envVar: "CODE_COMMERCE_PDF_PATH",
    detectionTerms: [
      "code de commerce",
      "acte de commerce",
      "actes de commerce",
      "commercant",
      "commercants",
      "fonds de commerce",
      "bail commercial",
      "registre du commerce",
      "rcs",
      "societe commerciale",
      "societes commerciales",
      "sarl",
      "sas",
      "sasu",
      "snc",
      "groupe d interet economique",
      "procedure collective",
      "procedures collectives",
      "sauvegarde",
      "redressement judiciaire",
      "liquidation judiciaire",
      "conciliation",
      "mandat ad hoc",
      "cession du fonds",
      "nantissement",
      "commissaire aux comptes",
      "comptes annuels",
      "greffe",
    ],
  },
  {
    key: "civil",
    id: "code-civil-fr",
    title: "Code civil",
    sourceLabel: "Code civil francais",
    siteUrl: "https://codes.droit.org/",
    indexFile: "code-civil-fr-index.json",
    candidateFilenames: [
      "Code civil_compressed.pdf",
      "Code civil.pdf",
      "code-civil.pdf",
    ],
    envVar: "CODE_CIVIL_PDF_PATH",
    detectionTerms: [
      "code civil",
      "responsabilite civile",
      "obligation civile",
      "vie privee",
      "etat civil",
      "nationalite francaise",
      "mariage",
      "divorce",
      "filiation",
      "succession",
      "heritage",
      "donation",
      "usufruit",
      "servitude",
      "propriete",
      "contrat civil",
      "capacite juridique",
      "personnes",
      "droits civils",
    ],
  },
  {
    key: "penal",
    id: "code-penal-fr",
    title: "Code pénal",
    sourceLabel: "Code penal francais",
    siteUrl: "https://codes.droit.org/",
    indexFile: "code-penal-fr-index.json",
    candidateFilenames: [
      "Code pénal_compressed.pdf",
      "Code penal_compressed.pdf",
      "Code pénal.pdf",
      "Code penal.pdf",
      "code-penal.pdf",
    ],
    envVar: "CODE_PENAL_PDF_PATH",
    detectionTerms: [
      "code penal",
      "loi penale",
      "responsabilite penale",
      "infraction",
      "crime",
      "delit",
      "contravention",
      "peine",
      "peines",
      "amende penale",
      "vol",
      "violence",
      "homicide",
      "escroquerie",
      "abus de confiance",
      "sanction penale",
    ],
  },
  {
    key: "travail",
    id: "code-travail-fr",
    title: "Code du travail",
    sourceLabel: "Code du travail francais",
    siteUrl: "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006072050/",
    indexFile: "code-travail-fr-index.json",
    candidateFilenames: [
      "LEGITEXT000006072050_compressed.pdf",
      "Code du travail_compressed.pdf",
      "Code du travail.pdf",
      "code-du-travail.pdf",
    ],
    envVar: "CODE_TRAVAIL_PDF_PATH",
    detectionTerms: [
      "code du travail",
      "contrat de travail",
      "licenciement",
      "salaire",
      "harcelement",
      "harcelement sexuel",
      "harcelement moral",
      "employeur",
      "salarie",
      "temps de travail",
      "conges payes",
      "cdi",
      "cdd",
      "prudhom",
      "rupture conventionnelle",
      "accident du travail",
      "formation professionnelle",
      "negociation collective",
    ],
  },
];

const LEGAL_CODE_BY_KEY = new Map(LEGAL_CODE_DEFINITIONS.map((definition) => [definition.key, definition]));
const LEGAL_CODE_BY_ID = new Map(LEGAL_CODE_DEFINITIONS.map((definition) => [definition.id, definition]));

function cleanText(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(text) {
  return normalizeText(text).replace(/\s+/g, "-");
}

function isPathInsideProject(projectRoot, candidatePath) {
  const relativePath = path.relative(projectRoot, candidatePath);
  return !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function toStoredProjectPath(projectRoot, candidatePath) {
  return path.relative(projectRoot, candidatePath).replace(/\\/g, "/");
}

function buildChunkId(definition, articleCode, segmentIndex) {
  return `${definition.id}-${slugify(articleCode)}-s${String(segmentIndex + 1).padStart(2, "0")}`;
}

function normalizeDetectionTerm(value) {
  return normalizeText(value);
}

function prepareDefinition(definition) {
  return {
    ...definition,
    normalizedTitle: normalizeDetectionTerm(definition.title),
    normalizedSourceLabel: normalizeDetectionTerm(definition.sourceLabel),
    normalizedTerms: Array.from(
      new Set(
        [definition.title, definition.sourceLabel, ...(definition.detectionTerms || [])]
          .filter(Boolean)
          .map(normalizeDetectionTerm),
      ),
    ),
  };
}

const PREPARED_LEGAL_CODE_DEFINITIONS = LEGAL_CODE_DEFINITIONS.map(prepareDefinition);
const PREPARED_LEGAL_CODE_BY_KEY = new Map(PREPARED_LEGAL_CODE_DEFINITIONS.map((definition) => [definition.key, definition]));
const PREPARED_LEGAL_CODE_BY_ID = new Map(PREPARED_LEGAL_CODE_DEFINITIONS.map((definition) => [definition.id, definition]));

function ensureDefinition(input) {
  if (!input) {
    throw new Error("Legal code definition is required.");
  }

  if (typeof input === "string") {
    return PREPARED_LEGAL_CODE_BY_KEY.get(input) || PREPARED_LEGAL_CODE_BY_ID.get(input) || null;
  }

  return PREPARED_LEGAL_CODE_BY_KEY.get(input.key) || prepareDefinition(input);
}

export function listLegalCodeDefinitions() {
  return PREPARED_LEGAL_CODE_DEFINITIONS.map((definition) => ({ ...definition }));
}

export function getLegalCodeDefinition(input) {
  const definition = ensureDefinition(input);
  return definition ? { ...definition } : null;
}

export function normalizeArticleCode(value) {
  return String(value || "")
    .replace(/^article\s+/iu, "")
    .toUpperCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^([LRDA])\.\s*(\d)/u, "$1. $2")
    .trim();
}

export function toArticleLookupKey(value) {
  return normalizeArticleCode(value).replace(/\./g, "").replace(/\s+/g, "");
}

const ARTICLE_REFERENCE_PATTERNS = [
  /\barticle\s+([LRDA]\.\s*\d+(?:-\d+[0-9A-Z]*)*)\b/iu,
  /\barticle\s+([LRDA]\d+(?:-\d+[0-9A-Z]*)*)\b/iu,
  /\barticle\s+(\d+(?:-\d+[0-9A-Z]*)*)\b/iu,
  /\b([LRDA]\.\s*\d+(?:-\d+[0-9A-Z]*)*)\b/iu,
  /\b([LRDA]\d+(?:-\d+[0-9A-Z]*)*)\b/iu,
  /\b(\d+(?:-\d+[0-9A-Z]*){1,})\b/u,
];

export function extractArticleReference(question) {
  const input = String(question || "");
  for (const pattern of ARTICLE_REFERENCE_PATTERNS) {
    const match = input.match(pattern);
    if (match) {
      return normalizeArticleCode(match[1]);
    }
  }
  return null;
}

function getStructureLevel(line) {
  if (/^(?:partie|[A-Za-zÀ-ÿ-]+\s+partie)\b/i.test(line)) {
    return 0;
  }
  if (/^livre\b/i.test(line)) {
    return 1;
  }
  if (/^titre\b/i.test(line)) {
    return 2;
  }
  if (/^chapitre\b/i.test(line)) {
    return 3;
  }
  if (/^section\b/i.test(line)) {
    return 4;
  }
  if (/^sous-section\b/i.test(line)) {
    return 5;
  }
  if (/^paragraphe\b/i.test(line)) {
    return 6;
  }
  if (/^sous-paragraphe\b/i.test(line)) {
    return 7;
  }
  return null;
}

function extractStructureSegments(line) {
  const raw = cleanText(line);
  if (!raw) {
    return [];
  }

  const parts = raw
    .split(/\s+-\s+/)
    .map((part) => cleanText(part))
    .filter(Boolean);

  if (parts.length > 1 && parts.every((part) => getStructureLevel(part) !== null)) {
    return parts;
  }

  return [raw];
}

function updateStructureTrail(trail, line) {
  let nextTrail = trail;

  for (const segment of extractStructureSegments(line)) {
    const level = getStructureLevel(segment);
    if (level === null) {
      continue;
    }

    nextTrail = nextTrail.filter((item) => item.level < level);
    nextTrail.push({ level, text: segment });
  }

  return nextTrail;
}

function shouldSkipPageAsPlan(lines) {
  if (!lines.length) {
    return false;
  }

  if (lines.some((line) => /^plan$/i.test(line))) {
    return true;
  }

  const dottedLineCount = lines.filter((line) => /\.{6,}/.test(line)).length;
  return dottedLineCount >= 4 || dottedLineCount / lines.length >= 0.18;
}

export function cleanPdfPageText(pageText, definitionInput = null) {
  const definition = definitionInput ? ensureDefinition(definitionInput) : null;
  const title = definition?.title || "";
  const normalizedTitle = title ? normalizeText(title) : null;

  const lines = String(pageText || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => cleanText(line))
    .filter(Boolean)
    .filter((line) => !/^plan$/i.test(line))
    .filter((line) => !/^edition\s*:\s*\d{4}-\d{2}-\d{2}$/i.test(line))
    .filter((line) => !/^derni[eè]re modification[:\s].*$/i.test(line))
    .filter((line) => !/^document g[eé]n[eé]r[eé].*$/i.test(normalizeText(line)))
    .filter((line) => !/^\d+\s+articles avec\s+\d+\s+liens$/i.test(normalizeText(line)))
    .filter((line) => !/^\d+\s+r[ée]f[ée]rences externes$/i.test(normalizeText(line)))
    .filter((line) => !/^\.+$/.test(line))
    .filter((line) => !/^\s*p\.\s*\d+\s+/i.test(line))
    .filter((line) => !/ - derniere modification le .* - document genere le /i.test(normalizeText(line)))
    .filter((line) => !/\.{6,}/.test(line))
    .filter((line) => {
      if (!normalizedTitle) {
        return true;
      }

      const normalizedLine = normalizeText(line);
      if (normalizedLine === normalizedTitle) {
        return false;
      }

      return !normalizedLine.endsWith(normalizedTitle) || !/^p\s+\d+/.test(normalizedLine);
    });

  return lines.join("\n");
}

function extractEditionMetadata(firstPageText) {
  const text = String(firstPageText || "");
  const editionMatch = text.match(/Edition\s*:\s*(\d{4}-\d{2}-\d{2})/i);
  const lastModificationMatch =
    text.match(/Derniere modification:\s*(\d{4}-\d{2}-\d{2})/i) ||
    text.match(/Dernière modification:\s*(\d{4}-\d{2}-\d{2})/i) ||
    text.match(/Derni[eè]re modification le\s+(\d{2}\s+[A-Za-zÀ-ÿ]+\s+\d{4})/i);
  const articleCountMatch = text.match(/(\d[\d\s]*)\s+articles\b/i);
  const linkCountMatch = text.match(/(\d[\d\s]*)\s+liens\b/i);
  const externalRefMatch =
    text.match(/(\d[\d\s]*)\s+references externes\b/i) ||
    text.match(/(\d[\d\s]*)\s+références externes\b/i);

  const parseInteger = (value) => {
    if (!value) {
      return null;
    }
    const parsed = Number(String(value).replace(/\s+/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    editionDate: editionMatch?.[1] || null,
    lastModificationDate: lastModificationMatch?.[1] || null,
    declaredArticleCount: parseInteger(articleCountMatch?.[1]),
    declaredLinkCount: parseInteger(linkCountMatch?.[1]),
    declaredExternalReferenceCount: parseInteger(externalRefMatch?.[1]),
  };
}

function extractArticleStart(line) {
  const input = cleanText(line);
  if (!input || /^\d+\s*°/u.test(input)) {
    return null;
  }

  const patterns = [
    /^Article\s+([LRDA]\.\s*\d+(?:-\d+[0-9A-Z]*)*)\b/iu,
    /^Article\s+([LRDA]\d+(?:-\d+[0-9A-Z]*)*)\b/iu,
    /^([LRDA]\.\s*\d+(?:-\d+[0-9A-Z]*)*)\b/u,
    /^Article\s+(\d+(?:-\d+[0-9A-Z]*)*)\b/iu,
    /^(\d+(?:-\d+[0-9A-Z]*)*)(?=\s|$)(?!\s*°)/u,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      return normalizeArticleCode(match[1]);
    }
  }

  return null;
}

function splitArticleIntoChunks(article, definition, maxChars = 1800) {
  const segments = [];
  let lines = [];
  let size = 0;

  const flush = () => {
    if (!lines.length) {
      return;
    }

    const segmentIndex = segments.length;
    const text = lines.join("\n");
    segments.push({
      id: buildChunkId(definition, article.articleCode, segmentIndex),
      codeId: definition.id,
      codeKey: definition.key,
      codeTitle: definition.title,
      articleCode: article.articleCode,
      articleLookupKey: article.articleLookupKey,
      title: `Article ${article.articleCode}`,
      section: `${article.articleCode} · segment ${segmentIndex + 1}`,
      headingPath: article.headingPath,
      text,
      citation: `${definition.title} / article ${article.articleCode} / segment ${segmentIndex + 1}`,
      sourceUrl: article.sourceUrl,
      kind: `${definition.key}_code_article`,
      pageStart: article.pageStart,
      pageEnd: article.pageEnd,
      searchText: [definition.title, article.articleCode, article.headingPath, text].filter(Boolean).join(" "),
    });

    lines = [];
    size = 0;
  };

  for (const line of article.lines) {
    const nextSize = size + line.length + 1;
    if (lines.length && nextSize > maxChars && size >= 600) {
      flush();
    }

    lines.push(line);
    size += line.length + 1;
  }

  flush();
  return segments;
}

export function buildArticleRecordsFromPages(pages, definitionInput) {
  const definition = ensureDefinition(definitionInput);
  const articles = [];
  let structureTrail = [];
  let currentArticle = null;

  function finalizeArticle() {
    if (!currentArticle) {
      return;
    }

    const text = currentArticle.lines.join("\n").trim();
    const articleRecord = {
      ...currentArticle,
      sourceUrl: definition.siteUrl,
      text,
      articleLookupKey: toArticleLookupKey(currentArticle.articleCode),
    };
    const chunkList = splitArticleIntoChunks(articleRecord, definition, 1800);

    articles.push({
      id: `${definition.id}-${slugify(currentArticle.articleCode)}`,
      codeId: definition.id,
      codeKey: definition.key,
      codeTitle: definition.title,
      articleCode: currentArticle.articleCode,
      articleLookupKey: articleRecord.articleLookupKey,
      title: `Article ${currentArticle.articleCode}`,
      headingPath: currentArticle.headingPath,
      sourceUrl: definition.siteUrl,
      pageStart: currentArticle.pageStart,
      pageEnd: currentArticle.pageEnd,
      excerpt: cleanText(text).slice(0, 240),
      chunks: chunkList,
    });

    currentArticle = null;
  }

  for (const page of pages) {
    const pageLines = cleanPdfPageText(page.text, definition)
      .split("\n")
      .map((line) => cleanText(line))
      .filter(Boolean);

    if (shouldSkipPageAsPlan(pageLines)) {
      continue;
    }

    for (const line of pageLines) {
      const structureLevel = getStructureLevel(line);
      if (structureLevel !== null || extractStructureSegments(line).length > 1) {
        structureTrail = updateStructureTrail(structureTrail, line);
        continue;
      }

      const articleCode = extractArticleStart(line);
      if (articleCode) {
        finalizeArticle();
        currentArticle = {
          articleCode,
          headingPath: structureTrail.map((item) => item.text).join(" > "),
          pageStart: page.num,
          pageEnd: page.num,
          lines: [line],
        };
        continue;
      }

      if (currentArticle) {
        currentArticle.lines.push(line);
        currentArticle.pageEnd = page.num;
      }
    }
  }

  finalizeArticle();
  return articles;
}

function buildOverviewChunk(definition, metadata, pageCount) {
  return {
    id: `${definition.id}-overview`,
    codeId: definition.id,
    codeKey: definition.key,
    codeTitle: definition.title,
    title: definition.title,
    section: "Vue d'ensemble",
    text: [
      metadata.lastModificationDate ? `Derniere modification connue : ${metadata.lastModificationDate}` : null,
      metadata.editionDate ? `Edition indexee : ${metadata.editionDate}` : null,
      metadata.declaredArticleCount ? `Articles declares : ${metadata.declaredArticleCount}` : null,
      metadata.declaredLinkCount ? `Liens declares : ${metadata.declaredLinkCount}` : null,
      metadata.declaredExternalReferenceCount
        ? `References externes declarees : ${metadata.declaredExternalReferenceCount}`
        : null,
      `Pages indexees : ${pageCount}`,
      `Base documentaire destinee aux questions sur les articles du ${definition.title.toLowerCase()}.`,
    ]
      .filter(Boolean)
      .join("\n"),
    citation: `${definition.title} / vue d'ensemble`,
    sourceUrl: definition.siteUrl,
    kind: "overview",
    searchText: [
      definition.title,
      definition.sourceLabel,
      metadata.editionDate,
      metadata.lastModificationDate,
      ...(definition.detectionTerms || []),
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export async function resolveLegalCodePdfPath(projectRoot, definitionInput, explicitPath = null) {
  const definition = ensureDefinition(definitionInput);
  const homeDownloads = definition.candidateFilenames.map((filename) => path.join(os.homedir(), "Downloads", filename));
  const projectCandidates = definition.candidateFilenames.flatMap((filename) => [
    path.join(projectRoot, LEGAL_CODE_EMBEDDED_DIR, filename),
    path.join(projectRoot, "data", filename),
    path.resolve(projectRoot, "..", "data", filename),
  ]);
  const envPath = definition.envVar ? process.env[definition.envVar] : null;
  const candidates = [explicitPath, envPath, ...projectCandidates, ...homeDownloads].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const resolvedPath = path.resolve(candidate);
      const descriptor = await stat(resolvedPath);
      if (descriptor.isFile()) {
        return resolvedPath;
      }
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error(
    `${definition.title} PDF introuvable. Placez le fichier dans data/legal/ ou renseignez ${definition.envVar}.`,
  );
}

async function ensureEmbeddedLegalCodePdf(projectRoot, definitionInput, sourcePath) {
  const definition = ensureDefinition(definitionInput);
  const resolvedSourcePath = path.resolve(sourcePath);
  if (isPathInsideProject(projectRoot, resolvedSourcePath)) {
    return resolvedSourcePath;
  }

  const filename = path.basename(resolvedSourcePath) || definition.candidateFilenames[0];
  const embeddedPath = path.join(projectRoot, LEGAL_CODE_EMBEDDED_DIR, filename);
  await mkdir(path.dirname(embeddedPath), { recursive: true });
  await copyFile(resolvedSourcePath, embeddedPath);
  return embeddedPath;
}

export async function ingestLegalCodeIndex(projectRoot, definitionInput, { pdfPath = null } = {}) {
  const definition = ensureDefinition(definitionInput);
  const resolvedPdfPath = await resolveLegalCodePdfPath(projectRoot, definition, pdfPath);
  const embeddedPdfPath = await ensureEmbeddedLegalCodePdf(projectRoot, definition, resolvedPdfPath);
  const fileDescriptor = await stat(embeddedPdfPath);
  const file = await readFile(embeddedPdfPath);
  const parser = new PDFParse({ data: file });

  try {
    const result = await parser.getText();
    const metadata = extractEditionMetadata(result.pages[0]?.text || "");
    const articleRecords = buildArticleRecordsFromPages(result.pages, definition);
    const chunks = [
      buildOverviewChunk(definition, metadata, result.pages.length),
      ...articleRecords.flatMap((article) => article.chunks),
    ];

    const document = {
      id: definition.id,
      key: definition.key,
      title: definition.title,
      sourceLabel: definition.sourceLabel,
      siteUrl: definition.siteUrl,
      ingestedAt: new Date().toISOString(),
      pageCount: result.pages.length,
      articleCount: articleRecords.length,
      chunkCount: chunks.length,
      editionDate: metadata.editionDate,
      lastModificationDate: metadata.lastModificationDate,
      declaredArticleCount: metadata.declaredArticleCount,
      declaredLinkCount: metadata.declaredLinkCount,
      declaredExternalReferenceCount: metadata.declaredExternalReferenceCount,
      sourceFile: {
        path: toStoredProjectPath(projectRoot, embeddedPdfPath),
        size: fileDescriptor.size,
        lastModifiedAt: new Date(fileDescriptor.mtimeMs).toISOString(),
        lastModifiedMs: fileDescriptor.mtimeMs,
        storageMode: "embedded",
        originalImportPath:
          path.resolve(resolvedPdfPath) === path.resolve(embeddedPdfPath) ? null : resolvedPdfPath,
      },
      articles: articleRecords.map(({ chunks: _chunks, ...article }) => article),
      chunks,
    };

    const outputPath = path.join(projectRoot, "data", definition.indexFile);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(document, null, 2), "utf8");

    return { definition, document, outputPath };
  } finally {
    await parser.destroy();
  }
}

export async function loadLegalCodeIndex(projectRoot, definitionInput) {
  const definition = ensureDefinition(definitionInput);
  const inputPath = path.join(projectRoot, "data", definition.indexFile);

  try {
    const file = await readFile(inputPath, "utf8");
    return JSON.parse(file);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`${definition.title} dataset missing. Run the ingestion flow before starting the server.`);
    }

    throw error;
  }
}

function normalizeIndexMap(indexDocumentsByKey = new Map()) {
  if (indexDocumentsByKey instanceof Map) {
    return indexDocumentsByKey;
  }

  return new Map(Object.entries(indexDocumentsByKey || {}));
}

function indexHasArticle(indexDocument, articleLookupKey) {
  return Array.isArray(indexDocument?.articles)
    ? indexDocument.articles.some((article) => article.articleLookupKey === articleLookupKey)
    : false;
}

export function detectRelevantLegalCodeKeys(question, indexDocumentsByKey = new Map()) {
  const normalizedQuestion = normalizeText(question);
  const exactArticleCode = extractArticleReference(question);
  const exactArticleLookupKey = exactArticleCode ? toArticleLookupKey(exactArticleCode) : null;
  const indexMap = normalizeIndexMap(indexDocumentsByKey);

  const scored = PREPARED_LEGAL_CODE_DEFINITIONS.map((definition) => {
    let score = 0;
    const explicitTitleMatch = normalizedQuestion.includes(definition.normalizedTitle);

    for (const term of definition.normalizedTerms) {
      if (term && normalizedQuestion.includes(term)) {
        score += term === definition.normalizedTitle ? 10 : 2;
      }
    }

    if (exactArticleLookupKey) {
      const indexDocument = indexMap.get(definition.key);
      if (indexHasArticle(indexDocument, exactArticleLookupKey)) {
        score += 8;
      }
    }

    return { key: definition.key, score, explicitTitleMatch };
  })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  const explicitMatches = scored.filter((item) => item.explicitTitleMatch);
  return (explicitMatches.length ? explicitMatches : scored).map((item) => item.key);
}

export function questionNeedsLegalCode(question, definitionInput = null, indexDocumentsByKey = new Map()) {
  const relevantKeys = detectRelevantLegalCodeKeys(question, indexDocumentsByKey);
  if (!definitionInput) {
    return relevantKeys.length > 0;
  }

  const definition = ensureDefinition(definitionInput);
  return relevantKeys.includes(definition.key);
}

export async function buildLegalCodeQuestionContext(indexDocument, question) {
  const exactArticleCode = extractArticleReference(question);
  const exactArticleLookupKey = exactArticleCode ? toArticleLookupKey(exactArticleCode) : null;
  const chunks = Array.isArray(indexDocument?.chunks) ? indexDocument.chunks : [];
  const articles = Array.isArray(indexDocument?.articles) ? indexDocument.articles : [];
  const articleByLookupKey = new Map(articles.map((article) => [article.articleLookupKey, article]));
  const contextById = new Map();

  if (exactArticleLookupKey) {
    for (const chunk of chunks.filter((item) => item.articleLookupKey === exactArticleLookupKey).slice(0, 4)) {
      contextById.set(chunk.id, {
        ...chunk,
        score: Math.max(chunk.score || 0, 120 - contextById.size),
      });
    }
  }

  for (const chunk of rankChunks(question, chunks, exactArticleLookupKey ? 8 : 10)) {
    if (!contextById.has(chunk.id)) {
      contextById.set(chunk.id, chunk);
    }
  }

  const contextChunks = Array.from(contextById.values())
    .sort((left, right) => (right.score || 0) - (left.score || 0))
    .slice(0, exactArticleLookupKey ? 8 : 6);

  const matchedArticles = [];
  if (exactArticleLookupKey && articleByLookupKey.has(exactArticleLookupKey)) {
    matchedArticles.push(articleByLookupKey.get(exactArticleLookupKey));
  }

  for (const chunk of contextChunks) {
    if (!chunk.articleLookupKey) {
      continue;
    }
    const article = articleByLookupKey.get(chunk.articleLookupKey);
    if (article && !matchedArticles.some((item) => item.articleLookupKey === article.articleLookupKey)) {
      matchedArticles.push(article);
    }
    if (matchedArticles.length >= 4) {
      break;
    }
  }

  return {
    contextChunks,
    matchedArticles,
    exactArticle: exactArticleLookupKey ? articleByLookupKey.get(exactArticleLookupKey) || null : null,
  };
}

export async function ingestAllLegalCodes(projectRoot, pdfPathsByKey = {}) {
  const results = [];

  for (const definition of PREPARED_LEGAL_CODE_DEFINITIONS) {
    results.push(
      await ingestLegalCodeIndex(projectRoot, definition, {
        pdfPath: pdfPathsByKey[definition.key] || null,
      }),
    );
  }

  return results;
}

export const LEGAL_CODE_DEFINITION_KEYS = PREPARED_LEGAL_CODE_DEFINITIONS.map((definition) => definition.key);
export const CODE_COMMERCE_SOURCE_URL = LEGAL_CODE_BY_KEY.get("commerce").siteUrl;
export const CODE_COMMERCE_INDEX_FILE = LEGAL_CODE_BY_KEY.get("commerce").indexFile;
export const CODE_COMMERCE_EMBEDDED_DIR = LEGAL_CODE_EMBEDDED_DIR;

export async function resolveCommerceCodePdfPath(projectRoot, explicitPath = null) {
  return resolveLegalCodePdfPath(projectRoot, "commerce", explicitPath);
}

export async function ingestCommerceCodeIndex(projectRoot, { pdfPath = null } = {}) {
  return ingestLegalCodeIndex(projectRoot, "commerce", { pdfPath });
}

export async function loadCommerceCodeIndex(projectRoot) {
  return loadLegalCodeIndex(projectRoot, "commerce");
}

export function questionNeedsCommerceCode(question, indexDocumentsByKey = new Map()) {
  return questionNeedsLegalCode(question, "commerce", indexDocumentsByKey);
}

export async function buildCommerceCodeQuestionContext(_projectRoot, indexDocument, question) {
  return buildLegalCodeQuestionContext(indexDocument, question);
}
