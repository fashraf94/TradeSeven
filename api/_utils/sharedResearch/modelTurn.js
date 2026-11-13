// api/_utils/sharedResearch/modelTurn.js
//
// Shared Research — THE MODEL ADAPTER (spec D-SR-1, §6.3, §6.12 controls 1 and
// 5; K-3; §15 S-6). The one module that names a model id: MODELS. Every call is
// one structured-output request (`output_config.format`, the step or frame JSON
// schema) at `effort: 'low'` with thinking off, capped at MAX_OUTPUT_TOKENS.
//
// Thinking off, per model: `claude-sonnet-5-5` refuses `{type: 'disabled'}`
// (400) and turns thinking off with `{type: 'between_tools'}` (accepted at
// effort high or below); `claude-haiku-5-5` takes `{type: 'disabled'}` at effort
// high or below. The SDK (0.71.2) passes both through `messages.create`, as it
// passes `output_config` for the Huddle script (api/_utils/huddle/scriptPrompt.js).
//
// ONE MODEL TURN PER STEP (R5): a turn whose output fails validation is never
// re-asked. One TRANSPORT retry is allowed — a network error or an overload
// (529) — inside the caller's deadline, and counted in `attempts`. The SDK's own
// retries are off (`maxRetries: 0`) so `attempts` is true.
//
// The key is CLAUDE_API_KEY (the app's variable, §15 S-6), read when the client
// is first built — never printed, never logged.
//
// costUsd: from the provider's `usage` and MODEL_PRICES (USD per million
// tokens, Anthropic's published first-party prices, PRICES_AS_OF). A model with
// a null price row has a null cost, never a guessed one.

import Anthropic from '@anthropic-ai/sdk';

/** The current ids, in one place (D-SR-1). No legacy id anywhere in this build (modelTurn.test.js pins the shape). */
export const MODELS = Object.freeze({ step: 'claude-sonnet-5-5', frame: 'claude-haiku-5-5' });
export const MAX_OUTPUT_TOKENS = Object.freeze({ step: 2500, frame: 600 });
export const EFFORT = 'low';
/** No extended thinking (K-3), in each model's own form. */
export const THINKING = Object.freeze({ step: Object.freeze({ type: 'between_tools' }), frame: Object.freeze({ type: 'disabled' }) });
/**
 * Anthropic's published first-party prices, USD per million tokens (Claude
 * Sonnet 5.5 $2 / $10; Claude Haiku 5.5 $0.10 / $0.50 for prompts up to 100K
 * tokens — a step's prompt is capped at 16K). Source: Anthropic's model price
 * table as published on the date below.
 */
export const PRICES_AS_OF = '2026-11-03';
export const MODEL_PRICES = Object.freeze({
  'claude-sonnet-5-5': Object.freeze({ inputPerMTok: 2, outputPerMTok: 10 }),
  'claude-haiku-5-5': Object.freeze({ inputPerMTok: 0.1, outputPerMTok: 0.5 }),
});
/** A retry needs at least this much of the deadline left. */
export const RETRY_MIN_REMAINING_MS = 6_000;

/** The call's cost in USD (to a millionth), or null when the model has no price row or the usage is not known. */
export function costUsd(model, usage) {
  const p = MODEL_PRICES[model];
  if (!p || p.inputPerMTok === null || p.outputPerMTok === null) return null;
  const input = usage?.input;
  const output = usage?.output;
  if (!Number.isSafeInteger(input) || !Number.isSafeInteger(output)) return null;
  return Math.round(((input * p.inputPerMTok) + (output * p.outputPerMTok))) / 1_000_000;
}

let client = null;
function anthropic() {
  if (!client) client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY, maxRetries: 0 });
  return client;
}

const isAbort = (err, signal) => signal?.aborted === true || err?.name === 'AbortError' || /abort/i.test(String(err?.name ?? '')) || err?.constructor?.name === 'APIUserAbortError';
/** A network error (no HTTP status) or an overload — the one kind of failure worth one more try. */
const isTransport = (err) => !Number.isInteger(err?.status) || err.status === 529;

/**
 * One model turn.
 * @param {object} p
 * @param {'step'|'frame'} p.kind
 * @param {string} p.system
 * @param {string} p.user
 * @param {object} p.schema         the JSON schema the answer must satisfy
 * @param {AbortSignal} [p.signal]  aborts the call (the route's deadline)
 * @param {number} [p.deadlineAt]   epoch ms the turn must finish by (a retry needs RETRY_MIN_REMAINING_MS of it)
 * @param {Function} [p.create]     test seam: (body, opts) => response
 * @param {() => number} [p.now]
 * @returns {Promise<{ ok: boolean, output?: object, usage: {input:number,output:number}|null, model: string, attempts: number, elapsedMs: number, costUsd: number|null, stopReason: string|null, reason?: string, category?: string|null }>}
 */
export async function runTurn({ kind, system, user, schema, signal, deadlineAt = null, create = null, now = Date.now }) {
  const model = MODELS[kind];
  if (!model) throw new Error(`sharedResearch: no model for turn kind ${kind}`);
  const send = create || ((body, opts) => anthropic().messages.create(body, opts));
  const body = {
    model,
    max_tokens: MAX_OUTPUT_TOKENS[kind],
    thinking: { ...THINKING[kind] },
    output_config: { effort: EFFORT, format: { type: 'json_schema', schema } },
    system,
    messages: [{ role: 'user', content: user }],
  };
  const started = now();
  let attempts = 0;
  let response = null;
  let lastErr = null;
  while (attempts < 2) {
    attempts += 1;
    try {
      response = await send(body, { signal });
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      if (isAbort(err, signal)) {
        return { ok: false, reason: 'aborted', usage: null, model, attempts, elapsedMs: now() - started, costUsd: null, stopReason: null };
      }
      const roomLeft = deadlineAt === null || deadlineAt - now() >= RETRY_MIN_REMAINING_MS;
      if (attempts >= 2 || !isTransport(err) || !roomLeft) break;
    }
  }
  const elapsedMs = now() - started;
  if (!response) {
    return { ok: false, reason: `model_error_${Number.isInteger(lastErr?.status) ? lastErr.status : 'network'}`, usage: null, model, attempts, elapsedMs, costUsd: null, stopReason: null };
  }
  const usage = Number.isSafeInteger(response?.usage?.input_tokens) && Number.isSafeInteger(response?.usage?.output_tokens)
    ? { input: response.usage.input_tokens, output: response.usage.output_tokens }
    : null;
  const base = { usage, model, attempts, elapsedMs, costUsd: costUsd(model, usage), stopReason: response?.stop_reason ?? null };
  if (base.stopReason === 'refusal') return { ...base, ok: false, reason: 'model_refusal', category: response?.stop_details?.category ?? null };
  if (base.stopReason === 'max_tokens') return { ...base, ok: false, reason: 'output_cut_off' };
  const text = (Array.isArray(response?.content) ? response.content : []).filter((b) => b?.type === 'text').map((b) => b.text).join('');
  try {
    return { ...base, ok: true, output: JSON.parse(text) };
  } catch {
    return { ...base, ok: false, reason: 'unparseable_output' };
  }
}
