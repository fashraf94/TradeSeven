// api/cron/agent-evaluate.pool.test.js
//
// Capacity Build 1, Part 1 — THE POOL in the real handler
// (docs/audits/20261115_BUILD_EVAL_CAPACITY_1.md). The dispatcher's own rows
// are in api/_utils/evalPool.test.js; these prove the wiring:
//   · K = 2 and K = 3 keep at most K battles in flight, and reach K;
//   · each battle runs in its OWN capture scope, never one shared by a batch;
//   · a battle that throws gets its own catch (its cronErrors receipt) and the
//     others in flight finish;
//   · deferred = never dispatched, in rotation order; no start after the
//     cutoff; an in-flight battle is never deferred;
//   · the handler awaits every battle in flight before the run record;
//   · League group-mates (same string `groupId`) never overlap, and a
//     passed-over mate runs when its mate finishes;
//   · the run record's `pool` block.
//
// The seam is the REAL exported handler and the real processAgentBattle; the
// market data, the model, the ledger, the sweeps and firebase are doubled (the
// evalRun suite's world). Each CPU battle holds one symbol of its own, and the
// doubled market-data fetch for that symbol WAITS on a gate the row opens — so
// "in flight" is exact: the battle has entered its fan-out and not finished.
// Time is a fake clock moved only where a row says so.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeRankingsDoc, makeTechDocs, makePriceTable, deepClone, FROZEN_NOW } from '../_utils/__fixtures__/tickStampsHarness.js';
import { TOURNAMENT_GAME_MODE } from '../../src/constants/leagueTournament.js';

const mocks = vi.hoisted(() => ({ getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn() }));
const world = vi.hoisted(() => ({ db: null, battles: null }));
const flags = vi.hoisted(() => ({ k: 1, cutoff: 200_000, capture: false }));
const scopes = vi.hoisted(() => ({ created: [], seen: new Map() }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock { constructor() { this.messages = { create: (...a) => mocks.create(...a) }; } },
}));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.getStockAnalysisData,
  fetchIntradayBatch: mocks.fetchIntradayBatch,
  fetchIntradayCandles: vi.fn(async () => []),
  filterToLatestSession: vi.fn((c) => ({ candles: c || [], sessionDate: '2026-09-09' })),
}));
vi.mock('../_utils/marketSchedule.js', async (importOriginal) => ({ ...(await importOriginal()), isMarketOpen: () => true }));
vi.mock('../_utils/agentBattleService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  findActiveAgentBattles: vi.fn(async () => world.battles.map(deepClone)),
}));
vi.mock('../_utils/canonicalOpenSweep.js', () => ({ runCanonicalOpenSweep: vi.fn(async () => ({ skipped: true })) }));
vi.mock('../_utils/masterySettlement.js', async (importOriginal) => ({ ...(await importOriginal()), runRepairSweep: vi.fn(async () => ({ scanned: 0 })) }));
vi.mock('../_utils/tournamentAgentLedger.js', () => ({
  resolveTournamentContext: vi.fn(async () => null), excludeHeldByOthers: vi.fn(), excludeHeldSymbols: vi.fn(),
  reserveSymbol: vi.fn(), confirmSwap: vi.fn(), releaseReservation: vi.fn(),
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => world.db }));
vi.mock('../_utils/battlePatternLogger.js', () => ({ logBattlePattern: vi.fn(async () => {}) }));
vi.mock('../_utils/voiceLayerAnticipation.js', async (importOriginal) => ({ ...(await importOriginal()), generateAnticipation: vi.fn(async () => null) }));
vi.mock('../_utils/voiceLayerTradeNarration.js', async (importOriginal) => ({ ...(await importOriginal()), generateTradeNarration: vi.fn(async () => null) }));
vi.mock('../_utils/shadowLogger.js', async (importOriginal) => ({
  ...(await importOriginal()), logEvaluation: vi.fn(async () => false), logVisionTransition: vi.fn(async () => false), logAnticipation: vi.fn(async () => false),
}));
// The capture scope seam, observed: every scope the handler mints is recorded.
vi.mock('../_utils/tickCapture/captureContext.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, newTickCaptureScope: () => { const s = real.newTickCaptureScope(); scopes.created.push(s); return s; } };
});
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get TICK_CAPTURE_ENABLED() { return flags.capture; },
  get EVAL_POOL_K() { return flags.k; },
  get EVAL_POOL_START_CUTOFF_MS() { return flags.cutoff; },
}));

const { default: handler } = await import('./agent-evaluate.js');
const { currentCaptureScope } = await import('../_utils/tickCapture/captureContext.js');

const FROZEN_MS = Date.parse(FROZEN_NOW);
const advance = (ms) => { vi.setSystemTime(new Date(Date.now() + ms)); };
const tick = () => new Promise((r) => setTimeout(r, 0)); // a real macrotask: the clock fakes Date only
async function settle(n = 6) { for (let i = 0; i < n; i++) await tick(); }

// ---------------------------------------------------------------------------
// The world

/** A CPU battle holding ONE symbol of its own (`X_<id>`): its fan-out waits on that symbol's gate. */
function cpuBattle(id, overrides = {}) {
  const sym = `X_${id}`;
  return {
    id, isCpu: true, agentId: `agent-${id}`, ownerId: `owner-${id}`, status: 'active',
    activatedAt: FROZEN_NOW, expiresAt: '2026-09-10T00:00:00.000Z',
    strategyPreset: 'balanced', timing: { tradingDays: [] }, agentContext: {},
    executionMode: 'copilot', pendingProposal: null, proposalHistory: [], battleLedger: [],
    statusFeed: [], gameplanMeeting: null, gameplanMeetingHistory: [], chatExchanges: [],
    chatBudgetUsed: 0, dailyReviews: [], dailyGrades: {},
    trades: [], scoreState: { peakScore: 0, bankedBadgePoints: { total: 0 } }, thresholdHistory: {},
    cronState: { evaluatingAt: null, vwapTicks: {}, intradayMomentum: {}, stagnationTicks: {}, lastTickPrice: {}, lastTickTimestamp: {}, vwapFireGuard: {} },
    portfolio: { star: [{ symbol: sym, baseATR: 3.1, direction: null }], core: [], support: [], bench: { stocks: [], crypto: null }, startingPrices: { [sym]: 100 } },
    opponent: { portfolio: { star: [], core: [], support: [], bench: { stocks: [], crypto: null }, startingPrices: {} } },
    ...overrides,
  };
}

/** A League battle in its real shape: the tournament mode and the group stamp resolveTournamentContext reads. */
const leagueBattle = (id, groupId) => cpuBattle(id, { gameMode: TOURNAMENT_GAME_MODE, groupId, isCpu: true });

const isSentinel = (v) => !!v && typeof v === 'object' && typeof v.isEqual === 'function';
function setPath(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

/**
 * Battles in one store, run documents in another, every battle write in order; `costs[id]` is charged at its
 * final score write; `failFinalWrite` ids throw on that final write (and only on it), so their catch's own
 * receipt still lands; capture records (written in a batch) are kept in `__captures`.
 */
function makeRunDb({ battles, costs = {}, missing = [], failFinalWrite = [] }) {
  const docs = new Map(battles.filter((b) => !missing.includes(b.id)).map((b) => [b.id, deepClone(b)]));
  const writes = [];
  const runDocs = [];
  const locks = [];
  const captures = [];
  const shared = {
    'indexIntelligence/stockRankings': makeRankingsDoc(),
    ...Object.fromEntries(Object.entries(makeTechDocs()).map(([s, d]) => [`stockTechnicalScores/${s}`, d])),
  };
  const snap = (id, data) => ({ exists: data != null, id, data: () => (data == null ? undefined : deepClone(data)) });
  const emptyQuery = { where: () => emptyQuery, orderBy: () => emptyQuery, limit: () => emptyQuery, startAfter: () => emptyQuery, get: async () => ({ docs: [], empty: true, size: 0 }) };
  function writeBattle(id, payload) {
    if (!docs.has(id)) throw new Error(`5 NOT_FOUND: no document to update: agentBattles/${id}`);
    if (failFinalWrite.includes(id) && Object.hasOwn(payload, 'scoreState.lastScoredAt')) throw new Error(`14 UNAVAILABLE: final write refused for ${id}`);
    writes.push({ id, payload: deepClone(payload) });
    for (const [k, v] of Object.entries(payload)) if (!isSentinel(v)) setPath(docs.get(id), k, deepClone(v));
    if (Object.hasOwn(payload, 'scoreState.lastScoredAt') && costs[id]) advance(costs[id]);
  }
  const genericRef = (col, id) => ({
    id, path: `${col}/${id}`,
    get: async () => snap(id, shared[`${col}/${id}`] ?? null),
    set: async () => {}, // capture records, when the row turns capture on — accepted, not examined here
    update: async () => {},
    create: async () => {},
    collection: (sub) => ({ doc: (subId) => genericRef(`${col}/${id}/${sub}`, subId) }),
  });
  const battleRef = (id) => ({
    id, path: `agentBattles/${id}`,
    get: async () => snap(id, docs.get(id) ?? null),
    update: async (payload) => writeBattle(id, payload),
    collection: (sub) => ({ doc: (subId) => genericRef(`agentBattles/${id}/${sub}`, subId) }),
  });
  return {
    collection(col) {
      return {
        doc: (id) => {
          if (col === 'agentBattles') return battleRef(id);
          if (col === 'agentEvalRuns') return { id, path: `agentEvalRuns/${id}`, set: async (data) => { runDocs.push({ id, data: deepClone(data) }); } };
          return genericRef(col, id);
        },
        where: () => emptyQuery, orderBy: () => emptyQuery, limit: () => emptyQuery,
        get: async () => ({ docs: [], empty: true, size: 0 }),
      };
    },
    getAll: async (...refs) => Promise.all(refs.map((r) => r.get())),
    runTransaction: async (cb) => cb({
      get: (ref) => { locks.push(ref.id); return ref.get(); },
      update: (ref, payload) => { const [col, id] = ref.path.split('/'); if (col !== 'agentBattles') throw new Error(`unexpected tx update ${ref.path}`); writeBattle(id, payload); },
      set: () => {}, create: () => {},
    }),
    batch: () => {
      const ops = [];
      const b = {
        set: (ref, data) => { ops.push({ path: ref.path, data: deepClone(data) }); return b; },
        update: () => b, create: () => b,
        commit: async () => { captures.push(...ops); },
      };
      return b;
    },
    __writes: writes, __runDocs: runDocs, __locks: locks, __captures: captures,
  };
}

/** The gates: `X_<id>` waits until released; `entered` lists battles that reached their fan-out. */
function makeGates() {
  const pending = new Map();
  const entered = [];
  const prices = makePriceTable();
  mocks.getStockAnalysisData.mockImplementation(async (s) => {
    if (!s.startsWith('X_')) return prices[s] ? { price: prices[s], daily: [] } : {};
    const id = s.slice(2);
    entered.push(id);
    const scope = currentCaptureScope();
    scopes.seen.set(id, scope);
    if (!pending.has(id)) {
      let release;
      const p = new Promise((r) => { release = r; });
      pending.set(id, { p, release });
    }
    await pending.get(id).p;
    return { price: { current: 101, previousClose: 100, change: 1, changePercent: 1 }, daily: [] };
  });
  return {
    entered,
    open: (id) => {
      if (!pending.has(id)) { let release; const p = new Promise((r) => { release = r; }); pending.set(id, { p, release }); }
      pending.get(id).release();
    },
  };
}

function finishedIds(db) {
  return db.__writes.filter((w) => Object.hasOwn(w.payload, 'scoreState.lastScoredAt')).map((w) => w.id);
}

async function startHandler(battles, opts = {}) {
  world.battles = battles;
  world.db = makeRunDb({ battles, ...opts });
  const res = { statusCode: null, payload: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (p) => { res.payload = p; return res; };
  const done = handler({ headers: { 'x-vercel-cron': '1' } }, res).then(() => res);
  return { db: world.db, done };
}

/** In flight now = entered its fan-out, not yet finished. */
const inFlight = (gates, db) => gates.entered.filter((id) => !finishedIds(db).includes(id));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  flags.k = 1; flags.cutoff = 200_000; flags.capture = false;
  scopes.created.length = 0; scopes.seen.clear();
  mocks.getStockAnalysisData.mockReset();
  mocks.fetchIntradayBatch.mockReset();
  mocks.fetchIntradayBatch.mockImplementation(async () => ({}));
  mocks.create.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); world.db = null; world.battles = null; });

// ---------------------------------------------------------------------------

describe('K battles in flight — never more', () => {
  for (const k of [2, 3]) {
    it(`K = ${k}: at most ${k} battles are in flight at any moment, and ${k} are reached`, async () => {
      flags.k = k;
      const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
      const gates = makeGates();
      const { db, done } = await startHandler(ids.map((id) => cpuBattle(id)));
      let peak = 0;
      for (let guard = 0; guard < 40; guard++) {
        await settle();
        const now = inFlight(gates, db);
        peak = Math.max(peak, now.length);
        expect(now.length, `in flight: ${now.join(',')}`).toBeLessThanOrEqual(k);
        if (finishedIds(db).length === ids.length) break;
        if (now.length) gates.open(now[now.length - 1]); // release the NEWEST: order must not matter
      }
      const res = await done;
      expect(peak).toBe(k);
      expect(finishedIds(db).sort()).toEqual([...ids].sort());
      expect(res.statusCode).toBe(200);
      const run = db.__runDocs[0].data;
      expect(run.pool).toEqual({ k, startCutoffMs: 200_000, maxInFlight: k, dispatched: 6 });
      expect(run.evaluated).toBe(6);
    });
  }

  it('K = 1 (the merged value): one at a time, in rotation order, and the record says so', async () => {
    const ids = ['s1', 's2', 's3'];
    const gates = makeGates();
    const { db, done } = await startHandler(ids.map((id) => cpuBattle(id)));
    for (const id of ids) {
      await settle();
      expect(inFlight(gates, db)).toEqual([id]);
      gates.open(id);
    }
    await done;
    expect(db.__locks).toEqual(ids);
    expect(db.__runDocs[0].data.pool).toEqual({ k: 1, startCutoffMs: 290_000, maxInFlight: 1, dispatched: 3 });
  });

  it('with the cuts flag off (merged), each battle fetches the macros itself — no run share is prepared', async () => {
    const gates = makeGates();
    const { done } = await startHandler([cpuBattle('u1'), cpuBattle('u2')]);
    await settle(); gates.open('u1'); await settle(); gates.open('u2');
    await done;
    const spyCalls = mocks.getStockAnalysisData.mock.calls.filter(([s]) => s === 'SPY');
    expect(spyCalls).toHaveLength(2); // one per battle, inside each battle's fan-out
    for (const [, opts] of spyCalls) expect(opts).toEqual({ forceRefresh: true, fields: ['daily', 'price'] });
  });

  it('review PL-3: a run with no active battle records the settings in force and nothing dispatched', async () => {
    const one = await startHandler([]);
    await one.done;
    expect(one.db.__runDocs[0].data.pool).toEqual({ k: 1, startCutoffMs: 290_000, maxInFlight: 0, dispatched: 0 });
    flags.k = 3;
    const three = await startHandler([]);
    await three.done;
    expect(three.db.__runDocs[0].data.pool).toEqual({ k: 3, startCutoffMs: 200_000, maxInFlight: 0, dispatched: 0 });
  });

  it('a malformed setting (K = 9) runs as K = 1', async () => {
    flags.k = 9;
    const gates = makeGates();
    const { db, done } = await startHandler([cpuBattle('m1'), cpuBattle('m2')]);
    await settle();
    expect(inFlight(gates, db)).toEqual(['m1']);
    gates.open('m1'); await settle(); gates.open('m2');
    await done;
    expect(db.__runDocs[0].data.pool).toMatchObject({ k: 1, maxInFlight: 1 });
  });
});

describe('one capture scope per battle, one catch per battle', () => {
  it('two battles in flight at once each run inside their OWN scope (capture on)', async () => {
    flags.k = 2; flags.capture = true;
    const gates = makeGates();
    const { db, done } = await startHandler([cpuBattle('c1'), cpuBattle('c2')]);
    await settle();
    expect(inFlight(gates, db).sort()).toEqual(['c1', 'c2']); // both in flight together
    const s1 = scopes.seen.get('c1');
    const s2 = scopes.seen.get('c2');
    expect(s1).toBeTruthy();
    expect(s2).toBeTruthy();
    expect(s1).not.toBe(s2);
    expect(scopes.created).toHaveLength(2);
    expect(scopes.created).toContain(s1);
    expect(scopes.created).toContain(s2);
    gates.open('c1'); gates.open('c2');
    await done;
  });

  it('review PL-1: a battle that throws IN FLIGHT beside another gets its OWN receipt and its OWN abandoned capture; the other finishes untouched', async () => {
    flags.k = 2; flags.capture = true;
    const gates = makeGates();
    // e1 starts first, ok1 second; e1's final score write throws while ok1 is still in flight.
    const { db, done } = await startHandler([cpuBattle('e1'), cpuBattle('ok1')], { failFinalWrite: ['e1'] });
    await settle();
    expect(inFlight(gates, db).sort()).toEqual(['e1', 'ok1']);
    gates.open('e1');
    await settle();
    expect(inFlight(gates, db)).toContain('ok1'); // ok1 has not finished when e1's catch runs
    gates.open('ok1');
    const res = await done;
    const receipts = db.__writes.filter((w) => Object.hasOwn(w.payload, 'cronState.cronErrors'));
    expect(receipts.map((w) => w.id)).toEqual(['e1']);
    expect(receipts[0].payload['cronState.cronErrors'].at(-1).error).toContain('final write refused for e1');
    const tickOf = (id) => db.__captures.filter((c) => c.path.startsWith(`agentBattles/${id}/ticks/`)).map((c) => c.data.exitReason);
    expect(tickOf('e1')).toEqual(['tick_error']);
    expect(tickOf('ok1')).toEqual(['cpu_passive']);
    expect(finishedIds(db)).toEqual(['ok1']);
    expect(res.payload.errors).toBe(1);
  });

  it('a battle that throws gets its own receipt; the battle in flight beside it finishes', async () => {
    flags.k = 2;
    const gates = makeGates();
    // e1's document is gone: its lock transaction throws NOT_FOUND → the handler's per-battle catch.
    const { db, done } = await startHandler([cpuBattle('e1'), cpuBattle('ok1'), cpuBattle('ok2')], { missing: ['e1'] });
    await settle();
    gates.open('ok1');
    await settle();
    gates.open('ok2');
    const res = await done;
    expect(finishedIds(db).sort()).toEqual(['ok1', 'ok2']);
    expect(res.payload.errors).toBe(1);
    expect(db.__runDocs[0].data).toMatchObject({ evaluated: 2, deferred: 0 });
  });
});

describe('deferral, the cutoff, and waiting for the battles in flight', () => {
  it('K = 2: no start after the cutoff; the battles in flight finish; deferred = never started, in rotation order', async () => {
    flags.k = 2;
    const gates = makeGates();
    const ids = ['d1', 'd2', 'd3', 'd4', 'd5'];
    // d1 finishing charges 201 s: past the 200 s cutoff, while d2 is still in flight.
    const { db, done } = await startHandler(ids.map((id) => cpuBattle(id)), { costs: { d1: 201_000 } });
    await settle();
    expect(inFlight(gates, db).sort()).toEqual(['d1', 'd2']);
    gates.open('d1');
    await settle();
    expect(gates.entered).toEqual(['d1', 'd2']); // nothing started after the cutoff
    expect(db.__runDocs).toHaveLength(0); // d2 is in flight: no record yet
    gates.open('d2');
    const res = await done;
    expect(finishedIds(db).sort()).toEqual(['d1', 'd2']);
    expect(db.__locks).toEqual(['d1', 'd2']); // the deferred never took a lock
    const run = db.__runDocs[0].data;
    expect(run.deferredBattleIds).toEqual(['d3', 'd4', 'd5']);
    expect(run.deferred).toBe(3);
    expect(run.evaluated).toBe(2);
    expect(run.pool).toEqual({ k: 2, startCutoffMs: 200_000, maxInFlight: 2, dispatched: 2 });
    expect(res.payload).toMatchObject({ deferred: 3, skipped: 3 });
  });

  it('K = 2 starts a battle at exactly the cutoff, and not 1 ms after it', async () => {
    flags.k = 2;
    const gates = makeGates();
    const { db, done } = await startHandler(['e1', 'e2', 'e3', 'e4'].map((id) => cpuBattle(id)), { costs: { e1: 200_000, e3: 1 } });
    await settle();
    gates.open('e1'); // elapsed = 200 000 ms exactly → e3 starts
    await settle();
    expect(gates.entered).toEqual(['e1', 'e2', 'e3']);
    gates.open('e3'); // elapsed = 200 001 ms → e4 is deferred
    await settle();
    gates.open('e2');
    await done;
    expect(db.__runDocs[0].data.deferredBattleIds).toEqual(['e4']);
  });

  it('K = 1 keeps TIME_BUDGET_MS as its rule, not the pool cutoff', async () => {
    const gates = makeGates();
    const { db, done } = await startHandler(['f1', 'f2', 'f3'].map((id) => cpuBattle(id)), { costs: { f1: 250_000, f2: 41_000 } });
    await settle(); gates.open('f1');
    await settle(); expect(gates.entered).toEqual(['f1', 'f2']); // 250 s > 200 s, yet ≤ 290 s: K = 1 still starts
    gates.open('f2');
    await done;
    expect(db.__runDocs[0].data.deferredBattleIds).toEqual(['f3']); // 291 s > 290 s
  });
});

describe('League group affinity', () => {
  it('group-mates never overlap; the passed-over mate starts when its mate finishes, ahead of later battles', async () => {
    flags.k = 2;
    const gates = makeGates();
    const battles = [leagueBattle('a1', 'grp-1'), leagueBattle('a2', 'grp-1'), cpuBattle('b1'), cpuBattle('b2')];
    const { db, done } = await startHandler(battles);
    await settle();
    expect(inFlight(gates, db).sort()).toEqual(['a1', 'b1']); // a2 passed over while a1 runs
    gates.open('b1');
    await settle();
    expect(inFlight(gates, db).sort()).toEqual(['a1', 'b2']); // still not a2
    gates.open('a1');
    await settle();
    expect(inFlight(gates, db).sort()).toEqual(['a2', 'b2']); // a2 now
    gates.open('a2'); gates.open('b2');
    await done;
    expect(db.__locks).toEqual(['a1', 'b1', 'b2', 'a2']);
  });
});
