import type { TickerValidationResult } from '../../types/api'

interface TickerListProps {
  results: TickerValidationResult[]
  onRemove: (ticker: string) => void
}

export default function TickerList({ results, onRemove }: TickerListProps) {
  if (results.length === 0) return null

  const valid = results.filter(r => r.valid)
  const invalid = results.filter(r => !r.valid)

  return (
    <div className="space-y-4">
      {valid.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">
            Valid tickers ({valid.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {valid.map(r => (
              <span
                key={r.ticker}
                className="group inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 text-xs font-mono font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 rounded-full"
              >
                {r.ticker}
                {r.name && <span className="text-emerald-600 font-sans hidden group-hover:inline">{r.name}</span>}
                <button
                  onClick={() => onRemove(r.ticker)}
                  className="ml-0.5 text-emerald-600 hover:text-red-400 transition-colors"
                  aria-label={`Remove ${r.ticker}`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {invalid.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">
            Not found ({invalid.length}) — these will be skipped
          </p>
          <div className="flex flex-wrap gap-2">
            {invalid.map(r => (
              <span
                key={r.ticker}
                title={r.error ?? undefined}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-medium bg-red-500/10 text-red-400 border border-red-500/20 rounded-full"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                {r.ticker}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
