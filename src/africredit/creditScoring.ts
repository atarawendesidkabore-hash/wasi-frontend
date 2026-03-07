import Decimal from "decimal.js";
import {
  COLLATERAL_FULL_SCORE_XOF,
  MAX_SAFE_MONEY_XOF,
  MILITARY_TRANSITION_COUNTRIES,
  SCORE_MAX,
  SCORE_MIN,
  WEIGHTS,
} from "./constants";
import {
  CashFlowStability,
  CreditApplicationInput,
  CreditGrade,
  CreditScoreResult,
  EcowasCountryCode,
  SectorRisk,
} from "./types";

const sectorRiskScoreMap: Record<SectorRisk, number> = {
  LOW: 100,
  MEDIUM: 75,
  HIGH: 45,
  CRITICAL: 15,
};

const cashFlowScoreMap: Record<CashFlowStability, number> = {
  STABLE: 100,
  VARIABLE: 60,
  VOLATILE: 20,
};

const countryRiskScoreMap: Record<EcowasCountryCode, number> = {
  BJ: 72,
  BF: 35,
  CV: 76,
  CI: 78,
  GM: 58,
  GH: 70,
  GN: 48,
  GW: 50,
  LR: 53,
  ML: 40,
  MR: 55,
  NE: 38,
  NG: 67,
  SN: 80,
  SL: 56,
  TG: 73,
};

/**
 * Validate a percent-style input constrained to [0..100].
 */
export function validatePercentInput(value: number, field: string): void {
  if (!Number.isFinite(value) || value < SCORE_MIN || value > SCORE_MAX) {
    throw new Error(`${field} must be between 0 and 100`);
  }
}

/**
 * Validate collateral amount in XOF with safe-number boundaries.
 */
export function validateCollateralValue(collateralValue: number): void {
  if (!Number.isFinite(collateralValue) || collateralValue <= 0) {
    throw new Error("collateralValue must be greater than 0");
  }
  if (collateralValue > MAX_SAFE_MONEY_XOF) {
    throw new Error("collateralValue exceeds MAX_SAFE_INTEGER");
  }
}

/**
 * Calculate WASI credit score with weighted factors and mandatory veto checks.
 */
export function calculateCreditScore(input: CreditApplicationInput): CreditScoreResult {
  validatePercentInput(input.paymentHistory, "paymentHistory");
  validatePercentInput(input.debtRatio, "debtRatio");
  validatePercentInput(input.governanceScore, "governanceScore");
  validateCollateralValue(input.collateralValue);

  if (MILITARY_TRANSITION_COUNTRIES.has(input.countryRisk)) {
    return veto("Country under military transition");
  }
  if (input.debtRatio > 80) {
    return veto("Debt ratio above 80% threshold");
  }
  if (input.paymentHistory < 10) {
    return veto("Payment history below minimum threshold");
  }
  if (input.cashFlowStability === "VOLATILE" && input.debtRatio > 60) {
    return veto("Volatile cash flow combined with high debt ratio");
  }

  const debtScore = SCORE_MAX - input.debtRatio;
  const collateralScore = Math.min(
    SCORE_MAX,
    new Decimal(input.collateralValue)
      .div(COLLATERAL_FULL_SCORE_XOF)
      .mul(SCORE_MAX)
      .toNumber()
  );

  const weighted =
    input.paymentHistory * WEIGHTS.paymentHistory +
    debtScore * WEIGHTS.debtRatio +
    sectorRiskScoreMap[input.sectorRisk] * WEIGHTS.sectorRisk +
    input.governanceScore * WEIGHTS.governanceScore +
    collateralScore * WEIGHTS.collateralValue +
    cashFlowScoreMap[input.cashFlowStability] * WEIGHTS.cashFlowStability +
    countryRiskScoreMap[input.countryRisk] * WEIGHTS.countryRisk;

  const score = new Decimal(weighted).toDecimalPlaces(2).toNumber();

  return {
    score,
    grade: mapScoreToGrade(score),
    status: "APPROVED",
  };
}

/**
 * Convert numeric score to rating grade.
 */
export function mapScoreToGrade(score: number): CreditGrade {
  if (score >= 90) return "AAA";
  if (score >= 80) return "AA";
  if (score >= 70) return "A";
  if (score >= 60) return "BBB";
  if (score >= 50) return "BB";
  if (score >= 40) return "B";
  if (score >= 30) return "CCC";
  return "D";
}

function veto(reason: string): CreditScoreResult {
  return {
    score: 0,
    grade: "D",
    status: "VETOED",
    vetoReason: reason,
  };
}
