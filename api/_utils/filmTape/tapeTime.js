// api/_utils/filmTape/tapeTime.js
//
// Film Room tape — ET dates, day bounds, sessions and the two schedules.
// PURE: no clock is read here (every function takes the instant it needs).
// ET arithmetic goes through Intl with `America/New_York` and the calendar of
// record (marketSchedule.js) — never a hand-rolled offset (BUILD_RULES §6).

import { getSessionForDate, getPreviousSessionDate, isMarketHoliday, MAINTAINED_HOLIDAY_YEARS } from '../marketSchedule.js';
import {
  CLOSE_PASS_UTC_HOUR, CLOSE_PASS_UTC_MINUTE, CLOSE_PASS_MAX_DURATION_S,
  CANDLE_PASS_UTC_HOUR, CANDLE_RETRY_WINDOW_SESSIONS,
} from '../../../src/constants/filmTape.js';

const ET_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
});

const isEtDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Epoch ms from an ISO string, a number or a Timestamp-like; null otherwise. */
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

/** The instant of ET wall-clock `hour:minute` on `etDate`, probing both offsets with Intl. */
function etWallClockMs(etDate, hour, minute) {
  const [y, m, d] = etDate.split('-').map(Number);
  for (const offsetHours of [4, 5]) {
    const candidate = Date.UTC(y, m - 1, d, hour + offsetHours, minute, 0);
    const parts = ET_PARTS.formatToParts(new Date(candidate));
    const get = (t) => parts.find((p) => p.type === t)?.value;
    let h = parseInt(get('hour'), 10);
    if (h === 24) h = 0;
    if (`${get('year')}-${get('month')}-${get('day')}` === etDate && h === hour && parseInt(get('minute'), 10) === minute) return candidate;
  }
  return null;
}

/** The calendar day after `etDate`, as YYYY-MM-DD. */
export function nextCalendarDate(etDate) {
  const [y, m, d] = etDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1, 12)).toISOString().slice(0, 10);
}

/**
 * ET midnight to the next ET midnight, as epoch ms and ISO strings. The tape's
 * "day" for every record: ticks by `capturedAt`, entries by `timestamp`,
 * receipts and trades by `swappedOutAt`, run records by `startedAt`.
 */
export function etDayBounds(etDate) {
  if (!isEtDate(etDate)) return null;
  const startMs = etWallClockMs(etDate, 0, 0);
  const endMs = etWallClockMs(nextCalendarDate(etDate), 0, 0);
  if (startMs === null || endMs === null) return null;
  return { etDate, startMs, endMs, startIso: new Date(startMs).toISOString(), endIso: new Date(endMs).toISOString() };
}

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
  const [y, m, d] = etDate.split('-').map(Number);
  const startMs = Date.UTC(y, m - 1, d + 1, CLOSE_PASS_UTC_HOUR, CLOSE_PASS_UTC_MINUTE, 0);
  return { startMs, endMs: startMs + CLOSE_PASS_MAX_DURATION_S * 1000 };
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
