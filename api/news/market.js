// Vercel Serverless Function - Market News
// Endpoint: /api/news/market?limit=10
// EODHD Financial News API for general market news

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { limit = 10, offset = 0 } = req.query;

  const API_KEY = process.env.EODHD_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'API not configured' });
  }

  try {
    // EODHD Financial News API - Get general market news
    // Using 's=AAPL.US' as a workaround to get general financial news
    // We'll filter for broad market topics
    const url = `https://eodhd.com/api/news?api_token=${API_KEY}&limit=${Math.min(parseInt(limit) * 3, 50)}&offset=${offset}&fmt=json`;

    console.log('[API] Fetching market news...');

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`EODHD responded with ${response.status}`);
    }

    const data = await response.json();

    // Transform and filter news items
    const news = (Array.isArray(data) ? data : [])
      .slice(0, parseInt(limit))
      .map((item, index) => ({
        id: item.title ? `news-${Date.now()}-${index}` : null,
        title: item.title || 'Untitled',
        summary: item.content ? item.content.substring(0, 300) + (item.content.length > 300 ? '...' : '') : '',
        source: item.source || 'Unknown',
        url: item.link || '#',
        publishedAt: item.date || new Date().toISOString(),
        symbols: item.symbols || [],
        tags: item.tags || [],
        sentiment: item.sentiment || null
      }))
      .filter(item => item.id !== null);

    console.log(`[API] Got ${news.length} market news items`);

    return res.status(200).json({
      success: true,
      news,
      count: news.length
    });

  } catch (error) {
    console.error('[API] Market news error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch market news',
      message: error.message
    });
  }
}
