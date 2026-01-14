// src/hooks/useEarningsGame.js
// State management hook for EarningsGame with persistence

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BUDGET,
  MIN_PRICE,
  calculatePayout,
  verifyPrediction
} from '../services/earningsReactionsService';

// ============================================
// CONSTANTS
// ============================================

export const EARNINGS_BUDGET = BUDGET;
export const MIN_PREDICTIONS = 3;
export const MAX_PREDICTIONS = 10;

const STORAGE_KEY = 'marketclash_earnings_portfolio';

// ============================================
// PERSISTENCE HELPERS
// ============================================

/**
 * Load portfolio from localStorage
 */
function loadFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      // Validate structure
      if (data && Array.isArray(data.predictions)) {
        return data;
      }
    }
  } catch (e) {
    console.error('[useEarningsGame] Error loading from storage:', e);
  }
  return null;
}

/**
 * Save portfolio to localStorage
 */
function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...data,
      savedAt: new Date().toISOString()
    }));
  } catch (e) {
    console.error('[useEarningsGame] Error saving to storage:', e);
  }
}

/**
 * Clear portfolio from localStorage
 */
function clearStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('[useEarningsGame] Error clearing storage:', e);
  }
}

// ============================================
// FIREBASE PERSISTENCE (Lazy loaded)
// ============================================

let firebaseService = null;

async function getFirebaseService() {
  if (!firebaseService) {
    try {
      const module = await import('../firebase/firebaseService');
      firebaseService = module.default || module;
    } catch (e) {
      console.warn('[useEarningsGame] Firebase not available:', e);
    }
  }
  return firebaseService;
}

/**
 * Save portfolio to Firebase
 */
async function saveToFirebase(userId, data) {
  if (!userId) return false;

  try {
    const fb = await getFirebaseService();
    if (fb && fb.saveEarningsPortfolio) {
      await fb.saveEarningsPortfolio(userId, {
        ...data,
        savedAt: new Date().toISOString()
      });
      return true;
    }
  } catch (e) {
    console.warn('[useEarningsGame] Firebase save failed:', e);
  }
  return false;
}

/**
 * Load portfolio from Firebase
 */
async function loadFromFirebase(userId) {
  if (!userId) return null;

  try {
    const fb = await getFirebaseService();
    if (fb && fb.loadEarningsPortfolio) {
      const data = await fb.loadEarningsPortfolio(userId);
      if (data && Array.isArray(data.predictions)) {
        return data;
      }
    }
  } catch (e) {
    console.warn('[useEarningsGame] Firebase load failed:', e);
  }
  return null;
}

// ============================================
// MAIN HOOK
// ============================================

export function useEarningsGame(userId = null) {
  // Core state
  const [predictions, setPredictions] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // ==========================================
  // LOAD ON MOUNT
  // ==========================================

  useEffect(() => {
    async function loadPortfolio() {
      setIsLoading(true);

      // Try Firebase first if we have a userId
      if (userId) {
        const firebaseData = await loadFromFirebase(userId);
        if (firebaseData) {
          setPredictions(firebaseData.predictions || []);
          setIsLocked(firebaseData.isLocked || false);
          setIsLoading(false);
          // Also update localStorage as backup
          saveToStorage(firebaseData);
          return;
        }
      }

      // Fall back to localStorage
      const localData = loadFromStorage();
      if (localData) {
        setPredictions(localData.predictions || []);
        setIsLocked(localData.isLocked || false);
      }

      setIsLoading(false);
    }

    loadPortfolio();
  }, [userId]);

  // ==========================================
  // AUTO-SAVE ON CHANGES
  // ==========================================

  useEffect(() => {
    // Don't save during initial load
    if (isLoading) return;

    const data = { predictions, isLocked };

    // Always save to localStorage (immediate)
    saveToStorage(data);

    // Also save to Firebase (async, debounced)
    if (userId) {
      const timeoutId = setTimeout(() => {
        saveToFirebase(userId, data);
      }, 1000); // Debounce by 1 second

      return () => clearTimeout(timeoutId);
    }
  }, [predictions, isLocked, userId, isLoading]);

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  const totalSpent = useMemo(() => {
    return predictions.reduce((sum, p) => sum + (p.price || 0), 0);
  }, [predictions]);

  const budgetRemaining = useMemo(() => {
    return BUDGET - totalSpent;
  }, [totalSpent]);

  const totalPotentialPoints = useMemo(() => {
    return predictions.reduce((sum, p) => sum + (p.potentialPayout || 0), 0);
  }, [predictions]);

  const isValid = useMemo(() => {
    return predictions.length >= MIN_PREDICTIONS &&
           predictions.length <= MAX_PREDICTIONS &&
           totalSpent <= BUDGET;
  }, [predictions.length, totalSpent]);

  const validationMessage = useMemo(() => {
    if (predictions.length < MIN_PREDICTIONS) {
      return `Add at least ${MIN_PREDICTIONS - predictions.length} more prediction${MIN_PREDICTIONS - predictions.length > 1 ? 's' : ''}`;
    }
    if (predictions.length > MAX_PREDICTIONS) {
      return `Remove ${predictions.length - MAX_PREDICTIONS} prediction${predictions.length - MAX_PREDICTIONS > 1 ? 's' : ''} (max ${MAX_PREDICTIONS})`;
    }
    if (totalSpent > BUDGET) {
      return `Over budget by $${(totalSpent - BUDGET).toLocaleString()}`;
    }
    return 'Portfolio ready to lock!';
  }, [predictions.length, totalSpent]);

  // ==========================================
  // ACTIONS
  // ==========================================

  /**
   * Add a prediction to the portfolio
   * @param {Object} event - The earnings event
   * @param {Object} parlay - The selected parlay option
   * @param {string} precisionTier - 'standard', 'narrow', or 'bullseye'
   */
  const addPrediction = useCallback((event, parlay, precisionTier = 'standard') => {
    if (isLocked) {
      setError('Portfolio is locked');
      return false;
    }

    if (predictions.length >= MAX_PREDICTIONS) {
      setError(`Maximum ${MAX_PREDICTIONS} predictions allowed`);
      return false;
    }

    // Check if already have a prediction for this event
    const existingIndex = predictions.findIndex(p => p.eventId === event.id);
    if (existingIndex >= 0) {
      setError('Already have a prediction for this event. Remove it first to change.');
      return false;
    }

    // Find the precision option to get the final multiplier
    const precisionOption = parlay.precisionOptions?.find(o => o.tierId === precisionTier)
      || parlay.precisionOptions?.[0];

    const finalMultiplier = precisionOption?.finalMultiplier || parlay.baseMultiplier;
    const potentialPayout = calculatePayout(parlay.price, finalMultiplier);

    // Check budget
    if (totalSpent + parlay.price > BUDGET) {
      setError(`Not enough budget. Need $${parlay.price.toLocaleString()}, have $${budgetRemaining.toLocaleString()}`);
      return false;
    }

    const prediction = {
      // Event info
      eventId: event.id,
      symbol: event.symbol,
      companyName: event.companyName || event.title,
      reportDate: event.reportDate || event.endDate,

      // Parlay details
      parlayId: parlay.id,
      outcome: parlay.outcome,
      outcomeLabel: parlay.outcomeLabel,
      magnitude: parlay.magnitude,
      magnitudeLabel: parlay.magnitudeLabel,
      magnitudeEmoji: parlay.magnitudeEmoji,
      magnitudeRange: parlay.magnitudeRange,

      // Precision tier
      precisionTier,
      precisionLabel: precisionOption?.tierLabel || 'Standard',
      precisionRange: precisionOption?.range?.label || parlay.magnitudeRange,

      // Pricing
      price: parlay.price,
      priceDisplay: parlay.priceDisplay,
      baseMultiplier: parlay.baseMultiplier,
      finalMultiplier,
      potentialPayout,
      potentialPayoutDisplay: `$${potentialPayout.toLocaleString()}`,
      risk: parlay.risk,

      // Probabilities
      combinedProb: parlay.combinedProb,
      outcomeOdds: parlay.outcomeOdds,
      reactionProb: parlay.reactionProb,
      sector: parlay.sector,

      // Meta
      addedAt: new Date().toISOString()
    };

    setPredictions(prev => [...prev, prediction]);
    setError(null);
    return true;
  }, [isLocked, predictions, totalSpent, budgetRemaining]);

  /**
   * Remove a prediction by event ID
   */
  const removePrediction = useCallback((eventId) => {
    if (isLocked) {
      setError('Portfolio is locked');
      return false;
    }

    setPredictions(prev => prev.filter(p => p.eventId !== eventId));
    setError(null);
    return true;
  }, [isLocked]);

  /**
   * Update a prediction's precision tier
   */
  const updatePrecisionTier = useCallback((eventId, newTier, parlay) => {
    if (isLocked) {
      setError('Portfolio is locked');
      return false;
    }

    setPredictions(prev => prev.map(p => {
      if (p.eventId !== eventId) return p;

      const precisionOption = parlay.precisionOptions?.find(o => o.tierId === newTier);
      if (!precisionOption) return p;

      const finalMultiplier = precisionOption.finalMultiplier;
      const potentialPayout = calculatePayout(p.price, finalMultiplier);

      return {
        ...p,
        precisionTier: newTier,
        precisionLabel: precisionOption.tierLabel,
        precisionRange: precisionOption.range?.label || p.magnitudeRange,
        finalMultiplier,
        potentialPayout,
        potentialPayoutDisplay: `$${potentialPayout.toLocaleString()}`
      };
    }));

    setError(null);
    return true;
  }, [isLocked]);

  /**
   * Lock the portfolio (no more changes allowed)
   */
  const lockPortfolio = useCallback(async () => {
    if (!isValid) {
      setError(validationMessage);
      return false;
    }

    setIsSaving(true);
    setIsLocked(true);

    // Force immediate save
    const data = { predictions, isLocked: true };
    saveToStorage(data);

    if (userId) {
      await saveToFirebase(userId, data);
    }

    setIsSaving(false);
    setError(null);
    return true;
  }, [isValid, validationMessage, predictions, userId]);

  /**
   * Unlock the portfolio (for editing)
   */
  const unlockPortfolio = useCallback(() => {
    setIsLocked(false);
    setError(null);
  }, []);

  /**
   * Reset the entire portfolio
   */
  const reset = useCallback(() => {
    setPredictions([]);
    setIsLocked(false);
    setError(null);
    clearStorage();
  }, []);

  /**
   * Clear portfolio completely (including Firebase)
   * Use this when starting a new tournament portfolio
   */
  const clearPortfolio = useCallback(async () => {
    setPredictions([]);
    setIsLocked(false);
    setError(null);
    clearStorage();

    // Also clear from Firebase if logged in
    if (userId) {
      try {
        const fb = await getFirebaseService();
        if (fb && fb.deleteEarningsPortfolio) {
          await fb.deleteEarningsPortfolio(userId);
          console.log('[useEarningsGame] Cleared portfolio from Firebase');
        }
      } catch (e) {
        console.warn('[useEarningsGame] Failed to clear from Firebase:', e);
      }
    }
  }, [userId]);

  /**
   * Calculate score based on actual results
   */
  const calculateScore = useCallback((results) => {
    let totalPoints = 0;
    const scoredPredictions = predictions.map(prediction => {
      const result = results.find(r => r.eventId === prediction.eventId);

      if (!result) {
        return { ...prediction, status: 'pending', points: 0 };
      }

      const verification = verifyPrediction(
        prediction,
        result.actualMove,
        result.didBeat
      );

      if (verification.correct) {
        const points = prediction.potentialPayout;
        totalPoints += points;
        return { ...prediction, status: 'won', points };
      } else {
        return { ...prediction, status: 'lost', points: 0, lostReason: verification.reason };
      }
    });

    return {
      totalPoints,
      predictions: scoredPredictions,
      won: scoredPredictions.filter(p => p.status === 'won').length,
      lost: scoredPredictions.filter(p => p.status === 'lost').length,
      pending: scoredPredictions.filter(p => p.status === 'pending').length
    };
  }, [predictions]);

  // ==========================================
  // RETURN
  // ==========================================

  return {
    // State
    predictions,
    isLocked,
    error,
    isLoading,
    isSaving,

    // Computed
    totalSpent,
    budgetRemaining,
    totalPotentialPoints,
    isValid,
    validationMessage,

    // Actions
    addPrediction,
    removePrediction,
    updatePrecisionTier,
    lockPortfolio,
    unlockPortfolio,
    reset,
    clearPortfolio,
    calculateScore,

    // Constants (for UI)
    BUDGET: EARNINGS_BUDGET,
    MIN_PREDICTIONS,
    MAX_PREDICTIONS
  };
}

export default useEarningsGame;
