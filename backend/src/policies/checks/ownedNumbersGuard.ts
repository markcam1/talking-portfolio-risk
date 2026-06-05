import { db } from '../../db.js';
import { config } from '../../config.js';

export interface GuardResult {
  allow: boolean;
  reason?: string;
}

// Runs before any policy. Wraps in try/catch — any error → block (fail closed).
export async function ownedNumbersGuard(phoneE164: string): Promise<GuardResult> {
  if (!config.OWNED_NUMBERS_ONLY) {
    return { allow: true };
  }
  try {
    const owned = await db.ownedNumber.findFirst({
      where: { phoneE164, verified: true },
    });
    if (!owned) return { allow: false, reason: 'not_owned_number' };
    return { allow: true };
  } catch (err) {
    // Fail closed on any error
    console.error('ownedNumbersGuard error (blocking):', err);
    return { allow: false, reason: 'not_owned_number' };
  }
}
