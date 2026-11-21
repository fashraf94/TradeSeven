// api/_utils/filmRoom/debriefModelCall.js
//
// Film Room D2 — THE MODEL CALL (D2 spec §3; DW-8, the founder's FD-4). The Film Room's ONE importer of the Anthropic
// SDK. It follows api/_utils/sharedResearch/modelTurn.js (read as the pattern, not imported):
//   * ONE structured-output request (`output_config.format`, the prompt's JSON schema), effort low, thinking off in the
//     model's own form — `claude-sonnet-5-5` refuses `{type: 'disabled'}` and turns thinking off with
//     `{type: 'between_tools'}` (accepted at effort high or below); `claude-haiku-5-5` takes `{type: 'disabled'}` —,
//     at most DEBRIEF_MAX_OUTPUT_TOKENS, the SDK's own retries off (`maxRetries: 0`) so `attempts` is true;
//   * ONE TRANSPORT RETRY — a network error or an overload (529) — inside the deadline; never a second ask after an
//     answer, good or bad (DW-5: the model is asked once per battle day);
//   * the deadline: the call is aborted at `deadlineAt` and answers `deadline`;
//   * `usage` and `costUsd` from the published prices (MODEL_PRICES, PRICES_AS_OF);
//   * the key is CLAUDE_API_KEY, read when the client is first built — never printed, never logged.
// The model id is named in ONE place, DEBRIEF_MODEL (DW-8); Haiku 5.5 is priced beside it, a one-line switch.
//
// The answer's reason when it is not ok — the record's `reason` (§6): `model_error_<status>` / `model_error_network`
// (no answer after the retry), `model_error_refusal` (the model declined), `model_error_max_tokens` (the output was cut
// off), `deadline` (aborted at the deadline), `parse` (an answer that is not JSON). A JSON answer of the wrong shape is
// the checks' `parse` (debriefChecks.js).

import Anthropic from '@anthropic-ai/sdk';

/** DW-8: the one model id the nightly job calls. */
export const DEBRIEF_MODEL = 'claude-sonnet-5-5';
/** The two models priced here — the job's, and Haiku 5.5, a one-line switch (the sample pack runs both). */
export const DEBRIEF_MODELS = Object.freeze(['claude-sonnet-5-5', 'claude-haiku-5-5']);
/** §3: at most 800 output tokens. */
export const DEBRIEF_MAX_OUTPUT_TOKENS = 800;
export const EFFORT = 'low';
/** Thinking off, in each model's own form (modelTurn.js's THINKING). */
export const THINKING_OFF = Object.freeze({
  'claude-sonnet-5-5': Object.freeze({ type: 'between_tools' }),
  'claude-haiku-5-5': Object.freeze({ type: 'disabled' }),
});
/**
 * Anthropic's published first-party prices, USD per million tokens: Claude Sonnet 5.5 $2 input / $10 output; Claude
 * Haiku 5.5 $0.10 / $0.50 for prompts up to 100K tokens (a digest is a few thousand). The claude-api reference's model
 * table, read on the date below — the same rows as modelTurn.js's (its PRICES_AS_OF 2026-11-12). Cache reads and writes
 * are not priced: no request sets cache_control.
 */
export const PRICES_AS_OF = '2026-11-21';
export const MODEL_PRICES = Object.freeze({
  'claude-sonnet-5-5': Object.freeze({ inputPerMTok: 2, outputPerMTok: 10 }),
  'claude-haiku-5-5': Object.freeze({ inputPerMTok: 0.1, outputPerMTok: 0.5 }),
});
/** A retry needs at least this much of the deadline left. */
export const RETRY_MIN_REMAINING_MS = 6_000;

/** The call's cost in USD (to a millionth), or null when the model has no price row or the usage is not known. */
export function costUsd(model, usage) {
  const p = MODEL_PRICES[model];
  if (!p) return null;
  const input = usage?.input;
  const output = usage?.output;
  if (!Number.isSafeInteger(input) || !Number.isSafeInteger(output)) return null;
  return Math.round((input * p.inputPerMTok) + (output * p.outputPerMTok)) / 1_000_000;
}

let client = null;
/** The SDK client, built once: the key from the environment, the SDK's retries off. */
export function debriefClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY, maxRetries: 0 });
  return client;
}
/** Tests only: forget the built client. */
export function resetDebriefClient() { client = null; }

const isAbort = (err, signal) => signal?.aborted === true || err?.name === 'AbortError' || /abort/i.test(String(err?.name ?? '')) || err?.constructor?.name === 'APIUserAbortError';
/** A network error (no HTTP status) or an overload — the one kind of failure worth one more try. */
const isTransport = (err) => !Number.isInteger(err?.status) || err.status === 529;

/** The request body (§3), exactly. */
export function debriefRequestBody({ model = DEBRIEF_MODEL, system, user, schema }) {
  return {
    model,
    max_tokens: DEBRIEF_MAX_OUTPUT_TOKENS,
    thinking: { ...THINKING_OFF[model] },
    output_config: { effort: EFFORT, format: { type: 'json_schema', schema } },
    system,
    messages: [{ role: 'user', content: user }],
  };
}

/**
 * The one model call for one battle day.
 * @param {object} p
 * @param {string} p.system
 * @param {string} p.user
 * @param {object} p.schema
 * @param {string} [p.model]       DEBRIEF_MODEL unless the sample pack asks for another priced model
 * @param {number} [p.deadlineAt]  epoch ms the call must finish by: aborted there (`deadline`); a retry needs RETRY_MIN_REMAINING_MS of it
 * @param {Function} [p.create]    test seam: (body, opts) => response
 * @param {() => number} [p.now]
 * @returns {Promise<{ ok: boolean, output?: object, reason?: string, usage: {input:number,output:number}|null, model: string, attempts: number, elapsedMs: number, costUsd: number|null, stopReason: string|null }>}
 */
export async function runDebriefCall({ system, user, schema, model = DEBRIEF_MODEL, deadlineAt = null, create = null, now = Date.now }) {
  if (!MODEL_PRICES[model] || !THINKING_OFF[model]) throw new Error(`debrief: no model ${model}`);
  const send = create || ((body, opts) => debriefClient().messages.create(body, opts));
  const body = debriefRequestBody({ model, system, user, schema });
  const started = now();
  const abort = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = abort && Number.isFinite(deadlineAt) ? setTimeout(() => abort.abort(), Math.max(0, deadlineAt - now())) : null;
  const done = (fields) => ({ usage: null, model, costUsd: null, stopReason: null, ...fields, elapsedMs: now() - started });
  let attempts = 0;
  let response = null;
  let lastErr = null;
  try {
    while (attempts < 2) {
      attempts += 1;
      try {
        response = await send(body, abort ? { signal: abort.signal } : {});
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        if (isAbort(err, abort?.signal)) return done({ ok: false, reason: 'deadline', attempts });
        const roomLeft = deadlineAt === null || deadlineAt - now() >= RETRY_MIN_REMAINING_MS;
        if (attempts >= 2 || !isTransport(err) || !roomLeft) break;
      }
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!response) return done({ ok: false, reason: `model_error_${Number.isInteger(lastErr?.status) ? lastErr.status : 'network'}`, attempts });
  const usage = Number.isSafeInteger(response?.usage?.input_tokens) && Number.isSafeInteger(response?.usage?.output_tokens)
    ? { input: response.usage.input_tokens, output: response.usage.output_tokens }
    : null;
  const base = { usage, costUsd: costUsd(model, usage), stopReason: response?.stop_reason ?? null, attempts };
  if (base.stopReason === 'refusal') return done({ ...base, ok: false, reason: 'model_error_refusal' });
  if (base.stopReason === 'max_tokens') return done({ ...base, ok: false, reason: 'model_error_max_tokens' });
  const text = (Array.isArray(response?.content) ? response.content : []).filter((b) => b?.type === 'text').map((b) => b.text).join('');
  try {
    return done({ ...base, ok: true, output: JSON.parse(text) });
  } catch {
    return done({ ...base, ok: false, reason: 'parse' });
  }
}
