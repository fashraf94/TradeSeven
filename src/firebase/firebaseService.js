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
  increment
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
  if (obj === null || obj === undefined) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj
      .map(item => removeUndefined(item))
      .filter(item => item !== undefined);
  }
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

    // Sort by creation date (newest first)
    battles.sort((a, b) => {
      return new Date(b.timeline.createdAt) - new Date(a.timeline.createdAt);
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
  // Query battles where user is creator
  const q1 = query(
    collection(db, 'battles'),
    where('creator.uid', '==', userId),
    where('archived', '==', false)
  );

  // Query battles where user is opponent
  const q2 = query(
    collection(db, 'battles'),
    where('opponent.uid', '==', userId),
    where('archived', '==', false)
  );

  const allBattles = new Map();

  // Listen to creator battles
  const unsubscribe1 = onSnapshot(q1, (snapshot) => {
    snapshot.docs.forEach(doc => {
      allBattles.set(doc.id, { id: doc.id, ...doc.data() });
    });

    // Convert map to array and sort by creation date
    const battles = Array.from(allBattles.values()).sort((a, b) => {
      return new Date(b.timeline.createdAt) - new Date(a.timeline.createdAt);
    });

    callback(battles);
  });

  // Listen to opponent battles
  const unsubscribe2 = onSnapshot(q2, (snapshot) => {
    snapshot.docs.forEach(doc => {
      allBattles.set(doc.id, { id: doc.id, ...doc.data() });
    });

    // Convert map to array and sort by creation date
    const battles = Array.from(allBattles.values()).sort((a, b) => {
      return new Date(b.timeline.createdAt) - new Date(a.timeline.createdAt);
    });

    callback(battles);
  });

  console.log('✅ Subscribed to battle updates for user:', userId);

  // Return combined unsubscribe function
  return () => {
    unsubscribe1();
    unsubscribe2();
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

/**
 * Record daily score for a Snake Draft player
 *
 * @param {string} battleId - Snake Draft battle ID
 * @param {string} odUserId - Player's user ID
 * @param {string} dayKey - Day key (e.g., 'monday', '2026-01-07')
 * @param {Object} scoreData - Daily score breakdown
 * @returns {Promise<void>}
 */
export async function recordSnakeDraftDailyScore(battleId, odUserId, dayKey, scoreData) {
  try {
    const battleRef = doc(db, 'snakeDraftBattles', battleId);
    const battle = await getDoc(battleRef);

    if (!battle.exists()) {
      throw new Error('Snake Draft battle not found');
    }

    const battleData = battle.data();
    const playerIndex = battleData.players.findIndex(p => p.odUserId === odUserId);

    if (playerIndex === -1) {
      throw new Error('Player not found in battle');
    }

    // Update player's daily score
    const updatedPlayers = [...battleData.players];
    updatedPlayers[playerIndex].dailyScores[dayKey] = scoreData;
    updatedPlayers[playerIndex].cumulativeScore += scoreData.totalScore || 0;

    // Recalculate rankings
    updatedPlayers.sort((a, b) => b.cumulativeScore - a.cumulativeScore);
    updatedPlayers.forEach((p, i) => { p.currentRank = i + 1; });

    await updateDoc(battleRef, {
      players: updatedPlayers,
      updatedAt: new Date().toISOString()
    });

    console.log(`Snake Draft daily score recorded for ${odUserId} on ${dayKey}`);
  } catch (error) {
    console.error('Error recording Snake Draft daily score:', error);
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
    // Lock deadline is Friday 11:59 PM ET (Saturday 4:59 AM UTC)
    const lockDeadline = new Date(friday);
    lockDeadline.setHours(23, 59, 59, 999);

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
  if (!tournamentId) {
    const tournament = await getCurrentTournament();
    tournamentId = tournament.id;
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
    const entries = [];
    let rank = 1;

    snapshot.forEach(docSnapshot => {
      entries.push({
        entryId: docSnapshot.id,
        rank: rank++,
        ...docSnapshot.data()
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
  updateSessionPrices,
  recordSessionScores,
  updateCurrentSession,
  addBreakoutEvent,
  completeBaggerBombBattle,

  // Training Battles
  createTrainingBattle,
  getUserTrainingBattles,

  // Snake Draft Battles
  createSnakeDraftBattle,
  recordSnakeDraftDailyScore,

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
  updateTournamentStatus
};
