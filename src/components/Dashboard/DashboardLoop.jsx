// /src/components/Dashboard/DashboardLoop.jsx
// "The Loop" — Mobile unified battle feed replacing tabbed dashboard layout
// Single-column scrollable feed merging PVP + Training battles
// Desktop layout is NOT affected — this only renders on mobile

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Swords, Zap } from 'lucide-react';
import PriorityBattleCard from './PriorityBattleCard';
import BattleRow from './BattleRow';
import FantasyTimesTeaser from './FantasyTimesTeaser';
import GamesModal from './GamesModal';
import QuickPlayModal from './QuickPlayModal';
import PendingLobbiesSection from './PendingLobbiesSection';
import { useTheme } from '../../contexts/ThemeContext';
import { isMarketOpen } from '../../utils/marketSchedule';
import { didUserWin, getEndTime, isEnded } from '../../utils/battleHelpers';

// ─── Motion variants ─────────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};
const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24, mass: 0.8 } },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardLoop({
  user,
  activeBattles,
  activeDraftBattles,
  activeTrainingBattles,
  lobbyBattles,
  completedBattles,
  setCurrentBattle,
  setCurrentDraft,
  setScreen,
  setActiveBattleId,
  setBattleToJoin,
  copyToClipboard,
  setShowBaggerBombModal,
  setShowSnakeDraftModal,
  setShowBaggerBombTrainingConfirm,
  setShowTrainingConfirmModal,
  setTrainingConfirmType,
  setSidebarOpen,
  unreadCount,
  activeDraftBanner,
  setActiveDraftBanner,
}) {
  const { tokens } = useTheme();
  const marketOpen = isMarketOpen();
  const [gamesModalOpen, setGamesModalOpen] = useState(false);
  const [quickPlayOpen, setQuickPlayOpen] = useState(false);

  // ─── Battle merge: combine all active battles sorted by end time ───────────
  const allBattles = useMemo(() => {
    const merged = [
      ...activeBattles.filter(b => !b.isTrainingBattle && !isEnded(b)).map(b => ({ battle: b, type: 'classic' })),
      ...activeDraftBattles.filter(b => b.status === 'active' && b.isTraining !== true && !isEnded(b)).map(b => ({ battle: b, type: 'draft' })),
      ...activeDraftBattles.filter(b => b.status === 'active' && b.isTraining === true && !isEnded(b)).map(b => ({ battle: b, type: 'trainingDraft' })),
      ...activeTrainingBattles.filter(b => !isEnded(b)).map(b => ({ battle: b, type: 'training' })),
    ];

    return merged.sort((a, b) => {
      const aEnd = getEndTime(a.battle);
      const bEnd = getEndTime(b.battle);
      if (!aEnd) return 1;
      if (!bEnd) return -1;
      return new Date(aEnd) - new Date(bEnd);
    });
  }, [activeBattles, activeDraftBattles, activeTrainingBattles]);

  const priorityBattle = allBattles[0] || null;
  const secondaryBattles = allBattles.slice(1);

  // ─── Battle press handler (replicated from LiveClashesSection) ─────────────
  const handleBattlePress = (battle, type) => {
    if (type === 'draft' || type === 'trainingDraft') {
      setCurrentDraft(battle);
      setScreen('draftBattle');
    } else if (type === 'training') {
      if (battle._v >= 4) {
        setCurrentBattle({ ...battle, isTraining: true, isTrainingBattle: true });
        setActiveBattleId(battle.id);
        setScreen('battle');
        return;
      }
      const isBaggerBomb = battle._v === 2 || battle._v === 3 || battle.type === 'baggerbomb';
      const isV3 = battle._v === 3;
      const convertedBattle = {
        id: battle.id,
        _v: isV3 ? 3 : (isBaggerBomb ? 2 : 1),
        challengeCode: 'TRAINING',
        creator: isBaggerBomb ? (isV3 && battle.creator ? battle.creator : {
          uid: battle.player1?.odUserId || user.odUserId,
          odUserId: battle.player1?.odUserId || user.odUserId,
          username: battle.player1?.username || user.username,
          portfolioName: battle.player1?.portfolioName || 'Training Portfolio',
          portfolio: battle.player1?.portfolio || [],
          bench: battle.player1?.bench || [],
          portfolioType: battle.player1?.portfolioType || 'baggerbomb'
        }) : undefined,
        opponent: isBaggerBomb ? (isV3 && battle.opponent ? battle.opponent : {
          uid: 'cpu',
          odUserId: 'cpu',
          username: 'CPU Opponent',
          portfolioName: battle.player2?.portfolioName || 'CPU Strategy',
          portfolio: battle.player2?.portfolio || [],
          bench: battle.player2?.bench || [],
          portfolioType: 'baggerbomb'
        }) : undefined,
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
      setCurrentBattle(battle);
      setScreen('battle');
    }
  };

  // ─── Stats ─────────────────────────────────────────────────────────────────
  const totalActive = allBattles.length;
  const totalCompleted = completedBattles?.length || 0;

  // ─── Recent results (last 1-2 completed battles) ──────────────────────────
  const recentResults = useMemo(() => {
    return (completedBattles || [])
      .sort((a, b) => {
        const aTime = a.completedAt || a.timeline?.completedAt || a.endDate || 0;
        const bTime = b.completedAt || b.timeline?.completedAt || b.endDate || 0;
        return new Date(bTime) - new Date(aTime);
      })
      .slice(0, 2);
  }, [completedBattles]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#111318',
      position: 'relative',
      zIndex: 1,
    }}>
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <header style={{
        background: tokens.bgCard,
        borderBottom: `1px solid ${tokens.borderDefault}`,
        padding: '12px 16px',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Left: hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              position: 'relative',
              minWidth: '44px',
              minHeight: '44px',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
            aria-label="Open menu"
          >
            <div style={{ width: '24px', height: '2px', backgroundColor: tokens.teal, borderRadius: '1px' }} />
            <div style={{ width: '24px', height: '2px', backgroundColor: tokens.teal, borderRadius: '1px' }} />
            <div style={{ width: '24px', height: '2px', backgroundColor: tokens.teal, borderRadius: '1px' }} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                minWidth: '18px',
                height: '18px',
                padding: '0 5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: tokens.red,
                borderRadius: '9px',
                color: tokens.textWhite,
                fontSize: '10px',
                fontWeight: '700',
                lineHeight: 1,
                boxShadow: tokens.glowRedDot,
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Center: greeting + market status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '16px',
              fontWeight: '600',
              color: tokens.textPrimary,
            }}>
              {getGreeting()}, {user?.username || 'Player'}
            </span>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '4px',
              background: tokens.bgIcon,
              fontSize: '10px',
              fontWeight: '600',
              color: tokens.textMuted,
            }}>
              <span style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: marketOpen ? tokens.emerald : tokens.textFaintest,
              }} />
              {marketOpen ? 'Open' : 'Closed'}
            </span>
          </div>

          {/* Right: avatar */}
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: tokens.bgCard,
            border: `2px solid ${tokens.teal}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            fontWeight: '600',
            color: tokens.textWhite,
          }}>
            {(user?.username || 'P')[0].toUpperCase()}
          </div>
        </div>
      </header>

      {/* ─── Active Draft Banner ────────────────────────────────────────────── */}
      {activeDraftBanner && activeDraftBanner.status === 'active' && (
        <div
          onClick={() => {
            setCurrentDraft(activeDraftBanner);
            setActiveDraftBanner(null);
            setScreen('draftRoom');
          }}
          style={{
            background: `linear-gradient(135deg, rgba(217,119,6,0.15), ${tokens.bgCard})`,
            backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 40%)',
            borderLeft: `2px solid ${tokens.amber}`,
            padding: '12px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: `${tokens.obsidianShadow}, 0 2px 12px rgba(245,158,11,0.05)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <div>
              <div style={{ color: tokens.amber, fontWeight: 'bold', fontSize: '14px' }}>
                Active Draft in Progress!
              </div>
              <div style={{ color: tokens.textSecondary, fontSize: '12px' }}>
                {activeDraftBanner.code} • Tap to rejoin
              </div>
            </div>
          </div>
          <span style={{
            padding: '6px 14px',
            background: 'rgba(245,158,11,0.15)',
            color: tokens.amber,
            fontWeight: '600',
            fontSize: '12px',
            border: 'none',
            borderRadius: '20px',
          }}>
            REJOIN
          </span>
        </div>
      )}

      {/* ─── Feed Content ───────────────────────────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          flex: 1,
          padding: '20px 16px 140px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          maxWidth: '600px',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >

        {/* ── CTA: Game Buttons ─────────────────────────────────────────── */}
        <motion.div variants={sectionVariants} style={{ display: 'flex', gap: '12px' }}>
          <motion.button
            onClick={() => setGamesModalOpen(true)}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '16px',
              borderRadius: '14px',
              border: '1px solid rgba(245,158,11,0.2)',
              background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))',
              backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 50%)',
              boxShadow: tokens.obsidianShadow,
              cursor: 'pointer',
            }}
          >
            <Swords size={20} color={tokens.amber} />
            <span style={{ fontSize: '15px', fontWeight: '600', color: tokens.textPrimary }}>
              Games
            </span>
          </motion.button>
          <motion.button
            onClick={() => setQuickPlayOpen(true)}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '16px',
              borderRadius: '14px',
              border: '1px solid rgba(147,51,234,0.2)',
              background: 'linear-gradient(135deg, rgba(147,51,234,0.15), rgba(147,51,234,0.05))',
              backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 50%)',
              boxShadow: tokens.obsidianShadow,
              cursor: 'pointer',
            }}
          >
            <Zap size={20} color={tokens.purpleText} />
            <span style={{ fontSize: '15px', fontWeight: '600', color: tokens.textPrimary }}>
              Quick Play
            </span>
          </motion.button>
        </motion.div>

        {/* ── Section 1: Priority Battle ──────────────────────────────────── */}
        {priorityBattle && (
          <motion.div variants={sectionVariants}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              padding: '0 4px',
            }}>
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                color: tokens.textFaint,
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
              }}>
                Priority Battle
              </span>
              <span style={{
                color: tokens.teal,
                fontSize: '11px',
                fontWeight: '600',
              }}>
                {totalActive} active
              </span>
            </div>
            <PriorityBattleCard
              battle={priorityBattle.battle}
              battleType={priorityBattle.type}
              user={user}
              onPress={() => handleBattlePress(priorityBattle.battle, priorityBattle.type)}
            />
          </motion.div>
        )}

        {/* ── Section 2: Secondary Battles ────────────────────────────────── */}
        {secondaryBattles.length > 0 && (
          <motion.div variants={sectionVariants} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {secondaryBattles.map(({ battle, type }, i) => (
              <BattleRow
                key={battle.id || battle.firestoreId || i}
                battle={battle}
                battleType={type}
                user={user}
                onPress={() => handleBattlePress(battle, type)}
              />
            ))}
          </motion.div>
        )}

        {/* ── Recent Results ────────────────────────────────────────────── */}
        {recentResults.length > 0 && (
          <motion.div variants={sectionVariants} style={{ opacity: 0.8 }}>
            <div style={{ marginBottom: '12px', padding: '0 4px' }}>
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                color: tokens.textFaint,
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
              }}>
                Recent Results
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentResults.map((battle, i) => {
                const won = didUserWin(battle, user?.username);
                const bType = battle.isDraft ? 'draft' : (battle.isTrainingBattle ? 'training' : 'classic');
                return (
                  <div key={battle.id || i} style={{ position: 'relative' }}>
                    <BattleRow
                      battle={battle}
                      battleType={bType}
                      user={user}
                      onPress={() => handleBattlePress(battle, bType)}
                    />
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      right: '16px',
                      transform: 'translateY(-50%)',
                      padding: '3px 10px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      background: won === true ? 'rgba(52,211,153,0.15)' : won === false ? 'rgba(239,68,68,0.15)' : 'rgba(148,163,184,0.15)',
                      color: won === true ? tokens.emerald : won === false ? tokens.red : tokens.textMuted,
                      pointerEvents: 'none',
                    }}>
                      {won === true ? 'WIN' : won === false ? 'LOSS' : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Section 3: Fantasy Times Teaser ─────────────────────────────── */}
        <motion.div variants={sectionVariants}>
          <FantasyTimesTeaser setScreen={setScreen} />
        </motion.div>

        {/* ── Section 4: Pending Lobbies ───────────────────────────────────── */}
        <motion.div variants={sectionVariants}>
        <PendingLobbiesSection
          lobbyBattles={lobbyBattles}
          user={user}
          setCurrentBattle={setCurrentBattle}
          setCurrentDraft={setCurrentDraft}
          setScreen={setScreen}
          setBattleToJoin={setBattleToJoin}
          copyToClipboard={copyToClipboard}
        />
        </motion.div>

        {/* ── Section 5: Stats Row ────────────────────────────────────────── */}
        <motion.div variants={sectionVariants} style={{
          display: 'flex',
          gap: '12px',
          padding: '0 4px',
        }}>
          <div style={{
            flex: 1,
            padding: '16px',
            background: tokens.bgCard,
            backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 40%)',
            borderRadius: '12px',
            border: `1px solid ${tokens.borderDefault}`,
            boxShadow: tokens.obsidianShadow,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: tokens.teal }}>
              {totalActive}
            </div>
            <div style={{
              fontSize: '10px', color: tokens.textFaint, fontWeight: '600',
              marginTop: '4px', textTransform: 'uppercase', letterSpacing: '1.5px',
            }}>
              Active
            </div>
          </div>
          <div style={{
            flex: 1,
            padding: '16px',
            background: tokens.bgCard,
            backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 40%)',
            borderRadius: '12px',
            border: `1px solid ${tokens.borderDefault}`,
            boxShadow: tokens.obsidianShadow,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: tokens.emerald }}>
              {totalCompleted}
            </div>
            <div style={{
              fontSize: '10px', color: tokens.textFaint, fontWeight: '600',
              marginTop: '4px', textTransform: 'uppercase', letterSpacing: '1.5px',
            }}>
              Completed
            </div>
          </div>
          <div style={{
            flex: 1,
            padding: '16px',
            background: tokens.bgCard,
            backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 40%)',
            borderRadius: '12px',
            border: `1px solid ${tokens.borderDefault}`,
            boxShadow: tokens.obsidianShadow,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: tokens.amber }}>
              {user?.tokens || 0}
            </div>
            <div style={{
              fontSize: '10px', color: tokens.textFaint, fontWeight: '600',
              marginTop: '4px', textTransform: 'uppercase', letterSpacing: '1.5px',
            }}>
              Tokens
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ─── Games Modal ──────────────────────────────────────────────────── */}
      <GamesModal
        isOpen={gamesModalOpen}
        onClose={() => setGamesModalOpen(false)}
        setShowBaggerBombModal={setShowBaggerBombModal}
        setShowSnakeDraftModal={setShowSnakeDraftModal}
        setShowBaggerBombTrainingConfirm={setShowBaggerBombTrainingConfirm}
        setShowTrainingConfirmModal={setShowTrainingConfirmModal}
        setTrainingConfirmType={setTrainingConfirmType}
      />

      {/* ─── Quick Play Modal ─────────────────────────────────────────────── */}
      <QuickPlayModal
        isOpen={quickPlayOpen}
        onClose={() => setQuickPlayOpen(false)}
        lobbyBattles={lobbyBattles}
        user={user}
        setCurrentBattle={setCurrentBattle}
        setCurrentDraft={setCurrentDraft}
        setScreen={setScreen}
        setBattleToJoin={setBattleToJoin}
        copyToClipboard={copyToClipboard}
        setShowBaggerBombTrainingConfirm={setShowBaggerBombTrainingConfirm}
        setShowTrainingConfirmModal={setShowTrainingConfirmModal}
        setTrainingConfirmType={setTrainingConfirmType}
      />
    </div>
  );
}
