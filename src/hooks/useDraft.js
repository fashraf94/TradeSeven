// /src/hooks/useDraft.js

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useDraft - Manages all draft-related state and logic
 *
 * @param {Object} user - Current user from UserContext
 * @param {string} screen - Current screen name
 * @param {Function} setScreen - Navigation function (optional, for redirects)
 * @returns {Object} Draft state and actions
 */
export const useDraft = (user, screen, setScreen = null) => {
  // ============================================
  // STATE (moved from App.jsx)
  // ============================================

  // Core draft state - Phase 2
  const [currentDraft, setCurrentDraft] = useState(null);
  const [draftJoinCode, setDraftJoinCode] = useState('');

  // Draft Lobby/Room state - Phase 3
  const [draftState, setDraftState] = useState(null);
  const [draftCopied, setDraftCopied] = useState(false);
  const [selectedDraftCategory, setSelectedDraftCategory] = useState('steady');
  const [draftTimeRemaining, setDraftTimeRemaining] = useState(120);
  const [draftAssetInfoModal, setDraftAssetInfoModal] = useState(null);

  // Draft Battle state - Phase 4
  const [draftBattleOpponent, setDraftBattleOpponent] = useState(null);

  // Draft Fixes state
  const [activeDraftBanner, setActiveDraftBanner] = useState(null);
  const [autopickCountdown, setAutopickCountdown] = useState(null);
  const [isRosterExpanded, setIsRosterExpanded] = useState(false);
  const [rosterTouchStart, setRosterTouchStart] = useState(null);
  const [rosterTouchEnd, setRosterTouchEnd] = useState(null);

  // Battle lists (draft-related)
  const [activeDraftBattles, setActiveDraftBattles] = useState([]);
  const [completedDraftBattles, setCompletedDraftBattles] = useState([]);

  // Loading states
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState(null);

  // Local absence detection (computed from lastSeen, no Firestore writes)
  const [currentPickerAbsent, setCurrentPickerAbsent] = useState(false);

  // Refs for cleanup
  const timerRef = useRef(null);
  const autopickRef = useRef(null);
  const presenceRef = useRef(null);

  // ============================================
  // EFFECTS (moved from App.jsx)
  // ============================================

  // Effect: Draft subscription - Phase 3
  useEffect(() => {
    if (!currentDraft?.id) return;
    if (screen !== 'draftLobby' && screen !== 'draftRoom') return;

    let unsubscribe = null;

    const loadDraftService = async () => {
      try {
        const draftService = await import('../services/draftService');
        unsubscribe = draftService.subscribeToDraft(currentDraft.id, (draft) => {
          if (draft) {
            setDraftState(draft);

            // Auto-navigate based on status changes
            if (draft.status === 'active' && screen === 'draftLobby' && setScreen) {
              setCurrentDraft(draft);
              setScreen('draftRoom');
            }
            if ((draft.status === 'completed' || draft.status === 'battle') && screen === 'draftRoom' && setScreen) {
              setCurrentDraft(draft);
              setScreen('draftResults');

              // Store locked prices when draft transitions to battle
              if (draft.status === 'battle' && !draft.lockedPrices) {
                draftService.storeDraftLockedPrices(draft.id).then(result => {
                  if (result.success) {
                    console.log('[useDraft] Locked prices stored for battle mode');
                  }
                }).catch(err => console.error('[useDraft] Failed to store locked prices:', err));
              }
            }
            if (draft.status === 'cancelled' && setScreen) {
              setScreen('dashboard');
            }
          }
        });
      } catch (error) {
        console.error('[useDraft] Failed to subscribe to draft:', error);
        setDraftError(error.message);
      }
    };

    loadDraftService();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentDraft?.id, screen, setScreen]);

  // Effect: Draft timer countdown - Phase 3
  useEffect(() => {
    if (screen !== 'draftRoom' || !draftState?.pickDeadline) return;

    const updateTimer = () => {
      const deadline = draftState.pickDeadline.toDate
        ? draftState.pickDeadline.toDate()
        : new Date(draftState.pickDeadline);
      const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setDraftTimeRemaining(remaining);
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [screen, draftState?.pickDeadline, draftState?.currentPlayerId]);

  // Effect: Timer-expired autopick - hard backstop when timer hits 0
  // Any client can trigger this (not just host), solving the host-leaves problem
  useEffect(() => {
    if (screen !== 'draftRoom') return;
    if (!draftState || draftState.status !== 'active') return;
    if (draftTimeRemaining > 0) return;

    const currentPlayer = draftState.players?.find(
      p => p.odUserId === draftState.currentPlayerId
    );

    // Skip if no current player or if CPU (handled by existing autopick)
    if (!currentPlayer || currentPlayer.isCPU) return;

    // Random delay (500-2500ms) to avoid race conditions from multiple clients
    const delay = Math.floor(Math.random() * 2000) + 500;
    const timerExpiredAutopick = setTimeout(async () => {
      try {
        const draftService = await import('../services/draftService');
        await draftService.handleAutopick(draftState.id, draftState.currentPlayerId);
      } catch (error) {
        // Race condition (another client picked) is expected - log quietly
        console.log('[useDraft] Timer-expired autopick attempted:', error.message);
      }
    }, delay);

    return () => clearTimeout(timerExpiredAutopick);
  }, [screen, draftState?.id, draftState?.status, draftState?.currentPlayerId, draftTimeRemaining]);

  // Effect: CPU/Absent player autopick with 3-second countdown
  useEffect(() => {
    if (screen !== 'draftRoom') return;
    if (!draftState || draftState.status !== 'active') return;

    const currentPlayer = draftState.players?.find(p => p.odUserId === draftState.currentPlayerId);
    // Use locally-computed absence (currentPickerAbsent) instead of Firestore isAbsent
    // to avoid race condition where concurrent presence writes overwrite the isAbsent flag
    const needsAutopick = currentPlayer?.isCPU || currentPlayer?.disconnected || currentPickerAbsent;

    if (needsAutopick) {
      // Show 3-second countdown
      setAutopickCountdown(3);

      const countdownInterval = setInterval(() => {
        setAutopickCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      // Trigger autopick after 3 seconds
      const autopickTimer = setTimeout(async () => {
        try {
          const draftService = await import('../services/draftService');
          await draftService.handleAutopick(draftState.id, draftState.currentPlayerId);
        } catch (error) {
          console.error('[useDraft] Autopick failed:', error);
        }
      }, 3000);

      return () => {
        clearInterval(countdownInterval);
        clearTimeout(autopickTimer);
        setAutopickCountdown(null);
      };
    } else {
      setAutopickCountdown(null);
    }
  }, [screen, draftState?.currentPlayerId, draftState?.status, draftState?.players, currentPickerAbsent]);

  // Effect: Presence heartbeat
  useEffect(() => {
    if (screen !== 'draftRoom' && screen !== 'draftLobby') return;
    if (!draftState?.id || draftState.status !== 'active') return;

    const currentUserId = user?.odUserId || user?.username;
    if (!currentUserId) return;

    const sendPresence = async () => {
      try {
        const draftService = await import('../services/draftService');
        await draftService.updatePlayerPresence(draftState.id, currentUserId);
      } catch (error) {
        console.error('[useDraft] Presence update failed:', error);
      }
    };

    // Send presence immediately and every 5 seconds
    sendPresence();
    presenceRef.current = setInterval(sendPresence, 5000);

    return () => {
      if (presenceRef.current) clearInterval(presenceRef.current);
    };
  }, [screen, draftState?.id, draftState?.status, user]);

  // Effect: Detect current picker absence locally (no Firestore writes)
  // Polls every 3 seconds and computes absence from lastSeen timestamps.
  // This avoids the race condition where concurrent updatePlayerPresence writes
  // overwrite the isAbsent flag set by checkAbsentPlayers.
  useEffect(() => {
    if (screen !== 'draftRoom') return;
    if (!draftState || draftState.status !== 'active') return;

    const ABSENCE_THRESHOLD_MS = 15000; // 15 seconds without heartbeat = absent

    const checkCurrentPickerAbsence = () => {
      const currentPlayer = draftState.players?.find(
        p => p.odUserId === draftState.currentPlayerId
      );

      // CPU players have their own autopick - don't flag as absent
      if (!currentPlayer || currentPlayer.isCPU) {
        setCurrentPickerAbsent(false);
        return;
      }

      // No lastSeen yet (just joined) - not absent
      if (!currentPlayer.lastSeen) {
        setCurrentPickerAbsent(false);
        return;
      }

      const lastSeenMs = new Date(currentPlayer.lastSeen).getTime();
      const timeSinceLastSeen = Date.now() - lastSeenMs;
      const isAbsent = timeSinceLastSeen > ABSENCE_THRESHOLD_MS;

      setCurrentPickerAbsent(isAbsent);
    };

    // Check immediately and every 3 seconds
    checkCurrentPickerAbsence();
    const interval = setInterval(checkCurrentPickerAbsence, 3000);

    return () => {
      clearInterval(interval);
      setCurrentPickerAbsent(false);
    };
  }, [screen, draftState?.status, draftState?.currentPlayerId, draftState?.players]);

  // Effect: Check for active draft on dashboard (rejoin functionality)
  useEffect(() => {
    if (screen !== 'dashboard') return;

    const checkActiveDraft = async () => {
      try {
        const draftService = await import('../services/draftService');
        const userId = user?.odUserId || user?.username;

        if (!userId) return;

        const activeDraft = await draftService.getUserActiveDraft(userId);
        setActiveDraftBanner(activeDraft);
      } catch (error) {
        console.error('[useDraft] Error checking active draft:', error);
        setActiveDraftBanner(null);
      }
    };

    checkActiveDraft();

    // Also check periodically in case draft status changes
    const checkInterval = setInterval(checkActiveDraft, 30000);

    return () => clearInterval(checkInterval);
  }, [screen, user]);

  // Effect: Browser close warning for active draft
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if ((screen === 'draftRoom' || screen === 'draftLobby') && draftState?.status === 'active') {
        e.preventDefault();
        e.returnValue = 'You have an active draft in progress. Leaving may result in autopicks.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [screen, draftState?.status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autopickRef.current) clearTimeout(autopickRef.current);
      if (presenceRef.current) clearInterval(presenceRef.current);
    };
  }, []);

  // ============================================
  // ACTIONS
  // ============================================

  const createDraft = useCallback(async (type = 'stocks', isTraining = false) => {
    if (!user) return null;

    setDraftLoading(true);
    setDraftError(null);

    try {
      const draftService = await import('../services/draftService');
      const userId = user.odUserId || user.username;
      const username = user.odUsername || user.username;

      let draft;
      if (isTraining) {
        draft = await draftService.createTrainingDraft(userId, username, type);
      } else {
        draft = await draftService.createMultiplayerDraft(userId, username, type);
      }

      setCurrentDraft(draft);
      setDraftState(draft);
      return draft;
    } catch (error) {
      console.error('[useDraft] Error creating draft:', error);
      setDraftError(error.message);
      return null;
    } finally {
      setDraftLoading(false);
    }
  }, [user]);

  const joinDraft = useCallback(async (code) => {
    if (!user || !code) return null;

    setDraftLoading(true);
    setDraftError(null);

    try {
      const draftService = await import('../services/draftService');
      const userId = user.odUserId || user.username;
      const username = user.odUsername || user.username;

      const draft = await draftService.joinDraftByCode(code, userId, username);

      setCurrentDraft(draft);
      setDraftState(draft);
      setDraftJoinCode('');
      return draft;
    } catch (error) {
      console.error('[useDraft] Error joining draft:', error);
      setDraftError(error.message);
      return null;
    } finally {
      setDraftLoading(false);
    }
  }, [user]);

  const makePick = useCallback(async (asset, isAutopick = false) => {
    if (!currentDraft?.id || !user) return false;

    try {
      const draftService = await import('../services/draftService');
      const userId = user.odUserId || user.username;

      await draftService.makePick(currentDraft.id, userId, asset, isAutopick);
      return true;
    } catch (error) {
      console.error('[useDraft] Error making pick:', error);
      setDraftError(error.message);
      return false;
    }
  }, [currentDraft?.id, user]);

  const startDraft = useCallback(async () => {
    if (!currentDraft?.id) return false;

    try {
      const draftService = await import('../services/draftService');
      await draftService.startDraft(currentDraft.id);
      return true;
    } catch (error) {
      console.error('[useDraft] Error starting draft:', error);
      setDraftError(error.message);
      return false;
    }
  }, [currentDraft?.id]);

  const leaveDraft = useCallback(async () => {
    if (!currentDraft?.id || !user) return false;

    try {
      const draftService = await import('../services/draftService');
      const userId = user.odUserId || user.username;

      await draftService.leaveDraft(currentDraft.id, userId);
      setCurrentDraft(null);
      setDraftState(null);
      return true;
    } catch (error) {
      console.error('[useDraft] Error leaving draft:', error);
      setDraftError(error.message);
      return false;
    }
  }, [currentDraft?.id, user]);

  const cancelDraft = useCallback(async () => {
    if (!currentDraft?.id) return false;

    try {
      const draftService = await import('../services/draftService');
      await draftService.cancelDraft(currentDraft.id);
      setCurrentDraft(null);
      setDraftState(null);
      return true;
    } catch (error) {
      console.error('[useDraft] Error cancelling draft:', error);
      setDraftError(error.message);
      return false;
    }
  }, [currentDraft?.id]);

  const rejoinDraft = useCallback(async (draft) => {
    setCurrentDraft(draft);
    setDraftState(draft);
    if (setScreen) {
      if (draft.status === 'waiting') {
        setScreen('draftLobby');
      } else if (draft.status === 'active') {
        setScreen('draftRoom');
      } else if (draft.status === 'completed' || draft.status === 'battle') {
        setScreen('draftResults');
      }
    }
  }, [setScreen]);

  const resetDraft = useCallback(() => {
    setCurrentDraft(null);
    setDraftState(null);
    setDraftJoinCode('');
    setDraftCopied(false);
    setSelectedDraftCategory('steady');
    setDraftTimeRemaining(120);
    setAutopickCountdown(null);
    setDraftError(null);
    setActiveDraftBanner(null);
    setDraftAssetInfoModal(null);
    setIsRosterExpanded(false);
  }, []);

  const copyDraftCode = useCallback(() => {
    if (!currentDraft?.code) return;
    navigator.clipboard.writeText(currentDraft.code);
    setDraftCopied(true);
    setTimeout(() => setDraftCopied(false), 2000);
  }, [currentDraft?.code]);

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const currentUserId = user?.odUserId || user?.username;
  const isMyTurn = draftState?.currentPlayerId === currentUserId;
  const isHost = currentDraft?.hostId === currentUserId;
  const isDrafting = draftState?.status === 'active';
  const isWaiting = draftState?.status === 'waiting';
  const isCompleted = draftState?.status === 'completed' || draftState?.status === 'battle';
  const isCancelled = draftState?.status === 'cancelled';

  const myPlayer = draftState?.players?.find(p => p.odUserId === currentUserId);
  const myPicks = myPlayer?.picks || [];
  const currentPicker = draftState?.players?.find(p => p.odUserId === draftState?.currentPlayerId);

  // ============================================
  // RETURN
  // ============================================

  return {
    // Core state
    currentDraft,
    setCurrentDraft,
    draftState,
    setDraftState,

    // Join flow
    draftJoinCode,
    setDraftJoinCode,
    draftCopied,
    copyDraftCode,

    // Draft room UI
    selectedDraftCategory,
    setSelectedDraftCategory,
    draftTimeRemaining,
    draftAssetInfoModal,
    setDraftAssetInfoModal,
    isRosterExpanded,
    setIsRosterExpanded,
    rosterTouchStart,
    setRosterTouchStart,
    rosterTouchEnd,
    setRosterTouchEnd,

    // Autopick
    autopickCountdown,
    activeDraftBanner,
    setActiveDraftBanner,

    // Battle opponent
    draftBattleOpponent,
    setDraftBattleOpponent,

    // Battle lists
    activeDraftBattles,
    setActiveDraftBattles,
    completedDraftBattles,
    setCompletedDraftBattles,

    // Loading/Error
    draftLoading,
    draftError,

    // Actions
    createDraft,
    joinDraft,
    makePick,
    startDraft,
    leaveDraft,
    cancelDraft,
    rejoinDraft,
    resetDraft,

    // Computed
    isMyTurn,
    isHost,
    isDrafting,
    isWaiting,
    isCompleted,
    isCancelled,
    myPlayer,
    myPicks,
    currentPicker
  };
};

export default useDraft;
