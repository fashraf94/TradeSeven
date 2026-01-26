// src/hooks/useOptionsTournament.js
// React hook for managing Options Tournament state in the UI

import { useState, useEffect, useCallback } from 'react';
import {
  getCurrentOptionsTournament,
  checkAndUpdateTournamentStatus,
  getOptionsTournamentLeaderboard,
  canUserEnterTournament
} from '../services/optionsTournamentService';
import {
  getUserOptionsEntries,
  createOptionsEntry,
  lockOptionsPosition
} from '../firebase/firebaseService';
import { validateTournamentPortfolio } from '../services/stonkOptionsEngineV2';

export const useOptionsTournament = (userId, username) => {
  // Tournament state
  const [tournament, setTournament] = useState(null);
  const [userEntries, setUserEntries] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [canEnter, setCanEnter] = useState({ canEnter: false, reason: 'Loading...' });

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch tournament data
  const fetchTournamentData = useCallback(async () => {
    console.log('=== useOptionsTournament.fetchTournamentData ===');
    console.log('userId:', userId);

    if (!userId) {
      console.log('No userId, returning early');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get current tournament
      console.log('Calling getCurrentOptionsTournament...');
      let currentTournament = await getCurrentOptionsTournament();
      console.log('getCurrentOptionsTournament returned:', currentTournament);

      if (currentTournament) {
        // Check and update status if needed
        currentTournament = await checkAndUpdateTournamentStatus(currentTournament);
        setTournament(currentTournament);

        // Get user's entries
        const entries = await getUserOptionsEntries(currentTournament.id, userId);
        setUserEntries(entries);

        // Get leaderboard
        const lb = await getOptionsTournamentLeaderboard(currentTournament.id);
        setLeaderboard(lb);

        // Check if user can enter
        const entryStatus = await canUserEnterTournament(currentTournament, userId);
        setCanEnter(entryStatus);
      } else {
        setTournament(null);
        setCanEnter({ canEnter: false, reason: 'No active tournament' });
      }
    } catch (err) {
      console.error('Error fetching tournament data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    fetchTournamentData();
  }, [fetchTournamentData]);

  // Refresh leaderboard periodically during active tournament
  useEffect(() => {
    if (!tournament || tournament.status === 'completed') return;

    const interval = setInterval(() => {
      getOptionsTournamentLeaderboard(tournament.id)
        .then(setLeaderboard)
        .catch(console.error);
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [tournament]);

  // Submit entry to tournament
  const submitEntry = useCallback(async (contracts) => {
    if (!tournament || !userId || !username) {
      throw new Error('Missing required data for entry submission');
    }

    // Validate portfolio
    const validation = validateTournamentPortfolio(contracts);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    // Check if user can still enter
    const entryStatus = await canUserEnterTournament(tournament, userId);
    if (!entryStatus.canEnter) {
      throw new Error(entryStatus.reason);
    }

    setIsSubmitting(true);
    try {
      const totalEntry = contracts.reduce((sum, c) => sum + c.entryAmount, 0);

      const newEntry = await createOptionsEntry(
        tournament.id,
        userId,
        username,
        contracts,
        totalEntry
      );

      // Refresh data
      await fetchTournamentData();

      return newEntry;
    } finally {
      setIsSubmitting(false);
    }
  }, [tournament, userId, username, fetchTournamentData]);

  // Lock individual position
  const lockPosition = useCallback(async (entryId, contractId, currentValue) => {
    if (!tournament || tournament.status !== 'in_progress') {
      throw new Error('Can only lock positions during active tournament');
    }

    try {
      await lockOptionsPosition(entryId, contractId, currentValue);

      // Refresh user entries
      const entries = await getUserOptionsEntries(tournament.id, userId);
      setUserEntries(entries);

      return { success: true, lockedValue: currentValue };
    } catch (err) {
      console.error('Error locking position:', err);
      throw err;
    }
  }, [tournament, userId]);

  // Refresh all data
  const refresh = useCallback(() => {
    return fetchTournamentData();
  }, [fetchTournamentData]);

  // Derived state
  const userBestEntry = userEntries.length > 0
    ? userEntries.reduce((best, entry) => {
        if (!best) return entry;
        if (entry.rank && (!best.rank || entry.rank < best.rank)) return entry;
        return best;
      }, null)
    : null;

  const timeUntilLock = tournament?.lockDeadline
    ? Math.max(0, new Date(tournament.lockDeadline) - new Date())
    : null;

  const timeUntilEnd = tournament?.endDate
    ? Math.max(0, new Date(tournament.endDate) - new Date())
    : null;

  const isLockDeadlinePassed = timeUntilLock === 0;
  const isTournamentEnded = timeUntilEnd === 0;

  return {
    // State
    tournament,
    userEntries,
    leaderboard,
    canEnter,
    isLoading,
    error,
    isSubmitting,

    // Derived
    userBestEntry,
    timeUntilLock,
    timeUntilEnd,
    isLockDeadlinePassed,
    isTournamentEnded,
    hasEntries: userEntries.length > 0,
    entryCount: userEntries.length,

    // Actions
    submitEntry,
    lockPosition,
    refresh
  };
};

export default useOptionsTournament;
