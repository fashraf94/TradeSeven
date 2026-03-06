// src/services/LocalStorage.js

const BATTLES_KEY = 'portfolioDuelBattles';

/**
 * Safely loads battles from localStorage
 * Returns empty array if data is missing or corrupted
 */
export function loadBattlesSafe() {
  try {
    const raw = localStorage.getItem(BATTLES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error loading battles from localStorage:', error);
    return [];
  }
}

/**
 * Safely saves battles to localStorage
 */
export function saveBattlesSafe(battles) {
  try {
    localStorage.setItem(BATTLES_KEY, JSON.stringify(battles));
    return true;
  } catch (error) {
    console.error('Error saving battles to localStorage:', error);
    return false;
  }
}

/**
 * Deep comparison to check if two battle arrays are the same
 * Prevents unnecessary re-renders and saves
 */
export function isSameBattles(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;

  return JSON.stringify(a) === JSON.stringify(b);
}

