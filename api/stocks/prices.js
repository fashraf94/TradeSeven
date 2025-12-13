// Vercel Serverless Function - Stock Prices
// Endpoint: /api/stocks/prices?symbols=AAPL,MSFT,GOOGL

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { symbols } = req.query;

  if (!symbols) {
    return res.status(400).json({ error: 'Missing symbols parameter' });
  }

  const API_KEY = process.env.EODHD_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'API not configured' });
  }

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
        const symbol = item.code.replace('.US', ''); // "AAPL.US" -> "AAPL"
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
