// api/cron/agent-evaluate.timing.test.js
//
// Transport hygiene (Sep 12, 2026) — WHEN the decider's call starts, HOW LONG
// it gets, and what the record says about it. Three end-to-end rows against the
// REAL processAgentBattle, the same harness the tickStamps suites use, with
// `setTimeout` faked so a 21.5-second build and a 20-second call cost the suite
// nothing. The seam is the cron itself, never a re-implementation of its
// ordering: the builders and the model are doubled, the sequence between them
// is production code.
//
//   §4.1 THE TIMER PLACEMENT. The AbortController backstop is armed AFTER the
//        prompt is built, not before it. Under the June 11 placement a 21.5 s
//        build left the call 0.5 s of the 22 s ceiling and the backstop fired
//        INSIDE the call — before the SDK's own 20 s timeout could. The row
//        drives exactly that scenario and asserts on the signal the cron hands
//        `messages.create`: not aborted at call time, and never aborted during
//        a 5 s call.
//
//        The build ceiling (§2.2) is raised for this row alone, through the
//        transport module's live binding: with the production 10 s ceiling a
//        21.5 s build would end as `build_timeout` and never reach the call, so
//        the ceiling would decide the row instead of the placement under test.
//        §4.2 below runs the ceiling at its production value.
//
//   §4.2 THE BUILD CEILING. Moving the backstop leaves the build unbounded, and
//        a hung Firestore read inside fetchInstitutionalContext would hold the
//        serial battle loop until Vercel kills the function at 300 s. A build
//        that NEVER resolves must end the tick honestly at the ceiling — as
//        `build_timeout`, with no call made, nothing stamped, the entry written
//        and the loop free to take the next battle.
//
//   §4.7 THE SHADOW RECORD. The join keys (evalId, timestamp) and the two
//        timings ride the fire-and-forget logEvaluation payload.
//
// Fake timers here fake Date AND setTimeout: the cron arms both of its timers
// (the build race, the call backstop) with setTimeout, and the row is about
// when they fire relative to each other. `advanceTimersByTimeAsync` flushes
// microtasks between firings, so timers armed mid-tick still fire in window.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FROZEN_NOW,
  BASE_ENTRY_KEYS,
  makeTickBattle,
  makePriceTable,
  makeRankingsDoc,
  makeTechDocs,
  makeIntradayCandles,
  makeHoldResult,
  makeToolUseResponse,
  makeTickDb,
} from '../_utils/__fixtures__/tickStampsHarness.js';

const mocks = vi.hoisted(() => ({
  getStockAnalysisData: vi.fn(),
  fetchIntradayBatch: vi.fn(),
  create: vi.fn(),
  logEvaluation: vi.fn(async () => false),
  // Milliseconds the doubled buildLiveContextBlock takes; null = never resolves.
  buildDelayMs: 0,
  // An error the doubled builder throws instead of returning (null = none).
  liveBlockError: null,
  // The prompt-build ceiling the cron sees. Defaults to the production value;
  // §4.1 raises it so the placement, not the ceiling, decides that row.
  buildCeilingMs: null,
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock {
    constructor() { this.messages = { create: (...args) => mocks.create(...args) }; }
  },
}));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.getStockAnalysisData,
  fetchIntradayBatch: mocks.fetchIntradayBatch,
  fetchIntradayCandles: vi.fn(async () => []),
  filterToLatestSession: vi.fn((candles) => ({ candles: candles || [], sessionDate: '2026-09-09' })),
}));
vi.mock('../_utils/tournamentAgentLedger.js', () => ({
  resolveTournamentContext: vi.fn(async () => null),
  excludeHeldByOthers: vi.fn(),
  excludeHeldSymbols: vi.fn(),
  reserveSymbol: vi.fn(),
  confirmSwap: vi.fn(),
  releaseReservation: vi.fn(),
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));
vi.mock('../_utils/voiceLayerAnticipation.js', async (importOriginal) => ({ ...(await importOriginal()), generateAnticipation: vi.fn(async () => null) }));
vi.mock('../_utils/voiceLayerTradeNarration.js', async (importOriginal) => ({ ...(await importOriginal()), generateTradeNarration: vi.fn(async () => null) }));
vi.mock('../_utils/shadowLogger.js', async (importOriginal) => ({
  ...(await importOriginal()),
  logEvaluation: (...args) => mocks.logEvaluation(...args),
  logVisionTransition: vi.fn(async () => false),
  logAnticipation: vi.fn(async () => false),
}));
// The stamps ON, so "no evidence on a build_timeout entry" is a real exclusion
// rather than a flag that was off anyway.
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({ ...(await importOriginal()), TICK_STAMPS_ENABLED: true }));

// THE PROMPT BUILDER, doubled (fenced module — doubled in tests only, never
// edited). The three builders are real everywhere else in the tick; this one
// takes a controllable amount of FAKE time, which is the whole experiment.
vi.mock('../_utils/agentEvalPromptAssembly.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    buildLiveContextBlock: async (...args) => {
      if (mocks.buildDelayMs === null) return new Promise(() => {}); // never resolves
      if (mocks.buildDelayMs > 0) await new Promise((r) => setTimeout(r, mocks.buildDelayMs));
      if (mocks.liveBlockError) throw mocks.liveBlockError;
      return real.buildLiveContextBlock(...args);
    },
  };
});

// The transport module's constants, with the build ceiling made drivable. A
// getter, so the cron's live import binding reads the CURRENT value at call
// time; every other export (including classifyHaikuFailure and the two ceilings
// this row is about) stays the real one.
vi.mock('../_utils/agentEvalTransport.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    get PROMPT_BUILD_CEILING_MS() { return mocks.buildCeilingMs ?? real.PROMPT_BUILD_CEILING_MS; },
  };
});

const { processAgentBattle } = await import('./agent-evaluate.js');
// The MODULE NAMESPACE, deliberately not destructured: the ceiling is a getter
// (below), so a destructured const would freeze the real value at module init
// and an anti-vacuity guard written against it could never observe an override
// — which is exactly what review lens C found (C3). Read through the namespace
// and the guard sees what the CRON sees.
const TRANSPORT = await import('../_utils/agentEvalTransport.js');
const { HAIKU_CALL_CEILING_MS } = TRANSPORT;

const REAL_BUILD_CEILING_MS = 10_000;
const REAL_CALL_CEILING_MS = 22_000;

/** What the doubled model saw and did — the evidence both timing rows turn on. */
let calls;

/**
 * A `messages.create` double that behaves like the SDK: it records whether the
 * signal it was handed was ALREADY aborted, takes `callMs` of fake time, and
 * rejects the moment that signal aborts (the SDK's APIUserAbortError shape).
 */
function modelTaking(callMs) {
  return (_body, opts) => {
    const startedAt = Date.now();
    const record = { startedAt, abortedAtCallTime: opts.signal.aborted, abortedAfterMs: null };
    calls.push(record);
    return new Promise((resolve, reject) => {
      const done = setTimeout(() => resolve(makeToolUseResponse(makeHoldResult())), callMs);
      opts.signal.addEventListener('abort', () => {
        clearTimeout(done);
        record.abortedAfterMs = Date.now() - startedAt;
        const err = new Error('Request was aborted.');
        err.name = 'AbortError';
        reject(err);
      });
    });
  };
}

/**
 * One real tick, driven forward on the fake clock. `processAgentBattle` is
 * started, the clock is walked past every timer the tick can arm, and the
 * recorded write is returned. `advanceMs` must exceed the whole tick's timer
 * budget or the promise would never settle.
 */
async function runTick({ battle = makeTickBattle(), advanceMs = 400_000 } = {}) {
  const prices = makePriceTable();
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  const db = makeTickDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };

  // No `settled` flag: a handler attached here would always have run by the
  // time it could be asserted, so it proves nothing (review lens C, C5). The
  // real guard against a tick that never ends is vitest's own testTimeout —
  // which is exactly how this file fails against the pre-change cron.
  const running = processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
  await vi.advanceTimersByTimeAsync(advanceMs);
  await running;

  const finalUpdate = db.__updates.find((u) => Array.isArray(u.evaluations)) || null;
  return {
    db, summary, finalUpdate,
    entry: finalUpdate ? finalUpdate.evaluations[finalUpdate.evaluations.length - 1] : null,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  calls = [];
  mocks.getStockAnalysisData.mockReset();
  mocks.fetchIntradayBatch.mockReset();
  mocks.create.mockReset();
  mocks.logEvaluation.mockClear();
  mocks.buildDelayMs = 0;
  mocks.buildCeilingMs = null;
  mocks.liveBlockError = null;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('§4.1 — the abort backstop is armed AFTER the prompt is built', () => {
  // The defect, stated as arithmetic: armed before the build, the backstop
  // fires BUILD + CALL_REMAINDER after t0, so the call's effective ceiling is
  // 22s − build. At a 21.5s build that is 500 ms.
  const BUILD_MS = 21_500;
  const CALL_MS = 5_000;

  beforeEach(() => {
    // Above the 21.5s build: this row is about the placement, not the ceiling.
    mocks.buildCeilingMs = 60_000;
    mocks.buildDelayMs = BUILD_MS;
    mocks.create.mockImplementation(modelTaking(CALL_MS));
  });

  it('the signal handed to messages.create is not aborted at call time, and is never aborted during a 5s call — the call gets its whole ceiling', async () => {
    const { entry } = await runTick();

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
    // THE ROW. Under the June 11 placement this signal was armed 21.5s before
    // the call and had 500 ms left on it; the abort fired 500 ms in and the
    // tick recorded `timeout` with no decision.
    expect(calls[0].abortedAtCallTime, 'the signal must be fresh at call time').toBe(false);
    expect(calls[0].abortedAfterMs, 'the backstop must not fire during a 5s call').toBeNull();

    // …and the call therefore completed: a real decision, no failure receipt.
    expect(entry.decision).toBe('HOLD');
    expect(entry.haikuError).toBeNull();
  });

  it('the backstop and the SDK timeout now measure the same interval from the same instant — the call is offered its full ceiling, not the ceiling minus the build', async () => {
    const { entry } = await runTick();
    // The build ran first and cost what it cost …
    expect(entry.buildMs).toBe(BUILD_MS);
    expect(entry.promptBuiltAt).toBe(new Date(Date.parse(FROZEN_NOW) + BUILD_MS).toISOString());
    // … and the call started after it, with the whole ceiling ahead of it.
    expect(entry.callMs).toBe(CALL_MS);
    expect(calls[0].startedAt - Date.parse(FROZEN_NOW)).toBe(BUILD_MS);
    // The arithmetic the defect failed: the call's headroom is the ceiling
    // itself, not HAIKU_CALL_CEILING_MS − buildMs (which here is 500 ms).
    expect(HAIKU_CALL_CEILING_MS - entry.buildMs).toBeLessThan(entry.callMs); // the old headroom would NOT have covered this call
    expect(entry.callMs).toBeLessThan(HAIKU_CALL_CEILING_MS);                 // the new headroom does
  });

  it('a call that outlives the ceiling is still aborted — the backstop is a backstop, not removed', async () => {
    mocks.create.mockImplementation(modelTaking(REAL_CALL_CEILING_MS + 3_000));
    const { entry } = await runTick();
    expect(calls[0].abortedAtCallTime).toBe(false);
    expect(calls[0].abortedAfterMs).toBe(REAL_CALL_CEILING_MS);
    expect(entry.haikuError.failureClass).toBe('timeout');
    expect(entry.haikuError.timeoutKind).toBe('backstop');
    expect(entry.callMs).toBe(REAL_CALL_CEILING_MS);
    // Review lens A, finding A4: the `if (buildMs === null)` guard in the catch
    // is the only thing stopping buildMs from absorbing the CALL's wall time on
    // a call-phase failure — i.e. from answering "build or call?" wrongly in
    // exactly the case the field exists for. Without it this reads 43 500.
    expect(entry.buildMs).toBe(BUILD_MS);
  });

  it("the SDK's own timeout is recorded as 'sdk', end to end — the common production path, not just the backstop", async () => {
    // Review lens C, finding C6: the SDK is doubled, so `timeout: 20_000` is
    // inert in every test and only the cron's 22s backstop can fire. In
    // production the SDK's own timeout fires FIRST, so this row drives the
    // shape the SDK throws (0.71.2: constructor APIConnectionTimeoutError,
    // `.name` left at 'Error', message 'Request timed out.') through the real
    // processAgentBattle and asserts what the record says about it.
    mocks.create.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 20_000));
      const err = new Error('Request timed out.');
      Object.defineProperty(err.constructor, 'name', { value: 'APIConnectionTimeoutError', configurable: true });
      throw err;
    });
    const { entry } = await runTick();
    expect(entry.haikuError.failureClass).toBe('timeout');
    expect(entry.haikuError.timeoutKind).toBe('sdk');
    expect(entry.callMs).toBe(20_000);      // the call DID run — the kind is earned
    expect(entry.buildMs).toBe(BUILD_MS);
    expect(entry.promptBuiltAt).not.toBeNull();
  });

  it('a truncated response records honest timings and the same receipt shape — the third haikuError producer', async () => {
    // Review lens C, finding C2 / M17: truncated_response is the other receipt
    // built from a LITERAL rather than from the catch, and no cron-level row
    // drove it, so its `timeoutKind: null` could vanish silently. A response
    // DID arrive here, so callMs is real and the class is not a timeout.
    mocks.create.mockImplementation(async (_body, opts) => {
      calls.push({ startedAt: Date.now(), abortedAtCallTime: opts.signal.aborted, abortedAfterMs: null });
      await new Promise((r) => setTimeout(r, 3_000));
      return { usage: { input_tokens: 4321, output_tokens: 2048 }, stop_reason: 'max_tokens', content: [] };
    });
    const { entry } = await runTick();
    expect(entry.haikuError.failureClass).toBe('truncated_response');
    expect(Object.keys(entry.haikuError)).toEqual(['failureClass', 'message', 'timestamp', 'timeoutKind', 'evalId']);
    expect(entry.haikuError.timeoutKind).toBeNull();
    expect(entry.callMs).toBe(3_000);
    expect(entry.buildMs).toBe(BUILD_MS);
    expect(entry.promptBuiltAt).not.toBeNull();
  });

  it('a BUILD failure whose message is timeout-shaped is never recorded as a transport timeout kind', async () => {
    // Review lenses A/B/D (A2 / B1 / D4). The build's own Firestore path can
    // throw gaxios' 'Total timeout of …ms exceeded' on a stalled token refresh.
    // failureClass 'timeout' there is pre-existing; claiming the SDK's 20s
    // per-request timeout fired on a request that was never sent is not.
    mocks.buildDelayMs = 0;
    mocks.liveBlockError = new Error('Total timeout of 60000ms exceeded before any response was received');
    const { entry } = await runTick();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(entry.callMs).toBeNull();
    expect(entry.promptBuiltAt).toBeNull();
    expect(entry.haikuError.timeoutKind).toBeNull();  // never 'sdk'
  });
});

describe('§4.2 — the prompt build is bounded on its own ceiling', () => {
  beforeEach(() => {
    mocks.buildDelayMs = null; // buildLiveContextBlock never resolves
    mocks.create.mockImplementation(modelTaking(1_000));
  });

  it('a build that never resolves ends the tick at the ceiling as build_timeout: no call, nothing stamped, the entry written, the streak incremented', async () => {
    // Through the namespace, so this really does observe a test override (C3).
    expect(TRANSPORT.PROMPT_BUILD_CEILING_MS).toBe(REAL_BUILD_CEILING_MS);
    expect(mocks.buildCeilingMs).toBeNull();
    const { entry, finalUpdate, summary } = await runTick();

    // The tick ENDED — it did not hold the serial loop to the 300s kill window.
    // The guard for that is vitest's own 5 000 ms testTimeout, not an assertion:
    // against the pre-change cron this row does not fail on a value, it fails
    // with `Test timed out in 5000ms` (review lens C, C5).
    expect(finalUpdate, 'the entry must still be written').toBeTruthy();
    expect(summary.evaluated).toBe(1); // counted, like any other degraded tick

    // No call was made.
    expect(mocks.create).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);

    // The record says what happened, honestly.
    expect(entry.haikuError.failureClass).toBe('build_timeout');
    expect(entry.haikuError.timeoutKind).toBeNull();
    expect(entry.haikuError.message).toContain('prompt build exceeded');
    expect(entry.callMs).toBeNull();
    expect(entry.buildMs).toBeGreaterThanOrEqual(REAL_BUILD_CEILING_MS);
    expect(entry.promptBuiltAt).toBeNull();
    expect(entry.decision).toBe('HOLD');

    // promptBuilt stayed false, so NOTHING was stamped (the existing rule).
    expect(Object.keys(entry)).toEqual([...BASE_ENTRY_KEYS]);
    for (const key of ['heard', 'evidence', 'vintages', 'candidates']) expect(entry).not.toHaveProperty(key);

    // The receipt's SHAPE, not just its class (C2 / D8): the two literal-built
    // receipts (budget_skipped, truncated_response) carry timeoutKind as an
    // explicit null, and nothing else asserted that they still do.
    expect(Object.keys(entry.haikuError)).toEqual(['failureClass', 'message', 'timestamp', 'timeoutKind', 'evalId']);

    // A build timeout is the eval path failing, not a scheduling choice.
    expect(finalUpdate['cronState.consecutiveEvalFailures']).toBe(1);
    // …and it counts as an attempt, like every other tick that got past the guard.
    expect(finalUpdate['cronState.totalHaikuCalls']).toBe(1);

    // The degraded beat and the durable failure both name the new class.
    expect(finalUpdate.statusFeed.some((e) => e.action === 'eval_degraded' && e.message.includes('build_timeout'))).toBe(true);
    expect(finalUpdate['cronState.cronErrors'].at(-1).failureClass).toBe('build_timeout');
  });

  it('the loop proceeds: the next battle takes its own tick normally', async () => {
    await runTick();                      // battle 1 — the hung build
    mocks.buildDelayMs = 0;               // battle 2 — a healthy one
    const second = await runTick({ battle: makeTickBattle({ id: 'battle-tick-2' }) });
    expect(second.entry.haikuError).toBeNull();
    expect(second.entry.decision).toBe('HOLD');
    expect(second.summary.evaluated).toBe(1);
    expect(calls).toHaveLength(1); // only the healthy battle reached the model
  });

  it('a build that finishes just under the ceiling is NOT a timeout — the bound is real on both sides', async () => {
    mocks.buildDelayMs = REAL_BUILD_CEILING_MS - 1;
    const { entry } = await runTick();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(entry.haikuError).toBeNull();
    expect(entry.buildMs).toBe(REAL_BUILD_CEILING_MS - 1);
    expect(entry.promptBuiltAt).not.toBeNull();
  });

  it('AT the ceiling exactly, the build wins — the tie is pinned, not left to race-array order', async () => {
    // Review lens A, finding A3: at the exact tie the winner is decided by the
    // order of the two Promise.race elements (buildPrompt() is invoked, and its
    // timers queued, before buildTimer is armed). Swapping them reads as an
    // identical refactor and silently flips a 10 000 ms build from "proceeds to
    // the call" to build_timeout. The ceiling is a ceiling, so <= passes.
    mocks.buildDelayMs = REAL_BUILD_CEILING_MS;
    const { entry } = await runTick();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(entry.haikuError).toBeNull();
    expect(entry.buildMs).toBe(REAL_BUILD_CEILING_MS);
  });
});

describe('§4.7 — the shadow record joins to the entry and carries the timings', () => {
  beforeEach(() => {
    mocks.buildDelayMs = 1_500;
    mocks.create.mockImplementation(modelTaking(4_000));
  });

  it('the logEvaluation payload carries evalId, timestamp, buildMs and callMs', async () => {
    const { entry } = await runTick();
    expect(mocks.logEvaluation).toHaveBeenCalledTimes(1);
    const payload = mocks.logEvaluation.mock.calls[0][0];

    // The join keys — by value, not by array order (the Phase 0 forensics gap).
    expect(payload.evalId).toBe(entry.evalId);
    expect(payload.timestamp).toBe(entry.timestamp);
    // The two timings, the same numbers the entry carries.
    expect(payload.buildMs).toBe(entry.buildMs);
    expect(payload.callMs).toBe(entry.callMs);
    expect(payload.buildMs).toBe(1_500);
    expect(payload.callMs).toBe(4_000);
    expect(payload.failureClass).toBeNull();
  });

  it('on a build timeout the shadow record carries the class, the build time and a null callMs', async () => {
    mocks.buildDelayMs = null;
    const { entry } = await runTick();
    const payload = mocks.logEvaluation.mock.calls[0][0];
    expect(payload.failureClass).toBe('build_timeout');
    expect(payload.evalId).toBe(entry.evalId);
    expect(payload.callMs).toBeNull();
    expect(payload.buildMs).toBeGreaterThanOrEqual(REAL_BUILD_CEILING_MS);
  });
});
