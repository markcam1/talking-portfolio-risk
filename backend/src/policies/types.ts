import type { Job, Contact, CallerProfile } from '@prisma/client';

export interface CallContext {
  job: Job;
  contact: Contact | null;
  callerProfile: CallerProfile | null;
  phone: string;
  now: Date;
}

export interface Disclosures {
  ai_identity: string;
  purpose: string;
  callback_number: string;
  financial_disclaimer: string;
  recording_notice: string;
  require_recording_consent: boolean;
}

export interface GateResult {
  allow: boolean;
  reason?: string;
  disclosures: Disclosures;
  requireRecordingConsent: boolean;
}

export interface RecipientPolicy {
  id: 'self' | 'managed_client' | 'open';
  evaluate(ctx: CallContext): Promise<GateResult>;
  buildDisclosures(ctx: CallContext): Disclosures;
  onOptOut(ctx: CallContext): Promise<void>;
}
