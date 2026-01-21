// api/earnings/results.js
// Fetch actual earnings results from EODHD for tournament resolution
//
// Endpoint: GET /api/earnings/results?symbol=NVDA&date=2026-01-22
//
// Returns:
// - Actual EPS vs estimate (beat/miss)
// - Stock price move after earnings
// - Magnitude classification (upBig, up, flat, down, downBig)

import { applySecurityMiddleware } from '../_utils/security.js';
import { getEarningsResult } from './_helpers/getEarningsResult.js';

export default async function handler(req, res) {
  // Security middleware
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60000 } })) {
    return;
  }

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol, date } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Symbol required' });
  }

  // Use the shared helper function
  const result = await getEarningsResult(symbol, date);

  // Return appropriate status based on result
  if (result.error === 'API key not configured') {
    return res.status(500).json(result);
  }

  return res.status(200).json(result);
}
