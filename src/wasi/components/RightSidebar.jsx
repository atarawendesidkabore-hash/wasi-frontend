import {
  WASICard,
  MetricBadge,
  CurrencyDisplay,
  DemoLabel,
  CreditGradeBadge,
  RiskIndicator,
} from "../../../packages/ui/src";

function getSignalGrade(score) {
  if (score >= 80) return "AA";
  if (score >= 70) return "A";
  if (score >= 60) return "BBB";
  if (score >= 50) return "BB";
  if (score >= 40) return "B";
  if (score >= 30) return "CCC";
  return "D";
}

function getSignalRisk(score) {
  if (score >= 70) return "LOW";
  if (score >= 55) return "MEDIUM";
  if (score >= 40) return "HIGH";
  return "CRITICAL";
}

function getSignalLabel(score) {
  if (score > 65) return "HAUSSIER";
  if (score > 50) return "NEUTRE";
  return "BAISSIER";
}

export function RightSidebar({
  mobilePanel,
  wasiTrend,
  wasiComposite,
  indices,
  countries,
  dataSource,
  stockMarkets,
  setSidebarModal,
  newsEvents,
  commodityPrices,
  backendConnected,
}) {
  const coverageMetrics = [
    { label: "Pays couverts", value: "16 CEDEAO", trend: "up", deltaText: "Full scope" },
    { label: "Ports suivis", value: "Abidjan/Lagos/Tema/Dakar", trend: "up", deltaText: "Core lanes" },
    { label: "Macro + Markets", value: "FMI + BRVM + WB", trend: "flat", deltaText: "Multi-source" },
    { label: "Frequence", value: "Temps reel + 6h", trend: "up", deltaText: "Hot refresh" },
  ];

  const topMovers = [...countries]
    .sort((a, b) => (indices[b.code] || 0) - (indices[a.code] || 0))
    .slice(0, 5);

  const top2 = [...countries]
    .sort((a, b) => (indices[b.code] || 0) - (indices[a.code] || 0))
    .slice(0, 2);

  const wasiSignalLabel = getSignalLabel(wasiComposite);
  const wasiSignalGrade = getSignalGrade(wasiComposite);
  const wasiRiskLevel = getSignalRisk(wasiComposite);

  return (
    <div
      className={`wasi-sidebar-right${mobilePanel === "right" ? " mobile-active" : ""}`}
      style={{ borderLeft: "1px solid #0f2a45", padding: 16, overflowY: "auto", background: "rgba(3,13,26,0.6)" }}
    >
      <div style={{ marginBottom: 14 }}>
        <WASICard title="Couverture WASI" subtitle="Modules actifs et couverture regionale">
          <div style={{ display: "grid", gap: 8 }}>
            {coverageMetrics.map((item) => (
              <MetricBadge
                key={item.label}
                label={item.label}
                value={item.value}
                trend={item.trend}
                deltaText={item.deltaText}
              />
            ))}
          </div>
        </WASICard>
      </div>

      <div style={{ marginBottom: 14 }}>
        <WASICard title="Signal ETF WASI" subtitle="Lecture synthese du composite" accentColor={wasiTrend.color}>
          <div style={{ display: "grid", gap: 10 }}>
            <MetricBadge
              label="Signal"
              value={`${wasiSignalLabel} (${wasiComposite}/100)`}
              trend={wasiComposite >= 50 ? "up" : "down"}
              deltaText={wasiComposite >= 65 ? "Momentum fort" : "Surveillance active"}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <RiskIndicator level={wasiRiskLevel} />
              <CreditGradeBadge grade={wasiSignalGrade} />
            </div>
            <div style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.5 }}>
              Top : {top2.map((c) => `${c.flag} ${c.code} ${Math.round(indices[c.code])}`).join(", ")}
            </div>
            {dataSource !== "live" ? <DemoLabel text="DONNEES SIMULEES - NON REELLES" /> : null}
          </div>
        </WASICard>
      </div>

      <div style={{ marginBottom: 14 }}>
        <WASICard title="Reference Monetaire" subtitle="Standard d'affichage XOF" accentColor="#C9A84C">
          <DemoLabel text="FORMAT DE REFERENCE - DEMO" />
          <div style={{ marginTop: 8, fontSize: 13, color: "#475569" }}>
            Exemple : <CurrencyDisplay amount={1500000n} currency="XOF" />
          </div>
        </WASICard>
      </div>

      <div style={{ marginTop: 14 }}>
        <WASICard title="Meilleures Performances" subtitle="Top 5 pays selon l indice WASI" accentColor="#1A7A4A">
          <div style={{ display: "grid", gap: 6 }}>
            {topMovers.map((c) => {
              const score = Math.round(indices[c.code] || 0);
              const grade = score >= 90 ? "AAA"
                : score >= 80 ? "AA"
                : score >= 70 ? "A"
                : score >= 60 ? "BBB"
                : score >= 50 ? "BB"
                : score >= 40 ? "B"
                : score >= 30 ? "CCC"
                : "D";

              return (
                <div key={c.code} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, background: "#ffffff" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 14, color: "#0f172a", fontWeight: 700 }}>{c.flag} {c.code}</span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>Indice {score}/100</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <MetricBadge label="Score" value={score} trend={score >= 65 ? "up" : "flat"} deltaText={score >= 65 ? "Fort" : "A surveiller"} />
                    <CreditGradeBadge grade={grade} />
                  </div>
                </div>
              );
            })}
          </div>
        </WASICard>
      </div>

      <div style={{ marginTop: 14 }}>
        <WASICard title="Marches Boursiers" subtitle="NGX, GSE, BRVM" accentColor="#C9A84C">
          {stockMarkets.length === 0 ? (
            <DemoLabel text="Chargement des marches..." />
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {stockMarkets.map((m, i) => {
                const up = m.change_pct >= 0;
                return (
                  <div
                    key={i}
                    onClick={() => setSidebarModal({ type: "market", market: m })}
                    style={{
                      cursor: "pointer",
                      border: "1px solid #d1d5db",
                      borderRadius: 8,
                      padding: "10px",
                      background: "#ffffff",
                    }}
                  >
                    <MetricBadge
                      label={`${m.exchange_code} - ${m.index_name}`}
                      value={m.index_value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
                      trend={up ? "up" : "down"}
                      deltaText={`${up ? "+" : ""}${m.change_pct.toFixed(2)}% | YTD ${m.ytd_change_pct >= 0 ? "+" : ""}${m.ytd_change_pct?.toFixed(1)}%`}
                    />
                    <div style={{ marginTop: 6, fontSize: 12, color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                      <span>Cap. {(m.market_cap_usd / 1e9).toFixed(1)} Md USD</span>
                      <span>Ouvrir detail</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </WASICard>
      </div>

      <div style={{ marginTop: 14 }}>
        <WASICard title="Signaux Actualite" subtitle="Evenements actifs RSS" accentColor="#0D2B1A">
          {newsEvents.length === 0 ? (
            <DemoLabel text="Aucun evenement actif - balayage RSS horaire" />
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {newsEvents.slice(0, 4).map((e, i) => {
                const level = e.event_type === "POLITICAL_RISK"
                  ? "CRITICAL"
                  : e.event_type === "PORT_DISRUPTION"
                    ? "HIGH"
                    : e.event_type === "STRIKE"
                      ? "MEDIUM"
                      : "LOW";
                return (
                  <div
                    key={i}
                    onClick={() => setSidebarModal({ type: "event", event: e })}
                    style={{
                      cursor: "pointer",
                      border: "1px solid #d1d5db",
                      borderRadius: 8,
                      padding: "10px",
                      background: "#ffffff",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "#334155", fontWeight: 700 }}>{e.event_type.replace(/_/g, " ")}</span>
                      <RiskIndicator level={level} />
                    </div>
                    <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.4 }}>
                      {e.headline?.slice(0, 110)}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>
                      {e.country_code} | {e.magnitude >= 0 ? "+" : ""}{e.magnitude}pt
                    </div>
                  </div>
                );
              })}
              {newsEvents.length > 4 ? (
                <div style={{ fontSize: 12, color: "#64748b", textAlign: "center" }}>
                  + {newsEvents.length - 4} autres evenements actifs
                </div>
              ) : null}
            </div>
          )}
        </WASICard>
      </div>

      <div style={{ marginTop: 14 }}>
        <WASICard title="Matieres Premieres" subtitle="Flux multi-source" accentColor="#C9A84C">
          {commodityPrices.length === 0 ? (
            <DemoLabel text="Chargement Commodity Feed..." />
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {commodityPrices.length} commodities chargees
              </div>
              <div style={{ display: "grid", gap: 6, maxHeight: 340, overflowY: "auto", paddingRight: 4 }}>
              {[...commodityPrices].sort((a, b) => String(a.code).localeCompare(String(b.code))).map((p, i) => {
                const trend = p.mom_pct === null ? "flat" : p.mom_pct > 0 ? "up" : "down";
                const deltaText = p.mom_pct === null ? "MoM n/a" : `${p.mom_pct > 0 ? "+" : ""}${p.mom_pct.toFixed(1)}% MoM`;
                return (
                  <div key={i} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "10px", background: "#ffffff" }}>
                    <MetricBadge
                      label={p.name}
                      value={`${p.price_usd}`}
                      trend={trend}
                      deltaText={deltaText}
                    />
                    <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>
                      {p.unit} | {p.period}
                    </div>
                  </div>
                );
              })}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", textAlign: "right" }}>
                Source: WASI Commodity Feed (Stooq + WB fallback)
              </div>
            </div>
          )}
        </WASICard>
      </div>

      <div style={{ marginTop: 14 }}>
        <WASICard title="Data Source" subtitle="Etat des flux et connectivite" accentColor="#0D2B1A">
          {dataSource !== "live" ? <DemoLabel text="DONNEES SIMULEES - NON REELLES" /> : null}
          <div style={{ marginTop: 8, fontSize: 12, color: "#475569", lineHeight: 1.7 }}>
            Donnees : {backendConnected
              ? `WASI API v3.0 CEDEAO (${dataSource === "live" ? "TEMPS REEL" : "SIMULATION"}) | Statistiques Officielles Portuaires | Suivi AIS`
              : "Mode Simulation | Statistiques Portuaires Officielles (demo)"}
            <br /><br />
            Serveur : {backendConnected ? <span style={{ color: "#16a34a" }}>CONNECTE</span> : <span style={{ color: "#f59e0b" }}>HORS LIGNE</span>}
            <br /><br />
            Copyright 2025-2026 WASI v3.0 | Plateforme d Intelligence Maritime et Economique CEDEAO.
          </div>
        </WASICard>
      </div>

      <div style={{ marginTop: 10 }}>
        <WASICard title="Avertissement Legal" subtitle="Lecture obligatoire" accentColor="#DC2626">
          <DemoLabel text="INFORMATION UNIQUEMENT - PAS UN CONSEIL D INVESTISSEMENT" />
          <div style={{ marginTop: 8, fontSize: 12, color: "#475569", lineHeight: 1.8 }}>
            Les donnees, indices et analyses presentes sur cette plateforme sont informatives uniquement. Elles ne constituent pas
            un conseil en investissement, une recommandation de credit, ni une decision d allocation de capital. Les notations de
            credit restent indicatives et ne remplacent pas l evaluation d un analyste agree. Les donnees de marche peuvent etre
            retardees, incompletes ou approximatives. Consultez un conseiller financier agree avant toute decision.
          </div>
        </WASICard>
      </div>
    </div>
  );
}
