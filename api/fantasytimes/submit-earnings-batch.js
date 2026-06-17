// api/fantasytimes/submit-earnings-batch.js
// Doug's Earnings Batch Submitter — submits earnings previews to Anthropic Batch API.
// Called by nightly cron at midnight ET. Previews companies reporting in next 2-7 days.

import Anthropic from '@anthropic-ai/sdk';
import { applySecurityMiddleware } from '../_utils/security.js';
import { isMarketHolidayToday } from '../_utils/marketHolidayCheck.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { TICKERS, STOCK_DATA } from '../_utils/stockIntelligenceData.js';
import {
  DOUG_PREVIEW_SYSTEM_PROMPT,
  PUBLISH_EARNINGS_PREVIEW_TOOL,
  REPORTER_PROFILES,
} from '../_utils/fantasyTimesPrompts.js';

export const config = { maxDuration: 60 };

const LOG_PREFIX = '[FantasyTimes:Doug:BatchSubmit]';

function logInfo(msg, data = null) {
  const ts = new Date().toISOString();
  console.log(`${ts} ${LOG_PREFIX} ${msg}`, data ? JSON.stringify(data) : '');
}

function logError(msg, data = null) {
  const ts = new Date().toISOString();
  console.error(`${ts} ${LOG_PREFIX} ${msg}`, data ? JSON.stringify(data) : '');
}

let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  }
  return anthropicClient;
}

/**
 * Fetch upcoming earnings from EODHD calendar API.
 */
async function fetchEarningsCalendar(fromDate, toDate) {
  const url = `https://eodhd.com/api/calendar/earnings?api_token=${process.env.EODHD_API_KEY}&fmt=json&from=${fromDate}&to=${toDate}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`EODHD earnings calendar responded ${res.status}`);
  const data = await res.json();
  return data.earnings || [];
}

/**
 * Fetch earnings history from EODHD fundamentals.
 */
async function fetchEarningsHistory(symbol) {
  try {
    const url = `https://eodhd.com/api/fundamentals/${symbol}.US?api_token=${process.env.EODHD_API_KEY}&fmt=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const history = data?.Earnings?.History;
    if (!history) return null;

    // Get last 4 quarters
    const quarters = Object.values(history)
      .filter((q) => q.epsActual !== null)
      .sort((a, b) => new Date(b.reportDate) - new Date(a.reportDate))
      .slice(0, 4);

    return quarters;
  } catch {
    return null;
  }
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

  if (isMarketHolidayToday()) {
    return res.status(200).json({ skipped: true, reason: 'Market holiday' });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!process.env.CLAUDE_API_KEY) {
    return res.status(500).json({ success: false, error: 'AI service not configured' });
  }

  if (!process.env.EODHD_API_KEY) {
    return res.status(500).json({ success: false, error: 'Market data service not configured' });
  }

  try {
    const db = getFirebaseAdmin();
    logInfo('Starting earnings batch submission');

    // Date range: today + 2 to +7 days
    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() + 2);
    const toDate = new Date(today);
    toDate.setDate(today.getDate() + 7);

    const fromStr = fromDate.toISOString().split('T')[0];
    const toStr = toDate.toISOString().split('T')[0];

    logInfo('Fetching EODHD earnings calendar', { from: fromStr, to: toStr });
    const earningsRaw = await fetchEarningsCalendar(fromStr, toStr);
    logInfo('Raw earnings fetched', { count: earningsRaw.length });

    // Filter to US stocks in our tracked universe
    const tickerSet = new Set(TICKERS.map((t) => t.toUpperCase()));
    const trackedEarnings = earningsRaw
      .filter((e) => {
        const code = (e.code || '').replace('.US', '').toUpperCase();
        return tickerSet.has(code);
      })
      .map((e) => ({
        symbol: (e.code || '').replace('.US', '').toUpperCase(),
        companyName: e.name || '',
        reportDate: e.report_date,
        epsEstimate: e.eps_estimate,
        revenueEstimate: e.revenue_estimate,
        reportTime: e.before_after_market || 'TBD',
      }));

    logInfo('Tracked earnings', { count: trackedEarnings.length });

    if (trackedEarnings.length === 0) {
      return res.status(200).json({
        success: true,
        skipped: true,
        reason: 'No upcoming earnings for tracked symbols',
      });
    }

    // Dedup: skip symbols that already have a published earnings_preview
    const dedupQuery = await db
      .collection('fantasyTimesStories')
      .where('reporter', '==', 'doug')
      .where('type', '==', 'earnings_preview')
      .where('status', '==', 'published')
      .limit(100)
      .get();

    const existingPreviews = new Set(
      dedupQuery.docs.map((doc) => doc.data().primaryTicker).filter(Boolean)
    );

    const qualifyingEarnings = trackedEarnings.filter(
      (e) => !existingPreviews.has(e.symbol)
    );

    logInfo('After dedup', { qualifying: qualifyingEarnings.length, alreadyCovered: existingPreviews.size });

    if (qualifyingEarnings.length === 0) {
      return res.status(200).json({
        success: true,
        skipped: true,
        reason: 'All upcoming earnings already have previews',
      });
    }

    // Build batch requests
    const requests = [];
    for (const earning of qualifyingEarnings) {
      // Build context for each symbol
      let knowledgeExcerpt = '';
      if (STOCK_DATA[earning.symbol]?.knowledgePackage) {
        knowledgeExcerpt = STOCK_DATA[earning.symbol].knowledgePackage.slice(0, 1500);
      }

      // Fetch earnings history
      const history = await fetchEarningsHistory(earning.symbol);
      let historyContext = 'No historical earnings data available.';
      if (history && history.length > 0) {
        historyContext = history
          .map(
            (q) =>
              `${q.reportDate}: EPS actual ${q.epsActual} vs estimate ${q.epsEstimate || 'N/A'} (${q.epsActual > (q.epsEstimate || 0) ? 'beat' : q.epsActual < (q.epsEstimate || 0) ? 'miss' : 'meet'})`
          )
          .join('\n');
      }

      const contextMessage = [
        `EARNINGS PREVIEW REQUEST: ${earning.symbol}`,
        `Company: ${earning.companyName}`,
        `Report Date: ${earning.reportDate}`,
        `Report Time: ${earning.reportTime}`,
        `Consensus EPS Estimate: ${earning.epsEstimate || 'N/A'}`,
        `Consensus Revenue Estimate: ${earning.revenueEstimate ? `$${(earning.revenueEstimate / 1e9).toFixed(2)}B` : 'N/A'}`,
        '',
        'RECENT EARNINGS HISTORY:',
        historyContext,
        '',
        knowledgeExcerpt ? `COMPANY CONTEXT:\n${knowledgeExcerpt}\n` : '',
        'Write an earnings preview for this company. Use the publish_earnings_preview tool.',
      ]
        .filter(Boolean)
        .join('\n');

      requests.push({
        custom_id: `earnings_preview_${earning.symbol}_${earning.reportDate}`,
        params: {
          model: 'claude-sonnet-4-6',
          max_tokens: 800,
          // Sonnet 4.6 defaults to high effort; pin to low + thinking disabled to
          // preserve the prior Sonnet-4 (no-thinking) latency profile.
          thinking: { type: 'disabled' },
          output_config: { effort: 'low' },
          system: DOUG_PREVIEW_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: contextMessage }],
          tools: [PUBLISH_EARNINGS_PREVIEW_TOOL],
          tool_choice: { type: 'tool', name: 'publish_earnings_preview' },
        },
      });
    }

    logInfo('Submitting to Anthropic Batch API', { requestCount: requests.length });
    const anthropic = getAnthropicClient();

    const batch = await anthropic.messages.batches.create({ requests });

    logInfo('Batch submitted', { batchId: batch.id, processingStatus: batch.processing_status });

    // Save batch info to Firestore
    const symbols = qualifyingEarnings.map((e) => e.symbol);
    await db.collection('fantasyTimesBatches').doc(batch.id).set({
      batchId: batch.id,
      type: 'earnings_preview',
      status: 'processing',
      symbols,
      requestCount: requests.length,
      submittedAt: new Date(),
      completedAt: null,
      errors: null,
    });

    logInfo('Batch info saved to Firestore');

    return res.status(200).json({
      success: true,
      batchId: batch.id,
      requestCount: requests.length,
      symbols,
    });
  } catch (error) {
    logError('Batch submission failed', {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ success: false, error: 'Earnings batch submission failed' });
  }
}
