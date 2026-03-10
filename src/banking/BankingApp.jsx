import { useState } from "react";
import AfriTradeApp from "./AfriTradeApp";
import { navigateToApp } from "../platform/AppSwitcher";

const shellStyle = {
  minHeight: "100vh",
  background: "#020617",
  color: "#e2e8f0",
  padding: 12,
};

const panelStyle = {
  maxWidth: 1280,
  margin: "0 auto",
  border: "1px solid #1e3a8a",
  borderRadius: 12,
  overflow: "hidden",
  background: "#000814",
};

const buttonStyle = {
  background: "#fbbf24",
  color: "#111827",
  border: "1px solid #f59e0b",
  borderRadius: 8,
  padding: "8px 12px",
  fontWeight: 700,
  cursor: "pointer",
};

export const BankingApp = () => {
  const [showEmbeddedTerminal, setShowEmbeddedTerminal] = useState(false);

  const openEmbeddedTerminal = () => {
    setShowEmbeddedTerminal(true);
  };

  const openModule = (target) => {
    navigateToApp(target);
  };

  if (showEmbeddedTerminal) {
    return (
      <main style={shellStyle}>
        <section style={panelStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 10,
              borderBottom: "1px solid #1e3a8a",
            }}
          >
            <strong>WASI Terminal (Embedded in Banking)</strong>
            <button
              type="button"
              style={buttonStyle}
              onClick={() => setShowEmbeddedTerminal(false)}
            >
              Retour Banking
            </button>
          </div>
          <iframe
            title="WASI Terminal Embedded"
            src="?app=wasi"
            style={{
              display: "block",
              width: "100%",
              height: "calc(100vh - 90px)",
              border: "none",
              background: "#020617",
            }}
          />
        </section>
      </main>
    );
  }

  return (
    <AfriTradeApp
      initialScreen="main"
      onOpenWasiTerminal={openEmbeddedTerminal}
      onOpenDex={() => openModule("dex")}
      onOpenAfriTax={() => openModule("afritax")}
      onOpenOhadaCompta={() => openModule("compta")}
      onExitAfriTrade={() => {
        setShowEmbeddedTerminal(false);
      }}
    />
  );
};
