import React from 'react';
import { HOLO_COLORS, GLOW_EFFECTS } from '../../../constants/holoTheme';

/**
 * WindowStatus - Shows Free Agency window open/closed status with countdown
 *
 * Displays:
 * - Green pulsing indicator when open with time until close
 * - Red static indicator when closed with time until open
 * - Window hours for the portfolio type
 */
const WindowStatus = ({ isOpen, timeInfo, portfolioType }) => {
  const formatTime = (hours, minutes) => {
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const windowTimes = portfolioType === 'stocks'
    ? '3 PM - 11:59 PM CT'
    : '6 PM - 11:59 PM CT';

  if (isOpen) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 14px',
        background: 'rgba(0, 255, 136, 0.1)',
        border: `1px solid ${HOLO_COLORS.green}44`,
        borderRadius: '8px',
      }}>
        {/* Pulsing dot */}
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: HOLO_COLORS.green,
          boxShadow: GLOW_EFFECTS.green,
          animation: 'windowPulse 2s ease-in-out infinite',
        }} />

        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 700,
            color: HOLO_COLORS.green,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Free Agency Open
          </div>
          <div style={{
            fontSize: '11px',
            color: HOLO_COLORS.textSecondary,
            marginTop: '2px',
          }}>
            Closes in {formatTime(timeInfo?.hours || 0, timeInfo?.minutes || 0)}
          </div>
        </div>

        <style>{`
          @keyframes windowPulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.1); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 14px',
      background: 'rgba(255, 51, 102, 0.1)',
      border: `1px solid ${HOLO_COLORS.red}44`,
      borderRadius: '8px',
    }}>
      {/* Static dot */}
      <div style={{
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: HOLO_COLORS.red,
        opacity: 0.7,
      }} />

      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 700,
          color: HOLO_COLORS.red,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Free Agency Closed
        </div>
        <div style={{
          fontSize: '11px',
          color: HOLO_COLORS.textSecondary,
          marginTop: '2px',
        }}>
          Opens in {formatTime(timeInfo?.hours || 0, timeInfo?.minutes || 0)} ({windowTimes})
        </div>
      </div>
    </div>
  );
};

export default WindowStatus;
