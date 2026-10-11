// api/_utils/reflectionOutcome.js
//
// Reflection outage fix (package P-OUT-1, founder rulings O2–O4, 10 Oct 2026).
// One source for the reflection call's budget, the attempt cap, the fixed
// failure vocabulary, and the outcome record the pending-reflections cron
// writes on the battle (and api/agent/reflect.js mirrors into the shadow line).
// Root cause and anchors: docs/audits/20261010_PHASE0_REFLECTION_OUTAGE_ROOT_CAUSE.md
// (R1–R3); numbers and their measurements: docs/audits/20261010_BUILD_REFLECTION_OUTAGE_FIX.md.
//
// The record carries NO player or agent text: classes, an error CLASS name,
// timings, token counts and the model id only.

import { APIError, APIConnectionError, APIConnectionTimeoutError } from '@anthropic-ai/sdk';

export const REFLECTION_MODEL = 'claude-sonnet-4-6';

// Chosen by measurement (O2): six calls with the smaller request on completed
// tournament battles (3–10 hypotheses) ran 11.0–20.6 s for 463–1,031 output
// tokens. Deadline >= 1.5x the slowest call; ceiling >= 2x the largest answer.
export const REFLECTION_TIMEOUT_MS = 35_000;
export const REFLECTION_MAX_TOKENS = 4096;

// O3: three attempts, then the battle is finished without a lesson.
export const MAX_REFLECTION_ATTEMPTS = 3;

// O4: the fixed vocabulary. An HTTP failure is `http_<status>` (e.g. http_529).
export const REFLECTION_FAILURE_CLASSES = Object.freeze([
  'timeout', 'max_tokens', 'no_tool_use', 'missing_keys', 'connection', 'unknown',
]);
const HTTP_CLASS = /^http_\d{3}$/;

export function isReflectionFailureClass(value) {
  return typeof value === 'string' && (REFLECTION_FAILURE_CLASSES.includes(value) || HTTP_CLASS.test(value));
}

/**
 * Classify a thrown error. `timedOut` is OUR deadline having fired — the only
 * trustworthy timeout signal (an abort mid-body can surface as a raw
 * AbortError, and the SDK's own retried request timeout is a different thing).
 */
export function classifyReflectionError(err, { timedOut = false } = {}) {
  if (timedOut) return 'timeout';
  if (err instanceof APIConnectionTimeoutError) return 'timeout';
  if (err instanceof APIConnectionError) return 'connection';
  if (err instanceof APIError && Number.isInteger(err.status)) return `http_${err.status}`;
  return 'unknown';
}

/** The error's CLASS name (never its message): `RateLimitError`, `AbortError`, … */
export function errorNameOf(err) {
  if (err == null) return null;
  const own = typeof err.name === 'string' && err.name && err.name !== 'Error' ? err.name : null;
  const ctor = typeof err.constructor?.name === 'string' && err.constructor.name !== 'Object' ? err.constructor.name : null;
  const name = own || ctor || (typeof err.name === 'string' ? err.name : null);
  return name ? name.slice(0, 64) : null;
}

/** `{ input_tokens, output_tokens }` from a response's usage, or null. */
export function usageOf(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const n = (v) => (Number.isFinite(v) ? v : null);
  return { input_tokens: n(usage.input_tokens), output_tokens: n(usage.output_tokens) };
}

/** The outcome record for ONE attempt — exactly these fields, never undefined. */
export function buildReflectionOutcome({ outcome, failureClass = null, errorName = null, elapsedMs = null, stopReason = null, usage = null, model = REFLECTION_MODEL, attempt = 1, at }) {
  return {
    outcome: outcome === 'ok' ? 'ok' : 'failed',
    failureClass: outcome === 'ok' ? null : (isReflectionFailureClass(failureClass) ? failureClass : 'unknown'),
    errorName: outcome === 'ok' ? null : (errorName ?? null),
    elapsedMs: Number.isFinite(elapsedMs) ? elapsedMs : null,
    stopReason: typeof stopReason === 'string' ? stopReason : null,
    usage: usage ?? null,
    model: typeof model === 'string' && model ? model : REFLECTION_MODEL,
    attempt: Number.isInteger(attempt) && attempt > 0 ? attempt : 1,
    at: typeof at === 'string' ? at : new Date().toISOString(),
  };
}

/**
 * The battle fields the cron writes after an attempt (pure — unit-tested).
 *   ok       → the flag clears and reflectedAt is stamped, as a success always did;
 *   skipped  → nothing to reflect (battle/agent gone, lesson already recorded):
 *              the flag clears and reflectedAt is stamped, as before this fix;
 *   failed   → the flag STAYS set so the cron retries; at the cap the flag
 *              clears and the battle is marked finished without a lesson.
 * Anything else (a malformed result) is a failed attempt of class `unknown`.
 */
export function reflectionBattleUpdate(result, { attempt, at }) {
  if (result?.outcome === 'ok') {
    return { pendingReflection: false, reflectedAt: at, reflectionOutcome: result.record };
  }
  if (result?.outcome === 'skipped') {
    return { pendingReflection: false, reflectedAt: at };
  }
  const record = result?.outcome === 'failed' && result.record
    ? result.record
    : buildReflectionOutcome({ outcome: 'failed', failureClass: 'unknown', attempt, at });
  if (attempt >= MAX_REFLECTION_ATTEMPTS) {
    return { reflectionOutcome: record, pendingReflection: false, reflectionNoLesson: true };
  }
  return { reflectionOutcome: record };
}
