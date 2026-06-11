import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { validateTickers } from '../api/tickers'
import { useOptimizationStore } from '../store/optimizationStore'
import { parseTickerCsv } from '../utils/csvParser'
import FileDropzone from '../components/upload/FileDropzone'
import TickerList from '../components/upload/TickerList'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'

export default function Upload() {
  const navigate = useNavigate()
  const [filename, setFilename] = useState<string | null>(null)
  const { rawTickers, validationResults, validTickers, setRawTickers, setValidationResults, removeTicker } = useOptimizationStore()

  const validateMutation = useMutation({
    mutationFn: (tickers: string[]) => validateTickers(tickers),
    onSuccess: (data) => setValidationResults(data.results)
  })

  const handleFile = (content: string, name: string) => {
    const tickers = parseTickerCsv(content)
    setFilename(name)
    setRawTickers(tickers)
    if (tickers.length > 0) validateMutation.mutate(tickers)
  }

  const canProceed = validTickers.length >= 2 && !validateMutation.isPending

  return (
    <div className="px-8 py-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-100">Upload Portfolio</h1>
        <p className="text-sm text-slate-400 mt-1">
          Upload a CSV file with your asset tickers. We'll fetch historical prices from Yahoo Finance.
        </p>
      </div>

      {/* Format hint */}
      <Card className="mb-6 bg-slate-900 border-slate-700" padding="sm">
        <p className="text-xs font-semibold text-slate-400 mb-2">Expected CSV format</p>
        <pre className="text-xs text-brand-300 font-mono leading-relaxed">
{`ticker
AAPL
MSFT
GOOGL
JPM
`}
        </pre>
        <p className="text-xs text-slate-500 mt-2">
          One ticker per row. A header row named <code className="text-slate-300">ticker</code> is optional.
          Also supports multi-column CSVs — just include a <code className="text-slate-300">ticker</code> column.
        </p>
      </Card>

      {/* Dropzone */}
      <FileDropzone onFile={handleFile} />

      {/* Filename badge */}
      {filename && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {filename} · {rawTickers.length} tickers parsed
        </div>
      )}

      {/* Validation state */}
      {validateMutation.isPending && (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
          <Spinner size="sm" /> Validating tickers with Yahoo Finance…
        </div>
      )}

      {validateMutation.isError && (
        <p className="mt-4 text-sm text-red-400">
          Could not validate tickers — is the backend running?
        </p>
      )}

      {validationResults.length > 0 && !validateMutation.isPending && (
        <div className="mt-6">
          <TickerList results={validationResults} onRemove={removeTicker} />
        </div>
      )}

      {/* Footer */}
      {validTickers.length === 1 && (
        <p className="mt-4 text-xs text-amber-400">
          At least 2 valid tickers are required for optimization.
        </p>
      )}

      <div className="mt-8 flex gap-3">
        <Button
          variant="primary"
          disabled={!canProceed}
          onClick={() => navigate('/configure')}
        >
          Continue to Configure →
        </Button>
        {validTickers.length > 0 && (
          <span className="self-center text-xs text-slate-500">
            {validTickers.length} assets ready
          </span>
        )}
      </div>
    </div>
  )
}
