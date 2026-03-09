import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import WasiApp from "../wasi_agent.jsx";
import { BankingApp } from "./banking/BankingApp";
import { AppSwitcher, getStoredAppId, normalizeAppId, persistAppId, navigateToApp } from "./platform/AppSwitcher";
import { isFeatureEnabled } from "./platform/featureFlags";
import { DexApp } from "./dex/DexApp";
import { AfriTradeModuleApp } from "./afritrade/AfriTradeModuleApp";
import { AfriTaxApp } from "./afritax/AfriTaxApp";
import { OhadaComptaApp } from "./compta/OhadaComptaApp";
import { FinanceWorkbenchApp } from "./finance/FinanceWorkbenchApp";

const params = new URLSearchParams(window.location.search);
const rawApp = params.get("app");
const selectedApp = rawApp ? normalizeAppId(rawApp) : getStoredAppId();
const forceLogin = params.get("login") === "1";
persistAppId(selectedApp);

if (forceLogin) {
  sessionStorage.removeItem("wasi_token");
  sessionStorage.removeItem("wasi_token_ts");
}

const FallbackApp = WasiApp;

const AppRoute = () => {
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
    <>
      <AppRoute />
      <AppSwitcher currentApp={selectedApp} />
    </>
  </React.StrictMode>
);
