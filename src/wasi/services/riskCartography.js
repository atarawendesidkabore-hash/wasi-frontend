/**
 * WASI Risk Cartography — probability x impact risk mapping per country.
 *
 * Ported from the WASI platform (wasi-platform/wasi-ai-integration.js) so both
 * applications assess country risk the same way.
 *
 * Two layers, by design:
 *
 *  1. LOCAL (always available, works offline). Derived from this app's own
 *     COUNTRY_TRADE_DATA: export concentration computed from the per-category
 *     export values, GDP growth, currency regime, partner dependency, and the
 *     hand-written `risks` list — which holds local knowledge no formula
 *     reaches ("Conflits Delta du Niger") and is therefore never discarded.
 *
 *  2. LIVE (enrichment, degrades silently). The platform publishes three files
 *     that CI refreshes daily — World Bank macros, the legislative news watch,
 *     and AFEX export profiles. GitHub Pages serves them with
 *     Access-Control-Allow-Origin: *, so this app can read the same single
 *     source of truth rather than keeping a fourth copy of the data.
 *
 * Probability and impact are on the platform's existing 1-5 scale, and every
 * derived risk carries the figure that triggered it so a reader can check the
 * reasoning instead of trusting a dot.
 */

const PLATFORM_BASE = "https://atarawendesidkabore-hash.github.io/wasi-platform/data";

export const RISK_CATEGORIES = {
  Politique: "#448AFF",
  Macro: "#FF9100",
  "Sécurité": "#FF5252",
  "Marché": "#C8922A",
  "Conformité": "#18FFFF",
};

// XOF and XAF are pegged to the euro, which materially lowers FX risk.
const PEGGED = /^(XOF|XAF)$/i;

let livePromise = null;

/** Fetches the platform's daily data once per session; never throws. */
export function loadLiveRiskData() {
  if (livePromise) return livePromise;

  const get = (name) =>
    fetch(`${PLATFORM_BASE}/${name}?v=${Date.now()}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

  livePromise = Promise.all([
    get("country-macros.json"),
    get("legal-news.json"),
    get("afex-profiles.json"),
  ]).then(([macros, legal, afex]) => {
    // AFEX profiles are keyed by fund code and carry iso3; the macros file
    // pairs iso2 with iso3, so it becomes the join table. No separate lookup
    // map that could drift.
    const byIso2 = {};
    if (macros && macros.countries && afex && afex.countries) {
      const iso3ToIso2 = {};
      Object.keys(macros.countries).forEach((iso2) => {
        const iso3 = macros.countries[iso2].iso3;
        if (iso3) iso3ToIso2[iso3] = iso2;
      });
      Object.keys(afex.countries).forEach((fund) => {
        const p = afex.countries[fund];
        const iso2 = iso3ToIso2[p.iso3];
        if (iso2) byIso2[iso2] = { ...p, fundCode: fund };
      });
    }
    return { macros, legal, afexByIso2: byIso2, fetchedAt: macros?.fetchedAt || null };
  });

  return livePromise;
}

/** Herfindahl-Hirschman index over this app's own export categories. */
function localHhi(exports) {
  if (!Array.isArray(exports) || !exports.length) return null;
  const total = exports.reduce((s, e) => s + (e.val || 0), 0);
  if (!total) return null;
  const shares = exports.map((e) => ((e.val || 0) / total) * 100);
  return {
    hhi: Math.round(shares.reduce((s, x) => s + x * x, 0)),
    top1: +Math.max(...shares).toFixed(2),
    lead: exports.reduce((a, b) => ((b.val || 0) > (a.val || 0) ? b : a)).cat,
  };
}

/**
 * Classifies an expert-written risk sentence into a category and severity.
 * Deliberately conservative: an unrecognised sentence keeps a middling
 * probability rather than being dropped or dramatised.
 */
function classifyExpertRisk(text) {
  const t = String(text).toLowerCase();
  const has = (...words) => words.some((w) => t.includes(w));

  if (has("conflit", "insécurité", "insecurite", "terroris", "sécurité", "securite", "delta du niger"))
    return { cat: "Sécurité", prob: 4, impact: 4 };
  if (has("coup", "putsch", "transition", "instabilité politique", "instabilite politique", "gouvernance"))
    return { cat: "Politique", prob: 4, impact: 4 };
  if (has("naira", "devise", "change", "monétaire", "monetaire", "inflation", "dette", "budget"))
    return { cat: "Macro", prob: 4, impact: 3 };
  if (has("dépendance", "dependance", "volatilité", "volatilite", "prix", "cours", "marché", "marche", "concentration"))
    return { cat: "Marché", prob: 4, impact: 3 };
  if (has("réglement", "reglement", "douane", "fiscal", "corruption", "juridique", "administrat"))
    return { cat: "Conformité", prob: 3, impact: 3 };
  if (has("infrastructure", "route", "port", "électricité", "electricite", "énergie", "energie", "logistique"))
    return { cat: "Marché", prob: 4, impact: 3 };
  return { cat: "Macro", prob: 3, impact: 3 };
}

/**
 * Builds the cartography for one country.
 * @param {{code:string, name:string, td:object, live:object|null}} input
 * @returns {Array<{nom:string,cat:string,prob:number,impact:number,source:string,origin:string}>}
 */
export function buildRiskCartography({ code, name, td, live }) {
  const out = [];
  const add = (nom, cat, prob, impact, source, origin) =>
    out.push({ nom, cat, prob, impact, source, origin });

  const macro = live?.macros?.countries?.[code] || null;
  const news = live?.legal?.countries?.[code] || null;
  const afex = live?.afexByIso2?.[code] || null;

  // ── 1. Expert risks from this app's own data (never discarded) ──────────
  (td?.risks || []).forEach((text) => {
    const c = classifyExpertRisk(text);
    add(text, c.cat, c.prob, c.impact, "Analyse WASI", "expert");
  });

  // ── 2. Export concentration ────────────────────────────────────────────
  // Prefers the platform's 10-year Comtrade figure; falls back to the HHI
  // computed from this app's own export values so it works offline too.
  const conc = afex?.concentration
    ? { hhi: afex.concentration.hhi, top1: afex.concentration.top1_pct,
        lead: afex.constituents?.[0]?.name || "premier poste",
        src: `UN Comtrade (HHI ${afex.concentration.hhi})` }
    : (() => {
        const l = localHhi(td?.exports);
        return l ? { ...l, src: `Données WASI (HHI ${l.hhi})` } : null;
      })();

  if (conc) {
    if (conc.hhi >= 7500)
      add(`Mono-exportateur : ${conc.lead} = ${conc.top1}% des exports`, "Marché", 5, 5, conc.src, "derived");
    else if (conc.hhi >= 5500)
      add(`Panier d'exportation très concentré (${conc.lead} ${conc.top1}%)`, "Marché", 4, 4, conc.src, "derived");
    else if (conc.hhi >= 3600)
      add(`Concentration des exportations (${conc.lead} ${conc.top1}%)`, "Marché", 3, 4, conc.src, "derived");
    else if (conc.hhi >= 2400)
      add(`Concentration modérée (${conc.lead} ${conc.top1}%)`, "Marché", 3, 3, conc.src, "derived");
    else
      add(`Exposition aux cours mondiaux (premier poste : ${conc.lead} ${conc.top1}%)`, "Marché", 2, 3, conc.src, "derived");
  }

  // ── 3. Macro: inflation and debt (live only) ────────────────────────────
  if (macro?.inflation != null) {
    const i = macro.inflation;
    if (i >= 30) add(`Inflation hors de contrôle (${i}%)`, "Macro", 5, 4, "Banque mondiale", "derived");
    else if (i >= 15) add(`Inflation élevée (${i}%)`, "Macro", 4, 3, "Banque mondiale", "derived");
    else if (i >= 10) add(`Pression inflationniste (${i}%)`, "Macro", 3, 3, "Banque mondiale", "derived");
  }
  if (macro?.debt_gdp != null) {
    const d = macro.debt_gdp;
    if (d >= 90) add(`Dette souveraine critique (${d}% PIB)`, "Macro", 4, 5, "Banque mondiale", "derived");
    else if (d >= 70) add(`Dette souveraine élevée (${d}% PIB)`, "Macro", 3, 4, "Banque mondiale", "derived");
    else if (d >= 55) add(`Dette à surveiller (${d}% PIB)`, "Macro", 2, 3, "Banque mondiale", "derived");
  }

  // ── 4. Macro: growth — live figure preferred, local as fallback ─────────
  const growth = macro?.growth != null ? macro.growth : td?.gdpGrowth;
  if (growth != null) {
    const src = macro?.growth != null ? "Banque mondiale" : "Données WASI";
    if (growth < 0) add(`Récession (croissance ${growth}%)`, "Macro", 4, 4, src, "derived");
    else if (growth < 2) add(`Croissance atone (${growth}%)`, "Macro", 3, 3, src, "derived");
  }

  // ── 5. Currency regime ─────────────────────────────────────────────────
  if (td?.currency && !PEGGED.test(td.currency)) {
    const infl = macro?.inflation;
    const prob = infl != null && infl >= 15 ? 4 : infl != null && infl >= 8 ? 3 : 2;
    add(`Risque de change — devise flottante (${td.currency})`, "Macro", prob, 4, "Régime monétaire", "derived");
  }

  // ── 6. Partner dependency, from this app's own partner shares ──────────
  const topPartner = (td?.partners || [])
    .map((p) => {
      const m = String(p).match(/(\d+)\s*%/);
      return m ? { label: String(p).replace(/\s*\d+\s*%/, "").trim(), share: +m[1] } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.share - a.share)[0];
  if (topPartner && topPartner.share >= 30) {
    add(`Dépendance commerciale : ${topPartner.label} ${topPartner.share}% des exports`,
        "Marché", topPartner.share >= 40 ? 4 : 3, 3, "Données WASI", "derived");
  }

  // ── 7. Legislative watch (live) ────────────────────────────────────────
  if (news && typeof news.legalAdj === "number" && news.legalAdj < 0) {
    const ev = (news.evidence || []).find((e) => e.polarity === "negative");
    add(`Environnement réglementaire dégradé${ev ? ` — ${ev.title.slice(0, 60)}` : ""}`,
        "Conformité", news.legalAdj <= -2 ? 4 : 3, 3, "Veille législative du jour", "derived");
  }

  // ── 8. Countries that do not report exports to the UN ───────────────────
  if (!afex && live?.afexByIso2 && Object.keys(live.afexByIso2).length) {
    add("Statistiques douanières non déclarées à l'ONU", "Conformité", 3, 3,
        "UN Comtrade — pays non déclarant", "derived");
  }

  // De-duplicate by name (an expert sentence may restate a derived risk) and
  // rank by criticality.
  const seen = new Set();
  return out
    .filter((r) => {
      const k = r.nom.toLowerCase().trim();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => b.prob * b.impact - a.prob * a.impact);
}

export function riskSeverity(r) {
  const score = r.prob * r.impact;
  if (score >= 15) return { score, label: "Critique", color: "#ff2d6f" };
  if (score >= 9) return { score, label: "Significatif", color: "#f0b429" };
  if (score >= 4) return { score, label: "Tolérable", color: "#C8922A" };
  return { score, label: "Négligeable", color: "#00ff84" };
}
