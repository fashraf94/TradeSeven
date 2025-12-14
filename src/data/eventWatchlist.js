// src/data/eventWatchlist.js
// Curated list of economic events that actually move markets

export const EVENT_WATCHLIST = [
  // ============================================
  // TIER 1: HIGH IMPACT - Always show these
  // ============================================
  {
    keywords: ['fomc', 'federal funds rate', 'interest rate decision', 'fed rate'],
    displayName: 'Fed Rate Decision',
    type: 'fed_decision',
    impact: 'high',
    icon: '🏛️',
    color: '#ef4444',
    avgMarketMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 },
    defaultTip: 'The Fed sets interest rates for the entire economy. Press conference at 2:30pm often moves markets more than the decision itself.',
    affectedSectors: ['Financials', 'Real Estate', 'Technology', 'All']
  },
  {
    keywords: ['cpi', 'consumer price index'],
    displayName: 'CPI Inflation',
    type: 'cpi',
    impact: 'high',
    icon: '📊',
    color: '#ef4444',
    avgMarketMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 },
    defaultTip: 'Hot inflation = rate hike fears = tech sells off. Cool inflation = rally, especially growth stocks.',
    affectedSectors: ['Technology', 'Consumer Discretionary', 'Real Estate']
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
    affectedSectors: ['All']
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
    affectedSectors: ['All']
  },
  {
    keywords: ['jackson hole'],
    displayName: 'Jackson Hole Symposium',
    type: 'jackson_hole',
    impact: 'high',
    icon: '🏔️',
    color: '#ef4444',
    avgMarketMove: { market: 1.5, highBeta: 2.5, crypto: 3.5 },
    defaultTip: 'Annual Fed symposium where major policy shifts are often announced. One of the most important events of the year.',
    affectedSectors: ['All']
  },
  {
    keywords: ['powell speaks', 'powell testimony', 'fed chair speaks', 'fed chair testimony', 'jerome powell'],
    displayName: 'Fed Chair Powell Speaks',
    type: 'fed_chair_speech',
    impact: 'high',
    icon: '🎙️',
    color: '#ef4444',
    avgMarketMove: { market: 0.8, highBeta: 1.5, crypto: 2.0 },
    defaultTip: 'Markets hang on every word. Hawkish tone = selloff. Dovish tone = rally. Watch for hints about future rate moves.',
    affectedSectors: ['All']
  },

  // ============================================
  // TIER 2: MEDIUM IMPACT - Show when present
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
    affectedSectors: ['Consumer Discretionary', 'Retail']
  },
  {
    keywords: ['housing starts', 'building permits'],
    displayName: 'Housing Starts & Permits',
    type: 'housing_starts',
    impact: 'medium',
    icon: '🏠',
    color: '#f59e0b',
    avgMarketMove: { market: 0.3, highBeta: 0.6, crypto: 0.5 },
    defaultTip: 'Leading indicator for construction sector. Very rate-sensitive - lower rates = more building.',
    affectedSectors: ['Homebuilders', 'Materials', 'Real Estate']
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
    affectedSectors: ['Homebuilders', 'Materials']
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
    affectedSectors: ['All']
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
    affectedSectors: ['All']
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
    affectedSectors: ['Industrials', 'Materials', 'All']
  },

  // ============================================
  // TIER 3: LOWER IMPACT - Newsworthy data
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
    affectedSectors: ['All']
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
    affectedSectors: ['Consumer Discretionary', 'Retail']
  },
];

// Market holidays and closures (static - these don't change)
export const MARKET_HOLIDAYS = [
  { date: '2025-12-24', name: 'Christmas Eve', type: 'early_close', closeTime: '13:00', note: 'Markets close at 1:00 PM ET' },
  { date: '2025-12-25', name: 'Christmas Day', type: 'market_closed', note: 'Markets closed' },
  { date: '2025-12-31', name: "New Year's Eve", type: 'early_close', closeTime: '13:00', note: 'Markets close at 1:00 PM ET' },
  { date: '2026-01-01', name: "New Year's Day", type: 'market_closed', note: 'Markets closed' },
  { date: '2026-01-20', name: 'MLK Day', type: 'market_closed', note: 'Markets closed' },
  { date: '2026-02-16', name: "Presidents' Day", type: 'market_closed', note: 'Markets closed' },
  { date: '2026-04-03', name: 'Good Friday', type: 'market_closed', note: 'Markets closed' },
  { date: '2026-05-25', name: 'Memorial Day', type: 'market_closed', note: 'Markets closed' },
  { date: '2026-07-03', name: 'Independence Day (Observed)', type: 'market_closed', note: 'Markets closed' },
  { date: '2026-09-07', name: 'Labor Day', type: 'market_closed', note: 'Markets closed' },
  { date: '2026-11-26', name: 'Thanksgiving', type: 'market_closed', note: 'Markets closed' },
  { date: '2026-11-27', name: 'Day After Thanksgiving', type: 'early_close', closeTime: '13:00', note: 'Markets close at 1:00 PM ET' },
  { date: '2026-12-24', name: 'Christmas Eve', type: 'early_close', closeTime: '13:00', note: 'Markets close at 1:00 PM ET' },
  { date: '2026-12-25', name: 'Christmas Day', type: 'market_closed', note: 'Markets closed' },
];

// Event type display configuration
export const EVENT_TYPE_CONFIG = {
  fed_decision: { icon: '🏛️', label: 'Fed Decision', color: '#ef4444' },
  fed_chair_speech: { icon: '🎙️', label: 'Fed Chair', color: '#ef4444' },
  jackson_hole: { icon: '🏔️', label: 'Jackson Hole', color: '#ef4444' },
  cpi: { icon: '📊', label: 'CPI', color: '#ef4444' },
  jobs_report: { icon: '💼', label: 'Jobs Report', color: '#ef4444' },
  unemployment: { icon: '📉', label: 'Unemployment', color: '#ef4444' },
  retail_sales: { icon: '🛒', label: 'Retail Sales', color: '#f59e0b' },
  housing_starts: { icon: '🏠', label: 'Housing', color: '#f59e0b' },
  nahb: { icon: '🏗️', label: 'Homebuilders', color: '#f59e0b' },
  pce: { icon: '💵', label: 'PCE', color: '#f59e0b' },
  gdp: { icon: '🌐', label: 'GDP', color: '#f59e0b' },
  ppi: { icon: '🏭', label: 'PPI', color: '#f59e0b' },
  jobless_claims: { icon: '📋', label: 'Jobless Claims', color: '#22c55e' },
  consumer_confidence: { icon: '😊', label: 'Confidence', color: '#22c55e' },
  earnings: { icon: '📈', label: 'Earnings', color: '#a855f7' },
  early_close: { icon: '⏰', label: 'Early Close', color: '#6b7280' },
  market_closed: { icon: '🚫', label: 'Closed', color: '#6b7280' },
};

/**
 * Match an EODHD event name against our watchlist
 * @param {string} eventName - The event name from EODHD API
 * @returns {object|null} - Matching watchlist item or null
 */
export const matchEventToWatchlist = (eventName) => {
  if (!eventName) return null;
  const nameLower = eventName.toLowerCase();

  return EVENT_WATCHLIST.find(item =>
    item.keywords.some(keyword => nameLower.includes(keyword.toLowerCase()))
  );
};

/**
 * Get holidays for a date range
 * @param {string} startDate - ISO date string
 * @param {string} endDate - ISO date string
 * @returns {array} - Holidays in range
 */
export const getHolidaysInRange = (startDate, endDate) => {
  return MARKET_HOLIDAYS.filter(h => h.date >= startDate && h.date <= endDate);
};
