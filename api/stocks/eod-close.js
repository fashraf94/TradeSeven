// Vercel Serverless Function - EOD Close Price
// Returns the most recent official closing price for a stock symbol
// using EODHD's End-of-Day endpoint (settlement close, not 15-min-delayed real-time).
//
// Usage: /api/stocks/eod-close?symbol=AAPL

import { applySecurityMiddleware } from '../_utils/security.js';

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 100, windowMs: 60000 } })) {
    return;
  }

  const { symbol } = req.query;
  if (!symbol) {
    return res.status(400).json({ error: 'symbol parameter required' });
  }

  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const normalizedSymbol = symbol.trim().toUpperCase().replace(/\.US$/i, '');
    const url = `https://eodhd.com/api/eod/${encodeURIComponent(normalizedSymbol)}.US?order=d&limit=1&fmt=json&api_token=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`EODHD returned ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(404).json({ error: 'No EOD data found', symbol: normalizedSymbol });
    }

    const latest = data[0];

    // Cache EOD data aggressively — it doesn't change after market close
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');

    return res.status(200).json({
      symbol: normalizedSymbol,
      date: latest.date,
      close: latest.close,
      adjusted_close: latest.adjusted_close,
      volume: latest.volume,
    });
  } catch (err) {
    console.error(`[eod-close] Error fetching ${symbol}:`, err.message);
    return res.status(500).json({ error: 'Failed to fetch EOD data', symbol });
  }
}
