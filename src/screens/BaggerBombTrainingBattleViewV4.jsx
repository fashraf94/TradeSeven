// BaggerBombTrainingBattleViewV4 - V4 Training-specific wrapper
// Adapts local training battle data to the format expected by BaggerBombBattleView
// V4: No bench, no sessions, 1 swap total, free agents generated client-side, 1-day duration

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import BaggerBombBattleView from './BaggerBombBattleView';
import { HOLO_COLORS } from '../constants/holoTheme';
import { motion } from 'framer-motion';
import { stockAPI, POPULAR_CRYPTO } from '../services/eodhdAPI';
import { getVolatilityThresholds } from '../services/volatilityService';
import { flattenPortfolio, calculateAssetScoreV3 } from '../utils/baggerBombUtils';
import { CONVICTION_MULTIPLIERS } from '../constants/baggerBombScoring';
import { generateFreeAgentPool } from '../services/freeAgentRotationService';
import { getFreeAgentConfig } from '../constants/battleTimingV4';

const PRICE_POLL_INTERVAL = 60000; // 60 seconds
const ROTATION_INTERVAL_MS = 5_400_000; // 90 min for local training

const isCryptoSymbol = (symbol) => {
  return POPULAR_CRYPTO.some(c => c.symbol === symbol) || symbol?.endsWith('-USD');
};

/**
 * BaggerBombTrainingBattleViewV4 - Training wrapper for V4
 */
export default function BaggerBombTrainingBattleViewV4({
  battle,
  user,
  onBack,
}) {
  // State
  const [currentPrices, setCurrentPrices] = useState({});
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [thresholds, setThresholds] = useState({});

  // Free agent state (local, not Firebase)
  const [freeAgents, setFreeAgents] = useState([]);
  const [rotationCountdown, setRotationCountdown] = useState(0);
  const nextRotationRef = useRef(null);
  const rotationCountRef = useRef(0);

  // Swap state
  const [swapUsed, setSwapUsed] = useState(false);
  const [closedTrades, setClosedTrades] = useState([]);
  const [localPortfolio, setLocalPortfolio] = useState(null);

  // Swap modal state
  const [swapModalState, setSwapModalState] = useState({
    isOpen: false,
    incomingSymbol: '',
    incomingName: '',
    incomingIsCrypto: false,
  });
  const [isSwapExecuting, setIsSwapExecuting] = useState(false);

  // Determine if user is creator
  const isCreator = battle?.creator?.uid === user?.uid ||
                    battle?.creator?.uid === user?.odUserId ||
                    battle?.creator?.odUserId === user?.odUserId ||
                    battle?.creator?.username === user?.username;

  const myData = isCreator ? battle?.creator : battle?.opponent;
  const oppData = isCreator ? battle?.opponent : battle?.creator;
  const startingPrices = battle?.state?.startingPrices || {};

  // Use local portfolio if swap has occurred, otherwise use battle portfolio
  const myPortfolioRaw = localPortfolio || myData?.portfolio;

  // Collect all symbols for price fetching (no bench in V4)
  const allSymbols = useMemo(() => {
    const myPortfolio = flattenPortfolio(myPortfolioRaw);
    const oppPortfolio = flattenPortfolio(oppData?.portfolio);
    const freeAgentSymbols = freeAgents.map(a => a.symbol);

    const symbols = [
      ...myPortfolio.map(a => a?.symbol),
      ...oppPortfolio.map(a => a?.symbol),
      ...freeAgentSymbols,
    ].filter(Boolean);

    return [...new Set(symbols)];
  }, [myPortfolioRaw, oppData, freeAgents]);

  // Initialize free agents on mount
  useEffect(() => {
    const config = getFreeAgentConfig();
    const pool = generateFreeAgentPool(0, config.mode);
    setFreeAgents(pool);
    nextRotationRef.current = Date.now() + config.rotationMs;
    setRotationCountdown(Math.floor(config.rotationMs / 1000));
  }, []);

  // Rotation countdown + auto-rotate
  useEffect(() => {
    const interval = setInterval(() => {
      if (!nextRotationRef.current) return;
      const remaining = Math.max(0, Math.floor((nextRotationRef.current - Date.now()) / 1000));
      setRotationCountdown(remaining);

      if (remaining === 0) {
        rotationCountRef.current += 1;
        const config = getFreeAgentConfig();
        const pool = generateFreeAgentPool(rotationCountRef.current, config.mode);
        setFreeAgents(pool);
        nextRotationRef.current = Date.now() + config.rotationMs;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Fetch prices
  const fetchPrices = useCallback(async () => {
    if (allSymbols.length === 0) {
      setLoadingPrices(false);
      return;
    }

    try {
      const prices = {};
      for (const symbol of allSymbols) {
        try {
          if (isCryptoSymbol(symbol)) {
            const data = await stockAPI.getCryptoPrice(symbol);
            if (data?.price) prices[symbol] = data.price;
          } else {
            const data = await stockAPI.getStockPrice(symbol);
            if (data?.price) prices[symbol] = data.price;
          }
        } catch (err) {
          if (startingPrices[symbol]) prices[symbol] = startingPrices[symbol];
        }
      }

      setCurrentPrices(prev => ({ ...prev, ...prices }));
      setLoadingPrices(false);
    } catch (error) {
      console.error('[TrainingBattleV4] Error fetching prices:', error);
      setCurrentPrices(startingPrices);
      setLoadingPrices(false);
    }
  }, [allSymbols, startingPrices]);

  // Load thresholds
  useEffect(() => {
    const loadThresholds = async () => {
      if (allSymbols.length === 0) return;
      const stockSymbols = allSymbols.filter(s => !isCryptoSymbol(s));
      const cryptoSymbols = allSymbols.filter(s => isCryptoSymbol(s));

      try {
        const [stockT, cryptoT] = await Promise.all([
          stockSymbols.length > 0 ? getVolatilityThresholds(stockSymbols, 'stock') : {},
          cryptoSymbols.length > 0 ? getVolatilityThresholds(cryptoSymbols, 'crypto') : {},
        ]);
        setThresholds(prev => ({ ...prev, ...stockT, ...cryptoT }));
      } catch (error) {
        console.error('[TrainingBattleV4] Error loading thresholds:', error);
      }
    };
    loadThresholds();
  }, [allSymbols]);

  // Price polling
  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, PRICE_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // Enrich asset with live data and scoring
  const enrichAsset = useCallback((asset, tier) => {
    if (!asset) return null;
    const openPrice = asset.swapPrice || startingPrices[asset.symbol] || asset.price || 0;
    const currentPrice = currentPrices[asset.symbol] || openPrice;
    const threshold = thresholds[asset.symbol] || {};
    const baseATR = threshold.threshold || 2.5;
    const priceChange = openPrice > 0 ? ((currentPrice - openPrice) / openPrice) * 100 : 0;
    const multiplier = baseATR > 0 ? priceChange / baseATR : 0;

    const history = {
      maxMultiplier: multiplier > 0 ? multiplier : 0,
      minMultiplier: multiplier < 0 ? multiplier : 0,
    };

    const score = calculateAssetScoreV3(
      { ...asset, baseATR, tier },
      priceChange,
      history
    );

    return {
      ...asset,
      priceChange,
      baseATR,
      points: score.totalPoints,
      badges: score.badges,
      history,
      tierMultiplier: score.tierMultiplier,
    };
  }, [currentPrices, startingPrices, thresholds]);

  // Build enriched portfolio (pass tier for conviction multiplier)
  const buildEnrichedPortfolio = useCallback((rawPortfolio) => {
    if (!rawPortfolio) return { star: [], core: [], support: [] };
    if (rawPortfolio.star || rawPortfolio.core || rawPortfolio.support) {
      return {
        star: (rawPortfolio.star || []).map(a => enrichAsset(a, 'star')).filter(Boolean),
        core: (rawPortfolio.core || []).map(a => enrichAsset(a, 'core')).filter(Boolean),
        support: (rawPortfolio.support || []).map(a => enrichAsset(a, 'support')).filter(Boolean),
      };
    }
    return { star: [], core: [], support: [] };
  }, [enrichAsset]);

  // Calculate total points
  const calculateTotalPoints = useCallback((portfolio) => {
    const allAssets = [
      ...(portfolio.star || []),
      ...(portfolio.core || []),
      ...(portfolio.support || []),
    ];
    return allAssets.reduce((sum, asset) => sum + (asset?.points || 0), 0);
  }, []);

  // Count badges
  const countBadges = useCallback((portfolio) => {
    const allAssets = [
      ...(portfolio.star || []),
      ...(portfolio.core || []),
      ...(portfolio.support || []),
    ];
    let baggerBombs = 0;
    let busts = 0;
    allAssets.forEach(asset => {
      if (asset?.badges?.some(b => ['bagger', 'doubleBagger', 'tenBagger'].includes(b))) baggerBombs++;
      if (asset?.badges?.some(b => ['bust', 'crash', 'meltdown'].includes(b))) busts++;
    });
    return { baggerBombs, busts };
  }, []);

  // Handle swap request from FreeAgentBar
  const handleSwapRequest = useCallback((agent) => {
    if (swapUsed) return;
    setSwapModalState({
      isOpen: true,
      incomingSymbol: agent.symbol,
      incomingName: agent.name || '',
      incomingIsCrypto: Boolean(agent.isCrypto),
    });
  }, [swapUsed]);

  const closeSwapModal = useCallback(() => {
    setSwapModalState({
      isOpen: false,
      incomingSymbol: '',
      incomingName: '',
      incomingIsCrypto: false,
    });
  }, []);

  // Execute local swap (no Firebase for training)
  const executeSwap = useCallback(({ outTier, outSlotIndex, inSymbol }) => {
    if (swapUsed) return;

    setIsSwapExecuting(true);

    try {
      const portfolio = localPortfolio || { ...myData?.portfolio };
      const outAsset = portfolio[outTier]?.[outSlotIndex];
      const inAgent = freeAgents.find(a => a.symbol === inSymbol);
      if (!outAsset || !inAgent) throw new Error('Asset not found');

      // Type check
      const outIsCrypto = Boolean(outAsset.isCrypto);
      const inIsCrypto = Boolean(inAgent.isCrypto);
      if (outIsCrypto !== inIsCrypto) throw new Error('Type mismatch');

      // Calculate locked points for outgoing
      const openPrice = outAsset.swapPrice || startingPrices[outAsset.symbol] || outAsset.price || 0;
      const exitPrice = currentPrices[outAsset.symbol] || openPrice;
      const lockedGainPct = openPrice > 0 ? ((exitPrice - openPrice) / openPrice) * 100 : 0;

      const closedTrade = {
        symbol: outAsset.symbol,
        name: outAsset.name || outAsset.symbol,
        tier: outTier,
        slotIndex: outSlotIndex,
        entryPrice: openPrice,
        exitPrice,
        lockedPoints: Math.round(lockedGainPct * 10) / 10, // Simplified scoring for training
        lockedGainPct: Math.round(lockedGainPct * 1000) / 1000,
        swappedOutAt: new Date().toISOString(),
      };

      // Build new portfolio
      const newPortfolio = {
        star: [...(portfolio.star || [])],
        core: [...(portfolio.core || [])],
        support: [...(portfolio.support || [])],
      };

      newPortfolio[outTier] = [...newPortfolio[outTier]];
      newPortfolio[outTier][outSlotIndex] = {
        symbol: inAgent.symbol,
        name: inAgent.name,
        isCrypto: inAgent.isCrypto,
        swapPrice: currentPrices[inSymbol] || 0,
        swappedInAt: new Date().toISOString(),
      };

      setLocalPortfolio(newPortfolio);
      setClosedTrades(prev => [...prev, closedTrade]);
      setSwapUsed(true);
      closeSwapModal();
    } catch (error) {
      console.error('[TrainingV4] Swap error:', error);
    } finally {
      setIsSwapExecuting(false);
    }
  }, [swapUsed, localPortfolio, myData, freeAgents, startingPrices, currentPrices, closeSwapModal]);

  // Build player data
  const player = useMemo(() => {
    const portfolio = buildEnrichedPortfolio(myPortfolioRaw);
    const totalPoints = calculateTotalPoints(portfolio);
    const { baggerBombs, busts } = countBadges(portfolio);
    const closedPts = closedTrades.reduce((sum, t) => sum + (t.lockedPoints || 0), 0);

    return {
      id: myData?.odUserId || myData?.uid || 'player',
      username: myData?.username || myData?.odUsername || 'You',
      avatar: myData?.avatar,
      totalPoints: Math.round(totalPoints + closedPts),
      baggerBombs,
      busts,
      portfolio,
    };
  }, [myPortfolioRaw, buildEnrichedPortfolio, calculateTotalPoints, countBadges, myData, closedTrades]);

  // Build opponent data (CPU)
  const opponent = useMemo(() => {
    const portfolio = buildEnrichedPortfolio(oppData?.portfolio);
    const totalPoints = calculateTotalPoints(portfolio);
    const { baggerBombs, busts } = countBadges(portfolio);

    return {
      id: oppData?.odUserId || 'cpu',
      username: oppData?.username || 'CPU Opponent',
      avatar: null,
      totalPoints: Math.round(totalPoints),
      baggerBombs,
      busts,
      portfolio,
    };
  }, [oppData, buildEnrichedPortfolio, calculateTotalPoints, countBadges]);

  // Loading
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
      events={[]}
      onBack={onBack}
      nightMode={false}
      isTraining={true}
      thresholds={thresholds}
      currentPrices={currentPrices}
      // V4 props
      battleVersion={4}
      freeAgents={freeAgents}
      startingPrices={startingPrices}
      swapsRemaining={swapUsed ? 0 : 1}
      onSwapRequest={handleSwapRequest}
      currentDay={1}
      totalDays={1}
      rotationCountdown={rotationCountdown}
      closedTrades={closedTrades}
      swapModalState={swapModalState}
      onCloseSwapModal={closeSwapModal}
      onConfirmSwap={executeSwap}
      isSwapExecuting={isSwapExecuting}
    />
  );
}

BaggerBombTrainingBattleViewV4.propTypes = {
  /** Training battle object */
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

BaggerBombTrainingBattleViewV4.defaultProps = {
  user: null,
  onBack: () => {},
};
