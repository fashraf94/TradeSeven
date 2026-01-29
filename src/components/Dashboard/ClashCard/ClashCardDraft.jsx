// /src/components/Dashboard/ClashCard/ClashCardDraft.jsx
// 4-player Snake Draft Clash Card with leaderboard layout
// Shows positions [1]-[4], YOUR row highlighted, return %, ladder gap

import React from 'react';
import { motion } from 'framer-motion';
import { Timer } from 'lucide-react';
import { formatClashTimer } from '../../../utils/timerFormatters';

// Get ordinal suffix for position
function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Position label mapping
const POSITION_LABELS = {
  1: { label: '(Leader)', color: '#ffd700' },
  2: { label: '(Next)', color: '#c0c0c0' },
  3: { label: '(Next)', color: '#cd7f32' },
  4: { label: '(Last)', color: '#6e7681' },
};

export default function ClashCardDraft({
  battle,
  standings,
  myPosition,
  myPoints,
  leaderPoints,
  remainingMs,
  onPress,
  isMostUrgent = false,
  currentUserId,
}) {
  const timer = formatClashTimer(remainingMs);
  const isTraining = battle.isTrainingBattle;
  const playerCount = battle.players?.length || 4;

  // Border color
  const borderColor = isTraining
    ? '#9333ea'
    : (timer.urgent || timer.pulse) ? '#ef4444' : '#00d9ff';

  const borderGlow = isMostUrgent && timer.pulse
    ? `0 0 12px ${borderColor}60, 0 0 24px ${borderColor}30`
    : `0 0 8px ${borderColor}20`;

  // Calculate ladder gap in points
  const ladderGap = myPosition > 1 && leaderPoints !== null
    ? Math.round(leaderPoints - myPoints)
    : null;

  // Place text
  const placeText = myPosition ? `(${getOrdinal(myPosition)} PLACE)` : '';

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
        background: '#161b22',
        borderRadius: '16px',
        border: `2px solid ${borderColor}`,
        padding: '16px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: borderGlow,
        transition: 'box-shadow 0.3s ease',
      }}
    >
      {/* Pulsing border animation for urgent */}
      {isMostUrgent && timer.pulse && (
        <div style={{
          position: 'absolute',
          inset: -2,
          borderRadius: '18px',
          border: `2px solid ${borderColor}`,
          opacity: 0.5,
          animation: 'clash-pulse 1.5s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}

      {/* Header Row: Type + Timer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🐍</span>
          <span style={{
            fontSize: '12px',
            fontWeight: '700',
            color: '#e6edf3',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            SNAKE DRAFT {isTraining ? 'AI' : 'PVP'}
          </span>
          {isTraining && (
            <span style={{
              padding: '2px 6px',
              background: 'rgba(147, 51, 234, 0.2)',
              borderRadius: '4px',
              fontSize: '9px',
              fontWeight: '700',
              color: '#a78bfa',
            }}>
              AI
            </span>
          )}
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

      {/* Main content: Leaderboard + Your Stats */}
      <div style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'stretch',
      }}>
        {/* Leaderboard - Left side */}
        <div style={{ flex: 1 }}>
          {standings.map((player, idx) => {
            const position = idx + 1;
            const isMe = player.isMe;
            const posInfo = POSITION_LABELS[position] || POSITION_LABELS[4];

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 8px',
                  marginBottom: idx < standings.length - 1 ? '2px' : 0,
                  borderRadius: '6px',
                  background: isMe ? 'rgba(0, 217, 255, 0.1)' : 'transparent',
                  border: isMe ? '1px solid rgba(0, 217, 255, 0.3)' : '1px solid transparent',
                }}
              >
                {/* Position number */}
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: posInfo.color,
                  minWidth: '18px',
                  fontFamily: "'SF Mono', 'Monaco', monospace",
                }}>
                  [{position}]
                </span>

                {/* Avatar circle */}
                <div style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: isMe ? 'rgba(0, 217, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  border: `1.5px solid ${isMe ? '#00d9ff' : '#30363d'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: '600',
                  color: isMe ? '#00d9ff' : '#8b949e',
                  flexShrink: 0,
                }}>
                  {player.isCPU ? '🤖' : (player.name || 'P')[0].toUpperCase()}
                </div>

                {/* Name */}
                <span style={{
                  fontSize: '12px',
                  fontWeight: isMe ? '700' : '500',
                  color: isMe ? '#00d9ff' : '#8b949e',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {isMe ? 'YOU' : (player.name?.slice(0, 8) || 'Player')}
                </span>

                {/* Position label */}
                <span style={{
                  fontSize: '9px',
                  color: '#6e7681',
                  flexShrink: 0,
                }}>
                  {isMe ? '' : `(${position === 1 ? 'Leader' : position === standings.length ? 'Last' : 'Next'})`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Your Stats - Right side */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          justifyContent: 'center',
          minWidth: '90px',
          paddingLeft: '8px',
          borderLeft: '1px solid #21262d',
        }}>
          <span style={{
            fontSize: '22px',
            fontWeight: '800',
            color: myPoints >= 0 ? '#10b981' : '#ef4444',
            fontFamily: "'SF Mono', 'Monaco', monospace",
            lineHeight: 1.1,
          }}>
            {Math.round(myPoints)} pts
          </span>
          <span style={{
            fontSize: '10px',
            fontWeight: '600',
            color: '#8b949e',
            marginTop: '4px',
            textTransform: 'uppercase',
          }}>
            {placeText}
          </span>

          {/* Ladder Gap */}
          {ladderGap !== null && myPosition > 1 && (
            <div style={{
              marginTop: '6px',
              padding: '2px 6px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '4px',
            }}>
              <span style={{
                fontSize: '10px',
                fontWeight: '600',
                color: '#8b949e',
              }}>
                LADDER GAP:
              </span>
              <br />
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                color: '#ef4444',
                fontFamily: "'SF Mono', 'Monaco', monospace",
              }}>
                {ladderGap} pts to 1st
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
