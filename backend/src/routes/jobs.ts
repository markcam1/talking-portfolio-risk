import { Router } from 'express';
import { db } from '../db.js';
import { z } from 'zod';
import { config } from '../config.js';
import { enqueueJob } from '../services/jobRunner.js';

export const jobsRouter = Router();

const kickoffSchema = z.object({
  savedPortfolioId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  phoneE164: z.string().regex(/^\+[1-9]\d{7,14}$/),
  callerProfileId: z.string().uuid().optional(),
  modeHint: z.enum(['summary', 'detail']).optional(),
  trigger: z.enum(['manual', 'cron', 'event']).default('manual'),
  policyId: z.string().default('self'),
});

jobsRouter.get('/', async (req, res) => {
  const { status, limit = '50' } = req.query as Record<string, string>;
  const jobs = await db.job.findMany({
    where: status ? { status } : undefined,
    include: {
      portfolio: true,
      contact: true,
      callerProfile: true,
      callRecords: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit, 10),
  });
  res.json(jobs);
});

jobsRouter.get('/:id', async (req, res) => {
  const job = await db.job.findUnique({
    where: { id: req.params.id },
    include: { portfolio: true, contact: true, callerProfile: true, callRecords: true },
  });
  if (!job) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(job);
});

jobsRouter.post('/', async (req, res) => {
  const parsed = kickoffSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.format() }); return; }

  // Resolve default caller profile
  let { callerProfileId } = parsed.data;
  if (!callerProfileId) {
    const def = await db.callerProfile.findFirst({ where: { isDefault: true } });
    if (def) callerProfileId = def.id;
  }

  const job = await db.job.create({
    data: { ...parsed.data, callerProfileId, status: 'queued' },
  });

  // Fire and forget — runner transitions job through states
  enqueueJob(job.id).catch((err) => {
    console.error(`Job ${job.id} runner error:`, err);
  });

  res.status(202).json(job);
});

// Phase 8 stub — approve a pending_approval job
jobsRouter.post('/:id/approve', async (req, res) => {
  if (!config.APPROVAL_REQUIRED) {
    res.status(400).json({ error: 'APPROVAL_REQUIRED is not enabled' });
    return;
  }
  const job = await db.job.findUnique({ where: { id: req.params.id } });
  if (!job) { res.status(404).json({ error: 'Not found' }); return; }
  if (job.status !== 'pending_approval') {
    res.status(400).json({ error: `Job is in status ${job.status}, not pending_approval` });
    return;
  }
  // Resume runner
  enqueueJob(job.id, { resumeFromApproval: true }).catch((err) => {
    console.error(`Job ${job.id} approval resume error:`, err);
  });
  res.json({ accepted: true });
});
