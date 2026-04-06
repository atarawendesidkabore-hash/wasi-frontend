function IndexCard({ country, index, isActive, onClick, liveSignal }) {
  const trend = index > 65 ? "+" : index > 45 ? "=" : "-";
  const trendColor = index > 65 ? "#4ade80" : index > 45 ? "#f0b429" : "#ef4444";
  const adj = liveSignal?.live_adjustment;
  const hasAdj = adj !== undefined && adj !== null && adj !== 0;
  const adjColor = adj > 0 ? "#4ade80" : adj < 0 ? "#ef4444" : "#94a3b8";

  return (
    <button
      onClick={onClick}
      style={{
        background: isActive ? "rgba(240,180,41,0.12)" : "rgba(15,31,53,0.8)",
        border: `1px solid ${isActive ? "#f0b429" : "#1e3a5f"}`,
        borderRadius: 8,
        padding: "14px 16px",
        textAlign: "left",
        cursor: "pointer",
        transition: "all 0.2s",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 34,
              height: 34,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 6,
              border: "1px solid #1e3a5f",
              color: "#94a3b8",
              fontSize: 12,
              fontFamily: "'Space Mono', monospace",
            }}
          >
            {country.code}
          </span>
          <div>
            <div style={{ fontSize: 14, color: "#94a3b8", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>
              {country.code}
            </div>
            <div style={{ fontSize: 15, color: "#e2e8f0", fontFamily: "'Space Mono', monospace" }}>
              {country.name.split(" ")[0]}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontFamily: "'Bebas Neue', sans-serif", color: trendColor, letterSpacing: 2 }}>
            {Math.round(index)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
            <span style={{ fontSize: 15, color: trendColor }}>{trend}</span>
            {hasAdj ? (
              <span style={{ fontSize: 13, color: adjColor, fontFamily: "'Space Mono', monospace", letterSpacing: 0 }}>
                {adj > 0 ? "+" : ""}
                {adj.toFixed(1)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}

export function LeftSidebar({
  mobilePanel,
  countries,
  indices,
  selectedCountryCode,
  liveSignals,
  onCountryToggle,
  wasiTrend,
  wasiComposite,
  alertCount,
  ussdData,
  ussdLoading,
  onToggleUSSD,
}) {
  return (
    <div
      className={`wasi-sidebar-left${mobilePanel === "left" ? " mobile-active" : ""}`}
      style={{ borderRight: "1px solid #0f2a45", padding: 16, overflowY: "auto", background: "rgba(3,13,26,0.6)" }}
    >
      <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>
        Indices Pays
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {countries.map((country) => (
          <IndexCard
            key={country.code}
            country={country}
            index={indices[country.code]}
            isActive={selectedCountryCode === country.code}
            liveSignal={liveSignals[country.code]}
            onClick={() => onCountryToggle(country)}
          />
        ))}
      </div>

      <div
        style={{
          marginTop: 12,
          padding: "12px 14px",
          background: "rgba(240,180,41,0.05)",
          border: "1px solid #1e3a5f",
          borderRadius: 4,
        }}
      >
        <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: 2, marginBottom: 4 }}>COMPOSITE WASI</div>
        <div style={{ fontSize: 40, fontFamily: "'Bebas Neue', sans-serif", color: wasiTrend.color, letterSpacing: 3 }}>
          {wasiComposite}
        </div>
        <div style={{ fontSize: 14, color: "#94a3b8" }}>
          16 pays CEDEAO | {alertCount > 0 ? <span style={{ color: "#ef4444" }}>ALERT {alertCount}</span> : "Aucune alerte active"}
        </div>
      </div>

      <button
        onClick={() => {
          void onToggleUSSD();
        }}
        style={{
          width: "100%",
          marginTop: 10,
          padding: "14px 16px",
          background: ussdData ? "rgba(167,139,250,0.10)" : "rgba(15,42,69,0.5)",
          border: "1px solid #a78bfa44",
          borderRadius: 6,
          cursor: "pointer",
          textAlign: "left",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#a78bfa";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "#a78bfa44";
        }}
      >
        <div style={{ fontSize: 13, color: "#a78bfa", letterSpacing: 2, marginBottom: 3 }}>DONNEES USSD</div>
        <div style={{ fontSize: 14, color: "#94a3b8" }}>
          {ussdLoading ? "Chargement..." : ussdData ? `${(ussdData.total_records || 0).toLocaleString()} enr.` : "Charger les donnees"}
        </div>
      </button>
    </div>
  );
}
