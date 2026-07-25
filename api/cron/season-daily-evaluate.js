// api/cron/season-daily-evaluate.js
//
// Daily Evaluation Cron (Phase B-9a)
// Finds active seasons, fetches shared market data, advances the season
// trading day, evaluates each active entry (black swan detection → pipeline
// → Haiku tie-break → settlement → daily log → Firestore transaction), then
// rebuilds the leaderboard and checks for season completion.
//
// ⚠ NOT SCHEDULED — THIS HANDLER DOES NOT RUN (as of Jul 25, 2026).
//
// This header previously claimed "Triggered by Vercel Cron twice (UTC 20:30 and
// 21:30) for DST coverage". That was true when written and became false on
// Jun 4, 2026: commit d80aee25 ("Forge redesign Phase 1") removed all three
// season cron entries from vercel.json, taking the cron count 40 → 37. The
// deleted entry for this file was "30 20,21 * * 1-5" — exactly the schedule the
// old comment described. Nothing else invokes it: executePipeline, settleDay,
// buildDailyLog and buildEvaluationContext have zero call sites outside this
// file, no GitHub Actions workflow hits it, and firebase.json declares no
// functions. Together with season-pit-stop-manage.js these are the ONLY two
// unregistered handlers in api/cron/ (19 of 21 are registered).
//
// Season mode is scrapped permanently per founder ruling C-19, so the handler
// is RETAINED UN-SCHEDULED rather than deleted — deleting it would discard the
// evaluation pipeline that the season signals (beta, next-earnings proximity,
// alphaVsSpy, the pit-stop shortlist) are wired into, and those are dormant,
// not absent.
//
// If it is ever re-registered: the ET time-window guard below rejects whichever
// invocation falls outside 4:15–5:00 PM America/New_York, and restoring all
// three season entries costs 3 of the 3 remaining cron slots (37 → 40), which
// would violate BUILD_RULES §6's "at most 2 for the tournament build". Folding
// the two pit-stop actions into one handler brings that cost to 2.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { fetchSharedMarketData, buildEvaluationContext } from '../_utils/seasonEvalContext.js';
import { SEASON_CONFIG, SEASON_STATUS, ENTRY_STATUS } from '../_utils/seasonConfig.js';
import { executePipeline } from '../_utils/seasonPipeline.js';
import { settleDay } from '../_utils/seasonSettlement.js';
import { buildDailyLog } from '../_utils/seasonDailyLog.js';
import { buildLeaderboard } from '../_utils/seasonLeaderboard.js';
import {
  detectBlackSwanTriggers,
  buildBlackSwanRequest,
  parseBlackSwanResponse,
} from '../_utils/seasonPrompts/blackSwanEscalation.js';
import {
  buildEntryTiebreakRequest,
  parseEntryTiebreakResponse,
} from '../_utils/seasonPrompts/entryTiebreak.js';
import { logPipelineDecision } from '../_utils/shadowLogger.js';

// Phase 6 — Shadow Logger Extension
// Simple SPY-based regime categorization for training data tags. VIX
// and sector volatility are not plumbed through EvaluationContext today,
// so those fields stay null and the training pipeline can fall back to
// SPY-only bucketing for now. When VIX is added, extend here in place
// without breaking the stream schema (existing nulls become values).
function categorizeSpyTrend(benchmark) {
  const history = benchmark?.spyPriceHistory;
  if (!Array.isArray(history) || history.length < 5) return null;
  const start = history[history.length - 5];
  const end = history[history.length - 1];
  if (typeof start !== 'number' || typeof end !== 'number' || start === 0) return null;
  const fiveDayReturn = (end - start) / start;
  if (fiveDayReturn > 0.01) return 'bullish';
  if (fiveDayReturn < -0.01) return 'bearish';
  return 'neutral';
}

// Derive a deduped list of rule IDs that participated in today's decisions.
// Pulls from strategyMods (strategy-phase rules), exitEvaluations results
// (exit-phase rules), and per-trade triggerRule/allCitedRules (settlement).
function collectRulesTriggered(dailyLog) {
  const set = new Set();
  for (const mod of dailyLog?.strategyMods || []) {
    if (mod?.ruleId) set.add(mod.ruleId);
  }
  for (const exitEval of dailyLog?.exitEvaluations || []) {
    for (const r of exitEval?.results || []) {
      if (r?.ruleId) set.add(r.ruleId);
    }
  }
  for (const trade of dailyLog?.trades || []) {
    if (trade?.triggerRule) set.add(trade.triggerRule);
    for (const r of trade?.allCitedRules || []) {
      if (r) set.add(r);
    }
  }
  return Array.from(set);
}

async function callAnthropic(requestBody) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(requestBody),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => 'Unknown error');
    throw new Error(`Anthropic ${resp.status}: ${errText.slice(0, 200)}`);
  }
  return resp.json();
}

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
        // ENTRY EVALUATION LOOP
        // For each entry: build ctx → detect black swan → run pipeline
        //   → settle → build daily log → write transaction
        // ═══════════════════════════════════════════════════════════
        const evaluatedEntries = [];
        const errors = [];

        for (const entryDoc of entriesSnap.docs) {
          try {
            const entry = { ...entryDoc.data(), id: entryDoc.id };

            // ── Idempotency guard ──
            if (entry.cronState?.lastEvaluatedDay >= currentTradingDay) {
              evaluatedEntries.push(entry);
              continue;
            }

            // ── Build EvaluationContext ──
            // buildEvaluationContext reads season.currentTradingDay (updated
            // in-memory in Step 7). It handles tradingDay, currentWeek,
            // isFirstDayOfWeek internally — no manual ctx injection needed.
            const ctx = await buildEvaluationContext(entry, season, sharedMarketData);

            // ── Black swan detection ──
            // Pass entry.portfolio as previousPortfolio (H2 audit fix —
            // NOT a dailySnapshot).
            const previousSnapshot = entry.dailySnapshots?.length > 0
              ? entry.dailySnapshots[entry.dailySnapshots.length - 1]
              : null;
            const triggers = detectBlackSwanTriggers(ctx, entry.portfolio);
            let blackSwanResult = null;

            if (triggers.length > 0) {
              try {
                const riskRules = (entry.algorithm?.rules || []).filter(r =>
                  r.ruleId?.startsWith('sx-') || r.ruleId?.startsWith('sr-')
                );
                const bsRequest = buildBlackSwanRequest(ctx, triggers, riskRules);
                const bsResponse = await callAnthropic(bsRequest);
                blackSwanResult = parseBlackSwanResponse(bsResponse);
              } catch (bsErr) {
                console.error(
                  `[SEASON] Black swan Haiku call failed for ${entry.id}:`,
                  bsErr.message
                );
                // Non-fatal: continue with normal evaluation
              }
              // NOTE: Black swan actions are LOGGED only — not applied to
              // pipeline. Applying them to trade ordering needs its own
              // design phase.
            }

            // ── Run pipeline ──
            const activeRules = entry.algorithm?.rules || [];
            let pipelineResult = executePipeline(ctx, activeRules);

            // ── Day 1: Portfolio construction ──
            const isDay1 =
              currentTradingDay === 1 &&
              (!entry.portfolio?.positions ||
                Object.keys(entry.portfolio.positions).length === 0);

            if (isDay1) {
              // Day 1 always fires Haiku for initial construction.
              const allCandidates = [
                ...pipelineResult.entryActions.buys,
                ...pipelineResult.entryActions.tieBreakNeeded,
              ];
              if (allCandidates.length > 0) {
                try {
                  const tbRequest = buildEntryTiebreakRequest(
                    ctx,
                    allCandidates,
                    activeRules,
                    ctx.portfolio.cash
                  );
                  const tbResponse = await callAnthropic(tbRequest);
                  const tbResult = parseEntryTiebreakResponse(tbResponse);
                  if (tbResult.selections.length > 0) {
                    const targetWeight = 100 / SEASON_CONFIG.TARGET_POSITIONS;
                    pipelineResult.entryActions.buys = tbResult.selections.map(s => ({
                      ticker: s.ticker,
                      weight: s.allocationPct || targetWeight,
                      dollarAmount:
                        (ctx.portfolio.cash * (s.allocationPct || targetWeight)) / 100,
                      reason: s.rationale || 'Haiku initial construction',
                      citedRules: [],
                      score: 0,
                      shortlistBonus: false,
                    }));
                    pipelineResult.entryActions.tieBreakNeeded = [];
                  }
                } catch (tbErr) {
                  console.error(
                    `[SEASON] Day 1 Haiku tie-break failed for ${entry.id}:`,
                    tbErr.message
                  );
                  // Fall through to deterministic buys from pipeline
                }
              }
            } else {
              // ── Normal day: tie-break handling ──
              if (pipelineResult.entryActions.tieBreakNeeded?.length >= 2) {
                try {
                  const tbRequest = buildEntryTiebreakRequest(
                    ctx,
                    pipelineResult.entryActions.tieBreakNeeded,
                    activeRules,
                    ctx.portfolio.cash
                  );
                  const tbResponse = await callAnthropic(tbRequest);
                  const tbResult = parseEntryTiebreakResponse(tbResponse);
                  if (tbResult.selections.length > 0) {
                    pipelineResult.entryActions.buys = pipelineResult.entryActions.buys.map(
                      buy => {
                        const sel = tbResult.selections.find(s => s.ticker === buy.ticker);
                        return sel
                          ? { ...buy, reason: `${buy.reason} — Haiku: ${sel.rationale}` }
                          : buy;
                      }
                    );
                  }
                } catch (tbErr) {
                  console.error(
                    `[SEASON] Tie-break Haiku failed for ${entry.id}:`,
                    tbErr.message
                  );
                  // Fall through to deterministic ranking
                }
              }
            }

            // ── Settle ──
            const settlementResult = settleDay(ctx, pipelineResult, season, previousSnapshot);

            // ── Build daily log ──
            const dailyLog = buildDailyLog(ctx, pipelineResult, settlementResult);
            if (blackSwanResult) {
              dailyLog.haikuCalls = dailyLog.haikuCalls || [];
              dailyLog.haikuCalls.push({
                type: 'black_swan',
                severity: blackSwanResult.severity,
                assessment: blackSwanResult.assessment,
                actions: blackSwanResult.actions,
                overriddenRules: blackSwanResult.overriddenRules,
                resumeNormal: blackSwanResult.resumeNormal,
              });
            }

            // ── Write to Firestore (transaction) ──
            await db.runTransaction(async (txn) => {
              const freshRef = entryDoc.ref;
              const freshSnap = await txn.get(freshRef);
              const freshData = freshSnap.data();

              // Idempotency re-check inside transaction
              if (freshData.cronState?.lastEvaluatedDay >= currentTradingDay) return;

              // Merge rulePerformance deltas
              const mergedRulePerformance = { ...(freshData.rulePerformance || {}) };
              for (const [ruleId, delta] of Object.entries(
                settlementResult.rulePerformanceDeltas || {}
              )) {
                const existing = mergedRulePerformance[ruleId] || {};
                const merged = { ...existing };
                for (const [key, val] of Object.entries(delta)) {
                  merged[key] =
                    typeof val === 'number' ? (existing[key] || 0) + val : val;
                }
                mergedRulePerformance[ruleId] = merged;
              }

              // Build complete seasonState merge
              const mergedSeasonState = {
                ...(freshData.seasonState || {}),
                ...settlementResult.seasonState,
              };

              // Append daily snapshot
              const updatedSnapshots = [
                ...(freshData.dailySnapshots || []),
                settlementResult.dailySnapshot,
              ];

              // Write entry doc
              txn.update(freshRef, {
                portfolio: settlementResult.portfolio,
                seasonState: mergedSeasonState,
                dailySnapshots: updatedSnapshots,
                recentActivity: settlementResult.recentActivity,
                rulePerformance: mergedRulePerformance,
                cronState: {
                  ...(freshData.cronState || {}),
                  ...settlementResult.cronStateUpdates,
                  lastAttemptedDay: currentTradingDay,
                  lastError: null,
                },
                updatedAt: new Date().toISOString(),
              });

              // Write daily log subcollection
              const logRef = freshRef.collection('dailyLogs').doc(String(currentTradingDay));
              txn.set(logRef, dailyLog);
            });

            // ── Phase 6: shadow log (fire-and-forget) ──
            // Runs after the transaction commits. Never blocks the eval
            // loop; a GCS outage is silently swallowed so the cron always
            // proceeds to the next entry.
            const settledPortfolio = settlementResult.portfolio || {};
            const trades = Array.isArray(dailyLog.trades) ? dailyLog.trades : [];
            const dailyAlpha =
              typeof settlementResult.seasonState?.alphaVsSpy === 'number'
                ? settlementResult.seasonState.alphaVsSpy
                : null;
            logPipelineDecision({
              userId: entry.userId,
              agentId: entry.agentId,
              seasonId: entry.seasonId,
              entryId: entry.id,
              tradingDay: currentTradingDay,
              week: currentWeek,
              date: todayStr,
              marketRegime: {
                vixLevel: null, // TODO: populate when VIX is added to EvaluationContext
                spyTrend: categorizeSpyTrend(ctx?.benchmark),
                spyDailyReturn: ctx?.benchmark?.spyDailyReturn ?? null,
                sectorVolatility: null, // TODO: compute from ctx.technicals/sector data
              },
              tradesExecuted: trades.length,
              buys: trades.filter((t) => t?.type === 'BUY').length,
              sells: trades.filter((t) => t?.type === 'SELL').length,
              trims: trades.filter(
                (t) => t?.type === 'TRIM' || t?.type === 'REDUCE'
              ).length,
              rulesTriggered: collectRulesTriggered(dailyLog),
              haikuCalls: Array.isArray(dailyLog.haikuCalls)
                ? dailyLog.haikuCalls.length
                : 0,
              blackSwanTriggered: Boolean(blackSwanResult),
              entryScan: dailyLog.entryScan
                ? {
                    triggered: Boolean(dailyLog.entryScan.triggered),
                    blocked: Boolean(dailyLog.entryScan.blocked),
                    blockReason: dailyLog.entryScan.blockReason || null,
                    candidatesEvaluated:
                      dailyLog.entryScan.candidatesEvaluated || 0,
                    candidatesPassed: dailyLog.entryScan.candidatesPassed || 0,
                  }
                : null,
              dailyAlpha,
              totalReturn:
                typeof settledPortfolio.totalReturn === 'number'
                  ? settledPortfolio.totalReturn
                  : null,
              positionCount:
                typeof settledPortfolio.positionCount === 'number'
                  ? settledPortfolio.positionCount
                  : null,
              cashPct:
                typeof settledPortfolio.cashPct === 'number'
                  ? settledPortfolio.cashPct
                  : null,
              timestamp: new Date().toISOString(),
              schemaVersion: 1,
            }).catch(() => {});

            // Collect for leaderboard (with updated state)
            evaluatedEntries.push({
              ...entry,
              portfolio: settlementResult.portfolio,
              seasonState: { ...entry.seasonState, ...settlementResult.seasonState },
              dailySnapshots: [
                ...(entry.dailySnapshots || []),
                settlementResult.dailySnapshot,
              ],
            });
          } catch (err) {
            console.error(`[SEASON] Entry ${entryDoc.id} failed:`, err.message);
            errors.push({ entryId: entryDoc.id, error: err.message?.slice(0, 300) });

            // Best-effort error logging to entry cronState
            try {
              await entryDoc.ref.update({
                'cronState.lastAttemptedDay': currentTradingDay,
                'cronState.lastError': (err.message || 'Unknown error').slice(0, 500),
                updatedAt: new Date().toISOString(),
              });
            } catch (_) {
              /* swallow */
            }
          }
        }

        // ═══════════════════════════════════════════════════════════
        // POST-EVALUATION — Leaderboard + Season Completion
        // ═══════════════════════════════════════════════════════════

        // ─── 9. Rebuild leaderboard ────────────────────────────
        if (evaluatedEntries.length > 0) {
          const prevDoc = await db.collection('seasonLeaderboard').doc(seasonDoc.id).get();
          const previousLeaderboard = prevDoc.exists ? prevDoc.data() : null;
          const leaderboard = buildLeaderboard(
            seasonDoc.id,
            evaluatedEntries,
            season,
            previousLeaderboard
          );
          await db.collection('seasonLeaderboard').doc(seasonDoc.id).set(leaderboard);
        }

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
