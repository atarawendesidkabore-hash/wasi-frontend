import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { load } from "cheerio";
import { PDFParse } from "pdf-parse";

import { normalizeText, rankChunks } from "./search-utils.mjs";

export const AU_COUNTRIES_URL = "https://au.int/en/member_states/countryprofiles2";
export const BURKINA_FINANCE_URL = "https://www.finances.gov.bf/accueil";
export const BCEAO_MEMBER_STATES_URL = "https://www.bceao.int/fr/etats-membres/";
export const BCEAO_SFD_REGULATION_URL =
  "https://www.bceao.int/fr/reglementations/reglementation-des-systemes-financiers-decentralises";
export const BCEAO_SFD_RECUEIL_URL =
  "https://www.bceao.int/sites/default/files/2017-11/-recueil-des-textes-legaux-et-reglementaires-regissant-les-sfd-de-lumoa.pdf";
export const BCEAO_SFD_RECUEIL_2006_URL =
  "https://www.bceao.int/sites/default/files/2017-11/recueil_texte_sfd.pdf";
export const BCEAO_MICROFINANCE_SITUATION_URL =
  "https://www.bceao.int/fr/publications/situation-du-secteur-de-la-microfinance-fin-mars-2025";
export const BCEAO_MICROFINANCE_SITUATION_PDF_URL =
  "https://www.bceao.int/sites/default/files/2025-08/Situation%20de%20la%20microfinance%20%C3%A0%20fin%20mars%202025.pdf";
export const BURKINA_INCLUSION_REPORT_URL =
  "https://www.finances.gov.bf/fileadmin/user_upload/1_Rapport_2021_sur_l_inclusion_financiere_au_Burkina_Faso.pdf";
export const BURKINA_MICROFINANCE_BULLETIN_URL =
  "https://www.finances.gov.bf/fileadmin/user_upload/storage/fichiers/Bulletin_T2_2025_DSC-SFD_VF_dim_graphiques_044744.pdf";
export const AFRICA_MICROFINANCE_URL = AU_COUNTRIES_URL;

const INDEX_FILE = "africa-microfinance-index.json";
const CACHE_DIR = "document-cache";
const BURKINA_COUNTRY_ID = "country-burkina-faso";
const UMOA_MEMBERS = [
  "Benin",
  "Burkina Faso",
  "Côte d’Ivoire",
  "Guinea-Bissau",
  "Mali",
  "Niger",
  "Senegal",
  "Togo",
];
const UMOA_MEMBER_KEYS = new Set(UMOA_MEMBERS.map((country) => normalizeText(country)));
const COUNTRY_ALIAS_OVERRIDES = {
  [normalizeText("Burkina Faso")]: ["Burkina"],
  [normalizeText("Cabo Verde")]: ["Cape Verde"],
  [normalizeText("Côte d’Ivoire")]: ["Cote d'Ivoire", "Cote d Ivoire", "Ivory Coast"],
  [normalizeText("DR Congo")]: [
    "Democratic Republic of the Congo",
    "Democratic Republic of Congo",
    "DRC",
    "RDC",
    "Congo-Kinshasa",
  ],
  [normalizeText("Congo Republic")]: ["Republic of the Congo", "Congo-Brazzaville"],
  [normalizeText("São Tomé and Príncipe")]: ["Sao Tome and Principe"],
  [normalizeText("Eswatini")]: ["Swaziland"],
  [normalizeText("Gambia")]: ["The Gambia"],
  [normalizeText("Tanzania")]: ["United Republic of Tanzania"],
  [normalizeText("Egypt")]: ["Arab Republic of Egypt"],
};

function cleanText(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(text) {
  return normalizeText(text).replace(/\s+/g, "-");
}

function parseEnglishDateLabel(label) {
  const value = cleanText(label);
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(`${value} UTC`);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString().slice(0, 10);
}

function buildCountryAliases(shortName, officialName) {
  const aliases = new Set([shortName, officialName]);
  for (const value of [shortName, officialName]) {
    if (value) {
      aliases.add(value.replace(/[’']/g, "'"));
      aliases.add(value.replace(/[’']/g, " "));
    }
  }

  const overrideKey = normalizeText(shortName);
  for (const alias of COUNTRY_ALIAS_OVERRIDES[overrideKey] || []) {
    aliases.add(alias);
  }

  return Array.from(aliases).filter(Boolean);
}

async function fetchHtml(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed for ${url} with status ${response.status}`);
  }

  return response.text();
}

function parseAuCountries(html) {
  const $ = load(html);
  const byName = new Map();

  $("table").each((tableIndex, table) => {
    const region = cleanText($(table).prevAll("h2, h3, h4, strong, p").first().text()) || `Region ${tableIndex + 1}`;

    $(table)
      .find("tr")
      .each((_, row) => {
        const cells = $(row).find("td");
        if (cells.length < 3) {
          return;
        }

        const officialName = cleanText($(cells[0]).text());
        const shortName = cleanText($(cells[1]).text());
        const auJoinDateLabel = cleanText($(cells[2]).text());
        if (!officialName || !shortName || shortName === "Abbreviation") {
          return;
        }

        const id = `country-${slugify(shortName)}`;
        const isUmoaMember = UMOA_MEMBER_KEYS.has(normalizeText(shortName));
        const isBurkina = id === BURKINA_COUNTRY_ID;

        byName.set(shortName, {
          id,
          shortName,
          officialName,
          region,
          auJoinDateLabel,
          auJoinDate: parseEnglishDateLabel(auJoinDateLabel),
          aliases: buildCountryAliases(shortName, officialName),
          isUmoaMember,
          isUemoaMember: isUmoaMember,
          bceaoFrameworkApplies: isUmoaMember,
          coverageLevel: isBurkina ? "deep" : isUmoaMember ? "regional" : "directory",
          financeAuthority: isBurkina
            ? {
                name: "Ministère des finances du Burkina Faso",
                url: BURKINA_FINANCE_URL,
              }
            : null,
        });
      });
  });

  return Array.from(byName.values());
}

function createInlineChunk(documentId, section, title, text, sourceUrl, searchText = "") {
  return {
    id: `${documentId}-${slugify(section)}`,
    documentId,
    title,
    section,
    text,
    citation: `${title} / ${section}`,
    sourceUrl,
    kind: "html_excerpt",
    searchText,
  };
}

function buildAuCountryDocument(countries) {
  const countriesByRegion = countries.reduce((map, country) => {
    const region = country.region || "Africa";
    if (!map.has(region)) {
      map.set(region, []);
    }
    map.get(region).push(country);
    return map;
  }, new Map());

  const regionChunks = Array.from(countriesByRegion.entries()).map(([region, members]) =>
    createInlineChunk(
      "doc-au-member-states",
      region,
      "African Union country directory",
      [`Region: ${region}`, `Countries: ${members.map((country) => country.shortName).join(", ")}`].join("\n"),
      AU_COUNTRIES_URL,
      `${region} ${members.map((country) => country.shortName).join(" ")}`,
    ),
  );

  return {
    id: "doc-au-member-states",
    title: "African Union member states directory",
    authority: "African Union",
    documentType: "html",
    sourceUrl: AU_COUNTRIES_URL,
    countries: countries.map((country) => country.shortName),
    summary:
      "Official AU directory of member states, grouped by Central, Eastern, Northern, Southern, and Western Africa.",
    tags: ["Africa", "African Union", "member states", "countries", "regions"],
    inlineChunks: [
      createInlineChunk(
        "doc-au-member-states",
        "Africa overview",
        "African Union country directory",
        [
          `Indexed African Union countries: ${countries.length}`,
          `Regions indexed: ${Array.from(countriesByRegion.keys()).join(", ")}`,
          "This directory is the country layer of the assistant. It does not by itself provide national microfinance legislation.",
        ].join("\n"),
        AU_COUNTRIES_URL,
        countries.map((country) => country.shortName).join(" "),
      ),
      ...regionChunks,
    ],
  };
}

function parseBurkinaFinanceHomeDocument(html) {
  const $ = load(html);
  const title = cleanText($("title").text()) || "Accueil - Ministère des finances";
  const candidateTexts = $("h1, h2, h3, h4, h5, h6, a, p")
    .map((_, element) => cleanText($(element).text()))
    .get()
    .filter(Boolean);
  const ministerSnippet =
    candidateTexts.find((text) => /Aboubakar NACANABO/i.test(text)) ||
    candidateTexts
      .filter((text) => /ministre/i.test(text))
      .sort((left, right) => right.length - left.length)[0] ||
    null;

  const lines = [`Page officielle: ${title}`, "Institution indexée: Ministère des finances du Burkina Faso"];
  if (ministerSnippet) {
    lines.push(`Mention relevée sur la page: ${ministerSnippet}`);
  }

  return {
    id: "doc-bf-finance-home",
    title: "Ministère des finances du Burkina Faso",
    authority: "Ministère des finances du Burkina Faso",
    documentType: "html",
    sourceUrl: BURKINA_FINANCE_URL,
    countries: ["Burkina Faso"],
    summary:
      "Official Burkina Faso finance ministry homepage used for institutional context and the currently displayed ministerial reference.",
    tags: ["Burkina Faso", "finance ministry", "minister", "institution"],
    inlineChunks: [
      createInlineChunk(
        "doc-bf-finance-home",
        "Institution",
        "Ministère des finances du Burkina Faso",
        lines.join("\n"),
        BURKINA_FINANCE_URL,
        `Burkina Faso ministère des finances ${ministerSnippet || ""}`,
      ),
    ],
  };
}

function parseBceaoMemberStatesDocument(html) {
  const $ = load(html);
  const paragraphs = $("p")
    .slice(0, 2)
    .map((_, element) => cleanText($(element).text()))
    .get()
    .filter(Boolean);

  return {
    id: "doc-bceao-member-states",
    title: "États membres de l'UMOA",
    authority: "BCEAO",
    documentType: "html",
    sourceUrl: BCEAO_MEMBER_STATES_URL,
    countries: [...UMOA_MEMBERS],
    summary:
      "Official BCEAO institutional page used to ground the UMOA/BCEAO scope that applies to Benin, Burkina Faso, Côte d’Ivoire, Guinea-Bissau, Mali, Niger, Senegal, and Togo.",
    tags: ["BCEAO", "UMOA", "member states", "central bank"],
    inlineChunks: [
      createInlineChunk(
        "doc-bceao-member-states",
        "UMOA scope",
        "BCEAO and UMOA member states",
        [
          ...paragraphs,
          `UMOA member states covered in this knowledge base: ${UMOA_MEMBERS.join(", ")}`,
        ].join("\n"),
        BCEAO_MEMBER_STATES_URL,
        `BCEAO UMOA ${UMOA_MEMBERS.join(" ")}`,
      ),
    ],
  };
}

function parseBceaoRegulationDocument(html) {
  const $ = load(html);
  const items = $("a")
    .map((_, anchor) => {
      const text = cleanText($(anchor).text());
      const href = cleanText($(anchor).attr("href"));
      if (!text || !href) {
        return null;
      }

      if (!/Systèmes Financiers Décentralisés|Loi portant réglementation|Instruction|Recueil/i.test(text)) {
        return null;
      }

      return {
        text,
        href: new URL(href, "https://www.bceao.int").toString(),
      };
    })
    .get()
    .filter(Boolean)
    .slice(0, 8);

  const lines = items.map((item) => `- ${item.text}`);

  return {
    id: "doc-bceao-sfd-regulation",
    title: "Réglementation des Systèmes Financiers Décentralisés",
    authority: "BCEAO",
    documentType: "html",
    sourceUrl: BCEAO_SFD_REGULATION_URL,
    countries: [...UMOA_MEMBERS],
    summary:
      "Official BCEAO landing page for microfinance and decentralized financial systems regulation, including the UMOA law and related instructions.",
    tags: ["BCEAO", "UMOA", "UEMOA", "microfinance", "SFD", "réglementation", "instruction"],
    inlineChunks: [
      createInlineChunk(
        "doc-bceao-sfd-regulation",
        "Regulatory index",
        "BCEAO SFD regulation page",
        [
          "The official BCEAO regulation page links to the UMOA law on decentralized financial systems and related SFD instructions.",
          ...lines,
        ].join("\n"),
        BCEAO_SFD_REGULATION_URL,
        `BCEAO UMOA UEMOA microfinance SFD loi instruction ${UMOA_MEMBERS.join(" ")}`,
      ),
    ],
  };
}

function parseBceaoSituationDocument(html) {
  const $ = load(html);
  const title = cleanText($("title").text()) || "Situation du secteur de la microfinance à fin mars 2025";
  const paragraphs = $("p")
    .slice(0, 2)
    .map((_, element) => cleanText($(element).text()))
    .get()
    .filter(Boolean);

  return {
    id: "doc-bceao-microfinance-situation-page",
    title,
    authority: "BCEAO",
    documentType: "html",
    sourceUrl: BCEAO_MICROFINANCE_SITUATION_URL,
    countries: [...UMOA_MEMBERS],
    summary:
      "Official BCEAO publication page for the microfinance sector situation at end-March 2025, with a linked PDF report.",
    tags: ["BCEAO", "microfinance", "UMOA", "situation", "2025", "indicators"],
    inlineChunks: [
      createInlineChunk(
        "doc-bceao-microfinance-situation-page",
        "Publication page",
        "BCEAO microfinance situation page",
        [...paragraphs, `Linked PDF: ${BCEAO_MICROFINANCE_SITUATION_PDF_URL}`].join("\n"),
        BCEAO_MICROFINANCE_SITUATION_URL,
        `BCEAO microfinance situation 2025 ${UMOA_MEMBERS.join(" ")}`,
      ),
    ],
  };
}

function buildPdfDocuments() {
  return [
    {
      id: "doc-bf-inclusion-report-2021",
      title: "Rapport 2021 sur l'inclusion financière au Burkina Faso",
      authority: "Ministère des finances du Burkina Faso",
      documentType: "pdf",
      sourceUrl: BURKINA_INCLUSION_REPORT_URL,
      countries: ["Burkina Faso"],
      summary:
        "Official Burkina Faso report covering financial inclusion and useful background on microfinance access, supervision, and sector context.",
      tags: ["Burkina Faso", "microfinance", "inclusion financière", "rapport", "2021"],
      inlineChunks: [],
    },
    {
      id: "doc-bf-bulletin-t2-2025",
      title: "Bulletin T2 2025 sur les SFD au Burkina Faso",
      authority: "Ministère des finances du Burkina Faso",
      documentType: "pdf",
      sourceUrl: BURKINA_MICROFINANCE_BULLETIN_URL,
      countries: ["Burkina Faso"],
      summary:
        "Official Burkina Faso bulletin with recent SFD and microfinance indicators for 2025.",
      tags: ["Burkina Faso", "microfinance", "SFD", "bulletin", "2025"],
      inlineChunks: [],
    },
    {
      id: "doc-bceao-sfd-recueil-2010",
      title: "Recueil des textes légaux et réglementaires régissant les SFD de l'UMOA",
      authority: "BCEAO",
      documentType: "pdf",
      sourceUrl: BCEAO_SFD_RECUEIL_URL,
      countries: [...UMOA_MEMBERS],
      summary:
        "Official BCEAO collection containing the UMOA law and regulatory texts governing decentralized financial systems and microfinance.",
      tags: ["BCEAO", "UMOA", "UEMOA", "microfinance", "SFD", "loi", "réglementation", "2010"],
      inlineChunks: [],
    },
    {
      id: "doc-bceao-sfd-recueil-2006",
      title: "Recueil des textes législatifs et réglementaires applicables aux SFD dans l'Union",
      authority: "BCEAO",
      documentType: "pdf",
      sourceUrl: BCEAO_SFD_RECUEIL_2006_URL,
      countries: [...UMOA_MEMBERS],
      summary:
        "Earlier BCEAO collection of legislative and regulatory texts applicable to decentralized financial systems in the Union.",
      tags: ["BCEAO", "UMOA", "UEMOA", "microfinance", "SFD", "recueil", "2006"],
      inlineChunks: [],
    },
    {
      id: "doc-bceao-microfinance-situation-pdf",
      title: "Situation de la microfinance à fin mars 2025",
      authority: "BCEAO",
      documentType: "pdf",
      sourceUrl: BCEAO_MICROFINANCE_SITUATION_PDF_URL,
      countries: [...UMOA_MEMBERS],
      summary:
        "Official BCEAO PDF report on the state of the microfinance sector at end-March 2025.",
      tags: ["BCEAO", "microfinance", "UMOA", "situation", "2025", "rapport"],
      inlineChunks: [],
    },
  ];
}

function buildCountriesForIndex(countries) {
  return countries.map((country) => {
    const isBurkina = country.id === BURKINA_COUNTRY_ID;
    const sourceUrls = [AU_COUNTRIES_URL];
    if (country.isUmoaMember) {
      sourceUrls.push(BCEAO_MEMBER_STATES_URL, BCEAO_SFD_REGULATION_URL, BCEAO_SFD_RECUEIL_URL);
    }
    if (isBurkina) {
      sourceUrls.push(BURKINA_FINANCE_URL, BURKINA_INCLUSION_REPORT_URL, BURKINA_MICROFINANCE_BULLETIN_URL);
    }

    return {
      ...country,
      sourceUrls,
      coverageNote: isBurkina
        ? "Deep coverage: AU country profile, Burkina Faso finance ministry sources, and BCEAO/UMOA/UEMOA microfinance texts."
        : country.isUmoaMember
          ? "Regional coverage: AU country profile plus BCEAO/UMOA/UEMOA microfinance texts."
          : "Country-directory coverage only: the AU country profile is indexed, but no country-specific microfinance legislation is indexed yet.",
    };
  });
}

export async function ingestAfricaMicrofinanceIndex(projectRoot) {
  const [auHtml, burkinaHtml, bceaoMembersHtml, bceaoRegulationHtml, bceaoSituationHtml] = await Promise.all([
    fetchHtml(AU_COUNTRIES_URL),
    fetchHtml(BURKINA_FINANCE_URL),
    fetchHtml(BCEAO_MEMBER_STATES_URL),
    fetchHtml(BCEAO_SFD_REGULATION_URL),
    fetchHtml(BCEAO_MICROFINANCE_SITUATION_URL),
  ]);

  const countries = buildCountriesForIndex(parseAuCountries(auHtml));
  const documents = [
    buildAuCountryDocument(countries),
    parseBurkinaFinanceHomeDocument(burkinaHtml),
    parseBceaoMemberStatesDocument(bceaoMembersHtml),
    parseBceaoRegulationDocument(bceaoRegulationHtml),
    parseBceaoSituationDocument(bceaoSituationHtml),
    ...buildPdfDocuments(),
  ];

  const document = {
    title: "Africa Microfinance AI",
    sourceLabel: "Official African country, Burkina Faso finance, and BCEAO microfinance sources",
    siteUrl: AFRICA_MICROFINANCE_URL,
    ingestedAt: new Date().toISOString(),
    countryCount: countries.length,
    documentCount: documents.length,
    countries,
    documents,
    keySources: [
      { label: "African Union member states", url: AU_COUNTRIES_URL },
      { label: "Burkina Faso Ministry of Finance", url: BURKINA_FINANCE_URL },
      { label: "BCEAO UMOA member states", url: BCEAO_MEMBER_STATES_URL },
      { label: "BCEAO SFD regulation", url: BCEAO_SFD_REGULATION_URL },
    ],
  };

  const outputPath = path.join(projectRoot, "data", INDEX_FILE);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(document, null, 2), "utf8");

  return { document, outputPath };
}

export async function loadAfricaMicrofinanceIndex(projectRoot) {
  const inputPath = path.join(projectRoot, "data", INDEX_FILE);

  try {
    const file = await readFile(inputPath, "utf8");
    return JSON.parse(file);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("Africa microfinance dataset missing. Run `npm run ingest` before starting the server.");
    }

    throw error;
  }
}

function buildCountryProfileChunks(countries) {
  return countries.map((country) => ({
    id: `${country.id}-profile`,
    countryId: country.id,
    title: country.shortName,
    section: `Country profile / ${country.region}`,
    text: [
      `Official name / Nom officiel: ${country.officialName}`,
      `African Union region / Région UA: ${country.region}`,
      country.auJoinDateLabel ? `AU membership date / Date d'adhésion UA: ${country.auJoinDateLabel}` : null,
      `UMOA member / État membre UMOA: ${country.isUmoaMember ? "Yes" : "No"}`,
      `UEMOA member / État membre UEMOA: ${country.isUemoaMember ? "Yes" : "No"}`,
      `BCEAO regional microfinance framework indexed: ${country.bceaoFrameworkApplies ? "Yes" : "No"}`,
      country.financeAuthority ? `Indexed finance authority: ${country.financeAuthority.name}` : null,
      `Coverage note: ${country.coverageNote}`,
    ]
      .filter(Boolean)
      .join("\n"),
    citation: `${country.shortName} country profile`,
    sourceUrl: country.sourceUrls[0],
    kind: "country_profile",
    searchText: [
      country.shortName,
      country.officialName,
      country.region,
      ...country.aliases,
      country.financeAuthority?.name,
      country.isUmoaMember ? "UMOA UEMOA BCEAO microfinance SFD" : "",
      country.coverageNote,
    ]
      .filter(Boolean)
      .join(" "),
  }));
}

function buildDocumentMetadataChunks(documents) {
  return documents.map((document) => ({
    id: `${document.id}-meta`,
    documentId: document.id,
    title: document.title,
    section: `${document.authority} / ${document.documentType === "pdf" ? "PDF source" : "Official page"}`,
    text: [
      `Authority: ${document.authority}`,
      `Countries in scope: ${document.countries.join(", ")}`,
      `Summary: ${document.summary}`,
      `Tags: ${document.tags.join(", ")}`,
      document.documentType === "pdf" ? "Full PDF text can be extracted on demand." : "Official page excerpts are already indexed.",
    ].join("\n"),
    citation: document.title,
    sourceUrl: document.sourceUrl,
    kind: "document_metadata",
    searchText: [
      document.title,
      document.authority,
      document.summary,
      document.tags.join(" "),
      document.countries.join(" "),
    ].join(" "),
  }));
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectCountries(question, countries) {
  const normalizedQuestion = normalizeText(question);
  const aliasEntries = countries.flatMap((country) =>
    country.aliases.map((alias) => ({
      country,
      normalizedAlias: normalizeText(alias),
    })),
  );

  aliasEntries.sort((left, right) => right.normalizedAlias.length - left.normalizedAlias.length);

  const matches = [];
  const usedRanges = [];

  for (const entry of aliasEntries) {
    if (!entry.normalizedAlias || matches.some((match) => match.id === entry.country.id)) {
      continue;
    }

    const pattern = new RegExp(`\\b${escapeRegExp(entry.normalizedAlias)}\\b`, "g");
    let result = pattern.exec(normalizedQuestion);
    while (result) {
      const start = result.index;
      const end = start + entry.normalizedAlias.length;
      const overlaps = usedRanges.some((range) => start < range.end && end > range.start);

      if (!overlaps) {
        matches.push(entry.country);
        usedRanges.push({ start, end });
        break;
      }

      result = pattern.exec(normalizedQuestion);
    }
  }

  return matches;
}

function dedupeById(chunks) {
  const unique = [];
  const seen = new Set();

  for (const chunk of chunks) {
    if (!chunk || seen.has(chunk.id)) {
      continue;
    }

    seen.add(chunk.id);
    unique.push(chunk);
  }

  return unique;
}

function questionNeedsPdfText(question) {
  const normalized = normalizeText(question);
  const detailTerms = [
    "microfinance",
    "sfd",
    "reglementation",
    "regulation",
    "legislation",
    "law",
    "loi",
    "instruction",
    "texte",
    "article",
    "sanction",
    "agrement",
    "autorisation",
    "rapport",
    "report",
    "bulletin",
    "indicateur",
    "indicators",
    "prevoit",
    "provide",
    "governs",
    "govern",
    "summary",
    "resume",
    "statistiques",
    "statistics",
  ];

  return detailTerms.some((term) => normalized.includes(term));
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

async function parsePdfDocument(document) {
  const parser = new PDFParse({ url: document.sourceUrl });

  try {
    const result = await parser.getText();
    const chunks = result.pages
      .map((page) => {
        const text = cleanPdfPageText(page.text);
        if (text.length < 80) {
          return null;
        }

        return {
          id: `${document.id}-p${String(page.num).padStart(3, "0")}`,
          documentId: document.id,
          title: document.title,
          section: `${document.title} / page ${page.num}`,
          text,
          citation: `${document.title} / page ${page.num}`,
          sourceUrl: document.sourceUrl,
          kind: "pdf_page",
          page: page.num,
          searchText: `${document.title} ${document.tags.join(" ")} ${document.countries.join(" ")}`,
        };
      })
      .filter(Boolean);

    return {
      documentId: document.id,
      title: document.title,
      sourceUrl: document.sourceUrl,
      fetchedAt: new Date().toISOString(),
      pageCount: result.pages.length,
      chunkCount: chunks.length,
      chunks,
    };
  } finally {
    await parser.destroy();
  }
}

async function ensureDocumentTextCache(projectRoot, document) {
  const cachePath = path.join(projectRoot, "data", CACHE_DIR, `${document.id}.json`);

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

  const parsed = await parsePdfDocument(document);
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify(parsed, null, 2), "utf8");
  return parsed;
}

export async function buildQuestionContext(projectRoot, indexDocument, question) {
  const countryChunks = buildCountryProfileChunks(indexDocument.countries);
  const documentMetadataChunks = buildDocumentMetadataChunks(indexDocument.documents);
  const documentById = new Map(indexDocument.documents.map((document) => [document.id, document]));
  const matchedCountries = detectCountries(question, indexDocument.countries);
  const matchedCountryIds = new Set(matchedCountries.map((country) => country.id));

  const prioritizedCountryChunks = matchedCountries.map((country, index) => ({
    ...countryChunks.find((chunk) => chunk.countryId === country.id),
    score: 100 - index,
  }));

  const rankedCountryChunks = prioritizedCountryChunks.length > 0 ? prioritizedCountryChunks : rankChunks(question, countryChunks, 4);

  const rankedDocumentMetadata = documentMetadataChunks.map((chunk) => {
    const baseScore = rankChunks(question, [chunk], 1)[0]?.score || 0;
    const document = documentById.get(chunk.documentId);
    const countryScopeBoost = document.countries.some((countryName) =>
      matchedCountries.some((country) => country.shortName === countryName),
    )
      ? 10
      : 0;
    const allAfricaBoost = matchedCountries.length === 0 && document.id === "doc-au-member-states" ? 3 : 0;

    return {
      ...chunk,
      score: baseScore + countryScopeBoost + allAfricaBoost,
    };
  });

  const selectedDocuments = rankedDocumentMetadata
    .sort((left, right) => right.score - left.score)
    .filter((chunk, index) => chunk.score > 0 || index < 4)
    .slice(0, 5)
    .map((chunk) => documentById.get(chunk.documentId))
    .filter(Boolean);

  const selectedDocumentIds = new Set(selectedDocuments.map((document) => document.id));
  const inlineChunks = selectedDocuments
    .flatMap((document) => document.inlineChunks || [])
    .map((chunk) => {
      let score = rankChunks(question, [chunk], 1)[0]?.score || 0;
      if (chunk.documentId === "doc-au-member-states" && matchedCountryIds.size === 0) {
        score += 3;
      }
      return { ...chunk, score };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);

  const contextChunks = dedupeById([
    ...rankedCountryChunks,
    ...rankedDocumentMetadata.filter((chunk) => selectedDocumentIds.has(chunk.documentId)).slice(0, 4),
    ...inlineChunks,
  ]);

  if (questionNeedsPdfText(question)) {
    const pdfDocuments = selectedDocuments.filter((document) => document.documentType === "pdf").slice(0, 2);
    const cachedDocuments = await Promise.all(
      pdfDocuments.map(async (document) => {
        try {
          return await ensureDocumentTextCache(projectRoot, document);
        } catch (error) {
          return {
            documentId: document.id,
            title: document.title,
            sourceUrl: document.sourceUrl,
            fetchedAt: null,
            pageCount: 0,
            chunkCount: 0,
            chunks: [
              {
                id: `${document.id}-error`,
                documentId: document.id,
                title: document.title,
                section: "Source retrieval error",
                text: `The PDF could not be analyzed: ${error.message}`,
                citation: `${document.title} / retrieval error`,
                sourceUrl: document.sourceUrl,
                kind: "error",
              },
            ],
          };
        }
      }),
    );

    const rankedPdfChunks = cachedDocuments
      .flatMap((document) => rankChunks(question, document.chunks, 4))
      .sort((left, right) => right.score - left.score)
      .slice(0, 8);

    for (const chunk of rankedPdfChunks) {
      if (!contextChunks.some((item) => item.id === chunk.id)) {
        contextChunks.push(chunk);
      }
    }
  }

  return {
    contextChunks,
    matchedCountries,
    matchedDocuments: selectedDocuments,
  };
}
