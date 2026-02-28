// api/earnings-calendar-sonar.js
// Earnings Calendar endpoint — notable earnings reports via Perplexity Sonar
// Provides structured earnings data for the UpcomingEventsPanel

import { querySonar } from './helpers/sonar.js';
import { applySecurityMiddleware } from './_utils/security.js';
import { getFromCache, setInCache } from './_utils/serverCache.js';

// =============================================================================
// System prompt for Sonar — structured earnings calendar
// =============================================================================

const SYSTEM_PROMPT = `You are an earnings calendar analyst for MarketClash, an educational stock analysis platform. Generate a structured earnings calendar as JSON.

Respond ONLY with valid JSON, no markdown fences, no preamble.

Schema:
{
  "thisWeek": [
    {
      "date": "2026-03-02",
      "day": "Monday",
      "timing": "BMO",
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "significance": "high" | "medium" | "low",
      "watchFor": "One sentence on the key metric or theme investors are watching",
      "sectorImpact": "One sentence on broader sector implications"
    }
  ],
  "nextWeek": [],
  "spotlight": "One sentence summary of the single most important earnings report and why it matters"
}

Rules:
- Include notable US earnings reports for this week and next week
- Focus on large-cap, widely-followed companies and any mid-cap names with outsized market impact
- "timing": "BMO" = before market open, "AMC" = after market close
- "significance": high = mega-cap or sector bellwether (AAPL, NVDA, JPM, etc.), medium = large-cap with sector relevance, low = notable but narrower impact
- Order events chronologically within each week
- "watchFor" should highlight the specific metric or narrative investors care about (e.g., AI revenue growth, credit quality, same-store sales), not generic descriptions
- Do NOT include very small companies unless they have outsized market relevance
- Aim for 8-15 companies per week during earnings season, fewer during off-season`;

// Module-level stale fallback
let lastSuccessfulResponse = null;

const CACHE_KEY = 'earnings_calendar_sonar';
const CACHE_TTL = 14400; // 4 hours

// =============================================================================
// Handler
// =============================================================================

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
    return;
  }

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

  const userPrompt = `What are the most notable US earnings reports scheduled for this week and next week? Today is ${dateStr}. Focus on large-cap and market-moving companies. Include the reporting date, before/after market timing, and what investors are watching for each report.`;

  try {
    console.log('[EarningsCalendar] Fetching calendar via Sonar');

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
      console.warn('[EarningsCalendar] JSON parse failed, raw text:', text.slice(0, 200));
      parsed = {
        thisWeek: [],
        nextWeek: [],
        spotlight: 'Earnings calendar temporarily unavailable',
      };
    }

    const responseData = {
      success: true,
      data: {
        thisWeek: Array.isArray(parsed.thisWeek) ? parsed.thisWeek : [],
        nextWeek: Array.isArray(parsed.nextWeek) ? parsed.nextWeek : [],
        spotlight: parsed.spotlight || null,
        cachedAt: Date.now(),
        citations: citations || [],
      },
    };

    setInCache(CACHE_KEY, responseData, CACHE_TTL);
    lastSuccessfulResponse = responseData;
    console.log(`[EarningsCalendar] Cached ${responseData.data.thisWeek.length} this week, ${responseData.data.nextWeek.length} next week`);

    return res.status(200).json(responseData);
  } catch (error) {
    console.error('[EarningsCalendar] Error:', error.message, error.stack);

    if (lastSuccessfulResponse) {
      console.log('[EarningsCalendar] Returning stale fallback data');
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
        spotlight: null,
        cachedAt: null,
        citations: [],
      },
    });
  }
}
