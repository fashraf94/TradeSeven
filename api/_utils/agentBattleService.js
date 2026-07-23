// api/_utils/agentBattleService.js
// CRUD operations for the agentBattles collection.
// Agent battles are fully self-contained — they do NOT reference the battles collection.
//
// Required Firestore composite indexes (create in Firebase Console or auto-generated):
//   1. agentId ASC, status ASC  — one active battle per agent check
//   2. status ASC               — cron: find all active battles
//   3. ownerId ASC, createdAt DESC — dashboard: user's battle history

import { getETDate, formatDateString, isMarketHoliday, isEarlyCloseDay, getNextMarketClose } from './marketSchedule.js';
// P4 mode config (founder ruling D1) — Node-clean src import under the revised
// June 2026 import rule (BUILD_RULES §4); the P4 battery's import of this
// module is the dependency-surface guard.
import { resolveModeConfig, TIERED_GAME_MODE } from '../../src/constants/agentGameModes.js';
// Release 2 PR-a (fenced site 1) — the customization-snapshot builder from
// the SAME lean-revalidation kernel the strategy prompt and the
// change-archetype rider use, so the snapshot can never disagree with them.
// The logic lives in the non-fenced module so future tweaks are ordinary
// changes, never fence re-authorizations (its graph is Node-clean).
import { buildCustomizationSnapshot } from './leanRevalidation.js';
// Archetype Phase 2 P2.5 (§7-signed fence contact): the ResolvedAgentManifest
// block, born in this single creation write adjacent to agentContext (DR-6;
// create-only-after-start by construction — no updater exists). The builder
// is the NON-FENCED kernel (the buildCustomizationSnapshot precedent). DARK
// while MANIFEST_WRITE_ENABLED=false — the battle doc is byte-identical to
// before (the P4 equivalence battery is the lock).
import { MANIFEST_WRITE_ENABLED } from '../../src/config/featureFlags.js';
import { buildResolvedAgentManifest } from './resolvedAgentManifest.js';

// Duration mode: 'fullday' = single trading day (until market close), 'legacy' = multi-day (1d/3d/5d)
const AGENT_BATTLE_DURATION_MODE = 'fullday';
const CRYPTO_EXTENDED_CLOSE_HOUR = 20; // 8:00 PM ET (Night Game session end)

// ==================== QUERY ====================

/**
 * Find all active agent battles.
 */
export async function findActiveAgentBattles(db) {
  const snapshot = await db
    .collection('agentBattles')
    .where('status', '==', 'active')
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ==================== CREATE ====================

/**
 * Create a new agent battle document.
 *
 * @param {Object} db - Firestore admin instance
 * @param {Object} agentData - Full agent document (from agents collection)
 * @param {Object} thresholds - { symbol: { threshold, rallyThreshold, moonshotThreshold } }
 * @param {Object} startingPrices - { symbol: currentPrice }
 * @param {Object} options - { duration: '1d'|'3d'|'5d', sectorMap: { symbol: sectorName },
 *   gameMode?, groupId?, isCpu?, tournament? } — the P4 tournament intake
 *   (contracts #1/#4/#5 + rider #6). Defaults reproduce today's tiered doc
 *   byte-for-byte (battery photograph).
 * @returns {{ id: string }} Created document reference
 */
export async function createAgentBattle(db, agentData, thresholds, startingPrices, options = {}) {
  const sectorMap = options.sectorMap || {};
  const now = new Date().toISOString();
  const duration = options.duration || '1d';

  // P4: mode resolution. Unknown modes fail LOUD — a battle doc must never
  // record a gameMode the engine can't resolve.
  const gameMode = options.gameMode || TIERED_GAME_MODE;
  const modeConfig = resolveModeConfig(gameMode);
  if (modeConfig.gameMode !== gameMode) {
    throw new Error(`createAgentBattle: unknown gameMode '${gameMode}'`);
  }
  const isTournament = modeConfig.flatMultiplier != null;
  // Joint-stamp contract (founder ruling B3): gameMode and groupId land
  // together or not at all — the eval resolver treats a half stamp as
  // malformed, so creating one is a hard error here.
  if (isTournament && (typeof options.groupId !== 'string' || options.groupId.length === 0)) {
    throw new Error('createAgentBattle: tournament battles require groupId (joint-stamp contract)');
  }

  // P4 flat6 (founder ruling D2): stamp the mode's flat multiplier per asset —
  // the scorers' override expression honors it. Tiered mode stamps nothing
  // (identity), so existing docs are byte-identical.
  const stampMode = (arr) => (modeConfig.flatMultiplier == null
    ? arr
    : arr.map(a => (a ? { ...a, tierMultiplier: modeConfig.flatMultiplier } : a)));

  const portfolio = agentData.lastDecision?.portfolio;
  const bench = agentData.lastDecision?.bench;

  if (!portfolio) {
    throw new Error('Agent has no lastDecision.portfolio — run decide endpoint first');
  }

  // Compute trading days and expiry based on duration mode
  let tradingDays, expiresAt, localClose;

  if (AGENT_BATTLE_DURATION_MODE === 'fullday') {
    const fullDay = computeFullDayExpiry(portfolio);
    tradingDays = [fullDay.targetDateStr];
    expiresAt = fullDay.expiresAt;
    localClose = `${String(fullDay.effectiveCloseHour).padStart(2, '0')}:00`;
  } else {
    // Legacy multi-day mode
    tradingDays = computeTradingDays(duration);
    expiresAt = computeExpiry(tradingDays);
    localClose = '16:00';
  }

  const battleDoc = {
    agentId: agentData.id,
    ownerId: agentData.ownerId,
    status: 'active',
    gameMode,
    // P4 contracts #4/#5: the joint tournament stamp + the CPU/passive marker
    // (stamped at deploy — tournamentCpu.js records the ruling). Tiered docs
    // carry neither key.
    ...(isTournament ? { groupId: options.groupId, ...(options.isCpu === true ? { isCpu: true } : {}) } : {}),
    duration: AGENT_BATTLE_DURATION_MODE === 'fullday' ? 'fullday' : duration,
    createdAt: now,
    activatedAt: now,
    completedAt: null,
    expiresAt,
    updatedAt: now,

    timing: {
      tradingDays,
      currentTradingDay: 1,
      timezone: 'America/New_York',
      localOpen: '09:30',
      localClose,
      lastDailyResetAt: null,
    },

    portfolio: {
      star: stampMode(deepCopyArrayWithSector(portfolio.star, sectorMap)),
      core: stampMode(deepCopyArrayWithSector(portfolio.core, sectorMap)),
      support: stampMode(deepCopyArrayWithSector(portfolio.support, sectorMap)),
      // Note: crypto lives inside support[2] (isCrypto: true) — not a separate field.
      // See api/agent/decide.js:368 — support = [...support_stocks, support_crypto]
      bench: {
        stocks: deepCopyArrayWithSector(bench?.stocks, sectorMap),
        crypto: bench?.crypto ? { ...bench.crypto, sector: sectorMap[bench.crypto.symbol] || (bench.crypto.isCrypto ? 'Crypto' : 'Unknown') } : null,
      },
      startingPrices: { ...startingPrices },
    },

    opponent: options.opponent || null,

    scoring: {
      thresholds: { ...thresholds },
      // Written-never-read snapshot (June 10 audit; founder ruling D1: the
      // dead doc config STAYS dead) — now an honest per-mode record. Tiered
      // values are byte-identical to the pre-P4 literals.
      tierMultipliers: { ...modeConfig.scoringSnapshotTierMultipliers },
      pointValues: {
        bagger: 15, doubleBagger: 30, tenBagger: 50,
        bust: -10, crash: -20, meltdown: -35,
      },
    },

    agentContext: {
      agentName: agentData.name || 'Agent',
      archetype: agentData.archetype || 'unknown',
      strategyBrief: agentData.lastDecision?.strategyBrief || '',
      innerMonologue: agentData.lastDecision?.innerMonologue || {},
      activeRules: agentData.activeRules || [],
      equippedBundleIds: agentData.equippedBundleIds || [],
      // Phase 4B: Snapshot of deployed strategy guardrails. Frozen at battle
      // creation so mid-battle re-deploys don't whiplash live execution.
      deployedGuardrails: Array.isArray(agentData.deployedStrategy?.guardrails)
        ? agentData.deployedStrategy.guardrails
        : [],
      // Phase 5B1: Frozen snapshot of the equipped watchlist (mirrors the
      // deployedGuardrails precedent). decide.js passes {watchlistId, name,
      // tickers} via options; snapshotAt is stamped here so it reads as
      // "frozen at battle start" — mid-battle watchlist edits/deletes don't
      // affect the running battle.
      equippedWatchlist: options.equippedWatchlist
        ? { ...options.equippedWatchlist, snapshotAt: now }
        : null,
      // Release 2 PR-a (fenced site 1, SHA-bound authorization @ 4a0f43e) —
      // the four ADDITIVE customization-snapshot keys (standingLeans
      // post-revalidation, standingLeansInvalidated, dials, settingsRev),
      // frozen at creation like every sibling snapshot. Nothing renders from
      // them until the Release-4 staged flag walk (the PR-c read-side guard
      // gates rendering); the builder + its [LeanRevalidation] event live in
      // the non-fenced kernel (see the import note above).
      ...buildCustomizationSnapshot(agentData, now),
      riskTolerance: agentData.config?.risk || 50,
      evaluationInterval: 15,
      consolidatedInsight: agentData.consolidatedInsight || null,
      // P4 rider #6 (deploy-time half, founder ruling D10): the USER PICKS
      // reaction at deploy — awaited by construction (it rides this single
      // creation write; Amendment-A pattern A) and writer-readable straight
      // off the battle doc (P5 playback, P6 feeds, Voice Layer), mirroring
      // the board-time half's userPicksAtBoardTime rationale.
      ...(isTournament && options.tournament ? {
        tournament: {
          userPicksStance: options.tournament.userPicksStance || [],
          doubleDownSymbols: options.tournament.doubleDownSymbols || [],
          userPicksAtDeploy: options.tournament.userPicksAtDeploy || [],
        },
      } : {}),
      // Frozen snapshot of the initial portfolio (Amendment 5)
      initialPortfolio: {
        star: stampMode(deepCopyArrayWithSector(portfolio.star, sectorMap)),
        core: stampMode(deepCopyArrayWithSector(portfolio.core, sectorMap)),
        support: stampMode(deepCopyArrayWithSector(portfolio.support, sectorMap)),
      },
    },

    // P2.5 (§7-signed): the manifest block, adjacent to agentContext (DR-6).
    // Frozen at creation like every sibling snapshot; zero readers in
    // Phase 2 (agentContext remains the runtime authority). Absent entirely
    // while the flag is false — byte-identity holds.
    ...(MANIFEST_WRITE_ENABLED ? {
      resolvedAgentManifest: buildResolvedAgentManifest({
        agentData,
        compiledBuild: options.compiledBuild ?? null,
        equippedWatchlist: options.equippedWatchlist ?? null,
        gameMode,
        now,
      }),
    } : {}),

    trades: [],
    evaluations: [],
    statusFeed: [],

    // Execution mode controls (Sprint 3)
    // LAUNCH DECISION (2026-05-19): Auto-pilot only. Co-pilot and manual modes are
    // deferred post-launch. See AUTHORITY_MODE_POST_LAUNCH_BACKLOG.md for context.
    // Do not change this default without revisiting that decision.
    executionMode: 'autopilot',     // 'autopilot' | 'copilot' | 'manual'
    strategyPreset: 'balanced',     // 'aggressive' | 'balanced' | 'defensive' (Sprint 4)
    pendingProposal: null,          // Set when Haiku proposes a swap in copilot/manual mode
    proposalHistory: [],            // Resolved proposals (approved/vetoed/lapsed/auto_executed)
    battleLedger: [],               // All user-agent interactions for Film Room review
    gameplanMeeting: null,          // Active gameplan meeting (Sprint 4)
    gameplanMeetingHistory: [],     // Resolved gameplan meetings
    chatExchanges: [],              // Open chat history (Sprint 6)
    chatBudgetUsed: 0,              // Chat exchanges used this battle

    // Watchlist: tiered stock tracking for open universe trading (Phase 0)
    watchlist: agentData.lastDecision?.watchlist || {
      active: [],
      hotBench: [],
      monitoring: [],
      lastRefreshed: null,
      totalStocks: 0,
    },

    scoreState: {
      currentScore: 0,
      activeScore: 0,
      bankedScore: 0,
      dailyScores: {},
      bankedBadgePoints: { total: 0, breakdown: {} },
      tradeCount: 0,
      holdCount: 0,
      evaluationCount: 0,
      lastScoredAt: null,
      peakScore: 0,
      peakScoreAt: null,
    },

    thresholdHistory: {},

    cronState: {
      lastEvaluatedAt: null,
      lastTriggeredAt: null,
      triggerGatePassCount: 0,
      totalHaikuCalls: 0,
      totalTokens: { input: 0, output: 0 },
      consecutiveHolds: 0,
      cronErrors: [],
      evaluatingAt: null,
    },
  };

  const docRef = await db.collection('agentBattles').add(battleDoc);
  return { id: docRef.id, expiresAt };
}

// ==================== HELPERS ====================

/**
 * Compute trading day date strings, skipping weekends and holidays.
 */
function computeTradingDays(duration) {
  const dayCount = duration === '1d' ? 1 : duration === '5d' ? 5 : 3;
  const days = [];
  const etNow = getETDate();

  // Start from today if market hasn't closed, otherwise tomorrow
  let candidate = new Date(etNow);

  for (let attempts = 0; days.length < dayCount && attempts < 30; attempts++) {
    const dateStr = formatDateString(candidate);
    const dayOfWeek = candidate.getDay();

    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isMarketHoliday(dateStr)) {
      days.push(dateStr);
    }

    candidate.setDate(candidate.getDate() + 1);
  }

  return days;
}

/**
 * Compute battle expiry: 4:00 PM ET (market close) on the last trading day.
 * Returns a UTC ISO string. Handles DST correctly by computing the ET→UTC offset
 * dynamically for the specific date (EDT = UTC-4, EST = UTC-5).
 */
function computeExpiry(tradingDays) {
  if (!tradingDays.length) return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const lastDay = tradingDays[tradingDays.length - 1];
  // To find the UTC equivalent of 16:00 ET on lastDay:
  // 1. Create a known UTC reference point on that date
  // 2. Convert it to ET to measure the offset
  // 3. Apply the offset to 16:00 ET to get correct UTC
  const refUTC = new Date(`${lastDay}T12:00:00Z`);
  const refETStr = refUTC.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const refET = new Date(refETStr);
  // etOffsetMs = how much to ADD to ET local time to get UTC
  // e.g., EDT (UTC-4): refUTC=12:00Z, refET reads as 8:00 local → offset = 12:00Z - 8:00 = +4h
  // e.g., EST (UTC-5): refUTC=12:00Z, refET reads as 7:00 local → offset = 12:00Z - 7:00 = +5h
  const etOffsetMs = refUTC.getTime() - refET.getTime();
  // 16:00 ET in UTC = parse "16:00" as if UTC, then add the ET offset
  const closeAsUTC = new Date(`${lastDay}T16:00:00Z`);
  const closeUTC = new Date(closeAsUTC.getTime() + etOffsetMs);
  return closeUTC.toISOString();
}

/**
 * Check if any asset in the portfolio has isCrypto: true.
 * Crypto lives inside support[2] (isCrypto: true) — see api/agent/decide.js:368.
 */
function hasCryptoInPortfolio(portfolio) {
  if (!portfolio) return false;
  const allSlots = [...(portfolio.star || []), ...(portfolio.core || []), ...(portfolio.support || [])];
  return allSlots.some(slot => slot?.isCrypto === true);
}

/**
 * Compute expiry for a full trading day battle.
 * - Stocks only: expires at 4:00 PM ET (or 1:00 PM on early close days)
 * - With crypto: expires at 8:00 PM ET (Night Game end), except early close days
 * - If created outside market hours: targets the next trading day's close
 *
 * Uses the same DST-safe ET→UTC conversion pattern as computeExpiry().
 */
function computeFullDayExpiry(portfolio) {
  const hasCrypto = hasCryptoInPortfolio(portfolio);
  const closeET = getNextMarketClose({ cryptoExtended: hasCrypto });
  const targetDateStr = formatDateString(closeET);
  const effectiveCloseHour = closeET.getHours();

  // Convert ET close time to UTC using DST-safe offset computation
  const refUTC = new Date(`${targetDateStr}T12:00:00Z`);
  const refETStr = refUTC.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const refET = new Date(refETStr);
  const etOffsetMs = refUTC.getTime() - refET.getTime();
  const closeAsUTC = new Date(`${targetDateStr}T${String(effectiveCloseHour).padStart(2, '0')}:00:00Z`);
  const closeUTC = new Date(closeAsUTC.getTime() + etOffsetMs);

  return { expiresAt: closeUTC.toISOString(), targetDateStr, effectiveCloseHour };
}

function deepCopyArray(arr) {
  if (!arr) return [];
  return arr.map(item => item ? { ...item } : null);
}

function deepCopyArrayWithSector(arr, sectorMap) {
  if (!arr) return [];
  return arr.map(item => {
    if (!item) return null;
    const sector = sectorMap[item.symbol] || (item.isCrypto ? 'Crypto' : 'Unknown');
    return { ...item, sector };
  });
}
