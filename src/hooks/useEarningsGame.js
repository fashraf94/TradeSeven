/**
 * useEarningsGame.js
 *
 * Custom hook for EarningsGame state management.
 * Follows the same pattern as useDraft.js
 */

import { useState, useCallback, useMemo } from 'react';

export const BUDGET = 10000;
export const MIN_PREDICTIONS = 3;
export const MAX_PREDICTIONS = 10;

function getMultiplier(odds) {
  if (odds >= 0.90) return 1.1;
  if (odds >= 0.70) return 1.3;
  if (odds >= 0.50) return 1.5;
  if (odds >= 0.30) return 2.0;
  return 3.0;
}

export function useEarningsGame() {
  const [predictions, setPredictions] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [error, setError] = useState(null);

  const totalSpent = useMemo(() =>
    predictions.reduce((sum, p) => sum + p.cost, 0),
    [predictions]
  );

  const budgetRemaining = useMemo(() => BUDGET - totalSpent, [totalSpent]);

  const isValid = useMemo(() =>
    predictions.length >= MIN_PREDICTIONS &&
    predictions.length <= MAX_PREDICTIONS &&
    totalSpent <= BUDGET,
    [predictions, totalSpent]
  );

  const addPrediction = useCallback((event, type) => {
    if (isLocked) return false;
    if (predictions.find(p => p.eventId === event.id)) return false;
    if (predictions.length >= MAX_PREDICTIONS) return false;

    const cost = type === 'beat' ? event.yesCost : event.noCost;
    const odds = type === 'beat' ? event.yesOdds : event.noOdds;

    if (cost > budgetRemaining) return false;

    const multiplier = getMultiplier(odds);

    setPredictions(prev => [...prev, {
      eventId: event.id,
      symbol: event.symbol,
      companyName: event.companyName,
      reportDate: event.reportDate,
      prediction: type,
      cost,
      odds,
      multiplier,
      potentialPoints: Math.round(cost * multiplier)
    }]);

    setError(null);
    return true;
  }, [predictions, isLocked, budgetRemaining]);

  const removePrediction = useCallback((eventId) => {
    if (isLocked) return false;
    setPredictions(prev => prev.filter(p => p.eventId !== eventId));
    return true;
  }, [isLocked]);

  const lockPortfolio = useCallback(() => {
    if (!isValid) return false;
    setIsLocked(true);
    return true;
  }, [isValid]);

  const reset = useCallback(() => {
    setPredictions([]);
    setIsLocked(false);
    setError(null);
  }, []);

  return {
    predictions,
    totalSpent,
    budgetRemaining,
    isLocked,
    isValid,
    error,
    addPrediction,
    removePrediction,
    lockPortfolio,
    reset,
    BUDGET,
    MIN_PREDICTIONS,
    MAX_PREDICTIONS
  };
}

export default useEarningsGame;
