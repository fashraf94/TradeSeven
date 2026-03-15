// /src/components/Dashboard/DashboardLoop.jsx
// "The Loop" — Mobile unified battle feed replacing tabbed dashboard layout
// Single-column scrollable feed merging PVP + Training battles
// Desktop layout is NOT affected — this only renders on mobile

import React, { useMemo } from 'react';
import { Flame, Menu } from 'lucide-react';
import PriorityBattleCard from './PriorityBattleCard';
import BattleRow from './BattleRow';
import FantasyTimesTeaser from './FantasyTimesTeaser';
import LoopGameModeCard from './LoopGameModeCard';
import PendingLobbiesSection from './PendingLobbiesSection';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getEndTime(battle) {
  return battle.endDate || battle.battleEndTime ||
    battle.timing?.endDate || battle.timeline?.endDate || null;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardLoop({
  user,
  colors,
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
  setShowBuilderModal,
  setShowBaggerBombTrainingConfirm,
  setShowTrainingConfirmModal,
  setTrainingConfirmType,
  setShowClassicTrainingConfirm,
  isMobile,
  setSidebarOpen,
  unreadCount,
  activeDraftBanner,
  setActiveDraftBanner,
}) {
  // ─── Battle merge: combine all active battles sorted by end time ───────────
  const allBattles = useMemo(() => {
    const merged = [
      ...activeBattles.filter(b => !b.isTrainingBattle).map(b => ({ battle: b, type: 'classic' })),
      ...activeDraftBattles.filter(b => b.status === 'active' && b.isTraining !== true).map(b => ({ battle: b, type: 'draft' })),
      ...activeDraftBattles.filter(b => b.status === 'active' && b.isTraining === true).map(b => ({ battle: b, type: 'trainingDraft' })),
      ...activeTrainingBattles.map(b => ({ battle: b, type: 'training' })),
    ];

    return merged.sort((a, b) => {
      const aEnd = getEndTime(a.battle);
      const bEnd = getEndTime(b.battle);
      if (!aEnd) return 1;
      if (!bEnd) return -1;
      return new Date(aEnd) - new Date(bEnd); // soonest ending first
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
      // V2/V3 training conversion
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
      // Classic 1v1
      setCurrentBattle(battle);
      setScreen('battle');
    }
  };

  // ─── Stats ─────────────────────────────────────────────────────────────────
  const totalActive = allBattles.length;
  const totalCompleted = completedBattles?.length || 0;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: colors.background,
      position: 'relative',
      zIndex: 1,
    }}>
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <header style={{
        background: 'linear-gradient(180deg, #161b22 0%, #0d1117 100%)',
        borderBottom: '2px solid #21262d',
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
            <div style={{ width: '24px', height: '2px', backgroundColor: '#00d9ff', borderRadius: '1px' }} />
            <div style={{ width: '24px', height: '2px', backgroundColor: '#00d9ff', borderRadius: '1px' }} />
            <div style={{ width: '24px', height: '2px', backgroundColor: '#00d9ff', borderRadius: '1px' }} />
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
                backgroundColor: '#ef4444',
                borderRadius: '9px',
                color: '#ffffff',
                fontSize: '10px',
                fontWeight: '700',
                lineHeight: 1,
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Center: greeting */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#e6edf3',
            }}>
              {getGreeting()}, {user?.username || 'Player'}
            </div>
          </div>

          {/* Right: avatar */}
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: '#1a1f2e',
            border: '2px solid #00d9ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            fontWeight: '600',
            color: '#ffffff',
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
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            padding: '12px 16px',
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
              <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '14px' }}>
                Active Draft in Progress!
              </div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>
                {activeDraftBanner.code} • Tap to rejoin
              </div>
            </div>
          </div>
          <span style={{
            padding: '8px 16px',
            background: '#ffffff',
            color: '#d97706',
            fontWeight: 'bold',
            fontSize: '13px',
            border: 'none',
            borderRadius: '8px',
          }}>
            REJOIN →
          </span>
        </div>
      )}

      {/* ─── Feed Content ───────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        padding: '20px 16px 140px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '600px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}>

        {/* ── Section 1: Priority Battle ──────────────────────────────────── */}
        {priorityBattle && (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              padding: '0 4px',
            }}>
              <Flame size={16} color="#00d9ff" />
              <span style={{
                fontSize: '13px',
                fontWeight: '700',
                color: '#e6edf3',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
              }}>
                Priority Battle
              </span>
              <span style={{
                background: 'rgba(0, 217, 255, 0.1)',
                color: '#00d9ff',
                padding: '2px 8px',
                borderRadius: '8px',
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
          </div>
        )}

        {/* ── Section 2: Secondary Battles ────────────────────────────────── */}
        {secondaryBattles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {secondaryBattles.map(({ battle, type }, i) => (
              <BattleRow
                key={battle.id || battle.firestoreId || i}
                battle={battle}
                battleType={type}
                user={user}
                colors={colors}
                onPress={() => handleBattlePress(battle, type)}
              />
            ))}
          </div>
        )}

        {/* ── Section 3: Fantasy Times Teaser ─────────────────────────────── */}
        <FantasyTimesTeaser setScreen={setScreen} colors={colors} />

        {/* ── Section 4: Game Mode Cards ───────────────────────────────────── */}
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px',
            padding: '0 4px',
          }}>
            <span style={{
              fontSize: '13px',
              fontWeight: '700',
              color: '#e6edf3',
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
            }}>
              Play a Game
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <LoopGameModeCard
              modeId="baggerbomb"
              onPvpSelect={() => setShowBaggerBombModal(true)}
              onTrainSelect={() => setShowBaggerBombTrainingConfirm(true)}
            />
            <LoopGameModeCard
              modeId="snakeDraft"
              onPvpSelect={() => setShowSnakeDraftModal(true)}
              onTrainSelect={() => {
                setTrainingConfirmType('stocks');
                setShowTrainingConfirmModal(true);
              }}
            />
            <LoopGameModeCard
              modeId="classic"
              onPvpSelect={() => setShowBuilderModal(true)}
              onTrainSelect={() => setShowClassicTrainingConfirm(true)}
            />
          </div>
        </div>

        {/* ── Section 5: Pending Lobbies ───────────────────────────────────── */}
        <PendingLobbiesSection
          lobbyBattles={lobbyBattles}
          user={user}
          setCurrentBattle={setCurrentBattle}
          setCurrentDraft={setCurrentDraft}
          setScreen={setScreen}
          setBattleToJoin={setBattleToJoin}
          copyToClipboard={copyToClipboard}
        />

        {/* ── Section 6: Stats Row ────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          gap: '12px',
          padding: '0 4px',
        }}>
          <div style={{
            flex: 1,
            padding: '16px',
            background: 'rgba(22, 27, 34, 0.8)',
            borderRadius: '12px',
            border: '1px solid rgba(48, 54, 61, 0.6)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#00d9ff' }}>
              {totalActive}
            </div>
            <div style={{ fontSize: '11px', color: '#8b949e', fontWeight: '500', marginTop: '4px' }}>
              Active Battles
            </div>
          </div>
          <div style={{
            flex: 1,
            padding: '16px',
            background: 'rgba(22, 27, 34, 0.8)',
            borderRadius: '12px',
            border: '1px solid rgba(48, 54, 61, 0.6)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#22c55e' }}>
              {totalCompleted}
            </div>
            <div style={{ fontSize: '11px', color: '#8b949e', fontWeight: '500', marginTop: '4px' }}>
              Completed
            </div>
          </div>
          <div style={{
            flex: 1,
            padding: '16px',
            background: 'rgba(22, 27, 34, 0.8)',
            borderRadius: '12px',
            border: '1px solid rgba(48, 54, 61, 0.6)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#f59e0b' }}>
              🪙 {user?.tokens || 0}
            </div>
            <div style={{ fontSize: '11px', color: '#8b949e', fontWeight: '500', marginTop: '4px' }}>
              Tokens
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
