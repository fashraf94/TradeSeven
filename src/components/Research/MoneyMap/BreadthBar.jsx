// /src/components/Research/MoneyMap/BreadthBar.jsx

import React from 'react';

/**
 * BreadthBar — Horizontal fill bar showing sector breadth percentage
 *
 * @param {{ breadth: number, direction: string, tier: object, compact?: boolean }} props
 * @param {number}  props.breadth   - 0-100 percent fill
 * @param {string}  props.direction - 'expanding' | 'contracting' | 'stable'
 * @param {Object}  props.tier      - { label, color, tooltip, percent } from engine
 * @param {boolean} [props.compact] - If true, omits tier label (used in collapsed card)
 */
const BreadthBar = ({ breadth, direction, tier, compact = false }) => {
  const safeBreadth = typeof breadth === 'number' && isFinite(breadth)
    ? Math.max(0, Math.min(100, breadth))
    : 50;
  const fillWidth = Math.max(safeBreadth, 3); // min 3% so bar is always visible

  const isCapitulation = tier?.label === 'Capitulation';
  const isFullParticipation = tier?.label === 'Full Participation';
  const fillColor = tier?.color || '#8b949e';

  const directionArrow = direction === 'expanding' ? '\u2191'
    : direction === 'contracting' ? '\u2193'
    : '\u2192';

  const directionColor = direction === 'expanding' ? '#10b981'
    : direction === 'contracting' ? '#ef4444'
    : '#8b949e';

  return (
    <div>
      {/* Track */}
      <div style={{
        position: 'relative',
        height: '6px',
        background: '#30363d',
        borderRadius: '9999px',
        overflow: 'hidden',
      }}>
        {/* Fill */}
        <div style={{
          width: `${fillWidth}%`,
          height: '100%',
          borderRadius: '9999px',
          background: fillColor,
          transition: 'width 0.5s ease',
          ...(isCapitulation ? {
            animation: 'breadthPulse 1.5s ease-in-out infinite',
          } : {}),
          ...(isFullParticipation ? {
            boxShadow: `0 0 8px ${fillColor}4D, 0 0 16px ${fillColor}26`,
          } : {}),
        }} />
      </div>

      {/* Labels row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '4px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          {/* Direction arrow */}
          <span style={{
            fontSize: '10px',
            color: directionColor,
            fontWeight: '700',
          }}>
            {directionArrow}
          </span>
          {/* Percentage */}
          <span style={{
            fontSize: '12px',
            fontWeight: '700',
            color: fillColor,
          }}>
            {safeBreadth}%
          </span>
        </div>
        {/* Tier label (hidden in compact mode) */}
        {!compact && tier?.label && (
          <span style={{
            fontSize: '10px',
            color: '#8b949e',
          }}>
            {tier.label}
          </span>
        )}
      </div>

      {/* Pulse keyframe for capitulation */}
      {isCapitulation && (
        <style>{`
          @keyframes breadthPulse {
            0%, 100% { opacity: 1; box-shadow: 0 0 4px rgba(153,27,27,0.4); }
            50% { opacity: 0.6; box-shadow: 0 0 12px rgba(153,27,27,0.8); }
          }
        `}</style>
      )}
    </div>
  );
};

export default BreadthBar;
