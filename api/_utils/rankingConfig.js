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
    stocks: ['AAPL','MSFT','NVDA','AVGO','ORCL','CRM','AMD','ADBE','CSCO','ACN','IBM','INTC','QCOM','TXN','NOW','INTU','AMAT','MU','LRCX','KLAC','SHOP','PLTR','SNOW','BE','CRWV'],
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
    stocks: ['BRK-B','JPM','V','MA','BAC','WFC','GS','MS','SPGI','AXP','PGR','BLK','C','MMC','CB','SCHW','ICE','CME','AON','USB','COIN','AFRM','HOOD'],
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
    stocks: ['AMZN','TSLA','HD','MCD','NKE','LOW','BKNG','SBUX','TJX','ORLY','CMG','MAR','GM','F','DHI','AZO','ROST','LEN','YUM','EBAY','DKNG','GME'],
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
    stocks: ['GE','CAT','RTX','UNP','HON','DE','BA','LMT','UPS','ADP','ETN','ITW','NOC','GD','WM','CSX','NSC','MMM','EMR','FDX','GEV','RKLB','PWR'],
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
// Ranking Dimensions — 8 pillars, 2-4 dimensions each
// ---------------------------------------------------------------------------

export const DIMENSIONS = {
  // ── Growth ──────────────────────────────────────────────────────────────
  revenueGrowth: {
    label: 'Revenue Growth YoY',
    pillar: 'growth',
    field: 'revenueGrowthYOY',
    inverted: false,
    unit: '%',
    source: 'Highlights.QuarterlyRevenueGrowthYOY',
  },
  epsGrowth: {
    label: 'EPS Growth YoY',
    pillar: 'growth',
    field: 'earningsGrowthYOY',
    inverted: false,
    unit: '%',
    source: 'Highlights.QuarterlyEarningsGrowthYOY',
  },

  // ── Profitability ───────────────────────────────────────────────────────
  opMargin: {
    label: 'Operating Margin',
    pillar: 'profitability',
    field: 'opMarginTTM',
    inverted: false,
    unit: '%',
    source: 'Highlights.OperatingMarginTTM',
  },
  netMargin: {
    label: 'Net Profit Margin',
    pillar: 'profitability',
    field: 'profitMarginTTM',
    inverted: false,
    unit: '%',
    source: 'Highlights.ProfitMarginTTM',
  },
  grossMargin: {
    label: 'Gross Margin',
    pillar: 'profitability',
    field: 'grossMargin',
    inverted: false,
    unit: '%',
    computed: true,
  },

  // ── Efficiency ──────────────────────────────────────────────────────────
  roa: {
    label: 'Return on Assets',
    pillar: 'efficiency',
    field: 'roaTTM',
    inverted: false,
    unit: '%',
    source: 'Highlights.ReturnOnAssetsTTM',
  },
  roe: {
    label: 'Return on Equity',
    pillar: 'efficiency',
    field: 'roeTTM',
    inverted: false,
    unit: '%',
    source: 'Highlights.ReturnOnEquityTTM',
  },

  // ── Valuation (all inverted — lower = better) ──────────────────────────
  evEbitda: {
    label: 'EV/EBITDA',
    pillar: 'valuation',
    field: 'evEbitda',
    inverted: true,
    unit: 'x',
    source: 'Valuation.EnterpriseValueEbitda',
  },
  trailingPE: {
    label: 'P/E Ratio (TTM)',
    pillar: 'valuation',
    field: 'trailingPE',
    inverted: true,
    unit: 'x',
    source: 'Valuation.TrailingPE',
  },
  priceSales: {
    label: 'Price/Sales',
    pillar: 'valuation',
    field: 'priceSalesTTM',
    inverted: true,
    unit: 'x',
    source: 'Valuation.PriceSalesTTM',
  },
  priceBook: {
    label: 'Price/Book',
    pillar: 'valuation',
    field: 'priceBookMRQ',
    inverted: true,
    unit: 'x',
    source: 'Valuation.PriceBookMRQ',
  },

  // ── Capital Efficiency ─────────────────────────────────────────────────
  fcfYield: {
    label: 'FCF Yield',
    pillar: 'capitalEff',
    field: 'fcfYield',
    inverted: false,
    unit: '%',
    computed: true,
  },
  dividendYield: {
    label: 'Dividend Yield',
    pillar: 'capitalEff',
    field: 'dividendYield',
    inverted: false,
    unit: '%',
    source: 'Highlights.DividendYield',
  },
  fcfMargin: {
    label: 'FCF Margin',
    pillar: 'capitalEff',
    field: 'fcfMargin',
    inverted: false,
    unit: '%',
    computed: true,
  },

  // ── Financial Health (NEW) ─────────────────────────────────────────────
  debtToEquity: {
    label: 'Debt/Equity',
    pillar: 'financialHealth',
    field: 'debtToEquity',
    inverted: true,
    unit: 'x',
    computed: true,
  },
  currentRatio: {
    label: 'Current Ratio',
    pillar: 'financialHealth',
    field: 'currentRatio',
    inverted: false,
    unit: 'x',
    computed: true,
  },
  interestCoverage: {
    label: 'Interest Coverage',
    pillar: 'financialHealth',
    field: 'interestCoverage',
    inverted: false,
    unit: 'x',
    computed: true,
  },
  netDebtEbitda: {
    label: 'Net Debt/EBITDA',
    pillar: 'financialHealth',
    field: 'netDebtEbitda',
    inverted: true,
    unit: 'x',
    computed: true,
  },

  // ── Earnings Consistency (NEW) ─────────────────────────────────────────
  beatRate: {
    label: 'Beat Rate',
    pillar: 'earningsConsistency',
    field: 'beatRate',
    inverted: false,
    unit: '%',
    computed: true,
  },
  avgSurpriseMag: {
    label: 'Avg Surprise Magnitude',
    pillar: 'earningsConsistency',
    field: 'avgSurpriseMag',
    inverted: false,
    unit: '%',
    computed: true,
  },
  surpriseConsistency: {
    label: 'Surprise Consistency',
    pillar: 'earningsConsistency',
    field: 'surpriseConsistency',
    inverted: true,
    unit: '%',
    computed: true,
  },

  // ── Sentiment (expanded with Short Interest) ───────────────────────────
  earningsRevisions: {
    label: 'Earnings Revisions',
    pillar: 'sentiment',
    field: 'earningsRevisions',
    inverted: false,
    unit: 'score',
    computed: true,
  },
  avgSurprise: {
    label: 'Avg Earnings Surprise',
    pillar: 'sentiment',
    field: 'avgEarningsSurprise',
    inverted: false,
    unit: '%',
    computed: true,
  },
  shortInterest: {
    label: 'Short Interest',
    pillar: 'sentiment',
    field: 'shortInterestScore',
    inverted: true,
    unit: '%',
    computed: true,
  },
};

// ---------------------------------------------------------------------------
// 8 Pillars — weighted to 100%, 2-4 dimensions each
//
// Momentum pillar REMOVED — price returns are a technical signal, not
// fundamental. The Technical Score already captures momentum via RS vs SPY,
// SMA Positioning, and the new MACD factor.
// ---------------------------------------------------------------------------

export const PILLARS = {
  growth:              { label: 'Growth',                icon: '📈', dimensions: ['revenueGrowth', 'epsGrowth'],                              weight: 0.15 },
  profitability:       { label: 'Profitability',          icon: '💰', dimensions: ['opMargin', 'netMargin', 'grossMargin'],                   weight: 0.15 },
  earningsConsistency: { label: 'Earnings Consistency',   icon: '🎯', dimensions: ['beatRate', 'avgSurpriseMag', 'surpriseConsistency'],      weight: 0.15 },
  financialHealth:     { label: 'Financial Health',       icon: '🛡️', dimensions: ['debtToEquity', 'currentRatio', 'interestCoverage', 'netDebtEbitda'], weight: 0.15 },
  sentiment:           { label: 'Sentiment',              icon: '📡', dimensions: ['earningsRevisions', 'avgSurprise', 'shortInterest'],      weight: 0.15 },
  valuation:           { label: 'Valuation',              icon: '📊', dimensions: ['evEbitda', 'trailingPE', 'priceSales', 'priceBook'],      weight: 0.10 },
  capitalEff:          { label: 'Capital Efficiency',     icon: '💎', dimensions: ['fcfYield', 'dividendYield', 'fcfMargin'],                 weight: 0.10 },
  efficiency:          { label: 'Efficiency',             icon: '⚙️', dimensions: ['roa', 'roe'],                                             weight: 0.05 },
};

// Per-pillar weight for composite score computation — tune these without touching other code
export const COMPETE_PILLAR_WEIGHTS = {
  growth:              0.15,
  profitability:       0.15,
  earningsConsistency: 0.15,
  financialHealth:     0.15,
  sentiment:           0.15,
  valuation:           0.10,
  capitalEff:          0.10,
  efficiency:          0.05,
};

// ---------------------------------------------------------------------------
// Technical Factor Weights — 7 factors summing to 100%
//
// RS Trend Direction REMOVED — signal captured by RS percentile changes
// over time and the new MACD factor.
// ---------------------------------------------------------------------------

export const TECHNICAL_FACTOR_WEIGHTS = {
  rsVsSpy:      0.22,  // Macro relative strength (was 30pts/100)
  sectorRS:     0.15,  // NEW: Intra-sector leadership vs sector ETF
  smaPosition:  0.18,  // Trend structure via moving averages (was 25pts/100)
  macd:         0.12,  // NEW: Momentum inflection via MACD crossover state
  weekHighProx: 0.12,  // Distance to 52-week high (was 15pts/100)
  volume:       0.12,  // Up/down volume ratio confirmation (same)
  rsi:          0.09,  // RSI context for overbought/oversold (was 10pts/100)
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
 * SharesStats added for short interest data (ShortPercentOfFloat, ShortRatio).
 */
export const EODHD_FUNDAMENTALS_FILTER =
  'Highlights,Valuation,Technicals,Earnings,Financials,SharesStats,General::Name';

// ---------------------------------------------------------------------------
// Sector Default Beat Rates — fallback for stocks with <4 quarters of history
// ---------------------------------------------------------------------------

export const SECTOR_BEAT_RATES = {
  XLK: 0.72, // Technology
  XLV: 0.68, // Healthcare
  XLF: 0.70, // Financials
  XLE: 0.65, // Energy
  XLY: 0.68, // Consumer Discretionary
  XLP: 0.66, // Consumer Staples
  XLI: 0.67, // Industrials
  XLB: 0.64, // Materials
  XLU: 0.70, // Utilities
  XLRE: 0.66, // Real Estate
  XLC: 0.69, // Communication Services
};

// ---------------------------------------------------------------------------
// Game-Mode Context Weighting Profiles
//
// Each profile defines how to blend fundamental + technical base scores,
// plus ATR as a volatility modifier and per-factor/pillar weight overrides.
// These produce game-specific fit scores (0-100) alongside the standard
// Composite Score.
// ---------------------------------------------------------------------------

export const GAME_MODE_PROFILES = {
  standard: {
    fundamentalWeight: 0.50,
    technicalWeight: 0.50,
    atrModifier: 0,
  },

  baggerBomb: {
    // 1-day PvP — maximize explosive upside potential
    fundamentalWeight: 0.10,
    technicalWeight: 0.90,
    atrModifier: 0.20,  // REWARD high volatility
    technicalOverrides: {
      rsVsSpy:      1.2,
      sectorRS:     1.3,
      macd:         1.5,
      volume:       1.4,
      smaPosition:  0.6,
      rsi:          0.8,
      weekHighProx: 0.7,
    },
  },
};
