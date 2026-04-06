import Decimal from "decimal.js";
import { Loan, PortfolioSummary } from "./types";

/**
 * Calculate Portfolio At Risk as percentage of active/defaulted exposure.
 */
export function calculatePAR(loans: Loan[], threshold: 30 | 60 | 90): number {
  const exposure = loans
    .filter((loan) => loan.status === "ACTIVE" || loan.status === "DEFAULTED")
    .reduce((sum, loan) => sum + loan.outstandingBalance, 0n);

  if (exposure === 0n) {
    return 0;
  }

  const atRisk = loans
    .filter(
      (loan) =>
        (loan.status === "ACTIVE" || loan.status === "DEFAULTED") && loan.daysPastDue >= threshold
    )
    .reduce((sum, loan) => sum + loan.outstandingBalance, 0n);

  return new Decimal(atRisk.toString())
    .div(exposure.toString())
    .mul(100)
    .toDecimalPlaces(2)
    .toNumber();
}

/**
 * Calculate Operational Self-Sufficiency ratio as a percentage.
 */
export function calculateOSS(
  financialIncome: bigint,
  operatingCosts: bigint,
  provisionExpense: bigint
): number {
  if (financialIncome <= 0n) {
    throw new Error("financialIncome must be greater than 0");
  }
  if (operatingCosts < 0n || provisionExpense < 0n) {
    throw new Error("operatingCosts and provisionExpense must be non-negative");
  }

  const denominator = operatingCosts + provisionExpense;
  if (denominator === 0n) {
    throw new Error("operatingCosts + provisionExpense must be greater than 0");
  }

  return new Decimal(financialIncome.toString())
    .div(denominator.toString())
    .mul(100)
    .toDecimalPlaces(2)
    .toNumber();
}

/**
 * Return loans where days past due meets or exceeds threshold.
 */
export function identifyAtRiskLoans(loans: Loan[], threshold: number): Loan[] {
  if (!Number.isInteger(threshold) || threshold < 1) {
    throw new Error("threshold must be a positive integer");
  }

  return loans.filter(
    (loan) =>
      (loan.status === "ACTIVE" || loan.status === "DEFAULTED") && loan.daysPastDue >= threshold
  );
}

/**
 * Generate a full portfolio summary with PAR30/PAR60/PAR90 metrics.
 */
export function generatePortfolioSummary(loans: Loan[]): PortfolioSummary {
  const activeExposureCentimes = loans
    .filter((loan) => loan.status === "ACTIVE" || loan.status === "DEFAULTED")
    .reduce((sum, loan) => sum + loan.outstandingBalance, 0n);

  const atRisk30Centimes = identifyAtRiskLoans(loans, 30).reduce(
    (sum, loan) => sum + loan.outstandingBalance,
    0n
  );
  const atRisk60Centimes = identifyAtRiskLoans(loans, 60).reduce(
    (sum, loan) => sum + loan.outstandingBalance,
    0n
  );
  const atRisk90Centimes = identifyAtRiskLoans(loans, 90).reduce(
    (sum, loan) => sum + loan.outstandingBalance,
    0n
  );

  return {
    totalLoans: loans.length,
    activeExposureCentimes,
    atRisk30Centimes,
    atRisk60Centimes,
    atRisk90Centimes,
    par30: calculatePAR(loans, 30),
    par60: calculatePAR(loans, 60),
    par90: calculatePAR(loans, 90),
  };
}
