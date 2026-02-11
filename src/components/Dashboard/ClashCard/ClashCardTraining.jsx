// /src/components/Dashboard/ClashCard/ClashCardTraining.jsx
// Simplified purple-themed training Clash Card for AI battles
// Centered layout with return %, position, no opponent display

import React from 'react';
import { motion } from 'framer-motion';
import { Timer } from 'lucide-react';
import TugOfWarBar from './TugOfWarBar';
import { formatTrainingTimer } from '../../../utils/timerFormatters';

// Get battle type info for training
function getTrainingTypeInfo(battle) {
  // Check if it's a draft training
  if (battle.players && battle.players.length > 2) {
    return { label: 'SNAKE DRAFT AI', emoji: '🐍', isDraft: true };
  }
  if (battle._v >= 4 || battle.type === 'baggerbomb_v4') {
    return { label: 'BAGGERBOMB AI', emoji: '💣', isDraft: false };
  }
  if (battle._v === 2 || battle.type === 'baggerbomb') {
    return { label: 'BAGGERBOMB AI', emoji: '💣', isDraft: false };
  }
  return { label: 'BUILDER AI', emoji: '🏗️', isDraft: false };
}

export default function ClashCardTraining({
  battle,
  myReturn = 0,
  opponentReturn = 0,
  position = null,
  totalPlayers = null,
  remainingMs,
  onPress,
}) {
  const typeInfo = getTrainingTypeInfo(battle);
  const timer = formatTrainingTimer(remainingMs);
  const isWinning = myReturn > opponentReturn;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      onClick={onPress}
      style={{
        flex: '0 0 auto',
        width: 'calc(85vw - 32px)',
        maxWidth: '340px',
        minWidth: '280px',
        scrollSnapAlign: 'start',
        background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.08) 0%, #161b22 100%)',
        borderRadius: '16px',
        border: '2px solid #9333ea',
        padding: '16px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 0 12px rgba(147, 51, 234, 0.2)',
        transition: 'box-shadow 0.3s ease',
      }}
    >
      {/* Header Row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>{typeInfo.emoji}</span>
          <span style={{
            fontSize: '12px',
            fontWeight: '700',
            color: '#e6edf3',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            {typeInfo.label}
          </span>
        </div>

        {/* Timer Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 10px',
          background: `${timer.color}15`,
          borderRadius: '8px',
          border: `1px solid ${timer.color}40`,
          animation: timer.pulse ? 'timer-pulse 1s ease-in-out infinite' : 'none',
        }}>
          <Timer size={12} style={{ color: timer.color }} />
          <span style={{
            fontSize: '12px',
            fontWeight: '700',
            color: timer.color,
            fontFamily: "'SF Mono', 'Monaco', monospace",
          }}>
            {timer.text}
          </span>
        </div>
      </div>

      {/* Main Stats */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        {/* Return Display */}
        <div>
          <span style={{
            fontSize: '12px',
            color: '#8b949e',
            fontWeight: '500',
            display: 'block',
            marginBottom: '4px',
          }}>
            Your Return:
          </span>
          <span style={{
            fontSize: '26px',
            fontWeight: '800',
            color: myReturn >= 0 ? '#10b981' : '#ef4444',
            fontFamily: "'SF Mono', 'Monaco', monospace",
          }}>
            {myReturn >= 0 ? '+' : ''}{myReturn.toFixed(1)}%
          </span>
        </div>

        {/* Position (for draft training) or vs AI indicator */}
        <div style={{ textAlign: 'right' }}>
          {position !== null && totalPlayers !== null ? (
            <>
              <span style={{
                fontSize: '12px',
                color: '#8b949e',
                fontWeight: '500',
                display: 'block',
                marginBottom: '4px',
              }}>
                Position:
              </span>
              <span style={{
                fontSize: '20px',
                fontWeight: '800',
                color: '#a78bfa',
                fontFamily: "'SF Mono', 'Monaco', monospace",
              }}>
                #{position} <span style={{ fontSize: '14px', color: '#6e7681' }}>of {totalPlayers}</span>
              </span>
            </>
          ) : (
            <>
              <span style={{
                fontSize: '12px',
                color: '#8b949e',
                fontWeight: '500',
                display: 'block',
                marginBottom: '4px',
              }}>
                vs AI
              </span>
              <span style={{
                fontSize: '16px',
                fontWeight: '700',
                color: '#6e7681',
              }}>
                24h
              </span>
            </>
          )}
        </div>
      </div>

      {/* Tug of War Bar (purple themed) */}
      <TugOfWarBar
        myGain={myReturn}
        theirGain={opponentReturn}
        isWinning={isWinning}
        isTraining={true}
        height={4}
      />
    </motion.div>
  );
}
