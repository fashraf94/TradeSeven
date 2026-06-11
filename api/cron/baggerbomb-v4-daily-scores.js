// api/cron/baggerbomb-v4-daily-scores.js
// Banks daily scores for all active V4 BaggerBomb battles
// Called by Vercel cron at 01:15 UTC Tue-Sat — Mon-Fri 8:15 PM ET during EST,
// 9:15 PM ET during EDT; after the daily end either way.
//
// Schedule: 15 1 * * 2-6 (vercel.json cron schedules are UTC)
//
// This cron job serves as a BACKUP to client-side recording:
//   - Primary: Client detects daily end (8 PM ET) and banks via dailyScoringV4Service
//   - Backup: This cron ensures scores are banked even if no clients are online
//
// Scoring is sourced from the canonical scorer (calculateAssetScoreV3 in
// src/utils/baggerBombUtils.js) — the same function the client-side primary
// banker uses — so cron-banked days match client-banked days by construction.
// Threshold baseline mirrors the primary: day-open price (V4 is cumulative).
//
// The recording is IDEMPOTENT - safe to run multiple times:
//   - Already recorded days are skipped via the `recorded` flag
//   - Training battles are skipped

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldPath, FieldValue } from 'firebase-admin/firestore';
import { isTradingDay } from '../_utils/marketSchedule.js';
import { calculateAssetScoreV3 } from '../../src/utils/baggerBombUtils.js';

const LOG_PREFIX = '[BaggerBombV4Cron]';

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const prefix = `${timestamp} ${LOG_PREFIX}`;
  if (data) {
    console[level](`${prefix} ${message}`, JSON.stringify(data, null, 2));
  } else {
    console[level](`${prefix} ${message}`);
  }
}

const logInfo = (message, data) => log('log', message, data);
const logWarn = (message, data) => log('warn', message, data);
const logError = (message, data) => log('error', message, data);

// Initialize Firebase Admin (server-side)
function getFirebaseAdmin() {
  if (getApps().length === 0) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

function getEasternTime() {
  const now = new Date();
  const etString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  return new Date(etString);
}

function formatDateStr(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Determine current trading day from tradingDayDates array
function getCurrentTradingDayV4(tradingDayDates) {
  if (!tradingDayDates || tradingDayDates.length === 0) return 1;
  const et = getEasternTime();
  const today = formatDateStr(et);
  const index = tradingDayDates.indexOf(today);
  if (index >= 0) return index + 1;
  if (today < tradingDayDates[0]) return 0;
  if (today > tradingDayDates[tradingDayDates.length - 1]) return tradingDayDates.length + 1;
  for (let i = 0; i < tradingDayDates.length; i++) {
    if (today < tradingDayDates[i]) return i + 1;
  }
  return tradingDayDates.length;
}

// Flatten portfolio tiers into a flat array with tier/slot metadata
function flattenPortfolio(portfolio) {
  if (!portfolio) return [];
  const flat = [];
  for (const tier of ['star', 'core', 'support']) {
    (portfolio[tier] || []).forEach((asset, index) => {
      if (asset) flat.push({ ...asset, tier, slotIndex: index });
    });
  }
  return flat;
}

// Fetch stock prices from EODHD API
async function fetchStockPrices(symbols) {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) {
    logError('EODHD_API_KEY not configured');
    return {};
  }

  const prices = {};
  try {
    const symbolList = symbols.join(',');
    const url = `https://eodhd.com/api/real-time/${symbolList}?api_token=${apiKey}&fmt=json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`EODHD API error: ${response.status}`);

    const data = await response.json();
    const priceArray = Array.isArray(data) ? data : [data];

    for (const item of priceArray) {
      if (item.code && item.close) {
        prices[item.code.toUpperCase()] = item.close;
      }
    }
    logInfo(`Fetched prices for ${Object.keys(prices).length} symbols`);
  } catch (error) {
    logError('Error fetching stock prices', { error: error.message });
  }
  return prices;
}

// Bank a single battle's daily scores
// Exported for unit tests (canonical-scorer parity fixtures).
export async function bankBattleScores(db, battleDoc, currentPrices) {
  const battleId = battleDoc.id;
  const data = battleDoc.data();

  const tradingDayDates = data.timing?.tradingDayDates || [];
  const currentDay = getCurrentTradingDayV4(tradingDayDates);
  const totalDays = data.timing?.tradingDays || 3;
  const dayKey = `day${currentDay}`;

  if (currentDay < 1 || currentDay > totalDays) {
    return { status: 'skipped', reason: 'invalid_day' };
  }

  // Idempotency check
  if (data.state?.dailyScores?.[dayKey]?.recorded) {
    return { status: 'skipped', reason: 'already_recorded' };
  }

  const openPrices = data.state?.dailyOpenPrices?.[dayKey] || data.state?.startingPrices || {};
  if (Object.keys(openPrices).length === 0) {
    logWarn(`Battle ${battleId}: No open prices for day ${currentDay}`);
    return { status: 'skipped', reason: 'no_open_prices' };
  }

  const thresholds = data.thresholds || {};
  const updates = {};
  const dayScoreData = {};

  for (const role of ['creator', 'opponent']) {
    const player = data[role];
    if (!player?.portfolio) continue;

    const history = player.history || {};
    const flat = flattenPortfolio(player.portfolio);

    let totalActive = 0;
    const assetScores = [];
    const capturedClosing = {};

    for (const asset of flat) {
      const entryPrice = asset.swapPrice || openPrices[asset.symbol] || 0;
      const closePrice = currentPrices[asset.symbol] || entryPrice;
      capturedClosing[asset.symbol] = closePrice;

      if (entryPrice > 0) {
        const priceChange = ((closePrice - entryPrice) / entryPrice) * 100;
        const assetHistory = history[asset.symbol] || { maxMultiplier: 0, minMultiplier: 0 };
        const baseATR = thresholds[asset.symbol]?.threshold || asset.baseATR || 2.5;

        // Threshold baseline mirrors the client-side primary banker
        // (dailyScoringV4Service.js bankDailyScores → calculatePlayerActiveScore):
        // V4 scoring is cumulative — baseline = day-open price, not previous close.
        const prevClose = openPrices[asset.symbol] || entryPrice;
        const thresholdPriceChange = prevClose > 0
          ? ((closePrice - prevClose) / prevClose) * 100
          : null;

        const score = calculateAssetScoreV3(
          { ...asset, baseATR },
          priceChange,
          assetHistory,
          {}, // no extremes in daily scoring (matches the client banker)
          thresholdPriceChange
        );
        totalActive += score.totalPoints;
        // Preserve the banked per-asset shape this cron has always written;
        // priceChange stays the raw price move (the points carry direction).
        assetScores.push({
          symbol: score.symbol,
          tier: asset.tier,
          basePoints: score.basePoints,
          bonusPoints: score.bonusPoints,
          totalPoints: score.totalPoints,
          priceChange: Math.round(priceChange * 100) / 100,
          badges: score.badges,
        });
      }
    }

    dayScoreData[role] = {
      activeScore: Math.round(totalActive * 100) / 100,
      closingPrices: capturedClosing,
      assetScores,
    };

    // Extract badge points for the bankedBadgePoints accumulator
    let badgePointsToday = 0;
    const perAssetBadges = {};
    for (const s of assetScores) {
      if (s.badges && s.badges.length > 0) {
        perAssetBadges[s.symbol] = s.badges;
        badgePointsToday += s.bonusPoints || 0;
      }
    }
    updates[`state.bankedBadgePoints.${role}.total`] = FieldValue.increment(badgePointsToday);
    updates[`state.bankedBadgePoints.${role}.breakdown.${dayKey}`] = {
      points: badgePointsToday,
      badges: perAssetBadges,
    };

    // Reset history for all assets
    const resetHistory = {};
    const allSymbols = new Set([
      ...flat.map(a => a.symbol),
      ...Object.keys(history),
    ]);

    for (const symbol of allSymbols) {
      const oldHistory = history[symbol] || {};
      resetHistory[symbol] = {
        maxMultiplier: 0,
        minMultiplier: 0,
        badges: [],
        dailyThresholds: {
          ...(oldHistory.dailyThresholds || {}),
          [dayKey]: {
            maxMultiplier: oldHistory.maxMultiplier || 0,
            minMultiplier: oldHistory.minMultiplier || 0,
          },
        },
      };
    }
    updates[`${role}.history`] = resetHistory;

    // Clear swapPrice on assets swapped in before the next day
    const nextDay = currentDay + 1;
    const updatedPortfolio = JSON.parse(JSON.stringify(player.portfolio));
    for (const tier of ['star', 'core', 'support']) {
      for (let i = 0; i < (updatedPortfolio[tier] || []).length; i++) {
        const asset = updatedPortfolio[tier][i];
        if (asset && asset.swapPrice && (asset.swappedInDay || 0) < nextDay) {
          asset.previousSwapPrice = asset.swapPrice;
          asset.previousSwapDay = asset.swappedInDay;
          delete asset.swapPrice;
          delete asset.swappedInDay;
        }
      }
    }
    updates[`${role}.portfolio`] = updatedPortfolio;
  }

  // Write daily scores
  updates[`state.dailyScores.${dayKey}`] = {
    ...dayScoreData,
    recorded: true,
    recordedAt: new Date().toISOString(),
    recordedBy: 'cron',
  };
  updates.updatedAt = new Date().toISOString();

  const battleRef = db.collection('battles').doc(battleId);
  await battleRef.update(updates);

  logInfo(`Battle ${battleId}: Banked day ${currentDay} scores`, {
    creator: dayScoreData.creator?.activeScore,
    opponent: dayScoreData.opponent?.activeScore,
  });

  return { status: 'recorded', day: currentDay };
}

// Main handler
export default async function handler(req, res) {
  // --- Cron/Admin Authentication ---
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  logInfo('Starting BaggerBomb V4 daily score cron job');

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

    // Query all active V4 battles (not training)
    const battlesSnapshot = await db.collection('battles')
      .where('_v', '==', 4)
      .where('state.status', '==', 'active')
      .get();

    const battles = [];
    battlesSnapshot.forEach(doc => {
      const data = doc.data();
      if (!data.isTraining) {
        battles.push(doc);
      }
    });

    logInfo(`Found ${battles.length} active V4 battles`);

    if (battles.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No active V4 battles',
        processed: 0,
      });
    }

    // Collect all unique symbols from all battles
    const allSymbols = new Set();
    for (const battleDoc of battles) {
      const data = battleDoc.data();
      for (const role of ['creator', 'opponent']) {
        const flat = flattenPortfolio(data[role]?.portfolio);
        flat.forEach(a => allSymbols.add(a.symbol));
      }
    }

    // Fetch current prices
    const symbolList = Array.from(allSymbols);
    logInfo(`Fetching prices for ${symbolList.length} unique symbols`);
    const currentPrices = await fetchStockPrices(symbolList);

    if (Object.keys(currentPrices).length === 0) {
      logError('Failed to fetch any prices');
      return res.status(500).json({ success: false, error: 'Failed to fetch prices' });
    }

    // Process each battle
    const results = { processed: 0, skipped: 0, errors: 0 };

    for (const battleDoc of battles) {
      try {
        const result = await bankBattleScores(db, battleDoc, currentPrices);
        if (result.status === 'recorded') {
          results.processed++;
        } else {
          results.skipped++;
        }
      } catch (error) {
        logError(`Error processing battle ${battleDoc.id}`, { error: error.message });
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
