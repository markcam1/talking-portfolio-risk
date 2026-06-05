import type WebSocket from 'ws';
import type http from 'http';

// Job-scoped WebSocket connections — the job's channel for live status + transcript relay.
// broadcastToJob (called from callAgentClient) sends to all connected clients.
// This handler accepts a connection and attaches the jobId from the URL path (/ws/jobs/:id).
const jobClients = new Map<string, Set<WebSocket>>();

export function handleJobSocket(ws: WebSocket, _request: http.IncomingMessage, jobId: string): void {
  let clients = jobClients.get(jobId);
  if (!clients) {
    clients = new Set();
    jobClients.set(jobId, clients);
  }
  clients.add(ws);

  ws.on('close', () => {
    jobClients.get(jobId)?.delete(ws);
    if (jobClients.get(jobId)?.size === 0) jobClients.delete(jobId);
  });

  ws.send(JSON.stringify({ event: 'connected', jobId }));
}

export function broadcastToJob(jobId: string, data: unknown): void {
  const msg = JSON.stringify(data);
  jobClients.get(jobId)?.forEach((client) => {
    if (client.readyState === 1) {
      try { client.send(msg); } catch { /* ignore stale socket */ }
    }
  });
}
