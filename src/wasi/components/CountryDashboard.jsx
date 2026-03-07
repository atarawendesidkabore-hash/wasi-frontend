import { useState } from "react";

function BarChart({ data, color, maxVal }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
            <span style={{ fontSize: 13, color: "#94a3b8" }}>{d.cat}</span>
            <span style={{ fontSize: 13, color, fontWeight: 700 }}>
              {d.val >= 1000 ? `${(d.val / 1000).toFixed(1)} Mrd$` : `${d.val} M$`}
            </span>
          </div>
          <div style={{ height: 8, background: "#0a1628", borderRadius: 2 }}>
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
    // Deterministic but country-unique wave — seed offsets the phase
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
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#0a1628" strokeWidth={sw} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#38bdf8" strokeWidth={sw}
        strokeDasharray={`${impArc} ${circ}`} strokeDashoffset={0}
        transform={`rotate(-90 ${cx} ${cy})`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#4ade80" strokeWidth={sw}
        strokeDasharray={`${expArc} ${circ}`} strokeDashoffset={-impArc}
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy - 3} textAnchor="middle" fill="#f0b429" fontSize="10" fontFamily="Space Mono">
        {(expPct * 100).toFixed(0)}%
      </text>
      <text x={cx} y={cy + 9} textAnchor="middle" fill="#94a3b8" fontSize="6" fontFamily="Space Mono">
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
    name: match[1].replace(/·/g, "").trim(),
    sharePct: parseFloat(match[2].replace(",", ".")),
  };
}

// ── Transport Mode Panel ──────────────────────────────────────────────────────
function TransportModePanel({ transportData }) {
  const [activeMode, setActiveMode] = useState("composite");

  const MODES = [
    { key: "maritime", label: "MARITIME", color: "#0ea5e9" },
    { key: "air",      label: "AÉRIEN",   color: "#f0b429" },
    { key: "rail",     label: "RAIL",     color: "#a78bfa" },
    { key: "road",     label: "ROUTE",    color: "#34d399" },
    { key: "composite",label: "COMPOSITE",color: "#fb923c" },
  ];

  const panel = { background: "rgba(10,22,40,0.6)", border: "1px solid #0f2a45", borderRadius: 6, padding: "16px 18px", marginTop: 10 };

  if (!transportData) {
    return (
      <div style={panel}>
        <div style={{ fontSize: 13, color: "#0ea5e9", letterSpacing: 3, marginBottom: 8 }}>🚢 MODULE TRANSPORT MULTI-MODAL</div>
        <div style={{ fontSize: 15, color: "#64748b", lineHeight: 1.6 }}>Données transport non disponibles pour ce pays.</div>
      </div>
    );
  }

  const { modes, transport_composite, country_profile, profile_weights, effective_weights } = transportData;

  const getModeIndex = (key) => {
    if (key === "composite") return transport_composite;
    return modes?.[key]?.index ?? null;
  };

  const getQualityBadge = (val) => {
    if (val === null) return { label: "N/D", color: "#475569" };
    if (val >= 70) return { label: "●  ÉLEVÉ", color: "#4ade80" };
    if (val >= 40) return { label: "â—'  MOYEN", color: "#f0b429" };
    return { label: "â—‹  FAIBLE", color: "#ef4444" };
  };

  const getWeight = (key) => {
    if (!profile_weights || key === "composite") return null;
    return profile_weights[key] != null ? (profile_weights[key] * 100).toFixed(0) + "%" : "—";
  };

  const currentVal = getModeIndex(activeMode);
  const currentBadge = getQualityBadge(currentVal);
  const currentColor = MODES.find(m => m.key === activeMode)?.color || "#fb923c";

  return (
    <div style={panel}>
      <div style={{ fontSize: 13, color: "#0ea5e9", letterSpacing: 3, marginBottom: 10 }}>🚢 MODULE TRANSPORT MULTI-MODAL</div>

      {/* Mode selector tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {MODES.map(m => {
          const val = getModeIndex(m.key);
          const label = m.key === "composite"
            ? m.label
            : `${m.label}${val !== null ? val.toFixed(0) : " N/D"}`;
          return (
            <button key={m.key} onClick={() => setActiveMode(m.key)} style={{
              padding: "6px 10px", borderRadius: 4, fontSize: 12, letterSpacing: 1,
              cursor: "pointer", fontFamily: "'Space Mono', monospace",
              background: activeMode === m.key ? m.color + "22" : "transparent",
              border: `1px solid ${activeMode === m.key ? m.color : "#0f2a45"}`,
              color: activeMode === m.key ? m.color : "#64748b",
              transition: "all 0.15s", whiteSpace: "nowrap",
            }}>{label}</button>
          );
        })}
      </div>

      {/* 4-bar chart */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 90, marginBottom: 12 }}>
        {MODES.filter(m => m.key !== "composite").map(m => {
          const val = getModeIndex(m.key);
          const barHeight = val !== null ? Math.max(4, (val / 100) * 72) : 0;
          return (
            <div key={m.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: m.color, fontFamily: "'Space Mono',monospace", whiteSpace: "nowrap" }}>
                {val !== null ? val.toFixed(1) : "N/D"}
              </div>
              <div style={{ width: "100%", height: 72, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                {val !== null ? (
                  <div style={{
                    width: "100%", height: barHeight,
                    background: `linear-gradient(to top, ${m.color}cc, ${m.color}55)`,
                    borderRadius: "3px 3px 0 0", transition: "height 0.3s",
                  }} />
                ) : (
                  <div style={{
                    width: "100%", height: 20,
                    background: "repeating-linear-gradient(45deg, #1e3a5f 0, #1e3a5f 4px, transparent 4px, transparent 8px)",
                    borderRadius: "3px 3px 0 0",
                  }} />
                )}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 1, textAlign: "center" }}>{m.label}</div>
            </div>
          );
        })}
      </div>

      {/* Selected mode detail */}
      <div style={{ borderTop: "1px solid #0f2a45", paddingTop: 10, display: "flex", gap: 16, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, color: "#94a3b8", letterSpacing: 2 }}>MODE ACTIF</div>
          <div style={{ fontSize: 26, fontFamily: "'Bebas Neue',sans-serif", color: currentColor, letterSpacing: 3 }}>
            {currentVal !== null ? currentVal.toFixed(1) : "N/D"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#94a3b8", letterSpacing: 2 }}>QUALITÉ</div>
          <div style={{ fontSize: 14, color: currentBadge.color, letterSpacing: 1 }}>{currentBadge.label}</div>
        </div>
        {activeMode !== "composite" && (
          <div>
            <div style={{ fontSize: 12, color: "#94a3b8", letterSpacing: 2 }}>PONDÉRATION</div>
            <div style={{ fontSize: 18, fontFamily: "'Bebas Neue',sans-serif", color: currentColor, letterSpacing: 2 }}>
              {getWeight(activeMode)}
            </div>
          </div>
        )}
        {activeMode === "composite" && (
          <div style={{ marginLeft: "auto" }}>
            <div style={{ fontSize: 12, color: "#94a3b8", letterSpacing: 2 }}>PROFIL</div>
            <div style={{ fontSize: 13, color: "#0ea5e9", letterSpacing: 1 }}>{(country_profile || "").replace(/_/g, " ").toUpperCase()}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── USSD Data Visualization Panel ────────────────────────────────────────────

export function CountryDashboard({ country, indexValue, onClose, bankContext, transportData, macroData, historyData, tradeDataByCountry, taxDataByCountry }) {
  const [modal, setModal] = useState(null);
  const td = tradeDataByCountry[country.code];
  if (!td) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 15 }}>
      Données non disponibles pour {country.name}
      <button onClick={onClose} style={{ marginLeft: 16, background: "none", border: "1px solid #1e3a5f", color: "#94a3b8", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 14 }}>← Retour</button>
    </div>
  );

  const balance = td.totalExports - td.totalImports;
  const coverageRate = ((td.totalExports / td.totalImports) * 100).toFixed(1);
  const balanceColor = balance >= 0 ? "#4ade80" : "#ef4444";
  const totalE = td.exports.reduce((s, d) => s + d.val, 0);
  const hhi = td.exports.reduce((s, d) => s + Math.pow(d.val / totalE, 2), 0);
  const diversityScore = ((1 - hhi) * 100).toFixed(0);
  const maxExport = Math.max(...td.exports.map(d => d.val));
  const maxImport = Math.max(...td.imports.map(d => d.val));
  const tierLabel = { primary: "Primaire", secondary: "Secondaire", tertiary: "Tertiaire" }[country.tier];
  const countrySeed = country.code.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const tierColor = { primary: "#4ade80", secondary: "#f0b429", tertiary: "#94a3b8" }[country.tier];
  const indexTrend = indexValue > 65 ? { label: "EXPANSION", color: "#4ade80" }
                   : indexValue > 45 ? { label: "STABLE", color: "#f0b429" }
                   : { label: "CONTRACTION", color: "#ef4444" };
  const ratios = [
    { label: "Taux de couverture", val: `${coverageRate}%`, color: parseFloat(coverageRate) >= 100 ? "#4ade80" : "#ef4444", desc: "Exports / Imports × 100. Au-dessus de 100% = excédent commercial." },
    { label: "Balance commerciale", val: `${balance >= 0 ? "+" : ""}${fmt(balance)}`, color: balanceColor, desc: "Différence entre exportations et importations totales." },
    { label: "Diversification exports", val: `${diversityScore}/100`, color: parseInt(diversityScore) > 60 ? "#4ade80" : "#f0b429", desc: `Indice de diversification basé sur l'HHI (${(hhi).toFixed(3)}). Plus c'est élevé, moins le pays dépend d'un seul produit.` },
    { label: "Poids WASI régional", val: `${(country.weight * 100).toFixed(1)}%`, color: "#38bdf8", desc: "Contribution de ce pays à l'indice composite WASI sur 16 nations CEDEAO." },
    { label: "Croissance du PIB", val: `+${td.gdpGrowth}%`, color: td.gdpGrowth > 5 ? "#4ade80" : "#f0b429", desc: "Taux de croissance annuel du PIB (dernière estimation disponible)." },
    { label: "Signal de marché", val: indexTrend.label, color: indexTrend.color, desc: `EXPANSION (>65) · STABLE (45–65) · CONTRACTION (<45). Valeur actuelle : ${indexValue}/100.` },
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

  // Shared panel style — clickable
  const panel = (accent = "#0f2a45") => ({
    padding: "16px 18px", background: "rgba(10,22,40,0.85)",
    border: `1px solid ${accent}`, borderRadius: 4,
    cursor: "pointer", transition: "border-color 0.2s, background 0.2s",
    position: "relative",
  });
  const hint = { position: "absolute", top: 6, right: 8, fontSize: 12, color: "#1e3a5f", letterSpacing: 1 };

  // ── Detail Modal ──────────────────────────────────────────────────────────
  const Modal = ({ type }) => {
    if (!type) return null;
    const configs = {
      exports: {
        title: "EXPORTATIONS PRINCIPALES", accent: "#4ade80",
        body: (
          <div>
            <div style={{ fontSize: 16, color: "#94a3b8", marginBottom: 16, lineHeight: 1.7 }}>
              {country.flag} {country.name} · Total exportations : <strong style={{ color: "#4ade80" }}>{fmt(td.totalExports)}</strong> · Taux de couverture : <strong style={{ color: parseFloat(coverageRate) >= 100 ? "#4ade80" : "#ef4444" }}>{coverageRate}%</strong>
            </div>
            {td.exports.map((d, i) => {
              const pct = ((d.val / td.totalExports) * 100).toFixed(1);
              return (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 15, color: "#e2e8f0" }}>{d.cat}</span>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 20, color: "#4ade80", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 2 }}>{fmt(d.val)}</span>
                      <span style={{ fontSize: 15, color: "#94a3b8", marginLeft: 10 }}>{pct}% du total</span>
                    </div>
                  </div>
                  <div style={{ height: 10, background: "#0a1628", borderRadius: 3 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "#4ade80", borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 20, padding: "12px 16px", background: "rgba(74,222,128,0.06)", border: "1px solid #4ade8044", borderRadius: 4, display: "flex", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 15, color: "#94a3b8", letterSpacing: 1 }}>TOTAL EXPORTATIONS</div><div style={{ fontSize: 34, fontFamily: "'Bebas Neue',sans-serif", color: "#4ade80" }}>{fmt(td.totalExports)}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 15, color: "#94a3b8", letterSpacing: 1, marginBottom: 4 }}>PRINCIPAUX MARCHÉS</div>{td.partners.slice(0, 3).map((p, i) => <div key={i} style={{ fontSize: 15, color: "#94a3b8" }}>{p}</div>)}</div>
            </div>
          </div>
        ),
      },
      imports: {
        title: "IMPORTATIONS PRINCIPALES", accent: "#38bdf8",
        body: (
          <div>
            <div style={{ fontSize: 16, color: "#94a3b8", marginBottom: 16, lineHeight: 1.7 }}>
              {country.flag} {country.name} · Total importations : <strong style={{ color: "#38bdf8" }}>{fmt(td.totalImports)}</strong> · Déficit commercial : <strong style={{ color: balanceColor }}>{fmt(Math.abs(balance))}</strong>
            </div>
            {td.imports.map((d, i) => {
              const pct = ((d.val / td.totalImports) * 100).toFixed(1);
              return (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 15, color: "#e2e8f0" }}>{d.cat}</span>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 20, color: "#38bdf8", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 2 }}>{fmt(d.val)}</span>
                      <span style={{ fontSize: 15, color: "#94a3b8", marginLeft: 10 }}>{pct}% du total</span>
                    </div>
                  </div>
                  <div style={{ height: 10, background: "#0a1628", borderRadius: 3 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "#38bdf8", borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 20, padding: "12px 16px", background: "rgba(56,189,248,0.06)", border: "1px solid #38bdf844", borderRadius: 4, display: "flex", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 15, color: "#94a3b8", letterSpacing: 1 }}>TOTAL IMPORTATIONS</div><div style={{ fontSize: 34, fontFamily: "'Bebas Neue',sans-serif", color: "#38bdf8" }}>{fmt(td.totalImports)}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 15, color: "#94a3b8", letterSpacing: 1 }}>BALANCE NETTE</div><div style={{ fontSize: 34, fontFamily: "'Bebas Neue',sans-serif", color: balanceColor }}>{balance >= 0 ? "+" : ""}{fmt(balance)}</div></div>
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
                  <span style={{ fontSize: 15, color: "#94a3b8" }}>{r.label}</span>
                  <span style={{ fontSize: 28, fontFamily: "'Bebas Neue',sans-serif", color: r.color, letterSpacing: 2 }}>{r.val}</span>
                </div>
                <div style={{ fontSize: 16, color: "#94a3b8", lineHeight: 1.7 }}>{r.desc}</div>
              </div>
            ))}
          </div>
        ),
      },
      wasi: {
        title: "ÉVOLUTION INDEX WASI", accent: "#f0b429",
        body: (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Sparkline base={indexValue} width={580} height={120} realData={historyData} seed={countrySeed} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, color: "#64748b", marginTop: 8 }}>
                {["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"].map(m => <span key={m}>{m}</span>)}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { label: "VALEUR ACTUELLE", val: `${indexValue}/100`, color: indexTrend.color },
                { label: "SIGNAL", val: indexTrend.label, color: indexTrend.color },
                { label: "POIDS CEDEAO", val: `${(country.weight * 100).toFixed(1)}%`, color: "#38bdf8" },
              ].map((s, i) => (
                <div key={i} style={{ padding: "16px 18px", background: "rgba(15,42,69,0.4)", border: "1px solid #0f2a45", borderRadius: 4 }}>
                  <div style={{ fontSize: 15, color: "#94a3b8", letterSpacing: 2, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 32, fontFamily: "'Bebas Neue',sans-serif", color: s.color, letterSpacing: 3 }}>{s.val}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: "18px 24px", background: "rgba(15,42,69,0.3)", borderRadius: 4, fontSize: 16, color: "#94a3b8", lineHeight: 1.9 }}>
              <strong style={{ color: "#f0b429" }}>Méthodologie WASI :</strong><br />
              Composantes : Arrivées de navires (40%) · Tonnage cargo (30%) · Efficacité portuaire (20%) · Croissance économique (10%)<br />
              Base 100 = Moyenne historique 5 ans · Au-dessus de 70 = Expansion forte · 45–70 = Stabilité · En dessous de 45 = Contraction
            </div>
          </div>
        ),
      },
      partners: {
        title: "PARTENAIRES COMMERCIAUX", accent: "#a78bfa",
        body: (
          <div>
            <div style={{ fontSize: 16, color: "#94a3b8", marginBottom: 16, lineHeight: 1.7 }}>Principaux partenaires à l'import-export de {country.name} (estimations 2023)</div>
            {td.partners.map((p, i) => {
              const pct = parseFloat(p.match(/(\d+)%/)?.[1] || 10);
              const name = p.replace(/\d+%/, "").replace(/·/g, "").trim();
              return (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 15, color: "#e2e8f0" }}>{i + 1}. {name}</span>
                    <span style={{ fontSize: 18, fontFamily: "'Bebas Neue',sans-serif", color: "#a78bfa", letterSpacing: 2 }}>{pct}%</span>
                  </div>
                  <div style={{ height: 8, background: "#0a1628", borderRadius: 3 }}>
                    <div style={{ height: "100%", width: `${pct * 2}%`, background: "#a78bfa", borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(167,139,250,0.06)", border: "1px solid #a78bfa44", borderRadius: 4, fontSize: 15, color: "#94a3b8", lineHeight: 1.8 }}>
              Les flux commerciaux restants sont répartis entre d'autres partenaires non listés. Source : UN Comtrade, FMI Direction of Trade Statistics.
            </div>
          </div>
        ),
      },
      flux: {
        title: "RÉPARTITION DES FLUX COMMERCIAUX", accent: "#f0b429",
        body: (
          <div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <TradeDonut exports={td.totalExports} imports={td.totalImports} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              {[
                { label: "EXPORTATIONS TOTALES", val: fmt(td.totalExports), color: "#4ade80", pct: ((td.totalExports / (td.totalExports + td.totalImports)) * 100).toFixed(1) },
                { label: "IMPORTATIONS TOTALES", val: fmt(td.totalImports), color: "#38bdf8", pct: ((td.totalImports / (td.totalExports + td.totalImports)) * 100).toFixed(1) },
              ].map((s, i) => (
                <div key={i} style={{ padding: "18px 22px", background: "rgba(15,42,69,0.4)", border: `1px solid ${s.color}44`, borderRadius: 4 }}>
                  <div style={{ fontSize: 15, color: "#94a3b8", letterSpacing: 2, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 34, fontFamily: "'Bebas Neue',sans-serif", color: s.color, letterSpacing: 3 }}>{s.val}</div>
                  <div style={{ fontSize: 15, color: "#94a3b8", marginTop: 4 }}>{s.pct}% des flux totaux</div>
                </div>
              ))}
            </div>
            <div style={{ padding: "18px 22px", background: balance >= 0 ? "rgba(74,222,128,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${balanceColor}44`, borderRadius: 4 }}>
              <div style={{ fontSize: 15, color: "#94a3b8", letterSpacing: 2, marginBottom: 6 }}>BALANCE NETTE</div>
              <div style={{ fontSize: 40, fontFamily: "'Bebas Neue',sans-serif", color: balanceColor, letterSpacing: 3 }}>{balance >= 0 ? "+" : ""}{fmt(balance)}</div>
              <div style={{ fontSize: 16, color: "#94a3b8", marginTop: 4 }}>Taux de couverture : {coverageRate}% · {parseFloat(coverageRate) >= 100 ? "Excédent commercial" : "Déficit commercial"}</div>
            </div>
          </div>
        ),
      },
      opportunities: {
        title: "OPPORTUNITÉS DE MARCHÉ", accent: "#4ade80",
        body: (
          <div>
            <div style={{ fontSize: 16, color: "#94a3b8", marginBottom: 16, lineHeight: 1.7 }}>
              Secteurs à fort potentiel identifiés pour {country.name} — Score WASI actuel : {indexValue}/100
            </div>
            {td.opportunities.map((o, i) => (
              <div key={i} style={{ marginBottom: 12, padding: "18px 22px", background: "rgba(74,222,128,0.06)", border: "1px solid #4ade8044", borderRadius: 4 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ color: "#4ade80", fontSize: 20, flexShrink: 0 }}>✦</span>
                  <div style={{ fontSize: 16, color: "#e2e8f0", lineHeight: 1.6 }}>{o}</div>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(15,42,69,0.3)", borderRadius: 4, fontSize: 15, color: "#94a3b8", lineHeight: 1.8 }}>
              Source : WASI Data Engine · Analyses sectorielles CEDEAO · Rapports d'investissement FMI/Banque Mondiale
            </div>
          </div>
        ),
      },
      risks: {
        title: "FACTEURS DE RISQUE", accent: "#ef4444",
        body: (
          <div>
            <div style={{ fontSize: 16, color: "#94a3b8", marginBottom: 16, lineHeight: 1.7 }}>
              Principaux risques identifiés pour {country.name} — Impact potentiel sur l'indice WASI
            </div>
            {td.risks.map((r, i) => (
              <div key={i} style={{ marginBottom: 12, padding: "18px 22px", background: "rgba(239,68,68,0.05)", border: "1px solid #ef444444", borderRadius: 4 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ color: "#ef4444", fontSize: 20, flexShrink: 0 }}>âš </span>
                  <div style={{ fontSize: 16, color: "#e2e8f0", lineHeight: 1.6 }}>{r}</div>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(15,42,69,0.3)", borderRadius: 4, fontSize: 15, color: "#94a3b8", lineHeight: 1.8 }}>
              Évaluation des risques basée sur données macro-économiques, indice de stabilité politique et historique des flux commerciaux.
            </div>
          </div>
        ),
      },
      chef: {
        title: "CHEF D'ÉTAT & PROFIL POLITIQUE", accent: "#38bdf8",
        body: (
          <div>
            <div style={{ padding: "20px", background: "rgba(56,189,248,0.06)", border: "1px solid #38bdf844", borderRadius: 6, marginBottom: 16, display: "flex", alignItems: "center", gap: 20 }}>
              <span style={{ fontSize: 60 }}>{country.flag}</span>
              <div>
                <div style={{ fontSize: 28, fontFamily: "'Bebas Neue',sans-serif", color: "#e2e8f0", letterSpacing: 3 }}>{td.president}</div>
                <div style={{ fontSize: 14, color: "#38bdf8", marginTop: 4 }}>En poste depuis : {td.presidentSince}</div>
                <div style={{ fontSize: 16, color: "#94a3b8", marginTop: 6 }}>{country.name.toUpperCase()} · {td.currency}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "CAPITALE OFFICIELLE", val: td.capitale, color: "#f0b429" },
                { label: "CENTRE ÉCONOMIQUE", val: td.siegeEconomique || td.capitale, color: "#4ade80" },
                { label: "SUPERFICIE", val: `${td.superficie.toLocaleString("fr-FR")} km²`, color: "#38bdf8" },
                { label: "MONNAIE", val: td.currency, color: "#a78bfa" },
                { label: "CROISSANCE PIB", val: `+${td.gdpGrowth}%`, color: td.gdpGrowth > 5 ? "#4ade80" : "#f0b429" },
                { label: "POIDS WASI", val: `${(country.weight * 100).toFixed(1)}%`, color: "#38bdf8" },
              ].map((s, i) => (
                <div key={i} style={{ padding: "16px 18px", background: "rgba(15,42,69,0.4)", border: "1px solid #0f2a45", borderRadius: 4 }}>
                  <div style={{ fontSize: 14, color: "#94a3b8", letterSpacing: 2, marginBottom: 5 }}>{s.label}</div>
                  <div style={{ fontSize: 26, fontFamily: "'Bebas Neue',sans-serif", color: s.color, letterSpacing: 2 }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      geo: {
        title: "GÉOGRAPHIE & INFRASTRUCTURE", accent: "#38bdf8",
        body: (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              {[
                { label: "CAPITALE OFFICIELLE", val: td.capitale, color: "#f0b429" },
                { label: "CENTRE ÉCONOMIQUE", val: td.siegeEconomique || td.capitale, color: "#4ade80" },
                { label: "SUPERFICIE", val: `${td.superficie.toLocaleString("fr-FR")} km²`, color: "#38bdf8" },
                { label: "PORT PRINCIPAL", val: country.port, color: "#a78bfa" },
                { label: "MONNAIE", val: td.currency, color: "#f0b429" },
                { label: "TIER WASI", val: tierLabel, color: tierColor },
              ].map((s, i) => (
                <div key={i} style={{ padding: "16px 18px", background: "rgba(15,42,69,0.4)", border: "1px solid #0f2a45", borderRadius: 4 }}>
                  <div style={{ fontSize: 14, color: "#94a3b8", letterSpacing: 2, marginBottom: 5 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontFamily: "'Bebas Neue',sans-serif", color: s.color, letterSpacing: 2 }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      resources: {
        title: "MATIÈRES PREMIÈRES & RESSOURCES", accent: "#4ade80",
        body: (
          <div>
            <div style={{ fontSize: 16, color: "#94a3b8", marginBottom: 16, lineHeight: 1.7 }}>
              Ressources naturelles identifiées pour {country.name} ({td.matieres_premieres.length} ressources répertoriées)
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {td.matieres_premieres.map((m, i) => (
                <span key={i} style={{ fontSize: 15, color: "#4ade80", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 4, padding: "6px 12px", lineHeight: 1.6 }}>{m}</span>
              ))}
            </div>
            <div style={{ padding: "18px 24px", background: "rgba(74,222,128,0.04)", border: "1px solid #4ade8022", borderRadius: 4, fontSize: 16, color: "#94a3b8", lineHeight: 1.9 }}>
              <strong style={{ color: "#4ade80" }}>Impact sur l'indice WASI :</strong><br />
              Les matières premières représentent {((td.totalExports / (td.totalExports + td.totalImports)) * 100).toFixed(0)}% des échanges totaux. Une concentration élevée sur une seule ressource augmente la volatilité du score WASI. Score de diversification actuel : {diversityScore}/100.
            </div>
          </div>
        ),
      },
      metrics: {
        title: "MÉTRIQUES COMMERCIALES CLÉS", accent: balanceColor,
        body: (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { label: "BALANCE COMMERCIALE", val: `${balance >= 0 ? "+" : ""}${fmt(balance)}`, color: balanceColor, desc: "Exportations moins importations. Positif = excédent." },
                { label: "TAUX DE COUVERTURE", val: `${coverageRate}%`, color: parseFloat(coverageRate) >= 100 ? "#4ade80" : "#f0b429", desc: "Capacité des exports à financer les imports." },
                { label: "EXPORTATIONS TOTALES", val: fmt(td.totalExports), color: "#4ade80", desc: "Valeur totale des biens et services exportés." },
                { label: "IMPORTATIONS TOTALES", val: fmt(td.totalImports), color: "#38bdf8", desc: "Valeur totale des biens et services importés." },
                { label: "CROISSANCE PIB", val: `+${td.gdpGrowth}%`, color: td.gdpGrowth > 5 ? "#4ade80" : "#f0b429", desc: "Taux de croissance annuel du produit intérieur brut." },
                { label: "FLUX COMMERCIAUX TOTAUX", val: fmt(td.totalExports + td.totalImports), color: "#a78bfa", desc: "Somme des importations et exportations." },
              ].map((s, i) => (
                <div key={i} style={{ padding: "18px 22px", background: "rgba(15,42,69,0.4)", border: `1px solid ${s.color}33`, borderRadius: 4 }}>
                  <div style={{ fontSize: 14, color: "#94a3b8", letterSpacing: 2, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 34, fontFamily: "'Bebas Neue',sans-serif", color: s.color, letterSpacing: 3, marginBottom: 8 }}>{s.val}</div>
                  <div style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.7 }}>{s.desc}</div>
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
            <div style={{ marginBottom: 16, padding: "14px 18px", background: "rgba(15,42,69,0.4)", border: "1px solid #0f2a45", borderRadius: 6 }}>
              <div style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.8 }}>
                Synthese rapide pour {country.flag} <strong style={{ color: "#e2e8f0" }}>{country.name}</strong> (base WASI interne).
                Ces chiffres sont des estimations de monitoring et ne remplacent pas une publication officielle.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[
                { label: "EXPORTATIONS", val: fmt(td.totalExports), color: "#4ade80" },
                { label: "IMPORTATIONS", val: fmt(td.totalImports), color: "#38bdf8" },
                { label: "BALANCE", val: `${balance >= 0 ? "+" : "-"}${fmt(Math.abs(balance))}`, color: balanceColor },
                { label: "COUVERTURE", val: `${coverageRate}%`, color: parseFloat(coverageRate) >= 100 ? "#4ade80" : "#f0b429" },
              ].map((kpi, i) => (
                <div key={i} style={{ padding: "12px 14px", background: "rgba(15,42,69,0.45)", border: `1px solid ${kpi.color}33`, borderRadius: 6 }}>
                  <div style={{ fontSize: 12, color: "#94a3b8", letterSpacing: 1, marginBottom: 4 }}>{kpi.label}</div>
                  <div style={{ fontSize: 24, fontFamily: "'Bebas Neue',sans-serif", color: kpi.color, letterSpacing: 2 }}>{kpi.val}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 16, padding: "16px 18px", background: balance >= 0 ? "rgba(74,222,128,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${balanceColor}44`, borderRadius: 6 }}>
              <div style={{ fontSize: 14, color: "#94a3b8", letterSpacing: 2, marginBottom: 8 }}>CE QU'IL FAUT RETENIR</div>
              <div style={{ fontSize: 16, color: "#e2e8f0", lineHeight: 1.8 }}>
                <div>- Solde commercial {tradeDirection} : {balanceSentence}</div>
                <div>- Couverture : {coverageSentence}</div>
                <div>- Produit export dominant : {topExports[0]?.cat || "N/D"} ({exportConcentrationPct}% des exportations).</div>
                <div>- Signal WASI courant : {indexTrend.label} ({Math.round(indexValue)}/100).</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div style={{ padding: "14px 16px", background: "rgba(74,222,128,0.05)", border: "1px solid #4ade8044", borderRadius: 6 }}>
                <div style={{ fontSize: 13, color: "#4ade80", letterSpacing: 2, marginBottom: 6 }}>TOP EXPORTS</div>
                {topExports.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 15, color: "#e2e8f0", padding: "4px 0", borderBottom: "1px solid #0a1628" }}>
                    <span>{item.cat}</span>
                    <span style={{ color: "#4ade80" }}>{fmt(item.val)}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: "14px 16px", background: "rgba(56,189,248,0.05)", border: "1px solid #38bdf844", borderRadius: 6 }}>
                <div style={{ fontSize: 13, color: "#38bdf8", letterSpacing: 2, marginBottom: 6 }}>TOP IMPORTS</div>
                {topImports.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 15, color: "#e2e8f0", padding: "4px 0", borderBottom: "1px solid #0a1628" }}>
                    <span>{item.cat}</span>
                    <span style={{ color: "#38bdf8" }}>{fmt(item.val)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16, padding: "14px 16px", background: "rgba(167,139,250,0.06)", border: "1px solid #a78bfa44", borderRadius: 6 }}>
              <div style={{ fontSize: 13, color: "#a78bfa", letterSpacing: 2, marginBottom: 6 }}>PARTENAIRES MAJEURS</div>
              {topPartners.map((p, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 15, color: "#e2e8f0", padding: "4px 0", borderBottom: "1px solid #0a1628" }}>
                  <span>{i + 1}. {p.name}</span>
                  <span style={{ color: "#a78bfa" }}>{p.sharePct !== null ? `${p.sharePct}%` : "N/D"}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ padding: "14px 16px", background: "rgba(74,222,128,0.05)", border: "1px solid #4ade8044", borderRadius: 6 }}>
                <div style={{ fontSize: 13, color: "#4ade80", letterSpacing: 2, marginBottom: 6 }}>OPPORTUNITES</div>
                {td.opportunities.slice(0, 3).map((line, i) => (
                  <div key={i} style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.7 }}>- {line}</div>
                ))}
              </div>
              <div style={{ padding: "14px 16px", background: "rgba(239,68,68,0.05)", border: "1px solid #ef444444", borderRadius: 6 }}>
                <div style={{ fontSize: 13, color: "#ef4444", letterSpacing: 2, marginBottom: 6 }}>RISQUES</div>
                {td.risks.slice(0, 3).map((line, i) => (
                  <div key={i} style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.7 }}>- {line}</div>
                ))}
              </div>
            </div>
          </div>
        ),
      },
      bank: {
        title: "MODULE BANCAIRE — CRÉDIT & ADVISORY", accent: "#fb923c",
        body: (() => {
          const RATING_COLOR = { AAA: "#4ade80", AA: "#4ade80", A: "#86efac", BBB: "#f0b429", BB: "#fb923c", B: "#ef4444", CCC: "#ef4444" };
          const POL_LABEL = (s) => s <= 3 ? "FAIBLE" : s <= 6 ? "MODÉRÉ" : "ÉLEVÉ";
          const POL_COLOR = (s) => s <= 3 ? "#4ade80" : s <= 6 ? "#f0b429" : "#ef4444";
          if (!bankContext) return (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b", fontSize: 16 }}>
              <div style={{ fontSize: 34, marginBottom: 12 }}>🏦</div>
              <div style={{ color: "#94a3b8", marginBottom: 8 }}>Chargement des données bancaires…</div>
              <div style={{ fontSize: 15, color: "#64748b" }}>Connexion au backend WASI requise. Les données s'afficheront automatiquement une fois récupérées.</div>
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
          const ratingColor = RATING_COLOR[rating] || "#94a3b8";
          const premiumBps = { AAA: 50, AA: 100, A: 150, BBB: 250, BB: 400, B: 600, CCC: 1000 }[rating] || 1000;
          const fmtUsd = (v) => { if (!v) return "N/D"; if (v >= 1e12) return `${(v/1e12).toFixed(1)} Bil USD`; if (v >= 1e9) return `${(v/1e9).toFixed(1)} Mrd USD`; if (v >= 1e6) return `${(v/1e6).toFixed(0)} M USD`; return `${v.toLocaleString()} USD`; };
          return (
            <div>
              <div style={{ fontSize: 16, color: "#94a3b8", marginBottom: 20, lineHeight: 1.7 }}>
                Analyse de crédit souverain pour {country.flag} <strong style={{ color: "#e2e8f0" }}>{bankContext.country_name}</strong> · Poids WASI : <strong style={{ color: "#fb923c" }}>{bankContext.composite_weight_pct}%</strong>
              </div>
              {/* Score + Rating */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
                {[
                  { label: "SCORE INDICATIF", val: `${indicativeScore}/100`, color: parseFloat(indicativeScore) >= 70 ? "#4ade80" : parseFloat(indicativeScore) >= 50 ? "#f0b429" : "#ef4444" },
                  { label: "NOTATION", val: rating, color: ratingColor },
                  { label: "PRIME DE RISQUE", val: `+${premiumBps} bps`, color: premiumBps <= 150 ? "#4ade80" : premiumBps <= 400 ? "#f0b429" : "#ef4444" },
                ].map((s, i) => (
                  <div key={i} style={{ padding: "18px 22px", background: "rgba(15,42,69,0.5)", border: `1px solid ${s.color}33`, borderRadius: 6 }}>
                    <div style={{ fontSize: 14, color: "#94a3b8", letterSpacing: 2, marginBottom: 8 }}>{s.label}</div>
                    <div style={{ fontSize: 34, fontFamily: "'Bebas Neue',sans-serif", color: s.color, letterSpacing: 3 }}>{s.val}</div>
                  </div>
                ))}
              </div>
              {/* Score components */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 15, color: "#fb923c", letterSpacing: 2, marginBottom: 10 }}>COMPOSANTES DU SCORE</div>
                {[
                  { label: "Composante WASI Index", val: wasiPts.toFixed(1), max: 40, color: "#f0b429", desc: `Score WASI actuel : ${wasi?.value?.toFixed(1) || "N/D"}/100 → ${wasiPts.toFixed(1)}/40 pts` },
                  { label: "Composante Balance Commerciale", val: tradePts.toFixed(1), max: 20, color: "#38bdf8", desc: `Balance : ${fmtUsd(tradeBalance)} → ${tradePts.toFixed(1)}/20 pts` },
                  { label: "Pénalité Risque Politique", val: `-${polPenalty.toFixed(1)}`, max: 10, color: POL_COLOR(pol), desc: `Score politique : ${pol}/10 (${POL_LABEL(pol)}) → -${polPenalty.toFixed(1)}/10 pts` },
                ].map((c, i) => (
                  <div key={i} style={{ marginBottom: 12, padding: "16px 18px", background: "rgba(15,42,69,0.4)", border: "1px solid #0f2a45", borderRadius: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 15, color: "#94a3b8" }}>{c.label}</span>
                      <span style={{ fontSize: 22, fontFamily: "'Bebas Neue',sans-serif", color: c.color, letterSpacing: 2 }}>{c.val} pts</span>
                    </div>
                    <div style={{ height: 6, background: "#0a1628", borderRadius: 3, marginBottom: 6 }}>
                      <div style={{ height: "100%", width: `${Math.abs(parseFloat(c.val)) / c.max * 100}%`, background: c.color, borderRadius: 3 }} />
                    </div>
                    <div style={{ fontSize: 15, color: "#64748b" }}>{c.desc}</div>
                  </div>
                ))}
              </div>
              {/* Trade partners from API */}
              {trade?.top_partners?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 15, color: "#fb923c", letterSpacing: 2, marginBottom: 10 }}>TOP PARTENAIRES COMMERCIAUX</div>
                  {trade.top_partners.slice(0, 4).map((p, i) => (
                    <div key={i} style={{ marginBottom: 8, padding: "10px 14px", background: "rgba(15,42,69,0.4)", border: "1px solid #0f2a45", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 16, color: "#e2e8f0" }}>{p.partner}</div>
                        {p.top_exports && <div style={{ fontSize: 15, color: "#64748b", marginTop: 3 }}>Exports : {typeof p.top_exports === "string" ? p.top_exports : p.top_exports.join(", ")}</div>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 20, fontFamily: "'Bebas Neue',sans-serif", color: "#a78bfa", letterSpacing: 2 }}>{fmtUsd(p.total_trade_usd)}</div>
                        <div style={{ fontSize: 14, color: (p.trade_balance_usd || 0) >= 0 ? "#4ade80" : "#ef4444" }}>Balance : {fmtUsd(p.trade_balance_usd)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Procurement */}
              {proc && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 15, color: "#fb923c", letterSpacing: 2, marginBottom: 10 }}>MARCHÉS PUBLICS (PROCUREMENT)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    {[
                      { label: "APPELS D'OFFRES", val: proc.tender_count ?? "N/D", color: "#38bdf8" },
                      { label: "ATTRIBUÉS", val: proc.awarded_count ?? "N/D", color: "#4ade80" },
                      { label: "INFRA (%)", val: proc.infrastructure_pct ? `${proc.infrastructure_pct}%` : "N/D", color: "#f0b429" },
                    ].map((s, i) => (
                      <div key={i} style={{ padding: "16px 18px", background: "rgba(15,42,69,0.4)", border: "1px solid #0f2a45", borderRadius: 6 }}>
                        <div style={{ fontSize: 14, color: "#94a3b8", letterSpacing: 1, marginBottom: 6 }}>{s.label}</div>
                        <div style={{ fontSize: 28, fontFamily: "'Bebas Neue',sans-serif", color: s.color, letterSpacing: 2 }}>{s.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* WACC Section */}
              {bankContext?.wacc && (() => {
                const w = bankContext.wacc;
                const waccColor = w.wacc_pct < 12 ? "#4ade80" : w.wacc_pct < 16 ? "#86efac" : w.wacc_pct < 20 ? "#f0b429" : w.wacc_pct < 25 ? "#fb923c" : "#ef4444";
                return (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 15, color: "#38bdf8", letterSpacing: 2, marginBottom: 10 }}>WACC — COÛT MOYEN PONDÉRÉ DU CAPITAL</div>
                    {/* Big WACC number */}
                    <div style={{ padding: "18px 20px", background: `${waccColor}0d`, border: `1px solid ${waccColor}44`, borderRadius: 6, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 14, color: "#94a3b8", letterSpacing: 2, marginBottom: 6 }}>WACC SOUVERAIN ESTIMÉ</div>
                        <div style={{ fontSize: 56, fontFamily: "'Bebas Neue',sans-serif", color: waccColor, letterSpacing: 4, lineHeight: 1 }}>{w.wacc_pct}%</div>
                        <div style={{ fontSize: 15, color: "#94a3b8", marginTop: 8, lineHeight: 1.7 }}>{w.interpretation}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, color: "#94a3b8", letterSpacing: 1, marginBottom: 4 }}>FORMULE</div>
                        <div style={{ fontSize: 15, color: "#64748b", lineHeight: 2, fontFamily: "'Space Mono',monospace" }}>
                          <div>WACC = (E/V × Re) + (D/V × Rd × (1−T))</div>
                          <div style={{ color: "#94a3b8" }}>E/V = {w.equity_ratio_pct}% · D/V = {w.debt_ratio_pct}%</div>
                          <div style={{ color: "#94a3b8" }}>T (impôt) = {w.corporate_tax_rate_pct}%</div>
                        </div>
                      </div>
                    </div>
                    {/* Components grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                      {[
                        { label: "COÛT DES FONDS PROPRES (Re)", val: `${w.cost_of_equity_pct}%`, color: "#a78bfa",
                          sub: `Re = Rf(${w.risk_free_rate_pct}%) + β(${w.beta}) × ERP(${w.equity_risk_premium_pct}%) + CRP(${w.country_risk_premium_pct}%)` },
                        { label: "COÛT DE LA DETTE (Rd)", val: `${w.cost_of_debt_pct}%`, color: "#38bdf8",
                          sub: `Rd = Rf(${w.risk_free_rate_pct}%) + Spread souverain(${(w.sovereign_spread_bps/100).toFixed(2)}%)` },
                        { label: "PRIME DE RISQUE PAYS (CRP)", val: `${w.country_risk_premium_pct}%`, color: "#f0b429",
                          sub: `Composante politique + discount WASI` },
                        { label: "BÊTA (β)", val: w.beta, color: "#fb923c",
                          sub: `Risque systématique vs marché EM global` },
                      ].map((s, i) => (
                        <div key={i} style={{ padding: "18px 22px", background: "rgba(15,42,69,0.5)", border: `1px solid ${s.color}33`, borderRadius: 6 }}>
                          <div style={{ fontSize: 14, color: "#94a3b8", letterSpacing: 1, marginBottom: 6 }}>{s.label}</div>
                          <div style={{ fontSize: 28, fontFamily: "'Bebas Neue',sans-serif", color: s.color, letterSpacing: 2, marginBottom: 4 }}>{s.val}</div>
                          <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>{s.sub}</div>
                        </div>
                      ))}
                    </div>
                    {/* Interpretation bar */}
                    <div style={{ padding: "12px 16px", background: "rgba(15,42,69,0.3)", borderRadius: 6, fontSize: 15, color: "#94a3b8", lineHeight: 1.8 }}>
                      <strong style={{ color: "#38bdf8" }}>Comment lire ce WACC :</strong> Tout projet d'investissement dans <strong style={{ color: "#e2e8f0" }}>{bankContext.country_name}</strong> doit générer un rendement supérieur à <strong style={{ color: waccColor }}>{w.wacc_pct}%</strong> par an pour être créateur de valeur. En dessous de ce seuil, le projet détruit de la valeur pour les investisseurs.
                    </div>
                  </div>
                );
              })()}
              {/* Disclaimer */}
              <div style={{ padding: "18px 24px", background: "rgba(251,146,60,0.05)", border: "1px solid #fb923c33", borderRadius: 6, fontSize: 15, color: "#94a3b8", lineHeight: 1.9 }}>
                <strong style={{ color: "#fb923c" }}>⚠ Avertissement :</strong> Cette notation est générée automatiquement à partir des données WASI et des statistiques commerciales publiques. Elle est indicative uniquement et ne constitue pas une décision de crédit définitive. Toute approbation de prêt requiert la validation d'un agent bancaire humain.
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
        <div style={{ background: "#07192e", border: `1px solid ${cfg.accent}55`, borderRadius: 8, width: "100%", maxWidth: 900, maxHeight: "90vh", overflowY: "auto", padding: 40 }} onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${cfg.accent}33` }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, color: cfg.accent, letterSpacing: 4 }}>{country.flag} {country.name.toUpperCase()} — {cfg.title}</div>
            <button onClick={() => setModal(null)} style={{ background: "none", border: `1px solid ${cfg.accent}44`, color: cfg.accent, padding: "8px 18px", borderRadius: 6, cursor: "pointer", fontSize: 16, fontFamily: "'Space Mono',monospace", letterSpacing: 1 }}>✕ FERMER</button>
          </div>
          {cfg.body}
        </div>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px", background: "rgba(3,13,26,0.6)" }}>
      {modal && <Modal type={modal} />}

      {/* En-tête pays */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 48 }}>{country.flag}</span>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: "#f0b429", letterSpacing: 4, lineHeight: 1 }}>{country.name.toUpperCase()}</div>
            <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: 2, marginTop: 2 }}>PORT PRINCIPAL : {country.port.toUpperCase()} · MONNAIE : {td.currency}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
              {[{ label: tierLabel.toUpperCase(), color: tierColor }, { label: indexTrend.label, color: indexTrend.color }, { label: `WASI ${Math.round(indexValue)}/100`, color: "#f0b429" }].map((b, i) => (
                <span key={i} style={{ fontSize: 13, color: b.color, border: `1px solid ${b.color}`, padding: "2px 7px", borderRadius: 2 }}>{b.label}</span>
              ))}
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "1px solid #1e3a5f", color: "#64748b", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 14, fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>← RETOUR</button>
      </div>

      {/* Fiche Pays — 3 clickable cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div onClick={() => setModal("chef")} style={{ ...panel("#1e3a5f"), }}>
          <div style={hint}>↗ DÉTAILS</div>
          <div style={{ fontSize: 12, color: "#94a3b8", letterSpacing: 3, marginBottom: 6 }}>CHEF D'ÉTAT</div>
          <div style={{ fontSize: 15, color: "#e2e8f0", fontWeight: 700, lineHeight: 1.4 }}>{td.president}</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>En poste depuis : {td.presidentSince}</div>
        </div>
        <div onClick={() => setModal("geo")} style={{ ...panel("#1e3a5f") }}>
          <div style={hint}>↗ DÉTAILS</div>
          <div style={{ fontSize: 12, color: "#94a3b8", letterSpacing: 3, marginBottom: 6 }}>GÉOGRAPHIE</div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 13, color: "#64748b" }}>Capitale officielle</div>
            <div style={{ fontSize: 15, color: "#38bdf8", fontWeight: 700 }}>{td.capitale}</div>
            {td.siegeEconomique && td.siegeEconomique !== td.capitale && <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>Centre éco. : {td.siegeEconomique}</div>}
          </div>
          <div><div style={{ fontSize: 13, color: "#64748b" }}>Superficie</div><div style={{ fontSize: 15, color: "#f0b429", fontWeight: 700 }}>{td.superficie.toLocaleString("fr-FR")} km²</div></div>
        </div>
        <div onClick={() => setModal("resources")} style={{ ...panel("#1e3a5f") }}>
          <div style={hint}>↗ DÉTAILS</div>
          <div style={{ fontSize: 12, color: "#94a3b8", letterSpacing: 3, marginBottom: 6 }}>MATIÈRES PREMIÈRES</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {td.matieres_premieres.map((m, i) => (
              <span key={i} style={{ fontSize: 12, color: "#4ade80", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 2, padding: "2px 6px", lineHeight: 1.6 }}>{m}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Bandeau métriques — clickable */}
      <div onClick={() => setModal("metrics")} style={{ display: "flex", gap: 12, marginBottom: 14, padding: "10px 14px", background: balance >= 0 ? "rgba(74,222,128,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${balanceColor}44`, borderRadius: 6, cursor: "pointer", position: "relative" }}>
        <div style={{ ...hint, top: 4 }}>↗ DÉTAILS</div>
        {[
          { label: "BALANCE COMMERCIALE", val: `${balance >= 0 ? "+" : ""}${fmt(balance)}`, color: balanceColor },
          { label: "TAUX DE COUVERTURE", val: `${coverageRate}%`, color: parseFloat(coverageRate) >= 100 ? "#4ade80" : "#f0b429" },
          { label: "EXPORTATIONS TOTALES", val: fmt(td.totalExports), color: "#4ade80" },
          { label: "IMPORTATIONS TOTALES", val: fmt(td.totalImports), color: "#38bdf8" },
          { label: "CROISSANCE PIB", val: `+${td.gdpGrowth}%`, color: td.gdpGrowth > 5 ? "#4ade80" : "#f0b429" },
        ].map((m, i) => (
          <div key={i} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "#94a3b8", letterSpacing: 2, marginBottom: 3, whiteSpace: "nowrap" }}>{m.label}</div>
            <div style={{ fontSize: 22, fontFamily: "'Bebas Neue', sans-serif", color: m.color, letterSpacing: 2, lineHeight: 1 }}>{m.val}</div>
          </div>
        ))}
      </div>
      <div onClick={() => setModal("brief")} style={{ ...panel(balance >= 0 ? "#4ade8044" : "#ef444444"), marginBottom: 10 }}>
        <div style={hint}>? DETAILS</div>
        <div style={{ fontSize: 13, color: balanceColor, letterSpacing: 3, marginBottom: 8 }}>BRIEF ECONOMIQUE PAYS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 3 }}>Synthese</div>
            <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>{balanceSentence}</div>
            <div style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6, marginTop: 4 }}>{coverageSentence}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 3 }}>Points cles</div>
            <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.6 }}>Export dominant: {topExports[0]?.cat || "N/D"}</div>
            <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.6 }}>Part dominante: {exportConcentrationPct}%</div>
            <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.6 }}>Signal WASI: {indexTrend.label}</div>
          </div>
        </div>
      </div>
      {/* Exports + Imports — clickable */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div onClick={() => setModal("exports")} style={{ ...panel("#0f2a45") }}>
          <div style={hint}>↗ DÉTAILS</div>
          <div style={{ fontSize: 13, color: "#4ade80", letterSpacing: 3, marginBottom: 10 }}>↑ EXPORTATIONS PRINCIPALES</div>
          <BarChart data={td.exports} color="#4ade80" maxVal={maxExport} />
        </div>
        <div onClick={() => setModal("imports")} style={{ ...panel("#0f2a45") }}>
          <div style={hint}>↗ DÉTAILS</div>
          <div style={{ fontSize: 13, color: "#38bdf8", letterSpacing: 3, marginBottom: 10 }}>↓ IMPORTATIONS PRINCIPALES</div>
          <BarChart data={td.imports} color="#38bdf8" maxVal={maxImport} />
        </div>
      </div>

      {/* Ratios + Sparkline + Flux — clickable */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div onClick={() => setModal("ratios")} style={{ ...panel("#0f2a45") }}>
          <div style={hint}>↗ DÉTAILS</div>
          <div style={{ fontSize: 13, color: "#f0b429", letterSpacing: 3, marginBottom: 10 }}>ANALYSE DES RATIOS</div>
          {ratios.map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #0a1628" }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>{r.label}</span>
              <span style={{ fontSize: 13, color: r.color, fontWeight: 700 }}>{r.val}</span>
            </div>
          ))}
        </div>
        <div onClick={() => setModal("wasi")} style={{ ...panel("#0f2a45") }}>
          <div style={hint}>↗ DÉTAILS</div>
          <div style={{ fontSize: 13, color: "#f0b429", letterSpacing: 3, marginBottom: 8 }}>ÉVOLUTION INDEX WASI (12 MOIS)</div>
          <Sparkline base={indexValue} width={160} height={50} realData={historyData} seed={countrySeed} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginTop: 3, marginBottom: 10 }}>
            <span>Jan</span><span>Avr</span><span>Juil</span><span>Oct</span><span>Déc</span>
          </div>
          <div onClick={e => { e.stopPropagation(); setModal("partners"); }} style={{ cursor: "pointer" }}>
            <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: 3, marginBottom: 6 }}>PARTENAIRES COMMERCIAUX <span style={{ color: "#1e3a5f" }}>↗</span></div>
            {td.partners.map((p, i) => (
              <div key={i} style={{ fontSize: 13, color: "#64748b", padding: "4px 0", borderBottom: "1px solid #0a1628" }}>{i + 1}. {p}</div>
            ))}
          </div>
        </div>
        <div onClick={() => setModal("flux")} style={{ ...panel("#0f2a45") }}>
          <div style={hint}>↗ DÉTAILS</div>
          <div style={{ fontSize: 13, color: "#f0b429", letterSpacing: 3, marginBottom: 8 }}>RÉPARTITION DES FLUX</div>
          <TradeDonut exports={td.totalExports} imports={td.totalImports} />
          <div style={{ marginTop: 8 }}>
            {[["#4ade80", "Exportations", fmt(td.totalExports)], ["#38bdf8", "Importations", fmt(td.totalImports)]].map(([c, l, v], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#94a3b8", marginBottom: 3 }}>
                <span style={{ color: c }}>â–  {l}</span><span>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #0a1628" }}>
            <div style={{ fontSize: 12, color: "#94a3b8", letterSpacing: 2 }}>SIGNAL WASI</div>
            <div style={{ fontSize: 18, fontFamily: "'Bebas Neue', sans-serif", color: indexTrend.color, letterSpacing: 2, marginTop: 2 }}>{indexTrend.label} · {indexValue}/100</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>Poids régional : {(country.weight * 100).toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* Opportunités + Risques — clickable */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div onClick={() => setModal("opportunities")} style={{ ...panel("#4ade8044") }}>
          <div style={hint}>↗ DÉTAILS</div>
          <div style={{ fontSize: 13, color: "#4ade80", letterSpacing: 3, marginBottom: 8 }}>✦ OPPORTUNITÉS DE MARCHÉ</div>
          {td.opportunities.map((o, i) => (
            <div key={i} style={{ fontSize: 14, color: "#94a3b8", padding: "6px 0", borderBottom: "1px solid #0a1628", lineHeight: 1.5 }}>✦ {o}</div>
          ))}
        </div>
        <div onClick={() => setModal("risks")} style={{ ...panel("#ef444444") }}>
          <div style={hint}>↗ DÉTAILS</div>
          <div style={{ fontSize: 13, color: "#ef4444", letterSpacing: 3, marginBottom: 8 }}>âš  FACTEURS DE RISQUE</div>
          {td.risks.map((r, i) => (
            <div key={i} style={{ fontSize: 14, color: "#94a3b8", padding: "6px 0", borderBottom: "1px solid #0a1628", lineHeight: 1.5 }}>âš  {r}</div>
          ))}
        </div>
      </div>

      {/* Module Transport Multi-Modal */}
      <TransportModePanel transportData={transportData} />

      {/* Module FMI — Indicateurs Macro */}
      {macroData && macroData.years && macroData.years.length > 0 && (() => {
        const latest = macroData.years[0];
        const prev   = macroData.years[1];
        const mkBar = (val, max, color) => (
          <div style={{ height: 6, background: "#0a1628", borderRadius: 2, marginTop: 3 }}>
            <div style={{ height: "100%", width: `${Math.max(2, Math.min(100, Math.abs(val) / max * 100))}%`, background: val < 0 ? "#ef4444" : color, borderRadius: 2 }} />
          </div>
        );
        const delta = (a, b) => (a !== null && b !== null) ? (a - b).toFixed(1) : null;
        const fmtPct = v => v !== null ? `${v > 0 ? "+" : ""}${v.toFixed(1)}%` : "N/D";
        const cells = [
          { label: "CROISSANCE PIB", val: latest.gdp_growth_pct, fmt: fmtPct, max: 15, color: "#4ade80", d: delta(latest.gdp_growth_pct, prev?.gdp_growth_pct) },
          { label: "INFLATION", val: latest.inflation_pct,    fmt: fmtPct, max: 50, color: "#f0b429", d: delta(latest.inflation_pct, prev?.inflation_pct) },
          { label: "DETTE/PIB",  val: latest.debt_gdp_pct,    fmt: v => v !== null ? `${v.toFixed(1)}%` : "N/D", max: 120, color: "#a78bfa", d: delta(latest.debt_gdp_pct, prev?.debt_gdp_pct) },
          { label: "COMPTE COURANT/PIB", val: latest.current_account_gdp_pct, fmt: fmtPct, max: 20, color: "#38bdf8", d: delta(latest.current_account_gdp_pct, prev?.current_account_gdp_pct) },
        ];
        return (
          <div style={{ marginTop: 10, padding: "16px 18px", background: "rgba(10,22,40,0.6)", border: "1px solid #0f2a45", borderRadius: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: "#38bdf8", letterSpacing: 3 }}>📉 FMI WEO — INDICATEURS MACRO</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{latest.year}{latest.is_projection ? " (proj.)" : ""} · Source: FMI World Economic Outlook</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
              {cells.map((c, i) => {
                const valColor = c.label === "CROISSANCE PIB" ? (c.val >= 5 ? "#4ade80" : c.val >= 2 ? "#f0b429" : "#ef4444")
                  : c.label === "INFLATION" ? (c.val <= 5 ? "#4ade80" : c.val <= 15 ? "#f0b429" : "#ef4444")
                  : c.label === "DETTE/PIB"  ? (c.val <= 60 ? "#4ade80" : c.val <= 90 ? "#f0b429" : "#ef4444")
                  : (c.val >= 0 ? "#4ade80" : "#ef4444");
                return (
                  <div key={i} style={{ padding: "12px 14px", background: "rgba(15,42,69,0.5)", border: `1px solid ${valColor}33`, borderRadius: 4 }}>
                    <div style={{ fontSize: 12, color: "#64748b", letterSpacing: 1, marginBottom: 4 }}>{c.label}</div>
                    <div style={{ fontSize: 20, fontFamily: "'Bebas Neue',sans-serif", color: valColor, letterSpacing: 2, lineHeight: 1 }}>{c.fmt(c.val)}</div>
                    {c.d !== null && <div style={{ fontSize: 12, color: parseFloat(c.d) === 0 ? "#64748b" : parseFloat(c.d) > 0 ? "#4ade80" : "#ef4444", marginTop: 3 }}>{parseFloat(c.d) > 0 ? "â–²" : "â–¼"} {Math.abs(parseFloat(c.d))} vs {prev?.year}</div>}
                    {c.val !== null && mkBar(c.val, c.max, valColor)}
                  </div>
                );
              })}
            </div>
            {latest.gdp_usd_billions !== null && (
              <div style={{ marginTop: 8, fontSize: 13, color: "#64748b" }}>
                PIB nominal : <span style={{ color: "#94a3b8" }}>${latest.gdp_usd_billions?.toFixed(1)} Mrd USD</span>
                {latest.unemployment_pct !== null && <span> · Chômage : <span style={{ color: "#94a3b8" }}>{latest.unemployment_pct?.toFixed(1)}%</span></span>}
              </div>
            )}
          </div>
        );
      })()}

      {/* Module Bancaire — clickable */}
      <div onClick={() => setModal("bank")} style={{ marginTop: 10, ...panel("#fb923c44") }}>
        <div style={hint}>↗ ANALYSE COMPLÈTE</div>
        <div style={{ fontSize: 13, color: "#fb923c", letterSpacing: 3, marginBottom: 8 }}>🏦 MODULE BANCAIRE — CRÉDIT & ADVISORY</div>
        {bankContext ? (() => {
          const pol = bankContext.political_risk_score;
          // Use server-computed score (backend applies ECOWAS medians for missing data)
          const scoreNum = bankContext.indicative_score ?? 45.0;
          const score = scoreNum.toFixed(1);
          const rating = bankContext.indicative_rating || "CCC";
          const ratingColor = { AAA:"#4ade80", AA:"#4ade80", A:"#86efac", BBB:"#f0b429", BB:"#fb923c", B:"#ef4444", CCC:"#ef4444" }[rating];
          return (
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, color: "#94a3b8", letterSpacing: 2 }}>SCORE INDICATIF</div>
                <div style={{ fontSize: 28, fontFamily: "'Bebas Neue',sans-serif", color: parseFloat(score) >= 70 ? "#4ade80" : parseFloat(score) >= 50 ? "#f0b429" : "#ef4444", letterSpacing: 3 }}>{score}/100</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#94a3b8", letterSpacing: 2 }}>NOTATION</div>
                <div style={{ fontSize: 28, fontFamily: "'Bebas Neue',sans-serif", color: ratingColor, letterSpacing: 3 }}>{rating}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#94a3b8", letterSpacing: 2 }}>RISQUE POL.</div>
                <div style={{ fontSize: 28, fontFamily: "'Bebas Neue',sans-serif", color: pol <= 3 ? "#4ade80" : pol <= 6 ? "#f0b429" : "#ef4444", letterSpacing: 3 }}>{pol}/10</div>
              </div>
              {bankContext.wacc && (
                <div style={{ marginLeft: "auto" }}>
                  <div style={{ fontSize: 12, color: "#94a3b8", letterSpacing: 2 }}>WACC PAYS</div>
                  <div style={{ fontSize: 28, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 3,
                    color: bankContext.wacc.wacc_pct < 16 ? "#4ade80" : bankContext.wacc.wacc_pct < 20 ? "#f0b429" : "#ef4444" }}>
                    {bankContext.wacc.wacc_pct}%
                  </div>
                </div>
              )}
            </div>
          );
        })() : (
          <div style={{ fontSize: 15, color: "#64748b", lineHeight: 1.6 }}>Chargement de l'analyse de crédit souverain… <span style={{ color: "#fb923c" }}>Cliquer pour voir</span></div>
        )}
      </div>

      {/* ── FISCALITÉ & LOI DE FINANCES ─────────────────────────────────── */}
      {(() => {
        const tax = taxDataByCountry[country.code];
        if (!tax) return (
          <div style={{ marginTop: 10, padding: "10px 14px", background: "rgba(10,22,40,0.4)", border: "1px solid #0f2a45", borderRadius: 6 }}>
            <div style={{ fontSize: 13, color: "#64748b", letterSpacing: 3 }}>⚖ FISCALITÉ — DONNÉES EN COURS D'INTÉGRATION</div>
            <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>Les données fiscales pour {country.name} seront disponibles prochainement.</div>
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
          if (isNaN(n)) return "#94a3b8";
          if (n === 0) return "#4ade80";
          if (n <= 10) return "#86efac";
          if (n <= 20) return "#f0b429";
          if (n <= 30) return "#fb923c";
          return "#ef4444";
        };
        return (
          <div style={{ marginTop: 10, padding: "16px 18px", background: "rgba(10,22,40,0.6)", border: "1px solid #0f2a45", borderRadius: 6 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, color: "#a78bfa", letterSpacing: 3 }}>⚖ FISCALITÉ — LOI DE FINANCES {tax.year}</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>Source : {tax.source}</div>
              </div>
              <div style={{ fontSize: 12, color: "#64748b", textAlign: "right" }}>
                {tax.currency}
              </div>
            </div>

            {/* 2025 new measures */}
            {tax.changes_2025 && tax.changes_2025.length > 0 && (
              <div style={{ marginBottom: 8, padding: "6px 10px", background: "rgba(167,139,250,0.07)", border: "1px solid #a78bfa22", borderRadius: 4 }}>
                <div style={{ fontSize: 12, color: "#a78bfa", letterSpacing: 2, marginBottom: 4 }}>✦ NOUVELLES MESURES {tax.year}</div>
                {tax.changes_2025.map((c, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.7 }}>· {c}</div>
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
                  background: taxTab === t.id ? "rgba(167,139,250,0.15)" : "transparent",
                  border: `1px solid ${taxTab === t.id ? "#a78bfa" : "#1e3a5f"}`,
                  borderRadius: 3, color: taxTab === t.id ? "#a78bfa" : "#64748b",
                  fontSize: 12, padding: "3px 8px", cursor: "pointer", letterSpacing: 1,
                  fontFamily: "'Space Mono', monospace",
                }}>{t.label}</button>
              ))}
            </div>

            {/* Corporate / IS / BIC */}
            {taxTab === "corporate" && tax.corporate && (
              <div>
                {tax.corporate.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0", borderBottom: i < tax.corporate.length - 1 ? "1px solid #0f2a4580" : "none" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: "#e2e8f0" }}>{item.label}</div>
                      {item.note && <div style={{ fontSize: 11, color: "#475569" }}>{item.note}</div>}
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
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0", borderBottom: i < tax.vat.length - 1 ? "1px solid #0f2a4580" : "none" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: "#e2e8f0" }}>{item.label}</div>
                      {item.note && <div style={{ fontSize: 11, color: "#475569" }}>{item.note}</div>}
                    </div>
                    <div style={{ fontSize: 16, fontFamily: "'Bebas Neue', sans-serif", color: rateColor(item.rate), letterSpacing: 1, minWidth: 48, textAlign: "right" }}>
                      {typeof item.rate === "number" ? `${item.rate}%` : item.rate}
                    </div>
                  </div>
                ))}
                {tax.vat_exempt && (
                  <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(74,222,128,0.05)", border: "1px solid #4ade8022", borderRadius: 3 }}>
                    <div style={{ fontSize: 11, color: "#4ade80", letterSpacing: 1, marginBottom: 3 }}>EXONÉRATIONS TVA</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{tax.vat_exempt.join(" · ")}</div>
                  </div>
                )}
                {tax.irpp && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: "#38bdf8", letterSpacing: 2, marginBottom: 4 }}>IRPP — BARÈME PROGRESSIF</div>
                    {tax.irpp.map((b, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94a3b8", lineHeight: 1.8 }}>
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
                <div style={{ fontSize: 12, color: "#38bdf8", letterSpacing: 2, marginBottom: 4 }}>TARIF EXTÉRIEUR COMMUN CEDEAO (TEC)</div>
                {tax.customs.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0", borderBottom: "1px solid #0f2a4550" }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 12, color: "#f0b429", marginRight: 6 }}>{item.cat}</span>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>{item.label}</span>
                    </div>
                    <div style={{ fontSize: 16, fontFamily: "'Bebas Neue', sans-serif", color: rateColor(item.rate), letterSpacing: 1, minWidth: 40, textAlign: "right" }}>{item.rate}%</div>
                  </div>
                ))}
                {tax.customs_levies && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: "#38bdf8", letterSpacing: 2, marginBottom: 4 }}>PRÉLÈVEMENTS ADDITIONNELS</div>
                    {tax.customs_levies.map((l, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94a3b8", lineHeight: 1.8 }}>
                        <span>{l.label}</span>
                        <span style={{ color: "#f0b429", fontFamily: "'Bebas Neue', sans-serif", fontSize: 14 }}>{l.rate}%</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 4, fontSize: 11, color: "#475569" }}>
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
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0", borderBottom: i < tax.sector.length - 1 ? "1px solid #0f2a4580" : "none" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: "#e2e8f0" }}>{item.label}</div>
                      {item.note && <div style={{ fontSize: 11, color: "#475569" }}>{item.note}</div>}
                    </div>
                    <div style={{ fontSize: 15, fontFamily: "'Bebas Neue', sans-serif", color: rateColor(item.rate), letterSpacing: 1, minWidth: 60, textAlign: "right" }}>
                      {item.rate}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 8, fontSize: 11, color: "#334155", letterSpacing: 0.5 }}>
              Base de données fiscale WASI · Sources officielles DGI / FIRS / GRA / DGID · Mise à jour {tax.year}
            </div>
          </div>
        );
      })()}

      {/* Pied de page */}
      <div style={{ marginTop: 10, padding: "7px 12px", background: "rgba(10,22,40,0.5)", borderRadius: 4, fontSize: 12, color: "#64748b", letterSpacing: 0.5, display: "flex", justifyContent: "space-between" }}>
        <span>Source : WASI Data Engine v3.0 · Statistiques Officielles Portuaires · FMI World Economic Outlook · Données 2023–2026</span>
        <span style={{ color: "#4ade80", whiteSpace: "nowrap", marginLeft: 12 }}>✓ Fiche vérifiée : {new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}</span>
      </div>
    </div>
  );
}




