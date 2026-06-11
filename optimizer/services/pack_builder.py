import uuid
from datetime import datetime, timezone

from models.responses import OptimizationResult

_OBJECTIVE_PLAIN = {
    "Sharpe":  "Maximize risk-adjusted return (Sharpe ratio)",
    "MinRisk": "Minimize portfolio risk",
    "MaxRet":  "Maximize expected return",
    "Utility": "Maximize risk-adjusted utility",
}

_TOP_N = 5  # top holdings shown in the headline


def build_pack(run: OptimizationResult) -> dict:
    """Map an OptimizationResult to the Report Context Pack schema (spec §5.1)."""
    obj = run.config.get("obj", "Sharpe")
    rm  = run.config.get("rm", "MV")
    objective_plain = _OBJECTIVE_PLAIN.get(obj, obj)

    sorted_weights = sorted(run.weights, key=lambda w: w.weight, reverse=True)
    top_holdings = [
        {"ticker": w.ticker, "weight": round(w.weight, 4)}
        for w in sorted_weights[:_TOP_N]
    ]

    return {
        "schema_version": "1.0",
        "pack_id": str(uuid.uuid4()),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "portfolio": {
            "name": f"{obj} / {rm}",
            "tickers": run.tickers,
            "date_range": {
                "start": run.start_date,
                "end": run.end_date,
            },
        },
        "config": {
            "risk_measure":   rm,
            "objective":      obj,
            "risk_free_rate": run.config.get("rf", 0.0),
            "risk_aversion":  run.config.get("l"),
            "alpha":          run.config.get("alpha"),
            "method_mu":      run.config.get("method_mu"),
            "method_cov":     run.config.get("method_cov"),
        },
        "headline": {
            "objective_plain":      objective_plain,
            "sharpe_ratio":         run.metrics.sharpe_ratio,
            "expected_return_annual": run.metrics.expected_return,
            "portfolio_risk_annual":  run.metrics.portfolio_risk,
            "top_holdings":         top_holdings,
        },
        "weights": [
            {"ticker": w.ticker, "weight": round(w.weight, 4)}
            for w in run.weights
        ],
        "risk_contribution": [
            {"ticker": rc.ticker, "contribution": round(rc.contribution, 4)}
            for rc in run.risk_contributions
        ],
        "ai_commentary":       run.ai_analysis,
        "ai_commentary_model": run.ai_model,
        "source_run_id":       run.run_id,
        "disclaimers": ["Educational use only. Not investment advice."],
    }


def pack_to_markdown(pack: dict) -> str:
    h = pack["headline"]
    lines = [
        f"# Portfolio Report: {pack['portfolio']['name']}",
        f"Generated: {pack['generated_at']}",
        "",
        f"**Objective:** {h['objective_plain']}",
        f"**Sharpe Ratio:** {h['sharpe_ratio']:.3f}",
        f"**Expected Return (annual):** {h['expected_return_annual'] * 100:.1f}%",
        f"**Portfolio Risk (annual):** {h['portfolio_risk_annual'] * 100:.1f}%",
        "",
        "## Top Holdings",
    ]
    for holding in h["top_holdings"]:
        lines.append(f"- {holding['ticker']}: {holding['weight'] * 100:.1f}%")
    lines += ["", "## All Weights"]
    for w in pack["weights"]:
        lines.append(f"- {w['ticker']}: {w['weight'] * 100:.1f}%")
    lines += ["", "## Risk Contribution"]
    for rc in pack["risk_contribution"]:
        lines.append(f"- {rc['ticker']}: {rc['contribution'] * 100:.1f}%")
    if pack.get("ai_commentary"):
        lines += ["", "## AI Commentary", pack["ai_commentary"]]
    lines += ["", "---", *pack["disclaimers"]]
    return "\n".join(lines)


def pack_to_html(pack: dict) -> str:
    h = pack["headline"]

    def esc(s: str) -> str:
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    def weight_rows(items: list[dict], key: str) -> str:
        return "".join(
            f"<tr><td>{esc(item['ticker'])}</td>"
            f"<td>{item[key] * 100:.1f}%</td></tr>"
            for item in items
        )

    commentary_block = ""
    if pack.get("ai_commentary"):
        commentary_block = (
            f"<h2>AI Commentary</h2>"
            f"<p>{esc(pack['ai_commentary'])}</p>"
        )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Portfolio Report: {esc(pack['portfolio']['name'])}</title>
<style>
  body {{ font-family: sans-serif; max-width: 760px; margin: 2rem auto; color: #222; }}
  h1 {{ font-size: 1.4rem; }} h2 {{ font-size: 1.1rem; margin-top: 1.5rem; }}
  table {{ border-collapse: collapse; width: 100%; margin: 0.5rem 0; }}
  td, th {{ padding: 0.25rem 0.5rem; border: 1px solid #ddd; text-align: left; }}
  .meta {{ color: #666; font-size: 0.85rem; }}
  .disclaimer {{ color: #888; font-size: 0.8rem; border-top: 1px solid #ddd; margin-top: 2rem; padding-top: 0.5rem; }}
</style>
</head>
<body>
<h1>Portfolio Report: {esc(pack['portfolio']['name'])}</h1>
<p class="meta">Generated: {esc(pack['generated_at'])} &mdash; Source run: {esc(pack['source_run_id'])}</p>

<h2>Headline</h2>
<table>
  <tr><th>Metric</th><th>Value</th></tr>
  <tr><td>Objective</td><td>{esc(h['objective_plain'])}</td></tr>
  <tr><td>Sharpe Ratio</td><td>{h['sharpe_ratio']:.3f}</td></tr>
  <tr><td>Expected Return (annual)</td><td>{h['expected_return_annual'] * 100:.1f}%</td></tr>
  <tr><td>Portfolio Risk (annual)</td><td>{h['portfolio_risk_annual'] * 100:.1f}%</td></tr>
</table>

<h2>Weights</h2>
<table>
  <tr><th>Ticker</th><th>Weight</th></tr>
  {weight_rows(sorted(pack['weights'], key=lambda x: x['weight'], reverse=True), 'weight')}
</table>

<h2>Risk Contribution</h2>
<table>
  <tr><th>Ticker</th><th>Contribution</th></tr>
  {weight_rows(sorted(pack['risk_contribution'], key=lambda x: x['contribution'], reverse=True), 'contribution')}
</table>

{commentary_block}

<p class="disclaimer">{' '.join(esc(d) for d in pack['disclaimers'])}</p>
</body>
</html>"""
