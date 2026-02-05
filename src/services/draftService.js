// src/services/draftService.js
// Draft Mode Firebase Service

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  arrayUnion,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { getAssetPool, generateSnakeOrder, generateDraftCode, shuffleArray } from './draftAssets';
import { initializeFreeAgents, calculateBattleEndTime } from './freeAgencyService';
import { logDraftToAnalytics } from './draftAnalyticsService';
// EODHD API - All-in-one provider (replaces Finnhub + CoinGecko)
import {
  getStockPrice,
  getCryptoPrice,
  getAllCryptoPrices,
  getAllStockPrices,
  symbolToCoinGeckoId,
  FALLBACK_CRYPTO_PRICES,
  FALLBACK_STOCK_PRICES
} from './eodhdAPI';

// ============================================
// HELPER FUNCTIONS
// ============================================

// Remove undefined values from an object (Firebase doesn't allow undefined)
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

// ============================================
// DRAFT CREATION
// ============================================

/**
 * Create a multiplayer draft lobby (waiting for players)
 * @param {string} userId - Creator's user ID
 * @param {string} username - Creator's username
 * @param {string} type - 'stocks' or 'crypto'
 * @param {number} startTimeMinutes - Minutes until draft auto-starts (default 30)
 */
export async function createMultiplayerDraft(userId, username, type, startTimeMinutes = 30) {
  const code = generateDraftCode();
  const draftId = `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Calculate scheduled start time
  const scheduledStart = new Date(Date.now() + startTimeMinutes * 60000).toISOString();

  const draft = {
    id: draftId,
    type, // 'stocks' or 'crypto'
    status: 'waiting',
    code,
    isTraining: false,
    players: [{
      odUserId: userId,
      odUsername: username,
      displayName: username,
      isHost: true,
      isCPU: false,
      picks: [],
      pickCategories: [],
      categories: { steady: 0, risky: 0, defensive: 0 },
      lastSeen: new Date().toISOString(),
      isAbsent: false
    }],
    playerIds: [userId], // For querying active drafts
    hostId: userId,
    currentRound: 0,
    currentPickIndex: -1,
    currentPlayerId: null,
    pickDeadline: null,
    draftOrder: generateSnakeOrder(4, 9),
    picks: [],
    availableAssets: getAssetPool(type),
    createdAt: serverTimestamp(),
    scheduledStart, // When the draft should start
    startTimeMinutes, // Original minutes setting
    startedAt: null,
    completedAt: null,
    battleId: null
  };

  await setDoc(doc(db, 'drafts', draftId), draft);
  return draft;
}

/**
 * Create a training draft with 1 human + 3 CPUs
 */
export async function createTrainingDraft(userId, username, type) {
  const code = generateDraftCode();
  const draftId = `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Generate CPU players
  const cpuNames = ['TradeBot Alpha', 'MarketMind', 'StockSage', 'CryptoKing',
                    'WallStreetBot', 'BullishBot', 'BearHunter', 'DiamondHands'];
  const shuffledNames = shuffleArray(cpuNames).slice(0, 3);

  const cpuPlayers = shuffledNames.map((name, i) => ({
    odUserId: `cpu_${i + 1}_${Date.now()}`,
    odUsername: name,
    displayName: name,
    isHost: false,
    isCPU: true,
    picks: [],
    pickCategories: [],
    categories: { steady: 0, risky: 0, defensive: 0 }
  }));

  // Human player + 3 CPUs
  const allPlayers = [
    {
      odUserId: userId,
      odUsername: username,
      displayName: username,
      isHost: true,
      isCPU: false,
      picks: [],
      pickCategories: [],
      categories: { steady: 0, risky: 0, defensive: 0 },
      lastSeen: new Date().toISOString(),
      isAbsent: false
    },
    ...cpuPlayers
  ];

  // Shuffle player order for fairness
  const shuffledPlayers = shuffleArray(allPlayers);

  // Find first picker
  const draftOrder = generateSnakeOrder(4, 9);
  const firstPlayerIndex = draftOrder[0];
  const firstPlayerId = shuffledPlayers[firstPlayerIndex].odUserId;

  const pickDeadline = Timestamp.fromDate(new Date(Date.now() + 2 * 60 * 1000));

  const draft = {
    id: draftId,
    type,
    status: 'active', // Training starts immediately
    code,
    isTraining: true,
    players: shuffledPlayers,
    playerIds: [userId], // For querying active drafts
    hostId: userId,
    currentRound: 1,
    currentPickIndex: 0,
    currentPlayerId: firstPlayerId,
    pickDeadline,
    draftOrder,
    picks: [],
    availableAssets: getAssetPool(type),
    createdAt: serverTimestamp(),
    startedAt: serverTimestamp(),
    completedAt: null,
    battleId: null
  };

  await setDoc(doc(db, 'drafts', draftId), draft);

  // If first picker is CPU, trigger their pick after 3 seconds
  if (shuffledPlayers[firstPlayerIndex].isCPU) {
    setTimeout(() => processCPUTurn(draftId), 3000);
  }

  return draft;
}

// ============================================
// DRAFT JOINING
// ============================================

/**
 * Join a draft by code
 */
export async function joinDraftByCode(code, userId, username) {
  const draftsRef = collection(db, 'drafts');
  const q = query(draftsRef, where('code', '==', code.toUpperCase()), where('status', '==', 'waiting'));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    throw new Error('Draft not found or already started');
  }

  const draftDoc = snapshot.docs[0];
  const draft = { id: draftDoc.id, ...draftDoc.data() };

  // Check if already in draft
  if (draft.players.some(p => p.odUserId === userId)) {
    return draft;
  }

  // Check if full
  if (draft.players.length >= 4) {
    throw new Error('Draft is full');
  }

  const newPlayer = {
    odUserId: userId,
    odUsername: username,
    displayName: username,
    isHost: false,
    isCPU: false,
    picks: [],
    pickCategories: [],
    categories: { steady: 0, risky: 0, defensive: 0 },
    lastSeen: new Date().toISOString(),
    isAbsent: false
  };

  await updateDoc(doc(db, 'drafts', draft.id), {
    players: arrayUnion(newPlayer),
    playerIds: arrayUnion(userId)
  });

  return { ...draft, players: [...draft.players, newPlayer] };
}

/**
 * Get draft by ID
 */
export async function getDraft(draftId) {
  const draftDoc = await getDoc(doc(db, 'drafts', draftId));
  if (!draftDoc.exists()) return null;
  return { id: draftDoc.id, ...draftDoc.data() };
}

// ============================================
// DRAFT CONTROL
// ============================================

/**
 * Start the draft (host only)
 */
export async function startDraft(draftId) {
  const draft = await getDraft(draftId);

  if (!draft) throw new Error('Draft not found');
  if (draft.players.length !== 4) throw new Error('Need 4 players');
  if (draft.status !== 'waiting') throw new Error('Draft already started');

  // Shuffle players for random order
  const shuffledPlayers = shuffleArray([...draft.players]);

  const draftOrder = draft.draftOrder;
  const firstPlayerIndex = draftOrder[0];
  const firstPlayerId = shuffledPlayers[firstPlayerIndex].odUserId;

  const pickDeadline = Timestamp.fromDate(new Date(Date.now() + 2 * 60 * 1000));

  await updateDoc(doc(db, 'drafts', draftId), removeUndefined({
    status: 'active',
    players: shuffledPlayers,
    currentRound: 1,
    currentPickIndex: 0,
    currentPlayerId: firstPlayerId,
    pickDeadline,
    startedAt: serverTimestamp()
  }));
}

/**
 * Leave a draft lobby (host and players can both leave)
 * Lobby remains active - only auto-disbands when scheduled time arrives with <4 players
 */
export async function leaveDraft(draftId, userId) {
  const draft = await getDraft(draftId);

  if (!draft) throw new Error('Draft not found');
  if (draft.status !== 'waiting') throw new Error('Cannot leave after draft started');

  const updatedPlayers = draft.players.filter(p => p.odUserId !== userId);
  const updatedPlayerIds = draft.playerIds?.filter(id => id !== userId) || [];

  // If host leaves, reassign host to next player (if any remain)
  let newHostId = draft.hostId;
  if (draft.hostId === userId && updatedPlayers.length > 0) {
    newHostId = updatedPlayers[0].odUserId;
    updatedPlayers[0] = { ...updatedPlayers[0], isHost: true };
  }

  await updateDoc(doc(db, 'drafts', draftId), {
    players: updatedPlayers,
    playerIds: updatedPlayerIds,
    hostId: newHostId
  });
}

/**
 * Cancel a draft (host only)
 */
export async function cancelDraft(draftId) {
  await updateDoc(doc(db, 'drafts', draftId), {
    status: 'cancelled'
  });
}

// ============================================
// PICKING
// ============================================

/**
 * Make a pick
 */
export async function makePick(draftId, userId, asset, isAutopick = false) {
  const draft = await getDraft(draftId);

  if (!draft) throw new Error('Draft not found');
  if (draft.status !== 'active') throw new Error('Draft not active');

  // Find player
  const playerIndex = draft.players.findIndex(p => p.odUserId === userId);
  if (playerIndex === -1) throw new Error('Player not in draft');

  const player = draft.players[playerIndex];

  // Validate it's their turn (unless autopick)
  if (!isAutopick && draft.currentPlayerId !== userId) {
    throw new Error('Not your turn');
  }

  // Validate pick deadline hasn't passed (skip for autopick - autopick IS the timeout handler)
  if (!isAutopick && draft.pickDeadline) {
    const deadline = draft.pickDeadline.toDate
      ? draft.pickDeadline.toDate()
      : new Date(draft.pickDeadline);
    if (Date.now() > deadline.getTime()) {
      throw new Error('Pick deadline expired');
    }
  }

  // Validate category limit
  if (player.categories[asset.category] >= 3) {
    throw new Error(`Already have 3 ${asset.category} picks`);
  }

  // Create pick record - use ISO string for timestamp since this goes into arrayUnion
  const pick = {
    pickNumber: draft.currentPickIndex + 1,
    round: Math.floor(draft.currentPickIndex / 4) + 1,
    playerId: userId,
    playerIndex,
    asset: {
      symbol: asset.symbol,
      name: asset.name,
      category: asset.category
    },
    timestamp: new Date().toISOString(),
    isAutopick
  };

  // Update player with pickCategories for roster display
  const updatedPlayers = [...draft.players];
  updatedPlayers[playerIndex] = {
    ...player,
    picks: [...(player.picks || []), asset.symbol],
    pickCategories: [...(player.pickCategories || []), asset.category],
    categories: {
      ...player.categories,
      [asset.category]: (player.categories?.[asset.category] || 0) + 1
    }
  };

  // Remove from available
  const updatedAvailable = { ...draft.availableAssets };
  updatedAvailable[asset.category] = updatedAvailable[asset.category]
    .filter(a => a.symbol !== asset.symbol);

  // Next pick
  const nextPickIndex = draft.currentPickIndex + 1;
  const isComplete = nextPickIndex >= 36;

  let nextPlayerId = null;
  let nextDeadline = null;

  if (!isComplete) {
    const nextPlayerIndex = draft.draftOrder[nextPickIndex];
    nextPlayerId = updatedPlayers[nextPlayerIndex].odUserId;
    nextDeadline = Timestamp.fromDate(new Date(Date.now() + 2 * 60 * 1000));
  }

  // Build update object
  // Create lastPick data for display in draft room
  const lastPickData = {
    odUserId: userId,
    displayName: player.displayName,
    symbol: asset.symbol,
    category: asset.category,
    timestamp: new Date().toISOString(),
    isCPU: player.isCPU || false,
    pickNumber: draft.currentPickIndex + 1
  };

  const updateData = {
    players: updatedPlayers,
    picks: arrayUnion(pick),
    availableAssets: updatedAvailable,
    currentPickIndex: nextPickIndex,
    currentPlayerId: nextPlayerId,
    pickDeadline: nextDeadline,
    lastPick: lastPickData,
    currentRound: Math.floor(nextPickIndex / 4) + 1
  };

  // If draft is complete, initialize battle
  if (isComplete) {
    const now = new Date().toISOString();

    // Initialize free agents (undrafted assets)
    const freeAgents = initializeFreeAgents({
      ...draft,
      players: updatedPlayers
    });

    // Calculate battle end time
    const battleEndTime = calculateBattleEndTime(draft.type, now);

    // Store original picks for each player (before any swaps)
    const playersWithOriginalPicks = updatedPlayers.map(player => ({
      ...player,
      originalPicks: [...player.picks]
    }));

    updateData.players = playersWithOriginalPicks;
    updateData.status = 'battle';
    updateData.completedAt = serverTimestamp();
    updateData.battleStartTime = now;
    updateData.battleEndTime = battleEndTime;
    updateData.freeAgents = freeAgents;
    updateData.swapHistory = [];
    updateData.dailySwaps = {};
  }

  await updateDoc(doc(db, 'drafts', draftId), removeUndefined(updateData));

  // Log analytics when draft completes (non-blocking)
  if (isComplete) {
    const completedDraft = {
      ...draft,
      ...updateData,
      id: draftId
    };

    logDraftToAnalytics(completedDraft).catch(err => {
      console.error('[DraftService] Analytics logging failed (non-blocking):', err);
    });
  }

  return { pick, isComplete };
}

/**
 * Handle autopick when timer expires
 */
export async function handleAutopick(draftId, userId) {
  const draft = await getDraft(draftId);
  if (!draft || draft.status !== 'active') return;

  const player = draft.players.find(p => p.odUserId === userId);
  if (!player) return;

  // Find needed category
  const neededCategories = [];
  if (player.categories.steady < 3) neededCategories.push('steady');
  if (player.categories.risky < 3) neededCategories.push('risky');
  if (player.categories.defensive < 3) neededCategories.push('defensive');

  if (neededCategories.length === 0) return;

  const category = neededCategories[Math.floor(Math.random() * neededCategories.length)];
  const available = draft.availableAssets[category];

  if (available.length === 0) return;

  const asset = {
    ...available[Math.floor(Math.random() * available.length)],
    category
  };

  return makePick(draftId, userId, asset, true);
}

// ============================================
// CPU LOGIC
// ============================================

/**
 * Process CPU turn with 3-second delay
 */
export async function processCPUTurn(draftId) {
  // 3-second delay for CPU/absent players
  await new Promise(resolve => setTimeout(resolve, 3000));

  const draft = await getDraft(draftId);
  if (!draft || draft.status !== 'active') return;

  const currentPlayer = draft.players.find(p => p.odUserId === draft.currentPlayerId);
  if (!currentPlayer || !currentPlayer.isCPU) return;

  // Generate pick
  const neededCategories = [];
  if (currentPlayer.categories.steady < 3) neededCategories.push('steady');
  if (currentPlayer.categories.risky < 3) neededCategories.push('risky');
  if (currentPlayer.categories.defensive < 3) neededCategories.push('defensive');

  const category = neededCategories[Math.floor(Math.random() * neededCategories.length)];
  const available = draft.availableAssets[category];

  if (available.length === 0) return;

  const asset = {
    ...available[Math.floor(Math.random() * available.length)],
    category
  };

  const result = await makePick(draftId, draft.currentPlayerId, asset, false);

  // Check if next player is also CPU
  if (!result.isComplete) {
    const updatedDraft = await getDraft(draftId);
    const nextPlayer = updatedDraft.players.find(p => p.odUserId === updatedDraft.currentPlayerId);
    if (nextPlayer?.isCPU) {
      processCPUTurn(draftId);
    }
  }
}

// ============================================
// SUBSCRIPTIONS
// ============================================

/**
 * Subscribe to draft updates
 */
export function subscribeToDraft(draftId, callback) {
  return onSnapshot(doc(db, 'drafts', draftId), (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() });
    } else {
      callback(null);
    }
  });
}

// ============================================
// DRAFT HISTORY & ARCHIVE (Phase 4)
// ============================================

/**
 * Archive a completed draft
 */
export async function archiveDraft(draftId) {
  try {
    const draftRef = doc(db, 'drafts', draftId);
    await updateDoc(draftRef, removeUndefined({
      archived: true,
      archivedAt: serverTimestamp()
    }));
    return { success: true };
  } catch (error) {
    console.error('Error archiving draft:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's draft history (includes completed and battle status)
 */
export async function getUserDraftHistory(userId, limitCount = 20) {
  try {
    const draftsRef = collection(db, 'drafts');
    const q = query(
      draftsRef,
      where('status', 'in', ['completed', 'battle'])
    );

    const snapshot = await getDocs(q);
    // Filter locally for playerIds since array-contains may have issues
    const drafts = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(draft => draft.players?.some(p => p.odUserId === userId))
      .slice(0, limitCount);

    return drafts;
  } catch (error) {
    console.error('Error fetching draft history:', error);
    return [];
  }
}

/**
 * Get draft statistics for a user
 */
export async function getUserDraftStats(userId) {
  try {
    const drafts = await getUserDraftHistory(userId, 100);

    return {
      totalDrafts: drafts.length,
      trainingDrafts: drafts.filter(d => d.isTraining).length,
      multiplayerDrafts: drafts.filter(d => !d.isTraining).length,
      stockDrafts: drafts.filter(d => d.type === 'stocks').length,
      cryptoDrafts: drafts.filter(d => d.type === 'crypto').length
    };
  } catch (error) {
    console.error('Error fetching draft stats:', error);
    return {
      totalDrafts: 0,
      trainingDrafts: 0,
      multiplayerDrafts: 0,
      stockDrafts: 0,
      cryptoDrafts: 0
    };
  }
}

// ============================================
// EDGE CASE HANDLING (Phase 4)
// ============================================

/**
 * Handle player disconnect/timeout
 */
export async function handlePlayerDisconnect(draftId, playerId) {
  try {
    const draftRef = doc(db, 'drafts', draftId);
    const draftSnap = await getDoc(draftRef);

    if (!draftSnap.exists()) return { success: false, error: 'Draft not found' };

    const draft = draftSnap.data();

    // If it's the current player's turn, trigger autopick
    if (draft.currentPlayerId === playerId && draft.status === 'active') {
      await handleAutopick(draftId, playerId);
    }

    // Mark player as disconnected
    const updatedPlayers = draft.players.map(p =>
      p.odUserId === playerId
        ? { ...p, disconnected: true, disconnectedAt: new Date().toISOString() }
        : p
    );

    await updateDoc(draftRef, removeUndefined({
      players: updatedPlayers,
      updatedAt: serverTimestamp()
    }));

    return { success: true };
  } catch (error) {
    console.error('Error handling disconnect:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if draft should be cancelled due to disconnects
 */
export async function checkDraftHealth(draftId) {
  try {
    const draftRef = doc(db, 'drafts', draftId);
    const draftSnap = await getDoc(draftRef);

    if (!draftSnap.exists()) return { healthy: false };

    const draft = draftSnap.data();

    // Count disconnected players
    const disconnectedCount = draft.players.filter(p => p.disconnected && !p.isCPU).length;
    const humanCount = draft.players.filter(p => !p.isCPU).length;

    // If more than half of humans disconnected, cancel draft
    if (disconnectedCount > humanCount / 2) {
      await updateDoc(draftRef, removeUndefined({
        status: 'cancelled',
        cancelReason: 'Too many players disconnected',
        cancelledAt: serverTimestamp()
      }));
      return { healthy: false, cancelled: true };
    }

    return { healthy: true };
  } catch (error) {
    console.error('Error checking draft health:', error);
    return { healthy: false, error: error.message };
  }
}

// ============================================
// PRESENCE & REJOIN (Draft Fixes)
// ============================================

/**
 * Update player presence (call periodically from client)
 */
export async function updatePlayerPresence(draftId, playerId) {
  try {
    const draftRef = doc(db, 'drafts', draftId);
    const draftSnap = await getDoc(draftRef);

    if (!draftSnap.exists()) return;

    const draft = draftSnap.data();
    const updatedPlayers = draft.players.map(p =>
      p.odUserId === playerId
        ? { ...p, lastSeen: new Date().toISOString(), isAbsent: false, disconnected: false }
        : p
    );

    await updateDoc(draftRef, removeUndefined({
      players: updatedPlayers
    }));
  } catch (error) {
    console.error('Error updating presence:', error);
  }
}

/**
 * Check and mark absent players (no activity for 30+ seconds)
 */
export async function checkAbsentPlayers(draftId) {
  try {
    const draftRef = doc(db, 'drafts', draftId);
    const draftSnap = await getDoc(draftRef);

    if (!draftSnap.exists()) return null;

    const draft = draftSnap.data();
    const now = Date.now();
    const ABSENT_THRESHOLD = 30 * 1000; // 30 seconds

    const updatedPlayers = draft.players.map(p => {
      if (p.isCPU) return p; // CPUs are always "present"

      const lastSeen = p.lastSeen ? new Date(p.lastSeen).getTime() : 0;
      const isAbsent = (now - lastSeen) > ABSENT_THRESHOLD;

      return { ...p, isAbsent };
    });

    await updateDoc(draftRef, removeUndefined({
      players: updatedPlayers
    }));

    return updatedPlayers;
  } catch (error) {
    console.error('Error checking absent players:', error);
    return null;
  }
}

/**
 * Get user's active draft (if any) for rejoin functionality
 */
export async function getUserActiveDraft(userId) {
  try {
    const draftsRef = collection(db, 'drafts');

    // Query for drafts where user is a player and status is waiting or active
    const q = query(
      draftsRef,
      where('status', 'in', ['waiting', 'active'])
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    // Filter locally to find drafts where user is a player
    const drafts = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(draft =>
        draft.playerIds?.includes(userId) ||
        draft.players?.some(p => p.odUserId === userId)
      );

    if (drafts.length === 0) return null;

    // Prefer 'active' over 'waiting'
    const activeDraft = drafts.find(d => d.status === 'active');
    if (activeDraft) return activeDraft;

    return drafts[0]; // Return waiting draft if no active
  } catch (error) {
    console.error('Error fetching active draft:', error);
    return null;
  }
}

/**
 * Check if current player needs autopick (CPU or absent)
 */
export function shouldAutoPickForPlayer(draft, playerId) {
  if (!draft || draft.status !== 'active') return false;
  if (draft.currentPlayerId !== playerId) return false;

  const player = draft.players?.find(p => p.odUserId === playerId);
  if (!player) return false;

  // Autopick if CPU or disconnected/absent
  return player.isCPU || player.disconnected || player.isAbsent;
}

// ============================================
// LOCKED PRICES (Battle Mode)
// ============================================

/**
 * Fetch and store locked prices when draft completes
 * Called when draft transitions to 'battle' status
 * Uses batch fetching with proper symbol-to-CoinGecko ID conversion
 */
export async function storeDraftLockedPrices(draftId) {
  try {
    const draft = await getDraft(draftId);
    if (!draft) {
      console.error('Draft not found for storing locked prices:', draftId);
      return { success: false, error: 'Draft not found' };
    }

    // Collect all unique symbols from all players' picks
    const allSymbols = new Set();
    draft.players.forEach(player => {
      if (player.picks) {
        player.picks.forEach(symbol => allSymbols.add(symbol));
      }
    });

    if (allSymbols.size === 0) {
      console.warn('No picks found in draft:', draftId);
      return { success: false, error: 'No picks found' };
    }

    const symbolsArray = Array.from(allSymbols);
    console.log(`📊 Fetching locked prices for ${symbolsArray.length} assets:`, symbolsArray);

    // Fetch current prices using batch API (1 call instead of N calls)
    const lockedPrices = {};

    try {
      if (draft.type === 'crypto') {
        // Use batch crypto price fetching with automatic symbol→ID conversion
        const priceData = await getAllCryptoPrices(symbolsArray);

        // Map prices back to original symbols
        for (const symbol of symbolsArray) {
          const coinGeckoId = symbolToCoinGeckoId(symbol);
          const data = priceData[coinGeckoId];

          if (data && data.price > 0) {
            lockedPrices[symbol] = data.price;
            console.log(`  ${symbol} (${coinGeckoId}): $${data.price}`);
          } else {
            // Use fallback price from stockAPI (real historical prices, not $100)
            const fallbackPrice = FALLBACK_CRYPTO_PRICES[coinGeckoId] || 1;
            lockedPrices[symbol] = fallbackPrice;
            console.warn(`  ${symbol}: Using fallback price $${fallbackPrice}`);
          }
        }
      } else {
        // Use batch stock price fetching
        const priceData = await getAllStockPrices(symbolsArray);

        for (const symbol of symbolsArray) {
          const upperSymbol = symbol.toUpperCase();
          const data = priceData[upperSymbol];

          if (data && data.price > 0) {
            lockedPrices[symbol] = data.price;
            console.log(`  ${symbol}: $${data.price}`);
          } else {
            // Use fallback price
            const fallbackPrice = FALLBACK_STOCK_PRICES[upperSymbol] || 100;
            lockedPrices[symbol] = fallbackPrice;
            console.warn(`  ${symbol}: Using fallback price $${fallbackPrice}`);
          }
        }
      }
    } catch (batchError) {
      console.error('Batch price fetch failed:', batchError);

      // Fallback: use individual fetches with proper fallback prices
      for (const symbol of symbolsArray) {
        try {
          if (draft.type === 'crypto') {
            const coinGeckoId = symbolToCoinGeckoId(symbol);
            const priceData = await getCryptoPrice(coinGeckoId);
            lockedPrices[symbol] = priceData.price || FALLBACK_CRYPTO_PRICES[coinGeckoId] || 1;
          } else {
            const priceData = await getStockPrice(symbol);
            lockedPrices[symbol] = priceData.price || FALLBACK_STOCK_PRICES[symbol] || 100;
          }
        } catch (err) {
          const coinGeckoId = symbolToCoinGeckoId(symbol);
          lockedPrices[symbol] = draft.type === 'crypto'
            ? (FALLBACK_CRYPTO_PRICES[coinGeckoId] || 1)
            : (FALLBACK_STOCK_PRICES[symbol] || 100);
          console.warn(`Using fallback for ${symbol}: $${lockedPrices[symbol]}`);
        }
      }
    }

    // Store locked prices in draft document
    const draftRef = doc(db, 'drafts', draftId);
    await updateDoc(draftRef, {
      lockedPrices,
      lockedPricesAt: serverTimestamp()
    });

    console.log('✅ Locked prices stored successfully:', lockedPrices);
    return { success: true, lockedPrices };
  } catch (error) {
    console.error('Error storing locked prices:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Complete a draft battle and calculate final standings
 * Called when battle time expires
 * Uses batch fetching with proper symbol-to-CoinGecko ID conversion
 */
export async function completeDraftBattle(battleId, battleData) {
  try {
    // If already completed, skip
    if (battleData.status === 'completed') {
      console.log(`Battle ${battleId} already completed, skipping`);
      return { success: true, alreadyCompleted: true };
    }

    console.log(`🏁 Completing draft battle ${battleId}...`);

    // Collect all unique symbols from all players
    const allSymbols = new Set();
    battleData.players.forEach(player => {
      (player.picks || []).forEach(symbol => allSymbols.add(symbol));
    });
    const symbolsArray = Array.from(allSymbols);

    // Batch fetch all current prices at once
    let currentPrices = {};
    try {
      if (battleData.type === 'crypto') {
        const priceData = await getAllCryptoPrices(symbolsArray);
        for (const symbol of symbolsArray) {
          const coinGeckoId = symbolToCoinGeckoId(symbol);
          currentPrices[symbol] = priceData[coinGeckoId]?.price || FALLBACK_CRYPTO_PRICES[coinGeckoId] || 1;
        }
      } else {
        const priceData = await getAllStockPrices(symbolsArray);
        for (const symbol of symbolsArray) {
          currentPrices[symbol] = priceData[symbol.toUpperCase()]?.price || FALLBACK_STOCK_PRICES[symbol] || 100;
        }
      }
    } catch (batchError) {
      console.error('Batch fetch failed in completeDraftBattle:', batchError);
      // Prices will use fallbacks in the calculation below
    }

    // Calculate final standings for each player
    const finalStandings = battleData.players.map((player) => {
      let totalGain = 0;
      const assetGains = [];

      for (const symbol of player.picks || []) {
        const currentPrice = currentPrices[symbol] ||
          (battleData.type === 'crypto'
            ? FALLBACK_CRYPTO_PRICES[symbolToCoinGeckoId(symbol)] || 1
            : FALLBACK_STOCK_PRICES[symbol] || 100);

        const lockedPrice = battleData.lockedPrices?.[symbol] || currentPrice;

        if (lockedPrice > 0 && currentPrice > 0) {
          const gain = ((currentPrice - lockedPrice) / lockedPrice) * 100;
          totalGain += gain / 9; // Equal weight (9 picks)
          assetGains.push({
            symbol,
            lockedPrice,
            finalPrice: currentPrice,
            gain: parseFloat(gain.toFixed(2))
          });
        }
      }

      return {
        odUserId: player.odUserId,
        displayName: player.displayName,
        isCPU: player.isCPU || false,
        finalGain: parseFloat(totalGain.toFixed(2)),
        picks: player.picks,
        assetGains
      };
    });

    // Sort by gain to determine rankings
    finalStandings.sort((a, b) => b.finalGain - a.finalGain);

    // Assign final ranks
    finalStandings.forEach((player, index) => {
      player.finalRank = index + 1;
    });

    // Determine winner
    const winner = finalStandings[0];

    // Store final prices for history
    const finalPrices = {};
    for (const standing of finalStandings) {
      for (const asset of standing.assetGains || []) {
        finalPrices[asset.symbol] = asset.finalPrice;
      }
    }

    // Update the battle document
    const battleRef = doc(db, 'drafts', battleId);
    await updateDoc(battleRef, removeUndefined({
      status: 'completed',
      completedAt: serverTimestamp(),
      finalStandings: finalStandings,
      finalPrices: finalPrices,
      winner: {
        odUserId: winner.odUserId,
        displayName: winner.displayName,
        finalGain: winner.finalGain,
        isCPU: winner.isCPU || false
      }
    }));

    console.log(`✅ Battle ${battleId} completed. Winner: ${winner.displayName} with ${winner.finalGain}%`);

    return { success: true, winner, standings: finalStandings };
  } catch (error) {
    console.error('Error completing battle:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's completed draft battles for history
 */
export async function getUserCompletedDraftBattles(userId, limitCount = 20) {
  try {
    const draftsRef = collection(db, 'drafts');
    const q = query(
      draftsRef,
      where('status', '==', 'completed')
    );

    const snapshot = await getDocs(q);

    // Filter locally for user's battles
    const drafts = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(draft =>
        draft.playerIds?.includes(userId) ||
        draft.players?.some(p => p.odUserId === userId)
      )
      .slice(0, limitCount);

    return drafts;
  } catch (error) {
    console.error('Error fetching completed draft battles:', error);
    return [];
  }
}

// ============================================
// CLEANUP UTILITIES
// ============================================

/**
 * Delete old lobbies that don't have a scheduledStart time.
 * These are legacy lobbies created before the scheduled time feature was added.
 * Run this once to clean up old data.
 */
export async function cleanupOldLobbiesWithoutScheduledTime() {
  const lobbiesRef = collection(db, 'snakeDraftLobbies');

  // Get all waiting lobbies
  const q = query(lobbiesRef, where('status', '==', 'waiting'));
  const snapshot = await getDocs(q);

  let deletedCount = 0;
  const deletedLobbies = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();

    // Delete if no scheduledStart field
    if (!data.scheduledStart) {
      const hostName = data.host || data.players?.[0]?.username || 'Unknown';
      console.log(`Deleting lobby: ${docSnap.id} (host: ${hostName})`);
      deletedLobbies.push({ id: docSnap.id, host: hostName });
      await deleteDoc(doc(db, 'snakeDraftLobbies', docSnap.id));
      deletedCount++;
    }
  }

  console.log(`✅ Deleted ${deletedCount} old lobbies without scheduled time`);
  return { deletedCount, deletedLobbies };
}

export default {
  createMultiplayerDraft,
  createTrainingDraft,
  joinDraftByCode,
  getDraft,
  startDraft,
  leaveDraft,
  cancelDraft,
  makePick,
  handleAutopick,
  processCPUTurn,
  subscribeToDraft,
  archiveDraft,
  getUserDraftHistory,
  getUserDraftStats,
  handlePlayerDisconnect,
  checkDraftHealth,
  updatePlayerPresence,
  checkAbsentPlayers,
  getUserActiveDraft,
  shouldAutoPickForPlayer,
  storeDraftLockedPrices,
  completeDraftBattle,
  getUserCompletedDraftBattles,
  cleanupOldLobbiesWithoutScheduledTime
};
