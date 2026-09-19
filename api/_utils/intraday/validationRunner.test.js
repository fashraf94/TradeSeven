// api/_utils/intraday/validationRunner.test.js — contract §10.1 state machine, §6.2 reconciliation by the validator.
import { describe, it, expect } from 'vitest';
import { makeInMemoryDb } from '../__fixtures__/inMemoryFirestore.js';
import { calendar, sessionOf, makeVendor, barsForDate, battleWith } from '../__fixtures__/intradayPollHarness.js';
import { runPoll } from './pollRunner.js';
import { runValidation } from './validationRunner.js';
import { loadActionableDocs } from './intradayStore.js';
import { sessionKeys } from './buckets.js';

const S17 = sessionOf('2026-09-17');
const HELD = ['AAPL', 'MSFT', 'NVDA'];
const minute = (s, m) => s.openMs + m * 60_000;

/** A day of polling (a few sweeps) so 2026-09-17 has calc state, then validate on the 18th. */
async function dayOfPolling({ stopAtMinute = 402, includeClose = true } = {}) {
  const mem = makeInMemoryDb();
  let t = S17.openMs;
  const now = () => t;
  const vendor = makeVendor({ barsByDate: { '2026-09-16': barsForDate('2026-09-16') } });
  vendor.now = now;
  const battles = [battleWith(HELD, ['AMD'])];
  const poll = async (ms) => { t = ms; return runPoll({ db: mem.db, now, fetchImpl: vendor, apiKey: 'k', collectEnabled: true, calendar, listActiveBattles: async () => battles, universeStocks: HELD, owner: 'A', log: { error: () => {} } }); };
  // Minutes are offsets from the 09:30 open (390 = 16:00). The delayed feed
  // reaches the last bucket at 16:10 (400); `includeClose` adds the sweeps
  // whose observations carry the exact close (405) and the passage (410).
  const minutes = [1, 5, 10, 60, 120, 240, 380, 395, 400, stopAtMinute];
  if (includeClose) minutes.push(405, 410);
  for (const m of minutes) await poll(minute(S17, m));
  return { ...mem, vendor, setTime: (ms) => { t = ms; }, now };
}

function validator(mem, { now, barsByDate, views = [] }) {
  const vendor = makeVendor({ barsByDate });
  vendor.now = now;
  return (over = {}) => runValidation({ db: mem.db, now, fetchImpl: vendor, apiKey: 'k', collectEnabled: true, calendar, listViewsForSession: async () => views, fireTicksOf: () => 2, log: { error: () => {} }, ...over, __vendor: vendor });
}

describe('§10.1 the validator state machine', () => {
  it('flag off / calendar missing exits; grades the PREVIOUS session; unpublished bars record the attempt and exit', async () => {
    const mem = await dayOfPolling();
    let t = Date.UTC(2026, 8, 18, 10, 0, 0); // 06:00 ET Friday → grades Thursday 09-17
    const run = validator(mem, { now: () => t, barsByDate: { '2026-09-17': null } });
    expect(await run({ collectEnabled: false })).toEqual({ skipped: true, reason: 'flag_off' });
    const r1 = await run();
    expect(r1).toMatchObject({ gradeDate: '2026-09-17', status: 'in_progress', validated: 0, unpublished: true, pending: 4, units: 5 });
    const state = mem.store.get('intradayValidationState/2026-09-17');
    expect(state).toMatchObject({ status: 'in_progress', attempts: 1, pendingSymbols: ['AAPL', 'AMD', 'MSFT', 'NVDA'], doneSymbols: [], firstPublishHourUtc: null, lastAttemptUnpublished: true });
    expect(state.windowClosesAt).toBe(Date.UTC(2026, 8, 18, 16, 0, 0));
    expect(mem.store.get('intradayBudget/2026-09-18')).toMatchObject({ unitsRequested: 5, unitsBySource: { intraday_1m_validate: 5 } });
    t += 30 * 60_000;
    const r2 = await run();
    expect(r2.unpublished).toBe(true);
    expect(mem.store.get('intradayValidationState/2026-09-17').attempts).toBe(2);
  });
  it('published bars: validates up to 20 symbols within the budget, persists progress, reports; firstPublishHourUtc recorded; trailing rollup attached', async () => {
    const mem = await dayOfPolling();
    let t = Date.UTC(2026, 8, 18, 11, 30, 0);
    const bars = barsForDate('2026-09-17');
    const run = validator(mem, { now: () => t, barsByDate: { '2026-09-17': bars } });
    const r = await run();
    expect(r).toMatchObject({ gradeDate: '2026-09-17', status: 'done', validated: 4, pending: 0, unpublished: false, units: 20, firstPublishHourUtc: 11 });
    const doc = mem.store.get('intradayValidation/2026-09-17');
    expect(doc).toMatchObject({ etDate: '2026-09-17', status: 'done', symbolsValidated: 4, firstPublishHourUtc: 11, calcVersion: 1, policyVersion: 1 });
    expect(Object.keys(doc.symbols).sort()).toEqual(['AAPL', 'AMD', 'MSFT', 'NVDA']);
    // Build 1: every estimate has a null cutoff → excluded with cutoff_unconfirmed; closing row unresolved → unqualified.
    expect(doc.symbols.AAPL.series.excludedByReason.cutoff_unconfirmed).toBeGreaterThan(0);
    expect(doc.symbols.AAPL.qualification).toEqual({ included: false, reason: 'close_unqualified' });
    expect(doc.symbols.AAPL.coverage.referenceCoveragePct).not.toBeNull();
    expect(doc.symbols.AAPL.evaluationLinked.unavailable).toEqual({ evaluationLinked: 'no_evaluation_evidence' });
    expect(doc.unavailable.p95AbsResidualOverPrice).toBe('no_aligned_comparisons');
    expect(doc.trailing10).toMatchObject({ sessions: 1, dates: ['2026-09-17'] });
    expect(typeof doc.trailing10.unavailable.p95AbsResidualOverPrice).toBe('string');
    // A second invocation is a no-op.
    expect(await run()).toMatchObject({ skipped: true, reason: 'already_done' });
  });
  it('the 20-symbol / 60 s bound: progress persists across invocations', async () => {
    const mem = await dayOfPolling();
    let t = Date.UTC(2026, 8, 18, 11, 30, 0);
    const bars = barsForDate('2026-09-17');
    const run = validator(mem, { now: () => t, barsByDate: { '2026-09-17': bars } });
    const tight = { ...(await import('../intradayConfig.js')), VALIDATOR_SYMBOLS_PER_INVOCATION: 3 };
    const r1 = await run({ config: tight });
    expect(r1).toMatchObject({ status: 'in_progress', validated: 3, pending: 1 });
    expect(mem.store.has('intradayValidation/2026-09-17')).toBe(false);
    t += 30 * 60_000;
    const r2 = await run({ config: tight });
    expect(r2).toMatchObject({ status: 'done', validated: 1, pending: 0 });
    expect(mem.store.get('intradayValidation/2026-09-17').symbolsValidated).toBe(4);
  });
  it('window_closed at 16:00 UTC with the unvalidated symbols listed, reason unpublished', async () => {
    const mem = await dayOfPolling();
    let t = Date.UTC(2026, 8, 18, 10, 0, 0);
    const run = validator(mem, { now: () => t, barsByDate: { '2026-09-17': null } });
    await run();
    t = Date.UTC(2026, 8, 18, 16, 0, 0);
    const r = await run();
    expect(r).toMatchObject({ status: 'window_closed', unvalidated: 4 });
    const state = mem.store.get('intradayValidationState/2026-09-17');
    expect(state.status).toBe('window_closed');
    expect(state.unvalidated).toEqual(['AAPL', 'AMD', 'MSFT', 'NVDA'].map((sym) => ({ sym, reason: 'unpublished' })));
    const doc = mem.store.get('intradayValidation/2026-09-17');
    expect(doc).toMatchObject({ status: 'window_closed', symbolsValidated: 0 });
    expect(doc.unvalidated).toHaveLength(4);
    expect(await run()).toMatchObject({ skipped: true, reason: 'already_window_closed' });
  });
  it('§6.2: the validator finalises a missed deadline for the session it grades, idempotently', async () => {
    const mem = await dayOfPolling({ stopAtMinute: 402, includeClose: false });
    const { lastKey } = sessionKeys(S17);
    let docs = await loadActionableDocs(mem.db, '2026-09-17', ['AAPL']);
    expect(docs.AAPL.ring.buckets.find((b) => b.key === lastKey)?.status).toBe('open');
    let t = Date.UTC(2026, 8, 18, 10, 0, 0);
    const run = validator(mem, { now: () => t, barsByDate: { '2026-09-17': null } });
    const r = await run();
    expect(r.deadline).toMatchObject({ applied: true, marked: expect.any(Number) });
    docs = await loadActionableDocs(mem.db, '2026-09-17', ['AAPL']);
    expect(docs.AAPL.ring.buckets.find((b) => b.key === lastKey)).toMatchObject({ status: 'incomplete', reason: 'deadline' });
    t += 30 * 60_000;
    expect((await run()).deadline).toEqual({ applied: false, reason: 'already_applied' });
  });
  it('a session with no actionable documents is done immediately with a no-symbols report', async () => {
    const mem = makeInMemoryDb();
    const t = Date.UTC(2026, 8, 18, 10, 0, 0);
    const run = validator(mem, { now: () => t, barsByDate: {} });
    expect(await run()).toMatchObject({ gradeDate: '2026-09-17', status: 'done', symbols: 0 });
    expect(mem.store.get('intradayValidation/2026-09-17').status).toBe('done_no_symbols');
  });
});
