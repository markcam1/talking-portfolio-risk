import { Router } from 'express';
import { db } from '../db.js';
import { z } from 'zod';

export const portfoliosRouter = Router();

const bodySchema = z.object({
  name: z.string().min(1),
  tickers: z.array(z.string()).min(1),
  config: z.record(z.unknown()).default({}),
  dateRange: z.object({ start: z.string(), end: z.string() }).optional(),
  optimizerRunRef: z.string().optional(),
});

portfoliosRouter.get('/', async (_req, res) => {
  const portfolios = await db.portfolio.findMany({ orderBy: { updatedAt: 'desc' } });
  res.json(portfolios.map(p => ({
    ...p,
    tickers: JSON.parse(p.tickers),
    config: JSON.parse(p.config),
    dateRange: p.dateRange ? JSON.parse(p.dateRange) : null,
  })));
});

portfoliosRouter.get('/:id', async (req, res) => {
  const p = await db.portfolio.findUnique({ where: { id: req.params.id } });
  if (!p) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ ...p, tickers: JSON.parse(p.tickers), config: JSON.parse(p.config), dateRange: p.dateRange ? JSON.parse(p.dateRange) : null });
});

portfoliosRouter.post('/', async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.format() }); return; }
  const { tickers, config: cfg, dateRange, ...rest } = parsed.data;
  const p = await db.portfolio.create({
    data: {
      ...rest,
      tickers: JSON.stringify(tickers),
      config: JSON.stringify(cfg),
      dateRange: dateRange ? JSON.stringify(dateRange) : JSON.stringify({}),
    },
  });
  res.status(201).json(p);
});

portfoliosRouter.put('/:id', async (req, res) => {
  const parsed = bodySchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.format() }); return; }
  const { tickers, config: cfg, dateRange, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (tickers) updateData.tickers = JSON.stringify(tickers);
  if (cfg) updateData.config = JSON.stringify(cfg);
  if (dateRange) updateData.dateRange = JSON.stringify(dateRange);
  try {
    const p = await db.portfolio.update({ where: { id: req.params.id }, data: updateData });
    res.json(p);
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

portfoliosRouter.delete('/:id', async (req, res) => {
  try {
    await db.portfolio.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});
