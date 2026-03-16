console.log('generate-mover loaded');
// api/fantasytimes/generate-mover.js
// Alex's Stock Spotlight — individual stock mover story generation.
// POST endpoint called when ATR threshold crossed.

import Anthropic from '@anthropic-ai/sdk';
import { applySecurityMiddleware } from '../_utils/security.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { STOCK_DATA, TICKERS } from '../_utils/stockIntelligenceData.js';
import {
  ALEX_SYSTEM_PROMPT,
  PUBLISH_STORY_TOOL,
  REPORTER_PROFILES,
} from '../_utils/fantasyTimesPrompts.js';
import { getDefaultVisual, shouldOverrideVisual, callArtDirector } from '../_utils/fantasyTimesVisuals.js';

export const config = { maxDuration: 30 };

const LOG_PREFIX = '[FantasyTimes:Alex]';

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
 * Core mover story generation logic. Used by the HTTP handler and scan-movers.js.
 * Returns { success, storyId?, headline?, reason?, message?, error? }
 */
export async function generateAlexMoverStory({
  symbol,
  currentPrice,
  priceChange,
  percentChange,
  atr14 = 0,
  atrMultiple = 1.5,
  direction,
  sector = 'Unknown',
}) {
  if (!process.env.CLAUDE_API_KEY) {
    throw new Error('AI service not configured');
  }

  const upperSymbol = String(symbol).toUpperCase().replace(/[^A-Z0-9.]/g, '');
  if (!upperSymbol || upperSymbol.length > 10) {
    throw new Error('Invalid symbol');
  }

  const db = getFirebaseAdmin();
  logInfo('Step 1: Validation passed, got Firebase admin');

  // ── Dedup check ─────────────────────────────────────────────────
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const dedupQuery = await db
    .collection('fantasyTimesStories')
    .where('primaryTicker', '==', upperSymbol)
    .where('reporter', '==', 'alex')
    .where('publishedAt', '>', fourHoursAgo)
    .limit(1)
    .get();

  if (!dedupQuery.empty) {
    // Volatility override: 5%+ opposite direction or 3x ATR total
    const isVolatilityOverride =
      (Math.abs(percentChange) >= 5 && direction !== dedupQuery.docs[0].data().dataSnapshot?.direction) ||
      atrMultiple >= 3;

    if (!isVolatilityOverride) {
      logInfo(`Dedup: ${upperSymbol} already covered in last 4h, skipping`);
      return { success: false, reason: 'dedup', message: `${upperSymbol} already covered in last 4 hours` };
    }
    logInfo(`Volatility override for ${upperSymbol}: atrMultiple=${atrMultiple}, percentChange=${percentChange}%`);
  }
  logInfo('Step 2: Dedup check passed', { symbol: upperSymbol });

  // ── Fetch EODHD news headlines ──────────────────────────────────
  let newsHeadlines = [];
  try {
    const newsUrl = `https://eodhd.com/api/news?s=${upperSymbol}.US&limit=5&api_token=${process.env.EODHD_API_KEY}&fmt=json`;
    const newsRes = await fetch(newsUrl);
    if (newsRes.ok) {
      const newsData = await newsRes.json();
      newsHeadlines = (newsData || [])
        .slice(0, 5)
        .map((n) => n.title || n.headline)
        .filter(Boolean);
    }
  } catch (e) {
    logError('Failed to fetch EODHD news, continuing without', { error: e.message });
  }
  logInfo('Step 3: News fetched', { headlineCount: newsHeadlines.length });

  // ── Load knowledge context (Tier 1 stocks) ─────────────────────
  let knowledgeExcerpt = '';
  if (TICKERS.includes(upperSymbol) && STOCK_DATA[upperSymbol]?.knowledgePackage) {
    knowledgeExcerpt = STOCK_DATA[upperSymbol].knowledgePackage.slice(0, 1500);
  }
  logInfo('Step 4: Knowledge loaded', { hasKnowledge: !!knowledgeExcerpt, excerptLength: knowledgeExcerpt.length });

  // ── Build user message ──────────────────────────────────────────
  const userMessage = [
    `STOCK MOVE ALERT:`,
    `- Symbol: ${upperSymbol}`,
    `- Current Price: $${Number(currentPrice).toFixed(2)}`,
    `- Change: ${priceChange >= 0 ? '+' : ''}$${Number(priceChange).toFixed(2)} (${percentChange >= 0 ? '+' : ''}${Number(percentChange).toFixed(2)}%)`,
    `- Direction: ${direction || (percentChange >= 0 ? 'up' : 'down')}`,
    `- ATR(14): $${Number(atr14).toFixed(2)}`,
    `- ATR Multiple: ${Number(atrMultiple).toFixed(1)}x (triggered at 1.5x)`,
    `- Sector: ${sector}`,
    '',
    `RECENT NEWS HEADLINES FOR ${upperSymbol}:`,
    newsHeadlines.length > 0
      ? newsHeadlines.map((h, i) => `${i + 1}. ${h}`).join('\n')
      : 'No recent headlines available. Focus on technicals.',
    '',
    knowledgeExcerpt ? `COMPANY CONTEXT:\n${knowledgeExcerpt}\n` : '',
    `Write a Market Pulse story about this move. Use the publish_story tool.`,
  ]
    .filter(Boolean)
    .join('\n');

  // ── Call Claude Haiku with Tool Use ──────────────────────────────
  logInfo(`Generating story for ${upperSymbol} (${percentChange}%, ${atrMultiple}x ATR)`);
  logInfo('Step 5: Calling Claude API...', { model: REPORTER_PROFILES.alex.model, messageLength: userMessage.length });
  const anthropic = getAnthropicClient();

  const response = await anthropic.messages.create({
    model: REPORTER_PROFILES.alex.model,
    max_tokens: 500,
    temperature: 0.8,
    system: ALEX_SYSTEM_PROMPT,
    tools: [PUBLISH_STORY_TOOL],
    tool_choice: { type: 'tool', name: 'publish_story' },
    messages: [{ role: 'user', content: userMessage }],
  });
  logInfo('Step 6: Claude response received', { stopReason: response.stop_reason, contentBlocks: response.content?.length });

  // ── Extract structured output from Tool Use ─────────────────────
  const toolBlock = response.content.find((block) => block.type === 'tool_use');
  if (!toolBlock || !toolBlock.input) {
    logError('No tool_use block in response', { content: response.content });
    throw new Error('AI did not return structured story');
  }

  const storyData = toolBlock.input;

  // ── Write to Firestore ──────────────────────────────────────────
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REPORTER_PROFILES.alex.expiryHours * 60 * 60 * 1000);

  const storyDoc = {
    reporter: 'alex',
    reporterName: REPORTER_PROFILES.alex.name,
    reporterBeat: REPORTER_PROFILES.alex.beat,
    type: 'market_mover',
    headline: String(storyData.headline || '').slice(0, 120),
    subheadline: String(storyData.subheadline || '').slice(0, 200),
    body: String(storyData.body || ''),
    tickers: [upperSymbol],
    primaryTicker: upperSymbol,
    sector: sector,
    themes: Array.isArray(storyData.themes) ? storyData.themes : [],
    sentiment: storyData.sentiment || 'neutral',
    urgency: atrMultiple >= 2.5 ? 'breaking' : 'timely',
    recommended_action: storyData.recommended_action || 'WATCHLIST',
    dataSnapshot: {
      price: Number(currentPrice),
      change: Number(priceChange),
      percentChange: Number(percentChange),
      atrMultiple: Number(atrMultiple),
      direction: direction || (percentChange >= 0 ? 'up' : 'down'),
    },
    newsContext: newsHeadlines,
    generatedBy: REPORTER_PROFILES.alex.model,
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

  logInfo('Step 7: Writing to Firestore...', { headline: storyDoc.headline });
  const docRef = await db.collection('fantasyTimesStories').add(storyDoc);

  logInfo(`Published story ${docRef.id} for ${upperSymbol}`, {
    headline: storyDoc.headline,
    sentiment: storyDoc.sentiment,
  });

  // Art Director override for edge-case story types
  if (shouldOverrideVisual(storyDoc.reporter, storyDoc.type)) {
    await callArtDirector(storyDoc, docRef.id, db);
  }

  return { success: true, storyId: docRef.id, headline: storyDoc.headline };
}

export default async function handler(req, res) {
  // Security + rate limiting
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 20, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const {
    symbol,
    currentPrice,
    priceChange,
    percentChange,
    atr14,
    atrMultiple,
    direction,
    sector,
  } = req.body || {};

  if (!symbol || currentPrice == null || percentChange == null || atrMultiple == null) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: symbol, currentPrice, percentChange, atrMultiple',
    });
  }

  try {
    const result = await generateAlexMoverStory({
      symbol,
      currentPrice,
      priceChange,
      percentChange,
      atr14,
      atrMultiple,
      direction,
      sector,
    });

    return res.status(result.success ? 200 : 200).json(result);
  } catch (error) {
    logError('Generation failed', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      status: error.status,
      type: error.error?.type,
    });
    return res.status(500).json({ success: false, error: 'Story generation failed' });
  }
}
