// /src/hooks/useBattles.js

import { useState, useEffect, useCallback } from 'react';
import { loadBattlesSafe, saveBattlesSafe } from '../services/LocalStorage';
import { isParticipant, getUsername } from '../utils/battleHelpers';

/**
 * useBattles - Manages battle state, subscriptions, and persistence
 *
 * @param {Object} user - Current user from UserContext
 * @returns {Object} Battle state and actions
 */
export const useBattles = (user) => {
  // ============================================
  // STATE (moved from App.jsx)
  // ============================================

  const [battles, setBattles] = useState([]);
  const [currentBattle, setCurrentBattle] = useState(null);
  const [activeBattleId, setActiveBattleId] = useState(null);
  const [currentBattleIndex, setCurrentBattleIndex] = useState(0);

  // Previous battles (archived)
  const [previousBattles, setPreviousBattles] = useState([]);
  const [showPreviousBattles, setShowPreviousBattles] = useState(false);
  const [selectedPreviousBattle, setSelectedPreviousBattle] = useState(null);

  // Training battles
  const [activeTrainingBattles, setActiveTrainingBattles] = useState([]);
  const [completedTrainingBattles, setCompletedTrainingBattles] = useState([]);
  const [loadingTrainingBattles, setLoadingTrainingBattles] = useState(false);

  // Price tracking
  const [battlePrices, setBattlePrices] = useState({});
  const [loadingBattlePrices, setLoadingBattlePrices] = useState(false);

  // Loading states
  const [battlesLoading, setBattlesLoading] = useState(true);
  const [battlesError, setBattlesError] = useState(null);

  // ============================================
  // EFFECTS
  // ============================================

  // Load battles from localStorage on mount
  useEffect(() => {
    const savedBattles = loadBattlesSafe();
    if (savedBattles?.length) {
      setBattles(savedBattles);
    }
    setBattlesLoading(false);
  }, []);

  // Persist battles to localStorage
  useEffect(() => {
    if (battles.length > 0) {
      saveBattlesSafe(battles);
    }
  }, [battles]);

  // Firebase subscription for real-time battle updates
  useEffect(() => {
    if (!user?.odUserId && !user?.username) return;

    const userId = user.odUserId || user.username;

    let unsubscribe = null;

    const loadFirebaseService = async () => {
      try {
        const firebaseService = await import('../firebase/firebaseService');
        unsubscribe = firebaseService.subscribeToBattles(userId, (updatedBattles) => {
          setBattles(prev => {
            // Merge Firebase battles with local battles
            const merged = [...prev];
            for (const battle of updatedBattles) {
              const index = merged.findIndex(b => b.id === battle.id);
              if (index >= 0) {
                merged[index] = battle;
              } else {
                merged.push(battle);
              }
            }
            return merged;
          });
        });
      } catch (error) {
        console.error('[useBattles] Failed to subscribe to battles:', error);
        setBattlesError(error.message);
      }
    };

    loadFirebaseService();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.odUserId, user?.username]);

  // ============================================
  // COMPUTED
  // ============================================

  const username = user?.username || user?.odUsername;

  const userBattles = battles.filter(b => isParticipant(b, username));

  const activeBattles = userBattles.filter(b =>
    b.status === 'active' || b.status === 'pending' || b.status === 'accepted'
  );

  const pendingBattles = userBattles.filter(b =>
    b.status === 'pending' && getUsername(b.creator) === username
  );

  const completedBattles = userBattles.filter(b => b.status === 'completed');

  // ============================================
  // ACTIONS
  // ============================================

  const createBattle = useCallback(async (battleData) => {
    try {
      const firebaseService = await import('../firebase/firebaseService');
      const battle = await firebaseService.createBattle(battleData);
      setBattles(prev => [...prev, battle]);
      return battle;
    } catch (error) {
      console.error('[useBattles] Error creating battle:', error);
      setBattlesError(error.message);
      return null;
    }
  }, []);

  const createBaggerBombBattle = useCallback(async (battleData) => {
    try {
      const firebaseService = await import('../firebase/firebaseService');
      const battle = await firebaseService.createBaggerBombBattle(battleData);
      setBattles(prev => [...prev, battle]);
      return battle;
    } catch (error) {
      console.error('[useBattles] Error creating BaggerBomb battle:', error);
      setBattlesError(error.message);
      return null;
    }
  }, []);

  const createTrainingBattle = useCallback(async (battleData) => {
    try {
      const firebaseService = await import('../firebase/firebaseService');
      const battle = await firebaseService.createTrainingBattle(battleData);
      setBattles(prev => [...prev, battle]);
      return battle;
    } catch (error) {
      console.error('[useBattles] Error creating training battle:', error);
      setBattlesError(error.message);
      return null;
    }
  }, []);

  const joinBattle = useCallback(async (code, userData) => {
    try {
      const firebaseService = await import('../firebase/firebaseService');
      const battle = await firebaseService.joinBattle(code, userData);
      setBattles(prev => {
        const index = prev.findIndex(b => b.challengeCode === code || b.id === battle.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = battle;
          return updated;
        }
        return [...prev, battle];
      });
      return battle;
    } catch (error) {
      console.error('[useBattles] Error joining battle:', error);
      setBattlesError(error.message);
      return null;
    }
  }, []);

  const joinBaggerBombBattle = useCallback(async (code, userData) => {
    try {
      const firebaseService = await import('../firebase/firebaseService');
      const battle = await firebaseService.joinBaggerBombBattle(code, userData);
      setBattles(prev => {
        const index = prev.findIndex(b => b.challengeCode === code || b.id === battle.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = battle;
          return updated;
        }
        return [...prev, battle];
      });
      return battle;
    } catch (error) {
      console.error('[useBattles] Error joining BaggerBomb battle:', error);
      setBattlesError(error.message);
      return null;
    }
  }, []);

  const viewBattle = useCallback((battle) => {
    setCurrentBattle(battle);
    setActiveBattleId(battle.id);
  }, []);

  const closeBattle = useCallback(() => {
    setCurrentBattle(null);
    setActiveBattleId(null);
  }, []);

  const archiveCompletedBattle = useCallback(async (battle) => {
    try {
      const firebaseService = await import('../firebase/firebaseService');
      await firebaseService.archiveBattle(battle.id);
      setBattles(prev => prev.filter(b => b.id !== battle.id));
      setPreviousBattles(prev => [...prev, { ...battle, archivedAt: new Date().toISOString() }]);
    } catch (error) {
      console.error('[useBattles] Error archiving battle:', error);
      setBattlesError(error.message);
    }
  }, []);

  const updateBattleStatus = useCallback(async (battleId, status) => {
    try {
      const firebaseService = await import('../firebase/firebaseService');
      await firebaseService.updateBattleStatus(battleId, status);
      setBattles(prev =>
        prev.map(b => b.id === battleId ? { ...b, status } : b)
      );
    } catch (error) {
      console.error('[useBattles] Error updating battle status:', error);
      setBattlesError(error.message);
    }
  }, []);

  const completeBattle = useCallback(async (battleId, resultData) => {
    try {
      const firebaseService = await import('../firebase/firebaseService');
      await firebaseService.completeBattle(battleId, resultData);
      setBattles(prev =>
        prev.map(b => b.id === battleId ? { ...b, status: 'completed', ...resultData } : b)
      );
    } catch (error) {
      console.error('[useBattles] Error completing battle:', error);
      setBattlesError(error.message);
    }
  }, []);

  const removeBattle = useCallback((battleId) => {
    setBattles(prev => prev.filter(b => b.id !== battleId));
  }, []);

  const refreshBattle = useCallback(async (battleId) => {
    try {
      const firebaseService = await import('../firebase/firebaseService');
      const battle = await firebaseService.getBattle(battleId);
      if (battle) {
        setBattles(prev =>
          prev.map(b => b.id === battleId ? battle : b)
        );
        if (currentBattle?.id === battleId) {
          setCurrentBattle(battle);
        }
      }
      return battle;
    } catch (error) {
      console.error('[useBattles] Error refreshing battle:', error);
      return null;
    }
  }, [currentBattle?.id]);

  const loadTrainingBattles = useCallback(async () => {
    if (!user?.odUserId && !user?.username) return;

    setLoadingTrainingBattles(true);
    try {
      const firebaseService = await import('../firebase/firebaseService');
      const userId = user.odUserId || user.username;
      const trainingBattles = await firebaseService.getUserTrainingBattles(userId);

      setActiveTrainingBattles(trainingBattles.filter(b => b.status !== 'completed'));
      setCompletedTrainingBattles(trainingBattles.filter(b => b.status === 'completed'));
    } catch (error) {
      console.error('[useBattles] Error loading training battles:', error);
    } finally {
      setLoadingTrainingBattles(false);
    }
  }, [user]);

  // ============================================
  // RETURN
  // ============================================

  return {
    // Raw state
    battles,
    setBattles,
    currentBattle,
    setCurrentBattle,
    activeBattleId,
    setActiveBattleId,
    currentBattleIndex,
    setCurrentBattleIndex,

    // Previous battles
    previousBattles,
    setPreviousBattles,
    showPreviousBattles,
    setShowPreviousBattles,
    selectedPreviousBattle,
    setSelectedPreviousBattle,

    // Training battles
    activeTrainingBattles,
    setActiveTrainingBattles,
    completedTrainingBattles,
    setCompletedTrainingBattles,
    loadingTrainingBattles,
    loadTrainingBattles,

    // Prices
    battlePrices,
    setBattlePrices,
    loadingBattlePrices,
    setLoadingBattlePrices,

    // Loading/Error
    battlesLoading,
    battlesError,

    // Computed
    userBattles,
    activeBattles,
    pendingBattles,
    completedBattles,

    // Actions
    createBattle,
    createBaggerBombBattle,
    createTrainingBattle,
    joinBattle,
    joinBaggerBombBattle,
    viewBattle,
    closeBattle,
    archiveCompletedBattle,
    updateBattleStatus,
    completeBattle,
    removeBattle,
    refreshBattle
  };
};

export default useBattles;
