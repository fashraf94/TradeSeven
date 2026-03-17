// api/fantasytimes/generate-column.js
// Kim's Sector Strategist — weekly columns (Monday preview, Friday wrap).
// Uses Sonnet 4 synchronous for deep cross-sector analysis.

import Anthropic from '@anthropic-ai/sdk';
import { applySecurityMiddleware } from '../_utils/security.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import {
  KIM_SYSTEM_PROMPT,
  PUBLISH_SECTOR_COLUMN_TOOL,
  REPORTER_PROFILES,
} from '../_utils/fantasyTimesPrompts.js';
import { getDefaultVisual, shouldOverrideVisual, callArtDirector } from '../_utils/fantasyTimesVisuals.js';
import { STOCK_DATA, TICKERS } from '../_utils/stockIntelligenceData.js';
import { getClaimsForReporter, formatClaimsForPrompt } from '../_utils/ingestedClaims.js';

export const config = { maxDuration: 60 };

const LOG_PREFIX = '[FantasyTimes:Kim:Column]';
const VALID_TYPES = ['preview', 'wrap'];

// Sector ETFs to track for weekly performance
const SECTOR_ETFS = ['XLK', 'XLF', 'XLE', 'XLV', 'XLY', 'XLP', 'XLI', 'XLB', 'XLU', 'XLRE', 'XLC'];

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
 * Fetch sector rankings from Firestore.
 */
async function fetchSectorRankings(db) {
  try {
    const doc = await db.collection('sectorRankings').doc('latest').get();
    if (!doc.exists) return null;
    return doc.data();
  } catch (err) {
    logError('Failed to fetch sector rankings', { error: err.message });
    return null;
  }
}

/**
 * Fetch this week's FantasyTimes stories (for Friday wrap context).
 * Uses status + publishedAt query — covered by existing composite index.
 */
async function fetchWeekStories(db) {
  try {
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const stories = await db
      .collection('fantasyTimesStories')
      .where('status', '==', 'published')
      .where('publishedAt', '>', fiveDaysAgo)
      .orderBy('publishedAt', 'desc')
      .limit(30)
      .get();

    return stories.docs.map((doc) => {
      const d = doc.data();
      return {
        reporter: d.reporter,
        reporterName: d.reporterName,
        type: d.type,
        headline: d.headline,
        sentiment: d.sentiment,
        themes: d.themes || [],
        tickers: d.tickers || [],
      };
    });
  } catch (err) {
    logError('Failed to fetch week stories', { error: err.message });
    return [];
  }
}

/**
 * Build sector context from stock intelligence data.
 */
function buildSectorContext() {
  const sectorMap = {};
  for (const ticker of TICKERS) {
    const stock = STOCK_DATA[ticker];
    if (!stock) continue;
    const sector = stock.sector;
    if (!sectorMap[sector]) sectorMap[sector] = [];
    sectorMap[sector].push({
      ticker,
      name: stock.shortName || stock.name,
      sector,
    });
  }
  return sectorMap;
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

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!process.env.CLAUDE_API_KEY) {
    return res.status(500).json({ success: false, error: 'AI service not configured' });
  }

  const columnType = req.query?.type || req.body?.type;
  if (!columnType || !VALID_TYPES.includes(columnType)) {
    return res.status(400).json({
      success: false,
      error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`,
    });
  }

  try {
    const db = getFirebaseAdmin();
    logInfo(`Starting ${columnType} column generation`);

    // Dedup: one column per type per day
    const todayET = getTodayET();
    const startOfDay = new Date(`${todayET}T00:00:00-05:00`);

    const dedupQuery = await db
      .collection('fantasyTimesStories')
      .where('reporter', '==', 'kim')
      .where('type', '==', 'sector_column')
      .where('publishedAt', '>', startOfDay)
      .limit(1)
      .get();

    if (!dedupQuery.empty) {
      const existing = dedupQuery.docs[0].data();
      if (existing.dataSnapshot?.columnType === columnType) {
        logInfo(`${columnType} column already published today`);
        return res.status(200).json({
          success: false,
          reason: 'dedup',
          message: `${columnType} column already published today`,
        });
      }
    }

    // Gather context
    logInfo('Gathering sector context...');

    // 1. Sector rankings from Firestore
    const sectorRankings = await fetchSectorRankings(db);

    // 2. Sector ETF prices
    const etfPrices = await Promise.all(
      SECTOR_ETFS.slice(0, 5).map(fetchRealTimePrice)
    );
    const validEtfPrices = etfPrices.filter(Boolean);

    // 3. Stock intelligence sector map
    const sectorContext = buildSectorContext();

    // 4. Top movers for knowledge excerpts
    const topMovers = validEtfPrices
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, 3);

    // 5. For Friday wrap: this week's stories
    let weekStoriesContext = '';
    if (columnType === 'wrap') {
      const weekStories = await fetchWeekStories(db);
      if (weekStories.length > 0) {
        const storySummaries = weekStories.slice(0, 15).map((s) =>
          `- ${s.reporterName} (${s.type}): "${s.headline}" [${s.sentiment}] themes: ${(s.themes || []).join(', ')}`
        );
        weekStoriesContext = `\nTHIS WEEK'S FANTASYTIMES STORIES (for narrative context):\n${storySummaries.join('\n')}`;
      }
    }

    // Build user message
    const sectorLines = Object.entries(sectorContext)
      .map(([sector, stocks]) => `${sector}: ${stocks.map((s) => s.ticker).join(', ')}`)
      .join('\n');

    const etfLines = validEtfPrices
      .map((p) => `${p.symbol}: $${p.price.toFixed(2)} (${p.changePercent >= 0 ? '+' : ''}${p.changePercent.toFixed(2)}%)`)
      .join('\n');

    let rankingsContext = '';
    if (sectorRankings) {
      const rankings = sectorRankings.rankings || sectorRankings.sectors || [];
      if (Array.isArray(rankings) && rankings.length > 0) {
        const rankLines = rankings.slice(0, 6).map((r, i) =>
          `${i + 1}. ${r.name || r.sector}: score ${r.compositeScore || r.score || 'N/A'}, breadth ${r.breadthPct || r.breadth || 'N/A'}%`
        );
        rankingsContext = `\nSECTOR RANKINGS (composite score, higher is better):\n${rankLines.join('\n')}`;
      }
    }

    const dayLabel = columnType === 'preview' ? 'MONDAY PREVIEW' : 'FRIDAY WRAP';
    let userMessage = [
      `COLUMN TYPE: ${dayLabel}`,
      `Date: ${getTodayET()}`,
      '',
      'SECTOR ETF PERFORMANCE:',
      etfLines || 'ETF data unavailable',
      rankingsContext,
      '',
      'TRACKED UNIVERSE BY SECTOR:',
      sectorLines,
      weekStoriesContext,
      '',
      `Write a ${columnType === 'preview' ? 'Monday weekly preview' : 'Friday weekly wrap'} column. Use the publish_sector_column tool.`,
    ].join('\n');

    // Enrich with ingested claims (if available)
    let claimsContext = '';
    try {
      const claims = await getClaimsForReporter('kim', { limit: 10 });
      claimsContext = formatClaimsForPrompt(claims);
    } catch (e) {
      logError('Claims fetch failed for kim:', e.message);
    }
    if (claimsContext) {
      userMessage += `\n\nCROSS-COMPANY INSIGHTS FROM RECENT EVENTS:\n${claimsContext}`;
    }

    const anthropic = getAnthropicClient();
    logInfo('Calling Claude Sonnet for column...', { model: REPORTER_PROFILES.kim.model });

    const response = await anthropic.messages.create({
      model: REPORTER_PROFILES.kim.model,
      max_tokens: 1200,
      temperature: 0.85,
      system: KIM_SYSTEM_PROMPT,
      tools: [PUBLISH_SECTOR_COLUMN_TOOL],
      tool_choice: { type: 'tool', name: 'publish_sector_column' },
      messages: [{ role: 'user', content: userMessage }],
    });

    const toolBlock = response.content.find((block) => block.type === 'tool_use');
    if (!toolBlock || !toolBlock.input) {
      logError('No tool_use block in column response');
      return res.status(500).json({ success: false, error: 'AI did not return structured story' });
    }

    const storyData = toolBlock.input;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + REPORTER_PROFILES.kim.expiryHours * 60 * 60 * 1000);

    const topSectors = Array.isArray(storyData.topSectors) ? storyData.topSectors : [];

    const storyDoc = {
      reporter: 'kim',
      reporterName: REPORTER_PROFILES.kim.name,
      reporterBeat: REPORTER_PROFILES.kim.beat,
      type: 'sector_column',
      headline: String(storyData.headline || '').slice(0, 120),
      subheadline: String(storyData.subheadline || '').slice(0, 200),
      body: String(storyData.body || ''),
      tickers: topSectors.slice(0, 5),
      primaryTicker: null,
      sector: 'Sectors',
      themes: Array.isArray(storyData.themes) ? storyData.themes : [],
      sentiment: storyData.sentiment || 'neutral',
      urgency: 'timely',
      recommended_action: storyData.recommended_action || 'RESEARCH',
      dataSnapshot: {
        columnType,
        topSectors,
        sectorPerformance: validEtfPrices.map((p) => ({
          symbol: p.symbol,
          price: p.price,
          changePercent: p.changePercent,
        })),
      },
      newsContext: [],
      generatedBy: REPORTER_PROFILES.kim.model,
      batchId: null,
      publishedAt: now,
      expiresAt,
      status: 'published',
    };

    // Stamp visual fields
    const { visualType, visualConfig } = getDefaultVisual(
      storyDoc.reporter, storyDoc.type, storyDoc.dataSnapshot, storyDoc.primaryTicker
    );
    storyDoc.visualType = visualType;
    storyDoc.visualConfig = visualConfig;

    const docRef = await db.collection('fantasyTimesStories').add(storyDoc);
    logInfo(`Published ${columnType} column ${docRef.id}`, { headline: storyDoc.headline });

    // Art Director override for edge-case story types
    if (shouldOverrideVisual(storyDoc.reporter, storyDoc.type)) {
      await callArtDirector(storyDoc, docRef.id, db);
    }

    return res.status(200).json({
      success: true,
      storyId: docRef.id,
      headline: storyDoc.headline,
      columnType,
    });
  } catch (error) {
    logError('Column generation failed', {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ success: false, error: 'Sector column generation failed' });
  }
}
