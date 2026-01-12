import React from 'react';
import { HOLO_COLORS } from '../../../constants/holoTheme';

/**
 * SwapsRemaining - Badge showing remaining daily swaps
 *
 * Displays:
 * - Amber badge when swaps available
 * - Red badge when no swaps left
 * - Dimmed when window is closed
 */
const SwapsRemaining = ({ count, isWindowOpen }) => {
  const isEmpty = count === 0;
  const color = isEmpty ? HOLO_COLORS.red : HOLO_COLORS.amber;

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 12px',
      background: isEmpty ? 'rgba(255, 51, 102, 0.15)' : 'rgba(245, 158, 11, 0.15)',
      border: `1px solid ${color}66`,
      borderRadius: '20px',
      opacity: isWindowOpen ? 1 : 0.5,
    }}>
      <span style={{
        fontSize: '14px',
        fontWeight: 700,
        color: color,
        textShadow: `0 0 8px ${color}66`,
      }}>
        {count}
      </span>
      <span style={{
        fontSize: '10px',
        fontWeight: 600,
        color: HOLO_COLORS.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {count === 1 ? 'Swap Left' : 'Swaps Left'}
      </span>
    </div>
  );
};

export default SwapsRemaining;
