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
 * Get user ID from Firebase Auth
 * Primary source: auth.currentUser.uid (Firebase Auth session)
 */
const getAuthUserId = () => {
  if (auth?.currentUser?.uid) {
    return auth.currentUser.uid;
  }
  return null;
};

/**
 * Save a game plan note to Firebase
 * @param {Object} noteData - The game plan data to save
 * @param {string} userId - Optional: pass userId directly if available
 * @returns {Promise<string>} - The ID of the saved note
 */
export const saveGamePlanNote = async (noteData, userId = null) => {
  const uid = userId || getAuthUserId();

  if (!uid) {
    throw new Error('Please log in to save game plans');
  }

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

    const collectionRef = collection(db, COLLECTION_NAME);
    const docRef = await addDoc(collectionRef, noteToSave);
    return docRef.id;
  } catch (error) {
    console.error('[Notes] Save error:', error.code, error.message);
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
    throw new Error('Please log in to view saved game plans');
  }

  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', uid),
      limit(maxResults)
    );

    const querySnapshot = await getDocs(q);

    const notes = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      notes.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date()
      });
    });

    // Sort by createdAt client-side (avoids index requirement)
    notes.sort((a, b) => b.createdAt - a.createdAt);
    return notes;
  } catch (error) {
    console.error('[Notes] Load error:', error.code, error.message);
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
    console.error('[Notes] Get error:', error.code, error.message);
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
  } catch (error) {
    console.error('[Notes] Delete error:', error.code, error.message);
    throw error;
  }
};

export default {
  saveGamePlanNote,
  getGamePlanNotes,
  getGamePlanNote,
  deleteGamePlanNote
};
