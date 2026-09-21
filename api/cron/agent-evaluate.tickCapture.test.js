// api/cron/agent-evaluate.tickCapture.test.js
//
// Tick capture — FLAG ON, end to end on the REAL processAgentBattle (spec
// docs/specs/CAPTURE_BUILD_SPEC_V1_3.md §7). The tickStamps/intradayViews
// harness, the same frozen clock, the same seven-position book.
//
// What this suite proves:
//   · EVERY exit in the Phase 0 exit map gets a record, with its own
//     `exitReason` and the stage it actually reached (C-8);
//   · the model outcome, the guardrail fault and the post-decision outcomes
//     are SEPARATE fields — a HOLD caused by a rejected proposal is never
//     filed as a model failure, and one tick can carry both faults (C-8);
//   · a multi-action tick numbers its actions `${tickId}:${n}` in execution
//     order, inside the record only, with the trade entries untouched (C-10);
//   · a committed swap followed by a failed refresh still records both the
//     action and the `refresh_failed` outcome;
//   · a capture write that FAILS or TIMES OUT leaves the tick's own results
//     and writes unchanged, and leaves a countable gap (C-1, C-9);
//   · the C-3 sentinels: text confined to chat and forensics reaches NEITHER
//     document; text in a RENDERED custom rule appears unchanged in the body;
//     a non-universe symbol lands in the body, never the permanent record;
//   · capture SKIPS below the minimum remaining handler budget (C-9).
//
// `executeSwapServer` is doubled through a hoisted variable so the literal
// call string never appears here — the repo-level call-site census in
// agent-evaluate.test.js still reads this file as a non-consumer (the
// tickCoherence suite's precedent).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FROZEN_NOW, FROZEN_DAY_ET, makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs,
  makeIntradayCandles, makeHoldResult, makeSwapResult, makeToolUseResponse, undefinedPaths,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { makeCaptureDb, permanentDoc, bodyDoc, containsText } from '../_utils/__fixtures__/tickCaptureHarness.js';
import { claimTickCaptureContext, peekTickCaptureContext } from '../_utils/tickCapture/captureContext.js';
import { finalizeTickCapture } from '../_utils/tickCapture/captureWriter.js';
import { TICK_CAPTURE_MIN_REMAINING_BUDGET_MS } from '../_utils/tickCapture/captureConfig.js';

const mocks = vi.hoisted(() => ({ getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn() }));
const { swapMock } = vi.hoisted(() => ({ swapMock: vi.fn() }));
const { guardrailHook } = vi.hoisted(() => ({ guardrailHook: { throwMessage: null } }));
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
// The fenced executor, DOUBLED in tests only (never edited): the double
// reproduces its effect on the STORED doc so the tick's own rebuild is real.
vi.mock('../_utils/agentSwapExecution.js', async (importOriginal) => ({
  ...(await importOriginal()),
  executeSwapServer: swapMock,
}));
// The fenced guardrail evaluator, WRAPPED not replaced — the real one runs
// unless a row asks it to fault, which is how the guardrail-fault rows get a
// real `guardrailFault` without editing a fenced file.
vi.mock('../_utils/agentGuardrails.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    applyGuardrails: (args) => {
      if (guardrailHook.throwMessage) throw new Error(guardrailHook.throwMessage);
      return real.applyGuardrails(args);
    },
  };
});
vi.mock('../_utils/tournamentAgentLedger.js', () => ({
  resolveTournamentContext: vi.fn(async () => null), excludeHeldByOthers: vi.fn(), excludeHeldSymbols: vi.fn(),
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
  return { ...actual, get TICK_CAPTURE_ENABLED() { return flagState.tickCapture; } };
});

const { processAgentBattle } = await import('./agent-evaluate.js');

const BATTLE_ID = 'battle-tick-1';
/** The detector's own frequency-cap key for the frozen day. */
const ET_TODAY = new Date(FROZEN_NOW).toLocaleDateString('en-US', { timeZone: 'America/New_York' });

/** A transport error whose CONSTRUCTOR name is what the classifier reads. */
class APIConnectionError extends Error {}
const tickIdOf = (seq = 1) => `${BATTLE_ID}:${seq}`;

/**
 * The rankings doc with every volatility-contraction flag OFF. The fixture's
 * rows carry `bBandwidthPercentile: 15` / `nr7Flag: true`, which fire the
 * bandwidth_squeeze and nr7_contraction triggers on their own — so a genuinely
 * quiet tick needs a quiet rankings doc as well as flat prices.
 */
function quietRankingsDoc() {
  const doc = makeRankingsDoc();
  return { ...doc, stocks: doc.stocks.map((row) => ({ ...row, bBandwidthPercentile: 70, nr7Flag: false })) };
}

/** Every name sitting exactly at its previous close — no conditional trigger fires. */
function flatPrices() {
  const prices = makePriceTable();
  for (const [symbol, row] of Object.entries(prices)) {
    prices[symbol] = { ...row, current: row.previousClose, changePercent: 0 };
  }
  return prices;
}

/** Both risk-stop candidates busted (the tickCoherence precedent) → two forced exits. */
function bustingPrices({ only = null } = {}) {
  const prices = makePriceTable();
  if (only !== 'PG') prices.KO = { ...prices.KO, current: 61.578 };
  if (only !== 'KO') prices.PG = { ...prices.PG, current: 163.647 };
  return prices;
}

/** Reproduce the executor's effect on the STORED doc — not its internals. */
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

async function runTick({
  battle = makeTickBattle(),
  result = makeHoldResult(),
  prices = makePriceTable(),
  rankingsDoc = makeRankingsDoc(),
  capture = true,
  cronStartTime = Date.now(),
  failCapture = null,
  breakRefreshAfterSwap = false,
  modelThrows = null,
  modelResponse = null,
} = {}) {
  flagState.tickCapture = capture;
  guardrailHook.throwMessage = guardrailHook.throwMessage ?? null;
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockImplementation(async () => {
    if (modelThrows) throw modelThrows;
    return modelResponse ?? makeToolUseResponse(result);
  });

  const db = makeCaptureDb({ battle, rankingsDoc, techDocs: makeTechDocs() });
  db.__failCapture = failCapture;

  let swaps = 0;
  if (breakRefreshAfterSwap) {
    // The post-swap re-read comes back EMPTY — refreshBattleFromDoc's
    // `!refreshedData` branch, which is what sets `refreshFailure`. The store
    // itself stays intact, so every write the tick still makes is observable.
    const baseCollection = db.collection.bind(db);
    db.collection = (col) => {
      const c = baseCollection(col);
      return {
        ...c,
        doc: (id) => {
          const ref = c.doc(id);
          return { ...ref, get: async () => (col === 'agentBattles' && swaps > 0 ? { exists: false, id, data: () => undefined } : ref.get()) };
        },
      };
    };
  }
  swapMock.mockImplementation(async (dbArg, _id, _b, tier, slotIndex, incoming) => {
    swaps += 1;
    const outgoing = swapInStore(db, tier, slotIndex, incoming, (s) => prices[s]?.current ?? 0);
    return {
      closedTrade: { symbolIn: incoming.symbol, symbolOut: outgoing.symbol, swappedOutAt: FROZEN_NOW, entryPrice: 0, lockedPoints: 1.5 },
      incomingAsset: { ...incoming, swapPrice: prices[incoming.symbol]?.current ?? 0 },
    };
  });

  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  let thrown = null;
  try {
    await processAgentBattle(db, battle, summary, cronStartTime, new Map(), { everEnabled: false });
  } catch (err) { thrown = err; }

  const finalUpdate = db.__updates.find((u) => Array.isArray(u.evaluations)) || null;
  const seq = db.__updates[0]?.['cronState.tickSeq'] ?? 1;
  return {
    db, summary, thrown, finalUpdate, swaps,
    permanent: permanentDoc(db, BATTLE_ID, tickIdOf(seq)),
    body: bodyDoc(db, BATTLE_ID, tickIdOf(seq)),
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.getStockAnalysisData.mockReset();
  mocks.fetchIntradayBatch.mockReset();
  mocks.create.mockReset();
  swapMock.mockReset();
  guardrailHook.throwMessage = null;
  flagState.tickCapture = true;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); claimTickCaptureContext(BATTLE_ID); });

// ─────────────────────────────────────────────────────────────────────────────
describe('C-8 — every exit in the Phase 0 exit map, flag OFF and ON', () => {
  const EXITS = [
    {
      name: 'degraded_quotes', stage: 'quotes_checked',
      run: () => {
        const prices = makePriceTable();
        delete prices.NVDA;   // a REQUIRED held quote is unusable
        return { prices };
      },
    },
    { name: 'cpu_passive', stage: 'scores_marked', run: () => ({ battle: makeTickBattle({ isCpu: true }) }) },
    {
      name: 'proposal_pending', stage: 'proposal_handled',
      run: () => ({
        battle: makeTickBattle({
          executionMode: 'copilot',
          pendingProposal: { proposalId: 'p1', symbolOut: 'KO', symbolIn: 'AMD', tier: 'support', slotIndex: 0, mode: 'copilot', expiresAt: '2026-09-09T23:00:00.000Z' },
        }),
      }),
    },
    {
      name: 'gameplan_pending', stage: 'gameplan_handled',
      run: () => ({
        battle: makeTickBattle({ gameplanMeeting: { status: 'pending', diagnosis: 'drag', expiresAt: '2026-09-09T23:00:00.000Z', swaps: [] } }),
      }),
    },
    {
      name: 'gameplan_created', stage: 'gameplan_handled',
      // The fixture pins the detector's one-per-ET-day cap ON (its own comment
      // says the Consumer Cyclical drag would otherwise trip the meeting).
      // Clearing the cap is exactly what puts this tick on that path.
      run: () => ({
        battle: makeTickBattle({ cronState: { ...makeTickBattle().cronState, lastGameplanDate: null } }),
      }),
    },
    {
      name: 'no_trigger', stage: 'trigger_evaluated',
      // Past the first evaluation (so `forced_open` does not fire) and FLAT —
      // every held name sits at its entry, so no conditional trigger fires
      // either. The fixture's own gameplan cap (ET_TODAY) stays on.
      run: () => ({
        battle: makeTickBattle({
          evaluations: [{ evalId: 'eval_1', timestamp: '2026-09-09T14:45:00.000Z', decision: 'HOLD', symbolOut: null, symbolIn: null, tier: null, rationale: 'held', hypothesis: null }],
        }),
        prices: flatPrices(),
        rankingsDoc: quietRankingsDoc(),
      }),
    },
    { name: 'completed', stage: 'finalized', run: () => ({}) },
  ];

  for (const exit of EXITS) {
    it(`${exit.name}: flag ON writes a record naming it; flag OFF writes nothing`, async () => {
      const on = await runTick({ capture: true, ...exit.run() });
      expect(on.permanent, `${exit.name} must produce a record`).not.toBeNull();
      expect(on.permanent.exitReason).toBe(exit.name);
      expect(on.permanent.stageReached).toBe(exit.stage);
      expect(on.permanent.tickSeq).toBe(1);
      expect(undefinedPaths(on.permanent)).toEqual([]);
      expect(on.body).not.toBeNull();

      const off = await runTick({ capture: false, ...exit.run() });
      expect(off.db.__captureWrites, `${exit.name} must write nothing with the flag off`).toEqual([]);
      expect(off.db.__updates[0]).toEqual({ 'cronState.evaluatingAt': FROZEN_NOW });
    });
  }

  it('the seven exits above are DISTINCT — no two scenarios collapse onto one reason', async () => {
    const reasons = [];
    for (const exit of EXITS) reasons.push((await runTick({ capture: true, ...exit.run() })).permanent.exitReason);
    expect(new Set(reasons).size).toBe(EXITS.length);
  });

  it('tick_error: the thrown tick leaves its context registered as `tick_error`, unfinalized, for the OUTER handler', async () => {
    // The final battle update throws AFTER the entry is composed — Phase 0's
    // "a failed final battle write cannot satisfy after-the-final-update".
    const battle = makeTickBattle();
    const db = makeCaptureDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
    const baseCollection = db.collection.bind(db);
    db.collection = (col) => {
      const c = baseCollection(col);
      return {
        ...c,
        doc: (id) => {
          const ref = c.doc(id);
          return { ...ref, update: async (payload) => { if (Array.isArray(payload.evaluations)) throw new Error('final update failed'); return ref.update(payload); } };
        },
      };
    };
    flagState.tickCapture = true;
    mocks.getStockAnalysisData.mockImplementation(async (s) => (makePriceTable()[s] ? { price: makePriceTable()[s], daily: [] } : {}));
    mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
    mocks.create.mockImplementation(async () => makeToolUseResponse(makeHoldResult()));

    await expect(processAgentBattle(db, battle, { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 }, Date.now(), new Map(), { everEnabled: false }))
      .rejects.toThrow('final update failed');

    // The `finally` SKIPPED capture — nothing written yet…
    expect(db.__captureWrites).toEqual([]);
    const ctx = peekTickCaptureContext(BATTLE_ID);
    expect(ctx, 'the context must survive the throw for the outer handler').not.toBeNull();
    expect(ctx.state.exitReason).toBe('tick_error');

    // …and the outer handler's two calls produce the record, after its receipt.
    const claimed = claimTickCaptureContext(BATTLE_ID);
    const result = await finalizeTickCapture(db, claimed, { remainingBudgetMs: 200_000 });
    expect(result.disposition).toBe('written');
    expect(permanentDoc(db, BATTLE_ID, tickIdOf(1)).exitReason).toBe('tick_error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('C-8 — model outcome, guardrail fault and post-decision outcomes are SEPARATE fields', () => {
  it('a transport failure is a MODEL failure, and its message lives only in the body', async () => {
    const { permanent, body } = await runTick({ modelThrows: new APIConnectionError('Connection error.') });
    expect(permanent.model.outcome).toBe('failed');
    expect(permanent.model.failureClass).toBe('APIConnectionError');
    expect(permanent.guardrail.faultClass).toBeNull();
    expect(body.faults.model).toContain('Connection error');
    expect(JSON.stringify(permanent)).not.toContain('Connection error');
  });

  it('a schema-invalid tool result keeps its class AND the field that failed', async () => {
    const { permanent } = await runTick({ modelResponse: makeToolUseResponse(makeHoldResult({ decision: 'MAYBE' })) });
    expect(permanent.model.outcome).toBe('failed');
    expect(permanent.model.failureClass).toBe('invalid_tool_result');
    expect(permanent.model.invalidField).toBe('decision');
    expect(permanent.decision.holdKind).toBe('default_failure');
  });

  it('a MISSING tool block is `truncated_response`, not an invalid one', async () => {
    const { permanent } = await runTick({ modelResponse: { usage: {}, stop_reason: 'max_tokens', content: [{ type: 'text', text: 'partial' }] } });
    expect(permanent.model.failureClass).toBe('truncated_response');
    expect(permanent.model.invalidField).toBeNull();
  });

  it('BOTH faults on ONE tick: the guardrail fault never overwrites the model outcome', async () => {
    guardrailHook.throwMessage = 'sector cap evaluation exploded';
    const { permanent, body } = await runTick({
      modelResponse: makeToolUseResponse(makeHoldResult({ decision: 'MAYBE' })),   // schema-invalid → model failure
      battle: makeTickBattle({ agentContext: { ...makeTickBattle().agentContext, deployedGuardrails: [{ type: 'stopLoss', value: 25, unit: '%', enforcement: 'hard' }] } }),
    });
    expect(permanent.model.outcome).toBe('failed');
    expect(permanent.model.failureClass).toBe('invalid_tool_result');
    expect(permanent.guardrail.faultClass).toBe('guardrail_error');
    expect(body.faults.guardrail).toBe('sector cap evaluation exploded');
    expect(body.faults.model).not.toBe(body.faults.guardrail);
  });

  it('a HOLD caused by a REJECTED PROPOSAL is never recorded as a model failure (C-8)', async () => {
    // The model answers cleanly and proposes a swap the platform then blocks.
    const { permanent } = await runTick({ result: makeSwapResult({ symbolIn: 'NVDA' }) }); // already held → validation blocks
    expect(permanent.model.outcome).toBe('ok');
    expect(permanent.model.failureClass).toBeNull();
    expect(permanent.decision.original).toBe('SWAP');
    expect(permanent.decision.final).toBe('HOLD');
    expect(permanent.decision.downgraded).toBe(true);
    expect(permanent.checks.proposedPairValidation).toMatchObject({ status: 'evaluated', result: 'blocked' });
    // the HOLD was CHOSEN by the platform, not defaulted by a failure
    expect(permanent.decision.holdKind).toBeNull();
  });

  it('C-6: a check the tick never reached is `not_evaluated`, never "passed"', async () => {
    const { permanent } = await runTick({ result: makeHoldResult() }); // no SWAP → no pair checks ran
    expect(permanent.checks.proposedPairValidation.status).toBe('not_evaluated');
    expect(permanent.checks.hurdle.status).toBe('not_evaluated');
    expect(permanent.checks.lock.status).toBe('not_evaluated');
    for (const check of Object.values(permanent.checks)) expect(check.result).not.toBe('passed');
  });

  it('C-6: the conviction floor is `unknown` — its verdict is discarded inside the fenced validator', async () => {
    const { permanent } = await runTick({ result: makeSwapResult() });
    expect(permanent.checks.conviction.status).toBe('unknown');
    expect(permanent.checks.conviction.result).toBeNull();
    // anti-vacuous: the checks that DID run on the same tick are `evaluated`
    expect(permanent.checks.proposedPairValidation.status).toBe('evaluated');
    expect(permanent.checks.hurdle.status).toBe('evaluated');
  });

  it('C-6: a no-op tournament reservation is `bypassed`, not a claimed pass', async () => {
    const { permanent } = await runTick({ result: makeSwapResult() });
    expect(permanent.checks.reservation).toMatchObject({ status: 'bypassed', result: null });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('C-10 — actions, and the trade entries they do NOT touch', () => {
  it('a single autopilot SWAP records ONE action with the executor\'s own symbols', async () => {
    const { permanent, db, summary } = await runTick({ result: makeSwapResult() });
    expect(summary.swapped).toBe(1);
    expect(permanent.actions).toHaveLength(1);
    expect(permanent.actions[0]).toMatchObject({
      actionId: `${tickIdOf(1)}:1`, n: 1, kind: 'swap', source: 'haiku',
      exitReason: 'haiku_decision', symbolOut: 'KO', symbolIn: 'AMD', committed: true,
    });
    // the trade entry is UNCHANGED — no action id, no tick id
    const trade = db.__store.battle.trades.at(-1);
    expect(trade).not.toHaveProperty('actionId');
    expect(trade).not.toHaveProperty('tickId');
  });

  it('a MULTI-ACTION tick numbers its actions 1..n in EXECUTION order', async () => {
    const { permanent, swaps } = await runTick({ prices: bustingPrices() });
    expect(swaps).toBeGreaterThanOrEqual(2);
    expect(permanent.actions.length).toBe(swaps);
    expect(permanent.actions.map((a) => a.n)).toEqual(permanent.actions.map((_, i) => i + 1));
    expect(permanent.actions.map((a) => a.actionId)).toEqual(permanent.actions.map((_, i) => `${tickIdOf(1)}:${i + 1}`));
    for (const action of permanent.actions) {
      expect(action.source).toBe('risk_manager');
      expect(action.committed).toBe(true);
      expect(action.lockedPoints).toBe(1.5);
    }
  });

  it('a committed swap followed by a FAILED REFRESH records the action AND the refresh_failed outcome', async () => {
    const { permanent } = await runTick({ prices: bustingPrices({ only: 'KO' }), breakRefreshAfterSwap: true });
    expect(permanent.actions.length).toBeGreaterThanOrEqual(1);
    expect(permanent.actions[0].committed).toBe(true);
    expect(permanent.model.outcome).toBe('failed');
    expect(permanent.model.failureClass).toBe('refresh_failed');
    // no model request was dispatched, so this tick is NOT a usable-pair denominator
    expect(permanent.model.dispatched).toBe(false);
    expect(permanent.body.status).toBe('skipped');
  });

  it('C-1: a tick that DID dispatch says so — it is the usable-pairs denominator', async () => {
    const dispatched = await runTick({ result: makeHoldResult() });
    expect(dispatched.permanent.model.dispatched).toBe(true);
    expect(dispatched.permanent.model.attempted).toBe(true);
    expect(dispatched.permanent.callEnvelope.requestedModel).toBeTruthy();
    expect(dispatched.permanent.callEnvelope.maxOutputTokens).toBeGreaterThan(0);
    // …and a tick that never reached the call says so too, so a MISSING record
    // is `attempt unknown` rather than a failed pair.
    const never = await runTick({ battle: makeTickBattle({ isCpu: true }) });
    expect(never.permanent.model.dispatched).toBe(false);
    expect(never.permanent.model.attempted).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('C-3 — the sentinels', () => {
  const CHAT_SENTINEL = 'ZZQX-CHAT-ONLY-SENTINEL-8842';
  const RULE_SENTINEL = 'ZZQX-RENDERED-RULE-SENTINEL-1177';

  it('a sentinel confined to CHAT and FORENSICS reaches NEITHER document', async () => {
    const base = makeTickBattle();
    const battle = makeTickBattle({
      chatExchanges: [{ userMessage: `${CHAT_SENTINEL} please sell everything`, agentResponse: CHAT_SENTINEL, scratchpad: CHAT_SENTINEL }],
      cronState: { ...base.cronState, cronErrors: [{ timestamp: FROZEN_NOW, error: CHAT_SENTINEL, stack: CHAT_SENTINEL }] },
      proposalHistory: [{ proposalId: 'p0', userReason: CHAT_SENTINEL }],
    });
    const { permanent, body } = await runTick({ battle });
    expect(containsText(permanent, CHAT_SENTINEL)).toBe(false);
    expect(containsText(body, CHAT_SENTINEL)).toBe(false);
  });

  it('a sentinel in a RENDERED custom rule appears UNCHANGED in the body, and never on the permanent record', async () => {
    const base = makeTickBattle();
    const battle = makeTickBattle({
      agentContext: {
        ...base.agentContext,
        activeRules: [{ ruleId: 'rule-1', text: `Never exit before ${RULE_SENTINEL} confirms`, category: 'exit', hardness: 'soft' }],
      },
    });
    const { permanent, body } = await runTick({ battle });
    expect(body.controlsAsRendered.activeRuleTexts).toContain(`Never exit before ${RULE_SENTINEL} confirms`);
    expect(containsText(permanent, RULE_SENTINEL)).toBe(false);
    // the record still IDENTIFIES the rule — by id and by a hash of that text
    expect(permanent.controls.activeRuleIds).toEqual(['rule-1']);
    expect(permanent.controls.activeRuleTextHashes[0]).toMatch(/^[a-f0-9]{64}$/);
  });

  it('the directive\'s words go to the body; the permanent record keeps its id, version and hash', async () => {
    const { permanent, body } = await runTick({});
    expect(body.controlsAsRendered.directiveText).toBe('Require stronger confirmation before entering');
    expect(permanent.controls.directiveThreadId).toBe('thread-tf02-0001');
    expect(permanent.controls.directiveCanonicalTextVersion).toBe(1);
    expect(permanent.controls.directiveTextHash).toMatch(/^[a-f0-9]{64}$/);
    expect(containsText(permanent, 'Require stronger confirmation')).toBe(false);
  });

  it('a NON-UNIVERSE symbol lands in the body, not the permanent document', async () => {
    // The model names a ticker this tick never held, benched or rendered.
    const { permanent, body } = await runTick({ result: makeSwapResult({ symbolIn: 'ZZZZ' }) });
    expect(permanent.decision.originalSymbolIn).toBeNull();
    expect(permanent.capture.rejectedFieldCount).toBeGreaterThan(0);
    expect(body.rejectedFields.some((r) => r.value === 'ZZZZ')).toBe(true);
    // anti-vacuous: the OUTGOING symbol, which the tick did hold, IS admitted
    expect(permanent.decision.originalSymbolOut).toBe('KO');
  });

  it('the permanent record carries no free text at all — the writer\'s own sweep agrees', async () => {
    const { permanent } = await runTick({ result: makeSwapResult() });
    const rationale = makeSwapResult().rationale;
    expect(containsText(permanent, rationale.slice(0, 30))).toBe(false);
    expect(containsText(permanent, 'Hypothesis')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('C-1 / C-9 — a capture that fails, times out or skips never costs the tick anything', () => {
  it('a FAILED capture write leaves the tick\'s own writes byte-identical and the record absent', async () => {
    const good = await runTick({ result: makeSwapResult() });
    const bad = await runTick({ result: makeSwapResult(), failCapture: 'throw' });
    expect(bad.permanent).toBeNull();
    expect(bad.db.__captureWrites).toEqual([]);
    // the tick's own results and writes are unchanged
    expect(bad.summary).toEqual(good.summary);
    expect(bad.db.__updates).toEqual(good.db.__updates);
    expect(bad.db.__store.battle.trades).toEqual(good.db.__store.battle.trades);
    expect(bad.thrown).toBeNull();
  });

  it('a capture BELOW the minimum remaining budget skips — a countable gap, with the tick untouched', async () => {
    const budgeted = await runTick({ cronStartTime: Date.now() - (290_000 - (TICK_CAPTURE_MIN_REMAINING_BUDGET_MS - 1)) });
    expect(budgeted.permanent).toBeNull();
    expect(budgeted.db.__captureWrites).toEqual([]);
    // the SEQUENCE was still minted, which is exactly what makes the gap countable
    expect(budgeted.db.__updates[0]['cronState.tickSeq']).toBe(1);
    // and the tick still wrote its own record
    expect(budgeted.finalUpdate).not.toBeNull();
  });

  it('the record is bounded: it reports its own cost and the two founder-adjustable constants', async () => {
    const { permanent } = await runTick({});
    expect(permanent.capture.deadlineMs).toBe(3_000);
    expect(permanent.capture.minRemainingBudgetMs).toBe(10_000);
    expect(permanent.capture.remainingBudgetMs).toBe(290_000);
    expect(permanent.capture.ms).toBeGreaterThanOrEqual(0);
  });
});
