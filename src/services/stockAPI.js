// TradeSeven Stock & Crypto API Service
// Handles real-time market data from Finnhub (stocks) and CoinGecko (crypto)

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

// Popular cryptocurrencies (18 major coins, all >$1B market cap)
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

// Fallback crypto prices (in case API fails)
const FALLBACK_CRYPTO_PRICES = {
  'bitcoin': 45000,
  'ethereum': 2500,
  'binancecoin': 320,
  'solana': 110,
  'ripple': 0.52,
  'cardano': 0.48,
  'dogecoin': 0.085,
  'avalanche-2': 38,
  'polkadot': 7.2,
  'matic-network': 0.85,
  'chainlink': 15.5,
  'uniswap': 6.8,
  'litecoin': 72,
  'stellar': 0.12,
  'monero': 165,
  'algorand': 0.22,
  'cosmos': 9.5,
  'near': 4.2
};

// CORS Proxy for CoinGecko (to bypass browser CORS restrictions)
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

// Fetch stock price from Finnhub
export async function getStockPrice(symbol) {
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      symbol,
      price: data.c || 0, // Current price
      change: data.d || 0, // Change
      percentChange: data.dp || 0 // Percent change
    };
  } catch (error) {
    console.error(`Error fetching stock price for ${symbol}:`, error);
    return {
      symbol,
      price: 100, // Fallback price
      change: 0,
      percentChange: 0
    };
  }
}

// Fetch crypto price from CoinGecko (with CORS proxy)
export async function getCryptoPrice(cryptoId) {
  try {
    // Use CORS proxy to avoid browser restrictions
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=usd&include_24hr_change=true`;
    const proxiedUrl = CORS_PROXY + encodeURIComponent(url);
    
    const response = await fetch(proxiedUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data[cryptoId]) {
      throw new Error('Crypto data not found');
    }
    
    return {
      id: cryptoId,
      price: data[cryptoId].usd || 0,
      change24h: data[cryptoId].usd_24h_change || 0
    };
  } catch (error) {
    console.warn(`Error fetching crypto price for ${cryptoId}, using fallback:`, error);
    
    // Use fallback price
    return {
      id: cryptoId,
      price: FALLBACK_CRYPTO_PRICES[cryptoId] || 100,
      change24h: 0
    };
  }
}

// Get list of popular stocks with current prices
export async function getPopularStocks() {
  try {
    const stocksWithPrices = await Promise.all(
      POPULAR_STOCKS.map(async (stock) => {
        const priceData = await getStockPrice(stock.symbol);
        return {
          symbol: stock.symbol,
          name: stock.name,
          price: priceData.price,
          change: priceData.change,
          percentChange: priceData.percentChange
        };
      })
    );
    
    return stocksWithPrices;
  } catch (error) {
    console.error('Error fetching popular stocks:', error);
    // Return stocks with fallback prices
    return POPULAR_STOCKS.map(stock => ({
      symbol: stock.symbol,
      name: stock.name,
      price: 100,
      change: 0,
      percentChange: 0
    }));
  }
}

// Get list of popular crypto with current prices
export async function getPopularCrypto() {
  try {
    // Fetch prices in batches to avoid rate limiting
    const batchSize = 6;
    const batches = [];
    
    for (let i = 0; i < POPULAR_CRYPTO.length; i += batchSize) {
      const batch = POPULAR_CRYPTO.slice(i, i + batchSize);
      batches.push(batch);
    }
    
    const allCryptoWithPrices = [];
    
    for (const batch of batches) {
      const batchPromises = batch.map(async (crypto) => {
        const priceData = await getCryptoPrice(crypto.id);
        return {
          symbol: crypto.symbol,
          name: crypto.name,
          price: priceData.price,
          change24h: priceData.change24h
        };
      });
      
      const batchResults = await Promise.all(batchPromises);
      allCryptoWithPrices.push(...batchResults);
      
      // Small delay between batches to avoid rate limiting
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return allCryptoWithPrices;
  } catch (error) {
    console.error('Error fetching popular crypto:', error);
    // Return crypto with fallback prices
    return POPULAR_CRYPTO.map(crypto => ({
      symbol: crypto.symbol,
      name: crypto.name,
      price: FALLBACK_CRYPTO_PRICES[crypto.id] || 100,
      change24h: 0
    }));
  }
}

// Export API object for backward compatibility
export const stockAPI = {
  getStockPrice,
  getCryptoPrice,
  getPopularStocks,
  getPopularCrypto
};

export default stockAPI;