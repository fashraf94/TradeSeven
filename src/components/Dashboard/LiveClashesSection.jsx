// /src/components/Dashboard/LiveClashesSection.jsx
// Displays active battles as Clash Cards in a horizontal carousel
// Handles both PVP and Training modes, shows count + urgency indicators

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Swords, GraduationCap } from 'lucide-react';
import ClashCard from './ClashCard';
import InfiniteCarousel from './InfiniteCarousel';

// Get remaining ms for urgency sorting
function getRemainingMs(battle) {
  if (battle.endDate) return Math.max(0, new Date(battle.endDate).getTime() - Date.now());
  if (battle.battleEndTime) return Math.max(0, new Date(battle.battleEndTime).getTime() - Date.now());
  if (battle.timeline?.endDate) return Math.max(0, new Date(battle.timeline.endDate).getTime() - Date.now());
  return Infinity;
}

export default function LiveClashesSection({
  activeBattles = [],
  activeDraftBattles = [],
  activeTrainingBattles = [],
  isTrainingMode = false,
  user,
  colors,
  setCurrentBattle,
  setCurrentDraft,
  setScreen,
  setActiveBattleId,
}) {
  // Determine which battles to show based on mode
  const allBattles = useMemo(() => {
    if (isTrainingMode) {
      // Training tab: training battles + training drafts (isTraining: true)
      const training = activeTrainingBattles.map(b => ({ battle: b, type: 'training' }));
      const trainingDrafts = activeDraftBattles
        .filter(b => b.isTraining === true)
        .map(b => ({ battle: b, type: 'draft' }));
      return [...training, ...trainingDrafts];
    }
    // PVP tab: classic 1v1 + PVP draft battles (exclude training)
    const classic = activeBattles
      .filter(b => !b.isTrainingBattle)
      .map(b => ({ battle: b, type: 'classic' }));
    const draft = activeDraftBattles
      .filter(b => b.isTraining !== true)
      .map(b => ({ battle: b, type: 'draft' }));
    return [...classic, ...draft];
  }, [activeBattles, activeDraftBattles, activeTrainingBattles, isTrainingMode]);

  // Find the most urgent battle (soonest ending)
  const mostUrgentId = useMemo(() => {
    if (allBattles.length === 0) return null;
    let minMs = Infinity;
    let urgentId = null;
    allBattles.forEach(({ battle }) => {
      const ms = getRemainingMs(battle);
      if (ms < minMs && ms > 0) {
        minMs = ms;
        urgentId = battle.id || battle.firestoreId;
      }
    });
    // Only mark as urgent if under 1 hour
    return minMs <= 3600000 ? urgentId : null;
  }, [allBattles]);

  // Count ending soon (under 1 hour)
  const endingSoonCount = useMemo(() => {
    return allBattles.filter(({ battle }) => {
      const ms = getRemainingMs(battle);
      return ms > 0 && ms <= 3600000;
    }).length;
  }, [allBattles]);

  // Don't render if no battles
  if (allBattles.length === 0) return null;

  const sectionIcon = isTrainingMode ? GraduationCap : Swords;
  const sectionLabel = isTrainingMode ? 'ACTIVE TRAINING' : 'ACTIVE PVP';
  const accentColor = isTrainingMode ? '#9333ea' : '#00d9ff';

  // Handle battle click navigation
  const handleBattlePress = (battle, type) => {
    if (type === 'draft') {
      setCurrentDraft(battle);
      setScreen('draftBattle');
    } else if (type === 'training') {
      // Convert training battle format for battle view
      const isBaggerBomb = battle._v === 2 || battle.type === 'baggerbomb';
      const convertedBattle = {
        id: battle.id,
        _v: isBaggerBomb ? 2 : 1,
        challengeCode: 'TRAINING',
        creator: isBaggerBomb ? {
          uid: battle.player1?.odUserId || user.odUserId,
          odUserId: battle.player1?.odUserId || user.odUserId,
          username: battle.player1?.username || user.username,
          portfolioName: battle.player1?.portfolioName || 'Training Portfolio',
          portfolio: battle.player1?.portfolio || [],
          bench: battle.player1?.bench || [],
          portfolioType: battle.player1?.portfolioType || 'baggerbomb'
        } : undefined,
        opponent: isBaggerBomb ? {
          uid: 'cpu',
          odUserId: 'cpu',
          username: 'CPU Opponent',
          portfolioName: battle.player2?.portfolioName || 'CPU Strategy',
          portfolio: battle.player2?.portfolio || [],
          bench: battle.player2?.bench || [],
          portfolioType: 'baggerbomb'
        } : undefined,
        creatorPortfolio: battle.player1?.portfolio || [],
        opponentPortfolio: battle.player2?.portfolio || [],
        portfolioName: battle.player1?.portfolioName || 'Training Portfolio',
        portfolioType: battle.player1?.portfolioType || 'stocks',
        status: 'active',
        timeline: battle.timeline,
        startDate: battle.timeline?.startDate,
        endDate: battle.timeline?.endDate,
        state: battle.state,
        startingPrices: battle.state?.startingPrices || {},
        thresholds: battle.thresholds || {},
        breakouts: battle.breakouts || { creator: [], opponent: [] },
        sessionScores: battle.sessions || {},
        isTraining: true,
        isTrainingBattle: true,
        createdAt: battle.timeline?.createdAt
      };
      setCurrentBattle(convertedBattle);
      setActiveBattleId(battle.id);
      setScreen('battle');
    } else {
      // Classic 1v1
      setCurrentBattle(battle);
      setScreen('battle');
    }
  };

  // Single card - render directly without carousel
  if (allBattles.length === 1) {
    const { battle, type } = allBattles[0];
    const battleId = battle.id || battle.firestoreId;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ marginBottom: '20px' }}
      >
        {/* Section Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '12px',
          padding: '0 4px',
        }}>
          {React.createElement(sectionIcon, {
            size: 16,
            style: { color: accentColor },
          })}
          <span style={{
            fontSize: '13px',
            fontWeight: '700',
            color: '#e6edf3',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
          }}>
            {sectionLabel}
          </span>
          <span style={{
            background: `${accentColor}20`,
            color: accentColor,
            padding: '2px 8px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: '600',
          }}>
            {allBattles.length} active
          </span>
        </div>

        {/* Single card */}
        <div style={{ padding: '0 4px' }}>
          <ClashCard
            battle={battle}
            battleType={type}
            user={user}
            onPress={() => handleBattlePress(battle, type)}
            isMostUrgent={battleId === mostUrgentId}
          />
        </div>
      </motion.div>
    );
  }

  // Multiple cards - use carousel
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ marginBottom: '20px' }}
    >
      {/* Section Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '12px',
        padding: '0 16px',
      }}>
        {React.createElement(sectionIcon, {
          size: 16,
          style: { color: accentColor },
        })}
        <span style={{
          fontSize: '13px',
          fontWeight: '700',
          color: '#e6edf3',
          textTransform: 'uppercase',
          letterSpacing: '1.5px',
        }}>
          {sectionLabel}
        </span>
        <span style={{
          background: `${accentColor}20`,
          color: accentColor,
          padding: '2px 8px',
          borderRadius: '8px',
          fontSize: '11px',
          fontWeight: '600',
        }}>
          {allBattles.length} active
        </span>
        {endingSoonCount > 0 && (
          <span style={{
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            padding: '2px 8px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: '600',
          }}>
            {endingSoonCount} ending soon
          </span>
        )}
      </div>

      {/* Carousel of Clash Cards */}
      <style>{`
        .clash-carousel::-webkit-scrollbar { display: none; }
      `}</style>
      <div
        className="clash-carousel"
        style={{
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          gap: '12px',
          padding: '0 16px 8px 16px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {allBattles.map(({ battle, type }, index) => {
          const battleId = battle.id || battle.firestoreId || index;
          return (
            <ClashCard
              key={battleId}
              battle={battle}
              battleType={type}
              user={user}
              onPress={() => handleBattlePress(battle, type)}
              isMostUrgent={battleId === mostUrgentId}
            />
          );
        })}
      </div>
    </motion.div>
  );
}
