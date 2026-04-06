(function () {
  const LOCAL_AI_PORT = 3200;
  const state = {
    booted: false,
    source: null,
    signals: new Map(),
    loadingSignals: false,
    chatBusy: false,
    patched: false,
  };

  function getAiBaseCandidates() {
    if (window.WASI_AI_API_BASE) {
      return [window.WASI_AI_API_BASE];
    }

    if (window.location.protocol === "file:" || /github\.io$/i.test(window.location.hostname)) {
      return [`http://localhost:3000`, `http://localhost:${LOCAL_AI_PORT}`];
    }

    return [window.location.origin, `http://localhost:3000`, `http://localhost:${LOCAL_AI_PORT}`];
  }

  const AI_BASE_CANDIDATES = getAiBaseCandidates();

  function isHostedShell() {
    return window.location.protocol === "file:" || /github\.io$/i.test(window.location.hostname);
  }

  function getOfflineStatusLabel(action = "Connexion") {
    return isHostedShell()
      ? `${action} locale requise: demarrez WASI AI sur localhost:3000`
      : "Serveur WASI AI hors ligne";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getCountryByCode(code) {
    return Array.isArray(window.COUNTRIES) ? window.COUNTRIES.find((country) => country.code === code) || null : null;
  }

  function getCountrySignal(code) {
    return state.signals.get(code) || null;
  }

  function formatRefreshAge(source) {
    if (!source || typeof source.sourceAgeHours !== "number") {
      return "mise à jour inconnue";
    }
    if (source.sourceAgeHours < 1) {
      return "mise à jour il y a moins d'une heure";
    }
    if (source.sourceAgeHours < 24) {
      return `mise à jour il y a ${Math.round(source.sourceAgeHours)} h`;
    }
    return "actualisation requise";
  }

  function hasBackgroundRefresh(source) {
    if (!source) {
      return false;
    }

    if (source.refreshInProgress) {
      return true;
    }

    return Array.isArray(source.legalCodes)
      ? source.legalCodes.some((codeSource) => Boolean(codeSource?.refreshInProgress))
      : false;
  }

  function buildSourceStatusLabel(source) {
    return hasBackgroundRefresh(source)
      ? "WASI AI · actualisation en cours..."
      : `WASI AI · ${formatRefreshAge(source)}`;
  }

  function buildSourceStatusTone(source) {
    return source?.aiEnabled ? "ready" : "warn";
  }

  function ensureBaseScores() {
    if (!Array.isArray(window.COUNTRIES)) {
      return;
    }

    window.COUNTRIES.forEach((country) => {
      if (typeof country.baseScore !== "number") {
        country.baseScore = country.score;
      }
      if (typeof country.score !== "number") {
        country.score = country.baseScore;
      }
    });
  }

  function getCountryPayloads() {
    ensureBaseScores();
    return window.COUNTRIES.map((country) => ({
      code: country.code,
      name: country.name,
      baseScore: country.baseScore,
      coup: Boolean(country.coup),
      juridique: window.COUNTRY_DETAILS?.[country.code]?.indices?.juridique ?? 50,
      integration: window.COUNTRY_DETAILS?.[country.code]?.indices?.integration ?? 50,
      region: country.region,
    }));
  }

  async function fetchJson(url, options) {
    let lastError = null;

    for (const baseUrl of AI_BASE_CANDIDATES) {
      try {
        const response = await fetch(`${baseUrl}${url}`, {
          headers: { "Content-Type": "application/json" },
          ...options,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || `Erreur ${response.status}`);
        }
        return data;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("Serveur WASI AI indisponible.");
  }

  function formatAssistantText(value) {
    return String(value || "")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*/g, "")
      .replace(/\s*\[(?:country|doc)-[^\]]+\]/g, "")
      .replace(/^\|.*\|$/gm, "")
      .replace(/^-{3,}$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function installHeaderUi() {
    const header = document.querySelector(".chat-header");
    if (!header || header.querySelector("#wasi-ai-status")) {
      return;
    }

    const status = document.createElement("div");
    status.id = "wasi-ai-status";
    status.className = "wasi-ai-status loading";
    status.textContent = "Connexion à WASI AI...";

    const refreshButton = document.createElement("button");
    refreshButton.id = "wasi-ai-refresh";
    refreshButton.className = "wasi-ai-refresh";
    refreshButton.type = "button";
    refreshButton.textContent = "Actualiser IA";
    refreshButton.addEventListener("click", () => refreshAiSources());

    header.appendChild(status);
    header.appendChild(refreshButton);
  }

  function updateStatus(text, tone) {
    const status = document.getElementById("wasi-ai-status");
    if (!status) {
      return;
    }

    status.className = `wasi-ai-status ${tone || ""}`.trim();
    status.textContent = text;

    const refreshButton = document.getElementById("wasi-ai-refresh");
    if (refreshButton) {
      refreshButton.disabled = tone === "loading";
    }
  }

  function upgradeWelcomeCopy() {
    const headerTitle = document.querySelector(".chat-header-title");
    if (headerTitle) {
      headerTitle.textContent = "WASI Intelligence IA";
    }

    const focus = document.getElementById("chat-focus");
    if (focus) {
      focus.textContent = "Focus: AFRIQUE + CODES FRANCAIS";
    }

    const firstBotMessage = document.querySelector("#chat-messages .chat-msg.bot");
    if (firstBotMessage) {
      firstBotMessage.textContent =
        "Bienvenue dans WASI Intelligence IA. La plateforme croise maintenant les signaux africains de WASI avec quatre codes francais embarques, des passerelles directes vers WASI DEX et CIREX Microfinance, et une synchronisation visible avec WASI CLI.";
    }

    const suggestionTexts = [
      "Score IA du Burkina Faso",
      "Article L. 121-1 du Code de commerce",
      "Article 9 du Code civil",
      "Analyse du corridor Abidjan-Lagos",
      "Article 111-1 du Code penal",
      "Article L1153-1 du Code du travail",
      "Connexion WASI DEX et CIREX Microfinance",
      "Comparer Côte d'Ivoire et Ghana sur le cadre microfinance",
    ];

    document.querySelectorAll(".chat-sugg").forEach((button, index) => {
      if (suggestionTexts[index]) {
        button.textContent = suggestionTexts[index];
      }
    });
  }

  function normalizeAppRoute(route) {
    if (!route) {
      return "";
    }
    if (/^https?:\/\//i.test(route)) {
      return route;
    }
    if (route === "/") {
      return "./index.html";
    }
    if (route.startsWith("./") || route.startsWith("../")) {
      return route;
    }
    if (route.startsWith("/")) {
      return `.${route}`;
    }
    return `./${route}`;
  }

  function getConnectorModules() {
    const fallbackModules = [
      {
        key: "core",
        title: "Noyau WASI",
        route: "/wasi-core-console.html",
        status: "active",
        summary: "Console coeur, audit et cartographie temps reel des modules WASI.",
      },
      {
        key: "dex",
        title: "WASI DEX",
        route: "/wasi-dex/wasi-app.html",
        status: "active",
        summary: "54 places AFEX, references export et modules de marche relies a l'IA.",
      },
      {
        key: "microfinance",
        title: "CIREX Microfinance",
        route: "/microfinance-app/index.html",
        status: "active",
        summary: "Credit, conformite terrain et pilotage microfinance relies a WASI.",
      },
      {
        key: "private-market",
        title: "WASI Private Market",
        route: "/microfinance-app/wasi-customer-portal.html",
        status: "active",
        summary: "Portail client, souscription privee et passerelles investissement.",
      },
      {
        key: "ecosystem",
        title: "WASI Ecosystem Hub",
        route: "/ecosystem-hub/index.html",
        status: "active",
        summary: "Navigation groupe entre intelligence, marche, microfinance et apps.",
      },
      {
        key: "cli",
        title: "WASI CLI",
        route: "",
        status: "synced",
        summary: "Terminal Bloomberg-style synchronise avec Excel, le web, les 4 codes francais et les connecteurs WASI.",
      },
    ];
    const sourceApps = Array.isArray(state.source?.apps) ? state.source.apps : [];
    const sourceAppsByKey = new Map(sourceApps.map((app) => [app.key, app]));

    return fallbackModules.map((fallback) => {
      const sourceApp = sourceAppsByKey.get(fallback.key) || {};
      return {
        ...fallback,
        ...sourceApp,
        route: normalizeAppRoute(sourceApp.route || fallback.route),
      };
    });
  }

  function formatModuleStatus(status) {
    if (!status) {
      return "actif";
    }
    return String(status).replace(/-/g, " ");
  }

  function buildConnectorGridHtml() {
    const modules = getConnectorModules();
    return `
      <div class="wasi-ai-connector-section">
        <div class="wasi-ai-connector-head">Connexions WASI</div>
        <div class="wasi-ai-connector-grid">
          ${modules
            .map(
              (module) => {
                const route = module.route ? escapeHtml(module.route) : "";
                const tag = route ? "a" : "div";
                const href = route ? ` href="${route}"` : "";
                const staticClass = route ? "" : " is-static";
                return `
                <${tag} class="wasi-ai-connector-card${staticClass}"${href}>
                  <div class="wasi-ai-connector-top">
                    <span class="wasi-ai-connector-name">${escapeHtml(module.title)}</span>
                    <span class="wasi-ai-connector-chip ${escapeHtml(module.status || "active")}">${escapeHtml(
                      formatModuleStatus(module.status),
                    )}</span>
                  </div>
                  <div class="wasi-ai-connector-copy">${escapeHtml(module.summary || "")}</div>
                </${tag}>
              `;
              },
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function buildCompositeCard() {
    const host = document.getElementById("right-composite");
    if (!host) {
      return;
    }

    let card = document.getElementById("wasi-ai-composite-card");
    if (!card) {
      card = document.createElement("div");
      card.id = "wasi-ai-composite-card";
      card.className = "wasi-ai-comp-card";
      host.insertBefore(card, host.firstChild.nextSibling);
    }

    const averageAdjustment =
      window.COUNTRIES.reduce((sum, country) => sum + (country.aiAdjustment || 0), 0) / Math.max(window.COUNTRIES.length, 1);
    const coveredCountries = window.COUNTRIES.filter((country) => state.signals.has(country.code)).length;
    const legalCodes = Array.isArray(state.source?.legalCodes) ? state.source.legalCodes : [];
    const legalCodesReady = legalCodes.length ? legalCodes.filter((code) => code?.sourceReady).length : 0;
    const legalCodesCount = legalCodes.length || 4;
    const localBridgeLabel = state.source?.aiEnabled ? "active" : isHostedShell() ? "localhost:3000 requis" : "hors ligne";
    const sourceAgeLabel = state.source ? formatRefreshAge(state.source) : "moteur local requis";

    card.innerHTML = `
      <div class="wasi-ai-card-title">WASI AI Layer</div>
      <div class="wasi-ai-comp-row"><span>Signal moyen IA</span><strong>${averageAdjustment >= 0 ? "+" : ""}${averageAdjustment.toFixed(1)}</strong></div>
      <div class="wasi-ai-comp-row"><span>Pays enrichis</span><strong>${coveredCountries} / ${window.COUNTRIES.length}</strong></div>
      <div class="wasi-ai-comp-row"><span>Codes francais embarques</span><strong>${legalCodesReady} / ${legalCodesCount}</strong></div>
      <div class="wasi-ai-comp-row"><span>Surfaces synchronisees</span><strong>Excel · Web · CLI</strong></div>
      <div class="wasi-ai-comp-row"><span>Pont local IA</span><strong>${escapeHtml(localBridgeLabel)}</strong></div>
      <div class="wasi-ai-comp-row"><span>État des sources</span><strong>${escapeHtml(sourceAgeLabel)}</strong></div>
      ${buildConnectorGridHtml()}
    `;

    const scoreLabel = host.querySelector(".comp-score-big .label");
    if (scoreLabel) {
      scoreLabel.textContent = "Score moyen AFRIQUE + IA";
    }
  }

  function applySignalsToCountries() {
    ensureBaseScores();

    window.COUNTRIES.forEach((country) => {
      const signal = getCountrySignal(country.code);
      if (signal) {
        country.score = signal.finalScore;
        country.aiAdjustment = signal.aiAdjustment;
      } else {
        country.score = country.baseScore;
        country.aiAdjustment = 0;
      }
    });

    if (typeof window.renderCountries === "function") {
      window.renderCountries();
    }
    if (typeof window.renderComposite === "function") {
      window.renderComposite();
    }

    buildCompositeCard();

    if (window.currentCountry) {
      if (window.innerWidth <= 640 && typeof window.showMobileCountryDetail === "function") {
        window.showMobileCountryDetail(window.currentCountry);
      } else if (typeof window.renderDesktopCountryDetail === "function") {
        window.renderDesktopCountryDetail(window.currentCountry);
      }
    }
  }

  function sourceListHtml(signal) {
    const sources = Array.isArray(signal?.officialSources) ? signal.officialSources : [];
    if (!sources.length) {
      return '<div class="wasi-ai-summary" style="margin-bottom:0;">Aucune source officielle ciblée n’a encore été reliée à ce pays dans la base WASI AI.</div>';
    }

    return `
      <div class="wasi-ai-sources">
        ${sources
          .map(
            (source) =>
              `<a class="wasi-ai-source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(
                source.authority,
              )} · ${escapeHtml(source.title)}</a>`,
          )
          .join("")}
      </div>
    `;
  }

  function buildCountryAiCard(country, signal) {
    if (!country || !signal) {
      return "";
    }

    const adjustmentClass = signal.aiAdjustment > 0 ? "positive" : signal.aiAdjustment < 0 ? "negative" : "";
    return `
      <div class="wasi-ai-country-card" id="wasi-ai-country-card">
        <div class="wasi-ai-card-title">WASI AI Score</div>
        <div class="wasi-ai-score-grid">
          <div class="wasi-ai-score-box">
            <div class="label">Score final</div>
            <div class="value">${signal.finalScore}</div>
          </div>
          <div class="wasi-ai-score-box">
            <div class="label">Score de base</div>
            <div class="value">${signal.baseScore}</div>
          </div>
          <div class="wasi-ai-score-box">
            <div class="label">Ajustement IA</div>
            <div class="value ${adjustmentClass}">${signal.aiAdjustment >= 0 ? "+" : ""}${signal.aiAdjustment}</div>
          </div>
          <div class="wasi-ai-score-box">
            <div class="label">Lecture légale</div>
            <div class="value">${signal.legalReadiness}</div>
          </div>
        </div>
        <div class="wasi-ai-summary">${escapeHtml(signal.summary)}</div>
        <div class="wasi-ai-tags">
          ${(signal.frameworks || []).map((item) => `<span class="wasi-ai-tag">${escapeHtml(item)}</span>`).join("")}
          <span class="wasi-ai-tag">Couverture: ${escapeHtml(signal.coverageLabel)}</span>
        </div>
        ${sourceListHtml(signal)}
      </div>
    `;
  }

  function decorateDesktopCountryDetail(code) {
    const panel = document.getElementById("right-country-detail");
    const country = getCountryByCode(code);
    const signal = getCountrySignal(code);
    if (!panel || !country || !signal) {
      return;
    }

    const existing = panel.querySelector("#wasi-ai-country-card");
    if (existing) {
      existing.remove();
    }

    panel.insertAdjacentHTML("beforeend", buildCountryAiCard(country, signal));

    const scoreNode = panel.querySelector(".cd-score-label");
    if (scoreNode) {
      scoreNode.textContent = "WASI Score + IA";
    }
  }

  function decorateMobileCountryDetail(code) {
    const body = document.getElementById("mobile-panel-body");
    const country = getCountryByCode(code);
    const signal = getCountrySignal(code);
    if (!body || !country || !signal) {
      return;
    }

    const existing = body.querySelector("#wasi-ai-country-card");
    if (existing) {
      existing.remove();
    }

    const actions = body.querySelector(".cd-actions");
    if (actions) {
      actions.insertAdjacentHTML("beforebegin", buildCountryAiCard(country, signal));
    } else {
      body.insertAdjacentHTML("beforeend", buildCountryAiCard(country, signal));
    }
  }

  function citationsHtml(citations) {
    if (!Array.isArray(citations) || !citations.length) {
      return "";
    }

    return `
      <div class="wasi-ai-citations">
        ${citations
          .slice(0, 6)
          .map(
            (citation) => `
              <a class="wasi-ai-citation" href="${escapeHtml(citation.sourceUrl || "#")}" target="_blank" rel="noreferrer">
                <span>${escapeHtml(citation.id)}</span>
                <span>${escapeHtml(citation.title || citation.section || "Source officielle")}</span>
              </a>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function buildChatSignalMeta(signal) {
    if (!signal) {
      return "";
    }

    const adjustmentClass = signal.aiAdjustment > 0 ? "positive" : signal.aiAdjustment < 0 ? "negative" : "";
    return `
      <div class="wasi-ai-chat-meta">
        <span class="wasi-ai-tag">Score final ${signal.finalScore}</span>
        <span class="wasi-ai-tag">Base ${signal.baseScore}</span>
        <span class="wasi-ai-tag ${adjustmentClass}">Ajustement ${signal.aiAdjustment >= 0 ? "+" : ""}${signal.aiAdjustment}</span>
        <span class="wasi-ai-tag">${escapeHtml(signal.coverageLabel)}</span>
      </div>
    `;
  }

  function appendRichBotMessage(text, citations, signal) {
    const container = document.getElementById("chat-messages");
    if (!container) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "chat-msg bot";
    wrapper.innerHTML = `
      <div>${escapeHtml(formatAssistantText(text)).replace(/\n/g, "<br>")}</div>
      ${buildChatSignalMeta(signal)}
      ${citationsHtml(citations)}
    `;
    container.appendChild(wrapper);
    if (typeof window.scrollChat === "function") {
      window.scrollChat();
    } else {
      container.scrollTop = container.scrollHeight;
    }
  }

  async function loadSourceStatus() {
    installHeaderUi();
    updateStatus("Connexion à WASI AI...", "loading");

    try {
      const data = await fetchJson("/api/source");
      state.source = data;
      updateStatus(buildSourceStatusLabel(data), buildSourceStatusTone(data));
      buildCompositeCard();
    } catch (error) {
      state.source = state.source || { aiEnabled: false, legalCodes: [], apps: [] };
      updateStatus(getOfflineStatusLabel("Connexion"), "error");
      buildCompositeCard();
    }
  }

  async function refreshAiSources() {
    installHeaderUi();
    updateStatus("Actualisation des sources WASI AI...", "loading");
    try {
      const data = await fetchJson("/api/source/refresh", { method: "POST", body: "{}" });
      state.source = data;
      updateStatus(buildSourceStatusLabel(data), buildSourceStatusTone(data));
      await loadCountrySignals();
    } catch (error) {
      updateStatus(getOfflineStatusLabel("Actualisation"), "error");
      buildCompositeCard();
    }
  }

  async function loadCountrySignals() {
    if (state.loadingSignals || !Array.isArray(window.COUNTRIES)) {
      return;
    }

    state.loadingSignals = true;
    updateStatus("Calcul des scores WASI IA...", "loading");

    try {
      const data = await fetchJson("/api/intelligence/countries", {
        method: "POST",
        body: JSON.stringify({ countries: getCountryPayloads() }),
      });

      state.signals = new Map((data.countries || []).map((signal) => [signal.code, signal]));
      state.source = data.source || state.source;
      applySignalsToCountries();
      updateStatus(buildSourceStatusLabel(state.source), buildSourceStatusTone(state.source));
    } catch (error) {
      updateStatus(getOfflineStatusLabel("Scores"), "error");
      buildCompositeCard();
    } finally {
      state.loadingSignals = false;
    }
  }

  async function sendChatWithWasiAi() {
    const input = document.getElementById("chat-input");
    const typing = document.getElementById("chat-typing");
    const message = input ? input.value.trim() : "";
    if (!input || !message || state.chatBusy) {
      return;
    }

    state.chatBusy = true;
    input.value = "";

    if (typeof window.appendChatMsg === "function") {
      window.appendChatMsg(message, "user");
    }
    window.chatHistory.push({ role: "user", content: message });

    if (typing) {
      typing.classList.add("show");
    }

    const focusedCountry = window.currentCountry ? getCountryByCode(window.currentCountry) : null;
    const focusedSignal = focusedCountry ? getCountrySignal(focusedCountry.code) : null;
    const countryProfile = focusedCountry
      ? {
          code: focusedCountry.code,
          name: focusedCountry.name,
          baseScore: focusedCountry.baseScore ?? focusedCountry.score,
          currentScore: focusedCountry.score,
          aiAdjustment: focusedSignal?.aiAdjustment ?? 0,
          coup: Boolean(focusedCountry.coup),
          region: focusedCountry.region,
          juridique: window.COUNTRY_DETAILS?.[focusedCountry.code]?.indices?.juridique ?? 50,
          integration: window.COUNTRY_DETAILS?.[focusedCountry.code]?.indices?.integration ?? 50,
        }
      : null;

    try {
      const data = await fetchJson("/wasi/chat", {
        method: "POST",
        body: JSON.stringify({
          message,
          country_focus: focusedCountry ? focusedCountry.name : "Afrique",
          history: window.chatHistory.slice(-10),
          country_profile: countryProfile,
        }),
      });

      if (typing) {
        typing.classList.remove("show");
      }

      appendRichBotMessage(data.reply || "Réponse indisponible.", data.citations || [], data.countrySignal || focusedSignal);
      window.chatHistory.push({ role: "assistant", content: data.reply || "Réponse indisponible." });
    } catch (error) {
      if (typing) {
        typing.classList.remove("show");
      }

      const fallback =
        typeof window.generateLocalResponse === "function"
          ? window.generateLocalResponse(message, focusedCountry ? focusedCountry.name : "AFRIQUE")
          : "Le serveur WASI AI n'est pas disponible actuellement.";
      appendRichBotMessage(fallback, [], focusedSignal);
      window.chatHistory.push({ role: "assistant", content: fallback });
    } finally {
      state.chatBusy = false;
      if (typeof window.scrollChat === "function") {
        window.scrollChat();
      }
    }
  }

  function patchFunctions() {
    if (state.patched) {
      return;
    }

    const originalInitApp = window.initApp;
    window.initApp = function patchedInitApp() {
      if (typeof originalInitApp === "function") {
        originalInitApp();
      }
      bootWasiAi();
    };

    const originalDesktopDetail = window.renderDesktopCountryDetail;
    window.renderDesktopCountryDetail = function patchedDesktopDetail(code) {
      if (typeof originalDesktopDetail === "function") {
        originalDesktopDetail(code);
      }
      decorateDesktopCountryDetail(code);
    };

    const originalMobileDetail = window.showMobileCountryDetail;
    window.showMobileCountryDetail = function patchedMobileDetail(code) {
      if (typeof originalMobileDetail === "function") {
        originalMobileDetail(code);
      }
      decorateMobileCountryDetail(code);
    };

    window.sendChat = sendChatWithWasiAi;
    state.patched = true;
  }

  function bootWasiAi() {
    installHeaderUi();
    upgradeWelcomeCopy();

    if (!state.booted) {
      state.booted = true;
      loadSourceStatus();
      loadCountrySignals();
      return;
    }

    buildCompositeCard();
    if (window.currentCountry) {
      decorateDesktopCountryDetail(window.currentCountry);
      decorateMobileCountryDetail(window.currentCountry);
    }
  }

  patchFunctions();

  if (document.getElementById("app")?.style.display !== "none") {
    bootWasiAi();
  }
})();
