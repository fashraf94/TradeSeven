// api/cron/agent-evaluate.tickCapture.handler.test.js
//
// Astra round 1, BLIND SPOT 1: the outer-handler finalization of a tick that
// THREW was only ever proven by a test that claimed and finalized the context
// ITSELF. Deleting the handler's own call would have changed nothing.
//
// This suite drives the REAL exported `handler`, makes one admitted tick throw
// after its decision, and asserts the ORDER the spec requires (C-9):
//
//     fault receipt written  →  THEN the capture record
//
// It also proves the negative: with the handler's call removed there is no
// record at all, which is what the mutation row in the report exercises.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FROZEN_NOW, makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs,
  makeIntradayCandles, makeHoldResult, makeToolUseResponse, deepClone,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { withCaptureStore, permanentDoc } from '../_utils/__fixtures__/tickCaptureHarness.js';

const mocks = vi.hoisted(() => ({ getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn() }));
const world = vi.hoisted(() => ({ db: null, battles: [] }));

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
vi.mock('../_utils/agentBattleService.js', async (o) => ({
  ...(await o()),
  findActiveAgentBattles: vi.fn(async () => world.battles.map(deepClone)),
}));
vi.mock('../_utils/canonicalOpenSweep.js', () => ({ runCanonicalOpenSweep: vi.fn(async () => ({ skipped: true })) }));
vi.mock('../_utils/masterySettlement.js', async (o) => ({
  ...(await o()), runRepairSweep: vi.fn(async () => ({ scanned: 0 })),
}));
vi.mock('../_utils/tournamentAgentLedger.js', () => ({
  resolveTournamentContext: vi.fn(async () => null), excludeHeldByOthers: vi.fn(), excludeHeldSymbols: vi.fn(),
  reserveSymbol: vi.fn(), confirmSwap: vi.fn(), releaseReservation: vi.fn(),
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => world.db }));
vi.mock('../_utils/voiceLayerAnticipation.js', async (importOriginal) => ({ ...(await importOriginal()), generateAnticipation: vi.fn(async () => null) }));
vi.mock('../_utils/voiceLayerTradeNarration.js', async (importOriginal) => ({ ...(await importOriginal()), generateTradeNarration: vi.fn(async () => null) }));
vi.mock('../_utils/shadowLogger.js', async (importOriginal) => ({ ...(await importOriginal()), logEvaluation: vi.fn(async () => false), logVisionTransition: vi.fn(async () => false), logAnticipation: vi.fn(async () => false) }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({ ...(await importOriginal()), TICK_CAPTURE_ENABLED: true }));

const handler = (await import('./agent-evaluate.js')).default;
const { makeTickDb } = await import('../_utils/__fixtures__/tickStampsHarness.js');

const BATTLE_ID = 'battle-tick-1';

/** A db whose FINAL battle update (the one carrying `evaluations`) throws. */
function makeThrowingDb(battle) {
  const base = makeTickDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  const db = withCaptureStore(base);
  const order = [];
  const baseCollection = db.collection.bind(db);
  db.__order = order;
  db.collection = (col) => {
    const c = baseCollection(col);
    return {
      ...c,
      doc: (id) => {
        const ref = c.doc(id);
        return {
          ...ref,
          update: async (payload) => {
            if (Array.isArray(payload.evaluations)) throw new Error('final update failed');
            if (Object.hasOwn(payload, 'cronState.cronErrors')) order.push('fault_receipt');
            return ref.update(payload);
          },
        };
      },
    };
  };
  const baseBatch = db.batch.bind(db);
  db.batch = () => {
    const b = baseBatch();
    return { set: b.set, commit: async () => { order.push('capture_record'); return b.commit(); } };
  };
  return db;
}

const res = () => {
  const out = { statusCode: null, payload: null };
  out.status = (code) => { out.statusCode = code; return out; };
  out.json = (payload) => { out.payload = payload; return out; };
  return out;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.getStockAnalysisData.mockReset();
  mocks.fetchIntradayBatch.mockReset();
  mocks.create.mockReset();
  const prices = makePriceTable();
  mocks.getStockAnalysisData.mockImplementation(async (s) => (prices[s] ? { price: prices[s], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockImplementation(async () => makeToolUseResponse(makeHoldResult()));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); world.db = null; world.battles = []; });

describe('the REAL handler finalizes a thrown tick — after its fault receipt (C-9)', () => {
  it('the tick throws, the handler writes its receipt, and THEN the capture record lands', async () => {
    const battle = makeTickBattle();
    world.battles = [battle];
    world.db = makeThrowingDb(battle);

    const response = res();
    await handler({ headers: { 'x-vercel-cron': '1' } }, response);

    expect(response.statusCode).toBe(200);
    expect(response.payload, 'the handler must have reached its summary').toBeTruthy();
    expect(response.payload.errors, 'the tick must have errored').toBe(1);

    // The record exists — written by the HANDLER, not by the test.
    const record = permanentDoc(world.db, BATTLE_ID, `${BATTLE_ID}:1`);
    expect(record, 'the handler must finalize the thrown tick').not.toBeNull();
    expect(record.exitReason).toBe('tick_error');

    // …and in the order C-9 names.
    expect(world.db.__order).toEqual(['fault_receipt', 'capture_record']);
  });

  it('a tick that finalizes itself MARKS its scope, so the handler can never write a second record', async () => {
    // Capture is the final statement of the tick's own `finally`, so there is
    // no end-to-end path where a tick both captures AND then throws — which is
    // exactly why this belt-and-braces mark is asserted at the source and its
    // MECHANISM is proven in captureContext.test.js ("a tick that finalized
    // itself cannot be finalized again by the error path"). Stated plainly
    // rather than dressed up as a behavioural row.
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, resolve } = await import('node:path');
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'agent-evaluate.js'), 'utf8');
    expect(src).toContain('markTickCaptureClaimed(tickCaptureScope);');
    // and the handler's error path claims a SCOPE, never a battle id
    expect(src).toContain('await finalizeAbandonedTickCapture(db, captureScope, startTime);');
    expect(src).not.toMatch(/finalizeAbandonedTickCapture\(db, battle\.id/);
  });

  it('a tick that does NOT throw is finalized by the tick itself, and the handler adds nothing', async () => {
    const battle = makeTickBattle();
    world.battles = [battle];
    world.db = withCaptureStore(makeTickDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() }));

    const response = res();
    await handler({ headers: { 'x-vercel-cron': '1' } }, response);

    expect(response.payload.errors).toBe(0);
    expect(response.payload.evaluated).toBe(1);
    expect(world.db.__captureWrites, 'exactly one record, written once').toHaveLength(1);
    expect(permanentDoc(world.db, BATTLE_ID, `${BATTLE_ID}:1`).exitReason).toBe('completed');
  });

  it('two battles in one invocation: each gets its own record, and a thrown one does not take the other\'s', async () => {
    const battleA = makeTickBattle({ id: 'battle-a' });
    const battleB = makeTickBattle({ id: 'battle-b' });
    world.battles = [battleA, battleB];

    const stores = {
      'battle-a': makeTickDb({ battle: battleA, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() }),
      'battle-b': makeTickDb({ battle: battleB, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() }),
    };
    const captureWrites = [];
    const sub = new Map();
    world.db = {
      collection: (col) => ({
        doc: (id) => {
          const store = stores[id] || stores['battle-a'];
          const ref = store.collection(col).doc(id);
          return {
            ...ref,
            update: async (payload) => {
              if (id === 'battle-a' && Array.isArray(payload.evaluations)) throw new Error('A final update failed');
              return ref.update(payload);
            },
            collection: (s) => ({ doc: (docId) => ({ path: `agentBattles/${id}/${s}/${docId}`, id: docId }) }),
          };
        },
        where: () => ({ where: () => ({ orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [], empty: true }) }) }) }) }),
      }),
      getAll: (...refs) => Promise.all(refs.map((r) => r.get())),
      runTransaction: (cb) => stores['battle-a'].runTransaction(cb),
      batch() {
        const staged = [];
        return { set: (ref, data) => staged.push({ path: ref.path, data: deepClone(data) }), commit: async () => { for (const w of staged) sub.set(w.path, w.data); captureWrites.push(staged); } };
      },
    };
    // Each battle's own transaction must read its own doc.
    world.db.runTransaction = async (cb) => cb({
      get: async (ref) => ref.get(),
      update: (ref, payload) => { const id = ref.path.split('/')[1]; stores[id].__store.battle.cronState = { ...(stores[id].__store.battle.cronState || {}) }; stores[id].__updates.push(deepClone(payload)); for (const [k, v] of Object.entries(payload)) { const parts = k.split('.'); let cur = stores[id].__store.battle; for (let i = 0; i < parts.length - 1; i++) { if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {}; cur = cur[parts[i]]; } cur[parts.at(-1)] = v; } },
    });

    const response = res();
    await handler({ headers: { 'x-vercel-cron': '1' } }, response);

    expect(response.payload, 'the handler must have reached its summary').toBeTruthy();
    expect(response.payload.errors, 'exactly one battle errored').toBe(1);
    expect(response.payload.evaluated, 'the other battle evaluated').toBe(1);
    expect(sub.get('agentBattles/battle-a/ticks/battle-a:1'), 'A errored and must still be captured').toBeTruthy();
    expect(sub.get('agentBattles/battle-b/ticks/battle-b:1'), 'B completed and must be captured').toBeTruthy();
    expect(sub.get('agentBattles/battle-a/ticks/battle-a:1').exitReason).toBe('tick_error');
    expect(sub.get('agentBattles/battle-b/ticks/battle-b:1').exitReason).toBe('completed');
  });
});
