import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import WasiApp from "../wasi_agent.jsx";
import { BankingApp } from "./banking/BankingApp";
import { AppSwitcher, getStoredAppId, normalizeAppId, persistAppId } from "./platform/AppSwitcher";
import { isFeatureEnabled } from "./platform/featureFlags";

const params = new URLSearchParams(window.location.search);
const rawApp = params.get("app");
const selectedApp = rawApp ? normalizeAppId(rawApp) : getStoredAppId();
const forceLogin = params.get("login") === "1";
persistAppId(selectedApp);

if (forceLogin) {
  sessionStorage.removeItem("wasi_token");
  sessionStorage.removeItem("wasi_token_ts");
}

const RootApp =
  selectedApp === "banking" && isFeatureEnabled("banking")
    ? BankingApp
    : WasiApp;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <>
      <RootApp />
      <AppSwitcher currentApp={selectedApp} />
    </>
  </React.StrictMode>
);
