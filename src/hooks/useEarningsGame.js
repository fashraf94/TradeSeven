/**
 * useEarningsGame.js
 *
 * Custom hook for EarningsGame state management.
 * Updated for parlay system (outcome + magnitude).
 */

import { useState, useCallback, useMemo } from 'react';

export const BUDGET = 10000;
export const MIN_PREDICTIONS = 3;
export const MAX_PREDICTIONS = 10;

export function useEarningsGame() {
  const [predictions, setPredictions] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [error, setError] = useState(null);

  const totalSpent = useMemo(() =>
    predictions.reduce((sum, p) => sum + p.price, 0),
    [predictions]
  );

  const budgetRemaining = useMemo(() => BUDGET - totalSpent, [totalSpent]);

  const totalPotentialPoints = useMemo(() =>
    predictions.reduce((sum, p) => sum + p.potentialPoints, 0),
    [predictions]
  );

  const isValid = useMemo(() =>
    predictions.length >= MIN_PREDICTIONS &&
    predictions.length <= MAX_PREDICTIONS &&
    totalSpent <= BUDGET,
    [predictions, totalSpent]
  );

  const validationMessage = useMemo(() => {
    if (predictions.length < MIN_PREDICTIONS) {
      return `Need ${MIN_PREDICTIONS - predictions.length} more prediction${MIN_PREDICTIONS - predictions.length > 1 ? 's' : ''}`;
    }
    if (predictions.length >= MAX_PREDICTIONS) {
      return 'Maximum predictions reached';
    }
    if (totalSpent > BUDGET) {
      return 'Over budget';
    }
    return null;
  }, [predictions, totalSpent]);

  /**
   * Add a parlay prediction
   * @param {Object} event - The earnings event
   * @param {Object} parlay - The selected parlay (from event.parlays)
   */
  const addPrediction = useCallback((event, parlay) => {
    if (isLocked) {
      setError('Portfolio is locked');
      return false;
    }

    if (predictions.find(p => p.eventId === event.id)) {
      setError('Already have a prediction for this event');
      return false;
    }

    if (predictions.length >= MAX_PREDICTIONS) {
      setError('Maximum predictions reached');
      return false;
    }

    if (parlay.price > budgetRemaining) {
      setError('Insufficient budget');
      return false;
    }

    setPredictions(prev => [...prev, {
      eventId: event.id,
      symbol: event.symbol,
      companyName: event.companyName,
      reportDate: event.reportDate,

      // Parlay details
      parlayId: parlay.id,
      outcome: parlay.outcome,
      magnitude: parlay.magnitude,
      label: parlay.label,
      emoji: parlay.emoji,
      range: parlay.range,

      // Pricing
      price: parlay.price,
      combinedProb: parlay.combinedProb,
      multiplier: parlay.multiplier,
      potentialPoints: parlay.potentialPoints,
      risk: parlay.risk,

      // Polymarket odds at time of prediction
      beatOdds: event.yesOdds,
      missOdds: event.noOdds,

      addedAt: new Date()
    }]);

    setError(null);
    return true;
  }, [predictions, isLocked, budgetRemaining]);

  const removePrediction = useCallback((eventId) => {
    if (isLocked) {
      setError('Portfolio is locked');
      return false;
    }
    setPredictions(prev => prev.filter(p => p.eventId !== eventId));
    setError(null);
    return true;
  }, [isLocked]);

  const lockPortfolio = useCallback(() => {
    if (!isValid) {
      setError(validationMessage);
      return false;
    }
    setIsLocked(true);
    setError(null);
    return true;
  }, [isValid, validationMessage]);

  const reset = useCallback(() => {
    setPredictions([]);
    setIsLocked(false);
    setError(null);
  }, []);

  /**
   * Calculate score given results
   * @param {Object} results - Map of eventId -> { outcome: 'beat'|'miss', move: number }
   */
  const calculateScore = useCallback((results) => {
    let totalPoints = 0;
    let correct = 0;
    let incorrect = 0;
    let pending = 0;

    const scored = predictions.map(pred => {
      const result = results[pred.eventId];

      if (!result) {
        pending++;
        return { ...pred, status: 'pending', pointsEarned: null };
      }

      // Check outcome (beat/miss)
      const outcomeCorrect = pred.outcome === result.outcome;

      // Check magnitude
      let magnitudeCorrect = false;
      const move = result.move;

      if (pred.magnitude === 'upBig' && move > 5) magnitudeCorrect = true;
      else if (pred.magnitude === 'up' && move >= 2 && move <= 5) magnitudeCorrect = true;
      else if (pred.magnitude === 'flat' && move > -2 && move < 2) magnitudeCorrect = true;
      else if (pred.magnitude === 'down' && move <= -2 && move > -5) magnitudeCorrect = true;
      else if (pred.magnitude === 'downBig' && move <= -5) magnitudeCorrect = true;

      // Both must be correct for parlay
      const isCorrect = outcomeCorrect && magnitudeCorrect;

      if (isCorrect) {
        correct++;
        totalPoints += pred.potentialPoints;
        return { ...pred, status: 'correct', pointsEarned: pred.potentialPoints };
      } else {
        incorrect++;
        return {
          ...pred,
          status: 'incorrect',
          pointsEarned: 0,
          outcomeCorrect,
          magnitudeCorrect
        };
      }
    });

    return {
      totalPoints,
      correct,
      incorrect,
      pending,
      predictions: scored,
      accuracy: correct + incorrect > 0
        ? Math.round((correct / (correct + incorrect)) * 100)
        : 0
    };
  }, [predictions]);

  return {
    predictions,
    totalSpent,
    budgetRemaining,
    totalPotentialPoints,
    isLocked,
    isValid,
    validationMessage,
    error,
    addPrediction,
    removePrediction,
    lockPortfolio,
    reset,
    calculateScore,
    BUDGET,
    MIN_PREDICTIONS,
    MAX_PREDICTIONS
  };
}

export default useEarningsGame;
