// Vercel Serverless Function - Stock Prices (Consolidated)
// Handles both current prices and historical data
//
// Current prices: /api/stocks/prices?symbols=AAPL,MSFT,GOOGL
// Historical:     /api/stocks/prices?symbols=XLK&type=historical&days=180
// Technical SMA:  /api/stocks/prices?symbols=XLK&type=sma&period=50

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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
  if (type === 'historical') {
    return handleHistoricalRequest(req, res, symbols, days, API_KEY);
  }

  if (type === 'sma') {
    return handleSMARequest(req, res, symbols, period, API_KEY);
  }

  // Default: handle current prices
  return handleCurrentPrices(req, res, symbols, API_KEY);
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

    dataArray.forEach(item => {
      if (item && item.code) {
        const symbol = item.code.replace('.US', '');
        prices[symbol] = {
          price: item.close || item.previousClose || 0,
          change: item.change || 0,
          changePercent: item.change_p || 0,
          high: item.high,
          low: item.low,
          volume: item.volume
        };
      }
    });

    return res.status(200).json({
      success: true,
      prices,
      count: Object.keys(prices).length
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
 * Handle SMA (Simple Moving Average) requests
 * GET /api/stocks/prices?symbols=XLK&type=sma&period=50
 */
async function handleSMARequest(req, res, symbols, period, API_KEY) {
  try {
    const symbol = symbols.split(',')[0].trim().toUpperCase();
    const periodNum = parseInt(period, 10) || 50;

    const url = `https://eodhd.com/api/technical/${symbol}.US?api_token=${API_KEY}&function=sma&period=${periodNum}&fmt=json`;

    console.log(`[API] Fetching SMA(${periodNum}) for ${symbol}`);

    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[API] EODHD SMA error: ${response.status}`);
      return res.status(response.status).json({
        success: false,
        error: 'EODHD API error',
        status: response.status
      });
    }

    const data = await response.json();

    // Get the latest SMA value
    const latestValue = Array.isArray(data) && data.length > 0
      ? data[data.length - 1]?.sma || null
      : null;

    return res.status(200).json({
      success: true,
      symbol,
      indicator: 'sma',
      period: periodNum,
      value: latestValue,
      data: data.slice(-10) // Return last 10 data points
    });

  } catch (error) {
    console.error('[API] SMA error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch SMA',
      message: error.message
    });
  }
}
