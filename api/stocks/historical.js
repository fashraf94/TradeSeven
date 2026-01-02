// Vercel Serverless Function - Historical Stock Prices
// Endpoint: /api/stocks/historical?symbol=AAPL&days=180

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { symbol, days = '180' } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Missing symbol parameter' });
  }

  const API_KEY = process.env.EODHD_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'API not configured' });
  }

  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const url = `https://eodhd.com/api/eod/${symbol}.US?api_token=${API_KEY}&from=${startDate}&to=${endDate}&fmt=json`;

    console.log(`[API] Fetching historical prices for ${symbol}, ${days} days`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`EODHD responded with ${response.status}`);
    }

    const data = await response.json();

    return res.status(200).json({
      success: true,
      symbol,
      data,
      count: Array.isArray(data) ? data.length : 0
    });

  } catch (error) {
    console.error('[API] Historical prices error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch historical prices',
      message: error.message
    });
  }
}
