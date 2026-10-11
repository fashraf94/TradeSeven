// api/_utils/reflectionOutcome.test.js
//
// Reflection outage fix (P-OUT-1, founder rulings O2–O4) — the pure pieces:
// the measured numbers, the fixed failure vocabulary, the outcome record's
// exact shape, and the battle update the cron writes after each attempt.

import { describe, it, expect } from 'vitest';
import { InternalServerError, APIConnectionError, APIConnectionTimeoutError, APIUserAbortError } from '@anthropic-ai/sdk';
import {
  REFLECTION_MODEL, REFLECTION_TIMEOUT_MS, REFLECTION_MAX_TOKENS, MAX_REFLECTION_ATTEMPTS,
  REFLECTION_FAILURE_CLASSES, isReflectionFailureClass, classifyReflectionError, errorNameOf,
  usageOf, buildReflectionOutcome, reflectionBattleUpdate,
} from './reflectionOutcome.js';

const AT = '2026-10-12T21:00:00.000Z';
const RECORD_KEYS = ['outcome', 'failureClass', 'errorName', 'elapsedMs', 'stopReason', 'usage', 'model', 'attempt', 'at'];

describe('the numbers (chosen by measurement; build report §2)', () => {
  it('deadline 35 s (>= 1.5 x the slowest 20.6 s call), ceiling 4,096 (>= 2 x the largest 1,031-token answer), three attempts', () => {
    expect(REFLECTION_TIMEOUT_MS).toBe(35_000);
    expect(REFLECTION_TIMEOUT_MS).toBeGreaterThanOrEqual(Math.ceil(1.5 * 20_557));
    expect(REFLECTION_MAX_TOKENS).toBe(4096);
    expect(REFLECTION_MAX_TOKENS).toBeGreaterThanOrEqual(2 * 1_031);
    expect(MAX_REFLECTION_ATTEMPTS).toBe(3);
    expect(REFLECTION_MODEL).toBe('claude-sonnet-4-6');
  });
});

describe('the fixed vocabulary', () => {
  it('is exactly the ruled classes plus http_<status>', () => {
    expect(REFLECTION_FAILURE_CLASSES).toEqual(['timeout', 'max_tokens', 'no_tool_use', 'missing_keys', 'connection', 'unknown']);
    for (const c of [...REFLECTION_FAILURE_CLASSES, 'http_429', 'http_529', 'http_400']) expect(isReflectionFailureClass(c)).toBe(true);
    for (const c of ['http_', 'http_5xx', 'Timeout', '', null, undefined, 'refusal']) expect(isReflectionFailureClass(c)).toBe(false);
  });

  it('classifies by our own deadline flag first, then the SDK error classes', () => {
    expect(classifyReflectionError(new APIUserAbortError(), { timedOut: true })).toBe('timeout');
    expect(classifyReflectionError(new APIUserAbortError())).toBe('unknown'); // an abort we did not fire
    expect(classifyReflectionError(new APIConnectionTimeoutError())).toBe('timeout');
    expect(classifyReflectionError(new APIConnectionError({ message: 'x' }))).toBe('connection');
    expect(classifyReflectionError(new InternalServerError(529, {}, 'x', new Headers()))).toBe('http_529');
    expect(classifyReflectionError(new Error('plain'))).toBe('unknown');
  });

  it('names the error by class, never by message', () => {
    expect(errorNameOf(new InternalServerError(500, {}, 'secret text', new Headers()))).toBe('InternalServerError');
    const fb = new Error('secret text'); fb.name = 'FirebaseError';
    expect(errorNameOf(fb)).toBe('FirebaseError');
    expect(errorNameOf(new Error('secret text'))).toBe('Error');
    expect(errorNameOf(null)).toBeNull();
  });

  it('usage keeps input and output token counts only', () => {
    expect(usageOf({ input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 5 })).toEqual({ input_tokens: 10, output_tokens: 20 });
    expect(usageOf(undefined)).toBeNull();
  });
});

describe('the outcome record', () => {
  it('carries exactly the ruled fields, never undefined (Firestore rejects undefined)', () => {
    const ok = buildReflectionOutcome({ outcome: 'ok', elapsedMs: 18_000, stopReason: 'tool_use', usage: { input_tokens: 1, output_tokens: 2 }, model: 'claude-sonnet-4-6', attempt: 2, at: AT });
    expect(Object.keys(ok)).toEqual(RECORD_KEYS);
    expect(ok).toEqual({ outcome: 'ok', failureClass: null, errorName: null, elapsedMs: 18_000, stopReason: 'tool_use', usage: { input_tokens: 1, output_tokens: 2 }, model: 'claude-sonnet-4-6', attempt: 2, at: AT });
    const bare = buildReflectionOutcome({ outcome: 'failed', at: AT });
    expect(Object.values(bare).includes(undefined)).toBe(false);
    expect(bare).toMatchObject({ outcome: 'failed', failureClass: 'unknown', attempt: 1, model: REFLECTION_MODEL });
  });

  it('a class outside the vocabulary is recorded as unknown; a success never carries a class or an error name', () => {
    expect(buildReflectionOutcome({ outcome: 'failed', failureClass: 'exploded', at: AT }).failureClass).toBe('unknown');
    expect(buildReflectionOutcome({ outcome: 'ok', failureClass: 'timeout', errorName: 'X', at: AT })).toMatchObject({ failureClass: null, errorName: null });
  });
});

describe('the battle update after an attempt', () => {
  const failed = (attempt) => ({ outcome: 'failed', record: buildReflectionOutcome({ outcome: 'failed', failureClass: 'timeout', attempt, at: AT }) });

  it('ok → the flag clears, reflectedAt is stamped, the outcome is recorded', () => {
    const ok = { outcome: 'ok', record: buildReflectionOutcome({ outcome: 'ok', attempt: 1, at: AT }) };
    expect(reflectionBattleUpdate(ok, { attempt: 1, at: AT })).toEqual({ pendingReflection: false, reflectedAt: AT, reflectionOutcome: ok.record });
  });

  it('skipped → the flag clears and reflectedAt is stamped, as before the fix', () => {
    expect(reflectionBattleUpdate({ outcome: 'skipped', reason: 'agent_missing' }, { attempt: 1, at: AT })).toEqual({ pendingReflection: false, reflectedAt: AT });
  });

  it('a failure before the cap records the outcome and leaves the flag alone', () => {
    for (const attempt of [1, 2]) {
      const u = reflectionBattleUpdate(failed(attempt), { attempt, at: AT });
      expect(u).toEqual({ reflectionOutcome: failed(attempt).record });
      expect(u).not.toHaveProperty('pendingReflection');
    }
  });

  it('the failure AT the cap clears the flag and marks the battle finished without a lesson', () => {
    expect(reflectionBattleUpdate(failed(3), { attempt: 3, at: AT })).toEqual({ reflectionOutcome: failed(3).record, pendingReflection: false, reflectionNoLesson: true });
  });

  it('a malformed result is a failed attempt of class unknown', () => {
    for (const bad of [undefined, null, {}, { outcome: 'weird' }, { outcome: 'failed' }]) {
      const u = reflectionBattleUpdate(bad, { attempt: 1, at: AT });
      expect(u.reflectionOutcome).toMatchObject({ outcome: 'failed', failureClass: 'unknown', attempt: 1 });
      expect(u).not.toHaveProperty('pendingReflection');
    }
  });
});
