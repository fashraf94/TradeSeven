// Vercel Serverless Function - Technical Indicators (SMA)
// Endpoint: /api/stocks/technical?symbol=AAPL&indicator=sma&period=50

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { symbol, indicator = 'sma', period = '50' } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Missing symbol parameter' });
  }

  const API_KEY = process.env.EODHD_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'API not configured' });
  }

  try {
    const url = `https://eodhd.com/api/technical/${symbol}.US?api_token=${API_KEY}&function=${indicator}&period=${period}&fmt=json`;

    console.log(`[API] Fetching ${indicator}(${period}) for ${symbol}`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`EODHD responded with ${response.status}`);
    }

    const data = await response.json();

    // Get the latest value
    const latestValue = Array.isArray(data) && data.length > 0
      ? data[data.length - 1]?.[indicator] || null
      : null;

    return res.status(200).json({
      success: true,
      symbol,
      indicator,
      period: parseInt(period),
      value: latestValue,
      data: data.slice(-10) // Return last 10 data points
    });

  } catch (error) {
    console.error('[API] Technical indicator error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch technical indicator',
      message: error.message
    });
  }
}
