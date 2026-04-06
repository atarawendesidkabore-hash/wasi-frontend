import path from "node:path";
import { fileURLToPath } from "node:url";

import { ingestAllLegalCodes } from "../lib/legal-codes-repository.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const results = await ingestAllLegalCodes(projectRoot);

console.log(
  JSON.stringify(
    results.map(({ definition, document, outputPath }) => ({
      key: definition.key,
      id: definition.id,
      title: definition.title,
      outputPath,
      embeddedSourcePath: document.sourceFile?.path || null,
      importSourcePath: document.sourceFile?.originalImportPath || document.sourceFile?.path || null,
      pageCount: document.pageCount,
      articleCount: document.articleCount,
      chunkCount: document.chunkCount,
      editionDate: document.editionDate,
      lastModificationDate: document.lastModificationDate,
    })),
    null,
    2,
  ),
);
