// src/services/draftAnalyticsService.js
// Draft Analytics Service - Phase 1: Data Collection
// Logs completed drafts to Firebase for ADP, ownership rates, and user stats

import {
  doc,
  setDoc,
  getDoc,
  collection,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Remove undefined values from an object (Firebase doesn't allow undefined)
 * Mirrors the pattern from draftService.js
 */
const removeUndefined = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefined(item));
  }
  if (typeof obj === 'object' && !(obj instanceof Date) && !(obj instanceof Timestamp)) {
    const cleaned = {};
    Object.keys(obj).forEach(key => {
      if (obj[key] !== undefined) {
        cleaned[key] = removeUndefined(obj[key]);
      }
    });
    return cleaned;
  }
  return obj;
};

/**
 * Build picks array from draft data for analytics storage
 * @param {Object} draft - Complete draft object
 * @returns {Array} - Array of pick records with player info
 */
export const buildPicksArray = (draft) => {
  // Use draft.picks array (global pick ledger with full metadata)
  if (!draft.picks || !Array.isArray(draft.picks)) {
    // Fallback: build from player.picks arrays using snake pattern
    return buildPicksFromPlayers(draft);
  }

  return draft.picks.map(pick => {
    const player = draft.players?.[pick.playerIndex];

    // Get sector from availableAssets if possible
    const sector = getSectorForSymbol(pick.asset?.symbol, pick.asset?.category, draft);

    return {
      pickNumber: pick.pickNumber,
      round: pick.round,
      roundPick: ((pick.pickNumber - 1) % 4) + 1,
      symbol: pick.asset?.symbol,
      name: pick.asset?.name,
      category: pick.asset?.category,
      sector,
      playerId: pick.playerId,
      playerIndex: pick.playerIndex,
      playerDisplayName: player?.displayName || 'Unknown',
      playerType: player?.isCPU ? 'cpu' : 'human',
      timestamp: pick.timestamp || null,
      isAutopick: pick.isAutopick || false
    };
  }).sort((a, b) => a.pickNumber - b.pickNumber);
};

/**
 * Fallback: Build picks array from player.picks arrays using snake draft pattern
 */
const buildPicksFromPlayers = (draft) => {
  const picks = [];
  const numPlayers = 4;
  const numRounds = 9;

  if (!draft.players || !Array.isArray(draft.players)) {
    return picks;
  }

  for (let round = 0; round < numRounds; round++) {
    // Snake draft: odd rounds go left-to-right, even rounds go right-to-left
    const isReverse = round % 2 === 1;

    for (let i = 0; i < numPlayers; i++) {
      const playerIndex = isReverse ? (numPlayers - 1 - i) : i;
      const player = draft.players[playerIndex];

      if (!player || !player.picks || !player.picks[round]) {
        continue;
      }

      const symbol = player.picks[round];
      const category = player.pickCategories?.[round] || null;
      const pickNumber = round * numPlayers + i + 1;

      picks.push({
        pickNumber,
        round: round + 1,
        roundPick: i + 1,
        symbol,
        category,
        sector: getSectorForSymbol(symbol, category, draft),
        playerId: player.odUserId,
        playerIndex,
        playerDisplayName: player.displayName || 'Unknown',
        playerType: player.isCPU ? 'cpu' : 'human',
        timestamp: null,
        isAutopick: false
      });
    }
  }

  return picks.sort((a, b) => a.pickNumber - b.pickNumber);
};

/**
 * Get sector for a symbol from availableAssets
 */
const getSectorForSymbol = (symbol, category, draft) => {
  if (!symbol || !draft.availableAssets) return null;

  // Check all categories if category not specified
  const categories = category ? [category] : ['steady', 'risky', 'defensive'];

  for (const cat of categories) {
    const assets = draft.availableAssets[cat];
    if (Array.isArray(assets)) {
      const asset = assets.find(a => a.symbol === symbol);
      if (asset?.sector) return asset.sector;
    }
  }

  return null;
};

/**
 * Calculate draft duration in milliseconds
 */
const calculateDraftDuration = (draft) => {
  if (!draft.startedAt) return null;

  try {
    const start = draft.startedAt?.toDate?.()
      ? draft.startedAt.toDate()
      : new Date(draft.startedAt);
    const end = new Date();

    return end.getTime() - start.getTime();
  } catch {
    return null;
  }
};

/**
 * Get default aggregate structure
 */
const getDefaultAggregates = () => ({
  totalDrafts: 0,
  trainingDrafts: 0,
  multiplayerDrafts: 0,
  totalPicks: 0,
  totalAutopicks: 0,
  uniqueHumanPlayers: [],
  uniqueHumanPlayerCount: 0,
  categoryPicks: { steady: 0, risky: 0, defensive: 0 },
  assetPickCounts: {},
  lastUpdated: null
});

/**
 * Get default user stats structure
 */
const getDefaultUserStats = () => ({
  totalDrafts: 0,
  stockDrafts: 0,
  cryptoDrafts: 0,
  recentDraftIds: [],
  assetPickCounts: {},
  favoriteAssets: [],
  lastDraftAt: null
});

/**
 * Count picks in a specific category
 */
const countCategoryPicks = (picks, category) => {
  return picks.filter(p => p.category === category).length;
};

/**
 * Update asset pick count map
 */
const updateAssetPickCounts = (current, picks) => {
  const updated = { ...current };
  for (const pick of picks) {
    const symbol = pick.symbol;
    if (symbol) {
      updated[symbol] = (updated[symbol] || 0) + 1;
    }
  }
  return updated;
};

/**
 * Calculate top 10 favorite assets from pick counts
 */
const calculateFavoriteAssets = (assetPickCounts) => {
  return Object.entries(assetPickCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([symbol, count]) => ({ symbol, count }));
};

// ============================================
// MAIN ANALYTICS FUNCTIONS
// ============================================

/**
 * Log a completed draft to analytics
 * Called when draft transitions to 'battle' status
 * @param {Object} draft - Complete draft object at completion time
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const logDraftToAnalytics = async (draft) => {
  try {
    const draftId = draft.id;
    const assetType = draft.type || 'stocks';
    const isTraining = draft.isTraining || false;

    // Build normalized picks array
    const picksArray = buildPicksArray(draft);

    // Extract player summaries
    const playerSummaries = (draft.players || []).map((player, index) => ({
      odUserId: player.odUserId,
      displayName: player.displayName,
      isCPU: player.isCPU || false,
      position: index,
      picks: player.picks || [],
      pickCategories: player.pickCategories || [],
      categories: player.categories || { steady: 0, risky: 0, defensive: 0 }
    }));

    const humanPlayerCount = playerSummaries.filter(p => !p.isCPU).length;
    const cpuPlayerCount = playerSummaries.filter(p => p.isCPU).length;
    const autopickCount = picksArray.filter(p => p.isAutopick).length;

    // Build the draft analytics record
    const draftRecord = {
      draftId,
      assetType,
      isTraining,
      completedAt: serverTimestamp(),
      draftCode: draft.code || null,
      hostId: draft.hostId || null,

      // Player data
      players: playerSummaries,
      humanPlayerCount,
      cpuPlayerCount,

      // Pick data
      picks: picksArray,
      totalPicks: picksArray.length,
      autopickCount,

      // Timing
      startedAt: draft.startedAt || null,
      draftDurationMs: calculateDraftDuration(draft),

      // Battle results (added later when battle completes)
      battleResults: null
    };

    // Store the raw draft record
    const draftRef = doc(collection(db, 'draftAnalytics'), draftId);
    await setDoc(draftRef, removeUndefined(draftRecord));

    console.log(`[DraftAnalytics] Logged draft ${draftId} with ${picksArray.length} picks`);

    // Update aggregate stats (non-blocking)
    updateDraftAggregates(draftRecord).catch(err => {
      console.error('[DraftAnalytics] Failed to update aggregates:', err);
    });

    // Update per-user stats for human players only
    for (const player of playerSummaries) {
      if (!player.isCPU && player.odUserId) {
        const userPicks = picksArray.filter(p => p.playerId === player.odUserId);
        updateUserDraftStats(
          player.odUserId,
          userPicks,
          draftId,
          assetType
        ).catch(err => {
          console.error(`[DraftAnalytics] Failed to update user stats for ${player.odUserId}:`, err);
        });
      }
    }

    return { success: true, draftId };

  } catch (error) {
    console.error('[DraftAnalytics] Error logging draft:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update platform-wide draft aggregates
 * Uses read-update-write pattern since Firebase increment() doesn't work on nested fields
 * @param {Object} draftRecord - The draft analytics record
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const updateDraftAggregates = async (draftRecord) => {
  try {
    const assetType = draftRecord.assetType;
    const aggregateRef = doc(db, 'draftAggregates', assetType);

    // Read current aggregates
    const aggregateSnap = await getDoc(aggregateRef);
    const current = aggregateSnap.exists() ? aggregateSnap.data() : getDefaultAggregates();

    // Calculate new values
    const updated = {
      totalDrafts: (current.totalDrafts || 0) + 1,
      trainingDrafts: (current.trainingDrafts || 0) + (draftRecord.isTraining ? 1 : 0),
      multiplayerDrafts: (current.multiplayerDrafts || 0) + (draftRecord.isTraining ? 0 : 1),
      totalPicks: (current.totalPicks || 0) + draftRecord.totalPicks,
      totalAutopicks: (current.totalAutopicks || 0) + draftRecord.autopickCount,

      // Category pick counts
      categoryPicks: {
        steady: (current.categoryPicks?.steady || 0) + countCategoryPicks(draftRecord.picks, 'steady'),
        risky: (current.categoryPicks?.risky || 0) + countCategoryPicks(draftRecord.picks, 'risky'),
        defensive: (current.categoryPicks?.defensive || 0) + countCategoryPicks(draftRecord.picks, 'defensive')
      },

      // Individual asset pick counts
      assetPickCounts: updateAssetPickCounts(current.assetPickCounts || {}, draftRecord.picks),

      lastUpdated: serverTimestamp()
    };

    // Track unique human players
    const humanPlayerIds = draftRecord.players
      .filter(p => !p.isCPU)
      .map(p => p.odUserId)
      .filter(Boolean);

    const uniquePlayers = new Set([
      ...(current.uniqueHumanPlayers || []),
      ...humanPlayerIds
    ]);
    updated.uniqueHumanPlayers = Array.from(uniquePlayers);
    updated.uniqueHumanPlayerCount = updated.uniqueHumanPlayers.length;

    // Write updated aggregates
    await setDoc(aggregateRef, removeUndefined(updated));

    console.log(`[DraftAnalytics] Updated ${assetType} aggregates (total drafts: ${updated.totalDrafts})`);
    return { success: true };

  } catch (error) {
    console.error('[DraftAnalytics] Error updating aggregates:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update per-user draft statistics
 * @param {string} odUserId - User ID
 * @param {Array} picks - User's picks from this draft
 * @param {string} draftId - Draft ID
 * @param {string} assetType - 'stocks' or 'crypto'
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const updateUserDraftStats = async (odUserId, picks, draftId, assetType) => {
  try {
    const userStatsRef = doc(db, 'draftUserStats', odUserId);

    // Read current user stats
    const userSnap = await getDoc(userStatsRef);
    const current = userSnap.exists() ? userSnap.data() : getDefaultUserStats();

    // Update counts
    const updatedAssetPickCounts = updateAssetPickCounts(
      current.assetPickCounts || {},
      picks
    );

    const updated = {
      odUserId,
      totalDrafts: (current.totalDrafts || 0) + 1,
      stockDrafts: (current.stockDrafts || 0) + (assetType === 'stocks' ? 1 : 0),
      cryptoDrafts: (current.cryptoDrafts || 0) + (assetType === 'crypto' ? 1 : 0),

      // Recent draft IDs (keep last 20)
      recentDraftIds: [draftId, ...(current.recentDraftIds || [])].slice(0, 20),

      // Asset pick frequency for this user
      assetPickCounts: updatedAssetPickCounts,

      // Favorite assets (top 10 most picked)
      favoriteAssets: calculateFavoriteAssets(updatedAssetPickCounts),

      lastDraftAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    };

    // Write updated stats
    await setDoc(userStatsRef, removeUndefined(updated));

    console.log(`[DraftAnalytics] Updated user stats for ${odUserId} (total drafts: ${updated.totalDrafts})`);
    return { success: true };

  } catch (error) {
    console.error(`[DraftAnalytics] Error updating user stats for ${odUserId}:`, error);
    return { success: false, error: error.message };
  }
};

export default {
  buildPicksArray,
  logDraftToAnalytics,
  updateDraftAggregates,
  updateUserDraftStats
};
