export const WASI_THEME = Object.freeze({
  backgroundBase: "#030d1a",
  backgroundGradient:
    "radial-gradient(circle at 14% 10%, #0f2a45 0%, #071a2d 42%, #030d1a 100%)",
  textPrimary: "#e2e8f0",
  textMuted: "#94a3b8",
  panelBackground: "rgba(7,25,46,0.88)",
  panelBackgroundSoft: "rgba(15,42,69,0.5)",
  border: "rgba(30,58,95,0.85)",
  borderAccent: "rgba(240,180,41,0.55)",
  accent: "#f0b429",
  accentSoft: "rgba(240,180,41,0.14)",
  buttonPrimary: "#f0b429",
  buttonPrimaryText: "#030d1a",
  buttonSecondary: "#334155",
  success: "#4ade80",
  warning: "#f0b429",
  danger: "#fb7185",
  info: "#93c5fd",
});

export const getAppShellStyle = () => ({
  minHeight: "100vh",
  background: WASI_THEME.backgroundGradient,
  color: WASI_THEME.textPrimary,
  fontFamily: "'Space Mono', monospace",
  padding: 24,
});

export const getPanelStyle = () => ({
  border: `1px solid ${WASI_THEME.border}`,
  borderRadius: 16,
  background: WASI_THEME.panelBackground,
  padding: 16,
  backdropFilter: "blur(8px)",
});

export const sharedInputStyle = {
  width: "100%",
  borderRadius: 8,
  border: `1px solid ${WASI_THEME.borderAccent}`,
  background: WASI_THEME.panelBackgroundSoft,
  color: WASI_THEME.textPrimary,
  padding: "10px 12px",
  fontFamily: "inherit",
};

export const sharedPrimaryButtonStyle = {
  border: "none",
  borderRadius: 8,
  background: WASI_THEME.buttonPrimary,
  color: WASI_THEME.buttonPrimaryText,
  padding: "10px 14px",
  fontFamily: "inherit",
  cursor: "pointer",
  fontWeight: 700,
};

export const sharedSecondaryButtonStyle = {
  border: "none",
  borderRadius: 8,
  background: WASI_THEME.buttonSecondary,
  color: WASI_THEME.textPrimary,
  padding: "10px 14px",
  fontFamily: "inherit",
  cursor: "pointer",
  fontWeight: 700,
};
