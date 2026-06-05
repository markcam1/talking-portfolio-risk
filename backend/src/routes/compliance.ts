import { Router } from 'express';
import { db } from '../db.js';
import fs from 'fs';
import path from 'path';
import { COMPLIANCE_DIR } from '../config.js';

export const complianceRouter = Router();

complianceRouter.get('/:jobId', async (req, res) => {
  const job = await db.job.findUnique({ where: { id: req.params.jobId } });
  if (!job || !job.complianceDir) { res.status(404).json({ error: 'Not found' }); return; }

  const manifestPath = path.join(job.complianceDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    res.json({ jobId: req.params.jobId, files: [] });
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  res.json(manifest);
});

complianceRouter.get('/:jobId/files/:name', async (req, res) => {
  const job = await db.job.findUnique({ where: { id: req.params.jobId } });
  if (!job || !job.complianceDir) { res.status(404).json({ error: 'Not found' }); return; }

  // Prevent path traversal
  const safeName = path.basename(req.params.name);
  const filePath = path.join(job.complianceDir, safeName);
  if (!filePath.startsWith(job.complianceDir)) {
    res.status(400).json({ error: 'Invalid file name' });
    return;
  }
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'File not found' }); return; }

  res.sendFile(filePath);
});
