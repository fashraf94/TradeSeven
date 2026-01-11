import React from 'react';
import { HOLO_COLORS } from '../../constants/holoTheme';

/**
 * ScoutTransitionOverlay - Signal intercept animation for scout mode
 *
 * Creates a dramatic visual effect when entering/exiting scout mode:
 * - Background flash in amber (entering) or cyan (exiting)
 * - Scanline sweeping down the screen
 * - Glitch effect with horizontal lines
 * - Center text flash announcement
 */
const ScoutTransitionOverlay = ({
  active,           // Boolean - is transition happening?
  entering = true,  // true = entering scout, false = exiting
}) => {
  if (!active) return null;

  const color = entering ? HOLO_COLORS.amber : HOLO_COLORS.cyan;
  const rgbValues = entering ? '245, 158, 11' : '0, 255, 255';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {/* Background flash */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `rgba(${rgbValues}, 0.15)`,
        animation: 'flashFade 0.4s ease-out forwards',
      }} />

      {/* Scanline sweeping down */}
      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        height: '4px',
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        boxShadow: `0 0 20px ${color}, 0 0 40px ${color}`,
        animation: 'scanDown 0.5s ease-out forwards',
      }} />

      {/* Glitch lines */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(${rgbValues}, 0.1) 2px,
          rgba(${rgbValues}, 0.1) 4px
        )`,
        animation: 'glitchFlicker 0.3s ease-out',
      }} />

      {/* Center text flash */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: '14px',
        fontWeight: 700,
        color: color,
        textTransform: 'uppercase',
        letterSpacing: '4px',
        textShadow: `0 0 20px ${color}, 0 0 40px ${color}`,
        animation: 'textFlash 0.5s ease-out forwards',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <span style={{ fontSize: '18px' }}>
          {entering ? '📡' : '✓'}
        </span>
        {entering ? 'INTERCEPTING SIGNAL...' : 'RETURNING TO BASE'}
      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes scanDown {
          0% { top: 0; opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }

        @keyframes flashFade {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }

        @keyframes glitchFlicker {
          0% { opacity: 0.8; transform: translateX(0); }
          20% { opacity: 0.6; transform: translateX(-3px); }
          40% { opacity: 0.9; transform: translateX(3px); }
          60% { opacity: 0.5; transform: translateX(-2px); }
          80% { opacity: 0.8; transform: translateX(1px); }
          100% { opacity: 0; transform: translateX(0); }
        }

        @keyframes textFlash {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
          30% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
          60% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default ScoutTransitionOverlay;
