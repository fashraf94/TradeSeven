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
//
// Part 2 (package P-OUT-2, founder ruling O7, 14 Oct 2026): an ACCOUNT-WIDE
// refusal does not use up one of the three tries until its battle completed
// more than ACCOUNT_REFUSAL_BACKSTOP_MS ago (isAccountWideRefusal,
// isCountedAttempt). Build report: docs/audits/20261014_BUILD_REFLECTION_OUTAGE_FIX_2.md.

import { APIError, APIConnectionError, APIConnectionTimeoutError } from '@anthropic-ai/sdk';

export const REFLECTION_MODEL = 'claude-sonnet-4-6';

// Chosen by measurement (O2): six calls with the smaller request on completed
// tournament battles (3–10 hypotheses) ran 11.0–20.6 s for 463–1,031 output
// tokens. Deadline >= 1.5x the slowest call; ceiling >= 2x the largest answer.
export const REFLECTION_TIMEOUT_MS = 35_000;
export const REFLECTION_MAX_TOKENS = 4096;

// O3: three attempts, then the battle is finished without a lesson.
export const MAX_REFLECTION_ATTEMPTS = 3;

// O7 backstop: once a battle completed more than 7 days ago, an account-wide
// refusal counts like any other failure, so no refusal can keep a game
// pending for ever.
export const ACCOUNT_REFUSAL_BACKSTOP_MS = 7 * 24 * 60 * 60 * 1000;

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

// O7: what "the account itself refused the call" looks like, checked on
// 14 Oct 2026 against the SDK's error objects (@anthropic-ai/sdk 0.71.2: an
// APIError carries `status`, and `error` = the WHOLE parsed body
// { type: 'error', error: { type, message, details? }, request_id }) and
// Anthropic's API error documentation (platform.claude.com/docs/en/api/errors,
// /api/rate-limits, /about-claude/api-credits-for-subscribers):
//   401 authentication_error · 403 permission_error · 404 not_found_error (a
//     retired or unknown model) · 402 billing_error (billing or payment);
//   400 invalid_request_error "You have reached your specified API usage
//     limits…" or "…specified workspace API usage limits…" — a spend limit the
//     organisation set (the 8 Oct 2026 production refusals);
//   400 invalid_request_error "Your credit balance is too low to access the
//     Anthropic API…" — prepaid credits used up;
//   429 rate_limit_error with error.details.error_code
//     'enforced_spend_limit_reached' — the usage tier's monthly spend cap.
// Every other 400 and every other 429 is an ordinary try. The failure CLASS is
// unchanged (http_<status>); the record gains only the boolean accountWide.
const ACCOUNT_WIDE_STATUSES = new Set([401, 402, 403, 404]);
const ACCOUNT_REFUSAL_400_PREFIXES = Object.freeze([
  'You have reached your specified API usage limits',
  'You have reached your specified workspace API usage limits',
  'Your credit balance is too low to access the Anthropic API',
]);
const TIER_SPEND_CAP_ERROR_CODE = 'enforced_spend_limit_reached';

export function isAccountWideRefusal(err) {
  if (!(err instanceof APIError) || !Number.isInteger(err.status)) return false;
  if (ACCOUNT_WIDE_STATUSES.has(err.status)) return true;
  const apiError = err.error?.error;
  if (err.status === 429) {
    return apiError?.type === 'rate_limit_error' && apiError?.details?.error_code === TIER_SPEND_CAP_ERROR_CODE;
  }
  if (err.status === 400) {
    const message = typeof apiError?.message === 'string' ? apiError.message : '';
    return apiError?.type === 'invalid_request_error' && ACCOUNT_REFUSAL_400_PREFIXES.some((p) => message.startsWith(p));
  }
  return false;
}

/** A completion time (ISO string, epoch ms or Firestore Timestamp) in ms, or null. */
function timeMsOf(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') { const t = Date.parse(value); return Number.isFinite(t) ? t : null; }
  if (value && typeof value.toMillis === 'function') { try { const t = value.toMillis(); return Number.isFinite(t) ? t : null; } catch { return null; } }
  return null;
}

/**
 * Does this attempt use up one of the three tries (O7)? Everything does except
 * an account-wide refusal on a battle that completed within the backstop. A
 * battle with no readable completion time is past the backstop: a refusal can
 * never keep it pending for ever. Pure — reflect.js decides with it, and the
 * cron writes what reflect.js decided (one decision per attempt).
 */
export function isCountedAttempt(record, { completedAt, nowMs }) {
  if (record?.outcome !== 'failed' || record.accountWide !== true) return true;
  const completedMs = timeMsOf(completedAt);
  if (completedMs == null || !Number.isFinite(nowMs)) return true;
  return nowMs - completedMs > ACCOUNT_REFUSAL_BACKSTOP_MS;
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

/**
 * The outcome record for ONE attempt — exactly these fields, never undefined.
 * accountWide (P-OUT-2, O7) is true only on a failure the account itself
 * refused (isAccountWideRefusal); always a boolean.
 */
export function buildReflectionOutcome({ outcome, failureClass = null, accountWide = false, errorName = null, elapsedMs = null, stopReason = null, usage = null, model = REFLECTION_MODEL, attempt = 1, at }) {
  return {
    outcome: outcome === 'ok' ? 'ok' : 'failed',
    failureClass: outcome === 'ok' ? null : (isReflectionFailureClass(failureClass) ? failureClass : 'unknown'),
    accountWide: outcome !== 'ok' && accountWide === true,
    errorName: outcome === 'ok' ? null : (errorName ?? null),
    elapsedMs: Number.isFinite(elapsedMs) ? elapsedMs : null,
    stopReason: typeof stopReason === 'string' ? stopReason : null,
    usage: usage ?? null,
    // An explicit null = no call was made on this attempt (a lesson already
    // recorded, or the recovery pass for a spent battle).
    model: model === null ? null : (typeof model === 'string' && model ? model : REFLECTION_MODEL),
    attempt: Number.isInteger(attempt) && attempt > 0 ? attempt : 1,
    at: typeof at === 'string' ? at : new Date().toISOString(),
  };
}

/**
 * The battle fields the cron writes after an attempt (pure — unit-tested).
 *   ok       → the flag clears and reflectedAt is stamped, as a success always did
 *              (also when the lesson was already recorded by an earlier attempt);
 *   skipped  → nothing to reflect (battle or agent gone): the flag clears and
 *              reflectedAt is stamped, as before this fix;
 *   failed   → the flag STAYS set so the cron retries; at the cap the flag
 *              clears and the battle is marked finished without a lesson.
 * Anything else (a malformed result) is a failed attempt of class `unknown`.
 *
 * Part 2 (P-OUT-2):
 *   • O7 — a failure reflect.js judged NOT counted (an account-wide refusal
 *     within the backstop: result.counted === false on an accountWide record)
 *     returns reflectionAttempts to its value before this attempt's claim, in
 *     this same write, and never finishes the battle — even at attempt 3;
 *   • O9 — a third-attempt failure that could not leave the game's no-lesson
 *     row (result.deferToRecovery) stays pending ONE more tick: the claim then
 *     finds the attempts spent and runs the no-call recovery pass, which
 *     always finishes the battle (recoveryPass: true ignores the deferral).
 */
export function reflectionBattleUpdate(result, { attempt, at, recoveryPass = false }) {
  if (result?.outcome === 'ok') {
    return { pendingReflection: false, reflectedAt: at, reflectionOutcome: result.record };
  }
  if (result?.outcome === 'skipped') {
    return { pendingReflection: false, reflectedAt: at };
  }
  const record = result?.outcome === 'failed' && result.record
    ? result.record
    : buildReflectionOutcome({ outcome: 'failed', failureClass: 'unknown', attempt, at });
  if (result?.outcome === 'failed' && result.counted === false && record.accountWide === true) {
    return { reflectionOutcome: record, reflectionAttempts: Math.max(0, attempt - 1) };
  }
  const deferred = result?.outcome === 'failed' && result.deferToRecovery === true && recoveryPass !== true;
  if (attempt >= MAX_REFLECTION_ATTEMPTS && !deferred) {
    return { reflectionOutcome: record, pendingReflection: false, reflectionNoLesson: true };
  }
  return { reflectionOutcome: record };
}
