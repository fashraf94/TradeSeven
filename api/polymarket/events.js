// api/polymarket/events.js
// Proxy for Polymarket Gamma API to avoid CORS issues

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Forward all query parameters to Polymarket
    const queryString = new URL(req.url, `http://${req.headers.host}`).search;
    const polymarketUrl = `https://gamma-api.polymarket.com/events${queryString}`;

    console.log('[polymarket-proxy] Fetching:', polymarketUrl);

    const response = await fetch(polymarketUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MarketClash/1.0'
      }
    });

    if (!response.ok) {
      console.error('[polymarket-proxy] API error:', response.status, response.statusText);
      throw new Error(`Polymarket API error: ${response.status}`);
    }

    const data = await response.json();

    console.log('[polymarket-proxy] Returned', Array.isArray(data) ? data.length : 'non-array', 'results');

    // Cache for 1 minute (more real-time odds updates)
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

    return res.status(200).json(data);

  } catch (error) {
    console.error('[polymarket-proxy] Error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch from Polymarket',
      message: error.message
    });
  }
}
