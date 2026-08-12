import { useEffect, useMemo, useState } from "react";
import {
  RISK_CATEGORIES,
  buildRiskCartography,
  loadLiveRiskData,
  riskSeverity,
} from "../services/riskCartography";

/**
 * Cartographie des risques — probability x impact matrix for one country.
 *
 * Renders from local trade data immediately, then re-renders once the
 * platform's daily data arrives. If that fetch fails the component still
 * shows a complete local cartography, so it is never empty.
 */
export default function RiskCartography({ code, name, td }) {
  const [live, setLive] = useState(null);
  const [liveState, setLiveState] = useState("loading");

  useEffect(() => {
    let active = true;
    loadLiveRiskData().then((data) => {
      if (!active) return;
      const ok = Boolean(data && (data.macros || data.legal));
      setLive(ok ? data : null);
      setLiveState(ok ? "ready" : "offline");
    });
    return () => {
      active = false;
    };
  }, []);

  const risks = useMemo(
    () => buildRiskCartography({ code, name, td, live }),
    [code, name, td, live],
  );

  // Group risks by their matrix cell so several can share one square.
  const cells = useMemo(() => {
    const map = {};
    risks.forEach((r) => {
      const key = `${r.prob}_${r.impact}`;
      (map[key] = map[key] || []).push(r);
    });
    return map;
  }, [risks]);

  const cellBg = (p, i) => {
    const v = p * i;
    if (v >= 15) return "rgba(255,45,111,0.22)";
    if (v >= 9) return "rgba(240,180,41,0.18)";
    if (v >= 4) return "rgba(200,146,42,0.12)";
    return "rgba(0,255,132,0.08)";
  };

  const critical = risks.filter((r) => r.prob * r.impact >= 15).length;
  const derived = risks.filter((r) => r.origin === "derived").length;
  const expert = risks.length - derived;

  const sourceNote =
    liveState === "loading"
      ? "Chargement des données quotidiennes…"
      : liveState === "ready"
        ? `Enrichi par les données de la plateforme${live?.fetchedAt ? ` du ${new Date(live.fetchedAt).toLocaleDateString("fr-FR")}` : ""}`
        : "Données locales (plateforme injoignable)";

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Header + counters */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 13, letterSpacing: 2, color: "#ff2d6f" }}>
          CARTOGRAPHIE DES RISQUES
        </div>
        <div style={{ fontSize: 13, color: "#7f8fa6" }}>
          {risks.length} risques · {critical} critique{critical > 1 ? "s" : ""} · {expert} expert / {derived} dérivé{derived > 1 ? "s" : ""}
        </div>
      </div>

      {/* Matrix: probability rows 5 -> 1, impact columns 1 -> 5 */}
      <div style={{ display: "flex", gap: 8, alignItems: "stretch", marginBottom: 8 }}>
        <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 11, letterSpacing: 2, color: "#7f8fa6", textAlign: "center" }}>
          PROBABILITÉ
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "26px repeat(5, 1fr)", gap: 3 }}>
            {[5, 4, 3, 2, 1].map((p) => (
              <Row key={p} p={p} cells={cells} cellBg={cellBg} />
            ))}
            <div />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ textAlign: "center", fontSize: 11, color: "#7f8fa6", paddingTop: 2 }}>
                I{i}
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", fontSize: 11, letterSpacing: 2, color: "#7f8fa6", marginTop: 4 }}>
            IMPACT
          </div>
        </div>
      </div>

      {/* Category legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        {Object.entries(RISK_CATEGORIES).map(([label, color]) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#7f8fa6" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
            {label}
          </span>
        ))}
      </div>

      {/* Ranked risk list with provenance */}
      <div>
        {risks.map((r, idx) => {
          const sev = riskSeverity(r);
          const catColor = RISK_CATEGORIES[r.cat] || "#7f8fa6";
          return (
            <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 0", borderBottom: "1px solid #16233a" }}>
              <span style={{ minWidth: 26, textAlign: "center", fontWeight: 700, color: sev.color, fontSize: 15 }}>
                {sev.score}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, color: "#e2e8f0", lineHeight: 1.5 }}>{r.nom}</div>
                <div style={{ fontSize: 12, color: "#5c6b80", marginTop: 2 }}>
                  P{r.prob} · I{r.impact} · {r.source}
                </div>
              </div>
              <span style={{ padding: "1px 8px", borderRadius: 10, fontSize: 11, border: `1px solid ${catColor}`, color: catColor, whiteSpace: "nowrap" }}>
                {r.cat}
              </span>
              <span style={{ fontSize: 12, color: sev.color, whiteSpace: "nowrap", minWidth: 78, textAlign: "right" }}>
                {sev.label}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(15,42,69,0.3)", borderRadius: 4, fontSize: 13, color: "#7f8fa6", lineHeight: 1.7 }}>
        Échelle 1–5. Criticité = probabilité × impact. Les risques « expert » sont rédigés par
        l'équipe WASI ; les risques « dérivé » sont calculés à partir d'un indicateur mesuré, indiqué
        sous chaque ligne. {sourceNote}.
      </div>
    </div>
  );
}

function Row({ p, cells, cellBg }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#7f8fa6" }}>
        P{p}
      </div>
      {[1, 2, 3, 4, 5].map((i) => {
        const inCell = cells[`${p}_${i}`] || [];
        return (
          <div
            key={i}
            title={inCell.map((r) => `${r.nom} (${r.cat})`).join("\n")}
            style={{
              minHeight: 34,
              background: cellBg(p, i),
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 3,
              padding: 3,
            }}
          >
            {inCell.map((r, k) => (
              <span
                key={k}
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: RISK_CATEGORIES[r.cat] || "#7f8fa6",
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}
