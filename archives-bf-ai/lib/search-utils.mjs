const STOPWORDS = new Set([
  "a",
  "about",
  "after",
  "again",
  "all",
  "an",
  "and",
  "are",
  "as",
  "at",
  "au",
  "aux",
  "avec",
  "avant",
  "be",
  "because",
  "been",
  "being",
  "between",
  "but",
  "by",
  "car",
  "ce",
  "ces",
  "cette",
  "comme",
  "comment",
  "dans",
  "de",
  "des",
  "du",
  "elle",
  "en",
  "entre",
  "est",
  "et",
  "for",
  "from",
  "had",
  "has",
  "have",
  "how",
  "il",
  "ils",
  "in",
  "into",
  "is",
  "it",
  "its",
  "la",
  "le",
  "les",
  "leur",
  "mais",
  "not",
  "of",
  "on",
  "or",
  "ou",
  "par",
  "pas",
  "plus",
  "pour",
  "quand",
  "que",
  "qui",
  "quoi",
  "sa",
  "ses",
  "son",
  "sur",
  "that",
  "the",
  "their",
  "there",
  "they",
  "this",
  "to",
  "un",
  "une",
  "was",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
]);

export function normalizeText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text) {
  return normalizeText(text)
    .split(" ")
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

export function rankChunks(question, chunks, limit = 4) {
  const questionTokens = tokenize(question);
  const normalizedQuestion = normalizeText(question);

  const scored = chunks.map((chunk) => {
    const textBlob = `${chunk.title || ""} ${chunk.section || ""} ${chunk.text || ""} ${chunk.searchText || ""}`;
    const normalizedBlob = normalizeText(textBlob);
    const chunkTokens = new Set(tokenize(textBlob));

    let score = 0;
    for (const token of questionTokens) {
      if (chunkTokens.has(token)) {
        score += 3;
      }
      if (chunk.section && normalizeText(chunk.section).includes(token)) {
        score += 2;
      }
      if (chunk.title && normalizeText(chunk.title).includes(token)) {
        score += 2;
      }
    }

    if (normalizedQuestion && normalizedBlob.includes(normalizedQuestion)) {
      score += 8;
    }

    return { ...chunk, score };
  });

  const topMatches = scored
    .sort((left, right) => right.score - left.score)
    .filter((chunk) => chunk.score > 0)
    .slice(0, limit);

  if (topMatches.length > 0) {
    return topMatches;
  }

  return chunks.slice(0, limit).map((chunk) => ({ ...chunk, score: 0 }));
}

export function formatContextChunks(chunks) {
  return chunks
    .map((chunk) =>
      [
        `[${chunk.id}] ${chunk.section || "Source"}`,
        chunk.title ? `Titre: ${chunk.title}` : null,
        chunk.text,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}
