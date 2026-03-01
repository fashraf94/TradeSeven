/**
 * Why Is It Moving? — POST endpoint
 *
 * Takes a stock symbol + context, calls Perplexity Sonar to explain
 * why the stock is moving, returns a structured explanation with citations.
 *
 * Request:  POST { symbol, name?, change?, price? }
 * Response: { success, data: { explanation, factors[], keyDataPoint, outlook, citations[], timestamp } }
 *
 * Caching: 30-minute server-side cache per symbol (NEWS tier).
 * Fallback: Returns basic price statement if Sonar fails.
 */

import { applySecurityMiddleware } from './_utils/security.js';
import { getFromCache, setInCache, CACHE_TIERS } from './_utils/serverCache.js';
import { querySonar } from './helpers/sonar.js';

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

const SYSTEM_PROMPT = `You are a financial news analyst. Given a stock symbol and its recent price movement, explain WHY it is moving based on the latest news and market events.

Respond ONLY with valid JSON in this exact format:
{
  "explanation": "2-3 sentence plain-English explanation of why the stock is moving",
  "factors": [
    { "direction": "up", "text": "Brief factor description" },
    { "direction": "down", "text": "Brief factor description" },
    { "direction": "neutral", "text": "Brief factor description" }
  ],
  "keyDataPoint": "One specific number or stat driving the move (e.g., 'Revenue beat estimates by 12%')",
  "outlook": "One sentence forward-looking statement"
}

Rules:
- "direction" must be "up", "down", or "neutral"
- Include 2-4 factors maximum
- Keep explanation conversational, not jargon-heavy
- keyDataPoint should be a concrete number when possible, or null if no specific data point
- If the stock has minimal news, say so honestly
- Do NOT invent information`;

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req, res) {
  console.log('[WhyMoving] Handler called with:', { symbol: req.body?.symbol, change: req.body?.change });

  // Security middleware (CORS, rate limiting, headers)
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 20, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol, name, change, price } = req.body || {};

  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing or invalid symbol' });
  }

  const cleanSymbol = symbol.toUpperCase().trim();

  // Check server cache (30-min TTL via NEWS tier)
  const cacheKey = `why_moving_${cleanSymbol}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    console.log(`[WhyMoving] Cache HIT for ${cleanSymbol}`);
    return res.status(200).json(cached);
  }

  // Build user prompt with available context
  const changeStr = typeof change === 'number'
    ? `${change >= 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(1)}%`
    : 'moving';
  const priceStr = typeof price === 'number' ? ` (current price: $${price.toFixed(2)})` : '';
  const nameStr = name ? ` (${name})` : '';

  const userPrompt = `Why is ${cleanSymbol}${nameStr} ${changeStr} today${priceStr}?`;

  try {
    console.log(`[WhyMoving] Fetching for ${cleanSymbol}: ${changeStr}`);

    const { text, citations } = await querySonar(SYSTEM_PROMPT, userPrompt, {
      searchRecencyFilter: 'day',
      maxTokens: 800,
      temperature: 0.2,
    });

    // Parse JSON from Sonar response
    let parsed;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      // If JSON parsing fails, use raw text as explanation
      console.warn(`[WhyMoving] JSON parse failed for ${cleanSymbol}, raw text:`, text.slice(0, 200));
      parsed = {
        explanation: text.slice(0, 500),
        factors: [],
        keyDataPoint: null,
        outlook: null,
      };
    }

    const responseData = {
      success: true,
      data: {
        explanation: parsed.explanation || text.slice(0, 500),
        factors: Array.isArray(parsed.factors) ? parsed.factors.slice(0, 4) : [],
        keyDataPoint: parsed.keyDataPoint || null,
        outlook: parsed.outlook || null,
        citations: citations || [],
        timestamp: Date.now(),
      },
    };

    // Cache for 30 minutes
    setInCache(cacheKey, responseData, CACHE_TIERS.NEWS.memoryTTL);
    console.log(`[WhyMoving] Cached ${cleanSymbol} (${citations.length} citations)`);

    return res.status(200).json(responseData);
  } catch (error) {
    console.error(`[WhyMoving] Error for ${cleanSymbol}:`, error.message, error.stack);

    // Graceful fallback — return basic price statement instead of failing
    const fallbackExplanation = name
      ? `${name} (${cleanSymbol}) is ${changeStr} today.`
      : `${cleanSymbol} is ${changeStr} today.`;

    return res.status(200).json({
      success: true,
      data: {
        explanation: fallbackExplanation + ' Unable to fetch detailed explanation at this time.',
        factors: [],
        keyDataPoint: null,
        outlook: null,
        citations: [],
        timestamp: Date.now(),
      },
    });
  }
}
