import Decimal from "decimal.js";
import {
  CREDIT_DECISION_DISCLAIMER,
  SCORE_MAX,
  SCORE_MIN,
  SOVEREIGN_DEBT_VETO_COUNTRIES,
} from "./constants";
import { CreditDecisionInput, CreditDecisionResult, DecisionProposal } from "./types";

const DECISION_COMPONENT_WEIGHTS = {
  pays: 0.2,
  politique: 0.15,
  sectoriel: 0.15,
  flux: 0.15,
  corridor: 0.1,
  emprunteur: 0.15,
  change: 0.1,
} as const;

function validateComponent(value: number, label: string): void {
  if (!Number.isFinite(value) || value < SCORE_MIN || value > SCORE_MAX) {
    throw new Error(`${label} must be between 0 and 100`);
  }
}

function computeDecisionProposal(score: number): DecisionProposal {
  if (score >= 75) return "APPROVE";
  if (score >= 55) return "REVIEW";
  return "REJECT";
}

function veto(vetoReason: string): CreditDecisionResult {
  return {
    decision_proposal: "VETOED",
    score: 0,
    veto_applied: true,
    veto_reason: vetoReason,
    human_review_required: true,
    disclaimer: CREDIT_DECISION_DISCLAIMER,
  };
}

export class WASIExpertScoringEngine {
  evaluateDecision(input: CreditDecisionInput): CreditDecisionResult {
    const { components } = input;

    validateComponent(components.pays, "components.pays");
    validateComponent(components.politique, "components.politique");
    validateComponent(components.sectoriel, "components.sectoriel");
    validateComponent(components.flux, "components.flux");
    validateComponent(components.corridor, "components.corridor");
    validateComponent(components.emprunteur, "components.emprunteur");
    validateComponent(components.change, "components.change");

    if (
      input.loanType === "dette_souveraine" &&
      SOVEREIGN_DEBT_VETO_COUNTRIES.has(input.country)
    ) {
      return veto("dette_souveraine blocked for BF/ML/NE/GN");
    }

    const rawScore =
      components.pays * DECISION_COMPONENT_WEIGHTS.pays +
      components.politique * DECISION_COMPONENT_WEIGHTS.politique +
      components.sectoriel * DECISION_COMPONENT_WEIGHTS.sectoriel +
      components.flux * DECISION_COMPONENT_WEIGHTS.flux +
      components.corridor * DECISION_COMPONENT_WEIGHTS.corridor +
      components.emprunteur * DECISION_COMPONENT_WEIGHTS.emprunteur +
      components.change * DECISION_COMPONENT_WEIGHTS.change;

    const score = new Decimal(rawScore).toDecimalPlaces(2).toNumber();

    return {
      decision_proposal: computeDecisionProposal(score),
      score,
      veto_applied: false,
      human_review_required: true,
      disclaimer: CREDIT_DECISION_DISCLAIMER,
    };
  }
}
