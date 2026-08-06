console.log('generate-mover loaded');
// api/fantasytimes/generate-mover.js
// Alex's Stock Spotlight — individual stock mover story generation.
// POST endpoint called when ATR threshold crossed.

import { getGenerationConfig } from '../_utils/wireGenerationConfig.js';
import { wireModelCall } from '../_utils/wireModelCall.js';
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
import { getWireFlags } from '../_utils/wireFlags.js';
import { extendToolWithAgentFacts, buildAgentFactsInstruction } from '../_utils/wireSchemaExtension.js';
import { resolveWireMarketDate } from '../_utils/wireCalendar.js';
import { publishStoryWithWire } from '../_utils/wireWriteThrough.js';
import { buildContinuityContext } from '../_utils/wireContinuity.js';
import { recordWireSample } from '../_utils/wireMetrics.js';
import { lintStoryUnits } from '../_utils/unitsLint.js';
import { buildMoverDataSnapshot } from '../_utils/moverTypedFacts.js';
import { fetchExaCatalystChannels, buildRetrievalChannels, renderRetrievalChannelsBlock } from '../_utils/exaCatalystFetch.js';
import { EXA_RETRIEVAL_ENABLED } from '../../src/config/featureFlags.js';

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

// NOTE (F3): the former getBaggerPoints() injected a numeric point value
// (crash: '-20', …) into the prompt — the exact operand that produced the
// "Wiping $20 BaggerBomb Points" defect. Point impact is battle-relative and
// per-player, unknowable at generation time, so NO point value is ever handed
// to the model. Removed on purpose; game relevance is qualitative-only.

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
  let validatedConfidence = null;
  try {
    const cached = await getValidatedCatalyst(upperSymbol);
    if (cached && cached.confidence !== 'low') {
      catalystData = { catalysts: cached.catalyst, headlines: [], raw: cached.catalyst, citations: [], fallback: false };
      validatedSource = `validated_${cached.source}`;
      validatedConfidence = cached.confidence;
      logInfo('Step 3: Using validated cache', { source: cached.source, confidence: cached.confidence });
    } else {
      const validated = await validateAndCacheCatalyst(upperSymbol, companyName, resolvedDir, percentChange);
      catalystData = { catalysts: validated.catalyst, headlines: [], raw: validated.catalyst, citations: [], fallback: false };
      validatedSource = `validated_${validated.source}`;
      validatedConfidence = validated.confidence;
      logInfo('Step 3: Validated catalyst', { source: validated.source, confidence: validated.confidence, agreement: validated.agreementScore });
    }
  } catch (err) {
    logError('Validated cache failed, falling back to direct fetch', { error: err.message });
    catalystData = await fetchTickerCatalysts(upperSymbol, companyName, percentChange, resolvedDir);
    validatedSource = catalystData.fallback ? 'eodhd' : 'sonar';
    // Direct Sonar success is not corroborated → context-grade, never headline.
    validatedConfidence = null;
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

  // ── Retrieval channels (F2, downgraded per C9): tag evidence as
  //    [ATTRIBUTION] (concrete, trigger-day-dated) vs [CONTEXT] (color only).
  //    The tag is the structural signal the headline rule keys off. EXA is
  //    flag-gated + supplementary; the honest floor holds when attribution is
  //    empty (the expected outcome on a fast mover). Never blocks the write.
  const catalystMarketDate = new Date().toISOString().split('T')[0];
  let exaChannels = null;
  if (EXA_RETRIEVAL_ENABLED) {
    try {
      exaChannels = await fetchExaCatalystChannels({
        symbol: upperSymbol,
        companyName: shortCompanyName,
        direction: resolvedDir,
        marketDate: catalystMarketDate,
      });
      logInfo('Step 3b: EXA channels', {
        attribution: exaChannels.attribution.length,
        context: exaChannels.context.length,
        degraded: exaChannels.degraded,
      });
    } catch (err) {
      logError('EXA channel fetch failed (non-blocking)', { error: err.message });
    }
  }
  const channels = buildRetrievalChannels({
    validatedCatalyst: catalystData.catalysts,
    validatedConfidence,
    exaChannels,
  });
  if (!catalystData.catalysts && Array.isArray(catalystData.headlines)) {
    for (const h of catalystData.headlines) channels.context.push({ source: 'eodhd', snippet: String(h) });
  }
  const retrievalBlock = renderRetrievalChannelsBlock(channels);

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
    retrievalBlock,
    '',
    'Attribute the move in your HEADLINE only to an [ATTRIBUTION]-tagged item above. If [ATTRIBUTION] is empty, keep the honest "no clear catalyst identified" framing and lead with the technicals — that is the correct call on a fast move, not a gap to fill. A [CONTEXT] item is color only; it never drives the headline.',
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
${baggerTier !== 'none' ? '- This move clears the tier above.' : '- No threshold crossed yet'}
POINTS/UNITS RULE: game relevance is QUALITATIVE only. Never state a numeric point value (point impact is battle-relative and per-player, unknowable here) and never attach a currency symbol to points. Match your voice to this tier. Set baggerTier to "${baggerTier}" in your tool call.`;

  // ── FantasyTimes Wire (Spec V1.5 §4.5/§4.8) ────────────────────────
  // Flags OFF appends '' and passes the pristine tool singleton by
  // identity — byte-identical outbound payload (M8). marketDate stamped
  // from one instant, pre-call.
  const wireFlags = getWireFlags();
  const wireInstant = new Date();
  const marketDate = resolveWireMarketDate(wireInstant);
  const wireInstruction = wireFlags.writesEnabled ? buildAgentFactsInstruction('alex') : '';
  let continuityBlock = '';
  if (wireFlags.continuityEnabled) {
    try {
      continuityBlock = (await buildContinuityContext(db, { reporter: 'alex', marketDate })) || '';
    } catch (err) {
      logError('Continuity block failed (non-blocking)', { error: err.message });
    }
  }

  // ── Call Claude Haiku with Tool Use ──────────────────────────────
  // Params from the frozen execution object; wireModelCall is the sole
  // transport (P11 / R4-B2).
  const executionConfig = getGenerationConfig('alex_mover', wireFlags);
  logInfo(`Generating story for ${upperSymbol} (${percentChange}%, ${atrMultiple}x ATR)`);
  logInfo('Step 5: Calling Claude API...', { model: executionConfig.model, messageLength: userMessage.length });
  const wireT0 = Date.now();

  const { response, generationConfig } = await wireModelCall(executionConfig, {
    system: ALEX_SYSTEM_PROMPT + wireInstruction + continuityBlock,
    tools: [wireFlags.writesEnabled ? extendToolWithAgentFacts(PUBLISH_STORY_TOOL, 'alex') : PUBLISH_STORY_TOOL],
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

  // ── Publish interceptor — deterministic units/points belt (F3) ──
  // Two held patterns; a match holds + logs `units_collision`, same posture as
  // the earnings interceptor / operand_implausible. Catches what no prompt
  // rule can guarantee: a currency symbol fused to points, or any numeral bound
  // to "BaggerBomb points" (the original defect, both halves).
  const unitsCheck = lintStoryUnits({
    headline: storyData.headline,
    subheadline: storyData.subheadline,
    body: storyData.body,
    pullquote: storyData.pullquote,
  });
  if (unitsCheck.held) {
    console.warn(`[UNITS] HELD Alex mover ${upperSymbol}: units_collision`, JSON.stringify(unitsCheck.violations));
    try {
      const today = new Date().toISOString().split('T')[0];
      await db.collection('fantasyTimesSuppressions').doc(today).set({
        [String(Date.now())]: {
          reporter: 'alex',
          ticker: upperSymbol,
          code: 'units_collision',
          violations: unitsCheck.violations,
          headline: storyData.headline,
          body: storyData.body,
          suppressedAt: new Date().toISOString(),
        },
      }, { merge: true });
    } catch (suppErr) {
      console.error('[UNITS] Failed to log suppression:', suppErr.message);
    }
    return { success: false, reason: 'units_collision', violations: unitsCheck.violations };
  }

  // ── Write to Firestore ──────────────────────────────────────────
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REPORTER_PROFILES.alex.expiryHours * 60 * 60 * 1000);

  // C1(i): the typed price snapshot is built by a constructor whose signature
  // CANNOT receive the retrieval payload — retrieval (catalystData) is merged
  // only into the prompt/newsContext, strictly downstream of this call.
  const dataSnapshot = buildMoverDataSnapshot({ currentPrice, priceChange, percentChange, atrMultiple, direction });

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
    dataSnapshot,
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
  // agentFacts stays in a PRIVATE local — never on storyDoc (§4.5 step 1).
  const { storyRef: docRef, wire: wireResult } = await publishStoryWithWire(db, {
    storyDoc,
    rawAgentFacts: wireFlags.writesEnabled ? toolBlock.input.agentFacts : null,
    stopReason: response.stop_reason,
    reporter: 'alex',
    seam: 'alex_mover',
    primaryTicker: upperSymbol,
    triggerRef: upperSymbol,
    marketDate,
    generationConfig,
    now: wireInstant,
  });
  // Close the measured window immediately: nothing between the
  // publish and this line may be metrics I/O.
  const genPublishMs = Date.now() - wireT0;

  logInfo(`Published story ${docRef.id} for ${upperSymbol}`, {
    headline: storyDoc.headline,
    sentiment: storyDoc.sentiment,
  });

  if (wireFlags.metricsEnabled) {
    // generate_publish is captured BEFORE any metrics I/O so the
    // instrument never appears inside the window it measures (§6.1 p95).
    await recordWireSample(db, { seam: 'alex_mover', metric: 'generate_publish', ms: genPublishMs, marketDate });
    if (Number.isFinite(wireResult?.wireMs)) {
      await recordWireSample(db, { seam: 'alex_mover', metric: 'wire_path', ms: wireResult.wireMs, marketDate });
    }
  }

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
