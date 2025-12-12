// TradeSeven Stock & Crypto API Service - ROBUST ERROR HANDLING VERSION
// Handles real-time market data with timeout, retry, and graceful fallbacks

const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;
const IS_DEV = import.meta.env.DEV;

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  FETCH_TIMEOUT: 10000,        // 10 second timeout
  MAX_RETRIES: 2,              // Retry twice on failure
  RETRY_DELAY_BASE: 1000,      // Base delay for exponential backoff
  RATE_LIMIT_WINDOW: 60000,    // 1 minute window for rate limiting
  MAX_REQUESTS_PER_WINDOW: 30, // Max requests per minute
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
};

// Multiple CORS proxies for fallback
const CORS_PROXIES = [
  '', // Try direct first (may work in some environments)
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
];

// ============================================
// LOGGING UTILITIES
// ============================================

/**
 * Log only in development mode
 */
const logDebug = (message, ...args) => {
  if (IS_DEV) {
    console.log(`[StockAPI] ${message}`, ...args);
  }
};

/**
 * Log warnings (expected failures like network issues)
 */
const logWarn = (message, error) => {
  if (IS_DEV) {
    console.warn(`[StockAPI] ${message}:`, error?.message || error);
  }
};

/**
 * Log errors (unexpected failures)
 */
const logError = (message, error) => {
  // Always log actual errors, but keep it clean
  console.error(`[StockAPI] ${message}:`, error?.message || 'Unknown error');
};

// ============================================
// RATE LIMITING
// ============================================

const rateLimitState = {
  requests: [],
  isLimited: false,
};

/**
 * Check if we're rate limited
 */
const checkRateLimit = () => {
  const now = Date.now();
  // Clean old requests
  rateLimitState.requests = rateLimitState.requests.filter(
    (time) => now - time < CONFIG.RATE_LIMIT_WINDOW
  );

  if (rateLimitState.requests.length >= CONFIG.MAX_REQUESTS_PER_WINDOW) {
    if (!rateLimitState.isLimited) {
      logWarn('Rate limit reached, using cached/fallback data');
      rateLimitState.isLimited = true;
    }
    return true;
  }

  rateLimitState.isLimited = false;
  rateLimitState.requests.push(now);
  return false;
};

// ============================================
// FETCH UTILITIES
// ============================================

/**
 * Fetch with timeout
 */
const fetchWithTimeout = async (url, options = {}, timeout = CONFIG.FETCH_TIMEOUT) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
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

/**
 * Fetch with retry and exponential backoff
 */
const fetchWithRetry = async (url, options = {}, maxRetries = CONFIG.MAX_RETRIES) => {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options);

      if (response.ok) {
        return response;
      }

      // Don't retry on client errors (4xx) except 429 (rate limit)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`Client error: ${response.status}`);
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s...
        const delay = CONFIG.RETRY_DELAY_BASE * Math.pow(2, attempt);
        logDebug(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
};

/**
 * Fetch with CORS proxy fallback for CoinGecko
 */
const fetchWithCorsProxy = async (url) => {
  let lastError;

  for (const proxy of CORS_PROXIES) {
    try {
      const proxyUrl = proxy ? proxy + encodeURIComponent(url) : url;
      const response = await fetchWithTimeout(proxyUrl, {}, CONFIG.FETCH_TIMEOUT);

      if (response.ok) {
        return response;
      }
    } catch (error) {
      lastError = error;
      // Continue to next proxy
    }
  }

  throw lastError || new Error('All CORS proxies failed');
};

// ============================================
// DATA CONSTANTS
// ============================================

// Popular stocks (15 major companies)
const POPULAR_STOCKS = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'GOOGL', name: 'Google' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'META', name: 'Meta' },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway' },
  { symbol: 'V', name: 'Visa' },
  { symbol: 'JPM', name: 'JPMorgan Chase' },
  { symbol: 'WMT', name: 'Walmart' },
  { symbol: 'MA', name: 'Mastercard' },
  { symbol: 'PG', name: 'Procter & Gamble' },
  { symbol: 'UNH', name: 'UnitedHealth' },
  { symbol: 'HD', name: 'Home Depot' }
];

// Popular cryptocurrencies (18 major coins)
const POPULAR_CRYPTO = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
  { id: 'matic-network', symbol: 'MATIC', name: 'Polygon' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink' },
  { id: 'uniswap', symbol: 'UNI', name: 'Uniswap' },
  { id: 'litecoin', symbol: 'LTC', name: 'Litecoin' },
  { id: 'stellar', symbol: 'XLM', name: 'Stellar' },
  { id: 'monero', symbol: 'XMR', name: 'Monero' },
  { id: 'algorand', symbol: 'ALGO', name: 'Algorand' },
  { id: 'cosmos', symbol: 'ATOM', name: 'Cosmos' },
  { id: 'near', symbol: 'NEAR', name: 'NEAR Protocol' }
];

// Fallback crypto prices (updated Dec 2024)
const FALLBACK_CRYPTO_PRICES = {
  'bitcoin': 95000,
  'ethereum': 3600,
  'binancecoin': 620,
  'solana': 235,
  'ripple': 2.15,
  'cardano': 1.05,
  'dogecoin': 0.40,
  'avalanche-2': 42,
  'polkadot': 8.5,
  'matic-network': 1.10,
  'chainlink': 19.5,
  'uniswap': 12.5,
  'litecoin': 95,
  'stellar': 0.38,
  'monero': 190,
  'algorand': 0.42,
  'cosmos': 11.5,
  'near': 7.8
};

// Fallback stock prices
const FALLBACK_STOCK_PRICES = {
  'AAPL': 185,
  'MSFT': 378,
  'GOOGL': 175,
  'AMZN': 185,
  'NVDA': 135,
  'TSLA': 250,
  'META': 560,
  'BRK.B': 410,
  'V': 280,
  'JPM': 200,
  'WMT': 165,
  'MA': 470,
  'PG': 165,
  'UNH': 550,
  'HD': 385
};

// ============================================
// CACHING
// ============================================

const cache = new Map();

/**
 * Get from cache if valid
 */
const getFromCache = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CONFIG.CACHE_DURATION) {
    return cached.data;
  }
  return null;
};

/**
 * Set cache
 */
const setCache = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() });
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Calculate volatility from price array
 */
function calculateVolatility(prices) {
  if (!prices || prices.length < 2) return 'low';

  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    const returnVal = (prices[i] - prices[i-1]) / prices[i-1];
    returns.push(returnVal);
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance) * 100;

  if (stdDev < 2) return 'low';
  if (stdDev < 5) return 'medium';
  return 'high';
}

/**
 * Generate mock community data for social proof
 */
function generateCommunityData(symbol, price, percentChange, volatility) {
  const volatilityMultiplier = volatility === 'high' ? 1.3 : volatility === 'medium' ? 1.1 : 0.9;
  const priceMultiplier = price > 1000 ? 0.7 : price > 100 ? 1.0 : 1.2;
  const momentumMultiplier = Math.abs(percentChange) > 3 ? 1.5 : 1.0;

  const basePicks = Math.floor(500 + Math.random() * 3500);
  const adjustedPicks = Math.floor(basePicks * volatilityMultiplier * priceMultiplier * momentumMultiplier);

  const isHot = adjustedPicks > 2500;
  const trendPercentage = Math.floor(-50 + Math.random() * 250);
  const championPercentage = Math.floor(40 + Math.random() * 45);
  const isChampionPick = championPercentage > 60;

  const masterPicks = Math.floor(adjustedPicks * 0.15);
  const expertPicks = Math.floor(adjustedPicks * 0.25);
  const veteranPicks = Math.floor(adjustedPicks * 0.35);
  const beginnerPicks = adjustedPicks - masterPicks - expertPicks - veteranPicks;

  const winRate = Math.floor(50 + Math.random() * 20);
  const totalBattles = Math.floor(adjustedPicks * 0.6);
  const wins = Math.floor(totalBattles * (winRate / 100));
  const losses = totalBattles - wins;
  const avgReturnWhenWinning = +(3 + Math.random() * 12).toFixed(1);

  return {
    picksThisWeek: adjustedPicks,
    trendPercentage,
    isHot,
    isTrending: trendPercentage > 50,
    championPick: isChampionPick,
    championPercentage,
    rankDistribution: {
      beginner: beginnerPicks,
      veteran: veteranPicks,
      expert: expertPicks,
      master: masterPicks
    },
    winRate,
    totalBattles,
    wins,
    losses,
    avgReturnWhenWinning,
    popularityRank: 0,
    recentActivity: trendPercentage > 100 ? `+${trendPercentage}% today` : null
  };
}

/**
 * Generate historical prices that match returns direction
 */
function getStockHistoricalPrices(symbol, currentPrice, priceChange7d, priceChange30d) {
  const cacheKey = `stock_hist_30d_${symbol}_${priceChange30d.toFixed(2)}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const price30dAgo = currentPrice / (1 + priceChange30d / 100);
    const price7dAgo = currentPrice / (1 + priceChange7d / 100);

    const prices = [];
    const totalDays = 30;

    for (let day = 0; day < totalDays; day++) {
      let basePrice;

      if (day <= 23) {
        const progress = day / 23;
        basePrice = price30dAgo + (price7dAgo - price30dAgo) * progress;
      } else {
        const progress = (day - 23) / 6;
        basePrice = price7dAgo + (currentPrice - price7dAgo) * progress;
      }

      const variation = (Math.random() - 0.5) * 0.01;
      prices.push(basePrice * (1 + variation));
    }

    prices[0] = price30dAgo;
    prices[prices.length - 1] = currentPrice;

    setCache(cacheKey, prices);
    return prices;

  } catch (error) {
    logWarn(`Error generating historical prices for ${symbol}`, error);
    return Array(30).fill(currentPrice || 100);
  }
}

// ============================================
// STOCK API FUNCTIONS
// ============================================

/**
 * Fetch stock price with robust error handling
 */
export async function getStockPrice(symbol) {
  // Check cache first
  const cacheKey = `stock_price_${symbol}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  // Check rate limit
  if (checkRateLimit()) {
    return createFallbackStockData(symbol);
  }

  try {
    const response = await fetchWithRetry(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
    );

    const data = await response.json();

    // Validate response
    if (!data || data.c === undefined || data.c === 0) {
      logWarn(`Invalid response for ${symbol}`, 'No price data');
      return createFallbackStockData(symbol);
    }

    const price = data.c;
    const week52High = price * (1 + (Math.random() * 0.25 + 0.05));
    const week52Low = price * (1 - (Math.random() * 0.20 + 0.10));

    const result = {
      symbol,
      price,
      change: data.d || 0,
      percentChange: data.dp || 0,
      high: data.h || price,
      low: data.l || price,
      open: data.o || price,
      previousClose: data.pc || price,
      week52High,
      week52Low
    };

    setCache(cacheKey, result);
    return result;

  } catch (error) {
    logWarn(`Failed to fetch ${symbol}`, error);
    return createFallbackStockData(symbol);
  }
}

/**
 * Create fallback stock data
 */
function createFallbackStockData(symbol) {
  const price = FALLBACK_STOCK_PRICES[symbol] || 100;
  return {
    symbol,
    price,
    change: 0,
    percentChange: 0,
    high: price,
    low: price,
    open: price,
    previousClose: price,
    week52High: price * 1.25,
    week52Low: price * 0.80
  };
}

// ============================================
// CRYPTO API FUNCTIONS
// ============================================

/**
 * Fetch crypto price with CORS proxy fallback
 */
export async function getCryptoPrice(cryptoId) {
  // Check cache first
  const cacheKey = `crypto_price_${cryptoId}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  // Check rate limit
  if (checkRateLimit()) {
    return createFallbackCryptoData(cryptoId);
  }

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;

    const response = await fetchWithCorsProxy(url);
    const data = await response.json();

    if (!data[cryptoId]) {
      logWarn(`No data returned for ${cryptoId}`, 'Empty response');
      return createFallbackCryptoData(cryptoId);
    }

    const result = {
      id: cryptoId,
      price: data[cryptoId].usd || 0,
      change24h: data[cryptoId].usd_24h_change || 0,
      marketCap: data[cryptoId].usd_market_cap || 0,
      volume24h: data[cryptoId].usd_24h_vol || 0
    };

    setCache(cacheKey, result);
    return result;

  } catch (error) {
    logWarn(`Failed to fetch ${cryptoId}`, error);
    return createFallbackCryptoData(cryptoId);
  }
}

/**
 * Create fallback crypto data
 */
function createFallbackCryptoData(cryptoId) {
  const price = FALLBACK_CRYPTO_PRICES[cryptoId] || 100;
  return {
    id: cryptoId,
    price,
    change24h: 0,
    marketCap: 0,
    volume24h: 0
  };
}

/**
 * Fetch extended crypto data with 7d/30d performance
 */
export async function getCryptoExtendedData(cryptoId) {
  const cacheKey = `crypto_extended_${cryptoId}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  if (checkRateLimit()) {
    return { priceChange7d: 0, priceChange30d: 0, week52High: 0, week52Low: 0 };
  }

  try {
    const url = `https://api.coingecko.com/api/v3/coins/${cryptoId}?localization=false&tickers=false&community_data=false&developer_data=false`;

    const response = await fetchWithCorsProxy(url);
    const data = await response.json();

    const result = {
      priceChange7d: data.market_data?.price_change_percentage_7d || 0,
      priceChange30d: data.market_data?.price_change_percentage_30d || 0,
      week52High: data.market_data?.high_24h?.usd * 1.3 || 0,
      week52Low: data.market_data?.low_24h?.usd * 0.7 || 0
    };

    setCache(cacheKey, result);
    return result;

  } catch (error) {
    logWarn(`Failed to fetch extended data for ${cryptoId}`, error);
    return { priceChange7d: 0, priceChange30d: 0, week52High: 0, week52Low: 0 };
  }
}

/**
 * Fetch 30-day historical prices for crypto
 */
async function getCryptoHistoricalPrices(cryptoId) {
  const cacheKey = `crypto_hist_30d_${cryptoId}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  if (checkRateLimit()) {
    return Array(30).fill(FALLBACK_CRYPTO_PRICES[cryptoId] || 100);
  }

  try {
    const url = `https://api.coingecko.com/api/v3/coins/${cryptoId}/market_chart?vs_currency=usd&days=30`;

    const response = await fetchWithCorsProxy(url);
    const data = await response.json();

    const prices = data.prices.map(p => p[1]);

    // Sample to 30 data points
    const sampledPrices = [];
    const interval = Math.floor(prices.length / 30);
    for (let i = 0; i < 30; i++) {
      sampledPrices.push(prices[i * interval] || prices[prices.length - 1]);
    }

    setCache(cacheKey, sampledPrices);
    return sampledPrices;

  } catch (error) {
    logWarn(`Failed to fetch historical prices for ${cryptoId}`, error);
    return Array(30).fill(FALLBACK_CRYPTO_PRICES[cryptoId] || 100);
  }
}

// ============================================
// BULK FETCH FUNCTIONS
// ============================================

/**
 * Get popular stocks with community data
 */
export async function getPopularStocks() {
  const cacheKey = 'popular_stocks';
  const cached = getFromCache(cacheKey);
  if (cached) {
    logDebug('Using cached stocks data');
    return cached;
  }

  try {
    const stocksWithPrices = await Promise.all(
      POPULAR_STOCKS.map(async (stock) => {
        const priceData = await getStockPrice(stock.symbol);

        const priceChange7d = (Math.random() - 0.5) * 10;
        const priceChange30d = (Math.random() - 0.5) * 30;
        const volatility = Math.abs(priceChange30d) > 10 ? 'high' : Math.abs(priceChange30d) > 5 ? 'medium' : 'low';

        return {
          symbol: stock.symbol,
          name: stock.name,
          price: priceData.price,
          change: priceData.change,
          percentChange: priceData.percentChange,
          priceChange7d,
          priceChange30d,
          volatility,
          week52High: priceData.week52High,
          week52Low: priceData.week52Low,
          marketCap: 0,
          volume24h: 0,
          communityData: generateCommunityData(stock.symbol, priceData.price, priceData.percentChange, volatility)
        };
      })
    );

    // Set popularity rankings
    stocksWithPrices.sort((a, b) => b.communityData.picksThisWeek - a.communityData.picksThisWeek);
    stocksWithPrices.forEach((stock, index) => {
      stock.communityData.popularityRank = index + 1;
    });

    setCache(cacheKey, stocksWithPrices);
    logDebug(`Fetched ${stocksWithPrices.length} stocks`);
    return stocksWithPrices;

  } catch (error) {
    logError('Failed to fetch popular stocks', error);
    return createFallbackStocksData();
  }
}

/**
 * Create fallback stocks data
 */
function createFallbackStocksData() {
  return POPULAR_STOCKS.map((stock, index) => {
    const price = FALLBACK_STOCK_PRICES[stock.symbol] || 100;
    return {
      symbol: stock.symbol,
      name: stock.name,
      price,
      change: 0,
      percentChange: 0,
      priceChange7d: 0,
      priceChange30d: 0,
      volatility: 'low',
      week52High: price * 1.25,
      week52Low: price * 0.80,
      marketCap: 0,
      volume24h: 0,
      communityData: {
        picksThisWeek: 500,
        trendPercentage: 0,
        isHot: false,
        isTrending: false,
        championPick: false,
        championPercentage: 50,
        rankDistribution: { beginner: 125, veteran: 175, expert: 125, master: 75 },
        winRate: 50,
        totalBattles: 300,
        wins: 150,
        losses: 150,
        avgReturnWhenWinning: 5.0,
        popularityRank: index + 1,
        recentActivity: null
      }
    };
  });
}

/**
 * Get popular crypto with community data
 */
export async function getPopularCrypto() {
  const cacheKey = 'popular_crypto';
  const cached = getFromCache(cacheKey);
  if (cached) {
    logDebug('Using cached crypto data');
    return cached;
  }

  try {
    // Process in smaller batches to avoid rate limits
    const batchSize = 4;
    const batches = [];

    for (let i = 0; i < POPULAR_CRYPTO.length; i += batchSize) {
      batches.push(POPULAR_CRYPTO.slice(i, i + batchSize));
    }

    const allCryptoWithPrices = [];

    for (const batch of batches) {
      const batchPromises = batch.map(async (crypto) => {
        const priceData = await getCryptoPrice(crypto.id);
        const extendedData = await getCryptoExtendedData(crypto.id);

        const currentPrice = priceData.price;
        const priceChange7d = extendedData.priceChange7d || (Math.random() - 0.5) * 10;
        const priceChange30d = extendedData.priceChange30d || (Math.random() - 0.5) * 30;
        const volatility = Math.abs(priceChange30d) > 10 ? 'high' : Math.abs(priceChange30d) > 5 ? 'medium' : 'low';

        return {
          symbol: crypto.symbol,
          name: crypto.name,
          price: priceData.price,
          change24h: priceData.change24h,
          percentChange: priceData.change24h,
          priceChange7d,
          priceChange30d,
          marketCap: priceData.marketCap,
          volume24h: priceData.volume24h,
          volatility,
          week52High: extendedData.week52High || currentPrice * 1.5,
          week52Low: extendedData.week52Low || currentPrice * 0.5,
          communityData: generateCommunityData(crypto.symbol, priceData.price, priceData.change24h, volatility)
        };
      });

      const batchResults = await Promise.all(batchPromises);
      allCryptoWithPrices.push(...batchResults);

      // Delay between batches to avoid rate limiting
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Set popularity rankings
    allCryptoWithPrices.sort((a, b) => b.communityData.picksThisWeek - a.communityData.picksThisWeek);
    allCryptoWithPrices.forEach((crypto, index) => {
      crypto.communityData.popularityRank = index + 1;
    });

    setCache(cacheKey, allCryptoWithPrices);
    logDebug(`Fetched ${allCryptoWithPrices.length} cryptocurrencies`);
    return allCryptoWithPrices;

  } catch (error) {
    logError('Failed to fetch popular crypto', error);
    return createFallbackCryptoListData();
  }
}

/**
 * Create fallback crypto list data
 */
function createFallbackCryptoListData() {
  return POPULAR_CRYPTO.map((crypto, index) => {
    const price = FALLBACK_CRYPTO_PRICES[crypto.id] || 100;
    return {
      symbol: crypto.symbol,
      name: crypto.name,
      price,
      change24h: 0,
      percentChange: 0,
      priceChange7d: 0,
      priceChange30d: 0,
      marketCap: 0,
      volume24h: 0,
      volatility: 'low',
      week52High: price * 1.25,
      week52Low: price * 0.75,
      communityData: {
        picksThisWeek: 500,
        trendPercentage: 0,
        isHot: false,
        isTrending: false,
        championPick: false,
        championPercentage: 50,
        rankDistribution: { beginner: 125, veteran: 175, expert: 125, master: 75 },
        winRate: 50,
        totalBattles: 300,
        wins: 150,
        losses: 150,
        avgReturnWhenWinning: 5.0,
        popularityRank: index + 1,
        recentActivity: null
      }
    };
  });
}

// ============================================
// EXPORTS
// ============================================

// Named exports for direct imports
export { POPULAR_STOCKS, POPULAR_CRYPTO, FALLBACK_CRYPTO_PRICES };

export const stockAPI = {
  getStockPrice,
  getCryptoPrice,
  getPopularStocks,
  getPopularCrypto,
  getCryptoExtendedData,
  getStockHistoricalPrices,
  getCryptoHistoricalPrices,
  POPULAR_STOCKS,
  POPULAR_CRYPTO,
  FALLBACK_CRYPTO_PRICES
};

export default stockAPI;
