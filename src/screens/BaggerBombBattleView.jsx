// BaggerBombBattleView - Main battle screen for BaggerBomb mode
// Sleeper-style side-by-side matchup view with tiers
// Features: Night mode theme for NIGHT_GAME session (4-8 PM ET)

import React, { useState, useMemo, useCallback, useEffect } from 'react';
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

// Import modals for research and score breakdown
import AssetResearchModal from '../components/draft/AssetResearchModal';
import ScoreBreakdownPopover from '../components/draft/ScoreBreakdownPopover';
import { buildResearchAsset } from '../utils/researchAssetBuilder';
import { isSwapLocked } from '../utils/baggerBombUtils';

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
}) {
  const isV4 = battleVersion >= 4;

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

  // Orange Zone swap lock toast
  const [swapBlockedToast, setSwapBlockedToast] = useState(null);
  useEffect(() => {
    if (!swapBlockedToast) return;
    const timer = setTimeout(() => setSwapBlockedToast(null), 3000);
    return () => clearTimeout(timer);
  }, [swapBlockedToast]);

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
              <EventFeed events={events || []} currentUser={player?.username} onRedZoneTap={handleRedZoneTap} />
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

                    return (
                      <TacticalRow
                        key={`${tier.key}-${index}`}
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
      {researchAsset && (
        <AssetResearchModal
          asset={buildResearchAsset(researchAsset, {
            livePrices: currentPrices,
            thresholds,
            openPrices,
            startingPrices: battle?.state?.startingPrices,
            useDefaultThreshold: true,
          })}
          onClose={() => { setResearchAsset(null); setResearchDefaultTab(null); }}
          showActionButton={false}
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
            baggerBombs: breakdownAsset.badges?.filter(b =>
              b === 'bagger' || b === 'rally' || b === 'moonshot'
            ).length || 0,
            busts: breakdownAsset.badges?.filter(b =>
              b === 'bust' || b === 'crash' || b === 'meltdown'
            ).length || 0,
            basePoints: (breakdownAsset.priceChange || 0) * 10,
            baggerBombPoints: (breakdownAsset.badges?.filter(b =>
              b === 'bagger' || b === 'rally' || b === 'moonshot'
            ).length || 0) * 15,
            bustPoints: (breakdownAsset.badges?.filter(b =>
              b === 'bust' || b === 'crash' || b === 'meltdown'
            ).length || 0) * -10,
            totalScore: breakdownAsset.points || 0,
          }}
          onClose={() => setBreakdownAsset(null)}
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
                  REMOVING
                </span>
                <div style={{ fontSize: '16px', fontWeight: 700, color: HOLO_COLORS.textPrimary }}>
                  {swapMode.targetAsset?.symbol}
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
              backgroundColor: `${HOLO_COLORS.green}10`,
              borderRadius: '8px',
              border: `1px solid ${HOLO_COLORS.green}30`,
              marginBottom: '20px',
            }}>
              <div>
                <span style={{ fontSize: '10px', color: HOLO_COLORS.textMuted, fontWeight: 600 }}>
                  ADDING
                </span>
                <div style={{ fontSize: '16px', fontWeight: 700, color: HOLO_COLORS.textPrimary }}>
                  {swapMode.selectedFreeAgent?.symbol}
                </div>
                <span style={{ fontSize: '11px', color: HOLO_COLORS.textMuted }}>
                  {swapMode.selectedFreeAgent?.name}
                </span>
              </div>
              <span style={{ fontSize: '24px', color: HOLO_COLORS.green }}>→</span>
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
