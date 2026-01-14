import React from 'react';
import { HOLO_COLORS } from '../../constants/holoTheme';

/**
 * OvertakeCallout - Badge showing the gap between players
 *
 * Displays "-25 pts TO OVERTAKE" style callout positioned
 * between players on the Altitude Map.
 *
 * BaggerBomb Scoring Update: Now shows points gap instead of percentage.
 */
const OvertakeCallout = ({
  gapPercent,         // The point difference (positive = gap to close) - named gapPercent for backwards compatibility
  isUserGap = false,  // Is this showing the gap for the current user to close?
  direction = 'up',   // 'up' = user needs to gain, 'down' = user is ahead
  style = {},
}) => {
  // Only show if gap is meaningful (at least 5 points)
  if (Math.abs(gapPercent) < 5) return null;

  // Determine styling based on whether this is user's gap
  const borderColor = isUserGap ? HOLO_COLORS.cyan : HOLO_COLORS.amber;
  const bgColor = isUserGap
    ? 'rgba(0, 255, 255, 0.1)'
    : 'rgba(245, 158, 11, 0.1)';
  const textColor = isUserGap ? HOLO_COLORS.cyan : HOLO_COLORS.amber;

  return (
    <div style={{
      position: 'absolute',
      transform: 'translateX(-50%)',
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: '4px',
      padding: '5px 12px',
      fontSize: '9px',
      fontWeight: 700,
      color: textColor,
      whiteSpace: 'nowrap',
      backdropFilter: 'blur(4px)',
      zIndex: 15,
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      boxShadow: `0 0 10px ${borderColor}33`,
      ...style,
    }}>
      {/* Left bracket */}
      <span style={{
        fontSize: '12px',
        opacity: 0.6,
      }}>
        [
      </span>

      {/* Gap text - now shows points */}
      <span>
        {gapPercent > 0 ? '-' : '+'}{Math.abs(gapPercent).toFixed(0)} pts TO OVERTAKE
      </span>

      {/* Right bracket */}
      <span style={{
        fontSize: '12px',
        opacity: 0.6,
      }}>
        ]
      </span>
    </div>
  );
};

export default OvertakeCallout;
