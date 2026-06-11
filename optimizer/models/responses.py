from pydantic import BaseModel
from typing import Optional


class TickerValidationResult(BaseModel):
    ticker: str
    valid: bool
    name: Optional[str] = None
    error: Optional[str] = None


class ValidateTickersResponse(BaseModel):
    results: list[TickerValidationResult]


class AssetWeight(BaseModel):
    ticker: str
    weight: float


class AssetRiskContribution(BaseModel):
    ticker: str
    contribution: float


class PortfolioMetrics(BaseModel):
    expected_return: float    # annualized
    portfolio_risk: float     # annualized (std dev basis)
    sharpe_ratio: float
    rm_used: str
    obj_used: str


class OptimizationResult(BaseModel):
    run_id: str
    timestamp: str            # ISO-8601
    tickers: list[str]
    start_date: str
    end_date: str
    n_observations: int
    config: dict              # full param snapshot — needed for Phase 2 PDF
    weights: list[AssetWeight]
    metrics: PortfolioMetrics
    risk_contributions: list[AssetRiskContribution]
    ai_analysis: Optional[str] = None
    ai_model: Optional[str] = None


class RunSummary(BaseModel):
    run_id: str
    timestamp: str
    tickers: list[str]
    ticker_count: int
    obj: str
    rm: str


class RunsListResponse(BaseModel):
    runs: list[RunSummary]


class ErrorResponse(BaseModel):
    error: str
    message: str
    detail: Optional[str] = None
