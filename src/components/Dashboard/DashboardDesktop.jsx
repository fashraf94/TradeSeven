// /src/components/Dashboard/DashboardDesktop.jsx
// "The Minimal" — Desktop two-panel dashboard layout
// Center canvas with 2-column battle grid, CTA buttons, and content sections
// Sidebar is rendered externally from App.jsx unified return

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Swords, Zap } from 'lucide-react';
import DashboardBattleCard from './DashboardBattleCard';
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

export default function DashboardDesktop({
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

  const gridBattles = allBattles.slice(0, 6);
  const totalActive = allBattles.length;

  // ─── Battle press handler ─────────────────────────────────────────────────
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

  // ─── Recent results (last 2 completed battles) ──────────────────────────
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
      marginLeft: '220px',
      display: 'flex',
      justifyContent: 'center',
      width: 'calc(100% - 220px)',
      minHeight: '100vh',
      background: '#111318',
      position: 'relative',
      zIndex: 1,
    }}>
      {/* Ambient breathing glow */}
      <div style={{
        position: 'absolute', top: '22%', left: '50%',
        width: '140%', height: '380px',
        background: 'radial-gradient(ellipse at center, rgba(94,234,212,0.12) 0%, rgba(168,85,247,0.06) 40%, transparent 70%)',
        filter: 'blur(50px)', transform: 'translate(-50%, -50%)',
        zIndex: 0, pointerEvents: 'none',
        animation: 'ambientBreathe 8s infinite alternate ease-in-out',
      }} />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          width: '100%',
          maxWidth: '780px',
          padding: '24px 32px 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >

        {/* ── Greeting Bar ──────────────────────────────────────────────── */}
        <motion.div variants={sectionVariants} style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize: '24px',
            fontWeight: '600',
            color: tokens.textPrimary,
          }}>
            {getGreeting()}, {user?.username || 'Player'}
          </span>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '6px',
            background: tokens.bgIcon,
            fontSize: '12px',
            fontWeight: '600',
            color: tokens.textMuted,
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: marketOpen ? tokens.emerald : tokens.textFaintest,
            }} />
            {marketOpen ? 'Market Open' : 'Market Closed'}
          </span>
        </motion.div>

        {/* ── CTA Buttons ───────────────────────────────────────────────── */}
        <motion.div variants={sectionVariants} style={{ display: 'flex', gap: '16px' }}>
          <motion.button
            onClick={() => setGamesModalOpen(true)}
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 20px',
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
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 20px',
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

        {/* ── Active Draft Banner ────────────────────────────────────────── */}
        {activeDraftBanner && activeDraftBanner.status === 'active' && (
          <motion.div variants={sectionVariants}>
            <div
              onClick={() => {
                setCurrentDraft(activeDraftBanner);
                setActiveDraftBanner(null);
                setScreen('draftRoom');
              }}
              style={{
                background: `linear-gradient(135deg, rgba(217,119,6,0.12) 0%, ${tokens.bgCard} 100%)`,
                border: `1px solid rgba(245,158,11,0.2)`,
                borderLeft: `3px solid ${tokens.amber}`,
                borderRadius: '14px',
                padding: '14px 20px',
                backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 40%)',
                boxShadow: `${tokens.obsidianShadow}, 0 2px 12px rgba(245,158,11,0.05)`,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>⚠️</span>
                <div>
                  <div style={{ color: tokens.amber, fontWeight: 'bold', fontSize: '14px' }}>
                    Active Draft in Progress!
                  </div>
                  <div style={{ color: tokens.textSecondary, fontSize: '12px' }}>
                    {activeDraftBanner.code} • Click to rejoin
                  </div>
                </div>
              </div>
              <span style={{
                padding: '6px 16px',
                background: 'rgba(245,158,11,0.15)',
                color: tokens.amber,
                fontWeight: '600',
                fontSize: '13px',
                borderRadius: '20px',
              }}>
                REJOIN
              </span>
            </div>
          </motion.div>
        )}

        {/* ── Battle Grid (2-column) ─────────────────────────────────────── */}
        <motion.div variants={sectionVariants}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 12 }}>⚔️</span>
            <span style={{
              fontSize: 11, fontWeight: 700, color: tokens.textFaint,
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              Active Battles
            </span>
            {totalActive > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: tokens.teal,
                background: 'rgba(94,234,212,0.1)',
                border: '1px solid rgba(94,234,212,0.15)',
                padding: '2px 8px', borderRadius: 4,
              }}>
                {totalActive} active
              </span>
            )}
          </div>

          {gridBattles.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '16px',
            }}>
              {gridBattles.map(({ battle, type }, i) => (
                <div key={battle.id || battle.firestoreId || i} style={{
                  gridColumn: gridBattles.length === 1 ? '1 / -1' : undefined,
                }}>
                  <DashboardBattleCard
                    battle={battle}
                    battleType={type}
                    user={user}
                    tokens={tokens}
                    onPress={() => handleBattlePress(battle, type)}
                    isMostUrgent={i === 0}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              background: tokens.bgCard,
              backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 40%)',
              borderRadius: '16px',
              border: `1px solid ${tokens.borderDefault}`,
              boxShadow: `${tokens.obsidianShadow}, 0 4px 20px rgba(0,0,0,0.3)`,
            }}>
              <div style={{ fontSize: '16px', fontWeight: '600', color: tokens.textPrimary, marginBottom: '8px' }}>
                No active battles
              </div>
              <div style={{ fontSize: '14px', color: tokens.textMuted }}>
                Start a new game using the buttons above
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Recent Results ────────────────────────────────────────────── */}
        {recentResults.length > 0 && (
          <motion.div variants={sectionVariants}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 12 }}>📊</span>
              <span style={{
                fontSize: 11, fontWeight: 700, color: tokens.textFaint,
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                Recent Results
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentResults.map((battle, i) => {
                const won = didUserWin(battle, user?.username);
                const bType = battle.isDraft ? 'draft' : (battle.isTrainingBattle ? 'training' : 'classic');
                return (
                  <motion.div
                    key={battle.id || i}
                    whileHover={{ scale: 1.01, boxShadow: `${tokens.obsidianShadow}, 0 8px 30px rgba(0,0,0,0.4)` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden' }}
                  >
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
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── FantasyTimes Teaser ──────────────────────────────────────── */}
        <motion.div variants={sectionVariants}>
          <FantasyTimesTeaser setScreen={setScreen} />
        </motion.div>

        {/* ── Pending Lobbies ──────────────────────────────────────────── */}
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

      </motion.div>

      {/* ─── Modals ──────────────────────────────────────────────────────── */}
      <GamesModal
        isOpen={gamesModalOpen}
        onClose={() => setGamesModalOpen(false)}
        setShowBaggerBombModal={setShowBaggerBombModal}
        setShowSnakeDraftModal={setShowSnakeDraftModal}
        setShowBaggerBombTrainingConfirm={setShowBaggerBombTrainingConfirm}
        setShowTrainingConfirmModal={setShowTrainingConfirmModal}
        setTrainingConfirmType={setTrainingConfirmType}
      />

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
