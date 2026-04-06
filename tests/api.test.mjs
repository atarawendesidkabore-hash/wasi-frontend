/**
 * Integration tests for the WASI Banking API server.
 *
 * Requirements:
 *   - Node.js >= 20 (built-in test runner + global fetch)
 *   - The API server must be running before executing these tests.
 *
 * Run:
 *   node --test tests/api.test.mjs
 *
 * Environment variables:
 *   TEST_API_URL                  Base URL of the running server (default: http://localhost:8010)
 *   WASI_ALLOW_DEMO_USERS         Set to "true" to enable manager-demo login tests
 *   WASI_DEMO_MANAGER_PASSWORD    Password for the manager_demo account
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const BASE_URL = process.env.TEST_API_URL || "http://localhost:8010";

// ---------- helpers ----------

const api = (path, options = {}) => fetch(`${BASE_URL}${path}`, options);

const jsonPost = (path, body, headers = {}) =>
  api(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

// ---------- shared state ----------

const TEST_USER = {
  username: `testuser_${randomUUID().slice(0, 8)}`,
  email: `testuser_${randomUUID().slice(0, 8)}@wasi-test.local`,
  password: "TestPassword123!",
};

let clientToken = null;
let managerToken = null;

// ==========================================================================
//  1. Registration
// ==========================================================================

describe("POST /api/auth/register", () => {
  it("should register a new user and return 201", async () => {
    const res = await jsonPost("/api/auth/register", {
      username: TEST_USER.username,
      email: TEST_USER.email,
      password: TEST_USER.password,
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.id, "response should contain user id");
    assert.equal(body.username, TEST_USER.username);
  });

  it("should reject duplicate username with 409", async () => {
    const res = await jsonPost("/api/auth/register", {
      username: TEST_USER.username,
      email: `other_${randomUUID().slice(0, 6)}@wasi-test.local`,
      password: TEST_USER.password,
    });
    assert.equal(res.status, 409);
  });

  it("should reject short password with 400", async () => {
    const res = await jsonPost("/api/auth/register", {
      username: `short_${randomUUID().slice(0, 6)}`,
      email: `short_${randomUUID().slice(0, 6)}@wasi-test.local`,
      password: "abc",
    });
    assert.equal(res.status, 400);
  });
});

// ==========================================================================
//  2. Login
// ==========================================================================

describe("POST /api/auth/login", () => {
  it("should return a JWT access token for valid credentials", async () => {
    const res = await jsonPost("/api/auth/login", {
      username: TEST_USER.username,
      password: TEST_USER.password,
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.access_token, "response must include access_token");
    assert.equal(body.token_type, "bearer");
    clientToken = body.access_token;
  });

  it("should return 401 for wrong password", async () => {
    const res = await jsonPost("/api/auth/login", {
      username: TEST_USER.username,
      password: "WrongPassword999!",
    });
    assert.equal(res.status, 401);
  });

  it("should return 400 when username or password is missing", async () => {
    const res = await jsonPost("/api/auth/login", { username: "" });
    assert.equal(res.status, 400);
  });
});

// ==========================================================================
//  3. Token Refresh
// ==========================================================================

describe("POST /api/auth/refresh", () => {
  it("should return a fresh token when authenticated", async () => {
    assert.ok(clientToken, "clientToken must be set by login test");
    const res = await jsonPost("/api/auth/refresh", {}, authHeader(clientToken));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.access_token, "response must include a new access_token");
    assert.equal(body.token_type, "bearer");
  });

  it("should return 401 without a token", async () => {
    const res = await jsonPost("/api/auth/refresh", {});
    assert.equal(res.status, 401);
  });
});

// ==========================================================================
//  4. Platform Health (no auth required)
// ==========================================================================

describe("GET /api/v1/platform/health", () => {
  it("should return health data without authentication", async () => {
    const res = await api("/api/v1/platform/health");
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.success, "response should have success=true");
    const data = body.data;
    assert.equal(data.status, "healthy");
    assert.equal(data.database, "connected");
    assert.ok(typeof data.uptime === "number");
    assert.ok(data.counts && typeof data.counts.users === "number");
    assert.ok(data.version);
  });
});

// ==========================================================================
//  5. 2FA Setup
// ==========================================================================

describe("POST /api/auth/2fa/setup", () => {
  it("should return an otpauth URL and secret when authenticated", async () => {
    assert.ok(clientToken, "clientToken must be set");
    const res = await jsonPost("/api/auth/2fa/setup", {}, authHeader(clientToken));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.success);
    assert.ok(body.data.otpauthUrl, "should include otpauthUrl");
    assert.ok(body.data.secret, "should include base32 secret");
    assert.ok(body.data.otpauthUrl.startsWith("otpauth://totp/"));
  });

  it("should return 401 without auth", async () => {
    const res = await jsonPost("/api/auth/2fa/setup", {});
    assert.equal(res.status, 401);
  });
});

// ==========================================================================
//  6. 2FA Status
// ==========================================================================

describe("GET /api/auth/2fa/status", () => {
  it("should return 2FA status for authenticated user", async () => {
    assert.ok(clientToken, "clientToken must be set");
    const res = await api("/api/auth/2fa/status", {
      headers: authHeader(clientToken),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(typeof body.enabled, "boolean");
  });

  it("should return 401 without auth", async () => {
    const res = await api("/api/auth/2fa/status");
    assert.equal(res.status, 401);
  });
});

// ==========================================================================
//  7. CSV Transaction Export
// ==========================================================================

describe("GET /api/v1/banking/transactions/export?format=csv", () => {
  it("should return 401 without auth", async () => {
    const res = await api("/api/v1/banking/transactions/export?format=csv");
    assert.equal(res.status, 401);
  });

  it("should return CSV or 404 (no accounts) when authenticated", async () => {
    assert.ok(clientToken, "clientToken must be set");
    const res = await api("/api/v1/banking/transactions/export?format=csv", {
      headers: authHeader(clientToken),
    });
    // A fresh test user has no accounts, so the server returns 404.
    // If accounts exist the server returns 200 with text/csv.
    assert.ok(
      [200, 404].includes(res.status),
      `Expected 200 or 404 but got ${res.status}`
    );
    if (res.status === 200) {
      const ct = res.headers.get("content-type") || "";
      assert.ok(ct.includes("text/csv"), "Content-Type should be text/csv");
      const text = await res.text();
      assert.ok(text.startsWith("id,"), "CSV should start with header row");
    }
  });
});

// ==========================================================================
//  8-10. Admin endpoints (MANAGER role required)
// ==========================================================================

describe("Admin endpoints (MANAGER role)", () => {
  // Attempt to obtain a manager token from demo credentials.
  before(async () => {
    const demoEnabled = String(process.env.WASI_ALLOW_DEMO_USERS || "").toLowerCase();
    const demoPassword = process.env.WASI_DEMO_MANAGER_PASSWORD || "";

    if (["1", "true", "yes", "on"].includes(demoEnabled) && demoPassword) {
      const res = await jsonPost("/api/auth/login", {
        username: "manager_demo",
        password: demoPassword,
      });
      if (res.status === 200) {
        const body = await res.json();
        managerToken = body.access_token;
      }
    }
  });

  // --- 8. GET /api/v1/admin/users ---

  describe("GET /api/v1/admin/users", () => {
    it("should return 401 without auth", async () => {
      const res = await api("/api/v1/admin/users");
      assert.equal(res.status, 401);
    });

    it("should return 403 for a CLIENT role user", async () => {
      assert.ok(clientToken, "clientToken must be set");
      const res = await api("/api/v1/admin/users", {
        headers: authHeader(clientToken),
      });
      assert.equal(res.status, 403);
    });

    it("should return 200 with user list for MANAGER", async () => {
      if (!managerToken) {
        // Skip gracefully when manager credentials are not available.
        return;
      }
      const res = await api("/api/v1/admin/users", {
        headers: authHeader(managerToken),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.success);
      assert.ok(Array.isArray(body.data.users));
    });
  });

  // --- 9. GET /api/v1/admin/audit/summary ---

  describe("GET /api/v1/admin/audit/summary", () => {
    it("should return 401 without auth", async () => {
      const res = await api("/api/v1/admin/audit/summary");
      assert.equal(res.status, 401);
    });

    it("should return 403 for a CLIENT role user", async () => {
      assert.ok(clientToken, "clientToken must be set");
      const res = await api("/api/v1/admin/audit/summary", {
        headers: authHeader(clientToken),
      });
      assert.equal(res.status, 403);
    });

    it("should return 200 with audit summary for MANAGER", async () => {
      if (!managerToken) return;
      const res = await api("/api/v1/admin/audit/summary", {
        headers: authHeader(managerToken),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.success);
      assert.ok(typeof body.data.totalEntries === "number");
    });
  });

  // --- 10. GET /api/v1/admin/alerts ---

  describe("GET /api/v1/admin/alerts", () => {
    it("should return 401 without auth", async () => {
      const res = await api("/api/v1/admin/alerts");
      assert.equal(res.status, 401);
    });

    it("should return 403 for a CLIENT role user", async () => {
      assert.ok(clientToken, "clientToken must be set");
      const res = await api("/api/v1/admin/alerts", {
        headers: authHeader(clientToken),
      });
      assert.equal(res.status, 403);
    });

    it("should return 200 with alerts list for MANAGER", async () => {
      if (!managerToken) return;
      const res = await api("/api/v1/admin/alerts", {
        headers: authHeader(managerToken),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.success);
      assert.ok(Array.isArray(body.data.alerts));
    });
  });
});

// ==========================================================================
//  11. Rate Limiting on POST /api/v1/banking/transfer
// ==========================================================================

describe("POST /api/v1/banking/transfer - rate limiting", () => {
  // We need a fresh token so that the rate-limit window is clean for this user.
  let rateLimitToken = null;

  before(async () => {
    const username = `ratelimit_${randomUUID().slice(0, 8)}`;
    const email = `ratelimit_${randomUUID().slice(0, 8)}@wasi-test.local`;
    const password = "RateLimit1234!";

    await jsonPost("/api/auth/register", { username, email, password });
    const loginRes = await jsonPost("/api/auth/login", { username, password });
    assert.equal(loginRes.status, 200, "rate-limit test user must log in successfully");
    const loginBody = await loginRes.json();
    rateLimitToken = loginBody.access_token;
  });

  it("should return 429 after exceeding 10 rapid requests", async () => {
    assert.ok(rateLimitToken, "rateLimitToken must be set");

    const transferBody = {
      fromAccountId: "nonexistent-from",
      toAccountId: "nonexistent-to",
      amountCentimes: "1000",
      description: "rate limit test",
    };

    const results = [];

    // Fire 11 requests sequentially so the rate-limit counter increments reliably.
    for (let i = 0; i < 11; i++) {
      const res = await jsonPost(
        "/api/v1/banking/transfer",
        transferBody,
        authHeader(rateLimitToken)
      );
      results.push(res.status);
    }

    // The first 10 requests may return 400/403/404 (bad account ids), but should NOT be 429.
    const firstTen = results.slice(0, 10);
    for (const status of firstTen) {
      assert.notEqual(status, 429, `Request within limit should not be 429 (got ${status})`);
    }

    // The 11th request should trigger the rate limiter.
    const eleventhStatus = results[10];
    assert.equal(eleventhStatus, 429, `11th request should be rate-limited (429), got ${eleventhStatus}`);
  });
});
