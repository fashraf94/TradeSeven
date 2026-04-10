// api/cron/season-daily-evaluate.js
//
// Daily Evaluation Cron — Part 1 of 2 (Phase B-9a-1)
// Scaffold + data fetch + season-doc updates. The per-entry evaluation loop
// is intentionally a commented placeholder — Part 2 (B-9a-2) wires the
// pipeline, settlement, daily-log builder, and leaderboard rebuild into the
// marked block below.
//
// Triggered by Vercel Cron twice (UTC 20:30 and 21:30) for DST coverage;
// the ET time-window guard below rejects whichever invocation falls outside
// 4:15–5:00 PM America/New_York.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { fetchSharedMarketData } from '../_utils/seasonEvalContext.js';
import { SEASON_CONFIG, SEASON_STATUS, ENTRY_STATUS } from '../_utils/seasonConfig.js';
// NOTE: Part 2 will add imports for:
//   buildEvaluationContext (from ../_utils/seasonEvalContext.js)
//   pipeline runner, settlement, daily log builder
//   buildLeaderboard (from ../_utils/seasonLeaderboard.js)

export default async function handler(req, res) {
  // ─── 1. CRON_SECRET guard ────────────────────────────────────
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ─── 2. ET time-window guard (4:15–5:00 PM ET) ───────────────
  const now = new Date();
  const etHour = parseInt(
    now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }),
    10
  );
  const etMinute = parseInt(
    now.toLocaleString('en-US', { timeZone: 'America/New_York', minute: 'numeric' }),
    10
  );
  const etTime = etHour * 60 + etMinute;
  if (etTime < 16 * 60 + 15 || etTime > 17 * 60) {
    return res.status(200).json({ skipped: true, reason: 'Outside evaluation window' });
  }

  try {
    const db = getFirebaseAdmin();

    // ─── 3. Find active seasons ────────────────────────────────
    const seasonsSnap = await db
      .collection('seasons')
      .where('status', '==', SEASON_STATUS.ACTIVE)
      .get();

    if (seasonsSnap.empty) {
      return res.status(200).json({ skipped: true, reason: 'No active seasons' });
    }

    const summaries = [];

    // ─── 4. Per-season loop ────────────────────────────────────
    for (const seasonDoc of seasonsSnap.docs) {
      try {
        const season = seasonDoc.data();

        // ─── 5. Trading-calendar guard + season-level idempotency ───
        const todayStr = now.toISOString().split('T')[0];
        const todayEntry = season.tradingCalendar?.find(d => d.date === todayStr);
        if (!todayEntry) {
          // Not a trading day (holiday, weekend)
          continue;
        }
        const currentTradingDay = todayEntry.day;
        const currentWeek = todayEntry.week;

        if ((season.currentTradingDay || 0) >= currentTradingDay) {
          // Day already processed for this season — skip
          continue;
        }

        // ─── 6. Fetch shared market data (once per season) ─────
        const sharedMarketData = await fetchSharedMarketData(season.universe, season);

        // M1 guard: total EODHD failure = abort this season
        if (sharedMarketData.error === 'eodhd_failure') {
          await seasonDoc.ref.update({
            [`missedDays.${currentTradingDay}`]: {
              date: todayStr,
              reason: sharedMarketData.error,
              timestamp: new Date().toISOString(),
            },
          });
          console.error(
            `[SEASON] EODHD failure for season ${seasonDoc.id}, day ${currentTradingDay}`
          );
          summaries.push({
            seasonId: seasonDoc.id,
            tradingDay: currentTradingDay,
            skipped: true,
            reason: 'eodhd_failure',
          });
          continue;
        }

        // ─── 7. Update season doc (in-memory + Firestore) ──────
        // CRITICAL: mutate in-memory season BEFORE any ctx building —
        // buildEvaluationContext reads seasonDoc.currentTradingDay.
        season.currentTradingDay = currentTradingDay;
        season.currentWeek = currentWeek;

        // Compute SPY benchmark update.
        // NOTE: spyStartPrice is TOP-LEVEL on season (season.spyStartPrice),
        // NOT season.benchmark.spyStartPrice.
        const spyData = sharedMarketData.marketData?.['SPY'];
        const spyReturn =
          spyData?.closePrice && season.spyStartPrice
            ? ((spyData.closePrice - season.spyStartPrice) / season.spyStartPrice) * 100
            : season.benchmark?.spyReturn || 0;

        await seasonDoc.ref.update({
          currentTradingDay,
          currentWeek,
          'benchmark.spyCurrentPrice': spyData?.closePrice || null,
          'benchmark.spyReturn': spyReturn,
          updatedAt: new Date().toISOString(),
        });

        // Also update in-memory for downstream use (Part 2).
        season.benchmark = {
          ...(season.benchmark || {}),
          spyCurrentPrice: spyData?.closePrice,
          spyReturn,
        };

        // ─── 8. Load active entries ────────────────────────────
        const entriesSnap = await db
          .collection('seasonEntries')
          .where('seasonId', '==', seasonDoc.id)
          .where('status', '==', ENTRY_STATUS.ACTIVE)
          .get();

        if (entriesSnap.empty) {
          summaries.push({
            seasonId: seasonDoc.id,
            tradingDay: currentTradingDay,
            entriesLoaded: 0,
          });
          continue;
        }

        // ═══════════════════════════════════════════════════════════
        // ENTRY EVALUATION LOOP — Added in Part 2 (B-9a-2)
        // For each entry: build ctx → detect black swan → run pipeline
        //   → settle → build daily log → write transaction
        // ═══════════════════════════════════════════════════════════
        const evaluatedEntries = [];
        const errors = [];

        // TODO: Part 2 adds the evaluation loop here

        // ═══════════════════════════════════════════════════════════
        // POST-EVALUATION — Leaderboard + Season Completion
        // ═══════════════════════════════════════════════════════════

        // ─── 9. Rebuild leaderboard (scaffolded, commented until Part 2) ───
        // Read previous leaderboard for previousRank tracking.
        const prevDoc = await db.collection('seasonLeaderboard').doc(seasonDoc.id).get();
        const previousLeaderboard = prevDoc.exists ? prevDoc.data() : null;

        // buildLeaderboard(seasonDoc.id, evaluatedEntries, season, previousLeaderboard)
        // → write to seasonLeaderboard/{seasonId}
        // TODO: Uncomment when Part 2 populates evaluatedEntries
        void previousLeaderboard; // silence unused-var lint in Part 1

        // ─── 10. Season completion check ───────────────────────
        // totalTradingDays is derived from the calendar (seasonSettlement.js:590).
        const totalTradingDays =
          season.tradingCalendar?.length || SEASON_CONFIG.TOTAL_WEEKS * 5;

        if (currentTradingDay >= totalTradingDays) {
          await seasonDoc.ref.update({
            status: SEASON_STATUS.COMPLETED,
            updatedAt: new Date().toISOString(),
          });

          // Mark all entries completed.
          const batch = db.batch();
          for (const entryDoc of entriesSnap.docs) {
            batch.update(entryDoc.ref, {
              status: ENTRY_STATUS.COMPLETED,
              completedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
          await batch.commit();

          // Final metrics computation deferred to a separate endpoint
          // (requires loading all dailyLogs — too heavy for this cron).
        }

        summaries.push({
          seasonId: seasonDoc.id,
          tradingDay: currentTradingDay,
          entriesLoaded: entriesSnap.size,
          evaluatedCount: evaluatedEntries.length,
          errorCount: errors.length,
          errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
        });
      } catch (err) {
        console.error(`[SEASON] season ${seasonDoc.id} failed:`, err);
        summaries.push({ seasonId: seasonDoc.id, error: err.message });
      }
    }

    return res.status(200).json({ success: true, seasons: summaries });
  } catch (error) {
    console.error('[SEASON] Daily evaluate cron failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
