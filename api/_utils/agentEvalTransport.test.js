// api/_utils/agentEvalTransport.test.js
// Haiku eval reliability fix (June 2026) — failure classification mapping,
// pre-call budget guard boundaries, and the degraded-mode counter lifecycle.
// Error fixtures mirror @anthropic-ai/sdk 0.71.2 empirics: the SDK classes do
// NOT set `.name` (it stays 'Error'), so classification keys on
// constructor.name / message / status.

import { describe, it, expect } from 'vitest';
import {
  classifyHaikuFailure,
  classifyTimeoutKind,
  shouldStartHaikuCall,
  nextConsecutiveEvalFailures,
  HAIKU_CALL_CEILING_MS,
  HAIKU_POST_CALL_ALLOWANCE_MS,
  PROMPT_BUILD_CEILING_MS,
  PROMPT_BUILD_TIMEOUT_ERROR_NAME,
  EVAL_MAX_OUTPUT_TOKENS,
} from './agentEvalTransport.js';

describe('EVAL_MAX_OUTPUT_TOKENS — the eval output ceiling', () => {
  // Raised 1024 → 2048 (DR-13 truncation baseline): ~21% of production evals
  // were silently truncating their rationale/cited-rules tail at 1024; true
  // uncapped output tops out ~1421 (p99 ~1240), so 2048 clears it with headroom.
  it('is 2048 (the post-baseline ceiling)', () => {
    expect(EVAL_MAX_OUTPUT_TOKENS).toBe(2048);
  });

  it('leaves headroom above the observed p99 (~1240) and max (~1421) eval output', () => {
    expect(EVAL_MAX_OUTPUT_TOKENS).toBeGreaterThan(1421);
  });
});

// Minimal stand-ins with the same constructor.name / message / status shape
// as the real SDK classes (verified empirically against 0.71.2).
class APIConnectionTimeoutError extends Error {
  constructor() { super('Request timed out.'); }
}
class APIUserAbortError extends Error {
  constructor() { super('Request was aborted.'); }
}
class RateLimitError extends Error {
  constructor() { super('429 rate limited'); this.status = 429; }
}
class InternalServerError extends Error {
  constructor() { super('529 overloaded'); this.status = 529; }
}
class APIConnectionError extends Error {
  constructor() { super('Connection error.'); }
}
// The cron's prompt-build race rejection: a plain Error whose `.name` is set
// (agent-evaluate.js). Its constructor.name is 'Error', so — the mirror image
// of the SDK quirk above — only the `.name` arm can catch it.
const promptBuildTimeout = () => Object.assign(
  new Error(`prompt build exceeded ${PROMPT_BUILD_CEILING_MS} ms`),
  { name: PROMPT_BUILD_TIMEOUT_ERROR_NAME },
);

describe('classifyHaikuFailure', () => {
  it('classifies the SDK per-request timeout as timeout (constructor.name, .name stays Error)', () => {
    const err = new APIConnectionTimeoutError();
    expect(err.name).toBe('Error'); // documents the SDK quirk the matcher must survive
    expect(classifyHaikuFailure(err)).toBe('timeout');
  });

  it('classifies the AbortController backstop (APIUserAbortError) as timeout', () => {
    expect(classifyHaikuFailure(new APIUserAbortError())).toBe('timeout');
  });

  it('classifies a native AbortError as timeout', () => {
    const err = new Error('The operation was aborted');
    err.name = 'AbortError';
    expect(classifyHaikuFailure(err)).toBe('timeout');
  });

  it('classifies timeout-shaped messages as timeout (legacy race string included)', () => {
    expect(classifyHaikuFailure(new Error('Haiku timeout'))).toBe('timeout');
    expect(classifyHaikuFailure(new Error('connect ETIMEDOUT: timed out'))).toBe('timeout');
  });

  it('classifies HTTP errors by status', () => {
    expect(classifyHaikuFailure(new RateLimitError())).toBe('429');
    expect(classifyHaikuFailure(new InternalServerError())).toBe('529');
  });

  it('falls back to the constructor name for non-status, non-timeout failures', () => {
    expect(classifyHaikuFailure(new APIConnectionError())).toBe('APIConnectionError');
    expect(classifyHaikuFailure(new TypeError('x is not a function'))).toBe('TypeError');
  });

  it('returns unknown for null/undefined', () => {
    expect(classifyHaikuFailure(null)).toBe('unknown');
    expect(classifyHaikuFailure(undefined)).toBe('unknown');
  });

  // Sep 2026 transport hygiene: the prompt build is bounded on its own ceiling
  // and blowing it is NOT a call that timed out — no request was ever sent.
  it('classifies the prompt-build ceiling as build_timeout, never as timeout', () => {
    const err = promptBuildTimeout();
    expect(err.constructor.name).toBe('Error'); // only the `.name` arm can catch it
    expect(classifyHaikuFailure(err)).toBe('build_timeout');
    expect(classifyHaikuFailure(err)).not.toBe('timeout');
  });

  it('the build-timeout message is not timeout-shaped either — the class does not depend on the branch order', () => {
    const msg = promptBuildTimeout().message;
    expect(msg).not.toMatch(/timed? ?out/i);
    expect(msg).not.toMatch(/request was aborted/i);
    expect(classifyHaikuFailure(new Error(msg))).toBe('Error'); // the message alone classifies as nothing
  });
});

// Sep 2026 transport hygiene. classifyHaikuFailure keeps ONE 'timeout' class —
// every consumer of it is unchanged — and this carries the split Phase 0 §3.3
// found missing: by failureClass alone the SDK's 20s timeout and the cron's 22s
// AbortController backstop were indistinguishable, and only the first 200 chars
// of haikuError.message told them apart.
describe('classifyTimeoutKind', () => {
  it("the SDK's own per-request timeout is 'sdk' (constructor.name, .name stays Error)", () => {
    const err = new APIConnectionTimeoutError();
    expect(err.name).toBe('Error');
    expect(classifyTimeoutKind(err)).toBe('sdk');
    // …and by message alone, for an SDK build that stops exporting the class
    expect(classifyTimeoutKind(new Error('Request timed out.'))).toBe('sdk');
    expect(classifyTimeoutKind(new Error('connect ETIMEDOUT: timed out'))).toBe('sdk');
  });

  it("the AbortController backstop is 'backstop' — the SDK class, a native AbortError, and the message", () => {
    expect(classifyTimeoutKind(new APIUserAbortError())).toBe('backstop');
    const native = new Error('The operation was aborted');
    native.name = 'AbortError';
    expect(classifyTimeoutKind(native)).toBe('backstop');
    expect(classifyTimeoutKind(new Error('Request was aborted.'))).toBe('backstop');
  });

  it('the two kinds are never the same value, while the failure CLASS stays one word for both', () => {
    const sdk = new APIConnectionTimeoutError();
    const backstop = new APIUserAbortError();
    expect(classifyTimeoutKind(sdk)).not.toBe(classifyTimeoutKind(backstop));
    expect(classifyHaikuFailure(sdk)).toBe('timeout');
    expect(classifyHaikuFailure(backstop)).toBe('timeout');
  });

  it('a build timeout stays null even when its MESSAGE is timeout-shaped — the name guard, not the fall-through, is what holds', () => {
    // Anti-vacuity (review lens A, finding A1): the shipped ceiling message
    // ('prompt build exceeded 10000 ms') matches neither regex, so the plain
    // build-timeout case would return null with or without the name guard at
    // the top of classifyTimeoutKind. This row is the one that makes that guard
    // load-bearing: same name, a message that DOES match /timed? ?out/i.
    const err = Object.assign(new Error('prompt build timed out'), { name: PROMPT_BUILD_TIMEOUT_ERROR_NAME });
    expect(/timed? ?out/i.test(err.message)).toBe(true);
    expect(classifyTimeoutKind(err)).toBeNull();
    expect(classifyHaikuFailure(err)).toBe('build_timeout');
  });

  it('the CLASS check beats the message check: a backstop abort whose message mentions a timeout is still backstop', () => {
    // Review lens D, finding D4. The class is the strong signal; the messages
    // are only a fallback for an SDK build that stops exporting the classes.
    // Interleaving them mis-read the one discrimination this function exists for.
    const abortWithTimeoutWords = new APIUserAbortError();
    abortWithTimeoutWords.message = 'Request was aborted due to timeout';
    expect(classifyTimeoutKind(abortWithTimeoutWords)).toBe('backstop');

    const nativeAbort = new Error('The operation timed out and was aborted');
    nativeAbort.name = 'AbortError';
    expect(classifyTimeoutKind(nativeAbort)).toBe('backstop');
  });

  it('everything that is not a transport timeout is null — build timeout, statuses, connection error, TypeError, nullish', () => {
    expect(classifyTimeoutKind(promptBuildTimeout())).toBeNull();
    expect(classifyTimeoutKind(new RateLimitError())).toBeNull();
    expect(classifyTimeoutKind(new InternalServerError())).toBeNull();
    expect(classifyTimeoutKind(new APIConnectionError())).toBeNull();
    expect(classifyTimeoutKind(new TypeError('x is not a function'))).toBeNull();
    expect(classifyTimeoutKind(null)).toBeNull();
    expect(classifyTimeoutKind(undefined)).toBeNull();
  });

  it('a truncated response never reaches it — but were it passed one, it is null (the class is set from a literal, not from an error)', () => {
    expect(classifyTimeoutKind(new Error('response received but tool input missing/unusable (stop_reason=max_tokens)'))).toBeNull();
  });
});

describe('shouldStartHaikuCall — pre-call budget guard', () => {
  const timeBudgetMs = 80_000; // > the requirement, so the boundary rows are about the guard, not the budget
  // The requirement is the SUM OF THE THREE NAMED CONSTANTS and never a
  // literal, so a future ceiling change moves the guard with it. Sep 2026: the
  // build became a bounded phase running sequentially BEFORE the call (the
  // backstop is armed after the prompt is built), so its ceiling joins the sum.
  const required = PROMPT_BUILD_CEILING_MS + HAIKU_CALL_CEILING_MS + HAIKU_POST_CALL_ALLOWANCE_MS;

  it('derives the 44s requirement from the 10s build ceiling + 22s call ceiling + 12s post-call allowance', () => {
    expect(required).toBe(44_000);
    expect(PROMPT_BUILD_CEILING_MS).toBe(10_000);
    expect(HAIKU_CALL_CEILING_MS).toBe(22_000);
    expect(HAIKU_POST_CALL_ALLOWANCE_MS).toBe(12_000);
    // anti-vacuous: the build ceiling is really IN the sum (the pre-Sep-2026
    // guard required 34s and this row is what catches a silent revert)
    expect(shouldStartHaikuCall({ elapsedMs: 0, timeBudgetMs }).requiredMs).toBe(required);
    expect(shouldStartHaikuCall({ elapsedMs: 0, timeBudgetMs }).requiredMs)
      .toBe(HAIKU_CALL_CEILING_MS + HAIKU_POST_CALL_ALLOWANCE_MS + PROMPT_BUILD_CEILING_MS);
  });

  it('proceeds when remaining budget exactly equals the requirement (boundary inclusive)', () => {
    const d = shouldStartHaikuCall({ elapsedMs: timeBudgetMs - required, timeBudgetMs });
    expect(d.proceed).toBe(true);
    expect(d.remainingMs).toBe(required);
    expect(d.requiredMs).toBe(required);
  });

  it('skips when remaining budget is 1ms short', () => {
    const d = shouldStartHaikuCall({ elapsedMs: timeBudgetMs - required + 1, timeBudgetMs });
    expect(d.proceed).toBe(false);
    expect(d.remainingMs).toBe(required - 1);
  });

  it('a battle that WOULD have proceeded under the old 34s requirement is now skipped — the build needs room of its own', () => {
    const oldRequired = HAIKU_CALL_CEILING_MS + HAIKU_POST_CALL_ALLOWANCE_MS;
    const d = shouldStartHaikuCall({ elapsedMs: timeBudgetMs - oldRequired, timeBudgetMs });
    expect(d.remainingMs).toBe(oldRequired);
    expect(d.proceed).toBe(false);
  });

  it('proceeds comfortably at the start of a run', () => {
    expect(shouldStartHaikuCall({ elapsedMs: 5_000, timeBudgetMs }).proceed).toBe(true);
  });

  it('honors explicit build/ceiling/allowance overrides', () => {
    const d = shouldStartHaikuCall({
      elapsedMs: 0, timeBudgetMs: 10_000,
      promptBuildCeilingMs: 500, callCeilingMs: 8_000, postCallAllowanceMs: 1_000,
    });
    expect(d.proceed).toBe(true);
    expect(d.requiredMs).toBe(9_500);
  });
});

describe('nextConsecutiveEvalFailures — counter lifecycle', () => {
  it('increments on failure from 0 / undefined / null', () => {
    expect(nextConsecutiveEvalFailures(0, 'failure')).toBe(1);
    expect(nextConsecutiveEvalFailures(undefined, 'failure')).toBe(1);
    expect(nextConsecutiveEvalFailures(null, 'failure')).toBe(1);
  });

  it('increments an existing streak', () => {
    expect(nextConsecutiveEvalFailures(3, 'failure')).toBe(4);
  });

  it('resets to 0 on success', () => {
    expect(nextConsecutiveEvalFailures(7, 'success')).toBe(0);
    expect(nextConsecutiveEvalFailures(0, 'success')).toBe(0);
  });

  it('budget_skipped leaves the streak unchanged in both directions', () => {
    expect(nextConsecutiveEvalFailures(2, 'budget_skipped')).toBe(2);
    expect(nextConsecutiveEvalFailures(0, 'budget_skipped')).toBe(0);
  });

  it('normalizes garbage prior values to 0 before applying the outcome', () => {
    expect(nextConsecutiveEvalFailures(NaN, 'failure')).toBe(1);
    expect(nextConsecutiveEvalFailures(-5, 'failure')).toBe(1);
    expect(nextConsecutiveEvalFailures('3', 'failure')).toBe(1);
  });
});
