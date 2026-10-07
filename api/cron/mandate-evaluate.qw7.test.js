// api/cron/mandate-evaluate.qw7.test.js
//
// EODHD Quick Wins QW-7 (build report docs/audits/20261007_BUILD_EODHD_QUICK_WINS.md §2):
// mandate evaluation does nothing EODHD-billed when there is nothing to mark —
// zero active books AND zero open batches — on BOTH sweeps.
//
// The REAL exported sweep drivers (runEvalSweep / runCloseSweep) over the
// transaction-faithful Firestore fake, the mandateIntegrationHarness idiom. The
// two snapshot builders — the ONLY place these sweeps reach EODHD (census §2.2:
// mandateUniverseSnapshot.js `/real-time/`, `/splits/`, `/div/`, fundamentals) —
// are counting spies that write a stub snapshot, and the global fetch is a spy
// that must stay silent where the gate holds.
//
//   • flag ON, zero books, zero open batches: no build, no vendor call; the eval
//     sweep returns `no_active_books`; the close sweep still runs its completion
//     duty (retention cleanup) exactly as a zero-book day does today;
//   • an open batch with zero books keeps the build (it is harvested against it);
//   • flag OFF with zero books builds, as today;
//   • ONE book: flag OFF and flag ON are indistinguishable — same response, same
//     builder calls, same final store — on both sweeps.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const flag = vi.hoisted(() => ({ on: false }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get EODHD_QUICK_WINS_ENABLED() { return flag.on; } };
});

// The snapshot builders: counting spies that write what the real ones would key.
const builds = vi.hoisted(() => ({ daily: [], universe: [] }));
vi.mock('../_utils/mandateUniverseSnapshot.js', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    ensureDailySnapshot: async (db, args) => {
      builds.daily.push({ date: args.date, heldTickers: [...args.heldTickers].sort() });
      const ref = db.collection('mandateUniverseDaily').doc(args.date);
      await ref.set({ date: args.date, sectors: {} });
      return { ref };
    },
    ensureUniverseSnapshot: async (db, args) => {
      builds.universe.push({ tickKey: args.tickKey, heldTickers: [...args.heldTickers].sort() });
      const snapshot = { tickKey: args.tickKey, symbols: { AAPL: { complete: true, price: 200, sector: 'Technology' } } };
      await db.collection(actual.SNAPSHOT_COLLECTION).doc(args.tickKey).set(snapshot);
      return { snapshot };
    },
  };
});

let closeBookImpl = null;
const retentionSpy = vi.fn(async () => {});
vi.mock('../_utils/mandateClosePass.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, closeBook: (...a) => closeBookImpl(...a), runRetentionCleanup: (...a) => retentionSpy(...a) };
});
const modelSpy = vi.fn(async () => ({ decision: { ok: true, input: { verb: 'HOLD', rationale: 'x' } }, usage: null }));
vi.mock('../_utils/mandateModelCall.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, callMandateModelDirect: (...a) => modelSpy(...a) };
});

import { runCloseSweep, runEvalSweep } from './mandate-evaluate.js';
import { makeMandateFakeDb } from '../_utils/__testsupport__/mandateFakeFirestore.js';
import { buildNewMandateDoc } from '../_utils/mandateSchema.js';

function fakeReqRes() {
  const captured = {};
  const res = { status(c) { captured.code = c; return this; }, json(b) { captured.body = b; return this; } };
  return { req: { headers: { 'x-vercel-cron': '1' }, method: 'POST' }, res, captured };
}
function seedBook(id = 'm1') {
  return buildNewMandateDoc({
    mandateId: id, userId: 'u1', archetype: 'analyst', managerAgentId: 'mgr_analyst_x',
    vintageRef: 'archetypeVintages/analyst_x', cadenceTier: 'fast',
    createdAt: new Date('2026-06-01T13:00:00Z'), quarterStartAt: new Date('2026-06-01T13:00:00Z'),
    nextRolloverAt: new Date('2026-09-01T20:00:00Z'), escapeHatchEligibleUntil: new Date('2026-06-15T13:00:00Z'),
  });
}
const VINTAGE = {
  codeId: 'analyst', displayVintage: 'Fundamental Investor v2',
  archetypeContent: { displayName: 'Fundamental Investor', identity: { reveal: 'You buy good businesses.', voice: 'v' }, character: { factors: {} } },
  gateConfig: { cashFloorPct: 0.02, minPositions: 5, maxPositions: 15, maxSinglePositionWeightPct: 0.35, sectorConcentrationCap: 0.30, decisionVerbs: ['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD'] },
  modelSeat: { model: 'claude-haiku-4-5-20251001', params: { temperature: 0.7, maxTokens: 600 } },
};
const EVAL_TICK = { date: '2026-08-12', slot: 'open30', tickKey: '2026-08-12_open30' };
const EVAL_NOW = new Date('2026-08-12T14:05:00Z');
const CLOSE_TICK = { date: '2026-08-12', closeKey: '2026-08-12_close' };
const CLOSE_NOW = new Date('2026-08-12T20:30:00Z');

let fetchSpy;
beforeEach(() => {
  flag.on = false;
  // A pinned wall clock: the close path stamps new Date() (e.g. failedAt) and the
  // flag-off / flag-on comparison must not see a millisecond apart.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-08-12T20:30:00Z'));
  builds.daily.length = 0;
  builds.universe.length = 0;
  retentionSpy.mockClear();
  modelSpy.mockClear();
  closeBookImpl = async () => ({ closed: true, row: { partial: false }, streamRecord: {}, rows: [], monthEstUsd: 0, alerts: [] });
  fetchSpy = vi.fn(async () => { throw new Error('no network in this suite'); });
  globalThis.fetch = fetchSpy;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const evalSweep = async (db) => { const { req, res, captured } = fakeReqRes(); await runEvalSweep(req, res, { now: EVAL_NOW, tick: EVAL_TICK, db, transport: 'direct' }); return captured; };
const closeSweep = async (db) => { const { req, res, captured } = fakeReqRes(); await runCloseSweep(req, res, { now: CLOSE_NOW, closeTick: CLOSE_TICK, db }); return captured; };

describe('QW-7 — flag ON, nothing to mark: no snapshot build, no vendor call', () => {
  it('eval sweep: zero books + zero open batches → no build, no fetch, `no_active_books`, no snapshot written', async () => {
    flag.on = true;
    const db = makeMandateFakeDb();
    const out = await evalSweep(db);
    expect(builds).toEqual({ daily: [], universe: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(out.code).toBe(200);
    expect(out.body).toEqual(expect.objectContaining({ ok: true, noop: true, reason: 'no_active_books' }));
    expect(db._get('mandateUniverseSnapshots/2026-08-12_open30')).toBeUndefined();
  });

  it('close sweep: zero books + zero open batches → no build, no fetch, and the completion duty still runs (retention)', async () => {
    flag.on = true;
    const db = makeMandateFakeDb();
    const out = await closeSweep(db);
    expect(builds).toEqual({ daily: [], universe: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(out.body).toEqual(expect.objectContaining({ ok: true, complete: true }));
    expect(retentionSpy).toHaveBeenCalledTimes(1);
    expect(db._get('mandateUniverseSnapshots/2026-08-12_close')).toBeUndefined();
  });

  it('an OPEN BATCH with zero books keeps the build (it is harvested against the snapshot)', async () => {
    flag.on = true;
    const db = makeMandateFakeDb({ 'mandateBatches/b1': { providerBatchId: 'b1', status: 'open' } });
    await evalSweep(db);
    expect(builds.universe).toHaveLength(1);
    const db2 = makeMandateFakeDb({ 'mandateBatches/b1': { providerBatchId: 'b1', status: 'open' } });
    await closeSweep(db2);
    expect(builds.universe).toHaveLength(2);
  });

  it('a CLOSED batch does not count as open', async () => {
    flag.on = true;
    await evalSweep(makeMandateFakeDb({ 'mandateBatches/b1': { providerBatchId: 'b1', status: 'harvested' } }));
    expect(builds.universe).toHaveLength(0);
  });
});

describe('QW-7 — flag OFF: zero books still builds, exactly as before', () => {
  it('eval and close sweeps both build with zero books', async () => {
    const out = await evalSweep(makeMandateFakeDb());
    await closeSweep(makeMandateFakeDb());
    expect(builds.daily).toHaveLength(2);
    expect(builds.universe.map((b) => b.tickKey)).toEqual(['2026-08-12_open30', '2026-08-12_close']);
    expect(out.body.reason).not.toBe('no_active_books');
  });
});

describe('QW-7 — ONE book: flag OFF and flag ON are indistinguishable', () => {
  const seeded = () => makeMandateFakeDb({ 'archetypeVintages/analyst_x': VINTAGE, 'mandates/m1': seedBook('m1') });
  const snapshotOf = (db) => JSON.parse(JSON.stringify(Object.fromEntries([...db._store.entries()].map(([p, e]) => [p, e.data]))));

  it('eval sweep: same response, same builder calls, same model calls, same final store', async () => {
    const offDb = seeded();
    const off = await evalSweep(offDb);
    const offBuilds = structuredClone(builds);
    const offModel = modelSpy.mock.calls.length;
    builds.daily.length = 0; builds.universe.length = 0; modelSpy.mockClear();

    flag.on = true;
    const onDb = seeded();
    const on = await evalSweep(onDb);
    expect(on).toEqual(off);
    expect(builds).toEqual(offBuilds);
    expect(offBuilds.universe).toHaveLength(1);
    expect(modelSpy.mock.calls.length).toBe(offModel);
    expect(snapshotOf(onDb)).toEqual(snapshotOf(offDb));
  });

  it('close sweep: same response, same builder calls, same closes, same final store', async () => {
    const offDb = seeded();
    const off = await closeSweep(offDb);
    const offBuilds = structuredClone(builds);
    builds.daily.length = 0; builds.universe.length = 0;

    flag.on = true;
    const onDb = seeded();
    const on = await closeSweep(onDb);
    expect(on).toEqual(off);
    expect(off.body.closed).toBe(1);
    expect(builds).toEqual(offBuilds);
    expect(snapshotOf(onDb)).toEqual(snapshotOf(offDb));
  });
});
