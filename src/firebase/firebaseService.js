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
  limit
} from 'firebase/firestore';
import { db } from './config';

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
// EXPORTS
// =====================================================

export default {
  // Battles
  createBattle,
  joinBattle,
  getBattle,
  getUserBattles,
  updateBattleStatus,
  completeBattle,
  subscribeToBattles,
  archiveBattle,

  // Challenges
  createChallenge,
  getBattleChallenges,
  updateChallenge,
  subscribeToChallenges
};
