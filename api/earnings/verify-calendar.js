/**
 * Batch Verification for all stocks on earnings calendar
 * Designed to run as a daily cron job
 *
 * GET /api/earnings/verify-calendar?days=7
 */

import { applySecurityMiddleware } from '../_utils/security.js';

export default async function handler(req, res) {
  // Security middleware - higher rate limit for cron
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 5, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { days = 7 } = req.query;

  // Auth check for cron
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isTestMode = req.query.testMode === 'true';

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    if (!isVercelCron && !isTestMode) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    console.log(`[verify-calendar] Starting batch verification for next ${days} days`);

    // Step 1: Get earnings calendar
    const calendarResponse = await fetch(
      `${getBaseUrl(req)}/api/stocks/earnings-calendar?days=${days}`
    );
    const calendarData = await calendarResponse.json();

    if (!calendarData.success || !calendarData.events) {
      return res.status(500).json({
        error: 'Could not fetch calendar',
        calendarResponse: calendarData
      });
    }

    const stocks = calendarData.events.map(e => e.symbol).filter(Boolean);
    const uniqueStocks = [...new Set(stocks)];

    console.log(`[verify-calendar] Found ${uniqueStocks.length} unique stocks to verify`);

    // Step 2: Verify each stock (with rate limiting)
    const results = [];
    const errors = [];

    // Limit to 10 stocks per run to avoid timeout
    const stocksToVerify = uniqueStocks.slice(0, 10);

    for (const symbol of stocksToVerify) {
      try {
        const verifyResponse = await fetch(
          `${getBaseUrl(req)}/api/earnings/verify-stock?symbol=${symbol}&quarters=12`
        );
        const verifyData = await verifyResponse.json();

        results.push({
          symbol,
          success: verifyData.success,
          mismatches: verifyData.data?.mismatches || 0,
          source: verifyData.source
        });

        console.log(`[verify-calendar] ${symbol}: ${verifyData.success ? 'OK' : 'FAILED'}, ` +
          `${verifyData.data?.mismatches || 0} mismatches`);

      } catch (error) {
        errors.push({ symbol, error: error.message });
        console.error(`[verify-calendar] ${symbol}: Error - ${error.message}`);
      }

      // Rate limiting between stocks - 2 seconds
      await sleep(2000);
    }

    const summary = {
      totalStocksInCalendar: uniqueStocks.length,
      stocksVerifiedThisRun: stocksToVerify.length,
      verified: results.filter(r => r.success).length,
      failed: errors.length,
      totalMismatches: results.reduce((sum, r) => sum + (r.mismatches || 0), 0),
      stocksWithMismatches: results.filter(r => r.mismatches > 0).map(r => r.symbol),
      remainingStocks: uniqueStocks.length - stocksToVerify.length
    };

    console.log(`[verify-calendar] Complete:`, summary);

    return res.status(200).json({
      success: true,
      summary,
      results,
      errors,
      completedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('[verify-calendar] Batch verification failed:', error);
    return res.status(500).json({
      error: 'Batch verification failed',
      message: error.message
    });
  }
}

function getBaseUrl(req) {
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${protocol}://${host}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
