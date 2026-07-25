console.log('generate-pulse loaded');
// api/fantasytimes/generate-pulse.js
// Kai's Market Pulse — broad market summary generation.
// Called by Vercel cron 2-3x daily (pre_market, midday, post_close).

import Anthropic from '@anthropic-ai/sdk';
import { applySecurityMiddleware } from '../_utils/security.js';
import { isMarketHolidayToday } from '../_utils/marketHolidayCheck.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { FANTASYTIMES_TICKERS } from '../_utils/fantasyTimesTickers.js';
import {
  KAI_SYSTEM_PROMPT,
  PUBLISH_MARKET_PULSE_TOOL,
  REPORTER_PROFILES,
  getMarketContextBlock,
} from '../_utils/fantasyTimesPrompts.js';
import { getDefaultVisual, shouldOverrideVisual, callArtDirector } from '../_utils/fantasyTimesVisuals.js';
import { getClaimsForReporter, formatClaimsForPrompt } from '../_utils/ingestedClaims.js';
import { isIndex, INDEX_SYMBOLS as INDEX_SYMBOL_SET } from '../_utils/indexRegistry.js';
import { buildConsensusBlock, checkEarningsAttribution } from '../_utils/fantasyTimesConsensus.js';
import { getWireFlags } from '../_utils/wireFlags.js';
import { extendToolWithAgentFacts, buildAgentFactsInstruction } from '../_utils/wireSchemaExtension.js';
import { resolveWireMarketDate } from '../_utils/wireCalendar.js';
import { publishStoryWithWire } from '../_utils/wireWriteThrough.js';
import { buildContinuityContext } from '../_utils/wireContinuity.js';
import { recordWireSample } from '../_utils/wireMetrics.js';

export const config = { maxDuration: 60 };

const LOG_PREFIX = '[FantasyTimes:Kai:Pulse]';
const VALID_PERIODS = ['pre_market', 'midday', 'post_close'];
const INDEX_SYMBOLS = [...INDEX_SYMBOL_SET];

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

const PRICE_FETCH_TIMEOUT_MS = 5000;
const PRICE_FETCH_CONCURRENCY = 8;

async function fetchRealTimePrice(symbol) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PRICE_FETCH_TIMEOUT_MS);
  try {
    const url = `https://eodhd.com/api/real-time/${symbol}.US?api_token=${process.env.EODHD_API_KEY}&fmt=json`;
    const res = await fetch(url, { signal: controller.signal });
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
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchBatchPrices(symbols) {
  const results = [];
  for (let i = 0; i < symbols.length; i += PRICE_FETCH_CONCURRENCY) {
    const chunk = symbols.slice(i, i + PRICE_FETCH_CONCURRENCY);
    const settled = await Promise.allSettled(chunk.map(fetchRealTimePrice));
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value && r.value.price > 0) {
        results.push(r.value);
      }
    }
  }
  return results;
}

export default async function handler(req, res) {
  // Security + rate limiting
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
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

    // ── Fetch market context from Index Intelligence ──────────────────
    const { block: marketContextBlock, data: marketContextData } = await getMarketContextBlock();
    logInfo('Market context fetched', { hasContext: marketContextBlock.length > 0 });

    // ── Fetch consensus block from Newsroom Consensus Layer ──────────
    let consensusBlock = '';
    try {
      const today = new Date().toISOString().split('T')[0];
      consensusBlock = await buildConsensusBlock(today, period);
      logInfo('Consensus block built', { length: consensusBlock.length });
    } catch (err) {
      logError('Consensus block failed (non-blocking)', { error: err.message });
    }

    // ── Fetch index prices (SPY, QQQ, DIA, IWM) ──────────────────────
    logInfo('Fetching index prices...');
    const indexFetchStart = Date.now();
    const indexPrices = await fetchBatchPrices(INDEX_SYMBOLS);
    console.log(`[KAI:TIMING] Index price fetch took ${Date.now() - indexFetchStart}ms (${indexPrices.length}/${INDEX_SYMBOLS.length} symbols)`);
    logInfo('Index prices fetched', { count: indexPrices.length });

    // ── Fetch all tracked stock prices ─────────────────────────────────
    logInfo('Fetching tracked stock prices...');
    const stockFetchStart = Date.now();
    const stockPrices = await fetchBatchPrices(FANTASYTIMES_TICKERS);
    console.log(`[KAI:TIMING] Stock price fetch took ${Date.now() - stockFetchStart}ms (${stockPrices.length}/${FANTASYTIMES_TICKERS.length} symbols)`);
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
    const iwmData = indexPrices.find((p) => p.symbol === 'IWM');

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

    let userMessage = [
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

    // Enrich with high-impact ingested claims (if available)
    let claimsContext = '';
    try {
      const claims = await getClaimsForReporter('kai', { limit: 5 });
      const impactful = claims.filter(c =>
        (c.sentiment === 'bullish' || c.sentiment === 'bearish') && c.confidence === 'high'
      );
      claimsContext = formatClaimsForPrompt(impactful);
    } catch (e) {
      logError('Claims fetch failed for kai:', e.message);
    }
    if (claimsContext) {
      userMessage += `\n\nMARKET-MOVING CONTEXT:\n${claimsContext}`;
    }

    // ── FantasyTimes Wire (Spec V1.5 §4.5/§4.8) ──────────────────────────
    // Flags OFF appends '' and passes the pristine tool singleton by
    // identity — the outbound request payload is byte-identical to the
    // pre-Wire build (M8). marketDate is stamped from ONE instant, pre-call.
    const wireFlags = getWireFlags();
    const wireInstant = new Date();
    const marketDate = resolveWireMarketDate(wireInstant);
    const wireInstruction = wireFlags.writesEnabled ? buildAgentFactsInstruction('kai') : '';
    let continuityBlock = '';
    if (wireFlags.continuityEnabled) {
      try {
        continuityBlock = (await buildContinuityContext(db, { reporter: 'kai', marketDate })) || '';
      } catch (err) {
        logError('Continuity block failed (non-blocking)', { error: err.message });
      }
    }

    // ── Call Claude Haiku with Tool Use ──────────────────────────────────
    logInfo('Calling Claude API...', { model: REPORTER_PROFILES.kai.model, messageLength: userMessage.length });
    const anthropic = getAnthropicClient();
    const wireT0 = Date.now();

    const response = await anthropic.messages.create({
      model: REPORTER_PROFILES.kai.model,
      // Raised under the writes flag only — headroom for the agentFacts
      // block so R5 truncation stays rare (§4.2).
      max_tokens: wireFlags.writesEnabled ? 1200 : 800,
      temperature: 0.8,
      system: KAI_SYSTEM_PROMPT + (marketContextBlock || '') + (consensusBlock || '') + wireInstruction + continuityBlock,
      tools: [wireFlags.writesEnabled ? extendToolWithAgentFacts(PUBLISH_MARKET_PULSE_TOOL, 'kai') : PUBLISH_MARKET_PULSE_TOOL],
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
      if (!check.passed) {
        console.warn(`[CONSENSUS] BLOCKED Kai pulse: earnings attribution for ${check.violations.join(', ')}`);
        try {
          await db.collection('fantasyTimesSuppressions').doc(today).set({
            [String(Date.now())]: {
              reporter: 'kai',
              period,
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

    const moverTickers = topMovers.map((m) => m.symbol);

    // ── Determine primaryTicker and tickers array ─────────────────────
    const primaryTicker = storyData.primaryTicker || null;
    let storyTickers = [...moverTickers];
    if (primaryTicker && isIndex(primaryTicker)) {
      // Index-driven story: include all index symbols in tickers
      for (const sym of INDEX_SYMBOLS) {
        if (!storyTickers.includes(sym)) {
          storyTickers.push(sym);
        }
      }
    }

    // ── Build dataSnapshot ────────────────────────────────────────────
    const buildIndexSnap = (liveData, ctxKey) => {
      if (liveData) {
        return { price: liveData.price, change: liveData.change, changePercent: liveData.changePercent };
      }
      // Fallback to market context data if live fetch missed
      const ctx = marketContextData?.[ctxKey];
      if (ctx) {
        return { price: ctx.price, change: ctx.change, changePercent: ctx.changePercent };
      }
      return null;
    };

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
      tickers: storyTickers,
      primaryTicker,
      sector: 'Market',
      themes: Array.isArray(storyData.themes) ? storyData.themes : [],
      sentiment: storyData.sentiment || 'neutral',
      urgency: 'timely',
      recommended_action: storyData.recommended_action || 'RESEARCH',
      dataSnapshot: {
        period,
        marketDirection,
        avgIndexChange: Number(avgIndexChange.toFixed(2)),
        spy: buildIndexSnap(spyData, 'spy'),
        qqq: buildIndexSnap(qqqData, 'qqq'),
        dia: buildIndexSnap(diaData, 'dia'),
        iwm: buildIndexSnap(iwmData, 'iwm'),
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
    // agentFacts stays in a PRIVATE local — never on storyDoc (§4.5 step 1).
    const { storyRef: docRef, wire: wireResult } = await publishStoryWithWire(db, {
      storyDoc,
      rawAgentFacts: wireFlags.writesEnabled ? toolBlock.input.agentFacts : null,
      stopReason: response.stop_reason,
      reporter: 'kai',
      seam: 'kai_pulse',
      primaryTicker: storyDoc.primaryTicker,
      triggerRef: period,
      marketDate,
      now: wireInstant,
    });
    // Close the measured window immediately: nothing between the
    // publish and this line may be metrics I/O.
    const genPublishMs = Date.now() - wireT0;

    logInfo(`Published ${period} pulse ${docRef.id}`, {
      headline: storyDoc.headline,
      sentiment: storyDoc.sentiment,
      marketDirection,
    });

    // Art Director override for edge-case story types
    if (shouldOverrideVisual(storyDoc.reporter, storyDoc.type)) {
      await callArtDirector(storyDoc, docRef.id, db);
    }

    if (wireFlags.metricsEnabled) {
      // generate_publish is captured BEFORE any metrics I/O so the
      // instrument never appears inside the window it measures (§6.1 p95).
      await recordWireSample(db, { seam: 'kai_pulse', metric: 'generate_publish', ms: genPublishMs, marketDate });
      if (Number.isFinite(wireResult?.wireMs)) {
        await recordWireSample(db, { seam: 'kai_pulse', metric: 'wire_path', ms: wireResult.wireMs, marketDate });
      }
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
