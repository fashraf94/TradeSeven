// /src/components/Research/MoneyMap/MoneyMapScreen.jsx

import React, { useState, useEffect } from 'react';
import RegimeBanner from './RegimeBanner';
import ConfidenceGauge from './ConfidenceGauge';

// ===========================================
// MOCK DATA
// Simulates computeMoneyMapData() output for February 2026
// Matches the exact return shape from src/services/moneyMapEngine.js
// Will be replaced with live computation in Phase 4
// ===========================================
const MOCK_MONEY_MAP_DATA = {
  sectors: {
    XLE: {
      sectorId: 'XLE',
      name: 'Energy',
      quadrant: {
        quadrant: 'LEADING',
        x: 6.2,
        y: 3.1,
        quadrantMeta: {
          label: 'Leading',
          color: '#10b981',
          icon: 'trending-up',
          narrative: 'Outperforming the market and accelerating. Strongest conviction zone.',
        },
      },
      momentumScore: 9,
      momentumDirection: { direction: 'Accelerating', delta: 2.4 },
      maPosition: { label: 'Strong Uptrend', color: '#10b981' },
      breadthTier: {
        label: 'Full Participation',
        color: '#10b981',
        tooltip: '80-100% of stocks above 50-day SMA. Broad, healthy strength across the sector.',
        percent: 100,
      },
      priceBreadthDivergence: { divergence: 'none', description: '' },
      leadershipScore: { score: 4.8, maxScore: 5, healthy: 3, outperforming: 3, total: 3 },
      gildedCage: { detected: false, severity: 'none', description: '', weightedLeadership: 0 },
      classification: { riskPosture: 'Offensive', bellwethers: ['XOM', 'CVX', 'COP'] },
    },
    XLK: {
      sectorId: 'XLK',
      name: 'Technology',
      quadrant: {
        quadrant: 'WEAKENING',
        x: 1.2,
        y: -3.8,
        quadrantMeta: {
          label: 'Weakening',
          color: '#f59e0b',
          icon: 'trending-down',
          narrative: 'Still ahead of the market but losing momentum. Watch for rotation.',
        },
      },
      momentumScore: -4,
      momentumDirection: { direction: 'Decelerating', delta: -2.1 },
      maPosition: { label: 'Pulling Back', color: '#f59e0b' },
      breadthTier: {
        label: 'Fragile',
        color: '#ef4444',
        tooltip: '10-30% participating. Narrow leadership, high divergence risk.',
        percent: 30,
      },
      priceBreadthDivergence: {
        divergence: 'bearish',
        description: 'Price is rising but fewer stocks are participating. Rally may be fragile.',
      },
      leadershipScore: { score: 4.2, maxScore: 5, healthy: 2, outperforming: 2, total: 3 },
      gildedCage: {
        detected: true,
        severity: 'WARNING',
        description: 'Leadership is concentrated while breadth thins. Monitor for cracks in top names.',
        weightedLeadership: 0.75,
        breadthPercent: 30,
        leadershipScore: 4.2,
      },
      classification: { riskPosture: 'Offensive', bellwethers: ['AAPL', 'MSFT', 'NVDA'] },
    },
    XLV: {
      sectorId: 'XLV',
      name: 'Health Care',
      quadrant: {
        quadrant: 'LAGGING',
        x: -2.1,
        y: -1.5,
        quadrantMeta: {
          label: 'Lagging',
          color: '#ef4444',
          icon: 'arrow-down',
          narrative: 'Underperforming and decelerating. Avoid or reduce exposure.',
        },
      },
      momentumScore: -5.2,
      momentumDirection: { direction: 'Decelerating', delta: -1.8 },
      maPosition: { label: 'Downtrend', color: '#ef4444' },
      breadthTier: {
        label: 'Thinning',
        color: '#f59e0b',
        tooltip: '31-49% participating. Leadership is narrowing — watch for cracks.',
        percent: 38,
      },
      priceBreadthDivergence: { divergence: 'none', description: '' },
      leadershipScore: { score: 2.1, maxScore: 5, healthy: 1, outperforming: 1, total: 3 },
      gildedCage: { detected: false, severity: 'none', description: '', weightedLeadership: 0 },
      classification: { riskPosture: 'Defensive', bellwethers: ['LLY', 'UNH', 'JNJ'] },
    },
    XLF: {
      sectorId: 'XLF',
      name: 'Financials',
      quadrant: {
        quadrant: 'LEADING',
        x: 3.5,
        y: 1.2,
        quadrantMeta: {
          label: 'Leading',
          color: '#10b981',
          icon: 'trending-up',
          narrative: 'Outperforming the market and accelerating. Strongest conviction zone.',
        },
      },
      momentumScore: 7.1,
      momentumDirection: { direction: 'Accelerating', delta: 1.5 },
      maPosition: { label: 'Strong Uptrend', color: '#10b981' },
      breadthTier: {
        label: 'Healthy',
        color: '#22c55e',
        tooltip: '50-79% participating. Majority of the sector is in gear.',
        percent: 72,
      },
      priceBreadthDivergence: { divergence: 'none', description: '' },
      leadershipScore: { score: 3.8, maxScore: 5, healthy: 2, outperforming: 2, total: 3 },
      gildedCage: { detected: false, severity: 'none', description: '', weightedLeadership: 0 },
      classification: { riskPosture: 'Offensive', bellwethers: ['BRK.B', 'JPM', 'V'] },
    },
  },
  global: {
    regime: {
      regime: 'LEANING_CYCLICAL',
      label: 'Leaning Cyclical',
      avgBreadth: 62,
      cyclicalPerf1W: 1.8,
      cyclicalPerf1M: 3.2,
      cyclicalPerf3M: 8.5,
      defensivePerf1W: 0.3,
      defensivePerf1M: -0.5,
      defensivePerf3M: 2.1,
      perfDelta1W: 1.5,
      perfDelta1M: 3.7,
      perfDelta3M: 6.4,
      sectorsPositive3M: 8,
    },
    confidence: 62,
    weather: {
      weather: 'Partly Sunny',
      description: 'Cyclicals leading but not uniformly. Selective opportunities in growth — stay alert for clouds.',
    },
    sectorCount: 4,
    computedAt: Date.now(),
  },
};

/**
 * MoneyMapScreen — Main container for the Money Map feature
 * Phase 2: Renders RegimeBanner + ConfidenceGauge with mock data
 * Phase 3 will add sector cards below
 * Phase 4 will wire into App.jsx routing with live data
 */
const MoneyMapScreen = () => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading delay for realistic UX
    const timer = setTimeout(() => {
      setData(MOCK_MONEY_MAP_DATA);
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}>
        <div style={{
          background: '#1c2128',
          border: '1px solid #21262d',
          borderRadius: '16px',
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            border: '2px solid #00d9ff',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <span style={{ color: '#8b949e', fontSize: '14px' }}>
            Computing Money Map...
          </span>
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
    }}>
      {/* Layer 1: Market Regime Banner */}
      <RegimeBanner
        regime={data.global.regime}
        weather={data.global.weather}
        computedAt={data.global.computedAt}
      />

      {/* Layer 2: Confidence Gauge */}
      <ConfidenceGauge
        confidence={data.global.confidence}
      />

      {/* Phase 3 placeholder: Sector Map */}
      <div style={{
        background: '#161b22',
        border: '1px solid #21262d',
        borderRadius: '16px',
        padding: '20px',
        minHeight: '200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ color: '#8b949e', fontSize: '14px' }}>
          Sector cards coming in Phase 3
        </span>
      </div>

      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default MoneyMapScreen;
