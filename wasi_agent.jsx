import { useState, useEffect } from "react";
import { ChatPanel } from "./src/wasi/components/ChatPanel";
import { LeftSidebar } from "./src/wasi/components/LeftSidebar";
import { RightSidebar } from "./src/wasi/components/RightSidebar";
import { SidebarDetailModal } from "./src/wasi/components/SidebarDetailModal";
import { LoginPage } from "./src/wasi/components/LoginPage";
import { CountryDashboard } from "./src/wasi/components/CountryDashboard";
import { USSDVisualizationPanel } from "./src/wasi/components/USSDVisualizationPanel";
import { WASIHeader } from "./src/wasi/components/WASIHeader";
import { WASIAppShell } from "./src/wasi/components/WASIAppShell";
import { renderMarkdown } from "./src/wasi/utils/markdownRenderer";
import { generateIndices, calcWASI } from "./src/wasi/utils/wasiIndices";
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
  AGENT_CAPABILITIES,
  SUGGESTED_QUERIES,
} from "./src/wasi/config/wasiData";

// ============================================================
// WASI AI AGENT — West African Shipping & Economic Intelligence
// Powered by Claude AI | ECOWAS 16 Nations
// ============================================================

// ── Backend API Integration ───────────────────────────────────────────────────
// Configurable: set window.WASI_API_URL before loading, or falls back to same-origin :8000
function WASIAgent({ authToken, userInfo, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [indices, setIndices] = useState(generateIndices());
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [wasiComposite, setWasiComposite] = useState(0);
  const [showCapabilities, setShowCapabilities] = useState(true);
  const [backendConnected, setBackendConnected] = useState(false);
  const [backendToken, setBackendToken] = useState(null);
  const [dataSource, setDataSource] = useState("simulation");
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
  const [mobilePanel, setMobilePanel] = useState("center");     // "left" | "center" | "right"
  const [ussdData, setUssdData] = useState(null);               // USSD aggregate data
  const [ussdLoading, setUssdLoading] = useState(false);

  // ── Connect to backend when authToken is available ────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function connectBackend() {
      const token = authToken;
      if (cancelled || !token) return;
      setBackendToken(token);
      setBackendConnected(true);

      // Fetch real indices
      const realIndices = await fetchBackendIndices(token);
      if (cancelled) return;
      if (realIndices && Object.keys(realIndices).length > 0) {
        // Merge backend real data with simulation fallback for countries not yet in backend
        const simulated = generateIndices();
        const merged = { ...simulated, ...realIndices };
        setIndices(merged);
        setDataSource("live");
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
      const stocks = await fetchStockMarkets(token);
      if (cancelled) return;
      if (stocks && stocks.length > 0) setStockMarkets(stocks);

      // Fetch divergence signals
      const divs = await fetchDivergence(token);
      if (cancelled) return;
      if (divs && divs.length > 0) setDivergenceSignals(divs);

      // Fetch live signals (v2) — base + news adjustment per country
      const signals = await fetchLiveSignals(token);
      if (cancelled) return;
      if (signals && Object.keys(signals).length > 0) setLiveSignals(signals);

      // Fetch active news events (v2)
      const events = await fetchNewsEvents(token);
      if (cancelled) return;
      if (events) setNewsEvents(events);

      // Fetch commodity prices (WB Pink Sheet)
      const commodities = await fetchCommodityPrices(token);
      if (cancelled) return;
      if (commodities && commodities.length > 0) setCommodityPrices(commodities);

      // Fetch USSD aggregate data
      const ussd = await fetchUSSDAggregate(token);
      if (cancelled) return;
      if (ussd) setUssdData(ussd);
    }
    connectBackend();
    return () => { cancelled = true; };
  }, [authToken]);

  // ── Periodic refresh (simulation fallback if backend down) ────────────────
  useEffect(() => {
    setWasiComposite(prev => prev || calcWASI(indices));
    const interval = setInterval(async () => {
      if (backendConnected && backendToken) {
        const realIndices = await fetchBackendIndices(backendToken);
        if (realIndices && Object.keys(realIndices).length > 0) {
          const simulated = generateIndices();
          const merged = { ...simulated, ...realIndices };
          setIndices(merged);
          setDataSource("live");
        } else {
          const newIndices = generateIndices();
          setIndices(newIndices);
          setWasiComposite(calcWASI(newIndices));
          setDataSource("simulation");
        }
        const composite = await fetchBackendComposite(backendToken);
        if (composite !== null) setWasiComposite(Math.round(composite));
      } else {
        const newIndices = generateIndices();
        setIndices(newIndices);
        setWasiComposite(calcWASI(newIndices));
      }
    }, 30000);
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

  const sendMessage = async (text) => {
    const query = text || input.trim();
    if (!query) return;

    const userMsg = { role: "user", content: query };
    setMessages(m => [...m, userMsg]);
    setInput("");
    setLoading(true);
    setShowCapabilities(false);

    try {
      const response = await fetch(`${BACKEND_API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(backendToken ? { "Authorization": `Bearer ${backendToken}` } : {}),
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
      setMessages(m => [...m, { role: "assistant", content: "⚠️ Erreur de connexion. Agent WASI hors ligne. Vérifiez la connectivité API." }]);
    }
    setLoading(false);
  };

  const wasiTrend = wasiComposite > 65 ? { label: "EXPANSION", color: "#4ade80" }
                  : wasiComposite > 50 ? { label: "STABLE", color: "#f0b429" }
                  : { label: "CONTRACTION", color: "#ef4444" };

  const handleCountryToggle = (country) => {
    const next = selectedCountry?.code === country.code ? null : country;
    setSelectedCountry(next);
    if (next) setShowDashboard(true);
  };

  const handleToggleUSSD = async () => {
    setShowDashboard(false);
    setSelectedCountry(null);
    setUssdLoading(!ussdData);

    if (!ussdData && backendToken) {
      const data = await fetchUSSDAggregate(backendToken);
      if (data) setUssdData(data);
      setUssdLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#030d1a", color: "#e2e8f0", fontFamily: "'Space Mono', monospace", display: "flex", flexDirection: "column" }}>
      {/* Sidebar detail modal (markets + news) */}
      <SidebarDetailModal
        data={sidebarModal}
        onClose={() => setSidebarModal(null)}
        countries={WEST_AFRICAN_COUNTRIES}
      />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Bebas+Neue&family=DM+Serif+Display:ital@0;1&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #f0b429; }
        .send-btn:hover { background: #f0b429 !important; color: #030d1a !important; }
        .sugg-btn:hover { background: rgba(240,180,41,0.15) !important; border-color: #f0b429 !important; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeUp { from{transform:translateY(12px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        .msg-enter { animation: fadeUp 0.3s ease; }
        .live-dot { animation: pulse 2s infinite; }
        /* ── Mobile Responsive ─────────────────────────── */
        @media (max-width: 1024px) {
          .wasi-main-grid { grid-template-columns: 1fr !important; }
          .wasi-sidebar-left, .wasi-sidebar-right { display: none; }
          .wasi-sidebar-left.mobile-active, .wasi-sidebar-right.mobile-active {
            display: block !important;
            position: fixed; top: 64px; bottom: 0; left: 0; right: 0; z-index: 80;
            background: #030d1a; overflow-y: auto; padding: 12px;
          }
          .wasi-mobile-nav { display: flex !important; }
          .wasi-header-full { display: none !important; }
          .wasi-header-compact { display: flex !important; }
        }
        @media (min-width: 1025px) {
          .wasi-mobile-nav { display: none !important; }
          .wasi-header-full { display: flex !important; }
          .wasi-header-compact { display: none !important; }
        }
      `}</style>

      {/* Scanline overlay */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden", opacity: 0.03 }}>
        <div style={{ position: "absolute", width: "100%", height: 2, background: "#f0b429", animation: "scanline 8s linear infinite" }} />
      </div>

      <WASIHeader
        backendConnected={backendConnected}
        dataSource={dataSource}
        wasiTrend={wasiTrend}
        wasiComposite={wasiComposite}
        userInfo={userInfo}
        onLogout={onLogout}
        mobilePanel={mobilePanel}
        onMobilePanelChange={setMobilePanel}
      />

      {/* MAIN LAYOUT */}
      <div className="wasi-main-grid" style={{ display: "grid", gridTemplateColumns: "280px 1fr 300px", flex: 1, minHeight: 0, gap: 0 }}>

        <LeftSidebar
          mobilePanel={mobilePanel}
          countries={WEST_AFRICAN_COUNTRIES}
          indices={indices}
          selectedCountryCode={selectedCountry?.code || null}
          liveSignals={liveSignals}
          onCountryToggle={handleCountryToggle}
          wasiTrend={wasiTrend}
          wasiComposite={wasiComposite}
          alertCount={newsEvents.length}
          ussdData={ussdData}
          ussdLoading={ussdLoading}
          onToggleUSSD={handleToggleUSSD}
        />

        {/* CENTER — Dashboard pays, USSD Viz, ou Interface Chat */}
        {ussdData && !showDashboard && !selectedCountry ? (
          <USSDVisualizationPanel
            ussdData={ussdData}
            onClose={() => setUssdData(null)}
            countryCatalog={WEST_AFRICAN_COUNTRIES}
          />
        ) : showDashboard && selectedCountry ? (
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
        <ChatPanel
          showCapabilities={showCapabilities}
          capabilities={AGENT_CAPABILITIES}
          suggestedQueries={SUGGESTED_QUERIES}
          onSuggestedQuery={sendMessage}
          messages={messages}
          loading={loading}
          renderMarkdown={renderMarkdown}
          selectedCountry={selectedCountry}
          indices={indices}
          onClearCountryFocus={() => setSelectedCountry(null)}
          input={input}
          onInputChange={setInput}
          onSend={sendMessage}
          liveSignalsCount={Object.keys(liveSignals).length}
        />
        )}

        {/* RIGHT - Platform Info + ETF Signal */}
        <RightSidebar
          mobilePanel={mobilePanel}
          wasiTrend={wasiTrend}
          wasiComposite={wasiComposite}
          indices={indices}
          countries={WEST_AFRICAN_COUNTRIES}
          dataSource={dataSource}
          stockMarkets={stockMarkets}
          setSidebarModal={setSidebarModal}
          newsEvents={newsEvents}
          commodityPrices={commodityPrices}
          backendConnected={backendConnected}
        />
      </div>
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
