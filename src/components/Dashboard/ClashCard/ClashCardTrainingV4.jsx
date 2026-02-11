// ClashCardTrainingV4 - Dashboard card for V4 BaggerBomb training battles
// Shows live point-based scoring (not percentage) with price polling

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Timer } from 'lucide-react';
import TugOfWarBar from './TugOfWarBar';
import { formatTrainingTimer } from '../../../utils/timerFormatters';
import { stockAPI, POPULAR_CRYPTO } from '../../../services/eodhdAPI';
import { flattenPortfolio, calculateAssetScoreV3 } from '../../../utils/baggerBombUtils';

const PRICE_POLL_INTERVAL = 60000; // 60 seconds

const isCryptoSymbol = (symbol) => {
  return POPULAR_CRYPTO.some(c => c.symbol === symbol) || symbol?.endsWith('-USD');
};

export default function ClashCardTrainingV4({ battle, user, remainingMs, onPress }) {
  const [currentPrices, setCurrentPrices] = useState({});

  const timer = formatTrainingTimer(remainingMs);

  // Determine user identity
  const isCreator = battle?.creator?.uid === user?.uid ||
    battle?.creator?.uid === user?.odUserId ||
    battle?.creator?.odUserId === user?.odUserId ||
    battle?.creator?.username === user?.username;

  const myData = isCreator ? battle?.creator : battle?.opponent;
  const oppData = isCreator ? battle?.opponent : battle?.creator;
  const startingPrices = battle?.state?.startingPrices || {};

  // Collect all symbols
  const allSymbols = useMemo(() => {
    const myFlat = flattenPortfolio(myData?.portfolio);
    const oppFlat = flattenPortfolio(oppData?.portfolio);
    const symbols = [
      ...myFlat.map(a => a?.symbol),
      ...oppFlat.map(a => a?.symbol),
    ].filter(Boolean);
    return [...new Set(symbols)];
  }, [myData?.portfolio, oppData?.portfolio]);

  // Fetch prices
  const fetchPrices = useCallback(async () => {
    if (allSymbols.length === 0) return;
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
        } catch {
          if (startingPrices[symbol]) prices[symbol] = startingPrices[symbol];
        }
      }
      if (Object.keys(prices).length > 0) {
        setCurrentPrices(prev => ({ ...prev, ...prices }));
      }
    } catch {
      // Fallback to starting prices
      setCurrentPrices(startingPrices);
    }
  }, [allSymbols, startingPrices]);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, PRICE_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // Calculate score for a portfolio
  const calculateScore = useCallback((portfolio) => {
    const flat = flattenPortfolio(portfolio);
    let total = 0;
    flat.forEach(asset => {
      if (!asset) return;
      const openPrice = startingPrices[asset.symbol] || asset.price || 0;
      const currentPrice = currentPrices[asset.symbol] || openPrice;
      if (!openPrice || openPrice === 0) return;
      const pctChange = ((currentPrice - openPrice) / openPrice) * 100;
      const score = calculateAssetScoreV3(asset, pctChange, { maxMultiplier: 0, minMultiplier: 0 });
      total += score.totalPoints;
    });
    return Math.round(total);
  }, [currentPrices, startingPrices]);

  const myScore = useMemo(() => calculateScore(myData?.portfolio), [calculateScore, myData?.portfolio]);
  const oppScore = useMemo(() => calculateScore(oppData?.portfolio), [calculateScore, oppData?.portfolio]);
  const isWinning = myScore > oppScore;
  const hasPrices = Object.keys(currentPrices).length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      onClick={onPress}
      style={{
        flex: '0 0 auto',
        width: 'calc(85vw - 32px)',
        maxWidth: '340px',
        minWidth: '280px',
        scrollSnapAlign: 'start',
        background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.08) 0%, #161b22 100%)',
        borderRadius: '16px',
        border: '2px solid #9333ea',
        padding: '16px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 0 12px rgba(147, 51, 234, 0.2)',
        transition: 'box-shadow 0.3s ease',
      }}
    >
      {/* Header Row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>💣</span>
          <span style={{
            fontSize: '12px',
            fontWeight: '700',
            color: '#e6edf3',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            BAGGERBOMB AI
          </span>
        </div>

        {/* Timer Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 10px',
          background: `${timer.color}15`,
          borderRadius: '8px',
          border: `1px solid ${timer.color}40`,
          animation: timer.pulse ? 'timer-pulse 1s ease-in-out infinite' : 'none',
        }}>
          <Timer size={12} style={{ color: timer.color }} />
          <span style={{
            fontSize: '12px',
            fontWeight: '700',
            color: timer.color,
            fontFamily: "'SF Mono', 'Monaco', monospace",
          }}>
            {timer.text}
          </span>
        </div>
      </div>

      {/* Main Stats */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        {/* Score Display */}
        <div>
          <span style={{
            fontSize: '12px',
            color: '#8b949e',
            fontWeight: '500',
            display: 'block',
            marginBottom: '4px',
          }}>
            Your Score:
          </span>
          <span style={{
            fontSize: '26px',
            fontWeight: '800',
            color: !hasPrices ? '#6e7681' : myScore >= 0 ? '#10b981' : '#ef4444',
            fontFamily: "'SF Mono', 'Monaco', monospace",
          }}>
            {hasPrices ? `${myScore >= 0 ? '+' : ''}${myScore} pts` : '...'}
          </span>
        </div>

        {/* Opponent Score */}
        <div style={{ textAlign: 'right' }}>
          <span style={{
            fontSize: '12px',
            color: '#8b949e',
            fontWeight: '500',
            display: 'block',
            marginBottom: '4px',
          }}>
            vs CPU:
          </span>
          <span style={{
            fontSize: '16px',
            fontWeight: '700',
            color: !hasPrices ? '#6e7681' : oppScore >= 0 ? '#10b981' : '#ef4444',
            fontFamily: "'SF Mono', 'Monaco', monospace",
          }}>
            {hasPrices ? `${oppScore >= 0 ? '+' : ''}${oppScore} pts` : '...'}
          </span>
        </div>
      </div>

      {/* Tug of War Bar */}
      <TugOfWarBar
        myGain={myScore}
        theirGain={oppScore}
        isWinning={isWinning}
        isTraining={true}
        height={4}
      />
    </motion.div>
  );
}
