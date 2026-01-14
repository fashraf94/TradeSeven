/**
 * polymarketService.js
 *
 * Fetches earnings prediction data from Polymarket's free Gamma API.
 * No authentication required.
 */

import { enhanceEventWithParlays } from './earningsReactionsService';

// Use our Vercel proxy to avoid CORS issues
const GAMMA_API_BASE = '/api/polymarket';

// Cache for 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;
let earningsCache = { data: null, lastFetched: null };

// Search queries that will find earnings events
const EARNINGS_SEARCH_QUERIES = [
  'beat quarterly earnings',
  'quarterly earnings'
];

// Known stock symbols for fallback matching
const KNOWN_SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSM', 'TSLA', 'AMD',
  'JPM', 'GS', 'MS', 'BAC', 'WFC', 'C', 'BLK', 'PNC', 'USB', 'TFC',
  'NFLX', 'AAL', 'UAL', 'DAL', 'LUV', 'STT', 'IBKR', 'TXN', 'SCHW',
  'UNH', 'JNJ', 'PFE', 'MRK', 'ABBV', 'LLY', 'BMY', 'GILD', 'AMGN',
  'V', 'MA', 'PYPL', 'SQ', 'COIN', 'HOOD',
  'WMT', 'TGT', 'COST', 'HD', 'LOW',
  'DIS', 'CMCSA', 'T', 'VZ', 'TMUS',
  'XOM', 'CVX', 'COP', 'SLB', 'EOG',
  'BA', 'LMT', 'RTX', 'NOC', 'GD',
  'CAT', 'DE', 'MMM', 'HON', 'GE',
  'KO', 'PEP', 'MCD', 'SBUX', 'CMG'
];

/**
 * Check if an event is a valid earnings event
 */
function isEarningsEvent(event) {
  const title = (event.title || '').toLowerCase();

  // Must contain these keywords
  const hasEarnings = title.includes('earnings');
  const hasQuarterly = title.includes('quarterly');
  const hasBeat = title.includes('beat');

  // Must match the pattern "Will X beat quarterly earnings"
  const isEarningsPattern = hasEarnings && (hasBeat || hasQuarterly);

  // Exclude non-earnings events
  const excludeKeywords = [
    'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'crypto',
    'nfl', 'nba', 'mlb', 'nhl', 'soccer', 'football', 'basketball',
    'election', 'trump', 'biden', 'president', 'senate', 'congress',
    'fed', 'fomc', 'interest rate', 'inflation'
  ];

  const isExcluded = excludeKeywords.some(keyword => title.includes(keyword));

  return isEarningsPattern && !isExcluded;
}

/**
 * Extract stock symbol from title like "Will Goldman Sachs (GS) beat quarterly earnings?"
 */
function extractSymbolFromTitle(title) {
  if (!title) return null;

  // Pattern: "Will Company Name (TICKER) beat..."
  const tickerMatch = title.match(/\(([A-Z]{1,5})\)/);
  if (tickerMatch) {
    return tickerMatch[1];
  }

  // Fallback: try to find known symbols in the title
  const upperTitle = title.toUpperCase();
  for (const symbol of KNOWN_SYMBOLS) {
    // Check for word boundary to avoid partial matches
    const symbolRegex = new RegExp(`\\b${symbol}\\b`);
    if (symbolRegex.test(upperTitle)) {
      return symbol;
    }
  }

  return null;
}

/**
 * Extract company name from title
 */
function extractCompanyFromTitle(title) {
  if (!title) return null;

  // Pattern: "Will Company Name (TICKER) beat..."
  const match = title.match(/Will\s+(.+?)\s+\([A-Z]{1,5}\)/i);
  if (match) {
    return match[1].trim();
  }

  return null;
}

/**
 * Transform Polymarket event to our format
 */
function transformPolymarketEvent(event) {
  const title = event.title || '';
  const symbol = extractSymbolFromTitle(title);

  if (!symbol) {
    console.log('[Polymarket] No symbol found for:', title);
    return null;
  }

  const companyName = extractCompanyFromTitle(title) || symbol;

  // Get beat odds from the "Yes" outcome
  // Polymarket events have markets array with outcomes
  let beatOdds = 0.5;

  if (event.markets && event.markets[0]) {
    const market = event.markets[0];
    // outcomePrices is usually [yesPrice, noPrice] as JSON string
    if (market.outcomePrices) {
      try {
        const prices = JSON.parse(market.outcomePrices);
        beatOdds = parseFloat(prices[0]) || 0.5;
      } catch (e) {
        // Try direct access if not JSON
        if (typeof market.outcomePrices === 'number') {
          beatOdds = market.outcomePrices;
        }
      }
    }
  }

  // Get end date for when earnings will be reported
  const endDate = event.endDate || event.markets?.[0]?.endDate;

  // Calculate prices based on odds (using $10K budget)
  const yesCost = Math.round(beatOdds * 10000);
  const noCost = Math.round((1 - beatOdds) * 10000);

  return {
    id: event.id || `pm_${symbol}_${Date.now()}`,
    slug: event.slug,
    symbol,
    companyName,
    title,
    reportDate: endDate ? new Date(endDate) : null,
    reportTime: 'TBD',
    yesOdds: beatOdds,
    noOdds: 1 - beatOdds,
    beatOdds,
    missOdds: 1 - beatOdds,
    beatProbability: Math.round(beatOdds * 100),
    yesCost,
    noCost,
    volume: parseFloat(event.volume) || event.markets?.[0]?.volume || 0,
    source: 'polymarket',
    polymarketId: event.id,
    resolved: event.closed,
    lastUpdated: new Date()
  };
}

/**
 * Convert odds to price (based on $10K budget)
 */
export function oddsToPrice(odds, budget = 10000) {
  return Math.round(odds * budget);
}

// Test data for when API doesn't return earnings
const TEST_EARNINGS_DATA = [
  {
    id: 'test-jpm',
    slug: 'jpm-q4-earnings',
    symbol: 'JPM',
    companyName: 'JPMorgan Chase',
    reportDate: new Date('2026-01-15'),
    reportTime: 'BMO',
    yesOdds: 0.91,
    noOdds: 0.09,
    beatOdds: 0.91,
    missOdds: 0.09,
    beatProbability: 91,
    yesCost: 9100,
    noCost: 900,
    volume: 50000,
    title: 'Will JPMorgan Chase (JPM) beat quarterly earnings?'
  },
  {
    id: 'test-gs',
    slug: 'gs-q4-earnings',
    symbol: 'GS',
    companyName: 'Goldman Sachs',
    reportDate: new Date('2026-01-15'),
    reportTime: 'BMO',
    yesOdds: 0.88,
    noOdds: 0.12,
    beatOdds: 0.88,
    missOdds: 0.12,
    beatProbability: 88,
    yesCost: 8800,
    noCost: 1200,
    volume: 42000,
    title: 'Will Goldman Sachs (GS) beat quarterly earnings?'
  },
  {
    id: 'test-bac',
    slug: 'bac-q4-earnings',
    symbol: 'BAC',
    companyName: 'Bank of America',
    reportDate: new Date('2026-01-16'),
    reportTime: 'BMO',
    yesOdds: 0.85,
    noOdds: 0.15,
    beatOdds: 0.85,
    missOdds: 0.15,
    beatProbability: 85,
    yesCost: 8500,
    noCost: 1500,
    volume: 45000,
    title: 'Will Bank of America (BAC) beat quarterly earnings?'
  },
  {
    id: 'test-wfc',
    slug: 'wfc-q4-earnings',
    symbol: 'WFC',
    companyName: 'Wells Fargo',
    reportDate: new Date('2026-01-15'),
    reportTime: 'BMO',
    yesOdds: 0.78,
    noOdds: 0.22,
    beatOdds: 0.78,
    missOdds: 0.22,
    beatProbability: 78,
    yesCost: 7800,
    noCost: 2200,
    volume: 35000,
    title: 'Will Wells Fargo (WFC) beat quarterly earnings?'
  },
  {
    id: 'test-c',
    slug: 'c-q4-earnings',
    symbol: 'C',
    companyName: 'Citigroup',
    reportDate: new Date('2026-01-15'),
    reportTime: 'BMO',
    yesOdds: 0.72,
    noOdds: 0.28,
    beatOdds: 0.72,
    missOdds: 0.28,
    beatProbability: 72,
    yesCost: 7200,
    noCost: 2800,
    volume: 28000,
    title: 'Will Citigroup (C) beat quarterly earnings?'
  },
  {
    id: 'test-ms',
    slug: 'ms-q4-earnings',
    symbol: 'MS',
    companyName: 'Morgan Stanley',
    reportDate: new Date('2026-01-16'),
    reportTime: 'BMO',
    yesOdds: 0.82,
    noOdds: 0.18,
    beatOdds: 0.82,
    missOdds: 0.18,
    beatProbability: 82,
    yesCost: 8200,
    noCost: 1800,
    volume: 38000,
    title: 'Will Morgan Stanley (MS) beat quarterly earnings?'
  },
  {
    id: 'test-blk',
    slug: 'blk-q4-earnings',
    symbol: 'BLK',
    companyName: 'BlackRock',
    reportDate: new Date('2026-01-15'),
    reportTime: 'BMO',
    yesOdds: 0.79,
    noOdds: 0.21,
    beatOdds: 0.79,
    missOdds: 0.21,
    beatProbability: 79,
    yesCost: 7900,
    noCost: 2100,
    volume: 25000,
    title: 'Will BlackRock (BLK) beat quarterly earnings?'
  },
  {
    id: 'test-tsm',
    slug: 'tsm-q4-earnings',
    symbol: 'TSM',
    companyName: 'Taiwan Semiconductor',
    reportDate: new Date('2026-01-16'),
    reportTime: 'BMO',
    yesOdds: 0.94,
    noOdds: 0.06,
    beatOdds: 0.94,
    missOdds: 0.06,
    beatProbability: 94,
    yesCost: 9400,
    noCost: 600,
    volume: 65000,
    title: 'Will Taiwan Semiconductor (TSM) beat quarterly earnings?'
  },
  {
    id: 'test-dal',
    slug: 'dal-q4-earnings',
    symbol: 'DAL',
    companyName: 'Delta Air Lines',
    reportDate: new Date('2026-01-10'),
    reportTime: 'BMO',
    yesOdds: 0.64,
    noOdds: 0.36,
    beatOdds: 0.64,
    missOdds: 0.36,
    beatProbability: 64,
    yesCost: 6400,
    noCost: 3600,
    volume: 30000,
    title: 'Will Delta Air Lines (DAL) beat quarterly earnings?'
  },
  {
    id: 'test-unh',
    slug: 'unh-q4-earnings',
    symbol: 'UNH',
    companyName: 'UnitedHealth',
    reportDate: new Date('2026-01-16'),
    reportTime: 'BMO',
    yesOdds: 0.86,
    noOdds: 0.14,
    beatOdds: 0.86,
    missOdds: 0.14,
    beatProbability: 86,
    yesCost: 8600,
    noCost: 1400,
    volume: 55000,
    title: 'Will UnitedHealth (UNH) beat quarterly earnings?'
  },
  {
    id: 'test-pnc',
    slug: 'pnc-q4-earnings',
    symbol: 'PNC',
    companyName: 'PNC Financial',
    reportDate: new Date('2026-01-15'),
    reportTime: 'BMO',
    yesOdds: 0.68,
    noOdds: 0.32,
    beatOdds: 0.68,
    missOdds: 0.32,
    beatProbability: 68,
    yesCost: 6800,
    noCost: 3200,
    volume: 18000,
    title: 'Will PNC Financial (PNC) beat quarterly earnings?'
  },
  {
    id: 'test-nflx',
    slug: 'nflx-q4-earnings',
    symbol: 'NFLX',
    companyName: 'Netflix',
    reportDate: new Date('2026-01-21'),
    reportTime: 'AMC',
    yesOdds: 0.76,
    noOdds: 0.24,
    beatOdds: 0.76,
    missOdds: 0.24,
    beatProbability: 76,
    yesCost: 7600,
    noCost: 2400,
    volume: 72000,
    title: 'Will Netflix (NFLX) beat quarterly earnings?'
  },
  {
    id: 'test-jnj',
    slug: 'jnj-q4-earnings',
    symbol: 'JNJ',
    companyName: 'Johnson & Johnson',
    reportDate: new Date('2026-01-22'),
    reportTime: 'BMO',
    yesOdds: 0.81,
    noOdds: 0.19,
    beatOdds: 0.81,
    missOdds: 0.19,
    beatProbability: 81,
    yesCost: 8100,
    noCost: 1900,
    volume: 48000,
    title: 'Will Johnson & Johnson (JNJ) beat quarterly earnings?'
  },
  {
    id: 'test-aapl',
    slug: 'aapl-q1-earnings',
    symbol: 'AAPL',
    companyName: 'Apple',
    reportDate: new Date('2026-01-30'),
    reportTime: 'AMC',
    yesOdds: 0.89,
    noOdds: 0.11,
    beatOdds: 0.89,
    missOdds: 0.11,
    beatProbability: 89,
    yesCost: 8900,
    noCost: 1100,
    volume: 120000,
    title: 'Will Apple (AAPL) beat quarterly earnings?'
  },
  {
    id: 'test-msft',
    slug: 'msft-q2-earnings',
    symbol: 'MSFT',
    companyName: 'Microsoft',
    reportDate: new Date('2026-01-29'),
    reportTime: 'AMC',
    yesOdds: 0.92,
    noOdds: 0.08,
    beatOdds: 0.92,
    missOdds: 0.08,
    beatProbability: 92,
    yesCost: 9200,
    noCost: 800,
    volume: 115000,
    title: 'Will Microsoft (MSFT) beat quarterly earnings?'
  },
  {
    id: 'test-meta',
    slug: 'meta-q4-earnings',
    symbol: 'META',
    companyName: 'Meta Platforms',
    reportDate: new Date('2026-01-29'),
    reportTime: 'AMC',
    yesOdds: 0.83,
    noOdds: 0.17,
    beatOdds: 0.83,
    missOdds: 0.17,
    beatProbability: 83,
    yesCost: 8300,
    noCost: 1700,
    volume: 95000,
    title: 'Will Meta Platforms (META) beat quarterly earnings?'
  },
  {
    id: 'test-amzn',
    slug: 'amzn-q4-earnings',
    symbol: 'AMZN',
    companyName: 'Amazon',
    reportDate: new Date('2026-02-06'),
    reportTime: 'AMC',
    yesOdds: 0.87,
    noOdds: 0.13,
    beatOdds: 0.87,
    missOdds: 0.13,
    beatProbability: 87,
    yesCost: 8700,
    noCost: 1300,
    volume: 105000,
    title: 'Will Amazon (AMZN) beat quarterly earnings?'
  },
  {
    id: 'test-googl',
    slug: 'googl-q4-earnings',
    symbol: 'GOOGL',
    companyName: 'Alphabet',
    reportDate: new Date('2026-02-04'),
    reportTime: 'AMC',
    yesOdds: 0.84,
    noOdds: 0.16,
    beatOdds: 0.84,
    missOdds: 0.16,
    beatProbability: 84,
    yesCost: 8400,
    noCost: 1600,
    volume: 98000,
    title: 'Will Alphabet (GOOGL) beat quarterly earnings?'
  }
];

/**
 * Main: Fetch all earnings markets
 */
export async function fetchEarningsMarkets(useCache = true) {
  // Check cache
  if (useCache && earningsCache.data && earningsCache.lastFetched) {
    if (Date.now() - earningsCache.lastFetched < CACHE_DURATION) {
      console.log('[Polymarket] Returning cached data:', earningsCache.data.length, 'events');
      return earningsCache.data;
    }
  }

  try {
    const allEvents = [];

    // Search with earnings-specific queries
    for (const query of EARNINGS_SEARCH_QUERIES) {
      try {
        const url = `${GAMMA_API_BASE}/events?q=${encodeURIComponent(query)}&active=true&closed=false&limit=100`;
        console.log('[Polymarket] Searching:', query);

        const response = await fetch(url);
        if (response.ok) {
          const events = await response.json();
          console.log(`[Polymarket] "${query}" returned ${events.length} events`);
          allEvents.push(...events);
        }
      } catch (e) {
        console.log(`[Polymarket] Search "${query}" failed:`, e.message);
      }
    }

    // Remove duplicates by event ID
    const uniqueEvents = [...new Map(allEvents.map(e => [e.id, e])).values()];
    console.log('[Polymarket] Unique events:', uniqueEvents.length);

    // Filter to only earnings events
    const earningsEvents = uniqueEvents.filter(isEarningsEvent);
    console.log(`[Polymarket] Found ${earningsEvents.length} earnings events from ${uniqueEvents.length} total`);

    // Debug: show what we found
    earningsEvents.slice(0, 5).forEach(e => {
      console.log('[Polymarket] Matched:', e.title?.slice(0, 60));
    });

    // Transform to our format
    const transformed = earningsEvents
      .map(transformPolymarketEvent)
      .filter(e => e !== null)
      .sort((a, b) => new Date(a.reportDate) - new Date(b.reportDate));

    console.log(`[Polymarket] Transformed ${transformed.length} events with valid symbols`);

    // If no real data found, use test data
    if (transformed.length === 0) {
      console.log('[Polymarket] No earnings found from API, using test data');
      const enhancedTestData = TEST_EARNINGS_DATA.map(event => enhanceEventWithParlays(event));
      earningsCache = { data: enhancedTestData, lastFetched: Date.now() };
      return enhancedTestData;
    }

    // Enhance with parlay data
    const enhancedEarnings = transformed.map(event => enhanceEventWithParlays(event));

    // Update cache
    earningsCache = { data: enhancedEarnings, lastFetched: Date.now() };
    return enhancedEarnings;

  } catch (error) {
    console.error('[Polymarket] Fetch error:', error);
    // Return test data on error
    if (!earningsCache.data) {
      console.log('[Polymarket] Using test data due to error');
      const enhancedTestData = TEST_EARNINGS_DATA.map(event => enhanceEventWithParlays(event));
      return enhancedTestData;
    }
    return earningsCache.data;
  }
}

/**
 * Get upcoming earnings (default to 45 days for full earnings season)
 */
export async function getUpcomingEarnings(days = 45) {
  const all = await fetchEarningsMarkets();
  const now = new Date();
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return all.filter(e => {
    if (!e.reportDate) return false;
    const date = new Date(e.reportDate);
    return date >= now && date <= cutoff;
  });
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

export default {
  fetchEarningsMarkets,
  getUpcomingEarnings,
  calculatePredictionMetrics,
  oddsToPrice
};
