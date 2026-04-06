import {
  CODE_COMMERCE_EMBEDDED_DIR,
  CODE_COMMERCE_INDEX_FILE,
  CODE_COMMERCE_SOURCE_URL,
  buildArticleRecordsFromPages as buildGenericArticleRecordsFromPages,
  buildCommerceCodeQuestionContext,
  cleanPdfPageText as cleanGenericPdfPageText,
  extractArticleReference,
  getLegalCodeDefinition,
  ingestCommerceCodeIndex,
  loadCommerceCodeIndex,
  normalizeArticleCode,
  questionNeedsCommerceCode,
  resolveCommerceCodePdfPath,
  toArticleLookupKey,
} from "./legal-codes-repository.mjs";

const commerceDefinition = getLegalCodeDefinition("commerce");

export {
  CODE_COMMERCE_EMBEDDED_DIR,
  CODE_COMMERCE_INDEX_FILE,
  CODE_COMMERCE_SOURCE_URL,
  buildCommerceCodeQuestionContext,
  extractArticleReference,
  ingestCommerceCodeIndex,
  loadCommerceCodeIndex,
  normalizeArticleCode,
  questionNeedsCommerceCode,
  resolveCommerceCodePdfPath,
  toArticleLookupKey,
};

export function buildArticleRecordsFromPages(pages, sourceUrl = CODE_COMMERCE_SOURCE_URL) {
  const articles = buildGenericArticleRecordsFromPages(pages, commerceDefinition);
  return articles.map((article) => ({
    ...article,
    sourceUrl,
    chunks: article.chunks.map((chunk) => ({
      ...chunk,
      sourceUrl,
    })),
  }));
}

export function cleanPdfPageText(pageText) {
  return cleanGenericPdfPageText(pageText, commerceDefinition);
}
