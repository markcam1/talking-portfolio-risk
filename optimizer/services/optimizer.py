import logging
import numpy as np
import pandas as pd
import riskfolio as rp
from fastapi import HTTPException

from models.requests import OptimizeRequest
from models.responses import (
    AssetWeight, AssetRiskContribution, PortfolioMetrics, OptimizationResult
)

logger = logging.getLogger(__name__)

TRADING_DAYS = 252  # annualization factor


def _compute_risk_contributions(
    weights: np.ndarray,
    cov: np.ndarray
) -> np.ndarray:
    """Marginal risk contribution (MV basis), normalized to sum to 1."""
    try:
        port_var = float(weights.T @ cov @ weights)
        if port_var <= 0:
            return np.ones(len(weights)) / len(weights)
        mrc = weights * (cov @ weights) / port_var
        # Clip negatives that arise from near-zero short positions
        mrc = np.clip(mrc, 0, None)
        total = mrc.sum()
        return mrc / total if total > 0 else np.ones(len(weights)) / len(weights)
    except Exception:
        return np.ones(len(weights)) / len(weights)


def run_optimization(
    req: OptimizeRequest,
    returns: pd.DataFrame
) -> OptimizationResult:
    import uuid
    from datetime import datetime, timezone

    tickers = list(returns.columns)
    n = len(tickers)
    logger.info(
        "Running optimization: rm=%s obj=%s tickers=%s",
        req.rm, req.obj, tickers
    )

    # --- Build portfolio and estimate statistics ---
    port = rp.Portfolio(returns=returns)
    port.alpha = req.alpha

    try:
        port.assets_stats(method_mu=req.method_mu, method_cov=req.method_cov)
    except Exception as exc:
        logger.exception("assets_stats failed")
        raise HTTPException(
            status_code=422,
            detail={
                "error": "stats_failed",
                "message": f"Failed to estimate portfolio statistics: {exc}",
                "detail": str(exc)
            }
        )

    # --- Run optimization ---
    # Riskfolio expects rf in the same frequency as returns (daily).
    # The user supplies an annual rate, so convert before passing.
    rf_daily = req.rf / TRADING_DAYS
    try:
        w_df = port.optimization(
            model="Classic",
            rm=req.rm,
            obj=req.obj,
            rf=rf_daily,
            l=req.l,
            hist=req.hist
        )
    except Exception as exc:
        logger.exception("optimization() raised an exception")
        raise HTTPException(
            status_code=422,
            detail={
                "error": "optimization_error",
                "message": f"Optimization failed: {exc}",
                "detail": str(exc)
            }
        )

    if w_df is None:
        logger.warning("optimization() returned None — infeasible problem")
        raise HTTPException(
            status_code=422,
            detail={
                "error": "infeasible_portfolio",
                "message": (
                    "No feasible portfolio found for the given parameters. "
                    "Try a different risk measure, objective, or wider date range."
                ),
                "detail": "Solver returned None — problem may be unbounded or constraints unsatisfiable."
            }
        )

    # --- Extract weights ---
    weights_series = w_df["weights"]
    weights_arr = weights_series.values.astype(float)
    weights_arr = np.clip(weights_arr, 0, None)  # ensure non-negative
    if weights_arr.sum() > 0:
        weights_arr = weights_arr / weights_arr.sum()

    # --- Compute metrics ---
    mu = port.mu.values.flatten().astype(float)
    cov = port.cov.values.astype(float)

    mu_p_daily = float(mu @ weights_arr)
    mu_p = mu_p_daily * TRADING_DAYS  # annualized

    var_p = float(weights_arr.T @ cov @ weights_arr)
    risk_p = np.sqrt(var_p) * np.sqrt(TRADING_DAYS)  # annualized std dev

    sharpe = (mu_p - req.rf) / risk_p if risk_p > 0 else 0.0

    # --- Risk contributions (MV basis for all rm) ---
    rc = _compute_risk_contributions(weights_arr, cov)

    # --- Build result ---
    run_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()

    asset_weights = [
        AssetWeight(ticker=tickers[i], weight=float(weights_arr[i]))
        for i in range(n)
    ]
    asset_rc = [
        AssetRiskContribution(ticker=tickers[i], contribution=float(rc[i]))
        for i in range(n)
    ]
    metrics = PortfolioMetrics(
        expected_return=round(mu_p, 6),
        portfolio_risk=round(risk_p, 6),
        sharpe_ratio=round(sharpe, 4),
        rm_used=req.rm,
        obj_used=req.obj
    )

    result = OptimizationResult(
        run_id=run_id,
        timestamp=timestamp,
        tickers=tickers,
        start_date=req.start_date,
        end_date=req.end_date,
        n_observations=len(returns),
        config={
            "rm": req.rm,
            "obj": req.obj,
            "rf": req.rf,
            "l": req.l,
            "method_mu": req.method_mu,
            "method_cov": req.method_cov,
            "alpha": req.alpha,
            "hist": req.hist,
            "start_date": req.start_date,
            "end_date": req.end_date
        },
        weights=asset_weights,
        metrics=metrics,
        risk_contributions=asset_rc
    )

    logger.info("Optimization complete: run_id=%s sharpe=%.3f", run_id, sharpe)
    return result
