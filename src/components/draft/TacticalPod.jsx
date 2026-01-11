import React, { useState, useEffect } from 'react';
import { HOLO_COLORS, GLOW_EFFECTS, RANK_CONFIG } from '../../constants/holoTheme';

/**
 * TacticalPod - Hexagonal player marker for the Altitude Map
 *
 * Displays player rank, name, gain percentage in a hexagonal pod
 * that floats at the appropriate altitude on the map.
 */
const TacticalPod = ({
  player,           // { odUserId, displayName, totalGain, isMe, isCPU, currentRank, previousRank }
  rank,             // 1-4
  isUser,           // Boolean - is this the current user?
  onScout,          // Callback when tapped (for scouting opponents)
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

  // Responsive dimensions
  const podWidth = isMobile ? 100 : 120;
  const podHeight = isMobile ? 110 : 130;
  const nameFontSize = isMobile ? '10px' : '12px';
  const gainFontSize = isMobile ? '16px' : '20px';
  const rankFontSize = isMobile ? '8px' : '10px';

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
        filter: colors.glow !== 'none' ? `drop-shadow(${colors.glow})` : 'none',
        animation: isUser || rank === 1 ? 'holoPulse 3s ease-in-out infinite' : 'none',
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
          padding: '12px 8px',
          backdropFilter: 'blur(8px)',
          position: 'relative',
        }}>
          {/* Rank Badge - positioned at top of hexagon */}
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: colors.labelBg,
            color: colors.labelColor,
            fontSize: rankFontSize,
            fontWeight: 800,
            padding: '3px 10px',
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
            marginTop: '18px',
            textAlign: 'center',
            maxWidth: `${podWidth - 20}px`,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            {player.displayName}
            {player.isCPU && <span style={{ opacity: 0.7 }}>BOT</span>}
          </div>

          {/* Color label (matching design mockup) */}
          <div style={{
            fontSize: '8px',
            color: colors.border,
            marginTop: '2px',
            opacity: 0.8,
          }}>
            {isUser ? 'Cyan #00ffff' :
             rank === 1 ? 'Gold #ffd700' :
             rank === 3 ? 'Bronze #cd7f32' :
             rank === 4 ? 'Red tint' : ''}
          </div>

          {/* YOU indicator */}
          {isUser && (
            <div style={{
              fontSize: '9px',
              color: HOLO_COLORS.cyan,
              fontWeight: 700,
              marginTop: '2px',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
            }}>
              YOU<span style={{ color: HOLO_COLORS.gold }}>★</span>
            </div>
          )}

          {/* Gain Percentage */}
          <div style={{
            fontSize: gainFontSize,
            fontWeight: 700,
            color: player.totalGain >= 0 ? HOLO_COLORS.green : HOLO_COLORS.red,
            textShadow: player.totalGain >= 0
              ? '0 0 12px rgba(0, 255, 136, 0.7)'
              : '0 0 12px rgba(255, 51, 102, 0.7)',
            marginTop: isUser ? '2px' : '8px',
            fontFamily: 'monospace',
          }}>
            {player.totalGain >= 0 ? '+' : ''}{player.totalGain.toFixed(2)}%
          </div>

          {/* Movement Indicator */}
          {movement && (
            <div style={{
              position: 'absolute',
              bottom: '12px',
              right: '16px',
              fontSize: '14px',
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
          fontSize: '8px',
          color: HOLO_COLORS.textMuted,
          textAlign: 'center',
          marginTop: '6px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
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
      `}</style>
    </div>
  );
};

export default TacticalPod;
