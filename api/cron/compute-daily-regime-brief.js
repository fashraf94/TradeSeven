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

import Anthropic from '@anthropic-ai/sdk';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { fetchEconomicEvents } from '../_utils/fetchEconomicEvents.js';
import { fetchEarningsCalendar } from '../_utils/fetchEarningsCalendar.js';
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

const SONNET_MODEL = 'claude-sonnet-4-20250514';
const SONNET_TIMEOUT_MS = 45_000;

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
      fetchEconomicEvents().then(
        (data) => ({ ok: true, data }),
        (err) => ({ ok: false, err }),
      ),
      fetchEarningsCalendar().then(
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
      sourceFailures.push('economic-events-sonar');
      logError('fetchEconomicEvents failed', { message: econResult.err?.message });
    }

    let thisWeekEarnings = [];
    let nextWeekEarnings = [];
    if (earnResult.ok) {
      thisWeekEarnings = earnResult.data.thisWeek || [];
      nextWeekEarnings = earnResult.data.nextWeek || [];
    } else {
      sourceFailures.push('earnings-calendar-sonar');
      logError('fetchEarningsCalendar failed', { message: earnResult.err?.message });
    }

    // -------------------------------------------------------------------
    // 3. Build prompt + call Sonnet with forced Tool Use
    // -------------------------------------------------------------------
    const { systemPrompt, userPrompt } = buildDailyRegimeBriefPrompt({
      marketContext,
      technicalLeaders,
      technicalLaggards,
      thisWeekEvents,
      nextWeekEvents,
      thisWeekEarnings,
      nextWeekEarnings,
      forDate: today,
    });

    logInfo('Calling Sonnet', {
      forDate: today,
      econEvents: thisWeekEvents.length + nextWeekEvents.length,
      earnings: thisWeekEarnings.length + nextWeekEarnings.length,
      sourceFailures,
    });

    const client = getAnthropicClient();
    const callPromise = client.messages.create({
      model: SONNET_MODEL,
      max_tokens: 2500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [DAILY_REGIME_BRIEF_TOOL],
      tool_choice: { type: 'tool', name: 'submit_daily_regime_brief' },
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Sonnet timeout (45s)')), SONNET_TIMEOUT_MS),
    );

    const response = await Promise.race([callPromise, timeoutPromise]);

    const toolUse = response.content.find((b) => b.type === 'tool_use');
    if (!toolUse) {
      throw new Error('No tool_use block in Sonnet response');
    }

    const { brief, keyEvents, themes } = toolUse.input;
    if (typeof brief !== 'string' || !Array.isArray(keyEvents) || !Array.isArray(themes)) {
      throw new Error('Malformed tool_use input (expected brief:string, keyEvents:[], themes:[])');
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

    // Shadow log — fire-and-forget, silent-fail (belt-and-suspenders).
    logDailyRegimeBrief({
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
    logError('Brief generation failed', { message: error.message, stack: error.stack, duration });
    return res.status(500).json({
      success: false,
      error: error.message,
      forDate: today,
      duration,
    });
  }
}
