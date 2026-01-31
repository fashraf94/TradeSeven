/**
 * portfolioHelpers.js - V3-safe portfolio access utilities
 *
 * This module provides safe portfolio access functions that handle all battle formats:
 * - V1/V2: Flat array portfolios at battle.creatorPortfolio/opponentPortfolio
 * - V3: Tiered object portfolios { star: [], core: [], support: [] }
 *
 * Always use these helpers instead of directly accessing portfolio properties
 * to prevent "filter is not a function" crashes on V3 battles.
 */

import { flattenPortfolio, flattenBench } from './baggerBombUtils';
import { getUserPortfolio, getOpponentPortfolio } from './battleHelpers';

/**
 * Convert any portfolio format to a safe flat array for iteration
 * Handles null, V1/V2 arrays, and V3 tiered objects
 *
 * @param {Array|Object|null} portfolio - Portfolio in any format
 * @returns {Array} Flat array of assets, safe for .filter(), .map(), .forEach()
 *
 * @example
 * // V1/V2 - already an array
 * safePortfolioArray([{ symbol: 'AAPL' }]) // => [{ symbol: 'AAPL' }]
 *
 * // V3 - tiered object
 * safePortfolioArray({ star: [{ symbol: 'NVDA' }], core: [], support: [] })
 * // => [{ symbol: 'NVDA', tier: 'star', allocation: 20, slotIndex: 0 }]
 *
 * // null/undefined
 * safePortfolioArray(null) // => []
 */
export function safePortfolioArray(portfolio) {
  if (!portfolio) return [];
  if (Array.isArray(portfolio)) return portfolio;
  return flattenPortfolio(portfolio);
}

/**
 * Convert any bench format to a safe flat array
 * Handles null, arrays, and V3 bench objects { stocks: [], crypto: {} }
 *
 * @param {Array|Object|null} bench - Bench in any format
 * @returns {Array} Flat array of bench assets
 */
export function safeBenchArray(bench) {
  if (!bench) return [];
  if (Array.isArray(bench)) return bench;
  return flattenBench(bench);
}

/**
 * Get user's portfolio from a battle as a flat array
 * Safe for V1, V2, and V3 battles
 *
 * @param {Object} battle - Battle object
 * @param {string} username - Current user's username
 * @returns {Array} Flat array of user's assets
 */
export function getUserPortfolioFlat(battle, username) {
  if (!battle) return [];

  // Determine if user is creator or opponent
  const isCreator = battle.creator === username ||
                    battle.creator?.username === username ||
                    battle.creator?.odUserId === username;

  // Get raw portfolio - handle V3 (nested in creator/opponent) and V1/V2 (top-level)
  const rawPortfolio = isCreator
    ? (battle.creatorPortfolio || battle.creator?.portfolio)
    : (battle.opponentPortfolio || battle.opponent?.portfolio);

  return safePortfolioArray(rawPortfolio);
}

/**
 * Get opponent's portfolio from a battle as a flat array
 *
 * @param {Object} battle - Battle object
 * @param {string} myUsername - Current user's username
 * @returns {Array} Flat array of opponent's assets
 */
export function getOpponentPortfolioFlat(battle, myUsername) {
  if (!battle) return [];

  // Determine if user is creator (so opponent is in opponent field)
  const isCreator = battle.creator === myUsername ||
                    battle.creator?.username === myUsername ||
                    battle.creator?.odUserId === myUsername;

  // Get opponent's raw portfolio
  const rawPortfolio = isCreator
    ? (battle.opponentPortfolio || battle.opponent?.portfolio)
    : (battle.creatorPortfolio || battle.creator?.portfolio);

  return safePortfolioArray(rawPortfolio);
}

/**
 * Get both portfolios from a battle, each as flat arrays
 * Useful for calculating scores or comparing positions
 *
 * @param {Object} battle - Battle object
 * @param {string} username - Current user's username
 * @returns {{ myPortfolio: Array, theirPortfolio: Array }}
 */
export function getBothPortfoliosFlat(battle, username) {
  return {
    myPortfolio: getUserPortfolioFlat(battle, username),
    theirPortfolio: getOpponentPortfolioFlat(battle, username),
  };
}

/**
 * Get all unique symbols from a battle's portfolios
 * Useful for price fetching
 *
 * @param {Object} battle - Battle object
 * @returns {string[]} Array of unique ticker symbols
 */
export function getAllBattleSymbols(battle) {
  if (!battle) return [];

  const creatorPortfolio = safePortfolioArray(
    battle.creatorPortfolio || battle.creator?.portfolio
  );
  const opponentPortfolio = safePortfolioArray(
    battle.opponentPortfolio || battle.opponent?.portfolio
  );

  const allAssets = [...creatorPortfolio, ...opponentPortfolio];
  return [...new Set(allAssets.map(a => a?.symbol).filter(Boolean))];
}
