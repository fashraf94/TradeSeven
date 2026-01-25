/**
 * earningsCalendarService.js
 *
 * Fetches earnings calendar data from EODHD and calculates odds using
 * the Market-Informed Odds Engine (historical beat rates + price momentum).
 *
 * Previously integrated with Polymarket, but their API rarely had stock
 * earnings markets. Now uses our own odds calculation based on historical
 * data and sector analysis.
 */

import { enhanceEventWithParlays } from './earningsReactionsService';
import { getBatchOdds, hasIVData } from './oddsService';
import {
  PRIORITY_STOCKS,
  COMPANY_NAMES,
  COMPANY_SECTORS,
  SECTOR_BEAT_RATES
} from '../config/stockData.js';

// Cache for historical beat rates (to avoid repeated API calls)
const historicalBeatRateCache = new Map();
const BEAT_RATE_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Get beat odds for a symbol, using historical data if available
 * Falls back to sector-based defaults when no history exists
 *
 * @param {string} symbol - Stock symbol
 * @param {number|null} historicalBeatRate - Optional pre-fetched beat rate (0-100)
 * @returns {{ odds: number, sector: string, confidence: string, source: string }}
 */
function getSmartBeatOdds(symbol, historicalBeatRate = null) {
  const upperSymbol = symbol.toUpperCase();
  const sector = COMPANY_SECTORS[upperSymbol] || 'default';
  const sectorRate = SECTOR_BEAT_RATES[sector] || 0.70;

  // If we have a historical beat rate passed in, use it
  if (historicalBeatRate !== null && historicalBeatRate !== undefined) {
    // Convert from percentage (0-100) to decimal (0-1) if needed
    const beatRate = historicalBeatRate > 1 ? historicalBeatRate / 100 : historicalBeatRate;

    // Validate it's a reasonable rate
    if (beatRate >= 0 && beatRate <= 1) {
      // Blend historical rate (85%) with sector baseline (15%) for stability
      const blendedOdds = (beatRate * 0.85) + (sectorRate * 0.15);
      const clampedOdds = Math.min(0.95, Math.max(0.20, blendedOdds));

      return {
        odds: clampedOdds,
        sector,
        confidence: 'high', // We have actual data
        source: 'historical',
        historicalRate: beatRate,
        sectorRate
      };
    }
  }

  // Check cache for previously fetched historical rate
  const cached = historicalBeatRateCache.get(upperSymbol);
  if (cached && Date.now() - cached.timestamp < BEAT_RATE_CACHE_TTL) {
    const blendedOdds = (cached.beatRate * 0.85) + (sectorRate * 0.15);
    const clampedOdds = Math.min(0.95, Math.max(0.20, blendedOdds));

    return {
      odds: clampedOdds,
      sector,
      confidence: 'high',
      source: 'cached_historical',
      historicalRate: cached.beatRate,
      sectorRate
    };
  }

  // Fall back to sector-based defaults
  // Add small consistent variation per stock (based on symbol hash)
  const hash = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const variation = ((hash % 7) - 3) / 100; // -0.03 to +0.03

  const odds = Math.min(0.85, Math.max(0.60, sectorRate + variation));

  return {
    odds,
    sector,
    confidence: COMPANY_SECTORS[upperSymbol] ? 'medium' : 'low',
    source: 'sector_default',
    sectorRate
  };
}

/**
 * Legacy function - kept for backwards compatibility
 * Use getSmartBeatOdds for new code
 */
function getSectorBeatOdds(symbol) {
  return getSmartBeatOdds(symbol, null);
}

/**
 * Cache a historical beat rate for a symbol (called after API fetch)
 */
function cacheHistoricalBeatRate(symbol, beatRate) {
  if (beatRate !== null && beatRate !== undefined) {
    const rate = beatRate > 1 ? beatRate / 100 : beatRate;
    historicalBeatRateCache.set(symbol.toUpperCase(), {
      beatRate: rate,
      timestamp: Date.now()
    });
  }
}

/**
 * Convert odds to price (based on $10K budget)
 */
export function oddsToPrice(odds, budget = 10000) {
  return Math.round(odds * budget);
}

/**
 * Calculate prediction metrics
 */
export function calculatePredictionMetrics(event, prediction) {
  const odds = prediction === 'beat' ? event.beatOdds : event.missOdds;
  const cost = prediction === 'beat' ? event.yesCost : event.noCost;

  let multiplier;
  if (odds >= 0.90) multiplier = 1.1;
  else if (odds >= 0.70) multiplier = 1.3;
  else if (odds >= 0.50) multiplier = 1.5;
  else if (odds >= 0.30) multiplier = 2.0;
  else multiplier = 3.0;

  return {
    cost,
    odds,
    multiplier,
    potentialPoints: Math.round(cost * multiplier),
    riskLevel: odds >= 0.70 ? 'low' : odds >= 0.50 ? 'medium' : 'high'
  };
}

// ===========================================
// EODHD Calendar + Market-Informed Odds Engine
// ===========================================

/**
 * Fetch EODHD earnings calendar
 */
async function fetchEODHDCalendar(days = 14) {
  console.log('[EODHD] Fetching calendar for', days, 'days...');
  try {
    const url = `/api/stocks/earnings-calendar?days=${days}`;
    console.log('[EODHD] URL:', url);
    const response = await fetch(url);
    console.log('[EODHD] Response status:', response.status);
    if (!response.ok) {
      const text = await response.text();
      console.error('[EODHD] Error response:', text);
      throw new Error(`EODHD calendar error: ${response.status}`);
    }
    const data = await response.json();
    console.log(`[EODHD] Calendar returned ${data.events?.length || 0} events`);
    if (data.events?.length > 0) {
      console.log('[EODHD] Sample symbols:', data.events.slice(0, 5).map(e => e.symbol));
    }
    return data.events || [];
  } catch (error) {
    console.error('[EODHD] Calendar fetch error:', error.message);
    return [];
  }
}

/**
 * Get earnings calendar with market-informed odds
 * Uses EODHD for calendar data and our Odds Engine for beat probabilities
 */
export async function getHybridEarningsCalendar(days = 14) {
  console.log('[Calendar] >>>>>>> FUNCTION ENTERED <<<<<<<');
  console.log('[Calendar] ========== STARTING CALENDAR FETCH ==========');
  console.log('[Calendar] Days:', days);
  const fetchTimestamp = new Date();

  try {
    // Fetch calendar from EODHD
    console.log('[Calendar] Fetching from EODHD...');
    const eohdCalendar = await fetchEODHDCalendar(days);

    console.log(`[Calendar] EODHD returned: ${eohdCalendar.length} events`);
    if (eohdCalendar.length > 0) {
      console.log('[Calendar] EODHD symbols:', eohdCalendar.slice(0, 10).map(e => e.symbol));
    }

    if (eohdCalendar.length === 0) {
      console.warn('[Calendar] No EODHD data available');
      return [];
    }

    console.log('[Calendar] Processing EODHD events with Market-Informed Odds Engine');

    // Get today's date for filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log('[Calendar] Today (for date filter):', today.toISOString());

    // DEBUG: Log sample raw EODHD data
    console.log('[Calendar] Sample EODHD raw data (first 5):');
    eohdCalendar.slice(0, 5).forEach((e, i) => {
      console.log(`  ${i + 1}. symbol="${e.symbol}", companyName="${e.companyName}", reportDate="${e.reportDate}"`);
    });

    // Track rejection reasons
    const rejectionCounts = {
      hasDash: 0,
      hasDot: 0,
      tooLong: 0,
      emptySymbol: 0,
      pastDate: 0,
      otcForeign: 0,
      preferredShare: 0,
      specialSecurity: 0,
      hasNumbers: 0,
      weirdPrefix: 0,
      passed: 0
    };
    const rejectionSamples = [];

    /**
     * Check if a ticker is a valid, tradeable US stock
     * Filters out: preferred shares, OTC, foreign ADRs, warrants, units, rights
     */
    const isValidTicker = (symbol) => {
      const s = (symbol || '').toUpperCase().trim();
      if (!s) return { valid: false, reason: 'emptySymbol' };

      // Reject symbols with special characters (- or .)
      if (s.includes('-')) return { valid: false, reason: 'hasDash' };
      if (s.includes('.')) return { valid: false, reason: 'hasDot' };

      // Reject if too long (normal US tickers are 1-4 chars, some 5)
      if (s.length > 5) return { valid: false, reason: 'tooLong' };

      // Reject if contains numbers (warrants like SPAC.WS often become SPACWS)
      if (/[0-9]/.test(s)) return { valid: false, reason: 'hasNumbers' };

      // Reject preferred shares - patterns like WFCNP, JPMPR, BOFAPR
      // These end with P followed by a letter (not at start of 2-char symbols)
      if (s.length >= 4 && /P[A-Z]$/.test(s)) return { valid: false, reason: 'preferredShare' };

      // Reject OTC/foreign stocks (often end in F for foreign, Y for ADR)
      if (s.length >= 4 && s.endsWith('F')) return { valid: false, reason: 'otcForeign' };
      if (s.length >= 4 && s.endsWith('Y')) return { valid: false, reason: 'otcForeign' };

      // Reject warrants (W suffix), units (U suffix), rights (R suffix)
      // But allow 1-2 char symbols like F (Ford), W (Wayfair), U (Unity)
      if (s.length >= 3 && s.endsWith('W') && !['BAW', 'CAW', 'DAW', 'SAW'].includes(s)) {
        return { valid: false, reason: 'specialSecurity' };
      }
      if (s.length >= 4 && s.endsWith('U')) return { valid: false, reason: 'specialSecurity' };
      if (s.length >= 4 && s.endsWith('R') && !['UBER', 'ABBR'].includes(s)) {
        return { valid: false, reason: 'specialSecurity' };
      }

      // Reject weird prefixes (ZZ, XX patterns often indicate test/placeholder)
      if (/^(ZZ|XX|YY)/.test(s)) return { valid: false, reason: 'weirdPrefix' };

      return { valid: true, reason: 'passed' };
    };

    // Filter for quality US stocks with future dates
    // NOTE: We don't filter on companyName because EODHD returns symbol as companyName
    // We use COMPANY_NAMES lookup later to get proper names
    const qualityEvents = eohdCalendar.filter(event => {
      const symbol = event.symbol || '';

      // Check if valid ticker
      const { valid, reason } = isValidTicker(symbol);
      if (!valid) {
        rejectionCounts[reason] = (rejectionCounts[reason] || 0) + 1;
        if (rejectionSamples.length < 10) {
          rejectionSamples.push({ symbol, reason });
        }
        return false;
      }

      // Must be future date (today or later) - use local date comparison
      // Parse reportDate as local date to avoid timezone issues
      const [year, month, day] = event.reportDate.split('-').map(Number);
      const eventDate = new Date(year, month - 1, day);
      eventDate.setHours(0, 0, 0, 0);

      if (eventDate < today) {
        rejectionCounts.pastDate++;
        if (rejectionSamples.length < 10) {
          rejectionSamples.push({
            symbol,
            reportDate: event.reportDate,
            parsed: eventDate.toDateString(),
            today: today.toDateString(),
            reason: 'past date'
          });
        }
        return false;
      }

      rejectionCounts.passed++;
      return true;
    });

    console.log('[Calendar] Rejection counts:', rejectionCounts);
    console.log('[Calendar] Rejection samples:', rejectionSamples);
    console.log(`[Calendar] Quality filtered: ${qualityEvents.length} of ${eohdCalendar.length}`);

    // Separate priority and non-priority stocks
    const priorityEvents = qualityEvents.filter(e => PRIORITY_STOCKS.has(e.symbol.toUpperCase()));
    const otherEvents = qualityEvents.filter(e => !PRIORITY_STOCKS.has(e.symbol.toUpperCase()));

    // Sort each group by date
    const sortByDate = (a, b) => new Date(a.reportDate) - new Date(b.reportDate);
    priorityEvents.sort(sortByDate);
    otherEvents.sort(sortByDate);

    // Ensure we have coverage across all days
    // Group priority events by date
    const priorityByDate = {};
    priorityEvents.forEach(e => {
      const date = e.reportDate.split('T')[0];
      if (!priorityByDate[date]) priorityByDate[date] = [];
      priorityByDate[date].push(e);
    });

    // Take up to 12 priority stocks per day to ensure variety
    const balancedPriority = [];
    Object.keys(priorityByDate).sort().forEach(date => {
      const dayEvents = priorityByDate[date].slice(0, 12); // Max 12 per day
      balancedPriority.push(...dayEvents);
    });

    // If we have less than 35 priority stocks, fill with other quality stocks
    let combinedEvents = [...balancedPriority];
    if (combinedEvents.length < 35) {
      const needed = 35 - combinedEvents.length;
      combinedEvents.push(...otherEvents.slice(0, needed));
    }

    // Cap at 50 total
    const limitedEvents = combinedEvents.slice(0, 50);

    console.log(`[Calendar] Priority stocks found: ${priorityEvents.length}`);
    console.log(`[Calendar] Balanced to ${balancedPriority.length} priority across ${Object.keys(priorityByDate).length} days`);
    console.log(`[Calendar] Final count: ${limitedEvents.length} events`);

    const sortedEvents = limitedEvents;
    if (sortedEvents.length > 0) {
      // Show with lookup names
      console.log('[Calendar] Sample companies:', sortedEvents.slice(0, 8).map(e =>
        `${e.symbol} (${COMPANY_NAMES[e.symbol.toUpperCase()] || 'unknown'})`
      ));
    }

    // Use Market-Informed Odds Engine v1.1 via oddsService
    // This fetches full odds with historical + price momentum + sector blend
    const prioritySymbols = sortedEvents
      .filter(e => COMPANY_NAMES[e.symbol.toUpperCase()])
      .slice(0, 20) // Limit to top 20 known companies
      .map(e => ({
        symbol: e.symbol.toUpperCase(),
        sector: COMPANY_SECTORS[e.symbol.toUpperCase()] || 'default'
      }));

    console.log(`[Calendar] Fetching full odds for ${prioritySymbols.length} priority stocks via oddsService...`);

    // Fetch odds from the full odds engine (includes price momentum)
    let oddsMap = new Map();
    try {
      oddsMap = await getBatchOdds(prioritySymbols);
      console.log(`[Calendar] Got full odds for ${oddsMap.size} stocks`);

      // Log sample results
      const samples = Array.from(oddsMap.entries()).slice(0, 5);
      samples.forEach(([symbol, odds]) => {
        const priceInfo = odds.breakdown?.priceMomentum?.display || 'N/A';
        console.log(`[Calendar] ${symbol}: ${odds.probabilityPercent}% beat (${odds.confidence}, price: ${priceInfo})`);
      });
    } catch (e) {
      console.warn(`[Calendar] Batch odds fetch failed, using fallbacks:`, e.message);
    }

    // Map events with full odds data from the engine
    const calendarEvents = sortedEvents.map(event => {
      const symbolUpper = event.symbol.toUpperCase();

      // Get full odds from the engine, or fallback to sector default
      const oddsData = oddsMap.get(symbolUpper);
      let beatOdds, confidence, oddsSource, breakdown;

      if (oddsData && !oddsData.fallback) {
        beatOdds = oddsData.probability;
        confidence = oddsData.confidence;
        oddsSource = oddsData.breakdown?.historical?.quarters >= 4 ? 'historical_plus_momentum' : 'sector_plus_momentum';
        breakdown = oddsData.breakdown;
      } else {
        // Fallback to sector default
        const sector = COMPANY_SECTORS[symbolUpper] || 'default';
        beatOdds = SECTOR_BEAT_RATES[sector] || 0.70;
        confidence = 'sector_default';
        oddsSource = 'sector_default';
        breakdown = null;
      }

      const yesCost = Math.round(beatOdds * 10000);
      const noCost = Math.round((1 - beatOdds) * 10000);

      // Use lookup table for company name, fallback to EODHD name or symbol
      const companyName = COMPANY_NAMES[symbolUpper] || event.companyName || symbolUpper;

      // Keep reportDate as YYYY-MM-DD string to avoid timezone conversion issues
      // When Date objects are converted to ISO strings (e.g., in Firebase storage),
      // the date can shift due to timezone differences (UTC vs local)
      const reportDateStr = event.reportDate.split('T')[0]; // Ensure YYYY-MM-DD format

      // Extract historical and momentum info for display
      const historicalRate = breakdown?.historical?.rate;
      const priceChange = breakdown?.priceMomentum?.change;

      // Check IV data availability (from odds or cache)
      const stockHasIVData = hasIVData(oddsData, symbolUpper);

      return {
        id: `eodhd_${symbolUpper}_${event.reportDate}`,
        symbol: symbolUpper,
        companyName: companyName,
        reportDate: reportDateStr, // Keep as string to avoid timezone issues
        reportTime: event.reportTime || 'TBD',
        beatOdds: beatOdds,
        missOdds: 1 - beatOdds,
        yesOdds: beatOdds,
        noOdds: 1 - beatOdds,
        beatProbability: Math.round(beatOdds * 100),
        yesCost,
        noCost,
        source: 'eodhd_only',
        dataSource: 'market_informed_v1.1',
        sector: COMPANY_SECTORS[symbolUpper] || 'default',
        oddsConfidence: confidence,
        oddsSource: oddsSource,
        historicalBeatRate: historicalRate !== null && historicalRate !== undefined
          ? Math.round(historicalRate * 100) : null,
        priceChange30d: priceChange !== null && priceChange !== undefined
          ? Math.round(priceChange * 10) / 10 : null,
        expectedMove: breakdown?.optionsIV?.expectedMove || null,
        oddsBreakdown: breakdown, // Full breakdown for transparency
        hasPolymarketOdds: false, // Legacy field, always false now
        hasCalculatedOdds: oddsSource !== 'sector_default',
        hasIVData: stockHasIVData, // IV data availability flag
        lastFetched: fetchTimestamp
      };
    });

    // Filter to only include stocks with IV data available (quality filter)
    const eventsWithIV = calendarEvents.filter(event => {
      if (!event.hasIVData) {
        console.log(`[Calendar Filter] Excluding ${event.symbol} - no IV data`);
        return false;
      }
      return true;
    });

    console.log(`[Calendar] IV Filter: ${calendarEvents.length} → ${eventsWithIV.length} events (${calendarEvents.length - eventsWithIV.length} excluded)`);

    // ========== CALENDAR BUILD SUMMARY ==========
    console.log(`[Calendar Build Summary]`);
    console.log(`  Raw events: ${eohdCalendar.length}`);
    console.log(`  After quality filter: ${qualityEvents.length}`);
    console.log(`  After priority sort: ${sortedEvents.length}`);
    console.log(`  After IV filter: ${eventsWithIV.length}`);
    console.log(`  Stocks excluded for no IV: ${calendarEvents.length - eventsWithIV.length}`);

    // Enhance with parlays (only events that passed IV filter)
    const enhanced = eventsWithIV.map(event => enhanceEventWithParlays(event));

    console.log(`[Calendar] Returning ${enhanced.length} events with market-informed odds`);
    return enhanced;

  } catch (error) {
    console.error('[Calendar] Error:', error);
    return [];
  }
}

/**
 * Get historical earnings events within a date range (for testing old tournaments)
 *
 * This calls the backend API which uses EODHD's fundamentals endpoint to get past earnings data,
 * since the calendar endpoint only returns future events.
 *
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} - Array of event-like objects for bot generation
 */
export async function getHistoricalEarningsForDateRange(startDate, endDate) {
  console.log(`[Historical] Fetching earnings between ${startDate} and ${endDate}`);

  try {
    // Call our backend API which handles EODHD requests server-side
    const url = `/api/stocks/earnings-historical-range?startDate=${startDate}&endDate=${endDate}`;
    console.log(`[Historical] Calling backend: ${url}`);

    const response = await fetch(url);
    console.log(`[Historical] Response status: ${response.status}`);

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Historical] API error: ${text}`);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[Historical] API response:`, data);

    if (!data.success) {
      console.error(`[Historical] API returned error:`, data.error);
      return [];
    }

    const events = data.events || [];
    console.log(`[Historical] Found ${events.length} events from ${data.stocksChecked} stocks checked`);

    // Log the events found
    if (events.length > 0) {
      console.log('[Historical] Events:');
      events.forEach(e => console.log(`  - ${e.symbol}: ${e.reportDate} (${e.companyName})`));
    }

    return events;

  } catch (error) {
    console.error('[Historical] Error fetching historical earnings:', error);
    return [];
  }
}

export default {
  getHybridEarningsCalendar,
  getHistoricalEarningsForDateRange,
  calculatePredictionMetrics,
  oddsToPrice
};
