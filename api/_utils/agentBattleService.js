// api/_utils/agentBattleService.js
// CRUD operations for the agentBattles collection.
// Agent battles are fully self-contained — they do NOT reference the battles collection.
//
// Required Firestore composite indexes (create in Firebase Console or auto-generated):
//   1. agentId ASC, status ASC  — one active battle per agent check
//   2. status ASC               — cron: find all active battles
//   3. ownerId ASC, createdAt DESC — dashboard: user's battle history

import { getETDate, formatDateString, isMarketHoliday, isEarlyCloseDay, getNextMarketClose } from './marketSchedule.js';

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
 * @param {Object} options - { duration: '1d'|'3d'|'5d', sectorMap: { symbol: sectorName } }
 * @returns {{ id: string }} Created document reference
 */
export async function createAgentBattle(db, agentData, thresholds, startingPrices, options = {}) {
  const sectorMap = options.sectorMap || {};
  const now = new Date().toISOString();
  const duration = options.duration || '1d';

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
    gameMode: 'baggerbomb_agent',
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
      star: deepCopyArrayWithSector(portfolio.star, sectorMap),
      core: deepCopyArrayWithSector(portfolio.core, sectorMap),
      support: deepCopyArrayWithSector(portfolio.support, sectorMap),
      // Note: crypto lives inside support[2] (isCrypto: true) — not a separate field.
      // See api/agent/decide.js:368 — support = [...support_stocks, support_crypto]
      bench: {
        stocks: deepCopyArrayWithSector(bench?.stocks, sectorMap),
        crypto: bench?.crypto ? { ...bench.crypto, sector: sectorMap[bench.crypto.symbol] || (bench.crypto.isCrypto ? 'Crypto' : 'Unknown') } : null,
      },
      startingPrices: { ...startingPrices },
    },

    scoring: {
      thresholds: { ...thresholds },
      tierMultipliers: { star: 2.0, core: 1.5, support: 1.0 },
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
      activeDirectives: filterActiveDirectives(agentData.directives || []),
      activeRules: agentData.activeRules || [],
      equippedBundleIds: agentData.equippedBundleIds || [],
      riskTolerance: agentData.config?.risk || 50,
      evaluationInterval: 15,
      consolidatedInsight: agentData.consolidatedInsight || null,
      // Frozen snapshot of the initial portfolio (Amendment 5)
      initialPortfolio: {
        star: deepCopyArrayWithSector(portfolio.star, sectorMap),
        core: deepCopyArrayWithSector(portfolio.core, sectorMap),
        support: deepCopyArrayWithSector(portfolio.support, sectorMap),
      },
    },

    trades: [],
    evaluations: [],
    statusFeed: [],

    // Execution mode controls (Sprint 3)
    executionMode: 'copilot',       // 'autopilot' | 'copilot' | 'manual'
    strategyPreset: 'balanced',     // 'aggressive' | 'balanced' | 'defensive' (Sprint 4)
    pendingProposal: null,          // Set when Haiku proposes a swap in copilot/manual mode
    proposalHistory: [],            // Resolved proposals (approved/vetoed/expired)
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
  return { id: docRef.id };
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

/**
 * Filter out expired directives.
 * Mirrors pattern from api/_utils/agentPromptAssembly.js:201-208
 */
function filterActiveDirectives(directives) {
  const now = Date.now();
  return (directives || []).filter(d => {
    if (!d.expiresAt) return true;
    return new Date(d.expiresAt).getTime() > now;
  });
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
