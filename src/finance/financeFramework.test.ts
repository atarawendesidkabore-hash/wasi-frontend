import {
  buildWalgreensSignals,
  computeCashConversion,
  computeFreeCashFlow,
  computeGrowthRate,
  computeOperatingMargin,
  computeWorkingCapital,
  getStatementYearSummary,
  walgreensIncomeStatement,
} from "./financeFramework";

describe("financeFramework", () => {
  test("computes working capital and free cash flow for 2004", () => {
    expect(computeWorkingCapital("2004")).toBe(3687);
    expect(computeFreeCashFlow("2004")).toBe(713);
  });

  test("computes cash conversion and operating margin from the framework data", () => {
    expect(computeCashConversion("2004")).toBeCloseTo(1.2154, 4);
    expect(computeOperatingMargin("2004")).toBeCloseTo(5.7134, 4);
  });

  test("computes multi-year sales growth from 2002 to 2004", () => {
    expect(computeGrowthRate(walgreensIncomeStatement, "netSales", "2004", "2002")).toBeCloseTo(30.7765, 4);
  });

  test("builds signal cards and statement summaries for the app", () => {
    const signals = buildWalgreensSignals();
    const summary = getStatementYearSummary("2003");

    expect(signals).toHaveLength(5);
    expect(signals[0].value).toContain("%");
    expect(summary.earnings.netSales).toBe(32505);
    expect(summary.cashFlow.endingCash).toBe(1268);
  });
});
