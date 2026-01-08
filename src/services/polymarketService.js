/**
 * polymarketService.js
 *
 * Fetches earnings prediction data from Polymarket's free Gamma API.
 * No authentication required.
 */

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

// Cache for 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;
let earningsCache = { data: null, lastFetched: null };

// Common stock symbols to look for in slugs
const COMMON_SYMBOLS = [
  'NVDA', 'AAPL', 'MSFT', 'GOOGL', 'META', 'AMZN', 'TSLA', 'AMD',
  'NFLX', 'CRM', 'INTC', 'MU', 'WMT', 'TGT', 'COST', 'NKE',
  'JPM', 'BAC', 'GS', 'V', 'MA'
];

/**
 * Extract stock symbol from Polymarket event slug
 */
export function extractSymbolFromSlug(slug) {
  if (!slug) return null;

  // Try pattern matching
  const patterns = [
    /^([a-z]{1,5})-quarterly-earnings/i,
    /will-.*-\(([a-z]{1,5})\)-beat/i,
    /will-([a-z]{1,5})-beat-quarterly/i,
  ];

  for (const pattern of patterns) {
    const match = slug.match(pattern);
    if (match?.[1]) return match[1].toUpperCase();
  }

  // Fallback: find common symbols
  const slugUpper = slug.toUpperCase();
  for (const symbol of COMMON_SYMBOLS) {
    if (slugUpper.includes(symbol)) return symbol;
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
 * Filter for earnings-related events
 */
function filterEarningsEvents(events) {
  const keywords = ['earnings', 'beat quarterly', 'quarterly earnings', 'eps'];
  return events.filter(event => {
    const text = `${event.title || ''} ${event.slug || ''}`.toLowerCase();
    return keywords.some(kw => text.includes(kw));
  });
}

/**
 * Transform Polymarket event to our format
 */
function transformEvent(event) {
  const market = event.markets?.[0];
  if (!market) return null;

  const symbol = extractSymbolFromSlug(event.slug);
  if (!symbol) return null;

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

/**
 * Main: Fetch all earnings markets
 */
export async function fetchEarningsMarkets(useCache = true) {
  // Check cache
  if (useCache && earningsCache.data && earningsCache.lastFetched) {
    if (Date.now() - earningsCache.lastFetched < CACHE_DURATION) {
      return earningsCache.data;
    }
  }

  try {
    let allEvents = [];
    let offset = 0;

    // Paginate through results
    while (offset < 300) {
      const events = await fetchActiveEvents(100, offset);
      if (!events?.length) break;
      allEvents = [...allEvents, ...events];
      if (events.length < 100) break;
      offset += 100;
    }

    // Filter and transform
    const earnings = filterEarningsEvents(allEvents)
      .map(transformEvent)
      .filter(Boolean)
      .sort((a, b) => new Date(a.reportDate) - new Date(b.reportDate));

    // Update cache
    earningsCache = { data: earnings, lastFetched: Date.now() };
    return earnings;
  } catch (error) {
    console.error('Polymarket fetch error:', error);
    return earningsCache.data || [];
  }
}

/**
 * Get upcoming earnings (next N days)
 */
export async function getUpcomingEarnings(days = 14) {
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
