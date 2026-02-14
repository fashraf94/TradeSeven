// Vercel Serverless Function - Crypto Prices
// Endpoint: /api/crypto/prices?symbols=BTC,ETH,SOL

import { applySecurityMiddleware } from '../_utils/security.js';
import { getFromCache, setInCache, setCacheHeaders, CACHE_TIERS } from '../_utils/serverCache.js';

export default async function handler(req, res) {
  // Apply security middleware (CORS, security headers, rate limiting, preflight)
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 60, windowMs: 60000 } })) {
    return;
  }

  const { symbols } = req.query;
  const noCache = req.query?.nocache === '1';

  if (!symbols) {
    return res.status(400).json({ error: 'Missing symbols parameter' });
  }

  const tier = CACHE_TIERS.PRICE;
  const sortedSymbols = symbols.split(',').map(s => s.trim().toUpperCase()).sort().join(',');
  const cacheKey = `crypto_prices_${sortedSymbols}`;

  if (!noCache) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      setCacheHeaders(res, tier.sMaxAge, tier.staleWhileRevalidate);
      return res.status(200).json(cached);
    }
  }

  const API_KEY = process.env.EODHD_API_KEY;

  if (!API_KEY) {
    console.error('EODHD_API_KEY not configured');
    return res.status(500).json({ error: 'API not configured' });
  }

  try {
    const symbolList = symbols.split(',').map(s => `${s.trim()}-USD.CC`).join(',');
    const url = `https://eodhd.com/api/real-time/${symbolList}?api_token=${API_KEY}&fmt=json`;

    console.log('[API] Fetching crypto prices:', symbolList);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`EODHD responded with ${response.status}`);
    }

    const data = await response.json();

    // Format response
    const prices = {};
    const dataArray = Array.isArray(data) ? data : [data];

    dataArray.forEach(item => {
      if (item && item.code) {
        const symbol = item.code.split('-')[0]; // "BTC-USD.CC" -> "BTC"
        prices[symbol] = {
          price: item.close || item.previousClose || 0,
          change: item.change || 0,
          changePercent: item.change_p || 0,
          high: item.high,
          low: item.low,
          volume: item.volume,
          timestamp: item.timestamp
        };
      }
    });

    console.log('[API] Returning prices for:', Object.keys(prices).join(', '));

    const responseData = {
      success: true,
      prices,
      count: Object.keys(prices).length
    };

    if (!noCache) {
      setInCache(cacheKey, responseData, tier.memoryTTL);
      setCacheHeaders(res, tier.sMaxAge, tier.staleWhileRevalidate);
    }
    return res.status(200).json(responseData);

  } catch (error) {
    console.error('[API] Crypto prices error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch prices',
      message: error.message
    });
  }
}
