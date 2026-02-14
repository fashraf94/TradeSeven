// Vercel Serverless Function - Historical OHLCV Data
// Endpoint: /api/stocks/historical?symbol=AAPL&timeframe=1d
// Timeframes: 1h (hourly), 1d (daily), 1w (weekly)

import { applySecurityMiddleware } from '../_utils/security.js';

// Timeframe configuration
const TIMEFRAME_CONFIG = {
  '1m': {
    endpoint: 'intraday',
    interval: '1m',
    days: 1,          // Full day of 1-minute data; frontend slices to last 60 candles
    description: '1-minute intraday'
  },
  '1h': {
    endpoint: 'intraday',
    interval: '1h',
    days: 10,        // 10 days of hourly data (~70 candles)
    description: '10-day hourly'
  },
  '1d': {
    endpoint: 'eod',
    interval: null,
    days: 180,       // 6 months of daily data (~126 candles)
    description: '6-month daily'
  },
  '1w': {
    endpoint: 'eod',
    interval: null,
    days: 1095,      // 3 years of data to aggregate (~156 weekly candles)
    description: '3-year weekly'
  }
};

/**
 * Compute the from/to Unix timestamps for 1-minute spectate data.
 * - Crypto: always last 60 minutes (24/7 market)
 * - Stocks during market hours (9:30-16:00 ET): last 60 minutes from now
 * - Stocks after hours / weekends: 15:00-16:00 ET on the last trading day
 */
function getSpectateTimeRange(isCrypto) {
  const now = new Date();
  const nowUnix = Math.floor(now.getTime() / 1000);

  if (isCrypto) {
    return { from: nowUnix - 3600, to: nowUnix };
  }

  // Get the UTC-to-ET offset (handles DST automatically)
  const utcStr = now.toLocaleString('en-US', { timeZone: 'UTC' });
  const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const etOffsetMs = new Date(etStr).getTime() - new Date(utcStr).getTime();

  // Current time expressed as ET (store in UTC fields for easy math)
  const etNow = new Date(now.getTime() + etOffsetMs);
  const etHour = etNow.getUTCHours();
  const etMinute = etNow.getUTCMinutes();
  const etTimeMin = etHour * 60 + etMinute;
  const etDow = etNow.getUTCDay(); // 0=Sun, 6=Sat

  const marketOpen = 9 * 60 + 30;  // 570
  const marketClose = 16 * 60;     // 960
  const isWeekday = etDow >= 1 && etDow <= 5;
  const isMarketHours = isWeekday && etTimeMin >= marketOpen && etTimeMin <= marketClose;

  if (isMarketHours) {
    return { from: nowUnix - 3600, to: nowUnix };
  }

  // After hours: find last trading day's final hour (3:00-4:00 PM ET)
  const targetET = new Date(etNow);

  // Before market open on a weekday → use previous day
  if (isWeekday && etTimeMin < marketOpen) {
    targetET.setUTCDate(targetET.getUTCDate() - 1);
  }
  // Adjust weekends to Friday
  const targetDow = targetET.getUTCDay();
  if (targetDow === 0) targetET.setUTCDate(targetET.getUTCDate() - 2); // Sun → Fri
  if (targetDow === 6) targetET.setUTCDate(targetET.getUTCDate() - 1); // Sat → Fri

  // Full trading session 9:30 AM – 4:00 PM ET on last trading day
  // (widened from 3-4 PM — EODHD may not retain 1m data for narrow after-hours windows)
  const fromET = new Date(targetET);
  fromET.setUTCHours(9, 30, 0, 0);
  const toET = new Date(targetET);
  toET.setUTCHours(16, 0, 0, 0);

  // Convert back from ET representation to real UTC
  return {
    from: Math.floor((fromET.getTime() - etOffsetMs) / 1000),
    to: Math.floor((toET.getTime() - etOffsetMs) / 1000),
  };
}

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

  const { symbol, timeframe = '1d', days, type, from: qFrom, to: qTo } = req.query;

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

    // Determine EODHD symbol suffix based on asset type
    const isCrypto = type === 'crypto';
    const eohdSymbol = isCrypto ? `${upperSymbol}-USD.CC` : `${upperSymbol}.US`;

    // Use custom days if provided, otherwise use config default
    const numDays = days ? Math.min(parseInt(days, 10), 1095) : config.days;

    console.log(`[API] Fetching ${config.description} OHLCV for: ${upperSymbol} (${numDays} days)`);

    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - numDays);
    const fromDate = startDate.toISOString().split('T')[0];

    // For 1m spectate: use query params from/to if provided, else smart time range
    // For 1h: use startDate as before
    let intradayFromTs, intradayToTs;
    if (qFrom) {
      intradayFromTs = parseInt(qFrom, 10);
      intradayToTs = qTo ? parseInt(qTo, 10) : null;
    } else if (timeframe === '1m') {
      const range = getSpectateTimeRange(isCrypto);
      intradayFromTs = range.from;
      intradayToTs = range.to;
    } else {
      intradayFromTs = Math.floor(startDate.getTime() / 1000);
      intradayToTs = null;
    }

    let data;
    let actualTimeframe = timeframe; // Track if we fell back to a different timeframe
    let fallbackMessage = null;

    if (config.endpoint === 'intraday') {
      // Fetch intraday data from EODHD (1h or 1m)
      let intradayUrl = `https://eodhd.com/api/intraday/${eohdSymbol}?api_token=${API_KEY}&fmt=json&interval=${config.interval}&from=${intradayFromTs}`;
      if (intradayToTs) intradayUrl += `&to=${intradayToTs}`;
      console.log(`[API] Fetching intraday from: ${intradayUrl.replace(API_KEY, 'HIDDEN')}`);
      if (timeframe === '1m') {
        console.log(`[API] 1m from/to: { from: ${intradayFromTs}, to: ${intradayToTs}, fromDate: ${new Date(intradayFromTs * 1000).toISOString()}, toDate: ${intradayToTs ? new Date(intradayToTs * 1000).toISOString() : 'null'} }`);
      }

      const response = await fetch(intradayUrl);

      if (!response.ok) {
        if (timeframe === '1m') {
          // Don't fall back to daily for 1m — daily candles are useless for spectate
          console.warn(`[API] Intraday 1m API error (${response.status}) for ${upperSymbol}, no fallback`);
          data = [];
        } else {
          // Fallback to daily if hourly not available
          console.warn(`[API] Intraday API error (${response.status}) for ${upperSymbol}, falling back to daily`);
          actualTimeframe = '1d';
          fallbackMessage = 'Hourly data not available, showing daily';
          const fallbackResponse = await fetch(
            `https://eodhd.com/api/eod/${eohdSymbol}?api_token=${API_KEY}&fmt=json&period=d&order=d&from=${fromDate}`
          );
          if (!fallbackResponse.ok) {
            throw new Error(`EODHD API responded with ${fallbackResponse.status}`);
          }
          data = await fallbackResponse.json();
        }
      } else {
        const intradayData = await response.json();
        console.log(`[API] Intraday response type: ${typeof intradayData}, isArray: ${Array.isArray(intradayData)}, length: ${intradayData?.length || 0}`);

        // Check if intraday data is valid and non-empty
        if (!Array.isArray(intradayData) || intradayData.length === 0) {
          if (timeframe === '1m') {
            // 1m empty — try 5m as server-side fallback
            console.warn(`[API] Intraday 1m data empty for ${upperSymbol}, trying 5m fallback`);
            const url5m = `https://eodhd.com/api/intraday/${eohdSymbol}?api_token=${API_KEY}&fmt=json&interval=5m&from=${intradayFromTs}${intradayToTs ? `&to=${intradayToTs}` : ''}`;
            try {
              const resp5m = await fetch(url5m);
              const data5m = resp5m.ok ? await resp5m.json() : [];
              if (Array.isArray(data5m) && data5m.length > 0) {
                console.log(`[API] 5m fallback returned ${data5m.length} candles for ${upperSymbol}`);
                // Use intradayData variable to proceed through the transform pipeline below
                // by reassigning and letting the code fall through to the transform block
                data = data5m
                  .filter(c => c && c.timestamp != null && c.open != null && c.high != null && c.low != null && c.close != null)
                  .map(c => {
                    const dt = new Date(c.timestamp * 1000);
                    return {
                      date: dt.toISOString(),
                      datetime: dt.toISOString(),
                      timestamp: c.timestamp,
                      open: parseFloat(c.open) || 0,
                      high: parseFloat(c.high) || 0,
                      low: parseFloat(c.low) || 0,
                      close: parseFloat(c.close) || 0,
                      volume: parseInt(c.volume, 10) || 0
                    };
                  })
                  .sort((a, b) => b.timestamp - a.timestamp);
                fallbackMessage = '5-minute data (1-minute not available)';
              } else {
                console.warn(`[API] 5m fallback also empty for ${upperSymbol}`);
                data = [];
              }
            } catch (e5m) {
              console.warn(`[API] 5m fallback error for ${upperSymbol}:`, e5m.message);
              data = [];
            }
          } else {
            console.warn(`[API] Intraday data empty or invalid for ${upperSymbol}, falling back to daily`);
            actualTimeframe = '1d';
            fallbackMessage = 'Hourly data not available, showing daily';
            const fallbackResponse = await fetch(
              `https://eodhd.com/api/eod/${eohdSymbol}?api_token=${API_KEY}&fmt=json&period=d&order=d&from=${fromDate}`
            );
            if (!fallbackResponse.ok) {
              throw new Error(`EODHD API responded with ${fallbackResponse.status}`);
            }
            data = await fallbackResponse.json();
          }
        } else {
          // Transform intraday format to match daily format
          // Filter out any candles with null/undefined values
          // IMPORTANT: For intraday, preserve full datetime, not just date!
          console.log('[API] Raw EODHD intraday sample:', JSON.stringify(intradayData[0], null, 2));

          data = intradayData
            .filter(candle =>
              candle &&
              candle.timestamp != null &&
              candle.open != null &&
              candle.high != null &&
              candle.low != null &&
              candle.close != null
            )
            .map(candle => {
              // EODHD returns timestamp in seconds, convert to full ISO datetime
              const dt = new Date(candle.timestamp * 1000);
              return {
                // For intraday: use full ISO datetime string to preserve hours
                date: dt.toISOString(), // Full datetime: '2026-01-26T14:00:00.000Z'
                datetime: dt.toISOString(), // Explicit datetime field
                timestamp: candle.timestamp, // Also include original Unix timestamp
                open: parseFloat(candle.open) || 0,
                high: parseFloat(candle.high) || 0,
                low: parseFloat(candle.low) || 0,
                close: parseFloat(candle.close) || 0,
                volume: parseInt(candle.volume, 10) || 0
              };
            })
            .sort((a, b) => b.timestamp - a.timestamp); // Newest first, sort by timestamp

          console.log(`[API] Processed ${data.length} valid intraday candles`);
          if (data.length > 0) {
            console.log('[API] Processed intraday sample:', JSON.stringify(data[0], null, 2));
          }

          // If all candles were filtered out, fall back to daily (try 5m for 1m first)
          if (data.length === 0) {
            if (timeframe === '1m') {
              console.warn(`[API] All 1m candles filtered out for ${upperSymbol}, trying 5m fallback`);
              try {
                const url5m = `https://eodhd.com/api/intraday/${eohdSymbol}?api_token=${API_KEY}&fmt=json&interval=5m&from=${intradayFromTs}${intradayToTs ? `&to=${intradayToTs}` : ''}`;
                const resp5m = await fetch(url5m);
                const data5m = resp5m.ok ? await resp5m.json() : [];
                if (Array.isArray(data5m) && data5m.length > 0) {
                  data = data5m
                    .filter(c => c && c.timestamp != null && c.open != null && c.high != null && c.low != null && c.close != null)
                    .map(c => {
                      const dt = new Date(c.timestamp * 1000);
                      return { date: dt.toISOString(), datetime: dt.toISOString(), timestamp: c.timestamp, open: parseFloat(c.open) || 0, high: parseFloat(c.high) || 0, low: parseFloat(c.low) || 0, close: parseFloat(c.close) || 0, volume: parseInt(c.volume, 10) || 0 };
                    })
                    .sort((a, b) => b.timestamp - a.timestamp);
                  fallbackMessage = '5-minute data (1-minute not available)';
                }
              } catch { /* 5m fallback failed, data stays [] */ }
            } else {
              console.warn(`[API] All intraday candles had null values, falling back to daily`);
              actualTimeframe = '1d';
              fallbackMessage = 'Hourly data not available, showing daily';
              const fallbackResponse = await fetch(
                `https://eodhd.com/api/eod/${eohdSymbol}?api_token=${API_KEY}&fmt=json&period=d&order=d&from=${fromDate}`
              );
              if (!fallbackResponse.ok) {
                throw new Error(`EODHD API responded with ${fallbackResponse.status}`);
              }
              data = await fallbackResponse.json();
            }
          }
        }
      }
    } else {
      // Fetch daily EOD data from EODHD
      const response = await fetch(
        `https://eodhd.com/api/eod/${eohdSymbol}?api_token=${API_KEY}&fmt=json&period=d&order=d&from=${fromDate}`
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
      // For 1m spectate: return success with empty data (market may be closed)
      if (timeframe === '1m') {
        return res.status(200).json({
          success: true,
          symbol: upperSymbol,
          timeframe: '1m',
          requestedTimeframe: '1m',
          description: config.description,
          count: 0,
          data: []
        });
      }
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

    console.log(`[API] Returning ${ohlcv.length} ${actualTimeframe} OHLCV candles for ${upperSymbol}`);

    const responseConfig = TIMEFRAME_CONFIG[actualTimeframe] || config;
    return res.status(200).json({
      success: true,
      symbol: upperSymbol,
      timeframe: actualTimeframe,
      requestedTimeframe: timeframe,
      description: responseConfig.description,
      fallbackMessage: fallbackMessage,
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
