import { config } from '../config.js';
import { db } from '../db.js';
import { writeFile, appendEvent } from './complianceDir.js';
import { broadcastToJob } from '../ws/jobSocket.js';

const base = () => config.CALL_AGENT_BASE_URL;

export interface DispatchPayload {
  call_id: string;
  phone_e164: string;
  report_pack: unknown;
  mode_hint?: 'summary' | 'detail';
  disclosures: {
    ai_identity: string;
    purpose: string;
    callback_number: string;
    financial_disclaimer: string;
    recording_notice: string;
    require_recording_consent: boolean;
  };
  voicemail_script: string;
  status_webhook: string;
}

export interface DispatchResult {
  accepted: boolean;
  provider_call_sid: string | null;
}

export async function dispatch(payload: DispatchPayload): Promise<DispatchResult> {
  const res = await fetch(`${base()}/api/talking-call/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Call agent dispatch returned ${res.status}: ${await res.text()}`);
  return res.json() as Promise<DispatchResult>;
}

// In-memory transcript buffer keyed by jobId
const transcriptBuffers = new Map<string, string[]>();

export async function handleCallWebhook(body: Record<string, unknown>): Promise<void> {
  const { event, call_id } = body as { event: string; call_id: string };
  if (!call_id) return;

  const callRecord = await db.callRecord.findFirst({ where: { id: call_id } });
  if (!callRecord) return;

  const job = await db.job.findUnique({ where: { id: callRecord.jobId } });
  if (!job) return;

  if (event === 'transcript') {
    const { role, text } = body as { role: string; text: string };
    const buf = transcriptBuffers.get(job.id) ?? [];
    buf.push(`[${role}] ${text}`);
    transcriptBuffers.set(job.id, buf);

    // Relay to WebSocket clients
    broadcastToJob(job.id, { event: 'transcript', role, text });
    return;
  }

  if (event === 'status') {
    const { outcome, mode_chosen } = body as { outcome: string; mode_chosen?: string };
    await db.callRecord.update({
      where: { id: call_id },
      data: { outcome, modeChosen: mode_chosen ?? null, endedAt: new Date() },
    });

    const terminalStatuses: Record<string, string> = {
      answered: 'completed',
      voicemail: 'voicemail',
      no_answer: 'failed',
      failed: 'failed',
      opted_out: 'completed',
    };
    const newStatus = terminalStatuses[outcome] ?? 'failed';
    await db.job.update({ where: { id: job.id }, data: { status: newStatus } });

    if (callRecord.recordingConsented && job.complianceDir) {
      const lines = transcriptBuffers.get(job.id) ?? [];
      if (lines.length > 0) {
        const transcriptPath = writeFile(job.id, 'transcript.txt', lines.join('\n'));
        await db.callRecord.update({ where: { id: call_id }, data: { transcriptUri: transcriptPath } });
      }
    }

    transcriptBuffers.delete(job.id);
    appendEvent(job.id, { type: 'call_ended', outcome, mode_chosen });
    broadcastToJob(job.id, { event: 'status', status: newStatus, outcome });
    return;
  }

  if (event === 'opt_out') {
    await db.dncEntry.upsert({
      where: { phoneE164: job.phoneE164 },
      create: { phoneE164: job.phoneE164, source: 'verbal_optout', note: `Job ${job.id}` },
      update: { source: 'verbal_optout' },
    });
    appendEvent(job.id, { type: 'opt_out', phone: job.phoneE164 });
    broadcastToJob(job.id, { event: 'opt_out' });
  }
}

