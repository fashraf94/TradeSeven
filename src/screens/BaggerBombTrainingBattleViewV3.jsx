// BaggerBombTrainingBattleViewV3 - Training-specific wrapper for V3 battle view
// Adapts local training battle data to the format expected by BaggerBombBattleView

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import BaggerBombBattleView from './BaggerBombBattleView';
import { HOLO_COLORS } from '../constants/holoTheme';
import { motion } from 'framer-motion';
import { stockAPI, POPULAR_CRYPTO } from '../services/eodhdAPI';
import { getVolatilityThresholds } from '../services/volatilityService';
import { flattenPortfolio } from '../utils/baggerBombUtils';
import {
  getCurrentSession,
  getSessionTimeRemaining,
  calculateAssetScore,
  isCrypto,
} from '../hooks/useBaggerBombBattle';

const PRICE_POLL_INTERVAL = 60000; // 60 seconds

/**
 * Flatten bench to array format
 */
const flattenBench = (bench) => {
  if (!bench) return [];
  if (Array.isArray(bench)) return bench;
  const stocks = bench.stocks || [];
  const crypto = bench.crypto ? [bench.crypto] : [];
  return [...stocks, ...crypto];
};

/**
 * BaggerBombTrainingBattleViewV3 - Training wrapper for V3 view
 */
export default function BaggerBombTrainingBattleViewV3({
  battle,
  user,
  onBack,
}) {
  // State
  const [currentPrices, setCurrentPrices] = useState({});
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [thresholds, setThresholds] = useState({});
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(0);

  // Determine if user is creator
  const isCreator = battle?.creator?.uid === user?.uid ||
                    battle?.creator?.uid === user?.odUserId ||
                    battle?.creator?.odUserId === user?.odUserId ||
                    battle?.creator?.username === user?.username;

  // Get raw portfolio data
  const myData = isCreator ? battle?.creator : battle?.opponent;
  const oppData = isCreator ? battle?.opponent : battle?.creator;

  // Get starting prices from battle
  const startingPrices = battle?.state?.startingPrices || {};

  // Current session
  const currentSession = useMemo(() => getCurrentSession(), []);
  const currentSessionId = currentSession?.id || '';

  // Collect all symbols for price fetching
  const allSymbols = useMemo(() => {
    const myPortfolio = flattenPortfolio(myData?.portfolio);
    const oppPortfolio = flattenPortfolio(oppData?.portfolio);
    const myBench = flattenBench(myData?.bench);
    const oppBench = flattenBench(oppData?.bench);

    const symbols = [
      ...myPortfolio.map(a => a?.symbol),
      ...oppPortfolio.map(a => a?.symbol),
      ...myBench.map(a => a?.symbol),
      ...oppBench.map(a => a?.symbol),
    ].filter(Boolean);

    return [...new Set(symbols)];
  }, [myData, oppData]);

  // Fetch current prices
  const fetchPrices = useCallback(async () => {
    if (allSymbols.length === 0) {
      setLoadingPrices(false);
      return;
    }

    try {
      const prices = {};

      for (const symbol of allSymbols) {
        try {
          const isCryptoSymbol = isCrypto(symbol);
          if (isCryptoSymbol) {
            const data = await stockAPI.getCryptoPrice(symbol);
            if (data?.price) prices[symbol] = data.price;
          } else {
            const data = await stockAPI.getStockPrice(symbol);
            if (data?.price) prices[symbol] = data.price;
          }
        } catch (err) {
          console.warn(`Failed to fetch price for ${symbol}`);
          // Use starting price as fallback
          if (startingPrices[symbol]) {
            prices[symbol] = startingPrices[symbol];
          }
        }
      }

      setCurrentPrices(prev => ({ ...prev, ...prices }));
      setLoadingPrices(false);
    } catch (error) {
      console.error('[TrainingBattleV3] Error fetching prices:', error);
      setCurrentPrices(startingPrices);
      setLoadingPrices(false);
    }
  }, [allSymbols, startingPrices]);

  // Load thresholds
  useEffect(() => {
    const loadThresholds = async () => {
      if (allSymbols.length === 0) return;

      const stockSymbols = allSymbols.filter(s => !isCrypto(s));
      const cryptoSymbols = allSymbols.filter(s => isCrypto(s));

      try {
        const [stockThresholds, cryptoThresholds] = await Promise.all([
          stockSymbols.length > 0 ? getVolatilityThresholds(stockSymbols, 'stock') : {},
          cryptoSymbols.length > 0 ? getVolatilityThresholds(cryptoSymbols, 'crypto') : {},
        ]);
        setThresholds({ ...stockThresholds, ...cryptoThresholds });
      } catch (error) {
        console.error('[TrainingBattleV3] Error loading thresholds:', error);
      }
    };
    loadThresholds();
  }, [allSymbols]);

  // Initial price fetch + polling
  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, PRICE_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // Session timer
  useEffect(() => {
    const updateTimer = () => {
      const remaining = getSessionTimeRemaining();
      if (typeof remaining === 'number') {
        setSessionTimeRemaining(remaining * 60); // Convert minutes to seconds
      } else if (remaining && typeof remaining === 'object') {
        const seconds = (remaining.hours || 0) * 3600 + (remaining.minutes || 0) * 60 + (remaining.seconds || 0);
        setSessionTimeRemaining(seconds);
      }
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Enrich asset with live data for TacticalRow
   */
  const enrichAsset = useCallback((asset) => {
    if (!asset) return null;

    const startPrice = startingPrices[asset.symbol] || asset.price || 0;
    const currentPrice = currentPrices[asset.symbol] || startPrice;
    const threshold = thresholds[asset.symbol] || {};
    const baseATR = threshold.threshold || 2.5;

    // Calculate price change percentage
    const priceChange = startPrice > 0
      ? ((currentPrice - startPrice) / startPrice) * 100
      : 0;

    // Calculate points using the hook's scoring function
    const score = calculateAssetScore(
      asset,
      startPrice,
      currentPrice,
      threshold,
      1000000 // $1M portfolio
    );

    // Determine badges
    const badges = [];
    const multiplier = Math.abs(priceChange) / baseATR;
    if (multiplier >= 1.0) badges.push(priceChange >= 0 ? 'bagger' : 'bust');
    if (multiplier >= 1.5) badges.push(priceChange >= 0 ? 'rally' : 'crash');
    if (multiplier >= 2.0) badges.push(priceChange >= 0 ? 'moonshot' : 'meltdown');

    return {
      ...asset,
      priceChange,
      baseATR,
      points: score.totalPoints || 0,
      badges,
      history: {
        maxMultiplier: Math.max(0, multiplier),
        minMultiplier: Math.min(0, priceChange < 0 ? -multiplier : 0),
      },
    };
  }, [currentPrices, startingPrices, thresholds]);

  /**
   * Build enriched portfolio object with tiered structure
   */
  const buildEnrichedPortfolio = useCallback((rawPortfolio) => {
    if (!rawPortfolio) return { star: [], core: [], support: [] };

    // Handle V3 tiered format
    if (rawPortfolio.star || rawPortfolio.core || rawPortfolio.support) {
      return {
        star: (rawPortfolio.star || []).map(enrichAsset).filter(Boolean),
        core: (rawPortfolio.core || []).map(enrichAsset).filter(Boolean),
        support: (rawPortfolio.support || []).map(enrichAsset).filter(Boolean),
      };
    }

    // Handle flat array format (V2 compatibility)
    if (Array.isArray(rawPortfolio)) {
      const enriched = rawPortfolio.map(enrichAsset).filter(Boolean);
      return {
        star: enriched.slice(0, 2),
        core: enriched.slice(2, 4),
        support: enriched.slice(4, 7),
      };
    }

    return { star: [], core: [], support: [] };
  }, [enrichAsset]);

  /**
   * Build enriched bench object
   */
  const buildEnrichedBench = useCallback((rawBench) => {
    if (!rawBench) return { stocks: [], crypto: null };

    if (Array.isArray(rawBench)) {
      return {
        stocks: rawBench.map(enrichAsset).filter(Boolean),
        crypto: null,
      };
    }

    return {
      stocks: (rawBench.stocks || []).map(enrichAsset).filter(Boolean),
      crypto: rawBench.crypto ? enrichAsset(rawBench.crypto) : null,
    };
  }, [enrichAsset]);

  /**
   * Calculate total points for a portfolio
   */
  const calculateTotalPoints = useCallback((portfolio) => {
    const allAssets = [
      ...(portfolio.star || []),
      ...(portfolio.core || []),
      ...(portfolio.support || []),
    ];
    return allAssets.reduce((sum, asset) => sum + (asset?.points || 0), 0);
  }, []);

  /**
   * Count bombs and busts
   */
  const countBadges = useCallback((portfolio) => {
    const allAssets = [
      ...(portfolio.star || []),
      ...(portfolio.core || []),
      ...(portfolio.support || []),
    ];

    let baggerBombs = 0;
    let busts = 0;

    allAssets.forEach(asset => {
      if (asset?.badges?.includes('bagger') || asset?.badges?.includes('rally') || asset?.badges?.includes('moonshot')) {
        baggerBombs++;
      }
      if (asset?.badges?.includes('bust') || asset?.badges?.includes('crash') || asset?.badges?.includes('meltdown')) {
        busts++;
      }
    });

    return { baggerBombs, busts };
  }, []);

  // Build player data
  const player = useMemo(() => {
    const portfolio = buildEnrichedPortfolio(myData?.portfolio);
    const bench = buildEnrichedBench(myData?.bench);
    const totalPoints = calculateTotalPoints(portfolio);
    const { baggerBombs, busts } = countBadges(portfolio);

    return {
      id: myData?.odUserId || myData?.uid || 'player',
      username: myData?.username || myData?.odUsername || 'You',
      avatar: myData?.avatar,
      totalPoints: Math.round(totalPoints),
      sessionPoints: Math.round(totalPoints), // Training uses single session
      baggerBombs,
      busts,
      portfolio,
      bench,
    };
  }, [myData, buildEnrichedPortfolio, buildEnrichedBench, calculateTotalPoints, countBadges]);

  // Build opponent data (CPU)
  const opponent = useMemo(() => {
    const portfolio = buildEnrichedPortfolio(oppData?.portfolio);
    const bench = buildEnrichedBench(oppData?.bench);
    const totalPoints = calculateTotalPoints(portfolio);
    const { baggerBombs, busts } = countBadges(portfolio);

    return {
      id: oppData?.odUserId || 'cpu',
      username: oppData?.username || 'CPU Opponent',
      avatar: '🤖', // Robot emoji for CPU
      totalPoints: Math.round(totalPoints),
      sessionPoints: Math.round(totalPoints),
      baggerBombs,
      busts,
      portfolio,
      bench,
    };
  }, [oppData, buildEnrichedPortfolio, buildEnrichedBench, calculateTotalPoints, countBadges]);

  // Loading state
  if (loadingPrices && Object.keys(currentPrices).length === 0) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: HOLO_COLORS.bgDeep,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          style={{
            width: '40px',
            height: '40px',
            border: `3px solid ${HOLO_COLORS.cyan}30`,
            borderTopColor: HOLO_COLORS.cyan,
            borderRadius: '50%',
          }}
        />
      </div>
    );
  }

  return (
    <BaggerBombBattleView
      battle={battle}
      player={player}
      opponent={opponent}
      currentSession={currentSessionId}
      sessionTimeRemaining={sessionTimeRemaining}
      sessionScores={{}}
      completedSessions={[]}
      events={[]}
      onBack={onBack}
      nightMode={currentSessionId === 'NIGHT_GAME'}
      isTraining={true}
      thresholds={thresholds}
      currentPrices={currentPrices}
    />
  );
}

BaggerBombTrainingBattleViewV3.propTypes = {
  /** Training battle object with creator/opponent data */
  battle: PropTypes.shape({
    creator: PropTypes.object,
    opponent: PropTypes.object,
    state: PropTypes.shape({
      startingPrices: PropTypes.object,
    }),
  }).isRequired,
  /** Current user object */
  user: PropTypes.shape({
    uid: PropTypes.string,
    odUserId: PropTypes.string,
    username: PropTypes.string,
  }),
  /** Callback when back button pressed */
  onBack: PropTypes.func,
};

BaggerBombTrainingBattleViewV3.defaultProps = {
  user: null,
  onBack: () => {},
};
