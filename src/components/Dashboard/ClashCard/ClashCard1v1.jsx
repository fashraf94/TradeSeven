// /src/components/Dashboard/ClashCard/ClashCard1v1.jsx
// 1v1 Clash Card for Builder and BaggerBomb battles
// Features: VS layout, avatars with colored rings, tug-of-war bar, winner badges, timer

import React from 'react';
import { motion } from 'framer-motion';
import { Swords, Hammer, Bomb, Crown, Timer } from 'lucide-react';
import TugOfWarBar from './TugOfWarBar';

// Get battle type label and icon
function getBattleTypeInfo(battle) {
  if (battle._v === 2 || battle.type === 'baggerbomb') {
    return { label: 'BAGGERBOMB 1v1', icon: Bomb, emoji: '💣' };
  }
  return { label: 'BUILDER 1v1', icon: Hammer, emoji: '🏗️' };
}

// Format timer based on urgency level
function formatClashTimer(remainingMs) {
  if (remainingMs <= 0) return { text: 'ENDED', color: '#ef4444', pulse: false, urgent: false };

  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

  if (hours >= 1) {
    return { text: `${hours}h ${minutes}m`, color: '#00d9ff', pulse: false, urgent: false };
  }
  if (minutes > 5) {
    return { text: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`, color: '#ef4444', pulse: true, urgent: false };
  }
  return { text: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}!!`, color: '#ef4444', pulse: true, urgent: true };
}

// Truncate username
function truncateName(name, maxLen = 10) {
  if (!name) return '???';
  return name.length > maxLen ? name.slice(0, maxLen) + '...' : name;
}

export default function ClashCard1v1({
  battle,
  previewData,
  remainingMs,
  onPress,
  isMostUrgent = false,
}) {
  const { opponent, myGain, theirGain, isWinning, myValue, theirValue } = previewData;
  const typeInfo = getBattleTypeInfo(battle);
  const timer = formatClashTimer(remainingMs);
  const isTraining = battle.isTrainingBattle;

  // Border color logic
  const borderColor = isTraining
    ? '#9333ea'
    : (timer.urgent || timer.pulse) ? '#ef4444' : '#00d9ff';

  const borderGlow = isMostUrgent && timer.pulse
    ? `0 0 12px ${borderColor}60, 0 0 24px ${borderColor}30`
    : `0 0 8px ${borderColor}20`;

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

      {/* Header Row: Type label + Timer */}
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

      {/* VS Zone: Two avatars with returns */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
        gap: '8px',
      }}>
        {/* Your Side */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
          <div style={{ position: 'relative', marginBottom: '8px' }}>
            {/* Avatar Circle */}
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: isWinning
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(0, 217, 255, 0.2) 100%)'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.1) 100%)',
              border: `2px solid ${isWinning ? '#10b981' : '#ef4444'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: '700',
              color: '#ffffff',
            }}>
              {(battle._myUsername || 'Y')[0].toUpperCase()}
            </div>
            {/* Crown for winner */}
            {isWinning && (
              <div style={{
                position: 'absolute',
                top: '-10px',
                right: '-6px',
                fontSize: '14px',
              }}>
                👑
              </div>
            )}
          </div>
          <span style={{
            fontSize: '11px',
            color: '#8b949e',
            fontWeight: '500',
            marginBottom: '4px',
          }}>
            YOU
          </span>
          <span style={{
            fontSize: '18px',
            fontWeight: '800',
            color: myGain >= 0 ? '#10b981' : '#ef4444',
            fontFamily: "'SF Mono', 'Monaco', monospace",
          }}>
            {myGain >= 0 ? '+' : ''}{myGain.toFixed(1)}%
          </span>
        </div>

        {/* VS Divider + Status Badge */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: '16px',
            fontWeight: '800',
            color: '#6e7681',
            letterSpacing: '2px',
          }}>
            VS
          </span>
          {/* Status badge */}
          <div style={{
            padding: '3px 10px',
            borderRadius: '10px',
            background: isWinning ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${isWinning ? '#10b98140' : '#ef444440'}`,
          }}>
            <span style={{
              fontSize: '9px',
              fontWeight: '700',
              color: isWinning ? '#10b981' : '#ef4444',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              {isWinning ? 'WINNING' : 'LOSING'}
            </span>
          </div>
        </div>

        {/* Opponent Side */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
          <div style={{ position: 'relative', marginBottom: '8px' }}>
            {/* Avatar Circle */}
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: !isWinning
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(0, 217, 255, 0.2) 100%)'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.1) 100%)',
              border: `2px solid ${!isWinning ? '#10b981' : '#ef4444'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: '700',
              color: '#ffffff',
            }}>
              {(opponent || 'O')[0].toUpperCase()}
            </div>
            {/* Crown for winner */}
            {!isWinning && (
              <div style={{
                position: 'absolute',
                top: '-10px',
                right: '-6px',
                fontSize: '14px',
              }}>
                👑
              </div>
            )}
          </div>
          <span style={{
            fontSize: '11px',
            color: '#8b949e',
            fontWeight: '500',
            marginBottom: '4px',
            maxWidth: '80px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'center',
          }}>
            {truncateName(opponent)}
          </span>
          <span style={{
            fontSize: '18px',
            fontWeight: '800',
            color: theirGain >= 0 ? '#10b981' : '#ef4444',
            fontFamily: "'SF Mono', 'Monaco', monospace",
          }}>
            {theirGain >= 0 ? '+' : ''}{theirGain.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Tug of War Bar */}
      <TugOfWarBar
        myGain={myGain}
        theirGain={theirGain}
        isWinning={isWinning}
        isTraining={isTraining}
        height={5}
      />
    </motion.div>
  );
}
