import logging
from fastapi import APIRouter, HTTPException

from models.responses import OptimizationResult, RunsListResponse
from services.run_store import list_runs, load_run

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/runs", response_model=RunsListResponse)
def get_runs():
    runs = list_runs()
    return RunsListResponse(runs=runs)


@router.get("/runs/{run_id}", response_model=OptimizationResult)
def get_run(run_id: str):
    result = load_run(run_id)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": f"Run '{run_id}' not found."}
        )
    return result
