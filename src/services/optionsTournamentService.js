// src/services/optionsTournamentService.js
// Tournament lifecycle management for Options Arena

import {
  getActiveOptionsTournament,
  getOptionsTournamentById,
  createOptionsTournament,
  updateOptionsTournamentStatus,
  getOptionsEntriesForTournament,
  getUserOptionsEntries,
  resolveOptionsEntry,
  calculateOptionsRankings,
  settleOptionsContract
} from '../firebase/firebaseService';
import { settleContract, calculateMarkToMarket } from './stonkOptionsEngineV2';

// Tournament timing constants (ET timezone)
export const TOURNAMENT_CONFIG = {
  startDay: 1,        // Monday
  startHour: 9,
  startMinute: 30,
  lockDay: 1,         // Monday
  lockHour: 16,       // 4 PM
  lockMinute: 0,
  endDay: 5,          // Friday
  endHour: 16,        // 4 PM
  endMinute: 0
};

// Get current week number
const getWeekNumber = (date) => {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
};

// Create dates for tournament week
const getTournamentDates = (baseDate = new Date()) => {
  const year = baseDate.getFullYear();
  const week = getWeekNumber(baseDate);

  // Find Monday of this week
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - baseDate.getDay() + 1);

  const startDate = new Date(monday);
  startDate.setHours(9, 30, 0, 0);

  const lockDeadline = new Date(monday);
  lockDeadline.setHours(16, 0, 0, 0);

  const endDate = new Date(monday);
  endDate.setDate(monday.getDate() + 4); // Friday
  endDate.setHours(16, 0, 0, 0);

  return { year, week, startDate, lockDeadline, endDate };
};

/**
 * Create a weekly tournament
 * @param {Date} baseDate - Base date for the tournament week
 * @returns {Promise<Object>} - Created tournament
 */
export const createWeeklyOptionsTournament = async (baseDate = new Date()) => {
  const { year, week, startDate, lockDeadline, endDate } = getTournamentDates(baseDate);

  const tournament = {
    id: `options_${year}_W${week}`,
    name: `Options Arena Week ${week}`,
    status: 'open',
    startDate: startDate.toISOString(),
    lockDeadline: lockDeadline.toISOString(),
    endDate: endDate.toISOString(),
    entryCount: 0
  };

  return await createOptionsTournament(tournament);
};

/**
 * Get current tournament (creates if needed for current week)
 * @returns {Promise<Object|null>} - Current tournament or null
 */
export const getCurrentOptionsTournament = async () => {
  const existing = await getActiveOptionsTournament();
  if (existing) return existing;

  // No active tournament - check if we should create one
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Only auto-create Mon-Fri
  if (day >= 1 && day <= 5) {
    return await createWeeklyOptionsTournament(now);
  }

  return null;
};

/**
 * Check tournament status and update if needed
 * @param {Object} tournament - Tournament object
 * @returns {Promise<Object>} - Updated tournament
 */
export const checkAndUpdateTournamentStatus = async (tournament) => {
  const now = new Date();
  const lockDeadline = new Date(tournament.lockDeadline);
  const endDate = new Date(tournament.endDate);

  if (tournament.status === 'open' && now >= lockDeadline) {
    await updateOptionsTournamentStatus(tournament.id, 'in_progress');
    return { ...tournament, status: 'in_progress' };
  }

  if (tournament.status === 'in_progress' && now >= endDate) {
    // Tournament ended - trigger resolution
    await resolveTournament(tournament.id);
    return { ...tournament, status: 'completed' };
  }

  return tournament;
};

/**
 * Resolve tournament at end - calculate final values and rankings
 * @param {string} tournamentId - Tournament ID
 * @param {Object} currentPrices - Map of symbol -> current price
 */
export const resolveTournament = async (tournamentId, currentPrices) => {
  const entries = await getOptionsEntriesForTournament(tournamentId);

  for (const entry of entries) {
    let totalValue = entry.virtualCash || 0; // Start with remaining cash

    for (const contract of entry.contracts) {
      // Already locked by user - use locked value
      if (contract.lockedValue !== null) {
        totalValue += contract.lockedValue;
        continue;
      }

      // Already settled (expired during tournament)
      if (contract.settled) {
        totalValue += contract.finalValue || 0;
        continue;
      }

      // Not settled - calculate mark-to-market
      const currentPrice = currentPrices[contract.symbol];
      if (currentPrice) {
        const mtm = calculateMarkToMarket(contract, currentPrice);
        totalValue += mtm.currentValue;
      } else {
        // Fallback to entry amount if no price available
        totalValue += contract.entryAmount;
      }
    }

    const percentReturn = ((totalValue - 10000) / 10000) * 100;
    await resolveOptionsEntry(entry.id, totalValue, percentReturn);
  }

  await calculateOptionsRankings(tournamentId);
  await updateOptionsTournamentStatus(tournamentId, 'completed');
};

/**
 * Get leaderboard for a tournament
 * @param {string} tournamentId - Tournament ID
 * @returns {Promise<Array>} - Sorted leaderboard entries
 */
export const getOptionsTournamentLeaderboard = async (tournamentId) => {
  const entries = await getOptionsEntriesForTournament(tournamentId);

  return entries
    .map(e => ({
      id: e.id,
      odUserId: e.odUserId,
      username: e.username,
      entryNumber: e.entryNumber,
      isBot: e.isBot,
      totalValue: e.results?.totalValue,
      percentReturn: e.results?.percentReturn,
      rank: e.rank,
      contractCount: e.contracts?.length || 0
    }))
    .sort((a, b) => {
      if (a.rank && b.rank) return a.rank - b.rank;
      if (a.totalValue && b.totalValue) return b.totalValue - a.totalValue;
      return 0;
    });
};

/**
 * Check if user can enter tournament
 * @param {Object} tournament - Tournament object
 * @param {string} userId - User's odUserId
 * @returns {Promise<Object>} - { canEnter, reason?, entriesRemaining? }
 */
export const canUserEnterTournament = async (tournament, userId) => {
  if (tournament.status !== 'open') {
    return { canEnter: false, reason: 'Tournament is no longer accepting entries' };
  }

  const now = new Date();
  const lockDeadline = new Date(tournament.lockDeadline);
  if (now >= lockDeadline) {
    return { canEnter: false, reason: 'Entry deadline has passed' };
  }

  const entries = await getUserOptionsEntries(tournament.id, userId);
  if (entries.length >= 3) {
    return { canEnter: false, reason: 'Maximum 3 entries per tournament' };
  }

  return { canEnter: true, entriesRemaining: 3 - entries.length };
};

/**
 * Create test tournament (for development)
 * @returns {Promise<Object>} - Created test tournament
 */
export const createTestOptionsTournament = async () => {
  const now = new Date();

  const tournament = {
    id: `options_test_${Date.now()}`,
    name: `Test Options Tournament`,
    status: 'open',
    startDate: now.toISOString(),
    lockDeadline: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), // 24h from now
    endDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
    entryCount: 0,
    isTest: true
  };

  return await createOptionsTournament(tournament);
};

export default {
  TOURNAMENT_CONFIG,
  createWeeklyOptionsTournament,
  getCurrentOptionsTournament,
  checkAndUpdateTournamentStatus,
  resolveTournament,
  getOptionsTournamentLeaderboard,
  canUserEnterTournament,
  createTestOptionsTournament
};
