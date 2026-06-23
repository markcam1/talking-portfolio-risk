import { Router } from 'express';
import twilio from 'twilio';
import { TwilioClient } from './twilio.js';
import { buildGroundedPrompt, type DispatchDisclosures } from './talking-prompt.js';
import { buildReportFacts, type ReportFacts } from './report-facts.js';

const router = Router();
export { router as talkingDispatchRouter };

export const OPT_OUT_PHRASES = [
  'stop',
  'unsubscribe',
  'remove me',
  "don't call",
  'do not call',
  'opt out',
  'take me off',
];

interface TalkingCallMeta {
  call_id: string;
  status_webhook: string;
  voicemail_script: string;
  mode_hint: 'summary' | 'detail';
  report_facts: ReportFacts;
}

// Keyed by Twilio CallSid — shared with server.ts via the export
export const talkingMeta = new Map<string, TalkingCallMeta>();

// Keyed by call_id — holds prompt + meta until Twilio SID is known (at voice-webhook time)
const pendingPrompts = new Map<string, { prompt: string; meta: TalkingCallMeta }>();

export async function postTalkingWebhook(url: string, body: Record<string, unknown>): Promise<void> {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.error('[talking-dispatch] webhook POST failed:', (err as Error).message);
  }
}

export function hasOptOutPhrase(text: string): boolean {
  const lower = text.toLowerCase();
  return OPT_OUT_PHRASES.some(p => lower.includes(p));
}

// POST /api/talking-call/dispatch
// Called by the orchestrator's callAgentClient to kick off a portfolio call.
router.post('/api/talking-call/dispatch', async (req, res) => {
  const { call_id, phone_e164, report_pack, mode_hint, disclosures, voicemail_script, status_webhook } = req.body as {
    call_id: string;
    phone_e164: string;
    report_pack: Record<string, unknown>;
    mode_hint?: string;
    disclosures: DispatchDisclosures;
    voicemail_script?: string;
    status_webhook: string;
  };

  if (!call_id || !phone_e164 || !report_pack || !disclosures || !status_webhook) {
    res.status(400).json({ error: 'Missing required fields: call_id, phone_e164, report_pack, disclosures, status_webhook' });
    return;
  }

  const modeHintVal: 'summary' | 'detail' = mode_hint === 'detail' ? 'detail' : 'summary';
  const prompt = buildGroundedPrompt(report_pack, disclosures, modeHintVal);
  const reportFacts = buildReportFacts(report_pack);

  const meta: TalkingCallMeta = {
    call_id,
    status_webhook,
    voicemail_script: voicemail_script ?? '',
    mode_hint: modeHintVal,
    report_facts: reportFacts,
  };
  pendingPrompts.set(call_id, { prompt, meta });

  const mockMode = process.env.MOCK_MODE === 'true';
  // In mock mode, redirect the call to the operator's own test number
  const targetPhone = mockMode ? (process.env.MOCK_CALL_TARGET || phone_e164) : phone_e164;
  const publicUrl = process.env.PUBLIC_URL!;

  try {
    const twilioClient = new TwilioClient(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
    const call = await twilioClient.initiateCall(
      targetPhone,
      process.env.TWILIO_FROM_NUMBER!,
      `${publicUrl}/talking-voice-webhook?call_id=${encodeURIComponent(call_id)}`,
      `${publicUrl}/talking-status-callback?call_id=${encodeURIComponent(call_id)}`
    );

    talkingMeta.set(call.sid, meta);
    console.log(`[talking-dispatch] initiated SID=${call.sid} call_id=${call_id} to=${targetPhone} mock=${mockMode}`);
    res.json({ accepted: true, provider_call_sid: call.sid });
  } catch (err: any) {
    pendingPrompts.delete(call_id);
    console.error('[talking-dispatch] failed to initiate call:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /talking-voice-webhook?call_id=<id>
// Twilio calls this when the recipient answers. Returns TwiML to connect the media stream.
router.post('/talking-voice-webhook', (req, res) => {
  const CallSid = req.body.CallSid as string;
  const callId = req.query.call_id as string;

  // Wire up the grounded prompt into the shared callContexts map that the stream handler reads
  if (callId && CallSid) {
    const pending = pendingPrompts.get(callId);
    if (pending) {
      (global as any).callContexts?.set(CallSid, pending.prompt);
      if (!talkingMeta.has(CallSid)) {
        talkingMeta.set(CallSid, pending.meta);
      }
    }
  }

  const publicUrl = process.env.PUBLIC_URL!;
  const streamUrl = publicUrl.replace('https://', 'wss://') + '/stream';

  res.type('text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}" />
  </Connect>
</Response>`);
});

// POST /talking-status-callback?call_id=<id>
// Twilio status events: handles AMD detection (redirect to voicemail) and terminal outcomes.
router.post('/talking-status-callback', async (req, res) => {
  const { CallSid, CallStatus, AnsweredBy } = req.body as Record<string, string>;
  const callId = (req.query.call_id as string) ?? (req.body.call_id as string);

  console.log(`[talking-dispatch] status SID=${CallSid} status=${CallStatus} answeredBy=${AnsweredBy} call_id=${callId}`);

  const meta =
    talkingMeta.get(CallSid) ??
    (callId ? [...talkingMeta.values()].find(m => m.call_id === callId) : undefined);

  // AMD: machine detected → redirect the live call to the voicemail TwiML
  if ((AnsweredBy === 'machine_start' || AnsweredBy === 'machine_end_beep') && CallSid && CallStatus === 'in-progress') {
    const publicUrl = process.env.PUBLIC_URL!;
    const vmUrl = `${publicUrl}/talking-voicemail?call_id=${encodeURIComponent(callId ?? '')}`;
    try {
      const twilioRest = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      await twilioRest.calls(CallSid).update({ url: vmUrl, method: 'GET' });
      console.log(`[talking-dispatch] redirected ${CallSid} to voicemail TwiML`);
    } catch (err) {
      console.error('[talking-dispatch] voicemail redirect failed:', (err as Error).message);
    }
    res.sendStatus(200);
    return;
  }

  // Terminal statuses → notify orchestrator webhook
  const outcomeMap: Record<string, string> = {
    completed: 'answered',
    'no-answer': 'no_answer',
    busy: 'failed',
    failed: 'failed',
    canceled: 'failed',
  };

  if (CallStatus in outcomeMap && meta) {
    // If AMD previously flagged this as machine and call is now completing, mark as voicemail
    const isVoicemail = AnsweredBy?.startsWith('machine') && CallStatus === 'completed';
    const outcome = isVoicemail ? 'voicemail' : outcomeMap[CallStatus];

    await postTalkingWebhook(meta.status_webhook, {
      event: 'status',
      call_id: meta.call_id,
      outcome,
      mode_chosen: meta.mode_hint,
    });

    // Cleanup shared state
    if (CallSid) {
      talkingMeta.delete(CallSid);
      (global as any).callContexts?.delete(CallSid);
    }
    if (callId) pendingPrompts.delete(callId);
  }

  res.sendStatus(200);
});

// GET /talking-voicemail?call_id=<id>
// Returns TwiML to speak the voicemail script then hang up.
router.get('/talking-voicemail', (req, res) => {
  const callId = req.query.call_id as string;

  const pending = callId ? pendingPrompts.get(callId) : undefined;
  const meta =
    pending?.meta ??
    (callId ? [...talkingMeta.values()].find(m => m.call_id === callId) : undefined);

  const script =
    meta?.voicemail_script ||
    'Hello, this is an automated assistant from your portfolio management service. ' +
    'A portfolio optimization report has been prepared for you and will be sent by email. ' +
    'This is for educational purposes only, not investment advice. Thank you.';

  // XML-escape the script
  const safe = script
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  res.type('text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${safe}</Say>
  <Hangup/>
</Response>`);
});
