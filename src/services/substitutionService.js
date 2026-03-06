// FantasyTrades TD Scoring - Bench & Substitution Service
// Handles bench roster management and mid-battle substitutions
//
// Substitution Windows (Eastern Time):
// - Window 1: 11:30 AM - 11:45 AM (after Morning Bell)
// - Window 2: 2:00 PM - 2:15 PM (after Midday)

import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { isCrypto } from './sessionScoringService.js';

// ============================================
// SUBSTITUTION RULES
// ============================================

/**
 * Substitution system rules and limits
 */
export const SUBSTITUTION_RULES = {
  MAX_SUBS_PER_BATTLE: 2,
  MAX_SUBS_PER_WINDOW: 1,
  BENCH_SLOTS: {
    stocks: 4,
    crypto: 1,
    total: 5
  },
  WINDOWS: {
    1: {
      id: 1,
      afterSession: 'MORNING_BELL',
      start: { hour: 11, minute: 30 },
      end: { hour: 11, minute: 45 },
      name: 'Post Morning Bell'
    },
    2: {
      id: 2,
      afterSession: 'MIDDAY',
      start: { hour: 14, minute: 0 },
      end: { hour: 14, minute: 15 },
      name: 'Post Midday'
    }
  }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate unique substitution ID
 */
function generateSubstitutionId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `sub_${timestamp}_${random}`;
}

/**
 * Get current time in Eastern timezone
 */
function getEasternTime() {
  const now = new Date();
  const etString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  return new Date(etString);
}

/**
 * Convert time object to minutes since midnight
 */
function timeToMinutes(time) {
  return time.hour * 60 + time.minute;
}

/**
 * Format time for display (e.g., "11:30 AM")
 */
function formatTime(hour, minute) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const displayMinute = minute.toString().padStart(2, '0');
  return `${displayHour}:${displayMinute} ${period}`;
}

/**
 * Get player's portfolio and bench from battle
 */
function getPlayerData(battle, playerId) {
  if (playerId === 'creator') {
    return {
      portfolio: battle.creator?.portfolio || [],
      bench: battle.creator?.bench || []
    };
  } else if (playerId === 'opponent') {
    return {
      portfolio: battle.opponent?.portfolio || [],
      bench: battle.opponent?.bench || []
    };
  }
  return { portfolio: [], bench: [] };
}

/**
 * Find asset in array by symbol
 */
function findAsset(assets, symbol) {
  return assets.find(a => a.symbol?.toUpperCase() === symbol.toUpperCase());
}

/**
 * Check if player has used a specific window
 */
function hasUsedWindow(substitutions, playerId, windowNumber) {
  if (!substitutions || !Array.isArray(substitutions)) {
    return false;
  }
  return substitutions.some(
    sub => sub.playerId === playerId && sub.window === windowNumber
  );
}

/**
 * Get player's substitution history
 */
function getPlayerSubstitutions(substitutions, playerId) {
  if (!substitutions || !Array.isArray(substitutions)) {
    return [];
  }
  return substitutions.filter(sub => sub.playerId === playerId);
}

/**
 * Check if symbol was previously removed (no re-entry rule)
 */
function wasRemovedPreviously(substitutions, playerId, symbol) {
  const playerSubs = getPlayerSubstitutions(substitutions, playerId);
  return playerSubs.some(sub => sub.outSymbol.toUpperCase() === symbol.toUpperCase());
}

// ============================================
// WINDOW DETECTION
// ============================================

/**
 * Get current substitution window if active
 *
 * @returns {Object|null} Window info or null if not in a window
 */
export function getCurrentSubstitutionWindow() {
  const et = getEasternTime();
  const currentMinutes = et.getHours() * 60 + et.getMinutes();
  const dayOfWeek = et.getDay();

  // No substitution windows on weekends
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return null;
  }

  for (const [windowNum, window] of Object.entries(SUBSTITUTION_RULES.WINDOWS)) {
    const startMinutes = timeToMinutes(window.start);
    const endMinutes = timeToMinutes(window.end);

    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      return {
        window: parseInt(windowNum),
        afterSession: window.afterSession,
        name: window.name,
        remainingMinutes: endMinutes - currentMinutes,
        startsAt: formatTime(window.start.hour, window.start.minute),
        endsAt: formatTime(window.end.hour, window.end.minute)
      };
    }
  }

  return null;
}

/**
 * Get next substitution window
 *
 * @returns {Object} Next window info with time until it starts
 */
export function getNextSubstitutionWindow() {
  const et = getEasternTime();
  const currentMinutes = et.getHours() * 60 + et.getMinutes();
  const dayOfWeek = et.getDay();

  // On weekends, next window is Monday
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 2;
    const window = SUBSTITUTION_RULES.WINDOWS[1];
    return {
      window: 1,
      afterSession: window.afterSession,
      name: window.name,
      startsIn: null, // Complex calculation for next week
      time: formatTime(window.start.hour, window.start.minute),
      dayDescription: `Monday at ${formatTime(window.start.hour, window.start.minute)}`
    };
  }

  // Find next window today
  for (const [windowNum, window] of Object.entries(SUBSTITUTION_RULES.WINDOWS)) {
    const startMinutes = timeToMinutes(window.start);

    if (currentMinutes < startMinutes) {
      return {
        window: parseInt(windowNum),
        afterSession: window.afterSession,
        name: window.name,
        startsIn: startMinutes - currentMinutes,
        time: formatTime(window.start.hour, window.start.minute),
        dayDescription: 'Today'
      };
    }
  }

  // All windows passed today, next is Window 1 tomorrow
  const window = SUBSTITUTION_RULES.WINDOWS[1];
  const minutesUntilMidnight = 24 * 60 - currentMinutes;
  const window1StartMinutes = timeToMinutes(window.start);

  return {
    window: 1,
    afterSession: window.afterSession,
    name: window.name,
    startsIn: minutesUntilMidnight + window1StartMinutes,
    time: formatTime(window.start.hour, window.start.minute),
    dayDescription: 'Tomorrow'
  };
}

/**
 * Check if a specific window is currently active
 *
 * @param {number} windowNumber - Window to check (1 or 2)
 * @returns {boolean}
 */
export function isWindowActive(windowNumber) {
  const current = getCurrentSubstitutionWindow();
  return current !== null && current.window === windowNumber;
}

// ============================================
// REMAINING SUBSTITUTIONS
// ============================================

/**
 * Get remaining substitution info for a player
 *
 * @param {Object} battle - Battle object
 * @param {string} playerId - 'creator' or 'opponent'
 * @returns {Object} Remaining subs info
 */
export function getRemainingSubstitutions(battle, playerId) {
  const substitutions = battle.substitutions || [];
  const playerSubs = getPlayerSubstitutions(substitutions, playerId);

  const usedCount = playerSubs.length;
  const remaining = SUBSTITUTION_RULES.MAX_SUBS_PER_BATTLE - usedCount;

  const usedWindows = playerSubs.map(sub => sub.window);
  const canUseWindow1 = !hasUsedWindow(substitutions, playerId, 1) && remaining > 0;
  const canUseWindow2 = !hasUsedWindow(substitutions, playerId, 2) && remaining > 0;

  return {
    remaining,
    used: usedCount,
    maxAllowed: SUBSTITUTION_RULES.MAX_SUBS_PER_BATTLE,
    usedWindows,
    canUseWindow1,
    canUseWindow2,
    substitutionHistory: playerSubs
  };
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate a substitution request
 *
 * @param {Object} battle - Battle object
 * @param {string} playerId - 'creator' or 'opponent'
 * @param {string} outSymbol - Symbol to remove from roster
 * @param {string} inSymbol - Symbol to add from bench
 * @param {number} windowNumber - Which window (1 or 2)
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateSubstitution(battle, playerId, outSymbol, inSymbol, windowNumber) {
  // Validate player ID
  if (playerId !== 'creator' && playerId !== 'opponent') {
    return { valid: false, error: 'Invalid player ID. Must be "creator" or "opponent".' };
  }

  // Validate window number
  if (windowNumber !== 1 && windowNumber !== 2) {
    return { valid: false, error: 'Invalid window number. Must be 1 or 2.' };
  }

  // Check if window is currently active
  const currentWindow = getCurrentSubstitutionWindow();
  if (!currentWindow || currentWindow.window !== windowNumber) {
    const windowInfo = SUBSTITUTION_RULES.WINDOWS[windowNumber];
    return {
      valid: false,
      error: `Substitution window ${windowNumber} is not active. Window is open ${formatTime(windowInfo.start.hour, windowInfo.start.minute)} - ${formatTime(windowInfo.end.hour, windowInfo.end.minute)} ET.`
    };
  }

  const substitutions = battle.substitutions || [];
  const { portfolio, bench } = getPlayerData(battle, playerId);

  // Check max substitutions per battle
  const playerSubs = getPlayerSubstitutions(substitutions, playerId);
  if (playerSubs.length >= SUBSTITUTION_RULES.MAX_SUBS_PER_BATTLE) {
    return {
      valid: false,
      error: `Maximum substitutions reached (${SUBSTITUTION_RULES.MAX_SUBS_PER_BATTLE} per battle).`
    };
  }

  // Check if window already used
  if (hasUsedWindow(substitutions, playerId, windowNumber)) {
    return {
      valid: false,
      error: `You already made a substitution in window ${windowNumber}. Only 1 substitution per window.`
    };
  }

  // Check if outSymbol is in roster
  const outAsset = findAsset(portfolio, outSymbol);
  if (!outAsset) {
    return {
      valid: false,
      error: `${outSymbol} is not in your active roster.`
    };
  }

  // Check if inSymbol is in bench
  const inAsset = findAsset(bench, inSymbol);
  if (!inAsset) {
    return {
      valid: false,
      error: `${inSymbol} is not on your bench.`
    };
  }

  // Check type matching (stock-for-stock, crypto-for-crypto)
  const outIsCrypto = isCrypto(outSymbol);
  const inIsCrypto = isCrypto(inSymbol);

  if (outIsCrypto !== inIsCrypto) {
    const outType = outIsCrypto ? 'crypto' : 'stock';
    const inType = inIsCrypto ? 'crypto' : 'stock';
    return {
      valid: false,
      error: `Type mismatch: Cannot swap ${outType} (${outSymbol}) for ${inType} (${inSymbol}). Must be same asset type.`
    };
  }

  // Check no re-entry rule (can't sub back in an asset you removed)
  if (wasRemovedPreviously(substitutions, playerId, inSymbol)) {
    return {
      valid: false,
      error: `${inSymbol} was previously removed and cannot be substituted back in.`
    };
  }

  return { valid: true };
}

// ============================================
// EXECUTION
// ============================================

/**
 * Execute a substitution
 *
 * @param {string} battleId - Battle document ID
 * @param {Object} battle - Battle object
 * @param {string} playerId - 'creator' or 'opponent'
 * @param {string} outSymbol - Symbol to remove
 * @param {string} inSymbol - Symbol to add
 * @param {number} windowNumber - Which window
 * @param {Object} currentPrices - Map of symbol -> current price
 * @returns {Promise<Object>} Updated battle state
 */
export async function executeSubstitution(
  battleId,
  battle,
  playerId,
  outSymbol,
  inSymbol,
  windowNumber,
  currentPrices
) {
  // First validate
  const validation = validateSubstitution(battle, playerId, outSymbol, inSymbol, windowNumber);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const { portfolio, bench } = getPlayerData(battle, playerId);

  // Find the assets
  const outAsset = findAsset(portfolio, outSymbol);
  const inAsset = findAsset(bench, inSymbol);

  // Get current prices
  const outPrice = currentPrices[outSymbol.toUpperCase()] || outAsset.price || 0;
  const inPrice = currentPrices[inSymbol.toUpperCase()] || inAsset.price || 0;

  // Create new portfolio (remove out, add in with same allocation)
  const newPortfolio = portfolio
    .filter(a => a.symbol.toUpperCase() !== outSymbol.toUpperCase())
    .concat({
      ...inAsset,
      symbol: inSymbol.toUpperCase(),
      allocation: outAsset.allocation,
      shares: outAsset.shares,
      value: outAsset.value,
      entryPrice: inPrice, // New entry price for scoring
      subbedInAt: Date.now(),
      subbedInWindow: windowNumber
    });

  // Create new bench (remove in, add out)
  const newBench = bench
    .filter(a => a.symbol.toUpperCase() !== inSymbol.toUpperCase())
    .concat({
      ...outAsset,
      symbol: outSymbol.toUpperCase(),
      allocation: 0, // Bench assets have no allocation
      removedAt: Date.now(),
      removedWindow: windowNumber
    });

  // Create substitution record
  const substitutionRecord = {
    id: generateSubstitutionId(),
    playerId,
    window: windowNumber,
    outSymbol: outSymbol.toUpperCase(),
    outAssetName: outAsset.name || outAsset.assetName || outSymbol.toUpperCase(),
    inSymbol: inSymbol.toUpperCase(),
    inAssetName: inAsset.name || inAsset.assetName || inSymbol.toUpperCase(),
    outPrice: Number(outPrice.toFixed(2)),
    inPrice: Number(inPrice.toFixed(2)),
    allocation: outAsset.allocation || outAsset.value || 0,
    timestamp: Date.now()
  };

  // Build Firestore update
  const battleRef = doc(db, 'battles', battleId);

  const updateData = {
    [`${playerId}.portfolio`]: newPortfolio,
    [`${playerId}.bench`]: newBench,
    substitutions: arrayUnion(substitutionRecord),
    lastUpdated: Date.now()
  };

  // Update Firestore
  await updateDoc(battleRef, updateData);

  // Return updated battle state (local representation)
  const updatedBattle = {
    ...battle,
    [playerId]: {
      ...battle[playerId],
      portfolio: newPortfolio,
      bench: newBench
    },
    substitutions: [...(battle.substitutions || []), substitutionRecord],
    lastUpdated: Date.now()
  };

  return {
    success: true,
    battle: updatedBattle,
    substitution: substitutionRecord,
    message: `Successfully substituted ${outSymbol} → ${inSymbol}`
  };
}

// ============================================
// BENCH MANAGEMENT
// ============================================

/**
 * Initialize bench for a new battle
 *
 * @param {Array} selectedBench - Array of bench asset objects
 * @returns {Array} Formatted bench array
 */
export function initializeBench(selectedBench) {
  return selectedBench.map(asset => ({
    symbol: asset.symbol.toUpperCase(),
    name: asset.name || asset.assetName || asset.symbol,
    price: asset.price || 0,
    allocation: 0, // Bench assets start with no allocation
    isCrypto: isCrypto(asset.symbol),
    addedAt: Date.now()
  }));
}

/**
 * Validate bench composition
 *
 * @param {Array} bench - Proposed bench
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateBench(bench) {
  if (!bench || !Array.isArray(bench)) {
    return { valid: false, error: 'Bench must be an array of assets.' };
  }

  const totalSlots = SUBSTITUTION_RULES.BENCH_SLOTS.total;
  if (bench.length > totalSlots) {
    return { valid: false, error: `Bench cannot exceed ${totalSlots} assets.` };
  }

  const stockCount = bench.filter(a => !isCrypto(a.symbol)).length;
  const cryptoCount = bench.filter(a => isCrypto(a.symbol)).length;

  if (stockCount > SUBSTITUTION_RULES.BENCH_SLOTS.stocks) {
    return {
      valid: false,
      error: `Maximum ${SUBSTITUTION_RULES.BENCH_SLOTS.stocks} stocks on bench (have ${stockCount}).`
    };
  }

  if (cryptoCount > SUBSTITUTION_RULES.BENCH_SLOTS.crypto) {
    return {
      valid: false,
      error: `Maximum ${SUBSTITUTION_RULES.BENCH_SLOTS.crypto} crypto on bench (have ${cryptoCount}).`
    };
  }

  return { valid: true };
}

/**
 * Get bench summary
 *
 * @param {Array} bench - Bench array
 * @returns {Object} Summary of bench composition
 */
export function getBenchSummary(bench) {
  if (!bench || !Array.isArray(bench)) {
    return {
      total: 0,
      stocks: 0,
      crypto: 0,
      stockSlotsFree: SUBSTITUTION_RULES.BENCH_SLOTS.stocks,
      cryptoSlotsFree: SUBSTITUTION_RULES.BENCH_SLOTS.crypto,
      assets: []
    };
  }

  const stocks = bench.filter(a => !isCrypto(a.symbol));
  const crypto = bench.filter(a => isCrypto(a.symbol));

  return {
    total: bench.length,
    stocks: stocks.length,
    crypto: crypto.length,
    stockSlotsFree: SUBSTITUTION_RULES.BENCH_SLOTS.stocks - stocks.length,
    cryptoSlotsFree: SUBSTITUTION_RULES.BENCH_SLOTS.crypto - crypto.length,
    assets: bench.map(a => ({
      symbol: a.symbol,
      name: a.name || a.assetName,
      isCrypto: isCrypto(a.symbol)
    }))
  };
}

// ============================================
// SUBSTITUTION DISPLAY HELPERS
// ============================================

/**
 * Format substitution for display
 *
 * @param {Object} substitution - Substitution record
 * @returns {Object} Display-ready substitution info
 */
export function formatSubstitutionForDisplay(substitution) {
  const window = SUBSTITUTION_RULES.WINDOWS[substitution.window];

  return {
    id: substitution.id,
    description: `${substitution.outSymbol} → ${substitution.inSymbol}`,
    outAsset: {
      symbol: substitution.outSymbol,
      name: substitution.outAssetName,
      price: substitution.outPrice
    },
    inAsset: {
      symbol: substitution.inSymbol,
      name: substitution.inAssetName,
      price: substitution.inPrice
    },
    window: {
      number: substitution.window,
      name: window?.name || `Window ${substitution.window}`
    },
    allocation: substitution.allocation,
    timestamp: substitution.timestamp,
    timeAgo: getTimeAgo(substitution.timestamp)
  };
}

/**
 * Get human-readable time ago string
 */
function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Get substitution availability status
 *
 * @param {Object} battle - Battle object
 * @param {string} playerId - Player ID
 * @returns {Object} Availability status for UI
 */
export function getSubstitutionStatus(battle, playerId) {
  const remaining = getRemainingSubstitutions(battle, playerId);
  const currentWindow = getCurrentSubstitutionWindow();
  const nextWindow = getNextSubstitutionWindow();

  let status = 'unavailable';
  let message = '';

  if (remaining.remaining === 0) {
    status = 'exhausted';
    message = 'No substitutions remaining';
  } else if (currentWindow) {
    const canUseCurrentWindow =
      (currentWindow.window === 1 && remaining.canUseWindow1) ||
      (currentWindow.window === 2 && remaining.canUseWindow2);

    if (canUseCurrentWindow) {
      status = 'available';
      message = `Window ${currentWindow.window} open - ${currentWindow.remainingMinutes}min left`;
    } else {
      status = 'window_used';
      message = `Already used Window ${currentWindow.window}`;
    }
  } else {
    status = 'waiting';
    if (nextWindow.startsIn !== null) {
      message = `Next window in ${nextWindow.startsIn}min`;
    } else {
      message = nextWindow.dayDescription;
    }
  }

  return {
    status,
    message,
    ...remaining,
    currentWindow,
    nextWindow
  };
}

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
  // Constants
  SUBSTITUTION_RULES,

  // Validation
  validateSubstitution,
  validateBench,

  // Execution
  executeSubstitution,

  // Window helpers
  getCurrentSubstitutionWindow,
  getNextSubstitutionWindow,
  isWindowActive,

  // Remaining subs
  getRemainingSubstitutions,

  // Bench management
  initializeBench,
  getBenchSummary,

  // Display helpers
  formatSubstitutionForDisplay,
  getSubstitutionStatus
};
