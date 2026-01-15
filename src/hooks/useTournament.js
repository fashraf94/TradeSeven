// src/hooks/useTournament.js
// Hook for managing tournament state and actions
// Updated for multi-entry support (up to 3 entries per user)

import { useState, useEffect, useCallback, useMemo } from 'react';

// Lazy load Firebase to avoid circular dependencies
let firebaseService = null;

async function getFirebase() {
  if (!firebaseService) {
    const module = await import('../firebase/firebaseService');
    firebaseService = module.default || module;
  }
  return firebaseService;
}

// Constants
const MAX_ENTRIES_PER_USER = 3;

/**
 * Hook for managing EarningsGame tournament state
 * Now supports multiple entries per user
 *
 * @param {string} userId - User's odUserId
 * @returns {Object} Tournament state and actions
 */
export function useTournament(userId) {
  const [tournament, setTournament] = useState(null);
  const [userEntries, setUserEntries] = useState([]); // Array of entries
  const [activeEntryId, setActiveEntryId] = useState(null); // Currently selected entry
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load tournament and user entries on mount
  useEffect(() => {
    async function loadTournamentData() {
      console.log('[useTournament] Loading for userId:', userId);

      if (!userId) {
        console.log('[useTournament] No userId, skipping load');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const fb = await getFirebase();
        console.log('[useTournament] Firebase loaded, calling getCurrentTournament...');

        // Get current tournament (creates if doesn't exist)
        const currentTournament = await fb.getCurrentTournament();
        console.log('[useTournament] Tournament loaded:', currentTournament);
        setTournament(currentTournament);

        // Get all user entries for this tournament
        let entries = [];
        if (fb.getUserEntriesForTournament) {
          entries = await fb.getUserEntriesForTournament(currentTournament.id, userId);
        } else {
          // Fallback to old single-entry method
          const entry = await fb.getUserTournamentEntry(userId);
          if (entry) entries = [entry];
        }

        console.log('[useTournament] User entries:', entries.length);
        setUserEntries(entries);

        // Set active entry to first one if exists
        if (entries.length > 0 && !activeEntryId) {
          setActiveEntryId(entries[0].entryId);
        }

        // Get leaderboard
        const lb = await fb.getTournamentLeaderboard(currentTournament.id, 50);
        console.log('[useTournament] Leaderboard loaded:', lb?.length, 'entries');
        setLeaderboard(lb);

        console.log('[useTournament] Load complete:', {
          tournament: currentTournament.id,
          entriesCount: entries.length,
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

  // Get the currently active entry
  const activeEntry = useMemo(() => {
    if (!activeEntryId || userEntries.length === 0) return null;
    return userEntries.find(e => e.entryId === activeEntryId) || userEntries[0];
  }, [activeEntryId, userEntries]);

  // Backward compatibility: userEntry returns the best entry (highest points)
  const userEntry = useMemo(() => {
    if (userEntries.length === 0) return null;
    return [...userEntries].sort((a, b) => {
      const aPoints = a.results?.totalPoints || 0;
      const bPoints = b.results?.totalPoints || 0;
      return bPoints - aPoints;
    })[0];
  }, [userEntries]);

  // Create a new tournament entry
  const createEntry = useCallback(async (predictions, username) => {
    if (!userId) {
      setError('Not logged in');
      return { success: false, error: 'Not logged in' };
    }

    if (!tournament) {
      setError('No active tournament');
      return { success: false, error: 'No active tournament' };
    }

    if (userEntries.length >= MAX_ENTRIES_PER_USER) {
      setError(`Maximum ${MAX_ENTRIES_PER_USER} entries allowed`);
      return { success: false, error: `Maximum ${MAX_ENTRIES_PER_USER} entries allowed` };
    }

    try {
      setError(null);
      const fb = await getFirebase();

      // Use new multi-entry function if available
      let entry;
      if (fb.createTournamentEntry) {
        entry = await fb.createTournamentEntry(userId, username || userId, predictions);
      } else {
        // Fallback to old method
        entry = await fb.enterTournament(userId, username || userId, predictions);
      }

      // Update local state
      setUserEntries(prev => [...prev, entry]);
      setActiveEntryId(entry.entryId);

      // Refresh leaderboard
      const lb = await fb.getTournamentLeaderboard(tournament.id, 50);
      setLeaderboard(lb);

      console.log('[useTournament] Created entry:', entry.entryId);
      return { success: true, entry };
    } catch (err) {
      console.error('[useTournament] Error creating entry:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, [userId, tournament, userEntries.length]);

  // Legacy: Enter tournament (uses createEntry for first entry)
  const enterTournament = useCallback(async (predictions, username) => {
    const result = await createEntry(predictions, username);
    return result.success;
  }, [createEntry]);

  // Update an existing entry's predictions
  const updateEntry = useCallback(async (entryId, predictions) => {
    if (!entryId || !predictions) {
      setError('Entry ID and predictions required');
      return { success: false, error: 'Entry ID and predictions required' };
    }

    try {
      setError(null);
      const fb = await getFirebase();

      if (fb.updateTournamentEntry) {
        await fb.updateTournamentEntry(entryId, predictions);
      }

      // Update local state
      setUserEntries(prev => prev.map(e => {
        if (e.entryId !== entryId) return e;
        return {
          ...e,
          predictions,
          totalSpent: predictions.reduce((sum, p) => sum + (p.price || 0), 0),
          totalPotentialPoints: predictions.reduce((sum, p) => sum + (p.potentialPayout || 0), 0),
          predictionCount: predictions.length
        };
      }));

      console.log('[useTournament] Updated entry:', entryId);
      return { success: true };
    } catch (err) {
      console.error('[useTournament] Error updating entry:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  // Delete an entry
  const deleteEntry = useCallback(async (entryId) => {
    if (!entryId) {
      setError('Entry ID required');
      return { success: false, error: 'Entry ID required' };
    }

    try {
      setError(null);
      const fb = await getFirebase();

      if (fb.deleteTournamentEntry) {
        await fb.deleteTournamentEntry(entryId);
      }

      // Update local state
      setUserEntries(prev => prev.filter(e => e.entryId !== entryId));

      // Update active entry if deleted
      if (activeEntryId === entryId) {
        const remaining = userEntries.filter(e => e.entryId !== entryId);
        setActiveEntryId(remaining.length > 0 ? remaining[0].entryId : null);
      }

      // Refresh leaderboard
      if (tournament) {
        const lb = await fb.getTournamentLeaderboard(tournament.id, 50);
        setLeaderboard(lb);
      }

      console.log('[useTournament] Deleted entry:', entryId);
      return { success: true };
    } catch (err) {
      console.error('[useTournament] Error deleting entry:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, [activeEntryId, tournament, userEntries]);

  // Switch active entry
  const selectEntry = useCallback((entryId) => {
    const entry = userEntries.find(e => e.entryId === entryId);
    if (entry) {
      setActiveEntryId(entryId);
      console.log('[useTournament] Selected entry:', entryId);
    }
  }, [userEntries]);

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

  // Refresh user entries
  const refreshUserEntries = useCallback(async () => {
    if (!userId || !tournament) return;

    try {
      const fb = await getFirebase();
      let entries = [];
      if (fb.getUserEntriesForTournament) {
        entries = await fb.getUserEntriesForTournament(tournament.id, userId);
      } else {
        const entry = await fb.getUserTournamentEntry(userId);
        if (entry) entries = [entry];
      }
      setUserEntries(entries);
    } catch (err) {
      console.error('[useTournament] Error refreshing entries:', err);
    }
  }, [userId, tournament]);

  // Legacy alias
  const refreshUserEntry = refreshUserEntries;

  // Check if deadline has passed
  const isDeadlinePassed = tournament
    ? new Date() > new Date(tournament.lockDeadline)
    : false;

  // Get user's best rank from all entries
  const userRank = useMemo(() => {
    if (userEntries.length === 0) return null;

    // Find the best ranked entry
    let bestRank = Infinity;
    userEntries.forEach(entry => {
      const rank = leaderboard.findIndex(e => e.entryId === entry.entryId) + 1;
      if (rank > 0 && rank < bestRank) {
        bestRank = rank;
      }
    });

    return bestRank === Infinity ? null : bestRank;
  }, [userEntries, leaderboard]);

  // Calculate bracket based on rank
  const getBracket = useCallback((rank, total) => {
    if (!rank || !total || rank === 0) return null;
    if (rank === 1) return { name: 'Diamond', emoji: '💎', color: '#00ffff', tier: 'diamond' };
    if (rank <= 3) return { name: 'Platinum', emoji: '⚪', color: '#e5e4e2', tier: 'platinum' };
    if (rank <= Math.ceil(total * 0.10)) return { name: 'Gold', emoji: '🥇', color: '#ffd700', tier: 'gold' };
    if (rank <= Math.ceil(total * 0.25)) return { name: 'Silver', emoji: '🥈', color: '#c0c0c0', tier: 'silver' };
    if (rank <= Math.ceil(total * 0.50)) return { name: 'Bronze', emoji: '🥉', color: '#cd7f32', tier: 'bronze' };
    return { name: 'Participant', emoji: '🎮', color: '#8b949e', tier: 'participant' };
  }, []);

  // Get medal for rank
  const getMedal = useCallback((rank) => {
    if (!rank) return null;
    if (rank === 1) return { type: 'gold', icon: '🥇', label: '1st Place', color: '#FFD700' };
    if (rank === 2) return { type: 'silver', icon: '🥈', label: '2nd Place', color: '#C0C0C0' };
    if (rank === 3) return { type: 'bronze', icon: '🥉', label: '3rd Place', color: '#CD7F32' };
    if (rank <= 10) return { type: 'top10', icon: '🏅', label: 'Top 10', color: '#00d9ff' };
    return null;
  }, []);

  // Format deadline for display
  const formatDeadline = useCallback(() => {
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
  }, [tournament]);

  // Can create more entries?
  const canCreateEntry = useMemo(() => {
    return !isDeadlinePassed && userEntries.length < MAX_ENTRIES_PER_USER;
  }, [isDeadlinePassed, userEntries.length]);

  return {
    // State
    tournament,
    userEntry, // Best entry (backward compat)
    userEntries, // All entries
    activeEntry, // Currently selected entry
    activeEntryId,
    leaderboard,
    isLoading,
    error,

    // Constants
    MAX_ENTRIES_PER_USER,

    // Computed
    isDeadlinePassed,
    userRank: userRank || null,
    userBracket: getBracket(userRank, leaderboard.length),
    userMedal: getMedal(userRank),
    hasEntered: userEntries.length > 0,
    canCreateEntry,
    entriesCount: userEntries.length,
    deadlineFormatted: formatDeadline(),
    entryCount: tournament?.entryCount || leaderboard.length,

    // Actions - Multi-entry
    createEntry,
    updateEntry,
    deleteEntry,
    selectEntry,
    refreshUserEntries,

    // Actions - Legacy (backward compat)
    enterTournament,
    refreshLeaderboard,
    refreshUserEntry,

    // Helpers
    getBracket,
    getMedal
  };
}

export default useTournament;
