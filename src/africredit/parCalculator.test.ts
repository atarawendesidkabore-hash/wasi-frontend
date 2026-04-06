import {
  calculateOSS,
  calculatePAR,
  generatePortfolioSummary,
  identifyAtRiskLoans,
} from "./parCalculator";
import { Loan } from "./types";

const loans: Loan[] = [
  { id: "L1", disbursedAmount: 1_000_000n, outstandingBalance: 900_000n, daysPastDue: 0, status: "ACTIVE" },
  { id: "L2", disbursedAmount: 800_000n, outstandingBalance: 700_000n, daysPastDue: 32, status: "ACTIVE" },
  { id: "L3", disbursedAmount: 500_000n, outstandingBalance: 400_000n, daysPastDue: 64, status: "DEFAULTED" },
  { id: "L4", disbursedAmount: 300_000n, outstandingBalance: 250_000n, daysPastDue: 95, status: "ACTIVE" },
  { id: "L5", disbursedAmount: 300_000n, outstandingBalance: 0n, daysPastDue: 0, status: "REPAID" },
];

describe("PAR calculators", () => {
  it("calculates PAR30, PAR60, PAR90", () => {
    expect(calculatePAR(loans, 30)).toBe(60);
    expect(calculatePAR(loans, 60)).toBe(28.89);
    expect(calculatePAR(loans, 90)).toBe(11.11);
  });

  it("identifies at-risk loans with threshold", () => {
    const atRisk = identifyAtRiskLoans(loans, 60);
    expect(atRisk.map((l) => l.id)).toEqual(["L3", "L4"]);
  });

  it("calculates OSS with Decimal precision", () => {
    const oss = calculateOSS(1_500_000n, 900_000n, 300_000n);
    expect(oss).toBe(125);
  });

  it("generates portfolio summary", () => {
    const summary = generatePortfolioSummary(loans);
    expect(summary.totalLoans).toBe(5);
    expect(summary.activeExposureCentimes).toBe(2_250_000n);
    expect(summary.par30).toBe(60);
    expect(summary.par60).toBe(28.89);
    expect(summary.par90).toBe(11.11);
  });
});

