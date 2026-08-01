// api/_utils/agentEvalTransport.test.js
// Haiku eval reliability fix (June 2026) — failure classification mapping,
// pre-call budget guard boundaries, and the degraded-mode counter lifecycle.
// Error fixtures mirror @anthropic-ai/sdk 0.71.2 empirics: the SDK classes do
// NOT set `.name` (it stays 'Error'), so classification keys on
// constructor.name / message / status.

import { describe, it, expect } from 'vitest';
import {
  classifyHaikuFailure,
  shouldStartHaikuCall,
  nextConsecutiveEvalFailures,
  HAIKU_CALL_CEILING_MS,
  HAIKU_POST_CALL_ALLOWANCE_MS,
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
});

describe('shouldStartHaikuCall — pre-call budget guard', () => {
  const timeBudgetMs = 50_000; // TIME_BUDGET_MS in agent-evaluate.js
  const required = HAIKU_CALL_CEILING_MS + HAIKU_POST_CALL_ALLOWANCE_MS; // 34s

  it('derives the 34s requirement from the 22s ceiling + 12s allowance', () => {
    expect(required).toBe(34_000);
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
  });

  it('proceeds comfortably at the start of a run', () => {
    expect(shouldStartHaikuCall({ elapsedMs: 5_000, timeBudgetMs }).proceed).toBe(true);
  });

  it('honors explicit ceiling/allowance overrides', () => {
    const d = shouldStartHaikuCall({ elapsedMs: 0, timeBudgetMs: 10_000, callCeilingMs: 8_000, postCallAllowanceMs: 1_000 });
    expect(d.proceed).toBe(true);
    expect(d.requiredMs).toBe(9_000);
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
