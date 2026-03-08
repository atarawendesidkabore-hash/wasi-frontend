const toBool = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

export const PLATFORM_FEATURE_FLAGS = {
  wasi: toBool(import.meta.env.VITE_FEATURE_WASI, true),
  banking: toBool(import.meta.env.VITE_FEATURE_BANKING, true),
  dex: toBool(import.meta.env.VITE_FEATURE_DEX, true),
};

export const isFeatureEnabled = (featureName) =>
  Boolean(PLATFORM_FEATURE_FLAGS[featureName]);

