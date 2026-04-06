import path from "node:path";
import { fileURLToPath } from "node:url";

import { ingestCommerceCodeIndex } from "../lib/code-commerce-repository.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const pdfPath = process.env.CODE_COMMERCE_PDF_PATH || null;
const { document, outputPath } = await ingestCommerceCodeIndex(projectRoot, { pdfPath });

console.log(
  JSON.stringify(
    {
      ok: true,
      outputPath,
      embeddedSourcePath: document.sourceFile?.path || null,
      importSourcePath: document.sourceFile?.originalImportPath || document.sourceFile?.path || null,
      pageCount: document.pageCount,
      articleCount: document.articleCount,
      chunkCount: document.chunkCount,
      editionDate: document.editionDate,
      lastModificationDate: document.lastModificationDate,
    },
    null,
    2,
  ),
);
