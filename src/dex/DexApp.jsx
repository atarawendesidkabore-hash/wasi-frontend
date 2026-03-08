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
import { DexTerminalBoard } from "./components/DexTerminalBoard";

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
    <DexTerminalBoard
      backendConnected={backendConnected}
      loading={loading}
      submitting={submitting}
      authUser={authUser}
      error={error}
      markets={markets}
      selectedSymbol={selectedSymbol}
      setSelectedSymbol={setSelectedSymbol}
      orderBook={orderBook}
      recentTrades={recentTrades}
      portfolio={portfolio}
      loginForm={loginForm}
      setLoginForm={setLoginForm}
      onLogin={onLogin}
      onLogout={onLogout}
      orderForm={orderForm}
      setOrderForm={setOrderForm}
      onPlaceOrder={onPlaceOrder}
      onCancelOrder={onCancelOrder}
      formatCentimes={formatCentimes}
    />
  );
};
