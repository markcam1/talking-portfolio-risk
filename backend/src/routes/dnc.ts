import { Router } from 'express';
import { db } from '../db.js';
import { z } from 'zod';

export const dncRouter = Router();

const bodySchema = z.object({
  phoneE164: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Must be E.164 format'),
  source: z.enum(['verbal_optout', 'manual', 'import']).default('manual'),
  note: z.string().optional(),
});

dncRouter.get('/', async (_req, res) => {
  const entries = await db.dncEntry.findMany({ orderBy: { addedAt: 'desc' } });
  res.json(entries);
});

dncRouter.post('/', async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.format() }); return; }
  try {
    const entry = await db.dncEntry.create({ data: parsed.data });
    res.status(201).json(entry);
  } catch {
    res.status(409).json({ error: 'Number already on DNC list' });
  }
});

dncRouter.delete('/:id', async (req, res) => {
  try {
    await db.dncEntry.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});
