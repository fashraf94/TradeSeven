// src/contexts/UserContext.jsx
// Global user state management using React Context
// Backed by Firebase Auth — uses onAuthChange to restore sessions

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  onAuthChange,
  signIn,
  signUp,
  signOut,
  signInWithGoogle,
  resetPassword,
  updateUserStats,
  getUserData,
} from '../firebase/authService';

const UserContext = createContext(null);

/**
 * Maps the Firebase user doc (nested schema) to the flat shape
 * the rest of the app expects (user.odUserId, user.username, etc.)
 */
const mapFirebaseUserToAppUser = (firebaseUserDoc) => {
  if (!firebaseUserDoc) return null;
  return {
    // Identity — the key bridge
    // By setting odUserId to the Firebase UID, all 30+ locations
    // that read user.odUserId will get the correct value
    odUserId: firebaseUserDoc.auth?.uid || firebaseUserDoc.uid,
    uid: firebaseUserDoc.auth?.uid || firebaseUserDoc.uid,
    username: firebaseUserDoc.profile?.username || firebaseUserDoc.profile?.displayName || 'Player',
    displayName: firebaseUserDoc.profile?.displayName || firebaseUserDoc.profile?.username || 'Player',
    email: firebaseUserDoc.auth?.email || null,
    photoURL: firebaseUserDoc.profile?.avatarUrl || null,

    // Stats — flattened for compatibility
    wins: firebaseUserDoc.stats?.wins || 0,
    losses: firebaseUserDoc.stats?.losses || 0,
    xp: firebaseUserDoc.stats?.xp || 0,
    rank: firebaseUserDoc.stats?.rank || 'Beginner',
    level: firebaseUserDoc.stats?.level || 1,
    winStreak: firebaseUserDoc.stats?.winStreak || 0,
    totalBattles: firebaseUserDoc.stats?.totalBattles || 0,

    // Auth metadata
    authProvider: 'firebase',
    joinedAt: firebaseUserDoc.auth?.createdAt || null,
    lastLoginAt: firebaseUserDoc.auth?.lastLoginAt || null,

    // Preserve the raw doc for anything that needs the full structure
    _raw: firebaseUserDoc,
  };
};

/**
 * UserProvider - Wraps the app and provides user state globally
 * Firebase Auth handles session persistence automatically.
 */
export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  // Subscribe to Firebase Auth state changes on mount
  useEffect(() => {
    const unsubscribe = onAuthChange((authResult) => {
      if (authResult && authResult.userData) {
        const mapped = mapFirebaseUserToAppUser(authResult.userData);
        setUser(mapped);
      } else {
        setUser(null);
      }
      setLoading(false);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Login with email and password
   */
  const login = useCallback(async (email, password) => {
    const { userData } = await signIn(email, password);
    const mapped = mapFirebaseUserToAppUser(userData);
    setUser(mapped);
    return mapped;
  }, []);

  /**
   * Register new account with email, password, and username
   */
  const register = useCallback(async (email, password, username) => {
    const { userData } = await signUp(email, password, username);
    const mapped = mapFirebaseUserToAppUser(userData);
    setUser(mapped);
    return mapped;
  }, []);

  /**
   * Sign in with Google
   */
  const loginWithGoogle = useCallback(async () => {
    const { userData } = await signInWithGoogle();
    const mapped = mapFirebaseUserToAppUser(userData);
    setUser(mapped);
    return mapped;
  }, []);

  /**
   * Logout — delegates to Firebase signOut
   */
  const logout = useCallback(async () => {
    try {
      await signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      setUser(null);
    }
  }, []);

  /**
   * Update user — merges updates locally AND persists stat changes to Firestore
   */
  const updateUser = useCallback((updates) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };

      // Persist stat changes to Firestore in background
      const statKeys = ['xp', 'level', 'rank', 'wins', 'losses', 'winStreak', 'totalBattles'];
      const statUpdates = {};
      for (const key of statKeys) {
        if (key in updates) {
          statUpdates[key] = updates[key];
        }
      }
      if (Object.keys(statUpdates).length > 0 && prev.uid) {
        updateUserStats(prev.uid, statUpdates).catch(err => {
          console.error('Failed to persist stats to Firestore:', err);
        });
      }

      return updated;
    });
  }, []);

  /**
   * Get user ID — returns the best available identifier
   */
  const getUserId = useCallback(() => {
    return user?.odUserId || user?.uid || user?.username || null;
  }, [user]);

  /**
   * Forgot password
   */
  const forgotPassword = useCallback(async (email) => {
    await resetPassword(email);
  }, []);

  const value = {
    user,
    loading,
    authLoading,
    login,
    register,
    loginWithGoogle,
    logout,
    updateUser,
    getUserId,
    forgotPassword,
    isLoggedIn: !!user
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

/**
 * useUser - Hook to access user context
 * @throws Error if used outside UserProvider
 */
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export default UserContext;
