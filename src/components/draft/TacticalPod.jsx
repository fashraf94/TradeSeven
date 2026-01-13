import React, { useState, useEffect } from 'react';
import { HOLO_COLORS, GLOW_EFFECTS, RANK_CONFIG } from '../../constants/holoTheme';
import { BotIcon, StarIcon } from './HoloIcons';

/**
 * TacticalPod - Hexagonal player marker for the Altitude Map
 *
 * Displays player rank, name, and BaggerBomb points in a hexagonal pod
 * that floats at the appropriate altitude on the map.
 *
 * BaggerBomb Scoring Update: Now shows total points as primary score
 * with BaggerBomb (💣) and Bust (📉) indicators.
 */
const TacticalPod = ({
  player,           // { odUserId, displayName, totalPoints, totalGain, totalBaggerBombs, totalBusts, isMe, isCPU, currentRank, previousRank }
  rank,             // 1-4
  isUser,           // Boolean - is this the current user?
  onScout,          // Callback when tapped (for scouting opponents)
  isBeingScouted = false,  // Boolean - is this pod currently being scouted?
  style = {},       // Position styles from parent
}) => {
  // Mobile detection for responsive sizing
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Responsive dimensions - Phase 5.6: Reduced mobile sizes to prevent overlap
  const podWidth = isMobile ? 75 : 110;
  const podHeight = isMobile ? 85 : 120;
  const rankFontSize = isMobile ? '8px' : '9px';
  const nameFontSize = isMobile ? '9px' : '11px';
  const gainFontSize = isMobile ? '14px' : '18px';
  const youFontSize = isMobile ? '8px' : '9px';

  // Determine pod colors based on rank and user status
  const getPodColors = () => {
    if (isUser) {
      return {
        bg: 'rgba(0, 255, 255, 0.12)',
        border: HOLO_COLORS.cyan,
        glow: GLOW_EFFECTS.cyan,
        labelBg: HOLO_COLORS.cyan,
        labelColor: '#000',
      };
    }

    const rankColors = {
      1: {
        bg: 'rgba(255, 215, 0, 0.12)',
        border: HOLO_COLORS.gold,
        glow: GLOW_EFFECTS.gold,
        labelBg: HOLO_COLORS.gold,
        labelColor: '#000',
      },
      2: {
        bg: 'rgba(192, 192, 192, 0.12)',
        border: HOLO_COLORS.silver,
        glow: 'none',
        labelBg: HOLO_COLORS.silver,
        labelColor: '#000',
      },
      3: {
        bg: 'rgba(205, 127, 50, 0.12)',
        border: HOLO_COLORS.bronze,
        glow: 'none',
        labelBg: HOLO_COLORS.bronze,
        labelColor: '#000',
      },
      4: {
        bg: 'rgba(255, 51, 102, 0.12)',
        border: HOLO_COLORS.red,
        glow: 'none',
        labelBg: HOLO_COLORS.red,
        labelColor: '#fff',
      },
    };

    return rankColors[rank] || rankColors[4];
  };

  const colors = getPodColors();

  // Movement indicator
  const getMovement = () => {
    if (!player.previousRank || player.previousRank === rank) return null;
    return player.previousRank > rank ? '↑' : '↓';
  };

  const movement = getMovement();

  // Hexagon clip path (pointed top/bottom)
  const hexClipPath = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';

  const handleClick = () => {
    if (!isUser && onScout) {
      onScout(player);
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'absolute',
        cursor: isUser ? 'default' : 'pointer',
        transition: 'transform 0.3s ease, filter 0.3s ease',
        zIndex: isUser ? 10 : 5,
        ...style,
      }}
    >
      {/* Outer glow container */}
      <div style={{
        position: 'relative',
        filter: isBeingScouted
          ? `drop-shadow(0 0 15px ${HOLO_COLORS.amber}) drop-shadow(0 0 30px ${HOLO_COLORS.amber}66)`
          : colors.glow !== 'none' ? `drop-shadow(${colors.glow})` : 'none',
        animation: isBeingScouted
          ? 'scoutedPulse 1.5s ease-in-out infinite'
          : isUser || rank === 1 ? 'holoPulse 3s ease-in-out infinite' : 'none',
      }}>
        {/* Hexagon Pod */}
        <div style={{
          width: `${podWidth}px`,
          height: `${podHeight}px`,
          clipPath: hexClipPath,
          background: `linear-gradient(180deg, ${colors.bg} 0%, rgba(13, 17, 23, 0.95) 100%)`,
          border: `2px solid ${colors.border}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isMobile ? '8px 4px' : '12px 8px',
          backdropFilter: 'blur(8px)',
          position: 'relative',
        }}>
          {/* Rank Badge - positioned at top of hexagon */}
          <div style={{
            position: 'absolute',
            top: isMobile ? '6px' : '8px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: colors.labelBg,
            color: colors.labelColor,
            fontSize: rankFontSize,
            fontWeight: 800,
            padding: isMobile ? '2px 6px' : '2px 8px',
            borderRadius: '4px',
            letterSpacing: '0.5px',
            boxShadow: colors.glow !== 'none' ? `0 0 8px ${colors.border}` : 'none',
          }}>
            {RANK_CONFIG[rank]?.label || `${rank}TH`}
          </div>

          {/* Player Name */}
          <div style={{
            fontSize: nameFontSize,
            fontWeight: 600,
            color: HOLO_COLORS.textPrimary,
            marginTop: isMobile ? '14px' : '16px',
            textAlign: 'center',
            maxWidth: isMobile ? '65px' : '90px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
          }}>
            {player.isCPU && <BotIcon size={isMobile ? 10 : 12} />}
            {player.displayName}
          </div>

          {/* YOU indicator */}
          {isUser && (
            <div style={{
              fontSize: youFontSize,
              color: HOLO_COLORS.cyan,
              fontWeight: 700,
              marginTop: '1px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
            }}>
              YOU <StarIcon size={isMobile ? 10 : 12} color={HOLO_COLORS.gold} />
            </div>
          )}

          {/* Total Points - PRIMARY SCORE */}
          <div style={{
            fontSize: gainFontSize,
            fontWeight: 700,
            color: (player.totalPoints || 0) >= 0 ? HOLO_COLORS.green : HOLO_COLORS.red,
            textShadow: (player.totalPoints || 0) >= 0
              ? '0 0 8px rgba(0, 255, 136, 0.6)'
              : '0 0 8px rgba(255, 51, 102, 0.6)',
            marginTop: isMobile ? '2px' : '4px',
            fontFamily: 'monospace',
          }}>
            {(player.totalPoints || 0) >= 0 ? '+' : ''}{(player.totalPoints || 0).toFixed(0)} pts
          </div>

          {/* BaggerBomb / Bust Indicators */}
          {(player.totalBaggerBombs > 0 || player.totalBusts > 0) && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: isMobile ? '4px' : '6px',
              marginTop: '2px',
              fontSize: isMobile ? '9px' : '10px',
            }}>
              {player.totalBaggerBombs > 0 && (
                <span style={{
                  color: HOLO_COLORS.green,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                }}>
                  💣 {player.totalBaggerBombs}
                </span>
              )}
              {player.totalBusts > 0 && (
                <span style={{
                  color: HOLO_COLORS.red,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                }}>
                  📉 {player.totalBusts}
                </span>
              )}
            </div>
          )}

          {/* Percentage Gain - SECONDARY (smaller) */}
          <div style={{
            fontSize: isMobile ? '8px' : '9px',
            color: HOLO_COLORS.textMuted,
            marginTop: '1px',
            fontFamily: 'monospace',
          }}>
            ({player.totalGain >= 0 ? '+' : ''}{player.totalGain.toFixed(1)}%)
          </div>

          {/* Movement Indicator */}
          {movement && (
            <div style={{
              position: 'absolute',
              bottom: isMobile ? '8px' : '12px',
              right: isMobile ? '10px' : '16px',
              fontSize: isMobile ? '10px' : '14px',
              fontWeight: 700,
              color: movement === '↑' ? HOLO_COLORS.green : HOLO_COLORS.red,
            }}>
              {movement}
            </div>
          )}
        </div>
      </div>

      {/* "Tap to Scout" hint for opponents */}
      {!isUser && (
        <div style={{
          fontSize: isMobile ? '7px' : '8px',
          color: HOLO_COLORS.textMuted,
          textAlign: 'center',
          marginTop: isMobile ? '2px' : '6px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          opacity: 0.7,
        }}>
          Tap to Scout
        </div>
      )}

      {/* CSS Animation */}
      <style>{`
        @keyframes holoPulse {
          0%, 100% { filter: drop-shadow(${colors.glow !== 'none' ? colors.glow : '0 0 0 transparent'}); }
          50% { filter: drop-shadow(${colors.glow !== 'none' ? colors.glow.replace('15px', '20px').replace('30px', '40px') : '0 0 0 transparent'}); }
        }

        @keyframes scoutedPulse {
          0%, 100% {
            filter: drop-shadow(0 0 15px ${HOLO_COLORS.amber}) drop-shadow(0 0 30px rgba(245, 158, 11, 0.4));
          }
          50% {
            filter: drop-shadow(0 0 20px ${HOLO_COLORS.amber}) drop-shadow(0 0 40px rgba(245, 158, 11, 0.6));
          }
        }
      `}</style>

      {/* Scouted indicator badge */}
      {isBeingScouted && (
        <div style={{
          position: 'absolute',
          top: '-12px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: HOLO_COLORS.amber,
          color: '#000',
          fontSize: '8px',
          fontWeight: 800,
          padding: '2px 8px',
          borderRadius: '4px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          boxShadow: `0 0 10px ${HOLO_COLORS.amber}`,
          animation: 'pulse 1s ease-in-out infinite',
          zIndex: 20,
        }}>
          SCOUTING
        </div>
      )}
    </div>
  );
};

export default TacticalPod;
