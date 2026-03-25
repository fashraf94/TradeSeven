// api/_utils/agentBattleService.js
// CRUD operations for the agentBattles collection.
// Agent battles are fully self-contained — they do NOT reference the battles collection.

import { getETDate, formatDateString, isMarketHoliday } from './marketSchedule.js';

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
 * @param {Object} options - { duration: '1d'|'3d'|'5d' }
 * @returns {{ id: string }} Created document reference
 */
export async function createAgentBattle(db, agentData, thresholds, startingPrices, options = {}) {
  const now = new Date().toISOString();
  const duration = options.duration || '3d';
  const tradingDays = computeTradingDays(duration);

  const portfolio = agentData.lastDecision?.portfolio;
  const bench = agentData.lastDecision?.bench;

  if (!portfolio) {
    throw new Error('Agent has no lastDecision.portfolio — run decide endpoint first');
  }

  const battleDoc = {
    agentId: agentData.id,
    ownerId: agentData.ownerId,
    status: 'active',
    gameMode: 'baggerbomb_agent',
    duration,
    createdAt: now,
    activatedAt: now,
    completedAt: null,
    expiresAt: computeExpiry(tradingDays),
    updatedAt: now,

    timing: {
      tradingDays,
      currentTradingDay: 1,
      timezone: 'America/New_York',
      localOpen: '09:30',
      localClose: '16:00',
      lastDailyResetAt: null,
    },

    portfolio: {
      star: deepCopyArray(portfolio.star),
      core: deepCopyArray(portfolio.core),
      support: deepCopyArray(portfolio.support),
      // Note: crypto lives inside support[2] (isCrypto: true) — not a separate field.
      // See api/agent/decide.js:368 — support = [...support_stocks, support_crypto]
      bench: {
        stocks: deepCopyArray(bench?.stocks),
        crypto: bench?.crypto ? { ...bench.crypto } : null,
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
      riskTolerance: agentData.config?.risk || 50,
      evaluationInterval: 15,
      consolidatedInsight: agentData.consolidatedInsight || null,
      // Frozen snapshot of the initial portfolio (Amendment 5)
      initialPortfolio: {
        star: deepCopyArray(portfolio.star),
        core: deepCopyArray(portfolio.core),
        support: deepCopyArray(portfolio.support),
      },
    },

    trades: [],
    evaluations: [],

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
 * Compute battle expiry: 8 PM ET on the last trading day.
 */
function computeExpiry(tradingDays) {
  if (!tradingDays.length) return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const lastDay = tradingDays[tradingDays.length - 1];
  // Approximate: last trading day + 20:00 ET
  // Use ET offset to avoid DST issues
  const [year, month, day] = lastDay.split('-').map(Number);
  const expiryET = new Date(year, month - 1, day, 20, 0, 0);
  return expiryET.toISOString();
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
