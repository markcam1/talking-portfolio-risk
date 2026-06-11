import logging
from fastapi import APIRouter, HTTPException

from models.requests import OptimizeRequest
from models.responses import OptimizationResult
from services.data_fetcher import fetch_returns
from services.optimizer import run_optimization
from services.run_store import save_run

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/optimize", response_model=OptimizationResult)
async def optimize_endpoint(req: OptimizeRequest):
    logger.info(
        "POST /api/optimize  tickers=%s rm=%s obj=%s start=%s end=%s",
        req.tickers, req.rm, req.obj, req.start_date, req.end_date
    )

    # 1. Fetch historical returns
    try:
        returns = await fetch_returns(req.tickers, req.start_date, req.end_date)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "insufficient_data",
                "message": str(exc),
                "detail": None
            }
        )
    except Exception as exc:
        logger.exception("fetch_returns failed")
        raise HTTPException(
            status_code=422,
            detail={
                "error": "data_fetch_error",
                "message": f"Failed to fetch price data: {exc}",
                "detail": str(exc)
            }
        )

    # Update tickers to those actually returned (may differ after dropna)
    actual_tickers = list(returns.columns)
    if len(actual_tickers) < 2:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "insufficient_data",
                "message": "After removing tickers with missing data, fewer than 2 tickers remain.",
                "detail": f"Available tickers: {actual_tickers}"
            }
        )

    # 2. Run optimization (raises HTTPException on failure)
    result = run_optimization(req, returns)

    # 3. Persist run
    try:
        save_run(result)
    except Exception as exc:
        logger.warning("Could not save run to disk: %s", exc)
        # Non-fatal — still return the result

    return result
