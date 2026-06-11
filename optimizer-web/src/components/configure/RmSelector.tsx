import { useState } from 'react'
import { RM_OPTIONS } from '../../utils/constants'
import { InfoTooltip } from '../ui/Tooltip'

interface RmSelectorProps {
  value: string
  onChange: (value: string) => void
}

export default function RmSelector({ value, onChange }: RmSelectorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const starterOptions = RM_OPTIONS.filter(o => o.category === 'starter')
  const advancedOptions = RM_OPTIONS.filter(o => o.category === 'advanced')

  const renderOption = (opt: typeof RM_OPTIONS[0]) => {
    const isSelected = value === opt.value
    return (
      <button
        key={opt.value}
        type="button"
        onClick={() => onChange(opt.value)}
        className={`flex items-start gap-3 w-full text-left px-4 py-3 rounded-xl border transition-all ${
          isSelected
            ? 'bg-brand-500/15 border-brand-500/40 text-brand-200'
            : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-800/50'
        }`}
      >
        <span className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
          isSelected ? 'border-brand-400 bg-brand-400' : 'border-slate-600'
        }`}>
          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1 text-sm font-medium">
            <span className="font-mono text-xs text-slate-500 mr-1">{opt.value}</span>
            {opt.label}
            <InfoTooltip content={opt.description} />
          </span>
        </span>
      </button>
    )
  }

  return (
    <div>
      <div className="space-y-2">
        {starterOptions.map(renderOption)}
      </div>

      {/* Advanced disclosure */}
      <button
        type="button"
        onClick={() => setShowAdvanced(s => !s)}
        className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {showAdvanced ? 'Hide' : 'Show'} advanced risk measures ({advancedOptions.length})
      </button>

      {showAdvanced && (
        <div className="mt-2 space-y-2">
          {advancedOptions.map(renderOption)}
        </div>
      )}
    </div>
  )
}
