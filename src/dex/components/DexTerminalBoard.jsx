import { useEffect, useMemo, useState } from "react";
import {
  TERMINAL_COLORS,
  terminalShellStyle,
  terminalPanelStyle,
  terminalSectionHeaderStyle,
  terminalCellStyle,
  changeColor,
  fmtSigned,
} from "../../platform/terminalChrome";

const sectionTitle = (title) => (
  <div style={{ ...terminalSectionHeaderStyle, fontSize: 13 }}>{title}</div>
);

export function DexTerminalBoard({
  backendConnected,
  loading,
  submitting,
  authUser,
  error,
  markets,
  selectedSymbol,
  setSelectedSymbol,
  orderBook,
  recentTrades,
  portfolio,
  loginForm,
  setLoginForm,
  onLogin,
  onLogout,
  orderForm,
  setOrderForm,
  onPlaceOrder,
  onCancelOrder,
  formatCentimes,
}) {
  const [clock, setClock] = useState(() =>
    new Date().toLocaleTimeString("fr-FR", { hour12: false })
  );

  useEffect(() => {
    const id = setInterval(() => {
      setClock(new Date().toLocaleTimeString("fr-FR", { hour12: false }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const watchlist = useMemo(() => {
    return [...markets]
      .sort((a, b) => Number(b.volume24hUnits || 0) - Number(a.volume24hUnits || 0))
      .slice(0, 8);
  }, [markets]);

  const tickerItems = [
    { kind: "brand" },
    { kind: "status", live: backendConnected },
    { kind: "user", username: authUser?.username || "guest" },
    ...watchlist.slice(0, 6).map((market) => ({
      kind: "market",
      symbol: market.symbol,
      value: Number(market.lastPriceCentimes || 0) / 100,
      change: market.changePct24h || 0,
    })),
  ];

  const renderTickerSegment = (item, key) => {
    if (item.kind === "brand") {
      return (
        <span key={key} className="dex-ticker-segment" style={{ color: TERMINAL_COLORS.amber, fontWeight: 700 }}>
          WASI ETF DEX
        </span>
      );
    }

    if (item.kind === "status") {
      return (
        <span key={key} className="dex-ticker-segment" style={{ color: item.live ? TERMINAL_COLORS.green : TERMINAL_COLORS.red }}>
          {item.live ? "LIVE" : "OFFLINE"}
        </span>
      );
    }

    if (item.kind === "user") {
      return (
        <span key={key} className="dex-ticker-segment" style={{ color: TERMINAL_COLORS.text }}>
          {item.username}
        </span>
      );
    }

    return (
      <span key={key} className="dex-ticker-segment">
        <span style={{ color: TERMINAL_COLORS.amber }}>{item.symbol}</span>
        <span>{item.value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</span>
        <span style={{ color: changeColor(item.change) }}>{fmtSigned(item.change, 2)}%</span>
      </span>
    );
  };

  const openOrders = portfolio?.openOrders || [];
  const positions = portfolio?.positions || [];

  return (
    <main style={terminalShellStyle}>
      <style>{`
        .dex-terminal-grid { grid-template-columns: 360px 1fr 300px; }
        .dex-ticker-bar {
          position: relative;
          overflow: hidden;
          padding-right: 92px;
        }
        .dex-ticker-marquee {
          overflow: hidden;
          width: 100%;
        }
        .dex-ticker-track {
          display: inline-flex;
          align-items: center;
          gap: 22px;
          width: max-content;
          white-space: nowrap;
          animation: dexTickerScroll 14s linear infinite;
          will-change: transform;
        }
        .dex-ticker-segment {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: ${TERMINAL_COLORS.text};
          flex: 0 0 auto;
          font-size: 13px;
        }
        .dex-ticker-clock {
          position: absolute;
          top: 50%;
          right: 10px;
          transform: translateY(-50%);
          color: ${TERMINAL_COLORS.textMuted};
          background: ${TERMINAL_COLORS.bgPanel};
          padding-left: 12px;
          font-size: 13px;
        }
        @keyframes dexTickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @media (max-width: 1280px) {
          .dex-terminal-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div
        className="dex-ticker-bar"
        style={{
          ...terminalPanelStyle,
          borderLeft: "none",
          borderRight: "none",
          borderTop: "none",
          padding: "8px 10px",
        }}
      >
        <div className="dex-ticker-marquee">
          <div className="dex-ticker-track">
            {tickerItems.map((item, index) => renderTickerSegment(item, `dex-ticker-a-${index}`))}
            {tickerItems.map((item, index) => renderTickerSegment(item, `dex-ticker-b-${index}`))}
          </div>
        </div>
        <span className="dex-ticker-clock">{clock}</span>
      </div>

      <div
        className="dex-terminal-grid"
        style={{
          display: "grid",
          gap: 0,
          flex: 1,
          minHeight: 0,
        }}
      >
        <section style={{ ...terminalPanelStyle, borderTop: "none", borderLeft: "none", overflow: "auto" }}>
          {sectionTitle("WASI ETF CATALOG")}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: TERMINAL_COLORS.textMuted, fontSize: 12 }}>
                <th style={terminalCellStyle}>#</th>
                <th style={terminalCellStyle}>TICKER</th>
                <th style={terminalCellStyle}>CAT</th>
                <th style={terminalCellStyle}>LAST</th>
                <th style={terminalCellStyle}>CHG</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((market, index) => (
                <tr
                  key={market.symbol}
                  onClick={() => setSelectedSymbol(market.symbol)}
                  style={{
                    cursor: "pointer",
                    background:
                      selectedSymbol === market.symbol
                        ? "rgba(240,180,41,0.10)"
                        : "transparent",
                  }}
                >
                  <td style={terminalCellStyle}>{index + 1}</td>
                  <td style={{ ...terminalCellStyle, color: TERMINAL_COLORS.cyan, fontWeight: 700 }}>
                    {market.symbol}
                  </td>
                  <td style={terminalCellStyle}>{market.category}</td>
                  <td style={{ ...terminalCellStyle, color: TERMINAL_COLORS.text, fontWeight: 700 }}>
                    {formatCentimes(market.lastPriceCentimes || "0")}
                  </td>
                  <td
                    style={{
                      ...terminalCellStyle,
                      color: changeColor(market.changePct24h || 0),
                    }}
                  >
                    {fmtSigned(market.changePct24h || 0, 2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {sectionTitle("PORTFOLIO")}
          <div style={{ padding: "8px 10px", fontSize: 13, lineHeight: 1.6 }}>
            <div>
              Cash:{" "}
              <strong style={{ color: TERMINAL_COLORS.green }}>
                {formatCentimes(portfolio?.wallet?.xofBalanceCentimes || "0")}
              </strong>
            </div>
            <div>
              Available:{" "}
              <strong style={{ color: TERMINAL_COLORS.cyan }}>
                {formatCentimes(portfolio?.wallet?.availableXofCentimes || "0")}
              </strong>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: TERMINAL_COLORS.textMuted, fontSize: 12 }}>
                <th style={terminalCellStyle}>SYMBOL</th>
                <th style={terminalCellStyle}>UNITS</th>
                <th style={terminalCellStyle}>MARK</th>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ ...terminalCellStyle, color: TERMINAL_COLORS.textMuted }}>
                    No positions yet.
                  </td>
                </tr>
              ) : (
                positions.map((position) => (
                  <tr key={position.symbol}>
                    <td style={terminalCellStyle}>{position.symbol}</td>
                    <td style={terminalCellStyle}>{position.quantityUnits}</td>
                    <td style={terminalCellStyle}>
                      {position.markPriceCentimes
                        ? formatCentimes(position.markPriceCentimes)
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section style={{ ...terminalPanelStyle, borderTop: "none", overflow: "auto" }}>
          {sectionTitle(`ORDERBOOK - ${orderBook.symbol || selectedSymbol || "N/A"}`)}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
            <div style={{ borderRight: `1px solid ${TERMINAL_COLORS.border}` }}>
              <div style={{ ...terminalSectionHeaderStyle, color: TERMINAL_COLORS.green }}>BIDS</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: TERMINAL_COLORS.textMuted, fontSize: 12 }}>
                    <th style={terminalCellStyle}>PRICE</th>
                    <th style={terminalCellStyle}>QTY</th>
                    <th style={terminalCellStyle}>NOTIONAL</th>
                  </tr>
                </thead>
                <tbody>
                  {(orderBook.bids || []).slice(0, 12).map((row) => (
                    <tr key={`bid-${row.priceCentimes}`}>
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
              <div style={{ ...terminalSectionHeaderStyle, color: TERMINAL_COLORS.red }}>ASKS</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: TERMINAL_COLORS.textMuted, fontSize: 12 }}>
                    <th style={terminalCellStyle}>PRICE</th>
                    <th style={terminalCellStyle}>QTY</th>
                    <th style={terminalCellStyle}>NOTIONAL</th>
                  </tr>
                </thead>
                <tbody>
                  {(orderBook.asks || []).slice(0, 12).map((row) => (
                    <tr key={`ask-${row.priceCentimes}`}>
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

          {sectionTitle("TRADE TAPE")}
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
              {recentTrades.slice(0, 20).map((trade) => (
                <tr key={trade.id}>
                  <td style={terminalCellStyle}>{trade.createdAtUtc?.slice(11, 19)}</td>
                  <td style={{ ...terminalCellStyle, color: TERMINAL_COLORS.cyan }}>{trade.symbol}</td>
                  <td style={terminalCellStyle}>{formatCentimes(trade.priceCentimes)}</td>
                  <td style={terminalCellStyle}>{trade.quantityUnits}</td>
                  <td style={terminalCellStyle}>{formatCentimes(trade.notionalCentimes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section style={{ ...terminalPanelStyle, borderTop: "none", borderRight: "none", overflow: "auto" }}>
          {sectionTitle("SESSION")}
          {authUser ? (
            <div style={{ padding: "10px 12px", fontSize: 13, lineHeight: 1.7 }}>
              <div>User: {authUser.displayName || authUser.username}</div>
              <div>Role: {authUser.role}</div>
              <button
                onClick={onLogout}
                type="button"
                style={{
                  marginTop: 8,
                  width: "100%",
                  border: `1px solid ${TERMINAL_COLORS.amber}`,
                  background: "transparent",
                  color: TERMINAL_COLORS.amber,
                  padding: "8px 10px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                LOGOUT
              </button>
            </div>
          ) : (
            <form onSubmit={onLogin} style={{ padding: "10px 12px", display: "grid", gap: 8 }}>
              <div style={{ color: TERMINAL_COLORS.textMuted, fontSize: 12, lineHeight: 1.5 }}>
                Use a platform account. Demo access is available only when explicitly enabled.
              </div>
              <input
                value={loginForm.username}
                onChange={(event) =>
                  setLoginForm((previous) => ({ ...previous, username: event.target.value }))
                }
                placeholder="username"
                style={{
                  border: `1px solid ${TERMINAL_COLORS.border}`,
                  background: TERMINAL_COLORS.bgSoft,
                  color: TERMINAL_COLORS.text,
                  padding: "8px 10px",
                  fontFamily: "inherit",
                }}
              />
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((previous) => ({ ...previous, password: event.target.value }))
                }
                placeholder="password"
                style={{
                  border: `1px solid ${TERMINAL_COLORS.border}`,
                  background: TERMINAL_COLORS.bgSoft,
                  color: TERMINAL_COLORS.text,
                  padding: "8px 10px",
                  fontFamily: "inherit",
                }}
              />
              <button
                type="submit"
                disabled={submitting}
                style={{
                  border: `1px solid ${TERMINAL_COLORS.amber}`,
                  background: "transparent",
                  color: TERMINAL_COLORS.amber,
                  padding: "8px 10px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {submitting ? "SIGNING..." : "SIGN IN"}
              </button>
            </form>
          )}

          {sectionTitle("PLACE ORDER")}
          <form onSubmit={onPlaceOrder} style={{ padding: "10px 12px", display: "grid", gap: 8 }}>
            <select
              value={orderForm.side}
              onChange={(event) =>
                setOrderForm((previous) => ({ ...previous, side: event.target.value }))
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
              value={orderForm.symbol || selectedSymbol}
              onChange={(event) => {
                setOrderForm((previous) => ({ ...previous, symbol: event.target.value }));
                setSelectedSymbol(event.target.value);
              }}
              style={{
                border: `1px solid ${TERMINAL_COLORS.border}`,
                background: TERMINAL_COLORS.bgSoft,
                color: TERMINAL_COLORS.text,
                padding: "8px 10px",
                fontFamily: "inherit",
              }}
            >
              {markets.map((market) => (
                <option key={market.symbol} value={market.symbol}>
                  {market.symbol}
                </option>
              ))}
            </select>
            <input
              value={orderForm.quantityUnits}
              onChange={(event) =>
                setOrderForm((previous) => ({ ...previous, quantityUnits: event.target.value }))
              }
              placeholder="quantity units"
              style={{
                border: `1px solid ${TERMINAL_COLORS.border}`,
                background: TERMINAL_COLORS.bgSoft,
                color: TERMINAL_COLORS.text,
                padding: "8px 10px",
                fontFamily: "inherit",
              }}
            />
            <input
              value={orderForm.limitPriceXof}
              onChange={(event) =>
                setOrderForm((previous) => ({ ...previous, limitPriceXof: event.target.value }))
              }
              placeholder="limit price (XOF)"
              style={{
                border: `1px solid ${TERMINAL_COLORS.border}`,
                background: TERMINAL_COLORS.bgSoft,
                color: TERMINAL_COLORS.text,
                padding: "8px 10px",
                fontFamily: "inherit",
              }}
            />
            <button
              type="submit"
              disabled={submitting || !authUser}
              style={{
                border: `1px solid ${TERMINAL_COLORS.amber}`,
                background: "transparent",
                color: TERMINAL_COLORS.amber,
                padding: "8px 10px",
                cursor: "pointer",
                fontFamily: "inherit",
                opacity: authUser ? 1 : 0.6,
              }}
            >
              {submitting ? "SUBMITTING..." : "SUBMIT ORDER"}
            </button>
          </form>

          {sectionTitle("OPEN ORDERS")}
          <div style={{ padding: "4px 8px" }}>
            {openOrders.length === 0 ? (
              <div style={{ ...terminalCellStyle, color: TERMINAL_COLORS.textMuted }}>
                No open orders.
              </div>
            ) : (
              openOrders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    ...terminalCellStyle,
                    display: "grid",
                    gridTemplateColumns: "50px 1fr auto",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: order.side === "BUY" ? TERMINAL_COLORS.green : TERMINAL_COLORS.red }}>
                    {order.side}
                  </span>
                  <span>{order.symbol} {order.remainingQuantityUnits}</span>
                  <button
                    onClick={() => onCancelOrder(order.id)}
                    type="button"
                    style={{
                      border: `1px solid ${TERMINAL_COLORS.border}`,
                      background: "transparent",
                      color: TERMINAL_COLORS.text,
                      padding: "4px 8px",
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    CANCEL
                  </button>
                </div>
              ))
            )}
          </div>

          {error ? (
            <>
              {sectionTitle("ALERT")}
              <div style={{ ...terminalCellStyle, color: TERMINAL_COLORS.red, padding: "10px 12px" }}>
                {error}
              </div>
            </>
          ) : null}
        </section>
      </div>

      <div
        style={{
          ...terminalPanelStyle,
          borderLeft: "none",
          borderRight: "none",
          borderBottom: "none",
          padding: "8px 10px",
          color: TERMINAL_COLORS.textMuted,
          fontSize: 12,
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span>DEX&gt; Click ETF row, set order, submit. Orders are idempotent.</span>
        <span>F1=HELP | F5=REFRESH | F8=ALERTS</span>
      </div>

      {loading ? (
        <div style={{ position: "fixed", bottom: 12, right: 12, color: TERMINAL_COLORS.amber }}>
          Loading DEX...
        </div>
      ) : null}
    </main>
  );
}
