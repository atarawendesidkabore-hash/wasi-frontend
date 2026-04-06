import { EcowasCountryCode } from "./types";

export const SCORE_MIN = 0;
export const SCORE_MAX = 100;
export const MAX_SAFE_MONEY_XOF = Number.MAX_SAFE_INTEGER;

export const WEIGHTS = {
  paymentHistory: 0.25,
  debtRatio: 0.2,
  sectorRisk: 0.15,
  governanceScore: 0.15,
  collateralValue: 0.1,
  cashFlowStability: 0.1,
  countryRisk: 0.05,
} as const;

export const COLLATERAL_FULL_SCORE_XOF = 50_000_000;

export const MILITARY_TRANSITION_COUNTRIES = new Set<EcowasCountryCode>([
  "BF",
  "ML",
  "NE",
  "GN",
]);

export const CREDIT_DECISION_DISCLAIMER =
  "Advisory only. Décision finale = validation humaine";

export const SOVEREIGN_DEBT_VETO_COUNTRIES = new Set<EcowasCountryCode>([
  "BF",
  "ML",
  "NE",
  "GN",
]);
