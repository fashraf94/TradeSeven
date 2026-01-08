/**
 * polymarketService.js
 *
 * Fetches earnings prediction data from Polymarket's free Gamma API.
 * No authentication required.
 */

import { enhanceEventWithParlays } from './earningsReactionsService';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

// Cache for 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;
let earningsCache = { data: null, lastFetched: null };

// Common stock symbols to look for in slugs
const COMMON_SYMBOLS = [
  'NVDA', 'AAPL', 'MSFT', 'GOOGL', 'META', 'AMZN', 'TSLA', 'AMD',
  'NFLX', 'CRM', 'INTC', 'MU', 'WMT', 'TGT', 'COST', 'NKE',
  'JPM', 'BAC', 'GS', 'V', 'MA', 'C', 'WFC', 'MS', 'BLK',
  'DAL', 'UAL', 'AAL', 'LUV', 'TSM', 'UNH', 'JNJ', 'PFE',
  'STT', 'MTB', 'PNC', 'BK', 'USB', 'TFC', 'SCHW'
];

// Earnings-specific symbols for Q4 2025 / Q1 2026 season
const EARNINGS_SYMBOLS = [
  'jpm', 'jpmorgan', 'jp morgan',
  'dal', 'delta',
  'bk', 'bank of new york', 'bny mellon',
  'c', 'citi', 'citigroup',
  'bac', 'bank of america',
  'wfc', 'wells fargo',
  'tsm', 'tsmc', 'taiwan semi',
  'ms', 'morgan stanley',
  'gs', 'goldman', 'goldman sachs',
  'blk', 'blackrock',
  'stt', 'state street',
  'mtb', 'm&t bank',
  'pnc', 'pnc financial',
  'usb', 'us bancorp',
  'tfc', 'truist'
];

/**
 * Extract stock symbol from Polymarket event slug or title
 */
export function extractSymbolFromSlug(slug, title = '') {
  if (!slug && !title) return null;

  const text = `${slug || ''} ${title || ''}`.toUpperCase();

  // Try pattern matching on slug
  if (slug) {
    const patterns = [
      /^([a-z]{1,5})-quarterly-earnings/i,
      /will-.*-\(([a-z]{1,5})\)-beat/i,
      /will-([a-z]{1,5})-beat/i,
      /([a-z]{1,5})-beat-.*earnings/i,
      /([a-z]{1,5})-q[1-4]-/i,
    ];

    for (const pattern of patterns) {
      const match = slug.match(pattern);
      if (match?.[1]) return match[1].toUpperCase();
    }
  }

  // Fallback: find common symbols in text
  for (const symbol of COMMON_SYMBOLS) {
    // Check for exact symbol match (with word boundaries)
    const symbolRegex = new RegExp(`\\b${symbol}\\b`, 'i');
    if (symbolRegex.test(text)) return symbol;
  }

  return null;
}

/**
 * Parse outcome prices from market data
 */
export function parseOutcomePrices(market) {
  try {
    const prices = JSON.parse(market.outcomePrices || '[]');
    const outcomes = JSON.parse(market.outcomes || '[]');
    const yesIndex = outcomes.findIndex(o => o.toLowerCase() === 'yes');
    const noIndex = outcomes.findIndex(o => o.toLowerCase() === 'no');

    return {
      yesOdds: yesIndex >= 0 ? parseFloat(prices[yesIndex]) : 0.5,
      noOdds: noIndex >= 0 ? parseFloat(prices[noIndex]) : 0.5
    };
  } catch {
    return { yesOdds: 0.5, noOdds: 0.5 };
  }
}

/**
 * Convert odds to price (based on $10K budget)
 */
export function oddsToPrice(odds, budget = 10000) {
  return Math.round(odds * budget);
}

/**
 * Fetch all active events from Polymarket
 */
async function fetchActiveEvents(limit = 100, offset = 0) {
  const url = `${GAMMA_API_BASE}/events?active=true&closed=false&limit=${limit}&offset=${offset}&order=endDate&ascending=true`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Polymarket API error: ${response.status}`);
  return response.json();
}

/**
 * Search events with query parameter
 */
async function searchEvents(query, limit = 100) {
  const url = `${GAMMA_API_BASE}/events?active=true&closed=false&limit=${limit}&q=${encodeURIComponent(query)}`;
  console.log('[Polymarket] Searching:', query);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Polymarket search error: ${response.status}`);
  return response.json();
}

/**
 * Filter for earnings-related events
 */
function filterEarningsEvents(events) {
  // Debug logging
  console.log('=== POLYMARKET DEBUG ===');
  console.log('Total events to filter:', events.length);
  console.log('Sample events:', events.slice(0, 5).map(e => ({
    title: e.title,
    slug: e.slug,
    endDate: e.endDate
  })));

  // Expanded keywords based on how Polymarket titles earnings markets
  const keywords = [
    'earnings',
    'beat',
    'eps',
    'quarterly',
    'revenue',
    'q4 2024',
    'q1 2025',
    'q4 2025',
    'q1 2026',
    'guidance',
    'report'
  ];

  const filtered = events.filter(event => {
    const title = (event.title || '').toLowerCase();
    const slug = (event.slug || '').toLowerCase();
    const text = `${title} ${slug}`;

    // Check keywords
    const hasKeyword = keywords.some(kw => text.includes(kw));

    // Check for known earnings symbols
    const hasSymbol = EARNINGS_SYMBOLS.some(sym => text.includes(sym));

    const matches = hasKeyword || hasSymbol;

    if (matches) {
      console.log('[Polymarket] MATCHED:', event.title?.slice(0, 60), '|', event.slug);
    }

    return matches;
  });

  console.log('Filtered earnings events:', filtered.length);
  console.log('=== END DEBUG ===');

  return filtered;
}

/**
 * Transform Polymarket event to our format
 */
function transformEvent(event) {
  const market = event.markets?.[0];
  if (!market) return null;

  const symbol = extractSymbolFromSlug(event.slug, event.title);
  if (!symbol) {
    console.log('[Polymarket] No symbol found for:', event.slug);
    return null;
  }

  const { yesOdds, noOdds } = parseOutcomePrices(market);

  return {
    id: event.id,
    slug: event.slug,
    symbol,
    companyName: symbol, // Could enhance with company name lookup
    reportDate: event.endDate ? new Date(event.endDate) : null,
    reportTime: 'TBD',
    yesOdds,
    noOdds,
    beatProbability: Math.round(yesOdds * 100),
    yesCost: oddsToPrice(yesOdds),
    noCost: oddsToPrice(noOdds),
    volume: parseFloat(market.volume) || 0,
    title: event.title,
    resolved: event.closed,
    lastUpdated: new Date()
  };
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
    beatProbability: 91,
    yesCost: 9100,
    noCost: 900,
    volume: 50000,
    title: 'Will JPM beat Q4 earnings?'
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
    beatProbability: 64,
    yesCost: 6400,
    noCost: 3600,
    volume: 30000,
    title: 'Will DAL beat Q4 earnings?'
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
    beatProbability: 85,
    yesCost: 8500,
    noCost: 1500,
    volume: 45000,
    title: 'Will BAC beat Q4 earnings?'
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
    beatProbability: 78,
    yesCost: 7800,
    noCost: 2200,
    volume: 35000,
    title: 'Will WFC beat Q4 earnings?'
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
    beatProbability: 72,
    yesCost: 7200,
    noCost: 2800,
    volume: 28000,
    title: 'Will C beat Q4 earnings?'
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
    beatProbability: 88,
    yesCost: 8800,
    noCost: 1200,
    volume: 42000,
    title: 'Will GS beat Q4 earnings?'
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
    beatProbability: 82,
    yesCost: 8200,
    noCost: 1800,
    volume: 38000,
    title: 'Will MS beat Q4 earnings?'
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
    beatProbability: 79,
    yesCost: 7900,
    noCost: 2100,
    volume: 25000,
    title: 'Will BLK beat Q4 earnings?'
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
    beatProbability: 94,
    yesCost: 9400,
    noCost: 600,
    volume: 65000,
    title: 'Will TSM beat Q4 earnings?'
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
    beatProbability: 86,
    yesCost: 8600,
    noCost: 1400,
    volume: 55000,
    title: 'Will UNH beat Q4 earnings?'
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
    beatProbability: 68,
    yesCost: 6800,
    noCost: 3200,
    volume: 18000,
    title: 'Will PNC beat Q4 earnings?'
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
    beatProbability: 76,
    yesCost: 7600,
    noCost: 2400,
    volume: 72000,
    title: 'Will NFLX beat Q4 earnings?'
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
    beatProbability: 81,
    yesCost: 8100,
    noCost: 1900,
    volume: 48000,
    title: 'Will JNJ beat Q4 earnings?'
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
    beatProbability: 89,
    yesCost: 8900,
    noCost: 1100,
    volume: 120000,
    title: 'Will AAPL beat Q1 FY26 earnings?'
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
    beatProbability: 92,
    yesCost: 9200,
    noCost: 800,
    volume: 115000,
    title: 'Will MSFT beat Q2 FY26 earnings?'
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
    beatProbability: 83,
    yesCost: 8300,
    noCost: 1700,
    volume: 95000,
    title: 'Will META beat Q4 earnings?'
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
    beatProbability: 87,
    yesCost: 8700,
    noCost: 1300,
    volume: 105000,
    title: 'Will AMZN beat Q4 earnings?'
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
    beatProbability: 84,
    yesCost: 8400,
    noCost: 1600,
    volume: 98000,
    title: 'Will GOOGL beat Q4 earnings?'
  }
];

/**
 * Main: Fetch all earnings markets - try multiple approaches
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
    let allEvents = [];

    // Approach 1: Search specifically for "earnings"
    console.log('[Polymarket] Trying earnings search...');
    try {
      const earningsSearch = await searchEvents('earnings');
      console.log('[Polymarket] Earnings search returned:', earningsSearch.length, 'events');
      allEvents = [...allEvents, ...earningsSearch];
    } catch (e) {
      console.log('[Polymarket] Earnings search failed:', e.message);
    }

    // Approach 2: Search for "beat"
    console.log('[Polymarket] Trying beat search...');
    try {
      const beatSearch = await searchEvents('beat quarterly');
      console.log('[Polymarket] Beat search returned:', beatSearch.length, 'events');
      allEvents = [...allEvents, ...beatSearch];
    } catch (e) {
      console.log('[Polymarket] Beat search failed:', e.message);
    }

    // Approach 3: Get all events and filter
    console.log('[Polymarket] Fetching all events...');
    let offset = 0;
    while (offset < 500) {
      const events = await fetchActiveEvents(100, offset);
      if (!events?.length) break;
      allEvents = [...allEvents, ...events];
      if (events.length < 100) break;
      offset += 100;
    }
    console.log('[Polymarket] Total events after all fetches:', allEvents.length);

    // Deduplicate by ID
    const uniqueEvents = Array.from(
      new Map(allEvents.map(e => [e.id, e])).values()
    );
    console.log('[Polymarket] Unique events:', uniqueEvents.length);

    // Filter and transform
    const earnings = filterEarningsEvents(uniqueEvents)
      .map(transformEvent)
      .filter(Boolean)
      .sort((a, b) => new Date(a.reportDate) - new Date(b.reportDate));

    console.log('[Polymarket] Final earnings events:', earnings.length);

    // If no real data found, use test data
    if (earnings.length === 0) {
      console.log('[Polymarket] No earnings found from API, using test data');
      const enhancedTestData = TEST_EARNINGS_DATA.map(event => enhanceEventWithParlays(event));
      earningsCache = { data: enhancedTestData, lastFetched: Date.now() };
      return enhancedTestData;
    }

    // Enhance with parlay data
    const enhancedEarnings = earnings.map(event => enhanceEventWithParlays(event));

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
  const odds = prediction === 'beat' ? event.yesOdds : event.noOdds;
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
