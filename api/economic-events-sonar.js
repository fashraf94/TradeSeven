// api/economic-events-sonar.js
// Economic Events endpoint — real-time economic calendar via Perplexity Sonar
// Replaces the fragile Firebase-based economic calendar stack

import { querySonar } from './helpers/sonar.js';
import { applySecurityMiddleware } from './_utils/security.js';
import { requireAuth } from './_utils/authMiddleware.js';
import { getFromCache, setInCache } from './_utils/serverCache.js';

// =============================================================================
// System prompt for Sonar — structured economic calendar
// =============================================================================

const SYSTEM_PROMPT = `You are an economic calendar analyst for FantasyTrades, an educational stock analysis platform. Generate a structured economic events calendar as JSON.

Respond ONLY with valid JSON, no markdown fences, no preamble.

Schema:
{
  "thisWeek": [
    {
      "date": "2026-03-02",
      "day": "Monday",
      "time": "10:00 AM ET",
      "event": "ISM Manufacturing PMI",
      "previous": "50.9",
      "estimate": "50.5",
      "actual": "51.2" or null,
      "impact": "high" | "medium" | "low",
      "category": "manufacturing" | "employment" | "inflation" | "housing" | "consumer" | "fed" | "gdp" | "trade" | "other",
      "brief": "One sentence on why this matters for markets right now"
    }
  ],
  "nextWeek": [],
  "highlight": "One sentence summary of the single most important event this week and why it matters"
}

Rules:
- Include ALL major US economic releases for this week and next week
- "actual" should be null if the data hasn't been released yet, or the actual value if already released
- Order events chronologically within each week
- "impact" rating: high = likely to move markets (Fed decisions, NFP, CPI, GDP), medium = sector-specific impact, low = minor indicator
- "brief" should connect the event to current market themes, not just define what the indicator measures
- Always include: Fed speakers/decisions, employment data, inflation data, GDP, PMIs, consumer confidence, housing data
- Do NOT include very minor or regional indicators — focus on market-moving events`;

// Module-level stale fallback
let lastSuccessfulResponse = null;

const CACHE_KEY = 'economic_events_sonar';
const CACHE_TTL = 3600; // 1 hour

// =============================================================================
// Handler
// =============================================================================

export default async function handler(req, res) {
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

  const userPrompt = `What are all the major US economic events and data releases for this week and next week? Today is ${dateStr}. Include Fed speeches, employment data, inflation reports, PMI readings, consumer data, housing data, GDP, and any other market-moving releases.`;

  try {
    console.log('[EconomicEvents] Fetching calendar via Sonar');

    const { text, citations } = await querySonar(SYSTEM_PROMPT, userPrompt, {
      searchRecencyFilter: 'week',
      maxTokens: 2000,
      temperature: 0.2,
    });

    // Parse JSON from Sonar response
    let parsed;
    try {
      const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.warn('[EconomicEvents] JSON parse failed, raw text:', text.slice(0, 200));
      parsed = {
        thisWeek: [],
        nextWeek: [],
        highlight: 'Economic calendar temporarily unavailable',
      };
    }

    const responseData = {
      success: true,
      data: {
        thisWeek: Array.isArray(parsed.thisWeek) ? parsed.thisWeek : [],
        nextWeek: Array.isArray(parsed.nextWeek) ? parsed.nextWeek : [],
        highlight: parsed.highlight || null,
        cachedAt: Date.now(),
        citations: citations || [],
      },
    };

    setInCache(CACHE_KEY, responseData, CACHE_TTL);
    lastSuccessfulResponse = responseData;
    console.log(`[EconomicEvents] Cached ${responseData.data.thisWeek.length} this week, ${responseData.data.nextWeek.length} next week`);

    return res.status(200).json(responseData);
  } catch (error) {
    console.error('[EconomicEvents] Error:', error.message, error.stack);

    if (lastSuccessfulResponse) {
      console.log('[EconomicEvents] Returning stale fallback data');
      return res.status(200).json({
        ...lastSuccessfulResponse,
        stale: true,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        thisWeek: [],
        nextWeek: [],
        highlight: null,
        cachedAt: null,
        citations: [],
      },
    });
  }
}
