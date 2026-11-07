// src/components/Research/BombMode/checkClock.js
//
// Research Modal Build A — THE NEXT-CHECK CLOCK (spec
// docs/specs/RESEARCH_MODAL_BUILD_A_BOMB_MODE_SPEC_V1.md §3.3). Pure.
//
// A rung banks only at a scoring check (Phase 0 §C), so the clock is a real
// deadline. It is computed ONLY from the evaluator's own schedule —
// nextEligibleSlot from api/_utils/callRecords/horizon.js, imported the way
// src/screens/battleView/cockpitModel.js imports it — and NEVER as
// `lastCheckedAt + 15 min` (horizon.js's header rule; the Desk adapter's
// deriveDueAt is that forbidden second clock, reported, not touched).
//
// States:
//   countdown  the next slot today: `next check 3:45`, and mm:ss under 15 min
//   checking   a slot fired within the last CHECK_QUEUE_MS and the battle's
//              scoreState.lastScoredAt has not passed it — the cron's queue
//              (sequential, up to five minutes); then it rolls to the next slot
//   later      the next slot is on another day: its day and time (`Mon 9:30 AM`)
//   none       horizon.js has no slot (past the battle's end, or the calendar
//              cannot place the date)

import { nextEligibleSlot } from '../../../../api/_utils/callRecords/horizon.js';
// The calendar of record horizon.js reads (api/_utils/marketSchedule.js re-exports it from here).
import { getSessionForDate } from '../../../utils/marketCalendar.js';

/** How long a fired slot may still be in the cron's queue before the clock rolls on. */
export const CHECK_QUEUE_MS = 5 * 60 * 1000;
const FIFTEEN_MIN_MS = 15 * 60 * 1000;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

const ET_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const ET_HM = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });
const ET_WD = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' });

/** ET 'YYYY-MM-DD' of an instant. */
export const etDate = (ms) => ET_DATE.format(new Date(ms));
/** ET clock time without the day half: '3:45'. */
export function etClock(ms) {
  const parts = ET_HM.formatToParts(new Date(ms));
  return `${parts.find((p) => p.type === 'hour').value}:${parts.find((p) => p.type === 'minute').value}`;
}
/** ET clock time with its half: '3:59 PM'. */
export const etClockAmPm = (ms) => ET_HM.format(new Date(ms)).replace(/ /g, ' ');
/** ET weekday, short: 'Mon'. */
export const etWeekday = (ms) => ET_WD.format(new Date(ms));

/** Is the regular session open at `nowMs`? (The calendar of record horizon.js reads.) */
export function sessionOpenAt(nowMs) {
  if (!finite(nowMs)) return false;
  const s = getSessionForDate(etDate(nowMs));
  return !!s && s.isTradingDay === true && nowMs >= s.openMs && nowMs < s.closeMs;
}

/** 'mm:ss' of a non-negative span. */
export function mmss(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * @param {number} nowMs
 * @param {{ battleExpiresAtMs?: number|null, lastScoredAtMs?: number|null }} [opts]
 * @returns {{ state: 'countdown'|'checking'|'later'|'none', slotMs?: number, remainingMs?: number, label: string, reason?: string }}
 */
export function checkClock(nowMs, { battleExpiresAtMs = null, lastScoredAtMs = null } = {}) {
  if (!finite(nowMs)) return { state: 'none', reason: 'calendar_unavailable', label: '' };
  // No readable end on the record: no bound (the cockpit's own choice, cockpitModel.js) — never a blank clock.
  const expiry = finite(battleExpiresAtMs) ? battleExpiresAtMs : Number.MAX_SAFE_INTEGER;
  // A slot that fired in the last five minutes and is not yet scored.
  const recent = nextEligibleSlot(nowMs - CHECK_QUEUE_MS, { battleExpiresAtMs: expiry });
  if ('slotMs' in recent && recent.slotMs <= nowMs && !(finite(lastScoredAtMs) && lastScoredAtMs >= recent.slotMs)) {
    return { state: 'checking', slotMs: recent.slotMs, label: 'checking…' };
  }
  const next = nextEligibleSlot(nowMs, { battleExpiresAtMs: expiry });
  if (!('slotMs' in next)) return { state: 'none', reason: next.reason, label: '' };
  const remainingMs = next.slotMs - nowMs;
  if (etDate(next.slotMs) === etDate(nowMs) && sessionOpenAt(nowMs)) {
    return {
      state: 'countdown', slotMs: next.slotMs, remainingMs,
      label: remainingMs < FIFTEEN_MIN_MS ? `${etClock(next.slotMs)} · ${mmss(remainingMs)}` : etClock(next.slotMs),
    };
  }
  return { state: 'later', slotMs: next.slotMs, remainingMs, label: `${etWeekday(next.slotMs)} ${etClockAmPm(next.slotMs)}` };
}
