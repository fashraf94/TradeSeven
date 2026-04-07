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
import { getClaimsForReporter, formatClaimsForPrompt } from '../_utils/ingestedClaims.js';
import { appendCatalyst, checkEarningsAttribution } from '../_utils/fantasyTimesConsensus.js';
import { fetchTickerCatalysts } from '../_utils/sonarCatalystFetch.js';
import { getValidatedCatalyst, validateAndCacheCatalyst } from '../_utils/validatedCatalystCache.js';

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
 * Classify BaggerBomb tier from ATR multiple and direction.
 * Aligns with BAGGER_TIERS / BUST_TIERS in baggerBombScoring.js:
 *   Positive: bagger (1.0x), double_bagger (1.5x), ten_bagger (2.0x)
 *   Negative: bust (1.0x), crash (1.5x), meltdown (2.0x)
 *   Below 1.0x or unknown direction: 'none'
 */
function classifyBaggerTier(atrMultiple, direction) {
  const m = Math.abs(Number(atrMultiple) || 0);
  const isDown = direction === 'down';
  if (m >= 2.0) return isDown ? 'meltdown' : 'ten_bagger';
  if (m >= 1.5) return isDown ? 'crash' : 'double_bagger';
  if (m >= 1.0) return isDown ? 'bust' : 'bagger';
  return 'none';
}

function getBaggerPoints(tier) {
  const pts = { bagger: '+15', double_bagger: '+30', ten_bagger: '+50',
                bust: '-10', crash: '-20', meltdown: '-35' };
  return pts[tier] || '0';
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

  // ── Fetch catalyst context via validated cache (Sonar + EODHD cross-validation) ──
  const resolvedDir = direction || (percentChange >= 0 ? 'up' : 'down');
  const companyName = STOCK_DATA[upperSymbol]?.name || '';
  const shortCompanyName = STOCK_DATA[upperSymbol]?.shortName || companyName || upperSymbol;
  let catalystData;
  let validatedSource;
  try {
    const cached = await getValidatedCatalyst(upperSymbol);
    if (cached && cached.confidence !== 'low') {
      catalystData = { catalysts: cached.catalyst, headlines: [], raw: cached.catalyst, citations: [], fallback: false };
      validatedSource = `validated_${cached.source}`;
      logInfo('Step 3: Using validated cache', { source: cached.source, confidence: cached.confidence });
    } else {
      const validated = await validateAndCacheCatalyst(upperSymbol, companyName, resolvedDir, percentChange);
      catalystData = { catalysts: validated.catalyst, headlines: [], raw: validated.catalyst, citations: [], fallback: false };
      validatedSource = `validated_${validated.source}`;
      logInfo('Step 3: Validated catalyst', { source: validated.source, confidence: validated.confidence, agreement: validated.agreementScore });
    }
  } catch (err) {
    logError('Validated cache failed, falling back to direct fetch', { error: err.message });
    catalystData = await fetchTickerCatalysts(upperSymbol, companyName, percentChange, resolvedDir);
    validatedSource = catalystData.fallback ? 'eodhd' : 'sonar';
  }

  // ── Load knowledge context (Tier 1 stocks) ─────────────────────
  let knowledgeExcerpt = '';
  if (TICKERS.includes(upperSymbol) && STOCK_DATA[upperSymbol]?.knowledgePackage) {
    knowledgeExcerpt = STOCK_DATA[upperSymbol].knowledgePackage.slice(0, 1500);
  }
  logInfo('Step 4: Knowledge loaded', { hasKnowledge: !!knowledgeExcerpt, excerptLength: knowledgeExcerpt.length });

  // ── Check consensus for existing catalyst ──────────────────────
  let consensusContext = '';
  try {
    const today = new Date().toISOString().split('T')[0];
    const consensusDoc = await db.collection('fantasyTimesConsensus').doc(today).get();
    if (consensusDoc.exists) {
      const existing = consensusDoc.data()?.catalysts?.[upperSymbol];
      if (existing) {
        consensusContext = `\n\nNEWSROOM CONTEXT: Another reporter attributed ${upperSymbol}'s move to: "${existing.catalyst}". Align with or update this attribution.\n`;
      }
    }
  } catch (err) {
    logError('Consensus read failed (non-blocking)', { error: err.message });
  }

  // ── Build user message ──────────────────────────────────────────
  let userMessage = [
    `STOCK MOVE ALERT:`,
    `- Symbol: ${upperSymbol}`,
    `- Company: ${shortCompanyName}`,
    `- Current Price: $${Number(currentPrice).toFixed(2)}`,
    `- Change: ${priceChange >= 0 ? '+' : ''}$${Number(priceChange).toFixed(2)} (${percentChange >= 0 ? '+' : ''}${Number(percentChange).toFixed(2)}%)`,
    `- Direction: ${direction || (percentChange >= 0 ? 'up' : 'down')}`,
    `- [INTERNAL - do not mention in story] Volatility Baseline (ATR-14): $${Number(atr14).toFixed(2)}`,
    `- [INTERNAL - do not mention in story] Volatility Multiple: ${Number(atrMultiple).toFixed(1)}x`,
    `- Sector: ${sector}`,
    '',
    `NEWS & CATALYST CONTEXT FOR ${upperSymbol}:`,
    catalystData.catalysts
      ? catalystData.catalysts
      : catalystData.headlines.length > 0
        ? catalystData.headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')
        : 'No recent catalyst context available. Focus on technicals.',
    '',
    'Use this context to explain WHY the stock moved. Be specific about the actual catalysts — name court cases, executive actions, policy changes, analyst upgrades/downgrades, or company announcements. Do not default to generic macro narratives if specific catalysts are available.',
    '',
    knowledgeExcerpt ? `COMPANY CONTEXT:\n${knowledgeExcerpt}\n` : '',
    `Write a Market Pulse story about this move. Use the publish_story tool.`,
  ]
    .filter(Boolean)
    .join('\n');

  // Enrich with ingested claims (if available)
  let claimsContext = '';
  try {
    const claims = await getClaimsForReporter('alex', { ticker: upperSymbol, limit: 5 });
    claimsContext = formatClaimsForPrompt(claims);
  } catch (e) {
    logError('Claims fetch failed for alex:', e.message);
  }
  if (claimsContext) {
    userMessage += `\n\nRECENT COMPANY INSIGHTS:\n${claimsContext}`;
  }
  if (consensusContext) {
    userMessage += consensusContext;
  }

  // ── BaggerBomb tier classification ────────────────────────────
  const resolvedDirection = direction || (percentChange >= 0 ? 'up' : 'down');
  const baggerTier = classifyBaggerTier(atrMultiple, resolvedDirection);

  userMessage += `\n\nBAGGERBOMB CONTEXT:
- Tier: ${baggerTier}
- [INTERNAL] Volatility Multiple: ${Number(atrMultiple).toFixed(1)}x
- Direction: ${resolvedDirection}
${baggerTier !== 'none' ? `- Points: ${getBaggerPoints(baggerTier)}` : '- No threshold crossed yet'}
Match your voice to this tier. Set baggerTier to "${baggerTier}" in your tool call.`;

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

  // ── Publish interceptor — check earnings attribution ────────────
  try {
    const today = new Date().toISOString().split('T')[0];
    const consensusDoc = await db.collection('fantasyTimesConsensus').doc(today).get();
    const earnings = consensusDoc.exists ? consensusDoc.data()?.earnings : {};
    const earningsValid = [
      ...(earnings?.reportingToday || []),
      ...(earnings?.reportedYesterdayAfterClose || []),
    ];
    const check = checkEarningsAttribution(storyData.body, earningsValid);
    if (!check.passed) {
      console.warn(`[CONSENSUS] BLOCKED Alex mover: earnings attribution for ${check.violations.join(', ')}`);
      try {
        await db.collection('fantasyTimesSuppressions').doc(today).set({
          [String(Date.now())]: {
            reporter: 'alex',
            ticker: upperSymbol,
            violations: check.violations,
            headline: storyData.headline,
            body: storyData.body,
            suppressedAt: new Date().toISOString(),
          },
        }, { merge: true });
      } catch (suppErr) {
        console.error('[CONSENSUS] Failed to log suppression:', suppErr.message);
      }
      return { success: false, reason: 'earnings_attribution_blocked', violations: check.violations };
    }
  } catch (err) {
    console.error('[CONSENSUS] Interceptor error (non-blocking):', err.message);
  }

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
    pullquote: typeof storyData.pullquote === 'string' && storyData.pullquote.length > 5
      ? storyData.pullquote.slice(0, 80) : null,
    baggerTier: baggerTier,
    dataSnapshot: {
      price: Number(currentPrice),
      change: Number(priceChange),
      percentChange: Number(percentChange),
      atrMultiple: Number(atrMultiple),
      direction: direction || (percentChange >= 0 ? 'up' : 'down'),
    },
    newsContext: catalystData.raw || catalystData.headlines,
    catalystSource: validatedSource || (catalystData.fallback ? 'eodhd' : 'sonar'),
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

  // Write catalyst to consensus
  try {
    const today = new Date().toISOString().split('T')[0];
    await appendCatalyst(today, upperSymbol, {
      direction: direction || (percentChange >= 0 ? 'up' : 'down'),
      percentChange: Number(percentChange),
      atrMultiple: Number(atrMultiple),
      catalyst: storyData.headline || storyData.subheadline || '',
      source: validatedSource || 'alex_mover',
      confidence: atrMultiple >= 2.0 ? 'high' : atrMultiple >= 1.5 ? 'medium' : 'low',
      reporter: 'alex',
    });
  } catch (err) {
    logError('Failed to append catalyst', { error: err.message });
  }

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

  // --- Cron/Admin Authentication ---
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
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
