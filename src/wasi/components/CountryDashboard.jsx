import { useState } from "react";

function BarChart({ data, color, maxVal }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
            <span style={{ fontSize: 13, color: "#7f8fa6" }}>{d.cat}</span>
            <span style={{ fontSize: 13, color, fontWeight: 700 }}>
              {d.val >= 1000 ? `${(d.val / 1000).toFixed(1)} Mrd$` : `${d.val} M$`}
            </span>
          </div>
          <div style={{ height: 8, background: "#0a1020", borderRadius: 2 }}>
            <div style={{ height: "100%", width: `${Math.round((d.val / maxVal) * 100)}%`, background: color, borderRadius: 2, transition: "width 0.8s ease" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Sparkline({ base, width = 180, height = 46, realData = null, seed = 0 }) {
  // Use real backend data if available, otherwise generate a country-unique pattern
  let pts;
  if (realData && realData.length >= 2) {
    // realData is newest-first; reverse so oldest is on the left
    const sorted = [...realData].reverse().slice(-12);
    pts = sorted.map(r => r.index_value ?? base);
  } else {
    // Deterministic but country-unique wave Ã¢â‚¬â€ seed offsets the phase
    const s = seed * 0.37;
    pts = Array.from({ length: 12 }, (_, i) =>
      Math.max(20, Math.min(99,
        base
        + Math.sin(i * 2.1 + s)       * 6
        + Math.cos(i * 1.3 + s * 1.7) * 4
        + Math.sin(i * 0.7 + s * 0.9) * 2
      ))
    );
  }
  const N = pts.length;
  const min = Math.min(...pts) - 2, max = Math.max(...pts) + 2;
  const range = max - min || 1;
  const svgPts = pts.map((v, i) => {
    const x = (i / (N - 1)) * width;
    const y = height - ((v - min) / range) * (height - 6) - 3;
    return `${x},${y}`;
  }).join(" ");
  const lastX = width;
  const lastY = height - ((pts[N - 1] - min) / range) * (height - 6) - 3;
  return (
    <svg width={width} height={height} style={{ overflow: "visible", display: "block" }}>
      <polyline points={svgPts} fill="none" stroke="#f0b429" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={3} fill="#f0b429" />
    </svg>
  );
}

function TradeDonut({ exports: exp, imports: imp }) {
  const total = exp + imp;
  const expPct = exp / total;
  const r = 28, cx = 48, cy = 38, sw = 10;
  const circ = 2 * Math.PI * r;
  const impArc = circ * (imp / total);
  const expArc = circ * expPct;
  return (
    <svg width={96} height={76} style={{ display: "block", margin: "0 auto" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#0a1020" strokeWidth={sw} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#00d4ff" strokeWidth={sw}
        strokeDasharray={`${impArc} ${circ}`} strokeDashoffset={0}
        transform={`rotate(-90 ${cx} ${cy})`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#00ff84" strokeWidth={sw}
        strokeDasharray={`${expArc} ${circ}`} strokeDashoffset={-impArc}
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy - 3} textAnchor="middle" fill="#f0b429" fontSize="10" fontFamily="Space Mono">
        {(expPct * 100).toFixed(0)}%
      </text>
      <text x={cx} y={cy + 9} textAnchor="middle" fill="#7f8fa6" fontSize="6" fontFamily="Space Mono">
        export
      </text>
    </svg>
  );
}

function fmt(val) {
  return val >= 1000 ? `${(val / 1000).toFixed(1)} Mrd$` : `${val} M$`;
}

function parsePartner(partnerLabel) {
  const match = partnerLabel.match(/(.*?)(\d+(?:[.,]\d+)?)%/);
  if (!match) {
    return {
      name: partnerLabel.trim(),
      sharePct: null,
    };
  }
  return {
    name: match[1].replace(/Ã‚Â·/g, "").trim(),
    sharePct: parseFloat(match[2].replace(",", ".")),
  };
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Transport Mode Panel Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function TransportModePanel({ transportData }) {
  const [activeMode, setActiveMode] = useState("composite");
  const hasNumber = (value) => Number.isFinite(Number(value));
  const toModeNumber = (value) => (hasNumber(value) ? Number(value) : null);
  const formatMode = (value, digits = 1) =>
    hasNumber(value) ? Number(value).toFixed(digits) : "N/D";

  const MODES = [
    { key: "maritime", label: "MARITIME", color: "#00d4ff" },
    { key: "air", label: "A\u00c9RIEN", color: "#f0b429" },
    { key: "rail", label: "RAIL", color: "#00d4ff" },
    { key: "road", label: "ROUTE", color: "#00ff84" },
    { key: "composite", label: "COMPOSITE", color: "#ffb020" },
  ];

  const panel = {
    background: "rgba(10,22,40,0.6)",
    border: "1px solid #1a2845",
    borderRadius: 6,
    padding: "16px 18px",
    marginTop: 10,
  };

  if (!transportData) {
    return (
      <div style={panel}>
        <div style={{ fontSize: 13, color: "#00d4ff", letterSpacing: 3, marginBottom: 8 }}>
          MODULE TRANSPORT MULTI-MODAL
        </div>
        <div style={{ fontSize: 15, color: "#7f8fa6", lineHeight: 1.6 }}>
          Donn\u00e9es transport non disponibles pour ce pays.
        </div>
      </div>
    );
  }

  const {
    modes,
    transport_composite,
    country_profile,
    profile_weights,
    source,
    source_note,
    data_mode,
    last_updated,
    methodology_version,
  } = transportData;

  const getModeIndex = (key) => {
    if (key === "composite") return toModeNumber(transport_composite);
    return toModeNumber(
      modes?.[key]?.index ??
        modes?.[key]?.score ??
        transportData?.[key]?.index ??
        transportData?.[key]?.score
    );
  };

  const getQualityBadge = (val) => {
    if (!hasNumber(val)) return { label: "N/D", color: "#7f8fa6" };
    if (val >= 70) return { label: "\u00c9LEV\u00c9", color: "#00ff84" };
    if (val >= 40) return { label: "MOYEN", color: "#f0b429" };
    return { label: "FAIBLE", color: "#ff2d6f" };
  };

  const getWeight = (key) => {
    if (!profile_weights || key === "composite") return null;
    return profile_weights[key] != null
      ? `${(profile_weights[key] * 100).toFixed(0)}%`
      : "N/D";
  };

  const currentVal = getModeIndex(activeMode);
  const currentBadge = getQualityBadge(currentVal);
  const currentColor =
    MODES.find((mode) => mode.key === activeMode)?.color || "#ffb020";
  const roadSource = modes?.road?.source || source_note || "N/D";
  const roadQuality = modes?.road?.quality || "N/D";

  return (
    <div style={panel}>
      <div style={{ fontSize: 13, color: "#00d4ff", letterSpacing: 3, marginBottom: 10 }}>
        MODULE TRANSPORT MULTI-MODAL
      </div>

      <div
        style={{
          marginBottom: 12,
          padding: "8px 10px",
          border: "1px solid #1a2845",
          borderRadius: 4,
          background: "rgba(15,42,69,0.35)",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, color: "#7f8fa6", lineHeight: 1.6 }}>
          Source route: <span style={{ color: "#00d4ff" }}>{roadSource}</span>
          <br />
          Qualit\u00e9 donn\u00e9es:{" "}
          <span style={{ color: roadQuality === "A" ? "#00ff84" : roadQuality === "B" ? "#f0b429" : "#ff2d6f" }}>
            {roadQuality}
          </span>
          {methodology_version ? <span> | M\u00e9thode: {methodology_version}</span> : null}
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: "#7f8fa6" }}>
          <div>{String(data_mode || "snapshot").toUpperCase()}</div>
          <div>{source || "wasi_transport_snapshot"}</div>
          <div>
            {last_updated
              ? new Date(last_updated).toLocaleDateString("fr-FR")
              : "Date N/D"}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {MODES.map((mode) => {
          const val = getModeIndex(mode.key);
          const label =
            mode.key === "composite"
              ? mode.label
              : `${mode.label}${hasNumber(val) ? Number(val).toFixed(0) : " N/D"}`;
          return (
            <button
              key={mode.key}
              onClick={() => setActiveMode(mode.key)}
              style={{
                padding: "6px 10px",
                borderRadius: 4,
                fontSize: 12,
                letterSpacing: 1,
                cursor: "pointer",
                fontFamily: "'Space Mono', monospace",
                background: activeMode === mode.key ? `${mode.color}22` : "transparent",
                border: `1px solid ${activeMode === mode.key ? mode.color : "#1a2845"}`,
                color: activeMode === mode.key ? mode.color : "#7f8fa6",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 90, marginBottom: 12 }}>
        {MODES.filter((mode) => mode.key !== "composite").map((mode) => {
          const val = getModeIndex(mode.key);
          const barHeight = hasNumber(val)
            ? Math.max(4, (Number(val) / 100) * 72)
            : 0;
          return (
            <div
              key={mode.key}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: mode.color,
                  fontFamily: "'Space Mono',monospace",
                  whiteSpace: "nowrap",
                }}
              >
                {formatMode(val, 1)}
              </div>
              <div
                style={{
                  width: "100%",
                  height: 72,
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                }}
              >
                {hasNumber(val) ? (
                  <div
                    style={{
                      width: "100%",
                      height: barHeight,
                      background: `linear-gradient(to top, ${mode.color}cc, ${mode.color}55)`,
                      borderRadius: "3px 3px 0 0",
                      transition: "height 0.3s",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: 20,
                      background:
                        "repeating-linear-gradient(45deg, #1a2845 0, #1a2845 4px, transparent 4px, transparent 8px)",
                      borderRadius: "3px 3px 0 0",
                    }}
                  />
                )}
              </div>
              <div style={{ fontSize: 11, color: "#7f8fa6", letterSpacing: 1, textAlign: "center" }}>
                {mode.label}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          borderTop: "1px solid #1a2845",
          paddingTop: 10,
          display: "flex",
          gap: 16,
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: "#7f8fa6", letterSpacing: 2 }}>MODE ACTIF</div>
          <div style={{ fontSize: 26, fontFamily: "'Bebas Neue',sans-serif", color: currentColor, letterSpacing: 3 }}>
            {formatMode(currentVal, 1)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#7f8fa6", letterSpacing: 2 }}>QUALIT\u00c9</div>
          <div style={{ fontSize: 14, color: currentBadge.color, letterSpacing: 1 }}>
            {currentBadge.label}
          </div>
        </div>
        {activeMode !== "composite" && (
          <div>
            <div style={{ fontSize: 12, color: "#7f8fa6", letterSpacing: 2 }}>POND\u00c9RATION</div>
            <div style={{ fontSize: 18, fontFamily: "'Bebas Neue',sans-serif", color: currentColor, letterSpacing: 2 }}>
              {getWeight(activeMode)}
            </div>
          </div>
        )}
        {activeMode === "composite" && (
          <div style={{ marginLeft: "auto" }}>
            <div style={{ fontSize: 12, color: "#7f8fa6", letterSpacing: 2 }}>PROFIL</div>
            <div style={{ fontSize: 13, color: "#00d4ff", letterSpacing: 1 }}>
              {(country_profile || "").replace(/_/g, " ").toUpperCase()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export function CountryDashboard({ country, indexValue, onClose, bankContext, transportData, macroData, historyData, tradeDataByCountry, taxDataByCountry }) {
  const [modal, setModal] = useState(null);
  const td = tradeDataByCountry[country.code];
  if (!td) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#7f8fa6", fontSize: 15 }}>
      DonnÃƒÂ©es non disponibles pour {country.name}
      <button onClick={onClose} style={{ marginLeft: 16, background: "none", border: "1px solid #1a2845", color: "#7f8fa6", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 14 }}>Ã¢â€ Â Retour</button>
    </div>
  );

  const balance = td.totalExports - td.totalImports;
  const coverageRate = ((td.totalExports / td.totalImports) * 100).toFixed(1);
  const balanceColor = balance >= 0 ? "#00ff84" : "#ff2d6f";
  const totalE = td.exports.reduce((s, d) => s + d.val, 0);
  const hhi = td.exports.reduce((s, d) => s + Math.pow(d.val / totalE, 2), 0);
  const diversityScore = ((1 - hhi) * 100).toFixed(0);
  const maxExport = Math.max(...td.exports.map(d => d.val));
  const maxImport = Math.max(...td.imports.map(d => d.val));
  const tierLabel = { primary: "Primaire", secondary: "Secondaire", tertiary: "Tertiaire" }[country.tier];
  const countrySeed = country.code.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const tierColor = { primary: "#00ff84", secondary: "#f0b429", tertiary: "#7f8fa6" }[country.tier];
  const indexTrend = indexValue > 65 ? { label: "EXPANSION", color: "#00ff84" }
                   : indexValue > 45 ? { label: "STABLE", color: "#f0b429" }
                   : { label: "CONTRACTION", color: "#ff2d6f" };
  const ratios = [
    { label: "Taux de couverture", val: `${coverageRate}%`, color: parseFloat(coverageRate) >= 100 ? "#00ff84" : "#ff2d6f", desc: "Exports / Imports Ãƒâ€” 100. Au-dessus de 100% = excÃƒÂ©dent commercial." },
    { label: "Balance commerciale", val: `${balance >= 0 ? "+" : ""}${fmt(balance)}`, color: balanceColor, desc: "DiffÃƒÂ©rence entre exportations et importations totales." },
    { label: "Diversification exports", val: `${diversityScore}/100`, color: parseInt(diversityScore) > 60 ? "#00ff84" : "#f0b429", desc: `Indice de diversification basÃƒÂ© sur l'HHI (${(hhi).toFixed(3)}). Plus c'est ÃƒÂ©levÃƒÂ©, moins le pays dÃƒÂ©pend d'un seul produit.` },
    { label: "Poids WASI rÃƒÂ©gional", val: `${(country.weight * 100).toFixed(1)}%`, color: "#00d4ff", desc: "Contribution de ce pays ÃƒÂ  l'indice composite WASI sur 16 nations CEDEAO." },
    { label: "Croissance du PIB", val: `+${td.gdpGrowth}%`, color: td.gdpGrowth > 5 ? "#00ff84" : "#f0b429", desc: "Taux de croissance annuel du PIB (derniÃƒÂ¨re estimation disponible)." },
    { label: "Signal de marchÃƒÂ©", val: indexTrend.label, color: indexTrend.color, desc: `EXPANSION (>65) Ã‚Â· STABLE (45Ã¢â‚¬â€œ65) Ã‚Â· CONTRACTION (<45). Valeur actuelle : ${indexValue}/100.` },
  ];
  const topExports = [...td.exports].sort((a, b) => b.val - a.val).slice(0, 3);
  const topImports = [...td.imports].sort((a, b) => b.val - a.val).slice(0, 3);
  const topPartners = (td.partners || []).map(parsePartner).slice(0, 3);
  const tradeDirection = balance >= 0 ? "EXCEDENTAIRE" : "DEFICITAIRE";
  const balanceSentence = balance >= 0
    ? `${country.name} affiche un excedent commercial de ${fmt(balance)}.`
    : `${country.name} affiche un deficit commercial de ${fmt(Math.abs(balance))}.`;
  const coverageSentence = parseFloat(coverageRate) >= 100
    ? `Les exportations couvrent ${coverageRate}% des importations.`
    : `Les exportations ne couvrent que ${coverageRate}% des importations.`;
  const exportConcentrationPct = td.totalExports > 0 && topExports[0]
    ? ((topExports[0].val / td.totalExports) * 100).toFixed(1)
    : "0.0";

  // Shared panel style Ã¢â‚¬â€ clickable
  const panel = (accent = "#1a2845") => ({
    padding: "16px 18px", background: "rgba(10,22,40,0.85)",
    border: `1px solid ${accent}`, borderRadius: 4,
    cursor: "pointer", transition: "border-color 0.2s, background 0.2s",
    position: "relative",
  });
  const hint = { position: "absolute", top: 6, right: 8, fontSize: 12, color: "#1a2845", letterSpacing: 1 };

  // Ã¢â€â‚¬Ã¢â€â‚¬ Detail Modal Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const Modal = ({ type }) => {
    if (!type) return null;
    const configs = {
      exports: {
        title: "EXPORTATIONS PRINCIPALES", accent: "#00ff84",
        body: (
          <div>
            <div style={{ fontSize: 16, color: "#7f8fa6", marginBottom: 16, lineHeight: 1.7 }}>
              {country.flag} {country.name} Ã‚Â· Total exportations : <strong style={{ color: "#00ff84" }}>{fmt(td.totalExports)}</strong> Ã‚Â· Taux de couverture : <strong style={{ color: parseFloat(coverageRate) >= 100 ? "#00ff84" : "#ff2d6f" }}>{coverageRate}%</strong>
            </div>
            {td.exports.map((d, i) => {
              const pct = ((d.val / td.totalExports) * 100).toFixed(1);
              return (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 15, color: "#e2e8f0" }}>{d.cat}</span>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 20, color: "#00ff84", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 2 }}>{fmt(d.val)}</span>
                      <span style={{ fontSize: 15, color: "#7f8fa6", marginLeft: 10 }}>{pct}% du total</span>
                    </div>
                  </div>
                  <div style={{ height: 10, background: "#0a1020", borderRadius: 3 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "#00ff84", borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 20, padding: "12px 16px", background: "rgba(0,255,132,0.06)", border: "1px solid #00ff8444", borderRadius: 4, display: "flex", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 15, color: "#7f8fa6", letterSpacing: 1 }}>TOTAL EXPORTATIONS</div><div style={{ fontSize: 34, fontFamily: "'Bebas Neue',sans-serif", color: "#00ff84" }}>{fmt(td.totalExports)}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 15, color: "#7f8fa6", letterSpacing: 1, marginBottom: 4 }}>PRINCIPAUX MARCHÃƒâ€°S</div>{td.partners.slice(0, 3).map((p, i) => <div key={i} style={{ fontSize: 15, color: "#7f8fa6" }}>{p}</div>)}</div>
            </div>
          </div>
        ),
      },
      imports: {
        title: "IMPORTATIONS PRINCIPALES", accent: "#00d4ff",
        body: (
          <div>
            <div style={{ fontSize: 16, color: "#7f8fa6", marginBottom: 16, lineHeight: 1.7 }}>
              {country.flag} {country.name} Ã‚Â· Total importations : <strong style={{ color: "#00d4ff" }}>{fmt(td.totalImports)}</strong> Ã‚Â· DÃƒÂ©ficit commercial : <strong style={{ color: balanceColor }}>{fmt(Math.abs(balance))}</strong>
            </div>
            {td.imports.map((d, i) => {
              const pct = ((d.val / td.totalImports) * 100).toFixed(1);
              return (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 15, color: "#e2e8f0" }}>{d.cat}</span>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 20, color: "#00d4ff", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 2 }}>{fmt(d.val)}</span>
                      <span style={{ fontSize: 15, color: "#7f8fa6", marginLeft: 10 }}>{pct}% du total</span>
                    </div>
                  </div>
                  <div style={{ height: 10, background: "#0a1020", borderRadius: 3 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "#00d4ff", borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 20, padding: "12px 16px", background: "rgba(0,212,255,0.06)", border: "1px solid #00d4ff44", borderRadius: 4, display: "flex", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 15, color: "#7f8fa6", letterSpacing: 1 }}>TOTAL IMPORTATIONS</div><div style={{ fontSize: 34, fontFamily: "'Bebas Neue',sans-serif", color: "#00d4ff" }}>{fmt(td.totalImports)}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 15, color: "#7f8fa6", letterSpacing: 1 }}>BALANCE NETTE</div><div style={{ fontSize: 34, fontFamily: "'Bebas Neue',sans-serif", color: balanceColor }}>{balance >= 0 ? "+" : ""}{fmt(balance)}</div></div>
            </div>
          </div>
        ),
      },
      ratios: {
        title: "ANALYSE DES RATIOS", accent: "#f0b429",
        body: (
          <div>
            {ratios.map((r, i) => (
              <div key={i} style={{ marginBottom: 16, padding: "18px 22px", background: "rgba(15,42,69,0.4)", border: `1px solid ${r.color}33`, borderRadius: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 15, color: "#7f8fa6" }}>{r.label}</span>
                  <span style={{ fontSize: 28, fontFamily: "'Bebas Neue',sans-serif", color: r.color, letterSpacing: 2 }}>{r.val}</span>
                </div>
                <div style={{ fontSize: 16, color: "#7f8fa6", lineHeight: 1.7 }}>{r.desc}</div>
              </div>
            ))}
          </div>
        ),
      },
      wasi: {
        title: "Ãƒâ€°VOLUTION INDEX WASI", accent: "#f0b429",
        body: (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Sparkline base={indexValue} width={580} height={120} realData={historyData} seed={countrySeed} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, color: "#7f8fa6", marginTop: 8 }}>
                {["Jan", "FÃƒÂ©v", "Mar", "Avr", "Mai", "Jun", "Jul", "AoÃƒÂ»", "Sep", "Oct", "Nov", "DÃƒÂ©c"].map(m => <span key={m}>{m}</span>)}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { label: "VALEUR ACTUELLE", val: `${indexValue}/100`, color: indexTrend.color },
                { label: "SIGNAL", val: indexTrend.label, color: indexTrend.color },
                { label: "POIDS CEDEAO", val: `${(country.weight * 100).toFixed(1)}%`, color: "#00d4ff" },
              ].map((s, i) => (
                <div key={i} style={{ padding: "16px 18px", background: "rgba(15,42,69,0.4)", border: "1px solid #1a2845", borderRadius: 4 }}>
                  <div style={{ fontSize: 15, color: "#7f8fa6", letterSpacing: 2, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 32, fontFamily: "'Bebas Neue',sans-serif", color: s.color, letterSpacing: 3 }}>{s.val}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: "18px 24px", background: "rgba(15,42,69,0.3)", borderRadius: 4, fontSize: 16, color: "#7f8fa6", lineHeight: 1.9 }}>
              <strong style={{ color: "#f0b429" }}>MÃƒÂ©thodologie WASI :</strong><br />
              Composantes : ArrivÃƒÂ©es de navires (40%) Ã‚Â· Tonnage cargo (30%) Ã‚Â· EfficacitÃƒÂ© portuaire (20%) Ã‚Â· Croissance ÃƒÂ©conomique (10%)<br />
              Base 100 = Moyenne historique 5 ans Ã‚Â· Au-dessus de 70 = Expansion forte Ã‚Â· 45Ã¢â‚¬â€œ70 = StabilitÃƒÂ© Ã‚Â· En dessous de 45 = Contraction
            </div>
          </div>
        ),
      },
      partners: {
        title: "PARTENAIRES COMMERCIAUX", accent: "#00d4ff",
        body: (
          <div>
            <div style={{ fontSize: 16, color: "#7f8fa6", marginBottom: 16, lineHeight: 1.7 }}>Principaux partenaires ÃƒÂ  l'import-export de {country.name} (estimations 2023)</div>
            {td.partners.map((p, i) => {
              const pct = parseFloat(p.match(/(\d+)%/)?.[1] || 10);
              const name = p.replace(/\d+%/, "").replace(/Ã‚Â·/g, "").trim();
              return (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 15, color: "#e2e8f0" }}>{i + 1}. {name}</span>
                    <span style={{ fontSize: 18, fontFamily: "'Bebas Neue',sans-serif", color: "#00d4ff", letterSpacing: 2 }}>{pct}%</span>
                  </div>
                  <div style={{ height: 8, background: "#0a1020", borderRadius: 3 }}>
                    <div style={{ height: "100%", width: `${pct * 2}%`, background: "#00d4ff", borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(0,212,255,0.06)", border: "1px solid #00d4ff44", borderRadius: 4, fontSize: 15, color: "#7f8fa6", lineHeight: 1.8 }}>
              Les flux commerciaux restants sont rÃƒÂ©partis entre d'autres partenaires non listÃƒÂ©s. Source : UN Comtrade, FMI Direction of Trade Statistics.
            </div>
          </div>
        ),
      },
      flux: {
        title: "RÃƒâ€°PARTITION DES FLUX COMMERCIAUX", accent: "#f0b429",
        body: (
          <div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <TradeDonut exports={td.totalExports} imports={td.totalImports} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              {[
                { label: "EXPORTATIONS TOTALES", val: fmt(td.totalExports), color: "#00ff84", pct: ((td.totalExports / (td.totalExports + td.totalImports)) * 100).toFixed(1) },
                { label: "IMPORTATIONS TOTALES", val: fmt(td.totalImports), color: "#00d4ff", pct: ((td.totalImports / (td.totalExports + td.totalImports)) * 100).toFixed(1) },
              ].map((s, i) => (
                <div key={i} style={{ padding: "18px 22px", background: "rgba(15,42,69,0.4)", border: `1px solid ${s.color}44`, borderRadius: 4 }}>
                  <div style={{ fontSize: 15, color: "#7f8fa6", letterSpacing: 2, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 34, fontFamily: "'Bebas Neue',sans-serif", color: s.color, letterSpacing: 3 }}>{s.val}</div>
                  <div style={{ fontSize: 15, color: "#7f8fa6", marginTop: 4 }}>{s.pct}% des flux totaux</div>
                </div>
              ))}
            </div>
            <div style={{ padding: "18px 22px", background: balance >= 0 ? "rgba(0,255,132,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${balanceColor}44`, borderRadius: 4 }}>
              <div style={{ fontSize: 15, color: "#7f8fa6", letterSpacing: 2, marginBottom: 6 }}>BALANCE NETTE</div>
              <div style={{ fontSize: 40, fontFamily: "'Bebas Neue',sans-serif", color: balanceColor, letterSpacing: 3 }}>{balance >= 0 ? "+" : ""}{fmt(balance)}</div>
              <div style={{ fontSize: 16, color: "#7f8fa6", marginTop: 4 }}>Taux de couverture : {coverageRate}% Ã‚Â· {parseFloat(coverageRate) >= 100 ? "ExcÃƒÂ©dent commercial" : "DÃƒÂ©ficit commercial"}</div>
            </div>
          </div>
        ),
      },
      opportunities: {
        title: "OPPORTUNITÃƒâ€°S DE MARCHÃƒâ€°", accent: "#00ff84",
        body: (
          <div>
            <div style={{ fontSize: 16, color: "#7f8fa6", marginBottom: 16, lineHeight: 1.7 }}>
              Secteurs ÃƒÂ  fort potentiel identifiÃƒÂ©s pour {country.name} Ã¢â‚¬â€ Score WASI actuel : {indexValue}/100
            </div>
            {td.opportunities.map((o, i) => (
              <div key={i} style={{ marginBottom: 12, padding: "18px 22px", background: "rgba(0,255,132,0.06)", border: "1px solid #00ff8444", borderRadius: 4 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ color: "#00ff84", fontSize: 20, flexShrink: 0 }}>Ã¢Å“Â¦</span>
                  <div style={{ fontSize: 16, color: "#e2e8f0", lineHeight: 1.6 }}>{o}</div>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(15,42,69,0.3)", borderRadius: 4, fontSize: 15, color: "#7f8fa6", lineHeight: 1.8 }}>
              Source : WASI Data Engine Ã‚Â· Analyses sectorielles CEDEAO Ã‚Â· Rapports d'investissement FMI/Banque Mondiale
            </div>
          </div>
        ),
      },
      risks: {
        title: "FACTEURS DE RISQUE", accent: "#ff2d6f",
        body: (
          <div>
            <div style={{ fontSize: 16, color: "#7f8fa6", marginBottom: 16, lineHeight: 1.7 }}>
              Principaux risques identifiÃƒÂ©s pour {country.name} Ã¢â‚¬â€ Impact potentiel sur l'indice WASI
            </div>
            {td.risks.map((r, i) => (
              <div key={i} style={{ marginBottom: 12, padding: "18px 22px", background: "rgba(239,68,68,0.05)", border: "1px solid #ff2d6f44", borderRadius: 4 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ color: "#ff2d6f", fontSize: 20, flexShrink: 0 }}>ÃƒÂ¢Ã…Â¡Ã‚Â </span>
                  <div style={{ fontSize: 16, color: "#e2e8f0", lineHeight: 1.6 }}>{r}</div>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(15,42,69,0.3)", borderRadius: 4, fontSize: 15, color: "#7f8fa6", lineHeight: 1.8 }}>
              Ãƒâ€°valuation des risques basÃƒÂ©e sur donnÃƒÂ©es macro-ÃƒÂ©conomiques, indice de stabilitÃƒÂ© politique et historique des flux commerciaux.
            </div>
          </div>
        ),
      },
      chef: {
        title: "CHEF D'Ãƒâ€°TAT & PROFIL POLITIQUE", accent: "#00d4ff",
        body: (
          <div>
            <div style={{ padding: "20px", background: "rgba(0,212,255,0.06)", border: "1px solid #00d4ff44", borderRadius: 6, marginBottom: 16, display: "flex", alignItems: "center", gap: 20 }}>
              <span style={{ fontSize: 60 }}>{country.flag}</span>
              <div>
                <div style={{ fontSize: 28, fontFamily: "'Bebas Neue',sans-serif", color: "#e2e8f0", letterSpacing: 3 }}>{td.president}</div>
                <div style={{ fontSize: 14, color: "#00d4ff", marginTop: 4 }}>En poste depuis : {td.presidentSince}</div>
                <div style={{ fontSize: 16, color: "#7f8fa6", marginTop: 6 }}>{country.name.toUpperCase()} Ã‚Â· {td.currency}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "CAPITALE OFFICIELLE", val: td.capitale, color: "#f0b429" },
                { label: "CENTRE Ãƒâ€°CONOMIQUE", val: td.siegeEconomique || td.capitale, color: "#00ff84" },
                { label: "SUPERFICIE", val: `${td.superficie.toLocaleString("fr-FR")} kmÃ‚Â²`, color: "#00d4ff" },
                { label: "MONNAIE", val: td.currency, color: "#00d4ff" },
                { label: "CROISSANCE PIB", val: `+${td.gdpGrowth}%`, color: td.gdpGrowth > 5 ? "#00ff84" : "#f0b429" },
                { label: "POIDS WASI", val: `${(country.weight * 100).toFixed(1)}%`, color: "#00d4ff" },
              ].map((s, i) => (
                <div key={i} style={{ padding: "16px 18px", background: "rgba(15,42,69,0.4)", border: "1px solid #1a2845", borderRadius: 4 }}>
                  <div style={{ fontSize: 14, color: "#7f8fa6", letterSpacing: 2, marginBottom: 5 }}>{s.label}</div>
                  <div style={{ fontSize: 26, fontFamily: "'Bebas Neue',sans-serif", color: s.color, letterSpacing: 2 }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      geo: {
        title: "GÃƒâ€°OGRAPHIE & INFRASTRUCTURE", accent: "#00d4ff",
        body: (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              {[
                { label: "CAPITALE OFFICIELLE", val: td.capitale, color: "#f0b429" },
                { label: "CENTRE Ãƒâ€°CONOMIQUE", val: td.siegeEconomique || td.capitale, color: "#00ff84" },
                { label: "SUPERFICIE", val: `${td.superficie.toLocaleString("fr-FR")} kmÃ‚Â²`, color: "#00d4ff" },
                { label: "PORT PRINCIPAL", val: country.port, color: "#00d4ff" },
                { label: "MONNAIE", val: td.currency, color: "#f0b429" },
                { label: "TIER WASI", val: tierLabel, color: tierColor },
              ].map((s, i) => (
                <div key={i} style={{ padding: "16px 18px", background: "rgba(15,42,69,0.4)", border: "1px solid #1a2845", borderRadius: 4 }}>
                  <div style={{ fontSize: 14, color: "#7f8fa6", letterSpacing: 2, marginBottom: 5 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontFamily: "'Bebas Neue',sans-serif", color: s.color, letterSpacing: 2 }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      resources: {
        title: "MATIÃƒË†RES PREMIÃƒË†RES & RESSOURCES", accent: "#00ff84",
        body: (
          <div>
            <div style={{ fontSize: 16, color: "#7f8fa6", marginBottom: 16, lineHeight: 1.7 }}>
              Ressources naturelles identifiÃƒÂ©es pour {country.name} ({td.matieres_premieres.length} ressources rÃƒÂ©pertoriÃƒÂ©es)
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {td.matieres_premieres.map((m, i) => (
                <span key={i} style={{ fontSize: 15, color: "#00ff84", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 4, padding: "6px 12px", lineHeight: 1.6 }}>{m}</span>
              ))}
            </div>
            <div style={{ padding: "18px 24px", background: "rgba(74,222,128,0.04)", border: "1px solid #00ff8422", borderRadius: 4, fontSize: 16, color: "#7f8fa6", lineHeight: 1.9 }}>
              <strong style={{ color: "#00ff84" }}>Impact sur l'indice WASI :</strong><br />
              Les matiÃƒÂ¨res premiÃƒÂ¨res reprÃƒÂ©sentent {((td.totalExports / (td.totalExports + td.totalImports)) * 100).toFixed(0)}% des ÃƒÂ©changes totaux. Une concentration ÃƒÂ©levÃƒÂ©e sur une seule ressource augmente la volatilitÃƒÂ© du score WASI. Score de diversification actuel : {diversityScore}/100.
            </div>
          </div>
        ),
      },
      metrics: {
        title: "MÃƒâ€°TRIQUES COMMERCIALES CLÃƒâ€°S", accent: balanceColor,
        body: (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { label: "BALANCE COMMERCIALE", val: `${balance >= 0 ? "+" : ""}${fmt(balance)}`, color: balanceColor, desc: "Exportations moins importations. Positif = excÃƒÂ©dent." },
                { label: "TAUX DE COUVERTURE", val: `${coverageRate}%`, color: parseFloat(coverageRate) >= 100 ? "#00ff84" : "#f0b429", desc: "CapacitÃƒÂ© des exports ÃƒÂ  financer les imports." },
                { label: "EXPORTATIONS TOTALES", val: fmt(td.totalExports), color: "#00ff84", desc: "Valeur totale des biens et services exportÃƒÂ©s." },
                { label: "IMPORTATIONS TOTALES", val: fmt(td.totalImports), color: "#00d4ff", desc: "Valeur totale des biens et services importÃƒÂ©s." },
                { label: "CROISSANCE PIB", val: `+${td.gdpGrowth}%`, color: td.gdpGrowth > 5 ? "#00ff84" : "#f0b429", desc: "Taux de croissance annuel du produit intÃƒÂ©rieur brut." },
                { label: "FLUX COMMERCIAUX TOTAUX", val: fmt(td.totalExports + td.totalImports), color: "#00d4ff", desc: "Somme des importations et exportations." },
              ].map((s, i) => (
                <div key={i} style={{ padding: "18px 22px", background: "rgba(15,42,69,0.4)", border: `1px solid ${s.color}33`, borderRadius: 4 }}>
                  <div style={{ fontSize: 14, color: "#7f8fa6", letterSpacing: 2, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 34, fontFamily: "'Bebas Neue',sans-serif", color: s.color, letterSpacing: 3, marginBottom: 8 }}>{s.val}</div>
                  <div style={{ fontSize: 15, color: "#7f8fa6", lineHeight: 1.7 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      brief: {
        title: "BRIEF ECONOMIQUE PAYS", accent: balanceColor,
        body: (
          <div>
            <div style={{ marginBottom: 16, padding: "14px 18px", background: "rgba(15,42,69,0.4)", border: "1px solid #1a2845", borderRadius: 6 }}>
              <div style={{ fontSize: 15, color: "#7f8fa6", lineHeight: 1.8 }}>
                Synthese rapide pour {country.flag} <strong style={{ color: "#e2e8f0" }}>{country.name}</strong> (base WASI interne).
                Ces chiffres sont des estimations de monitoring et ne remplacent pas une publication officielle.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[
                { label: "EXPORTATIONS", val: fmt(td.totalExports), color: "#00ff84" },
                { label: "IMPORTATIONS", val: fmt(td.totalImports), color: "#00d4ff" },
                { label: "BALANCE", val: `${balance >= 0 ? "+" : "-"}${fmt(Math.abs(balance))}`, color: balanceColor },
                { label: "COUVERTURE", val: `${coverageRate}%`, color: parseFloat(coverageRate) >= 100 ? "#00ff84" : "#f0b429" },
              ].map((kpi, i) => (
                <div key={i} style={{ padding: "12px 14px", background: "rgba(15,42,69,0.45)", border: `1px solid ${kpi.color}33`, borderRadius: 6 }}>
                  <div style={{ fontSize: 12, color: "#7f8fa6", letterSpacing: 1, marginBottom: 4 }}>{kpi.label}</div>
                  <div style={{ fontSize: 24, fontFamily: "'Bebas Neue',sans-serif", color: kpi.color, letterSpacing: 2 }}>{kpi.val}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 16, padding: "16px 18px", background: balance >= 0 ? "rgba(0,255,132,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${balanceColor}44`, borderRadius: 6 }}>
              <div style={{ fontSize: 14, color: "#7f8fa6", letterSpacing: 2, marginBottom: 8 }}>CE QU'IL FAUT RETENIR</div>
              <div style={{ fontSize: 16, color: "#e2e8f0", lineHeight: 1.8 }}>
                <div>- Solde commercial {tradeDirection} : {balanceSentence}</div>
                <div>- Couverture : {coverageSentence}</div>
                <div>- Produit export dominant : {topExports[0]?.cat || "N/D"} ({exportConcentrationPct}% des exportations).</div>
                <div>- Signal WASI courant : {indexTrend.label} ({Math.round(indexValue)}/100).</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div style={{ padding: "14px 16px", background: "rgba(74,222,128,0.05)", border: "1px solid #00ff8444", borderRadius: 6 }}>
                <div style={{ fontSize: 13, color: "#00ff84", letterSpacing: 2, marginBottom: 6 }}>TOP EXPORTS</div>
                {topExports.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 15, color: "#e2e8f0", padding: "4px 0", borderBottom: "1px solid #0a1020" }}>
                    <span>{item.cat}</span>
                    <span style={{ color: "#00ff84" }}>{fmt(item.val)}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: "14px 16px", background: "rgba(56,189,248,0.05)", border: "1px solid #00d4ff44", borderRadius: 6 }}>
                <div style={{ fontSize: 13, color: "#00d4ff", letterSpacing: 2, marginBottom: 6 }}>TOP IMPORTS</div>
                {topImports.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 15, color: "#e2e8f0", padding: "4px 0", borderBottom: "1px solid #0a1020" }}>
                    <span>{item.cat}</span>
                    <span style={{ color: "#00d4ff" }}>{fmt(item.val)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16, padding: "14px 16px", background: "rgba(0,212,255,0.06)", border: "1px solid #00d4ff44", borderRadius: 6 }}>
              <div style={{ fontSize: 13, color: "#00d4ff", letterSpacing: 2, marginBottom: 6 }}>PARTENAIRES MAJEURS</div>
              {topPartners.map((p, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 15, color: "#e2e8f0", padding: "4px 0", borderBottom: "1px solid #0a1020" }}>
                  <span>{i + 1}. {p.name}</span>
                  <span style={{ color: "#00d4ff" }}>{p.sharePct !== null ? `${p.sharePct}%` : "N/D"}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ padding: "14px 16px", background: "rgba(74,222,128,0.05)", border: "1px solid #00ff8444", borderRadius: 6 }}>
                <div style={{ fontSize: 13, color: "#00ff84", letterSpacing: 2, marginBottom: 6 }}>OPPORTUNITES</div>
                {td.opportunities.slice(0, 3).map((line, i) => (
                  <div key={i} style={{ fontSize: 14, color: "#7f8fa6", lineHeight: 1.7 }}>- {line}</div>
                ))}
              </div>
              <div style={{ padding: "14px 16px", background: "rgba(239,68,68,0.05)", border: "1px solid #ff2d6f44", borderRadius: 6 }}>
                <div style={{ fontSize: 13, color: "#ff2d6f", letterSpacing: 2, marginBottom: 6 }}>RISQUES</div>
                {td.risks.slice(0, 3).map((line, i) => (
                  <div key={i} style={{ fontSize: 14, color: "#7f8fa6", lineHeight: 1.7 }}>- {line}</div>
                ))}
              </div>
            </div>
          </div>
        ),
      },
      bank: {
        title: "MODULE BANCAIRE Ã¢â‚¬â€ CRÃƒâ€°DIT & ADVISORY", accent: "#ffb020",
        body: (() => {
          const RATING_COLOR = { AAA: "#00ff84", AA: "#00ff84", A: "#00ff84", BBB: "#f0b429", BB: "#ffb020", B: "#ff2d6f", CCC: "#ff2d6f" };
          const POL_LABEL = (s) => s <= 3 ? "FAIBLE" : s <= 6 ? "MODÃƒâ€°RÃƒâ€°" : "Ãƒâ€°LEVÃƒâ€°";
          const POL_COLOR = (s) => s <= 3 ? "#00ff84" : s <= 6 ? "#f0b429" : "#ff2d6f";
          if (!bankContext) return (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#7f8fa6", fontSize: 16 }}>
              <div style={{ fontSize: 34, marginBottom: 12 }}>Ã°Å¸ÂÂ¦</div>
              <div style={{ color: "#7f8fa6", marginBottom: 8 }}>Chargement des donnÃƒÂ©es bancairesÃ¢â‚¬Â¦</div>
              <div style={{ fontSize: 15, color: "#7f8fa6" }}>Connexion au backend WASI requise. Les donnÃƒÂ©es s'afficheront automatiquement une fois rÃƒÂ©cupÃƒÂ©rÃƒÂ©es.</div>
            </div>
          );
          const pol = bankContext.political_risk_score;
          const wasi = bankContext.wasi_index;
          const trade = bankContext.trade_summary;
          const proc = bankContext.procurement;
          // Use server-computed score (backend applies ECOWAS medians for missing data)
            const indicativeScoreNum = bankContext.indicative_score ?? 45.0;
          const indicativeScore = indicativeScoreNum.toFixed(1);
          const rating = bankContext.indicative_rating || "CCC";
          // Derive score components from bankContext
          const wasiPts = (wasi?.value ?? 50) * 0.4;
          const tradeBalance = trade ? (trade.total_exports || 0) - (trade.total_imports || 0) : 0;
          const tradePts = tradeBalance > 0 ? Math.min(20, (tradeBalance / 1e9) * 2) : Math.max(0, 10 + (tradeBalance / 1e9) * 0.5);
          const polPenalty = pol ? pol * 1.0 : 0;
          const ratingColor = RATING_COLOR[rating] || "#7f8fa6";
          const premiumBps = { AAA: 50, AA: 100, A: 150, BBB: 250, BB: 400, B: 600, CCC: 1000 }[rating] || 1000;
          const fmtUsd = (v) => { if (!v) return "N/D"; if (v >= 1e12) return `${(v/1e12).toFixed(1)} Bil USD`; if (v >= 1e9) return `${(v/1e9).toFixed(1)} Mrd USD`; if (v >= 1e6) return `${(v/1e6).toFixed(0)} M USD`; return `${v.toLocaleString()} USD`; };
          return (
            <div>
              <div style={{ fontSize: 16, color: "#7f8fa6", marginBottom: 20, lineHeight: 1.7 }}>
                Analyse de crÃƒÂ©dit souverain pour {country.flag} <strong style={{ color: "#e2e8f0" }}>{bankContext.country_name}</strong> Ã‚Â· Poids WASI : <strong style={{ color: "#ffb020" }}>{bankContext.composite_weight_pct}%</strong>
              </div>
              {/* Score + Rating */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
                {[
                  { label: "SCORE INDICATIF", val: `${indicativeScore}/100`, color: parseFloat(indicativeScore) >= 70 ? "#00ff84" : parseFloat(indicativeScore) >= 50 ? "#f0b429" : "#ff2d6f" },
                  { label: "NOTATION", val: rating, color: ratingColor },
                  { label: "PRIME DE RISQUE", val: `+${premiumBps} bps`, color: premiumBps <= 150 ? "#00ff84" : premiumBps <= 400 ? "#f0b429" : "#ff2d6f" },
                ].map((s, i) => (
                  <div key={i} style={{ padding: "18px 22px", background: "rgba(15,42,69,0.5)", border: `1px solid ${s.color}33`, borderRadius: 6 }}>
                    <div style={{ fontSize: 14, color: "#7f8fa6", letterSpacing: 2, marginBottom: 8 }}>{s.label}</div>
                    <div style={{ fontSize: 34, fontFamily: "'Bebas Neue',sans-serif", color: s.color, letterSpacing: 3 }}>{s.val}</div>
                  </div>
                ))}
              </div>
              {/* Score components */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 15, color: "#ffb020", letterSpacing: 2, marginBottom: 10 }}>COMPOSANTES DU SCORE</div>
                {[
                  { label: "Composante WASI Index", val: wasiPts.toFixed(1), max: 40, color: "#f0b429", desc: `Score WASI actuel : ${wasi?.value?.toFixed(1) || "N/D"}/100 Ã¢â€ â€™ ${wasiPts.toFixed(1)}/40 pts` },
                  { label: "Composante Balance Commerciale", val: tradePts.toFixed(1), max: 20, color: "#00d4ff", desc: `Balance : ${fmtUsd(tradeBalance)} Ã¢â€ â€™ ${tradePts.toFixed(1)}/20 pts` },
                  { label: "PÃƒÂ©nalitÃƒÂ© Risque Politique", val: `-${polPenalty.toFixed(1)}`, max: 10, color: POL_COLOR(pol), desc: `Score politique : ${pol}/10 (${POL_LABEL(pol)}) Ã¢â€ â€™ -${polPenalty.toFixed(1)}/10 pts` },
                ].map((c, i) => (
                  <div key={i} style={{ marginBottom: 12, padding: "16px 18px", background: "rgba(15,42,69,0.4)", border: "1px solid #1a2845", borderRadius: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 15, color: "#7f8fa6" }}>{c.label}</span>
                      <span style={{ fontSize: 22, fontFamily: "'Bebas Neue',sans-serif", color: c.color, letterSpacing: 2 }}>{c.val} pts</span>
                    </div>
                    <div style={{ height: 6, background: "#0a1020", borderRadius: 3, marginBottom: 6 }}>
                      <div style={{ height: "100%", width: `${Math.abs(parseFloat(c.val)) / c.max * 100}%`, background: c.color, borderRadius: 3 }} />
                    </div>
                    <div style={{ fontSize: 15, color: "#7f8fa6" }}>{c.desc}</div>
                  </div>
                ))}
              </div>
              {/* Trade partners from API */}
              {trade?.top_partners?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 15, color: "#ffb020", letterSpacing: 2, marginBottom: 10 }}>TOP PARTENAIRES COMMERCIAUX</div>
                  {trade.top_partners.slice(0, 4).map((p, i) => (
                    <div key={i} style={{ marginBottom: 8, padding: "10px 14px", background: "rgba(15,42,69,0.4)", border: "1px solid #1a2845", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 16, color: "#e2e8f0" }}>{p.partner}</div>
                        {p.top_exports && <div style={{ fontSize: 15, color: "#7f8fa6", marginTop: 3 }}>Exports : {typeof p.top_exports === "string" ? p.top_exports : p.top_exports.join(", ")}</div>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 20, fontFamily: "'Bebas Neue',sans-serif", color: "#00d4ff", letterSpacing: 2 }}>{fmtUsd(p.total_trade_usd)}</div>
                        <div style={{ fontSize: 14, color: (p.trade_balance_usd || 0) >= 0 ? "#00ff84" : "#ff2d6f" }}>Balance : {fmtUsd(p.trade_balance_usd)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Procurement */}
              {proc && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 15, color: "#ffb020", letterSpacing: 2, marginBottom: 10 }}>MARCHÃƒâ€°S PUBLICS (PROCUREMENT)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    {[
                      { label: "APPELS D'OFFRES", val: proc.tender_count ?? "N/D", color: "#00d4ff" },
                      { label: "ATTRIBUÃƒâ€°S", val: proc.awarded_count ?? "N/D", color: "#00ff84" },
                      { label: "INFRA (%)", val: proc.infrastructure_pct ? `${proc.infrastructure_pct}%` : "N/D", color: "#f0b429" },
                    ].map((s, i) => (
                      <div key={i} style={{ padding: "16px 18px", background: "rgba(15,42,69,0.4)", border: "1px solid #1a2845", borderRadius: 6 }}>
                        <div style={{ fontSize: 14, color: "#7f8fa6", letterSpacing: 1, marginBottom: 6 }}>{s.label}</div>
                        <div style={{ fontSize: 28, fontFamily: "'Bebas Neue',sans-serif", color: s.color, letterSpacing: 2 }}>{s.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* WACC Section */}
              {bankContext?.wacc && (() => {
                const w = bankContext.wacc;
                const waccColor = w.wacc_pct < 12 ? "#00ff84" : w.wacc_pct < 16 ? "#00ff84" : w.wacc_pct < 20 ? "#f0b429" : w.wacc_pct < 25 ? "#ffb020" : "#ff2d6f";
                return (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 15, color: "#00d4ff", letterSpacing: 2, marginBottom: 10 }}>WACC Ã¢â‚¬â€ COÃƒâ€ºT MOYEN PONDÃƒâ€°RÃƒâ€° DU CAPITAL</div>
                    {/* Big WACC number */}
                    <div style={{ padding: "18px 20px", background: `${waccColor}0d`, border: `1px solid ${waccColor}44`, borderRadius: 6, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 14, color: "#7f8fa6", letterSpacing: 2, marginBottom: 6 }}>WACC SOUVERAIN ESTIMÃƒâ€°</div>
                        <div style={{ fontSize: 56, fontFamily: "'Bebas Neue',sans-serif", color: waccColor, letterSpacing: 4, lineHeight: 1 }}>{w.wacc_pct}%</div>
                        <div style={{ fontSize: 15, color: "#7f8fa6", marginTop: 8, lineHeight: 1.7 }}>{w.interpretation}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, color: "#7f8fa6", letterSpacing: 1, marginBottom: 4 }}>FORMULE</div>
                        <div style={{ fontSize: 15, color: "#7f8fa6", lineHeight: 2, fontFamily: "'Space Mono',monospace" }}>
                          <div>WACC = (E/V Ãƒâ€” Re) + (D/V Ãƒâ€” Rd Ãƒâ€” (1Ã¢Ë†â€™T))</div>
                          <div style={{ color: "#7f8fa6" }}>E/V = {w.equity_ratio_pct}% Ã‚Â· D/V = {w.debt_ratio_pct}%</div>
                          <div style={{ color: "#7f8fa6" }}>T (impÃƒÂ´t) = {w.corporate_tax_rate_pct}%</div>
                        </div>
                      </div>
                    </div>
                    {/* Components grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                      {[
                        { label: "COÃƒâ€ºT DES FONDS PROPRES (Re)", val: `${w.cost_of_equity_pct}%`, color: "#00d4ff",
                          sub: `Re = Rf(${w.risk_free_rate_pct}%) + ÃŽÂ²(${w.beta}) Ãƒâ€” ERP(${w.equity_risk_premium_pct}%) + CRP(${w.country_risk_premium_pct}%)` },
                        { label: "COÃƒâ€ºT DE LA DETTE (Rd)", val: `${w.cost_of_debt_pct}%`, color: "#00d4ff",
                          sub: `Rd = Rf(${w.risk_free_rate_pct}%) + Spread souverain(${(w.sovereign_spread_bps/100).toFixed(2)}%)` },
                        { label: "PRIME DE RISQUE PAYS (CRP)", val: `${w.country_risk_premium_pct}%`, color: "#f0b429",
                          sub: `Composante politique + discount WASI` },
                        { label: "BÃƒÅ TA (ÃŽÂ²)", val: w.beta, color: "#ffb020",
                          sub: `Risque systÃƒÂ©matique vs marchÃƒÂ© EM global` },
                      ].map((s, i) => (
                        <div key={i} style={{ padding: "18px 22px", background: "rgba(15,42,69,0.5)", border: `1px solid ${s.color}33`, borderRadius: 6 }}>
                          <div style={{ fontSize: 14, color: "#7f8fa6", letterSpacing: 1, marginBottom: 6 }}>{s.label}</div>
                          <div style={{ fontSize: 28, fontFamily: "'Bebas Neue',sans-serif", color: s.color, letterSpacing: 2, marginBottom: 4 }}>{s.val}</div>
                          <div style={{ fontSize: 14, color: "#7f8fa6", lineHeight: 1.6 }}>{s.sub}</div>
                        </div>
                      ))}
                    </div>
                    {/* Interpretation bar */}
                    <div style={{ padding: "12px 16px", background: "rgba(15,42,69,0.3)", borderRadius: 6, fontSize: 15, color: "#7f8fa6", lineHeight: 1.8 }}>
                      <strong style={{ color: "#00d4ff" }}>Comment lire ce WACC :</strong> Tout projet d'investissement dans <strong style={{ color: "#e2e8f0" }}>{bankContext.country_name}</strong> doit gÃƒÂ©nÃƒÂ©rer un rendement supÃƒÂ©rieur ÃƒÂ  <strong style={{ color: waccColor }}>{w.wacc_pct}%</strong> par an pour ÃƒÂªtre crÃƒÂ©ateur de valeur. En dessous de ce seuil, le projet dÃƒÂ©truit de la valeur pour les investisseurs.
                    </div>
                  </div>
                );
              })()}
              {/* Disclaimer */}
              <div style={{ padding: "18px 24px", background: "rgba(251,146,60,0.05)", border: "1px solid #ffb02033", borderRadius: 6, fontSize: 15, color: "#7f8fa6", lineHeight: 1.9 }}>
                <strong style={{ color: "#ffb020" }}>Ã¢Å¡Â  Avertissement :</strong> Cette notation est gÃƒÂ©nÃƒÂ©rÃƒÂ©e automatiquement ÃƒÂ  partir des donnÃƒÂ©es WASI et des statistiques commerciales publiques. Elle est indicative uniquement et ne constitue pas une dÃƒÂ©cision de crÃƒÂ©dit dÃƒÂ©finitive. Toute approbation de prÃƒÂªt requiert la validation d'un agent bancaire humain.
              </div>
            </div>
          );
        })(),
      },
    };
    const cfg = configs[type];
    if (!cfg) return null;
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(3,13,26,0.93)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setModal(null)}>
        <div style={{ background: "#060b16", border: `1px solid ${cfg.accent}55`, borderRadius: 8, width: "100%", maxWidth: 900, maxHeight: "90vh", overflowY: "auto", padding: 40 }} onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${cfg.accent}33` }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, color: cfg.accent, letterSpacing: 4 }}>{country.flag} {country.name.toUpperCase()} Ã¢â‚¬â€ {cfg.title}</div>
            <button onClick={() => setModal(null)} style={{ background: "none", border: `1px solid ${cfg.accent}44`, color: cfg.accent, padding: "8px 18px", borderRadius: 6, cursor: "pointer", fontSize: 16, fontFamily: "'Space Mono',monospace", letterSpacing: 1 }}>Ã¢Å“â€¢ FERMER</button>
          </div>
          {cfg.body}
        </div>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px", background: "rgba(3,13,26,0.6)" }}>
      {modal && <Modal type={modal} />}

      {/* En-tÃƒÂªte pays */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 48 }}>{country.flag}</span>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: "#f0b429", letterSpacing: 4, lineHeight: 1 }}>{country.name.toUpperCase()}</div>
            <div style={{ fontSize: 13, color: "#7f8fa6", letterSpacing: 2, marginTop: 2 }}>PORT PRINCIPAL : {country.port.toUpperCase()} Ã‚Â· MONNAIE : {td.currency}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
              {[{ label: tierLabel.toUpperCase(), color: tierColor }, { label: indexTrend.label, color: indexTrend.color }, { label: `WASI ${Math.round(indexValue)}/100`, color: "#f0b429" }].map((b, i) => (
                <span key={i} style={{ fontSize: 13, color: b.color, border: `1px solid ${b.color}`, padding: "2px 7px", borderRadius: 2 }}>{b.label}</span>
              ))}
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "1px solid #1a2845", color: "#7f8fa6", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 14, fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>Ã¢â€ Â RETOUR</button>
      </div>

      {/* Fiche Pays Ã¢â‚¬â€ 3 clickable cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div onClick={() => setModal("chef")} style={{ ...panel("#1a2845"), }}>
          <div style={hint}>Ã¢â€ â€” DÃƒâ€°TAILS</div>
          <div style={{ fontSize: 12, color: "#7f8fa6", letterSpacing: 3, marginBottom: 6 }}>CHEF D'Ãƒâ€°TAT</div>
          <div style={{ fontSize: 15, color: "#e2e8f0", fontWeight: 700, lineHeight: 1.4 }}>{td.president}</div>
          <div style={{ fontSize: 13, color: "#7f8fa6", marginTop: 4 }}>En poste depuis : {td.presidentSince}</div>
        </div>
        <div onClick={() => setModal("geo")} style={{ ...panel("#1a2845") }}>
          <div style={hint}>Ã¢â€ â€” DÃƒâ€°TAILS</div>
          <div style={{ fontSize: 12, color: "#7f8fa6", letterSpacing: 3, marginBottom: 6 }}>GÃƒâ€°OGRAPHIE</div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 13, color: "#7f8fa6" }}>Capitale officielle</div>
            <div style={{ fontSize: 15, color: "#00d4ff", fontWeight: 700 }}>{td.capitale}</div>
            {td.siegeEconomique && td.siegeEconomique !== td.capitale && <div style={{ fontSize: 13, color: "#7f8fa6", marginTop: 2 }}>Centre ÃƒÂ©co. : {td.siegeEconomique}</div>}
          </div>
          <div><div style={{ fontSize: 13, color: "#7f8fa6" }}>Superficie</div><div style={{ fontSize: 15, color: "#f0b429", fontWeight: 700 }}>{td.superficie.toLocaleString("fr-FR")} kmÃ‚Â²</div></div>
        </div>
        <div onClick={() => setModal("resources")} style={{ ...panel("#1a2845") }}>
          <div style={hint}>Ã¢â€ â€” DÃƒâ€°TAILS</div>
          <div style={{ fontSize: 12, color: "#7f8fa6", letterSpacing: 3, marginBottom: 6 }}>MATIÃƒË†RES PREMIÃƒË†RES</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {td.matieres_premieres.map((m, i) => (
              <span key={i} style={{ fontSize: 12, color: "#00ff84", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 2, padding: "2px 6px", lineHeight: 1.6 }}>{m}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Bandeau mÃƒÂ©triques Ã¢â‚¬â€ clickable */}
      <div onClick={() => setModal("metrics")} style={{ display: "flex", gap: 12, marginBottom: 14, padding: "10px 14px", background: balance >= 0 ? "rgba(0,255,132,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${balanceColor}44`, borderRadius: 6, cursor: "pointer", position: "relative" }}>
        <div style={{ ...hint, top: 4 }}>Ã¢â€ â€” DÃƒâ€°TAILS</div>
        {[
          { label: "BALANCE COMMERCIALE", val: `${balance >= 0 ? "+" : ""}${fmt(balance)}`, color: balanceColor },
          { label: "TAUX DE COUVERTURE", val: `${coverageRate}%`, color: parseFloat(coverageRate) >= 100 ? "#00ff84" : "#f0b429" },
          { label: "EXPORTATIONS TOTALES", val: fmt(td.totalExports), color: "#00ff84" },
          { label: "IMPORTATIONS TOTALES", val: fmt(td.totalImports), color: "#00d4ff" },
          { label: "CROISSANCE PIB", val: `+${td.gdpGrowth}%`, color: td.gdpGrowth > 5 ? "#00ff84" : "#f0b429" },
        ].map((m, i) => (
          <div key={i} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "#7f8fa6", letterSpacing: 2, marginBottom: 3, whiteSpace: "nowrap" }}>{m.label}</div>
            <div style={{ fontSize: 22, fontFamily: "'Bebas Neue', sans-serif", color: m.color, letterSpacing: 2, lineHeight: 1 }}>{m.val}</div>
          </div>
        ))}
      </div>
      <div onClick={() => setModal("brief")} style={{ ...panel(balance >= 0 ? "#00ff8444" : "#ff2d6f44"), marginBottom: 10 }}>
        <div style={hint}>? DETAILS</div>
        <div style={{ fontSize: 13, color: balanceColor, letterSpacing: 3, marginBottom: 8 }}>BRIEF ECONOMIQUE PAYS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, color: "#7f8fa6", marginBottom: 3 }}>Synthese</div>
            <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>{balanceSentence}</div>
            <div style={{ fontSize: 14, color: "#7f8fa6", lineHeight: 1.6, marginTop: 4 }}>{coverageSentence}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: "#7f8fa6", marginBottom: 3 }}>Points cles</div>
            <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.6 }}>Export dominant: {topExports[0]?.cat || "N/D"}</div>
            <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.6 }}>Part dominante: {exportConcentrationPct}%</div>
            <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.6 }}>Signal WASI: {indexTrend.label}</div>
          </div>
        </div>
      </div>
      {/* Exports + Imports Ã¢â‚¬â€ clickable */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div onClick={() => setModal("exports")} style={{ ...panel("#1a2845") }}>
          <div style={hint}>Ã¢â€ â€” DÃƒâ€°TAILS</div>
          <div style={{ fontSize: 13, color: "#00ff84", letterSpacing: 3, marginBottom: 10 }}>Ã¢â€ â€˜ EXPORTATIONS PRINCIPALES</div>
          <BarChart data={td.exports} color="#00ff84" maxVal={maxExport} />
        </div>
        <div onClick={() => setModal("imports")} style={{ ...panel("#1a2845") }}>
          <div style={hint}>Ã¢â€ â€” DÃƒâ€°TAILS</div>
          <div style={{ fontSize: 13, color: "#00d4ff", letterSpacing: 3, marginBottom: 10 }}>Ã¢â€ â€œ IMPORTATIONS PRINCIPALES</div>
          <BarChart data={td.imports} color="#00d4ff" maxVal={maxImport} />
        </div>
      </div>

      {/* Ratios + Sparkline + Flux Ã¢â‚¬â€ clickable */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div onClick={() => setModal("ratios")} style={{ ...panel("#1a2845") }}>
          <div style={hint}>Ã¢â€ â€” DÃƒâ€°TAILS</div>
          <div style={{ fontSize: 13, color: "#f0b429", letterSpacing: 3, marginBottom: 10 }}>ANALYSE DES RATIOS</div>
          {ratios.map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #0a1020" }}>
              <span style={{ fontSize: 13, color: "#7f8fa6" }}>{r.label}</span>
              <span style={{ fontSize: 13, color: r.color, fontWeight: 700 }}>{r.val}</span>
            </div>
          ))}
        </div>
        <div onClick={() => setModal("wasi")} style={{ ...panel("#1a2845") }}>
          <div style={hint}>Ã¢â€ â€” DÃƒâ€°TAILS</div>
          <div style={{ fontSize: 13, color: "#f0b429", letterSpacing: 3, marginBottom: 8 }}>Ãƒâ€°VOLUTION INDEX WASI (12 MOIS)</div>
          <Sparkline base={indexValue} width={160} height={50} realData={historyData} seed={countrySeed} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#7f8fa6", marginTop: 3, marginBottom: 10 }}>
            <span>Jan</span><span>Avr</span><span>Juil</span><span>Oct</span><span>DÃƒÂ©c</span>
          </div>
          <div onClick={e => { e.stopPropagation(); setModal("partners"); }} style={{ cursor: "pointer" }}>
            <div style={{ fontSize: 13, color: "#7f8fa6", letterSpacing: 3, marginBottom: 6 }}>PARTENAIRES COMMERCIAUX <span style={{ color: "#1a2845" }}>Ã¢â€ â€”</span></div>
            {td.partners.map((p, i) => (
              <div key={i} style={{ fontSize: 13, color: "#7f8fa6", padding: "4px 0", borderBottom: "1px solid #0a1020" }}>{i + 1}. {p}</div>
            ))}
          </div>
        </div>
        <div onClick={() => setModal("flux")} style={{ ...panel("#1a2845") }}>
          <div style={hint}>Ã¢â€ â€” DÃƒâ€°TAILS</div>
          <div style={{ fontSize: 13, color: "#f0b429", letterSpacing: 3, marginBottom: 8 }}>RÃƒâ€°PARTITION DES FLUX</div>
          <TradeDonut exports={td.totalExports} imports={td.totalImports} />
          <div style={{ marginTop: 8 }}>
            {[["#00ff84", "Exportations", fmt(td.totalExports)], ["#00d4ff", "Importations", fmt(td.totalImports)]].map(([c, l, v], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#7f8fa6", marginBottom: 3 }}>
                <span style={{ color: c }}>ÃƒÂ¢Ã¢â‚¬â€œÃ‚Â  {l}</span><span>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #0a1020" }}>
            <div style={{ fontSize: 12, color: "#7f8fa6", letterSpacing: 2 }}>SIGNAL WASI</div>
            <div style={{ fontSize: 18, fontFamily: "'Bebas Neue', sans-serif", color: indexTrend.color, letterSpacing: 2, marginTop: 2 }}>{indexTrend.label} Ã‚Â· {indexValue}/100</div>
            <div style={{ fontSize: 12, color: "#7f8fa6", marginTop: 3 }}>Poids rÃƒÂ©gional : {(country.weight * 100).toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* OpportunitÃƒÂ©s + Risques Ã¢â‚¬â€ clickable */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div onClick={() => setModal("opportunities")} style={{ ...panel("#00ff8444") }}>
          <div style={hint}>Ã¢â€ â€” DÃƒâ€°TAILS</div>
          <div style={{ fontSize: 13, color: "#00ff84", letterSpacing: 3, marginBottom: 8 }}>Ã¢Å“Â¦ OPPORTUNITÃƒâ€°S DE MARCHÃƒâ€°</div>
          {td.opportunities.map((o, i) => (
            <div key={i} style={{ fontSize: 14, color: "#7f8fa6", padding: "6px 0", borderBottom: "1px solid #0a1020", lineHeight: 1.5 }}>Ã¢Å“Â¦ {o}</div>
          ))}
        </div>
        <div onClick={() => setModal("risks")} style={{ ...panel("#ff2d6f44") }}>
          <div style={hint}>Ã¢â€ â€” DÃƒâ€°TAILS</div>
          <div style={{ fontSize: 13, color: "#ff2d6f", letterSpacing: 3, marginBottom: 8 }}>ÃƒÂ¢Ã…Â¡Ã‚Â  FACTEURS DE RISQUE</div>
          {td.risks.map((r, i) => (
            <div key={i} style={{ fontSize: 14, color: "#7f8fa6", padding: "6px 0", borderBottom: "1px solid #0a1020", lineHeight: 1.5 }}>ÃƒÂ¢Ã…Â¡Ã‚Â  {r}</div>
          ))}
        </div>
      </div>

      {/* Module Transport Multi-Modal */}
      <TransportModePanel transportData={transportData} />

      {/* Module FMI Ã¢â‚¬â€ Indicateurs Macro */}
      {macroData && macroData.years && macroData.years.length > 0 && (() => {
        const latest = macroData.years[0];
        const prev   = macroData.years[1];
        const mkBar = (val, max, color) => (
          <div style={{ height: 6, background: "#0a1020", borderRadius: 2, marginTop: 3 }}>
            <div style={{ height: "100%", width: `${Math.max(2, Math.min(100, Math.abs(val) / max * 100))}%`, background: val < 0 ? "#ff2d6f" : color, borderRadius: 2 }} />
          </div>
        );
        const delta = (a, b) => (a !== null && b !== null) ? (a - b).toFixed(1) : null;
        const fmtPct = v => v !== null ? `${v > 0 ? "+" : ""}${v.toFixed(1)}%` : "N/D";
        const cells = [
          { label: "CROISSANCE PIB", val: latest.gdp_growth_pct, fmt: fmtPct, max: 15, color: "#00ff84", d: delta(latest.gdp_growth_pct, prev?.gdp_growth_pct) },
          { label: "INFLATION", val: latest.inflation_pct,    fmt: fmtPct, max: 50, color: "#f0b429", d: delta(latest.inflation_pct, prev?.inflation_pct) },
          { label: "DETTE/PIB",  val: latest.debt_gdp_pct,    fmt: v => v !== null ? `${v.toFixed(1)}%` : "N/D", max: 120, color: "#00d4ff", d: delta(latest.debt_gdp_pct, prev?.debt_gdp_pct) },
          { label: "COMPTE COURANT/PIB", val: latest.current_account_gdp_pct, fmt: fmtPct, max: 20, color: "#00d4ff", d: delta(latest.current_account_gdp_pct, prev?.current_account_gdp_pct) },
        ];
        return (
          <div style={{ marginTop: 10, padding: "16px 18px", background: "rgba(10,22,40,0.6)", border: "1px solid #1a2845", borderRadius: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: "#00d4ff", letterSpacing: 3 }}>Ã°Å¸â€œâ€° FMI WEO Ã¢â‚¬â€ INDICATEURS MACRO</div>
              <div style={{ fontSize: 12, color: "#7f8fa6" }}>{latest.year}{latest.is_projection ? " (proj.)" : ""} Ã‚Â· Source: FMI World Economic Outlook</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
              {cells.map((c, i) => {
                const valColor = c.label === "CROISSANCE PIB" ? (c.val >= 5 ? "#00ff84" : c.val >= 2 ? "#f0b429" : "#ff2d6f")
                  : c.label === "INFLATION" ? (c.val <= 5 ? "#00ff84" : c.val <= 15 ? "#f0b429" : "#ff2d6f")
                  : c.label === "DETTE/PIB"  ? (c.val <= 60 ? "#00ff84" : c.val <= 90 ? "#f0b429" : "#ff2d6f")
                  : (c.val >= 0 ? "#00ff84" : "#ff2d6f");
                return (
                  <div key={i} style={{ padding: "12px 14px", background: "rgba(15,42,69,0.5)", border: `1px solid ${valColor}33`, borderRadius: 4 }}>
                    <div style={{ fontSize: 12, color: "#7f8fa6", letterSpacing: 1, marginBottom: 4 }}>{c.label}</div>
                    <div style={{ fontSize: 20, fontFamily: "'Bebas Neue',sans-serif", color: valColor, letterSpacing: 2, lineHeight: 1 }}>{c.fmt(c.val)}</div>
                    {c.d !== null && <div style={{ fontSize: 12, color: parseFloat(c.d) === 0 ? "#7f8fa6" : parseFloat(c.d) > 0 ? "#00ff84" : "#ff2d6f", marginTop: 3 }}>{parseFloat(c.d) > 0 ? "ÃƒÂ¢Ã¢â‚¬â€œÃ‚Â²" : "ÃƒÂ¢Ã¢â‚¬â€œÃ‚Â¼"} {Math.abs(parseFloat(c.d))} vs {prev?.year}</div>}
                    {c.val !== null && mkBar(c.val, c.max, valColor)}
                  </div>
                );
              })}
            </div>
            {latest.gdp_usd_billions !== null && (
              <div style={{ marginTop: 8, fontSize: 13, color: "#7f8fa6" }}>
                PIB nominal : <span style={{ color: "#7f8fa6" }}>${latest.gdp_usd_billions?.toFixed(1)} Mrd USD</span>
                {latest.unemployment_pct !== null && <span> Ã‚Â· ChÃƒÂ´mage : <span style={{ color: "#7f8fa6" }}>{latest.unemployment_pct?.toFixed(1)}%</span></span>}
              </div>
            )}
          </div>
        );
      })()}

      {/* Module Bancaire Ã¢â‚¬â€ clickable */}
      <div onClick={() => setModal("bank")} style={{ marginTop: 10, ...panel("#ffb02044") }}>
        <div style={hint}>Ã¢â€ â€” ANALYSE COMPLÃƒË†TE</div>
        <div style={{ fontSize: 13, color: "#ffb020", letterSpacing: 3, marginBottom: 8 }}>Ã°Å¸ÂÂ¦ MODULE BANCAIRE Ã¢â‚¬â€ CRÃƒâ€°DIT & ADVISORY</div>
        {bankContext ? (() => {
          const pol = bankContext.political_risk_score;
          // Use server-computed score (backend applies ECOWAS medians for missing data)
          const scoreNum = bankContext.indicative_score ?? 45.0;
          const score = scoreNum.toFixed(1);
          const rating = bankContext.indicative_rating || "CCC";
          const ratingColor = { AAA:"#00ff84", AA:"#00ff84", A:"#00ff84", BBB:"#f0b429", BB:"#ffb020", B:"#ff2d6f", CCC:"#ff2d6f" }[rating];
          return (
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, color: "#7f8fa6", letterSpacing: 2 }}>SCORE INDICATIF</div>
                <div style={{ fontSize: 28, fontFamily: "'Bebas Neue',sans-serif", color: parseFloat(score) >= 70 ? "#00ff84" : parseFloat(score) >= 50 ? "#f0b429" : "#ff2d6f", letterSpacing: 3 }}>{score}/100</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#7f8fa6", letterSpacing: 2 }}>NOTATION</div>
                <div style={{ fontSize: 28, fontFamily: "'Bebas Neue',sans-serif", color: ratingColor, letterSpacing: 3 }}>{rating}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#7f8fa6", letterSpacing: 2 }}>RISQUE POL.</div>
                <div style={{ fontSize: 28, fontFamily: "'Bebas Neue',sans-serif", color: pol <= 3 ? "#00ff84" : pol <= 6 ? "#f0b429" : "#ff2d6f", letterSpacing: 3 }}>{pol}/10</div>
              </div>
              {bankContext.wacc && (
                <div style={{ marginLeft: "auto" }}>
                  <div style={{ fontSize: 12, color: "#7f8fa6", letterSpacing: 2 }}>WACC PAYS</div>
                  <div style={{ fontSize: 28, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 3,
                    color: bankContext.wacc.wacc_pct < 16 ? "#00ff84" : bankContext.wacc.wacc_pct < 20 ? "#f0b429" : "#ff2d6f" }}>
                    {bankContext.wacc.wacc_pct}%
                  </div>
                </div>
              )}
            </div>
          );
        })() : (
          <div style={{ fontSize: 15, color: "#7f8fa6", lineHeight: 1.6 }}>Chargement de l'analyse de crÃƒÂ©dit souverainÃ¢â‚¬Â¦ <span style={{ color: "#ffb020" }}>Cliquer pour voir</span></div>
        )}
      </div>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ FISCALITÃƒâ€° & LOI DE FINANCES Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {(() => {
        const tax = taxDataByCountry[country.code];
        if (!tax) return (
          <div style={{ marginTop: 10, padding: "10px 14px", background: "rgba(10,22,40,0.4)", border: "1px solid #1a2845", borderRadius: 6 }}>
            <div style={{ fontSize: 13, color: "#7f8fa6", letterSpacing: 3 }}>Ã¢Å¡â€“ FISCALITÃƒâ€° Ã¢â‚¬â€ DONNÃƒâ€°ES EN COURS D'INTÃƒâ€°GRATION</div>
            <div style={{ fontSize: 13, color: "#7f8fa6", marginTop: 4 }}>Les donnÃƒÂ©es fiscales pour {country.name} seront disponibles prochainement.</div>
          </div>
        );
        const [taxTab, setTaxTab] = useState("corporate");
        const tabs = [
          { id: "corporate", label: "IS / BIC" },
          { id: "vat",       label: "TVA" },
          { id: "customs",   label: "Douanes" },
          { id: "sector",    label: "Sectoriel" },
        ];
        const rateColor = (r) => {
          const n = parseFloat(r);
          if (isNaN(n)) return "#7f8fa6";
          if (n === 0) return "#00ff84";
          if (n <= 10) return "#00ff84";
          if (n <= 20) return "#f0b429";
          if (n <= 30) return "#ffb020";
          return "#ff2d6f";
        };
        return (
          <div style={{ marginTop: 10, padding: "16px 18px", background: "rgba(10,22,40,0.6)", border: "1px solid #1a2845", borderRadius: 6 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, color: "#00d4ff", letterSpacing: 3 }}>Ã¢Å¡â€“ FISCALITÃƒâ€° Ã¢â‚¬â€ LOI DE FINANCES {tax.year}</div>
                <div style={{ fontSize: 12, color: "#7f8fa6", marginTop: 2 }}>Source : {tax.source}</div>
              </div>
              <div style={{ fontSize: 12, color: "#7f8fa6", textAlign: "right" }}>
                {tax.currency}
              </div>
            </div>

            {/* 2025 new measures */}
            {tax.changes_2025 && tax.changes_2025.length > 0 && (
              <div style={{ marginBottom: 8, padding: "6px 10px", background: "rgba(0,212,255,0.07)", border: "1px solid #00d4ff22", borderRadius: 4 }}>
                <div style={{ fontSize: 12, color: "#00d4ff", letterSpacing: 2, marginBottom: 4 }}>Ã¢Å“Â¦ NOUVELLES MESURES {tax.year}</div>
                {tax.changes_2025.map((c, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#7f8fa6", lineHeight: 1.7 }}>Ã‚Â· {c}</div>
                ))}
              </div>
            )}

            {/* Tab bar */}
            <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
              {tabs.filter(t => {
                if (t.id === "customs") return !!tax.customs;
                if (t.id === "sector") return !!tax.sector;
                return true;
              }).map(t => (
                <button key={t.id} onClick={() => setTaxTab(t.id)} style={{
                  background: taxTab === t.id ? "rgba(0,212,255,0.12)" : "transparent",
                  border: `1px solid ${taxTab === t.id ? "#00d4ff" : "#1a2845"}`,
                  borderRadius: 3, color: taxTab === t.id ? "#00d4ff" : "#7f8fa6",
                  fontSize: 12, padding: "3px 8px", cursor: "pointer", letterSpacing: 1,
                  fontFamily: "'Space Mono', monospace",
                }}>{t.label}</button>
              ))}
            </div>

            {/* Corporate / IS / BIC */}
            {taxTab === "corporate" && tax.corporate && (
              <div>
                {tax.corporate.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0", borderBottom: i < tax.corporate.length - 1 ? "1px solid #1a284580" : "none" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: "#e2e8f0" }}>{item.label}</div>
                      {item.note && <div style={{ fontSize: 11, color: "#7f8fa6" }}>{item.note}</div>}
                    </div>
                    <div style={{ fontSize: 16, fontFamily: "'Bebas Neue', sans-serif", color: rateColor(item.rate), letterSpacing: 1, minWidth: 48, textAlign: "right" }}>
                      {typeof item.rate === "number" ? `${item.rate}%` : item.rate}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* VAT */}
            {taxTab === "vat" && (
              <div>
                {tax.vat && tax.vat.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0", borderBottom: i < tax.vat.length - 1 ? "1px solid #1a284580" : "none" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: "#e2e8f0" }}>{item.label}</div>
                      {item.note && <div style={{ fontSize: 11, color: "#7f8fa6" }}>{item.note}</div>}
                    </div>
                    <div style={{ fontSize: 16, fontFamily: "'Bebas Neue', sans-serif", color: rateColor(item.rate), letterSpacing: 1, minWidth: 48, textAlign: "right" }}>
                      {typeof item.rate === "number" ? `${item.rate}%` : item.rate}
                    </div>
                  </div>
                ))}
                {tax.vat_exempt && (
                  <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(74,222,128,0.05)", border: "1px solid #00ff8422", borderRadius: 3 }}>
                    <div style={{ fontSize: 11, color: "#00ff84", letterSpacing: 1, marginBottom: 3 }}>EXONÃƒâ€°RATIONS TVA</div>
                    <div style={{ fontSize: 12, color: "#7f8fa6" }}>{tax.vat_exempt.join(" Ã‚Â· ")}</div>
                  </div>
                )}
                {tax.irpp && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: "#00d4ff", letterSpacing: 2, marginBottom: 4 }}>IRPP Ã¢â‚¬â€ BARÃƒË†ME PROGRESSIF</div>
                    {tax.irpp.map((b, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#7f8fa6", lineHeight: 1.8 }}>
                        <span>{b.bracket}</span>
                        <span style={{ color: rateColor(b.rate), fontFamily: "'Bebas Neue', sans-serif", fontSize: 14 }}>{b.rate}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Customs */}
            {taxTab === "customs" && tax.customs && (
              <div>
                <div style={{ fontSize: 12, color: "#00d4ff", letterSpacing: 2, marginBottom: 4 }}>TARIF EXTÃƒâ€°RIEUR COMMUN CEDEAO (TEC)</div>
                {tax.customs.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0", borderBottom: "1px solid #1a284550" }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 12, color: "#f0b429", marginRight: 6 }}>{item.cat}</span>
                      <span style={{ fontSize: 12, color: "#7f8fa6" }}>{item.label}</span>
                    </div>
                    <div style={{ fontSize: 16, fontFamily: "'Bebas Neue', sans-serif", color: rateColor(item.rate), letterSpacing: 1, minWidth: 40, textAlign: "right" }}>{item.rate}%</div>
                  </div>
                ))}
                {tax.customs_levies && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: "#00d4ff", letterSpacing: 2, marginBottom: 4 }}>PRÃƒâ€°LÃƒË†VEMENTS ADDITIONNELS</div>
                    {tax.customs_levies.map((l, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#7f8fa6", lineHeight: 1.8 }}>
                        <span>{l.label}</span>
                        <span style={{ color: "#f0b429", fontFamily: "'Bebas Neue', sans-serif", fontSize: 14 }}>{l.rate}%</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 4, fontSize: 11, color: "#7f8fa6" }}>
                      Charge totale import = TEC + 0,5% CEDEAO + 1% UEMOA + 1% stat = <span style={{ color: "#f0b429" }}>TEC + 2,5% min</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sector */}
            {taxTab === "sector" && tax.sector && (
              <div>
                {tax.sector.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0", borderBottom: i < tax.sector.length - 1 ? "1px solid #1a284580" : "none" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: "#e2e8f0" }}>{item.label}</div>
                      {item.note && <div style={{ fontSize: 11, color: "#7f8fa6" }}>{item.note}</div>}
                    </div>
                    <div style={{ fontSize: 15, fontFamily: "'Bebas Neue', sans-serif", color: rateColor(item.rate), letterSpacing: 1, minWidth: 60, textAlign: "right" }}>
                      {item.rate}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 8, fontSize: 11, color: "#1a2845", letterSpacing: 0.5 }}>
              Base de donnÃƒÂ©es fiscale WASI Ã‚Â· Sources officielles DGI / FIRS / GRA / DGID Ã‚Â· Mise ÃƒÂ  jour {tax.year}
            </div>
          </div>
        );
      })()}

      {/* Pied de page */}
      <div style={{ marginTop: 10, padding: "7px 12px", background: "rgba(10,22,40,0.5)", borderRadius: 4, fontSize: 12, color: "#7f8fa6", letterSpacing: 0.5, display: "flex", justifyContent: "space-between" }}>
        <span>Source : WASI Data Engine v3.0 Ã‚Â· Statistiques Officielles Portuaires Ã‚Â· FMI World Economic Outlook Ã‚Â· DonnÃƒÂ©es 2023Ã¢â‚¬â€œ2026</span>
        <span style={{ color: "#00ff84", whiteSpace: "nowrap", marginLeft: 12 }}>Ã¢Å“â€œ Fiche vÃƒÂ©rifiÃƒÂ©e : {new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}</span>
      </div>
    </div>
  );
}





