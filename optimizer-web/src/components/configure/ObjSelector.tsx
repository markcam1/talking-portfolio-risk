import { OBJ_OPTIONS } from '../../utils/constants'
import { InfoTooltip } from '../ui/Tooltip'

interface ObjSelectorProps {
  value: string
  onChange: (value: string) => void
}

export default function ObjSelector({ value, onChange }: ObjSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {OBJ_OPTIONS.map(opt => {
        const isSelected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex items-start gap-2 text-left px-4 py-3 rounded-xl border transition-all ${
              isSelected
                ? 'bg-brand-500/15 border-brand-500/40 text-brand-200'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-800/50'
            }`}
          >
            <span className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
              isSelected ? 'border-brand-400 bg-brand-400' : 'border-slate-600'
            }`}>
              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
            </span>
            <span>
              <span className="flex items-center text-sm font-medium">
                {opt.label}
                <InfoTooltip content={opt.description} />
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
