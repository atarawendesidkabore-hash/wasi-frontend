// Builds the WASI LLM system prompt from live and static context.
import {
  ADVISORY_DISCLAIMER,
  HUMAN_REVIEW_REQUIRED_FLAG,
  MISSING_REALTIME_DATA_MESSAGE,
} from "./llmGuardrails";

export interface PromptCountry {
  code: string;
  name: string;
  flag: string;
  port: string;
  weight: number;
}

export interface PromptStockMarket {
  exchange_code: string;
  index_name: string;
  index_value: number;
  change_pct: number;
  ytd_change_pct: number;
  market_cap_usd: number;
}

export interface PromptLiveSignal {
  base_index?: number | null;
  live_adjustment?: number | null;
  adjusted_index?: number | null;
}

export interface PromptNewsEvent {
  event_type: string;
  country_code: string;
  headline?: string;
  magnitude: number;
  expires_at: string;
}

export interface PromptCommodityPrice {
  name: string;
  code: string;
  price_usd: number | string;
  unit: string;
  mom_pct: number | null;
  yoy_pct: number | null;
  period: string;
}

export interface PromptMacroYear {
  year: number;
  is_projection?: boolean;
  gdp_growth_pct: number | null;
  inflation_pct: number | null;
  debt_gdp_pct: number | null;
  current_account_gdp_pct: number | null;
}

export interface PromptMacroData {
  years?: PromptMacroYear[];
}

export interface PromptHistoricalRow {
  period_date: string;
  index_value?: number | null;
  shipping_score?: number | null;
  trade_score?: number | null;
  infrastructure_score?: number | null;
  economic_score?: number | null;
}

export interface BuildWASISystemPromptContext {
  countries: PromptCountry[];
  indices: Record<string, number>;
  wasiComposite: number;
  backendConnected: boolean;
  stockMarkets: PromptStockMarket[];
  liveSignals: Record<string, PromptLiveSignal>;
  newsEvents: PromptNewsEvent[];
  commodityPrices: PromptCommodityPrice[];
  selectedCountry: PromptCountry | null;
  macroCache: Record<string, PromptMacroData | null | undefined>;
  historicalData: PromptHistoricalRow[];
  governmentAdvisoryKnowledge: string;
  bankingKnowledge: string;
  now?: Date;
}

function formatSignedPercent(value: number | null | undefined, digits = 1): string {
  if (typeof value !== "number") return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function formatMaybeNumber(value: number | null | undefined, digits = 1): string {
  return typeof value === "number" ? value.toFixed(digits) : "N/A";
}

export function buildWASISystemPrompt(context: BuildWASISystemPromptContext): string {
  const {
    countries,
    indices,
    wasiComposite,
    backendConnected,
    stockMarkets,
    liveSignals,
    newsEvents,
    commodityPrices,
    selectedCountry,
    macroCache,
    historicalData,
    governmentAdvisoryKnowledge,
    bankingKnowledge,
    now = new Date(),
  } = context;

  const countryData = countries
    .map(
      (c) =>
        `${c.flag} ${c.name} (${c.code}): Index ${indices[c.code]}/100 | Port: ${c.port} | Weight: ${(c.weight * 100).toFixed(1)}%`
    )
    .join("\n");

  const stockMarketSection =
    stockMarkets.length > 0
      ? `WEST AFRICAN STOCK MARKETS:
${stockMarkets
  .map(
    (m) =>
      `${m.exchange_code} ${m.index_name}: ${m.index_value.toFixed(2)} (${m.change_pct >= 0 ? "+" : ""}${m.change_pct.toFixed(2)}% today, YTD ${
        m.ytd_change_pct >= 0 ? "+" : ""
      }${m.ytd_change_pct.toFixed(1)}%, cap ${(m.market_cap_usd / 1e9).toFixed(1)}B USD)`
  )
  .join("\n")}`
      : "";

  const liveSignalSection =
    Object.keys(liveSignals).length > 0
      ? `LIVE SIGNAL ADJUSTMENTS (news-driven, updated hourly):
${Object.entries(liveSignals)
  .map(([code, signal]) => {
    const base = formatMaybeNumber(signal.base_index);
    const adj =
      typeof signal.live_adjustment === "number"
        ? `${signal.live_adjustment >= 0 ? "+" : ""}${signal.live_adjustment.toFixed(1)}`
        : "N/A";
    const adjusted = formatMaybeNumber(signal.adjusted_index);
    return `${code}: base=${base} adj=${adj} -> ${adjusted}/100`;
  })
  .join("\n")}`
      : "";

  const newsSection =
    newsEvents.length > 0
      ? `ACTIVE NEWS EVENTS (${newsEvents.length} total):
${newsEvents
  .slice(0, 5)
  .map(
    (e) =>
      `[${e.event_type}] ${e.country_code}: "${(e.headline || "").slice(0, 80)}" (${e.magnitude >= 0 ? "+" : ""}${e.magnitude} pts, expires ${new Date(
        e.expires_at
      ).toLocaleDateString()})`
  )
  .join("\n")}`
      : "";

  const commoditySection =
    commodityPrices.length > 0
      ? `WB PINK SHEET COMMODITY PRICES (latest monthly averages):
${commodityPrices
  .map(
    (p) =>
      `${p.name} (${p.code}): $${p.price_usd}/${p.unit} | MoM ${formatSignedPercent(p.mom_pct)} | YoY ${formatSignedPercent(p.yoy_pct)} | Period: ${p.period}`
  )
  .join("\n")}`
      : "";

  const macroYears =
    selectedCountry && macroCache[selectedCountry.code]
      ? (macroCache[selectedCountry.code]?.years || []).slice(0, 3)
      : [];
  const macroSection =
    selectedCountry && macroYears.length > 0
      ? `IMF WEO MACRO INDICATORS - ${selectedCountry.name} (${selectedCountry.code}):
${macroYears
  .map(
    (y) =>
      `${y.year}${y.is_projection ? " (proj.)" : ""}: GDP Growth ${
        y.gdp_growth_pct !== null ? `${y.gdp_growth_pct}%` : "N/A"
      } | Inflation ${y.inflation_pct !== null ? `${y.inflation_pct}%` : "N/A"} | Debt/GDP ${
        y.debt_gdp_pct !== null ? `${y.debt_gdp_pct}%` : "N/A"
      } | CA/GDP ${y.current_account_gdp_pct !== null ? `${y.current_account_gdp_pct}%` : "N/A"}`
  )
  .join("\n")}
Source: IMF World Economic Outlook API (live).`
      : "";

  const historicalSection =
    historicalData.length > 0
      ? `HISTORICAL PORT DATA - Cote d'Ivoire / Abidjan (${historicalData.length} months):
${historicalData
  .slice()
  .reverse()
  .map(
    (r) =>
      `${r.period_date}: Index=${formatMaybeNumber(r.index_value)} | Shipping=${formatMaybeNumber(
        r.shipping_score
      )} | Trade=${formatMaybeNumber(r.trade_score)} | Infra=${formatMaybeNumber(
        r.infrastructure_score
      )} | Economic=${formatMaybeNumber(r.economic_score)}`
  )
  .join("\n")}
Use this data to answer trend and evolution questions for Abidjan port activity.`
      : "";

  return `You are the WASI AI Agent v3.0 for West African Shipping & Economic Intelligence.

CURRENT LIVE DATA (${now.toLocaleDateString()}):
WASI Composite Index: ${wasiComposite}/100
Data Source: ${backendConnected ? "WASI Backend API v3.0 - ECOWAS 16 pays (LIVE)" : "Simulation Mode"}
Access: FULL | Mode: INTELLIGENCE PLATFORM

ABSOLUTE DATA RULES:
- Never invent a spot price, FX rate, or stock quote.
- If real-time data is missing, respond exactly: "${MISSING_REALTIME_DATA_MESSAGE}".
- Explicitly label each metric as live, historical, or estimate.
- Never present simulation data as live data.
- Any credit recommendation must include "${HUMAN_REVIEW_REQUIRED_FLAG}" and "${ADVISORY_DISCLAIMER}".

${stockMarketSection}
${liveSignalSection}
${newsSection}
${commoditySection}
${macroSection}

COUNTRY INDICES (Real-time simulation):
${countryData}

RESPONSE STANDARD:
- French question -> answer in French.
- English question -> answer in English.
- Cite sources with each key metric.

${selectedCountry ? `SELECTED COUNTRY FOCUS: ${selectedCountry.name} - Port: ${selectedCountry.port} - Current Index: ${indices[selectedCountry.code]}/100` : ""}

${governmentAdvisoryKnowledge}
${bankingKnowledge}

${historicalSection}
`;
}
