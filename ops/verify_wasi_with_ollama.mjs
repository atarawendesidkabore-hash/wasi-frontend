import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cwd = process.cwd();
const requestedModel = process.argv[2] || process.env.OLLAMA_MODEL || "llama3.1:8b";
const withTests = process.argv.includes("--with-tests");
const reportsDir = path.join(cwd, "ops", "reports");

const MAX_SECTION_CHARS = 12000;

function runCommand(command, args, options = {}) {
  const executable =
    process.platform === "win32" && command === "npm" ? "npm.cmd" : command;
  const result = spawnSync(executable, args, {
    cwd,
    encoding: "utf8",
    shell: false,
    ...options,
  });
  return {
    command: `${executable} ${args.join(" ")}`.trim(),
    exitCode: result.status ?? -1,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    ok: (result.status ?? 1) === 0,
  };
}

function truncate(text, max = MAX_SECTION_CHARS) {
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max)}\n...[truncated]`;
}

async function readFileSafe(relativePath) {
  try {
    const fullPath = path.join(cwd, relativePath);
    const content = await fs.readFile(fullPath, "utf8");
    return {
      path: relativePath,
      content: truncate(content, 16000),
      ok: true,
    };
  } catch (error) {
    return {
      path: relativePath,
      content: `ERROR: ${error.message}`,
      ok: false,
    };
  }
}

async function httpProbe(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    return {
      url,
      ok: response.ok,
      status: response.status,
      body: truncate(text, 4000),
    };
  } catch (error) {
    return {
      url,
      ok: false,
      status: 0,
      body: `ERROR: ${error.message}`,
    };
  }
}

async function getRuntimeChecks() {
  const checks = [];

  checks.push(await httpProbe("http://127.0.0.1:3000/"));
  checks.push(await httpProbe("http://127.0.0.1:3000/?app=wasi"));
  checks.push(await httpProbe("http://127.0.0.1:3000/?app=banking"));
  checks.push(await httpProbe("http://127.0.0.1:3000/?app=dex"));
  checks.push(await httpProbe("http://127.0.0.1:8010/api/health"));

  const loginProbe = await httpProbe("http://127.0.0.1:8010/api/v1/banking/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "client_demo", password: "client123" }),
  });
  checks.push(loginProbe);

  try {
    if (loginProbe.ok) {
      const parsed = JSON.parse(loginProbe.body);
      const accessToken = parsed?.data?.accessToken || null;
      if (accessToken) {
        checks.push(
          await httpProbe("http://127.0.0.1:8010/api/v1/dex/markets", {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
        );
        checks.push(
          await httpProbe("http://127.0.0.1:8010/api/v1/dex/portfolio", {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
        );
      }
    }
  } catch {
    // Keep raw probe data if JSON parse fails.
  }

  return checks;
}

function normalizeCommandOutput(result) {
  return {
    command: result.command,
    exitCode: result.exitCode,
    ok: result.ok,
    stdout: truncate(result.stdout),
    stderr: truncate(result.stderr),
  };
}

function extractJson(text) {
  if (!text) return null;
  const direct = text.trim();
  if (direct.startsWith("{") && direct.endsWith("}")) {
    return direct;
  }
  const block = direct.match(/```json\s*([\s\S]*?)```/i);
  if (block?.[1]) return block[1].trim();
  const first = direct.indexOf("{");
  const last = direct.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return direct.slice(first, last + 1);
  }
  return null;
}

function buildPrompt(auditPayload) {
  return `
Project audit payload (WASI):
${JSON.stringify(auditPayload, null, 2)}

Your task:
1) Verify implementation coverage for:
- WASI terminal route (?app=wasi)
- Banking app route (?app=banking)
- DEX app route (?app=dex)
- DEX backend endpoints and matching engine
- 42 ETF catalog metadata and UI display
- API routing consistency and stale localStorage URL risks
2) Identify missing items, regressions, inconsistencies, and risks.
3) Give precise file-level change recommendations.
4) Prioritize by severity.

Output strictly as JSON with this schema:
{
  "summary": "string",
  "score": 0-100,
  "critical": [{"issue":"", "why":"", "files":[""], "fix":""}],
  "high": [{"issue":"", "why":"", "files":[""], "fix":""}],
  "medium": [{"issue":"", "why":"", "files":[""], "fix":""}],
  "low": [{"issue":"", "why":"", "files":[""], "fix":""}],
  "missing_features": [{"feature":"", "expected":"", "current":"", "files":[""]}],
  "regressions": [{"regression":"", "evidence":"", "files":[""]}],
  "next_actions": ["", ""]
}
No markdown, no prose outside JSON.
`.trim();
}

async function run() {
  await fs.mkdir(reportsDir, { recursive: true });

  const tagsResponse = await fetch("http://127.0.0.1:11434/api/tags");
  if (!tagsResponse.ok) {
    const body = await tagsResponse.text();
    throw new Error(`Unable to query Ollama models (${tagsResponse.status}): ${body}`);
  }
  const tagsData = await tagsResponse.json();
  const installedModelMeta = (tagsData?.models || [])
    .filter((item) => item?.name)
    .map((item) => ({
      name: item.name,
      size: Number(item.size ?? Number.MAX_SAFE_INTEGER),
    }));
  const installedModels = installedModelMeta.map((item) => item.name);
  if (installedModels.length === 0) {
    throw new Error("No local Ollama models installed. Pull one first (e.g., ollama pull llama3.2).");
  }
  const sortedBySize = [...installedModelMeta].sort((a, b) => a.size - b.size);
  const candidateModels = [];
  if (installedModels.includes(requestedModel)) {
    candidateModels.push(requestedModel);
  }
  for (const item of sortedBySize) {
    if (!candidateModels.includes(item.name)) {
      candidateModels.push(item.name);
    }
  }
  if (!candidateModels.includes(requestedModel)) {
    console.warn(`Requested model "${requestedModel}" not found. Auto-selecting from installed models.`);
  }

  const commandResults = [
    runCommand("node", ["--check", "server/index.mjs"]),
    runCommand("npm", ["run", "build"]),
    runCommand("git", ["status", "--short"]),
    runCommand("git", ["log", "--oneline", "-n", "20"]),
  ];

  if (withTests) {
    commandResults.push(runCommand("npm", ["run", "test"]));
  }

  const files = await Promise.all([
    readFileSafe("src/main.jsx"),
    readFileSafe("index.html"),
    readFileSafe("server/index.mjs"),
    readFileSafe("src/dex/DexApp.jsx"),
    readFileSafe("src/dex/dexApi.js"),
    readFileSafe("src/wasi/services/wasiApi.js"),
  ]);

  const runtimeChecks = await getRuntimeChecks();

  const auditPayload = {
    generatedAtUtc: new Date().toISOString(),
    requestedModel,
    candidateModels,
    withTests,
    commands: commandResults.map(normalizeCommandOutput),
    runtimeChecks,
    files,
    expectedFacts: {
      dexEtfCatalogCount: 42,
      routes: ["/?app=wasi", "/?app=banking", "/?app=dex"],
      dexEndpoints: [
        "/api/v1/dex/markets",
        "/api/v1/dex/orderbook/:symbol",
        "/api/v1/dex/portfolio",
        "/api/v1/dex/orders",
        "/api/v1/dex/orders/:orderId/cancel",
      ],
    },
  };

  let ollamaData = null;
  let modelUsed = null;
  const modelErrors = [];
  for (const modelName of candidateModels) {
    const ollamaResponse = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        stream: false,
        options: { temperature: 0.1 },
        messages: [
          {
            role: "system",
            content:
              "You are a strict software QA/audit assistant. Return only valid JSON matching the requested schema.",
          },
          {
            role: "user",
            content: buildPrompt(auditPayload),
          },
        ],
      }),
    });

    if (ollamaResponse.ok) {
      ollamaData = await ollamaResponse.json();
      modelUsed = modelName;
      break;
    }

    const body = await ollamaResponse.text();
    modelErrors.push(`${modelName} -> ${ollamaResponse.status}: ${body}`);
    console.warn(`Model ${modelName} failed, trying next candidate...`);
  }

  if (!ollamaData || !modelUsed) {
    throw new Error(`All candidate models failed:\n${modelErrors.join("\n")}`);
  }
  const rawContent = ollamaData?.message?.content || "";
  const jsonText = extractJson(rawContent);
  if (!jsonText) {
    throw new Error("Ollama response did not contain JSON.");
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`Failed to parse Ollama JSON: ${error.message}\nRaw:\n${rawContent}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(reportsDir, `wasi_ollama_verification_${stamp}.json`);
  const mdPath = path.join(reportsDir, `wasi_ollama_verification_${stamp}.md`);

  await fs.writeFile(jsonPath, JSON.stringify(parsed, null, 2), "utf8");

  const markdown = [
    `# WASI Verification Report (${stamp})`,
    ``,
    `- Requested Model: \`${requestedModel}\``,
    `- Model Used: \`${modelUsed}\``,
    `- Score: **${parsed.score ?? "n/a"}**`,
    `- Summary: ${parsed.summary ?? "n/a"}`,
    ``,
    `## Critical`,
    ...(parsed.critical?.length
      ? parsed.critical.map(
          (item, index) =>
            `${index + 1}. ${item.issue}\n   - Why: ${item.why}\n   - Files: ${(item.files || []).join(", ")}\n   - Fix: ${item.fix}`
        )
      : ["- None"]),
    ``,
    `## High`,
    ...(parsed.high?.length
      ? parsed.high.map(
          (item, index) =>
            `${index + 1}. ${item.issue}\n   - Why: ${item.why}\n   - Files: ${(item.files || []).join(", ")}\n   - Fix: ${item.fix}`
        )
      : ["- None"]),
    ``,
    `## Missing Features`,
    ...(parsed.missing_features?.length
      ? parsed.missing_features.map(
          (item, index) =>
            `${index + 1}. ${item.feature}\n   - Expected: ${item.expected}\n   - Current: ${item.current}\n   - Files: ${(item.files || []).join(", ")}`
        )
      : ["- None"]),
    ``,
    `## Next Actions`,
    ...(parsed.next_actions?.length
      ? parsed.next_actions.map((action, index) => `${index + 1}. ${action}`)
      : ["- None"]),
    ``,
    `## Raw Inputs`,
    `See command/runtime/file audit payload in script run context.`,
  ].join("\n");

  await fs.writeFile(mdPath, markdown, "utf8");

  console.log(`Verification complete.`);
  console.log(`JSON report: ${jsonPath}`);
  console.log(`Markdown report: ${mdPath}`);
  console.log(`Model used: ${modelUsed}`);
  console.log(`Score: ${parsed.score ?? "n/a"}`);
  console.log(`Summary: ${parsed.summary ?? "n/a"}`);
}

run().catch((error) => {
  console.error("verify_wasi_with_ollama failed:", error.message);
  process.exit(1);
});
