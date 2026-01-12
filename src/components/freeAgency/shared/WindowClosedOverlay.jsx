import React from 'react';
import { HOLO_COLORS } from '../../../constants/holoTheme';

/**
 * WindowClosedOverlay - Full-screen overlay when trading window is closed
 *
 * Features:
 * - Countdown to window opening
 * - Trading hours display
 * - Back button
 */
const WindowClosedOverlay = ({
  timeInfo,
  portfolioType,
  onBack,
}) => {
  const windowTimes = portfolioType === 'stocks'
    ? '3:00 PM - 11:59 PM CT'
    : '6:00 PM - 11:59 PM CT';

  const formatTime = (hours, minutes) => {
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(10, 14, 20, 0.95)',
      backdropFilter: 'blur(8px)',
      zIndex: 60,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '400px',
      }}>
        {/* Lock Icon */}
        <div style={{
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          background: 'rgba(255, 51, 102, 0.1)',
          border: `2px solid ${HOLO_COLORS.red}44`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          fontSize: '48px',
        }}>
          🔒
        </div>

        {/* Title */}
        <h2 style={{
          color: HOLO_COLORS.textPrimary,
          fontSize: '24px',
          fontWeight: 700,
          marginBottom: '12px',
          margin: '0 0 12px 0',
        }}>
          Free Agency Closed
        </h2>

        {/* Subtitle */}
        <p style={{
          color: HOLO_COLORS.textSecondary,
          fontSize: '14px',
          marginBottom: '24px',
          lineHeight: 1.5,
          margin: '0 0 24px 0',
        }}>
          The swap window is currently closed. Come back during trading hours to make changes to your roster.
        </p>

        {/* Countdown */}
        <div style={{
          background: HOLO_COLORS.bgCard,
          border: `1px solid ${HOLO_COLORS.borderSubtle}`,
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
        }}>
          <div style={{
            fontSize: '12px',
            color: HOLO_COLORS.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '8px',
          }}>
            Opens In
          </div>
          <div style={{
            fontSize: '32px',
            fontWeight: 700,
            color: HOLO_COLORS.cyan,
            textShadow: `0 0 20px ${HOLO_COLORS.cyan}66`,
            fontFamily: 'monospace',
          }}>
            {formatTime(timeInfo?.hours || 0, timeInfo?.minutes || 0)}
          </div>
          <div style={{
            fontSize: '11px',
            color: HOLO_COLORS.textMuted,
            marginTop: '8px',
          }}>
            Trading window: {windowTimes}
          </div>
        </div>

        {/* Back Button */}
        <button
          onClick={onBack}
          style={{
            padding: '14px 32px',
            background: 'rgba(0, 255, 255, 0.1)',
            border: `1px solid ${HOLO_COLORS.cyan}`,
            borderRadius: '10px',
            color: HOLO_COLORS.cyan,
            fontWeight: 600,
            fontSize: '15px',
            cursor: 'pointer',
          }}
        >
          ← Back to Battle
        </button>
      </div>
    </div>
  );
};

export default WindowClosedOverlay;
