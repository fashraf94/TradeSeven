// src/services/draftService.js
// Draft Mode Firebase Service

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
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
import { getStockPrice, getCryptoPrice } from './stockAPI';

// Crypto ID mapping for price fetching
const CRYPTO_ID_MAP = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'BNB': 'binancecoin',
  'SOL': 'solana',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'DOGE': 'dogecoin',
  'AVAX': 'avalanche-2',
  'DOT': 'polkadot',
  'MATIC': 'matic-network',
  'LINK': 'chainlink',
  'UNI': 'uniswap',
  'LTC': 'litecoin',
  'XLM': 'stellar',
  'XMR': 'monero',
  'ALGO': 'algorand',
  'ATOM': 'cosmos',
  'NEAR': 'near'
};

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
 */
export async function createMultiplayerDraft(userId, username, type) {
  const code = generateDraftCode();
  const draftId = `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
 * Leave a draft lobby
 */
export async function leaveDraft(draftId, userId) {
  const draft = await getDraft(draftId);

  if (!draft) throw new Error('Draft not found');
  if (draft.status !== 'waiting') throw new Error('Cannot leave after draft started');
  if (draft.hostId === userId) throw new Error('Host cannot leave - cancel instead');

  const updatedPlayers = draft.players.filter(p => p.odUserId !== userId);

  await updateDoc(doc(db, 'drafts', draftId), {
    players: updatedPlayers
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

    // Fetch current prices for all assets
    const lockedPrices = {};
    const pricePromises = symbolsArray.map(async (symbol) => {
      try {
        if (draft.type === 'crypto') {
          // Get crypto ID from mapping
          const cryptoId = CRYPTO_ID_MAP[symbol];
          if (cryptoId) {
            const priceData = await getCryptoPrice(cryptoId);
            lockedPrices[symbol] = priceData.price;
          } else {
            console.warn(`No crypto ID mapping for ${symbol}`);
            lockedPrices[symbol] = 100; // Fallback
          }
        } else {
          // Stocks
          const priceData = await getStockPrice(symbol);
          lockedPrices[symbol] = priceData.price;
        }
      } catch (error) {
        console.error(`Error fetching price for ${symbol}:`, error);
        lockedPrices[symbol] = 100; // Fallback price
      }
    });

    await Promise.all(pricePromises);

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
  storeDraftLockedPrices
};
