import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getRuns, getRun } from '../api/runs'
import { useOptimizationStore } from '../store/optimizationStore'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import { relativeTime } from '../utils/formatters'
import { RM_MAP } from '../utils/constants'
import type { RunSummary } from '../types/api'

function RunCard({ run, onView }: { run: RunSummary; onView: () => void }) {
  const rmLabel = RM_MAP[run.rm]?.label ?? run.rm
  return (
    <Card className="hover:border-slate-600 transition-colors cursor-pointer group" onClick={onView}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono bg-brand-500/10 text-brand-300 border border-brand-500/20 rounded px-2 py-0.5">
              {run.rm}
            </span>
            <span className="text-xs bg-slate-700 text-slate-300 rounded px-2 py-0.5">
              {run.obj}
            </span>
            <span className="text-xs text-slate-500">{relativeTime(run.timestamp)}</span>
          </div>
          <p className="mt-2 text-sm text-slate-300 font-medium truncate">
            {run.tickers.slice(0, 6).join(', ')}
            {run.tickers.length > 6 && ` +${run.tickers.length - 6} more`}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{run.ticker_count} assets · {rmLabel}</p>
        </div>
        <svg className="w-4 h-4 text-slate-600 group-hover:text-brand-400 transition-colors mt-1 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Card>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const loadResult = useOptimizationStore(s => s.loadResult)
  const { data, isLoading, error } = useQuery({
    queryKey: ['runs'],
    queryFn: getRuns,
    refetchOnWindowFocus: false
  })

  const handleViewRun = async (runId: string) => {
    try {
      const result = await getRun(runId)
      loadResult(result)
      navigate('/results')
    } catch {
      // ignore — result may have been deleted
    }
  }

  const TALKING_PORTFOLIO_URL = 'http://localhost:5180'

  return (
    <div className="px-8 py-8 max-w-3xl">
      {/* Hero */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Portfolio Optimizer</h1>
        <p className="mt-1 text-sm text-slate-400">
          Upload your portfolio, configure a risk model, and get optimal weights in seconds.
        </p>
        <Button className="mt-4" onClick={() => navigate('/upload')}>
          Start New Optimization
        </Button>
      </div>

      {/* Talking Portfolio shortcut */}
      <div className="mb-8 rounded-lg border border-brand-500/25 bg-brand-500/5 px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-200">Talking Portfolio</p>
          <p className="text-xs text-slate-400 mt-0.5">
            AI voice agent calls your phone to discuss the latest optimization result.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => window.open(TALKING_PORTFOLIO_URL, '_blank', 'noopener')}
        >
          Open →
        </Button>
      </div>

      {/* Recent runs */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Recent Runs</h2>
        {isLoading && (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-8">
            <Spinner size="sm" /> Loading history…
          </div>
        )}
        {error && (
          <p className="text-sm text-red-400">Could not load run history. Is the backend running?</p>
        )}
        {data?.runs.length === 0 && !isLoading && (
          <div className="text-center py-12 text-slate-600">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">No runs yet — start your first optimization above.</p>
          </div>
        )}
        {data?.runs && data.runs.length > 0 && (
          <div className="space-y-3">
            {data.runs.map(run => (
              <RunCard key={run.run_id} run={run} onView={() => handleViewRun(run.run_id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
