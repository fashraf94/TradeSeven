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
import { makeCallsDb } from '../_utils/__fixtures__/callRecordsStore.js';

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
