import { useEffect, useMemo, useState } from "react";
import {
  cancelDexOrder,
  clearDexSession,
  fetchDexHealth,
  fetchDexMarkets,
  fetchDexMe,
  fetchDexOrderBook,
  fetchDexPortfolio,
  loginDex,
  placeDexOrder,
} from "./dexApi";

const screenStyle = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at 20% 10%, #0d2b1a 0%, #03180f 40%, #020c08 100%)",
  color: "#e8f5ee",
  fontFamily: "'Space Mono', monospace",
  padding: 24,
};

const panelStyle = {
  border: "1px solid rgba(232,245,238,0.2)",
  borderRadius: 16,
  background: "rgba(8, 26, 17, 0.78)",
  padding: 16,
  backdropFilter: "blur(8px)",
};

const inputStyle = {
  width: "100%",
  borderRadius: 8,
  border: "1px solid rgba(201,168,76,0.45)",
  background: "rgba(255,255,255,0.04)",
  color: "#e8f5ee",
  padding: "10px 12px",
  fontFamily: "inherit",
};

const buttonStyle = {
  border: "none",
  borderRadius: 8,
  background: "#1a7a4a",
  color: "#fff",
  padding: "10px 14px",
  fontFamily: "inherit",
  cursor: "pointer",
  fontWeight: 700,
};

const DEMO_CREDENTIALS = [
  { role: "CLIENT", username: "client_demo", password: "client123" },
  { role: "TELLER", username: "teller_demo", password: "teller123" },
  { role: "MANAGER", username: "manager_demo", password: "manager123" },
];

const toBigInt = (value) => BigInt(String(value ?? "0"));

const formatCentimes = (value) => {
  const amount = toBigInt(value);
  const sign = amount < 0n ? "-" : "";
  const abs = amount < 0n ? -amount : amount;
  const whole = abs / 100n;
  const cents = abs % 100n;
  const groupedWhole = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${groupedWhole}.${cents.toString().padStart(2, "0")} XOF`;
};

const toInputXofString = (value) => {
  const amount = toBigInt(value);
  const whole = amount / 100n;
  const cents = amount % 100n;
  return `${whole.toString()}.${cents.toString().padStart(2, "0")}`;
};

const parseXofInputToCentimes = (amountInput) => {
  const normalized = String(amountInput || "").trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Invalid price format.");
  }
  const [wholePart, fractionalPart = ""] = normalized.split(".");
  return (BigInt(wholePart) * 100n + BigInt(fractionalPart.padEnd(2, "0"))).toString();
};

const parseQuantityInput = (quantityInput) => {
  const normalized = String(quantityInput || "").trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error("Quantity must be a positive integer.");
  }
  const value = BigInt(normalized);
  if (value <= 0n) {
    throw new Error("Quantity must be greater than zero.");
  }
  return value.toString();
};

export const DexApp = () => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [error, setError] = useState("");
  const [authUser, setAuthUser] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [recentTrades, setRecentTrades] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [orderBook, setOrderBook] = useState({ symbol: "", bids: [], asks: [] });
  const [portfolio, setPortfolio] = useState(null);
  const [loginForm, setLoginForm] = useState({
    username: DEMO_CREDENTIALS[0].username,
    password: DEMO_CREDENTIALS[0].password,
  });
  const [orderForm, setOrderForm] = useState({
    side: "BUY",
    symbol: "",
    quantityUnits: "",
    limitPriceXof: "",
  });

  const selectedMarket = useMemo(
    () => markets.find((market) => market.symbol === selectedSymbol) ?? null,
    [markets, selectedSymbol]
  );

  const clearError = () => setError("");

  const refreshPublicData = async (symbolHint = null) => {
    const marketPayload = await fetchDexMarkets();
    const nextMarkets = marketPayload.markets || [];
    const nextTrades = marketPayload.recentTrades || [];
    setMarkets(nextMarkets);
    setRecentTrades(nextTrades);

    const effectiveSymbol = symbolHint || selectedSymbol || nextMarkets[0]?.symbol || "";
    if (effectiveSymbol) {
      setSelectedSymbol(effectiveSymbol);
      const bookPayload = await fetchDexOrderBook(effectiveSymbol, 12);
      setOrderBook(bookPayload.orderBook || { symbol: effectiveSymbol, bids: [], asks: [] });
    } else {
      setOrderBook({ symbol: "", bids: [], asks: [] });
    }
  };

  const refreshPrivateData = async () => {
    if (!authUser) return;
    const payload = await fetchDexPortfolio();
    setPortfolio(payload.portfolio || null);
  };

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        await fetchDexHealth();
        if (cancelled) return;
        setBackendConnected(true);
        await refreshPublicData();

        try {
          const me = await fetchDexMe();
          if (cancelled) return;
          setAuthUser(me);
        } catch {
          if (cancelled) return;
          setAuthUser(null);
        }
      } catch {
        if (cancelled) return;
        setBackendConnected(false);
        setError("DEX backend is not reachable. Start with: npm run dev:full");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!backendConnected) return;
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      try {
        await refreshPublicData(selectedSymbol);
        if (authUser) {
          await refreshPrivateData();
        }
      } catch {
        if (!cancelled) {
          setError("Live refresh failed. Retrying...");
        }
      }
    };
    const id = setInterval(run, 7000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [backendConnected, authUser, selectedSymbol]);

  useEffect(() => {
    if (!selectedSymbol) return;
    setOrderForm((previous) => ({
      ...previous,
      symbol: selectedSymbol,
      limitPriceXof: previous.limitPriceXof || toInputXofString(selectedMarket?.lastPriceCentimes || "0"),
    }));
  }, [selectedSymbol, selectedMarket]);

  useEffect(() => {
    if (!selectedSymbol) return;
    fetchDexOrderBook(selectedSymbol, 12)
      .then((payload) => {
        setOrderBook(payload.orderBook || { symbol: selectedSymbol, bids: [], asks: [] });
      })
      .catch(() => {
        setError("Failed to load orderbook for selected symbol.");
      });
  }, [selectedSymbol]);

  useEffect(() => {
    if (!authUser) {
      setPortfolio(null);
      return;
    }
    refreshPrivateData().catch(() => {
      setError("Failed to load DEX portfolio.");
    });
  }, [authUser]);

  const onLogin = async (event) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      clearError();
      const user = await loginDex(loginForm);
      setAuthUser(user);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onLogout = () => {
    clearDexSession();
    setAuthUser(null);
    setPortfolio(null);
    setError("Session closed.");
  };

  const onPlaceOrder = async (event) => {
    event.preventDefault();
    if (!authUser) {
      setError("Please sign in first.");
      return;
    }
    try {
      setSubmitting(true);
      clearError();

      const payload = await placeDexOrder({
        symbol: orderForm.symbol || selectedSymbol,
        side: orderForm.side,
        quantityUnits: parseQuantityInput(orderForm.quantityUnits),
        limitPriceCentimes: parseXofInputToCentimes(orderForm.limitPriceXof),
      });

      setOrderBook(payload.orderBook || orderBook);
      setPortfolio(payload.portfolio || portfolio);
      if (payload.market) {
        setMarkets((previous) =>
          previous.map((market) =>
            market.symbol === payload.market.symbol ? payload.market : market
          )
        );
      } else {
        await refreshPublicData(orderForm.symbol || selectedSymbol);
      }
      setOrderForm((previous) => ({ ...previous, quantityUnits: "" }));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onCancelOrder = async (orderId) => {
    try {
      setSubmitting(true);
      clearError();
      const payload = await cancelDexOrder(orderId);
      setOrderBook(payload.orderBook || orderBook);
      setPortfolio(payload.portfolio || portfolio);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={screenStyle}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 16 }}>
        <section style={{ ...panelStyle, borderColor: "rgba(201,168,76,0.55)" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a href="?app=wasi" style={{ color: "#c9a84c", textDecoration: "none" }}>WASI Terminal</a>
              <span style={{ opacity: 0.6 }}>|</span>
              <a href="?app=banking" style={{ color: "#c9a84c", textDecoration: "none" }}>Banking App</a>
            </div>
            {authUser ? (
              <button onClick={onLogout} style={buttonStyle} type="button">
                Logout ({authUser.role})
              </button>
            ) : null}
          </div>
          <h1 style={{ marginBottom: 8, color: "#c9a84c" }}>WASI ETF DEX</h1>
          <p style={{ margin: 0, color: backendConnected ? "#4ade80" : "#f0b429" }}>
            {backendConnected
              ? "On-chain style orderbook simulator (local settlement)"
              : "Backend offline"}
          </p>
          {authUser ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: "#93c5fd" }}>
              Signed in as: <strong>{authUser.displayName || authUser.username}</strong>
            </p>
          ) : null}
        </section>

        {error ? (
          <section style={{ ...panelStyle, borderColor: "rgba(220,38,38,0.8)" }}>
            <strong style={{ color: "#fda4af" }}>Info:</strong> {error}
          </section>
        ) : null}

        {!authUser ? (
          <section style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Sign in to trade</h2>
            <form onSubmit={onLogin} style={{ display: "grid", gap: 10, maxWidth: 420 }}>
              <label>
                Username
                <input
                  style={inputStyle}
                  value={loginForm.username}
                  onChange={(event) =>
                    setLoginForm((previous) => ({ ...previous, username: event.target.value }))
                  }
                />
              </label>
              <label>
                Password
                <input
                  style={inputStyle}
                  type="password"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm((previous) => ({ ...previous, password: event.target.value }))
                  }
                />
              </label>
              <button style={buttonStyle} type="submit">
                {submitting ? "Signing in..." : "Sign in"}
              </button>
            </form>
            <p style={{ marginTop: 12, marginBottom: 6, color: "#c9a84c" }}>Demo credentials:</p>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {DEMO_CREDENTIALS.map((demo) => (
                <li key={demo.role}>
                  {demo.role}: {demo.username} / {demo.password}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section style={{ ...panelStyle, overflowX: "auto" }}>
          <h2 style={{ marginTop: 0 }}>Markets</h2>
          <p style={{ marginTop: 0, opacity: 0.8 }}>Catalog loaded: {markets.length} ETFs</p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", paddingBottom: 8 }}>Symbol</th>
                <th style={{ textAlign: "left", paddingBottom: 8 }}>Category</th>
                <th style={{ textAlign: "left", paddingBottom: 8 }}>Fee</th>
                <th style={{ textAlign: "left", paddingBottom: 8 }}>Last</th>
                <th style={{ textAlign: "left", paddingBottom: 8 }}>Bid</th>
                <th style={{ textAlign: "left", paddingBottom: 8 }}>Ask</th>
                <th style={{ textAlign: "left", paddingBottom: 8 }}>Vol 24h</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((market) => (
                <tr
                  key={market.symbol}
                  onClick={() => setSelectedSymbol(market.symbol)}
                  style={{
                    cursor: "pointer",
                    background:
                      selectedSymbol === market.symbol ? "rgba(201,168,76,0.14)" : "transparent",
                  }}
                >
                  <td style={{ padding: "8px 0", color: "#f0b429", fontWeight: 700 }}>{market.symbol}</td>
                  <td>{market.category}</td>
                  <td>{(Number(market.feeBps || 0) / 100).toFixed(2)}%</td>
                  <td>{formatCentimes(market.lastPriceCentimes)}</td>
                  <td>{market.bestBidCentimes ? formatCentimes(market.bestBidCentimes) : "-"}</td>
                  <td>{market.bestAskCentimes ? formatCentimes(market.bestAskCentimes) : "-"}</td>
                  <td>{market.volume24hUnits || "0"} u</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section style={{ display: "grid", gap: 12, gridTemplateColumns: "2fr 1fr" }}>
          <div style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Orderbook {selectedSymbol ? `(${selectedSymbol})` : ""}</h2>
            {selectedMarket ? (
              <p style={{ marginTop: 0, opacity: 0.8 }}>
                {selectedMarket.name} | Fee {(Number(selectedMarket.feeBps || 0) / 100).toFixed(2)}% | {selectedMarket.underlying}
              </p>
            ) : null}
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <h3 style={{ color: "#4ade80" }}>Bids</h3>
                {(orderBook.bids || []).map((row) => (
                  <div key={`bid-${row.priceCentimes}`} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{formatCentimes(row.priceCentimes)}</span>
                    <span>{row.quantityUnits}</span>
                  </div>
                ))}
              </div>
              <div>
                <h3 style={{ color: "#fb7185" }}>Asks</h3>
                {(orderBook.asks || []).map((row) => (
                  <div key={`ask-${row.priceCentimes}`} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{formatCentimes(row.priceCentimes)}</span>
                    <span>{row.quantityUnits}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <form onSubmit={onPlaceOrder} style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Place Order</h2>
            <label>
              Side
              <select
                style={inputStyle}
                value={orderForm.side}
                onChange={(event) =>
                  setOrderForm((previous) => ({ ...previous, side: event.target.value }))
                }
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </label>
            <label style={{ display: "block", marginTop: 10 }}>
              ETF
              <select
                style={inputStyle}
                value={orderForm.symbol || selectedSymbol}
                onChange={(event) => {
                  setOrderForm((previous) => ({ ...previous, symbol: event.target.value }));
                  setSelectedSymbol(event.target.value);
                }}
              >
                {(markets || []).map((market) => (
                  <option key={market.symbol} value={market.symbol}>
                    {market.symbol}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "block", marginTop: 10 }}>
              Quantity (units)
              <input
                style={inputStyle}
                value={orderForm.quantityUnits}
                onChange={(event) =>
                  setOrderForm((previous) => ({ ...previous, quantityUnits: event.target.value }))
                }
                placeholder="100"
                inputMode="numeric"
                required
              />
            </label>
            <label style={{ display: "block", marginTop: 10 }}>
              Limit Price (XOF)
              <input
                style={inputStyle}
                value={orderForm.limitPriceXof}
                onChange={(event) =>
                  setOrderForm((previous) => ({ ...previous, limitPriceXof: event.target.value }))
                }
                placeholder="9500.00"
                required
              />
            </label>
            <button style={{ ...buttonStyle, marginTop: 12 }} type="submit" disabled={submitting || !authUser}>
              {submitting ? "Submitting..." : "Submit Order"}
            </button>
          </form>
        </section>

        {portfolio ? (
          <section style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <div style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>Wallet + Positions</h2>
              <p style={{ marginTop: 0 }}>
                Cash: <strong>{formatCentimes(portfolio.wallet?.xofBalanceCentimes || "0")}</strong>
              </p>
              <p>
                Available: <strong>{formatCentimes(portfolio.wallet?.availableXofCentimes || "0")}</strong>
              </p>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", paddingBottom: 8 }}>Symbol</th>
                    <th style={{ textAlign: "left", paddingBottom: 8 }}>Units</th>
                    <th style={{ textAlign: "left", paddingBottom: 8 }}>Mark</th>
                  </tr>
                </thead>
                <tbody>
                  {(portfolio.positions || []).length === 0 ? (
                    <tr>
                      <td colSpan={3}>No position.</td>
                    </tr>
                  ) : (
                    (portfolio.positions || []).map((position) => (
                      <tr key={position.symbol}>
                        <td>{position.symbol}</td>
                        <td>{position.quantityUnits}</td>
                        <td>{position.markPriceCentimes ? formatCentimes(position.markPriceCentimes) : "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>Open Orders</h2>
              {(portfolio.openOrders || []).length === 0 ? (
                <p>No open orders.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", paddingBottom: 8 }}>Side</th>
                      <th style={{ textAlign: "left", paddingBottom: 8 }}>Symbol</th>
                      <th style={{ textAlign: "left", paddingBottom: 8 }}>Remaining</th>
                      <th style={{ textAlign: "left", paddingBottom: 8 }}>Limit</th>
                      <th style={{ textAlign: "left", paddingBottom: 8 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(portfolio.openOrders || []).map((order) => (
                      <tr key={order.id}>
                        <td style={{ color: order.side === "BUY" ? "#4ade80" : "#fb7185" }}>{order.side}</td>
                        <td>{order.symbol}</td>
                        <td>{order.remainingQuantityUnits}</td>
                        <td>{formatCentimes(order.limitPriceCentimes)}</td>
                        <td>
                          <button
                            onClick={() => onCancelOrder(order.id)}
                            type="button"
                            style={{ ...buttonStyle, background: "#334155", padding: "6px 10px" }}
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        ) : null}

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Recent Trades</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", paddingBottom: 8 }}>Time</th>
                <th style={{ textAlign: "left", paddingBottom: 8 }}>Symbol</th>
                <th style={{ textAlign: "left", paddingBottom: 8 }}>Price</th>
                <th style={{ textAlign: "left", paddingBottom: 8 }}>Quantity</th>
                <th style={{ textAlign: "left", paddingBottom: 8 }}>Notional</th>
              </tr>
            </thead>
            <tbody>
              {(recentTrades || []).slice(0, 25).map((trade) => (
                <tr key={trade.id}>
                  <td>{trade.createdAtUtc}</td>
                  <td>{trade.symbol}</td>
                  <td>{formatCentimes(trade.priceCentimes)}</td>
                  <td>{trade.quantityUnits}</td>
                  <td>{formatCentimes(trade.notionalCentimes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {loading ? (
        <div style={{ position: "fixed", bottom: 16, right: 16, color: "#c9a84c" }}>
          Loading DEX...
        </div>
      ) : null}
    </main>
  );
};
