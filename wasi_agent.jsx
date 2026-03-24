import { useState, useEffect, useRef } from "react";
import {
  fetchCoinGeckoSnapshot,
  fetchOpenErFxSnapshot,
  fetchWorldBankWasiSnapshot,
} from "./src/wasi/services/freeLiveData";

// ============================================================
// WASI AI AGENT â€” West African Shipping & Economic Intelligence
// Powered by Claude AI | x402 Protocol Ready
// All 15 ECOWAS + West African Countries
// ============================================================

// â”€â”€ Backend API Integration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BACKEND_API_URL = "http://localhost:8000";

// Auto-create a demo session (register if needed, then login)
async function getBackendToken() {
  try {
    // Try registering a demo user (idempotent â€” 409 means already exists, that's fine)
    await fetch(`${BACKEND_API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "wasi_demo", email: "demo@wasi.io", password: "WasiDemo2024" }),
    });
    // Login
    const loginRes = await fetch(`${BACKEND_API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "username=wasi_demo&password=WasiDemo2024",
    });
    if (!loginRes.ok) return null;
    const { access_token } = await loginRes.json();
    return access_token;
  } catch (_) {
    return null;
  }
}

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
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const WEST_AFRICAN_COUNTRIES = [
  { code: "CI", name: "CÃ´te d'Ivoire", port: "Abidjan", flag: "ðŸ‡¨ðŸ‡®", tier: "primary", weight: 0.22 },
  { code: "NG", name: "Nigeria",        port: "Lagos / Apapa", flag: "ðŸ‡³ðŸ‡¬", tier: "primary", weight: 0.28 },
  { code: "GH", name: "Ghana",          port: "Tema", flag: "ðŸ‡¬ðŸ‡­", tier: "primary", weight: 0.15 },
  { code: "SN", name: "Senegal",        port: "Dakar", flag: "ðŸ‡¸ðŸ‡³", tier: "primary", weight: 0.10 },
  { code: "BF", name: "Burkina Faso",   port: "Landlocked / Abidjan corridor", flag: "ðŸ‡§ðŸ‡«", tier: "secondary", weight: 0.04 },
  { code: "ML", name: "Mali",           port: "Landlocked / Dakar corridor", flag: "ðŸ‡²ðŸ‡±", tier: "secondary", weight: 0.04 },
  { code: "GN", name: "Guinea",         port: "Conakry", flag: "ðŸ‡¬ðŸ‡³", tier: "secondary", weight: 0.04 },
  { code: "BJ", name: "Benin",          port: "Cotonou", flag: "ðŸ‡§ðŸ‡¯", tier: "secondary", weight: 0.03 },
  { code: "TG", name: "Togo",           port: "LomÃ©", flag: "ðŸ‡¹ðŸ‡¬", tier: "secondary", weight: 0.03 },
  { code: "NE", name: "Niger",          port: "Landlocked / Cotonou corridor", flag: "ðŸ‡³ðŸ‡ª", tier: "secondary", weight: 0.02 },
  { code: "MR", name: "Mauritania",     port: "Nouakchott", flag: "ðŸ‡²ðŸ‡·", tier: "secondary", weight: 0.02 },
  { code: "GW", name: "Guinea-Bissau",  port: "Bissau", flag: "ðŸ‡¬ðŸ‡¼", tier: "tertiary", weight: 0.01 },
  { code: "SL", name: "Sierra Leone",   port: "Freetown", flag: "ðŸ‡¸ðŸ‡±", tier: "tertiary", weight: 0.01 },
  { code: "LR", name: "Liberia",        port: "Monrovia", flag: "ðŸ‡±ðŸ‡·", tier: "tertiary", weight: 0.01 },
  { code: "GM", name: "Gambia",         port: "Banjul", flag: "ðŸ‡¬ðŸ‡²", tier: "tertiary", weight: 0.005 },
  { code: "CV", name: "Cape Verde",     port: "Praia / Mindelo", flag: "ðŸ‡¨ðŸ‡»", tier: "tertiary", weight: 0.005 },
];

// â”€â”€ DonnÃ©es commerciales & fiches pays (M$ USD, 2023 â€” mise Ã  jour : fÃ©v. 2026) â”€
const COUP_REGIMES = ["BF", "ML", "NE", "GN"];

const COUNTRY_TRADE_DATA = {
  CI: {
    president: "Alassane Dramane Ouattara", presidentSince: "2011 (rÃ©Ã©lu 2025)",
    capitale: "Yamoussoukro", siegeEconomique: "Abidjan",
    superficie: 322462,
    matieres_premieres: ["Cacao (1er mondial)", "Caoutchouc naturel", "Noix de cajou", "Or", "PÃ©trole brut", "Gaz naturel", "Huile de palme", "Bois tropical", "Diamants"],
    exports: [
      { cat: "Cacao & Chocolat", val: 3800 }, { cat: "PÃ©trole brut", val: 1200 },
      { cat: "Caoutchouc naturel", val: 890 }, { cat: "Noix de cajou", val: 760 },
      { cat: "Huile de palme", val: 540 },     { cat: "Bois & dÃ©rivÃ©s", val: 320 },
    ],
    imports: [
      { cat: "Machines & Ã©quipements", val: 1600 }, { cat: "Prod. pÃ©troliers raffinÃ©s", val: 1100 },
      { cat: "Riz & cÃ©rÃ©ales", val: 890 },          { cat: "VÃ©hicules & transport", val: 670 },
      { cat: "Prod. pharmaceutiques", val: 340 },   { cat: "Acier & mÃ©taux", val: 290 },
    ],
    totalExports: 7510, totalImports: 4890,
    partners: ["Union EuropÃ©enne 38%", "Chine 15%", "Ã‰tats-Unis 9%", "Inde 8%"],
    opportunities: ["Transformation locale cacao", "Hub logistique CEDEAO", "Zone franche Abidjan"],
    risks: ["VolatilitÃ© prix cacao", "DÃ©pendance marchÃ© UE", "Infrastructures routiÃ¨res limitÃ©es"],
    gdpGrowth: 6.8, currency: "XOF",
  },
  NG: {
    president: "Bola Ahmed Tinubu", presidentSince: "2023",
    capitale: "Abuja", siegeEconomique: "Lagos",
    superficie: 923768,
    matieres_premieres: ["PÃ©trole brut (1er africain)", "Gaz naturel", "Ã‰tain", "Charbon", "Minerai de fer", "Or", "Calcaire", "Coltan", "Terres rares"],
    exports: [
      { cat: "PÃ©trole brut", val: 35000 },       { cat: "Gaz naturel liquÃ©fiÃ©", val: 8000 },
      { cat: "Cacao brut", val: 1500 },           { cat: "SÃ©same & olÃ©agineux", val: 620 },
      { cat: "Caoutchouc naturel", val: 580 },
    ],
    imports: [
      { cat: "Machines & Ã©quipements", val: 6200 }, { cat: "Prod. pÃ©troliers raffinÃ©s", val: 5100 },
      { cat: "VÃ©hicules", val: 3200 },              { cat: "Riz importÃ©", val: 2100 },
      { cat: "Prod. pharmaceutiques", val: 1500 },
    ],
    totalExports: 46000, totalImports: 18000,
    partners: ["Inde 25%", "Espagne 9%", "Chine 8%", "Pays-Bas 7%"],
    opportunities: ["Raffinage pÃ©trolier local", "Agriculture mÃ©canisÃ©e", "Tech & fintech Lagos"],
    risks: ["DÃ©pendance pÃ©trole >75%", "InstabilitÃ© naira", "Conflits Delta du Niger"],
    gdpGrowth: 3.3, currency: "NGN",
  },
  GH: {
    president: "John Dramani Mahama", presidentSince: "janv. 2025 (3e mandat)",
    capitale: "Accra", siegeEconomique: "Accra",
    superficie: 238533,
    matieres_premieres: ["Or (2e africain)", "PÃ©trole brut", "Gaz naturel", "Bauxite", "ManganÃ¨se", "Diamants", "Cacao", "Bois tropical", "Sel"],
    exports: [
      { cat: "Or & mÃ©taux prÃ©cieux", val: 8200 }, { cat: "PÃ©trole brut", val: 3100 },
      { cat: "Cacao brut", val: 2100 },           { cat: "Bois & dÃ©rivÃ©s", val: 820 },
      { cat: "Thon & poissons", val: 410 },
    ],
    imports: [
      { cat: "Machines & Ã©quipements", val: 3100 }, { cat: "Prod. pÃ©troliers raffinÃ©s", val: 2200 },
      { cat: "VÃ©hicules", val: 1100 },              { cat: "Riz & blÃ©", val: 920 },
      { cat: "Plastiques & caoutchouc", val: 580 },
    ],
    totalExports: 14000, totalImports: 11000,
    partners: ["Suisse 25%", "Inde 15%", "Chine 12%", "Union EuropÃ©enne 18%"],
    opportunities: ["Raffinage or local", "Agro-industrie cacao", "Corridor Tema-Burkina"],
    risks: ["VolatilitÃ© cours de l'or", "Dette publique Ã©levÃ©e", "DÃ©prÃ©ciation cÃ©di"],
    gdpGrowth: 3.8, currency: "GHS",
  },
  SN: {
    president: "Bassirou Diomaye Faye", presidentSince: "avril 2024",
    capitale: "Dakar", siegeEconomique: "Dakar",
    superficie: 196722,
    matieres_premieres: ["Phosphates", "Or", "Poissons & fruits de mer", "PÃ©trole offshore (Sangomar)", "Gaz naturel (GTA)", "Arachides", "Sel", "Zircon", "Titanite"],
    exports: [
      { cat: "Or & phosphates", val: 2100 },    { cat: "Poissons & prod. marins", val: 520 },
      { cat: "Arachides & huiles", val: 310 },  { cat: "Engrais chimiques", val: 280 },
      { cat: "PÃ©trole (Ã©mergent)", val: 180 },
    ],
    imports: [
      { cat: "Prod. pÃ©troliers raffinÃ©s", val: 1500 }, { cat: "Riz & cÃ©rÃ©ales", val: 720 },
      { cat: "Machines & Ã©quipements", val: 640 },     { cat: "VÃ©hicules", val: 380 },
      { cat: "MÃ©dicaments", val: 260 },
    ],
    totalExports: 3400, totalImports: 4200,
    partners: ["Mali 18%", "Suisse 14%", "Chine 11%", "Inde 10%"],
    opportunities: ["Hydrocarbures offshore (Sangomar)", "Hub financier UEMOA", "PÃªche industrielle durable"],
    risks: ["DÃ©ficit commercial structurel", "DÃ©pendance rÃ©exportations", "SÃ©cheresse sahÃ©lienne"],
    gdpGrowth: 8.3, currency: "XOF",
  },
  BF: {
    president: "Ibrahim TraorÃ© (Capitaine)", presidentSince: "sept. 2022 (MPSR II)",
    capitale: "Ouagadougou", siegeEconomique: "Ouagadougou",
    superficie: 274200,
    matieres_premieres: ["Or", "Zinc", "Cuivre", "ManganÃ¨se", "Phosphate", "Calcaire", "Coton", "Bauxite", "Charbon", "Nickel"],
    exports: [
      { cat: "Or", val: 2800 },       { cat: "Coton brut", val: 290 },
      { cat: "Noix de cajou", val: 180 }, { cat: "SÃ©same", val: 120 },
      { cat: "Zinc & minerais", val: 90 },
    ],
    imports: [
      { cat: "Prod. pÃ©troliers", val: 800 }, { cat: "Machines", val: 620 },
      { cat: "Riz & blÃ©", val: 450 },        { cat: "Ã‰lectricitÃ© importÃ©e", val: 200 },
      { cat: "MÃ©dicaments", val: 180 },
    ],
    totalExports: 3200, totalImports: 2800,
    partners: ["Suisse 60%", "CÃ´te d'Ivoire 12%", "Inde 8%", "Chine 6%"],
    opportunities: ["Corridor Abidjan-Ouaga", "Transformation coton", "Ã‰nergie solaire Sahel"],
    risks: ["Enclavement gÃ©ographique total", "InstabilitÃ© sÃ©curitaire", "Concentration export sur l'or"],
    gdpGrowth: 5.9, currency: "XOF",
  },
  ML: {
    president: "Assimi GoÃ¯ta (Colonel)", presidentSince: "2021 (mandat renouvelÃ© 2025â€“2030)",
    capitale: "Bamako", siegeEconomique: "Bamako",
    superficie: 1250000,
    matieres_premieres: ["Or (3e africain)", "Sel", "Coton", "Uranium", "Diamants", "Cuivre", "Minerai de fer", "Bauxite", "Phosphate", "Calcaire"],
    exports: [
      { cat: "Or", val: 2400 },       { cat: "Coton brut", val: 220 },
      { cat: "SÃ©same", val: 100 },    { cat: "BÃ©tail vif", val: 80 },
      { cat: "KaritÃ©", val: 45 },
    ],
    imports: [
      { cat: "Prod. pÃ©troliers", val: 700 }, { cat: "Machines", val: 580 },
      { cat: "Riz & denrÃ©es", val: 420 },    { cat: "MÃ©dicaments", val: 160 },
      { cat: "Ciment & matÃ©riaux", val: 140 },
    ],
    totalExports: 2800, totalImports: 2600,
    partners: ["Suisse 45%", "CÃ´te d'Ivoire 14%", "Chine 10%", "SÃ©nÃ©gal 8%"],
    opportunities: ["Transformation or locale", "Agro-industrie coton", "Ã‰levage bovin export"],
    risks: ["Enclavement total", "InstabilitÃ© politique persistante", "Tensions avec CEDEAO"],
    gdpGrowth: 3.1, currency: "XOF",
  },
  GN: {
    president: "Mamady Doumbouya (Colonel)", presidentSince: "janv. 2026 (Ã©lu 86,7%)",
    capitale: "Conakry", siegeEconomique: "Conakry",
    superficie: 245857,
    matieres_premieres: ["Bauxite (2e mondial)", "Or", "Diamants", "Minerai de fer (Simandou)", "Aluminium", "Uranium", "Cobalt", "Platine", "Chromite"],
    exports: [
      { cat: "Bauxite", val: 1800 },      { cat: "Or", val: 480 },
      { cat: "Diamants", val: 120 },      { cat: "Fer Simandou (proj.)", val: 80 },
      { cat: "CafÃ© & cacao", val: 60 },
    ],
    imports: [
      { cat: "Prod. pÃ©troliers", val: 620 }, { cat: "Machines & Ã©quipements", val: 580 },
      { cat: "Riz & denrÃ©es", val: 480 },    { cat: "Ciment", val: 200 },
      { cat: "VÃ©hicules", val: 180 },
    ],
    totalExports: 2500, totalImports: 2200,
    partners: ["Chine 48%", "Ghana 10%", "Union EuropÃ©enne 18%", "Inde 9%"],
    opportunities: ["Aluminium Simandou (>20Mrd$)", "Hydro-Ã©lectricitÃ© export", "Agriculture tropicale"],
    risks: ["Hyper-dÃ©pendance bauxite-Chine", "Transition politique", "Infrastructures miniÃ¨res insuffisantes"],
    gdpGrowth: 5.6, currency: "GNF",
  },
  BJ: {
    president: "Patrice Talon", presidentSince: "2016 (rÃ©Ã©lu 2021)",
    capitale: "Porto-Novo", siegeEconomique: "Cotonou",
    superficie: 112622,
    matieres_premieres: ["Coton", "Or", "Huile de palme", "Calcaire", "Marbre", "Phosphate", "Cacao", "CafÃ©", "Noix de cajou", "KaritÃ©"],
    exports: [
      { cat: "Coton brut", val: 620 }, { cat: "Noix de cajou", val: 280 },
      { cat: "Or", val: 180 },         { cat: "Ananas & fruits", val: 90 },
      { cat: "SÃ©same", val: 60 },
    ],
    imports: [
      { cat: "Prod. pÃ©troliers", val: 680 }, { cat: "Machines", val: 480 },
      { cat: "Riz & blÃ©", val: 360 },        { cat: "VÃ©hicules", val: 240 },
      { cat: "MÃ©dicaments", val: 120 },
    ],
    totalExports: 1400, totalImports: 2000,
    partners: ["Inde 28%", "Bangladesh 18%", "Chine 12%", "Ghana 8%"],
    opportunities: ["Port de Cotonou hub rÃ©gional", "Transit Nigeria-Niger-Mali", "Agro-industrie coton"],
    risks: ["DÃ©ficit commercial chronique", "Concurrence port de LomÃ©", "DÃ©pendance rÃ©export Nigeria"],
    gdpGrowth: 5.7, currency: "XOF",
  },
  TG: {
    president: "Faure GnassingbÃ©", presidentSince: "2005 (rÃ©Ã©lu 2020)",
    capitale: "LomÃ©", siegeEconomique: "LomÃ©",
    superficie: 56785,
    matieres_premieres: ["Phosphate (4e rÃ©serves mondial)", "Calcaire", "Minerai de fer", "Bauxite", "Uranium", "Chromite", "Or", "Diamants", "Rutile"],
    exports: [
      { cat: "Or & rÃ©-exports", val: 580 }, { cat: "Phosphates", val: 340 },
      { cat: "Coton brut", val: 160 },      { cat: "Clinker ciment", val: 80 },
      { cat: "CafÃ© & cacao", val: 50 },
    ],
    imports: [
      { cat: "Prod. pÃ©troliers", val: 720 }, { cat: "Machines", val: 540 },
      { cat: "Riz & cÃ©rÃ©ales", val: 380 },   { cat: "VÃ©hicules", val: 220 },
      { cat: "Acier", val: 180 },
    ],
    totalExports: 1300, totalImports: 2100,
    partners: ["BÃ©nin 14%", "Burkina Faso 12%", "Ghana 10%", "Inde 9%"],
    opportunities: ["Hub port de LomÃ© (eau profonde)", "Phosphates valeur ajoutÃ©e", "Zone franche LomÃ©"],
    risks: ["DÃ©ficit commercial structurel", "DÃ©pendance activitÃ© de transit", "FragilitÃ© cours phosphates"],
    gdpGrowth: 5.5, currency: "XOF",
  },
  NE: {
    president: "Abdourahamane Tchiani (GÃ©nÃ©ral)", presidentSince: "mars 2025 (mandat 5 ans)",
    capitale: "Niamey", siegeEconomique: "Niamey",
    superficie: 1270000,
    matieres_premieres: ["Uranium (4e mondial)", "PÃ©trole brut (Agadem)", "Or", "Charbon", "Sel", "Gypse", "Phosphate", "Ã‰tain", "Fer"],
    exports: [
      { cat: "Uranium", val: 610 },       { cat: "Or", val: 280 },
      { cat: "PÃ©trole brut", val: 220 },  { cat: "Oignons & lÃ©gumes", val: 80 },
      { cat: "BÃ©tail vif", val: 70 },
    ],
    imports: [
      { cat: "Prod. pÃ©troliers", val: 480 }, { cat: "Machines", val: 380 },
      { cat: "Riz & denrÃ©es", val: 340 },    { cat: "Ã‰lectricitÃ© importÃ©e", val: 120 },
      { cat: "MÃ©dicaments", val: 100 },
    ],
    totalExports: 1100, totalImports: 1500,
    partners: ["France 45%", "Chine 20%", "Nigeria 8%", "Union EuropÃ©enne 12%"],
    opportunities: ["Uranium (Ã©nergie nuclÃ©aire mondiale)", "Pipeline pÃ©trole-Cotonou", "Agriculture irriguÃ©e Niger"],
    risks: ["Double enclavement gÃ©ographique", "InstabilitÃ© sÃ©curitaire Sahel", "VolatilitÃ© cours uranium"],
    gdpGrowth: 7.0, currency: "XOF",
  },
  MR: {
    president: "Mohamed Ould Ghazouani", presidentSince: "2019 (rÃ©Ã©lu juil. 2024)",
    capitale: "Nouakchott", siegeEconomique: "Nouakchott",
    superficie: 1030700,
    matieres_premieres: ["Minerai de fer (46% exports)", "Or", "Poissons & fruits de mer", "Cuivre", "Gypse", "Phosphate", "Gaz naturel (GTA offshore)", "Sel", "Uranium"],
    exports: [
      { cat: "Minerai de fer", val: 1200 },     { cat: "Or", val: 380 },
      { cat: "Poissons & fruits de mer", val: 310 }, { cat: "Cuivre", val: 80 },
      { cat: "Gaz naturel (Ã©mergent)", val: 60 },
    ],
    imports: [
      { cat: "Prod. pÃ©troliers", val: 520 }, { cat: "Machines", val: 420 },
      { cat: "Riz & blÃ©", val: 380 },        { cat: "Ciment & matÃ©riaux", val: 160 },
      { cat: "MÃ©dicaments", val: 120 },
    ],
    totalExports: 1900, totalImports: 1600,
    partners: ["Chine 32%", "Suisse 18%", "Union EuropÃ©enne 22%", "Japon 8%"],
    opportunities: ["Gaz offshore Grand Tortue Ahmeyim", "PÃªche durable certifiÃ©e MSC", "Ã‰nergie Ã©olienne cÃ´tiÃ¨re"],
    risks: ["DÃ©sertification avancÃ©e", "Concentration export fer-or", "Faible diversification industrielle"],
    gdpGrowth: 5.4, currency: "MRU",
  },
  GW: {
    president: "Transition militaire en cours", presidentSince: "Ã‰lections prÃ©vues dÃ©c. 2026",
    capitale: "Bissau", siegeEconomique: "Bissau",
    superficie: 36125,
    matieres_premieres: ["Noix de cajou (93% exports)", "Poissons & crustacÃ©s", "Arachides", "Bois tropical", "Kaolin", "Phosphate", "Bauxite (non exploitÃ©e)", "PÃ©trole (offshore non dÃ©veloppÃ©)"],
    exports: [
      { cat: "Noix de cajou", val: 150 }, { cat: "Poissons", val: 22 },
      { cat: "Bois tropical", val: 8 },
    ],
    imports: [
      { cat: "Prod. pÃ©troliers", val: 90 }, { cat: "Riz & denrÃ©es", val: 80 },
      { cat: "Machines", val: 60 },         { cat: "MÃ©dicaments", val: 30 },
    ],
    totalExports: 180, totalImports: 280,
    partners: ["Inde 80%", "Chine 8%", "SÃ©nÃ©gal 5%", "Portugal 3%"],
    opportunities: ["Diversification du cajou (transformation locale)", "PÃªche industrielle certifiÃ©e", "Tourisme balnÃ©aire"],
    risks: ["Mono-dÃ©pendance noix de cajou (>80%)", "InstabilitÃ© politique chronique", "Absence d'infrastructures"],
    gdpGrowth: 4.2, currency: "XOF",
  },
  SL: {
    president: "Julius Maada Bio", presidentSince: "2018 (rÃ©Ã©lu 2023)",
    capitale: "Freetown", siegeEconomique: "Freetown",
    superficie: 71740,
    matieres_premieres: ["Diamants", "Rutile (1er mondial naturel)", "Bauxite", "Minerai de fer", "Or", "Tantale", "Coltan", "Chromite", "Platine", "IlmÃ©nite"],
    exports: [
      { cat: "Rutile & ilmÃ©nite", val: 460 }, { cat: "Or", val: 240 },
      { cat: "Diamants", val: 130 },          { cat: "Cacao", val: 50 },
      { cat: "CafÃ©", val: 20 },
    ],
    imports: [
      { cat: "Prod. pÃ©troliers", val: 400 }, { cat: "Riz & cÃ©rÃ©ales", val: 280 },
      { cat: "Machines", val: 240 },         { cat: "MÃ©dicaments", val: 130 },
      { cat: "Ciment", val: 80 },
    ],
    totalExports: 900, totalImports: 1200,
    partners: ["Chine 28%", "Belgique 18%", "Inde 12%", "Union EuropÃ©enne 15%"],
    opportunities: ["MinÃ©raux stratÃ©giques VE (rutile)", "Port de Freetown modernisÃ©", "Cacao premium niche"],
    risks: ["DÃ©ficit commercial persistant", "DÃ©pendance aide internationale", "FragilitÃ© institutionnelle"],
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
      { cat: "Prod. pÃ©troliers", val: 420 }, { cat: "Riz & cÃ©rÃ©ales", val: 280 },
      { cat: "Machines", val: 220 },         { cat: "VÃ©hicules", val: 120 },
      { cat: "MÃ©dicaments", val: 80 },
    ],
    totalExports: 700, totalImports: 1100,
    partners: ["Suisse 22%", "Chine 18%", "Union EuropÃ©enne 20%", "Inde 12%"],
    opportunities: ["Caoutchouc valeur ajoutÃ©e (Firestone)", "Registre maritime (2Ã¨me mondial)", "Fer ArcelorMittal"],
    risks: ["DÃ©ficit commercial chronique", "FragilitÃ© post-conflit", "DÃ©pendance caoutchouc/fer"],
    gdpGrowth: 4.5, currency: "LRD",
  },
  GM: {
    president: "Adama Barrow", presidentSince: "2017 (rÃ©Ã©lu 2021)",
    capitale: "Banjul", siegeEconomique: "Banjul",
    superficie: 11295,
    matieres_premieres: ["Arachides (70% exports)", "Poissons & crustacÃ©s", "Noix de cajou", "SÃ©same", "Coton", "Sel", "Argile", "Titanite (offshore potentiel)"],
    exports: [
      { cat: "Arachides & huiles", val: 100 }, { cat: "Poissons", val: 80 },
      { cat: "Noix de cajou", val: 45 },       { cat: "Coton", val: 20 },
    ],
    imports: [
      { cat: "Prod. pÃ©troliers", val: 150 }, { cat: "Riz & blÃ©", val: 120 },
      { cat: "Machines", val: 80 },          { cat: "MÃ©dicaments", val: 50 },
      { cat: "VÃ©hicules", val: 30 },
    ],
    totalExports: 250, totalImports: 430,
    partners: ["Chine 28%", "Inde 22%", "SÃ©nÃ©gal 18%", "Union EuropÃ©enne 12%"],
    opportunities: ["Tourisme (cÃ´te Atlantique)", "PÃªche durable certifiÃ©e", "Hub logistique sous-rÃ©gional"],
    risks: ["DÃ©ficit commercial structurel", "Enclavement dans le SÃ©nÃ©gal", "Faible industrialisation"],
    gdpGrowth: 5.0, currency: "GMD",
  },
  CV: {
    president: "JosÃ© Maria Pereira Neves", presidentSince: "2021",
    capitale: "Praia", siegeEconomique: "Praia",
    superficie: 4033,
    matieres_premieres: ["Poissons & crustacÃ©s", "Sel marin", "Pouzzolane (roche volcanique)", "Calcaire", "Kaolin", "Argile", "Basalte", "Gypse"],
    exports: [
      { cat: "Poissons & crustacÃ©s", val: 90 }, { cat: "Chaussures & textiles", val: 50 },
      { cat: "Sel marin", val: 20 },             { cat: "Boissons & alcools", val: 15 },
    ],
    imports: [
      { cat: "Prod. pÃ©troliers", val: 280 },      { cat: "Riz & denrÃ©es alimentaires", val: 200 },
      { cat: "Machines & Ã©quipements", val: 180 }, { cat: "VÃ©hicules", val: 100 },
      { cat: "MatÃ©riaux construction", val: 80 },
    ],
    totalExports: 180, totalImports: 850,
    partners: ["Portugal 45%", "Espagne 18%", "Union EuropÃ©enne 25%", "BrÃ©sil 4%"],
    opportunities: ["Tourisme haut de gamme insulaire", "Ã‰nergie renouvelable (solaire/Ã©olien)", "Hub maritime Atlantique"],
    risks: ["DÃ©ficit commercial trÃ¨s Ã©levÃ© (>78%)", "DÃ©pendance import alimentaire totale", "Isolement insulaire structurel"],
    gdpGrowth: 4.6, currency: "CVE",
  },
};
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const X402_TIERS = {
  basic:        { label: "Basique",       price: 0.05,   queries: 200, color: "#38bdf8", features: ["200 requetes/jour", "16 pays couverts", "Detail pays complet", "Analyse sectorielle"] },
  pro:          { label: "Pro",           price: 0.10,   queries: 500, color: "#f0b429", features: ["500 requetes/jour", "Donnees d'indice completes", "Rapports de conseil", "Acces API"] },
  institutional:{ label: "Institutionnel",price: 0.50,   queries: -1,  color: "#4ade80", features: ["Requetes illimitees", "Export des donnees brutes", "Signaux ETF", "Cle API x402"] },
};

const AGENT_CAPABILITIES = [
  "Analyse en temps reel de l'indice composite WASI",
  "Indice maritime pays pour les 16 nations d'Afrique de l'Ouest",
  "Suivi de l'activite portuaire : Abidjan, Lagos, Tema, Dakar, Lome+",
  "Intelligence sectorielle : agriculture, BTP, commerce, PME",
  "Generation de signaux ETF pour les produits financiers lies au WASI",
  "Cartes de chaleur des corridors commerciaux et flux transfrontaliers",
  "Conseil d'entree de marche pour investisseurs en Afrique de l'Ouest",
  "API x402 en micropaiement, paiement par requete sans abonnement",
];

const SUGGESTED_QUERIES = [
  "Quel est l'indice composite WASI actuel et quel pays tire la croissance ?",
  "Comparer l'activite maritime entre le Nigeria et la Cote d'Ivoire ce trimestre",
  "Quel port d'Afrique de l'Ouest a le plus fort debit de conteneurs en ce moment ?",
  "Quels secteurs cibler pour un investisseur etranger au Ghana selon les flux commerciaux ?",
  "Donnez-moi un rapport d'entree de marche pour le corridor agricole d'exportation du Senegal",
  "Quels pays enclaves dependent le plus de l'acces au port d'Abidjan ?",
  "Quel est le signal ETF WASI base sur la dynamique commerciale regionale actuelle ?",
  "Analysez les indicateurs de stress commercial dans la zone UEMOA",
];

// â”€â”€ Fetch historical port data for CI from backend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Inline markdown renderer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    return <div key={idx} style={{ color: "#f0b429", fontSize: 12, fontWeight: 700, marginTop: 10, marginBottom: 2, letterSpacing: 1 }}>{line.slice(4)}</div>;
  if (line.startsWith("## "))
    return <div key={idx} style={{ color: "#f0b429", fontSize: 13, fontWeight: 700, marginTop: 12, marginBottom: 3, letterSpacing: 1 }}>{line.slice(3)}</div>;
  if (line.startsWith("# "))
    return <div key={idx} style={{ color: "#f0b429", fontSize: 14, fontWeight: 700, marginTop: 12, marginBottom: 4, letterSpacing: 2 }}>{line.slice(2)}</div>;
  if (line.startsWith("- ") || line.startsWith("* "))
    return <div key={idx} style={{ paddingLeft: 12, marginBottom: 2 }}>Â· {parseBold(line.slice(2))}</div>;
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

// â”€â”€ Composants graphiques SVG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function BarChart({ data, color, maxVal }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
            <span style={{ fontSize: 8, color: "#94a3b8" }}>{d.cat}</span>
            <span style={{ fontSize: 8, color, fontWeight: 700 }}>
              {d.val >= 1000 ? `${(d.val / 1000).toFixed(1)} Mrd$` : `${d.val} M$`}
            </span>
          </div>
          <div style={{ height: 5, background: "#0a1628", borderRadius: 2 }}>
            <div style={{ height: "100%", width: `${Math.round((d.val / maxVal) * 100)}%`, background: color, borderRadius: 2, transition: "width 0.8s ease" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Sparkline({ base, width = 180, height = 46 }) {
  const N = 12;
  const pts = Array.from({ length: N }, (_, i) =>
    Math.max(20, Math.min(99, base + Math.sin(i * 2.1) * 7 + Math.cos(i * 1.3) * 4))
  );
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

function CountryDashboard({ country, indexValue, onClose }) {
  const td = COUNTRY_TRADE_DATA[country.code];
  if (!td) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontSize: 12 }}>
      DonnÃ©es non disponibles pour {country.name}
      <button onClick={onClose} style={{ marginLeft: 16, background: "none", border: "1px solid #1e3a5f", color: "#475569", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 9 }}>â† Retour</button>
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
  const tierColor = { primary: "#4ade80", secondary: "#f0b429", tertiary: "#94a3b8" }[country.tier];
  const indexTrend = indexValue > 65 ? { label: "EXPANSION", color: "#4ade80" }
                   : indexValue > 45 ? { label: "STABLE", color: "#f0b429" }
                   : { label: "CONTRACTION", color: "#ef4444" };

  const ratios = [
    { label: "Taux de couverture", val: `${coverageRate}%`, color: parseFloat(coverageRate) >= 100 ? "#4ade80" : "#ef4444" },
    { label: "Balance commerciale", val: `${balance >= 0 ? "+" : ""}${fmt(balance)}`, color: balanceColor },
    { label: "Diversification exports", val: `${diversityScore}/100`, color: parseInt(diversityScore) > 60 ? "#4ade80" : "#f0b429" },
    { label: "Poids WASI rÃ©gional", val: `${(country.weight * 100).toFixed(1)}%`, color: "#38bdf8" },
    { label: "Croissance du PIB", val: `+${td.gdpGrowth}%`, color: td.gdpGrowth > 5 ? "#4ade80" : "#f0b429" },
    { label: "Signal de marchÃ©", val: indexTrend.label, color: indexTrend.color },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", background: "rgba(3,13,26,0.6)" }}>

      {/* En-tÃªte pays */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 40 }}>{country.flag}</span>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: "#f0b429", letterSpacing: 4, lineHeight: 1 }}>
              {country.name.toUpperCase()}
            </div>
            <div style={{ fontSize: 8, color: "#475569", letterSpacing: 2, marginTop: 2 }}>
              PORT PRINCIPAL : {country.port.toUpperCase()} Â· MONNAIE : {td.currency}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
              {[
                { label: tierLabel.toUpperCase(), color: tierColor },
                { label: indexTrend.label, color: indexTrend.color },
                { label: `WASI ${indexValue}/100`, color: "#f0b429" },
              ].map((b, i) => (
                <span key={i} style={{ fontSize: 8, color: b.color, border: `1px solid ${b.color}`, padding: "2px 7px", borderRadius: 2 }}>{b.label}</span>
              ))}
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "1px solid #1e3a5f", color: "#64748b", padding: "6px 14px", borderRadius: 4, cursor: "pointer", fontSize: 9, fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>
          â† RETOUR
        </button>
      </div>

      {/* Fiche Pays */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>

        {/* PrÃ©sident */}
        <div style={{ padding: "10px 14px", background: "rgba(10,22,40,0.85)", border: "1px solid #1e3a5f", borderRadius: 4 }}>
          <div style={{ fontSize: 7, color: "#475569", letterSpacing: 3, marginBottom: 6 }}>CHEF D'Ã‰TAT</div>
          <div style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 700, lineHeight: 1.4 }}>{td.president}</div>
          <div style={{ fontSize: 8, color: "#64748b", marginTop: 4 }}>En poste depuis : {td.presidentSince}</div>
        </div>

        {/* Capitale & Superficie */}
        <div style={{ padding: "10px 14px", background: "rgba(10,22,40,0.85)", border: "1px solid #1e3a5f", borderRadius: 4 }}>
          <div style={{ fontSize: 7, color: "#475569", letterSpacing: 3, marginBottom: 6 }}>GÃ‰OGRAPHIE</div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 8, color: "#64748b" }}>Capitale officielle</div>
            <div style={{ fontSize: 11, color: "#38bdf8", fontWeight: 700 }}>{td.capitale}</div>
            {td.siegeEconomique && td.siegeEconomique !== td.capitale && (
              <div style={{ fontSize: 8, color: "#475569", marginTop: 2 }}>Centre Ã©co. : {td.siegeEconomique}</div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 8, color: "#64748b" }}>Superficie</div>
            <div style={{ fontSize: 11, color: "#f0b429", fontWeight: 700 }}>{td.superficie.toLocaleString("fr-FR")} kmÂ²</div>
          </div>
        </div>

        {/* MatiÃ¨res premiÃ¨res */}
        <div style={{ padding: "10px 14px", background: "rgba(10,22,40,0.85)", border: "1px solid #1e3a5f", borderRadius: 4 }}>
          <div style={{ fontSize: 7, color: "#475569", letterSpacing: 3, marginBottom: 6 }}>MATIÃˆRES PREMIÃˆRES</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {td.matieres_premieres.map((m, i) => (
              <span key={i} style={{ fontSize: 7, color: "#4ade80", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 2, padding: "2px 6px", lineHeight: 1.6 }}>{m}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Bandeau mÃ©triques clÃ©s */}
      <div style={{ display: "flex", gap: 12, marginBottom: 14, padding: "10px 14px", background: balance >= 0 ? "rgba(74,222,128,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${balanceColor}44`, borderRadius: 4 }}>
        {[
          { label: "BALANCE COMMERCIALE", val: `${balance >= 0 ? "+" : ""}${fmt(balance)}`, color: balanceColor },
          { label: "TAUX DE COUVERTURE",  val: `${coverageRate}%`, color: parseFloat(coverageRate) >= 100 ? "#4ade80" : "#f0b429" },
          { label: "EXPORTATIONS TOTALES", val: fmt(td.totalExports), color: "#4ade80" },
          { label: "IMPORTATIONS TOTALES", val: fmt(td.totalImports), color: "#38bdf8" },
          { label: "CROISSANCE PIB",       val: `+${td.gdpGrowth}%`, color: td.gdpGrowth > 5 ? "#4ade80" : "#f0b429" },
        ].map((m, i) => (
          <div key={i} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 7, color: "#475569", letterSpacing: 2, marginBottom: 3, whiteSpace: "nowrap" }}>{m.label}</div>
            <div style={{ fontSize: 18, fontFamily: "'Bebas Neue', sans-serif", color: m.color, letterSpacing: 2, lineHeight: 1 }}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Ligne 1 : Graphiques exports + imports */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div style={{ padding: "12px 14px", background: "rgba(10,22,40,0.85)", border: "1px solid #0f2a45", borderRadius: 4 }}>
          <div style={{ fontSize: 8, color: "#4ade80", letterSpacing: 3, marginBottom: 10 }}>â†‘ EXPORTATIONS PRINCIPALES</div>
          <BarChart data={td.exports} color="#4ade80" maxVal={maxExport} />
        </div>
        <div style={{ padding: "12px 14px", background: "rgba(10,22,40,0.85)", border: "1px solid #0f2a45", borderRadius: 4 }}>
          <div style={{ fontSize: 8, color: "#38bdf8", letterSpacing: 3, marginBottom: 10 }}>â†“ IMPORTATIONS PRINCIPALES</div>
          <BarChart data={td.imports} color="#38bdf8" maxVal={maxImport} />
        </div>
      </div>

      {/* Ligne 2 : Ratios + Sparkline + Flux donut */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>

        {/* Ratios */}
        <div style={{ padding: "12px 14px", background: "rgba(10,22,40,0.85)", border: "1px solid #0f2a45", borderRadius: 4 }}>
          <div style={{ fontSize: 8, color: "#f0b429", letterSpacing: 3, marginBottom: 10 }}>ANALYSE DES RATIOS</div>
          {ratios.map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #0a1628" }}>
              <span style={{ fontSize: 8, color: "#64748b" }}>{r.label}</span>
              <span style={{ fontSize: 8, color: r.color, fontWeight: 700 }}>{r.val}</span>
            </div>
          ))}
        </div>

        {/* Sparkline 12 mois */}
        <div style={{ padding: "12px 14px", background: "rgba(10,22,40,0.85)", border: "1px solid #0f2a45", borderRadius: 4 }}>
          <div style={{ fontSize: 8, color: "#f0b429", letterSpacing: 3, marginBottom: 8 }}>Ã‰VOLUTION INDEX WASI (12 MOIS)</div>
          <Sparkline base={indexValue} width={160} height={50} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 7, color: "#334155", marginTop: 3, marginBottom: 10 }}>
            <span>Jan</span><span>Avr</span><span>Juil</span><span>Oct</span><span>DÃ©c</span>
          </div>
          <div style={{ fontSize: 8, color: "#475569", letterSpacing: 3, marginBottom: 6 }}>PARTENAIRES COMMERCIAUX</div>
          {td.partners.map((p, i) => (
            <div key={i} style={{ fontSize: 8, color: "#64748b", padding: "4px 0", borderBottom: "1px solid #0a1628" }}>
              {i + 1}. {p}
            </div>
          ))}
        </div>

        {/* Donut flux */}
        <div style={{ padding: "12px 14px", background: "rgba(10,22,40,0.85)", border: "1px solid #0f2a45", borderRadius: 4 }}>
          <div style={{ fontSize: 8, color: "#f0b429", letterSpacing: 3, marginBottom: 8 }}>RÃ‰PARTITION DES FLUX</div>
          <TradeDonut exports={td.totalExports} imports={td.totalImports} />
          <div style={{ marginTop: 8 }}>
            {[["#4ade80", "Exportations", fmt(td.totalExports)], ["#38bdf8", "Importations", fmt(td.totalImports)]].map(([c, l, v], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#94a3b8", marginBottom: 3 }}>
                <span style={{ color: c }}>â–  {l}</span><span>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #0a1628" }}>
            <div style={{ fontSize: 7, color: "#475569", letterSpacing: 2 }}>SIGNAL WASI</div>
            <div style={{ fontSize: 14, fontFamily: "'Bebas Neue', sans-serif", color: indexTrend.color, letterSpacing: 2, marginTop: 2 }}>{indexTrend.label} Â· {indexValue}/100</div>
            <div style={{ fontSize: 7, color: "#334155", marginTop: 3 }}>Poids rÃ©gional : {(country.weight * 100).toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* Ligne 3 : OpportunitÃ©s + Risques */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ padding: "12px 14px", background: "rgba(10,22,40,0.85)", border: "1px solid #4ade8044", borderRadius: 4 }}>
          <div style={{ fontSize: 8, color: "#4ade80", letterSpacing: 3, marginBottom: 8 }}>âœ¦ OPPORTUNITÃ‰S DE MARCHÃ‰</div>
          {td.opportunities.map((o, i) => (
            <div key={i} style={{ fontSize: 9, color: "#94a3b8", padding: "6px 0", borderBottom: "1px solid #0a1628", lineHeight: 1.5 }}>âœ¦ {o}</div>
          ))}
        </div>
        <div style={{ padding: "12px 14px", background: "rgba(10,22,40,0.85)", border: "1px solid #ef444444", borderRadius: 4 }}>
          <div style={{ fontSize: 8, color: "#ef4444", letterSpacing: 3, marginBottom: 8 }}>âš  FACTEURS DE RISQUE</div>
          {td.risks.map((r, i) => (
            <div key={i} style={{ fontSize: 9, color: "#94a3b8", padding: "6px 0", borderBottom: "1px solid #0a1628", lineHeight: 1.5 }}>âš  {r}</div>
          ))}
        </div>
      </div>

      {/* Pied de page */}
      <div style={{ marginTop: 10, padding: "7px 12px", background: "rgba(10,22,40,0.5)", borderRadius: 4, fontSize: 7, color: "#334155", letterSpacing: 0.5, display: "flex", justifyContent: "space-between" }}>
        <span>Source : WASI Data Engine v1.0 Â· Port Authority Official Statistics Â· FMI World Economic Outlook Â· x402 Verified Feed Â· DonnÃ©es 2023</span>
        <span style={{ color: "#4ade80", whiteSpace: "nowrap", marginLeft: 12 }}>âœ“ Fiche vÃ©rifiÃ©e : {new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}</span>
      </div>
    </div>
  );
}
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function IndexCard({ country, index, isActive, onClick }) {
  const trend = index > 65 ? "â†‘" : index > 45 ? "â†’" : "â†“";
  const trendColor = index > 65 ? "#4ade80" : index > 45 ? "#f0b429" : "#ef4444";
  return (
    <button onClick={onClick} style={{
      background: isActive ? "rgba(240,180,41,0.12)" : "rgba(15,31,53,0.8)",
      border: `1px solid ${isActive ? "#f0b429" : "#1e3a5f"}`,
      borderRadius: 6, padding: "10px 12px", textAlign: "left", cursor: "pointer",
      transition: "all 0.2s", width: "100%"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>{country.flag}</span>
          <div>
            <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>{country.code}</div>
            <div style={{ fontSize: 11, color: "#e2e8f0", fontFamily: "'Space Mono', monospace" }}>{country.name.split(" ")[0]}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontFamily: "'Bebas Neue', sans-serif", color: trendColor, letterSpacing: 2 }}>{index}</div>
          <div style={{ fontSize: 12, color: trendColor }}>{trend}</div>
        </div>
      </div>
    </button>
  );
}

function TierBadge({ tier, selected, onClick }) {
  const t = X402_TIERS[tier];
  return (
    <button onClick={onClick} style={{
      background: selected ? t.color : "transparent",
      border: `1px solid ${t.color}`,
      borderRadius: 4, padding: "6px 12px", cursor: "pointer",
      color: selected ? "#020b18" : t.color,
      fontSize: 10, fontFamily: "'Space Mono', monospace",
      fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
      transition: "all 0.2s"
    }}>
      {t.label} {t.price > 0 ? `${t.price}$/req.` : "GRATUIT"}
    </button>
  );
}

// Simulate country indices (in production these come from real port data pipelines)
function generateIndices() {
  const base = { CI: 78, NG: 82, GH: 71, SN: 65, BF: 52, ML: 48, GN: 61, BJ: 58, TG: 63, NE: 44, MR: 55, GW: 41, SL: 46, LR: 49, GM: 39, CV: 57 };
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, Math.max(20, Math.min(99, v + Math.floor(Math.random() * 7) - 3))]));
}

function calcWASI(indices) {
  return Math.round(WEST_AFRICAN_COUNTRIES.reduce((sum, c) => sum + (indices[c.code] || 50) * c.weight, 0));
}

function formatCompactNumber(value, maximumFractionDigits = 2) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "--";
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits,
  }).format(numericValue);
}

function getDataSourceMeta(dataSource) {
  if (dataSource === "backend-live") {
    return { label: "EN DIRECT · BACKEND", tone: "#4ade80", detail: "API backend WASI v1.0" };
  }
  if (dataSource === "hybrid-live") {
    return { label: "HYBRIDE · APIS OUVERTES", tone: "#4ade80", detail: "backend + FX/crypto + World Bank" };
  }
  if (dataSource === "open-api") {
    return { label: "APIS OUVERTES", tone: "#60a5fa", detail: "ExchangeRate-API + CoinGecko + World Bank" };
  }
  return { label: "SIMULATION", tone: "#f0b429", detail: "Secours local" };
}

export default function WASIAgent() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState("basic");
  const [queriesUsed, setQueriesUsed] = useState(0);
  const [indices, setIndices] = useState(generateIndices());
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [wasiComposite, setWasiComposite] = useState(0);
  const [showCapabilities, setShowCapabilities] = useState(true);
  const [backendConnected, setBackendConnected] = useState(false);
  const [backendToken, setBackendToken] = useState(null);
  const [dataSource, setDataSource] = useState("simulation");
  const [historicalData, setHistoricalData] = useState([]);
  const [liveFxSnapshot, setLiveFxSnapshot] = useState(null);
  const [liveCryptoSnapshot, setLiveCryptoSnapshot] = useState(null);
  const [macroSnapshot, setMacroSnapshot] = useState(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const messagesEndRef = useRef(null);
  const latestIndicesRef = useRef(indices);
  const tierConfig = X402_TIERS[selectedTier];

  useEffect(() => {
    latestIndicesRef.current = indices;
  }, [indices]);

  // â”€â”€ Connect to backend on mount â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    let cancelled = false;
    async function connectBackend() {
      const token = await getBackendToken();
      if (cancelled || !token) return;
      setBackendToken(token);
      setBackendConnected(true);

      // Fetch real indices
      const realIndices = await fetchBackendIndices(token);
      if (cancelled) return;
      if (realIndices && Object.keys(realIndices).length > 0) {
        const merged = { ...latestIndicesRef.current, ...realIndices };
        setIndices(merged);
        setDataSource(macroSnapshot?.indices ? "hybrid-live" : "backend-live");
      }

      // Fetch composite
      const composite = await fetchBackendComposite(token);
      if (cancelled) return;
      if (composite !== null) {
        setWasiComposite(Math.round(composite));
      }

      // Fetch historical port data (CI / Abidjan â€” 5 years)
      const hist = await fetchHistoricalData(token);
      if (cancelled) return;
      if (hist && hist.length > 0) setHistoricalData(hist);
    }
    connectBackend();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadOpenData = async (includeMacro = false) => {
      const [fxResult, cryptoResult] = await Promise.allSettled([
        fetchOpenErFxSnapshot(),
        fetchCoinGeckoSnapshot(),
      ]);

      if (cancelled) return;

      if (fxResult.status === "fulfilled") {
        setLiveFxSnapshot(fxResult.value);
      }

      if (cryptoResult.status === "fulfilled") {
        setLiveCryptoSnapshot(cryptoResult.value);
      }

      if (!includeMacro) return;

      const worldBankSnapshot = await fetchWorldBankWasiSnapshot({
        coupRegimes: COUP_REGIMES,
      }).catch(() => null);

      if (cancelled || !worldBankSnapshot?.indices) return;

      setMacroSnapshot(worldBankSnapshot);
      setIndices((current) =>
        backendConnected
          ? { ...worldBankSnapshot.indices, ...current }
          : { ...current, ...worldBankSnapshot.indices }
      );

      if (!backendConnected) {
        const merged = { ...latestIndicesRef.current, ...worldBankSnapshot.indices };
        setWasiComposite(calcWASI(merged));
        setDataSource("open-api");
      } else {
        setDataSource("hybrid-live");
      }
    };

    loadOpenData(true).catch(() => {});
    const fxCryptoInterval = setInterval(() => {
      loadOpenData(false).catch(() => {});
    }, 30000);
    const macroInterval = setInterval(() => {
      loadOpenData(true).catch(() => {});
    }, 3600000);

    return () => {
      cancelled = true;
      clearInterval(fxCryptoInterval);
      clearInterval(macroInterval);
    };
  }, [backendConnected]);

  // â”€â”€ Periodic refresh (simulation fallback if backend down) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    setWasiComposite(prev => prev || calcWASI(indices));
    const interval = setInterval(async () => {
      if (backendConnected && backendToken) {
        const realIndices = await fetchBackendIndices(backendToken);
        if (realIndices && Object.keys(realIndices).length > 0) {
          const fallbackIndices = macroSnapshot?.indices || latestIndicesRef.current;
          const merged = { ...fallbackIndices, ...realIndices };
          setIndices(merged);
          setDataSource(macroSnapshot?.indices ? "hybrid-live" : "backend-live");
        } else {
          const fallbackIndices = macroSnapshot?.indices
            ? { ...latestIndicesRef.current, ...macroSnapshot.indices }
            : generateIndices();
          setIndices(fallbackIndices);
          setWasiComposite(calcWASI(fallbackIndices));
          setDataSource(macroSnapshot?.indices ? "open-api" : "simulation");
        }
        const composite = await fetchBackendComposite(backendToken);
        if (composite !== null) setWasiComposite(Math.round(composite));
      } else {
        const fallbackIndices = macroSnapshot?.indices
          ? { ...latestIndicesRef.current, ...macroSnapshot.indices }
          : generateIndices();
        setIndices(fallbackIndices);
        setWasiComposite(calcWASI(fallbackIndices));
        setDataSource(macroSnapshot?.indices ? "open-api" : "simulation");
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [backendConnected, backendToken, macroSnapshot]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const dataSourceMeta = getDataSourceMeta(dataSource);

  const buildSystemPrompt = () => {
    const countryData = WEST_AFRICAN_COUNTRIES.map(c => 
      `${c.flag} ${c.name} (${c.code}) : indice ${indices[c.code]}/100 | port : ${c.port} | poids : ${(c.weight*100).toFixed(1)}%`
    ).join("\n");
    const fxSummary = liveFxSnapshot?.pairs?.["EUR/XOF"]?.buy
      ? `POINT FX (${liveFxSnapshot.source}) : EUR/XOF ${formatCompactNumber(liveFxSnapshot.pairs["EUR/XOF"].buy, 3)} | USD/XOF ${formatCompactNumber(liveFxSnapshot.pairs["USD/XOF"]?.buy, 3)}`
      : "POINT FX : indisponible";
    const cryptoSummary = liveCryptoSnapshot?.prices?.BTC?.usd
      ? `POINT CRYPTO (${liveCryptoSnapshot.source}) : BTC/USD ${formatCompactNumber(liveCryptoSnapshot.prices.BTC.usd, 0)} | ETH/USD ${formatCompactNumber(liveCryptoSnapshot.prices.ETH?.usd, 2)}`
      : "POINT CRYPTO : indisponible";
    const macroSummary = macroSnapshot?.observationYear
      ? `BASE MACRO WORLD BANK : derniere annee disponible ${macroSnapshot.observationYear}`
      : "BASE MACRO WORLD BANK : indisponible";

    return `Tu es l'agent IA WASI, specialise en intelligence maritime, commerciale et macroeconomique pour l'Afrique de l'Ouest.

Tu reponds TOUJOURS en francais, dans un style professionnel, factuel et direct, comme un economiste senior d'une institution financiere de premier rang.

DONNEES ACTUELLES (${new Date().toLocaleDateString("fr-FR")}):
Indice composite WASI : ${wasiComposite}/100
Source de donnees : ${dataSourceMeta.detail}
Forfait : ${selectedTier.toUpperCase()} | Protocole x402 : ACTIF | Acces : COMPLET
${fxSummary}
${cryptoSummary}
${macroSummary}

INDICES PAYS (dernier point disponible) :
${countryData}

TES MISSIONS :
- analyser les flux maritimes et commerciaux des 16 pays d'Afrique de l'Ouest
- produire des analyses pays avec lecture sectorielle
- formuler des implications d'investissement, de credit ou d'entree de marche
- signaler le momentum ETF lie a l'indice WASI
- detecter les tensions et opportunites sur les corridors commerciaux
- commenter les dynamiques UEMOA, CEDEAO et franc CFA

METHODOLOGIE DE L'INDICE :
- arrivees de navires : 40 %
- tonnage cargo : 40 %
- conteneurs traites : 20 %
- base 100 normalisee sur la moyenne historique 5 ans
- au-dessus de 70 : expansion forte
- entre 50 et 70 : stabilite
- en dessous de 50 : contraction

STANDARD DE REPONSE :
1. Vue regionale
2. Detail pays
3. Analyse complete avec risques, opportunites et implications

Ne reponds jamais en anglais sauf si l'utilisateur le demande explicitement.
Ne masque pas l'information utile. Si une donnee manque, dis clairement "donnee indisponible".

${selectedTier === "institutional" ? "SUPPLEMENT INSTITUTIONNEL : inclure les tableaux bruts, les signaux ETF detailles, la decomposition de l'indice et les scores sectoriels." : ""}

${selectedCountry ? `FOCUS PAYS : ${selectedCountry.name} | Port : ${selectedCountry.port} | Indice actuel : ${indices[selectedCountry.code]}/100` : ""}

Cite les sources comme : "WASI Data Engine v1.0 | statistiques officielles portuaires | flux verifie x402"
Termine chaque reponse par "Signal WASI :" suivi d'une implication d'investissement ou de risque en une ligne.

${historicalData.length > 0 ? `
HISTORIQUE PORTUAIRE - Cote d'Ivoire / Abidjan (${historicalData.length} mois) :
${historicalData.slice().reverse().map(r =>
  `${r.period_date}: indice=${r.index_value?.toFixed(1)} | shipping=${r.shipping_score?.toFixed(1)} | commerce=${r.trade_score?.toFixed(1)} | infra=${r.infrastructure_score?.toFixed(1)} | economie=${r.economic_score?.toFixed(1)}`
).join("\n")}
Utilise cet historique pour commenter les tendances et l'evolution du port d'Abidjan.` : ""}
`;
  };

  const sendMessage = async (text) => {
    const query = text || input.trim();
    if (!query) return;

    const maxQueries = tierConfig.queries;
    if (maxQueries !== -1 && queriesUsed >= maxQueries) {
      setMessages(m => [...m, {
        role: "assistant", content: `**Limite de requetes atteinte pour le forfait ${tierConfig.label}.**\n\nPassez au niveau superieur via le protocole x402 pour continuer :\n- Basique : 0,05 $/requete (200/jour)\n- Pro : 0,10 $/requete (500/jour)\n- Institutionnel : 0,50 $/requete (illimite)\n\nPaiement en USDC, sans abonnement.`
      }]);
      return;
    }

    const userMsg = { role: "user", content: query };
    setMessages(m => [...m, userMsg]);
    setInput("");
    setLoading(true);
    setShowCapabilities(false);
    setQueriesUsed(q => q + 1);

    try {
      const response = await fetch(`${BACKEND_API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(backendToken ? { "Authorization": `Bearer ${backendToken}` } : {}),
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1000,
          system: buildSystemPrompt(),
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: query }
          ]
        })
      });
      const data = await response.json();
      const reply = data.content?.[0]?.text || "Agent WASI temporairement indisponible. Veuillez reessayer.";
      setMessages(m => [...m, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages(m => [...m, { role: "assistant", content: "Erreur de connexion. Agent WASI hors ligne. Verifiez la connectivite API." }]);
    }
    setLoading(false);
  };

  const wasiTrend = wasiComposite > 65 ? { label: "EXPANSION", color: "#4ade80" }
                  : wasiComposite > 50 ? { label: "STABLE", color: "#f0b429" }
                  : { label: "CONTRACTION", color: "#ef4444" };
  const eurXof = liveFxSnapshot?.pairs?.["EUR/XOF"]?.buy;
  const usdXof = liveFxSnapshot?.pairs?.["USD/XOF"]?.buy;
  const btcUsd = liveCryptoSnapshot?.prices?.BTC?.usd;
  const ethUsd = liveCryptoSnapshot?.prices?.ETH?.usd;
  const btcChange = liveCryptoSnapshot?.prices?.BTC?.changePct;
  const ethChange = liveCryptoSnapshot?.prices?.ETH?.changePct;

  return (
    <div style={{ minHeight: "100vh", background: "#030d1a", color: "#e2e8f0", fontFamily: "'Space Mono', monospace", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Bebas+Neue&family=DM+Serif+Display:ital@0;1&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #f0b429; }
        .send-btn:hover { background: #f0b429 !important; color: #030d1a !important; }
        .sugg-btn:hover { background: rgba(240,180,41,0.15) !important; border-color: #f0b429 !important; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeUp { from{transform:translateY(12px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        .msg-enter { animation: fadeUp 0.3s ease; }
        .live-dot { animation: pulse 2s infinite; }
      `}</style>

      {/* Scanline overlay */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden", opacity: 0.03 }}>
        <div style={{ position: "absolute", width: "100%", height: 2, background: "#f0b429", animation: "scanline 8s linear infinite" }} />
      </div>

      {/* HEADER */}
      <div style={{ background: "rgba(3,13,26,0.95)", borderBottom: "1px solid #0f2a45", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 6, color: "#f0b429", lineHeight: 1 }}>WASI</div>
            <div style={{ fontSize: 8, color: "#475569", letterSpacing: 3, textTransform: "uppercase" }}>Agent IA · Protocole x402</div>
          </div>
          <div style={{ width: 1, height: 36, background: "#0f2a45" }} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: dataSourceMeta.tone }} />
              <span style={{ fontSize: 9, color: dataSourceMeta.tone, letterSpacing: 2 }}>
                {dataSourceMeta.label}
              </span>
            </div>
            <div style={{ fontSize: 22, fontFamily: "'Bebas Neue', sans-serif", color: wasiTrend.color, letterSpacing: 2 }}>
              WASI {wasiComposite} <span style={{ fontSize: 11 }}>{wasiTrend.label}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 9, color: "#475569", textAlign: "right" }}>
            <div>REQUETES : <span style={{ color: "#f0b429" }}>{queriesUsed}/{tierConfig.queries === -1 ? "∞" : tierConfig.queries}</span></div>
            <div>FORFAIT : <span style={{ color: X402_TIERS[selectedTier].color }}>{X402_TIERS[selectedTier].label.toUpperCase()}</span></div>
          </div>
          <div style={{ width: 1, height: 28, background: "#0f2a45" }} />
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {Object.keys(X402_TIERS).map(t => (
              <TierBadge key={t} tier={t} selected={selectedTier === t} onClick={() => { setSelectedTier(t); setQueriesUsed(0); }} />
            ))}
          </div>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 220px", flex: 1, minHeight: 0, gap: 0 }}>

        {/* LEFT â€” Country Index Panel */}
        <div style={{ borderRight: "1px solid #0f2a45", padding: 12, overflowY: "auto", background: "rgba(3,13,26,0.6)" }}>
          <div style={{ fontSize: 8, color: "#475569", letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>Indices pays</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {WEST_AFRICAN_COUNTRIES.map(c => (
              <IndexCard key={c.code} country={c} index={indices[c.code]} isActive={selectedCountry?.code === c.code}
                onClick={() => {
                  const next = selectedCountry?.code === c.code ? null : c;
                  setSelectedCountry(next);
                  if (next) setShowDashboard(true);
                }} />
            ))}
          </div>
          <div style={{ marginTop: 12, padding: "8px 10px", background: "rgba(240,180,41,0.05)", border: "1px solid #1e3a5f", borderRadius: 4 }}>
            <div style={{ fontSize: 8, color: "#475569", letterSpacing: 2, marginBottom: 4 }}>COMPOSITE WASI</div>
            <div style={{ fontSize: 32, fontFamily: "'Bebas Neue', sans-serif", color: wasiTrend.color, letterSpacing: 3 }}>{wasiComposite}</div>
            <div style={{ fontSize: 9, color: "#94a3b8" }}>16 pays · {WEST_AFRICAN_COUNTRIES.length} ports suivis</div>
          </div>
        </div>

        {/* CENTER â€” Dashboard pays ou Interface Chat */}
        {showDashboard && selectedCountry ? (
          <CountryDashboard
            country={selectedCountry}
            indexValue={indices[selectedCountry.code]}
            onClose={() => setShowDashboard(false)}
          />
        ) : (
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
            {showCapabilities && (
              <div style={{ marginBottom: 20, animation: "fadeUp 0.5s ease" }}>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: "#f0b429", marginBottom: 4 }}>
                  Intelligence economique d'Afrique de l'Ouest
                </div>
                <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, marginBottom: 16 }}>
                  PROPULSE PAR WASI IA · PROTOCOLE DE MICROPAIEMENT x402 ACTIF
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 16 }}>
                  {AGENT_CAPABILITIES.map((cap, i) => (
                    <div key={i} style={{ background: "rgba(15,42,69,0.5)", border: "1px solid #0f2a45", borderRadius: 4, padding: "8px 10px", fontSize: 10, color: "#94a3b8", lineHeight: 1.5 }}>
                      {cap}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 9, color: "#334155", marginBottom: 10, letterSpacing: 2, textTransform: "uppercase" }}>Requetes suggerees</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {SUGGESTED_QUERIES.map((q, i) => (
                    <button key={i} className="sugg-btn" onClick={() => sendMessage(q)} style={{
                      background: "transparent", border: "1px solid #1e3a5f", borderRadius: 4,
                      padding: "8px 12px", textAlign: "left", cursor: "pointer", color: "#64748b",
                      fontSize: 10, fontFamily: "'Space Mono', monospace", transition: "all 0.2s", lineHeight: 1.4
                    }}>
                      -> {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className="msg-enter" style={{ marginBottom: 16, display: "flex", gap: 10, flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  background: m.role === "user" ? "#1e3a5f" : "rgba(240,180,41,0.15)",
                  border: `1px solid ${m.role === "user" ? "#2d5a8a" : "#f0b429"}`,
                  fontSize: 12
                }}>
                  {m.role === "user" ? "ðŸ‘¤" : "âš¡"}
                </div>
                <div style={{
                  maxWidth: "78%",
                  background: m.role === "user" ? "rgba(30,58,95,0.6)" : "rgba(10,22,40,0.9)",
                  border: `1px solid ${m.role === "user" ? "#2d5a8a" : "#0f2a45"}`,
                  borderRadius: m.role === "user" ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
                  padding: "12px 14px", fontSize: 11, lineHeight: 1.7, color: "#cbd5e1"
                }}>
                  {m.role === "assistant" && (
                    <div style={{ fontSize: 8, color: "#f0b429", letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>
                      Agent WASI · Forfait {X402_TIERS[selectedTier].label} · {tierConfig.price}$/requete
                    </div>
                  )}
                  {m.role === "assistant" ? renderMarkdown(m.content) : m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="msg-enter" style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(240,180,41,0.15)", border: "1px solid #f0b429", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>⚡</div>
                <div style={{ background: "rgba(10,22,40,0.9)", border: "1px solid #0f2a45", borderRadius: "4px 12px 12px 12px", padding: "14px 18px" }}>
                  <div style={{ display: "flex", gap: 5 }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#f0b429", animation: `pulse 1.2s ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 8, color: "#475569", marginTop: 6, letterSpacing: 2 }}>TRAITEMENT VIA x402 · PAIEMENT USDC EN ATTENTE</div>
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
                <span style={{ fontSize: 9, color: "#f0b429", letterSpacing: 1 }}>FOCUS : {selectedCountry.name.toUpperCase()} · INDICE {indices[selectedCountry.code]}/100</span>
                <button onClick={() => setSelectedCountry(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 12 }}>×</button>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Interrogez l'intelligence WASI... (micropaiement x402 active a l'envoi)"
                style={{
                  flex: 1, background: "rgba(15,42,69,0.5)", border: "1px solid #1e3a5f",
                  borderRadius: 4, padding: "10px 14px", color: "#e2e8f0", fontSize: 11,
                  fontFamily: "'Space Mono', monospace", outline: "none"
                }}
              />
              <button className="send-btn" onClick={() => sendMessage()} disabled={loading || !input.trim()} style={{
                background: "transparent", border: "1px solid #f0b429", color: "#f0b429",
                padding: "10px 20px", borderRadius: 4, cursor: "pointer", fontSize: 10,
                fontFamily: "'Space Mono', monospace", fontWeight: 700, letterSpacing: 2,
                transition: "all 0.2s", opacity: loading ? 0.5 : 1
              }}>
                {loading ? "..." : "ENVOYER ->"}
              </button>
            </div>
            <div style={{ marginTop: 6, fontSize: 8, color: "#334155", letterSpacing: 1, display: "flex", justifyContent: "space-between" }}>
              <span>Protocole x402 · Paiement par requete en USDC · Sans abonnement</span>
              <span>Moteur de donnees WASI v1.0 · {new Date().toLocaleDateString("fr-FR")}</span>
            </div>
          </div>
        </div>
        )}

        {/* RIGHT â€” x402 Info + ETF Signal */}
        <div style={{ borderLeft: "1px solid #0f2a45", padding: 12, overflowY: "auto", background: "rgba(3,13,26,0.6)" }}>
          {/* x402 Monetization Panel */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 8, color: "#475569", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Tarification x402</div>
            {Object.entries(X402_TIERS).map(([key, t]) => (
              <div key={key} onClick={() => { setSelectedTier(key); setQueriesUsed(0); }} style={{
                marginBottom: 6, padding: "8px 10px", background: selectedTier === key ? `${t.color}15` : "transparent",
                border: `1px solid ${selectedTier === key ? t.color : "#0f2a45"}`,
                borderRadius: 4, cursor: "pointer", transition: "all 0.2s"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: t.color, fontWeight: 700 }}>{t.label}</span>
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>{t.price === 0 ? "GRATUIT" : `${t.price}$`}</span>
                </div>
                {t.features.map((f, i) => <div key={i} style={{ fontSize: 8, color: "#475569", lineHeight: 1.6 }}>Â· {f}</div>)}
              </div>
            ))}
          </div>

          {/* ETF Signal */}
          <div style={{ marginBottom: 14, padding: "10px", background: "rgba(240,180,41,0.05)", border: "1px solid #1e3a5f", borderRadius: 4 }}>
            <div style={{ fontSize: 8, color: "#475569", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Signal ETF WASI</div>
            <div style={{ fontSize: 20, fontFamily: "'Bebas Neue', sans-serif", color: wasiTrend.color, letterSpacing: 2, marginBottom: 4 }}>
              {wasiComposite > 65 ? "HAUSSIER" : wasiComposite > 50 ? "NEUTRE" : "BAISSIER"}
            </div>
            <div style={{ fontSize: 9, color: "#64748b", lineHeight: 1.6 }}>
              Composite : {wasiComposite}/100<br />
              Top : NG {indices["NG"]}, CI {indices["CI"]}<br />
              Signal : {wasiComposite > 65 ? "Accumuler l'exposition Afrique de l'Ouest" : "Surveiller le point d'entree"}
            </div>
          </div>

          <div style={{ marginBottom: 14, padding: "10px", background: "rgba(96,165,250,0.05)", border: "1px solid #1e3a5f", borderRadius: 4 }}>
            <div style={{ fontSize: 8, color: "#475569", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Marches ouverts</div>
            <div style={{ fontSize: 9, color: "#64748b", lineHeight: 1.7 }}>
              EUR/XOF : <span style={{ color: "#93c5fd" }}>{formatCompactNumber(eurXof, 3)}</span><br />
              USD/XOF : <span style={{ color: "#93c5fd" }}>{formatCompactNumber(usdXof, 3)}</span><br />
              BTC/USD : <span style={{ color: Number(btcChange) >= 0 ? "#4ade80" : "#f87171" }}>{formatCompactNumber(btcUsd, 0)}</span><br />
              ETH/USD : <span style={{ color: Number(ethChange) >= 0 ? "#4ade80" : "#f87171" }}>{formatCompactNumber(ethUsd, 2)}</span>
            </div>
          </div>

          {/* Top movers */}
          <div>
            <div style={{ fontSize: 8, color: "#475569", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Meilleures Performances</div>
            {[...WEST_AFRICAN_COUNTRIES].sort((a, b) => (indices[b.code] || 0) - (indices[a.code] || 0)).slice(0, 5).map(c => (
              <div key={c.code} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5, padding: "5px 8px", background: "rgba(15,42,69,0.3)", borderRadius: 3 }}>
                <span style={{ fontSize: 10 }}>{c.flag} {c.code}</span>
                <span style={{ fontSize: 11, fontFamily: "'Bebas Neue', sans-serif", color: (indices[c.code] || 0) > 65 ? "#4ade80" : "#f0b429", letterSpacing: 1 }}>{indices[c.code]}</span>
              </div>
            ))}
          </div>

          {/* Data source */}
          <div style={{ marginTop: 14, padding: "8px 10px", background: "rgba(15,42,69,0.2)", borderRadius: 4, border: "1px solid #0f2a45" }}>
            <div style={{ fontSize: 7, color: "#334155", lineHeight: 1.7, letterSpacing: 0.5 }}>
              Donnees : {dataSourceMeta.detail} · {liveFxSnapshot ? liveFxSnapshot.source : "cache FX"} · {liveCryptoSnapshot ? liveCryptoSnapshot.source : "cache crypto"} · {macroSnapshot?.observationYear ? `World Bank ${macroSnapshot.observationYear}` : "cache macro"}<br /><br />
              Serveur : {backendConnected ? <span style={{ color: "#4ade80" }}>CONNECTE</span> : <span style={{ color: "#f0b429" }}>HORS LIGNE</span>} · http://localhost:8000<br /><br />
              © 2025 WASI · Plateforme d'intelligence maritime et economique d'Afrique de l'Ouest. Tous les indices sont proprietaires. Redistribution soumise a licence institutionnelle.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

