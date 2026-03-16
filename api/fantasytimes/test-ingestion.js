// api/fantasytimes/test-ingestion.js
// Admin endpoint for manually triggering ingestion and viewing claims.
// Protected by CRON_SECRET. Used for debugging the ingestion pipeline.

import { applySecurityMiddleware } from '../_utils/security.js';
import { getClaimsForReporter, getClaimsForTicker, formatClaimsForPrompt } from '../_utils/ingestedClaims.js';
import { ingestEarningsCall, ingestFedEvent } from '../_utils/ingestionPipeline.js';

export const config = { maxDuration: 60 };

const LOG_PREFIX = '[FantasyTimes:TestIngestion]';

function logInfo(msg, data = null) {
  const ts = new Date().toISOString();
  console.log(`${ts} ${LOG_PREFIX} ${msg}`, data ? JSON.stringify(data) : '');
}

/**
 * Fetch most recent earnings data for a ticker from EODHD.
 */
async function fetchRecentEarnings(ticker) {
  try {
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    const url = `https://eodhd.com/api/calendar/earnings?api_token=${process.env.EODHD_API_KEY}&fmt=json&from=${thirtyDaysAgo}&to=${todayET}&symbols=${ticker}.US`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const earnings = data.earnings || [];
    if (earnings.length === 0) return null;

    // Return most recent
    const latest = earnings[earnings.length - 1];
    return {
      reportDate: latest.report_date || todayET,
      companyName: latest.name || ticker,
      epsActual: latest.actual_eps ?? null,
      epsEstimate: latest.eps_estimate ?? null,
      revenueActual: latest.actual_revenue ?? null,
      revenueEstimate: latest.revenue_estimate ?? null,
      surprisePercent: latest.surprise_percent ?? 0,
    };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
    return;
  }

  // --- Cron/Admin Authentication ---
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { action, ticker, reporter } = req.query;

  if (!action) {
    return res.status(400).json({
      error: 'Missing action param',
      usage: {
        'action=ingest_earnings&ticker=NVDA': 'Manually ingest earnings for a ticker',
        'action=ingest_fed': 'Manually ingest most recent Fed event',
        'action=view_claims&reporter=doug': 'View claims for a reporter',
        'action=view_claims&ticker=NVDA': 'View claims for a ticker',
        'action=test_prompt&reporter=doug&ticker=NVDA': 'Preview formatted claims for prompt injection',
      },
    });
  }

  try {
    // ── action=ingest_earnings ─────────────────────────────────────
    if (action === 'ingest_earnings') {
      if (!ticker) {
        return res.status(400).json({ error: 'Missing ticker param' });
      }
      const upperTicker = ticker.toUpperCase();
      logInfo(`Manual earnings ingestion for ${upperTicker}`);

      const earningsData = await fetchRecentEarnings(upperTicker);
      if (!earningsData) {
        return res.status(404).json({ error: `No recent earnings found for ${upperTicker}` });
      }

      const result = await ingestEarningsCall(upperTicker, earningsData.reportDate, earningsData);
      return res.status(200).json({ success: true, ...result, earningsData });
    }

    // ── action=ingest_fed ──────────────────────────────────────────
    if (action === 'ingest_fed') {
      logInfo('Manual Fed event ingestion');

      // Use a placeholder — in production this would come from the economic calendar
      const eventName = req.query.event || 'FOMC Rate Decision';
      const eventDate = req.query.date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

      const result = await ingestFedEvent(eventName, eventDate, {
        decision: req.query.decision || 'hold',
        actual: req.query.actual || 'unchanged',
        expected: req.query.expected || 'unchanged',
        description: req.query.description || '',
      });
      return res.status(200).json({ success: true, ...result });
    }

    // ── action=view_claims ─────────────────────────────────────────
    if (action === 'view_claims') {
      if (reporter) {
        const claims = await getClaimsForReporter(reporter, { limit: 20 });
        return res.status(200).json({ reporter, count: claims.length, claims });
      }
      if (ticker) {
        const claims = await getClaimsForTicker(ticker.toUpperCase(), { limit: 20 });
        return res.status(200).json({ ticker: ticker.toUpperCase(), count: claims.length, claims });
      }
      return res.status(400).json({ error: 'Provide reporter or ticker param' });
    }

    // ── action=test_prompt ─────────────────────────────────────────
    if (action === 'test_prompt') {
      if (!reporter) {
        return res.status(400).json({ error: 'Missing reporter param' });
      }

      const options = {};
      if (ticker) options.ticker = ticker.toUpperCase();

      const claims = await getClaimsForReporter(reporter, { ...options, limit: 10 });
      const formatted = formatClaimsForPrompt(claims);

      return res.status(200).json({
        reporter,
        ticker: ticker?.toUpperCase() || null,
        claimsCount: claims.length,
        formattedLength: formatted.length,
        formatted: formatted || '(no claims — prompt would be unchanged)',
        rawClaims: claims,
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    console.error(`${new Date().toISOString()} ${LOG_PREFIX} Error:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
