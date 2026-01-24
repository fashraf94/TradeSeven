// api/earnings/_helpers/getEarningsResult.js
// Shared earnings result logic - used by both results.js API and resolve-tournament.js
//
// This avoids internal HTTP calls which can fail silently on Vercel
//
// Created: Jan 2026 during tournament resolution debugging
// Dependencies: dateUtils (shared date handling), earningsConfig (magnitude thresholds)

import { safeParseDate, toYYYYMMDD } from '../../../src/utils/dateUtils.js';
import { MAGNITUDE_THRESHOLDS } from '../../../src/config/earningsConfig.js';

// Structured logging helper
const LOG_PREFIX = '[getEarningsResult]';

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const prefix = `${timestamp} ${LOG_PREFIX}`;

  if (data) {
    console[level](`${prefix} ${message}`, typeof data === 'object' ? JSON.stringify(data) : data);
  } else {
    console[level](`${prefix} ${message}`);
  }
}

const logInfo = (message, data) => log('log', message, data);
const logWarn = (message, data) => log('warn', message, data);
const logError = (message, data) => log('error', message, data);

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
      logWarn(`${symbol}: Could not parse reportDate: ${reportDate}`);
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
    logInfo(`${symbol}: Fetching price data`, { url: priceUrl.replace(apiKey, 'API_KEY_HIDDEN'), from: fromStr, to: toStr });

    const priceRes = await fetch(priceUrl);

    if (!priceRes.ok) {
      logWarn(`${symbol}: Price API failed`, { status: priceRes.status, statusText: priceRes.statusText });
      return null;
    }

    const prices = await priceRes.json();
    logInfo(`${symbol}: Price data received`, { dataPoints: prices?.length || 0 });

    if (!Array.isArray(prices) || prices.length < 2) {
      logWarn(`${symbol}: Insufficient price data`, { dataPoints: prices?.length || 0, required: 2 });
      return null;
    }

    // Sort by date
    prices.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Find the report date index
    const reportDateStr = toYYYYMMDD(reportDate);
    const reportDayIndex = prices.findIndex(p => p.date >= reportDateStr);

    if (reportDayIndex < 0) {
      logWarn(`${symbol}: Report date not found in price data`, {
        reportDate: reportDateStr,
        availableDates: prices.map(p => p.date)
      });
      return null;
    }

    // Get lock price (day before earnings) and reaction price
    let lockPrice, reactionPrice;
    let lockDate, reactionDate;

    if (timing === 'BeforeMarket') {
      // Pre-market: Lock = previous day close, Reaction = report day close
      if (reportDayIndex === 0) {
        logWarn(`${symbol}: No previous day data for pre-market earnings`, {
          timing,
          reportDate: reportDateStr,
          firstAvailableDate: prices[0]?.date
        });
        return null;
      }
      lockPrice = prices[reportDayIndex - 1].adjusted_close || prices[reportDayIndex - 1].close;
      reactionPrice = prices[reportDayIndex].adjusted_close || prices[reportDayIndex].close;
      lockDate = prices[reportDayIndex - 1].date;
      reactionDate = prices[reportDayIndex].date;
    } else {
      // After-market: Lock = report day close, Reaction = next day close
      if (reportDayIndex >= prices.length - 1) {
        logWarn(`${symbol}: No next day data for after-market earnings - data not available yet`, {
          timing,
          reportDate: reportDateStr,
          lastAvailableDate: prices[prices.length - 1]?.date,
          message: 'Will retry in next cron run'
        });
        return null;
      }
      lockPrice = prices[reportDayIndex].adjusted_close || prices[reportDayIndex].close;
      reactionPrice = prices[reportDayIndex + 1].adjusted_close || prices[reportDayIndex + 1].close;
      lockDate = prices[reportDayIndex].date;
      reactionDate = prices[reportDayIndex + 1].date;
    }

    if (!lockPrice || !reactionPrice) {
      logWarn(`${symbol}: Missing price values for calculation`, { lockPrice, reactionPrice });
      return null;
    }

    const percentMove = ((reactionPrice - lockPrice) / lockPrice) * 100;
    logInfo(`${symbol}: Price move calculated`, {
      timing,
      lockDate,
      lockPrice: lockPrice.toFixed(2),
      reactionDate,
      reactionPrice: reactionPrice.toFixed(2),
      percentMove: percentMove.toFixed(2) + '%'
    });

    return percentMove;

  } catch (error) {
    logError(`${symbol}: Error getting price move`, { error: error.message, stack: error.stack });
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
    logError('EODHD_API_KEY not configured in environment variables');
    return {
      success: false,
      symbol,
      resolved: false,
      error: 'API key not configured'
    };
  }

  const upperSymbol = symbol.toUpperCase();
  const tickerWithExchange = `${upperSymbol}.US`;

  logInfo(`${upperSymbol}: Starting earnings result fetch`, { targetDate: targetDate || 'latest' });

  try {
    // Fetch earnings history to get the actual result
    const fundamentalsUrl = `https://eodhd.com/api/fundamentals/${tickerWithExchange}?api_token=${apiKey}&fmt=json`;
    logInfo(`${upperSymbol}: Calling EODHD fundamentals API`, {
      url: fundamentalsUrl.replace(apiKey, 'API_KEY_HIDDEN')
    });

    const fundamentalsRes = await fetch(fundamentalsUrl);

    if (!fundamentalsRes.ok) {
      logError(`${upperSymbol}: Fundamentals API error`, {
        status: fundamentalsRes.status,
        statusText: fundamentalsRes.statusText
      });
      throw new Error(`Fundamentals API error: ${fundamentalsRes.status}`);
    }

    const fundamentalsData = await fundamentalsRes.json();
    const history = fundamentalsData?.Earnings?.History || {};

    // Diagnostic logging
    const historyKeys = Object.keys(history);
    logInfo(`${upperSymbol}: EODHD response received`, {
      totalHistoryEntries: historyKeys.length,
      hasEarningsData: historyKeys.length > 0
    });

    if (historyKeys.length > 0) {
      const mostRecentKey = historyKeys.sort().reverse()[0];
      const mostRecentEntry = history[mostRecentKey];
      logInfo(`${upperSymbol}: Most recent earnings entry`, {
        fiscalPeriodKey: mostRecentKey,
        reportDate: mostRecentEntry?.reportDate,
        epsActual: mostRecentEntry?.epsActual,
        epsEstimate: mostRecentEntry?.epsEstimate,
        hasActualEps: mostRecentEntry?.epsActual !== null && mostRecentEntry?.epsActual !== undefined
      });
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
    logInfo(`${upperSymbol}: Filtering earnings entries`, {
      totalEntries: allEntries.length,
      withActualEps: withActualEps.length,
      inPast: inPast.length,
      today: today.toISOString().split('T')[0]
    });

    const entries = allEntries
      .filter(e => {
        if (e.epsActual === null || e.epsActual === undefined) return false;
        return new Date(e.reportDate) <= today;
      })
      .sort((a, b) => new Date(b.reportDate) - new Date(a.reportDate));

    logInfo(`${upperSymbol}: ${entries.length} entries after filtering (with epsActual and in past)`);

    if (entries.length === 0) {
      const pendingEntries = allEntries
        .filter(e => e.epsActual === null || e.epsActual === undefined)
        .filter(e => new Date(e.reportDate) <= today)
        .slice(0, 3);

      logWarn(`${upperSymbol}: No earnings results found yet - EODHD hasn't updated epsActual`, {
        totalHistoryEntries: historyKeys.length,
        entriesWithEpsActual: withActualEps.length,
        entriesInPast: inPast.length,
        pendingEntries: pendingEntries.map(e => ({ reportDate: e.reportDate, epsEstimate: e.epsEstimate })),
        willRetry: true
      });

      return {
        success: false,
        symbol: upperSymbol,
        resolved: false,
        error: 'No earnings results found yet - awaiting EODHD data update',
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
      // Find entry within 7 days of target date (expanded from 5 for scheduling flexibility)
      const matchedEntry = entries.find(e => {
        const reportDate = new Date(e.reportDate);
        const diffDays = Math.abs((reportDate - targetDateObj) / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      });

      if (matchedEntry) {
        result = matchedEntry;
        logInfo(`${upperSymbol}: Matched entry for target date`, {
          targetDate,
          matchedReportDate: result.reportDate,
          quarter: `Q${result.fiscalQuarter} ${result.fiscalYear}`,
          epsActual: result.epsActual,
          epsEstimate: result.epsEstimate
        });
      } else {
        const availableDates = entries.slice(0, 5).map(e => ({
          reportDate: e.reportDate,
          quarter: `Q${e.fiscalQuarter} ${e.fiscalYear}`,
          epsActual: e.epsActual
        }));

        logWarn(`${upperSymbol}: No match for target date - date mismatch`, {
          targetDate,
          availableDates: availableDates.map(d => d.reportDate),
          closestDate: entries[0]?.reportDate
        });

        return {
          success: false,
          symbol: upperSymbol,
          resolved: false,
          error: `No earnings result found near ${targetDate} (possible date mismatch)`,
          closestResult: entries[0]?.reportDate,
          availableDates,
          checkedAt: new Date().toISOString()
        };
      }
    }

    // Verify we have actual EPS data
    if (result.epsActual === null || result.epsActual === undefined) {
      logWarn(`${upperSymbol}: Earnings report date found but epsActual is null`, {
        reportDate: result.reportDate,
        epsEstimate: result.epsEstimate,
        message: 'EODHD has the date but not the actual result yet'
      });
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
          logWarn(`${upperSymbol}: DATA MISMATCH in EODHD response`, {
            surprisePercent: result.surprisePercent,
            suggestedBySurprise: didBeat ? 'BEAT' : 'MISS',
            epsActual: result.epsActual,
            epsEstimate: result.epsEstimate,
            suggestedByCalculation: calcBeat ? 'BEAT' : 'MISS',
            note: 'Using surprisePercent as source of truth'
          });
        }
      }
    } else {
      didBeat = result.epsActual > result.epsEstimate;
      didMiss = result.epsActual < result.epsEstimate;
      determinationMethod = 'calculated';

      logInfo(`${upperSymbol}: No surprisePercent in EODHD data, using calculated beat/miss`, {
        epsActual: result.epsActual,
        epsEstimate: result.epsEstimate,
        calculatedOutcome: didBeat ? 'beat' : (didMiss ? 'miss' : 'meet')
      });
    }

    const outcome = didBeat ? 'beat' : (didMiss ? 'miss' : 'meet');

    // Get stock price move after earnings
    const priceMove = await getEarningsDayMove(upperSymbol, result.reportDate, result.beforeAfterMarket, apiKey);
    const magnitude = getMagnitudeBand(priceMove);

    logInfo(`${upperSymbol}: RESOLUTION COMPLETE`, {
      outcome,
      epsActual: result.epsActual,
      epsEstimate: result.epsEstimate,
      surprisePercent: result.surprisePercent,
      priceMove: priceMove !== null ? priceMove.toFixed(2) + '%' : 'N/A',
      magnitude,
      reportDate: result.reportDate,
      quarter: `Q${result.fiscalQuarter} ${result.fiscalYear}`,
      timing: result.beforeAfterMarket
    });

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
    logError(`${upperSymbol}: Error during earnings result fetch`, {
      error: error.message,
      stack: error.stack,
      targetDate
    });
    return {
      success: false,
      symbol: upperSymbol,
      resolved: false,
      error: error.message,
      checkedAt: new Date().toISOString()
    };
  }
}
