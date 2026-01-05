// src/contexts/UserContext.jsx
// Global user state management using React Context

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loadUser, saveUser, clearUser } from '../services/LocalStorage';

const UserContext = createContext(null);

/**
 * UserProvider - Wraps the app and provides user state globally
 */
export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = loadUser();
    if (savedUser) {
      setUser(savedUser);
    }
    setLoading(false);
  }, []);

  /**
   * Login - Sets user state and persists to localStorage
   */
  const login = useCallback((userData) => {
    const userWithDefaults = {
      wins: 0,
      losses: 0,
      xp: 0,
      rank: 'Beginner',
      level: 1,
      joinedAt: new Date().toISOString(),
      ...userData
    };
    setUser(userWithDefaults);
    saveUser(userWithDefaults);
  }, []);

  /**
   * Logout - Clears user state and localStorage
   */
  const logout = useCallback(() => {
    setUser(null);
    clearUser();
  }, []);

  /**
   * Update user - Merges updates and persists
   */
  const updateUser = useCallback((updates) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      saveUser(updated);
      return updated;
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
