// api/season/generate-debrief.js
//
// Lazily generates the weekend pit stop debrief via Sonnet and writes
// it to the pitStop doc. Called when the user first opens the pit stop
// UI for the week and `pitStop.debrief` is still null.
//
// Flow:
//   1. Verify Firebase auth + validate body
//   2. Load entry, verify ownership
//   3. Load pit stop — if debrief already exists, return cached copy
//   4. Load season
//   5. Load this week's dailyLogs from the subcollection
//   6. Fetch shared market data for near-miss extraction (non-fatal on
//      EODHD failure — the builder gracefully degrades to an empty
//      near-miss list)
//   7. buildDebriefRequest → Anthropic /v1/messages → parseDebriefResponse
//   8. Write the debrief back to the pit stop doc with generatedAt +
//      tokensUsed metadata
//   9. Return the debrief

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { fetchSharedMarketData } from '../_utils/seasonEvalContext.js';
import {
  buildDebriefRequest,
  parseDebriefResponse,
} from '../_utils/seasonPrompts/pitStopDebrief.js';
import { logReviewInteraction } from '../_utils/shadowLogger.js';

export const config = { maxDuration: 60 };

async function callAnthropic(requestBody) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(requestBody),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => 'unknown');
    throw new Error(`Sonnet ${response.status}: ${errText.slice(0, 200)}`);
  }
  return response.json();
}

export default async function handler(req, res) {
  // ─── 1. CORS + rate limit ────────────────────────────────────
  // Lower limit than the reply endpoint — Sonnet calls are expensive.
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 5, windowMs: 60000 } })) {
    return;
  }

  // ─── 2. Method ───────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ─── 3. Firebase auth ────────────────────────────────────────
  const user = await requireAuth(req, res);
  if (!user) return;

  // ─── 4. Validate request body ────────────────────────────────
  const { entryId, week } = req.body || {};
  if (!entryId || week == null) {
    return res.status(400).json({ error: 'Missing entryId or week' });
  }

  const db = getFirebaseAdmin();

  try {
    // ─── 5. Load entry + verify ownership ──────────────────────
    const entryRef = db.collection('seasonEntries').doc(entryId);
    const entrySnap = await entryRef.get();
    if (!entrySnap.exists) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    const entry = entrySnap.data();
    if (entry.userId !== user.uid) {
      return res.status(403).json({ error: 'Not your entry' });
    }

    // ─── 6. Load pit stop ──────────────────────────────────────
    const pitStopRef = entryRef.collection('pitStops').doc(String(week));
    const pitStopSnap = await pitStopRef.get();
    if (!pitStopSnap.exists) {
      return res.status(404).json({ error: 'Pit stop not found' });
    }
    const pitStop = pitStopSnap.data();

    // ─── 7. Return cached debrief if already generated ─────────
    if (pitStop.debrief) {
      return res.status(200).json({
        success: true,
        debrief: pitStop.debrief,
        cached: true,
      });
    }

    // ─── 8. Load season ────────────────────────────────────────
    if (!entry.seasonId) {
      return res.status(400).json({ error: 'Entry has no seasonId' });
    }
    const seasonSnap = await db.collection('seasons').doc(entry.seasonId).get();
    if (!seasonSnap.exists) {
      return res.status(404).json({ error: 'Season not found' });
    }
    const season = seasonSnap.data();

    // ─── 9. Load daily logs ────────────────────────────────────
    // Per-week scoping by default: season.weeks is indexed by array position
    // (resolveCurrentWeek in seasonEvalContext.js:335-345 derives week from
    // index+1); each week has a tradingDays array. Look up (week - 1).
    //
    // Phase 3 (solo final-week debrief, spec §8 option f): when this is a
    // solo session's final week, pull every dailyLog across the entry so
    // the debrief reflects the whole run rather than just the final 5 days.
    // The existing pit-stop-debrief prompt is week-scoped by default; for
    // full-entry mode we thread `isSoloFinalWeek` + `durationWeeks` into
    // the prompt builder so it can adjust framing (see pitStopDebrief.js).
    const totalWeeks = season.weeks?.length || 0;
    const isSolo = (entry.mode ?? season.mode) === 'solo';
    const isSoloFinalWeek = isSolo && totalWeeks > 0 && Number(week) === totalWeeks;

    let tradingDays;
    if (isSoloFinalWeek) {
      // Full-entry aggregation — all trading days in the season calendar.
      tradingDays = Array.isArray(season.tradingCalendar)
        ? season.tradingCalendar.map((d) => d.day).filter((d) => typeof d === 'number')
        : [];
    } else {
      const weekInfo = season.weeks?.[Number(week) - 1];
      tradingDays = Array.isArray(weekInfo?.tradingDays) ? weekInfo.tradingDays : [];
    }

    const weekDailyLogs = [];
    for (const day of tradingDays) {
      const logSnap = await entryRef.collection('dailyLogs').doc(String(day)).get();
      if (logSnap.exists) weekDailyLogs.push(logSnap.data());
    }

    // ─── 10. Fetch market data for near-miss extraction ────────
    // EODHD failure is non-fatal: buildDebriefRequest destructures
    // sharedMarketData.marketData|technicals|etc. with `|| {}` fallbacks,
    // so passing the error object (which has no marketData key) results
    // in an empty near-miss list without crashing.
    let sharedMarketData = {};
    try {
      const fetched = await fetchSharedMarketData(season.universe || [], season);
      if (fetched.error === 'eodhd_failure') {
        console.warn(
          '[SEASON] EODHD failure during debrief generation — proceeding without near-miss data'
        );
        sharedMarketData = {};
      } else {
        sharedMarketData = fetched;
      }
    } catch (mdErr) {
      console.warn(
        '[SEASON] Market data fetch threw during debrief generation — proceeding without near-miss data:',
        mdErr.message
      );
      sharedMarketData = {};
    }

    // ─── 11. Build Sonnet request + call Anthropic ─────────────
    const activeRules = entry.algorithm?.rules || [];
    const debriefRequest = buildDebriefRequest(
      entry,
      season,
      weekDailyLogs,
      sharedMarketData,
      activeRules,
      { isSoloFinalWeek, durationWeeks: totalWeeks }
    );

    const sonnetResponse = await callAnthropic(debriefRequest);
    const debrief = parseDebriefResponse(sonnetResponse);

    // ─── 12. Write debrief to pit stop doc ─────────────────────
    const nowIso = new Date().toISOString();
    const debriefWithMeta = {
      ...debrief,
      generatedAt: nowIso,
      tokensUsed: sonnetResponse.usage?.output_tokens || 0,
    };

    await pitStopRef.update({
      debrief: debriefWithMeta,
      updatedAt: nowIso,
    });

    // ─── 13. Shadow log (fire-and-forget) ─────────────────────
    // Full Sonnet debrief payload for Gemma training. Silent failure —
    // a GCS outage must not affect the user-facing response.
    logReviewInteraction({
      type: 'debrief',
      userId: user.uid,
      entryId,
      seasonId: entry.seasonId,
      agentId: entry.agentId || null,
      week,
      debrief: {
        summary: debrief.summary || null,
        highlights: debrief.highlights || [],
        ruleInsights: debrief.ruleInsights || [],
        suggestedChanges: debrief.suggestedChanges || [],
        upcomingEvents: debrief.upcomingEvents || [],
        nextWeekPrep: debrief.nextWeekPrep || null,
      },
      weeklyAlpha:
        typeof entry.seasonState?.alphaVsSpy === 'number'
          ? entry.seasonState.alphaVsSpy
          : null,
      ruleInsightsCount: Array.isArray(debrief.ruleInsights)
        ? debrief.ruleInsights.length
        : 0,
      suggestedChangesCount: Array.isArray(debrief.suggestedChanges)
        ? debrief.suggestedChanges.length
        : 0,
      tokensUsed: sonnetResponse.usage?.output_tokens || 0,
      generatedAt: nowIso,
      schemaVersion: 1,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      debrief: debriefWithMeta,
      cached: false,
    });
  } catch (error) {
    console.error('[SEASON] Debrief generation failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
