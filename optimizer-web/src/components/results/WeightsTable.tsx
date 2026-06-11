import { CHART_COLORS } from '../../utils/constants'
import { pct } from '../../utils/formatters'
import type { AssetWeight } from '../../types/api'

interface WeightsTableProps {
  weights: AssetWeight[]
}

export default function WeightsTable({ weights }: WeightsTableProps) {
  const sorted = [...weights].sort((a, b) => b.weight - a.weight)

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-900/60">
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">#</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Ticker</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Weight</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-36">Allocation</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {sorted.map((row, i) => {
            const color = CHART_COLORS[i % CHART_COLORS.length]
            return (
              <tr key={row.ticker} className="hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 text-slate-600 text-xs">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                    <span className="font-mono font-semibold text-slate-100">{row.ticker}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono font-medium text-slate-200">
                  {pct(row.weight, 2)}
                </td>
                <td className="px-4 py-3">
                  <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(row.weight * 100).toFixed(1)}%`, background: color }}
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
