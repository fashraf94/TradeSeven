// src/services/auth/authService.js
// Auth abstraction layer - currently uses localStorage, designed for easy OAuth migration

import { loadUser, saveUser, clearUser } from '../LocalStorage';

/**
 * Auth Service - Abstraction layer for authentication
 *
 * Current Implementation: Username-based auth with localStorage persistence
 *
 * Future OAuth Migration:
 * - Replace localStorage calls with Firebase Auth / OAuth provider
 * - Add token refresh logic
 * - Implement proper session management
 * - Add OAuth callback handlers
 *
 * To migrate to OAuth:
 * 1. Update login() to call OAuth provider
 * 2. Update logout() to revoke OAuth tokens
 * 3. Update getCurrentUser() to return OAuth user object
 * 4. Add onAuthStateChanged listener for reactive auth state
 */

/**
 * Get the currently authenticated user
 * @returns {Object|null} User object or null if not authenticated
 *
 * OAuth Migration: Replace with Firebase auth.currentUser or OAuth provider's user
 */
export const getCurrentUser = () => {
  return loadUser();
};

/**
 * Login with username (current implementation)
 * @param {string} username - The username to login with
 * @returns {Object} The created user object
 *
 * OAuth Migration: Replace with signInWithPopup/signInWithRedirect
 * Example future signature: login(provider: 'google' | 'apple' | 'email', credentials?)
 */
export const login = async (username) => {
  if (!username || !username.trim()) {
    throw new Error('Username is required');
  }

  const userData = {
    username: username.trim(),
    odUserId: `local_${username.trim().toLowerCase()}`, // Simulated user ID
    wins: 0,
    losses: 0,
    xp: 0,
    rank: 'Beginner',
    level: 1,
    joinedAt: new Date().toISOString(),
    authProvider: 'local', // Track auth provider for migration
  };

  saveUser(userData);
  return userData;
};

/**
 * Logout the current user
 * @returns {boolean} Success status
 *
 * OAuth Migration: Replace with signOut() and token revocation
 */
export const logout = async () => {
  try {
    clearUser();
    return true;
  } catch (error) {
    console.error('Logout error:', error);
    return false;
  }
};

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export const isAuthenticated = () => {
  return getCurrentUser() !== null;
};

/**
 * Get user ID (normalized across auth providers)
 * @returns {string|null}
 *
 * OAuth Migration: Return OAuth uid instead
 */
export const getUserId = () => {
  const user = getCurrentUser();
  return user?.odUserId || user?.uid || user?.username || null;
};

/**
 * Update user profile data
 * @param {Object} updates - Fields to update
 * @returns {Object} Updated user object
 *
 * OAuth Migration: May need to split between local data and OAuth profile
 */
export const updateUserProfile = (updates) => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('No user logged in');
  }

  const updatedUser = {
    ...currentUser,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveUser(updatedUser);
  return updatedUser;
};

/**
 * Subscribe to auth state changes (placeholder for OAuth)
 * @param {Function} callback - Called when auth state changes
 * @returns {Function} Unsubscribe function
 *
 * OAuth Migration: Replace with onAuthStateChanged(auth, callback)
 *
 * Current implementation: Returns noop since localStorage doesn't have events
 * In OAuth, this would be:
 *   return onAuthStateChanged(auth, (user) => callback(user));
 */
export const onAuthStateChange = (callback) => {
  // Current implementation: Check once and return
  const user = getCurrentUser();
  callback(user);

  // Return unsubscribe function (noop for localStorage)
  return () => {};
};

/**
 * Auth providers enum (for future OAuth)
 */
export const AUTH_PROVIDERS = {
  LOCAL: 'local',
  // Future providers:
  // GOOGLE: 'google',
  // APPLE: 'apple',
  // EMAIL: 'email',
};

// Default export for convenience
export default {
  getCurrentUser,
  login,
  logout,
  isAuthenticated,
  getUserId,
  updateUserProfile,
  onAuthStateChange,
  AUTH_PROVIDERS,
};
