// src/services/tournamentResolutionService.js
// Service for resolving tournament results, calculating scores, and awarding rewards

/**
 * XP Reward Configuration
 */
export const XP_REWARDS = {
  // Participation
  participation: 50,         // Just for entering and locking

  // Placement rewards
  first: 500,
  second: 350,
  third: 250,
  top10: 150,
  diamond: 100,
  platinum: 75,
  gold: 50,
  silver: 25,
  bronze: 10,

  // Bonus XP
  perfectPrediction: 25,     // Per correct parlay
  allCorrect: 200,           // Bonus if ALL predictions hit
};

/**
 * Bracket Configuration
 */
export const BRACKET_CONFIG = {
  diamond: { percentile: 0.10, label: 'Diamond', emoji: '💎', color: '#00ffff' },
  platinum: { percentile: 0.25, label: 'Platinum', emoji: '⚪', color: '#e5e4e2' },
  gold: { percentile: 0.50, label: 'Gold', emoji: '🥇', color: '#ffd700' },
  silver: { percentile: 0.75, label: 'Silver', emoji: '🥈', color: '#c0c0c0' },
  bronze: { percentile: 1.00, label: 'Bronze', emoji: '🥉', color: '#cd7f32' },
};

/**
 * Medal Configuration
 */
export const MEDAL_TYPES = {
  gold: { icon: '🥇', label: '1st Place', color: '#FFD700', rank: 1 },
  silver: { icon: '🥈', label: '2nd Place', color: '#C0C0C0', rank: 2 },
  bronze: { icon: '🥉', label: '3rd Place', color: '#CD7F32', rank: 3 },
  top10: { icon: '🏅', label: 'Top 10', color: '#00d9ff', rank: 10 },
};

/**
 * Fetch earnings results for a symbol from our API
 * @param {string} symbol - Stock symbol
 * @param {string} date - Target date (optional)
 * @returns {Promise<Object>} - Earnings result
 */
export async function fetchEarningsResult(symbol, date = null) {
  try {
    const params = new URLSearchParams({ symbol });
    if (date) params.append('date', date);

    const response = await fetch(`/api/earnings/results?${params}`);
    const data = await response.json();

    return data;
  } catch (error) {
    console.error(`[Resolution] Error fetching results for ${symbol}:`, error);
    return { success: false, symbol, error: error.message };
  }
}

/**
 * Fetch results for multiple symbols in parallel
 * @param {Array} symbols - Array of { symbol, date } objects
 * @returns {Promise<Map>} - Map of symbol -> result
 */
export async function fetchMultipleResults(symbols) {
  const results = new Map();

  // Batch fetch in parallel with rate limiting
  const batchSize = 5;

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const promises = batch.map(({ symbol, date }) =>
      fetchEarningsResult(symbol, date)
    );

    const batchResults = await Promise.all(promises);

    batchResults.forEach((result, index) => {
      results.set(batch[index].symbol, result);
    });

    // Small delay between batches to avoid rate limits
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return results;
}

/**
 * Resolve a single entry's predictions
 * @param {Object} entry - Entry object with predictions
 * @param {Map} resultsMap - Map of symbol -> result
 * @returns {Object} - Resolved entry data
 */
export function resolveEntry(entry, resultsMap) {
  let totalPoints = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let pendingCount = 0;

  const resolvedPredictions = entry.predictions.map(prediction => {
    const result = resultsMap.get(prediction.symbol);

    if (!result || !result.success || !result.resolved) {
      pendingCount++;
      return {
        ...prediction,
        resolved: false,
        pointsEarned: null
      };
    }

    // Check if prediction was correct
    // For parlay: BOTH outcome AND magnitude must be correct
    const outcomeCorrect = prediction.outcome === result.outcome;
    const magnitudeCorrect = prediction.magnitude === result.magnitude;
    const isWinner = outcomeCorrect && magnitudeCorrect;

    // Calculate points
    const pointsEarned = isWinner ? (prediction.potentialPayout || 0) : 0;
    totalPoints += pointsEarned;

    if (isWinner) {
      correctCount++;
    } else {
      incorrectCount++;
    }

    return {
      ...prediction,
      resolved: true,
      actualOutcome: result.outcome,
      actualMagnitude: result.magnitude,
      actualMove: result.priceMove,
      epsActual: result.epsActual,
      epsEstimate: result.epsEstimate,
      outcomeCorrect,
      magnitudeCorrect,
      isCorrect: isWinner,
      isWinner,
      pointsEarned
    };
  });

  return {
    entryId: entry.entryId,
    odUserId: entry.odUserId,
    username: entry.username,
    predictions: resolvedPredictions,
    results: {
      totalPoints,
      correctPredictions: correctCount,
      incorrectPredictions: incorrectCount,
      pendingPredictions: pendingCount
    },
    status: pendingCount === 0 ? 'complete' : 'in_progress'
  };
}

/**
 * Calculate bracket based on rank and total entries
 * @param {number} rank - Entry's rank
 * @param {number} totalEntries - Total entries in tournament
 * @returns {string} - Bracket tier
 */
export function calculateBracket(rank, totalEntries) {
  if (totalEntries === 0) return 'bronze';

  const percentile = rank / totalEntries;

  if (percentile <= 0.10) return 'diamond';
  if (percentile <= 0.25) return 'platinum';
  if (percentile <= 0.50) return 'gold';
  if (percentile <= 0.75) return 'silver';
  return 'bronze';
}

/**
 * Get medal for rank
 * @param {number} rank - Entry's rank
 * @returns {string|null} - Medal type or null
 */
export function getMedal(rank) {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  if (rank <= 10) return 'top10';
  return null;
}

/**
 * Calculate XP rewards for an entry
 * @param {Object} entry - Resolved entry
 * @returns {Object} - XP breakdown
 */
export function calculateXPReward(entry) {
  let xpEarned = XP_REWARDS.participation;
  const reasons = ['Participation'];

  // Placement XP based on rank
  if (entry.rank === 1) {
    xpEarned += XP_REWARDS.first;
    reasons.push('1st Place');
  } else if (entry.rank === 2) {
    xpEarned += XP_REWARDS.second;
    reasons.push('2nd Place');
  } else if (entry.rank === 3) {
    xpEarned += XP_REWARDS.third;
    reasons.push('3rd Place');
  } else if (entry.rank <= 10) {
    xpEarned += XP_REWARDS.top10;
    reasons.push('Top 10');
  } else {
    // Bracket XP
    const bracketXP = XP_REWARDS[entry.bracket] || 0;
    if (bracketXP > 0) {
      xpEarned += bracketXP;
      reasons.push(`${entry.bracket.charAt(0).toUpperCase() + entry.bracket.slice(1)} Bracket`);
    }
  }

  // Bonus for correct predictions
  const correctCount = entry.results?.correctPredictions || 0;
  if (correctCount > 0) {
    const predictionXP = correctCount * XP_REWARDS.perfectPrediction;
    xpEarned += predictionXP;
    reasons.push(`${correctCount} correct prediction${correctCount > 1 ? 's' : ''} (+${predictionXP})`);
  }

  // All correct bonus
  const totalPredictions = entry.predictions?.length || 0;
  if (correctCount === totalPredictions && correctCount > 0) {
    xpEarned += XP_REWARDS.allCorrect;
    reasons.push('Perfect tournament!');
  }

  return {
    xpEarned,
    reasons,
    breakdown: {
      participation: XP_REWARDS.participation,
      placement: entry.rank <= 3 ? XP_REWARDS[entry.medal] : (entry.rank <= 10 ? XP_REWARDS.top10 : XP_REWARDS[entry.bracket]),
      predictions: correctCount * XP_REWARDS.perfectPrediction,
      perfectBonus: correctCount === totalPredictions && correctCount > 0 ? XP_REWARDS.allCorrect : 0
    }
  };
}

/**
 * Resolve an entire tournament
 * Fetches results, scores all entries, calculates rankings
 *
 * @param {string} tournamentId - Tournament ID
 * @param {Object} firebase - Firebase service module
 * @returns {Promise<Object>} - Resolution summary
 */
export async function resolveTournament(tournamentId, firebase) {
  console.log(`[Resolution] Starting resolution for tournament: ${tournamentId}`);

  try {
    // Get all entries for this tournament
    const leaderboard = await firebase.getTournamentLeaderboard(tournamentId, 10000);

    if (leaderboard.length === 0) {
      console.log('[Resolution] No entries to resolve');
      return { success: true, resolved: 0, failed: 0, entries: [] };
    }

    // Collect all unique symbols we need to fetch results for
    const symbolsToFetch = new Set();
    leaderboard.forEach(entry => {
      entry.predictions?.forEach(pred => {
        if (!pred.resolved) {
          symbolsToFetch.add(pred.symbol);
        }
      });
    });

    console.log(`[Resolution] Fetching results for ${symbolsToFetch.size} symbols`);

    // Fetch all results
    const resultsMap = await fetchMultipleResults(
      Array.from(symbolsToFetch).map(symbol => ({ symbol }))
    );

    // Resolve each entry
    const resolvedEntries = [];
    let resolved = 0;
    let failed = 0;

    for (const entry of leaderboard) {
      try {
        if (entry.status === 'complete') {
          // Already resolved
          resolvedEntries.push(entry);
          continue;
        }

        const resolvedEntry = resolveEntry(entry, resultsMap);

        // Convert results to format expected by Firebase function
        const resultArray = [];
        resultsMap.forEach((result, symbol) => {
          resultArray.push({
            symbol,
            eventId: result.symbol, // Use symbol as fallback eventId
            ...result
          });
        });

        // Update in Firebase
        await firebase.resolveEntryPredictions(entry.entryId, resultArray);

        resolvedEntries.push(resolvedEntry);
        resolved++;
      } catch (error) {
        console.error(`[Resolution] Failed to resolve ${entry.entryId}:`, error);
        failed++;
      }
    }

    // Calculate rankings
    await firebase.calculateTournamentRankings(tournamentId);

    // Mark tournament as complete if all predictions resolved
    const allComplete = resolvedEntries.every(e => e.status === 'complete');
    if (allComplete) {
      await firebase.updateTournamentStatus(tournamentId, 'completed');
    }

    console.log(`[Resolution] Complete. Resolved: ${resolved}, Failed: ${failed}`);

    return {
      success: true,
      tournamentId,
      resolved,
      failed,
      totalEntries: leaderboard.length,
      entries: resolvedEntries.slice(0, 20) // Return top 20 for summary
    };
  } catch (error) {
    console.error('[Resolution] Tournament resolution failed:', error);
    return {
      success: false,
      tournamentId,
      error: error.message
    };
  }
}

/**
 * Award XP to all participants in a tournament
 * @param {string} tournamentId - Tournament ID
 * @param {Object} firebase - Firebase service module
 * @returns {Promise<Object>} - XP award summary
 */
export async function awardTournamentXP(tournamentId, firebase) {
  console.log(`[Resolution] Awarding XP for tournament: ${tournamentId}`);

  try {
    const leaderboard = await firebase.getTournamentLeaderboard(tournamentId, 10000);
    const xpAwards = [];

    for (const entry of leaderboard) {
      if (entry.status !== 'complete') continue;

      const xpReward = calculateXPReward(entry);

      xpAwards.push({
        entryId: entry.entryId,
        odUserId: entry.odUserId,
        username: entry.username,
        ...xpReward
      });

      // TODO: Actually save XP to user profile when user system is implemented
      // await firebase.addUserXP(entry.odUserId, xpReward.xpEarned, {
      //   source: 'earnings_tournament',
      //   tournamentId,
      //   entryId: entry.entryId,
      //   reasons: xpReward.reasons
      // });
    }

    console.log(`[Resolution] Awarded XP to ${xpAwards.length} participants`);

    return {
      success: true,
      tournamentId,
      awards: xpAwards
    };
  } catch (error) {
    console.error('[Resolution] XP award failed:', error);
    return {
      success: false,
      tournamentId,
      error: error.message
    };
  }
}

/**
 * Get display info for a bracket
 * @param {string} bracket - Bracket tier
 * @returns {Object} - Display info
 */
export function getBracketDisplay(bracket) {
  return BRACKET_CONFIG[bracket] || BRACKET_CONFIG.bronze;
}

/**
 * Get display info for a medal
 * @param {string} medal - Medal type
 * @returns {Object|null} - Display info or null
 */
export function getMedalDisplay(medal) {
  return medal ? MEDAL_TYPES[medal] : null;
}

export default {
  XP_REWARDS,
  BRACKET_CONFIG,
  MEDAL_TYPES,
  fetchEarningsResult,
  fetchMultipleResults,
  resolveEntry,
  calculateBracket,
  getMedal,
  calculateXPReward,
  resolveTournament,
  awardTournamentXP,
  getBracketDisplay,
  getMedalDisplay
};
