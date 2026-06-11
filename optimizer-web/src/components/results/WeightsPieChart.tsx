import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { CHART_COLORS } from '../../utils/constants'
import { pct } from '../../utils/formatters'
import type { AssetWeight } from '../../types/api'

interface WeightsPieChartProps {
  weights: AssetWeight[]
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null
  const { name, value } = payload[0]
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="font-mono font-bold text-slate-100">{name}</p>
      <p className="text-slate-400 mt-0.5">{pct(value, 2)}</p>
    </div>
  )
}

const CustomLegend = ({ payload }: any) => (
  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
    {payload.map((entry: any, i: number) => (
      <div key={i} className="flex items-center gap-1.5 text-xs text-slate-400">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: entry.color }} />
        <span className="font-mono">{entry.value}</span>
        <span className="text-slate-500">{pct(entry.payload.weight, 1)}</span>
      </div>
    ))}
  </div>
)

export default function WeightsPieChart({ weights }: WeightsPieChartProps) {
  const data = [...weights]
    .sort((a, b) => b.weight - a.weight)
    .map(w => ({ name: w.ticker, weight: w.weight }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="weight"
          nameKey="name"
          cx="50%"
          cy="45%"
          outerRadius={100}
          innerRadius={55}
          paddingAngle={2}
          stroke="none"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend content={<CustomLegend />} />
      </PieChart>
    </ResponsiveContainer>
  )
}
