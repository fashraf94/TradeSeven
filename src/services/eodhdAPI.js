// EODHD API Service for MarketClash
// All-In-One provider for stocks and crypto
// Replaces Finnhub (stocks) and CoinGecko (crypto)
// Benefits: 100k calls/day, 1k/min, no CORS issues, 1-min delay crypto

const EODHD_API_KEY = import.meta.env.VITE_EODHD_API_KEY;
const EODHD_BASE = 'https://eodhd.com/api';
const IS_DEV = import.meta.env.DEV;

// ============================================
// LOGGING UTILITIES
// ============================================

const logDebug = (message, ...args) => {
  if (IS_DEV) {
    console.log(`[EODHD] ${message}`, ...args);
  }
};

const logWarn = (message, ...args) => {
  console.warn(`[EODHD] ${message}`, ...args);
};

// ============================================
// PRICE CACHE (reduces API calls)
// ============================================

const priceCache = {
  stocks: {},
  crypto: {},
  lastFetch: {
    stocks: 0,
    crypto: 0
  },
  CACHE_DURATION: 60000, // 1 minute cache
};

// ============================================
// FETCH WITH TIMEOUT
// ============================================

const fetchWithTimeout = async (url, timeout = 10000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
};

// ============================================
// STOCK FUNCTIONS
// ============================================

/**
 * Get real-time stock price
 * @param {string} symbol - Stock symbol (e.g., 'AAPL')
 * @returns {Promise<{symbol, price, change, percentChange}>}
 */
export async function getStockPrice(symbol) {
  try {
    const url = `${EODHD_BASE}/real-time/${symbol}.US?api_token=${EODHD_API_KEY}&fmt=json`;

    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`EODHD error: ${response.status}`);
    }

    const data = await response.json();

    return {
      symbol: symbol,
      price: data.close || data.previousClose || 0,
      change: data.change || 0,
      percentChange: data.change_p || 0,
      high: data.high || data.close,
      low: data.low || data.close,
      open: data.open || data.close,
      previousClose: data.previousClose || data.close,
      volume: data.volume,
      timestamp: data.timestamp,
      week52High: (data.close || 100) * 1.25,
      week52Low: (data.close || 100) * 0.75
    };

  } catch (error) {
    logWarn(`Stock price error for ${symbol}:`, error.message);
    const fallback = FALLBACK_STOCK_PRICES[symbol] || 100;
    return {
      symbol: symbol,
      price: fallback,
      change: 0,
      percentChange: 0,
      high: fallback,
      low: fallback,
      open: fallback,
      previousClose: fallback,
      week52High: fallback * 1.25,
      week52Low: fallback * 0.75
    };
  }
}

/**
 * Get multiple stock prices in batch
 * @param {string[]} symbols - Array of stock symbols
 * @returns {Promise<Object>} - { AAPL: {price, change}, MSFT: {price, change}, ... }
 */
export async function getMultipleStockPrices(symbols) {
  const now = Date.now();

  // Check cache
  const allCached = symbols.every(s =>
    priceCache.stocks[s.toUpperCase()] &&
    (now - priceCache.lastFetch.stocks < priceCache.CACHE_DURATION)
  );

  if (allCached) {
    logDebug('Using cached stock prices');
    const result = {};
    symbols.forEach(s => result[s.toUpperCase()] = priceCache.stocks[s.toUpperCase()]);
    return result;
  }

  logDebug(`Fetching ${symbols.length} stock prices...`);

  // EODHD supports batch requests with comma-separated symbols
  const upperSymbols = symbols.map(s => s.toUpperCase());
  const symbolList = upperSymbols.map(s => `${s}.US`).join(',');

  try {
    const url = `${EODHD_BASE}/real-time/${symbolList}?api_token=${EODHD_API_KEY}&fmt=json`;

    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`EODHD error: ${response.status}`);
    }

    const data = await response.json();

    // Handle both single and multiple responses
    const dataArray = Array.isArray(data) ? data : [data];

    const result = {};
    dataArray.forEach(item => {
      const symbol = (item.code?.replace('.US', '') || item.symbol || '').toUpperCase();
      if (symbol) {
        result[symbol] = {
          price: item.close || item.previousClose || 0,
          change: item.change || 0,
          percentChange: item.change_p || 0
        };
        priceCache.stocks[symbol] = result[symbol];
      }
    });

    // Fill in any missing symbols with fallbacks
    upperSymbols.forEach(s => {
      if (!result[s]) {
        result[s] = {
          price: FALLBACK_STOCK_PRICES[s] || 100,
          change: 0,
          percentChange: 0
        };
      }
    });

    priceCache.lastFetch.stocks = now;
    logDebug(`Got ${Object.keys(result).length} stock prices`);

    return result;

  } catch (error) {
    logWarn('Batch stock fetch error:', error.message);

    // Return fallback prices
    const result = {};
    upperSymbols.forEach(s => {
      result[s] = {
        price: FALLBACK_STOCK_PRICES[s] || 100,
        change: 0,
        percentChange: 0
      };
    });
    return result;
  }
}

// Alias for backward compatibility with stockAPI
export const getAllStockPrices = getMultipleStockPrices;

/**
 * Get list of popular stocks with prices
 */
export async function getPopularStocks() {
  const prices = await getMultipleStockPrices(POPULAR_STOCK_SYMBOLS);

  return POPULAR_STOCK_SYMBOLS.map(symbol => ({
    symbol,
    name: STOCK_NAMES[symbol] || symbol,
    price: prices[symbol]?.price || FALLBACK_STOCK_PRICES[symbol] || 100,
    change: prices[symbol]?.change || 0,
    percentChange: prices[symbol]?.percentChange || 0,
    priceChange7d: (Math.random() - 0.5) * 10,
    priceChange30d: (Math.random() - 0.5) * 30,
    volatility: 'medium',
    week52High: (prices[symbol]?.price || 100) * 1.25,
    week52Low: (prices[symbol]?.price || 100) * 0.75,
    marketCap: 0,
    volume24h: 0,
    communityData: generateCommunityData(symbol, prices[symbol]?.price || 100, prices[symbol]?.percentChange || 0)
  }));
}

// ============================================
// CRYPTO FUNCTIONS
// ============================================

/**
 * Get crypto price
 * @param {string} symbol - Crypto symbol (e.g., 'BTC')
 * @returns {Promise<{symbol, price, change24h}>}
 */
export async function getCryptoPrice(symbol) {
  const upperSymbol = symbol.toUpperCase();

  try {
    // EODHD uses format: BTC-USD.CC
    const url = `${EODHD_BASE}/real-time/${upperSymbol}-USD.CC?api_token=${EODHD_API_KEY}&fmt=json`;

    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`EODHD error: ${response.status}`);
    }

    const data = await response.json();

    return {
      id: upperSymbol.toLowerCase(),
      symbol: upperSymbol,
      price: data.close || data.previousClose || 0,
      change24h: data.change_p || 0,
      high: data.high,
      low: data.low,
      volume: data.volume,
      marketCap: 0,
      volume24h: data.volume || 0
    };

  } catch (error) {
    logWarn(`Crypto price error for ${symbol}:`, error.message);
    const fallback = FALLBACK_CRYPTO_PRICES[upperSymbol] || 1;
    return {
      id: upperSymbol.toLowerCase(),
      symbol: upperSymbol,
      price: fallback,
      change24h: 0,
      marketCap: 0,
      volume24h: 0
    };
  }
}

/**
 * Get multiple crypto prices
 * @param {string[]} symbols - Array of crypto symbols (e.g., ['BTC', 'ETH'])
 * @returns {Promise<Object>} - Keyed by symbol: { BTC: {price, change24h}, ETH: {...} }
 */
export async function getMultipleCryptoPrices(symbols) {
  const now = Date.now();
  const upperSymbols = symbols.map(s => s.toUpperCase());

  // Enhanced debug logging
  console.log(`[EODHD] Requesting crypto prices for:`, upperSymbols);

  // Check cache
  const allCached = upperSymbols.every(s =>
    priceCache.crypto[s] &&
    (now - priceCache.lastFetch.crypto < priceCache.CACHE_DURATION)
  );

  if (allCached) {
    logDebug('Using cached crypto prices');
    const result = {};
    upperSymbols.forEach(s => result[s] = priceCache.crypto[s]);
    console.log(`[EODHD] Returning ${Object.keys(result).length} cached crypto prices`);
    return result;
  }

  logDebug(`Fetching ${symbols.length} crypto prices...`);

  // EODHD batch format for crypto
  const symbolList = upperSymbols.map(s => `${s}-USD.CC`).join(',');

  try {
    const url = `${EODHD_BASE}/real-time/${symbolList}?api_token=${EODHD_API_KEY}&fmt=json`;

    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`EODHD error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[EODHD] Raw API response:`, data);

    // Handle both single and multiple responses
    const dataArray = Array.isArray(data) ? data : [data];

    const result = {};
    const successfulSymbols = [];
    const zeroOrMissingSymbols = [];

    dataArray.forEach(item => {
      // Extract symbol from code (e.g., "BTC-USD.CC" -> "BTC")
      const symbol = (item.code?.split('-')[0] || item.symbol || '').toUpperCase();
      if (symbol) {
        const price = item.close || item.previousClose || 0;
        result[symbol] = {
          price: price,
          change24h: item.change_p || 0
        };
        priceCache.crypto[symbol] = result[symbol];

        if (price > 0) {
          successfulSymbols.push(symbol);
        } else {
          zeroOrMissingSymbols.push(symbol);
        }
      }
    });

    // Find which symbols we didn't get or got zero price for
    const missingSymbols = upperSymbols.filter(s => !result[s] || result[s].price === 0);

    if (missingSymbols.length > 0) {
      console.warn(`[EODHD] Missing/zero prices for:`, missingSymbols);

      // Try fetching missing symbols individually with alternate formats
      for (const symbol of missingSymbols) {
        const altPrice = await tryAlternateFormats(symbol);
        if (altPrice && altPrice.price > 0) {
          result[symbol] = altPrice;
          priceCache.crypto[symbol] = altPrice;
          console.log(`[EODHD] Got ${symbol} via alternate format: $${altPrice.price}`);
        } else {
          // Use fallback price
          const fallbackPrice = FALLBACK_CRYPTO_PRICES[symbol] || 1;
          result[symbol] = {
            price: fallbackPrice,
            change24h: 0,
            isFallback: true
          };
          console.warn(`[EODHD] Using fallback for ${symbol}: $${fallbackPrice}`);
        }
      }
    }

    // Fill in any remaining missing symbols with fallbacks
    upperSymbols.forEach(s => {
      if (!result[s]) {
        result[s] = {
          price: FALLBACK_CRYPTO_PRICES[s] || 1,
          change24h: 0,
          isFallback: true
        };
      }
    });

    priceCache.lastFetch.crypto = now;

    const received = Object.keys(result).filter(s => result[s].price > 0 && !result[s].isFallback);
    console.log(`[EODHD] Got prices for ${received.length}/${upperSymbols.length} cryptos (live), rest using fallbacks`);

    return result;

  } catch (error) {
    logWarn('Batch crypto fetch error:', error.message);
    console.error(`[EODHD] Batch fetch failed:`, error);

    // Return fallback prices
    const result = {};
    upperSymbols.forEach(s => {
      result[s] = {
        price: FALLBACK_CRYPTO_PRICES[s] || 1,
        change24h: 0,
        isFallback: true
      };
    });
    console.warn(`[EODHD] All ${upperSymbols.length} prices using fallbacks due to error`);
    return result;
  }
}

/**
 * Try alternate EODHD symbol formats for crypto
 * Some cryptos may use different ticker formats
 */
async function tryAlternateFormats(symbol) {
  const upperSymbol = symbol.toUpperCase();

  // EODHD alternate formats to try
  const formats = [
    `${upperSymbol}-USD.CC`,      // Standard: BTC-USD.CC
    `${upperSymbol}USD.CC`,       // No dash: BTCUSD.CC
    `${upperSymbol}-USDT.CC`,     // USDT pair: BTC-USDT.CC
    `${upperSymbol}.CC`,          // Just symbol: BTC.CC
  ];

  for (const format of formats) {
    try {
      const url = `${EODHD_BASE}/real-time/${format}?api_token=${EODHD_API_KEY}&fmt=json`;
      const response = await fetchWithTimeout(url, 5000);

      if (response.ok) {
        const data = await response.json();
        const price = data.close || data.previousClose || 0;

        if (price > 0) {
          console.log(`[EODHD] Found ${symbol} using format: ${format} = $${price}`);
          return {
            price: price,
            change24h: data.change_p || 0
          };
        }
      }
    } catch (e) {
      // Continue to next format
    }
  }

  return null;
}

// Alias for backward compatibility - returns data keyed by symbol
export const getAllCryptoPrices = getMultipleCryptoPrices;

/**
 * Get list of popular crypto with prices
 */
export async function getPopularCrypto() {
  const prices = await getMultipleCryptoPrices(POPULAR_CRYPTO_SYMBOLS);

  return POPULAR_CRYPTO_SYMBOLS.map(symbol => ({
    symbol,
    name: CRYPTO_NAMES[symbol] || symbol,
    price: prices[symbol]?.price || FALLBACK_CRYPTO_PRICES[symbol] || 1,
    change24h: prices[symbol]?.change24h || 0,
    percentChange: prices[symbol]?.change24h || 0,
    priceChange7d: (Math.random() - 0.5) * 15,
    priceChange30d: (Math.random() - 0.5) * 40,
    volatility: 'high',
    week52High: (prices[symbol]?.price || 100) * 1.5,
    week52Low: (prices[symbol]?.price || 100) * 0.5,
    marketCap: 0,
    volume24h: 0,
    communityData: generateCommunityData(symbol, prices[symbol]?.price || 100, prices[symbol]?.change24h || 0)
  }));
}

/**
 * Get extended crypto data (for compatibility with old API)
 */
export async function getCryptoExtendedData(cryptoId) {
  // EODHD doesn't have 7d/30d change, so we return estimates
  return {
    priceChange7d: (Math.random() - 0.5) * 15,
    priceChange30d: (Math.random() - 0.5) * 40,
    week52High: 0,
    week52Low: 0
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate mock community data for social proof
 */
function generateCommunityData(symbol, price, percentChange) {
  const basePicks = Math.floor(500 + Math.random() * 3500);
  const volatilityMultiplier = Math.abs(percentChange) > 3 ? 1.5 : 1.0;
  const adjustedPicks = Math.floor(basePicks * volatilityMultiplier);

  return {
    picksThisWeek: adjustedPicks,
    trendPercentage: Math.floor(-50 + Math.random() * 250),
    isHot: adjustedPicks > 2500,
    isTrending: adjustedPicks > 2000,
    championPick: Math.random() > 0.4,
    championPercentage: Math.floor(40 + Math.random() * 45),
    rankDistribution: {
      beginner: Math.floor(adjustedPicks * 0.25),
      veteran: Math.floor(adjustedPicks * 0.35),
      expert: Math.floor(adjustedPicks * 0.25),
      master: Math.floor(adjustedPicks * 0.15)
    },
    winRate: Math.floor(50 + Math.random() * 20),
    totalBattles: Math.floor(adjustedPicks * 0.6),
    wins: Math.floor(adjustedPicks * 0.35),
    losses: Math.floor(adjustedPicks * 0.25),
    avgReturnWhenWinning: +(3 + Math.random() * 12).toFixed(1),
    popularityRank: 0,
    recentActivity: null
  };
}

/**
 * Symbol conversion helper (for backward compatibility)
 * With EODHD we use symbols directly, no need for CoinGecko ID conversion
 */
export function symbolToCoinGeckoId(symbol) {
  // EODHD uses symbols directly, but we keep this for compatibility
  return symbol.toUpperCase();
}

export function coinGeckoIdToSymbol(id) {
  return id.toUpperCase();
}

/**
 * Clear all cached prices
 */
export function clearCache() {
  priceCache.stocks = {};
  priceCache.crypto = {};
  priceCache.lastFetch = { stocks: 0, crypto: 0 };
  logDebug('Cache cleared');
}

// Alias for backward compatibility
export const clearBatchPriceCache = clearCache;

/**
 * Test API connection
 */
export async function testConnection() {
  try {
    const response = await fetchWithTimeout(
      `${EODHD_BASE}/real-time/AAPL.US?api_token=${EODHD_API_KEY}&fmt=json`
    );

    if (response.ok) {
      const data = await response.json();
      console.log('[EODHD] Connection test successful:', {
        symbol: 'AAPL',
        price: data.close
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error('[EODHD] Connection test failed:', error);
    return false;
  }
}

// ============================================
// DATA CONSTANTS
// ============================================

const POPULAR_STOCK_SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META',
  'BRK-B', 'V', 'JPM', 'WMT', 'MA', 'PG', 'UNH', 'HD'
];

const POPULAR_CRYPTO_SYMBOLS = [
  'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX',
  'DOT', 'MATIC', 'LINK', 'UNI', 'LTC', 'XLM', 'ATOM', 'NEAR', 'ALGO', 'XMR'
];

// Stock name mapping
const STOCK_NAMES = {
  'AAPL': 'Apple',
  'MSFT': 'Microsoft',
  'GOOGL': 'Google',
  'AMZN': 'Amazon',
  'NVDA': 'NVIDIA',
  'TSLA': 'Tesla',
  'META': 'Meta',
  'BRK-B': 'Berkshire Hathaway',
  'V': 'Visa',
  'JPM': 'JPMorgan Chase',
  'WMT': 'Walmart',
  'MA': 'Mastercard',
  'PG': 'Procter & Gamble',
  'UNH': 'UnitedHealth',
  'HD': 'Home Depot',
  'DIS': 'Disney',
  'PYPL': 'PayPal',
  'NFLX': 'Netflix',
  'ADBE': 'Adobe',
  'CRM': 'Salesforce',
  'INTC': 'Intel',
  'AMD': 'AMD',
  'COST': 'Costco',
  'PEP': 'PepsiCo',
  'KO': 'Coca-Cola',
  'MRK': 'Merck',
  'PFE': 'Pfizer',
  'ABBV': 'AbbVie',
  'TMO': 'Thermo Fisher',
  'NKE': 'Nike'
};

// Crypto name mapping
const CRYPTO_NAMES = {
  'BTC': 'Bitcoin',
  'ETH': 'Ethereum',
  'BNB': 'BNB',
  'SOL': 'Solana',
  'XRP': 'XRP',
  'ADA': 'Cardano',
  'DOGE': 'Dogecoin',
  'AVAX': 'Avalanche',
  'DOT': 'Polkadot',
  'MATIC': 'Polygon',
  'LINK': 'Chainlink',
  'UNI': 'Uniswap',
  'LTC': 'Litecoin',
  'XLM': 'Stellar',
  'ATOM': 'Cosmos',
  'NEAR': 'NEAR Protocol',
  'ALGO': 'Algorand',
  'XMR': 'Monero',
  'SHIB': 'Shiba Inu',
  'TRX': 'Tron',
  'ETC': 'Ethereum Classic',
  'FIL': 'Filecoin',
  'VET': 'VeChain',
  'HBAR': 'Hedera',
  'SAND': 'The Sandbox',
  'MANA': 'Decentraland',
  'AAVE': 'Aave',
  'MKR': 'Maker',
  'GRT': 'The Graph',
  'FTM': 'Fantom',
  'THETA': 'Theta',
  'HNT': 'Helium',
  'RNDR': 'Render',
  'CRO': 'Cronos',
  'PEPE': 'Pepe',
  'BONK': 'Bonk',
  'ARB': 'Arbitrum',
  'OP': 'Optimism',
  'SUI': 'Sui',
  'APT': 'Aptos',
  'INJ': 'Injective',
  'SEI': 'Sei',
  'TON': 'Toncoin',
  'USDT': 'Tether',
  'USDC': 'USD Coin',
  'DAI': 'Dai'
};

// Fallback stock prices (Dec 2024)
const FALLBACK_STOCK_PRICES = {
  'AAPL': 185,
  'MSFT': 378,
  'GOOGL': 175,
  'AMZN': 185,
  'NVDA': 135,
  'TSLA': 250,
  'META': 560,
  'BRK-B': 410,
  'V': 280,
  'JPM': 200,
  'WMT': 165,
  'MA': 470,
  'PG': 165,
  'UNH': 550,
  'HD': 385,
  'DIS': 115,
  'PYPL': 85,
  'NFLX': 700,
  'ADBE': 520,
  'CRM': 320,
  'INTC': 22,
  'AMD': 145,
  'COST': 920,
  'PEP': 170,
  'KO': 62,
  'MRK': 105,
  'PFE': 28,
  'ABBV': 175,
  'TMO': 540,
  'NKE': 78
};

// Fallback crypto prices (Dec 2024)
const FALLBACK_CRYPTO_PRICES = {
  'BTC': 97000,
  'ETH': 3400,
  'BNB': 650,
  'SOL': 190,
  'XRP': 2.20,
  'ADA': 1.05,
  'DOGE': 0.38,
  'AVAX': 42,
  'DOT': 7.50,
  'MATIC': 0.55,
  'LINK': 24,
  'UNI': 14,
  'LTC': 115,
  'XLM': 0.45,
  'ATOM': 10,
  'NEAR': 5.50,
  'ALGO': 0.40,
  'XMR': 190,
  'SHIB': 0.000024,
  'TRX': 0.27,
  'ETC': 28,
  'FIL': 5.20,
  'VET': 0.052,
  'HBAR': 0.28,
  'SAND': 0.58,
  'MANA': 0.55,
  'AAVE': 180,
  'MKR': 1800,
  'GRT': 0.25,
  'FTM': 0.85,
  'THETA': 2.20,
  'HNT': 6.00,
  'RNDR': 9.50,
  'CRO': 0.14,
  'PEPE': 0.000021,
  'BONK': 0.000033,
  'ARB': 0.95,
  'OP': 2.20,
  'SUI': 4.20,
  'APT': 12,
  'INJ': 25,
  'SEI': 0.55,
  'TON': 5.80,
  'USDT': 1.00,
  'USDC': 1.00,
  'DAI': 1.00,
  'WIF': 2.50,
  'FLOKI': 0.00018,
  'NOT': 0.008,
  'TIA': 8,
  'KAS': 0.15,
  'STX': 1.80,
  'LDO': 2.20,
  'RUNE': 5.50,
  'JUP': 1.10,
  'IMX': 1.80,
  'GALA': 0.045,
  'ENJ': 0.28,
  'AR': 18,
  'QNT': 120,
  'FET': 1.60,
  'TAO': 480,
  'OCEAN': 0.85,
  'OKB': 48,
  'LEO': 9.20,
  'KCS': 12,
  'BCH': 480,
  'ICP': 11,
  'EOS': 0.85,
  'FLOW': 0.95,
  'EGLD': 45,
  'XTZ': 1.10,
  'ONDO': 1.35,
  'PYTH': 0.42
};

// Export constants for backward compatibility
export const POPULAR_STOCKS = POPULAR_STOCK_SYMBOLS.map(symbol => ({
  symbol,
  name: STOCK_NAMES[symbol] || symbol
}));

export const POPULAR_CRYPTO = POPULAR_CRYPTO_SYMBOLS.map(symbol => ({
  id: symbol.toLowerCase(),
  symbol,
  name: CRYPTO_NAMES[symbol] || symbol
}));

export { FALLBACK_CRYPTO_PRICES, FALLBACK_STOCK_PRICES };

// Empty symbol mapping (EODHD uses symbols directly)
export const SYMBOL_TO_COINGECKO_ID = {};
export const COINGECKO_ID_TO_SYMBOL = {};

// ============================================
// BACKWARD COMPATIBLE EXPORTS
// ============================================

// These match the old stockAPI.js interface for easy migration
export const stockAPI = {
  getStockPrice,
  getCryptoPrice,
  getPopularStocks,
  getPopularCrypto,
  getCryptoExtendedData,
  getMultipleStockPrices,
  getMultipleCryptoPrices,
  // Aliases for old function names
  getAllStockPrices,
  getAllCryptoPrices,
  clearBatchPriceCache,
  clearCache,
  testConnection,
  // Symbol utilities (simplified for EODHD)
  symbolToCoinGeckoId,
  coinGeckoIdToSymbol,
  // Constants
  POPULAR_STOCKS,
  POPULAR_CRYPTO,
  FALLBACK_CRYPTO_PRICES,
  FALLBACK_STOCK_PRICES,
  SYMBOL_TO_COINGECKO_ID,
  COINGECKO_ID_TO_SYMBOL
};

export default stockAPI;
