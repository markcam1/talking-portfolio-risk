// ── Requests ────────────────────────────────────────────────────────────────

export interface ValidateTickersRequest {
  tickers: string[]
}

export interface OptimizeRequest {
  tickers: string[]
  start_date: string   // YYYY-MM-DD
  end_date: string
  rm: string
  obj: string
  rf: number
  l: number
  method_mu: string
  method_cov: string
  alpha: number
  hist: boolean
}

// ── Responses ────────────────────────────────────────────────────────────────

export interface TickerValidationResult {
  ticker: string
  valid: boolean
  name: string | null
  error: string | null
}

export interface ValidateTickersResponse {
  results: TickerValidationResult[]
}

export interface AssetWeight {
  ticker: string
  weight: number
}

export interface AssetRiskContribution {
  ticker: string
  contribution: number
}

export interface PortfolioMetrics {
  expected_return: number
  portfolio_risk: number
  sharpe_ratio: number
  rm_used: string
  obj_used: string
}

export interface OptimizationResult {
  run_id: string
  timestamp: string
  tickers: string[]
  start_date: string
  end_date: string
  n_observations: number
  config: Record<string, unknown>
  weights: AssetWeight[]
  metrics: PortfolioMetrics
  risk_contributions: AssetRiskContribution[]
  ai_analysis?: string | null
  ai_model?: string | null
}

export interface RunSummary {
  run_id: string
  timestamp: string
  tickers: string[]
  ticker_count: number
  obj: string
  rm: string
}

export interface RunsListResponse {
  runs: RunSummary[]
}

export interface ApiError {
  error: string
  message: string
  detail?: string | null
}
