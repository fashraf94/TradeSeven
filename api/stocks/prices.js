// Vercel Serverless Function - Stock Prices (Consolidated)
// Handles current prices, historical data, and technical indicators
//
// Current prices: /api/stocks/prices?symbols=AAPL,MSFT,GOOGL
// Historical:     /api/stocks/prices?symbols=XLK&type=historical&days=180
// Technical:      /api/stocks/prices?symbols=MU&type=technical&function=rsi&period=14
// Legacy SMA:     /api/stocks/prices?symbols=XLK&type=sma&period=50

import { applySecurityMiddleware } from '../_utils/security.js';

export default async function handler(req, res) {
  // Apply security middleware (CORS, security headers, rate limiting, preflight)
  // Higher limit for this endpoint since it handles historical/technical data that requires multiple calls
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 200, windowMs: 60000 } })) {
    return;
  }

  const { symbols, type, days, period } = req.query;

  if (!symbols) {
    return res.status(400).json({ error: 'Missing symbols parameter' });
  }

  const API_KEY = process.env.EODHD_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'API not configured' });
  }

  // Route based on request type
  switch (type) {
    case 'historical':
      return handleHistoricalRequest(req, res, symbols, days, API_KEY);
    case 'technical':
      return handleTechnicalRequest(req, res, API_KEY);
    case 'sma':
      // Legacy support - redirect to technical handler
      return handleTechnicalRequest(req, res, API_KEY, 'sma');
    default:
      return handleCurrentPrices(req, res, symbols, API_KEY);
  }
}

/**
 * Handle current price requests
 * GET /api/stocks/prices?symbols=AAPL,MSFT,GOOGL
 */
async function handleCurrentPrices(req, res, symbols, API_KEY) {
  try {
    const symbolList = symbols.split(',').map(s => `${s.trim()}.US`).join(',');
    const url = `https://eodhd.com/api/real-time/${symbolList}?api_token=${API_KEY}&fmt=json`;

    console.log('[API] Fetching stock prices:', symbolList);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`EODHD responded with ${response.status}`);
    }

    const data = await response.json();

    const prices = {};
    const dataArray = Array.isArray(data) ? data : [data];

    // Log EODHD response timestamp to track data staleness
    if (dataArray.length > 0) {
      const sampleItem = dataArray[0];
      const eodhTimestamp = sampleItem.timestamp ? new Date(sampleItem.timestamp * 1000) : null;
      console.log('[EODHD] Response data age:', {
        symbol: sampleItem.code,
        price: sampleItem.close,
        eodhTimestamp: eodhTimestamp ? eodhTimestamp.toISOString() : 'N/A',
        fetchedAt: new Date().toISOString(),
        dataAgeSeconds: eodhTimestamp ? Math.round((Date.now() - eodhTimestamp.getTime()) / 1000) : 'unknown'
      });
    }

    let oldestTimestamp = null;
    dataArray.forEach(item => {
      if (item && item.code) {
        const symbol = item.code.replace('.US', '');
        prices[symbol] = {
          price: item.close || item.previousClose || 0,
          change: item.change || 0,
          changePercent: item.change_p || 0,
          high: item.high,
          low: item.low,
          volume: item.volume,
          timestamp: item.timestamp || null
        };
        // Track oldest timestamp for data age reporting
        if (item.timestamp && (!oldestTimestamp || item.timestamp < oldestTimestamp)) {
          oldestTimestamp = item.timestamp;
        }
      }
    });

    return res.status(200).json({
      success: true,
      prices,
      count: Object.keys(prices).length,
      dataTimestamp: oldestTimestamp ? new Date(oldestTimestamp * 1000).toISOString() : null,
      fetchedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('[API] Stock prices error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch prices',
      message: error.message
    });
  }
}

/**
 * Handle historical price requests
 * GET /api/stocks/prices?symbols=XLK&type=historical&days=180
 */
async function handleHistoricalRequest(req, res, symbols, days, API_KEY) {
  try {
    const symbol = symbols.split(',')[0].trim().toUpperCase();
    const daysNum = parseInt(days, 10) || 180;

    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const url = `https://eodhd.com/api/eod/${symbol}.US?api_token=${API_KEY}&from=${startDate}&to=${endDate}&fmt=json`;

    console.log(`[API] Fetching historical data for ${symbol} (${daysNum} days)`);

    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[API] EODHD historical error: ${response.status}`);
      return res.status(response.status).json({
        success: false,
        error: 'EODHD API error',
        status: response.status
      });
    }

    const data = await response.json();

    console.log(`[API] Received ${data.length} data points for ${symbol}`);

    return res.status(200).json({
      success: true,
      symbol,
      data,
      count: data.length,
      from: startDate,
      to: endDate
    });

  } catch (error) {
    console.error('[API] Historical error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch historical prices',
      message: error.message
    });
  }
}

/**
 * Handle technical indicator requests
 * GET /api/stocks/prices?symbols=MU&type=technical&function=rsi&period=14
 *
 * Supported functions: rsi, macd, sma, ema, atr
 */
async function handleTechnicalRequest(req, res, API_KEY, legacyFunction = null) {
  const { symbols, period = '14' } = req.query;
  const fn = legacyFunction || req.query.function;

  if (!symbols) {
    return res.status(400).json({ error: 'Symbol required' });
  }

  if (!fn) {
    return res.status(400).json({ error: 'Function required (rsi, macd, sma, ema, atr)' });
  }

  try {
    const symbol = symbols.split(',')[0].trim().toUpperCase();
    const periodNum = parseInt(period, 10) || 14;

    // Build URL based on function type
    let url;

    switch (fn.toLowerCase()) {
      case 'rsi':
        url = `https://eodhd.com/api/technical/${symbol}.US?api_token=${API_KEY}&function=rsi&period=${periodNum}&fmt=json`;
        break;
      case 'macd':
        url = `https://eodhd.com/api/technical/${symbol}.US?api_token=${API_KEY}&function=macd&fast_period=12&slow_period=26&signal_period=9&fmt=json`;
        break;
      case 'sma':
        url = `https://eodhd.com/api/technical/${symbol}.US?api_token=${API_KEY}&function=sma&period=${periodNum}&fmt=json`;
        break;
      case 'ema':
        url = `https://eodhd.com/api/technical/${symbol}.US?api_token=${API_KEY}&function=ema&period=${periodNum}&fmt=json`;
        break;
      case 'atr':
        url = `https://eodhd.com/api/technical/${symbol}.US?api_token=${API_KEY}&function=atr&period=${periodNum}&fmt=json`;
        break;
      default:
        return res.status(400).json({ error: `Unknown function: ${fn}` });
    }

    console.log(`[API] Fetching ${fn.toUpperCase()}(${periodNum}) for ${symbol}`);

    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[API] EODHD technical error: ${response.status}`);
      return res.status(response.status).json({
        success: false,
        error: 'EODHD API error',
        status: response.status,
        symbol,
        function: fn
      });
    }

    const data = await response.json();

    // Build result with latest values for convenience
    let result = {
      success: true,
      symbol,
      function: fn,
      indicator: fn, // Alias for backwards compatibility
      period: periodNum,
      data: Array.isArray(data) ? data.slice(-10) : data, // Return last 10 data points
      count: Array.isArray(data) ? data.length : 1
    };

    // Extract latest values
    if (Array.isArray(data) && data.length > 0) {
      const latest = data[data.length - 1];

      switch (fn.toLowerCase()) {
        case 'rsi':
          result.latestValue = latest.rsi;
          result.value = latest.rsi; // Backwards compatibility
          break;
        case 'macd':
          result.latestValue = {
            macd: latest.macd,
            signal: latest.signal,
            histogram: latest.divergence || latest.histogram
          };
          break;
        case 'sma':
          result.latestValue = latest.sma;
          result.value = latest.sma; // Backwards compatibility
          break;
        case 'ema':
          result.latestValue = latest.ema;
          result.value = latest.ema;
          break;
        case 'atr':
          result.latestValue = latest.atr;
          result.value = latest.atr;
          break;
      }

      result.latestDate = latest.date;
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('[API] Technical error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch technical indicator',
      message: error.message
    });
  }
}
