import { useEffect, useMemo, useState } from "react";
import {
  TERMINAL_COLORS,
  terminalPanelStyle,
  terminalSectionHeaderStyle,
  terminalCellStyle,
  changeColor,
  fmtSigned,
} from "../../platform/terminalChrome";

const BRVM_ROWS = [
  { ticker: "SOLIBRA", name: "Solibra CI", last: 155000, chg: 3500, pct: 2.31, vol: "1.2K" },
  { ticker: "SGBCI", name: "SGB Cote IV", last: 12500, chg: 150, pct: 1.21, vol: "3.8K" },
  { ticker: "ONTBF", name: "ONATEL BF", last: 3850, chg: -50, pct: -1.28, vol: "890" },
  { ticker: "SNTS", name: "Sonatel SN", last: 18200, chg: 400, pct: 2.25, vol: "5.1K" },
  { ticker: "TTLS", name: "Total SN", last: 2100, chg: -25, pct: -1.18, vol: "2.3K" },
  { ticker: "BICC", name: "BICICI", last: 7300, chg: 100, pct: 1.39, vol: "1.5K" },
  { ticker: "PALC", name: "Palm CI", last: 5950, chg: 75, pct: 1.28, vol: "780" },
  { ticker: "EXIT", name: "Ecobank TG", last: 14, chg: 0, pct: 0.0, vol: "45K" },
];

const NGX_ROWS = [
  { ticker: "DANGCEM", name: "Dangote Cem", last: 290, chg: 4.5, pct: 1.58, vol: "12M" },
  { ticker: "GTCO", name: "GTCO Hldg", last: 45.8, chg: 0.8, pct: 1.78, vol: "28M" },
  { ticker: "AIRTEL", name: "Airtel Afr", last: 2150, chg: -30, pct: -1.38, vol: "890K" },
  { ticker: "MTNN", name: "MTN Nigeria", last: 185.5, chg: 2.5, pct: 1.37, vol: "15M" },
];

const GSE_ROWS = [
  { ticker: "GOIL", name: "GOIL Ghana", last: 3.45, chg: 0.08, pct: 2.37, vol: "510K" },
  { ticker: "SCB", name: "Standard Chartered GH", last: 22.1, chg: -0.2, pct: -0.90, vol: "95K" },
  { ticker: "MTNGH", name: "MTN Ghana", last: 2.6, chg: 0.03, pct: 1.17, vol: "3.4M" },
  { ticker: "CAL", name: "CAL Bank", last: 0.98, chg: 0.01, pct: 1.03, vol: "220K" },
];

const UMOA_TITRES_ROWS = [
  { ticker: "BF-2031", name: "Burkina Faso OAT 6.15%", last: 98.2, chg: 0.3, pct: 0.31, vol: "1.2B" },
  { ticker: "CI-2030", name: "Cote d'Ivoire OAT 5.90%", last: 101.4, chg: 0.2, pct: 0.20, vol: "2.8B" },
  { ticker: "SN-2029", name: "Senegal OAT 6.00%", last: 99.7, chg: 0.1, pct: 0.10, vol: "1.6B" },
  { ticker: "BJ-2032", name: "Benin OAT 6.35%", last: 97.9, chg: -0.1, pct: -0.10, vol: "960M" },
];

const gradeFromScore = (score) => {
  if (score >= 90) return "AAA";
  if (score >= 80) return "AA";
  if (score >= 70) return "A";
  if (score >= 60) return "BBB";
  if (score >= 50) return "BB";
  if (score >= 40) return "B";
  if (score >= 30) return "CCC";
  return "D";
};

const scoreColor = (score) => {
  const value = Number(score || 0);
  if (value >= 80) return TERMINAL_COLORS.green;
  if (value >= 60) return TERMINAL_COLORS.blue;
  return TERMINAL_COLORS.red;
};

const normalizeMarket = (entry) => {
  if (!entry) return null;
  if ("exchange_code" in entry) {
    return {
      exchange_code: entry.exchange_code,
      index_name: entry.index_name,
      symbol: entry.exchange_code === "BRVM" ? "BRVM-C" : entry.exchange_code === "NGX" ? "NGX-ASI" : "GSE-CI",
      index_value: Number(entry.index_value || 0),
      change_pct: Number(entry.change_pct || 0),
      ytd_change_pct: Number(entry.ytd_change_pct || 0),
      market_cap_usd: Number(entry.market_cap_usd || 0),
    };
  }

  const code = String(entry.exchange || "").toUpperCase();
  return {
    exchange_code: code,
    index_name: entry.label || code,
    symbol: entry.symbol || code,
    index_value: Number(entry.level || 0),
    change_pct: Number(entry.change_pct || 0),
    ytd_change_pct: Number(entry.change_pct || 0) * 4.1,
    market_cap_usd: code === "NGX" ? 68000000000 : code === "BRVM" ? 18500000000 : 9000000000,
  };
};

const normalizeCommodity = (entry) => {
  if (!entry) return null;
  if ("code" in entry) {
    return {
      code: entry.code,
      name: entry.name,
      price: Number(entry.price_usd || 0),
      unit: entry.unit || "USD/unit",
      chg_pct: Number(entry.mom_pct || 0),
      ytd_pct: Number(entry.yoy_pct || 0),
      period: entry.period || "latest",
    };
  }
  return {
    code: entry.symbol,
    name: entry.name,
    price: Number(entry.price || 0),
    unit: entry.unit || "USD/unit",
    chg_pct: Number(entry.chg_pct || 0),
    ytd_pct: Number(entry.ytd_pct || 0),
    period: "latest",
  };
};

const normalizeNews = (event) => {
  if (!event) return null;
  if ("event_type" in event) return event;
  return {
    event_type: event.type || "DATA",
    headline: event.text || "WASI event",
    country_code: event.country_code || "ECOWAS",
    magnitude: Number(event.impact || 0),
    expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    source: "WASI Snapshot",
    timestamp: event.timestamp || "--:--",
    severity: event.severity || "MEDIUM",
  };
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const hashKey = (value) => {
  const text = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const stringifyMessageContent = (content) => {
  if (typeof content === "string") return content;
  if (content == null) return "";
  try {
    return JSON.stringify(content);
  } catch (_) {
    return String(content);
  }
};

export function WasiTerminalBoard({
  countries,
  indices,
  liveSignals,
  selectedCountry,
  onCountryToggle,
  wasiComposite,
  stockMarkets,
  commodityPrices,
  newsEvents,
  userInfo,
  onLogout,
  dataSource,
  backendConnected,
  messages,
  input,
  onInputChange,
  onSend,
  loading,
  onToggleUSSD,
  setSidebarModal,
  dexMarkets,
  dexRecentTrades,
  dexOrderBook,
  dexPortfolio,
  dexSelectedSymbol,
  onDexSelectSymbol,
  dexOrderForm,
  onDexOrderFormChange,
  dexSubmitting,
  dexError,
  dexLastAction,
  onDexPlaceOrder,
  onDexCancelOrder,
}) {
  const isLive = backendConnected && dataSource === "live";
  const isSnapshot = backendConnected && dataSource === "snapshot";
  const [clock, setClock] = useState(() =>
    new Date().toLocaleTimeString("fr-FR", { hour12: false })
  );
  const [liveBeat, setLiveBeat] = useState(0);
  const [dexInlineMessage, setDexInlineMessage] = useState("");
  const [dexInlineMessageType, setDexInlineMessageType] = useState("info");
  const shouldMicroTick = isLive;

  useEffect(() => {
    const id = setInterval(() => {
      setClock(new Date().toLocaleTimeString("fr-FR", { hour12: false }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!shouldMicroTick) return undefined;
    const id = setInterval(() => {
      setLiveBeat((previous) => (previous + 1) % 1000000);
    }, 1000);
    return () => clearInterval(id);
  }, [shouldMicroTick]);

  const animateValue = (
    baseValue,
    key,
    { relative = 0.0008, absolute = 0.01, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {}
  ) => {
    const base = Number(baseValue || 0);
    if (!shouldMicroTick || !Number.isFinite(base)) return base;
    const phase = ((hashKey(key) % 360) * Math.PI) / 180;
    const wave = Math.sin(liveBeat * 0.9 + phase);
    const amplitude = Math.max(Math.abs(base) * relative, absolute);
    return clamp(base + wave * amplitude, min, max);
  };

  const marketRows = useMemo(
    () => (Array.isArray(stockMarkets) ? stockMarkets.map(normalizeMarket).filter(Boolean) : []),
    [stockMarkets]
  );

  const commodityRows = useMemo(
    () => (Array.isArray(commodityPrices) ? commodityPrices.map(normalizeCommodity).filter(Boolean) : []),
    [commodityPrices]
  );

  const eventRows = useMemo(
    () => (Array.isArray(newsEvents) ? newsEvents.map(normalizeNews).filter(Boolean) : []),
    [newsEvents]
  );

  const countryRows = useMemo(() => {
    return [...countries]
      .map((country) => {
        const score = Number(indices[country.code] || 0);
        const liveAdj = Number(liveSignals?.[country.code]?.live_adjustment || 0);
        return {
          ...country,
          score,
          change: liveAdj,
          grade: gradeFromScore(score),
          weightPct: Math.round(Number(country.weight || 0) * 100),
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [countries, indices, liveSignals]);

  const animatedMarketRows = useMemo(() => {
    return marketRows.map((row) => ({
      ...row,
      displayIndexValue: animateValue(row.index_value, `${row.symbol}-index`, {
        relative: 0.0009,
        absolute: 0.05,
      }),
      displayChangePct: animateValue(row.change_pct, `${row.symbol}-chg-pct`, {
        relative: 0.03,
        absolute: 0.04,
        min: -99,
        max: 99,
      }),
    }));
  }, [marketRows, liveBeat, shouldMicroTick]);

  const animatedCommodityRows = useMemo(() => {
    return commodityRows.map((row) => ({
      ...row,
      displayPrice: animateValue(row.price, `${row.code}-price`, {
        relative: 0.0014,
        absolute: 0.02,
      }),
      displayChangePct: animateValue(row.chg_pct, `${row.code}-chg`, {
        relative: 0.04,
        absolute: 0.05,
        min: -99,
        max: 99,
      }),
      displayYtdPct: animateValue(row.ytd_pct, `${row.code}-ytd`, {
        relative: 0.01,
        absolute: 0.03,
        min: -99,
        max: 999,
      }),
    }));
  }, [commodityRows, liveBeat, shouldMicroTick]);

  const animatedCountryRows = useMemo(() => {
    return countryRows.map((row) => {
      const displayChange = animateValue(row.change, `${row.code}-country-chg`, {
        relative: 0.25,
        absolute: 0.08,
        min: -9.9,
        max: 9.9,
      });
      const displayScore = clamp(row.score + displayChange, 0, 100);
      return {
        ...row,
        displayChange,
        displayScore,
      };
    });
  }, [countryRows, liveBeat, shouldMicroTick]);

  const animatedDexRows = useMemo(() => {
    return (Array.isArray(dexMarkets) ? dexMarkets : []).map((market) => {
      const lastCentimes = Number(market.lastPriceCentimes || 0);
      const bidCentimes = Number(market.bestBidCentimes || 0);
      const askCentimes = Number(market.bestAskCentimes || 0);
      return {
        ...market,
        displayLastCentimes: String(
          Math.max(
            0,
            Math.round(
              animateValue(lastCentimes, `${market.symbol}-dex-last`, {
                relative: 0.0012,
                absolute: 3,
              })
            )
          )
        ),
        displayBidCentimes:
          bidCentimes > 0
            ? String(
              Math.max(
                0,
                Math.round(
                  animateValue(bidCentimes, `${market.symbol}-dex-bid`, {
                    relative: 0.0012,
                    absolute: 2,
                  })
                )
              )
            )
            : null,
        displayAskCentimes:
          askCentimes > 0
            ? String(
              Math.max(
                0,
                Math.round(
                  animateValue(askCentimes, `${market.symbol}-dex-ask`, {
                    relative: 0.0012,
                    absolute: 2,
                  })
                )
              )
            )
            : null,
        displayChangePct: animateValue(market.changePct24h || 0, `${market.symbol}-dex-chg`, {
          relative: 0.03,
          absolute: 0.05,
          min: -99,
          max: 99,
        }),
      };
    });
  }, [dexMarkets, liveBeat, shouldMicroTick]);

  const watchlistRows = useMemo(() => {
    const topCountries = animatedCountryRows.slice(0, 3).map((country) => ({
      key: country.code,
      type: "country",
      label: `${country.code} ${country.name}`,
      value: country.displayScore.toFixed(1),
      change: country.displayChange,
      color: changeColor(country.displayChange),
      countryCode: country.code,
    }));
    const topMarkets = animatedMarketRows.slice(0, 5).map((market) => ({
      key: market.symbol,
      type: "market",
      label: `${market.symbol} ${market.index_name}`,
      value: market.displayIndexValue.toLocaleString("fr-FR", { maximumFractionDigits: 2 }),
      change: market.displayChangePct,
      color: changeColor(market.displayChangePct),
      market,
    }));
    return [...topCountries, ...topMarkets];
  }, [animatedCountryRows, animatedMarketRows]);

  const latestMessages = useMemo(() => {
    return [...messages].slice(-8);
  }, [messages]);

  const formatCentimes = (value) => {
    const raw = BigInt(String(value ?? "0"));
    const sign = raw < 0n ? "-" : "";
    const abs = raw < 0n ? -raw : raw;
    const whole = abs / 100n;
    const cents = abs % 100n;
    return `${sign}${whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}.${cents
      .toString()
      .padStart(2, "0")} XOF`;
  };

  const tickerItems = [
    ...animatedMarketRows.map((market) => ({
      kind: "market",
      symbol: market.symbol,
      value: market.displayIndexValue.toLocaleString("fr-FR", { maximumFractionDigits: 2 }),
      change: market.displayChangePct,
    })),
    ...animatedCommodityRows.slice(0, 3).map((commodity) => ({
      kind: "commodity",
      symbol: commodity.code,
      value: commodity.displayPrice.toLocaleString("fr-FR", { maximumFractionDigits: 2 }),
      change: commodity.displayChangePct,
    })),
    ...(Array.isArray(animatedDexRows)
      ? animatedDexRows.slice(0, 3).map((market) => ({
        kind: "dex",
        symbol: market.symbol,
        value: formatCentimes(market.displayLastCentimes || market.lastPriceCentimes || "0"),
        change: market.displayChangePct,
      }))
      : []),
  ];

  const tickerUsername = userInfo?.username || "guest";
  const tickerCredit =
    typeof userInfo?.x402_balance === "number"
      ? `${userInfo.x402_balance} CR`
      : String(userInfo?.tier || "FREE").toUpperCase();

  const renderTickerSegment = (item, key) => {
    const symbolColor = item.kind === "dex" ? TERMINAL_COLORS.cyan : TERMINAL_COLORS.amber;
    return (
      <span key={key} className="wasi-ticker-segment">
        <span style={{ color: symbolColor }}>{item.symbol}</span>
        <span>{item.value}</span>
        <span style={{ color: changeColor(item.change) }}>{fmtSigned(item.change, 2)}%</span>
      </span>
    );
  };

  const dexOpenOrders = dexPortfolio?.openOrders || [];
  const dexPositions = dexPortfolio?.positions || [];
  const dexWallet = dexPortfolio?.wallet || null;

  const brvmHeader = animatedMarketRows.find((row) => row.exchange_code === "BRVM");
  const ngxHeader = animatedMarketRows.find((row) => row.exchange_code === "NGX");
  const gseHeader = animatedMarketRows.find((row) => row.exchange_code === "GSE");
  const umoaHeader = animatedMarketRows.find((row) => row.exchange_code === "UMOA");

  const openMarketDetail = (market) => {
    if (!setSidebarModal) return;
    setSidebarModal({ type: "market", market });
  };

  const openEventDetail = (event) => {
    if (!setSidebarModal) return;
    setSidebarModal({ type: "event", event });
  };

  const openCommodityDetail = (commodity) => {
    if (!setSidebarModal) return;
    setSidebarModal({ type: "commodity", commodity });
  };

  const openSecurityDetail = (security, exchangeCode) => {
    if (!setSidebarModal) return;
    const market = animatedMarketRows.find((row) => row.exchange_code === exchangeCode) || null;
    setSidebarModal({
      type: "security",
      security: {
        ...security,
        exchange_code: exchangeCode,
        market_symbol: market?.symbol || exchangeCode,
        market_index_value: market?.displayIndexValue ?? market?.index_value ?? null,
        market_change_pct: market?.displayChangePct ?? market?.change_pct ?? null,
      },
    });
  };

  const onWatchlistClick = (row) => {
    if (row.type === "country") {
      const country = animatedCountryRows.find((item) => item.code === row.countryCode);
      if (country) onCountryToggle(country);
      return;
    }
    if (row.type === "market" && row.market) {
      openMarketDetail(row.market);
    }
  };

  useEffect(() => {
    if (dexError) {
      setDexInlineMessage(`Erreur DEX: ${dexError}`);
      setDexInlineMessageType("error");
      return;
    }
    if (dexLastAction) {
      setDexInlineMessage(dexLastAction);
      setDexInlineMessageType("success");
    }
  }, [dexError, dexLastAction]);

  const handleDexSubmit = async () => {
    const quantity = String(dexOrderForm?.quantityUnits || "").trim();
    const limitPrice = String(dexOrderForm?.limitPriceXof || "").trim();

    if (!quantity || !limitPrice) {
      setDexInlineMessage("Renseignez la quantite et le prix limite.");
      setDexInlineMessageType("error");
      return;
    }

    const result = await onDexPlaceOrder?.();
    if (result?.ok) {
      setDexInlineMessage(result.message || "Ordre soumis.");
      setDexInlineMessageType("success");
    } else if (result?.message) {
      setDexInlineMessage(result.message);
      setDexInlineMessageType("error");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <style>{`
        .wasi-terminal-grid { grid-template-columns: 360px 1fr 280px; }
        .wasi-ticker-bar {
          display: grid;
          grid-template-columns: auto auto 1fr auto auto;
          align-items: center;
          gap: 14px;
        }
        .wasi-ticker-fixed-brand {
          color: ${TERMINAL_COLORS.amber};
          font-weight: 700;
          white-space: nowrap;
        }
        .wasi-ticker-fixed-user {
          color: ${TERMINAL_COLORS.text};
          white-space: nowrap;
        }
        .wasi-ticker-marquee {
          overflow: hidden;
          width: 100%;
          min-width: 0;
        }
        .wasi-ticker-track {
          display: inline-flex;
          align-items: center;
          gap: 22px;
          width: max-content;
          white-space: nowrap;
          animation: wasiTickerScroll 14s linear infinite;
          will-change: transform;
        }
        .wasi-ticker-segment {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: ${TERMINAL_COLORS.text};
          flex: 0 0 auto;
          font-size: 13px;
        }
        .wasi-ticker-clock {
          color: ${TERMINAL_COLORS.textMuted};
          white-space: nowrap;
          font-size: 13px;
        }
        .wasi-ticker-logout {
          border: 1px solid ${TERMINAL_COLORS.border};
          background: transparent;
          color: ${TERMINAL_COLORS.textMuted};
          padding: 5px 10px;
          cursor: pointer;
          font-family: inherit;
          font-size: 12px;
          letter-spacing: 1px;
          white-space: nowrap;
        }
        .wasi-ticker-logout:hover {
          border-color: ${TERMINAL_COLORS.red};
          color: ${TERMINAL_COLORS.red};
        }
        @keyframes wasiTickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @media (max-width: 1280px) {
          .wasi-terminal-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 980px) {
          .wasi-ticker-bar {
            grid-template-columns: 1fr auto;
            gap: 8px;
          }
          .wasi-ticker-fixed-brand,
          .wasi-ticker-fixed-user,
          .wasi-ticker-logout {
            display: none;
          }
        }
      `}</style>
      <div
        className="wasi-ticker-bar"
        style={{
          ...terminalPanelStyle,
          borderLeft: "none",
          borderRight: "none",
          borderTop: "none",
          padding: "8px 10px",
        }}
      >
        <span className="wasi-ticker-fixed-brand">WASI TERMINAL</span>
        <span className="wasi-ticker-fixed-user">
          {tickerUsername} <span style={{ color: TERMINAL_COLORS.green }}>{tickerCredit}</span>
        </span>
        <div className="wasi-ticker-marquee">
          <div className="wasi-ticker-track">
            {tickerItems.map((item, index) => renderTickerSegment(item, `ticker-a-${index}`))}
            {tickerItems.map((item, index) => renderTickerSegment(item, `ticker-b-${index}`))}
          </div>
        </div>
        {onLogout ? (
          <button type="button" className="wasi-ticker-logout" onClick={onLogout}>
            LOG OFF
          </button>
        ) : null}
        <span className="wasi-ticker-clock">{clock}</span>
      </div>

      <div
        className="wasi-terminal-grid"
        style={{
          display: "grid",
          gap: 0,
          minHeight: 0,
          flex: 1,
        }}
      >
        <section style={{ ...terminalPanelStyle, borderTop: "none", borderLeft: "none", overflow: "auto" }}>
          <div style={terminalSectionHeaderStyle}>WASI INDEX - ECOWAS 16</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: TERMINAL_COLORS.textMuted, fontSize: 12 }}>
                <th style={terminalCellStyle}>#</th>
                <th style={terminalCellStyle}>CC</th>
                <th style={terminalCellStyle}>COUNTRY</th>
                <th style={terminalCellStyle}>SCORE</th>
                <th style={terminalCellStyle}>CHG</th>
                <th style={terminalCellStyle}>RTG</th>
                <th style={terminalCellStyle}>WT</th>
              </tr>
            </thead>
            <tbody>
              {animatedCountryRows.map((row, index) => (
                <tr
                  key={row.code}
                  onClick={() => onCountryToggle(row)}
                  style={{
                    cursor: "pointer",
                    background:
                      selectedCountry?.code === row.code
                        ? "rgba(240,180,41,0.10)"
                        : "transparent",
                  }}
                >
                  <td style={terminalCellStyle}>{index + 1}</td>
                  <td style={{ ...terminalCellStyle, color: TERMINAL_COLORS.amber }}>{row.code}</td>
                  <td style={{ ...terminalCellStyle, color: TERMINAL_COLORS.text }}>{row.name}</td>
                  <td style={{ ...terminalCellStyle, color: scoreColor(row.displayScore), fontWeight: 700 }}>
                    {row.displayScore.toFixed(1)}
                  </td>
                  <td style={{ ...terminalCellStyle, color: changeColor(row.displayChange) }}>
                    {fmtSigned(row.displayChange, 1)}
                  </td>
                  <td style={{ ...terminalCellStyle, color: changeColor(row.score - 60) }}>
                    {row.grade}
                  </td>
                  <td style={terminalCellStyle}>{row.weightPct}%</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} style={{ ...terminalCellStyle, color: TERMINAL_COLORS.amber, fontWeight: 700 }}>
                  COMPOSITE
                </td>
                <td style={{ ...terminalCellStyle, color: scoreColor(wasiComposite), fontWeight: 700 }}>
                  {Number(wasiComposite || 0).toFixed(1)}
                </td>
                <td style={{ ...terminalCellStyle, color: TERMINAL_COLORS.green }}>
                  {isLive ? "+LIVE" : isSnapshot ? "SNAP" : "DEMO"}
                </td>
                <td style={{ ...terminalCellStyle, color: TERMINAL_COLORS.info }}>
                  {gradeFromScore(Number(wasiComposite || 0))}
                </td>
                <td style={terminalCellStyle}>100%</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section style={{ ...terminalPanelStyle, borderTop: "none", overflow: "auto" }}>
          <div style={terminalSectionHeaderStyle}>WEST AFRICAN MARKETS</div>

          <div style={{ borderBottom: `1px solid ${TERMINAL_COLORS.border}` }}>
            <div
              style={{ ...terminalSectionHeaderStyle, fontSize: 13, cursor: brvmHeader ? "pointer" : "default" }}
              onClick={() => brvmHeader && openMarketDetail(brvmHeader)}
            >
              BRVM - UEMOA{" "}
              <span style={{ float: "right", color: TERMINAL_COLORS.green }}>
                {brvmHeader
                  ? `${brvmHeader.symbol} ${brvmHeader.displayIndexValue.toLocaleString("fr-FR", {
                    maximumFractionDigits: 2,
                  })} ${fmtSigned(brvmHeader.displayChangePct, 2)}%`
                  : isLive ? "LIVE" : isSnapshot ? "SNAPSHOT" : "DEMO"}
              </span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: TERMINAL_COLORS.textMuted, fontSize: 12 }}>
                  <th style={terminalCellStyle}>TICKER</th>
                  <th style={terminalCellStyle}>NAME</th>
                  <th style={terminalCellStyle}>LAST</th>
                  <th style={terminalCellStyle}>CHG</th>
                  <th style={terminalCellStyle}>%CHG</th>
                  <th style={terminalCellStyle}>VOL</th>
                </tr>
              </thead>
              <tbody>
                {BRVM_ROWS.map((row) => (
                  <tr
                    key={row.ticker}
                    onClick={() => openSecurityDetail(row, "BRVM")}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ ...terminalCellStyle, color: TERMINAL_COLORS.cyan }}>{row.ticker}</td>
                    <td style={terminalCellStyle}>{row.name}</td>
                    <td style={{ ...terminalCellStyle, color: TERMINAL_COLORS.text, fontWeight: 700 }}>
                      {row.last.toLocaleString("fr-FR")}
                    </td>
                    <td style={{ ...terminalCellStyle, color: changeColor(row.chg) }}>
                      {fmtSigned(row.chg, 0)}
                    </td>
                    <td style={{ ...terminalCellStyle, color: changeColor(row.pct) }}>
                      {fmtSigned(row.pct, 2)}%
                    </td>
                    <td style={terminalCellStyle}>{row.vol}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ borderBottom: `1px solid ${TERMINAL_COLORS.border}` }}>
            <div
              style={{ ...terminalSectionHeaderStyle, fontSize: 13, cursor: ngxHeader ? "pointer" : "default" }}
              onClick={() => ngxHeader && openMarketDetail(ngxHeader)}
            >
              NGX - NIGERIA{" "}
              <span style={{ float: "right", color: TERMINAL_COLORS.green }}>
                {ngxHeader
                  ? `${ngxHeader.symbol} ${ngxHeader.displayIndexValue.toLocaleString("fr-FR", {
                    maximumFractionDigits: 2,
                  })} ${fmtSigned(ngxHeader.displayChangePct, 2)}%`
                  : isLive ? "LIVE" : isSnapshot ? "SNAPSHOT" : "DEMO"}
              </span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: TERMINAL_COLORS.textMuted, fontSize: 12 }}>
                  <th style={terminalCellStyle}>TICKER</th>
                  <th style={terminalCellStyle}>NAME</th>
                  <th style={terminalCellStyle}>LAST</th>
                  <th style={terminalCellStyle}>CHG</th>
                  <th style={terminalCellStyle}>%CHG</th>
                  <th style={terminalCellStyle}>VOL</th>
                </tr>
              </thead>
              <tbody>
                {NGX_ROWS.map((row) => (
                  <tr
                    key={row.ticker}
                    onClick={() => openSecurityDetail(row, "NGX")}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ ...terminalCellStyle, color: TERMINAL_COLORS.cyan }}>{row.ticker}</td>
                    <td style={terminalCellStyle}>{row.name}</td>
                    <td style={{ ...terminalCellStyle, color: TERMINAL_COLORS.text, fontWeight: 700 }}>
                      {row.last.toLocaleString("fr-FR")}
                    </td>
                    <td style={{ ...terminalCellStyle, color: changeColor(row.chg) }}>
                      {fmtSigned(row.chg, 2)}
                    </td>
                    <td style={{ ...terminalCellStyle, color: changeColor(row.pct) }}>
                      {fmtSigned(row.pct, 2)}%
                    </td>
                    <td style={terminalCellStyle}>{row.vol}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ borderBottom: `1px solid ${TERMINAL_COLORS.border}` }}>
            <div
              style={{ ...terminalSectionHeaderStyle, fontSize: 13, cursor: gseHeader ? "pointer" : "default" }}
              onClick={() => gseHeader && openMarketDetail(gseHeader)}
            >
              GSE - GHANA{" "}
              <span style={{ float: "right", color: TERMINAL_COLORS.green }}>
                {gseHeader
                  ? `${gseHeader.symbol} ${gseHeader.displayIndexValue.toLocaleString("fr-FR", {
                    maximumFractionDigits: 2,
                  })} ${fmtSigned(gseHeader.displayChangePct, 2)}%`
                  : isLive ? "LIVE" : isSnapshot ? "SNAPSHOT" : "DEMO"}
              </span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: TERMINAL_COLORS.textMuted, fontSize: 12 }}>
                  <th style={terminalCellStyle}>TICKER</th>
                  <th style={terminalCellStyle}>NAME</th>
                  <th style={terminalCellStyle}>LAST</th>
                  <th style={terminalCellStyle}>CHG</th>
                  <th style={terminalCellStyle}>%CHG</th>
                  <th style={terminalCellStyle}>VOL</th>
                </tr>
              </thead>
              <tbody>
                {GSE_ROWS.map((row) => (
                  <tr
                    key={row.ticker}
                    onClick={() => openSecurityDetail(row, "GSE")}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ ...terminalCellStyle, color: TERMINAL_COLORS.cyan }}>{row.ticker}</td>
                    <td style={terminalCellStyle}>{row.name}</td>
                    <td style={{ ...terminalCellStyle, color: TERMINAL_COLORS.text, fontWeight: 700 }}>
                      {row.last.toLocaleString("fr-FR")}
                    </td>
                    <td style={{ ...terminalCellStyle, color: changeColor(row.chg) }}>
                      {fmtSigned(row.chg, 2)}
                    </td>
                    <td style={{ ...terminalCellStyle, color: changeColor(row.pct) }}>
                      {fmtSigned(row.pct, 2)}%
                    </td>
                    <td style={terminalCellStyle}>{row.vol}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ borderBottom: `1px solid ${TERMINAL_COLORS.border}` }}>
            <div
              style={{ ...terminalSectionHeaderStyle, fontSize: 13, cursor: umoaHeader ? "pointer" : "default" }}
              onClick={() => umoaHeader && openMarketDetail(umoaHeader)}
            >
              UMOA TITRES - SOVEREIGN BONDS{" "}
              <span style={{ float: "right", color: TERMINAL_COLORS.green }}>
                {umoaHeader
                  ? `${umoaHeader.symbol} ${umoaHeader.displayIndexValue.toLocaleString("fr-FR", {
                    maximumFractionDigits: 2,
                  })} ${fmtSigned(umoaHeader.displayChangePct, 2)}%`
                  : isLive ? "LIVE" : isSnapshot ? "SNAPSHOT" : "DEMO"}
              </span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: TERMINAL_COLORS.textMuted, fontSize: 12 }}>
                  <th style={terminalCellStyle}>BOND</th>
                  <th style={terminalCellStyle}>ISSUE</th>
                  <th style={terminalCellStyle}>PX</th>
                  <th style={terminalCellStyle}>CHG</th>
                  <th style={terminalCellStyle}>%CHG</th>
                  <th style={terminalCellStyle}>VOL</th>
                </tr>
              </thead>
              <tbody>
                {UMOA_TITRES_ROWS.map((row) => (
                  <tr
                    key={row.ticker}
                    onClick={() => openSecurityDetail(row, "UMOA")}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ ...terminalCellStyle, color: TERMINAL_COLORS.cyan }}>{row.ticker}</td>
                    <td style={terminalCellStyle}>{row.name}</td>
                    <td style={{ ...terminalCellStyle, color: TERMINAL_COLORS.text, fontWeight: 700 }}>
                      {row.last.toLocaleString("fr-FR")}
                    </td>
                    <td style={{ ...terminalCellStyle, color: changeColor(row.chg) }}>
                      {fmtSigned(row.chg, 2)}
                    </td>
                    <td style={{ ...terminalCellStyle, color: changeColor(row.pct) }}>
                      {fmtSigned(row.pct, 2)}%
                    </td>
                    <td style={terminalCellStyle}>{row.vol}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ ...terminalSectionHeaderStyle, fontSize: 13 }}>AI CONSOLE</div>
          <div style={{ padding: "8px 10px", minHeight: 180, maxHeight: 280, overflowY: "auto" }}>
            {latestMessages.length === 0 ? (
              <div style={{ color: TERMINAL_COLORS.textMuted, fontSize: 13 }}>
                Aucun message encore. Tapez votre prompt ici pour interroger l'agent WASI.
              </div>
            ) : (
              latestMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  style={{
                    marginBottom: 8,
                    paddingBottom: 8,
                    borderBottom: `1px solid ${TERMINAL_COLORS.borderSoft}`,
                  }}
                >
                  <span
                    style={{
                      color: message.role === "assistant" ? TERMINAL_COLORS.amber : TERMINAL_COLORS.cyan,
                      fontWeight: 700,
                      marginRight: 8,
                    }}
                  >
                    {message.role === "assistant" ? "WASI" : "USER"}:
                  </span>
                  <span style={{ fontSize: 13, color: TERMINAL_COLORS.text }}>
                    <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {stringifyMessageContent(message.content).slice(0, 1400)}
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>
          <div
            style={{
              padding: "8px 10px",
              borderTop: `1px solid ${TERMINAL_COLORS.borderSoft}`,
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 8,
              alignItems: "center",
            }}
          >
            <textarea
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSend();
                }
              }}
              placeholder="Posez votre question WASI ici... (ex: Analyse CI vs GH sur 12 mois)"
              rows={2}
              style={{
                border: `1px solid ${TERMINAL_COLORS.border}`,
                background: TERMINAL_COLORS.bgSoft,
                color: TERMINAL_COLORS.text,
                padding: "8px 10px",
                fontFamily: "inherit",
                fontSize: 13,
                resize: "vertical",
                minHeight: 46,
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={() => onSend()}
              disabled={loading || !String(input || "").trim()}
              style={{
                border: `1px solid ${TERMINAL_COLORS.amber}`,
                background: "transparent",
                color: TERMINAL_COLORS.amber,
                padding: "9px 12px",
                fontFamily: "inherit",
                cursor: "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "..." : "ENVOYER"}
            </button>
          </div>

          <div style={{ ...terminalSectionHeaderStyle, fontSize: 13 }}>COMMODITIES</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: TERMINAL_COLORS.textMuted, fontSize: 12 }}>
                <th style={terminalCellStyle}>SYM</th>
                <th style={terminalCellStyle}>NAME</th>
                <th style={terminalCellStyle}>PRICE/UNIT</th>
                <th style={terminalCellStyle}>CHG</th>
                <th style={terminalCellStyle}>YTD</th>
              </tr>
            </thead>
            <tbody>
              {animatedCommodityRows.slice(0, 8).map((row) => (
                <tr key={row.code} onClick={() => openCommodityDetail(row)} style={{ cursor: "pointer" }}>
                  <td style={{ ...terminalCellStyle, color: TERMINAL_COLORS.amber, fontWeight: 700 }}>{row.code}</td>
                  <td style={terminalCellStyle}>{row.name}</td>
                  <td style={{ ...terminalCellStyle, color: TERMINAL_COLORS.text, fontWeight: 700 }}>
                    {row.displayPrice.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
                    {row.unit}
                  </td>
                  <td style={{ ...terminalCellStyle, color: changeColor(row.displayChangePct) }}>
                    {fmtSigned(row.displayChangePct, 2)}%
                  </td>
                  <td style={{ ...terminalCellStyle, color: changeColor(row.displayYtdPct) }}>
                    {fmtSigned(row.displayYtdPct, 1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ ...terminalSectionHeaderStyle, fontSize: 13 }}>WASI ETF DEX</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: TERMINAL_COLORS.textMuted, fontSize: 12 }}>
                <th style={terminalCellStyle}>SYMBOL</th>
                <th style={terminalCellStyle}>CAT</th>
                <th style={terminalCellStyle}>LAST</th>
                <th style={terminalCellStyle}>BID</th>
                <th style={terminalCellStyle}>ASK</th>
                <th style={terminalCellStyle}>VOL</th>
              </tr>
            </thead>
            <tbody>
              {(animatedDexRows || []).slice(0, 10).map((market) => (
                <tr
                  key={market.symbol}
                  onClick={() => onDexSelectSymbol(market.symbol)}
                  style={{
                    cursor: "pointer",
                    background:
                      dexSelectedSymbol === market.symbol
                        ? "rgba(240,180,41,0.10)"
                        : "transparent",
                  }}
                >
                  <td style={{ ...terminalCellStyle, color: TERMINAL_COLORS.cyan, fontWeight: 700 }}>
                    {market.symbol}
                  </td>
                  <td style={terminalCellStyle}>{market.category}</td>
                  <td style={terminalCellStyle}>{formatCentimes(market.displayLastCentimes || market.lastPriceCentimes || "0")}</td>
                  <td style={terminalCellStyle}>
                    {market.displayBidCentimes ? formatCentimes(market.displayBidCentimes) : "-"}
                  </td>
                  <td style={terminalCellStyle}>
                    {market.displayAskCentimes ? formatCentimes(market.displayAskCentimes) : "-"}
                  </td>
                  <td style={terminalCellStyle}>{market.volume24hUnits || "0"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
            <div style={{ borderRight: `1px solid ${TERMINAL_COLORS.border}` }}>
              <div style={{ ...terminalSectionHeaderStyle, fontSize: 13, color: TERMINAL_COLORS.green }}>
                DEX BIDS ({dexOrderBook?.symbol || dexSelectedSymbol})
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: TERMINAL_COLORS.textMuted, fontSize: 12 }}>
                    <th style={terminalCellStyle}>PRICE</th>
                    <th style={terminalCellStyle}>QTY</th>
                    <th style={terminalCellStyle}>NOTIONAL</th>
                  </tr>
                </thead>
                <tbody>
                  {(dexOrderBook?.bids || []).slice(0, 8).map((row) => (
                    <tr key={`wasi-dex-bid-${row.priceCentimes}`}>
                      <td style={{ ...terminalCellStyle, color: TERMINAL_COLORS.green }}>
                        {formatCentimes(row.priceCentimes)}
                      </td>
                      <td style={terminalCellStyle}>{row.quantityUnits}</td>
                      <td style={terminalCellStyle}>{formatCentimes(row.notionalCentimes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <div style={{ ...terminalSectionHeaderStyle, fontSize: 13, color: TERMINAL_COLORS.red }}>
                DEX ASKS ({dexOrderBook?.symbol || dexSelectedSymbol})
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: TERMINAL_COLORS.textMuted, fontSize: 12 }}>
                    <th style={terminalCellStyle}>PRICE</th>
                    <th style={terminalCellStyle}>QTY</th>
                    <th style={terminalCellStyle}>NOTIONAL</th>
                  </tr>
                </thead>
                <tbody>
                  {(dexOrderBook?.asks || []).slice(0, 8).map((row) => (
                    <tr key={`wasi-dex-ask-${row.priceCentimes}`}>
                      <td style={{ ...terminalCellStyle, color: TERMINAL_COLORS.red }}>
                        {formatCentimes(row.priceCentimes)}
                      </td>
                      <td style={terminalCellStyle}>{row.quantityUnits}</td>
                      <td style={terminalCellStyle}>{formatCentimes(row.notionalCentimes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ ...terminalSectionHeaderStyle, fontSize: 13 }}>DEX RECENT TRADES</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: TERMINAL_COLORS.textMuted, fontSize: 12 }}>
                <th style={terminalCellStyle}>TIME</th>
                <th style={terminalCellStyle}>SYMBOL</th>
                <th style={terminalCellStyle}>PRICE</th>
                <th style={terminalCellStyle}>QTY</th>
                <th style={terminalCellStyle}>NOTIONAL</th>
              </tr>
            </thead>
            <tbody>
              {(dexRecentTrades || []).slice(0, 12).map((trade) => (
                <tr key={`wasi-dex-trade-${trade.id}`}>
                  <td style={terminalCellStyle}>{String(trade.createdAtUtc || "").slice(11, 19)}</td>
                  <td style={{ ...terminalCellStyle, color: TERMINAL_COLORS.cyan }}>{trade.symbol}</td>
                  <td style={terminalCellStyle}>{formatCentimes(trade.priceCentimes)}</td>
                  <td style={terminalCellStyle}>{trade.quantityUnits}</td>
                  <td style={terminalCellStyle}>{formatCentimes(trade.notionalCentimes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section
          style={{
            ...terminalPanelStyle,
            borderTop: "none",
            borderRight: "none",
            overflow: "auto",
            paddingBottom: 72,
          }}
        >
          <div style={terminalSectionHeaderStyle}>
            WATCHLIST
            <span style={{ float: "right", color: isLive ? TERMINAL_COLORS.green : TERMINAL_COLORS.amber }}>
              {isLive ? "LIVE" : isSnapshot ? "SNAP" : "DEMO"}
            </span>
          </div>
          <div style={{ padding: "4px 8px" }}>
            {watchlistRows.map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={() => onWatchlistClick(row)}
                style={{
                  ...terminalCellStyle,
                  width: "100%",
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  gap: 8,
                  textAlign: "left",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                <span style={{ color: TERMINAL_COLORS.text }}>{row.label}</span>
                <span style={{ color: TERMINAL_COLORS.text, fontWeight: 700 }}>{row.value}</span>
                <span style={{ color: row.color }}>{fmtSigned(row.change, 1)}</span>
              </button>
            ))}
          </div>

          <div style={terminalSectionHeaderStyle}>
            ALERTS
            <span style={{ float: "right", color: isLive ? TERMINAL_COLORS.green : TERMINAL_COLORS.amber }}>
              {isLive ? "LIVE" : isSnapshot ? "SNAP" : "DEMO"}
            </span>
          </div>
          <div style={{ padding: "4px 8px" }}>
            {eventRows.length === 0 ? (
              <div style={{ ...terminalCellStyle, color: TERMINAL_COLORS.textMuted }}>
                Aucun evenement actif.
              </div>
            ) : (
              eventRows.slice(0, 10).map((event, index) => (
                <button
                  key={`${event.event_type}-${index}`}
                  type="button"
                  onClick={() => openEventDetail(event)}
                  style={{
                    width: "100%",
                    ...terminalCellStyle,
                    background: "transparent",
                    border: "none",
                    color: TERMINAL_COLORS.text,
                    textAlign: "left",
                    cursor: "pointer",
                    display: "grid",
                    gridTemplateColumns: "52px 48px 1fr",
                    gap: 8,
                  }}
                >
                  <span style={{ color: TERMINAL_COLORS.textMuted }}>{event.timestamp || "--:--"}</span>
                  <span style={{ color: TERMINAL_COLORS.amber }}>{event.event_type}</span>
                  <span>{String(event.headline || "").slice(0, 70)}</span>
                </button>
              ))
            )}
          </div>

          <div style={terminalSectionHeaderStyle}>DEX ORDER ENTRY</div>
          <div style={{ padding: "8px 10px", display: "grid", gap: 8 }}>
            <select
              value={dexOrderForm?.side || "BUY"}
              onChange={(event) =>
                onDexOrderFormChange((previous) => ({ ...previous, side: event.target.value }))
              }
              style={{
                border: `1px solid ${TERMINAL_COLORS.border}`,
                background: TERMINAL_COLORS.bgSoft,
                color: TERMINAL_COLORS.text,
                padding: "8px 10px",
                fontFamily: "inherit",
              }}
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
            <select
              value={dexOrderForm?.symbol || dexSelectedSymbol || ""}
              onChange={(event) => {
                const symbol = event.target.value;
                onDexOrderFormChange((previous) => ({ ...previous, symbol }));
                onDexSelectSymbol(symbol);
              }}
              style={{
                border: `1px solid ${TERMINAL_COLORS.border}`,
                background: TERMINAL_COLORS.bgSoft,
                color: TERMINAL_COLORS.text,
                padding: "8px 10px",
                fontFamily: "inherit",
              }}
            >
              {(dexMarkets || []).map((market) => (
                <option key={`dex-order-symbol-${market.symbol}`} value={market.symbol}>
                  {market.symbol}
                </option>
              ))}
            </select>
            <input
              value={dexOrderForm?.quantityUnits || ""}
              onChange={(event) =>
                onDexOrderFormChange((previous) => ({
                  ...previous,
                  quantityUnits: event.target.value,
                }))
              }
              placeholder="Quantity units"
              style={{
                border: `1px solid ${TERMINAL_COLORS.border}`,
                background: TERMINAL_COLORS.bgSoft,
                color: TERMINAL_COLORS.text,
                padding: "8px 10px",
                fontFamily: "inherit",
              }}
            />
            <input
              value={dexOrderForm?.limitPriceXof || ""}
              onChange={(event) =>
                onDexOrderFormChange((previous) => ({
                  ...previous,
                  limitPriceXof: event.target.value,
                }))
              }
              placeholder="Limit price XOF (ex: 9500.00)"
              style={{
                border: `1px solid ${TERMINAL_COLORS.border}`,
                background: TERMINAL_COLORS.bgSoft,
                color: TERMINAL_COLORS.text,
                padding: "8px 10px",
                fontFamily: "inherit",
              }}
            />
            <button
              type="button"
              onClick={handleDexSubmit}
              disabled={dexSubmitting}
              style={{
                border: `1px solid ${TERMINAL_COLORS.amber}`,
                background: "transparent",
                color: TERMINAL_COLORS.amber,
                padding: "8px 10px",
                cursor: "pointer",
                fontFamily: "inherit",
                opacity: dexSubmitting ? 0.6 : 1,
              }}
            >
              {dexSubmitting ? "SUBMITTING..." : "SUBMIT ORDER"}
            </button>
            <div
              style={{
                minHeight: 18,
                fontSize: 12,
                color:
                  dexInlineMessageType === "error"
                    ? TERMINAL_COLORS.red
                    : dexInlineMessageType === "success"
                      ? TERMINAL_COLORS.green
                      : TERMINAL_COLORS.textMuted,
              }}
            >
              {dexInlineMessage || "Entrez quantite + prix, puis soumettez l'ordre."}
            </div>
          </div>

          <div style={terminalSectionHeaderStyle}>DEX PORTFOLIO</div>
          <div style={{ padding: "8px 10px", fontSize: 12, lineHeight: 1.7, color: TERMINAL_COLORS.text }}>
            CASH: <span style={{ color: TERMINAL_COLORS.green }}>
              {formatCentimes(dexWallet?.xofBalanceCentimes || "0")}
            </span>
            <br />
            AVAILABLE: <span style={{ color: TERMINAL_COLORS.cyan }}>
              {formatCentimes(dexWallet?.availableXofCentimes || "0")}
            </span>
            <br />
            POSITIONS: {(dexPositions || []).length}
          </div>

          <div style={terminalSectionHeaderStyle}>DEX OPEN ORDERS</div>
          <div style={{ padding: "4px 8px" }}>
            {(dexOpenOrders || []).length === 0 ? (
              <div style={{ ...terminalCellStyle, color: TERMINAL_COLORS.textMuted }}>
                No open orders.
              </div>
            ) : (
              dexOpenOrders.slice(0, 8).map((order) => (
                <div
                  key={`dex-open-${order.id}`}
                  style={{
                    ...terminalCellStyle,
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <span style={{ color: order.side === "BUY" ? TERMINAL_COLORS.green : TERMINAL_COLORS.red }}>
                      {order.side}
                    </span>{" "}
                    {order.symbol} {order.remainingQuantityUnits}@{formatCentimes(order.limitPriceCentimes)}
                  </div>
                  <button
                    type="button"
                    onClick={() => onDexCancelOrder(order.id)}
                    style={{
                      border: `1px solid ${TERMINAL_COLORS.border}`,
                      background: "transparent",
                      color: TERMINAL_COLORS.text,
                      padding: "4px 8px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    CANCEL
                  </button>
                </div>
              ))
            )}
          </div>

          <div style={terminalSectionHeaderStyle}>STATUS</div>
          <div style={{ padding: "8px 10px", fontSize: 12, lineHeight: 1.7, color: TERMINAL_COLORS.textMuted }}>
            SOURCE: {backendConnected ? "WASI API" : "FALLBACK"} ({dataSource || "unknown"})
            <br />
            USER: {userInfo?.username || "anonymous"}
            <br />
            MODES: F1=HELP | F5=REFRESH | F8=ALERTS
            <br />
            DEX: {(dexMarkets || []).length} ETFs | {dexOpenOrders.length} OPEN ORDERS
            <br />
            <button
              type="button"
              onClick={onToggleUSSD}
              style={{
                marginTop: 8,
                width: "100%",
                border: `1px solid ${TERMINAL_COLORS.border}`,
                background: TERMINAL_COLORS.bgSoft,
                color: TERMINAL_COLORS.amber,
                padding: "8px 10px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              OPEN USSD ANALYTICS
            </button>
            {dexError ? (
              <div style={{ marginTop: 8, color: TERMINAL_COLORS.red }}>
                DEX ERROR: {dexError}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <div
        style={{
          ...terminalPanelStyle,
          borderLeft: "none",
          borderRight: "none",
          borderBottom: "none",
          padding: "8px 10px",
          display: "grid",
          gridTemplateColumns: "54px 1fr auto",
          gap: 8,
          alignItems: "center",
        }}
      >
        <span style={{ color: TERMINAL_COLORS.amber, fontWeight: 700 }}>WASI&gt;</span>
        <input
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && !event.shiftKey && onSend()}
          placeholder="Type command ... (e.g. CI <GO>, BRVM <EQUITY>, COCOA <CMDTY>)"
          style={{
            border: `1px solid ${TERMINAL_COLORS.border}`,
            background: TERMINAL_COLORS.bgSoft,
            color: TERMINAL_COLORS.text,
            padding: "10px 12px",
            fontFamily: "inherit",
            fontSize: 13,
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={() => onSend()}
          disabled={loading || !String(input || "").trim()}
          style={{
            border: `1px solid ${TERMINAL_COLORS.amber}`,
            background: "transparent",
            color: TERMINAL_COLORS.amber,
            padding: "9px 12px",
            fontFamily: "inherit",
            cursor: "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "..." : "SEND"}
        </button>
      </div>
    </div>
  );
}
