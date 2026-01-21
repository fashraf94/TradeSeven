// api/earnings/results.js
// Fetch actual earnings results from EODHD for tournament resolution
//
// Endpoint: GET /api/earnings/results?symbol=NVDA&date=2026-01-22
//
// Returns:
// - Actual EPS vs estimate (beat/miss)
// - Stock price move after earnings
// - Magnitude classification (upBig, up, flat, down, downBig)

import { applySecurityMiddleware } from '../_utils/security.js';

export default async function handler(req, res) {
  // Security middleware
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60000 } })) {
    return;
  }

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol, date } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Symbol required' });
  }

  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) {
    console.error('[EarningsResults] EODHD_API_KEY not configured');
    return res.status(500).json({ error: 'API key not configured' });
  }

  const upperSymbol = symbol.toUpperCase();
  const tickerWithExchange = `${upperSymbol}.US`;

  console.log(`[EarningsResults] Fetching results for ${upperSymbol}${date ? ` (target date: ${date})` : ''}`);

  try {
    // Fetch earnings history to get the actual result
    const fundamentalsUrl = `https://eodhd.com/api/fundamentals/${tickerWithExchange}?api_token=${apiKey}&filter=Earnings::History`;
    const fundamentalsRes = await fetch(fundamentalsUrl);

    if (!fundamentalsRes.ok) {
      throw new Error(`Fundamentals API error: ${fundamentalsRes.status}`);
    }

    const fundamentalsData = await fundamentalsRes.json();
    const history = fundamentalsData?.Earnings?.History || {};

    // Convert to array and sort by date (newest first)
    const today = new Date();
    const entries = Object.entries(history)
      .map(([reportDate, values]) => ({
        reportDate,
        epsActual: values.epsActual,
        epsEstimate: values.epsEstimate,
        epsDifference: values.epsDifference,
        surprisePercent: values.surprisePercent,
        beforeAfterMarket: values.beforeAfterMarket
      }))
      .filter(e => {
        // Must have actual EPS data and be in the past
        if (e.epsActual === null || e.epsActual === undefined) return false;
        return new Date(e.reportDate) <= today;
      })
      .sort((a, b) => new Date(b.reportDate) - new Date(a.reportDate));

    if (entries.length === 0) {
      return res.status(200).json({
        success: false,
        symbol: upperSymbol,
        resolved: false,
        error: 'No earnings results found yet',
        checkedAt: new Date().toISOString()
      });
    }

    // Find the matching entry
    let result = entries[0]; // Default to most recent

    if (date) {
      const targetDate = new Date(date);
      // Find entry within 5 days of target date
      const matchedEntry = entries.find(e => {
        const reportDate = new Date(e.reportDate);
        const diffDays = Math.abs((reportDate - targetDate) / (1000 * 60 * 60 * 24));
        return diffDays <= 5;
      });

      if (matchedEntry) {
        result = matchedEntry;
      } else {
        // No match found for the target date
        return res.status(200).json({
          success: false,
          symbol: upperSymbol,
          resolved: false,
          error: `No earnings result found near ${date}`,
          closestResult: entries[0]?.reportDate,
          checkedAt: new Date().toISOString()
        });
      }
    }

    // Verify we have actual EPS data
    if (result.epsActual === null || result.epsActual === undefined) {
      return res.status(200).json({
        success: false,
        symbol: upperSymbol,
        resolved: false,
        error: 'Earnings report pending - no actual EPS yet',
        reportDate: result.reportDate,
        checkedAt: new Date().toISOString()
      });
    }

    // Determine beat/miss - prefer EODHD's pre-calculated surprisePercent when available
    let didBeat, didMiss, determinationMethod;

    if (result.surprisePercent !== null && result.surprisePercent !== undefined) {
      // Use EODHD's pre-calculated surprise (more reliable)
      didBeat = result.surprisePercent > 0;
      didMiss = result.surprisePercent < 0;
      determinationMethod = 'surprisePercent';

      // Cross-validation: Check if our calculation would differ
      const hasEstimate = result.epsEstimate !== null && result.epsEstimate !== undefined;
      if (hasEstimate) {
        const calcBeat = result.epsActual > result.epsEstimate;
        const calcMiss = result.epsActual < result.epsEstimate;

        if ((didBeat && calcMiss) || (didMiss && calcBeat)) {
          console.warn(`[EarningsResults] ${upperSymbol}: DATA MISMATCH - ` +
            `surprisePercent=${result.surprisePercent.toFixed(2)}% suggests ${didBeat ? 'BEAT' : 'MISS'}, ` +
            `but epsActual(${result.epsActual}) vs epsEstimate(${result.epsEstimate}) suggests ${calcBeat ? 'BEAT' : 'MISS'}`);
        }
      }
    } else {
      // Fallback to manual calculation if surprisePercent not available
      didBeat = result.epsActual > result.epsEstimate;
      didMiss = result.epsActual < result.epsEstimate;
      determinationMethod = 'calculated';

      console.log(`[EarningsResults] ${upperSymbol}: No surprisePercent available, using calculated beat/miss`);
    }

    const outcome = didBeat ? 'beat' : (didMiss ? 'miss' : 'meet');

    // Get stock price move after earnings
    const priceMove = await getEarningsDayMove(upperSymbol, result.reportDate, result.beforeAfterMarket, apiKey);
    const magnitude = getMagnitudeBand(priceMove);

    console.log(`[EarningsResults] ${upperSymbol}: ${outcome} (EPS: ${result.epsActual} vs ${result.epsEstimate}), Move: ${priceMove?.toFixed(1)}% (${magnitude})`);

    return res.status(200).json({
      success: true,
      symbol: upperSymbol,
      resolved: true,
      reportDate: result.reportDate,
      epsActual: result.epsActual,
      epsEstimate: result.epsEstimate,
      epsSurprise: result.epsDifference,
      surprisePercent: result.surprisePercent,
      didBeat,
      didMiss,
      outcome,
      determinationMethod,
      priceMove: priceMove !== null ? Math.round(priceMove * 100) / 100 : null,
      magnitude,
      beforeAfterMarket: result.beforeAfterMarket,
      checkedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[EarningsResults] Error for ${upperSymbol}:`, error);
    return res.status(500).json({
      success: false,
      symbol: upperSymbol,
      error: error.message,
      checkedAt: new Date().toISOString()
    });
  }
}

/**
 * Get stock price move on earnings day
 * @param {string} symbol - Stock symbol
 * @param {string} reportDate - Earnings report date (YYYY-MM-DD)
 * @param {string} timing - 'BeforeMarket' or 'AfterMarket'
 * @param {string} apiKey - EODHD API key
 * @returns {number|null} - Percentage move or null
 */
async function getEarningsDayMove(symbol, reportDate, timing, apiKey) {
  try {
    const tickerWithExchange = `${symbol}.US`;
    const reportDateObj = new Date(reportDate);

    // Calculate date range for price lookup
    const fromDate = new Date(reportDateObj);
    fromDate.setDate(fromDate.getDate() - 5); // 5 days before
    const toDate = new Date(reportDateObj);
    toDate.setDate(toDate.getDate() + 5); // 5 days after

    const fromStr = fromDate.toISOString().split('T')[0];
    const toStr = toDate.toISOString().split('T')[0];

    const priceUrl = `https://eodhd.com/api/eod/${tickerWithExchange}?api_token=${apiKey}&from=${fromStr}&to=${toStr}&fmt=json`;
    const priceRes = await fetch(priceUrl);

    if (!priceRes.ok) {
      console.warn(`[EarningsResults] Price fetch failed: ${priceRes.status}`);
      return null;
    }

    const prices = await priceRes.json();

    if (!Array.isArray(prices) || prices.length < 2) {
      console.warn(`[EarningsResults] Insufficient price data for ${symbol}`);
      return null;
    }

    // Sort by date
    prices.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Find the report date index
    const reportDateStr = reportDate.split('T')[0];
    const reportDayIndex = prices.findIndex(p => p.date >= reportDateStr);

    if (reportDayIndex < 0) {
      console.warn(`[EarningsResults] Could not find report date in price data`);
      return null;
    }

    // Get lock price (day before earnings) and reaction price
    let lockPrice, reactionPrice;

    if (timing === 'BeforeMarket') {
      // Pre-market: Lock = previous day close, Reaction = report day close
      if (reportDayIndex === 0) {
        console.warn(`[EarningsResults] No previous day data for pre-market earnings`);
        return null;
      }
      lockPrice = prices[reportDayIndex - 1].adjusted_close || prices[reportDayIndex - 1].close;
      reactionPrice = prices[reportDayIndex].adjusted_close || prices[reportDayIndex].close;
    } else {
      // After-market: Lock = report day close, Reaction = next day close
      if (reportDayIndex >= prices.length - 1) {
        console.warn(`[EarningsResults] No next day data for after-market earnings`);
        return null;
      }
      lockPrice = prices[reportDayIndex].adjusted_close || prices[reportDayIndex].close;
      reactionPrice = prices[reportDayIndex + 1].adjusted_close || prices[reportDayIndex + 1].close;
    }

    if (!lockPrice || !reactionPrice) {
      console.warn(`[EarningsResults] Missing price data for calculation`);
      return null;
    }

    const percentMove = ((reactionPrice - lockPrice) / lockPrice) * 100;
    return percentMove;

  } catch (error) {
    console.error(`[EarningsResults] Error getting price move:`, error);
    return null;
  }
}

/**
 * Get magnitude band from price move percentage
 * @param {number|null} priceMove - Price move percentage
 * @returns {string} - Magnitude band
 */
function getMagnitudeBand(priceMove) {
  if (priceMove === null || priceMove === undefined) return 'unknown';
  if (priceMove > 5) return 'upBig';
  if (priceMove >= 2) return 'up';
  if (priceMove >= -2) return 'flat';
  if (priceMove >= -5) return 'down';
  return 'downBig';
}
