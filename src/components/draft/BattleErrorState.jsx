import React from 'react';
import { HOLO_COLORS, GLOW_EFFECTS } from '../../constants/holoTheme';

/**
 * BattleErrorState - Error display for Draft Battle
 *
 * Shows when API calls fail or data is unavailable.
 * Provides retry and back navigation options.
 */
const BattleErrorState = ({
  message = 'Unable to load battle data',
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
      {/* Error icon */}
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
        <span style={{ fontSize: '36px' }}>⚠</span>
      </div>

      {/* Error message */}
      <h3 style={{
        color: HOLO_COLORS.textPrimary,
        fontSize: '18px',
        fontWeight: 600,
        marginBottom: '8px',
        margin: '0 0 8px 0',
      }}>
        Connection Lost
      </h3>
      <p style={{
        color: HOLO_COLORS.textSecondary,
        fontSize: '14px',
        marginBottom: '24px',
        maxWidth: '280px',
        margin: '0 0 24px 0',
        lineHeight: '1.5',
      }}>
        {message}
      </p>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '12px' }}>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: '12px 24px',
              background: 'rgba(0, 255, 255, 0.1)',
              border: `1px solid ${HOLO_COLORS.cyan}`,
              borderRadius: '8px',
              color: HOLO_COLORS.cyan,
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: '16px' }}>↻</span>
            Retry
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
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: '16px' }}>←</span>
            Back
          </button>
        )}
      </div>
    </div>
  );
};

export default BattleErrorState;
