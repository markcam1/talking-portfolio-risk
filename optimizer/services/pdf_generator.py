import io
import logging
import re
from datetime import datetime
from xml.sax.saxutils import escape as xml_escape

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, HRFlowable, KeepTogether
)

from models.responses import OptimizationResult

logger = logging.getLogger(__name__)

# letter - 2 × 0.75 in margins
_PAGE_W  = 7.0 * inch
# side-by-side layout columns
_CHART_W = 3.9 * inch          # image column
_SIDE_W  = _PAGE_W - _CHART_W  # companion table column = 3.1 in

# Same palette as CHART_COLORS in constants.ts
_PALETTE = [
    '#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#ef4444',
    '#8b5cf6', '#06b6d4', '#f97316', '#14b8a6', '#f43f5e',
    '#a78bfa', '#67e8f9', '#fcd34d', '#6ee7b7', '#fca5a5',
    '#c4b5fd', '#a5f3fc', '#fde68a', '#a7f3d0', '#fecdd3',
]

def _hex_to_rgb(h: str) -> tuple[float, float, float]:
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) / 255 for i in (0, 2, 4))


def _weights_pie(weights) -> io.BytesIO:
    labels  = [w.ticker for w in weights]
    sizes   = [w.weight  for w in weights]
    palette = [_hex_to_rgb(_PALETTE[i % len(_PALETTE)]) for i in range(len(labels))]

    fig, ax = plt.subplots(figsize=(4.0, 3.2), facecolor='white')
    wedges, _, autotexts = ax.pie(
        sizes, labels=None, autopct='%1.1f%%',
        colors=palette, startangle=90,
        pctdistance=0.75, wedgeprops={'linewidth': 0.8, 'edgecolor': 'white'}
    )
    for at in autotexts:
        at.set_fontsize(7)
    ax.legend(
        wedges, labels,
        loc='center left', bbox_to_anchor=(1.0, 0.5),
        fontsize=7, frameon=False
    )
    ax.set_title('Portfolio Allocation', fontsize=10, fontweight='bold', pad=8)
    fig.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    buf.seek(0)
    return buf


def _risk_bar(contributions) -> io.BytesIO:
    tickers = [c.ticker for c in contributions]
    values  = [c.contribution * 100 for c in contributions]
    palette = [_hex_to_rgb(_PALETTE[i % len(_PALETTE)]) for i in range(len(tickers))]

    fig_h = max(2.2, len(tickers) * 0.32 + 0.7)
    fig, ax = plt.subplots(figsize=(4.8, fig_h), facecolor='white')
    bars = ax.barh(tickers, values, color=palette, edgecolor='white', linewidth=0.5)
    ax.invert_yaxis()
    ax.set_xlabel('Risk Contribution (%)', fontsize=8)
    ax.set_title('Marginal Risk Contribution', fontsize=10, fontweight='bold')
    ax.tick_params(axis='y', labelsize=7)
    ax.tick_params(axis='x', labelsize=7)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    x_max = max(values) if values else 1
    for bar, val in zip(bars, values):
        ax.text(val + x_max * 0.01, bar.get_y() + bar.get_height() / 2,
                f'{val:.1f}%', va='center', fontsize=6.5)

    fig.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    buf.seek(0)
    return buf


def _table_style(header_bg=colors.HexColor('#4f46e5')) -> TableStyle:
    return TableStyle([
        ('BACKGROUND',    (0, 0), (-1, 0), header_bg),
        ('TEXTCOLOR',     (0, 0), (-1, 0), colors.white),
        ('FONTNAME',      (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE',      (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 5),
        ('TOPPADDING',    (0, 0), (-1, 0), 5),
        ('FONTNAME',      (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE',      (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
        ('TOPPADDING',    (0, 1), (-1, -1), 4),
        ('ROWBACKGROUNDS',(0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
        ('GRID',          (0, 0), (-1, -1), 0.4, colors.HexColor('#dee2e6')),
        ('ALIGN',         (1, 0), (-1, -1), 'RIGHT'),
    ])


def generate_pdf(result: OptimizationResult) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        rightMargin=0.75 * inch, leftMargin=0.75 * inch,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch
    )

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle('H1', parent=styles['Heading1'], fontSize=18, spaceAfter=2,
                         textColor=colors.HexColor('#1e293b'))
    h2 = ParagraphStyle('H2', parent=styles['Heading2'], fontSize=11, spaceAfter=4,
                         spaceBefore=10, textColor=colors.HexColor('#334155'))
    normal = styles['Normal']
    small  = ParagraphStyle('Small', parent=normal, fontSize=8,
                             textColor=colors.HexColor('#64748b'))

    story = []

    # ── Title block ───────────────────────────────────────────────────
    story.append(Paragraph('Portfolio Optimization Report', h1))
    try:
        ts_fmt = datetime.fromisoformat(result.timestamp).strftime('%B %d, %Y at %I:%M %p UTC')
    except ValueError:
        ts_fmt = result.timestamp
    story.append(Paragraph(f'Generated {ts_fmt}', small))
    story.append(Spacer(1, 0.08 * inch))
    story.append(HRFlowable(width='100%', thickness=1, color=colors.HexColor('#e2e8f0')))
    story.append(Spacer(1, 0.1 * inch))

    # ── Run metadata ──────────────────────────────────────────────────
    story.append(Paragraph('Run Details', h2))
    cfg     = result.config
    rf_pct  = f"{float(cfg.get('rf', 0)) * 100:.2f}%"
    l_val   = cfg.get('l', cfg.get('risk_aversion', '—'))
    alpha   = cfg.get('alpha', '—')

    meta_data = [
        ['Run ID',            result.run_id],
        ['Tickers',           ', '.join(result.tickers)],
        ['Date range',        f'{result.start_date} – {result.end_date}'],
        ['Trading days',      str(result.n_observations)],
        ['Risk measure',      result.metrics.rm_used],
        ['Objective',         result.metrics.obj_used],
        ['Risk-free rate',    rf_pct],
        ['Risk aversion (l)', str(l_val)],
        ['Tail prob. (alpha)',str(alpha)],
    ]
    # label col + value col = _PAGE_W
    meta_tbl = Table(meta_data, colWidths=[2.0 * inch, _PAGE_W - 2.0 * inch])
    meta_tbl.setStyle(TableStyle([
        ('FONTNAME',      (0, 0), (0, -1),  'Helvetica-Bold'),
        ('FONTSIZE',      (0, 0), (-1, -1), 8),
        ('FONTNAME',      (1, 0), (1, -1),  'Helvetica'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING',    (0, 0), (-1, -1), 3),
        ('TEXTCOLOR',     (0, 0), (0, -1),  colors.HexColor('#475569')),
        ('ROWBACKGROUNDS',(0, 0), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
        ('GRID',          (0, 0), (-1, -1), 0.3, colors.HexColor('#e2e8f0')),
    ]))
    story.append(meta_tbl)
    story.append(Spacer(1, 0.15 * inch))

    # ── Portfolio metrics ─────────────────────────────────────────────
    story.append(Paragraph('Portfolio Metrics', h2))
    m = result.metrics
    metrics_data = [
        ['Metric',                   'Value'],
        ['Expected Return (ann.)',   f'{m.expected_return * 100:.2f}%'],
        ['Portfolio Risk (ann.)',    f'{m.portfolio_risk * 100:.2f}%'],
        ['Sharpe Ratio',             f'{m.sharpe_ratio:.4f}'],
    ]
    # two equal cols = _PAGE_W
    metrics_tbl = Table(metrics_data, colWidths=[_PAGE_W * 0.6, _PAGE_W * 0.4])
    metrics_tbl.setStyle(_table_style())
    story.append(metrics_tbl)
    story.append(Spacer(1, 0.15 * inch))

    # ── Asset weights: pie chart left, table right ────────────────────
    story.append(Paragraph('Asset Weights', h2))

    sorted_weights = sorted(result.weights, key=lambda w: w.weight, reverse=True)
    # table fits in _SIDE_W (3.1 in): ticker col + weight col
    w_ticker_col = _SIDE_W * 0.55
    w_value_col  = _SIDE_W - w_ticker_col
    weights_data = [['Ticker', 'Weight']] + [
        [w.ticker, f'{w.weight * 100:.2f}%'] for w in sorted_weights
    ]
    weights_tbl = Table(weights_data, colWidths=[w_ticker_col, w_value_col])
    weights_tbl.setStyle(_table_style())

    try:
        pie_buf = _weights_pie(sorted_weights)
        pie_img = Image(pie_buf, width=_CHART_W - 0.1 * inch, height=2.9 * inch)
        chart_row = Table(
            [[pie_img, weights_tbl]],
            colWidths=[_CHART_W, _SIDE_W]
        )
        chart_row.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
        story.append(KeepTogether(chart_row))
    except Exception as exc:
        logger.warning("Pie chart generation failed: %s", exc)
        full_weights_tbl = Table(weights_data,
                                  colWidths=[_PAGE_W * 0.5, _PAGE_W * 0.5])
        full_weights_tbl.setStyle(_table_style())
        story.append(full_weights_tbl)

    story.append(Spacer(1, 0.15 * inch))

    # ── Risk contributions: bar chart left, table right ───────────────
    story.append(Paragraph('Risk Contributions', h2))
    story.append(Paragraph(
        'Marginal risk contribution (variance basis) — shows diversification quality.',
        small
    ))
    story.append(Spacer(1, 0.06 * inch))

    sorted_rc = sorted(result.risk_contributions, key=lambda c: c.contribution, reverse=True)
    rc_ticker_col = _SIDE_W * 0.55
    rc_value_col  = _SIDE_W - rc_ticker_col
    rc_data = [['Ticker', 'Contribution']] + [
        [c.ticker, f'{c.contribution * 100:.2f}%'] for c in sorted_rc
    ]
    rc_tbl = Table(rc_data, colWidths=[rc_ticker_col, rc_value_col])
    rc_tbl.setStyle(_table_style())

    try:
        bar_buf  = _risk_bar(sorted_rc)
        bar_h    = min(3.5, len(sorted_rc) * 0.3 + 1.0) * inch
        bar_img  = Image(bar_buf, width=_CHART_W - 0.1 * inch, height=bar_h)
        rc_row   = Table(
            [[bar_img, rc_tbl]],
            colWidths=[_CHART_W, _SIDE_W]
        )
        rc_row.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
        story.append(KeepTogether(rc_row))
    except Exception as exc:
        logger.warning("Bar chart generation failed: %s", exc)
        full_rc_tbl = Table(rc_data,
                             colWidths=[_PAGE_W * 0.5, _PAGE_W * 0.5])
        full_rc_tbl.setStyle(_table_style())
        story.append(full_rc_tbl)

    story.append(Spacer(1, 0.15 * inch))

    # ── AI Analysis ───────────────────────────────────────────────────
    if result.ai_analysis:
        story.append(Paragraph('AI Analysis', h2))
        story.append(Paragraph('Generated by Ollama running locally.', small))
        story.append(Spacer(1, 0.06 * inch))

        ai_body = ParagraphStyle('AIBody', parent=normal, fontSize=9,
                                 textColor=colors.HexColor('#334155'),
                                 spaceAfter=5, leading=14)

        for line in result.ai_analysis.split('\n'):
            line = line.strip()
            if line:
                # escape XML special chars, then convert **bold** → <b>bold</b>
                safe = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', xml_escape(line))
                story.append(Paragraph(safe, ai_body))

        story.append(Spacer(1, 0.1 * inch))

    story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#e2e8f0')))
    story.append(Spacer(1, 0.06 * inch))
    story.append(Paragraph(
        f'Run ID: {result.run_id} · Results computed with Riskfolio-Lib',
        small
    ))

    doc.build(story)
    return buf.getvalue()
