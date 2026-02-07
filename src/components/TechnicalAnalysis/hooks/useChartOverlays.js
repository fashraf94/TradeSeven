// src/components/TechnicalAnalysis/hooks/useChartOverlays.js
// Manages chart overlay state and computed data (SMAs, Fibonacci, highlight)

import { useState, useEffect } from 'react';
import { calculateRollingSMA } from '../../../services/technicalIndicators';
import { calculateFibonacciLevels } from '../../../services/confluenceDetection';
import detectLevels from '../../../services/levelDetection';

/**
 * Custom hook for chart overlay state and data computation
 * @param {Array} ohlcvData - OHLCV candles (newest first)
 * @param {Array} dailyAnchorData - Daily anchor OHLCV data
 * @param {Object} dailyIndicators - Calculated daily indicators
 * @returns {Object} Overlay state, toggle handler, computed data
 */
const useChartOverlays = (ohlcvData, dailyAnchorData, dailyIndicators) => {
  const [overlayToggles, setOverlayToggles] = useState({ sma: false, fib: false, sr: false });
  const [activeChartHighlight, setActiveChartHighlight] = useState(null);
  const [smaLineData, setSmaLineData] = useState(null);
  const [fibLevels, setFibLevels] = useState(null);
  const [chartLevels, setChartLevels] = useState([]);

  const showLevelOverlay = overlayToggles.sr;

  const handleOverlayToggle = (key) => {
    setOverlayToggles(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Compute SMA line data for chart overlays
  useEffect(() => {
    if (!ohlcvData?.length) {
      setSmaLineData(null);
      return;
    }
    setSmaLineData({
      sma20: calculateRollingSMA(ohlcvData, 20),
      sma50: calculateRollingSMA(ohlcvData, 50),
      sma200: calculateRollingSMA(ohlcvData, 200),
    });
  }, [ohlcvData]);

  // Compute Fibonacci levels for chart overlays
  useEffect(() => {
    if (!ohlcvData?.length || ohlcvData.length < 20) {
      setFibLevels(null);
      return;
    }
    try {
      const fibs = calculateFibonacciLevels(ohlcvData);
      setFibLevels(fibs);
    } catch {
      setFibLevels(null);
    }
  }, [ohlcvData]);

  // Calculate chart levels for S/R overlay
  useEffect(() => {
    if (dailyAnchorData && dailyIndicators) {
      const detected = detectLevels(dailyAnchorData, dailyIndicators);

      const allLevels = [
        ...detected.support.map(l => ({
          price: l.price,
          type: 'SUPPORT',
          label: l.factors[0]?.name || 'Support',
        })),
        ...detected.resistance.map(l => ({
          price: l.price,
          type: 'RESISTANCE',
          label: l.factors[0]?.name || 'Resistance',
        })),
      ];

      setChartLevels(allLevels);
    }
  }, [dailyAnchorData, dailyIndicators]);

  return {
    overlayToggles,
    handleOverlayToggle,
    showLevelOverlay,
    activeChartHighlight,
    setActiveChartHighlight,
    smaLineData,
    fibLevels,
    chartLevels,
  };
};

export default useChartOverlays;
