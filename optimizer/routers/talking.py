import asyncio
import logging
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, PlainTextResponse
from pydantic import BaseModel

from models.requests import OptimizeRequest
from models.responses import OptimizationResult
from services.data_fetcher import fetch_returns
from services.optimizer import run_optimization
from services.pack_builder import build_pack, pack_to_html, pack_to_markdown
from services.run_store import list_runs, load_run, save_analysis, save_run

logger = logging.getLogger(__name__)
router = APIRouter()


class TalkingRunRequest(BaseModel):
    mode: Literal["last", "saved", "config"]
    run_id: Optional[str] = None
    # Required only for mode=config — mirrors OptimizeRequest fields
    tickers: Optional[list[str]] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    rm: str = "MV"
    obj: str = "Sharpe"
    rf: float = 0.0
    l: float = 2.0
    method_mu: str = "hist"
    method_cov: str = "hist"
    alpha: float = 0.05
    hist: bool = True


class TalkingRunResponse(BaseModel):
    run_id: str


async def _bg_analysis(result: OptimizationResult) -> None:
    """Fire-and-forget: stream Ollama commentary and persist it to the run file."""
    from ai.analyzer import OLLAMA_DEFAULT_MODEL, stream_analysis
    try:
        full_text = ""
        async for chunk in stream_analysis(result):
            full_text += chunk
        if full_text:
            save_analysis(result.run_id, full_text, OLLAMA_DEFAULT_MODEL)
            logger.info("Background analysis saved for run %s", result.run_id)
    except Exception as exc:
        logger.warning("Background Ollama analysis skipped for run %s: %s", result.run_id, exc)


@router.post("/talking/run", response_model=TalkingRunResponse)
async def talking_run(req: TalkingRunRequest):
    """Return the run_id to use for pack building.

    mode=last   — use the most-recent saved run (no optimization)
    mode=saved  — verify run_id exists and return it
    mode=config — run a fresh optimization, kick off Ollama in the background
    """
    if req.mode == "last":
        runs = list_runs()
        if not runs:
            raise HTTPException(
                status_code=404,
                detail={"error": "no_runs", "message": "No saved runs found. Run an optimization first."}
            )
        logger.info("talking/run mode=last → run_id=%s", runs[0].run_id)
        return TalkingRunResponse(run_id=runs[0].run_id)

    if req.mode == "saved":
        if not req.run_id:
            raise HTTPException(
                status_code=422,
                detail={"error": "missing_run_id", "message": "run_id is required for mode=saved."}
            )
        run = load_run(req.run_id)
        if not run:
            raise HTTPException(
                status_code=404,
                detail={"error": "not_found", "message": f"Run {req.run_id} not found."}
            )
        logger.info("talking/run mode=saved → run_id=%s", run.run_id)
        return TalkingRunResponse(run_id=run.run_id)

    # mode=config
    if not req.tickers or not req.start_date or not req.end_date:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "missing_fields",
                "message": "tickers, start_date, and end_date are required for mode=config."
            }
        )

    opt_req = OptimizeRequest(
        tickers=req.tickers,
        start_date=req.start_date,
        end_date=req.end_date,
        rm=req.rm,
        obj=req.obj,
        rf=req.rf,
        l=req.l,
        method_mu=req.method_mu,
        method_cov=req.method_cov,
        alpha=req.alpha,
        hist=req.hist,
    )

    try:
        returns = await fetch_returns(opt_req.tickers, opt_req.start_date, opt_req.end_date)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={"error": "insufficient_data", "message": str(exc)})
    except Exception as exc:
        logger.exception("fetch_returns failed in talking/run")
        raise HTTPException(
            status_code=422,
            detail={"error": "data_fetch_error", "message": f"Failed to fetch price data: {exc}"}
        )

    result = run_optimization(opt_req, returns)
    save_run(result)

    # Kick off Ollama commentary without blocking the response
    asyncio.create_task(_bg_analysis(result))

    logger.info("talking/run mode=config → run_id=%s", result.run_id)
    return TalkingRunResponse(run_id=result.run_id)


@router.get("/talking/pack/{run_id}")
async def talking_pack(run_id: str, format: str = "json"):
    """Return the Report Context Pack for a given run.

    ?format=json (default) | markdown | html
    """
    run = load_run(run_id)
    if not run:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": f"Run {run_id} not found."}
        )

    pack = build_pack(run)

    if format == "markdown":
        return PlainTextResponse(pack_to_markdown(pack), media_type="text/markdown")
    if format == "html":
        return HTMLResponse(pack_to_html(pack))

    return pack
