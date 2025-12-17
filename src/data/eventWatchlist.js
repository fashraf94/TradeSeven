// src/data/eventWatchlist.js
// Keywords to match EODHD economic indicators
// Note: Fed meetings, Jackson Hole, and holidays come from staticMacroEvents.js

// EODHD Event Watchlist - for matching API event types
export const EODHD_EVENT_WATCHLIST = [
  // ============================================
  // TIER 1: HIGH IMPACT INDICATORS
  // ============================================
  {
    keywords: ['cpi', 'consumer price index'],
    displayName: 'CPI Inflation',
    type: 'cpi',
    impact: 'high',
    icon: '📊',
    color: '#ef4444',
    avgMarketMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 },
    defaultTip: 'Hot inflation = rate hike fears = tech sells off. Cool inflation = rally, especially growth stocks.',
  },
  {
    keywords: ['nonfarm payrolls', 'non-farm payrolls', 'nfp', 'employment situation'],
    displayName: 'Jobs Report (NFP)',
    type: 'jobs_report',
    impact: 'high',
    icon: '💼',
    color: '#ef4444',
    avgMarketMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 },
    defaultTip: 'Strong jobs = good economy but higher rate expectations. Goldilocks is moderate growth (150-200k jobs).',
  },
  {
    keywords: ['unemployment rate'],
    displayName: 'Unemployment Rate',
    type: 'unemployment',
    impact: 'high',
    icon: '📉',
    color: '#ef4444',
    avgMarketMove: { market: 0.8, highBeta: 1.5, crypto: 1.8 },
    defaultTip: 'Rising unemployment signals economic slowdown - could mean rate cuts ahead (bullish for growth stocks).',
  },

  // ============================================
  // TIER 2: MEDIUM IMPACT INDICATORS
  // ============================================
  {
    keywords: ['retail sales'],
    displayName: 'Retail Sales',
    type: 'retail_sales',
    impact: 'medium',
    icon: '🛒',
    color: '#f59e0b',
    avgMarketMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 },
    defaultTip: 'Consumer spending drives 70% of GDP. Strong retail = economic confidence. Weak retail = recession fears.',
  },
  {
    keywords: ['housing starts', 'building permits'],
    displayName: 'Housing Starts',
    type: 'housing_starts',
    impact: 'medium',
    icon: '🏠',
    color: '#f59e0b',
    avgMarketMove: { market: 0.3, highBeta: 0.6, crypto: 0.5 },
    defaultTip: 'Leading indicator for construction sector. Very rate-sensitive - lower rates = more building.',
  },
  {
    keywords: ['nahb', 'homebuilder confidence', 'housing market index', 'home builder confidence'],
    displayName: 'Homebuilder Confidence',
    type: 'nahb',
    impact: 'medium',
    icon: '🏗️',
    color: '#f59e0b',
    avgMarketMove: { market: 0.2, highBeta: 0.5, crypto: 0.4 },
    defaultTip: 'Survey of homebuilder sentiment. Leading indicator for housing sector. Above 50 = optimistic.',
  },
  {
    keywords: ['pce', 'personal consumption expenditure', 'pce price index'],
    displayName: 'PCE Price Index',
    type: 'pce',
    impact: 'medium',
    icon: '💵',
    color: '#f59e0b',
    avgMarketMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 },
    defaultTip: "The Fed's PREFERRED inflation measure - sometimes more important than CPI. Core PCE excludes food/energy.",
  },
  {
    keywords: ['gdp', 'gross domestic product'],
    displayName: 'GDP Report',
    type: 'gdp',
    impact: 'medium',
    icon: '🌐',
    color: '#f59e0b',
    avgMarketMove: { market: 0.6, highBeta: 1.0, crypto: 1.2 },
    defaultTip: 'Backward-looking but sets the narrative. Negative GDP = recession fears. Strong GDP = soft landing hopes.',
  },
  {
    keywords: ['ppi', 'producer price index'],
    displayName: 'PPI (Producer Prices)',
    type: 'ppi',
    impact: 'medium',
    icon: '🏭',
    color: '#f59e0b',
    avgMarketMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 },
    defaultTip: 'Wholesale inflation - often a leading indicator for CPI. Rising PPI can signal future consumer inflation.',
  },

  // ============================================
  // TIER 3: LOWER IMPACT (but newsworthy)
  // ============================================
  {
    keywords: ['initial jobless claims', 'jobless claims', 'initial claims'],
    displayName: 'Jobless Claims',
    type: 'jobless_claims',
    impact: 'low',
    icon: '📋',
    color: '#22c55e',
    avgMarketMove: { market: 0.2, highBeta: 0.4, crypto: 0.5 },
    defaultTip: 'Weekly pulse on layoffs. Spikes above 250k get attention. Steady = stable labor market.',
  },
  {
    keywords: ['consumer confidence', 'consumer sentiment', 'michigan consumer'],
    displayName: 'Consumer Confidence',
    type: 'consumer_confidence',
    impact: 'low',
    icon: '😊',
    color: '#22c55e',
    avgMarketMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 },
    defaultTip: 'How optimistic are consumers? High confidence = more spending. Low = belt-tightening ahead.',
  },
];

// Legacy export for backwards compatibility
export const EVENT_WATCHLIST = EODHD_EVENT_WATCHLIST;

// Event type display configuration
export const EVENT_TYPE_CONFIG = {
  // Static event types (from staticMacroEvents.js)
  fed_decision: { icon: '🏛️', label: 'Fed Decision', color: '#ef4444' },
  jackson_hole: { icon: '🏔️', label: 'Jackson Hole', color: '#ef4444' },
  market_closed: { icon: '🚫', label: 'Closed', color: '#6b7280' },
  early_close: { icon: '⏰', label: 'Early Close', color: '#6b7280' },

  // EODHD indicator types
  cpi: { icon: '📊', label: 'CPI', color: '#ef4444' },
  jobs_report: { icon: '💼', label: 'Jobs', color: '#ef4444' },
  unemployment: { icon: '📉', label: 'Unemployment', color: '#ef4444' },
  retail_sales: { icon: '🛒', label: 'Retail', color: '#f59e0b' },
  housing_starts: { icon: '🏠', label: 'Housing', color: '#f59e0b' },
  nahb: { icon: '🏗️', label: 'Homebuilders', color: '#f59e0b' },
  pce: { icon: '💵', label: 'PCE', color: '#f59e0b' },
  gdp: { icon: '🌐', label: 'GDP', color: '#f59e0b' },
  ppi: { icon: '🏭', label: 'PPI', color: '#f59e0b' },
  jobless_claims: { icon: '📋', label: 'Claims', color: '#22c55e' },
  consumer_confidence: { icon: '😊', label: 'Confidence', color: '#22c55e' },

  // Earnings
  earnings: { icon: '📈', label: 'Earnings', color: '#a855f7' },
};

/**
 * Match an EODHD event type to our watchlist
 * @param {string} eventType - The event type from EODHD API
 * @returns {object|null} - Matching watchlist item or null
 */
export const matchEodhdEvent = (eventType) => {
  if (!eventType) return null;
  const typeLower = eventType.toLowerCase();

  return EODHD_EVENT_WATCHLIST.find(item =>
    item.keywords.some(keyword => typeLower.includes(keyword.toLowerCase()))
  );
};

// Legacy alias for backwards compatibility
export const matchEventToWatchlist = matchEodhdEvent;
