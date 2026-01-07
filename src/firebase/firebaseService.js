// src/firebase/firebaseService.js
// Firestore database operations for MarketClash battles and challenges

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp
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
  subscribeToChallenges
};
