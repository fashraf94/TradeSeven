// TDBattleScoreboard - Main scoreboard showing total scores and session breakdown
// Central UI component for TD Scoring battles

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import SessionScoreCard from './SessionScoreCard';

const SESSION_ORDER = ['MORNING_BELL', 'MIDDAY', 'POWER_HOUR', 'NIGHT_GAME'];

/**
 * TDBattleScoreboard
 * Main scoreboard showing total scores and session breakdown
 *
 * @param {Object} props
 * @param {Object} props.battle - Battle document from Firestore
 * @param {Object} props.currentUser - Current user object { uid, username }
 */
export default function TDBattleScoreboard({ battle, currentUser }) {
  // Determine if current user is creator or opponent
  const isCreator = battle?.creator?.uid === currentUser?.uid;
  const playerKey = isCreator ? 'creator' : 'opponent';
  const opponentKey = isCreator ? 'opponent' : 'creator';

  // Get player info
  const yourInfo = isCreator ? battle.creator : battle.opponent;
  const opponentInfo = isCreator ? battle.opponent : battle.creator;

  // Calculate total scores from session scores
  const { yourTotal, opponentTotal, sessionScoreData } = useMemo(() => {
    let yourTotal = 0;
    let opponentTotal = 0;
    const sessionScoreData = {};

    for (const sessionId of SESSION_ORDER) {
      const scores = battle?.sessionScores?.[sessionId];
      const yourScore = scores?.[playerKey] ?? 0;
      const oppScore = scores?.[opponentKey] ?? 0;

      yourTotal += yourScore;
      opponentTotal += oppScore;

      let winner = null;
      if (scores && scores.winner) {
        winner = scores.winner === playerKey ? 'you' : 'opponent';
      }

      sessionScoreData[sessionId] = {
        yourScore,
        opponentScore: oppScore,
        winner
      };
    }

    return { yourTotal, opponentTotal, sessionScoreData };
  }, [battle?.sessionScores, playerKey, opponentKey]);

  // Battle state
  const isActive = battle?.state?.status === 'active';
  const currentSession = battle?.state?.currentSession;
  const completedSessions = battle?.state?.completedSessions || [];

  // Score difference
  const scoreDiff = yourTotal - opponentTotal;
  const isLeading = scoreDiff > 0;

  return (
    <div className="space-y-4">
      {/* Main Score Display */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 md:p-6"
      >
        {/* Live badge */}
        {isActive && (
          <div className="flex justify-center mb-4">
            <motion.div
              animate={{ opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30"
            >
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-sm font-bold text-red-500">LIVE</span>
            </motion.div>
          </div>
        )}

        {/* Scores */}
        <div className="flex items-center justify-center gap-4 md:gap-8">
          {/* Your score */}
          <div className="text-center flex-1">
            <div className="text-sm text-muted-foreground mb-1">
              {yourInfo?.username || 'You'}
            </div>
            <motion.div
              key={yourTotal}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              className={cn(
                'text-4xl md:text-5xl font-bold tabular-nums',
                yourTotal > 0 && 'text-emerald-500',
                yourTotal < 0 && 'text-red-500',
                yourTotal === 0 && 'text-foreground'
              )}
            >
              {yourTotal > 0 ? '+' : ''}{yourTotal.toFixed(0)}
            </motion.div>
            <div className="text-xs text-muted-foreground mt-1">
              {yourInfo?.portfolioName || 'Your Portfolio'}
            </div>
          </div>

          {/* VS */}
          <div className="text-muted-foreground/50 text-sm font-medium">
            VS
          </div>

          {/* Opponent score */}
          <div className="text-center flex-1">
            <div className="text-sm text-muted-foreground mb-1">
              {opponentInfo?.username || 'Opponent'}
            </div>
            <motion.div
              key={opponentTotal}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              className={cn(
                'text-4xl md:text-5xl font-bold tabular-nums',
                opponentTotal > 0 && 'text-emerald-500',
                opponentTotal < 0 && 'text-red-500',
                opponentTotal === 0 && 'text-foreground'
              )}
            >
              {opponentTotal > 0 ? '+' : ''}{opponentTotal.toFixed(0)}
            </motion.div>
            <div className="text-xs text-muted-foreground mt-1">
              {opponentInfo?.portfolioName || 'Their Portfolio'}
            </div>
          </div>
        </div>

        {/* Lead indicator */}
        {scoreDiff !== 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn(
              'mt-4 text-center text-sm font-medium',
              isLeading ? 'text-emerald-500' : 'text-red-400'
            )}
          >
            {isLeading
              ? `You're leading by ${Math.abs(scoreDiff).toFixed(0)} points!`
              : `You're trailing by ${Math.abs(scoreDiff).toFixed(0)} points`
            }
          </motion.div>
        )}

        {scoreDiff === 0 && yourTotal !== 0 && (
          <div className="mt-4 text-center text-sm font-medium text-muted-foreground">
            It's tied!
          </div>
        )}
      </motion.div>

      {/* Session Breakdown Grid */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">
            Session Breakdown
          </span>
          {currentSession && (
            <span className="text-xs text-cyan-500">
              Current: {formatSessionName(currentSession)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 md:gap-3">
          {SESSION_ORDER.map((sessionId) => {
            const data = sessionScoreData[sessionId];
            const isSessionActive = currentSession === sessionId;
            const isSessionCompleted = completedSessions.includes(sessionId);

            return (
              <SessionScoreCard
                key={sessionId}
                session={sessionId}
                yourScore={data.yourScore}
                opponentScore={data.opponentScore}
                isActive={isSessionActive}
                isCompleted={isSessionCompleted}
                winner={data.winner}
              />
            );
          })}
        </div>
      </div>

      {/* Battle result if completed */}
      {battle?.state?.status === 'completed' && battle?.result && (
        <BattleResult
          result={battle.result}
          isWinner={
            (isCreator && battle.result.winner === 'creator') ||
            (!isCreator && battle.result.winner === 'opponent')
          }
          yourScore={yourTotal}
          opponentScore={opponentTotal}
        />
      )}
    </div>
  );
}

/**
 * Battle Result component
 */
function BattleResult({ result, isWinner, yourScore, opponentScore }) {
  const isTie = result.winner === 'tie';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'rounded-xl border p-6 text-center',
        isWinner && 'border-emerald-500/50 bg-emerald-500/10',
        !isWinner && !isTie && 'border-red-500/50 bg-red-500/10',
        isTie && 'border-amber-500/50 bg-amber-500/10'
      )}
    >
      <div className="text-4xl mb-2">
        {isWinner ? '🏆' : isTie ? '🤝' : '😤'}
      </div>
      <div
        className={cn(
          'text-2xl font-bold',
          isWinner && 'text-emerald-500',
          !isWinner && !isTie && 'text-red-500',
          isTie && 'text-amber-500'
        )}
      >
        {isWinner ? 'Victory!' : isTie ? 'It\'s a Tie!' : 'Defeat'}
      </div>
      <div className="text-sm text-muted-foreground mt-2">
        Final Score: {yourScore} - {opponentScore}
      </div>
      {result.margin > 0 && !isTie && (
        <div className="text-xs text-muted-foreground mt-1">
          {isWinner ? 'Won' : 'Lost'} by {result.margin.toFixed(0)} points
        </div>
      )}
      {result.cleanSweep && (
        <div className="mt-2 text-sm font-medium text-amber-500">
          🧹 Clean Sweep!
        </div>
      )}
    </motion.div>
  );
}

/**
 * Format session name for display
 */
function formatSessionName(sessionId) {
  const names = {
    MORNING_BELL: 'Morning Bell',
    MIDDAY: 'Midday',
    POWER_HOUR: 'Power Hour',
    NIGHT_GAME: 'Night Game'
  };
  return names[sessionId] || sessionId;
}
