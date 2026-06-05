import { Router } from 'express';
import { db } from '../db.js';
import { z } from 'zod';

export const contactsRouter = Router();

const phoneNumberSchema = z.object({
  phone_e164: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Must be E.164 format'),
  label: z.string().default('mobile'),
  is_primary: z.boolean().default(false),
  is_owned: z.boolean().default(false),
});

const bodySchema = z.object({
  name: z.string().min(1),
  phoneNumbers: z.array(phoneNumberSchema).min(1),
  timezone: z.string().default('America/New_York'),
  policyId: z.string().default('self'),
});

const consentSchema = z.object({
  status: z.enum(['granted', 'revoked', 'none']).default('none'),
  method: z.enum(['self_owned', 'web_form', 'recorded_verbal', 'written', 'imported']).default('self_owned'),
  scope: z.string().default('automated_ai_voice_calls_about_their_portfolio'),
  grantedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  evidenceUri: z.string().optional(),
  capturedBy: z.string().optional(),
  recordingConsent: z.enum(['granted', 'denied', 'unknown']).default('unknown'),
});

contactsRouter.get('/', async (_req, res) => {
  const contacts = await db.contact.findMany({
    include: { consents: true },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(contacts.map(c => ({ ...c, phoneNumbers: JSON.parse(c.phoneNumbers) })));
});

contactsRouter.get('/:id', async (req, res) => {
  const c = await db.contact.findUnique({ where: { id: req.params.id }, include: { consents: true } });
  if (!c) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ ...c, phoneNumbers: JSON.parse(c.phoneNumbers) });
});

contactsRouter.post('/', async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.format() }); return; }
  const { phoneNumbers, ...rest } = parsed.data;
  const c = await db.contact.create({ data: { ...rest, phoneNumbers: JSON.stringify(phoneNumbers) } });
  res.status(201).json({ ...c, phoneNumbers });
});

contactsRouter.put('/:id', async (req, res) => {
  const parsed = bodySchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.format() }); return; }
  const { phoneNumbers, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (phoneNumbers) updateData.phoneNumbers = JSON.stringify(phoneNumbers);
  try {
    const c = await db.contact.update({ where: { id: req.params.id }, data: updateData });
    res.json({ ...c, phoneNumbers: JSON.parse(c.phoneNumbers) });
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

contactsRouter.delete('/:id', async (req, res) => {
  try {
    await db.contact.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

// Consent sub-resource
contactsRouter.post('/:id/consent', async (req, res) => {
  const parsed = consentSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.format() }); return; }
  const contact = await db.contact.findUnique({ where: { id: req.params.id } });
  if (!contact) { res.status(404).json({ error: 'Contact not found' }); return; }
  const consent = await db.consent.create({
    data: {
      ...parsed.data,
      contactId: req.params.id,
      grantedAt: parsed.data.grantedAt ? new Date(parsed.data.grantedAt) : null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    },
  });
  res.status(201).json(consent);
});
