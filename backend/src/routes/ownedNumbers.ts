import { Router } from 'express';
import { db } from '../db.js';
import { z } from 'zod';

export const ownedNumbersRouter = Router();

const bodySchema = z.object({
  phoneE164: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Must be E.164 format'),
  label: z.string().optional(),
});

ownedNumbersRouter.get('/', async (_req, res) => {
  const numbers = await db.ownedNumber.findMany({ orderBy: { createdAt: 'asc' } });
  res.json(numbers);
});

ownedNumbersRouter.post('/', async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.format() }); return; }
  try {
    const n = await db.ownedNumber.create({ data: parsed.data });
    res.status(201).json(n);
  } catch {
    res.status(409).json({ error: 'Number already registered' });
  }
});

// Manual confirm: operator asserts ownership
ownedNumbersRouter.post('/:id/confirm', async (req, res) => {
  try {
    const n = await db.ownedNumber.update({
      where: { id: req.params.id },
      data: { verified: true, verifiedAt: new Date(), verificationMethod: 'manual_confirm' },
    });
    res.json(n);
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

ownedNumbersRouter.delete('/:id', async (req, res) => {
  try {
    await db.ownedNumber.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});
