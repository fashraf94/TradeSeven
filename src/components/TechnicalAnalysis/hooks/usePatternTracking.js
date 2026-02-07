// src/components/TechnicalAnalysis/hooks/usePatternTracking.js
// Manages pattern tracking state (optimistic UI, in-progress, Firebase save)

import { useState } from 'react';
import { saveTrackedPattern, updatePatternStatus } from '../../../firebase/firebaseService';
import { TRACKING_DAYS } from '../PatternHistory';

/**
 * Custom hook for pattern tracking with optimistic UI
 * @param {string} userId - Current user ID
 * @param {string} ticker - Stock ticker symbol
 * @param {Array} ohlcvData - OHLCV data for current price
 * @param {Array} trackedPatterns - Already tracked patterns from Firebase
 * @param {Function} showToast - Toast notification function
 * @param {Function} onPatternTracked - Callback to refresh tracked patterns
 * @returns {Object} Tracking state and handlers
 */
const usePatternTracking = (userId, ticker, ohlcvData, trackedPatterns, showToast, onPatternTracked) => {
  const [trackingInProgress, setTrackingInProgress] = useState(new Set());
  const [locallyTracked, setLocallyTracked] = useState(new Set());

  const isPatternTracked = (confluence) => {
    if (locallyTracked.has(confluence.id)) return true;
    if (!trackedPatterns || !ticker) return false;
    const patternName = `${confluence.microPattern.name} at ${confluence.macroLevel.name}`;
    return trackedPatterns.some(p =>
      p.ticker === ticker &&
      p.patternName === patternName &&
      ['WAITING', 'TESTING'].includes(p.status)
    );
  };

  const isInProgress = (confluenceId) => trackingInProgress.has(confluenceId);

  const handleInstantTrack = async (confluence) => {
    if (!userId) {
      showToast?.('Please sign in to track patterns', 'error');
      return;
    }

    const patternName = `${confluence.microPattern.name} at ${confluence.macroLevel.name}`;
    setTrackingInProgress(prev => new Set(prev).add(confluence.id));

    try {
      await saveTrackedPattern(userId, {
        ticker,
        patternType: 'CONFLUENCE_ZONE',
        patternName,
        zoneType: confluence.macroLevel.type,
        priceLow: confluence.priceRange.low,
        priceHigh: confluence.priceRange.high,
        thesis: confluence.suggestedThesis,
        trackingDuration: TRACKING_DAYS,
        priceAtCreation: ohlcvData?.[0]?.close,
        indicators: [
          { indicator: confluence.microPattern.name, value: confluence.microPattern.price },
          { indicator: confluence.macroLevel.name, value: confluence.macroLevel.price },
        ],
        confluenceStrength: confluence.strength,
        description: confluence.description,
        historicalContext: confluence.historicalContext,
      });

      showToast?.('Pattern tracked! Check back in 2 weeks.', 'success');

      setLocallyTracked(prev => new Set(prev).add(confluence.id));
      setTrackingInProgress(prev => {
        const next = new Set(prev);
        next.delete(confluence.id);
        return next;
      });

      try {
        onPatternTracked?.();
      } catch (e) {
        console.warn('[usePatternTracking] Pattern refresh failed:', e);
      }
    } catch (err) {
      console.error('[usePatternTracking] Failed to track:', err);
      showToast?.('Failed to track pattern', 'error');
      setTrackingInProgress(prev => {
        const next = new Set(prev);
        next.delete(confluence.id);
        return next;
      });
    }
  };

  const handleResolvePattern = async (patternId, updates) => {
    try {
      await updatePatternStatus(patternId, updates);
      onPatternTracked?.();
    } catch (err) {
      console.error('[usePatternTracking] Failed to resolve:', err);
    }
  };

  return {
    isPatternTracked,
    isInProgress,
    handleInstantTrack,
    handleResolvePattern,
  };
};

export default usePatternTracking;
