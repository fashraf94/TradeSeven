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
 * Get user ID from auth or return null
 */
const getAuthUserId = () => {
  try {
    return auth?.currentUser?.uid || null;
  } catch (e) {
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
  // Try to get user ID from param, then from auth
  const uid = userId || getAuthUserId();

  if (!uid) {
    console.error('[Notes] No user ID available. userId param:', userId, 'auth:', getAuthUserId());
    throw new Error('User must be logged in to save notes');
  }

  try {
    const noteToSave = {
      userId: uid,
      ...noteData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    console.log('[Notes] Saving game plan note for user:', uid, {
      riskStyle: noteToSave.riskStyle,
      sectors: noteToSave.selectedSectors?.length,
      picks: noteToSave.mustHavePicks?.length
    });

    const docRef = await addDoc(collection(db, COLLECTION_NAME), noteToSave);

    console.log('[Notes] Saved with ID:', docRef.id);

    return docRef.id;

  } catch (error) {
    console.error('[Notes] Error saving note:', error);
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
  const uid = userId || getAuthUserId();

  if (!uid) {
    console.error('[Notes] No user ID available for fetching notes');
    throw new Error('User must be logged in to view notes');
  }

  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(maxResults)
    );

    const querySnapshot = await getDocs(q);

    const notes = [];
    querySnapshot.forEach((doc) => {
      notes.push({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore timestamp to JS Date
        createdAt: doc.data().createdAt?.toDate?.() || new Date()
      });
    });

    console.log('[Notes] Retrieved', notes.length, 'notes for user:', uid);

    return notes;

  } catch (error) {
    console.error('[Notes] Error getting notes:', error);
    throw error;
  }
};

/**
 * Get a single game plan note by ID
 * @param {string} noteId - The note ID
 * @returns {Promise<Object|null>} - The note data or null
 */
export const getGamePlanNote = async (noteId) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, noteId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate?.() || new Date()
      };
    }

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
  const uid = userId || getAuthUserId();

  if (!uid) {
    throw new Error('User must be logged in to delete notes');
  }

  try {
    await deleteDoc(doc(db, COLLECTION_NAME, noteId));
    console.log('[Notes] Deleted note:', noteId);
  } catch (error) {
    console.error('[Notes] Error deleting note:', error);
    throw error;
  }
};

export default {
  saveGamePlanNote,
  getGamePlanNotes,
  getGamePlanNote,
  deleteGamePlanNote
};
