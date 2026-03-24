import { useEffect, useMemo, useRef, useState } from "react";
import {
  getLocalResourceHref,
  getPlatformApp,
  getWorkspaceForApp,
  getWorkspaceGroup,
  LOCAL_REFERENCE_PACKS,
} from "./platformCatalog";
import { fetchCoinGeckoSnapshot, fetchOpenErFxSnapshot } from "../wasi/services/freeLiveData";

const APP_STORAGE_KEY = "WASI_SELECTED_APP";
const ACCESS_SESSION_STORAGE_KEY = "WASI_UNIFIED_ACCESS_PROFILE";
const WORKSPACE_PANEL_AUTO_HIDE_MS = 6500;
const PLATFORM_SHELL_ID = "wasi-platform-shell";
const DEX_TICKER_PRIORITY = ["CIREX", "WASI-COMP", "WASI-UEMOA", "BRVM-C", "WASI-BRVM"];
const shellMono = "'IBM Plex Mono', 'Space Mono', monospace";
const shellSans = "'Sora', 'Space Grotesk', sans-serif";

const ACCESS_KEYS = {
  "WASI-THOMAS-TK01": {
    name: "Thomas Kabore",
    role: "Fondateur",
    tier: "INSTITUTIONAL",
    quotaLabel: "Acces illimite",
  },
  "WASI-ECOBANK-EB01": {
    name: "Ecobank BF",
    role: "Banque partenaire",
    tier: "PRO",
    quotaLabel: "500 req",
  },
  "WASI-CORIS-CB02": {
    name: "Coris Bank",
    role: "Banque partenaire",
    tier: "PRO",
    quotaLabel: "500 req",
  },
  "WASI-DEMO-DM01": {
    name: "Demo investisseur",
    role: "Invite de demonstration",
    tier: "BASIC",
    quotaLabel: "50 req",
  },
  "WASI-CAPGEMINI-CG01": {
    name: "Capgemini Paris",
    role: "Partenaire tech",
    tier: "PRO",
    quotaLabel: "500 req",
  },
  "WASI-ESG-ES01": {
    name: "ESG Finance Paris",
    role: "Partenaire academique",
    tier: "BASIC",
    quotaLabel: "50 req",
  },
};

const WORKSPACE_BRIDGE_HINTS = {
  home: "Accueil de pilotage de la suite relie a Intelligence, DEX, Banque et Operations Finance.",
  intelligence:
    "WASI Intelligence alimente les hypotheses, puis DEX et AfriTrade transforment la lecture de marche en action.",
  execution:
    "AfriTrade Banque est relie a WASI Intelligence pour la decision et a WASI DEX pour la mise sur le marche.",
  financeops:
    "Finance Ops boucle la chaine entre Banque, analyse, comptabilite OHADA et fiscalite.",
};

const closeButtonStyle = {
  border: "1px solid rgba(26,58,92,0.95)",
  background: "transparent",
  color: "#94a3b8",
  borderRadius: 999,
  width: 28,
  height: 28,
  cursor: "pointer",
};

const accessGateStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#030b15",
  padding: 16,
};

const readStoredAccessProfile = () => {
  if (typeof window === "undefined") return null;
  const rawValue = window.sessionStorage.getItem(ACCESS_SESSION_STORAGE_KEY);
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed?.key || !ACCESS_KEYS[parsed.key]) {
      window.sessionStorage.removeItem(ACCESS_SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    window.sessionStorage.removeItem(ACCESS_SESSION_STORAGE_KEY);
    return null;
  }
};

const persistAccessProfile = (profile) => {
  if (typeof window === "undefined") return;
  if (!profile) {
    window.sessionStorage.removeItem(ACCESS_SESSION_STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(ACCESS_SESSION_STORAGE_KEY, JSON.stringify(profile));
};

export const normalizeAppId = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["home", "workspace", "hub", "dashboard"].includes(normalized)) return "home";
  if (["sales", "demo", "kit", "commercial", "pitch", "partnership"].includes(normalized))
    return "sales";
  if (["banking", "bank", "wallet", "execution", "treasury"].includes(normalized))
    return "banking";
  if (["afritrade", "trade", "trading"].includes(normalized)) return "afritrade";
  if (["afritax", "tax", "fiscal"].includes(normalized)) return "afritax";
  if (["compta", "ohada", "ohada-compta", "africompta"].includes(normalized))
    return "compta";
  if (
    ["finance", "analysis", "corpfin", "corporate", "finance-lab", "financeops", "finance-ops"].includes(
      normalized
    )
  ) {
    return "finance";
  }
  if (["dex", "exchange", "etf-dex"].includes(normalized)) return "dex";
  if (["intelligence", "research", "markets", "market-intel"].includes(normalized))
    return "wasi";
  return "wasi";
};

export const getStoredAppId = () => {
  if (typeof window === "undefined") return "home";
  const raw = window.localStorage.getItem(APP_STORAGE_KEY);
  return normalizeAppId(raw || "home");
};

export const persistAppId = (appId) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APP_STORAGE_KEY, normalizeAppId(appId));
};

export const buildAppHref = (appId, extraParams = {}) => {
  if (typeof window === "undefined") {
    return `?app=${normalizeAppId(appId)}`;
  }
  const url = new URL(window.location.href);
  url.searchParams.set("app", normalizeAppId(appId));
  Object.entries(extraParams).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      url.searchParams.delete(key);
      return;
    }
    url.searchParams.set(key, String(value));
  });
  return `${url.pathname}${url.search}${url.hash}`;
};

export const navigateToApp = (appId, options = {}) => {
  if (typeof window === "undefined") return;
  const { replace = false, extraParams = {} } = options;
  const normalized = normalizeAppId(appId);
  persistAppId(normalized);
  const targetHref = buildAppHref(normalized, extraParams);
  if (replace) {
    window.location.replace(targetHref);
    return;
  }
  window.location.href = targetHref;
};

const moduleChipStyle = (active) => ({
  textDecoration: "none",
  padding: "8px 10px",
  borderRadius: 10,
  border: `1px solid ${active ? "rgba(240,180,41,0.55)" : "rgba(51,65,85,0.9)"}`,
  color: active ? "#f8fafc" : "#cbd5e1",
  background: active ? "rgba(240,180,41,0.12)" : "rgba(15,23,42,0.7)",
  fontSize: 12,
});

const shellNavButtonStyle = (active) => ({
  border: "none",
  borderBottom: `2px solid ${active ? "#c8922a" : "transparent"}`,
  background: "transparent",
  color: active ? "#c8922a" : "#475569",
  padding: "6px 14px",
  cursor: "pointer",
  fontSize: 10,
  letterSpacing: 2,
  textTransform: "uppercase",
  fontFamily: shellMono,
  whiteSpace: "nowrap",
});

const shellActionLinkStyle = (active = false) => ({
  textDecoration: "none",
  border: `1px solid ${active ? "rgba(200,146,42,0.45)" : "rgba(26,58,92,0.95)"}`,
  background: active ? "rgba(200,146,42,0.12)" : "rgba(2,6,23,0.75)",
  color: active ? "#c8922a" : "#cbd5e1",
  borderRadius: 999,
  padding: "7px 11px",
  fontSize: 10,
  letterSpacing: 1.2,
  whiteSpace: "nowrap",
  fontFamily: shellMono,
});

const bridgeButtonStyle = (accent = false) => ({
  ...moduleChipStyle(false),
  cursor: "pointer",
  background: accent ? "rgba(240,180,41,0.12)" : "rgba(15,23,42,0.7)",
  color: accent ? "#f8fafc" : "#cbd5e1",
});

const recallButtonStyle = {
  fontFamily: shellMono,
  fontSize: 12,
  letterSpacing: 1,
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(200,146,42,0.4)",
  color: "#c8922a",
  background: "rgba(2,6,23,0.92)",
  cursor: "pointer",
};

const formatCentimesXof = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "--";
  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(numericValue / 100)} XOF`;
};

const formatNumber = (value, maximumFractionDigits = 2) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "--";
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits,
  }).format(numericValue);
};

const formatUsdValue = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "--";
  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: numericValue >= 1000 ? 0 : 2,
  }).format(numericValue)} USD`;
};

const pickTickerMarkets = (markets = []) => {
  const rankedMarkets = [...markets].sort((left, right) => {
    const leftPriority = DEX_TICKER_PRIORITY.indexOf(left.symbol);
    const rightPriority = DEX_TICKER_PRIORITY.indexOf(right.symbol);
    const leftRank = leftPriority === -1 ? 999 : leftPriority;
    const rightRank = rightPriority === -1 ? 999 : rightPriority;
    return leftRank - rightRank;
  });
  return rankedMarkets.slice(0, 5);
};

const getStatusTone = (state) => {
  if (state === "online") return "#4ade80";
  if (state === "offline") return "#f87171";
  return "#60a5fa";
};

const getStatusLabel = (state) => {
  if (state === "online") return "EN LIGNE";
  if (state === "offline") return "HORS LIGNE";
  return "VERIFICATION";
};

const getCurrentBankingProfile = () => {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("bankingProfile") || "";
};

const AccessGate = ({
  accessKeyInput,
  accessError,
  onChange,
  onSubmit,
  inputRef,
}) => (
  <div style={accessGateStyle}>
    <div
      style={{
        border: "1px solid #1a3a5c",
        padding: 40,
        maxWidth: 440,
        width: "min(100%, 440px)",
        textAlign: "center",
        fontFamily: shellMono,
        background: "#030b15",
      }}
    >
      <div
        style={{
          fontSize: 52,
          fontWeight: 700,
          color: "#c8922a",
          letterSpacing: 8,
          lineHeight: 1,
        }}
      >
        WASI
      </div>
      <div
        style={{
          fontSize: 10,
          color: "#475569",
          letterSpacing: 4,
          marginTop: 6,
          marginBottom: 32,
        }}
      >
        PLATEFORME UNIFIEE · AFRITRADE · V2.0
      </div>
      <input
        ref={inputRef}
        value={accessKeyInput}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmit();
        }}
        placeholder="WASI-XXXX-XX00"
        maxLength={20}
        style={{
          width: "100%",
          background: "#050f1c",
          border: "1px solid #1a3a5c",
          color: "#c8922a",
          fontFamily: shellMono,
          fontSize: 14,
          padding: "12px 16px",
          textAlign: "center",
          letterSpacing: 3,
          outline: "none",
          marginBottom: 10,
        }}
      />
      <button
        type="button"
        onClick={onSubmit}
        style={{
          width: "100%",
          background: "transparent",
          border: "1px solid #c8922a",
          color: "#c8922a",
          fontFamily: shellMono,
          fontSize: 12,
          padding: 12,
          cursor: "pointer",
          letterSpacing: 3,
        }}
      >
        ACCEDER →
      </button>
      <div
        style={{
          fontSize: 10,
          color: "#f87171",
          marginTop: 8,
          letterSpacing: 1,
          minHeight: 16,
        }}
      >
        {accessError}
      </div>
      <div
        style={{
          fontSize: 9,
          color: "#475569",
          marginTop: 20,
          letterSpacing: 1,
          lineHeight: 1.8,
        }}
      >
        WASI Intelligence · WASI DEX · Banque AfriTrade
        <br />
        Cle demo : WASI-DEMO-DM01
        <br />
        Contact : thomas@wasiecosystem.com
      </div>
    </div>
  </div>
);

const getConnectionLinks = (workspaceId, bankingProfile) => {
  const managerRoute = { appId: "banking", extraParams: { bankingProfile: "manager" } };
  const clientRoute = { appId: "banking", extraParams: { bankingProfile: "client" } };

  if (workspaceId === "intelligence") {
    return [
      { label: "Banque - gestion", ...managerRoute },
      { label: "Vue client AfriTrade", ...clientRoute },
      { label: "Ouvrir le DEX", appId: "dex" },
    ];
  }

  if (workspaceId === "execution") {
    return [
      { label: "WASI Intelligence", appId: "wasi" },
      { label: "WASI DEX", appId: "dex" },
      bankingProfile === "manager"
        ? { label: "Vue client", ...clientRoute }
        : { label: "Vue gestion", ...managerRoute },
    ];
  }

  if (workspaceId === "financeops") {
    return [
      { label: "Banque - gestion", ...managerRoute },
      { label: "WASI Intelligence", appId: "wasi" },
      { label: "DEX cote", appId: "dex" },
    ];
  }

  return [
    { label: "Ouvrir Intelligence", appId: "wasi" },
    { label: "Ouvrir Banque", ...managerRoute },
    { label: "Ouvrir DEX", appId: "dex" },
  ];
};

export function AppSwitcher({ currentApp }) {
  const active = normalizeAppId(currentApp);
  const activeApp = getPlatformApp(active);
  const activeWorkspace = getWorkspaceForApp(active);
  const currentBankingProfile = getCurrentBankingProfile();
  const accessInputRef = useRef(null);
  const workspaceModules = useMemo(
    () =>
      activeWorkspace.moduleIds
        .map((appId) => getPlatformApp(appId))
        .filter((app) => app.id !== "home"),
    [activeWorkspace]
  );
  const nextWorkspaces = useMemo(
    () => activeWorkspace.nextWorkspaceIds.map((workspaceId) => getWorkspaceGroup(workspaceId)),
    [activeWorkspace]
  );
  const relatedResources = useMemo(
    () =>
      LOCAL_REFERENCE_PACKS.filter((resource) =>
        activeWorkspace.moduleIds.includes(resource.moduleId)
      ),
    [activeWorkspace]
  );
  const connectionLinks = useMemo(
    () => getConnectionLinks(activeWorkspace.id, currentBankingProfile),
    [activeWorkspace.id, currentBankingProfile]
  );
  const [panelVisible, setPanelVisible] = useState(true);
  const [panelPinned, setPanelPinned] = useState(false);
  const [accessProfile, setAccessProfile] = useState(() => readStoredAccessProfile());
  const [accessKeyInput, setAccessKeyInput] = useState("");
  const [accessError, setAccessError] = useState("");
  const [bridgeSnapshot, setBridgeSnapshot] = useState({
    wasiState: "checking",
    bankingState: "checking",
    dexState: "checking",
    dexMarkets: [],
    updatedAt: "",
  });
  const [marketSnapshot, setMarketSnapshot] = useState({
    fx: null,
    crypto: null,
  });

  useEffect(() => {
    setPanelVisible(true);
    setPanelPinned(false);
  }, [active]);

  useEffect(() => {
    if (!panelVisible || panelPinned) return undefined;
    const timeoutId = window.setTimeout(() => {
      setPanelVisible(false);
    }, WORKSPACE_PANEL_AUTO_HIDE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [active, panelPinned, panelVisible]);

  useEffect(() => {
    if (accessProfile || typeof window === "undefined") return undefined;
    const timeoutId = window.setTimeout(() => {
      accessInputRef.current?.focus();
    }, 50);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [accessProfile]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const root = document.documentElement;
    const shellElement = document.getElementById(PLATFORM_SHELL_ID);

    const updateOffset = () => {
      const currentShell = document.getElementById(PLATFORM_SHELL_ID);
      const shellHeight = Math.ceil(currentShell?.getBoundingClientRect().height || 0);
      root.style.setProperty("--wasi-platform-header-offset", `${shellHeight}px`);
    };

    updateOffset();

    let observer;
    if (shellElement && typeof window.ResizeObserver === "function") {
      observer = new window.ResizeObserver(updateOffset);
      observer.observe(shellElement);
    } else {
      window.addEventListener("resize", updateOffset);
    }

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateOffset);
      root.style.removeProperty("--wasi-platform-header-offset");
    };
  }, [active, bridgeSnapshot.dexMarkets.length]);

  useEffect(() => {
    let isMounted = true;

    const loadBridgeSnapshot = async () => {
      const [wasiHealthResult, bankingHealthResult, dexMarketsResult] = await Promise.allSettled([
        fetch("http://127.0.0.1:8000/api/health"),
        fetch("http://127.0.0.1:8010/api/health"),
        fetch("http://127.0.0.1:8010/api/v1/dex/markets"),
      ]);

      if (!isMounted) return;

      let wasiState = "offline";
      if (wasiHealthResult.status === "fulfilled" && wasiHealthResult.value.ok) {
        wasiState = "online";
      }

      let bankingState = "offline";
      if (bankingHealthResult.status === "fulfilled" && bankingHealthResult.value.ok) {
        bankingState = "online";
      }

      let dexState = "offline";
      let dexMarkets = [];
      if (dexMarketsResult.status === "fulfilled" && dexMarketsResult.value.ok) {
        const payload = await dexMarketsResult.value.json().catch(() => null);
        dexMarkets = Array.isArray(payload?.data?.markets) ? payload.data.markets : [];
        dexState = dexMarkets.length ? "online" : "checking";
      }

      setBridgeSnapshot({
        wasiState,
        bankingState,
        dexState,
        dexMarkets,
        updatedAt: new Date().toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
    };

    loadBridgeSnapshot().catch(() => {});
    const intervalId = window.setInterval(() => {
      loadBridgeSnapshot().catch(() => {});
    }, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadMarketSnapshot = async () => {
      const [fxResult, cryptoResult] = await Promise.allSettled([
        fetchOpenErFxSnapshot(),
        fetchCoinGeckoSnapshot(),
      ]);

      if (!isMounted) return;

      setMarketSnapshot({
        fx: fxResult.status === "fulfilled" ? fxResult.value : null,
        crypto: cryptoResult.status === "fulfilled" ? cryptoResult.value : null,
      });
    };

    loadMarketSnapshot().catch(() => {});
    const intervalId = window.setInterval(() => {
      loadMarketSnapshot().catch(() => {});
    }, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const tickerItems = useMemo(() => {
    const selectedMarkets = pickTickerMarkets(bridgeSnapshot.dexMarkets);
    const eurXof = marketSnapshot.fx?.pairs?.["EUR/XOF"]?.buy;
    const usdXof = marketSnapshot.fx?.pairs?.["USD/XOF"]?.buy;
    const btcUsd = marketSnapshot.crypto?.prices?.BTC?.usd;
    const ethUsd = marketSnapshot.crypto?.prices?.ETH?.usd;
    const btcChange = marketSnapshot.crypto?.prices?.BTC?.changePct;
    const ethChange = marketSnapshot.crypto?.prices?.ETH?.changePct;
    const items = [
      {
        label: "WASI 8000",
        value: getStatusLabel(bridgeSnapshot.wasiState),
        tone: getStatusTone(bridgeSnapshot.wasiState),
      },
      {
        label: "BANQUE 8010",
        value: getStatusLabel(bridgeSnapshot.bankingState),
        tone: getStatusTone(bridgeSnapshot.bankingState),
      },
      {
        label: "ESPACE",
        value: activeWorkspace.label,
        tone: "#c8922a",
      },
      {
        label: "DEX",
        value: getStatusLabel(bridgeSnapshot.dexState),
        tone: getStatusTone(bridgeSnapshot.dexState),
      },
      ...(eurXof
        ? [
            {
              label: "EUR/XOF",
              value: formatNumber(eurXof, 3),
              tone: "#93c5fd",
            },
          ]
        : []),
      ...(usdXof
        ? [
            {
              label: "USD/XOF",
              value: formatNumber(usdXof, 3),
              tone: "#93c5fd",
            },
          ]
        : []),
      ...(btcUsd
        ? [
            {
              label: "BTC/USD",
              value: formatUsdValue(btcUsd),
              tone: Number(btcChange) >= 0 ? "#4ade80" : "#f87171",
            },
          ]
        : []),
      ...(ethUsd
        ? [
            {
              label: "ETH/USD",
              value: formatUsdValue(ethUsd),
              tone: Number(ethChange) >= 0 ? "#4ade80" : "#f87171",
            },
          ]
        : []),
      ...selectedMarkets.map((market) => ({
        label: `${market.symbol} · ${market.lastPriceMetric?.status || "TRACE"}`,
        value: formatCentimesXof(market.lastPriceCentimes),
        tone:
          market.lastPriceMetric?.status === "LIVE"
            ? "#4ade80"
            : market.lastPriceMetric?.status === "DEMO"
              ? "#f0b429"
              : "#93c5fd",
      })),
    ];

    if (bridgeSnapshot.updatedAt) {
      items.push({
        label: "MAJ",
        value: bridgeSnapshot.updatedAt,
        tone: "#94a3b8",
      });
    }

    return items;
  }, [activeWorkspace.label, bridgeSnapshot, marketSnapshot]);

  const primaryNavItems = [
    {
      id: "intelligence",
      label: "INTELLIGENCE",
      active: active === "wasi",
      onClick: () => navigateToApp("wasi"),
    },
    {
      id: "dex",
      label: "DEX · BOURSE",
      active: active === "dex",
      onClick: () => navigateToApp("dex"),
    },
    {
      id: "execution",
      label: "BANQUE",
      active: activeWorkspace.id === "execution",
      onClick: () =>
        activeWorkspace.id === "execution" && activeApp.id === "afritrade"
          ? navigateToApp("afritrade")
          : navigateToApp(activeWorkspace.id === "execution" ? activeApp.id : "banking", {
              extraParams:
                activeWorkspace.id === "execution" && activeApp.id === "banking"
                  ? { bankingProfile: currentBankingProfile || "manager" }
                  : { bankingProfile: "manager" },
            }),
    },
  ];

  const topbarStatus =
    bridgeSnapshot.wasiState === "online" ||
    bridgeSnapshot.bankingState === "online" ||
    bridgeSnapshot.dexState === "online"
      ? "16 PAYS · UEMOA · EN LIGNE"
      : "16 PAYS · UEMOA · EN VERIFICATION";

  const handleAccessSubmit = () => {
    const normalizedKey = accessKeyInput.toUpperCase().trim();
    const profileSeed = ACCESS_KEYS[normalizedKey];
    if (!profileSeed) {
      setAccessError("Cle invalide. Utilisez la cle demo ou contactez thomas@wasiecosystem.com");
      return;
    }
    const nextProfile = {
      key: normalizedKey,
      ...profileSeed,
    };
    persistAccessProfile(nextProfile);
    setAccessProfile(nextProfile);
    setAccessError("");
    setAccessKeyInput("");
  };

  const resetAccessProfile = () => {
    persistAccessProfile(null);
    setAccessProfile(null);
    setAccessKeyInput("");
    setAccessError("");
  };

  return (
    <>
      {!accessProfile ? (
        <AccessGate
          accessKeyInput={accessKeyInput}
          accessError={accessError}
          onChange={setAccessKeyInput}
          onSubmit={handleAccessSubmit}
          inputRef={accessInputRef}
        />
      ) : null}

      <div
        id={PLATFORM_SHELL_ID}
        style={{
          position: "sticky",
          top: 0,
          zIndex: 44,
          background: "#050f1c",
          borderBottom: "1px solid #0d2035",
          boxShadow: "0 10px 28px rgba(2,6,23,0.22)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "0 20px",
            minHeight: 48,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: shellMono,
                fontSize: 18,
                fontWeight: 700,
                color: "#c8922a",
                letterSpacing: 5,
              }}
            >
              WASI
            </div>
            <div
              style={{
                fontFamily: shellMono,
                fontSize: 9,
                color: "#475569",
                letterSpacing: 2,
              }}
            >
              PLATEFORME UNIFIEE
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 6 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background:
                  bridgeSnapshot.wasiState === "online" ||
                  bridgeSnapshot.bankingState === "online" ||
                  bridgeSnapshot.dexState === "online"
                    ? "#4ade80"
                    : "#60a5fa",
              }}
            />
            <span
              style={{
                fontFamily: shellMono,
                fontSize: 9,
                color: "#475569",
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              {topbarStatus}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              gap: 2,
              flex: 1,
              margin: "0 16px",
              overflowX: "auto",
            }}
          >
            {primaryNavItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                style={shellNavButtonStyle(item.active)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <a
              href={buildAppHref("home")}
              onClick={() => persistAppId("home")}
              style={shellActionLinkStyle(active === "home")}
            >
              ACCUEIL
            </a>
            <a
              href={buildAppHref("finance")}
              onClick={() => persistAppId("finance")}
              style={shellActionLinkStyle(activeWorkspace.id === "financeops")}
            >
              OPERATIONS FINANCE
            </a>
            <a
              href={buildAppHref("sales")}
              onClick={() => persistAppId("sales")}
              style={shellActionLinkStyle(active === "sales")}
            >
              KIT DE DEMO
            </a>
            <a
              href={buildAppHref("banking", { bankingProfile: "client" })}
              onClick={() => persistAppId("banking")}
              style={shellActionLinkStyle(
                active === "banking" && currentBankingProfile === "client"
              )}
            >
              CLIENT
            </a>
            <a
              href={buildAppHref("banking", { bankingProfile: "manager" })}
              onClick={() => persistAppId("banking")}
              style={shellActionLinkStyle(
                active === "banking" && currentBankingProfile === "manager"
              )}
            >
              GESTION
            </a>
            <a
              href="http://127.0.0.1:3006/"
              target="_blank"
              rel="noreferrer"
              style={shellActionLinkStyle()}
            >
              HUB 3006
            </a>
          </div>

          <div
            style={{
              fontFamily: shellMono,
              fontSize: 9,
              color: "#475569",
              textAlign: "right",
              minWidth: 130,
            }}
          >
            <div style={{ color: "#c8922a" }}>{accessProfile?.name || "—"}</div>
            <div>
              <span style={{ color: "#c8922a" }}>{accessProfile?.tier || "—"}</span>
              {" · "}
              {accessProfile?.quotaLabel || "—"}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            padding: "5px 20px",
            borderTop: "1px solid #0d2035",
            overflowX: "auto",
            whiteSpace: "nowrap",
            fontFamily: shellMono,
            fontSize: 10,
            background: "rgba(5,15,28,0.95)",
          }}
        >
          {tickerItems.map((item) => (
            <div
              key={`${item.label}-${item.value}`}
              style={{ display: "flex", alignItems: "center", gap: 6, color: "#94a3b8" }}
            >
              <span style={{ color: "#475569", letterSpacing: 1.2 }}>{item.label}</span>
              <span style={{ color: item.tone, fontWeight: 700 }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <aside
        style={{
          position: "fixed",
          left: 12,
          bottom: 58,
          zIndex: 43,
          width: "min(430px, calc(100vw - 24px))",
          display: "grid",
          gap: 12,
          padding: 14,
          borderRadius: 16,
          border: "1px solid rgba(26,58,92,0.95)",
          background: "rgba(3,11,21,0.95)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 18px 40px rgba(2,6,23,0.35)",
          opacity: panelVisible ? 1 : 0,
          transform: panelVisible ? "translateY(0)" : "translateY(16px)",
          pointerEvents: panelVisible ? "auto" : "none",
          transition: "opacity 180ms ease, transform 180ms ease",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontFamily: shellMono,
                fontSize: 11,
                letterSpacing: 1.4,
                textTransform: "uppercase",
                color: "#94a3b8",
              }}
            >
              PASSERELLE WASI
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setPanelPinned((value) => !value)}
                style={{
                  border: "1px solid rgba(51,65,85,0.9)",
                  background: panelPinned ? "rgba(240,180,41,0.12)" : "transparent",
                  color: panelPinned ? "#f0b429" : "#94a3b8",
                  borderRadius: 999,
                  padding: "5px 9px",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                {panelPinned ? "Epingle" : "Epingler"}
              </button>
              <button
                type="button"
                onClick={resetAccessProfile}
                style={{
                  border: "1px solid rgba(51,65,85,0.9)",
                  background: "transparent",
                  color: "#c8922a",
                  borderRadius: 999,
                  padding: "5px 9px",
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: shellMono,
                }}
              >
                Changer de cle
              </button>
              <button
                type="button"
                onClick={() => setPanelVisible(false)}
                style={closeButtonStyle}
                aria-label="Masquer le panneau de connexion"
              >
                x
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <strong style={{ color: "#f8fafc", fontSize: 18 }}>{activeWorkspace.title}</strong>
              <span style={{ color: "#f0b429", fontSize: 12, letterSpacing: 0.6 }}>
                Module actif: {activeApp.label}
              </span>
            </div>
            <span
              style={{
                ...shellActionLinkStyle(false),
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              {activeWorkspace.label}
            </span>
          </div>

          <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.5 }}>
            {WORKSPACE_BRIDGE_HINTS[activeWorkspace.id]}
          </p>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div
            style={{
              fontFamily: shellMono,
              fontSize: 11,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: "#64748b",
            }}
          >
            Acces directs
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {connectionLinks.map((link) => (
              <button
                key={link.label}
                type="button"
                onClick={() =>
                  navigateToApp(link.appId, { extraParams: link.extraParams || {} })
                }
                style={bridgeButtonStyle(true)}
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>

        {workspaceModules.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div
              style={{
                fontFamily: shellMono,
                fontSize: 11,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: "#64748b",
              }}
            >
              Modules associes
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {workspaceModules.map((app) => (
                <a
                  key={app.id}
                  href={buildAppHref(app.id)}
                  onClick={() => persistAppId(app.id)}
                  style={moduleChipStyle(active === app.id)}
                >
                  {app.label}
                </a>
              ))}
            </div>
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 8 }}>
          <div
            style={{
              fontFamily: shellMono,
              fontSize: 11,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: "#64748b",
            }}
          >
            Etapes recommandees
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {nextWorkspaces.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                onClick={() => navigateToApp(workspace.primaryAppId)}
                style={bridgeButtonStyle(false)}
              >
                {workspace.label}
              </button>
            ))}
          </div>
        </div>

        {relatedResources.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div
              style={{
                fontFamily: shellMono,
                fontSize: 11,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: "#64748b",
              }}
            >
              Pack local de reference
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {relatedResources.map((resource) => (
                <a
                  key={resource.id}
                  href={getLocalResourceHref(resource.id, "http://127.0.0.1:3006")}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    textDecoration: "none",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(51,65,85,0.9)",
                    color: "#cbd5e1",
                    background: "rgba(15,23,42,0.55)",
                  }}
                >
                  <div style={{ color: "#f8fafc", fontSize: 13 }}>{resource.label}</div>
                  <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
                    {resource.filename}
                  </div>
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </aside>

      <div
        style={{
          position: "fixed",
          left: 12,
          bottom: 12,
          zIndex: 43,
          display: "flex",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={() => {
            setPanelVisible((value) => !value);
            setPanelPinned(true);
          }}
          style={recallButtonStyle}
        >
          Passerelle WASI
        </button>
        {!panelVisible ? (
          <button type="button" onClick={() => navigateToApp("home")} style={recallButtonStyle}>
            Accueil
          </button>
        ) : null}
      </div>
    </>
  );
}


