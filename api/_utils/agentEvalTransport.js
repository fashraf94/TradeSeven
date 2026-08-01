// api/_utils/agentEvalTransport.js
// Pure helpers for the Haiku mid-battle eval transport layer (June 2026
// reliability fix — L1/L2/L3 locks). No I/O, no SDK imports: classification
// matches on constructor.name / message because the SDK's error classes do
// not set `.name` (verified against @anthropic-ai/sdk 0.71.2:
// `new APIConnectionTimeoutError().name === 'Error'`, message
// 'Request timed out.'; APIUserAbortError → 'Request was aborted.').

// Pre-call budget guard constants. 22s = the SDK's 20s per-request timeout
// plus the 2s AbortController backstop in agent-evaluate.js. 12s = post-call
// allowance: parallel narration dispatch (≤10s per Gemma call) + the awaited
// finalUpdate write + headroom — the same allowance the anticipation budget
// gate already uses (agent-evaluate.js finally block).
export const HAIKU_CALL_CEILING_MS = 22_000;
export const HAIKU_POST_CALL_ALLOWANCE_MS = 12_000;

// The mid-battle eval model — ONE exported source (P2 code-review finding:
// the literal had grown three copies — the live messages.create call plus
// the two behavior-record envelope capture sites — and the envelope exists
// precisely to record the model faithfully; a bump that missed a copy would
// corrupt effectiveRuntimeResolution.modelId, the provenance field A-1
// guarantees). Bump HERE and every call + capture site follows.
export const EVAL_MODEL_ID = 'claude-haiku-4-5-20251001';

// The mid-battle eval OUTPUT ceiling, ONE exported source (same discipline as
// EVAL_MODEL_ID). Raised 1024 → 2048 per the DR-13 truncation baseline (Jul
// 2026): recent production evals averaged ~907/1024 output tokens with ~21%
// exceeding 1024 — silently truncating the tail (the rationale /
// cited_forge_rules the receipts + Film Room render) while the early-emitted
// `decision` survived, so `truncated_response` never fired. True uncapped
// output reaches ~1421 (p99 ~1240); 2048 clears the observed distribution with
// headroom at a negligible realistic cost delta (output is content-bound, not
// cap-bound — the ceiling only un-truncates the ~21% tail).
export const EVAL_MAX_OUTPUT_TOKENS = 2048;

/**
 * Classify a Haiku transport failure for instrumentation (Phase 2).
 *
 * 'timeout' covers: the SDK's per-request timeout after zero retries
 * (APIConnectionTimeoutError), the cron's 22s AbortController backstop
 * (APIUserAbortError), native AbortError, and timeout-shaped messages.
 * HTTP errors classify by status ('429', '529', ...); everything else by
 * constructor/class name (e.g. 'APIConnectionError', 'TypeError').
 *
 * @param {Error|null|undefined} err
 * @returns {string} failure class
 */
export function classifyHaikuFailure(err) {
  if (!err) return 'unknown';
  const ctorName = err.constructor?.name || '';
  const msg = String(err.message || '');

  if (
    ctorName === 'APIConnectionTimeoutError' ||
    ctorName === 'APIUserAbortError' ||
    err.name === 'AbortError' ||
    /timed? ?out/i.test(msg) ||
    /request was aborted/i.test(msg)
  ) {
    return 'timeout';
  }

  if (err.status != null) return String(err.status);
  return ctorName || err.name || 'unknown';
}

/**
 * Pre-call budget guard (Phase 1.2): may a 20s-ceiling Haiku call start now
 * without risking the function's kill window and losing the awaited
 * finalUpdate? Required remaining = call ceiling (22s hard abort) + post-call
 * allowance (12s) = 34s against TIME_BUDGET_MS.
 *
 * @param {Object} p
 * @param {number} p.elapsedMs - ms since the cron handler started
 * @param {number} p.timeBudgetMs - the handler's soft budget (TIME_BUDGET_MS)
 * @param {number} [p.callCeilingMs]
 * @param {number} [p.postCallAllowanceMs]
 * @returns {{ proceed: boolean, remainingMs: number, requiredMs: number }}
 */
export function shouldStartHaikuCall({
  elapsedMs,
  timeBudgetMs,
  callCeilingMs = HAIKU_CALL_CEILING_MS,
  postCallAllowanceMs = HAIKU_POST_CALL_ALLOWANCE_MS,
}) {
  const remainingMs = timeBudgetMs - elapsedMs;
  const requiredMs = callCeilingMs + postCallAllowanceMs;
  return { proceed: remainingMs >= requiredMs, remainingMs, requiredMs };
}

/**
 * Degraded-mode disclosure counter lifecycle (Phase 3.1).
 *
 * 'success'        → reset to 0 (a real haikuResult arrived)
 * 'failure'        → increment (timeout / API error / truncated_response)
 * 'budget_skipped' → unchanged: a scheduling choice, not an engine fault —
 *                    the engine was never attempted, so the streak neither
 *                    grows nor resets.
 *
 * @param {number|null|undefined} prev - prior counter value
 * @param {'success'|'failure'|'budget_skipped'} outcome
 * @returns {number}
 */
export function nextConsecutiveEvalFailures(prev, outcome) {
  const base = Number.isFinite(prev) && prev > 0 ? prev : 0;
  if (outcome === 'success') return 0;
  if (outcome === 'failure') return base + 1;
  return base;
}
