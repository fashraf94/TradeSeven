// api/fantasytimes/generate-recap.js
// Doug's Earnings Recap — generates quick recaps after earnings results drop.
// Called by hourly cron during 4-8 PM ET (after-hours earnings window).

import Anthropic from '@anthropic-ai/sdk';
import { applySecurityMiddleware } from '../_utils/security.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { TICKERS } from '../_utils/stockIntelligenceData.js';
import { getEarningsResult } from '../earnings/_helpers/getEarningsResult.js';
import {
  DOUG_RECAP_SYSTEM_PROMPT,
  PUBLISH_EARNINGS_RECAP_TOOL,
  REPORTER_PROFILES,
} from '../_utils/fantasyTimesPrompts.js';

export const config = { maxDuration: 60 };

const LOG_PREFIX = '[FantasyTimes:Doug:Recap]';

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

function getTodayET() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/**
 * Fetch real-time price from EODHD for a single symbol.
 */
async function fetchRealTimePrice(symbol) {
  try {
    const url = `https://eodhd.com/api/real-time/${symbol}.US?api_token=${process.env.EODHD_API_KEY}&fmt=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      symbol,
      price: Number(data.close) || 0,
      changePercent: Number(data.change_p) || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch today's earnings from EODHD calendar.
 */
async function fetchTodaysEarnings() {
  const todayStr = new Date().toISOString().split('T')[0];
  const url = `https://eodhd.com/api/calendar/earnings?api_token=${process.env.EODHD_API_KEY}&fmt=json&from=${todayStr}&to=${todayStr}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`EODHD responded ${res.status}`);
  const data = await res.json();
  return data.earnings || [];
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
    return;
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
    logInfo('Starting earnings recap check');

    // Fetch today's earnings calendar
    const earningsRaw = await fetchTodaysEarnings();
    logInfo('Raw earnings for today', { count: earningsRaw.length });

    // Filter to tracked symbols
    const tickerSet = new Set(TICKERS.map((t) => t.toUpperCase()));
    const trackedResults = earningsRaw
      .filter((e) => {
        const code = (e.code || '').replace('.US', '').toUpperCase();
        return tickerSet.has(code) && e.actual_eps !== null && e.actual_eps !== undefined;
      })
      .map((e) => ({
        symbol: (e.code || '').replace('.US', '').toUpperCase(),
        companyName: e.name || '',
        reportDate: e.report_date,
        epsActual: e.actual_eps,
        epsEstimate: e.eps_estimate,
      }));

    logInfo('Tracked earnings with results', { count: trackedResults.length });

    if (trackedResults.length === 0) {
      return res.status(200).json({
        success: true,
        skipped: true,
        reason: 'No tracked earnings results today',
      });
    }

    // Dedup: check which symbols already have a recap today
    const todayET = getTodayET();
    const startOfDay = new Date(`${todayET}T00:00:00-05:00`);

    const dedupQuery = await db
      .collection('fantasyTimesStories')
      .where('reporter', '==', 'doug')
      .where('type', '==', 'earnings_recap')
      .where('publishedAt', '>', startOfDay)
      .limit(50)
      .get();

    const coveredSymbols = new Set(
      dedupQuery.docs.map((doc) => doc.data().primaryTicker).filter(Boolean)
    );

    const uncoveredResults = trackedResults.filter((e) => !coveredSymbols.has(e.symbol));

    if (uncoveredResults.length === 0) {
      logInfo('All tracked earnings already covered today');
      return res.status(200).json({
        success: true,
        skipped: true,
        reason: 'All earnings results already covered',
      });
    }

    // Process the first uncovered result (one per cron invocation to stay within timeout)
    const earning = uncoveredResults[0];
    logInfo(`Generating recap for ${earning.symbol}`);

    // Get detailed earnings result
    let earningsDetail = null;
    try {
      earningsDetail = await getEarningsResult(earning.symbol);
    } catch (e) {
      logError(`getEarningsResult failed for ${earning.symbol}`, { error: e.message });
    }

    // Fetch current price reaction
    const priceData = await fetchRealTimePrice(earning.symbol);

    // Check if Doug published a preview for this symbol
    let previewReference = '';
    try {
      const previewQuery = await db
        .collection('fantasyTimesStories')
        .where('reporter', '==', 'doug')
        .where('type', '==', 'earnings_preview')
        .where('primaryTicker', '==', earning.symbol)
        .orderBy('publishedAt', 'desc')
        .limit(1)
        .get();

      if (!previewQuery.empty) {
        const previewData = previewQuery.docs[0].data();
        previewReference = `\n\nDOUG'S PREVIEW (published earlier):\nHeadline: ${previewData.headline}\nKey points: ${previewData.body?.slice(0, 300) || 'N/A'}`;
      }
    } catch (e) {
      logError('Preview query failed, continuing without', { error: e.message });
    }

    // Determine outcome
    const outcome = earningsDetail?.outcome || (
      earning.epsActual > (earning.epsEstimate || 0)
        ? 'beat'
        : earning.epsActual < (earning.epsEstimate || 0)
          ? 'miss'
          : 'meet'
    );

    const surprise = earningsDetail?.surprisePercent
      ? `${earningsDetail.surprisePercent.toFixed(1)}%`
      : 'N/A';

    const userMessage = [
      `EARNINGS RESULT: ${earning.symbol}`,
      `Company: ${earning.companyName}`,
      `Report Date: ${earning.reportDate}`,
      '',
      'THE NUMBERS:',
      `EPS Actual: ${earning.epsActual}`,
      `EPS Estimate: ${earning.epsEstimate || 'N/A'}`,
      `Outcome: ${outcome.toUpperCase()}`,
      `Surprise: ${surprise}`,
      earningsDetail?.priceMove ? `After-hours price move: ${earningsDetail.priceMove >= 0 ? '+' : ''}${earningsDetail.priceMove.toFixed(1)}%` : '',
      priceData ? `Current price: $${priceData.price.toFixed(2)} (${priceData.changePercent >= 0 ? '+' : ''}${priceData.changePercent.toFixed(2)}%)` : '',
      previewReference,
      '',
      `Write an earnings recap for ${earning.symbol}. Use the publish_earnings_recap tool.`,
    ]
      .filter((line) => line !== '')
      .join('\n');

    const anthropic = getAnthropicClient();
    logInfo('Calling Claude API for recap...', { model: REPORTER_PROFILES.doug.model });

    const response = await anthropic.messages.create({
      model: REPORTER_PROFILES.doug.model,
      max_tokens: 500,
      temperature: 0.8,
      system: DOUG_RECAP_SYSTEM_PROMPT,
      tools: [PUBLISH_EARNINGS_RECAP_TOOL],
      tool_choice: { type: 'tool', name: 'publish_earnings_recap' },
      messages: [{ role: 'user', content: userMessage }],
    });

    const toolBlock = response.content.find((block) => block.type === 'tool_use');
    if (!toolBlock || !toolBlock.input) {
      logError('No tool_use block in recap response');
      return res.status(500).json({ success: false, error: 'AI did not return structured story' });
    }

    const storyData = toolBlock.input;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + REPORTER_PROFILES.doug.expiryHours * 60 * 60 * 1000);

    const storyDoc = {
      reporter: 'doug',
      reporterName: REPORTER_PROFILES.doug.name,
      reporterBeat: REPORTER_PROFILES.doug.beat,
      type: 'earnings_recap',
      headline: String(storyData.headline || '').slice(0, 120),
      subheadline: String(storyData.subheadline || '').slice(0, 200),
      body: String(storyData.body || ''),
      tickers: [earning.symbol],
      primaryTicker: earning.symbol,
      sector: 'Earnings',
      themes: Array.isArray(storyData.themes) ? storyData.themes : [],
      sentiment: storyData.sentiment || 'neutral',
      urgency: 'timely',
      recommended_action: storyData.recommended_action || 'EARNINGSGAME',
      dataSnapshot: {
        symbol: earning.symbol,
        epsActual: earning.epsActual,
        epsEstimate: earning.epsEstimate,
        outcome,
        surprise,
        priceMove: earningsDetail?.priceMove || null,
        magnitude: earningsDetail?.magnitude || null,
      },
      newsContext: [],
      generatedBy: REPORTER_PROFILES.doug.model,
      batchId: null,
      publishedAt: now,
      expiresAt: expiresAt,
      status: 'published',
    };

    const docRef = await db.collection('fantasyTimesStories').add(storyDoc);
    logInfo(`Published earnings recap ${docRef.id}`, {
      symbol: earning.symbol,
      outcome,
      headline: storyDoc.headline,
    });

    return res.status(200).json({
      success: true,
      storyId: docRef.id,
      headline: storyDoc.headline,
      symbol: earning.symbol,
      outcome,
    });
  } catch (error) {
    logError('Recap generation failed', {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ success: false, error: 'Earnings recap generation failed' });
  }
}
