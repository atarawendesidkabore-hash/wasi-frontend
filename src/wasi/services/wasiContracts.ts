export type WasiDataMode = "live" | "historique" | "estimation";

export interface DataLineageEnvelope {
  source: string;
  timestamp: string;
  data_mode: WasiDataMode;
  confidence: number;
}

export interface FxRateRow {
  symbol: string;
  rate: number;
}

export interface FxRatesResponse extends DataLineageEnvelope {
  base: string;
  rates: FxRateRow[];
  as_of?: string;
  message?: string;
}

export interface CreditDecisionComponents {
  pays: number;
  politique: number;
  sectoriel: number;
  flux: number;
  corridor: number;
  emprunteur: number;
  change: number;
}

export type LoanType =
  | "projet"
  | "trade_finance"
  | "dette_souveraine"
  | "private_equity"
  | "court_terme"
  | "credit_bail"
  | "microfinance";

export interface CreditDecisionRequest {
  country: string;
  loan_type: LoanType;
  components: CreditDecisionComponents;
  borrower_profile?: string;
  corridor?: string;
}

export interface CreditDecisionResponse {
  decision_proposal: "APPROVE" | "REVIEW" | "REJECT" | "VETOED";
  score: number;
  veto_applied: boolean;
  veto_reason?: string;
  human_review_required: true;
  disclaimer: string;
}

export type ConfidentialityMode = "local" | "cloud";

export interface FinancialAnalysisRequest {
  question: string;
  context_data: unknown;
  confidentiality_mode: ConfidentialityMode;
}

export interface FinancialAnalysisResponse {
  analysis: string;
  model_used: string;
  citations: string[];
  missing_data_flags: string[];
}
