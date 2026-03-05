// src/firebase/firebaseService.js
// Firestore database operations for MarketClash battles and challenges

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  increment,
  writeBatch,
  arrayUnion
} from 'firebase/firestore';
import { db } from './config';
import { getVolatilityThresholds } from '../services/volatilityService.js';
import { isCrypto, SESSION_ORDER } from '../services/sessionScoringService.js';
import {
  getTodayDeadline,
  getNextBattleStart,
  getBattleEndTime,
  isWithinCommitmentWindow,
  getCurrentSession,
  isTrainingAvailable,
  getTrainingThreshold,
  getNextTradingDay,
  getSnakeDraftEndDate,
  TRAINING_CONFIG
} from '../constants/battleTiming.js';
import {
  getTradingDayDates,
  getBattleEndTimeV4,
  initializeSwaps,
  initializeDailyOpenPrices,
} from '../constants/battleTimingV4.js';
import { createInitialFreeAgents } from '../services/freeAgentRotationService.js';
import { toISOString as dateToISO } from '../utils/dateUtils.js';

// =====================================================
// HELPERS
// =====================================================

/**
 * Remove undefined values recursively from an object
 * Firebase does not accept undefined values
 *
 * @param {any} obj - Object to clean
 * @returns {any} - Cleaned object with no undefined values
 */
function removeUndefined(obj) {
  // Handle null and undefined
  if (obj === null || obj === undefined) {
    return null;
  }

  // Preserve Date objects - convert to ISO string for Firebase compatibility
  // This prevents dates from being stripped to {} by Object.entries()
  // (Date objects have no enumerable properties, so Object.entries returns [])
  // Uses shared dateUtils to ensure consistent date handling across codebase
  if (obj instanceof Date) {
    return dateToISO(obj);
  }

  // Handle Firestore Timestamp-like objects (has toDate method)
  // Convert to ISO string for consistency
  if (typeof obj?.toDate === 'function') {
    try {
      const date = obj.toDate();
      return dateToISO(date);
    } catch {
      console.warn('[removeUndefined] Failed to convert Timestamp-like object');
      return null;
    }
  }

  // Warn about NaN and Infinity - Firestore doesn't accept these
  if (typeof obj === 'number' && !Number.isFinite(obj)) {
    console.warn('[removeUndefined] NaN or Infinity detected - Firestore will reject this value');
  }

  // Handle arrays - filter out undefined elements BEFORE mapping
  // Previous bug: map first converted undefined->null, then filter didn't remove nulls
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(item => removeUndefined(item));
  }

  // Handle Map - convert to plain object (warn since this may be unintended)
  if (obj instanceof Map) {
    console.warn('[removeUndefined] Map object detected - converting to plain object');
    const plain = {};
    for (const [key, value] of obj) {
      if (value !== undefined) {
        plain[key] = removeUndefined(value);
      }
    }
    return plain;
  }

  // Handle Set - convert to array (warn since this may be unintended)
  if (obj instanceof Set) {
    console.warn('[removeUndefined] Set object detected - converting to array');
    return Array.from(obj)
      .filter(item => item !== undefined)
      .map(item => removeUndefined(item));
  }

  // Handle plain objects
  if (typeof obj === 'object' && obj !== null) {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        const cleanedValue = removeUndefined(value);
        if (cleanedValue !== undefined) {
          cleaned[key] = cleanedValue;
        }
      }
    }
    return cleaned;
  }

  // Return primitives as-is
  return obj;
}

// =====================================================
// BATTLES
// =====================================================

/**
 * Create a new battle
 *
 * @param {Object} battleData - Battle data
 * @returns {Promise<Object>} - Created battle with Firestore ID
 */
export async function createBattle(battleData) {
  try {
    const battle = {
      _v: 1,

      challengeCode: battleData.challengeCode,

      creator: {
        uid: battleData.creator.uid,
        username: battleData.creator.username,
        portfolioName: battleData.portfolioName,
        portfolio: battleData.creatorPortfolio,
        portfolioType: battleData.portfolioType
      },

      opponent: {
        uid: null,
        username: null,
        portfolioName: null,
        portfolio: null,
        portfolioType: null
      },

      timeline: {
        createdAt: new Date().toISOString(),
        startDate: null,
        endDate: null,
        completedAt: null
      },

      state: {
        status: 'waiting',
        currentDay: 0,
        startingPrices: null,
        endingPrices: null
      },

      result: null,
      challengeIds: [],

      metadata: {
        spectatorCount: 0,
        featured: false,
        tags: []
      },

      archived: false,
      updatedAt: new Date().toISOString()
    };

    const battleRef = await addDoc(collection(db, 'battles'), battle);

    console.log('✅ Battle created:', battleRef.id);

    return {
      id: battleRef.id,
      ...battle
    };
  } catch (error) {
    console.error('❌ Error creating battle:', error);
    throw new Error('Failed to create battle. Please try again.');
  }
}

/**
 * Join a battle by challenge code
 *
 * @param {string} challengeCode - 4-character challenge code
 * @param {Object} opponentData - Opponent's data
 * @returns {Promise<Object>} - Updated battle
 */
export async function joinBattle(challengeCode, opponentData) {
  try {
    // Find battle by challenge code
    const q = query(
      collection(db, 'battles'),
      where('challengeCode', '==', challengeCode.toUpperCase()),
      where('state.status', '==', 'waiting'),
      where('archived', '==', false)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error('Battle not found or already started');
    }

    const battleDoc = snapshot.docs[0];
    const battleData = battleDoc.data();

    // Check if user is trying to join their own battle
    if (battleData.creator.uid === opponentData.uid) {
      throw new Error('You cannot join your own battle');
    }

    // Calculate start/end times
    const now = new Date();
    const startDate = now.toISOString();
    const endDate = new Date(now.getTime() + (24 * 60 * 60 * 1000)).toISOString(); // 24 hours

    // Update battle with opponent
    const battleRef = doc(db, 'battles', battleDoc.id);

    await updateDoc(battleRef, {
      'opponent.uid': opponentData.uid,
      'opponent.username': opponentData.username,
      'opponent.portfolioName': opponentData.portfolioName,
      'opponent.portfolio': opponentData.portfolio,
      'opponent.portfolioType': opponentData.portfolioType,

      'timeline.startDate': startDate,
      'timeline.endDate': endDate,

      'state.status': 'active',
      'state.currentDay': 1,
      'state.startingPrices': opponentData.startingPrices,

      updatedAt: new Date().toISOString()
    });

    console.log('✅ Battle joined:', battleDoc.id);

    // Return updated battle
    const updatedBattle = await getBattle(battleDoc.id);
    return updatedBattle;
  } catch (error) {
    console.error('❌ Error joining battle:', error);
    throw error;
  }
}

/**
 * Get a single battle by ID
 *
 * @param {string} battleId - Firestore battle document ID
 * @returns {Promise<Object>} - Battle data
 */
export async function getBattle(battleId) {
  try {
    const battleDoc = await getDoc(doc(db, 'battles', battleId));

    if (!battleDoc.exists()) {
      throw new Error('Battle not found');
    }

    return {
      id: battleDoc.id,
      ...battleDoc.data()
    };
  } catch (error) {
    console.error('❌ Error fetching battle:', error);
    throw error;
  }
}

/**
 * Get all battles for a user (as creator or opponent)
 *
 * @param {string} userId - Firebase Auth UID
 * @returns {Promise<Array>} - Array of battles
 */
export async function getUserBattles(userId) {
  try {
    // Query battles where user is creator
    const q1 = query(
      collection(db, 'battles'),
      where('creator.uid', '==', userId),
      where('archived', '==', false),
      orderBy('timeline.createdAt', 'desc')
    );

    // Query battles where user is opponent
    const q2 = query(
      collection(db, 'battles'),
      where('opponent.uid', '==', userId),
      where('archived', '==', false),
      orderBy('timeline.createdAt', 'desc')
    );

    const [snapshot1, snapshot2] = await Promise.all([
      getDocs(q1),
      getDocs(q2)
    ]);

    const battles = [
      ...snapshot1.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      ...snapshot2.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    ];

    // Sort by creation date (newest first) - handle both timeline and timing schemas
    battles.sort((a, b) => {
      const aTime = a?.timing?.createdAt || a?.timeline?.createdAt || a?.createdAt || 0;
      const bTime = b?.timing?.createdAt || b?.timeline?.createdAt || b?.createdAt || 0;
      return new Date(bTime) - new Date(aTime);
    });

    console.log(`✅ Fetched ${battles.length} battles for user:`, userId);

    return battles;
  } catch (error) {
    console.error('❌ Error fetching user battles:', error);
    throw new Error('Failed to fetch battles. Please try again.');
  }
}

/**
 * Update battle status
 *
 * @param {string} battleId - Battle ID
 * @param {string} status - New status ('waiting', 'active', 'completed')
 * @returns {Promise<void>}
 */
export async function updateBattleStatus(battleId, status) {
  try {
    const battleRef = doc(db, 'battles', battleId);

    await updateDoc(battleRef, {
      'state.status': status,
      updatedAt: new Date().toISOString()
    });

    console.log('✅ Battle status updated:', battleId, status);
  } catch (error) {
    console.error('❌ Error updating battle status:', error);
    throw error;
  }
}

/**
 * Complete a battle with results
 *
 * @param {string} battleId - Battle ID
 * @param {Object} resultData - Battle result data
 * @returns {Promise<void>}
 */
export async function completeBattle(battleId, resultData) {
  try {
    const battleRef = doc(db, 'battles', battleId);

    await updateDoc(battleRef, {
      'state.status': 'completed',
      'state.endingPrices': resultData.endingPrices,
      'timeline.completedAt': new Date().toISOString(),
      result: resultData.result,
      updatedAt: new Date().toISOString()
    });

    console.log('✅ Battle completed:', battleId);
  } catch (error) {
    console.error('❌ Error completing battle:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time battle updates
 *
 * @param {string} userId - Firebase Auth UID
 * @param {Function} callback - Callback function (battles) => void
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToBattles(userId, callback) {
  // Query battles where user is creator (by uid)
  const q1 = query(
    collection(db, 'battles'),
    where('creator.uid', '==', userId),
    where('archived', '==', false)
  );

  // Query battles where user is opponent (by uid)
  const q2 = query(
    collection(db, 'battles'),
    where('opponent.uid', '==', userId),
    where('archived', '==', false)
  );

  // Also query by odUserId for V3 battles (since App.jsx may use odUserId as userId)
  const q3 = query(
    collection(db, 'battles'),
    where('creator.odUserId', '==', userId),
    where('archived', '==', false)
  );

  const q4 = query(
    collection(db, 'battles'),
    where('opponent.odUserId', '==', userId),
    where('archived', '==', false)
  );

  const allBattles = new Map();

  // Helper to sort and callback
  const sortAndCallback = () => {
    const battles = Array.from(allBattles.values()).sort((a, b) => {
      const aTime = a?.timing?.createdAt || a?.timeline?.createdAt || a?.createdAt || 0;
      const bTime = b?.timing?.createdAt || b?.timeline?.createdAt || b?.createdAt || 0;
      return new Date(bTime) - new Date(aTime);
    });
    callback(battles);
  };

  // Fallback: when an onSnapshot listener fails (e.g., missing composite index,
  // permission denied), do a one-time getDocs query instead. This ensures battles
  // are fetched even when real-time listeners can't be established.
  const fallbackGetDocs = async (failedQuery, label) => {
    try {
      const snapshot = await getDocs(failedQuery);
      snapshot.docs.forEach(d => {
        allBattles.set(d.id, { id: d.id, ...d.data() });
      });
      if (snapshot.docs.length > 0) {
        console.log(`📋 Fallback getDocs (${label}): fetched ${snapshot.docs.length} battles`);
        sortAndCallback();
      }
    } catch (fallbackErr) {
      // getDocs also failed — query itself is invalid (e.g., truly missing index)
      console.warn(`⚠️ Fallback getDocs (${label}) also failed:`, fallbackErr.message);
    }
  };

  // Helper: create an onSnapshot listener with error handling + getDocs fallback
  const listenWithFallback = (q, label) => {
    return onSnapshot(q, (snapshot) => {
      snapshot.docs.forEach(d => {
        allBattles.set(d.id, { id: d.id, ...d.data() });
      });
      sortAndCallback();
    }, (error) => {
      console.error(`❌ onSnapshot error (${label}):`, error.message);
      // Attempt one-time fetch as fallback
      fallbackGetDocs(q, label);
    });
  };

  const unsubscribe1 = listenWithFallback(q1, 'creator.uid');
  const unsubscribe2 = listenWithFallback(q2, 'opponent.uid');
  const unsubscribe3 = listenWithFallback(q3, 'creator.odUserId');
  const unsubscribe4 = listenWithFallback(q4, 'opponent.odUserId');

  console.log('✅ Subscribed to battle updates for user:', userId);

  // Return combined unsubscribe function
  return () => {
    unsubscribe1();
    unsubscribe2();
    unsubscribe3();
    unsubscribe4();
    console.log('✅ Unsubscribed from battle updates');
  };
}

/**
 * Archive a battle (soft delete)
 *
 * @param {string} battleId - Battle ID
 * @returns {Promise<void>}
 */
export async function archiveBattle(battleId) {
  try {
    const battleRef = doc(db, 'battles', battleId);

    await updateDoc(battleRef, {
      archived: true,
      updatedAt: new Date().toISOString()
    });

    console.log('✅ Battle archived:', battleId);
  } catch (error) {
    console.error('❌ Error archiving battle:', error);
    throw error;
  }
}

// =====================================================
// CHALLENGES
// =====================================================

/**
 * Create a new challenge
 *
 * @param {Object} challengeData - Challenge data
 * @returns {Promise<Object>} - Created challenge
 */
export async function createChallenge(challengeData) {
  try {
    const challenge = {
      _v: 1,

      battleId: challengeData.battleId,
      type: challengeData.type,

      player: {
        uid: challengeData.player.uid,
        username: challengeData.player.username
      },

      details: challengeData.details,

      timeline: {
        appearsAt: challengeData.appearsAt,
        expiresAt: challengeData.expiresAt,
        acceptedAt: null,
        completesAt: null,
        resolvedAt: null
      },

      state: {
        status: 'pending',
        baselinePrice: null,
        currentPrice: null,
        endingPrice: null
      },

      result: {
        normalReturn: null,
        doubledReturn: null,
        portfolioImpact: null,
        correctPrediction: null
      },

      archived: false,
      updatedAt: new Date().toISOString()
    };

    const challengeRef = await addDoc(collection(db, 'challenges'), challenge);

    console.log('✅ Challenge created:', challengeRef.id);

    return {
      id: challengeRef.id,
      ...challenge
    };
  } catch (error) {
    console.error('❌ Error creating challenge:', error);
    throw error;
  }
}

/**
 * Get challenges for a battle
 *
 * @param {string} battleId - Battle ID
 * @returns {Promise<Array>} - Array of challenges
 */
export async function getBattleChallenges(battleId) {
  try {
    const q = query(
      collection(db, 'challenges'),
      where('battleId', '==', battleId),
      where('archived', '==', false)
    );

    const snapshot = await getDocs(q);

    const challenges = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return challenges;
  } catch (error) {
    console.error('❌ Error fetching challenges:', error);
    throw error;
  }
}

/**
 * Update a challenge
 *
 * @param {string} challengeId - Challenge ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateChallenge(challengeId, updates) {
  try {
    const challengeRef = doc(db, 'challenges', challengeId);

    await updateDoc(challengeRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    });

    console.log('✅ Challenge updated:', challengeId);
  } catch (error) {
    console.error('❌ Error updating challenge:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time challenge updates for a battle
 *
 * @param {string} battleId - Battle ID
 * @param {Function} callback - Callback function (challenges) => void
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToChallenges(battleId, callback) {
  const q = query(
    collection(db, 'challenges'),
    where('battleId', '==', battleId),
    where('archived', '==', false)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const challenges = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    callback(challenges);
  });

  console.log('✅ Subscribed to challenge updates for battle:', battleId);

  return unsubscribe;
}

// =====================================================
// BAGGERBOMB SCORING V2 BATTLES
// =====================================================

/**
 * Get Eastern Time
 */
function getEasternTime() {
  const now = new Date();
  const etString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  return new Date(etString);
}

/**
 * Calculate battle start and end timing
 * Battles run from 9:30 AM to 8:00 PM ET on market days (Mon-Fri)
 *
 * @returns {{ startDate: string, endDate: string }}
 */
export function calculateBattleTiming() {
  const et = getEasternTime();
  const currentHour = et.getHours();
  const currentMinute = et.getMinutes();
  const dayOfWeek = et.getDay(); // 0 = Sunday, 6 = Saturday

  // Start with today
  let startDate = new Date(et);
  startDate.setSeconds(0, 0);

  // Determine if we need to push to next market day
  let needsNextDay = false;

  // Weekend: push to Monday
  if (dayOfWeek === 0) {
    // Sunday -> Monday
    startDate.setDate(startDate.getDate() + 1);
    needsNextDay = true;
  } else if (dayOfWeek === 6) {
    // Saturday -> Monday
    startDate.setDate(startDate.getDate() + 2);
    needsNextDay = true;
  } else if (currentHour >= 16 || (currentHour === 15 && currentMinute >= 30)) {
    // After 4:00 PM ET on weekday -> next market day
    if (dayOfWeek === 5) {
      // Friday -> Monday
      startDate.setDate(startDate.getDate() + 3);
    } else {
      // Mon-Thu -> next day
      startDate.setDate(startDate.getDate() + 1);
    }
    needsNextDay = true;
  }

  // Set start time to 9:30 AM ET
  startDate.setHours(9, 30, 0, 0);

  // Set end time to 8:00 PM ET same day
  const endDate = new Date(startDate);
  endDate.setHours(20, 0, 0, 0);

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    startsToday: !needsNextDay,
    dayOfWeek: startDate.getDay()
  };
}

/**
 * Initialize empty session prices structure
 * Uses empty objects/strings instead of null to avoid Firebase issues
 */
function initializeSessionPrices() {
  const sessionPrices = {};
  for (const sessionId of SESSION_ORDER) {
    sessionPrices[sessionId] = {
      open: {},
      close: {},
      capturedAt: {
        open: '',
        close: ''
      }
    };
  }
  return sessionPrices;
}

/**
 * Initialize empty session scores structure
 * Uses 0 and empty string instead of null to avoid Firebase issues
 */
function initializeSessionScores() {
  const sessionScores = {};
  for (const sessionId of SESSION_ORDER) {
    sessionScores[sessionId] = {
      creator: 0,
      opponent: 0,
      winner: ''
    };
  }
  return sessionScores;
}

/**
 * Fetch thresholds for all assets in portfolio and bench
 *
 * @param {Array} portfolio - Portfolio assets
 * @param {Array} bench - Bench assets
 * @returns {Promise<Object>} - Map of symbol -> threshold data
 */
async function fetchAllThresholds(portfolio, bench) {
  const allAssets = [...(portfolio || []), ...(bench || [])];

  const stockSymbols = allAssets
    .filter(a => !isCrypto(a.symbol))
    .map(a => a.symbol.toUpperCase());

  const cryptoSymbols = allAssets
    .filter(a => isCrypto(a.symbol))
    .map(a => a.symbol.toUpperCase());

  // Remove duplicates
  const uniqueStocks = [...new Set(stockSymbols)];
  const uniqueCrypto = [...new Set(cryptoSymbols)];

  try {
    const [stockThresholds, cryptoThresholds] = await Promise.all([
      uniqueStocks.length > 0 ? getVolatilityThresholds(uniqueStocks, 'stock') : {},
      uniqueCrypto.length > 0 ? getVolatilityThresholds(uniqueCrypto, 'crypto') : {}
    ]);

    return { ...stockThresholds, ...cryptoThresholds };
  } catch (error) {
    console.warn('⚠️ Failed to fetch thresholds, using empty:', error.message);
    return {};
  }
}

/**
 * Create a new BaggerBomb Scoring V2 battle
 *
 * @param {Object} battleData - Battle data
 * @returns {Promise<Object>} - Created battle with Firestore ID
 */
export async function createBaggerBombBattle(battleData) {
  try {
    console.log('🔥 createBaggerBombBattle called with:', battleData);

    // Validate required data
    if (!battleData.creatorPortfolio || battleData.creatorPortfolio.length === 0) {
      throw new Error('Portfolio is required');
    }

    // Fetch volatility thresholds for creator's assets
    let creatorThresholds = {};
    try {
      creatorThresholds = await fetchAllThresholds(
        battleData.creatorPortfolio,
        battleData.creatorBench
      );
    } catch (thresholdError) {
      console.warn('⚠️ Could not fetch thresholds, using empty object:', thresholdError.message);
    }

    // Build portfolio with strict type coercion - NO undefined values allowed
    const sanitizedPortfolio = (battleData.creatorPortfolio || [])
      .filter(asset => asset && asset.symbol)
      .map(asset => ({
        symbol: String(asset.symbol || '').toUpperCase(),
        name: String(asset.name || asset.assetName || asset.symbol || ''),
        price: Number(asset.price) || 0,
        amount: Number(asset.amount || asset.allocation) || 0,
        position: String(asset.position || 'long')
      }));

    // Build bench with strict type coercion
    const sanitizedBench = (battleData.creatorBench || [])
      .filter(asset => asset && asset.symbol)
      .map(asset => ({
        symbol: String(asset.symbol || '').toUpperCase(),
        name: String(asset.name || asset.assetName || asset.symbol || ''),
        price: Number(asset.price) || 0,
        amount: 0,
        position: String(asset.position || 'long')
      }));

    // Sanitize thresholds
    const sanitizedThresholds = {};
    for (const [symbol, data] of Object.entries(creatorThresholds || {})) {
      if (data && typeof data === 'object') {
        sanitizedThresholds[String(symbol)] = {
          threshold: Number(data.threshold) || 2.0,
          rallyThreshold: Number(data.rallyThreshold) || 3.0,
          moonshotThreshold: Number(data.moonshotThreshold) || 4.0
        };
      }
    }

    // Calculate timing windows
    const commitmentDeadline = getTodayDeadline();
    const battleStart = getNextBattleStart();
    const battleEnd = getBattleEndTime(battleStart);

    const battle = {
      _v: 2,  // Schema version for BaggerBomb Scoring

      type: 'baggerbomb_pvp',
      challengeCode: String(battleData.challengeCode || ''),

      creator: {
        uid: String(battleData.creator?.uid || 'anonymous'),
        odUserId: String(battleData.creator?.odUserId || battleData.creator?.uid || 'anonymous'),
        username: String(battleData.creator?.username || 'Player'),
        portfolioName: String(battleData.portfolioName || 'BaggerBomb Portfolio'),
        portfolioType: String(battleData.portfolioType || 'stocks'),
        portfolio: sanitizedPortfolio,
        bench: sanitizedBench,
        sessionScores: {},
        totalScore: 0,
        cryptoAllocation: 10  // Fixed at 10% for V2
      },

      // Opponent starts empty - all fields must be explicit, no undefined
      opponent: {
        uid: '',
        odUserId: '',
        username: '',
        portfolioName: '',
        portfolioType: '',
        portfolio: [],
        bench: [],
        sessionScores: {},
        totalScore: 0,
        cryptoAllocation: 0
      },

      // NEW: Enhanced timing with commitment deadline and baseline lock
      timing: {
        createdAt: new Date().toISOString(),
        commitmentDeadline: commitmentDeadline.toISOString(),
        baselineLockTime: '',  // Set at 4 PM when both joined
        scheduledStart: battleStart.toISOString(),
        scheduledEnd: battleEnd.toISOString(),
        actualStart: '',
        actualEnd: ''
      },

      // Legacy timeline for backward compatibility
      timeline: {
        createdAt: new Date().toISOString(),
        startDate: '',  // Set when opponent joins
        endDate: '',    // 8:00 PM ET same day
        completedAt: ''
      },

      state: {
        status: 'waiting',
        currentSession: '',    // MORNING_BELL, MIDDAY, POWER_HOUR, NIGHT_GAME
        completedSessions: [],   // Array of completed session IDs
        startingPrices: {},
        isActive: false
      },

      // NEW: Baseline prices locked at 4 PM market close
      pricing: {
        baselinePrices: {},  // Locked at 4 PM ET
        sessionPrices: initializeSessionPrices()
      },

      // Legacy sessionPrices for backward compatibility
      sessionPrices: initializeSessionPrices(),

      // Volatility thresholds locked at battle creation
      thresholds: sanitizedThresholds,

      // Breakout events log (NEW FORMAT with thresholdsCrossed)
      breakouts: {
        creator: [],
        opponent: []
      },

      // Substitution history (max 2 per battle)
      substitutions: [],
      substitutionsRemaining: { creator: 2, opponent: 2 },

      // NEW: Per-session scoring breakdown
      scoring: {
        sessions: initializeSessionScores(),
        breakouts: { creator: [], opponent: [] }
      },

      // Legacy sessionScores for backward compatibility
      sessionScores: initializeSessionScores(),

      result: {},

      metadata: {
        spectatorCount: 0,
        featured: false,
        tags: ['baggerbomb-scoring', 'v2', 'linear-scoring']
      },

      archived: false,
      updatedAt: new Date().toISOString()
    };

    // Remove any remaining undefined values recursively
    const cleanedBattle = removeUndefined(battle);

    console.log('📤 Cleaned battle object for Firebase:', JSON.stringify(cleanedBattle, null, 2));

    const battleRef = await addDoc(collection(db, 'battles'), cleanedBattle);

    console.log('✅ BaggerBomb battle created:', battleRef.id);

    return {
      id: battleRef.id,
      ...cleanedBattle
    };
  } catch (error) {
    console.error('❌ Error creating BaggerBomb battle:', error);
    throw new Error(`Failed to create BaggerBomb battle: ${error.message}`);
  }
}

/**
 * Create a BaggerBomb V3 battle with tier-based portfolio structure
 * Uses new slot-based portfolio: star (2x20%), core (2x15%), support (3x10%)
 *
 * @param {Object} battleData - Battle creation data
 * @param {Object} battleData.creator - Creator user info { uid, odUserId, username }
 * @param {Object} battleData.portfolio - Tier-organized portfolio { star, core, support }
 * @param {Object} battleData.bench - Bench assets { stocks: [], crypto: {} }
 * @param {string} battleData.challengeCode - 4-character challenge code
 * @returns {Promise<Object>} - Created battle with Firestore ID
 */
export async function createBaggerBombBattleV3(battleData, lobbyTimeMinutes = 30) {
  try {
    console.log('🔥 createBaggerBombBattleV3 called with:', battleData, 'lobbyTimeMinutes:', lobbyTimeMinutes);

    // Validate portfolio structure
    const { portfolio, bench } = battleData;
    if (!portfolio || !portfolio.star || !portfolio.core || !portfolio.support) {
      throw new Error('Portfolio must have star, core, and support tiers');
    }

    // Generate challenge code if not provided
    const challengeCode = battleData.challengeCode ||
      `BB${Date.now().toString(36).slice(-4).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // Collect all symbols for threshold fetching
    const allAssets = [
      ...(portfolio.star || []).filter(Boolean),
      ...(portfolio.core || []).filter(Boolean),
      ...(portfolio.support || []).filter(Boolean),
      ...(bench?.stocks || []).filter(Boolean),
      bench?.crypto,
    ].filter(Boolean);

    // Fetch volatility thresholds
    let thresholds = {};
    try {
      thresholds = await fetchAllThresholds(allAssets, []);
    } catch (thresholdError) {
      console.warn('⚠️ Could not fetch thresholds:', thresholdError.message);
    }

    // Sanitize portfolio tiers
    const sanitizeTierAssets = (assets) =>
      (assets || []).map((asset) =>
        asset
          ? {
              symbol: String(asset.symbol || '').toUpperCase(),
              name: String(asset.name || asset.symbol || ''),
              baseATR: Number(thresholds[asset.symbol]?.threshold || asset.baseATR || 2.5),
              isCrypto: Boolean(asset.isCrypto),
            }
          : null
      );

    const sanitizedPortfolio = {
      star: sanitizeTierAssets(portfolio.star),
      core: sanitizeTierAssets(portfolio.core),
      support: sanitizeTierAssets(portfolio.support),
    };

    // Sanitize bench
    const sanitizedBench = {
      stocks: (bench?.stocks || []).map((asset) =>
        asset
          ? {
              symbol: String(asset.symbol || '').toUpperCase(),
              name: String(asset.name || asset.symbol || ''),
              baseATR: Number(thresholds[asset.symbol]?.threshold || asset.baseATR || 2.5),
              isCrypto: false,
            }
          : null
      ),
      crypto: bench?.crypto
        ? {
            symbol: String(bench.crypto.symbol || '').toUpperCase(),
            name: String(bench.crypto.name || bench.crypto.symbol || ''),
            baseATR: Number(thresholds[bench.crypto.symbol]?.threshold || bench.crypto.baseATR || 5.0),
            isCrypto: true,
          }
        : null,
    };

    // Sanitize thresholds
    const sanitizedThresholds = {};
    for (const [symbol, data] of Object.entries(thresholds || {})) {
      if (data && typeof data === 'object') {
        sanitizedThresholds[String(symbol)] = {
          threshold: Number(data.threshold) || 2.5,
          rallyThreshold: Number(data.rallyThreshold) || 3.75,
          moonshotThreshold: Number(data.moonshotThreshold) || 5.0,
        };
      }
    }

    // Calculate timing windows
    const commitmentDeadline = getTodayDeadline();
    const battleStart = getNextBattleStart();
    const battleEnd = getBattleEndTime(battleStart);

    // Calculate lobby expiration time (when lobby auto-disbands if no opponent joins)
    const lobbyExpiresAt = new Date(Date.now() + lobbyTimeMinutes * 60000);

    // Initialize history tracking per asset
    const initializeHistory = (portfolio) => {
      const history = {};
      const allSymbols = [
        ...(portfolio.star || []).filter(Boolean).map((a) => a.symbol),
        ...(portfolio.core || []).filter(Boolean).map((a) => a.symbol),
        ...(portfolio.support || []).filter(Boolean).map((a) => a.symbol),
      ];
      allSymbols.forEach((symbol) => {
        history[symbol] = { maxMultiplier: 0, minMultiplier: 0, badges: [] };
      });
      return history;
    };

    const battle = {
      _v: 3, // Schema version for tier-based portfolio

      type: 'baggerbomb_v3',
      challengeCode: challengeCode,
      visibility: battleData.visibility || 'public', // 'public' = appears in lobby, 'private' = code only

      creator: {
        uid: String(battleData.creator?.uid || 'anonymous'),
        odUserId: String(battleData.creator?.odUserId || battleData.creator?.uid || 'anonymous'),
        username: String(battleData.creator?.username || 'Player'),
        avatar: String(battleData.creator?.avatar || ''),
        portfolio: sanitizedPortfolio,
        bench: sanitizedBench,
        history: initializeHistory(sanitizedPortfolio),
        sessionScores: {
          MORNING_BELL: 0,
          MIDDAY: 0,
          POWER_HOUR: 0,
          NIGHT_GAME: 0,
        },
        totalScore: 0,
        baggerBombs: 0,
        busts: 0,
      },

      opponent: {
        uid: '',
        odUserId: '',
        username: '',
        avatar: '',
        portfolio: { star: [null, null], core: [null, null], support: [null, null, null] },
        bench: { stocks: [null, null, null], crypto: null },
        history: {},
        sessionScores: {
          MORNING_BELL: 0,
          MIDDAY: 0,
          POWER_HOUR: 0,
          NIGHT_GAME: 0,
        },
        totalScore: 0,
        baggerBombs: 0,
        busts: 0,
      },

      timing: {
        createdAt: new Date().toISOString(),
        commitmentDeadline: commitmentDeadline.toISOString(),
        baselineLockTime: '',
        scheduledStart: battleStart.toISOString(),
        scheduledEnd: battleEnd.toISOString(),
        actualStart: '',
        actualEnd: '',
        lobbyExpiresAt: lobbyExpiresAt.toISOString(), // When lobby auto-disbands if no opponent
      },

      // Lobby time selection (for display and reference)
      lobbyTimeMinutes: lobbyTimeMinutes,

      state: {
        status: 'waiting',
        currentSession: '',
        completedSessions: [],
        startingPrices: {},
        isActive: false,
      },

      sessionPrices: initializeSessionPrices(),
      thresholds: sanitizedThresholds,

      // Events array for live feed
      events: [],

      // Per-session scoring
      sessionScores: {
        MORNING_BELL: { creator: 0, opponent: 0, winner: '' },
        MIDDAY: { creator: 0, opponent: 0, winner: '' },
        POWER_HOUR: { creator: 0, opponent: 0, winner: '' },
        NIGHT_GAME: { creator: 0, opponent: 0, winner: '' },
      },

      substitutions: [],
      substitutionsRemaining: { creator: 2, opponent: 2 },

      result: {},

      metadata: {
        spectatorCount: 0,
        featured: false,
        tags: ['baggerbomb-v3', 'tier-based', 'slot-portfolio'],
      },

      archived: false,
      updatedAt: new Date().toISOString(),
    };

    // Remove any remaining undefined values
    const cleanedBattle = removeUndefined(battle);

    console.log('📤 V3 Battle object for Firebase:', JSON.stringify(cleanedBattle, null, 2));

    const battleRef = await addDoc(collection(db, 'battles'), cleanedBattle);

    console.log('✅ BaggerBomb V3 battle created:', battleRef.id);

    return {
      id: battleRef.id,
      ...cleanedBattle,
    };
  } catch (error) {
    console.error('❌ Error creating BaggerBomb V3 battle:', error);
    throw new Error(`Failed to create BaggerBomb V3 battle: ${error.message}`);
  }
}

/**
 * Add a threshold crossing event to the battle's events array
 *
 * @param {string} battleId - Battle document ID
 * @param {Object} event - Event object from createThresholdEvent
 * @returns {Promise<void>}
 */
export async function addBaggerBombEvent(battleId, event) {
  try {
    const battleRef = doc(db, 'battles', battleId);
    await updateDoc(battleRef, {
      events: arrayUnion(event),
      updatedAt: new Date().toISOString(),
    });
    console.log('✅ Event added to battle:', event);
  } catch (error) {
    console.error('❌ Error adding event:', error);
    throw error;
  }
}

/**
 * Update asset history in battle document
 *
 * @param {string} battleId - Battle document ID
 * @param {boolean} isCreator - Whether updating creator or opponent
 * @param {string} symbol - Asset symbol
 * @param {Object} history - Updated history object
 * @returns {Promise<void>}
 */
export async function updateAssetHistoryInBattle(battleId, isCreator, symbol, history) {
  try {
    const battleRef = doc(db, 'battles', battleId);
    const field = isCreator ? 'creator.history' : 'opponent.history';

    await updateDoc(battleRef, {
      [`${field}.${symbol}`]: history,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error updating asset history:', error);
    throw error;
  }
}

/**
 * Batch-update BaggerBomb history for a Snake Draft document.
 * Used by DraftBattleScreenV2's debounced persistence to avoid write storms.
 *
 * @param {string} draftId - Draft document ID
 * @param {Object} historyUpdates - { SYMBOL: { maxMultiplier, minMultiplier, ... }, ... }
 * @returns {Promise<void>}
 */
export async function updateDraftHistory(draftId, historyUpdates) {
  try {
    const draftRef = doc(db, 'drafts', draftId);
    const updates = { updatedAt: new Date().toISOString() };
    for (const [symbol, history] of Object.entries(historyUpdates)) {
      updates[`history.${symbol}`] = history;
    }
    await updateDoc(draftRef, updates);
  } catch (error) {
    console.error('❌ Error updating draft history:', error);
    throw error;
  }
}

/**
 * Join a BaggerBomb Scoring V2 battle
 *
 * @param {string} challengeCode - 4-character challenge code
 * @param {Object} opponentData - Opponent's data
 * @returns {Promise<Object>} - Updated battle
 */
export async function joinBaggerBombBattle(challengeCode, opponentData) {
  try {
    // Validate input data
    if (!challengeCode || typeof challengeCode !== 'string') {
      throw new Error('Invalid challenge code');
    }

    if (!opponentData) {
      throw new Error('Opponent data is required');
    }

    // Ensure portfolio is an array
    if (!Array.isArray(opponentData.portfolio)) {
      console.error('Invalid portfolio data:', opponentData);
      throw new Error('Portfolio must be an array');
    }

    if (opponentData.portfolio.length === 0) {
      throw new Error('Portfolio cannot be empty');
    }

    // Ensure bench is an array (default to empty array if not provided)
    if (opponentData.bench && !Array.isArray(opponentData.bench)) {
      opponentData.bench = [];
    }

    // Find V2 battle by challenge code
    const q = query(
      collection(db, 'battles'),
      where('challengeCode', '==', challengeCode.toUpperCase()),
      where('state.status', '==', 'waiting'),
      where('_v', '==', 2),
      where('archived', '==', false)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error('BaggerBomb battle not found or already started');
    }

    const battleDoc = snapshot.docs[0];
    const battleData = battleDoc.data();

    // Check if user is trying to join their own battle
    if (battleData.creator.uid === opponentData.uid) {
      throw new Error('You cannot join your own battle');
    }

    // Fetch thresholds for opponent's assets
    const opponentThresholds = await fetchAllThresholds(
      opponentData.portfolio,
      opponentData.bench
    );

    // Merge thresholds (creator's + opponent's)
    const mergedThresholds = {
      ...battleData.thresholds,
      ...opponentThresholds
    };

    // Calculate battle timing
    const timing = calculateBattleTiming();

    // Build starting prices from current prices
    const startingPrices = {};
    const allAssets = [
      ...battleData.creator.portfolio,
      ...(battleData.creator.bench || []),
      ...opponentData.portfolio,
      ...(opponentData.bench || [])
    ];

    for (const asset of allAssets) {
      const symbol = asset.symbol.toUpperCase();
      if (!startingPrices[symbol]) {
        startingPrices[symbol] = opponentData.currentPrices?.[symbol] || asset.price || 0;
      }
    }

    // Initialize MORNING_BELL open prices
    const sessionPrices = initializeSessionPrices();
    sessionPrices.MORNING_BELL.open = { ...startingPrices };
    sessionPrices.MORNING_BELL.capturedAt.open = new Date().toISOString();

    // Format opponent portfolio and bench
    const formattedPortfolio = opponentData.portfolio.map(asset => ({
      symbol: asset.symbol.toUpperCase(),
      name: asset.name || asset.assetName || asset.symbol,
      price: asset.price || 0,
      amount: asset.amount || asset.allocation || 0,
      position: asset.position || 'long'
    }));

    const formattedBench = (opponentData.bench || []).map(asset => ({
      symbol: asset.symbol.toUpperCase(),
      name: asset.name || asset.assetName || asset.symbol,
      price: asset.price || 0,
      amount: 0,
      position: asset.position || 'long'
    }));

    // Update battle with opponent
    // CRITICAL: Firebase does NOT allow undefined values - use empty string as fallback
    const battleRef = doc(db, 'battles', battleDoc.id);

    await updateDoc(battleRef, {
      'opponent.uid': opponentData.uid || opponentData.odUserId || '',
      'opponent.odUserId': opponentData.odUserId || opponentData.uid || '',
      'opponent.username': opponentData.username || opponentData.odUsername || '',
      'opponent.portfolioName': opponentData.portfolioName || 'Portfolio',
      'opponent.portfolioType': opponentData.portfolioType || 'baggerbomb',
      'opponent.portfolio': formattedPortfolio,
      'opponent.bench': formattedBench,
      'opponent.cryptoAllocation': 10,

      'timeline.startDate': timing.startDate,
      'timeline.endDate': timing.endDate,

      'state.status': 'active',
      'state.currentSession': 'MORNING_BELL',
      'state.startingPrices': startingPrices,

      sessionPrices: sessionPrices,
      thresholds: mergedThresholds,

      updatedAt: new Date().toISOString()
    });

    console.log('✅ BaggerBomb battle joined:', battleDoc.id);

    // Return updated battle
    const updatedBattle = await getBattle(battleDoc.id);
    return updatedBattle;
  } catch (error) {
    console.error('❌ Error joining BaggerBomb battle:', error);
    throw error;
  }
}

/**
 * Join a BaggerBomb V3 battle (tier-based portfolio)
 * Supports joining by battleId (lobby) or challengeCode (legacy)
 *
 * @param {string} battleIdOrCode - Battle ID (from lobby) or challenge code
 * @param {Object} opponentData - Opponent's data with tiered portfolio
 * @param {Object} options - Optional { joinByBattleId: boolean }
 * @returns {Promise<Object>} - Updated battle
 */
export async function joinBaggerBombBattleV3(battleIdOrCode, opponentData, options = {}) {
  try {
    const { joinByBattleId = false, livePrices = null } = options;
    console.log('🔥 joinBaggerBombBattleV3 called with:', { battleIdOrCode, opponentData, joinByBattleId });

    // Validate input
    if (!battleIdOrCode || typeof battleIdOrCode !== 'string') {
      throw new Error('Battle ID or challenge code is required');
    }

    if (!opponentData) {
      throw new Error('Opponent data is required');
    }

    const { portfolio, bench } = opponentData;
    if (!portfolio || !portfolio.star || !portfolio.core || !portfolio.support) {
      throw new Error('Portfolio must have star, core, and support tiers');
    }

    let battleDoc;
    let battleData;

    // Join by battle ID (from lobby) or by challenge code (legacy)
    if (joinByBattleId) {
      // Direct lookup by battle ID
      const battleRef = doc(db, 'battles', battleIdOrCode);
      const battleSnap = await getDoc(battleRef);

      if (!battleSnap.exists()) {
        throw new Error('Battle not found');
      }

      battleData = battleSnap.data();
      battleDoc = { id: battleSnap.id, ref: battleRef };

      // Validate battle state
      if (battleData._v !== 3) {
        throw new Error('Invalid battle version');
      }
      if (battleData.state?.status !== 'waiting') {
        throw new Error('Battle is no longer available');
      }
      if (battleData.archived) {
        throw new Error('Battle has been archived');
      }
    } else {
      // Legacy: Find V3 battle by challenge code
      const q = query(
        collection(db, 'battles'),
        where('challengeCode', '==', battleIdOrCode.toUpperCase()),
        where('state.status', '==', 'waiting'),
        where('_v', '==', 3),
        where('archived', '==', false)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        throw new Error('BaggerBomb V3 battle not found or already started');
      }

      const foundDoc = snapshot.docs[0];
      battleData = foundDoc.data();
      battleDoc = { id: foundDoc.id, ref: doc(db, 'battles', foundDoc.id) };
    }

    // Check if user is trying to join their own battle
    const creatorId = battleData.creator?.odUserId || battleData.creator?.uid;
    const opponentId = opponentData.odUserId || opponentData.uid;
    if (creatorId === opponentId) {
      throw new Error('You cannot join your own battle');
    }

    // Collect all opponent assets for threshold fetching
    const allOpponentAssets = [
      ...(portfolio.star || []).filter(Boolean),
      ...(portfolio.core || []).filter(Boolean),
      ...(portfolio.support || []).filter(Boolean),
      ...(bench?.stocks || []).filter(Boolean),
      bench?.crypto,
    ].filter(Boolean);

    // Fetch thresholds for opponent's assets
    let opponentThresholds = {};
    try {
      opponentThresholds = await fetchAllThresholds(allOpponentAssets, []);
    } catch (err) {
      console.warn('⚠️ Could not fetch opponent thresholds:', err.message);
    }

    // Merge thresholds
    const mergedThresholds = {
      ...battleData.thresholds,
      ...opponentThresholds
    };

    // Sanitize opponent portfolio tiers
    const sanitizeTierAssets = (assets) =>
      (assets || []).map((asset) =>
        asset
          ? {
              symbol: String(asset.symbol || '').toUpperCase(),
              name: String(asset.name || asset.symbol || ''),
              baseATR: Number(asset.baseATR || opponentThresholds[asset.symbol]?.threshold || 2.5),
              isCrypto: Boolean(asset.isCrypto),
            }
          : null
      );

    const sanitizedPortfolio = {
      star: sanitizeTierAssets(portfolio.star),
      core: sanitizeTierAssets(portfolio.core),
      support: sanitizeTierAssets(portfolio.support),
    };

    const sanitizedBench = {
      stocks: (bench?.stocks || []).map((asset) =>
        asset
          ? {
              symbol: String(asset.symbol || '').toUpperCase(),
              name: String(asset.name || asset.symbol || ''),
              baseATR: Number(asset.baseATR || opponentThresholds[asset.symbol]?.threshold || 2.5),
              isCrypto: false,
            }
          : null
      ),
      crypto: bench?.crypto
        ? {
            symbol: String(bench.crypto.symbol || '').toUpperCase(),
            name: String(bench.crypto.name || bench.crypto.symbol || ''),
            baseATR: Number(bench.crypto.baseATR || opponentThresholds[bench.crypto.symbol]?.threshold || 5.0),
            isCrypto: true,
          }
        : null,
    };

    // Initialize opponent history
    const initializeHistory = (portfolio) => {
      const history = {};
      const allSymbols = [
        ...(portfolio.star || []).filter(Boolean).map((a) => a.symbol),
        ...(portfolio.core || []).filter(Boolean).map((a) => a.symbol),
        ...(portfolio.support || []).filter(Boolean).map((a) => a.symbol),
      ];
      allSymbols.forEach((symbol) => {
        history[symbol] = { maxMultiplier: 0, minMultiplier: 0, badges: [] };
      });
      return history;
    };

    // ============ CAPTURE STARTING PRICES ============
    // Collect all symbols from both portfolios
    const collectSymbols = (portfolio) => {
      const symbols = [];
      if (portfolio.star) symbols.push(...portfolio.star.filter(Boolean).map(a => a.symbol));
      if (portfolio.core) symbols.push(...portfolio.core.filter(Boolean).map(a => a.symbol));
      if (portfolio.support) symbols.push(...portfolio.support.filter(Boolean).map(a => a.symbol));
      return symbols;
    };

    const creatorSymbols = collectSymbols(battleData.creator.portfolio || {});
    const opponentSymbols = collectSymbols(sanitizedPortfolio);
    const benchSymbols = [
      ...(battleData.creator.bench?.stocks || []).filter(Boolean).map(a => a.symbol),
      battleData.creator.bench?.crypto?.symbol,
      ...(sanitizedBench.stocks || []).filter(Boolean).map(a => a.symbol),
      sanitizedBench.crypto?.symbol,
    ].filter(Boolean);

    const allSymbols = [...new Set([...creatorSymbols, ...opponentSymbols, ...benchSymbols])];

    // Fetch current prices — uses cache-busting live fetch during market hours
    const { getLivePrices } = await import('../services/eodhdAPI.js');

    let startingPrices = {};
    let priceSource = 'EOD';

    try {
      const cryptoSymbols = allSymbols.filter(s => isCrypto(s));
      const stockSymbols = allSymbols.filter(s => !isCrypto(s));

      const [stockResult, cryptoResult] = await Promise.all([
        stockSymbols.length > 0 ? getLivePrices(stockSymbols) : { prices: {}, source: 'EOD' },
        cryptoSymbols.length > 0 ? getLivePrices(cryptoSymbols, { isCrypto: true }) : { prices: {}, source: 'EOD' },
      ]);

      startingPrices = { ...stockResult.prices, ...cryptoResult.prices };
      priceSource = stockResult.source || cryptoResult.source || 'EOD';
    } catch (priceError) {
      console.warn('⚠️ Error fetching prices for V3 battle:', priceError.message);
    }

    // Override with WebSocket live prices where available (most fresh, sub-second)
    console.log('[Price Capture V3] livePrices received:',
      livePrices ? Object.keys(livePrices).length + ' symbols' : 'null/undefined');
    console.log('[Price Capture V3] livePrices sample:',
      livePrices ? Object.entries(livePrices).slice(0, 3).map(([s, p]) => `${s}=$${p}`) : 'none');
    if (livePrices && typeof livePrices === 'object') {
      let wsOverrides = 0;
      for (const symbol of allSymbols) {
        const wsPrice = livePrices[symbol];
        if (wsPrice && wsPrice > 0) {
          startingPrices[symbol] = wsPrice;
          wsOverrides++;
        }
      }
      if (wsOverrides > 0) priceSource = 'WS+API';
    }

    console.log(`[Price Capture V3] startingPrices (source: ${priceSource}):`,
      Object.entries(startingPrices).map(([s, p]) => `${s}=$${(p || 0).toFixed(2)}`).join(', '));

    // Initialize session prices with MORNING_BELL open
    const sessionPrices = initializeSessionPrices();
    sessionPrices.MORNING_BELL.open = { ...startingPrices };
    sessionPrices.MORNING_BELL.capturedAt.open = new Date().toISOString();
    // ============ END PRICE CAPTURE ============

    // Update battle with opponent
    const battleRef = doc(db, 'battles', battleDoc.id);

    await updateDoc(battleRef, {
      'opponent.uid': opponentData.uid || opponentData.odUserId || '',
      'opponent.odUserId': opponentData.odUserId || opponentData.uid || '',
      'opponent.username': opponentData.username || opponentData.displayName || '',
      'opponent.avatar': opponentData.avatar || '',
      'opponent.portfolio': sanitizedPortfolio,
      'opponent.bench': sanitizedBench,
      'opponent.history': initializeHistory(sanitizedPortfolio),
      'opponent.sessionScores': {
        MORNING_BELL: 0,
        MIDDAY: 0,
        POWER_HOUR: 0,
        NIGHT_GAME: 0,
      },
      'opponent.totalScore': 0,
      'opponent.baggerBombs': 0,
      'opponent.busts': 0,

      'state.status': 'active',
      'state.currentSession': 'MORNING_BELL',
      'state.startingPrices': startingPrices,
      'state.startingPriceSource': priceSource,

      sessionPrices: sessionPrices,
      thresholds: mergedThresholds,

      updatedAt: new Date().toISOString()
    });

    console.log('✅ BaggerBomb V3 battle joined:', battleDoc.id);

    // Return updated battle
    const updatedBattle = await getBattle(battleDoc.id);
    return { success: true, battle: updatedBattle };
  } catch (error) {
    console.error('❌ Error joining BaggerBomb V3 battle:', error);
    throw error;
  }
}

// =====================================================
// BAGGERBOMB V4 BATTLE CREATION (Free Agent System)
// =====================================================

/**
 * Create a BaggerBomb V4 battle (Free Agent system, 3-day duration)
 *
 * V4 removes: bench, sessions, substitutions, sessionPrices, sessionScores
 * V4 adds: freeAgents, swaps, closedTrades, dailyOpenPrices, tradingDayDates
 *
 * @param {Object} battleData - Battle creation data
 * @param {number} lobbyTimeMinutes - Minutes before lobby auto-disbands (default 30)
 * @returns {Promise<Object>} Created battle with id
 */
export async function createBaggerBombBattleV4(battleData, lobbyTimeMinutes = 30) {
  try {
    console.log('🔥 createBaggerBombBattleV4 called with:', battleData, 'lobbyTimeMinutes:', lobbyTimeMinutes);

    // Validate portfolio structure (NO bench required for V4)
    const { portfolio } = battleData;
    if (!portfolio || !portfolio.star || !portfolio.core || !portfolio.support) {
      throw new Error('Portfolio must have star, core, and support tiers');
    }

    // Generate challenge code
    const challengeCode = battleData.challengeCode ||
      `BB${Date.now().toString(36).slice(-4).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // Collect all symbols for threshold fetching (no bench in V4)
    const allAssets = [
      ...(portfolio.star || []).filter(Boolean),
      ...(portfolio.core || []).filter(Boolean),
      ...(portfolio.support || []).filter(Boolean),
    ].filter(Boolean);

    // Fetch volatility thresholds
    let thresholds = {};
    try {
      thresholds = await fetchAllThresholds(allAssets, []);
    } catch (thresholdError) {
      console.warn('⚠️ Could not fetch thresholds:', thresholdError.message);
    }

    // Sanitize portfolio tiers
    const sanitizeTierAssets = (assets) =>
      (assets || []).map((asset) =>
        asset
          ? {
              symbol: String(asset.symbol || '').toUpperCase(),
              name: String(asset.name || asset.symbol || ''),
              baseATR: Number(thresholds[asset.symbol]?.threshold || asset.baseATR || 2.5),
              isCrypto: Boolean(asset.isCrypto),
            }
          : null
      );

    const sanitizedPortfolio = {
      star: sanitizeTierAssets(portfolio.star),
      core: sanitizeTierAssets(portfolio.core),
      support: sanitizeTierAssets(portfolio.support),
    };

    // Sanitize thresholds
    const sanitizedThresholds = {};
    for (const [symbol, data] of Object.entries(thresholds || {})) {
      if (data && typeof data === 'object') {
        sanitizedThresholds[String(symbol)] = {
          threshold: Number(data.threshold) || 2.5,
          rallyThreshold: Number(data.rallyThreshold) || 3.75,
          moonshotThreshold: Number(data.moonshotThreshold) || 5.0,
        };
      }
    }

    // Calculate V4 timing (3 trading days)
    const isTraining = Boolean(battleData.isTraining);
    const tradingDays = isTraining ? 1 : 3;
    const battleStart = getNextBattleStart();
    const tradingDayDates = getTradingDayDates(battleStart, tradingDays);
    const battleEnd = getBattleEndTimeV4(tradingDayDates);

    // Calculate lobby expiration
    const lobbyExpiresAt = new Date(Date.now() + lobbyTimeMinutes * 60000);

    // Initialize history tracking per asset with dailyThresholds
    const initializeHistoryV4 = (portfolio) => {
      const history = {};
      const allSymbols = [
        ...(portfolio.star || []).filter(Boolean).map((a) => a.symbol),
        ...(portfolio.core || []).filter(Boolean).map((a) => a.symbol),
        ...(portfolio.support || []).filter(Boolean).map((a) => a.symbol),
      ];
      allSymbols.forEach((symbol) => {
        history[symbol] = {
          maxMultiplier: 0,
          minMultiplier: 0,
          badges: [],
          dailyThresholds: {},
        };
      });
      return history;
    };

    // Generate initial free agents
    const freeAgents = createInitialFreeAgents();

    // Initialize swaps
    const swaps = initializeSwaps(isTraining, tradingDays);

    const battle = {
      _v: 4,
      type: 'baggerbomb_v4',
      challengeCode,
      visibility: battleData.visibility || 'public',

      creator: {
        uid: String(battleData.creator?.uid || 'anonymous'),
        odUserId: String(battleData.creator?.odUserId || battleData.creator?.uid || 'anonymous'),
        username: String(battleData.creator?.username || 'Player'),
        avatar: String(battleData.creator?.avatar || ''),
        portfolio: sanitizedPortfolio,
        swaps,
        closedTrades: [],
        history: initializeHistoryV4(sanitizedPortfolio),
        totalScore: 0,
        baggerBombs: 0,
        busts: 0,
      },

      opponent: {
        uid: '',
        odUserId: '',
        username: '',
        avatar: '',
        portfolio: { star: [null, null], core: [null, null], support: [null, null, null] },
        swaps: initializeSwaps(isTraining, tradingDays),
        closedTrades: [],
        history: {},
        totalScore: 0,
        baggerBombs: 0,
        busts: 0,
      },

      freeAgents,

      timing: {
        createdAt: new Date().toISOString(),
        lobbyExpiresAt: lobbyExpiresAt.toISOString(),
        scheduledStart: battleStart.toISOString(),
        scheduledEnd: battleEnd.toISOString(),
        actualStart: '',
        actualEnd: '',
        tradingDays,
        tradingDayDates,
        currentTradingDay: 1,
      },

      lobbyTimeMinutes,

      state: {
        status: 'waiting',
        startingPrices: {},
        dailyOpenPrices: initializeDailyOpenPrices(tradingDays),
        isActive: false,
      },

      thresholds: sanitizedThresholds,
      events: [],

      result: {},

      metadata: {
        spectatorCount: 0,
        featured: false,
        tags: ['baggerbomb-v4', 'free-agent', 'tier-based'],
      },

      isTraining: isTraining || false,
      archived: false,
      updatedAt: new Date().toISOString(),
    };

    const cleanedBattle = removeUndefined(battle);
    console.log('📤 V4 Battle object for Firebase:', JSON.stringify(cleanedBattle, null, 2));

    const battleRef = await addDoc(collection(db, 'battles'), cleanedBattle);
    console.log('✅ BaggerBomb V4 battle created:', battleRef.id);

    return {
      id: battleRef.id,
      ...cleanedBattle,
    };
  } catch (error) {
    console.error('❌ Error creating BaggerBomb V4 battle:', error);
    throw new Error(`Failed to create BaggerBomb V4 battle: ${error.message}`);
  }
}

/**
 * Join a BaggerBomb V4 battle
 * Supports joining by battleId (lobby) or challengeCode (legacy)
 *
 * @param {string} battleIdOrCode - Battle ID or challenge code
 * @param {Object} opponentData - Opponent's data with tiered portfolio (NO bench)
 * @param {Object} options - { joinByBattleId: boolean }
 * @returns {Promise<Object>} Updated battle
 */
export async function joinBaggerBombBattleV4(battleIdOrCode, opponentData, options = {}) {
  try {
    const { joinByBattleId = false, livePrices = null } = options;
    console.log('🔥 joinBaggerBombBattleV4 called with:', { battleIdOrCode, opponentData, joinByBattleId });

    if (!battleIdOrCode || typeof battleIdOrCode !== 'string') {
      throw new Error('Battle ID or challenge code is required');
    }

    if (!opponentData) {
      throw new Error('Opponent data is required');
    }

    const { portfolio } = opponentData;
    if (!portfolio || !portfolio.star || !portfolio.core || !portfolio.support) {
      throw new Error('Portfolio must have star, core, and support tiers');
    }

    let battleDoc;
    let battleData;

    if (joinByBattleId) {
      const battleRef = doc(db, 'battles', battleIdOrCode);
      const battleSnap = await getDoc(battleRef);

      if (!battleSnap.exists()) {
        throw new Error('Battle not found');
      }

      battleData = battleSnap.data();
      battleDoc = { id: battleSnap.id, ref: battleRef };

      if (battleData._v !== 4) {
        throw new Error('Invalid battle version (expected V4)');
      }
      if (battleData.state?.status !== 'waiting') {
        throw new Error('Battle is no longer available');
      }
      if (battleData.archived) {
        throw new Error('Battle has been archived');
      }
    } else {
      const q = query(
        collection(db, 'battles'),
        where('challengeCode', '==', battleIdOrCode.toUpperCase()),
        where('state.status', '==', 'waiting'),
        where('_v', '==', 4),
        where('archived', '==', false)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        throw new Error('BaggerBomb V4 battle not found or already started');
      }

      const foundDoc = snapshot.docs[0];
      battleData = foundDoc.data();
      battleDoc = { id: foundDoc.id, ref: doc(db, 'battles', foundDoc.id) };
    }

    // Check not joining own battle
    const creatorId = battleData.creator?.odUserId || battleData.creator?.uid;
    const opponentId = opponentData.odUserId || opponentData.uid;
    if (creatorId === opponentId) {
      throw new Error('You cannot join your own battle');
    }

    // Collect opponent assets for thresholds (no bench)
    const allOpponentAssets = [
      ...(portfolio.star || []).filter(Boolean),
      ...(portfolio.core || []).filter(Boolean),
      ...(portfolio.support || []).filter(Boolean),
    ].filter(Boolean);

    let opponentThresholds = {};
    try {
      opponentThresholds = await fetchAllThresholds(allOpponentAssets, []);
    } catch (err) {
      console.warn('⚠️ Could not fetch opponent thresholds:', err.message);
    }

    const mergedThresholds = {
      ...battleData.thresholds,
      ...opponentThresholds,
    };

    // Sanitize opponent portfolio
    const sanitizeTierAssets = (assets) =>
      (assets || []).map((asset) =>
        asset
          ? {
              symbol: String(asset.symbol || '').toUpperCase(),
              name: String(asset.name || asset.symbol || ''),
              baseATR: Number(asset.baseATR || opponentThresholds[asset.symbol]?.threshold || 2.5),
              isCrypto: Boolean(asset.isCrypto),
            }
          : null
      );

    const sanitizedPortfolio = {
      star: sanitizeTierAssets(portfolio.star),
      core: sanitizeTierAssets(portfolio.core),
      support: sanitizeTierAssets(portfolio.support),
    };

    // Initialize opponent history with dailyThresholds
    const initializeHistoryV4 = (portfolio) => {
      const history = {};
      const allSymbols = [
        ...(portfolio.star || []).filter(Boolean).map((a) => a.symbol),
        ...(portfolio.core || []).filter(Boolean).map((a) => a.symbol),
        ...(portfolio.support || []).filter(Boolean).map((a) => a.symbol),
      ];
      allSymbols.forEach((symbol) => {
        history[symbol] = {
          maxMultiplier: 0,
          minMultiplier: 0,
          badges: [],
          dailyThresholds: {},
        };
      });
      return history;
    };

    // ============ CAPTURE STARTING PRICES ============
    const collectSymbols = (portfolio) => {
      const symbols = [];
      if (portfolio.star) symbols.push(...portfolio.star.filter(Boolean).map(a => a.symbol));
      if (portfolio.core) symbols.push(...portfolio.core.filter(Boolean).map(a => a.symbol));
      if (portfolio.support) symbols.push(...portfolio.support.filter(Boolean).map(a => a.symbol));
      return symbols;
    };

    const creatorSymbols = collectSymbols(battleData.creator.portfolio || {});
    const opponentSymbols = collectSymbols(sanitizedPortfolio);
    const allSymbols = [...new Set([...creatorSymbols, ...opponentSymbols])];

    // Fetch current prices — uses cache-busting live fetch during market hours
    const { getLivePrices } = await import('../services/eodhdAPI.js');

    let startingPrices = {};
    let priceSource = 'EOD';

    try {
      const cryptoSymbols = allSymbols.filter(s => isCrypto(s));
      const stockSymbols = allSymbols.filter(s => !isCrypto(s));

      const [stockResult, cryptoResult] = await Promise.all([
        stockSymbols.length > 0 ? getLivePrices(stockSymbols) : { prices: {}, source: 'EOD' },
        cryptoSymbols.length > 0 ? getLivePrices(cryptoSymbols, { isCrypto: true }) : { prices: {}, source: 'EOD' },
      ]);

      startingPrices = { ...stockResult.prices, ...cryptoResult.prices };
      priceSource = stockResult.source || cryptoResult.source || 'EOD';
    } catch (priceError) {
      console.warn('⚠️ Error fetching prices for V4 battle:', priceError.message);
    }

    // Override with WebSocket live prices where available (most fresh, sub-second)
    console.log('[Price Capture V4] livePrices received:',
      livePrices ? Object.keys(livePrices).length + ' symbols' : 'null/undefined');
    console.log('[Price Capture V4] livePrices sample:',
      livePrices ? Object.entries(livePrices).slice(0, 3).map(([s, p]) => `${s}=$${p}`) : 'none');
    if (livePrices && typeof livePrices === 'object') {
      let wsOverrides = 0;
      for (const symbol of allSymbols) {
        const wsPrice = livePrices[symbol];
        if (wsPrice && wsPrice > 0) {
          startingPrices[symbol] = wsPrice;
          wsOverrides++;
        }
      }
      if (wsOverrides > 0) priceSource = 'WS+API';
    }

    console.log(`[Price Capture V4] startingPrices (source: ${priceSource}):`,
      Object.entries(startingPrices).map(([s, p]) => `${s}=$${(p || 0).toFixed(2)}`).join(', '));

    // Set day1 open prices = starting prices
    const tradingDays = battleData.timing?.tradingDays || 3;
    const dailyOpenPrices = initializeDailyOpenPrices(tradingDays);
    dailyOpenPrices.day1 = { ...startingPrices };

    // Initialize swaps for opponent
    const isTraining = Boolean(battleData.isTraining);
    const opponentSwaps = initializeSwaps(isTraining, tradingDays);

    // Update battle with opponent
    const battleRef = battleDoc.ref || doc(db, 'battles', battleDoc.id);

    await updateDoc(battleRef, {
      'opponent.uid': opponentData.uid || opponentData.odUserId || '',
      'opponent.odUserId': opponentData.odUserId || opponentData.uid || '',
      'opponent.username': opponentData.username || opponentData.displayName || '',
      'opponent.avatar': opponentData.avatar || '',
      'opponent.portfolio': sanitizedPortfolio,
      'opponent.swaps': opponentSwaps,
      'opponent.closedTrades': [],
      'opponent.history': initializeHistoryV4(sanitizedPortfolio),
      'opponent.totalScore': 0,
      'opponent.baggerBombs': 0,
      'opponent.busts': 0,

      'state.status': 'active',
      'state.startingPrices': startingPrices,
      'state.startingPriceSource': priceSource,
      'state.dailyOpenPrices': dailyOpenPrices,
      'state.isActive': true,

      thresholds: mergedThresholds,

      updatedAt: new Date().toISOString(),
    });

    console.log('✅ BaggerBomb V4 battle joined:', battleDoc.id);

    const updatedBattle = await getBattle(battleDoc.id);
    return { success: true, battle: updatedBattle };
  } catch (error) {
    console.error('❌ Error joining BaggerBomb V4 battle:', error);
    throw error;
  }
}

/**
 * Capture daily open prices for a V4 battle (called at 9:30 AM ET on Day 2/3)
 *
 * @param {string} battleId - Battle ID
 * @param {number} dayNumber - Trading day number (2 or 3)
 * @param {Object} prices - Map of symbol -> price
 * @returns {Promise<void>}
 */
export async function captureDailyOpenPrices(battleId, dayNumber, prices) {
  try {
    const battleRef = doc(db, 'battles', battleId);
    await updateDoc(battleRef, {
      [`state.dailyOpenPrices.day${dayNumber}`]: prices,
      [`timing.currentTradingDay`]: dayNumber,
      updatedAt: new Date().toISOString(),
    });
    console.log(`✅ Captured day${dayNumber} open prices for battle:`, battleId);
  } catch (error) {
    console.error('❌ Error capturing daily open prices:', error);
    throw error;
  }
}

/**
 * Update session prices for a battle
 *
 * @param {string} battleId - Battle ID
 * @param {string} sessionId - Session ID (MORNING_BELL, etc.)
 * @param {string} priceType - 'open' or 'close'
 * @param {Object} prices - Map of symbol -> price
 * @returns {Promise<void>}
 */
export async function updateSessionPrices(battleId, sessionId, priceType, prices) {
  try {
    const battleRef = doc(db, 'battles', battleId);

    await updateDoc(battleRef, {
      [`sessionPrices.${sessionId}.${priceType}`]: prices,
      [`sessionPrices.${sessionId}.capturedAt.${priceType}`]: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    console.log(`✅ Updated ${sessionId} ${priceType} prices for battle:`, battleId);
  } catch (error) {
    console.error('❌ Error updating session prices:', error);
    throw error;
  }
}

/**
 * Record session scores for a battle
 *
 * @param {string} battleId - Battle ID
 * @param {string} sessionId - Session ID
 * @param {Object} scores - { creator: number, opponent: number, winner: string }
 * @returns {Promise<void>}
 */
export async function recordSessionScores(battleId, sessionId, scores) {
  try {
    const battleRef = doc(db, 'battles', battleId);

    await updateDoc(battleRef, {
      [`sessionScores.${sessionId}`]: scores,
      [`state.completedSessions`]: scores.completedSessions || [],
      updatedAt: new Date().toISOString()
    });

    console.log(`✅ Recorded ${sessionId} scores for battle:`, battleId);
  } catch (error) {
    console.error('❌ Error recording session scores:', error);
    throw error;
  }
}

/**
 * Update current session for a battle
 *
 * @param {string} battleId - Battle ID
 * @param {string} sessionId - New current session ID
 * @param {Array} completedSessions - Array of completed session IDs
 * @returns {Promise<void>}
 */
export async function updateCurrentSession(battleId, sessionId, completedSessions) {
  try {
    const battleRef = doc(db, 'battles', battleId);

    await updateDoc(battleRef, {
      'state.currentSession': sessionId,
      'state.completedSessions': completedSessions,
      updatedAt: new Date().toISOString()
    });

    console.log(`✅ Updated current session to ${sessionId} for battle:`, battleId);
  } catch (error) {
    console.error('❌ Error updating current session:', error);
    throw error;
  }
}

/**
 * Add breakout event to battle
 *
 * @param {string} battleId - Battle ID
 * @param {string} playerId - 'creator' or 'opponent'
 * @param {Object} breakout - Breakout event object
 * @returns {Promise<void>}
 */
export async function addBreakoutEvent(battleId, playerId, breakout) {
  try {
    const battleRef = doc(db, 'battles', battleId);
    const battle = await getBattle(battleId);

    const existingBreakouts = battle.breakouts?.[playerId] || [];
    const updatedBreakouts = [...existingBreakouts, breakout];

    await updateDoc(battleRef, {
      [`breakouts.${playerId}`]: updatedBreakouts,
      updatedAt: new Date().toISOString()
    });

    console.log(`✅ Added breakout event for ${playerId}:`, breakout.type);
  } catch (error) {
    console.error('❌ Error adding breakout event:', error);
    throw error;
  }
}

/**
 * Complete a BaggerBomb Scoring V2 battle
 *
 * @param {string} battleId - Battle ID
 * @param {Object} resultData - Final battle results
 * @returns {Promise<void>}
 */
export async function completeBaggerBombBattle(battleId, resultData) {
  try {
    const battleRef = doc(db, 'battles', battleId);

    await updateDoc(battleRef, {
      'state.status': 'completed',
      'state.currentSession': null,
      'timeline.completedAt': new Date().toISOString(),
      result: {
        winner: resultData.winner,  // 'creator', 'opponent', or 'tie'
        creatorTotalScore: resultData.creatorTotalScore,
        opponentTotalScore: resultData.opponentTotalScore,
        sessionWins: resultData.sessionWins,  // { creator: n, opponent: n }
        breakoutCounts: resultData.breakoutCounts,  // { creator: n, opponent: n }
        cleanSweep: resultData.cleanSweep,  // 'creator', 'opponent', or null
        margin: resultData.margin
      },
      updatedAt: new Date().toISOString()
    });

    console.log('✅ BaggerBomb battle completed:', battleId);
  } catch (error) {
    console.error('❌ Error completing BaggerBomb battle:', error);
    throw error;
  }
}

// =====================================================
// TRAINING BATTLES
// =====================================================

/**
 * Generate a simple CPU portfolio for training battles
 * @param {string} assetType - 'stocks' or 'crypto'
 * @returns {Array} CPU portfolio with 9 random assets
 */
function generateCPUPortfolio(assetType) {
  const stockPool = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AMD', 'NFLX', 'CRM', 'INTC', 'ORCL'];
  const cryptoPool = ['BTC', 'ETH', 'SOL', 'ADA', 'DOGE', 'XRP', 'AVAX', 'DOT', 'MATIC', 'LINK'];

  const pool = assetType === 'crypto' ? cryptoPool : stockPool;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 9);

  return selected.map(symbol => ({
    symbol,
    name: symbol,
    price: 0,
    amount: 11.1,
    position: 'long'
  }));
}

/**
 * Create a training battle (single session, reduced thresholds)
 *
 * @param {Object} battleData - Training battle data
 * @returns {Promise<Object>} - Created training battle
 */
export async function createTrainingBattle(battleData) {
  try {
    // Check if training is available
    if (!isTrainingAvailable()) {
      throw new Error('Training is only available during market hours (9:30 AM - 8:00 PM ET, Mon-Fri)');
    }

    const { sessionName, endTime } = getCurrentSession();

    if (!sessionName) {
      throw new Error('No active session for training');
    }

    // Validate portfolio
    if (!battleData.portfolio || battleData.portfolio.length === 0) {
      throw new Error('Portfolio is required');
    }

    // Fetch and reduce thresholds by 30%
    let thresholds = {};
    try {
      const rawThresholds = await fetchAllThresholds(battleData.portfolio, []);
      for (const [symbol, data] of Object.entries(rawThresholds)) {
        thresholds[symbol] = {
          ...data,
          threshold: getTrainingThreshold(data.threshold || 2.5),
          originalThreshold: data.threshold || 2.5
        };
      }
    } catch (error) {
      console.warn('Could not fetch thresholds for training:', error.message);
    }

    // Sanitize portfolio
    const sanitizedPortfolio = battleData.portfolio
      .filter(asset => asset && asset.symbol)
      .map(asset => ({
        symbol: String(asset.symbol).toUpperCase(),
        name: String(asset.name || asset.symbol),
        price: Number(asset.price) || 0,
        amount: 11.1,
        position: 'long'
      }));

    // Generate CPU opponent
    const cpuPortfolio = generateCPUPortfolio(battleData.assetType || 'stocks');

    const battle = {
      _v: 2,
      type: 'baggerbomb_training',
      status: 'active',
      userId: String(battleData.userId || 'anonymous'),

      creator: {
        uid: String(battleData.userId || 'anonymous'),
        odUserId: String(battleData.userId || 'anonymous'),
        username: String(battleData.username || 'Player'),
        portfolio: sanitizedPortfolio,
        sessionScores: {},
        totalScore: 0
      },

      opponent: {
        uid: 'cpu',
        odUserId: 'cpu',
        username: 'CPU Opponent',
        portfolio: cpuPortfolio,
        sessionScores: {},
        totalScore: 0
      },

      thresholds,

      timing: {
        createdAt: new Date().toISOString(),
        sessionName,
        startTime: new Date().toISOString(),
        endTime: endTime.toISOString()
      },

      pricing: {
        baselinePrices: battleData.currentPrices || {}
      },

      scoring: {
        breakouts: { creator: [], opponent: [] }
      },

      isTrainingBattle: true,
      useConviction: TRAINING_CONFIG.USE_CONVICTION,
      useSessionBonuses: TRAINING_CONFIG.USE_SESSION_BONUSES,

      result: {},
      archived: false,
      updatedAt: new Date().toISOString()
    };

    const cleanedBattle = removeUndefined(battle);
    const docRef = await addDoc(collection(db, 'trainingBattles'), cleanedBattle);

    console.log('Training battle created:', docRef.id);

    return { id: docRef.id, ...cleanedBattle };
  } catch (error) {
    console.error('Error creating training battle:', error);
    throw error;
  }
}

/**
 * Get user's training battles
 *
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Training battles
 */
export async function getUserTrainingBattles(userId) {
  try {
    const q = query(
      collection(db, 'trainingBattles'),
      where('creator.odUserId', '==', userId),
      where('archived', '==', false),
      orderBy('timing.createdAt', 'desc'),
      limit(20)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching training battles:', error);
    return [];
  }
}

// =====================================================
// SNAKE DRAFT BATTLES
// =====================================================

/**
 * Create a Snake Draft BaggerBomb battle after draft completes
 *
 * @param {Object} draftData - Draft completion data
 * @returns {Promise<Object>} - Created Snake Draft battle
 */
export async function createSnakeDraftBattle(draftData) {
  try {
    // Fetch thresholds for all players' assets
    const allAssets = draftData.players.flatMap(p => p.picks || []);
    let thresholds = {};
    try {
      thresholds = await fetchAllThresholds(allAssets, []);
    } catch (error) {
      console.warn('Could not fetch thresholds for Snake Draft:', error.message);
    }

    const battleStartDate = getNextTradingDay();
    const battleEndDate = getSnakeDraftEndDate(draftData.assetType || 'stocks');

    const battle = {
      _v: 2,
      type: 'snake_draft_baggerbomb',
      draftId: draftData.draftId,
      status: 'active',

      players: draftData.players.map(player => ({
        odUserId: player.odUserId,
        username: player.username,
        portfolio: player.picks.map(asset => ({
          symbol: String(asset.symbol).toUpperCase(),
          name: asset.name || asset.symbol,
          price: asset.price || 0
        })),
        dailyScores: {},
        cumulativeScore: 0,
        currentRank: 0
      })),

      thresholds,

      timing: {
        draftCompletedAt: new Date().toISOString(),
        battleStartDate: battleStartDate.toISOString(),
        battleEndDate: battleEndDate.toISOString()
      },

      dailyResults: {},

      freeAgency: {
        swapsRemaining: draftData.players.reduce((acc, p) => {
          acc[p.odUserId] = 2;
          return acc;
        }, {}),
        history: []
      },

      // Snake Draft specific: no conviction multipliers
      useConviction: false,
      useSessionBonuses: false,

      finalResult: {},
      archived: false,
      updatedAt: new Date().toISOString()
    };

    const cleanedBattle = removeUndefined(battle);
    const docRef = await addDoc(collection(db, 'snakeDraftBattles'), cleanedBattle);

    console.log('Snake Draft battle created:', docRef.id);

    return { id: docRef.id, ...cleanedBattle };
  } catch (error) {
    console.error('Error creating Snake Draft battle:', error);
    throw error;
  }
}

// =====================================================
// EARNINGS GAME PORTFOLIOS
// =====================================================

/**
 * Save user's earnings portfolio
 *
 * @param {string} userId - User ID (odUserId or Firebase UID)
 * @param {Object} portfolioData - Portfolio data including predictions and isLocked
 * @returns {Promise<boolean>} - Success status
 */
export async function saveEarningsPortfolio(userId, portfolioData) {
  if (!userId) {
    console.warn('[Firebase] saveEarningsPortfolio: userId required');
    return false;
  }

  try {
    const docRef = doc(db, 'earningsPortfolios', userId);
    const cleanedData = removeUndefined({
      ...portfolioData,
      odUserId: userId,
      updatedAt: serverTimestamp()
    });

    await setDoc(docRef, cleanedData, { merge: true });
    console.log('✅ Earnings portfolio saved for user:', userId);
    return true;
  } catch (error) {
    console.error('❌ Error saving earnings portfolio:', error);
    throw error;
  }
}

/**
 * Load user's earnings portfolio
 *
 * @param {string} userId - User ID (odUserId or Firebase UID)
 * @returns {Promise<Object|null>} - Portfolio data or null if not found
 */
export async function loadEarningsPortfolio(userId) {
  if (!userId) {
    console.warn('[Firebase] loadEarningsPortfolio: userId required');
    return null;
  }

  try {
    const docRef = doc(db, 'earningsPortfolios', userId);
    const snapshot = await getDoc(docRef);

    if (snapshot.exists()) {
      console.log('✅ Earnings portfolio loaded for user:', userId);
      return snapshot.data();
    }

    console.log('📭 No earnings portfolio found for user:', userId);
    return null;
  } catch (error) {
    console.error('❌ Error loading earnings portfolio:', error);
    throw error;
  }
}

/**
 * Delete user's earnings portfolio
 *
 * @param {string} userId - User ID (odUserId or Firebase UID)
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteEarningsPortfolio(userId) {
  if (!userId) {
    console.warn('[Firebase] deleteEarningsPortfolio: userId required');
    return false;
  }

  try {
    const docRef = doc(db, 'earningsPortfolios', userId);
    await deleteDoc(docRef);
    console.log('✅ Earnings portfolio deleted for user:', userId);
    return true;
  } catch (error) {
    console.error('❌ Error deleting earnings portfolio:', error);
    throw error;
  }
}

// =====================================================
// EARNINGS TOURNAMENTS
// =====================================================

/**
 * Get week number of the year (ISO week)
 * @param {Date} date - Date to get week number for
 * @returns {number} - Week number (1-52)
 */
function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

/**
 * Calculate bracket based on rank and total entries
 * @param {number} rank - User's rank
 * @param {number} totalEntries - Total tournament entries
 * @returns {string} - Bracket tier
 */
function calculateBracket(rank, totalEntries) {
  if (rank === 1) return 'diamond';
  if (rank <= 3) return 'gold';
  if (rank <= Math.ceil(totalEntries * 0.1)) return 'silver'; // Top 10%
  if (rank <= Math.ceil(totalEntries * 0.25)) return 'bronze'; // Top 25%
  return 'participant';
}

/**
 * Verify if a prediction was correct
 * @param {Object} prediction - The prediction to verify
 * @param {number} actualMove - Actual price move percentage
 * @param {boolean} didBeat - Whether the company beat earnings
 * @returns {boolean} - Whether prediction was correct
 */
function verifyTournamentPrediction(prediction, actualMove, didBeat) {
  // Check outcome
  const outcomeCorrect =
    (prediction.outcome === 'beat' && didBeat) ||
    (prediction.outcome === 'miss' && !didBeat);

  if (!outcomeCorrect) return false;

  // Check magnitude based on precision tier
  const { magnitude, precisionTier } = prediction;

  // Define ranges for each magnitude band
  const ranges = {
    upBig: { min: 5, max: Infinity },
    up: { min: 2, max: 5 },
    flat: { min: -2, max: 2 },
    down: { min: -5, max: -2 },
    downBig: { min: -Infinity, max: -5 }
  };

  const range = ranges[magnitude];
  if (!range) return false;

  // For standard tier, just check the band
  if (precisionTier === 'standard' || !precisionTier) {
    if (magnitude === 'upBig') return actualMove > 5;
    if (magnitude === 'downBig') return actualMove < -5;
    return actualMove >= range.min && actualMove < range.max;
  }

  // For narrow/bullseye tiers, use the same band logic for now
  // (could be made stricter based on precisionRange in the future)
  if (magnitude === 'upBig') return actualMove > 5;
  if (magnitude === 'downBig') return actualMove < -5;
  return actualMove >= range.min && actualMove < range.max;
}

/**
 * Get or create the current week's tournament
 * Creates a new tournament document if one doesn't exist for this week
 *
 * @returns {Promise<Object>} - Tournament data with id
 */
export async function getCurrentTournament() {
  // Calculate current week's Monday
  const now = new Date();
  const monday = new Date(now);
  const dayOfWeek = now.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setDate(now.getDate() + daysToMonday);
  monday.setHours(0, 0, 0, 0);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);

  const weekId = `tournament_${monday.getFullYear()}_W${getWeekNumber(monday)}`;
  const tournamentRef = doc(db, 'earningsTournaments', weekId);

  try {
    const snapshot = await getDoc(tournamentRef);

    if (snapshot.exists()) {
      console.log('📅 Found existing tournament:', weekId);
      return { id: weekId, ...snapshot.data() };
    }

    // Create new tournament for this week
    // Lock deadline: Sunday night before earnings week starts
    // Monday 04:59:59 UTC = Sunday 11:59 PM EST / Sunday 8:59 PM PST
    // Uses setUTCHours for timezone-independent behavior (runs client-side)
    const lockDeadline = new Date(monday);
    lockDeadline.setUTCHours(4, 59, 59, 999);

    const newTournament = {
      id: weekId,
      name: `Earnings Week ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${friday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      weekStart: monday.toISOString().split('T')[0],
      weekEnd: friday.toISOString().split('T')[0],
      lockDeadline: lockDeadline.toISOString(),
      status: 'open',
      entryCount: 0,
      createdAt: serverTimestamp()
    };

    await setDoc(tournamentRef, newTournament);
    console.log('✅ Created new tournament:', weekId);
    return newTournament;
  } catch (error) {
    console.error('❌ Error getting/creating tournament:', error);
    throw error;
  }
}

/**
 * Enter a tournament with a locked portfolio
 *
 * @param {string} userId - User ID (odUserId)
 * @param {string} username - Display username
 * @param {Array} predictions - Array of prediction objects
 * @returns {Promise<Object>} - Entry data with entryId
 */
export async function enterTournament(userId, username, predictions) {
  if (!userId) {
    throw new Error('userId required');
  }

  if (!predictions || predictions.length === 0) {
    throw new Error('predictions required');
  }

  const tournament = await getCurrentTournament();

  // Check if deadline passed
  if (new Date() > new Date(tournament.lockDeadline)) {
    throw new Error('Tournament lock deadline has passed');
  }

  const entryId = `${userId}_${tournament.id}`;
  const entryRef = doc(db, 'earningsEntries', entryId);

  // Check if already entered
  const existing = await getDoc(entryRef);
  if (existing.exists()) {
    throw new Error('Already entered this tournament');
  }

  const totalSpent = predictions.reduce((sum, p) => sum + (p.price || 0), 0);
  const totalPotentialPoints = predictions.reduce((sum, p) => sum + (p.potentialPayout || 0), 0);

  const entry = {
    odUserId: userId,
    tournamentId: tournament.id,
    username: username || userId,
    predictions: removeUndefined(predictions),
    totalSpent,
    totalPotentialPoints,
    predictionCount: predictions.length,
    lockedAt: serverTimestamp(),

    // Results - to be filled in as earnings report
    results: {
      totalPoints: 0,
      correctPredictions: 0,
      incorrectPredictions: 0,
      pendingPredictions: predictions.length
    },
    rank: null,
    bracket: null
  };

  try {
    await setDoc(entryRef, removeUndefined(entry));

    // Increment entry count on tournament
    const tournamentRef = doc(db, 'earningsTournaments', tournament.id);
    await updateDoc(tournamentRef, {
      entryCount: increment(1)
    });

    console.log('✅ Tournament entry created:', entryId);
    return { entryId, tournamentId: tournament.id, ...entry };
  } catch (error) {
    console.error('❌ Error entering tournament:', error);
    throw error;
  }
}

/**
 * Get user's entry for current tournament
 *
 * @param {string} userId - User ID (odUserId)
 * @returns {Promise<Object|null>} - Entry data or null
 */
export async function getUserTournamentEntry(userId) {
  if (!userId) return null;

  try {
    const tournament = await getCurrentTournament();
    const entryId = `${userId}_${tournament.id}`;
    const entryRef = doc(db, 'earningsEntries', entryId);

    const snapshot = await getDoc(entryRef);
    if (snapshot.exists()) {
      console.log('✅ Found tournament entry for user:', userId);
      return { entryId, ...snapshot.data() };
    }

    console.log('📭 No tournament entry found for user:', userId);
    return null;
  } catch (error) {
    console.error('❌ Error getting user tournament entry:', error);
    throw error;
  }
}

/**
 * Get tournament leaderboard
 *
 * @param {string} tournamentId - Tournament ID
 * @param {number} maxResults - Maximum results to return (default 50)
 * @returns {Promise<Array>} - Array of entries with rank
 */
export async function getTournamentLeaderboard(tournamentId, maxResults = 50) {
  console.log('[Firebase] Getting leaderboard for tournament:', tournamentId);

  if (!tournamentId) {
    const tournament = await getCurrentTournament();
    tournamentId = tournament.id;
    console.log('[Firebase] Using current tournament:', tournamentId);
  }

  try {
    const entriesRef = collection(db, 'earningsEntries');
    const q = query(
      entriesRef,
      where('tournamentId', '==', tournamentId),
      orderBy('results.totalPoints', 'desc'),
      limit(maxResults)
    );

    const snapshot = await getDocs(q);
    console.log('[Firebase] Leaderboard query returned:', snapshot.size, 'entries');

    const entries = [];
    let rank = 1;

    snapshot.forEach(docSnapshot => {
      const data = docSnapshot.data();
      console.log('[Firebase] Entry:', docSnapshot.id, data.username, data.results?.totalPoints);
      entries.push({
        entryId: docSnapshot.id,
        odUserId: docSnapshot.id,
        rank: rank++,
        ...data
      });
    });

    console.log(`📊 Leaderboard loaded: ${entries.length} entries`);
    return entries;
  } catch (error) {
    console.error('❌ Error getting tournament leaderboard:', error);
    throw error;
  }
}

/**
 * Get user's rank in tournament
 *
 * @param {string} userId - User ID (odUserId)
 * @param {string} tournamentId - Tournament ID (optional, uses current if not provided)
 * @returns {Promise<Object|null>} - Rank info or null
 */
export async function getUserRank(userId, tournamentId = null) {
  if (!userId) return null;

  try {
    if (!tournamentId) {
      const tournament = await getCurrentTournament();
      tournamentId = tournament.id;
    }

    // Get all entries sorted by points
    const leaderboard = await getTournamentLeaderboard(tournamentId, 1000);
    const userEntry = leaderboard.find(e => e.odUserId === userId);

    if (userEntry) {
      return {
        rank: userEntry.rank,
        totalEntries: leaderboard.length,
        bracket: calculateBracket(userEntry.rank, leaderboard.length),
        totalPoints: userEntry.results?.totalPoints || 0
      };
    }

    return null;
  } catch (error) {
    console.error('❌ Error getting user rank:', error);
    throw error;
  }
}

/**
 * Update prediction result after earnings are released
 *
 * @param {string} entryId - Entry document ID (userId_tournamentId)
 * @param {string} eventId - Event/prediction ID
 * @param {number} actualMove - Actual price move percentage
 * @param {boolean} didBeat - Whether the company beat earnings
 * @returns {Promise<Object|null>} - Updated results or null
 */
export async function updatePredictionResult(entryId, eventId, actualMove, didBeat) {
  try {
    const entryRef = doc(db, 'earningsEntries', entryId);
    const snapshot = await getDoc(entryRef);

    if (!snapshot.exists()) {
      console.warn('Entry not found:', entryId);
      return null;
    }

    const entry = snapshot.data();
    const predictions = entry.predictions || [];

    // Find and update the prediction
    const updatedPredictions = predictions.map(p => {
      if (p.eventId === eventId) {
        const isCorrect = verifyTournamentPrediction(p, actualMove, didBeat);
        return {
          ...p,
          resolved: true,
          actualMove,
          didBeat,
          isCorrect,
          pointsEarned: isCorrect ? (p.potentialPayout || 0) : 0
        };
      }
      return p;
    });

    // Recalculate results
    const resolved = updatedPredictions.filter(p => p.resolved);
    const results = {
      totalPoints: resolved.reduce((sum, p) => sum + (p.pointsEarned || 0), 0),
      correctPredictions: resolved.filter(p => p.isCorrect).length,
      incorrectPredictions: resolved.filter(p => p.resolved && !p.isCorrect).length,
      pendingPredictions: updatedPredictions.filter(p => !p.resolved).length
    };

    await updateDoc(entryRef, {
      predictions: updatedPredictions,
      results
    });

    console.log('✅ Prediction result updated:', eventId);
    return results;
  } catch (error) {
    console.error('❌ Error updating prediction result:', error);
    throw error;
  }
}

/**
 * Update ranks and brackets for all entries in a tournament
 * Should be called after results are updated
 *
 * @param {string} tournamentId - Tournament ID
 * @returns {Promise<void>}
 */
export async function updateTournamentRankings(tournamentId) {
  try {
    const leaderboard = await getTournamentLeaderboard(tournamentId, 10000);

    // Update each entry with their rank and bracket
    const updates = leaderboard.map(async (entry, index) => {
      const rank = index + 1;
      const bracket = calculateBracket(rank, leaderboard.length);

      const entryRef = doc(db, 'earningsEntries', entry.entryId);
      await updateDoc(entryRef, { rank, bracket });
    });

    await Promise.all(updates);
    console.log(`✅ Updated rankings for ${leaderboard.length} entries`);
  } catch (error) {
    console.error('❌ Error updating tournament rankings:', error);
    throw error;
  }
}

/**
 * Get tournament by ID
 *
 * @param {string} tournamentId - Tournament ID
 * @returns {Promise<Object|null>} - Tournament data or null
 */
export async function getTournament(tournamentId) {
  if (!tournamentId) return null;

  try {
    const tournamentRef = doc(db, 'earningsTournaments', tournamentId);
    const snapshot = await getDoc(tournamentRef);

    if (snapshot.exists()) {
      return { id: tournamentId, ...snapshot.data() };
    }
    return null;
  } catch (error) {
    console.error('❌ Error getting tournament:', error);
    throw error;
  }
}

/**
 * Update tournament status
 *
 * @param {string} tournamentId - Tournament ID
 * @param {string} status - New status ('open', 'locked', 'in_progress', 'completed')
 * @returns {Promise<boolean>} - Success status
 */
export async function updateTournamentStatus(tournamentId, status) {
  const validStatuses = ['open', 'locked', 'in_progress', 'completed'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  try {
    const tournamentRef = doc(db, 'earningsTournaments', tournamentId);
    await updateDoc(tournamentRef, {
      status,
      updatedAt: serverTimestamp()
    });

    console.log(`✅ Tournament ${tournamentId} status updated to: ${status}`);
    return true;
  } catch (error) {
    console.error('❌ Error updating tournament status:', error);
    throw error;
  }
}

/**
 * Create bot entries for a tournament
 * @param {string} tournamentId - Tournament ID
 * @param {Array} botEntries - Array of bot portfolio objects
 * @returns {Promise<Array>} - Results of bot entry creation
 */
export async function createBotTournamentEntries(tournamentId, botEntries) {
  if (!tournamentId || !botEntries || botEntries.length === 0) {
    console.warn('[Firebase] No bot entries to create');
    return [];
  }

  const results = [];

  for (const bot of botEntries) {
    try {
      const odUserId = `${bot.odUserId}_${tournamentId}`;
      const entryRef = doc(db, 'earningsEntries', odUserId);

      const entry = {
        odUserId: bot.odUserId,
        odUserIdFull: odUserId,
        tournamentId,
        username: bot.username,
        avatar: bot.avatar,
        isBot: true,
        predictions: bot.predictions,
        totalSpent: bot.totalSpent,
        totalPotentialPoints: bot.totalPotentialPoints,
        predictionCount: bot.predictionCount,
        lockedAt: serverTimestamp(),
        results: {
          totalPoints: 0,
          correctPredictions: 0,
          incorrectPredictions: 0,
          pendingPredictions: bot.predictionCount
        },
        rank: null,
        bracket: null
      };

      await setDoc(entryRef, removeUndefined(entry));
      results.push({ odUserId, username: bot.username, success: true });

    } catch (error) {
      console.error(`[Firebase] Error creating bot entry ${bot.username}:`, error);
      results.push({ username: bot.username, success: false, error: error.message });
    }
  }

  // Update tournament entry count
  try {
    const tournamentRef = doc(db, 'earningsTournaments', tournamentId);
    await updateDoc(tournamentRef, {
      entryCount: increment(results.filter(r => r.success).length)
    });
  } catch (e) {
    console.error('[Firebase] Error updating entry count:', e);
  }

  console.log(`[Firebase] Created ${results.filter(r => r.success).length}/${botEntries.length} bot entries`);
  return results;
}

/**
 * Remove all bot entries from a tournament (for cleanup)
 * @param {string} tournamentId - Tournament ID
 * @returns {Promise<number>} - Number of entries deleted
 */
export async function clearBotEntries(tournamentId) {
  const entriesRef = collection(db, 'earningsEntries');
  const q = query(entriesRef, where('tournamentId', '==', tournamentId), where('isBot', '==', true));

  const snapshot = await getDocs(q);
  let deleted = 0;

  for (const docSnap of snapshot.docs) {
    await deleteDoc(docSnap.ref);
    deleted++;
  }

  console.log(`[Firebase] Deleted ${deleted} bot entries from ${tournamentId}`);
  return deleted;
}

/**
 * Get all active tournaments (open, locked, or in_progress)
 * Used for admin functions like recreating bots across all tournaments
 * @returns {Promise<Array>} - Array of tournament objects with id
 */
export async function getActiveTournaments() {
  try {
    const tournamentsRef = collection(db, 'earningsTournaments');
    const q = query(
      tournamentsRef,
      where('status', 'in', ['open', 'locked', 'in_progress'])
    );

    const snapshot = await getDocs(q);
    const tournaments = [];

    snapshot.forEach(docSnap => {
      tournaments.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    console.log(`[Firebase] Found ${tournaments.length} active tournaments`);
    return tournaments;
  } catch (error) {
    console.error('[Firebase] Error getting active tournaments:', error);
    return [];
  }
}

// =====================================================
// MULTI-ENTRY TOURNAMENT SYSTEM
// =====================================================

export const MAX_ENTRIES_PER_USER = 3;

/**
 * Get medal for top ranks
 * @param {number} rank - User's rank
 * @returns {string|null} - Medal type or null
 */
function getMedal(rank) {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  if (rank <= 10) return 'top10';
  return null;
}

/**
 * Get all entries for a user in a tournament
 * @param {string} tournamentId - Tournament ID
 * @param {string} userId - User's odUserId
 * @returns {Promise<Array>} - Array of entry objects
 */
export async function getUserEntriesForTournament(tournamentId, userId) {
  if (!tournamentId || !userId) return [];

  try {
    const entriesRef = collection(db, 'earningsEntries');
    const q = query(
      entriesRef,
      where('tournamentId', '==', tournamentId),
      where('odUserId', '==', userId),
      orderBy('entryNumber', 'asc')
    );

    const snapshot = await getDocs(q);
    const entries = [];

    snapshot.forEach(docSnap => {
      entries.push({
        entryId: docSnap.id,
        ...docSnap.data()
      });
    });

    console.log(`[Firebase] Found ${entries.length} entries for user ${userId} in ${tournamentId}`);
    return entries;
  } catch (error) {
    console.error('[Firebase] Error getting user entries:', error);
    return [];
  }
}

/**
 * Create a new tournament entry (supports multiple entries per user)
 *
 * @param {string} userId - User ID (odUserId)
 * @param {string} username - Display username
 * @param {Array} predictions - Array of prediction objects
 * @param {number} entryNumber - Entry number (1, 2, or 3)
 * @returns {Promise<Object>} - Entry data with entryId
 */
export async function createTournamentEntry(userId, username, predictions, entryNumber = null) {
  if (!userId) {
    throw new Error('userId required');
  }

  if (!predictions || predictions.length === 0) {
    throw new Error('predictions required');
  }

  const tournament = await getCurrentTournament();

  // Check if deadline passed
  if (new Date() > new Date(tournament.lockDeadline)) {
    throw new Error('Tournament lock deadline has passed');
  }

  // Get existing entries for this user
  const existingEntries = await getUserEntriesForTournament(tournament.id, userId);

  // If no entryNumber specified, use next available
  if (entryNumber === null) {
    if (existingEntries.length >= MAX_ENTRIES_PER_USER) {
      throw new Error(`Maximum ${MAX_ENTRIES_PER_USER} entries allowed per tournament`);
    }
    entryNumber = existingEntries.length + 1;
  }

  // Validate entry number
  if (entryNumber < 1 || entryNumber > MAX_ENTRIES_PER_USER) {
    throw new Error(`Entry number must be between 1 and ${MAX_ENTRIES_PER_USER}`);
  }

  // Check if this entry number already exists
  if (existingEntries.find(e => e.entryNumber === entryNumber)) {
    throw new Error(`Entry ${entryNumber} already exists. Use updateEntry to modify it.`);
  }

  // Create entry ID with entry number
  const entryId = `${userId}_${entryNumber}_${tournament.id}`;
  const entryRef = doc(db, 'earningsEntries', entryId);

  const totalSpent = predictions.reduce((sum, p) => sum + (p.price || 0), 0);
  const totalPotentialPoints = predictions.reduce((sum, p) => sum + (p.potentialPayout || 0), 0);

  const entry = {
    odUserId: userId,
    tournamentId: tournament.id,
    username: username || userId,
    entryNumber,
    predictions: removeUndefined(predictions),
    totalSpent,
    totalPotentialPoints,
    predictionCount: predictions.length,
    status: 'locked', // Entry is locked when created through tournament
    lockedAt: serverTimestamp(),
    createdAt: serverTimestamp(),

    // Results - to be filled in as earnings report
    results: {
      totalPoints: 0,
      correctPredictions: 0,
      incorrectPredictions: 0,
      pendingPredictions: predictions.length
    },
    rank: null,
    bracket: null,
    medal: null
  };

  try {
    await setDoc(entryRef, removeUndefined(entry));

    // Increment entry count on tournament (only for new entries)
    const tournamentRef = doc(db, 'earningsTournaments', tournament.id);
    await updateDoc(tournamentRef, {
      entryCount: increment(1)
    });

    console.log(`[Firebase] Created entry ${entryNumber} for ${userId}:`, entryId);
    return { entryId, tournamentId: tournament.id, entryNumber, ...entry };
  } catch (error) {
    console.error('[Firebase] Error creating tournament entry:', error);
    throw error;
  }
}

/**
 * Update an existing tournament entry's predictions
 * @param {string} entryId - Entry document ID
 * @param {Array} predictions - Updated predictions array
 * @returns {Promise<Object>} - Updated entry data
 */
export async function updateTournamentEntry(entryId, predictions) {
  if (!entryId || !predictions) {
    throw new Error('entryId and predictions required');
  }

  try {
    const entryRef = doc(db, 'earningsEntries', entryId);
    const snapshot = await getDoc(entryRef);

    if (!snapshot.exists()) {
      throw new Error('Entry not found');
    }

    const entry = snapshot.data();

    // Check if tournament deadline passed
    const tournament = await getTournament(entry.tournamentId);
    if (tournament && new Date() > new Date(tournament.lockDeadline)) {
      throw new Error('Tournament lock deadline has passed');
    }

    const totalSpent = predictions.reduce((sum, p) => sum + (p.price || 0), 0);
    const totalPotentialPoints = predictions.reduce((sum, p) => sum + (p.potentialPayout || 0), 0);

    await updateDoc(entryRef, {
      predictions: removeUndefined(predictions),
      totalSpent,
      totalPotentialPoints,
      predictionCount: predictions.length,
      'results.pendingPredictions': predictions.length,
      updatedAt: serverTimestamp()
    });

    console.log(`[Firebase] Updated entry:`, entryId);
    return { entryId, ...entry, predictions, totalSpent, totalPotentialPoints };
  } catch (error) {
    console.error('[Firebase] Error updating entry:', error);
    throw error;
  }
}

/**
 * Delete a tournament entry (only if tournament is still open)
 * @param {string} entryId - Entry document ID
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteTournamentEntry(entryId) {
  if (!entryId) {
    throw new Error('entryId required');
  }

  try {
    const entryRef = doc(db, 'earningsEntries', entryId);
    const snapshot = await getDoc(entryRef);

    if (!snapshot.exists()) {
      throw new Error('Entry not found');
    }

    const entry = snapshot.data();

    // Check if tournament deadline passed
    const tournament = await getTournament(entry.tournamentId);
    if (tournament && new Date() > new Date(tournament.lockDeadline)) {
      throw new Error('Cannot delete entry after tournament deadline');
    }

    await deleteDoc(entryRef);

    // Decrement entry count on tournament
    const tournamentRef = doc(db, 'earningsTournaments', entry.tournamentId);
    await updateDoc(tournamentRef, {
      entryCount: increment(-1)
    });

    console.log(`[Firebase] Deleted entry:`, entryId);
    return true;
  } catch (error) {
    console.error('[Firebase] Error deleting entry:', error);
    throw error;
  }
}

/**
 * Resolve a tournament entry with actual earnings results
 * @param {string} entryId - Entry document ID
 * @param {Array} results - Array of { eventId, actualMove, didBeat, outcome, magnitude }
 * @returns {Promise<Object>} - Updated entry with scores
 */
export async function resolveEntryPredictions(entryId, results) {
  if (!entryId || !results) {
    throw new Error('entryId and results required');
  }

  try {
    const entryRef = doc(db, 'earningsEntries', entryId);
    const snapshot = await getDoc(entryRef);

    if (!snapshot.exists()) {
      throw new Error('Entry not found');
    }

    const entry = snapshot.data();
    const predictions = entry.predictions || [];
    let totalPoints = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let pendingCount = 0;

    // Update each prediction with result
    const updatedPredictions = predictions.map(pred => {
      const result = results.find(r => r.eventId === pred.eventId || r.symbol === pred.symbol);

      if (!result || !result.resolved) {
        pendingCount++;
        return { ...pred, resolved: false };
      }

      // Check if prediction was correct (both outcome AND magnitude must match)
      const outcomeCorrect = pred.outcome === result.outcome;
      const magnitudeCorrect = pred.magnitude === result.magnitude;
      const isWinner = outcomeCorrect && magnitudeCorrect;

      const pointsEarned = isWinner ? (pred.potentialPayout || 0) : 0;
      totalPoints += pointsEarned;

      if (isWinner) {
        correctCount++;
      } else {
        incorrectCount++;
      }

      return {
        ...pred,
        resolved: true,
        actualOutcome: result.outcome,
        actualMagnitude: result.magnitude,
        actualMove: result.priceMove,
        outcomeCorrect,
        magnitudeCorrect,
        isCorrect: isWinner,
        isWinner,
        pointsEarned
      };
    });

    // Update entry
    await updateDoc(entryRef, {
      predictions: removeUndefined(updatedPredictions),
      results: {
        totalPoints,
        correctPredictions: correctCount,
        incorrectPredictions: incorrectCount,
        pendingPredictions: pendingCount
      },
      status: pendingCount === 0 ? 'complete' : 'in_progress',
      resolvedAt: pendingCount === 0 ? serverTimestamp() : null
    });

    console.log(`[Firebase] Resolved entry ${entryId}: ${correctCount} correct, ${incorrectCount} incorrect, ${pendingCount} pending`);
    return {
      entryId,
      totalPoints,
      correctPredictions: correctCount,
      incorrectPredictions: incorrectCount,
      pendingPredictions: pendingCount,
      predictions: updatedPredictions
    };
  } catch (error) {
    console.error('[Firebase] Error resolving entry:', error);
    throw error;
  }
}

/**
 * Calculate and update ranks, brackets, and medals for all entries in a tournament
 * @param {string} tournamentId - Tournament ID
 * @returns {Promise<Object>} - Rankings summary
 */
export async function calculateTournamentRankings(tournamentId) {
  if (!tournamentId) {
    throw new Error('tournamentId required');
  }

  try {
    const entriesRef = collection(db, 'earningsEntries');
    const q = query(
      entriesRef,
      where('tournamentId', '==', tournamentId),
      orderBy('results.totalPoints', 'desc')
    );

    const snapshot = await getDocs(q);
    const entries = [];

    snapshot.forEach(docSnap => {
      entries.push({
        entryId: docSnap.id,
        ...docSnap.data()
      });
    });

    const totalEntries = entries.length;
    let rank = 1;

    // Update each entry with rank, bracket, and medal
    for (const entry of entries) {
      const bracket = calculateBracket(rank, totalEntries);
      const medal = getMedal(rank);

      const entryRef = doc(db, 'earningsEntries', entry.entryId);
      await updateDoc(entryRef, {
        rank,
        bracket,
        medal,
        finalPoints: entry.results?.totalPoints || 0
      });

      rank++;
    }

    console.log(`[Firebase] Updated rankings for ${totalEntries} entries in ${tournamentId}`);
    return {
      tournamentId,
      totalEntries,
      topEntries: entries.slice(0, 10).map(e => ({
        entryId: e.entryId,
        username: e.username,
        points: e.results?.totalPoints || 0
      }))
    };
  } catch (error) {
    console.error('[Firebase] Error calculating rankings:', error);
    throw error;
  }
}

/**
 * Get the best entry for a user in a tournament (for display)
 * @param {string} tournamentId - Tournament ID
 * @param {string} userId - User's odUserId
 * @returns {Promise<Object|null>} - Best entry or null
 */
export async function getUserBestEntry(tournamentId, userId) {
  const entries = await getUserEntriesForTournament(tournamentId, userId);

  if (entries.length === 0) return null;

  // Sort by points (highest first)
  entries.sort((a, b) => {
    const aPoints = a.results?.totalPoints || 0;
    const bPoints = b.results?.totalPoints || 0;
    return bPoints - aPoints;
  });

  return entries[0];
}

// =====================================================
// OPTIONS TOURNAMENT FUNCTIONS
// =====================================================

export const MAX_OPTIONS_ENTRIES_PER_USER = 3;

// Tournament CRUD

/**
 * Get active options tournament (open or in_progress)
 * @returns {Promise<Object|null>} - Tournament object or null
 */
export async function getActiveOptionsTournament() {
  const q = query(
    collection(db, 'optionsTournaments'),
    where('status', 'in', ['open', 'in_progress']),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

/**
 * Get options tournament by ID
 * @param {string} tournamentId - Tournament ID
 * @returns {Promise<Object|null>} - Tournament object or null
 */
export async function getOptionsTournamentById(tournamentId) {
  const docRef = doc(db, 'optionsTournaments', tournamentId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

/**
 * Create a new options tournament
 * @param {Object} tournamentData - Tournament data with id
 * @returns {Promise<Object>} - Created tournament data
 */
export async function createOptionsTournament(tournamentData) {
  const docRef = doc(db, 'optionsTournaments', tournamentData.id);
  await setDoc(docRef, {
    ...tournamentData,
    createdAt: serverTimestamp()
  });
  return tournamentData;
}

/**
 * Update options tournament status
 * @param {string} tournamentId - Tournament ID
 * @param {string} status - New status
 */
export async function updateOptionsTournamentStatus(tournamentId, status) {
  const docRef = doc(db, 'optionsTournaments', tournamentId);
  await updateDoc(docRef, { status, updatedAt: serverTimestamp() });
}

// Entry CRUD

/**
 * Create a new options tournament entry
 * @param {string} tournamentId - Tournament ID
 * @param {string} userId - User's odUserId
 * @param {string} username - Display name
 * @param {Array} contracts - Array of contract objects
 * @param {number} totalEntry - Total amount invested
 * @returns {Promise<Object>} - Created entry with id
 */
export async function createOptionsEntry(tournamentId, userId, username, contracts, totalEntry) {
  // Check entry count
  const existingEntries = await getUserOptionsEntries(tournamentId, userId);
  if (existingEntries.length >= MAX_OPTIONS_ENTRIES_PER_USER) {
    throw new Error(`Maximum ${MAX_OPTIONS_ENTRIES_PER_USER} entries allowed per tournament`);
  }

  const entryNumber = existingEntries.length + 1;
  const entryId = `${userId}_${entryNumber}_${tournamentId}`;

  const entry = {
    odUserId: userId,
    tournamentId,
    username,
    entryNumber,
    contracts: contracts.map(c => ({
      ...c,
      lockedValue: null,  // null = not locked yet
      lockedAt: null,
      settled: false,
      finalValue: null
    })),
    totalEntry,
    virtualCash: 10000 - totalEntry,
    status: 'locked',
    isBot: false,
    results: {
      totalValue: null,
      percentReturn: null,
      settledCount: 0,
      lockedCount: 0
    },
    rank: null,
    createdAt: serverTimestamp()
  };

  const docRef = doc(db, 'optionsEntries', entryId);
  await setDoc(docRef, entry);

  // Increment tournament entry count
  const tournamentRef = doc(db, 'optionsTournaments', tournamentId);
  await updateDoc(tournamentRef, { entryCount: increment(1) });

  return { id: entryId, ...entry };
}

/**
 * Get all entries for a user in an options tournament
 * @param {string} tournamentId - Tournament ID
 * @param {string} userId - User's odUserId
 * @returns {Promise<Array>} - Array of entry objects
 */
export async function getUserOptionsEntries(tournamentId, userId) {
  const q = query(
    collection(db, 'optionsEntries'),
    where('tournamentId', '==', tournamentId),
    where('odUserId', '==', userId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get all entries for an options tournament
 * @param {string} tournamentId - Tournament ID
 * @returns {Promise<Array>} - Array of entry objects
 */
export async function getOptionsEntriesForTournament(tournamentId) {
  const q = query(
    collection(db, 'optionsEntries'),
    where('tournamentId', '==', tournamentId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Lock an individual position mid-tournament
 * @param {string} entryId - Entry ID
 * @param {string} contractId - Contract ID to lock
 * @param {number} lockedValue - Value to lock at
 * @returns {Promise<Object>} - Lock result
 */
export async function lockOptionsPosition(entryId, contractId, lockedValue) {
  const entryRef = doc(db, 'optionsEntries', entryId);
  const entrySnap = await getDoc(entryRef);

  if (!entrySnap.exists()) throw new Error('Entry not found');

  const entry = entrySnap.data();
  const updatedContracts = entry.contracts.map(c => {
    if (c.id === contractId) {
      return {
        ...c,
        lockedValue,
        lockedAt: new Date().toISOString()
      };
    }
    return c;
  });

  const lockedCount = updatedContracts.filter(c => c.lockedValue !== null).length;

  await updateDoc(entryRef, {
    contracts: updatedContracts,
    'results.lockedCount': lockedCount,
    updatedAt: serverTimestamp()
  });

  return { contractId, lockedValue };
}

/**
 * Settle an expired contract (binary payout)
 * @param {string} entryId - Entry ID
 * @param {string} contractId - Contract ID to settle
 * @param {number} settlementPrice - Settlement price
 * @param {number} finalValue - Final payout value
 */
export async function settleOptionsContract(entryId, contractId, settlementPrice, finalValue) {
  const entryRef = doc(db, 'optionsEntries', entryId);
  const entrySnap = await getDoc(entryRef);

  if (!entrySnap.exists()) throw new Error('Entry not found');

  const entry = entrySnap.data();
  const updatedContracts = entry.contracts.map(c => {
    if (c.id === contractId) {
      return {
        ...c,
        settled: true,
        settlementPrice,
        finalValue
      };
    }
    return c;
  });

  const settledCount = updatedContracts.filter(c => c.settled).length;

  await updateDoc(entryRef, {
    contracts: updatedContracts,
    'results.settledCount': settledCount,
    updatedAt: serverTimestamp()
  });
}

/**
 * Final tournament resolution for an entry
 * @param {string} entryId - Entry ID
 * @param {number} totalValue - Final portfolio value
 * @param {number} percentReturn - Percentage return
 */
export async function resolveOptionsEntry(entryId, totalValue, percentReturn) {
  const entryRef = doc(db, 'optionsEntries', entryId);
  await updateDoc(entryRef, {
    'results.totalValue': totalValue,
    'results.percentReturn': percentReturn,
    status: 'complete',
    updatedAt: serverTimestamp()
  });
}

/**
 * Calculate and update rankings for options tournament
 * @param {string} tournamentId - Tournament ID
 * @returns {Promise<number>} - Number of entries ranked
 */
export async function calculateOptionsRankings(tournamentId) {
  const entries = await getOptionsEntriesForTournament(tournamentId);

  // Sort by total value descending
  const sorted = entries
    .filter(e => e.results?.totalValue !== null)
    .sort((a, b) => b.results.totalValue - a.results.totalValue);

  // Update ranks using batch
  const batch = writeBatch(db);
  sorted.forEach((entry, index) => {
    const entryRef = doc(db, 'optionsEntries', entry.id);
    batch.update(entryRef, { rank: index + 1 });
  });

  await batch.commit();
  return sorted.length;
}

/**
 * Remove all bot entries from an options tournament
 * @param {string} tournamentId - Tournament ID
 * @returns {Promise<number>} - Number of entries deleted
 */
export async function clearOptionsBotEntries(tournamentId) {
  const q = query(
    collection(db, 'optionsEntries'),
    where('tournamentId', '==', tournamentId),
    where('isBot', '==', true)
  );
  const snapshot = await getDocs(q);

  const batch = writeBatch(db);
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  return snapshot.size;
}

// =====================================================
// BAGGERBOMB V3 LOBBY SYSTEM
// =====================================================

/**
 * Get all open Snake Draft lobbies (drafts waiting for players)
 * Returns drafts with status === 'waiting' and isTraining === false
 *
 * @param {number} maxResults - Maximum number of drafts to return
 * @returns {Promise<Array>} - Array of open drafts
 */
export async function getOpenSnakeDraftLobbies(maxResults = 20) {
  try {
    const q = query(
      collection(db, 'drafts'),
      where('status', '==', 'waiting'),
      where('isTraining', '==', false),
      orderBy('createdAt', 'desc'),
      limit(maxResults)
    );

    const snapshot = await getDocs(q);
    const drafts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Add markers for LiveFeed handling
      isSnakeDraft: true,
      battleType: 'snake-draft',
    }));

    console.log(`✅ Found ${drafts.length} open Snake Draft lobbies`);
    return drafts;
  } catch (error) {
    console.error('❌ Error fetching open Snake Draft lobbies:', error);
    return [];
  }
}

/**
 * Subscribe to open Snake Draft lobbies (real-time updates)
 *
 * @param {Function} callback - Callback function (drafts) => void
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToSnakeDraftLobby(callback) {
  try {
    const q = query(
      collection(db, 'drafts'),
      where('status', '==', 'waiting'),
      where('isTraining', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const drafts = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          isSnakeDraft: true,
          battleType: 'snake-draft',
        }))
        .sort((a, b) => {
          const aTime = a?.createdAt?.toDate?.() || new Date(a?.createdAt || 0);
          const bTime = b?.createdAt?.toDate?.() || new Date(b?.createdAt || 0);
          return bTime - aTime;
        });

      console.log(`📥 Snake Draft lobby update: ${drafts.length} open lobbies`);
      callback(drafts);
    }, (error) => {
      console.error('❌ Snake Draft lobby subscription error:', error);
      callback([]);
    });

    console.log('✅ Subscribed to Snake Draft lobby');
    return unsubscribe;
  } catch (error) {
    console.error('❌ Error setting up Snake Draft lobby subscription:', error);
    return () => {};
  }
}

/**
 * Subscribe to ALL open game lobbies (BaggerBomb + Snake Draft)
 * For unified display in LiveFeed
 *
 * @param {Function} callback - Callback function (lobbies) => void
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToAllLobbies(callback) {
  let baggerBombLobbies = [];
  let snakeDraftLobbies = [];

  const updateCombined = () => {
    const combined = [...baggerBombLobbies, ...snakeDraftLobbies];
    // Sort by creation time, most recent first
    combined.sort((a, b) => {
      const aTime = a?.timing?.createdAt || a?.createdAt?.toDate?.() || new Date(a?.createdAt || 0);
      const bTime = b?.timing?.createdAt || b?.createdAt?.toDate?.() || new Date(b?.createdAt || 0);
      return new Date(bTime) - new Date(aTime);
    });
    callback(combined);
  };

  // Subscribe to BaggerBomb V3 lobbies
  const unsubBaggerBomb = subscribeToLobby((battles) => {
    baggerBombLobbies = battles;
    updateCombined();
  });

  // Subscribe to Snake Draft lobbies
  const unsubSnakeDraft = subscribeToSnakeDraftLobby((drafts) => {
    snakeDraftLobbies = drafts;
    updateCombined();
  });

  return () => {
    unsubBaggerBomb();
    unsubSnakeDraft();
  };
}

/**
 * Validate a BaggerBomb battle is valid for the lobby
 * @param {Object} battle - Battle data
 * @returns {boolean} - True if valid
 */
function isValidLobbyBattle(battle) {
  // Must have creator with UID
  if (!battle.creator?.uid && !battle.creator?.odUserId) {
    return false;
  }

  // Must have valid portfolio (at least star tier)
  const portfolio = battle.creator?.portfolio;
  if (!portfolio?.star || portfolio.star.length === 0) {
    return false;
  }

  // Must be created within last 24 hours
  const createdAt = battle.timing?.createdAt;
  if (createdAt) {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const battleTime = new Date(createdAt).getTime();
    if (battleTime < oneDayAgo) {
      return false;
    }
  }

  return true;
}

/**
 * Get all open BaggerBomb V3 battles (for lobby)
 * Returns battles with state.status === 'waiting' and visibility === 'public'
 * Filters out stale battles (>24 hours) and invalid data
 *
 * @param {number} maxResults - Maximum number of battles to return
 * @returns {Promise<Array>} - Array of open battles
 */
export async function getOpenBaggerBombBattles(maxResults = 20) {
  try {
    const q = query(
      collection(db, 'battles'),
      where('_v', 'in', [3, 4]),
      where('state.status', '==', 'waiting'),
      where('visibility', '==', 'public'),
      where('archived', '==', false),
      orderBy('timing.createdAt', 'desc'),
      limit(maxResults * 2) // Fetch extra to account for filtering
    );

    const snapshot = await getDocs(q);
    const battles = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(isValidLobbyBattle)
      .slice(0, maxResults);

    console.log(`✅ Found ${battles.length} open BaggerBomb battles`);
    return battles;
  } catch (error) {
    console.error('❌ Error fetching open battles:', error);
    // Return empty array on error (likely missing index)
    return [];
  }
}

/**
 * Subscribe to open BaggerBomb V3/V4 battles (real-time lobby updates)
 * Filters out stale battles (>24 hours) and invalid data
 *
 * @param {Function} callback - Callback function (battles) => void
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToLobby(callback) {
  try {
    const q = query(
      collection(db, 'battles'),
      where('_v', 'in', [3, 4]),
      where('state.status', '==', 'waiting'),
      where('visibility', '==', 'public'),
      where('archived', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const battles = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(isValidLobbyBattle) // Filter out stale/invalid battles
        .sort((a, b) => {
          const aTime = a?.timing?.createdAt || 0;
          const bTime = b?.timing?.createdAt || 0;
          return new Date(bTime) - new Date(aTime);
        });

      console.log(`📥 Lobby update: ${battles.length} open battles`);
      callback(battles);
    }, (error) => {
      console.error('❌ Lobby subscription error:', error);
      callback([]);
    });

    console.log('✅ Subscribed to BaggerBomb lobby');
    return unsubscribe;
  } catch (error) {
    console.error('❌ Error setting up lobby subscription:', error);
    return () => {};
  }
}


// =====================================================
// PATTERN TRACKING (Technical Analysis)
// =====================================================

/**
 * Save a tracked pattern to Firebase
 * @param {string} userId - User ID
 * @param {Object} patternData - Pattern data from AI analysis + user selections
 * @returns {Promise<string>} Document ID of saved pattern
 */
export async function saveTrackedPattern(userId, patternData) {
  try {
    const patternsRef = collection(db, 'trackedPatterns');

    const pattern = removeUndefined({
      userId,

      // Pattern identification
      ticker: patternData.ticker,
      patternType: patternData.patternType || 'CONFLUENCE_ZONE',
      patternName: patternData.patternName || `${patternData.zoneType} Zone`,

      // Zone details
      zoneType: patternData.zoneType, // SUPPORT or RESISTANCE
      priceLow: patternData.priceLow,
      priceHigh: patternData.priceHigh,

      // AI-detected indicators that form the confluence
      indicators: patternData.indicators || [],
      confluenceStrength: patternData.strength || 'MODERATE',

      // Trendline data (if applicable)
      trendlineData: patternData.trendlineData || null,
      chartPattern: patternData.chartPattern || null, // TRIANGLE, WEDGE, etc.
      patternReliability: patternData.patternReliability || null, // Bulkowski %

      // AI analysis metadata
      aiGenerated: patternData.aiGenerated || false,
      analysisMode: patternData.analysisMode || 'quick', // quick or deep
      aiDescription: patternData.description || null,
      aiHistoricalContext: patternData.historicalContext || null,

      // User's thesis
      thesis: patternData.thesis, // BULLISH_BOUNCE, BEARISH_BREAKDOWN, etc.
      thesisDescription: patternData.thesisDescription || null,
      userNotes: patternData.userNotes || '',

      // Tracking parameters
      trackingDuration: patternData.trackingDuration || 7, // days
      priceAtCreation: patternData.priceAtCreation,

      // Status tracking
      status: 'WAITING', // WAITING, TESTING, RESOLVED, EXPIRED, CANCELLED
      outcome: null, // CONFIRMED, FAILED, PARTIAL, INCONCLUSIVE

      // Timestamps
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + (patternData.trackingDuration || 7) * 24 * 60 * 60 * 1000).toISOString(),
      resolvedAt: null,

      // Price history (updated periodically)
      priceHistory: [{
        date: new Date().toISOString(),
        price: patternData.priceAtCreation,
        inZone: patternData.priceAtCreation >= patternData.priceLow &&
                patternData.priceAtCreation <= patternData.priceHigh
      }],

      // Result data (filled when resolved)
      result: null,
    });

    const docRef = await addDoc(patternsRef, pattern);
    console.log('✅ Pattern saved with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error saving pattern:', error);
    throw error;
  }
}

/**
 * Get all tracked patterns for a user
 * @param {string} userId - User ID
 * @param {string} statusFilter - Optional: 'active', 'completed', 'all'
 * @returns {Promise<Array>} Array of patterns
 */
export async function getUserTrackedPatterns(userId, statusFilter = 'all') {
  try {
    const patternsRef = collection(db, 'trackedPatterns');
    let q;

    if (statusFilter === 'active') {
      q = query(
        patternsRef,
        where('userId', '==', userId),
        where('status', 'in', ['WAITING', 'TESTING']),
        orderBy('createdAt', 'desc')
      );
    } else if (statusFilter === 'completed') {
      q = query(
        patternsRef,
        where('userId', '==', userId),
        where('status', 'in', ['RESOLVED', 'EXPIRED']),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        patternsRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
  } catch (error) {
    const msg = error?.message || '';
    if (error?.code === 'failed-precondition' || msg.includes('requires an index') || msg.includes('FAILED_PRECONDITION')) {
      console.warn(
        '[Firebase] Composite index needed for trackedPatterns query. ' +
        'Returning empty results. Create the index via Firebase console link:', msg
      );
      return [];
    }
    console.error('❌ Error fetching patterns:', error);
    throw error;
  }
}

/**
 * Update pattern status
 * @param {string} patternId - Pattern document ID
 * @param {Object} updates - Fields to update
 */
export async function updatePatternStatus(patternId, updates) {
  try {
    const patternRef = doc(db, 'trackedPatterns', patternId);
    await updateDoc(patternRef, removeUndefined({
      ...updates,
      updatedAt: new Date().toISOString()
    }));
    console.log('✅ Pattern updated:', patternId);
  } catch (error) {
    console.error('❌ Error updating pattern:', error);
    throw error;
  }
}

/**
 * Cancel a tracked pattern
 * @param {string} patternId - Pattern document ID
 */
export async function cancelTrackedPattern(patternId) {
  try {
    await updatePatternStatus(patternId, {
      status: 'CANCELLED',
      resolvedAt: new Date().toISOString()
    });
    console.log('✅ Pattern cancelled:', patternId);
  } catch (error) {
    console.error('❌ Error cancelling pattern:', error);
    throw error;
  }
}

/**
 * Calculate user's pattern tracking statistics
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Stats object
 */
export async function getUserPatternStats(userId) {
  try {
    const patterns = await getUserTrackedPatterns(userId, 'all');

    const resolved = patterns.filter(p => p.status === 'RESOLVED');
    const confirmed = resolved.filter(p => p.outcome === 'CONFIRMED');
    const failed = resolved.filter(p => p.outcome === 'FAILED');

    // Stats by pattern type
    const statsByType = {};
    resolved.forEach(p => {
      const type = p.patternType || 'UNKNOWN';
      if (!statsByType[type]) {
        statsByType[type] = { tracked: 0, confirmed: 0, failed: 0 };
      }
      statsByType[type].tracked++;
      if (p.outcome === 'CONFIRMED') statsByType[type].confirmed++;
      if (p.outcome === 'FAILED') statsByType[type].failed++;
    });

    // Calculate rates
    Object.keys(statsByType).forEach(type => {
      const s = statsByType[type];
      s.confirmationRate = s.tracked > 0
        ? Math.round((s.confirmed / s.tracked) * 100)
        : 0;
    });

    // Stats by confluence strength
    const statsByStrength = {};
    resolved.forEach(p => {
      const strength = p.confluenceStrength || 'UNKNOWN';
      if (!statsByStrength[strength]) {
        statsByStrength[strength] = { tracked: 0, confirmed: 0, failed: 0 };
      }
      statsByStrength[strength].tracked++;
      if (p.outcome === 'CONFIRMED') statsByStrength[strength].confirmed++;
      if (p.outcome === 'FAILED') statsByStrength[strength].failed++;
    });

    Object.keys(statsByStrength).forEach(strength => {
      const s = statsByStrength[strength];
      s.rate = s.tracked > 0 ? Math.round((s.confirmed / s.tracked) * 100) : 0;
    });

    // Stats by chart pattern (trendline patterns)
    const statsByChartPattern = {};
    resolved.filter(p => p.chartPattern).forEach(p => {
      const pattern = p.chartPattern;
      if (!statsByChartPattern[pattern]) {
        statsByChartPattern[pattern] = { tracked: 0, confirmed: 0, failed: 0 };
      }
      statsByChartPattern[pattern].tracked++;
      if (p.outcome === 'CONFIRMED') statsByChartPattern[pattern].confirmed++;
      if (p.outcome === 'FAILED') statsByChartPattern[pattern].failed++;
    });

    Object.keys(statsByChartPattern).forEach(pattern => {
      const s = statsByChartPattern[pattern];
      s.rate = s.tracked > 0 ? Math.round((s.confirmed / s.tracked) * 100) : 0;
    });

    // Last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recent = resolved.filter(p => new Date(p.createdAt) > thirtyDaysAgo);
    const recentConfirmed = recent.filter(p => p.outcome === 'CONFIRMED');

    // Find best pattern type
    let bestPatternType = null;
    let bestRate = 0;
    Object.entries(statsByType).forEach(([type, stats]) => {
      if (stats.tracked >= 3 && stats.confirmationRate > bestRate) {
        bestRate = stats.confirmationRate;
        bestPatternType = type;
      }
    });

    return {
      totalTracked: patterns.length,
      active: patterns.filter(p => ['WAITING', 'TESTING'].includes(p.status)).length,
      resolved: resolved.length,
      confirmed: confirmed.length,
      failed: failed.length,
      confirmationRate: resolved.length > 0
        ? Math.round((confirmed.length / resolved.length) * 100)
        : 0,
      statsByType,
      statsByStrength,
      statsByChartPattern,
      bestPatternType,
      bestConfirmationRate: bestRate,
      last30Days: {
        tracked: recent.length,
        confirmed: recentConfirmed.length,
        failed: recent.filter(p => p.outcome === 'FAILED').length,
        rate: recent.length > 0
          ? Math.round((recentConfirmed.length / recent.length) * 100)
          : 0
      }
    };
  } catch (error) {
    console.error('❌ Error calculating stats:', error);
    return {
      totalTracked: 0,
      active: 0,
      resolved: 0,
      confirmed: 0,
      failed: 0,
      confirmationRate: 0,
      statsByType: {},
      statsByStrength: {},
      statsByChartPattern: {},
      bestPatternType: null,
      bestConfirmationRate: 0,
      last30Days: { tracked: 0, confirmed: 0, failed: 0, rate: 0 }
    };
  }
}

/**
 * Check and update pattern status based on current price
 * @param {Object} pattern - Pattern object
 * @param {number} currentPrice - Current stock price
 * @returns {Promise<Object|null>} Updated pattern (or null if no update needed)
 */
export async function checkPatternResolution(pattern, currentPrice) {
  if (!['WAITING', 'TESTING'].includes(pattern.status)) {
    return null; // Already resolved
  }

  const inZone = currentPrice >= pattern.priceLow && currentPrice <= pattern.priceHigh;
  const now = new Date();
  const updates = {};

  // Check if price entered zone
  if (pattern.status === 'WAITING' && inZone) {
    updates.status = 'TESTING';
    updates.testedAt = now.toISOString();
  }

  // Check for resolution
  if (pattern.status === 'TESTING' || inZone) {
    const zoneSize = pattern.priceHigh - pattern.priceLow;
    const zoneMid = (pattern.priceLow + pattern.priceHigh) / 2;
    const moveThreshold = zoneMid * 0.02; // 2% move

    let resolved = false;
    let outcome = null;

    switch (pattern.thesis) {
      case 'BULLISH_BOUNCE':
        if (currentPrice > pattern.priceHigh + moveThreshold) {
          resolved = true;
          outcome = 'CONFIRMED';
        } else if (currentPrice < pattern.priceLow - zoneSize) {
          resolved = true;
          outcome = 'FAILED';
        }
        break;

      case 'BEARISH_BREAKDOWN':
        if (currentPrice < pattern.priceLow - moveThreshold) {
          resolved = true;
          outcome = 'CONFIRMED';
        } else if (currentPrice > pattern.priceHigh + zoneSize) {
          resolved = true;
          outcome = 'FAILED';
        }
        break;

      case 'BEARISH_BOUNCE':
        if (currentPrice < pattern.priceLow - moveThreshold) {
          resolved = true;
          outcome = 'CONFIRMED';
        } else if (currentPrice > pattern.priceHigh + zoneSize) {
          resolved = true;
          outcome = 'FAILED';
        }
        break;

      case 'BULLISH_BREAKOUT':
        if (currentPrice > pattern.priceHigh + moveThreshold) {
          resolved = true;
          outcome = 'CONFIRMED';
        } else if (currentPrice < pattern.priceLow - zoneSize) {
          resolved = true;
          outcome = 'FAILED';
        }
        break;

      case 'NEUTRAL_OBSERVATION':
        // No resolution logic - just track
        break;
    }

    if (resolved) {
      updates.status = 'RESOLVED';
      updates.outcome = outcome;
      updates.resolvedAt = now.toISOString();
      updates.result = {
        priceAtResolution: currentPrice,
        moveFromZone: ((currentPrice - zoneMid) / zoneMid * 100).toFixed(2) + '%'
      };
    }
  }

  // Check for expiration
  if (new Date(pattern.expiresAt) < now && pattern.status !== 'RESOLVED') {
    updates.status = 'EXPIRED';
    updates.outcome = 'INCONCLUSIVE';
    updates.resolvedAt = now.toISOString();
  }

  // Apply updates if any
  if (Object.keys(updates).length > 0) {
    await updatePatternStatus(pattern.id, updates);
    return { ...pattern, ...updates };
  }

  return null;
}


// =====================================================
// EXPORTS
// =====================================================

export default {
  // V1 Battles (legacy)
  createBattle,
  joinBattle,
  getBattle,
  getUserBattles,
  updateBattleStatus,
  completeBattle,
  subscribeToBattles,
  archiveBattle,

  // V2 BaggerBomb Scoring Battles
  calculateBattleTiming,
  createBaggerBombBattle,
  joinBaggerBombBattle,
  joinBaggerBombBattleV3,
  updateSessionPrices,
  recordSessionScores,
  updateCurrentSession,
  addBreakoutEvent,
  completeBaggerBombBattle,

  // V3 BaggerBomb (Tier-Based Portfolio)
  createBaggerBombBattleV3,
  addBaggerBombEvent,
  updateAssetHistoryInBattle,

  // V3 Lobby System
  getOpenBaggerBombBattles,
  subscribeToLobby,
  getOpenSnakeDraftLobbies,
  subscribeToSnakeDraftLobby,
  subscribeToAllLobbies,

  // Training Battles
  createTrainingBattle,
  getUserTrainingBattles,

  // Snake Draft Battles
  createSnakeDraftBattle,

  // Challenges
  createChallenge,
  getBattleChallenges,
  updateChallenge,
  subscribeToChallenges,

  // Earnings Game Portfolios
  saveEarningsPortfolio,
  loadEarningsPortfolio,
  deleteEarningsPortfolio,

  // Earnings Tournaments
  getCurrentTournament,
  enterTournament,
  getUserTournamentEntry,
  getTournamentLeaderboard,
  getUserRank,
  updatePredictionResult,
  updateTournamentRankings,
  getTournament,
  updateTournamentStatus,

  // Multi-Entry Tournament System
  MAX_ENTRIES_PER_USER,
  getUserEntriesForTournament,
  createTournamentEntry,
  updateTournamentEntry,
  deleteTournamentEntry,
  resolveEntryPredictions,
  calculateTournamentRankings,
  getUserBestEntry,

  // Tournament Bots
  createBotTournamentEntries,
  clearBotEntries,

  // Options Tournaments
  MAX_OPTIONS_ENTRIES_PER_USER,
  getActiveOptionsTournament,
  getOptionsTournamentById,
  createOptionsTournament,
  updateOptionsTournamentStatus,
  createOptionsEntry,
  getUserOptionsEntries,
  getOptionsEntriesForTournament,
  lockOptionsPosition,
  settleOptionsContract,
  resolveOptionsEntry,
  calculateOptionsRankings,
  clearOptionsBotEntries,

  // Pattern Tracking (Technical Analysis)
  saveTrackedPattern,
  getUserTrackedPatterns,
  updatePatternStatus,
  cancelTrackedPattern,
  getUserPatternStats,
  checkPatternResolution
};
