// Vercel Serverless Function - Historical OHLCV Data
// Endpoint: /api/stocks/historical?symbol=AAPL&timeframe=1d
// Timeframes: 1h (hourly), 1d (daily), 1w (weekly)

import { applySecurityMiddleware } from '../_utils/security.js';

// Timeframe configuration
const TIMEFRAME_CONFIG = {
  '1h': {
    endpoint: 'intraday',
    interval: '1h',
    days: 10,        // 10 days of hourly data (~70 candles)
    description: '10-day hourly'
  },
  '1d': {
    endpoint: 'eod',
    interval: null,
    days: 90,        // 3 months of daily data (~63 candles)
    description: '3-month daily'
  },
  '1w': {
    endpoint: 'eod',
    interval: null,
    days: 1095,      // 3 years of data to aggregate (~156 weekly candles)
    description: '3-year weekly'
  }
};

// Aggregate daily data to weekly candles
const aggregateToWeekly = (dailyData) => {
  const weeks = {};

  dailyData.forEach(candle => {
    // Get the Monday of this candle's week
    const date = new Date(candle.date);
    const day = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
    const weekKey = monday.toISOString().split('T')[0];

    if (!weeks[weekKey]) {
      weeks[weekKey] = {
        date: weekKey,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume
      };
    } else {
      weeks[weekKey].high = Math.max(weeks[weekKey].high, candle.high);
      weeks[weekKey].low = Math.min(weeks[weekKey].low, candle.low);
      weeks[weekKey].close = candle.close; // Latest close
      weeks[weekKey].volume += candle.volume;
    }
  });

  // Sort newest first to match the order=d behavior
  return Object.values(weeks).sort((a, b) =>
    new Date(b.date) - new Date(a.date)
  );
};

export default async function handler(req, res) {
  // Apply security middleware (CORS, security headers, rate limiting, preflight)
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60000 } })) {
    return;
  }

  const { symbol, timeframe = '1d', days } = req.query;

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
    const config = TIMEFRAME_CONFIG[timeframe] || TIMEFRAME_CONFIG['1d'];

    // Use custom days if provided, otherwise use config default
    const numDays = days ? Math.min(parseInt(days, 10), 1095) : config.days;

    console.log(`[API] Fetching ${config.description} OHLCV for: ${upperSymbol} (${numDays} days)`);

    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - numDays);
    const fromDate = startDate.toISOString().split('T')[0];

    let data;

    if (timeframe === '1h') {
      // Fetch intraday data from EODHD
      const response = await fetch(
        `https://eodhd.com/api/intraday/${upperSymbol}.US?api_token=${API_KEY}&fmt=json&interval=1h&from=${Math.floor(startDate.getTime() / 1000)}`
      );

      if (!response.ok) {
        // Fallback to daily if intraday not available
        console.warn(`[API] Intraday not available for ${upperSymbol}, falling back to daily`);
        const fallbackResponse = await fetch(
          `https://eodhd.com/api/eod/${upperSymbol}.US?api_token=${API_KEY}&fmt=json&period=d&order=d&from=${fromDate}`
        );
        if (!fallbackResponse.ok) {
          throw new Error(`EODHD API responded with ${fallbackResponse.status}`);
        }
        data = await fallbackResponse.json();
      } else {
        const intradayData = await response.json();
        // Transform intraday format to match daily format
        data = (intradayData || []).map(candle => ({
          date: new Date(candle.timestamp * 1000).toISOString(),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume
        })).sort((a, b) => new Date(b.date) - new Date(a.date)); // Newest first
      }
    } else {
      // Fetch daily EOD data from EODHD
      const response = await fetch(
        `https://eodhd.com/api/eod/${upperSymbol}.US?api_token=${API_KEY}&fmt=json&period=d&order=d&from=${fromDate}`
      );

      if (!response.ok) {
        throw new Error(`EODHD API responded with ${response.status}`);
      }

      data = await response.json();

      // Aggregate to weekly if needed
      if (timeframe === '1w' && Array.isArray(data)) {
        // First transform to consistent format, then aggregate
        const dailyOhlcv = data.map(candle => ({
          date: candle.date,
          open: parseFloat(candle.open) || 0,
          high: parseFloat(candle.high) || 0,
          low: parseFloat(candle.low) || 0,
          close: parseFloat(candle.close) || 0,
          volume: parseInt(candle.volume, 10) || 0,
        }));

        // Need data oldest first for proper weekly aggregation
        dailyOhlcv.reverse();
        data = aggregateToWeekly(dailyOhlcv);
      }
    }

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No historical data found for ${upperSymbol}`
      });
    }

    // Transform to consistent OHLCV format (data comes newest first)
    const ohlcv = timeframe === '1w' ? data : data.map(candle => ({
      date: candle.date,
      open: parseFloat(candle.open) || 0,
      high: parseFloat(candle.high) || 0,
      low: parseFloat(candle.low) || 0,
      close: parseFloat(candle.close) || 0,
      adjusted_close: parseFloat(candle.adjusted_close) || parseFloat(candle.close) || 0,
      volume: parseInt(candle.volume, 10) || 0,
    }));

    console.log(`[API] Returning ${ohlcv.length} ${timeframe} OHLCV candles for ${upperSymbol}`);

    return res.status(200).json({
      success: true,
      symbol: upperSymbol,
      timeframe,
      description: config.description,
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
