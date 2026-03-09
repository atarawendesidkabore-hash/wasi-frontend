import { useCallback, useEffect, useMemo, useState } from "react";
import { navigateToApp } from "../platform/AppSwitcher";
import {
  getAppShellStyle,
  getPanelStyle,
  sharedPrimaryButtonStyle,
  sharedSecondaryButtonStyle,
  WASI_THEME,
} from "../platform/wasiTheme";
import { fetchComptaOverview } from "./comptaApi";
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

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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

const metricCardStyle = {
  border: `1px solid ${WASI_THEME.border}`,
  borderRadius: 12,
  padding: 12,
  background: "rgba(7,25,46,0.7)",
};

const sectionTitleStyle = {
  margin: 0,
  fontFamily: "'Bebas Neue', sans-serif",
  letterSpacing: 2,
  color: WASI_THEME.info,
  fontSize: 28,
};

export const OhadaComptaApp = () => {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const hasBankingSession =
    typeof window !== "undefined" &&
    Boolean(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY));

  const loadOverview = useCallback(async () => {
    if (!hasBankingSession) {
      setOverview(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const payload = await fetchComptaOverview();
      setOverview(payload);
    } catch (loadError) {
      setError(loadError.message || "Impossible de charger OHADA-Compta.");
    } finally {
      setLoading(false);
    }
  }, [hasBankingSession]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const openModule = useCallback((target) => {
    syncWasiTerminalSession();
    navigateToApp(target);
  }, []);

  const metrics = useMemo(() => {
    if (!overview) return [];
    return [
      {
        label: "Ecritures postees",
        value: String(overview.summary?.journalEntriesCount ?? 0),
        tone: WASI_THEME.info,
      },
      {
        label: "Comptes actifs",
        value: String(overview.summary?.activeAccountsCount ?? 0),
        tone: WASI_THEME.success,
      },
      {
        label: "Produits",
        value: formatXofFromCentimes(overview.summary?.revenueCentimes ?? "0"),
        tone: WASI_THEME.success,
      },
      {
        label: "Charges",
        value: formatXofFromCentimes(overview.summary?.expenseCentimes ?? "0"),
        tone: WASI_THEME.danger,
      },
      {
        label: "Resultat avant impot",
        value: formatXofFromCentimes(
          overview.summary?.preTaxResultCentimes ?? "0"
        ),
        tone: WASI_THEME.accent,
      },
      {
        label: "TVA nette",
        value: formatXofFromCentimes(overview.tax?.vatDueCentimes ?? "0"),
        tone: WASI_THEME.warning,
      },
    ];
  }, [overview]);

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
              OHADA-COMPTA
            </h1>
            <p style={{ margin: "6px 0 0", color: WASI_THEME.textMuted }}>
              Tableau de bord comptable SYSCOHADA relie a Banking, WASI,
              AfriTrade, AfriTax et ETF DEX.
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
              {hasBankingSession ? "SESSION CONNECTEE" : "LOGIN BANKING REQUIS"}
            </span>
            <button
              type="button"
              onClick={loadOverview}
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
            label="Ouvrir WASI Terminal"
            onClick={() => openModule("wasi")}
          />
          <BridgeButton
            label="Ouvrir AfriTrade"
            onClick={() => openModule("afritrade")}
          />
          <BridgeButton
            label="Ouvrir AfriTax"
            onClick={() => openModule("afritax")}
          />
          <BridgeButton
            label="Ouvrir Banking"
            onClick={() => openModule("banking")}
            subtle
          />
          <BridgeButton
            label="Ouvrir ETF DEX"
            onClick={() => openModule("dex")}
            subtle
          />
          <BridgeButton
            label="Ouvrir Finance Lab"
            onClick={() => openModule("finance")}
            subtle
          />
        </section>

        {!hasBankingSession ? (
          <section style={{ ...metricCardStyle, color: WASI_THEME.warning }}>
            Connectez-vous d'abord dans Banking pour charger le grand-livre,
            la balance et le pont fiscal.
          </section>
        ) : null}

        {error ? (
          <section style={{ ...metricCardStyle, color: WASI_THEME.danger }}>
            Erreur Compta: {error}
          </section>
        ) : null}

        {loading ? (
          <section style={metricCardStyle}>Chargement du module comptable...</section>
        ) : null}

        {!loading && overview ? (
          <>
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 10,
              }}
            >
              {metrics.map((metric) => (
                <article key={metric.label} style={metricCardStyle}>
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
                      fontSize: 28,
                      marginTop: 8,
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
                gridTemplateColumns: "1.4fr 1fr",
                gap: 16,
              }}
            >
              <article style={getPanelStyle()}>
                <h2 style={sectionTitleStyle}>Plan Comptable SYSCOHADA</h2>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 10,
                    marginTop: 12,
                  }}
                >
                  {(overview.chart?.classes || []).map((row) => (
                    <div key={row.classNumber} style={metricCardStyle}>
                      <div style={{ color: WASI_THEME.accent, fontWeight: 700 }}>
                        Classe {row.classNumber}
                      </div>
                      <div style={{ marginTop: 4 }}>{row.classLabel}</div>
                      <div
                        style={{
                          marginTop: 8,
                          color: WASI_THEME.textMuted,
                          fontSize: 12,
                        }}
                      >
                        Comptes actifs: {row.accountCount}
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article style={getPanelStyle()}>
                <h2 style={sectionTitleStyle}>Pont Ecosysteme</h2>
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    marginTop: 12,
                  }}
                >
                  <div style={metricCardStyle}>
                    <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>
                      Liquidite Banking
                    </div>
                    <div style={{ color: WASI_THEME.success, marginTop: 6 }}>
                      {formatXofFromCentimes(
                        overview.bridge?.bankLiquidityCentimes ?? "0"
                      )}
                    </div>
                  </div>
                  <div style={metricCardStyle}>
                    <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>
                      DEX AUM valorise
                    </div>
                    <div style={{ color: WASI_THEME.info, marginTop: 6 }}>
                      {formatXofFromCentimes(
                        overview.bridge?.dexAumCentimes ?? "0"
                      )}
                    </div>
                  </div>
                  <div style={metricCardStyle}>
                    <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>
                      Modules relies
                    </div>
                    <div style={{ marginTop: 6, color: WASI_THEME.accent }}>
                      {(overview.bridge?.modulesConnected || []).join(" / ")}
                    </div>
                  </div>
                </div>
              </article>
            </section>

            <section
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1fr",
                gap: 16,
              }}
            >
              <article style={getPanelStyle()}>
                <h2 style={sectionTitleStyle}>Journal Recent</h2>
                <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                  {(overview.journal || []).map((entry) => (
                    <article key={entry.id} style={metricCardStyle}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              color: WASI_THEME.accent,
                              fontWeight: 700,
                              letterSpacing: 1,
                            }}
                          >
                            {entry.reference}
                          </div>
                          <div style={{ marginTop: 4 }}>{entry.description}</div>
                        </div>
                        <div style={{ textAlign: "right", color: WASI_THEME.textMuted }}>
                          <div>{entry.moduleSource}</div>
                          <div style={{ marginTop: 4 }}>
                            {formatDateTime(entry.entryDateUtc)}
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 10,
                          marginTop: 10,
                          color: WASI_THEME.textMuted,
                          fontSize: 12,
                        }}
                      >
                        <div>
                          Debit: {formatXofFromCentimes(entry.totalDebitCentimes)}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          Credit: {formatXofFromCentimes(entry.totalCreditCentimes)}
                        </div>
                      </div>
                      <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                        {(entry.lines || []).map((line) => (
                          <div
                            key={`${entry.id}-${line.accountCode}-${line.lineLabel}`}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "110px 1fr 160px",
                              gap: 10,
                              fontSize: 12,
                              color: WASI_THEME.textPrimary,
                            }}
                          >
                            <span style={{ color: WASI_THEME.info }}>
                              {line.accountCode}
                            </span>
                            <span>{line.lineLabel}</span>
                            <span style={{ textAlign: "right" }}>
                              {line.debitCentimes !== "0"
                                ? `D ${formatXofFromCentimes(line.debitCentimes)}`
                                : `C ${formatXofFromCentimes(line.creditCentimes)}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </article>

              <article style={getPanelStyle()}>
                <h2 style={sectionTitleStyle}>Balance</h2>
                <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                  {(overview.trialBalance?.rows || []).map((row) => (
                    <div
                      key={row.code}
                      style={{
                        ...metricCardStyle,
                        padding: "10px 12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <div>
                          <div style={{ color: WASI_THEME.accent }}>
                            {row.code}
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12 }}>
                            {row.label}
                          </div>
                        </div>
                        <div
                          style={{
                            textAlign: "right",
                            color:
                              row.balanceSide === "DEBIT"
                                ? WASI_THEME.success
                                : row.balanceSide === "CREDIT"
                                  ? WASI_THEME.danger
                                  : WASI_THEME.textMuted,
                          }}
                        >
                          <div>{row.balanceSide}</div>
                          <div style={{ marginTop: 4 }}>
                            {formatXofFromCentimes(row.balanceCentimes)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
};
