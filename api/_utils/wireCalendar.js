// api/_utils/wireCalendar.js
// FantasyTimes Wire — market-date bucketing + trading-session walker
// (Spec V1.5 §4.5, §4.6).
//
// Design rules this module encodes:
//  • deriveMarketDate takes an INJECTED instant — never the wall clock — so a
//    key/bucket derived at creation time is immutable across retries and
//    replays (B5; the formatEtDate/deriveSlotDate precedent, not the
//    per-endpoint getTodayET() wall-clock copies).
//  • The walker's holiday knowledge comes from marketSchedule.js ONLY —
//    the single maintained source (F2-9). It refuses to walk beyond the
//    maintained horizon rather than silently treating unmaintained-year
//    holidays as trading sessions (the 2028+ coverage guard).

import {
  isMarketHoliday,
  MAINTAINED_HOLIDAY_YEARS,
} from './marketSchedule.js';

/**
 * Derive the immutable ET market-date bucket ('YYYY-MM-DD') for an instant.
 *
 * @param {Date|number|string} instant — REQUIRED. The moment the idempotency
 *   key is created (pre-model-call). Passing the current time is the caller's
 *   explicit choice; this function never reads the clock itself.
 * @returns {string} ET calendar date, e.g. '2026-07-24'
 */
export function deriveMarketDate(instant) {
  if (instant === undefined || instant === null) {
    throw new Error('deriveMarketDate requires an explicit instant (no wall-clock default)');
  }
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`deriveMarketDate: invalid instant ${String(instant)}`);
  }
  // en-CA in America/New_York yields YYYY-MM-DD — the repo's established ET
  // date idiom (tournamentTime.js formatEtDate), here with an injected now.
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/** Is this ET calendar date a trading session (Mon–Fri, not a NYSE holiday)? */
export function isTradingSession(dateStr) {
  assertMaintainedYear(dateStr);
  const dow = utcDayOfWeek(dateStr);
  if (dow === 0 || dow === 6) return false;
  return !isMarketHoliday(dateStr);
}

/**
 * Walk BACKWARD from (exclusive of) `marketDate` and return the N most recent
 * completed trading sessions, oldest first.
 *
 * Window semantics per D2/V1.5 §4.6: "5 completed sessions strictly prior +
 * current" — this returns the strictly-prior part; the caller pairs it with
 * `marketDate` itself (today's doc) for chain lookback and continuity.
 *
 * @param {string} marketDate — 'YYYY-MM-DD' anchor (need not itself be a session)
 * @param {number} n — sessions to return
 * @returns {string[]} e.g. ['2026-07-17', ..., '2026-07-23'] (oldest first)
 */
export function priorTradingSessions(marketDate, n) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(marketDate))) {
    throw new Error(`priorTradingSessions: invalid marketDate ${String(marketDate)}`);
  }
  const sessions = [];
  let cursor = marketDate;
  // Bound the scan: n sessions can span at most ~(2n + holidays + weekends)
  // calendar days; 40 covers n=5 across any holiday cluster with margin.
  const MAX_SCAN_DAYS = Math.max(40, n * 8);
  for (let i = 0; i < MAX_SCAN_DAYS && sessions.length < n; i++) {
    cursor = previousCalendarDay(cursor);
    assertMaintainedYear(cursor);
    const dow = utcDayOfWeek(cursor);
    if (dow === 0 || dow === 6) continue;
    if (isMarketHoliday(cursor)) continue;
    sessions.push(cursor);
  }
  if (sessions.length < n) {
    throw new Error(
      `priorTradingSessions: could not find ${n} sessions before ${marketDate} within ${MAX_SCAN_DAYS} days`
    );
  }
  return sessions.reverse();
}

/**
 * The Wire lookback window: the 5 completed sessions strictly prior to
 * marketDate, plus marketDate itself (today's doc), oldest first.
 */
export const CHAIN_WINDOW_SESSIONS = 5;

export function wireLookbackDates(marketDate) {
  return [...priorTradingSessions(marketDate, CHAIN_WINDOW_SESSIONS), marketDate];
}

// ── internals ────────────────────────────────────────────────────────────

/**
 * Coverage guard (V1.5 §4.6): dating into a year whose NYSE holiday list is
 * not maintained would silently mislabel holidays as sessions (e.g.
 * Dec 25 2025 or any 2028 holiday would read as a trading day). Throw
 * instead, in BOTH directions: anchors beyond the horizon (2028+) fire it
 * directly, and a backward walk that crosses below the floor (into 2025)
 * fires it too — both are refusals to answer wrong.
 */
function assertMaintainedYear(dateStr) {
  const year = Number(String(dateStr).slice(0, 4));
  const min = Math.min(...MAINTAINED_HOLIDAY_YEARS);
  const max = Math.max(...MAINTAINED_HOLIDAY_YEARS);
  if (year < min || year > max) {
    throw new Error(
      `wireCalendar: ${dateStr} is outside the maintained NYSE holiday horizon ` +
      `(${min}-${max}). Add NYSE_HOLIDAYS_${year} to marketSchedule.js before walking this range.`
    );
  }
}

/** Day-of-week for a calendar date string, DST-immune (UTC-noon anchor). */
function utcDayOfWeek(dateStr) {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

/** Previous calendar date string, DST-immune (UTC-noon anchor). */
function previousCalendarDay(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
