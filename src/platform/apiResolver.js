const DEFAULT_LOCAL_API_CANDIDATES = [8010, 8001, 8000];
const STORAGE_KEY = "WASI_PLATFORM_API_URL";
const LEGACY_KEYS = ["WASI_API_URL", "WASI_BANKING_API_URL", "WASI_DEX_API_URL"];

const sanitizeUrl = (url) => {
  if (!url || typeof url !== "string") return null;
  return url.trim().replace(/\/+$/, "");
};

const getFromWindow = () => {
  if (typeof window === "undefined") return null;
  const keys = [
    window.WASI_PLATFORM_API_URL,
    window.WASI_API_URL,
    window.WASI_BANKING_API_URL,
    window.WASI_DEX_API_URL,
  ];
  for (const value of keys) {
    const normalized = sanitizeUrl(value);
    if (normalized) return normalized;
  }
  return null;
};

const getFromStorage = () => {
  if (typeof window === "undefined") return null;
  const platform = sanitizeUrl(window.localStorage.getItem(STORAGE_KEY));
  if (platform) return platform;
  for (const key of LEGACY_KEYS) {
    const value = sanitizeUrl(window.localStorage.getItem(key));
    if (value) return value;
  }
  return null;
};

const getFromEnv = () => {
  if (typeof import.meta === "undefined" || !import.meta.env) return null;
  const envCandidates = [
    import.meta.env.VITE_WASI_PLATFORM_API_URL,
    import.meta.env.VITE_WASI_API_URL,
    import.meta.env.VITE_WASI_BANKING_API_URL,
    import.meta.env.VITE_WASI_DEX_API_URL,
  ];
  for (const value of envCandidates) {
    const normalized = sanitizeUrl(value);
    if (normalized) return normalized;
  }
  return null;
};

const getLocalDefault = () => {
  if (typeof window === "undefined") return "http://localhost:8010";
  const protocol = window.location.protocol || "http:";
  const host = window.location.hostname || "localhost";
  return `${protocol}//${host}:${DEFAULT_LOCAL_API_CANDIDATES[0]}`;
};

export const resolvePlatformApiBaseUrl = () => {
  const explicitWindow = getFromWindow();
  if (explicitWindow) return explicitWindow;

  const stored = getFromStorage();
  if (stored) return stored;

  const env = getFromEnv();
  if (env) return env;

  return getLocalDefault();
};

export const persistPlatformApiBaseUrl = (url) => {
  if (typeof window === "undefined") return;
  const normalized = sanitizeUrl(url);
  if (!normalized) return;
  window.localStorage.setItem(STORAGE_KEY, normalized);
  for (const key of LEGACY_KEYS) {
    window.localStorage.removeItem(key);
  }
  window.WASI_PLATFORM_API_URL = normalized;
  window.WASI_API_URL = normalized;
  window.WASI_BANKING_API_URL = normalized;
  window.WASI_DEX_API_URL = normalized;
};

export const clearPlatformApiOverrides = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  for (const key of LEGACY_KEYS) {
    window.localStorage.removeItem(key);
  }
};

