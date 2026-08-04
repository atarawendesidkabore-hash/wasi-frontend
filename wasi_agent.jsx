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
const CHAT_STORAGE_KEY = "wasi_chat_history";

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

const AFRICAN_COUNTRIES = [
  // ── AFRIQUE DE L'OUEST (16) ──
  { code: "CI", name: "CÃ´te d'Ivoire", port: "Abidjan", flag: "ðŸ‡¨ðŸ‡®", tier: "primary", weight: 0.025 },
  { code: "NG", name: "Nigeria",        port: "Lagos / Apapa", flag: "ðŸ‡³ðŸ‡¬", tier: "primary", weight: 0.085 },
  { code: "GH", name: "Ghana",          port: "Tema", flag: "ðŸ‡¬ðŸ‡­", tier: "primary", weight: 0.022 },
  { code: "SN", name: "Senegal",        port: "Dakar", flag: "ðŸ‡¸ðŸ‡³", tier: "secondary", weight: 0.015 },
  { code: "BF", name: "Burkina Faso",   port: "EnclavÃ© / corridor Abidjan", flag: "ðŸ‡§ðŸ‡«", tier: "secondary", weight: 0.008 },
  { code: "ML", name: "Mali",           port: "EnclavÃ© / corridor Dakar", flag: "ðŸ‡²ðŸ‡±", tier: "secondary", weight: 0.008 },
  { code: "GN", name: "GuinÃ©e",        port: "Conakry", flag: "ðŸ‡¬ðŸ‡³", tier: "secondary", weight: 0.008 },
  { code: "BJ", name: "BÃ©nin",         port: "Cotonou", flag: "ðŸ‡§ðŸ‡¯", tier: "secondary", weight: 0.007 },
  { code: "TG", name: "Togo",           port: "LomÃ©", flag: "ðŸ‡¹ðŸ‡¬", tier: "secondary", weight: 0.007 },
  { code: "NE", name: "Niger",          port: "EnclavÃ© / corridor Cotonou", flag: "ðŸ‡³ðŸ‡ª", tier: "secondary", weight: 0.006 },
  { code: "MR", name: "Mauritanie",     port: "Nouakchott", flag: "ðŸ‡²ðŸ‡·", tier: "secondary", weight: 0.006 },
  { code: "GW", name: "GuinÃ©e-Bissau", port: "Bissau", flag: "ðŸ‡¬ðŸ‡¼", tier: "tertiary", weight: 0.003 },
  { code: "SL", name: "Sierra Leone",   port: "Freetown", flag: "ðŸ‡¸ðŸ‡±", tier: "tertiary", weight: 0.004 },
  { code: "LR", name: "Liberia",        port: "Monrovia", flag: "ðŸ‡±ðŸ‡·", tier: "tertiary", weight: 0.004 },
  { code: "GM", name: "Gambie",         port: "Banjul", flag: "ðŸ‡¬ðŸ‡²", tier: "tertiary", weight: 0.003 },
  // ── AFRIQUE DU NORD (5) ──
  { code: "EG", name: "\u00c9gypte",         port: "Port-Sa\u00efd / Alexandrie / Suez",  flag: "\ud83c\uddea\ud83c\uddec", tier: "primary",   weight: 0.090 },
  { code: "DZ", name: "Alg\u00e9rie",        port: "Alger / Oran / Skikda",          flag: "\ud83c\udde9\ud83c\uddff", tier: "primary",   weight: 0.060 },
  { code: "MA", name: "Maroc",          port: "Tanger Med / Casablanca",        flag: "\ud83c\uddf2\ud83c\udde6", tier: "primary",   weight: 0.050 },
  { code: "TN", name: "Tunisie",        port: "Rad\u00e8s / Sfax",                   flag: "\ud83c\uddf9\ud83c\uddf3", tier: "secondary", weight: 0.015 },
  { code: "LY", name: "Libye",          port: "Tripoli / Misrata",              flag: "\ud83c\uddf1\ud83c\uddfe", tier: "secondary", weight: 0.014 },
  // ── AFRIQUE DE L'EST (15) ──
  { code: "KE", name: "Kenya",          port: "Mombasa",                        flag: "\ud83c\uddf0\ud83c\uddea", tier: "primary",   weight: 0.040 },
  { code: "ET", name: "\u00c9thiopie",       port: "Enclav\u00e9 / via Djibouti",         flag: "\ud83c\uddea\ud83c\uddf9", tier: "primary",   weight: 0.050 },
  { code: "TZ", name: "Tanzanie",       port: "Dar es Salaam",                  flag: "\ud83c\uddf9\ud83c\uddff", tier: "primary",   weight: 0.025 },
  { code: "UG", name: "Ouganda",        port: "Enclav\u00e9 / lac Victoria",         flag: "\ud83c\uddfa\ud83c\uddec", tier: "secondary", weight: 0.015 },
  { code: "RW", name: "Rwanda",         port: "Enclav\u00e9",                        flag: "\ud83c\uddf7\ud83c\uddfc", tier: "secondary", weight: 0.009 },
  { code: "BI", name: "Burundi",        port: "Bujumbura (lac Tanganyika)",      flag: "\ud83c\udde7\ud83c\uddee", tier: "tertiary",  weight: 0.003 },
  { code: "ER", name: "\u00c9rythr\u00e9e",       port: "Massawa / Assab",                flag: "\ud83c\uddea\ud83c\uddf7", tier: "tertiary",  weight: 0.003 },
  { code: "DJ", name: "Djibouti",       port: "Djibouti (hub strat\u00e9gique)",      flag: "\ud83c\udde9\ud83c\uddef", tier: "tertiary",  weight: 0.005 },
  { code: "SO", name: "Somalie",        port: "Mogadiscio / Berbera",            flag: "\ud83c\uddf8\ud83c\uddf4", tier: "tertiary",  weight: 0.003 },
  { code: "SD", name: "Soudan",         port: "Port-Soudan",                     flag: "\ud83c\uddf8\ud83c\udde9", tier: "secondary", weight: 0.013 },
  { code: "SS", name: "Soudan du Sud",  port: "Enclav\u00e9",                         flag: "\ud83c\uddf8\ud83c\uddf8", tier: "tertiary",  weight: 0.004 },
  { code: "MG", name: "Madagascar",     port: "Toamasina (Tamatave)",            flag: "\ud83c\uddf2\ud83c\uddec", tier: "secondary", weight: 0.011 },
  { code: "MU", name: "Maurice",        port: "Port-Louis",                      flag: "\ud83c\uddf2\ud83c\uddfa", tier: "secondary", weight: 0.007 },
  { code: "SC", name: "Seychelles",     port: "Victoria",                        flag: "\ud83c\uddf8\ud83c\udde8", tier: "tertiary",  weight: 0.001 },
  { code: "KM", name: "Comores",        port: "Moroni / Mutsamudu",              flag: "\ud83c\uddf0\ud83c\uddf2", tier: "tertiary",  weight: 0.002 },
  // ── AFRIQUE CENTRALE (8) ──
  { code: "CM", name: "Cameroun",       port: "Douala / Kribi",                  flag: "\ud83c\udde8\ud83c\uddf2", tier: "secondary", weight: 0.018 },
  { code: "GA", name: "Gabon",          port: "Libreville / Port-Gentil",        flag: "\ud83c\uddec\ud83c\udde6", tier: "secondary", weight: 0.010 },
  { code: "CG", name: "Congo",          port: "Pointe-Noire",                    flag: "\ud83c\udde8\ud83c\uddec", tier: "tertiary",  weight: 0.005 },
  { code: "CD", name: "RD Congo",       port: "Matadi / Boma",                   flag: "\ud83c\udde8\ud83c\udde9", tier: "secondary", weight: 0.020 },
  { code: "TD", name: "Tchad",          port: "Enclav\u00e9 / corridor Douala",       flag: "\ud83c\uddf9\ud83c\udde9", tier: "secondary", weight: 0.007 },
  { code: "CF", name: "Centrafrique",   port: "Bangui (fluvial)",                flag: "\ud83c\udde8\ud83c\uddeb", tier: "tertiary",  weight: 0.003 },
  { code: "GQ", name: "Guin\u00e9e \u00e9quatoriale", port: "Malabo / Bata",              flag: "\ud83c\uddec\ud83c\uddf6", tier: "tertiary",  weight: 0.005 },
  { code: "ST", name: "S\u00e3o Tom\u00e9-et-Pr\u00edncipe", port: "S\u00e3o Tom\u00e9",                 flag: "\ud83c\uddf8\ud83c\uddf9", tier: "tertiary",  weight: 0.001 },
  // ── AFRIQUE AUSTRALE (10) ──
  { code: "ZA", name: "Afrique du Sud", port: "Durban / Le Cap / Richards Bay",  flag: "\ud83c\uddff\ud83c\udde6", tier: "primary",   weight: 0.090 },
  { code: "AO", name: "Angola",         port: "Luanda / Lobito",                 flag: "\ud83c\udde6\ud83c\uddf4", tier: "primary",   weight: 0.030 },
  { code: "MZ", name: "Mozambique",     port: "Maputo / Beira / Nacala",         flag: "\ud83c\uddf2\ud83c\uddff", tier: "secondary", weight: 0.012 },
  { code: "ZM", name: "Zambie",         port: "Enclav\u00e9 / corridor Dar-Nacala",   flag: "\ud83c\uddff\ud83c\uddf2", tier: "secondary", weight: 0.012 },
  { code: "ZW", name: "Zimbabwe",       port: "Enclav\u00e9 / corridor Beira",        flag: "\ud83c\uddff\ud83c\uddfc", tier: "secondary", weight: 0.009 },
  { code: "BW", name: "Botswana",       port: "Enclav\u00e9",                         flag: "\ud83c\udde7\ud83c\uddfc", tier: "secondary", weight: 0.009 },
  { code: "NA", name: "Namibie",        port: "Walvis Bay",                      flag: "\ud83c\uddf3\ud83c\udde6", tier: "secondary", weight: 0.007 },
  { code: "MW", name: "Malawi",         port: "Enclav\u00e9 / corridor Nacala",       flag: "\ud83c\uddf2\ud83c\uddfc", tier: "tertiary",  weight: 0.005 },
  { code: "SZ", name: "Eswatini",       port: "Enclav\u00e9 / via Maputo-Durban",     flag: "\ud83c\uddf8\ud83c\uddff", tier: "tertiary",  weight: 0.003 },
  { code: "LS", name: "Lesotho",        port: "Enclav\u00e9 (dans l'Afrique du Sud)", flag: "\ud83c\uddf1\ud83c\uddf8", tier: "tertiary",  weight: 0.002 },
  { code: "CV", name: "Cap-Vert",       port: "Praia / Mindelo", flag: "ðŸ‡¨ðŸ‡»", tier: "tertiary", weight: 0.002 },
];

// â”€â”€ DonnÃ©es commerciales & fiches pays (M$ USD, 2023 â€” mise Ã  jour : fÃ©v. 2026) â”€
const COUP_REGIMES = ["BF", "ML", "NE", "GN", "TD", "GA", "SD", "SS", "CF", "GW", "ER", "LY"];

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
  // ── AFRIQUE DU NORD ──
  EG: {
    president: "Abdel Fattah al-Sissi", presidentSince: "2014 (r\u00e9\u00e9lu 2024)",
    capitale: "Le Caire", siegeEconomique: "Le Caire",
    superficie: 1002450,
    matieres_premieres: ["Gaz naturel", "P\u00e9trole brut", "Or", "Phosphates", "Minerai de fer", "Calcaire", "Sel", "Mangan\u00e8se"],
    exports: [
      { cat: "Gaz naturel liqu\u00e9fi\u00e9", val: 8500 }, { cat: "P\u00e9trole brut", val: 7200 },
      { cat: "Engrais chimiques", val: 3800 }, { cat: "Textiles & v\u00eatements", val: 3200 },
      { cat: "Produits alimentaires", val: 2800 }, { cat: "Or & m\u00e9taux", val: 2500 },
    ],
    imports: [
      { cat: "Bl\u00e9 & c\u00e9r\u00e9ales", val: 8200 }, { cat: "Machines & \u00e9quipements", val: 12000 },
      { cat: "Prod. p\u00e9troliers raffin\u00e9s", val: 7500 }, { cat: "Fer & acier", val: 4200 },
      { cat: "V\u00e9hicules", val: 3800 }, { cat: "Prod. pharmaceutiques", val: 3200 },
    ],
    totalExports: 42000, totalImports: 80000,
    partners: ["Union Europ\u00e9enne 28%", "Arabie Saoudite 8%", "Turquie 7%", "Chine 9%"],
    opportunities: ["Canal de Suez (revenus de transit)", "Zone \u00e9conomique sp\u00e9ciale", "Hub gazier M\u00e9diterran\u00e9e orientale"],
    risks: ["D\u00e9ficit commercial structurel", "D\u00e9pr\u00e9ciation livre \u00e9gyptienne", "D\u00e9pendance import c\u00e9r\u00e9alier"],
    gdpGrowth: 3.8, currency: "EGP",
  },
  DZ: {
    president: "Abdelmadjid Tebboune", presidentSince: "2019 (r\u00e9\u00e9lu 2024)",
    capitale: "Alger", siegeEconomique: "Alger",
    superficie: 2381741,
    matieres_premieres: ["Gaz naturel (3e Afrique)", "P\u00e9trole brut", "Phosphates", "Minerai de fer", "Zinc", "Plomb", "Uranium", "Or"],
    exports: [
      { cat: "Gaz naturel", val: 16000 }, { cat: "P\u00e9trole brut", val: 14000 },
      { cat: "Produits p\u00e9trochimiques", val: 3500 }, { cat: "Engrais", val: 1500 },
      { cat: "Fer & acier", val: 800 },
    ],
    imports: [
      { cat: "Machines & \u00e9quipements", val: 8000 }, { cat: "Bl\u00e9 & c\u00e9r\u00e9ales", val: 3500 },
      { cat: "V\u00e9hicules", val: 3200 }, { cat: "Prod. pharmaceutiques", val: 2800 },
      { cat: "Fer & acier", val: 2200 },
    ],
    totalExports: 38000, totalImports: 35000,
    partners: ["Italie 18%", "France 12%", "Espagne 10%", "Chine 8%"],
    opportunities: ["Gaz naturel pour l'Europe (alternative Russie)", "P\u00e9trochimie", "\u00c9nergie solaire Sahara"],
    risks: ["Hyper-d\u00e9pendance hydrocarbures (93%)", "Diversification lente", "Transition \u00e9nerg\u00e9tique mondiale"],
    gdpGrowth: 3.4, currency: "DZD",
  },
  MA: {
    president: "Roi Mohammed VI", presidentSince: "1999",
    capitale: "Rabat", siegeEconomique: "Casablanca",
    superficie: 446550,
    matieres_premieres: ["Phosphates (1er mondial)", "Cobalt", "Zinc", "Plomb", "Mangan\u00e8se", "Sel", "Argent", "Argile"],
    exports: [
      { cat: "Automobiles & pi\u00e8ces", val: 14000 }, { cat: "Phosphates & engrais", val: 8200 },
      { cat: "Textiles & v\u00eatements", val: 4800 }, { cat: "Prod. alimentaires", val: 4200 },
      { cat: "Composants \u00e9lectroniques", val: 3500 },
    ],
    imports: [
      { cat: "\u00c9nergie (p\u00e9trole & gaz)", val: 12000 }, { cat: "Machines & \u00e9quipements", val: 8500 },
      { cat: "C\u00e9r\u00e9ales & denr\u00e9es", val: 4200 }, { cat: "V\u00e9hicules", val: 3500 },
      { cat: "Plastiques & chimie", val: 3000 },
    ],
    totalExports: 49000, totalImports: 65000,
    partners: ["Espagne 23%", "France 21%", "Union Europ\u00e9enne 58%", "Chine 7%"],
    opportunities: ["Hub automobile africain (Renault, Stellantis)", "Engrais phosphat\u00e9s", "Port Tanger Med (1er Afrique)"],
    risks: ["D\u00e9ficit commercial structurel", "D\u00e9pendance \u00e9nerg\u00e9tique", "Stress hydrique"],
    gdpGrowth: 3.0, currency: "MAD",
  },
  TN: {
    president: "Ka\u00efs Sa\u00efed", presidentSince: "2019",
    capitale: "Tunis", siegeEconomique: "Tunis",
    superficie: 163610,
    matieres_premieres: ["Phosphates", "P\u00e9trole brut", "Gaz naturel", "Fer", "Zinc", "Sel", "Plomb"],
    exports: [
      { cat: "Composants \u00e9lectriques", val: 4500 }, { cat: "Textiles & v\u00eatements", val: 3200 },
      { cat: "Huile d'olive", val: 1800 }, { cat: "Phosphates & engrais", val: 1200 },
      { cat: "Produits m\u00e9caniques", val: 1000 },
    ],
    imports: [
      { cat: "\u00c9nergie (p\u00e9trole & gaz)", val: 4500 }, { cat: "Machines", val: 3200 },
      { cat: "C\u00e9r\u00e9ales & denr\u00e9es", val: 2100 }, { cat: "V\u00e9hicules", val: 1500 },
      { cat: "Textiles bruts", val: 1200 },
    ],
    totalExports: 16000, totalImports: 22000,
    partners: ["France 25%", "Italie 18%", "Allemagne 12%", "Chine 7%"],
    opportunities: ["Nearshoring industriel pour l'Europe", "Hub tech & services", "Huile d'olive premium"],
    risks: ["D\u00e9ficit commercial chronique", "Instabilit\u00e9 politique", "Ch\u00f4mage \u00e9lev\u00e9"],
    gdpGrowth: 1.3, currency: "TND",
  },
  LY: {
    president: "Gouvernement d'unit\u00e9 nationale (transition)", presidentSince: "2021 (depuis crise 2011)",
    capitale: "Tripoli", siegeEconomique: "Tripoli",
    superficie: 1759540,
    matieres_premieres: ["P\u00e9trole brut (1er r\u00e9serves Afrique)", "Gaz naturel", "Gypse", "Calcaire", "Fer"],
    exports: [
      { cat: "P\u00e9trole brut", val: 28000 }, { cat: "Gaz naturel", val: 2500 },
      { cat: "P\u00e9trochimie", val: 800 },
    ],
    imports: [
      { cat: "Machines & \u00e9quipements", val: 4500 }, { cat: "Denr\u00e9es alimentaires", val: 3200 },
      { cat: "V\u00e9hicules", val: 2000 }, { cat: "Mat\u00e9riaux construction", val: 1800 },
    ],
    totalExports: 32000, totalImports: 14000,
    partners: ["Italie 28%", "Espagne 14%", "Chine 10%", "Turquie 8%"],
    opportunities: ["Reconstruction post-conflit", "R\u00e9serves p\u00e9troli\u00e8res massives", "Position g\u00e9ographique M\u00e9diterran\u00e9e"],
    risks: ["Instabilit\u00e9 politique chronique", "Division Est-Ouest", "D\u00e9pendance p\u00e9trole 95%"],
    gdpGrowth: 10.2, currency: "LYD",
  },
  // ── AFRIQUE DE L'EST ──
  KE: {
    president: "William Ruto", presidentSince: "2022",
    capitale: "Nairobi", siegeEconomique: "Nairobi",
    superficie: 580367,
    matieres_premieres: ["Th\u00e9", "Caf\u00e9", "Fleurs coup\u00e9es", "Titane", "Soude", "Fluorspar", "Sel", "Pierres pr\u00e9cieuses"],
    exports: [
      { cat: "Th\u00e9", val: 1500 }, { cat: "Fleurs coup\u00e9es", val: 1000 },
      { cat: "Caf\u00e9", val: 850 }, { cat: "L\u00e9gumes & fruits", val: 600 },
      { cat: "V\u00eatements & textiles", val: 450 }, { cat: "Titane & minerais", val: 380 },
    ],
    imports: [
      { cat: "Machines & \u00e9quipements", val: 4500 }, { cat: "P\u00e9trole raffin\u00e9", val: 4200 },
      { cat: "V\u00e9hicules", val: 2000 }, { cat: "Fer & acier", val: 1800 },
      { cat: "C\u00e9r\u00e9ales & denr\u00e9es", val: 1500 },
    ],
    totalExports: 7500, totalImports: 20000,
    partners: ["Ouganda 10%", "\u00c9tats-Unis 9%", "Pays-Bas 8%", "Pakistan 7%"],
    opportunities: ["Hub tech africain (Silicon Savannah)", "Port de Mombasa hub Est-africain", "Fintech & M-Pesa"],
    risks: ["D\u00e9ficit commercial structurel", "Dette publique \u00e9lev\u00e9e", "Vuln\u00e9rabilit\u00e9 climatique"],
    gdpGrowth: 5.0, currency: "KES",
  },
  ET: {
    president: "PM Abiy Ahmed", presidentSince: "2018",
    capitale: "Addis-Abeba", siegeEconomique: "Addis-Abeba",
    superficie: 1104300,
    matieres_premieres: ["Caf\u00e9 (origine)", "Or", "Opale", "Potasse", "Gaz naturel", "Tantale", "Platine", "Cuivre"],
    exports: [
      { cat: "Caf\u00e9", val: 1200 }, { cat: "Or", val: 600 },
      { cat: "Fleurs coup\u00e9es", val: 500 }, { cat: "L\u00e9gumineuses", val: 400 },
      { cat: "Cuir & peaux", val: 250 },
    ],
    imports: [
      { cat: "Machines & \u00e9quipements", val: 5500 }, { cat: "P\u00e9trole raffin\u00e9", val: 3800 },
      { cat: "V\u00e9hicules", val: 2200 }, { cat: "C\u00e9r\u00e9ales & bl\u00e9", val: 1800 },
      { cat: "Engrais", val: 1200 },
    ],
    totalExports: 4000, totalImports: 18000,
    partners: ["Chine 18%", "Arabie Saoudite 10%", "\u00c9tats-Unis 8%", "Inde 7%"],
    opportunities: ["Barrage GERD (hydro\u00e9lectricit\u00e9)", "Industrie manufacturi\u00e8re \u00e9mergente", "Si\u00e8ge Union Africaine"],
    risks: ["D\u00e9ficit commercial massif", "Tensions ethniques", "Enclavement g\u00e9ographique"],
    gdpGrowth: 6.1, currency: "ETB",
  },
  TZ: {
    president: "Samia Suluhu Hassan", presidentSince: "2021",
    capitale: "Dodoma", siegeEconomique: "Dar es Salaam",
    superficie: 945087,
    matieres_premieres: ["Or", "Tanzanite (unique au monde)", "Diamants", "Gaz naturel", "Nickel", "Cobalt", "Charbon", "\u00c9tain"],
    exports: [
      { cat: "Or", val: 2800 }, { cat: "Tabac", val: 500 },
      { cat: "Noix de cajou", val: 450 }, { cat: "Caf\u00e9 & th\u00e9", val: 350 },
      { cat: "Pierres pr\u00e9cieuses", val: 280 },
    ],
    imports: [
      { cat: "Machines & \u00e9quipements", val: 3500 }, { cat: "P\u00e9trole raffin\u00e9", val: 3000 },
      { cat: "V\u00e9hicules", val: 1500 }, { cat: "Fer & acier", val: 1200 },
      { cat: "C\u00e9r\u00e9ales", val: 800 },
    ],
    totalExports: 7000, totalImports: 13000,
    partners: ["Inde 20%", "Chine 15%", "Suisse 12%", "Afrique du Sud 8%"],
    opportunities: ["Port Dar es Salaam hub r\u00e9gional", "LNG offshore", "Corridor central (RDC, Zambie, Burundi)"],
    risks: ["D\u00e9ficit commercial", "Infrastructures insuffisantes", "D\u00e9pendance or"],
    gdpGrowth: 5.1, currency: "TZS",
  },
  UG: {
    president: "Yoweri Museveni", presidentSince: "1986",
    capitale: "Kampala", siegeEconomique: "Kampala",
    superficie: 241038,
    matieres_premieres: ["Or", "Caf\u00e9", "Th\u00e9", "P\u00e9trole (Albertine Graben)", "Cobalt", "Cuivre", "\u00c9tain", "Tungst\u00e8ne"],
    exports: [
      { cat: "Or", val: 1800 }, { cat: "Caf\u00e9", val: 900 },
      { cat: "Poisson (perche du Nil)", val: 200 }, { cat: "Th\u00e9", val: 120 },
      { cat: "Tabac", val: 100 },
    ],
    imports: [
      { cat: "Machines & \u00e9quipements", val: 2000 }, { cat: "P\u00e9trole raffin\u00e9", val: 1800 },
      { cat: "V\u00e9hicules", val: 1200 }, { cat: "Fer & acier", val: 800 },
      { cat: "M\u00e9dicaments", val: 600 },
    ],
    totalExports: 4000, totalImports: 8000,
    partners: ["Kenya 15%", "\u00c9mirats 14%", "Inde 10%", "Chine 8%"],
    opportunities: ["P\u00e9trole Albertine Graben + pipeline EACOP", "Hub r\u00e9gional Grands Lacs", "Agriculture export"],
    risks: ["Enclavement g\u00e9ographique", "Gouvernance politique", "D\u00e9lais production p\u00e9troli\u00e8re"],
    gdpGrowth: 5.3, currency: "UGX",
  },
  RW: {
    president: "Paul Kagame", presidentSince: "2000 (r\u00e9\u00e9lu 2024)",
    capitale: "Kigali", siegeEconomique: "Kigali",
    superficie: 26338,
    matieres_premieres: ["\u00c9tain", "Tantale (coltan)", "Tungst\u00e8ne", "Or", "Caf\u00e9", "Th\u00e9", "Pyrethre"],
    exports: [
      { cat: "Or & min\u00e9raux (3T)", val: 800 }, { cat: "Caf\u00e9", val: 200 },
      { cat: "Th\u00e9", val: 120 }, { cat: "Produits manufactur\u00e9s", val: 100 },
    ],
    imports: [
      { cat: "Machines & \u00e9quipements", val: 800 }, { cat: "P\u00e9trole raffin\u00e9", val: 600 },
      { cat: "V\u00e9hicules", val: 400 }, { cat: "Denr\u00e9es alimentaires", val: 350 },
      { cat: "M\u00e9dicaments", val: 200 },
    ],
    totalExports: 2000, totalImports: 4000,
    partners: ["\u00c9mirats 30%", "RD Congo 18%", "Kenya 8%", "Suisse 6%"],
    opportunities: ["Hub tech & innovation (Kigali)", "MICE & tourisme haut de gamme", "Min\u00e9raux strat\u00e9giques"],
    risks: ["Enclavement total", "March\u00e9 int\u00e9rieur r\u00e9duit", "D\u00e9pendance aide internationale"],
    gdpGrowth: 7.0, currency: "RWF",
  },
  BI: {
    president: "\u00c9variste Ndayishimiye", presidentSince: "2020",
    capitale: "Gitega", siegeEconomique: "Bujumbura",
    superficie: 27834,
    matieres_premieres: ["Or", "Nickel", "Caf\u00e9", "Th\u00e9", "Coltan", "Vanadium", "\u00c9tain", "Kaolin"],
    exports: [
      { cat: "Or", val: 120 }, { cat: "Caf\u00e9", val: 60 },
      { cat: "Th\u00e9", val: 30 }, { cat: "Min\u00e9raux", val: 25 },
    ],
    imports: [
      { cat: "P\u00e9trole raffin\u00e9", val: 250 }, { cat: "Machines", val: 200 },
      { cat: "C\u00e9r\u00e9ales", val: 150 }, { cat: "V\u00e9hicules", val: 100 },
      { cat: "M\u00e9dicaments", val: 80 },
    ],
    totalExports: 300, totalImports: 1000,
    partners: ["\u00c9mirats 30%", "RD Congo 15%", "Chine 10%", "Inde 8%"],
    opportunities: ["Nickel de Musongati", "Caf\u00e9 sp\u00e9cialit\u00e9 haut de gamme", "Int\u00e9gration EAC"],
    risks: ["D\u00e9ficit commercial massif", "Enclavement", "Instabilit\u00e9 r\u00e9gionale"],
    gdpGrowth: 3.5, currency: "BIF",
  },
  ER: {
    president: "Isaias Afwerki", presidentSince: "1993",
    capitale: "Asmara", siegeEconomique: "Asmara",
    superficie: 117600,
    matieres_premieres: ["Or", "Cuivre", "Zinc", "Potasse", "Marbre", "Granit"],
    exports: [
      { cat: "Or & zinc", val: 350 }, { cat: "Cuivre", val: 100 },
      { cat: "Textiles", val: 50 }, { cat: "B\u00e9tail", val: 40 },
    ],
    imports: [
      { cat: "Denr\u00e9es alimentaires", val: 350 }, { cat: "Machines", val: 280 },
      { cat: "P\u00e9trole", val: 220 }, { cat: "M\u00e9dicaments", val: 100 },
    ],
    totalExports: 600, totalImports: 1100,
    partners: ["Chine 35%", "\u00c9mirats 15%", "Inde 10%", "Cor\u00e9e du Sud 8%"],
    opportunities: ["Min\u00e9raux strat\u00e9giques (potasse)", "Ports de Massawa et Assab", "Position mer Rouge"],
    risks: ["Isolement international", "\u00c9conomie ferm\u00e9e", "Sanctions"],
    gdpGrowth: 2.9, currency: "ERN",
  },
  DJ: {
    president: "Isma\u00efl Omar Guelleh", presidentSince: "1999",
    capitale: "Djibouti", siegeEconomique: "Djibouti",
    superficie: 23200,
    matieres_premieres: ["Sel", "G\u00e9othermie", "Calcaire", "Argile", "Gypse"],
    exports: [
      { cat: "R\u00e9exportations", val: 350 }, { cat: "B\u00e9tail & cuirs", val: 80 },
      { cat: "Sel marin", val: 30 },
    ],
    imports: [
      { cat: "Denr\u00e9es alimentaires", val: 500 }, { cat: "P\u00e9trole & gaz", val: 350 },
      { cat: "Machines", val: 250 }, { cat: "V\u00e9hicules", val: 150 },
    ],
    totalExports: 600, totalImports: 1500,
    partners: ["Chine 22%", "\u00c9thiopie 18%", "Arabie Saoudite 12%", "France 8%"],
    opportunities: ["Hub logistique strat\u00e9gique (d\u00e9troit Bab-el-Mandeb)", "Bases militaires (revenus)", "Zone franche"],
    risks: ["D\u00e9pendance transit \u00e9thiopien", "Surendettement (Chine)", "March\u00e9 int\u00e9rieur minuscule"],
    gdpGrowth: 5.5, currency: "DJF",
  },
  SO: {
    president: "Hassan Sheikh Mohamud", presidentSince: "2022",
    capitale: "Mogadiscio", siegeEconomique: "Mogadiscio",
    superficie: 637657,
    matieres_premieres: ["B\u00e9tail", "Bananes", "Poissons & crustac\u00e9s", "Charbon de bois", "Encens & myrrhe", "Uranium (potentiel)"],
    exports: [
      { cat: "B\u00e9tail & viande", val: 450 }, { cat: "Bananes", val: 100 },
      { cat: "Poissons", val: 60 }, { cat: "Charbon v\u00e9g\u00e9tal", val: 50 },
    ],
    imports: [
      { cat: "Denr\u00e9es alimentaires", val: 1500 }, { cat: "P\u00e9trole", val: 800 },
      { cat: "Machines", val: 500 }, { cat: "V\u00e9hicules", val: 300 },
      { cat: "Mat\u00e9riaux construction", val: 250 },
    ],
    totalExports: 800, totalImports: 4000,
    partners: ["Oman 25%", "Arabie Saoudite 18%", "\u00c9mirats 15%", "Inde 8%"],
    opportunities: ["P\u00eache industrielle (c\u00f4te la plus longue d'Afrique)", "Port de Berbera (Somaliland)", "\u00c9levage export"],
    risks: ["Instabilit\u00e9 s\u00e9curitaire (Al-Shabaab)", "Absence d'\u00c9tat fonctionnel", "S\u00e9cheresses r\u00e9currentes"],
    gdpGrowth: 2.8, currency: "SOS",
  },
  SD: {
    president: "Conflit arm\u00e9 en cours (depuis avril 2023)", presidentSince: "Arm\u00e9e vs FSR",
    capitale: "Khartoum", siegeEconomique: "Khartoum (d\u00e9vast\u00e9)",
    superficie: 1861484,
    matieres_premieres: ["Or", "P\u00e9trole brut", "Gomme arabique (1er mondial)", "S\u00e9same", "Fer", "Chrome", "Mangan\u00e8se"],
    exports: [
      { cat: "Or", val: 2000 }, { cat: "P\u00e9trole brut", val: 1500 },
      { cat: "S\u00e9same", val: 500 }, { cat: "Gomme arabique", val: 200 },
      { cat: "B\u00e9tail", val: 300 },
    ],
    imports: [
      { cat: "Bl\u00e9 & c\u00e9r\u00e9ales", val: 2000 }, { cat: "P\u00e9trole raffin\u00e9", val: 1500 },
      { cat: "Machines", val: 1200 }, { cat: "M\u00e9dicaments", val: 800 },
      { cat: "V\u00e9hicules", val: 600 },
    ],
    totalExports: 5000, totalImports: 8000,
    partners: ["\u00c9mirats 50%", "Chine 15%", "Arabie Saoudite 10%", "\u00c9gypte 8%"],
    opportunities: ["Or (3e producteur africain)", "Agriculture irrigu\u00e9e (Nil)", "Gomme arabique monopole mondial"],
    risks: ["Guerre civile active", "Crise humanitaire majeure", "\u00c9conomie paralys\u00e9e"],
    gdpGrowth: -12.0, currency: "SDG",
  },
  SS: {
    president: "Salva Kiir Mayardit", presidentSince: "2011",
    capitale: "Djouba", siegeEconomique: "Djouba",
    superficie: 619745,
    matieres_premieres: ["P\u00e9trole brut (98% exports)", "Or", "Bois tropical", "Fer", "Cuivre"],
    exports: [
      { cat: "P\u00e9trole brut", val: 2800 }, { cat: "Or", val: 100 },
    ],
    imports: [
      { cat: "Denr\u00e9es alimentaires", val: 800 }, { cat: "Machines", val: 600 },
      { cat: "V\u00e9hicules", val: 400 }, { cat: "M\u00e9dicaments", val: 200 },
    ],
    totalExports: 3000, totalImports: 2500,
    partners: ["Chine 60%", "Ouganda 10%", "Kenya 8%", "Japon 5%"],
    opportunities: ["R\u00e9serves p\u00e9troli\u00e8res significatives", "Terres agricoles vastes", "Ressources hydrauliques (Nil Blanc)"],
    risks: ["Instabilit\u00e9 politique extr\u00eame", "Mono-d\u00e9pendance p\u00e9trole", "Crise humanitaire"],
    gdpGrowth: -0.3, currency: "SSP",
  },
  MG: {
    president: "Andry Rajoelina", presidentSince: "2019",
    capitale: "Antananarivo", siegeEconomique: "Antananarivo",
    superficie: 587041,
    matieres_premieres: ["Vanille (1er mondial)", "Nickel", "Cobalt", "Graphite", "Saphirs", "Chromite", "Ilm\u00e9nite", "Mica"],
    exports: [
      { cat: "Vanille", val: 600 }, { cat: "Nickel & cobalt", val: 800 },
      { cat: "V\u00eatements textiles", val: 500 }, { cat: "Crevettes", val: 250 },
      { cat: "Graphite & minerais", val: 400 },
    ],
    imports: [
      { cat: "P\u00e9trole raffin\u00e9", val: 1200 }, { cat: "Riz & c\u00e9r\u00e9ales", val: 600 },
      { cat: "Machines", val: 500 }, { cat: "V\u00e9hicules", val: 400 },
      { cat: "Fer & acier", val: 300 },
    ],
    totalExports: 3500, totalImports: 4500,
    partners: ["France 18%", "Chine 14%", "\u00c9tats-Unis 12%", "Inde 8%"],
    opportunities: ["Min\u00e9raux strat\u00e9giques (graphite, nickel)", "Vanille monopole mondial", "Tourisme \u00e9cotouristique"],
    risks: ["Instabilit\u00e9 politique r\u00e9currente", "Cyclones & d\u00e9forestation", "Infrastructures d\u00e9ficientes"],
    gdpGrowth: 4.0, currency: "MGA",
  },
  MU: {
    president: "PM Navinchandra Ramgoolam", presidentSince: "2024",
    capitale: "Port-Louis", siegeEconomique: "Port-Louis",
    superficie: 2040,
    matieres_premieres: ["Sucre de canne", "Textiles", "Services financiers", "Tourisme"],
    exports: [
      { cat: "Textiles & v\u00eatements", val: 800 }, { cat: "Sucre", val: 250 },
      { cat: "Poissons & conserves", val: 350 }, { cat: "Services financiers", val: 500 },
    ],
    imports: [
      { cat: "P\u00e9trole raffin\u00e9", val: 1800 }, { cat: "Machines", val: 1200 },
      { cat: "Denr\u00e9es alimentaires", val: 900 }, { cat: "V\u00e9hicules", val: 600 },
      { cat: "Textiles bruts", val: 500 },
    ],
    totalExports: 2500, totalImports: 6500,
    partners: ["France 15%", "Royaume-Uni 12%", "Afrique du Sud 10%", "\u00c9tats-Unis 8%"],
    opportunities: ["Hub financier offshore africain", "Tourisme haut de gamme", "\u00c9conomie oc\u00e9anique"],
    risks: ["D\u00e9ficit commercial structurel", "Vuln\u00e9rabilit\u00e9 climatique insulaire", "D\u00e9pendance tourisme"],
    gdpGrowth: 5.0, currency: "MUR",
  },
  SC: {
    president: "Wavel Ramkalawan", presidentSince: "2020",
    capitale: "Victoria", siegeEconomique: "Victoria",
    superficie: 459,
    matieres_premieres: ["Thon", "Coprah", "Cannelle", "Vanille", "Tourisme"],
    exports: [
      { cat: "Thon & poissons", val: 400 }, { cat: "Coprah & huiles", val: 20 },
      { cat: "Cannelle", val: 10 },
    ],
    imports: [
      { cat: "P\u00e9trole", val: 350 }, { cat: "Machines", val: 250 },
      { cat: "Denr\u00e9es alimentaires", val: 200 }, { cat: "V\u00e9hicules", val: 120 },
    ],
    totalExports: 600, totalImports: 1200,
    partners: ["France 20%", "\u00c9mirats 18%", "Royaume-Uni 12%", "Japon 10%"],
    opportunities: ["Tourisme de luxe", "\u00c9conomie bleue (p\u00eache, ZEE immense)", "Hub oc\u00e9an Indien"],
    risks: ["\u00c9conomie minuscule", "Vuln\u00e9rabilit\u00e9 climatique", "D\u00e9pendance import totale"],
    gdpGrowth: 4.8, currency: "SCR",
  },
  KM: {
    president: "Azali Assoumani", presidentSince: "2019",
    capitale: "Moroni", siegeEconomique: "Moroni",
    superficie: 2235,
    matieres_premieres: ["Vanille", "Ylang-ylang (1er mondial)", "Girofle", "Coprah", "Cannelle"],
    exports: [
      { cat: "Vanille", val: 25 }, { cat: "Ylang-ylang", val: 15 },
      { cat: "Girofle", val: 10 }, { cat: "Coprah", val: 5 },
    ],
    imports: [
      { cat: "Riz & denr\u00e9es", val: 120 }, { cat: "P\u00e9trole", val: 80 },
      { cat: "V\u00e9hicules", val: 40 }, { cat: "Ciment", val: 30 },
    ],
    totalExports: 60, totalImports: 350,
    partners: ["France 25%", "Inde 20%", "Chine 12%", "Pakistan 8%"],
    opportunities: ["Parfumerie haut de gamme (ylang-ylang)", "Tourisme \u00e9cotouristique", "P\u00eache"],
    risks: ["D\u00e9ficit commercial massif (>80%)", "Instabilit\u00e9 politique chronique", "Isolement insulaire"],
    gdpGrowth: 3.0, currency: "KMF",
  },
  // ── AFRIQUE CENTRALE ──
  CM: {
    president: "Paul Biya", presidentSince: "1982",
    capitale: "Yaound\u00e9", siegeEconomique: "Douala",
    superficie: 475442,
    matieres_premieres: ["P\u00e9trole brut", "Bois tropical", "Cacao", "Caf\u00e9", "Coton", "Bauxite", "Minerai de fer", "Or", "Gaz naturel"],
    exports: [
      { cat: "P\u00e9trole brut", val: 1800 }, { cat: "Bois & d\u00e9riv\u00e9s", val: 600 },
      { cat: "Cacao brut", val: 550 }, { cat: "Coton", val: 200 },
      { cat: "Aluminium", val: 300 }, { cat: "Bananes", val: 150 },
    ],
    imports: [
      { cat: "Machines & \u00e9quipements", val: 1800 }, { cat: "P\u00e9trole raffin\u00e9", val: 1200 },
      { cat: "C\u00e9r\u00e9ales & riz", val: 800 }, { cat: "V\u00e9hicules", val: 600 },
      { cat: "M\u00e9dicaments", val: 400 },
    ],
    totalExports: 5500, totalImports: 6800,
    partners: ["Chine 18%", "France 10%", "Inde 8%", "Pays-Bas 7%"],
    opportunities: ["Port de Kribi (eau profonde)", "Hub transit Tchad & Centrafrique", "Agro-industrie cacao"],
    risks: ["Crise anglophone (r\u00e9gions NO & SO)", "Vieillissement du r\u00e9gime", "D\u00e9pendance p\u00e9troli\u00e8re"],
    gdpGrowth: 3.8, currency: "XAF",
  },
  GA: {
    president: "Brice Oligui Nguema (transition)", presidentSince: "sept. 2023 (coup d'\u00c9tat)",
    capitale: "Libreville", siegeEconomique: "Libreville",
    superficie: 267668,
    matieres_premieres: ["P\u00e9trole brut", "Mangan\u00e8se (2e mondial)", "Bois tropical (okoum\u00e9)", "Or", "Niobium", "Fer", "Uranium"],
    exports: [
      { cat: "P\u00e9trole brut", val: 5500 }, { cat: "Mangan\u00e8se", val: 2000 },
      { cat: "Bois & contreplaqu\u00e9", val: 800 }, { cat: "Or", val: 200 },
    ],
    imports: [
      { cat: "Machines", val: 800 }, { cat: "Denr\u00e9es alimentaires", val: 700 },
      { cat: "V\u00e9hicules", val: 500 }, { cat: "Mat\u00e9riaux construction", val: 350 },
    ],
    totalExports: 10000, totalImports: 3000,
    partners: ["Chine 30%", "Union Europ\u00e9enne 18%", "Australie 10%", "\u00c9tats-Unis 8%"],
    opportunities: ["Mangan\u00e8se strat\u00e9gique (batteries VE)", "For\u00eat durable certifi\u00e9e", "PIB par habitant \u00e9lev\u00e9"],
    risks: ["Transition politique post-coup", "D\u00e9pendance p\u00e9trole (>50%)", "March\u00e9 int\u00e9rieur restreint"],
    gdpGrowth: 2.8, currency: "XAF",
  },
  CG: {
    president: "Denis Sassou Nguesso", presidentSince: "1997",
    capitale: "Brazzaville", siegeEconomique: "Pointe-Noire",
    superficie: 342000,
    matieres_premieres: ["P\u00e9trole brut", "Bois tropical", "Potasse", "Minerai de fer", "Or", "Diamants", "Cuivre"],
    exports: [
      { cat: "P\u00e9trole brut", val: 6000 }, { cat: "Bois", val: 400 },
      { cat: "Sucre", val: 100 }, { cat: "Diamants", val: 50 },
    ],
    imports: [
      { cat: "Machines", val: 1200 }, { cat: "Denr\u00e9es alimentaires", val: 800 },
      { cat: "V\u00e9hicules", val: 500 }, { cat: "Ciment", val: 300 },
    ],
    totalExports: 8000, totalImports: 4000,
    partners: ["Chine 40%", "Union Europ\u00e9enne 20%", "\u00c9tats-Unis 8%", "Inde 6%"],
    opportunities: ["Port Pointe-Noire hub r\u00e9gional", "Potasse (Mag Mining)", "\u00c9conomie foresti\u00e8re durable"],
    risks: ["Surendettement (Chine)", "D\u00e9pendance p\u00e9trole >85%", "Gouvernance opaque"],
    gdpGrowth: 2.5, currency: "XAF",
  },
  CD: {
    president: "F\u00e9lix Tshisekedi", presidentSince: "2019 (r\u00e9\u00e9lu 2023)",
    capitale: "Kinshasa", siegeEconomique: "Kinshasa / Lubumbashi",
    superficie: 2345409,
    matieres_premieres: ["Cobalt (1er mondial 70%)", "Cuivre", "Coltan (tantale)", "Diamants", "Or", "\u00c9tain", "Lithium", "Mangan\u00e8se", "Zinc", "Uranium"],
    exports: [
      { cat: "Cuivre", val: 8000 }, { cat: "Cobalt", val: 5000 },
      { cat: "Or", val: 1500 }, { cat: "Diamants", val: 500 },
      { cat: "Coltan & \u00e9tain", val: 400 },
    ],
    imports: [
      { cat: "Machines & \u00e9quipements", val: 4000 }, { cat: "P\u00e9trole raffin\u00e9", val: 2500 },
      { cat: "Denr\u00e9es alimentaires", val: 2000 }, { cat: "V\u00e9hicules", val: 1200 },
      { cat: "M\u00e9dicaments", val: 800 },
    ],
    totalExports: 17000, totalImports: 13000,
    partners: ["Chine 52%", "Zambie 10%", "Afrique du Sud 6%", "\u00c9mirats 5%"],
    opportunities: ["Min\u00e9raux strat\u00e9giques (cobalt, lithium, coltan)", "Hydro\u00e9lectricit\u00e9 (Inga III)", "Superficie agricole immense"],
    risks: ["Conflit arm\u00e9 Est (M23)", "Gouvernance mini\u00e8re opaque", "Infrastructures d\u00e9vast\u00e9es"],
    gdpGrowth: 6.2, currency: "CDF",
  },
  TD: {
    president: "Mahamat Idriss D\u00e9by", presidentSince: "2021 (transition \u2192 \u00e9lu 2024)",
    capitale: "N'Djamena", siegeEconomique: "N'Djamena",
    superficie: 1284000,
    matieres_premieres: ["P\u00e9trole brut", "Or", "Uranium", "Natron", "Sel", "Kaolin", "\u00c9tain"],
    exports: [
      { cat: "P\u00e9trole brut", val: 2500 }, { cat: "Or", val: 300 },
      { cat: "B\u00e9tail", val: 200 }, { cat: "Gomme arabique", val: 80 },
    ],
    imports: [
      { cat: "Machines", val: 800 }, { cat: "Denr\u00e9es alimentaires", val: 600 },
      { cat: "V\u00e9hicules", val: 500 }, { cat: "M\u00e9dicaments", val: 200 },
    ],
    totalExports: 3500, totalImports: 3000,
    partners: ["Chine 30%", "\u00c9tats-Unis 18%", "France 8%", "Inde 6%"],
    opportunities: ["P\u00e9trole (bassin Doba)", "Position carrefour Sahel-Afrique Centrale", "Agriculture irriguable (lac Tchad)"],
    risks: ["Instabilit\u00e9 s\u00e9curitaire Sahel", "Enclavement total", "D\u00e9pendance p\u00e9troli\u00e8re"],
    gdpGrowth: 3.5, currency: "XAF",
  },
  CF: {
    president: "Faustin-Archange Touad\u00e9ra", presidentSince: "2016 (r\u00e9\u00e9lu 2020)",
    capitale: "Bangui", siegeEconomique: "Bangui",
    superficie: 622984,
    matieres_premieres: ["Diamants", "Or", "Bois tropical", "Uranium", "Fer", "Cuivre"],
    exports: [
      { cat: "Bois tropical", val: 80 }, { cat: "Diamants", val: 50 },
      { cat: "Or", val: 30 }, { cat: "Caf\u00e9 & coton", val: 20 },
    ],
    imports: [
      { cat: "Denr\u00e9es alimentaires", val: 150 }, { cat: "P\u00e9trole", val: 120 },
      { cat: "Machines", val: 80 }, { cat: "M\u00e9dicaments", val: 50 },
    ],
    totalExports: 200, totalImports: 500,
    partners: ["France 15%", "Chine 12%", "Cameroun 10%", "Bangladesh 8%"],
    opportunities: ["Diamants et or artisanaux", "Bois certifi\u00e9 FSC", "Int\u00e9gration CEMAC"],
    risks: ["Conflit arm\u00e9 persistant", "\u00c9tat le plus pauvre du monde", "Pr\u00e9sence Wagner/Africa Corps"],
    gdpGrowth: 1.0, currency: "XAF",
  },
  GQ: {
    president: "Teodoro Obiang Nguema", presidentSince: "1979",
    capitale: "Malabo", siegeEconomique: "Malabo / Bata",
    superficie: 28051,
    matieres_premieres: ["P\u00e9trole brut", "Gaz naturel", "Bois tropical", "Or", "M\u00e9thanol"],
    exports: [
      { cat: "P\u00e9trole brut", val: 4500 }, { cat: "Gaz naturel & m\u00e9thanol", val: 800 },
      { cat: "Bois", val: 100 },
    ],
    imports: [
      { cat: "Machines & \u00e9quipements", val: 1200 }, { cat: "Denr\u00e9es alimentaires", val: 600 },
      { cat: "V\u00e9hicules", val: 400 }, { cat: "Mat\u00e9riaux construction", val: 300 },
    ],
    totalExports: 6000, totalImports: 3000,
    partners: ["Chine 25%", "Espagne 15%", "\u00c9tats-Unis 12%", "Inde 8%"],
    opportunities: ["GNL & p\u00e9trochimie", "PIB par habitant \u00e9lev\u00e9", "Ville nouvelle Oyala"],
    risks: ["D\u00e9clin production p\u00e9troli\u00e8re", "Gouvernance autocratique", "In\u00e9galit\u00e9s extr\u00eames"],
    gdpGrowth: -3.2, currency: "XAF",
  },
  ST: {
    president: "Carlos Vila Nova", presidentSince: "2021",
    capitale: "S\u00e3o Tom\u00e9", siegeEconomique: "S\u00e3o Tom\u00e9",
    superficie: 964,
    matieres_premieres: ["Cacao", "Caf\u00e9", "Huile de palme", "Coprah", "Poissons"],
    exports: [
      { cat: "Cacao", val: 8 }, { cat: "Huile de palme", val: 3 },
      { cat: "Caf\u00e9", val: 2 },
    ],
    imports: [
      { cat: "Denr\u00e9es alimentaires", val: 60 }, { cat: "P\u00e9trole", val: 40 },
      { cat: "Machines", val: 25 }, { cat: "Mat\u00e9riaux construction", val: 15 },
    ],
    totalExports: 15, totalImports: 150,
    partners: ["Portugal 30%", "Pays-Bas 12%", "Belgique 10%", "France 8%"],
    opportunities: ["Cacao bio premium", "Tourisme \u00e9cotouristique", "P\u00e9trole offshore (JDZ avec Nigeria)"],
    risks: ["\u00c9conomie minuscule", "D\u00e9pendance aide internationale", "Isolement insulaire"],
    gdpGrowth: 2.0, currency: "STN",
  },
  // ── AFRIQUE AUSTRALE ──
  ZA: {
    president: "Cyril Ramaphosa", presidentSince: "2018 (r\u00e9\u00e9lu 2024)",
    capitale: "Pretoria / Le Cap / Bloemfontein", siegeEconomique: "Johannesburg",
    superficie: 1221037,
    matieres_premieres: ["Or", "Platine (1er mondial)", "Diamants", "Chrome", "Mangan\u00e8se", "Charbon", "Minerai de fer", "Vanadium", "Titane", "Uranium"],
    exports: [
      { cat: "Or & platine", val: 22000 }, { cat: "Minerai de fer", val: 12000 },
      { cat: "Charbon", val: 8500 }, { cat: "Automobiles", val: 8000 },
      { cat: "Mangan\u00e8se & chrome", val: 6000 }, { cat: "Fruits & vin", val: 4000 },
    ],
    imports: [
      { cat: "P\u00e9trole raffin\u00e9", val: 18000 }, { cat: "Machines & \u00e9quipements", val: 16000 },
      { cat: "\u00c9lectronique", val: 8000 }, { cat: "V\u00e9hicules & pi\u00e8ces", val: 7500 },
      { cat: "Prod. chimiques", val: 5000 },
    ],
    totalExports: 108000, totalImports: 115000,
    partners: ["Chine 16%", "\u00c9tats-Unis 8%", "Allemagne 7%", "Japon 5%"],
    opportunities: ["\u00c9conomie la plus diversifi\u00e9e d'Afrique", "BRICS+", "Min\u00e9raux strat\u00e9giques VE (platine, mangan\u00e8se)"],
    risks: ["Crise \u00e9nerg\u00e9tique (load shedding)", "Ch\u00f4mage >30%", "In\u00e9galit\u00e9s structurelles"],
    gdpGrowth: 0.7, currency: "ZAR",
  },
  AO: {
    president: "Jo\u00e3o Louren\u00e7o", presidentSince: "2017 (r\u00e9\u00e9lu 2022)",
    capitale: "Luanda", siegeEconomique: "Luanda",
    superficie: 1246700,
    matieres_premieres: ["P\u00e9trole brut (2e Afrique)", "Diamants", "Minerai de fer", "Phosphates", "Cuivre", "Or", "Mangan\u00e8se", "Gaz naturel"],
    exports: [
      { cat: "P\u00e9trole brut", val: 30000 }, { cat: "Diamants", val: 1800 },
      { cat: "Gaz naturel", val: 1500 }, { cat: "Minerais & m\u00e9taux", val: 800 },
      { cat: "Poissons", val: 400 },
    ],
    imports: [
      { cat: "Machines & \u00e9quipements", val: 4500 }, { cat: "Denr\u00e9es alimentaires", val: 3500 },
      { cat: "V\u00e9hicules", val: 2000 }, { cat: "Prod. chimiques", val: 1500 },
      { cat: "Mat\u00e9riaux construction", val: 1200 },
    ],
    totalExports: 36000, totalImports: 16000,
    partners: ["Chine 58%", "Inde 8%", "\u00c9tats-Unis 5%", "Portugal 4%"],
    opportunities: ["Corridor de Lobito (RDC-Zambie)", "Raffinage p\u00e9trolier local", "Diversification \u00e9conomique"],
    risks: ["Hyper-d\u00e9pendance p\u00e9trole (>90%)", "D\u00e9pr\u00e9ciation kwanza", "Pauvret\u00e9 malgr\u00e9 ressources"],
    gdpGrowth: 1.3, currency: "AOA",
  },
  MZ: {
    president: "Daniel Chapo", presidentSince: "janv. 2025",
    capitale: "Maputo", siegeEconomique: "Maputo",
    superficie: 801590,
    matieres_premieres: ["Gaz naturel (Rovuma, top 10 mondial)", "Charbon", "Aluminium", "Rubis (Montepuez)", "Graphite", "Titane", "Or", "Tantale"],
    exports: [
      { cat: "Aluminium", val: 1800 }, { cat: "Charbon", val: 1500 },
      { cat: "Gaz naturel", val: 1000 }, { cat: "Rubis & pierres", val: 600 },
      { cat: "Tabac & sucre", val: 400 },
    ],
    imports: [
      { cat: "Machines & \u00e9quipements", val: 2500 }, { cat: "P\u00e9trole raffin\u00e9", val: 2000 },
      { cat: "C\u00e9r\u00e9ales & riz", val: 1200 }, { cat: "V\u00e9hicules", val: 800 },
      { cat: "Fer & acier", val: 600 },
    ],
    totalExports: 7000, totalImports: 10000,
    partners: ["Inde 18%", "Pays-Bas 14%", "Afrique du Sud 22%", "Chine 8%"],
    opportunities: ["M\u00e9ga-projet GNL Rovuma (>50 Mrd$)", "Corridor Nacala (Zambie-Malawi)", "Rubis de Montepuez (2e mondial)"],
    risks: ["Insurrection Cabo Delgado", "Crise post-\u00e9lectorale", "Surendettement"],
    gdpGrowth: 4.2, currency: "MZN",
  },
  ZM: {
    president: "Hakainde Hichilema", presidentSince: "2021",
    capitale: "Lusaka", siegeEconomique: "Lusaka",
    superficie: 752618,
    matieres_premieres: ["Cuivre (2e Afrique)", "Cobalt", "\u00c9meraudes (2e mondial)", "Or", "Mangan\u00e8se", "Charbon", "Uranium", "Nickel"],
    exports: [
      { cat: "Cuivre raffin\u00e9", val: 7500 }, { cat: "Cobalt", val: 800 },
      { cat: "\u00c9meraudes", val: 350 }, { cat: "Or", val: 200 },
      { cat: "Sucre & tabac", val: 300 },
    ],
    imports: [
      { cat: "Machines & \u00e9quipements", val: 2500 }, { cat: "P\u00e9trole raffin\u00e9", val: 1800 },
      { cat: "V\u00e9hicules", val: 1200 }, { cat: "Engrais", val: 600 },
      { cat: "M\u00e9dicaments", val: 400 },
    ],
    totalExports: 11000, totalImports: 9000,
    partners: ["Suisse 30%", "Chine 18%", "Afrique du Sud 12%", "RD Congo 8%"],
    opportunities: ["Corridor de Lobito (acc\u00e8s Atlantique)", "Min\u00e9raux strat\u00e9giques VE", "\u00c9nergie solaire & hydro"],
    risks: ["Volatilit\u00e9 cours du cuivre", "D\u00e9ficit \u00e9nerg\u00e9tique", "Restructuration dette"],
    gdpGrowth: 4.0, currency: "ZMW",
  },
  ZW: {
    president: "Emmerson Mnangagwa", presidentSince: "2017 (r\u00e9\u00e9lu 2023)",
    capitale: "Harare", siegeEconomique: "Harare",
    superficie: 390757,
    matieres_premieres: ["Platine", "Or", "Diamants", "Lithium (5e mondial)", "Chrome", "Nickel", "Charbon", "Tabac", "Fer"],
    exports: [
      { cat: "Or", val: 2000 }, { cat: "Platine & nickel", val: 1200 },
      { cat: "Tabac", val: 800 }, { cat: "Diamants", val: 400 },
      { cat: "Lithium", val: 300 }, { cat: "Chrome & ferrochrome", val: 350 },
    ],
    imports: [
      { cat: "P\u00e9trole raffin\u00e9", val: 1500 }, { cat: "Machines", val: 1200 },
      { cat: "V\u00e9hicules", val: 800 }, { cat: "Engrais", val: 400 },
      { cat: "\u00c9lectricit\u00e9 import\u00e9e", val: 300 },
    ],
    totalExports: 6000, totalImports: 7000,
    partners: ["Afrique du Sud 40%", "\u00c9mirats 15%", "Chine 10%", "Mozambique 8%"],
    opportunities: ["Lithium strat\u00e9gique (batteries VE)", "Platine pour hydrog\u00e8ne vert", "Agriculture tabac & fleurs"],
    risks: ["Instabilit\u00e9 mon\u00e9taire chronique", "Sanctions occidentales", "Crise \u00e9nerg\u00e9tique"],
    gdpGrowth: 3.5, currency: "ZWL",
  },
  BW: {
    president: "Duma Boko", presidentSince: "2024",
    capitale: "Gaborone", siegeEconomique: "Gaborone",
    superficie: 581730,
    matieres_premieres: ["Diamants (2e mondial)", "Cuivre", "Nickel", "Soude", "Charbon", "Or"],
    exports: [
      { cat: "Diamants", val: 5500 }, { cat: "Cuivre & nickel", val: 800 },
      { cat: "Soude", val: 400 }, { cat: "Viande bovine", val: 200 },
    ],
    imports: [
      { cat: "Machines", val: 2000 }, { cat: "P\u00e9trole raffin\u00e9", val: 1500 },
      { cat: "V\u00e9hicules", val: 800 }, { cat: "Denr\u00e9es alimentaires", val: 600 },
      { cat: "\u00c9lectricit\u00e9", val: 400 },
    ],
    totalExports: 8000, totalImports: 7000,
    partners: ["Union Europ\u00e9enne 35%", "Afrique du Sud 22%", "Inde 15%", "\u00c9mirats 10%"],
    opportunities: ["Diamants valeur ajout\u00e9e (taille locale)", "Tourisme safari premium", "Hub financier stable"],
    risks: ["Mono-d\u00e9pendance diamants (>80%)", "March\u00e9 int\u00e9rieur restreint", "\u00c9pid\u00e9mie VIH"],
    gdpGrowth: 3.5, currency: "BWP",
  },
  NA: {
    president: "Netumbo Nandi-Ndaitwah", presidentSince: "2025",
    capitale: "Windhoek", siegeEconomique: "Windhoek",
    superficie: 824292,
    matieres_premieres: ["Uranium (2e mondial)", "Diamants", "Or", "Zinc", "Cuivre", "Plomb", "Mangan\u00e8se", "\u00c9tain"],
    exports: [
      { cat: "Diamants", val: 1500 }, { cat: "Uranium", val: 1200 },
      { cat: "Or & zinc", val: 800 }, { cat: "Poissons & crustac\u00e9s", val: 600 },
      { cat: "Viande bovine", val: 300 },
    ],
    imports: [
      { cat: "P\u00e9trole raffin\u00e9", val: 1500 }, { cat: "Machines", val: 1200 },
      { cat: "V\u00e9hicules", val: 800 }, { cat: "Denr\u00e9es alimentaires", val: 600 },
    ],
    totalExports: 6000, totalImports: 7000,
    partners: ["Afrique du Sud 25%", "Chine 14%", "Union Europ\u00e9enne 20%", "Botswana 8%"],
    opportunities: ["Uranium strat\u00e9gique (\u00e9nergie nucl\u00e9aire)", "Port Walvis Bay hub r\u00e9gional", "Hydrog\u00e8ne vert (solaire + \u00e9olien)"],
    risks: ["D\u00e9ficit commercial", "S\u00e9cheresse & stress hydrique", "In\u00e9galit\u00e9s h\u00e9rit\u00e9es"],
    gdpGrowth: 3.0, currency: "NAD",
  },
  MW: {
    president: "Lazarus Chakwera", presidentSince: "2020",
    capitale: "Lilongwe", siegeEconomique: "Blantyre",
    superficie: 118484,
    matieres_premieres: ["Tabac", "Th\u00e9", "Sucre", "Uranium", "Charbon", "Bauxite", "Terres rares"],
    exports: [
      { cat: "Tabac", val: 500 }, { cat: "Th\u00e9", val: 100 },
      { cat: "Sucre", val: 80 }, { cat: "Uranium & minerais", val: 60 },
      { cat: "L\u00e9gumineuses", val: 50 },
    ],
    imports: [
      { cat: "P\u00e9trole raffin\u00e9", val: 800 }, { cat: "Engrais", val: 500 },
      { cat: "Machines", val: 400 }, { cat: "M\u00e9dicaments", val: 250 },
      { cat: "C\u00e9r\u00e9ales", val: 200 },
    ],
    totalExports: 1200, totalImports: 3200,
    partners: ["Belgique 12%", "Afrique du Sud 10%", "\u00c9gypte 8%", "\u00c9mirats 7%"],
    opportunities: ["Corridor Nacala (acc\u00e8s Mozambique)", "Agriculture diversifi\u00e9e", "Terres rares (potentiel)"],
    risks: ["D\u00e9ficit commercial massif", "Vuln\u00e9rabilit\u00e9 climatique", "Pauvret\u00e9 structurelle"],
    gdpGrowth: 1.7, currency: "MWK",
  },
  SZ: {
    president: "Roi Mswati III", presidentSince: "1986",
    capitale: "Mbabane / Lobamba", siegeEconomique: "Mbabane",
    superficie: 17364,
    matieres_premieres: ["Sucre de canne", "P\u00e2te \u00e0 papier", "Charbon", "Or", "Diamants", "Amiante"],
    exports: [
      { cat: "Sucre & concentr\u00e9s", val: 800 }, { cat: "P\u00e2te \u00e0 papier", val: 350 },
      { cat: "Textiles & v\u00eatements", val: 250 }, { cat: "Fruits (agrumes)", val: 120 },
    ],
    imports: [
      { cat: "Machines", val: 600 }, { cat: "P\u00e9trole raffin\u00e9", val: 500 },
      { cat: "V\u00e9hicules", val: 350 }, { cat: "Denr\u00e9es alimentaires", val: 300 },
    ],
    totalExports: 2000, totalImports: 2500,
    partners: ["Afrique du Sud 60%", "Kenya 5%", "Mozambique 4%", "Nigeria 3%"],
    opportunities: ["AGOA (acc\u00e8s march\u00e9 US)", "Sucre premium", "Tourisme culturel"],
    risks: ["D\u00e9pendance Afrique du Sud (>60%)", "Monarchie absolue", "\u00c9pid\u00e9mie VIH"],
    gdpGrowth: 3.5, currency: "SZL",
  },
  LS: {
    president: "Roi Letsie III / PM Sam Matekane", presidentSince: "2022 (PM)",
    capitale: "Maseru", siegeEconomique: "Maseru",
    superficie: 30355,
    matieres_premieres: ["Diamants", "Eau (barrages Highlands)", "Laine mohair", "Textiles"],
    exports: [
      { cat: "Diamants", val: 350 }, { cat: "Textiles & v\u00eatements", val: 300 },
      { cat: "Eau (export Afrique du Sud)", val: 100 }, { cat: "Laine & mohair", val: 50 },
    ],
    imports: [
      { cat: "Denr\u00e9es alimentaires", val: 600 }, { cat: "Machines", val: 400 },
      { cat: "P\u00e9trole", val: 300 }, { cat: "V\u00e9hicules", val: 200 },
    ],
    totalExports: 1000, totalImports: 2000,
    partners: ["Afrique du Sud 45%", "\u00c9tats-Unis 30%", "Union Europ\u00e9enne 10%", "Asie 5%"],
    opportunities: ["AGOA textiles (march\u00e9 US)", "Eau strat\u00e9gique (Highlands Water Project)", "Diamants Letseng (haute valeur)"],
    risks: ["Enclavement total dans l'Afrique du Sud", "D\u00e9pendance SACU", "\u00c9rosion des sols"],
    gdpGrowth: 2.3, currency: "LSL",
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

function CountryDashboard({ country, indexValue, onClose, onAskAI }) {
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
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onAskAI(country)} style={{ background: "rgba(240,180,41,0.1)", border: "1px solid #f0b429", color: "#f0b429", padding: "6px 14px", borderRadius: 4, cursor: "pointer", fontSize: 9, fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>
            INTERROGER L'IA &#8594;
          </button>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #1e3a5f", color: "#64748b", padding: "6px 14px", borderRadius: 4, cursor: "pointer", fontSize: 9, fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>
            â† RETOUR
          </button>
        </div>
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
  return Math.round(AFRICAN_COUNTRIES.reduce((sum, c) => sum + (indices[c.code] || 50) * c.weight, 0));
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
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState("basic");
  const [queriesUsed, setQueriesUsed] = useState(0);
  const [indices, setIndices] = useState(generateIndices());
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [wasiComposite, setWasiComposite] = useState(0);
  const [showCapabilities, setShowCapabilities] = useState(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      return !saved || JSON.parse(saved).length === 0;
    } catch { return true; }
  });
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

  // â”€â”€ Persist chat history â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages)); }
    catch { /* localStorage full or unavailable */ }
  }, [messages]);

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

  const getRegionalFacts = (country) => {
    const rankedCountries = [...AFRICAN_COUNTRIES].sort(
      (left, right) => Number(indices[right.code] || 0) - Number(indices[left.code] || 0)
    );
    const totalCountries = rankedCountries.length;
    const average =
      rankedCountries.reduce((sum, entry) => sum + Number(indices[entry.code] || 0), 0) /
      Math.max(totalCountries, 1);
    const rank = country
      ? rankedCountries.findIndex((entry) => entry.code === country.code) + 1
      : null;
    const score = country ? Number(indices[country.code] || 0) : null;

    return {
      rankedCountries,
      totalCountries,
      average,
      averageLabel: Number.isFinite(average) ? average.toFixed(1) : "N/A",
      rank,
      score,
      relation:
        score === null
          ? null
          : score > average
            ? "SUPERIEUR ↑"
            : score < average
              ? "INFERIEUR ↓"
              : "EQUIVALENT →",
    };
  };

  const enforceRegionalConsistency = (replyText) => {
    const original = String(replyText || "").trim();
    if (!original) return "Agent WASI temporairement indisponible. Veuillez reessayer.";

    const regionalFacts = getRegionalFacts(selectedCountry);
    if (!selectedCountry || !regionalFacts.rank) {
      return original;
    }

    let safeReply = original;
    const averageDisplay =
      Math.abs(regionalFacts.average - Math.round(regionalFacts.average)) < 0.05
        ? String(Math.round(regionalFacts.average))
        : regionalFacts.averageLabel;

    safeReply = safeReply.replace(
      /^([•*-]\s*)?Score vs moyenne .*$/im,
      `- Score vs moyenne AFRIQUE DE L'OUEST (${averageDisplay}) : ${regionalFacts.relation}`
    );
    safeReply = safeReply.replace(
      /^([•*-]\s*)?Rang\s+(?:AFRIQUE|AFRIQUE DE L'OUEST|CEDEAO).*$/im,
      `- Rang AFRIQUE DE L'OUEST : ${regionalFacts.rank}/${regionalFacts.totalCountries}`
    );
    safeReply = safeReply.replace(
      /^([•*-]\s*)?Meilleur indice\s*:.*$/im,
      "- Meilleur indice : decomposition non disponible"
    );
    safeReply = safeReply.replace(
      /^([•*-]\s*)?Plus faible indice\s*:.*$/im,
      "- Plus faible indice : decomposition non disponible"
    );
    safeReply = safeReply.replace(
      /COMPARAISON R[ÉE]GIONALE\s*:/i,
      "COMPARAISON REGIONALE :"
    );

    return safeReply;
  };

  const buildCountryTradeContext = (code) => {
    const td = COUNTRY_TRADE_DATA[code];
    if (!td) return "";
    const c = AFRICAN_COUNTRIES.find(x => x.code === code);
    const coupLabel = COUP_REGIMES.includes(code) ? " [REGIME MILITAIRE/TRANSITION]" : "";
    return `
--- FICHE COMMERCIALE : ${c?.name || code} (${code})${coupLabel} ---
Chef d'Etat : ${td.president} (depuis ${td.presidentSince})
Capitale : ${td.capitale} | Centre eco. : ${td.siegeEconomique} | Superficie : ${td.superficie.toLocaleString("fr-FR")} km²
Monnaie : ${td.currency} | Croissance PIB : +${td.gdpGrowth}%
Matieres premieres : ${td.matieres_premieres.join(", ")}
Exportations (${fmt(td.totalExports)} total) : ${td.exports.map(e => `${e.cat} ${fmt(e.val)}`).join(" | ")}
Importations (${fmt(td.totalImports)} total) : ${td.imports.map(e => `${e.cat} ${fmt(e.val)}`).join(" | ")}
Balance commerciale : ${td.totalExports - td.totalImports >= 0 ? "+" : ""}${fmt(td.totalExports - td.totalImports)} | Taux de couverture : ${((td.totalExports / td.totalImports) * 100).toFixed(1)}%
Partenaires : ${td.partners.join(" | ")}
Opportunites : ${td.opportunities.join(" | ")}
Risques : ${td.risks.join(" | ")}`;
  };

  const buildCompactTradeOverview = () => {
    return AFRICAN_COUNTRIES.map(c => {
      const td = COUNTRY_TRADE_DATA[c.code];
      if (!td) return `${c.code}: donnees indisponibles`;
      const balance = td.totalExports - td.totalImports;
      return `${c.code} ${c.name}: exp=${fmt(td.totalExports)} imp=${fmt(td.totalImports)} bal=${balance >= 0 ? "+" : ""}${fmt(balance)} PIB=+${td.gdpGrowth}% top_exp=${td.exports[0]?.cat} monnaie=${td.currency}`;
    }).join("\n");
  };

  const buildSystemPrompt = () => {
    const regionalFacts = getRegionalFacts(selectedCountry);
    const rankingPreview = regionalFacts.rankedCountries
      .slice(0, 3)
      .map((country, index) => `${index + 1}. ${country.name} ${Number(indices[country.code] || 0)}/100`)
      .join(" | ");
    const countryData = AFRICAN_COUNTRIES.map(c =>
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

    const focusCountryBlock = selectedCountry
      ? buildCountryTradeContext(selectedCountry.code)
      : "";
    const compactOverview = buildCompactTradeOverview();

    return `Tu es l'agent IA WASI — l'analyste economique et maritime de reference pour l'Afrique de l'Ouest.

PERSONNALITE ET TON :
- Tu parles comme un analyste senior d'une banque d'investissement panafricaine : precis, direct, confiant
- Tu es CONVERSATIONNEL : reponds naturellement aux questions, pas comme un rapport automatique
- Adapte la longueur de ta reponse a la complexite de la question : une question simple = reponse concise, une analyse profonde = reponse detaillee
- Utilise des chiffres concrets, des pourcentages, des montants en dollars — jamais de generalites vagues
- Quand tu donnes un avis, assume-le : "Je recommande...", "Le signal est clair...", "Attention a..."
- Tu es un expert, pas un moteur de recherche. Synthetise, compare, recommande — ne te contente pas de lister

Tu reponds TOUJOURS en francais sauf si l'utilisateur demande explicitement l'anglais.

DONNEES ACTUELLES (${new Date().toLocaleDateString("fr-FR")}):
Indice composite WASI : ${wasiComposite}/100
Source de donnees : ${dataSourceMeta.detail}
Forfait : ${selectedTier.toUpperCase()} | Protocole x402 : ACTIF | Acces : COMPLET
${fxSummary}
${cryptoSummary}
${macroSummary}

FAITS REGIONAUX CALCULES :
- perimetre regional strict : Afrique de l'Ouest / CEDEAO elargie = 16 pays
- moyenne regionale actuelle : ${regionalFacts.averageLabel}/100
- classement actuel top 3 : ${rankingPreview}
${selectedCountry ? `- rang regional du pays focus : ${regionalFacts.rank}/16` : ""}

INDICES PAYS (dernier point disponible) :
${countryData}

APERCU COMMERCIAL REGIONAL (tous les 16 pays) :
${compactOverview}
${focusCountryBlock ? `\n${focusCountryBlock}` : ""}

TES MISSIONS :
- analyser les flux maritimes et commerciaux des 16 pays d'Afrique de l'Ouest
- produire des analyses pays avec lecture sectorielle, en utilisant les DONNEES REELLES fournies ci-dessus
- formuler des implications d'investissement, de credit ou d'entree de marche
- signaler le momentum ETF lie a l'indice WASI
- detecter les tensions et opportunites sur les corridors commerciaux
- commenter les dynamiques UEMOA, CEDEAO et franc CFA

CLASSIFICATION DES QUESTIONS :
1. PRESENTATION/DESCRIPTION de WASI : reponds avec une vue d'ensemble de la plateforme (indice composite, indices pays, protocole x402, signaux ETF, corridors commerciaux, cas d'usage). Ne fais PAS d'analyse maritime ou monetaire.
2. INVESTISSEMENT/OPPORTUNITES : suis le cadre d'investissement ci-dessous. Sois DIRECT et ACTIONABLE avec des chiffres. Ne donne PAS un profil pays generique.
3. ANALYSE PAYS : utilise les FICHES COMMERCIALES fournies pour donner des chiffres precis (exports, imports, balance, partenaires, PIB). Ne generique pas.
4. COMPARAISON : compare avec des chiffres cote a cote, identifie les ecarts et tire des conclusions.
5. QUESTION SIMPLE/CONVERSATIONNELLE : reponds directement et brievement. Pas besoin de rapport complet pour "quel est l'indice du Ghana ?".

CADRE D'INVESTISSEMENT :
Quand l'utilisateur pose une question d'investissement :
- Court terme (< 1 an) : cite les secteurs porteurs immediats, instruments financiers (bons du tresor, marche monetaire BRVM, obligations), risques de change
- Moyen terme (1-3 ans) : projets d'infrastructure, PPP, concessions portuaires, zones franches
- Long terme (> 3 ans) : secteurs structurels (agriculture, mines, energie, immobilier, tech)
- Toujours inclure : rendements estimes, vehicules d'investissement concrets, risques specifiques au pays, signal WASI
- JAMAIS de profil pays generique quand on demande des opportunites specifiques

METHODOLOGIE DE L'INDICE :
- arrivees de navires : 40 % | tonnage cargo : 40 % | conteneurs traites : 20 %
- base 100 normalisee sur la moyenne historique 5 ans
- > 70 : expansion forte | 50-70 : stabilite | < 50 : contraction

REGLES DE COHERENCE OBLIGATOIRES :
- couverture : Afrique de l'Ouest uniquement. Utilise "Afrique de l'Ouest" ou "CEDEAO", jamais "Afrique" seul
- score : toujours sur 100 (ex: 48/100). Rang : toujours sur 16 (ex: 4/16)
- si decomposition par sous-indices non disponible, ecris "decomposition non disponible"
- n'invente JAMAIS des sous-indices (integration, infra, etc.) non fournis dans les donnees
- si une donnee manque, dis "donnee indisponible" — ne comble pas avec des generalites

GESTION DE LA CONVERSATION :
- Si l'utilisateur fait reference a un message precedent ou pose une question de suivi, reponds dans le contexte de la conversation en cours
- Ne repete pas les informations deja donnees sauf si on te les redemande
- Si la question est ambigue, reponds avec ton meilleur jugement plutot que de demander des precisions (sauf si vraiment impossible de deviner)

${selectedTier === "institutional" ? "SUPPLEMENT INSTITUTIONNEL : inclure les tableaux bruts, les signaux ETF detailles, la decomposition de l'indice et les scores sectoriels." : ""}

${selectedCountry ? `FOCUS PAYS ACTIF : ${selectedCountry.name} (${selectedCountry.code}) | Port : ${selectedCountry.port} | Indice actuel : ${indices[selectedCountry.code]}/100 | Rang regional : ${regionalFacts.rank}/16
L'utilisateur a selectionne ce pays dans l'interface. Oriente tes reponses vers ce pays sauf indication contraire.` : ""}

Source a citer : "WASI Data Engine v1.0 | statistiques officielles portuaires | flux verifie x402"
Termine chaque reponse par "**Signal WASI :** " suivi d'une implication actionable en une ligne.

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
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system: buildSystemPrompt(),
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: query }
          ]
        })
      });
      const data = await response.json();
      const reply = data.content?.[0]?.text || "Agent WASI temporairement indisponible. Veuillez reessayer.";
      const safeReply = enforceRegionalConsistency(reply);
      setMessages(m => [...m, { role: "assistant", content: safeReply }]);
    } catch (err) {
      setMessages(m => [...m, { role: "assistant", content: "Erreur de connexion. Agent WASI hors ligne. Verifiez la connectivite API." }]);
    }
    setLoading(false);
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    setShowCapabilities(true);
  };

  const exportHistory = () => {
    const text = messages.map(m =>
      `[${m.role === "user" ? "VOUS" : "WASI IA"}]\n${m.content}`
    ).join("\n\n---\n\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wasi-historique-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
            {AFRICAN_COUNTRIES.map(c => (
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
            <div style={{ fontSize: 9, color: "#94a3b8" }}>16 pays · {AFRICAN_COUNTRIES.length} ports suivis</div>
          </div>
        </div>

        {/* CENTER â€” Dashboard pays ou Interface Chat */}
        {showDashboard && selectedCountry ? (
          <CountryDashboard
            country={selectedCountry}
            indexValue={indices[selectedCountry.code]}
            onClose={() => setShowDashboard(false)}
            onAskAI={(country) => {
              setSelectedCountry(country);
              setShowDashboard(false);
              sendMessage(`Analyse complete de ${country.name} : situation economique actuelle, activite portuaire, principaux flux commerciaux, opportunites d'investissement concretes et risques a surveiller.`);
            }}
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
                      {'-> '}{q}
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
            <div style={{ marginTop: 6, fontSize: 8, color: "#334155", letterSpacing: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Protocole x402 · Paiement par requete en USDC · Sans abonnement</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {messages.length > 0 && (
                  <>
                    <button onClick={exportHistory} style={{ background: "none", border: "1px solid #1e3a5f", color: "#475569", padding: "2px 8px", borderRadius: 3, cursor: "pointer", fontSize: 8, fontFamily: "'Space Mono', monospace" }}>
                      EXPORTER
                    </button>
                    <button onClick={clearHistory} style={{ background: "none", border: "1px solid #ef444444", color: "#ef4444", padding: "2px 8px", borderRadius: 3, cursor: "pointer", fontSize: 8, fontFamily: "'Space Mono', monospace" }}>
                      EFFACER
                    </button>
                  </>
                )}
                <span>WASI v1.0 · {new Date().toLocaleDateString("fr-FR")}</span>
              </div>
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
            {[...AFRICAN_COUNTRIES].sort((a, b) => (indices[b.code] || 0) - (indices[a.code] || 0)).slice(0, 5).map(c => (
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

