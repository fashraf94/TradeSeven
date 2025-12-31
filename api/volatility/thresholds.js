// Vercel Serverless Function - Volatility Thresholds for MarketClash TD Scoring
// Endpoint: GET /api/volatility/thresholds?symbols=AAPL,MSFT,NVDA&type=stock
//
// Calculates personalized breakout thresholds for each asset based on ATR
// Uses the "DraftKings Model" - assets that have been volatile recently
// get HIGHER thresholds (harder to score touchdowns)

// ============================================
// DEFAULT THRESHOLDS (fallback when API fails)
// ============================================

const STOCK_DEFAULTS = {
  // High volatility
  'TSLA': 4.0, 'NVDA': 3.5, 'AMD': 3.5, 'COIN': 5.0, 'GME': 6.0,
  'MSTR': 5.0, 'RIVN': 4.5, 'LCID': 4.5, 'NIO': 4.0, 'PLTR': 3.5,
  // Medium volatility
  'AAPL': 2.0, 'MSFT': 2.0, 'GOOGL': 2.5, 'AMZN': 2.5, 'META': 3.0,
  'NFLX': 3.0, 'CRM': 2.5, 'ORCL': 2.0, 'ADBE': 2.5, 'INTC': 2.5,
  // Low volatility
  'JNJ': 1.2, 'KO': 1.0, 'PG': 1.0, 'WMT': 1.5, 'JPM': 1.8,
  'BAC': 1.8, 'WFC': 1.8, 'VZ': 1.2, 'T': 1.5, 'XOM': 2.0,
  'DEFAULT': 2.5
};

const CRYPTO_DEFAULTS = {
  'BTC': 5.0, 'ETH': 6.0, 'SOL': 8.0, 'ADA': 7.0,
  'DOGE': 10.0, 'XRP': 7.0, 'AVAX': 8.0, 'DOT': 7.0,
  'MATIC': 8.0, 'LINK': 7.0, 'UNI': 8.0, 'ATOM': 7.0,
  'LTC': 6.0, 'BCH': 6.0, 'NEAR': 8.0, 'APT': 8.0,
  'ARB': 9.0, 'OP': 9.0, 'SHIB': 12.0, 'PEPE': 15.0,
  'DEFAULT': 6.0
};

// Threshold bounds
const STOCK_BOUNDS = { min: 1.0, max: 15.0 };
const CRYPTO_BOUNDS = { min: 2.0, max: 25.0 };

// Multipliers for base threshold calculation
const STOCK_MULTIPLIER = 1.5;
const CRYPTO_MULTIPLIER = 2.0;

// ============================================
// ATR CALCULATION HELPERS
// ============================================

/**
 * Calculate True Range for a single day
 * TR = max(high - low, |high - prevClose|, |low - prevClose|)
 */
function calculateTrueRange(high, low, prevClose) {
  const hl = high - low;
  const hpc = Math.abs(high - prevClose);
  const lpc = Math.abs(low - prevClose);
  return Math.max(hl, hpc, lpc);
}

/**
 * Calculate ATR as percentage of price
 */
function calculateATRPercent(ohlcData, days) {
  if (!ohlcData || ohlcData.length < days + 1) {
    return null;
  }

  const trValues = [];

  // Calculate TR for each day (starting from index 1 to have prevClose)
  for (let i = 1; i < ohlcData.length; i++) {
    const current = ohlcData[i];
    const prev = ohlcData[i - 1];

    const tr = calculateTrueRange(
      current.high,
      current.low,
      prev.close
    );

    // Convert to percentage of closing price
    const trPercent = (tr / current.close) * 100;
    trValues.push(trPercent);
  }

  // Get the last N days of TR values
  const recentTR = trValues.slice(-days);

  if (recentTR.length < days) {
    return null;
  }

  // Calculate average (ATR)
  const atr = recentTR.reduce((sum, val) => sum + val, 0) / recentTR.length;
  return atr;
}

/**
 * Calculate threshold from ATR values
 */
function calculateThreshold(baseATR, recentATR, type) {
  const multiplier = type === 'crypto' ? CRYPTO_MULTIPLIER : STOCK_MULTIPLIER;
  const bounds = type === 'crypto' ? CRYPTO_BOUNDS : STOCK_BOUNDS;

  // Momentum factor: how volatile is it recently vs baseline?
  const momentumFactor = recentATR / baseATR;

  // Base threshold with momentum adjustment
  let threshold = baseATR * multiplier * momentumFactor;

  // Clamp to bounds
  threshold = Math.max(bounds.min, Math.min(bounds.max, threshold));

  return {
    threshold: Number(threshold.toFixed(2)),
    momentumFactor: Number(momentumFactor.toFixed(2))
  };
}

/**
 * Get default threshold for a symbol
 */
function getDefaultThreshold(symbol, type) {
  const defaults = type === 'crypto' ? CRYPTO_DEFAULTS : STOCK_DEFAULTS;
  return defaults[symbol.toUpperCase()] || defaults['DEFAULT'];
}

/**
 * Build full threshold response object
 */
function buildThresholdResponse(symbol, threshold, baseATR, recentATR, momentumFactor, type) {
  return {
    symbol: symbol.toUpperCase(),
    threshold,
    baseATR: Number(baseATR.toFixed(2)),
    recentATR: Number(recentATR.toFixed(2)),
    momentumFactor,
    // Rally = 1.5x threshold, Moonshot = 2.0x threshold
    rallyThreshold: Number((threshold * 1.5).toFixed(2)),
    moonshotThreshold: Number((threshold * 2.0).toFixed(2)),
    // Negative moves (same thresholds, opposite direction)
    bustThreshold: threshold,
    crashThreshold: Number((threshold * 1.5).toFixed(2)),
    meltdownThreshold: Number((threshold * 2.0).toFixed(2)),
    type,
    calculatedAt: new Date().toISOString()
  };
}

/**
 * Build fallback threshold response
 */
function buildFallbackResponse(symbol, type) {
  const threshold = getDefaultThreshold(symbol, type);
  return {
    symbol: symbol.toUpperCase(),
    threshold,
    baseATR: threshold / (type === 'crypto' ? CRYPTO_MULTIPLIER : STOCK_MULTIPLIER),
    recentATR: threshold / (type === 'crypto' ? CRYPTO_MULTIPLIER : STOCK_MULTIPLIER),
    momentumFactor: 1.0,
    rallyThreshold: Number((threshold * 1.5).toFixed(2)),
    moonshotThreshold: Number((threshold * 2.0).toFixed(2)),
    bustThreshold: threshold,
    crashThreshold: Number((threshold * 1.5).toFixed(2)),
    meltdownThreshold: Number((threshold * 2.0).toFixed(2)),
    type,
    calculatedAt: new Date().toISOString(),
    isDefault: true
  };
}

// ============================================
// EODHD API HELPERS
// ============================================

/**
 * Fetch historical OHLC data from EODHD
 */
async function fetchHistoricalData(symbol, type, apiKey) {
  // Calculate date range (45 days back)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 45);

  const formatDate = (date) => date.toISOString().split('T')[0];

  // Build URL based on asset type
  let url;
  if (type === 'crypto') {
    // Crypto format: BTC-USD.CC
    url = `https://eodhd.com/api/eod/${symbol.toUpperCase()}-USD.CC?from=${formatDate(startDate)}&to=${formatDate(endDate)}&api_token=${apiKey}&fmt=json`;
  } else {
    // Stock format: AAPL.US
    url = `https://eodhd.com/api/eod/${symbol.toUpperCase()}.US?from=${formatDate(startDate)}&to=${formatDate(endDate)}&api_token=${apiKey}&fmt=json`;
  }

  console.log(`[Volatility] Fetching data for ${symbol} (${type})`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`EODHD returned ${response.status}`);
  }

  const data = await response.json();

  // EODHD returns array of OHLC objects
  // { date, open, high, low, close, adjusted_close, volume }
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('No historical data available');
  }

  return data;
}

/**
 * Process a single symbol and calculate its threshold
 */
async function processSymbol(symbol, type, apiKey) {
  try {
    const ohlcData = await fetchHistoricalData(symbol, type, apiKey);

    // Need at least 15 days for 14-day ATR calculation
    if (ohlcData.length < 15) {
      console.log(`[Volatility] Insufficient data for ${symbol}, using default`);
      return buildFallbackResponse(symbol, type);
    }

    // Calculate 14-day ATR (baseline)
    const baseATR = calculateATRPercent(ohlcData, 14);

    // Calculate 5-day ATR (recent momentum)
    const recentATR = calculateATRPercent(ohlcData, 5);

    if (baseATR === null || recentATR === null) {
      console.log(`[Volatility] ATR calculation failed for ${symbol}, using default`);
      return buildFallbackResponse(symbol, type);
    }

    // Calculate threshold
    const { threshold, momentumFactor } = calculateThreshold(baseATR, recentATR, type);

    console.log(`[Volatility] ${symbol}: baseATR=${baseATR.toFixed(2)}%, recentATR=${recentATR.toFixed(2)}%, momentum=${momentumFactor}, threshold=${threshold}%`);

    return buildThresholdResponse(symbol, threshold, baseATR, recentATR, momentumFactor, type);

  } catch (error) {
    console.error(`[Volatility] Error processing ${symbol}:`, error.message);
    return buildFallbackResponse(symbol, type);
  }
}

// ============================================
// MAIN HANDLER
// ============================================

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbols, type = 'stock' } = req.query;

  // Validate symbols parameter
  if (!symbols) {
    return res.status(400).json({
      error: 'Missing symbols parameter',
      usage: 'GET /api/volatility/thresholds?symbols=AAPL,MSFT,NVDA&type=stock'
    });
  }

  // Validate type parameter
  if (type !== 'stock' && type !== 'crypto') {
    return res.status(400).json({
      error: 'Invalid type parameter',
      valid: ['stock', 'crypto']
    });
  }

  const API_KEY = process.env.EODHD_API_KEY;

  if (!API_KEY) {
    console.error('[Volatility] EODHD_API_KEY not configured');
    return res.status(500).json({ error: 'API not configured' });
  }

  try {
    // Parse and clean symbols
    const symbolList = symbols
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(s => s.length > 0);

    if (symbolList.length === 0) {
      return res.status(400).json({ error: 'No valid symbols provided' });
    }

    // Limit batch size to prevent timeout
    const MAX_SYMBOLS = 20;
    if (symbolList.length > MAX_SYMBOLS) {
      return res.status(400).json({
        error: `Too many symbols. Maximum ${MAX_SYMBOLS} per request`,
        provided: symbolList.length
      });
    }

    console.log(`[Volatility] Processing ${symbolList.length} ${type} symbols:`, symbolList.join(', '));

    // Process all symbols (in parallel for speed, but with care for rate limits)
    const thresholdPromises = symbolList.map(symbol => processSymbol(symbol, type, API_KEY));
    const results = await Promise.all(thresholdPromises);

    // Build response object keyed by symbol
    const thresholds = {};
    results.forEach(result => {
      thresholds[result.symbol] = result;
    });

    return res.status(200).json({
      success: true,
      thresholds,
      calculatedAt: new Date().toISOString(),
      type,
      count: Object.keys(thresholds).length
    });

  } catch (error) {
    console.error('[Volatility] Handler error:', error.message);
    return res.status(500).json({
      error: 'Failed to calculate thresholds',
      message: error.message
    });
  }
}
