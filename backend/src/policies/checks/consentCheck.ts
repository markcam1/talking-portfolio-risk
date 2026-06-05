import { db } from '../../db.js';

export interface ConsentResult {
  blocked: boolean;
  reason?: string;
}

/**
 * Checks whether an explicit consent record exists for the given contact.
 * SelfCallPolicy skips this check (auto-granted for self-call).
 * ManagedClientPolicy (Phase 7) will gate on this before dialing.
 *
 * Returns not-blocked if no contactId is provided (e.g. ad-hoc self-call).
 */
export async function consentCheck(contactId: string | null | undefined): Promise<ConsentResult> {
  if (!contactId) return { blocked: false };

  const consent = await db.consent.findFirst({
    where: { contactId, status: 'granted' },
  });

  if (!consent) {
    return { blocked: true, reason: 'no_consent' };
  }

  if (consent.expiresAt && consent.expiresAt < new Date()) {
    return { blocked: true, reason: 'consent_expired' };
  }

  return { blocked: false };
}
