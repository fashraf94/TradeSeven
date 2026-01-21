// Vercel Serverless Function - Stock Earnings History with Price Reactions
// Endpoint: /api/stocks/earnings-history?symbol=AAPL
//
// Fetches historical earnings dates and calculates price reactions for each
// Returns aggregate stats + individual reactions for parlay pricing

import { applySecurityMiddleware } from '../_utils/security.js';

export default async function handler(req, res) {
  // Security middleware
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 20, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Symbol required' });
  }

  const API_KEY = process.env.EODHD_API_KEY;
  if (!API_KEY) {
    console.error('[earnings-history] EODHD_API_KEY not configured');
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const upperSymbol = symbol.toUpperCase();
    const tickerWithExchange = `${upperSymbol}.US`;

    console.log(`[earnings-history] Fetching history for ${upperSymbol}`);

    // Step 1: Fetch fundamentals to get earnings history
    const fundamentalsResponse = await fetch(
      `https://eodhd.com/api/fundamentals/${tickerWithExchange}?api_token=${API_KEY}&fmt=json`
    );

    if (!fundamentalsResponse.ok) {
      throw new Error(`Fundamentals API error: ${fundamentalsResponse.status}`);
    }

    const fundamentals = await fundamentalsResponse.json();
    const earningsHistory = fundamentals?.Earnings?.History || {};

    // Convert to array and get last 12 quarters with actual EPS data
    const today = new Date();

    // Diagnostic logging for data quality
    const allQuarters = Object.entries(earningsHistory).map(([date, data]) => ({
      date,
      reportDate: data.reportDate || date,
      hasActual: data.epsActual !== null && data.epsActual !== undefined,
      hasEstimate: data.epsEstimate !== null && data.epsEstimate !== undefined,
      hasSurprise: data.surprisePercent !== null && data.surprisePercent !== undefined,
      epsActual: data.epsActual,
      epsEstimate: data.epsEstimate,
      surprisePercent: data.surprisePercent
    }));

    const missingEstimate = allQuarters.filter(q => q.hasActual && !q.hasEstimate);
    const missingSurprise = allQuarters.filter(q => q.hasActual && q.hasEstimate && !q.hasSurprise);

    if (missingEstimate.length > 0) {
      console.warn(`[earnings-history] ${upperSymbol}: ${missingEstimate.length} quarters have epsActual but missing epsEstimate`);
      missingEstimate.slice(0, 3).forEach(q => {
        console.warn(`  - ${q.date}: epsActual=${q.epsActual}, epsEstimate=${q.epsEstimate}`);
      });
    }

    if (missingSurprise.length > 0) {
      console.log(`[earnings-history] ${upperSymbol}: ${missingSurprise.length} quarters missing surprisePercent (will use calculation)`);
    }

    const earningsArray = Object.entries(earningsHistory)
      .map(([date, data]) => ({
        reportDate: data.reportDate || date,
        epsActual: data.epsActual,
        epsEstimate: data.epsEstimate,
        epsDifference: data.epsDifference,
        surprisePercent: data.surprisePercent,        // Pre-calculated by EODHD
        fiscalQuarter: data.fiscalQuarter,             // Q1, Q2, Q3, Q4
        fiscalYear: data.fiscalYear,                   // Year
        beforeAfterMarket: data.beforeAfterMarket || null,
      }))
      .filter(e => {
        // Must have report date and actual EPS
        if (!e.reportDate || e.epsActual === null || e.epsActual === undefined) return false;

        // Must be in the past
        if (new Date(e.reportDate) >= today) return false;

        // Accept if we have EITHER:
        // 1. epsEstimate (for calculation), OR
        // 2. surprisePercent (pre-calculated by EODHD)
        const hasEstimate = e.epsEstimate !== null && e.epsEstimate !== undefined;
        const hasSurprise = e.surprisePercent !== null && e.surprisePercent !== undefined;

        if (!hasEstimate && !hasSurprise) {
          console.log(`[earnings-history] ${upperSymbol}: Excluding ${e.reportDate} - no estimate or surprisePercent`);
          return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.reportDate) - new Date(a.reportDate))
      .slice(0, 12);

    console.log(`[earnings-history] Found ${earningsArray.length} completed earnings for ${upperSymbol}`);

    if (earningsArray.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          symbol: upperSymbol,
          hasHistory: false,
          message: 'No earnings history available'
        }
      });
    }

    // Step 2: Get date range for historical prices
    const oldestDate = earningsArray[earningsArray.length - 1].reportDate;
    const fromDate = new Date(oldestDate);
    fromDate.setDate(fromDate.getDate() - 5); // 5 days before oldest earnings

    const toDate = new Date();
    toDate.setDate(toDate.getDate() + 1);

    const fromStr = fromDate.toISOString().split('T')[0];
    const toStr = toDate.toISOString().split('T')[0];

    console.log(`[earnings-history] Fetching prices from ${fromStr} to ${toStr}`);

    // Step 3: Fetch historical daily prices
    const pricesResponse = await fetch(
      `https://eodhd.com/api/eod/${tickerWithExchange}?api_token=${API_KEY}&fmt=json&from=${fromStr}&to=${toStr}`
    );

    if (!pricesResponse.ok) {
      throw new Error(`Prices API error: ${pricesResponse.status}`);
    }

    const pricesData = await pricesResponse.json();

    // Create price lookup map by date
    const priceMap = {};
    pricesData.forEach(day => {
      priceMap[day.date] = {
        open: day.open,
        close: day.adjusted_close || day.close,
        high: day.high,
        low: day.low
      };
    });

    // Get sorted array of available dates
    const availableDates = Object.keys(priceMap).sort();

    console.log(`[earnings-history] Got ${availableDates.length} price days for ${upperSymbol}`);

    // Step 4: Calculate reaction for each earnings
    const reactions = [];

    for (const earning of earningsArray) {
      const reportDateStr = earning.reportDate;
      const isPreMarket = earning.beforeAfterMarket === 'BeforeMarket';

      // Find previous trading day (lock price)
      const prevDayIndex = availableDates.findIndex(d => d >= reportDateStr) - 1;
      const prevDay = prevDayIndex >= 0 ? availableDates[prevDayIndex] : null;

      // Find reaction day
      let reactionDay = null;
      if (isPreMarket) {
        // Same day close for pre-market announcements
        reactionDay = availableDates.find(d => d >= reportDateStr);
      } else {
        // Next day close for after-market announcements
        const reportDayIndex = availableDates.findIndex(d => d >= reportDateStr);
        if (reportDayIndex >= 0 && reportDayIndex + 1 < availableDates.length) {
          reactionDay = availableDates[reportDayIndex + 1];
        }
      }

      if (!prevDay || !reactionDay || !priceMap[prevDay] || !priceMap[reactionDay]) {
        console.log(`[earnings-history] Skipping ${reportDateStr} - missing price data`);
        continue;
      }

      const lockPrice = priceMap[prevDay].close;
      const reactionPrice = priceMap[reactionDay].close;
      const percentMove = ((reactionPrice - lockPrice) / lockPrice) * 100;

      // Determine beat/miss - prefer EODHD's pre-calculated surprisePercent when available
      let didBeat, didMiss, didMeet;
      let determinationMethod = 'calculated';

      if (earning.surprisePercent !== null && earning.surprisePercent !== undefined) {
        // Use EODHD's pre-calculated surprise (more reliable)
        didBeat = earning.surprisePercent > 0;
        didMiss = earning.surprisePercent < 0;
        didMeet = earning.surprisePercent === 0;
        determinationMethod = 'surprisePercent';

        // Cross-validation: Check if our calculation would differ
        const hasEstimate = earning.epsEstimate !== null && earning.epsEstimate !== undefined;
        if (hasEstimate) {
          const calcBeat = earning.epsActual > earning.epsEstimate;
          const calcMiss = earning.epsActual < earning.epsEstimate;

          if ((didBeat && calcMiss) || (didMiss && calcBeat)) {
            console.warn(`[earnings-history] ${upperSymbol} Q${earning.fiscalQuarter || '?'} ${earning.fiscalYear || ''}: ` +
              `DATA MISMATCH - surprisePercent=${earning.surprisePercent.toFixed(2)}% suggests ${didBeat ? 'BEAT' : 'MISS'}, ` +
              `but epsActual(${earning.epsActual}) vs epsEstimate(${earning.epsEstimate}) suggests ${calcBeat ? 'BEAT' : 'MISS'}`);
          }
        }
      } else {
        // Fallback to manual calculation if surprisePercent not available
        didBeat = earning.epsActual > earning.epsEstimate;
        didMiss = earning.epsActual < earning.epsEstimate;
        didMeet = !didBeat && !didMiss;
        determinationMethod = 'calculated';

        console.log(`[earnings-history] ${upperSymbol} Q${earning.fiscalQuarter || '?'}: ` +
          `No surprisePercent available, using calculated beat/miss`);
      }

      // Categorize magnitude
      let magnitude = 'flat';
      if (percentMove > 5) magnitude = 'upBig';
      else if (percentMove >= 2) magnitude = 'up';
      else if (percentMove <= -5) magnitude = 'downBig';
      else if (percentMove <= -2) magnitude = 'down';

      reactions.push({
        reportDate: earning.reportDate,
        fiscalQuarter: earning.fiscalQuarter,
        fiscalYear: earning.fiscalYear,
        epsActual: earning.epsActual,
        epsEstimate: earning.epsEstimate,
        surprisePercent: earning.surprisePercent,
        didBeat,
        didMiss,
        didMeet,
        determinationMethod,
        beforeAfterMarket: earning.beforeAfterMarket,
        lockPrice: Math.round(lockPrice * 100) / 100,
        lockDate: prevDay,
        reactionPrice: Math.round(reactionPrice * 100) / 100,
        reactionDate: reactionDay,
        percentMove: Math.round(percentMove * 100) / 100,
        magnitude
      });
    }

    console.log(`[earnings-history] Calculated ${reactions.length} reactions for ${upperSymbol}`);

    if (reactions.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          symbol: upperSymbol,
          hasHistory: false,
          message: 'Could not calculate price reactions'
        }
      });
    }

    // Step 5: Calculate aggregate statistics
    const beats = reactions.filter(r => r.didBeat);
    const misses = reactions.filter(r => r.didMiss);

    const avgMoveOnBeat = beats.length > 0
      ? beats.reduce((sum, r) => sum + r.percentMove, 0) / beats.length
      : null;

    const avgMoveOnMiss = misses.length > 0
      ? misses.reduce((sum, r) => sum + r.percentMove, 0) / misses.length
      : null;

    // Calculate magnitude distribution after beats
    const beatMagnitudes = { upBig: 0, up: 0, flat: 0, down: 0, downBig: 0 };
    beats.forEach(r => { beatMagnitudes[r.magnitude]++; });

    const afterBeatProbabilities = {};
    if (beats.length > 0) {
      Object.keys(beatMagnitudes).forEach(mag => {
        afterBeatProbabilities[mag] = Math.round((beatMagnitudes[mag] / beats.length) * 100) / 100;
      });
    }

    // Calculate magnitude distribution after misses
    const missMagnitudes = { upBig: 0, up: 0, flat: 0, down: 0, downBig: 0 };
    misses.forEach(r => { missMagnitudes[r.magnitude]++; });

    const afterMissProbabilities = {};
    if (misses.length > 0) {
      Object.keys(missMagnitudes).forEach(mag => {
        afterMissProbabilities[mag] = Math.round((missMagnitudes[mag] / misses.length) * 100) / 100;
      });
    }

    // Overall volatility (standard deviation of moves)
    const allMoves = reactions.map(r => r.percentMove);
    const avgMove = allMoves.reduce((a, b) => a + b, 0) / allMoves.length;
    const variance = allMoves.reduce((sum, m) => sum + Math.pow(m - avgMove, 2), 0) / allMoves.length;
    const volatility = Math.sqrt(variance);

    console.log(`[earnings-history] Stats for ${upperSymbol}: beatRate=${Math.round((beats.length / reactions.length) * 100)}%, avgOnBeat=${avgMoveOnBeat?.toFixed(1)}%, avgOnMiss=${avgMoveOnMiss?.toFixed(1)}%`);

    return res.status(200).json({
      success: true,
      data: {
        symbol: upperSymbol,
        hasHistory: true,
        quartersAnalyzed: reactions.length,

        // Aggregate stats
        stats: {
          avgMoveOnBeat: avgMoveOnBeat !== null ? Math.round(avgMoveOnBeat * 100) / 100 : null,
          avgMoveOnMiss: avgMoveOnMiss !== null ? Math.round(avgMoveOnMiss * 100) / 100 : null,
          beatRate: Math.round((beats.length / reactions.length) * 100),
          volatility: Math.round(volatility * 100) / 100,
          totalBeats: beats.length,
          totalMisses: misses.length,
        },

        // Probability distributions (for pricing)
        probabilities: {
          afterBeat: afterBeatProbabilities,
          afterMiss: afterMissProbabilities,
        },

        // Individual reactions (for display)
        reactions: reactions.slice(0, 8), // Last 8 for UI display

        // Data quality metrics
        dataQuality: {
          totalQuarters: reactions.length,
          determinationMethods: {
            surprisePercent: reactions.filter(r => r.determinationMethod === 'surprisePercent').length,
            calculated: reactions.filter(r => r.determinationMethod === 'calculated').length
          },
          quartersExcluded: missingEstimate.length,
          epsType: 'non-GAAP (adjusted)',
          source: 'EODHD'
        },

        // Metadata
        fetchedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[earnings-history] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch earnings history',
      message: error.message
    });
  }
}
