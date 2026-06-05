import { Router } from 'express';
import { db } from '../db.js';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { COMPLIANCE_DIR } from '../config.js';
import { handleCallWebhook } from '../services/callAgentClient.js';

export const callsRouter = Router();

callsRouter.get('/', async (req, res) => {
  const { jobId, limit = '50' } = req.query as Record<string, string>;
  const records = await db.callRecord.findMany({
    where: jobId ? { jobId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit, 10),
  });
  res.json(records);
});

callsRouter.get('/:id', async (req, res) => {
  const record = await db.callRecord.findUnique({ where: { id: req.params.id } });
  if (!record) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(record);
});

callsRouter.get('/:id/transcript', async (req, res) => {
  const record = await db.callRecord.findUnique({ where: { id: req.params.id } });
  if (!record) { res.status(404).json({ error: 'Not found' }); return; }
  if (!record.transcriptUri) { res.status(404).json({ error: 'No transcript available' }); return; }
  try {
    const text = fs.readFileSync(record.transcriptUri, 'utf8');
    res.type('text/plain').send(text);
  } catch {
    res.status(404).json({ error: 'Transcript file not found' });
  }
});

// Webhook from call agent: transcript chunks, status updates, opt-out events
callsRouter.post('/webhook', async (req, res) => {
  await handleCallWebhook(req.body);
  res.json({ ok: true });
});

// Delivery stub (Phase 1 — records intent, sends nothing)
const deliverSchema = z.object({
  file: z.string(),
  channel: z.enum(['email', 'sms']),
  to: z.string(),
});

callsRouter.post('/:id/deliver', async (req, res) => {
  const record = await db.callRecord.findUnique({ where: { id: req.params.id } });
  if (!record) { res.status(404).json({ error: 'Not found' }); return; }
  const parsed = deliverSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.format() }); return; }

  const job = await db.job.findUnique({ where: { id: record.jobId } });
  if (job?.complianceDir) {
    const { appendEvent } = await import('../services/complianceDir.js');
    await appendEvent(job.id, {
      type: 'delivery_intent',
      file: parsed.data.file,
      channel: parsed.data.channel,
      to: parsed.data.to,
      status: 'queued_stub',
    });
  }
  res.json({ status: 'queued_stub', message: 'Delivery stubbed — Phase 1. Intent recorded in events.jsonl.' });
});
