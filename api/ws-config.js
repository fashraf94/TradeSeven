// Vercel Serverless Function - WebSocket Configuration
// Returns WSS URLs with embedded API token for client-side WebSocket connections
// GET /api/ws-config → { stocksUrl, cryptoUrl }

import { applySecurityMiddleware } from './_utils/security.js';

export default async function handler(req, res) {
  // Apply security middleware (CORS, security headers, rate limiting, preflight)
  // Low limit — this endpoint is called once per session, not per symbol
  if (applySecurityMiddleware(req, res, {
    rateLimit: { limit: 10, windowMs: 60000 },
    strictOrigin: true,
  })) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const API_KEY = process.env.EODHD_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'API not configured' });
  }

  return res.status(200).json({
    stocksUrl: `wss://ws.eodhistoricaldata.com/ws/us?api_token=${API_KEY}`,
    cryptoUrl: `wss://ws.eodhistoricaldata.com/ws/crypto?api_token=${API_KEY}`,
  });
}
