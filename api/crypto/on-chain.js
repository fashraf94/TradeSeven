// Vercel Serverless Function - Bitcoin On-Chain Health Data
// Endpoint: /api/crypto/on-chain
// Data Source: BGeometrics (free, no auth required)
// Fetches Bitcoin on-chain metrics and returns consolidated health data

import { applySecurityMiddleware } from '../_utils/security.js';
import { getFromCache, setInCache, setCacheHeaders } from '../_utils/serverCache.js';

// Custom cache config for on-chain data (updates daily, cache aggressively)
// 4h memory TTL, 2h CDN, 1h stale-while-revalidate
const ONCHAIN_CACHE = { sMaxAge: 7200, staleWhileRevalidate: 3600, memoryTTL: 14400 };

const BGEOMETRICS_BASE = 'https://charts.bgeometrics.com/files';
const BGEOMETRICS_API = 'https://bitcoin-data.com/v1';

// Each metric has a primary source (static JSON files) and fallback (REST API)
// Data format varies: static files use [[timestamp, value], ...] or [{d, v}, ...]
const METRICS = {
  mvrv:            { file: 'mvrv.json',             apiFallbacks: ['mvrv-zscore', 'mvrv_zscore', 'mvrv'] },
  nupl:            { file: 'nupl.json',             apiFallbacks: ['nupl'] },
  fearGreed:       { file: 'fear_greed.json',       apiFallbacks: ['fear-greed'] },
  exchangeNetflow: { file: 'exchange_netflow.json', apiFallbacks: ['exchange-netflow', 'exchange_netflow'] },
  etfBalance:      { file: 'btc_etf.json',          apiFallbacks: ['etf'] },
  fundingRate:     { file: 'funding_rate.json',      apiFallbacks: ['funding-rate', 'funding_rate'] },
  openInterest:    { file: 'open_interest.json',     apiFallbacks: ['open-interest-futures', 'open-interest', 'open_interest'] },
  activeAddresses: { file: 'addresses_active.json',  apiFallbacks: ['active-addresses'] },
  whaleCoins:      { file: 'coin_10k_1k.json',      apiFallbacks: ['coins-whale'] },
  sharkCoins:      { file: 'coin_100_1000.json',     apiFallbacks: ['coins-shark'] },
  shrimpCoins:     { file: 'coin_1.json',            apiFallbacks: ['coins-shrimp'] },
};

export default async function handler(req, res) {
  // Apply security middleware (CORS, security headers, rate limiting, preflight)
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60000 } })) {
    return;
  }

  const noCache = req.query?.nocache === '1';
  const cacheKey = 'btc_onchain_health';

  // Check cache
  if (!noCache) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      setCacheHeaders(res, ONCHAIN_CACHE.sMaxAge, ONCHAIN_CACHE.staleWhileRevalidate);
      return res.status(200).json(cached);
    }
  }

  try {
    console.log('[API] Fetching Bitcoin on-chain health data from BGeometrics');

    // Fetch all metrics in parallel
    const results = await Promise.allSettled(
      Object.entries(METRICS).map(async ([key, config]) => {
        const data = await fetchMetricWithFallback(key, config);
        return { key, data };
      })
    );

    // Process results — extract latest values + trends
    const consolidated = {};
    let successCount = 0;

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.data) {
        const { key, data } = result.value;
        consolidated[key] = processMetric(key, data);
        successCount++;
      } else {
        const key = result.status === 'fulfilled' ? result.value.key : 'unknown';
        console.warn(`[API] On-chain metric ${key} failed:`, result.reason?.message || 'null data');
        consolidated[key] = { latest: null, change7d: null, change30d: null };
      }
    }

    // Add computed fields
    consolidated.overall = computeOverallVerdict(consolidated);
    consolidated.updatedAt = new Date().toISOString();
    consolidated.metricsAvailable = successCount;
    consolidated.metricsTotal = Object.keys(METRICS).length;

    console.log(`[API] On-chain health data: ${successCount}/${Object.keys(METRICS).length} metrics fetched`);

    const responseData = { success: true, ...consolidated };

    // Cache the result
    if (!noCache) {
      setInCache(cacheKey, responseData, ONCHAIN_CACHE.memoryTTL);
      setCacheHeaders(res, ONCHAIN_CACHE.sMaxAge, ONCHAIN_CACHE.staleWhileRevalidate);
    }

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('[API] On-chain data fetch error:', error.message);

    // Return cached data if available, even if stale
    const staleCache = getFromCache(cacheKey);
    if (staleCache) {
      return res.status(200).json({ ...staleCache, stale: true });
    }

    return res.status(500).json({
      error: 'Failed to fetch on-chain data',
      message: error.message
    });
  }
}

/**
 * Fetch a metric, trying the static JSON file first, then REST API fallbacks.
 */
async function fetchMetricWithFallback(key, config) {
  // Try primary source: static JSON files from charts.bgeometrics.com
  try {
    const url = `${BGEOMETRICS_BASE}/${config.file}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (response.ok) {
      const data = await response.json();
      if (data && (Array.isArray(data) ? data.length > 0 : true)) {
        return data;
      }
    }
  } catch (e) {
    console.warn(`[API] BGeometrics file ${config.file} failed: ${e.message}`);
  }

  // Try REST API fallbacks
  for (const path of config.apiFallbacks) {
    try {
      const url = `${BGEOMETRICS_API}/${path}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (response.ok) {
        const data = await response.json();
        if (data && (Array.isArray(data) ? data.length > 0 : true)) {
          return data;
        }
      }
    } catch (e) {
      // Continue to next fallback
    }
  }

  console.warn(`[API] All sources failed for metric: ${key}`);
  return null;
}

/**
 * Process raw metric data into a standardized format.
 * Handles both formats:
 * - Array of arrays: [[timestamp_ms, value], ...]
 * - Array of objects: [{ d: "YYYY-MM-DD", v: number }, ...]
 */
function processMetric(key, rawData) {
  if (!rawData || (Array.isArray(rawData) && rawData.length === 0)) {
    return { latest: null, change7d: null, change30d: null };
  }

  // Normalize data into { date, value } format
  let normalized;

  if (Array.isArray(rawData) && rawData.length > 0) {
    const first = rawData[0];

    if (Array.isArray(first)) {
      // Format: [[timestamp_ms, value], ...] or [[timestamp_s, value], ...]
      normalized = rawData
        .filter(entry => Array.isArray(entry) && entry.length >= 2 && entry[1] != null)
        .map(entry => {
          const ts = entry[0];
          // Detect seconds vs milliseconds (if ts < 1e12, it's seconds)
          const dateMs = ts < 1e12 ? ts * 1000 : ts;
          return {
            date: new Date(dateMs).toISOString().split('T')[0],
            value: typeof entry[1] === 'number' ? entry[1] : parseFloat(entry[1])
          };
        });
    } else if (typeof first === 'object') {
      // Format: [{ d: "YYYY-MM-DD", v: number }, ...] or [{ date: "...", value: ... }, ...]
      normalized = rawData
        .filter(entry => entry != null)
        .map(entry => ({
          date: entry.d || entry.date || '',
          value: entry.v ?? entry.value ?? null
        }))
        .filter(entry => entry.date && entry.value != null);
    } else {
      return { latest: null, change7d: null, change30d: null };
    }
  } else {
    return { latest: null, change7d: null, change30d: null };
  }

  if (normalized.length === 0) {
    return { latest: null, change7d: null, change30d: null };
  }

  // Sort newest first
  normalized.sort((a, b) => new Date(b.date) - new Date(a.date));

  const latest = normalized[0]?.value ?? null;
  const val7d = normalized.length > 7 ? (normalized[7]?.value ?? null) : null;
  const val30d = normalized.length > 30 ? (normalized[30]?.value ?? null) : null;

  return {
    latest,
    date: normalized[0]?.date,
    change7d: val7d != null && latest != null ? latest - val7d : null,
    change30d: val30d != null && latest != null ? latest - val30d : null,
    // Last 30 days for mini sparkline charts (ascending order)
    history: normalized.slice(0, 30).reverse().map(d => ({
      date: d.date,
      value: d.value
    }))
  };
}

/**
 * Compute an overall health verdict from the consolidated metrics.
 * Score ranges from -10 (very bearish) to +10 (very bullish).
 */
function computeOverallVerdict(data) {
  let score = 0;
  const factors = [];

  // MVRV Z-Score
  const mvrv = data.mvrv?.latest;
  if (mvrv != null) {
    if (mvrv < 0) { score += 3; factors.push({ metric: 'MVRV', signal: 'bullish', note: 'Below cost basis (undervalued)' }); }
    else if (mvrv < 1) { score += 2; factors.push({ metric: 'MVRV', signal: 'bullish', note: 'Near cost basis' }); }
    else if (mvrv < 3) { score += 0; factors.push({ metric: 'MVRV', signal: 'neutral', note: 'Fair value zone' }); }
    else if (mvrv < 7) { score -= 2; factors.push({ metric: 'MVRV', signal: 'bearish', note: 'Overheated' }); }
    else { score -= 3; factors.push({ metric: 'MVRV', signal: 'bearish', note: 'Extreme greed zone' }); }
  }

  // NUPL
  const nupl = data.nupl?.latest;
  if (nupl != null) {
    if (nupl < 0) { score += 2; factors.push({ metric: 'NUPL', signal: 'bullish', note: 'Capitulation' }); }
    else if (nupl < 0.25) { score += 1; factors.push({ metric: 'NUPL', signal: 'neutral', note: 'Hope/Anxiety' }); }
    else if (nupl < 0.5) { score += 0; factors.push({ metric: 'NUPL', signal: 'neutral', note: 'Optimism' }); }
    else if (nupl < 0.75) { score -= 1; factors.push({ metric: 'NUPL', signal: 'bearish', note: 'Belief/Thrill' }); }
    else { score -= 3; factors.push({ metric: 'NUPL', signal: 'bearish', note: 'Euphoria/Greed' }); }
  }

  // Exchange flows (negative netflow = bullish, money leaving exchanges)
  const netflow = data.exchangeNetflow?.latest;
  if (netflow != null) {
    if (netflow < -5000) { score += 2; factors.push({ metric: 'Exchange Flows', signal: 'bullish', note: 'Strong outflows (accumulation)' }); }
    else if (netflow < 0) { score += 1; factors.push({ metric: 'Exchange Flows', signal: 'bullish', note: 'Moderate outflows' }); }
    else if (netflow < 5000) { score -= 1; factors.push({ metric: 'Exchange Flows', signal: 'bearish', note: 'Moderate inflows' }); }
    else { score -= 2; factors.push({ metric: 'Exchange Flows', signal: 'bearish', note: 'Strong inflows (selling pressure)' }); }
  }

  // Funding Rate
  const funding = data.fundingRate?.latest;
  if (funding != null) {
    if (funding > 0.05) { score -= 2; factors.push({ metric: 'Funding Rate', signal: 'bearish', note: 'Extreme long leverage' }); }
    else if (funding > 0.01) { score -= 1; factors.push({ metric: 'Funding Rate', signal: 'bearish', note: 'Long bias' }); }
    else if (funding > -0.01) { score += 0; factors.push({ metric: 'Funding Rate', signal: 'neutral', note: 'Balanced' }); }
    else if (funding > -0.05) { score += 1; factors.push({ metric: 'Funding Rate', signal: 'bullish', note: 'Short bias (squeeze potential)' }); }
    else { score += 2; factors.push({ metric: 'Funding Rate', signal: 'bullish', note: 'Extreme short leverage (squeeze likely)' }); }
  }

  // Fear & Greed Index
  const fearGreed = data.fearGreed?.latest;
  if (fearGreed != null) {
    if (fearGreed < 20) { score += 2; factors.push({ metric: 'Fear & Greed', signal: 'bullish', note: 'Extreme fear (contrarian buy)' }); }
    else if (fearGreed < 40) { score += 1; factors.push({ metric: 'Fear & Greed', signal: 'bullish', note: 'Fear zone' }); }
    else if (fearGreed < 60) { score += 0; factors.push({ metric: 'Fear & Greed', signal: 'neutral', note: 'Neutral sentiment' }); }
    else if (fearGreed < 80) { score -= 1; factors.push({ metric: 'Fear & Greed', signal: 'bearish', note: 'Greed zone' }); }
    else { score -= 2; factors.push({ metric: 'Fear & Greed', signal: 'bearish', note: 'Extreme greed (contrarian sell)' }); }
  }

  // Map score to verdict
  let verdict, zone;
  if (score >= 4) { verdict = 'Strongly Bullish'; zone = 'green'; }
  else if (score >= 2) { verdict = 'Bullish'; zone = 'green'; }
  else if (score >= -1) { verdict = 'Neutral'; zone = 'yellow'; }
  else if (score >= -3) { verdict = 'Bearish'; zone = 'red'; }
  else { verdict = 'Strongly Bearish'; zone = 'red'; }

  return { score, verdict, zone, factors };
}
