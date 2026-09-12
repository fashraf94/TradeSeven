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

// Prompt-build ceiling (Sep 2026 transport hygiene). The backstop above is now
// armed AFTER the prompt is built, so the build needs a bound of its own: a
// hung Firestore read inside fetchInstitutionalContext would otherwise hold the
// serial battle loop until Vercel kills the function at 300s, taking every
// later battle's tick and this battle's write with it. A typical build is
// sub-second; an agent with institutional rules adds ⌈(held+bench)/10⌉
// sequential Firestore batches, which is the only shape that gets near this.
//
// SCOPE, stated so this is not read as more than it is: it bounds the DECIDER'S
// build only — the one call whose result is sent to the model. The shadow
// capture rebuilds the same block twice more per tick (shadowAssemblyCapture.js
// buildShadowDiffRecord, both awaited before battleRef.update), and those two
// are NOT bounded by this constant. A Firestore hang there still costs the
// write. Bounding them is a separate task; it is not fixed here.
//
// REVISIT once `buildMs` has a week of production data.
export const PROMPT_BUILD_CEILING_MS = 10_000;

// The name the prompt-build race's rejection carries. ONE source, shared by the
// thrower (agent-evaluate.js) and the two matchers below, so they cannot drift.
export const PROMPT_BUILD_TIMEOUT_ERROR_NAME = 'PromptBuildTimeoutError';

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
 * 'build_timeout' (Sep 2026) is the ONE class that names a failure before the
 * call: the prompt build blew PROMPT_BUILD_CEILING_MS and no request was ever
 * sent. It is checked FIRST so a future message change there can never fall
 * into the timeout arm below.
 *
 * 'timeout' covers: the SDK's per-request timeout after zero retries
 * (APIConnectionTimeoutError), the cron's 22s AbortController backstop
 * (APIUserAbortError), native AbortError, and timeout-shaped messages. The two
 * stay ONE class — every consumer of the class is unchanged; which of them
 * fired is carried separately by classifyTimeoutKind below.
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

  if (ctorName === PROMPT_BUILD_TIMEOUT_ERROR_NAME || err.name === PROMPT_BUILD_TIMEOUT_ERROR_NAME) {
    return 'build_timeout';
  }

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
 * WHICH timeout fired — the split classifyHaikuFailure deliberately does not
 * make (Sep 2026 transport hygiene; Phase 0 §3.3 recorded that by failureClass
 * alone the two were indistinguishable, and only haikuError.message separated
 * them).
 *
 *   'sdk'      — the SDK's own per-request timeout (20s). APIConnectionTimeoutError,
 *                message 'Request timed out.'
 *   'backstop' — the cron's AbortController ceiling (22s). APIUserAbortError,
 *                a native AbortError, message 'Request was aborted.'
 *   null       — not a transport timeout at all (a build timeout, a status
 *                error, a truncated response, anything else).
 *
 * Keyed on constructor.name first, per the module header's SDK quirk: the SDK's
 * error classes leave `.name` at 'Error'. Persisted as haikuError.timeoutKind;
 * every existing reader of failureClass is untouched.
 *
 * @param {Error|null|undefined} err
 * @returns {'sdk'|'backstop'|null}
 */
export function classifyTimeoutKind(err) {
  if (!err) return null;
  const ctorName = err.constructor?.name || '';
  const msg = String(err.message || '');

  // The build ceiling is not a transport timeout — checked first so its message
  // can never be read as one.
  if (ctorName === PROMPT_BUILD_TIMEOUT_ERROR_NAME || err.name === PROMPT_BUILD_TIMEOUT_ERROR_NAME) return null;

  // BOTH class checks before EITHER message check. The class is the strong
  // signal and the messages are the fallback for an SDK build that stops
  // exporting them; interleaving the two mis-reads a backstop abort whose
  // message happens to mention a timeout ('Request was aborted due to
  // timeout') as 'sdk' — the exact discrimination this function exists for.
  if (ctorName === 'APIConnectionTimeoutError') return 'sdk';
  if (ctorName === 'APIUserAbortError' || err.name === 'AbortError') return 'backstop';

  if (/request was aborted/i.test(msg)) return 'backstop';
  if (/timed? ?out/i.test(msg)) return 'sdk';
  return null;
}

/**
 * Pre-call budget guard (Phase 1.2): may the evaluation engine start now
 * without risking the function's kill window and losing the awaited
 * finalUpdate?
 *
 * Required remaining = prompt-build ceiling (10s) + call ceiling (22s hard
 * abort) + post-call allowance (12s) = 44s against TIME_BUDGET_MS. It was 34s
 * until Sep 2026, when the backstop moved to after the build: the build is now
 * a bounded phase that runs SEQUENTIALLY BEFORE the call rather than inside its
 * ceiling, so the guard must reserve room for it. The requirement is the sum of
 * the three named constants and never a literal — a future ceiling change moves
 * it here, once. `budget_skipped` semantics are unchanged: the engine was never
 * attempted, the normal write path still runs.
 *
 * @param {Object} p
 * @param {number} p.elapsedMs - ms since the cron handler started
 * @param {number} p.timeBudgetMs - the handler's soft budget (TIME_BUDGET_MS)
 * @param {number} [p.promptBuildCeilingMs]
 * @param {number} [p.callCeilingMs]
 * @param {number} [p.postCallAllowanceMs]
 * @returns {{ proceed: boolean, remainingMs: number, requiredMs: number }}
 */
export function shouldStartHaikuCall({
  elapsedMs,
  timeBudgetMs,
  promptBuildCeilingMs = PROMPT_BUILD_CEILING_MS,
  callCeilingMs = HAIKU_CALL_CEILING_MS,
  postCallAllowanceMs = HAIKU_POST_CALL_ALLOWANCE_MS,
}) {
  const remainingMs = timeBudgetMs - elapsedMs;
  const requiredMs = promptBuildCeilingMs + callCeilingMs + postCallAllowanceMs;
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
