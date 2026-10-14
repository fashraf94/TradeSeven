// api/_utils/reflectionOutcome.test.js
//
// Reflection outage fix (P-OUT-1, founder rulings O2–O4) — the pure pieces:
// the measured numbers, the fixed failure vocabulary, the outcome record's
// exact shape, and the battle update the cron writes after each attempt.

import { describe, it, expect } from 'vitest';
import { APIError, InternalServerError, APIConnectionError, APIConnectionTimeoutError, APIUserAbortError } from '@anthropic-ai/sdk';
import {
  REFLECTION_MODEL, REFLECTION_TIMEOUT_MS, REFLECTION_MAX_TOKENS, MAX_REFLECTION_ATTEMPTS,
  REFLECTION_FAILURE_CLASSES, isReflectionFailureClass, classifyReflectionError, errorNameOf,
  usageOf, buildReflectionOutcome, reflectionBattleUpdate,
  ACCOUNT_REFUSAL_BACKSTOP_MS, isAccountWideRefusal, isCountedAttempt,
} from './reflectionOutcome.js';

const AT = '2026-10-12T21:00:00.000Z';
// P-OUT-2 (O7) added accountWide — the one change to the record's keys.
const RECORD_KEYS = ['outcome', 'failureClass', 'accountWide', 'errorName', 'elapsedMs', 'stopReason', 'usage', 'model', 'attempt', 'at'];

// The SDK's own construction path (client.js makeStatusError → APIError.generate):
// `error` is the WHOLE parsed body, so the API's error object sits at err.error.error.
const apiErr = (status, type, message, extra = {}) =>
  APIError.generate(status, { type: 'error', error: { type, message, ...extra }, request_id: 'req_test' }, undefined, new Headers());

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
    expect(ok).toEqual({ outcome: 'ok', failureClass: null, accountWide: false, errorName: null, elapsedMs: 18_000, stopReason: 'tool_use', usage: { input_tokens: 1, output_tokens: 2 }, model: 'claude-sonnet-4-6', attempt: 2, at: AT });
    const bare = buildReflectionOutcome({ outcome: 'failed', at: AT });
    expect(Object.keys(bare)).toEqual(RECORD_KEYS);
    expect(Object.values(bare).includes(undefined)).toBe(false);
    expect(bare).toMatchObject({ outcome: 'failed', failureClass: 'unknown', accountWide: false, attempt: 1, model: REFLECTION_MODEL });
  });

  it('accountWide is a boolean: true only on a failure marked so (P-OUT-2, O7)', () => {
    expect(buildReflectionOutcome({ outcome: 'failed', failureClass: 'http_401', accountWide: true, at: AT }).accountWide).toBe(true);
    expect(buildReflectionOutcome({ outcome: 'ok', accountWide: true, at: AT }).accountWide).toBe(false);
    for (const v of ['true', 1, null, undefined]) {
      expect(buildReflectionOutcome({ outcome: 'failed', accountWide: v, at: AT }).accountWide).toBe(false);
    }
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

// ── P-OUT-2, founder ruling O7: account-wide refusals ──────────────────────────
describe('account-wide refusals — the classifier (checked against the SDK and the API docs)', () => {
  it.each([
    ['401 authentication_error', () => apiErr(401, 'authentication_error', 'invalid x-api-key'), 'AuthenticationError'],
    ['403 permission_error', () => apiErr(403, 'permission_error', 'Your API key does not have permission'), 'PermissionDeniedError'],
    ['404 not_found_error (a retired model)', () => apiErr(404, 'not_found_error', 'model: claude-sonnet-4-20250514'), 'NotFoundError'],
    ['402 billing_error', () => apiErr(402, 'billing_error', 'There is an issue with your billing'), 'APIError'],
    ['400 a spend limit the organisation set (the 8 Oct 2026 refusal)', () => apiErr(400, 'invalid_request_error', 'You have reached your specified API usage limits. You will regain access on 2026-11-01 at 00:00 UTC.'), 'BadRequestError'],
    ['400 a workspace spend limit', () => apiErr(400, 'invalid_request_error', 'You have reached your specified workspace API usage limits. You will regain access on 2026-11-01 at 00:00 UTC.'), 'BadRequestError'],
    ['400 the credit balance', () => apiErr(400, 'invalid_request_error', 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.'), 'BadRequestError'],
    ['429 the usage tier\'s monthly spend cap', () => apiErr(429, 'rate_limit_error', 'You have reached your API usage limits: your organization has crossed its monthly API usage threshold.', { details: { error_code: 'enforced_spend_limit_reached' } }), 'RateLimitError'],
    ['a 401 with no JSON body (a proxy page) — by its status alone', () => APIError.generate(401, undefined, 'Unauthorized', new Headers()), 'AuthenticationError'],
    ['a 404 with no JSON body — by its status alone', () => APIError.generate(404, undefined, 'Not Found', new Headers()), 'NotFoundError'],
  ])('%s is account-wide, its class unchanged (http_<status>)', (_label, make, sdkClass) => {
    const err = make();
    expect(err.constructor.name).toBe(sdkClass); // the SDK's real class for that status
    expect(isAccountWideRefusal(err)).toBe(true);
    expect(classifyReflectionError(err)).toBe(`http_${err.status}`);
  });

  it.each([
    ['a plain 400 (a malformed request)', () => apiErr(400, 'invalid_request_error', 'max_tokens: 99999 > 64000, which is the maximum allowed')],
    ['a 400 that only MENTIONS a usage limit', () => apiErr(400, 'invalid_request_error', 'Please read: You have reached your specified API usage limits')],
    ['the spend-limit wording under another error type', () => apiErr(400, 'api_error', 'You have reached your specified API usage limits.')],
    ['a plain 429 rate limit', () => apiErr(429, 'rate_limit_error', 'Number of request tokens has exceeded your per-minute rate limit')],
    ['a 429 with another error code', () => apiErr(429, 'rate_limit_error', 'x', { details: { error_code: 'acceleration_limit' } })],
    ['a 500', () => apiErr(500, 'api_error', 'Internal server error')],
    ['a 529 overload', () => apiErr(529, 'overloaded_error', 'Overloaded')],
    ['a 400 with no JSON body', () => APIError.generate(400, undefined, 'Bad Request', new Headers())],
    ['a connection error', () => new APIConnectionError({ message: 'socket hang up' })],
    ['a connection timeout', () => new APIConnectionTimeoutError()],
    ['an abort', () => new APIUserAbortError()],
    ['a plain Error', () => new Error('You have reached your specified API usage limits')],
  ])('%s is an ordinary try', (_label, make) => {
    expect(isAccountWideRefusal(make())).toBe(false);
  });
});

describe('account-wide refusals — the backstop (O7)', () => {
  const NOW = Date.parse('2026-10-14T12:00:00.000Z');
  const DAY = 24 * 60 * 60 * 1000;
  const refused = { outcome: 'failed', accountWide: true };

  it('the backstop is 7 days', () => {
    expect(ACCOUNT_REFUSAL_BACKSTOP_MS).toBe(7 * DAY);
  });

  it('an account-wide refusal does not count until the battle completed more than 7 days ago', () => {
    const at = (msAgo) => new Date(NOW - msAgo).toISOString();
    expect(isCountedAttempt(refused, { completedAt: at(60_000), nowMs: NOW })).toBe(false);
    expect(isCountedAttempt(refused, { completedAt: at(7 * DAY), nowMs: NOW })).toBe(false); // exactly 7 days: not yet
    expect(isCountedAttempt(refused, { completedAt: at(7 * DAY + 1), nowMs: NOW })).toBe(true);
    expect(isCountedAttempt(refused, { completedAt: at(30 * DAY), nowMs: NOW })).toBe(true);
  });

  it('reads the completion time as an ISO string, epoch ms or a Firestore Timestamp', () => {
    expect(isCountedAttempt(refused, { completedAt: NOW - DAY, nowMs: NOW })).toBe(false);
    expect(isCountedAttempt(refused, { completedAt: { toMillis: () => NOW - DAY }, nowMs: NOW })).toBe(false);
    expect(isCountedAttempt(refused, { completedAt: { toMillis: () => NOW - 8 * DAY }, nowMs: NOW })).toBe(true);
  });

  it('with no readable completion time the backstop applies at once — a refusal can never loop', () => {
    for (const completedAt of [undefined, null, 'not a date', {}, { toMillis: () => { throw new Error('x'); } }]) {
      expect(isCountedAttempt(refused, { completedAt, nowMs: NOW })).toBe(true);
    }
  });

  it('every other attempt counts', () => {
    const recent = new Date(NOW - 60_000).toISOString();
    expect(isCountedAttempt({ outcome: 'failed', accountWide: false }, { completedAt: recent, nowMs: NOW })).toBe(true);
    expect(isCountedAttempt({ outcome: 'ok', accountWide: true }, { completedAt: recent, nowMs: NOW })).toBe(true);
    expect(isCountedAttempt(undefined, { completedAt: recent, nowMs: NOW })).toBe(true);
  });
});

describe('the battle update — an attempt not counted, and a deferred finish (P-OUT-2)', () => {
  const refusedRecord = (attempt) => buildReflectionOutcome({ outcome: 'failed', failureClass: 'http_401', accountWide: true, errorName: 'AuthenticationError', attempt, at: AT });

  it('an account-wide refusal within the backstop hands the claimed attempt back in the same write, and never finishes the battle — even at attempt 3', () => {
    for (const attempt of [1, 2, 3]) {
      const u = reflectionBattleUpdate({ outcome: 'failed', record: refusedRecord(attempt), counted: false }, { attempt, at: AT });
      expect(u).toEqual({ reflectionOutcome: refusedRecord(attempt), reflectionAttempts: attempt - 1 });
    }
  });

  it('counted: false is honoured only on an account-wide record; past the backstop the same refusal counts', () => {
    const plain = buildReflectionOutcome({ outcome: 'failed', failureClass: 'http_400', attempt: 3, at: AT });
    expect(reflectionBattleUpdate({ outcome: 'failed', record: plain, counted: false }, { attempt: 3, at: AT }))
      .toEqual({ reflectionOutcome: plain, pendingReflection: false, reflectionNoLesson: true });
    expect(reflectionBattleUpdate({ outcome: 'failed', record: refusedRecord(3), counted: true }, { attempt: 3, at: AT }))
      .toEqual({ reflectionOutcome: refusedRecord(3), pendingReflection: false, reflectionNoLesson: true });
  });

  it('a third attempt that could not leave its row waits for the recovery pass; the recovery pass always finishes', () => {
    const rec = buildReflectionOutcome({ outcome: 'failed', failureClass: 'timeout', attempt: 3, at: AT });
    expect(reflectionBattleUpdate({ outcome: 'failed', record: rec, counted: true, deferToRecovery: true }, { attempt: 3, at: AT }))
      .toEqual({ reflectionOutcome: rec });
    expect(reflectionBattleUpdate({ outcome: 'failed', record: rec, counted: true, deferToRecovery: true }, { attempt: 3, at: AT, recoveryPass: true }))
      .toEqual({ reflectionOutcome: rec, pendingReflection: false, reflectionNoLesson: true });
  });
});
