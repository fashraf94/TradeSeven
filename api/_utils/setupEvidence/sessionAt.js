// api/_utils/setupEvidence/sessionAt.js
//
// ID-1 Build 1 — THE ACTIVATION-TO-SESSION WRAPPER (shape note V1.4 §3,
// "Session"). Every snapshot request names a completed session, and this is
// where that session comes from: a weekend or holiday, or an instant before the
// close, maps to the previous session; at or after the close, to that day.
// Early closes and DST are the calendar's own tables; this file adds nothing to
// them. Outside the maintained years it answers `calendar_missing`, never a
// guess. It uses the calendar's session lookup (getSessionForDate(...)
// .previousEtDate), never getPreviousTradingDay, which walks past the maintained
// years and can fall back to a non-session date.
//
// Pure: no clock is read, the instant is the caller's.

import { getSessionForDate, MAINTAINED_HOLIDAY_YEARS } from '../marketSchedule.js';
import { toEtParts } from '../marketDataCache.js';

const missing = (detail) => ({ ok: false, reason: 'calendar_missing', detail: { ...detail, maintainedYears: [...MAINTAINED_HOLIDAY_YEARS] } });

/**
 * The last completed session at an instant.
 *
 * @param {number} instantMs epoch milliseconds
 * @returns {{ ok: true, session: string, etDate: string, relation: 'non_session'|'before_close'|'after_close' }
 *         | { ok: false, reason: 'calendar_missing', detail: object }}
 */
export function lastCompletedSessionAt(instantMs) {
  // Before 1970 is no activation, and the ET formatter names no era: a BC instant would read as a maintained year.
  if (typeof instantMs !== 'number' || instantMs < 0 || !Number.isFinite(new Date(instantMs).getTime())) return missing({ etDate: null, why: 'malformed_instant' });
  const etDate = toEtParts(new Date(instantMs)).dateStr;
  const day = getSessionForDate(etDate);
  if (!day) return missing({ etDate });
  if (day.isTradingDay && instantMs >= day.closeMs) return { ok: true, session: etDate, etDate, relation: 'after_close' };
  if (!day.previousEtDate) return missing({ etDate, why: 'previous_session_outside_maintained_years' });
  return { ok: true, session: day.previousEtDate, etDate, relation: day.isTradingDay ? 'before_close' : 'non_session' };
}
