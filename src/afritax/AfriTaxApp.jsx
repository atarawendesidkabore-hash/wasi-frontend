import { useCallback, useEffect, useMemo, useState } from "react";
import { navigateToApp } from "../platform/AppSwitcher";
import {
  getAppShellStyle,
  getPanelStyle,
  sharedPrimaryButtonStyle,
  sharedSecondaryButtonStyle,
  WASI_THEME,
} from "../platform/wasiTheme";
import { fetchAfriTaxSummary } from "../compta/comptaApi";
import { syncWasiTerminalSession } from "../banking/bankingApi";

const ACCESS_TOKEN_STORAGE_KEY = "WASI_BANKING_ACCESS_TOKEN";

const formatXofFromCentimes = (value) => {
  const numeric = Number(value || 0) / 100;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numeric);
};

const BridgeButton = ({ label, onClick, subtle = false }) => (
  <button
    type="button"
    onClick={onClick}
    style={subtle ? sharedSecondaryButtonStyle : sharedPrimaryButtonStyle}
  >
    {label}
  </button>
);

const infoCardStyle = {
  border: `1px solid ${WASI_THEME.border}`,
  borderRadius: 12,
  padding: 12,
  background: "rgba(7,25,46,0.7)",
};

export const AfriTaxApp = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const hasBankingSession =
    typeof window !== "undefined" &&
    Boolean(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY));

  const loadSummary = useCallback(async () => {
    if (!hasBankingSession) {
      setSummary(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const payload = await fetchAfriTaxSummary();
      setSummary(payload);
    } catch (loadError) {
      setError(loadError.message || "Impossible de charger AfriTax.");
    } finally {
      setLoading(false);
    }
  }, [hasBankingSession]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const route = useCallback((target) => {
    syncWasiTerminalSession();
    navigateToApp(target);
  }, []);

  const metrics = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: "TVA collectee",
        value: formatXofFromCentimes(summary.outputVatCentimes),
        tone: WASI_THEME.warning,
      },
      {
        label: "TVA deductible",
        value: formatXofFromCentimes(summary.inputVatCentimes),
        tone: WASI_THEME.info,
      },
      {
        label: "TVA nette due",
        value: formatXofFromCentimes(summary.vatDueCentimes),
        tone: WASI_THEME.danger,
      },
      {
        label: "Resultat avant impot",
        value: formatXofFromCentimes(summary.preTaxResultCentimes),
        tone: WASI_THEME.success,
      },
    ];
  }, [summary]);

  return (
    <main style={getAppShellStyle()}>
      <section
        style={{
          ...getPanelStyle(),
          maxWidth: 1360,
          margin: "0 auto",
          display: "grid",
          gap: 16,
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 46,
                letterSpacing: 2,
                color: WASI_THEME.accent,
              }}
            >
              AFRITAX
            </h1>
            <p style={{ margin: "6px 0 0", color: WASI_THEME.textMuted }}>
              Console fiscale reliee a OHADA-Compta, AfriTrade, Banking et WASI
              Terminal.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span
              style={{
                border: `1px solid ${
                  hasBankingSession ? WASI_THEME.success : WASI_THEME.warning
                }`,
                color: hasBankingSession
                  ? WASI_THEME.success
                  : WASI_THEME.warning,
                borderRadius: 999,
                padding: "6px 10px",
                fontSize: 12,
                letterSpacing: 1,
              }}
            >
              {hasBankingSession ? "FLUX COMPTABLE ACTIF" : "SESSION ABSENTE"}
            </span>
            <button
              type="button"
              onClick={loadSummary}
              style={sharedSecondaryButtonStyle}
            >
              Actualiser
            </button>
          </div>
        </header>

        <section
          style={{
            border: `1px solid ${WASI_THEME.border}`,
            borderRadius: 12,
            background: WASI_THEME.panelBackgroundSoft,
            padding: 14,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 10,
          }}
        >
          <BridgeButton
            label="Ouvrir OHADA-Compta"
            onClick={() => route("compta")}
          />
          <BridgeButton
            label="Ouvrir AfriTrade"
            onClick={() => route("afritrade")}
          />
          <BridgeButton
            label="Ouvrir Banking"
            onClick={() => route("banking")}
            subtle
          />
          <BridgeButton
            label="Ouvrir WASI Terminal"
            onClick={() => route("wasi")}
            subtle
          />
        </section>

        {!hasBankingSession ? (
          <section style={{ ...infoCardStyle, color: WASI_THEME.warning }}>
            Connectez-vous dans Banking pour charger les indicateurs fiscaux
            derives de la comptabilite.
          </section>
        ) : null}

        {error ? (
          <section style={{ ...infoCardStyle, color: WASI_THEME.danger }}>
            Erreur AfriTax: {error}
          </section>
        ) : null}

        {loading ? (
          <section style={infoCardStyle}>Chargement des donnees fiscales...</section>
        ) : null}

        {!loading && summary ? (
          <>
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 10,
              }}
            >
              {metrics.map((metric) => (
                <article key={metric.label} style={infoCardStyle}>
                  <div
                    style={{
                      color: WASI_THEME.textMuted,
                      fontSize: 12,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                    }}
                  >
                    {metric.label}
                  </div>
                  <div
                    style={{
                      color: metric.tone,
                      marginTop: 8,
                      fontSize: 28,
                      fontFamily: "'Bebas Neue', sans-serif",
                      letterSpacing: 1,
                    }}
                  >
                    {metric.value}
                  </div>
                </article>
              ))}
            </section>

            <section
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr",
                gap: 16,
              }}
            >
              <article style={getPanelStyle()}>
                <h2
                  style={{
                    margin: 0,
                    fontFamily: "'Bebas Neue', sans-serif",
                    letterSpacing: 2,
                    color: WASI_THEME.info,
                    fontSize: 28,
                  }}
                >
                  Calendrier Fiscal
                </h2>
                <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                  {(summary.filingCalendar || []).map((item) => (
                    <div key={item.code} style={infoCardStyle}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <div style={{ color: WASI_THEME.accent, fontWeight: 700 }}>
                            {item.code}
                          </div>
                          <div style={{ marginTop: 4 }}>{item.label}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ color: WASI_THEME.textMuted }}>
                            Echeance
                          </div>
                          <div style={{ marginTop: 4 }}>{item.dueDate}</div>
                        </div>
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          color:
                            item.status === "A_PREPARER"
                              ? WASI_THEME.warning
                              : item.status === "SURVEILLANCE"
                                ? WASI_THEME.danger
                                : WASI_THEME.success,
                        }}
                      >
                        {item.status}
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article style={getPanelStyle()}>
                <h2
                  style={{
                    margin: 0,
                    fontFamily: "'Bebas Neue', sans-serif",
                    letterSpacing: 2,
                    color: WASI_THEME.info,
                    fontSize: 28,
                  }}
                >
                  Bridge Compta
                </h2>
                <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                  <div style={infoCardStyle}>
                    <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>
                      Modules relies
                    </div>
                    <div style={{ marginTop: 8, color: WASI_THEME.accent }}>
                      {(summary.bridge?.modulesConnected || []).join(" / ")}
                    </div>
                  </div>
                  <div style={infoCardStyle}>
                    <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>
                      Liquidite Banking
                    </div>
                    <div style={{ marginTop: 8, color: WASI_THEME.success }}>
                      {formatXofFromCentimes(
                        summary.bridge?.bankLiquidityCentimes ?? "0"
                      )}
                    </div>
                  </div>
                  <div style={infoCardStyle}>
                    <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>
                      DEX AUM valorise
                    </div>
                    <div style={{ marginTop: 8, color: WASI_THEME.info }}>
                      {formatXofFromCentimes(
                        summary.bridge?.dexAumCentimes ?? "0"
                      )}
                    </div>
                  </div>
                </div>
              </article>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
};
