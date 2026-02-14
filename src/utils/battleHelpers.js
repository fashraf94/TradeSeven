// /src/utils/battleHelpers.js

/**
 * Battle helper utilities for handling V1 (string) and V2 (object) battle formats
 *
 * V1 Format: { creator: "username", opponent: "username" }
 * V2 Format: { creator: { odUserId: "123", odUsername: "username" }, opponent: {...} }
 */

/**
 * Extract username from creator or opponent field
 * Works with both V1 (string) and V2 (object) formats
 * @param {string|object} creatorOrOpponent - The creator or opponent field
 * @returns {string|null} The username or null if not found
 */
export const getUsername = (creatorOrOpponent) => {
  if (!creatorOrOpponent) return null;

  // V1 format: direct string
  if (typeof creatorOrOpponent === 'string') {
    return creatorOrOpponent;
  }

  // V2 format: object with odUsername or username
  if (typeof creatorOrOpponent === 'object') {
    return creatorOrOpponent.odUsername || creatorOrOpponent.username || null;
  }

  return null;
};

/**
 * Extract user ID from creator or opponent field
 * @param {string|object} creatorOrOpponent - The creator or opponent field
 * @returns {string|null} The user ID or null if not found
 */
export const getUserId = (creatorOrOpponent) => {
  if (!creatorOrOpponent) return null;

  // V1 format: no ID available, use username as fallback
  if (typeof creatorOrOpponent === 'string') {
    return creatorOrOpponent;
  }

  // V2 format: object with odUserId
  if (typeof creatorOrOpponent === 'object') {
    return creatorOrOpponent.odUserId || creatorOrOpponent.uid || creatorOrOpponent.odUsername || null;
  }

  return null;
};

/**
 * Check if a user is the creator of a battle
 * @param {object} battle - The battle object
 * @param {string} username - The username to check
 * @returns {boolean} True if user is the creator
 */
export const isCreator = (battle, username) => {
  if (!battle || !username) return false;
  return getUsername(battle.creator) === username;
};

/**
 * Check if a user is the opponent in a battle
 * @param {object} battle - The battle object
 * @param {string} username - The username to check
 * @returns {boolean} True if user is the opponent
 */
export const isOpponent = (battle, username) => {
  if (!battle || !username) return false;
  return getUsername(battle.opponent) === username;
};

/**
 * Check if a user is a participant (creator or opponent) in a battle
 * @param {object} battle - The battle object
 * @param {string} username - The username to check
 * @returns {boolean} True if user is a participant
 */
export const isParticipant = (battle, username) => {
  return isCreator(battle, username) || isOpponent(battle, username);
};

/**
 * Get the opponent's username for a given user in a battle
 * @param {object} battle - The battle object
 * @param {string} myUsername - The current user's username
 * @returns {string|null} The opponent's username or null
 */
export const getOpponentUsername = (battle, myUsername) => {
  if (!battle || !myUsername) return null;

  if (isCreator(battle, myUsername)) {
    return getUsername(battle.opponent);
  }
  return getUsername(battle.creator);
};

/**
 * Get the user's portfolio from a battle
 * @param {object} battle - The battle object
 * @param {string} username - The username to get portfolio for
 * @returns {array|null} The portfolio array or null
 */
export const getUserPortfolio = (battle, username) => {
  if (!battle || !username) return null;

  if (isCreator(battle, username)) {
    // V2 format stores portfolio inside creator object
    if (typeof battle.creator === 'object' && battle.creator.portfolio) {
      return battle.creator.portfolio;
    }
    // V1 format stores portfolio at top level
    return battle.creatorPortfolio || null;
  }

  if (isOpponent(battle, username)) {
    // V2 format
    if (typeof battle.opponent === 'object' && battle.opponent.portfolio) {
      return battle.opponent.portfolio;
    }
    // V1 format
    return battle.opponentPortfolio || null;
  }

  return null;
};

/**
 * Get the opponent's portfolio from a battle
 * @param {object} battle - The battle object
 * @param {string} myUsername - The current user's username
 * @returns {array|null} The opponent's portfolio array or null
 */
export const getOpponentPortfolio = (battle, myUsername) => {
  const opponentUsername = getOpponentUsername(battle, myUsername);
  return getUserPortfolio(battle, opponentUsername);
};

/**
 * Determine if a battle is a BaggerBomb format battle (V2 or V3)
 * @param {object} battle - The battle object
 * @returns {boolean} True if BaggerBomb battle
 */
export const isBaggerBombBattle = (battle) => {
  return battle?._v === 2 || battle?._v === 3 || battle?.type?.includes('baggerbomb');
};

/**
 * Determine if a battle is a training battle
 * @param {object} battle - The battle object
 * @returns {boolean} True if training battle
 */
export const isTrainingBattle = (battle) => {
  return battle?.isTrainingBattle === true ||
         battle?.type === 'baggerbomb_training' ||
         battle?.id?.startsWith('training_') ||
         getUsername(battle?.opponent) === 'CPU Opponent' ||
         getUsername(battle?.opponent) === 'MarketBot';
};

/**
 * Get battle status with human-readable format
 * @param {object} battle - The battle object
 * @returns {string} Status string: 'pending', 'active', 'completed'
 */
export const getBattleStatus = (battle) => {
  if (!battle) return 'unknown';
  return battle.status || battle.state?.status || 'pending';
};

/**
 * Check if user won a completed battle
 * @param {object} battle - The battle object
 * @param {string} username - The username to check
 * @returns {boolean|null} True if won, false if lost, null if not completed or tie
 */
export const didUserWin = (battle, username) => {
  const status = getBattleStatus(battle);
  if (status !== 'completed' || !battle.result) {
    return null;
  }

  // Check if result.winner is a username string
  if (typeof battle.result.winner === 'string') {
    if (battle.result.winner === 'tie') return null;
    return battle.result.winner === username;
  }

  // Check if result indicates creator/opponent won
  if (battle.result.winner === 'creator') {
    return isCreator(battle, username);
  }
  if (battle.result.winner === 'opponent') {
    return isOpponent(battle, username);
  }

  return null;
};

/**
 * Get user's score from a battle result
 * @param {object} battle - The battle object
 * @param {string} username - The username
 * @returns {number|null} The user's score or null
 */
export const getUserScore = (battle, username) => {
  if (!battle?.result) return null;

  if (isCreator(battle, username)) {
    return battle.result.creatorTotalScore ?? battle.result.creatorReturn ?? null;
  }
  if (isOpponent(battle, username)) {
    return battle.result.opponentTotalScore ?? battle.result.opponentReturn ?? null;
  }
  return null;
};

/**
 * Get opponent's score from a battle result
 * @param {object} battle - The battle object
 * @param {string} myUsername - The current user's username
 * @returns {number|null} The opponent's score or null
 */
export const getOpponentScore = (battle, myUsername) => {
  if (!battle?.result) return null;

  if (isCreator(battle, myUsername)) {
    return battle.result.opponentTotalScore ?? battle.result.opponentReturn ?? null;
  }
  if (isOpponent(battle, myUsername)) {
    return battle.result.creatorTotalScore ?? battle.result.creatorReturn ?? null;
  }
  return null;
};

/**
 * Transform raw sessionScores (creator/opponent keyed) into player/opponent display format.
 * Extracted from BattleHeader useMemo for testability.
 */
export const transformSessionScores = (sessionScores) => {
  if (!sessionScores) return {};
  const result = {};
  Object.entries(sessionScores).forEach(([key, scores]) => {
    result[key] = {
      player: scores.creator ?? scores.player ?? 0,
      opponent: scores.opponent ?? 0,
    };
  });
  return result;
};

/**
 * Calculate daily price change percentages for an array of agents.
 * Returns an array of numbers (or null when data is unavailable), matching agent order.
 * Extracted from FreeAgentBar useMemo for testability.
 */
export const calculateAgentPriceChanges = (agents, currentPrices, dailyOpens) => {
  return agents.map((agent) => {
    const current = currentPrices[agent.symbol];
    const dailyOpen = dailyOpens[agent.symbol];
    if (current && dailyOpen && dailyOpen > 0) {
      return ((current - dailyOpen) / dailyOpen) * 100;
    }
    return null;
  });
};

/**
 * Default export with all helpers
 */
export default {
  getUsername,
  getUserId,
  isCreator,
  isOpponent,
  isParticipant,
  getOpponentUsername,
  getUserPortfolio,
  getOpponentPortfolio,
  isBaggerBombBattle,
  isTrainingBattle,
  getBattleStatus,
  didUserWin,
  getUserScore,
  getOpponentScore,
  transformSessionScores,
  calculateAgentPriceChanges
};
