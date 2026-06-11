import json
import logging
import os
import shutil
import sys
from pathlib import Path
from typing import AsyncGenerator

import httpx
import yaml

from models.responses import OptimizationResult

logger = logging.getLogger(__name__)


def _load_ollama_config() -> dict:
    if hasattr(sys, '_MEIPASS'):
        # Packaged: seed config to user data dir on first launch so users can edit it
        user_data = os.environ.get('APP_DATA_PATH', '')
        if user_data:
            target = Path(user_data) / 'config.yaml'
            if not target.exists():
                bundled = Path(sys._MEIPASS) / 'config.yaml'
                try:
                    shutil.copy(bundled, target)
                    logger.info("Seeded config.yaml to %s", target)
                except Exception as exc:
                    logger.warning("Could not seed config.yaml: %s", exc)
            config_path = target if target.exists() else Path(sys._MEIPASS) / 'config.yaml'
        else:
            config_path = Path(sys._MEIPASS) / 'config.yaml'
    else:
        config_path = Path(__file__).resolve().parent.parent / 'config.yaml'
    try:
        raw = yaml.safe_load(config_path.read_text(encoding='utf-8')) or {}
        return raw.get('ollama', {})
    except Exception as exc:
        logger.warning("Could not read config.yaml, using defaults: %s", exc)
        return {}


_cfg = _load_ollama_config()

OLLAMA_BASE_URL: str = _cfg.get('base_url', 'http://127.0.0.1:11434')
# Support both old single `model:` key and new `models:` list
_models_raw: list = _cfg.get('models') or ([_cfg['model']] if 'model' in _cfg else [])
OLLAMA_MODELS: list[str] = [str(m) for m in _models_raw if m]
OLLAMA_DEFAULT_MODEL: str = OLLAMA_MODELS[0] if OLLAMA_MODELS else 'llama3.2'
ALLOW_FRONTEND_SWITCH: bool = bool(_cfg.get('allow_frontend_switch', False))


class OllamaUnavailableError(Exception):
    pass


class OllamaModelNotFoundError(Exception):
    pass


def build_prompt(result: OptimizationResult) -> str:
    cfg = result.config
    rf_pct = float(cfg.get("rf", 0)) * 100
    alpha = cfg.get("alpha", 0.05)
    method_mu = cfg.get("method_mu", "")
    method_cov = cfg.get("method_cov", "")

    m = result.metrics
    ret_pct = m.expected_return * 100
    risk_pct = m.portfolio_risk * 100

    weights_rows = "\n".join(
        f"  {w.ticker:<8} {w.weight * 100:>6.2f}%"
        for w in sorted(result.weights, key=lambda w: w.weight, reverse=True)
    )
    risk_rows = "\n".join(
        f"  {r.ticker:<8} {r.contribution * 100:>6.2f}%"
        for r in sorted(result.risk_contributions, key=lambda r: r.contribution, reverse=True)
    )

    return f"""You are a portfolio analysis assistant. Analyze these optimization results concisely and practically.

Portfolio: {", ".join(result.tickers)} ({len(result.tickers)} assets)
Optimization: {m.obj_used} objective · {m.rm_used} risk measure
Period: {result.start_date} to {result.end_date} ({result.n_observations} trading days)
Risk-free rate: {rf_pct:.2f}%   Alpha: {alpha}   Return estimator: {method_mu}   Covariance: {method_cov}

Performance Metrics:
  Expected Annual Return : {ret_pct:.2f}%
  Portfolio Risk (Ann. SD): {risk_pct:.2f}%
  Sharpe Ratio            : {m.sharpe_ratio:.4f}

Asset Weights:
{weights_rows}

Risk Contributions:
{risk_rows}

Provide a brief analysis (4–6 sentences) covering:
1. Overall portfolio quality given the Sharpe ratio and risk level
2. Concentration or diversification observations
3. Any notable risk/return characteristics
4. Key caveats about the optimization approach or data limitations

Use plain English. Avoid jargon where possible."""


class ThinkStripper:
    """Discard <think>…</think> reasoning blocks from streamed text.

    Tags may span multiple chunks; state is maintained across feed() calls.
    Call flush() once at end-of-stream to emit any remaining buffered content.
    """
    _OPEN = "<think>"
    _CLOSE = "</think>"

    def __init__(self) -> None:
        self._buf = ""
        self._in_think = False
        self._any_yielded = False

    def feed(self, chunk: str) -> str:
        self._buf += chunk
        out: list[str] = []

        while True:
            if self._in_think:
                end = self._buf.find(self._CLOSE)
                if end == -1:
                    self._buf = ""  # discard; closing tag not yet arrived
                    break
                self._buf = self._buf[end + len(self._CLOSE):]
                self._in_think = False
            else:
                start = self._buf.find(self._OPEN)
                if start == -1:
                    # No opening tag — yield all but last 6 chars (partial-tag guard)
                    safe = max(0, len(self._buf) - (len(self._OPEN) - 1))
                    out.append(self._buf[:safe])
                    self._buf = self._buf[safe:]
                    break
                out.append(self._buf[:start])
                self._buf = self._buf[start + len(self._OPEN):]
                self._in_think = True

        result = "".join(out)
        # Strip leading whitespace before the first real content (newline after </think>)
        if result and not self._any_yielded:
            result = result.lstrip()
        if result:
            self._any_yielded = True
        return result

    def flush(self) -> str:
        if self._in_think:
            self._buf = ""
            self._in_think = False
            return ""
        result = self._buf.lstrip() if not self._any_yielded else self._buf
        self._buf = ""
        return result


async def stream_analysis(
    result: OptimizationResult,
    model: str | None = None,
) -> AsyncGenerator[str, None]:
    resolved_model = model or OLLAMA_DEFAULT_MODEL
    payload = {
        "model": resolved_model,
        "messages": [{"role": "user", "content": build_prompt(result)}],
        "stream": True,
    }
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{OLLAMA_BASE_URL}/api/chat",
                json=payload,
            ) as response:
                if response.status_code == 404:
                    raise OllamaModelNotFoundError(resolved_model)
                response.raise_for_status()
                stripper = ThinkStripper()
                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                        text = chunk.get("message", {}).get("content", "")
                        filtered = stripper.feed(text) if text else ""
                        if filtered:
                            yield filtered
                        if chunk.get("done"):
                            remainder = stripper.flush()
                            if remainder:
                                yield remainder
                            break
                    except json.JSONDecodeError:
                        logger.warning("Skipping malformed NDJSON line: %s", line[:120])
    except httpx.ConnectError as exc:
        raise OllamaUnavailableError() from exc
