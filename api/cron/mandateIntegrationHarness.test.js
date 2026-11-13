// api/cron/mandateIntegrationHarness.test.js
//
// Spec 1 Phase 4 — the HANDLER-LEVEL integration harness P3 flagged as test
// debt (docs/audits/20260812_MANDATE_PHASE3_CUMULATIVE_REVIEW.md §6). The P3
// unit fakes run transactions single-pass and stop at module boundaries, so the
// sweeps' catch traces, truthful-completion gates, fresh-read-under-lease
// re-check, no_vintage→quarantine path, and two-writer contention were
// review-verified but never suite-exercised. This drives the REAL exported
// sweep drivers (runEvalSweep / runCloseSweep) and the REAL closeBook against
// the transaction-faithful fake (mandateFakeFirestore.js), covering the five
// requirements (a)-(e) from the P4 kickoff, plus (f), the T0c qualified idle
// skip (docs/audits/20261112_BUILD_T0C_IDLE_DATA_SKIP.md).
//
// SUBSTRATE CHOICE (stated per the kickoff): a transaction-faithful in-memory
// fake, not the Firestore emulator. The emulator is wired in the repo for
// security-RULES only (test:rules, Java-gated, auto-skips), gives nondeterministic
// interleaving, and would pull the mandate suite off its fast-fake idiom. The
// fake models the real Admin-SDK contract (read-set-validated revision
// precondition + retry + create-if-absent) AND offers a deterministic barrier to
// force "A reads, B commits, A retries" — impossible to script against a real
// emulator.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// closeBook is mocked per-test (throw vs return) via a mutable impl; the other
// close-pass exports runCloseSweep uses stay real.
let closeBookImpl = null;
const retentionSpy = vi.fn(async () => {});
vi.mock('../_utils/mandateClosePass.js', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    closeBook: (...args) => closeBookImpl(...args),
    runRetentionCleanup: (...args) => retentionSpy(...args),
  };
});

// The model call runEvalSweep reaches through runBookEval's default; mocked as a
// counting spy for the fresh-read-under-lease double-bill assertion.
let modelImpl = null;
const modelSpy = vi.fn((...args) => modelImpl(...args));
// (f) T0c's batch-transport row polls a provider batch; every other row runs
// the default direct transport and never reaches this (null → loud TypeError).
let retrieveImpl = null;
vi.mock('../_utils/mandateModelCall.js', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    callMandateModelDirect: (...args) => modelSpy(...args),
    retrieveMandateBatch: (...args) => retrieveImpl(...args),
  };
});

// (f) T0c: the snapshot builders run REAL; their two market-fetch clients are
// mocked at the module seam (the only network edges on the build path besides
// the corporate-actions fetcher's global `fetch`, which (f) stubs). Inert for
// (a)-(e): (a)-(d2) seed their snapshot docs and (e) calls closeBook directly,
// so no builder runs in them.
const quotesSpy = vi.fn(async (symbols) => Object.fromEntries(symbols.map((s) => [s, { close: 100 }])));
const fundamentalsSpy = vi.fn(async () => ({
  fundamentals: { sector: 'Technology', industry: 'Software', marketCap: 1e12 },
  cacheStatus: { fundamentals: 'fresh' },
}));
vi.mock('../_utils/tournamentPrices.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, fetchBatchQuotes: (...a) => quotesSpy(...a) };
});
vi.mock('../_utils/marketDataCache.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, getStockAnalysisData: (...a) => fundamentalsSpy(...a) };
});

// Imported AFTER the mocks are registered (vi.mock is hoisted, so order is fine).
import { runCloseSweep, runEvalSweep } from './mandate-evaluate.js';
import { makeMandateFakeDb } from '../_utils/__testsupport__/mandateFakeFirestore.js';
import { buildNewMandateDoc } from '../_utils/mandateSchema.js';
import { MANDATE_BATCH_COLLECTION } from '../_utils/mandateBatchTransport.js';
import { CANDIDATE_UNIVERSE } from '../_utils/mandateCandidateUniverse.js';
import { MANDATE_QUOTE_BATCH_SIZE } from '../_utils/mandateConfig.js';

// A cron-authenticated req + a res that captures the terminal status/json.
function fakeReqRes() {
  const req = { headers: { 'x-vercel-cron': '1' }, method: 'POST' };
  const captured = {};
  const res = {
    status(code) { captured.code = code; return this; },
    json(body) { captured.body = body; return this; },
  };
  return { req, res, captured };
}

// A book with the full P3-era shape (health attempt markers + execState seeded).
function seedBook(overrides = {}) {
  const doc = buildNewMandateDoc({
    mandateId: overrides.mandateId || 'm1',
    userId: 'u1', archetype: 'analyst', managerAgentId: 'mgr_analyst_x',
    vintageRef: 'archetypeVintages/analyst_x',
    cadenceTier: overrides.cadenceTier || 'fast',
    createdAt: new Date('2026-06-01T13:00:00Z'),
    quarterStartAt: new Date('2026-06-01T13:00:00Z'),
    nextRolloverAt: new Date('2026-09-01T20:00:00Z'),
    escapeHatchEligibleUntil: new Date('2026-06-15T13:00:00Z'),
  });
  // Deep-apply overrides onto the health/execState/portfolio blocks.
  return {
    ...doc,
    ...overrides,
    health: { ...doc.health, ...(overrides.health || {}) },
    execState: { ...doc.execState, ...(overrides.execState || {}) },
    portfolio: { ...doc.portfolio, ...(overrides.portfolio || {}) },
  };
}

const CLOSE_TICK = { date: '2026-08-12', closeKey: '2026-08-12_close' };
const NOW = new Date('2026-08-12T20:30:00Z'); // 16:30 ET — inside the close window
const REGIME = { regime: 'risk_on', regimeAsOf: '2026-08-12T20:00:00.000Z', regimeSource: 'indexIntelligence/marketContext' };

beforeEach(() => {
  closeBookImpl = null;
  modelImpl = null;
  retrieveImpl = null;
  retentionSpy.mockClear();
  modelSpy.mockClear();
});

// ── (a) whole-close failure → durable trace + MANDATE_CLOSE_FAILED_STREAK at 2 ─
describe('(a) whole-close failure leaves a durable trace and fires the streak alert at 2', () => {
  it('closeBook throwing writes consecutiveCloseFailures + lastCloseAttemptAt and logs MANDATE_CLOSE_FAILED_STREAK at 2', async () => {
    // Seed a snapshot so the sweep skips the (network) build; seed the book at
    // consecutiveCloseFailures:1 so ONE throwing fire crosses the threshold (2).
    const db = makeMandateFakeDb({
      'mandateUniverseSnapshots/2026-08-12_close': { tickKey: '2026-08-12_close', symbols: {} },
      'mandates/m1': seedBook({ health: { consecutiveCloseFailures: 1 } }),
    });
    closeBookImpl = async () => { throw new Error('injected close failure'); };
    const errs = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((m) => errs.push(String(m)));

    const { req, res, captured } = fakeReqRes();
    await runCloseSweep(req, res, { now: NOW, closeTick: CLOSE_TICK, db });
    spy.mockRestore();

    const book = db._get('mandates/m1');
    expect(book.health.consecutiveCloseFailures).toBe(2);           // durable trace advanced
    expect(book.health.lastCloseAttemptAt).toEqual(NOW);            // ordering key advanced on failure
    expect(db._get('mandates/m1/dailyRows/2026-08-12')).toBeUndefined(); // no row (throw)
    expect(captured.body.errors).toBeGreaterThanOrEqual(1);
    expect(captured.body.complete).toBe(false);
    // The BLOCKER-1 mutation guard: the alert fires at streak 2. Before the import
    // fix, :616 threw ReferenceError, this log never appeared, and errors
    // double-counted with a spurious "persist FAILED".
    expect(errs.some((e) => e.includes('MANDATE_CLOSE_FAILED_STREAK') && e.includes('m1'))).toBe(true);
    expect(errs.some((e) => e.includes('close-failure persist FAILED'))).toBe(false);
  });
});

// ── (b) a sweep with an error does NOT log complete or run retention ──────────
describe('(b) truthful completion — an errored sweep never claims complete or runs retention', () => {
  it('one throwing book + one closeable book → complete:false, retention NOT called', async () => {
    const db = makeMandateFakeDb({
      'mandateUniverseSnapshots/2026-08-12_close': { tickKey: '2026-08-12_close', symbols: {} },
      'mandates/bad': seedBook({ mandateId: 'bad' }),
      'mandates/good': seedBook({ mandateId: 'good' }),
    });
    closeBookImpl = async (d, ref) => {
      if (ref.id === 'bad') throw new Error('injected close failure');
      return { closed: true, row: { partial: false }, streamRecord: {}, rows: [], monthEstUsd: 0, alerts: [] };
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { req, res, captured } = fakeReqRes();
    await runCloseSweep(req, res, { now: NOW, closeTick: CLOSE_TICK, db });
    spy.mockRestore();

    expect(captured.body.errors).toBe(1);
    expect(captured.body.closed).toBe(1);         // the good book DID close
    expect(captured.body.complete).toBe(false);   // an error leaves the tail unproven
    expect(retentionSpy).not.toHaveBeenCalled();  // retention gated on true completion
  });

  it('a fully-clean sweep (zero new, zero errors) DOES complete and runs retention', async () => {
    // All books already closed today (lastCloseKey===date) → skipped, newlyClosed 0,
    // errors 0, no lease skips, not deferred → complete + retention.
    const db = makeMandateFakeDb({
      'mandateUniverseSnapshots/2026-08-12_close': { tickKey: '2026-08-12_close', symbols: {} },
      'mandates/m1': seedBook({ execState: { lastCloseKey: '2026-08-12' } }),
    });
    closeBookImpl = async () => { throw new Error('should not be called — book already closed'); };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { req, res, captured } = fakeReqRes();
    await runCloseSweep(req, res, { now: NOW, closeTick: CLOSE_TICK, db });
    spy.mockRestore();

    expect(captured.body.errors).toBe(0);
    expect(captured.body.complete).toBe(true);
    expect(retentionSpy).toHaveBeenCalledTimes(1);
  });
});

// ── (c) fresh-read-under-lease prevents a within-slot double bill ─────────────
describe('(c) the in-lease fresh read (not the page copy) prevents a double bill', () => {
  const VINTAGE = {
    codeId: 'analyst', displayVintage: 'Fundamental Investor v2',
    archetypeContent: { displayName: 'Fundamental Investor', identity: { reveal: 'You buy good businesses.', voice: 'v' }, character: { factors: {} } },
    gateConfig: { cashFloorPct: 0.02, minPositions: 5, maxPositions: 15, maxSinglePositionWeightPct: 0.35, sectorConcentrationCap: 0.30, sectorCapConversionVersion: 1, decisionVerbs: ['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD'] },
    modelSeat: { model: 'claude-haiku-4-5-20251001', params: { temperature: 0.7, maxTokens: 600 } },
  };
  const EVAL_TICK = { date: '2026-08-12', slot: 'open30', tickKey: '2026-08-12_open30' };
  const EVAL_NOW = new Date('2026-08-12T14:05:00Z');

  function evalDb() {
    return makeMandateFakeDb({
      'mandateUniverseSnapshots/2026-08-12_open30': { tickKey: '2026-08-12_open30', symbols: { AAPL: { complete: true, price: 200, sector: 'Technology' } } },
      'archetypeVintages/analyst_x': VINTAGE,
      'mandates/m1': seedBook({ cadenceTier: 'fast' }),
    });
  }

  it('CONTROL: an unstamped book reaches the model exactly once', async () => {
    const db = evalDb();
    modelImpl = async () => ({ decision: { ok: true, input: { verb: 'HOLD', rationale: 'x' } }, usage: null });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { req, res } = fakeReqRes();
    await runEvalSweep(req, res, { now: EVAL_NOW, tick: EVAL_TICK, db });
    spy.mockRestore();
    expect(modelSpy).toHaveBeenCalledTimes(1);
    expect(db._get('mandates/m1').execState.lastEvalTickKey).toBe('2026-08-12_open30');
  });

  it('a stamp committed between the page read and the in-lease read is caught → model 0 calls', async () => {
    const db = evalDb();
    modelImpl = async () => ({ decision: { ok: true, input: { verb: 'HOLD', rationale: 'x' } }, usage: null });
    // The barrier fires during acquireLease (the first per-book txn): it stamps
    // lastEvalTickKey, simulating a concurrent fire that committed after the page
    // query. acquireLease's book read then aborts+retries; the sweep's fresh read
    // at :331 sees the stamp; the re-check at :334-335 skips → runBookEval never
    // runs → the model is never billed.
    db.setBarrier(async () => {
      await db.doc('mandates/m1').update({ 'execState.lastEvalTickKey': '2026-08-12_open30' });
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { req, res, captured } = fakeReqRes();
    await runEvalSweep(req, res, { now: EVAL_NOW, tick: EVAL_TICK, db });
    spy.mockRestore();
    expect(modelSpy).toHaveBeenCalledTimes(0);   // the re-check prevented the double bill
    expect(captured.body.skipped).toBeGreaterThanOrEqual(1);
  });
});

// ── (d) no_vintage counts as an eval failure, through to quarantine ───────────
describe('(d) no_vintage is an eval failure that reaches quarantine', () => {
  const EVAL_TICK = { date: '2026-08-12', slot: 'open30', tickKey: '2026-08-12_open30' };
  const EVAL_NOW = new Date('2026-08-12T14:05:00Z');

  it('a book whose vintageRef is absent increments failures and quarantines at 5', async () => {
    const db = makeMandateFakeDb({
      'mandateUniverseSnapshots/2026-08-12_open30': { tickKey: '2026-08-12_open30', symbols: {} },
      // NOTE: no archetypeVintages/analyst_x doc → vintage load returns null → no_vintage
      'mandates/m1': seedBook({ cadenceTier: 'fast', health: { consecutiveEvalFailures: 4 } }),
    });
    modelImpl = async () => { throw new Error('model must not be reached on no_vintage'); };
    const errs = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((m) => errs.push(String(m)));
    const { req, res, captured } = fakeReqRes();
    await runEvalSweep(req, res, { now: EVAL_NOW, tick: EVAL_TICK, db });
    spy.mockRestore();

    const book = db._get('mandates/m1');
    expect(book.health.consecutiveEvalFailures).toBe(5);
    expect(book.health.quarantined).toBe(true);
    expect(book.health.lastEvalSweepAt).toEqual(EVAL_NOW);  // frontier advances (no pinning)
    expect(modelSpy).toHaveBeenCalledTimes(0);
    expect(errs.some((e) => e.includes('MANDATE_NO_VINTAGE') && e.includes('m1'))).toBe(true);
    expect(errs.some((e) => e.includes('MANDATE_QUARANTINED') && e.includes('m1'))).toBe(true);
    expect(captured.body.skipped).toBeGreaterThanOrEqual(1);
  });
});

// ── (d2) T0a: an uncorrected vintage is exit-only, not an eval failure ────────
describe('(d2) T0a — an uncorrected vintage: its own alert, exits execute, no failure counted', () => {
  const EVAL_TICK = { date: '2026-08-12', slot: 'open30', tickKey: '2026-08-12_open30' };
  const EVAL_NOW = new Date('2026-08-12T14:05:00Z');
  // The pre-T0a gate config: the raw slot count (3) and no conversion stamp.
  const UNCORRECTED = {
    codeId: 'analyst', displayVintage: 'Fundamental Investor v2',
    archetypeContent: { displayName: 'Fundamental Investor', identity: { reveal: 'r', voice: 'v' }, character: { factors: {} } },
    gateConfig: { cashFloorPct: 0.02, minPositions: 5, maxPositions: 15, maxSinglePositionWeightPct: 0.35, sectorConcentrationCap: 3, decisionVerbs: ['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD'] },
    modelSeat: { model: 'claude-haiku-4-5-20251001', params: { temperature: 0.7, maxTokens: 600 } },
  };
  const held = () => seedBook({
    cadenceTier: 'fast',
    portfolio: { cash: 9800000, positions: { AAPL: { shares: 1000, costBasisTotal: 200000, avgCost: 200, lastMark: 200, sector: 'Technology', openedAt: '2026-08-03' } } },
  });

  it('logs MANDATE_VINTAGE_UNCORRECTED, reaches the model, executes a SELL, counts no failure', async () => {
    const db = makeMandateFakeDb({
      'mandateUniverseSnapshots/2026-08-12_open30': { tickKey: '2026-08-12_open30', symbols: { AAPL: { complete: true, price: 200, sector: 'Technology' } } },
      'archetypeVintages/analyst_x': UNCORRECTED,
      'mandates/m1': held(),
    });
    modelImpl = async () => ({ decision: { ok: true, input: { verb: 'SELL', ticker: 'AAPL', rationale: 'x' } }, usage: null });
    const errs = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((m) => errs.push(String(m)));
    const { req, res, captured } = fakeReqRes();
    await runEvalSweep(req, res, { now: EVAL_NOW, tick: EVAL_TICK, db });
    spy.mockRestore();

    const book = db._get('mandates/m1');
    expect(modelSpy).toHaveBeenCalledTimes(1);
    expect(book.portfolio.positions.AAPL).toBeUndefined();           // the exit executed
    expect(book.health.consecutiveEvalFailures || 0).toBe(0);        // not an eval failure
    expect(book.health.quarantined).toBeFalsy();
    expect(errs.some((e) => e.includes('MANDATE_VINTAGE_UNCORRECTED') && e.includes('m1') && e.includes('exits allowed'))).toBe(true);
    expect(errs.some((e) => e.includes('MANDATE_NO_VINTAGE') || e.includes('MANDATE_QUARANTINED'))).toBe(false);
    expect(captured.body.executed).toBe(1);
  });
});

// ── (e) two revision writers on one doc — exactly one winner ──────────────────
describe('(e) revision precondition + retry: two writers, exactly one winner', () => {
  it('a same-date double close under contention commits exactly one row + one revision bump', async () => {
    // The REAL closeBook (not the per-test-mocked proxy) drives both writers.
    const { closeBook: actualCloseBook } = await vi.importActual('../_utils/mandateClosePass.js');
    // The book carries one position + a prior row so the close computes a real
    // day return. Both closes target the same date; the barrier makes writer B
    // commit first, so writer A aborts, retries, re-reads B's committed state,
    // and the in-txn lastCloseKey re-check makes it a no-op — exactly one winner.
    const book = seedBook({
      revision: 10,
      portfolio: {
        cash: 90000,
        positions: { AAPL: { shares: 50, costBasisTotal: 10000, avgCost: 200, lastMark: 200, lastMarkAsOf: '2026-08-11T20:00:00Z', lastMarkSource: 'snapshot', sector: 'Technology', openedAt: '2026-06-01' } },
        totalValue: 100000, initialValue: 100000, sectorWeights: {},
        lifetimeHighWaterMark: 100000, lifetimeDrawdownFromPeak: 0,
        quarterHighWaterMark: 100000, quarterDrawdownFromPeak: 0, frictionPaidCum: 0,
      },
    });
    const db = makeMandateFakeDb({
      'mandates/m1': book,
      'mandates/m1/dailyRows/2026-08-11': { date: '2026-08-11', totalValue: 100000, quarterIndex: 1, partial: false, frictionPaidCum: 0 },
    });
    const closeSnapshot = { tickKey: '2026-08-12_close', symbols: { AAPL: { complete: true, price: 210, sector: 'Technology', marketCap: 3e12, priceAsOf: '2026-08-12T20:00:00Z' } } };
    const args = { date: '2026-08-12', closeSnapshot, now: NOW, regime: REGIME };

    // Writer B commits fully inside writer A's transaction window.
    db.setBarrier(async () => {
      await actualCloseBook(db, db.doc('mandates/m1'), args);
    });
    const rA = await actualCloseBook(db, db.doc('mandates/m1'), args);

    // Exactly one committed close: B won; A retried, saw lastCloseKey===date, no-op'd.
    expect(rA.closed).toBe(false);
    expect(rA.skipped).toBe('already_closed');
    const finalBook = db._get('mandates/m1');
    expect(finalBook.revision).toBe(11);                 // exactly one bump (B), not two
    expect(finalBook.execState.lastCloseKey).toBe('2026-08-12');
    // Exactly one row, correct value (marked at the close print, not double-applied).
    const row = db._get('mandates/m1/dailyRows/2026-08-12');
    expect(row).toBeDefined();
    expect(row.totalValue).toBe(90000 + 50 * 210); // cash + 50sh @ 210 close = 100500
    expect(db._txAttempts()).toBeGreaterThanOrEqual(3); // B(1) + A first(abort) + A retry(no-op)
  });
});

// ── (f) T0c: the qualified idle skip ──────────────────────────────────────────
// Skip new market-data acquisition ONLY when no active book exists and no batch
// doc is still open; continue everything else; recheck every fire; never write
// an empty snapshot. Every skip row has a non-skip control that runs the same
// real builders, so the "no fetch / no write" assertions can fail.
describe('(f) T0c — the qualified idle skip', () => {
  const EVAL_TICK = { date: '2026-08-12', slot: 'open30', tickKey: '2026-08-12_open30' };
  const EVAL_NOW = new Date('2026-08-12T14:05:00Z');
  const VINTAGE = {
    codeId: 'analyst', displayVintage: 'Fundamental Investor v2',
    archetypeContent: { displayName: 'Fundamental Investor', identity: { reveal: 'You buy good businesses.', voice: 'v' }, character: { factors: {} } },
    gateConfig: { cashFloorPct: 0.02, minPositions: 5, maxPositions: 15, maxSinglePositionWeightPct: 0.35, sectorConcentrationCap: 0.30, sectorCapConversionVersion: 1, decisionVerbs: ['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD'] },
    modelSeat: { model: 'claude-haiku-4-5-20251001', params: { temperature: 0.7, maxTokens: 600 } },
  };
  // What one full first-fire build requests from the mocked clients: fundamentals
  // + splits + dividends per universe symbol, one quote call per chunk.
  const N = CANDIDATE_UNIVERSE.length;
  const QUOTE_CHUNKS = Math.ceil(N / MANDATE_QUOTE_BATCH_SIZE);

  // The corporate-actions fetcher's only network edge. EODHD splits/dividends
  // URLs answer an empty list; anything else is a call this harness never
  // expects, recorded and thrown.
  const fetchSpy = vi.fn(async (url) => {
    if (/^https:\/\/eodhd\.com\/api\/(splits|div)\//.test(String(url))) {
      return { ok: true, status: 200, json: async () => [] };
    }
    throw new Error(`T0c harness: unexpected fetch ${url}`);
  });

  let logs;
  let errs;
  let logSpy;
  let errSpy;
  beforeEach(() => {
    quotesSpy.mockClear();
    fundamentalsSpy.mockClear();
    fetchSpy.mockClear();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubEnv('EODHD_API_KEY', 't0c-harness-key'); // without a key the CA fetcher throws BEFORE fetch — the no-fetch check would be vacuous
    logs = [];
    errs = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((m) => logs.push(String(m)));
    errSpy = vi.spyOn(console, 'error').mockImplementation((m) => errs.push(String(m)));
  });
  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  // The whole store, path-sorted, with versions — "nothing written" is equality.
  const storeImage = (db) => JSON.stringify(
    [...db._store.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([p, e]) => [p, e.data, e.version]),
  );
  const idleLines = () => logs
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((o) => o?.event === 'mandate_idle_skip');
  const fetchCounts = () => ({ quotes: quotesSpy.mock.calls.length, fundamentals: fundamentalsSpy.mock.calls.length, fetch: fetchSpy.mock.calls.length });
  const NO_FETCH = { quotes: 0, fundamentals: 0, fetch: 0 };
  const FULL_BUILD = { quotes: QUOTE_CHUNKS, fundamentals: N, fetch: 2 * N };
  const openBatch = (extra = {}) => ({
    schemaVersion: 1, providerBatchId: 'msgbatch_t0c', tickKey: '2026-08-12_open30', sessionDate: '2026-08-12',
    status: 'open', submittedAt: new Date('2026-08-12T14:00:00Z'), requestCount: 1,
    entries: {}, disposed: {}, billed: {}, agedOutAt: null, drainRequested: false, endedAt: null, harvestedAt: null,
    ...extra,
  });
  // Records every QUERY read on mandateBatches, whatever its chain
  // (where/limit/orderBy/startAfter in any order): each entry is the chain's
  // ops. `onGet(ops, readIndex)` runs before the read and may throw (an
  // injected read failure) or write (a book landing mid-fire). Doc reads
  // (`.doc(id).get()`) pass through unrecorded. Under the default direct
  // transport only the idle check queries this collection, so "a fire with
  // books does today's I/O" is "no entry recorded".
  function hookBatchQueries(db, onGet = async () => {}) {
    const reads = [];
    const realCollection = db.collection;
    const wrap = (q, ops) => new Proxy(q, {
      get(target, prop) {
        if (prop === 'get') {
          return async () => { reads.push(ops); await onGet(ops, reads.length - 1); return target.get(); };
        }
        if (['where', 'limit', 'orderBy', 'startAfter'].includes(prop)) {
          return (...args) => wrap(target[prop](...args), [...ops, [prop, ...args]]);
        }
        return target[prop];
      },
    });
    db.collection = (name) => (name === MANDATE_BATCH_COLLECTION ? wrap(realCollection(name), []) : realCollection(name));
    return reads;
  }
  // The duty read the idle check makes: status 'open', bounded to one doc.
  const DUTY_READ = [['where', 'status', '==', 'open'], ['limit', 1]];

  it('eval, no books and no open batch: one idle line, no fetch, the store untouched, the model never reached', async () => {
    const db = makeMandateFakeDb({ 'archetypeVintages/analyst_x': VINTAGE });
    const before = storeImage(db);
    const batchReads = hookBatchQueries(db);
    const { req, res, captured } = fakeReqRes();
    await runEvalSweep(req, res, { now: EVAL_NOW, tick: EVAL_TICK, db });

    expect(captured.code).toBe(200);
    // complete:false — the sweep never ran, so no claim that every book was served.
    expect(captured.body).toMatchObject({ ok: true, noop: true, reason: 'mandate_idle_skip', complete: false });
    expect(batchReads).toEqual([DUTY_READ]);       // exactly one bounded duty read
    expect(fetchCounts()).toEqual(NO_FETCH);
    expect(storeImage(db)).toBe(before);          // no snapshot, no daily doc, no upstream counter, nothing
    expect(logs).toHaveLength(1);                  // the one structured line and nothing else (brief: "and nothing else")
    expect(idleLines()).toEqual([{
      event: 'mandate_idle_skip', window: 'open30', tickKey: '2026-08-12_open30', date: '2026-08-12',
      activeBooks: 0, outstandingDuty: false,
    }]);
    expect(errs).toEqual([]);
  });

  it.each([
    ['an open submission awaiting harvest', openBatch()],
    ['an aged-out doc awaiting finalisation (provider end, billing)', openBatch({ agedOutAt: new Date('2026-08-12T13:00:00Z'), disposed: { r1: 'expired' } })],
  ])('eval, no books but %s: NOT skipped — the normal build runs and writes the snapshot', async (_label, batchDoc) => {
    const db = makeMandateFakeDb({ [`${MANDATE_BATCH_COLLECTION}/msgbatch_t0c`]: batchDoc });
    const { req, res, captured } = fakeReqRes();
    await runEvalSweep(req, res, { now: EVAL_NOW, tick: EVAL_TICK, db });

    expect(captured.code).toBe(200);
    expect(captured.body).toMatchObject({ ok: true, complete: true }); // the whole fire ran, not just the build
    expect(captured.body.reason).toBeUndefined();
    expect(idleLines()).toEqual([]);
    expect(fetchCounts()).toEqual(FULL_BUILD);
    expect(db._get('mandateUniverseSnapshots/2026-08-12_open30')?.symbolCount).toBe(N);
    expect(db._get('mandateUniverseDaily/2026-08-12')?.symbolCount).toBe(N);
    expect(db._get('mandateUpstreamCalls/2026-08-12')?.count).toBeGreaterThan(0); // the counter moves on a real build
    expect(db._get(`${MANDATE_BATCH_COLLECTION}/msgbatch_t0c`).status).toBe('open'); // untouched under direct transport
  });

  it('CONTROL: a TERMINAL batch doc is no duty — the fire still skips (the selector reads status)', async () => {
    const db = makeMandateFakeDb({ [`${MANDATE_BATCH_COLLECTION}/msgbatch_t0c`]: openBatch({ status: 'harvested' }) });
    const before = storeImage(db);
    const { req, res, captured } = fakeReqRes();
    await runEvalSweep(req, res, { now: EVAL_NOW, tick: EVAL_TICK, db });
    expect(captured.body.reason).toBe('mandate_idle_skip');
    expect(fetchCounts()).toEqual(NO_FETCH);
    expect(storeImage(db)).toBe(before);
  });

  it('eval, a book present: the unchanged path — the build runs, the snapshot carries the universe, the book is evaluated', async () => {
    const db = makeMandateFakeDb({
      'archetypeVintages/analyst_x': VINTAGE,
      'mandates/m1': seedBook({ cadenceTier: 'fast' }),
    });
    modelImpl = async () => ({ decision: { ok: true, input: { verb: 'HOLD', rationale: 'x' } }, usage: null });
    const batchReads = hookBatchQueries(db);
    const { req, res, captured } = fakeReqRes();
    await runEvalSweep(req, res, { now: EVAL_NOW, tick: EVAL_TICK, db });

    expect(captured.code).toBe(200);
    expect(captured.body.ok).toBe(true);
    expect(idleLines()).toEqual([]);
    expect(batchReads).toEqual([]);                // the duty read is lazy: a fire with books does today's I/O
    expect(fetchCounts()).toEqual(FULL_BUILD);
    expect(db._get('mandateUniverseSnapshots/2026-08-12_open30')?.symbolCount).toBe(N);
    expect(modelSpy).toHaveBeenCalledTimes(1);
    expect(db._get('mandates/m1').execState.lastEvalTickKey).toBe('2026-08-12_open30');
    expect(captured.body.evaluated).toBe(1);
  });

  it('recheck: a book created after an idle fire is served by the NEXT fire in the same window (normal build)', async () => {
    const db = makeMandateFakeDb({ 'archetypeVintages/analyst_x': VINTAGE });
    modelImpl = async () => ({ decision: { ok: true, input: { verb: 'HOLD', rationale: 'x' } }, usage: null });

    const first = fakeReqRes();
    await runEvalSweep(first.req, first.res, { now: EVAL_NOW, tick: EVAL_TICK, db });
    expect(first.captured.body.reason).toBe('mandate_idle_skip');
    expect(db._get('mandateUniverseSnapshots/2026-08-12_open30')).toBeUndefined(); // no placeholder marks the window done

    await db.doc('mandates/m1').set(seedBook({ cadenceTier: 'fast' })); // the founder creates a book mid-session

    const batchReads = hookBatchQueries(db);
    const second = fakeReqRes();
    await runEvalSweep(second.req, second.res, { now: new Date(EVAL_NOW.getTime() + 60_000), tick: EVAL_TICK, db });
    expect(second.captured.code).toBe(200);
    expect(second.captured.body.reason).toBeUndefined();
    expect(batchReads).toEqual([]);                          // the book is seen first; no duty read
    expect(idleLines()).toHaveLength(1);                     // only the first fire skipped
    expect(fetchCounts()).toEqual(FULL_BUILD);               // one full build, on the second fire
    expect(db._get('mandateUniverseSnapshots/2026-08-12_open30')?.symbolCount).toBe(N);
    expect(modelSpy).toHaveBeenCalledTimes(1);
    expect(db._get('mandates/m1').execState.lastEvalTickKey).toBe('2026-08-12_open30');
  });

  it('a failed open-batch read falls back to acquisition, never to a skip', async () => {
    const db = makeMandateFakeDb({});
    const batchReads = hookBatchQueries(db, async () => { throw new Error('injected read failure'); });
    const { req, res, captured } = fakeReqRes();
    await runEvalSweep(req, res, { now: EVAL_NOW, tick: EVAL_TICK, db });

    expect(batchReads).toHaveLength(1);            // the injected failure really hit the duty read
    expect(captured.code).toBe(200);
    expect(captured.body).toMatchObject({ ok: true, complete: true });
    expect(captured.body.reason).toBeUndefined();
    expect(idleLines()).toEqual([]);
    expect(errs.some((e) => e.includes('open-batch read failed') && e.includes('injected read failure'))).toBe(true);
    expect(fetchCounts()).toEqual(FULL_BUILD);
    expect(db._get('mandateUniverseSnapshots/2026-08-12_open30')?.symbolCount).toBe(N);
  });

  it('close, no books: no close snapshot, no fetch — the sweep completes and retention cleanup STILL runs', async () => {
    const db = makeMandateFakeDb({});
    const before = storeImage(db);
    const batchReads = hookBatchQueries(db);
    const { req, res, captured } = fakeReqRes();
    await runCloseSweep(req, res, { now: NOW, closeTick: CLOSE_TICK, db });

    expect(captured.code).toBe(200);
    expect(captured.body).toMatchObject({ ok: true, reason: 'mandate_idle_skip', complete: true, closed: 0, errors: 0 });
    expect(batchReads).toEqual([DUTY_READ]);
    expect(fetchCounts()).toEqual(NO_FETCH);
    expect(storeImage(db)).toBe(before);                     // no `_close` snapshot, no daily doc
    expect(retentionSpy).toHaveBeenCalledTimes(1);           // cleanup continues
    expect(idleLines()).toEqual([{
      event: 'mandate_idle_skip', window: 'close', tickKey: '2026-08-12_close', date: '2026-08-12',
      activeBooks: 0, outstandingDuty: false,
    }]);
  });

  it('close, no books but an open batch: NOT skipped — the close snapshot is built as today', async () => {
    const db = makeMandateFakeDb({ [`${MANDATE_BATCH_COLLECTION}/msgbatch_t0c`]: openBatch() });
    const { req, res, captured } = fakeReqRes();
    await runCloseSweep(req, res, { now: NOW, closeTick: CLOSE_TICK, db });

    expect(captured.code).toBe(200);
    expect(captured.body).toMatchObject({ ok: true, complete: true });
    expect(captured.body.reason).toBeUndefined();
    expect(idleLines()).toEqual([]);
    expect(fetchCounts()).toEqual(FULL_BUILD);
    expect(db._get('mandateUniverseSnapshots/2026-08-12_close')?.symbolCount).toBe(N);
    expect(retentionSpy).toHaveBeenCalledTimes(1);
  });

  it('close race: a book that appears after the idle check is deferred untouched (no close, no failure stamp, no retention); the next fire builds and closes it', async () => {
    const db = makeMandateFakeDb({});
    const closed = [];
    closeBookImpl = async (d, ref, args) => {
      closed.push({ id: ref.id, snapshotKey: args.closeSnapshot?.tickKey ?? null });
      return { closed: true, row: { partial: false }, streamRecord: {}, rows: [], monthEstUsd: 0, alerts: [] };
    };
    const book = seedBook({ mandateId: 'late' });
    // The book lands during the FIRST duty read only — after the active-book
    // query came back empty, before the sweep's page query.
    const dutyReads = hookBatchQueries(db, async (_ops, i) => { if (i === 0) await db.doc('mandates/late').set(book); });

    const first = fakeReqRes();
    await runCloseSweep(first.req, first.res, { now: NOW, closeTick: CLOSE_TICK, db });
    expect(dutyReads).toEqual([DUTY_READ]);                       // the injection really ran between the two queries
    expect(first.captured.body).toMatchObject({ reason: 'mandate_idle_skip', complete: false, closed: 0, errors: 0 });
    expect(closed).toEqual([]);                                   // never closed from nothing
    expect(db._get('mandates/late')).toEqual(book);               // exactly as seeded: no failure stamp, no attempt marker
    expect(db._versionOf('mandates/late')).toBe(1);               // the seeding write is the only write
    expect(db._get('mandateUniverseSnapshots/2026-08-12_close')).toBeUndefined();
    expect(retentionSpy).not.toHaveBeenCalled();                  // an unproven sweep never claims completion
    expect(fetchCounts()).toEqual(NO_FETCH);

    const second = fakeReqRes();
    await runCloseSweep(second.req, second.res, { now: new Date(NOW.getTime() + 60_000), closeTick: CLOSE_TICK, db });
    expect(second.captured.code).toBe(200);
    expect(second.captured.body.reason).toBeUndefined();         // the book is seen: no skip
    expect(dutyReads).toHaveLength(1);                            // and no second duty read (lazy with a book)
    expect(fetchCounts()).toEqual(FULL_BUILD);
    expect(closed).toEqual([{ id: 'late', snapshotKey: '2026-08-12_close' }]);
    expect(idleLines()).toHaveLength(1);
  });

  it('batch transport, recheck: an idle fire, then an open batch appears — the next fire builds and its harvest polls the batch', async () => {
    const db = makeMandateFakeDb({});
    retrieveImpl = vi.fn(async () => ({ processing_status: 'in_progress' }));

    const first = fakeReqRes();
    await runEvalSweep(first.req, first.res, { now: EVAL_NOW, tick: EVAL_TICK, db, transport: 'batch' });
    expect(first.captured.body).toMatchObject({ ok: true, reason: 'mandate_idle_skip', complete: false });
    expect(first.captured.body.harvest).toBeUndefined();          // nothing open to harvest
    expect(retrieveImpl).not.toHaveBeenCalled();

    await db.doc(`${MANDATE_BATCH_COLLECTION}/msgbatch_t0c`).set(openBatch()); // a submission is now in flight

    const second = fakeReqRes();
    await runEvalSweep(second.req, second.res, { now: new Date(EVAL_NOW.getTime() + 60_000), tick: EVAL_TICK, db, transport: 'batch' });
    expect(second.captured.code).toBe(200);
    expect(second.captured.body).toMatchObject({ ok: true, complete: true });
    expect(second.captured.body.reason).toBeUndefined();
    expect(second.captured.body.harvest).toMatchObject({ polled: 1, errors: 0 }); // the duty is served
    expect(retrieveImpl).toHaveBeenCalledWith('msgbatch_t0c');
    expect(fetchCounts()).toEqual(FULL_BUILD);
    expect(db._get('mandateUniverseSnapshots/2026-08-12_open30')?.symbolCount).toBe(N);
    expect(idleLines()).toHaveLength(1);
  });
});
