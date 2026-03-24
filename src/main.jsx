import React, { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { AppSwitcher, getStoredAppId, normalizeAppId, persistAppId, navigateToApp } from "./platform/AppSwitcher";
import { isFeatureEnabled } from "./platform/featureFlags";

const WasiApp = lazy(() => import("../wasi_agent.jsx"));
const BankingApp = lazy(() => import("./banking/BankingApp").then((m) => ({ default: m.BankingApp })));
const DexApp = lazy(() => import("./dex/DexApp").then((m) => ({ default: m.DexApp })));
const AfriTradeModuleApp = lazy(() => import("./afritrade/AfriTradeModuleApp").then((m) => ({ default: m.AfriTradeModuleApp })));
const AfriTaxApp = lazy(() => import("./afritax/AfriTaxApp").then((m) => ({ default: m.AfriTaxApp })));
const OhadaComptaApp = lazy(() => import("./compta/OhadaComptaApp").then((m) => ({ default: m.OhadaComptaApp })));
const FinanceWorkbenchApp = lazy(() => import("./finance/FinanceWorkbenchApp").then((m) => ({ default: m.FinanceWorkbenchApp })));
const WorkspaceHomeApp = lazy(() => import("./platform/WorkspaceHomeApp").then((m) => ({ default: m.WorkspaceHomeApp })));
const CommercialDemoKitApp = lazy(() => import("./platform/CommercialDemoKitApp").then((m) => ({ default: m.CommercialDemoKitApp })));

const AppLoader = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0a0a", color: "#00ff88", fontFamily: "monospace" }}>
    Chargement WASI...
  </div>
);

const params = new URLSearchParams(window.location.search);
const rawApp = params.get("app");
const selectedApp = rawApp ? normalizeAppId(rawApp) : getStoredAppId();
const forceLogin = params.get("login") === "1";
persistAppId(selectedApp);

const APP_TITLES = {
  home: "WASI - Accueil",
  sales: "WASI - Kit commercial",
  wasi: "WASI - Intelligence maritime",
  banking: "WASI - Controle bancaire",
  afritrade: "WASI - AfriTrade",
  afritax: "WASI - AfriTax",
  compta: "WASI - OHADA Compta",
  finance: "WASI - Finance Lab",
  dex: "WASI - ETF DEX",
};

if (typeof document !== "undefined") {
  document.documentElement.lang = "fr";
  document.title = APP_TITLES[selectedApp] || "WASI - Plateforme";
}

if (forceLogin) {
  sessionStorage.removeItem("wasi_token");
  sessionStorage.removeItem("wasi_token_ts");
}

const FallbackApp = WasiApp;

const AppRoute = () => {
  if (selectedApp === "home") {
    return <WorkspaceHomeApp />;
  }

  if (selectedApp === "sales") {
    return <CommercialDemoKitApp />;
  }

  if (selectedApp === "banking") {
    return isFeatureEnabled("banking") ? <BankingApp /> : <FallbackApp />;
  }

  if (selectedApp === "afritrade") {
    return isFeatureEnabled("afritrade") ? <AfriTradeModuleApp /> : <FallbackApp />;
  }

  if (selectedApp === "afritax") {
    return isFeatureEnabled("afritax") ? <AfriTaxApp /> : <FallbackApp />;
  }

  if (selectedApp === "compta") {
    return isFeatureEnabled("compta") ? <OhadaComptaApp /> : <FallbackApp />;
  }

  if (selectedApp === "finance") {
    return isFeatureEnabled("finance") ? <FinanceWorkbenchApp /> : <FallbackApp />;
  }

  if (selectedApp === "dex") {
    if (!isFeatureEnabled("dex")) return <FallbackApp />;
    return <DexApp />;
  }

  return <WasiApp />;
};

if (selectedApp === "dex" && !isFeatureEnabled("dex")) {
  navigateToApp("wasi", { replace: true });
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={<AppLoader />}>
      <AppRoute />
      <AppSwitcher currentApp={selectedApp} />
    </Suspense>
  </React.StrictMode>
);
