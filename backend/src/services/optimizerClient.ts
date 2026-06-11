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

async function tryOptimizerRun(opts: TalkingRunOptions): Promise<TalkingRunResult | null> {
  try {
    const res = await fetch(`${base()}/api/talking/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return res.json() as Promise<TalkingRunResult>;
  } catch {
    return null;
  }
}

export async function triggerRun(opts: TalkingRunOptions): Promise<TalkingRunResult> {
  if (config.MOCK_MODE) {
    // In mock mode: pull the latest real run from the optimizer if it's up.
    // Always use mode=last so we don't trigger a new optimization.
    const real = await tryOptimizerRun({ mode: 'last' });
    if (real) {
      console.log(`[optimizer] mock mode — using real run_id=${real.run_id}`);
      return real;
    }
    console.log('[optimizer] mock mode — optimizer unreachable, falling back to hardcoded mock');
    return { run_id: MOCK_RUN_ID };
  }
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
  if (config.MOCK_MODE && runId === MOCK_RUN_ID) {
    // Optimizer was unreachable — return the hardcoded fallback pack
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

function buildMockPdf(): Buffer {
  const lines = [
    'BT /F1 18 Tf 50 720 Td (Mock Portfolio Report) Tj',
    '0 -28 Td (Portfolio: Sharpe / MV - AAPL, MSFT, GOOGL, AMZN, BRK-B) Tj',
    '0 -28 Td (Expected Return: 18.7%  Risk: 13.1%  Sharpe: 1.42) Tj',
    '0 -50 Td (Educational use only. Not investment advice.) Tj',
    'ET',
  ].join('\n');
  const contentLen = Buffer.byteLength(lines, 'utf8');

  const o1 = '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n';
  const o2 = '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n';
  const o3 = '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n';
  const o4 = `4 0 obj<</Length ${contentLen}>>\nstream\n${lines}\nendstream\nendobj\n`;
  const o5 = '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n';

  const header = '%PDF-1.4\n';
  const off = [header.length, 0, 0, 0, 0].reduce<number[]>((a, _, i) => {
    if (i === 0) return [header.length];
    return [...a, a[i - 1] + [o1, o2, o3, o4][i - 1].length];
  }, []);
  const body = header + o1 + o2 + o3 + o4 + o5;
  const xrefStart = body.length;
  const pad = (n: number) => n.toString().padStart(10, '0');
  // off contains exactly 5 offsets (o1–o5); 1 free entry + 5 in-use = "0 6"
  const xref =
    'xref\n0 6\n0000000000 65535 f \n' +
    off.map(o => `${pad(o)} 00000 n \n`).join('');
  const trailer = `trailer<</Size 6/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(body + xref + trailer, 'utf8');
}

export async function getPdf(runId: string): Promise<Buffer> {
  if (config.MOCK_MODE && runId === MOCK_RUN_ID) {
    // Optimizer was unreachable — return a minimal valid placeholder PDF
    return buildMockPdf();
  }
  // POST /api/export/pdf with JSON body (optimizer does not accept GET with query param)
  const res = await fetch(`${base()}/api/export/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ run_id: runId }),
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
