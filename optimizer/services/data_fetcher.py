import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Optional
import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=4)

MIN_OBSERVATIONS = 30  # minimum trading days required


def _fetch_ticker_info(ticker: str) -> tuple[str, bool, Optional[str], Optional[str]]:
    """Return (ticker, valid, display_name, error). Runs in a thread."""
    try:
        t = yf.Ticker(ticker)
        info = t.fast_info
        # fast_info raises or returns empty on bad tickers
        name = getattr(info, "display_name", None) or ticker
        # Double-check by fetching a tiny slice
        hist = t.history(period="5d", raise_errors=False)
        if hist.empty:
            return ticker, False, None, "No price data found for this ticker"
        return ticker, True, name, None
    except Exception as exc:
        return ticker, False, None, str(exc)


async def validate_tickers(tickers: list[str]) -> list[dict]:
    loop = asyncio.get_event_loop()
    tasks = [
        loop.run_in_executor(_executor, _fetch_ticker_info, t)
        for t in tickers
    ]
    results = await asyncio.gather(*tasks)
    return [
        {"ticker": r[0], "valid": r[1], "name": r[2], "error": r[3]}
        for r in results
    ]


def _fetch_prices(tickers: list[str], start: str, end: str) -> pd.DataFrame:
    """Download adjusted close prices. Runs in a thread."""
    logger.info("Fetching prices for %s from %s to %s", tickers, start, end)
    data = yf.download(
        tickers,
        start=start,
        end=end,
        auto_adjust=True,
        progress=False,
    )
    if data.empty:
        raise ValueError(f"No price data returned for tickers: {tickers}")

    if len(tickers) == 1:
        # yfinance returns a flat DataFrame for a single ticker
        prices = data[["Close"]].copy()
        prices.columns = tickers
    else:
        prices = data["Close"].copy()
        # Drop tickers with entirely missing data
        prices.dropna(axis=1, how="all", inplace=True)
        missing = set(tickers) - set(prices.columns)
        if missing:
            raise ValueError(f"No data found for tickers: {sorted(missing)}")

    # Reorder to match original ticker list (drop any that got removed)
    available = [t for t in tickers if t in prices.columns]
    prices = prices[available]
    return prices


async def fetch_returns(tickers: list[str], start: str, end: str) -> pd.DataFrame:
    """Return a DataFrame of daily returns (pct_change) with tickers as columns."""
    loop = asyncio.get_event_loop()
    prices = await loop.run_in_executor(
        _executor, _fetch_prices, tickers, start, end
    )

    returns = prices.pct_change().dropna()

    if len(returns) < MIN_OBSERVATIONS:
        raise ValueError(
            f"Only {len(returns)} trading days found for the selected date range. "
            f"Minimum required: {MIN_OBSERVATIONS}. Please widen the date range."
        )

    logger.info(
        "Fetched %d observations for %d tickers",
        len(returns), len(returns.columns)
    )
    return returns
