import { InfoTooltip } from '../ui/Tooltip'
import type { OptimizationConfig } from '../../types/domain'
import {
  METHOD_MU_OPTIONS, METHOD_COV_OPTIONS, ALPHA_RM_SET
} from '../../utils/constants'

interface AdvancedParamsProps {
  config: OptimizationConfig
  onChange: (partial: Partial<OptimizationConfig>) => void
}

function Label({ children, tooltip }: { children: React.ReactNode; tooltip?: string }) {
  return (
    <label className="flex items-center text-xs font-medium text-slate-400 mb-1.5">
      {children}
      {tooltip && <InfoTooltip content={tooltip} />}
    </label>
  )
}

function SelectField({
  value, onChange, options
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string; description: string }[]
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
    >
      {options.map(o => (
        <option key={o.value} value={o.value} title={o.description}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export default function AdvancedParams({ config, onChange }: AdvancedParamsProps) {
  const showAlpha = ALPHA_RM_SET.has(config.rm)
  const showLambda = config.obj === 'Utility'

  return (
    <div className="space-y-5">
      {/* Date range */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label tooltip="Start of historical price data to use.">Start Date</Label>
          <input
            type="date"
            value={config.start_date}
            onChange={e => onChange({ start_date: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <Label tooltip="End of historical price data to use.">End Date</Label>
          <input
            type="date"
            value={config.end_date}
            onChange={e => onChange({ end_date: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Risk-free rate */}
      <div>
        <Label tooltip="Annual risk-free rate used in Sharpe ratio calculation. For a Sharpe objective, this shifts the efficient frontier. Use the current T-bill rate (e.g., 0.045 for 4.5%).">
          Risk-Free Rate (rf)
        </Label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={0.2}
            step={0.001}
            value={config.rf}
            onChange={e => onChange({ rf: parseFloat(e.target.value) || 0 })}
            className="w-32 bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <span className="text-xs text-slate-500">{(config.rf * 100).toFixed(2)}% annual</span>
        </div>
      </div>

      {/* Lambda (only for Utility objective) */}
      {showLambda && (
        <div>
          <Label tooltip="Risk aversion parameter λ. Higher values → less risk, lower returns. Lower values → more aggressive portfolio. Range: 0.5 (aggressive) to 10 (very conservative).">
            Risk Aversion (λ = {config.l.toFixed(1)})
          </Label>
          <input
            type="range"
            min={0.5}
            max={10}
            step={0.5}
            value={config.l}
            onChange={e => onChange({ l: parseFloat(e.target.value) })}
            className="w-full accent-brand-500"
          />
          <div className="flex justify-between text-xs text-slate-600 mt-1">
            <span>0.5 (aggressive)</span>
            <span>10 (conservative)</span>
          </div>
        </div>
      )}

      {/* Alpha (only for tail-risk measures) */}
      {showAlpha && (
        <div>
          <Label tooltip="Significance level α for tail-risk measures. For CVaR at α=0.05, the portfolio targets the average loss in the worst 5% of scenarios. Lower α = more conservative.">
            Significance Level (α)
          </Label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0.01}
              max={0.2}
              step={0.01}
              value={config.alpha}
              onChange={e => onChange({ alpha: parseFloat(e.target.value) || 0.05 })}
              className="w-28 bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <span className="text-xs text-slate-500">
              Targets the worst {(config.alpha * 100).toFixed(0)}% of outcomes
            </span>
          </div>
        </div>
      )}

      {/* Method mu */}
      <div>
        <Label tooltip="Method for estimating expected (mean) returns for each asset.">
          Expected Return Estimator (method_mu)
        </Label>
        <SelectField
          value={config.method_mu}
          onChange={v => onChange({ method_mu: v })}
          options={METHOD_MU_OPTIONS}
        />
      </div>

      {/* Method cov */}
      <div>
        <Label tooltip="Method for estimating the covariance matrix of asset returns. This drives diversification decisions.">
          Covariance Estimator (method_cov)
        </Label>
        <SelectField
          value={config.method_cov}
          onChange={v => onChange({ method_cov: v })}
          options={METHOD_COV_OPTIONS}
        />
      </div>
    </div>
  )
}
