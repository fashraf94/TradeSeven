/**
 * polymarketService.js
 *
 * Fetches earnings prediction data from Polymarket's free Gamma API.
 * No authentication required.
 */

import { enhanceEventWithParlays } from './earningsReactionsService';

// Use our Vercel proxy to avoid CORS issues
const GAMMA_API_BASE = '/api/polymarket';

// Cache for 1 minute (more real-time odds updates)
const CACHE_DURATION = 1 * 60 * 1000;
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

// Company name lookup (EODHD returns symbol as company name)
const COMPANY_NAMES = {
  // Banks & Finance
  'WFC': 'Wells Fargo', 'BAC': 'Bank of America', 'JPM': 'JPMorgan Chase',
  'GS': 'Goldman Sachs', 'MS': 'Morgan Stanley', 'C': 'Citigroup',
  'USB': 'U.S. Bancorp', 'PNC': 'PNC Financial', 'BLK': 'BlackRock',
  'SCHW': 'Charles Schwab', 'TFC': 'Truist', 'STT': 'State Street',
  'IBKR': 'Interactive Brokers', 'COF': 'Capital One', 'AXP': 'American Express',
  // Big Tech
  'AAPL': 'Apple', 'MSFT': 'Microsoft', 'GOOGL': 'Alphabet', 'GOOG': 'Alphabet',
  'AMZN': 'Amazon', 'META': 'Meta Platforms', 'NVDA': 'NVIDIA', 'TSLA': 'Tesla',
  'NFLX': 'Netflix', 'AMD': 'AMD', 'INTC': 'Intel', 'CRM': 'Salesforce',
  'ORCL': 'Oracle', 'ADBE': 'Adobe', 'IBM': 'IBM', 'CSCO': 'Cisco',
  // Payments & Fintech
  'V': 'Visa', 'MA': 'Mastercard', 'PYPL': 'PayPal', 'SQ': 'Block',
  'COIN': 'Coinbase', 'HOOD': 'Robinhood', 'SOFI': 'SoFi', 'AFRM': 'Affirm',
  // Healthcare
  'JNJ': 'Johnson & Johnson', 'UNH': 'UnitedHealth', 'PFE': 'Pfizer',
  'MRK': 'Merck', 'ABBV': 'AbbVie', 'LLY': 'Eli Lilly', 'TMO': 'Thermo Fisher',
  'DHR': 'Danaher', 'ABT': 'Abbott Labs', 'BMY': 'Bristol-Myers Squibb',
  'AMGN': 'Amgen', 'GILD': 'Gilead Sciences', 'CVS': 'CVS Health',
  'CI': 'Cigna', 'HUM': 'Humana', 'ELV': 'Elevance Health',
  // Energy
  'XOM': 'Exxon Mobil', 'CVX': 'Chevron', 'COP': 'ConocoPhillips',
  'SLB': 'Schlumberger', 'EOG': 'EOG Resources', 'MPC': 'Marathon Petroleum',
  'PSX': 'Phillips 66', 'VLO': 'Valero Energy', 'OXY': 'Occidental',
  // Retail
  'HD': 'Home Depot', 'LOW': 'Lowes', 'TGT': 'Target', 'WMT': 'Walmart',
  'COST': 'Costco', 'KR': 'Kroger', 'DG': 'Dollar General', 'DLTR': 'Dollar Tree',
  'TJX': 'TJ Maxx', 'ROST': 'Ross Stores', 'BBY': 'Best Buy',
  // Consumer
  'NKE': 'Nike', 'SBUX': 'Starbucks', 'MCD': 'McDonalds', 'CMG': 'Chipotle',
  'DPZ': 'Dominos Pizza', 'YUM': 'Yum Brands', 'KO': 'Coca-Cola', 'PEP': 'PepsiCo',
  'PG': 'Procter & Gamble', 'CL': 'Colgate-Palmolive',
  // Media & Telecom
  'DIS': 'Disney', 'CMCSA': 'Comcast', 'T': 'AT&T', 'VZ': 'Verizon', 'TMUS': 'T-Mobile',
  // Aerospace & Defense
  'BA': 'Boeing', 'LMT': 'Lockheed Martin', 'RTX': 'Raytheon',
  'GD': 'General Dynamics', 'NOC': 'Northrop Grumman',
  // Industrial
  'CAT': 'Caterpillar', 'DE': 'John Deere', 'MMM': '3M', 'HON': 'Honeywell',
  'GE': 'GE Aerospace', 'UPS': 'UPS', 'FDX': 'FedEx',
  // Airlines
  'DAL': 'Delta Air Lines', 'UAL': 'United Airlines', 'AAL': 'American Airlines',
  'LUV': 'Southwest Airlines',
  // Auto
  'F': 'Ford', 'GM': 'General Motors', 'RIVN': 'Rivian', 'LCID': 'Lucid Motors',
  // Semiconductors
  'TSM': 'Taiwan Semiconductor', 'ASML': 'ASML', 'AVGO': 'Broadcom',
  'QCOM': 'Qualcomm', 'TXN': 'Texas Instruments', 'MU': 'Micron',
  'AMAT': 'Applied Materials', 'LRCX': 'Lam Research', 'KLAC': 'KLA Corp',
  'ADI': 'Analog Devices', 'MRVL': 'Marvell', 'ON': 'ON Semiconductor',
  'NXPI': 'NXP Semiconductors',
  // Cloud & Software
  'SNOW': 'Snowflake', 'PLTR': 'Palantir', 'DDOG': 'Datadog', 'NET': 'Cloudflare',
  'ZS': 'Zscaler', 'CRWD': 'CrowdStrike', 'PANW': 'Palo Alto Networks',
  'FTNT': 'Fortinet', 'NOW': 'ServiceNow', 'WDAY': 'Workday',
  'TEAM': 'Atlassian', 'ZM': 'Zoom', 'DOCU': 'DocuSign',
  // Other notable
  'BRK': 'Berkshire Hathaway', 'SPY': 'S&P 500 ETF', 'QQQ': 'Nasdaq 100 ETF'
};

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
  const isValid = isEarningsPattern && !isExcluded;

  // Log rejected events that mention "earnings" for debugging
  if (!isValid && hasEarnings) {
    console.log('[Polymarket] Rejected earnings event:', title.slice(0, 80));
  }

  return isValid;
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

// Helper to generate test data with dynamic dates (relative to today)
function generateTestEarningsData() {
  const today = new Date();
  const addDays = (days) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d;
  };

  return [
    {
      id: 'test-nflx',
      slug: 'nflx-q4-earnings',
      symbol: 'NFLX',
      companyName: 'Netflix',
      reportDate: addDays(1),
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
      reportDate: addDays(1),
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
      id: 'test-ge',
      slug: 'ge-q4-earnings',
      symbol: 'GE',
      companyName: 'GE Aerospace',
      reportDate: addDays(2),
      reportTime: 'BMO',
      yesOdds: 0.85,
      noOdds: 0.15,
      beatOdds: 0.85,
      missOdds: 0.15,
      beatProbability: 85,
      yesCost: 8500,
      noCost: 1500,
      volume: 45000,
      title: 'Will GE Aerospace (GE) beat quarterly earnings?'
    },
    {
      id: 'test-txn',
      slug: 'txn-q4-earnings',
      symbol: 'TXN',
      companyName: 'Texas Instruments',
      reportDate: addDays(2),
      reportTime: 'AMC',
      yesOdds: 0.72,
      noOdds: 0.28,
      beatOdds: 0.72,
      missOdds: 0.28,
      beatProbability: 72,
      yesCost: 7200,
      noCost: 2800,
      volume: 38000,
      title: 'Will Texas Instruments (TXN) beat quarterly earnings?'
    },
    {
      id: 'test-ibm',
      slug: 'ibm-q4-earnings',
      symbol: 'IBM',
      companyName: 'IBM',
      reportDate: addDays(3),
      reportTime: 'AMC',
      yesOdds: 0.68,
      noOdds: 0.32,
      beatOdds: 0.68,
      missOdds: 0.32,
      beatProbability: 68,
      yesCost: 6800,
      noCost: 3200,
      volume: 32000,
      title: 'Will IBM (IBM) beat quarterly earnings?'
    },
    {
      id: 'test-t',
      slug: 't-q4-earnings',
      symbol: 'T',
      companyName: 'AT&T',
      reportDate: addDays(3),
      reportTime: 'BMO',
      yesOdds: 0.74,
      noOdds: 0.26,
      beatOdds: 0.74,
      missOdds: 0.26,
      beatProbability: 74,
      yesCost: 7400,
      noCost: 2600,
      volume: 28000,
      title: 'Will AT&T (T) beat quarterly earnings?'
    },
    {
      id: 'test-aapl',
      slug: 'aapl-q1-earnings',
      symbol: 'AAPL',
      companyName: 'Apple',
      reportDate: addDays(5),
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
      reportDate: addDays(5),
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
      reportDate: addDays(6),
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
      id: 'test-tsla',
      slug: 'tsla-q4-earnings',
      symbol: 'TSLA',
      companyName: 'Tesla',
      reportDate: addDays(6),
      reportTime: 'AMC',
      yesOdds: 0.65,
      noOdds: 0.35,
      beatOdds: 0.65,
      missOdds: 0.35,
      beatProbability: 65,
      yesCost: 6500,
      noCost: 3500,
      volume: 150000,
      title: 'Will Tesla (TSLA) beat quarterly earnings?'
    },
    {
      id: 'test-amzn',
      slug: 'amzn-q4-earnings',
      symbol: 'AMZN',
      companyName: 'Amazon',
      reportDate: addDays(8),
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
      reportDate: addDays(8),
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
}

// Generate test data on demand (with dynamic dates)
const getTestEarningsData = () => generateTestEarningsData();

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

  const fetchTimestamp = new Date();

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

    // If no real data found, use test data with dynamic dates
    if (transformed.length === 0) {
      console.log('[Polymarket] No earnings found from API, using test data (dynamic dates)');
      const testData = getTestEarningsData();
      const enhancedTestData = testData.map(event => ({
        ...enhanceEventWithParlays(event),
        dataSource: 'test_fallback',
        lastFetched: fetchTimestamp
      }));
      earningsCache = { data: enhancedTestData, lastFetched: Date.now() };
      return enhancedTestData;
    }

    // Enhance with parlay data and add metadata
    const enhancedEarnings = transformed.map(event => ({
      ...enhanceEventWithParlays(event),
      dataSource: 'polymarket_live',
      lastFetched: fetchTimestamp
    }));

    // Update cache
    earningsCache = { data: enhancedEarnings, lastFetched: Date.now() };
    console.log(`[Polymarket] Live data fetched at ${fetchTimestamp.toISOString()}`);
    return enhancedEarnings;

  } catch (error) {
    console.error('[Polymarket] Fetch error:', error);
    // Return test data on error
    if (!earningsCache.data) {
      console.log('[Polymarket] Using test data due to error (dynamic dates)');
      const testData = getTestEarningsData();
      const enhancedTestData = testData.map(event => ({
        ...enhanceEventWithParlays(event),
        dataSource: 'test_fallback',
        lastFetched: fetchTimestamp
      }));
      return enhancedTestData;
    }
    return earningsCache.data;
  }
}

/**
 * Get cache status - useful for debugging
 */
export function getCacheStatus() {
  return {
    hasCachedData: !!earningsCache.data,
    lastFetched: earningsCache.lastFetched ? new Date(earningsCache.lastFetched) : null,
    cacheAge: earningsCache.lastFetched ? Date.now() - earningsCache.lastFetched : null,
    cacheDuration: CACHE_DURATION,
    eventCount: earningsCache.data?.length || 0
  };
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

// ===========================================
// HYBRID APPROACH: EODHD Calendar + Polymarket Odds
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
 * Fetch raw Polymarket events using multiple strategies
 * Polymarket's search API doesn't reliably return earnings events,
 * so we try multiple approaches
 */
async function fetchPolymarketEventsRaw() {
  console.log('[Polymarket] Starting multi-strategy fetch...');

  // Strategy URLs to try - ordered by specificity
  const strategies = [
    // Strategy 1: Direct search for "beat earnings"
    { name: 'q=beat earnings', url: `${GAMMA_API_BASE}/events?q=beat%20earnings&active=true&closed=false&limit=100` },
    // Strategy 2: Search for quarterly earnings
    { name: 'q=quarterly earnings', url: `${GAMMA_API_BASE}/events?q=quarterly%20earnings&active=true&closed=false&limit=100` },
    // Strategy 3: Tag filter (if Polymarket supports earnings tag)
    { name: 'tag=earnings', url: `${GAMMA_API_BASE}/events?tag=earnings&active=true&closed=false&limit=100` },
    // Strategy 4: General earnings search
    { name: 'q=earnings', url: `${GAMMA_API_BASE}/events?q=earnings&active=true&closed=false&limit=100` },
    // Strategy 5: Search by known company names
    { name: 'q=NVDA beat', url: `${GAMMA_API_BASE}/events?q=NVDA%20beat&active=true&closed=false&limit=50` },
    { name: 'q=Apple beat', url: `${GAMMA_API_BASE}/events?q=Apple%20beat&active=true&closed=false&limit=50` },
    { name: 'q=Microsoft beat', url: `${GAMMA_API_BASE}/events?q=Microsoft%20beat&active=true&closed=false&limit=50` },
    // Strategy 6: Get ALL active events as last resort (larger fetch, filter client-side)
    { name: 'all-active', url: `${GAMMA_API_BASE}/events?active=true&closed=false&limit=500` },
  ];

  // Collect all earnings events across strategies
  const allEarningsEvents = new Map();

  for (const strategy of strategies) {
    try {
      console.log(`[Polymarket] Trying strategy: ${strategy.name}`);
      const response = await fetch(strategy.url);
      console.log(`[Polymarket] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'unknown');
        console.log(`[Polymarket] Strategy ${strategy.name} failed with ${response.status}: ${errorText.slice(0, 200)}`);
        continue;
      }

      const events = await response.json();
      console.log(`[Polymarket] Strategy ${strategy.name} returned ${events.length} events`);

      if (events.length === 0) {
        console.log(`[Polymarket] Strategy ${strategy.name}: empty response, continuing...`);
        continue;
      }

      // Log sample titles for debugging
      if (strategy.name.includes('all-active')) {
        console.log('[Polymarket] Sample titles from all-active:');
        events.slice(0, 10).forEach((e, i) => {
          console.log(`  ${i + 1}. ${e.title?.slice(0, 80)}`);
        });
      }

      // Filter for earnings events
      const earningsEvents = events.filter(isEarningsEvent);
      console.log(`[Polymarket] After earnings filter: ${earningsEvents.length} events`);

      // Add to our collection (dedup by event id)
      earningsEvents.forEach(event => {
        if (!allEarningsEvents.has(event.id)) {
          allEarningsEvents.set(event.id, event);
        }
      });

      console.log(`[Polymarket] Total unique earnings events so far: ${allEarningsEvents.size}`);

      // If we've found some earnings events, we can stop early
      if (allEarningsEvents.size >= 3) {
        console.log('[Polymarket] Found enough earnings events, stopping search');
        break;
      }
    } catch (error) {
      console.error(`[Polymarket] Strategy ${strategy.name} error:`, error.message);
    }
  }

  console.log(`[Polymarket] Final total: ${allEarningsEvents.size} unique earnings events`);

  if (allEarningsEvents.size === 0) {
    console.log('[Polymarket] No earnings events found across all strategies');
    return [];
  }

  // Transform collected events to our format
  const transformed = Array.from(allEarningsEvents.values())
    .map(event => {
      const title = event.title || '';
      const symbol = extractSymbolFromTitle(title);
      if (!symbol) {
        console.log(`[Polymarket] No symbol found in: ${title.slice(0, 60)}`);
        return null;
      }

      let beatOdds = 0.5;
      if (event.markets && event.markets[0]?.outcomePrices) {
        try {
          const prices = JSON.parse(event.markets[0].outcomePrices);
          beatOdds = parseFloat(prices[0]) || 0.5;
        } catch (e) { /* use default */ }
      }

      return {
        symbol: symbol.toUpperCase(),
        beatOdds,
        missOdds: 1 - beatOdds,
        polymarketId: event.id,
        polymarketTitle: title,
        polymarketEndDate: event.endDate || event.markets?.[0]?.endDate
      };
    })
    .filter(e => e !== null);

  console.log(`[Polymarket] Transformed: ${transformed.length} events with symbols`);
  if (transformed.length > 0) {
    console.log('[Polymarket] Final symbols:', transformed.map(e => e.symbol).join(', '));
  }

  return transformed;
}

/**
 * HYBRID: Merge EODHD calendar with Polymarket odds
 * Only returns stocks that have ACTIVE Polymarket markets
 * Uses EODHD for accurate dates/times, Polymarket for odds
 */
export async function getHybridEarningsCalendar(days = 14) {
  console.log('[Hybrid] >>>>>>> FUNCTION ENTERED <<<<<<<');
  console.log('[Hybrid] ========== STARTING HYBRID FETCH ==========');
  console.log('[Hybrid] Days:', days);
  const fetchTimestamp = new Date();

  try {
    // Fetch from both sources in parallel
    console.log('[Hybrid] Fetching from both sources...');
    const [eohdCalendar, polymarketEvents] = await Promise.all([
      fetchEODHDCalendar(days),
      fetchPolymarketEventsRaw()
    ]);

    console.log(`[Hybrid] EODHD: ${eohdCalendar.length}, Polymarket: ${polymarketEvents.length}`);
    if (eohdCalendar.length > 0) {
      console.log('[Hybrid] EODHD symbols:', eohdCalendar.slice(0, 10).map(e => e.symbol));
    }
    if (polymarketEvents.length > 0) {
      console.log('[Hybrid] Polymarket symbols:', polymarketEvents.map(e => e.symbol));
    }

    // If no Polymarket data, use EODHD with default odds (better than test data)
    if (polymarketEvents.length === 0) {
      console.warn('[Hybrid] ⚠️ No Polymarket events found!');

      if (eohdCalendar.length > 0) {
        console.log('[Hybrid] Using EODHD events with default 70/30 beat odds');

        // Get today's date for filtering
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        console.log('[Hybrid] Today (for date filter):', today.toISOString());

        // DEBUG: Log sample raw EODHD data
        console.log('[Hybrid] Sample EODHD raw data (first 5):');
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
          passed: 0
        };
        const rejectionSamples = [];

        // Filter for quality US stocks with future dates
        // NOTE: We don't filter on companyName because EODHD returns symbol as companyName
        // We use COMPANY_NAMES lookup later to get proper names
        const qualityEvents = eohdCalendar.filter(event => {
          const symbol = event.symbol || '';

          // Skip empty symbols
          if (!symbol || symbol.length === 0) {
            rejectionCounts.emptySymbol++;
            return false;
          }

          // Skip preferred shares and special securities (contain - or .)
          if (symbol.includes('-')) {
            rejectionCounts.hasDash++;
            if (rejectionSamples.length < 3) rejectionSamples.push({ symbol, reason: 'has dash' });
            return false;
          }
          if (symbol.includes('.')) {
            rejectionCounts.hasDot++;
            if (rejectionSamples.length < 3) rejectionSamples.push({ symbol, reason: 'has dot' });
            return false;
          }

          // Skip if symbol is too long (likely OTC or foreign)
          if (symbol.length > 5) {
            rejectionCounts.tooLong++;
            if (rejectionSamples.length < 3) rejectionSamples.push({ symbol, reason: 'too long' });
            return false;
          }

          // Must be future date (today or later)
          const eventDate = new Date(event.reportDate);
          if (eventDate < today) {
            rejectionCounts.pastDate++;
            if (rejectionSamples.length < 5) rejectionSamples.push({ symbol, reportDate: event.reportDate, parsed: eventDate.toISOString(), reason: 'past date' });
            return false;
          }

          rejectionCounts.passed++;
          return true;
        });

        console.log('[Hybrid] Rejection counts:', rejectionCounts);
        console.log('[Hybrid] Rejection samples:', rejectionSamples);
        console.log(`[Hybrid] Quality filtered: ${qualityEvents.length} of ${eohdCalendar.length}`);

        // Sort by date and take first 50
        const sortedEvents = qualityEvents
          .sort((a, b) => new Date(a.reportDate) - new Date(b.reportDate))
          .slice(0, 50);

        console.log(`[Hybrid] Taking first ${sortedEvents.length} events`);
        if (sortedEvents.length > 0) {
          // Show with lookup names
          console.log('[Hybrid] Sample companies:', sortedEvents.slice(0, 5).map(e =>
            `${e.symbol} (${COMPANY_NAMES[e.symbol.toUpperCase()] || e.companyName || e.symbol})`
          ));
        }

        // Use EODHD data with default odds (most companies beat earnings historically)
        const eohdOnly = sortedEvents.map(event => {
          const symbolUpper = event.symbol.toUpperCase();
          const defaultBeatOdds = 0.70; // Historical average - ~70% of companies beat
          const yesCost = Math.round(defaultBeatOdds * 10000);
          const noCost = Math.round((1 - defaultBeatOdds) * 10000);

          // Use lookup table for company name, fallback to EODHD name or symbol
          const companyName = COMPANY_NAMES[symbolUpper] || event.companyName || symbolUpper;

          return {
            id: `eodhd_${symbolUpper}_${event.reportDate}`,
            symbol: symbolUpper,
            companyName: companyName,
            reportDate: new Date(event.reportDate),
            reportTime: event.reportTime || 'TBD',
            beatOdds: defaultBeatOdds,
            missOdds: 1 - defaultBeatOdds,
            yesOdds: defaultBeatOdds,
            noOdds: 1 - defaultBeatOdds,
            beatProbability: Math.round(defaultBeatOdds * 100),
            yesCost,
            noCost,
            source: 'eodhd_only',
            dataSource: 'eodhd_default_odds',
            hasPolymarketOdds: false,
            lastFetched: fetchTimestamp
          };
        });

        // Enhance with parlays
        const enhanced = eohdOnly.map(event => enhanceEventWithParlays(event));

        console.log(`[Hybrid] Returning ${enhanced.length} EODHD events with default odds`);
        return enhanced;
      }

      // Last resort: use test data
      console.warn('[Hybrid] No EODHD data either, falling back to test data.');
      const testData = getTestEarningsData();
      return testData.map(event => ({
        ...enhanceEventWithParlays(event),
        dataSource: 'test_fallback',
        lastFetched: fetchTimestamp
      }));
    }

    // Create a map of Polymarket odds by symbol
    const polymarketBySymbol = new Map();
    polymarketEvents.forEach(event => {
      polymarketBySymbol.set(event.symbol, event);
    });

    // Filter EODHD calendar to only include stocks with Polymarket odds
    const mergedEvents = eohdCalendar
      .filter(event => polymarketBySymbol.has(event.symbol.toUpperCase()))
      .map(event => {
        const pmData = polymarketBySymbol.get(event.symbol.toUpperCase());

        // Calculate costs based on odds
        const yesCost = Math.round(pmData.beatOdds * 10000);
        const noCost = Math.round(pmData.missOdds * 10000);

        return {
          id: `${event.symbol}_${event.reportDate}`,
          symbol: event.symbol.toUpperCase(),
          companyName: event.companyName,
          // Use EODHD date/time (more accurate)
          reportDate: new Date(event.reportDate),
          reportTime: event.reportTime || 'TBD',
          // Use Polymarket odds (real market data)
          beatOdds: pmData.beatOdds,
          missOdds: pmData.missOdds,
          yesOdds: pmData.beatOdds,
          noOdds: pmData.missOdds,
          beatProbability: Math.round(pmData.beatOdds * 100),
          yesCost,
          noCost,
          // Metadata
          source: 'hybrid',
          dataSource: 'hybrid_eodhd_polymarket',
          polymarketId: pmData.polymarketId,
          hasPolymarketOdds: true,
          lastFetched: fetchTimestamp
        };
      });

    console.log(`[Hybrid] Merged: ${mergedEvents.length} events with both EODHD dates and Polymarket odds`);

    // If no merged events, maybe EODHD and Polymarket symbols don't overlap
    // In this case, use Polymarket data only (with their dates)
    if (mergedEvents.length === 0 && polymarketEvents.length > 0) {
      console.log('[Hybrid] No overlap, using Polymarket-only data');
      const pmOnly = polymarketEvents.map(pm => {
        const yesCost = Math.round(pm.beatOdds * 10000);
        const noCost = Math.round(pm.missOdds * 10000);

        return {
          id: pm.polymarketId,
          symbol: pm.symbol,
          companyName: pm.symbol, // No company name from Polymarket
          reportDate: pm.polymarketEndDate ? new Date(pm.polymarketEndDate) : null,
          reportTime: 'TBD',
          beatOdds: pm.beatOdds,
          missOdds: pm.missOdds,
          yesOdds: pm.beatOdds,
          noOdds: pm.missOdds,
          beatProbability: Math.round(pm.beatOdds * 100),
          yesCost,
          noCost,
          source: 'polymarket_only',
          dataSource: 'polymarket_live',
          polymarketId: pm.polymarketId,
          hasPolymarketOdds: true,
          lastFetched: fetchTimestamp
        };
      });

      // Enhance with parlays
      return pmOnly
        .filter(e => e.reportDate)
        .sort((a, b) => new Date(a.reportDate) - new Date(b.reportDate))
        .map(event => enhanceEventWithParlays(event));
    }

    // Enhance merged events with parlays
    const enhanced = mergedEvents
      .sort((a, b) => new Date(a.reportDate) - new Date(b.reportDate))
      .map(event => enhanceEventWithParlays(event));

    return enhanced;

  } catch (error) {
    console.error('[Hybrid] Error:', error);
    // Fall back to test data
    const testData = getTestEarningsData();
    return testData.map(event => ({
      ...enhanceEventWithParlays(event),
      dataSource: 'test_fallback',
      lastFetched: fetchTimestamp
    }));
  }
}

export default {
  fetchEarningsMarkets,
  getUpcomingEarnings,
  getHybridEarningsCalendar,
  calculatePredictionMetrics,
  oddsToPrice,
  getCacheStatus
};
