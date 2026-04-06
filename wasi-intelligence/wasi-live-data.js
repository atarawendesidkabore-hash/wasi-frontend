(function () {
  const API_BASE =
    window.WASI_CORE_API_BASE ||
    (/github\.io$/i.test(window.location.hostname) || /onrender\.com$/i.test(window.location.hostname)
      ? "https://wasi-backend-api.onrender.com"
      : "");
  const TOKEN_KEY = "wasi_core_token";
  const token = localStorage.getItem(TOKEN_KEY) || "";

  function authHeaders() {
    return token ? { Authorization: "Bearer " + token } : {};
  }

  function replaceArray(target, items) {
    if (!Array.isArray(target)) return;
    target.splice(0, target.length, ...items);
  }

  async function loadJson(path) {
    const response = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.json();
  }

  async function hydrateSession() {
    if (!token) return;
    try {
      const me = await loadJson("/api/auth/me");
      const userName = document.getElementById("user-name");
      const userTier = document.getElementById("user-tier");
      if (userName) userName.textContent = me.username || me.email || "Operateur";
      if (userTier) userTier.textContent = me.tier || me.role || "AUTH";

      if (typeof adminToken !== "undefined") {
        adminToken = token;
      }
      if (typeof adminUser !== "undefined") {
        adminUser = me;
      }
      const loginForm = document.getElementById("admin-login-form");
      const dashboard = document.getElementById("admin-dashboard");
      const who = document.getElementById("admin-who");
      if (loginForm && dashboard) {
        loginForm.style.display = "none";
        dashboard.style.display = "block";
      }
      if (who) {
        who.textContent = "Connecte: " + (me.username || me.email || "utilisateur") + " (" + (me.tier || me.role || "AUTH") + ")";
      }
      if (typeof adminRefresh === "function") {
        adminRefresh();
      }
    } catch (_) {
      // Ignore invalid or expired sessions on the public shell.
    }
  }

  async function hydrateFunds() {
    try {
      const payload = await loadJson("/api/v1/market/funds");
      if (Array.isArray(payload.funds) && typeof WASI_ETFS !== "undefined") {
        replaceArray(WASI_ETFS, payload.funds);
        if (typeof renderETFs === "function") renderETFs();
      }
    } catch (_) {
      // Keep static fallback data already present in the platform.
    }
  }

  async function hydrateStockMarket() {
    try {
      const [listingsPayload, portfolioPayload] = await Promise.all([
        loadJson("/api/v1/stock-market/listings"),
        loadJson("/api/v1/stock-market/portfolio"),
      ]);

      if (Array.isArray(listingsPayload.listings) && typeof STOCK_MARKET_LISTINGS !== "undefined") {
        replaceArray(STOCK_MARKET_LISTINGS, listingsPayload.listings);
        if (typeof renderStockMarket === "function") renderStockMarket();
        if (typeof renderSMEmetteurs === "function") renderSMEmetteurs();
      }

      if (portfolioPayload.portfolio && Array.isArray(portfolioPayload.portfolio.holdings) && typeof SM_PORTFOLIO !== "undefined") {
        const holdings = portfolioPayload.portfolio.holdings.map((holding) => ({
          ticker: holding.ticker,
          name: holding.name,
          qty: holding.qty,
          pru: holding.pru,
          current: holding.current,
        }));
        replaceArray(SM_PORTFOLIO, holdings);
        if (typeof renderSMPortfolio === "function") renderSMPortfolio();
      }
    } catch (_) {
      // Keep static fallback data already present in the platform.
    }
  }

  async function hydrate() {
    await hydrateSession();
    await Promise.all([hydrateFunds(), hydrateStockMarket()]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hydrate);
  } else {
    hydrate();
  }
})();
