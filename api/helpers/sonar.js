/**
 * Shared Perplexity Sonar API helper
 *
 * Reusable wrapper around Perplexity's chat completions API.
 * Used by: api/why-moving.js (Session 1), and future endpoints
 * (Market Pulse, Calendar, Sector Insights).
 *
 * No caching — callers handle their own caching strategies.
 */

// =============================================================================
// RATE LIMITER (module-level, 50 calls/min sliding window)
// =============================================================================

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_CALLS = 50;
const callTimestamps = [];

function checkRateLimit() {
  const now = Date.now();
  // Remove timestamps outside the window
  while (callTimestamps.length > 0 && callTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
    callTimestamps.shift();
  }
  if (callTimestamps.length >= RATE_LIMIT_MAX_CALLS) {
    return false;
  }
  callTimestamps.push(now);
  return true;
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

/**
 * Query Perplexity Sonar with real-time web search.
 *
 * @param {string} systemPrompt - System message for the model
 * @param {string} userPrompt   - User query
 * @param {Object} [options]
 * @param {string} [options.model='sonar']              - Perplexity model ID
 * @param {number} [options.maxTokens=1000]              - Max output tokens
 * @param {number} [options.temperature=0.2]             - Sampling temperature
 * @param {string} [options.searchRecencyFilter]         - 'day' | 'week' | 'month'
 * @param {string[]} [options.searchDomainFilter]        - Domains to prefer
 *
 * @returns {Promise<{ text: string, citations: string[], usage: Object }>}
 * @throws {Error} If API key is missing, rate limited, or API call fails
 */
export async function querySonar(systemPrompt, userPrompt, options = {}) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY not configured');
  }

  if (!checkRateLimit()) {
    throw new Error('Sonar rate limit exceeded (50/min). Try again shortly.');
  }

  const {
    model = 'sonar',
    maxTokens = 1000,
    temperature = 0.2,
    searchRecencyFilter,
    searchDomainFilter,
  } = options;

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature,
  };

  if (searchRecencyFilter) {
    body.search_recency_filter = searchRecencyFilter;
  }

  if (searchDomainFilter && searchDomainFilter.length > 0) {
    body.search_domain_filter = searchDomainFilter;
  }

  console.log(`[Sonar] Querying model=${model}, recency=${searchRecencyFilter || 'none'}, tokens=${maxTokens}`);

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error(`[Sonar] API error ${response.status}:`, errorText);
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();

  const text = data.choices?.[0]?.message?.content || '';
  const citations = data.citations || [];
  const usage = data.usage || {};

  console.log(`[Sonar] Response: ${text.length} chars, ${citations.length} citations`);

  return { text, citations, usage };
}
