// Vercel Serverless Function - Crypto Metrics
// Endpoint: /api/crypto/metrics?symbol=BTC

import { applySecurityMiddleware } from '../_utils/security.js';

export default async function handler(req, res) {
  // Apply security middleware (CORS, security headers, rate limiting, preflight)
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60000 } })) {
    return;
  }

  const { symbol } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Missing symbol parameter' });
  }

  const API_KEY = process.env.EODHD_API_KEY;

  if (!API_KEY) {
    console.error('EODHD_API_KEY not configured');
    return res.status(500).json({ error: 'API not configured' });
  }

  try {
    const upperSymbol = symbol.toUpperCase();
    const endDate = new Date().toISOString().split('T')[0];
    const startDate30d = getDateDaysAgo(30);
    const startDate365d = getDateDaysAgo(365);

    console.log(`[API] Fetching crypto metrics for: ${upperSymbol}`);

    // Fetch historical data for the crypto and BTC (as benchmark) in parallel
    const [cryptoHistRes, btcHistRes, cryptoLongHistRes] = await Promise.all([
      fetch(`https://eodhd.com/api/eod/${upperSymbol}-USD.CC?api_token=${API_KEY}&fmt=json&from=${startDate30d}&to=${endDate}`),
      fetch(`https://eodhd.com/api/eod/BTC-USD.CC?api_token=${API_KEY}&fmt=json&from=${startDate30d}&to=${endDate}`),
      // Get longer history for ATH calculation
      fetch(`https://eodhd.com/api/eod/${upperSymbol}-USD.CC?api_token=${API_KEY}&fmt=json&from=${startDate365d}&to=${endDate}`)
    ]);

    if (!cryptoHistRes.ok) {
      throw new Error(`EODHD crypto history responded with ${cryptoHistRes.status}`);
    }

    const cryptoHistory = await cryptoHistRes.json();
    const btcHistory = btcHistRes.ok ? await btcHistRes.json() : [];
    const cryptoLongHistory = cryptoLongHistRes.ok ? await cryptoLongHistRes.json() : cryptoHistory;

    if (!Array.isArray(cryptoHistory) || cryptoHistory.length === 0) {
      throw new Error('No historical data available');
    }

    // Sort by date descending (most recent first)
    cryptoHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
    btcHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
    cryptoLongHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

    const currentPrice = cryptoHistory[0]?.close || 0;
    const previousClose = cryptoHistory[1]?.close || currentPrice;
    const priceChange24h = previousClose > 0 ? ((currentPrice - previousClose) / previousClose) * 100 : 0;

    // Calculate volatility metrics
    const volatility7d = calculateVolatility(cryptoHistory.slice(0, 7));
    const volatility30d = calculateVolatility(cryptoHistory);
    const btcVolatility7d = calculateVolatility(btcHistory.slice(0, 7));
    const volatilityVsBtc = btcVolatility7d > 0 ? volatility7d / btcVolatility7d : 1;

    // Calculate momentum
    const momentum7d = calculateMomentum(cryptoHistory, 7);
    const momentum30d = calculateMomentum(cryptoHistory, 30);

    // Calculate volume metrics
    const latestVolume = cryptoHistory[0]?.volume || 0;
    const volume24h = latestVolume * currentPrice; // Approximate USD volume
    const avgVolume7d = calculateAverageVolume(cryptoHistory.slice(0, 7), currentPrice);
    const volumeVsAvg = avgVolume7d > 0 ? ((volume24h - avgVolume7d) / avgVolume7d) * 100 : 0;

    // Find ATH from historical data
    const athData = findATH(cryptoLongHistory, upperSymbol);

    // Calculate distance from ATH
    const distanceFromATH = athData.price > 0 && currentPrice > 0
      ? ((currentPrice - athData.price) / athData.price) * 100
      : 0;

    // Get market cap rank approximation based on known rankings
    const marketCapRank = getApproxMarketCapRank(upperSymbol);

    const result = {
      symbol: upperSymbol,
      name: CRYPTO_NAMES[upperSymbol] || upperSymbol,

      // Current price data
      currentPrice,
      change24h: priceChange24h,

      // Volatility metrics (8 metrics for crypto)
      volatility7d,
      volatility30d,
      volatilityVsBtc,

      // Volume metrics
      volume24h,
      avgVolume7d,
      volumeVsAvg,

      // Momentum metrics
      momentum7d,
      momentum30d,

      // ATH data
      athPrice: athData.price,
      athDate: athData.date,
      distanceFromATH,

      // Additional context
      marketCapRank,

      // Volatility trend (is 7d vol > 30d vol?)
      volatilityTrend: volatility7d > volatility30d ? 'increasing' : volatility7d < volatility30d ? 'decreasing' : 'stable',

      // Momentum trend
      momentumTrend: momentum7d > momentum30d ? 'accelerating' : momentum7d < momentum30d ? 'decelerating' : 'steady',

      // Historical prices for charts (last 30 days, ascending order)
      historicalPrices: cryptoHistory.slice(0, 30).reverse().map(d => d.close)
    };

    console.log(`[API] Returning crypto metrics for ${upperSymbol}`);
    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[API] Crypto metrics error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch crypto metrics',
      message: error.message
    });
  }
}

// Helper functions
function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

function calculateVolatility(priceData) {
  if (!priceData || priceData.length < 2) return 0;

  const returns = [];
  for (let i = 0; i < priceData.length - 1; i++) {
    const oldPrice = priceData[i + 1]?.close || 0;
    const newPrice = priceData[i]?.close || 0;
    if (oldPrice > 0) {
      returns.push(((newPrice - oldPrice) / oldPrice) * 100);
    }
  }

  if (returns.length === 0) return 0;

  // Calculate standard deviation of returns
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / returns.length;

  return Math.sqrt(variance);
}

function calculateMomentum(historical, days) {
  if (!historical || historical.length < 2) return 0;

  const dataSlice = historical.slice(0, Math.min(days, historical.length));
  if (dataSlice.length < 2) return 0;

  const newPrice = dataSlice[0]?.close || 0;
  const oldPrice = dataSlice[dataSlice.length - 1]?.close || 0;

  if (oldPrice === 0) return 0;
  return ((newPrice - oldPrice) / oldPrice) * 100;
}

function calculateAverageVolume(historical, currentPrice) {
  if (!historical || historical.length === 0) return 0;

  const volumes = historical.map(d => (d.volume || 0) * (d.close || currentPrice));
  const sum = volumes.reduce((a, b) => a + b, 0);
  return sum / historical.length;
}

function findATH(historical, symbol) {
  // Known ATH prices for major cryptos (as reference/fallback)
  const knownATHs = {
    'BTC': { price: 73750, date: '2024-03-14' },
    'ETH': { price: 4878, date: '2021-11-10' },
    'BNB': { price: 720, date: '2024-06-06' },
    'SOL': { price: 260, date: '2021-11-06' },
    'XRP': { price: 3.40, date: '2018-01-07' },
    'ADA': { price: 3.10, date: '2021-09-02' },
    'DOGE': { price: 0.74, date: '2021-05-08' },
    'AVAX': { price: 146, date: '2021-11-21' },
    'DOT': { price: 55, date: '2021-11-04' },
    'MATIC': { price: 2.92, date: '2021-12-27' },
    'LINK': { price: 52.70, date: '2021-05-10' },
    'UNI': { price: 44.97, date: '2021-05-03' },
    'LTC': { price: 412, date: '2021-05-10' },
    'XLM': { price: 0.94, date: '2018-01-04' },
    'ATOM': { price: 44.70, date: '2022-01-17' },
    'NEAR': { price: 20.42, date: '2022-01-16' },
    'ALGO': { price: 3.56, date: '2019-06-21' },
    'XMR': { price: 517, date: '2021-05-07' }
  };

  // Try to find ATH from historical data
  let ath = { price: 0, date: '' };

  if (historical && historical.length > 0) {
    for (const day of historical) {
      if (day.high && day.high > ath.price) {
        ath = { price: day.high, date: day.date };
      }
    }
  }

  // Use known ATH if historical is lower or unavailable
  if (knownATHs[symbol] && knownATHs[symbol].price > ath.price) {
    return knownATHs[symbol];
  }

  return ath.price > 0 ? ath : { price: 0, date: 'Unknown' };
}

function getApproxMarketCapRank(symbol) {
  const rankings = {
    'BTC': 1, 'ETH': 2, 'USDT': 3, 'BNB': 4, 'SOL': 5,
    'XRP': 6, 'USDC': 7, 'ADA': 8, 'DOGE': 9, 'AVAX': 10,
    'TRX': 11, 'LINK': 12, 'DOT': 13, 'MATIC': 14, 'TON': 15,
    'SHIB': 16, 'LTC': 17, 'BCH': 18, 'UNI': 19, 'ATOM': 20,
    'XLM': 21, 'XMR': 22, 'NEAR': 23, 'ALGO': 24, 'AAVE': 25
  };
  return rankings[symbol] || 50;
}

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
  'TRX': 'TRON',
  'ETC': 'Ethereum Classic',
  'FIL': 'Filecoin',
  'VET': 'VeChain',
  'HBAR': 'Hedera',
  'SAND': 'The Sandbox',
  'MANA': 'Decentraland',
  'AAVE': 'Aave',
  'MKR': 'Maker',
  'GRT': 'The Graph',
  'PEPE': 'Pepe',
  'BONK': 'Bonk',
  'ARB': 'Arbitrum',
  'OP': 'Optimism',
  'SUI': 'Sui',
  'INJ': 'Injective',
  'SEI': 'Sei',
  'TON': 'Toncoin'
};
