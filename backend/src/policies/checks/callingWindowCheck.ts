import { config } from '../../config.js';

export interface WindowResult {
  blocked: boolean;
  reason?: string;
}

/**
 * Returns blocked if current local time in `timezone` is outside the configured calling window.
 * SelfCallPolicy skips this check (SELF_CALL_IGNORE_WINDOW=true by default).
 * ManagedClientPolicy (Phase 7) will call this before dialing.
 */
export function callingWindowCheck(now: Date, timezone: string): WindowResult {
  if (config.SELF_CALL_IGNORE_WINDOW) return { blocked: false };

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '12', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);
  const currentMinutes = hour * 60 + minute;

  const [startH, startM] = config.CALLING_WINDOW_START.split(':').map(Number);
  const [endH, endM] = config.CALLING_WINDOW_END.split(':').map(Number);
  const windowStart = startH * 60 + startM;
  const windowEnd = endH * 60 + endM;

  if (currentMinutes < windowStart || currentMinutes >= windowEnd) {
    return { blocked: true, reason: 'outside_calling_window' };
  }
  return { blocked: false };
}
