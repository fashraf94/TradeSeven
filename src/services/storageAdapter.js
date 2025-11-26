// src/services/storageAdapter.js
// Hybrid storage adapter that routes to Firebase or localStorage based on feature flags

import { isFeatureEnabled } from '../config/featureFlags';

// Firebase services
import * as firebaseAuth from '../firebase/authService';
import * as firebaseService from '../firebase/firebaseService';

// localStorage services
import { loadUser, saveUser, loadBattlesSafe, saveBattlesSafe } from './LocalStorage';
import * as challengeService from './challengeService';

// =====================================================
// AUTHENTICATION ADAPTER
// =====================================================

/**
 * Adaptive Auth Service
 * Routes to Firebase or localStorage based on FIREBASE_AUTH flag
 */
export const authAdapter = {
  /**
   * Sign up a new user
   */
  async signUp(email, password, username) {
    if (isFeatureEnabled('FIREBASE_AUTH')) {
      // Firebase Auth
      const result = await firebaseAuth.signUp(email, password, username);
      return {
        user: {
          uid: result.user.uid,
          username: result.userData.profile.username,
          ...result.userData.stats
        },
        isFirebase: true
      };
    } else {
      // localStorage fallback
      const user = {
        username,
        xp: 0,
        level: 1,
        rank: 'Beginner',
        wins: 0,
        losses: 0
      };
      saveUser(user);
      return { user, isFirebase: false };
    }
  },

  /**
   * Sign in existing user
   */
  async signIn(email, password) {
    if (isFeatureEnabled('FIREBASE_AUTH')) {
      // Firebase Auth
      const result = await firebaseAuth.signIn(email, password);
      return {
        user: {
          uid: result.user.uid,
          username: result.userData.profile.username,
          ...result.userData.stats
        },
        isFirebase: true
      };
    } else {
      // localStorage fallback
      const user = loadUser();
      if (!user) {
        throw new Error('No user found. Please sign up first.');
      }
      return { user, isFirebase: false };
    }
  },

  /**
   * Sign out
   */
  async signOut() {
    if (isFeatureEnabled('FIREBASE_AUTH')) {
      await firebaseAuth.signOut();
    } else {
      localStorage.removeItem('portfolioDuelUser');
    }
  },

  /**
   * Listen to auth state changes
   */
  onAuthChange(callback) {
    if (isFeatureEnabled('FIREBASE_AUTH')) {
      return firebaseAuth.onAuthChange((authData) => {
        if (authData) {
          callback({
            user: {
              uid: authData.user.uid,
              username: authData.userData.profile.username,
              ...authData.userData.stats
            },
            isFirebase: true
          });
        } else {
          callback(null);
        }
      });
    } else {
      // localStorage: no real-time sync, just load once
      const user = loadUser();
      callback(user ? { user, isFirebase: false } : null);
      // Return no-op unsubscribe
      return () => {};
    }
  },

  /**
   * Update user stats
   */
  async updateUserStats(userId, stats) {
    if (isFeatureEnabled('FIREBASE_AUTH')) {
      await firebaseAuth.updateUserStats(userId, stats);
    } else {
      const user = loadUser();
      if (user) {
        const updatedUser = { ...user, ...stats };
        saveUser(updatedUser);
      }
    }
  }
};

// =====================================================
// BATTLE ADAPTER
// =====================================================

/**
 * Adaptive Battle Service
 * Routes to Firebase or localStorage based on FIREBASE_BATTLES flag
 */
export const battleAdapter = {
  /**
   * Create a new battle
   */
  async createBattle(battleData) {
    if (isFeatureEnabled('FIREBASE_BATTLES')) {
      // Firestore
      return await firebaseService.createBattle(battleData);
    } else {
      // localStorage
      const battles = loadBattlesSafe();
      const newBattle = {
        ...battleData,
        id: Date.now().toString()
      };
      battles.push(newBattle);
      saveBattlesSafe(battles);
      return newBattle;
    }
  },

  /**
   * Join a battle by challenge code
   */
  async joinBattle(challengeCode, opponentData) {
    if (isFeatureEnabled('FIREBASE_BATTLES')) {
      // Firestore
      return await firebaseService.joinBattle(challengeCode, opponentData);
    } else {
      // localStorage
      const battles = loadBattlesSafe();
      const battleIndex = battles.findIndex(
        b => b.challengeCode === challengeCode.toUpperCase() && b.status === 'waiting'
      );

      if (battleIndex === -1) {
        throw new Error('Battle not found or already started');
      }

      battles[battleIndex] = {
        ...battles[battleIndex],
        opponent: opponentData.username,
        opponentPortfolio: opponentData.portfolio,
        status: 'active',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      saveBattlesSafe(battles);
      return battles[battleIndex];
    }
  },

  /**
   * Get all battles for a user
   */
  async getUserBattles(userId) {
    if (isFeatureEnabled('FIREBASE_BATTLES')) {
      // Firestore
      return await firebaseService.getUserBattles(userId);
    } else {
      // localStorage
      return loadBattlesSafe();
    }
  },

  /**
   * Update battle
   */
  async updateBattle(battleId, updates) {
    if (isFeatureEnabled('FIREBASE_BATTLES')) {
      // Firestore
      if (updates.status) {
        await firebaseService.updateBattleStatus(battleId, updates.status);
      }
      // Add more specific update methods as needed
    } else {
      // localStorage
      const battles = loadBattlesSafe();
      const battleIndex = battles.findIndex(b => b.id === battleId);
      if (battleIndex !== -1) {
        battles[battleIndex] = { ...battles[battleIndex], ...updates };
        saveBattlesSafe(battles);
      }
    }
  },

  /**
   * Complete a battle
   */
  async completeBattle(battleId, resultData) {
    if (isFeatureEnabled('FIREBASE_BATTLES')) {
      // Firestore
      return await firebaseService.completeBattle(battleId, resultData);
    } else {
      // localStorage
      const battles = loadBattlesSafe();
      const battleIndex = battles.findIndex(b => b.id === battleId);
      if (battleIndex !== -1) {
        battles[battleIndex] = {
          ...battles[battleIndex],
          status: 'completed',
          completedAt: new Date().toISOString(),
          result: resultData.result
        };
        saveBattlesSafe(battles);
      }
    }
  },

  /**
   * Subscribe to real-time battle updates
   */
  subscribeToBattles(userId, callback) {
    if (isFeatureEnabled('REALTIME_SYNC') && isFeatureEnabled('FIREBASE_BATTLES')) {
      // Firestore real-time listeners
      return firebaseService.subscribeToBattles(userId, callback);
    } else {
      // No real-time sync, return no-op unsubscribe
      return () => {};
    }
  },

  /**
   * Archive a battle
   */
  async archiveBattle(battleId) {
    if (isFeatureEnabled('FIREBASE_BATTLES')) {
      // Firestore
      return await firebaseService.archiveBattle(battleId);
    } else {
      // localStorage - remove from array
      const battles = loadBattlesSafe();
      const filtered = battles.filter(b => b.id !== battleId);
      saveBattlesSafe(filtered);
    }
  }
};

// =====================================================
// CHALLENGE ADAPTER
// =====================================================

/**
 * Adaptive Challenge Service
 * Routes to Firebase or localStorage based on FIREBASE_CHALLENGES flag
 */
export const challengeAdapter = {
  /**
   * Create a challenge
   */
  async createChallenge(challengeData) {
    if (isFeatureEnabled('FIREBASE_CHALLENGES')) {
      // Firestore
      return await firebaseService.createChallenge(challengeData);
    } else {
      // localStorage
      challengeService.addChallenge(challengeData);
      return challengeData;
    }
  },

  /**
   * Get challenges for a battle
   */
  async getBattleChallenges(battleId) {
    if (isFeatureEnabled('FIREBASE_CHALLENGES')) {
      // Firestore
      return await firebaseService.getBattleChallenges(battleId);
    } else {
      // localStorage
      return challengeService.getActiveChallenges(battleId);
    }
  },

  /**
   * Update a challenge
   */
  async updateChallenge(challengeId, updates) {
    if (isFeatureEnabled('FIREBASE_CHALLENGES')) {
      // Firestore
      return await firebaseService.updateChallenge(challengeId, updates);
    } else {
      // localStorage
      const challenges = challengeService.loadChallenges();
      const challenge = challenges.find(c => c.id === challengeId);
      if (challenge) {
        const updated = { ...challenge, ...updates };
        challengeService.updateChallenge(updated);
      }
    }
  },

  /**
   * Subscribe to challenge updates
   */
  subscribeToChallenges(battleId, callback) {
    if (isFeatureEnabled('REALTIME_SYNC') && isFeatureEnabled('FIREBASE_CHALLENGES')) {
      // Firestore real-time listeners
      return firebaseService.subscribeToChallenges(battleId, callback);
    } else {
      // No real-time sync
      return () => {};
    }
  }
};

// =====================================================
// EXPORTS
// =====================================================

export default {
  auth: authAdapter,
  battles: battleAdapter,
  challenges: challengeAdapter
};
