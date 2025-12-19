// Vercel Serverless Function - Stock-Specific News
// Endpoint: /api/news/stock?symbol=AAPL&limit=5
// EODHD Financial News API for ticker-specific news

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { symbol, symbols, limit = 5, offset = 0 } = req.query;

  if (!symbol && !symbols) {
    return res.status(400).json({ error: 'Missing symbol or symbols parameter' });
  }

  const API_KEY = process.env.EODHD_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'API not configured' });
  }

  try {
    // Handle single symbol or multiple symbols
    const symbolParam = symbol
      ? `${symbol.trim().toUpperCase()}.US`
      : symbols.split(',').map(s => `${s.trim().toUpperCase()}.US`).join(',');

    // EODHD News API with symbol filter
    const url = `https://eodhd.com/api/news?s=${symbolParam}&api_token=${API_KEY}&limit=${Math.min(parseInt(limit), 50)}&offset=${offset}&fmt=json`;

    console.log('[API] Fetching stock news for:', symbolParam);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`EODHD responded with ${response.status}`);
    }

    const data = await response.json();

    // Transform news items
    const news = (Array.isArray(data) ? data : [])
      .map((item, index) => ({
        id: item.title ? `news-${Date.now()}-${index}` : null,
        title: item.title || 'Untitled',
        summary: item.content ? item.content.substring(0, 250) + (item.content.length > 250 ? '...' : '') : '',
        source: item.source || 'Unknown',
        url: item.link || '#',
        publishedAt: item.date || new Date().toISOString(),
        symbols: item.symbols || [],
        tags: item.tags || [],
        sentiment: item.sentiment || null
      }))
      .filter(item => item.id !== null);

    console.log(`[API] Got ${news.length} stock news items for ${symbolParam}`);

    return res.status(200).json({
      success: true,
      news,
      count: news.length,
      symbol: symbol || symbols
    });

  } catch (error) {
    console.error('[API] Stock news error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch stock news',
      message: error.message
    });
  }
}
