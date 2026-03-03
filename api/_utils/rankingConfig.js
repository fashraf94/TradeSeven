/**
 * Ranking Configuration
 *
 * Stock universe, dimension definitions, tier labels, and sector composite
 * weights for the daily peer-ranking cron job.
 *
 * NOTE: The stock lists are duplicated from src/constants/sectors.js because
 * Vercel serverless functions cannot import from src/. Keep them in sync.
 */

// ---------------------------------------------------------------------------
// Stock Universe — 11 GICS sectors, 20 stocks each (220 total)
// ---------------------------------------------------------------------------

export const STOCK_UNIVERSE = {
  XLK: {
    name: 'Technology',
    etf: 'XLK',
    color: '#3b82f6',
    stocks: ['AAPL','MSFT','NVDA','AVGO','ORCL','CRM','AMD','ADBE','CSCO','ACN','IBM','INTC','QCOM','TXN','NOW','INTU','AMAT','MU','LRCX','KLAC'],
  },
  XLV: {
    name: 'Healthcare',
    etf: 'XLV',
    color: '#10b981',
    stocks: ['LLY','UNH','JNJ','ABBV','MRK','TMO','ABT','PFE','AMGN','DHR','ISRG','MDT','BMY','VRTX','SYK','GILD','CVS','ELV','CI','BSX'],
  },
  XLF: {
    name: 'Financials',
    etf: 'XLF',
    color: '#f59e0b',
    stocks: ['BRK-B','JPM','V','MA','BAC','WFC','GS','MS','SPGI','AXP','PGR','BLK','C','MMC','CB','SCHW','ICE','CME','AON','USB'],
  },
  XLE: {
    name: 'Energy',
    etf: 'XLE',
    color: '#ef4444',
    stocks: ['XOM','CVX','COP','SLB','EOG','MPC','PSX','VLO','OXY','WMB','KMI','HES','HAL','DVN','BKR','FANG','TRGP','OKE','CTRA'],
  },
  XLY: {
    name: 'Consumer Discretionary',
    etf: 'XLY',
    color: '#8b5cf6',
    stocks: ['AMZN','TSLA','HD','MCD','NKE','LOW','BKNG','SBUX','TJX','ORLY','CMG','MAR','GM','F','DHI','AZO','ROST','LEN','YUM','EBAY'],
  },
  XLP: {
    name: 'Consumer Staples',
    etf: 'XLP',
    color: '#06b6d4',
    stocks: ['PG','COST','WMT','KO','PEP','PM','MDLZ','MO','CL','KMB','GIS','STZ','SYY','KHC','HSY','K','KR','WBA','TSN','CAG'],
  },
  XLI: {
    name: 'Industrials',
    etf: 'XLI',
    color: '#6366f1',
    stocks: ['GE','CAT','RTX','UNP','HON','DE','BA','LMT','UPS','ADP','ETN','ITW','NOC','GD','WM','CSX','NSC','MMM','EMR','FDX'],
  },
  XLB: {
    name: 'Materials',
    etf: 'XLB',
    color: '#84cc16',
    stocks: ['LIN','SHW','APD','FCX','ECL','NEM','NUE','DOW','DD','CTVA','PPG','VMC','MLM','ALB','IFF','CE','CF','MOS','FMC','PKG'],
  },
  XLU: {
    name: 'Utilities',
    etf: 'XLU',
    color: '#f97316',
    stocks: ['NEE','SO','DUK','CEG','SRE','AEP','D','PCG','EXC','XEL','PEG','ED','WEC','EIX','AWK','DTE','ETR','PPL','FE','AEE'],
  },
  XLRE: {
    name: 'Real Estate',
    etf: 'XLRE',
    color: '#ec4899',
    stocks: ['PLD','AMT','EQIX','WELL','SPG','PSA','DLR','O','CCI','VICI','SBAC','AVB','EQR','WY','EXR','ARE','MAA','VTR','IRM','UDR'],
  },
  XLC: {
    name: 'Communication Services',
    etf: 'XLC',
    color: '#14b8a6',
    stocks: ['META','GOOGL','GOOG','NFLX','T','VZ','DIS','CMCSA','TMUS','CHTR','EA','WBD','OMC','TTWO','LYV','IPG','MTCH','PARA','FOXA','NWS'],
  },
};

// Flat list of all tickers for quick lookup
export const ALL_TICKERS = Object.values(STOCK_UNIVERSE).flatMap(s => s.stocks);

// Ticker → sectorId lookup
export const TICKER_TO_SECTOR = {};
for (const [sectorId, sector] of Object.entries(STOCK_UNIVERSE)) {
  for (const ticker of sector.stocks) {
    TICKER_TO_SECTOR[ticker] = sectorId;
  }
}

// Sector ETF symbols for historical price fetching
export const SECTOR_ETFS = Object.values(STOCK_UNIVERSE).map(s => s.etf);

// ---------------------------------------------------------------------------
// 8 Ranking Dimensions
// ---------------------------------------------------------------------------

export const DIMENSIONS = {
  growth: {
    label: 'Revenue Growth YoY',
    pillar: 'growth',
    field: 'revenueGrowthYOY',
    inverted: false,
    unit: '%',
    source: 'Highlights.QuarterlyRevenueGrowthYOY',
  },
  profitability: {
    label: 'Operating Margin TTM',
    pillar: 'profitability',
    field: 'opMarginTTM',
    inverted: false,
    unit: '%',
    source: 'Highlights.OperatingMarginTTM',
  },
  profitabilityTrend: {
    label: 'Margin Trend (TTM vs Prior TTM)',
    pillar: 'profitability',
    field: 'marginTrend',
    inverted: false,
    unit: 'pp',
    computed: true,
  },
  efficiency: {
    label: 'Return on Assets TTM',
    pillar: 'efficiency',
    field: 'roaTTM',
    inverted: false,
    unit: '%',
    source: 'Highlights.ReturnOnAssetsTTM',
  },
  valuation: {
    label: 'Forward P/E',
    pillar: 'valuation',
    field: 'forwardPE',
    inverted: true,
    unit: 'x',
    source: 'Valuation.ForwardPE',
  },
  healthCash: {
    label: 'FCF Yield',
    pillar: 'health',
    field: 'fcfYield',
    inverted: false,
    unit: '%',
    computed: true,
  },
  healthDebt: {
    label: 'Interest Coverage',
    pillar: 'health',
    field: 'interestCoverage',
    inverted: false,
    unit: 'x',
    computed: true,
  },
  sentimentPrice: {
    label: '52-Week Range Position',
    pillar: 'sentiment',
    field: 'range52wPosition',
    inverted: false,
    unit: '%',
    source: 'Computed from Technicals.52WeekHigh/Low',
  },
  sentimentRevisions: {
    label: 'Earnings Revision Trend',
    pillar: 'sentiment',
    field: 'epsRevisionScore',
    inverted: false,
    unit: 'score',
    computed: true,
  },
};

// ---------------------------------------------------------------------------
// 6 Pillars (dual-dimension pillars for Health + Sentiment)
// ---------------------------------------------------------------------------

export const PILLARS = {
  growth:        { label: 'Growth',        dimensions: ['growth'] },
  profitability: { label: 'Profitability', dimensions: ['profitability', 'profitabilityTrend'], weights: [0.65, 0.35] },
  efficiency:    { label: 'Efficiency',    dimensions: ['efficiency'] },
  valuation:     { label: 'Valuation',     dimensions: ['valuation'] },
  health:        { label: 'Health',        dimensions: ['healthCash', 'healthDebt'] },
  sentiment:     { label: 'Sentiment',     dimensions: ['sentimentPrice', 'sentimentRevisions'] },
};

// ---------------------------------------------------------------------------
// Tier Labels
// ---------------------------------------------------------------------------

export const TIER_LABELS = [
  { min: 80, label: 'Sector Leader',  color: '#ffd700' },
  { min: 60, label: 'Above Average',  color: '#00ffff' },
  { min: 40, label: 'In-Line',        color: '#8b949e' },
  { min: 20, label: 'Below Average',  color: '#f59e0b' },
  { min: 0,  label: 'Lags Sector',    color: '#ef4444' },
];

export function getTierLabel(percentile) {
  if (percentile == null) return { label: 'N/A', color: '#6e7681' };
  for (const tier of TIER_LABELS) {
    if (percentile >= tier.min) return tier;
  }
  return TIER_LABELS[TIER_LABELS.length - 1];
}

// ---------------------------------------------------------------------------
// Sector Composite Weights
// ---------------------------------------------------------------------------

export const SECTOR_COMPOSITE_WEIGHTS = {
  breadth:            0.30,
  momentum3M:         0.30,
  earningsRevisions:  0.20,
  medianGrowth:       0.10,
  valuationDiscount:  0.10,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a raw value to a 0-100 score given an expected range.
 * Values outside the range are clamped.
 */
export function normalizeToScore(value, min, max) {
  if (value == null || isNaN(value)) return 50;
  const clamped = Math.max(min, Math.min(max, value));
  return ((clamped - min) / (max - min)) * 100;
}

/**
 * Compute the return over N trading days from a descending-sorted price array.
 * @param {Array<{close: number}>} prices - Descending by date (newest first)
 * @param {number} days - Number of trading days to look back
 * @returns {number|null} Return as percentage
 */
export function computeReturn(prices, days) {
  if (!prices || prices.length < days + 1) return null;
  const current = prices[0]?.close;
  const past = prices[Math.min(days, prices.length - 1)]?.close;
  if (!current || !past || past === 0) return null;
  return ((current - past) / past) * 100;
}

/**
 * EODHD filter string for fundamentals — only fetch needed sections.
 */
export const EODHD_FUNDAMENTALS_FILTER =
  'Highlights,Valuation,Technicals,Earnings,Financials::Income_Statement::quarterly,Financials::Cash_Flow::quarterly,General::Name';
