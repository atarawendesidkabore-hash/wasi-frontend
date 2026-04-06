import {
  ADVISORY_DISCLAIMER,
  HUMAN_REVIEW_REQUIRED_FLAG,
  MISSING_REALTIME_DATA_MESSAGE,
  enforceWasiAssistantGuardrails,
  isCreditRelatedQuery,
} from "./llmGuardrails";

describe("llmGuardrails", () => {
  it("detects credit-related queries in French and English", () => {
    expect(isCreditRelatedQuery("Analyse credit microfinance Burkina")).toBe(true);
    expect(isCreditRelatedQuery("Need a loan decision for CI")).toBe(true);
    expect(isCreditRelatedQuery("Show me shipping trend for Abidjan")).toBe(false);
  });

  it("adds mandatory credit compliance fields when missing", () => {
    const guarded = enforceWasiAssistantGuardrails("Decision de credit pour CI", "Proposition: APPROVE");
    expect(guarded).toContain("Proposition: APPROVE");
    expect(guarded).toContain(HUMAN_REVIEW_REQUIRED_FLAG);
    expect(guarded).toContain(ADVISORY_DISCLAIMER);
  });

  it("keeps non-credit answers untouched except empty fallback", () => {
    const reply = enforceWasiAssistantGuardrails("Indice shipping SN", "Signal stable");
    expect(reply).toBe("Signal stable");

    const empty = enforceWasiAssistantGuardrails("Indice shipping SN", "");
    expect(empty).toBe(MISSING_REALTIME_DATA_MESSAGE);
  });
});
