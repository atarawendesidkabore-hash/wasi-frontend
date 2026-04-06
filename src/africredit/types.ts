export type SectorRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type CashFlowStability = "STABLE" | "VARIABLE" | "VOLATILE";
export type CreditStatus = "APPROVED" | "VETOED";
export type CreditGrade = "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "CCC" | "D";

export type EcowasCountryCode =
  | "BJ"
  | "BF"
  | "CV"
  | "CI"
  | "GM"
  | "GH"
  | "GN"
  | "GW"
  | "LR"
  | "ML"
  | "MR"
  | "NE"
  | "NG"
  | "SN"
  | "SL"
  | "TG";

export interface CreditApplicationInput {
  paymentHistory: number;
  debtRatio: number;
  sectorRisk: SectorRisk;
  governanceScore: number;
  collateralValue: number;
  cashFlowStability: CashFlowStability;
  countryRisk: EcowasCountryCode;
}

export interface CreditScoreResult {
  score: number;
  grade: CreditGrade;
  status: CreditStatus;
  vetoReason?: string;
}

export type WasiLoanType =
  | "projet"
  | "trade_finance"
  | "dette_souveraine"
  | "private_equity"
  | "court_terme"
  | "credit_bail"
  | "microfinance";

export interface CreditEngineComponents {
  pays: number;
  politique: number;
  sectoriel: number;
  flux: number;
  corridor: number;
  emprunteur: number;
  change: number;
}

export interface CreditDecisionInput {
  country: EcowasCountryCode;
  loanType: WasiLoanType;
  components: CreditEngineComponents;
  borrowerProfile?: string;
  corridor?: string;
}

export type DecisionProposal = "APPROVE" | "REVIEW" | "REJECT" | "VETOED";

export interface CreditDecisionResult {
  decision_proposal: DecisionProposal;
  score: number;
  veto_applied: boolean;
  veto_reason?: string;
  human_review_required: true;
  disclaimer: string;
}

export interface Loan {
  id: string;
  disbursedAmount: bigint;
  outstandingBalance: bigint;
  daysPastDue: number;
  status: "ACTIVE" | "DEFAULTED" | "REPAID" | "WRITTEN_OFF";
}

export interface PortfolioSummary {
  totalLoans: number;
  activeExposureCentimes: bigint;
  atRisk30Centimes: bigint;
  atRisk60Centimes: bigint;
  atRisk90Centimes: bigint;
  par30: number;
  par60: number;
  par90: number;
}
