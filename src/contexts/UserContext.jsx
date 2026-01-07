// src/contexts/UserContext.jsx
// Global user state management using React Context
// Uses authService abstraction for easy OAuth migration

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getCurrentUser,
  login as authLogin,
  logout as authLogout,
  updateUserProfile,
  onAuthStateChange,
} from '../services/auth';

const UserContext = createContext(null);

/**
 * UserProvider - Wraps the app and provides user state globally
 *
 * OAuth Migration: When switching to OAuth, the authService handles
 * the provider-specific logic while this context manages React state.
 */
export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from auth service on mount
  useEffect(() => {
    // Subscribe to auth state changes (prepares for OAuth's onAuthStateChanged)
    const unsubscribe = onAuthStateChange((authUser) => {
      setUser(authUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Login - Delegates to auth service
   * OAuth Migration: This will automatically work with OAuth once authService is updated
   */
  const login = useCallback(async (userData) => {
    try {
      // If userData is just a username string, use authService.login
      if (typeof userData === 'string') {
        const user = await authLogin(userData);
        setUser(user);
        return user;
      }

      // If full userData object provided (backwards compatibility)
      // First get any existing user data from auth service
      const user = await authLogin(userData.username);

      // Merge: existing user data takes precedence for stats,
      // but passed userData can override specific fields
      const mergedUser = {
        // Base defaults
        wins: 0,
        losses: 0,
        xp: 0,
        rank: 'Beginner',
        level: 1,
        authProvider: 'local',
        // Existing persisted data (preserves stats)
        ...user,
        // Explicitly passed data (can override non-stat fields)
        ...userData,
        // Always use persisted stats if they exist (don't let defaults overwrite)
        wins: user.wins ?? userData.wins ?? 0,
        losses: user.losses ?? userData.losses ?? 0,
        xp: user.xp ?? userData.xp ?? 0,
        rank: user.rank ?? userData.rank ?? 'Beginner',
        level: user.level ?? userData.level ?? 1,
      };
      setUser(mergedUser);
      return mergedUser;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }, []);

  /**
   * Logout - Delegates to auth service
   * OAuth Migration: This will handle token revocation automatically
   */
  const logout = useCallback(async () => {
    try {
      await authLogout();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state even if logout fails
      setUser(null);
    }
  }, []);

  /**
   * Update user - Merges updates and persists via auth service
   * OAuth Migration: May need to split local vs OAuth profile data
   */
  const updateUser = useCallback((updates) => {
    setUser(prev => {
      if (!prev) return prev;
      try {
        const updated = updateUserProfile(updates);
        return updated;
      } catch (error) {
        console.error('Update user error:', error);
        // Fallback to local update only
        return { ...prev, ...updates };
      }
    });
  }, []);

  /**
   * Get user ID - Returns the best available identifier
   */
  const getUserId = useCallback(() => {
    return user?.odUserId || user?.uid || user?.username || null;
  }, [user]);

  const value = {
    user,
    loading,
    login,
    logout,
    updateUser,
    getUserId,
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
