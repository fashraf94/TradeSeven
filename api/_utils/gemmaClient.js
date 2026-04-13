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
//       Kept for backward compatibility with api/agent/chat.js.
//   callGemmaVoiceWithRetry(options)
//     — Same call, but with a single retry on transient errors (429/5xx,
//       network errors, malformed JSON). Returns a STRUCTURED result:
//         { success: true, content: '...' }
//         { success: false, error: '...', fallbackResponse: null, aborted?: true }
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

  const response = await fetch(OPENROUTER_URL, {
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

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown');
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
    return {
      ok: false,
      status: response.status,
      errorText: `Invalid JSON from OpenRouter: ${jsonErr.message || 'parse failed'}`,
    };
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    return {
      ok: false,
      status: response.status,
      errorText: 'OpenRouter response missing choices[0].message.content',
    };
  }

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
      if (err?.name === 'AbortError') {
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
    if (isTransient && attempt < MAX_ATTEMPTS) {
      console.warn(`[gemmaClient] Transient ${result.status} on attempt ${attempt}: ${result.errorText}; retrying in ${RETRY_BACKOFF_MS}ms`);
      await _delay(RETRY_BACKOFF_MS, signal);
      continue;
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
 *   4. Fall back to plain-text wrapping
 *
 * ALWAYS returns an object with a `response` string — never throws.
 *
 * @param {string} rawText
 * @returns {Object} parsed response object
 */
export function parseVoiceLayerResponse(rawText) {
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

  // Final fallback — treat raw text as response
  const cleanedText = (rawText || '').replace(/```[\s\S]*?```/g, '').trim();
  return {
    _scratchpad: null,
    response: cleanedText || 'I had trouble forming a response. Can you try again?',
    hasDirective: false,
    directive: null,
    suggestedActions: null,
  };
}
