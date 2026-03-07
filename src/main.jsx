import React from "react";
import { createRoot } from "react-dom/client";
import WasiApp from "../wasi_agent.jsx";
import { BankingApp } from "./banking/BankingApp";

const params = new URLSearchParams(window.location.search);
const selectedApp = (params.get("app") || "").toLowerCase();
const wasiAliases = new Set(["wasi", "terminal", "market"]);
const bankingAliases = new Set(["banking", "bank", "wallet"]);

const RootApp = wasiAliases.has(selectedApp)
  ? WasiApp
  : bankingAliases.has(selectedApp) || selectedApp === ""
    ? BankingApp
    : BankingApp;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);
