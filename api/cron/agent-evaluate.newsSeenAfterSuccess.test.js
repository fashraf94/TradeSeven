// api/cron/agent-evaluate.newsSeenAfterSuccess.test.js
//
// T4 — a FantasyTimes story is marked seen only after the call it woke
// actually succeeded (adjudication V1.1 P-6).
//
// THE DEFECT. The seen-story-id write sat at the trigger gate, BEFORE the
// model was called (agent-evaluate.js, pre-fix `:1961-1966`). A story that
// woke the engine and then hit a timeout was burned unread: the tick never
// evaluated it, and because its id was already on `cronState.seenStoryIds`,
// no later tick ever would. The catalyst the agent was woken for was silently
// dropped.
//
// SUCCESS IS NARROWER THAN HTTP 200. It is a tool result the handler
// ACCEPTED — `haikuResult` set with no failure recorded. A response that
// arrived and was unusable leaves `haikuFailure` set and does not count.
//
// THE LOOP GUARD. Not marking on failure is correct but, alone, is a loop: a
// story that reliably fails would re-wake the engine every tick. Attempts are
// counted per story id; at MAX_STORY_WAKE_ATTEMPTS the story is marked seen
// with `seenReason: 'attempts_exhausted'` — retired unread, and the record
// says so.
//
// The seam is the real `processAgentBattle` on the shared tick harness. Only
// `fetchRecentNews` is doubled (so a story is in hand deterministically); the
// trigger gate that turns it into a wake is the production one.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FROZEN_NOW,
  makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs, makeIntradayCandles,
  makeHoldResult, makeSwapResult, makeToolUseResponse, makeTickDb,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { evaluateTriggers, MAX_STORY_WAKE_ATTEMPTS, SEEN_STORY_ID_CAP } from '../_utils/agentTriggerGate.js';

const mocks = vi.hoisted(() => ({
  getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn(), fetchRecentNews: vi.fn(async () => []),
}));
// R-A row only: what the doubled guardrail evaluator does this row — an Error
// to throw, or null to run the real one. Every other row leaves it null, so
// they exercise production `applyGuardrails` exactly as before.
const { guardrailState } = vi.hoisted(() => ({ guardrailState: { throws: null } }));
vi.mock('@anthropic-ai/sdk', () => ({ default: class AnthropicMock { constructor() { this.messages = { create: (...args) => mocks.create(...args) }; } } }));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.getStockAnalysisData, fetchIntradayBatch: mocks.fetchIntradayBatch,
  fetchIntradayCandles: vi.fn(async () => []), filterToLatestSession: vi.fn((candles) => ({ candles: candles || [], sessionDate: '2026-09-09' })),
}));
// Only the news FETCH is doubled. `evaluateTriggers` — the thing that decides
// a story is a wake and hands back its id — stays real, so these rows exercise
// the production gate rather than a restatement of it.
vi.mock('../_utils/agentTriggerGate.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchRecentNews: (...args) => mocks.fetchRecentNews(...args),
}));
// The fenced `agentGuardrails.js` is DOUBLED here — doubled in tests only,
// never edited — because "the evaluator throws" is the premise of the R-A row.
// The double delegates to the real module whenever `throws` is null.
vi.mock('../_utils/agentGuardrails.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    applyGuardrails: (...args) => {
      if (guardrailState.throws) throw guardrailState.throws;
      return real.applyGuardrails(...args);
    },
  };
});
vi.mock('../_utils/tournamentAgentLedger.js', () => ({ resolveTournamentContext: vi.fn(async () => null), excludeHeldByOthers: vi.fn(), excludeHeldSymbols: vi.fn(), reserveSymbol: vi.fn(), confirmSwap: vi.fn(), releaseReservation: vi.fn() }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));
vi.mock('../_utils/voiceLayerAnticipation.js', async (importOriginal) => ({ ...(await importOriginal()), generateAnticipation: vi.fn(async () => null) }));
vi.mock('../_utils/voiceLayerTradeNarration.js', async (importOriginal) => ({ ...(await importOriginal()), generateTradeNarration: vi.fn(async () => null) }));
vi.mock('../_utils/shadowLogger.js', async (importOriginal) => ({ ...(await importOriginal()), logEvaluation: vi.fn(async () => false), logVisionTransition: vi.fn(async () => false), logAnticipation: vi.fn(async () => false) }));

const { processAgentBattle } = await import('./agent-evaluate.js');

const STORY_ID = 'story-nvda-catalyst-1';
const STORY = {
  id: STORY_ID,
  tickers: ['NVDA'],
  headline: 'NVIDIA lands a multi-year supply agreement',
  reporterName: 'Kai',
  sentiment: 'bullish',
  publishedAt: '2026-09-09T14:45:00.000Z', // 15 minutes before FROZEN_NOW
};

/**
 * A battle already past its first evaluation — so the gate reaches the
 * CONDITIONAL triggers where news lives, rather than short-circuiting on
 * `forced_open` (which returns no story ids at all).
 */
function battleWithHistory(cronState = {}) {
  const base = makeTickBattle();
  return {
    ...base,
    evaluations: [{ evalId: 'eval_001', timestamp: '2026-09-09T14:30:00.000Z', decision: 'HOLD' }],
    scoreState: { ...base.scoreState, evaluationCount: 1 },
    cronState: { ...base.cronState, ...cronState },
  };
}

/**
 * R-A row only: the same battle with a guardrail DEPLOYED, so the evaluator is
 * reached at all — `applyGuardrails` is skipped entirely on an empty array.
 */
const STOP_LOSS = { type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' };
function guardedBattleWithHistory(cronState = {}) {
  const base = battleWithHistory(cronState);
  return { ...base, agentContext: { ...base.agentContext, deployedGuardrails: [STOP_LOSS] } };
}

/** One real tick. `respond` is what the doubled model does. */
async function runTick(battle, respond) {
  const prices = makePriceTable();
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.fetchRecentNews.mockImplementation(async () => [STORY]);
  mocks.create.mockImplementation(respond);
  const db = makeTickDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
  const finalUpdate = db.__updates.find((u) => Array.isArray(u.evaluations)) || null;
  return {
    db, summary, finalUpdate,
    entry: finalUpdate ? finalUpdate.evaluations.at(-1) : null,
    seenIds: finalUpdate?.['cronState.seenStoryIds'],
    attempts: finalUpdate?.['cronState.storyAttempts'],
    reasons: finalUpdate?.['cronState.seenStoryReasons'],
  };
}

const timeout = async () => { const e = new Error('Request timed out.'); e.name = 'APIConnectionTimeoutError'; throw e; };
const succeed = async () => makeToolUseResponse(makeHoldResult());

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(FROZEN_NOW));
  guardrailState.throws = null;
  mocks.getStockAnalysisData.mockReset(); mocks.fetchIntradayBatch.mockReset();
  mocks.create.mockReset(); mocks.fetchRecentNews.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('T4 — the story is marked seen only after a successful call', () => {
  it('a FAILED call leaves the story unseen, and it re-triggers on the next tick', async () => {
    const first = await runTick(battleWithHistory(), timeout);

    // The story woke the engine…
    expect(first.entry.triggers).toContain('news_catalyst');
    // …the call failed…
    expect(first.entry.haikuError.failureClass).toBeTruthy();
    // …and the id was NOT burned.
    expect(first.seenIds).toBeUndefined();
    expect(first.attempts).toEqual({ [STORY_ID]: 1 });

    // The next tick, carrying that state forward, wakes on the SAME story.
    const second = await runTick(battleWithHistory(first.attempts ? { storyAttempts: first.attempts } : {}), timeout);
    expect(second.entry.triggers).toContain('news_catalyst');
    expect(second.attempts).toEqual({ [STORY_ID]: 2 });
    expect(second.seenIds).toBeUndefined();
  });

  // The failure class the row above cannot reach. T4 was cut from `main`,
  // where a response was accepted on "input exists and `decision` is a
  // string" — `invalid_tool_result` did not exist yet, so the transport
  // timeout above was the only failure shape available to it. The tool-result
  // validation fix in this same composition added a failure that arrives as a
  // perfectly healthy HTTP 200, which is precisely the case the "success is
  // narrower than 200" contract exists for. Asserted rather than assumed.
  it('a SCHEMA-INVALID tool result leaves the story unseen and opens an attempt', async () => {
    const { entry, seenIds, attempts, reasons } = await runTick(
      battleWithHistory(),
      // A decision outside the tool schema's enum. The transport succeeded —
      // a tool_use block arrived — and validation rejected it.
      async () => makeToolUseResponse(makeHoldResult({ decision: 'SELL' })),
    );

    // The story woke the engine and the model was called exactly once: the
    // handler never retries a malformed result.
    expect(entry.triggers).toContain('news_catalyst');
    expect(mocks.create).toHaveBeenCalledTimes(1);

    // It failed on the SCHEMA, not on transport — `invalidField` is what
    // separates this row from the timeout row above and keeps it honest.
    expect(entry.decision).toBe('HOLD');
    expect(entry.haikuError.failureClass).toBe('invalid_tool_result');
    expect(entry.haikuError.invalidField).toBe('decision');
    expect(entry.holdKind).toBe('default_failure');

    // The story is NOT burned, and one attempt is opened against it.
    expect(seenIds).toBeUndefined();
    expect(attempts).toEqual({ [STORY_ID]: 1 });
    expect(reasons).toBeUndefined();
  });

  it('a SUCCESSFUL call marks the story seen', async () => {
    const { entry, seenIds, attempts, reasons } = await runTick(battleWithHistory(), succeed);

    expect(entry.triggers).toContain('news_catalyst');
    expect(entry.haikuError).toBeNull();
    expect(seenIds).toEqual([STORY_ID]);
    // First try succeeded, so no counter was ever opened and none is written.
    expect(attempts).toBeUndefined();
    expect(reasons).toBeUndefined();
  });

  it('a success AFTER earlier failures marks it seen and retires its counter', async () => {
    const { seenIds, attempts } = await runTick(
      battleWithHistory({ storyAttempts: { [STORY_ID]: 2, 'story-other': 1 } }),
      succeed,
    );

    expect(seenIds).toEqual([STORY_ID]);
    // The succeeded story's counter is dropped; an unrelated story's survives.
    expect(attempts).toEqual({ 'story-other': 1 });
  });

  it(`the ${MAX_STORY_WAKE_ATTEMPTS}rd failure retires it seen with seenReason 'attempts_exhausted'`, async () => {
    const { seenIds, attempts, reasons } = await runTick(
      // Two failures already on the record; this tick is the third.
      battleWithHistory({ storyAttempts: { [STORY_ID]: MAX_STORY_WAKE_ATTEMPTS - 1 } }),
      timeout,
    );

    expect(seenIds).toEqual([STORY_ID]);
    expect(reasons).toEqual({ [STORY_ID]: 'attempts_exhausted' });
    // Retired means retired: it stops being counted.
    expect(attempts).toEqual({});
  });

  it('the guard fires at the constant, not at a hardcoded 3', () => {
    // If the founder retunes the export, the row above moves with it — the
    // constant is the single source, as the prompt requires.
    expect(MAX_STORY_WAKE_ATTEMPTS).toBeGreaterThanOrEqual(1);
    expect(SEEN_STORY_ID_CAP).toBe(50);
  });
});

describe('T4 — the invariant the moved write depends on, and the normal path', () => {
  it('story ids are only ever returned alongside a trigger, so no early return can skip the write', () => {
    // The write moved from before the model call to after it, past the
    // `!shouldEvaluate` early return. That is only safe because the gate never
    // hands back a story id without also raising a trigger. Asserted against
    // the real gate rather than assumed.
    const battle = battleWithHistory();
    const assetScores = [{ symbol: 'NVDA', totalPoints: 0, history: {} }];
    const out = evaluateTriggers(battle, assetScores, makePriceTable(), [STORY], null, []);

    expect(out.newStoryIds).toEqual([STORY_ID]);
    expect(out.shouldEvaluate).toBe(true);
    // And the converse: a story already seen yields neither.
    const seen = evaluateTriggers(battle, assetScores, makePriceTable(), [STORY], null, [STORY_ID]);
    expect(seen.newStoryIds).toEqual([]);
    expect(seen.triggers.some(t => t.type === 'news_catalyst')).toBe(false);
  });

  it('NO REGRESSION — a tick with no news writes no story keys at all', async () => {
    mocks.fetchRecentNews.mockImplementation(async () => []);
    const prices = makePriceTable();
    mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
    mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
    mocks.create.mockImplementation(succeed);
    const battle = makeTickBattle();
    const db = makeTickDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
    const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
    await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });

    const finalUpdate = db.__updates.find((u) => Array.isArray(u.evaluations));
    for (const key of ['cronState.seenStoryIds', 'cronState.storyAttempts', 'cronState.seenStoryReasons']) {
      expect(finalUpdate, `a newsless tick must not write "${key}"`).not.toHaveProperty(key);
    }
    expect(finalUpdate.evaluations.at(-1).decision).toBe('HOLD');
  });
});

describe('R-A (integration) — success is the handler accepting a tool result, not the absence of a later fault', () => {
  // THE COMPOSED SEAM. T4 wrote the predicate `Boolean(haikuResult) &&
  // !haikuFailure` against a `main` whose parse check was only "input exists
  // and `decision` is a string" — a response could be accepted and still be
  // junk. The tool-result validation fix (T3) closed that at the source, so
  // `haikuResult` is only ever assigned from a FULLY validated result and the
  // extra clause became redundant. R-A drops it.
  //
  // The clause is dropped rather than kept as belt-and-braces because the
  // guardrail fail-closed fix (T2) landing in the same composition ALSO writes
  // `haikuFailure` — far below this block, for a fault that has nothing to do
  // with the model call. This row pins the outcome that coupling would have
  // threatened: the call the story woke SUCCEEDED and WAS evaluated, so the
  // story is seen and no attempt is counted, even though the tick then failed
  // closed on a guardrail fault.
  //
  // HONESTY NOTE (BUILD_RULES §2). This row is a LOCK, not a defect guard. At
  // HEAD the bookkeeping block runs strictly BEFORE the guardrail catch, so it
  // is green under the pre-R-A predicate too — stated rather than dressed up
  // as a mutation-proven guard. What it guards is the pairing: move either
  // block past the other with the old predicate and it goes red.
  it('a valid tool result then a THROWING guardrail → story seen, no attempt opened, guardrail_error HOLD', async () => {
    guardrailState.throws = new TypeError("Cannot read properties of undefined (reading 'baseATR')");

    const { entry, seenIds, attempts, reasons } = await runTick(
      guardedBattleWithHistory(),
      async () => makeToolUseResponse(makeSwapResult()),
    );

    // The story woke the engine, and the model call itself succeeded — one
    // call, a schema-valid SWAP proposal came back (anti-vacuity: without
    // this, a row that never reached the model would assert nothing).
    expect(entry.triggers).toContain('news_catalyst');
    expect(mocks.create).toHaveBeenCalledTimes(1);

    // The tick then failed closed on the guardrail fault: the proposal is held.
    expect(entry.decision).toBe('HOLD');
    expect(entry.haikuError.failureClass).toBe('guardrail_error');
    expect(entry.holdKind).toBe('default_failure');

    // …and the story is SEEN anyway. The call it woke was made, accepted and
    // evaluated; burning an attempt here would re-wake the engine on a story
    // that had already had its evaluation.
    expect(seenIds).toEqual([STORY_ID]);
    expect(attempts).toBeUndefined();
    expect(reasons).toBeUndefined();
  });
});
