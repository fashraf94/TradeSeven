// api/earnings/_helpers/getEarningsResult.js
// Shared earnings result logic - used by both results.js API and resolve-tournament.js
//
// This avoids internal HTTP calls which can fail silently on Vercel
//
// Created: Jan 2026 during tournament resolution debugging
// Dependencies: dateUtils (shared date handling), earningsConfig (magnitude thresholds)

import { safeParseDate, toYYYYMMDD } from '../../../src/utils/dateUtils.js';
import { MAGNITUDE_THRESHOLDS } from '../../../src/config/earningsConfig.js';

/**
 * Get magnitude band from price move percentage
 * Uses thresholds from centralized config for consistency
 *
 * @param {number|null} priceMove - Price move percentage
 * @returns {string} - Magnitude band: 'upBig' | 'up' | 'flat' | 'down' | 'downBig' | 'unknown'
 */
export function getMagnitudeBand(priceMove) {
  if (priceMove === null || priceMove === undefined) return 'unknown';
  if (priceMove > MAGNITUDE_THRESHOLDS.UP_BIG) return 'upBig';
  if (priceMove >= MAGNITUDE_THRESHOLDS.UP_MIN) return 'up';
  if (priceMove >= -MAGNITUDE_THRESHOLDS.FLAT_RANGE) return 'flat';
  if (priceMove >= MAGNITUDE_THRESHOLDS.DOWN_BIG) return 'down';
  return 'downBig';
}

/**
 * Get stock price move on earnings day
 * @param {string} symbol - Stock symbol
 * @param {string} reportDate - Earnings report date (YYYY-MM-DD)
 * @param {string} timing - 'BeforeMarket' or 'AfterMarket'
 * @param {string} apiKey - EODHD API key
 * @returns {number|null} - Percentage move or null
 */
export async function getEarningsDayMove(symbol, reportDate, timing, apiKey) {
  try {
    const tickerWithExchange = `${symbol}.US`;
    const reportDateObj = safeParseDate(reportDate);

    if (!reportDateObj) {
      console.warn(`[getEarningsResult] Could not parse reportDate: ${reportDate}`);
      return null;
    }

    // Calculate date range for price lookup
    const fromDate = new Date(reportDateObj);
    fromDate.setDate(fromDate.getDate() - 5); // 5 days before
    const toDate = new Date(reportDateObj);
    toDate.setDate(toDate.getDate() + 5); // 5 days after

    const fromStr = toYYYYMMDD(fromDate);
    const toStr = toYYYYMMDD(toDate);

    const priceUrl = `https://eodhd.com/api/eod/${tickerWithExchange}?api_token=${apiKey}&from=${fromStr}&to=${toStr}&fmt=json`;
    const priceRes = await fetch(priceUrl);

    if (!priceRes.ok) {
      console.warn(`[getEarningsResult] Price fetch failed: ${priceRes.status}`);
      return null;
    }

    const prices = await priceRes.json();

    if (!Array.isArray(prices) || prices.length < 2) {
      console.warn(`[getEarningsResult] Insufficient price data for ${symbol}`);
      return null;
    }

    // Sort by date
    prices.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Find the report date index
    const reportDateStr = toYYYYMMDD(reportDate);
    const reportDayIndex = prices.findIndex(p => p.date >= reportDateStr);

    if (reportDayIndex < 0) {
      console.warn(`[getEarningsResult] Could not find report date in price data`);
      return null;
    }

    // Get lock price (day before earnings) and reaction price
    let lockPrice, reactionPrice;

    if (timing === 'BeforeMarket') {
      // Pre-market: Lock = previous day close, Reaction = report day close
      if (reportDayIndex === 0) {
        console.warn(`[getEarningsResult] No previous day data for pre-market earnings`);
        return null;
      }
      lockPrice = prices[reportDayIndex - 1].adjusted_close || prices[reportDayIndex - 1].close;
      reactionPrice = prices[reportDayIndex].adjusted_close || prices[reportDayIndex].close;
    } else {
      // After-market: Lock = report day close, Reaction = next day close
      if (reportDayIndex >= prices.length - 1) {
        console.warn(`[getEarningsResult] No next day data for after-market earnings`);
        return null;
      }
      lockPrice = prices[reportDayIndex].adjusted_close || prices[reportDayIndex].close;
      reactionPrice = prices[reportDayIndex + 1].adjusted_close || prices[reportDayIndex + 1].close;
    }

    if (!lockPrice || !reactionPrice) {
      console.warn(`[getEarningsResult] Missing price data for calculation`);
      return null;
    }

    const percentMove = ((reactionPrice - lockPrice) / lockPrice) * 100;
    return percentMove;

  } catch (error) {
    console.error(`[getEarningsResult] Error getting price move:`, error);
    return null;
  }
}

/**
 * Fetch and process earnings result for a symbol
 *
 * @param {string} symbol - Stock symbol (e.g., 'NVDA')
 * @param {string|null} targetDate - Optional target date (YYYY-MM-DD) to match
 * @returns {Object} - Result object with success, resolved, outcome, magnitude, etc.
 */
export async function getEarningsResult(symbol, targetDate = null) {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) {
    console.error('[getEarningsResult] EODHD_API_KEY not configured');
    return {
      success: false,
      symbol,
      resolved: false,
      error: 'API key not configured'
    };
  }

  const upperSymbol = symbol.toUpperCase();
  const tickerWithExchange = `${upperSymbol}.US`;

  console.log(`[getEarningsResult] Fetching results for ${upperSymbol}${targetDate ? ` (target date: ${targetDate})` : ''}`);

  try {
    // Fetch earnings history to get the actual result
    const fundamentalsUrl = `https://eodhd.com/api/fundamentals/${tickerWithExchange}?api_token=${apiKey}&fmt=json`;
    const fundamentalsRes = await fetch(fundamentalsUrl);

    if (!fundamentalsRes.ok) {
      throw new Error(`Fundamentals API error: ${fundamentalsRes.status}`);
    }

    const fundamentalsData = await fundamentalsRes.json();
    const history = fundamentalsData?.Earnings?.History || {};

    // Diagnostic logging
    const historyKeys = Object.keys(history);
    console.log(`[getEarningsResult] ${upperSymbol}: Found ${historyKeys.length} earnings entries in history`);

    if (historyKeys.length > 0) {
      const mostRecentKey = historyKeys.sort().reverse()[0];
      const mostRecentEntry = history[mostRecentKey];
      console.log(`[getEarningsResult] ${upperSymbol}: Most recent entry key=${mostRecentKey}, reportDate=${mostRecentEntry?.reportDate}, epsActual=${mostRecentEntry?.epsActual}`);
    }

    // Convert to array and sort by date (newest first)
    const today = new Date();
    const allEntries = Object.entries(history)
      .map(([fiscalPeriodKey, values]) => ({
        fiscalPeriodKey,
        reportDate: values.reportDate || fiscalPeriodKey,
        epsActual: values.epsActual,
        epsEstimate: values.epsEstimate,
        epsDifference: values.epsDifference,
        surprisePercent: values.surprisePercent,
        beforeAfterMarket: values.beforeAfterMarket,
        fiscalQuarter: values.fiscalQuarter,
        fiscalYear: values.fiscalYear
      }));

    // Log filtering diagnostics
    const withActualEps = allEntries.filter(e => e.epsActual !== null && e.epsActual !== undefined);
    const inPast = allEntries.filter(e => new Date(e.reportDate) <= today);
    console.log(`[getEarningsResult] ${upperSymbol}: ${allEntries.length} total, ${withActualEps.length} have epsActual, ${inPast.length} in past`);

    const entries = allEntries
      .filter(e => {
        if (e.epsActual === null || e.epsActual === undefined) return false;
        return new Date(e.reportDate) <= today;
      })
      .sort((a, b) => new Date(b.reportDate) - new Date(a.reportDate));

    console.log(`[getEarningsResult] ${upperSymbol}: ${entries.length} entries after filtering`);

    if (entries.length === 0) {
      const pendingEntries = allEntries
        .filter(e => e.epsActual === null || e.epsActual === undefined)
        .filter(e => new Date(e.reportDate) <= today)
        .slice(0, 3);

      return {
        success: false,
        symbol: upperSymbol,
        resolved: false,
        error: 'No earnings results found yet',
        debug: {
          totalHistoryEntries: historyKeys.length,
          entriesWithEpsActual: withActualEps.length,
          entriesInPast: inPast.length,
          pendingEntries: pendingEntries.map(e => ({
            reportDate: e.reportDate,
            fiscalPeriodKey: e.fiscalPeriodKey,
            epsActual: e.epsActual,
            epsEstimate: e.epsEstimate
          }))
        },
        checkedAt: new Date().toISOString()
      };
    }

    // Find the matching entry
    let result = entries[0]; // Default to most recent

    if (targetDate) {
      const targetDateObj = new Date(targetDate);
      // Find entry within 5 days of target date
      const matchedEntry = entries.find(e => {
        const reportDate = new Date(e.reportDate);
        const diffDays = Math.abs((reportDate - targetDateObj) / (1000 * 60 * 60 * 24));
        return diffDays <= 5;
      });

      if (matchedEntry) {
        result = matchedEntry;
        console.log(`[getEarningsResult] ${upperSymbol}: Matched entry for ${targetDate} -> ${result.reportDate} (Q${result.fiscalQuarter} ${result.fiscalYear})`);
      } else {
        const availableDates = entries.slice(0, 5).map(e => ({
          reportDate: e.reportDate,
          quarter: `Q${e.fiscalQuarter} ${e.fiscalYear}`,
          epsActual: e.epsActual
        }));

        console.warn(`[getEarningsResult] ${upperSymbol}: No match for target ${targetDate}. Available: ${availableDates.map(d => d.reportDate).join(', ')}`);

        return {
          success: false,
          symbol: upperSymbol,
          resolved: false,
          error: `No earnings result found near ${targetDate}`,
          closestResult: entries[0]?.reportDate,
          availableDates,
          checkedAt: new Date().toISOString()
        };
      }
    }

    // Verify we have actual EPS data
    if (result.epsActual === null || result.epsActual === undefined) {
      return {
        success: false,
        symbol: upperSymbol,
        resolved: false,
        error: 'Earnings report pending - no actual EPS yet',
        reportDate: result.reportDate,
        checkedAt: new Date().toISOString()
      };
    }

    // Determine beat/miss
    let didBeat, didMiss, determinationMethod;

    if (result.surprisePercent !== null && result.surprisePercent !== undefined) {
      didBeat = result.surprisePercent > 0;
      didMiss = result.surprisePercent < 0;
      determinationMethod = 'surprisePercent';

      const hasEstimate = result.epsEstimate !== null && result.epsEstimate !== undefined;
      if (hasEstimate) {
        const calcBeat = result.epsActual > result.epsEstimate;
        const calcMiss = result.epsActual < result.epsEstimate;

        if ((didBeat && calcMiss) || (didMiss && calcBeat)) {
          console.warn(`[getEarningsResult] ${upperSymbol}: DATA MISMATCH - ` +
            `surprisePercent=${result.surprisePercent.toFixed(2)}% suggests ${didBeat ? 'BEAT' : 'MISS'}, ` +
            `but epsActual(${result.epsActual}) vs epsEstimate(${result.epsEstimate}) suggests ${calcBeat ? 'BEAT' : 'MISS'}`);
        }
      }
    } else {
      didBeat = result.epsActual > result.epsEstimate;
      didMiss = result.epsActual < result.epsEstimate;
      determinationMethod = 'calculated';

      console.log(`[getEarningsResult] ${upperSymbol}: No surprisePercent available, using calculated beat/miss`);
    }

    const outcome = didBeat ? 'beat' : (didMiss ? 'miss' : 'meet');

    // Get stock price move after earnings
    const priceMove = await getEarningsDayMove(upperSymbol, result.reportDate, result.beforeAfterMarket, apiKey);
    const magnitude = getMagnitudeBand(priceMove);

    console.log(`[getEarningsResult] ${upperSymbol}: ${outcome} (EPS: ${result.epsActual} vs ${result.epsEstimate}), Move: ${priceMove?.toFixed(1)}% (${magnitude})`);

    return {
      success: true,
      symbol: upperSymbol,
      resolved: true,
      reportDate: result.reportDate,
      fiscalQuarter: result.fiscalQuarter,
      fiscalYear: result.fiscalYear,
      quarter: result.fiscalQuarter && result.fiscalYear ? `Q${result.fiscalQuarter} ${result.fiscalYear}` : null,
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
    };

  } catch (error) {
    console.error(`[getEarningsResult] Error for ${upperSymbol}:`, error);
    return {
      success: false,
      symbol: upperSymbol,
      resolved: false,
      error: error.message,
      checkedAt: new Date().toISOString()
    };
  }
}
