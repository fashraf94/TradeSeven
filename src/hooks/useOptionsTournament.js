// src/hooks/useOptionsTournament.js
// React hook for managing Options Tournament state in the UI

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../firebase/config';
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

  // Track previous ranks for visual change indicators
  const previousRanksRef = useRef({});
  const rankChangeClearTimeoutRef = useRef(null);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tournament history state
  const [tournamentHistory, setTournamentHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Fetch tournament data
  const fetchTournamentData = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get current tournament
      let currentTournament = await getCurrentOptionsTournament();

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

  // Real-time leaderboard subscription using Firebase onSnapshot
  useEffect(() => {
    if (!tournament?.id) {
      setLeaderboard([]);
      return;
    }

    // For completed tournaments, use one-time fetch instead of real-time
    if (tournament.status === 'completed') {
      fetchLeaderboardOnce(tournament.id);
      return;
    }

    // Only subscribe when tournament is active or open
    if (tournament.status !== 'in_progress' && tournament.status !== 'open') {
      return;
    }

    console.log('[useOptionsTournament] Setting up real-time leaderboard for:', tournament.id);

    const entriesRef = collection(db, 'optionsEntries');
    const q = query(
      entriesRef,
      where('tournamentId', '==', tournament.id)
    );

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const entries = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Sort by percentReturn descending, then by entry time (tiebreaker)
        const sorted = entries.sort((a, b) => {
          const aReturn = a.results?.percentReturn ?? 0;
          const bReturn = b.results?.percentReturn ?? 0;
          if (bReturn !== aReturn) return bReturn - aReturn;
          // Tiebreaker: earlier entry wins
          return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
        });

        // Add rank and detect rank changes
        const ranked = sorted.map((entry, index) => {
          const newRank = index + 1;
          const prevRank = previousRanksRef.current[entry.id];

          let rankChange = 0;
          if (prevRank !== undefined && prevRank !== newRank) {
            rankChange = prevRank - newRank; // Positive = moved up, Negative = moved down
          }

          return {
            ...entry,
            rank: newRank,
            rankChange,
            isNew: prevRank === undefined && Object.keys(previousRanksRef.current).length > 0,
            // Map fields for LeaderboardModal compatibility
            percentReturn: entry.results?.percentReturn ?? 0,
            totalValue: entry.results?.totalValue ?? null,
            contractCount: entry.contracts?.length || 0
          };
        });

        // Update previous ranks for next comparison
        const newPreviousRanks = {};
        ranked.forEach(entry => {
          newPreviousRanks[entry.id] = entry.rank;
        });
        previousRanksRef.current = newPreviousRanks;

        setLeaderboard(ranked);

        // Clear rank change indicators after 3 seconds
        if (rankChangeClearTimeoutRef.current) {
          clearTimeout(rankChangeClearTimeoutRef.current);
        }
        rankChangeClearTimeoutRef.current = setTimeout(() => {
          setLeaderboard(prev => prev.map(entry => ({
            ...entry,
            rankChange: 0,
            isNew: false
          })));
        }, 3000);
      },
      (error) => {
        console.error('[useOptionsTournament] Leaderboard subscription error:', error);
        // Fallback to one-time fetch on error
        fetchLeaderboardOnce(tournament.id);
      }
    );

    // Cleanup subscription on unmount or tournament change
    return () => {
      console.log('[useOptionsTournament] Cleaning up leaderboard subscription');
      unsubscribe();
      if (rankChangeClearTimeoutRef.current) {
        clearTimeout(rankChangeClearTimeoutRef.current);
      }
    };
  }, [tournament?.id, tournament?.status]);

  // Fallback fetch function for completed tournaments or errors
  const fetchLeaderboardOnce = async (tournamentId) => {
    try {
      const entriesRef = collection(db, 'optionsEntries');
      const q = query(entriesRef, where('tournamentId', '==', tournamentId));
      const snapshot = await getDocs(q);

      const entries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const sorted = entries.sort((a, b) => {
        const aReturn = a.results?.percentReturn ?? 0;
        const bReturn = b.results?.percentReturn ?? 0;
        return bReturn - aReturn;
      });

      const ranked = sorted.map((entry, index) => ({
        ...entry,
        rank: index + 1,
        rankChange: 0,
        isNew: false,
        percentReturn: entry.results?.percentReturn ?? 0,
        totalValue: entry.results?.totalValue ?? null,
        contractCount: entry.contracts?.length || 0
      }));

      setLeaderboard(ranked);
    } catch (error) {
      console.error('[useOptionsTournament] Fallback fetch error:', error);
    }
  };

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

      // Refresh data after submission
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

  // Fetch tournament history for past results
  const fetchTournamentHistory = useCallback(async (historyUserId) => {
    const targetUserId = historyUserId || userId;
    if (!targetUserId) return;

    setHistoryLoading(true);
    try {
      // Get completed tournaments (last 10)
      const tournamentsRef = collection(db, 'optionsTournaments');
      const q = query(
        tournamentsRef,
        where('status', '==', 'completed'),
        orderBy('endDate', 'desc'),
        limit(10)
      );

      const tournamentsSnap = await getDocs(q);
      const tournaments = tournamentsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // For each tournament, get user's entry (if any)
      const historyWithUserData = await Promise.all(
        tournaments.map(async (tournament) => {
          // Query user's entries for this tournament
          const entriesRef = collection(db, 'optionsEntries');
          const entryQuery = query(
            entriesRef,
            where('tournamentId', '==', tournament.id),
            where('odUserId', '==', targetUserId)
          );

          const entriesSnap = await getDocs(entryQuery);
          const userEntries = entriesSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          // Get total participants count
          const allEntriesQuery = query(
            entriesRef,
            where('tournamentId', '==', tournament.id)
          );
          const allEntriesSnap = await getDocs(allEntriesQuery);

          return {
            ...tournament,
            userEntries,
            totalParticipants: allEntriesSnap.size,
            userBestRank: userEntries.length > 0
              ? Math.min(...userEntries.map(e => e.rank || 999))
              : null,
            userBestReturn: userEntries.length > 0
              ? Math.max(...userEntries.map(e => e.results?.percentReturn || 0))
              : null
          };
        })
      );

      setTournamentHistory(historyWithUserData);
    } catch (error) {
      console.error('[useOptionsTournament] Error fetching tournament history:', error);
    } finally {
      setHistoryLoading(false);
    }
  }, [userId]);

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
    refresh,

    // History
    tournamentHistory,
    historyLoading,
    fetchTournamentHistory
  };
};

export default useOptionsTournament;
