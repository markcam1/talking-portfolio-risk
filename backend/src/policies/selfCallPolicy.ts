import { db } from '../db.js';
import { config } from '../config.js';
import type { RecipientPolicy, CallContext, GateResult, Disclosures } from './types.js';

export const selfCallPolicy: RecipientPolicy = {
  id: 'self',

  async evaluate(ctx: CallContext): Promise<GateResult> {
    // DNC check — even self-call respects the DNC list
    const onDnc = await db.dncEntry.findUnique({ where: { phoneE164: ctx.phone } });
    if (onDnc) {
      return {
        allow: false,
        reason: 'on_dnc',
        disclosures: this.buildDisclosures(ctx),
        requireRecordingConsent: false,
      };
    }

    // Consent, calling window, frequency cap — all skipped for self-call
    return {
      allow: true,
      disclosures: this.buildDisclosures(ctx),
      requireRecordingConsent: false, // single-party; auto-granted
    };
  },

  buildDisclosures(ctx: CallContext): Disclosures {
    const entityName = config.DEFAULT_ENTITY_NAME;
    const callbackNumber = config.DEFAULT_CALLBACK_NUMBER;
    return {
      ai_identity: `I am an AI voice assistant calling on behalf of ${entityName}. I am not a human.`,
      purpose: 'I am calling to discuss your portfolio optimization report.',
      callback_number: callbackNumber,
      financial_disclaimer: 'This call is for educational purposes only and does not constitute investment advice.',
      recording_notice: 'This call may be recorded for quality and compliance purposes.',
      require_recording_consent: false,
    };
  },

  async onOptOut(ctx: CallContext): Promise<void> {
    await db.dncEntry.upsert({
      where: { phoneE164: ctx.phone },
      create: { phoneE164: ctx.phone, source: 'verbal_optout', note: `Job ${ctx.job.id}` },
      update: { source: 'verbal_optout' },
    });
  },
};
