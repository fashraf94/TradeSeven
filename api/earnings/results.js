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
import { getFromCache, setInCache, setCacheHeaders, CACHE_TIERS } from '../_utils/serverCache.js';
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
  const noCache = req.query?.nocache === '1';

  if (!symbol) {
    return res.status(400).json({ error: 'Symbol required' });
  }

  // Check cache before doing any work
  const cacheKey = `earnings_results_${symbol.toUpperCase()}_${date || 'latest'}`;
  if (!noCache) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      setCacheHeaders(res, CACHE_TIERS.EARNINGS.sMaxAge, CACHE_TIERS.EARNINGS.staleWhileRevalidate);
      return res.status(200).json(cached);
    }
  }

  // Use the shared helper function
  const result = await getEarningsResult(symbol, date);

  // Return appropriate status based on result
  if (result.error === 'API key not configured') {
    return res.status(500).json(result);
  }

  // Cache only successful responses
  if (result.success) {
    setInCache(cacheKey, result, CACHE_TIERS.EARNINGS.memoryTTL);
    setCacheHeaders(res, CACHE_TIERS.EARNINGS.sMaxAge, CACHE_TIERS.EARNINGS.staleWhileRevalidate);
  }

  return res.status(200).json(result);
}
