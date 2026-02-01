// /src/components/Dashboard/TrainingLiveFeed.jsx
// Training tab live feed - shows real-time BaggerBomb events and lead changes
// from active training battles. Events stored in local state only (not persisted).

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '../../hooks';
import { calculateBaggerBombs, calculateBusts } from '../../services/scoring/baggerBombCalculator';
import { BAGGERBOMB } from '../../services/scoring/constants';
import { getUsername } from '../../utils/battleHelpers';

// Event type constants
const EVENT_TYPES = {
  BAGGERBOMB: 'baggerbomb',
  BUST: 'bust',
  LEAD_GAINED: 'lead_gained',
  LEAD_LOST: 'lead_lost',
};

// Event accent colors
const EVENT_ACCENTS = {
  [EVENT_TYPES.BAGGERBOMB]: '#10b981',  // Green - gains
  [EVENT_TYPES.BUST]: '#ff3366',        // Red - losses
  [EVENT_TYPES.LEAD_GAINED]: '#f59e0b', // Amber - victories
  [EVENT_TYPES.LEAD_LOST]: '#f59e0b',   // Amber - changes
};

// Maximum events to display
const MAX_EVENTS = 12;

// Get display name for battle type
function getBattleName(battle) {
  if (battle?.type === 'baggerbomb_training') return 'BaggerBomb Training';
  if (battle?.isSnakeDraft) return 'Snake Draft Training';
  return 'Training Battle';
}

// Get opponent display name
function getOpponentDisplayName(battle) {
  const oppUsername = getUsername(battle?.opponent);
  if (oppUsername === 'CPU Opponent' || oppUsername === 'cpu') return 'CPU';
  return oppUsername || 'Opponent';
}

// Calculate current breakout counts for an asset
function getAssetBreakouts(asset, startingPrices, battlePrices, thresholds) {
  const startPrice = startingPrices?.[asset.symbol] || asset.price;
  const currentPrice = battlePrices?.[asset.symbol] || startPrice;
  const threshold = thresholds?.[asset.symbol]?.threshold || 3.0;

  if (!startPrice || startPrice <= 0) {
    return { baggerBombs: 0, busts: 0, percentChange: 0 };
  }

  const percentChange = ((currentPrice - startPrice) / startPrice) * 100;
  const baggerBombs = calculateBaggerBombs(percentChange, threshold);
  const busts = calculateBusts(percentChange, threshold);

  return { baggerBombs, busts, percentChange };
}

// Calculate total score for a portfolio
function calculatePortfolioScore(portfolio, startingPrices, battlePrices, thresholds) {
  let totalScore = 0;

  (portfolio || []).forEach(asset => {
    const { baggerBombs, busts, percentChange } = getAssetBreakouts(
      asset, startingPrices, battlePrices, thresholds
    );

    // Base points: +5 for green, -2 for red
    const basePoints = percentChange >= 0 ? 5 : -2;

    // Breakout points
    const breakoutPoints =
      (baggerBombs * BAGGERBOMB.POINTS_PER_THRESHOLD) +
      (busts * BAGGERBOMB.BUST_POINTS_PER_THRESHOLD);

    totalScore += basePoints + breakoutPoints;
  });

  return totalScore;
}

// ============================================
// Feed Item Component
// ============================================
function FeedItem({ event, onViewBattle, isMobile }) {
  const accent = EVENT_ACCENTS[event.type] || '#a855f7';

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      style={{
        background: '#161b22',
        borderLeft: `4px solid ${accent}`,
        borderRadius: '8px',
        padding: isMobile ? '10px 12px' : '12px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: isMobile ? '10px' : '12px',
        minHeight: isMobile ? '50px' : '60px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Icon */}
      <span style={{
        fontSize: isMobile ? '16px' : '18px',
        flexShrink: 0,
        lineHeight: isMobile ? '20px' : '24px',
      }}>
        {event.icon}
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: isMobile ? '12px' : '13px',
          color: '#e6edf3',
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {event.primaryText}
        </div>
        <div style={{
          fontSize: isMobile ? '11px' : '12px',
          color: event.points > 0 ? '#10b981' : event.points < 0 ? '#ff3366' : '#8b949e',
          marginTop: '2px',
          fontWeight: '600',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {event.secondaryText}
        </div>
      </div>

      {/* Action button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onViewBattle(event);
        }}
        style={{
          padding: isMobile ? '6px 10px' : '5px 14px',
          minHeight: '32px',
          background: `${accent}15`,
          border: `1px solid ${accent}40`,
          borderRadius: '6px',
          color: accent,
          fontSize: isMobile ? '10px' : '11px',
          fontWeight: '700',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 0.2s',
          alignSelf: 'center',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = `${accent}25`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = `${accent}15`;
        }}
      >
        [VIEW]
      </button>
    </motion.div>
  );
}

// ============================================
// Main TrainingLiveFeed Component
// ============================================
export default function TrainingLiveFeed({
  activeTrainingBattles = [],
  battlePrices = {},
  user,
  setCurrentBattle,
  setScreen,
  setActiveBattleId,
}) {
  const { isMobile } = useIsMobile();
  const [events, setEvents] = useState([]);

  // Track previous battle states for change detection
  // Map<battleId, { scores: {user, opponent}, breakouts: {user: Map, opponent: Map} }>
  const prevBattleStatesRef = useRef(new Map());

  // Add new event helper
  const addEvent = useCallback((newEvent) => {
    setEvents(prev => {
      const updated = [newEvent, ...prev];
      return updated.slice(0, MAX_EVENTS);
    });
  }, []);

  // Detect events when battles or prices update
  useEffect(() => {
    if (!activeTrainingBattles.length || !Object.keys(battlePrices).length) return;

    activeTrainingBattles.forEach(battle => {
      const battleId = battle.id;
      const prevState = prevBattleStatesRef.current.get(battleId);

      // Determine if user is creator or opponent
      const isCreator =
        battle.creator?.uid === user?.odUserId ||
        battle.creator?.odUserId === user?.odUserId ||
        battle.creator?.username === user?.username;

      const myData = isCreator ? battle.creator : battle.opponent;
      const oppData = isCreator ? battle.opponent : battle.creator;

      // Portfolio could be array (V1/V2) or object with star/core/support (V3)
      const rawMyPortfolio = myData?.portfolio;
      const rawOppPortfolio = oppData?.portfolio;
      const myPortfolio = Array.isArray(rawMyPortfolio) ? rawMyPortfolio : [];
      const oppPortfolio = Array.isArray(rawOppPortfolio) ? rawOppPortfolio : [];

      // Get starting prices
      const startingPrices =
        battle.state?.startingPrices ||
        battle.pricing?.baselinePrices ||
        {};

      const thresholds = battle.thresholds || {};

      // Calculate current breakouts for both players
      const currentBreakouts = {
        user: new Map(),
        opponent: new Map(),
      };

      // User's breakouts
      myPortfolio.forEach(asset => {
        const breakouts = getAssetBreakouts(asset, startingPrices, battlePrices, thresholds);
        currentBreakouts.user.set(asset.symbol, breakouts);
      });

      // Opponent's breakouts
      oppPortfolio.forEach(asset => {
        const breakouts = getAssetBreakouts(asset, startingPrices, battlePrices, thresholds);
        currentBreakouts.opponent.set(asset.symbol, breakouts);
      });

      // Calculate current scores
      const currentScores = {
        user: calculatePortfolioScore(myPortfolio, startingPrices, battlePrices, thresholds),
        opponent: calculatePortfolioScore(oppPortfolio, startingPrices, battlePrices, thresholds),
      };

      // Only detect events if we have previous state (skip initial render)
      if (prevState) {
        const battleName = getBattleName(battle);
        const oppName = getOpponentDisplayName(battle);

        // Check for new user breakouts
        currentBreakouts.user.forEach((current, symbol) => {
          const prev = prevState.breakouts?.user?.get(symbol) || { baggerBombs: 0, busts: 0 };

          // New BaggerBombs
          if (current.baggerBombs > prev.baggerBombs) {
            const newCount = current.baggerBombs - prev.baggerBombs;
            const points = newCount * BAGGERBOMB.POINTS_PER_THRESHOLD;
            addEvent({
              id: `bb-${battleId}-${symbol}-${Date.now()}`,
              type: EVENT_TYPES.BAGGERBOMB,
              battleId,
              icon: '🚀',
              primaryText: `Your ${symbol} triggered a BaggerBomb!`,
              secondaryText: `+${points} pts`,
              points,
              timestamp: Date.now(),
            });
          }

          // New Busts
          if (current.busts > prev.busts) {
            const newCount = current.busts - prev.busts;
            const points = newCount * BAGGERBOMB.BUST_POINTS_PER_THRESHOLD;
            addEvent({
              id: `bust-${battleId}-${symbol}-${Date.now()}`,
              type: EVENT_TYPES.BUST,
              battleId,
              icon: '💣',
              primaryText: `Your ${symbol} bombed!`,
              secondaryText: `${points} pts`,
              points,
              timestamp: Date.now(),
            });
          }
        });

        // Check for new opponent breakouts
        currentBreakouts.opponent.forEach((current, symbol) => {
          const prev = prevState.breakouts?.opponent?.get(symbol) || { baggerBombs: 0, busts: 0 };

          // New BaggerBombs
          if (current.baggerBombs > prev.baggerBombs) {
            const newCount = current.baggerBombs - prev.baggerBombs;
            const points = newCount * BAGGERBOMB.POINTS_PER_THRESHOLD;
            addEvent({
              id: `bb-opp-${battleId}-${symbol}-${Date.now()}`,
              type: EVENT_TYPES.BAGGERBOMB,
              battleId,
              icon: '🚀',
              primaryText: `${oppName}'s ${symbol} triggered a BaggerBomb!`,
              secondaryText: `+${points} pts for them`,
              points,
              timestamp: Date.now(),
            });
          }

          // New Busts
          if (current.busts > prev.busts) {
            const newCount = current.busts - prev.busts;
            const points = newCount * BAGGERBOMB.BUST_POINTS_PER_THRESHOLD;
            addEvent({
              id: `bust-opp-${battleId}-${symbol}-${Date.now()}`,
              type: EVENT_TYPES.BUST,
              battleId,
              icon: '💣',
              primaryText: `${oppName}'s ${symbol} bombed!`,
              secondaryText: `${points} pts for them`,
              points,
              timestamp: Date.now(),
            });
          }
        });

        // Check for lead changes
        const { user: myScore, opponent: oppScore } = currentScores;
        const { user: prevMyScore, opponent: prevOppScore } = prevState.scores;

        const wasLeading = prevMyScore > prevOppScore;
        const wasTied = prevMyScore === prevOppScore;
        const isLeading = myScore > oppScore;
        const isTied = myScore === oppScore;

        // User took the lead
        if (isLeading && !wasLeading && !wasTied) {
          addEvent({
            id: `lead-gained-${battleId}-${Date.now()}`,
            type: EVENT_TYPES.LEAD_GAINED,
            battleId,
            icon: '👑',
            primaryText: `You took the lead in ${battleName}!`,
            secondaryText: `Leading by ${(myScore - oppScore).toFixed(1)} pts`,
            points: myScore - oppScore,
            timestamp: Date.now(),
          });
        }

        // User lost the lead
        if (!isLeading && !isTied && (wasLeading || wasTied)) {
          addEvent({
            id: `lead-lost-${battleId}-${Date.now()}`,
            type: EVENT_TYPES.LEAD_LOST,
            battleId,
            icon: '⚔️',
            primaryText: `${oppName} passed you in ${battleName}`,
            secondaryText: `Behind by ${(oppScore - myScore).toFixed(1)} pts`,
            points: -(oppScore - myScore),
            timestamp: Date.now(),
          });
        }
      }

      // Update previous state reference
      prevBattleStatesRef.current.set(battleId, {
        scores: currentScores,
        breakouts: currentBreakouts,
      });
    });

    // Clean up completed battles from ref
    const activeBattleIds = new Set(activeTrainingBattles.map(b => b.id));
    prevBattleStatesRef.current.forEach((_, battleId) => {
      if (!activeBattleIds.has(battleId)) {
        prevBattleStatesRef.current.delete(battleId);
      }
    });
  }, [activeTrainingBattles, battlePrices, user, addEvent]);

  // Handle "View Battle" navigation
  const handleViewBattle = useCallback((event) => {
    const battle = activeTrainingBattles.find(b => b.id === event.battleId);
    if (!battle) return;

    // Convert training battle to unified format for BattleView
    // Preserve _v from original battle for proper V3 routing
    const convertedBattle = {
      id: battle.id,
      _v: battle._v || 2,
      challengeCode: 'TRAINING',
      creator: {
        uid: battle.creator?.uid || user?.odUserId,
        odUserId: battle.creator?.odUserId || user?.odUserId,
        username: battle.creator?.username || user?.username,
        portfolioName: battle.creator?.portfolioName || 'Training Portfolio',
        portfolio: battle.creator?.portfolio || [],
        bench: battle.creator?.bench || [],
        portfolioType: battle.creator?.portfolioType || 'baggerbomb',
      },
      opponent: {
        uid: battle.opponent?.uid || 'cpu',
        odUserId: battle.opponent?.odUserId || 'cpu',
        username: battle.opponent?.username || 'CPU Opponent',
        portfolioName: battle.opponent?.portfolioName || 'CPU Strategy',
        portfolio: battle.opponent?.portfolio || [],
        bench: battle.opponent?.bench || [],
        portfolioType: 'baggerbomb',
      },
      creatorPortfolio: battle.creator?.portfolio || [],
      opponentPortfolio: battle.opponent?.portfolio || [],
      status: 'active',
      timeline: battle.timing,
      startDate: battle.timing?.startTime,
      endDate: battle.timing?.endTime,
      state: battle.state || {},
      startingPrices: battle.pricing?.baselinePrices || {},
      thresholds: battle.thresholds || {},
      breakouts: battle.scoring?.breakouts || { creator: [], opponent: [] },
      isTraining: true,
      isTrainingBattle: true,
    };

    setCurrentBattle(convertedBattle);
    if (setActiveBattleId) setActiveBattleId(battle.id);
    setScreen('battle');
  }, [activeTrainingBattles, user, setCurrentBattle, setActiveBattleId, setScreen]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        marginBottom: '20px',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Section Header - Purple theme */}
      <h3 style={{
        fontSize: '13px',
        fontWeight: '700',
        color: '#a855f7',
        textTransform: 'uppercase',
        letterSpacing: '1.5px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        margin: '0 0 12px 0',
        padding: '0 4px',
      }}>
        <span style={{ fontSize: '14px' }}>⚡</span>
        BATTLE FEED
        {events.length > 0 && (
          <span style={{
            background: 'rgba(168, 85, 247, 0.15)',
            color: '#a855f7',
            padding: '2px 8px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: '600',
          }}>
            {events.length}
          </span>
        )}
      </h3>

      {/* Feed items */}
      {events.length > 0 ? (
        <div
          className="training-live-feed-scroll"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '300px',
            overflowY: 'auto',
            paddingRight: '4px',
            scrollbarWidth: 'thin',
            scrollbarColor: '#30363d transparent',
          }}
        >
          <style>{`
            .training-live-feed-scroll::-webkit-scrollbar { width: 6px; }
            .training-live-feed-scroll::-webkit-scrollbar-track { background: transparent; }
            .training-live-feed-scroll::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
            .training-live-feed-scroll::-webkit-scrollbar-thumb:hover { background: #484f58; }
          `}</style>
          <AnimatePresence>
            {events.map((event) => (
              <FeedItem
                key={event.id}
                event={event}
                onViewBattle={handleViewBattle}
                isMobile={isMobile}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '24px 16px',
          color: '#6e7681',
          fontSize: '13px',
          background: 'rgba(168, 85, 247, 0.05)',
          borderRadius: '8px',
          borderLeft: '4px solid #a855f7',
        }}>
          <div style={{ marginBottom: '4px' }}>No events yet</div>
          <div style={{ fontSize: '11px', color: '#484f58' }}>
            BaggerBombs and lead changes will appear here
          </div>
        </div>
      )}
    </motion.div>
  );
}
