// api/cron/agent-evaluate.js
// Mid-battle evaluation cron for AI trading agents.
// Runs every 15 minutes during market hours (weekdays).
// Queries agentBattles collection, computes scores, optionally calls Haiku for trade decisions.
//
// Schedule: */15 13,14,15,16,17,18,19,20,21 * * 1-5

import Anthropic from '@anthropic-ai/sdk';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
// Archetype Phase 2 P2.6 (non-fenced): shadow assembly + behavior-record
// envelope plumbing, DARK behind SHADOW_ASSEMBLY_ENABLED=false — the two
// flag-gated call sites below are never entered while dark and the tick is
// byte-identical. Assembly-only (no second LLM call — Spec DR-10 stage 1).
import { SHADOW_ASSEMBLY_ENABLED } from '../../src/config/featureFlags.js';
import { runShadowTickCapture, writeBattleSettlementRecord } from '../_utils/shadowAssemblyCapture.js';
import { isMarketOpen, getETDate, formatDateString } from '../_utils/marketSchedule.js';
import { getStockAnalysisData, fetchIntradayBatch, fetchIntradayCandles, filterToLatestSession } from '../_utils/marketDataCache.js';
import { resolveBadgeBaseline } from '../_utils/baselineValidation.js';
import { findActiveAgentBattles } from '../_utils/agentBattleService.js';
import { unionEquippedIntoHotBench } from '../_utils/watchlistEquip.js';
import {
  calculateAssetScoreServer,
  flattenPortfolioServer,
  flattenBenchServer,
} from '../_utils/agentScoring.js';
import { calculateVWAP } from '../_utils/technicalCalculations.js';
import {
  buildEvalSystemPrompt,
  buildAgentIdentityBlock,
  buildLiveContextBlock,
  computeBattlePhase,
  getCurrentTradingDayServer,
} from '../_utils/agentEvalPromptAssembly.js';
import { TRADE_DECISION_TOOL } from '../_utils/agentEvalToolSchema.js';
import { evaluateTriggers, fetchRecentNews } from '../_utils/agentTriggerGate.js';
import { validateTradeDecision, executeSwapServer } from '../_utils/agentSwapExecution.js';
// P2 League Tournament — agent-market exclusivity (Spec §1.2). Every use is
// tournament-conditional: resolveTournamentContext returns null for regular
// battles from in-memory fields alone (zero Firestore I/O), so the
// non-tournament path through this cron is unchanged.
import {
  resolveTournamentContext,
  excludeHeldByOthers,
  excludeHeldSymbols,
  reserveSymbol,
  confirmSwap,
  releaseReservation,
} from '../_utils/tournamentAgentLedger.js';
import { generateTradeNarration } from '../_utils/voiceLayerTradeNarration.js';
import { generateAnticipation } from '../_utils/voiceLayerAnticipation.js';
import { buildTechnicalSnapshot } from '../_utils/buildTechnicalSnapshot.js';
import { applyGuardrails, injectDiversifierSectorCap, resolveSectorSlotObserveCap } from '../_utils/agentGuardrails.js';
import { classifyStockRegime, classifyMarketPosture, getPresetAdjustedStrategies } from '../_utils/agentRegimeClassifier.js';
import { evaluateRisk, calculate5minSMA20, pickSwapReplacementCandidate, updateStagnationCounter, findPortfolioSlot, clearsHurdleFloor, getRecentSwapCount, EMERGENCY_BYPASS_REASONS, buildSwapReceiptSource } from '../_utils/agentRiskManager.js';
import { buildFreshAtrPercentileMap, resolveHurdleAtr } from '../_utils/hurdleAtr.js';
import { getPresetConfig } from '../_utils/agentPresetConfig.js';
import { isVwapSessionUsable, isVwapStrike, pruneCounterMaps, seedVwapFireGuard, isReplacementQualified, VWAP_CASCADE_GUARD_N, CASCADE_QUALIFY_TIMEOUT_MS } from '../_utils/agentVwapFloor.js';
import { getArchetypeConfig, resolveHftConfig, KNOB_CONFIG_VERSION } from '../_utils/agentArchetypeConfig.js';
// Release 2 PR-c — control-suppression epoch telemetry (renderer contract,
// fence-lite signed off 2026-07-10): ONE structured event per battle +
// mode-epoch, with the battle-doc controlEpochLog entry doubling as the
// directive no-resurrection record the shared renderer derives from. The
// resolution here is the SAME pure function the fenced eval assembly calls
// with the same inputs — purity guarantees the telemetry can never disagree
// with what the prompt rendered.
import { FieldValue } from 'firebase-admin/firestore';
import { isDirectiveActive } from '../_utils/directiveUtils.js';
import { resolveControls } from '../_utils/controlPromptRenderer.js';
import { recordControlEpochIfNeeded } from '../_utils/controlSuppressionTelemetry.js';
import { TEMPO_DIAL_BANDS } from '../_utils/tempoDialBands.js';
// Release 2 PR-b — the tempo-dial clamp (desired → effective, version-bound
// fail-closed) at the NON-fenced mode-resolution seam, and the §14 provenance
// SIBLING spread beside (never inside) the regex-locked receipt at the four
// swap origin paths (founder amendment: site 4 / buildSwapReceiptSource is
// NO-EDIT).
import { clampHftConfig, resolveTempoDial, desiredTempoOf } from '../_utils/tempoDialClamp.js';
import { buildSwapProvenance } from '../_utils/swapProvenance.js';
import { ARCHETYPE_INTEGRITY_MODE, STANDING_LEANS_ENABLED, TEMPO_DIAL_ENABLED, LEARNING_L1_CAPTURE_ENABLED, LEARNING_L1_CAPTURE_EXPANSION_ENABLED, REGIME_STAMP_ENABLED } from '../../src/config/featureFlags.js';
// Corpus Capture Patch W3 — pure regimeAtStart stamp helpers (write-once /
// flag / shape semantics live there so they are behaviorally unit-testable).
import { shouldStampRegime, buildRegimeAtStart } from '../_utils/regimeStamp.js';
// Agent Learning System L1 — raw capture (DARK behind LEARNING_L1_CAPTURE_ENABLED,
// false at merge). captureSwapReceipt is a strict no-op when the flag is off.
import { captureSwapReceipt, resolveEntrySnapshot, classifyEntryAtrSource, classifyEvidence } from '../_utils/learning/captureReceipt.js';
import { finalizeCronState } from '../_utils/agentCronState.js';
// P4 — the tournament discriminator of record (code-review finding: never a
// string literal). Zero-import schema module, BUILD_RULES §4.
import { TOURNAMENT_GAME_MODE } from '../../src/constants/leagueTournament.js';
import { classifyHaikuFailure, shouldStartHaikuCall, nextConsecutiveEvalFailures, HAIKU_CALL_CEILING_MS, EVAL_MODEL_ID } from '../_utils/agentEvalTransport.js';
import { logBattlePattern } from '../_utils/battlePatternLogger.js';
import { runCanonicalOpenSweep } from '../_utils/canonicalOpenSweep.js';
import { logEvaluation, logVisionTransition, logAnticipation } from '../_utils/shadowLogger.js';
import { filterActiveConstraints } from '../_utils/visionRuntime.js';
import { confidenceToFloat } from '../../src/constants/visionEnums.js';
import { validateTransition } from '../../src/types/vision/visionValidators.js';
import { Timestamp } from 'firebase-admin/firestore';
// Archetype Mastery P1 (Spec V2 §3/§5; V2.1 memo of record:
// docs/ARCHETYPE_MASTERY_SPEC_V2_1_STOP_RULINGS_JUL21_2026.md). Dark by
// default: with the epoch registry empty (pre-first-enablement) every one of
// these paths writes NOTHING mastery-related — flags-off byte-identity.
import { readMasteryFlagView, requiresDeferral, DARK_FLAG_VIEW, MASTERY_XP_ENABLED } from '../_utils/masteryConfig.js';
import {
  isMasterySubject,
  maybeBuildEligibilityStampFields,
  stampMasterySlotFirstTick,
  runAwardTransaction,
  runRepairSweep,
} from '../_utils/masterySettlement.js';

// maxDuration raised 60→300 (agent-eval budget-starvation fix, July 2026). The
// Pro-plan ceiling supports it — tournament-orchestrator.js already runs at 300.
// This does NOT touch the fenced pre-call guard (agentEvalTransport.js): it only
// widens the handler's own budget so more than one battle clears that guard per
// tick. Mitigation, not architecture — see the scale note in the PR.
export const config = { maxDuration: 300 };

const LOG_PREFIX = '[AgentEval]';
const EVALUATING_LOCK_TIMEOUT_MS = 120_000; // 2 minutes
const TIME_BUDGET_MS = 290_000; // 290s — leave 10s buffer under the 300s maxDuration for cleanup/response

let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    // maxRetries: 0 — deliberate deviation from the codebase's maxRetries: 2
    // convention (decide.js, reflect.js, compile-dimensions.js, ...). The SDK
    // retries timeouts and connection errors by default, and this cron cannot
    // absorb retry multiplication: 2 retries × the 20s per-request timeout at
    // the call site ≈ 60s per battle — enough to blow a single battle's slice of
    // the shared budget and lose its awaited finalUpdate. Phase 2 failureClass
    // instrumentation measures whether transient errors (429/5xx) are frequent
    // enough to justify a budgeted retry later (founder decision L2: measure
    // first, no retries now). Safe at client level: this file has exactly one
    // messages.create call site.
    anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY, maxRetries: 0 });
  }
  return anthropicClient;
}

/**
 * Consumer half of Option B. Decide whether to rebuild the hotBench menu this
 * tick: on a new trading day (the original once/day cadence) OR when the
 * producer has published a fresher stockRankings doc since our last rebuild
 * (an intraday recompute) — so menu membership tracks fresh baggerBombFit
 * instead of being frozen for the whole day. Pure for unit testing.
 *
 * Inert pre-Option-B: when computedAt is absent both ms values are 0, the
 * intraday clause (0 > 0) is false, and the gate falls back to isNewTradingDay.
 */
export function shouldRebuildHotBench({ isNewTradingDay, rankingsComputedMs, lastHotBenchComputedMs }) {
  return isNewTradingDay || (rankingsComputedMs > lastHotBenchComputedMs);
}

export default async function handler(req, res) {
  // ---- 1. Auth ----
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getFirebaseAdmin();
  const startTime = Date.now();
  const summary = { evaluated: 0, triggered: 0, swapped: 0, held: 0, errors: 0, skipped: 0, expired: 0 };

  try {
    // ---- 1b. Mastery flag view (Spec V2 §5.1; adversarial rulings B1/B2).
    // COMPILE-TIME BRANCH FIRST (B2): with the constant off — the standing
    // dark state — NO mastery I/O happens here at all (no registry read;
    // read-count photographed by the completion tests). With the constant
    // live: one registry read per run, and BOTH a transport failure AND a
    // half-flipped registry (absent/empty/malformed while live — see the
    // append-epoch-then-flip-constant protocol in masteryConfig.js) defer
    // MASTERY SUBJECT completions only (B1, delay-not-loss: an unstamped
    // settlement completion is invisible to the stamps-only §5.3 sweep
    // forever). CPU seats can never be stamped under any flag view, so they
    // always complete. Loud error + a DEDICATED counter, never the benign
    // `skipped` bucket (monitoring must distinguish this from lock churn).
    let masteryFlagView = DARK_FLAG_VIEW;
    let masteryDeferSubjects = false;
    if (MASTERY_XP_ENABLED) {
      try {
        masteryFlagView = await readMasteryFlagView(db);
        if (requiresDeferral(masteryFlagView)) {
          masteryDeferSubjects = true;
          console.error(`${LOG_PREFIX} mastery registry half-flip anomaly (absent/empty/malformed with XP live) — deferring mastery-subject completions this run (delay-not-loss). Ceremony order of record: append-epoch-then-flip-constant.`);
        }
      } catch (flagErr) {
        masteryDeferSubjects = true;
        console.error(`${LOG_PREFIX} mastery flag-view read FAILED with XP live — deferring mastery-subject completions this run (delay-not-loss): ${flagErr.message}`);
      }
    }
    // Per-run memos for the mastery mode/award path (distinct from the eval
    // loop's tournamentGroupCache, which is created after the market gate).
    const masteryGroupCache = new Map();
    const masterySiblingsCache = new Map();
    summary.completionSkipped = 0;
    summary.masteryDeferredCompletions = 0;

    // ---- 2. Complete expired battles (runs regardless of market hours) ----
    const allBattles = await findActiveAgentBattles(db);
    const activeBattles = [];

    for (const battle of allBattles) {
      if (battle.expiresAt && new Date(battle.expiresAt) < new Date()) {
        if (masteryDeferSubjects && isMasterySubject(battle)) {
          summary.masteryDeferredCompletions++;
          continue; // deferred whole: neither completed nor evaluated this run
        }
        try {
          const completion = await completeBattle(db, battle, summary, masteryFlagView, masteryGroupCache, masterySiblingsCache);
          if (completion.committed) {
            // Log battle pattern for earned trait detection (Phase 2 pre-warm, non-blocking)
            logBattlePattern(battle.agentId, battle.id, battle).catch(err => {
              console.error(`${LOG_PREFIX} Pattern logging failed for battle ${battle.id}:`, err.message);
            });
            // Reflection is handled by the dedicated process-pending-reflections cron,
            // gated by the pendingReflection flag set inside completeBattle().
            summary.expired++;
          } else if (completion.reason === 'missing') {
            // The doc vanished mid-run (admin delete): loud error, never a
            // phantom "expired and completed" + pattern-log for a nonexistent
            // battle (/code-review high, angle-B finding).
            console.error(`${LOG_PREFIX} Expired battle ${battle.id} no longer exists — counted as error, not completed.`);
            summary.errors++;
          } else {
            summary.completionSkipped++; // another writer fully completed it first
          }
        } catch (err) {
          console.error(`${LOG_PREFIX} Error completing expired battle ${battle.id}:`, err.message);
          summary.errors++;
        }
      } else {
        activeBattles.push(battle);
      }
    }

    // ---- 2b. Mastery repair sweep (Spec V2 §5.3) — stamps-only, hosted on
    // this EXISTING cron cadence (no new schedule entry, BUILD_RULES §6).
    // Isolated like the canonical-open sweep: failures never propagate.
    // ALWAYS runs (ruling M8): no registry dependency — pre-epoch-1 the
    // pending-stamp query returning nothing is its own epoch proof, and the
    // sweep stays the recovery path for stranded pendings even in a full
    // rollback. Cursor-paged (ruling M7) so no doc monopolizes the window.
    try {
      summary.masterySweep = await runRepairSweep(db, {
        nowIso: new Date().toISOString(),
        limit: 25,
        groupCache: masteryGroupCache,
        siblingsCache: masterySiblingsCache,
      });
    } catch (sweepErr) {
      console.error(`${LOG_PREFIX} [masterySweep] FAILED (isolated — agent-evaluate unaffected): ${sweepErr.message}`);
      summary.masterySweep = { error: sweepErr.message };
    }

    // ---- 2c. Bare GC-completion repair (adversarial ruling Q11): the
    // expiry loop reads only status=='active' battles, so a decide.js GC'd
    // battle (already 'completed') can never reach completeBattle's repair
    // branch through it — only the mid-run race window could. This bounded
    // query (completed + completionReason 'expired' + recent completedAt;
    // repaired docs drop out via the pendingReflection in-memory filter)
    // makes the repair reachable on the normal cadence. Registry-independent
    // core bookkeeping: repairs never stamp (V2.1 STOP-A.2), so it runs
    // even while mastery-subject completions are deferred.
    try {
      summary.gcRepairs = await repairBareGcCompletions(db, summary, masteryFlagView, masteryGroupCache, masterySiblingsCache);
    } catch (gcErr) {
      console.error(`${LOG_PREFIX} [gcRepair] FAILED (isolated — agent-evaluate unaffected): ${gcErr.message}`);
      summary.gcRepairs = { error: gcErr.message };
    }

    // ---- 3. Market hours guard (only for evaluations, not expiry completion) ----
    if (!isMarketOpen()) {
      const duration = Date.now() - startTime;
      return res.status(200).json({ skipped: true, reason: 'market_closed', expired: summary.expired, duration });
    }

    // ---- 3b. Canonical-open capture sweep (Spec §1.1, Phase 2) — ISOLATED
    // first-class subtask: its own timeout; any failure is caught + reported
    // here and NEVER propagated to agent-evaluate (nor vice versa). Inert in
    // prod: with LEAGUE_CANONICAL_OPEN_CAPTURE off no round carries the
    // canonical_open stamp, so the sweep early-returns a no-op. Runs on every
    // open arm regardless of agent-battle count (the user layer is independent).
    try {
      summary.canonicalOpenSweep = await runCanonicalOpenSweep(db, { now: new Date(), timeoutMs: 15000 });
    } catch (sweepErr) {
      console.error(`${LOG_PREFIX} [canonicalOpenSweep] FAILED (isolated — agent-evaluate unaffected):`, sweepErr.message);
      summary.canonicalOpenSweep = { error: sweepErr.message };
    }

    if (activeBattles.length === 0) {
      return res.status(200).json({ evaluated: 0, expired: summary.expired, canonicalOpenSweep: summary.canonicalOpenSweep, message: 'No active agent battles' });
    }

    console.log(`${LOG_PREFIX} Found ${activeBattles.length} active agent battle(s) (${summary.expired} expired and completed)`);

    // P2: per-invocation memo for tournament GROUP docs (4 agents per group
    // share one). Regular battles never touch it — their resolution
    // short-circuits on in-memory battle fields before any read.
    const tournamentGroupCache = new Map();

    // Fair-rotation ordering (budget-starvation mitigation). The shared per-tick
    // time budget only funds a bounded number of Haiku calls, so a stable
    // processing order starves the SAME tail battles every tick. Process the
    // neediest first: ascending by the last tick this battle actually STARTED a
    // Haiku call (cronState.lastEvalStartedAt — written ONLY on a real attempt,
    // so budget_skipped ticks never refresh it). Never-evaluated battles sort to
    // the front (''). ISO-8601 timestamps compare chronologically as strings.
    // This makes starvation FAIR (every battle cycles to the front over
    // successive ticks), it does NOT make it go away — the real fix is per-battle
    // fan-out (see the scale note in the PR/report).
    activeBattles.sort((a, b) =>
      (a.cronState?.lastEvalStartedAt || '').localeCompare(b.cronState?.lastEvalStartedAt || '')
    );

    // ---- 4. Process each battle sequentially (with time budget) ----
    for (const battle of activeBattles) {
      const elapsed = Date.now() - startTime;
      if (elapsed > TIME_BUDGET_MS) {
        const remaining = activeBattles.length - summary.evaluated - summary.errors;
        console.log(`${LOG_PREFIX} Time budget exceeded (${elapsed}ms). ${remaining} agent(s) deferred to next tick.`);
        summary.skipped += remaining;
        break;
      }

      try {
        // Pass startTime so processAgentBattle can budget-gate the Phase 3
        // anticipation dispatch in its finally block (anticipations skip
        // gracefully if <12s of cron budget remain; narrations always fire).
        await processAgentBattle(db, battle, summary, startTime, tournamentGroupCache, masteryFlagView);
      } catch (err) {
        console.error(`${LOG_PREFIX} Error processing battle ${battle.id}:`, err.message);
        summary.errors++;

        // Log error to cronState
        try {
          const battleRef = db.collection('agentBattles').doc(battle.id);
          const cronErrors = (battle.cronState?.cronErrors || []).slice(-19);
          cronErrors.push({
            timestamp: new Date().toISOString(),
            error: err.message,
            stack: (err.stack || '').slice(0, 200),
          });
          await battleRef.update({
            'cronState.cronErrors': cronErrors,
            'cronState.evaluatingAt': null,
          });
        } catch (logErr) {
          console.error(`${LOG_PREFIX} Failed to log error for battle ${battle.id}:`, logErr.message);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`${LOG_PREFIX} Complete in ${duration}ms:`, summary);

    return res.status(200).json({ ...summary, duration });
  } catch (err) {
    console.error(`${LOG_PREFIX} Fatal error:`, err);
    return res.status(500).json({ error: err.message });
  }
}

// ==================== CORE PROCESSING ====================

// P2: statusFeed mirror of a ledger double-down event (Spec §2, agent half).
// The durable record is written atomically inside the confirm transaction on
// the ledger doc; this entry is the player-visible feed beat, flushed via
// the existing awaited statusFeed writes.
function buildDoubleDownFeedEntry(event) {
  return {
    timestamp: event.at,
    message: event.kind === 'formed'
      ? `Double-down formed: agent swapped into ${event.symbol} alongside its player's ${event.userDirection} pick.`
      : `Double-down broken: agent swapped out of ${event.symbol} — its player's ${event.userDirection} pick now stands alone.`,
    pvpContext: null,
    action: event.kind === 'formed' ? 'double_down_formed' : 'double_down_broken',
    source: 'tournament_ledger',
    evalId: null,
    symbolOut: event.kind === 'broken' ? event.symbol : null,
    symbolIn: event.kind === 'formed' ? event.symbol : null,
  };
}

// P2: phase 2 of the two-phase swap protocol, shared by all five
// executeSwapServer call sites. Confirm failures are logged, never rethrown:
// the swap ALREADY EXECUTED (the battle doc is the derived ground truth), so
// post-swap bookkeeping must not be unwound by a ledger hiccup — the
// reservation TTL-expires and nightly reconciliation repairs the held set.
async function confirmTournamentSwap(db, tournamentCtx, battle, { symbolIn, symbolOut }, statusFeedEntries) {
  if (!tournamentCtx) return;
  try {
    const { events } = await confirmSwap(db, {
      groupId: tournamentCtx.groupId,
      symbolIn,
      symbolOut,
      agentId: tournamentCtx.agentId,
      battleId: battle.id,
      now: new Date(),
      odUserId: tournamentCtx.odUserId,
    });
    for (const event of events) {
      statusFeedEntries.push(buildDoubleDownFeedEntry(event));
    }
  } catch (confirmErr) {
    console.error(`${LOG_PREFIX} Ledger confirm failed for ${symbolIn} (battle ${battle.id}) — divergence until nightly reconciliation:`, confirmErr.message);
  }
}

// P2: the compensating action for the existing catch blocks. Awaited, but a
// release failure must never mask the original swap error — it only logs.
// Idempotent: releasing an already-cleared reservation is a no-op.
async function releaseTournamentReservation(db, tournamentCtx, symbol) {
  if (!tournamentCtx || !symbol) return;
  try {
    await releaseReservation(db, { groupId: tournamentCtx.groupId, symbol, agentId: tournamentCtx.agentId });
  } catch (releaseErr) {
    console.error(`${LOG_PREFIX} Compensating release failed for ${symbol} — reservation expires by TTL:`, releaseErr.message);
  }
}

// P2: the tournament candidate filter — held-by-rival symbols removed from
// this tick's IN-MEMORY bench and watchlist.hotBench (both are swap-in
// candidate surfaces: the bench feeds benchAssets/allBench/findBenchAsset
// and prompt assembly; watchlist.hotBench feeds the Haiku prompt and fenced
// validateTradeDecision's hotBench match). In-memory only — executeSwapServer
// rebuilds the persisted bench from its own transaction read, and the
// watchlist is only persisted on rebuild ticks from already-filtered
// candidates. No-op when tournamentCtx is null (identity helpers), so the
// regular-battle path is untouched.
function applyTournamentCandidateFilter(battle, tournamentCtx) {
  if (!tournamentCtx) return;
  if (battle.portfolio?.bench?.stocks) {
    battle.portfolio.bench.stocks = excludeHeldByOthers(battle.portfolio.bench.stocks, tournamentCtx.heldByOthers);
  }
  const hotBench = battle.watchlist?.hotBench;
  if (Array.isArray(hotBench)) {
    const filtered = excludeHeldSymbols(hotBench, tournamentCtx.heldByOthers);
    if (filtered !== hotBench) {
      battle.watchlist = { ...battle.watchlist, hotBench: filtered };
    }
  }
}

// P2: the single battle re-read chokepoint. The persisted doc is UNFILTERED,
// so every post-swap/post-update refresh must re-apply the tournament
// candidate filter, or the rest of the tick would re-admit rival-held names
// to the candidate surfaces (the Spec §1.2 pre-filter invariant).
async function refreshBattleFromDoc(battleRef, battle, tournamentCtx) {
  const refreshedDoc = await battleRef.get();
  Object.assign(battle, refreshedDoc.data());
  applyTournamentCandidateFilter(battle, tournamentCtx);
}

// P2: phase 1 of the two-phase swap protocol, shared by all five
// executeSwapServer call sites. Contract: {reserved: true} WITHOUT any
// ledger I/O when tournamentCtx is null (regular battles sail through);
// otherwise a transactional reserve whose failure carries {reason, heldBy}.
// Each call site owns its failure disposition (skip / HOLD downgrade /
// lapse) — only the protocol lives here.
async function reserveTournamentSymbolIn(db, tournamentCtx, battle, symbol) {
  if (!tournamentCtx) return { reserved: true };
  return reserveSymbol(db, {
    groupId: tournamentCtx.groupId,
    symbol,
    agentId: tournamentCtx.agentId,
    battleId: battle.id,
    now: new Date(),
  });
}

// P2: statusFeed entry for the two designed risk-loop exclusivity beats
// (emptied pool / reserve lost) — one builder so the 'tournament_pool_empty'
// event shape can't drift between its two sites.
// [VWAP Floor B6] Cascade-guard qualification: once the daily fire counter
// crosses VWAP_CASCADE_GUARD_N, every further vwap_failure replacement must
// prove on FRESH intraday data that it isn't itself below the dead-band —
// otherwise the floor is just rotating one weak name into another. Fail-closed:
// fetch error, timeout, stale session, or thin session all disqualify
// (skip-and-hold; bust/trail still protect the position). Memoized per tick so
// re-picks of the same symbol don't re-fetch. Race-without-abort is accepted
// here (unlike the Haiku hard-abort): an orphaned EODHD GET costs nothing and
// bills nothing.
async function qualifyCascadeReplacement(symbol, { todayET, deadBandPct, memo }) {
  if (memo.has(symbol)) return memo.get(symbol);
  let qualified = false;
  let timeoutId = null;
  try {
    const candles = await Promise.race([
      fetchIntradayCandles(symbol, { interval: '5m' }),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('qualification fetch timeout')), CASCADE_QUALIFY_TIMEOUT_MS);
      }),
    ]);
    if (Array.isArray(candles) && candles.length > 0) {
      const { candles: sessionCandles, sessionDate } = filterToLatestSession(candles);
      const vwapResult = calculateVWAP(sessionCandles);
      qualified = !!vwapResult && isReplacementQualified({
        sessionDate,
        sessionCandleCount: sessionCandles.length,
        vwapDeviation: vwapResult.vwapDeviation,
        todayET,
        deadBandPct,
      });
    }
  } catch (err) {
    console.warn(`${LOG_PREFIX} Cascade qualification failed for ${symbol} (${err.message}) — treating as UNQUALIFIED`);
    qualified = false;
  } finally {
    clearTimeout(timeoutId);
  }
  memo.set(symbol, qualified);
  return qualified;
}

function buildPoolEmptyFeedEntry({ message, symbolOut, symbolIn = null, regime = null, score, reason }) {
  return {
    timestamp: new Date().toISOString(),
    message,
    pvpContext: null,
    action: 'tournament_pool_empty',
    regime,
    score,
    citedRules: [reason],
    triggeredBy: `risk_${reason}`,
    source: 'tournament_ledger',
    evalId: null,
    symbolOut,
    symbolIn,
  };
}

async function processAgentBattle(db, battle, summary, cronStartTime = Date.now(), tournamentGroupCache = new Map(), masteryFlagView = DARK_FLAG_VIEW) {
  const battleRef = db.collection('agentBattles').doc(battle.id);

  // ---- Idempotency: atomically check and acquire evaluatingAt lock ----
  const lockAcquired = await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(battleRef);
    const data = doc.data();
    const currentLock = data?.cronState?.evaluatingAt;

    if (currentLock) {
      const lockAge = Date.now() - new Date(currentLock).getTime();
      if (lockAge < EVALUATING_LOCK_TIMEOUT_MS) {
        return false; // Lock held by another process
      }
    }

    // Release 2 PR-c (/code-review): the epoch telemetry and this tick's
    // prompt resolution derive the directive kill set from
    // battle.controlEpochLog, but `battle` came from the run's initial query
    // snapshot — refresh the log from THIS transaction's own doc read so an
    // entry appended between the query and the lock is never missed (a stale
    // read here could double-log an epoch or resurrect a killed directive).
    if (data) {
      battle.controlEpochLog = data.controlEpochLog;
      // Corpus Capture Patch W3 (/code-review fix, same rationale as the
      // PR-c refresh above): the write-once regimeAtStart guard reads
      // battle.regimeAtStart, but `battle` came from the run's initial query
      // snapshot — refresh it from THIS transaction's own doc read so a
      // stamp written between the query and the lock (another cron overlap /
      // manual invocation) is never overwritten by a stale-snapshot re-stamp.
      battle.regimeAtStart = data.regimeAtStart;
    }

    // Atomically claim the lock
    transaction.update(battleRef, {
      'cronState.evaluatingAt': new Date().toISOString(),
    });
    return true;
  });

  if (!lockAcquired) {
    console.log(`${LOG_PREFIX} Battle ${battle.id} already being evaluated — skipping`);
    summary.skipped++;
    return;
  }

  // Phase 2 Voice Layer Rework — trade narrations queued during this tick.
  // Declared outside the try so the finally block can dispatch them
  // regardless of early-return or thrown-error exit path. Each entry is
  // { closedTrade, evalId }; the dispatch loop in the finally block
  // calls generateTradeNarration in parallel via Promise.allSettled.
  const pendingNarrations = [];

  // Phase 3 Voice Layer Rework — anticipation candidates Haiku flagged
  // this tick. Same lifetime as pendingNarrations (declared outside try
  // so the finally block can dispatch them). Each entry is
  // { candidate, evalId }; the dispatch loop in the finally block runs
  // AFTER pendingNarrations have settled (sequential between batches,
  // parallel within each batch), and is budget-gated to skip gracefully
  // under cron time pressure.
  const pendingAnticipations = [];

  try {
    // Migration guard for pre-Sprint 2/3/4 battles
    const migrationFields = {};
    if (battle.executionMode === undefined) migrationFields.executionMode = 'copilot';
    if (battle.pendingProposal === undefined) migrationFields.pendingProposal = null;
    if (battle.proposalHistory === undefined) migrationFields.proposalHistory = [];
    if (battle.battleLedger === undefined) migrationFields.battleLedger = [];
    if (battle.statusFeed === undefined) migrationFields.statusFeed = [];
    if (battle.strategyPreset === undefined) migrationFields.strategyPreset = 'balanced';
    if (battle.gameplanMeeting === undefined) migrationFields.gameplanMeeting = null;
    if (battle.gameplanMeetingHistory === undefined) migrationFields.gameplanMeetingHistory = [];
    if (battle.chatExchanges === undefined) migrationFields.chatExchanges = [];
    if (battle.chatBudgetUsed === undefined) migrationFields.chatBudgetUsed = 0;
    if (battle.dailyReviews === undefined) migrationFields.dailyReviews = [];
    if (battle.dailyGrades === undefined) migrationFields.dailyGrades = {};

    if (Object.keys(migrationFields).length > 0) {
      console.log(`${LOG_PREFIX} Migrating battle ${battle.id}: adding ${Object.keys(migrationFields).join(', ')}`);
      await battleRef.update(migrationFields);
      Object.assign(battle, migrationFields);
    }

    // ---- Mastery slot stamp (Spec V2 §3) — FIRST evaluation tick, write-once.
    // The stamp is authoritative once written (authority inversion); the
    // in-transaction re-read guard inside stampMasterySlotFirstTick is the
    // regimeAtStart pattern, so a stolen eval lock cannot double-stamp.
    // Dark pre-epoch-1 (everEnabled false → zero writes); CPU system agents
    // are structurally outside mastery (V2.1 memo). Errors are swallowed —
    // the slot derives lazily at settlement (§3) so evaluation is never
    // blocked and nothing is lost.
    if (masteryFlagView.everEnabled && isMasterySubject(battle) && battle.masterySlot === undefined) {
      try {
        const slotResult = await stampMasterySlotFirstTick(db, battle, { nowIso: new Date().toISOString() });
        if (slotResult.stamp) battle.masterySlot = slotResult.stamp;
      } catch (slotErr) {
        console.error(`${LOG_PREFIX} mastery slot stamp failed for battle ${battle.id} (ignored — settles lazily): ${slotErr.message}`);
      }
    }

    // ---- P2: tournament context (null for every regular battle) ----
    // The resolver's discriminator is the battle doc's own gameMode/groupId
    // stamp (written by P4's fence entry at creation): strict in-memory
    // checks, so a non-tournament battle reaches this point and moves on
    // with ZERO ledger I/O. Tournament battles resolve their group + the
    // cross-agent held set here, then have held-by-other symbols removed
    // from this tick's IN-MEMORY candidate surfaces (bench + hotBench — see
    // applyTournamentCandidateFilter; re-applied after every battle re-read
    // by refreshBattleFromDoc, because the persisted doc is unfiltered).
    // Own player's user-layer picks are never in the agent ledger (dual
    // markets) and are therefore never filtered — the double-down stays open.
    const tournamentCtx = await resolveTournamentContext(db, battle, tournamentGroupCache);
    applyTournamentCandidateFilter(battle, tournamentCtx);

    const ctx = battle.agentContext || {};
    const currentDay = getCurrentTradingDayServer(battle.timing?.tradingDays);

    // StatusFeed cap: 100 for agent battles, 50 for PvP
    const STATUS_FEED_CAP = battle.agentId ? 100 : 50;

    // ---- Strategy preset config (Sprint 4) ----
    const presetConfig = getPresetConfig(battle.strategyPreset || 'balanced');

    // ---- Collect all symbols ----
    const flatPortfolio = flattenPortfolioServer(battle.portfolio);
    const portfolioSymbols = flatPortfolio.map(a => a.symbol).filter(Boolean);
    const benchAssets = [
      ...(battle.portfolio?.bench?.stocks || []),
      ...(battle.portfolio?.bench?.crypto ? [battle.portfolio.bench.crypto] : []),
    ].filter(Boolean);
    const benchSymbols = benchAssets.map(a => a.symbol).filter(Boolean);
    const macroSymbols = ['SPY', 'QQQ', 'BTC-USD.CC'];
    // Expand with watchlist hotBench for open universe trading (may be updated by daily refresh)
    let hotBenchSymbols = battle.watchlist?.hotBench || [];
    const cpuPortfolioFlat = flattenPortfolioServer(battle.opponent?.portfolio);
    const cpuSymbols = cpuPortfolioFlat.map(a => a.symbol).filter(Boolean);
    const allSymbols = [...new Set([...portfolioSymbols, ...benchSymbols, ...hotBenchSymbols, ...cpuSymbols, ...macroSymbols])];

    // ---- Fetch prices ----
    const prices = {};
    // Guard 2: keep the daily series (already fetched) as the independent
    // reference for the prior-session close. In-memory only — never written to
    // the battle doc.
    const dailySeries = {};
    await Promise.all(
      allSymbols.map(async (symbol) => {
        try {
          const data = await getStockAnalysisData(symbol, { forceRefresh: true, fields: ['daily', 'price'] });
          if (data?.price) {
            prices[symbol] = data.price;
          }
          if (Array.isArray(data?.daily)) {
            dailySeries[symbol] = data.daily;
          }
        } catch (err) {
          console.warn(`${LOG_PREFIX} Price fetch failed for ${symbol}:`, err.message);
        }
      })
    );

    // ---- Compute macro benchmarks (Amendment 4) ----
    const macroPrices = {
      SPY: prices['SPY']?.changePercent || 0,
      QQQ: prices['QQQ']?.changePercent || 0,
      BTC: prices['BTC-USD.CC']?.changePercent || 0,
    };

    // ---- Compute scores for active positions ----
    // Day-1 calendar gate: on the activation day, BaggerBomb threshold baseline
    // is the activation price (portfolio.startingPrices) so pre-activation moves
    // don't pre-trigger badges. On day 2+, baseline rolls to previousClose for
    // fresh daily threshold detection — matching V4's daily-reset gameplay.
    const todayET = formatDateString(getETDate());
    const activationDateET = battle.activatedAt
      ? formatDateString(new Date(new Date(battle.activatedAt).toLocaleString('en-US', { timeZone: 'America/New_York' })))
      : todayET;  // defensive fallback if activatedAt missing (should never happen on new battles)
    const isActivationDay = todayET === activationDateET;
    // Guard 2 cutoff for crypto (24/7, UTC-dated daily bars).
    const utcToday = new Date().toISOString().slice(0, 10);
    const startingPrices = battle.portfolio?.startingPrices || {};
    const assetScores = flatPortfolio.map(asset => {
      const currentPrice = prices[asset.symbol]?.current;
      const entryPrice = asset.swapPrice || startingPrices[asset.symbol] || 0;

      if (!currentPrice || entryPrice <= 0) {
        return calculateAssetScoreServer(
          { symbol: asset.symbol, baseATR: asset.baseATR, tier: asset.tier, direction: asset.direction },
          0,
          battle.thresholdHistory?.[asset.symbol] || {}
        );
      }

      let priceChange = ((currentPrice - entryPrice) / entryPrice) * 100;
      let previousClose = prices[asset.symbol]?.previousClose;
      // Guard 2: when previousClose is the badge baseline (day 2+, or a day-1
      // asset whose startingPrice is missing), validate it against the prior
      // session's close first. A stale/wrong-session previousClose would
      // otherwise fabricate badges on a near-flat ticker.
      if (!asset.swapPrice && (!isActivationDay || !(startingPrices[asset.symbol] > 0))) {
        const isCryptoAsset = asset.isCrypto === true || /\.CC$/i.test(asset.symbol || '');
        const g2 = resolveBadgeBaseline({
          daily: dailySeries[asset.symbol],
          previousClose,
          isCrypto: isCryptoAsset,
          baseATR: asset.baseATR || (isCryptoAsset ? 5.0 : 2.5),
          etToday: todayET,
          utcToday,
        });
        if (g2.fired) {
          console.warn(`${LOG_PREFIX} [guard2]${g2.corporateActionSuspected ? '[corp-action?]' : ''} ${asset.symbol} previousClose=${previousClose} (${g2.reason}); ${g2.value === previousClose ? 'accepted+flagged' : `substituted ${g2.value}`}`);
        }
        previousClose = g2.value;
      }
      // Threshold baseline must match the asset's entry into the portfolio.
      // For swapped-in assets, use swapPrice so they don't get retroactive
      // BaggerBomb credit for pre-swap moves since previousClose.
      const thresholdBaseline = asset.swapPrice
        || (isActivationDay ? (startingPrices[asset.symbol] || previousClose) : previousClose);
      const thresholdPriceChange = thresholdBaseline && thresholdBaseline > 0
        ? ((currentPrice - thresholdBaseline) / thresholdBaseline) * 100
        : null;

      return calculateAssetScoreServer(
        { symbol: asset.symbol, baseATR: asset.baseATR, tier: asset.tier, direction: asset.direction },
        priceChange,
        battle.thresholdHistory?.[asset.symbol] || {},
        {},
        thresholdPriceChange
      );
    });

    // ---- Compute CPU opponent scores ----
    const cpuAssetScores = cpuPortfolioFlat.map(asset => {
      const currentPrice = prices[asset.symbol]?.current;
      const entryPrice = startingPrices[asset.symbol] || 0;

      if (!currentPrice || entryPrice <= 0) {
        return calculateAssetScoreServer(
          { symbol: asset.symbol, baseATR: asset.baseATR, tier: asset.tier, direction: asset.direction },
          0,
          {}
        );
      }

      const priceChange = ((currentPrice - entryPrice) / entryPrice) * 100;
      let previousClose = prices[asset.symbol]?.previousClose;
      // Guard 2 (same rule as active positions): validate previousClose against
      // the prior-session close whenever it is the badge baseline.
      if (!asset.swapPrice && (!isActivationDay || !(startingPrices[asset.symbol] > 0))) {
        const isCryptoAsset = asset.isCrypto === true || /\.CC$/i.test(asset.symbol || '');
        const g2 = resolveBadgeBaseline({
          daily: dailySeries[asset.symbol],
          previousClose,
          isCrypto: isCryptoAsset,
          baseATR: asset.baseATR || (isCryptoAsset ? 5.0 : 2.5),
          etToday: todayET,
          utcToday,
        });
        if (g2.fired) {
          console.warn(`${LOG_PREFIX} [guard2]${g2.corporateActionSuspected ? '[corp-action?]' : ''} ${asset.symbol} previousClose=${previousClose} (${g2.reason}); ${g2.value === previousClose ? 'accepted+flagged' : `substituted ${g2.value}`}`);
        }
        previousClose = g2.value;
      }
      // CPU portfolio has no swaps, but keep the pattern symmetric for future-proofing.
      const thresholdBaseline = asset.swapPrice
        || (isActivationDay ? (startingPrices[asset.symbol] || previousClose) : previousClose);
      const thresholdPriceChange = thresholdBaseline && thresholdBaseline > 0
        ? ((currentPrice - thresholdBaseline) / thresholdBaseline) * 100
        : null;

      return calculateAssetScoreServer(
        { symbol: asset.symbol, baseATR: asset.baseATR, tier: asset.tier, direction: asset.direction },
        priceChange,
        {},
        {},
        thresholdPriceChange
      );
    });

    const opponentScore = cpuAssetScores.reduce((sum, s) => sum + s.totalPoints, 0);

    // ---- Update scores (always, even without Haiku) ----
    const activeScore = assetScores.reduce((sum, s) => sum + s.totalPoints, 0);
    const bankedScore = (battle.trades || []).reduce((sum, t) => {
      return sum + (Number.isFinite(t?.lockedPoints) ? t.lockedPoints : 0);
    }, 0);
    // Phase 2: bankedBadgePoints persists badge points across days. Held-position
    // bonusPoints get banked nightly by agent-daily-scores.js, then thresholdHistory
    // is zeroed. Without this, multi-day battles silently lose all overnight badges.
    const bankedBadgePoints = battle.scoreState?.bankedBadgePoints?.total ?? 0;
    const currentScore = activeScore + bankedScore + bankedBadgePoints;

    const scoreUpdate = {
      'scoreState.activeScore': Math.round(activeScore * 100) / 100,
      'scoreState.bankedScore': Math.round(bankedScore * 100) / 100,
      'scoreState.currentScore': Math.round(currentScore * 100) / 100,
      'scoreState.opponentScore': Math.round(opponentScore * 100) / 100,
      'scoreState.lastScoredAt': new Date().toISOString(),
    };

    // Track peak score
    if (currentScore > (battle.scoreState?.peakScore || 0)) {
      scoreUpdate['scoreState.peakScore'] = Math.round(currentScore * 100) / 100;
      scoreUpdate['scoreState.peakScoreAt'] = new Date().toISOString();
    }

    // ---- Status feed entries (declared early — referenced by watchlist refresh + risk layer) ----
    const statusFeedEntries = [];

    // ---- Update threshold history ----
    // Use dot-path updates so we merge per-symbol rather than replacing the
    // full map. A full-object write here would clobber any thresholdHistory
    // entry a swap transaction wrote earlier in this cron run (e.g. the
    // freshly swapped-in symbol's zero-reset).
    for (const score of assetScores) {
      scoreUpdate[`thresholdHistory.${score.symbol}`] = score.history;
    }

    // ---- P4 contract #5 consumer (companion b; founder ruling D8) ----
    // CPU tournament battles are PASSIVE: scores + threshold history persist
    // (banking and the group composite stay honest) but everything triggered
    // is skipped — no momentum fetch, no risk swaps, no trigger gate, no
    // Haiku, no narrations/anticipations. The marker is stamped only by the
    // P4 fence entry at tournament deploys, so no regular battle can carry it.
    if (battle.isCpu === true) {
      finalizeCronState(scoreUpdate, {
        vwapTicks: battle.cronState?.vwapTicks || {},
        intradayMomentum: battle.cronState?.intradayMomentum || {},
        stagnationTicks: battle.cronState?.stagnationTicks || {},
        lastTickPrice: battle.cronState?.lastTickPrice || {},
        lastTickTimestamp: battle.cronState?.lastTickTimestamp || {},
        // Merge seam (VWAP branch ⇄ P4): the VWAP floor added vwapFireGuard to
        // finalizeCronState, which now writes it unconditionally. CPU passive
        // battles must round-trip the existing guard so the helper never persists
        // `undefined` (Firestore rejects it — ignoreUndefinedProperties is unset).
        vwapFireGuard: battle.cronState?.vwapFireGuard || {},
      });
      await battleRef.update(scoreUpdate);
      summary.evaluated++;
      summary.held++;
      console.log(`${LOG_PREFIX} battle ${battle.id}: CPU passive battle — scores marked, triggered evaluation skipped (P4 contract #5)`);
      return;
    }

    // ---- Parallel data fetch: intraday + rankings + technicalScores + marketContext ----
    const momentumData = { vwap: {}, rankings: {} };
    const technicalScoresMap = {};
    let marketContext = null;
    let spyData = null;

    const allTechSymbols = [...new Set([...portfolioSymbols, ...benchSymbols])];
    const techRefs = allTechSymbols.map(s => db.collection('stockTechnicalScores').doc(s));

    const [intradayResult, rankingsResult, techScoresResult, intelligenceResult] = await Promise.allSettled([
      fetchIntradayBatch(portfolioSymbols, { interval: '5m' }),
      db.collection('indexIntelligence').doc('stockRankings').get(),
      techRefs.length > 0 ? db.getAll(...techRefs) : Promise.resolve([]),
      db.getAll(
        db.collection('indexIntelligence').doc('marketContext'),
        db.collection('indexIntelligence').doc('SPY')
      ),
    ]);

    // Process intraday candles → VWAP + 5min SMA20.
    //
    // Asymmetric handling, deliberate:
    //   - calculateVWAP receives candles filtered to the current RTH session
    //     so the cumulative TPV/volume is bounded to today (proper session
    //     VWAP semantics — discovery/vwap-semantics-investigation.md).
    //   - calculate5minSMA20 receives ALL candles because it slices the last
    //     20 by index. 20 × 5min = 100 minutes is within-session by
    //     construction and would degrade unnecessarily near market open if
    //     the session filter were applied (fewer than 20 candles available).
    if (intradayResult.status === 'fulfilled') {
      const intradayMap = intradayResult.value;
      for (const symbol of portfolioSymbols) {
        const candles = intradayMap[symbol];
        if (candles && candles.length > 0) {
          const { candles: sessionCandles, sessionDate } = filterToLatestSession(candles);
          const vwapResult = calculateVWAP(sessionCandles);
          // [VWAP Floor A1] Freshness/arming gate: a stale session (EODHD
          // returning yesterday's candles) or an ultra-thin one (<3 candles
          // at the open) publishes NO vwap entry at all, so the floor cannot
          // strike and TRAIL_STOP disarms — identical to the existing
          // missing-intraday path. Bust + guardrails + Haiku still cover.
          if (vwapResult && isVwapSessionUsable({ sessionDate, todayET, sessionCandleCount: sessionCandles.length })) {
            const sma20_5m = calculate5minSMA20(candles);
            momentumData.vwap[symbol] = { ...vwapResult, sma20_5m, sessionDate };
          }
        }
      }
    } else {
      console.warn(`${LOG_PREFIX} Intraday fetch failed:`, intradayResult.reason?.message);
    }

    // Process stockRankings → bandwidth/NR7 + build hotBench asset map
    const hotBenchAssetMap = {};
    let stockRankingsArray = [];
    if (rankingsResult.status === 'fulfilled' && rankingsResult.value.exists) {
      stockRankingsArray = rankingsResult.value.data()?.stocks || [];

      // ---- Watchlist refresh (rankings-based) ----
      const lastEvalDay = battle.cronState?.lastEvalTradingDay || 0;
      const isNewTradingDay = currentDay > lastEvalDay && currentDay >= 1;

      // Consumer half of Option B: also rebuild when the producer published a
      // fresher stockRankings doc (intraday recompute) since our last rebuild,
      // so menu membership tracks fresh baggerBombFit — not just once/day.
      const rankingsComputedMs = rankingsResult.value.data().computedAt?.toMillis?.() ?? 0;
      const lastHotBenchComputedMs = battle.cronState?.lastHotBenchComputedAt || 0;
      const rebuildHotBench = shouldRebuildHotBench({ isNewTradingDay, rankingsComputedMs, lastHotBenchComputedMs });

      if (rebuildHotBench && battle.watchlist) {
        const portfolioSet = new Set(portfolioSymbols);
        const benchSet = new Set(benchSymbols);
        let candidates = stockRankingsArray
          .filter(s => !portfolioSet.has(s.symbol) && !benchSet.has(s.symbol))
          .sort((a, b) => (b.baggerBombFit || 0) - (a.baggerBombFit || 0));
        if (tournamentCtx) {
          // P2: hotBench candidates exclude symbols held by other agents in
          // the group (Spec §1.2 pre-filtering).
          candidates = excludeHeldByOthers(candidates, tournamentCtx.heldByOthers);
        }

        let newHotBench = candidates.slice(0, 15).map(s => s.symbol);
        // [Phase5B1] Union equipped tickers back into the hotBench every
        // refresh cycle (Q9). The rankings-based rebuild above drops equipped
        // tickers that aren't top-15 by baggerBombFit; the union re-admits
        // them. Soft cap 20 — equipped tickers always survive the cap.
        const equippedTickers = battle.agentContext?.equippedWatchlist?.tickers || [];
        if (equippedTickers.length > 0) {
          const beforeLen = newHotBench.length;
          newHotBench = unionEquippedIntoHotBench({
            hotBench: newHotBench,
            equippedTickers,
            rankings: stockRankingsArray,
            // P2: equipped tickers held by rival agents stay out too (the
            // union re-admits dropped tickers; spread of the empty array is
            // a no-op for regular battles).
            excludeSymbols: new Set([...portfolioSymbols, ...benchSymbols, ...(tournamentCtx ? tournamentCtx.heldByOthers : [])]),
            cap: 20,
          });
          console.log(`${LOG_PREFIX} [Phase5B1] Daily refresh unioned equipped tickers into hotBench (${beforeLen} → ${newHotBench.length})`);
        }
        const hotBenchSetRefresh = new Set(newHotBench);
        const newMonitoring = candidates
          .filter(s => !hotBenchSetRefresh.has(s.symbol))
          .slice(0, 18)
          .map(s => s.symbol);

        const refreshedWatchlist = {
          active: portfolioSymbols,
          hotBench: newHotBench,
          monitoring: newMonitoring,
          lastRefreshed: new Date().toISOString(),
          totalStocks: portfolioSymbols.length + newHotBench.length + newMonitoring.length,
        };

        scoreUpdate.watchlist = refreshedWatchlist;
        battle.watchlist = refreshedWatchlist;
        // Update hotBenchSymbols for this eval cycle
        hotBenchSymbols = newHotBench;

        if (isNewTradingDay) {
          statusFeedEntries.push({
            timestamp: new Date().toISOString(),
            message: `Daily watchlist refresh: ${newHotBench.length} hotBench, ${newMonitoring.length} monitoring stocks updated`,
            action: 'watchlist_refresh',
          });
        } else {
          // Intraday refresh (fresher rankings, same day) — log only, no feed spam.
          console.log(`${LOG_PREFIX} Intraday hotBench refresh: ${newHotBench.length} hotBench, ${newMonitoring.length} monitoring (rankings computedAt=${rankingsComputedMs})`);
        }
        scoreUpdate['cronState.lastEvalTradingDay'] = currentDay;
        // Persist the producer computedAt we just consumed so the next tick only
        // rebuilds again when a still-fresher doc arrives. Folds into the
        // battle-doc update this tick already writes — no extra write.
        scoreUpdate['cronState.lastHotBenchComputedAt'] = rankingsComputedMs;

        // Fetch prices for any new hotBench tickers not already fetched
        const newTickersNeedingPrices = newHotBench.filter(t => !prices[t]);
        if (newTickersNeedingPrices.length > 0) {
          await Promise.allSettled(newTickersNeedingPrices.map(async (symbol) => {
            try {
              const data = await getStockAnalysisData(symbol, { forceRefresh: true, fields: ['daily', 'price'] });
              if (data?.price) prices[symbol] = data.price;
            } catch (_e) { /* skip — best effort */ }
          }));
        }
      } else if (!isNewTradingDay && currentDay >= 1) {
        // Not a new day — just track the day if not yet set
        if (!battle.cronState?.lastEvalTradingDay) {
          scoreUpdate['cronState.lastEvalTradingDay'] = currentDay;
        }
      }

      const hotBenchSet = new Set(hotBenchSymbols);
      const existingBenchSet = new Set(benchSymbols);
      const activePortfolioSet = new Set(portfolioSymbols);

      for (const stock of stockRankingsArray) {
        if (portfolioSymbols.includes(stock.symbol) || benchSymbols.includes(stock.symbol) || hotBenchSet.has(stock.symbol)) {
          momentumData.rankings[stock.symbol] = {
            bBandwidthPercentile: stock.bBandwidthPercentile ?? null,
            nr7Flag: stock.nr7Flag ?? false,
            dailyRange: stock.dailyRange ?? null,
          };
        }
        // Build synthetic bench assets for hotBench stocks not already in bench.
        // P2: on non-rebuild ticks the persisted watchlist.hotBench can be
        // stale, so rival-held symbols are re-checked here before they can
        // become swap-in candidates via the bench merge below.
        if (hotBenchSet.has(stock.symbol) && !existingBenchSet.has(stock.symbol)
            // [VWAP Floor B3] Never offer an actively-held symbol as a swap-in
            // candidate via the synthetic bench (June 11: PANW triple-slot).
            && !activePortfolioSet.has(stock.symbol)
            && (!tournamentCtx || !tournamentCtx.heldByOthers.has(stock.symbol))) {
          hotBenchAssetMap[stock.symbol] = {
            symbol: stock.symbol,
            name: stock.name || stock.symbol,
            baseATR: stock.baseATR || (stock.atrPercentile ? stock.atrPercentile * 8 : 2.5),
            isCrypto: false,
            sector: stock.sectorName || 'Unknown',
          };
        }
      }

      // Merge hotBench assets into battle bench for prompt assembly + validation
      if (Object.keys(hotBenchAssetMap).length > 0) {
        const originalBenchStocks = battle.portfolio?.bench?.stocks || [];
        battle.portfolio.bench.stocks = [
          ...originalBenchStocks,
          ...Object.values(hotBenchAssetMap),
        ];
      }
    }

    // Process stockTechnicalScores → regime classification input
    if (techScoresResult.status === 'fulfilled') {
      for (const doc of techScoresResult.value) {
        if (doc.exists) technicalScoresMap[doc.id] = doc.data();
      }
    }

    // Process marketContext + SPY index docs
    if (intelligenceResult.status === 'fulfilled') {
      const [mcDoc, spyDoc] = intelligenceResult.value;
      if (mcDoc.exists) marketContext = mcDoc.data();
      if (spyDoc.exists) spyData = spyDoc.data();
    }

    // Corpus Capture Patch W3 — regimeAtStart stamp (DARK behind
    // REGIME_STAMP_ENABLED, false at merge). Write-once, if-absent, at the
    // battle's FIRST evaluation tick: reuses the marketContext doc loaded in
    // the parallel batch above (ZERO added reads; doc-missing ⇒ skip, next
    // tick retries). Staleness/'unknown' are recorded, never adjudicated.
    // In-memory mirror follows the migration-fields precedent so later code
    // this tick sees the stamped doc state. A stamp failure is logged and
    // swallowed — it must never break the evaluation pass.
    // shouldStampRegime is a cheap PRE-FILTER (flag / marketContext / regime /
    // updatedAt) on the in-memory doc; the AUTHORITATIVE write-once guard is the
    // in-transaction battle-doc read below.
    if (shouldStampRegime({ battle, marketContext, enabled: REGIME_STAMP_ENABLED })) {
      try {
        const regimeAtStart = buildRegimeAtStart(marketContext, new Date().toISOString());
        // #2 (adversarial review): ATOMIC write-once. The prior guarded-read-
        // then-separate-update raced under lock EXPIRY — EVALUATING_LOCK_TIMEOUT_MS
        // (120s) < TIME_BUDGET_MS (290s), so an invocation can still be alive when
        // another steals its expired lock; both then read regimeAtStart===undefined
        // (in-memory) and both write, clobbering the write-once field. Re-check the
        // field AT write time inside one transaction so only the first committer
        // wins. Reads ONLY battleRef (marketContext is already in hand — zero added
        // regime-source reads); buildRegimeAtStart is pure so it is computed outside
        // the txn (no recompute on auto-retry).
        const stamped = await db.runTransaction(async (t) => {
          const d = await t.get(battleRef);
          // Skip if the doc vanished (t.update would throw NOT_FOUND) or is
          // already stamped — never overwrite the write-once field.
          if (!d.exists || d.data()?.regimeAtStart !== undefined) return false;
          t.update(battleRef, { regimeAtStart });
          return true;
        });
        if (stamped) battle.regimeAtStart = regimeAtStart; // mirror only when we won
      } catch (stampErr) {
        console.error(`${LOG_PREFIX} regimeAtStart stamp failed (ignored, evaluation unaffected): ${stampErr?.message}`);
      }
    }

    // ---- Regime classification ----
    const marketPosture = (marketContext && spyData)
      ? classifyMarketPosture(marketContext, spyData)
      : 'selective';

    const stockRegimes = {};
    for (const symbol of allTechSymbols) {
      const techScore = technicalScoresMap[symbol];
      if (techScore) stockRegimes[symbol] = classifyStockRegime(techScore);
    }

    momentumData.regimes = stockRegimes;
    momentumData.marketPosture = marketPosture;

    // Bench data-parity: expose full per-symbol rankings + tech scores for
    // bench candidates so buildBenchTechnicalBlock can render the same
    // daily-grain technicals the chat agent already sees. Both maps are
    // already populated above (rankings via stockRankingsArray, tech via
    // technicalScoresMap); this is pure exposure, no extra I/O.
    momentumData.rankingsMap = Object.fromEntries(
      stockRankingsArray.map(s => [s.symbol, s])
    );
    momentumData.techScoresMap = technicalScoresMap;

    // Knob Calibration Task A — narrow hurdle-only ATR freshening. Re-derive the
    // active position's ATR from the FRESH hourly rankings (Option B) for use ONLY
    // as the clearsHurdleFloor divisor at the two hurdle call sites below. Stored
    // asset.baseATR / scoring.thresholds / badges / guardrails / banked score are
    // untouched. The pure helper is the single source of truth shared with the B2
    // calibration harness (A0/B0 discovery report, drift rider a).
    const freshHurdleAtrMap = buildFreshAtrPercentileMap(stockRankingsArray);

    // ---- Vision state read (Spec A Phase 2a + fix-up) ----
    // No new Firestore I/O — battle.vision is already in scope from the
    // active-battles fetch. Defensive on two axes:
    //   1. Pre-Spec-A battles without a `vision` field → { present: false }
    //   2. Corrupted Vision (e.g., non-enum confidence value would make
    //      confidenceToFloat throw) → swallow + warn + { present: false }
    //      so a single bad row doesn't abort the cron tick for that battle.
    let visionState;
    try {
      const vision = battle?.vision ?? null;
      visionState = vision
        ? {
            present: true,
            state: vision.state,
            thesis: vision.thesis,
            confidence: vision.confidence,
            confidenceFloat: confidenceToFloat(vision.confidence),
            source: vision.source,
            constraints: vision.constraints,
            activeConstraints: filterActiveConstraints(vision.constraints, vision.state, Date.now()),
            evidenceTrail: vision.evidenceTrail,
            lastUserTouchAt: vision.lastUserTouchAt,
            conditionSnapshot: vision.conditionSnapshot,
            transitionHistory: vision.transitionHistory,
          }
        : { present: false };
    } catch (err) {
      console.warn(
        `${LOG_PREFIX} Failed to build visionState for battle ${battle?.id} — falling back to present:false`,
        { error: err?.message }
      );
      visionState = { present: false };
    }
    momentumData.visionState = visionState;

    // ---- Risk evaluation layer (runs BEFORE trigger gate) ----
    const riskStatus = {};
    const riskSwaps = [];
    const lockedPositions = new Set();
    const vwapTicks = { ...(battle.cronState?.vwapTicks || {}) };
    // Forge Enforcement Keystone V1.4 §4.2 (Knob A) — per-symbol stagnation state,
    // seeded + persisted exactly like vwapTicks. nowMs anchors the D2 tick-age
    // guard; `withinAge` (computed per tick below) is transient — threaded via
    // cronMemory for the fire decision, NOT persisted.
    const stagnationTicks = { ...(battle.cronState?.stagnationTicks || {}) };
    const lastTickPrice = { ...(battle.cronState?.lastTickPrice || {}) };
    const lastTickTimestamp = { ...(battle.cronState?.lastTickTimestamp || {}) };
    // [VWAP Floor B1] Counter hygiene: drop keys for symbols no longer held,
    // so a symbol swapped out and later re-entered starts at zero instead of
    // inheriting a stale streak (June 11: VLO/XRP counters survived 6 swaps).
    // Also covers swaps landed outside this loop (proposal approval/expiry,
    // gameplan) by the next tick.
    pruneCounterMaps([vwapTicks, stagnationTicks, lastTickPrice, lastTickTimestamp], new Set(portfolioSymbols));
    // [VWAP Floor B6] Daily vwap_failure fire counter (resets on ET date
    // rollover) + this tick's qualification memo.
    const vwapFireGuard = seedVwapFireGuard(battle.cronState?.vwapFireGuard, todayET);
    const cascadeQualifyMemo = new Map();
    const nowMs = Date.now();

    // Forge Enforcement Keystone V1.4 §4.1 — resolve the archetype→physics knobs
    // once per battle (archetype is battle-level). getArchetypeConfig falls back
    // to analyst-default for unset/unknown archetypes (accepted at launch per
    // Decision 19). Passed into evaluateRisk so Knob A/B (Phase 3/4) read
    // archetypeConfig.hftConfig regardless of the user-toggleable strategyPreset
    // (Decision 2); base levers continue to come from presetConfig.risk.
    const baseArchetypeConfig = getArchetypeConfig(ctx.archetype);
    // P4: mode-aware knob resolution (Fence-Edit Map §5E). The founder-signed
    // calibration table is ZERO-delta, so this resolves to the identical
    // hftConfig object for every mode today — the hook exists so any future
    // flat6 recalibration is a config entry, never code. Downstream code uses
    // the mode-resolved view.
    // Release 2 PR-b: the tempo-dial clamp wraps the mode-resolved knobs.
    // Effective tempo is 'standard' (IDENTITY — the same object reference)
    // unless TEMPO_DIAL_ENABLED and the band table's forKnobConfigVersion
    // matches the deployed KNOB_CONFIG_VERSION; every suppression is visible
    // in dialClamp.provenance (never silent). Direction-aware per B4 §D;
    // safety fields untouched at every band.
    const dialClamp = clampHftConfig({
      hftConfig: resolveHftConfig(baseArchetypeConfig, battle.gameMode),
      desiredTempo: desiredTempoOf(battle),
      dialEnabled: TEMPO_DIAL_ENABLED,
    });
    const archetypeConfig = {
      ...baseArchetypeConfig,
      hftConfig: dialClamp.hftConfig,
    };
    // Gate 1 — archetype-distribution + behavioral-differentiation probe. Surfaces
    // the live archetype mix and confirms non-analyst archetypes resolve to
    // differentiated knobs (e.g. degen forcedRotation on / cap 12 vs guardian off
    // / cap 2). Also closes Gate 0c's live-distribution question via logs.
    console.log(`${LOG_PREFIX} [Gate1] battle=${battle.id} mode=${battle.gameMode || 'baggerbomb_agent'} archetype=${ctx.archetype || 'unknown'} resolved=${archetypeConfig.label} forcedRotation=${archetypeConfig.hftConfig?.forcedRotation?.enabled ? 'on' : 'off'} swapCap=${archetypeConfig.hftConfig?.swapWindow?.capPerWindow}`);

    // ---- Release 2 PR-c: control-suppression mode-epoch telemetry ----
    // The whole key → should-log → resolve → build → durable-write →
    // in-memory-sync sequence lives in the tested orchestrator
    // (controlSuppressionTelemetry.recordControlEpochIfNeeded), so the prompt
    // built later this tick and the durable record can never disagree. Fires
    // once per battle + mode-epoch (sequence-aware round-trip re-logging);
    // failures are loud and non-fatal — the next tick retries the same entry.
    try {
      await recordControlEpochIfNeeded({
        battleRef,
        battle,
        arrayUnion: FieldValue.arrayUnion,
        modes: {
          archetypeIntegrityMode: ARCHETYPE_INTEGRITY_MODE,
          standingLeansEnabled: STANDING_LEANS_ENABLED,
          tempoDialEnabled: TEMPO_DIAL_ENABLED,
        },
        resolveControls,
        directive: isDirectiveActive(battle?.directive, battle) ? battle.directive : null,
        dialProvenance: dialClamp.provenance,
        deploySha: globalThis.process?.env?.VERCEL_GIT_COMMIT_SHA || null,
        knobConfigVersion: KNOB_CONFIG_VERSION,
        dialBandVersion: TEMPO_DIAL_BANDS.forKnobConfigVersion,
      });
    } catch (epochErr) {
      console.error(`${LOG_PREFIX} control-epoch telemetry failed (tick continues):`, epochErr?.message || epochErr);
    }

    for (const score of assetScores) {
      const asset = flatPortfolio.find(a => a.symbol === score.symbol);
      const currentPrice = prices[score.symbol]?.current;
      const entryPrice = asset?.swapPrice || startingPrices[score.symbol] || 0;
      const vwapInfo = momentumData.vwap[score.symbol] || null;

      // Update VWAP tick counter.
      // [VWAP Floor A2] A strike requires magnitude below the preset
      // dead-band, not mere negativity — hovering at -0.05% is noise.
      if (vwapInfo && isVwapStrike(vwapInfo.vwapDeviation, presetConfig.risk.vwapDeadBandPct ?? 0.5)) {
        vwapTicks[score.symbol] = (vwapTicks[score.symbol] || 0) + 1;
      } else {
        vwapTicks[score.symbol] = 0;
      }

      // Knob A (§4.2/§3.4) — update the per-symbol stagnation counter (D2 +
      // tick-age guard). pctThreshold/maxTickAgeMinutes come from the archetype's
      // forcedRotation knob (always present per §3.3 schema). stag.withinAge gates
      // the FIRE decision for THIS tick (threaded via cronMemory below).
      const frCfg = archetypeConfig.hftConfig?.forcedRotation;
      const stag = updateStagnationCounter({
        currentPrice,
        lastTickPrice: lastTickPrice[score.symbol] ?? null,
        lastTickTimestamp: lastTickTimestamp[score.symbol] ?? null,
        now: nowMs,
        pctThreshold: frCfg?.pctThreshold ?? 0.001,
        maxTickAgeMinutes: frCfg?.maxTickAgeMinutes ?? 20,
        stagnationTicks: stagnationTicks[score.symbol],
      });
      stagnationTicks[score.symbol] = stag.stagnationTicks;
      lastTickPrice[score.symbol] = stag.lastTickPrice;
      lastTickTimestamp[score.symbol] = stag.lastTickTimestamp;

      const intradaySnapshot = vwapInfo ? {
        vwap: vwapInfo.vwap,
        vwapDeviation: vwapInfo.vwapDeviation,
        sma20_5m: vwapInfo.sma20_5m || null,
      } : null;

      const riskResult = evaluateRisk(
        { symbol: score.symbol, tier: asset?.tier, baseATR: score.baseATR, dailyPct: (prices[score.symbol]?.changePercent || 0) / 100 },
        currentPrice, entryPrice, score.baseATR,
        intradaySnapshot,
        { ticksBelowVwap: vwapTicks[score.symbol], stagnationTicks: stagnationTicks[score.symbol], withinAge: stag.withinAge },
        presetConfig.risk,
        archetypeConfig
      );

      riskStatus[score.symbol] = riskResult;

      if (['EMERGENCY_SWAP', 'SWAP_OUT', 'TRAIL_STOP'].includes(riskResult.action)) {
        riskSwaps.push({ score, asset, riskResult });
      }
      if (riskResult.action === 'LOCK') {
        lockedPositions.add(score.symbol);
      }
    }

    momentumData.riskStatus = riskStatus;

    // ---- Execute risk-triggered swaps (no Haiku needed) ----
    for (const { score, asset, riskResult } of riskSwaps) {
      // Forge Enforcement Keystone V1.4 §4.4 (Knob C) — circuit breaker on FORCED
      // ROTATION only. Emergencies (bust/vwap/trail) bypass — never throttle a
      // protective exit. B1 within-tick binding: count LIVE from battle.trades
      // (re-read after each swap below), NOT once vs the frozen riskSwaps array, so
      // the Nth forced rotation in a burst sees the prior N-1 and is capped.
      const swCfg = archetypeConfig.hftConfig?.swapWindow;
      if (riskResult.reason === 'stagnation' && swCfg?.enabled) {
        const used = getRecentSwapCount(battle.trades || [], swCfg.windowMinutes, Date.now(), { countEmergencies: swCfg.countEmergencies });
        if (used >= swCfg.capPerWindow) {
          console.log(`${LOG_PREFIX} Knob C cap hit (stagnation) for ${battle.id}: ${used}/${swCfg.capPerWindow} in ${swCfg.windowMinutes}min`);
          statusFeedEntries.push({
            timestamp: new Date().toISOString(),
            message: `Circuit breaker: ${score.symbol} forced rotation skipped — ${used}/${swCfg.capPerWindow} swaps in ${swCfg.windowMinutes}min window.`,
            pvpContext: null,
            action: 'hold',
            regime: stockRegimes[score.symbol] || null,
            score: Math.round(currentScore * 100) / 100,
            citedRules: ['swap_window_cap'],
            triggeredBy: 'risk_stagnation',
            source: 'archetype',
            evalId: null,
            symbolOut: score.symbol,
            symbolIn: null,
          });
          continue; // skip THIS forced rotation; window stays full for the rest of the tick
        }
      }

      const allBench = flattenBenchServer(battle.portfolio?.bench);
      // Invariant 1 (§3.1) — branch the candidate source on REASON, never action.
      // SWAP_OUT now carries both vwap_failure (emergency, quality-bypass) and
      // stagnation (Knob A, quality-gated). Phase 4 (Knob B): the stagnation
      // candidate must clear the archetype hurdle floor + bench-positive rule via
      // clearsHurdleFloor; the wrapper returning null (no candidate clears) is the
      // rotation VETO (§4.2 / D3 detection-vs-execution split). Emergency reasons
      // bypass the floor (clearsHurdleFloor returns clears:true at step 1).
      // [VWAP Floor B2] Both branches route through pickSwapReplacementCandidate
      // so emergency exits inherit the held/self exclusion too (June 11:
      // LRCX→LRCX self-swap, PANW triple-slot). Computed fresh per pick — it
      // must see slots updated by earlier swaps this tick (refreshBattleFromDoc).
      const heldSymbols = new Set(flattenPortfolioServer(battle.portfolio).map(a => a.symbol).filter(Boolean));
      if (tournamentCtx) {
        // P2: cross-agent held set rides the picker's existing exclusion
        // parameter (Spec §1.2) — belt over the bench filter's suspenders.
        for (const heldSymbol of tournamentCtx.heldByOthers) heldSymbols.add(heldSymbol);
      }
      let replacement;
      if (riskResult.reason === 'stagnation') {
        const activeDailyPct = (prices[score.symbol]?.changePercent || 0) / 100;
        replacement = pickSwapReplacementCandidate({
          benchAssets: allBench,
          prices,
          outgoingIsCrypto: asset?.isCrypto === true,
          heldSymbols,
          clearsQuality: (candidate) => clearsHurdleFloor({
            active: { symbol: score.symbol, dailyPct: activeDailyPct },
            benchCandidate: { symbol: candidate.symbol, dailyPct: (prices[candidate.symbol]?.changePercent || 0) / 100 },
            reason: 'stagnation',
            archetypeConfig,
            // Narrow hurdle-only ATR freshening (Task A): fresh rankings-derived ATR
            // for the active position, frozen score.baseATR verbatim when unavailable.
            userATR: resolveHurdleAtr(score.symbol, freshHurdleAtrMap, score.baseATR).atr,
          }).clears,
        });
      } else {
        // Emergency reasons (bust/vwap/trail) bypass quality by design —
        // clearsHurdleFloor returns clears:true at step 1 for them, so
        // omitting clearsQuality (default pass-through) is equivalent and
        // keeps null-on-empty-pool the only skip source.
        replacement = pickSwapReplacementCandidate({
          benchAssets: allBench,
          prices,
          outgoingIsCrypto: asset?.isCrypto === true,
          heldSymbols,
        });
      }

      if (!replacement) {
        console.warn(`${LOG_PREFIX} No bench replacement for risk swap of ${score.symbol} — skipping`);
        if (tournamentCtx) {
          // P2 / Spec §1.2: the emptied-pool emergency skip is DESIGNED
          // behavior, surfaced as a feed event — never a silent log. The
          // agent stays in the position this tick.
          statusFeedEntries.push(buildPoolEmptyFeedEntry({
            message: `Wanted out of ${score.symbol} — no replacement available in the group's agent market.`,
            symbolOut: score.symbol,
            regime: stockRegimes[score.symbol] || null,
            score: Math.round(currentScore * 100) / 100,
            reason: riskResult.reason,
          }));
        } else {
          // [VWAP Floor B7] Regular battles get the same visibility — a
          // wanted-but-impossible exit is a feed beat, never just a log line.
          statusFeedEntries.push({
            timestamp: new Date().toISOString(),
            message: `Wanted out of ${score.symbol} — no eligible replacement (bench on cooldown or empty).`,
            pvpContext: null,
            action: 'pool_empty',
            regime: stockRegimes[score.symbol] || null,
            score: Math.round(currentScore * 100) / 100,
            citedRules: [riskResult.reason],
            triggeredBy: `risk_${riskResult.reason}`,
            source: 'risk_manager',
            evalId: null,
            symbolOut: score.symbol,
            symbolIn: null,
          });
        }
        continue;
      }

      const slot = findPortfolioSlot(battle.portfolio, score.symbol);
      if (!slot) {
        console.warn(`${LOG_PREFIX} Could not find portfolio slot for ${score.symbol}`);
        continue;
      }

      // [VWAP Floor B6] Cascade guard: after N vwap_failure fires today, each
      // further fire must qualify its replacement on fresh intraday data —
      // otherwise hold. Guard-active only: zero extra fetches on a normal day.
      if (riskResult.reason === 'vwap_failure' && vwapFireGuard.count >= VWAP_CASCADE_GUARD_N) {
        const qualified = await qualifyCascadeReplacement(replacement.symbol, {
          todayET,
          deadBandPct: presetConfig.risk.vwapDeadBandPct ?? 0.5,
          memo: cascadeQualifyMemo,
        });
        if (!qualified) {
          console.error(`${LOG_PREFIX} CASCADE GUARD ACTIVE for ${battle.id}: holding ${score.symbol} — ${replacement.symbol} unqualified after ${vwapFireGuard.count} vwap fires today`);
          statusFeedEntries.push({
            timestamp: new Date().toISOString(),
            message: `Cascade guard active — holding ${score.symbol} despite VWAP failure; no qualified replacement.`,
            pvpContext: null,
            action: 'cascade_guard_hold',
            regime: stockRegimes[score.symbol] || null,
            score: Math.round(currentScore * 100) / 100,
            citedRules: ['vwap_cascade_guard'],
            triggeredBy: 'risk_vwap_failure',
            source: 'risk_manager',
            evalId: null,
            symbolOut: score.symbol,
            symbolIn: replacement.symbol,
          });
          continue;
        }
      }

      // P2: set after a successful reserve so the catch below can run the
      // compensating release (two-phase protocol, Spec §1.2).
      let reservedSymbolIn = null;
      try {
        const riskTradeId = `trade_${String((battle.scoreState?.tradeCount || 0) + 1 + statusFeedEntries.filter(e => e.action !== 'hold').length).padStart(3, '0')}`;
        // Phase 6 (§4.6) — receipt source: stagnation is archetype-authored (Knob A),
        // everything else here is a protective risk-manager exit. EXACT same mapping
        // as the statusFeed push below.
        const swapSource = riskResult.reason === 'stagnation' ? 'archetype' : 'risk_manager';
        const evaluationMetadata = {
          id: riskTradeId,
          action: 'SWAP',
          trigger: riskResult.reason,
          rationale: `Risk manager: ${riskResult.detail}`,
          hypothesis: null,
          // Timestamp suffix ensures evalIds are unique across multiple
          // risk swaps on the same symbol+reason in a long battle (e.g.,
          // AAPL stops out twice over a 20-day battle). Without the
          // suffix, narration tradeContext.evaluationId would collide
          // and the Phase 4 Film Room lookup would conflate distinct
          // trades.
          evaluationId: `risk_${riskResult.reason}_${score.symbol}_${Date.now()}`,
          tradingDay: currentDay,
          entryRegime: stockRegimes[score.symbol] || null,
          entryMarketPosture: marketPosture,
          entryConviction: 0,
          entryPreset: battle.strategyPreset || 'balanced',
          entryMode: battle.executionMode || 'autopilot',
          exitReason: riskResult.reason,
          ...buildSwapReceiptSource({ source: swapSource, archetype: ctx.archetype }),
          // Release 2 PR-b — the §14 provenance sibling (one nested key;
          // the receipt's shape-locked return is untouched).
          ...buildSwapProvenance(dialClamp.provenance),
        };

        // Phase 4: snapshot risk-triggered swaps onto trades[i]. Replacement
        // bench symbols may not have full data — buildTechnicalSnapshot
        // null-fills missing leaves.
        const snapshot = {
          symbolOut: buildTechnicalSnapshot(score.symbol, {
            momentumData,
            technicalScoresMap,
            rankingsMap: momentumData.rankingsMap,
          }),
          symbolIn: buildTechnicalSnapshot(replacement.symbol, {
            momentumData,
            technicalScoresMap,
            rankingsMap: momentumData.rankingsMap,
          }),
        };

        // P2 phase 1: transactional reserve before the swap — fail means a
        // rival took the symbol since filtering (or holds it); skip with a
        // feed event and stay in the position this tick. No-op (always
        // reserved) for regular battles.
        const reservation = await reserveTournamentSymbolIn(db, tournamentCtx, battle, replacement.symbol);
        if (!reservation.reserved) {
          console.warn(`${LOG_PREFIX} Reserve failed for ${replacement.symbol} (${reservation.reason}) — risk swap of ${score.symbol} skipped`);
          statusFeedEntries.push(buildPoolEmptyFeedEntry({
            message: `Wanted out of ${score.symbol} — ${replacement.symbol} is already taken in the group's agent market.`,
            symbolOut: score.symbol,
            symbolIn: replacement.symbol,
            regime: stockRegimes[score.symbol] || null,
            score: Math.round(currentScore * 100) / 100,
            reason: riskResult.reason,
          }));
          continue;
        }
        if (tournamentCtx) reservedSymbolIn = replacement.symbol;

        // Corpus Capture Patch W2 — snapshot the outgoing position BEFORE
        // executeSwapServer closes it (entry timestamps live only on the
        // pre-swap position; mirrors the autopilot site's l1OutgoingPosition).
        // A single null assignment when the expansion is dark.
        const l1RiskOutgoingPosition = LEARNING_L1_CAPTURE_ENABLED && LEARNING_L1_CAPTURE_EXPANSION_ENABLED
          ? (battle.portfolio?.[slot.tier]?.[slot.slotIndex] || null)
          : null;

        const riskSwapResult = await executeSwapServer(
          db, battle.id, battle,
          slot.tier, slot.slotIndex,
          replacement, currentDay, prices, evaluationMetadata, snapshot
        );

        // P2 phase 2: the swap landed — finalize symbolIn, release symbolOut,
        // detect/emit double-down events (no-op for regular battles). The
        // ACTUAL outgoing symbol comes from closedTrade: executeSwapServer
        // swaps whatever occupies the slot at transaction time.
        await confirmTournamentSwap(db, tournamentCtx, battle, {
          symbolIn: riskSwapResult.closedTrade?.symbolIn || replacement.symbol,
          symbolOut: riskSwapResult.closedTrade?.symbolOut || score.symbol,
        }, statusFeedEntries);
        reservedSymbolIn = null;

        // Phase 2 Voice Layer Rework — queue narration for this risk swap.
        // The dispatch loop in the finally block at the bottom of this
        // function calls generateTradeNarration in parallel via
        // Promise.allSettled, so push order does not affect chat
        // chronology — Firestore arrayUnion timestamps drive ordering.
        pendingNarrations.push({
          closedTrade: riskSwapResult.closedTrade,
          evalId: null, // risk-triggered swaps don't carry the cron's eval umbrella id
        });

        statusFeedEntries.push({
          timestamp: new Date().toISOString(),
          message: `Risk: ${riskResult.detail}`,
          pvpContext: null,
          action: riskResult.action.toLowerCase(),
          regime: stockRegimes[score.symbol] || null,
          score: Math.round(currentScore * 100) / 100,
          citedRules: [riskResult.reason],
          triggeredBy: `risk_${riskResult.reason}`,
          source: riskResult.reason === 'stagnation' ? 'archetype' : 'risk_manager',
          evalId: null,
          symbolOut: score.symbol,
          symbolIn: replacement.symbol,
        });

        summary.swapped++;

        // [VWAP Floor B6] Count the fire live within the tick so the Nth fire
        // of a cascade sees the prior N-1.
        if (riskResult.reason === 'vwap_failure') vwapFireGuard.count++;

        // [VWAP Floor B1b] Reset the incoming symbol's in-memory counters so
        // the finalizeCronState flush later this tick doesn't persist a stale
        // streak onto the fresh position (the transaction's own reset would
        // otherwise be overwritten by these working copies).
        vwapTicks[replacement.symbol] = 0;
        stagnationTicks[replacement.symbol] = 0;

        // Corpus Capture Patch W2 — L1 capture, risk-manager class (incl.
        // stagnation forced rotation). Copies the autopilot site's posture
        // exactly: post-commit (swap already persisted above), triple-gated
        // (master && expansion && live_agent), awaited fail-closed write inside
        // a dedicated try/catch that can never break the executed trade. Runs
        // BEFORE refreshBattleFromDoc so battle.* still holds decision-time
        // state (tradeCount, trades.length, thresholdHistory).
        if (LEARNING_L1_CAPTURE_ENABLED && LEARNING_L1_CAPTURE_EXPANSION_ENABLED
            && classifyEvidence({ isCpu: battle.isCpu, agentId: battle.agentId }) === 'live_agent') {
          try {
            // /code-review fix (Fix-1 parity): a risk replacement can be a
            // hotBench swap-in — the in-memory bench is hotBench-AUGMENTED
            // (merge above, "Merge hotBench assets into battle bench") but
            // allTechSymbols was built from the pre-augmentation bench, so
            // the entry symbol may have no tech doc in the in-request maps.
            // Refetch exactly like the autopilot site; a failed/absent
            // refetch degrades to nulls, recorded honestly.
            const { snapshotIn: riskSnapshotIn, techDocIn: riskTechDocIn, entrySnapshotSource: riskEntrySnapshotSource } =
              await resolveEntrySnapshot({
                db,
                symbol: replacement.symbol,
                primarySnapshotIn: snapshot.symbolIn,
                primaryTechDoc: technicalScoresMap?.[replacement.symbol] ?? null,
                momentumData,
                technicalScoresMap,
              });
            // Entry regime: recompute from the refetched doc when the entry
            // was not in stockRegimes (hotBench swap-in) — the :Fix-1 pattern.
            const riskRegimeIn =
              stockRegimes[replacement.symbol] ??
              (riskTechDocIn ? classifyStockRegime(riskTechDocIn) : null);
            // /code-review fix: decode the rankings doc ONCE (data() re-decodes
            // the full doc per call) — template parity with siblingDataMode.
            const riskRankingsData =
              rankingsResult?.status === 'fulfilled' && rankingsResult.value?.exists
                ? rankingsResult.value.data()
                : null;
            // #8 (adversarial review): entryATR provenance via the SAME classifier
            // the autopilot site uses (never hand-rolled). Inputs are in scope —
            // `replacement` is the swap-in candidate handed to executeSwapServer.
            const riskEntryATR = riskSwapResult.incomingAsset?.baseATR ?? null;
            const riskEntryAtrSource = classifyEntryAtrSource({
              entryATR: riskEntryATR,
              scoredThreshold: battle.scoring?.thresholds?.[replacement.symbol]?.threshold,
              benchBaseATR: replacement?.baseATR,
              isCrypto: replacement?.isCrypto,
            });
            await captureSwapReceipt({
              enabled: true,
              db,
              agentId: battle.agentId,
              // W1 — archetype identity from the battle-creation-frozen
              // agentContext. Absent ⇒ null, never 'unknown'.
              archetype: ctx.archetype ?? null,
              isCpu: battle.isCpu,
              battleId: battle.id,
              battleDay: currentDay,
              timestamp: riskSwapResult.closedTrade?.swappedOutAt || null,
              // /code-review fix: receiptSeq is the CONVENTION itself —
              // scoreState.tradeCount+1 at decision time (battle.* is
              // pre-refresh here). Deliberately NOT parsed from riskTradeId:
              // its numeric core carries a same-tick non-hold feed-entry
              // offset that runs AHEAD of tradeCount, which would collide
              // with a later same-tick capture's seq in the
              // ${agentId}_seq${n} doc-id space (silent .set() overwrite)
              // and break the receiptSeq === tradeCountAtDecision+1
              // invariant the preflight gate enforces.
              receiptSeq: (battle.scoreState?.tradeCount || 0) + 1,
              symbolIn: riskSwapResult.closedTrade?.symbolIn ?? replacement.symbol,
              symbolOut: riskSwapResult.closedTrade?.symbolOut ?? score.symbol,
              source: swapSource,
              exitReason: riskResult.reason,
              haikuSwapReason: null, // not a Haiku path
              resolvedTier: slot.tier,
              resolvedSlotIndex: slot.slotIndex,
              entryMark: riskSwapResult.incomingAsset?.swapPrice ?? null,
              entryATR: riskEntryATR,
              entryAtrSource: riskEntryAtrSource, // #8 — provenance, not a second value
              outgoingEntryPrice: riskSwapResult.closedTrade?.entryPrice ?? null,
              outgoingBaseATR: score.baseATR ?? null,
              thresholdHistory: battle.thresholdHistory?.[score.symbol] ?? null,
              outgoingSwappedInAt: l1RiskOutgoingPosition?.swappedInAt ?? null,
              outgoingSwappedInDay: l1RiskOutgoingPosition?.swappedInDay ?? null,
              archetypeIntegrityMode: ARCHETYPE_INTEGRITY_MODE,
              snapshotIn: riskSnapshotIn,
              snapshotOut: snapshot.symbolOut,
              entrySnapshotSource: riskEntrySnapshotSource,
              regimeIn: riskRegimeIn,
              regimeOut: stockRegimes[score.symbol] ?? null,
              techDocIn: riskTechDocIn,
              techDocOut: technicalScoresMap?.[score.symbol] ?? null,
              dataMode: riskRankingsData?.mode ?? null,
              rankingsComputedAtMs: riskRankingsData?.computedAt?.toMillis?.() ?? null,
              tradeCountAtDecision: battle.scoreState?.tradeCount ?? null,
              tradesLenAtDecision: battle.trades?.length ?? null,
              capturedAt: new Date().toISOString(),
            });
          } catch (l1Err) {
            console.error(`${LOG_PREFIX} L1 capture threw (ignored, trade unaffected): ${l1Err?.message}`);
          }
        }

        // Re-read battle doc after swap for accurate state in subsequent
        // processing (re-applies the tournament candidate filter — the
        // persisted doc is unfiltered).
        await refreshBattleFromDoc(battleRef, battle, tournamentCtx);
      } catch (err) {
        console.error(`${LOG_PREFIX} Risk swap failed for ${score.symbol}:`, err.message);
        // [VWAP Floor B7] Feed-visible skip: a deterministically-throwing
        // candidate (e.g. a rejected duplicate) must not serially block
        // protective exits unobserved.
        statusFeedEntries.push({
          timestamp: new Date().toISOString(),
          message: `Risk exit of ${score.symbol} failed: ${String(err.message || err).slice(0, 140)}`,
          pvpContext: null,
          action: 'risk_swap_failed',
          regime: stockRegimes[score.symbol] || null,
          score: Math.round(currentScore * 100) / 100,
          citedRules: [riskResult.reason],
          triggeredBy: `risk_${riskResult.reason}`,
          source: 'risk_manager',
          evalId: null,
          symbolOut: score.symbol,
          symbolIn: replacement?.symbol || null,
        });
        // P2: compensating release (the reserve landed but the swap didn't).
        await releaseTournamentReservation(db, tournamentCtx, reservedSymbolIn);
      }
    }

    // ---- Proposal lifecycle check (after risk evaluation, before triggers/Haiku) ----
    const proposalHandled = await handlePendingProposal(db, battleRef, battle, prices, statusFeedEntries, summary, currentScore, tournamentCtx);
    if (proposalHandled === 'skip_haiku') {
      // Proposal is pending and not expired — write scores/risk but skip trigger gate + Haiku
      finalizeCronState(scoreUpdate, { vwapTicks, intradayMomentum: momentumData.vwap, stagnationTicks, lastTickPrice, lastTickTimestamp, vwapFireGuard });
      const existingFeed = battle.statusFeed || [];
      scoreUpdate.statusFeed = [...existingFeed, ...statusFeedEntries].slice(-STATUS_FEED_CAP);
      await battleRef.update(scoreUpdate);
      summary.evaluated++;
      summary.held++;
      return;
    }

    // ---- Gameplan meeting lifecycle check (after proposals, before triggers) ----
    const gameplanHandled = await handleGameplanMeeting(db, battleRef, battle, prices, statusFeedEntries, summary, pendingNarrations, tournamentCtx);
    if (gameplanHandled === 'skip_haiku') {
      finalizeCronState(scoreUpdate, { vwapTicks, intradayMomentum: momentumData.vwap, stagnationTicks, lastTickPrice, lastTickTimestamp, vwapFireGuard });
      const existingFeed = battle.statusFeed || [];
      scoreUpdate.statusFeed = [...existingFeed, ...statusFeedEntries].slice(-STATUS_FEED_CAP);
      await battleRef.update(scoreUpdate);
      summary.evaluated++;
      summary.held++;
      return;
    }

    // ---- Gameplan meeting trigger detection (only if no meeting pending) ----
    if (!battle.gameplanMeeting) {
      const gameplanTrigger = detectGameplanMeetingTrigger(battle, assetScores, prices, flatPortfolio, benchAssets, technicalScoresMap);
      if (gameplanTrigger) {
        const todayET = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' });
        statusFeedEntries.push({
          timestamp: new Date().toISOString(),
          // Bug C: only render the "Proposing rotation to X" clause when a bench
          // sector was actually ranked. An empty toSectors (no ranked bench
          // sector — e.g. Trigger 1 with all bench in the dragging sector or no
          // tech scores) previously rendered "Proposing rotation to ." with a
          // dangling empty symbol.
          message: gameplanTrigger.toSectors.length > 0
            ? `Gameplan Meeting: ${gameplanTrigger.diagnosis} Proposing rotation to ${gameplanTrigger.toSectors.join('/')}.`
            : `Gameplan Meeting: ${gameplanTrigger.diagnosis}`,
          action: 'gameplan_meeting', source: 'gameplan_meeting',
        });
        scoreUpdate.gameplanMeeting = gameplanTrigger;
        scoreUpdate['cronState.lastGameplanDate'] = todayET;
        // Write and skip Haiku — gameplan IS the evaluation
        finalizeCronState(scoreUpdate, { vwapTicks, intradayMomentum: momentumData.vwap, stagnationTicks, lastTickPrice, lastTickTimestamp, vwapFireGuard });
        const existingFeed = battle.statusFeed || [];
        scoreUpdate.statusFeed = [...existingFeed, ...statusFeedEntries].slice(-STATUS_FEED_CAP);
        await battleRef.update(scoreUpdate);
        summary.evaluated++;
        return;
      }
    }

    // ---- Fetch news for trigger gate (portfolio + bench + hotBench tickers) ----
    const allNewsTickers = [...new Set([...portfolioSymbols, ...benchSymbols, ...hotBenchSymbols])];
    const news = await fetchRecentNews(db, allNewsTickers);

    // ---- Catalyst override: add stocks from FantasyTimes stories not in eval set ----
    const evalTickerSet = new Set([...portfolioSymbols, ...benchSymbols, ...hotBenchSymbols]);
    const catalystTickers = [];
    for (const story of news) {
      for (const ticker of (story.tickers || [])) {
        if (!evalTickerSet.has(ticker) && !catalystTickers.includes(ticker)) {
          catalystTickers.push(ticker);
        }
      }
    }
    if (catalystTickers.length > 0) {
      const limitedCatalysts = catalystTickers.slice(0, 5);
      for (const ticker of limitedCatalysts) {
        const rankingData = stockRankingsArray.find(s => s.symbol === ticker);
        // P2: catalyst additions respect the group's agent market — a
        // rival-held name never enters this battle's bench.
        if (rankingData && !hotBenchAssetMap[ticker]
            && (!tournamentCtx || !tournamentCtx.heldByOthers.has(ticker))) {
          hotBenchAssetMap[ticker] = {
            symbol: ticker,
            name: rankingData.name || ticker,
            baseATR: rankingData.baseATR || (rankingData.atrPercentile ? rankingData.atrPercentile * 8 : 2.5),
            isCrypto: false,
            sector: rankingData.sectorName || 'Unknown',
          };
          // Add to bench for this eval cycle
          battle.portfolio.bench.stocks.push(hotBenchAssetMap[ticker]);
          // Fetch price if not already fetched
          if (!prices[ticker]) {
            try {
              const data = await getStockAnalysisData(ticker, { forceRefresh: true, fields: ['daily', 'price'] });
              if (data?.price) prices[ticker] = data.price;
            } catch (_e) { /* skip — catalyst is best-effort */ }
          }
        }
      }
      const addedCatalysts = limitedCatalysts.filter(t => hotBenchAssetMap[t]);
      if (addedCatalysts.length > 0) {
        statusFeedEntries.push({
          timestamp: new Date().toISOString(),
          message: `Catalyst detected: ${addedCatalysts.join(', ')} added to watchlist via FantasyTimes`,
          action: 'catalyst_override',
        });
      }
    }

    // ---- Evaluate triggers ----
    const seenStoryIds = battle.cronState?.seenStoryIds || [];
    const { shouldEvaluate, triggers, newStoryIds } = evaluateTriggers(battle, assetScores, prices, news, momentumData, seenStoryIds);

    // Persist any new story IDs to prevent re-triggering (cap at 50)
    if (newStoryIds?.length > 0) {
      const updatedSeenIds = [...seenStoryIds, ...newStoryIds].slice(-50);
      scoreUpdate['cronState.seenStoryIds'] = updatedSeenIds;
    }

    if (!shouldEvaluate) {
      // No triggers — update scores, VWAP ticks, and status feed, then move on
      // NOTE (naming): despite the name, this counter tracks ticks where the
      // trigger gate SKIPPED Haiku ("the gate passed on calling") — it is NOT
      // a count of successful gate→Haiku handoffs. Renaming to
      // triggerGateSkipCount is blocked: the field is part of the fenced
      // createAgentBattle doc shape (agentBattleService.js cronState init).
      scoreUpdate['cronState.triggerGatePassCount'] = (battle.cronState?.triggerGatePassCount || 0) + 1;
      finalizeCronState(scoreUpdate, { vwapTicks, intradayMomentum: momentumData.vwap, stagnationTicks, lastTickPrice, lastTickTimestamp, vwapFireGuard });
      if (statusFeedEntries.length > 0) {
        const existingFeed = battle.statusFeed || [];
        scoreUpdate.statusFeed = [...existingFeed, ...statusFeedEntries].slice(-STATUS_FEED_CAP);
      }
      await battleRef.update(scoreUpdate);
      summary.evaluated++;
      summary.held++;
      return;
    }

    // ---- Call Haiku ----
    summary.triggered++;
    const anthropic = getAnthropicClient();
    const agentName = ctx.agentName || 'Agent';
    const archetype = (ctx.archetype || 'unknown').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

    let haikuResult = null;
    let inputTokens = 0;
    let outputTokens = 0;
    // Transport-failure record for this tick (null on success). failureClass ∈
    // 'timeout' | 'truncated_response' | 'budget_skipped' | String(status|name).
    // Consumed below by the evaluation record, cronErrors, the eval_degraded
    // statusFeed entry, the shadow log, and the disclosure counter.
    let haikuFailure = null;
    let haikuAttempted = false;

    // Pre-call budget guard: a late-run battle must never start a call whose
    // hard-abort ceiling (22s) plus post-call work (parallel narration dispatch
    // ≤10s + the awaited finalUpdate — the same 12s allowance the anticipation
    // gate uses) could push the function past TIME_BUDGET_MS / the 60s kill
    // window and lose the finalUpdate. The handler-level deferral can't express
    // this: by now the battle's risk swaps and score writes have already
    // happened mid-function — we skip only the Haiku call and keep the normal
    // write path.
    const budget = shouldStartHaikuCall({ elapsedMs: Date.now() - cronStartTime, timeBudgetMs: TIME_BUDGET_MS });
    if (!budget.proceed) {
      haikuFailure = {
        failureClass: 'budget_skipped',
        message: `cron budget too low to start Haiku call (${Math.round(budget.remainingMs / 1000)}s remaining, ${Math.round(budget.requiredMs / 1000)}s required)`,
        timestamp: new Date().toISOString(),
      };
      console.warn(`${LOG_PREFIX} Haiku call skipped for battle ${battle.id}: ${haikuFailure.message}`);
    } else {
      haikuAttempted = true;
      // L1 transport: SDK-native per-request timeout (20s) replaces the old
      // bare Promise.race — the SDK aborts its underlying fetch at `timeout`
      // (verified v0.71.2 fetchWithTimeout), so the losing request is genuinely
      // cancelled, never orphaned server-side billing unrecorded tokens. The
      // AbortController is a defense-in-depth backstop 2s above it.
      const abortCtrl = new AbortController();
      const hardAbort = setTimeout(() => abortCtrl.abort(), HAIKU_CALL_CEILING_MS);
      try {
        const response = await anthropic.messages.create({
          model: EVAL_MODEL_ID,
          max_tokens: 1024,
          temperature: 0.4,
          // DR-13 (STOP-A ruling A1): the RAW archetype code-id rides as the
          // 4th arg — `archetype` above is the display-cased label (:1881)
          // and must never be the identity-block key.
          system: buildEvalSystemPrompt(agentName, archetype, battle.gameMode, ctx.archetype),
          messages: [
            { role: 'user', content: buildAgentIdentityBlock(battle) },
            { role: 'assistant', content: 'I understand my identity and strategic context. Show me the live battle state.' },
            {
              role: 'user',
              content: await buildLiveContextBlock(
                battle, prices, macroPrices, assetScores,
                triggers, news, battle.evaluations, momentumData, presetConfig
              ),
            },
          ],
          tools: [TRADE_DECISION_TOOL],
          tool_choice: { type: 'tool', name: 'submit_trade_decision' },
        }, { timeout: 20_000, signal: abortCtrl.signal });

        inputTokens = response.usage?.input_tokens || 0;
        outputTokens = response.usage?.output_tokens || 0;

        // Extract tool use block. tool_choice is forced, so a usable response
        // carries submit_trade_decision input with a string `decision`;
        // anything else (max_tokens truncation mid-JSON, absent block) is a
        // truncated_response — instrumented instead of silently null. Tokens
        // above stay recorded: a response did arrive.
        const toolUse = response.content?.find(c => c.type === 'tool_use');
        if (toolUse?.input && typeof toolUse.input.decision === 'string') {
          haikuResult = toolUse.input;
        } else {
          haikuFailure = {
            failureClass: 'truncated_response',
            message: `response received but tool input missing/unusable (stop_reason=${response.stop_reason || 'unknown'})`,
            timestamp: new Date().toISOString(),
          };
          console.warn(`${LOG_PREFIX} Haiku response unusable for battle ${battle.id}: ${haikuFailure.message}`);
        }
      } catch (err) {
        haikuFailure = {
          failureClass: classifyHaikuFailure(err),
          message: String(err?.message || '').slice(0, 200),
          timestamp: new Date().toISOString(),
        };
        console.error(`${LOG_PREFIX} Haiku call failed for battle ${battle.id} [${haikuFailure.failureClass}]:`, err.message);
        // Default to HOLD on timeout or error
      } finally {
        clearTimeout(hardAbort);
      }
    }

    // ---- Process decision ----
    const evalId = `eval_${String((battle.evaluations?.length || 0) + 1).padStart(3, '0')}`;

    // Phase 3 Voice Layer Rework — queue anticipation candidates Haiku
    // flagged on this tick for narration. Fires on HOLD, SWAP, and
    // PROPOSAL paths alike — anticipation is additive metadata
    // independent of the trade decision. Dispatched (with budget gate)
    // in the finally block after pendingNarrations have settled.
    // evalId is captured here (right after Haiku returned) so each
    // anticipation message can be cross-referenced back to the
    // evaluation that flagged it.
    if (Array.isArray(haikuResult?.anticipationCandidates)) {
      for (const candidate of haikuResult.anticipationCandidates) {
        if (candidate && typeof candidate === 'object' && candidate.symbol) {
          pendingAnticipations.push({ candidate, evalId });
        }
      }
    }
    const now = new Date().toISOString();
    const phase = computeBattlePhase(battle);

    let decision = haikuResult?.decision || 'HOLD';
    let downgraded = false;
    let validationErrors = [];
    let guardrailOverrides = [];
    let guardrailStatusMessage = null;
    let guardrailSourceNote = null;

    // ---- Phase 4B: Hybrid Execution Guardrails ----
    // Deterministic override layer. Reads the frozen snapshot of deployed
    // strategy guardrails from agentContext and may rewrite Haiku's decision
    // when hard quantitative thresholds are breached. No-op if no strategy
    // is deployed (empty or undefined array).
    // Release 2 PR-e (sector-SLOT rule) — inject the Diversifier slot cap BEFORE the
    // length>0 skip, so a tournament Diversifier with zero equipped guardrails still
    // gets the synthetic cap (the C2 trap: applyGuardrails is skipped entirely on an
    // empty array). Injection fires ONLY under SECTOR_CAP_MODE='enforce' (decoupled
    // from ARCHETYPE_INTEGRITY_MODE, founder ruling 2026-07-10) — OFF/OBSERVE /
    // non-tournament / non-Diversifier returns the array untouched → byte-identical.
    const deployedGuardrails = injectDiversifierSectorCap(
      battle.agentContext?.deployedGuardrails || [],
      battle,
    );
    // OBSERVE half: the effective cap this battle WOULD run under enforce (or
    // null off-scope/off-mode). Non-null opens the gate below even on an empty
    // array — the C2 trap applies to measurement too: a zero-guardrail
    // Diversifier is the common case, and skipping it would systematically
    // undercount the would-block volume the flag walk reads.
    const sectorSlotObserveCap = resolveSectorSlotObserveCap(
      battle.agentContext?.deployedGuardrails || [],
      battle,
    );
    if (deployedGuardrails.length > 0 || sectorSlotObserveCap !== null) {
      try {
        const result = applyGuardrails({
          haikuResult,
          guardrails: deployedGuardrails,
          battle,
          prices,
          lockedPositions,
          stockRegimes,
          sectorSlotObserveCap,
        });
        guardrailOverrides = result.overrides || [];
        guardrailStatusMessage = result.statusMessage;
        guardrailSourceNote = result.sourceNote;

        const originalDecision = haikuResult?.decision || 'HOLD';
        if (result.decision !== originalDecision ||
            result.symbolOut !== (haikuResult?.symbolOut || null) ||
            result.symbolIn !== (haikuResult?.symbolIn || null)) {
          // Materialize the override into haikuResult so downstream
          // validation/execution treats the forced swap as a normal SWAP.
          if (result.decision === 'SWAP') {
            const overrideNote = result.statusMessage || 'hard threshold breach';
            haikuResult = {
              ...(haikuResult || {}),
              decision: 'SWAP',
              symbolOut: result.symbolOut,
              symbolIn: result.symbolIn,
              rationale: `Guardrail override (${result.sourceNote || 'hard'}): ${overrideNote}`,
              hypothesis: `Hypothesis: deterministic guardrail enforcement — ${overrideNote}`,
              conviction: Math.max(haikuResult?.conviction || 0, 70),
            };
            decision = 'SWAP';
            console.warn(`${LOG_PREFIX} Guardrail forced SWAP ${result.symbolOut}→${result.symbolIn}`);
          } else if (result.decision === 'HOLD' && originalDecision === 'SWAP') {
            validationErrors.push(result.statusMessage || 'Guardrail blocked swap');
            decision = 'HOLD';
            downgraded = true;
            console.warn(`${LOG_PREFIX} Guardrail blocked Haiku SWAP: ${result.statusMessage}`);
          }
        }
      } catch (err) {
        // Never crash a battle on guardrail failure — log and proceed with
        // Haiku's original decision.
        console.error(`${LOG_PREFIX} Guardrail evaluation failed (non-fatal):`, err?.message);
      }
    }

    // Block Haiku from swapping out LOCKED positions
    if (decision === 'SWAP' && haikuResult && lockedPositions.has(haikuResult.symbolOut)) {
      validationErrors.push(`${haikuResult.symbolOut} is LOCKED (near bonus threshold) — swap blocked`);
      decision = 'HOLD';
      downgraded = true;
      console.warn(`${LOG_PREFIX} SWAP blocked by risk LOCK for ${haikuResult.symbolOut}`);
    }

    // Block Haiku from swapping IN distressed stocks
    if (decision === 'SWAP' && haikuResult && stockRegimes[haikuResult.symbolIn] === 'distressed') {
      validationErrors.push(`${haikuResult.symbolIn} is DISTRESSED regime — swap blocked`);
      decision = 'HOLD';
      downgraded = true;
      console.warn(`${LOG_PREFIX} SWAP blocked: ${haikuResult.symbolIn} is distressed`);
    }

    let pendingProposalUpdate = null;

    if (decision === 'SWAP' && haikuResult) {
      const validation = validateTradeDecision(haikuResult, battle);
      if (!validation.valid) {
        validationErrors = [...validationErrors, ...validation.errors];
        decision = 'HOLD';
        downgraded = true;
        console.warn(`${LOG_PREFIX} SWAP downgraded to HOLD for battle ${battle.id}:`, validation.errors);
      } else {
        let mode = battle.executionMode || 'autopilot';

        // LAUNCH GUARD (2026-05-19): Auto-pilot only. See AUTHORITY_MODE_POST_LAUNCH_BACKLOG.md.
        // This branch should never execute in normal operation. If it does, something
        // has set a battle's mode to copilot or manual outside the sanctioned flow.
        if (mode !== 'autopilot') {
          console.warn(`${LOG_PREFIX} LAUNCH GUARD: battle ${battle.id} has unexpected mode='${mode}'. Forcing autopilot.`);
          mode = 'autopilot';
        }

        // Forge Enforcement Keystone V1.4 §4.3 (Knob B) — hurdle floor on the
        // Haiku-proposed swap, applied after validation, before execution. A2
        // (§3.1): a guardrail-forced exit carries a guardrail_* reason via
        // guardrailSourceNote and BYPASSES the floor (clearsHurdleFloor step 1); a
        // discretionary Haiku swap is gated by byReason.haiku_decision. Compute the
        // reason ONCE and reuse it for the gate AND the exitReason stamp below.
        const haikuSwapReason =
          (guardrailSourceNote === 'guardrail_stopLoss' || guardrailSourceNote === 'guardrail_trailingStop')
            ? guardrailSourceNote
            : 'haiku_decision';
        const activeBaseATR = assetScores.find(s => s.symbol === haikuResult.symbolOut)?.baseATR ?? 2.5;
        const hurdle = clearsHurdleFloor({
          active: { symbol: haikuResult.symbolOut, dailyPct: (prices[haikuResult.symbolOut]?.changePercent || 0) / 100 },
          benchCandidate: { symbol: haikuResult.symbolIn, dailyPct: (prices[haikuResult.symbolIn]?.changePercent || 0) / 100 },
          reason: haikuSwapReason,
          archetypeConfig,
          // Narrow hurdle-only ATR freshening (Task A): fresh rankings-derived ATR
          // for the active position, frozen activeBaseATR verbatim when unavailable.
          userATR: resolveHurdleAtr(haikuResult.symbolOut, freshHurdleAtrMap, activeBaseATR).atr,
        });

        // Forge Enforcement Keystone V1.4 §4.4 (Knob C) — circuit breaker on the
        // Haiku path. Trap 2 / A2: a guardrail-forced exit (haikuSwapReason ∈
        // EMERGENCY_BYPASS_REASONS) MUST bypass the cap — never throttle a
        // protective exit because the window filled. battle.trades here already
        // includes this tick's risk-loop forced rotations (re-read after each), so
        // both hooks share one consistent window count.
        const swCfg = archetypeConfig.hftConfig?.swapWindow;
        const capBlocked = swCfg?.enabled
          && !EMERGENCY_BYPASS_REASONS.has(haikuSwapReason)
          && getRecentSwapCount(battle.trades || [], swCfg.windowMinutes, Date.now(), { countEmergencies: swCfg.countEmergencies }) >= swCfg.capPerWindow;

        if (!hurdle.clears) {
          // Mirror the LOCKED / distressed downgrade pattern above.
          validationErrors.push(`${haikuResult.symbolIn} below ${haikuSwapReason} hurdle floor (${hurdle.blockReason}) — swap blocked`);
          decision = 'HOLD';
          downgraded = true;
          console.warn(`${LOG_PREFIX} SWAP blocked by hurdle floor: ${haikuResult.symbolOut}→${haikuResult.symbolIn} (${hurdle.blockReason})`);
        } else if (capBlocked) {
          // Circuit breaker: discretionary swap throttled. Mirror the hurdle downgrade.
          validationErrors.push(`Swap cap reached (${swCfg.capPerWindow}/${swCfg.windowMinutes}min) — swap blocked`);
          decision = 'HOLD';
          downgraded = true;
          console.warn(`${LOG_PREFIX} SWAP blocked by Knob C cap for ${battle.id}: ${haikuResult.symbolOut}→${haikuResult.symbolIn}`);
        } else if (mode === 'autopilot') {
          // Autopilot: execute immediately (original behavior)
          // P2: set after a successful reserve; the catch runs the
          // compensating release (benchAsset is out of scope there).
          let reservedSymbolIn = null;
          try {
            const benchAsset = findBenchAsset(battle.portfolio?.bench, haikuResult.symbolIn);
            // Phase 6 (§4.6) — receipt source: a guardrail-forced swap is
            // source:'guardrail' (its true origin); a discretionary Haiku swap is
            // source:'haiku'. haikuSwapReason's only non-'haiku_decision' values are
            // the two guardrail_* reasons (computed above).
            const swapSource = haikuSwapReason === 'haiku_decision' ? 'haiku' : 'guardrail';
            const evaluationMetadata = {
              id: `trade_${String((battle.scoreState?.tradeCount || 0) + 1).padStart(3, '0')}`,
              action: 'SWAP',
              trigger: triggers.map(t => t.type).join(', '),
              rationale: haikuResult.rationale || null,
              hypothesis: haikuResult.hypothesis || null,
              evaluationId: evalId,
              tradingDay: currentDay,
              entryRegime: stockRegimes[haikuResult.symbolOut] || null,
              entryMarketPosture: marketPosture,
              entryConviction: haikuResult.conviction || 0,
              entryPreset: battle.strategyPreset || 'balanced',
              entryMode: battle.executionMode || 'autopilot',
              // §3.1 A2: guardrail-forced swaps stamp their true guardrail_* reason
              // (computed above), so trades[].exitReason carries the protective
              // origin for Phase 5 Knob C / Phase 7. Discretionary → 'haiku_decision'.
              exitReason: haikuSwapReason,
              ...buildSwapReceiptSource({ source: swapSource, archetype: ctx.archetype }),
              // Release 2 PR-b — the §14 provenance sibling.
              ...buildSwapProvenance(dialClamp.provenance),
              // Phase 8: structured reasoning carried onto battle.trades[] via
              // the ...evaluationMetadata spread in executeSwapServer.
              trade_reasoning: haikuResult?.trade_reasoning || null,
            };
            // Phase 4: snapshot autopilot decisions onto trades[i] for parity
            // with co-pilot/manual proposalHistory[i].snapshot.
            const snapshot = {
              symbolOut: buildTechnicalSnapshot(haikuResult.symbolOut, {
                momentumData,
                technicalScoresMap,
                rankingsMap: momentumData.rankingsMap,
              }),
              symbolIn: buildTechnicalSnapshot(haikuResult.symbolIn, {
                momentumData,
                technicalScoresMap,
                rankingsMap: momentumData.rankingsMap,
              }),
            };
            // Agent Learning System L1 — raw capture (DARK). Snapshot the
            // outgoing position BEFORE executeSwapServer closes it (its entry
            // timestamps live only on the pre-swap position). Nothing runs when
            // the flag is off — a single null assignment, zero decision-path cost.
            const l1OutgoingPosition = LEARNING_L1_CAPTURE_ENABLED
              ? (battle.portfolio?.[validation.resolvedTier]?.[validation.resolvedSlotIndex] || null)
              : null;
            // P2 phase 1: reserve symbolIn before executing. A reserve
            // loss downgrades to HOLD exactly like a failed swap. No-op
            // (always reserved) for regular battles.
            const reservation = await reserveTournamentSymbolIn(db, tournamentCtx, battle, haikuResult.symbolIn);
            if (!reservation.reserved) {
              throw new Error(`${haikuResult.symbolIn} unavailable in the group's agent market (${reservation.reason})`);
            }
            if (tournamentCtx) reservedSymbolIn = haikuResult.symbolIn;

            const swapResult = await executeSwapServer(
              db, battle.id, battle,
              validation.resolvedTier, validation.resolvedSlotIndex,
              benchAsset, currentDay, prices, evaluationMetadata, snapshot
            );

            // P2 phase 2: confirm + double-down detection (no-op when
            // tournamentCtx is null). Actual symbols from closedTrade.
            await confirmTournamentSwap(db, tournamentCtx, battle, {
              symbolIn: swapResult.closedTrade?.symbolIn || haikuResult.symbolIn,
              symbolOut: swapResult.closedTrade?.symbolOut || haikuResult.symbolOut,
            }, statusFeedEntries);
            reservedSymbolIn = null;

            // Phase 2 Voice Layer Rework — queue narration for this autopilot swap.
            // See note in risk-triggered branch above.
            pendingNarrations.push({
              closedTrade: swapResult.closedTrade,
              evalId,
            });

            summary.swapped++;

            // Agent Learning System L1 — raw capture (DARK, T13 server-authoritative
            // evidence). Emit a RAW receipt for this executed autopilot swap: raw
            // fields only, no derived metric, no classification, no scoring. No-op
            // with zero Firestore ops when the flag is off; when on it is an awaited,
            // fail-closed, Admin-SDK write that can never break the (already-executed)
            // trade — the inner try/catch isolates it completely.
            // Fix 1 (L1 Capture — exclude non-evidence agents): only a real
            // live agent's decision is evidence. CPU tournament battles already
            // early-return above (~L731, P4 contract #5) and never reach here;
            // training-clone battles (not isCpu) DO reach this swap path, so this
            // evidence gate is what keeps the corpus free of non-live_agent
            // receipts — and skips the post-trade tech-doc refetch for a seat with
            // no real entry decision. isCpu is the authoritative CPU contract; the
            // reserved agentId prefixes are the secondary/training signal. The `&&`
            // short-circuits when the flag is off, so the no-op path is unchanged.
            if (LEARNING_L1_CAPTURE_ENABLED && classifyEvidence({ isCpu: battle.isCpu, agentId: battle.agentId }) === 'live_agent') {
              try {
                // Fix 1 (DARK, post-trade, capture-only): the entry symbol's tech
                // doc is null when it is a hotBench swap-in — allTechSymbols does
                // not tech-fetch hotBench (a decision-path constraint we do NOT
                // touch). The doc EXISTS (same atomic batch as the rankings doc),
                // so refetch it here and rebuild snapshotIn. A failed/absent
                // refetch degrades to the existing null behavior, recorded honestly.
                const { snapshotIn: snapshotInForCapture, techDocIn: techDocInForCapture, entrySnapshotSource } =
                  await resolveEntrySnapshot({
                    db,
                    symbol: haikuResult.symbolIn,
                    primarySnapshotIn: snapshot.symbolIn,
                    primaryTechDoc: technicalScoresMap?.[haikuResult.symbolIn] ?? null,
                    momentumData,
                    technicalScoresMap,
                  });
                // Fix 1b: dataMode is not on the per-stock tech doc; source it from
                // the sibling rankings doc's `mode` (written in the same cron run /
                // atomic batch). Null stays null — never fabricated.
                const siblingDataMode =
                  rankingsResult?.status === 'fulfilled' && rankingsResult.value?.exists
                    ? (rankingsResult.value.data().mode ?? null)
                    : null;
                // Fix 2a: accept entryATR as-is (the value the live guardrails run
                // on); record ONLY which executeSwapServer branch produced it,
                // derived from capture-scope data (never re-enters the fence).
                const entryATRForCapture = swapResult.incomingAsset?.baseATR ?? null;
                const entryAtrSource = classifyEntryAtrSource({
                  entryATR: entryATRForCapture,
                  scoredThreshold: battle.scoring?.thresholds?.[haikuResult.symbolIn]?.threshold,
                  benchBaseATR: benchAsset?.baseATR,
                  isCrypto: benchAsset?.isCrypto,
                });
                // The entry's regime is null when it's a hotBench swap-in (stockRegimes
                // is only built for allTechSymbols). When Fix 1 refetched the tech doc,
                // recompute the entry regime from it (same classifyStockRegime path) so
                // the entry-side predicate inputs are consistent; otherwise leave null.
                const regimeInForCapture =
                  stockRegimes[haikuResult.symbolIn] ??
                  (techDocInForCapture ? classifyStockRegime(techDocInForCapture) : null);
                await captureSwapReceipt({
                  enabled: true,
                  db,
                  agentId: battle.agentId,
                  // W1 (Corpus Capture Patch) — archetype identity from the
                  // battle-creation-frozen agentContext (never the mutable
                  // agent scalar). Absent ⇒ null, never a synthesized
                  // 'unknown' (founder ruling July 21 2026).
                  archetype: ctx.archetype ?? null,
                  // Fix 1/2 — evidence-provenance inputs. captureSwapReceipt
                  // re-derives evidenceClass from these and applies the same guard
                  // defensively before buildRawReceipt, then stamps it on the receipt.
                  isCpu: battle.isCpu,
                  battleId: battle.id,
                  battleDay: currentDay,
                  timestamp: swapResult.closedTrade?.swappedOutAt || null,
                  // receiptSeq = the numeric core of the trade id (scoreState.tradeCount+1).
                  receiptSeq: Number(String(evaluationMetadata.id).replace('trade_', '')) || null,
                  // Nullish-coalesce (a symbol only ever falls back on null/undefined).
                  // This is a capture site, NOT one of the five tournament confirm
                  // sites whose closedTrade-sourcing invariant is asserted separately.
                  symbolIn: swapResult.closedTrade?.symbolIn ?? haikuResult.symbolIn,
                  symbolOut: swapResult.closedTrade?.symbolOut ?? haikuResult.symbolOut,
                  source: swapSource,
                  exitReason: haikuSwapReason,
                  haikuSwapReason,
                  resolvedTier: validation.resolvedTier,
                  resolvedSlotIndex: validation.resolvedSlotIndex,
                  // entry state of the NEW position (from executeSwapServer's incomingAsset).
                  entryMark: swapResult.incomingAsset?.swapPrice ?? null,
                  entryATR: entryATRForCapture,
                  entryAtrSource, // Fix 2a — provenance only; entryATR unchanged.
                  // guardrail-replay state of the OUTGOING position (raw).
                  outgoingEntryPrice: swapResult.closedTrade?.entryPrice ?? null,
                  outgoingBaseATR: activeBaseATR ?? null,
                  thresholdHistory: battle.thresholdHistory?.[haikuResult.symbolOut] ?? null,
                  outgoingSwappedInAt: l1OutgoingPosition?.swappedInAt ?? null,
                  outgoingSwappedInDay: l1OutgoingPosition?.swappedInDay ?? null,
                  // version stamps (only archetypeIntegrityMode exists in L1).
                  archetypeIntegrityMode: ARCHETYPE_INTEGRITY_MODE,
                  // predicate snapshot inputs. snapshotIn/techDocIn are the refetched
                  // values (Fix 1); entrySnapshotSource records how they resolved.
                  snapshotIn: snapshotInForCapture,
                  snapshotOut: snapshot.symbolOut,
                  entrySnapshotSource,
                  regimeIn: regimeInForCapture,
                  regimeOut: stockRegimes[haikuResult.symbolOut] ?? null,
                  techDocIn: techDocInForCapture,
                  techDocOut: technicalScoresMap?.[haikuResult.symbolOut] ?? null,
                  dataMode: siblingDataMode, // Fix 1b — sibling-rankings-doc source.
                  // Phase A.5 — predicate provenance for staleness + the level fields.
                  // rankingsComputedMs (line ~796) is block-scoped and out of reach here;
                  // recompute from rankingsResult (function-scoped) with an existence guard.
                  rankingsComputedAtMs:
                    rankingsResult?.status === 'fulfilled' && rankingsResult.value?.exists
                      ? (rankingsResult.value.data().computedAt?.toMillis?.() ?? null)
                      : null,
                  // Phase A.5 — M8 / D3 truncation provenance (trades[] cap = 50).
                  tradeCountAtDecision: battle.scoreState?.tradeCount ?? null,
                  tradesLenAtDecision: battle.trades?.length ?? null,
                  capturedAt: new Date().toISOString(),
                });
              } catch (l1Err) {
                console.error(`${LOG_PREFIX} L1 capture threw (ignored, trade unaffected): ${l1Err?.message}`);
              }
            }

            // [VWAP Floor B1b] Same in-memory counter reset as the risk-swap
            // branch — keep the incoming symbol's streak from being persisted
            // by this tick's finalizeCronState flush.
            const haikuInSymbol = swapResult.closedTrade?.symbolIn || haikuResult.symbolIn;
            vwapTicks[haikuInSymbol] = 0;
            stagnationTicks[haikuInSymbol] = 0;
          } catch (swapErr) {
            console.error(`${LOG_PREFIX} Swap execution failed for battle ${battle.id}:`, swapErr.message);
            validationErrors.push(`Swap execution failed: ${swapErr.message}`);
            decision = 'HOLD';
            downgraded = true;
            // P2: compensating release (no-op unless the reserve had landed).
            await releaseTournamentReservation(db, tournamentCtx, reservedSymbolIn);
          }
        } else {
          // PRESERVED FOR POST-LAUNCH (2026-05-19): copilot/manual proposal-creation path.
          // See AUTHORITY_MODE_POST_LAUNCH_BACKLOG.md. Unreachable under the launch guard
          // above; kept for revival.
          //
          // Co-Pilot or Manual: write proposal instead of executing
          const ttlMinutes = mode === 'copilot' ? 10 : 15;
          const proposalId = `prop_${String((battle.proposalHistory || []).length + 1).padStart(3, '0')}`;

          // Phase 4: Capture lossless raw-fields technical snapshot at proposal-
          // creation time. Rides on proposalHistory[i].snapshot through the
          // existing spread-based history-write paths and is forwarded onto
          // trades[i].snapshot via executeSwapServer when the proposal is later
          // approved or auto-executed at expiry.
          const proposalSnapshot = {
            symbolOut: buildTechnicalSnapshot(haikuResult.symbolOut, {
              momentumData,
              technicalScoresMap,
              rankingsMap: momentumData.rankingsMap,
            }),
            symbolIn: buildTechnicalSnapshot(haikuResult.symbolIn, {
              momentumData,
              technicalScoresMap,
              rankingsMap: momentumData.rankingsMap,
            }),
          };

          pendingProposalUpdate = {
            proposalId,
            evalId,
            symbolOut: haikuResult.symbolOut,
            symbolIn: haikuResult.symbolIn,
            tier: validation.resolvedTier,
            slotIndex: validation.resolvedSlotIndex,
            conviction: haikuResult.conviction || 0,
            rationale: haikuResult.rationale || null,
            hypothesis: haikuResult.hypothesis || null,
            riskAssessment: haikuResult.riskAssessment || 'low',
            triggers: triggers.map(t => t.type),
            regime: stockRegimes[haikuResult.symbolOut] || null,
            marketPosture,
            scoreAtProposal: Math.round(currentScore * 100) / 100,
            createdAt: now,
            expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString(),
            mode,
            resolvedAt: null,
            resolution: null,
            resolvedBy: null,
            benchAsset: findBenchAsset(battle.portfolio?.bench, haikuResult.symbolIn),
            snapshot: proposalSnapshot,
            evaluationMetadata: {
              id: `trade_${String((battle.scoreState?.tradeCount || 0) + 1).padStart(3, '0')}`,
              action: 'SWAP',
              trigger: triggers.map(t => t.type).join(', '),
              rationale: haikuResult.rationale || null,
              hypothesis: haikuResult.hypothesis || null,
              evaluationId: evalId,
              tradingDay: currentDay,
              entryRegime: stockRegimes[haikuResult.symbolOut] || null,
              entryMarketPosture: marketPosture,
              entryConviction: haikuResult.conviction || 0,
              entryPreset: battle.strategyPreset || 'balanced',
              entryMode: mode,
              exitReason: 'haiku_decision',
              // Phase 6 (§4.6) — receipt source. Dormant under the autopilot launch
              // guard; stamped for forward-compat (mirrors how Phase 4 stamped
              // exitReason here). Rides onto trades[] when the proposal is later
              // resolved (executeSwapServer is passed proposal.evaluationMetadata).
              ...buildSwapReceiptSource({ source: 'haiku', archetype: ctx.archetype }),
              // Release 2 PR-b — the §14 provenance sibling.
              ...buildSwapProvenance(dialClamp.provenance),
              // Phase 8: structured reasoning carried onto battle.trades[] via
              // the ...evaluationMetadata spread in executeSwapServer (used
              // when this proposal is later resolved into an executed swap).
              trade_reasoning: haikuResult?.trade_reasoning || null,
            },
          };

          decision = 'PROPOSAL';
          console.log(`${LOG_PREFIX} ${mode} mode: Created proposal ${proposalId} for ${haikuResult.symbolOut}→${haikuResult.symbolIn} (${ttlMinutes}min TTL)`);
        }
      }
    }

    if (decision === 'HOLD') {
      summary.held++;
    } else if (decision === 'PROPOSAL') {
      summary.held++; // Not swapped yet — count as held
    }

    // ---- Build status feed entry from Haiku result ----
    if (decision === 'PROPOSAL' && pendingProposalUpdate) {
      const mode = battle.executionMode || 'autopilot';
      const ttl = mode === 'copilot' ? '10' : '15';
      statusFeedEntries.push({
        timestamp: now,
        message: haikuResult?.status_feed_update || `Proposing: Swap ${haikuResult.symbolOut} → ${haikuResult.symbolIn}. Awaiting Coach approval (${ttl}min).`,
        pvpContext: haikuResult?.pvp_context || null,
        action: 'proposal',
        regime: stockRegimes[haikuResult?.symbolOut] || null,
        score: Math.round(currentScore * 100) / 100,
        citedRules: haikuResult?.cited_rules || [],
        citedForgeRules: haikuResult?.cited_forge_rules || [],
        triggeredBy: triggers.map(t => t.type).join(', '),
        source: 'haiku',
        evalId,
        symbolOut: haikuResult?.symbolOut,
        symbolIn: haikuResult?.symbolIn,
        // Phase 7: link to the originating directive (if any) for the UI connector.
        directiveThreadId: haikuResult?.directiveThreadId || null,
        // Phase 8: structured reasoning for the Game Tape / Film Room UI.
        trade_reasoning: haikuResult?.trade_reasoning || null,
      });
    } else if (haikuResult?.status_feed_update || decision === 'SWAP') {
      statusFeedEntries.push({
        timestamp: now,
        message: haikuResult?.status_feed_update || null,
        pvpContext: haikuResult?.pvp_context || null,
        action: decision === 'SWAP' ? 'swap' : 'hold',
        regime: stockRegimes[haikuResult?.symbolOut] || null,
        score: Math.round(currentScore * 100) / 100,
        citedRules: haikuResult?.cited_rules || [],
        citedForgeRules: haikuResult?.cited_forge_rules || [],
        triggeredBy: triggers.map(t => t.type).join(', '),
        source: 'haiku',
        evalId,
        symbolOut: decision === 'SWAP' ? haikuResult?.symbolOut : null,
        symbolIn: decision === 'SWAP' ? haikuResult?.symbolIn : null,
        // Phase 7: link to the originating directive (if any) for the UI connector.
        directiveThreadId: haikuResult?.directiveThreadId || null,
        // Phase 8: structured reasoning for the Game Tape / Film Room UI.
        trade_reasoning: haikuResult?.trade_reasoning || null,
      });
    }

    // Phase 4B: surface guardrail override as a distinct statusFeed entry.
    if (guardrailStatusMessage) {
      const forcedOverride = guardrailOverrides.find(
        o => o.action === 'forced_exit' || o.action === 'blocked_swap'
      );
      statusFeedEntries.push({
        timestamp: now,
        message: guardrailStatusMessage,
        action: forcedOverride?.action === 'forced_exit' ? 'guardrail_forced_swap' : 'guardrail_block',
        triggeredBy: guardrailSourceNote || 'guardrail',
        source: 'guardrail',
        evalId,
        symbolOut: forcedOverride?.symbol || null,
        symbolIn: forcedOverride?.replacementSymbol || null,
      });
    }

    // ---- Build evaluation record ----
    const isSwapOrProposal = decision === 'SWAP' || decision === 'PROPOSAL';
    const evaluation = {
      evalId,
      timestamp: now,
      day: currentDay,
      battlePhase: phase,
      decision,
      symbolOut: isSwapOrProposal ? haikuResult?.symbolOut : null,
      symbolIn: isSwapOrProposal ? haikuResult?.symbolIn : null,
      tier: isSwapOrProposal ? validateTradeDecision(haikuResult, battle).resolvedTier : null,
      rationale: haikuResult?.rationale || (haikuResult ? null
        : haikuFailure?.failureClass === 'budget_skipped'
          ? 'Evaluation skipped — cron budget too low to start Haiku call. Defaulting to HOLD.'
          : 'Haiku call failed — defaulting to HOLD'),
      hypothesis: haikuResult?.hypothesis || null,
      conviction: haikuResult?.conviction || 0,
      riskAssessment: haikuResult?.riskAssessment || 'low',
      ignoredDirectiveIds: haikuResult?.ignoredDirectiveIds || [],
      // Phase 7: link this evaluation to the originating directive (if any).
      directiveThreadId: haikuResult?.directiveThreadId || null,
      // Phase 8: structured reasoning for historical record + analytics.
      trade_reasoning: haikuResult?.trade_reasoning || null,
      citedForgeRules: haikuResult?.cited_forge_rules || [],
      overriddenForgeRules: haikuResult?.overridden_forge_rules || [],
      triggers: triggers.map(t => t.type),
      scores: {
        active: Math.round(activeScore * 100) / 100,
        banked: Math.round(bankedScore * 100) / 100,
        total: Math.round(currentScore * 100) / 100,
      },
      validationErrors,
      downgraded,
      marketPosture,
      // Phase 4B: guardrail override telemetry for training data + UI.
      guardrailOverrides,
      guardrailSourceNote,
      // Haiku eval reliability fix (June 2026): transport-failure receipt.
      // null on success; { failureClass, message, timestamp, evalId } when the
      // tick degraded to a fallback HOLD — distinguishes a deliberate HOLD
      // from an engine outage in the eval history.
      haikuError: haikuFailure ? { ...haikuFailure, evalId } : null,
    };

    // Surface the degraded tick on the status feed — a silent fallback HOLD is
    // indistinguishable from a deliberate one without this. Rides the existing
    // feed concat below (no new write op); the slice enforces the cap.
    if (haikuFailure) {
      statusFeedEntries.push({
        timestamp: now,
        message: `Evaluation engine degraded this tick (${haikuFailure.failureClass}) — defaulted to HOLD.`,
        action: 'eval_degraded',
        source: 'system',
        evalId,
        symbolOut: null,
        symbolIn: null,
      });
    }

    // Shadow log (fire-and-forget)
    logEvaluation({
      battleId: battle.id,
      agentId: battle.agentId,
      userId: battle.ownerId || null,
      battlePhase: phase,
      decision,
      symbolOut: evaluation.symbolOut,
      symbolIn: evaluation.symbolIn,
      tier: evaluation.tier,
      rationale: evaluation.rationale,
      hypothesis: evaluation.hypothesis,
      conviction: evaluation.conviction,
      triggers: evaluation.triggers,
      scores: evaluation.scores,
      marketPosture,
      downgraded,
      tokenUsage: { input: inputTokens || null, output: outputTokens || null },
      // Haiku eval reliability fix: failure class for the training/forensics
      // pipeline (null on success). logEvaluation is a passthrough to the GCS
      // shadow stream, so no shadowLogger.js change is needed.
      failureClass: haikuFailure?.failureClass || null,
    }).catch(() => {});

    // ---- Write everything ----
    const evaluations = [...(battle.evaluations || []), evaluation].slice(-150);
    const consecutiveHolds = decision === 'HOLD'
      ? (battle.cronState?.consecutiveHolds || 0) + 1
      : 0;

    // Cap statusFeed at 50 entries
    const existingFeed = battle.statusFeed || [];
    const updatedFeed = [...existingFeed, ...statusFeedEntries].slice(-STATUS_FEED_CAP);

    const finalUpdate = {
      ...scoreUpdate,
      evaluations,
      statusFeed: updatedFeed,
      'scoreState.evaluationCount': evaluations.length,
      'scoreState.holdCount': (decision === 'HOLD' || decision === 'PROPOSAL')
        ? (battle.scoreState?.holdCount || 0) + 1
        : (battle.scoreState?.holdCount || 0),
      'cronState.lastTriggeredAt': now,
      // totalHaikuCalls counts ATTEMPTS — a budget_skipped tick never started a
      // call, so it does not increment (semantic fidelity for the token-vs-call
      // forensics that exposed the June 11 outage).
      'cronState.totalHaikuCalls': (battle.cronState?.totalHaikuCalls || 0) + (haikuAttempted ? 1 : 0),
      // Fair-rotation signal (budget-starvation mitigation): the last tick this
      // battle actually STARTED a Haiku call. Written ONLY on a real attempt so
      // budget_skipped ticks don't refresh it — the handler orders battles
      // ascending by this so the longest-starved battle leads the next tick.
      ...(haikuAttempted ? { 'cronState.lastEvalStartedAt': now } : {}),
      'cronState.totalTokens.input': (battle.cronState?.totalTokens?.input || 0) + inputTokens,
      'cronState.totalTokens.output': (battle.cronState?.totalTokens?.output || 0) + outputTokens,
      'cronState.consecutiveHolds': consecutiveHolds,
      // Degraded-mode disclosure counter (L3): success resets, real failures
      // increment, budget_skipped passes through (scheduling choice, not an
      // engine fault — the helper documents the distinction). Set only on this
      // full-Haiku path; the other flush sites never attempt Haiku, so the
      // counter correctly reflects health as of the last attempt.
      'cronState.consecutiveEvalFailures': nextConsecutiveEvalFailures(
        battle.cronState?.consecutiveEvalFailures,
        haikuResult ? 'success' : (haikuFailure?.failureClass === 'budget_skipped' ? 'budget_skipped' : 'failure')
      ),
    };

    // Durable failure capture (Phase 2): same {timestamp, error} shape and
    // ≤20-entry cap as the handler-catch writer above, plus additive
    // failureClass/evalId. Rides this finalUpdate — no new write op.
    if (haikuFailure) {
      const cronErrors = (battle.cronState?.cronErrors || []).slice(-19);
      cronErrors.push({
        timestamp: haikuFailure.timestamp,
        error: `haiku_eval ${haikuFailure.failureClass}: ${haikuFailure.message}`,
        failureClass: haikuFailure.failureClass,
        evalId,
      });
      finalUpdate['cronState.cronErrors'] = cronErrors;
    }
    // Shared cron state (lastEvaluatedAt / evaluatingAt / vwapTicks /
    // intradayMomentum). `now` is passed so lastEvaluatedAt === lastTriggeredAt,
    // preserving prior behavior exactly.
    finalizeCronState(finalUpdate, { vwapTicks, intradayMomentum: momentumData.vwap, now, stagnationTicks, lastTickPrice, lastTickTimestamp, vwapFireGuard });

    // Write pending proposal if mode branching created one
    if (pendingProposalUpdate) {
      finalUpdate.pendingProposal = pendingProposalUpdate;
    }

    // P2.6 (dark): once-per-battle-per-tick capture — A-1 envelope, awaited
    // shadowDiffs write, §6.3 gate aggregate (+ terminal-gate on a final
    // non-action) riding THIS finalUpdate (the cronErrors precedent — no new
    // write op for the aggregates). Never throws into the tick; pre-manifest
    // battles are skipped inside the module.
    if (SHADOW_ASSEMBLY_ENABLED) {
      await runShadowTickCapture({
        db, battle, finalUpdate,
        tick: {
          cronStartIso: new Date(cronStartTime).toISOString(),
          nowIso: now,
          modelId: EVAL_MODEL_ID,
          market: { prices, macroPrices, assetScores, triggers, news, momentumData, presetConfig },
          candidatesTested:
            (battle.portfolio?.bench?.stocks?.length || 0)
            + (battle.watchlist?.hotBench?.length || 0),
          statusFeedEntries,
          decision, evaluation, haikuFailure, downgraded,
        },
      });
    }

    await battleRef.update(finalUpdate);
    summary.evaluated++;
  } catch (err) {
    // Clear lock on any error
    await battleRef.update({ 'cronState.evaluatingAt': null }).catch(() => {});
    throw err;
  } finally {
    // Phase 2 Voice Layer Rework — dispatch trade narrations for any swaps
    // that committed during this tick, regardless of how we exit the try
    // (normal completion, early-return from a skip-haiku branch, or
    // thrown error after the swap committed). generateTradeNarration
    // never throws (the helper wraps its own try/catch), so
    // Promise.allSettled is belt-and-suspenders.
    //
    // Parallel dispatch (was sequential): a multi-swap tick — risk
    // cascade + Haiku autopilot, or a gameplan-approved rotation with
    // multiple swaps — would otherwise serialize N × 10s of Gemma
    // latency inside this finally and risk blowing past the cron's 60s
    // maxDuration. Parallel keeps wall time at ~one Gemma call
    // regardless of N. chatExchanges arrayUnion ordering is driven by
    // each exchange's own embedded timestamp, not by dispatch order.
    if (pendingNarrations.length > 0) {
      await Promise.allSettled(
        pendingNarrations.map((n) =>
          generateTradeNarration({
            db,
            battleId: battle.id,
            agentId: battle.agentId,
            closedTrade: n.closedTrade,
            evalId: n.evalId,
          })
        )
      );
    }

    // Phase 3 Voice Layer Rework — dispatch anticipations AFTER narrations
    // have settled (sequential between batches, parallel within each
    // batch). This keeps chat ordering chronologically coherent: a
    // narration for a swap that committed during this tick has a
    // timestamp earlier than an anticipation generated afterward, even
    // though both fire in the same finally.
    //
    // Budget gate: each generateAnticipation call has a 10s
    // AbortController timeout. We require at least 12s of remaining
    // cron budget (10s for Gemma + 2s headroom for Firestore write
    // and shadow log) before invoking. Below that, the entire
    // anticipation batch is skipped with a shadow-log breadcrumb —
    // narrations remain higher priority and always fire. This is the
    // graceful-degradation contract: anticipations are the lowest
    // priority Voice Layer surface (per spec §2 Decision 2).
    if (pendingAnticipations.length > 0) {
      const remainingBudget = TIME_BUDGET_MS - (Date.now() - cronStartTime);
      if (remainingBudget > 12_000) {
        await Promise.allSettled(
          pendingAnticipations.map((a) =>
            generateAnticipation({
              db,
              battleId: battle.id,
              agentId: battle.agentId,
              anticipationCandidate: a.candidate,
              evalId: a.evalId,
            })
          )
        );
      } else {
        console.log(
          `${LOG_PREFIX} Skipped ${pendingAnticipations.length} anticipation dispatch(es) for battle ${battle.id} — cron budget pressure (${remainingBudget}ms remaining)`
        );
        for (const a of pendingAnticipations) {
          logAnticipation({
            battleId: battle.id,
            agentId: battle.agentId,
            anticipationSource: 'haiku',
            success: false,
            errorStep: 'cron_budget_skip',
            errorReason: `remaining_budget_${remainingBudget}ms`,
            candidate: a.candidate ? {
              symbol: a.candidate.symbol || null,
              direction: a.candidate.direction || null,
              signalSummary: a.candidate.signalSummary || null,
              threshold: a.candidate.threshold || null,
            } : null,
            evalId: a.evalId || null,
          }).catch(() => {});
        }
      }
    }
  }
}

// ==================== HELPERS ====================

function findBenchAsset(bench, symbol) {
  if (!bench || !symbol) return null;
  const stockMatch = (bench.stocks || []).find(s => s?.symbol === symbol);
  if (stockMatch) return stockMatch;
  if (bench.crypto?.symbol === symbol) return bench.crypto;
  return null;
}

/**
 * Fetch fresh prices for a pending proposal's symbols.
 */
async function fetchPricesForProposal(proposal) {
  const symbols = [proposal.symbolOut, proposal.symbolIn].filter(Boolean);
  const prices = {};
  await Promise.all(symbols.map(async (symbol) => {
    try {
      const data = await getStockAnalysisData(symbol, { forceRefresh: true, fields: ['daily', 'price'] });
      if (data?.price) prices[symbol] = data.price;
    } catch (err) {
      console.warn(`${LOG_PREFIX} Price fetch for proposal symbol ${symbol} failed:`, err.message);
    }
  }));
  return prices;
}

/**
 * Handle pending proposal lifecycle: expiry, approved, vetoed.
 * Runs AFTER risk evaluation, BEFORE trigger gate/Haiku.
 * Returns 'skip_haiku' if a pending proposal is still active, 'continue' otherwise.
 *
 * @param {number} currentScore - Phase 4: live score at evaluation time, captured
 *   onto resolved proposals as scoreAtVeto (vetoed) or scoreAtResolution
 *   (auto_executed / lapsed) for Sprint 2 conviction analysis.
 */
async function handlePendingProposal(db, battleRef, battle, prices, statusFeedEntries, summary, currentScore, tournamentCtx = null) {
  const proposal = battle.pendingProposal;
  if (!proposal) return 'continue';

  // LAUNCH GUARD (2026-05-19): Auto-pilot only. See AUTHORITY_MODE_POST_LAUNCH_BACKLOG.md.
  // This branch should never execute in normal operation. If it does, something
  // has set a battle's mode to copilot or manual outside the sanctioned flow.
  // Resolve the proposal gracefully as auto_executed (safest non-action) without
  // running execution, log a warning, and clear pendingProposal.
  if ((battle.executionMode || 'autopilot') === 'autopilot') {
    console.warn(`${LOG_PREFIX} LAUNCH GUARD: pendingProposal exists on autopilot battle ${battle.id} (proposalId=${proposal.proposalId}). Resolving as auto_executed without execution.`);
    const resolvedProposal = {
      ...proposal,
      resolvedAt: new Date().toISOString(),
      resolution: 'auto_executed',
      resolvedBy: 'system',
      systemNote: 'launch_guard_clear',
      scoreAtResolution: typeof currentScore === 'number' ? Math.round(currentScore * 100) / 100 : null,
    };
    const history = [...(battle.proposalHistory || []), resolvedProposal].slice(-50);
    await battleRef.update({ pendingProposal: null, proposalHistory: history });
    await refreshBattleFromDoc(battleRef, battle, tournamentCtx);
    return 'continue';
  }

  // PRESERVED FOR POST-LAUNCH (2026-05-19): proposal lifecycle (approved/vetoed/expired).
  // Unreachable under the launch guard above while modes are autopilot. Kept for revival.

  // Already resolved by client — execute or clear
  if (proposal.resolvedAt && proposal.resolution) {
    if (proposal.resolution === 'approved') {
      // Execute the approved swap
      // P2: dormant path wrapped now — cheap and correct forever.
      let reservedSymbolIn = null;
      try {
        const freshPrices = await fetchPricesForProposal(proposal);
        // Verify bench asset still exists
        const benchAsset = findBenchAsset(battle.portfolio?.bench, proposal.symbolIn);
        let reservation = null;
        if (benchAsset) {
          // P2 phase 1 (no-op for regular battles).
          reservation = await reserveTournamentSymbolIn(db, tournamentCtx, battle, proposal.symbolIn);
          if (tournamentCtx && reservation.reserved) reservedSymbolIn = proposal.symbolIn;
        }
        if (!benchAsset) {
          console.warn(`${LOG_PREFIX} Bench asset ${proposal.symbolIn} no longer available — lapsing approved proposal`);
          statusFeedEntries.push({
            timestamp: new Date().toISOString(),
            message: `Approved swap ${proposal.symbolOut} → ${proposal.symbolIn} could not execute — bench asset no longer available.`,
            action: 'hold', source: 'proposal_system',
            symbolOut: proposal.symbolOut, symbolIn: proposal.symbolIn,
          });
        } else if (reservation && !reservation.reserved) {
          // P2: reserve lost — lapse exactly like the bench-asset-gone path.
          console.warn(`${LOG_PREFIX} Reserve failed for ${proposal.symbolIn} (${reservation.reason}) — lapsing approved proposal`);
          statusFeedEntries.push({
            timestamp: new Date().toISOString(),
            message: `Approved swap ${proposal.symbolOut} → ${proposal.symbolIn} could not execute — ${proposal.symbolIn} is already taken in the group's agent market.`,
            action: 'hold', source: 'proposal_system',
            symbolOut: proposal.symbolOut, symbolIn: proposal.symbolIn,
          });
        } else {
          // TODO(post-launch authority modes): when co-pilot / manual return,
          // capture the closedTrade and push to pendingNarrations here so
          // approved proposals get a Gemma narration in chat. Dormant under
          // today's autopilot launch guard — handlePendingProposal short-
          // circuits autopilot mode to auto_executed without execution.
          // [VWAP Floor B1b] Also dormant: the in-memory counter reset done at
          // the live swap sites is skipped here (maps live in processAgentBattle
          // scope); the tick-start prune covers this path by the next tick.
          // Corpus Capture Patch W2 — snapshot the outgoing position BEFORE
          // the swap closes it (mirrors the autopilot site).
          const l1ApprovedOutgoingPosition = LEARNING_L1_CAPTURE_ENABLED && LEARNING_L1_CAPTURE_EXPANSION_ENABLED
            ? (battle.portfolio?.[proposal.tier]?.[proposal.slotIndex] || null)
            : null;
          const approvedSwapResult = await executeSwapServer(
            db, battle.id, battle,
            proposal.tier, proposal.slotIndex,
            benchAsset, proposal.evaluationMetadata?.tradingDay || 1,
            // Corpus Capture Patch W2 (P2 flag #4 hardening, founder-approved):
            // a metadata-less proposal must never persist a SOURCELESS swap.
            // #5 (adversarial review): PER-KEY merge, not `|| {}` — an empty or
            // partial metadata object is TRUTHY and would bypass a whole-object
            // fallback, so spread the synthesized floor FIRST and let any present
            // real keys override it (spreading a nullish/legacy metadata is a
            // no-op, so this also covers the fully-absent case). Required floor:
            // { source, archetype, hftKnobsSource, entryPreset, entryMode,
            // exitReason }. buildSwapReceiptSource is the fenced helper (called).
            freshPrices, {
              ...buildSwapReceiptSource({ source: 'haiku', archetype: null }),
              entryPreset: battle.strategyPreset || 'balanced',
              entryMode: battle.executionMode || 'autopilot',
              exitReason: 'haiku_decision',
              ...(proposal.evaluationMetadata || {}),
            },
            proposal.snapshot || null
          );
          await confirmTournamentSwap(db, tournamentCtx, battle, {
            symbolIn: approvedSwapResult.closedTrade?.symbolIn || proposal.symbolIn,
            symbolOut: approvedSwapResult.closedTrade?.symbolOut || proposal.symbolOut,
          }, statusFeedEntries);
          reservedSymbolIn = null;
          statusFeedEntries.push({
            timestamp: new Date().toISOString(),
            message: `Coach approved: Swap ${proposal.symbolOut} → ${proposal.symbolIn}`,
            action: 'swap', source: 'proposal_system',
            symbolOut: proposal.symbolOut, symbolIn: proposal.symbolIn,
          });
          summary.swapped++;
          // Corpus Capture Patch W2 — L1 capture, co-pilot proposal class
          // (APPROVED path). Dormant today under the autopilot launch guard —
          // instrumented now so the class enters the corpus the day co-pilot
          // mode returns. Autopilot-site posture: post-commit, triple-gated,
          // try/catch log-and-swallow. `ctx` is not in scope in this fn.
          if (LEARNING_L1_CAPTURE_ENABLED && LEARNING_L1_CAPTURE_EXPANSION_ENABLED
              && classifyEvidence({ isCpu: battle.isCpu, agentId: battle.agentId }) === 'live_agent') {
            try {
              // #3 (adversarial review): persist the pending-proposal clear
              // BEFORE the capture await so a hard timeout during capture cannot
              // leave the proposal re-executable (capture must never sit between
              // a durable commit and its durable cleanup). Inside the flag guard
              // ⇒ the flags-off path is byte-identical; the shared clear at the
              // resolution level below is the idempotent backstop (and still the
              // sole clear for the bench-gone / reserve-lost sub-branches).
              await battleRef.update({ pendingProposal: null });
              // #8: entryATR provenance via the shared classifier (benchAsset in scope).
              const approvedEntryATR = approvedSwapResult.incomingAsset?.baseATR ?? null;
              const approvedEntryAtrSource = classifyEntryAtrSource({
                entryATR: approvedEntryATR,
                scoredThreshold: battle.scoring?.thresholds?.[proposal.symbolIn]?.threshold,
                benchBaseATR: benchAsset?.baseATR,
                isCrypto: benchAsset?.isCrypto,
              });
              await captureSwapReceipt({
                enabled: true,
                db,
                agentId: battle.agentId,
                // W1 — absent ⇒ null, never 'unknown'.
                archetype: battle.agentContext?.archetype ?? null,
                isCpu: battle.isCpu,
                battleId: battle.id,
                battleDay: proposal.evaluationMetadata?.tradingDay ?? null,
                timestamp: approvedSwapResult.closedTrade?.swappedOutAt || null,
                // #9 (adversarial review): predicates below are proposal-creation
                // -time (proposal.snapshot), so the predicate/decision instant is
                // proposal.createdAt — NOT the execution timestamp above. Keeps
                // the up-to-TTL staleness computable instead of collapsed.
                decisionAtMs: proposal.createdAt ?? null,
                // /code-review fix: receiptSeq is the CONVENTION itself —
                // scoreState.tradeCount+1 at EXECUTION time (battle.* is
                // pre-refresh here). Deliberately NOT parsed from the
                // proposal's evaluationMetadata.id: that id was minted at
                // proposal CREATION (up to a TTL earlier), so any swap
                // executed during pendency makes it stale and its seq would
                // collide with an already-written receipt in the
                // ${agentId}_seq${n} doc-id space (silent .set() overwrite).
                receiptSeq: (battle.scoreState?.tradeCount || 0) + 1,
                symbolIn: approvedSwapResult.closedTrade?.symbolIn ?? proposal.symbolIn,
                symbolOut: approvedSwapResult.closedTrade?.symbolOut ?? proposal.symbolOut,
                source: 'haiku',
                exitReason: proposal.evaluationMetadata?.exitReason ?? 'haiku_decision',
                haikuSwapReason: proposal.evaluationMetadata?.exitReason ?? 'haiku_decision',
                resolvedTier: proposal.tier ?? null,
                resolvedSlotIndex: proposal.slotIndex ?? null,
                entryMark: approvedSwapResult.incomingAsset?.swapPrice ?? null,
                entryATR: approvedEntryATR,
                entryAtrSource: approvedEntryAtrSource, // #8
                outgoingEntryPrice: approvedSwapResult.closedTrade?.entryPrice ?? null,
                outgoingBaseATR: l1ApprovedOutgoingPosition?.baseATR ?? null,
                thresholdHistory: battle.thresholdHistory?.[proposal.symbolOut] ?? null,
                outgoingSwappedInAt: l1ApprovedOutgoingPosition?.swappedInAt ?? null,
                outgoingSwappedInDay: l1ApprovedOutgoingPosition?.swappedInDay ?? null,
                archetypeIntegrityMode: ARCHETYPE_INTEGRITY_MODE,
                // Proposal-time predicate snapshots (frozen at proposal
                // creation — the decision instant for this class).
                snapshotIn: proposal.snapshot?.symbolIn ?? null,
                snapshotOut: proposal.snapshot?.symbolOut ?? null,
                regimeOut: proposal.regime ?? null,
                tradeCountAtDecision: battle.scoreState?.tradeCount ?? null,
                tradesLenAtDecision: battle.trades?.length ?? null,
                capturedAt: new Date().toISOString(),
              });
            } catch (l1Err) {
              console.error(`${LOG_PREFIX} L1 capture threw (ignored, trade unaffected): ${l1Err?.message}`);
            }
          }
        }
      } catch (err) {
        console.error(`${LOG_PREFIX} Approved proposal execution failed:`, err.message);
        statusFeedEntries.push({
          timestamp: new Date().toISOString(),
          message: `Approved swap failed: ${err.message}`,
          action: 'hold', source: 'proposal_system',
        });
        // P2: compensating release (no-op unless the reserve had landed).
        await releaseTournamentReservation(db, tournamentCtx, reservedSymbolIn);
      }
      // Move to history and clear (cap at 50)
      const history = [...(battle.proposalHistory || []), proposal].slice(-50);
      await battleRef.update({ pendingProposal: null, proposalHistory: history });
      await refreshBattleFromDoc(battleRef, battle, tournamentCtx);
      return 'continue';
    }

    if (proposal.resolution === 'vetoed') {
      statusFeedEntries.push({
        timestamp: new Date().toISOString(),
        message: `Coach vetoed: Swap ${proposal.symbolOut} → ${proposal.symbolIn}${proposal.userReason ? ` (${proposal.userReason})` : ''}`,
        action: 'hold', source: 'proposal_system',
        symbolOut: proposal.symbolOut, symbolIn: proposal.symbolIn,
      });
      // Enrich with veto-time prices for counterfactual tracking
      const vetoEnriched = {
        ...proposal,
        vetoedAtPrice: {
          [proposal.symbolIn]: prices[proposal.symbolIn]?.current || null,
          [proposal.symbolOut]: prices[proposal.symbolOut]?.current || null,
        },
        vetoedAtTimestamp: new Date().toISOString(),
        // Phase 4: numeric resolution-time score for Sprint 2 conviction analysis
        scoreAtVeto: typeof currentScore === 'number' ? Math.round(currentScore * 100) / 100 : null,
      };
      const history = [...(battle.proposalHistory || []), vetoEnriched].slice(-50);
      await battleRef.update({ pendingProposal: null, proposalHistory: history });
      await refreshBattleFromDoc(battleRef, battle, tournamentCtx);
      summary.held++;
      return 'continue';
    }
  }

  // Not resolved — check expiry
  const now = Date.now();
  const expiresAt = new Date(proposal.expiresAt).getTime();

  if (now < expiresAt) {
    // Still pending and not expired — skip trigger gate + Haiku (risk already ran)
    console.log(`${LOG_PREFIX} Battle ${battle.id} has pending proposal (${proposal.proposalId}) — skipping Haiku`);
    return 'skip_haiku';
  }

  // Expired — handle based on mode
  if (proposal.mode === 'copilot') {
    // Auto-execute on expiry
    // P2: dormant path wrapped now — cheap and correct forever.
    let reservedSymbolIn = null;
    try {
      const freshPrices = await fetchPricesForProposal(proposal);
      const benchAsset = findBenchAsset(battle.portfolio?.bench, proposal.symbolIn);
      let reservation = null;
      if (benchAsset) {
        // P2 phase 1 (no-op for regular battles).
        reservation = await reserveTournamentSymbolIn(db, tournamentCtx, battle, proposal.symbolIn);
        if (tournamentCtx && reservation.reserved) reservedSymbolIn = proposal.symbolIn;
      }
      if (!benchAsset) {
        console.warn(`${LOG_PREFIX} Bench asset ${proposal.symbolIn} gone — lapsing expired copilot proposal`);
        statusFeedEntries.push({
          timestamp: new Date().toISOString(),
          message: `Proposal expired but ${proposal.symbolIn} no longer on bench. Lapsed.`,
          action: 'hold', source: 'proposal_system',
        });
      } else if (reservation && !reservation.reserved) {
        // P2: reserve lost — lapse exactly like the bench-asset-gone path.
        console.warn(`${LOG_PREFIX} Reserve failed for ${proposal.symbolIn} (${reservation.reason}) — lapsing expired copilot proposal`);
        statusFeedEntries.push({
          timestamp: new Date().toISOString(),
          message: `Proposal expired but ${proposal.symbolIn} is already taken in the group's agent market. Lapsed.`,
          action: 'hold', source: 'proposal_system',
        });
      } else {
        // TODO(post-launch authority modes): same as the 'approved' branch
        // above — capture closedTrade + push to pendingNarrations when
        // co-pilot mode returns. Dormant today under autopilot launch guard.
        // [VWAP Floor B1b] In-memory counter reset also skipped here (see
        // 'approved' branch note) — tick-start prune covers by next tick.
        // Corpus Capture Patch W2 — snapshot the outgoing position BEFORE
        // the swap closes it (mirrors the autopilot site).
        const l1ExpiredOutgoingPosition = LEARNING_L1_CAPTURE_ENABLED && LEARNING_L1_CAPTURE_EXPANSION_ENABLED
          ? (battle.portfolio?.[proposal.tier]?.[proposal.slotIndex] || null)
          : null;
        const expiredSwapResult = await executeSwapServer(
          db, battle.id, battle,
          proposal.tier, proposal.slotIndex,
          benchAsset, proposal.evaluationMetadata?.tradingDay || 1,
          // Corpus Capture Patch W2 (P2 flag #4 hardening) — same PER-KEY merge
          // as the 'approved' branch (#5): synthesized floor first, present
          // metadata keys override; a truthy empty/partial object no longer
          // bypasses the floor. Never persist a sourceless swap.
          freshPrices, {
            ...buildSwapReceiptSource({ source: 'haiku', archetype: null }),
            entryPreset: battle.strategyPreset || 'balanced',
            entryMode: battle.executionMode || 'autopilot',
            exitReason: 'haiku_decision',
            ...(proposal.evaluationMetadata || {}),
          },
          proposal.snapshot || null
        );
        await confirmTournamentSwap(db, tournamentCtx, battle, {
          symbolIn: expiredSwapResult.closedTrade?.symbolIn || proposal.symbolIn,
          symbolOut: expiredSwapResult.closedTrade?.symbolOut || proposal.symbolOut,
        }, statusFeedEntries);
        reservedSymbolIn = null;
        statusFeedEntries.push({
          timestamp: new Date().toISOString(),
          message: `Auto-executed: Swap ${proposal.symbolOut} → ${proposal.symbolIn} (proposal expired, Co-Pilot mode)`,
          action: 'swap', source: 'proposal_system',
          symbolOut: proposal.symbolOut, symbolIn: proposal.symbolIn,
        });
        summary.swapped++;
        // Corpus Capture Patch W2 — L1 capture, co-pilot proposal class
        // (EXPIRED-AUTO-EXEC path). Same class as 'approved' above — a
        // proposal is a decision-outcome only when it RUNS, so both execution
        // points capture. Dormant today under the autopilot launch guard.
        if (LEARNING_L1_CAPTURE_ENABLED && LEARNING_L1_CAPTURE_EXPANSION_ENABLED
            && classifyEvidence({ isCpu: battle.isCpu, agentId: battle.agentId }) === 'live_agent') {
          try {
            // #3 (adversarial review): clear pendingProposal BEFORE the capture
            // await (same rationale as the 'approved' branch). Inside the flag
            // guard ⇒ flags-off byte-identical; shared clear below is the backstop.
            await battleRef.update({ pendingProposal: null });
            // #8: entryATR provenance via the shared classifier (benchAsset in scope).
            const expiredEntryATR = expiredSwapResult.incomingAsset?.baseATR ?? null;
            const expiredEntryAtrSource = classifyEntryAtrSource({
              entryATR: expiredEntryATR,
              scoredThreshold: battle.scoring?.thresholds?.[proposal.symbolIn]?.threshold,
              benchBaseATR: benchAsset?.baseATR,
              isCrypto: benchAsset?.isCrypto,
            });
            await captureSwapReceipt({
              enabled: true,
              db,
              agentId: battle.agentId,
              // W1 — absent ⇒ null, never 'unknown'.
              archetype: battle.agentContext?.archetype ?? null,
              isCpu: battle.isCpu,
              battleId: battle.id,
              battleDay: proposal.evaluationMetadata?.tradingDay ?? null,
              timestamp: expiredSwapResult.closedTrade?.swappedOutAt || null,
              // #9: predicate/decision instant is proposal.createdAt (creation-
              // time snapshots), not the execution timestamp above.
              decisionAtMs: proposal.createdAt ?? null,
              // /code-review fix: receiptSeq = scoreState.tradeCount+1 at
              // EXECUTION time, never the stale creation-time metadata id
              // (same collision rationale as the 'approved' branch above).
              receiptSeq: (battle.scoreState?.tradeCount || 0) + 1,
              symbolIn: expiredSwapResult.closedTrade?.symbolIn ?? proposal.symbolIn,
              symbolOut: expiredSwapResult.closedTrade?.symbolOut ?? proposal.symbolOut,
              source: 'haiku',
              exitReason: proposal.evaluationMetadata?.exitReason ?? 'haiku_decision',
              haikuSwapReason: proposal.evaluationMetadata?.exitReason ?? 'haiku_decision',
              resolvedTier: proposal.tier ?? null,
              resolvedSlotIndex: proposal.slotIndex ?? null,
              entryMark: expiredSwapResult.incomingAsset?.swapPrice ?? null,
              entryATR: expiredEntryATR,
              entryAtrSource: expiredEntryAtrSource, // #8
              outgoingEntryPrice: expiredSwapResult.closedTrade?.entryPrice ?? null,
              outgoingBaseATR: l1ExpiredOutgoingPosition?.baseATR ?? null,
              thresholdHistory: battle.thresholdHistory?.[proposal.symbolOut] ?? null,
              outgoingSwappedInAt: l1ExpiredOutgoingPosition?.swappedInAt ?? null,
              outgoingSwappedInDay: l1ExpiredOutgoingPosition?.swappedInDay ?? null,
              archetypeIntegrityMode: ARCHETYPE_INTEGRITY_MODE,
              // Proposal-time predicate snapshots (the decision instant).
              snapshotIn: proposal.snapshot?.symbolIn ?? null,
              snapshotOut: proposal.snapshot?.symbolOut ?? null,
              regimeOut: proposal.regime ?? null,
              tradeCountAtDecision: battle.scoreState?.tradeCount ?? null,
              tradesLenAtDecision: battle.trades?.length ?? null,
              capturedAt: new Date().toISOString(),
            });
          } catch (l1Err) {
            console.error(`${LOG_PREFIX} L1 capture threw (ignored, trade unaffected): ${l1Err?.message}`);
          }
        }
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} Expired copilot proposal execution failed:`, err.message);
      // P2: compensating release (no-op unless the reserve had landed).
      await releaseTournamentReservation(db, tournamentCtx, reservedSymbolIn);
    }
  } else {
    // Manual mode — lapse without executing
    statusFeedEntries.push({
      timestamp: new Date().toISOString(),
      message: `Proposal lapsed: Swap ${proposal.symbolOut} → ${proposal.symbolIn} (no Coach action within 15min, Manual mode)`,
      action: 'hold', source: 'proposal_system',
      symbolOut: proposal.symbolOut, symbolIn: proposal.symbolIn,
    });
    summary.held++;
  }

  // Move expired proposal to history and clear
  const resolvedProposal = {
    ...proposal,
    resolvedAt: new Date().toISOString(),
    resolution: proposal.mode === 'copilot' ? 'auto_executed' : 'lapsed',
    resolvedBy: 'system',
    // Phase 4: numeric resolution-time score for Sprint 2 conviction analysis
    scoreAtResolution: typeof currentScore === 'number' ? Math.round(currentScore * 100) / 100 : null,
  };
  const history = [...(battle.proposalHistory || []), resolvedProposal].slice(-50);
  await battleRef.update({ pendingProposal: null, proposalHistory: history });
  await refreshBattleFromDoc(battleRef, battle, tournamentCtx);
  return 'continue';
}

// ==================== GAMEPLAN MEETING ====================

/**
 * Handle existing gameplan meeting lifecycle: approved, rejected, expired.
 * Mirrors handlePendingProposal pattern.
 * Returns 'skip_haiku' if a pending meeting blocks evaluation, 'continue' otherwise.
 */
async function handleGameplanMeeting(db, battleRef, battle, prices, statusFeedEntries, summary, pendingNarrations, tournamentCtx = null) {
  const meeting = battle.gameplanMeeting;
  if (!meeting) return 'continue';

  // Already resolved by client
  if (meeting.status === 'approved') {
    // Execute suggested swaps
    for (const swap of (meeting.suggestedSwaps || [])) {
      // P2: set after a successful reserve; the per-iteration catch runs
      // the compensating release.
      let reservedSymbolIn = null;
      try {
        const benchAsset = findBenchAsset(battle.portfolio?.bench, swap.symbolIn);
        if (!benchAsset) {
          statusFeedEntries.push({
            timestamp: new Date().toISOString(),
            message: `Gameplan swap ${swap.symbolOut} → ${swap.symbolIn} skipped — bench asset unavailable.`,
            action: 'hold', source: 'gameplan_meeting',
          });
          continue;
        }
        const slot = findPortfolioSlot(battle.portfolio, swap.symbolOut);
        if (!slot) continue;

        // P2 phase 1: reserve before executing this rotation step. No-op
        // (always reserved) for regular battles.
        const reservation = await reserveTournamentSymbolIn(db, tournamentCtx, battle, swap.symbolIn);
        if (!reservation.reserved) {
          console.warn(`${LOG_PREFIX} Reserve failed for ${swap.symbolIn} (${reservation.reason}) — gameplan swap skipped`);
          statusFeedEntries.push({
            timestamp: new Date().toISOString(),
            message: `Gameplan swap ${swap.symbolOut} → ${swap.symbolIn} skipped — ${swap.symbolIn} is already taken in the group's agent market.`,
            action: 'hold', source: 'gameplan_meeting',
            symbolOut: swap.symbolOut, symbolIn: swap.symbolIn,
          });
          continue;
        }
        if (tournamentCtx) reservedSymbolIn = swap.symbolIn;

        const currentDay = getCurrentTradingDayServer(battle.timing?.tradingDays);
        const tradeId = `trade_${String((battle.scoreState?.tradeCount || 0) + 1).padStart(3, '0')}`;
        // Append _${Date.now()} to keep the evaluationId unique across
        // repeated gameplan swaps on the same symbol pair (mirrors the
        // risk-triggered evalId suffix pattern).
        const gameplanEvalId = `gameplan_${swap.symbolOut}_${swap.symbolIn}_${Date.now()}`;
        // [VWAP Floor B1b] In-memory counter reset skipped here too (separate
        // fn, launch-guarded path) — tick-start prune covers by next tick.
        // Corpus Capture Patch W2 — snapshot the outgoing position BEFORE the
        // swap closes it (mirrors the autopilot site's l1OutgoingPosition).
        const l1GameplanOutgoingPosition = LEARNING_L1_CAPTURE_ENABLED && LEARNING_L1_CAPTURE_EXPANSION_ENABLED
          ? (battle.portfolio?.[slot.tier]?.[slot.slotIndex] || null)
          : null;
        const gameplanSwapResult = await executeSwapServer(
          db, battle.id, battle,
          slot.tier, slot.slotIndex,
          benchAsset, currentDay, prices,
          { id: tradeId, action: 'SWAP', trigger: 'gameplan_rotation', rationale: swap.rationale, tradingDay: currentDay,
            entryRegime: null, entryMarketPosture: null, entryConviction: 0,
            entryPreset: battle.strategyPreset || 'balanced', entryMode: battle.executionMode || 'autopilot', exitReason: 'gameplan_rotation',
            // Phase 6 (§4.6) — receipt source. Dormant (gameplan approval is launch-guarded).
            // NB: this is handleGameplanMeeting (separate fn) — `ctx` is not in scope
            // here; read archetype off battle.agentContext directly.
            ...buildSwapReceiptSource({ source: 'gameplan_meeting', archetype: battle.agentContext?.archetype }),
            // Release 2 PR-b — the §14 provenance sibling. handleGameplanMeeting
            // has no dialClamp in scope; resolveTempoDial is pure, so this
            // resolution is identical to the tick's for the same battle+flags.
            ...buildSwapProvenance(resolveTempoDial({ desiredTempo: desiredTempoOf(battle), dialEnabled: TEMPO_DIAL_ENABLED }).provenance),
            evaluationId: gameplanEvalId }
        );
        // P2 phase 2: confirm + double-down detection (no-op when
        // tournamentCtx is null). Actual symbols from closedTrade.
        await confirmTournamentSwap(db, tournamentCtx, battle, {
          symbolIn: gameplanSwapResult.closedTrade?.symbolIn || swap.symbolIn,
          symbolOut: gameplanSwapResult.closedTrade?.symbolOut || swap.symbolOut,
        }, statusFeedEntries);
        reservedSymbolIn = null;
        // Phase 2 Voice Layer Rework — queue narration for this
        // gameplan-approved swap so the user gets a chat message
        // explaining each rotation step, not just the swap entries in
        // the timeline. pendingNarrations may be undefined when this
        // handler is called from a non-cron path (defensive).
        if (pendingNarrations && gameplanSwapResult?.closedTrade) {
          pendingNarrations.push({
            closedTrade: gameplanSwapResult.closedTrade,
            evalId: gameplanEvalId,
          });
        }
        statusFeedEntries.push({
          timestamp: new Date().toISOString(),
          message: `Gameplan approved: ${swap.symbolOut} → ${swap.symbolIn}`,
          action: 'swap', source: 'gameplan_meeting',
          symbolOut: swap.symbolOut, symbolIn: swap.symbolIn,
        });
        summary.swapped++;
        // Corpus Capture Patch W2 — L1 capture, gameplan-meeting class.
        // Autopilot-site posture: post-commit, triple-gated, try/catch
        // log-and-swallow. NB: separate fn — `ctx` is not in scope; archetype
        // reads off battle.agentContext directly (the :2817 spread precedent).
        // Predicate snapshots/tech docs are not in this fn's scope — those
        // fields stay null and are recorded honestly. entryATR provenance (#8)
        // IS available (the swap-in benchAsset is in scope) and is classified.
        // Runs BEFORE refreshBattleFromDoc so battle.* holds decision-time state.
        // #3 note: this capture is per-iteration inside the swap loop and the
        // meeting clear is a single post-loop write, so the capture technically
        // sits between the swap commit and the meeting clear. It is NOT reordered
        // here (unlike the single-swap proposal sites): natural idempotency —
        // findBenchAsset returns null for an already-swapped-in symbol, hitting
        // `continue` on replay — makes a resumed meeting skip completed swaps and
        // finish the rest, so a mid-loop death resumes-not-duplicates. Moving the
        // clear before the loop would instead DROP not-yet-executed swaps. A
        // strict "capture after cleanup" restructure (defer captures past the
        // post-loop clear) is deferred pending founder sign-off.
        if (LEARNING_L1_CAPTURE_ENABLED && LEARNING_L1_CAPTURE_EXPANSION_ENABLED
            && classifyEvidence({ isCpu: battle.isCpu, agentId: battle.agentId }) === 'live_agent') {
          try {
            // #8: entryATR provenance via the shared classifier (benchAsset in scope).
            const gameplanEntryATR = gameplanSwapResult.incomingAsset?.baseATR ?? null;
            const gameplanEntryAtrSource = classifyEntryAtrSource({
              entryATR: gameplanEntryATR,
              scoredThreshold: battle.scoring?.thresholds?.[swap.symbolIn]?.threshold,
              benchBaseATR: benchAsset?.baseATR,
              isCrypto: benchAsset?.isCrypto,
            });
            await captureSwapReceipt({
              enabled: true,
              db,
              agentId: battle.agentId,
              // W1 — absent ⇒ null, never 'unknown'.
              archetype: battle.agentContext?.archetype ?? null,
              isCpu: battle.isCpu,
              battleId: battle.id,
              battleDay: currentDay,
              timestamp: gameplanSwapResult.closedTrade?.swappedOutAt || null,
              // /code-review fix: the convention directly (tradeId here is
              // minted as tradeCount+1 so the values agree — using the
              // convention keeps all new sites uniform and immune to trade-id
              // format drift).
              receiptSeq: (battle.scoreState?.tradeCount || 0) + 1,
              symbolIn: gameplanSwapResult.closedTrade?.symbolIn ?? swap.symbolIn,
              symbolOut: gameplanSwapResult.closedTrade?.symbolOut ?? swap.symbolOut,
              source: 'gameplan_meeting',
              exitReason: 'gameplan_rotation',
              haikuSwapReason: null, // not a Haiku path
              resolvedTier: slot.tier,
              resolvedSlotIndex: slot.slotIndex,
              entryMark: gameplanSwapResult.incomingAsset?.swapPrice ?? null,
              entryATR: gameplanEntryATR,
              entryAtrSource: gameplanEntryAtrSource, // #8
              outgoingEntryPrice: gameplanSwapResult.closedTrade?.entryPrice ?? null,
              outgoingBaseATR: l1GameplanOutgoingPosition?.baseATR ?? null,
              thresholdHistory: battle.thresholdHistory?.[swap.symbolOut] ?? null,
              outgoingSwappedInAt: l1GameplanOutgoingPosition?.swappedInAt ?? null,
              outgoingSwappedInDay: l1GameplanOutgoingPosition?.swappedInDay ?? null,
              archetypeIntegrityMode: ARCHETYPE_INTEGRITY_MODE,
              tradeCountAtDecision: battle.scoreState?.tradeCount ?? null,
              tradesLenAtDecision: battle.trades?.length ?? null,
              capturedAt: new Date().toISOString(),
            });
          } catch (l1Err) {
            console.error(`${LOG_PREFIX} L1 capture threw (ignored, trade unaffected): ${l1Err?.message}`);
          }
        }
        // Re-read battle after swap (re-applies the tournament filter)
        await refreshBattleFromDoc(battleRef, battle, tournamentCtx);
      } catch (err) {
        console.error(`${LOG_PREFIX} Gameplan swap failed for ${swap.symbolOut}:`, err.message);
        // P2: compensating release (no-op unless the reserve had landed).
        await releaseTournamentReservation(db, tournamentCtx, reservedSymbolIn);
      }
    }
    // Move to history and clear
    const history = [...(battle.gameplanMeetingHistory || []), meeting];
    await battleRef.update({ gameplanMeeting: null, gameplanMeetingHistory: history });
    await refreshBattleFromDoc(battleRef, battle, tournamentCtx);
    return 'continue';
  }

  if (meeting.status === 'rejected') {
    statusFeedEntries.push({
      timestamp: new Date().toISOString(),
      message: 'Gameplan rejected by Coach. Holding current positions.',
      action: 'hold', source: 'gameplan_meeting',
    });
    const history = [...(battle.gameplanMeetingHistory || []), meeting];
    await battleRef.update({ gameplanMeeting: null, gameplanMeetingHistory: history });
    await refreshBattleFromDoc(battleRef, battle, tournamentCtx);
    return 'continue';
  }

  // Still pending — check expiry
  const now = Date.now();
  const expiresAt = new Date(meeting.expiresAt).getTime();

  if (now >= expiresAt) {
    // Expired
    const expired = { ...meeting, status: 'expired', resolvedAt: new Date().toISOString(), resolvedBy: 'system' };
    const history = [...(battle.gameplanMeetingHistory || []), expired];
    statusFeedEntries.push({
      timestamp: new Date().toISOString(),
      message: 'Gameplan meeting expired. Continuing with current strategy.',
      action: 'hold', source: 'gameplan_meeting',
    });
    await battleRef.update({ gameplanMeeting: null, gameplanMeetingHistory: history });
    await refreshBattleFromDoc(battleRef, battle, tournamentCtx);
    return 'continue';
  }

  // Pending and not expired — skip trigger gate (like proposal pending), but risk still ran
  console.log(`${LOG_PREFIX} Battle ${battle.id} has pending gameplan meeting — skipping Haiku`);
  return 'skip_haiku';
}

/**
 * Detect whether a gameplan meeting should be triggered.
 * Triggers on:
 * 1. 3+ consecutive losing trades
 * 2. One sector responsible for >60% of total negative P&L
 *
 * Frequency cap: max 1 per trading day.
 */
function detectGameplanMeetingTrigger(battle, assetScores, prices, flatPortfolio, benchAssets, technicalScoresMap) {
  // Frequency cap: 1 per calendar day (ET)
  const todayET = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  if (battle.cronState?.lastGameplanDate === todayET) return null;

  const startingPrices = battle.portfolio?.startingPrices || {};
  let triggered = false;
  let diagnosis = '';
  let fromSector = '';

  // --- Trigger 1: 3 consecutive losing trades ---
  const trades = battle.trades || [];
  if (trades.length >= 3) {
    const last3 = trades.slice(-3);
    const allLosing = last3.every(t => {
      const pnl = (t.lockedPoints ?? t.points ?? 0);
      return pnl < 0;
    });
    if (allLosing) {
      triggered = true;
      diagnosis = `3 consecutive losing trades. Last 3 swaps all resulted in negative points.`;
    }
  }

  // --- Trigger 2: Sector drag >60% of total negative P&L ---
  if (!triggered) {
    const sectorPnL = {};
    let totalNegativePnL = 0;

    for (const score of assetScores) {
      const asset = flatPortfolio.find(a => a.symbol === score.symbol);
      if (!asset) continue;
      const sector = asset.sector || 'Unknown';
      const currentPrice = prices[score.symbol]?.current;
      const entryPrice = asset.swapPrice || startingPrices[score.symbol] || 0;
      if (!currentPrice || !entryPrice) continue;

      const pnl = ((currentPrice - entryPrice) / entryPrice) * 100;
      if (pnl < 0) {
        sectorPnL[sector] = (sectorPnL[sector] || 0) + pnl;
        totalNegativePnL += pnl;
      }
    }

    if (totalNegativePnL < -1) { // At least -1% aggregate loss to trigger
      for (const [sector, pnl] of Object.entries(sectorPnL)) {
        const share = pnl / totalNegativePnL; // Both negative, so share is positive
        if (share > 0.6) {
          triggered = true;
          fromSector = sector;
          diagnosis = `${sector} sector dragging performance (${Math.abs(pnl).toFixed(1)}% loss, ${(share * 100).toFixed(0)}% of total negative P&L).`;
          break;
        }
      }
    }
  }

  if (!triggered) return null;

  // --- Find opportunity: leading sectors from bench ---
  const benchSectorScores = {};
  for (const benchAsset of benchAssets) {
    const techScore = technicalScoresMap?.[benchAsset.symbol];
    if (!techScore) continue;
    const sector = benchAsset.sector || 'Unknown';
    if (sector === fromSector) continue; // Skip the dragging sector
    if (!benchSectorScores[sector]) benchSectorScores[sector] = [];
    benchSectorScores[sector].push({ symbol: benchAsset.symbol, score: techScore.technicalScore || 0, name: benchAsset.name || benchAsset.symbol });
  }

  // Sort sectors by average technical score
  const rankedSectors = Object.entries(benchSectorScores)
    .map(([sector, stocks]) => ({
      sector,
      avgScore: stocks.reduce((sum, s) => sum + s.score, 0) / stocks.length,
      bestStock: stocks.sort((a, b) => b.score - a.score)[0],
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  const toSectors = rankedSectors.slice(0, 2).map(s => s.sector);
  const opportunity = toSectors.length > 0
    ? `${toSectors.join(' and ')} showing strength. Top bench candidates: ${rankedSectors.slice(0, 2).map(s => `${s.bestStock.symbol} (${s.sector}, Score ${s.bestStock.score})`).join(', ')}.`
    : 'Bench stocks available for rotation.';

  // --- Build suggested swaps ---
  const suggestedSwaps = [];
  if (fromSector) {
    // Find worst active positions from dragging sector
    const draggingPositions = assetScores
      .filter(s => {
        const asset = flatPortfolio.find(a => a.symbol === s.symbol);
        return asset?.sector === fromSector;
      })
      .map(s => {
        const asset = flatPortfolio.find(a => a.symbol === s.symbol);
        const currentPrice = prices[s.symbol]?.current;
        const entryPrice = asset?.swapPrice || startingPrices[s.symbol] || 0;
        const pnl = entryPrice ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
        return { symbol: s.symbol, pnl };
      })
      .sort((a, b) => a.pnl - b.pnl); // Worst first

    const topBenchCandidates = rankedSectors.slice(0, 2).map(s => s.bestStock);

    for (let i = 0; i < Math.min(draggingPositions.length, topBenchCandidates.length); i++) {
      suggestedSwaps.push({
        symbolOut: draggingPositions[i].symbol,
        symbolIn: topBenchCandidates[i].symbol,
        rationale: `${draggingPositions[i].symbol} down ${draggingPositions[i].pnl.toFixed(1)}%, ${topBenchCandidates[i].symbol} (${rankedSectors[i].sector}) has tech score ${topBenchCandidates[i].score}.`,
      });
    }
  }

  // Build EOD expiry
  const nowET = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const todayDate = new Date(nowET);
  todayDate.setHours(16, 0, 0, 0); // 4:00 PM ET
  const expiresAt = todayDate.toISOString();

  return {
    id: `gpm_${Date.now()}`,
    createdAt: new Date().toISOString(),
    diagnosis,
    opportunity,
    proposedAction: 'rotate_sector',
    fromSector: fromSector || null,
    toSectors,
    suggestedSwaps,
    status: 'pending',
    expiresAt,
    resolvedAt: null,
    resolvedBy: null,
  };
}

// ==================== BATTLE COMPLETION ====================

/**
 * Completion disposition, pure (exported for the P4 flat6 matrix).
 *
 * P4 companion (b) — founder scope addition, June 12, 2026: tournament
 * battles (opponent: null by ruling D4) complete with NO W/L-vs-opponent
 * semantics — group placement is the outcome (the P6 composite), so the
 * agent's career W/L/streak stats never move and the feed line names the
 * composite, not a phantom CPU. CPU system agents additionally skip
 * reflection (contract #5 passivity — no model calls). Tiered battles keep
 * today's behavior byte-for-byte, including the exact feed message.
 */
export function resolveCompletionDisposition(battle) {
  const scoreState = battle.scoreState || {};
  const currentScore = scoreState.currentScore || 0;
  if (battle.gameMode === TOURNAMENT_GAME_MODE) {
    return {
      result: null,
      completionContext: 'tournament_group_scored',
      statusMessage: `Battle complete. Day banked at ${currentScore >= 0 ? '+' : ''}${currentScore.toFixed(1)} pts for the tournament composite.`,
      updateAgentStats: false,
      pendingReflection: battle.isCpu !== true,
      logLine: `tournament day banked (${currentScore.toFixed(1)} pts, no W/L)`,
    };
  }
  const opponentScore = scoreState.opponentScore || 0;
  const result = currentScore > opponentScore ? 'win' : (currentScore < opponentScore ? 'loss' : 'draw');
  const resultLabel = result === 'win' ? 'Win' : result === 'loss' ? 'Loss' : 'Draw';
  return {
    result,
    completionContext: null,
    statusMessage: `Battle complete. Agent: ${currentScore >= 0 ? '+' : ''}${currentScore.toFixed(1)} pts vs CPU: ${opponentScore >= 0 ? '+' : ''}${opponentScore.toFixed(1)} pts. Result: ${resultLabel}.`,
    updateAgentStats: true,
    pendingReflection: true,
    logLine: `Agent: ${currentScore.toFixed(1)} vs CPU: ${opponentScore.toFixed(1)}, Result: ${result}`,
  };
}

/**
 * Complete an expired battle: set status, update agent stats.
 *
 * STOP-A.1 (V2.1 memo, founder-approved): the terminal write is a GUARDED
 * TRANSACTION — an in-transaction re-read confirms the battle's state before
 * committing (the regimeAtStart write-once pattern at the regime stamp
 * above), so racing workers (stolen 120s eval lock, decide.js GC) can never
 * double-complete or split-brain the eligibility stamp; against a FULLY
 * completed battle this writer no-ops, skipping stats too. The committed
 * payload is built from the transaction's OWN fresh read and is
 * byte-identical to the legacy plain-update payload (flags-off scope —
 * photographed by agent-evaluate.masteryCompletion.test.js, including the
 * vision-retirement branch).
 *
 * GC REPAIR (/code-review high, angle-B/C finding — legacy behavior
 * restored): the fenced decide.js expiry GC (:588/:1115) writes ONLY
 * {status:'completed', completedAt, completionReason:'expired'} — no stats,
 * no reflection queue, no vision retirement. The legacy unconditional update
 * repaired such battles by overwriting them with the full payload; this
 * transaction preserves that repair deliberately: a bare GC completion
 * (pendingReflection undefined ∧ completionReason 'expired') is finished
 * in place — full payload minus status/completedAt (the GC's earlier
 * completion instant is kept) — and stats still run. Repair writes NO
 * mastery stamp: fence-path completions are structurally outside mastery
 * (V2.1 STOP-A.2); the eligibility stamp rides ONLY the active→completed
 * transition this function itself commits. The discriminator is sound
 * because every cron completion writes pendingReflection (true or false).
 *
 * §5.1 (Spec V2 + V2.1 restated invariant): when epoch 1 has begun, the
 * SAME transaction that first commits status:'completed' also writes
 * masteryEligibility {eligible: worker's own flag view, epochId} + the
 * masteryAwardPending sweep marker — atomic with the transition, write-once
 * by the state guard, gate + fields from the ONE shared
 * maybeBuildEligibilityStampFields (also consumed by the §12 battery's
 * settle() mimic, so the battery can never certify a stale gate).
 * Pre-epoch-1 it writes nothing mastery-related (dark byte-identity). CPU
 * system agents are structurally outside mastery and are never stamped.
 *
 * Returns the transaction outcome ({committed, repaired?, reason?}) so the
 * expiry loop can count completions, races and vanished docs distinctly.
 * Exported for the P1 acceptance tests (mock-db precedent:
 * resolveCompletionDisposition / p4Flips.test.js).
 */
export async function completeBattle(db, battle, summary, masteryFlagView = DARK_FLAG_VIEW, masteryGroupCache = new Map(), masterySiblingsCache = new Map()) {
  const battleRef = db.collection('agentBattles').doc(battle.id);
  const now = new Date().toISOString();
  // Pre-computed ONCE so transaction retries reuse the same instant (a
  // retry must not shift vision timestamps).
  const visionTransitionTs = Timestamp.now();

  const txOutcome = await db.runTransaction(async (t) => {
    const snap = await t.get(battleRef);
    if (!snap.exists) return { committed: false, reason: 'missing' };
    const fresh = { id: battle.id, ...snap.data() };
    const isBareGcCompletion =
      fresh.status === 'completed' &&
      fresh.pendingReflection === undefined &&
      fresh.completionReason === 'expired';
    if (fresh.status !== 'active' && !isBareGcCompletion) {
      return { committed: false, reason: 'already_terminal' };
    }

    // B3 (adversarial ruling): the agent mutation is folded INTO this
    // transaction — the legacy sequential agentRef.get/update was
    // non-atomic since before P1 (pre-existing at base 39efa665,
    // agent-evaluate.js:3581→3592-3627); a crash between the battle commit
    // and the stats write could strand stats/activeBattleId forever.
    // Reads-before-writes: this get precedes every t.update below.
    // Delta review: a missing/corrupt agentId must NOT abort the completion
    // (legacy semantics: battle completes, stats skipped) — the exists:false
    // stub routes both stats branches to a clean no-op.
    // PR footnote: strictly-safer live-path change (patch flag-#4 precedent).
    const completionAgentId = fresh.agentId ?? battle.agentId;
    const agentRef = typeof completionAgentId === 'string' && completionAgentId.length > 0
      ? db.collection('agents').doc(completionAgentId)
      : null;
    const agentSnap = agentRef ? await t.get(agentRef) : { exists: false };

    const scoreState = fresh.scoreState || {};
    const currentScore = scoreState.currentScore || 0;
    const disposition = resolveCompletionDisposition(fresh);

    // ---- Vision retired transition (Spec A Phase 2a + fix-up) ----
    // Build the retired Vision (if applicable) so it can be written atomically
    // with status='completed'. The cron is the proximate writer; the schema
    // (visionTransitions.js) admits actor='cron' on battle_end -> retired
    // alongside 'sonnet' (reserved for future Sonnet-authored retirement
    // paths). Using 'cron' here distinguishes infrastructure-driven retirement
    // from AI-reasoning-driven retirement in the shadow log.
    let retiredVisionForWrite = null;
    let visionTransitionLogPayload = null;
    const prevVision = fresh?.vision ?? null;
    if (prevVision && prevVision.state !== 'retired') {
      const transitionTs = visionTransitionTs;
      const newEntry = {
        fromState: prevVision.state,
        toState: 'retired',
        timestamp: transitionTs,
        actor: 'cron',
        cause: 'battle_end',
      };
      const nextVision = {
        ...prevVision,
        state: 'retired',
        transitionHistory: [...(prevVision.transitionHistory || []), newEntry],
        lastTransitionAt: transitionTs,
      };
      const validation = validateTransition(prevVision, nextVision, 'cron', 'battle_end');
      if (validation.valid) {
        retiredVisionForWrite = nextVision;
        visionTransitionLogPayload = {
          battleId: battle.id,
          visionSnapshot: nextVision,
          transition: {
            fromState: prevVision.state,
            toState: 'retired',
            actor: 'cron',
            cause: 'battle_end',
            timestamp: transitionTs,
          },
          triggerContext: null,
          userInput: null,
        };
      } else {
        console.error(
          `${LOG_PREFIX} Vision retire validation failed for battle ${battle.id}:`,
          validation.errors.join('; ')
        );
        // Fall through: status='completed' still writes; Vision stays as-is.
      }
    }

    // Update battle status
    const existingFeed = fresh.statusFeed || [];
    const updatePayload = {
      status: 'completed',
      completedAt: now,
      // Sprint 1 fix: gate reflection on a queue flag so the dedicated
      // process-pending-reflections cron can pick it up on its own
      // maxDuration budget. Lands in the same atomic update as status.
      // P4: tournament CPU battles skip reflection (contract #5 passivity).
      pendingReflection: disposition.pendingReflection,
      reflectedAt: null,
      'cronState.evaluatingAt': null,
      statusFeed: [...existingFeed, {
        timestamp: now,
        message: disposition.statusMessage,
        action: 'battle_complete',
        source: 'system',
        score: Math.round(currentScore * 100) / 100,
      }].slice(-50),
    };
    // P4: the tournament terminal state is explicit — completed, context
    // stamped, no result semantics (founder scope addition, June 12).
    if (disposition.completionContext) {
      updatePayload.completionContext = disposition.completionContext;
    }
    // P2.6 (dark; §6.4): the terminal transaction stamps
    // receiptCoverage:'pending' for manifest battles — the post-commit
    // settlement writer flips it to 'complete'; a crash in between leaves
    // 'pending' as the retry marker, so absence-of-record is always
    // distinguishable from zero events. Flag off / pre-manifest: no field.
    if (SHADOW_ASSEMBLY_ENABLED && fresh.resolvedAgentManifest) {
      updatePayload.receiptCoverage = 'pending';
    }
    if (retiredVisionForWrite) {
      updatePayload.vision = retiredVisionForWrite;
    }

    let masteryStamped = false;
    let freshForAward = null;
    if (isBareGcCompletion) {
      // Repair in place: keep the GC's status flip and its earlier (honest)
      // completedAt; supply everything the bare fence-path write missed.
      // NO mastery stamp here — structurally outside (V2.1 STOP-A.2).
      delete updatePayload.status;
      delete updatePayload.completedAt;
      // Delta review (occlusion fix): re-tag the reason so the repaired doc
      // drops OUT of repairBareGcCompletions' bounded query SERVER-SIDE —
      // limit() applies before any in-memory filter, so repaired docs must
      // not keep matching or they occlude newer bare ones. completionReason
      // has exactly three consumers (the fenced decide.js writers, the
      // discriminator above, the Q11 query) — verified; provenance stays
      // legible and the discriminator gains a second independent half.
      updatePayload.completionReason = 'expired_repaired';
    } else {
      // ---- Mastery eligibility stamp (§5.1) — same transaction as the
      // status flip; the shared gate decides (epoch begun ∧ mastery subject
      // ∧ unstamped on THIS transaction's fresh read).
      const stampFields = maybeBuildEligibilityStampFields(fresh, masteryFlagView, now);
      if (Object.keys(stampFields).length > 0) {
        Object.assign(updatePayload, stampFields);
        masteryStamped = true;
        // The award's pre-read: this transaction's own fresh doc plus the
        // exact fields it is committing (no post-commit re-fetch needed).
        freshForAward = { ...fresh, status: 'completed', completedAt: now, ...stampFields };
      }
    }

    t.update(battleRef, updatePayload);

    // ---- Agent stats (server-side equivalent of client updateAgentStats),
    // atomic with the completion (B3). P4: tournament battles never mutate
    // career W/L/streak stats (group placement is the outcome; rank/RP is
    // P6's) — only the active-battle pointer clears so tomorrow's
    // prescribed deploy proceeds. Math is byte-identical to the legacy
    // block; only the write mechanism changed.
    const result = disposition.result;
    // Pointer guard (delta review, Q11 exposure): clear activeBattleId ONLY
    // while it still references THIS battle. The GC-repair sweep now reaches
    // old bare completions systematically, and decide.js re-points the agent
    // at its fresh deploy the moment it GCs — nulling unconditionally would
    // drop the battle lock (equip-bundle/change-archetype/equip-lean/dial
    // guards all key on the pointer) out from under a LIVE battle.
    const pointerCurrent = agentSnap.exists && agentSnap.data()?.activeBattleId === battle.id;
    if (agentSnap.exists && !disposition.updateAgentStats) {
      if (pointerCurrent) {
        t.update(agentRef, { activeBattleId: null });
      }
    } else if (agentSnap.exists) {
      const stats = agentSnap.data().stats || {};
      const newGamesPlayed = (stats.gamesPlayed || 0) + 1;
      const newWins = (stats.wins || 0) + (result === 'win' ? 1 : 0);
      const newLosses = (stats.losses || 0) + (result === 'loss' ? 1 : 0);
      const newDraws = (stats.draws || 0) + (result === 'draw' ? 1 : 0);
      const newTotalScore = (stats.totalScore || 0) + currentScore;
      const newAvgScore = Math.round(newTotalScore / newGamesPlayed);
      let newStreak = stats.currentStreak || 0;
      if (result === 'win') {
        newStreak = newStreak >= 0 ? newStreak + 1 : 1;
      } else if (result === 'loss') {
        newStreak = newStreak <= 0 ? newStreak - 1 : -1;
      } else {
        newStreak = 0; // draws reset streak
      }
      const newBestStreak = Math.max(stats.bestStreak || 0, Math.abs(newStreak));

      t.update(agentRef, {
        stats: {
          wins: newWins,
          losses: newLosses,
          draws: newDraws,
          gamesPlayed: newGamesPlayed,
          totalScore: Math.round(newTotalScore * 100) / 100,
          avgScore: newAvgScore,
          currentStreak: newStreak,
          bestStreak: newBestStreak,
        },
        ...(pointerCurrent ? { activeBattleId: null } : {}),
      });
    }

    return { committed: true, repaired: isBareGcCompletion, disposition, currentScore, visionTransitionLogPayload, masteryStamped, freshForAward };
  });

  // Sibling-cache coherence (ruling B4 + delta review): this battle is now
  // terminal — whether THIS writer committed it or a racer already had
  // ('already_terminal') — so drop the group's memoized sibling set; later
  // same-run awards (the rest of the expiry loop, the sweep) then observe
  // the terminal status and the cohort-terminality gate can clear within
  // one run even when a stolen-lock racer did the completing.
  if (
    (txOutcome.committed || txOutcome.reason === 'already_terminal') &&
    battle.gameMode === TOURNAMENT_GAME_MODE &&
    typeof battle.groupId === 'string'
  ) {
    masterySiblingsCache.delete(battle.groupId);
  }

  if (!txOutcome.committed) {
    // Another writer FULLY completed this battle first (stolen-lock cron
    // overlap) — the winner owns stats/logs; this path no-ops. Bare GC
    // completions never land here (they take the repair branch above).
    console.log(`${LOG_PREFIX} Battle ${battle.id} completion skipped (${txOutcome.reason}).`);
    return txOutcome;
  }
  const { disposition, visionTransitionLogPayload } = txOutcome;

  // Fire-and-forget shadow log of the retired transition (after Firestore write succeeds).
  if (visionTransitionLogPayload) {
    logVisionTransition(visionTransitionLogPayload).catch(() => {});
  }

  // Agent stats now commit INSIDE the completion transaction above (B3).

  // ---- Mastery award (§5.2) — its own transaction (write-once on
  // masteryAward absence + masteryProfiles increment together). XP computes
  // at completeBattle (spec §2.3); a crash between the completion stamp
  // above and this award is exactly what the §5.3 repair sweep repairs, so
  // failures here log and defer — never throw into the expiry loop. The
  // completion transaction's own fresh doc (+ the stamp it committed) is
  // the award's pre-read — no re-fetch. Eligibility rides the persisted
  // stamp, so no flag view is passed (§5.4: registry is not an oracle).
  if (txOutcome.masteryStamped) {
    try {
      await runAwardTransaction(db, battle.id, {
        nowIso: now,
        groupCache: masteryGroupCache,
        siblingsCache: masterySiblingsCache,
        preloadedBattle: txOutcome.freshForAward,
      });
    } catch (awardErr) {
      console.error(`${LOG_PREFIX} mastery award failed for battle ${battle.id} (repair sweep will retry): ${awardErr.message}`);
    }
  }

  // P2.6 (dark; §6.4): the battleSettlements/{battleId} record — attempted
  // post-commit on the runAwardTransaction precedent (awaited, failures
  // logged never thrown into the expiry loop; the module skips pre-manifest
  // battles and leaves receiptCoverage:'pending' on failure as the retry
  // marker). Uses the transaction's own fresh doc — no re-fetch.
  if (SHADOW_ASSEMBLY_ENABLED && txOutcome.disposition) {
    await writeBattleSettlementRecord(db, {
      freshBattle: { ...(txOutcome.freshForAward ?? battle), id: battle.id },
      completedAtIso: now,
      modelId: EVAL_MODEL_ID,
    });
  }

  console.log(`${LOG_PREFIX} Battle ${battle.id} ${txOutcome.repaired ? 'repaired (bare GC completion finished in place)' : 'completed'}. ${disposition.logLine}`);
  summary.evaluated++;
  return txOutcome;
}

/**
 * Bare GC-completion repair sweep (adversarial ruling Q11). The expiry loop
 * consumes findActiveAgentBattles (status=='active' — agentBattleService.js),
 * so a battle GC'd by the fenced decide.js expiry path (already 'completed',
 * bare 3-field write) can only reach completeBattle's repair branch through
 * the mid-run race window. This bounded query makes the repair reachable on
 * the normal cadence:
 *
 *   status=='completed' ∧ completionReason=='expired' ∧ completedAt within
 *   the trailing window (96h — covers the weekend gap in the Mon–Fri cron
 *   schedule), limit 25. Repaired docs drop out of the query SERVER-SIDE:
 *   the repair re-tags completionReason to 'expired_repaired' (delta-review
 *   occlusion fix — limit() applies before any in-memory filter, so
 *   still-matching repaired docs would occlude newer bare ones). The
 *   in-memory pendingReflection filter below is belt-and-braces for any
 *   pre-retag stragglers.
 *
 * Uses the (status, completionReason, completedAt) composite index added in
 * this pass. Repairs route through completeBattle itself (one §5.1 writer),
 * whose repair branch never stamps — V2.1 STOP-A.2. Exported for tests.
 */
export async function repairBareGcCompletions(db, summary, masteryFlagView = DARK_FLAG_VIEW, masteryGroupCache = new Map(), masterySiblingsCache = new Map(), { windowMs = 96 * 3600 * 1000, limit = 25 } = {}) {
  const sinceIso = new Date(Date.now() - windowMs).toISOString();
  const snap = await db
    .collection('agentBattles')
    .where('status', '==', 'completed')
    .where('completionReason', '==', 'expired')
    .where('completedAt', '>=', sinceIso)
    .limit(limit)
    .get();
  const counts = { scanned: 0, repaired: 0, errors: 0 };
  for (const doc of snap.docs) {
    counts.scanned += 1;
    const data = doc.data();
    if (data.pendingReflection !== undefined) continue; // already full or already repaired
    const gcBattle = { id: doc.id, ...data };
    try {
      const outcome = await completeBattle(db, gcBattle, summary, masteryFlagView, masteryGroupCache, masterySiblingsCache);
      if (outcome.committed) {
        counts.repaired += 1;
        // Same post-completion hook the expiry loop fires — AWAITED here
        // (delta review): a repair sweep has no latency budget to protect,
        // and unlike the expiry path no later event would regenerate a
        // pattern record dropped by a frozen serverless runtime.
        await logBattlePattern(gcBattle.agentId, gcBattle.id, gcBattle).catch(err => {
          console.error(`${LOG_PREFIX} Pattern logging failed for repaired battle ${gcBattle.id}:`, err.message);
        });
      }
    } catch (err) {
      counts.errors += 1;
      console.error(`${LOG_PREFIX} GC repair failed for battle ${gcBattle.id} (retried next run): ${err.message}`);
    }
  }
  return counts;
}
