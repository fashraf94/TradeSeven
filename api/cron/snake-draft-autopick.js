// api/cron/snake-draft-autopick.js
// Server-side cron to autopick for absent/timed-out players in active Snake Drafts
//
// This is a BACKUP to the client-side autopick in useDraft.js.
// When all clients disconnect, this ensures drafts don't freeze.
//
// Schedule: */15 * * * * (every 15 minutes)
//   - Consider */1 or */2 for faster response on Vercel Pro plan
//   - Client-side autopick handles immediate (<2s) response for connected clients
//
// This is IDEMPOTENT - safe to run multiple times:
//   - Uses Firestore transactions to prevent duplicate picks
//   - Already-advanced drafts are skipped

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

export const config = {
  maxDuration: 30,
};

const LOG_PREFIX = '[AutopickCron]';

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

/**
 * Select an asset for autopick.
 * Strategy: random category from needed categories, random asset from that category.
 */
function selectAutopickAsset(player, availableAssets) {
  const categories = player.categories || { neutral: 0, aggressive: 0, defensive: 0 };

  // Find categories that still need picks (max 3 per category)
  const neededCategories = [];
  if ((categories.neutral || 0) < 3) neededCategories.push('neutral');
  if ((categories.aggressive || 0) < 3) neededCategories.push('aggressive');
  if ((categories.defensive || 0) < 3) neededCategories.push('defensive');

  if (neededCategories.length === 0) return null;

  // Pick random needed category
  const category = neededCategories[Math.floor(Math.random() * neededCategories.length)];
  const available = availableAssets[category];

  if (!available || available.length === 0) return null;

  // Pick random asset from that category
  const asset = available[Math.floor(Math.random() * available.length)];

  return { ...asset, category };
}

/**
 * Calculate battle end time when draft completes
 * Simplified version of freeAgencyService.calculateBattleEndTime
 */
function calculateBattleEndTime(portfolioType, now) {
  const completed = new Date(now);

  if (portfolioType === 'stocks') {
    // Find next Friday at 3 PM CT (Central Time)
    const ct = new Date(completed.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const dayOfWeek = ct.getDay();
    let daysUntilFriday = (5 - dayOfWeek + 7) % 7;

    if (daysUntilFriday === 0 && ct.getHours() >= 15) {
      daysUntilFriday = 7;
    }

    if (daysUntilFriday === 0) {
      ct.setHours(15, 0, 0, 0);
      return ct.toISOString();
    }

    const endDate = new Date(ct);
    endDate.setDate(endDate.getDate() + daysUntilFriday);
    endDate.setHours(15, 0, 0, 0);
    return endDate.toISOString();
  }

  // Crypto or mixed: 7 days from now
  const endDate = new Date(completed);
  endDate.setDate(endDate.getDate() + 7);
  return endDate.toISOString();
}

/**
 * Determine the correct battle start date (YYYY-MM-DD in ET).
 * Duplicated from battleTiming.js since serverless functions can't import from src/.
 */
function getBattleStartDate(completionTime) {
  const completed = new Date(completionTime);
  const etString = completed.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const et = new Date(etString);

  const dayOfWeek = et.getDay();
  const currentMinutes = et.getHours() * 60 + et.getMinutes();
  const marketOpenMinutes = 9 * 60 + 30;

  let startDate = new Date(et);

  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    if (currentMinutes >= marketOpenMinutes) {
      startDate.setDate(startDate.getDate() + 1);
      while (startDate.getDay() === 0 || startDate.getDay() === 6) {
        startDate.setDate(startDate.getDate() + 1);
      }
    }
  } else {
    while (startDate.getDay() === 0 || startDate.getDay() === 6) {
      startDate.setDate(startDate.getDate() + 1);
    }
  }

  const year = startDate.getFullYear();
  const month = String(startDate.getMonth() + 1).padStart(2, '0');
  const day = String(startDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate the battle end date as 5 trading days from start.
 * Duplicated from battleTiming.js since serverless functions can't import from src/.
 */
function calculateBattleEndDate(startDateStr) {
  const date = new Date(startDateStr + 'T12:00:00');
  let tradingDays = 0;
  while (tradingDays < 5) {
    if (date.getDay() >= 1 && date.getDay() <= 5) {
      tradingDays++;
      if (tradingDays === 5) break;
    }
    date.setDate(date.getDate() + 1);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Execute autopick for a single draft using a Firestore transaction
 * to prevent race conditions with concurrent clients/cron runs.
 */
async function executeAutopick(db, draftId) {
  const draftRef = db.collection('drafts').doc(draftId);

  return db.runTransaction(async (transaction) => {
    const draftDoc = await transaction.get(draftRef);
    if (!draftDoc.exists) {
      return { status: 'skipped', reason: 'not_found' };
    }

    const draft = { id: draftDoc.id, ...draftDoc.data() };

    // Re-validate inside transaction (state may have changed)
    if (draft.status !== 'active') {
      return { status: 'skipped', reason: 'not_active' };
    }

    if (!draft.pickDeadline) {
      return { status: 'skipped', reason: 'no_deadline' };
    }

    // Check if deadline has actually expired
    const deadline = draft.pickDeadline.toDate
      ? draft.pickDeadline.toDate()
      : new Date(draft.pickDeadline);
    if (Date.now() <= deadline.getTime()) {
      return { status: 'skipped', reason: 'not_expired' };
    }

    // Find current player
    const currentPlayerId = draft.currentPlayerId;
    if (!currentPlayerId) {
      return { status: 'skipped', reason: 'no_current_player' };
    }

    const playerIndex = draft.players.findIndex(p => p.odUserId === currentPlayerId);
    if (playerIndex === -1) {
      return { status: 'skipped', reason: 'player_not_found' };
    }

    const player = draft.players[playerIndex];

    // Select asset to pick
    const asset = selectAutopickAsset(player, draft.availableAssets);
    if (!asset) {
      logError(`No available asset for autopick`, { draftId, playerId: currentPlayerId });
      return { status: 'error', reason: 'no_available_asset' };
    }

    logInfo(`Autopicking ${asset.symbol} (${asset.category}) for ${player.displayName || currentPlayerId}`, {
      draftId,
      round: Math.floor(draft.currentPickIndex / 4) + 1,
      pick: draft.currentPickIndex + 1,
    });

    // Build the pick record
    const pick = {
      pickNumber: draft.currentPickIndex + 1,
      round: Math.floor(draft.currentPickIndex / 4) + 1,
      playerId: currentPlayerId,
      playerIndex,
      asset: {
        symbol: asset.symbol,
        name: asset.name,
        category: asset.category,
      },
      timestamp: new Date().toISOString(),
      isAutopick: true,
      autopickSource: 'cron',
    };

    // Update player data
    const updatedPlayers = [...draft.players];
    updatedPlayers[playerIndex] = {
      ...player,
      picks: [...(player.picks || []), asset.symbol],
      pickCategories: [...(player.pickCategories || []), asset.category],
      categories: {
        ...player.categories,
        [asset.category]: (player.categories?.[asset.category] || 0) + 1,
      },
    };

    // Remove picked asset from available pool
    const updatedAvailable = { ...draft.availableAssets };
    updatedAvailable[asset.category] = (updatedAvailable[asset.category] || [])
      .filter(a => a.symbol !== asset.symbol);

    // Advance to next pick
    const nextPickIndex = draft.currentPickIndex + 1;
    const isComplete = nextPickIndex >= 36;

    let nextPlayerId = null;
    let nextDeadline = null;

    if (!isComplete) {
      const nextPlayerIndex = draft.draftOrder[nextPickIndex];
      nextPlayerId = updatedPlayers[nextPlayerIndex].odUserId;
      nextDeadline = Timestamp.fromMillis(Date.now() + 2 * 60 * 1000);
    }

    // Build update object
    const updateData = {
      players: updatedPlayers,
      picks: FieldValue.arrayUnion(pick),
      availableAssets: updatedAvailable,
      currentPickIndex: nextPickIndex,
      currentPlayerId: nextPlayerId,
      pickDeadline: nextDeadline,
      lastPick: {
        odUserId: currentPlayerId,
        displayName: player.displayName,
        symbol: asset.symbol,
        category: asset.category,
        timestamp: new Date().toISOString(),
        isCPU: player.isCPU || false,
        pickNumber: draft.currentPickIndex + 1,
      },
      currentRound: Math.floor(nextPickIndex / 4) + 1,
    };

    // Handle draft completion (all 36 picks made)
    if (isComplete) {
      const now = new Date().toISOString();

      // Store original picks for each player (before any swaps)
      const playersWithOriginalPicks = updatedPlayers.map(p => ({
        ...p,
        originalPicks: [...p.picks],
      }));

      // Free agents = remaining available assets (already filtered)
      const freeAgents = {
        steady: updatedAvailable.steady || [],
        risky: updatedAvailable.risky || [],
        defensive: updatedAvailable.defensive || [],
      };

      const battleEndTime = calculateBattleEndTime(draft.type, now);
      const battleStartDate = getBattleStartDate(now);
      const battleEndDate = calculateBattleEndDate(battleStartDate);

      updateData.players = playersWithOriginalPicks;
      updateData.status = 'battle';
      updateData.completedAt = FieldValue.serverTimestamp();
      updateData.battleStartTime = now;
      updateData.battleStartDate = battleStartDate;
      updateData.battleEndDate = battleEndDate;
      updateData.battleEndTime = battleEndTime;
      updateData.freeAgents = freeAgents;
      updateData.swapHistory = [];
      updateData.dailySwaps = {};

      logInfo(`Draft complete - transitioning to battle`, {
        draftId,
        battleEndTime,
        playerCount: updatedPlayers.length,
      });
    }

    // Write atomically via transaction
    transaction.update(draftRef, updateData);

    return {
      status: 'autopicked',
      draftId,
      playerId: currentPlayerId,
      playerUsername: player.displayName || currentPlayerId,
      symbol: asset.symbol,
      category: asset.category,
      round: pick.round,
      pick: pick.pickNumber,
      isComplete,
    };
  });
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verify cron secret for automated calls
  if (req.method === 'GET') {
    const authHeader = req.headers.authorization;
    const isVercelCron = req.headers['x-vercel-cron'] === '1';

    if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  // Allow POST for manual testing
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  logInfo('Snake Draft autopick cron started');

  try {
    const db = getFirebaseAdmin();
    const now = Timestamp.now();

    // Query active drafts with expired pick deadlines
    const activeDraftsSnap = await db.collection('drafts')
      .where('status', '==', 'active')
      .where('pickDeadline', '<', now)
      .get();

    logInfo(`Found ${activeDraftsSnap.size} active drafts with expired deadlines`);

    if (activeDraftsSnap.empty) {
      return res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        checked: 0,
        autopicked: 0,
        errors: 0,
        details: [],
      });
    }

    const results = {
      checked: activeDraftsSnap.size,
      autopicked: 0,
      completed: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };

    // Process each expired draft
    for (const draftDoc of activeDraftsSnap.docs) {
      try {
        const result = await executeAutopick(db, draftDoc.id);

        if (result.status === 'autopicked') {
          results.autopicked++;
          if (result.isComplete) results.completed++;
          results.details.push(result);
          logInfo(`Autopicked for draft ${draftDoc.id}`, result);
        } else {
          results.skipped++;
          logInfo(`Skipped draft ${draftDoc.id}: ${result.reason}`);
        }
      } catch (error) {
        results.errors++;
        logError(`Error processing draft ${draftDoc.id}`, {
          error: error.message,
        });
        results.details.push({
          draftId: draftDoc.id,
          status: 'error',
          error: error.message,
        });
      }
    }

    const duration = Date.now() - startTime;
    logInfo('Autopick cron completed', { ...results, durationMs: duration });

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      durationMs: duration,
      ...results,
    });

  } catch (error) {
    logError('Fatal error during autopick cron', {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
