// api/_utils/setupEvaluator/dailyBarsAdapter.js
//
// Measured Trend Evidence, slice 1 (P3) — the rule-agnostic daily-bars
// adapter (V3 build prompt §8, resolution points 2 and 3). It turns the
// platform's daily rows (mapDailyRows output, api/_utils/marketDataCache.js)
// into one raw-basis window of completed sessions with typed refusals, so an
// evaluator never guesses about a missing session, a bad price, or a basis
// change.
//
// Pure: no fetch, no quote, no rankings document, no store. The clock is an
// injected `now`. It imports the calendar of record (api/_utils/marketSchedule.js,
// which re-exports src/utils/marketCalendar.js) and two marketDataCache.js
// helpers (toEtParts, isCryptoSymbol); the shared volume policy classifies
// volumes without altering them. It knows no Trend Follower rule: `minBars`
// is the caller's (the evaluator's MIN_COMPLETED_BARS).
//
// Refusal reasons (typed, never prose): unsupported_symbol_class,
// calendar_missing, asOf_not_a_session, asOf_in_future, missing_bar,
// unordered_bars, insufficient_history, missing_fact, basis_discontinuity.
//
// PROVENANCE (closeout, 28 Oct 2026): every result, ok or refused, carries a
// copy of the caller's `sourceMeta` (e.g. { fetchedAt, from, to }) with only
// the keys the caller supplied, or null when none was supplied — never filled
// from the bars. A refusal carries the requested `asOf` and the calendar's
// `expected` session (null when the refusal comes before the calendar has
// named it); an ok result carries the session as `asOf` and the request as
// `requestedAsOf`.
//
// THE SPLIT HEURISTIC AND ITS LIMITS (carried into every report that cites
// it): with adjustment metadata present on every window row (a finite
// adjustedClose GREATER THAN ZERO on each — review TE2-1: a vendor's zero
// adjusted close is not metadata), the ratio adjustedClose / close is compared
// day over day, symmetrically (1 − min / max of the two days' ratios, review
// TE2-5; founder ruling Q-TE-13), and a change above 10% is
// `basis_discontinuity`. It needs the vendor's adjustment already
// applied; a special dividend above 10% trips it; a restated series is
// invisible to it; it is not proof of split-free data. A ratio of 1 proves
// nothing and is never used to infer that metadata was present.
//
// UPSTREAM NOTE (review TE2-3): mapDailyRows drops a row whose close (after
// the adjusted fallback), high or low is not finite BEFORE this adapter sees
// it, so such a session reads here as `missing_bar` (the gap), not as
// `missing_fact`; the mapper's drop count is the caller's to carry. Rows with
// a finite but non-positive price, or a null raw close beside a finite
// adjusted one, do reach this adapter and read `missing_fact`.

import { getSessionForDate, getPreviousTradingDay, MAINTAINED_HOLIDAY_YEARS } from '../marketSchedule.js';
import { toEtParts, isCryptoSymbol } from '../marketDataCache.js';
import { classifyVolume } from './volumePolicy.js';

export const BASIS = 'raw';
/** A day-over-day change of the adjusted/raw ratio above this trips the heuristic. */
export const SPLIT_RATIO_JUMP = 0.10;
export const ADAPTER_REFUSALS = Object.freeze([
  'unsupported_symbol_class', 'calendar_missing', 'asOf_not_a_session', 'asOf_in_future', 'missing_bar',
  'unordered_bars', 'insufficient_history', 'missing_fact', 'basis_discontinuity',
]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const toNum = (v) => {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};
const yearOf = (d) => Number(d.slice(0, 4));
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function assertNow(now) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError('dailyBarsAdapter: `now` must be a valid Date (injected, never read from the clock here)');
}

/**
 * The expected completed session for `asOf`, from the calendar and the
 * injected clock, BEFORE any row is read (resolution point 2).
 *
 * @returns {{ ok: true, expected: string, completedSession: 'complete'|'current_session_incomplete', asOf: string, today: string }
 *         | { ok: false, reason: 'calendar_missing'|'asOf_not_a_session'|'asOf_in_future', detail: object }}
 */
export function expectedCompletedSession({ asOf, now } = {}) {
  assertNow(now);
  const session = getSessionForDate(asOf);
  if (!session) {
    // A malformed or impossible date is named as such; an unmaintained year keeps the plain reason (review TEV2-2).
    const malformed = typeof asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(asOf) || Number.isNaN(Date.parse(`${asOf}T12:00:00Z`)) || new Date(`${asOf}T12:00:00Z`).toISOString().slice(0, 10) !== asOf;
    return { ok: false, reason: 'calendar_missing', detail: { asOf: asOf ?? null, maintainedYears: [...MAINTAINED_HOLIDAY_YEARS], ...(malformed ? { why: 'malformed_date' } : {}) } };
  }
  if (!session.isTradingDay) return { ok: false, reason: 'asOf_not_a_session', detail: { asOf } };
  const today = toEtParts(now).dateStr;
  if (asOf > today) return { ok: false, reason: 'asOf_in_future', detail: { asOf, today } };
  if (asOf === today && now.getTime() < session.closeMs) {
    if (!session.previousEtDate) return { ok: false, reason: 'calendar_missing', detail: { asOf, today, why: 'previous_session_outside_maintained_years' } };
    return { ok: true, expected: session.previousEtDate, completedSession: 'current_session_incomplete', asOf, today };
  }
  return { ok: true, expected: asOf, completedSession: 'complete', asOf, today };
}

/**
 * Attach the vendor's adjusted close to mapDailyRows' rows, matched by date,
 * as `adjustedClose` (the finite `adjusted_close`, else null). Rows are
 * copied; mapDailyRows' rows are otherwise identical and never mutated.
 * This is the ONLY way adjustment provenance enters the adapter (resolution
 * point 3): mapDailyRows carries no flag for `adjusted_close` presence.
 */
export function attachAdjustedClose(rows, payload) {
  const byDate = new Map();
  for (const p of Array.isArray(payload) ? payload : []) {
    if (p && typeof p.date === 'string' && !byDate.has(p.date)) byDate.set(p.date, toNum(p.adjusted_close));
  }
  return (Array.isArray(rows) ? rows : []).map((r) => ({ ...r, adjustedClose: byDate.has(r.date) ? byDate.get(r.date) : null }));
}

/**
 * Build one raw-basis window of completed sessions.
 *
 * @param {object} args
 * @param {Array} args.rows mapDailyRows output (newest first), optionally with `adjustedClose` attached
 * @param {string} args.asOf YYYY-MM-DD, the session the caller asks for
 * @param {Date} args.now the injected clock
 * @param {number} args.minBars the window size the consumer needs (the evaluator's MIN_COMPLETED_BARS)
 * @param {string} [args.source] e.g. 'eodhd_eod'
 * @param {object} [args.sourceMeta] e.g. { fetchedAt, from, to }
 * @param {string} [args.symbol]
 * @param {'later_reconstruction'|'contemporaneous'|'synthetic'} [args.barsClass] what the bars are to the verdict's date;
 *   provider bars are `later_reconstruction` (the default) or `contemporaneous`; `synthetic` is for synthetic test
 *   evidence only (founder ruling Q-TE-4) and is never the default
 */
export function buildDailyEvidence({ rows, asOf, now, minBars, source = null, sourceMeta = null, symbol = null, barsClass = 'later_reconstruction' } = {}) {
  assertNow(now);
  if (!Number.isInteger(minBars) || minBars < 1) throw new TypeError('dailyBarsAdapter: `minBars` must be a positive integer supplied by the caller');
  // Refusals carry the requested asOf, the expected session once the calendar has named it (review TE2-7), and the bars class (review TE5-2).
  let expectedSession = null;
  // One `checks` shape on every result, refusals included (review TEV2-1): each field null until its step has run.
  const checks = { completedSession: null, adjacency: null, splitCheck: null, splitCheckReason: null };
  // The caller's sourceMeta is copied onto every result, refusals included (closeout, 28 Oct 2026): only the supplied keys, never invented.
  const meta = sourceMeta && typeof sourceMeta === 'object' ? { ...sourceMeta } : null;
  const refuse = (reason, detail, extra = {}) => ({ ok: false, reason, detail, asOf: asOf ?? null, expected: expectedSession, basis: BASIS, source, sourceMeta: meta, symbol, evidenceClass: { bars: barsClass }, checks, ...extra });

  // 1. The symbol class.
  if (symbol && isCryptoSymbol(symbol)) return refuse('unsupported_symbol_class', { symbol });

  // 2. The expected completed session, from the calendar, before any row is read.
  const session = expectedCompletedSession({ asOf, now });
  if (!session.ok) return refuse(session.reason, session.detail);
  const { expected, completedSession, today } = session;
  expectedSession = expected;
  checks.completedSession = completedSession;

  // 3. Map to the raw basis and drop every row after the expected session.
  const input = Array.isArray(rows) ? rows : [];
  for (let i = 0; i < input.length; i++) {
    const r = input[i];
    if (!r || typeof r.date !== 'string' || !DATE_RE.test(r.date)) return refuse('unordered_bars', { index: i, date: r?.date ?? null, why: 'malformed_date' });
  }
  const mapped = [];
  let dropped = 0;
  let droppedAfterToday = 0; // a row dated after today's ET date is impossible for a completed-session feed; counted apart (review TEV2-3)
  for (const r of input) {
    if (r.date > expected) { dropped += 1; if (r.date > today) droppedAfterToday += 1; continue; }
    const bar = {
      date: r.date,
      open: toNum(r.open),
      high: toNum(r.high),
      low: toNum(r.low),
      close: toNum(r.rawClose),
      volume: r.volume === undefined ? null : r.volume,
    };
    if (hasOwn(r, 'adjustedClose')) bar.adjustedClose = r.adjustedClose;
    mapped.push(bar);
  }

  // 4. The newest remaining row must BE the expected session; never an older fallback.
  if (mapped.length === 0 || mapped[0].date !== expected) {
    return refuse('missing_bar', { expected, latest: mapped.length ? mapped[0].date : null }, { checks });
  }

  // 5. Strictly decreasing dates.
  for (let i = 1; i < mapped.length; i++) {
    if (!(mapped[i].date < mapped[i - 1].date)) return refuse('unordered_bars', { index: i, date: mapped[i].date, previous: mapped[i - 1].date }, { checks });
  }

  // 6. Enough history for the caller's window.
  if (mapped.length < minBars) return refuse('insufficient_history', { required: minBars, available: mapped.length }, { checks });
  const window = mapped.slice(0, minBars);

  // 7. Prices inside the window: null or non-positive is a missing fact, never dropped, never filled. Volumes are classified, values preserved.
  //    A window row dated on a non-session (a weekend or a holiday the calendar knows) is a shape error, refused by name (review TE2-2).
  for (const bar of window) {
    const rowSession = getSessionForDate(bar.date);
    if (rowSession && !rowSession.isTradingDay) return refuse('unordered_bars', { index: window.indexOf(bar), date: bar.date, why: 'non_session_date' }, { checks });
    for (const fact of ['close', 'high', 'low']) {
      if (!isNum(bar[fact]) || bar[fact] <= 0) return refuse('missing_fact', { fact, date: bar.date, value: bar[fact] }, { checks });
    }
    bar.volumeClass = classifyVolume(bar.volume);
  }

  // 8. Adjacency inside the maintained years.
  let adjacencyAvailable = true;
  for (let i = 0; i + 1 < window.length; i++) {
    const newer = window[i].date;
    const older = window[i + 1].date;
    if (!MAINTAINED_HOLIDAY_YEARS.includes(yearOf(newer)) || !MAINTAINED_HOLIDAY_YEARS.includes(yearOf(older))) { adjacencyAvailable = false; continue; }
    const expectedPrevious = getPreviousTradingDay(newer);
    if (expectedPrevious !== older) return refuse('missing_bar', { expected: expectedPrevious, latest: older, after: newer }, { checks });
  }
  checks.adjacency = adjacencyAvailable ? 'ok' : 'not_available';

  // 9. The split heuristic, only with explicit provenance: metadata is present only when EVERY window row carries a
  //    finite adjustedClose greater than zero (review TE2-1: 0/0 ratios would pass a NaN comparison silently).
  const anyKey = window.some((bar) => hasOwn(bar, 'adjustedClose'));
  const missingDates = window.filter((bar) => !hasOwn(bar, 'adjustedClose') || !isNum(bar.adjustedClose)).map((bar) => bar.date);
  const nonPositiveDates = window.filter((bar) => hasOwn(bar, 'adjustedClose') && isNum(bar.adjustedClose) && bar.adjustedClose <= 0).map((bar) => bar.date);
  let adjustment;
  if (!anyKey) {
    adjustment = { metadata: 'absent', missingDates: [] };
    checks.splitCheck = 'not_available';
    checks.splitCheckReason = 'adjustment_metadata_absent';
  } else if (missingDates.length > 0 || nonPositiveDates.length > 0) {
    adjustment = { metadata: 'absent', missingDates: [...missingDates, ...nonPositiveDates].sort().reverse() };
    checks.splitCheck = 'not_available';
    checks.splitCheckReason = missingDates.length > 0 ? 'adjusted_close_missing' : 'adjusted_close_nonpositive';
  } else {
    adjustment = { metadata: 'present', missingDates: [] };
    for (let i = 0; i + 1 < window.length; i++) {
      const ratioAfter = window[i].adjustedClose / window[i].close;
      const ratioBefore = window[i + 1].adjustedClose / window[i + 1].close;
      const jump = 1 - Math.min(ratioAfter, ratioBefore) / Math.max(ratioAfter, ratioBefore); // symmetric, "above 10%" in either direction (review TE2-5)
      if (jump > SPLIT_RATIO_JUMP) {
        checks.splitCheck = 'tripped';
        return refuse('basis_discontinuity', { date: window[i].date, ratioBefore, ratioAfter }, { checks, adjustment });
      }
    }
    checks.splitCheck = 'heuristic_ok';
  }

  // 10. The window.
  return {
    ok: true,
    symbol,
    asOf: window[0].date,
    requestedAsOf: asOf,
    basis: BASIS,
    source,
    sourceMeta: meta,
    evidenceClass: { bars: barsClass },
    checks,
    adjustment,
    dropped,
    droppedAfterToday,
    bars: window,
  };
}
