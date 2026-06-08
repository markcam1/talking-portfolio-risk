import fs from 'fs';
import path from 'path';
import { db } from '../db.js';
import { config } from '../config.js';
import { triggerRun, getPack, getPdf } from './optimizerClient.js';
import { dispatch } from './callAgentClient.js';
import { initDir, writeFile, appendEvent } from './complianceDir.js';
import { policyRegistry } from '../policies/registry.js';
import { ownedNumbersGuard } from '../policies/checks/ownedNumbersGuard.js';
import { broadcastToJob } from '../ws/jobSocket.js';
import type { Disclosures } from '../policies/types.js';
import type { Job, CallerProfile, Contact, Portfolio } from '@prisma/client';

type FullJob = Job & {
  portfolio: Portfolio | null;
  callerProfile: CallerProfile | null;
  contact: Contact | null;
};

export async function enqueueJob(jobId: string, opts?: { resumeFromApproval?: boolean }): Promise<void> {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { portfolio: true, callerProfile: true, contact: true },
  });
  if (!job) throw new Error(`Job ${jobId} not found`);

  if (!opts?.resumeFromApproval) {
    await transition(jobId, 'optimizing');
  }

  try {
    await runJob(job as FullJob, opts);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await transition(jobId, 'failed');
    appendEvent(jobId, { type: 'error', message });
    throw err;
  }
}

async function transition(jobId: string, status: string, extra?: Record<string, unknown>): Promise<void> {
  await db.job.update({ where: { id: jobId }, data: { status, ...(extra as object) } });
  appendEvent(jobId, { type: 'transition', status, ...extra });
  broadcastToJob(jobId, { event: 'status', status, ...extra });
}

async function resolveProfile(job: FullJob): Promise<CallerProfile | null> {
  return job.callerProfile ?? await db.callerProfile.findFirst({ where: { isDefault: true } }) ?? null;
}

async function runJob(job: FullJob, opts?: { resumeFromApproval?: boolean }): Promise<void> {
  const dir = initDir(job.id);
  await db.job.update({ where: { id: job.id }, data: { complianceDir: dir } });

  if (!opts?.resumeFromApproval) {
    // Step 1: Optimize
    const runOpts = job.savedPortfolioId
      ? { mode: 'saved' as const, run_id: job.savedPortfolioId }
      : { mode: 'last' as const };
    const { run_id } = await triggerRun(runOpts);

    // Step 2: Pull pack + PDF + render HTML
    const [pack, packHtml, pdf] = await Promise.all([
      getPack(run_id, 'json'),
      getPack(run_id, 'html'),
      getPdf(run_id),
    ]);

    writeFile(job.id, 'report_pack.json', JSON.stringify(pack, null, 2));
    writeFile(job.id, 'report.html', packHtml as string);
    writeFile(job.id, 'report.pdf', pdf);
    writeFile(job.id, 'admin_log.md', buildAdminLog(job, run_id));

    await db.job.update({ where: { id: job.id }, data: { packId: run_id } });

    const callerProfile = await resolveProfile(job);
    let disclosures: Disclosures;

    if (config.MOCK_MODE) {
      // Skip all compliance gates in mock mode — no real recipient, no real call
      appendEvent(job.id, { type: 'gate_skipped', reason: 'mock_mode' });
      disclosures = buildMockDisclosures(job.phoneE164, callerProfile);
    } else {
      // Step 3: Owned-numbers guard — runs before any policy, fails closed
      const guardResult = await ownedNumbersGuard(job.phoneE164);
      if (!guardResult.allow) {
        await transition(job.id, 'blocked', { blockReason: guardResult.reason });
        appendEvent(job.id, { type: 'gate_blocked', reason: guardResult.reason });
        return;
      }

      // Step 4: Policy evaluate
      const policy = policyRegistry.get(job.policyId);
      const contact = job.contact ?? await db.contact.findUnique({ where: { id: job.contactId ?? '' } });
      const gateResult = await policy.evaluate({ job, contact, callerProfile, phone: job.phoneE164, now: new Date() });

      appendEvent(job.id, { type: 'gate_evaluated', allow: gateResult.allow, reason: gateResult.reason });

      if (!gateResult.allow) {
        await transition(job.id, 'blocked', { blockReason: gateResult.reason ?? 'policy_disabled' });
        return;
      }

      // Step 5: Maker-checker stub (Phase 8)
      if (config.APPROVAL_REQUIRED) {
        await transition(job.id, 'pending_approval');
        return;
      }

      disclosures = gateResult.disclosures;
    }

    await transition(job.id, 'gated');
    const packData = JSON.parse(fs.readFileSync(path.join(dir, 'report_pack.json'), 'utf8')) as Record<string, unknown>;
    await dispatchCall(job, packData, disclosures, callerProfile);
  } else {
    // Resumed from approval
    await transition(job.id, 'gated');
    const packPath = path.join(dir, 'report_pack.json');
    if (!fs.existsSync(packPath)) throw new Error('Pack file missing on approval resume');
    const packData = JSON.parse(fs.readFileSync(packPath, 'utf8')) as Record<string, unknown>;

    const policy = policyRegistry.get(job.policyId);
    const contact = job.contact ?? await db.contact.findUnique({ where: { id: job.contactId ?? '' } });
    const callerProfile = await resolveProfile(job);
    const gateResult = await policy.evaluate({ job, contact, callerProfile, phone: job.phoneE164, now: new Date() });
    await dispatchCall(job, packData, gateResult.disclosures, callerProfile);
  }
}

async function dispatchCall(
  job: FullJob,
  pack: Record<string, unknown>,
  disclosures: Disclosures,
  profile: CallerProfile | null,
): Promise<void> {
  const entityName = profile?.entityName ?? config.DEFAULT_ENTITY_NAME;

  const headline = (pack.headline as Record<string, unknown>) ?? {};
  const objectivePlain = (headline.objective_plain as string) ?? 'portfolio optimization';
  const voicemailScript =
    `Hi, this is an automated assistant calling on behalf of ${entityName}. ` +
    `A portfolio optimization focused on ${objectivePlain} has been prepared for you, ` +
    `and a detailed report will follow by email. This is for educational purposes, not investment advice.`;

  const callRecord = await db.callRecord.create({
    data: { jobId: job.id, provider: config.MOCK_MODE ? 'mock' : 'twilio' },
  });

  await transition(job.id, 'dialing');

  const webhookBase = `http://127.0.0.1:${config.PORT}`;
  const result = await dispatch({
    call_id: callRecord.id,
    phone_e164: job.phoneE164,
    report_pack: pack,
    mode_hint: (job.modeHint as 'summary' | 'detail') ?? undefined,
    disclosures: {
      ai_identity: disclosures.ai_identity,
      purpose: disclosures.purpose,
      callback_number: disclosures.callback_number,
      financial_disclaimer: disclosures.financial_disclaimer,
      recording_notice: disclosures.recording_notice,
      require_recording_consent: disclosures.require_recording_consent,
    },
    voicemail_script: voicemailScript,
    status_webhook: `${webhookBase}/api/calls/webhook`,
  });

  await db.callRecord.update({
    where: { id: callRecord.id },
    data: {
      providerCallSid: result.provider_call_sid,
      startedAt: new Date(),
      recordingConsented: !disclosures.require_recording_consent,
    },
  });

  await transition(job.id, 'in_call');
  appendEvent(job.id, { type: 'dispatched', provider_call_sid: result.provider_call_sid });
}

function buildMockDisclosures(phone: string, profile: CallerProfile | null): Disclosures {
  const entityName = profile?.entityName ?? config.DEFAULT_ENTITY_NAME;
  const callbackNumber = profile?.callbackNumber ?? config.DEFAULT_CALLBACK_NUMBER;
  return {
    ai_identity: `I am an AI voice assistant calling on behalf of ${entityName}. I am not a human.`,
    purpose: 'I am calling to discuss your portfolio optimization report.',
    callback_number: callbackNumber,
    financial_disclaimer: 'Educational use only. Not investment advice.',
    recording_notice: 'This call may be recorded for quality and compliance purposes.',
    require_recording_consent: false,
  };
}

function buildAdminLog(job: FullJob, runId: string): string {
  return [
    `# Admin Log — Job ${job.id}`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    `Run ID: ${runId}`,
    `Phone: [redacted for log]`,
    `Policy: ${job.policyId}`,
    `Trigger: ${job.trigger}`,
    `Mode hint: ${job.modeHint ?? 'none'}`,
    `Portfolio: ${job.savedPortfolioId ?? 'last'}`,
  ].join('\n');
}
