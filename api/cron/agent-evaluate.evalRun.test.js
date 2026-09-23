// api/cron/agent-evaluate.evalRun.test.js
//
// Eval-cron instrumentation (build report docs/audits/20260923_BUILD_EVAL_DEFERRED_BEAT.md;
// discovery docs/audits/20260918_PHASE0_EVAL_CRON_SCALING.md :271, :293 R2, :298 R7).
//
//   D1  `tickMs` on every evaluation entry — admission (the lock) → the
//       authoritative final update.
//   D2  agentEvalRuns/{runId}, one measurement document per evaluation run,
//       ALWAYS ON: `lockSkipped` and `deferred` counted apart (`skipped` stays
//       their sum), the deferred battles listed, the write bounded and
//       non-fatal, and sent BEFORE the response.
//   D3  the deferred beat, dark behind EVAL_DEFERRED_BEAT_ENABLED: one
//       `check_deferred` status-feed entry per unreached battle, capped at 25,
//       none unless 5 s of the hard ceiling remain.
//
// The seam is the REAL exported handler (and, for D1, the real
// processAgentBattle), never a re-implementation of its loop: the market data,
// the model, the tournament ledger, the sweeps and firebase init are doubled,
// the sequence between them is production code. Time is a FAKE CLOCK, advanced
// only where a row says so — a tick "costs" what its fixture charges at its own
// final score write — so every elapsed figure below is exact arithmetic.
//
// Flags: tick capture is mocked FALSE (the legacy-fixture rule: this suite's
// world has no capture store), and the beat flag is a getter each row sets,
// so both of its states run against one module graph.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FieldValue } from 'firebase-admin/firestore';
import {
  FROZEN_NOW,
  makeTickBattle,
  makePriceTable,
  makeRankingsDoc,
  makeTechDocs,
  makeIntradayCandles,
  makeHoldResult,
  makeToolUseResponse,
  makeTickDb,
  deepClone,
  TIMING_ENTRY_KEYS,
} from '../_utils/__fixtures__/tickStampsHarness.js';

const mocks = vi.hoisted(() => ({
  getStockAnalysisData: vi.fn(),
  fetchIntradayBatch: vi.fn(),
  create: vi.fn(),
  logEvaluation: vi.fn(async () => false),
  marketOpen: true,
}));
const world = vi.hoisted(() => ({ db: null, battles: null }));
const flags = vi.hoisted(() => ({ beat: false }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock { constructor() { this.messages = { create: (...a) => mocks.create(...a) }; } },
}));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.getStockAnalysisData,
  fetchIntradayBatch: mocks.fetchIntradayBatch,
  fetchIntradayCandles: vi.fn(async () => []),
  filterToLatestSession: vi.fn((c) => ({ candles: c || [], sessionDate: '2026-09-09' })),
}));
vi.mock('../_utils/marketSchedule.js', async (importOriginal) => ({ ...(await importOriginal()), isMarketOpen: () => mocks.marketOpen }));
vi.mock('../_utils/agentBattleService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  findActiveAgentBattles: vi.fn(async () => (typeof world.battles === 'function' ? world.battles() : world.battles.map(deepClone))),
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
  ...(await importOriginal()),
  logEvaluation: (...a) => mocks.logEvaluation(...a),
  logVisionTransition: vi.fn(async () => false),
  logAnticipation: vi.fn(async () => false),
}));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  TICK_CAPTURE_ENABLED: false,
  get EVAL_DEFERRED_BEAT_ENABLED() { return flags.beat; },
}));

const cron = await import('./agent-evaluate.js');
const handler = cron.default;
const { processAgentBattle, composeEvalRunRecord, DEFERRED_BEAT_CAP, EVAL_RUN_DEFERRED_ID_CAP } = cron;

const HERE = dirname(fileURLToPath(import.meta.url));
const FROZEN_MS = Date.parse(FROZEN_NOW);
const iso = (offsetMs) => new Date(FROZEN_MS + offsetMs).toISOString();
const advance = (ms) => { vi.setSystemTime(new Date(Date.now() + ms)); };

/** The 13 run-document keys, in the order the build prompt lists them. */
const RUN_KEYS = [
  'startedAt', 'endedAt', 'wallMs', 'budgetMs', 'battlesTotal', 'evaluated', 'lockSkipped',
  'deferred', 'deferredBattleIds', 'deferredTruncated', 'triggered', 'modelCalls', 'budgetSkipped',
];
const TICK_MS = 97_000; // three ticks = 291 s > TIME_BUDGET_MS (290 s): the loop breaks before the fourth

// ---------------------------------------------------------------------------
// The world

/** A CPU-passive battle: lock → scores → one final score write, no model. The cheapest real tick. */
function cpuBattle(id, overrides = {}) {
  return {
    id, isCpu: true, agentId: `agent-${id}`, ownerId: `owner-${id}`, status: 'active',
    activatedAt: FROZEN_NOW, expiresAt: '2026-09-10T00:00:00.000Z',
    strategyPreset: 'balanced', timing: { tradingDays: [] }, agentContext: {},
    executionMode: 'copilot', pendingProposal: null, proposalHistory: [], battleLedger: [],
    statusFeed: [], gameplanMeeting: null, gameplanMeetingHistory: [], chatExchanges: [],
    chatBudgetUsed: 0, dailyReviews: [], dailyGrades: {},
    trades: [], scoreState: { peakScore: 0, bankedBadgePoints: { total: 0 } }, thresholdHistory: {},
    cronState: {
      evaluatingAt: null, vwapTicks: {}, intradayMomentum: {}, stagnationTicks: {},
      lastTickPrice: {}, lastTickTimestamp: {}, vwapFireGuard: {},
    },
    portfolio: {
      star: [{ symbol: 'NVDA', baseATR: 3.1, direction: null }], core: [], support: [],
      bench: { stocks: [], crypto: null }, startingPrices: { NVDA: 120.5 },
    },
    opponent: { portfolio: { star: [], core: [], support: [], bench: { stocks: [], crypto: null }, startingPrices: {} } },
    ...overrides,
  };
}
const cpuBattles = (prefix, n, from = 1) => Array.from({ length: n }, (_, i) => cpuBattle(`${prefix}${i + from}`));

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
 * Every battle in one store, the run documents in another, and every write in
 * order. A battle write RECORDS its payload as sent (sentinels by reference);
 * a completed tick — the write that carries `scoreState.lastScoredAt` — then
 * charges its fixture's cost to the clock. `runDocWrite`: 'ok' | 'reject' |
 * 'hang'; `beatWrite`: 'ok' | 'hang'.
 */
function makeRunDb({ battles, costs = {}, missing = [], runDocWrite = 'ok', beatWrite = 'ok' }) {
  const docs = new Map(battles.filter((b) => !missing.includes(b.id)).map((b) => [b.id, deepClone(b)]));
  const writes = [];
  const runDocs = [];
  const order = [];
  const shared = {
    'indexIntelligence/stockRankings': makeRankingsDoc(),
    ...Object.fromEntries(Object.entries(makeTechDocs()).map(([s, d]) => [`stockTechnicalScores/${s}`, d])),
  };
  const snap = (id, data) => ({ exists: data != null, id, data: () => (data == null ? undefined : deepClone(data)) });
  const emptyQuery = {
    where: () => emptyQuery, orderBy: () => emptyQuery, limit: () => emptyQuery, startAfter: () => emptyQuery,
    get: async () => ({ docs: [], empty: true, size: 0 }),
  };

  function writeBattle(id, payload) {
    if (!docs.has(id)) throw new Error(`5 NOT_FOUND: no document to update: agentBattles/${id}`);
    writes.push({ path: `agentBattles/${id}`, id, payload: deepClone(payload) });
    for (const [k, v] of Object.entries(payload)) if (!isSentinel(v)) setPath(docs.get(id), k, deepClone(v));
    if (Object.hasOwn(payload, 'scoreState.lastScoredAt') && costs[id]) advance(costs[id]);
  }
  const battleRef = (id) => ({
    id, path: `agentBattles/${id}`,
    get: async () => snap(id, docs.get(id) ?? null),
    update: async (payload) => {
      if (beatWrite === 'hang' && isSentinel(payload.statusFeed)) return new Promise(() => {});
      writeBattle(id, payload);
    },
    collection: (sub) => ({ doc: (subId) => genericRef(`agentBattles/${id}/${sub}`, subId) }),
  });
  const genericRef = (col, id) => ({
    id, path: `${col}/${id}`,
    get: async () => snap(id, shared[`${col}/${id}`] ?? null),
    set: async () => { throw new Error(`unexpected set on ${col}/${id}`); },
    update: async () => { throw new Error(`unexpected update on ${col}/${id}`); },
    collection: (sub) => ({ doc: (subId) => genericRef(`${col}/${id}/${sub}`, subId) }),
  });
  const runRef = (id) => ({
    id, path: `agentEvalRuns/${id}`,
    set: async (data) => {
      if (runDocWrite === 'reject') throw new Error('14 UNAVAILABLE: run document write refused');
      if (runDocWrite === 'hang') return new Promise(() => {});
      order.push('run_doc');
      runDocs.push({ id, data: deepClone(data) });
    },
  });

  return {
    collection(col) {
      return {
        doc: (id) => {
          if (col === 'agentBattles') return battleRef(id);
          if (col === 'agentEvalRuns') return runRef(id);
          return genericRef(col, id);
        },
        where: () => emptyQuery, orderBy: () => emptyQuery, limit: () => emptyQuery,
        get: async () => ({ docs: [], empty: true, size: 0 }),
      };
    },
    getAll: async (...refs) => Promise.all(refs.map((r) => r.get())),
    runTransaction: async (cb) => cb({
      get: (ref) => ref.get(),
      update: (ref, payload) => {
        const [col, id] = ref.path.split('/');
        if (col !== 'agentBattles') throw new Error(`unexpected transaction update on ${ref.path}`);
        writeBattle(id, payload);
      },
      set: (ref) => { throw new Error(`unexpected transaction set on ${ref.path}`); },
    }),
    __docs: docs,
    __writes: writes,
    __runDocs: runDocs,
    __order: order,
  };
}

function makeRes(order) {
  const out = { statusCode: null, payload: null, sends: 0 };
  out.status = (code) => { out.statusCode = code; return out; };
  out.json = (payload) => { order.push('response'); out.sends += 1; out.payload = payload; return out; };
  return out;
}

async function runHandler(battles, opts = {}) {
  world.battles = battles;
  world.db = makeRunDb({ battles: Array.isArray(battles) ? battles : [], ...opts });
  const res = makeRes(world.db.__order);
  await handler({ headers: { 'x-vercel-cron': '1' } }, res);
  return { res, db: world.db, run: world.db.__runDocs[0] ?? null };
}

/** The beat each deferred battle is sent, compared through the SDK's own sentinel equality. */
const beatWrites = (db) => db.__writes.filter((w) => isSentinel(w.payload.statusFeed));
const expectBeat = (write, { at, runId }) => {
  expect(Object.keys(write.payload)).toEqual(['statusFeed']);
  expect(write.payload.statusFeed.isEqual(FieldValue.arrayUnion({ kind: 'check_deferred', at, reason: 'budget', runId }))).toBe(true);
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  flags.beat = false;
  mocks.marketOpen = true;
  mocks.getStockAnalysisData.mockReset();
  mocks.fetchIntradayBatch.mockReset();
  mocks.create.mockReset();
  mocks.logEvaluation.mockReset();
  mocks.logEvaluation.mockImplementation(async () => false);
  const prices = makePriceTable();
  mocks.getStockAnalysisData.mockImplementation(async (s) => (prices[s] ? { price: prices[s], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockImplementation(async () => makeToolUseResponse(makeHoldResult()));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); world.db = null; world.battles = null; });

// ---------------------------------------------------------------------------
// D2 — the run document

describe('D2 — agentEvalRuns/{runId}: one record per evaluation run, always on', () => {
  it('TEST 1 — a run that breaks after N battles records deferred = total − N, the ids in loop order, and its wall time', async () => {
    const battles = cpuBattles('c', 6);
    const { res, run, db } = await runHandler(battles, { costs: { c1: TICK_MS, c2: TICK_MS, c3: TICK_MS } });

    expect(run, 'the run document was not written').not.toBeNull();
    expect(run.id, 'runId is the run\'s start instant').toBe(FROZEN_NOW);
    expect(Object.keys(run.data)).toEqual(RUN_KEYS);
    expect(run.data).toEqual({
      startedAt: FROZEN_NOW,
      endedAt: iso(291_000),
      wallMs: 291_000, // exact under the fake clock: 3 × 97 s, nothing else charges it
      budgetMs: 290_000,
      battlesTotal: 6,
      evaluated: 3, // N
      lockSkipped: 0,
      deferred: 3, // total − N
      deferredBattleIds: ['c4', 'c5', 'c6'],
      deferredTruncated: 0,
      triggered: 0,
      modelCalls: 0,
      budgetSkipped: 0,
    });
    // …and the unreached battles got nothing else: no lock, no tick, no write.
    expect(db.__writes.filter((w) => ['c4', 'c5', 'c6'].includes(w.id))).toEqual([]);
    expect(res.payload).toMatchObject({ evaluated: 3, deferred: 3, lockSkipped: 0, skipped: 3, duration: 291_000 });
  });

  it('TEST 2 — lock-skips and deferrals are counted apart, and `skipped` is exactly their sum', async () => {
    const battles = cpuBattles('c', 6);
    battles[1].cronState.evaluatingAt = FROZEN_NOW; // c2's lock is held by another invocation (age < 120 s at its turn)
    const { res, run } = await runHandler(battles, { costs: { c1: TICK_MS, c3: TICK_MS, c4: TICK_MS } });

    // c1 97 s · c2 lock-skipped (0 s) · c3 194 s · c4 291 s · c5 breaks.
    expect(res.payload).toMatchObject({ evaluated: 3, lockSkipped: 1, deferred: 2, skipped: 3 });
    expect(res.payload.skipped).toBe(res.payload.lockSkipped + res.payload.deferred);
    expect(run.data).toMatchObject({ battlesTotal: 6, evaluated: 3, lockSkipped: 1, deferred: 2, deferredBattleIds: ['c5', 'c6'] });
  });

  it('the response only GAINS keys: every key it carried before is still there, `lockSkipped` and `deferred` beside them', async () => {
    const { res } = await runHandler(cpuBattles('c', 2));
    expect(res.statusCode).toBe(200);
    for (const key of ['evaluated', 'triggered', 'swapped', 'held', 'errors', 'skipped', 'expired', 'duration']) {
      expect(res.payload, `the response lost "${key}"`).toHaveProperty(key);
    }
    expect(res.payload).toMatchObject({ lockSkipped: 0, deferred: 0, skipped: 0 });
  });

  it('`evaluated` is the LOOP\'s: an expiry completion counts in the response but not on the run document', async () => {
    const expired = cpuBattle('x1', { expiresAt: '2026-09-09T14:00:00.000Z', agentId: 'agent-missing' });
    const { res, run } = await runHandler([expired, ...cpuBattles('c', 2)]);
    expect(res.payload).toMatchObject({ expired: 1, evaluated: 3 }); // completeBattle counts into `evaluated`
    expect(run.data).toMatchObject({ battlesTotal: 2, evaluated: 2, deferred: 0 });
  });

  it('the run\'s model activity: one triggered tick, one dispatched call, no budget skip', async () => {
    const { run } = await runHandler([makeTickBattle({ id: 'full-1' }), ...cpuBattles('c', 1)]);
    expect(run.data).toMatchObject({ battlesTotal: 2, evaluated: 2, triggered: 1, modelCalls: 1, budgetSkipped: 0 });
  });

  it('a late full tick that the per-battle guard budget-skips counts as triggered and budget-skipped, with no model call', async () => {
    // c0 costs 250 s, so the full tick meets the 44 s pre-call guard with 40 s left.
    const { run } = await runHandler([cpuBattle('c0'), makeTickBattle({ id: 'full-1' })], { costs: { c0: 250_000 } });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(run.data).toMatchObject({ evaluated: 2, triggered: 1, modelCalls: 0, budgetSkipped: 1, deferred: 0 });
  });

  it('the list holds 200 ids and COUNTS the rest (composer, at the boundary)', () => {
    const ids = (n) => Array.from({ length: n }, (_, i) => `b${i + 1}`);
    const record = (n) => composeEvalRunRecord({ startTime: FROZEN_MS, endTime: FROZEN_MS + 1, battlesTotal: n, evaluated: 0, summary: {}, deferredBattleIds: ids(n) });
    expect(EVAL_RUN_DEFERRED_ID_CAP).toBe(200);
    expect(record(200)).toMatchObject({ deferred: 200, deferredTruncated: 0 });
    expect(record(200).deferredBattleIds).toHaveLength(200);
    expect(record(201)).toMatchObject({ deferred: 201, deferredTruncated: 1 });
    expect(record(201).deferredBattleIds).toEqual(ids(200));
    expect(Object.keys(record(0))).toEqual(RUN_KEYS);
  });

  it('a market-open run with no active battles still leaves its record', async () => {
    const { res, run } = await runHandler([]);
    expect(res.payload).toMatchObject({ evaluated: 0, message: 'No active agent battles' });
    expect(run.data).toMatchObject({ battlesTotal: 0, evaluated: 0, deferred: 0, deferredBattleIds: [], deferredTruncated: 0, wallMs: 0 });
  });

  it('a market-CLOSED invocation is not an evaluation run: no record, response unchanged', async () => {
    mocks.marketOpen = false;
    const { res, db } = await runHandler(cpuBattles('c', 2));
    expect(db.__runDocs).toEqual([]);
    expect(res.payload).toEqual({ skipped: true, reason: 'market_closed', expired: 0, duration: 0 });
  });

  it('the record goes out BEFORE the response — a function may be frozen once its response ends', async () => {
    const { res, db } = await runHandler(cpuBattles('c', 2));
    expect(db.__order).toEqual(['run_doc', 'response']);
    expect(res.sends).toBe(1);
  });

  it('a run that dies after the market gate is still recorded, before its 500', async () => {
    // A battle whose rotation key cannot be read throws inside the sort — the
    // handler's outer catch, the one path no battle's own try can absorb.
    const poisoned = (id) => {
      const b = cpuBattle(id);
      Object.defineProperty(b, 'cronState', { get() { throw new Error('unreadable rotation key'); }, enumerable: false });
      return b;
    };
    world.battles = () => [poisoned('p1'), poisoned('p2')];
    world.db = makeRunDb({ battles: [] });
    const res = makeRes(world.db.__order);
    await handler({ headers: { 'x-vercel-cron': '1' } }, res);
    expect(res.statusCode).toBe(500);
    expect(res.payload).toEqual({ error: 'unreadable rotation key' });
    expect(world.db.__order).toEqual(['run_doc', 'response']);
    expect(world.db.__runDocs[0].data).toMatchObject({ battlesTotal: 2, evaluated: 0, deferred: 0 });
  });
});

describe('D2 — the write is bounded and never costs the run (TEST 5)', () => {
  it('TEST 5 — a refused write is logged; the run completes and the response is byte-identical to a recorded run', async () => {
    const fixture = () => cpuBattles('c', 6);
    const costs = { c1: TICK_MS, c2: TICK_MS, c3: TICK_MS };
    const recorded = await runHandler(fixture(), { costs });
    vi.setSystemTime(new Date(FROZEN_NOW));
    const refused = await runHandler(fixture(), { costs, runDocWrite: 'reject' });

    expect(refused.run).toBeNull();
    expect(refused.res.statusCode).toBe(200);
    expect(JSON.stringify(refused.res.payload)).toBe(JSON.stringify(recorded.res.payload));
    // …the battles were written exactly as in the recorded run…
    expect(JSON.stringify(refused.db.__writes)).toBe(JSON.stringify(recorded.db.__writes));
    // …and the loss is loud, naming the run.
    const logged = console.error.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).toContain('[evalRun]');
    expect(logged).toContain(FROZEN_NOW);
    expect(logged).toContain('UNAVAILABLE');
  });

  it('a write that never answers is abandoned at 2 s and the response still goes out', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(FROZEN_NOW));
    world.battles = cpuBattles('c', 2);
    world.db = makeRunDb({ battles: world.battles, runDocWrite: 'hang' });
    const res = makeRes(world.db.__order);
    const done = handler({ headers: { 'x-vercel-cron': '1' } }, res);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(res.sends, 'the response must wait for the bounded write').toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ evaluated: 2 });
    expect(console.error.mock.calls.map((c) => c.join(' ')).join('\n')).toContain('eval_run_write_timeout_2000ms');
  });
});

// ---------------------------------------------------------------------------
// D3 — the deferred beat

describe('D3 — the deferred beat (flag ON)', () => {
  beforeEach(() => { flags.beat = true; });

  it('TEST 3 — 30 deferred: 25 beats, to the first 25 in loop order; the run document lists all 30', async () => {
    expect(DEFERRED_BEAT_CAP).toBe(25);
    const battles = [cpuBattle('c0'), ...cpuBattles('d', 30)];
    const { run, db } = await runHandler(battles, { costs: { c0: 291_000 } });

    const beats = beatWrites(db);
    expect(beats.map((w) => w.id)).toEqual(Array.from({ length: 25 }, (_, i) => `d${i + 1}`));
    for (const w of beats) expectBeat(w, { at: iso(291_000), runId: FROZEN_NOW });
    // The five past the cap got nothing — the run document is their record.
    expect(db.__writes.filter((w) => ['d26', 'd27', 'd28', 'd29', 'd30'].includes(w.id))).toEqual([]);
    expect(run.data.deferred).toBe(30);
    expect(run.data.deferredBattleIds).toEqual(Array.from({ length: 30 }, (_, i) => `d${i + 1}`));
    expect(run.data.deferredTruncated).toBe(0);
  });

  it('TEST 3 — 205 deferred: 25 beats, 200 ids listed and `deferredTruncated: 5` — both caps bind', async () => {
    const battles = [cpuBattle('c0'), ...cpuBattles('d', 205)];
    const { run, db } = await runHandler(battles, { costs: { c0: 291_000 } });
    expect(beatWrites(db)).toHaveLength(25);
    expect(run.data).toMatchObject({ deferred: 205, deferredTruncated: 5 });
    expect(run.data.deferredBattleIds).toEqual(Array.from({ length: 200 }, (_, i) => `d${i + 1}`));
  });

  it('TEST 3 — under 5 s of the hard ceiling left: no beats at all, and the run document is complete', async () => {
    const battles = [cpuBattle('c0'), ...cpuBattles('d', 30)];
    const { run, db } = await runHandler(battles, { costs: { c0: 295_001 } }); // 4.999 s left of 300 s
    expect(beatWrites(db)).toEqual([]);
    expect(run.data).toMatchObject({ deferred: 30, deferredTruncated: 0 });
    expect(run.data.deferredBattleIds).toHaveLength(30);
    expect(console.log.mock.calls.map((c) => c.join(' ')).join('\n')).toContain('[deferredBeat] no beats: 4999ms');
  });

  it('the boundary: exactly 5 s left still beats', async () => {
    const battles = [cpuBattle('c0'), ...cpuBattles('d', 3)];
    const { db } = await runHandler(battles, { costs: { c0: 295_000 } });
    expect(beatWrites(db).map((w) => w.id)).toEqual(['d1', 'd2', 'd3']);
  });

  it('one battle\'s failed beat costs only that battle its beat', async () => {
    const battles = [cpuBattle('c0'), ...cpuBattles('d', 3)];
    const { run, db } = await runHandler(battles, { costs: { c0: 291_000 }, missing: ['d2'] });
    expect(beatWrites(db).map((w) => w.id)).toEqual(['d1', 'd3']);
    const logged = console.error.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).toContain('beat not written for battle d2');
    expect(console.log.mock.calls.map((c) => c.join(' ')).join('\n')).toContain('2/3 beat(s) written');
    expect(run.data.deferredBattleIds).toEqual(['d1', 'd2', 'd3']);
  });

  it('beats that never answer are abandoned at 2 s; the run document and the response still go out', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(FROZEN_NOW));
    const battles = [cpuBattle('c0'), ...cpuBattles('d', 3)];
    world.battles = battles;
    world.db = makeRunDb({ battles, costs: { c0: 291_000 }, beatWrite: 'hang' });
    const res = makeRes(world.db.__order);
    const done = handler({ headers: { 'x-vercel-cron': '1' } }, res);
    await vi.advanceTimersByTimeAsync(2_000);
    await done;
    expect(world.db.__order).toEqual(['run_doc', 'response']);
    expect(world.db.__runDocs[0].data).toMatchObject({ deferred: 3 });
    expect(console.error.mock.calls.map((c) => c.join(' ')).join('\n')).toContain('deferred_beat_write_timeout_2000ms');
  });
});

describe('D3 — flag OFF (TEST 4): no status-feed write, the record and the stamp still there', () => {
  const fixture = () => [makeTickBattle({ id: 'full-1' }), cpuBattle('c1'), ...cpuBattles('d', 3)];
  const costs = { c1: 291_000 };

  it('TEST 4 — zero beats and zero writes to the deferred battles; the run document still lists them; the entry carries tickMs', async () => {
    const { run, db } = await runHandler(fixture(), { costs });
    expect(beatWrites(db)).toEqual([]);
    expect(db.__writes.filter((w) => ['d1', 'd2', 'd3'].includes(w.id))).toEqual([]);
    expect(run.data).toMatchObject({ battlesTotal: 5, evaluated: 2, deferred: 3, deferredBattleIds: ['d1', 'd2', 'd3'], triggered: 1, modelCalls: 1 });
    const final = db.__writes.find((w) => w.id === 'full-1' && Array.isArray(w.payload.evaluations));
    const entry = final.payload.evaluations.at(-1);
    expect(typeof entry.tickMs).toBe('number');
    expect(Object.keys(entry).indexOf('tickMs')).toBe(Object.keys(entry).indexOf('callMs') + 1);
  });

  it('anti-vacuous: the SAME fixture with the flag on beats all three', async () => {
    flags.beat = true;
    const { db } = await runHandler(fixture(), { costs });
    expect(beatWrites(db).map((w) => w.id)).toEqual(['d1', 'd2', 'd3']);
  });
});

// ---------------------------------------------------------------------------
// D1 — tickMs, on the real processAgentBattle

describe('D1 — tickMs: admission → the authoritative final update', () => {
  async function runTick({ battle = makeTickBattle(), summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 } } = {}) {
    const db = makeTickDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
    const finalUpdate = () => db.__updates.find((u) => Array.isArray(u.evaluations)) || null;
    return { db, summary, finalUpdate };
  }

  it('counts from the lock to the final update: time before admission is out, time after the entry is composed is in', async () => {
    const { db, summary, finalUpdate } = await runTick();
    // 1 s inside the lock transaction — BEFORE admission, so not the tick's.
    const txn = db.runTransaction.bind(db);
    let first = true;
    db.runTransaction = async (cb) => { if (first) { first = false; advance(1_000); } return txn(cb); };
    // 2 s in the first price fetch — after admission, before the entry.
    let fetched = false;
    const prices = makePriceTable();
    mocks.getStockAnalysisData.mockImplementation(async (s) => {
      if (!fetched) { fetched = true; advance(2_000); }
      return prices[s] ? { price: prices[s], daily: [] } : {};
    });
    // 3 s in the shadow log — AFTER the entry is composed, before the final update.
    mocks.logEvaluation.mockImplementation(async () => { advance(3_000); return false; });

    await processAgentBattle(db, makeTickBattle(), summary, Date.now(), new Map(), { everEnabled: false });
    const entry = finalUpdate().evaluations.at(-1);
    expect(entry.tickMs).toBe(5_000);
    expect(entry.buildMs).toBe(0);
    expect(entry.callMs).toBe(0);
    // …and the persisted document holds the same number: the restamp rode the write.
    expect(db.__store.battle.evaluations.at(-1).tickMs).toBe(5_000);
  });

  it('tickMs is one of the sanctioned timing keys, composed right after callMs', () => {
    expect(TIMING_ENTRY_KEYS).toEqual(['promptBuiltAt', 'buildMs', 'callMs', 'tickMs']);
  });

  it('absent on early exits: a CPU-passive tick and a lock-skip write no entry and no tickMs', async () => {
    const cpu = cpuBattle('c1');
    const db = makeRunDb({ battles: [cpu] });
    const summary = { evaluated: 0, held: 0, skipped: 0 };
    await processAgentBattle(db, cpu, summary, Date.now(), new Map(), { everEnabled: false });
    const locked = cpuBattle('c2', { cronState: { ...cpu.cronState, evaluatingAt: FROZEN_NOW } });
    const lockedDb = makeRunDb({ battles: [locked] });
    await processAgentBattle(lockedDb, locked, summary, Date.now(), new Map(), { everEnabled: false });
    expect(summary).toMatchObject({ evaluated: 1, lockSkipped: 1, skipped: 1 });
    const payloads = JSON.stringify([...db.__writes, ...lockedDb.__writes].map((w) => w.payload));
    expect(payloads).not.toContain('tickMs');
    expect(payloads).not.toContain('"evaluations"');
  });

  it('`modelCalls` counts a DISPATCHED call even when it throws', async () => {
    const { db, summary, finalUpdate } = await runTick();
    mocks.create.mockImplementation(async () => { throw Object.assign(new Error('overloaded'), { status: 529 }); });
    await processAgentBattle(db, makeTickBattle(), summary, Date.now(), new Map(), { everEnabled: false });
    expect(summary.modelCalls).toBe(1);
    expect(finalUpdate().evaluations.at(-1).haikuError).not.toBeNull();
    expect(typeof finalUpdate().evaluations.at(-1).tickMs).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// The rules posture, in the DEFAULT run (the emulator suite is not in CI)

describe('firestore.rules — agentEvalRuns is server-only (source tripwire)', () => {
  it('an explicit `if false` block (proven against the emulator in test/rules/agentEvalRunsDenials.rules.mjs)', () => {
    const rules = readFileSync(resolve(HERE, '../../firestore.rules'), 'utf8');
    expect(rules).toMatch(/match \/agentEvalRuns\/\{runId\} \{\s*allow read, write: if false;/);
  });
});
