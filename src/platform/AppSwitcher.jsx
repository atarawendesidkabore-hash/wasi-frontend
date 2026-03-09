const APP_STORAGE_KEY = "WASI_SELECTED_APP";

const apps = [
  { id: "wasi", label: "WASI" },
  { id: "banking", label: "Banking" },
  { id: "afritrade", label: "AfriTrade" },
  { id: "compta", label: "OHADA-Compta" },
  { id: "finance", label: "Finance Lab" },
  { id: "afritax", label: "AfriTax" },
  { id: "dex", label: "ETF DEX" },
];

export const normalizeAppId = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["banking", "bank", "wallet"].includes(normalized)) return "banking";
  if (["afritrade", "trade", "trading"].includes(normalized)) return "afritrade";
  if (["afritax", "tax", "fiscal"].includes(normalized)) return "afritax";
  if (["compta", "ohada", "ohada-compta", "africompta"].includes(normalized))
    return "compta";
  if (["finance", "analysis", "corpfin", "corporate", "finance-lab"].includes(normalized))
    return "finance";
  if (["dex", "exchange", "etf-dex"].includes(normalized)) return "dex";
  return "wasi";
};

export const getStoredAppId = () => {
  if (typeof window === "undefined") return "wasi";
  const raw = window.localStorage.getItem(APP_STORAGE_KEY);
  return normalizeAppId(raw || "wasi");
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

export function AppSwitcher({ currentApp }) {
  const active = normalizeAppId(currentApp);

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        bottom: 12,
        zIndex: 150,
        display: "flex",
        gap: 6,
        padding: 6,
        borderRadius: 10,
        border: "1px solid #1f2937",
        background: "rgba(2,6,23,0.92)",
        backdropFilter: "blur(8px)",
      }}
    >
      {apps.map((app) => (
        <a
          key={app.id}
          href={buildAppHref(app.id)}
          onClick={() => persistAppId(app.id)}
          style={{
            textDecoration: "none",
            fontFamily: "'Space Mono', monospace",
            fontSize: 12,
            letterSpacing: 1,
            padding: "6px 9px",
            borderRadius: 7,
            border: `1px solid ${active === app.id ? "#f0b429" : "#334155"}`,
            color: active === app.id ? "#f0b429" : "#94a3b8",
            background: active === app.id ? "rgba(240,180,41,0.12)" : "transparent",
          }}
        >
          {app.label}
        </a>
      ))}
    </div>
  );
}
