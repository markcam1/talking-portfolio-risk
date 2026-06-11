import { Router } from 'express';
import { db } from '../db.js';
import { z } from 'zod';

export const callerProfilesRouter = Router();

const bodySchema = z.object({
  entityName: z.string().min(1),
  callbackNumber: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Must be E.164 format'),
  voicePersona: z.string().optional(),
  financialDisclaimer: z.string().default('Educational use only. Not investment advice.'),
  isDefault: z.boolean().default(false),
});

callerProfilesRouter.get('/', async (req, res) => {
  const profiles = await db.callerProfile.findMany({
    where: { tenantId: req.tenantId },
    orderBy: { createdAt: 'asc' },
  });
  res.json(profiles);
});

callerProfilesRouter.get('/:id', async (req, res) => {
  const p = await db.callerProfile.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
  if (!p) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(p);
});

callerProfilesRouter.post('/', async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.format() }); return; }
  if (parsed.data.isDefault) {
    await db.callerProfile.updateMany({ where: { tenantId: req.tenantId }, data: { isDefault: false } });
  }
  const p = await db.callerProfile.create({ data: { ...parsed.data, tenantId: req.tenantId } });
  res.status(201).json(p);
});

callerProfilesRouter.put('/:id', async (req, res) => {
  const parsed = bodySchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.format() }); return; }
  if (parsed.data.isDefault) {
    await db.callerProfile.updateMany({ where: { id: { not: req.params.id }, tenantId: req.tenantId }, data: { isDefault: false } });
  }
  try {
    const p = await db.callerProfile.update({ where: { id: req.params.id, tenantId: req.tenantId }, data: parsed.data });
    res.json(p);
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

callerProfilesRouter.delete('/:id', async (req, res) => {
  try {
    await db.callerProfile.delete({ where: { id: req.params.id, tenantId: req.tenantId } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});
