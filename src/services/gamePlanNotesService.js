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
 * Save a game plan note to Firebase
 * @param {Object} noteData - The game plan data to save
 * @returns {Promise<string>} - The ID of the saved note
 */
export const saveGamePlanNote = async (noteData) => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('User must be logged in to save notes');
  }

  try {
    const noteToSave = {
      userId: user.uid,
      ...noteData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    console.log('[Notes] Saving game plan note:', {
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
 * Get all game plan notes for the current user
 * @param {number} maxResults - Maximum number of results (default 20)
 * @returns {Promise<Array>} - Array of game plan notes
 */
export const getGamePlanNotes = async (maxResults = 20) => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('User must be logged in to view notes');
  }

  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', user.uid),
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

    console.log('[Notes] Retrieved', notes.length, 'notes');

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
 * @returns {Promise<void>}
 */
export const deleteGamePlanNote = async (noteId) => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('User must be logged in to delete notes');
  }

  try {
    // First verify the note belongs to the user
    const noteDoc = await getGamePlanNote(noteId);

    if (!noteDoc) {
      throw new Error('Note not found');
    }

    if (noteDoc.userId !== user.uid) {
      throw new Error('Not authorized to delete this note');
    }

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
