// /src/hooks/useChallenges.js

import { useState, useEffect, useCallback } from 'react';

/**
 * useChallenges - Manages challenge system state
 *
 * @param {Object} user - Current user from UserContext
 * @returns {Object} Challenge state and actions
 */
export const useChallenges = (user) => {
  // ============================================
  // STATE (moved from App.jsx)
  // ============================================

  // In-battle challenges (Double Down, Market Close)
  const [userChallenges, setUserChallenges] = useState({ doubleDown: null, marketClose: null });
  const [opponentChallenges, setOpponentChallenges] = useState({ doubleDown: null, marketClose: null });
  const [openChallengePanels, setOpenChallengePanels] = useState(new Set());

  // Weekly challenges
  const [showWeeklyChallenges, setShowWeeklyChallenges] = useState(false);
  const [weeklyChallenges, setWeeklyChallenges] = useState([]);
  const [activeDailyChallenge, setActiveDailyChallenge] = useState(null);
  const [challengeProgress, setChallengeProgress] = useState({});
  const [completedWeeklyChallenges, setCompletedWeeklyChallenges] = useState([]);
  const [weeklyChallengesChecked, setWeeklyChallengesChecked] = useState(false);
  const [challengeHistory, setChallengeHistory] = useState([]);

  // Slot machine UI
  const [showSlotMachine, setShowSlotMachine] = useState(false);
  const [slotMachineRevealed, setSlotMachineRevealed] = useState(false);

  // Challenge expansion
  const [expandedChallengeId, setExpandedChallengeId] = useState(null);

  // Challenge toast
  const [showChallengeToast, setShowChallengeToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Mid-Game Challenge System
  const [midGameChallengePopup, setMidGameChallengePopup] = useState(null);
  const [earnedMidGameChallenges, setEarnedMidGameChallenges] = useState({});

  // Interactive Risk Challenges System
  const [activeRiskChallenge, setActiveRiskChallenge] = useState(null);
  const [showRiskChallengePopup, setShowRiskChallengePopup] = useState(false);
  const [riskChallengeResult, setRiskChallengeResult] = useState(null);
  const [triggeredRiskChallenges, setTriggeredRiskChallenges] = useState({});

  // Loading
  const [challengesLoading, setChallengesLoading] = useState(false);

  // ============================================
  // EFFECTS
  // ============================================

  // Load weekly challenges when user changes
  useEffect(() => {
    if (!user?.username) return;

    const loadChallenges = async () => {
      setChallengesLoading(true);
      try {
        // Try to load from localStorage first
        const savedChallenges = localStorage.getItem('weeklyChallenges');
        if (savedChallenges) {
          setWeeklyChallenges(JSON.parse(savedChallenges));
        }
      } catch (error) {
        console.error('[useChallenges] Error loading challenges:', error);
      } finally {
        setChallengesLoading(false);
      }
    };

    loadChallenges();
  }, [user?.username]);

  // Persist weekly challenges
  useEffect(() => {
    if (weeklyChallenges.length > 0) {
      localStorage.setItem('weeklyChallenges', JSON.stringify(weeklyChallenges));
    }
  }, [weeklyChallenges]);

  // ============================================
  // ACTIONS
  // ============================================

  const acceptChallenge = useCallback(async (challengeId, battleId) => {
    try {
      const challengeService = await import('../services/challengeService');
      // Implementation depends on challenge type
      setChallengeProgress(prev => ({
        ...prev,
        [challengeId]: { ...prev[challengeId], accepted: true }
      }));
      return true;
    } catch (error) {
      console.error('[useChallenges] Error accepting challenge:', error);
      return false;
    }
  }, []);

  const completeChallenge = useCallback(async (challengeId) => {
    try {
      setCompletedWeeklyChallenges(prev => [...prev, challengeId]);
      setWeeklyChallenges(prev =>
        prev.map(c => c.id === challengeId ? { ...c, completed: true } : c)
      );
      return true;
    } catch (error) {
      console.error('[useChallenges] Error completing challenge:', error);
      return false;
    }
  }, []);

  const activateRiskChallenge = useCallback((challenge) => {
    setActiveRiskChallenge(challenge);
    setShowRiskChallengePopup(true);
  }, []);

  const dismissRiskChallenge = useCallback(() => {
    setShowRiskChallengePopup(false);
    setActiveRiskChallenge(null);
  }, []);

  const toggleWeeklyChallenges = useCallback(() => {
    setShowWeeklyChallenges(prev => !prev);
  }, []);

  const toggleChallengePanel = useCallback((panelId) => {
    setOpenChallengePanels(prev => {
      const next = new Set(prev);
      if (next.has(panelId)) {
        next.delete(panelId);
      } else {
        next.add(panelId);
      }
      return next;
    });
  }, []);

  const expandChallenge = useCallback((challengeId) => {
    setExpandedChallengeId(prev => prev === challengeId ? null : challengeId);
  }, []);

  const showToast = useCallback((message) => {
    setToastMessage(message);
    setShowChallengeToast(true);
    setTimeout(() => setShowChallengeToast(false), 4000);
  }, []);

  const triggerMidGameChallenge = useCallback((challenge) => {
    setMidGameChallengePopup(challenge);
  }, []);

  const dismissMidGameChallenge = useCallback(() => {
    setMidGameChallengePopup(null);
  }, []);

  const recordMidGameChallengeEarned = useCallback((battleId, challengeId) => {
    setEarnedMidGameChallenges(prev => ({
      ...prev,
      [battleId]: [...(prev[battleId] || []), challengeId]
    }));
  }, []);

  const setRiskChallengeTriggered = useCallback((battleId, triggerPercent) => {
    setTriggeredRiskChallenges(prev => ({
      ...prev,
      [battleId]: [...(prev[battleId] || []), triggerPercent]
    }));
  }, []);

  const hasRiskChallengeTriggered = useCallback((battleId, triggerPercent) => {
    return triggeredRiskChallenges[battleId]?.includes(triggerPercent) || false;
  }, [triggeredRiskChallenges]);

  const resetChallenges = useCallback(() => {
    setUserChallenges({ doubleDown: null, marketClose: null });
    setOpponentChallenges({ doubleDown: null, marketClose: null });
    setOpenChallengePanels(new Set());
    setMidGameChallengePopup(null);
    setActiveRiskChallenge(null);
    setShowRiskChallengePopup(false);
    setRiskChallengeResult(null);
  }, []);

  const resetBattleChallenges = useCallback((battleId) => {
    setUserChallenges({ doubleDown: null, marketClose: null });
    setOpponentChallenges({ doubleDown: null, marketClose: null });
    setOpenChallengePanels(new Set());
    // Keep mid-game and risk challenges as they're battle-specific history
  }, []);

  // ============================================
  // RETURN
  // ============================================

  return {
    // In-battle challenges
    userChallenges,
    setUserChallenges,
    opponentChallenges,
    setOpponentChallenges,
    openChallengePanels,
    setOpenChallengePanels,
    toggleChallengePanel,

    // Weekly challenges
    showWeeklyChallenges,
    setShowWeeklyChallenges,
    toggleWeeklyChallenges,
    weeklyChallenges,
    setWeeklyChallenges,
    activeDailyChallenge,
    setActiveDailyChallenge,
    challengeProgress,
    setChallengeProgress,
    completedWeeklyChallenges,
    setCompletedWeeklyChallenges,
    weeklyChallengesChecked,
    setWeeklyChallengesChecked,
    challengeHistory,
    setChallengeHistory,

    // Slot machine
    showSlotMachine,
    setShowSlotMachine,
    slotMachineRevealed,
    setSlotMachineRevealed,

    // Challenge expansion
    expandedChallengeId,
    setExpandedChallengeId,
    expandChallenge,

    // Toast
    showChallengeToast,
    setShowChallengeToast,
    toastMessage,
    setToastMessage,
    showToast,

    // Mid-game challenges
    midGameChallengePopup,
    setMidGameChallengePopup,
    triggerMidGameChallenge,
    dismissMidGameChallenge,
    earnedMidGameChallenges,
    setEarnedMidGameChallenges,
    recordMidGameChallengeEarned,

    // Risk challenges
    activeRiskChallenge,
    setActiveRiskChallenge,
    showRiskChallengePopup,
    setShowRiskChallengePopup,
    activateRiskChallenge,
    dismissRiskChallenge,
    riskChallengeResult,
    setRiskChallengeResult,
    triggeredRiskChallenges,
    setTriggeredRiskChallenges,
    setRiskChallengeTriggered,
    hasRiskChallengeTriggered,

    // Loading
    challengesLoading,

    // Actions
    acceptChallenge,
    completeChallenge,
    resetChallenges,
    resetBattleChallenges
  };
};

export default useChallenges;
