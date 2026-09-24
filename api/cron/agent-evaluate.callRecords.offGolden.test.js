// api/cron/agent-evaluate.callRecords.offGolden.test.js
//
// Cockpit Build 0 — THE CALLS-OFF INVARIANT (spec V1.3 §2, §3.12 row 1).
//
// At CALL_RECORDS_MODE 'off' the tool schema, every battle write on every
// exit, every prompt byte and both capture documents must be byte-identical to
// a FROZEN PRE-CHANGE FIXTURE captured under an injected clock — and existing
// calls / declarations / receipts / queue documents are neither read nor
// written (the rollback fixture: every scenario runs against a store SEEDED
// with them).
//
// THE FIXTURE (api/_utils/__fixtures__/callRecordsOffGolden.json) IS CAPTURED
// FROM THE UNTOUCHED PRODUCT TREE — first at c2f1b883, then (review C-2: every
// writer's arguments + the errored tick's capture) from a `git archive` of
// 20d207d7, whose product source is byte-identical to origin/main @ 987a9a68,
// BEFORE any Build 0 source existed. Its SHA-256 is pinned below (review C-9):
// the label inside the file is a literal and proves nothing by itself.
// Regenerate it ONLY from such a tree (never to make this suite green after a
// Build 0 change), then move the pin in the same commit:
//   GENERATE_CALLS_OFF_GOLDEN=1 npx vitest run api/cron/agent-evaluate.callRecords.offGolden.test.js
// The generating run fails on purpose after writing, and refuses CI.
//
// Every exit in the §3.4 matrix plus the excluded rows is driven through the
// REAL processAgentBattle (the tickStamps/tickCapture harness, the same frozen
// clock, the same seven-position book), with tick capture ON so both capture
// documents are part of the comparison, and once with capture OFF.
//
// `executeSwapServer` is doubled through a hoisted variable so the literal call
// string never appears here (the call-site census in agent-evaluate.test.js).
//
// PORTABILITY (branch review BR-5): the process runs in UTC whatever the
// machine's timezone (the first import below). The fixture is checked out as LF
// under any core.autocrlf (.gitattributes). The raw-byte SHA-256 pin stays
// exactly as strict as before.

// FIRST, before any module can build a local-time Date.
import '../_utils/__fixtures__/pinTimezoneUtc.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FROZEN_NOW, makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs,
  makeIntradayCandles, makeHoldResult, makeSwapResult, makeToolUseResponse, deepClone,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { makeCallsDb, callsTouches, storedCollection, storedDoc, CALL_SUBCOLLECTIONS } from '../_utils/__fixtures__/callRecordsStore.js';

const mocks = vi.hoisted(() => ({ getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn() }));
const { swapMock } = vi.hoisted(() => ({ swapMock: vi.fn() }));
const { buildHook } = vi.hoisted(() => ({ buildHook: { throwMessage: null } }));
const flagState = vi.hoisted(() => ({ tickCapture: true }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock { constructor() { this.messages = { create: (...args) => mocks.create(...args) }; } },
}));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.getStockAnalysisData,
  fetchIntradayBatch: mocks.fetchIntradayBatch,
  fetchIntradayCandles: vi.fn(async () => []),
  filterToLatestSession: vi.fn((candles) => ({ candles: candles || [], sessionDate: '2026-09-09' })),
}));
// The fenced executor, DOUBLED in tests only (never edited).
vi.mock('../_utils/agentSwapExecution.js', async (importOriginal) => ({
  ...(await importOriginal()),
  executeSwapServer: swapMock,
}));
// The fenced assembler, WRAPPED not replaced (never edited): a row may ask the
// live-context build to throw — the failed-prompt-build exit.
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
// THE FLAGS — CALL_RECORDS_MODE pinned 'off' EXPLICITLY (hermetic: this
// contract must hold in every live state of the flag); capture switchable.
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, CALL_RECORDS_MODE: 'off', get TICK_CAPTURE_ENABLED() { return flagState.tickCapture; } };
});

const { processAgentBattle } = await import('./agent-evaluate.js');
const { TRADE_DECISION_TOOL } = await import('../_utils/agentEvalToolSchema.js');
// The handler's own per-battle capture scope and errored-tick finalization
// (agent-evaluate.js, the battle loop's catch) — mirrored so the tick_error
// row's capture document is compared too (review C-2).
const { newTickCaptureScope, runInTickCaptureScope, claimTickCaptureContext } = await import('../_utils/tickCapture/captureContext.js');
const { finalizeTickCapture } = await import('../_utils/tickCapture/captureWriter.js');
// THE MOCKED WRITERS (review C-2): the frozen fixture also records every
// argument the cron hands to a writer this harness doubles — the executor,
// the tournament ledger, the learning receipt, the narration and anticipation
// dispatchers and the shadow logger — so a changed payload to any of them is
// a changed byte, not an invisible one.
const ledger = await import('../_utils/tournamentAgentLedger.js');
const receipts = await import('../_utils/learning/captureReceipt.js');
const narration = await import('../_utils/voiceLayerTradeNarration.js');
const anticipation = await import('../_utils/voiceLayerAnticipation.js');
const shadowLog = await import('../_utils/shadowLogger.js');
const WRITERS = {
  executeSwapServer: () => swapMock,
  reserveSymbol: () => ledger.reserveSymbol,
  confirmSwap: () => ledger.confirmSwap,
  releaseReservation: () => ledger.releaseReservation,
  captureSwapReceipt: () => receipts.captureSwapReceipt,
  generateTradeNarration: () => narration.generateTradeNarration,
  generateAnticipation: () => anticipation.generateAnticipation,
  logEvaluation: () => shadowLog.logEvaluation,
  logVisionTransition: () => shadowLog.logVisionTransition,
  logAnticipation: () => shadowLog.logAnticipation,
};

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = resolve(HERE, '../_utils/__fixtures__/callRecordsOffGolden.json');
/** The fixture's SHA-256 as captured from the pre-change tree (review C-9). */
const GOLDEN_SHA256 = '15a442dd066ba17104621083dc13deba3bd671167da538b4f232815fb6381091';
const ENV = globalThis.process?.env || {};
const GENERATE = ENV.GENERATE_CALLS_OFF_GOLDEN === '1';
if (GENERATE && ENV.CI) throw new Error('GENERATE_CALLS_OFF_GOLDEN is a local, deliberate act — never on CI');

const TIME_BUDGET_MS = 290_000;
class APIConnectionError extends Error {}

/** Pre-existing call records every row is seeded with (the rollback fixture). */
function seedRecords(battleId = 'battle-tick-1') {
  const callId = `${battleId}:eval_000:call:0`;
  return {
    calls: {
      [callId]: {
        callId, kind: 'called_shot', battleId, evalId: 'eval_000', evalSeq: 0, mintedAt: Date.parse('2026-09-09T14:00:00.000Z'),
        symbol: 'AMD', direction: 'entry', slot: 'support', counterpart: 'KO', condition: { side: 'above', level: 161 },
        horizon: { phrase: 'this_session', expiresAt: Date.parse('2026-09-09T20:00:00.000Z'), basis: 'this_session' },
        defaultAction: 'act', said: 'AMD into Support if it holds $161.', state: 'open',
        stateChangedAt: Date.parse('2026-09-09T14:00:00.000Z'), stateSource: 'mint',
        playerResponse: null, directiveThreadId: null, outcome: null, refused: null,
      },
    },
    declarations: { eval_000: { battleId, evalId: 'eval_000', calledShots: [], watching: ['AMD'], playerAsk: null, fork: null, removed: [] } },
    callObservations: { 'old-receipt': { callId: 'old', evalId: 'eval_000', observedAtMs: 1, px: 1, source: 'model_prompt', replacedInPrompt: false } },
    queue: { battleId, nextExpiresAt: Date.parse('2026-09-09T20:00:00.000Z'), updatedAt: Date.parse('2026-09-09T14:00:00.000Z') },
  };
}

function flatPrices() {
  const prices = makePriceTable();
  for (const [symbol, row] of Object.entries(prices)) prices[symbol] = { ...row, current: row.previousClose, changePercent: 0 };
  return prices;
}
function quietRankingsDoc() {
  const doc = makeRankingsDoc();
  return { ...doc, stocks: doc.stocks.map((row) => ({ ...row, bBandwidthPercentile: 70, nr7Flag: false })) };
}
/** Both risk-stop candidates busted (the tickCoherence precedent) → two forced exits. */
function bustingPrices() {
  const prices = makePriceTable();
  prices.KO = { ...prices.KO, current: 61.578 };
  prices.PG = { ...prices.PG, current: 163.647 };
  return prices;
}
const withGuardrail = (overrides = {}) => makeTickBattle({
  agentContext: { ...makeTickBattle().agentContext, deployedGuardrails: [{ type: 'stopLoss', value: 25, unit: '%', enforcement: 'hard' }] },
  ...overrides,
});

function swapInStore(db, tier, slotIndex, incoming, priceOf) {
  const stored = db.__store.battle;
  const outgoing = stored.portfolio[tier][slotIndex];
  stored.portfolio[tier] = stored.portfolio[tier].map((a, i) => (
    i === slotIndex ? { ...incoming, swapPrice: priceOf(incoming.symbol), swappedInAt: FROZEN_NOW } : a
  ));
  stored.portfolio.bench = {
    ...stored.portfolio.bench,
    stocks: [
      ...(stored.portfolio.bench.stocks || []).filter((a) => a.symbol !== incoming.symbol),
      { ...outgoing, cooldownUntil: '2026-09-10T15:00:00.000Z' },
    ],
  };
  stored.trades = [...(stored.trades || []), { symbolIn: incoming.symbol, symbolOut: outgoing.symbol, lockedPoints: 0, entryPrice: 0 }];
  stored.scoreState = { ...stored.scoreState, tradeCount: (stored.scoreState?.tradeCount || 0) + 1 };
  return outgoing;
}

/**
 * THE SCENARIOS — every §3.4 exit, the excluded rows, and the model-path
 * variants that touch a Build 0 seam (forced-entry replacement, a committed
 * model SWAP, the R11 pass on both gameplan exits).
 */
const SCENARIOS = {
  completed_hold: () => ({}),
  completed_hold_capture_off: () => ({ capture: false }),
  completed_swap: () => ({ result: makeSwapResult() }),
  risk_swaps_then_model_hold: () => ({ prices: bustingPrices() }),
  transport_failed: () => ({ modelThrows: new APIConnectionError('Connection error.') }),
  invalid_tool_result: () => ({ modelResponse: makeToolUseResponse(makeHoldResult({ decision: 'MAYBE' })) }),
  truncated_response: () => ({ modelResponse: { usage: {}, stop_reason: 'max_tokens', content: [{ type: 'text', text: 'partial' }] } }),
  budget_skipped: () => ({ cronStartTime: Date.parse(FROZEN_NOW) - (TIME_BUDGET_MS - 40_000) }),
  refresh_failed: () => ({ prices: bustingPrices(), breakRefreshAfterSwap: true }),
  prompt_build_failed: () => ({ buildThrows: 'institutional read exploded' }),
  no_trigger: () => ({
    battle: makeTickBattle({
      evaluations: [{ evalId: 'eval_1', timestamp: '2026-09-09T14:45:00.000Z', decision: 'HOLD', symbolOut: null, symbolIn: null, tier: null, rationale: 'held', hypothesis: null }],
    }),
    prices: flatPrices(),
    rankingsDoc: quietRankingsDoc(),
  }),
  proposal_pending: () => ({
    battle: makeTickBattle({
      executionMode: 'copilot',
      pendingProposal: { proposalId: 'p1', symbolOut: 'KO', symbolIn: 'AMD', tier: 'support', slotIndex: 0, mode: 'copilot', expiresAt: '2026-09-09T23:00:00.000Z' },
    }),
  }),
  gameplan_pending: () => ({ battle: makeTickBattle({ gameplanMeeting: { status: 'pending', diagnosis: 'drag', expiresAt: '2026-09-09T23:00:00.000Z', swaps: [] } }) }),
  gameplan_pending_with_pass: () => ({ battle: withGuardrail({ gameplanMeeting: { status: 'pending', diagnosis: 'drag', expiresAt: '2026-09-09T23:00:00.000Z', swaps: [] } }) }),
  gameplan_created: () => ({ battle: makeTickBattle({ cronState: { ...makeTickBattle().cronState, lastGameplanDate: null } }) }),
  gameplan_created_with_pass: () => ({ battle: withGuardrail({ cronState: { ...makeTickBattle().cronState, lastGameplanDate: null } }) }),
  cpu_passive: () => ({ battle: makeTickBattle({ isCpu: true }) }),
  degraded_quotes: () => { const prices = makePriceTable(); delete prices.NVDA; return { prices }; },
  tick_error: () => ({ failFinalUpdate: true }),
};

async function runScenario(name) {
  const {
    battle = makeTickBattle(), result = makeHoldResult(), prices = makePriceTable(), rankingsDoc = makeRankingsDoc(),
    capture = true, cronStartTime = Date.now(), modelThrows = null, modelResponse = null,
    breakRefreshAfterSwap = false, buildThrows = null, failFinalUpdate = false,
  } = SCENARIOS[name]();
  flagState.tickCapture = capture;
  buildHook.throwMessage = buildThrows;
  for (const get of Object.values(WRITERS)) get().mockClear();
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockImplementation(async () => {
    if (modelThrows) throw modelThrows;
    return modelResponse ?? makeToolUseResponse(result);
  });

  const seed = seedRecords(battle.id);
  const db = makeCallsDb({ battle, rankingsDoc, techDocs: makeTechDocs(), seed });
  let swaps = 0;
  if (breakRefreshAfterSwap || failFinalUpdate) {
    const baseCollection = db.collection.bind(db);
    db.collection = (col) => {
      const c = baseCollection(col);
      if (col !== 'agentBattles') return c;
      return {
        ...c,
        doc: (id) => {
          const ref = c.doc(id);
          return {
            ...ref,
            get: async () => (breakRefreshAfterSwap && swaps > 0 ? { exists: false, id, data: () => undefined } : ref.get()),
            update: async (payload) => {
              if (failFinalUpdate && Array.isArray(payload.evaluations)) throw new Error('final update failed');
              return ref.update(payload);
            },
          };
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
  // One capture scope per battle, exactly as the handler creates it; a tick
  // that THREW is finalized from that scope as the handler's catch does.
  const captureScope = capture ? newTickCaptureScope() : null;
  try {
    await runInTickCaptureScope(captureScope, () => processAgentBattle(db, battle, summary, cronStartTime, new Map(), { everEnabled: false }));
  } catch (err) {
    thrown = String(err?.message || err);
    const abandoned = claimTickCaptureContext(captureScope);
    if (abandoned) await finalizeTickCapture(db, abandoned, { remainingBudgetMs: TIME_BUDGET_MS - (Date.now() - cronStartTime) });
  }

  // The request params the model received (the AbortSignal option is not bytes).
  const prompts = mocks.create.mock.calls.map((call) => deepClone(call[0]));
  // Every writer's arguments; the Firestore handle and the in-memory battle
  // are named, not dumped (they are the harness's own objects).
  const argOf = (a) => {
    if (a === db) return '<db>';
    if (a === battle) return '<battle>';
    if (a && typeof a === 'object' && !Array.isArray(a) && 'db' in a) return Object.fromEntries(Object.entries(a).map(([k, v]) => [k, k === 'db' ? '<db>' : (v === battle ? '<battle>' : v)]));
    return a;
  };
  const writers = Object.fromEntries(Object.entries(WRITERS).map(([name, get]) => [name, get().mock.calls.map((call) => deepClone(call.map(argOf)))]));
  const snapshot = {
    thrown,
    summary,
    updates: db.__updates,
    prompts,
    capture: db.__captureWrites,
    writers,
  };
  return { snapshot, db, seed, swaps };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.getStockAnalysisData.mockReset();
  mocks.fetchIntradayBatch.mockReset();
  mocks.create.mockReset();
  swapMock.mockReset();
  buildHook.throwMessage = null;
  flagState.tickCapture = true;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const serialize = (v) => JSON.stringify(v);

describe('calls OFF — byte-identical to the frozen pre-change fixture on every exit', () => {
  it('GENERATE (local only) or load the frozen fixture', async () => {
    if (!GENERATE) {
      expect(existsSync(GOLDEN_PATH), 'frozen fixture missing — it is captured once, from the pre-change tree').toBe(true);
      return;
    }
    const scenarios = {};
    for (const name of Object.keys(SCENARIOS)) {
      const { snapshot } = await runScenario(name);
      scenarios[name] = JSON.parse(serialize(snapshot));
      mocks.create.mockReset();
      swapMock.mockReset();
    }
    writeFileSync(GOLDEN_PATH, `${JSON.stringify({
      capturedFrom: 'a git archive of claude/cockpit-build0-call-records @ 20d207d7 (product source byte-identical to origin/main @ 987a9a68 — BEFORE any Build 0 source) with this suite\'s review-C-2 harness (writer arguments; the errored tick finalized as the handler does); harness tickStampsHarness.js + tickCaptureHarness.js + callRecordsStore.js',
      frozenNow: FROZEN_NOW,
      toolSchema: JSON.parse(serialize(TRADE_DECISION_TOOL)),
      scenarios,
    }, null, 2)}\n`);
    throw new Error(`frozen fixture written to ${GOLDEN_PATH} — this generating run fails on purpose; re-run WITHOUT GENERATE_CALLS_OFF_GOLDEN to verify`);
  });

  const golden = existsSync(GOLDEN_PATH) ? JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) : null;

  it('the fixture is not vacuous: every scenario is present and each one wrote, and the paths are distinct', () => {
    expect(golden, 'frozen fixture missing').not.toBeNull();
    expect(Object.keys(golden.scenarios).sort()).toEqual(Object.keys(SCENARIOS).sort());
    for (const [name, snap] of Object.entries(golden.scenarios)) {
      expect(snap.updates.length, `${name} recorded no battle write`).toBeGreaterThan(0);
    }
    // The model-path rows carry the request; the early exits carry none.
    expect(golden.scenarios.completed_hold.prompts).toHaveLength(1);
    expect(golden.scenarios.completed_hold.capture.length).toBe(1);
    expect(golden.scenarios.completed_hold_capture_off.capture).toEqual([]);
    for (const name of ['no_trigger', 'proposal_pending', 'gameplan_pending', 'gameplan_created', 'cpu_passive', 'degraded_quotes', 'budget_skipped', 'prompt_build_failed']) {
      expect(golden.scenarios[name].prompts, name).toEqual([]);
    }
    expect(golden.scenarios.tick_error.thrown).toBe('final update failed');
    // The capture exit reason of each row proves the row reached the exit it names.
    const exitOf = (name) => golden.scenarios[name].capture[0]?.find((w) => w.path.includes('/ticks/'))?.data.exitReason ?? null;
    expect(exitOf('no_trigger')).toBe('no_trigger');
    expect(exitOf('proposal_pending')).toBe('proposal_pending');
    expect(exitOf('gameplan_pending')).toBe('gameplan_pending');
    expect(exitOf('gameplan_pending_with_pass')).toBe('gameplan_pending');
    expect(exitOf('gameplan_created')).toBe('gameplan_created');
    expect(exitOf('gameplan_created_with_pass')).toBe('gameplan_created');
    expect(exitOf('cpu_passive')).toBe('cpu_passive');
    expect(exitOf('degraded_quotes')).toBe('degraded_quotes');
    expect(exitOf('completed_hold')).toBe('completed');
    expect(exitOf('budget_skipped')).toBe('completed');
    // The forced-exit row really forced exits and the SWAP row really swapped.
    expect(golden.scenarios.risk_swaps_then_model_hold.summary.swapped).toBe(2);
    expect(golden.scenarios.completed_swap.summary.swapped).toBe(1);
    // The pass rows really ran the R11 pass (its capture flag), the plain rows did not.
    const passRan = (name) => golden.scenarios[name].capture[0]?.find((w) => w.path.includes('/ticks/'))?.data.guardrail.suppressionPassRan;
    expect(passRan('gameplan_pending_with_pass')).toBe(true);
    expect(passRan('gameplan_pending')).toBe(false);
    expect(passRan('gameplan_created_with_pass')).toBe(true);
    expect(passRan('gameplan_created')).toBe(false);
    // The errored tick's capture is finalized as the handler does, and compared (review C-2).
    expect(exitOf('tick_error')).toBe('tick_error');
    // The writers are recorded: the SWAP rows handed the executor its payload, the narration its trade.
    expect(golden.scenarios.completed_swap.writers.executeSwapServer).toHaveLength(1);
    // Positional: (db, battleId, battle, tier, slotIndex, incoming, currentDay, prices, evaluationMetadata, snapshot).
    const [swapCall] = golden.scenarios.completed_swap.writers.executeSwapServer;
    expect(swapCall[0]).toBe('<db>');
    expect(swapCall[2]).toBe('<battle>');
    expect(swapCall[8]).toBeTruthy(); // evaluationMetadata — the payload the executor persists
    expect(golden.scenarios.risk_swaps_then_model_hold.writers.executeSwapServer).toHaveLength(2);
    expect(golden.scenarios.completed_swap.writers.generateTradeNarration).toHaveLength(1);
  });

  it('the fixture file is exactly the one captured from the pre-change tree (SHA-256 pinned — review C-9)', () => {
    expect(createHash('sha256').update(readFileSync(GOLDEN_PATH)).digest('hex')).toBe(GOLDEN_SHA256);
  });

  it('the fixture is checked out as LF on every platform: its .gitattributes entry pins it, and the checked-out bytes carry no CR (review BR-5)', () => {
    const attributes = readFileSync(resolve(HERE, '../../.gitattributes'), 'utf8').split(/\r?\n/).map((l) => l.trim());
    expect(attributes).toContain('api/_utils/__fixtures__/callRecordsOffGolden.json text eol=lf');
    expect(readFileSync(GOLDEN_PATH).includes(0x0d)).toBe(false);
  });

  it('the process runs in UTC whatever the machine timezone, pinned by the FIRST import (review BR-5)', () => {
    expect(process.env.TZ).toBe('UTC');
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('UTC');
    expect(new Date(2026, 8, 9, 12).toISOString()).toBe('2026-09-09T12:00:00.000Z');
    const firstImport = readFileSync(fileURLToPath(import.meta.url), 'utf8').split(/\r?\n/).find((l) => l.startsWith('import '));
    expect(firstImport).toBe("import '../_utils/__fixtures__/pinTimezoneUtc.js';");
  });

  it('the tool schema is byte-identical to the frozen constant', () => {
    expect(serialize(TRADE_DECISION_TOOL)).toBe(serialize(golden.toolSchema));
  });

  for (const name of Object.keys(SCENARIOS)) {
    it(`${name}: every battle write, every prompt byte and both capture documents are byte-identical; the seeded call records are neither read nor written`, async () => {
      const { snapshot, db, seed } = await runScenario(name);
      const live = JSON.parse(serialize(snapshot));
      const frozen = golden.scenarios[name];
      expect(serialize(live.updates), `${name}: battle writes moved`).toBe(serialize(frozen.updates));
      expect(serialize(live.prompts), `${name}: prompt bytes moved`).toBe(serialize(frozen.prompts));
      expect(serialize(live.capture), `${name}: capture documents moved`).toBe(serialize(frozen.capture));
      expect(serialize(live.summary), `${name}: summary moved`).toBe(serialize(frozen.summary));
      expect(serialize(live.writers), `${name}: a writer's arguments moved`).toBe(serialize(frozen.writers));
      expect(live.thrown).toBe(frozen.thrown);
      // THE ROLLBACK FIXTURE: existing call records untouched and unread.
      expect(callsTouches(db), `${name}: the call-record collections were touched at off`).toEqual({ reads: 0, writes: 0, queries: 0 });
      for (const sub of CALL_SUBCOLLECTIONS) {
        expect(storedCollection(db, sub), `${name}: ${sub} changed`).toEqual(seed[sub]);
      }
      expect(storedDoc(db, 'callSweepQueue')).toEqual(seed.queue);
      // No calls key rides any battle write or cronState at off.
      expect(serialize(live.updates)).not.toMatch(/declarationsPhase|callFlips|callsDiag/);
    });
  }
});
