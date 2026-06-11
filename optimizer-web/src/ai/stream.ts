const BASE_URL = (import.meta as any).env?.VITE_OPTIMIZER_API_URL ?? 'http://127.0.0.1:8077'

export async function* streamAnalysis(runId: string, model?: string): AsyncGenerator<string> {
  const response = await fetch(`${BASE_URL}/api/ai/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ run_id: runId, ...(model ? { model } : {}) }),
  })

  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]') return
      if (data.startsWith('[ERROR]')) throw new Error(data.slice(8).trim())
      try {
        const parsed = JSON.parse(data) as { t: string }
        yield parsed.t
      } catch {
        // skip malformed lines
      }
    }
  }
}
