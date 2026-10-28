// api/_utils/setupEvaluator/dailyBarsAdapter.test.js
//
// Measured Trend Evidence, slice 1 (P3) — V3 build prompt §9.3: the
// rule-agnostic daily-bars adapter, driven by the shared EODHD payload fixture
// (api/_utils/__fixtures__/eodPayload.js) through the REAL mapDailyRows. The
// fixture's rows are re-dated onto session dates (the calendar of record), so
// the adapter sees exactly the shape production hands it.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's REAL, unmocked imports
// of dailyBarsAdapter.js, marketDataCache.js and marketSchedule.js are the
// runtime guard for the adapter's import graph. Never mock them.

import '../__fixtures__/pinTimezoneUtc.js';
import { describe, it, expect } from 'vitest';
import { eodPayload } from '../__fixtures__/eodPayload.js';
import { mapDailyRows } from '../marketDataCache.js';
import { getPreviousSessionDate, getSessionForDate, isMarketHoliday } from '../marketSchedule.js';
import { buildDailyEvidence, attachAdjustedClose, expectedCompletedSession, ADAPTER_REFUSALS, SPLIT_RATIO_JUMP, BASIS } from './dailyBarsAdapter.js';
import { evaluateTfEntry, evaluateTfHolding } from './tfSetupV1.js';
import { MIN_COMPLETED_BARS } from './thresholds.js';
import { evidenceOf, buildBars } from './__fixtures__/syntheticBars.js';
import { toDecimal, addDecimal, subtractDecimal, multiplyDecimal, compareDecimal, divideByInteger, toNumber, copyData } from './evidenceValues.js';

// ---------------------------------------------------------------- the fixture, re-dated onto sessions

/** n session dates newest first from `end`: the calendar inside its maintained years, a holiday-aware weekday walk outside them. */
function sessionDatesBack(end, n) {
  const out = [end];
  let cur = end;
  while (out.length < n) {
    let prev = getPreviousSessionDate(cur);
    if (!prev) {
      const d = new Date(Date.parse(`${cur}T12:00:00Z`));
      do { d.setUTCDate(d.getUTCDate() - 1); } while (d.getUTCDay() === 0 || d.getUTCDay() === 6 || isMarketHoliday(d.toISOString().slice(0, 10)));
      prev = d.toISOString().slice(0, 10);
    }
    out.push(prev);
    cur = prev;
  }
  return out;
}

const END = '2026-06-15'; // a Monday session
const DAY_AFTER = new Date('2026-06-16T12:00:00Z');
const SOURCE_META = { fetchedAt: '2026-06-16T12:00:00.000Z', from: '2026-02-01', to: END };

/** eodPayload's OHLCV, newest first, on session dates ending at `end`. */
function tradingPayload({ end = END, n = 90 } = {}) {
  const dates = sessionDatesBack(end, n);
  return eodPayload(n).map((row, i) => ({ ...row, date: dates[i] }));
}

/** Rows given explicitly are used as they are; otherwise the payload goes through mapDailyRows (+ attachAdjustedClose unless withAdjusted is false). */
function build(payload, { asOf = END, now = DAY_AFTER, symbol = 'TEST', withAdjusted = true, minBars = MIN_COMPLETED_BARS, rows = null, ...rest } = {}) {
  const mapped = rows ?? (withAdjusted ? attachAdjustedClose(mapDailyRows(payload).rows, payload) : mapDailyRows(payload).rows);
  return buildDailyEvidence({ rows: mapped, asOf, now, minBars, source: 'eodhd_eod', sourceMeta: SOURCE_META, symbol, ...rest });
}

describe('expectedCompletedSession — the calendar before any row (resolution point 2)', () => {
  it('a weekend asOf is asOf_not_a_session', () => {
    expect(expectedCompletedSession({ asOf: '2026-06-13', now: DAY_AFTER })).toMatchObject({ ok: false, reason: 'asOf_not_a_session' });
  });
  it('a holiday asOf is asOf_not_a_session', () => {
    expect(expectedCompletedSession({ asOf: '2026-07-03', now: new Date('2026-07-10T12:00:00Z') })).toMatchObject({ ok: false, reason: 'asOf_not_a_session' });
  });
  it('an asOf outside the maintained years is calendar_missing', () => {
    expect(expectedCompletedSession({ asOf: '2025-06-13', now: DAY_AFTER })).toMatchObject({ ok: false, reason: 'calendar_missing' });
    expect(expectedCompletedSession({ asOf: 'not-a-date', now: DAY_AFTER })).toMatchObject({ ok: false, reason: 'calendar_missing' });
  });
  it('tomorrow is asOf_in_future', () => {
    expect(expectedCompletedSession({ asOf: '2026-06-16', now: new Date('2026-06-15T20:00:00Z') })).toMatchObject({ ok: false, reason: 'asOf_in_future', detail: { asOf: '2026-06-16', today: '2026-06-15' } });
  });
  it('today at 15:59 ET expects the previous session; at 16:00 ET today itself', () => {
    expect(expectedCompletedSession({ asOf: END, now: new Date('2026-06-15T19:59:00Z') })).toEqual({ ok: true, expected: '2026-06-12', completedSession: 'current_session_incomplete', asOf: END, today: END });
    expect(expectedCompletedSession({ asOf: END, now: new Date('2026-06-15T20:00:00Z') })).toEqual({ ok: true, expected: END, completedSession: 'complete', asOf: END, today: END });
  });
  it('an early-close date at 12:59 ET expects the previous session; at 13:00 ET that date', () => {
    // 27 Nov 2026 (the day after Thanksgiving) closes at 13:00 EST = 18:00Z; the session before it is 25 Nov.
    expect(expectedCompletedSession({ asOf: '2026-11-27', now: new Date('2026-11-27T17:59:00Z') })).toEqual({ ok: true, expected: '2026-11-25', completedSession: 'current_session_incomplete', asOf: '2026-11-27', today: '2026-11-27' });
    expect(expectedCompletedSession({ asOf: '2026-11-27', now: new Date('2026-11-27T18:00:00Z') })).toEqual({ ok: true, expected: '2026-11-27', completedSession: 'complete', asOf: '2026-11-27', today: '2026-11-27' });
  });
  it('a past asOf is complete whatever the clock reads', () => {
    expect(expectedCompletedSession({ asOf: '2026-06-10', now: new Date('2026-06-15T13:30:00Z') })).toMatchObject({ ok: true, expected: '2026-06-10', completedSession: 'complete' });
  });
  it('today is the ET date, not the UTC date: at 22:00 ET on the 15th (02:00Z on the 16th) the 16th is still in the future (review TE3-4)', () => {
    const now = new Date('2026-06-16T02:00:00Z');
    expect(expectedCompletedSession({ asOf: '2026-06-16', now })).toMatchObject({ ok: false, reason: 'asOf_in_future', detail: { asOf: '2026-06-16', today: '2026-06-15' } });
    expect(expectedCompletedSession({ asOf: '2026-06-15', now })).toMatchObject({ ok: true, expected: '2026-06-15', completedSession: 'complete', today: '2026-06-15' });
  });
  it('today before the close with no maintained previous session is calendar_missing, named, and never a missing_bar (review TE3-6)', () => {
    const now = new Date('2026-01-02T15:00:00Z');
    expect(expectedCompletedSession({ asOf: '2026-01-02', now })).toEqual({ ok: false, reason: 'calendar_missing', detail: { asOf: '2026-01-02', today: '2026-01-02', why: 'previous_session_outside_maintained_years' } });
    expect(build(tradingPayload({ end: '2026-01-02' }), { asOf: '2026-01-02', now })).toMatchObject({ ok: false, reason: 'calendar_missing', detail: { why: 'previous_session_outside_maintained_years' }, expected: null });
  });
  it('the clock is injected: a missing or invalid now throws, never falls back to Date.now()', () => {
    expect(() => expectedCompletedSession({ asOf: END })).toThrow(TypeError);
    expect(() => expectedCompletedSession({ asOf: END, now: new Date('garbage') })).toThrow(TypeError);
    expect(() => buildDailyEvidence({ rows: [], asOf: END, minBars: 55 })).toThrow(TypeError);
  });
});

describe('the expected row (resolution point 2) and the window', () => {
  it('today before the close: the current row is dropped and the previous session is the window\'s asOf', () => {
    const r = build(tradingPayload(), { now: new Date('2026-06-15T19:59:00Z') });
    expect(r.ok).toBe(true);
    expect(r.asOf).toBe('2026-06-12');
    expect(r.requestedAsOf).toBe(END);
    expect(r.dropped).toBe(1);
    expect(r.checks.completedSession).toBe('current_session_incomplete');
    expect(r.bars[0].date).toBe('2026-06-12');
  });
  it('today at the close: the current row is the window\'s asOf', () => {
    const r = build(tradingPayload(), { now: new Date('2026-06-15T20:00:00Z') });
    expect(r.ok).toBe(true);
    expect([r.asOf, r.dropped, r.checks.completedSession]).toEqual([END, 0, 'complete']);
  });
  it('the current row present but the expected previous-session row missing is missing_bar with the expected date and the older row, never a fallback', () => {
    const payload = tradingPayload().filter((row) => row.date !== '2026-06-12');
    const r = build(payload, { now: new Date('2026-06-15T19:59:00Z') });
    expect(r).toMatchObject({ ok: false, reason: 'missing_bar', detail: { expected: '2026-06-12', latest: '2026-06-11' }, asOf: END, expected: '2026-06-12', basis: 'raw', evidenceClass: { bars: 'later_reconstruction' } });
  });
  it('every refusal carries the requested asOf, the expected session once the calendar named it, the bars class and one checks shape (reviews TE2-7, TE5-2, TEV2-1)', () => {
    expect(build(tradingPayload(), { symbol: 'BTC-USD.CC' })).toMatchObject({ expected: null, evidenceClass: { bars: 'later_reconstruction' }, checks: { completedSession: null, adjacency: null, splitCheck: null, splitCheckReason: null } });
    expect(build(tradingPayload({ n: 40 }))).toMatchObject({ reason: 'insufficient_history', asOf: END, expected: END, evidenceClass: { bars: 'later_reconstruction' }, checks: { completedSession: 'complete', adjacency: null } });
    expect(build(tradingPayload(), { barsClass: 'contemporaneous', symbol: 'BTC' })).toMatchObject({ evidenceClass: { bars: 'contemporaneous' } });
    expect(build(tradingPayload(), { asOf: '2026-02-30' })).toMatchObject({ reason: 'calendar_missing', detail: { why: 'malformed_date' }, checks: { completedSession: null } });
    expect(build(tradingPayload(), { asOf: '2025-06-13' }).detail).not.toHaveProperty('why');
  });
  it('rows dated after today\'s ET date are dropped and counted apart (review TEV2-3)', () => {
    const payload = tradingPayload();
    const future = [{ ...payload[0], date: '2026-06-17' }, { ...payload[0], date: '2026-06-16' }, ...payload];
    const r = build(future, { now: new Date('2026-06-15T20:00:00Z') });
    expect(r.ok).toBe(true);
    expect([r.dropped, r.droppedAfterToday]).toEqual([2, 2]);
    const r2 = build(payload, { now: new Date('2026-06-15T19:59:00Z') });
    expect([r2.dropped, r2.droppedAfterToday]).toEqual([1, 0]);
  });
  it('an asOf newer than every row is missing_bar with latest = the newest row', () => {
    const r = build(tradingPayload({ end: '2026-06-12' }));
    expect(r).toMatchObject({ ok: false, reason: 'missing_bar', detail: { expected: END, latest: '2026-06-12' } });
  });
  it('a past asOf keeps its row and drops every later one', () => {
    const r = build(tradingPayload(), { asOf: '2026-06-10' });
    expect(r.ok).toBe(true);
    expect([r.asOf, r.dropped, r.bars[0].date]).toEqual(['2026-06-10', 3, '2026-06-10']);
  });
  it('54 rows is insufficient_history for a 55-bar window; exactly 55 rows is ok (review TEV3-1)', () => {
    const r = build(tradingPayload({ n: 54 }));
    expect(r).toMatchObject({ ok: false, reason: 'insufficient_history', detail: { required: 55, available: 54 } });
    const exact = build(tradingPayload({ n: 55 }));
    expect(exact.ok).toBe(true);
    expect(exact.bars).toHaveLength(55);
  });
  it('the window is exactly minBars rows, newest first', () => {
    const r = build(tradingPayload({ n: 90 }));
    expect(r.ok).toBe(true);
    expect(r.bars).toHaveLength(MIN_COMPLETED_BARS);
    expect(r.bars[0].date).toBe(END);
    const r2 = build(tradingPayload({ n: 90 }), { minBars: 20 });
    expect(r2.bars).toHaveLength(20);
  });
  it('out-of-order rows are unordered_bars', () => {
    const payload = tradingPayload();
    [payload[5], payload[6]] = [payload[6], payload[5]];
    expect(build(payload)).toMatchObject({ ok: false, reason: 'unordered_bars', detail: { index: 6 } });
    const dup = [payload[0], ...tradingPayload()];
    expect(build(dup)).toMatchObject({ ok: false, reason: 'unordered_bars' });
  });
  it('a malformed date is unordered_bars', () => {
    const payload = tradingPayload();
    payload[3].date = '2026/06/10';
    expect(build(payload)).toMatchObject({ ok: false, reason: 'unordered_bars', detail: { why: 'malformed_date' } });
  });
});

describe('adjacency inside the maintained years', () => {
  it('a removed weekday inside the window is missing_bar, naming the gap', () => {
    const payload = tradingPayload();
    const gone = payload[10].date;
    const older = payload[11].date;
    const newer = payload[9].date;
    const r = build(payload.filter((row) => row.date !== gone));
    expect(r).toMatchObject({ ok: false, reason: 'missing_bar', detail: { expected: gone, latest: older, after: newer } });
  });
  it('the gap check reaches both edges of the window: the newest pair and the oldest pair (review TE3-3)', () => {
    const payload = tradingPayload();
    const newestGap = build(payload.filter((row) => row.date !== payload[1].date));
    expect(newestGap).toMatchObject({ ok: false, reason: 'missing_bar', detail: { expected: payload[1].date, latest: payload[2].date, after: payload[0].date } });
    const oldestGap = build(payload.filter((row) => row.date !== payload[54].date));
    expect(oldestGap).toMatchObject({ ok: false, reason: 'missing_bar', detail: { expected: payload[54].date, latest: payload[55].date, after: payload[53].date } });
    expect(build(payload.filter((row) => row.date !== payload[55].date)).ok).toBe(true); // the first row outside the window may be missing
  });
  it('weekend and holiday dates are not expected: the fixture\'s calendar-day rows refuse by name, and removing them gives ok (review TE2-4)', () => {
    const calendarDays = eodPayload(90); // consecutive calendar days ending 2026-06-15, weekends and Memorial Day included
    const sessionsOnly = calendarDays.filter((row) => getSessionForDate(row.date)?.isTradingDay === true);
    expect(calendarDays.length - sessionsOnly.length).toBeGreaterThan(20);
    expect(build(calendarDays)).toMatchObject({ ok: false, reason: 'unordered_bars', detail: { why: 'non_session_date', date: '2026-06-14' } });
    const r = build(sessionsOnly);
    expect(r.ok).toBe(true);
    expect(r.checks.adjacency).toBe('ok');
  });
  it('a vendor row dated on a Saturday inside the window is refused by name, not as a missing session (review TE2-2)', () => {
    const payload = tradingPayload();
    const saturday = { ...payload[1], date: '2026-06-13' };
    const withSaturday = [payload[0], saturday, ...payload.slice(1)];
    expect(build(withSaturday)).toMatchObject({ ok: false, reason: 'unordered_bars', detail: { why: 'non_session_date', date: '2026-06-13', index: 1 }, expected: END });
  });
  it('a window partly in 2025 reports adjacency not_available', () => {
    const r = build(tradingPayload({ end: '2026-01-15', n: 90 }), { asOf: '2026-01-15', now: new Date('2026-01-16T12:00:00Z') });
    expect(r.ok).toBe(true);
    expect(r.checks.adjacency).toBe('not_available');
    expect(r.bars[r.bars.length - 1].date < '2026-01-01').toBe(true);
  });
  it('a gap in the 2026 part of a partly-2025 window is still missing_bar', () => {
    const payload = tradingPayload({ end: '2026-01-15', n: 90 }).filter((row) => row.date !== '2026-01-08');
    const r = build(payload, { asOf: '2026-01-15', now: new Date('2026-01-16T12:00:00Z') });
    expect(r).toMatchObject({ ok: false, reason: 'missing_bar', detail: { expected: '2026-01-08' } });
  });
});

describe('prices and volumes inside the window', () => {
  it('a 0 close is missing_fact (it passes mapDailyRows as a finite number)', () => {
    const payload = tradingPayload();
    payload[4].close = 0; payload[4].adjusted_close = 0;
    const r = build(payload);
    expect(r).toMatchObject({ ok: false, reason: 'missing_fact', detail: { fact: 'close', date: payload[4].date, value: 0 } });
  });
  it('a negative low is missing_fact', () => {
    const payload = tradingPayload();
    payload[7].low = -1;
    expect(build(payload)).toMatchObject({ ok: false, reason: 'missing_fact', detail: { fact: 'low', date: payload[7].date, value: -1 } });
  });
  it('a zero or negative high is missing_fact (review TE3-5)', () => {
    const negative = tradingPayload();
    negative[4].high = -1;
    expect(build(negative)).toMatchObject({ ok: false, reason: 'missing_fact', detail: { fact: 'high', date: negative[4].date, value: -1 } });
    const zero = tradingPayload();
    zero[4].high = 0;
    expect(build(zero)).toMatchObject({ ok: false, reason: 'missing_fact', detail: { fact: 'high', date: zero[4].date, value: 0 } });
  });
  it('minBars is the caller\'s and must be a positive integer (review TE3-12)', () => {
    const rows = mapDailyRows(tradingPayload()).rows;
    for (const bad of [undefined, null, 0, -1, 1.5, '55']) {
      expect(() => buildDailyEvidence({ rows, asOf: END, now: DAY_AFTER, minBars: bad, source: 'eodhd_eod', symbol: 'TEST' }), String(bad)).toThrow(/positive integer/);
    }
    expect(buildDailyEvidence({ rows, asOf: END, now: DAY_AFTER, minBars: 55, source: 'eodhd_eod', symbol: 'TEST' }).ok).toBe(true);
  });
  it('a null raw close is missing_fact even when the adjusted close is present (never filled from it)', () => {
    const payload = tradingPayload();
    payload[9].close = null; // adjusted_close stays finite, so mapDailyRows keeps the row with rawClose null
    const mapped = mapDailyRows(payload).rows;
    expect(mapped[9]).toMatchObject({ close: payload[9].adjusted_close, rawClose: null });
    expect(build(payload)).toMatchObject({ ok: false, reason: 'missing_fact', detail: { fact: 'close', date: payload[9].date, value: null } });
  });
  it('a bad price OUTSIDE the window does not refuse', () => {
    const payload = tradingPayload();
    payload[70].low = -1;
    expect(build(payload).ok).toBe(true);
  });
  it.each([
    ['null', null, 'null'], ['zero', 0, 'zero'], ['negative', -5, 'negative'],
  ])('a %s volume is ok, the value preserved and classified with reason %s', (_label, value, reason) => {
    const payload = tradingPayload();
    payload[6].volume = value;
    const r = build(payload);
    expect(r.ok).toBe(true);
    expect(r.bars[6].volume).toBe(value);
    expect(r.bars[6].volumeClass).toEqual({ usable: false, reason });
    expect(r.bars[5].volumeClass).toEqual({ usable: true, reason: null });
  });
  it('a non-finite volume (which mapDailyRows itself turns into null) is classified non_finite when handed directly', () => {
    const payload = tradingPayload();
    const rows = attachAdjustedClose(mapDailyRows(payload).rows, payload).map((row, i) => (i === 6 ? { ...row, volume: Number.NaN } : row));
    const r = build(payload, { rows });
    expect(r.ok).toBe(true);
    expect(Number.isNaN(r.bars[6].volume)).toBe(true);
    expect(r.bars[6].volumeClass).toEqual({ usable: false, reason: 'non_finite' });
  });
  it('a crypto symbol is unsupported_symbol_class before anything is read', () => {
    expect(build(tradingPayload(), { symbol: 'BTC-USD.CC' })).toMatchObject({ ok: false, reason: 'unsupported_symbol_class', detail: { symbol: 'BTC-USD.CC' } });
    expect(build([], { symbol: 'BTC' })).toMatchObject({ ok: false, reason: 'unsupported_symbol_class' });
  });
});

describe('adjustment provenance and the split heuristic (resolution point 3)', () => {
  it('rows without an adjustedClose key: metadata absent, splitCheck not_available, even when every close equals its raw close', () => {
    const payload = tradingPayload();
    const mapped = mapDailyRows(payload).rows;
    expect(mapped.every((row) => row.close === row.rawClose)).toBe(true);
    const r = build(payload, { withAdjusted: false });
    expect(r.ok).toBe(true);
    expect(r.adjustment).toEqual({ metadata: 'absent', missingDates: [] });
    expect(r.checks).toMatchObject({ splitCheck: 'not_available', splitCheckReason: 'adjustment_metadata_absent' });
    expect(r.bars[0]).not.toHaveProperty('adjustedClose');
  });
  it('adjustedClose null on two dates: metadata absent listing them, splitCheck not_available', () => {
    const payload = tradingPayload();
    const d1 = payload[3].date; const d2 = payload[30].date;
    const thin = payload.map((row) => (row.date === d1 ? { ...row, adjusted_close: undefined } : row.date === d2 ? { ...row, adjusted_close: 'n/a' } : row));
    const r = build(payload, { rows: attachAdjustedClose(mapDailyRows(payload).rows, thin) });
    expect(r.ok).toBe(true);
    expect(r.adjustment).toEqual({ metadata: 'absent', missingDates: [d1, d2] });
    expect(r.checks).toMatchObject({ splitCheck: 'not_available', splitCheckReason: 'adjusted_close_missing' });
  });
  it('a missing adjustedClose outside the window does not matter', () => {
    const payload = tradingPayload();
    const thin = payload.map((row, i) => (i === 70 ? { ...row, adjusted_close: null } : row));
    const r = build(payload, { rows: attachAdjustedClose(mapDailyRows(payload).rows, thin) });
    expect(r.adjustment).toEqual({ metadata: 'present', missingDates: [] });
  });
  it('all present: the heuristic runs and passes on an unadjusted series', () => {
    const r = build(tradingPayload());
    expect(r.adjustment).toEqual({ metadata: 'present', missingDates: [] });
    expect(r.checks).toMatchObject({ splitCheck: 'heuristic_ok', splitCheckReason: null });
  });
  /** The raw prices before index k scaled by `factor` (pre-split prints), the adjusted close continuous. */
  const splitAt = (payload, k, factor) => payload.map((row, i) => (i >= k ? { ...row, open: row.open * factor, high: row.high * factor, low: row.low * factor, close: row.close * factor } : row));
  it('a 2:1 split inside the window is basis_discontinuity with the ratios on either side', () => {
    const payload = splitAt(tradingPayload(), 10, 2);
    const r = build(payload);
    expect(r).toMatchObject({ ok: false, reason: 'basis_discontinuity', detail: { date: payload[9].date, ratioBefore: 0.5, ratioAfter: 1 }, checks: { splitCheck: 'tripped' }, adjustment: { metadata: 'present' } });
  });
  it('the same split older than the window is not seen: ok', () => {
    const r = build(splitAt(tradingPayload(), 60, 2));
    expect(r.ok).toBe(true);
    expect(r.checks.splitCheck).toBe('heuristic_ok');
  });
  it('a 1:10 reverse split inside the window trips the heuristic', () => {
    const r = build(splitAt(tradingPayload(), 20, 0.1));
    expect(r).toMatchObject({ ok: false, reason: 'basis_discontinuity', checks: { splitCheck: 'tripped' } });
    expect(r.detail.ratioBefore).toBeCloseTo(10, 9);
    expect(r.detail.ratioAfter).toBe(1);
  });
  it('a 3% dividend step stays under the 10% jump: ok', () => {
    const payload = tradingPayload().map((row, i) => (i >= 15 ? { ...row, adjusted_close: row.close * 0.97 } : row));
    const r = build(payload);
    expect(r.ok).toBe(true);
    expect(r.checks.splitCheck).toBe('heuristic_ok');
    expect(SPLIT_RATIO_JUMP).toBe(0.10);
  });
  it('the threshold is symmetric: a 9.5% step is ok in either direction, 11% trips in either (review TE2-5)', () => {
    const step = (factor) => tradingPayload().map((row, i) => (i >= 15 ? { ...row, adjusted_close: row.close * factor } : row));
    expect(build(step(0.905)).ok).toBe(true);
    expect(build(step(1 / 0.905)).ok).toBe(true);
    expect(build(step(0.89))).toMatchObject({ ok: false, reason: 'basis_discontinuity' });
    expect(build(step(1 / 0.89))).toMatchObject({ ok: false, reason: 'basis_discontinuity' });
  });
  it('a special dividend above 10% trips it (the stated limit)', () => {
    const payload = tradingPayload().map((row, i) => (i >= 15 ? { ...row, adjusted_close: row.close * 0.88 } : row));
    expect(build(payload)).toMatchObject({ ok: false, reason: 'basis_discontinuity' });
  });
  it('a zero or negative adjusted close is not metadata: absent with reason adjusted_close_nonpositive, the heuristic never runs (review TE2-1)', () => {
    const allZero = tradingPayload().map((row) => ({ ...row, adjusted_close: 0 }));
    const r = build(allZero);
    expect(r.ok).toBe(true);
    expect(r.adjustment.metadata).toBe('absent');
    expect(r.adjustment.missingDates).toHaveLength(55);
    expect(r.checks).toMatchObject({ splitCheck: 'not_available', splitCheckReason: 'adjusted_close_nonpositive' });
    const oneZero = tradingPayload().map((row, i) => (i === 9 ? { ...row, adjusted_close: 0 } : row));
    const r2 = build(oneZero);
    expect(r2.ok).toBe(true);
    expect(r2.adjustment).toEqual({ metadata: 'absent', missingDates: [oneZero[9].date] });
    expect(r2.checks.splitCheckReason).toBe('adjusted_close_nonpositive');
    const negative = tradingPayload().map((row) => ({ ...row, adjusted_close: -row.close }));
    expect(build(negative).checks.splitCheckReason).toBe('adjusted_close_nonpositive');
    const mixed = tradingPayload().map((row, i) => (i === 3 ? { ...row, adjusted_close: null } : i === 4 ? { ...row, adjusted_close: 0 } : row));
    const r3 = build(mixed);
    expect(r3.adjustment.missingDates).toEqual([mixed[3].date, mixed[4].date]);
    expect(r3.checks.splitCheckReason).toBe('adjusted_close_missing'); // a missing value outranks a non-positive one in the reason
  });
});

describe('attachAdjustedClose', () => {
  it('matches by date, sets null where adjusted_close is missing or non-finite, and leaves the rows otherwise identical and unmutated', () => {
    const payload = tradingPayload({ n: 6 });
    const thin = [
      { ...payload[0] },
      { ...payload[1], adjusted_close: undefined },
      { ...payload[2], adjusted_close: 'abc' },
      { ...payload[3], adjusted_close: '123.5' },
      // payload[4] absent from the payload entirely
      { ...payload[5] },
    ];
    const rows = mapDailyRows(payload).rows;
    const before = JSON.stringify(rows);
    const out = attachAdjustedClose(rows, thin);
    expect(out.map((r) => r.adjustedClose)).toEqual([payload[0].close, null, null, 123.5, null, payload[5].close]);
    out.forEach((r, i) => {
      const { adjustedClose, ...rest } = r;
      void adjustedClose;
      expect(rest).toEqual(rows[i]);
    });
    expect(JSON.stringify(rows)).toBe(before);
    expect(out[0]).not.toBe(rows[0]);
  });
  it('the first payload row wins a duplicate date', () => {
    const payload = tradingPayload({ n: 3 });
    const out = attachAdjustedClose(mapDailyRows(payload).rows, [{ date: payload[0].date, adjusted_close: 1 }, { date: payload[0].date, adjusted_close: 2 }]);
    expect(out[0].adjustedClose).toBe(1);
  });
});

describe('the ok result and the end-to-end record', () => {
  it('every ok result carries basis, source, sourceMeta, checks.completedSession, evidenceClass and asOf = bars[0].date', () => {
    for (const r of [build(tradingPayload()), build(tradingPayload(), { asOf: '2026-06-05' }), build(tradingPayload(), { now: new Date('2026-06-15T19:59:00Z') })]) {
      expect(r.ok).toBe(true);
      expect(r.basis).toBe(BASIS);
      expect(r.source).toBe('eodhd_eod');
      expect(r.sourceMeta).toEqual(SOURCE_META);
      expect(['complete', 'current_session_incomplete']).toContain(r.checks.completedSession);
      expect(r.evidenceClass).toEqual({ bars: 'later_reconstruction' });
      expect(r.asOf).toBe(r.bars[0].date);
      expect(r.symbol).toBe('TEST');
    }
    expect(build(tradingPayload(), { barsClass: 'contemporaneous' }).evidenceClass).toEqual({ bars: 'contemporaneous' });
    expect(ADAPTER_REFUSALS).toHaveLength(9);
  });
  it('the window\'s bars are raw: close is the raw close, never the adjusted one', () => {
    const payload = tradingPayload().map((row) => ({ ...row, adjusted_close: row.close * 0.5 }));
    const mapped = mapDailyRows(payload).rows;
    expect(mapped[0].close).toBe(payload[0].close * 0.5); // mapDailyRows prefers the adjusted close…
    const r = build(payload);
    expect(r.ok).toBe(true);
    expect(r.bars[0].close).toBe(payload[0].close); // …the adapter reads rawClose
    expect(r.bars[0].adjustedClose).toBe(payload[0].close * 0.5);
  });
  it('adapter → entry end to end gives the pinned record for the fixture series', () => {
    const r = evaluateTfEntry(build(tradingPayload()));
    expect([r.verdict, r.reason, r.pattern, r.regime]).toEqual(['invalid', 'regime', null, 'downtrend']);
    expect(Object.fromEntries(Object.entries(r.factsUsed).map(([k, v]) => [k, v.value]))).toEqual({
      C: 120, SMA_fast: 123.3276, SMA_slow: 128.7582, SMA_slow_5ago: 130.2485, swingHigh: 128.8735, swingLow: 119.739, ATR: 2.4, V: 4_000_000, V_avg: 4_240_000,
    });
    expect(r.missing).toEqual([]);
    expect(r.patterns).toEqual({ breakout: 'failed', pullback_resume: 'failed' });
    expect(r.evidence.adjustment).toEqual({ metadata: 'present', missingDates: [] });
    expect(r.evidenceClass).toEqual({ bars: 'later_reconstruction', verdict: 'derived' });
    expect(r.asOf).toBe(END);
    expect(r.sourceMeta).toEqual(SOURCE_META);
    expect(r.evidence.bars).toEqual({ count: 55, newest: END, oldest: sessionDatesBack(END, 55)[54] });
  });
  it('a refusal flows through the evaluator as unknown with the typed reason', () => {
    const r = evaluateTfEntry(build(tradingPayload({ n: 40 })));
    expect([r.verdict, r.reason]).toEqual(['unknown', 'insufficient_history']);
    expect(r.refusal.detail).toEqual({ required: 55, available: 40 });
  });
});

describe('provenance on refused evidence (closeout, 28 Oct 2026)', () => {
  const BEFORE_CLOSE = new Date('2026-06-15T19:59:00Z'); // 3:59 PM ET on END: the expected session is the previous one
  /** Each refusal path, early (before the calendar names a session) and late, with the requested and expected dates it must keep apart. */
  const REFUSALS = [
    ['unsupported_symbol_class', END, null, (o) => build(tradingPayload(), { symbol: 'BTC-USD.CC', ...o })],
    ['calendar_missing', '2026-02-30', null, (o) => build(tradingPayload(), { asOf: '2026-02-30', ...o })],
    ['asOf_not_a_session', '2026-06-13', null, (o) => build(tradingPayload(), { asOf: '2026-06-13', ...o })],
    ['asOf_in_future', '2026-06-16', null, (o) => build(tradingPayload(), { asOf: '2026-06-16', now: new Date('2026-06-15T20:00:00Z'), ...o })],
    ['missing_bar', END, '2026-06-12', (o) => build(tradingPayload().filter((row) => row.date !== '2026-06-12'), { now: BEFORE_CLOSE, ...o })],
    ['unordered_bars', END, END, (o) => {
      const payload = tradingPayload();
      const rows = attachAdjustedClose(mapDailyRows(payload).rows, payload);
      [rows[1], rows[2]] = [rows[2], rows[1]];
      return build(payload, { rows, ...o });
    }],
    ['insufficient_history', END, '2026-06-12', (o) => build(tradingPayload({ n: 40 }), { now: BEFORE_CLOSE, ...o })],
    ['missing_fact', END, END, (o) => { const p = tradingPayload(); p[4].close = 0; p[4].adjusted_close = 0; return build(p, o); }],
    ['basis_discontinuity', END, END, (o) => build(tradingPayload().map((row, i) => (i >= 10 ? { ...row, open: row.open * 2, high: row.high * 2, low: row.low * 2, close: row.close * 2 } : row)), o)],
  ];
  const withoutMeta = ({ sourceMeta, ...rest }) => { void sourceMeta; return rest; };

  it('the table covers all nine adapter refusals', () => {
    expect(REFUSALS.map(([reason]) => reason).sort()).toEqual([...ADAPTER_REFUSALS].sort());
  });

  it.each(REFUSALS)('%s keeps the supplied sourceMeta (a copy) and both dates, through the entry and the holding record', (reason, requested, expected, make) => {
    const ev = make({});
    expect([ev.ok, ev.reason]).toEqual([false, reason]);
    expect(ev.sourceMeta).toEqual(SOURCE_META);
    expect(ev.sourceMeta).not.toBe(SOURCE_META);
    expect([ev.asOf, ev.expected]).toEqual([requested, expected]);
    if (reason === 'basis_discontinuity') expect(ev.adjustment).toEqual({ metadata: 'present', missingDates: [] });

    const entry = evaluateTfEntry(ev);
    const holding = evaluateTfHolding(ev, { anchorSwingLow: 90 });
    for (const rec of [entry, holding]) {
      expect(rec.sourceMeta).toEqual(SOURCE_META);
      expect(rec.sourceMeta).not.toBe(ev.sourceMeta);
      expect([rec.asOf, rec.requestedAsOf]).toEqual([requested, requested]);
      expect(rec.refusal).toMatchObject({ reason, expected });
      expect(rec.evidenceClass).toEqual({ bars: 'later_reconstruction', verdict: 'derived' });
    }
    expect([entry.verdict, entry.reason, entry.pattern, entry.regime]).toEqual(['unknown', reason, null, 'unknown']);
    expect([holding.chartLeg, holding.reasons, holding.regime]).toEqual(['unknown', [], 'unknown']);
  });

  it.each(REFUSALS)('%s without sourceMeta carries null, never an invented one, and the records differ only there', (reason, requested, expected, make) => {
    const ev = make({ sourceMeta: null });
    expect(ev.sourceMeta).toBeNull();
    const withMeta = make({});
    for (const evaluate of [(e) => evaluateTfEntry(e), (e) => evaluateTfHolding(e, { anchorSwingLow: 90 })]) {
      const bare = evaluate(ev);
      expect(bare.sourceMeta).toBeNull();
      expect(withoutMeta(bare)).toEqual(withoutMeta(evaluate(withMeta))); // provenance never changes a verdict, a check or a date
    }
  });

  it('a partial sourceMeta keeps only the keys it came with, on a refusal and on an ok result; none supplied is null', () => {
    const partial = { fetchedAt: '2026-06-16T12:00:00.000Z' };
    expect(build(tradingPayload({ n: 40 }), { sourceMeta: partial }).sourceMeta).toEqual(partial);
    expect(build(tradingPayload(), { sourceMeta: partial }).sourceMeta).toEqual(partial);
    const payload = tradingPayload();
    const rows = attachAdjustedClose(mapDailyRows(payload).rows, payload);
    expect(buildDailyEvidence({ rows, asOf: END, now: DAY_AFTER, minBars: MIN_COMPLETED_BARS }).sourceMeta).toBeNull();
    expect(buildDailyEvidence({ rows: rows.slice(0, 40), asOf: END, now: DAY_AFTER, minBars: MIN_COMPLETED_BARS }).sourceMeta).toBeNull();
    expect(evaluateTfEntry(buildDailyEvidence({ rows: rows.slice(0, 40), asOf: END, now: DAY_AFTER, minBars: MIN_COMPLETED_BARS })).sourceMeta).toBeNull();
  });

  it('an ok result copies sourceMeta, and its records keep the session as asOf and the request as requestedAsOf', () => {
    expect(build(tradingPayload()).sourceMeta).not.toBe(SOURCE_META);
    const ev = build(tradingPayload(), { now: BEFORE_CLOSE });
    expect([ev.ok, ev.asOf, ev.requestedAsOf]).toEqual([true, '2026-06-12', END]);
    for (const rec of [evaluateTfEntry(ev), evaluateTfHolding(ev)]) {
      expect([rec.asOf, rec.requestedAsOf]).toEqual(['2026-06-12', END]);
      expect(rec.sourceMeta).toEqual(SOURCE_META);
      expect(rec).not.toHaveProperty('refusal');
    }
    const complete = evaluateTfEntry(build(tradingPayload()));
    expect([complete.asOf, complete.requestedAsOf]).toEqual([END, END]);
  });

  it('the bars class: the adapter defaults to later_reconstruction on every result, never synthetic; only the synthetic fixture is synthetic (Q-TE-4)', () => {
    expect(build(tradingPayload()).evidenceClass).toEqual({ bars: 'later_reconstruction' });
    expect(build(tradingPayload({ n: 40 })).evidenceClass).toEqual({ bars: 'later_reconstruction' });
    expect(evidenceOf(buildBars()).evidenceClass).toEqual({ bars: 'synthetic' });
    expect(evaluateTfEntry(evidenceOf(buildBars())).evidenceClass).toEqual({ bars: 'synthetic', verdict: 'derived' });
  });
});

describe('the split heuristic at its exact boundary (the fix round after Astra\'s review, F1)', () => {
  const ASTRA_END = '2026-10-09';
  const ASTRA_NOW = new Date('2026-10-10T12:00:00Z');
  /** Astra's reproduction: 55 adjacent sessions to 2026-10-09; bar 0 raw close `close0` with adjusted `adj0`, every other bar raw `closeOthers` with adjusted `adjOthers`; high/low = close ± 1% (101 / 99 at 100, as the review's; a fixed ± 1 would make a low of 0 at a close of 1, a missing_fact before the split step). */
  function flat({ adj0, adjOthers, close0 = 100, closeOthers = 100, n = 55 }) {
    return sessionDatesBack(ASTRA_END, n).map((date, i) => {
      const close = i === 0 ? close0 : closeOthers;
      return { date, open: close, high: close * 1.01, low: close * 0.99, close, adjusted_close: i === 0 ? adj0 : adjOthers, volume: 1_000_000 };
    });
  }
  const buildFlat = (opts) => build(flat(opts), { asOf: ASTRA_END, now: ASTRA_NOW });

  it.each([
    ['72 on bar 0, 80 before it', { adj0: 72, adjOthers: 80 }],
    ['80 on bar 0, 72 before it (reversed)', { adj0: 80, adjOthers: 72 }],
  ])('recreated Astra regression F1: adjusted closes %s on raw closes 100 — exactly 10% is not above 10%, so the window evaluates', (label, opts) => {
    const ev = buildFlat(opts);
    expect(ev.ok).toBe(true);
    expect(ev.checks.splitCheck).toBe('heuristic_ok');
    expect(ev.adjustment).toEqual({ metadata: 'present', missingDates: [] });
    const entry = evaluateTfEntry(ev);
    expect([entry.verdict, entry.reason, entry.regime]).toEqual(['invalid', 'regime', 'no_trend']);
    expect(evaluateTfHolding(ev, { anchorSwingLow: 90 }).chartLeg).toBe('intact');
  });

  it.each([
    ['genuinely above 10% (71.99 against 80)', { adj0: 71.99, adjOthers: 80 }, 'tripped'],
    ['genuinely above 10%, reversed (80 against 71.99)', { adj0: 80, adjOthers: 71.99 }, 'tripped'],
    ['genuinely below 10% (72.01 against 80)', { adj0: 72.01, adjOthers: 80 }, 'heuristic_ok'],
    ['genuinely below 10%, reversed (80 against 72.01)', { adj0: 80, adjOthers: 72.01 }, 'heuristic_ok'],
  ])('%s: %s', (label, opts, splitCheck) => {
    const ev = buildFlat(opts);
    expect(ev.checks.splitCheck).toBe(splitCheck);
    expect(ev.ok).toBe(splitCheck !== 'tripped');
  });

  /** Exact 10% steps between bar 0 and the rest: (adj0 / close0) is exactly 0.9 × (adjOthers / closeOthers). */
  const EXACT = [
    { adj0: 36, close0: 50, adjOthers: 80, closeOthers: 100 },
    { adj0: 9, close0: 10, adjOthers: 10, closeOthers: 10 },
    { adj0: 81, close0: 100, adjOthers: 90, closeOthers: 100 },
    { adj0: 0.27, close0: 1, adjOthers: 0.3, closeOthers: 1 },
    { adj0: 11.106, close0: 12.34, adjOthers: 12.34, closeOthers: 12.34 },
    { adj0: 49.95, close0: 55.5, adjOthers: 55.5, closeOthers: 55.5 },
    { adj0: 89.991, close0: 99.99, adjOthers: 99.99, closeOthers: 99.99 },
    { adj0: 111.1104, close0: 123.456, adjOthers: 123.456, closeOthers: 123.456 },
    { adj0: 12.6, close0: 14, adjOthers: 7, closeOthers: 7 },
    { adj0: 0.72, close0: 1, adjOthers: 0.8, closeOthers: 1 },
  ];
  const swap = ({ adj0, close0, adjOthers, closeOthers }) => ({ adj0: adjOthers, close0: closeOthers, adjOthers: adj0, closeOthers: close0 });

  it.each(EXACT)('an exact 10% step never trips, in both directions; one ten-thousandth further it does: %o', (pair) => {
    expect(buildFlat(pair).checks.splitCheck).toBe('heuristic_ok');
    expect(buildFlat(swap(pair)).checks.splitCheck).toBe('heuristic_ok');
    expect(buildFlat({ ...pair, adj0: Number((pair.adj0 - 0.0001).toFixed(6)) }).checks.splitCheck).toBe('tripped'); // the lower ratio a little lower: above 10%
    expect(buildFlat({ ...pair, adj0: Number((pair.adj0 + 0.0001).toFixed(6)) }).checks.splitCheck).toBe('heuristic_ok'); // a little higher: below 10%
  });

  it('a tripped step records both days\' raw and adjusted closes, so the refusal explains its own decision', () => {
    const ev = buildFlat({ adj0: 71.99, adjOthers: 80 });
    const [d0, d1] = sessionDatesBack(ASTRA_END, 2);
    expect(ev).toMatchObject({ ok: false, reason: 'basis_discontinuity' });
    expect(ev.detail).toMatchObject({ date: d0, after: { date: d0, close: 100, adjustedClose: 71.99 }, before: { date: d1, close: 100, adjustedClose: 80 } });
    expect(evaluateTfEntry(ev).refusal.detail.after).toEqual({ date: d0, close: 100, adjustedClose: 71.99 });
  });
});

describe('sourceMeta ownership: supported nested metadata is deep-copied (the fix round after Astra\'s review)', () => {
  const nested = () => ({ fetchedAt: '2026-06-16T12:00:00.000Z', from: '2026-02-01', to: END, context: { batch: 'original', tags: ['a', { k: 1 }] } });
  const PATHS = [
    ['an ok result', (o) => build(tradingPayload(), o)],
    ['a refusal', (o) => build(tradingPayload({ n: 40 }), o)],
  ];

  it.each(PATHS)('%s: a later change to the caller\'s nested metadata changes neither the evidence nor its records', (label, make) => {
    const meta = nested();
    const ev = make({ sourceMeta: meta });
    const entry = evaluateTfEntry(ev);
    const holding = evaluateTfHolding(ev);
    meta.context.batch = 'changed'; meta.context.tags.push('b'); meta.context.tags[1].k = 2; meta.fetchedAt = 'changed';
    for (const x of [ev, entry, holding]) expect(x.sourceMeta).toEqual(nested());
  });

  it.each(PATHS)('%s: a later change to the evidence\'s nested metadata does not change the records already made', (label, make) => {
    const ev = make({ sourceMeta: nested() });
    const entry = evaluateTfEntry(ev);
    const holding = evaluateTfHolding(ev);
    ev.sourceMeta.context.batch = 'changed'; ev.sourceMeta.context.tags.push('b'); ev.sourceMeta.context.tags[1].k = 2;
    for (const x of [entry, holding]) expect(x.sourceMeta).toEqual(nested());
  });

  it('ownership keeps the shape: null stays null; supplied keys stay as supplied, an undefined value included; scalars are unchanged', () => {
    for (const make of PATHS.map(([, m]) => m)) {
      expect(make({ sourceMeta: null }).sourceMeta).toBeNull();
      const partial = make({ sourceMeta: { fetchedAt: undefined, to: END } });
      expect(Object.keys(partial.sourceMeta)).toEqual(['fetchedAt', 'to']);
      expect(Object.keys(evaluateTfEntry(partial).sourceMeta)).toEqual(['fetchedAt', 'to']);
      expect(make({}).sourceMeta).toEqual(SOURCE_META);
    }
  });
});

describe('evidenceValues: exact decimals and owned copies (the fix round after Astra\'s review)', () => {
  it('reads each double as the shortest decimal that round-trips, the exponent forms String() emits included', () => {
    expect(toDecimal(0.72)).toEqual({ m: 72n, e: -2 });
    expect(toDecimal(100)).toEqual({ m: 100n, e: 0 });
    expect(toDecimal(1e21)).toEqual({ m: 1n, e: 21 });
    expect(toDecimal(1.5e-7)).toEqual({ m: 15n, e: -8 });
    expect(toDecimal(-2.25)).toEqual({ m: -225n, e: -2 });
    expect(toDecimal(-0)).toEqual({ m: 0n, e: 0 });
    for (const bad of [NaN, Infinity, -Infinity, null, undefined, '1']) expect(toDecimal(bad)).toBeNull();
    for (const x of [0.1, 109.54, 4.77, 123.3276, 1e21, 1.5e-7, 2423634.375, 5e-324, Number.MAX_VALUE]) expect(toNumber(toDecimal(x))).toBe(x);
  });

  it('the three boundaries, exactly: 100 + 2 × 4.77 = 109.54; 1.5 × 2.2 = 3.3; 72 · 100 = 0.9 · (80 · 100)', () => {
    expect(100 + 2 * 4.77).toBe(109.53999999999999); // what the old code recorded
    expect(toNumber(addDecimal(toDecimal(100), multiplyDecimal(toDecimal(2), toDecimal(4.77))))).toBe(109.54);
    expect(1.5 * 2.2).toBe(3.3000000000000003);
    expect(toNumber(multiplyDecimal(toDecimal(1.5), toDecimal(2.2)))).toBe(3.3);
    const keep = subtractDecimal(toDecimal(1), toDecimal(0.1));
    expect(compareDecimal(multiplyDecimal(toDecimal(72), toDecimal(100)), multiplyDecimal(keep, multiplyDecimal(toDecimal(80), toDecimal(100))))).toBe(0);
    expect(compareDecimal(toDecimal(0.1), toDecimal(0.2))).toBe(-1);
    expect(compareDecimal(toDecimal(1e21), toDecimal(999999999999999900000))).toBe(1);
  });

  it('cross-multiplication is verified, not assumed: in floating point 2 × 3.3 >= 3 × 2.2 is false; exactly it is an equality', () => {
    expect(2 * 3.3 >= 3 * 2.2).toBe(false);
    expect(compareDecimal(multiplyDecimal(toDecimal(2), toDecimal(3.3)), multiplyDecimal(toDecimal(3), toDecimal(2.2)))).toBe(0);
  });

  it('divideByInteger is exact for a terminating quotient: the mean of twenty 0.1 is 0.1, not 0.10000000000000002', () => {
    let floatSum = 0;
    let exact = toDecimal(0);
    for (let i = 0; i < 20; i++) { floatSum += 0.1; exact = addDecimal(exact, toDecimal(0.1)); }
    expect(floatSum / 20).toBe(0.10000000000000002);
    expect(toNumber(divideByInteger(exact, 20))).toBe(0.1);
    expect(toNumber(divideByInteger(toDecimal(32315125), 20))).toBe(1615756.25); // integer volumes: the same double as sum / 20
    expect(divideByInteger(toDecimal(1), 3).e).toBe(-30); // a non-terminating quotient is rounded at 30 more digits (not reached: 20 terminates)
  });

  it('copyData: plain objects and arrays at every depth, undefined values kept, shared and cyclic references reproduced, other values carried as they are', () => {
    const shared = { k: 1 };
    const src = { a: { b: [1, { c: 2 }] }, u: undefined, s: shared, t: shared, d: new Date(0) };
    src.self = src;
    const out = copyData(src);
    expect(out).not.toBe(src);
    expect(out.a).not.toBe(src.a);
    expect(out.a.b).not.toBe(src.a.b);
    expect(out.a.b[1]).not.toBe(src.a.b[1]);
    expect(out.a.b).toEqual([1, { c: 2 }]);
    expect(Object.keys(out)).toEqual(['a', 'u', 's', 't', 'd', 'self']);
    expect(out.s).toBe(out.t);
    expect(out.s).not.toBe(shared);
    expect(out.self).toBe(out);
    expect(out.d).toBe(src.d); // not JSON-like: carried as it is, never refused
    expect(copyData(null)).toBeNull();
    expect(copyData('x')).toBe('x');
  });
});
