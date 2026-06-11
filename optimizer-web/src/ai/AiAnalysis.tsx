import { useState, useEffect } from 'react'
import Card, { CardHeader, CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import { streamAnalysis } from './stream'

interface AiConfig {
  models: string[]
  default_model: string
  allow_frontend_switch: boolean
}

interface Props {
  runId: string
  savedAnalysis?: string | null
  savedModel?: string | null
}

function renderMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="text-slate-100 font-semibold">{part.slice(2, -2)}</strong>
      : part
  )
}

export default function AiAnalysis({ runId, savedAnalysis, savedModel }: Props) {
  const [text, setText] = useState(savedAnalysis ?? '')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [allowSwitch, setAllowSwitch] = useState(false)

  useEffect(() => {
    const apiUrl = (import.meta as any).env?.VITE_OPTIMIZER_API_URL ?? 'http://127.0.0.1:8077'
    fetch(`${apiUrl}/api/ai/config`)
      .then(r => r.json())
      .then((data: AiConfig) => {
        setModels(data.models)
        setSelectedModel(data.default_model)
        setAllowSwitch(data.allow_frontend_switch)
      })
      .catch(() => setSelectedModel('Ollama'))
  }, [])

  const hasAnalysis = text.length > 0

  async function generate() {
    setStreaming(true)
    setText('')
    setError(null)
    try {
      for await (const chunk of streamAnalysis(runId, selectedModel || undefined)) {
        setText(prev => prev + chunk)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed.')
    } finally {
      setStreaming(false)
    }
  }

  const displayModel = hasAnalysis && savedModel
    ? savedModel
    : (selectedModel || '…')

  const showDropdown = allowSwitch && models.length > 1

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>AI Analysis</CardTitle>
          <div className="flex items-center gap-2">
            {showDropdown && (
              <select
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                disabled={streaming}
                className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 disabled:opacity-50"
              >
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={generate}
              disabled={streaming}
              loading={streaming}
            >
              {streaming ? 'Analyzing…' : hasAnalysis ? 'Regenerate' : 'Analyze Portfolio'}
            </Button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Powered by Ollama · {displayModel} · runs locally
        </p>
      </CardHeader>

      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-3">
          {error}
        </p>
      )}

      {!error && !hasAnalysis && !streaming && (
        <p className="text-sm text-slate-500">
          Click &ldquo;Analyze Portfolio&rdquo; to generate an AI commentary on these results.
        </p>
      )}

      {(hasAnalysis || streaming) && (
        <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
          {renderMarkdown(text)}
          {streaming && (
            <span className="inline-block w-2 h-[1em] ml-0.5 bg-slate-400 animate-pulse align-text-bottom" />
          )}
        </div>
      )}
    </Card>
  )
}
