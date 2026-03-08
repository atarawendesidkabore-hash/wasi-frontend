import React from "react";
import { createRoot } from "react-dom/client";
import WasiApp from "../wasi_agent.jsx";
import { BankingApp } from "./banking/BankingApp";
import { DexApp } from "./dex/DexApp";

const params = new URLSearchParams(window.location.search);
const selectedApp = (params.get("app") || "").toLowerCase();
const forceLogin = params.get("login") === "1";
const bankingAliases = new Set(["banking", "bank", "wallet"]);
const dexAliases = new Set(["dex", "exchange", "etf-dex"]);

if (forceLogin) {
  sessionStorage.removeItem("wasi_token");
  sessionStorage.removeItem("wasi_token_ts");
}

const RootApp = bankingAliases.has(selectedApp)
  ? BankingApp
  : dexAliases.has(selectedApp)
    ? DexApp
    : WasiApp;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);
