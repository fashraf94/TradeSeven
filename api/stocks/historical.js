// Vercel Serverless Function - Historical OHLCV Data
// Endpoint: /api/stocks/historical?symbol=AAPL&days=90

import { applySecurityMiddleware } from '../_utils/security.js';

export default async function handler(req, res) {
  // Apply security middleware (CORS, security headers, rate limiting, preflight)
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60000 } })) {
    return;
  }

  const { symbol, days = '90' } = req.query;

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
    const numDays = Math.min(parseInt(days, 10) || 90, 365); // Cap at 365 days

    console.log(`[API] Fetching ${numDays} days of OHLCV for: ${upperSymbol}`);

    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - numDays);
    const fromDate = startDate.toISOString().split('T')[0];

    // Fetch historical EOD data from EODHD
    const response = await fetch(
      `https://eodhd.com/api/eod/${upperSymbol}.US?api_token=${API_KEY}&fmt=json&period=d&order=d&from=${fromDate}`
    );

    if (!response.ok) {
      throw new Error(`EODHD API responded with ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No historical data found for ${upperSymbol}`
      });
    }

    // Transform to consistent OHLCV format (data comes newest first due to order=d)
    const ohlcv = data.map(candle => ({
      date: candle.date,
      open: parseFloat(candle.open) || 0,
      high: parseFloat(candle.high) || 0,
      low: parseFloat(candle.low) || 0,
      close: parseFloat(candle.close) || 0,
      adjusted_close: parseFloat(candle.adjusted_close) || parseFloat(candle.close) || 0,
      volume: parseInt(candle.volume, 10) || 0,
    }));

    console.log(`[API] Returning ${ohlcv.length} OHLCV candles for ${upperSymbol}`);

    return res.status(200).json({
      success: true,
      symbol: upperSymbol,
      count: ohlcv.length,
      data: ohlcv
    });

  } catch (error) {
    console.error('[API] Historical OHLCV error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch historical data',
      message: error.message
    });
  }
}
