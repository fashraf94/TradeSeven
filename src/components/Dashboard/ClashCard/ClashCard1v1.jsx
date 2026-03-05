// /src/components/Dashboard/ClashCard/ClashCard1v1.jsx
// 1v1 Clash Card for Builder and BaggerBomb battles
// Features: VS layout, avatars with fixed gradients, winner-based score colors, crown badges, timer

import React from 'react';
import { motion } from 'framer-motion';
import { formatClashTimer } from '../../../utils/timerFormatters';
import TugOfWarBar from './TugOfWarBar';

// Score font stack
const SCORE_FONT = "'Inter', 'SF Pro Display', system-ui, -apple-system, sans-serif";

// Get battle type label and icon
function getBattleTypeInfo(battle) {
  if (battle._v === 3 || battle._v === 2 || battle.type === 'baggerbomb') {
    return { label: 'BAGGERBOMB', emoji: '💣', isBaggerBomb: true };
  }
  return { label: 'BUILDER 1v1', emoji: '🏗️', isBaggerBomb: false };
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
  const { opponent, myGain, theirGain, isWinning, myValue, theirValue, isV3 } = previewData;
  const typeInfo = getBattleTypeInfo(battle);
  const timer = formatClashTimer(remainingMs);
  const isTraining = battle.isTrainingBattle;
  const isBaggerBombPoints = isV3 || typeInfo.isBaggerBomb;

  // Winner-based score colors (green for winner, red for loser, tied = both green)
  const isPlayerWinning = myGain >= theirGain;
  const playerScoreColor = isPlayerWinning ? '#10b981' : '#ef4444';
  const opponentScoreColor = isPlayerWinning ? '#ef4444' : '#10b981';

  // Border color logic
  const isUrgent = timer.urgent || timer.pulse;
  const borderColor = isTraining
    ? 'rgba(147, 51, 234, 0.5)'
    : isUrgent ? 'rgba(239, 68, 68, 0.5)' : 'rgba(0, 255, 255, 0.3)';

  const cardGlow = isMostUrgent && timer.pulse
    ? '0 0 12px rgba(239, 68, 68, 0.3), 0 0 24px rgba(239, 68, 68, 0.15)'
    : '0 0 15px rgba(0, 255, 255, 0.08), inset 0 1px 0 rgba(0, 255, 255, 0.1)';

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
        background: '#0d1117',
        borderRadius: '12px',
        border: `1px solid ${borderColor}`,
        padding: '16px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: cardGlow,
        transition: 'box-shadow 0.3s ease',
      }}
    >
      {/* Pulsing border animation for urgent */}
      {isMostUrgent && timer.pulse && (
        <div style={{
          position: 'absolute',
          inset: -1,
          borderRadius: '13px',
          border: '1px solid #ef4444',
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
            fontSize: '13px',
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

        {/* Timer Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 10px',
          background: 'rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          animation: timer.pulse ? 'timer-pulse 1s ease-in-out infinite' : 'none',
        }}>
          <span style={{ fontSize: '12px', color: '#8b949e' }}>⏱</span>
          <span style={{
            fontSize: '12px',
            fontWeight: '400',
            color: '#8b949e',
          }}>
            {timer.text}
          </span>
        </div>
      </div>

      {/* VS Zone: Two avatars with scores */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
      }}>
        {/* Your Side */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
          <div style={{ position: 'relative', marginBottom: '8px' }}>
            {/* Avatar Circle — fixed cyan gradient for player */}
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #00d9ff 0%, #0099cc 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: '700',
              color: '#ffffff',
            }}>
              {(battle._myUsername || 'Y')[0].toUpperCase()}
            </div>
            {/* Crown for winner */}
            {isWinning && (
              <div style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
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
            textTransform: 'uppercase',
            marginBottom: '4px',
          }}>
            YOU
          </span>
          {/* Score */}
          <div style={{ textAlign: 'center' }}>
            {isBaggerBombPoints ? (
              <>
                <span style={{
                  fontSize: '28px',
                  fontWeight: '800',
                  color: playerScoreColor,
                  fontFamily: SCORE_FONT,
                }}>
                  {myGain >= 0 ? '+' : ''}{Math.round(myGain)}
                </span>
                <span style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: playerScoreColor,
                  fontFamily: SCORE_FONT,
                }}>
                  {' pts'}
                </span>
              </>
            ) : (
              <span style={{
                fontSize: '28px',
                fontWeight: '800',
                color: playerScoreColor,
                fontFamily: SCORE_FONT,
              }}>
                {myGain >= 0 ? '+' : ''}{myGain.toFixed(1)}%
              </span>
            )}
          </div>
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
            fontSize: '14px',
            fontWeight: '600',
            color: '#6e7681',
          }}>
            VS
          </span>
          {/* WINNING badge — only shown when there IS a leader */}
          {myGain !== theirGain && (
            <div style={{
              padding: '3px 8px',
              borderRadius: '4px',
              background: 'rgba(0, 255, 255, 0.15)',
            }}>
              <span style={{
                fontSize: '10px',
                fontWeight: '700',
                color: '#00FFFF',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                WINNING
              </span>
            </div>
          )}
        </div>

        {/* Opponent Side */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
          <div style={{ position: 'relative', marginBottom: '8px' }}>
            {/* Avatar Circle — fixed red gradient for opponent */}
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: '700',
              color: '#ffffff',
            }}>
              {(opponent || 'O')[0].toUpperCase()}
            </div>
            {/* Crown for winner */}
            {!isWinning && (
              <div style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
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
            textTransform: 'uppercase',
            marginBottom: '4px',
            maxWidth: '80px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'center',
          }}>
            {truncateName(opponent)}
          </span>
          {/* Score */}
          <div style={{ textAlign: 'center' }}>
            {isBaggerBombPoints ? (
              <>
                <span style={{
                  fontSize: '28px',
                  fontWeight: '800',
                  color: opponentScoreColor,
                  fontFamily: SCORE_FONT,
                }}>
                  {theirGain >= 0 ? '+' : ''}{Math.round(theirGain)}
                </span>
                <span style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: opponentScoreColor,
                  fontFamily: SCORE_FONT,
                }}>
                  {' pts'}
                </span>
              </>
            ) : (
              <span style={{
                fontSize: '28px',
                fontWeight: '800',
                color: opponentScoreColor,
                fontFamily: SCORE_FONT,
              }}>
                {theirGain >= 0 ? '+' : ''}{theirGain.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tug-of-War Bar */}
      <TugOfWarBar myScore={myGain} opponentScore={theirGain} />
    </motion.div>
  );
}
