// MarketClash TD Scoring - Price Snapshot Service
// Captures prices at session boundaries for accurate scoring
//
// Session boundaries:
// - 9:30 AM  - Session 1 (MORNING_BELL) open
// - 11:30 AM - Session 1 close / Session 2 (MIDDAY) open
// - 2:00 PM  - Session 2 close / Session 3 (POWER_HOUR) open
// - 4:00 PM  - Session 3 close / Session 4 (NIGHT_GAME) open
// - 8:00 PM  - Session 4 close / Battle end

import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getMultipleStockPrices, getMultipleCryptoPrices } from './eodhdAPI';
import { SESSIONS, SESSION_ORDER, isCrypto } from './sessionScoringService';

const IS_DEV = import.meta.env?.DEV ?? false;

// ============================================
// CONFIGURATION
// ============================================

const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 30000; // 30 seconds

// ============================================
// LOGGING
// ============================================

function logDebug(message, ...args) {
  if (IS_DEV) {
    console.log(`[PriceSnapshot] ${message}`, ...args);
  }
}

function logWarn(message, ...args) {
  console.warn(`[PriceSnapshot] ${message}`, ...args);
}

function logError(message, ...args) {
  console.error(`[PriceSnapshot] ${message}`, ...args);
}

// ============================================
// TIME HELPERS
// ============================================

/**
 * Get current time in Eastern Time
 */
function getEasternTime() {
  const now = new Date();
  const etString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  return new Date(etString);
}

/**
 * Convert time object { hour, minute } to minutes since midnight
 */
function timeToMinutes(time) {
  return time.hour * 60 + time.minute;
}

/**
 * Determine current session based on Eastern Time
 * @returns {string|null} - Session ID or null if outside trading hours
 */
function getCurrentSessionId() {
  const et = getEasternTime();
  const currentMinutes = et.getHours() * 60 + et.getMinutes();

  for (const sessionId of SESSION_ORDER) {
    const session = SESSIONS[sessionId];
    const startMinutes = timeToMinutes(session.start);
    const endMinutes = timeToMinutes(session.end);

    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      return sessionId;
    }
  }

  return null;
}

/**
 * Get the previous session ID
 * @param {string} sessionId - Current session ID
 * @returns {string|null} - Previous session ID or null
 */
function getPreviousSessionId(sessionId) {
  const index = SESSION_ORDER.indexOf(sessionId);
  if (index <= 0) return null;
  return SESSION_ORDER[index - 1];
}

/**
 * Get the next session ID
 * @param {string} sessionId - Current session ID
 * @returns {string|null} - Next session ID or null
 */
function getNextSessionId(sessionId) {
  const index = SESSION_ORDER.indexOf(sessionId);
  if (index === -1 || index >= SESSION_ORDER.length - 1) return null;
  return SESSION_ORDER[index + 1];
}

// ============================================
// SYMBOL EXTRACTION
// ============================================

/**
 * Get all unique symbols from a battle
 * Extracts from both players' portfolios and benches
 *
 * @param {Object} battle - Battle document
 * @returns {string[]} - Array of unique symbols (uppercase)
 */
export function getBattleSymbols(battle) {
  const symbols = new Set();

  // Creator portfolio
  if (battle.creator?.portfolio) {
    battle.creator.portfolio.forEach(asset => {
      if (asset.symbol) {
        symbols.add(asset.symbol.toUpperCase());
      }
    });
  }

  // Creator bench
  if (battle.creator?.bench) {
    battle.creator.bench.forEach(asset => {
      if (asset.symbol) {
        symbols.add(asset.symbol.toUpperCase());
      }
    });
  }

  // Opponent portfolio
  if (battle.opponent?.portfolio) {
    battle.opponent.portfolio.forEach(asset => {
      if (asset.symbol) {
        symbols.add(asset.symbol.toUpperCase());
      }
    });
  }

  // Opponent bench
  if (battle.opponent?.bench) {
    battle.opponent.bench.forEach(asset => {
      if (asset.symbol) {
        symbols.add(asset.symbol.toUpperCase());
      }
    });
  }

  return Array.from(symbols);
}

// ============================================
// PRICE FETCHING
// ============================================

/**
 * Fetch current prices for all symbols
 * Separates stocks and crypto, fetches in parallel
 *
 * @param {string[]} allSymbols - Array of symbols to fetch
 * @returns {Promise<Object>} - Map of symbol -> price
 */
async function fetchCurrentPrices(allSymbols) {
  const stockSymbols = allSymbols.filter(s => !isCrypto(s));
  const cryptoSymbols = allSymbols.filter(s => isCrypto(s));

  logDebug(`Fetching prices: ${stockSymbols.length} stocks, ${cryptoSymbols.length} crypto`);

  try {
    const [stockPrices, cryptoPrices] = await Promise.all([
      stockSymbols.length > 0 ? getMultipleStockPrices(stockSymbols) : {},
      cryptoSymbols.length > 0 ? getMultipleCryptoPrices(cryptoSymbols) : {}
    ]);

    // Combine results into a single price map
    const prices = {};

    // Extract stock prices
    Object.entries(stockPrices).forEach(([symbol, data]) => {
      prices[symbol.toUpperCase()] = data.price;
    });

    // Extract crypto prices
    Object.entries(cryptoPrices).forEach(([symbol, data]) => {
      prices[symbol.toUpperCase()] = data.price;
    });

    return prices;
  } catch (error) {
    logError('Price fetch failed:', error.message);
    throw error;
  }
}

/**
 * Check if all symbols have valid prices
 *
 * @param {Object} prices - Price map
 * @param {string[]} allSymbols - Symbols to check
 * @returns {{ complete: boolean, missing: string[] }}
 */
function checkPriceCompleteness(prices, allSymbols) {
  const missing = [];

  for (const symbol of allSymbols) {
    const price = prices[symbol.toUpperCase()];
    if (price === undefined || price === null || price <= 0) {
      missing.push(symbol);
    }
  }

  return {
    complete: missing.length === 0,
    missing
  };
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// SESSION PRICE STATUS
// ============================================

/**
 * Check if session prices have been captured
 *
 * @param {Object} battle - Battle document
 * @param {string} sessionKey - Session ID (MORNING_BELL, etc.)
 * @returns {{ needsOpen: boolean, needsClose: boolean, hasOpen: boolean, hasClose: boolean }}
 */
export function checkSessionPriceStatus(battle, sessionKey) {
  const sessionPrices = battle.sessionPrices?.[sessionKey];

  const hasOpen = sessionPrices?.open !== null &&
                  sessionPrices?.open !== undefined &&
                  Object.keys(sessionPrices?.open || {}).length > 0;

  const hasClose = sessionPrices?.close !== null &&
                   sessionPrices?.close !== undefined &&
                   Object.keys(sessionPrices?.close || {}).length > 0;

  return {
    hasOpen,
    hasClose,
    needsOpen: !hasOpen,
    needsClose: !hasClose
  };
}

// ============================================
// PRICE CAPTURE
// ============================================

/**
 * Capture session prices for a battle
 * Retries up to MAX_RETRY_ATTEMPTS if prices are missing
 *
 * @param {string} battleId - Battle ID
 * @param {string} sessionKey - Session ID (MORNING_BELL, MIDDAY, etc.)
 * @param {string} boundaryType - 'open' or 'close'
 * @param {string[]} allSymbols - Array of symbols to capture
 * @returns {Promise<Object>} - Captured prices
 */
export async function captureSessionPrices(battleId, sessionKey, boundaryType, allSymbols) {
  logDebug(`Capturing ${sessionKey} ${boundaryType} prices for ${allSymbols.length} symbols`);

  let lastPrices = null;
  let attempts = 0;

  while (attempts < MAX_RETRY_ATTEMPTS) {
    attempts++;

    try {
      const prices = await fetchCurrentPrices(allSymbols);
      lastPrices = prices;

      const { complete, missing } = checkPriceCompleteness(prices, allSymbols);

      if (complete) {
        logDebug(`All prices captured on attempt ${attempts}`);
        break;
      }

      logWarn(`Attempt ${attempts}: Missing prices for ${missing.join(', ')}`);

      if (attempts < MAX_RETRY_ATTEMPTS) {
        logDebug(`Waiting ${RETRY_DELAY_MS / 1000}s before retry...`);
        await sleep(RETRY_DELAY_MS);
      }
    } catch (error) {
      logError(`Attempt ${attempts} failed:`, error.message);

      if (attempts < MAX_RETRY_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  if (!lastPrices) {
    throw new Error(`Failed to capture ${sessionKey} ${boundaryType} prices after ${MAX_RETRY_ATTEMPTS} attempts`);
  }

  // Update Firestore with captured prices
  try {
    const battleRef = doc(db, 'battles', battleId);
    const capturedAt = new Date().toISOString();

    await updateDoc(battleRef, {
      [`sessionPrices.${sessionKey}.${boundaryType}`]: lastPrices,
      [`sessionPrices.${sessionKey}.capturedAt.${boundaryType}`]: capturedAt,
      updatedAt: capturedAt
    });

    logDebug(`Saved ${sessionKey} ${boundaryType} prices to Firestore`);

    return lastPrices;
  } catch (error) {
    logError('Failed to save prices to Firestore:', error.message);
    throw error;
  }
}

// ============================================
// BATTLE INITIALIZATION
// ============================================

/**
 * Initialize battle prices when opponent joins
 * Captures MORNING_BELL open prices and sets battle to active
 *
 * @param {string} battleId - Battle ID
 * @param {string[]} allSymbols - Array of all symbols in battle
 * @returns {Promise<Object>} - Starting prices
 */
export async function initializeBattlePrices(battleId, allSymbols) {
  logDebug(`Initializing battle prices for ${allSymbols.length} symbols`);

  // Fetch current prices
  const prices = await fetchCurrentPrices(allSymbols);

  const { complete, missing } = checkPriceCompleteness(prices, allSymbols);
  if (!complete) {
    logWarn(`Some prices missing during initialization: ${missing.join(', ')}`);
  }

  // Initialize session prices structure
  const sessionPrices = {};
  for (const sessionId of SESSION_ORDER) {
    sessionPrices[sessionId] = {
      open: null,
      close: null,
      capturedAt: {
        open: null,
        close: null
      }
    };
  }

  // Set MORNING_BELL open prices
  const capturedAt = new Date().toISOString();
  sessionPrices.MORNING_BELL.open = prices;
  sessionPrices.MORNING_BELL.capturedAt.open = capturedAt;

  // Update Firestore
  try {
    const battleRef = doc(db, 'battles', battleId);

    await updateDoc(battleRef, {
      'state.status': 'active',
      'state.currentSession': 'MORNING_BELL',
      'state.startingPrices': prices,
      sessionPrices: sessionPrices,
      updatedAt: capturedAt
    });

    logDebug('Battle initialized with starting prices');

    return prices;
  } catch (error) {
    logError('Failed to initialize battle prices:', error.message);
    throw error;
  }
}

// ============================================
// SESSION TRANSITION
// ============================================

/**
 * Process session transition
 * Determines current session, captures necessary prices, updates state
 *
 * @param {string} battleId - Battle ID
 * @returns {Promise<Object>} - { currentSession, previousSession, battle }
 */
export async function processSessionTransition(battleId) {
  logDebug(`Processing session transition for battle ${battleId}`);

  // Get current battle state
  const battleRef = doc(db, 'battles', battleId);
  const battleSnap = await getDoc(battleRef);

  if (!battleSnap.exists()) {
    throw new Error(`Battle ${battleId} not found`);
  }

  const battle = { id: battleSnap.id, ...battleSnap.data() };

  // Check if battle is active
  if (battle.state?.status !== 'active') {
    logDebug(`Battle is not active (status: ${battle.state?.status})`);
    return { currentSession: null, previousSession: null, battle };
  }

  // Get all symbols
  const allSymbols = getBattleSymbols(battle);

  // Determine current session based on time
  const currentSessionId = getCurrentSessionId();
  const previousSessionId = battle.state?.currentSession;
  const completedSessions = battle.state?.completedSessions || [];

  logDebug(`Current time session: ${currentSessionId}, Battle session: ${previousSessionId}`);

  // If outside trading hours, check if we need to end the battle
  if (!currentSessionId) {
    const et = getEasternTime();
    const currentMinutes = et.getHours() * 60 + et.getMinutes();
    const nightGameEnd = timeToMinutes(SESSIONS.NIGHT_GAME.end); // 8:00 PM = 1200

    if (currentMinutes >= nightGameEnd) {
      logDebug('After NIGHT_GAME end - battle should complete');

      // Capture NIGHT_GAME close if not already done
      const nightStatus = checkSessionPriceStatus(battle, 'NIGHT_GAME');
      if (nightStatus.needsClose) {
        await captureSessionPrices(battleId, 'NIGHT_GAME', 'close', allSymbols);
      }

      // Mark all sessions as complete
      const allComplete = [...SESSION_ORDER];
      await updateDoc(battleRef, {
        'state.currentSession': null,
        'state.completedSessions': allComplete,
        updatedAt: new Date().toISOString()
      });

      const updatedBattleSnap = await getDoc(battleRef);
      return {
        currentSession: null,
        previousSession: 'NIGHT_GAME',
        battle: { id: updatedBattleSnap.id, ...updatedBattleSnap.data() }
      };
    }

    // Before market open
    logDebug('Before market open');
    return { currentSession: null, previousSession: previousSessionId, battle };
  }

  // Check if session changed
  if (currentSessionId === previousSessionId) {
    logDebug('No session change');
    return { currentSession: currentSessionId, previousSession: null, battle };
  }

  // Session changed - process transition
  logDebug(`Session transition: ${previousSessionId} -> ${currentSessionId}`);

  const updates = {};
  const newCompletedSessions = [...completedSessions];

  // Close previous session if it exists and is not completed
  if (previousSessionId && !completedSessions.includes(previousSessionId)) {
    const prevStatus = checkSessionPriceStatus(battle, previousSessionId);

    if (prevStatus.needsClose) {
      logDebug(`Capturing ${previousSessionId} close prices`);
      await captureSessionPrices(battleId, previousSessionId, 'close', allSymbols);
    }

    newCompletedSessions.push(previousSessionId);
    logDebug(`Marked ${previousSessionId} as completed`);
  }

  // Open current session
  const currentStatus = checkSessionPriceStatus(battle, currentSessionId);
  if (currentStatus.needsOpen) {
    logDebug(`Capturing ${currentSessionId} open prices`);
    await captureSessionPrices(battleId, currentSessionId, 'open', allSymbols);
  }

  // Update state
  updates['state.currentSession'] = currentSessionId;
  updates['state.completedSessions'] = newCompletedSessions;
  updates.updatedAt = new Date().toISOString();

  await updateDoc(battleRef, updates);

  // Get updated battle
  const updatedBattleSnap = await getDoc(battleRef);
  const updatedBattle = { id: updatedBattleSnap.id, ...updatedBattleSnap.data() };

  return {
    currentSession: currentSessionId,
    previousSession: previousSessionId,
    battle: updatedBattle
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get session boundary times for a specific date
 * @param {Date} date - Date to get boundaries for (defaults to today ET)
 * @returns {Object} - Map of sessionId -> { openTime, closeTime }
 */
export function getSessionBoundaries(date = null) {
  const et = date || getEasternTime();
  const year = et.getFullYear();
  const month = et.getMonth();
  const day = et.getDate();

  const boundaries = {};

  for (const sessionId of SESSION_ORDER) {
    const session = SESSIONS[sessionId];

    const openTime = new Date(year, month, day, session.start.hour, session.start.minute, 0);
    const closeTime = new Date(year, month, day, session.end.hour, session.end.minute, 0);

    boundaries[sessionId] = {
      openTime: openTime.toISOString(),
      closeTime: closeTime.toISOString()
    };
  }

  return boundaries;
}

/**
 * Check if currently at a session boundary (within 1 minute)
 * @returns {{ atBoundary: boolean, boundaryType: string|null, sessionId: string|null }}
 */
export function checkSessionBoundary() {
  const et = getEasternTime();
  const currentMinutes = et.getHours() * 60 + et.getMinutes();

  for (const sessionId of SESSION_ORDER) {
    const session = SESSIONS[sessionId];
    const startMinutes = timeToMinutes(session.start);
    const endMinutes = timeToMinutes(session.end);

    // Check if at session open (within 1 minute)
    if (Math.abs(currentMinutes - startMinutes) <= 1) {
      return {
        atBoundary: true,
        boundaryType: 'open',
        sessionId
      };
    }

    // Check if at session close (within 1 minute)
    if (Math.abs(currentMinutes - endMinutes) <= 1) {
      return {
        atBoundary: true,
        boundaryType: 'close',
        sessionId
      };
    }
  }

  return {
    atBoundary: false,
    boundaryType: null,
    sessionId: null
  };
}

/**
 * Get time until next session boundary
 * @returns {{ minutes: number, boundaryType: string, sessionId: string }|null}
 */
export function getTimeUntilNextBoundary() {
  const et = getEasternTime();
  const currentMinutes = et.getHours() * 60 + et.getMinutes();

  let nearestBoundary = null;
  let nearestDiff = Infinity;

  for (const sessionId of SESSION_ORDER) {
    const session = SESSIONS[sessionId];
    const startMinutes = timeToMinutes(session.start);
    const endMinutes = timeToMinutes(session.end);

    // Check open boundary
    if (startMinutes > currentMinutes) {
      const diff = startMinutes - currentMinutes;
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearestBoundary = { minutes: diff, boundaryType: 'open', sessionId };
      }
    }

    // Check close boundary
    if (endMinutes > currentMinutes) {
      const diff = endMinutes - currentMinutes;
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearestBoundary = { minutes: diff, boundaryType: 'close', sessionId };
      }
    }
  }

  return nearestBoundary;
}

// ============================================
// EXPORTS
// ============================================

export default {
  // Core functions
  getBattleSymbols,
  captureSessionPrices,
  checkSessionPriceStatus,
  initializeBattlePrices,
  processSessionTransition,

  // Utility functions
  getSessionBoundaries,
  checkSessionBoundary,
  getTimeUntilNextBoundary,

  // Constants
  MAX_RETRY_ATTEMPTS,
  RETRY_DELAY_MS
};
