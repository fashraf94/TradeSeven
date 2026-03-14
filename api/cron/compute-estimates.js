// api/cron/compute-estimates.js
// Saturday cron: fetches forward earnings estimates from EODHD for all stocks,
// computes per-stock derived metrics (RSR, EMS, surprise streaks),
// computes per-sector diffusion scores, and caches to Firestore.
//
// Schedule: 0 10 * * 6 (UTC 10:00 = ET 6:00 AM, Saturday)
//
// Flow:
//   Phase A: Fetch EODHD Trends + Earnings History
//   Phase B: Compute per-stock metrics (RSR, EMS, surprises, spreads)
//   Phase C: Compute per-sector diffusion scores
//   Phase D: Compute EMS percentiles within sectors
//   Phase E: Persist to Firestore (estimatesCache/latest)

export const config = { maxDuration: 180 };

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  STOCK_UNIVERSE,
  ALL_TICKERS,
  TICKER_TO_SECTOR,
} from '../_utils/rankingConfig.js';

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const LOG_PREFIX = '[EstimatesCron]';

function logInfo(message, data = null) {
  const ts = new Date().toISOString();
  if (data) console.log(`${ts} ${LOG_PREFIX} ${message}`, JSON.stringify(data));
  else console.log(`${ts} ${LOG_PREFIX} ${message}`);
}

function logWarn(message, data = null) {
  const ts = new Date().toISOString();
  if (data) console.warn(`${ts} ${LOG_PREFIX} ${message}`, JSON.stringify(data));
  else console.warn(`${ts} ${LOG_PREFIX} ${message}`);
}

function logError(message, data = null) {
  const ts = new Date().toISOString();
  if (data) console.error(`${ts} ${LOG_PREFIX} ${message}`, JSON.stringify(data));
  else console.error(`${ts} ${LOG_PREFIX} ${message}`);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getFirebaseAdmin() {
  if (getApps().length === 0) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

const API_BASE = 'https://eodhd.com/api';
const CHUNK_SIZE = 30;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

// ---------------------------------------------------------------------------
// Phase A: Fetch EODHD Data
// ---------------------------------------------------------------------------

/**
 * Fetch trends data for all tickers in chunks.
 * Returns Map: ticker → { '0q': entry, '+1q': entry, '0y': entry, '+1y': entry }
 */
async function fetchWithRetry(url, label, extractKey) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        logWarn(`${label} HTTP ${res.status} (attempt ${attempt + 1}): ${body.slice(0, 200)}`);
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        return null;
      }
      const raw = await res.json();
      // EODHD may return a flat array or a wrapper object like
      // { type: "Trends", trends: [[...], [...]] } or { type: "Earnings", earnings: [...] }
      let data;
      if (Array.isArray(raw)) {
        data = raw;
      } else if (extractKey && raw && Array.isArray(raw[extractKey])) {
        // trends comes as array-of-arrays, earnings as flat array
        data = raw[extractKey].flat();
      } else {
        logWarn(`${label} could not extract array (attempt ${attempt + 1}): ${typeof raw} — ${JSON.stringify(raw).slice(0, 300)}`);
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        return null;
      }
      return data;
    } catch (err) {
      logWarn(`${label} error (attempt ${attempt + 1}): ${err.message}`);
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      return null;
    }
  }
  return null;
}

function normalizeEodhdTicker(code) {
  // EODHD returns codes like "AAPL.US" or "BRK-B.US"
  // Strip the .US suffix, then convert hyphens to dots (BRK-B → BRK.B)
  return code.replace(/\.US$/i, '').replace(/-/g, '.');
}

async function fetchAllTrends(apiKey) {
  const trendsMap = {};

  for (let i = 0; i < ALL_TICKERS.length; i += CHUNK_SIZE) {
    const chunk = ALL_TICKERS.slice(i, i + CHUNK_SIZE);
    const chunkIdx = i / CHUNK_SIZE + 1;
    const symbols = chunk.map(t => `${t.replace(/\./g, '-')}.US`).join(',');
    const url = `${API_BASE}/calendar/trends?symbols=${symbols}&api_token=${apiKey}&fmt=json`;

    const data = await fetchWithRetry(url, `Trends chunk ${chunkIdx}`, 'trends');
    if (!data) continue;

    for (const entry of data) {
      const code = entry.code;
      if (!code) continue;
      const ticker = normalizeEodhdTicker(code);
      if (!trendsMap[ticker]) trendsMap[ticker] = {};
      trendsMap[ticker][entry.period] = entry;
    }

    logInfo(`Trends chunk ${chunkIdx}: ${data.length} entries`);
    if (i + CHUNK_SIZE < ALL_TICKERS.length) await sleep(500);
  }

  return trendsMap;
}

/**
 * Fetch earnings history for all tickers in chunks.
 * Returns Map: ticker → [{ date, actual, estimate, difference }, ...] sorted by date desc.
 */
async function fetchAllEarnings(apiKey) {
  const earningsMap = {};

  // Use a 2-year lookback for earnings history (covers ~8 quarters)
  const now = new Date();
  const fromDate = new Date(now);
  fromDate.setFullYear(now.getFullYear() - 2);
  const from = fromDate.toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);

  for (let i = 0; i < ALL_TICKERS.length; i += CHUNK_SIZE) {
    const chunk = ALL_TICKERS.slice(i, i + CHUNK_SIZE);
    const chunkIdx = i / CHUNK_SIZE + 1;
    const symbols = chunk.map(t => `${t.replace(/\./g, '-')}.US`).join(',');
    const url = `${API_BASE}/calendar/earnings?symbols=${symbols}&from=${from}&to=${to}&api_token=${apiKey}&fmt=json`;

    const data = await fetchWithRetry(url, `Earnings chunk ${chunkIdx}`, 'earnings');
    if (!data) continue;

    for (const entry of data) {
      const code = entry.code;
      if (!code) continue;
      const ticker = normalizeEodhdTicker(code);
      if (!earningsMap[ticker]) earningsMap[ticker] = [];
      earningsMap[ticker].push({
        date: entry.date || entry.report_date,
        actual: entry.actual != null ? Number(entry.actual) : null,
        estimate: entry.estimate != null ? Number(entry.estimate) : null,
        difference: entry.difference != null ? Number(entry.difference) : null,
      });
    }

    logInfo(`Earnings chunk ${chunkIdx}: ${data.length} entries`);
    if (i + CHUNK_SIZE < ALL_TICKERS.length) await sleep(500);
  }

  // Sort each ticker's earnings by date descending (most recent first)
  for (const ticker of Object.keys(earningsMap)) {
    earningsMap[ticker].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  return earningsMap;
}

// ---------------------------------------------------------------------------
// Phase B: Compute Per-Stock Metrics
// ---------------------------------------------------------------------------

function computeRSR(entry) {
  const up = entry?.epsRevisionsUpLast30days ?? 0;
  const down = entry?.epsRevisionsDownLast30days ?? 0;
  const total = up + down;
  return total > 0 ? up / total : null;
}

function computeEMS(entry) {
  const current = entry?.epsTrendCurrent;
  const ago30 = entry?.epsTrend30daysAgo;
  if (current == null || ago30 == null || ago30 === 0) return null;
  return ((current - ago30) / Math.abs(ago30)) * 100;
}

function computeSurpriseStreak(earnings) {
  if (!earnings || earnings.length === 0) return 0;
  let streak = 0;
  for (const e of earnings) {
    if (e.actual != null && e.estimate != null && e.actual > e.estimate) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function computeAvgSurprise(earnings) {
  if (!earnings || earnings.length === 0) return null;
  const recent = earnings.slice(0, 4);
  const surprises = [];
  for (const e of recent) {
    if (e.actual != null && e.estimate != null && e.estimate !== 0) {
      surprises.push(((e.actual - e.estimate) / Math.abs(e.estimate)) * 100);
    }
  }
  if (surprises.length === 0) return null;
  return Math.round((surprises.reduce((a, b) => a + b, 0) / surprises.length) * 100) / 100;
}

function computeSpread(entry) {
  const high = entry?.earningsEstimateHigh;
  const low = entry?.earningsEstimateLow;
  const avg = entry?.earningsEstimateAvg;
  if (high == null || low == null || avg == null || avg === 0) return null;
  return Math.round(((high - low) / Math.abs(avg)) * 10000) / 100;
}

function extractForwardEstimate(entry) {
  if (!entry) return null;
  return {
    avg: entry.earningsEstimateAvg ?? null,
    high: entry.earningsEstimateHigh ?? null,
    low: entry.earningsEstimateLow ?? null,
    numAnalysts: entry.earningsEstimateNumberOfAnalysts ?? null,
    growth: entry.earningsEstimateGrowth ?? null,
  };
}

function computeStockMetrics(ticker, trendsMap, earningsMap) {
  const trends = trendsMap[ticker];
  const earnings = earningsMap[ticker] || null;

  if (!trends) {
    return {
      rsr: null,
      ems: null,
      emsPercentile: null,
      earningsEstimateNumberOfAnalysts: null,
      epsRevisionsUpLast30days: null,
      epsRevisionsDownLast30days: null,
      surpriseStreak: earnings ? computeSurpriseStreak(earnings) : 0,
      avgSurprise: earnings ? computeAvgSurprise(earnings) : null,
      estimateSpread: { currentQtr: null, currentYear: null },
      forwardEstimates: {
        currentQtr: null,
        nextQtr: null,
        currentYear: null,
        nextYear: null,
      },
    };
  }

  const entry0y = trends['0y'] || null;
  const entry0q = trends['0q'] || null;
  const entry1q = trends['+1q'] || null;
  const entry1y = trends['+1y'] || null;

  return {
    rsr: computeRSR(entry0y),
    ems: computeEMS(entry0y),
    emsPercentile: null, // computed in Phase D
    earningsEstimateNumberOfAnalysts: entry0y?.earningsEstimateNumberOfAnalysts ?? null,
    epsRevisionsUpLast30days: entry0y?.epsRevisionsUpLast30days ?? null,
    epsRevisionsDownLast30days: entry0y?.epsRevisionsDownLast30days ?? null,
    surpriseStreak: computeSurpriseStreak(earnings),
    avgSurprise: computeAvgSurprise(earnings),
    estimateSpread: {
      currentQtr: computeSpread(entry0q),
      currentYear: computeSpread(entry0y),
    },
    forwardEstimates: {
      currentQtr: extractForwardEstimate(entry0q),
      nextQtr: extractForwardEstimate(entry1q),
      currentYear: extractForwardEstimate(entry0y),
      nextYear: extractForwardEstimate(entry1y),
    },
  };
}

// ---------------------------------------------------------------------------
// Phase C: Sector Diffusion
// ---------------------------------------------------------------------------

function computeSectorDiffusion(stocks) {
  const sectorDiffusion = {};

  for (const [sectorId, sectorDef] of Object.entries(STOCK_UNIVERSE)) {
    let up = 0, down = 0, flat = 0;

    for (const ticker of sectorDef.stocks) {
      const stockData = stocks[ticker];
      const revisionsUp = stockData?.epsRevisionsUpLast30days ?? 0;
      const revisionsDown = stockData?.epsRevisionsDownLast30days ?? 0;
      const net = revisionsUp - revisionsDown;

      if (net > 0) up++;
      else if (net < 0) down++;
      else flat++;
    }

    const total = sectorDef.stocks.length;
    sectorDiffusion[sectorId] = {
      diffusion: total > 0 ? Math.round(((up - down) / total) * 10000) / 100 : 0,
      stocksUp: up,
      stocksDown: down,
      stocksFlat: flat,
      total,
    };
  }

  return sectorDiffusion;
}

// ---------------------------------------------------------------------------
// Phase D: EMS Percentiles
// ---------------------------------------------------------------------------

function computeEMSPercentiles(stocks) {
  for (const [sectorId, sectorDef] of Object.entries(STOCK_UNIVERSE)) {
    // Collect tickers with non-null EMS
    const emsEntries = [];
    for (const ticker of sectorDef.stocks) {
      const stockData = stocks[ticker];
      if (stockData?.ems != null) {
        emsEntries.push({ ticker, ems: stockData.ems });
      }
    }

    // Sort descending by EMS (highest = rank 1)
    emsEntries.sort((a, b) => b.ems - a.ems);

    const totalPeers = emsEntries.length;
    for (let rank = 0; rank < emsEntries.length; rank++) {
      const ticker = emsEntries[rank].ticker;
      if (totalPeers <= 1) {
        stocks[ticker].emsPercentile = 50;
      } else {
        stocks[ticker].emsPercentile = Math.round(((totalPeers - 1 - rank) / (totalPeers - 1)) * 100);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  const startTime = Date.now();

  // Auth check
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (req.method === 'GET' && !isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const API_KEY = process.env.EODHD_API_KEY;
  if (!API_KEY) {
    logError('EODHD_API_KEY not configured');
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const db = getFirebaseAdmin();

    logInfo(`Estimates cron started — ${ALL_TICKERS.length} stocks across ${Object.keys(STOCK_UNIVERSE).length} sectors`);

    // ===== PHASE A: FETCH DATA =====

    // Fetch sequentially to avoid EODHD rate limits
    const trendsMap = await fetchAllTrends(API_KEY);
    logInfo(`Trends fetch complete, starting earnings fetch...`);
    const earningsMap = await fetchAllEarnings(API_KEY);

    const trendsCount = Object.keys(trendsMap).length;
    const earningsCount = Object.keys(earningsMap).length;
    logInfo(`Fetched trends for ${trendsCount} stocks, earnings history for ${earningsCount} stocks`);

    if (trendsCount < 50) {
      logError(`Too few trends fetched (${trendsCount}) — aborting`);
      return res.status(500).json({
        error: 'Insufficient data',
        message: `Only ${trendsCount} of ${ALL_TICKERS.length} trends fetched`,
      });
    }

    // ===== PHASE B: COMPUTE PER-STOCK METRICS =====

    const stocks = {};
    let withTrends = 0;

    for (const ticker of ALL_TICKERS) {
      stocks[ticker] = computeStockMetrics(ticker, trendsMap, earningsMap);
      if (trendsMap[ticker]) withTrends++;
    }

    logInfo(`Computed metrics for ${ALL_TICKERS.length} stocks (${withTrends} with trends data)`);

    // ===== PHASE C: SECTOR DIFFUSION =====

    const sectorDiffusion = computeSectorDiffusion(stocks);
    logInfo(`Computed diffusion for ${Object.keys(sectorDiffusion).length} sectors`);

    // ===== PHASE D: EMS PERCENTILES =====

    computeEMSPercentiles(stocks);

    // ===== PHASE E: PERSIST TO FIRESTORE =====

    const payload = {
      computedAt: new Date().toISOString(),
      stockCount: Object.keys(stocks).length,
      stocks,
      sectorDiffusion,
    };

    await db.collection('estimatesCache').doc('latest').set(payload);
    logInfo(`Persisted to estimatesCache/latest: ${payload.stockCount} stocks`);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logInfo(`Estimates cron complete in ${elapsed}s`);

    return res.status(200).json({
      success: true,
      message: `Estimates computed in ${elapsed}s`,
      stats: {
        stocksTotal: ALL_TICKERS.length,
        stocksWithTrends: withTrends,
        stocksWithEarnings: earningsCount,
        sectors: Object.keys(sectorDiffusion).length,
        elapsedSeconds: parseFloat(elapsed),
      },
    });

  } catch (error) {
    logError(`Estimates cron failed: ${error.message}`);
    console.error(error.stack);
    return res.status(500).json({
      error: 'Estimates computation failed',
      message: error.message,
    });
  }
}
