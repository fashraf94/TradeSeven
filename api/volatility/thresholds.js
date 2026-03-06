// Vercel Serverless Function - Volatility Thresholds for FantasyTrades TD Scoring
// Endpoint: GET /api/volatility/thresholds?symbols=AAPL,MSFT,NVDA&type=stock
//
// Calculates personalized breakout thresholds for each asset based on ATR
// Uses the "DraftKings Model" - assets that have been volatile recently
// get HIGHER thresholds (harder to score touchdowns)

import { applySecurityMiddleware } from '../_utils/security.js';
import { getFromCache, setInCache, setCacheHeaders, CACHE_TIERS } from '../_utils/serverCache.js';
import { normalizeSymbolForEODHD } from '../_utils/symbolNormalize.js';

// ============================================
// DEFAULT THRESHOLDS (fallback when API fails)
// ============================================

const STOCK_DEFAULTS = {
  // High volatility
  'TSLA': 3.5, 'NVDA': 2.8, 'AMD': 3.0, 'COIN': 4.0, 'GME': 5.0,
  'MSTR': 4.0, 'RIVN': 3.5, 'LCID': 3.5, 'NIO': 3.0, 'PLTR': 3.0,
  // Medium volatility
  'AAPL': 1.8, 'MSFT': 1.8, 'GOOGL': 2.0, 'AMZN': 2.0, 'META': 2.5,
  'NFLX': 2.5, 'CRM': 2.0, 'ORCL': 1.8, 'ADBE': 2.0, 'INTC': 2.0,
  // Low volatility
  'JNJ': 1.0, 'KO': 0.8, 'PG': 0.8, 'WMT': 1.2, 'JPM': 1.5,
  'BAC': 1.5, 'WFC': 1.5, 'VZ': 1.0, 'T': 1.2, 'XOM': 1.8,
  'DEFAULT': 2.0
};

const CRYPTO_DEFAULTS = {
  // Major coins
  'BTC': 4.0, 'ETH': 5.0, 'SOL': 6.5, 'ADA': 5.5,
  'DOGE': 8.0, 'XRP': 5.5, 'AVAX': 6.5, 'DOT': 5.5,
  'MATIC': 6.5, 'LINK': 5.5, 'UNI': 6.5, 'ATOM': 5.5,
  'LTC': 5.0, 'BCH': 5.0, 'NEAR': 6.5, 'APT': 6.5,
  // Layer 2 / Alt L1
  'ARB': 7.0, 'OP': 7.0, 'SHIB': 10.0, 'PEPE': 12.0,
  'BNB': 5.0, 'TRX': 5.5, 'TON': 6.5, 'XLM': 5.5,
  // DeFi / Infrastructure
  'ALGO': 6.5, 'FIL': 6.5, 'AAVE': 6.5, 'MKR': 5.5,
  'CRV': 7.0, 'SNX': 7.0, 'COMP': 6.5, 'VET': 6.5,
  // Gaming / Metaverse
  'SAND': 8.0, 'MANA': 8.0, 'AXS': 8.0, 'IMX': 7.0,
  'GALA': 10.0, 'ENJ': 7.0,
  // AI / Data
  'RNDR': 8.0, 'RENDER': 8.0, 'FET': 8.0, 'OCEAN': 8.0, 'TAO': 10.0,
  'ASI': 8.0,
  // Stablecoins (very low threshold - shouldn't move much)
  'USDT': 0.5, 'USDC': 0.5,
  // Draft defensive crypto
  'FTM': 7.0, 'EGLD': 7.0, 'RUNE': 8.0, 'KAVA': 7.0, 'CELO': 7.0,
  // Verified replacement symbols
  'PENDLE': 7.0, 'DYDX': 7.0, 'CFX': 8.0, 'SSV': 8.0,
  'MINA': 8.0, 'STORJ': 7.0, 'HIGH': 8.0, 'SUI20947': 8.0,
  'TWT': 7.0, 'WOO': 8.0, 'OSMO': 7.0, 'JOE': 8.0,
  'DEFAULT': 5.0
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
 *
 * Uses a weighted blend of 14-day (baseline) and 5-day (recent) ATR.
 * The threshold represents the expected daily % move for the asset.
 * No multiplier is applied — tier multipliers (1.0x, 1.5x, 2.0x) are
 * handled downstream by BAGGER_TIERS / BUST_TIERS.
 */
function calculateThreshold(baseATR, recentATR, type) {
  const bounds = type === 'crypto' ? CRYPTO_BOUNDS : STOCK_BOUNDS;

  // Momentum factor: how volatile is it recently vs baseline? (informational)
  const momentumFactor = recentATR / baseATR;

  // Weighted blend: 70% baseline + 30% recent momentum
  let threshold = 0.7 * baseATR + 0.3 * recentATR;

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
    baseATR: threshold,
    recentATR: threshold,
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

const FETCH_TIMEOUT_MS = 5000; // 5 second timeout per symbol

/**
 * Fetch historical OHLC data from EODHD with timeout
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
    // Stock format: AAPL.US (normalize BRK.B → BRK-B for EODHD)
    url = `https://eodhd.com/api/eod/${normalizeSymbolForEODHD(symbol.toUpperCase())}.US?from=${formatDate(startDate)}&to=${formatDate(endDate)}&api_token=${apiKey}&fmt=json`;
  }

  console.log(`[Volatility] Fetching data for ${symbol} (${type})`);

  // Add timeout to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

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
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Timeout fetching ${symbol} after ${FETCH_TIMEOUT_MS}ms`);
    }
    throw error;
  }
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
  // Apply security middleware (CORS, security headers, rate limiting, preflight)
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60000 } })) {
    return;
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbols, type = 'stock' } = req.query;
  const noCache = req.query?.nocache === '1';

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

    const sortedSymbols = symbolList.join(',');
    const cacheKey = 'vol_thresholds_' + sortedSymbols + '_' + type;
    const tier = CACHE_TIERS.TECHNICAL;

    if (!noCache) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        setCacheHeaders(res, tier.sMaxAge, tier.staleWhileRevalidate);
        return res.status(200).json(cached);
      }
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

    const responseData = {
      success: true,
      thresholds,
      calculatedAt: new Date().toISOString(),
      type,
      count: Object.keys(thresholds).length
    };
    if (!noCache) {
      setInCache(cacheKey, responseData, tier.memoryTTL);
      setCacheHeaders(res, tier.sMaxAge, tier.staleWhileRevalidate);
    }
    return res.status(200).json(responseData);

  } catch (error) {
    console.error('[Volatility] Handler error:', error.message);
    return res.status(500).json({
      error: 'Failed to calculate thresholds',
      message: error.message
    });
  }
}
