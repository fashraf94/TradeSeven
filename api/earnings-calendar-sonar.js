// api/earnings-calendar-sonar.js
// Earnings Calendar endpoint — notable earnings reports via Perplexity Sonar
// Provides structured earnings data for the UpcomingEventsPanel
//
// Sonar call + JSON parsing extracted to _utils/fetchEarningsCalendar.js so
// the daily regime brief cron can reuse it without the HTTP/auth layer.

import { fetchEarningsCalendar } from './_utils/fetchEarningsCalendar.js';
import { applySecurityMiddleware } from './_utils/security.js';
import { requireAuth } from './_utils/authMiddleware.js';
import { getFromCache, setInCache } from './_utils/serverCache.js';

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

  try {
    console.log('[EarningsCalendar] Fetching calendar via Sonar');

    const data = await fetchEarningsCalendar();

    const responseData = {
      success: true,
      data,
    };

    setInCache(CACHE_KEY, responseData, CACHE_TTL);
    lastSuccessfulResponse = responseData;
    console.log(`[EarningsCalendar] Cached ${data.thisWeek.length} this week, ${data.nextWeek.length} next week`);

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
