import { useState, useEffect, useRef } from "react";

// ============================================================
// WASI AI AGENT — West African Shipping & Economic Intelligence
// Powered by Claude AI | ECOWAS 16 Nations
// ============================================================

// ── Backend API Integration ───────────────────────────────────────────────────
// Configurable: set window.WASI_API_URL before loading, or falls back to same-origin :8000
const BACKEND_API_URL = window.WASI_API_URL || (window.location.port === "3000"
  ? window.location.protocol + "//" + window.location.hostname + ":8000"
  : "");

// Fetch real indices from backend; returns { code: indexValue } map or null on failure
async function fetchBackendIndices(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/indices/latest`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.indices || null;
  } catch (_) {
    return null;
  }
}

// Fetch live WASI composite from backend
async function fetchBackendComposite(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/indices/history?months=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.length > 0 ? data[0].composite_value : null;
  } catch (_) {
    return null;
  }
}

// Fetch stock market data (NGX, GSE, BRVM)
async function fetchStockMarkets(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/markets/latest`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

// Fetch market divergence signals
async function fetchDivergence(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/markets/divergence?lookback_months=3`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

// Fetch live signals (base + adjustment + adjusted index per country)
async function fetchLiveSignals(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/v2/signals/live`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Return a map of country_code → signal object
    const map = {};
    (data.signals || []).forEach(s => { map[s.country_code] = s; });
    return map;
  } catch (_) {
    return null;
  }
}

// Fetch active news events
async function fetchNewsEvents(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/v2/signals/events`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.events || [];
  } catch (_) {
    return null;
  }
}

async function fetchBankContext(token, countryCode) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/v2/bank/credit-context/${countryCode}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

// Fetch commodity spot prices (WB Pink Sheet — cocoa, brent, gold, cotton, coffee, iron ore)
async function fetchCommodityPrices(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/v2/data/commodities/latest`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.prices || [];
  } catch (_) {
    return null;
  }
}

// Fetch IMF WEO macro indicators for one country
async function fetchMacroData(token, countryCode) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/v2/data/macro/${countryCode}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}
// Fetch USSD aggregate data (daily signals from MoMo, commodities, trade, ports)
async function fetchUSSDAggregate(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/ussd/aggregate/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// 16 ECOWAS West African countries — weights match composite_engine.py exactly
// Primary 75%: NG 28% + CI 22% + GH 15% + SN 10%
// Secondary 18%: BF 4% + ML 4% + GN 4% + BJ 3% + TG 3%
// Tertiary 7%: NE 1% + MR 1% + GW 1% + SL 1% + LR 1% + GM 1% + CV 1%
// ── Government & Macroeconomic Advisory Knowledge Base ───────────────────────
const GOVERNMENT_ADVISORY_KNOWLEDGE = `
EXPERTISE GOUVERNEMENTALE & MACROÉCONOMIQUE — AFRIQUE DE L'OUEST (WASI v3.0)

━━ PROFILS MACROÉCONOMIQUES PAYS (2025–2026 estimations) ━━
NIGERIA (NG):  PIB ~450Mrd USD | Croissance 3.2% | Inflation ~33% | Chômage ~5% officiel
               Dette pub/PIB ~38% | Service dette/recettes ~30% (problème CRITIQUE)
               Pétrole = 85% exports, 55% recettes fiscales fédérales | Diversification urgente
               Notation S&P: B- (stable) | Moody's: Caa1

CÔTE D'IVOIRE (CI): PIB ~78Mrd USD | Croissance 6.5% | Inflation ~3.5% | 1ère économie UEMOA
               Cacao 40% production mondiale | Dette pub/PIB ~60% | Notation Fitch: B+
               Eurobonds actifs (2024: 2,6Mrd USD émis) | Hub régional port/finance

GHANA (GH):    PIB ~72Mrd USD | Croissance 5.7% | Inflation ~22% | Programme FMI ECF
               Post-défaut 2022: restructuration dettes ext./int. | Dette pub/PIB ~85%
               Notation Fitch: B- (positive) | Stabilisation en cours | Or = 1er export

SÉNÉGAL (SN):  PIB ~34Mrd USD | Croissance 8.5% (boost pétrole/gaz Sangomar 2024)
               Inflation ~4% | Dette pub/PIB ~75% | Notation Fitch: B+
               Pétrole offshore: 100 000 bpj Sangomar phase 1 | GNL Grande Tortue 2025

MALI (ML):     PIB ~20Mrd USD | Croissance 4.5% | Inflation ~3% | Sanctions levées 2024
               or = 1er export | accès marchés int'l limité | AES (Alliance États Sahel) risque

BURKINA FASO (BF): PIB ~19Mrd USD | Croissance 3.0% | Inflation ~4%
               Or = 1er export | Crise sécuritaire: 40% territoire sous insécurité
               Budget défense ~5% PIB (hausse drastique) | Aide int'l réduite

GUINÉE (GN):   PIB ~22Mrd USD | Croissance 5.5% | Simandou fer 2025–2027: +15% PIB attendu
               Bauxite 1er producteur mondial (25% offre globale) | Alumine en développement

BÉNIN (BJ):    PIB ~20Mrd USD | Croissance 6.0% | Inflation ~2% | Hub transit (Niger, BF)
               Obligations sukuk émises | Meilleure performance fiscale zone UEMOA

TOGO (TG):     PIB ~11Mrd USD | Croissance 6.5% | Hub logistique Lomé | Phosphate = export clé
NIGER (NE):    PIB ~15Mrd USD | Uranium + pétrole | Sanctions post-coup 2023 (partiellement levées)
MAURITANIE (MR): PIB ~10Mrd USD | Gaz GTA (Total/BP) offshore | Pêche + fer SNIM
SIERRA LEONE (SL): PIB ~4.5Mrd USD | Fer, diamants, rutile | Reconstruction post-Ebola
LIBÉRIA (LR):  PIB ~4.2Mrd USD | Fer Arcelor Mittal, caoutchouc Firestone | USD comme monnaie
CAP-VERT (CV): PIB ~2.4Mrd USD | Tourisme 25% PIB | Note investment grade (Moody: B2)
GAMBIE (GM):   PIB ~2.3Mrd USD | Tourisme + remittances | Petite économie très ouverte
GUINÉE-BISSAU (GW): PIB ~1.8Mrd USD | Noix de cajou 90% exports | Très fragile

━━ CRITÈRES DE CONVERGENCE UEMOA (Pacte de Stabilité et de Croissance) ━━
Critères PRIMAIRES (obligatoires):
• Déficit budgétaire global ≤ 3% PIB (norme fondamentale)
• Taux d'inflation annuel moyen ≤ 3%
• Arriérés de paiement intérieurs et extérieurs = 0

Critères SECONDAIRES (recommandés):
• Masse salariale / recettes fiscales ≤ 35%
• Investissements publics financés localement / recettes fiscales ≥ 20%
• Déficit extérieur courant hors dons ≤ 5% PIB
• Recettes fiscales / PIB ≥ 20%

Performance 2025 estimée (conformité):
CI: conforme critères primaires | SN: conforme (revenus pétroliers)
BF: déficit >3% (dépenses sécurité) | ML: déficit >3% (accès limité)
NE: hors critères (sanctions) | BJ: parmi les mieux notés UEMOA

━━ PROGRAMMES FMI / BANQUE MONDIALE ACTIFS ━━
Ghana (GH): ECF Programme $3Mrd (2023–2026) — stabilisation macroéco, restructuration dette
  Conditions: Réformes fiscales, réduction masse salariale, privatisation SOEs
Niger (NE): Programme suspendu post-coup 2023 — négociations reprises partiel 2025
Burkina Faso (BF): Accès FMI limité — financement déficit via émissions UEMOA
Sénégal (SN): Article IV positif — pétrole booste projections
Nigeria (NG): Pas de programme — réformes CBN (unification taux change, suppression subsides fuel)
Guinée (GN): Article IV — Simandou project monitoring special

━━ NOTATIONS SOUVERAINES & ACCÈS MARCHÉ DETTE (2025) ━━
CI:  B+/B+  (Fitch/S&P, stable)  — eurobonds réguliers, yield ~9–10%
SN:  B+/B+  (stable)             — yield eurobond ~9.5–11%
GH:  B-/B-  (positive, recovery) — yield ~12–14% post-restructuration
NG:  B-/Caa1(stable)             — yield Eurobond ~9.5–11%
BF:  NR     (non-noté post-coup) — BCEAO marché régional uniquement
ML:  NR     (non-noté)           — BCEAO marché régional uniquement
NE:  NR     (non-noté)           — accès très limité
GN:  B-     (Moody's 2024)       — yield ~14–16%
CV:  B2/B+  (stable)             — meilleure notation zone Atlantique

━━ POLITIQUE FISCALE — CONSEILS GOUVERNEMENTAUX ━━
Mobilisation recettes (Tax/GDP UEMOA = 14% vs norme 20% cible):
• Automatisation douanes (SYDONIA World, ASYCUDA++) → réduire fraude 30–40%
• Élargissement assiette TVA: secteur informel représente 40–60% économies
• Fiscalité foncière: sous-exploitée, potentiel recettes +2–3% PIB
• Taxe sur ressources naturelles: revoir partage production (mining, pétrole)
• Réduction exemptions fiscales non-stratégiques: coût ~3–5% PIB

Gestion dépenses publiques (PFM):
• Contrainte masse salariale: NG (50% recettes), GH (42%), BF (38%) — critique
• Privilégier dépenses capital (infrastructures) vs dépenses courantes
• Systèmes IFMIS (Integrated Financial Mgmt) → transparence budget
• Passation marchés publics: PPTE standards, e-procurement anti-corruption
• Allègement PPTE pour pays éligibles → libérer ressources investissement

Gestion dette publique:
• Allonger maturités: éviter refinancement massif (risque rollover)
• Diversifier base investisseurs: pension funds locaux sous-exploités
• Obligations vertes (Green/Blue bonds): CI, SN en avance — financement climat
• Swap dette contre nature: opportunité Sierra Leone, Libéria (forêts)
• Réduire dépendance T-bills court terme (taux variables, risque rollover)

━━ POLITIQUE MONÉTAIRE (BCEAO + BANQUES CENTRALES NATIONALES) ━━
BCEAO (Zone UEMOA — XOF):
• TIAO (taux directeur): 4.50% | Réserves obligatoires: 3% (dépôts à vue)
• Objectif: stabilité prix (inflation <3%) + soutien croissance
• Instruments: refinancement banques, OMO, facilité de prêt marginal
• Réforme fintech: BCEAO mobile money framework (Orange Money, MTN MoMo)
• Initiatives: Digitalisation paiements gouvernementaux via SWIFT UEMOA

CBN Nigeria: MPR 27.5% — politique restrictive anti-inflation
  • Unification taux change 2023 → amélioration transparence forex
  • Réformes: subsides carburant supprimés 2023 (économie ~5Mrd USD/an)
  • Digital Naira (eNaira) — CBDC en déploiement

Bank of Ghana: 28% — programme IMF impose rigueur
  • Domestic Debt Exchange (DDEP 2023): restructuration 15Mrd USD dette intérieure
  • Ghana Cedi stabilisation via réserves + soutien FMI

━━ STRATÉGIES SECTORIELLES — CONSEILS GOUVERNEMENTS ━━
Agriculture:
• Côte d'Ivoire: transformation cacao (objectif 50% locale vs 35% actuel), labellisation
• Burkina Faso: coton — intégration filière textile locale, valeur ajoutée
• Sénégal: pêche artisanale + industrielle — accords EU à renégocier
• Nigeria: diversification agriculture post-pétrole — cassava, rice, soy

Ressources naturelles:
• Guinée: Simandou (fer, 2Mrd tonnes réserves) — royalties minières, contenu local 30%
• Mali/BF: Or — révision codes miniers, augmenter part État
• Sénégal: Sangomar pétrole — fonds de stabilisation obligatoire
• Nigeria: réforme NNPCL (privatisation partielle) + local content act

Infrastructure:
• Corridor Abidjan–Lagos (1000km): autoroute sous financement AfDB, PPP
• Dakar–Bamako rail: réhabilitation SITARAIL-style | financement Chine/UE
• Port Lomé deepwater extension | Port Tema Terminal 3 (Bolloré)
• WAPP (West African Power Pool): interconnexions électriques régionales
• Fibre optique sous-marine: ACE, SAT3 → connectivité data centres

AfCFTA (Zone de Libre-Échange Continentale Africaine):
• Tarifs 90% marchandises éliminés progressivement → 2035
• Règles d'origine: minimum 30–40% valeur ajoutée locale
• Nigeria = plus grand marché: PIB $450Mrd → opportunité production pour exportation
• Zone industrielle spéciale: Abidjan (VITIB), Lagos (Lekki FTZ), Accra (Tema EPZ)
• Impact estimé: +$450Mrd commerce intra-africain additionnel d'ici 2035

━━ CONSEIL GOUVERNEMENTAL — CADRE D'ANALYSE ━━
Pour tout conseil à un membre du gouvernement, structurer ainsi:
1. DIAGNOSTIC — Situation actuelle (données WASI + macro + fiscale)
2. PROBLÉMATIQUE — Contraintes spécifiques (politique, institutionnel, financier)
3. OPTIONS POLITIQUES — 2–3 scénarios avec avantages/risques
4. RECOMMANDATION — Priorité actionnable à court terme (<12 mois) et moyen terme
5. INDICATEURS DE SUCCÈS — KPIs mesurables (ratios fiscal, indices WASI, notation)
6. RISQUES — Politique, macroéco, sécurité, acceptabilité sociale
`;

// ── Country Tax & Fiscal Data — Loi de Finances / Finance Acts ───────────────
// Source: DGI CI, FIRS Nigeria, GRA Ghana, DGID Sénégal — knowledge base Aug 2025
const COUNTRY_TAX_DATA = {
  CI: {
    year: "2025",
    source: "Loi de Finances CI 2025 — DGI (Direction Générale des Impôts)",
    currency: "XOF — Franc CFA (parité fixe 655.957 XOF/EUR)",
    changes_2025: [
      "Télédéclaration obligatoire pour toutes les entreprises",
      "Nouvelle taxe sur l'économie numérique (e-commerce, plateformes)",
      "Renforcement des règles de prix de transfert (documentation obligatoire)",
      "Réforme du régime fiscal des PME (seuil CA revu à 200M FCFA)",
      "Digitalisation du guichet douanier SYDAM World (Port Abidjan)",
    ],
    corporate: [
      { label: "BIC grandes entreprises",        rate: 25,  note: "Impôt sur les Bénéfices Industriels et Commerciaux" },
      { label: "BIC PME (CA < 200M FCFA)",        rate: 20,  note: "Régime simplifié" },
      { label: "IMF (minimum forfaitaire)",        rate: "0,5% CA", note: "Min 3M — Max 35M FCFA/an" },
      { label: "Retenue dividendes",              rate: 15,  note: "Sur distributions aux actionnaires" },
      { label: "Retenue intérêts",                rate: 18,  note: "Sur paiements d'intérêts" },
      { label: "Retenue royalties (non-résidents)", rate: 20, note: "Services et droits versés à l'étranger" },
      { label: "TAF — Taxe Activités Financières", rate: 10, note: "Sur commissions et services bancaires" },
    ],
    vat: [
      { label: "TVA standard",           rate: 18, note: "Taux général (biens et services)" },
      { label: "TVA réduite",            rate: 9,  note: "Biens de 1ère nécessité désignés" },
      { label: "TVA export",             rate: 0,  note: "Exportations — taux zéro" },
    ],
    vat_exempt: ["Produits alimentaires de base", "Intrants agricoles", "Médicaments", "Éducation", "Transports publics"],
    irpp: [
      { bracket: "0 – 600 000 FCFA/an",         rate: 0  },
      { bracket: "600 001 – 1 200 000 FCFA/an",  rate: 5  },
      { bracket: "1 200 001 – 2 500 000 FCFA/an", rate: 15 },
      { bracket: "2 500 001 – 7 500 000 FCFA/an", rate: 25 },
      { bracket: "> 7 500 000 FCFA/an",           rate: 36 },
    ],
    customs: [
      { cat: "Cat. 0", rate: 0,  label: "Biens sociaux essentiels (médicaments, livres)" },
      { cat: "Cat. 1", rate: 5,  label: "Matières premières & biens de capital" },
      { cat: "Cat. 2", rate: 10, label: "Intrants intermédiaires" },
      { cat: "Cat. 3", rate: 20, label: "Biens de consommation courante" },
      { cat: "Cat. 4", rate: 35, label: "Biens sensibles (protection économique)" },
    ],
    customs_levies: [
      { label: "Prélèvement communautaire CEDEAO",  rate: 0.5 },
      { label: "Prélèvement communautaire UEMOA",   rate: 1.0 },
      { label: "Redevance statistique",             rate: 1.0 },
    ],
    sector: [
      { label: "Droits export cacao (DUS + CGA)", rate: "~22% FOB", note: "1ère source recettes douanières CI" },
      { label: "Redevance minière",               rate: "3–6%",    note: "Sur valeur production" },
      { label: "Part État secteur minier",        rate: "10%",     note: "Free carry — sans apport de fonds" },
      { label: "PPT pétrole & gaz",               rate: "Variable", note: "Contrats de partage de production" },
    ],
  },
  NG: {
    year: "2024",
    source: "Finance Act Nigeria 2024 — FIRS (Federal Inland Revenue Service)",
    currency: "NGN — Naira Nigérian",
    changes_2025: [
      "Réduction CIT grandes entreprises de 30% maintenue",
      "Taxe sur l'économie numérique (non-résidents) : 6%",
      "Excise duty sur boissons sucrées renforcée",
      "Exemption CIT PME (CA < 25M NGN) confirmée",
    ],
    corporate: [
      { label: "CIT grandes entreprises (CA > 100M NGN)", rate: 30, note: "Corporate Income Tax" },
      { label: "CIT moyennes entreprises (25–100M NGN)", rate: 20, note: "" },
      { label: "CIT petites entreprises (< 25M NGN)",    rate: 0,  note: "Exonérées" },
      { label: "WHT dividendes",                         rate: 10, note: "Withholding Tax" },
      { label: "WHT intérêts",                           rate: 10, note: "" },
      { label: "Taxe économie numérique",                rate: 6,  note: "Non-résidents fournissant services digitaux" },
    ],
    vat: [
      { label: "VAT standard", rate: 7.5, note: "Taux faible vs région" },
    ],
    sector: [
      { label: "PPT pétrole (champs classiques)", rate: 85, note: "Petroleum Profits Tax — production principale" },
      { label: "PPT pétrole (eaux profondes)",    rate: 50, note: "Deep offshore" },
      { label: "Gas flaring penalty",             rate: "$2/Mscf", note: "Pénalité brûlage gaz" },
    ],
  },
  GH: {
    year: "2025",
    source: "Ghana Revenue Authority — Finance Act 2023 / Budget 2025",
    currency: "GHS — Cedi Ghanéen",
    changes_2025: [
      "E-Levy maintenu à 1% sur mobile money",
      "Prélèvement supplémentaire secteur minier reconduit",
      "COVID-19 Health Recovery Levy (1%) prolongé",
      "Droits d'accise sur boissons alcoolisées relevés",
    ],
    corporate: [
      { label: "CIT standard",                  rate: 25, note: "Corporate Income Tax" },
      { label: "CIT secteur minier",             rate: 35, note: "Or, bauxite, manganèse" },
      { label: "CIT pétrole & gaz",              rate: 35, note: "" },
      { label: "WHT dividendes (résidents)",     rate: 8,  note: "" },
      { label: "WHT dividendes (non-résidents)", rate: 8,  note: "" },
    ],
    vat: [
      { label: "VAT standard",               rate: 15,  note: "" },
      { label: "NHIL (santé)",               rate: 2.5, note: "National Health Insurance Levy" },
      { label: "GETFUND (éducation)",        rate: 2.5, note: "" },
      { label: "COVID-19 Recovery Levy",     rate: 1,   note: "" },
      { label: "TVA totale effective",       rate: 21,  note: "Cumul sur la plupart des transactions" },
    ],
    sector: [
      { label: "E-Levy mobile money",             rate: 1,    note: "Sur transactions > 100 GHS" },
      { label: "Royalty minière (or)",            rate: "5%", note: "Sur valeur production" },
      { label: "Prélèvement additionnel mines",   rate: 10,   note: "Sur bénéfices > 35% de rendement" },
    ],
  },
  SN: {
    year: "2025",
    source: "Code Général des Impôts Sénégal — DGID / Loi de Finances 2025",
    currency: "XOF — Franc CFA UEMOA",
    changes_2025: [
      "Nouveau régime fiscal pétrole & gaz (production démarrée 2024)",
      "Incitations fiscales zones économiques spéciales",
      "Renforcement taxe sur les transactions immobilières",
      "Extension TVA aux services numériques transfrontaliers",
    ],
    corporate: [
      { label: "IS — Impôt sur les Sociétés",       rate: 30, note: "Taux standard" },
      { label: "IS secteur pétrolier",              rate: 33, note: "Contrats post-2024" },
      { label: "Retenue dividendes",                rate: 10, note: "" },
      { label: "Retenue services (non-résidents)",  rate: 20, note: "" },
    ],
    vat: [
      { label: "TVA standard", rate: 18, note: "Alignée UEMOA" },
    ],
    sector: [
      { label: "Royalty pétrole (Sangomar)",  rate: "Variable", note: "Contrat de partage — Woodside/Petrosen" },
      { label: "Royalty GNL (GTA)",           rate: "Variable", note: "Greater Tortue Ahmeyim — BP/Kosmos" },
    ],
  },
};

// ── Banking Sector Knowledge Base — 16 ECOWAS Countries ──────────────────────
// Static knowledge injected into AI agent system prompt.
// Sources: BCEAO rapports annuels, CBN, Bank of Ghana, banques centrales nationales (2025-2026).
const BANKING_KNOWLEDGE = `
SECTEUR BANCAIRE — AFRIQUE DE L'OUEST (Base de connaissance WASI v3.0)

━━ ZONE BCEAO / UEMOA (XOF — Franc CFA, parité fixe 655.957 XOF/EUR) ━━
Pays: CI, SN, BF, ML, TG, BJ, NE, GW
Régulateur: BCEAO (Banque Centrale des États de l'Afrique de l'Ouest), Dakar
Taux directeur BCEAO (TIAO): 4.50% (2026) | Taux de refinancement: 5.75%
Fourchette prêts corporate: 8–16% | PME/microfinance: 18–28%
Stabilité monétaire: excellente (arrimage EUR) → taux parmi les plus bas d'Afrique sub-saharienne

CÔTE D'IVOIRE (CI) — Banques & taux (meilleures offres en premier):
1. Coris Bank CI — en forte expansion, taux retail très compétitifs 9–13%
2. SIB (Société Ivoirienne de Banque / filiale BNI) — corporate 9–13%
3. SGCI (Société Générale CI) — corporate, trade finance 10–15%
4. Ecobank CI — réseau panafricain, corporate 9–14%
5. Bridge Bank — profil français, 10–15%
6. BNI (Banque Nationale d'Investissement) — projets publics, taux préférentiels
7. NSIA Banque — PME 12–18% | GTBank CI — corporate international 10–15%
Contexte: 1ère économie UEMOA → taux institutionnels les plus bas de la zone.

SÉNÉGAL (SN) — Banques & taux:
1. CBAO Attijari — leader, taux parmi les plus bas 8–13% (corporate prime)
2. BICIS (filiale BNP Paribas) — 9–14%
3. SGBS (Société Générale Sénégal) — 9–14%
4. Ecobank Sénégal — 9–14%
5. BHS (Banque de l'Habitat du Sénégal) — immobilier spécialisé
6. UBA Sénégal 10–14% | Orabank Sénégal 11–16%
Contexte: Meilleure note de crédit souverain UEMOA → taux infrastructure les plus bas.

BURKINA FASO (BF) — Banques & taux:
1. Coris Bank International — plus grand réseau national, taux compétitifs 9–14%
2. BankCom (Banque du Commerce du Burkina) — 10–15%
3. Ecobank Burkina — 10–15%
4. Bank of Africa Burkina (BOA) — 10–16%
5. SBB (Société Burkinabè de Banque) — 10–15%
6. SGBB (Société Générale Burkina Biso) — 11–16%
7. Orabank Burkina 11–16% | UBA Burkina corporate 10–14% | BPSB 12–18%
Contexte: Risque politique élevé (transition militaire 2022) → prime de risque +2/3% vs CI/SN.
Sécurité corridor Ouaga–Tema dégradée → impact sur prêts logistique/transport.

MALI (ML) — Banques & taux:
1. BDM (Banque de Développement du Mali) — institution publique, projets infra
2. BNDA (Banque Nationale de Développement Agricole) — agriculture préférentiel
3. Ecobank Mali 12–18% | Orabank Mali 12–18% | BOA Mali 12–18% | BSIC Mali 13–20%
Contexte: Post-coup (2021), sanctions CEDEAO levées mais accès financier limité. Corridor Dakar–Bamako dégradé.

BÉNIN (BJ) — Banques & taux:
1. Orabank Bénin 10–15% | Ecobank Bénin 10–15% | BOA Bénin 10–15%
2. UBA Bénin 10–14% | BSIC Bénin 11–17%
Contexte: Hub de transit vers Niger → secteur logistique actif, financement portuaire disponible.

TOGO (TG) — Banques & taux:
1. Orabank Togo — taux compétitifs 10–15%
2. Ecobank Togo 10–14% | SGBT (Société Générale Banque Togo) 10–15%
3. BOA Togo 10–15% | BSIC Togo 11–17%
Contexte: Port de Lomé = hub régional conteneurs, fort financement trade finance disponible.

NIGER (NE) — Banques & taux:
1. BOA Niger 13–20% | Ecobank Niger 13–20% | BSIC Niger 15–22%
Contexte: Sanctions post-coup 2023 partiellement levées, accès financier très restreint. Taux prohibitifs.

GUINÉE-BISSAU (GW) — BCEAO zone, très petite économie:
1. BSIC GW | Ecobank GW | Orabank GW — taux 12–20%

━━ NIGERIA (NG) — NGN (Naira) ━━
Régulateur: CBN (Central Bank of Nigeria)
Taux directeur MPR: 27.50% (CBN 2026 — lutte contre inflation ~33%)
Fourchette prêts commercial: 25–35% | Prime clients tier-1: 22–28%
1. GTBank (Guaranty Trust Bank) — taux corporate compétitifs ~24–28%, service premium, leader fintech
2. Stanbic IBTC (filiale Standard Bank SA) — meilleur taux pour multinationales ~23–28%
3. Standard Chartered Nigeria — corporate international ~23–27%
4. Zenith Bank — fort corporate banking ~24–30%
5. Access Bank — le plus grand par actifs ~24–30%
6. UBA — présence panafricaine ~24–30%
7. First Bank Nigeria — banque la plus ancienne, ~25–32%
8. Ecobank Nigeria ~25–30% | Fidelity Bank ~25–32% | FCMB ~26–32%
9. Sterling Bank ~26–33% | Wema Bank ~26–33% (retail/digital focus)
Contexte: Naira volatile (-50% vs USD 2023-2024). Projets USD/EUR indexés fortement préférables.
Unification taux de change CBN 2023 → meilleure transparence mais inflation persiste.

━━ GHANA (GH) — GHS (Cedi) ━━
Régulateur: Bank of Ghana (BoG)
Taux directeur BoG: 28.00% (2026)
Fourchette prêts commercial: 30–42%
1. GCB Bank (Government) — taux préférentiels projets publics ~28–35%
2. Absa Ghana (ex-Barclays) — multinationales ~28–35%
3. Standard Chartered Ghana — corporate international ~28–34%
4. Ecobank Ghana ~29–36%
5. Agricultural Development Bank (ADB) — agriculture ~25–33% (le plus bas)
6. CAL Bank ~30–38% | Fidelity Bank Ghana ~32–40% | Societe Generale Ghana ~30–37%
Contexte: Restructuration dette souveraine 2022–2023 (IMF USD 3Mrd). GHS a perdu >60% vs USD.
Stabilisation en cours — taux en baisse progressive. Projets USD indexés recommandés.

━━ GUINÉE (GN) — GNF (Franc Guinéen) ━━
Régulateur: BCRG (Banque Centrale de la République de Guinée)
Taux directeur BCRG: ~13% (2025)
Fourchette prêts commercial: 18–28%
1. Société Générale Guinée — taux corporate les plus compétitifs ~17–22%
2. BICIGUI (filiale BNP Paribas) — corporate ~18–24%
3. Ecobank Guinée ~18–24% | UBA Guinée ~18–24% | GTBank Guinée ~18–24%
4. Orabank Guinée ~20–26% | BSIC Guinée ~20–27%
Contexte: Projet Simandou (minerai de fer) → afflux financement externe 2025–2027.
GNF volatile, financement projets mining en USD conseillé.

━━ MAURITANIE (MR) — MRU (Ouguiya) ━━
Régulateur: BCM (Banque Centrale de Mauritanie)
Taux directeur: ~10% (2025) | Fourchette prêts: 12–20%
1. Banque Mauritanienne pour le Commerce International (BMCI) — 12–18%
2. Générale de Banque de Mauritanie (GBM) — 12–18%
3. Chinguitty Bank 12–17% | Orabank Mauritanie 13–19%
Contexte: Gaz naturel offshore GTA (Total Energies) → afflux investissement 2025–2030.

━━ SIERRA LEONE (SL) — SLE (Leone) ━━
Régulateur: BSL (Bank of Sierra Leone) | Taux directeur: ~24%
1. Sierra Leone Commercial Bank (SLCB) 22–30%
2. Rokel Commercial Bank 22–30% | Ecobank SL ~22–28%

━━ LIBÉRIA (LR) — LRD + USD (économie dollarisée) ━━
Prêts USD disponibles: 10–18% (plus attractifs que LRD)
1. Ecobank Liberia (USD) 10–16% | LBDI 10–18% | International Bank Liberia 12–18%

━━ GAMBIE (GM) — GMD (Dalasi) ━━
Régulateur: Central Bank of Gambia | Taux directeur: ~17%
1. Trust Bank Gambia 14–22% | GTBank Gambia 13–20%

━━ CAP-VERT (CV) — CVE (Escudo, ancrage EUR ~110 CVE/EUR) ━━
Régulateur: BCV (Banco de Cabo Verde)
Fourchette prêts: 7–14% (parmi les plus bas — ancrage EUR similaire BCEAO)
1. Banco Comercial do Atlântico (BCA) — 8–14%
2. Caixa Económica de Cabo Verde — 7–13%
Contexte: Économie touristique stable, risque souverain faible.

SYNTHÈSE RÉGIONALE — CLASSEMENT TAUX (plus bas → plus élevé):
1. Cap-Vert (CVE/EUR ancré): 7–14%
2. Zone BCEAO prime (SN, CI): 8–14%
3. Zone BCEAO standard (BF, TG, BJ): 9–16%
4. Zone BCEAO risque élevé (ML, NE): 12–22%
5. Guinée (GNF): 17–28%
6. Mauritanie (MRU): 12–20%
7. Sierra Leone (SLE): 22–30%
8. Ghana (GHS — contexte inflationniste): 28–42%
9. Nigeria (NGN — MPR élevé): 22–35%
`;

const WEST_AFRICAN_COUNTRIES = [
  { code: "CI", name: "Côte d'Ivoire", port: "Abidjan", flag: "🇨🇮", tier: "primary",   weight: 0.22 },
  { code: "NG", name: "Nigeria",        port: "Lagos / Apapa", flag: "🇳🇬", tier: "primary",   weight: 0.28 },
  { code: "GH", name: "Ghana",          port: "Tema", flag: "🇬🇭", tier: "primary",   weight: 0.15 },
  { code: "SN", name: "Senegal",        port: "Dakar", flag: "🇸🇳", tier: "primary",   weight: 0.10 },
  { code: "BF", name: "Burkina Faso",   port: "Landlocked / Abidjan corridor", flag: "🇧🇫", tier: "secondary", weight: 0.04 },
  { code: "ML", name: "Mali",           port: "Landlocked / Dakar corridor", flag: "🇲🇱", tier: "secondary", weight: 0.04 },
  { code: "GN", name: "Guinea",         port: "Conakry", flag: "🇬🇳", tier: "secondary", weight: 0.04 },
  { code: "BJ", name: "Benin",          port: "Cotonou", flag: "🇧🇯", tier: "secondary", weight: 0.03 },
  { code: "TG", name: "Togo",           port: "Lomé", flag: "🇹🇬", tier: "secondary", weight: 0.03 },
  { code: "NE", name: "Niger",          port: "Landlocked / Cotonou corridor", flag: "🇳🇪", tier: "tertiary", weight: 0.01 },
  { code: "MR", name: "Mauritania",     port: "Nouakchott", flag: "🇲🇷", tier: "tertiary", weight: 0.01 },
  { code: "GW", name: "Guinea-Bissau",  port: "Bissau", flag: "🇬🇼", tier: "tertiary", weight: 0.01 },
  { code: "SL", name: "Sierra Leone",   port: "Freetown", flag: "🇸🇱", tier: "tertiary", weight: 0.01 },
  { code: "LR", name: "Liberia",        port: "Monrovia", flag: "🇱🇷", tier: "tertiary", weight: 0.01 },
  { code: "GM", name: "Gambia",         port: "Banjul", flag: "🇬🇲", tier: "tertiary", weight: 0.01 },
  { code: "CV", name: "Cape Verde",     port: "Praia / Mindelo", flag: "🇨🇻", tier: "tertiary", weight: 0.01 },
];

// ── Données commerciales & fiches pays (M$ USD, 2023 — mise à jour : fév. 2026) ─
const COUNTRY_TRADE_DATA = {
  CI: {
    president: "Alassane Dramane Ouattara", presidentSince: "2011 (réélu 2025)",
    capitale: "Yamoussoukro", siegeEconomique: "Abidjan",
    superficie: 322462,
    matieres_premieres: ["Cacao (1er mondial)", "Caoutchouc naturel", "Noix de cajou", "Or", "Pétrole brut", "Gaz naturel", "Huile de palme", "Bois tropical", "Diamants"],
    exports: [
      { cat: "Cacao & Chocolat", val: 3800 }, { cat: "Pétrole brut", val: 1200 },
      { cat: "Caoutchouc naturel", val: 890 }, { cat: "Noix de cajou", val: 760 },
      { cat: "Huile de palme", val: 540 },     { cat: "Bois & dérivés", val: 320 },
    ],
    imports: [
      { cat: "Machines & équipements", val: 1600 }, { cat: "Prod. pétroliers raffinés", val: 1100 },
      { cat: "Riz & céréales", val: 890 },          { cat: "Véhicules & transport", val: 670 },
      { cat: "Prod. pharmaceutiques", val: 340 },   { cat: "Acier & métaux", val: 290 },
    ],
    totalExports: 7510, totalImports: 4890,
    partners: ["Union Européenne 38%", "Chine 15%", "États-Unis 9%", "Inde 8%"],
    opportunities: ["Transformation locale cacao", "Hub logistique CEDEAO", "Zone franche Abidjan"],
    risks: ["Volatilité prix cacao", "Dépendance marché UE", "Infrastructures routières limitées"],
    gdpGrowth: 6.8, currency: "XOF",
  },
  NG: {
    president: "Bola Ahmed Tinubu", presidentSince: "2023",
    capitale: "Abuja", siegeEconomique: "Lagos",
    superficie: 923768,
    matieres_premieres: ["Pétrole brut (1er africain)", "Gaz naturel", "Étain", "Charbon", "Minerai de fer", "Or", "Calcaire", "Coltan", "Terres rares"],
    exports: [
      { cat: "Pétrole brut", val: 35000 },       { cat: "Gaz naturel liquéfié", val: 8000 },
      { cat: "Cacao brut", val: 1500 },           { cat: "Sésame & oléagineux", val: 620 },
      { cat: "Caoutchouc naturel", val: 580 },
    ],
    imports: [
      { cat: "Machines & équipements", val: 6200 }, { cat: "Prod. pétroliers raffinés", val: 5100 },
      { cat: "Véhicules", val: 3200 },              { cat: "Riz importé", val: 2100 },
      { cat: "Prod. pharmaceutiques", val: 1500 },
    ],
    totalExports: 46000, totalImports: 18000,
    partners: ["Inde 25%", "Espagne 9%", "Chine 8%", "Pays-Bas 7%"],
    opportunities: ["Raffinage pétrolier local", "Agriculture mécanisée", "Tech & fintech Lagos"],
    risks: ["Dépendance pétrole >75%", "Instabilité naira", "Conflits Delta du Niger"],
    gdpGrowth: 3.3, currency: "NGN",
  },
  GH: {
    president: "John Dramani Mahama", presidentSince: "janv. 2025 (3e mandat)",
    capitale: "Accra", siegeEconomique: "Accra",
    superficie: 238533,
    matieres_premieres: ["Or (2e africain)", "Pétrole brut", "Gaz naturel", "Bauxite", "Manganèse", "Diamants", "Cacao", "Bois tropical", "Sel"],
    exports: [
      { cat: "Or & métaux précieux", val: 8200 }, { cat: "Pétrole brut", val: 3100 },
      { cat: "Cacao brut", val: 2100 },           { cat: "Bois & dérivés", val: 820 },
      { cat: "Thon & poissons", val: 410 },
    ],
    imports: [
      { cat: "Machines & équipements", val: 3100 }, { cat: "Prod. pétroliers raffinés", val: 2200 },
      { cat: "Véhicules", val: 1100 },              { cat: "Riz & blé", val: 920 },
      { cat: "Plastiques & caoutchouc", val: 580 },
    ],
    totalExports: 14000, totalImports: 11000,
    partners: ["Suisse 25%", "Inde 15%", "Chine 12%", "Union Européenne 18%"],
    opportunities: ["Raffinage or local", "Agro-industrie cacao", "Corridor Tema-Burkina"],
    risks: ["Volatilité cours de l'or", "Dette publique élevée", "Dépréciation cédi"],
    gdpGrowth: 3.8, currency: "GHS",
  },
  SN: {
    president: "Bassirou Diomaye Faye", presidentSince: "avril 2024",
    capitale: "Dakar", siegeEconomique: "Dakar",
    superficie: 196722,
    matieres_premieres: ["Phosphates", "Or", "Poissons & fruits de mer", "Pétrole offshore (Sangomar)", "Gaz naturel (GTA)", "Arachides", "Sel", "Zircon", "Titanite"],
    exports: [
      { cat: "Or & phosphates", val: 2100 },    { cat: "Poissons & prod. marins", val: 520 },
      { cat: "Arachides & huiles", val: 310 },  { cat: "Engrais chimiques", val: 280 },
      { cat: "Pétrole (émergent)", val: 180 },
    ],
    imports: [
      { cat: "Prod. pétroliers raffinés", val: 1500 }, { cat: "Riz & céréales", val: 720 },
      { cat: "Machines & équipements", val: 640 },     { cat: "Véhicules", val: 380 },
      { cat: "Médicaments", val: 260 },
    ],
    totalExports: 3400, totalImports: 4200,
    partners: ["Mali 18%", "Suisse 14%", "Chine 11%", "Inde 10%"],
    opportunities: ["Hydrocarbures offshore (Sangomar)", "Hub financier UEMOA", "Pêche industrielle durable"],
    risks: ["Déficit commercial structurel", "Dépendance réexportations", "Sécheresse sahélienne"],
    gdpGrowth: 8.3, currency: "XOF",
  },
  BF: {
    president: "Ibrahim Traoré (Capitaine)", presidentSince: "sept. 2022 (MPSR II)",
    capitale: "Ouagadougou", siegeEconomique: "Ouagadougou",
    superficie: 274200,
    matieres_premieres: ["Or", "Zinc", "Cuivre", "Manganèse", "Phosphate", "Calcaire", "Coton", "Bauxite", "Charbon", "Nickel"],
    exports: [
      { cat: "Or", val: 2800 },       { cat: "Coton brut", val: 290 },
      { cat: "Noix de cajou", val: 180 }, { cat: "Sésame", val: 120 },
      { cat: "Zinc & minerais", val: 90 },
    ],
    imports: [
      { cat: "Prod. pétroliers", val: 800 }, { cat: "Machines", val: 620 },
      { cat: "Riz & blé", val: 450 },        { cat: "Électricité importée", val: 200 },
      { cat: "Médicaments", val: 180 },
    ],
    totalExports: 3200, totalImports: 2800,
    partners: ["Suisse 60%", "Côte d'Ivoire 12%", "Inde 8%", "Chine 6%"],
    opportunities: ["Corridor Abidjan-Ouaga", "Transformation coton", "Énergie solaire Sahel"],
    risks: ["Enclavement géographique total", "Instabilité sécuritaire", "Concentration export sur l'or"],
    gdpGrowth: 5.9, currency: "XOF",
  },
  ML: {
    president: "Assimi Goïta (Colonel)", presidentSince: "2021 (mandat renouvelé 2025–2030)",
    capitale: "Bamako", siegeEconomique: "Bamako",
    superficie: 1250000,
    matieres_premieres: ["Or (3e africain)", "Sel", "Coton", "Uranium", "Diamants", "Cuivre", "Minerai de fer", "Bauxite", "Phosphate", "Calcaire"],
    exports: [
      { cat: "Or", val: 2400 },       { cat: "Coton brut", val: 220 },
      { cat: "Sésame", val: 100 },    { cat: "Bétail vif", val: 80 },
      { cat: "Karité", val: 45 },
    ],
    imports: [
      { cat: "Prod. pétroliers", val: 700 }, { cat: "Machines", val: 580 },
      { cat: "Riz & denrées", val: 420 },    { cat: "Médicaments", val: 160 },
      { cat: "Ciment & matériaux", val: 140 },
    ],
    totalExports: 2800, totalImports: 2600,
    partners: ["Suisse 45%", "Côte d'Ivoire 14%", "Chine 10%", "Sénégal 8%"],
    opportunities: ["Transformation or locale", "Agro-industrie coton", "Élevage bovin export"],
    risks: ["Enclavement total", "Instabilité politique persistante", "Tensions avec CEDEAO"],
    gdpGrowth: 3.1, currency: "XOF",
  },
  GN: {
    president: "Mamady Doumbouya (Colonel)", presidentSince: "janv. 2026 (élu 86,7%)",
    capitale: "Conakry", siegeEconomique: "Conakry",
    superficie: 245857,
    matieres_premieres: ["Bauxite (2e mondial)", "Or", "Diamants", "Minerai de fer (Simandou)", "Aluminium", "Uranium", "Cobalt", "Platine", "Chromite"],
    exports: [
      { cat: "Bauxite", val: 1800 },      { cat: "Or", val: 480 },
      { cat: "Diamants", val: 120 },      { cat: "Fer Simandou (proj.)", val: 80 },
      { cat: "Café & cacao", val: 60 },
    ],
    imports: [
      { cat: "Prod. pétroliers", val: 620 }, { cat: "Machines & équipements", val: 580 },
      { cat: "Riz & denrées", val: 480 },    { cat: "Ciment", val: 200 },
      { cat: "Véhicules", val: 180 },
    ],
    totalExports: 2500, totalImports: 2200,
    partners: ["Chine 48%", "Ghana 10%", "Union Européenne 18%", "Inde 9%"],
    opportunities: ["Aluminium Simandou (>20Mrd$)", "Hydro-électricité export", "Agriculture tropicale"],
    risks: ["Hyper-dépendance bauxite-Chine", "Transition politique", "Infrastructures minières insuffisantes"],
    gdpGrowth: 5.6, currency: "GNF",
  },
  BJ: {
    president: "Patrice Talon", presidentSince: "2016 (réélu 2021)",
    capitale: "Porto-Novo", siegeEconomique: "Cotonou",
    superficie: 112622,
    matieres_premieres: ["Coton", "Or", "Huile de palme", "Calcaire", "Marbre", "Phosphate", "Cacao", "Café", "Noix de cajou", "Karité"],
    exports: [
      { cat: "Coton brut", val: 620 }, { cat: "Noix de cajou", val: 280 },
      { cat: "Or", val: 180 },         { cat: "Ananas & fruits", val: 90 },
      { cat: "Sésame", val: 60 },
    ],
    imports: [
      { cat: "Prod. pétroliers", val: 680 }, { cat: "Machines", val: 480 },
      { cat: "Riz & blé", val: 360 },        { cat: "Véhicules", val: 240 },
      { cat: "Médicaments", val: 120 },
    ],
    totalExports: 1400, totalImports: 2000,
    partners: ["Inde 28%", "Bangladesh 18%", "Chine 12%", "Ghana 8%"],
    opportunities: ["Port de Cotonou hub régional", "Transit Nigeria-Niger-Mali", "Agro-industrie coton"],
    risks: ["Déficit commercial chronique", "Concurrence port de Lomé", "Dépendance réexport Nigeria"],
    gdpGrowth: 5.7, currency: "XOF",
  },
  TG: {
    president: "Faure Gnassingbé", presidentSince: "2005 (réélu 2020)",
    capitale: "Lomé", siegeEconomique: "Lomé",
    superficie: 56785,
    matieres_premieres: ["Phosphate (4e réserves mondial)", "Calcaire", "Minerai de fer", "Bauxite", "Uranium", "Chromite", "Or", "Diamants", "Rutile"],
    exports: [
      { cat: "Or & ré-exports", val: 580 }, { cat: "Phosphates", val: 340 },
      { cat: "Coton brut", val: 160 },      { cat: "Clinker ciment", val: 80 },
      { cat: "Café & cacao", val: 50 },
    ],
    imports: [
      { cat: "Prod. pétroliers", val: 720 }, { cat: "Machines", val: 540 },
      { cat: "Riz & céréales", val: 380 },   { cat: "Véhicules", val: 220 },
      { cat: "Acier", val: 180 },
    ],
    totalExports: 1300, totalImports: 2100,
    partners: ["Bénin 14%", "Burkina Faso 12%", "Ghana 10%", "Inde 9%"],
    opportunities: ["Hub port de Lomé (eau profonde)", "Phosphates valeur ajoutée", "Zone franche Lomé"],
    risks: ["Déficit commercial structurel", "Dépendance activité de transit", "Fragilité cours phosphates"],
    gdpGrowth: 5.5, currency: "XOF",
  },
  NE: {
    president: "Abdourahamane Tchiani (Général)", presidentSince: "mars 2025 (mandat 5 ans)",
    capitale: "Niamey", siegeEconomique: "Niamey",
    superficie: 1270000,
    matieres_premieres: ["Uranium (4e mondial)", "Pétrole brut (Agadem)", "Or", "Charbon", "Sel", "Gypse", "Phosphate", "Étain", "Fer"],
    exports: [
      { cat: "Uranium", val: 610 },       { cat: "Or", val: 280 },
      { cat: "Pétrole brut", val: 220 },  { cat: "Oignons & légumes", val: 80 },
      { cat: "Bétail vif", val: 70 },
    ],
    imports: [
      { cat: "Prod. pétroliers", val: 480 }, { cat: "Machines", val: 380 },
      { cat: "Riz & denrées", val: 340 },    { cat: "Électricité importée", val: 120 },
      { cat: "Médicaments", val: 100 },
    ],
    totalExports: 1100, totalImports: 1500,
    partners: ["France 45%", "Chine 20%", "Nigeria 8%", "Union Européenne 12%"],
    opportunities: ["Uranium (énergie nucléaire mondiale)", "Pipeline pétrole-Cotonou", "Agriculture irriguée Niger"],
    risks: ["Double enclavement géographique", "Instabilité sécuritaire Sahel", "Volatilité cours uranium"],
    gdpGrowth: 7.0, currency: "XOF",
  },
  MR: {
    president: "Mohamed Ould Ghazouani", presidentSince: "2019 (réélu juil. 2024)",
    capitale: "Nouakchott", siegeEconomique: "Nouakchott",
    superficie: 1030700,
    matieres_premieres: ["Minerai de fer (46% exports)", "Or", "Poissons & fruits de mer", "Cuivre", "Gypse", "Phosphate", "Gaz naturel (GTA offshore)", "Sel", "Uranium"],
    exports: [
      { cat: "Minerai de fer", val: 1200 },     { cat: "Or", val: 380 },
      { cat: "Poissons & fruits de mer", val: 310 }, { cat: "Cuivre", val: 80 },
      { cat: "Gaz naturel (émergent)", val: 60 },
    ],
    imports: [
      { cat: "Prod. pétroliers", val: 520 }, { cat: "Machines", val: 420 },
      { cat: "Riz & blé", val: 380 },        { cat: "Ciment & matériaux", val: 160 },
      { cat: "Médicaments", val: 120 },
    ],
    totalExports: 1900, totalImports: 1600,
    partners: ["Chine 32%", "Suisse 18%", "Union Européenne 22%", "Japon 8%"],
    opportunities: ["Gaz offshore Grand Tortue Ahmeyim", "Pêche durable certifiée MSC", "Énergie éolienne côtière"],
    risks: ["Désertification avancée", "Concentration export fer-or", "Faible diversification industrielle"],
    gdpGrowth: 5.4, currency: "MRU",
  },
  GW: {
    president: "Transition militaire en cours", presidentSince: "Élections prévues déc. 2026",
    capitale: "Bissau", siegeEconomique: "Bissau",
    superficie: 36125,
    matieres_premieres: ["Noix de cajou (93% exports)", "Poissons & crustacés", "Arachides", "Bois tropical", "Kaolin", "Phosphate", "Bauxite (non exploitée)", "Pétrole (offshore non développé)"],
    exports: [
      { cat: "Noix de cajou", val: 150 }, { cat: "Poissons", val: 22 },
      { cat: "Bois tropical", val: 8 },
    ],
    imports: [
      { cat: "Prod. pétroliers", val: 90 }, { cat: "Riz & denrées", val: 80 },
      { cat: "Machines", val: 60 },         { cat: "Médicaments", val: 30 },
    ],
    totalExports: 180, totalImports: 280,
    partners: ["Inde 80%", "Chine 8%", "Sénégal 5%", "Portugal 3%"],
    opportunities: ["Diversification du cajou (transformation locale)", "Pêche industrielle certifiée", "Tourisme balnéaire"],
    risks: ["Mono-dépendance noix de cajou (>80%)", "Instabilité politique chronique", "Absence d'infrastructures"],
    gdpGrowth: 4.2, currency: "XOF",
  },
  SL: {
    president: "Julius Maada Bio", presidentSince: "2018 (réélu 2023)",
    capitale: "Freetown", siegeEconomique: "Freetown",
    superficie: 71740,
    matieres_premieres: ["Diamants", "Rutile (1er mondial naturel)", "Bauxite", "Minerai de fer", "Or", "Tantale", "Coltan", "Chromite", "Platine", "Ilménite"],
    exports: [
      { cat: "Rutile & ilménite", val: 460 }, { cat: "Or", val: 240 },
      { cat: "Diamants", val: 130 },          { cat: "Cacao", val: 50 },
      { cat: "Café", val: 20 },
    ],
    imports: [
      { cat: "Prod. pétroliers", val: 400 }, { cat: "Riz & céréales", val: 280 },
      { cat: "Machines", val: 240 },         { cat: "Médicaments", val: 130 },
      { cat: "Ciment", val: 80 },
    ],
    totalExports: 900, totalImports: 1200,
    partners: ["Chine 28%", "Belgique 18%", "Inde 12%", "Union Européenne 15%"],
    opportunities: ["Minéraux stratégiques VE (rutile)", "Port de Freetown modernisé", "Cacao premium niche"],
    risks: ["Déficit commercial persistant", "Dépendance aide internationale", "Fragilité institutionnelle"],
    gdpGrowth: 4.8, currency: "SLL",
  },
  LR: {
    president: "Joseph Nyuma Boakai", presidentSince: "janv. 2024",
    capitale: "Monrovia", siegeEconomique: "Monrovia",
    superficie: 99067,
    matieres_premieres: ["Caoutchouc naturel (Firestone)", "Minerai de fer", "Or", "Diamants", "Bois tropical", "Bauxite", "Graphite", "Kyanite", "Tantale"],
    exports: [
      { cat: "Caoutchouc naturel", val: 320 }, { cat: "Minerai de fer", val: 240 },
      { cat: "Or", val: 80 },                  { cat: "Bois tropical", val: 50 },
      { cat: "Cacao", val: 30 },
    ],
    imports: [
      { cat: "Prod. pétroliers", val: 420 }, { cat: "Riz & céréales", val: 280 },
      { cat: "Machines", val: 220 },         { cat: "Véhicules", val: 120 },
      { cat: "Médicaments", val: 80 },
    ],
    totalExports: 700, totalImports: 1100,
    partners: ["Suisse 22%", "Chine 18%", "Union Européenne 20%", "Inde 12%"],
    opportunities: ["Caoutchouc valeur ajoutée (Firestone)", "Registre maritime (2ème mondial)", "Fer ArcelorMittal"],
    risks: ["Déficit commercial chronique", "Fragilité post-conflit", "Dépendance caoutchouc/fer"],
    gdpGrowth: 4.5, currency: "LRD",
  },
  GM: {
    president: "Adama Barrow", presidentSince: "2017 (réélu 2021)",
    capitale: "Banjul", siegeEconomique: "Banjul",
    superficie: 11295,
    matieres_premieres: ["Arachides (70% exports)", "Poissons & crustacés", "Noix de cajou", "Sésame", "Coton", "Sel", "Argile", "Titanite (offshore potentiel)"],
    exports: [
      { cat: "Arachides & huiles", val: 100 }, { cat: "Poissons", val: 80 },
      { cat: "Noix de cajou", val: 45 },       { cat: "Coton", val: 20 },
    ],
    imports: [
      { cat: "Prod. pétroliers", val: 150 }, { cat: "Riz & blé", val: 120 },
      { cat: "Machines", val: 80 },          { cat: "Médicaments", val: 50 },
      { cat: "Véhicules", val: 30 },
    ],
    totalExports: 250, totalImports: 430,
    partners: ["Chine 28%", "Inde 22%", "Sénégal 18%", "Union Européenne 12%"],
    opportunities: ["Tourisme (côte Atlantique)", "Pêche durable certifiée", "Hub logistique sous-régional"],
    risks: ["Déficit commercial structurel", "Enclavement dans le Sénégal", "Faible industrialisation"],
    gdpGrowth: 5.0, currency: "GMD",
  },
  CV: {
    president: "José Maria Pereira Neves", presidentSince: "2021",
    capitale: "Praia", siegeEconomique: "Praia",
    superficie: 4033,
    matieres_premieres: ["Poissons & crustacés", "Sel marin", "Pouzzolane (roche volcanique)", "Calcaire", "Kaolin", "Argile", "Basalte", "Gypse"],
    exports: [
      { cat: "Poissons & crustacés", val: 90 }, { cat: "Chaussures & textiles", val: 50 },
      { cat: "Sel marin", val: 20 },             { cat: "Boissons & alcools", val: 15 },
    ],
    imports: [
      { cat: "Prod. pétroliers", val: 280 },      { cat: "Riz & denrées alimentaires", val: 200 },
      { cat: "Machines & équipements", val: 180 }, { cat: "Véhicules", val: 100 },
      { cat: "Matériaux construction", val: 80 },
    ],
    totalExports: 180, totalImports: 850,
    partners: ["Portugal 45%", "Espagne 18%", "Union Européenne 25%", "Brésil 4%"],
    opportunities: ["Tourisme haut de gamme insulaire", "Énergie renouvelable (solaire/éolien)", "Hub maritime Atlantique"],
    risks: ["Déficit commercial très élevé (>78%)", "Dépendance import alimentaire totale", "Isolement insulaire structurel"],
    gdpGrowth: 4.6, currency: "CVE",
  },
};
// ─────────────────────────────────────────────────────────────────────────────


const AGENT_CAPABILITIES = [
  "📊 Analyse en temps réel de l'indice composite WASI",
  "🌍 Indice maritime pays pour les 16 nations CEDEAO",
  "🚢 Suivi activité portuaire : Abidjan, Lagos, Tema, Dakar, Lomé+",
  "📈 Intelligence sectorielle : Agriculture, BTP, Commerce, PME",
  "💹 Génération de signaux ETF pour produits financiers liés au WASI",
  "🔗 Corridors commerciaux & flux transfrontaliers multimodaux",
  "🚂 Module Transport v2 : maritime, aérien, ferroviaire, routier",
  "📰 Signaux d'actualité en direct : RSS africain, événements 72h/7j/14j",
  "🏦 Dossier crédit bancaire : notation COBOL, advisory prêts",
  "🛢️ Prix matières premières temps réel : cacao, pétrole, or, coton (WB Pink Sheet)",
  "📉 Indicateurs macro FMI : PIB, dette/PIB, inflation, compte courant (WEO)",
  "⚡ Accès API institutionnel — données en temps réel, sans abonnement",
];

const SUGGESTED_QUERIES = [
  "Quel est l'indice composite WASI actuel et quel pays tire la croissance ?",
  "Comment le prix du cacao affecte-t-il les indices de CI et Ghana actuellement ?",
  "Comparer la dette publique/PIB et l'inflation du Nigeria vs Côte d'Ivoire selon le FMI",
  "Quel est le signal ETF WASI basé sur la dynamique commerciale régionale actuelle ?",
  "Quels pays enclavés dépendent le plus de l'accès au port d'Abidjan ?",
  "Analysez les indicateurs de stress commercial dans la zone UEMOA",
  "Quel impact le projet Simandou en Guinée aura-t-il sur les prix du minerai de fer ?",
  "Quels secteurs cibler pour un investisseur étranger au Ghana selon les flux commerciaux ?",
];

// ── Fetch historical port data for CI from backend ───────────────────────────
async function fetchHistoricalData(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/country/CI/history?months=60`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

// Fetch 12-month index history for any country
async function fetchCountryHistory(token, countryCode) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/country/${countryCode}/history?months=12`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

// ── Inline markdown renderer ──────────────────────────────────────────────────
function parseBold(text) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((p, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ color: "#e2e8f0", fontWeight: 700 }}>{p}</strong>
      : p
  );
}

function MdLine({ line, idx }) {
  if (line.startsWith("### "))
    return <div key={idx} style={{ color: "#f0b429", fontSize: 15, fontWeight: 700, marginTop: 10, marginBottom: 2, letterSpacing: 1 }}>{line.slice(4)}</div>;
  if (line.startsWith("## "))
    return <div key={idx} style={{ color: "#f0b429", fontSize: 16, fontWeight: 700, marginTop: 12, marginBottom: 3, letterSpacing: 1 }}>{line.slice(3)}</div>;
  if (line.startsWith("# "))
    return <div key={idx} style={{ color: "#f0b429", fontSize: 18, fontWeight: 700, marginTop: 12, marginBottom: 4, letterSpacing: 2 }}>{line.slice(2)}</div>;
  if (line.startsWith("- ") || line.startsWith("* "))
    return <div key={idx} style={{ paddingLeft: 12, marginBottom: 2 }}>· {parseBold(line.slice(2))}</div>;
  if (/^\d+\.\s/.test(line))
    return <div key={idx} style={{ paddingLeft: 12, marginBottom: 2 }}>{parseBold(line)}</div>;
  if (line.trim() === "---" || line.trim() === "___")
    return <hr key={idx} style={{ border: "none", borderTop: "1px solid #1e3a5f", margin: "8px 0" }} />;
  if (line.trim() === "")
    return <div key={idx} style={{ height: 6 }} />;
  return <div key={idx}>{parseBold(line)}</div>;
}

function renderMarkdown(text) {
  return text.split("\n").map((line, i) => <MdLine key={i} line={line} idx={i} />);
}

// ── Composants graphiques SVG ─────────────────────────────────────────────────
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

// ── Transport Mode Panel ──────────────────────────────────────────────────────
function TransportModePanel({ transportData }) {
  const [activeMode, setActiveMode] = React.useState("composite");

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
    if (val >= 40) return { label: "◑  MOYEN", color: "#f0b429" };
    return { label: "○  FAIBLE", color: "#ef4444" };
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
function USSDVisualizationPanel({ ussdData, onClose }) {
  const [activeTab, setActiveTab] = React.useState("overview");
  if (!ussdData) return null;

  const countries = ussdData.countries || [];
  const dateRange = ussdData.date_range || {};
  const totalRecords = ussdData.total_records || 0;
  const TABS = [
    { id: "overview", label: "VUE D'ENSEMBLE" },
    { id: "mobile_money", label: "MOBILE MONEY" },
    { id: "commodities", label: "COMMODITÉS" },
    { id: "trade", label: "COMMERCE" },
    { id: "ports", label: "PORTS" },
  ];

  const panel = { background: "rgba(10,22,40,0.6)", border: "1px solid #0f2a45", borderRadius: 6, padding: "16px 18px", marginBottom: 10 };
  const scoreColor = (v) => v >= 70 ? "#4ade80" : v >= 45 ? "#f0b429" : "#ef4444";

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px", background: "rgba(3,13,26,0.6)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: "#a78bfa", letterSpacing: 4, lineHeight: 1 }}>
            DONNÉES USSD TEMPS RÉEL
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: 2, marginTop: 4 }}>
            MOBILE MONEY · PRIX ALIMENTAIRES · COMMERCE INFORMEL · ACTIVITÉ PORTUAIRE
          </div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
            {totalRecords.toLocaleString()} enregistrements · {countries.length} pays · {dateRange.from || "N/D"} → {dateRange.to || "N/D"}
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "1px solid #1e3a5f", color: "#64748b", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 14, fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>← RETOUR</button>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: "5px 12px", borderRadius: 4, fontSize: 13, letterSpacing: 1.5,
            cursor: "pointer", fontFamily: "'Space Mono', monospace",
            background: activeTab === t.id ? "rgba(167,139,250,0.15)" : "transparent",
            border: `1px solid ${activeTab === t.id ? "#a78bfa" : "#0f2a45"}`,
            color: activeTab === t.id ? "#a78bfa" : "#64748b",
            transition: "all 0.15s",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Overview — composite scores per country */}
      {activeTab === "overview" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
            {countries.sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0)).map((c, i) => {
              const cc = WEST_AFRICAN_COUNTRIES.find(w => w.code === c.country_code);
              const score = c.composite_score || 0;
              return (
                <div key={i} style={{ ...panel, borderColor: scoreColor(score) + "44" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 18 }}>{cc?.flag || "🌍"} <span style={{ fontSize: 14, color: "#94a3b8" }}>{c.country_code}</span></span>
                    <span style={{ fontSize: 26, fontFamily: "'Bebas Neue',sans-serif", color: scoreColor(score), letterSpacing: 2 }}>{score.toFixed(1)}</span>
                  </div>
                  {/* Component bars */}
                  {[
                    { label: "MoMo", val: c.mobile_money_score, color: "#4ade80" },
                    { label: "Prix", val: c.commodity_score, color: "#f0b429" },
                    { label: "Commerce", val: c.trade_score, color: "#38bdf8" },
                    { label: "Port", val: c.port_score, color: "#a78bfa" },
                  ].map((s, j) => (
                    <div key={j} style={{ marginBottom: 3 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
                        <span>{s.label}</span><span style={{ color: s.color }}>{(s.val || 0).toFixed(0)}</span>
                      </div>
                      <div style={{ height: 5, background: "#0a1628", borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${Math.min(100, s.val || 0)}%`, background: s.color, borderRadius: 2, transition: "width 0.5s" }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{c.records || 0} enr. · {c.dates || 0} dates</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile Money tab */}
      {activeTab === "mobile_money" && (
        <div style={panel}>
          <div style={{ fontSize: 14, color: "#4ade80", letterSpacing: 3, marginBottom: 10 }}>FLUX MOBILE MONEY (BCEAO / OPÉRATEURS)</div>
          <div style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.8, marginBottom: 12 }}>
            Données de flux mobile money agrégées par pays — Orange Money, MTN MoMo, Wave, M-Pesa.
            Pondération USSD : <strong style={{ color: "#4ade80" }}>30%</strong> du score composite.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
            {countries.map((c, i) => {
              const cc = WEST_AFRICAN_COUNTRIES.find(w => w.code === c.country_code);
              const score = c.mobile_money_score || 0;
              return (
                <div key={i} style={{ padding: "14px 16px", background: "rgba(74,222,128,0.06)", border: "1px solid #4ade8033", borderRadius: 4 }}>
                  <div style={{ fontSize: 14, color: "#94a3b8" }}>{cc?.flag} {c.country_code}</div>
                  <div style={{ fontSize: 22, fontFamily: "'Bebas Neue',sans-serif", color: scoreColor(score), letterSpacing: 2 }}>{score.toFixed(1)}</div>
                  <div style={{ height: 6, background: "#0a1628", borderRadius: 2, marginTop: 4 }}>
                    <div style={{ height: "100%", width: `${Math.min(100, score)}%`, background: "#4ade80", borderRadius: 2 }} />
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
          <div style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.8, marginBottom: 12 }}>
            Prix des denrées de base collectés via USSD (riz, mil, maïs, sorgho, haricots, huile, sucre).
            Pondération : <strong style={{ color: "#f0b429" }}>20%</strong> du score composite.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
            {countries.map((c, i) => {
              const cc = WEST_AFRICAN_COUNTRIES.find(w => w.code === c.country_code);
              const score = c.commodity_score || 0;
              return (
                <div key={i} style={{ padding: "14px 16px", background: "rgba(240,180,41,0.06)", border: "1px solid #f0b42933", borderRadius: 4 }}>
                  <div style={{ fontSize: 14, color: "#94a3b8" }}>{cc?.flag} {c.country_code}</div>
                  <div style={{ fontSize: 22, fontFamily: "'Bebas Neue',sans-serif", color: scoreColor(score), letterSpacing: 2 }}>{score.toFixed(1)}</div>
                  <div style={{ height: 6, background: "#0a1628", borderRadius: 2, marginTop: 4 }}>
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
          <div style={{ fontSize: 14, color: "#38bdf8", letterSpacing: 3, marginBottom: 10 }}>COMMERCE INFORMEL TRANSFRONTALIER (CILSS)</div>
          <div style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.8, marginBottom: 12 }}>
            Déclarations commerciales informelles — flux camion, valeur USD, corridors actifs.
            Pondération : <strong style={{ color: "#38bdf8" }}>25%</strong> du score composite.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
            {countries.map((c, i) => {
              const cc = WEST_AFRICAN_COUNTRIES.find(w => w.code === c.country_code);
              const score = c.trade_score || 0;
              return (
                <div key={i} style={{ padding: "14px 16px", background: "rgba(56,189,248,0.06)", border: "1px solid #38bdf833", borderRadius: 4 }}>
                  <div style={{ fontSize: 14, color: "#94a3b8" }}>{cc?.flag} {c.country_code}</div>
                  <div style={{ fontSize: 22, fontFamily: "'Bebas Neue',sans-serif", color: scoreColor(score), letterSpacing: 2 }}>{score.toFixed(1)}</div>
                  <div style={{ height: 6, background: "#0a1628", borderRadius: 2, marginTop: 4 }}>
                    <div style={{ height: "100%", width: `${Math.min(100, score)}%`, background: "#38bdf8", borderRadius: 2 }} />
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
          <div style={{ fontSize: 14, color: "#a78bfa", letterSpacing: 3, marginBottom: 10 }}>EFFICACITÉ PORTUAIRE (UNCTAD / PAA)</div>
          <div style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.8, marginBottom: 12 }}>
            Temps de séjour navires, clearance douanière, throughput conteneurs.
            Pondération : <strong style={{ color: "#a78bfa" }}>25%</strong> du score composite.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
            {countries.map((c, i) => {
              const cc = WEST_AFRICAN_COUNTRIES.find(w => w.code === c.country_code);
              const score = c.port_score || 0;
              return (
                <div key={i} style={{ padding: "14px 16px", background: "rgba(167,139,250,0.06)", border: "1px solid #a78bfa33", borderRadius: 4 }}>
                  <div style={{ fontSize: 14, color: "#94a3b8" }}>{cc?.flag} {c.country_code}</div>
                  <div style={{ fontSize: 22, fontFamily: "'Bebas Neue',sans-serif", color: scoreColor(score), letterSpacing: 2 }}>{score.toFixed(1)}</div>
                  <div style={{ height: 6, background: "#0a1628", borderRadius: 2, marginTop: 4 }}>
                    <div style={{ height: "100%", width: `${Math.min(100, score)}%`, background: "#a78bfa", borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div style={{ marginTop: 10, padding: "10px 14px", background: "rgba(167,139,250,0.05)", border: "1px solid #a78bfa33", borderRadius: 4, fontSize: 13, color: "#64748b", lineHeight: 1.7 }}>
        Source : WASI USSD Data Pipeline v3.0 · WFP/HDX (prix alimentaires) · BCEAO (mobile money) · UNCTAD (ports) · CILSS (commerce informel) · Données agrégées automatiquement.
      </div>
    </div>
  );
}

function CountryDashboard({ country, indexValue, onClose, bankContext, transportData, macroData, historyData }) {
  const [modal, setModal] = useState(null);
  const td = COUNTRY_TRADE_DATA[country.code];
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
                  <span style={{ color: "#ef4444", fontSize: 20, flexShrink: 0 }}>⚠</span>
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
                <span style={{ color: c }}>■ {l}</span><span>{v}</span>
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
          <div style={{ fontSize: 13, color: "#ef4444", letterSpacing: 3, marginBottom: 8 }}>⚠ FACTEURS DE RISQUE</div>
          {td.risks.map((r, i) => (
            <div key={i} style={{ fontSize: 14, color: "#94a3b8", padding: "6px 0", borderBottom: "1px solid #0a1628", lineHeight: 1.5 }}>⚠ {r}</div>
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
                    {c.d !== null && <div style={{ fontSize: 12, color: parseFloat(c.d) === 0 ? "#64748b" : parseFloat(c.d) > 0 ? "#4ade80" : "#ef4444", marginTop: 3 }}>{parseFloat(c.d) > 0 ? "▲" : "▼"} {Math.abs(parseFloat(c.d))} vs {prev?.year}</div>}
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
        const tax = COUNTRY_TAX_DATA[country.code];
        if (!tax) return (
          <div style={{ marginTop: 10, padding: "10px 14px", background: "rgba(10,22,40,0.4)", border: "1px solid #0f2a45", borderRadius: 6 }}>
            <div style={{ fontSize: 13, color: "#64748b", letterSpacing: 3 }}>⚖ FISCALITÉ — DONNÉES EN COURS D'INTÉGRATION</div>
            <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>Les données fiscales pour {country.name} seront disponibles prochainement.</div>
          </div>
        );
        const [taxTab, setTaxTab] = React.useState("corporate");
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
// ─────────────────────────────────────────────────────────────────────────────

function IndexCard({ country, index, isActive, onClick, liveSignal }) {
  const trend = index > 65 ? "↑" : index > 45 ? "→" : "↓";
  const trendColor = index > 65 ? "#4ade80" : index > 45 ? "#f0b429" : "#ef4444";
  const adj = liveSignal?.live_adjustment;
  const hasAdj = adj !== undefined && adj !== null && adj !== 0;
  const adjColor = adj > 0 ? "#4ade80" : adj < 0 ? "#ef4444" : "#94a3b8";
  return (
    <button onClick={onClick} style={{
      background: isActive ? "rgba(240,180,41,0.12)" : "rgba(15,31,53,0.8)",
      border: `1px solid ${isActive ? "#f0b429" : "#1e3a5f"}`,
      borderRadius: 8, padding: "14px 16px", textAlign: "left", cursor: "pointer",
      transition: "all 0.2s", width: "100%"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 20 }}>{country.flag}</span>
          <div>
            <div style={{ fontSize: 14, color: "#94a3b8", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>{country.code}</div>
            <div style={{ fontSize: 15, color: "#e2e8f0", fontFamily: "'Space Mono', monospace" }}>{country.name.split(" ")[0]}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontFamily: "'Bebas Neue', sans-serif", color: trendColor, letterSpacing: 2 }}>{Math.round(index)}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
            <span style={{ fontSize: 15, color: trendColor }}>{trend}</span>
            {hasAdj && (
              <span style={{ fontSize: 13, color: adjColor, fontFamily: "'Space Mono', monospace", letterSpacing: 0 }}>
                {adj > 0 ? "+" : ""}{adj.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}


// Demo baseline indices — fixed values based on 2024 WASI estimates.
// In production these are replaced entirely by live backend data (API /indices/latest).
// These only show when the backend is unreachable (MODE DÉMO).
function generateIndices() {
  return { CI: 78, NG: 82, GH: 71, SN: 65, BF: 52, ML: 48, GN: 61, BJ: 58, TG: 63, NE: 44, MR: 55, GW: 41, SL: 46, LR: 49, GM: 39, CV: 57 };
}

function calcWASI(indices) {
  return Math.round(WEST_AFRICAN_COUNTRIES.reduce((sum, c) => sum + (indices[c.code] || 50) * c.weight, 0));
}

// ── Sidebar detail modal (markets + news events) ───────────────────────────
function SidebarDetailModal({ data, onClose }) {
  if (!data) return null;

  const EVENT_META = {
    POLITICAL_RISK:  { color: "#ef4444", icon: "⚠", label: "Risque Politique",     desc: "Instabilité gouvernementale, élections, coups d'état ou tensions sécuritaires affectant les flux commerciaux." },
    PORT_DISRUPTION: { color: "#f97316", icon: "⚓", label: "Perturbation Portuaire",desc: "Grève, incident technique, congestion ou fermeture temporaire d'un port majeur." },
    STRIKE:          { color: "#f0b429", icon: "✊", label: "Grève / Arrêt de travail",desc: "Mouvement social affectant la logistique, les douanes ou les opérations portuaires." },
    COMMODITY_SURGE: { color: "#a78bfa", icon: "📈", label: "Flambée de matières premières",desc: "Hausse soudaine du prix d'une matière première clé exportée par ce pays." },
    POLICY_CHANGE:   { color: "#38bdf8", icon: "📋", label: "Changement de politique",desc: "Nouvelle réglementation douanière, fiscale ou commerciale impactant les échanges." },
  };

  const EXCHANGE_INFO = {
    NGX:  { flag: "🇳🇬", country: "Nigeria",        fullName: "Nigerian Exchange Group",        desc: "La plus grande bourse d'Afrique subsaharienne par capitalisation. Secteurs dominants : banque, pétrole, ciment, télécoms." },
    GSE:  { flag: "🇬🇭", country: "Ghana",           fullName: "Ghana Stock Exchange",           desc: "Bourse de référence en Afrique de l'Ouest anglophone. Secteurs : or, cacao, banque, mines." },
    BRVM: { flag: "🌍",  country: "CEDEAO (8 pays)", fullName: "Bourse Régionale des Valeurs Mobilières", desc: "Bourse commune à 8 pays UEMOA (CI, SN, BJ, TG, ML, BF, NE, GN). Siège à Abidjan. Secteurs : banque, agroalimentaire, télécoms." },
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
            <button onClick={onClose} style={{ background: "none", border: `1px solid ${color}44`, color: color, padding: "8px 18px", borderRadius: 6, cursor: "pointer", fontSize: 16, fontFamily: "'Space Mono',monospace", letterSpacing: 1 }}>✕ FERMER</button>
          </div>
          {/* Main value */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 24 }}>
            {[
              { label: "VALEUR DE L'INDICE", val: m.index_value.toLocaleString("fr-FR", { maximumFractionDigits: 2 }), color: "#e2e8f0", big: true },
              { label: "VARIATION JOURNALIÈRE", val: `${up ? "▲" : "▼"} ${Math.abs(m.change_pct).toFixed(2)}%`, color: color, big: true },
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
    const meta = EVENT_META[e.event_type] || { color: "#38bdf8", icon: "ℹ", label: e.event_type, desc: "" };
    const country = WEST_AFRICAN_COUNTRIES.find(c => c.code === e.country_code) || { name: e.country_code, flag: "🌍" };
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
            <button onClick={onClose} style={{ background: "none", border: `1px solid ${meta.color}44`, color: meta.color, padding: "8px 18px", borderRadius: 6, cursor: "pointer", fontSize: 16, fontFamily: "'Space Mono',monospace", letterSpacing: 1 }}>✕ FERMER</button>
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

// ── Login / Register Page ─────────────────────────────────────────────────────
function LoginPage({ onAuth }) {
  const [mode, setMode]       = useState("login");   // "login" | "register"
  const [username, setUsername] = useState("");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const reset = () => { setError(""); };

  const doRegister = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${BACKEND_API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.detail === "string" ? data.detail : Array.isArray(data.detail) ? data.detail.map(e => e.msg || JSON.stringify(e)).join("; ") : "Erreur lors de l'inscription.");
        setLoading(false); return;
      }
      // Auto-login after register
      await doLogin(true);
    } catch (_) {
      setError("Impossible de joindre le serveur WASI.");
      setLoading(false);
    }
  };

  const doLogin = async (fromRegister = false) => {
    if (!fromRegister) { setLoading(true); setError(""); }
    try {
      const res = await fetch(`${BACKEND_API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `username=${encodeURIComponent(username.trim())}&password=${encodeURIComponent(password)}`,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.detail === "string" ? data.detail : Array.isArray(data.detail) ? data.detail.map(e => e.msg || JSON.stringify(e)).join("; ") : "Identifiants incorrects.");
        setLoading(false); return;
      }
      const token = data.access_token;
      // Fetch user profile
      const meRes = await fetch(`${BACKEND_API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const userInfo = meRes.ok ? await meRes.json() : { username: username.trim() };
      sessionStorage.setItem("wasi_token", token);
      sessionStorage.setItem("wasi_token_ts", Date.now().toString());
      onAuth(token, userInfo);
    } catch (_) {
      setError("Impossible de joindre le serveur WASI.");
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim() || !password) { setError("Champs obligatoires manquants."); return; }
    if (mode === "register") {
      if (!email.trim()) { setError("L'email est obligatoire pour l'inscription."); return; }
      if (password.length < 8) { setError("Le mot de passe doit contenir au moins 8 caractères."); return; }
      doRegister();
    } else {
      doLogin();
    }
  };

  const inp = {
    width: "100%", background: "rgba(15,42,69,0.6)", border: "1px solid #1e3a5f",
    borderRadius: 4, padding: "14px 18px", color: "#e2e8f0", fontSize: 15,
    fontFamily: "'Space Mono', monospace", outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#030d1a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Space Mono', monospace", position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #f0b429; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeUp { from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }
        .auth-input:focus { border-color: #f0b429 !important; }
        .auth-btn:hover:not(:disabled) { background: #f0b429 !important; color: #030d1a !important; }
        .tab-btn:hover { color: #f0b429 !important; }
      `}</style>

      {/* Background grid */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#0f2a4511 1px, transparent 1px), linear-gradient(90deg, #0f2a4511 1px, transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" }} />

      {/* Card */}
      <div style={{ position: "relative", width: "100%", maxWidth: 480, animation: "fadeUp 0.4s ease" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 10, color: "#f0b429", lineHeight: 1 }}>WASI</div>
          <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: 4, marginTop: 4 }}>INTELLIGENCE ÉCONOMIQUE · CEDEAO · 16 NATIONS</div>
        </div>

        <div style={{ background: "rgba(7,25,46,0.95)", border: "1px solid #0f2a45", borderRadius: 8, padding: "40px 44px", backdropFilter: "blur(12px)" }}>

          {/* Mode tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #0f2a45", marginBottom: 28 }}>
            {[["login", "CONNEXION"], ["register", "INSCRIPTION"]].map(([m, label]) => (
              <button key={m} className="tab-btn" onClick={() => { setMode(m); reset(); }} style={{
                flex: 1, background: "none", border: "none", cursor: "pointer",
                padding: "10px 0", fontSize: 14, letterSpacing: 2,
                fontFamily: "'Space Mono', monospace",
                color: mode === m ? "#f0b429" : "#64748b",
                borderBottom: mode === m ? "2px solid #f0b429" : "2px solid transparent",
                marginBottom: -1, transition: "color 0.2s",
              }}>{label}</button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Username */}
            <div>
              <div style={{ fontSize: 13, color: "#64748b", letterSpacing: 2, marginBottom: 6 }}>IDENTIFIANT</div>
              <input className="auth-input" style={inp} type="text" placeholder="ex: trader_wasi" value={username}
                onChange={e => setUsername(e.target.value)} autoComplete="username" />
            </div>

            {/* Email — register only */}
            {mode === "register" && (
              <div>
                <div style={{ fontSize: 13, color: "#64748b", letterSpacing: 2, marginBottom: 6 }}>ADRESSE EMAIL</div>
                <input className="auth-input" style={inp} type="email" placeholder="vous@exemple.com" value={email}
                  onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </div>
            )}

            {/* Password */}
            <div>
              <div style={{ fontSize: 13, color: "#64748b", letterSpacing: 2, marginBottom: 6 }}>MOT DE PASSE {mode === "register" && <span style={{ color: "#475569" }}>(min. 8 caractères)</span>}</div>
              <div style={{ position: "relative" }}>
                <input className="auth-input" style={{ ...inp, paddingRight: 42 }} type={showPwd ? "text" : "password"}
                  placeholder={mode === "register" ? "Au moins 8 caractères" : "••••••••"} value={password}
                  onChange={e => setPassword(e.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} />
                <button type="button" onClick={() => setShowPwd(p => !p)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 15 }}>
                  {showPwd ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ padding: "14px 16px", background: "rgba(239,68,68,0.08)", border: "1px solid #ef444444", borderRadius: 4, fontSize: 14, color: "#ef4444", lineHeight: 1.6 }}>
                ⚠ {typeof error === "string" ? error : JSON.stringify(error)}
              </div>
            )}

            {/* Submit */}
            <button type="submit" className="auth-btn" disabled={loading} style={{
              marginTop: 6, padding: "13px", background: "transparent",
              border: "1px solid #f0b429", color: "#f0b429", borderRadius: 4,
              cursor: loading ? "not-allowed" : "pointer", fontSize: 15,
              fontFamily: "'Space Mono', monospace", fontWeight: 700, letterSpacing: 2,
              transition: "all 0.2s", opacity: loading ? 0.6 : 1,
            }}>
              {loading ? "CONNEXION EN COURS…" : mode === "login" ? "ACCÉDER À LA PLATEFORME →" : "CRÉER MON COMPTE →"}
            </button>
          </form>

          {/* Switch mode link */}
          <div style={{ marginTop: 20, textAlign: "center", fontSize: 14, color: "#64748b" }}>
            {mode === "login" ? (
              <>Pas encore de compte ?{" "}
                <span onClick={() => { setMode("register"); reset(); }} style={{ color: "#f0b429", cursor: "pointer", textDecoration: "underline" }}>
                  S'inscrire gratuitement
                </span>
              </>
            ) : (
              <>Déjà inscrit ?{" "}
                <span onClick={() => { setMode("login"); reset(); }} style={{ color: "#f0b429", cursor: "pointer", textDecoration: "underline" }}>
                  Se connecter
                </span>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#1e3a5f", letterSpacing: 2 }}>
          WASI INTELLIGENCE PLATFORM v3.0 · © 2025–2026 · DONNÉES ECOWAS TEMPS RÉEL
        </div>
      </div>
    </div>
  );
}

function WASIAgent({ authToken, userInfo, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [indices, setIndices] = useState(generateIndices());
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [wasiComposite, setWasiComposite] = useState(0);
  const [showCapabilities, setShowCapabilities] = useState(true);
  const [backendConnected, setBackendConnected] = useState(false);
  const [backendToken, setBackendToken] = useState(null);
  const [dataSource, setDataSource] = useState("simulation");
  const [historicalData, setHistoricalData] = useState([]);
  const [showDashboard, setShowDashboard] = useState(false);
  const [stockMarkets, setStockMarkets] = useState([]);
  const [divergenceSignals, setDivergenceSignals] = useState([]);
  const [liveSignals, setLiveSignals] = useState({});
  const [newsEvents, setNewsEvents] = useState([]);
  const [sidebarModal, setSidebarModal] = useState(null); // { type: "market"|"event", data: {...} }
  const [bankContextCache, setBankContextCache] = useState({}); // keyed by country code
  const [transportCache, setTransportCache] = useState({});    // keyed by country code
  const [commodityPrices, setCommodityPrices] = useState([]);  // WB Pink Sheet
  const [macroCache, setMacroCache] = useState({});            // IMF WEO, keyed by country code
  const [historyCache, setHistoryCache] = useState({});        // 12-month index history, keyed by country code
  const [mobilePanel, setMobilePanel] = useState("center");     // "left" | "center" | "right"
  const [ussdData, setUssdData] = useState(null);               // USSD aggregate data
  const [ussdLoading, setUssdLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // ── Connect to backend when authToken is available ────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function connectBackend() {
      const token = authToken;
      if (cancelled || !token) return;
      setBackendToken(token);
      setBackendConnected(true);

      // Fetch real indices
      const realIndices = await fetchBackendIndices(token);
      if (cancelled) return;
      if (realIndices && Object.keys(realIndices).length > 0) {
        // Merge backend real data with simulation fallback for countries not yet in backend
        const simulated = generateIndices();
        const merged = { ...simulated, ...realIndices };
        setIndices(merged);
        setDataSource("live");
      }

      // Fetch composite
      const composite = await fetchBackendComposite(token);
      if (cancelled) return;
      if (composite !== null) {
        setWasiComposite(Math.round(composite));
      }

      // Fetch historical port data (CI / Abidjan — 5 years)
      const hist = await fetchHistoricalData(token);
      if (cancelled) return;
      if (hist && hist.length > 0) setHistoricalData(hist);

      // Fetch stock market data (NGX, GSE, BRVM)
      const stocks = await fetchStockMarkets(token);
      if (cancelled) return;
      if (stocks && stocks.length > 0) setStockMarkets(stocks);

      // Fetch divergence signals
      const divs = await fetchDivergence(token);
      if (cancelled) return;
      if (divs && divs.length > 0) setDivergenceSignals(divs);

      // Fetch live signals (v2) — base + news adjustment per country
      const signals = await fetchLiveSignals(token);
      if (cancelled) return;
      if (signals && Object.keys(signals).length > 0) setLiveSignals(signals);

      // Fetch active news events (v2)
      const events = await fetchNewsEvents(token);
      if (cancelled) return;
      if (events) setNewsEvents(events);

      // Fetch commodity prices (WB Pink Sheet)
      const commodities = await fetchCommodityPrices(token);
      if (cancelled) return;
      if (commodities && commodities.length > 0) setCommodityPrices(commodities);

      // Fetch USSD aggregate data
      const ussd = await fetchUSSDAggregate(token);
      if (cancelled) return;
      if (ussd) setUssdData(ussd);
    }
    connectBackend();
    return () => { cancelled = true; };
  }, [authToken]);

  // ── Periodic refresh (simulation fallback if backend down) ────────────────
  useEffect(() => {
    setWasiComposite(prev => prev || calcWASI(indices));
    const interval = setInterval(async () => {
      if (backendConnected && backendToken) {
        const realIndices = await fetchBackendIndices(backendToken);
        if (realIndices && Object.keys(realIndices).length > 0) {
          const simulated = generateIndices();
          const merged = { ...simulated, ...realIndices };
          setIndices(merged);
          setDataSource("live");
        } else {
          const newIndices = generateIndices();
          setIndices(newIndices);
          setWasiComposite(calcWASI(newIndices));
          setDataSource("simulation");
        }
        const composite = await fetchBackendComposite(backendToken);
        if (composite !== null) setWasiComposite(Math.round(composite));
      } else {
        const newIndices = generateIndices();
        setIndices(newIndices);
        setWasiComposite(calcWASI(newIndices));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [backendConnected, backendToken]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch bank context whenever a country is selected (cache to avoid re-fetching)
  useEffect(() => {
    if (!selectedCountry || !backendToken) return;
    const code = selectedCountry.code;
    if (bankContextCache[code]) return; // already cached
    fetchBankContext(backendToken, code).then(data => {
      if (data) setBankContextCache(prev => ({ ...prev, [code]: data }));
    });
  }, [selectedCountry, backendToken]);

  // Fetch transport mode comparison whenever a country is selected
  useEffect(() => {
    if (!selectedCountry || !backendToken) return;
    const code = selectedCountry.code;
    if (transportCache[code]) return; // already cached
    (async () => {
      try {
        const res = await fetch(`${BACKEND_API_URL}/api/v2/transport/mode-comparison/${code}`, {
          headers: { Authorization: `Bearer ${backendToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setTransportCache(prev => ({ ...prev, [code]: data }));
        }
      } catch (_) {}
    })();
  }, [selectedCountry, backendToken]);

  // Fetch IMF WEO macro data whenever a country is selected
  useEffect(() => {
    if (!selectedCountry || !backendToken) return;
    const code = selectedCountry.code;
    if (macroCache[code]) return; // already cached
    fetchMacroData(backendToken, code).then(data => {
      if (data) setMacroCache(prev => ({ ...prev, [code]: data }));
    });
  }, [selectedCountry, backendToken]);

  // Fetch 12-month index history whenever a country is selected
  useEffect(() => {
    if (!selectedCountry || !backendToken) return;
    const code = selectedCountry.code;
    if (historyCache[code]) return; // already cached
    fetchCountryHistory(backendToken, code).then(data => {
      if (data && data.length > 0) setHistoryCache(prev => ({ ...prev, [code]: data }));
    });
  }, [selectedCountry, backendToken]);

  const buildSystemPrompt = () => {
    const countryData = WEST_AFRICAN_COUNTRIES.map(c => 
      `${c.flag} ${c.name} (${c.code}): Index ${indices[c.code]}/100 | Port: ${c.port} | Weight: ${(c.weight*100).toFixed(1)}%`
    ).join("\n");

    return `You are the WASI AI Agent v3.0 — the world's premier AI-powered West African Economic Intelligence system. You are a multidisciplinary expert combining deep knowledge of shipping, trade, macroeconomics, banking, and public finance. You advise central bankers, finance ministers, institutional investors, and heads of state. You speak with the authority of a senior economist who has served at the IMF, World Bank, and a Tier-1 investment bank simultaneously.

CURRENT LIVE DATA (${new Date().toLocaleDateString()}):
WASI Composite Index: ${wasiComposite}/100
Data Source: ${backendConnected ? "WASI Backend API v3.0 — ECOWAS 16 pays (LIVE)" : "Simulation Mode"}
Access: FULL | Mode: INTELLIGENCE PLATFORM

${stockMarkets.length > 0 ? `WEST AFRICAN STOCK MARKETS:
${stockMarkets.map(m => `${m.exchange_code} ${m.index_name}: ${m.index_value.toFixed(2)} (${m.change_pct >= 0 ? '+' : ''}${m.change_pct.toFixed(2)}% today, YTD ${m.ytd_change_pct >= 0 ? '+' : ''}${m.ytd_change_pct?.toFixed(1)}%, cap ${(m.market_cap_usd/1e9).toFixed(1)}Mrd USD)`).join("\n")}` : ""}

${Object.keys(liveSignals).length > 0 ? `LIVE SIGNAL ADJUSTMENTS (news-driven, updated hourly):
${Object.entries(liveSignals).map(([code, s]) => `${code}: base=${s.base_index?.toFixed(1)} adj=${s.live_adjustment >= 0 ? '+' : ''}${s.live_adjustment?.toFixed(1)} → ${s.adjusted_index?.toFixed(1)}/100`).join("\n")}` : ""}

${newsEvents.length > 0 ? `ACTIVE NEWS EVENTS (${newsEvents.length} total):
${newsEvents.slice(0, 5).map(e => `[${e.event_type}] ${e.country_code}: "${e.headline?.slice(0, 80)}" (${e.magnitude >= 0 ? '+' : ''}${e.magnitude} pts, expires ${new Date(e.expires_at).toLocaleDateString()})`).join("\n")}` : ""}

${commodityPrices.length > 0 ? `WB PINK SHEET COMMODITY PRICES (latest monthly averages):
${commodityPrices.map(p => `${p.name} (${p.code}): $${p.price_usd}/${p.unit} | MoM ${p.mom_pct !== null ? (p.mom_pct >= 0 ? '+' : '') + p.mom_pct + '%' : 'N/A'} | YoY ${p.yoy_pct !== null ? (p.yoy_pct >= 0 ? '+' : '') + p.yoy_pct + '%' : 'N/A'} | Period: ${p.period}`).join("\n")}
Note: Cocoa & cotton are critical for ECOWAS export revenues (CI, GH, ML, BF, BJ, TG).
Brent crude drives NG, CI, GH fiscal revenues. Gold anchors GH, ML, BF, GN export baskets.` : ""}

${selectedCountry && macroCache[selectedCountry.code] ? `IMF WEO MACRO INDICATORS — ${selectedCountry.name} (${selectedCountry.code}):
${(macroCache[selectedCountry.code].years || []).slice(0, 3).map(y => `${y.year}${y.is_projection ? ' (proj.)' : ''}: GDP Growth ${y.gdp_growth_pct !== null ? y.gdp_growth_pct + '%' : 'N/A'} | Inflation ${y.inflation_pct !== null ? y.inflation_pct + '%' : 'N/A'} | Debt/GDP ${y.debt_gdp_pct !== null ? y.debt_gdp_pct + '%' : 'N/A'} | CA/GDP ${y.current_account_gdp_pct !== null ? y.current_account_gdp_pct + '%' : 'N/A'}`).join("\n")}
Source: IMF World Economic Outlook API (live).` : ""}

COUNTRY INDICES (Real-time simulation):
${countryData}

YOUR CAPABILITIES:
COMMERCE & TRANSPORT
- Analyze shipping and trade flow across all 16 West African nations
- Generate country-level index reports with sector breakdowns
- Flag trade corridor stress, port disruption, and opportunity zones
- Signal ETF momentum based on composite index movement

FINANCE & BANQUE
- Identify the best banks and lowest lending rates by country and sector
- Compute WACC, credit scoring, and loan advisory for any West African country
- Advise on capital markets, eurobond issuance, and sukuk structuring
- Analyze WAEMU monetary dynamics and CFA franc implications
- Guide on correspondent banking, trade finance, letters of credit

MACROÉCONOMIE & CONSEIL GOUVERNEMENTAL
- Draft fiscal consolidation plans with IMF/World Bank methodology
- Advise finance ministers on budget, tax reform, and public debt management
- Design sovereign debt restructuring strategies and investor communication
- Monitor UEMOA fiscal convergence criteria and recommend corrective action
- Analyze central bank monetary policy and propose interest rate pathways
- Guide AfCFTA implementation, trade policy, and industrial zone strategy
- Advise on natural resource revenue management (oil, gas, mining royalties)
- Provide investment climate reform roadmaps for foreign direct investment
- Design conditional cash transfer and social protection programs
- Evaluate PPP structures for infrastructure projects (ports, roads, energy)

INDEX METHODOLOGY:
- Components: Ship arrivals (40%), Cargo tonnage (40%), Container throughput (20%)
- Base: 100 (normalized to 5-year historical average)
- Above 70: Strong expansion | 50-70: Stable | Below 50: Contraction signal

RESPONSE STANDARD — PROFESSIONAL ADVISORY GRADE:
Adapt your response structure to the type of question:

FOR SHIPPING / TRADE QUESTIONS:
1. REGIONAL OVERVIEW — WASI composite + corridor context
2. COUNTRY DETAIL — Port indices, freight flows, disruption signals
3. SIGNAL — Investment/trade implication

FOR BANKING / FINANCE QUESTIONS:
1. CONTEXTE RÉGLEMENTAIRE — Banque centrale, taux directeur, devise
2. INSTITUTIONS RECOMMANDÉES — Banques classées par compétitivité tarifaire
3. ANALYSE — Taux, conditions, risques, alternatives
4. RECOMMANDATION ACTIONNABLE — Banque et produit financier précis

FOR GOVERNMENT / POLICY QUESTIONS:
1. DIAGNOSTIC — Situation actuelle avec données macro et WASI
2. ANALYSE STRUCTURELLE — Contraintes institutionnelles, politiques, financières
3. OPTIONS POLITIQUES — 2–3 scénarios chiffrés avec trade-offs explicites
4. RECOMMANDATION — Plan d'action prioritaire à 3/12/36 mois
5. INDICATEURS DE SUCCÈS — KPIs fiscaux, notation, indices WASI

Cette plateforme est utilisée par des traders institutionnels, des directeurs de banque centrale, des ministres des finances, et des chefs d'État. Répondre avec la précision d'un conseiller senior du FMI ou de la Banque Mondiale. Ne pas minimiser, ne pas esquiver. Donner des chiffres précis, des recommandations concrètes, des noms d'institutions.

Si la langue de la question est le français, répondre en français. Si anglais, répondre en anglais.

${selectedCountry ? `SELECTED COUNTRY FOCUS: ${selectedCountry.name} — Port: ${selectedCountry.port} — Current Index: ${indices[selectedCountry.code]}/100` : ""}

Always cite your data sources as: "WASI Data Engine v3.0 | Port Authority Official Statistics | ECOWAS Statistical Office | Banques Centrales BCEAO/CBN/BoG"
End every response with a concise "WASI Signal" — a one-line investment implication.

${GOVERNMENT_ADVISORY_KNOWLEDGE}
${BANKING_KNOWLEDGE}

FISCALITÉ & RÉGIMES FISCAUX — AFRIQUE DE L'OUEST (Loi de Finances 2024–2025):

CÔTE D'IVOIRE (CI) — Loi de Finances 2025 (DGI):
• BIC entreprises: 25% | BIC PME (CA<200M FCFA): 20% | IMF: 0,5% CA (min 3M, max 35M FCFA)
• TVA standard: 18% | TVA réduite: 9% | Export: 0%
• Retenues: dividendes 15%, intérêts 18%, royalties non-résidents 20%, TAF 10%
• IRPP (barème progressif): 0% (≤600K FCFA) → 5% → 15% → 25% → 36% (>7,5M FCFA/an)
• Douanes (TEC CEDEAO): Cat.0=0%, Cat.1=5%, Cat.2=10%, Cat.3=20%, Cat.4=35%
• Prélèvements additionnels: CEDEAO 0,5% + UEMOA 1% + statistique 1% = +2,5% sur TEC
• Cacao: droits export ~22% FOB (DUS + CGA) — principale source recettes douanières
• Mines: redevance 3–6%, participation État 10% free carry
• Nouvelles mesures 2025: télédéclaration obligatoire, taxe économie numérique, prix de transfert renforcés, digitalisation SYDAM Port Abidjan

NIGERIA (NG) — Finance Act 2024 (FIRS):
• CIT: 30% (grandes) | 20% (moyennes, CA 25–100M NGN) | 0% (PME CA<25M NGN)
• VAT: 7,5% | WHT dividendes/intérêts: 10%
• Taxe économie numérique non-résidents: 6% | PPT pétrole classique: 85% | Deep offshore: 50%

GHANA (GH) — Finance Act 2023 / Budget 2025 (GRA):
• CIT: 25% standard | 35% mines & pétrole
• TVA effective totale: 21% (VAT 15% + NHIL 2,5% + GETFUND 2,5% + COVID levy 1%)
• E-Levy mobile money: 1% | Royalty minière or: 5% + prélèvement additionnel 10% sur super-profits

SÉNÉGAL (SN) — Loi de Finances 2025 (DGID):
• IS: 30% standard | 33% pétrole & gaz (contrats post-2024)
• TVA: 18% | Retenue dividendes: 10% | Services non-résidents: 20%
• Nouveauté: régime fiscal pétrole opérationnel (Sangomar, GTA) — recettes nouvelles depuis 2024

UEMOA (CI, SN, BF, ML, TG, BJ, NE, GW) — Règlements régionaux communs:
• TEC CEDEAO: 5 catégories (0–35%) + 2,5% prélèvements obligatoires additionnels
• TVA harmonisée: 18% dans toute la zone UEMOA
• Taux directeur BCEAO: 3,5% (2025) — impacts coût crédit toute la zone

Utilise ces données fiscales pour: calculer charges réelles d'importation, conseiller sur optimisation fiscale, analyser compétitivité inter-pays, estimer coût total d'investissement dans chaque pays.

${historicalData.length > 0 ? `
HISTORICAL PORT DATA — Côte d'Ivoire / Abidjan (${historicalData.length} months):
${historicalData.slice().reverse().map(r =>
  `${r.period_date}: Index=${r.index_value?.toFixed(1)} | Shipping=${r.shipping_score?.toFixed(1)} | Trade=${r.trade_score?.toFixed(1)} | Infra=${r.infrastructure_score?.toFixed(1)} | Economic=${r.economic_score?.toFixed(1)}`
).join("\n")}
Use this data to answer questions about trends, graphs, and evolution of Abidjan port activity.` : ""}
`;
  };

  const sendMessage = async (text) => {
    const query = text || input.trim();
    if (!query) return;

    const userMsg = { role: "user", content: query };
    setMessages(m => [...m, userMsg]);
    setInput("");
    setLoading(true);
    setShowCapabilities(false);

    try {
      const response = await fetch(`${BACKEND_API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(backendToken ? { "Authorization": `Bearer ${backendToken}` } : {}),
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 2000,
          system: buildSystemPrompt(),
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: query }
          ]
        })
      });
      const data = await response.json();
      const reply = data.content?.[0]?.text || "Agent WASI temporairement indisponible. Veuillez réessayer.";
      setMessages(m => [...m, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages(m => [...m, { role: "assistant", content: "⚠️ Erreur de connexion. Agent WASI hors ligne. Vérifiez la connectivité API." }]);
    }
    setLoading(false);
  };

  const wasiTrend = wasiComposite > 65 ? { label: "EXPANSION", color: "#4ade80" }
                  : wasiComposite > 50 ? { label: "STABLE", color: "#f0b429" }
                  : { label: "CONTRACTION", color: "#ef4444" };

  return (
    <div style={{ minHeight: "100vh", background: "#030d1a", color: "#e2e8f0", fontFamily: "'Space Mono', monospace", display: "flex", flexDirection: "column" }}>
      {/* Sidebar detail modal (markets + news) */}
      <SidebarDetailModal data={sidebarModal} onClose={() => setSidebarModal(null)} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Bebas+Neue&family=DM+Serif+Display:ital@0;1&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #f0b429; }
        .send-btn:hover { background: #f0b429 !important; color: #030d1a !important; }
        .sugg-btn:hover { background: rgba(240,180,41,0.15) !important; border-color: #f0b429 !important; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeUp { from{transform:translateY(12px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        .msg-enter { animation: fadeUp 0.3s ease; }
        .live-dot { animation: pulse 2s infinite; }
        /* ── Mobile Responsive ─────────────────────────── */
        @media (max-width: 1024px) {
          .wasi-main-grid { grid-template-columns: 1fr !important; }
          .wasi-sidebar-left, .wasi-sidebar-right { display: none; }
          .wasi-sidebar-left.mobile-active, .wasi-sidebar-right.mobile-active {
            display: block !important;
            position: fixed; top: 64px; bottom: 0; left: 0; right: 0; z-index: 80;
            background: #030d1a; overflow-y: auto; padding: 12px;
          }
          .wasi-mobile-nav { display: flex !important; }
          .wasi-header-full { display: none !important; }
          .wasi-header-compact { display: flex !important; }
        }
        @media (min-width: 1025px) {
          .wasi-mobile-nav { display: none !important; }
          .wasi-header-full { display: flex !important; }
          .wasi-header-compact { display: none !important; }
        }
      `}</style>

      {/* Scanline overlay */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden", opacity: 0.03 }}>
        <div style={{ position: "absolute", width: "100%", height: 2, background: "#f0b429", animation: "scanline 8s linear infinite" }} />
      </div>

      {/* HEADER */}
      <div style={{ background: "rgba(3,13,26,0.95)", borderBottom: "1px solid #0f2a45", padding: "16px 28px", position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(12px)" }}>
        {/* Desktop header */}
        <div className="wasi-header-full" style={{ alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, letterSpacing: 6, color: "#f0b429", lineHeight: 1 }}>WASI</div>
              <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: 3, textTransform: "uppercase" }}>Agent IA v3.0 · Intelligence CEDEAO</div>
            </div>
            <div style={{ width: 1, height: 36, background: "#0f2a45" }} />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: backendConnected ? "#4ade80" : "#f0b429" }} />
                <span style={{ fontSize: 14, color: backendConnected ? "#4ade80" : "#f0b429", letterSpacing: 2 }}>
                  {backendConnected ? `EN DIRECT · ${dataSource === "live" ? "TEMPS RÉEL" : "SIMULATION"}` : "SIMULATION"}
                </span>
              </div>
              <div style={{ fontSize: 28, fontFamily: "'Bebas Neue', sans-serif", color: wasiTrend.color, letterSpacing: 2 }}>
                WASI {wasiComposite} <span style={{ fontSize: 15 }}>{wasiTrend.label}</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {userInfo && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, color: "#e2e8f0", letterSpacing: 1, fontFamily: "'Space Mono', monospace" }}>{userInfo.username}</div>
                <div style={{ fontSize: 13, color: "#f0b429" }}>
                  {typeof userInfo.x402_balance === "number" ? `${userInfo.x402_balance.toLocaleString()} crédits` : userInfo.tier || ""}
                </div>
              </div>
            )}
            <div style={{ padding: "6px 14px", background: backendConnected && dataSource === "live" ? "rgba(74,222,128,0.08)" : "rgba(240,180,41,0.10)", border: `1px solid ${backendConnected && dataSource === "live" ? "#4ade8044" : "#f0b42966"}`, borderRadius: 4, fontSize: 14, color: backendConnected && dataSource === "live" ? "#4ade80" : "#f0b429", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>
              {backendConnected && dataSource === "live" ? "DONNÉES LIVE" : "DÉMO"}
            </div>
            {onLogout && (
              <button onClick={onLogout} style={{ background: "none", border: "1px solid #1e3a5f", borderRadius: 4, color: "#64748b", cursor: "pointer", fontSize: 13, fontFamily: "'Space Mono', monospace", letterSpacing: 1, padding: "5px 10px", transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e3a5f"; e.currentTarget.style.color = "#64748b"; }}>
                DÉCONNEXION
              </button>
            )}
          </div>
        </div>
        {/* Mobile compact header */}
        <div className="wasi-header-compact" style={{ alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 4, color: "#f0b429", lineHeight: 1 }}>WASI</div>
            <div className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: backendConnected ? "#4ade80" : "#f0b429" }} />
            <span style={{ fontSize: 20, fontFamily: "'Bebas Neue', sans-serif", color: wasiTrend.color, letterSpacing: 2 }}>{wasiComposite}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {onLogout && (
              <button onClick={onLogout} style={{ background: "none", border: "1px solid #1e3a5f", borderRadius: 4, color: "#64748b", cursor: "pointer", fontSize: 13, padding: "4px 8px", fontFamily: "'Space Mono', monospace" }}>
                SORTIR
              </button>
            )}
          </div>
        </div>
        {/* Mobile bottom navigation tabs */}
        <div className="wasi-mobile-nav" style={{ justifyContent: "center", gap: 0, marginTop: 8, borderTop: "1px solid #0f2a45", paddingTop: 8 }}>
          {[
            { id: "left", label: "INDICES", icon: "📊" },
            { id: "center", label: "CHAT", icon: "💬" },
            { id: "right", label: "MARCHÉS", icon: "📈" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setMobilePanel(tab.id)} style={{
              flex: 1, background: mobilePanel === tab.id ? "rgba(240,180,41,0.12)" : "transparent",
              border: "none", borderBottom: mobilePanel === tab.id ? "2px solid #f0b429" : "2px solid transparent",
              color: mobilePanel === tab.id ? "#f0b429" : "#64748b",
              cursor: "pointer", padding: "6px 0", fontSize: 13, letterSpacing: 1,
              fontFamily: "'Space Mono', monospace", transition: "all 0.2s",
            }}>{tab.icon} {tab.label}</button>
          ))}
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div className="wasi-main-grid" style={{ display: "grid", gridTemplateColumns: "280px 1fr 300px", flex: 1, minHeight: 0, gap: 0 }}>

        {/* LEFT — Country Index Panel */}
        <div className={`wasi-sidebar-left${mobilePanel === "left" ? " mobile-active" : ""}`} style={{ borderRight: "1px solid #0f2a45", padding: 16, overflowY: "auto", background: "rgba(3,13,26,0.6)" }}>
          <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>Indices Pays</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {WEST_AFRICAN_COUNTRIES.map(c => (
              <IndexCard key={c.code} country={c} index={indices[c.code]} isActive={selectedCountry?.code === c.code}
                liveSignal={liveSignals[c.code]}
                onClick={() => {
                  const next = selectedCountry?.code === c.code ? null : c;
                  setSelectedCountry(next);
                  if (next) setShowDashboard(true);
                }} />
            ))}
          </div>
          <div style={{ marginTop: 12, padding: "12px 14px", background: "rgba(240,180,41,0.05)", border: "1px solid #1e3a5f", borderRadius: 4 }}>
            <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: 2, marginBottom: 4 }}>COMPOSITE WASI</div>
            <div style={{ fontSize: 40, fontFamily: "'Bebas Neue', sans-serif", color: wasiTrend.color, letterSpacing: 3 }}>{wasiComposite}</div>
            <div style={{ fontSize: 14, color: "#94a3b8" }}>16 pays CEDEAO · {newsEvents.length > 0 ? <span style={{ color: "#ef4444" }}>⚠ {newsEvents.length} alertes</span> : "Aucune alerte active"}</div>
          </div>

          {/* USSD Data Button */}
          <button onClick={() => { setShowDashboard(false); setSelectedCountry(null); setUssdLoading(!ussdData); if (!ussdData && backendToken) { fetchUSSDAggregate(backendToken).then(d => { if (d) setUssdData(d); setUssdLoading(false); }); } }}
            style={{ width: "100%", marginTop: 10, padding: "14px 16px", background: ussdData ? "rgba(167,139,250,0.10)" : "rgba(15,42,69,0.5)", border: "1px solid #a78bfa44", borderRadius: 6, cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#a78bfa"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "#a78bfa44"}>
            <div style={{ fontSize: 13, color: "#a78bfa", letterSpacing: 2, marginBottom: 3 }}>DONNÉES USSD</div>
            <div style={{ fontSize: 14, color: "#94a3b8" }}>{ussdData ? `${(ussdData.total_records || 0).toLocaleString()} enr.` : "Charger les données"}</div>
          </button>
        </div>

        {/* CENTER — Dashboard pays, USSD Viz, ou Interface Chat */}
        {ussdData && !showDashboard && !selectedCountry ? (
          <USSDVisualizationPanel ussdData={ussdData} onClose={() => setUssdData(null)} />
        ) : showDashboard && selectedCountry ? (
          <CountryDashboard
            country={selectedCountry}
            indexValue={indices[selectedCountry.code]}
            onClose={() => setShowDashboard(false)}
            bankContext={bankContextCache[selectedCountry.code] || null}
            transportData={transportCache[selectedCountry.code] || null}
            macroData={macroCache[selectedCountry.code] || null}
            historyData={historyCache[selectedCountry.code] || null}
          />
        ) : (
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 28px" }}>
            {showCapabilities && (
              <div style={{ marginBottom: 10, animation: "fadeUp 0.5s ease" }}>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#f0b429", marginBottom: 2 }}>
                  Intelligence Économique d'Afrique de l'Ouest
                </div>
                <div style={{ fontSize: 14, color: "#94a3b8", letterSpacing: 2, marginBottom: 8 }}>
                  PROPULSÉ PAR WASI IA · INTELLIGENCE ÉCONOMIQUE EN TEMPS RÉEL
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 8 }}>
                  {AGENT_CAPABILITIES.map((cap, i) => (
                    <div key={i} style={{ background: "rgba(15,42,69,0.5)", border: "1px solid #0f2a45", borderRadius: 4, padding: "8px 12px", fontSize: 13, color: "#94a3b8", lineHeight: 1.4 }}>
                      {cap}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6, letterSpacing: 2, textTransform: "uppercase" }}>Requêtes suggérées</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {SUGGESTED_QUERIES.map((q, i) => (
                    <button key={i} className="sugg-btn" onClick={() => sendMessage(q)} style={{
                      background: "transparent", border: "1px solid #1e3a5f", borderRadius: 4,
                      padding: "8px 14px", textAlign: "left", cursor: "pointer", color: "#64748b",
                      fontSize: 13, fontFamily: "'Space Mono', monospace", transition: "all 0.2s", lineHeight: 1.3
                    }}>
                      → {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className="msg-enter" style={{ marginBottom: 16, display: "flex", gap: 10, flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  background: m.role === "user" ? "#1e3a5f" : "rgba(240,180,41,0.15)",
                  border: `1px solid ${m.role === "user" ? "#2d5a8a" : "#f0b429"}`,
                  fontSize: 12
                }}>
                  {m.role === "user" ? "👤" : "⚡"}
                </div>
                <div style={{
                  maxWidth: "78%",
                  background: m.role === "user" ? "rgba(30,58,95,0.6)" : "rgba(10,22,40,0.9)",
                  border: `1px solid ${m.role === "user" ? "#2d5a8a" : "#0f2a45"}`,
                  borderRadius: m.role === "user" ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
                  padding: "16px 18px", fontSize: 15, lineHeight: 1.8, color: "#cbd5e1"
                }}>
                  {m.role === "assistant" && (
                    <div style={{ fontSize: 13, color: "#f0b429", letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>
                      Agent WASI Intelligence · {new Date().toLocaleDateString("fr-FR")}
                    </div>
                  )}
                  {m.role === "assistant" ? renderMarkdown(m.content) : m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="msg-enter" style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(240,180,41,0.15)", border: "1px solid #f0b429", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>⚡</div>
                <div style={{ background: "rgba(10,22,40,0.9)", border: "1px solid #0f2a45", borderRadius: "4px 12px 12px 12px", padding: "18px 24px" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#f0b429", animation: `pulse 1.2s ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6, letterSpacing: 2 }}>ANALYSE EN COURS · MOTEUR WASI v3.0</div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "12px 20px", borderTop: "1px solid #0f2a45", background: "rgba(3,13,26,0.95)" }}>
            {selectedCountry && (
              <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "rgba(240,180,41,0.08)", border: "1px solid #f0b42933", borderRadius: 4 }}>
                <span>{selectedCountry.flag}</span>
                <span style={{ fontSize: 14, color: "#f0b429", letterSpacing: 1 }}>FOCUS : {selectedCountry.name.toUpperCase()} · INDICE {Math.round(indices[selectedCountry.code])}/100</span>
                <button onClick={() => setSelectedCountry(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 15 }}>✕</button>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Interroger l'intelligence WASI... (16 nations CEDEAO, transport, banque, signaux)"
                style={{
                  flex: 1, background: "rgba(15,42,69,0.5)", border: "1px solid #1e3a5f",
                  borderRadius: 4, padding: "14px 18px", color: "#e2e8f0", fontSize: 15,
                  fontFamily: "'Space Mono', monospace", outline: "none"
                }}
              />
              <button className="send-btn" onClick={() => sendMessage()} disabled={loading || !input.trim()} style={{
                background: "transparent", border: "1px solid #f0b429", color: "#f0b429",
                padding: "14px 24px", borderRadius: 6, cursor: "pointer", fontSize: 14,
                fontFamily: "'Space Mono', monospace", fontWeight: 700, letterSpacing: 2,
                transition: "all 0.2s", opacity: loading ? 0.5 : 1
              }}>
                {loading ? "..." : "ENVOYER →"}
              </button>
            </div>
            <div style={{ marginTop: 6, fontSize: 13, color: "#64748b", letterSpacing: 1, display: "flex", justifyContent: "space-between" }}>
              <span>WASI Intelligence · CEDEAO · Données portuaires, transport, bancaires en temps réel</span>
              <span>WASI Moteur de Données v3.0 · {new Date().toLocaleDateString("fr-FR")} · {Object.keys(liveSignals).length > 0 ? `${Object.keys(liveSignals).length} signaux live actifs` : "Signaux RSS en attente"}</span>
            </div>
          </div>
        </div>
        )}

        {/* RIGHT — Platform Info + ETF Signal */}
        <div className={`wasi-sidebar-right${mobilePanel === "right" ? " mobile-active" : ""}`} style={{ borderLeft: "1px solid #0f2a45", padding: 16, overflowY: "auto", background: "rgba(3,13,26,0.6)" }}>
          {/* Platform Coverage */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Couverture WASI</div>
            {[
              { label: "Pays couverts", val: "16 CEDEAO", color: "#4ade80" },
              { label: "Ports principaux", val: "Abidjan · Lagos · Tema · Dakar", color: "#38bdf8" },
              { label: "Module Transport", val: "Maritime · Aérien · Rail · Route", color: "#f0b429" },
              { label: "Signaux d'actualité", val: "RSS Afrique · Balayage horaire", color: "#a78bfa" },
              { label: "Module Bancaire", val: "Crédit · Dossier · Advisory", color: "#fb923c" },
              { label: "Macro FMI WEO", val: "PIB · Inflation · Dette · CA", color: "#38bdf8" },
              { label: "Matières premières", val: "WB Pink Sheet · 6 commodités", color: "#a78bfa" },
              { label: "Mise à jour", val: "Temps réel · 6h composite", color: "#94a3b8" },
            ].map((item, i) => (
              <div key={i} style={{ marginBottom: 5, padding: "10px 12px", background: "rgba(15,42,69,0.3)", borderRadius: 3, border: "1px solid #0f2a45" }}>
                <div style={{ fontSize: 12, color: "#64748b", letterSpacing: 1, marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 14, color: item.color, fontFamily: "'Space Mono', monospace" }}>{item.val}</div>
              </div>
            ))}
          </div>

          {/* ETF Signal */}
          <div style={{ marginBottom: 14, padding: "10px", background: "rgba(240,180,41,0.05)", border: "1px solid #1e3a5f", borderRadius: 4 }}>
            <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Signal ETF WASI</div>
            <div style={{ fontSize: 26, fontFamily: "'Bebas Neue', sans-serif", color: wasiTrend.color, letterSpacing: 2, marginBottom: 4 }}>
              {wasiComposite > 65 ? "HAUSSIER" : wasiComposite > 50 ? "NEUTRE" : "BAISSIER"}
            </div>
            {(() => {
              const top2 = [...WEST_AFRICAN_COUNTRIES]
                .sort((a, b) => (indices[b.code] || 0) - (indices[a.code] || 0))
                .slice(0, 2);
              return (
                <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
                  Composite : {wasiComposite}/100<br />
                  Top : {top2.map(c => `${c.flag} ${c.code} ${Math.round(indices[c.code])}`).join(", ")}<br />
                  Signal : {wasiComposite > 65 ? "Accumuler l'exposition Afrique Ouest" : "Surveiller le point d'entrée"}
                </div>
              );
            })()}
          </div>

          {/* Top movers */}
          <div>
            <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Meilleures Performances</div>
            {[...WEST_AFRICAN_COUNTRIES].sort((a, b) => (indices[b.code] || 0) - (indices[a.code] || 0)).slice(0, 5).map(c => (
              <div key={c.code} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5, padding: "8px 12px", background: "rgba(15,42,69,0.3)", borderRadius: 3 }}>
                <span style={{ fontSize: 14 }}>{c.flag} {c.code}</span>
                <span style={{ fontSize: 15, fontFamily: "'Bebas Neue', sans-serif", color: (indices[c.code] || 0) > 65 ? "#4ade80" : "#f0b429", letterSpacing: 1 }}>{Math.round(indices[c.code] || 0)}</span>
              </div>
            ))}
          </div>

          {/* Stock Markets */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Marchés Boursiers</div>
            {stockMarkets.length === 0 ? (
              <div style={{ fontSize: 13, color: "#64748b", padding: "12px 14px", background: "rgba(15,42,69,0.2)", borderRadius: 4, border: "1px solid #0f2a45" }}>
                Chargement des marchés...
              </div>
            ) : stockMarkets.map((m, i) => {
              const up = m.change_pct >= 0;
              const color = up ? "#4ade80" : "#ef4444";
              const exchangeFlag = m.exchange_code === "NGX" ? "🇳🇬" : m.exchange_code === "GSE" ? "🇬🇭" : "🌍";
              return (
                <div key={i} onClick={() => setSidebarModal({ type: "market", market: m })} style={{ marginBottom: 5, padding: "12px 14px", background: "rgba(15,42,69,0.4)", border: "1px solid #0f2a45", borderRadius: 6, cursor: "pointer", transition: "border-color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = color}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#0f2a45"}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <span style={{ fontSize: 14, color: "#94a3b8" }}>{exchangeFlag} {m.exchange_code}</span>
                    <span style={{ fontSize: 13, color: color, fontWeight: 700 }}>{up ? "▲" : "▼"} {Math.abs(m.change_pct).toFixed(2)}%</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 3 }}>{m.index_name}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <span style={{ fontSize: 15, fontFamily: "'Bebas Neue', sans-serif", color: "#e2e8f0", letterSpacing: 1 }}>
                      {m.index_value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
                    </span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>YTD {m.ytd_change_pct >= 0 ? "+" : ""}{m.ytd_change_pct?.toFixed(1)}%</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
                    <div style={{ fontSize: 12, color: "#64748b" }}>Cap. {(m.market_cap_usd / 1e9).toFixed(1)} Mrd USD</div>
                    <div style={{ fontSize: 12, color: "#1e3a5f", letterSpacing: 0.5 }}>↗ DÉTAILS</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live News Events */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <span className="live-dot" style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: newsEvents.length > 0 ? "#ef4444" : "#64748b" }} />
              Signaux d'actualité
            </div>
            {newsEvents.length === 0 ? (
              <div style={{ fontSize: 13, color: "#64748b", padding: "12px 14px", background: "rgba(15,42,69,0.2)", borderRadius: 4, border: "1px solid #0f2a45" }}>
                Aucun événement actif · Balayage RSS horaire
              </div>
            ) : newsEvents.slice(0, 4).map((e, i) => {
              const evtColor = e.event_type === "POLITICAL_RISK" ? "#ef4444"
                : e.event_type === "PORT_DISRUPTION" ? "#f97316"
                : e.event_type === "STRIKE" ? "#f0b429"
                : e.event_type === "COMMODITY_SURGE" ? "#a78bfa"
                : "#38bdf8";
              return (
                <div key={i} onClick={() => setSidebarModal({ type: "event", event: e })}
                  style={{ marginBottom: 5, padding: "10px 12px", background: `${evtColor}0d`, border: `1px solid ${evtColor}33`, borderRadius: 6, cursor: "pointer", transition: "background 0.15s" }}
                  onMouseEnter={el => el.currentTarget.style.background = `${evtColor}18`}
                  onMouseLeave={el => el.currentTarget.style.background = `${evtColor}0d`}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontSize: 12, color: evtColor, fontWeight: 700, letterSpacing: 1 }}>{e.event_type.replace(/_/g, " ")}</span>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>{e.country_code} · {e.magnitude >= 0 ? "+" : ""}{e.magnitude}pt</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {e.headline?.slice(0, 90)}
                  </div>
                  <div style={{ fontSize: 12, color: "#1e3a5f", marginTop: 3, textAlign: "right", letterSpacing: 0.5 }}>↗ VOIR DÉTAILS</div>
                </div>
              );
            })}
            {newsEvents.length > 4 && (
              <div style={{ fontSize: 12, color: "#64748b", textAlign: "center", marginTop: 3 }}>+ {newsEvents.length - 4} autres événements actifs</div>
            )}
          </div>

          {/* Commodity Prices — WB Pink Sheet */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "#a78bfa" }}>◆</span> Matières Premières
            </div>
            {commodityPrices.length === 0 ? (
              <div style={{ fontSize: 13, color: "#64748b", padding: "12px 14px", background: "rgba(15,42,69,0.2)", borderRadius: 4, border: "1px solid #0f2a45" }}>
                Chargement WB Pink Sheet…
              </div>
            ) : commodityPrices.slice(0, 6).map((p, i) => {
              const momUp = p.mom_pct > 0;
              const momColor = p.mom_pct === null ? "#64748b" : p.mom_pct > 0 ? "#4ade80" : "#ef4444";
              const ICONS = { COCOA: "🍫", BRENT: "🛢️", GOLD: "🪙", COTTON: "🌿", COFFEE: "☕", IRON_ORE: "⛏️" };
              return (
                <div key={i} style={{ marginBottom: 5, padding: "10px 12px", background: "rgba(167,139,250,0.06)", border: "1px solid #a78bfa22", borderRadius: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#94a3b8" }}>{ICONS[p.code] || "◆"} {p.name?.split(" ")[0]}</span>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 15, fontFamily: "'Bebas Neue',sans-serif", color: "#e2e8f0", letterSpacing: 1 }}>
                        ${p.price_usd}
                      </div>
                      {p.mom_pct !== null && (
                        <div style={{ fontSize: 12, color: momColor }}>{momUp ? "▲" : "▼"} {Math.abs(p.mom_pct).toFixed(1)}% MoM</div>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{p.unit} · {p.period}</div>
                </div>
              );
            })}
            {commodityPrices.length > 0 && (
              <div style={{ fontSize: 11, color: "#475569", marginTop: 4, letterSpacing: 0.5 }}>Source : WB Pink Sheet · moyennes mensuelles</div>
            )}
          </div>

          {/* Data source */}
          <div style={{ marginTop: 14, padding: "12px 14px", background: "rgba(15,42,69,0.2)", borderRadius: 4, border: "1px solid #0f2a45" }}>
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7, letterSpacing: 0.5 }}>
              Données : {backendConnected ? `WASI API v3.0 CEDEAO (${dataSource === "live" ? "TEMPS RÉEL" : "SIMULATION"}) · Statistiques Officielles Portuaires` : "Mode Simulation · Statistiques Portuaires Officielles (démo)"} · Suivi AIS Navires<br /><br />
              Serveur : {backendConnected ? <span style={{ color: "#4ade80" }}>CONNECTÉ</span> : <span style={{ color: "#f0b429" }}>HORS LIGNE</span>}<br /><br />
              © 2025–2026 WASI v3.0 — Plateforme d'Intelligence Maritime et Économique CEDEAO. Tous droits réservés.
            </div>
          </div>

          {/* Legal Disclaimer */}
          <div style={{ marginTop: 10, padding: "14px 16px", background: "rgba(239,68,68,0.04)", border: "1px solid #ef444422", borderRadius: 4 }}>
            <div style={{ fontSize: 12, color: "#ef4444", letterSpacing: 2, marginBottom: 4 }}>AVERTISSEMENT LÉGAL</div>
            <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.8, letterSpacing: 0.3 }}>
              Les données, indices et analyses présentés sur cette plateforme sont fournis à titre informatif uniquement et ne constituent en aucun cas un conseil en investissement, une recommandation de crédit, ou une décision d'allocation de capital. Les notations de crédit sont indicatives et générées algorithmiquement — elles ne remplacent pas l'évaluation d'un analyste bancaire agréé. Les données de marché peuvent être retardées, incomplètes ou approximatives. WASI décline toute responsabilité en cas de pertes financières résultant de l'utilisation de ces informations. Consultez un conseiller financier agréé avant toute décision d'investissement.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Error Boundary — catches render crashes ──────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return React.createElement("div", {
        style: { padding: 40, background: "#030d1a", color: "#ef4444", fontFamily: "monospace", minHeight: "100vh" }
      },
        React.createElement("h2", { style: { color: "#f0b429", marginBottom: 16 } }, "WASI — Render Error"),
        React.createElement("pre", { style: { whiteSpace: "pre-wrap", color: "#ef4444" } },
          this.state.error.message + "\n\n" + (this.state.error.stack || "")
        ),
        React.createElement("button", {
          onClick: () => { sessionStorage.clear(); window.location.reload(); },
          style: { marginTop: 20, padding: "10px 20px", background: "#f0b429", color: "#030d1a", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "monospace", fontWeight: 700 }
        }, "Clear Session & Reload")
      );
    }
    return this.props.children;
  }
}

// ── App root — handles auth state ─────────────────────────────────────────
export default function App() {
  const [token, setToken] = React.useState(() => {
    const t = sessionStorage.getItem("wasi_token");
    if (!t) return null;
    // Expire tokens after 12 hours (client-side guard)
    const ts = parseInt(sessionStorage.getItem("wasi_token_ts") || "0", 10);
    if (Date.now() - ts > 12 * 60 * 60 * 1000) {
      sessionStorage.removeItem("wasi_token"); sessionStorage.removeItem("wasi_token_ts");
      return null;
    }
    return t;
  });
  const [userInfo, setUserInfo] = React.useState(null);

  // Re-validate stored token on mount and fetch user info
  React.useEffect(() => {
    if (!token) return;
    fetch(`${BACKEND_API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setUserInfo(data))
      .catch(() => {
        // Token expired or invalid — force re-login
        sessionStorage.removeItem("wasi_token"); sessionStorage.removeItem("wasi_token_ts");
        setToken(null);
      });
  }, [token]);

  const handleAuth = (tok, user) => {
    setToken(tok);
    setUserInfo(user);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("wasi_token"); sessionStorage.removeItem("wasi_token_ts");
    setToken(null);
    setUserInfo(null);
  };

  if (!token) {
    return <ErrorBoundary><LoginPage onAuth={handleAuth} /></ErrorBoundary>;
  }

  return (
    <ErrorBoundary>
      <WASIAgent
        authToken={token}
        userInfo={userInfo}
        onLogout={handleLogout}
      />
    </ErrorBoundary>
  );
}
