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
//   parseVoiceLayerResponse(rawText)
//     — 4-tier JSON extractor with a safe plaintext fallback. Returns an
//       object shaped like the Voice Layer OUTPUT_FORMAT schema.
//
// Design contracts:
//   * callGemmaVoice never touches Firestore or Gemma-specific state — it is
//     a pure HTTP helper. Timeouts and abort handling are the caller's job
//     (pass an AbortSignal).
//   * parseVoiceLayerResponse ALWAYS returns an object with at least a
//     `response` string. It never throws.

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GEMMA_MODEL = 'google/gemma-4-26b-a4b-it';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 800;

/**
 * Call the Voice Layer model (Gemma via OpenRouter) with a structured prompt.
 *
 * @param {Object} options
 * @param {string} options.systemPrompt — The full assembled system prompt
 * @param {Array<{role: 'user'|'assistant', content: string}>} options.conversationHistory
 * @param {string} options.userMessage — The current user message
 * @param {AbortSignal} [options.signal] — Optional abort signal from caller
 * @param {number} [options.temperature] — Override temperature (default 0.7)
 * @param {number} [options.maxTokens] — Override max_tokens (default 800)
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
    throw new Error(`OpenRouter ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
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
