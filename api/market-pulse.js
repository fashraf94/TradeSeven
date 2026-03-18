// api/market-pulse.js
// Market Pulse endpoint — real-time AI-synthesized market headlines via Perplexity Sonar
// Powers the MarketPulseCard on both mobile and desktop Research views

import { querySonar } from './helpers/sonar.js';
import { applySecurityMiddleware } from './_utils/security.js';
import { requireAuth } from './_utils/authMiddleware.js';
import { getFromCache, setInCache } from './_utils/serverCache.js';

// =============================================================================
// System prompt for Sonar — structured headline generation
// =============================================================================

const SYSTEM_PROMPT = `You are a financial news synthesizer for FantasyTrades, an educational stock analysis platform. Generate a market briefing as a JSON array of 8-10 headlines covering today's most significant market-moving events.

Respond ONLY with valid JSON, no markdown fences, no preamble.

Schema:
[
  {
    "id": "unique short slug like 'fed-rates' or 'nvda-earnings'",
    "headline": "Concise headline in ≤12 words",
    "summary": "2-3 sentence explanation of why this matters for investors. Include specific data points (percentages, dollar amounts, dates) when available.",
    "sentiment": "bullish" | "bearish" | "neutral",
    "category": "macro" | "earnings" | "sector" | "geopolitical" | "crypto" | "commodities",
    "tickers": ["RELEVANT", "TICKER", "SYMBOLS"],
    "importance": 1-10
  }
]

Rules:
- Order by importance (most impactful first)
- Include a mix of categories — don't make it all macro or all earnings
- tickers array should only include well-known US stock symbols (not ETFs, not indices)
- Every summary must cite a specific fact, number, or data point
- Do NOT include generic filler headlines — every item should be actionable intelligence`;

// Module-level stale fallback — keeps last successful response across warm invocations
let lastSuccessfulResponse = null;

const CACHE_KEY = 'market_pulse_latest';
const CACHE_TTL = 900; // 15 minutes

// =============================================================================
// Handler
// =============================================================================

export default async function handler(req, res) {
  // Security middleware (CORS, rate limiting, headers)
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
    return;
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check cache
  const cached = getFromCache(CACHE_KEY);
  if (cached) {
    return res.status(200).json(cached);
  }

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const userPrompt = `What are the most significant market-moving events and news today, ${dateStr}? Include macro events, notable earnings, sector moves, and any breaking developments affecting US equities.`;

  try {
    console.log('[MarketPulse] Fetching latest headlines');

    const { text, citations } = await querySonar(SYSTEM_PROMPT, userPrompt, {
      searchRecencyFilter: 'day',
      maxTokens: 2000,
      temperature: 0.3,
    });

    // Parse JSON from Sonar response
    let headlines;
    try {
      const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      headlines = JSON.parse(jsonStr);

      // If Sonar returned an object with a headlines key, unwrap it
      if (!Array.isArray(headlines) && headlines.headlines) {
        headlines = headlines.headlines;
      }

      if (!Array.isArray(headlines)) {
        throw new Error('Response is not an array');
      }
    } catch {
      console.warn('[MarketPulse] JSON parse failed, raw text:', text.slice(0, 200));
      // Wrap raw text in a single headline as fallback
      headlines = [{
        id: 'raw-summary',
        headline: 'Market Update',
        summary: text.slice(0, 500),
        sentiment: 'neutral',
        category: 'macro',
        tickers: [],
        importance: 5,
      }];
    }

    // Sort by importance descending
    headlines.sort((a, b) => (b.importance || 0) - (a.importance || 0));

    // Compute overall market sentiment from headlines
    let bullish = 0, bearish = 0;
    for (const h of headlines) {
      if (h.sentiment === 'bullish') bullish++;
      else if (h.sentiment === 'bearish') bearish++;
    }
    const marketSentiment = bullish > bearish ? 'bullish' : bearish > bullish ? 'bearish' : 'mixed';

    const responseData = {
      success: true,
      data: {
        headlines,
        marketSentiment,
        cachedAt: Date.now(),
        citations: citations || [],
      },
    };

    // Cache for 15 minutes
    setInCache(CACHE_KEY, responseData, CACHE_TTL);
    lastSuccessfulResponse = responseData;
    console.log(`[MarketPulse] Cached ${headlines.length} headlines (${marketSentiment}), ${citations.length} citations`);

    return res.status(200).json(responseData);
  } catch (error) {
    console.error('[MarketPulse] Error:', error.message, error.stack);

    // Stale fallback — return last successful response if available
    if (lastSuccessfulResponse) {
      console.log('[MarketPulse] Returning stale fallback data');
      return res.status(200).json({
        ...lastSuccessfulResponse,
        stale: true,
      });
    }

    // No data at all — return empty
    return res.status(200).json({
      success: true,
      data: {
        headlines: [],
        marketSentiment: 'unknown',
        cachedAt: null,
        citations: [],
      },
    });
  }
}
