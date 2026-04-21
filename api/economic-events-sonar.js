// api/economic-events-sonar.js
// Economic Events endpoint — real-time economic calendar via Perplexity Sonar
// Replaces the fragile Firebase-based economic calendar stack
//
// Sonar call + JSON parsing extracted to _utils/fetchEconomicEvents.js so the
// daily regime brief cron can reuse it without the HTTP/auth layer.

import { fetchEconomicEvents } from './_utils/fetchEconomicEvents.js';
import { applySecurityMiddleware } from './_utils/security.js';
import { requireAuth } from './_utils/authMiddleware.js';
import { getFromCache, setInCache } from './_utils/serverCache.js';

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

  try {
    console.log('[EconomicEvents] Fetching calendar via Sonar');

    const data = await fetchEconomicEvents();

    const responseData = {
      success: true,
      data,
    };

    setInCache(CACHE_KEY, responseData, CACHE_TTL);
    lastSuccessfulResponse = responseData;
    console.log(`[EconomicEvents] Cached ${data.thisWeek.length} this week, ${data.nextWeek.length} next week`);

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
