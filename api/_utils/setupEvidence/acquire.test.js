// api/_utils/setupEvidence/acquire.test.js
//
// ID-1 Build 1 — one acquisition, end to end with injected payloads: raw rows as
// EODHD sends them, through the REAL mapDailyRows, attachAdjustedClose, adapter and
// evaluator. No network, no emulator. "Refused" rows assert the reason, the
// disposition the store acts on, and that nothing re-sorted the payload.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL, unmocked imports of acquire.js,
// the adapter and marketDataCache.js are the runtime guard for this module's import
// graph, which reaches src/utils/marketCalendar.js. Never mock them.

import '../__fixtures__/pinTimezoneUtc.js';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { acquireOnce, barsClassOf, readClock, requestWindowOf, snapshotDocOf, sourceMetaOf, ACQUIRE_TIMEOUT_MS, EVIDENCE_SOURCE, REQUEST_LOOKBACK_CALENDAR_DAYS } from './acquire.js';
import { classifyAcquisitionFailure, classifyEvidence } from './classify.js';
import { getSessionForDate } from '../marketSchedule.js';
import { etWallClockToMs } from '../../../src/utils/marketCalendar.js';
import { describeRuleSet, MIN_COMPLETED_BARS } from '../setupEvaluator/thresholds.js';
import { tradingDates } from '../setupEvaluator/__fixtures__/syntheticBars.js';

const SESSION = '2026-10-28'; // a Wednesday
const CLOSE_MS = getSessionForDate(SESSION).closeMs;
const NEXT_CLOSE_MS = getSessionForDate('2026-10-29').closeMs;
const AFTER_CLOSE = new Date(CLOSE_MS + 3_600_000);

/** Raw `/eod/` rows, newest first, on real sessions: an uptrend on a fixed slope, adjusted = raw. */
function rawRows({ session = SESSION, n = 80 } = {}) {
  return tradingDates(n, session).map((date, i) => {
    const close = 100 - 0.25 * i;
    return { date, open: close, high: close + 1.5, low: close - 1.5, close, adjusted_close: close, volume: 1_000_000 };
  });
}

const clockAt = (date) => () => date;
/** A clock the fake provider moves: the request starts at `started`, the response lands at `received`. */
function timed(started, received, payload = rawRows()) {
  let current = started;
  return { now: () => new Date(current), fetchPayload: async () => { current = received; return payload; } };
}
/** The CTVA shape: the raw close doubles behind bar 6 while the adjusted close carries through. */
const splitRows = () => rawRows().map((r, i) => {
  const adjusted = 100 - 0.25 * i;
  const raw = i <= 6 ? adjusted : adjusted * 2;
  return { ...r, open: raw, high: raw + 1.5, low: raw - 1.5, close: raw, adjusted_close: adjusted };
});
/** A bar dated on a Saturday inside the window. */
const weekendBarRows = () => {
  const rows = rawRows();
  const friday = rows.findIndex((r) => r.date === '2026-10-23');
  rows.splice(friday, 0, { ...rows[friday], date: '2026-10-24' });
  return rows;
};
const acquire = (payload, { session = SESSION, symbol = 'NVDA', now = clockAt(AFTER_CLOSE) } = {}) => acquireOnce({ session, symbol, now, fetchPayload: async () => payload });
const evidenceOf = async (payload, options) => (await acquire(payload, options)).evidence;
const dispositionOf = async (payload, options = {}) => classifyEvidence(await evidenceOf(payload, options), { session: options.session ?? SESSION });

let savedKey;
beforeEach(() => { savedKey = process.env.EODHD_API_KEY; });
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.VERCEL_GIT_COMMIT_SHA;
  if (savedKey === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = savedKey;
});

describe('the request', () => {
  it('asks once, newest first, with the bounded timeout, 130 calendar days back to the session', async () => {
    const fetchPayload = vi.fn(async () => rawRows());
    await acquireOnce({ session: SESSION, symbol: 'NVDA', now: clockAt(AFTER_CLOSE), fetchPayload });
    expect(fetchPayload.mock.calls).toEqual([['NVDA', { from: '2026-06-20', to: SESSION, order: 'd', timeoutMs: 5_000 }]]);
    expect(ACQUIRE_TIMEOUT_MS).toBe(5_000);
    expect(REQUEST_LOOKBACK_CALENDAR_DAYS).toBe(130);
  });
  it.each([['2026-01-05'], ['2026-07-06'], ['2026-12-31'], ['2027-11-26']])('the request\'s reach holds 55 sessions, by the calendar where it reaches and by weekdays before it: %s', (session) => {
    const { from, to } = requestWindowOf(session);
    let sessions = 0;
    for (let t = Date.parse(`${from}T12:00:00Z`); t <= Date.parse(`${to}T12:00:00Z`); t += 86_400_000) {
      const date = new Date(t);
      const day = getSessionForDate(date.toISOString().slice(0, 10));
      if (day ? day.isTradingDay : date.getUTCDay() % 6 !== 0) sessions += 1;
    }
    expect(sessions).toBeGreaterThanOrEqual(MIN_COMPLETED_BARS + 10);
  });
  it('the date range is arithmetic on the date: neither DST nor the host\'s zone moves it', () => {
    const zone = process.env.TZ;
    try {
      for (const tz of ['UTC', 'America/New_York', 'Asia/Tokyo', 'Pacific/Kiritimati']) {
        process.env.TZ = tz;
        expect(requestWindowOf('2026-11-02')).toEqual({ from: '2026-06-25', to: '2026-11-02' });
      }
    } finally {
      process.env.TZ = zone;
    }
  });
});

describe('a clean payload', () => {
  it('a newest-first payload → ok, the window of 55, the session as asOf, split check run on the payload\'s adjusted close', async () => {
    const a = await acquire(rawRows());
    expect(a.failure).toBeUndefined();
    expect(a.evidence).toMatchObject({ ok: true, asOf: SESSION, requestedAsOf: SESSION, symbol: 'NVDA', source: EVIDENCE_SOURCE, basis: 'raw' });
    expect(a.evidence.bars).toHaveLength(MIN_COMPLETED_BARS);
    expect(a.evidence.bars[0].date).toBe(SESSION);
    expect(a.evidence.checks).toMatchObject({ completedSession: 'complete', adjacency: 'ok', splitCheck: 'heuristic_ok' });
    expect(a.evidence.adjustment).toEqual({ metadata: 'present', missingDates: [] });
    expect(classifyEvidence(a.evidence, { session: SESSION }).disposition).toBe('final');
  });
  it('the entry record is the evaluator\'s, on that evidence', async () => {
    const { entry } = await acquire(rawRows());
    expect(entry).toMatchObject({ asOf: SESSION, requestedAsOf: SESSION, verdict: 'invalid', reason: 'no_setup', regime: 'uptrend', ruleSet: describeRuleSet() });
  });
  it('the facts are read on the raw close, whatever the adjusted close says (FD-P3-2)', async () => {
    const rows = rawRows().map((r) => ({ ...r, adjusted_close: r.close * 0.98 }));
    const { entry } = await acquire(rows);
    expect(entry.factsUsed.C.value).toBe(100);
  });
});

describe('order: nothing re-sorts the payload', () => {
  it('the same bars oldest first are refused by the adapter\'s newest-row check: missing_bar naming the oldest bar, no `after`, retryable; a re-sort would have been ok', async () => {
    const rows = rawRows();
    const reversed = rows.slice().reverse();
    expect((await evidenceOf(rows)).ok).toBe(true);
    const ev = await evidenceOf(reversed);
    expect(ev).toMatchObject({ ok: false, reason: 'missing_bar', detail: { expected: SESSION, latest: reversed[0].date } });
    expect(ev.detail.after).toBeUndefined();
    expect(classifyEvidence(ev, { session: SESSION })).toMatchObject({ disposition: 'retryable', reason: 'missing_bar' });
  });
  it('out of order behind a correct newest row → unordered_bars, retryable, never re-sorted', async () => {
    const rows = rawRows();
    [rows[3], rows[4]] = [rows[4], rows[3]];
    const ev = await evidenceOf(rows);
    expect(ev).toMatchObject({ ok: false, reason: 'unordered_bars', detail: { index: 4 } });
    expect(ev.detail.why).toBeUndefined();
    expect((await dispositionOf(rows)).disposition).toBe('retryable');
  });
  it('duplicate dates → unordered_bars, retryable', async () => {
    const rows = rawRows();
    rows.splice(3, 0, { ...rows[3] });
    expect(await evidenceOf(rows)).toMatchObject({ ok: false, reason: 'unordered_bars', detail: { index: 4, date: rows[3].date, previous: rows[3].date } });
    expect((await dispositionOf(rows)).disposition).toBe('retryable');
  });
  it('a malformed date → unordered_bars why malformed_date, retryable', async () => {
    const rows = rawRows();
    rows[2] = { ...rows[2], date: 'not-a-date' };
    expect(await evidenceOf(rows)).toMatchObject({ ok: false, reason: 'unordered_bars', detail: { index: 2, why: 'malformed_date' } });
    expect((await dispositionOf(rows)).disposition).toBe('retryable');
  });
});

describe('every refusal class', () => {
  it('the newest session\'s bar is not published yet → missing_bar, retryable', async () => {
    const rows = rawRows().slice(1);
    expect(await evidenceOf(rows)).toMatchObject({ ok: false, reason: 'missing_bar', detail: { expected: SESSION, latest: rows[0].date } });
    expect((await dispositionOf(rows)).disposition).toBe('retryable');
  });
  it('an empty payload → missing_bar, retryable', async () => {
    expect(await evidenceOf([])).toMatchObject({ ok: false, reason: 'missing_bar', detail: { expected: SESSION, latest: null } });
    expect((await dispositionOf([])).disposition).toBe('retryable');
  });
  it('a gap inside the window → interior missing_bar, confirm', async () => {
    const rows = rawRows();
    const [newer, , older] = [rows[9], rows[10], rows[11]];
    rows.splice(10, 1);
    expect(await evidenceOf(rows)).toMatchObject({ ok: false, reason: 'missing_bar', detail: { expected: tradingDates(11, SESSION)[10], latest: older.date, after: newer.date } });
    expect((await dispositionOf(rows)).disposition).toBe('confirm');
  });
  it('a price the mapper cannot read drops the row, and the session reads as the gap → confirm, and the drop is logged', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rows = rawRows();
    rows[10] = { ...rows[10], high: 'n/a' };
    expect((await evidenceOf(rows)).reason).toBe('missing_bar');
    expect((await dispositionOf(rows)).disposition).toBe('confirm');
    expect(warn).toHaveBeenCalledWith(`[setupEvidence] NVDA ${SESSION}: mapDailyRows dropped 1 row(s) of 80`);
  });
  it('a bar dated on a weekend inside the window → unordered_bars non_session_date, confirm', async () => {
    const rows = weekendBarRows();
    expect(await evidenceOf(rows)).toMatchObject({ ok: false, reason: 'unordered_bars', detail: { date: '2026-10-24', why: 'non_session_date' } });
    expect((await dispositionOf(rows)).disposition).toBe('confirm');
  });
  it('a non-positive price inside the window → missing_fact, final', async () => {
    const rows = rawRows();
    rows[12] = { ...rows[12], low: 0 };
    expect(await evidenceOf(rows)).toMatchObject({ ok: false, reason: 'missing_fact', detail: { fact: 'low', date: rows[12].date, value: 0 } });
    expect((await dispositionOf(rows)).disposition).toBe('final');
  });
  it('a raw close that is null beside an adjusted one → missing_fact, final', async () => {
    const rows = rawRows();
    rows[12] = { ...rows[12], close: null };
    expect(await evidenceOf(rows)).toMatchObject({ ok: false, reason: 'missing_fact', detail: { fact: 'close', value: null } });
    expect((await dispositionOf(rows)).disposition).toBe('final');
  });
  it('a short history → insufficient_history, final: 54 sessions from a request that reached 130 days', async () => {
    const rows = rawRows({ n: 54 });
    expect(await evidenceOf(rows)).toMatchObject({ ok: false, reason: 'insufficient_history', detail: { required: 55, available: 54 } });
    expect((await dispositionOf(rows)).disposition).toBe('final');
  });
  it('exactly 55 sessions is enough', async () => {
    expect((await evidenceOf(rawRows({ n: 55 }))).ok).toBe(true);
  });
  it('a split step (the CTVA shape: raw close halves, adjusted carries through) → basis_discontinuity with both days recorded, final', async () => {
    const rows = splitRows();
    const ev = await evidenceOf(rows);
    expect(ev).toMatchObject({ ok: false, reason: 'basis_discontinuity', checks: { splitCheck: 'tripped' }, adjustment: { metadata: 'present' } });
    expect(ev.detail).toMatchObject({ date: rows[6].date, after: { date: rows[6].date, close: rows[6].close, adjustedClose: rows[6].adjusted_close }, before: { date: rows[7].date, close: rows[7].close, adjustedClose: rows[7].adjusted_close } });
    expect((await dispositionOf(rows)).disposition).toBe('final');
  });
  it('a missing adjusted close → ok evidence, the split check not available and the date named', async () => {
    const rows = rawRows();
    delete rows[8].adjusted_close;
    const ev = await evidenceOf(rows);
    expect(ev).toMatchObject({ ok: true, checks: { splitCheck: 'not_available', splitCheckReason: 'adjusted_close_missing' }, adjustment: { metadata: 'absent', missingDates: [rows[8].date] } });
    expect((await dispositionOf(rows)).disposition).toBe('final');
  });
  it('a request for a date past the clock → asOf_in_future, retryable', async () => {
    const ev = await evidenceOf(rawRows(), { now: clockAt(new Date(CLOSE_MS - 3 * 86_400_000)) });
    expect(ev).toMatchObject({ ok: false, reason: 'asOf_in_future' });
    expect(classifyEvidence(ev, { session: SESSION }).disposition).toBe('retryable');
  });
  it('an unmaintained year → calendar_missing, retryable', async () => {
    const ev = await evidenceOf(rawRows(), { session: '2028-01-03', now: clockAt(new Date('2028-01-04T12:00:00Z')) });
    expect(ev).toMatchObject({ ok: false, reason: 'calendar_missing' });
    expect(classifyEvidence(ev, { session: '2028-01-03' }).disposition).toBe('retryable');
  });
  it('a date that is no session → asOf_not_a_session, a programming error', async () => {
    const ev = await evidenceOf(rawRows(), { session: '2026-10-24' });
    expect(ev).toMatchObject({ ok: false, reason: 'asOf_not_a_session' });
    expect(classifyEvidence(ev, { session: '2026-10-24' }).disposition).toBe('programming_error');
  });
  it('crypto reaching the adapter → unsupported_symbol_class, a programming error: the guard before any call failed', async () => {
    const ev = await evidenceOf(rawRows(), { symbol: 'BTC' });
    expect(ev).toMatchObject({ ok: false, reason: 'unsupported_symbol_class' });
    expect(classifyEvidence(ev, { session: SESSION }).disposition).toBe('programming_error');
  });
  it('a session that had not closed at the response → the ok result names an older session: a programming error, never stored under this key', async () => {
    const before = new Date(CLOSE_MS - 1);
    const ev = await evidenceOf(rawRows(), { now: clockAt(before) });
    expect(ev).toMatchObject({ ok: true, asOf: '2026-10-27', requestedAsOf: SESSION });
    expect(classifyEvidence(ev, { session: SESSION })).toMatchObject({ disposition: 'programming_error', reason: 'asof_mismatch' });
  });
  it('an unfinished session with too few bars → a programming error, never a final insufficient_history', async () => {
    const ev = await evidenceOf(rawRows().slice(1, 10), { now: clockAt(new Date(CLOSE_MS - 1)) });
    expect(ev).toMatchObject({ ok: false, reason: 'insufficient_history', expected: '2026-10-27' });
    expect(classifyEvidence(ev, { session: SESSION })).toMatchObject({ disposition: 'programming_error', reason: 'session_incomplete' });
  });
});

describe('a window reaching before the calendar begins (the adapter\'s own limit, 54 sessions from 2026-01-02 to 2026-03-20)', () => {
  const SESSION_2026 = '2026-01-20';
  const NOW_2026 = clockAt(new Date('2026-01-21T12:00:00Z'));
  const HOLIDAYS = new Set(['2026-01-19', '2026-01-01', '2025-12-25', '2025-11-27']);
  /** Sessions newest first from 2026-01-20, by weekdays and the known holidays: the calendar stops at 2026. */
  function rowsAcrossTheYear(n = 80) {
    const rows = [];
    for (let t = Date.parse(`${SESSION_2026}T12:00:00Z`); rows.length < n; t -= 86_400_000) {
      const date = new Date(t).toISOString().slice(0, 10);
      if (new Date(t).getUTCDay() % 6 === 0 || HOLIDAYS.has(date)) continue;
      const close = 100 - 0.25 * rows.length;
      rows.push({ date, open: close, high: close + 1.5, low: close - 1.5, close, adjusted_close: close, volume: 1_000_000 });
    }
    return rows;
  }
  const dropDate = (rows, date) => rows.filter((r) => r.date !== date);
  const options = { session: SESSION_2026, now: NOW_2026 };

  it('a gap in the 2025 part cannot be seen: ok, final, with adjacency stated as not_available on the record', async () => {
    const rows = dropDate(rowsAcrossTheYear(), '2025-12-10');
    expect(await evidenceOf(rows, options)).toMatchObject({ ok: true, checks: { adjacency: 'not_available' } });
    expect((await dispositionOf(rows, options)).disposition).toBe('final');
  });
  it('a gap in the 2026 part still can: interior missing_bar, confirm', async () => {
    const rows = dropDate(rowsAcrossTheYear(), '2026-01-08');
    expect(await evidenceOf(rows, options)).toMatchObject({ ok: false, reason: 'missing_bar', detail: { expected: '2026-01-08', after: '2026-01-09' } });
    expect((await dispositionOf(rows, options)).disposition).toBe('confirm');
  });
});

describe('a payload whose defect the mapper would hide: malformed, retryable, never final', () => {
  const MALFORMED = { failure: 'malformed_payload', requestStartedAtMs: AFTER_CLOSE.getTime() };
  const withRow = (rows, at, row) => { const out = rows.slice(); out.splice(at, 0, row); return out; };
  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });

  it('an unreadable twin of a real session, on either side of the good row (the adapter sees no duplicate, the good row survives alone)', async () => {
    const rows = rawRows();
    expect(await acquire(withRow(rows, 3, { ...rows[3], high: null }))).toEqual(MALFORMED);
    expect(await acquire(withRow(rows, 4, { ...rows[3], high: null }))).toEqual(MALFORMED);
  });
  it('an unreadable twin ahead of a split: it would have blanked the good row\'s adjusted close and let the step through as ok', async () => {
    const rows = splitRows();
    expect((await evidenceOf(rows)).reason).toBe('basis_discontinuity');
    expect(await acquire(withRow(rows, 3, { ...rows[3], high: null, adjusted_close: null }))).toEqual(MALFORMED);
  });
  it('an unreadable twin with a stray adjusted close: it would have made a false basis_discontinuity, final on the first read', async () => {
    const rows = rawRows();
    expect(await acquire(withRow(rows, 3, { ...rows[3], high: null, adjusted_close: 1 }))).toEqual(MALFORMED);
  });
  it.each([
    ['a malformed date', { date: 'garbage', high: null }],
    ['a date that is not a string', { date: 20261020, high: null }],
    ['a date in an array', { date: ['2026-10-20'], high: null }],
    ['a date with a time on it', { date: '2026-10-20T00:00:00', high: null }],
    ['a date with a prefix', { date: 'x2026-10-20', high: null }],
    ['no date', { high: null }],
    ['a null row', null],
    ['a number', 5],
    ['a string', 'row'],
  ])('an unreadable row with %s', async (_label, row) => {
    expect(await acquire(withRow(rawRows(), 2, row))).toEqual(MALFORMED);
  });
  it.each([['open'], ['high'], ['low'], ['close'], ['adjusted_close'], ['volume']])('a field no number can be read from (%s): no throw', async (field) => {
    const rows = rawRows();
    rows[5] = { ...rows[5], [field]: JSON.parse('{"toString":1}') };
    expect(await acquire(rows)).toEqual(MALFORMED);
  });
  it('a lone unreadable row with a real date is not this: it reads as the gap it leaves', async () => {
    const rows = rawRows();
    rows[10] = { ...rows[10], high: null };
    expect((await acquire(rows)).evidence).toMatchObject({ ok: false, reason: 'missing_bar' });
  });
  it('a duplicate the mapper keeps is still the adapter\'s to refuse: nothing here steps in front of its check', async () => {
    const rows = rawRows();
    expect((await acquire(withRow(rows, 3, { ...rows[3] }))).evidence).toMatchObject({ ok: false, reason: 'unordered_bars' });
  });
});

describe('acquisition failures', () => {
  it.each([['an object', { errors: 'none' }], ['null', null], ['a string', 'rate limited'], ['a number', 3]])('a non-array payload (%s) → retryable, the adapter never runs', async (_label, payload) => {
    const a = await acquire(payload);
    expect(a).toEqual({ failure: 'non_array_payload', requestStartedAtMs: AFTER_CLOSE.getTime() });
    expect(classifyAcquisitionFailure(a.failure).disposition).toBe('retryable');
  });
  it.each([['a timeout', new DOMException('The operation was aborted due to timeout', 'TimeoutError')], ['a network failure', new TypeError('fetch failed')], ['a non-200', new Error('EODHD daily responded with 402')]])('%s → retryable, nothing evaluated', async (_label, error) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const a = await acquireOnce({ session: SESSION, symbol: 'NVDA', now: clockAt(AFTER_CLOSE), fetchPayload: async () => { throw error; } });
    expect(a).toEqual({ failure: 'fetch_failed', requestStartedAtMs: AFTER_CLOSE.getTime() });
    expect(classifyAcquisitionFailure(a.failure).disposition).toBe('retryable');
  });
});

describe('through the real shared request', () => {
  it('with no injected fetch: newest first, a signal, the bars through to ok', async () => {
    process.env.EODHD_API_KEY = 'k-5ecret';
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => rawRows() }));
    vi.stubGlobal('fetch', f);
    const a = await acquireOnce({ session: SESSION, symbol: 'NVDA', now: clockAt(AFTER_CLOSE) });
    expect(a.evidence.ok).toBe(true);
    expect(f.mock.calls[0][0]).toBe(`https://eodhd.com/api/eod/NVDA.US?api_token=k-5ecret&fmt=json&period=d&order=d&from=2026-06-20&to=${SESSION}`);
    expect(f.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it('a missing key and a failed fetch say so in the log, and the key never does', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    delete process.env.EODHD_API_KEY;
    const f = vi.fn(async (url) => { throw new TypeError(`fetch failed for ${url}`); });
    vi.stubGlobal('fetch', f);
    expect((await acquireOnce({ session: SESSION, symbol: 'NVDA', now: clockAt(AFTER_CLOSE) })).failure).toBe('fetch_failed');
    expect(f).not.toHaveBeenCalled();
    expect(warn).toHaveBeenLastCalledWith(`[setupEvidence] NVDA ${SESSION}: fetch failed: EODHD_API_KEY not configured`);
    process.env.EODHD_API_KEY = 'k-5ecret';
    expect((await acquireOnce({ session: SESSION, symbol: 'NVDA', now: clockAt(AFTER_CLOSE) })).failure).toBe('fetch_failed');
    expect(warn).toHaveBeenLastCalledWith(`[setupEvidence] NVDA ${SESSION}: fetch failed: EODHD daily request failed`);
    expect(warn.mock.calls.flat().join(' ')).not.toContain('k-5ecret');
  });
});

describe('stamps: the instant the response was received', () => {
  it('fetchedAt is the injected response time, not the request start', async () => {
    const started = NEXT_CLOSE_MS - 60_000;
    const received = NEXT_CLOSE_MS - 1_000;
    const a = await acquireOnce({ session: SESSION, symbol: 'NVDA', ...timed(started, received) });
    expect(a.fetchedAt).toBe(new Date(received).toISOString());
    expect(a.evidence.sourceMeta.fetchedAt).toBe(new Date(received).toISOString());
    expect(a.receivedAtMs).toBe(received);
    expect(a.requestStartedAtMs).toBe(started);
    expect(a.evidence.evidenceClass.bars).toBe('contemporaneous');
  });
  it('a request started before the next session\'s close and answered at it → later_reconstruction', async () => {
    const a = await acquireOnce({ session: SESSION, symbol: 'NVDA', ...timed(NEXT_CLOSE_MS - 1_000, NEXT_CLOSE_MS) });
    expect(a.evidence.evidenceClass.bars).toBe('later_reconstruction');
    expect(a.entry.evidenceClass.bars).toBe('later_reconstruction');
  });
  it('the adapter\'s clock is the response\'s: a request started before the close and answered after it is complete', async () => {
    const a = await acquireOnce({ session: SESSION, symbol: 'NVDA', ...timed(CLOSE_MS - 1_000, CLOSE_MS + 1_000) });
    expect(a.evidence).toMatchObject({ ok: true, asOf: SESSION, checks: { completedSession: 'complete' } });
  });
  it('one instant: the clock is read twice, at the start and at the response, however many stamps are made', async () => {
    let t = NEXT_CLOSE_MS - 2;
    const now = vi.fn(() => new Date(t++));
    const a = await acquireOnce({ session: SESSION, symbol: 'NVDA', now, fetchPayload: async () => rawRows() });
    expect(now).toHaveBeenCalledTimes(2);
    expect(a.evidence.evidenceClass.bars).toBe('contemporaneous');
    expect(a.fetchedAt).toBe(new Date(NEXT_CLOSE_MS - 1).toISOString());
  });
  it('a refused result carries the same stamps', async () => {
    const a = await acquireOnce({ session: SESSION, symbol: 'NVDA', ...timed(NEXT_CLOSE_MS + 1, NEXT_CLOSE_MS + 2, rawRows({ n: 10 })) });
    expect(a.evidence).toMatchObject({ ok: false, sourceMeta: { fetchedAt: new Date(NEXT_CLOSE_MS + 2).toISOString() }, evidenceClass: { bars: 'later_reconstruction' } });
  });
});

describe('barsClassOf', () => {
  it.each([
    ['at the session\'s own close', SESSION, CLOSE_MS, 'contemporaneous'],
    ['the next morning, an intraday swap\'s same-day fetch', SESSION, etWallClockToMs('2026-10-29', 10, 0), 'contemporaneous'],
    ['one millisecond before the next close', SESSION, NEXT_CLOSE_MS - 1, 'contemporaneous'],
    ['at the next close', SESSION, NEXT_CLOSE_MS, 'later_reconstruction'],
    ['a week later', SESSION, CLOSE_MS + 7 * 86_400_000, 'later_reconstruction'],
    ['the Friday session over the weekend', '2026-10-23', etWallClockToMs('2026-10-25', 12, 0), 'contemporaneous'],
    ['across Thanksgiving, up to the early close that follows', '2026-11-25', etWallClockToMs('2026-11-27', 12, 59), 'contemporaneous'],
    ['at that early close', '2026-11-25', etWallClockToMs('2026-11-27', 13, 0), 'later_reconstruction'],
    ['when the calendar cannot say', '2027-12-31', Date.UTC(2028, 0, 3, 17), 'later_reconstruction'],
  ])('%s', (_label, session, instant, expected) => {
    expect(barsClassOf(session, instant)).toBe(expected);
  });
});

describe('sourceMeta: the scalar allowlist', () => {
  it('a result carries exactly { fetchedAt, from, to }', async () => {
    const { evidence, entry } = await acquire(rawRows());
    const expected = { fetchedAt: AFTER_CLOSE.toISOString(), from: '2026-06-20', to: SESSION };
    expect(evidence.sourceMeta).toEqual(expected);
    expect(entry.sourceMeta).toEqual(expected);
    expect(Object.keys(evidence.sourceMeta).sort()).toEqual(['fetchedAt', 'from', 'to']);
  });
  it('extra keys are dropped', () => {
    expect(sourceMetaOf({ fetchedAt: 'a', from: 'b', to: 'c', host: 'x', payload: [1] })).toEqual({ fetchedAt: 'a', from: 'b', to: 'c' });
  });
  it('nested values are dropped, never carried', () => {
    expect(sourceMetaOf({ fetchedAt: { at: 'a' }, from: ['b'], to: 'c' })).toEqual({ fetchedAt: null, from: null, to: 'c' });
  });
  it('an own __proto__ key is dropped and pollutes nothing', () => {
    const hostile = JSON.parse('{"__proto__": {"polluted": true}, "constructor": {"prototype": {"polluted": true}}, "fetchedAt": "a", "from": "b", "to": "c"}');
    const meta = sourceMetaOf(hostile);
    expect(Object.keys(meta).sort()).toEqual(['fetchedAt', 'from', 'to']);
    expect(Object.getPrototypeOf(meta)).toBe(Object.prototype);
    expect(meta.polluted).toBeUndefined();
    expect({}.polluted).toBeUndefined();
  });
  it('an inherited value is not an own one', () => {
    expect(sourceMetaOf(Object.create({ fetchedAt: 'inherited' }))).toEqual({ fetchedAt: null, from: null, to: null });
  });
  it.each([[null], [undefined], ['text'], [7]])('no object at all: %s', (input) => {
    expect(sourceMetaOf(input)).toEqual({ fetchedAt: null, from: null, to: null });
  });
});

describe('the snapshot document (contract §3, "Content")', () => {
  const ruleSet = describeRuleSet();
  const docOf = async (payload, options) => snapshotDocOf({ session: SESSION, symbol: 'NVDA', ruleSet, acquired: await acquire(payload, options), host: 'test-host' });

  it('ok: every named field and no other', async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = 'abc123';
    const acquired = await acquire(rawRows());
    const doc = snapshotDocOf({ session: SESSION, symbol: 'NVDA', ruleSet, acquired, host: 'test-host' });
    expect(Object.keys(doc).sort()).toEqual(['asOf', 'capturedAt', 'entry', 'evidence', 'evidenceClass', 'key', 'refusal', 'requestedAsOf', 'source', 'sourceMeta', 'status', 'writer']);
    expect(doc).toMatchObject({
      key: { session: SESSION, symbol: 'NVDA', ruleSet: { setupVersion: 'tf-setup-v1', thresholdsHash: '26f3f411b566', semanticsId: 'tf-setup-v1/sem-1' } },
      status: 'ok', asOf: SESSION, requestedAsOf: SESSION, refusal: null, source: 'eodhd_eod',
      evidenceClass: { bars: 'contemporaneous' }, capturedAt: AFTER_CLOSE.toISOString(), writer: { host: 'test-host', commit: 'abc123' },
    });
    expect(doc.evidence).toBe(acquired.evidence);
    expect(doc.entry).toBe(acquired.entry);
    expect(doc.sourceMeta).toEqual({ fetchedAt: AFTER_CLOSE.toISOString(), from: '2026-06-20', to: SESSION });
  });
  it('refused: the refusal and the two dates exactly as the evaluator emits them', async () => {
    const doc = await docOf(rawRows({ n: 54 }));
    expect(doc).toMatchObject({ status: 'refused', asOf: SESSION, requestedAsOf: SESSION, refusal: { reason: 'insufficient_history', detail: { required: 55, available: 54 }, expected: SESSION } });
    expect(doc.refusal).toEqual(doc.entry.refusal);
  });
  it('capturedAt is the response instant: not the request\'s start, not a time of writing', async () => {
    const started = CLOSE_MS + 5;
    const received = CLOSE_MS + 4_005;
    const acquired = await acquireOnce({ session: SESSION, symbol: 'NVDA', ...timed(started, received) });
    const doc = snapshotDocOf({ session: SESSION, symbol: 'NVDA', ruleSet, acquired, host: 'test-host' });
    expect(doc.capturedAt).toBe(new Date(received).toISOString());
    expect(doc.capturedAt).toBe(doc.sourceMeta.fetchedAt);
  });
  it('commit and host are null when nothing names them', async () => {
    const doc = snapshotDocOf({ session: SESSION, symbol: 'NVDA', ruleSet, acquired: await acquire(rawRows()) });
    expect(doc.writer).toEqual({ host: null, commit: null });
  });
  it('the key\'s rule set is a copy, and an ok document is about 12 KB', async () => {
    const doc = await docOf(rawRows());
    expect(Object.isFrozen(doc.key.ruleSet)).toBe(false);
    const json = JSON.stringify(doc);
    expect(json.length).toBeGreaterThan(9_000);
    expect(json.length).toBeLessThan(16_000);
  });

  const FIELDS = ['asOf', 'capturedAt', 'entry', 'evidence', 'evidenceClass', 'key', 'refusal', 'requestedAsOf', 'source', 'sourceMeta', 'status', 'writer'];
  const gapRows = () => { const rows = rawRows(); rows.splice(10, 1); return rows; };
  const zeroVolumeRows = () => { const rows = rawRows(); rows[3] = { ...rows[3], volume: 0 }; return rows; };
  const noLowRows = () => { const rows = rawRows(); rows[12] = { ...rows[12], low: 0 }; return rows; };
  /** What Firestore would refuse, or a value only one reader could make sense of. */
  function unstorable(value, path = 'doc') {
    if (value === undefined) return [path];
    if (typeof value === 'number') return Number.isFinite(value) ? [] : [path];
    if (value === null || typeof value !== 'object') return [];
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== Array.prototype) return [path];
    if (Array.isArray(value) && value.some(Array.isArray)) return [path];
    return Object.entries(value).flatMap(([key, v]) => unstorable(v, `${path}.${key}`));
  }

  describe.each([
    ['ok', rawRows, 'ok'],
    ['ok with an unknown verdict (a zero volume in the window)', zeroVolumeRows, 'ok'],
    ['insufficient_history', () => rawRows({ n: 54 }), 'refused'],
    ['missing_fact', noLowRows, 'refused'],
    ['basis_discontinuity', splitRows, 'refused'],
    ['an interior missing_bar', gapRows, 'refused'],
    ['a non-session bar', weekendBarRows, 'refused'],
  ])('every stored class: %s', (_label, payload, status) => {
    it.each([
      ['contemporaneous', CLOSE_MS + 3_600_000],
      ['later_reconstruction', NEXT_CLOSE_MS],
    ])('%s: exactly the named fields, each copy agreeing with its source, and every value storable', async (bars, received) => {
      const acquired = await acquireOnce({ session: SESSION, symbol: 'NVDA', ...timed(received - 2_000, received, payload()) });
      const { evidence, entry } = acquired;
      const doc = snapshotDocOf({ session: SESSION, symbol: 'NVDA', ruleSet, acquired, host: 'test-host' });
      const at = new Date(received).toISOString();
      expect(Object.keys(doc).sort()).toEqual(FIELDS);
      expect(doc.status).toBe(status);
      expect(evidence.ok).toBe(status === 'ok');
      expect([doc.asOf, doc.requestedAsOf]).toEqual([entry.asOf, entry.requestedAsOf]);
      expect([doc.asOf, doc.requestedAsOf]).toEqual([SESSION, SESSION]);
      expect(doc.refusal).toEqual(entry.refusal ?? null);
      expect([doc.source, evidence.source, entry.source]).toEqual(['eodhd_eod', 'eodhd_eod', 'eodhd_eod']);
      const meta = { fetchedAt: at, from: '2026-06-20', to: SESSION };
      for (const copy of [doc.sourceMeta, evidence.sourceMeta, entry.sourceMeta]) expect(copy).toEqual(meta);
      expect(doc.evidenceClass).toEqual({ bars });
      expect([evidence.evidenceClass.bars, entry.evidenceClass.bars]).toEqual([bars, bars]);
      expect(doc.capturedAt).toBe(at);
      expect(unstorable(doc)).toEqual([]);
    });
  });
});

describe('the clock', () => {
  const NOT_A_CLOCK = /`now` must be a function returning a valid Date/;
  it.each([[new Date()], ['2026-10-29'], [1], [null], [undefined]])('a value that is not a clock is refused: %s', async (now) => {
    expect(() => readClock(now)).toThrow(NOT_A_CLOCK);
    await expect(acquireOnce({ session: SESSION, symbol: 'NVDA', now, fetchPayload: async () => [] })).rejects.toThrow(NOT_A_CLOCK);
  });
  it('a clock that returns an invalid Date, or no Date, is refused', () => {
    expect(() => readClock(() => new Date(Number.NaN))).toThrow(NOT_A_CLOCK);
    expect(() => readClock(() => 123)).toThrow(NOT_A_CLOCK);
  });
});
