/**
 * Game Plan Template Service
 * Save and load game plans to/from Firebase
 */

import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';

const COLLECTION_NAME = 'gamePlanTemplates';

/**
 * Save a game plan template
 * @param {Object} template
 * @param {string} template.userId - User's ID
 * @param {string} template.name - Template name
 * @param {string} template.riskStyle - Risk style
 * @param {string[]} template.sectors - Selected sector IDs
 * @param {Object[]} template.mustHavePicks - User's required stocks
 * @param {Object[]} template.portfolio - Full portfolio
 * @param {string} template.strategyText - AI-generated strategy
 * @returns {Promise<string>} Template ID
 */
export const saveTemplate = async (template) => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...template,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log('Template saved:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving template:', error);
    throw error;
  }
};

/**
 * Get all templates for a user
 * @param {string} userId
 * @returns {Promise<Object[]>} Array of templates
 */
export const getTemplates = async (userId) => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc'),
      limit(20)
    );

    const snapshot = await getDocs(q);
    const templates = [];

    snapshot.forEach(doc => {
      templates.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return templates;
  } catch (error) {
    console.error('Error fetching templates:', error);
    throw error;
  }
};

/**
 * Get a single template by ID
 * @param {string} templateId
 * @returns {Promise<Object|null>} Template or null
 */
export const getTemplate = async (templateId) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, templateId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching template:', error);
    throw error;
  }
};

/**
 * Update a template
 * @param {string} templateId
 * @param {Object} updates
 * @returns {Promise<void>}
 */
export const updateTemplate = async (templateId, updates) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, templateId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });

    console.log('Template updated:', templateId);
  } catch (error) {
    console.error('Error updating template:', error);
    throw error;
  }
};

/**
 * Delete a template
 * @param {string} templateId
 * @returns {Promise<void>}
 */
export const deleteTemplate = async (templateId) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, templateId);
    await deleteDoc(docRef);

    console.log('Template deleted:', templateId);
  } catch (error) {
    console.error('Error deleting template:', error);
    throw error;
  }
};

/**
 * Get recent templates (for quick load)
 * @param {string} userId
 * @param {number} count
 * @returns {Promise<Object[]>}
 */
export const getRecentTemplates = async (userId, count = 3) => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc'),
      limit(count)
    );

    const snapshot = await getDocs(q);
    const templates = [];

    snapshot.forEach(doc => {
      templates.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return templates;
  } catch (error) {
    console.error('Error fetching recent templates:', error);
    return [];
  }
};

export default {
  saveTemplate,
  getTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  getRecentTemplates
};
