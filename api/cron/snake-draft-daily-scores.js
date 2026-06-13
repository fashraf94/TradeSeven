// api/cron/snake-draft-daily-scores.js
// Records daily close scores for all active Snake Draft battles
// Called by Vercel cron at 21:15 UTC Monday-Friday — 4:15 PM ET during EST,
// 5:15 PM ET during EDT. Either way it runs after the 4:00 PM ET close,
// which is all this backup recorder requires.
//
// Schedule: 15 21 * * 1-5 (vercel.json cron schedules are UTC)
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
import { calculateSnakeDraftAssetScore } from '../../src/services/scoring/baggerBombCalculator.js';
import { bankAllTournamentGroups } from '../_utils/tournamentBanking.js';
import { reconcileAllTournamentLedgers } from '../_utils/tournamentAgentLedger.js';
import { aggregateTournamentLeaderboards } from '../_utils/tournamentLeaderboard.js';

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

// 2026 US Stock Market Holidays (NYSE/NASDAQ)
// Duplicated from src/utils/marketHolidays.js since serverless functions can't import from src/.
const US_MARKET_HOLIDAYS_2026 = [
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03',
  '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07',
  '2026-11-26', '2026-12-25',
];

function isMarketHoliday(dateStr) {
  return US_MARKET_HOLIDAYS_2026.includes(dateStr);
}

function formatDateStr(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Check if today is a trading day (weekday + not a market holiday)
function isTradingDay() {
  const et = getEasternTime();
  const day = et.getDay();
  if (day < 1 || day > 5) return false;
  return !isMarketHoliday(formatDateStr(et));
}

// Determine the correct battle start date (YYYY-MM-DD in ET).
// Duplicated from battleTiming.js since serverless functions can't import from src/.
function getBattleStartDate(completionTime) {
  const completed = new Date(completionTime);
  const etString = completed.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const et = new Date(etString);

  const dayOfWeek = et.getDay();
  const currentMinutes = et.getHours() * 60 + et.getMinutes();
  const marketOpenMinutes = 9 * 60 + 30;

  let startDate = new Date(et);

  const isNonTradingDay = (d) =>
    d.getDay() === 0 || d.getDay() === 6 || isMarketHoliday(formatDateStr(d));

  if (dayOfWeek >= 1 && dayOfWeek <= 5 && !isMarketHoliday(formatDateStr(startDate))) {
    if (currentMinutes >= marketOpenMinutes) {
      startDate.setDate(startDate.getDate() + 1);
      while (isNonTradingDay(startDate)) {
        startDate.setDate(startDate.getDate() + 1);
      }
    }
  } else {
    while (isNonTradingDay(startDate)) {
      startDate.setDate(startDate.getDate() + 1);
    }
  }

  const year = startDate.getFullYear();
  const month = String(startDate.getMonth() + 1).padStart(2, '0');
  const day = String(startDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get current trading day number (1-5) for a battle
// Returns 0 if battleStartDate is in the future (battle hasn't started yet)
function getCurrentTradingDay(battleStartTime, battleStartDate) {
  if (!battleStartTime && !battleStartDate) return 0;

  let startDay;

  if (battleStartDate) {
    // New path: use explicit battleStartDate (YYYY-MM-DD)
    // Parse with noon time to avoid DST midnight edge cases
    startDay = new Date(battleStartDate + 'T12:00:00');
    startDay.setHours(0, 0, 0, 0);
  } else {
    // Legacy path: compute correct start date from battleStartTime
    // getBattleStartDate defers to next trading day if completed during/after market hours
    const computedStartDate = getBattleStartDate(battleStartTime);
    startDay = new Date(computedStartDate + 'T12:00:00');
    startDay.setHours(0, 0, 0, 0);
  }

  const currentDay = new Date(getEasternTime());
  currentDay.setHours(0, 0, 0, 0);

  // If current date is before battle start date, return 0 (not started)
  if (currentDay < startDay) {
    return 0;
  }

  // Count trading days between start and now
  let tradingDays = 0;
  const checkDate = new Date(startDay);

  while (checkDate <= currentDay && tradingDays < 6) {
    const dayOfWeek = checkDate.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5 && !isMarketHoliday(formatDateStr(checkDate))) {
      tradingDays++;
    }
    checkDate.setDate(checkDate.getDate() + 1);
  }

  return Math.min(tradingDays, 5);
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
  const currentDay = getCurrentTradingDay(battle.battleStartTime || battle.createdAt, battle.battleStartDate);
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
  const battleThresholds = battle.thresholds || {};

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

      // Get threshold from draft's per-asset thresholds, fall back to 3%
      const threshold = battleThresholds[upperSymbol]?.threshold || battleThresholds[symbol]?.threshold || 3.0;

      // Calculate BaggerBomb score
      const assetScore = calculateSnakeDraftAssetScore(dailyGain, threshold);

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

  // Calculate waiver priority from today's scores (lowest scorer = first pick)
  const waiverPriority = Object.entries(closeScores)
    .sort((a, b) => a[1].totalPoints - b[1].totalPoints)
    .map(([odUserId]) => odUserId);

  const updatePayload = {
    dailyData: updatedDailyData,
    currentTradingDay: currentDay,
  };

  if (battle.claimSystem?.enabled) {
    updatePayload['claimSystem.currentWaiverPriority'] = waiverPriority;
  }

  const battleRef = db.collection('drafts').doc(battleId);
  await battleRef.update(updatePayload);

  logInfo(`Battle ${battleId}: Recorded day ${currentDay} scores`);

  // CPU claim logic for training drafts
  if (battle.isTraining && battle.claimSystem?.enabled && currentDay < 5) {
    const cpuPlayers = (battle.players || []).filter(p => p.isCPU);
    const freeAgents = battle.freeAgents || { steady: [], risky: [], defensive: [] };

    for (const cpu of cpuPlayers) {
      // 40% chance to submit a claim
      if (Math.random() > 0.40) continue;

      const cpuScoreData = closeScores[cpu.odUserId];
      if (!cpuScoreData?.assets?.length) continue;

      // Sort by points ascending — drop worst performer
      const sortedAssets = [...cpuScoreData.assets].sort((a, b) => a.points - b.points);
      const worstAsset = sortedAssets[0];
      if (!worstAsset) continue;

      // Determine category of the drop asset
      const dropSymbol = worstAsset.symbol;
      const pickIndex = (cpu.picks || []).findIndex(s => s.toUpperCase() === dropSymbol.toUpperCase());
      if (pickIndex < 0) continue;
      const dropCategory = cpu.pickCategories?.[pickIndex];
      if (!dropCategory) continue;

      // Pick random free agent from same category
      const categoryPool = freeAgents[dropCategory] || [];
      if (categoryPool.length === 0) continue;

      const addAsset = categoryPool[Math.floor(Math.random() * categoryPool.length)];
      const addSymbol = typeof addAsset === 'string' ? addAsset : addAsset.symbol;
      if (!addSymbol) continue;

      // Submit claim to Firestore
      const claimRef = db.collection('drafts').doc(battleId).collection('claims').doc();
      await claimRef.set({
        id: claimRef.id,
        draftId: battleId,
        odUserId: cpu.odUserId,
        odUsername: cpu.displayName || cpu.odUsername,
        dropSymbol: dropSymbol.toUpperCase(),
        addSymbol: addSymbol.toUpperCase(),
        category: dropCategory,
        rank: 1,
        status: 'pending',
        forDay: Math.min(currentDay + 1, 5),
        createdAt: new Date().toISOString(),
      });

      logInfo(`Battle ${battleId}: CPU ${cpu.displayName} claimed ${addSymbol} (drop ${dropSymbol})`);
    }
  }

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
  // --- Cron/Admin Authentication ---
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  logInfo('Starting Snake Draft daily score cron job');

  // Check if it's a trading day (weekday + not a market holiday)
  if (!isTradingDay()) {
    logInfo('Skipping - not a trading day (weekend or market holiday)');
    return res.status(200).json({
      success: true,
      message: 'Skipped - market closed (weekend or holiday)',
      processed: 0,
    });
  }

  // Declared above the try so the outer catch can report it too — the
  // tournament branch's result must never be masked, even by a legacy throw.
  let tournament = { groups: 0, processed: 0, skipped: 0, errors: 0 };
  let tournamentLedger = { groups: 0, reconciled: 0, divergences: 0, staleCleared: 0, errors: 0 };
  let tournamentLeaderboard = { groups: 0, skippedNoBanking: 0, docsWritten: 0, errors: 0 };

  try {
    const db = getFirebaseAdmin();

    // P1b: League Tournament user-layer banking rides this nightly handler
    // (zero new cron entries — BUILD_RULES §6; banking home ratified in the
    // P1a PR register). It runs FIRST and is fully independent of the legacy
    // path: zero tournament groups is a clean no-op (the production state
    // until P3+), and a tournament failure must never block the legacy
    // recorder below — so it carries its own catch.
    try {
      tournament = await bankAllTournamentGroups(db);
      logInfo('Tournament banking branch complete', tournament);
    } catch (error) {
      logError('Tournament banking branch failed', { error: error.message });
      tournament = { groups: 0, processed: 0, skipped: 0, errors: 1, failed: true };
    }

    // P2: nightly derived reconciliation of the agent held-set ledgers
    // (Spec §1.2) rides the same window — zero new cron entries. Its own
    // catch: a reconcile failure never blocks banking's result, the
    // leaderboard branch, or the legacy path. P6b (founder Option 1): it now
    // runs BEFORE the leaderboard branch so its per-group held sets feed the
    // consensus/contrarian derivation — read-only reuse of reads it already
    // does, zero new reads. Banking stays first and independent.
    let heldByGroup = {};
    try {
      tournamentLedger = await reconcileAllTournamentLedgers(db, { now: new Date() });
      heldByGroup = tournamentLedger.heldByGroup || {};
      logInfo('Tournament ledger reconciliation complete', tournamentLedger);
    } catch (error) {
      logError('Tournament ledger reconciliation failed', { error: error.message });
      tournamentLedger = { groups: 0, reconciled: 0, divergences: 0, staleCleared: 0, errors: 1, failed: true };
      // heldByGroup stays {} — every leaderboard feed degrades honestly
      // (omitted, not crashed); the branches stay fire-walled, no cascade.
    }

    // P6a: the seasonal-leaderboard aggregation rides the same window, AFTER
    // banking (today's composites are in) and AFTER reconcile (the C-1 feeds
    // reuse its held sets) — zero new cron entries, zero new reads. Same
    // independence contract: zero groups is a clean no-op, its own catch,
    // never blocks any sibling branch or the legacy path. Dev groups route to
    // dev- docs inside (ruling A-4) — the query stays dev-inclusive.
    try {
      tournamentLeaderboard = await aggregateTournamentLeaderboards(db, { now: new Date(), heldByGroup });
      logInfo('Tournament leaderboard branch complete', tournamentLeaderboard);
    } catch (error) {
      logError('Tournament leaderboard branch failed', { error: error.message });
      tournamentLeaderboard = { groups: 0, skippedNoBanking: 0, docsWritten: 0, errors: 1, failed: true };
    }

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
        tournament,
        tournamentLedger,
        tournamentLeaderboard,
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
        tournament, // the tournament branches already ran — never masked by a legacy price failure
        tournamentLedger,
        tournamentLeaderboard,
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
      tournament,
      tournamentLedger,
      tournamentLeaderboard,
      durationMs: duration,
    });

  } catch (error) {
    logError('Cron job failed', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: error.message,
      tournament,
      tournamentLedger,
      tournamentLeaderboard,
    });
  }
}
