import Card from '../ui/Card'
import { InfoTooltip } from '../ui/Tooltip'
import { pct, decimal } from '../../utils/formatters'
import type { PortfolioMetrics } from '../../types/api'
import { RM_MAP } from '../../utils/constants'

interface MetricsCardsProps {
  metrics: PortfolioMetrics
}

function MetricCard({
  label, value, sub, tooltip, highlight = false
}: {
  label: string
  value: string
  sub?: string
  tooltip: string
  highlight?: boolean
}) {
  return (
    <Card className={highlight ? 'border-brand-500/30' : ''}>
      <div className="flex items-start justify-between">
        <span className="text-xs text-slate-400 flex items-center">
          {label}
          <InfoTooltip content={tooltip} />
        </span>
        {highlight && (
          <span className="text-xs text-brand-400 font-medium">★ Key</span>
        )}
      </div>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${
        highlight ? 'text-brand-300' : 'text-slate-100'
      }`}>
        {value}
      </p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </Card>
  )
}

export default function MetricsCards({ metrics }: MetricsCardsProps) {
  const rmLabel = RM_MAP[metrics.rm_used]?.label ?? metrics.rm_used

  return (
    <div className="grid grid-cols-3 gap-4">
      <MetricCard
        label="Sharpe Ratio"
        value={decimal(metrics.sharpe_ratio, 2)}
        sub="Higher = better risk-adjusted return"
        tooltip="Return earned per unit of risk (std dev basis). Above 1.0 is generally considered good."
        highlight
      />
      <MetricCard
        label="Expected Annual Return"
        value={pct(metrics.expected_return)}
        sub="Annualized (252 trading days)"
        tooltip="Estimated yearly return based on the selected return estimator and historical data."
      />
      <MetricCard
        label={`Portfolio Risk (${metrics.rm_used})`}
        value={pct(metrics.portfolio_risk)}
        sub={`Annualized · ${rmLabel}`}
        tooltip="Annualized portfolio risk using standard deviation, regardless of selected risk measure. The optimizer minimized risk using your chosen measure."
      />
    </div>
  )
}
