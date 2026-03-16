console.log('generate-pulse loaded');
// api/fantasytimes/generate-pulse.js
// Kai's Market Pulse — broad market summary generation.
// Called by Vercel cron 2-3x daily (pre_market, midday, post_close).

import Anthropic from '@anthropic-ai/sdk';
import { applySecurityMiddleware } from '../_utils/security.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { TICKERS } from '../_utils/stockIntelligenceData.js';
import {
  KAI_SYSTEM_PROMPT,
  PUBLISH_MARKET_PULSE_TOOL,
  REPORTER_PROFILES,
} from '../_utils/fantasyTimesPrompts.js';
import { getDefaultVisual, shouldOverrideVisual, callArtDirector } from '../_utils/fantasyTimesVisuals.js';

export const config = { maxDuration: 60 };

const LOG_PREFIX = '[FantasyTimes:Kai:Pulse]';
const VALID_PERIODS = ['pre_market', 'midday', 'post_close'];
const INDEX_SYMBOLS = ['SPY', 'QQQ', 'DIA'];

function logInfo(msg, data = null) {
  const ts = new Date().toISOString();
  console.log(`${ts} ${LOG_PREFIX} ${msg}`, data ? JSON.stringify(data) : '');
}

function logError(msg, data = null) {
  const ts = new Date().toISOString();
  console.error(`${ts} ${LOG_PREFIX} ${msg}`, data ? JSON.stringify(data) : '');
}

// Lazy singleton Anthropic client
let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  }
  return anthropicClient;
}

/**
 * Get today's date string in ET for dedup comparison.
 * Returns YYYY-MM-DD in Eastern Time.
 */
function getTodayET() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/**
 * Fetch real-time price from EODHD for a single symbol.
 * Returns { symbol, price, change, changePercent, previousClose } or null.
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
      change: Number(data.change) || 0,
      changePercent: Number(data.change_p) || 0,
      previousClose: Number(data.previousClose) || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Batch fetch real-time prices for multiple symbols.
 * Sequential calls with small delay to avoid rate limits.
 */
async function fetchBatchPrices(symbols) {
  const results = [];
  for (const symbol of symbols) {
    const data = await fetchRealTimePrice(symbol);
    if (data && data.price > 0) {
      results.push(data);
    }
  }
  return results;
}

export default async function handler(req, res) {
  // Security + rate limiting
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
    return;
  }

  // Accept both GET (cron) and POST
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!process.env.CLAUDE_API_KEY) {
    return res.status(500).json({ success: false, error: 'AI service not configured' });
  }

  if (!process.env.EODHD_API_KEY) {
    return res.status(500).json({ success: false, error: 'Market data service not configured' });
  }

  // Period from query param (cron) or body (manual POST)
  const period = req.query?.period || req.body?.period;

  if (!period || !VALID_PERIODS.includes(period)) {
    return res.status(400).json({
      success: false,
      error: `Invalid period. Must be one of: ${VALID_PERIODS.join(', ')}`,
    });
  }

  try {
    const db = getFirebaseAdmin();
    logInfo(`Starting ${period} pulse generation`);

    // ── Dedup check: one pulse per period per day ─────────────────────
    const todayET = getTodayET();
    const startOfDay = new Date(`${todayET}T00:00:00-05:00`);

    const dedupQuery = await db
      .collection('fantasyTimesStories')
      .where('reporter', '==', 'kai')
      .where('type', '==', 'market_pulse')
      .where('publishedAt', '>', startOfDay)
      .limit(10)
      .get();

    const alreadyPublished = dedupQuery.docs.some(
      (doc) => doc.data().dataSnapshot?.period === period
    );

    if (alreadyPublished) {
      logInfo(`Dedup: ${period} pulse already published today, skipping`);
      return res.status(200).json({
        success: false,
        reason: 'dedup',
        message: `${period} pulse already published today`,
      });
    }
    logInfo('Dedup check passed');

    // ── Fetch index prices (SPY, QQQ, DIA) ────────────────────────────
    logInfo('Fetching index prices...');
    const indexPrices = await fetchBatchPrices(INDEX_SYMBOLS);
    logInfo('Index prices fetched', { count: indexPrices.length });

    // ── Fetch all tracked stock prices ─────────────────────────────────
    logInfo('Fetching tracked stock prices...');
    const stockPrices = await fetchBatchPrices(TICKERS);
    logInfo('Stock prices fetched', { count: stockPrices.length });

    // Sort by absolute % change, take top 5
    const topMovers = stockPrices
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, 5);

    // ── Fetch general market headlines ──────────────────────────────────
    let marketHeadlines = [];
    try {
      const newsUrl = `https://eodhd.com/api/news?limit=3&api_token=${process.env.EODHD_API_KEY}&fmt=json`;
      const newsRes = await fetch(newsUrl);
      if (newsRes.ok) {
        const newsData = await newsRes.json();
        marketHeadlines = (newsData || [])
          .slice(0, 3)
          .map((n) => n.title || n.headline)
          .filter(Boolean);
      }
    } catch (e) {
      logError('Failed to fetch market news, continuing without', { error: e.message });
    }
    logInfo('Market headlines fetched', { count: marketHeadlines.length });

    // ── Determine overall market direction ──────────────────────────────
    const spyData = indexPrices.find((p) => p.symbol === 'SPY');
    const qqqData = indexPrices.find((p) => p.symbol === 'QQQ');
    const diaData = indexPrices.find((p) => p.symbol === 'DIA');

    const avgIndexChange = indexPrices.length > 0
      ? indexPrices.reduce((sum, p) => sum + p.changePercent, 0) / indexPrices.length
      : 0;

    const marketDirection = avgIndexChange > 0.2 ? 'up' : avgIndexChange < -0.2 ? 'down' : 'flat';

    // ── Build user message ──────────────────────────────────────────────
    const periodLabel = {
      pre_market: 'PRE-MARKET',
      midday: 'MIDDAY',
      post_close: 'POST-CLOSE',
    }[period];

    const indexLines = indexPrices.map(
      (p) => `- **${p.symbol}**: $${p.price.toFixed(2)} (${p.changePercent >= 0 ? '+' : ''}${p.changePercent.toFixed(2)}%)`
    );

    const moverLines = topMovers.map(
      (p) => `- **${p.symbol}**: $${p.price.toFixed(2)} (${p.changePercent >= 0 ? '+' : ''}${p.changePercent.toFixed(2)}%)`
    );

    const userMessage = [
      `${periodLabel} MARKET PULSE:`,
      '',
      'MARKET INDICES:',
      ...indexLines,
      `Overall direction: ${marketDirection} (avg index change: ${avgIndexChange >= 0 ? '+' : ''}${avgIndexChange.toFixed(2)}%)`,
      '',
      'TOP 5 MOVERS (by absolute % change):',
      ...moverLines,
      '',
      'MARKET HEADLINES:',
      marketHeadlines.length > 0
        ? marketHeadlines.map((h, i) => `${i + 1}. ${h}`).join('\n')
        : 'No recent headlines available.',
      '',
      `Write a ${periodLabel} Market Pulse story. Use the publish_market_pulse tool.`,
    ].join('\n');

    // ── Call Claude Haiku with Tool Use ──────────────────────────────────
    logInfo('Calling Claude API...', { model: REPORTER_PROFILES.kai.model, messageLength: userMessage.length });
    const anthropic = getAnthropicClient();

    const response = await anthropic.messages.create({
      model: REPORTER_PROFILES.kai.model,
      max_tokens: 800,
      temperature: 0.8,
      system: KAI_SYSTEM_PROMPT,
      tools: [PUBLISH_MARKET_PULSE_TOOL],
      tool_choice: { type: 'tool', name: 'publish_market_pulse' },
      messages: [{ role: 'user', content: userMessage }],
    });
    logInfo('Claude response received', { stopReason: response.stop_reason });

    // ── Extract structured output from Tool Use ─────────────────────────
    const toolBlock = response.content.find((block) => block.type === 'tool_use');
    if (!toolBlock || !toolBlock.input) {
      logError('No tool_use block in response', { content: response.content });
      return res.status(500).json({ success: false, error: 'AI did not return structured story' });
    }

    const storyData = toolBlock.input;
    const moverTickers = topMovers.map((m) => m.symbol);

    // ── Write to Firestore ──────────────────────────────────────────────
    const now = new Date();
    const expiresAt = new Date(now.getTime() + REPORTER_PROFILES.kai.expiryHours * 60 * 60 * 1000);

    const storyDoc = {
      reporter: 'kai',
      reporterName: REPORTER_PROFILES.kai.name,
      reporterBeat: REPORTER_PROFILES.kai.beat,
      type: 'market_pulse',
      headline: String(storyData.headline || '').slice(0, 120),
      subheadline: String(storyData.subheadline || '').slice(0, 200),
      body: String(storyData.body || ''),
      tickers: moverTickers,
      primaryTicker: null,
      sector: 'Market',
      themes: Array.isArray(storyData.themes) ? storyData.themes : [],
      sentiment: storyData.sentiment || 'neutral',
      urgency: 'timely',
      recommended_action: storyData.recommended_action || 'RESEARCH',
      dataSnapshot: {
        period,
        marketDirection,
        avgIndexChange: Number(avgIndexChange.toFixed(2)),
        spy: spyData ? { price: spyData.price, changePercent: spyData.changePercent } : null,
        qqq: qqqData ? { price: qqqData.price, changePercent: qqqData.changePercent } : null,
        dia: diaData ? { price: diaData.price, changePercent: diaData.changePercent } : null,
        topMovers: Array.isArray(storyData.top_movers) ? storyData.top_movers : [],
      },
      newsContext: marketHeadlines,
      generatedBy: REPORTER_PROFILES.kai.model,
      batchId: null,
      publishedAt: now,
      expiresAt: expiresAt,
      status: 'published',
    };

    // Stamp visual fields
    const { visualType, visualConfig } = getDefaultVisual(
      storyDoc.reporter, storyDoc.type, storyDoc.dataSnapshot, storyDoc.primaryTicker
    );
    storyDoc.visualType = visualType;
    storyDoc.visualConfig = visualConfig;

    logInfo('Writing to Firestore...', { headline: storyDoc.headline });
    const docRef = await db.collection('fantasyTimesStories').add(storyDoc);

    logInfo(`Published ${period} pulse ${docRef.id}`, {
      headline: storyDoc.headline,
      sentiment: storyDoc.sentiment,
      marketDirection,
    });

    // Art Director override for edge-case story types
    if (shouldOverrideVisual(storyDoc.reporter, storyDoc.type)) {
      await callArtDirector(storyDoc, docRef.id, db);
    }

    return res.status(200).json({
      success: true,
      storyId: docRef.id,
      headline: storyDoc.headline,
      period,
    });
  } catch (error) {
    logError('Pulse generation failed', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      status: error.status,
      type: error.error?.type,
    });
    return res.status(500).json({ success: false, error: 'Market pulse generation failed' });
  }
}
