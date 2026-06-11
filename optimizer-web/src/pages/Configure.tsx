import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOptimizationStore } from '../store/optimizationStore'
import { useUiStore } from '../store/uiStore'
import { useOptimize } from '../hooks/useOptimize'
import Card, { CardHeader, CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import RmSelector from '../components/configure/RmSelector'
import ObjSelector from '../components/configure/ObjSelector'
import AdvancedParams from '../components/configure/AdvancedParams'
import type { OptimizeError } from '../hooks/useOptimize'
import { RM_MAP } from '../utils/constants'

export default function Configure() {
  const navigate = useNavigate()
  const { validTickers, config, setConfig } = useOptimizationStore()
  const isOptimizing = useUiStore(s => s.isOptimizing)
  const [errorModal, setErrorModal] = useState<OptimizeError | null>(null)

  const optimizeMutation = useOptimize()

  if (validTickers.length < 2) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-slate-400">
          Please <button onClick={() => navigate('/upload')} className="text-brand-400 underline">upload a portfolio</button> first.
        </p>
      </div>
    )
  }

  const handleRun = () => {
    const req = {
      tickers: validTickers,
      start_date: config.start_date,
      end_date: config.end_date,
      rm: config.rm,
      obj: config.obj,
      rf: config.rf,
      l: config.l,
      method_mu: config.method_mu,
      method_cov: config.method_cov,
      alpha: config.alpha,
      hist: config.hist
    }

    optimizeMutation.mutate(req, {
      onError: (err) => {
        if (err.type === 'infeasible') setErrorModal(err)
      }
    })
  }

  return (
    <div className="px-8 py-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-100">Configure Optimization</h1>
        <p className="text-sm text-slate-400 mt-1">
          {validTickers.length} assets selected: {validTickers.slice(0, 5).join(', ')}
          {validTickers.length > 5 && ` +${validTickers.length - 5} more`}
        </p>
      </div>

      <div className="space-y-6">
        {/* Risk Measure */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Measure</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              What type of risk should the optimizer minimize or balance?
            </p>
          </CardHeader>
          <RmSelector
            value={config.rm}
            onChange={v => setConfig({ rm: v })}
          />
        </Card>

        {/* Objective */}
        <Card>
          <CardHeader>
            <CardTitle>Optimization Objective</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              What should the optimizer try to achieve?
            </p>
          </CardHeader>
          <ObjSelector
            value={config.obj}
            onChange={v => setConfig({ obj: v })}
          />
        </Card>

        {/* Advanced params */}
        <Card>
          <CardHeader>
            <CardTitle>Parameters</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Date range, risk-free rate, estimation methods.
            </p>
          </CardHeader>
          <AdvancedParams config={config} onChange={setConfig} />
        </Card>
      </div>

      {/* Run button */}
      <div className="mt-8 flex items-center gap-4">
        <Button
          size="lg"
          loading={isOptimizing}
          onClick={handleRun}
          disabled={isOptimizing}
        >
          {isOptimizing ? 'Optimizing…' : 'Run Optimization'}
        </Button>
        <div className="text-xs text-slate-500">
          <span className="font-mono text-slate-400">{RM_MAP[config.rm]?.label ?? config.rm}</span>
          {' · '}
          <span>{config.obj}</span>
        </div>
      </div>

      {/* Infeasible error modal */}
      <Modal
        open={errorModal !== null}
        onClose={() => setErrorModal(null)}
        title={errorModal?.title ?? ''}
        actions={
          <Button variant="secondary" onClick={() => setErrorModal(null)}>
            Close
          </Button>
        }
      >
        <p>{errorModal?.message}</p>
        {errorModal?.detail && (
          <p className="text-slate-500 text-xs mt-2">{errorModal.detail}</p>
        )}
        <div className="mt-4 p-3 bg-slate-900 rounded-lg border border-slate-700 text-xs text-slate-400 space-y-1">
          <p className="font-semibold text-slate-300">Suggestions:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Try a different risk measure (e.g., switch from CVaR to MV)</li>
            <li>Try a different objective (e.g., MinRisk instead of Sharpe)</li>
            <li>Widen the date range to include more historical data</li>
            <li>Remove assets with very short or sparse price history</li>
          </ul>
        </div>
      </Modal>
    </div>
  )
}
