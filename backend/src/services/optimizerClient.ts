import { config } from '../config.js';

const base = () => config.OPTIMIZER_BASE_URL;

export interface TalkingRunOptions {
  mode: 'last' | 'saved' | 'config';
  run_id?: string;
  config?: Record<string, unknown>;
}

export interface TalkingRunResult {
  run_id: string;
}

export async function triggerRun(opts: TalkingRunOptions): Promise<TalkingRunResult> {
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
  const res = await fetch(`${base()}/api/talking/pack/${runId}?format=${format}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Optimizer /api/talking/pack returned ${res.status}: ${await res.text()}`);
  return format === 'json' ? res.json() : res.text();
}

export async function getPdf(runId: string): Promise<Buffer> {
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
