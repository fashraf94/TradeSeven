// api/_utils/mandateCalendar.js
//
// Spec 1 — Mandate Substrate — quarter-boundary calendar math (§5.3 / I4).
// Node-clean, pure (no Firestore, no client). Reuses marketSchedule.js as the
// SINGLE market-calendar source of record (NYSE holidays, early closes) per
// §3.1 (F17) — this module adds only the two things marketSchedule does not
// expose: (a) a session-close INSTANT for an ARBITRARY reference date (its
// getNextMarketClose is "now"-relative), and (b) the "next session close on or
// after createdAt + 3 months" normalization I4 requires for nextRolloverAt.
//
// I4: quarter boundaries live only at session edges the close pass owns. The
// creation-time nextRolloverAt computed here is the initial boundary estimate;
// the P4 rollover/close pass re-normalizes to its owned session close at
// processing time, so this value never has to be perfect under a far-future
// calendar — it has to be a correct "next session close ≥ createdAt+3mo" under
// the maintained calendar.

import {
  isMarketHoliday,
  isEarlyCloseDay,
  MAINTAINED_HOLIDAY_YEARS,
} from './marketSchedule.js';
import { MANDATE_QUARTER_MONTHS } from './mandateConfig.js';

// Session close wall-clock times, ET. Source of record: marketSchedule.js:25-29
// (MARKET_CLOSE_HOUR/MIN 16:00, EARLY_CLOSE_HOUR/MIN 13:00) — those constants
// are module-private there, so the two values are restated here with this
// provenance note rather than reached through a private symbol.
const REGULAR_CLOSE = { hour: 16, min: 0 };
const EARLY_CLOSE = { hour: 13, min: 0 };

const MAX_MAINTAINED_YEAR = Math.max(...MAINTAINED_HOLIDAY_YEARS);

// ── Date primitives (UTC/Intl-based; host-timezone independent) ──────────────

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** 'YYYY-MM-DD' from 1-based (y, mo, d). */
function toDateStr(y, mo, d) {
  return `${y}-${pad2(mo)}-${pad2(d)}`;
}

/** Days in a 1-based month. */
function daysInMonth(y, mo) {
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

/** The calendar day after 1-based (y, mo, d). */
function nextCalendarDay(y, mo, d) {
  if (d < daysInMonth(y, mo)) return { y, mo, d: d + 1 };
  if (mo < 12) return { y, mo: mo + 1, d: 1 };
  return { y: y + 1, mo: 1, d: 1 };
}

/** Weekday (0=Sun..6=Sat) of a date string, host-TZ independent. */
function dayOfWeek(dateStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

/**
 * The ET wall-clock parts of an instant. DST-safe (Intl resolves the offset in
 * effect at that instant).
 */
function etWallClockParts(instant) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return {
    y: Number(parts.year),
    mo: Number(parts.month),
    d: Number(parts.day),
    // Some engines render midnight as '24'; normalize to 0.
    hh: Number(parts.hour) % 24,
    mm: Number(parts.minute),
  };
}

/**
 * The UTC instant whose America/New_York wall clock is (y, mo, d, hh, mm).
 * DST-safe and host-timezone independent: the offset is derived by rendering a
 * probe instant in both ET and UTC and diffing.
 */
function etWallClockToInstant(y, mo, d, hh, mm) {
  const asIfUtc = Date.UTC(y, mo - 1, d, hh, mm, 0, 0);
  const probe = new Date(asIfUtc);
  const etStr = probe.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const utcStr = probe.toLocaleString('en-US', { timeZone: 'UTC' });
  const offsetMs = new Date(utcStr).getTime() - new Date(etStr).getTime();
  return new Date(asIfUtc + offsetMs);
}

// ── Public API ───────────────────────────────────────────────────────────────

/** A trading day = Mon–Fri AND not a NYSE holiday (per marketSchedule). */
export function isTradingDayStr(dateStr) {
  const dow = dayOfWeek(dateStr);
  if (dow === 0 || dow === 6) return false;
  return !isMarketHoliday(dateStr);
}

/**
 * The session-close INSTANT for a trading-day date string ('YYYY-MM-DD'):
 * 16:00 ET, or 13:00 ET on an early-close day. Returns null when the date is
 * not a trading day (fail-closed — the caller must not mark a non-session as a
 * boundary).
 */
export function sessionCloseInstant(dateStr) {
  if (!isTradingDayStr(dateStr)) return null;
  const [y, mo, d] = dateStr.split('-').map(Number);
  const close = isEarlyCloseDay(dateStr) ? EARLY_CLOSE : REGULAR_CLOSE;
  return etWallClockToInstant(y, mo, d, close.hour, close.min);
}

/**
 * Add `n` calendar months to an instant, in ET wall-clock terms, preserving
 * time-of-day and clamping the day to the target month's length
 * (e.g. Nov 30 + 3mo → Feb 28/29).
 */
export function addMonthsET(instant, n) {
  const { y, mo, d, hh, mm } = etWallClockParts(instant);
  let ny = y;
  let nmo = mo + n;
  while (nmo > 12) { nmo -= 12; ny += 1; }
  const nd = Math.min(d, daysInMonth(ny, nmo));
  return etWallClockToInstant(ny, nmo, nd, hh, mm);
}

/**
 * nextRolloverAt normalization (§5.3 / I4): the first session-close INSTANT on
 * or after `fromInstant` + MANDATE_QUARTER_MONTHS. Walks ET calendar days from
 * the base date, skipping weekends/holidays, and returns the first session
 * close whose instant is ≥ base.
 *
 * `fromInstant` accepts a Date, a millis number, or an ISO string.
 *
 * Horizon note: holiday accuracy is bounded by marketSchedule's
 * MAINTAINED_HOLIDAY_YEARS. A boundary landing beyond that horizon is
 * weekend-accurate but may not skip an unmaintained-year holiday; `beyondHorizon`
 * on the return flags this. That is acceptable by design — I4 has the P4 close
 * pass re-normalize the boundary to its owned session edge at processing time,
 * against the then-current calendar.
 *
 * @returns {{ at: Date, dateStr: string, beyondHorizon: boolean }}
 */
export function computeNextRolloverAt(fromInstant) {
  const base = fromInstant instanceof Date ? fromInstant : new Date(fromInstant);
  if (Number.isNaN(base.getTime())) {
    throw new Error('computeNextRolloverAt: invalid fromInstant');
  }
  const baseMs = addMonthsET(base, MANDATE_QUARTER_MONTHS).getTime();

  let { y, mo, d } = etWallClockParts(new Date(baseMs));
  for (let i = 0; i < 400; i++) {
    const dateStr = toDateStr(y, mo, d);
    if (isTradingDayStr(dateStr)) {
      const close = sessionCloseInstant(dateStr);
      if (close && close.getTime() >= baseMs) {
        return { at: close, dateStr, beyondHorizon: y > MAX_MAINTAINED_YEAR };
      }
    }
    ({ y, mo, d } = nextCalendarDay(y, mo, d));
  }
  // Unreachable in practice (≤ ~10 non-session days ever run consecutively).
  throw new Error('computeNextRolloverAt: no session close within 400 days of base');
}
