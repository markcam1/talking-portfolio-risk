import { db } from '../../db.js';

export async function dncCheck(phoneE164: string): Promise<{ blocked: boolean }> {
  const entry = await db.dncEntry.findUnique({ where: { phoneE164 } });
  return { blocked: !!entry };
}
