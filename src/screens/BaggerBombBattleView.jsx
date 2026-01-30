// BaggerBombBattleView - Main battle screen for BaggerBomb mode
// Sleeper-style side-by-side matchup view with tiers

import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { HOLO_COLORS } from '../constants/holoTheme';

// Import BaggerBomb components
import BattleHeader from '../components/BaggerBomb/BattleHeader';
import TacticalRow from '../components/BaggerBomb/TacticalRow';
import BenchSection from '../components/BaggerBomb/BenchSection';
import EventFeed from '../components/BaggerBomb/EventFeed';

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
function TabToggle({ activeTab, onTabChange }) {
  return (
    <div
      style={{
        display: 'flex',
        margin: '16px',
        backgroundColor: HOLO_COLORS.bgElevated,
        borderRadius: '8px',
        padding: '4px',
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
          backgroundColor: activeTab === 'matchups' ? HOLO_COLORS.cyan : 'transparent',
          color: activeTab === 'matchups' ? HOLO_COLORS.bgDeep : HOLO_COLORS.textMuted,
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
          backgroundColor: activeTab === 'feed' ? HOLO_COLORS.cyan : 'transparent',
          color: activeTab === 'feed' ? HOLO_COLORS.bgDeep : HOLO_COLORS.textMuted,
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
};

/**
 * Tier Section Header
 */
function TierHeader({ tier }) {
  return (
    <div
      style={{
        padding: '12px 16px 8px',
        backgroundColor: HOLO_COLORS.bgDeep,
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
            color: HOLO_COLORS.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {tier.label}
        </span>
        <span
          style={{
            fontSize: '11px',
            color: HOLO_COLORS.textMuted,
            padding: '2px 6px',
            backgroundColor: HOLO_COLORS.bgElevated,
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
}) {
  const [activeTab, setActiveTab] = useState('matchups');

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
        backgroundColor: HOLO_COLORS.bgDeep,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Navigation Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          paddingTop: 'max(12px, env(safe-area-inset-top))',
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
            color: HOLO_COLORS.cyan,
          }}
        >
          <ChevronLeft size={24} />
        </button>
        <h1
          style={{
            fontSize: '16px',
            fontWeight: 700,
            color: HOLO_COLORS.textPrimary,
            margin: 0,
          }}
        >
          BaggerBomb Battle
        </h1>
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
      <TabToggle activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '100px' }}>
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
                  <TierHeader tier={tier} />

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
};

// Export tier configuration for use elsewhere
export { TIERS };
