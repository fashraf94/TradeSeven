// BaggerBombBattleView - Main battle screen for BaggerBomb mode
// Sleeper-style side-by-side matchup view with tiers
// Features: Night mode theme for NIGHT_GAME session (4-8 PM ET)

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Moon } from 'lucide-react';
import { HOLO_COLORS } from '../constants/holoTheme';

// Night mode color overrides
const NIGHT_COLORS = {
  bgDeep: '#050508',      // Deeper black
  bgCard: '#0a0a0f',      // Slightly lighter
  bgElevated: '#12121a',  // Card backgrounds
  accent: '#3b82f6',      // Blue instead of cyan
  textPrimary: '#e0e0f0', // Slightly cooler white
  textMuted: '#6b6b8a',   // Muted purple-grey
  glow: 'rgba(59, 130, 246, 0.3)', // Blue glow
};

// Import BaggerBomb components
import BattleHeader from '../components/BaggerBomb/BattleHeader';
import TacticalRow from '../components/BaggerBomb/TacticalRow';
import BenchSection from '../components/BaggerBomb/BenchSection';
import ClosedTradesSection from '../components/BaggerBomb/ClosedTradesSection';
import EventFeed from '../components/BaggerBomb/EventFeed';
import SwapMarketModal from '../components/BaggerBomb/SwapMarketModal';

// Import modals for research and score breakdown
import AssetResearchModal from '../components/draft/AssetResearchModal';
import ScoreBreakdownPopover from '../components/draft/ScoreBreakdownPopover';
import { buildResearchAsset } from '../utils/researchAssetBuilder';
import { isSwapLocked } from '../utils/baggerBombUtils';
import { useBaggerShockwave } from '../hooks/useBaggerShockwave';
import { BAGGER_SHOCKWAVE_CONFIG, THRESHOLD_EVENT_TYPES, POSITIVE_THRESHOLD_TYPES } from '../utils/shockwaveUtils';

// Tier configuration
const TIERS = [
  {
    key: 'star',
    label: '⭐ Star Picks',
    allocation: '⭐ 2x',
    slots: 2,
    description: 'Your highest conviction plays',
  },
  {
    key: 'core',
    label: '💎 Core Holds',
    allocation: '💎 1.5x',
    slots: 2,
    description: 'Solid foundation assets',
  },
  {
    key: 'support',
    label: '📊 Support Plays',
    allocation: '🛡️ 1x',
    slots: 3,
    hasCrypto: true, // Last slot must be crypto
    description: 'Diversified support positions',
  },
];

// Tier-specific badge colors (matches TacticalRow TIER_BADGE_STYLES)
const TIER_HEADER_COLORS = {
  star:    { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)' },
  core:    { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  support: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
};

/**
 * Tab Toggle Component
 */
function TabToggle({ activeTab, onTabChange, nightMode }) {
  const bgColor = nightMode ? NIGHT_COLORS.bgElevated : HOLO_COLORS.bgElevated;
  const accentColor = nightMode ? NIGHT_COLORS.accent : HOLO_COLORS.cyan;
  const mutedColor = nightMode ? NIGHT_COLORS.textMuted : HOLO_COLORS.textMuted;
  const darkBg = nightMode ? NIGHT_COLORS.bgDeep : HOLO_COLORS.bgDeep;

  return (
    <div
      style={{
        display: 'flex',
        margin: '16px',
        backgroundColor: bgColor,
        borderRadius: '8px',
        padding: '4px',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <button
        onClick={() => onTabChange('matchups')}
        style={{
          flex: 1,
          padding: '10px 16px',
          borderRadius: '6px',
          border: 'none',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s',
          backgroundColor: activeTab === 'matchups' ? accentColor : 'transparent',
          color: activeTab === 'matchups' ? darkBg : mutedColor,
        }}
      >
        Matchups
      </button>
      <button
        onClick={() => onTabChange('feed')}
        style={{
          flex: 1,
          padding: '10px 16px',
          borderRadius: '6px',
          border: 'none',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s',
          backgroundColor: activeTab === 'feed' ? accentColor : 'transparent',
          color: activeTab === 'feed' ? darkBg : mutedColor,
        }}
      >
        Live Feed
      </button>
    </div>
  );
}

TabToggle.propTypes = {
  activeTab: PropTypes.oneOf(['matchups', 'feed']).isRequired,
  onTabChange: PropTypes.func.isRequired,
  nightMode: PropTypes.bool,
};

/**
 * Tier Section Header
 */
function TierHeader({ tier, nightMode }) {
  const bgColor = nightMode ? NIGHT_COLORS.bgDeep : HOLO_COLORS.bgDeep;
  const mutedColor = nightMode ? NIGHT_COLORS.textMuted : HOLO_COLORS.textMuted;
  const elevatedBg = nightMode ? NIGHT_COLORS.bgElevated : HOLO_COLORS.bgElevated;

  return (
    <div
      style={{
        padding: '12px 16px 8px',
        backgroundColor: bgColor,
        position: 'sticky',
        top: 0,
        zIndex: 5,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: mutedColor,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {tier.label}
        </span>
        <span
          style={{
            fontSize: '11px',
            color: TIER_HEADER_COLORS[tier.key]?.color || mutedColor,
            fontWeight: 600,
            padding: '2px 8px',
            backgroundColor: TIER_HEADER_COLORS[tier.key]?.bg || elevatedBg,
            borderRadius: '6px',
            border: `1px solid ${TIER_HEADER_COLORS[tier.key]?.color || mutedColor}30`,
          }}
        >
          {tier.allocation} each
        </span>
      </div>
    </div>
  );
}

TierHeader.propTypes = {
  tier: PropTypes.shape({
    key: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    allocation: PropTypes.string.isRequired,
    slots: PropTypes.number.isRequired,
  }).isRequired,
  nightMode: PropTypes.bool,
};

/**
 * BaggerBombBattleView - Main Screen
 */
export default function BaggerBombBattleView({
  battle,
  player,
  opponent,
  currentSession,
  sessionTimeRemaining,
  sessionScores,
  completedSessions,
  events,
  onBack,
  onThresholdCross,
  nightMode = false,
  isTraining = false,
  thresholds = {},
  currentPrices = {},
  openPrices = {},
  // V4 props
  battleVersion = 3,
  freeAgentConfig = {},
  closedTrades,
  onSelectSwapTarget,
  onConfirmSwap,
  isSwapExecuting,
  // V5 Swap Market props
  showSwapMarket = false,
  onCloseSwapMarket,
  onSwapStock,
  onSwapCryptoLong,
  onSwapCryptoShort,
  onGoToCash,
  rosterAssets = [],
  // ClashCast props
  getEventCommentary,
  clashCastActive = false,
  syntheticEvents = [],
}) {
  const isV4 = battleVersion >= 4;
  const isV5 = battleVersion >= 5;

  // Destructure freeAgentConfig for local use
  const {
    freeAgents,
    freeAgentDailyOpens,
    swapsRemaining,
    currentDay,
    totalDays,
    swapMode,
    onCancelSwapMode,
  } = freeAgentConfig;
  const [activeTab, setActiveTab] = useState('matchups');
  const [researchAsset, setResearchAsset] = useState(null);
  const [researchDefaultTab, setResearchDefaultTab] = useState(null);
  const [breakdownAsset, setBreakdownAsset] = useState(null);

  const handleRedZoneTap = useCallback((event) => {
    setResearchAsset({ symbol: event.symbol, name: event.symbol });
    setResearchDefaultTab('baggerbomb');
  }, []);

  // Memoize research modal props to prevent re-renders on every WS price tick.
  // Without this, every tick creates a new asset object via buildResearchAsset
  // (because currentPrices changes), causing AssetResearchModal + chart to fully re-render.
  const stableResearchAsset = useMemo(() => {
    if (!researchAsset) return null;
    const sym = researchAsset.symbol;
    const dailyOpen = openPrices[sym] || freeAgentDailyOpens?.[sym];
    const livePrice = currentPrices[sym];
    const dailyChange = (dailyOpen && dailyOpen > 0 && livePrice)
      ? ((livePrice - dailyOpen) / dailyOpen) * 100
      : undefined;
    return buildResearchAsset(researchAsset, {
      livePrices: currentPrices,
      thresholds,
      openPrices,
      startingPrices: battle?.state?.startingPrices,
      useDefaultThreshold: true,
      percentChange: dailyChange,
    });
  }, [
    researchAsset?.symbol, researchAsset?.name,
    // Only re-compute when THIS symbol's live price changes (not all symbols)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    currentPrices[researchAsset?.symbol],
    thresholds, openPrices, battle?.state?.startingPrices, freeAgentDailyOpens,
  ]);

  const handleResearchClose = useCallback(() => {
    setResearchAsset(null);
    setResearchDefaultTab(null);
  }, []);

  // Orange Zone swap lock toast
  const [swapBlockedToast, setSwapBlockedToast] = useState(null);
  useEffect(() => {
    if (!swapBlockedToast) return;
    const timer = setTimeout(() => setSwapBlockedToast(null), 3000);
    return () => clearTimeout(timer);
  }, [swapBlockedToast]);

  // ── Shockwave state for threshold crossings ────────────────
  const { activeShockwaves, triggerShockwave } = useBaggerShockwave();
  const matchupRefsMap = useRef(new Map());
  const lastEventCountRef = useRef(events?.length || 0);
  const [flinchSymbols, setFlinchSymbols] = useState(new Set());

  // Watch events array for new threshold crossings → trigger shockwaves
  useEffect(() => {
    if (!events || events.length <= lastEventCountRef.current) {
      // If events shrank (reset), sync the counter
      if (events && events.length < lastEventCountRef.current) {
        lastEventCountRef.current = events.length;
      }
      return;
    }
    const newEvents = events.slice(lastEventCountRef.current);
    lastEventCountRef.current = events.length;

    newEvents.forEach((event) => {
      if (!THRESHOLD_EVENT_TYPES.has(event.type)) return;

      const isPositive = POSITIVE_THRESHOLD_TYPES.has(event.type);
      const el = matchupRefsMap.current.get(event.symbol);
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const isUserEvent = event.player === player?.username;
      const originX = isUserEvent ? rect.left + rect.width * 0.15 : rect.right - rect.width * 0.15;
      const originY = rect.top + rect.height / 2;

      triggerShockwave({ x: originX, y: originY, type: event.type, isPositive, tier: event.type });

      // Row flinch
      setFlinchSymbols((prev) => new Set([...prev, event.symbol]));
      setTimeout(() => {
        setFlinchSymbols((prev) => {
          const next = new Set(prev);
          next.delete(event.symbol);
          return next;
        });
      }, BAGGER_SHOCKWAVE_CONFIG.flinchDuration);
    });
  }, [events, player?.username, triggerShockwave]);

  // Apply night mode color scheme when active
  const colors = useMemo(() => {
    if (nightMode) {
      return {
        bgDeep: NIGHT_COLORS.bgDeep,
        bgCard: NIGHT_COLORS.bgCard,
        bgElevated: NIGHT_COLORS.bgElevated,
        accent: NIGHT_COLORS.accent,
        textPrimary: NIGHT_COLORS.textPrimary,
        textMuted: NIGHT_COLORS.textMuted,
        cyan: NIGHT_COLORS.accent,
      };
    }
    return {
      bgDeep: HOLO_COLORS.bgDeep,
      bgCard: HOLO_COLORS.bgCard,
      bgElevated: HOLO_COLORS.bgElevated,
      accent: HOLO_COLORS.cyan,
      textPrimary: HOLO_COLORS.textPrimary,
      textMuted: HOLO_COLORS.textMuted,
      cyan: HOLO_COLORS.cyan,
    };
  }, [nightMode]);

  // Organize player portfolio by tiers
  const playerPortfolio = useMemo(() => {
    if (!player?.portfolio) return { star: [], core: [], support: [] };
    return player.portfolio;
  }, [player?.portfolio]);

  // Organize opponent portfolio by tiers
  const opponentPortfolio = useMemo(() => {
    if (!opponent?.portfolio) return { star: [], core: [], support: [] };
    return opponent.portfolio;
  }, [opponent?.portfolio]);

  // Build player data for header
  const playerHeaderData = useMemo(() => ({
    id: player?.id,
    username: player?.username || 'You',
    avatar: player?.avatar,
    totalPoints: player?.totalPoints || 0,
    sessionPoints: player?.sessionPoints || 0,
    baggerBombs: player?.baggerBombs || 0,
    busts: player?.busts || 0,
  }), [player]);

  // Build opponent data for header
  const opponentHeaderData = useMemo(() => ({
    id: opponent?.id,
    username: opponent?.username || 'Opponent',
    avatar: opponent?.avatar,
    totalPoints: opponent?.totalPoints || 0,
    sessionPoints: opponent?.sessionPoints || 0,
    baggerBombs: opponent?.baggerBombs || 0,
    busts: opponent?.busts || 0,
  }), [opponent]);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: colors.bgDeep,
        display: 'flex',
        flexDirection: 'column',
        transition: 'background-color 0.5s ease',
      }}
    >
      {/* Night Mode Ambient Glow */}
      {nightMode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            background: `radial-gradient(ellipse at 50% 0%, ${NIGHT_COLORS.glow} 0%, transparent 60%)`,
            zIndex: 0,
          }}
        />
      )}

      {/* Navigation Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          paddingTop: 'max(12px, env(safe-area-inset-top))',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '8px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: colors.accent,
          }}
        >
          <ChevronLeft size={24} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {nightMode && <Moon size={16} color={colors.accent} />}
          <h1
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: colors.textPrimary,
              margin: 0,
            }}
          >
            BaggerBomb Battle
          </h1>
          {isTraining && (
            <span
              style={{
                backgroundColor: HOLO_COLORS.purple,
                color: '#ffffff',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Training
            </span>
          )}
        </div>
        <div style={{ width: '40px' }} /> {/* Spacer for centering */}
      </div>

      {/* Battle Header Card */}
      <div style={{ paddingTop: '8px' }}>
        <BattleHeader
          player={playerHeaderData}
          opponent={opponentHeaderData}
          currentSession={currentSession}
          sessionTimeRemaining={sessionTimeRemaining}
          sessionScores={sessionScores}
          completedSessions={completedSessions}
          battleVersion={battleVersion}
          freeAgentConfig={{ ...freeAgentConfig, currentPrices, thresholds }}
        />
      </div>

      {/* Tab Toggle */}
      <TabToggle activeTab={activeTab} onTabChange={setActiveTab} nightMode={nightMode} />

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '100px', position: 'relative', zIndex: 1 }}>
        <AnimatePresence mode="wait">
          {activeTab === 'feed' ? (
            <motion.div
              key="feed"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <EventFeed
                events={events || []}
                currentUser={player?.username}
                onRedZoneTap={handleRedZoneTap}
                getEventCommentary={getEventCommentary}
                clashCastActive={clashCastActive}
                syntheticEvents={syntheticEvents}
              />
            </motion.div>
          ) : (
            <motion.div
              key="matchups"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Tier Sections */}
              {TIERS.map((tier) => (
                <div key={tier.key}>
                  <TierHeader tier={tier} nightMode={nightMode} />

                  {/* Asset Rows for this tier */}
                  {Array.from({ length: tier.slots }).map((_, index) => {
                    const playerAsset = playerPortfolio[tier.key]?.[index] || null;
                    const opponentAsset = opponentPortfolio[tier.key]?.[index] || null;
                    const isCryptoSlot = tier.hasCrypto && index === tier.slots - 1;

                    // Swap target mode: highlight player side, dim opponent
                    const isSwapTarget = swapMode?.step === 'selectTarget';
                    const selectedIsCrypto = swapMode?.selectedFreeAgent?.isCrypto;
                    const slotIsCrypto = Boolean(playerAsset?.isCrypto);
                    const typeMismatch = isSwapTarget && (Boolean(selectedIsCrypto) !== slotIsCrypto);

                    // Orange Zone swap lock — block swaps when stock is near a threshold
                    let orangeLocked = false;
                    if (isSwapTarget && playerAsset?.symbol) {
                      const oPrice = playerAsset.swapPrice || battle?.state?.startingPrices?.[playerAsset.symbol] || openPrices[playerAsset.symbol] || 0;
                      const cPrice = currentPrices[playerAsset.symbol] || oPrice;
                      const bATR = thresholds[playerAsset.symbol]?.threshold || 2.5;
                      const mult = oPrice > 0 ? ((cPrice - oPrice) / oPrice) * 100 / bATR : 0;
                      orangeLocked = isSwapLocked(mult, bATR).locked;
                    }

                    const hasFlinch = flinchSymbols.has(playerAsset?.symbol) || flinchSymbols.has(opponentAsset?.symbol);
                    return (
                      <div
                        key={`${tier.key}-${index}`}
                        ref={(el) => {
                          if (playerAsset?.symbol) {
                            if (el) matchupRefsMap.current.set(playerAsset.symbol, el);
                            else matchupRefsMap.current.delete(playerAsset.symbol);
                          }
                          if (opponentAsset?.symbol) {
                            if (el) matchupRefsMap.current.set(opponentAsset.symbol, el);
                            else matchupRefsMap.current.delete(opponentAsset.symbol);
                          }
                        }}
                        style={{
                          transform: hasFlinch ? `scale(${BAGGER_SHOCKWAVE_CONFIG.flinchScale})` : 'scale(1)',
                          transition: 'transform 0.1s ease-in-out',
                        }}
                      >
                        <TacticalRow
                          leftAsset={playerAsset}
                          rightAsset={opponentAsset}
                          tier={tier.key}
                          allocationLabel={tier.allocation}
                          isCryptoSlot={isCryptoSlot}
                          onLeftThresholdCross={
                            onThresholdCross
                              ? (name, mult, threshold) =>
                                  onThresholdCross('player', playerAsset?.symbol, name, mult)
                              : undefined
                          }
                          onRightThresholdCross={
                            onThresholdCross
                              ? (name, mult, threshold) =>
                                  onThresholdCross('opponent', opponentAsset?.symbol, name, mult)
                              : undefined
                          }
                          onSymbolClick={(asset) => { setResearchAsset(asset); setResearchDefaultTab('baggerbomb'); }}
                          onPointsClick={(asset) => setBreakdownAsset(asset)}
                          swapTargetMode={isSwapTarget}
                          onLeftAssetSelect={isSwapTarget ? (asset) => {
                            if (orangeLocked) {
                              setSwapBlockedToast(playerAsset.symbol);
                              return;
                            }
                            onSelectSwapTarget(asset, tier.key, index);
                          } : undefined}
                          opponentDimmed={swapMode?.active}
                          leftDisabled={typeMismatch || orangeLocked}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* V4: Closed Trades / V3: Bench Section */}
              {isV4 ? (
                <ClosedTradesSection
                  closedTrades={closedTrades || []}
                  defaultExpanded={false}
                />
              ) : (
                <BenchSection
                  playerBench={player?.bench}
                  opponentBench={opponent?.bench}
                  defaultExpanded={false}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Research Modal - opens when stock symbol is tapped */}
      {stableResearchAsset && (
        <AssetResearchModal
          asset={stableResearchAsset}
          onClose={handleResearchClose}
          showActionButton={false}
          isGameContext={true}
          version={2}
          defaultTab={researchDefaultTab}
          defaultTimeframe="bomb"
        />
      )}

      {/* Score Breakdown Modal - opens when points are tapped */}
      {breakdownAsset && (
        <ScoreBreakdownPopover
          asset={{
            symbol: breakdownAsset.symbol,
            gain: breakdownAsset.priceChange || 0,
            threshold: thresholds[breakdownAsset.symbol]?.threshold || breakdownAsset.baseATR || 2.5,
            tierMultiplier: breakdownAsset.tierMultiplier || 1.0,
            baggerBombs: breakdownAsset.badges?.filter(b =>
              b === 'bagger' || b === 'doubleBagger' || b === 'tenBagger'
            ).length || 0,
            busts: breakdownAsset.badges?.filter(b =>
              b === 'bust' || b === 'crash' || b === 'meltdown'
            ).length || 0,
            basePoints: Math.round((breakdownAsset.priceChange || 0) * 10 * (breakdownAsset.tierMultiplier || 1.0)),
            baggerBombPoints: breakdownAsset.badges?.reduce((sum, b) => {
              if (b === 'bagger') return sum + 15;
              if (b === 'doubleBagger') return sum + 30;
              if (b === 'tenBagger') return sum + 50;
              return sum;
            }, 0) || 0,
            bustPoints: breakdownAsset.badges?.reduce((sum, b) => {
              if (b === 'bust') return sum - 10;
              if (b === 'crash') return sum - 20;
              if (b === 'meltdown') return sum - 35;
              return sum;
            }, 0) || 0,
            totalScore: breakdownAsset.points || 0,
            startingPrice: openPrices[breakdownAsset.symbol] || breakdownAsset.swapPrice || battle?.state?.startingPrices?.[breakdownAsset.symbol] || 0,
            currentPrice: currentPrices[breakdownAsset.symbol] || 0,
          }}
          events={events || []}
          onClose={() => setBreakdownAsset(null)}
          entryPrice={battle?.state?.startingPrices?.[breakdownAsset.symbol] || 0}
          battleCreatedAt={battle?.timing?.createdAt || battle?.createdAt || null}
        />
      )}

      {/* V4: Swap Confirmation Popup */}
      {isV4 && swapMode?.step === 'confirming' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '24px',
          }}
          onClick={onCancelSwapMode}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: HOLO_COLORS.bgCard,
              borderRadius: '16px',
              border: `1px solid ${HOLO_COLORS.borderSubtle}`,
              padding: '24px',
              maxWidth: '340px',
              width: '100%',
            }}
          >
            <div style={{
              textAlign: 'center',
              marginBottom: '20px',
              fontSize: '14px',
              fontWeight: 700,
              color: HOLO_COLORS.textPrimary,
            }}>
              Confirm Swap
            </div>

            {/* OUT asset */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px',
              backgroundColor: `${HOLO_COLORS.red}10`,
              borderRadius: '8px',
              border: `1px solid ${HOLO_COLORS.red}30`,
              marginBottom: '8px',
            }}>
              <div>
                <span style={{ fontSize: '10px', color: HOLO_COLORS.textMuted, fontWeight: 600 }}>
                  {swapMode.swapType === 'cash' ? 'CLOSING' : 'REMOVING'}
                </span>
                <div style={{ fontSize: '16px', fontWeight: 700, color: HOLO_COLORS.textPrimary }}>
                  {swapMode.targetAsset?.isCash
                    ? `CASH (was: ${swapMode.targetAsset?.previousAsset || '?'})`
                    : swapMode.targetAsset?.symbol}
                  {swapMode.targetAsset?.direction && (
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: swapMode.targetAsset.direction === 'short' ? HOLO_COLORS.red : HOLO_COLORS.green,
                      marginLeft: '6px',
                    }}>
                      ({swapMode.targetAsset.direction === 'short' ? 'SHORT' : 'LONG'})
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '11px', color: HOLO_COLORS.textMuted }}>
                  {swapMode.targetAsset?.tier} tier
                </span>
              </div>
              <span style={{ fontSize: '24px', color: HOLO_COLORS.red }}>←</span>
            </div>

            {/* IN asset */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px',
              backgroundColor: swapMode.swapType === 'cash'
                ? `${HOLO_COLORS.textMuted}10`
                : `${HOLO_COLORS.green}10`,
              borderRadius: '8px',
              border: `1px solid ${swapMode.swapType === 'cash' ? HOLO_COLORS.textMuted : HOLO_COLORS.green}30`,
              marginBottom: '20px',
            }}>
              <div>
                <span style={{ fontSize: '10px', color: HOLO_COLORS.textMuted, fontWeight: 600 }}>
                  {swapMode.swapType === 'cash' ? 'CASH POSITION' : 'ADDING'}
                </span>
                <div style={{ fontSize: '16px', fontWeight: 700, color: HOLO_COLORS.textPrimary }}>
                  {swapMode.swapType === 'cash' ? '💵 CASH' : swapMode.selectedFreeAgent?.symbol}
                  {swapMode.direction && (
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: swapMode.direction === 'short' ? HOLO_COLORS.red : HOLO_COLORS.green,
                      marginLeft: '6px',
                    }}>
                      ({swapMode.direction === 'short' ? 'SHORT ↓' : 'LONG ↑'})
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '11px', color: HOLO_COLORS.textMuted }}>
                  {swapMode.swapType === 'cash'
                    ? 'Earns 0 pts until filled'
                    : swapMode.selectedFreeAgent?.name}
                </span>
              </div>
              <span style={{
                fontSize: '24px',
                color: swapMode.swapType === 'cash' ? HOLO_COLORS.textMuted : HOLO_COLORS.green,
              }}>
                {swapMode.swapType === 'cash' ? '💵' : '→'}
              </span>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={onCancelSwapMode}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: `1px solid ${HOLO_COLORS.borderSubtle}`,
                  backgroundColor: 'transparent',
                  color: HOLO_COLORS.textMuted,
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={onConfirmSwap}
                disabled={isSwapExecuting}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: HOLO_COLORS.cyan,
                  color: HOLO_COLORS.bgDeep,
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: isSwapExecuting ? 'wait' : 'pointer',
                  opacity: isSwapExecuting ? 0.6 : 1,
                }}
              >
                {isSwapExecuting ? 'Swapping...' : 'Confirm'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* V5: Swap Market Modal */}
      {isV5 && (
        <SwapMarketModal
          isOpen={showSwapMarket}
          onClose={onCloseSwapMarket || (() => {})}
          stockFreeAgents={freeAgents || []}
          currentPrices={currentPrices}
          dailyOpens={freeAgentDailyOpens || {}}
          swapsRemaining={swapsRemaining || 0}
          onSwapStock={onSwapStock || (() => {})}
          onSwapCryptoLong={onSwapCryptoLong || (() => {})}
          onSwapCryptoShort={onSwapCryptoShort || (() => {})}
          onGoToCash={onGoToCash || (() => {})}
          rotationTimer={freeAgentConfig?.rotationCountdown || 0}
          rosterAssets={rosterAssets}
        />
      )}

      {/* Orange Zone Swap Blocked Toast */}
      <AnimatePresence>
        {swapBlockedToast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{
              position: 'fixed',
              bottom: '100px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(245, 158, 11, 0.95)',
              color: '#000',
              padding: '12px 20px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 600,
              zIndex: 200,
              maxWidth: '90vw',
              textAlign: 'center',
              boxShadow: '0 4px 20px rgba(245, 158, 11, 0.4)',
            }}
          >
            {`\uD83D\uDD12 ${swapBlockedToast} is in the danger zone \u2014 too close to a threshold to swap!`}
          </motion.div>
        )}
      </AnimatePresence>

      {/* BaggerBomb threshold shockwave overlays */}
      <AnimatePresence>
        {activeShockwaves.map((wave) => {
          const colorConfig = wave.isPositive
            ? BAGGER_SHOCKWAVE_CONFIG.positiveColor
            : BAGGER_SHOCKWAVE_CONFIG.negativeColor;
          const tierMultiplier = BAGGER_SHOCKWAVE_CONFIG.tierScale[wave.tier] || 1.0;

          return (
            <motion.div
              key={wave.id}
              initial={{ scaleX: 0, scaleY: 0, opacity: 0.9 }}
              animate={{
                scaleX: BAGGER_SHOCKWAVE_CONFIG.waveMaxScale * tierMultiplier * 1.5,
                scaleY: BAGGER_SHOCKWAVE_CONFIG.waveMaxScale * tierMultiplier * 0.8,
                opacity: 0,
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: BAGGER_SHOCKWAVE_CONFIG.waveDuration,
                ease: BAGGER_SHOCKWAVE_CONFIG.waveEasing,
              }}
              style={{
                position: 'fixed',
                left: wave.x - 20,
                top: wave.y - 20,
                width: 40,
                height: 40,
                borderRadius: '50%',
                pointerEvents: 'none',
                zIndex: 9999,
                background: colorConfig.gradient,
                boxShadow: colorConfig.glow,
                border: colorConfig.border,
                // backdrop-filter: blur(3px) brightness(1.2) ← enable if perf allows
              }}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}

BaggerBombBattleView.propTypes = {
  /** Battle data object */
  battle: PropTypes.object,
  /** Player data with portfolio organized by tiers */
  player: PropTypes.shape({
    id: PropTypes.string,
    username: PropTypes.string,
    avatar: PropTypes.string,
    totalPoints: PropTypes.number,
    sessionPoints: PropTypes.number,
    baggerBombs: PropTypes.number,
    busts: PropTypes.number,
    portfolio: PropTypes.shape({
      star: PropTypes.array,
      core: PropTypes.array,
      support: PropTypes.array,
    }),
    bench: PropTypes.shape({
      stocks: PropTypes.array,
      crypto: PropTypes.object,
    }),
  }),
  /** Opponent data with same structure as player */
  opponent: PropTypes.shape({
    id: PropTypes.string,
    username: PropTypes.string,
    avatar: PropTypes.string,
    totalPoints: PropTypes.number,
    sessionPoints: PropTypes.number,
    baggerBombs: PropTypes.number,
    busts: PropTypes.number,
    portfolio: PropTypes.object,
    bench: PropTypes.object,
  }),
  /** Current active session key */
  currentSession: PropTypes.string,
  /** Seconds remaining in current session */
  sessionTimeRemaining: PropTypes.number,
  /** Session scores object */
  sessionScores: PropTypes.object,
  /** Array of completed session keys */
  completedSessions: PropTypes.arrayOf(PropTypes.string),
  /** Array of battle events */
  events: PropTypes.array,
  /** Callback when back button pressed */
  onBack: PropTypes.func,
  /** Callback when threshold crossed: (side, symbol, thresholdName, multiplier) */
  onThresholdCross: PropTypes.func,
  /** Enable night mode theme (auto-enabled during NIGHT_GAME session) */
  nightMode: PropTypes.bool,
  /** Whether this is a training battle (shows Training badge) */
  isTraining: PropTypes.bool,
  /** V4 battle version (3 or 4) */
  battleVersion: PropTypes.number,
  /** V4: Grouped free agent config passed through to BattleHeader/FreeAgentBar */
  freeAgentConfig: PropTypes.object,
  /** V4: Closed trades from swaps */
  closedTrades: PropTypes.array,
  /** V4: Select swap target callback */
  onSelectSwapTarget: PropTypes.func,
  /** V4: Confirm swap callback */
  onConfirmSwap: PropTypes.func,
  /** V4: Whether swap is being executed */
  isSwapExecuting: PropTypes.bool,
};

BaggerBombBattleView.defaultProps = {
  battle: null,
  player: null,
  opponent: null,
  currentSession: '',
  sessionTimeRemaining: 0,
  sessionScores: {},
  completedSessions: [],
  events: [],
  onBack: () => {},
  onThresholdCross: null,
  nightMode: false,
  isTraining: false,
};

// Export tier configuration for use elsewhere
export { TIERS };
