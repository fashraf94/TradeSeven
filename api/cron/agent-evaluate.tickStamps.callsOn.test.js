// api/cron/agent-evaluate.tickStamps.callsOn.test.js
//
// Cockpit Build 0 — CALL_RECORDS_MODE 'shadow' / 'on', end to end on the REAL
// processAgentBattle (spec docs/design/COCKPIT_SPEC_V1_3.md §2–§3; §3.12).
// The tickStamps/tickCapture harness, the same frozen clock and book, plus the
// call-record store double (api/_utils/__fixtures__/callRecordsStore.js).
//
// The off side of every row is the frozen pre-change fixture
// (agent-evaluate.callRecords.offGolden.test.js) and the flag-off suites; this
// file proves the ON side: the entry key on exactly the paths that write an
// entry, the tool the model receives, and — as the build lands them — the
// observation seams, publication, the phase wire and the flips.
//
// `executeSwapServer` is doubled through a hoisted variable so the literal call
// string never appears here (the call-site census in agent-evaluate.test.js).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FROZEN_NOW, BASE_ENTRY_KEYS, TIMING_ENTRY_KEYS, CALLS_ENTRY_KEYS,
  makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs, makeIntradayCandles,
  makeHoldResult, makeSwapResult, makeToolUseResponse, makeDeclarations, undefinedPaths,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { makeCallsDb, storedDoc, storedCollection, callsTouches } from '../_utils/__fixtures__/callRecordsStore.js';

const mocks = vi.hoisted(() => ({ getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn() }));
const { swapMock } = vi.hoisted(() => ({ swapMock: vi.fn() }));
const { buildHook } = vi.hoisted(() => ({ buildHook: { throwMessage: null } }));
const flagState = vi.hoisted(() => ({ callsMode: 'shadow', tickCapture: true }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock { constructor() { this.messages = { create: (...args) => mocks.create(...args) }; } },
}));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.getStockAnalysisData,
  fetchIntradayBatch: mocks.fetchIntradayBatch,
  fetchIntradayCandles: vi.fn(async () => []),
  filterToLatestSession: vi.fn((candles) => ({ candles: candles || [], sessionDate: '2026-09-09' })),
}));
vi.mock('../_utils/agentSwapExecution.js', async (importOriginal) => ({ ...(await importOriginal()), executeSwapServer: swapMock }));
vi.mock('../_utils/agentEvalPromptAssembly.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    buildLiveContextBlock: async (...args) => {
      if (buildHook.throwMessage) throw new Error(buildHook.throwMessage);
      return real.buildLiveContextBlock(...args);
    },
  };
});
vi.mock('../_utils/tournamentAgentLedger.js', () => ({
  resolveTournamentContext: vi.fn(async () => null),
  excludeHeldByOthers: vi.fn((list) => list), excludeHeldSymbols: vi.fn((list) => list),
  reserveSymbol: vi.fn(), confirmSwap: vi.fn(), releaseReservation: vi.fn(),
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));
vi.mock('../_utils/voiceLayerAnticipation.js', async (importOriginal) => ({ ...(await importOriginal()), generateAnticipation: vi.fn(async () => null) }));
vi.mock('../_utils/voiceLayerTradeNarration.js', async (importOriginal) => ({ ...(await importOriginal()), generateTradeNarration: vi.fn(async () => null) }));
vi.mock('../_utils/shadowLogger.js', async (importOriginal) => ({ ...(await importOriginal()), logEvaluation: vi.fn(async () => false), logVisionTransition: vi.fn(async () => false), logAnticipation: vi.fn(async () => false) }));
vi.mock('../_utils/learning/captureReceipt.js', () => ({
  captureSwapReceipt: vi.fn(async () => {}),
  resolveEntrySnapshot: vi.fn(async () => ({ snapshotIn: null, techDocIn: null, entrySnapshotSource: 'unavailable' })),
  classifyEntryAtrSource: vi.fn(() => 'bench_atr'),
  classifyEvidence: vi.fn(() => 'live_agent'),
}));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    get CALL_RECORDS_MODE() { return flagState.callsMode; },
    get TICK_CAPTURE_ENABLED() { return flagState.tickCapture; },
  };
});

const { processAgentBattle } = await import('./agent-evaluate.js');
const { TRADE_DECISION_TOOL } = await import('../_utils/agentEvalToolSchema.js');
const { generateTradeNarration } = await import('../_utils/voiceLayerTradeNarration.js');

const TIME_BUDGET_MS = 290_000;
class APIConnectionError extends Error {}

function flatPrices() {
  const prices = makePriceTable();
  for (const [symbol, row] of Object.entries(prices)) prices[symbol] = { ...row, current: row.previousClose, changePercent: 0 };
  return prices;
}
function quietRankingsDoc() {
  const doc = makeRankingsDoc();
  return { ...doc, stocks: doc.stocks.map((row) => ({ ...row, bBandwidthPercentile: 70, nr7Flag: false })) };
}
function bustingPrices() {
  const prices = makePriceTable();
  prices.KO = { ...prices.KO, current: 61.578 };
  prices.PG = { ...prices.PG, current: 163.647 };
  return prices;
}
function swapInStore(db, tier, slotIndex, incoming, priceOf) {
  const stored = db.__store.battle;
  const outgoing = stored.portfolio[tier][slotIndex];
  stored.portfolio[tier] = stored.portfolio[tier].map((a, i) => (i === slotIndex ? { ...incoming, swapPrice: priceOf(incoming.symbol), swappedInAt: FROZEN_NOW } : a));
  stored.portfolio.bench = {
    ...stored.portfolio.bench,
    stocks: [...(stored.portfolio.bench.stocks || []).filter((a) => a.symbol !== incoming.symbol), { ...outgoing, cooldownUntil: '2026-09-10T15:00:00.000Z' }],
  };
  stored.trades = [...(stored.trades || []), { symbolIn: incoming.symbol, symbolOut: outgoing.symbol, lockedPoints: 0, entryPrice: 0 }];
  stored.scoreState = { ...stored.scoreState, tradeCount: (stored.scoreState?.tradeCount || 0) + 1 };
  return outgoing;
}

/** Drive one check. Returns the db, the summary, the final entry (if any) and the tool the model received. */
async function runTick({
  mode = 'shadow', capture = true, battle = makeTickBattle(), result = makeHoldResult(), prices = makePriceTable(),
  rankingsDoc = makeRankingsDoc(), cronStartTime = Date.now(), modelThrows = null, modelResponse = null,
  breakRefreshAfterSwap = false, buildThrows = null, seed = {}, db: injected = null, beforeModel = null,
  failFinalUpdate = false,
} = {}) {
  flagState.callsMode = mode;
  flagState.tickCapture = capture;
  buildHook.throwMessage = buildThrows;
  mocks.create.mockClear();
  swapMock.mockClear();
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockImplementation(async () => {
    if (beforeModel) await beforeModel();
    if (modelThrows) throw modelThrows;
    return modelResponse ?? makeToolUseResponse(result);
  });
  const db = injected || makeCallsDb({ battle, rankingsDoc, techDocs: makeTechDocs(), seed });
  let swaps = 0;
  if (breakRefreshAfterSwap) {
    const baseCollection = db.collection.bind(db);
    db.collection = (col) => {
      const c = baseCollection(col);
      if (col !== 'agentBattles') return c;
      return { ...c, doc: (id) => { const ref = c.doc(id); return { ...ref, get: async () => (swaps > 0 ? { exists: false, id, data: () => undefined } : ref.get()) }; } };
    };
  }
  if (failFinalUpdate) {
    // The evaluation commit itself fails: the final update (the one carrying
    // `evaluations`) rejects, so no evaluation identity is ever committed.
    const baseCollection = db.collection.bind(db);
    db.collection = (col) => {
      const c = baseCollection(col);
      if (col !== 'agentBattles') return c;
      return {
        ...c,
        doc: (id) => {
          const ref = c.doc(id);
          return { ...ref, update: async (payload) => { if (Array.isArray(payload?.evaluations)) throw new Error('4 DEADLINE_EXCEEDED: final update'); return ref.update(payload); } };
        },
      };
    };
  }
  swapMock.mockImplementation(async (_db, _id, _b, tier, slotIndex, incoming) => {
    swaps += 1;
    const outgoing = swapInStore(db, tier, slotIndex, incoming, (s) => prices[s]?.current ?? 0);
    return {
      closedTrade: { symbolIn: incoming.symbol, symbolOut: outgoing.symbol, tier, slotIndex, swappedOutAt: FROZEN_NOW, entryPrice: 0, lockedPoints: 1.5 },
      incomingAsset: { ...incoming, swapPrice: prices[incoming.symbol]?.current ?? 0 },
    };
  });
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  let thrown = null;
  try {
    await processAgentBattle(db, battle, summary, cronStartTime, new Map(), { everEnabled: false });
  } catch (err) { thrown = err; }
  const finalUpdate = db.__updates.find((u) => Array.isArray(u.evaluations)) || null;
  const entry = finalUpdate ? finalUpdate.evaluations[finalUpdate.evaluations.length - 1] : null;
  const tool = mocks.create.mock.calls[0]?.[0]?.tools?.[0] ?? null;
  return { db, summary, thrown, finalUpdate, entry, tool, swaps };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.getStockAnalysisData.mockReset();
  mocks.fetchIntradayBatch.mockReset();
  mocks.create.mockReset();
  swapMock.mockReset();
  buildHook.throwMessage = null;
  flagState.callsMode = 'shadow';
  flagState.tickCapture = true;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

/** Every path that WRITES an entry, with the phase it must carry at shadow/on. */
const ENTRY_PATHS = {
  model_result_hold_no_block: { run: () => ({}), phase: 'none' },
  model_result_hold_with_block: { run: () => ({ result: makeHoldResult({ declarations: makeDeclarations() }) }), phase: 'expected' },
  model_result_swap_with_block: { run: () => ({ result: makeSwapResult({ declarations: makeDeclarations() }) }), phase: 'expected' },
  model_result_null_block: { run: () => ({ result: makeHoldResult({ declarations: null }) }), phase: 'none' },
  model_result_malformed_block: { run: () => ({ result: makeHoldResult({ declarations: 'call AMD above 163' }) }), phase: 'none' },
  model_result_fully_removed: { run: () => ({ result: makeHoldResult({ declarations: { calledShots: [{ symbol: 'AMD' }] } }) }), phase: 'none' },
  transport_failed: { run: () => ({ modelThrows: new APIConnectionError('Connection error.') }), phase: 'none' },
  invalid_tool_result_with_block: { run: () => ({ modelResponse: makeToolUseResponse(makeHoldResult({ decision: 'MAYBE', declarations: makeDeclarations() })) }), phase: 'none' },
  truncated_response: { run: () => ({ modelResponse: { usage: {}, stop_reason: 'max_tokens', content: [{ type: 'text', text: 'partial' }] } }), phase: 'none' },
  budget_skipped: { run: () => ({ cronStartTime: Date.parse(FROZEN_NOW) - (TIME_BUDGET_MS - 40_000) }), phase: 'none' },
  refresh_failed: { run: () => ({ prices: bustingPrices(), breakRefreshAfterSwap: true }), phase: 'none' },
  prompt_build_failed: { run: () => ({ buildThrows: 'institutional read exploded' }), phase: 'none' },
};

/** Every path that writes NO entry. */
const NO_ENTRY_PATHS = {
  no_trigger: () => ({
    battle: makeTickBattle({ evaluations: [{ evalId: 'eval_1', timestamp: '2026-09-09T14:45:00.000Z', decision: 'HOLD', symbolOut: null, symbolIn: null, tier: null, rationale: 'held', hypothesis: null }] }),
    prices: flatPrices(), rankingsDoc: quietRankingsDoc(),
  }),
  proposal_pending: () => ({ battle: makeTickBattle({ executionMode: 'copilot', pendingProposal: { proposalId: 'p1', symbolOut: 'KO', symbolIn: 'AMD', tier: 'support', slotIndex: 0, mode: 'copilot', expiresAt: '2026-09-09T23:00:00.000Z' } }) }),
  gameplan_pending: () => ({ battle: makeTickBattle({ gameplanMeeting: { status: 'pending', diagnosis: 'drag', expiresAt: '2026-09-09T23:00:00.000Z', swaps: [] } }) }),
  gameplan_created: () => ({ battle: makeTickBattle({ cronState: { ...makeTickBattle().cronState, lastGameplanDate: null } }) }),
  cpu_passive: () => ({ battle: makeTickBattle({ isCpu: true }) }),
  degraded_quotes: () => { const prices = makePriceTable(); delete prices.NVDA; return { prices }; },
};

// ─────────────────────────────────────────────────────────────────────────────
describe('§3.12 row 2 — per-mode keys: declarationsPhase on EVERY entry-writing path at shadow/on', () => {
  it('the key lives in its own list — never in the unconditional TIMING or BASE lists', () => {
    expect(CALLS_ENTRY_KEYS).toEqual(['declarationsPhase']);
    expect(BASE_ENTRY_KEYS).not.toContain('declarationsPhase');
    expect(TIMING_ENTRY_KEYS).not.toContain('declarationsPhase');
  });

  for (const mode of ['shadow', 'on']) {
    for (const [name, spec] of Object.entries(ENTRY_PATHS)) {
      it(`${mode} · ${name}: the entry carries declarationsPhase '${spec.phase}' as its LAST key, and nothing undefined`, async () => {
        const { entry, finalUpdate } = await runTick({ mode, ...spec.run() });
        expect(entry, `${name} must write an entry`).not.toBeNull();
        expect(entry.declarationsPhase).toBe(spec.phase);
        const keys = Object.keys(entry);
        expect(keys[keys.length - 1]).toBe('declarationsPhase');
        // Every base key is still there, in order — the phase is additive.
        expect(keys.filter((k) => BASE_ENTRY_KEYS.includes(k))).toEqual([...BASE_ENTRY_KEYS]);
        expect(undefinedPaths(finalUpdate)).toEqual([]);
      });
    }
    for (const [name, run] of Object.entries(NO_ENTRY_PATHS)) {
      it(`${mode} · ${name}: no entry is written, so no phase key and no evaluation identity`, async () => {
        const { finalUpdate, db } = await runTick({ mode, ...run() });
        expect(finalUpdate).toBeNull();
        expect(JSON.stringify(db.__updates)).not.toMatch(/declarationsPhase/);
        expect(JSON.stringify(db.__updates)).not.toMatch(/"evalSeq"|cronState\.evalSeq/);
      });
    }
  }

  it('off: the same paths carry NO phase key (the frozen fixture proves the bytes; this names the key)', async () => {
    for (const spec of Object.values(ENTRY_PATHS)) {
      const { entry } = await runTick({ mode: 'off', ...spec.run() });
      expect(entry).not.toHaveProperty('declarationsPhase');
    }
  });
});

describe('§3.1 — the tool the model receives follows the resolved mode', () => {
  it('off: the frozen TRADE_DECISION_TOOL itself; shadow/on: + declarations', async () => {
    const off = await runTick({ mode: 'off' });
    expect(off.tool).toBe(TRADE_DECISION_TOOL);
    for (const mode of ['shadow', 'on']) {
      const on = await runTick({ mode });
      expect(on.tool.input_schema.properties).toHaveProperty('declarations');
      expect(on.tool.input_schema.required).not.toContain('declarations');
    }
  });

  it('a garbage declarations block never alters the trade result (same decision, same entry fields)', async () => {
    const clean = await runTick({ mode: 'shadow', result: makeSwapResult() });
    const dirty = await runTick({ mode: 'shadow', result: makeSwapResult({ declarations: { calledShots: 'nonsense', fork: 7 } }) });
    expect(dirty.entry.decision).toBe('SWAP');
    const strip = (e) => { const { declarationsPhase: _p, ...rest } = e; return rest; };
    expect(JSON.stringify(strip(dirty.entry))).toBe(JSON.stringify(strip(clean.entry)));
    expect(dirty.entry.declarationsPhase).toBe('none');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
/** Index of the first update carrying a key (or -1). */
const updateIndex = (db, key) => db.__updates.findIndex((u) => Object.prototype.hasOwnProperty.call(u, key));

describe('§3.7 — publication after the evaluation commit, end to end', () => {
  for (const mode of ['shadow', 'on']) {
    it(`${mode} · an expected block: the record and its calls are created from the COMMITTED identity, then one status write carries the wire`, async () => {
      const { db, entry, finalUpdate } = await runTick({ mode, result: makeHoldResult({ declarations: makeDeclarations() }) });
      expect(entry.declarationsPhase).toBe('expected');
      const record = storedDoc(db, 'declarations', entry.evalId);
      expect(record).toMatchObject({ battleId: 'battle-tick-1', evalId: entry.evalId, evalSeq: finalUpdate['cronState.evalSeq'], watching: ['JPM'] });
      const calls = Object.values(storedCollection(db, 'calls'));
      expect(calls.map((c) => c.callId)).toEqual([`battle-tick-1:${entry.evalId}:call:0`, `battle-tick-1:${entry.evalId}:call:1`]);
      for (const call of calls) {
        expect(call.evidence.priceAsOf).toBe(entry.promptBuiltAt);
        expect(call.evidence.tickId).toMatch(/^battle-tick-1:\d+$/);
        expect(call.evidence.availability).toBe('unresolved');
      }
      expect(db.__store.battle.cronState.declarationsPhase).toEqual({ evalId: entry.evalId, phase: 'written' });
      // The wire is written AFTER the evaluation commit, never with it.
      const finalIdx = db.__updates.findIndex((u) => Array.isArray(u.evaluations));
      const wireIdx = updateIndex(db, 'cronState.declarationsPhase');
      expect(wireIdx).toBeGreaterThan(finalIdx);
      expect(finalUpdate).not.toHaveProperty('cronState.declarationsPhase');
      expect(db.__store.battle.cronState.callsDiag).toMatchObject({ evalId: entry.evalId, exit: 'model_result', phaseResult: 'written' });
    });
  }

  it('capture off: evidence carries tickId null / availability off — the calls do not depend on capture', async () => {
    const { db, entry } = await runTick({ mode: 'shadow', capture: false, result: makeHoldResult({ declarations: makeDeclarations() }) });
    const calls = Object.values(storedCollection(db, 'calls'));
    expect(calls).toHaveLength(2);
    for (const call of calls) expect(call.evidence).toEqual({ tickId: null, availability: 'off', priceAsOf: entry.promptBuiltAt });
  });

  it('no block → no record, no wire; the diagnostics still say what happened', async () => {
    const { db, entry } = await runTick({ mode: 'shadow' });
    expect(entry.declarationsPhase).toBe('none');
    expect(storedCollection(db, 'declarations')).toEqual({});
    expect(db.__store.battle.cronState).not.toHaveProperty('declarationsPhase');
    expect(db.__store.battle.cronState.callsDiag).toMatchObject({ evalId: entry.evalId, phaseResult: 'none' });
  });

  it('failed before the evaluation commit: nothing minted — no record, no call, no queue, no wire (contract §3 acceptance)', async () => {
    const { db, thrown } = await runTick({ mode: 'shadow', result: makeHoldResult({ declarations: makeDeclarations() }), failFinalUpdate: true });
    expect(thrown).toBeTruthy();
    expect(callsTouches(db).writes).toBe(0);
    expect(storedCollection(db, 'declarations')).toEqual({});
    expect(storedCollection(db, 'calls')).toEqual({});
    expect(JSON.stringify(db.__updates)).not.toMatch(/declarationsPhase|callsDiag/);
  });

  it('transport failed after the prompt: no model output, so no publication and no wire', async () => {
    const { db, entry } = await runTick({ mode: 'shadow', modelThrows: new APIConnectionError('Connection error.') });
    expect(entry.declarationsPhase).toBe('none');
    expect(storedCollection(db, 'declarations')).toEqual({});
    expect(db.__store.battle.cronState).not.toHaveProperty('declarationsPhase');
  });
});

describe('§3.12 row 6 — the budget on the model path', () => {
  it('admission: 46 s left admits the model at off (44,000 required) and skips it at shadow (48,000 required)', async () => {
    const cronStartTime = Date.parse(FROZEN_NOW) - (TIME_BUDGET_MS - 46_000);
    const off = await runTick({ mode: 'off', cronStartTime });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(off.entry.haikuError).toBeNull();
    const shadow = await runTick({ mode: 'shadow', cronStartTime });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(shadow.entry.haikuError).toMatchObject({ failureClass: 'budget_skipped' });
  });

  it('the phase is skipped at available < 4,000 with a narration queued: the narration still dispatches, nothing is published, the wire says failed', async () => {
    const cronStartTime = Date.parse(FROZEN_NOW) - (TIME_BUDGET_MS - 48_000);
    // The model call takes 33 s of the shared clock: 15 s remain at the phase, 3 s past the tail.
    const beforeModel = async () => { vi.setSystemTime(new Date(Date.now() + 33_000)); };
    generateTradeNarration.mockClear();
    const { db, entry, swaps } = await runTick({ mode: 'shadow', cronStartTime, beforeModel, result: makeSwapResult({ declarations: makeDeclarations() }) });
    expect(swaps).toBe(1);
    expect(entry.declarationsPhase).toBe('expected');
    expect(generateTradeNarration).toHaveBeenCalledTimes(1);
    expect(storedCollection(db, 'declarations')).toEqual({});
    expect(storedCollection(db, 'calls')).toEqual({});
    expect(db.__store.battle.cronState.declarationsPhase).toEqual({ evalId: entry.evalId, phase: 'failed' });
    expect(db.__store.battle.cronState.callsDiag).toMatchObject({ phaseResult: 'skipped_budget' });
  });
});
