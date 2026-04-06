export const statementYears = ["2004", "2003", "2002"] as const;
export type StatementYear = (typeof statementYears)[number];

export const benchmarkYears = ["2003", "2002"] as const;
export type BenchmarkYear = (typeof benchmarkYears)[number];

export type ValueFormat = "currency" | "percent" | "multiple" | "days" | "shares";

type NumericSeries<T extends string> = Record<T, number>;

export interface StatementLine {
  id: string;
  label: string;
  values: NumericSeries<StatementYear>;
  emphasis?: boolean;
  tone?: "positive" | "negative";
}

export interface StatementBlock {
  id: string;
  title: string;
  subtitle: string;
  unit: string;
  lines: StatementLine[];
}

export interface BenchmarkMetric {
  id: string;
  label: string;
  format: Exclude<ValueFormat, "currency" | "shares">;
  values: Record<
    BenchmarkYear,
    {
      walgreens: number;
      drugstores: number;
      spIndustrials: number;
    }
  >;
}

export interface BenchmarkGroup {
  id: string;
  title: string;
  metrics: BenchmarkMetric[];
}

export interface FrameworkSignal {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone?: "positive" | "warning";
}

export interface WorkflowStage {
  id: string;
  title: string;
  description: string;
  output: string;
  route: "wasi" | "banking" | "afritrade" | "compta" | "afritax" | "dex" | "finance";
}

export interface MarketAssetSummary {
  id: string;
  label: string;
  source: string;
  window: string;
  latestPrice: string;
  startPrice: string;
  periodReturnPct: number;
  averageDailyChangePct: number;
  dailyVolatilityPct: number;
  lowPrice: string;
  highPrice: string;
  thesis: string;
}

export interface MarketCorrelationSignal {
  pair: string;
  correlation: number;
  takeaway: string;
}

export interface AllocationPlaybook {
  id: string;
  title: string;
  angle: string;
  moves: string;
}

export const walgreensBalanceSheet: StatementBlock = {
  id: "balance",
  title: "Balance Sheet",
  subtitle: "Liquidity, capital structure, and asset base",
  unit: "$m",
  lines: [
    { id: "cash", label: "Cash and cash equivalents", values: { "2004": 1596, "2003": 1268, "2002": 450 } },
    { id: "receivables", label: "Accounts receivable", values: { "2004": 1169, "2003": 1018, "2002": 955 } },
    { id: "inventories", label: "Inventories", values: { "2004": 4739, "2003": 4203, "2002": 3645 } },
    {
      id: "currentAssets",
      label: "Total current assets",
      values: { "2004": 7765, "2003": 6610, "2002": 5167 },
      emphasis: true,
    },
    { id: "ppeNet", label: "Property, plant, and equipment, net", values: { "2004": 5446, "2003": 4940, "2002": 4591 } },
    {
      id: "totalAssets",
      label: "Total assets",
      values: { "2004": 13342, "2003": 11658, "2002": 9879 },
      emphasis: true,
    },
    {
      id: "currentLiabilities",
      label: "Total current liabilities",
      values: { "2004": 4078, "2003": 3672, "2002": 2955 },
      emphasis: true,
      tone: "negative",
    },
    { id: "deferredTaxes", label: "Deferred income taxes", values: { "2004": 328, "2003": 228, "2002": 177 } },
    {
      id: "otherNonCurrentLiabilities",
      label: "Other noncurrent liabilities",
      values: { "2004": 709, "2003": 562, "2002": 517 },
      tone: "negative",
    },
    {
      id: "equity",
      label: "Total shareholders' equity",
      values: { "2004": 8227, "2003": 7196, "2002": 6230 },
      emphasis: true,
      tone: "positive",
    },
  ],
};

export const walgreensIncomeStatement: StatementBlock = {
  id: "earnings",
  title: "Earnings",
  subtitle: "Scale, margin, and shareholder returns",
  unit: "$m",
  lines: [
    { id: "netSales", label: "Net sales", values: { "2004": 37508, "2003": 32505, "2002": 28681 }, emphasis: true },
    { id: "costOfSales", label: "Cost of sales", values: { "2004": 27310, "2003": 23706, "2002": 21076 }, tone: "negative" },
    { id: "grossProfit", label: "Gross profit", values: { "2004": 10198, "2003": 8799, "2002": 7605 }, emphasis: true, tone: "positive" },
    {
      id: "operatingExpense",
      label: "Selling, occupancy, and admin expense",
      values: { "2004": 8055, "2003": 6951, "2002": 5981 },
      tone: "negative",
    },
    { id: "ebit", label: "Operating profit (EBIT)", values: { "2004": 2143, "2003": 1848, "2002": 1624 }, emphasis: true, tone: "positive" },
    { id: "preTaxIncome", label: "Operating income before taxes", values: { "2004": 2176, "2003": 1889, "2002": 1637 }, tone: "positive" },
    { id: "taxProvision", label: "Provision for income taxes", values: { "2004": 816, "2003": 713, "2002": 618 }, tone: "negative" },
    { id: "netIncome", label: "Reported net income", values: { "2004": 1360, "2003": 1176, "2002": 1019 }, emphasis: true, tone: "positive" },
    { id: "eps", label: "EPS (USD)", values: { "2004": 1.33, "2003": 1.14, "2002": 0.99 } },
    { id: "dividendPerShare", label: "Dividend per share (USD)", values: { "2004": 0.18, "2003": 0.16, "2002": 0.15 } },
  ],
};

export const walgreensCashFlow: StatementBlock = {
  id: "cashflow",
  title: "Cash Flow",
  subtitle: "Cash conversion, capex, and financing discipline",
  unit: "$m",
  lines: [
    { id: "netIncome", label: "Net income", values: { "2004": 1360, "2003": 1176, "2002": 1019 } },
    { id: "depreciation", label: "Depreciation and amortization", values: { "2004": 403, "2003": 346, "2002": 307 } },
    { id: "inventoryChange", label: "Change in inventories", values: { "2004": -536, "2003": -558, "2002": -163 }, tone: "negative" },
    { id: "receivablesChange", label: "Change in accounts receivable", values: { "2004": -172, "2003": -57, "2002": -171 }, tone: "negative" },
    { id: "payablesChange", label: "Change in trade accounts payable", values: { "2004": 234, "2003": 295, "2002": 254 }, tone: "positive" },
    {
      id: "operatingCashFlow",
      label: "Net cash from operating activities",
      values: { "2004": 1653, "2003": 1500, "2002": 1504 },
      emphasis: true,
      tone: "positive",
    },
    { id: "capex", label: "Additions to property and equipment", values: { "2004": -940, "2003": -795, "2002": -934 }, tone: "negative" },
    {
      id: "investingCashFlow",
      label: "Net cash from investing activities",
      values: { "2004": -925, "2003": -702, "2002": -552 },
      emphasis: true,
      tone: "negative",
    },
    { id: "financingCashFlow", label: "Net cash from financing activities", values: { "2004": -302, "2003": -222, "2002": -488 }, tone: "negative" },
    { id: "endingCash", label: "Cash and cash equivalents at year end", values: { "2004": 1596, "2003": 1268, "2002": 688 }, emphasis: true, tone: "positive" },
  ],
};

export const walgreensStatements = [walgreensBalanceSheet, walgreensIncomeStatement, walgreensCashFlow];

export const walgreensPeerBenchmarks: BenchmarkGroup[] = [
  {
    id: "liquidity",
    title: "Liquidity and working capital",
    metrics: [
      { id: "currentRatio", label: "Current ratio", format: "multiple", values: { "2003": { walgreens: 1.8, drugstores: 1.82, spIndustrials: 1.43 }, "2002": { walgreens: 1.75, drugstores: 1.81, spIndustrials: 1.36 } } },
      { id: "quickRatio", label: "Quick ratio", format: "multiple", values: { "2003": { walgreens: 0.62, drugstores: 0.56, spIndustrials: 1.05 }, "2002": { walgreens: 0.48, drugstores: 0.47, spIndustrials: 0.9 } } },
      { id: "receivablesTurnover", label: "Receivables turnover", format: "multiple", values: { "2003": { walgreens: 32.95, drugstores: 38.3, spIndustrials: 4.43 }, "2002": { walgreens: 32.72, drugstores: 27.54, spIndustrials: 4.24 } } },
      { id: "collectionPeriod", label: "Average collection period", format: "days", values: { "2003": { walgreens: 11.08, drugstores: 9.53, spIndustrials: 82.4 }, "2002": { walgreens: 11.2, drugstores: 13.3, spIndustrials: 86.1 } } },
    ],
  },
  {
    id: "performance",
    title: "Operating performance",
    metrics: [
      { id: "assetTurnover", label: "Total asset turnover", format: "multiple", values: { "2003": { walgreens: 3.02, drugstores: 4.01, spIndustrials: 0.79 }, "2002": { walgreens: 3.07, drugstores: 2.8, spIndustrials: 0.76 } } },
      { id: "operatingMargin", label: "Operating profit margin", format: "percent", values: { "2003": { walgreens: 5.81, drugstores: 5.29, spIndustrials: 9.76 }, "2002": { walgreens: 5.71, drugstores: 5.41, spIndustrials: 12.81 } } },
      { id: "netMargin", label: "Net profit margin", format: "percent", values: { "2003": { walgreens: 3.62, drugstores: 2.4, spIndustrials: 6.35 }, "2002": { walgreens: 3.55, drugstores: 3.29, spIndustrials: 7.07 } } },
      { id: "roe", label: "Return on owners' equity", format: "percent", values: { "2003": { walgreens: 17.52, drugstores: 16.47, spIndustrials: 22.93 }, "2002": { walgreens: 17.82, drugstores: 16.64, spIndustrials: 16.8 } } },
    ],
  },
  {
    id: "risk",
    title: "Financial risk and resilience",
    metrics: [
      { id: "debtEquity", label: "Debt-equity ratio", format: "percent", values: { "2003": { walgreens: 143.05, drugstores: 15.33, spIndustrials: 157.03 }, "2002": { walgreens: 126.43, drugstores: 17.82, spIndustrials: 139.93 } } },
      { id: "interestCoverage", label: "Interest coverage", format: "multiple", values: { "2003": { walgreens: 5.77, drugstores: 60.95, spIndustrials: 6.21 }, "2002": { walgreens: 6.45, drugstores: 49.18, spIndustrials: 6.66 } } },
      { id: "cashFlowToDebt", label: "Cash flow to total debt", format: "percent", values: { "2003": { walgreens: 13.3, drugstores: 22.26, spIndustrials: 19.2 }, "2002": { walgreens: 16.5, drugstores: 26.16, spIndustrials: 17.11 } } },
      { id: "sustainableGrowth", label: "Sustainable growth rate", format: "percent", values: { "2003": { walgreens: 14.05, drugstores: 13.39, spIndustrials: 9.45 }, "2002": { walgreens: 13.96, drugstores: 13.18, spIndustrials: 12.77 } } },
    ],
  },
];

export const frameworkWorkflow: WorkflowStage[] = [
  { id: "capture", title: "Capture and normalize", description: "Load three years of balance sheet, earnings, and cash flow data in a single structure.", output: "Clean statement base for reuse across the platform.", route: "compta" },
  { id: "tax", title: "Stress tax and policy lines", description: "Review tax provision, deferred taxes, and timing effects before ratio interpretation.", output: "Adjusted profit bridge and tax watchlist.", route: "afritax" },
  { id: "cash", title: "Test liquidity and funding", description: "Trace working capital, cash conversion, and financing needs against the operating plan.", output: "Treasury and covenant view for the Banking module.", route: "banking" },
  { id: "market", title: "Benchmark against peers", description: "Compare turnover, margin, leverage, and growth to sector and market references.", output: "Relative performance pack for DEX and investor views.", route: "dex" },
  { id: "memo", title: "Write the decision memo", description: "Turn the numbers into a short buy, lend, or improve recommendation with explicit risks.", output: "Board memo or investment note in WASI Terminal.", route: "wasi" },
];

export const reusablePrompts = [
  "What changed in working capital and why did it help or hurt cash generation?",
  "Is margin expansion coming from pricing, mix, or cost discipline?",
  "Can the company fund capex and dividends from operations without new debt?",
  "Which ratios beat sector peers, and which ones still lag the market?",
  "What one-page investment or credit thesis would you write from this dataset?",
];

export const strategicMarketUniverse: MarketAssetSummary[] = [
  {
    id: "cac40",
    label: "CAC 40",
    source: "CAC 40 Historical Data.csv",
    window: "2020-01 to 2025-10",
    latestPrice: "8,196.32",
    startPrice: "5,806.34",
    periodReturnPct: 41.16,
    averageDailyChangePct: 0.58,
    dailyVolatilityPct: 5.15,
    lowPrice: "4,396.12",
    highPrice: "8,205.81",
    thesis: "European equity beta recovered strongly, but still trails the precious-metals hedge basket over the same window.",
  },
  {
    id: "copper",
    label: "Copper Futures",
    source: "Copper Futures Historical Data.csv",
    window: "2023-11 to 2025-10",
    latestPrice: "5.2658",
    startPrice: "3.8505",
    periodReturnPct: 36.76,
    averageDailyChangePct: 1.75,
    dailyVolatilityPct: 6.46,
    lowPrice: "3.8470",
    highPrice: "5.2658",
    thesis: "Copper is the cyclical signal in the mix: higher return beta and the highest daily volatility of the set.",
  },
  {
    id: "gold",
    label: "Gold Futures",
    source: "Gold Futures Historical Data.csv",
    window: "2020-01 to 2025-10",
    latestPrice: "4,021.35",
    startPrice: "1,587.90",
    periodReturnPct: 153.25,
    averageDailyChangePct: 1.48,
    dailyVolatilityPct: 4.18,
    lowPrice: "1,566.70",
    highPrice: "4,021.35",
    thesis: "Gold carried the strongest total return with lower daily volatility than copper, making it the hedge anchor.",
  },
  {
    id: "gld",
    label: "GLD ETF",
    source: "GLD ETF Stock Price History.csv",
    window: "2020-01 to 2025-10",
    latestPrice: "367.56",
    startPrice: "149.33",
    periodReturnPct: 146.14,
    averageDailyChangePct: 1.45,
    dailyVolatilityPct: 4.26,
    lowPrice: "148.05",
    highPrice: "367.56",
    thesis: "GLD tracks the gold regime closely and gives you the listed-equity wrapper for the same protection trade.",
  },
];

export const marketCorrelationSignals: MarketCorrelationSignal[] = [
  {
    pair: "Gold vs GLD",
    correlation: 0.978,
    takeaway: "Use one as the hedge expression and the other as confirmation, not as independent diversification.",
  },
  {
    pair: "Copper vs GLD",
    correlation: 0.439,
    takeaway: "Commodity beta and hedge assets can rise together in reflationary periods, but the link is only moderate.",
  },
  {
    pair: "Copper vs CAC 40",
    correlation: 0.191,
    takeaway: "Industrial demand helps European equities, though the relationship is not strong enough to treat copper as a pure equity proxy.",
  },
  {
    pair: "CAC 40 vs Gold",
    correlation: 0.004,
    takeaway: "The near-zero read is useful for allocation design when you want equity risk plus an offsetting defensive sleeve.",
  },
];

export const allocationPlaybooks: AllocationPlaybook[] = [
  {
    id: "hedge",
    title: "Defensive inflation hedge",
    angle: "Lead with Gold or GLD, then add CAC 40 selectively for equity carry.",
    moves: "Use when macro uncertainty is high and you want protection without leaving the market entirely.",
  },
  {
    id: "cycle",
    title: "Industrial upcycle watch",
    angle: "Pair CAC 40 with Copper when growth and industrial demand are both improving.",
    moves: "Use copper as the confirmation asset before increasing cyclical equity risk.",
  },
  {
    id: "switchboard",
    title: "Regime switchboard",
    angle: "Watch divergence between CAC 40 and Gold or GLD to spot risk-on versus flight-to-safety rotations.",
    moves: "Translate the signal into treasury, hedging, and valuation assumptions across the rest of the WASI stack.",
  },
];

const findLine = (block: StatementBlock, lineId: string) => {
  const line = block.lines.find((entry) => entry.id === lineId);
  if (!line) {
    throw new Error(`Missing statement line: ${block.id}.${lineId}`);
  }
  return line;
};

const getValue = (block: StatementBlock, lineId: string, year: StatementYear) =>
  findLine(block, lineId).values[year];

export const formatValue = (value: number, format: ValueFormat) => {
  if (format === "currency") {
    const absolute = Math.abs(value);
    const rendered = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: absolute >= 100 ? 0 : 1,
      minimumFractionDigits: absolute < 10 && absolute % 1 !== 0 ? 1 : 0,
    }).format(absolute);
    return value < 0 ? `-$${rendered}m` : `$${rendered}m`;
  }
  if (format === "percent") return `${value.toFixed(2)}%`;
  if (format === "days") return `${value.toFixed(2)}d`;
  if (format === "shares") return `${value.toFixed(0)}m`;
  return `${value.toFixed(value >= 10 ? 1 : 2)}x`;
};

export const computeWorkingCapital = (year: StatementYear) =>
  getValue(walgreensBalanceSheet, "currentAssets", year) - getValue(walgreensBalanceSheet, "currentLiabilities", year);

export const computeFreeCashFlow = (year: StatementYear) =>
  getValue(walgreensCashFlow, "operatingCashFlow", year) - Math.abs(getValue(walgreensCashFlow, "capex", year));

export const computeCashConversion = (year: StatementYear) =>
  getValue(walgreensCashFlow, "operatingCashFlow", year) / getValue(walgreensIncomeStatement, "netIncome", year);

export const computeOperatingMargin = (year: StatementYear) =>
  (getValue(walgreensIncomeStatement, "ebit", year) / getValue(walgreensIncomeStatement, "netSales", year)) * 100;

export const computeGrowthRate = (block: StatementBlock, lineId: string, latestYear: StatementYear, baseYear: StatementYear) => {
  const latest = getValue(block, lineId, latestYear);
  const base = getValue(block, lineId, baseYear);
  return ((latest - base) / base) * 100;
};

export const buildWalgreensSignals = (): FrameworkSignal[] => [
  {
    id: "salesGrowth",
    label: "Sales growth (2002-2004)",
    value: formatValue(computeGrowthRate(walgreensIncomeStatement, "netSales", "2004", "2002"), "percent"),
    detail: "Scale expanded faster than the asset base, which supports the turnover story.",
    tone: "positive",
  },
  {
    id: "workingCapital",
    label: "Working capital buffer (2004)",
    value: formatValue(computeWorkingCapital("2004"), "currency"),
    detail: "Current assets stayed well ahead of current liabilities after the 2004 buildout.",
    tone: "positive",
  },
  {
    id: "cashConversion",
    label: "Operating cash / net income (2004)",
    value: formatValue(computeCashConversion("2004"), "multiple"),
    detail: "Cash generation exceeded reported profit, which is a strong quality-of-earnings signal.",
    tone: "positive",
  },
  {
    id: "freeCashFlow",
    label: "Free cash flow after capex (2004)",
    value: formatValue(computeFreeCashFlow("2004"), "currency"),
    detail: "The company still covered growth capex and dividends without fresh long-term debt.",
    tone: "positive",
  },
  {
    id: "operatingMargin",
    label: "Operating margin (2004)",
    value: formatValue(computeOperatingMargin("2004"), "percent"),
    detail: "Margins stayed disciplined, but peer benchmarking still matters because industrial comps run richer.",
    tone: "warning",
  },
];

export const getStatementYearSummary = (year: StatementYear) => ({
  year,
  balance: {
    cash: getValue(walgreensBalanceSheet, "cash", year),
    currentAssets: getValue(walgreensBalanceSheet, "currentAssets", year),
    totalAssets: getValue(walgreensBalanceSheet, "totalAssets", year),
    equity: getValue(walgreensBalanceSheet, "equity", year),
  },
  earnings: {
    netSales: getValue(walgreensIncomeStatement, "netSales", year),
    grossProfit: getValue(walgreensIncomeStatement, "grossProfit", year),
    ebit: getValue(walgreensIncomeStatement, "ebit", year),
    netIncome: getValue(walgreensIncomeStatement, "netIncome", year),
  },
  cashFlow: {
    operatingCashFlow: getValue(walgreensCashFlow, "operatingCashFlow", year),
    capex: getValue(walgreensCashFlow, "capex", year),
    financingCashFlow: getValue(walgreensCashFlow, "financingCashFlow", year),
    endingCash: getValue(walgreensCashFlow, "endingCash", year),
  },
});
