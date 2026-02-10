// /src/components/Research/MoneyMap/MoneyMapScreen.jsx

import React, { useState, useEffect } from 'react';
import RegimeBanner from './RegimeBanner';
import ConfidenceGauge from './ConfidenceGauge';
import SectorList from './SectorList';

// ===========================================
// MOCK DATA HELPERS
// ===========================================

/** Build a mock sector entry with sensible defaults, overridden per sector */
function buildMockSector({
  sectorId, name, sectorColor, sectorEmoji,
  quadrant, quadrantMeta, momentumScore, momentumDir, momentumDelta,
  maLabel, maColor,
  breadthPercent, breadthLabel, breadthColor, breadthTooltip, breadthDirection,
  perfW1, perfM1, perfM3,
  leaderScore, leaderHealthy, leaderTotal,
  leaders,
  gildedCage,
  divergence,
  a50, a200, d50, d200,
  bbBreakouts, bbBusts, bbHitRate,
  riskPosture, bellwethers,
  insight,
}) {
  return {
    // Engine output fields
    sectorId,
    name,
    quadrant: {
      quadrant,
      x: parseFloat((perfM1 - 1.2).toFixed(2)),
      y: parseFloat(((perfW1 - 0.5) - (perfM1 - 1.2)).toFixed(2)),
      quadrantMeta,
    },
    momentumScore,
    momentumDirection: { direction: momentumDir, delta: momentumDelta },
    maPosition: { label: maLabel, color: maColor },
    breadthTier: { label: breadthLabel, color: breadthColor, tooltip: breadthTooltip, percent: breadthPercent },
    priceBreadthDivergence: divergence || { divergence: 'none', description: '' },
    leadershipScore: { score: leaderScore, maxScore: 5, healthy: leaderHealthy, outperforming: leaderHealthy, total: leaderTotal },
    gildedCage: gildedCage || { detected: false, severity: 'none', description: '', weightedLeadership: 0 },
    classification: { riskPosture, bellwethers },

    // Extra display fields (raw sector data for expanded view)
    performance: { week1: perfW1, month1: perfM1, month3: perfM3 },
    breadthDirection,
    etfTechnicals: { above50SMA: a50, above200SMA: a200, distanceFrom50SMA: d50, distanceFrom200SMA: d200 },
    baggerBombStats: { breakouts7d: bbBreakouts, busts7d: bbBusts, hitRate: bbHitRate },
    leaders,
    insight,
    sectorColor,
    sectorEmoji,
  };
}

// ===========================================
// MOCK DATA — 11 GICS SECTORS (February 2026)
// Enriched: engine output + raw display fields
// Will be replaced with live data in Phase 4
// ===========================================
const MOCK_MONEY_MAP_DATA = {
  sectors: {
    // --- LEADING ---
    XLE: buildMockSector({
      sectorId: 'XLE', name: 'Energy', sectorColor: '#ef4444', sectorEmoji: '\u26FD',
      quadrant: 'LEADING', quadrantMeta: { label: 'Leading', color: '#10b981', icon: 'trending-up', narrative: 'Outperforming the market and accelerating. Strongest conviction zone.' },
      momentumScore: 9.0, momentumDir: 'Accelerating', momentumDelta: 3.8,
      maLabel: 'Strong Uptrend', maColor: '#10b981',
      breadthPercent: 100, breadthLabel: 'Full Participation', breadthColor: '#10b981', breadthTooltip: '80-100% of stocks above 50-day SMA. Broad, healthy strength across the sector.', breadthDirection: 'expanding',
      perfW1: 4.3, perfM1: 18.0, perfM3: 22.1,
      leaderScore: 4.8, leaderHealthy: 5, leaderTotal: 5,
      leaders: [
        { symbol: 'XOM', above50: true, isBellwether: true, outperforming: true },
        { symbol: 'CVX', above50: true, isBellwether: true, outperforming: true },
        { symbol: 'COP', above50: true, isBellwether: true, outperforming: true },
        { symbol: 'SLB', above50: true, isBellwether: false, outperforming: true },
        { symbol: 'EOG', above50: true, isBellwether: false, outperforming: true },
      ],
      a50: true, a200: true, d50: 8.2, d200: 15.1,
      bbBreakouts: 14, bbBusts: 8, bbHitRate: 64,
      riskPosture: 'Offensive', bellwethers: ['XOM', 'CVX', 'COP'],
      insight: 'Energy dominates with perfect breadth and all leaders thriving. Full participation signals broad-based strength. Top offensive play.',
    }),

    XLI: buildMockSector({
      sectorId: 'XLI', name: 'Industrials', sectorColor: '#6366f1', sectorEmoji: '\uD83C\uDFED',
      quadrant: 'LEADING', quadrantMeta: { label: 'Leading', color: '#10b981', icon: 'trending-up', narrative: 'Outperforming the market and accelerating. Strongest conviction zone.' },
      momentumScore: 7.5, momentumDir: 'Accelerating', momentumDelta: 1.6,
      maLabel: 'Strong Uptrend', maColor: '#10b981',
      breadthPercent: 72, breadthLabel: 'Healthy', breadthColor: '#22c55e', breadthTooltip: '50-79% participating. Majority of the sector is in gear.', breadthDirection: 'expanding',
      perfW1: 2.1, perfM1: 8.2, perfM3: 11.7,
      leaderScore: 4.5, leaderHealthy: 4, leaderTotal: 4,
      leaders: [
        { symbol: 'CAT', above50: true, isBellwether: true, outperforming: true },
        { symbol: 'GE', above50: true, isBellwether: true, outperforming: true },
        { symbol: 'HON', above50: true, isBellwether: false, outperforming: true },
        { symbol: 'UNP', above50: true, isBellwether: false, outperforming: true },
      ],
      a50: true, a200: true, d50: 3.1, d200: 9.4,
      bbBreakouts: 7, bbBusts: 4, bbHitRate: 64,
      riskPosture: 'Offensive', bellwethers: ['GE', 'CAT', 'RTX'],
      insight: 'Industrials riding global capex cycle. Healthy breadth at 72% with all leaders above key MAs. Strong offensive sector.',
    }),

    XLB: buildMockSector({
      sectorId: 'XLB', name: 'Materials', sectorColor: '#84cc16', sectorEmoji: '\uD83E\uDDF1',
      quadrant: 'LEADING', quadrantMeta: { label: 'Leading', color: '#10b981', icon: 'trending-up', narrative: 'Outperforming the market and accelerating. Strongest conviction zone.' },
      momentumScore: 6.8, momentumDir: 'Steady', momentumDelta: 0.3,
      maLabel: 'Strong Uptrend', maColor: '#10b981',
      breadthPercent: 85, breadthLabel: 'Full Participation', breadthColor: '#10b981', breadthTooltip: '80-100% of stocks above 50-day SMA. Broad, healthy strength across the sector.', breadthDirection: 'stable',
      perfW1: 1.8, perfM1: 10.1, perfM3: 13.7,
      leaderScore: 4.6, leaderHealthy: 3, leaderTotal: 3,
      leaders: [
        { symbol: 'LIN', above50: true, isBellwether: true, outperforming: true },
        { symbol: 'FCX', above50: true, isBellwether: true, outperforming: true },
        { symbol: 'SHW', above50: true, isBellwether: true, outperforming: true },
      ],
      a50: true, a200: true, d50: 4.5, d200: 7.2,
      bbBreakouts: 9, bbBusts: 5, bbHitRate: 64,
      riskPosture: 'Offensive', bellwethers: ['LIN', 'SHW', 'FCX'],
      insight: 'Materials sector showing full participation at 85%. Commodity cycle tailwinds supporting broad strength across chemicals and metals.',
    }),

    // --- WEAKENING ---
    XLP: buildMockSector({
      sectorId: 'XLP', name: 'Consumer Staples', sectorColor: '#06b6d4', sectorEmoji: '\uD83D\uDED2',
      quadrant: 'WEAKENING', quadrantMeta: { label: 'Weakening', color: '#f59e0b', icon: 'trending-down', narrative: 'Still ahead of the market but losing momentum. Watch for rotation.' },
      momentumScore: 3.2, momentumDir: 'Decelerating', momentumDelta: -0.8,
      maLabel: 'Strong Uptrend', maColor: '#10b981',
      breadthPercent: 78, breadthLabel: 'Healthy', breadthColor: '#22c55e', breadthTooltip: '50-79% participating. Majority of the sector is in gear.', breadthDirection: 'contracting',
      perfW1: 0.5, perfM1: 9.5, perfM3: 13.2,
      leaderScore: 4.5, leaderHealthy: 5, leaderTotal: 5,
      leaders: [
        { symbol: 'PG', above50: true, isBellwether: true, outperforming: true },
        { symbol: 'COST', above50: true, isBellwether: true, outperforming: true },
        { symbol: 'KO', above50: true, isBellwether: false, outperforming: true },
        { symbol: 'PEP', above50: true, isBellwether: false, outperforming: true },
        { symbol: 'WMT', above50: true, isBellwether: true, outperforming: true },
      ],
      a50: true, a200: true, d50: 5.1, d200: 10.3,
      bbBreakouts: 4, bbBusts: 2, bbHitRate: 67,
      riskPosture: 'Defensive', bellwethers: ['PG', 'COST', 'WMT'],
      insight: 'Staples had a strong run but momentum is fading. Breadth contracting from highs. Defensive sector losing relative appeal as cyclicals surge.',
    }),

    XLK: buildMockSector({
      sectorId: 'XLK', name: 'Technology', sectorColor: '#3b82f6', sectorEmoji: '\uD83D\uDCBB',
      quadrant: 'WEAKENING', quadrantMeta: { label: 'Weakening', color: '#f59e0b', icon: 'trending-down', narrative: 'Still ahead of the market but losing momentum. Watch for rotation.' },
      momentumScore: -4.0, momentumDir: 'Decelerating', momentumDelta: -2.1,
      maLabel: 'Pulling Back', maColor: '#f59e0b',
      breadthPercent: 30, breadthLabel: 'Fragile', breadthColor: '#ef4444', breadthTooltip: '10-30% participating. Narrow leadership, high divergence risk.', breadthDirection: 'contracting',
      perfW1: 0.3, perfM1: -3.7, perfM3: -2.0,
      leaderScore: 4.2, leaderHealthy: 4, leaderTotal: 5,
      leaders: [
        { symbol: 'NVDA', above50: false, isBellwether: true, outperforming: false },
        { symbol: 'AAPL', above50: true, isBellwether: true, outperforming: true },
        { symbol: 'MSFT', above50: true, isBellwether: true, outperforming: true },
        { symbol: 'AVGO', above50: true, isBellwether: false, outperforming: true },
        { symbol: 'CRM', above50: true, isBellwether: false, outperforming: true },
      ],
      a50: false, a200: true, d50: -2.3, d200: 5.7,
      bbBreakouts: 12, bbBusts: 5, bbHitRate: 71,
      riskPosture: 'Offensive', bellwethers: ['AAPL', 'MSFT', 'NVDA'],
      gildedCage: {
        detected: true,
        severity: 'WARNING',
        description: 'Leadership is concentrated while breadth thins. Monitor for cracks in top names.',
        weightedLeadership: 0.75,
        breadthPercent: 30,
        leadershipScore: 4.2,
      },
      divergence: {
        divergence: 'bearish',
        description: 'Price is rising but fewer stocks are participating. Rally may be fragile.',
      },
      insight: 'Tech is losing steam despite strong leadership. Narrow breadth (30%) with bearish divergence signals fragility. Gilded Cage active \u2014 a few mega-caps mask weakness.',
    }),

    // --- IMPROVING ---
    XLRE: buildMockSector({
      sectorId: 'XLRE', name: 'Real Estate', sectorColor: '#ec4899', sectorEmoji: '\uD83C\uDFE2',
      quadrant: 'IMPROVING', quadrantMeta: { label: 'Improving', color: '#3b82f6', icon: 'arrow-up', narrative: 'Behind the market but gaining momentum. Early rotation target.' },
      momentumScore: 2.1, momentumDir: 'Accelerating', momentumDelta: 0.7,
      maLabel: 'Recovering', maColor: '#3b82f6',
      breadthPercent: 55, breadthLabel: 'Healthy', breadthColor: '#22c55e', breadthTooltip: '50-79% participating. Majority of the sector is in gear.', breadthDirection: 'expanding',
      perfW1: 1.2, perfM1: 3.1, perfM3: 4.1,
      leaderScore: 3.5, leaderHealthy: 3, leaderTotal: 4,
      leaders: [
        { symbol: 'PLD', above50: true, isBellwether: true, outperforming: true },
        { symbol: 'AMT', above50: true, isBellwether: true, outperforming: true },
        { symbol: 'EQIX', above50: true, isBellwether: true, outperforming: true },
        { symbol: 'SPG', above50: false, isBellwether: false, outperforming: false },
      ],
      a50: true, a200: false, d50: 1.2, d200: -2.1,
      bbBreakouts: 5, bbBusts: 3, bbHitRate: 63,
      riskPosture: 'Offensive', bellwethers: ['PLD', 'AMT', 'EQIX'],
      insight: 'Real estate showing early signs of recovery. Breadth expanding and bellwethers holding above 50-day MA. Potential rotation target.',
    }),

    // --- LAGGING ---
    XLV: buildMockSector({
      sectorId: 'XLV', name: 'Health Care', sectorColor: '#10b981', sectorEmoji: '\uD83C\uDFE5',
      quadrant: 'LAGGING', quadrantMeta: { label: 'Lagging', color: '#ef4444', icon: 'arrow-down', narrative: 'Underperforming and decelerating. Avoid or reduce exposure.' },
      momentumScore: -5.2, momentumDir: 'Decelerating', momentumDelta: -1.8,
      maLabel: 'Downtrend', maColor: '#ef4444',
      breadthPercent: 48, breadthLabel: 'Thinning', breadthColor: '#f59e0b', breadthTooltip: '31-49% participating. Leadership is narrowing \u2014 watch for cracks.', breadthDirection: 'expanding',
      perfW1: 0.8, perfM1: 1.2, perfM3: 1.9,
      leaderScore: 2.8, leaderHealthy: 4, leaderTotal: 6,
      leaders: [
        { symbol: 'UNH', above50: true, isBellwether: true, outperforming: true },
        { symbol: 'LLY', above50: true, isBellwether: true, outperforming: true },
        { symbol: 'JNJ', above50: true, isBellwether: true, outperforming: true },
        { symbol: 'ABT', above50: true, isBellwether: false, outperforming: true },
        { symbol: 'MRK', above50: false, isBellwether: false, outperforming: false },
        { symbol: 'PFE', above50: false, isBellwether: false, outperforming: false },
      ],
      a50: false, a200: false, d50: -1.5, d200: -3.2,
      bbBreakouts: 6, bbBusts: 3, bbHitRate: 67,
      riskPosture: 'Defensive', bellwethers: ['LLY', 'UNH', 'JNJ'],
      insight: 'Healthcare underperforming across the board. Below both key MAs with thinning breadth. Defensive but not attracting capital in this cyclical rotation.',
    }),

    XLF: buildMockSector({
      sectorId: 'XLF', name: 'Financials', sectorColor: '#f59e0b', sectorEmoji: '\uD83C\uDFE6',
      quadrant: 'LAGGING', quadrantMeta: { label: 'Lagging', color: '#ef4444', icon: 'arrow-down', narrative: 'Underperforming and decelerating. Avoid or reduce exposure.' },
      momentumScore: -2.8, momentumDir: 'Decelerating', momentumDelta: -0.8,
      maLabel: 'Pulling Back', maColor: '#f59e0b',
      breadthPercent: 38, breadthLabel: 'Thinning', breadthColor: '#f59e0b', breadthTooltip: '31-49% participating. Leadership is narrowing \u2014 watch for cracks.', breadthDirection: 'contracting',
      perfW1: -0.3, perfM1: -0.5, perfM3: -0.9,
      leaderScore: 4.0, leaderHealthy: 5, leaderTotal: 8,
      leaders: [
        { symbol: 'JPM', above50: true, isBellwether: true, outperforming: true },
        { symbol: 'GS', above50: true, isBellwether: false, outperforming: true },
        { symbol: 'BAC', above50: true, isBellwether: false, outperforming: true },
        { symbol: 'WFC', above50: true, isBellwether: false, outperforming: true },
        { symbol: 'MS', above50: true, isBellwether: false, outperforming: true },
        { symbol: 'BRK.B', above50: false, isBellwether: true, outperforming: false },
        { symbol: 'C', above50: false, isBellwether: false, outperforming: false },
        { symbol: 'SCHW', above50: false, isBellwether: false, outperforming: false },
      ],
      a50: false, a200: true, d50: -1.1, d200: 4.3,
      bbBreakouts: 8, bbBusts: 4, bbHitRate: 67,
      riskPosture: 'Offensive', bellwethers: ['BRK.B', 'JPM', 'V'],
      gildedCage: {
        detected: true,
        severity: 'WARNING',
        description: 'Leadership is concentrated while breadth thins. Monitor for cracks in top names.',
        weightedLeadership: 0.72,
        breadthPercent: 38,
        leadershipScore: 4.0,
      },
      insight: 'Financials struggling despite strong top-line leadership. JPM and GS holding up but breadth contracting. Gilded Cage warning \u2014 watch for spread widening.',
    }),

    XLY: buildMockSector({
      sectorId: 'XLY', name: 'Consumer Discretionary', sectorColor: '#8b5cf6', sectorEmoji: '\uD83D\uDECD\uFE0F',
      quadrant: 'LAGGING', quadrantMeta: { label: 'Lagging', color: '#ef4444', icon: 'arrow-down', narrative: 'Underperforming and decelerating. Avoid or reduce exposure.' },
      momentumScore: -4.5, momentumDir: 'Decelerating', momentumDelta: -1.3,
      maLabel: 'Pulling Back', maColor: '#f59e0b',
      breadthPercent: 32, breadthLabel: 'Fragile', breadthColor: '#ef4444', breadthTooltip: '10-30% participating. Narrow leadership, high divergence risk.', breadthDirection: 'contracting',
      perfW1: -0.8, perfM1: -1.8, perfM3: -1.2,
      leaderScore: 4.1, leaderHealthy: 3, leaderTotal: 5,
      leaders: [
        { symbol: 'AMZN', above50: true, isBellwether: true, outperforming: true },
        { symbol: 'TSLA', above50: false, isBellwether: true, outperforming: false },
        { symbol: 'HD', above50: true, isBellwether: true, outperforming: true },
        { symbol: 'MCD', above50: true, isBellwether: false, outperforming: true },
        { symbol: 'NKE', above50: false, isBellwether: false, outperforming: false },
      ],
      a50: false, a200: true, d50: -2.8, d200: 1.9,
      bbBreakouts: 10, bbBusts: 6, bbHitRate: 63,
      riskPosture: 'Offensive', bellwethers: ['AMZN', 'TSLA', 'HD'],
      gildedCage: {
        detected: true,
        severity: 'CRITICAL',
        description: 'A few mega-cap leaders are masking broad sector weakness. High risk of sudden mean-reversion if top names falter.',
        weightedLeadership: 0.62,
        breadthPercent: 32,
        leadershipScore: 4.1,
      },
      insight: 'Discretionary under pressure. TSLA below 50-day MA as bellwether crack emerges. CRITICAL Gilded Cage \u2014 Amazon carrying the sector alone.',
    }),

    XLC: buildMockSector({
      sectorId: 'XLC', name: 'Communication Services', sectorColor: '#14b8a6', sectorEmoji: '\uD83D\uDCE1',
      quadrant: 'LAGGING', quadrantMeta: { label: 'Lagging', color: '#ef4444', icon: 'arrow-down', narrative: 'Underperforming and decelerating. Avoid or reduce exposure.' },
      momentumScore: -5.0, momentumDir: 'Decelerating', momentumDelta: -1.5,
      maLabel: 'Pulling Back', maColor: '#f59e0b',
      breadthPercent: 35, breadthLabel: 'Thinning', breadthColor: '#f59e0b', breadthTooltip: '31-49% participating. Leadership is narrowing \u2014 watch for cracks.', breadthDirection: 'contracting',
      perfW1: -1.2, perfM1: -2.1, perfM3: -1.6,
      leaderScore: 2.5, leaderHealthy: 1, leaderTotal: 3,
      leaders: [
        { symbol: 'META', above50: false, isBellwether: true, outperforming: false },
        { symbol: 'GOOGL', above50: false, isBellwether: true, outperforming: false },
        { symbol: 'NFLX', above50: true, isBellwether: false, outperforming: true },
      ],
      a50: false, a200: true, d50: -3.1, d200: 3.5,
      bbBreakouts: 11, bbBusts: 5, bbHitRate: 69,
      riskPosture: 'Offensive', bellwethers: ['META', 'GOOGL', 'NFLX'],
      gildedCage: {
        detected: true,
        severity: 'CRITICAL',
        description: 'A few mega-cap leaders are masking broad sector weakness. High risk of sudden mean-reversion if top names falter.',
        weightedLeadership: 0.55,
        breadthPercent: 35,
        leadershipScore: 2.5,
      },
      insight: 'Comms in trouble. Both META and GOOGL below 50-day MA \u2014 bellwether failure. Only Netflix holding up. CRITICAL cage with just 35% breadth.',
    }),

    // --- NEUTRAL ---
    XLU: buildMockSector({
      sectorId: 'XLU', name: 'Utilities', sectorColor: '#f97316', sectorEmoji: '\uD83D\uDCA1',
      quadrant: 'NEUTRAL', quadrantMeta: { label: 'Neutral', color: '#8b949e', icon: 'minus', narrative: 'Tracking close to the benchmark. No strong directional signal.' },
      momentumScore: 0.5, momentumDir: 'Steady', momentumDelta: -0.1,
      maLabel: 'Pulling Back', maColor: '#f59e0b',
      breadthPercent: 42, breadthLabel: 'Thinning', breadthColor: '#f59e0b', breadthTooltip: '31-49% participating. Leadership is narrowing \u2014 watch for cracks.', breadthDirection: 'stable',
      perfW1: 0.2, perfM1: 0.8, perfM3: 1.6,
      leaderScore: 3.2, leaderHealthy: 3, leaderTotal: 4,
      leaders: [
        { symbol: 'NEE', above50: true, isBellwether: true, outperforming: true },
        { symbol: 'DUK', above50: true, isBellwether: true, outperforming: true },
        { symbol: 'SO', above50: true, isBellwether: true, outperforming: true },
        { symbol: 'AEP', above50: false, isBellwether: false, outperforming: false },
      ],
      a50: false, a200: true, d50: -0.8, d200: 2.1,
      bbBreakouts: 3, bbBusts: 2, bbHitRate: 60,
      riskPosture: 'Defensive', bellwethers: ['NEE', 'SO', 'DUK'],
      insight: 'Utilities tracking the market with no strong signal. Bellwethers healthy but overall breadth thinning. Classic wait-and-see defensive posture.',
    }),
  },

  global: {
    regime: {
      regime: 'LEANING_CYCLICAL',
      label: 'Leaning Cyclical',
      avgBreadth: 56,
      cyclicalPerf1W: 1.1,
      cyclicalPerf1M: 5.3,
      cyclicalPerf3M: 8.3,
      defensivePerf1W: 0.5,
      defensivePerf1M: 3.8,
      defensivePerf3M: 5.6,
      perfDelta1W: 0.6,
      perfDelta1M: 1.5,
      perfDelta3M: 2.7,
      sectorsPositive3M: 9,
    },
    confidence: 62,
    weather: {
      weather: 'Partly Sunny',
      description: 'Cyclicals leading but not uniformly. Selective opportunities in growth \u2014 stay alert for clouds.',
    },
    sectorCount: 11,
    computedAt: Date.now(),
  },
};

// ===========================================
// COMPONENT
// ===========================================

/**
 * MoneyMapScreen \u2014 Main container for the Money Map feature
 * Phase 3: Renders RegimeBanner + ConfidenceGauge + SectorList with mock data
 * Phase 4 will wire into App.jsx routing with live data
 */
const MoneyMapScreen = () => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSectorId, setExpandedSectorId] = useState(null);

  useEffect(() => {
    // Simulate loading delay for realistic UX
    const timer = setTimeout(() => {
      setData(MOCK_MONEY_MAP_DATA);
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleToggleSector = (sectorId) => {
    setExpandedSectorId(prev => prev === sectorId ? null : sectorId);
  };

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

      {/* Layer 3: Sector Cards */}
      <SectorList
        sectors={data.sectors}
        expandedSectorId={expandedSectorId}
        onToggleSector={handleToggleSector}
      />

      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default MoneyMapScreen;
