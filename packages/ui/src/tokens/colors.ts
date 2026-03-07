export const wasiColors = {
  primary: "#1A7A4A",
  secondary: "#C9A84C",
  dark: "#0D2B1A",
  light: "#E8F5EE",
  danger: "#DC2626",
  warning: "#F59E0B",
} as const;

export type WasiColorToken = keyof typeof wasiColors;
