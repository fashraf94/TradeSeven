// api/cron/agent-evaluate.astraFindings.test.js
//
// Part C — the confirm/refute suite for Astra's blind review of the composed
// eval fixes, and the regression lock for each fix that followed.
//
// BUILD_RULES §2 requires every finding to be independently CONFIRMED or
// REFUTED before it is acted on. Each row below was written against the
// POST-fix behaviour and run on the pre-fix tree first: red there, green here.
// The red-then-green evidence is recorded in §11 of
// docs/audits/20260919_BUILD_EVAL_FIX_INTEGRATION.md.
//
// The seam is the real `processAgentBattle` on the shared tick harness. The
// fenced `agentEvalPromptAssembly.js` is WRAPPED (the real builder runs; its
// inputs and output are recorded) and the fenced `agentGuardrails.js` is
// doubled only where "the evaluator throws" is the premise. Neither is edited.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FROZEN_NOW,
  makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs, makeIntradayCandles,
  makeHoldResult, makeToolUseResponse, makeTickDb,
} from '../_utils/__fixtures__/tickStampsHarness.js';

const mocks = vi.hoisted(() => ({
  getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn(), fetchRecentNews: vi.fn(async () => []),
}));
// Assigned by reference — naming it `…Mock` keeps the literal text
// `executeSwapServer(` out of this file, so the repo-level call-site census in
// agent-evaluate.test.js still reads this suite as a non-consumer.
const { executeSwapServerMock } = vi.hoisted(() => ({ executeSwapServerMock: vi.fn() }));
const { captured } = vi.hoisted(() => ({ captured: { calls: [] } }));
// null → run the real evaluator; an Error → throw it.
// null → run the real evaluator; `throws` → throw it; `returns` → hand back
// that result instead of evaluating.
const { guardrailState } = vi.hoisted(() => ({ guardrailState: { throws: null, returns: null, calls: 0 } }));
// E2 — what the shadow stream was handed.
const { shadow } = vi.hoisted(() => ({ shadow: { calls: [] } }));

vi.mock('@anthropic-ai/sdk', () => ({ default: class AnthropicMock { constructor() { this.messages = { create: (...args) => mocks.create(...args) }; } } }));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.getStockAnalysisData, fetchIntradayBatch: mocks.fetchIntradayBatch,
  fetchIntradayCandles: vi.fn(async () => []), filterToLatestSession: vi.fn((candles) => ({ candles: candles || [], sessionDate: '2026-09-09' })),
}));
vi.mock('../_utils/agentEvalPromptAssembly.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    buildLiveContextBlock: async (...args) => {
      const block = await real.buildLiveContextBlock(...args);
      captured.calls.push({ battle: args[0], assetScores: args[3], momentumData: args[7], block });
      return block;
    },
  };
});
vi.mock('../_utils/agentGuardrails.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    applyGuardrails: (...args) => {
      guardrailState.calls += 1;
      if (guardrailState.throws) throw guardrailState.throws;
      if (guardrailState.returns) return guardrailState.returns;
      return real.applyGuardrails(...args);
    },
  };
});
vi.mock('../_utils/agentSwapExecution.js', async (importOriginal) => ({
  ...(await importOriginal()),
  executeSwapServer: executeSwapServerMock,
}));
vi.mock('../_utils/agentTriggerGate.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchRecentNews: (...args) => mocks.fetchRecentNews(...args),
}));
vi.mock('../_utils/tournamentAgentLedger.js', () => ({ resolveTournamentContext: vi.fn(async () => null), excludeHeldByOthers: vi.fn(), excludeHeldSymbols: vi.fn(), reserveSymbol: vi.fn(), confirmSwap: vi.fn(), releaseReservation: vi.fn() }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));
vi.mock('../_utils/voiceLayerAnticipation.js', async (importOriginal) => ({ ...(await importOriginal()), generateAnticipation: vi.fn(async () => null) }));
vi.mock('../_utils/voiceLayerTradeNarration.js', async (importOriginal) => ({ ...(await importOriginal()), generateTradeNarration: vi.fn(async () => null) }));
vi.mock('../_utils/shadowLogger.js', async (importOriginal) => ({ ...(await importOriginal()), logEvaluation: async (payload) => { shadow.calls.push(payload); return false; }, logVisionTransition: vi.fn(async () => false), logAnticipation: vi.fn(async () => false) }));
vi.mock('../_utils/learning/captureReceipt.js', () => ({
  captureSwapReceipt: vi.fn(async () => {}),
  resolveEntrySnapshot: vi.fn(async () => ({ snapshotIn: null, techDocIn: null, entrySnapshotSource: 'unavailable' })),
  classifyEntryAtrSource: vi.fn(() => 'bench_atr'),
  classifyEvidence: vi.fn(() => 'live_agent'),
}));

const { processAgentBattle } = await import('./agent-evaluate.js');

const STOP_LOSS = { type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' };
// Narrow enough to breach INSIDE the risk manager's bust buffer — see F3.
const TIGHT_STOP = { type: 'stopLoss', value: 0.5, unit: '%', enforcement: 'hard' };

/** KO one point below its bust line — a REAL emergency exit from the production risk manager. */
function koBustPrices(overrides = {}) {
  const prices = makePriceTable();
  prices.KO = { ...prices.KO, current: 61.578 };
  return { ...prices, ...overrides };
}

function guarded(battle) {
  return { ...battle, agentContext: { ...battle.agentContext, deployedGuardrails: [STOP_LOSS] } };
}

/**
 * makeTickDb, with the battle doc's reads instrumented so a row can make the
 * post-swap `refreshBattleFromDoc` read fail the way production can.
 */
function makeDb(battle, { failBattleGetAfter = null, emptyBattleGetAfter = null, rankingsDoc = null } = {}) {
  const db = makeTickDb({ battle, rankingsDoc: rankingsDoc || makeRankingsDoc(), techDocs: makeTechDocs() });
  const realCollection = db.collection.bind(db);
  let gets = 0;
  db.collection = (col) => {
    const handle = realCollection(col);
    if (col !== 'agentBattles') return handle;
    return {
      ...handle,
      doc: (id) => {
        const ref = handle.doc(id);
        return {
          ...ref,
          get: async () => {
            gets += 1;
            if (failBattleGetAfter !== null && gets > failBattleGetAfter) {
              throw new Error('Firestore unavailable: deadline exceeded');
            }
            if (emptyBattleGetAfter !== null && gets > emptyBattleGetAfter) {
              return { exists: false, id, data: () => undefined };
            }
            return ref.get();
          },
          update: (payload) => ref.update(payload),
        };
      },
    };
  };
  return db;
}

/**
 * One real tick.
 * `execPriceOf` decides what the executor records as the incoming entry —
 * production takes it from the LIVE BEACON when one is fresh, which is not the
 * REST quote the tick fetched. Defaulting it to the REST quote is exactly the
 * masking Astra's finding 1 names, so rows opt in explicitly.
 */
async function runTick({
  battle = makeTickBattle(),
  prices = makePriceTable(),
  respond = async () => makeToolUseResponse(makeHoldResult()),
  execPriceOf = (s) => prices[s]?.current ?? 0,
  cronStartTime = Date.now(),
  db: providedDb = null,
} = {}) {
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockImplementation(respond);
  const db = providedDb || makeDb(battle);
  executeSwapServerMock.mockImplementation(async (dbArg, _id, _battle, tier, slotIndex, incoming) => {
    const stored = dbArg.__store.battle;
    const outgoing = stored.portfolio[tier][slotIndex];
    const swapPrice = execPriceOf(incoming.symbol);
    stored.portfolio[tier] = stored.portfolio[tier].map((a, i) => (
      i === slotIndex ? { ...incoming, swapPrice, swappedInAt: FROZEN_NOW } : a
    ));
    stored.portfolio.bench = {
      ...stored.portfolio.bench,
      stocks: [
        ...(stored.portfolio.bench.stocks || []).filter((a) => a.symbol !== incoming.symbol),
        { ...outgoing, cooldownUntil: '2026-09-10T15:00:00.000Z' },
      ],
    };
    stored.trades = [...(stored.trades || []), {
      symbolIn: incoming.symbol, symbolOut: outgoing.symbol, lockedPoints: 0, entryPrice: 0,
    }];
    stored.scoreState = { ...stored.scoreState, tradeCount: (stored.scoreState?.tradeCount || 0) + 1 };
    return {
      closedTrade: { symbolIn: incoming.symbol, symbolOut: outgoing.symbol, swappedOutAt: FROZEN_NOW, entryPrice: 0, lockedPoints: 0 },
      incomingAsset: { ...incoming, swapPrice },
    };
  });
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  await processAgentBattle(db, battle, summary, cronStartTime, new Map(), { everEnabled: false });
  const finalUpdate = db.__updates.find((u) => Array.isArray(u.evaluations)) || null;
  return {
    db, summary, finalUpdate,
    entry: finalUpdate ? finalUpdate.evaluations.at(-1) : null,
    feed: finalUpdate?.statusFeed || [],
    prompt: captured.calls.at(-1),
    stored: db.__store.battle,
    cronErrors: finalUpdate?.['cronState.cronErrors'] || null,
    shadowPayload: shadow.calls.at(-1) || null,
  };
}

const ACTIVE_BLOCK = /ACTIVE POSITIONS:\n[^\n]*\n([\s\S]*?)(?:\n\n|$)/;
/** The ACTIVE POSITIONS CSV row for one symbol, as the model sees it. */
const activeRow = (block, symbol) => (block.match(ACTIVE_BLOCK)?.[1] || '')
  .split('\n')
  .find((line) => line.split(',')[1]?.trim() === symbol) || '';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(FROZEN_NOW));
  captured.calls = [];
  guardrailState.throws = null;
  guardrailState.returns = null;
  guardrailState.calls = 0;
  shadow.calls = [];
  mocks.getStockAnalysisData.mockReset(); mocks.fetchIntradayBatch.mockReset();
  mocks.create.mockReset(); mocks.fetchRecentNews.mockReset();
  mocks.fetchRecentNews.mockImplementation(async () => []);
  executeSwapServerMock.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

// ---------------------------------------------------------------------------
describe('F1 — the incoming position is shown at the price it was actually entered', () => {
  // THE DEFECT. The rebuilt scorer reads `prices[symbol].current` (the S5 REST
  // quote) while the entry price comes from the refreshed doc's `swapPrice`,
  // which the executor takes from the LIVE BEACON when one is fresh
  // (agentSwapExecution.js:276). When the two differ, a position acquires a
  // gain or loss in the very snapshot that decides the tick, at the instant it
  // was bought. T1's own double set swapPrice from the same test quote, so it
  // could not see this.
  it('a beacon entry ABOVE the REST quote still renders +0.00%, at the execution price', async () => {
    const prices = koBustPrices();
    const EXEC = 168.42;                       // what the executor recorded
    expect(prices.AMD.current).not.toBe(EXEC); // the fixture really does diverge

    const { prompt, summary } = await runTick({ prices, execPriceOf: () => EXEC });

    expect(summary.swapped).toBe(1);
    const row = activeRow(prompt.block, 'AMD');
    expect(row, 'the replacement must be rendered').not.toBe('');
    expect(row).toContain('+0.00%');
    expect(row).toContain('$168.42');
    // And the scored row agrees with what was rendered (§9 display-agreement).
    const scored = prompt.assetScores.find((s) => s.symbol === 'AMD');
    expect(scored.priceChange ?? 0).toBeCloseTo(0, 6);
  });

  it('the EXITED symbol keeps its fetched quote — only the incoming is re-pointed', async () => {
    const prices = koBustPrices();
    const { prompt } = await runTick({ prices, execPriceOf: () => 168.42 });
    // KO left the book, so it must not be in the active rows at all…
    expect(activeRow(prompt.block, 'KO')).toBe('');
    // …and every untouched holding still renders from its fetched quote.
    const nvda = prompt.assetScores.find((s) => s.symbol === 'NVDA');
    expect(nvda).toBeTruthy();
    expect(prompt.momentumData).toBeTruthy();
  });

  it('NO REGRESSION — when the beacon and the REST quote agree, nothing moves', async () => {
    const prices = koBustPrices();
    const { prompt } = await runTick({ prices, execPriceOf: (s) => prices[s]?.current ?? 0 });
    const row = activeRow(prompt.block, 'AMD');
    expect(row).toContain('+0.00%');
  });
});

// ---------------------------------------------------------------------------
describe('F1b — a committed swap whose refresh fails stops discretionary processing', () => {
  // THE DEFECT. `forcedSwapsCommitted` increments only AFTER
  // refreshBattleFromDoc resolves, and the whole block sits in a try/catch. A
  // swap that committed and then lost its re-read therefore left the tick
  // running on a stale snapshot with NO rebuild — the exact state T1 exists to
  // prevent, reached through the error path.
  it('refresh THROWS after a committed swap → no model call, refresh_failed recorded, trade kept', async () => {
    const battle = makeTickBattle();
    const db = makeDb(battle, { failBattleGetAfter: 1 });
    const { entry, stored } = await runTick({ battle, prices: koBustPrices(), db });

    // The discretionary half of the tick never ran.
    expect(mocks.create).not.toHaveBeenCalled();
    expect(entry.decision).toBe('HOLD');
    expect(entry.haikuError.failureClass).toBe('refresh_failed');
    expect(entry.holdKind).toBe('default_failure');

    // The committed trade stands — nothing reverted it.
    expect(stored.trades.some((t) => t.symbolOut === 'KO')).toBe(true);
    expect(stored.portfolio.support.map((a) => a.symbol)).not.toContain('KO');
  });

  it('refresh returns NOTHING after a committed swap → same stop, same class', async () => {
    const battle = makeTickBattle();
    const db = makeDb(battle, { emptyBattleGetAfter: 1 });
    const { entry, stored } = await runTick({ battle, prices: koBustPrices(), db });

    expect(mocks.create).not.toHaveBeenCalled();
    expect(entry.haikuError.failureClass).toBe('refresh_failed');
    expect(stored.trades.some((t) => t.symbolOut === 'KO')).toBe(true);
  });

  it('NO REGRESSION — a healthy refresh still runs the model and rebuilds', async () => {
    const { entry } = await runTick({ prices: koBustPrices() });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(entry.haikuError).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('F2 — a guardrail fault never overwrites the model-call outcome', () => {
  // THE DEFECT. The guardrail catch replaced `haikuFailure` wholesale, so a
  // schema-invalid result followed by a throwing evaluator lost BOTH its
  // class and the `invalidField` that names what was wrong — the one fact a
  // triage read needs. The two faults are now recorded separately.
  it('invalid result THEN a throwing guardrail → both recorded, invalidField survives', async () => {
    guardrailState.throws = new TypeError("Cannot read properties of undefined (reading 'baseATR')");
    const { entry } = await runTick({
      battle: guarded(makeTickBattle()),
      respond: async () => makeToolUseResponse(makeHoldResult({ decision: 'SELL' })),
    });

    // The model-call outcome is intact…
    expect(entry.haikuError.failureClass).toBe('invalid_tool_result');
    expect(entry.haikuError.invalidField).toBe('decision');
    // …and the guardrail fault is recorded beside it, message only, no stack.
    expect(entry.guardrailFault).toBeTruthy();
    expect(entry.guardrailFault.message).toContain('baseATR');
    expect(JSON.stringify(entry.guardrailFault)).not.toMatch(/\bat\s+\w+\s+\(/);
    expect(entry.decision).toBe('HOLD');
  });

  it('a CHOSEN HOLD then a throwing guardrail → haikuError stays null, fault recorded', async () => {
    guardrailState.throws = new Error('guardrail evaluator exploded');
    const { entry, feed } = await runTick({ battle: guarded(makeTickBattle()) });

    // The model answered. Readers that treat any haikuError as "no decision"
    // must still see one — selectWhyState.js / voiceLayerGrounding.js.
    expect(entry.haikuError).toBeNull();
    expect(entry.decision).toBe('HOLD');
    expect(entry.holdKind).toBeNull();
    expect(entry.guardrailFault.message).toBe('guardrail evaluator exploded');
    // The beat says what actually happened, not "defaulted to HOLD".
    const beat = feed.find((f) => f.action === 'eval_degraded');
    expect(beat.message).toContain('guardrail check failed; decision unaffected');
  });

  it('budget skip THEN a throwing guardrail → the counter still passes budget through', async () => {
    guardrailState.throws = new Error('boom');
    const battle = guarded(makeTickBattle());
    battle.cronState = { ...battle.cronState, consecutiveEvalFailures: 4 };
    const { finalUpdate, entry } = await runTick({
      battle,
      cronStartTime: Date.now() - 280000, // past the 246s line: no budget to start the call
    });

    expect(mocks.create).not.toHaveBeenCalled();
    expect(entry.haikuError.failureClass).toBe('budget_skipped');
    // budget_skipped is a scheduling choice, not an engine fault: pass-through.
    expect(finalUpdate['cronState.consecutiveEvalFailures']).toBe(4);
  });

  it('the degraded beat names the model-call failure when there was one', async () => {
    const { feed } = await runTick({
      battle: guarded(makeTickBattle()),
      respond: async () => makeToolUseResponse(makeHoldResult({ decision: 'SELL' })),
    });
    const beat = feed.find((f) => f.action === 'eval_degraded');
    expect(beat.message).toContain('no usable decision; held by default');
  });
});

// ---------------------------------------------------------------------------
describe('F3 — holdKind describes the FINAL decision', () => {
  // THE DEFECT. The four fallback branches set holdKind eagerly, and the record
  // wrote it unconditionally — so a fallback HOLD that the deterministic
  // guardrail layer later turned into a protective SWAP was filed as a
  // "fallback HOLD" that had, in fact, traded.
  it('a fallback HOLD later forced into a SWAP records the SWAP and holdKind null', async () => {
    // WHY THE EVALUATOR IS DOUBLED FOR THIS ROW. F3's fix lives entirely in the
    // CRON — how it classifies the record once the deterministic layer has
    // spoken — so the evaluator's verdict is the input, not the thing under
    // test. It is doubled because the REAL one cannot complete this path at
    // HEAD: every forced exit it builds carries `note: undefined` when the
    // replacement is not distressed (agentGuardrails.js:546-548), which
    // Firestore rejects, and a distressed replacement is downgraded back to
    // HOLD at agent-evaluate.js:2622. That is a pre-existing defect in a §1
    // FENCED file, outside this task — filed for separate tasking in §11, not
    // fixed here. The verdict below is otherwise byte-shaped like the real
    // one, minus the undefined key.
    guardrailState.returns = {
      decision: 'SWAP',
      symbolOut: 'KO',
      symbolIn: 'AMD',
      overrides: [{
        type: 'stopLoss', symbol: 'KO', metric: 'pnlPct', threshold: -0.5,
        actual: -0.8, action: 'forced_exit', originalDecision: 'HOLD',
        replacementSymbol: 'AMD',
      }],
      statusMessage: 'Guardrail override: stop-loss at 0.5% breached on KO (-0.8%). Forcing exit → AMD.',
      sourceNote: 'guardrail_stopLoss',
    };
    const prices = makePriceTable();
    prices.KO = { ...prices.KO, current: 61.70 };
    const { entry, summary } = await runTick({
      battle: { ...makeTickBattle(), agentContext: { ...makeTickBattle().agentContext, deployedGuardrails: [TIGHT_STOP] } },
      prices,
      respond: async () => makeToolUseResponse(makeHoldResult({ decision: 'SELL' })),
    });

    // Anti-vacuity: the deterministic layer really did trade.
    expect(summary.swapped).toBe(1);

    expect(entry.decision).toBe('SWAP');
    expect(entry.holdKind).toBeNull();
    // The model-call failure is still on the record — the trade was not the
    // model's, and the record must not pretend the call succeeded.
    expect(entry.haikuError.failureClass).toBe('invalid_tool_result');
  });

  it('the three fallback HOLDs are unchanged — each still records default_failure', async () => {
    const invalid = await runTick({ respond: async () => makeToolUseResponse(makeHoldResult({ decision: 'SELL' })) });
    expect(invalid.entry.decision).toBe('HOLD');
    expect(invalid.entry.holdKind).toBe('default_failure');

    const transport = await runTick({ respond: async () => { const e = new Error('Request timed out.'); e.name = 'APIConnectionTimeoutError'; throw e; } });
    expect(transport.entry.holdKind).toBe('default_failure');

    const budget = await runTick({ cronStartTime: Date.now() - 280000 });
    expect(budget.entry.holdKind).toBe('default_failure');
  });
});

// ---------------------------------------------------------------------------
describe('F4 — seenStoryReasons never outlives the ids it annotates', () => {
  const STORY = {
    id: 'story-nvda-1', tickers: ['NVDA'],
    headline: 'NVIDIA lands a multi-year supply agreement', reporterName: 'Kai',
    sentiment: 'bullish', publishedAt: '2026-09-09T14:45:00.000Z',
  };
  const withHistory = (cronState) => {
    const base = makeTickBattle();
    return {
      ...base,
      evaluations: [{ evalId: 'eval_001', timestamp: '2026-09-09T14:30:00.000Z', decision: 'HOLD' }],
      scoreState: { ...base.scoreState, evaluationCount: 1 },
      cronState: { ...base.cronState, ...cronState },
    };
  };

  it('a reason whose id the CAP evicted is dropped on the next successful write', async () => {
    mocks.fetchRecentNews.mockImplementation(async () => [STORY]);
    // 50 ids already seen (the cap) plus a reason for the OLDEST one, which
    // this tick's write pushes out of the list.
    const seen = Array.from({ length: 50 }, (_, i) => `old-${i}`);
    const { finalUpdate } = await runTick({
      battle: withHistory({ seenStoryIds: seen, seenStoryReasons: { 'old-0': 'attempts_exhausted' } }),
    });

    const ids = finalUpdate['cronState.seenStoryIds'];
    expect(ids).not.toContain('old-0');          // evicted by the cap
    expect(ids).toContain(STORY.id);
    const reasons = finalUpdate['cronState.seenStoryReasons'];
    expect(reasons).toBeTruthy();
    expect(reasons).not.toHaveProperty('old-0'); // its annotation went with it
  });

  it('a story evaluated successfully loses its stale exhaustion reason', async () => {
    mocks.fetchRecentNews.mockImplementation(async () => [STORY]);
    const { finalUpdate } = await runTick({
      battle: withHistory({ seenStoryIds: ['unrelated'], seenStoryReasons: { [STORY.id]: 'attempts_exhausted', unrelated: 'attempts_exhausted' } }),
    });

    const reasons = finalUpdate['cronState.seenStoryReasons'];
    expect(reasons, 'a success that rewrites the seen list must rewrite the reasons').toBeTruthy();
    expect(reasons).not.toHaveProperty(STORY.id); // it WAS evaluated this tick
    expect(reasons).toHaveProperty('unrelated');  // untouched ids keep theirs
  });

  it('NO REGRESSION — a tick with no news still writes no story keys', async () => {
    const { finalUpdate } = await runTick();
    for (const key of ['cronState.seenStoryIds', 'cronState.storyAttempts', 'cronState.seenStoryReasons']) {
      expect(finalUpdate).not.toHaveProperty(key);
    }
  });
});

// ---------------------------------------------------------------------------
// N1 — "full schema" is literally wrong, and the relaxations are deliberate.
// These rows are GREEN on the pre-fix tree: they do not name a code defect,
// they demonstrate that the disclosed relaxations are real, which is what
// makes the T3 report's and the module header's "full schema" claim an
// overstatement. The fix is wording, not behaviour — so these rows are also
// the lock that keeps the corrected wording honest.
describe('N1 — the validator is schema-DRIVEN over top-level fields, not "full schema"', () => {
  it('accepts a non-integer conviction although the schema declares integer', async () => {
    const { validateTradeToolResult } = await import('../_utils/agentEvalToolResultValidation.js');
    const { makeSwapResult: swap } = await import('../_utils/__fixtures__/tickStampsHarness.js');
    expect(validateTradeToolResult(swap({ conviction: 72.5 })).valid).toBe(true);
  });

  it('does not validate NESTED rows — a malformed anticipation candidate passes', async () => {
    const { validateTradeToolResult } = await import('../_utils/agentEvalToolResultValidation.js');
    const { makeHoldResult: hold } = await import('../_utils/__fixtures__/tickStampsHarness.js');
    const r = hold({ anticipationCandidates: [{ symbol: 42, trigger: { not: 'a string' } }] });
    expect(validateTradeToolResult(r).valid).toBe(true);
  });

  it('accepts an explicit null on an OPTIONAL property (null means "not provided")', async () => {
    const { validateTradeToolResult } = await import('../_utils/agentEvalToolResultValidation.js');
    const { makeHoldResult: hold } = await import('../_utils/__fixtures__/tickStampsHarness.js');
    expect(validateTradeToolResult(hold({ pvp_context: null })).valid).toBe(true);
  });

  it('but a REQUIRED field is still enforced — the relaxations are bounded', async () => {
    const { validateTradeToolResult } = await import('../_utils/agentEvalToolResultValidation.js');
    const { makeHoldResult: hold } = await import('../_utils/__fixtures__/tickStampsHarness.js');
    const r = hold(); delete r.decision;
    expect(validateTradeToolResult(r).valid).toBe(false);
    expect(validateTradeToolResult(r).invalidField).toBe('decision');
  });
});

// ---------------------------------------------------------------------------
// PART E — Astra's delta review.
//
// E1. The Part C refresh-failure stop was INCOMPLETE. It withheld the proposal
// lifecycle, the trigger gate and the model call, but left three doors open on
// a book the tick had just failed to re-read: gameplan meeting HANDLING and
// DETECTION (each of which runs a deterministic suppression pass that TRADES,
// then early-returns so no record is written at all), and the S10 guardrail
// stage (which can force a protective exit). The fixture masked both: it
// suppresses the detector via `lastGameplanDate` and ships no deployed
// guardrail. These rows remove that masking.
const PENDING_MEETING = Object.freeze({
  status: 'pending',
  createdAt: FROZEN_NOW,
  diagnosis: 'Consumer Cyclical is dragging.',
  toSectors: ['Technology'],
  suggestedSwaps: [],
});
/** A forced-exit verdict shaped like the real one, minus the key Firestore rejects. */
const FORCED_EXIT = Object.freeze({
  decision: 'SWAP', symbolOut: 'TSLA', symbolIn: 'AMD',
  overrides: [{
    type: 'stopLoss', symbol: 'TSLA', metric: 'pnlPct', threshold: -1.5,
    actual: -2.08, action: 'forced_exit', originalDecision: 'HOLD', replacementSymbol: 'AMD',
  }],
  statusMessage: 'Guardrail override: stop-loss at 1.5% breached on TSLA (-2.08%). Forcing exit → AMD.',
  sourceNote: 'guardrail_stopLoss',
});
/** The fixture pre-suppresses the detector; a meeting-detection row must not inherit that. */
function detectorArmed(battle) {
  const cronState = { ...battle.cronState };
  delete cronState.lastGameplanDate;
  return { ...battle, cronState };
}

describe('E1 — a tick that cannot re-read the book does NOTHING that depends on it', () => {
  it('(a) refresh failure with a PENDING meeting → no suppression pass, no early return, refresh_failed written', async () => {
    // A deployed stop AND a forced-exit verdict, so the suppression pass has
    // something to trade: that is what makes "no suppression pass" observable
    // rather than merely asserted.
    guardrailState.returns = { ...FORCED_EXIT };
    const base = makeTickBattle();
    const battle = {
      ...base,
      gameplanMeeting: { ...PENDING_MEETING },
      agentContext: { ...base.agentContext, deployedGuardrails: [TIGHT_STOP] },
    };
    const db = makeDb(battle, { failBattleGetAfter: 1 });
    const { entry, stored } = await runTick({ battle, prices: koBustPrices(), db });

    // The pass never ran, so it never evaluated and never traded. Exactly one
    // executor call happened — the S7 exit that committed BEFORE the refresh
    // failed; nothing after it.
    expect(guardrailState.calls).toBe(0);
    expect(executeSwapServerMock).toHaveBeenCalledTimes(1);
    expect(stored.trades.some((t) => t.symbolOut === 'TSLA')).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
    // The early return is gone: a record exists, and it names the fault.
    expect(entry, 'the tick must still write its record').toBeTruthy();
    expect(entry.haikuError.failureClass).toBe('refresh_failed');
    expect(entry.holdKind).toBe('default_failure');
    // …and the committed trade stands.
    expect(stored.trades.some((t) => t.symbolOut === 'KO')).toBe(true);
  });

  it('(b) refresh failure with a NEWLY DETECTED meeting → same stop, record still written', async () => {
    guardrailState.returns = { ...FORCED_EXIT };
    const base = detectorArmed(makeTickBattle());
    const battle = { ...base, agentContext: { ...base.agentContext, deployedGuardrails: [TIGHT_STOP] } };
    const db = makeDb(battle, { failBattleGetAfter: 1 });
    const { entry, finalUpdate, stored } = await runTick({ battle, prices: koBustPrices(), db });

    expect(guardrailState.calls).toBe(0);
    expect(executeSwapServerMock).toHaveBeenCalledTimes(1);
    expect(stored.trades.some((t) => t.symbolOut === 'TSLA')).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(entry, 'the tick must still write its record').toBeTruthy();
    expect(entry.haikuError.failureClass).toBe('refresh_failed');
    // No meeting is created off a book we cannot read.
    expect(finalUpdate.gameplanMeeting).toBeUndefined();
    expect(stored.trades.some((t) => t.symbolOut === 'KO')).toBe(true);
  });

  it('(c) refresh failure with a BREACHED deployed stop → the guardrail stage never runs', async () => {
    guardrailState.returns = { ...FORCED_EXIT };
    const battle = {
      ...makeTickBattle(),
      agentContext: { ...makeTickBattle().agentContext, deployedGuardrails: [TIGHT_STOP] },
    };
    const db = makeDb(battle, { failBattleGetAfter: 1 });
    const { entry, stored } = await runTick({ battle, prices: koBustPrices(), db });

    // S10 is not merely harmless here — it is not reached.
    expect(guardrailState.calls).toBe(0);
    // Only the S7 trade that had already committed. No protective exit was
    // attempted off the stale book.
    expect(executeSwapServerMock).toHaveBeenCalledTimes(1);
    expect(entry.haikuError.failureClass).toBe('refresh_failed');
    expect(entry.decision).toBe('HOLD');
    expect(stored.trades.some((t) => t.symbolOut === 'KO')).toBe(true);
    expect(stored.trades.some((t) => t.symbolOut === 'TSLA')).toBe(false);
  });

  it('(d) CONTROL — a breached deployed stop with a SUCCESSFUL refresh still exits, exactly as today', async () => {
    // The verdict is supplied rather than computed for the same reason as F3:
    // the real evaluator's forced-exit override carries `note: undefined`
    // (agentGuardrails.js:546-548, §11.6) which Firestore rejects. The point of
    // this row is that the STAGE RUNS and its exit executes — unchanged by E1.
    guardrailState.returns = { ...FORCED_EXIT };
    const battle = {
      ...makeTickBattle(),
      agentContext: { ...makeTickBattle().agentContext, deployedGuardrails: [TIGHT_STOP] },
    };
    const { entry, summary, stored } = await runTick({ battle });

    expect(guardrailState.calls).toBeGreaterThan(0);
    expect(entry.decision).toBe('SWAP');
    expect(summary.swapped).toBe(1);
    expect(stored.trades.some((t) => t.symbolOut === 'TSLA' && t.symbolIn === 'AMD')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// E2. Part C gave the guardrail fault its own record field, which was right —
// but T2 had been getting the durable `cronState.cronErrors` entry and the
// shadow-log disclosure for free by writing `haikuFailure`, and the separation
// silently dropped both for guardrail faults. The fault now carries its own
// receipts, routed independently of the model-call outcome.
describe('E2 — the guardrail fault keeps its own receipts', () => {
  const guardrailErrors = (rows) => (rows || []).filter((e) => e.failureClass === 'guardrail_error');

  it('valid model result + guardrail throws → cronErrors entry, shadow carries the fault, model class still null', async () => {
    guardrailState.throws = new TypeError("Cannot read properties of undefined (reading 'baseATR')");
    const { entry, cronErrors, shadowPayload } = await runTick({ battle: guarded(makeTickBattle()) });

    const gr = guardrailErrors(cronErrors);
    expect(gr).toHaveLength(1);
    expect(gr[0].error).toContain('baseATR');
    expect(gr[0].error).toContain('guardrail');

    // The MODEL call succeeded; its own disclosure stays null.
    expect(shadowPayload.failureClass).toBeNull();
    expect(entry.haikuError).toBeNull();
    // …and the shadow stream carries the guardrail fault beside it.
    expect(shadowPayload.guardrailFault).toBeTruthy();
    expect(shadowPayload.guardrailFault.message).toContain('baseATR');
  });

  it('invalid result + guardrail throws → BOTH receipts, distinguishable by kind', async () => {
    guardrailState.throws = new Error('guardrail evaluator exploded');
    const { cronErrors, shadowPayload, entry } = await runTick({
      battle: guarded(makeTickBattle()),
      respond: async () => makeToolUseResponse(makeHoldResult({ decision: 'SELL' })),
    });

    expect(cronErrors).toHaveLength(2);
    expect(guardrailErrors(cronErrors)).toHaveLength(1);
    expect(cronErrors.filter((e) => e.failureClass === 'invalid_tool_result')).toHaveLength(1);
    // Neither fault has overwritten the other, on the record or in the stream.
    expect(entry.haikuError.invalidField).toBe('decision');
    expect(shadowPayload.failureClass).toBe('invalid_tool_result');
    expect(shadowPayload.guardrailFault.message).toBe('guardrail evaluator exploded');
  });

  it('a CHOSEN HOLD + guardrail throws → receipt present, haikuError still null', async () => {
    guardrailState.throws = new Error('guardrail evaluator exploded');
    const { entry, cronErrors, shadowPayload } = await runTick({ battle: guarded(makeTickBattle()) });

    expect(entry.haikuError).toBeNull();
    expect(guardrailErrors(cronErrors)).toHaveLength(1);
    expect(shadowPayload.guardrailFault).toBeTruthy();
  });

  it('NO REGRESSION — a clean tick writes no cronErrors entry and no guardrailFault', async () => {
    const { cronErrors, shadowPayload, entry } = await runTick({ battle: guarded(makeTickBattle()) });
    expect(cronErrors).toBeNull();
    expect(shadowPayload.guardrailFault ?? null).toBeNull();
    expect(entry.guardrailFault).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PART F — Astra's third read.
//
// F-1. E1's rule is that a tick which cannot re-read the book does nothing
// that depends on it. Three doors were closed in Part E, but the NEWS CATALYST
// block was still unconditional: it fetches stories, prices the new names,
// mutates the in-memory bench, and enqueues a player-facing "added to
// watchlist" beat — and that beat reaches the common feed write, so a tick
// that evaluated nothing still tells the player it changed their watchlist.
const CATALYST = 'META';
/** The fixture's rankings plus one symbol that is neither held nor benched. */
function rankingsWithCatalyst() {
  const doc = makeRankingsDoc();
  return {
    ...doc,
    stocks: [...doc.stocks, {
      symbol: CATALYST, name: 'Meta Platforms', sectorName: 'Technology',
      baseATR: 3.1, atrPercentile: 0.4, baggerBombFit: 0.1,
      bBandwidthPercentile: 90, nr7Flag: false, dailyRange: 5.0,
    }],
  };
}
const CATALYST_STORY = Object.freeze({
  id: 'story-meta-catalyst-1', tickers: [CATALYST],
  headline: 'Meta announces a new datacenter build-out', reporterName: 'Kai',
  sentiment: 'bullish', publishedAt: '2026-09-09T14:45:00.000Z',
});

describe('F-1 — the news catalyst block is withheld on an unreadable book', () => {
  it('refresh failure + catalyst news → no price fetch, no bench mutation, no watchlist beat', async () => {
    mocks.fetchRecentNews.mockImplementation(async () => [CATALYST_STORY]);
    const battle = makeTickBattle();
    const db = makeDb(battle, { failBattleGetAfter: 1, rankingsDoc: rankingsWithCatalyst() });
    const { entry, feed, finalUpdate, stored } = await runTick({ battle, prices: koBustPrices(), db });

    // Nothing was priced for a name we only learned about from a story we
    // should not have fetched.
    const priced = mocks.getStockAnalysisData.mock.calls.map((c) => c[0]);
    expect(priced).not.toContain(CATALYST);
    // The in-memory bench was not mutated…
    expect(battle.portfolio.bench.stocks.map((a) => a.symbol)).not.toContain(CATALYST);
    // …and the player was not told their watchlist changed.
    expect(feed.some((f) => f.action === 'catalyst_override')).toBe(false);
    expect(JSON.stringify(feed)).not.toContain(CATALYST);

    // No story bookkeeping of any kind on a tick that evaluated nothing.
    expect(finalUpdate['cronState.seenStoryIds']).toBeUndefined();
    expect(finalUpdate['cronState.storyAttempts']).toBeUndefined();

    // The disclosure is unchanged, and the committed trade stands.
    expect(entry.haikuError.failureClass).toBe('refresh_failed');
    expect(stored.trades.some((t) => t.symbolOut === 'KO')).toBe(true);
  });

  it('CONTROL — the same catalyst news on a healthy tick behaves exactly as today', async () => {
    mocks.fetchRecentNews.mockImplementation(async () => [CATALYST_STORY]);
    const battle = makeTickBattle();
    const db = makeDb(battle, { rankingsDoc: rankingsWithCatalyst() });
    const { entry, feed } = await runTick({ battle, db });

    // Anti-vacuity: the catalyst path really is reachable in this fixture.
    const beat = feed.find((f) => f.action === 'catalyst_override');
    expect(beat, 'the control must actually exercise the catalyst path').toBeTruthy();
    expect(beat.message).toContain(CATALYST);
    expect(battle.portfolio.bench.stocks.map((a) => a.symbol)).toContain(CATALYST);
    expect(mocks.getStockAnalysisData.mock.calls.map((c) => c[0])).toContain(CATALYST);
    expect(entry.haikuError).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// F-2. `forcedSwapsCommitted > 0` runs the snapshot rebuild even when a LATER
// swap's re-read failed — so the rebuild is derived from an INTERMEDIATE book:
// newer than the pre-loop snapshot, older than the committed truth.
//
// STATED HONESTLY: this is the rule holding, not a live defect. Every consumer
// of the rebuilt snapshot is already skipped on a refresh-failure tick (the
// enumeration is in §13 of the integration report), so today nothing reads the
// intermediate values. The gate keeps it that way — and matters because two of
// the would-be readers are flag-off code whose flips are filed in §13.
//
// The rebuild's only observable on such a tick is therefore its own log line,
// which is what this row watches.
function bustingBoth() {
  const prices = makePriceTable();
  prices.KO = { ...prices.KO, current: 61.578 };
  prices.PG = { ...prices.PG, current: 163.647 };
  return prices;
}

describe('F-2 — the rebuild runs only when EVERY committed swap was re-read', () => {
  it('first re-read succeeds, second fails → no rebuild, both trades intact, refresh_failed written', async () => {
    const logs = [];
    console.log.mockImplementation((...a) => { logs.push(a.join(' ')); });

    const battle = makeTickBattle();
    // get #1 is the tick's own read; #2 is the first swap's re-read (succeeds);
    // #3 is the second swap's re-read (fails).
    const db = makeDb(battle, { failBattleGetAfter: 2 });
    const { entry, stored } = await runTick({ battle, prices: bustingBoth(), db });

    // Anti-vacuity: TWO swaps really did commit before the failure.
    expect(executeSwapServerMock).toHaveBeenCalledTimes(2);
    expect(stored.trades.some((t) => t.symbolOut === 'KO')).toBe(true);
    expect(stored.trades.some((t) => t.symbolOut === 'PG')).toBe(true);
    expect(stored.scoreState.tradeCount).toBe(2);

    // The rebuild did not run against the intermediate book.
    expect(logs.some((l) => l.includes('Rebuilt decision snapshot'))).toBe(false);

    // And the tick still discloses.
    expect(entry.haikuError.failureClass).toBe('refresh_failed');
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('CONTROL — two exits with BOTH re-reads succeeding still rebuilds', async () => {
    const logs = [];
    console.log.mockImplementation((...a) => { logs.push(a.join(' ')); });

    const { summary } = await runTick({ prices: bustingBoth() });

    expect(summary.swapped).toBe(2);
    const line = logs.find((l) => l.includes('Rebuilt decision snapshot'));
    expect(line, 'the rebuild must still run on a healthy tick').toBeTruthy();
    expect(line).toContain('after 2 forced exit(s)');
  });
});
