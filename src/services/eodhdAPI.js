// EODHD API Service for MarketClash
// Uses Vercel serverless proxy to avoid CORS issues
// Endpoints: /api/crypto/prices, /api/stocks/prices

const IS_DEV = import.meta.env.DEV;

// Use relative URLs - works in both dev and production on Vercel
const API_BASE = '/api';

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

const fetchWithTimeout = async (url, timeout = 15000) => {
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
// STOCK FUNCTIONS (via Vercel Proxy)
// ============================================

/**
 * Get multiple stock prices via proxy
 * @param {string[]} symbols - Array of stock symbols
 * @returns {Promise<Object>} - { AAPL: {price, change}, MSFT: {price, change}, ... }
 */
export async function getMultipleStockPrices(symbols) {
  const now = Date.now();
  const upperSymbols = symbols.map(s => s.toUpperCase());

  // Check cache
  if (now - priceCache.lastFetch.stocks < priceCache.CACHE_DURATION) {
    const allCached = upperSymbols.every(s => priceCache.stocks[s]);
    if (allCached) {
      console.log('[EODHD] Using cached stock prices');
      const result = {};
      upperSymbols.forEach(s => result[s] = priceCache.stocks[s]);
      return result;
    }
  }

  console.log(`[EODHD] Fetching ${symbols.length} stock prices via proxy...`);

  try {
    const response = await fetchWithTimeout(
      `${API_BASE}/stocks/prices?symbols=${upperSymbols.join(',')}`
    );

    if (!response.ok) {
      throw new Error(`Proxy error: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.prices) {
      // Update cache
      Object.entries(data.prices).forEach(([symbol, priceData]) => {
        priceCache.stocks[symbol] = {
          price: priceData.price,
          change: priceData.change,
          percentChange: priceData.changePercent
        };
      });
      priceCache.lastFetch.stocks = now;

      console.log(`[EODHD] Got ${data.count} stock prices via proxy`);

      // Return in expected format, with fallbacks for missing
      const result = {};
      upperSymbols.forEach(s => {
        if (data.prices[s]) {
          result[s] = {
            price: data.prices[s].price,
            change: data.prices[s].change,
            percentChange: data.prices[s].changePercent
          };
        } else {
          result[s] = {
            price: FALLBACK_STOCK_PRICES[s] || 100,
            change: 0,
            percentChange: 0
          };
        }
      });

      return result;
    }

    throw new Error(data.error || 'Unknown proxy error');

  } catch (error) {
    console.warn('[EODHD] Stock proxy fetch failed:', error.message);

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

// Alias for backward compatibility
export const getAllStockPrices = getMultipleStockPrices;

/**
 * Get single stock price via proxy
 */
export async function getStockPrice(symbol) {
  const prices = await getMultipleStockPrices([symbol]);
  const upper = symbol.toUpperCase();
  return {
    symbol: upper,
    price: prices[upper]?.price || FALLBACK_STOCK_PRICES[upper] || 100,
    change: prices[upper]?.change || 0,
    percentChange: prices[upper]?.percentChange || 0,
    high: prices[upper]?.price || 100,
    low: prices[upper]?.price || 100,
    open: prices[upper]?.price || 100,
    previousClose: prices[upper]?.price || 100,
    week52High: (prices[upper]?.price || 100) * 1.25,
    week52Low: (prices[upper]?.price || 100) * 0.75
  };
}

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
// CRYPTO FUNCTIONS (via Vercel Proxy)
// ============================================

/**
 * Get multiple crypto prices via proxy
 * @param {string[]} symbols - Array of crypto symbols (e.g., ['BTC', 'ETH'])
 * @returns {Promise<Object>} - Keyed by symbol: { BTC: {price, change24h}, ETH: {...} }
 */
export async function getMultipleCryptoPrices(symbols) {
  const now = Date.now();
  const upperSymbols = symbols.map(s => s.toUpperCase());

  console.log(`[EODHD] Requesting crypto prices for:`, upperSymbols);

  // Check cache
  if (now - priceCache.lastFetch.crypto < priceCache.CACHE_DURATION) {
    const allCached = upperSymbols.every(s => priceCache.crypto[s]);
    if (allCached) {
      console.log('[EODHD] Using cached crypto prices');
      const result = {};
      upperSymbols.forEach(s => result[s] = priceCache.crypto[s]);
      return result;
    }
  }

  console.log(`[EODHD] Fetching ${symbols.length} crypto prices via proxy...`);

  try {
    const response = await fetchWithTimeout(
      `${API_BASE}/crypto/prices?symbols=${upperSymbols.join(',')}`
    );

    if (!response.ok) {
      throw new Error(`Proxy error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[EODHD] Proxy response:`, data);

    if (data.success && data.prices) {
      // Update cache
      Object.entries(data.prices).forEach(([symbol, priceData]) => {
        priceCache.crypto[symbol] = {
          price: priceData.price,
          change24h: priceData.changePercent
        };
      });
      priceCache.lastFetch.crypto = now;

      console.log(`[EODHD] Got ${data.count} crypto prices via proxy`);

      // Return in expected format, with fallbacks for missing
      const result = {};
      const missing = [];

      upperSymbols.forEach(s => {
        if (data.prices[s] && data.prices[s].price > 0) {
          result[s] = {
            price: data.prices[s].price,
            change24h: data.prices[s].changePercent || 0
          };
        } else {
          missing.push(s);
          result[s] = {
            price: FALLBACK_CRYPTO_PRICES[s] || 1,
            change24h: 0,
            isFallback: true
          };
        }
      });

      if (missing.length > 0) {
        console.warn(`[EODHD] Using fallbacks for:`, missing);
      }

      return result;
    }

    throw new Error(data.error || 'Unknown proxy error');

  } catch (error) {
    console.warn('[EODHD] Crypto proxy fetch failed:', error.message);

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

// Alias for backward compatibility
export const getAllCryptoPrices = getMultipleCryptoPrices;

/**
 * Get single crypto price via proxy
 */
export async function getCryptoPrice(symbol) {
  const prices = await getMultipleCryptoPrices([symbol]);
  const upper = symbol.toUpperCase();
  return {
    id: upper.toLowerCase(),
    symbol: upper,
    price: prices[upper]?.price || FALLBACK_CRYPTO_PRICES[upper] || 1,
    change24h: prices[upper]?.change24h || 0,
    marketCap: 0,
    volume24h: 0
  };
}

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
 */
export function symbolToCoinGeckoId(symbol) {
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
 * Test API connection via proxy
 */
export async function testConnection() {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/stocks/prices?symbols=AAPL`);

    if (response.ok) {
      const data = await response.json();
      console.log('[EODHD] Proxy connection test successful:', data);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[EODHD] Proxy connection test failed:', error);
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
