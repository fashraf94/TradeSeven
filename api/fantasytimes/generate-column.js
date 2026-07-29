// api/fantasytimes/generate-column.js
// Kim's Sector Strategist — weekly columns (Monday preview, Friday wrap).
// Uses Sonnet 4 synchronous for deep cross-sector analysis.

import { getGenerationConfig } from '../_utils/wireGenerationConfig.js';
import { wireModelCall } from '../_utils/wireModelCall.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { isMarketHolidayToday } from '../_utils/marketHolidayCheck.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import {
  KIM_SYSTEM_PROMPT,
  PUBLISH_SECTOR_COLUMN_TOOL,
  REPORTER_PROFILES,
} from '../_utils/fantasyTimesPrompts.js';
import { getDefaultVisual, shouldOverrideVisual, callArtDirector } from '../_utils/fantasyTimesVisuals.js';
import { STOCK_DATA, TICKERS } from '../_utils/stockIntelligenceData.js';
import { getClaimsForReporter, formatClaimsForPrompt } from '../_utils/ingestedClaims.js';
import { buildConsensusBlock, checkEarningsAttribution } from '../_utils/fantasyTimesConsensus.js';
import { getWireFlags } from '../_utils/wireFlags.js';
import { extendToolWithAgentFacts, buildAgentFactsInstruction } from '../_utils/wireSchemaExtension.js';
import { resolveWireMarketDate } from '../_utils/wireCalendar.js';
import { publishStoryWithWire } from '../_utils/wireWriteThrough.js';
import { buildContinuityContext } from '../_utils/wireContinuity.js';
import { recordWireSample } from '../_utils/wireMetrics.js';

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

  if (isMarketHolidayToday()) {
    return res.status(200).json({ skipped: true, reason: 'Market holiday' });
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

    // ── Fetch consensus block for sector context ─────────────────────
    let consensusContext = '';
    try {
      const today = new Date().toISOString().split('T')[0];
      consensusContext = await buildConsensusBlock(today, 'post_close');
      logInfo('Consensus block built for Kim', { length: consensusContext.length });
    } catch (err) {
      console.error('[CONSENSUS] Failed to build Kim consensus:', err.message);
    }

    // ── FantasyTimes Wire (Spec V1.5 §4.5/§4.8) ────────────────────────
    const wireFlags = getWireFlags();
    const wireInstant = new Date();
    const marketDate = resolveWireMarketDate(wireInstant);
    const wireInstruction = wireFlags.writesEnabled ? buildAgentFactsInstruction('kim') : '';
    let continuityBlock = '';
    if (wireFlags.continuityEnabled) {
      try {
        continuityBlock = (await buildContinuityContext(db, { reporter: 'kim', marketDate })) || '';
      } catch (err) {
        logError('Continuity block failed (non-blocking)', { error: err.message });
      }
    }

    // Params (incl. the Sonnet latency pins) from the frozen execution
    // object; wireModelCall is the sole transport (P11 / R4-B2).
    const executionConfig = getGenerationConfig('kim_column', wireFlags);
    logInfo('Calling Claude Sonnet for column...', { model: executionConfig.model });
    const wireT0 = Date.now();

    const { response, generationConfig } = await wireModelCall(executionConfig, {
      system: KIM_SYSTEM_PROMPT + (consensusContext || '') + wireInstruction + continuityBlock,
      tools: [wireFlags.writesEnabled ? extendToolWithAgentFacts(PUBLISH_SECTOR_COLUMN_TOOL, 'kim') : PUBLISH_SECTOR_COLUMN_TOOL],
      tool_choice: { type: 'tool', name: 'publish_sector_column' },
      messages: [{ role: 'user', content: userMessage }],
    });

    const toolBlock = response.content.find((block) => block.type === 'tool_use');
    if (!toolBlock || !toolBlock.input) {
      logError('No tool_use block in column response');
      return res.status(500).json({ success: false, error: 'AI did not return structured story' });
    }

    const storyData = toolBlock.input;

    // ── Publish interceptor — check earnings attribution ──────────────
    const today = new Date().toISOString().split('T')[0];
    try {
      const consensusDoc = await db.collection('fantasyTimesConsensus').doc(today).get();
      const earnings = consensusDoc.exists ? consensusDoc.data()?.earnings : {};
      const earningsValid = [
        ...(earnings?.reportingToday || []),
        ...(earnings?.reportedYesterdayAfterClose || []),
      ];
      const check = checkEarningsAttribution(storyData.body, earningsValid);
      console.log(`[CONSENSUS] checkEarningsAttribution: ${check.passed ? 'PASS' : 'BLOCKED'} for Kim ${columnType}`);
      if (!check.passed) {
        console.warn(`[CONSENSUS] BLOCKED Kim column: earnings attribution for ${check.violations.join(', ')}`);
        try {
          await db.collection('fantasyTimesSuppressions').doc(today).set({
            [String(Date.now())]: {
              reporter: 'kim',
              columnType,
              violations: check.violations,
              headline: storyData.headline,
              body: storyData.body,
              suppressedAt: new Date().toISOString(),
            },
          }, { merge: true });
        } catch (suppErr) {
          console.error('[CONSENSUS] Failed to log suppression:', suppErr.message);
        }
        return res.status(200).json({
          success: false,
          reason: 'earnings_attribution_blocked',
          violations: check.violations,
        });
      }
    } catch (err) {
      console.error('[CONSENSUS] Interceptor error (non-blocking):', err.message);
    }

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

    // agentFacts stays in a PRIVATE local — never on storyDoc (§4.5 step 1).
    const { storyRef: docRef, wire: wireResult } = await publishStoryWithWire(db, {
      storyDoc,
      rawAgentFacts: wireFlags.writesEnabled ? toolBlock.input.agentFacts : null,
      stopReason: response.stop_reason,
      reporter: 'kim',
      seam: 'kim_column',
      primaryTicker: null,
      triggerRef: columnType,
      marketDate,
      generationConfig,
      now: wireInstant,
    });
    // Close the measured window immediately: nothing between the
    // publish and this line may be metrics I/O.
    const genPublishMs = Date.now() - wireT0;
    logInfo(`Published ${columnType} column ${docRef.id}`, { headline: storyDoc.headline });

    if (wireFlags.metricsEnabled) {
      // generate_publish is captured BEFORE any metrics I/O so the
      // instrument never appears inside the window it measures (§6.1 p95).
      await recordWireSample(db, { seam: 'kim_column', metric: 'generate_publish', ms: genPublishMs, marketDate });
      if (Number.isFinite(wireResult?.wireMs)) {
        await recordWireSample(db, { seam: 'kim_column', metric: 'wire_path', ms: wireResult.wireMs, marketDate });
      }
    }

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
