// Vercel Serverless Function - Crypto Prices
// Endpoint: /api/crypto/prices?symbols=BTC,ETH,SOL

export default async function handler(req, res) {
  // Enable CORS for your frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { symbols } = req.query;

  if (!symbols) {
    return res.status(400).json({ error: 'Missing symbols parameter' });
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

    return res.status(200).json({
      success: true,
      prices,
      count: Object.keys(prices).length
    });

  } catch (error) {
    console.error('[API] Crypto prices error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch prices',
      message: error.message
    });
  }
}
