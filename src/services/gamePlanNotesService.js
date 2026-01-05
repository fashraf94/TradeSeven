// src/services/gamePlanNotesService.js
// Firebase CRUD operations for game plan notes

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';

const COLLECTION_NAME = 'gamePlanNotes';

/**
 * Debug: Log auth state
 */
const debugAuth = () => {
  console.log('[Notes Debug] Auth state:', {
    currentUser: auth?.currentUser,
    uid: auth?.currentUser?.uid,
    email: auth?.currentUser?.email,
    isAnonymous: auth?.currentUser?.isAnonymous
  });
  return auth;
};

/**
 * Get user ID with multiple fallback methods
 * Priority: auth.currentUser > localStorage > sessionStorage > null
 */
const getAuthUserId = () => {
  try {
    // Method 1: Firebase auth current user
    if (auth?.currentUser?.uid) {
      console.log('[Notes] Using Firebase auth uid:', auth.currentUser.uid);
      return auth.currentUser.uid;
    }

    // Method 2: Check localStorage for user data
    const storedUser = localStorage.getItem('portfolioDuelUser');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        const localId = parsed?.odUserId || parsed?.uid || parsed?.username;
        if (localId) {
          console.log('[Notes] Using localStorage uid:', localId);
          return localId;
        }
      } catch (e) {
        console.warn('[Notes] Failed to parse localStorage user:', e);
      }
    }

    // Method 3: Check sessionStorage
    const sessionUser = sessionStorage.getItem('user');
    if (sessionUser) {
      try {
        const parsed = JSON.parse(sessionUser);
        const sessionId = parsed?.odUserId || parsed?.uid || parsed?.username;
        if (sessionId) {
          console.log('[Notes] Using sessionStorage uid:', sessionId);
          return sessionId;
        }
      } catch (e) {
        console.warn('[Notes] Failed to parse sessionStorage user:', e);
      }
    }

    console.warn('[Notes] No user ID found in any source');
    return null;
  } catch (e) {
    console.error('[Notes] Error getting auth user ID:', e);
    return null;
  }
};

/**
 * Save a game plan note to Firebase
 * @param {Object} noteData - The game plan data to save
 * @param {string} userId - Optional: pass userId directly if available
 * @returns {Promise<string>} - The ID of the saved note
 */
export const saveGamePlanNote = async (noteData, userId = null) => {
  console.log('[Notes] === SAVE START ===');
  console.log('[Notes] Received noteData:', noteData);
  console.log('[Notes] Received userId param:', userId);

  // Debug auth state
  debugAuth();

  // Try to get user ID from param, then from auth
  const uid = userId || getAuthUserId();

  console.log('[Notes] Final uid:', uid);

  if (!uid) {
    console.error('[Notes] FAILED: No user ID available');
    throw new Error('Please log in to save game plans');
  }

  // Check db connection
  console.log('[Notes] DB instance:', db);
  console.log('[Notes] Collection name:', COLLECTION_NAME);

  try {
    const noteToSave = {
      userId: uid,
      riskStyle: noteData.riskStyle || 'balanced',
      marketStance: noteData.marketStance || 'neutral',
      selectedSectors: noteData.selectedSectors || [],
      mustHavePicks: (noteData.mustHavePicks || []).map(p => ({
        symbol: p?.symbol || p,
        name: p?.name || p?.symbol || p
      })),
      aiStrategy: noteData.aiStrategy || '',
      breakoutCandidates: (noteData.breakoutCandidates || []).slice(0, 10).map(s => ({
        symbol: s?.symbol || s,
        name: s?.name || s?.symbol || s
      })),
      safePlays: (noteData.safePlays || []).slice(0, 10).map(s => ({
        symbol: s?.symbol || s,
        name: s?.name || s?.symbol || s
      })),
      cryptoRecommendation: noteData.cryptoRecommendation ? {
        symbol: noteData.cryptoRecommendation.symbol,
        name: noteData.cryptoRecommendation.name
      } : null,
      wildcards: noteData.wildcards || [],
      sessionPicks: noteData.sessionPicks || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    console.log('[Notes] Document to save:', noteToSave);

    const collectionRef = collection(db, COLLECTION_NAME);
    console.log('[Notes] Collection ref:', collectionRef);

    const docRef = await addDoc(collectionRef, noteToSave);

    console.log('[Notes] SUCCESS! Saved with ID:', docRef.id);

    return docRef.id;

  } catch (error) {
    console.error('[Notes] SAVE ERROR:', error);
    console.error('[Notes] Error code:', error.code);
    console.error('[Notes] Error message:', error.message);

    // Common errors:
    if (error.code === 'permission-denied') {
      console.error('[Notes] PERMISSION DENIED - Check Firestore rules');
    }

    throw error;
  }
};

/**
 * Get all game plan notes for a user
 * @param {string} userId - Optional: pass userId directly
 * @param {number} maxResults - Maximum number of results (default 20)
 * @returns {Promise<Array>} - Array of game plan notes
 */
export const getGamePlanNotes = async (userId = null, maxResults = 20) => {
  console.log('[Notes] === LOAD START ===');
  console.log('[Notes] Received userId param:', userId);

  // Debug auth state
  debugAuth();

  const uid = userId || getAuthUserId();

  console.log('[Notes] Final uid:', uid);

  if (!uid) {
    console.error('[Notes] FAILED: No user ID available');
    throw new Error('Please log in to view saved game plans');
  }

  try {
    console.log('[Notes] Building query...');

    // Try simpler query first (without orderBy to avoid index requirement)
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', uid),
      limit(maxResults)
    );

    console.log('[Notes] Executing query...');

    const querySnapshot = await getDocs(q);

    console.log('[Notes] Query returned', querySnapshot.size, 'documents');

    const notes = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log('[Notes] Document:', doc.id, data);
      notes.push({
        id: doc.id,
        ...data,
        // Convert Firestore timestamp to JS Date
        createdAt: data.createdAt?.toDate?.() || new Date()
      });
    });

    // Sort by createdAt client-side (avoids index requirement)
    notes.sort((a, b) => b.createdAt - a.createdAt);

    console.log('[Notes] SUCCESS! Loaded', notes.length, 'notes');

    return notes;

  } catch (error) {
    console.error('[Notes] LOAD ERROR:', error);
    console.error('[Notes] Error code:', error.code);
    console.error('[Notes] Error message:', error.message);

    // Common errors:
    if (error.code === 'permission-denied') {
      console.error('[Notes] PERMISSION DENIED - Check Firestore rules');
    }
    if (error.code === 'failed-precondition') {
      console.error('[Notes] INDEX REQUIRED - Create composite index');
    }

    throw error;
  }
};

/**
 * Get a single game plan note by ID
 * @param {string} noteId - The note ID
 * @returns {Promise<Object|null>} - The note data or null
 */
export const getGamePlanNote = async (noteId) => {
  console.log('[Notes] Getting note:', noteId);

  try {
    const docRef = doc(db, COLLECTION_NAME, noteId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      console.log('[Notes] Found note:', noteId);
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate?.() || new Date()
      };
    }

    console.log('[Notes] Note not found:', noteId);
    return null;

  } catch (error) {
    console.error('[Notes] Error getting note:', error);
    throw error;
  }
};

/**
 * Delete a game plan note
 * @param {string} noteId - The note ID to delete
 * @param {string} userId - Optional: pass userId for verification
 * @returns {Promise<void>}
 */
export const deleteGamePlanNote = async (noteId, userId = null) => {
  console.log('[Notes] === DELETE START ===');
  console.log('[Notes] noteId:', noteId);

  const uid = userId || getAuthUserId();

  if (!uid) {
    throw new Error('User must be logged in to delete notes');
  }

  try {
    await deleteDoc(doc(db, COLLECTION_NAME, noteId));
    console.log('[Notes] SUCCESS! Deleted:', noteId);
  } catch (error) {
    console.error('[Notes] DELETE ERROR:', error);
    throw error;
  }
};

export default {
  saveGamePlanNote,
  getGamePlanNotes,
  getGamePlanNote,
  deleteGamePlanNote
};
