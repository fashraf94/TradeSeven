// src/firebase/authService.js
// Firebase Authentication service for FantasyTrades

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';

/**
 * Sign up a new user
 *
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {string} username - User's chosen username
 * @returns {Promise<{user, userData}>} - Firebase user and Firestore user data
 */
export async function signUp(email, password, username) {
  try {
    // Validate inputs
    if (!email || !password || !username) {
      throw new Error('Email, password, and username are required');
    }

    if (username.length < 3 || username.length > 20) {
      throw new Error('Username must be between 3 and 20 characters');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    // TODO: Check username uniqueness (add this in Phase 2)
    // const usernameExists = await checkUsernameExists(username);
    // if (usernameExists) throw new Error('Username already taken');

    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update display name
    await updateProfile(user, { displayName: username });

    // Create Firestore user document
    const userData = {
      _v: 1,

      auth: {
        uid: user.uid,
        email: user.email,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      },

      profile: {
        username: username,
        displayName: username,
        avatarUrl: null,
        bio: null
      },

      stats: {
        xp: 0,
        level: 1,
        rank: 'Beginner',
        wins: 0,
        losses: 0,
        totalBattles: 0,
        winStreak: 0,
        longestWinStreak: 0,
        totalXPEarned: 0
      },

      settings: {
        notifications: {
          battleStart: true,
          battleEnd: true,
          challengeAvailable: true
        },
        privacy: {
          showStats: true,
          allowChallenges: true
        }
      },

      achievements: [],

      metadata: {
        referralCode: null,
        premiumTier: null,
        flags: {}
      },

      archived: false,
      updatedAt: new Date().toISOString()
    };

    // Save to Firestore
    await setDoc(doc(db, 'users', user.uid), userData);

    console.log('✅ User signed up successfully:', username);

    return { user, userData };
  } catch (error) {
    console.error('❌ Sign up error:', error);

    // Parse Firebase error messages to user-friendly format
    const errorMessage = parseAuthError(error);
    throw new Error(errorMessage);
  }
}

/**
 * Sign in an existing user
 *
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<{user, userData}>} - Firebase user and Firestore user data
 */
export async function signIn(email, password) {
  try {
    // Validate inputs
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Sign in with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update last login time
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      'auth.lastLoginAt': new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Fetch user data from Firestore
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User data not found. Please contact support.');
    }

    const userData = userDoc.data();

    console.log('✅ User signed in successfully:', userData.profile.username);

    return { user, userData };
  } catch (error) {
    console.error('❌ Sign in error:', error);

    // Parse Firebase error messages
    const errorMessage = parseAuthError(error);
    throw new Error(errorMessage);
  }
}

/**
 * Sign out the current user
 *
 * @returns {Promise<void>}
 */
export async function signOut() {
  try {
    await firebaseSignOut(auth);
    console.log('✅ User signed out successfully');
  } catch (error) {
    console.error('❌ Sign out error:', error);
    throw new Error('Failed to sign out. Please try again.');
  }
}

/**
 * Send password reset email
 *
 * @param {string} email - User's email
 * @returns {Promise<void>}
 */
export async function resetPassword(email) {
  try {
    if (!email) {
      throw new Error('Email is required');
    }

    await sendPasswordResetEmail(auth, email);
    console.log('✅ Password reset email sent to:', email);
  } catch (error) {
    console.error('❌ Password reset error:', error);
    const errorMessage = parseAuthError(error);
    throw new Error(errorMessage);
  }
}

/**
 * Get current user data from Firestore
 *
 * @param {string} userId - Firebase Auth UID
 * @returns {Promise<Object>} - User data
 */
export async function getUserData(userId) {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    return userDoc.data();
  } catch (error) {
    console.error('❌ Error fetching user data:', error);
    throw error;
  }
}

/**
 * Update user stats (XP, wins, losses, etc.)
 *
 * @param {string} userId - Firebase Auth UID
 * @param {Object} stats - Stats to update
 * @returns {Promise<void>}
 */
export async function updateUserStats(userId, stats) {
  try {
    const userRef = doc(db, 'users', userId);

    const updates = {
      updatedAt: new Date().toISOString()
    };

    // Build update object with dot notation for nested fields
    Object.keys(stats).forEach(key => {
      updates[`stats.${key}`] = stats[key];
    });

    await updateDoc(userRef, updates);

    console.log('✅ User stats updated:', stats);
  } catch (error) {
    console.error('❌ Error updating user stats:', error);
    throw error;
  }
}

/**
 * Listen to auth state changes
 *
 * @param {Function} callback - Callback function (user, userData) => void
 * @returns {Function} - Unsubscribe function
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        // Fetch user data from Firestore
        const userData = await getUserData(user.uid);
        callback({ user, userData });
      } catch (error) {
        console.error('❌ Error in onAuthChange:', error);
        callback(null);
      }
    } else {
      callback(null);
    }
  });
}

/**
 * Sign in with Google
 *
 * @returns {Promise<{user, userData}>} - Firebase user and Firestore user data
 */
export async function signInWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(auth, provider);
    const user = credential.user;

    // Check if user doc exists
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      // First-time Google user — create profile doc
      const username = user.displayName || user.email.split('@')[0];
      const userData = {
        _v: 1,
        auth: {
          uid: user.uid,
          email: user.email,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        },
        profile: {
          username,
          displayName: user.displayName || username,
          avatarUrl: user.photoURL || null,
          bio: null,
        },
        stats: {
          xp: 0, level: 1, rank: 'Beginner',
          wins: 0, losses: 0, totalBattles: 0,
          winStreak: 0, longestWinStreak: 0, totalXPEarned: 0,
        },
        settings: {
          notifications: { battleStart: true, battleEnd: true, challengeAvailable: true },
          privacy: { showStats: true, allowChallenges: true },
        },
        achievements: [],
        metadata: { referralCode: null, premiumTier: null, flags: {} },
        archived: false,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(userRef, userData);
      return { user, userData };
    }

    // Existing Google user — update last login
    await updateDoc(userRef, {
      'auth.lastLoginAt': new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return { user, userData: userDoc.data() };
  } catch (error) {
    console.error('Google sign-in error:', error);
    const errorMessage = parseAuthError(error);
    throw new Error(errorMessage);
  }
}

/**
 * Get current authenticated user
 *
 * @returns {Object|null} - Current Firebase Auth user
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Parse Firebase Auth error codes to user-friendly messages
 *
 * @param {Error} error - Firebase error
 * @returns {string} - User-friendly error message
 */
function parseAuthError(error) {
  // If it's already a custom error message, return it
  if (!error.code) {
    return error.message || 'An unknown error occurred';
  }

  // Parse Firebase error codes
  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please sign in or use a different email.';

    case 'auth/invalid-email':
      return 'Invalid email address. Please check and try again.';

    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled. Please contact support.';

    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';

    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';

    case 'auth/user-not-found':
      return 'No account found with this email. Please sign up first.';

    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';

    case 'auth/invalid-credential':
      return 'Invalid email or password. Please check your credentials.';

    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';

    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.';

    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled.';

    default:
      return error.message || 'Authentication failed. Please try again.';
  }
}

/**
 * Export all auth functions
 */
export default {
  signUp,
  signIn,
  signOut,
  signInWithGoogle,
  resetPassword,
  getUserData,
  updateUserStats,
  onAuthChange,
  getCurrentUser
};
