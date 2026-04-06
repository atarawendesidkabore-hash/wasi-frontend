import { buildWASISystemPrompt, type BuildWASISystemPromptContext } from "./promptBuilder";

function makeBaseContext(): BuildWASISystemPromptContext {
  return {
    countries: [
      { code: "CI", name: "Cote d'Ivoire", flag: "CI", port: "Abidjan", weight: 0.22 },
      { code: "NG", name: "Nigeria", flag: "NG", port: "Lagos", weight: 0.28 },
    ],
    indices: { CI: 78, NG: 82 },
    wasiComposite: 80,
    backendConnected: true,
    stockMarkets: [],
    liveSignals: {},
    newsEvents: [],
    commodityPrices: [],
    selectedCountry: null,
    macroCache: {},
    historicalData: [],
    governmentAdvisoryKnowledge: "GOV-KNOWLEDGE",
    bankingKnowledge: "BANK-KNOWLEDGE",
    now: new Date("2026-03-06T00:00:00.000Z"),
  };
}

describe("buildWASISystemPrompt", () => {
  it("includes core sections and dynamic country index lines", () => {
    const prompt = buildWASISystemPrompt(makeBaseContext());

    expect(prompt).toContain("CURRENT LIVE DATA");
    expect(prompt).toContain("WASI Composite Index: 80/100");
    expect(prompt).toContain("Data Source: WASI Backend API v3.0");
    expect(prompt).toContain("ABSOLUTE DATA RULES");
    expect(prompt).toContain('respond exactly: "Je n\'ai pas cette donnée en temps réel"');
    expect(prompt).toContain("human_review_required: true");
    expect(prompt).toContain("Advisory only. Décision finale = validation humaine");
    expect(prompt).toContain("CI Cote d'Ivoire (CI): Index 78/100 | Port: Abidjan | Weight: 22.0%");
    expect(prompt).toContain("NG Nigeria (NG): Index 82/100 | Port: Lagos | Weight: 28.0%");
    expect(prompt).toContain("GOV-KNOWLEDGE");
    expect(prompt).toContain("BANK-KNOWLEDGE");
  });

  it("renders optional market, signal, event, commodity, macro and historical sections when provided", () => {
    const context = makeBaseContext();
    context.stockMarkets = [
      {
        exchange_code: "BRVM",
        index_name: "BRVM Composite",
        index_value: 210.12,
        change_pct: 1.42,
        ytd_change_pct: 4.8,
        market_cap_usd: 12300000000,
      },
    ];
    context.liveSignals = {
      CI: { base_index: 77.3, live_adjustment: 2.1, adjusted_index: 79.4 },
    };
    context.newsEvents = [
      {
        event_type: "PORT_DISRUPTION",
        country_code: "CI",
        headline: "Port congestion update in Abidjan terminal area",
        magnitude: -3,
        expires_at: "2026-03-08T00:00:00.000Z",
      },
    ];
    context.commodityPrices = [
      {
        name: "Cocoa",
        code: "COCOA",
        price_usd: 9234,
        unit: "MT",
        mom_pct: 4.5,
        yoy_pct: 21.2,
        period: "2026-02",
      },
    ];
    context.selectedCountry = context.countries[0];
    context.macroCache = {
      CI: {
        years: [
          {
            year: 2026,
            is_projection: true,
            gdp_growth_pct: 6.2,
            inflation_pct: 3.4,
            debt_gdp_pct: 58.9,
            current_account_gdp_pct: -2.1,
          },
        ],
      },
    };
    context.historicalData = [
      {
        period_date: "2026-01-01",
        index_value: 79.2,
        shipping_score: 76.1,
        trade_score: 80.0,
        infrastructure_score: 71.4,
        economic_score: 83.5,
      },
    ];

    const prompt = buildWASISystemPrompt(context);

    expect(prompt).toContain("WEST AFRICAN STOCK MARKETS");
    expect(prompt).toContain("LIVE SIGNAL ADJUSTMENTS");
    expect(prompt).toContain("ACTIVE NEWS EVENTS (1 total)");
    expect(prompt).toContain("WB PINK SHEET COMMODITY PRICES");
    expect(prompt).toContain("IMF WEO MACRO INDICATORS");
    expect(prompt).toContain("SELECTED COUNTRY FOCUS: Cote d'Ivoire");
    expect(prompt).toContain("HISTORICAL PORT DATA");
  });

  it("omits optional sections when corresponding datasets are empty", () => {
    const context = makeBaseContext();
    context.backendConnected = false;
    const prompt = buildWASISystemPrompt(context);

    expect(prompt).toContain("Data Source: Simulation Mode");
    expect(prompt).not.toContain("WEST AFRICAN STOCK MARKETS");
    expect(prompt).not.toContain("LIVE SIGNAL ADJUSTMENTS");
    expect(prompt).not.toContain("ACTIVE NEWS EVENTS");
    expect(prompt).not.toContain("WB PINK SHEET COMMODITY PRICES");
    expect(prompt).not.toContain("IMF WEO MACRO INDICATORS");
    expect(prompt).not.toContain("SELECTED COUNTRY FOCUS:");
    expect(prompt).not.toContain("HISTORICAL PORT DATA");
  });
});
