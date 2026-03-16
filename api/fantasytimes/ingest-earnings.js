// api/fantasytimes/ingest-earnings.js
// Cron endpoint: fetches recent earnings reports from EODHD, ingests claims via Sonar+Haiku.
// Runs after market close to catch after-hours earnings.

import { applySecurityMiddleware } from '../_utils/security.js';
import { TICKERS } from '../_utils/stockIntelligenceData.js';
import { getClaimsForTicker } from '../_utils/ingestedClaims.js';
import { ingestEarningsCall } from '../_utils/ingestionPipeline.js';

export const config = { maxDuration: 60 };

const LOG_PREFIX = '[FantasyTimes:IngestEarnings]';
const MAX_PER_RUN = 5;

function logInfo(msg, data = null) {
  const ts = new Date().toISOString();
  console.log(`${ts} ${LOG_PREFIX} ${msg}`, data ? JSON.stringify(data) : '');
}

function logError(msg, data = null) {
  const ts = new Date().toISOString();
  console.error(`${ts} ${LOG_PREFIX} ${msg}`, data ? JSON.stringify(data) : '');
}

/**
 * Fetch earnings calendar from EODHD for a given date.
 */
async function fetchEarningsForDate(dateStr) {
  try {
    const url = `https://eodhd.com/api/calendar/earnings?api_token=${process.env.EODHD_API_KEY}&fmt=json&from=${dateStr}&to=${dateStr}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.earnings || [];
  } catch (err) {
    logError(`Failed to fetch earnings for ${dateStr}:`, err.message);
    return [];
  }
}

/**
 * Get today and yesterday in YYYY-MM-DD format (ET timezone).
 */
function getRecentDates() {
  const now = new Date();
  const todayET = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayET = yesterday.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  return { todayET, yesterdayET };
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 5, windowMs: 60000 } })) {
    return;
  }

  // --- Cron/Admin Authentication ---
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { todayET, yesterdayET } = getRecentDates();
    logInfo('Fetching earnings calendar', { today: todayET, yesterday: yesterdayET });

    // Fetch earnings for today and yesterday
    const [todayEarnings, yesterdayEarnings] = await Promise.all([
      fetchEarningsForDate(todayET),
      fetchEarningsForDate(yesterdayET),
    ]);

    const allEarnings = [...todayEarnings, ...yesterdayEarnings];
    logInfo(`Found ${allEarnings.length} total earnings reports`);

    if (allEarnings.length === 0) {
      return res.status(200).json({
        success: true,
        earningsFound: 0,
        filtered: 0,
        alreadyIngested: 0,
        ingested: 0,
        results: [],
        skippedDueToLimit: 0,
      });
    }

    // Filter to stocks in our tracked universe
    const tickerSet = new Set(TICKERS.map(t => t.toUpperCase()));
    const tracked = allEarnings.filter(e => {
      const symbol = (e.code || e.symbol || '').toUpperCase().replace('.US', '');
      return tickerSet.has(symbol);
    });

    logInfo(`Filtered to ${tracked.length} tracked stocks`);

    // Dedup: skip stocks already ingested for this report date
    const toIngest = [];
    let alreadyIngested = 0;

    for (const earning of tracked) {
      const symbol = (earning.code || earning.symbol || '').toUpperCase().replace('.US', '');
      const reportDate = earning.report_date || earning.reportDate || todayET;

      const existingClaims = await getClaimsForTicker(symbol, {
        source: 'earnings_call',
        limit: 1,
      });
      const alreadyDone = existingClaims.some(c => c.sourceDate === reportDate);

      if (alreadyDone) {
        alreadyIngested++;
        logInfo(`Skipping ${symbol} — already ingested for ${reportDate}`);
        continue;
      }

      toIngest.push({
        symbol,
        reportDate,
        companyName: earning.name || earning.companyName || symbol,
        epsActual: earning.actual_eps ?? earning.epsActual ?? null,
        epsEstimate: earning.eps_estimate ?? earning.epsEstimate ?? null,
        revenueActual: earning.actual_revenue ?? earning.revenueActual ?? null,
        revenueEstimate: earning.revenue_estimate ?? earning.revenueEstimate ?? null,
        surprisePercent: earning.surprise_percent ?? earning.surprisePercent ?? 0,
      });
    }

    // Process up to MAX_PER_RUN
    const batch = toIngest.slice(0, MAX_PER_RUN);
    const skippedDueToLimit = Math.max(0, toIngest.length - MAX_PER_RUN);
    const results = [];

    for (const item of batch) {
      logInfo(`Ingesting earnings for ${item.symbol}...`);
      const result = await ingestEarningsCall(item.symbol, item.reportDate, {
        epsActual: item.epsActual,
        epsEstimate: item.epsEstimate,
        revenueActual: item.revenueActual,
        revenueEstimate: item.revenueEstimate,
        surprisePercent: item.surprisePercent,
        companyName: item.companyName,
      });
      results.push({ ticker: item.symbol, ...result });
    }

    const ingested = results.filter(r => r.success).length;
    logInfo('Ingestion complete', { ingested, errors: results.filter(r => !r.success).length });

    return res.status(200).json({
      success: true,
      earningsFound: allEarnings.length,
      filtered: tracked.length,
      alreadyIngested,
      ingested,
      results,
      skippedDueToLimit,
    });
  } catch (err) {
    logError('Ingestion cron failed:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
