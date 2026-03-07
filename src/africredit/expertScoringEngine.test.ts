import { CREDIT_DECISION_DISCLAIMER } from "./constants";
import { WASIExpertScoringEngine } from "./expertScoringEngine";
import { CreditDecisionInput } from "./types";

const engine = new WASIExpertScoringEngine();

const baseInput: CreditDecisionInput = {
  country: "CI",
  loanType: "projet",
  components: {
    pays: 78,
    politique: 70,
    sectoriel: 74,
    flux: 82,
    corridor: 76,
    emprunteur: 80,
    change: 68,
  },
  borrowerProfile: "Agri exporter",
  corridor: "Abidjan-Lagos",
};

describe("WASIExpertScoringEngine", () => {
  it("returns weighted decision with mandatory human review and disclaimer", () => {
    const result = engine.evaluateDecision(baseInput);
    expect(result.decision_proposal).toBe("APPROVE");
    expect(result.veto_applied).toBe(false);
    expect(result.score).toBeGreaterThan(0);
    expect(result.human_review_required).toBe(true);
    expect(result.disclaimer).toBe(CREDIT_DECISION_DISCLAIMER);
  });

  it("applies sovereign debt veto for BF/ML/NE/GN", () => {
    const result = engine.evaluateDecision({
      ...baseInput,
      country: "BF",
      loanType: "dette_souveraine",
    });

    expect(result.decision_proposal).toBe("VETOED");
    expect(result.veto_applied).toBe(true);
    expect(result.veto_reason).toContain("dette_souveraine blocked");
    expect(result.human_review_required).toBe(true);
    expect(result.disclaimer).toBe(CREDIT_DECISION_DISCLAIMER);
  });

  it("throws on invalid component values", () => {
    expect(() =>
      engine.evaluateDecision({
        ...baseInput,
        components: { ...baseInput.components, flux: 120 },
      })
    ).toThrow("components.flux must be between 0 and 100");
  });

  it("maps low scores to REJECT", () => {
    const result = engine.evaluateDecision({
      ...baseInput,
      components: {
        pays: 20,
        politique: 25,
        sectoriel: 22,
        flux: 30,
        corridor: 28,
        emprunteur: 24,
        change: 26,
      },
    });

    expect(result.decision_proposal).toBe("REJECT");
    expect(result.veto_applied).toBe(false);
  });
});
