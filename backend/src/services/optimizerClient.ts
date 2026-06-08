import { config } from '../config.js';

const base = () => config.OPTIMIZER_BASE_URL;

const MOCK_RUN_ID = 'mock-run-000';

const MOCK_PACK = {
  schema_version: '1.0',
  pack_id: 'mock-pack-000',
  generated_at: new Date().toISOString(),
  portfolio: {
    name: 'Sharpe / MV (mock)',
    tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'BRK-B'],
    date_range: { start: '2023-01-01', end: '2024-01-01' },
  },
  config: { risk_measure: 'MV', objective: 'Sharpe', risk_free_rate: 0.05 },
  headline: {
    objective_plain: 'Maximize risk-adjusted return (Sharpe ratio)',
    sharpe_ratio: 1.42,
    expected_return_annual: 0.187,
    portfolio_risk_annual: 0.131,
    top_holdings: [
      { ticker: 'MSFT', weight: 0.32 },
      { ticker: 'AAPL', weight: 0.28 },
      { ticker: 'GOOGL', weight: 0.19 },
      { ticker: 'AMZN', weight: 0.13 },
      { ticker: 'BRK-B', weight: 0.08 },
    ],
  },
  weights: [
    { ticker: 'MSFT', weight: 0.32 },
    { ticker: 'AAPL', weight: 0.28 },
    { ticker: 'GOOGL', weight: 0.19 },
    { ticker: 'AMZN', weight: 0.13 },
    { ticker: 'BRK-B', weight: 0.08 },
  ],
  risk_contribution: [
    { ticker: 'MSFT', contribution: 0.31 },
    { ticker: 'AAPL', contribution: 0.27 },
    { ticker: 'GOOGL', contribution: 0.21 },
    { ticker: 'AMZN', contribution: 0.14 },
    { ticker: 'BRK-B', contribution: 0.07 },
  ],
  ai_commentary: 'The portfolio is concentrated in large-cap US technology with a meaningful allocation to Berkshire as a diversifier. The Sharpe ratio of 1.42 reflects efficient use of risk over the period.',
  ai_commentary_model: 'mock',
  source_run_id: MOCK_RUN_ID,
  disclaimers: ['Educational use only. Not investment advice.'],
};

export interface TalkingRunOptions {
  mode: 'last' | 'saved' | 'config';
  run_id?: string;
  config?: Record<string, unknown>;
}

export interface TalkingRunResult {
  run_id: string;
}

export async function triggerRun(opts: TalkingRunOptions): Promise<TalkingRunResult> {
  if (config.MOCK_MODE) return { run_id: MOCK_RUN_ID };
  const res = await fetch(`${base()}/api/talking/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Optimizer /api/talking/run returned ${res.status}: ${await res.text()}`);
  return res.json() as Promise<TalkingRunResult>;
}

export async function getPack(runId: string, format: 'json' | 'html' | 'markdown' = 'json'): Promise<unknown> {
  if (config.MOCK_MODE) {
    if (format === 'json') return MOCK_PACK;
    if (format === 'html') return `<pre>${JSON.stringify(MOCK_PACK, null, 2)}</pre>`;
    return `# Mock Pack\n\n${JSON.stringify(MOCK_PACK, null, 2)}`;
  }
  const res = await fetch(`${base()}/api/talking/pack/${runId}?format=${format}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Optimizer /api/talking/pack returned ${res.status}: ${await res.text()}`);
  return format === 'json' ? res.json() : res.text();
}

export async function getPdf(runId: string): Promise<Buffer> {
  if (config.MOCK_MODE) return Buffer.from('%PDF-1.4 mock', 'utf8');
  const res = await fetch(`${base()}/api/export/pdf?run_id=${runId}`, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Optimizer /api/export/pdf returned ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function isReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${base()}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
