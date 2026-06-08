import { Router } from 'express';
import { config } from '../config.js';

export const healthRouter = Router();

async function checkUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

healthRouter.get('/', async (_req, res) => {
  const [optimizer, callAgent] = await Promise.all([
    checkUrl(config.OPTIMIZER_BASE_URL),
    checkUrl(config.CALL_AGENT_BASE_URL),
  ]);
  res.json({
    orchestrator: 'ok',
    optimizer: optimizer ? 'ok' : 'unreachable',
    callAgent: callAgent ? 'ok' : 'unreachable',
    mockMode: config.MOCK_MODE,
    mockCallTarget: config.MOCK_CALL_TARGET || config.DEFAULT_CALLBACK_NUMBER,
  });
});
