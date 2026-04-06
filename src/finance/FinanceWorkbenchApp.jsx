import { useMemo, useState } from "react";
import { navigateToApp } from "../platform/AppSwitcher";
import {
  getAppShellStyle,
  getPanelStyle,
  sharedPrimaryButtonStyle,
  sharedSecondaryButtonStyle,
  WASI_THEME,
} from "../platform/wasiTheme";
import {
  allocationPlaybooks,
  benchmarkYears,
  buildWalgreensSignals,
  formatValue,
  frameworkWorkflow,
  getStatementYearSummary,
  marketCorrelationSignals,
  reusablePrompts,
  statementYears,
  strategicMarketUniverse,
  walgreensPeerBenchmarks,
  walgreensStatements,
} from "./financeFramework";

const routeLabelMap = {
  wasi: "WASI Terminal",
  banking: "Banking",
  afritrade: "AfriTrade",
  compta: "OHADA-Compta",
  afritax: "AfriTax",
  dex: "ETF DEX",
  finance: "Finance Lab",
};

const toneColorMap = {
  positive: WASI_THEME.success,
  negative: WASI_THEME.danger,
  warning: WASI_THEME.warning,
};

const chipStyle = (active) => ({
  borderRadius: 999,
  border: `1px solid ${active ? WASI_THEME.borderAccent : WASI_THEME.border}`,
  background: active ? WASI_THEME.accentSoft : "rgba(7,25,46,0.55)",
  color: active ? WASI_THEME.accent : WASI_THEME.textMuted,
  padding: "7px 12px",
  fontFamily: "inherit",
  cursor: "pointer",
});

const BridgeButton = ({ label, target, subtle = false }) => (
  <button
    type="button"
    onClick={() => navigateToApp(target)}
    style={subtle ? sharedSecondaryButtonStyle : sharedPrimaryButtonStyle}
  >
    {label}
  </button>
);

const SectionHeading = ({ title, note }) => (
  <div style={{ display: "grid", gap: 4 }}>
    <h2
      style={{
        margin: 0,
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 32,
        letterSpacing: 2,
        color: WASI_THEME.info,
      }}
    >
      {title}
    </h2>
    <p style={{ margin: 0, color: WASI_THEME.textMuted }}>{note}</p>
  </div>
);

const SurfaceCard = ({ children, accent = false }) => (
  <article
    style={{
      border: `1px solid ${accent ? WASI_THEME.borderAccent : WASI_THEME.border}`,
      borderRadius: 14,
      padding: 16,
      background: accent ? "rgba(240,180,41,0.08)" : "rgba(7,25,46,0.68)",
      display: "grid",
      gap: 10,
    }}
  >
    {children}
  </article>
);

const StatementCard = ({ block, selectedYear }) => (
  <SurfaceCard>
    <div>
      <div style={{ color: WASI_THEME.accent, fontWeight: 700, letterSpacing: 1 }}>{block.title}</div>
      <div style={{ color: WASI_THEME.textMuted, marginTop: 4, fontSize: 13 }}>{block.subtitle}</div>
    </div>
    <div style={{ display: "grid", gap: 8 }}>
      {block.lines.map((line) => (
        <div
          key={line.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            borderTop: `1px solid ${line.emphasis ? WASI_THEME.borderAccent : "rgba(30,58,95,0.45)"}`,
            paddingTop: 8,
          }}
        >
          <span style={{ color: line.emphasis ? WASI_THEME.textPrimary : WASI_THEME.textMuted }}>{line.label}</span>
          <strong style={{ color: line.tone ? toneColorMap[line.tone] : WASI_THEME.textPrimary }}>
            {formatValue(line.values[selectedYear], "currency")}
          </strong>
        </div>
      ))}
    </div>
  </SurfaceCard>
);

const BenchmarkTable = ({ group, benchmarkYear }) => (
  <SurfaceCard>
    <div style={{ color: WASI_THEME.accent, fontWeight: 700, letterSpacing: 1 }}>{group.title}</div>
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 460 }}>
        <thead>
          <tr style={{ textAlign: "left", color: WASI_THEME.textMuted }}>
            <th style={{ paddingBottom: 10 }}>Metric</th>
            <th style={{ paddingBottom: 10 }}>Walgreens</th>
            <th style={{ paddingBottom: 10 }}>Drugstores</th>
            <th style={{ paddingBottom: 10 }}>S&amp;P Industrials</th>
          </tr>
        </thead>
        <tbody>
          {group.metrics.map((metric) => {
            const row = metric.values[benchmarkYear];
            return (
              <tr key={metric.id} style={{ borderTop: "1px solid rgba(30,58,95,0.45)" }}>
                <td style={{ padding: "10px 0", color: WASI_THEME.textPrimary }}>{metric.label}</td>
                <td style={{ padding: "10px 0", color: WASI_THEME.success }}>
                  {formatValue(row.walgreens, metric.format)}
                </td>
                <td style={{ padding: "10px 0", color: WASI_THEME.textPrimary }}>
                  {formatValue(row.drugstores, metric.format)}
                </td>
                <td style={{ padding: "10px 0", color: WASI_THEME.textMuted }}>
                  {formatValue(row.spIndustrials, metric.format)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </SurfaceCard>
);

export const FinanceWorkbenchApp = () => {
  const [selectedYear, setSelectedYear] = useState(statementYears[0]);
  const [benchmarkYear, setBenchmarkYear] = useState(benchmarkYears[0]);

  const signals = useMemo(() => buildWalgreensSignals(), []);
  const summary = useMemo(() => getStatementYearSummary(selectedYear), [selectedYear]);

  return (
    <main style={getAppShellStyle()}>
      <section style={{ ...getPanelStyle(), maxWidth: 1380, margin: "0 auto", display: "grid", gap: 18 }}>
        <header style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6, maxWidth: 780 }}>
              <h1
                style={{
                  margin: 0,
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 48,
                  letterSpacing: 2,
                  color: WASI_THEME.accent,
                }}
              >
                WASI FINANCE LAB
              </h1>
              <p style={{ margin: 0, color: WASI_THEME.textPrimary, lineHeight: 1.5 }}>
                The platform now combines a Walgreens three-statement analysis framework with a strategic
                investment mix built from CAC 40, Copper, Gold, and GLD market files. This gives WASI one
                reusable workspace for company performance, market regime reading, and final decision memos.
              </p>
            </div>

            <SurfaceCard accent>
              <div style={{ color: WASI_THEME.accent, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>
                Framework mission
              </div>
              <div style={{ color: WASI_THEME.textPrimary, fontWeight: 700 }}>
                Move from raw statements and market files to a clear operating, risk, and allocation view.
              </div>
              <div style={{ color: WASI_THEME.textMuted, fontSize: 13, lineHeight: 1.5 }}>
                Use OHADA-Compta for normalization, AfriTax for tax review, Banking for liquidity, ETF DEX
                for peer context, and WASI Terminal for the final memo.
              </div>
            </SurfaceCard>
          </div>

          <section
            style={{
              border: `1px solid ${WASI_THEME.border}`,
              borderRadius: 12,
              background: WASI_THEME.panelBackgroundSoft,
              padding: 14,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
            }}
          >
            <BridgeButton label="Open OHADA-Compta" target="compta" />
            <BridgeButton label="Open AfriTax" target="afritax" />
            <BridgeButton label="Open Banking" target="banking" />
            <BridgeButton label="Open ETF DEX" target="dex" subtle />
            <BridgeButton label="Open WASI Terminal" target="wasi" subtle />
          </section>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
          {signals.map((signal) => (
            <SurfaceCard key={signal.id} accent={signal.tone === "warning"}>
              <div style={{ color: WASI_THEME.textMuted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
                {signal.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: signal.tone === "warning" ? WASI_THEME.warning : WASI_THEME.textPrimary }}>
                {signal.value}
              </div>
              <div style={{ color: WASI_THEME.textMuted, fontSize: 13, lineHeight: 1.5 }}>{signal.detail}</div>
            </SurfaceCard>
          ))}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(280px, 0.9fr)", gap: 16 }}>
          <section style={{ ...getPanelStyle(), display: "grid", gap: 14 }}>
            <SectionHeading
              title="Statement Lens"
              note="Keep the balance sheet, earnings, and cash flow statement aligned by year."
            />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {statementYears.map((year) => (
                <button key={year} type="button" onClick={() => setSelectedYear(year)} style={chipStyle(selectedYear === year)}>
                  FY {year}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              {walgreensStatements.map((block) => (
                <StatementCard key={block.id} block={block} selectedYear={selectedYear} />
              ))}
            </div>
          </section>

          <section style={{ ...getPanelStyle(), display: "grid", gap: 14 }}>
            <SectionHeading title="Year Snapshot" note="Fast readout for the active reporting year." />

            <SurfaceCard>
              <div style={{ color: WASI_THEME.accent, fontWeight: 700 }}>Balance</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <div>
                  <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>Cash</div>
                  <div>{formatValue(summary.balance.cash, "currency")}</div>
                </div>
                <div>
                  <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>Equity</div>
                  <div>{formatValue(summary.balance.equity, "currency")}</div>
                </div>
                <div>
                  <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>Current assets</div>
                  <div>{formatValue(summary.balance.currentAssets, "currency")}</div>
                </div>
                <div>
                  <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>Total assets</div>
                  <div>{formatValue(summary.balance.totalAssets, "currency")}</div>
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard>
              <div style={{ color: WASI_THEME.accent, fontWeight: 700 }}>Earnings</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <div>
                  <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>Net sales</div>
                  <div>{formatValue(summary.earnings.netSales, "currency")}</div>
                </div>
                <div>
                  <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>Gross profit</div>
                  <div>{formatValue(summary.earnings.grossProfit, "currency")}</div>
                </div>
                <div>
                  <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>EBIT</div>
                  <div>{formatValue(summary.earnings.ebit, "currency")}</div>
                </div>
                <div>
                  <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>Net income</div>
                  <div>{formatValue(summary.earnings.netIncome, "currency")}</div>
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard>
              <div style={{ color: WASI_THEME.accent, fontWeight: 700 }}>Cash flow</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <div>
                  <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>Operating cash flow</div>
                  <div>{formatValue(summary.cashFlow.operatingCashFlow, "currency")}</div>
                </div>
                <div>
                  <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>Capex</div>
                  <div>{formatValue(summary.cashFlow.capex, "currency")}</div>
                </div>
                <div>
                  <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>Financing cash flow</div>
                  <div>{formatValue(summary.cashFlow.financingCashFlow, "currency")}</div>
                </div>
                <div>
                  <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>Ending cash</div>
                  <div>{formatValue(summary.cashFlow.endingCash, "currency")}</div>
                </div>
              </div>
            </SurfaceCard>
          </section>
        </section>

        <section style={{ ...getPanelStyle(), display: "grid", gap: 14 }}>
          <SectionHeading
            title="Benchmark Lens"
            note="Peer ratios structured so the same layout can be reused with future company cases."
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {benchmarkYears.map((year) => (
              <button key={year} type="button" onClick={() => setBenchmarkYear(year)} style={chipStyle(benchmarkYear === year)}>
                Benchmark {year}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            {walgreensPeerBenchmarks.map((group) => (
              <BenchmarkTable key={group.id} group={group} benchmarkYear={benchmarkYear} />
            ))}
          </div>
        </section>

        <section style={{ ...getPanelStyle(), display: "grid", gap: 14 }}>
          <SectionHeading
            title="Strategic Investment Mix"
            note="Market context generated from your CAC 40, Copper, Gold, and GLD history files."
          />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {strategicMarketUniverse.map((asset) => (
              <SurfaceCard key={asset.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ color: WASI_THEME.accent, fontWeight: 700 }}>{asset.label}</div>
                  <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>{asset.window}</div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{asset.latestPrice}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                  <div>
                    <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>Period return</div>
                    <div style={{ color: asset.periodReturnPct >= 0 ? WASI_THEME.success : WASI_THEME.danger }}>
                      {formatValue(asset.periodReturnPct, "percent")}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>Daily volatility</div>
                    <div>{formatValue(asset.dailyVolatilityPct, "percent")}</div>
                  </div>
                  <div>
                    <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>Start price</div>
                    <div>{asset.startPrice}</div>
                  </div>
                  <div>
                    <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>Average daily change</div>
                    <div>{formatValue(asset.averageDailyChangePct, "percent")}</div>
                  </div>
                </div>
                <div style={{ color: WASI_THEME.textMuted, fontSize: 13 }}>
                  Range: {asset.lowPrice} to {asset.highPrice}
                </div>
                <div style={{ color: WASI_THEME.textPrimary, lineHeight: 1.5 }}>{asset.thesis}</div>
                <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>Source: {asset.source}</div>
              </SurfaceCard>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 12 }}>
            <SurfaceCard>
              <div style={{ color: WASI_THEME.accent, fontWeight: 700 }}>Correlation reads</div>
              <div style={{ display: "grid", gap: 10 }}>
                {marketCorrelationSignals.map((signal) => (
                  <div
                    key={signal.pair}
                    style={{
                      borderTop: "1px solid rgba(30,58,95,0.45)",
                      paddingTop: 10,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span>{signal.pair}</span>
                      <strong style={{ color: WASI_THEME.success }}>{signal.correlation.toFixed(3)}</strong>
                    </div>
                    <div style={{ color: WASI_THEME.textMuted, fontSize: 13, lineHeight: 1.5 }}>{signal.takeaway}</div>
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard>
              <div style={{ color: WASI_THEME.accent, fontWeight: 700 }}>Allocation playbooks</div>
              <div style={{ display: "grid", gap: 10 }}>
                {allocationPlaybooks.map((playbook) => (
                  <div
                    key={playbook.id}
                    style={{
                      borderTop: "1px solid rgba(30,58,95,0.45)",
                      paddingTop: 10,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <div style={{ color: WASI_THEME.textPrimary, fontWeight: 700 }}>{playbook.title}</div>
                    <div style={{ color: WASI_THEME.textPrimary, lineHeight: 1.5 }}>{playbook.angle}</div>
                    <div style={{ color: WASI_THEME.textMuted, fontSize: 13, lineHeight: 1.5 }}>{playbook.moves}</div>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(300px, 0.9fr)", gap: 16 }}>
          <section style={{ ...getPanelStyle(), display: "grid", gap: 14 }}>
            <SectionHeading
              title="Framework Flow"
              note="This is the repeatable sequence for future term-platform analyses."
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {frameworkWorkflow.map((stage, index) => (
                <SurfaceCard key={stage.id}>
                  <div style={{ color: WASI_THEME.textMuted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
                    Step {index + 1}
                  </div>
                  <div style={{ color: WASI_THEME.accent, fontWeight: 700 }}>{stage.title}</div>
                  <div style={{ color: WASI_THEME.textPrimary, lineHeight: 1.5 }}>{stage.description}</div>
                  <div style={{ color: WASI_THEME.textMuted, fontSize: 13 }}>Output: {stage.output}</div>
                  <button
                    type="button"
                    onClick={() => navigateToApp(stage.route)}
                    style={{ ...sharedSecondaryButtonStyle, border: `1px solid ${WASI_THEME.borderAccent}` }}
                  >
                    Open {routeLabelMap[stage.route]}
                  </button>
                </SurfaceCard>
              ))}
            </div>
          </section>

          <section style={{ ...getPanelStyle(), display: "grid", gap: 14 }}>
            <SectionHeading
              title="Reuse Prompts"
              note="Use these when you swap in another company pack or new market files."
            />
            <div style={{ display: "grid", gap: 10 }}>
              {reusablePrompts.map((prompt) => (
                <SurfaceCard key={prompt}>
                  <div style={{ color: WASI_THEME.textPrimary, lineHeight: 1.5 }}>{prompt}</div>
                </SurfaceCard>
              ))}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
};
