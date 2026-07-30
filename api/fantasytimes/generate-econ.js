// api/fantasytimes/generate-econ.js
// Neta's Economics Desk — economic data recaps and weekly previews.
// Two modes: recap (cron during market hours) and preview (Sunday evening).

import { getGenerationConfig } from '../_utils/wireGenerationConfig.js';
import { wireModelCall } from '../_utils/wireModelCall.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { isMarketHolidayToday } from '../_utils/marketHolidayCheck.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { querySonar } from '../helpers/sonar.js';
import {
  NETA_RECAP_SYSTEM_PROMPT,
  NETA_PREVIEW_SYSTEM_PROMPT,
  PUBLISH_ECON_RECAP_TOOL,
  PUBLISH_ECON_PREVIEW_TOOL,
  REPORTER_PROFILES,
} from '../_utils/fantasyTimesPrompts.js';
import { getDefaultVisual, shouldOverrideVisual, callArtDirector } from '../_utils/fantasyTimesVisuals.js';
import { getClaimsForReporter, formatClaimsForPrompt } from '../_utils/ingestedClaims.js';
import { appendEconomics } from '../_utils/fantasyTimesConsensus.js';
import { getWireFlags } from '../_utils/wireFlags.js';
import { extendToolWithAgentFacts, buildAgentFactsInstruction } from '../_utils/wireSchemaExtension.js';
import {
  resolveWireMarketDate,
  deriveMarketDate,
  startOfEtDay,
  assertMaintainedYear,
} from '../_utils/wireCalendar.js';
import { getPreviousTradingDay } from '../_utils/marketSchedule.js';
import { getMacroEventsInWindow } from '../_utils/macroCalendar.js';
import {
  fetchEconomicEventsEODHD,
  joinOperandsToEvents,
  isSettled,
} from '../_utils/fetchEconomicEventsEODHD.js';
import {
  verifyEconPrint,
  parseEconOperand,
  assessEconPlausibility,
} from '../_utils/econPrintVerifier.js';
import { canonicalizeEconEvent } from '../_utils/wireIdentity.js';
import { econSubjectRefForSlug } from '../_utils/wireContracts.js';
import { publishStoryWithWire } from '../_utils/wireWriteThrough.js';
import { buildContinuityContext } from '../_utils/wireContinuity.js';
import { recordWireSample } from '../_utils/wireMetrics.js';

export const config = { maxDuration: 60 };

const LOG_PREFIX = '[FantasyTimes:Neta:Econ]';
const VALID_MODES = ['recap', 'preview'];

// R-A1 (Recap Restoration rulings, Jul 30 2026): Tier-1 for the RECAP gate
// is macroCalendar array membership — the feed-driven keyword/impact
// classifier that lived here is retired for this path. (Its twin in
// ingest-econ.js is a different consumer and stays as-is per the register.)

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
 * Fetch economic events from Sonar API.
 */
async function fetchEconomicEvents() {
  const todayET = getTodayET();
  const systemPrompt = `You are an economic calendar analyst. Generate a structured economic events calendar as JSON.

Respond ONLY with valid JSON, no markdown fences, no preamble.

Schema:
{
  "thisWeek": [
    {
      "date": "YYYY-MM-DD",
      "day": "Monday",
      "time": "10:00 AM ET",
      "event": "ISM Manufacturing PMI",
      "previous": "50.9",
      "estimate": "50.5",
      "actual": "51.2" or null,
      "impact": "high" | "medium" | "low",
      "category": "manufacturing" | "employment" | "inflation" | "housing" | "consumer" | "fed" | "gdp" | "trade" | "other",
      "brief": "One sentence on why this matters for markets right now"
    }
  ],
  "nextWeek": [],
  "highlight": "One sentence summary of the single most important event"
}

Rules:
- Include ALL major US economic releases for this week and next week
- "actual" should be null if the data hasn't been released yet, or the actual value if already released
- Order events chronologically within each week
- "impact" rating: high = likely to move markets (Fed decisions, NFP, CPI, GDP), medium = sector-specific impact, low = minor indicator
- Always include: Fed speakers/decisions, employment data, inflation data, GDP, PMIs, consumer confidence, housing data`;

  const userPrompt = `What are the major US economic data releases and Fed events for this week (starting ${todayET}) and next week? Include actual values for any data already released today.`;

  const { text } = await querySonar(systemPrompt, userPrompt, {
    maxTokens: 2000,
    temperature: 0.2,
    searchRecencyFilter: 'week',
  });

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in Sonar response');
  return JSON.parse(jsonMatch[0]);
}

export default async function handler(req, res) {
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

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!process.env.CLAUDE_API_KEY) {
    return res.status(500).json({ success: false, error: 'AI service not configured' });
  }

  const mode = req.query?.mode || req.body?.mode;
  if (!mode || !VALID_MODES.includes(mode)) {
    return res.status(400).json({
      success: false,
      error: `Invalid mode. Must be one of: ${VALID_MODES.join(', ')}`,
    });
  }

  try {
    const db = getFirebaseAdmin();
    logInfo(`Starting ${mode} generation`);

    if (mode === 'recap') {
      return await handleRecap(req, res, db);
    } else {
      return await handlePreview(req, res, db);
    }
  } catch (error) {
    logError('Generation failed', {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ success: false, error: 'Economic story generation failed' });
  }
}

/**
 * MODE A: Recap — generates stories for Tier-1 economic data releases.
 *
 * Recap Restoration mini-arc (spec V1.1 + Jul 30 rulings): deterministic
 * end-to-end. The Tier-1 set and release dates/times come from the
 * macroCalendar arrays (R-A1); operands come from EODHD /economic-events
 * (R-B1); the plausibility gate + settle delay guard ingestion (R-B1a);
 * referent dedup runs pre-model-call (C8/R-B4); every firing emits ONE
 * greppable outcome line carrying the F1 dual count (R-B6):
 *   outcome=<fetch_failed|empty_window|already_written|operand_implausible|wrote>
 *   fetched=<EODHD rows pre-filter> tier1=<released+settled Tier-1 count>
 */
async function handleRecap(req, res, db) {
  const wireInstant = new Date();
  const todayET = deriveMarketDate(wireInstant);
  // Two-session operand window: a release missed by every same-day firing
  // (outage) is recoverable the next morning; referent dedup makes the
  // overlap exactly-once (C8 "window overlap becomes resilience").
  // assertMaintainedYear closes the walker's 2028 silent-mislabel gap
  // before walking (R-B2, one-line port).
  assertMaintainedYear(todayET);
  const priorSessionET = getPreviousTradingDay(todayET);

  // R-A1: array membership IS the Tier-1 classification.
  const tier1Events = getMacroEventsInWindow({ fromDate: priorSessionET, toDate: todayET });

  // R-B1: operands from EODHD. A throw here is the one fetch_failed site
  // (R-B6) — distinguishable from an empty window by construction.
  let operandRows;
  try {
    operandRows = await fetchEconomicEventsEODHD({ fromDate: priorSessionET, toDate: todayET });
  } catch (err) {
    logError(`outcome=fetch_failed fetched=0 tier1=0 error=${err.message}`);
    return res.status(200).json({
      success: false, skipped: true, code: 'fetch_failed',
      reason: 'EODHD economic-events fetch failed',
    });
  }

  const joined = joinOperandsToEvents(tier1Events, operandRows);

  // Released = matched operand row with an actual present; settled per
  // R-B1a(ii) (release time + one cron tick).
  const released = joined.filter(({ event, operands }) =>
    operands && operands.actual !== null && operands.actual !== undefined
    && isSettled(event, wireInstant, todayET));

  // Priority when multiple uncovered: high-impact categories first (R-A1),
  // then chronological.
  released.sort((a, b) => {
    const impA = a.event.impact === 'high' ? 0 : 1;
    const impB = b.event.impact === 'high' ? 0 : 1;
    if (impA !== impB) return impA - impB;
    return a.event.date < b.event.date ? -1 : a.event.date > b.event.date ? 1 : 0;
  });

  // The single per-firing outcome line (F1 dual count + taxonomy code).
  const counts = { fetched: operandRows.length, tier1: released.length };
  const skip = (code, reason) => {
    logInfo(`outcome=${code} fetched=${counts.fetched} tier1=${counts.tier1}`);
    return res.status(200).json({ success: true, skipped: true, code, reason });
  };

  if (released.length === 0) {
    return skip('empty_window', 'No released Tier-1 events in window');
  }

  // C8(a)/(b) + R-B4: referent dedup BEFORE the model call. Identity =
  // (canonical event slug, referentDate). referentDate is a top-level story
  // field (never inside dataSnapshot — C1 freeze); the slug is recomputed
  // from the stored eventName, so no second identity field is needed.
  // Non-superseded = published and not stamped wireSuperseded.
  const referentDates = [...new Set(released.map((r) => r.event.date))];
  const existingDocs = [];
  for (const d of referentDates) {
    const snap = await db
      .collection('fantasyTimesStories')
      .where('type', '==', 'econ_recap')
      .where('referentDate', '==', d)
      .limit(50)
      .get();
    existingDocs.push(...snap.docs);
  }
  const covered = new Set(
    existingDocs
      .map((doc) => doc.data())
      .filter((s) => s.status === 'published' && !s.wireSuperseded)
      .map((s) => `${canonicalizeEconEvent(s.dataSnapshot?.eventName)}:${s.referentDate}`)
  );

  // First uncovered candidate that passes the R-B1a plausibility gate;
  // held candidates log loud and are skipped (one bad operand must not
  // starve the day's remaining events).
  let heldCount = 0;
  let chosen = null;
  for (const candidate of released) {
    const slug = canonicalizeEconEvent(candidate.event.event);
    if (covered.has(`${slug}:${candidate.event.date}`)) continue;
    const gate = assessEconPlausibility(candidate.event.category, candidate.operands);
    if (gate.hold) {
      heldCount += 1;
      logError(
        `operand_implausible category=${candidate.event.category} event="${candidate.event.event}" ` +
        `matchedType="${candidate.matchedType}" reason=${gate.reason} detail="${gate.detail}"`,
      );
      continue;
    }
    chosen = { ...candidate, slug };
    break;
  }

  if (!chosen) {
    if (heldCount > 0) {
      return skip('operand_implausible', `${heldCount} candidate(s) held by the plausibility gate`);
    }
    return skip('already_written', 'All released Tier-1 events already covered');
  }

  const event = chosen.event;
  // Publication-side verification status (R2 vocabulary). The unparseable
  // case never reaches here — the plausibility gate held it above.
  const verification = verifyEconPrint(chosen.operands);
  const previousParsed = parseEconOperand(chosen.operands.previous);
  logInfo('Generating recap for event', { event: event.event, verification: verification.status });

  // Fetch SPY/QQQ reaction
  const [spyData, qqqData] = await Promise.all([
    fetchRealTimePrice('SPY'),
    fetchRealTimePrice('QQQ'),
  ]);

  // Operand lines render from the PARSED values — the same numbers stored
  // in dataSnapshot and appended to consensus, so prompt, snapshot and
  // consensus can never disagree (§9 display-agreement by construction).
  // A missing estimate degrades honestly (R2: never reject wholesale).
  const estimateLine = verification.status === 'VERIFIED'
    ? `Estimate: ${verification.estimateValue}`
    : 'Estimate: not available (no consensus published — do NOT invent an expectation)';
  const verificationLine = verification.status === 'VERIFIED'
    ? 'Print verification: VERIFIED (actual compared against consensus estimate)'
    : 'Print verification: NOT VERIFIABLE (missing consensus estimate)';

  let userMessage = [
    `ECONOMIC DATA RELEASE:`,
    `Event: ${event.event}`,
    `Date: ${event.date} at ${event.time}`,
    `Category: ${event.category}`,
    `Impact: ${event.impact}`,
    `Previous: ${previousParsed.ok ? previousParsed.value : 'N/A'}`,
    estimateLine,
    `Actual: ${verification.actualValue}`,
    verificationLine,
    '',
    'MARKET REACTION:',
    spyData ? `SPY: $${spyData.price.toFixed(2)} (${spyData.changePercent >= 0 ? '+' : ''}${spyData.changePercent.toFixed(2)}%)` : 'SPY: unavailable',
    qqqData ? `QQQ: $${qqqData.price.toFixed(2)} (${qqqData.changePercent >= 0 ? '+' : ''}${qqqData.changePercent.toFixed(2)}%)` : 'QQQ: unavailable',
    '',
    `Write an economic data recap for this ${event.event} release. Use the publish_econ_recap tool.`,
  ].join('\n');

  // Enrich with ingested claims (if available)
  let recapClaimsContext = '';
  try {
    const claims = await getClaimsForReporter('neta', { source: 'fed_event', limit: 6 });
    recapClaimsContext = formatClaimsForPrompt(claims);
  } catch (e) {
    logError('Claims fetch failed for neta recap:', e.message);
  }
  if (recapClaimsContext) {
    userMessage += `\n\nFED/MACRO EVENT INSIGHTS (from press conference analysis):\n${recapClaimsContext}`;
  }

  // ── FantasyTimes Wire (Spec V1.5 §4.5/§4.8; V1.6 A2/A4) ──────────────
  // Single-eventType seam: pinned to econ_print (A4). The subjectRef is
  // SERVER-STAMPED from the trigger's event name pre-call (A2) — the pinned
  // schema never offers the field to the model. wireInstant/the canonical
  // slug were established at the top of handleRecap (B5: pre-model-call);
  // the Wire receipt bucket stays firing-scoped — never re-keyed (C8).
  const wireFlags = getWireFlags();
  const marketDate = resolveWireMarketDate(wireInstant);
  const wireEconSlug = chosen.slug;
  const wireInstruction = wireFlags.writesEnabled
    ? buildAgentFactsInstruction('neta', { pinEventType: 'econ_print' })
    : '';
  let continuityBlock = '';
  if (wireFlags.continuityEnabled) {
    try {
      continuityBlock = (await buildContinuityContext(db, { reporter: 'neta', marketDate })) || '';
    } catch (err) {
      logError('Continuity block failed (non-blocking)', { error: err.message });
    }
  }

  // Params from the frozen execution object; wireModelCall is the sole
  // transport (P11 / R4-B2).
  const executionConfig = getGenerationConfig('neta_econ_recap', wireFlags);
  logInfo('Calling Claude API for recap...', { model: executionConfig.model });
  const wireT0 = Date.now();

  const { response, generationConfig } = await wireModelCall(executionConfig, {
    system: NETA_RECAP_SYSTEM_PROMPT + wireInstruction + continuityBlock,
    tools: [wireFlags.writesEnabled
      ? extendToolWithAgentFacts(PUBLISH_ECON_RECAP_TOOL, 'neta', { pinEventType: 'econ_print' })
      : PUBLISH_ECON_RECAP_TOOL],
    tool_choice: { type: 'tool', name: 'publish_econ_recap' },
    messages: [{ role: 'user', content: userMessage }],
  });

  const toolBlock = response.content.find((block) => block.type === 'tool_use');
  if (!toolBlock || !toolBlock.input) {
    logError('No tool_use block in recap response');
    return res.status(500).json({ success: false, error: 'AI did not return structured story' });
  }

  const storyData = toolBlock.input;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REPORTER_PROFILES.neta.expiryHours * 60 * 60 * 1000);

  const storyDoc = {
    reporter: 'neta',
    reporterName: REPORTER_PROFILES.neta.name,
    reporterBeat: REPORTER_PROFILES.neta.beat,
    type: 'econ_recap',
    headline: String(storyData.headline || '').slice(0, 120),
    subheadline: String(storyData.subheadline || '').slice(0, 200),
    body: String(storyData.body || ''),
    tickers: ['SPY', 'QQQ'],
    primaryTicker: null,
    sector: 'Economy',
    themes: Array.isArray(storyData.themes) ? storyData.themes : [],
    sentiment: storyData.sentiment || 'neutral',
    urgency: 'timely',
    recommended_action: storyData.recommended_action || 'RESEARCH',
    // referentDate: the EVENT's release date — the C8(a) identity component
    // the pre-call dedup queries. Top-level by ruling R-B4 (never inside
    // dataSnapshot: C1 photographs snapshot key sets).
    referentDate: event.date,
    dataSnapshot: {
      // Same frozen key set as before (C1); values are now the PARSED
      // numbers the prompt rendered — one source, no drift (§9).
      eventName: event.event,
      category: event.category,
      actual: verification.actualValue,
      estimate: verification.status === 'VERIFIED' ? verification.estimateValue : null,
      previous: previousParsed.ok ? previousParsed.value : null,
      impact: event.impact,
      spy: spyData ? { price: spyData.price, changePercent: spyData.changePercent } : null,
      qqq: qqqData ? { price: qqqData.price, changePercent: qqqData.changePercent } : null,
    },
    newsContext: [],
    generatedBy: REPORTER_PROFILES.neta.model,
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

  // agentFacts stays in a PRIVATE local — never on storyDoc (§4.5 step 1).
  // triggerRef canonicalizes the Sonar event name so retries of the same
  // release converge on one idempotency key (§4.5; degraded slug for
  // unknown names — the accepted Neta alias limitation). serverSubjectRef
  // is the A2 server stamp: a known slug maps to its closed subject
  // (CPI, NFP, …); unknown aliases stamp null and render the generic form.
  const { storyRef: docRef, wire: wireResult } = await publishStoryWithWire(db, {
    storyDoc,
    rawAgentFacts: wireFlags.writesEnabled ? toolBlock.input.agentFacts : null,
    stopReason: response.stop_reason,
    reporter: 'neta',
    seam: 'neta_econ_recap',
    primaryTicker: null,
    triggerRef: wireEconSlug,
    marketDate,
    generationConfig,
    serverSubjectRef: econSubjectRefForSlug(wireEconSlug),
    now: wireInstant,
  });
  // Close the measured window immediately: nothing between the
  // publish and this line may be metrics I/O.
  const genPublishMs = Date.now() - wireT0;
  logInfo(`outcome=wrote fetched=${counts.fetched} tier1=${counts.tier1} storyId=${docRef.id}`,
    { event: event.event, headline: storyDoc.headline });

  if (wireFlags.metricsEnabled) {
    // generate_publish is captured BEFORE any metrics I/O so the
    // instrument never appears inside the window it measures (§6.1 p95).
    await recordWireSample(db, { seam: 'neta_econ_recap', metric: 'generate_publish', ms: genPublishMs, marketDate });
    if (Number.isFinite(wireResult?.wireMs)) {
      await recordWireSample(db, { seam: 'neta_econ_recap', metric: 'wire_path', ms: wireResult.wireMs, marketDate });
    }
  }

  // Write economic event to consensus. R-B3: the FINAL-LOCK §3 join stands
  // — the bucket key is the locked UTC expression, evaluated on the SAME
  // instant as the story's publishedAt (`now`), so the adapter join off
  // publishedAt lands on this doc by construction, including across the
  // UTC midnight boundary. Never re-key to the event date (C8(c) superseded).
  try {
    const consensusDate = now.toISOString().split('T')[0];
    await appendEconomics(consensusDate, {
      event: event.event,
      actual: verification.actualValue,
      expected: verification.status === 'VERIFIED' ? verification.estimateValue : null,
      impact: storyData.sentiment || event.impact || 'neutral',
      time: now.toISOString(),
    });
  } catch (err) {
    console.error('[CONSENSUS] Failed to append economics:', err.message);
  }

  // Art Director override for edge-case story types
  if (shouldOverrideVisual(storyDoc.reporter, storyDoc.type)) {
    await callArtDirector(storyDoc, docRef.id, db);
  }

  return res.status(200).json({
    success: true,
    storyId: docRef.id,
    headline: storyDoc.headline,
    event: event.event,
    mode: 'recap',
  });
}

/**
 * MODE B: Preview — generates weekly economic calendar preview (Sunday evening).
 */
async function handlePreview(req, res, db) {
  // Dedup: one preview per week. ET day boundary via startOfEtDay — the
  // hardcoded -05:00 idiom was an hour early all summer (R-B2 register).
  const startOfDay = startOfEtDay(new Date());

  const dedupQuery = await db
    .collection('fantasyTimesStories')
    .where('reporter', '==', 'neta')
    .where('type', '==', 'econ_preview')
    .where('publishedAt', '>', startOfDay)
    .limit(1)
    .get();

  if (!dedupQuery.empty) {
    logInfo('Weekly preview already published today');
    return res.status(200).json({
      success: false,
      reason: 'dedup',
      message: 'Weekly economic preview already published today',
    });
  }

  // Sonar remains the PREVIEW source (R-B1: recap is deterministic; preview
  // keeps the forward-looking narrative feed). A Sonar outage is the
  // preview's fetch_failed site (R-B6) — distinguishable from a quiet week.
  logInfo('Fetching economic events from Sonar for preview...');
  let calendar;
  try {
    calendar = await fetchEconomicEvents();
  } catch (err) {
    logError(`outcome=fetch_failed mode=preview error=${err.message}`);
    return res.status(200).json({
      success: false, skipped: true, code: 'fetch_failed',
      reason: 'Sonar economic-events fetch failed',
    });
  }
  const nextWeekEvents = calendar.nextWeek || [];
  const thisWeekRemaining = (calendar.thisWeek || []).filter(
    (e) => e.actual === null || e.actual === undefined
  );

  // Build calendar summary for the preview
  const allUpcoming = [...thisWeekRemaining, ...nextWeekEvents];

  if (allUpcoming.length === 0) {
    logInfo('No upcoming events found for preview');
    return res.status(200).json({
      success: true,
      skipped: true,
      reason: 'No upcoming economic events',
    });
  }

  const eventLines = allUpcoming.map(
    (e) => `- ${e.day} ${e.date} at ${e.time}: ${e.event} (impact: ${e.impact}, estimate: ${e.estimate || 'TBD'}, previous: ${e.previous || 'N/A'})`
  );

  let userMessage = [
    'WEEKLY ECONOMIC CALENDAR PREVIEW:',
    '',
    `Highlight: ${calendar.highlight || 'Multiple releases scheduled'}`,
    '',
    'UPCOMING EVENTS:',
    ...eventLines,
    '',
    `Total events: ${allUpcoming.length}`,
    `High-impact events: ${allUpcoming.filter((e) => e.impact === 'high').length}`,
    '',
    'Write a weekly economic calendar preview. Use the publish_econ_preview tool.',
  ].join('\n');

  // Enrich with ingested claims (if available)
  let previewClaimsContext = '';
  try {
    const claims = await getClaimsForReporter('neta', { source: 'fed_event', limit: 6 });
    previewClaimsContext = formatClaimsForPrompt(claims);
  } catch (e) {
    logError('Claims fetch failed for neta preview:', e.message);
  }
  if (previewClaimsContext) {
    userMessage += `\n\nRECENT MACRO CONTEXT:\n${previewClaimsContext}`;
  }

  // ── FantasyTimes Wire (Spec V1.5 §4.5/§4.8; V1.6 A2/A4) ──────────────
  // Single-eventType seam: pinned to econ_preview (A4) — the pinned schema
  // excludes direction (forbidden on previews) and subjectRef (server-
  // owned). The weekly preview's trigger is the whole calendar, not a
  // single release, so the server stamp is null (generic digest form).
  const wireFlags = getWireFlags();
  const wireInstant = new Date();
  const marketDate = resolveWireMarketDate(wireInstant);
  const wireInstruction = wireFlags.writesEnabled
    ? buildAgentFactsInstruction('neta', { pinEventType: 'econ_preview' })
    : '';
  let continuityBlock = '';
  if (wireFlags.continuityEnabled) {
    try {
      continuityBlock = (await buildContinuityContext(db, { reporter: 'neta', marketDate })) || '';
    } catch (err) {
      logError('Continuity block failed (non-blocking)', { error: err.message });
    }
  }

  logInfo('Calling Claude Sonnet for weekly preview...');
  const wireT0 = Date.now();

  // Weekly preview uses Sonnet for deeper analysis (model + latency pins in
  // the seam table); wireModelCall is the sole transport (P11 / R4-B2).
  const executionConfig = getGenerationConfig('neta_econ_preview', wireFlags);
  const { response, generationConfig } = await wireModelCall(executionConfig, {
    system: NETA_PREVIEW_SYSTEM_PROMPT + wireInstruction + continuityBlock,
    tools: [wireFlags.writesEnabled
      ? extendToolWithAgentFacts(PUBLISH_ECON_PREVIEW_TOOL, 'neta', { pinEventType: 'econ_preview' })
      : PUBLISH_ECON_PREVIEW_TOOL],
    tool_choice: { type: 'tool', name: 'publish_econ_preview' },
    messages: [{ role: 'user', content: userMessage }],
  });

  const toolBlock = response.content.find((block) => block.type === 'tool_use');
  if (!toolBlock || !toolBlock.input) {
    logError('No tool_use block in preview response');
    return res.status(500).json({ success: false, error: 'AI did not return structured story' });
  }

  const storyData = toolBlock.input;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REPORTER_PROFILES.neta.expiryHours * 60 * 60 * 1000);

  const storyDoc = {
    reporter: 'neta',
    reporterName: REPORTER_PROFILES.neta.name,
    reporterBeat: REPORTER_PROFILES.neta.beat,
    type: 'econ_preview',
    headline: String(storyData.headline || '').slice(0, 120),
    subheadline: String(storyData.subheadline || '').slice(0, 200),
    body: String(storyData.body || ''),
    tickers: ['SPY', 'QQQ'],
    primaryTicker: null,
    sector: 'Economy',
    themes: Array.isArray(storyData.themes) ? storyData.themes : [],
    sentiment: storyData.sentiment || 'neutral',
    urgency: 'timely',
    recommended_action: storyData.recommended_action || 'RESEARCH',
    dataSnapshot: {
      weekHighlight: storyData.weekHighlight || calendar.highlight || '',
      totalEvents: allUpcoming.length,
      highImpactCount: allUpcoming.filter((e) => e.impact === 'high').length,
    },
    newsContext: [],
    generatedBy: 'claude-sonnet-4-6',
    batchId: null,
    publishedAt: now,
    expiresAt: expiresAt,
    status: 'published',
  };

  // Stamp visual fields
  const { visualType: previewVisualType, visualConfig: previewVisualConfig } = getDefaultVisual(
    storyDoc.reporter, storyDoc.type, storyDoc.dataSnapshot, storyDoc.primaryTicker
  );
  storyDoc.visualType = previewVisualType;
  storyDoc.visualConfig = previewVisualConfig;

  // agentFacts stays in a PRIVATE local — never on storyDoc (§4.5 step 1).
  const { storyRef: docRef, wire: wireResult } = await publishStoryWithWire(db, {
    storyDoc,
    rawAgentFacts: wireFlags.writesEnabled ? toolBlock.input.agentFacts : null,
    stopReason: response.stop_reason,
    reporter: 'neta',
    seam: 'neta_econ_preview',
    primaryTicker: null,
    triggerRef: 'week',
    marketDate,
    generationConfig,
    now: wireInstant,
  });
  // Close the measured window immediately: nothing between the
  // publish and this line may be metrics I/O.
  const genPublishMs = Date.now() - wireT0;
  logInfo(`Published weekly preview ${docRef.id}`, { headline: storyDoc.headline });

  if (wireFlags.metricsEnabled) {
    // generate_publish is captured BEFORE any metrics I/O so the
    // instrument never appears inside the window it measures (§6.1 p95).
    await recordWireSample(db, { seam: 'neta_econ_preview', metric: 'generate_publish', ms: genPublishMs, marketDate });
    if (Number.isFinite(wireResult?.wireMs)) {
      await recordWireSample(db, { seam: 'neta_econ_preview', metric: 'wire_path', ms: wireResult.wireMs, marketDate });
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
    mode: 'preview',
  });
}
