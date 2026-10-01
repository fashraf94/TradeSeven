// src/utils/tapeSchedule.js
//
// THE TAPE'S ONE ELIGIBILITY RULE — which close pass tapes which battle-day —
// shared by the server's close pass (api/_utils/filmTape/closePass.js
// re-exports it) and the hub helper (src/utils/reviewAvailability.js), so the
// helper answers `pending` only when the writer's OWN selection will tape the
// battle (Film Room spec V1.2 Amendment A, BA-28). One calendar
// (marketCalendar.js), one owning-pass rule, one ET-day arithmetic.
//
// PURE and browser-clean as well as Node-clean: Intl, the calendar module and
// the tape's constants — no clock is read, every instant is an argument. The
// imports carry their `.js` extension because api/ imports this module under
// Node ESM (BUILD_RULES §4).

import { getSessionForDate, getPreviousSessionDate, etWallClockToMs } from './marketCalendar.js';
import { CLOSE_PASS_UTC_HOUR, CLOSE_PASS_UTC_MINUTE, CLOSE_PASS_MAX_DURATION_S } from '../constants/filmTape.js';

const ET_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
});

/** A real calendar date written YYYY-MM-DD (2026-02-30 and 2026-9-24 are not). */
export function isEtDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === s;
}

/** Epoch ms from an ISO string, a number, a Date or a Timestamp-like; null otherwise. */
export function toMs(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v) { const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; }
  if (v && typeof v.toMillis === 'function') return toMs(v.toMillis());
  if (v instanceof Date) return toMs(v.getTime());
  return null;
}

/** The ET calendar date (YYYY-MM-DD) of an instant, or null. */
export function etDateOf(instant) {
  const ms = toMs(instant);
  if (ms === null) return null;
  const parts = ET_PARTS.formatToParts(new Date(ms));
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** The calendar day after `etDate`, as YYYY-MM-DD. */
export function nextCalendarDate(etDate) {
  const [y, m, d] = etDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1, 12)).toISOString().slice(0, 10);
}

/**
 * ET midnight to the next ET midnight, as epoch ms and ISO strings — the
 * tape's "day" for every record.
 */
export function etDayBounds(etDate) {
  if (typeof etDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(etDate)) return null;
  const startMs = etWallClockToMs(etDate, 0, 0);
  const endMs = etWallClockToMs(nextCalendarDate(etDate), 0, 0);
  if (startMs === null || endMs === null) return null;
  return { etDate, startMs, endMs, startIso: new Date(startMs).toISOString(), endIso: new Date(endMs).toISOString() };
}

/** Is `etDate` a session of the maintained calendar? */
export const isSessionDate = (etDate) => Boolean(getSessionForDate(etDate)?.isTradingDay);

// ── the close pass's schedule ───────────────────────────────────────────────

/**
 * The close pass for session `etDate` starts at 02:15 UTC on the NEXT UTC day
 * (`15 2 * * 2-6` — 22:15 EDT / 21:15 EST of `etDate` itself).
 */
export function closePassStartMs(etDate) {
  const [y, m, d] = etDate.split('-').map(Number);
  return Date.UTC(y, m - 1, d + 1, CLOSE_PASS_UTC_HOUR, CLOSE_PASS_UTC_MINUTE, 0);
}

/** The instant by which that pass can have finished: its start plus its full maxDuration. */
export const closePassEndMs = (etDate) => closePassStartMs(etDate) + CLOSE_PASS_MAX_DURATION_S * 1000;

// ── the close pass's selection (closePass.js re-exports these) ─────────────

/** Is `etDate` one of the battle's trading days? */
export function isBattleDay(battle, etDate) {
  const days = battle?.timing?.tradingDays;
  if (Array.isArray(days) && days.length) return days.includes(etDate);
  // Legacy documents without the list: active from the activation date through completion.
  const from = etDateOf(battle?.activatedAt ?? battle?.createdAt);
  const to = battle?.completedAt ? etDateOf(battle.completedAt) : null;
  return Boolean(from && from <= etDate && (!to || to >= etDate));
}

/**
 * The first instant whose completions tonight's pass (for session `etDate`)
 * owns: the start of the PREVIOUS session's ET day. So a battle marked
 * complete on a holiday, over a weekend, or after last night's pass has run
 * reaches its final-day tape on the next session night (review L1-F3 /
 * L3-F1). Overlap with last night is harmless: an already-recorded completion
 * is skipped by a one-document read, and the merge writes nothing when
 * nothing changed.
 */
export function completionsSinceMs(etDate) {
  const prev = getPreviousSessionDate(etDate);
  return etDayBounds(prev ?? etDate).startMs;
}

/** The date a battle's tape is written for on the pass for `etDate`, or null. */
export function tapeDateFor(battle, etDate, { completedSinceMs = etDayBounds(etDate).startMs } = {}) {
  if (isBattleDay(battle, etDate)) return etDate;
  const days = battle?.timing?.tradingDays;
  const doneMs = toMs(battle?.completedAt);
  if (battle?.status === 'completed' && doneMs !== null && Array.isArray(days) && days.length) {
    const finalDay = days[days.length - 1];
    if (finalDay < etDate && doneMs >= completedSinceMs && doneMs < etDayBounds(etDate).endMs) return finalDay;
  }
  return null;
}

// ── the owning pass, from the helper's side ─────────────────────────────────

/** The first session after `etDate`, or null when the walk leaves the maintained calendar. */
export function nextSessionDate(etDate) {
  let d = nextCalendarDate(etDate);
  for (let i = 0; i < 14; i += 1) {
    const s = getSessionForDate(d);
    if (!s) return null;
    if (s.isTradingDay) return d;
    d = nextCalendarDate(d);
  }
  return null;
}

/**
 * The session whose close pass is the FIRST to select a completion at
 * `completedMs`: its own ET date when that is a session and its pass had not
 * yet started, else the next session (the pass owns completions since the
 * previous session's day began). null when the walk leaves the maintained
 * calendar — the server refuses `calendar_missing` there, so no pass will run.
 */
export function owningPassDate(completedMs) {
  if (toMs(completedMs) === null) return null;
  const own = etDateOf(completedMs);
  const ownSession = getSessionForDate(own);
  if (!ownSession) return null;
  if (ownSession.isTradingDay && completedMs < closePassStartMs(own)) return own;
  return nextSessionDate(own);
}

/**
 * The battle's final trading day when EVERY `timing.tradingDays` entry is a
 * session of the maintained calendar; null for a malformed, empty or
 * unmaintained-year timeline (BA-28).
 */
export function validFinalTradingDay(battle) {
  const days = battle?.timing?.tradingDays;
  if (!Array.isArray(days) || !days.length) return null;
  return days.every((d) => isEtDate(d) && isSessionDate(d)) ? days[days.length - 1] : null;
}

/**
 * BA-28 — will a scheduled close pass tape this completed battle's final day,
 * with that pass still to run its course at `nowMs`? The writer's own rule,
 * over EVERY pass whose selection reaches the completion: the owning pass,
 * then each next session's pass while its window (completionsSinceMs to the
 * end of its ET day) still holds `completedAt` — the writer re-selects a
 * completion the next session night, so a final day the owning pass did not
 * tape (it failed, was not reached, or was an earlier trading day's pass) is
 * taped then. Pending while one of those passes, still to run, names the
 * final day by tapeDateFor. Every pass is inside the maintained calendar.
 */
export function closePassWillTape(battle, nowMs) {
  if (battle?.status !== 'completed' || toMs(nowMs) === null) return false;
  const finalDay = validFinalTradingDay(battle);
  const doneMs = toMs(battle?.completedAt);
  if (!finalDay || doneMs === null) return false;
  for (let pass = owningPassDate(doneMs); pass; pass = nextSessionDate(pass)) {
    const sinceMs = completionsSinceMs(pass);
    if (doneMs < sinceMs) return false;       // this pass's window has moved past the completion, and every later one's
    if (nowMs < closePassEndMs(pass) && tapeDateFor(battle, pass, { completedSinceMs: sinceMs }) === finalDay) return true;
  }
  return false;
}
