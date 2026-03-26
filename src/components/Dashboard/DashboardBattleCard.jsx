// /src/components/Dashboard/DashboardBattleCard.jsx
// Premium battle card for dashboard — replaces ClashCard on both mobile and desktop
// Features: header bar, AnimatedScore, flowing tug-of-war bar, TapGlint

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { calculate1v1PreviewData, getRemainingMs, buildDraftStandings } from './ClashCard';
import AnimatedScore from '../shared/AnimatedScore';
import TapGlint from '../shared/TapGlint';
import { useBaggerBombCardScore } from '../../hooks/useBaggerBombCardScore';
import { Bot } from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimeRemaining(ms) {
  if (ms <= 0) return null;
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getOpponentName(battle, user) {
  const username = user?.username;
  if (battle.creator && battle.opponent) {
    const isCreator = (battle.creator?.odUserId || battle.creator?.uid) === (user?.odUserId || user?.username) ||
      battle.creator?.username === username;
    return isCreator
      ? (battle.opponent?.username || 'Opponent')
      : (battle.creator?.username || 'Creator');
  }
  if (battle.players) {
    const other = battle.players.find(p => p.username !== username);
    return other?.username || 'Opponent';
  }
  return 'Opponent';
}

// Extract banked daily scores + closed trade points from static battle document.
// Mirrors getBankedScoreTotal from dailyScoringV4Service + closedTrades sum.
function extractSnapshotScore(battle, role) {
  let total = 0;
  const dailyScores = battle.state?.dailyScores;
  if (dailyScores) {
    for (const dayKey of Object.keys(dailyScores)) {
      const day = dailyScores[dayKey];
      if (day?.recorded && day[role]?.activeScore != null && isFinite(day[role].activeScore)) {
        total += day[role].activeScore;
      }
    }
  }
  const closedTrades = battle[role]?.closedTrades;
  if (Array.isArray(closedTrades)) {
    for (const trade of closedTrades) {
      total += trade.lockedPoints || 0;
    }
  }
  return Math.round(total);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function HeaderBar({ gameLabel, accentColor, remainingMs, isEnded, isAgent }) {
  const timeText = formatTimeRemaining(remainingMs);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      background: 'rgba(255,255,255,0.02)',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      {/* Left: game type */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: accentColor,
          boxShadow: `0 0 6px ${accentColor}80`,
          flexShrink: 0,
        }} />
        {isAgent && <Bot size={14} color="#0d9488" style={{ flexShrink: 0 }} />}
        <span style={{
          fontSize: 10, fontWeight: 700, color: isAgent ? '#0d9488' : accentColor,
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          {gameLabel}
        </span>
      </div>

      {/* Right: status badge */}
      {isEnded ? (
        <span style={{
          fontSize: 10, fontWeight: 700, color: '#ef4444',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)',
          padding: '2px 8px', borderRadius: 4,
        }}>
          ⏱ ENDED
        </span>
      ) : timeText ? (
        <span style={{
          fontSize: 10, fontWeight: 500, color: 'rgba(148,163,184,0.8)',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '2px 8px', borderRadius: 4,
        }}>
          {timeText}
        </span>
      ) : null}
    </div>
  );
}

function TugOfWarBar({ myScore, theirScore, tokens }) {
  const absMe = Math.abs(myScore || 0);
  const absThem = Math.abs(theirScore || 0);
  const total = absMe + absThem;
  const myPct = total > 0 ? Math.max(5, Math.min(95, (absMe / total) * 100)) : 50;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px 14px' }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: tokens.teal, flexShrink: 0 }}>YOU</span>
      <div style={{
        flex: 1, height: 6, borderRadius: 3, background: '#060810',
        overflow: 'hidden', display: 'flex', gap: 2,
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)',
      }}>
        <div style={{
          width: `${myPct}%`, borderRadius: 3,
          background: 'linear-gradient(90deg, #14b8a6, #5eead4, #14b8a6)',
          backgroundSize: '200% 100%',
          animation: 'flowGradient 3s linear infinite',
        }} />
        <div style={{
          flex: 1, borderRadius: 3,
          background: 'linear-gradient(90deg, #be123c, #ef4444, #be123c)',
          backgroundSize: '200% 100%',
          animation: 'flowGradient 3s linear infinite reverse',
        }} />
      </div>
      <span style={{ fontSize: 9, fontWeight: 700, color: tokens.red, flexShrink: 0 }}>OPP</span>
    </div>
  );
}

function ScoreSection1v1({ myScore, theirScore, opponentName, isPoints, tokens }) {
  const suffix = isPoints ? '' : '%';
  const myColor = (myScore || 0) >= (theirScore || 0) ? tokens.teal : tokens.red;

  return (
    <div style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <div>
        <div style={{
          color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: 600,
          letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 4,
        }}>
          Your Score:
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <AnimatedScore
            value={isPoints ? Math.round(myScore || 0) : parseFloat((myScore || 0).toFixed(1))}
            defaultColor={myColor}
            size={44}
            suffix={suffix}
          />
          {isPoints && (
            <span style={{ fontSize: 13, color: tokens.textFaint }}>pts</span>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{
          color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600,
          letterSpacing: '0.3px', marginBottom: 4,
        }}>
          vs {opponentName}:
        </div>
        <AnimatedScore
          value={isPoints ? Math.round(theirScore || 0) : parseFloat((theirScore || 0).toFixed(1))}
          defaultColor={tokens.textMuted}
          size={28}
          suffix={suffix}
        />
      </div>
    </div>
  );
}

function DraftLeaderboard({ standings, myPosition, tokens }) {
  const positionColors = ['#ffd700', '#c0c0c0', '#cd7f32', '#6e7681'];

  return (
    <div style={{ padding: '10px 14px 14px' }}>
      {standings.slice(0, 4).map((player, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          height: 28, padding: '0 8px', borderRadius: 6,
          background: player.isMe ? 'rgba(94,234,212,0.08)' : 'transparent',
          borderLeft: player.isMe ? `2px solid ${tokens.teal}` : '2px solid transparent',
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: positionColors[i] || '#6e7681',
            width: 18, textAlign: 'center',
          }}>
            #{i + 1}
          </span>
          <span style={{
            fontSize: 12, fontWeight: player.isMe ? 600 : 400,
            color: player.isMe ? tokens.teal : tokens.textSecondary,
            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {player.isMe ? 'YOU' : player.isCPU ? `🤖 ${player.name}` : player.name}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: player.isMe ? tokens.teal : tokens.textMuted,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {Math.round(player.points)} pts
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function DashboardBattleCard({
  battle,
  battleType,
  user,
  tokens,
  onPress,
  isMostUrgent = false,
}) {
  const [remainingMs, setRemainingMs] = useState(() => getRemainingMs(battle));
  const [tapCount, setTapCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setRemainingMs(getRemainingMs(battle)), 1000);
    return () => clearInterval(interval);
  }, [battle]);

  const currentUserId = user?.odUserId || user?.username;

  // ─── Game type detection ──────────────────────────────────────────────────
  const isBaggerBomb = battle._v >= 2 || battle.type?.includes('baggerbomb');
  const isDraftType = battleType === 'draft' || battleType === 'trainingDraft';
  const isTraining = battle.isTrainingBattle || battleType === 'training' || battleType === 'trainingDraft';
  const isDraftBattle = isDraftType || (isTraining && battle.players?.length > 2);

  const isAgent = battle.agentDeployed === true;

  const gameLabel = isDraftType ? 'SNAKE DRAFT' : (isBaggerBomb ? 'BAGGERBOMB' : 'CLASSIC');
  const fullLabel = isTraining ? `${gameLabel} AI` : gameLabel;
  const accentColor = isDraftType ? '#34d399' : (isBaggerBomb ? '#f59e0b' : '#5eead4');

  const isEnded = remainingMs <= 0;

  // Client-side score computation (replaces dependency on liveScore from Firebase)
  const { myScore: cardMyScore, oppScore: cardOppScore, isLoading: cardScoreLoading, isCreator: cardIsCreator } = useBaggerBombCardScore(battle, user);

  // ─── Score data extraction ────────────────────────────────────────────────
  let content;

  if (isDraftBattle) {
    const { standings, myPosition, myPoints, leaderPoints } = buildDraftStandings(battle, currentUserId);
    content = (
      <>
        <DraftLeaderboard standings={standings} myPosition={myPosition} tokens={tokens} />
        {standings.length >= 2 && (
          <TugOfWarBar myScore={myPoints} theirScore={leaderPoints} tokens={tokens} />
        )}
      </>
    );
  } else {
    // 1v1 battle (classic, baggerbomb, training)
    const preview = calculate1v1PreviewData(battle, user?.username);

    // Unified isCreator — matches the hook's logic (odUserId/uid/username)
    const isCreator = (battle.creator?.odUserId || battle.creator?.uid) === currentUserId ||
      battle.creator?.username === user?.username;

    let myScore = 0;
    let theirScore = 0;
    let opponentName = 'Opponent';
    let isPoints = false;

    if (preview) {
      myScore = preview.myGain;
      theirScore = preview.theirGain;
      opponentName = preview.opponent || 'Opponent';
      isPoints = !!preview.isV3 || isBaggerBomb;

      // For V3+, override opponent name using unified isCreator to avoid role mismatch
      // with the preview function (which only checks username).
      if (preview.isV3) {
        opponentName = isCreator
          ? (battle.opponent?.username || 'Opponent')
          : (battle.creator?.username || 'Creator');
      }

      // V3/V4: prefer client-side computed scores from useBaggerBombCardScore.
      // Once the hook has produced non-zero scores, always use them (they persist
      // across brief non-applicable gaps via the hook's internal ref cache).
      // Only fall back to banked scores when the hook is still loading its first result.
      if (preview.isV3) {
        if (cardMyScore !== 0 || cardOppScore !== 0) {
          // Hook has computed real scores — always prefer them
          myScore = cardMyScore;
          theirScore = cardOppScore;
        } else if (!cardScoreLoading) {
          // Hook finished but scores are genuinely 0
          myScore = cardMyScore;
          theirScore = cardOppScore;
        } else {
          // Hook still loading and no scores yet — fall back to banked scores
          const myRole = isCreator ? 'creator' : 'opponent';
          const theirRole = isCreator ? 'opponent' : 'creator';
          const bankedMy = extractSnapshotScore(battle, myRole);
          const bankedTheir = extractSnapshotScore(battle, theirRole);

          if (myScore === 0 && theirScore === 0 && (bankedMy !== 0 || bankedTheir !== 0)) {
            myScore = bankedMy;
            theirScore = bankedTheir;
          }
        }
      }
    } else if (isTraining) {
      // Training fallback: use percentChange fields
      myScore = battle.player1?.percentChange || 0;
      theirScore = battle.player2?.percentChange || 0;
      opponentName = 'CPU';
      isPoints = isBaggerBomb;
    }

    if (isTraining && opponentName === 'Opponent') {
      opponentName = 'CPU';
    }

    // Diagnostic: detect role mismatches between hook and local determination
    console.log('[CardScore]', battle.id, {
      cardMyScore, cardOppScore, cardScoreLoading,
      hookIsCreator: cardIsCreator,
      localIsCreator: isCreator,
      previewMyGain: preview?.myGain,
      previewTheirGain: preview?.theirGain,
      userId: currentUserId,
    });

    content = (
      <>
        <ScoreSection1v1
          myScore={myScore}
          theirScore={theirScore}
          opponentName={opponentName}
          isPoints={isPoints}
          tokens={tokens}
        />
        <TugOfWarBar myScore={myScore} theirScore={theirScore} tokens={tokens} />
      </>
    );
  }

  // ─── Card styling ─────────────────────────────────────────────────────────
  const cardShadow = isMostUrgent
    ? '0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(168,85,247,0.05), inset 0 1px 1px rgba(255,255,255,0.08)'
    : `${tokens.obsidianShadow}, 0 4px 16px rgba(0,0,0,0.3)`;

  const cardBorder = isMostUrgent
    ? '1px solid rgba(168,85,247,0.2)'
    : `1px solid ${tokens.borderDefault}`;

  return (
    <motion.div
      onClick={() => { setTapCount(c => c + 1); onPress(); }}
      whileTap={{ scale: 0.98 }}
      whileHover={{ scale: 1.01, boxShadow: `${tokens.obsidianShadow}, 0 8px 30px rgba(0,0,0,0.4)` }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: tokens.bgCard,
        backgroundImage: isAgent
          ? 'linear-gradient(135deg, rgba(13,148,136,0.08) 0%, transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 40%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 40%)',
        border: cardBorder,
        borderLeft: isAgent ? '3px solid #0d9488' : undefined,
        borderRadius: 16,
        boxShadow: cardShadow,
        cursor: 'pointer',
      }}
    >
      <TapGlint triggerKey={tapCount} />
      <HeaderBar
        gameLabel={fullLabel}
        accentColor={accentColor}
        isAgent={isAgent}
        remainingMs={remainingMs}
        isEnded={isEnded}
      />
      {content}
    </motion.div>
  );
}
