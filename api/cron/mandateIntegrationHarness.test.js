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
// requirements (a)-(e) from the P4 kickoff.
//
// SUBSTRATE CHOICE (stated per the kickoff): a transaction-faithful in-memory
// fake, not the Firestore emulator. The emulator is wired in the repo for
// security-RULES only (test:rules, Java-gated, auto-skips), gives nondeterministic
// interleaving, and would pull the mandate suite off its fast-fake idiom. The
// fake models the real Admin-SDK contract (read-set-validated revision
// precondition + retry + create-if-absent) AND offers a deterministic barrier to
// force "A reads, B commits, A retries" — impossible to script against a real
// emulator.

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
vi.mock('../_utils/mandateModelCall.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, callMandateModelDirect: (...args) => modelSpy(...args) };
});

// Imported AFTER the mocks are registered (vi.mock is hoisted, so order is fine).
import { runCloseSweep, runEvalSweep } from './mandate-evaluate.js';
import { makeMandateFakeDb } from '../_utils/__testsupport__/mandateFakeFirestore.js';
import { buildNewMandateDoc } from '../_utils/mandateSchema.js';

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
    gateConfig: { cashFloorPct: 0.02, minPositions: 5, maxPositions: 15, maxSinglePositionWeightPct: 0.35, sectorConcentrationCap: 0.30, decisionVerbs: ['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD'] },
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
