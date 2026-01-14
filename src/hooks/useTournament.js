// src/hooks/useTournament.js
// Hook for managing tournament state and actions

import { useState, useEffect, useCallback } from 'react';

// Lazy load Firebase to avoid circular dependencies
let firebaseService = null;

async function getFirebase() {
  if (!firebaseService) {
    const module = await import('../firebase/firebaseService');
    firebaseService = module.default || module;
  }
  return firebaseService;
}

/**
 * Hook for managing EarningsGame tournament state
 *
 * @param {string} userId - User's odUserId
 * @returns {Object} Tournament state and actions
 */
export function useTournament(userId) {
  const [tournament, setTournament] = useState(null);
  const [userEntry, setUserEntry] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load tournament and user entry on mount
  useEffect(() => {
    async function loadTournamentData() {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const fb = await getFirebase();

        // Get current tournament (creates if doesn't exist)
        const currentTournament = await fb.getCurrentTournament();
        setTournament(currentTournament);

        // Get user's entry if exists
        const entry = await fb.getUserTournamentEntry(userId);
        setUserEntry(entry);

        // Get leaderboard
        const lb = await fb.getTournamentLeaderboard(currentTournament.id, 50);
        setLeaderboard(lb);

        console.log('[useTournament] Loaded:', {
          tournament: currentTournament.id,
          hasEntry: !!entry,
          leaderboardSize: lb.length
        });

      } catch (err) {
        console.error('[useTournament] Error loading:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadTournamentData();
  }, [userId]);

  // Enter tournament with predictions
  const enterTournament = useCallback(async (predictions, username) => {
    if (!userId) {
      setError('Not logged in');
      return false;
    }

    if (!tournament) {
      setError('No active tournament');
      return false;
    }

    try {
      setError(null);
      const fb = await getFirebase();
      const entry = await fb.enterTournament(userId, username || userId, predictions);
      setUserEntry(entry);

      // Refresh leaderboard
      const lb = await fb.getTournamentLeaderboard(tournament.id, 50);
      setLeaderboard(lb);

      console.log('[useTournament] Entered tournament:', entry.entryId);
      return true;
    } catch (err) {
      console.error('[useTournament] Error entering:', err);
      setError(err.message);
      return false;
    }
  }, [userId, tournament]);

  // Refresh leaderboard
  const refreshLeaderboard = useCallback(async () => {
    if (!tournament) return;

    try {
      const fb = await getFirebase();
      const lb = await fb.getTournamentLeaderboard(tournament.id, 50);
      setLeaderboard(lb);
    } catch (err) {
      console.error('[useTournament] Error refreshing leaderboard:', err);
    }
  }, [tournament]);

  // Refresh user entry
  const refreshUserEntry = useCallback(async () => {
    if (!userId) return;

    try {
      const fb = await getFirebase();
      const entry = await fb.getUserTournamentEntry(userId);
      setUserEntry(entry);
    } catch (err) {
      console.error('[useTournament] Error refreshing entry:', err);
    }
  }, [userId]);

  // Check if deadline has passed
  const isDeadlinePassed = tournament
    ? new Date() > new Date(tournament.lockDeadline)
    : false;

  // Get user's rank from leaderboard
  const userRank = userEntry
    ? leaderboard.findIndex(e => e.odUserId === userId) + 1
    : null;

  // Calculate bracket based on rank
  const getBracket = (rank, total) => {
    if (!rank || !total || rank === 0) return null;
    if (rank === 1) return { name: 'Diamond', emoji: '💎', color: '#b9f2ff', tier: 'diamond' };
    if (rank <= 3) return { name: 'Gold', emoji: '🥇', color: '#ffd700', tier: 'gold' };
    if (rank <= Math.ceil(total * 0.1)) return { name: 'Silver', emoji: '🥈', color: '#c0c0c0', tier: 'silver' };
    if (rank <= Math.ceil(total * 0.25)) return { name: 'Bronze', emoji: '🥉', color: '#cd7f32', tier: 'bronze' };
    return { name: 'Participant', emoji: '🎮', color: '#8b949e', tier: 'participant' };
  };

  // Format deadline for display
  const formatDeadline = () => {
    if (!tournament?.lockDeadline) return null;
    const deadline = new Date(tournament.lockDeadline);
    const now = new Date();
    const diff = deadline - now;

    if (diff <= 0) return 'Locked';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }

    return `${hours}h ${minutes}m`;
  };

  return {
    // State
    tournament,
    userEntry,
    leaderboard,
    isLoading,
    error,

    // Computed
    isDeadlinePassed,
    userRank: userRank || null,
    userBracket: getBracket(userRank, leaderboard.length),
    hasEntered: !!userEntry,
    deadlineFormatted: formatDeadline(),
    entryCount: tournament?.entryCount || leaderboard.length,

    // Actions
    enterTournament,
    refreshLeaderboard,
    refreshUserEntry,

    // Helpers
    getBracket
  };
}

export default useTournament;
