import { useState } from "react";

export function USSDVisualizationPanel({ ussdData, onClose, countryCatalog }) {
  const [activeTab, setActiveTab] = useState("overview");
  if (!ussdData) return null;

  const countries = ussdData.countries || [];
  const dateRange = ussdData.date_range || {};
  const totalRecords = ussdData.total_records || 0;
  const TABS = [
    { id: "overview", label: "VUE D'ENSEMBLE" },
    { id: "mobile_money", label: "MOBILE MONEY" },
    { id: "commodities", label: "COMMODITÃ‰S" },
    { id: "trade", label: "COMMERCE" },
    { id: "ports", label: "PORTS" },
  ];

  const panel = { background: "rgba(10,22,40,0.6)", border: "1px solid #1a2845", borderRadius: 6, padding: "16px 18px", marginBottom: 10 };
  const scoreColor = (v) => v >= 70 ? "#00ff84" : v >= 45 ? "#f0b429" : "#ff2d6f";

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px", background: "rgba(3,13,26,0.6)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: "#00d4ff", letterSpacing: 4, lineHeight: 1 }}>
            DONNÃ‰ES USSD TEMPS RÃ‰EL
          </div>
          <div style={{ fontSize: 13, color: "#7f8fa6", letterSpacing: 2, marginTop: 4 }}>
            MOBILE MONEY Â· PRIX ALIMENTAIRES Â· COMMERCE INFORMEL Â· ACTIVITÃ‰ PORTUAIRE
          </div>
          <div style={{ fontSize: 13, color: "#7f8fa6", marginTop: 4 }}>
            {totalRecords.toLocaleString()} enregistrements Â· {countries.length} pays Â· {dateRange.from || "N/D"} â†’ {dateRange.to || "N/D"}
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "1px solid #1a2845", color: "#7f8fa6", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 14, fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>â† RETOUR</button>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: "5px 12px", borderRadius: 4, fontSize: 13, letterSpacing: 1.5,
            cursor: "pointer", fontFamily: "'Space Mono', monospace",
            background: activeTab === t.id ? "rgba(0,212,255,0.12)" : "transparent",
            border: `1px solid ${activeTab === t.id ? "#00d4ff" : "#1a2845"}`,
            color: activeTab === t.id ? "#00d4ff" : "#7f8fa6",
            transition: "all 0.15s",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Overview â€” composite scores per country */}
      {activeTab === "overview" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
            {countries.sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0)).map((c, i) => {
              const cc = (countryCatalog || []).find(w => w.code === c.country_code);
              const score = c.composite_score || 0;
              return (
                <div key={i} style={{ ...panel, borderColor: scoreColor(score) + "44" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 18 }}>{cc?.flag || "ðŸŒ"} <span style={{ fontSize: 14, color: "#7f8fa6" }}>{c.country_code}</span></span>
                    <span style={{ fontSize: 26, fontFamily: "'Bebas Neue',sans-serif", color: scoreColor(score), letterSpacing: 2 }}>{score.toFixed(1)}</span>
                  </div>
                  {/* Component bars */}
                  {[
                    { label: "MoMo", val: c.mobile_money_score, color: "#00ff84" },
                    { label: "Prix", val: c.commodity_score, color: "#f0b429" },
                    { label: "Commerce", val: c.trade_score, color: "#00d4ff" },
                    { label: "Port", val: c.port_score, color: "#00d4ff" },
                  ].map((s, j) => (
                    <div key={j} style={{ marginBottom: 3 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#7f8fa6" }}>
                        <span>{s.label}</span><span style={{ color: s.color }}>{(s.val || 0).toFixed(0)}</span>
                      </div>
                      <div style={{ height: 5, background: "#0a1020", borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${Math.min(100, s.val || 0)}%`, background: s.color, borderRadius: 2, transition: "width 0.5s" }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: "#7f8fa6", marginTop: 4 }}>{c.records || 0} enr. Â· {c.dates || 0} dates</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile Money tab */}
      {activeTab === "mobile_money" && (
        <div style={panel}>
          <div style={{ fontSize: 14, color: "#00ff84", letterSpacing: 3, marginBottom: 10 }}>FLUX MOBILE MONEY (BCEAO / OPÃ‰RATEURS)</div>
          <div style={{ fontSize: 15, color: "#7f8fa6", lineHeight: 1.8, marginBottom: 12 }}>
            DonnÃ©es de flux mobile money agrÃ©gÃ©es par pays â€” Orange Money, MTN MoMo, Wave, M-Pesa.
            PondÃ©ration USSD : <strong style={{ color: "#00ff84" }}>30%</strong> du score composite.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
            {countries.map((c, i) => {
              const cc = (countryCatalog || []).find(w => w.code === c.country_code);
              const score = c.mobile_money_score || 0;
              return (
                <div key={i} style={{ padding: "14px 16px", background: "rgba(0,255,132,0.06)", border: "1px solid #00ff8433", borderRadius: 4 }}>
                  <div style={{ fontSize: 14, color: "#7f8fa6" }}>{cc?.flag} {c.country_code}</div>
                  <div style={{ fontSize: 22, fontFamily: "'Bebas Neue',sans-serif", color: scoreColor(score), letterSpacing: 2 }}>{score.toFixed(1)}</div>
                  <div style={{ height: 6, background: "#0a1020", borderRadius: 2, marginTop: 4 }}>
                    <div style={{ height: "100%", width: `${Math.min(100, score)}%`, background: "#00ff84", borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Commodities tab */}
      {activeTab === "commodities" && (
        <div style={panel}>
          <div style={{ fontSize: 14, color: "#f0b429", letterSpacing: 3, marginBottom: 10 }}>PRIX ALIMENTAIRES (WFP / HDX)</div>
          <div style={{ fontSize: 15, color: "#7f8fa6", lineHeight: 1.8, marginBottom: 12 }}>
            Prix des denrÃ©es de base collectÃ©s via USSD (riz, mil, maÃ¯s, sorgho, haricots, huile, sucre).
            PondÃ©ration : <strong style={{ color: "#f0b429" }}>20%</strong> du score composite.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
            {countries.map((c, i) => {
              const cc = (countryCatalog || []).find(w => w.code === c.country_code);
              const score = c.commodity_score || 0;
              return (
                <div key={i} style={{ padding: "14px 16px", background: "rgba(240,180,41,0.06)", border: "1px solid #f0b42933", borderRadius: 4 }}>
                  <div style={{ fontSize: 14, color: "#7f8fa6" }}>{cc?.flag} {c.country_code}</div>
                  <div style={{ fontSize: 22, fontFamily: "'Bebas Neue',sans-serif", color: scoreColor(score), letterSpacing: 2 }}>{score.toFixed(1)}</div>
                  <div style={{ height: 6, background: "#0a1020", borderRadius: 2, marginTop: 4 }}>
                    <div style={{ height: "100%", width: `${Math.min(100, score)}%`, background: "#f0b429", borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trade tab */}
      {activeTab === "trade" && (
        <div style={panel}>
          <div style={{ fontSize: 14, color: "#00d4ff", letterSpacing: 3, marginBottom: 10 }}>COMMERCE INFORMEL TRANSFRONTALIER (CILSS)</div>
          <div style={{ fontSize: 15, color: "#7f8fa6", lineHeight: 1.8, marginBottom: 12 }}>
            DÃ©clarations commerciales informelles â€” flux camion, valeur USD, corridors actifs.
            PondÃ©ration : <strong style={{ color: "#00d4ff" }}>25%</strong> du score composite.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
            {countries.map((c, i) => {
              const cc = (countryCatalog || []).find(w => w.code === c.country_code);
              const score = c.trade_score || 0;
              return (
                <div key={i} style={{ padding: "14px 16px", background: "rgba(0,212,255,0.06)", border: "1px solid #00d4ff33", borderRadius: 4 }}>
                  <div style={{ fontSize: 14, color: "#7f8fa6" }}>{cc?.flag} {c.country_code}</div>
                  <div style={{ fontSize: 22, fontFamily: "'Bebas Neue',sans-serif", color: scoreColor(score), letterSpacing: 2 }}>{score.toFixed(1)}</div>
                  <div style={{ height: 6, background: "#0a1020", borderRadius: 2, marginTop: 4 }}>
                    <div style={{ height: "100%", width: `${Math.min(100, score)}%`, background: "#00d4ff", borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ports tab */}
      {activeTab === "ports" && (
        <div style={panel}>
          <div style={{ fontSize: 14, color: "#00d4ff", letterSpacing: 3, marginBottom: 10 }}>EFFICACITÃ‰ PORTUAIRE (UNCTAD / PAA)</div>
          <div style={{ fontSize: 15, color: "#7f8fa6", lineHeight: 1.8, marginBottom: 12 }}>
            Temps de sÃ©jour navires, clearance douaniÃ¨re, throughput conteneurs.
            PondÃ©ration : <strong style={{ color: "#00d4ff" }}>25%</strong> du score composite.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
            {countries.map((c, i) => {
              const cc = (countryCatalog || []).find(w => w.code === c.country_code);
              const score = c.port_score || 0;
              return (
                <div key={i} style={{ padding: "14px 16px", background: "rgba(0,212,255,0.06)", border: "1px solid #00d4ff33", borderRadius: 4 }}>
                  <div style={{ fontSize: 14, color: "#7f8fa6" }}>{cc?.flag} {c.country_code}</div>
                  <div style={{ fontSize: 22, fontFamily: "'Bebas Neue',sans-serif", color: scoreColor(score), letterSpacing: 2 }}>{score.toFixed(1)}</div>
                  <div style={{ height: 6, background: "#0a1020", borderRadius: 2, marginTop: 4 }}>
                    <div style={{ height: "100%", width: `${Math.min(100, score)}%`, background: "#00d4ff", borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div style={{ marginTop: 10, padding: "10px 14px", background: "rgba(0,212,255,0.05)", border: "1px solid #00d4ff33", borderRadius: 4, fontSize: 13, color: "#7f8fa6", lineHeight: 1.7 }}>
        Source : WASI USSD Data Pipeline v3.0 Â· WFP/HDX (prix alimentaires) Â· BCEAO (mobile money) Â· UNCTAD (ports) Â· CILSS (commerce informel) Â· DonnÃ©es agrÃ©gÃ©es automatiquement.
      </div>
    </div>
  );
}


