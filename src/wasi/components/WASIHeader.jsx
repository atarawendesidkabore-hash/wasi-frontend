export function WASIHeader({
  backendConnected,
  dataSource,
  wasiTrend,
  wasiComposite,
  userInfo,
  onLogout,
  mobilePanel,
  onMobilePanelChange,
}) {
  const tabs = [
    { id: "left", label: "INDICES", icon: "IDX" },
    { id: "center", label: "CHAT", icon: "CHAT" },
    { id: "right", label: "MARCHES", icon: "MKT" },
  ];

  return (
    <div
      style={{
        background: "rgba(3,13,26,0.95)",
        borderBottom: "1px solid #0f2a45",
        padding: "16px 28px",
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="wasi-header-full" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, letterSpacing: 6, color: "#f0b429", lineHeight: 1 }}>
              WASI
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: 3, textTransform: "uppercase" }}>
              Agent IA v3.0 | Intelligence CEDEAO
            </div>
          </div>
          <div style={{ width: 1, height: 36, background: "#0f2a45" }} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: backendConnected ? "#4ade80" : "#f0b429" }} />
              <span style={{ fontSize: 14, color: backendConnected ? "#4ade80" : "#f0b429", letterSpacing: 2 }}>
                {backendConnected ? `EN DIRECT | ${dataSource === "live" ? "TEMPS REEL" : "SIMULATION"}` : "SIMULATION"}
              </span>
            </div>
            <div style={{ fontSize: 28, fontFamily: "'Bebas Neue', sans-serif", color: wasiTrend.color, letterSpacing: 2 }}>
              WASI {wasiComposite} <span style={{ fontSize: 15 }}>{wasiTrend.label}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {userInfo ? (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 14, color: "#e2e8f0", letterSpacing: 1, fontFamily: "'Space Mono', monospace" }}>
                {userInfo.username}
              </div>
              <div style={{ fontSize: 13, color: "#f0b429" }}>
                {typeof userInfo.x402_balance === "number" ? `${userInfo.x402_balance.toLocaleString()} credits` : userInfo.tier || ""}
              </div>
            </div>
          ) : null}

          <div
            style={{
              padding: "6px 14px",
              background: backendConnected && dataSource === "live" ? "rgba(74,222,128,0.08)" : "rgba(240,180,41,0.10)",
              border: `1px solid ${backendConnected && dataSource === "live" ? "#4ade8044" : "#f0b42966"}`,
              borderRadius: 4,
              fontSize: 14,
              color: backendConnected && dataSource === "live" ? "#4ade80" : "#f0b429",
              fontFamily: "'Space Mono', monospace",
              letterSpacing: 1,
            }}
          >
            {backendConnected && dataSource === "live" ? "DONNEES LIVE" : "DEMO"}
          </div>

          {onLogout ? (
            <button
              onClick={onLogout}
              style={{
                background: "none",
                border: "1px solid #1e3a5f",
                borderRadius: 4,
                color: "#64748b",
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "'Space Mono', monospace",
                letterSpacing: 1,
                padding: "5px 10px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#ef4444";
                e.currentTarget.style.color = "#ef4444";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#1e3a5f";
                e.currentTarget.style.color = "#64748b";
              }}
            >
              DECONNEXION
            </button>
          ) : null}
        </div>
      </div>

      <div className="wasi-header-compact" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 4, color: "#f0b429", lineHeight: 1 }}>
            WASI
          </div>
          <div className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: backendConnected ? "#4ade80" : "#f0b429" }} />
          <span style={{ fontSize: 20, fontFamily: "'Bebas Neue', sans-serif", color: wasiTrend.color, letterSpacing: 2 }}>
            {wasiComposite}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {onLogout ? (
            <button
              onClick={onLogout}
              style={{
                background: "none",
                border: "1px solid #1e3a5f",
                borderRadius: 4,
                color: "#64748b",
                cursor: "pointer",
                fontSize: 13,
                padding: "4px 8px",
                fontFamily: "'Space Mono', monospace",
              }}
            >
              SORTIR
            </button>
          ) : null}
        </div>
      </div>

      <div className="wasi-mobile-nav" style={{ justifyContent: "center", gap: 0, marginTop: 8, borderTop: "1px solid #0f2a45", paddingTop: 8 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onMobilePanelChange(tab.id)}
            style={{
              flex: 1,
              background: mobilePanel === tab.id ? "rgba(240,180,41,0.12)" : "transparent",
              border: "none",
              borderBottom: mobilePanel === tab.id ? "2px solid #f0b429" : "2px solid transparent",
              color: mobilePanel === tab.id ? "#f0b429" : "#64748b",
              cursor: "pointer",
              padding: "6px 0",
              fontSize: 13,
              letterSpacing: 1,
              fontFamily: "'Space Mono', monospace",
              transition: "all 0.2s",
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
