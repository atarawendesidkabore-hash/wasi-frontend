const APP_STORAGE_KEY = "WASI_SELECTED_APP";

const apps = [
  { id: "wasi", label: "WASI" },
  { id: "banking", label: "Banking" },
];

export const normalizeAppId = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["banking", "bank", "wallet"].includes(normalized)) return "banking";
  if (["dex", "exchange", "etf-dex"].includes(normalized)) return "wasi";
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
          href={`?app=${app.id}`}
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
