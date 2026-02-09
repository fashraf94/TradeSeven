// api/cron/snake-draft-daily-scores.js
// Records daily close scores for all active Snake Draft battles
// Called by Vercel cron at 4:15 PM ET (16:15 Eastern Time) Monday-Friday
//
// Schedule: 15 16 * * 1-5 (UTC offset applied in vercel.json)
//
// This cron job serves as a BACKUP to client-side recording:
//   - Primary: Client records scores when user opens app after market close
//   - Backup: This cron ensures scores are recorded even if no users are online
//
// The recording is IDEMPOTENT - safe to run multiple times:
//   - Already recorded days are skipped
//   - Completed battles are skipped

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Structured logging helper
const LOG_PREFIX = '[SnakeDraftCron]';

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

    initializeApp({
      credential: cert(serviceAccount),
    });
  }
  return getFirestore();
}

// Get current time in Eastern timezone
function getEasternTime() {
  const now = new Date();
  const etString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  return new Date(etString);
}

// Check if it's a weekday (trading day)
function isWeekday() {
  const et = getEasternTime();
  const day = et.getDay();
  return day >= 1 && day <= 5;
}

// Get current trading day number (1-5) for a battle
function getCurrentTradingDay(battleStartTime) {
  if (!battleStartTime) return 0;

  // Convert battleStartTime to Eastern Time before normalizing
  // This ensures both dates are in the same ET reference frame,
  // preventing off-by-one errors since this cron runs on Vercel (UTC)
  const startDate = new Date(battleStartTime);
  const startETString = startDate.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const startDay = new Date(startETString);
  startDay.setHours(0, 0, 0, 0);

  const currentDay = new Date(getEasternTime());
  currentDay.setHours(0, 0, 0, 0);

  // Count trading days between start and now
  let tradingDays = 0;
  const checkDate = new Date(startDay);

  while (checkDate <= currentDay && tradingDays < 6) {
    const dayOfWeek = checkDate.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      tradingDays++;
    }
    checkDate.setDate(checkDate.getDate() + 1);
  }

  return Math.min(tradingDays, 5);
}

// Calculate BaggerBomb score for an asset
function calculateAssetScore(percentChange, threshold) {
  // Base points: % return * 10
  const basePoints = percentChange * 10;

  // BaggerBombs: count how many times we crossed the threshold (positive)
  const baggerBombs = percentChange > 0 ? Math.floor(percentChange / threshold) : 0;
  const baggerBombPoints = baggerBombs * 15;

  // Busts: count how many times we crossed the threshold (negative)
  const busts = percentChange < 0 ? Math.floor(Math.abs(percentChange) / threshold) : 0;
  const bustPoints = busts * -7.5;

  return {
    basePoints: Math.round(basePoints * 100) / 100,
    baggerBombs,
    busts,
    baggerBombPoints,
    bustPoints,
    totalScore: Math.round((basePoints + baggerBombPoints + bustPoints) * 100) / 100,
  };
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
    // Batch fetch real-time prices
    const symbolList = symbols.join(',');
    const url = `https://eodhd.com/api/real-time/${symbolList}?api_token=${apiKey}&fmt=json`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`EODHD API error: ${response.status}`);
    }

    const data = await response.json();

    // Handle both array and single object responses
    const priceArray = Array.isArray(data) ? data : [data];

    for (const item of priceArray) {
      if (item.code && item.close) {
        prices[item.code.toUpperCase()] = {
          price: item.close,
          timestamp: item.timestamp,
        };
      }
    }

    logInfo(`Fetched prices for ${Object.keys(prices).length} symbols`);
  } catch (error) {
    logError('Error fetching stock prices', { error: error.message });
  }

  return prices;
}

// Record daily close scores for a single battle
async function recordBattleScores(db, battle, currentPrices) {
  const battleId = battle.id;
  const currentDay = getCurrentTradingDay(battle.battleStartTime || battle.createdAt);
  const dayKey = `day${currentDay}`;

  if (currentDay < 1 || currentDay > 5) {
    logInfo(`Battle ${battleId}: Not a valid trading day (${currentDay})`);
    return { status: 'skipped', reason: 'invalid_day' };
  }

  // Check if already recorded
  const dailyData = battle.dailyData || {};
  if (dailyData[dayKey]?.recorded) {
    logInfo(`Battle ${battleId}: Day ${currentDay} already recorded`);
    return { status: 'skipped', reason: 'already_recorded' };
  }

  // Get baseline prices for today
  // Day 1: ALWAYS use lockedPrices (draft completion prices)
  // Day 2+: Use daily open prices, fall back to locked prices if not captured
  const openPrices = currentDay === 1
    ? (battle.lockedPrices || {})
    : (dailyData[dayKey]?.openPrices || battle.lockedPrices || {});

  if (Object.keys(openPrices).length === 0) {
    logWarn(`Battle ${battleId}: No open prices available for day ${currentDay}`);
    return { status: 'skipped', reason: 'no_open_prices' };
  }

  // Calculate scores for each player
  const closeScores = {};

  for (const player of (battle.players || [])) {
    const playerAssets = [];
    let playerTotalPoints = 0;

    for (const symbol of (player.picks || [])) {
      const upperSymbol = symbol.toUpperCase();

      // Get prices
      const openPrice = openPrices[symbol] || openPrices[upperSymbol] || 0;
      const currentPrice = currentPrices[upperSymbol]?.price || 0;

      // Calculate daily gain
      let dailyGain = 0;
      if (openPrice > 0 && currentPrice > 0) {
        dailyGain = ((currentPrice - openPrice) / openPrice) * 100;
      }

      // Get threshold (default to 3%)
      const threshold = 3.0; // Could be fetched from volatility service

      // Calculate BaggerBomb score
      const assetScore = calculateAssetScore(dailyGain, threshold);

      playerAssets.push({
        symbol,
        openPrice,
        closePrice: currentPrice,
        gain: parseFloat(dailyGain.toFixed(2)),
        points: assetScore.totalScore,
        baggerBombs: assetScore.baggerBombs,
        busts: assetScore.busts,
        basePoints: assetScore.basePoints,
        baggerBombPoints: assetScore.baggerBombPoints,
        bustPoints: assetScore.bustPoints,
      });

      playerTotalPoints += assetScore.totalScore;
    }

    closeScores[player.odUserId] = {
      totalPoints: parseFloat(playerTotalPoints.toFixed(2)),
      assets: playerAssets,
    };
  }

  // Update Firebase with daily scores
  const updatedDailyData = { ...dailyData };
  updatedDailyData[dayKey] = {
    ...updatedDailyData[dayKey],
    closeScores,
    recorded: true,
    recordedAt: new Date().toISOString(),
    recordedBy: 'cron',
  };

  const battleRef = db.collection('drafts').doc(battleId);
  await battleRef.update({
    dailyData: updatedDailyData,
    currentTradingDay: currentDay,
  });

  logInfo(`Battle ${battleId}: Recorded day ${currentDay} scores`);

  // Check if battle should auto-complete (after day 5)
  if (currentDay === 5) {
    await completeBattle(db, battleId, updatedDailyData, battle.players);
  }

  return { status: 'recorded', day: currentDay };
}

// Calculate cumulative scores and complete the battle
async function completeBattle(db, battleId, dailyData, players) {
  // Calculate cumulative scores
  const finalTotals = {};

  for (let day = 1; day <= 5; day++) {
    const dayKey = `day${day}`;
    const dayData = dailyData[dayKey];

    if (dayData?.closeScores) {
      for (const [playerId, scoreData] of Object.entries(dayData.closeScores)) {
        if (!finalTotals[playerId]) {
          finalTotals[playerId] = {
            totalPoints: 0,
            dailyBreakdown: [],
          };
        }
        finalTotals[playerId].totalPoints += scoreData.totalPoints || 0;
        finalTotals[playerId].dailyBreakdown.push(scoreData.totalPoints || 0);
      }
    }
  }

  // Create final standings
  const finalStandings = Object.entries(finalTotals)
    .map(([odUserId, data]) => {
      const player = players.find(p => p.odUserId === odUserId);
      return {
        odUserId,
        displayName: player?.displayName || 'Unknown',
        totalPoints: data.totalPoints,
        dailyBreakdown: data.dailyBreakdown,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((player, index) => ({
      ...player,
      finalRank: index + 1,
    }));

  const winner = finalStandings[0] || null;

  // Update battle as completed
  const battleRef = db.collection('drafts').doc(battleId);
  await battleRef.update({
    status: 'completed',
    finalTotals,
    finalStandings,
    winner: winner ? {
      odUserId: winner.odUserId,
      displayName: winner.displayName,
      totalPoints: winner.totalPoints,
    } : null,
    completedAt: new Date().toISOString(),
  });

  logInfo(`Battle ${battleId}: COMPLETED. Winner: ${winner?.displayName} with ${winner?.totalPoints} pts`);
}

// Main handler
export default async function handler(req, res) {
  const startTime = Date.now();
  logInfo('Starting Snake Draft daily score cron job');

  // Check if it's a weekday
  if (!isWeekday()) {
    logInfo('Skipping - not a trading day (weekend)');
    return res.status(200).json({
      success: true,
      message: 'Skipped - weekend',
      processed: 0,
    });
  }

  try {
    const db = getFirebaseAdmin();

    // Query all active battles
    const battlesSnapshot = await db.collection('drafts')
      .where('status', '==', 'battle')
      .get();

    // Filter for Snake Draft battles (4 players)
    const battles = [];
    battlesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.players?.length === 4) {
        battles.push({ id: doc.id, ...data });
      }
    });

    logInfo(`Found ${battles.length} active Snake Draft battles`);

    if (battles.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No active battles',
        processed: 0,
      });
    }

    // Collect all unique symbols
    const allSymbols = new Set();
    for (const battle of battles) {
      for (const player of (battle.players || [])) {
        for (const symbol of (player.picks || [])) {
          allSymbols.add(symbol.toUpperCase());
        }
      }
    }

    // Fetch current prices
    const symbolList = Array.from(allSymbols);
    logInfo(`Fetching prices for ${symbolList.length} unique symbols`);
    const currentPrices = await fetchStockPrices(symbolList);

    if (Object.keys(currentPrices).length === 0) {
      logError('Failed to fetch any prices');
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch prices',
      });
    }

    // Process each battle
    const results = {
      processed: 0,
      skipped: 0,
      completed: 0,
      errors: 0,
    };

    for (const battle of battles) {
      try {
        const result = await recordBattleScores(db, battle, currentPrices);

        if (result.status === 'recorded') {
          results.processed++;
          if (result.day === 5) {
            results.completed++;
          }
        } else {
          results.skipped++;
        }
      } catch (error) {
        logError(`Error processing battle ${battle.id}`, { error: error.message });
        results.errors++;
      }
    }

    const duration = Date.now() - startTime;
    logInfo(`Cron job complete`, { ...results, durationMs: duration });

    return res.status(200).json({
      success: true,
      ...results,
      durationMs: duration,
    });

  } catch (error) {
    logError('Cron job failed', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
