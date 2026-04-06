export const TERMINAL_COLORS = Object.freeze({
  bg: "#05070d",
  bgSoft: "#0a1020",
  bgPanel: "#060b16",
  border: "#1a2845",
  borderSoft: "#12203a",
  text: "#d6deeb",
  textMuted: "#7f8fa6",
  amber: "#f0b429",
  cyan: "#00d4ff",
  blue: "#3b82f6",
  info: "#3b82f6",
  green: "#00ff84",
  red: "#ff2d6f",
  orange: "#ffb020",
});

export const terminalShellStyle = {
  minHeight: "100vh",
  background: TERMINAL_COLORS.bg,
  color: TERMINAL_COLORS.text,
  fontFamily: "'Space Mono', monospace",
  display: "flex",
  flexDirection: "column",
};

export const terminalPanelStyle = {
  border: `1px solid ${TERMINAL_COLORS.border}`,
  background: TERMINAL_COLORS.bgPanel,
};

export const terminalSectionHeaderStyle = {
  padding: "6px 10px",
  borderBottom: `1px solid ${TERMINAL_COLORS.border}`,
  background: TERMINAL_COLORS.bgSoft,
  color: TERMINAL_COLORS.amber,
  letterSpacing: 1,
  fontSize: 14,
  fontWeight: 700,
  textTransform: "uppercase",
};

export const terminalCellStyle = {
  padding: "6px 8px",
  borderBottom: `1px solid ${TERMINAL_COLORS.borderSoft}`,
  fontSize: 13,
};

export const changeColor = (value) =>
  Number(value) >= 0 ? TERMINAL_COLORS.green : TERMINAL_COLORS.red;

export const fmtSigned = (value, digits = 2) => {
  const num = Number(value || 0);
  const sign = num >= 0 ? "+" : "";
  return `${sign}${num.toFixed(digits)}`;
};
