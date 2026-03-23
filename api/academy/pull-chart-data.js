// api/academy/pull-chart-data.js
// Admin endpoint to pull EODHD historical OHLCV data for Academy KB entries.
//
// Usage:
//   POST /api/academy/pull-chart-data
//   Auth: Authorization: Bearer {CRON_SECRET} or X-Admin-Secret header or ?secret= query param
//
//   Single: { "ticker": "NVDA", "startDate": "2025-01-20", "endDate": "2025-02-05", "exchange": "US" }
//   Batch:  { "batch": [ { "ticker": "NVDA", ... }, { "ticker": "AAPL", ... } ] }

import { normalizeSymbolForEODHD } from '../_utils/symbolNormalize.js';

export const config = { maxDuration: 300 };

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const LOG_PREFIX = '[AcademyPull]';

function logInfo(message, data = null) {
  const ts = new Date().toISOString();
  if (data) console.log(`${ts} ${LOG_PREFIX} ${message}`, JSON.stringify(data));
  else console.log(`${ts} ${LOG_PREFIX} ${message}`);
}

function logError(message, data = null) {
  const ts = new Date().toISOString();
  if (data) console.error(`${ts} ${LOG_PREFIX} ${message}`, JSON.stringify(data));
  else console.error(`${ts} ${LOG_PREFIX} ${message}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateRequest(item) {
  const errors = [];
  if (!item.ticker || typeof item.ticker !== 'string') errors.push('ticker is required');
  if (!item.startDate || !DATE_RE.test(item.startDate)) errors.push('startDate is required (YYYY-MM-DD)');
  if (!item.endDate || !DATE_RE.test(item.endDate)) errors.push('endDate is required (YYYY-MM-DD)');
  if (item.startDate && item.endDate && item.startDate > item.endDate) errors.push('startDate must be before endDate');
  return errors;
}

function computeSummary(priceData) {
  if (!priceData.length) return null;

  const startPrice = priceData[0].close;
  const endPrice = priceData[priceData.length - 1].close;
  const highOfRange = Math.max(...priceData.map(d => d.high));
  const lowOfRange = Math.min(...priceData.map(d => d.low));
  const totalVolume = priceData.reduce((sum, d) => sum + d.volume, 0);
  const maxSingleDayVolume = Math.max(...priceData.map(d => d.volume));
  const pctChange = ((endPrice - startPrice) / startPrice * 100).toFixed(1);

  return {
    startPrice,
    endPrice,
    highOfRange,
    lowOfRange,
    totalVolume,
    maxSingleDayVolume,
    percentChange: `${pctChange}%`,
  };
}

// ---------------------------------------------------------------------------
// EODHD fetch
// ---------------------------------------------------------------------------

const DELAY_BETWEEN_CALLS_MS = 500;

async function fetchOHLCV(ticker, startDate, endDate, exchange = 'US') {
  const API_KEY = process.env.EODHD_API_KEY;
  if (!API_KEY) throw new Error('EODHD_API_KEY not configured');

  const symbol = normalizeSymbolForEODHD(ticker);
  const url = `https://eodhd.com/api/eod/${symbol}.${exchange}?from=${startDate}&to=${endDate}&period=d&api_token=${API_KEY}&fmt=json`;

  logInfo(`Fetching ${symbol}.${exchange} from ${startDate} to ${endDate}`);

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`EODHD responded with ${response.status}: ${text}`);
  }

  const raw = await response.json();

  // EODHD returns an array of { date, open, high, low, close, adjusted_close, volume }
  const priceData = (Array.isArray(raw) ? raw : [])
    .map(({ date, open, high, low, close, volume }) => ({ date, open, high, low, close, volume }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return priceData;
}

// ---------------------------------------------------------------------------
// Process a single pull request
// ---------------------------------------------------------------------------

async function processSingle(item) {
  const { ticker, startDate, endDate, exchange = 'US' } = item;

  const priceData = await fetchOHLCV(ticker, startDate, endDate, exchange);
  const summary = computeSummary(priceData);

  return {
    success: true,
    ticker,
    exchange,
    dateRange: { from: startDate, to: endDate },
    totalDays: priceData.length,
    priceData,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Auth: Bearer token, x-admin-secret header, or ?secret= query param
  const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  if (!adminSecret) {
    logError('No ADMIN_SECRET or CRON_SECRET configured');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const authHeader = req.headers.authorization;
  const providedSecret = req.headers['x-admin-secret'] || req.query.secret;
  const bearerMatch = authHeader === `Bearer ${adminSecret}`;
  const secretMatch = providedSecret === adminSecret;

  if (!bearerMatch && !secretMatch) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check EODHD key early
  if (!process.env.EODHD_API_KEY) {
    logError('EODHD_API_KEY not configured');
    return res.status(500).json({ error: 'API not configured' });
  }

  try {
    const body = req.body || {};

    // --- Batch mode ---
    if (Array.isArray(body.batch)) {
      logInfo(`Batch mode: ${body.batch.length} items`);
      const results = [];
      let totalErrors = 0;

      for (let i = 0; i < body.batch.length; i++) {
        const item = body.batch[i];
        const errors = validateRequest(item);
        if (errors.length) {
          results.push({ ticker: item.ticker || 'unknown', success: false, error: errors.join('; ') });
          totalErrors++;
          continue;
        }

        try {
          const result = await processSingle(item);
          results.push(result);
        } catch (err) {
          logError(`Batch item ${i} (${item.ticker}) failed`, { error: err.message });
          results.push({ ticker: item.ticker, success: false, error: err.message });
          totalErrors++;
        }

        // Delay between calls to respect EODHD rate limits
        if (i < body.batch.length - 1) {
          await sleep(DELAY_BETWEEN_CALLS_MS);
        }
      }

      return res.status(200).json({
        success: true,
        results,
        totalProcessed: body.batch.length,
        totalErrors,
      });
    }

    // --- Single mode ---
    const errors = validateRequest(body);
    if (errors.length) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    const result = await processSingle(body);
    logInfo(`Success: ${body.ticker} — ${result.totalDays} days returned`);
    return res.status(200).json(result);

  } catch (err) {
    logError('Unexpected error', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: err.message });
  }
}
