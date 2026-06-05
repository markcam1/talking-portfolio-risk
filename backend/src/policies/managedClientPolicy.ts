// Phase 7 stub — ManagedClientPolicy
// Each gate is present but returns blocked with the reason,
// proving the framework is extensible before real implementation.
import type { RecipientPolicy, CallContext, GateResult, Disclosures } from './types.js';

export const managedClientPolicy: RecipientPolicy = {
  id: 'managed_client',

  async evaluate(ctx: CallContext): Promise<GateResult> {
    const disclosures = this.buildDisclosures(ctx);

    // Consent gate (blocks until Phase 7 implements it)
    return {
      allow: false,
      reason: 'policy_disabled',
      disclosures,
      requireRecordingConsent: true,
    };
  },

  buildDisclosures(_ctx: CallContext): Disclosures {
    return {
      ai_identity: 'I am an AI voice assistant. I am not a human.',
      purpose: 'I am calling to discuss your portfolio optimization report.',
      callback_number: '',
      financial_disclaimer: 'Educational use only. Not investment advice.',
      recording_notice: 'This call may be recorded. Do you consent to being recorded?',
      require_recording_consent: true,
    };
  },

  async onOptOut(_ctx: CallContext): Promise<void> {
    // Phase 7: add to DNC, revoke consent
  },
};
