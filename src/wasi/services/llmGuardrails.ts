export const ENFORCED_FINANCIAL_MODEL = "claude-sonnet-4-6";
export const MISSING_REALTIME_DATA_MESSAGE = "Je n'ai pas cette donnée en temps réel";
export const HUMAN_REVIEW_REQUIRED_FLAG = "human_review_required: true";
export const ADVISORY_DISCLAIMER = "Advisory only. Décision finale = validation humaine";

const CREDIT_QUERY_PATTERN =
  /\b(credit|crédit|loan|pret|prêt|dette|trade_finance|trade finance|microfinance|credit_bail|credit-bail)\b/i;

export function isCreditRelatedQuery(query: string): boolean {
  return CREDIT_QUERY_PATTERN.test(query);
}

export function enforceWasiAssistantGuardrails(query: string, reply: string): string {
  const normalizedReply = (reply || "").trim() || MISSING_REALTIME_DATA_MESSAGE;

  if (!isCreditRelatedQuery(query)) {
    return normalizedReply;
  }

  let safeReply = normalizedReply;

  if (!/human_review_required\s*:\s*true/i.test(safeReply)) {
    safeReply = `${safeReply}\n\n${HUMAN_REVIEW_REQUIRED_FLAG}`;
  }
  if (!safeReply.includes(ADVISORY_DISCLAIMER)) {
    safeReply = `${safeReply}\n${ADVISORY_DISCLAIMER}`;
  }

  return safeReply;
}
