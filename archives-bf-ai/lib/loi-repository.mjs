import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { load } from "cheerio";
import { PDFParse } from "pdf-parse";

import { normalizeText, rankChunks } from "./search-utils.mjs";

export const BASE_URL = "https://www.assembleenationale.bf";
export const LAWS_INDEX_URL = `${BASE_URL}/loip`;
const INDEX_FILE = "lois-bf-index.json";
const CACHE_DIR = "law-cache";

function cleanText(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toAbsoluteUrl(href) {
  return href ? new URL(href, BASE_URL).toString() : null;
}

function parseDateLabel(label) {
  const match = String(label || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function extractLawNumber(title) {
  const match = String(title || "").match(/n[°o]\s*([0-9]+(?:-[0-9]+)?\/[A-Z]+)/i);
  return match ? match[1].toUpperCase() : null;
}

function extractLawNumberFromQuestion(question) {
  const match = String(question || "").match(/(?:n[°o]\s*)?([0-9]{3}(?:-[0-9]{4})\/[A-Z]+)/i);
  return match ? match[1].toUpperCase() : null;
}

function classifyDocument(label, url) {
  const normalized = normalizeText(label);
  const href = String(url || "").toLowerCase();

  if (normalized.includes("telecharger la loi")) {
    return "law_pdf";
  }
  if (normalized.includes("expose")) {
    return "expose";
  }
  if (normalized.includes("compte rendu")) {
    return "compte_rendu";
  }
  if (normalized.includes("proces verbal")) {
    return "proces_verbal";
  }
  if (normalized.includes("rapport")) {
    return "rapport";
  }
  if (href.endsWith(".pdf")) {
    return "pdf";
  }
  return "document";
}

function getDocumentPriority(kind) {
  switch (kind) {
    case "law_pdf":
      return 0;
    case "expose":
      return 1;
    case "compte_rendu":
      return 2;
    case "proces_verbal":
      return 3;
    case "rapport":
      return 4;
    case "pdf":
      return 5;
    default:
      return 10;
  }
}

function getDocumentCandidates(law) {
  const documents = Array.isArray(law.documents) ? law.documents : [];
  const uniqueByUrl = new Map();

  for (const document of documents) {
    if (document?.url) {
      uniqueByUrl.set(document.url, document);
    }
  }

  if (law.primaryPdfUrl && !uniqueByUrl.has(law.primaryPdfUrl)) {
    uniqueByUrl.set(law.primaryPdfUrl, {
      label: `Texte de loi ${law.title}`,
      url: law.primaryPdfUrl,
      kind: "law_pdf",
    });
  }

  return Array.from(uniqueByUrl.values()).sort(
    (left, right) => getDocumentPriority(left.kind) - getDocumentPriority(right.kind),
  );
}

async function fetchHtml(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed for ${url} with status ${response.status}`);
  }

  return response.text();
}

function sortByLatest(left, right) {
  const leftDate = left.promulgationDate || left.adoptionDate || "";
  const rightDate = right.promulgationDate || right.adoptionDate || "";
  return rightDate.localeCompare(leftDate);
}

async function mapWithConcurrency(items, concurrency, handler) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const currentIndex = cursor++;
      results[currentIndex] = await handler(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function parseListPage(html) {
  const $ = load(html);
  const laws = [];

  $("tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 3) {
      return;
    }

    const link = $(cells[0]).find('a[href*="/loip/"]').first();
    if (!link.length) {
      return;
    }

    const detailUrl = toAbsoluteUrl(link.attr("href"));
    const title = cleanText(link.text());
    if (!detailUrl || !/^loi/i.test(title)) {
      return;
    }

    const lawIdMatch = detailUrl.match(/\/loip\/(\d+)$/);
    const lawIdSuffix = lawIdMatch ? lawIdMatch[1] : String(laws.length + 1);
    const adoptionDateLabel = cleanText($(cells[1]).text());
    const promulgationDateLabel = cleanText($(cells[2]).text());

    laws.push({
      id: `loi-${lawIdSuffix}`,
      detailUrl,
      title,
      lawNumber: extractLawNumber(title),
      adoptionDateLabel,
      adoptionDate: parseDateLabel(adoptionDateLabel),
      promulgationDateLabel,
      promulgationDate: parseDateLabel(promulgationDateLabel),
    });
  });

  const pageNumbers = $('a[href*="/loip?page="]')
    .map((_, anchor) => {
      const href = $(anchor).attr("href");
      const match = String(href || "").match(/[?&]page=(\d+)/);
      return match ? Number(match[1]) : 1;
    })
    .get()
    .filter((value) => Number.isFinite(value));

  return {
    laws,
    pageCount: Math.max(1, ...pageNumbers),
  };
}

async function fetchLawDetail(law) {
  const html = await fetchHtml(law.detailUrl);
  const $ = load(html);

  const documents = $('a[href*="/storage/"]')
    .map((_, anchor) => {
      const href = toAbsoluteUrl($(anchor).attr("href"));
      const label = cleanText($(anchor).text());

      if (!href || !label) {
        return null;
      }

      return {
        label,
        url: href,
        kind: classifyDocument(label, href),
      };
    })
    .get()
    .filter(Boolean);

  const primaryPdf =
    documents.find((document) => document.kind === "law_pdf") ||
    documents.find((document) => document.url.toLowerCase().endsWith(".pdf")) ||
    null;

  return {
    ...law,
    documents,
    primaryPdfUrl: primaryPdf?.url || null,
    detailFetchedAt: new Date().toISOString(),
  };
}

export async function ingestLawsIndex(projectRoot) {
  const firstPageHtml = await fetchHtml(LAWS_INDEX_URL);
  const firstPage = parseListPage(firstPageHtml);
  const pageNumbers = Array.from({ length: firstPage.pageCount }, (_, index) => index + 1);

  const remainingPages = await mapWithConcurrency(
    pageNumbers.slice(1),
    4,
    async (pageNumber) => {
      const html = await fetchHtml(`${LAWS_INDEX_URL}?page=${pageNumber}`);
      return parseListPage(html).laws;
    },
  );

  const byUrl = new Map();
  for (const law of [...firstPage.laws, ...remainingPages.flat()]) {
    byUrl.set(law.detailUrl, law);
  }

  const hydratedLaws = await mapWithConcurrency(
    Array.from(byUrl.values()).sort(sortByLatest),
    6,
    async (law) => {
      try {
        return await fetchLawDetail(law);
      } catch (error) {
        return {
          ...law,
          detailError: error.message,
          documents: [],
          primaryPdfUrl: null,
        };
      }
    },
  );

  const document = {
    title: "Répertoire des lois votées",
    sourceLabel: "Assemblée législative de transition du Burkina Faso - Répertoire des lois",
    siteUrl: LAWS_INDEX_URL,
    ingestedAt: new Date().toISOString(),
    pageCount: firstPage.pageCount,
    lawCount: hydratedLaws.length,
    laws: hydratedLaws.sort(sortByLatest),
  };

  const outputPath = path.join(projectRoot, "data", INDEX_FILE);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(document, null, 2), "utf8");

  return { document, outputPath };
}

export async function loadLawsIndex(projectRoot) {
  const inputPath = path.join(projectRoot, "data", INDEX_FILE);

  try {
    const file = await readFile(inputPath, "utf8");
    return JSON.parse(file);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("Laws dataset missing. Run `npm run ingest` before starting the server.");
    }

    throw error;
  }
}

export function buildLawMetadataChunks(laws) {
  return laws.map((law) => ({
    id: `${law.id}-meta`,
    lawId: law.id,
    title: law.title,
    section: "Fiche loi",
    text: [
      `Intitulé: ${law.title}`,
      law.lawNumber ? `Numéro: ${law.lawNumber}` : null,
      law.adoptionDateLabel ? `Date d'adoption: ${law.adoptionDateLabel}` : null,
      law.promulgationDateLabel ? `Date de promulgation: ${law.promulgationDateLabel}` : null,
      law.primaryPdfUrl ? "Texte intégral disponible." : "Texte intégral non récupéré.",
    ]
      .filter(Boolean)
      .join("\n"),
    citation: `${law.title} (${law.promulgationDateLabel || "date inconnue"})`,
    sourceUrl: law.detailUrl,
    kind: "metadata",
    searchText: [law.title, law.lawNumber, law.adoptionDateLabel, law.promulgationDateLabel].filter(Boolean).join(" "),
  }));
}

function questionNeedsLawText(question) {
  const normalized = normalizeText(question);
  const detailTerms = [
    "article",
    "contenu",
    "content",
    "dit",
    "dispose",
    "details",
    "detail",
    "prevoit",
    "prevoir",
    "texte",
    "modifie",
    "modification",
    "what does",
    "qu est ce que",
  ];

  return (
    /\b\d{3}-\d{4}\/[a-z]+\b/i.test(question) ||
    detailTerms.some((term) => normalized.includes(term))
  );
}

function questionWantsLatest(question) {
  const normalized = normalizeText(question);
  const latestTerms = [
    "latest",
    "most recent",
    "newest",
    "recent",
    "derniere",
    "plus recente",
    "plus recent",
    "recente",
    "recents",
  ];

  return latestTerms.some((term) => normalized.includes(term));
}

function cleanPdfPageText(pageText) {
  const lines = String(pageText || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => cleanText(line))
    .filter(Boolean)
    .filter((line) => !/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line));

  if (lines.length > 0 && /^\d+$/.test(lines[0])) {
    lines.shift();
  }

  return lines.join("\n");
}

async function parseLawPdf(law, document) {
  const parser = new PDFParse({ url: document.url });

  try {
    const result = await parser.getText();
    const chunks = result.pages
      .map((page) => {
        const text = cleanPdfPageText(page.text);
        if (text.length < 80) {
          return null;
        }

        return {
          id: `${law.id}-p${String(page.num).padStart(3, "0")}`,
          lawId: law.id,
          title: law.title,
          section: `${law.lawNumber || law.id} / ${document.kind} / page ${page.num}`,
          text,
          citation: `${law.title} / ${document.label} / page ${page.num}`,
          sourceUrl: document.url,
          kind: "pdf_page",
          page: page.num,
        };
      })
      .filter(Boolean);

    return {
      lawId: law.id,
      title: law.title,
      sourceUrl: document.url,
      sourceKind: document.kind,
      sourceLabel: document.label,
      fetchedAt: new Date().toISOString(),
      pageCount: result.pages.length,
      chunkCount: chunks.length,
      chunks,
    };
  } finally {
    await parser.destroy();
  }
}

export async function ensureLawTextCache(projectRoot, law) {
  const candidates = getDocumentCandidates(law);

  if (candidates.length === 0) {
    return {
      lawId: law.id,
      title: law.title,
      sourceUrl: law.detailUrl,
      fetchedAt: null,
      pageCount: 0,
      chunkCount: 0,
      chunks: [],
    };
  }

  const cachePath = path.join(projectRoot, "data", CACHE_DIR, `${law.id}.json`);

  try {
    const file = await readFile(cachePath, "utf8");
    const cached = JSON.parse(file);
    if ((cached.chunkCount || 0) > 0) {
      return cached;
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  let parsed = null;

  for (const document of candidates) {
    parsed = await parseLawPdf(law, document);
    if (parsed.chunkCount > 0) {
      break;
    }
  }

  if (!parsed) {
    parsed = {
      lawId: law.id,
      title: law.title,
      sourceUrl: law.detailUrl,
      fetchedAt: new Date().toISOString(),
      pageCount: 0,
      chunkCount: 0,
      chunks: [],
    };
  }

  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify(parsed, null, 2), "utf8");
  return parsed;
}

export async function buildQuestionContext(projectRoot, indexDocument, question) {
  const metadataChunks = buildLawMetadataChunks(indexDocument.laws);
  const requestedLawNumber = extractLawNumberFromQuestion(question);
  const exactLaw = requestedLawNumber
    ? indexDocument.laws.find((law) => law.lawNumber === requestedLawNumber)
    : null;

  let rankedMetadata;

  if (exactLaw) {
    const exactChunk = metadataChunks.find((chunk) => chunk.lawId === exactLaw.id);
    rankedMetadata = [exactChunk].filter(Boolean);
  } else if (questionWantsLatest(question)) {
    rankedMetadata = metadataChunks.slice(0, 4).map((chunk, index) => ({
      ...chunk,
      score: 100 - index,
    }));
  } else {
    rankedMetadata = rankChunks(question, metadataChunks, 6);
  }

  const topLaws = exactLaw ? [exactLaw] : [];

  if (!exactLaw) {
    for (const chunk of rankedMetadata) {
      const law = indexDocument.laws.find((item) => item.id === chunk.lawId);
      if (law && !topLaws.some((item) => item.id === law.id)) {
        topLaws.push(law);
      }
      if (topLaws.length >= 3) {
        break;
      }
    }
  }

  const contextChunks = [...rankedMetadata.slice(0, 4)];

  if (questionNeedsLawText(question)) {
    const cachedDocuments = await Promise.all(
      topLaws.map(async (law) => {
        try {
          return await ensureLawTextCache(projectRoot, law);
        } catch (error) {
          return {
            lawId: law.id,
            title: law.title,
            sourceUrl: law.primaryPdfUrl || law.detailUrl,
            fetchedAt: null,
            pageCount: 0,
            chunkCount: 0,
            chunks: [
              {
                id: `${law.id}-error`,
                lawId: law.id,
                title: law.title,
                section: "Erreur de source",
                text: `Le PDF n'a pas pu être analysé: ${error.message}`,
                citation: `${law.title} / erreur de récupération`,
                sourceUrl: law.primaryPdfUrl || law.detailUrl,
                kind: "error",
              },
            ],
          };
        }
      }),
    );

    const rankedPdfChunks = cachedDocuments
      .flatMap((document) => {
        if (exactLaw && document.lawId === exactLaw.id) {
          const exactMatches = rankChunks(question, document.chunks, 4);
          const firstPages = document.chunks.slice(0, 6).map((chunk, index) => ({
            ...chunk,
            score: Math.max(chunk.score || 0, 40 - index),
          }));

          return [...exactMatches, ...firstPages];
        }

        return rankChunks(question, document.chunks, 2);
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, exactLaw ? 8 : 6);

    for (const chunk of rankedPdfChunks) {
      if (!contextChunks.some((item) => item.id === chunk.id)) {
        contextChunks.push(chunk);
      }
    }
  }

  return {
    contextChunks,
    matchedLaws: topLaws,
  };
}
