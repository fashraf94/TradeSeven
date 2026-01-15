// Vercel Serverless Function - Options IV / Expected Move
// Endpoint: /api/stocks/options-iv?symbol=NVDA
// Fetches options data and calculates expected move from ATM straddle

import { applySecurityMiddleware } from '../_utils/security.js';

export default async function handler(req, res) {
  // Apply security middleware
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60000 } })) {
    return;
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Symbol required' });
  }

  const apiKey = process.env.EODHD_API_KEY;

  if (!apiKey) {
    console.error('[OptionsIV] EODHD_API_KEY not configured');
    return res.status(500).json({ error: 'API not configured' });
  }

  const upperSymbol = symbol.toUpperCase();
  const tickerWithExchange = `${upperSymbol}.US`;

  console.log(`[OptionsIV] Fetching options data for ${upperSymbol}...`);

  try {
    // Fetch options chain and current price in parallel
    const [optionsRes, priceRes] = await Promise.all([
      fetch(`https://eodhd.com/api/options/${tickerWithExchange}?api_token=${apiKey}`),
      fetch(`https://eodhd.com/api/real-time/${tickerWithExchange}?api_token=${apiKey}&fmt=json`)
    ]);

    // Parse price data
    let currentPrice = null;
    if (priceRes.ok) {
      const priceData = await priceRes.json();
      currentPrice = priceData?.close || priceData?.previousClose || priceData?.open;
      console.log(`[OptionsIV] ${upperSymbol} current price: $${currentPrice}`);
    }

    if (!currentPrice) {
      console.warn(`[OptionsIV] No price data for ${upperSymbol}`);
      return res.status(200).json({
        success: false,
        symbol: upperSymbol,
        error: 'No price data available',
        expectedMovePercent: null,
        impliedVolatility: null
      });
    }

    // Parse options data
    if (!optionsRes.ok) {
      console.warn(`[OptionsIV] Options API returned ${optionsRes.status} for ${upperSymbol}`);
      return res.status(200).json({
        success: false,
        symbol: upperSymbol,
        error: `Options API error: ${optionsRes.status}`,
        expectedMovePercent: null,
        impliedVolatility: null
      });
    }

    const optionsData = await optionsRes.json();

    // Check if we have valid options data
    if (!optionsData || typeof optionsData !== 'object' || Object.keys(optionsData).length === 0) {
      console.warn(`[OptionsIV] No options data for ${upperSymbol}`);
      return res.status(200).json({
        success: false,
        symbol: upperSymbol,
        error: 'No options data available',
        expectedMovePercent: null,
        impliedVolatility: null
      });
    }

    // Find the nearest expiration (typically the earnings week)
    // EODHD returns options keyed by expiration date
    const expirations = Object.keys(optionsData)
      .filter(key => key.match(/^\d{4}-\d{2}-\d{2}$/)) // Filter valid date keys
      .sort();

    if (expirations.length === 0) {
      console.warn(`[OptionsIV] No valid expirations found for ${upperSymbol}`);
      return res.status(200).json({
        success: false,
        symbol: upperSymbol,
        error: 'No options expirations found',
        expectedMovePercent: null,
        impliedVolatility: null
      });
    }

    // Use the nearest expiration
    const nearestExpiry = expirations[0];
    const chain = optionsData[nearestExpiry];

    console.log(`[OptionsIV] ${upperSymbol} nearest expiry: ${nearestExpiry}`);

    if (!chain || !chain.options) {
      console.warn(`[OptionsIV] No options chain for ${upperSymbol} at ${nearestExpiry}`);
      return res.status(200).json({
        success: false,
        symbol: upperSymbol,
        error: 'No options chain found',
        expectedMovePercent: null,
        impliedVolatility: null
      });
    }

    // Get calls and puts
    const calls = chain.options.CALL || chain.options.call || [];
    const puts = chain.options.PUT || chain.options.put || [];

    if (calls.length === 0 || puts.length === 0) {
      console.warn(`[OptionsIV] Incomplete options chain for ${upperSymbol}`);
      return res.status(200).json({
        success: false,
        symbol: upperSymbol,
        error: 'Incomplete options chain (missing calls or puts)',
        expectedMovePercent: null,
        impliedVolatility: null
      });
    }

    // Find ATM strike (closest to current price)
    let atmStrike = null;
    let minDiff = Infinity;

    calls.forEach(opt => {
      const strike = opt.strike || opt.strikePrice;
      if (strike) {
        const diff = Math.abs(strike - currentPrice);
        if (diff < minDiff) {
          minDiff = diff;
          atmStrike = strike;
        }
      }
    });

    if (!atmStrike) {
      console.warn(`[OptionsIV] Could not find ATM strike for ${upperSymbol}`);
      return res.status(200).json({
        success: false,
        symbol: upperSymbol,
        error: 'Could not determine ATM strike',
        expectedMovePercent: null,
        impliedVolatility: null
      });
    }

    console.log(`[OptionsIV] ${upperSymbol} ATM strike: $${atmStrike} (price: $${currentPrice})`);

    // Find ATM call and put
    const atmCall = calls.find(o => (o.strike || o.strikePrice) === atmStrike);
    const atmPut = puts.find(o => (o.strike || o.strikePrice) === atmStrike);

    if (!atmCall || !atmPut) {
      console.warn(`[OptionsIV] Could not find ATM options for ${upperSymbol}`);
      return res.status(200).json({
        success: false,
        symbol: upperSymbol,
        error: 'Could not find ATM call/put pair',
        expectedMovePercent: null,
        impliedVolatility: null
      });
    }

    // Calculate straddle price (expected move)
    const callPrice = atmCall.lastPrice || atmCall.ask || atmCall.lastTradePrice || 0;
    const putPrice = atmPut.lastPrice || atmPut.ask || atmPut.lastTradePrice || 0;
    const straddlePrice = callPrice + putPrice;
    const expectedMovePercent = (straddlePrice / currentPrice) * 100;

    // Get IV (if available)
    const callIV = atmCall.impliedVolatility || atmCall.iv || 0;
    const putIV = atmPut.impliedVolatility || atmPut.iv || 0;
    const avgIV = (callIV + putIV) / 2;

    console.log(`[OptionsIV] ${upperSymbol}: Straddle $${straddlePrice.toFixed(2)}, Expected Move: ${expectedMovePercent.toFixed(1)}%, IV: ${(avgIV * 100).toFixed(0)}%`);

    return res.status(200).json({
      success: true,
      symbol: upperSymbol,
      currentPrice: Math.round(currentPrice * 100) / 100,
      atmStrike,
      straddlePrice: Math.round(straddlePrice * 100) / 100,
      expectedMovePercent: Math.round(expectedMovePercent * 10) / 10,
      expectedMoveAbsolute: Math.round(straddlePrice * 100) / 100,
      impliedVolatility: avgIV > 0 ? Math.round(avgIV * 10000) / 100 : null, // Convert to percentage
      expiration: nearestExpiry,
      callPrice: Math.round(callPrice * 100) / 100,
      putPrice: Math.round(putPrice * 100) / 100,
      daysToExpiry: Math.ceil((new Date(nearestExpiry) - new Date()) / (1000 * 60 * 60 * 24)),
      calculatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[OptionsIV] Error for ${upperSymbol}:`, error);
    return res.status(200).json({
      success: false,
      symbol: upperSymbol,
      error: error.message,
      expectedMovePercent: null,
      impliedVolatility: null
    });
  }
}
