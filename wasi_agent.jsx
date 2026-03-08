import { useState, useEffect } from "react";
import { SidebarDetailModal } from "./src/wasi/components/SidebarDetailModal";
import { LoginPage } from "./src/wasi/components/LoginPage";
import { CountryDashboard } from "./src/wasi/components/CountryDashboard";
import { USSDVisualizationPanel } from "./src/wasi/components/USSDVisualizationPanel";
import { WASIAppShell } from "./src/wasi/components/WASIAppShell";
import { WasiTerminalBoard } from "./src/wasi/components/WasiTerminalBoard";
import { calcWASI } from "./src/wasi/utils/wasiIndices";
import {
  BACKEND_API_URL,
  fetchBackendIndices,
  fetchBackendComposite,
  fetchStockMarkets,
  fetchDivergence,
  fetchLiveSignals,
  fetchNewsEvents,
  fetchBankContext,
  fetchCommodityPrices,
  fetchMacroData,
  fetchUSSDAggregate,
  fetchHistoricalData,
  fetchCountryHistory,
} from "./src/wasi/services/wasiApi";
import { persistPlatformApiBaseUrl } from "./src/platform/apiResolver";
import { buildWASISystemPrompt } from "./src/wasi/services/promptBuilder";
import {
  ENFORCED_FINANCIAL_MODEL,
  enforceWasiAssistantGuardrails,
} from "./src/wasi/services/llmGuardrails";
import {
  GOVERNMENT_ADVISORY_KNOWLEDGE,
  COUNTRY_TAX_DATA,
  BANKING_KNOWLEDGE,
  WEST_AFRICAN_COUNTRIES,
  COUNTRY_TRADE_DATA,
} from "./src/wasi/config/wasiData";

// ============================================================
// WASI AI AGENT — West African Shipping & Economic Intelligence
// Powered by Claude AI | ECOWAS 16 Nations
// ============================================================

// ── Backend API Integration ───────────────────────────────────────────────────
// Configurable: set window.WASI_API_URL before loading, or falls back to same-origin :8000
const FALLBACK_COUNTRY_INDICES = {
  CI: 89, GH: 88, TG: 82, SN: 79, NG: 77, BF: 71, ML: 68, GN: 65,
  BJ: 64, NE: 52, MR: 51, GW: 48, SL: 46, LR: 44, GM: 42, CV: 61,
};

function WASIAgent({ authToken, userInfo, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [indices, setIndices] = useState(FALLBACK_COUNTRY_INDICES);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [wasiComposite, setWasiComposite] = useState(0);
  const [backendConnected, setBackendConnected] = useState(false);
  const [backendToken, setBackendToken] = useState(null);
  const [dataSource, setDataSource] = useState("fallback");
  const [historicalData, setHistoricalData] = useState([]);
  const [showDashboard, setShowDashboard] = useState(false);
  const [stockMarkets, setStockMarkets] = useState([]);
  const [divergenceSignals, setDivergenceSignals] = useState([]);
  const [liveSignals, setLiveSignals] = useState({});
  const [newsEvents, setNewsEvents] = useState([]);
  const [sidebarModal, setSidebarModal] = useState(null); // { type: "market"|"event", data: {...} }
  const [bankContextCache, setBankContextCache] = useState({}); // keyed by country code
  const [transportCache, setTransportCache] = useState({});    // keyed by country code
  const [commodityPrices, setCommodityPrices] = useState([]);  // WB Pink Sheet
  const [macroCache, setMacroCache] = useState({});            // IMF WEO, keyed by country code
  const [historyCache, setHistoryCache] = useState({});        // 12-month index history, keyed by country code
  const [ussdData, setUssdData] = useState(null);               // USSD aggregate data
  const [ussdLoading, setUssdLoading] = useState(false);
  const [showUSSDPanel, setShowUSSDPanel] = useState(false);
  const [dexMarkets, setDexMarkets] = useState([]);
  const [dexRecentTrades, setDexRecentTrades] = useState([]);
  const [dexOrderBook, setDexOrderBook] = useState({ symbol: "WASI-COMP", bids: [], asks: [] });
  const [dexPortfolio, setDexPortfolio] = useState(null);
  const [dexSelectedSymbol, setDexSelectedSymbol] = useState("WASI-COMP");
  const [dexOrderForm, setDexOrderForm] = useState({
    side: "BUY",
    symbol: "WASI-COMP",
    quantityUnits: "",
    limitPriceXof: "",
  });
  const [dexSubmitting, setDexSubmitting] = useState(false);
  const [dexError, setDexError] = useState("");
  const [dexLastAction, setDexLastAction] = useState("");
  const [activeApiUrl, setActiveApiUrl] = useState(BACKEND_API_URL);
  const [apiCandidates] = useState(() => {
    const items = [BACKEND_API_URL];
    if (typeof window !== "undefined") {
      const protocol = window.location.protocol || "http:";
      const host = window.location.hostname || "localhost";
      items.push(`${protocol}//${host}:8010`);
      items.push(`${protocol}//${host}:8001`);
      items.push(`${protocol}//${host}:8000`);
    }
    return [...new Set(items.filter(Boolean))];
  });

  const resolveDataSourceMode = (...payloads) => {
    const modes = payloads
      .map((payload) => String(payload?.dataMode || "").toLowerCase())
      .filter(Boolean);
    if (modes.includes("live")) return "live";
    if (modes.includes("snapshot")) return "snapshot";
    return "fallback";
  };

  const fetchWithApiFailover = async (path, init = {}) => {
    const orderedCandidates = [
      activeApiUrl,
      ...apiCandidates.filter((candidate) => candidate !== activeApiUrl),
    ];

    let lastError = null;
    for (const baseUrl of orderedCandidates) {
      try {
        const response = await fetch(`${baseUrl}${path}`, init);
        if (!response.ok) {
          lastError = new Error(`HTTP ${response.status}`);
          continue;
        }

        if (baseUrl !== activeApiUrl) {
          setActiveApiUrl(baseUrl);
          persistPlatformApiBaseUrl(baseUrl);
        }
        return response;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("API unreachable");
  };

  const parseDexPayload = async (response) => {
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || `HTTP ${response.status}`);
    }
    return payload.data;
  };

  const parseDexPriceToCentimes = (amountInput) => {
    const normalized = String(amountInput || "").trim().replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
      throw new Error("Prix limite invalide.");
    }
    const [wholePart, fractionalPart = ""] = normalized.split(".");
    return (BigInt(wholePart) * 100n + BigInt(fractionalPart.padEnd(2, "0"))).toString();
  };

  const parseDexQuantity = (quantityInput) => {
    const normalized = String(quantityInput || "").trim();
    if (!/^\d+$/.test(normalized)) {
      throw new Error("Quantite invalide.");
    }
    const quantity = BigInt(normalized);
    if (quantity <= 0n) {
      throw new Error("Quantite invalide.");
    }
    return quantity.toString();
  };

  const nextIdempotencyKey = (prefix) =>
    `${prefix}-${Date.now()}-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;

  const refreshDexData = async (tokenOverride = backendToken, symbolOverride = null) => {
    if (!tokenOverride) return;
    try {
      const commonHeaders = { Authorization: `Bearer ${tokenOverride}` };
      const marketResponse = await fetchWithApiFailover("/api/v1/dex/markets", {
        headers: commonHeaders,
      });
      const marketPayload = await parseDexPayload(marketResponse);
      const markets = marketPayload.markets || [];
      const trades = marketPayload.recentTrades || [];
      setDexMarkets(markets);
      setDexRecentTrades(trades);

      const effectiveSymbol =
        symbolOverride || dexSelectedSymbol || markets[0]?.symbol || "WASI-COMP";
      setDexSelectedSymbol(effectiveSymbol);
      setDexOrderForm((previous) => ({ ...previous, symbol: effectiveSymbol }));

      const bookResponse = await fetchWithApiFailover(
        `/api/v1/dex/orderbook/${encodeURIComponent(effectiveSymbol)}?depth=12`,
        { headers: commonHeaders }
      );
      const bookPayload = await parseDexPayload(bookResponse);
      setDexOrderBook(
        bookPayload.orderBook || { symbol: effectiveSymbol, bids: [], asks: [] }
      );

      const portfolioResponse = await fetchWithApiFailover("/api/v1/dex/portfolio", {
        headers: commonHeaders,
      });
      const portfolioPayload = await parseDexPayload(portfolioResponse);
      setDexPortfolio(portfolioPayload.portfolio || null);
      setDexError("");
    } catch (error) {
      setDexError(error.message || "DEX indisponible.");
    }
  };

  const onDexPlaceOrder = async () => {
    if (!backendToken) {
      setDexError("Session invalide.");
      setDexLastAction("");
      return { ok: false, message: "Session invalide." };
    }
    try {
      setDexSubmitting(true);
      setDexLastAction("");
      const symbol = String(dexOrderForm.symbol || dexSelectedSymbol || "").trim().toUpperCase();
      if (!symbol) throw new Error("Symbole ETF requis.");

      const response = await fetchWithApiFailover("/api/v1/dex/orders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${backendToken}`,
          "Content-Type": "application/json",
          "Idempotency-Key": nextIdempotencyKey("wasi-dex-order"),
        },
        body: JSON.stringify({
          symbol,
          side: String(dexOrderForm.side || "BUY").toUpperCase(),
          quantityUnits: parseDexQuantity(dexOrderForm.quantityUnits),
          limitPriceCentimes: parseDexPriceToCentimes(dexOrderForm.limitPriceXof),
        }),
      });
      const payload = await parseDexPayload(response);

      if (payload.market) {
        setDexMarkets((previous) =>
          previous.map((market) =>
            market.symbol === payload.market.symbol ? payload.market : market
          )
        );
      }
      if (payload.orderBook) setDexOrderBook(payload.orderBook);
      if (payload.portfolio) setDexPortfolio(payload.portfolio);
      if (Array.isArray(payload.trades) && payload.trades.length > 0) {
        setDexRecentTrades((previous) => [...payload.trades, ...previous].slice(0, 60));
      }
      setDexOrderForm((previous) => ({ ...previous, quantityUnits: "" }));
      setDexError("");
      const successMessage = payload?.order?.id
        ? `Ordre ${payload.order.id.slice(0, 8)} soumis.`
        : "Ordre soumis.";
      setDexLastAction(successMessage);
      return { ok: true, message: successMessage };
    } catch (error) {
      const message = error.message || "Ordre refuse.";
      setDexError(message);
      setDexLastAction("");
      return { ok: false, message };
    } finally {
      setDexSubmitting(false);
    }
  };

  const onDexCancelOrder = async (orderId) => {
    if (!backendToken) return;
    try {
      setDexSubmitting(true);
      const response = await fetchWithApiFailover(
        `/api/v1/dex/orders/${encodeURIComponent(orderId)}/cancel`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${backendToken}`,
            "Content-Type": "application/json",
            "Idempotency-Key": nextIdempotencyKey("wasi-dex-cancel"),
          },
          body: "{}",
        }
      );
      const payload = await parseDexPayload(response);
      if (payload.orderBook) setDexOrderBook(payload.orderBook);
      if (payload.portfolio) setDexPortfolio(payload.portfolio);
      setDexError("");
      setDexLastAction("Ordre annule.");
    } catch (error) {
      setDexError(error.message || "Annulation impossible.");
      setDexLastAction("");
    } finally {
      setDexSubmitting(false);
    }
  };

  // ── Connect to backend when authToken is available ────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function connectBackend() {
      const token = authToken;
      if (cancelled || !token) return;
      setBackendToken(token);
      setBackendConnected(true);

      // Fetch real indices
      const realIndicesPayload = await fetchBackendIndices(token);
      if (cancelled) return;
      if (realIndicesPayload?.indices && Object.keys(realIndicesPayload.indices).length > 0) {
        // Merge backend real data with deterministic fallback for countries not yet in backend
        const merged = { ...FALLBACK_COUNTRY_INDICES, ...realIndicesPayload.indices };
        setIndices(merged);
      }

      // Fetch composite
      const composite = await fetchBackendComposite(token);
      if (cancelled) return;
      if (composite !== null) {
        setWasiComposite(Math.round(composite));
      }

      // Fetch historical port data (CI / Abidjan — 5 years)
      const hist = await fetchHistoricalData(token);
      if (cancelled) return;
      if (hist && hist.length > 0) setHistoricalData(hist);

      // Fetch stock market data (NGX, GSE, BRVM)
      const stocksPayload = await fetchStockMarkets(token);
      if (cancelled) return;
      if (stocksPayload?.markets && stocksPayload.markets.length > 0) setStockMarkets(stocksPayload.markets);

      // Fetch divergence signals
      const divs = await fetchDivergence(token);
      if (cancelled) return;
      if (divs && divs.length > 0) setDivergenceSignals(divs);

      // Fetch live signals (v2) — base + news adjustment per country
      const signalsPayload = await fetchLiveSignals(token);
      if (cancelled) return;
      if (signalsPayload?.signals && Object.keys(signalsPayload.signals).length > 0) setLiveSignals(signalsPayload.signals);

      // Fetch active news events (v2)
      const eventsPayload = await fetchNewsEvents(token);
      if (cancelled) return;
      if (eventsPayload?.events) setNewsEvents(eventsPayload.events);

      // Fetch commodity prices (WB Pink Sheet)
      const commoditiesPayload = await fetchCommodityPrices(token);
      if (cancelled) return;
      if (commoditiesPayload?.prices && commoditiesPayload.prices.length > 0) {
        setCommodityPrices(commoditiesPayload.prices);
      }

      setDataSource(
        resolveDataSourceMode(
          realIndicesPayload,
          stocksPayload,
          signalsPayload,
          eventsPayload,
          commoditiesPayload
        )
      );

      // Fetch USSD aggregate data
      const ussd = await fetchUSSDAggregate(token);
      if (cancelled) return;
      if (ussd) setUssdData(ussd);

      await refreshDexData(token);
    }
    connectBackend();
    return () => { cancelled = true; };
  }, [authToken]);

  // ── Periodic refresh (simulation fallback if backend down) ────────────────
  useEffect(() => {
    setWasiComposite(prev => prev || calcWASI(indices));
    const interval = setInterval(async () => {
      if (backendConnected && backendToken) {
        const [
          realIndicesPayload,
          composite,
          stocksPayload,
          signalsPayload,
          eventsPayload,
          commoditiesPayload,
        ] = await Promise.all([
          fetchBackendIndices(backendToken),
          fetchBackendComposite(backendToken),
          fetchStockMarkets(backendToken),
          fetchLiveSignals(backendToken),
          fetchNewsEvents(backendToken),
          fetchCommodityPrices(backendToken),
        ]);

        if (realIndicesPayload?.indices && Object.keys(realIndicesPayload.indices).length > 0) {
          const merged = { ...FALLBACK_COUNTRY_INDICES, ...realIndicesPayload.indices };
          setIndices(merged);
        }

        if (composite !== null) setWasiComposite(Math.round(composite));
        if (stocksPayload?.markets && stocksPayload.markets.length > 0) setStockMarkets(stocksPayload.markets);
        if (signalsPayload?.signals && Object.keys(signalsPayload.signals).length > 0) setLiveSignals(signalsPayload.signals);
        if (eventsPayload?.events) setNewsEvents(eventsPayload.events);
        if (commoditiesPayload?.prices && commoditiesPayload.prices.length > 0) {
          setCommodityPrices(commoditiesPayload.prices);
        }

        setDataSource(
          resolveDataSourceMode(
            realIndicesPayload,
            stocksPayload,
            signalsPayload,
            eventsPayload,
            commoditiesPayload
          )
        );
      } else {
        setIndices((previous) => previous || FALLBACK_COUNTRY_INDICES);
        setWasiComposite((previous) => previous || calcWASI(FALLBACK_COUNTRY_INDICES));
        setDataSource("fallback");
      }
    }, 12000);
    return () => clearInterval(interval);
  }, [backendConnected, backendToken]);


  // Fetch bank context whenever a country is selected (cache to avoid re-fetching)
  useEffect(() => {
    if (!selectedCountry || !backendToken) return;
    const code = selectedCountry.code;
    if (bankContextCache[code]) return; // already cached
    fetchBankContext(backendToken, code).then(data => {
      if (data) setBankContextCache(prev => ({ ...prev, [code]: data }));
    });
  }, [selectedCountry, backendToken]);

  // Fetch transport mode comparison whenever a country is selected
  useEffect(() => {
    if (!selectedCountry || !backendToken) return;
    const code = selectedCountry.code;
    if (transportCache[code]) return; // already cached
    (async () => {
      try {
        const res = await fetch(`${BACKEND_API_URL}/api/v2/transport/mode-comparison/${code}`, {
          headers: { Authorization: `Bearer ${backendToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setTransportCache(prev => ({ ...prev, [code]: data }));
        }
      } catch (_) {}
    })();
  }, [selectedCountry, backendToken]);

  // Fetch IMF WEO macro data whenever a country is selected
  useEffect(() => {
    if (!selectedCountry || !backendToken) return;
    const code = selectedCountry.code;
    if (macroCache[code]) return; // already cached
    fetchMacroData(backendToken, code).then(data => {
      if (data) setMacroCache(prev => ({ ...prev, [code]: data }));
    });
  }, [selectedCountry, backendToken]);

  // Fetch 12-month index history whenever a country is selected
  useEffect(() => {
    if (!selectedCountry || !backendToken) return;
    const code = selectedCountry.code;
    if (historyCache[code]) return; // already cached
    fetchCountryHistory(backendToken, code).then(data => {
      if (data && data.length > 0) setHistoryCache(prev => ({ ...prev, [code]: data }));
    });
  }, [selectedCountry, backendToken]);

  useEffect(() => {
    if (!backendToken || !dexSelectedSymbol) return;
    (async () => {
      try {
        const response = await fetchWithApiFailover(
          `/api/v1/dex/orderbook/${encodeURIComponent(dexSelectedSymbol)}?depth=12`,
          { headers: { Authorization: `Bearer ${backendToken}` } }
        );
        const payload = await parseDexPayload(response);
        setDexOrderBook(payload.orderBook || { symbol: dexSelectedSymbol, bids: [], asks: [] });
        setDexError("");
      } catch (error) {
        setDexError(error.message || "Orderbook indisponible.");
      }
    })();
  }, [backendToken, dexSelectedSymbol, activeApiUrl]);

  useEffect(() => {
    if (!backendToken) return;
    const interval = setInterval(() => {
      refreshDexData(backendToken, dexSelectedSymbol);
    }, 9000);
    return () => clearInterval(interval);
  }, [backendToken, dexSelectedSymbol]);

  const sendMessage = async (text) => {
    const query = text || input.trim();
    if (!query) return;
    const token = backendToken || authToken || null;
    if (!token) {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: "Session invalide. Veuillez vous reconnecter pour utiliser l'agent WASI.",
        },
      ]);
      return;
    }

    const userMsg = { role: "user", content: query };
    setMessages(m => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetchWithApiFailover("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: ENFORCED_FINANCIAL_MODEL,
          max_tokens: 2000,
          system: buildWASISystemPrompt({
            countries: WEST_AFRICAN_COUNTRIES,
            indices,
            wasiComposite,
            backendConnected,
            stockMarkets,
            liveSignals,
            newsEvents,
            commodityPrices,
            selectedCountry,
            macroCache,
            historicalData,
            governmentAdvisoryKnowledge: GOVERNMENT_ADVISORY_KNOWLEDGE,
            bankingKnowledge: BANKING_KNOWLEDGE,
          }),
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: query }
          ]
        })
      });
      const data = await response.json();
      const rawReply = data.content?.[0]?.text || "Agent WASI temporairement indisponible. Veuillez réessayer.";
      const reply = enforceWasiAssistantGuardrails(query, rawReply);
      setMessages(m => [...m, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages(m => [...m, { role: "assistant", content: `Erreur de connexion. Agent WASI hors ligne. Detail: ${err?.message || "API inaccessible"}` }]);
    }
    setLoading(false);
  };

  const handleCountryToggle = (country) => {
    const next = selectedCountry?.code === country.code ? null : country;
    setShowUSSDPanel(false);
    setSelectedCountry(next);
    if (next) setShowDashboard(true);
  };

  const handleToggleUSSD = async () => {
    setShowUSSDPanel(true);
    setUssdLoading(!ussdData);

    if (!ussdData && backendToken) {
      const data = await fetchUSSDAggregate(backendToken);
      if (data) setUssdData(data);
      setUssdLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#05070d", color: "#d6deeb", fontFamily: "'Space Mono', monospace", display: "flex", flexDirection: "column" }}>
      <SidebarDetailModal
        data={sidebarModal}
        onClose={() => setSidebarModal(null)}
        countries={WEST_AFRICAN_COUNTRIES}
      />

      {showDashboard && selectedCountry ? (
        <CountryDashboard
          country={selectedCountry}
          indexValue={indices[selectedCountry.code]}
          onClose={() => setShowDashboard(false)}
          bankContext={bankContextCache[selectedCountry.code] || null}
          transportData={transportCache[selectedCountry.code] || null}
          macroData={macroCache[selectedCountry.code] || null}
          historyData={historyCache[selectedCountry.code] || null}
          tradeDataByCountry={COUNTRY_TRADE_DATA}
          taxDataByCountry={COUNTRY_TAX_DATA}
        />
      ) : (
        <WasiTerminalBoard
          countries={WEST_AFRICAN_COUNTRIES}
          indices={indices}
          liveSignals={liveSignals}
          selectedCountry={selectedCountry}
          onCountryToggle={handleCountryToggle}
          wasiComposite={wasiComposite}
          stockMarkets={stockMarkets}
          commodityPrices={commodityPrices}
          newsEvents={newsEvents}
          userInfo={userInfo}
          onLogout={onLogout}
          dataSource={dataSource}
          backendConnected={backendConnected}
          messages={messages}
          input={input}
          onInputChange={setInput}
          onSend={sendMessage}
          loading={loading}
          onToggleUSSD={handleToggleUSSD}
          setSidebarModal={setSidebarModal}
          dexMarkets={dexMarkets}
          dexRecentTrades={dexRecentTrades}
          dexOrderBook={dexOrderBook}
          dexPortfolio={dexPortfolio}
          dexSelectedSymbol={dexSelectedSymbol}
          onDexSelectSymbol={setDexSelectedSymbol}
          dexOrderForm={dexOrderForm}
          onDexOrderFormChange={setDexOrderForm}
          dexSubmitting={dexSubmitting}
          dexError={dexError}
          dexLastAction={dexLastAction}
          onDexPlaceOrder={onDexPlaceOrder}
          onDexCancelOrder={onDexCancelOrder}
        />
      )}

      {showUSSDPanel ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(3,13,26,0.86)",
            zIndex: 410,
            display: "flex",
            alignItems: "stretch",
            justifyContent: "center",
            padding: 12,
          }}
          onClick={() => setShowUSSDPanel(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 1480,
              border: "1px solid #1a2845",
              background: "#05070d",
              overflow: "hidden",
              display: "flex",
              minHeight: "86vh",
              borderRadius: 6,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            {ussdLoading && !ussdData ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#94a3b8",
                  fontSize: 15,
                }}
              >
                Chargement des données USSD...
              </div>
            ) : (
              <USSDVisualizationPanel
                ussdData={ussdData}
                onClose={() => setShowUSSDPanel(false)}
                countryCatalog={WEST_AFRICAN_COUNTRIES}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}


export default function App() {
  return (
    <WASIAppShell
      apiUrl={BACKEND_API_URL}
      AgentComponent={WASIAgent}
      LoginComponent={LoginPage}
    />
  );
}
