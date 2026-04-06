const API_BASE =
  window.WASI_CORE_API_BASE ||
  (/github\.io$/i.test(window.location.hostname) || /onrender\.com$/i.test(window.location.hostname)
    ? "https://wasi-intelligence-core.onrender.com"
    : "");
const TOKEN_KEY = "wasi_core_token";

const els = {
  dbStatus: document.getElementById("db-status"),
  sourceStatus: document.getElementById("source-status"),
  refreshSourceBtn: document.getElementById("refresh-source-btn"),
  logoutBtn: document.getElementById("logout-btn"),
  sessionCard: document.getElementById("session-card"),
  demoAccess: document.getElementById("demo-access"),
  summaryMetrics: document.getElementById("summary-metrics"),
  marketCard: document.getElementById("market-card"),
  modulesList: document.getElementById("modules-list"),
  auditList: document.getElementById("audit-list"),
  reloadAuditBtn: document.getElementById("reload-audit-btn"),
};

let token = localStorage.getItem(TOKEN_KEY) || "";
let bootstrap = null;

init();

async function init() {
  bind();
  await loadBootstrap();
  await loadAudit();
}

function bind() {
  els.refreshSourceBtn.addEventListener("click", refreshSource);
  els.logoutBtn.addEventListener("click", logout);
  els.reloadAuditBtn.addEventListener("click", loadAudit);
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return payload;
}

async function loadBootstrap() {
  try {
    bootstrap = await api("/api/core/bootstrap");
    renderBootstrap();
  } catch (error) {
    renderError(error.message);
  }
}

function renderBootstrap() {
  const session = bootstrap?.session || null;
  const source = bootstrap?.source || {};
  const audit = bootstrap?.audit || {};
  const market = bootstrap?.market || {};
  const modules = bootstrap?.modules || [];
  const demoUsers = bootstrap?.demoUsers || [];

  els.dbStatus.textContent = `SQLite · ${bootstrap?.database?.path || "-"}`;
  els.sourceStatus.textContent = source.refreshRequired ? "Sources à relire" : "Sources prêtes";
  els.sourceStatus.classList.toggle("warn", Boolean(source.refreshRequired));
  els.sourceStatus.classList.toggle("error", Boolean(source.sourceError));

  els.sessionCard.innerHTML = session
    ? `
      <div class="item-card">
        <div class="item-head">
          <strong>${escape(session.user.displayName)}</strong>
          <span class="role-chip">${escape(session.user.roleLabel)}</span>
        </div>
        <div class="subcopy">${escape(session.user.organization)}</div>
        <div class="item-meta">
          <span class="mini-chip">${escape(session.user.email)}</span>
          <span class="mini-chip">Expire: ${escape(prettyDate(session.tokenExpiresAt))}</span>
        </div>
      </div>
    `
    : `
      <div class="item-card">
        <strong>Aucune session active</strong>
        <div class="subcopy">Choisissez un accès démo ci-dessous pour tester les rôles WASI.</div>
      </div>
    `;

  els.demoAccess.innerHTML = demoUsers
    .map((user) => `
      <button class="access-btn" type="button" data-access-code="${escape(user.accessCode)}">
        <span>
          <strong>${escape(user.displayName)} · ${escape(user.roleLabel)}</strong>
          <span>${escape(user.organization)} · ${escape(user.accessCode)}</span>
        </span>
      </button>
    `)
    .join("");

  [...els.demoAccess.querySelectorAll("[data-access-code]")].forEach((button) => {
    button.addEventListener("click", () => login(button.dataset.accessCode));
  });

  els.summaryMetrics.innerHTML = [
    metricCard("Utilisateurs démo", `${demoUsers.length}`),
    metricCard("Modules", `${modules.length}`),
    metricCard("Événements audit", `${audit.total || 0}`),
    metricCard("Pays AFEX", `${market.countryCount || 0}`)
  ].join("");

  els.marketCard.innerHTML = `
    <div class="item-card">
      <div class="item-head">
        <strong>${escape(market.familyName || "AFEX")}</strong>
        <span class="role-chip">${escape(market.comparisonCurrency || "USD")}</span>
      </div>
      <div class="subcopy">${escape(market.packageName || "Package marché WASI")}</div>
      <div class="item-meta">
        <span class="mini-chip">${escape(String(market.countryCount || 0))} pays</span>
        <span class="mini-chip">${escape(String(market.subfamilyCount || 0))} sous-familles</span>
        <span class="mini-chip">Version ${escape(prettyDate(market.generatedOn))}</span>
      </div>
    </div>
    ${Array.isArray(market.regions) ? market.regions.map((region) => `
      <div class="item-card">
        <div class="item-head">
          <strong>${escape(region.code)}</strong>
          <span class="role-chip">${escape(String(region.countryCount))} pays</span>
        </div>
        <div class="subcopy">${escape(region.name)}</div>
      </div>
    `).join("") : ""}
  `;

  els.modulesList.innerHTML = modules.map((module) => `
    <div class="item-card">
      <div class="item-head">
        <strong>${escape(module.title)}</strong>
        <span class="role-chip">${escape(module.status)}</span>
      </div>
      <div class="subcopy">${escape(module.summary)}</div>
      <div class="item-meta">
        <span class="mini-chip">${escape(module.audience)}</span>
        <span class="mini-chip">${escape(module.sourceMode)}</span>
        <span class="mini-chip">${escape(module.route)}</span>
      </div>
    </div>
  `).join("");
}

async function login(accessCode) {
  try {
    const payload = await api("/api/core/auth/demo-login", {
      method: "POST",
      body: JSON.stringify({ accessCode }),
    });
    token = payload.token;
    localStorage.setItem(TOKEN_KEY, token);
    bootstrap = payload.bootstrap;
    renderBootstrap();
    await loadAudit();
  } catch (error) {
    renderError(error.message);
  }
}

function logout() {
  token = "";
  localStorage.removeItem(TOKEN_KEY);
  loadBootstrap().then(loadAudit);
}

async function refreshSource() {
  try {
    await api("/api/source/refresh", { method: "POST" });
    await loadBootstrap();
    await loadAudit();
  } catch (error) {
    renderError(error.message);
  }
}

async function loadAudit() {
  try {
    const payload = await api("/api/core/audit?limit=20");
    els.auditList.innerHTML = payload.audit.length
      ? payload.audit.map((entry) => `
        <div class="item-card">
          <div class="item-head">
            <strong>${escape(entry.action)}</strong>
            <span class="role-chip">${escape(prettyDate(entry.createdAt))}</span>
          </div>
          <div class="subcopy">${escape(entry.actorName)}${entry.actorRole ? ` · ${escape(entry.actorRole)}` : ""}</div>
          <div class="item-meta">
            <span class="mini-chip">${escape(entry.entityType)}</span>
            ${entry.entityId ? `<span class="mini-chip">${escape(entry.entityId)}</span>` : ""}
          </div>
        </div>
      `).join("")
      : `
        <div class="item-card">
          <strong>Aucun événement</strong>
          <div class="subcopy">L’audit log se remplira automatiquement à mesure que le noyau WASI sera utilisé.</div>
        </div>
      `;
  } catch (error) {
    els.auditList.innerHTML = `
      <div class="item-card">
        <strong>Audit protégé</strong>
        <div class="subcopy">${escape(error.message)}</div>
      </div>
    `;
  }
}

function renderError(message) {
  els.auditList.innerHTML = `
    <div class="item-card">
      <strong>Attention</strong>
      <div class="subcopy">${escape(message)}</div>
    </div>
  `;
}

function metricCard(label, value) {
  return `
    <div class="metric-card">
      <div class="metric-label">${escape(label)}</div>
      <div class="metric-value">${escape(value)}</div>
    </div>
  `;
}

function prettyDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escape(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
