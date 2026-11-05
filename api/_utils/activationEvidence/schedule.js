// api/_utils/activationEvidence/schedule.js
//
// ID-1 Build 2 — WHEN A BATTLE MAY BE FINALISED (contract §4.3).
//
// A battle is FINALISATION-DUE when (a) it is terminal or its `expiresAt` has
// passed, and (b) the run is at or after its FINALISATION CUTOFF: 01:30 UTC on
// the UTC calendar day after its LAST trading day (`timing.tradingDays` at its
// end; never firstTradingDay, never a snapshot's asOf). That is 21:30 ET in
// summer and 20:30 ET in winter: after ordinary expiry (20:00 ET at the latest)
// and before the tape's close pass (02:15 UTC). It is a property checked on
// every run, never an exact minute. Both instants are fixed once a battle
// exists, so a battle read once is scheduled from its stored `cutoffAt` and
// `expiresAt` without being read again.
//
// A battle whose last trading day cannot be read has no cutoff
// (`finalization_undetermined`): it is never due and never beyond the horizon,
// so it never gets a null pointer; it leaves the candidate set only through the
// lookback, and the census counts it.
//
// Pure: every instant is the caller's (epoch milliseconds).

import { CATCH_UP_HORIZON_DAYS, DAY_MS } from './constants.js';
import { getSessionForDate } from '../marketSchedule.js';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar date 'YYYY-MM-DD' → [y, m, d], else null. */
function calendarDate(s) {
  const m = typeof s === 'string' ? DATE_RE.exec(s) : null;
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d ? [y, mo, d] : null;
}

/** The battle's last trading day, or null when `timing.tradingDays` cannot be read. */
export function lastTradingDayOf(battle) {
  const days = battle?.timing?.tradingDays;
  if (!Array.isArray(days) || days.length === 0) return null;
  const last = days[days.length - 1];
  return calendarDate(last) ? last : null;
}

/** 01:30 UTC on the UTC day after the battle's last trading day, in ms; null (`finalization_undetermined`) when it cannot be read. */
export function finalizationCutoffOf(battle) {
  const parts = calendarDate(lastTradingDayOf(battle));
  if (!parts) return null;
  const [y, m, d] = parts;
  return Date.UTC(y, m - 1, d + 1, 1, 30, 0, 0);
}

/** The battle's own expiry (an ISO string or a Firestore Timestamp) in ms, or null. */
export function expiresAtMsOf(battle) {
  const e = battle?.expiresAt;
  if (e && typeof e.toMillis === 'function') { const ms = e.toMillis(); return Number.isFinite(ms) ? ms : null; }
  if (typeof e !== 'string') return null;
  const ms = Date.parse(e);
  return Number.isFinite(ms) ? ms : null;
}

/** Terminal: a status string other than 'active' (the review pass's battleIsTerminal). */
export function isTerminal(battle) {
  return typeof battle?.status === 'string' && battle.status !== 'active';
}

/** What a battle's schedule needs, from its document. */
export function scheduleOf(battle) {
  return { terminal: isTerminal(battle), expiresAtMs: expiresAtMsOf(battle), cutoffAtMs: finalizationCutoffOf(battle) };
}

/**
 * Finalisation-due at `nowMs`. Callable from stored values: a stored battle has no
 * status, so it passes `terminal: false`; the cutoff always falls after an
 * ordinary expiry, so the answer is the same as from the document.
 */
export function isFinalizationDue({ terminal = false, expiresAtMs = null, cutoffAtMs = null } = {}, nowMs) {
  if (!Number.isFinite(cutoffAtMs) || !Number.isFinite(nowMs)) return false;
  const ended = terminal === true || (Number.isFinite(expiresAtMs) && nowMs >= expiresAtMs);
  return ended && nowMs >= cutoffAtMs;
}

/** A trading session's close (13:00 ET on an early close), in ms, from the calendar's own tables; null when it is no maintained session. */
export function sessionCloseMsOf(session) {
  const s = calendarDate(session) ? getSessionForDate(session) : null;
  return s?.isTradingDay && Number.isFinite(s.closeMs) ? s.closeMs : null;
}

/** Past the catch-up horizon (3 calendar days after the cutoff): outstanding work is abandoned. Never for a null cutoff. */
export function isBeyondHorizon({ cutoffAtMs = null } = {}, nowMs) {
  return Number.isFinite(cutoffAtMs) && Number.isFinite(nowMs) && nowMs >= cutoffAtMs + CATCH_UP_HORIZON_DAYS * DAY_MS;
}
