import logging
from fastapi import APIRouter

from models.requests import ValidateTickersRequest
from models.responses import ValidateTickersResponse, TickerValidationResult
from services.data_fetcher import validate_tickers

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/validate-tickers", response_model=ValidateTickersResponse)
async def validate_tickers_endpoint(req: ValidateTickersRequest):
    logger.info("Validating tickers: %s", req.tickers)
    raw = await validate_tickers(req.tickers)
    results = [TickerValidationResult(**r) for r in raw]
    return ValidateTickersResponse(results=results)
