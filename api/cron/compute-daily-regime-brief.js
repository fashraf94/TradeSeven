// api/cron/compute-daily-regime-brief.js
// Daily cron: generates the forward-looking regime brief injected into
// Gemma's Voice Layer Block 3.5 via anchorContext.
//
// Schedule (registered in vercel.json): 30 12 * * 1-5
//   = 12:30 UTC Mon–Fri = 7:30 AM EST / 8:30 AM EDT
//   ~55 minutes after compute-index-intelligence's later slot (30 11 UTC),
//   giving marketContext + stockRankings time to land.
//
// Flow:
//   1. Idempotency guard — skip if indexIntelligence/dailyRegimeBrief.forDate === today
//   2. Gather inputs in parallel: Firestore reads + Sonar fetchers
//   3. Build prompt, call Sonnet with forced Tool Use + 45s timeout
//   4. Write result to indexIntelligence/dailyRegimeBrief
//
// On Sonar fetcher failure: pass empty arrays to the prompt, record in
// sourceFailures. On Sonnet failure: 500 and do NOT overwrite the existing
// doc — prior day's brief stays until next successful run.
//
// DRB stale fix (Oct 29 2026): every answer logs its stop_reason and usage.
// Only a missing or empty brief fails the run: an answer cut off before
// `themes` (or `keyEvents`) still keeps the day, storing [] for the lost
// field and naming the loss in sourceFailures (readBriefAnswer).

import Anthropic from '@anthropic-ai/sdk';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { fetchMacroEvents } from '../_utils/fetchMacroEvents.js';
import { fetchEarningsCalendarEODHD } from '../_utils/fetchEarningsCalendarEODHD.js';
import {
  DAILY_REGIME_BRIEF_TOOL,
  buildDailyRegimeBriefPrompt,
} from '../_utils/dailyRegimeBriefPrompt.js';
import { logDailyRegimeBrief } from '../_utils/shadowLogger.js';

export const config = { maxDuration: 60 };

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const LOG_PREFIX = '[DailyRegimeBrief]';

function logInfo(message, data = null) {
  const ts = new Date().toISOString();
  if (data) console.log(`${ts} ${LOG_PREFIX} ${message}`, JSON.stringify(data));
  else console.log(`${ts} ${LOG_PREFIX} ${message}`);
}

function logError(message, data = null) {
  const ts = new Date().toISOString();
  if (data) console.error(`${ts} ${LOG_PREFIX} ${message}`, JSON.stringify(data));
  else console.error(`${ts} ${LOG_PREFIX} ${message}`);
}

// ---------------------------------------------------------------------------
// Anthropic client (lazy singleton)
// ---------------------------------------------------------------------------

let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
      maxRetries: 2,
    });
  }
  return anthropicClient;
}

const SONNET_MODEL = 'claude-sonnet-4-6';
const SONNET_TIMEOUT_MS = 45_000;

/**
 * The one model call, raced against the 45 s timeout. Exported so the call can be run on its own, with the same
 * model, limits and tool, without the handler's Firestore read or write. The timer is cleared once the race settles.
 */
export async function callBriefModel(client, { systemPrompt, userPrompt }) {
  // The call first, as before: a create() that throws at once never leaves a timer behind to reject unhandled.
  const callPromise = client.messages.create({
    model: SONNET_MODEL,
    max_tokens: 2500,
    // Sonnet 4.6 defaults to high effort; pin to low + thinking disabled to
    // preserve the prior Sonnet-4 (no-thinking) latency profile.
    thinking: { type: 'disabled' },
    output_config: { effort: 'low' },
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    tools: [DAILY_REGIME_BRIEF_TOOL],
    tool_choice: { type: 'tool', name: 'submit_daily_regime_brief' },
  });
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Sonnet timeout (45s)')), SONNET_TIMEOUT_MS);
  });
  try {
    return await Promise.race([callPromise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

const EVENT_KINDS = DAILY_REGIME_BRIEF_TOOL.input_schema.properties.keyEvents.items.properties.kind.enum;

/** A key event carrying every field the tool schema requires, well-typed (a cut-off answer can end on a partial one). */
function isCompleteEvent(e) {
  return !!e && typeof e === 'object' && !Array.isArray(e)
    && typeof e.label === 'string' && e.label.trim() !== ''
    && typeof e.eventDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.eventDate)
    && EVENT_KINDS.includes(e.kind)
    && typeof e.whyItMatters === 'string'
    && Array.isArray(e.tickers) && e.tickers.every((t) => typeof t === 'string');
}

const toolInputOf = (response) => {
  const toolUse = Array.isArray(response?.content) ? response.content.find((b) => b?.type === 'tool_use') : undefined;
  return toolUse ? (toolUse.input && typeof toolUse.input === 'object' ? toolUse.input : {}) : null;
};

/** Each field of the answer as type:length ("array:10", "string:980", "missing"), for the log: what arrived, never its text. */
export function answerShapeOf(response) {
  const input = toolInputOf(response);
  if (!input) return null;
  const shape = (v) => (v === undefined ? 'missing' : Array.isArray(v) ? `array:${v.length}` : typeof v === 'string' ? `string:${v.length}` : typeof v);
  return { brief: shape(input.brief), keyEvents: shape(input.keyEvents), themes: shape(input.themes), keys: Object.keys(input) };
}

/**
 * The stored fields from the model's answer (founder ruling Oct 29 2026: only a missing or empty brief fails the run).
 * Throws when there is no tool call, the brief is missing or empty, or the answer was cut off at the output cap inside
 * the brief — a cut brief is not intact. Otherwise the day is kept and each loss is named in `failures` (added to the
 * document's sourceFailures):
 *   output-max-tokens      the answer stopped at the output cap (stop_reason max_tokens)
 *   themes-truncated       `themes` was not an array of strings; stored as []
 *   themes-incomplete      the cut fell inside `themes`: its last, possibly partial, theme was dropped
 *   key-events-truncated   `keyEvents` was not an array; stored as []
 *   key-events-incomplete  the cut fell inside `keyEvents`: its last, possibly partial, event was dropped, with any
 *                          event of the cut answer that lacks a field the schema requires
 * Where the cut fell is read from the answer's key order (the order the model wrote its fields in). A complete answer's
 * events are stored as they came, as before.
 */
export function readBriefAnswer(response) {
  const input = toolInputOf(response);
  if (!input) {
    throw new Error('No tool_use block in Sonnet response');
  }

  const { brief } = input;
  if (typeof brief !== 'string' || brief.trim() === '') {
    throw new Error('Malformed tool_use input (expected a non-empty brief string)');
  }

  const cut = response.stop_reason === 'max_tokens';
  const cutField = cut ? Object.keys(input).at(-1) : null;
  if (cutField === 'brief') {
    throw new Error('Brief cut off at the output cap (stop_reason max_tokens)');
  }

  const failures = [];
  if (cut) failures.push('output-max-tokens');

  let keyEvents = [];
  if (Array.isArray(input.keyEvents)) {
    keyEvents = cut ? (cutField === 'keyEvents' ? input.keyEvents.slice(0, -1) : input.keyEvents).filter(isCompleteEvent) : input.keyEvents;
    if (keyEvents.length < input.keyEvents.length) failures.push('key-events-incomplete');
  } else {
    failures.push('key-events-truncated');
  }

  let themes = [];
  if (Array.isArray(input.themes) && input.themes.every((t) => typeof t === 'string')) {
    themes = cutField === 'themes' ? input.themes.slice(0, -1) : input.themes;
    if (themes.length < input.themes.length) failures.push('themes-incomplete');
  } else {
    failures.push('themes-truncated');
  }

  return { brief, keyEvents, themes, failures };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startedAt = Date.now();
  const today = new Date().toISOString().split('T')[0];
  // Carried into the failure log: the inputs' counts once the prompt is built, the answer's stop_reason and usage once it arrives.
  let callCounts = null;
  let answerLog = null;

  try {
    const db = getFirebaseAdmin();
    const briefRef = db.collection('indexIntelligence').doc('dailyRegimeBrief');

    // -------------------------------------------------------------------
    // 1. Idempotency guard
    // -------------------------------------------------------------------
    const existing = await briefRef.get();
    if (existing.exists && existing.data()?.forDate === today) {
      logInfo('Brief already generated for today — skipping', { forDate: today });
      return res.status(200).json({
        success: true,
        skipped: true,
        reason: 'already_generated',
        forDate: today,
      });
    }

    // -------------------------------------------------------------------
    // 2. Gather inputs in parallel
    //    - Firestore reads throw on hard errors (propagate to top-level catch)
    //    - Sonar fetchers degrade gracefully — settle individually and track
    //      failures so the brief can still render from market context alone.
    // -------------------------------------------------------------------
    const marketContextRef = db.collection('indexIntelligence').doc('marketContext');

    const [marketCtxDoc, econResult, earnResult] = await Promise.all([
      marketContextRef.get(),
      fetchMacroEvents().then(
        (data) => ({ ok: true, data }),
        (err) => ({ ok: false, err }),
      ),
      fetchEarningsCalendarEODHD().then(
        (data) => ({ ok: true, data }),
        (err) => ({ ok: false, err }),
      ),
    ]);

    const marketContext = marketCtxDoc.exists ? marketCtxDoc.data() : {};
    const technicalLeaders = marketContext.technicalLeaders || [];
    const technicalLaggards = marketContext.technicalLaggards || [];

    const sourceFailures = [];
    let thisWeekEvents = [];
    let nextWeekEvents = [];
    if (econResult.ok) {
      thisWeekEvents = econResult.data.thisWeek || [];
      nextWeekEvents = econResult.data.nextWeek || [];
    } else {
      sourceFailures.push('macro-events');
      logError('fetchMacroEvents failed', { message: econResult.err?.message });
    }

    let thisWeekEarnings = [];
    let nextWeekEarnings = [];
    if (earnResult.ok) {
      thisWeekEarnings = earnResult.data.thisWeek || [];
      nextWeekEarnings = earnResult.data.nextWeek || [];
    } else {
      sourceFailures.push('earnings-calendar-eodhd');
      logError('fetchEarningsCalendarEODHD failed', { message: earnResult.err?.message });
    }

    // -------------------------------------------------------------------
    // 3. Build prompt + call Sonnet with forced Tool Use
    // -------------------------------------------------------------------
    const { systemPrompt, userPrompt, earningsListed } = buildDailyRegimeBriefPrompt({
      marketContext,
      technicalLeaders,
      technicalLaggards,
      thisWeekEvents,
      nextWeekEvents,
      thisWeekEarnings,
      nextWeekEarnings,
      forDate: today,
    });

    callCounts = {
      econEvents: thisWeekEvents.length + nextWeekEvents.length,
      earnings: thisWeekEarnings.length + nextWeekEarnings.length,
      earningsListed,
    };
    logInfo('Calling Sonnet', { forDate: today, ...callCounts, sourceFailures });

    const response = await callBriefModel(getAnthropicClient(), { systemPrompt, userPrompt });

    // Logged before the answer is read, so a failed read still names why the answer ended and what it cost.
    answerLog = {
      stopReason: response?.stop_reason ?? null,
      usage: { input: response?.usage?.input_tokens ?? null, output: response?.usage?.output_tokens ?? null },
      shape: answerShapeOf(response),
    };
    logInfo('Sonnet answered', { forDate: today, ...answerLog, ...callCounts });

    const { brief, keyEvents, themes, failures } = readBriefAnswer(response);
    if (failures.length > 0) {
      sourceFailures.push(...failures);
      logError('Brief answer degraded — kept with the losses named', { forDate: today, failures, ...answerLog });
    }

    // -------------------------------------------------------------------
    // 4. Write to Firestore
    // -------------------------------------------------------------------
    const tokenUsage = {
      input: response.usage?.input_tokens ?? null,
      output: response.usage?.output_tokens ?? null,
    };

    await briefRef.set({
      dailyBrief: brief,
      keyEvents,
      themes,
      forDate: today,
      generatedAt: FieldValue.serverTimestamp(),
      model: SONNET_MODEL,
      tokenUsage,
      sourceFailures,
    });

    const duration = Date.now() - startedAt;
    logInfo('Brief generated', {
      forDate: today,
      briefLength: brief.length,
      tokenUsage,
      sourceFailures,
      duration,
    });

    // Shadow log — awaited so Vercel doesn't freeze the function before
    // the GCS write completes. Silent-fail contract preserved by .catch.
    await logDailyRegimeBrief({
      forDate: today,
      inputContext: {
        regime: marketContext.regime ?? null,
        breadthTier: marketContext.breadthTier ?? null,
        volatilityRegime: marketContext.volatilityRegime ?? null,
        econEventsCount: thisWeekEvents.length + nextWeekEvents.length,
        earningsCount: thisWeekEarnings.length + nextWeekEarnings.length,
        sourceFailures,
      },
      output: { brief, keyEvents, themes },
      tokenUsage,
      duration,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      forDate: today,
      briefLength: brief.length,
      tokenUsage,
      sourceFailures,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startedAt;
    logError('Brief generation failed', {
      message: error.message,
      stack: error.stack,
      duration,
      forDate: today,
      ...(callCounts || {}),
      stopReason: answerLog?.stopReason ?? null,
      usage: answerLog?.usage ?? null,
      shape: answerLog?.shape ?? null,
    });
    return res.status(500).json({
      success: false,
      error: error.message,
      forDate: today,
      duration,
    });
  }
}
