// Vercel Serverless Function - Earnings Calendar
// Endpoint: /api/stocks/earnings-calendar?days=14
// Fetches upcoming earnings from EODHD calendar API

import { applySecurityMiddleware } from '../_utils/security.js';
import { getFromCache, setInCache, setCacheHeaders, CACHE_TIERS } from '../_utils/serverCache.js';

export default async function handler(req, res) {
  // Apply security middleware
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 20, windowMs: 60000 } })) {
    return;
  }

  const { days = 14 } = req.query;
  const noCache = req.query?.nocache === '1';
  const daysInt = Math.min(parseInt(days) || 14, 30); // Max 30 days

  const API_KEY = process.env.EODHD_API_KEY;

  if (!API_KEY) {
    console.error('[EarningsCalendar] EODHD_API_KEY not configured');
    return res.status(500).json({ error: 'API not configured' });
  }

  // Check cache
  const tier = CACHE_TIERS.TECHNICAL;
  const cacheKey = `earnings_calendar_${daysInt}`;
  if (!noCache) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      console.log(`[EarningsCalendar] Cache hit for days=${daysInt}`);
      setCacheHeaders(res, tier.sMaxAge, tier.staleWhileRevalidate);
      return res.status(200).json(cached);
    }
  }

  try {
    // Calculate date range
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + daysInt);

    const fromDate = today.toISOString().split('T')[0];
    const toDate = endDate.toISOString().split('T')[0];

    console.log(`[EarningsCalendar] Fetching earnings from ${fromDate} to ${toDate}`);

    const response = await fetch(
      `https://eodhd.com/api/calendar/earnings?api_token=${API_KEY}&fmt=json&from=${fromDate}&to=${toDate}`
    );

    if (!response.ok) {
      throw new Error(`EODHD responded with ${response.status}`);
    }

    const data = await response.json();
    const earningsRaw = data.earnings || [];

    console.log(`[EarningsCalendar] Raw earnings count: ${earningsRaw.length}`);

    // Filter to US stocks only and transform
    const events = earningsRaw
      .filter(e => {
        // Filter to US stocks (code ends with .US or no exchange suffix)
        const code = e.code || '';
        return code.endsWith('.US') || !code.includes('.');
      })
      .map(e => {
        // Extract symbol (remove .US suffix)
        const symbol = (e.code || '').replace('.US', '').toUpperCase();

        // Determine report time
        let reportTime = 'TBD';
        if (e.before_after_market) {
          const bam = e.before_after_market.toLowerCase();
          if (bam === 'bmo' || bam.includes('before')) {
            reportTime = 'BMO';
          } else if (bam === 'amc' || bam.includes('after')) {
            reportTime = 'AMC';
          }
        }

        return {
          symbol,
          companyName: e.name || symbol,
          reportDate: e.report_date,
          reportTime,
          epsEstimate: e.eps_estimate,
          revenueEstimate: e.revenue_estimate,
          marketCap: e.market_cap,
          currency: e.currency || 'USD',
          source: 'eodhd'
        };
      })
      .filter(e => e.symbol && e.reportDate) // Must have symbol and date
      .sort((a, b) => new Date(a.reportDate) - new Date(b.reportDate));

    console.log(`[EarningsCalendar] Filtered US earnings: ${events.length}`);

    const responseData = {
      success: true,
      fromDate,
      toDate,
      count: events.length,
      events
    };

    if (!noCache) {
      setInCache(cacheKey, responseData, tier.memoryTTL);
    }
    setCacheHeaders(res, tier.sMaxAge, tier.staleWhileRevalidate);
    return res.status(200).json(responseData);

  } catch (error) {
    console.error('[EarningsCalendar] Fetch error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch earnings calendar',
      message: error.message
    });
  }
}
