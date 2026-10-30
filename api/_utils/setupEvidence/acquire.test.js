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
import { afterEach, describe, it, expect, vi } from 'vitest';
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
const acquire = (payload, { session = SESSION, symbol = 'NVDA', now = clockAt(AFTER_CLOSE) } = {}) => acquireOnce({ session, symbol, now, fetchPayload: async () => payload });
const evidenceOf = async (payload, options) => (await acquire(payload, options)).evidence;
const dispositionOf = async (payload, options = {}) => classifyEvidence(await evidenceOf(payload, options), { session: options.session ?? SESSION });

afterEach(() => { vi.restoreAllMocks(); delete process.env.VERCEL_GIT_COMMIT_SHA; });

describe('the request', () => {
  it('asks once, newest first, with the bounded timeout, 130 calendar days back to the session', async () => {
    const fetchPayload = vi.fn(async () => rawRows());
    await acquireOnce({ session: SESSION, symbol: 'NVDA', now: clockAt(AFTER_CLOSE), fetchPayload });
    expect(fetchPayload.mock.calls).toEqual([['NVDA', { from: '2026-06-20', to: SESSION, order: 'd', timeoutMs: 5_000 }]]);
    expect(ACQUIRE_TIMEOUT_MS).toBe(5_000);
    expect(REQUEST_LOOKBACK_CALENDAR_DAYS).toBe(130);
  });
  it.each([['2026-01-05'], ['2026-07-06'], ['2026-12-31'], ['2027-11-26']])('the request\'s reach holds 55 sessions whatever the holidays: %s', (session) => {
    const { from, to } = requestWindowOf(session);
    let weekdays = 0;
    for (let t = Date.parse(`${from}T12:00:00Z`); t <= Date.parse(`${to}T12:00:00Z`); t += 86_400_000) {
      const day = new Date(t).getUTCDay();
      if (day !== 0 && day !== 6) weekdays += 1;
    }
    expect(weekdays).toBeGreaterThanOrEqual(MIN_COMPLETED_BARS + 10); // no year has ten NYSE holidays in 130 days
  });
  it('DST does not move the date range', () => {
    expect(requestWindowOf('2026-11-02')).toEqual({ from: '2026-06-25', to: '2026-11-02' });
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
    const rows = rawRows();
    const friday = rows.findIndex((r) => r.date === '2026-10-23');
    rows.splice(friday, 0, { ...rows[friday], date: '2026-10-24' });
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
    const rows = rawRows().map((r, i) => {
      const adjusted = 100 - 0.25 * i;
      const raw = i <= 6 ? adjusted : adjusted * 2;
      return { ...r, open: raw, high: raw + 1.5, low: raw - 1.5, close: raw, adjusted_close: adjusted };
    });
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

describe('acquisition failures', () => {
  it.each([['an object', { errors: 'none' }], ['null', null], ['a string', 'rate limited'], ['a number', 3]])('a non-array payload (%s) → retryable, the adapter never runs', async (_label, payload) => {
    const a = await acquire(payload);
    expect(a).toEqual({ failure: 'non_array_payload', requestStartedAtMs: AFTER_CLOSE.getTime() });
    expect(classifyAcquisitionFailure(a.failure).disposition).toBe('retryable');
  });
  it.each([['a timeout', new DOMException('The operation was aborted due to timeout', 'TimeoutError')], ['a network failure', new TypeError('fetch failed')], ['a non-200', new Error('EODHD daily responded with 402')]])('%s → retryable, nothing evaluated', async (_label, error) => {
    const a = await acquireOnce({ session: SESSION, symbol: 'NVDA', now: clockAt(AFTER_CLOSE), fetchPayload: async () => { throw error; } });
    expect(a).toEqual({ failure: 'fetch_failed', requestStartedAtMs: AFTER_CLOSE.getTime() });
    expect(classifyAcquisitionFailure(a.failure).disposition).toBe('retryable');
  });
});

describe('stamps: the instant the response was received', () => {
  /** A clock the fake provider moves: the request starts at `started`, the response lands at `received`. */
  function timed(started, received, payload = rawRows()) {
    let current = started;
    return { now: () => new Date(current), fetchPayload: async () => { current = received; return payload; } };
  }
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
  it('capturedAt is the response instant, not a time of writing', async () => {
    const doc = await docOf(rawRows(), { now: clockAt(new Date(CLOSE_MS + 5)) });
    expect(doc.capturedAt).toBe(new Date(CLOSE_MS + 5).toISOString());
    expect(doc.capturedAt).toBe(doc.sourceMeta.fetchedAt);
  });
  it('commit and host are null when nothing names them', async () => {
    const doc = snapshotDocOf({ session: SESSION, symbol: 'NVDA', ruleSet, acquired: await acquire(rawRows()) });
    expect(doc.writer).toEqual({ host: null, commit: null });
  });
  it('the key\'s rule set is a copy, about 12 KB in all, and holds no undefined Firestore would refuse', async () => {
    const doc = await docOf(rawRows());
    expect(Object.isFrozen(doc.key.ruleSet)).toBe(false);
    const json = JSON.stringify(doc);
    expect(json.length).toBeGreaterThan(9_000);
    expect(json.length).toBeLessThan(16_000);
    const walk = (v) => { expect(v).not.toBeUndefined(); if (v && typeof v === 'object') Object.values(v).forEach(walk); };
    walk(doc);
  });
});

describe('the clock', () => {
  it.each([[new Date()], ['2026-10-29'], [1], [null], [undefined]])('a value that is not a clock is refused: %s', async (now) => {
    expect(() => readClock(now)).toThrow(TypeError);
    await expect(acquireOnce({ session: SESSION, symbol: 'NVDA', now, fetchPayload: async () => [] })).rejects.toThrow(TypeError);
  });
  it('a clock that returns an invalid Date, or no Date, is refused', () => {
    expect(() => readClock(() => new Date(Number.NaN))).toThrow(TypeError);
    expect(() => readClock(() => 123)).toThrow(TypeError);
  });
});
