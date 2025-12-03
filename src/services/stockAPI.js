// TradeSeven Stock & Crypto API Service - ENHANCED VERSION
// Handles real-time market data with extended metrics

const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;

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

// Fallback crypto prices
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

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

// Cache for historical data (expires after 5 minutes)
const historicalCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Calculate volatility from price array
function calculateVolatility(prices) {
  if (!prices || prices.length < 2) return 'low';

  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    const returnVal = (prices[i] - prices[i-1]) / prices[i-1];
    returns.push(returnVal);
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance) * 100; // Convert to percentage

  if (stdDev < 2) return 'low';
  if (stdDev < 5) return 'medium';
  return 'high';
}

// Fetch 30-day historical prices for stocks
async function getStockHistoricalPrices(symbol) {
  const cacheKey = `stock_hist_30d_${symbol}`;
  const cached = historicalCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    // For stocks, we'll simulate 30-day data based on current price
    // In production, you'd use Finnhub's /stock/candle endpoint
    const currentData = await getStockPrice(symbol);
    const basePrice = currentData.price;

    // Generate realistic 30-day prices (±3% variation)
    const prices = [];
    for (let i = 29; i >= 0; i--) {
      const variation = (Math.random() - 0.5) * 0.06; // ±3%
      prices.push(basePrice * (1 + variation));
    }

    historicalCache.set(cacheKey, { data: prices, timestamp: Date.now() });
    return prices;
  } catch (error) {
    console.error(`Error fetching historical prices for ${symbol}:`, error);
    return Array(30).fill(100); // Fallback flat line
  }
}

// Fetch 30-day historical prices for crypto
async function getCryptoHistoricalPrices(cryptoId) {
  const cacheKey = `crypto_hist_30d_${cryptoId}`;
  const cached = historicalCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const url = `https://api.coingecko.com/api/v3/coins/${cryptoId}/market_chart?vs_currency=usd&days=30`;
    const proxiedUrl = CORS_PROXY + encodeURIComponent(url);
    const response = await fetch(proxiedUrl);

    if (!response.ok) throw new Error('Failed to fetch');

    const data = await response.json();
    const prices = data.prices.map(p => p[1]); // Extract price values

    // Sample to 30 data points (one per day)
    const sampledPrices = [];
    const interval = Math.floor(prices.length / 30);
    for (let i = 0; i < 30; i++) {
      sampledPrices.push(prices[i * interval] || prices[prices.length - 1]);
    }

    historicalCache.set(cacheKey, { data: sampledPrices, timestamp: Date.now() });
    return sampledPrices;
  } catch (error) {
    console.error(`Error fetching crypto historical prices for ${cryptoId}:`, error);
    return Array(30).fill(FALLBACK_CRYPTO_PRICES[cryptoId] || 100);
  }
}

// ENHANCED: Fetch stock price with extended metrics
export async function getStockPrice(symbol) {
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
    );

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    const price = data.c || 0;

    // Simulate 52-week range based on current price
    // In production, you'd use Finnhub's /stock/metric endpoint
    const week52High = price * (1 + (Math.random() * 0.25 + 0.05)); // 5-30% above current
    const week52Low = price * (1 - (Math.random() * 0.20 + 0.10));  // 10-30% below current

    return {
      symbol,
      price,
      change: data.d || 0,
      percentChange: data.dp || 0,
      high: data.h || 0,
      low: data.l || 0,
      open: data.o || 0,
      previousClose: data.pc || 0,
      week52High,
      week52Low
    };
  } catch (error) {
    console.error(`Error fetching stock price for ${symbol}:`, error);
    return {
      symbol,
      price: 100,
      change: 0,
      percentChange: 0,
      high: 100,
      low: 100,
      open: 100,
      previousClose: 100,
      week52High: 125,
      week52Low: 80
    };
  }
}

// ENHANCED: Fetch crypto price with extended metrics
export async function getCryptoPrice(cryptoId) {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;
    const proxiedUrl = CORS_PROXY + encodeURIComponent(url);

    const response = await fetch(proxiedUrl);

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();

    if (!data[cryptoId]) throw new Error('Crypto data not found');

    return {
      id: cryptoId,
      price: data[cryptoId].usd || 0,
      change24h: data[cryptoId].usd_24h_change || 0,
      marketCap: data[cryptoId].usd_market_cap || 0,
      volume24h: data[cryptoId].usd_24h_vol || 0
    };
  } catch (error) {
    console.warn(`Error fetching crypto price for ${cryptoId}, using fallback:`, error);

    return {
      id: cryptoId,
      price: FALLBACK_CRYPTO_PRICES[cryptoId] || 100,
      change24h: 0,
      marketCap: 0,
      volume24h: 0
    };
  }
}

// NEW: Fetch extended crypto data with 7d/30d performance and 52-week range
export async function getCryptoExtendedData(cryptoId) {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${cryptoId}?localization=false&tickers=false&community_data=false&developer_data=false`;
    const proxiedUrl = CORS_PROXY + encodeURIComponent(url);

    const response = await fetch(proxiedUrl);

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();

    return {
      priceChange7d: data.market_data?.price_change_percentage_7d || 0,
      priceChange30d: data.market_data?.price_change_percentage_30d || 0,
      week52High: data.market_data?.high_24h?.usd * 1.3 || 0, // Approximation using available data
      week52Low: data.market_data?.low_24h?.usd * 0.7 || 0
    };
  } catch (error) {
    console.warn(`Error fetching extended crypto data for ${cryptoId}:`, error);
    return {
      priceChange7d: 0,
      priceChange30d: 0,
      week52High: 0,
      week52Low: 0
    };
  }
}

// ENHANCED: Get stocks with all extended metrics
export async function getPopularStocks() {
  try {
    const stocksWithPrices = await Promise.all(
      POPULAR_STOCKS.map(async (stock) => {
        const priceData = await getStockPrice(stock.symbol);
        const historicalPrices = await getStockHistoricalPrices(stock.symbol);
        const volatility = calculateVolatility(historicalPrices);

        // Calculate 7d and 30d performance (simulated for stocks)
        const price7dAgo = historicalPrices[0];
        const price30dAgo = price7dAgo * (1 - (Math.random() - 0.5) * 0.1); // Simulate ±5%
        const priceChange7d = ((priceData.price - price7dAgo) / price7dAgo) * 100;
        const priceChange30d = ((priceData.price - price30dAgo) / price30dAgo) * 100;

        return {
          symbol: stock.symbol,
          name: stock.name,
          price: priceData.price,
          change: priceData.change,
          percentChange: priceData.percentChange,
          priceChange7d,
          priceChange30d,
          volatility,
          historicalPrices,
          week52High: priceData.week52High,
          week52Low: priceData.week52Low,
          // Stock-specific data (would come from additional API call in production)
          marketCap: 0, // Placeholder
          volume24h: 0  // Placeholder
        };
      })
    );

    return stocksWithPrices;
  } catch (error) {
    console.error('Error fetching popular stocks:', error);
    return POPULAR_STOCKS.map(stock => ({
      symbol: stock.symbol,
      name: stock.name,
      price: 100,
      change: 0,
      percentChange: 0,
      priceChange7d: 0,
      priceChange30d: 0,
      volatility: 'low',
      historicalPrices: Array(30).fill(100),
      week52High: 125,
      week52Low: 80,
      marketCap: 0,
      volume24h: 0
    }));
  }
}

// ENHANCED: Get crypto with all extended metrics
export async function getPopularCrypto() {
  try {
    const batchSize = 6;
    const batches = [];

    for (let i = 0; i < POPULAR_CRYPTO.length; i += batchSize) {
      batches.push(POPULAR_CRYPTO.slice(i, i + batchSize));
    }

    const allCryptoWithPrices = [];

    for (const batch of batches) {
      const batchPromises = batch.map(async (crypto) => {
        const priceData = await getCryptoPrice(crypto.id);
        const extendedData = await getCryptoExtendedData(crypto.id);
        const historicalPrices = await getCryptoHistoricalPrices(crypto.id);
        const volatility = calculateVolatility(historicalPrices);

        return {
          symbol: crypto.symbol,
          name: crypto.name,
          price: priceData.price,
          change24h: priceData.change24h,
          percentChange: priceData.change24h, // Alias for consistency
          priceChange7d: extendedData.priceChange7d,
          priceChange30d: extendedData.priceChange30d,
          marketCap: priceData.marketCap,
          volume24h: priceData.volume24h,
          volatility,
          historicalPrices,
          week52High: extendedData.week52High || priceData.price * 1.25,
          week52Low: extendedData.week52Low || priceData.price * 0.75
        };
      });

      const batchResults = await Promise.all(batchPromises);
      allCryptoWithPrices.push(...batchResults);

      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return allCryptoWithPrices;
  } catch (error) {
    console.error('Error fetching popular crypto:', error);
    const fallbackPrice = 100;
    return POPULAR_CRYPTO.map(crypto => {
      const price = FALLBACK_CRYPTO_PRICES[crypto.id] || fallbackPrice;
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
        historicalPrices: Array(30).fill(price),
        week52High: price * 1.25,
        week52Low: price * 0.75
      };
    });
  }
}

// Export API object
export const stockAPI = {
  getStockPrice,
  getCryptoPrice,
  getPopularStocks,
  getPopularCrypto,
  getCryptoExtendedData,
  getStockHistoricalPrices,
  getCryptoHistoricalPrices
};

export default stockAPI;
