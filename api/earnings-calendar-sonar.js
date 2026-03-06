// api/earnings-calendar-sonar.js
// Earnings Calendar endpoint — notable earnings reports via Perplexity Sonar
// Provides structured earnings data for the UpcomingEventsPanel

import { querySonar } from './helpers/sonar.js';
import { applySecurityMiddleware } from './_utils/security.js';
import { getFromCache, setInCache } from './_utils/serverCache.js';

// =============================================================================
// System prompt for Sonar — structured earnings calendar
// =============================================================================

const SYSTEM_PROMPT = `You are an earnings calendar analyst for FantasyTrades. Generate a structured earnings calendar for the most important upcoming reports as JSON.

Respond ONLY with valid JSON, no markdown fences, no preamble.

Schema:
{
  "thisWeek": [
    {
      "date": "2026-03-03",
      "day": "Monday",
      "timing": "AMC" or "BMO",
      "symbol": "CRM",
      "name": "Salesforce",
      "significance": "high" or "medium" or "low",
      "watchFor": "One sentence on the key metric or narrative investors are watching",
      "sectorImpact": "One sentence on how this report could affect the broader sector"
    }
  ],
  "nextWeek": [...same schema...],
  "spotlight": "2-3 sentences on the single most important earnings report in the thisWeek array and why it matters"
}

CRITICAL RULES FOR STOCK SELECTION:
- ONLY include S&P 500 companies or widely-followed large-cap growth stocks
- Prioritize: mega-caps (AAPL, MSFT, NVDA, AMZN, META, GOOGL, TSLA, AVGO), major retailers (TGT, COST, WMT), major financials (JPM, GS, MS), and sector bellwethers
- If a company has less than $10B market cap, do NOT include it unless it is exceptionally notable
- Include 8-15 companies per week — quality and relevance over quantity
- significance = "high" ONLY for mega-caps, major retailers, or companies whose reports historically move entire sectors
- The "spotlight" field MUST reference a company that appears in the "thisWeek" array — never spotlight a company from a different week or one not in the results
- "watchFor" must be specific to THIS earnings report — reference analyst consensus, recent guidance, or specific business metrics. NOT generic statements like "revenue growth"
- Order by date, then by significance (high first) within each day
- Double-check that every symbol you include is actually reporting earnings in the specified week`;

// Module-level stale fallback
let lastSuccessfulResponse = null;

const CACHE_KEY = 'earnings_calendar_sonar_v2';
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

  const userPrompt = `What are the most important earnings reports from S&P 500 and major large-cap companies scheduled for this week and next week? Today is ${dateStr}. Focus ONLY on well-known, widely-followed companies. Do NOT include small-cap or obscure names. Include the exact reporting date and whether it's before market open (BMO) or after market close (AMC).`;

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
