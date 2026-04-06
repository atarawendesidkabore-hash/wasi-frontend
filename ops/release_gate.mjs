import fs from "node:fs/promises";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const cwd = process.cwd();
const gatePort = Number(process.env.RELEASE_GATE_PORT ?? 18110);
const backendUrl = `http://127.0.0.1:${gatePort}`;
const demoPasswords = {
  client: `gate-client-${randomUUID()}`,
  teller: `gate-teller-${randomUUID()}`,
  manager: `gate-manager-${randomUUID()}`,
};

const results = [];
const add = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  const prefix = ok ? "[PASS]" : "[FAIL]";
  console.log(`${prefix} ${name}${detail ? ` -> ${detail}` : ""}`);
};

function runSync(command, args) {
  const isWindowsNpm = process.platform === "win32" && command === "npm";
  const res = isWindowsNpm
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", `npm ${args.join(" ")}`], {
      cwd,
      encoding: "utf8",
    })
    : spawnSync(command, args, { cwd, encoding: "utf8" });
  const output = `${res.stderr || ""}\n${res.stdout || ""}`.trim();
  return {
    ok: (res.status ?? 1) === 0,
    code: res.status ?? -1,
    stdout: res.stdout || "",
    stderr: res.stderr || "",
    output,
    command: `${command} ${args.join(" ")}`,
  };
}

async function httpJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { ok: response.ok, status: response.status, body };
}

async function waitForHealth(baseUrl, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const health = await httpJson(`${baseUrl}/api/health`);
      if (health.ok) return true;
    } catch {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  return false;
}

function stopChildProcess(child) {
  if (!child || !child.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    return;
  }
  child.kill("SIGTERM");
}

async function run() {
  let serverChild = null;
  let abortFurtherChecks = false;

  try {
    const nodeCheck = runSync("node", ["--check", "server/index.mjs"]);
    add("Server syntax", nodeCheck.ok, nodeCheck.ok ? "" : nodeCheck.output.slice(0, 400));

    const build = runSync("npm", ["run", "build"]);
    add("Frontend build", build.ok, build.ok ? "" : build.output.slice(0, 400));

    const mainContent = await fs.readFile(path.join(cwd, "src", "main.jsx"), "utf8");
    add("Route aliases include wasi/banking/dex", /wasi/.test(mainContent) && /banking/.test(mainContent) && /dex/.test(mainContent));
    const serverContent = await fs.readFile(path.join(cwd, "server", "index.mjs"), "utf8");
    const seedArrayMatch = serverContent.match(/const DEX_SEED_TOKENS = \[(.*?)\];/s);
    const seedCount = seedArrayMatch
      ? (seedArrayMatch[1].match(/symbol:\s*"/g) || []).length
      : 0;

    serverChild = spawn("node", ["server/index.mjs"], {
      cwd,
      stdio: "ignore",
      detached: false,
      env: {
        ...process.env,
        PORT: String(gatePort),
        BANKING_API_PORT: String(gatePort),
        BANKING_JWT_SECRET: "release-gate-secret",
        WASI_ALLOW_DEMO_USERS: "true",
        WASI_DEMO_CLIENT_PASSWORD: demoPasswords.client,
        WASI_DEMO_TELLER_PASSWORD: demoPasswords.teller,
        WASI_DEMO_MANAGER_PASSWORD: demoPasswords.manager,
      },
    });

    const backendReady = await waitForHealth(backendUrl, 12000);
    add("Backend /api/health", backendReady, backendReady ? "" : `backend not reachable on ${gatePort}`);

    if (!backendReady) {
      abortFurtherChecks = true;
    }

    if (!abortFurtherChecks) {
      const login = await httpJson(`${backendUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `username=client_demo&password=${encodeURIComponent(demoPasswords.client)}`,
      });
      add("Platform auth login", login.ok, login.ok ? "" : JSON.stringify(login.body).slice(0, 250));

      const token = login.body?.access_token || null;
      if (!token) {
        abortFurtherChecks = true;
      } else {
        const authHeaders = { Authorization: `Bearer ${token}` };

        const snapshot = await httpJson(`${backendUrl}/api/v1/platform/snapshot`, { headers: authHeaders });
        add("Unified platform snapshot endpoint", snapshot.ok, snapshot.ok ? "" : JSON.stringify(snapshot.body).slice(0, 250));

        const indices = await httpJson(`${backendUrl}/api/indices/latest`, { headers: authHeaders });
        add("WASI indices endpoint", indices.ok && Boolean(indices.body?.data?.indices?.CI));

        const dexMarkets = await httpJson(`${backendUrl}/api/v1/dex/markets`, { headers: authHeaders });
        const dexCount = Number(dexMarkets.body?.data?.markets?.length ?? 0);
        add("DEX markets endpoint", dexMarkets.ok, dexMarkets.ok ? "" : JSON.stringify(dexMarkets.body).slice(0, 250));
        add("DEX ETF catalog matches seed count", dexCount === seedCount, `seed=${seedCount}, runtime=${dexCount}`);

        const orderBook = await httpJson(`${backendUrl}/api/v1/dex/orderbook/WASI-COMP?depth=5`, { headers: authHeaders });
        add("DEX orderbook endpoint", orderBook.ok && orderBook.body?.data?.orderBook?.symbol === "WASI-COMP");

        const idempotencyKey = `gate-order-${randomUUID()}`;
        const placeOrder = await httpJson(`${backendUrl}/api/v1/dex/orders`, {
          method: "POST",
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            symbol: "WASI-COMP",
            side: "BUY",
            quantityUnits: "1",
            limitPriceCentimes: "900000",
          }),
        });
        add("DEX place order", placeOrder.ok, placeOrder.ok ? "" : JSON.stringify(placeOrder.body).slice(0, 250));

        const orderId = placeOrder.body?.data?.order?.id;
        if (orderId) {
          const cancelOrder = await httpJson(`${backendUrl}/api/v1/dex/orders/${orderId}/cancel`, {
            method: "POST",
            headers: {
              ...authHeaders,
              "Content-Type": "application/json",
              "Idempotency-Key": `gate-cancel-${randomUUID()}`,
            },
            body: "{}",
          });
          add("DEX cancel order", cancelOrder.ok, cancelOrder.ok ? "" : JSON.stringify(cancelOrder.body).slice(0, 250));
        } else {
          add("DEX cancel order", false, "No order id from placement.");
        }
      }
    }
  } finally {
    stopChildProcess(serverChild);
  }

  const failed = results.filter((entry) => !entry.ok);
  console.log(`\nRelease gate summary: ${results.length - failed.length}/${results.length} passed.`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error("release_gate failed:", error.message);
  process.exit(1);
});
