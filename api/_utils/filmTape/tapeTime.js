// api/_utils/filmTape/tapeTime.js
//
// Film Room tape — ET dates, day bounds, sessions and the two schedules.
// PURE: no clock is read here (every function takes the instant it needs).
// ET arithmetic goes through Intl with `America/New_York` and the calendar of
// record (marketSchedule.js) — never a hand-rolled offset (BUILD_RULES §6).

import { getSessionForDate, getPreviousSessionDate, isMarketHoliday, MAINTAINED_HOLIDAY_YEARS } from '../marketSchedule.js';
import {
  CANDLE_PASS_UTC_HOUR, CANDLE_RETRY_WINDOW_SESSIONS,
} from '../../../src/constants/filmTape.js';
import {
  toMs, etDateOf, nextCalendarDate, etDayBounds, closePassStartMs, closePassEndMs,
} from '../../../src/utils/tapeSchedule.js';

// The ET-day arithmetic and the close pass's schedule are the shared module's
// (src/utils/tapeSchedule.js — one implementation for the server and the hub
// helper, BA-28); re-exported here for the tape's modules.
export { toMs, etDateOf, nextCalendarDate, etDayBounds };

const isEtDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Is the instant inside [start, end)? */
export function inDay(instant, bounds) {
  const ms = toMs(instant);
  return ms !== null && bounds !== null && ms >= bounds.startMs && ms < bounds.endMs;
}

/** The regular session for `etDate` (calendar of record), or null outside the maintained years. */
export function sessionFor(etDate) {
  return getSessionForDate(etDate);
}

/** Is `etDate` an NYSE session (Mon–Fri, not a holiday, inside the maintained calendar)? */
export function isSessionDate(etDate) {
  const s = getSessionForDate(etDate);
  return Boolean(s && s.isTradingDay);
}

/** Every session date in [from, to], ascending. Empty on a malformed or unmaintained range. */
export function sessionDatesBetween(from, to) {
  if (!isEtDate(from) || !isEtDate(to) || from > to) return [];
  const out = [];
  let cursor = from;
  for (let i = 0; i < 400 && cursor <= to; i += 1) {
    const [y] = cursor.split('-').map(Number);
    if (!MAINTAINED_HOLIDAY_YEARS.includes(y)) return [];
    if (isSessionDate(cursor)) out.push(cursor);
    cursor = nextCalendarDate(cursor);
  }
  return out;
}

/** The session `n` sessions before `etDate` (null when the walk leaves the calendar). */
export function sessionsBack(etDate, n) {
  let cursor = etDate;
  for (let i = 0; i < n; i += 1) {
    cursor = getPreviousSessionDate(cursor);
    if (!cursor) return null;
  }
  return cursor;
}

/** The previous session date before `etDate`. */
export function previousSession(etDate) {
  return getPreviousSessionDate(etDate);
}

/** Is `etDate` an NYSE holiday (the calendar of record)? */
export function isHoliday(etDate) {
  return isMarketHoliday(etDate);
}

// ── The two schedules ───────────────────────────────────────────────────────

/**
 * The close pass that covers session `etDate`: `15 2 * * 2-6` UTC fires on the
 * NEXT UTC calendar day at 02:15 — 22:15 EDT / 21:15 EST of `etDate` itself.
 * Returns the instant it starts and the instant it can have finished (its full
 * maxDuration), or null for a non-session date.
 */
export function closePassWindowFor(etDate) {
  if (!isSessionDate(etDate)) return null;
  return { startMs: closePassStartMs(etDate), endMs: closePassEndMs(etDate) };
}

/**
 * The ET date of the first candle-pass run at or after `nowMs`
 * (`0 11 * * 2-6` UTC — Tuesday to Saturday).
 */
export function nextCandleRunEtDate(nowMs) {
  const now = new Date(nowMs);
  for (let add = 0; add < 8; add += 1) {
    const run = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + add, CANDLE_PASS_UTC_HOUR, 0, 0);
    const dow = new Date(run).getUTCDay();
    if (run >= nowMs && dow >= 2 && dow <= 6) return etDateOf(run);
  }
  return null;
}

/**
 * The oldest session a candle run on `runEtDate` still serves: "up to 10
 * trading days old" (spec §6). A tape older than this is outside the only
 * retry path there is.
 */
export function candleWindowStart(runEtDate) {
  return sessionsBack(runEtDate, CANDLE_RETRY_WINDOW_SESSIONS);
}

/** Will the next candle run (after `nowMs`) still select a tape for `etDate`? */
export function withinCandleWindow(etDate, nowMs) {
  const runEtDate = nextCandleRunEtDate(nowMs);
  if (!runEtDate) return false;
  const oldest = candleWindowStart(runEtDate);
  return Boolean(oldest) && etDate >= oldest;
}
