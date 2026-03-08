export function SidebarDetailModal({ data, onClose, countries }) {
  if (!data) return null;

  const EVENT_META = {
    POLITICAL_RISK:  { color: "#ff2d6f", icon: "?", label: "Risque Politique",     desc: "Instabilité gouvernementale, élections, coups d'état ou tensions sécuritaires affectant les flux commerciaux." },
    PORT_DISRUPTION: { color: "#ffb020", icon: "?", label: "Perturbation Portuaire",desc: "Grève, incident technique, congestion ou fermeture temporaire d'un port majeur." },
    STRIKE:          { color: "#f0b429", icon: "?", label: "Grève / Arrêt de travail",desc: "Mouvement social affectant la logistique, les douanes ou les opérations portuaires." },
    COMMODITY_SURGE: { color: "#00d4ff", icon: "??", label: "Flambée de matières premières",desc: "Hausse soudaine du prix d'une matière première clé exportée par ce pays." },
    POLICY_CHANGE:   { color: "#00d4ff", icon: "??", label: "Changement de politique",desc: "Nouvelle réglementation douanière, fiscale ou commerciale impactant les échanges." },
  };

  const EXCHANGE_INFO = {
    NGX:  { flag: "????", country: "Nigeria",        fullName: "Nigerian Exchange Group",        desc: "La plus grande bourse d'Afrique subsaharienne par capitalisation. Secteurs dominants : banque, pétrole, ciment, télécoms." },
    GSE:  { flag: "????", country: "Ghana",           fullName: "Ghana Stock Exchange",           desc: "Bourse de référence en Afrique de l'Ouest anglophone. Secteurs : or, cacao, banque, mines." },
    BRVM: { flag: "??",  country: "CEDEAO (8 pays)", fullName: "Bourse Régionale des Valeurs Mobilières", desc: "Bourse commune à 8 pays UEMOA (CI, SN, BJ, TG, ML, BF, NE, GN). Siège à Abidjan. Secteurs : banque, agroalimentaire, télécoms." },
  };
  const COMMODITY_INFO = {
    COCOA: {
      label: "Cacao",
      color: "#f0b429",
      importance: "Produit clé pour CI, GH, NG et plusieurs chaînes de valeur régionales.",
    },
    GOLD: {
      label: "Or",
      color: "#f0b429",
      importance: "Matière stratégique pour BF, ML et GH avec fort impact devises.",
    },
    BRENT: {
      label: "Brent",
      color: "#00d4ff",
      importance: "Référence énergie importée pour le coût logistique régional.",
    },
    COTTON: {
      label: "Coton",
      color: "#00ff84",
      importance: "Export agricole majeur pour BF, ML, BJ et TG.",
    },
    COFFEE: {
      label: "Café",
      color: "#00ff84",
      importance: "Produit d'export transformable à forte valeur ajoutée locale.",
    },
    IRON_ORE: {
      label: "Minerai de fer",
      color: "#7f8fa6",
      importance: "Indicateur du cycle industriel et des flux vrac.",
    },
  };
  const SECURITY_INFO = {
    SOLIBRA: {
      issuer: "Solibra Cote d'Ivoire",
      sector: "Consumer / Beverages",
      country: "Cote d'Ivoire",
      hq: "Abidjan",
      thesis: "Defensive consumer name with stable domestic demand and pricing resilience.",
    },
    SGBCI: {
      issuer: "Societe Generale Cote d'Ivoire",
      sector: "Financials / Banking",
      country: "Cote d'Ivoire",
      hq: "Abidjan",
      thesis: "Tier-1 banking franchise leveraged to WAEMU credit expansion.",
    },
    ONTBF: {
      issuer: "ONATEL Burkina Faso",
      sector: "Telecom",
      country: "Burkina Faso",
      hq: "Ouagadougou",
      thesis: "Cash-generative telecom asset with recurring consumer and enterprise traffic.",
    },
    SNTS: {
      issuer: "Sonatel Senegal",
      sector: "Telecom",
      country: "Senegal",
      hq: "Dakar",
      thesis: "Regional telecom leader with strong mobile money and data monetization.",
    },
    TTLS: {
      issuer: "Total Senegal",
      sector: "Energy Distribution",
      country: "Senegal",
      hq: "Dakar",
      thesis: "Downstream energy proxy with demand linked to logistics and mobility cycle.",
    },
    BICC: {
      issuer: "BICICI",
      sector: "Financials / Banking",
      country: "Cote d'Ivoire",
      hq: "Abidjan",
      thesis: "Established lending institution exposed to formalization of regional commerce.",
    },
    PALC: {
      issuer: "Palm CI",
      sector: "Agri / Consumer Staples",
      country: "Cote d'Ivoire",
      hq: "Abidjan",
      thesis: "Agri-linked staple producer benefiting from domestic food demand.",
    },
    EXIT: {
      issuer: "Ecobank Transnational",
      sector: "Financials / Banking",
      country: "Togo",
      hq: "Lome",
      thesis: "Pan-African banking network with broad cross-border transaction footprint.",
    },
    DANGCEM: {
      issuer: "Dangote Cement",
      sector: "Materials / Cement",
      country: "Nigeria",
      hq: "Lagos",
      thesis: "Infrastructure demand bellwether with scale advantages in the regional cement chain.",
    },
    GTCO: {
      issuer: "GTCO Holdings",
      sector: "Financials / Banking",
      country: "Nigeria",
      hq: "Lagos",
      thesis: "High-quality banking franchise with efficient balance sheet and fee income depth.",
    },
    AIRTEL: {
      issuer: "Airtel Africa",
      sector: "Telecom",
      country: "Nigeria",
      hq: "Lagos",
      thesis: "Data and fintech adoption play with multi-country operating leverage.",
    },
    MTNN: {
      issuer: "MTN Nigeria",
      sector: "Telecom",
      country: "Nigeria",
      hq: "Lagos",
      thesis: "Core telecom backbone with strong subscriber base and service monetization.",
    },
  };

  const parseVolumeUnits = (raw) => {
    const text = String(raw || "").trim().toUpperCase();
    const match = text.match(/^([\d.,]+)\s*([KM]?)$/);
    if (!match) return null;
    const base = Number(match[1].replace(",", "."));
    if (!Number.isFinite(base)) return null;
    if (match[2] === "M") return Math.round(base * 1_000_000);
    if (match[2] === "K") return Math.round(base * 1_000);
    return Math.round(base);
  };

  if (data.type === "market") {
    const m = data.market;
    const up = m.change_pct >= 0;
    const color = up ? "#00ff84" : "#ff2d6f";
    const info = EXCHANGE_INFO[m.exchange_code] || {};
    const ytdUp = (m.ytd_change_pct || 0) >= 0;
    const ytdColor = ytdUp ? "#00ff84" : "#ff2d6f";
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(3,13,26,0.93)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={onClose}>
        <div style={{ background: "#060b16", border: `1px solid ${color}55`, borderRadius: 8, width: "100%", maxWidth: 600, padding: 40 }} onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${color}33` }}>
            <div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, color: color, letterSpacing: 4 }}>{info.flag} {m.exchange_code}</div>
              <div style={{ fontSize: 16, color: "#7f8fa6", marginTop: 4 }}>{info.fullName}</div>
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
                <div style={{ fontSize: 14, color: "#7f8fa6", letterSpacing: 2, marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: 30, fontFamily: "'Bebas Neue',sans-serif", color: s.color, letterSpacing: 2 }}>{s.val}</div>
              </div>
            ))}
          </div>
          {/* Secondary stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
            {[
              { label: "CAPITALISATION BOURSIÈRE", val: `${(m.market_cap_usd / 1e9).toFixed(1)} Mrd USD`, color: "#00d4ff" },
              { label: "NOM DE L'INDICE", val: m.index_name, color: "#00d4ff" },
              { label: "CODE DE LA BOURSE", val: m.exchange_code, color: "#f0b429" },
              { label: "PAYS / RÉGION", val: info.country, color: "#00ff84" },
            ].map((s, i) => (
              <div key={i} style={{ padding: "18px 22px", background: "rgba(15,42,69,0.4)", border: "1px solid #1a2845", borderRadius: 6 }}>
                <div style={{ fontSize: 14, color: "#7f8fa6", letterSpacing: 2, marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontFamily: "'Bebas Neue',sans-serif", color: s.color, letterSpacing: 2 }}>{s.val}</div>
              </div>
            ))}
          </div>
          {/* Description */}
          <div style={{ padding: "16px 18px", background: "rgba(15,42,69,0.3)", borderRadius: 6, border: `1px solid #1a284588`, fontSize: 16, color: "#7f8fa6", lineHeight: 1.9 }}>
            <strong style={{ color: color }}>À propos de {m.exchange_code} :</strong><br />
            {info.desc}
          </div>
        </div>
      </div>
    );
  }

  if (data.type === "event") {
    const e = data.event;
    const meta = EVENT_META[e.event_type] || { color: "#00d4ff", icon: "?", label: e.event_type, desc: "" };
    const country = (countries || []).find(c => c.code === e.country_code) || { name: e.country_code, flag: "??" };
    const expiresAt = new Date(e.expires_at);
    const now = new Date();
    const hoursLeft = Math.max(0, Math.round((expiresAt - now) / 36e5));
    const daysLeft = Math.floor(hoursLeft / 24);
    const timeLeft = daysLeft > 0 ? `${daysLeft}j ${hoursLeft % 24}h` : `${hoursLeft}h`;
    const impactSign = e.magnitude >= 0 ? "+" : "";
    const impactColor = e.magnitude >= 0 ? "#00ff84" : "#ff2d6f";
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(3,13,26,0.93)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={onClose}>
        <div style={{ background: "#060b16", border: `1px solid ${meta.color}55`, borderRadius: 8, width: "100%", maxWidth: 600, padding: 40 }} onClick={e2 => e2.stopPropagation()}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${meta.color}33` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 42 }}>{meta.icon}</span>
              <div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: meta.color, letterSpacing: 4 }}>{meta.label}</div>
                <div style={{ fontSize: 16, color: "#7f8fa6", marginTop: 2 }}>{country.flag} {country.name} · Signal WASI RSS</div>
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
              { label: "CODE PAYS", val: `${country.flag} ${e.country_code}`, color: "#00d4ff" },
            ].map((s, i) => (
              <div key={i} style={{ padding: "18px 22px", background: "rgba(15,42,69,0.5)", border: `1px solid ${s.color}33`, borderRadius: 6 }}>
                <div style={{ fontSize: 14, color: "#7f8fa6", letterSpacing: 2, marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: 30, fontFamily: "'Bebas Neue',sans-serif", color: s.color, letterSpacing: 2 }}>{s.val}</div>
              </div>
            ))}
          </div>
          {/* Expiry + source */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
            <div style={{ padding: "18px 22px", background: "rgba(15,42,69,0.4)", border: "1px solid #1a2845", borderRadius: 6 }}>
              <div style={{ fontSize: 14, color: "#7f8fa6", letterSpacing: 2, marginBottom: 6 }}>EXPIRE LE</div>
              <div style={{ fontSize: 18, color: "#e2e8f0" }}>{expiresAt.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
            </div>
            <div style={{ padding: "18px 22px", background: "rgba(15,42,69,0.4)", border: "1px solid #1a2845", borderRadius: 6 }}>
              <div style={{ fontSize: 14, color: "#7f8fa6", letterSpacing: 2, marginBottom: 6 }}>SOURCE</div>
              <div style={{ fontSize: 18, color: "#00d4ff" }}>{e.source || "RSS BBC Africa / Reuters Africa"}</div>
            </div>
          </div>
          {/* Explanation */}
          <div style={{ padding: "16px 18px", background: "rgba(15,42,69,0.3)", borderRadius: 6, border: "1px solid #1a284588", fontSize: 16, color: "#7f8fa6", lineHeight: 1.9 }}>
            <strong style={{ color: meta.color }}>Qu'est-ce que "{meta.label}" ?</strong><br />
            {meta.desc}<br /><br />
            <strong style={{ color: "#7f8fa6" }}>Impact sur le score WASI :</strong> L'indice de {country.name} est ajusté de <strong style={{ color: impactColor }}>{impactSign}{e.magnitude} points</strong> jusqu'à expiration du signal. L'ajustement est capé à ±25 pts pour éviter les distorsions.
          </div>
        </div>
      </div>
    );
  }

  if (data.type === "security") {
    const s = data.security || {};
    const up = Number(s.pct || 0) >= 0;
    const color = up ? "#00ff84" : "#ff2d6f";
    const info = SECURITY_INFO[s.ticker] || {
      issuer: s.name || s.ticker || "Issuer",
      sector: "N/A",
      country: "N/A",
      hq: "N/A",
      thesis: "No qualitative note yet for this security.",
    };

    const last = Number(s.last || 0);
    const chg = Number(s.chg || 0);
    const pct = Number(s.pct || 0);
    const volumeUnits = parseVolumeUnits(s.vol);
    const turnover = volumeUnits ? last * volumeUnits : null;
    const liquidity = volumeUnits === null ? "N/A" : volumeUnits > 2_000_000 ? "HIGH" : volumeUnits > 250_000 ? "MEDIUM" : "LOW";
    const risk = Math.abs(pct) > 2 ? "ELEVATED" : Math.abs(pct) > 1 ? "MODERATE" : "LOW";
    const marketUp = Number(s.market_change_pct || 0) >= 0;

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(3,13,26,0.95)",
          zIndex: 420,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
        onClick={onClose}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 1120,
            maxHeight: "92vh",
            overflowY: "auto",
            background: "#060b16",
            border: `1px solid ${color}55`,
            borderRadius: 8,
            padding: "18px 18px 20px",
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <div style={{ color: "#00ff84", fontSize: 12, letterSpacing: 2 }}>WASI TERMINAL - SECURITY DETAIL</div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 34, letterSpacing: 3, color }}>{s.ticker || "N/A"}</div>
              <div style={{ color: "#7f8fa6", fontSize: 14 }}>{info.issuer} · {s.exchange_code || "N/A"} · {info.country}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: `1px solid ${color}55`,
                color,
                background: "transparent",
                padding: "8px 14px",
                borderRadius: 6,
                cursor: "pointer",
                fontFamily: "'Space Mono', monospace",
              }}
            >
              RETOUR
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 10 }}>
            <div style={{ border: "1px solid #1a2845", background: "rgba(10,22,40,0.65)", padding: 12, borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: "#7f8fa6", letterSpacing: 1 }}>LAST PRICE</div>
              <div style={{ fontSize: 30, color: "#e2e8f0", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 2 }}>
                {last.toLocaleString("fr-FR")}
              </div>
            </div>
            <div style={{ border: `1px solid ${color}33`, background: "rgba(10,22,40,0.65)", padding: 12, borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: "#7f8fa6", letterSpacing: 1 }}>DAILY CHANGE</div>
              <div style={{ fontSize: 30, color, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 2 }}>
                {chg >= 0 ? "+" : ""}{chg.toLocaleString("fr-FR")}
              </div>
            </div>
            <div style={{ border: `1px solid ${color}33`, background: "rgba(10,22,40,0.65)", padding: 12, borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: "#7f8fa6", letterSpacing: 1 }}>% CHANGE</div>
              <div style={{ fontSize: 30, color, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 2 }}>
                {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
              </div>
            </div>
            <div style={{ border: "1px solid #1a2845", background: "rgba(10,22,40,0.65)", padding: 12, borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: "#7f8fa6", letterSpacing: 1 }}>VOLUME</div>
              <div style={{ fontSize: 30, color: "#00d4ff", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 2 }}>
                {s.vol || "N/A"}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div style={{ border: "1px solid #1a2845", background: "rgba(10,22,40,0.6)", padding: 12, borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: "#f0b429", letterSpacing: 2, marginBottom: 8 }}>ISSUER PROFILE</div>
              <div style={{ color: "#7f8fa6", fontSize: 14, lineHeight: 1.8 }}>
                <div><span style={{ color: "#7f8fa6" }}>Sector:</span> {info.sector}</div>
                <div><span style={{ color: "#7f8fa6" }}>Country:</span> {info.country}</div>
                <div><span style={{ color: "#7f8fa6" }}>HQ:</span> {info.hq}</div>
              </div>
              <div style={{ marginTop: 10, fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>{info.thesis}</div>
            </div>

            <div style={{ border: "1px solid #1a2845", background: "rgba(10,22,40,0.6)", padding: 12, borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: "#00d4ff", letterSpacing: 2, marginBottom: 8 }}>MARKET CONTEXT</div>
              <div style={{ color: "#7f8fa6", fontSize: 14, lineHeight: 1.8 }}>
                <div><span style={{ color: "#7f8fa6" }}>Exchange:</span> {s.exchange_code || "N/A"}</div>
                <div><span style={{ color: "#7f8fa6" }}>Index:</span> {s.market_symbol || "N/A"}</div>
                <div><span style={{ color: "#7f8fa6" }}>Index level:</span> {s.market_index_value != null ? Number(s.market_index_value).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : "N/A"}</div>
                <div>
                  <span style={{ color: "#7f8fa6" }}>Index change:</span>{" "}
                  <span style={{ color: marketUp ? "#00ff84" : "#ff2d6f" }}>
                    {Number(s.market_change_pct || 0) >= 0 ? "+" : ""}{Number(s.market_change_pct || 0).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            <div style={{ border: "1px solid #1a2845", background: "rgba(10,22,40,0.6)", padding: 12, borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: "#00d4ff", letterSpacing: 2, marginBottom: 8 }}>RISK & FLOW</div>
              <div style={{ color: "#7f8fa6", fontSize: 14, lineHeight: 1.8 }}>
                <div>
                  <span style={{ color: "#7f8fa6" }}>Liquidity:</span>{" "}
                  <span style={{ color: liquidity === "HIGH" ? "#00ff84" : liquidity === "MEDIUM" ? "#f0b429" : "#ff2d6f" }}>{liquidity}</span>
                </div>
                <div>
                  <span style={{ color: "#7f8fa6" }}>Day risk:</span>{" "}
                  <span style={{ color: risk === "LOW" ? "#00ff84" : risk === "MODERATE" ? "#f0b429" : "#ff2d6f" }}>{risk}</span>
                </div>
                <div><span style={{ color: "#7f8fa6" }}>Turnover (est.):</span> {turnover ? turnover.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) : "N/A"}</div>
              </div>
            </div>
          </div>

          <div style={{ border: "1px solid #1a2845", background: "rgba(10,22,40,0.55)", borderRadius: 6, padding: 12 }}>
            <div style={{ fontSize: 12, color: "#f0b429", letterSpacing: 2, marginBottom: 8 }}>TRADING READ</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div style={{ color: "#7f8fa6", fontSize: 13, lineHeight: 1.7 }}>
                <div style={{ color: "#7f8fa6" }}>Momentum</div>
                <div style={{ color }}>{pct >= 0 ? "Positive" : "Negative"} ({Math.abs(pct).toFixed(2)}%)</div>
              </div>
              <div style={{ color: "#7f8fa6", fontSize: 13, lineHeight: 1.7 }}>
                <div style={{ color: "#7f8fa6" }}>Flow quality</div>
                <div>{volumeUnits ? `${volumeUnits.toLocaleString("fr-FR")} units` : "Volume format pending"}</div>
              </div>
              <div style={{ color: "#7f8fa6", fontSize: 13, lineHeight: 1.7 }}>
                <div style={{ color: "#7f8fa6" }}>Regime</div>
                <div style={{ color: marketUp ? "#00ff84" : "#ff2d6f" }}>{marketUp ? "Risk-on market" : "Risk-off market"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (data.type === "commodity") {
    const c = data.commodity || {};
    const info = COMMODITY_INFO[c.code] || {
      label: c.name || c.code || "Commodity",
      color: "#f0b429",
      importance: "Indicateur de prix utile pour l'analyse commerciale régionale.",
    };
    const mom = typeof c.mom_pct === "number" ? c.mom_pct : null;
    const yoy = typeof c.yoy_pct === "number" ? c.yoy_pct : null;
    const trendColor = mom === null ? "#7f8fa6" : mom >= 0 ? "#00ff84" : "#ff2d6f";
    const formatPct = (value) => (value === null ? "N/A" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`);

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(3,13,26,0.93)",
          zIndex: 400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: "#060b16",
            border: `1px solid ${info.color}55`,
            borderRadius: 8,
            width: "100%",
            maxWidth: 620,
            padding: 32,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 22,
              paddingBottom: 14,
              borderBottom: `1px solid ${info.color}33`,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'Bebas Neue',sans-serif",
                  fontSize: 30,
                  color: info.color,
                  letterSpacing: 3,
                }}
              >
                {c.code || "COM"} - {info.label}
              </div>
              <div style={{ fontSize: 14, color: "#7f8fa6", marginTop: 3 }}>
                Cours matière première
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "none",
                border: `1px solid ${info.color}44`,
                color: info.color,
                padding: "8px 16px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 14,
                fontFamily: "'Space Mono',monospace",
              }}
            >
              FERMER
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 18 }}>
            <div style={{ padding: "14px 16px", background: "rgba(15,42,69,0.5)", border: "1px solid #1a2845", borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: "#7f8fa6", letterSpacing: 1 }}>PRIX ACTUEL</div>
              <div style={{ fontSize: 28, fontFamily: "'Bebas Neue',sans-serif", color: "#e2e8f0", letterSpacing: 2 }}>
                {Number(c.price_usd || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 12, color: "#7f8fa6" }}>{c.unit || "USD/unit"}</div>
            </div>
            <div style={{ padding: "14px 16px", background: "rgba(15,42,69,0.5)", border: "1px solid #1a2845", borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: "#7f8fa6", letterSpacing: 1 }}>VARIATION MoM</div>
              <div style={{ fontSize: 28, fontFamily: "'Bebas Neue',sans-serif", color: trendColor, letterSpacing: 2 }}>
                {formatPct(mom)}
              </div>
            </div>
            <div style={{ padding: "14px 16px", background: "rgba(15,42,69,0.5)", border: "1px solid #1a2845", borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: "#7f8fa6", letterSpacing: 1 }}>VARIATION YoY</div>
              <div style={{ fontSize: 28, fontFamily: "'Bebas Neue',sans-serif", color: yoy === null ? "#7f8fa6" : yoy >= 0 ? "#00ff84" : "#ff2d6f", letterSpacing: 2 }}>
                {formatPct(yoy)}
              </div>
            </div>
          </div>

          <div style={{ padding: "14px 16px", background: "rgba(15,42,69,0.35)", border: "1px solid #1a2845", borderRadius: 6 }}>
            <div style={{ fontSize: 13, color: info.color, letterSpacing: 2, marginBottom: 6 }}>LECTURE RAPIDE</div>
            <div style={{ fontSize: 14, color: "#7f8fa6", lineHeight: 1.7 }}>
              {info.importance}
              <br />
              Période des données: <span style={{ color: "#e2e8f0" }}>{c.period || "N/A"}</span>.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}



