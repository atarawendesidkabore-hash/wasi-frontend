export function SidebarDetailModal({ data, onClose, countries }) {
  if (!data) return null;

  const EVENT_META = {
    POLITICAL_RISK:  { color: "#ef4444", icon: "?", label: "Risque Politique",     desc: "Instabilité gouvernementale, élections, coups d'état ou tensions sécuritaires affectant les flux commerciaux." },
    PORT_DISRUPTION: { color: "#f97316", icon: "?", label: "Perturbation Portuaire",desc: "Grève, incident technique, congestion ou fermeture temporaire d'un port majeur." },
    STRIKE:          { color: "#f0b429", icon: "?", label: "Grève / Arrêt de travail",desc: "Mouvement social affectant la logistique, les douanes ou les opérations portuaires." },
    COMMODITY_SURGE: { color: "#a78bfa", icon: "??", label: "Flambée de matières premières",desc: "Hausse soudaine du prix d'une matière première clé exportée par ce pays." },
    POLICY_CHANGE:   { color: "#38bdf8", icon: "??", label: "Changement de politique",desc: "Nouvelle réglementation douanière, fiscale ou commerciale impactant les échanges." },
  };

  const EXCHANGE_INFO = {
    NGX:  { flag: "????", country: "Nigeria",        fullName: "Nigerian Exchange Group",        desc: "La plus grande bourse d'Afrique subsaharienne par capitalisation. Secteurs dominants : banque, pétrole, ciment, télécoms." },
    GSE:  { flag: "????", country: "Ghana",           fullName: "Ghana Stock Exchange",           desc: "Bourse de référence en Afrique de l'Ouest anglophone. Secteurs : or, cacao, banque, mines." },
    BRVM: { flag: "??",  country: "CEDEAO (8 pays)", fullName: "Bourse Régionale des Valeurs Mobilières", desc: "Bourse commune à 8 pays UEMOA (CI, SN, BJ, TG, ML, BF, NE, GN). Siège à Abidjan. Secteurs : banque, agroalimentaire, télécoms." },
  };

  if (data.type === "market") {
    const m = data.market;
    const up = m.change_pct >= 0;
    const color = up ? "#4ade80" : "#ef4444";
    const info = EXCHANGE_INFO[m.exchange_code] || {};
    const ytdUp = (m.ytd_change_pct || 0) >= 0;
    const ytdColor = ytdUp ? "#4ade80" : "#ef4444";
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(3,13,26,0.93)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={onClose}>
        <div style={{ background: "#07192e", border: `1px solid ${color}55`, borderRadius: 8, width: "100%", maxWidth: 600, padding: 40 }} onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${color}33` }}>
            <div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, color: color, letterSpacing: 4 }}>{info.flag} {m.exchange_code}</div>
              <div style={{ fontSize: 16, color: "#94a3b8", marginTop: 4 }}>{info.fullName}</div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: `1px solid ${color}44`, color: color, padding: "8px 18px", borderRadius: 6, cursor: "pointer", fontSize: 16, fontFamily: "'Space Mono',monospace", letterSpacing: 1 }}>? FERMER</button>
          </div>
          {/* Main value */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 24 }}>
            {[
              { label: "VALEUR DE L'INDICE", val: m.index_value.toLocaleString("fr-FR", { maximumFractionDigits: 2 }), color: "#e2e8f0", big: true },
              { label: "VARIATION JOURNALIÈRE", val: `${up ? "?" : "?"} ${Math.abs(m.change_pct).toFixed(2)}%`, color: color, big: true },
              { label: "PERFORMANCE YTD", val: `${ytdUp ? "+" : ""}${m.ytd_change_pct?.toFixed(1)}%`, color: ytdColor, big: true },
            ].map((s, i) => (
              <div key={i} style={{ padding: "18px 22px", background: "rgba(15,42,69,0.5)", border: `1px solid ${s.color}33`, borderRadius: 6 }}>
                <div style={{ fontSize: 14, color: "#94a3b8", letterSpacing: 2, marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: 30, fontFamily: "'Bebas Neue',sans-serif", color: s.color, letterSpacing: 2 }}>{s.val}</div>
              </div>
            ))}
          </div>
          {/* Secondary stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
            {[
              { label: "CAPITALISATION BOURSIÈRE", val: `${(m.market_cap_usd / 1e9).toFixed(1)} Mrd USD`, color: "#a78bfa" },
              { label: "NOM DE L'INDICE", val: m.index_name, color: "#38bdf8" },
              { label: "CODE DE LA BOURSE", val: m.exchange_code, color: "#f0b429" },
              { label: "PAYS / RÉGION", val: info.country, color: "#4ade80" },
            ].map((s, i) => (
              <div key={i} style={{ padding: "18px 22px", background: "rgba(15,42,69,0.4)", border: "1px solid #0f2a45", borderRadius: 6 }}>
                <div style={{ fontSize: 14, color: "#94a3b8", letterSpacing: 2, marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontFamily: "'Bebas Neue',sans-serif", color: s.color, letterSpacing: 2 }}>{s.val}</div>
              </div>
            ))}
          </div>
          {/* Description */}
          <div style={{ padding: "16px 18px", background: "rgba(15,42,69,0.3)", borderRadius: 6, border: `1px solid #0f2a4588`, fontSize: 16, color: "#94a3b8", lineHeight: 1.9 }}>
            <strong style={{ color: color }}>À propos de {m.exchange_code} :</strong><br />
            {info.desc}
          </div>
        </div>
      </div>
    );
  }

  if (data.type === "event") {
    const e = data.event;
    const meta = EVENT_META[e.event_type] || { color: "#38bdf8", icon: "?", label: e.event_type, desc: "" };
    const country = (countries || []).find(c => c.code === e.country_code) || { name: e.country_code, flag: "??" };
    const expiresAt = new Date(e.expires_at);
    const now = new Date();
    const hoursLeft = Math.max(0, Math.round((expiresAt - now) / 36e5));
    const daysLeft = Math.floor(hoursLeft / 24);
    const timeLeft = daysLeft > 0 ? `${daysLeft}j ${hoursLeft % 24}h` : `${hoursLeft}h`;
    const impactSign = e.magnitude >= 0 ? "+" : "";
    const impactColor = e.magnitude >= 0 ? "#4ade80" : "#ef4444";
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(3,13,26,0.93)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={onClose}>
        <div style={{ background: "#07192e", border: `1px solid ${meta.color}55`, borderRadius: 8, width: "100%", maxWidth: 600, padding: 40 }} onClick={e2 => e2.stopPropagation()}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${meta.color}33` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 42 }}>{meta.icon}</span>
              <div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: meta.color, letterSpacing: 4 }}>{meta.label}</div>
                <div style={{ fontSize: 16, color: "#94a3b8", marginTop: 2 }}>{country.flag} {country.name} · Signal WASI RSS</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: `1px solid ${meta.color}44`, color: meta.color, padding: "8px 18px", borderRadius: 6, cursor: "pointer", fontSize: 16, fontFamily: "'Space Mono',monospace", letterSpacing: 1 }}>? FERMER</button>
          </div>
          {/* Headline */}
          <div style={{ padding: "18px 20px", background: `${meta.color}0d`, border: `1px solid ${meta.color}44`, borderRadius: 6, marginBottom: 20 }}>
            <div style={{ fontSize: 14, color: meta.color, letterSpacing: 2, marginBottom: 8 }}>TITRE DE L'ÉVÉNEMENT</div>
            <div style={{ fontSize: 20, color: "#e2e8f0", lineHeight: 1.7, fontWeight: 600 }}>{e.headline}</div>
          </div>
          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
            {[
              { label: "IMPACT SUR L'INDICE", val: `${impactSign}${e.magnitude} pts`, color: impactColor },
              { label: "DURÉE RESTANTE", val: timeLeft, color: "#f0b429" },
              { label: "CODE PAYS", val: `${country.flag} ${e.country_code}`, color: "#38bdf8" },
            ].map((s, i) => (
              <div key={i} style={{ padding: "18px 22px", background: "rgba(15,42,69,0.5)", border: `1px solid ${s.color}33`, borderRadius: 6 }}>
                <div style={{ fontSize: 14, color: "#94a3b8", letterSpacing: 2, marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: 30, fontFamily: "'Bebas Neue',sans-serif", color: s.color, letterSpacing: 2 }}>{s.val}</div>
              </div>
            ))}
          </div>
          {/* Expiry + source */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
            <div style={{ padding: "18px 22px", background: "rgba(15,42,69,0.4)", border: "1px solid #0f2a45", borderRadius: 6 }}>
              <div style={{ fontSize: 14, color: "#94a3b8", letterSpacing: 2, marginBottom: 6 }}>EXPIRE LE</div>
              <div style={{ fontSize: 18, color: "#e2e8f0" }}>{expiresAt.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
            </div>
            <div style={{ padding: "18px 22px", background: "rgba(15,42,69,0.4)", border: "1px solid #0f2a45", borderRadius: 6 }}>
              <div style={{ fontSize: 14, color: "#94a3b8", letterSpacing: 2, marginBottom: 6 }}>SOURCE</div>
              <div style={{ fontSize: 18, color: "#38bdf8" }}>{e.source || "RSS BBC Africa / Reuters Africa"}</div>
            </div>
          </div>
          {/* Explanation */}
          <div style={{ padding: "16px 18px", background: "rgba(15,42,69,0.3)", borderRadius: 6, border: "1px solid #0f2a4588", fontSize: 16, color: "#94a3b8", lineHeight: 1.9 }}>
            <strong style={{ color: meta.color }}>Qu'est-ce que "{meta.label}" ?</strong><br />
            {meta.desc}<br /><br />
            <strong style={{ color: "#94a3b8" }}>Impact sur le score WASI :</strong> L'indice de {country.name} est ajusté de <strong style={{ color: impactColor }}>{impactSign}{e.magnitude} points</strong> jusqu'à expiration du signal. L'ajustement est capé à ±25 pts pour éviter les distorsions.
          </div>
        </div>
      </div>
    );
  }

  return null;
}

