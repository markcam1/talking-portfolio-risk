import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { CHART_COLORS } from '../../utils/constants'
import { pct } from '../../utils/formatters'
import type { AssetRiskContribution } from '../../types/api'

interface RiskContributionChartProps {
  contributions: AssetRiskContribution[]
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="font-mono font-bold text-slate-100">{payload[0].payload.ticker}</p>
      <p className="text-slate-400 mt-0.5">Risk contribution: {pct(payload[0].value, 2)}</p>
    </div>
  )
}

export default function RiskContributionChart({ contributions }: RiskContributionChartProps) {
  const data = [...contributions]
    .sort((a, b) => b.contribution - a.contribution)
    .map(c => ({ ticker: c.ticker, contribution: c.contribution }))

  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 36)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
      >
        <XAxis
          type="number"
          domain={[0, 1]}
          tickFormatter={v => pct(v, 0)}
          tick={{ fontSize: 10, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="ticker"
          width={52}
          tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'monospace' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
        <Bar dataKey="contribution" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
