// api/_utils/gemmaClient.js
// Shared helpers for calling the Voice Layer model (Gemma via OpenRouter) and
// parsing its JSON-shaped responses.
//
// Extracted from api/agent/chat.js so the battle-chat endpoint and the Forge
// workshop-chat endpoint can share the same call/parse/sanitize plumbing
// without duplicating behavior.
//
// Exports:
//   callGemmaVoice({ systemPrompt, conversationHistory, userMessage, signal })
//     — Fires one POST to OpenRouter with the shared Gemma config, returns
//       the raw assistant content string. Caller is responsible for parsing.
//       THROWS on any failure (HTTP error, malformed JSON, missing content).
//       An abort ALWAYS throws with `name === 'AbortError'`, whether the signal
//       fired before the headers arrived or during the body read — callers
//       classify timeouts on that name, so it is part of the contract.
//       Kept for backward compatibility with api/agent/chat.js.
//   callGemmaVoiceWithRetry(options)
//     — Same call, but with a single retry on transient errors (429/5xx,
//       network errors, malformed JSON). Returns a STRUCTURED result:
//         { success: true, content: '...' }
//         { success: false, error: '...', fallbackResponse: null, aborted?: true }
//       `aborted: true` is set for EVERY abort, including one that fires while
//       the response body is still arriving — callers gate their timeout
//       response on that flag.
//       Never throws except if options.signal was aborted before the call.
//   parseVoiceLayerResponse(rawText)
//     — 4-tier JSON extractor with a safe plaintext fallback. Returns an
//       object shaped like the Voice Layer OUTPUT_FORMAT schema.
//
// Design contracts:
//   * callGemmaVoice / callGemmaVoiceWithRetry never touch Firestore or
//     Gemma-specific state — pure HTTP helpers. Timeouts and abort handling
//     are the caller's job (pass an AbortSignal).
//   * parseVoiceLayerResponse ALWAYS returns an object with at least a
//     `response` string. It never throws.

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GEMMA_MODEL = 'google/gemma-4-26b-a4b-it';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 800;

// Transient HTTP statuses worth retrying once. 400/401/403/404 are config
// errors — retrying is pointless and wastes budget.
const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRY_BACKOFF_MS = 2000;

/**
 * True when an error is an abort (a fired AbortSignal), whatever its class.
 * undici/Node reject with a DOMException named 'AbortError'; the name is the
 * stable, cross-runtime marker, and is what every consumer already tests.
 */
export function isAbortError(err) {
  return err?.name === 'AbortError';
}

/**
 * Normalize an abort into an Error whose `name` is 'AbortError', so callers can
 * classify it uniformly. Errors that already carry that name pass through
 * untouched (preserving the original stack).
 */
function asAbortError(err) {
  if (isAbortError(err)) return err;
  // `cause` keeps the original class and stack — for a TimeoutError or a custom
  // abort reason that is the only record of WHY the call aborted.
  const e = new Error(err?.message || 'This operation was aborted', { cause: err });
  e.name = 'AbortError';
  return e;
}

/**
 * Internal: single attempt. Returns a structured result instead of throwing
 * for HTTP / parsing failures. Still propagates AbortError and network errors
 * (caller decides whether to retry).
 *
 * @returns {Promise<{ok:true, content:string} | {ok:false, status:number|null, errorText:string}>}
 */
async function _callGemmaOnce({
  systemPrompt,
  conversationHistory,
  userMessage,
  signal,
  temperature,
  maxTokens,
}) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...(conversationHistory || []),
    { role: 'user', content: userMessage },
  ];

  // Model-latency instrumentation (Sep 3 2026 voice-timeout incident). Nothing
  // on this path recorded how long the model actually took, so no p50/p95 could
  // be read before or after a timeout change — the fix was unverifiable. One
  // structured line per ATTEMPT, at every exit, tagged with the outcome so a
  // successful p95 can be separated from a timed-out one. Machine-readable on
  // purpose: `[gemmaClient] gemma_latency {json}` greps cleanly out of Vercel
  // logs, and unlike the shadow record it does not depend on GCS_CREDENTIALS.
  const startedAt = Date.now();
  const emitLatency = (outcome, status) => {
    console.log('[gemmaClient] gemma_latency ' + JSON.stringify({
      ms: Date.now() - startedAt,
      outcome,                       // ok | timeout | network_error | http_error | invalid_json | no_content
      status: status ?? null,
      model: GEMMA_MODEL,
      maxTokens,
    }));
  };

  // The OTHER abort window: when the signal fires before any response headers
  // arrive, fetch itself rejects (already a real AbortError, so classification
  // was never broken here — only the body-read window below was). Caught solely
  // to time it, then rethrown untouched.
  let response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://fantasytrades.io',
        'X-Title': 'FantasyTrades Voice Layer',
      },
      body: JSON.stringify({
        model: GEMMA_MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      }),
      signal,
    });
  } catch (fetchErr) {
    // Same test as the two body-read windows below. A bare isAbortError check
    // here would classify the SAME abort differently depending on which window
    // it landed in — `abort(reason)` and AbortSignal.timeout() surface as
    // 'Error' / 'TimeoutError' on this path but as 'AbortError' on the body
    // path. No caller uses either form today; the symmetry is what keeps that
    // true if one starts.
    if (isAbortError(fetchErr) || signal?.aborted) {
      emitLatency('timeout', null);
      throw asAbortError(fetchErr);
    }
    emitLatency('network_error', null);
    throw fetchErr;
  }

  if (!response.ok) {
    // The SIBLING body-read window. `.text()` is a body read too, so an abort
    // that fires here was being erased into errorText:'unknown' and escaping as
    // a plain Error with no `aborted` flag — byte-for-byte the incident this
    // module was just fixed for, on the branch above the fix. The likely
    // production shape is a 429 retry whose deadline expires on attempt 2:
    // the retry loop's signal check runs only BEFORE an attempt, so the last
    // attempt was never re-checked. Classify here, at the read.
    let errorText;
    try {
      errorText = await response.text();
    } catch (textErr) {
      if (isAbortError(textErr) || signal?.aborted) {
        console.error('[gemmaClient] Voice call timed out while reading the error body (abort during body read)');
        emitLatency('timeout', response.status);
        throw asAbortError(textErr);
      }
      errorText = 'unknown';
    }
    emitLatency('http_error', response.status);
    return {
      ok: false,
      status: response.status,
      errorText: String(errorText).slice(0, 300),
    };
  }

  let data;
  try {
    data = await response.json();
  } catch (jsonErr) {
    // ABORT vs MALFORMED JSON — these are different failures and must not share
    // an error shape. A `signal` on fetch covers the WHOLE request, body read
    // included, so a timeout that fires while the body is still arriving lands
    // HERE, not on the fetch itself: the response resolved (headers arrived,
    // status 200) and it is `.json()` that rejects with an AbortError.
    //
    // This catch was written for malformed JSON. Left undistinguished it
    // rewrote the abort as `OpenRouter 200: Invalid JSON from OpenRouter: This
    // operation was aborted` — a plain Error whose `name` is 'Error'. Every
    // consumer that classifies by AbortError then failed to see a timeout:
    // api/agent/chat.js took its 500 branch instead of its 504 (so the client
    // rendered "Agent is thinking too hard" instead of the truthful "Agent took
    // too long"), the shadow log filed `handler_exception` instead of
    // `gemma_timeout`, and the eight callGemmaVoiceWithRetry callers never got
    // `aborted:true` (so they answered HTTP 200 on a failed turn).
    //
    // Rethrowing preserves name === 'AbortError' and is what makes BOTH existing
    // classification paths work unchanged: callGemmaVoice propagates it to its
    // caller's own AbortError check, and callGemmaVoiceWithRetry's catch maps it
    // to { aborted: true }. Sep 3 2026 voice-timeout incident.
    if (isAbortError(jsonErr) || signal?.aborted) {
      console.error('[gemmaClient] Voice call timed out while reading the response body (abort during body read)');
      emitLatency('timeout', response.status);
      throw asAbortError(jsonErr);
    }
    emitLatency('invalid_json', response.status);
    return {
      ok: false,
      status: response.status,
      errorText: `Invalid JSON from OpenRouter: ${jsonErr.message || 'parse failed'}`,
    };
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    emitLatency('no_content', response.status);
    return {
      ok: false,
      status: response.status,
      errorText: 'OpenRouter response missing choices[0].message.content',
    };
  }

  emitLatency('ok', response.status);
  return { ok: true, content };
}

/**
 * Call the Voice Layer model (Gemma via OpenRouter) with a structured prompt.
 *
 * Legacy throwing signature — kept for api/agent/chat.js. Prefer
 * callGemmaVoiceWithRetry for new callers.
 *
 * @returns {Promise<string>} raw assistant content (expected JSON string)
 */
export async function callGemmaVoice({
  systemPrompt,
  conversationHistory,
  userMessage,
  signal,
  temperature = DEFAULT_TEMPERATURE,
  maxTokens = DEFAULT_MAX_TOKENS,
}) {
  const result = await _callGemmaOnce({
    systemPrompt,
    conversationHistory,
    userMessage,
    signal,
    temperature,
    maxTokens,
  });

  if (!result.ok) {
    throw new Error(`OpenRouter ${result.status ?? 'unknown'}: ${result.errorText}`);
  }
  return result.content;
}

/**
 * Call Gemma with ONE retry on transient failures.
 *
 * Retries on: 429, 500, 502, 503, 504; network errors; malformed JSON.
 * Does NOT retry on: 400, 401, 403, 404 (config errors), AbortError.
 *
 * @param {Object} options — same as callGemmaVoice
 * @returns {Promise<{success:true, content:string} | {success:false, error:string, fallbackResponse:null, aborted?:boolean}>}
 */
export async function callGemmaVoiceWithRetry(options) {
  const {
    signal,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS,
  } = options || {};

  const MAX_ATTEMPTS = 2; // initial + 1 retry

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Bail early if caller already aborted
    if (signal?.aborted) {
      return {
        success: false,
        error: 'Request aborted before call',
        aborted: true,
        fallbackResponse: null,
      };
    }

    let result;
    try {
      result = await _callGemmaOnce({
        ...options,
        temperature,
        maxTokens,
      });
    } catch (err) {
      if (isAbortError(err)) {
        return {
          success: false,
          error: 'Request aborted',
          aborted: true,
          fallbackResponse: null,
        };
      }
      // Network-level error — treat as transient
      if (attempt < MAX_ATTEMPTS) {
        console.warn(`[gemmaClient] Network error on attempt ${attempt}: ${err?.message}; retrying in ${RETRY_BACKOFF_MS}ms`);
        await _delay(RETRY_BACKOFF_MS, signal);
        continue;
      }
      return {
        success: false,
        error: `Network error contacting OpenRouter: ${String(err?.message || err).slice(0, 200)}`,
        fallbackResponse: null,
      };
    }

    if (result.ok) {
      return { success: true, content: result.content };
    }

    // HTTP-level error — retry only if transient
    const isTransient = result.status == null || TRANSIENT_STATUSES.has(result.status);
    if (isTransient && attempt < MAX_ATTEMPTS && !signal?.aborted) {
      console.warn(`[gemmaClient] Transient ${result.status} on attempt ${attempt}: ${result.errorText}; retrying in ${RETRY_BACKOFF_MS}ms`);
      await _delay(RETRY_BACKOFF_MS, signal);
      continue;
    }

    // Last-attempt abort re-check. The loop's signal guard runs only BEFORE an
    // attempt, so an abort that lands after the final attempt's body read (a
    // non-transient status, nothing thrown) would otherwise return with no
    // `aborted` flag — and every caller gating on it would answer 200 on a
    // timed-out turn.
    if (signal?.aborted) {
      return { success: false, error: 'Request aborted', aborted: true, fallbackResponse: null };
    }
    return {
      success: false,
      error: `OpenRouter ${result.status ?? 'unknown'}: ${result.errorText}`.slice(0, 300),
      fallbackResponse: null,
    };
  }

  // Unreachable — defensive fallback
  return {
    success: false,
    error: 'Retry logic exhausted without resolution',
    fallbackResponse: null,
  };
}

/**
 * Abort-aware delay. Resolves early if the signal aborts mid-wait.
 */
function _delay(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true }
      );
    }
  });
}

/**
 * Parse a Voice Layer response. Attempts, in order:
 *   1. Direct JSON.parse
 *   2. Extract fenced ```json ... ``` block
 *   3. Extract the first {...} block
 *   4. Structured parse failure
 *
 * Tiers 1-3 return Gemma's parsed JSON object. Tier 4 returns a structured
 * parse-failure shape: `{ parseError: true, errorReason, rawText }`. Callers
 * MUST detect `parseError === true` and route to their own structured-error
 * path — never trust top-level fields when parseError is set, and never echo
 * `rawText` back to the user (Gemma's plain-text failure modes leak otherwise).
 *
 * Background: previously this returned `{ response: cleanedText || '...' }`
 * which let Gemma's natural-language failure responses flow through verbatim
 * as agentMessage in callers that didn't shape-check. See
 * api/forge/expand-signal.js:isExpansionShape for the original defensive
 * pattern; this contract change generalizes that defense to all callers.
 *
 * Never throws.
 *
 * @param {string} rawText
 * @returns {Object} parsed Gemma JSON OR { parseError: true, errorReason, rawText }
 */
export function parseVoiceLayerResponse(rawText) {
  // Guard against non-string inputs. JSON.parse(null) returns null without
  // throwing (null coerces to "null"), which would skip the tier-4 fallback
  // and leak a null reference to callers. Force the empty_content path here.
  if (typeof rawText !== 'string') {
    return {
      parseError: true,
      errorReason: 'empty_content',
      rawText: '',
    };
  }

  // Try direct JSON parse
  try {
    return JSON.parse(rawText);
  } catch { /* fall through */ }

  // Try extracting from ```json ... ``` blocks
  const fencedMatch = rawText.match(/```json\s*([\s\S]*?)```/);
  if (fencedMatch) {
    try {
      return JSON.parse(fencedMatch[1]);
    } catch { /* fall through */ }
  }

  // Try extracting any {...} object
  const objectMatch = rawText.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch { /* fall through */ }
  }

  // Tier 4: structured parse failure. Distinguish empty content from
  // plain-text passthrough so callers and shadow logs can tell whether
  // Gemma returned nothing vs. returned natural language outside JSON.
  const cleanedText = rawText.replace(/```[\s\S]*?```/g, '').trim();
  return {
    parseError: true,
    errorReason: cleanedText ? 'plaintext_passthrough' : 'empty_content',
    rawText,
  };
}
