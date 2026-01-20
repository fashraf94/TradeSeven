/**
 * polymarketService.js
 *
 * Fetches earnings prediction data from Polymarket's free Gamma API.
 * No authentication required.
 */

import { enhanceEventWithParlays } from './earningsReactionsService';
import { getBatchOdds } from './oddsService';

// Priority stocks - Most anticipated earnings that users care about
// Based on Earnings Whispers "Most Anticipated" + major companies
// This ensures we show the stocks retail investors actually follow
const PRIORITY_STOCKS = new Set([
  // === MEGA CAP TECH (Always Include) ===
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'NVDA', 'TSLA', 'AMD', 'INTC',
  'AVGO', 'ORCL', 'CRM', 'ADBE', 'NFLX', 'CSCO', 'IBM', 'QCOM', 'TXN', 'MU',

  // === THIS WEEK's EARNINGS WHISPERS LIST (Jan 20-24, 2026) ===
  // Tuesday
  'MMM', 'UAL', 'DHI', 'USB', 'IBKR', 'PRGS', 'FAST', 'PEBO', 'KEY', 'OZK',
  'ZION', 'WTFC', 'FOR', 'MBWM',

  // Wednesday
  'JNJ', 'HAL', 'KMI', 'ALLY', 'SCHW', 'TXG', 'PLD', 'TRV', 'BANC',
  'CACI', 'PNFP', 'FCFS', 'RLI', 'BKU', 'EQBK', 'MMYT',

  // Thursday
  'PG', 'ISRG', 'GE', 'COF', 'HBAN', 'AA', 'TXN', 'CSX', 'ABT',
  'EWBC', 'TCBI', 'MKC', 'ACM', 'NG', 'NWLI',

  // Friday
  'SLB', 'ERIC', 'WBS', 'FCNCA', 'BAH', 'CMA', 'ALK', 'CUST',

  // === FINANCIALS (High Interest) ===
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'PNC', 'TFC', 'COF', 'AXP',
  'BLK', 'SCHW', 'CME', 'ICE', 'SPGI', 'MCO', 'MMC', 'AON', 'CB',
  'FITB', 'RF', 'CFG', 'MTB', 'HBAN', 'CMA', 'ZION', 'FHN', 'SNV',

  // === HEALTHCARE ===
  'UNH', 'JNJ', 'PFE', 'MRK', 'ABBV', 'LLY', 'TMO', 'ABT', 'DHR', 'BMY',
  'AMGN', 'GILD', 'VRTX', 'REGN', 'ISRG', 'MDT', 'SYK', 'BDX', 'ZTS', 'CI',

  // === CONSUMER ===
  'WMT', 'COST', 'HD', 'TGT', 'LOW', 'NKE', 'SBUX', 'MCD', 'YUM', 'CMG',
  'PG', 'KO', 'PEP', 'PM', 'MO', 'CL', 'KMB', 'GIS', 'K', 'CAG',

  // === INDUSTRIAL ===
  'CAT', 'DE', 'BA', 'HON', 'UPS', 'FDX', 'UNP', 'LMT', 'RTX', 'GD',
  'NOC', 'GE', 'MMM', 'EMR', 'ETN', 'ITW', 'PH', 'ROK', 'CMI', 'PCAR',
  'FAST', 'CACI', 'BAH',

  // === ENERGY ===
  'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'VLO', 'PSX', 'OXY', 'HAL',
  'KMI', 'WMB', 'OKE', 'TRGP',

  // === AIRLINES & TRAVEL ===
  'DAL', 'UAL', 'AAL', 'LUV', 'ALK', 'JBLU', 'MAR', 'HLT', 'ABNB', 'BKNG',

  // === HOMEBUILDERS ===
  'DHI', 'LEN', 'PHM', 'NVR', 'TOL', 'KBH', 'MTH', 'TMHC', 'MDC',

  // === REITS ===
  'AMT', 'PLD', 'EQIX', 'SPG', 'O', 'WELL', 'AVB', 'EQR', 'DLR',

  // === TELECOM ===
  'VZ', 'T', 'TMUS', 'ERIC',

  // === TRANSPORTATION ===
  'CSX', 'NSC', 'UNP', 'JBHT', 'XPO', 'ODFL',

  // === OTHER NOTABLE ===
  'V', 'MA', 'PYPL', 'SQ', 'COIN', 'SHOP', 'SNOW', 'PLTR', 'NET',
  'DDOG', 'ZS', 'CRWD', 'PANW', 'NOW', 'WDAY'
]);

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

// Sector lookup for calculating odds (maps symbol -> sector)
const COMPANY_SECTORS = {
  // Banks & Finance
  'WFC': 'financial', 'BAC': 'financial', 'JPM': 'financial', 'GS': 'financial',
  'MS': 'financial', 'C': 'financial', 'USB': 'financial', 'PNC': 'financial',
  'BLK': 'financial', 'SCHW': 'financial', 'TFC': 'financial', 'STT': 'financial',
  'IBKR': 'financial', 'COF': 'financial', 'AXP': 'financial', 'V': 'financial',
  'MA': 'financial', 'PYPL': 'financial', 'SQ': 'financial', 'COIN': 'financial',
  'HOOD': 'financial', 'SOFI': 'financial', 'AFRM': 'financial',
  // Big Tech & Software
  'AAPL': 'technology', 'MSFT': 'technology', 'GOOGL': 'technology', 'GOOG': 'technology',
  'AMZN': 'technology', 'META': 'technology', 'NFLX': 'technology', 'CRM': 'technology',
  'ORCL': 'technology', 'ADBE': 'technology', 'IBM': 'technology', 'CSCO': 'technology',
  'SNOW': 'technology', 'PLTR': 'technology', 'DDOG': 'technology', 'NET': 'technology',
  'ZS': 'technology', 'CRWD': 'technology', 'PANW': 'technology', 'FTNT': 'technology',
  'NOW': 'technology', 'WDAY': 'technology', 'TEAM': 'technology', 'ZM': 'technology',
  'DOCU': 'technology',
  // Semiconductors (part of tech)
  'NVDA': 'technology', 'AMD': 'technology', 'INTC': 'technology', 'TSLA': 'technology',
  'TSM': 'technology', 'ASML': 'technology', 'AVGO': 'technology', 'QCOM': 'technology',
  'TXN': 'technology', 'MU': 'technology', 'AMAT': 'technology', 'LRCX': 'technology',
  'KLAC': 'technology', 'ADI': 'technology', 'MRVL': 'technology', 'ON': 'technology',
  'NXPI': 'technology',
  // Healthcare
  'JNJ': 'healthcare', 'UNH': 'healthcare', 'PFE': 'healthcare', 'MRK': 'healthcare',
  'ABBV': 'healthcare', 'LLY': 'healthcare', 'TMO': 'healthcare', 'DHR': 'healthcare',
  'ABT': 'healthcare', 'BMY': 'healthcare', 'AMGN': 'healthcare', 'GILD': 'healthcare',
  'CVS': 'healthcare', 'CI': 'healthcare', 'HUM': 'healthcare', 'ELV': 'healthcare',
  // Energy
  'XOM': 'energy', 'CVX': 'energy', 'COP': 'energy', 'SLB': 'energy',
  'EOG': 'energy', 'MPC': 'energy', 'PSX': 'energy', 'VLO': 'energy', 'OXY': 'energy',
  // Consumer Cyclical
  'HD': 'consumer_cyclical', 'LOW': 'consumer_cyclical', 'TGT': 'consumer_cyclical',
  'COST': 'consumer_cyclical', 'TJX': 'consumer_cyclical', 'ROST': 'consumer_cyclical',
  'BBY': 'consumer_cyclical', 'NKE': 'consumer_cyclical', 'SBUX': 'consumer_cyclical',
  'MCD': 'consumer_cyclical', 'CMG': 'consumer_cyclical', 'DPZ': 'consumer_cyclical',
  'YUM': 'consumer_cyclical', 'DIS': 'consumer_cyclical', 'F': 'consumer_cyclical',
  'GM': 'consumer_cyclical', 'RIVN': 'consumer_cyclical', 'LCID': 'consumer_cyclical',
  // Consumer Defensive
  'WMT': 'consumer_defensive', 'KR': 'consumer_defensive', 'DG': 'consumer_defensive',
  'DLTR': 'consumer_defensive', 'KO': 'consumer_defensive', 'PEP': 'consumer_defensive',
  'PG': 'consumer_defensive', 'CL': 'consumer_defensive',
  // Industrial
  'BA': 'industrial', 'LMT': 'industrial', 'RTX': 'industrial', 'GD': 'industrial',
  'NOC': 'industrial', 'CAT': 'industrial', 'DE': 'industrial', 'MMM': 'industrial',
  'HON': 'industrial', 'GE': 'industrial', 'UPS': 'industrial', 'FDX': 'industrial',
  'DAL': 'industrial', 'UAL': 'industrial', 'AAL': 'industrial', 'LUV': 'industrial',
  // Communication
  'CMCSA': 'communication', 'T': 'communication', 'VZ': 'communication', 'TMUS': 'communication'
};

// Sector beat rates from historical S&P 500 data
const SECTOR_BEAT_RATES = {
  technology: 0.78,
  financial: 0.74,
  healthcare: 0.76,
  consumer_cyclical: 0.71,
  consumer_defensive: 0.73,
  industrial: 0.70,
  energy: 0.65,
  communication: 0.75,
  default: 0.70
};

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
 * Check if an event is a valid earnings event
 * More lenient filter to catch various Polymarket title formats
 */
function isEarningsEvent(event) {
  const title = (event.title || '').toLowerCase();
  const slug = (event.slug || '').toLowerCase();

  // Check for ticker pattern (NVDA), (TSM), etc. - required
  const tickerPattern = /\([A-Z]{1,5}\)/i;
  const hasTicker = tickerPattern.test(event.title || '');

  // Keywords that indicate earnings events
  const earningsKeywords = [
    'earnings', 'beat', 'miss', 'quarterly', 'eps', 'revenue',
    'q1', 'q2', 'q3', 'q4', 'fiscal', 'report', 'results',
    'expectations', 'estimates', 'guidance', 'outlook'
  ];
  const hasEarningsKeyword = earningsKeywords.some(kw =>
    title.includes(kw) || slug.includes(kw)
  );

  // Exclude non-earnings events
  const excludeKeywords = [
    'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'crypto', 'token',
    'nfl', 'nba', 'mlb', 'nhl', 'soccer', 'football', 'basketball', 'sports',
    'election', 'trump', 'biden', 'president', 'senate', 'congress', 'vote',
    'fed', 'fomc', 'interest rate', 'inflation', 'cpi', 'gdp',
    'war', 'ukraine', 'russia', 'china', 'tariff',
    'weather', 'hurricane', 'earthquake'
  ];
  const isExcluded = excludeKeywords.some(keyword => title.includes(keyword));

  // Valid if has ticker + earnings keyword + not excluded
  const isValid = hasTicker && hasEarningsKeyword && !isExcluded;

  // Debug logging for events that mention stocks but were rejected
  if (!isValid && hasTicker && hasEarningsKeyword) {
    console.log('[Polymarket] Rejected (excluded):', title.slice(0, 80));
  } else if (!isValid && hasTicker) {
    console.log('[Polymarket] Rejected (no earnings keyword):', title.slice(0, 60));
  } else if (!isValid && hasEarningsKeyword) {
    console.log('[Polymarket] Rejected (no ticker):', title.slice(0, 60));
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
 *
 * DISABLED: Polymarket rarely has stock earnings markets, and the multi-strategy
 * search was causing an infinite loop that blocked calendar loading.
 * We now use our own Market-Informed Odds Engine instead.
 */
async function fetchPolymarketEventsRaw() {
  // DISABLED - Polymarket rarely has stock earnings markets.
  // Using our Market-Informed Odds Engine (oddsService.js) instead.
  console.log('[Polymarket] DISABLED - Using Market-Informed Odds Engine v1');
  return [];
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

        console.log('[Hybrid] Rejection counts:', rejectionCounts);
        console.log('[Hybrid] Rejection samples:', rejectionSamples);
        console.log(`[Hybrid] Quality filtered: ${qualityEvents.length} of ${eohdCalendar.length}`);

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

        console.log(`[Hybrid] Priority stocks found: ${priorityEvents.length}`);
        console.log(`[Hybrid] Balanced to ${balancedPriority.length} priority across ${Object.keys(priorityByDate).length} days`);
        console.log(`[Hybrid] Final count: ${limitedEvents.length} events`);

        const sortedEvents = limitedEvents;
        if (sortedEvents.length > 0) {
          // Show with lookup names
          console.log('[Hybrid] Sample companies:', sortedEvents.slice(0, 8).map(e =>
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

        console.log(`[Hybrid] Fetching full odds for ${prioritySymbols.length} priority stocks via oddsService...`);

        // Fetch odds from the full odds engine (includes price momentum)
        let oddsMap = new Map();
        try {
          oddsMap = await getBatchOdds(prioritySymbols);
          console.log(`[Hybrid] Got full odds for ${oddsMap.size} stocks`);

          // Log sample results
          const samples = Array.from(oddsMap.entries()).slice(0, 5);
          samples.forEach(([symbol, odds]) => {
            const priceInfo = odds.breakdown?.priceMomentum?.display || 'N/A';
            console.log(`[Hybrid] ${symbol}: ${odds.probabilityPercent}% beat (${odds.confidence}, price: ${priceInfo})`);
          });
        } catch (e) {
          console.warn(`[Hybrid] Batch odds fetch failed, using fallbacks:`, e.message);
        }

        // Map events with full odds data from the engine
        const eohdOnly = sortedEvents.map(event => {
          const symbolUpper = event.symbol.toUpperCase();

          // Get full odds from the engine, or fallback to sector default
          const oddsData = oddsMap.get(symbolUpper);
          let beatOdds, confidence, oddsSource, breakdown;

          if (oddsData && !oddsData.fallback) {
            beatOdds = oddsData.probability;
            confidence = oddsData.confidence;
            oddsSource = oddsData.breakdown?.historical?.quarters >= 3 ? 'historical_plus_momentum' : 'sector_plus_momentum';
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

          // Parse date as LOCAL date to avoid timezone issues
          const [year, month, day] = event.reportDate.split('-').map(Number);
          const localDate = new Date(year, month - 1, day);

          // Extract historical and momentum info for display
          const historicalRate = breakdown?.historical?.rate;
          const priceChange = breakdown?.priceMomentum?.change;

          return {
            id: `eodhd_${symbolUpper}_${event.reportDate}`,
            symbol: symbolUpper,
            companyName: companyName,
            reportDate: localDate,
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
            oddsBreakdown: breakdown, // Full breakdown for transparency
            hasPolymarketOdds: false,
            hasCalculatedOdds: oddsSource !== 'sector_default',
            lastFetched: fetchTimestamp
          };
        });

        // Enhance with parlays
        const enhanced = eohdOnly.map(event => enhanceEventWithParlays(event));

        console.log(`[Hybrid] Returning ${enhanced.length} events with market-informed odds`);
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

        // Parse date as LOCAL date to avoid timezone issues
        const [year, month, day] = event.reportDate.split('-').map(Number);
        const localDate = new Date(year, month - 1, day);

        return {
          id: `${event.symbol}_${event.reportDate}`,
          symbol: event.symbol.toUpperCase(),
          companyName: event.companyName,
          // Use EODHD date/time (more accurate), parsed as local date
          reportDate: localDate,
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
