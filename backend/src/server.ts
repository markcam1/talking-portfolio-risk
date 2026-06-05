import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import { parse } from 'url';
import fs from 'fs';
import path from 'path';
import { config, DATA_DIR, LOG_DIR, COMPLIANCE_DIR } from './config.js';
import { db } from './db.js';
import { portfoliosRouter } from './routes/portfolios.js';
import { contactsRouter } from './routes/contacts.js';
import { callerProfilesRouter } from './routes/callerProfiles.js';
import { ownedNumbersRouter } from './routes/ownedNumbers.js';
import { dncRouter } from './routes/dnc.js';
import { jobsRouter } from './routes/jobs.js';
import { callsRouter } from './routes/calls.js';
import { complianceRouter } from './routes/compliance.js';
import { healthRouter } from './routes/health.js';
import { handleJobSocket } from './ws/jobSocket.js';
import { seedDefaults } from './seed.js';

// Ensure directories exist
for (const dir of [DATA_DIR, LOG_DIR, COMPLIANCE_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/portfolios', portfoliosRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/caller-profiles', callerProfilesRouter);
app.use('/api/owned-numbers', ownedNumbersRouter);
app.use('/api/dnc', dncRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/calls', callsRouter);
app.use('/api/compliance', complianceRouter);
app.use('/api/health', healthRouter);

// Inbound call stub (Phase 10)
if (config.INBOUND_ENABLED) {
  app.post('/incoming', (_req, res) => {
    res.type('text/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response><Connect><Stream url="wss://${_req.hostname}/stream"/></Connect></Response>`
    );
  });
}

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const { pathname } = parse(request.url ?? '');
  if (pathname?.startsWith('/ws/jobs/')) {
    const jobId = pathname.split('/')[3];
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, jobId);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', handleJobSocket);

export { wss };

async function start() {
  await seedDefaults();
  server.listen(config.PORT, () => {
    console.log(`Orchestrator listening on http://127.0.0.1:${config.PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
