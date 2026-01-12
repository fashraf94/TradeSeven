import React from 'react';
import { HOLO_COLORS, GLOW_EFFECTS } from '../../../constants/holoTheme';

/**
 * FreeAgencyErrorState - Error display with retry/back options
 *
 * Features:
 * - Visual error indicator
 * - Custom error message
 * - Retry and back buttons
 */
const FreeAgencyErrorState = ({
  message = 'Unable to load free agency data',
  onRetry,
  onBack,
}) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      padding: '24px',
      textAlign: 'center',
    }}>
      {/* Error Icon */}
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: 'rgba(255, 51, 102, 0.1)',
        border: `2px solid ${HOLO_COLORS.red}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '20px',
        boxShadow: GLOW_EFFECTS.red,
      }}>
        <span style={{ fontSize: '36px' }}>⚠️</span>
      </div>

      {/* Error Title */}
      <h3 style={{
        color: HOLO_COLORS.textPrimary,
        fontSize: '18px',
        fontWeight: 600,
        marginBottom: '8px',
        margin: '0 0 8px 0',
      }}>
        Something Went Wrong
      </h3>

      {/* Error Message */}
      <p style={{
        color: HOLO_COLORS.textSecondary,
        fontSize: '14px',
        marginBottom: '24px',
        maxWidth: '300px',
        margin: '0 0 24px 0',
      }}>
        {message}
      </p>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px' }}>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: '12px 24px',
              background: 'rgba(139, 92, 246, 0.2)',
              border: `1px solid ${HOLO_COLORS.purple}`,
              borderRadius: '8px',
              color: HOLO_COLORS.purple,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ↻ Try Again
          </button>
        )}
        {onBack && (
          <button
            onClick={onBack}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              border: `1px solid ${HOLO_COLORS.borderSubtle}`,
              borderRadius: '8px',
              color: HOLO_COLORS.textSecondary,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ← Back to Battle
          </button>
        )}
      </div>
    </div>
  );
};

export default FreeAgencyErrorState;
