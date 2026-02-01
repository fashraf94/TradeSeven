// BaggerBombBattleView - Main battle screen for BaggerBomb mode
// Sleeper-style side-by-side matchup view with tiers
// Features: Night mode theme for NIGHT_GAME session (4-8 PM ET)

import React, { useState, useMemo } from 'react';
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
import EventFeed from '../components/BaggerBomb/EventFeed';

// Import modals for research and score breakdown
import AssetResearchModal from '../components/draft/AssetResearchModal';
import ScoreBreakdownPopover from '../components/draft/ScoreBreakdownPopover';

// Tier configuration
const TIERS = [
  {
    key: 'star',
    label: '⭐ Star Picks',
    allocation: '20%',
    slots: 2,
    description: 'Your highest conviction plays',
  },
  {
    key: 'core',
    label: '💎 Core Holds',
    allocation: '15%',
    slots: 2,
    description: 'Solid foundation assets',
  },
  {
    key: 'support',
    label: '📊 Support Plays',
    allocation: '10%',
    slots: 3,
    hasCrypto: true, // Last slot must be crypto
    description: 'Diversified support positions',
  },
];

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
            color: mutedColor,
            padding: '2px 6px',
            backgroundColor: elevatedBg,
            borderRadius: '4px',
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
}) {
  const [activeTab, setActiveTab] = useState('matchups');
  const [researchAsset, setResearchAsset] = useState(null);
  const [breakdownAsset, setBreakdownAsset] = useState(null);

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
                backgroundColor: '#8b5cf6',
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
              <EventFeed events={events || []} />
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

                    return (
                      <TacticalRow
                        key={`${tier.key}-${index}`}
                        leftAsset={playerAsset}
                        rightAsset={opponentAsset}
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
                        onSymbolClick={(asset) => setResearchAsset(asset)}
                        onPointsClick={(asset) => setBreakdownAsset(asset)}
                      />
                    );
                  })}
                </div>
              ))}

              {/* Bench Section */}
              <BenchSection
                playerBench={player?.bench}
                opponentBench={opponent?.bench}
                defaultExpanded={false}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Research Modal - opens when stock symbol is tapped */}
      {researchAsset && (
        <AssetResearchModal
          asset={{
            symbol: researchAsset.symbol,
            name: researchAsset.name || researchAsset.symbol,
            price: researchAsset.currentPrice || researchAsset.price || 0,
            percentChange: researchAsset.priceChange || 0,
            threshold: researchAsset.baseATR || 2.5,
          }}
          onClose={() => setResearchAsset(null)}
          showActionButton={false}
        />
      )}

      {/* Score Breakdown Modal - opens when points are tapped */}
      {breakdownAsset && (
        <ScoreBreakdownPopover
          asset={{
            symbol: breakdownAsset.symbol,
            gain: breakdownAsset.priceChange || 0,
            threshold: breakdownAsset.baseATR || 2.5,
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
            ).length || 0) * -7.5,
            totalScore: breakdownAsset.points || 0,
          }}
          onClose={() => setBreakdownAsset(null)}
        />
      )}
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
