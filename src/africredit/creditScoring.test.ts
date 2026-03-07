import { calculateCreditScore } from "./creditScoring";
import { CreditApplicationInput } from "./types";

const baseInput: CreditApplicationInput = {
  paymentHistory: 82,
  debtRatio: 35,
  sectorRisk: "MEDIUM",
  governanceScore: 78,
  collateralValue: 22_000_000,
  cashFlowStability: "STABLE",
  countryRisk: "SN",
};

describe("calculateCreditScore", () => {
  it("returns approved score and grade when no veto applies", () => {
    const result = calculateCreditScore(baseInput);
    expect(result.status).toBe("APPROVED");
    expect(result.score).toBeGreaterThan(0);
    expect(result.grade).toMatch(/AAA|AA|A|BBB|BB|B|CCC|D/);
  });

  it("vetoes for military transition country", () => {
    const result = calculateCreditScore({ ...baseInput, countryRisk: "BF" });
    expect(result.status).toBe("VETOED");
    expect(result.score).toBe(0);
    expect(result.vetoReason).toContain("military transition");
  });

  it("vetoes for debt ratio above 80%", () => {
    const result = calculateCreditScore({ ...baseInput, debtRatio: 81 });
    expect(result.status).toBe("VETOED");
    expect(result.vetoReason).toContain("Debt ratio above 80%");
  });

  it("vetoes for payment history below 10", () => {
    const result = calculateCreditScore({ ...baseInput, paymentHistory: 9 });
    expect(result.status).toBe("VETOED");
    expect(result.vetoReason).toContain("Payment history");
  });

  it("vetoes for volatile cash flow with debt ratio above 60%", () => {
    const result = calculateCreditScore({
      ...baseInput,
      cashFlowStability: "VOLATILE",
      debtRatio: 61,
    });
    expect(result.status).toBe("VETOED");
    expect(result.vetoReason).toContain("Volatile cash flow");
  });
});
