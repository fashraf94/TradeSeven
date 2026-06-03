/**
 * Vercel cron job: agentBattles daily badge-points banking + history reset
 *
 * Schedule: 45 1 * * 2-6 (UTC Tue-Sat 01:45 = ET Mon-Fri 8:45 PM)
 * Runs after V4 daily-scores (8:15 PM) and V4 daily-levels (8:30 PM).
 *
 * Per active agentBattle:
 *   1. Compute today's badge points by re-scoring portfolio against day-end baseline
 *   2. Bank bonusPoints to scoreState.bankedBadgePoints.total + breakdown[dayKey]
 *   3. Reset thresholdHistory.{symbol} = {maxMultiplier:0, minMultiplier:0, badges:[], dailyThresholds:{...archived}}
 *   4. Clear swapPrice + swappedInDay on all portfolio assets
 *   5. Write scoreState.dailyScores[dayKey] = {recorded:true, ...} for idempotency
 *   6. Bump timing.currentTradingDay
 *
 * CPU side is skipped — agentBattles.opponent has no bench, no swaps,
 * no thresholdHistory, and is frozen at startingPrices.
 *
 * Phase 2 of agent battle daily-reset arc. See FANTASYTRADES_AGENTIC_TRADING.
 */

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { findActiveAgentBattles } from '../_utils/agentBattleService.js';
import { getETDate, formatDateString, isTradingDay } from '../_utils/marketSchedule.js';
import { getStockAnalysisData } from '../_utils/marketDataCache.js';
import { resolveBadgeBaseline } from '../_utils/baselineValidation.js';
import {
  flattenPortfolioServer,
  calculateAssetScoreServer,
} from '../_utils/agentScoring.js';
import { getCurrentTradingDayServer } from '../_utils/agentEvalPromptAssembly.js';

function logInfo(msg, extra = {}) {
  console.log(`[agent-daily-scores] ${msg}`, extra);
}

function logError(msg, extra = {}) {
  console.error(`[agent-daily-scores] ${msg}`, extra);
}

/**
 * Bank one battle's daily badge points and reset thresholdHistory.
 * Returns {status: 'recorded' | 'skipped' | 'error', reason?}
 */
async function resetBattleDaily(db, battleDoc, currentPrices, dailyBySymbol = {}) {
  const battle = { id: battleDoc.id, ...battleDoc.data() };
  const battleId = battle.id;

  // Determine current trading day for this battle
  const tradingDays = battle.timing?.tradingDays || [];
  const currentDay = getCurrentTradingDayServer(tradingDays);
  const dayKey = `day${currentDay}`;

  // Idempotency check — already banked today?
  if (battle.scoreState?.dailyScores?.[dayKey]?.recorded) {
    return { status: 'skipped', reason: 'already_recorded' };
  }

  // ---- Activation-day gate (mirrors agent-evaluate.js Phase 1 logic) ----
  const todayET = formatDateString(getETDate());
  const activationDateET = battle.activatedAt
    ? formatDateString(new Date(new Date(battle.activatedAt).toLocaleString('en-US', { timeZone: 'America/New_York' })))
    : todayET;
  const isActivationDay = todayET === activationDateET;
  // Guard 2 cutoff for crypto (24/7, UTC-dated daily bars).
  const utcToday = new Date().toISOString().slice(0, 10);

  const startingPrices = battle.portfolio?.startingPrices || {};
  const flatPortfolio = flattenPortfolioServer(battle.portfolio);

  // ---- Compute today's badge points per asset ----
  let todayBadgePoints = 0;
  const todayBadgesByAsset = {};
  const resetHistory = {};

  // Existing thresholdHistory tracks symbols that may no longer be in
  // active portfolio (e.g., swapped out). Reset all of them.
  const oldHistory = battle.thresholdHistory || {};
  const allSymbols = new Set([
    ...flatPortfolio.map(a => a.symbol),
    ...Object.keys(oldHistory),
  ]);

  for (const asset of flatPortfolio) {
    const symbol = asset.symbol;
    const priceData = currentPrices[symbol];
    if (!priceData?.current) continue;

    const currentPrice = priceData.current;
    let previousClose = priceData.previousClose;
    const entryPrice = asset.swapPrice || startingPrices[symbol] || 0;
    if (entryPrice <= 0) continue;

    // Guard 2 (same rule as agent-evaluate): validate previousClose against the
    // prior-session close whenever it is the badge baseline (day 2+, or a day-1
    // asset whose startingPrice is missing).
    if (!asset.swapPrice && (!isActivationDay || !(startingPrices[symbol] > 0))) {
      const isCryptoAsset = asset.isCrypto === true || /\.CC$/i.test(symbol || '');
      const g2 = resolveBadgeBaseline({
        daily: dailyBySymbol[symbol],
        previousClose,
        isCrypto: isCryptoAsset,
        baseATR: asset.baseATR || (isCryptoAsset ? 5.0 : 2.5),
        etToday: todayET,
        utcToday,
      });
      if (g2.fired) {
        logInfo(`[guard2]${g2.corporateActionSuspected ? '[corp-action?]' : ''} ${symbol} previousClose=${previousClose} (${g2.reason}); ${g2.value === previousClose ? 'accepted+flagged' : `substituted ${g2.value}`}`);
      }
      previousClose = g2.value;
    }

    const priceChange = ((currentPrice - entryPrice) / entryPrice) * 100;
    const thresholdBaseline = asset.swapPrice
      || (isActivationDay ? (startingPrices[symbol] || previousClose) : previousClose);
    const thresholdPriceChange = thresholdBaseline && thresholdBaseline > 0
      ? ((currentPrice - thresholdBaseline) / thresholdBaseline) * 100
      : null;

    const assetHistory = oldHistory[symbol] || { maxMultiplier: 0, minMultiplier: 0 };

    const score = calculateAssetScoreServer(
      asset,
      priceChange,
      assetHistory,
      {},  // extremes — daily reset uses live history only
      thresholdPriceChange,
    );

    todayBadgePoints += score.bonusPoints || 0;
    if (score.badges && score.badges.length > 0) {
      todayBadgesByAsset[symbol] = score.badges;
    }
  }

  // ---- Reset thresholdHistory for ALL tracked symbols (portfolio + stale) ----
  for (const symbol of allSymbols) {
    const old = oldHistory[symbol] || { maxMultiplier: 0, minMultiplier: 0, dailyThresholds: {} };
    resetHistory[symbol] = {
      maxMultiplier: 0,
      minMultiplier: 0,
      badges: [],
      dailyThresholds: {
        ...(old.dailyThresholds || {}),
        [dayKey]: {
          maxMultiplier: old.maxMultiplier || 0,
          minMultiplier: old.minMultiplier || 0,
        },
      },
    };
  }

  // ---- Clear swapPrice + swappedInDay on portfolio assets ----
  // Mirror V4's guard: only clear swaps that happened on or before today
  // (defensive against any race with concurrent evaluator runs).
  const nextDay = currentDay + 1;
  const updatedPortfolio = JSON.parse(JSON.stringify(battle.portfolio || {}));
  for (const tier of ['star', 'core', 'support']) {
    const tierAssets = updatedPortfolio[tier] || [];
    for (let i = 0; i < tierAssets.length; i++) {
      const asset = tierAssets[i];
      if (asset && asset.swapPrice && (asset.swappedInDay || 0) < nextDay) {
        asset.previousSwapPrice = asset.swapPrice;
        asset.previousSwapDay = asset.swappedInDay;
        delete asset.swapPrice;
        delete asset.swappedInDay;
      }
    }
  }

  // ---- Build the Firestore update ----
  const recordedAt = new Date().toISOString();
  const updates = {
    thresholdHistory: resetHistory,
    portfolio: updatedPortfolio,
    [`scoreState.bankedBadgePoints.total`]: FieldValue.increment(todayBadgePoints),
    [`scoreState.bankedBadgePoints.breakdown.${dayKey}`]: {
      points: todayBadgePoints,
      badges: todayBadgesByAsset,
      recordedAt,
    },
    [`scoreState.dailyScores.${dayKey}`]: {
      badgePoints: todayBadgePoints,
      recorded: true,
      recordedAt,
      recordedBy: 'cron',
    },
    'timing.currentTradingDay': nextDay,
    'timing.lastDailyResetAt': recordedAt,
    updatedAt: recordedAt,
  };

  const battleRef = db.collection('agentBattles').doc(battleId);
  await battleRef.update(updates);

  logInfo(`Reset complete for ${battleId}`, {
    dayKey,
    symbolsReset: allSymbols.size,
    badgePointsBanked: todayBadgePoints,
  });

  return { status: 'recorded', dayKey, badgePointsBanked: todayBadgePoints };
}

/**
 * Cron entry point.
 */
export default async function handler(req, res) {
  // --- Auth ---
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  logInfo('Starting agent-daily-scores cron job');

  if (!isTradingDay()) {
    logInfo('Skipping - not a trading day');
    return res.status(200).json({
      success: true,
      message: 'Skipped - market closed',
      processed: 0,
    });
  }

  try {
    const db = getFirebaseAdmin();
    const battles = await findActiveAgentBattles(db);
    logInfo(`Found ${battles.length} active agent battles`);

    if (battles.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No active agent battles',
        processed: 0,
      });
    }

    // ---- Collect all unique portfolio symbols across all battles ----
    const allSymbols = new Set();
    for (const battle of battles) {
      const flat = flattenPortfolioServer(battle.portfolio);
      flat.forEach(a => allSymbols.add(a.symbol));
    }

    // ---- Fetch prices ----
    const symbolList = Array.from(allSymbols);
    logInfo(`Fetching prices for ${symbolList.length} unique symbols`);
    const currentPrices = {};
    // Guard 2: keep the daily series (already fetched) as the independent
    // reference for the prior-session close. In-memory only — never persisted.
    const dailyBySymbol = {};
    for (const symbol of symbolList) {
      try {
        const data = await getStockAnalysisData(symbol, {
          forceRefresh: true,
          fields: ['daily', 'price'],
        });
        if (data?.price) currentPrices[symbol] = data.price;
        if (Array.isArray(data?.daily)) dailyBySymbol[symbol] = data.daily;
      } catch (err) {
        logError(`Failed to fetch price for ${symbol}`, { error: err.message });
      }
    }

    if (Object.keys(currentPrices).length === 0) {
      logError('Failed to fetch any prices');
      return res.status(500).json({ success: false, error: 'Failed to fetch prices' });
    }

    // ---- Process each battle ----
    const results = { processed: 0, skipped: 0, errors: 0 };

    // findActiveAgentBattles returns plain objects, not DocumentSnapshots.
    // We need DocumentSnapshots to pass to resetBattleDaily for the .id field,
    // so reuse the data shape via a synthetic { id, data() } adapter.
    for (const battle of battles) {
      const battleDoc = {
        id: battle.id,
        data: () => {
          const { id, ...rest } = battle;
          return rest;
        },
      };
      try {
        const result = await resetBattleDaily(db, battleDoc, currentPrices, dailyBySymbol);
        if (result.status === 'recorded') {
          results.processed++;
        } else {
          results.skipped++;
        }
      } catch (error) {
        logError(`Error processing battle ${battle.id}`, { error: error.message, stack: error.stack });
        results.errors++;
      }
    }

    const duration = Date.now() - startTime;
    logInfo('Cron job complete', { ...results, durationMs: duration });

    return res.status(200).json({ success: true, ...results, durationMs: duration });

  } catch (error) {
    logError('Cron job failed', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, error: error.message });
  }
}
