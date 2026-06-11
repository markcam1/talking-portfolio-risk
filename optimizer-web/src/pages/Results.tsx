import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOptimizationStore } from '../store/optimizationStore'
import { useUiStore } from '../store/uiStore'
import { requestPdfExport } from '../api/runs'
import Card, { CardHeader, CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import MetricsCards from '../components/results/MetricsCards'
import WeightsPieChart from '../components/results/WeightsPieChart'
import WeightsTable from '../components/results/WeightsTable'
import RiskContributionChart from '../components/results/RiskContributionChart'
import AiAnalysis from '../ai/AiAnalysis'
import { InfoTooltip } from '../components/ui/Tooltip'
import { shortDate, relativeTime } from '../utils/formatters'
import { RM_MAP } from '../utils/constants'

export default function Results() {
  const navigate = useNavigate()
  const result = useOptimizationStore(s => s.result)
  const addToast = useUiStore(s => s.addToast)
  const [pdfLoading, setPdfLoading] = useState(false)

  if (!result) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-slate-400">
          No results yet.{' '}
          <button onClick={() => navigate('/upload')} className="text-brand-400 underline">
            Start an optimization
          </button>
        </p>
      </div>
    )
  }

  const handlePdfExport = async () => {
    setPdfLoading(true)
    try {
      await requestPdfExport(result.run_id)
      addToast({ type: 'success', title: 'PDF Downloaded', message: 'Report saved to your downloads folder.' })
    } catch {
      addToast({ type: 'error', title: 'PDF Export Failed', message: 'Could not generate the report. Please try again.' })
    } finally {
      setPdfLoading(false)
    }
  }

  const rmLabel = RM_MAP[result.metrics.rm_used]?.label ?? result.metrics.rm_used

  return (
    <div className="px-8 py-8 max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Optimization Results</h1>
          <p className="text-xs text-slate-500 mt-1 space-x-2">
            <span>{relativeTime(result.timestamp)}</span>
            <span>·</span>
            <span>{result.tickers.length} assets</span>
            <span>·</span>
            <span>{result.n_observations} trading days</span>
            <span>·</span>
            <span>{shortDate(result.start_date)} – {shortDate(result.end_date)}</span>
          </p>
          {/* Config summary */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="text-xs bg-brand-500/10 text-brand-300 border border-brand-500/20 rounded px-2 py-0.5 font-mono">{result.metrics.rm_used}</span>
            <span className="text-xs bg-slate-700 text-slate-300 rounded px-2 py-0.5">{result.metrics.obj_used}</span>
            <span className="text-xs bg-slate-700 text-slate-300 rounded px-2 py-0.5">
              rf={((result.config.rf as number) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            loading={pdfLoading}
            onClick={handlePdfExport}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            PDF Report
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/configure')}>
            Re-run
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <MetricsCards metrics={result.metrics} />

      {/* Pie + Table row */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Allocation</CardTitle>
          </CardHeader>
          <WeightsPieChart weights={result.weights} />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Asset Weights</CardTitle>
          </CardHeader>
          <WeightsTable weights={result.weights} />
        </Card>
      </div>

      {/* Risk contribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            Risk Contribution
            <InfoTooltip content="What percentage of the total portfolio variance each asset contributes. Assets with small weights can still have large risk contributions if they're volatile or highly correlated with others." />
          </CardTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            Marginal risk contribution (variance basis) — shows diversification quality.
          </p>
        </CardHeader>
        <RiskContributionChart contributions={result.risk_contributions} />
      </Card>

      {/* AI Analysis */}
      <AiAnalysis runId={result.run_id} savedAnalysis={result.ai_analysis} savedModel={result.ai_model} />

      {/* Footer note */}
      <p className="text-xs text-slate-600 pb-4">
        Run ID: <code className="font-mono">{result.run_id}</code> · Results auto-saved locally.
      </p>
    </div>
  )
}
