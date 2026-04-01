// AgentBattleScreen - Redesigned with 3-tab layout:
// Matchups (BaggerBomb matchup rows) | Command Center (agent controls + feed) | Film Room
//
// Data sources:
//   1. `battle` prop (training battle) — both portfolios + starting prices
//   2. useAgentBattle (agentBattles doc) — status feed, controls, scores, trades, thresholds
//   3. useWebSocketPrices + EODHD polling — live prices for matchup view

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Activity, Bot } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import useAgentBattleId from '../hooks/useAgentBattleId';
import useAgentBattle from '../hooks/useAgentBattle';
import AnimatedScore from '../components/shared/AnimatedScore';
import ExecutionModeToggle from '../components/Agent/ExecutionModeToggle';
import StrategyPresetBadge from '../components/Agent/StrategyPresetBadge';
import HypothesisTicker from '../components/Agent/HypothesisTicker';
import AgentActivityFeed from '../components/Agent/AgentActivityFeed';
import AgentFilmRoom from '../components/Agent/AgentFilmRoom';
import ForgeCitationCard from '../components/Agent/ForgeCitationCard';
import ProposalBanner from '../components/Agent/ProposalBanner';
import DebateModal from '../components/Agent/DebateModal';
import { addFeedBookmark, removeFeedBookmark } from '../services/agentService';
import TacticalRow from '../components/BaggerBomb/TacticalRow';
import ClosedTradesSection from '../components/BaggerBomb/ClosedTradesSection';
import { useWebSocketPrices } from '../hooks/useWebSocketPrices';
import { stockAPI, POPULAR_CRYPTO } from '../services/eodhdAPI';
import { calculateAssetScoreV3 } from '../utils/baggerBombUtils';
import { DEFAULT_THRESHOLD, buildResearchAsset } from '../utils/researchAssetBuilder';
import AssetResearchModal from '../components/draft/AssetResearchModal';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRICE_POLL_INTERVAL = 60000; // 60s

const TIERS = [
  { key: 'star', label: 'Star Picks', emoji: '⭐', allocation: '2x', slots: 2 },
  { key: 'core', label: 'Core Holds', emoji: '💎', allocation: '1.5x', slots: 2 },
  { key: 'support', label: 'Support Plays', emoji: '📊', allocation: '1x', slots: 3, hasCrypto: true },
];

const TIER_HEADER_COLORS = {
  star:    { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)' },
  core:    { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  support: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
};

const TAB_KEYS = ['matchups', 'command', 'filmroom'];
const TAB_LABELS = { matchups: 'Matchups', command: 'Command Center', filmroom: 'Film Room' };

const isCryptoSymbol = (symbol) => {
  return POPULAR_CRYPTO.some(c => c.symbol === symbol) || symbol?.endsWith('-USD');
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeDayLabel(timing) {
  if (!timing) return '';
  const { tradingDays, currentTradingDay } = timing;
  const total = tradingDays?.length || 0;
  if (total <= 1) return '';
  const current = currentTradingDay || 1;
  return `Day ${current} of ${total}`;
}

function computeTugOfWarWidth(myScore, oppScore) {
  const total = Math.abs(myScore) + Math.abs(oppScore);
  if (total === 0) return 50;
  return Math.max(10, Math.min(90, (Math.abs(myScore) / total) * 100));
}

// ─── Responsive hook ──────────────────────────────────────────────────────────

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' && window.innerWidth >= 768
  );
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

const staggerSpring = { type: 'spring', stiffness: 200, damping: 20 };

// ─── Tier Header ──────────────────────────────────────────────────────────────

function TierHeader({ tier }) {
  const colors = TIER_HEADER_COLORS[tier.key] || TIER_HEADER_COLORS.support;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 12px 6px',
      position: 'sticky',
      top: 0,
      zIndex: 5,
      background: 'rgba(13, 14, 18, 0.95)',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14 }}>{tier.emoji}</span>
        <span style={{
          fontSize: 13,
          fontWeight: 700,
          background: 'linear-gradient(90deg, #5eead4, #a78bfa)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '0.02em',
        }}>
          {tier.label}
        </span>
      </div>
      <span style={{
        fontSize: 10,
        fontWeight: 700,
        color: colors.color,
        background: colors.bg,
        padding: '2px 8px',
        borderRadius: 6,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        {tier.emoji} {tier.allocation} each
      </span>
    </div>
  );
}

// ─── Score Header ─────────────────────────────────────────────────────────────

function ScoreHeader({ agentBattle, tokens, isDesktop, playerScore, opponentScore }) {
  const myScore = playerScore ?? (agentBattle?.scoreState?.currentScore || 0);
  const oppScore = opponentScore ?? (agentBattle?.scoreState?.opponentScore || 0);
  const dayLabel = computeDayLabel(agentBattle?.timing);
  const agentName = agentBattle?.agentContext?.agentName || 'Your Agent';
  const tradeCount = agentBattle?.scoreState?.tradeCount || 0;

  const myWidth = computeTugOfWarWidth(myScore, oppScore);
  const isLeading = myScore >= oppScore;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...staggerSpring, delay: 0 }}
      style={{
        padding: isDesktop ? '14px 24px 10px' : '10px 16px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {/* Names + Scores row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        {/* Left: Agent */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            marginBottom: 2,
          }}>
            <Bot size={12} color="#5eead4" />
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: tokens.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              {agentName}
            </span>
          </div>
          <AnimatedScore value={myScore} defaultColor="#5eead4" size={28} />
        </div>

        {/* Center: Day label + trade count */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}>
          {dayLabel && (
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              color: tokens.textFaint,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              {dayLabel}
            </span>
          )}
          {tradeCount > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 10,
              color: tokens.textFaint,
            }}>
              <Activity size={9} />
              <span>{tradeCount} trade{tradeCount !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Right: CPU */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            marginBottom: 2,
          }}>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: tokens.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              CPU
            </span>
          </div>
          <AnimatedScore
            value={oppScore}
            defaultColor={tokens.textFaint || '#64748b'}
            size={28}
          />
        </div>
      </div>

      {/* Tug-of-war bar */}
      <div style={{
        width: '100%',
        height: 6,
        borderRadius: 3,
        background: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
        display: 'flex',
      }}>
        <motion.div
          animate={{ width: `${myWidth}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          style={{
            height: '100%',
            background: isLeading
              ? 'linear-gradient(90deg, #5eead4, #2dd4bf)'
              : 'rgba(94,234,212,0.4)',
            borderRadius: '3px 0 0 3px',
          }}
        />
        <div style={{
          width: 2,
          height: '100%',
          background: 'rgba(255,255,255,0.15)',
          flexShrink: 0,
        }} />
        <div style={{
          flex: 1,
          height: '100%',
          background: !isLeading
            ? 'linear-gradient(90deg, #ef4444, #dc2626)'
            : 'rgba(239,68,68,0.3)',
          borderRadius: '0 3px 3px 0',
        }} />
      </div>
    </motion.div>
  );
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

function TabBar({ activeTab, onTabChange, hasCommandDot, commandDotColor, hasFilmRoomDot, isDesktop }) {
  return (
    <div style={{
      display: 'flex',
      gap: 4,
      padding: isDesktop ? '6px 24px 8px' : '6px 12px 8px',
      background: 'transparent',
    }}>
      {TAB_KEYS.map(key => {
        const isActive = activeTab === key;
        const showDot = (key === 'command' && hasCommandDot) || (key === 'filmroom' && hasFilmRoomDot);
        const dotColor = key === 'command' ? commandDotColor : '#5eead4';
        return (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            style={{
              flex: 1,
              padding: '7px 4px',
              fontSize: 11,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? '#0D0E12' : 'rgba(255,255,255,0.5)',
              background: isActive ? '#5eead4' : 'rgba(255,255,255,0.06)',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.15s ease',
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }}
          >
            {TAB_LABELS[key]}
            {showDot && (
              <span style={{
                position: 'absolute',
                top: 3,
                right: 6,
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: dotColor,
                border: '1.5px solid #0D0E12',
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Section Label ────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 9,
      fontWeight: 700,
      color: 'rgba(255,255,255,0.25)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      padding: '0 2px',
      marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AgentBattleScreen({ battle, user, onBack }) {
  const { tokens } = useTheme();
  const isDesktop = useIsDesktop();

  // Tab state
  const [activeTab, setActiveTab] = useState('matchups');

  // Modal state
  const [filterTicker, setFilterTicker] = useState(null);
  const [debateOpen, setDebateOpen] = useState(false);
  const [debateSymbol, setDebateSymbol] = useState(null);
  const [citationOpen, setCitationOpen] = useState(false);
  const [citationRuleId, setCitationRuleId] = useState(null);
  const [researchAsset, setResearchAsset] = useState(null);

  // Price state
  const [currentPrices, setCurrentPrices] = useState({});
  const [previousClosePrices, setPreviousClosePrices] = useState({});
  const [loadingPrices, setLoadingPrices] = useState(true);

  // Notification dot tracking
  const lastSeenFeedLengthRef = useRef(0);

  // ── Agent battle data ─────────────────────────────────────────────────────

  // Use direct agentBattleId if available (from dashboard), else look up via agentId
  const directId = battle?.agentBattleId || null;
  const { agentBattleId: queriedId, loading: idLoading } = useAgentBattleId(directId ? null : battle?.agentId);
  const agentBattleId = directId || queriedId;
  const {
    battle: agentBattle,
    statusFeed,
    executionMode,
    pendingProposal,
    strategyPreset,
    gameplanMeeting,
    feedBookmarks,
    loading: battleLoading,
  } = useAgentBattle(agentBattleId);

  const loading = idLoading || battleLoading;
  const isBattleCompleted = agentBattle?.status === 'completed';

  // Mark feed as seen when switching to Command Center
  if (activeTab === 'command') {
    lastSeenFeedLengthRef.current = statusFeed.length;
  }

  // ── Symbol extraction ─────────────────────────────────────────────────────

  const startingPrices = battle?.state?.startingPrices || {};
  const thresholds = agentBattle?.scoring?.thresholds || {};

  const allSymbols = useMemo(() => {
    const symbols = new Set();
    const addFromPortfolio = (portfolio) => {
      if (!portfolio) return;
      ['star', 'core', 'support'].forEach(tier => {
        (portfolio[tier] || []).forEach(a => { if (a?.symbol) symbols.add(a.symbol); });
      });
    };
    addFromPortfolio(battle?.creator?.portfolio);
    addFromPortfolio(battle?.opponent?.portfolio);
    return [...symbols];
  }, [battle?.creator?.portfolio, battle?.opponent?.portfolio]);

  // ── WebSocket prices ──────────────────────────────────────────────────────

  const { prices: wsPrices } = useWebSocketPrices(allSymbols);

  const effectivePrices = useMemo(() => {
    if (!wsPrices || Object.keys(wsPrices).length === 0) return currentPrices;
    return { ...currentPrices, ...wsPrices };
  }, [currentPrices, wsPrices]);

  // ── EODHD price polling ───────────────────────────────────────────────────

  const fetchPrices = useCallback(async () => {
    if (allSymbols.length === 0) {
      setLoadingPrices(false);
      return;
    }
    try {
      const prices = {};
      const stockSymbols = allSymbols.filter(s => !isCryptoSymbol(s));
      const cryptoSymbols = allSymbols.filter(s => isCryptoSymbol(s));

      const [stockData, cryptoData] = await Promise.all([
        stockSymbols.length > 0 ? stockAPI.getMultipleStockPrices(stockSymbols) : {},
        cryptoSymbols.length > 0 ? stockAPI.getMultipleCryptoPrices(cryptoSymbols) : {},
      ]);

      const newPreviousCloses = {};
      Object.entries(stockData).forEach(([symbol, data]) => {
        if (data?.price) prices[symbol] = data.price;
        if (data?.previousClose) newPreviousCloses[symbol] = data.previousClose;
      });
      Object.entries(cryptoData).forEach(([symbol, data]) => {
        if (data?.price) prices[symbol] = data.price;
        if (data?.previousClose) newPreviousCloses[symbol] = data.previousClose;
      });

      if (Object.keys(newPreviousCloses).length > 0) {
        setPreviousClosePrices(prev => ({ ...prev, ...newPreviousCloses }));
      }

      // Fallback to starting prices for missing symbols
      for (const symbol of allSymbols) {
        if (!prices[symbol] && startingPrices[symbol]) {
          prices[symbol] = startingPrices[symbol];
        }
      }

      setCurrentPrices(prev => ({ ...prev, ...prices }));
      setLoadingPrices(false);
    } catch (error) {
      console.error('[AgentBattle] Error fetching prices:', error);
      setCurrentPrices(startingPrices);
      setLoadingPrices(false);
    }
  }, [allSymbols, startingPrices]);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, PRICE_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // ── Asset enrichment ──────────────────────────────────────────────────────

  const enrichAsset = useCallback((asset, tier) => {
    if (!asset) return null;

    if (asset.isCash) {
      return {
        ...asset,
        priceChange: 0,
        baseATR: 0,
        points: 0,
        badges: [],
        history: { maxMultiplier: 0, minMultiplier: 0 },
      };
    }

    const openPrice = asset.swapPrice || startingPrices[asset.symbol] || asset.price || 0;
    const curPrice = effectivePrices[asset.symbol] || openPrice;
    const threshold = thresholds[asset.symbol] || {};
    const baseATR = threshold.threshold || DEFAULT_THRESHOLD;

    let priceChange = openPrice > 0
      ? ((curPrice - openPrice) / openPrice) * 100
      : 0;

    if (asset.direction === 'short') {
      priceChange = -priceChange;
    }

    const prevClose = startingPrices[asset.symbol] || previousClosePrices[asset.symbol] || openPrice;
    let thresholdPriceChange = prevClose > 0
      ? ((curPrice - prevClose) / prevClose) * 100
      : priceChange;

    if (asset.direction === 'short') {
      thresholdPriceChange = -thresholdPriceChange;
    }

    const multiplier = baseATR > 0 ? thresholdPriceChange / baseATR : 0;
    const history = {
      maxMultiplier: multiplier > 0 ? multiplier : 0,
      minMultiplier: multiplier < 0 ? multiplier : 0,
    };

    const score = calculateAssetScoreV3(
      { ...asset, baseATR, tier },
      priceChange,
      history,
      {},
      thresholdPriceChange
    );

    return {
      ...asset,
      priceChange,
      thresholdPriceChange,
      baseATR,
      points: score.totalPoints,
      badges: score.badges,
      history,
      currentPrice: curPrice,
    };
  }, [effectivePrices, startingPrices, thresholds, previousClosePrices]);

  // ── Enriched portfolios ───────────────────────────────────────────────────

  const enrichedPlayerPortfolio = useMemo(() => {
    const p = battle?.creator?.portfolio;
    if (!p) return { star: [], core: [], support: [] };
    return {
      star: (p.star || []).map(a => enrichAsset(a, 'star')),
      core: (p.core || []).map(a => enrichAsset(a, 'core')),
      support: (p.support || []).map(a => enrichAsset(a, 'support')),
    };
  }, [battle?.creator?.portfolio, enrichAsset]);

  const enrichedOpponentPortfolio = useMemo(() => {
    const p = battle?.opponent?.portfolio;
    if (!p) return { star: [], core: [], support: [] };
    return {
      star: (p.star || []).map(a => enrichAsset(a, 'star')),
      core: (p.core || []).map(a => enrichAsset(a, 'core')),
      support: (p.support || []).map(a => enrichAsset(a, 'support')),
    };
  }, [battle?.opponent?.portfolio, enrichAsset]);

  // ── Computed scores ───────────────────────────────────────────────────────

  const sumPortfolioPoints = (portfolio) => {
    let total = 0;
    ['star', 'core', 'support'].forEach(tier => {
      (portfolio[tier] || []).forEach(a => { if (a) total += (a.points || 0); });
    });
    return Math.round(total);
  };

  const playerTotalScore = useMemo(
    () => sumPortfolioPoints(enrichedPlayerPortfolio),
    [enrichedPlayerPortfolio]
  );
  const opponentTotalScore = useMemo(
    () => sumPortfolioPoints(enrichedOpponentPortfolio),
    [enrichedOpponentPortfolio]
  );

  // Use live score when prices loaded, fallback to cron score
  const displayPlayerScore = loadingPrices
    ? (agentBattle?.scoreState?.currentScore || 0)
    : playerTotalScore;
  const displayOpponentScore = loadingPrices
    ? (agentBattle?.scoreState?.opponentScore || 0)
    : opponentTotalScore;

  // ── Notification dots ─────────────────────────────────────────────────────

  const hasPendingProposal = pendingProposal && !pendingProposal.resolvedAt;
  const hasNewFeedEntries = statusFeed.length > lastSeenFeedLengthRef.current;
  const hasCommandDot = hasPendingProposal || hasNewFeedEntries;
  const commandDotColor = hasPendingProposal ? '#f59e0b' : '#5eead4';
  const hasFilmRoomDot = (feedBookmarks?.length || 0) > 0;

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const handleTickerTap = useCallback((symbol) => {
    setFilterTicker(prev => prev === symbol ? null : symbol);
  }, []);

  const handleChallenge = useCallback((entry) => {
    setDebateSymbol(entry.symbolOut);
    setDebateOpen(true);
  }, []);

  const handleCitationTap = useCallback((ruleId) => {
    setCitationRuleId(ruleId);
    setCitationOpen(true);
  }, []);

  const handleSymbolClick = useCallback((asset) => {
    setResearchAsset(asset);
  }, []);

  // Memoize enriched research asset to avoid re-renders on every price tick
  const stableResearchAsset = useMemo(() => {
    if (!researchAsset) return null;
    return buildResearchAsset(researchAsset, {
      livePrices: effectivePrices,
      thresholds,
      startingPrices,
      useDefaultThreshold: true,
    });
  }, [researchAsset, effectivePrices, thresholds, startingPrices]);

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading && !agentBattle) {
    return (
      <div style={{
        minHeight: '100vh',
        background: tokens.bgApp || '#0D0E12',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          >
            <Bot size={24} color="#5eead4" />
          </motion.div>
          <span style={{ fontSize: 13, color: tokens.textMuted }}>Loading agent battle...</span>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      background: tokens.bgApp || '#0D0E12',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ═══ PERSISTENT TOP SECTION ═══ */}
      <div style={{
        flexShrink: 0,
        background: tokens.bgAgent || '#1C1A27',
      }}>
        {/* Back button bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isDesktop ? '8px 24px 0' : '8px 12px 0',
        }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              color: '#5eead4',
              fontSize: 13,
              fontWeight: 600,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px 6px',
              minHeight: 44,
              borderRadius: 8,
            }}
          >
            <ChevronLeft size={16} />
            <span>Back</span>
          </button>

          {agentBattle?.status && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 10,
              fontWeight: 600,
              color: agentBattle.status === 'active' ? '#5eead4' : tokens.textFaint,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              <div style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: agentBattle.status === 'active' ? '#5eead4' : tokens.textFaint,
              }} />
              {agentBattle.status}
            </div>
          )}
        </div>

        {/* Score header */}
        <ScoreHeader
          agentBattle={agentBattle}
          tokens={tokens}
          isDesktop={isDesktop}
          playerScore={displayPlayerScore}
          opponentScore={displayOpponentScore}
        />

        {/* Tab bar */}
        <TabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          hasCommandDot={hasCommandDot}
          commandDotColor={commandDotColor}
          hasFilmRoomDot={hasFilmRoomDot}
          isDesktop={isDesktop}
        />
      </div>

      {/* ═══ TAB CONTENT ═══ */}
      <div style={activeTab === 'matchups' ? {
        flex: 1,
        overflowY: 'auto',
        paddingBottom: 100,
        position: 'relative',
        zIndex: 2,
      } : {
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
      }}>
        <AnimatePresence mode="wait">
          {/* ── Matchups Tab ──────────────────────────────────────────── */}
          {activeTab === 'matchups' && (
            <motion.div
              key="matchups"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
            >
              {TIERS.map(tier => (
                <div key={tier.key}>
                  <TierHeader tier={tier} />
                  {Array.from({ length: tier.slots }).map((_, i) => (
                    <TacticalRow
                      key={`${tier.key}-${i}`}
                      leftAsset={enrichedPlayerPortfolio[tier.key]?.[i] || null}
                      rightAsset={enrichedOpponentPortfolio[tier.key]?.[i] || null}
                      tier={tier.key}
                      allocationLabel={`${tier.emoji} ${tier.allocation}`}
                      isCryptoSlot={tier.hasCrypto && i === tier.slots - 1}
                      onSymbolClick={handleSymbolClick}
                    />
                  ))}
                </div>
              ))}

              {/* Closed trades */}
              <ClosedTradesSection
                closedTrades={agentBattle?.trades || []}
                defaultExpanded={false}
              />
            </motion.div>
          )}

          {/* ── Command Center Tab ────────────────────────────────────── */}
          {activeTab === 'command' && (
            <motion.div
              key="command"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.15 }}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* ─── Controls Panel (always visible, centered) ─── */}
              <div style={{
                flexShrink: 0,
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: 'linear-gradient(180deg, rgba(94,234,212,0.03) 0%, transparent 100%)',
                padding: isDesktop ? '10px 24px 8px' : '10px 14px 8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}>
                <div style={{ width: '100%', maxWidth: isDesktop ? 540 : undefined }}>
                  {/* Strategy Posture section */}
                  <SectionLabel>Strategy Posture</SectionLabel>
                  <StrategyPresetBadge
                    battleId={agentBattleId}
                    strategyPreset={strategyPreset}
                    tokens={tokens}
                    disabled={isBattleCompleted}
                  />

                  {/* Execution Mode section */}
                  <div style={{ marginTop: 14 }}>
                    <SectionLabel>Execution Mode</SectionLabel>
                    <ExecutionModeToggle
                      battleId={agentBattleId}
                      executionMode={executionMode}
                      tokens={tokens}
                      disabled={isBattleCompleted}
                      variant="cards"
                    />
                  </div>

                  {/* Hypothesis ticker */}
                  <div style={{ marginTop: 10 }}>
                    <HypothesisTicker statusFeed={statusFeed} tokens={tokens} />
                  </div>
                </div>
              </div>

              {/* ─── Activity Feed ─── */}
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <AgentActivityFeed
                  statusFeed={statusFeed}
                  feedBookmarks={feedBookmarks}
                  filterTicker={filterTicker}
                  onClearFilter={() => setFilterTicker(null)}
                  onBookmark={(entryId) => addFeedBookmark(agentBattleId, entryId)}
                  onUnbookmark={(entryId) => removeFeedBookmark(agentBattleId, entryId)}
                  onChallenge={handleChallenge}
                  onCitationTap={handleCitationTap}
                  battleId={agentBattleId}
                  isAgentVsAgent={!!agentBattle?.opponentAgentId}
                  gameplanMeeting={gameplanMeeting}
                  tokens={tokens}
                />
              </div>

              {/* Proposal banner */}
              <ProposalBanner
                pendingProposal={pendingProposal}
                executionMode={executionMode}
                battleId={agentBattleId}
                onCitationTap={handleCitationTap}
                tokens={tokens}
              />
            </motion.div>
          )}

          {/* ── Film Room Tab ─────────────────────────────────────────── */}
          {activeTab === 'filmroom' && (
            <motion.div
              key="filmroom"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.15 }}
              style={{
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <AgentFilmRoom
                agentBattle={agentBattle}
                agentBattleId={agentBattleId}
                statusFeed={statusFeed}
                feedBookmarks={feedBookmarks}
                tokens={tokens}
                onCitationTap={handleCitationTap}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ MODALS ═══ */}
      <DebateModal
        isOpen={debateOpen}
        onClose={() => setDebateOpen(false)}
        battleId={agentBattleId}
        targetSymbol={debateSymbol}
        tokens={tokens}
      />

      <ForgeCitationCard
        isOpen={citationOpen}
        onClose={() => setCitationOpen(false)}
        ruleId={citationRuleId}
        battleData={agentBattle}
        statusFeed={statusFeed}
        tokens={tokens}
      />

      {stableResearchAsset && (
        <AssetResearchModal
          asset={stableResearchAsset}
          onClose={() => setResearchAsset(null)}
          showActionButton={false}
          isGameContext={true}
          version={2}
          defaultTab="baggerbomb"
          defaultTimeframe="bomb"
          wsPrice={effectivePrices[stableResearchAsset?.symbol]}
        />
      )}
    </div>
  );
}
