// src/services/freeAgencyService.js
// Free Agency System for Draft Battles

import { db } from '../firebase/config';
import { doc, getDoc, updateDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
// EODHD API - All-in-one provider (replaces Finnhub + CoinGecko)
import * as stockAPI from './eodhdAPI';
import { getAssetPool } from './draftAssets';

// ============================================
// TIMEZONE HELPERS
// ============================================

// Get current time in Central Time
const getCentralTime = () => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }));
};

// Get today's date string in CT (for daily swap tracking)
const getCentralDateString = () => {
  const ct = getCentralTime();
  return ct.toISOString().split('T')[0]; // "2025-01-13"
};

// ============================================
// FREE AGENCY WINDOW LOGIC
// ============================================

/**
 * Check if free agency window is currently open
 * Stocks: 3 PM CT - 11:59 PM CT
 * Crypto: 6 PM CT - 11:59 PM CT
 */
export const isFreeAgencyWindowOpen = (portfolioType) => {
  const ct = getCentralTime();
  const hour = ct.getHours();
  const minute = ct.getMinutes();
  const currentMinutes = hour * 60 + minute;

  if (portfolioType === 'stocks') {
    // 3 PM (15:00) to 11:59 PM (23:59) CT
    const windowStart = 15 * 60; // 3 PM = 900 minutes
    const windowEnd = 24 * 60 - 1; // 11:59 PM = 1439 minutes
    return currentMinutes >= windowStart && currentMinutes <= windowEnd;
  } else {
    // Crypto: 6 PM (18:00) to 11:59 PM (23:59) CT
    const windowStart = 18 * 60; // 6 PM = 1080 minutes
    const windowEnd = 24 * 60 - 1; // 11:59 PM = 1439 minutes
    return currentMinutes >= windowStart && currentMinutes <= windowEnd;
  }
};

/**
 * Get time until next window opens
 */
export const getTimeUntilWindowOpens = (portfolioType) => {
  const ct = getCentralTime();
  const hour = ct.getHours();
  const minute = ct.getMinutes();
  const currentMinutes = hour * 60 + minute;

  const windowStart = portfolioType === 'stocks' ? 15 * 60 : 18 * 60;

  let minutesUntil;
  if (currentMinutes < windowStart) {
    // Window opens later today
    minutesUntil = windowStart - currentMinutes;
  } else {
    // Window opens tomorrow
    minutesUntil = (24 * 60 - currentMinutes) + windowStart;
  }

  const hours = Math.floor(minutesUntil / 60);
  const mins = minutesUntil % 60;

  return { hours, minutes: mins, totalMinutes: minutesUntil };
};

/**
 * Get time until window closes
 */
export const getTimeUntilWindowCloses = (portfolioType) => {
  const ct = getCentralTime();
  const hour = ct.getHours();
  const minute = ct.getMinutes();
  const currentMinutes = hour * 60 + minute;

  const windowEnd = 24 * 60 - 1; // 11:59 PM
  const minutesUntil = windowEnd - currentMinutes;

  const hours = Math.floor(minutesUntil / 60);
  const mins = minutesUntil % 60;

  return { hours, minutes: mins, totalMinutes: minutesUntil };
};

// ============================================
// SWAP TRACKING
// ============================================

/**
 * Check how many swaps a player has made today
 */
export const getPlayerSwapsToday = async (draftId, odUserId) => {
  try {
    const draftRef = doc(db, 'drafts', draftId);
    const draftSnap = await getDoc(draftRef);

    if (!draftSnap.exists()) return 0;

    const draft = draftSnap.data();
    const today = getCentralDateString();

    return draft.dailySwaps?.[today]?.[odUserId] || 0;
  } catch (error) {
    console.error('Error getting swap count:', error);
    return 0;
  }
};

/**
 * Check if player can make a swap
 */
export const canPlayerSwap = async (draftId, odUserId, portfolioType) => {
  // Check window is open
  if (!isFreeAgencyWindowOpen(portfolioType)) {
    return { canSwap: false, reason: 'Free agency window is closed' };
  }

  // Check daily limit
  const swapsToday = await getPlayerSwapsToday(draftId, odUserId);
  if (swapsToday >= 2) {
    return { canSwap: false, reason: 'Daily swap limit reached (2/2)', swapsRemaining: 0 };
  }

  return { canSwap: true, swapsRemaining: 2 - swapsToday };
};

// ============================================
// FREE AGENT QUERIES
// ============================================

/**
 * Get available free agents for a category
 */
export const getFreeAgents = async (draftId, category = null) => {
  try {
    const draftRef = doc(db, 'drafts', draftId);
    const draftSnap = await getDoc(draftRef);

    if (!draftSnap.exists()) return category ? [] : { steady: [], risky: [], defensive: [] };

    const draft = draftSnap.data();

    if (category) {
      return draft.freeAgents?.[category] || [];
    }

    // Return all free agents organized by category
    return draft.freeAgents || { steady: [], risky: [], defensive: [] };
  } catch (error) {
    console.error('Error getting free agents:', error);
    return category ? [] : { steady: [], risky: [], defensive: [] };
  }
};

/**
 * Get player's current roster organized by category
 */
export const getPlayerRoster = async (draftId, odUserId) => {
  try {
    const draftRef = doc(db, 'drafts', draftId);
    const draftSnap = await getDoc(draftRef);

    if (!draftSnap.exists()) return null;

    const draft = draftSnap.data();
    const player = draft.players?.find(p => p.odUserId === odUserId);

    if (!player) return null;

    // Organize roster by category
    const roster = {
      steady: [],
      risky: [],
      defensive: []
    };

    player.picks.forEach((symbol, index) => {
      const category = player.pickCategories[index];
      roster[category].push({
        symbol,
        category,
        index
      });
    });

    return roster;
  } catch (error) {
    console.error('Error getting roster:', error);
    return null;
  }
};

// ============================================
// SWAP EXECUTION
// ============================================

/**
 * Execute a swap (drop one asset, add another)
 */
export const executeSwap = async (draftId, odUserId, dropSymbol, addSymbol) => {
  try {
    const draftRef = doc(db, 'drafts', draftId);

    return await runTransaction(db, async (transaction) => {
      const draftSnap = await transaction.get(draftRef);

      if (!draftSnap.exists()) {
        throw new Error('Draft not found');
      }

      const draft = draftSnap.data();
      const portfolioType = draft.type;

      // Validate window is open
      if (!isFreeAgencyWindowOpen(portfolioType)) {
        throw new Error('Free agency window is closed');
      }

      // Validate daily limit
      const today = getCentralDateString();
      const swapsToday = draft.dailySwaps?.[today]?.[odUserId] || 0;
      if (swapsToday >= 2) {
        throw new Error('Daily swap limit reached (2/2)');
      }

      // Find player
      const playerIndex = draft.players.findIndex(p => p.odUserId === odUserId);
      if (playerIndex === -1) {
        throw new Error('Player not found in draft');
      }

      const player = draft.players[playerIndex];

      // Find the asset being dropped
      const dropIndex = player.picks.findIndex(s => s === dropSymbol);
      if (dropIndex === -1) {
        throw new Error('Asset not in your roster');
      }

      const dropCategory = player.pickCategories[dropIndex];

      // Validate the add asset is a free agent in the same category
      const categoryFreeAgents = draft.freeAgents?.[dropCategory] || [];
      const addAssetIndex = categoryFreeAgents.findIndex(a => a.symbol === addSymbol);

      if (addAssetIndex === -1) {
        throw new Error(`${addSymbol} is not available as a free agent in ${dropCategory} category`);
      }

      const addAsset = categoryFreeAgents[addAssetIndex];

      // Get price for the new asset
      let priceAtSwap;
      if (portfolioType === 'stocks') {
        // Use closing price (fetch from API)
        try {
          const priceData = await stockAPI.getStockPrice(addSymbol);
          priceAtSwap = priceData.price;
        } catch (e) {
          console.error('Could not fetch stock price:', e);
          priceAtSwap = 0; // Allow swap even if price fetch fails
        }
      } else {
        // Crypto - use real-time price
        try {
          // Use symbol (ETH) not id (ethereum) - EODHD expects symbol format
          const cryptoData = await stockAPI.getCryptoPrice(addAsset.symbol || addSymbol);
          priceAtSwap = cryptoData.price;
        } catch (e) {
          console.error('Could not fetch crypto price:', e);
          priceAtSwap = 0; // Allow swap even if price fetch fails
        }
      }

      // Build updated data
      const updatedPlayers = [...draft.players];
      updatedPlayers[playerIndex] = {
        ...player,
        picks: player.picks.map((s, i) => i === dropIndex ? addSymbol : s),
        // pickCategories stays the same since category doesn't change
      };

      // Update free agents - remove added, add dropped
      const updatedFreeAgents = { ...draft.freeAgents };

      // Remove the added asset from free agents
      updatedFreeAgents[dropCategory] = categoryFreeAgents.filter(a => a.symbol !== addSymbol);

      // Add the dropped asset to free agents
      const droppedAssetData = {
        symbol: dropSymbol,
        name: dropSymbol, // We may not have the full name stored
        category: dropCategory
      };
      updatedFreeAgents[dropCategory] = [...updatedFreeAgents[dropCategory], droppedAssetData];

      // Update daily swaps
      const updatedDailySwaps = { ...draft.dailySwaps };
      if (!updatedDailySwaps[today]) {
        updatedDailySwaps[today] = {};
      }
      updatedDailySwaps[today][odUserId] = swapsToday + 1;

      // Add to swap history
      const swapRecord = {
        odUserId,
        displayName: player.displayName,
        droppedAsset: { symbol: dropSymbol, category: dropCategory },
        addedAsset: { symbol: addSymbol, category: dropCategory },
        timestamp: new Date().toISOString(),
        priceAtSwap
      };

      const updatedSwapHistory = [...(draft.swapHistory || []), swapRecord];

      // Commit the transaction
      transaction.update(draftRef, {
        players: updatedPlayers,
        freeAgents: updatedFreeAgents,
        dailySwaps: updatedDailySwaps,
        swapHistory: updatedSwapHistory,
        updatedAt: serverTimestamp()
      });

      return {
        success: true,
        swap: swapRecord,
        swapsRemaining: 1 - swapsToday // After this swap
      };
    });
  } catch (error) {
    console.error('Swap failed:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// SWAP HISTORY
// ============================================

/**
 * Get swap history for a draft
 */
export const getSwapHistory = async (draftId, odUserId = null) => {
  try {
    const draftRef = doc(db, 'drafts', draftId);
    const draftSnap = await getDoc(draftRef);

    if (!draftSnap.exists()) return [];

    const draft = draftSnap.data();
    let history = draft.swapHistory || [];

    if (odUserId) {
      history = history.filter(s => s.odUserId === odUserId);
    }

    // Sort by timestamp descending (most recent first)
    return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch (error) {
    console.error('Error getting swap history:', error);
    return [];
  }
};

// ============================================
// CPU SWAP LOGIC
// ============================================

/**
 * CPU makes a random swap (called during free agency window)
 */
export const processCPUSwap = async (draftId, cpuPlayer) => {
  try {
    const draftRef = doc(db, 'drafts', draftId);
    const draftSnap = await getDoc(draftRef);

    if (!draftSnap.exists()) return { success: false };

    const draft = draftSnap.data();

    // Check if CPU has swaps remaining
    const today = getCentralDateString();
    const swapsToday = draft.dailySwaps?.[today]?.[cpuPlayer.odUserId] || 0;

    if (swapsToday >= 2) {
      return { success: false, reason: 'CPU swap limit reached' };
    }

    // 50% chance CPU decides to swap
    if (Math.random() > 0.5) {
      return { success: false, reason: 'CPU chose not to swap' };
    }

    // Pick a random category that has free agents
    const categories = ['steady', 'risky', 'defensive'];
    const availableCategories = categories.filter(cat =>
      (draft.freeAgents?.[cat]?.length || 0) > 0
    );

    if (availableCategories.length === 0) {
      return { success: false, reason: 'No free agents available' };
    }

    const randomCategory = availableCategories[Math.floor(Math.random() * availableCategories.length)];

    // Find CPU's asset in that category
    const cpuPickIndex = cpuPlayer.pickCategories.findIndex(cat => cat === randomCategory);
    if (cpuPickIndex === -1) {
      return { success: false, reason: 'CPU has no asset in category' };
    }

    const dropSymbol = cpuPlayer.picks[cpuPickIndex];

    // Pick a random free agent from that category
    const freeAgentsInCategory = draft.freeAgents[randomCategory];
    const addAsset = freeAgentsInCategory[Math.floor(Math.random() * freeAgentsInCategory.length)];

    // Execute the swap
    return await executeSwap(draftId, cpuPlayer.odUserId, dropSymbol, addAsset.symbol);
  } catch (error) {
    console.error('CPU swap error:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// BATTLE INITIALIZATION
// ============================================

/**
 * Initialize free agents when draft becomes a battle
 * Returns the freeAgents object containing all undrafted assets
 */
export const initializeFreeAgents = (draft, allAssets = null) => {
  // Get all picked assets
  const allPicked = new Set();
  draft.players.forEach(player => {
    player.picks.forEach(symbol => allPicked.add(symbol));
  });

  // If no assets provided, get them from the draft type
  if (!allAssets) {
    allAssets = getAssetPool(draft.type);
  }

  // Organize unpicked assets by category
  const freeAgents = {
    steady: [],
    risky: [],
    defensive: []
  };

  Object.entries(allAssets).forEach(([category, assets]) => {
    assets.forEach(asset => {
      if (!allPicked.has(asset.symbol)) {
        freeAgents[category].push({
          symbol: asset.symbol,
          name: asset.name,
          category,
          id: asset.id // For crypto
        });
      }
    });
  });

  return freeAgents;
};

/**
 * Calculate battle end time
 * Stocks: Friday 3 PM CT
 * Crypto: 7 days after draft completion
 */
export const calculateBattleEndTime = (portfolioType, draftCompletedTime) => {
  const completed = new Date(draftCompletedTime);

  if (portfolioType === 'stocks') {
    // Find next Friday at 3 PM CT
    // Get current time in Central Time
    const ct = new Date(completed.toLocaleString("en-US", { timeZone: "America/Chicago" }));

    // Find days until Friday (Friday = 5)
    const dayOfWeek = ct.getDay();
    let daysUntilFriday = (5 - dayOfWeek + 7) % 7;

    // If it's Friday but after 3 PM, go to next Friday
    if (daysUntilFriday === 0 && ct.getHours() >= 15) {
      daysUntilFriday = 7;
    }

    // If days is 0 and it's before 3 PM, battle ends today
    if (daysUntilFriday === 0) {
      // Set to 3 PM CT today
      ct.setHours(15, 0, 0, 0);
      return ct.toISOString();
    }

    // Add days to get to Friday
    const endDate = new Date(ct);
    endDate.setDate(endDate.getDate() + daysUntilFriday);
    endDate.setHours(15, 0, 0, 0); // 3 PM CT

    return endDate.toISOString();
  } else {
    // Crypto: exactly 7 days after draft completion
    const endDate = new Date(completed.getTime() + (7 * 24 * 60 * 60 * 1000));
    return endDate.toISOString();
  }
};

/**
 * Check if battle has ended
 */
export const isBattleEnded = (battleEndTime) => {
  if (!battleEndTime) return false;
  return new Date() >= new Date(battleEndTime);
};

/**
 * Get time remaining in battle
 */
export const getBattleTimeRemaining = (battleEndTime) => {
  if (!battleEndTime) return null;

  const now = new Date();
  const end = new Date(battleEndTime);
  const diff = end - now;

  if (diff <= 0) {
    return { ended: true, days: 0, hours: 0, minutes: 0 };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { ended: false, days, hours, minutes };
};

export default {
  isFreeAgencyWindowOpen,
  getTimeUntilWindowOpens,
  getTimeUntilWindowCloses,
  getPlayerSwapsToday,
  canPlayerSwap,
  getFreeAgents,
  getPlayerRoster,
  executeSwap,
  getSwapHistory,
  processCPUSwap,
  initializeFreeAgents,
  calculateBattleEndTime,
  isBattleEnded,
  getBattleTimeRemaining
};
