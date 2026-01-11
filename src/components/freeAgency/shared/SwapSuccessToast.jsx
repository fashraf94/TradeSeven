import React, { useEffect } from 'react';
import { HOLO_COLORS, GLOW_EFFECTS } from '../../../constants/holoTheme';

/**
 * SwapSuccessToast - Animated success notification
 *
 * Features:
 * - Slide-in animation
 * - Auto-dismiss with timer
 * - Manual dismiss button
 * - Shows dropped/added assets
 */
const SwapSuccessToast = ({
  swapSuccess,
  onDismiss,
  autoDismissMs = 4000,
}) => {
  useEffect(() => {
    if (swapSuccess && autoDismissMs > 0 && onDismiss) {
      const timer = setTimeout(onDismiss, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [swapSuccess, autoDismissMs, onDismiss]);

  if (!swapSuccess) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '100px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 200,
      animation: 'successToastIn 0.4s ease-out',
    }}>
      <div style={{
        background: 'rgba(0, 255, 136, 0.15)',
        border: `1px solid ${HOLO_COLORS.green}`,
        borderRadius: '12px',
        padding: '16px 24px',
        boxShadow: `0 4px 30px rgba(0, 255, 136, 0.3), ${GLOW_EFFECTS.green}`,
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}>
        {/* Success Icon */}
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: HOLO_COLORS.green,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          color: '#000',
          fontWeight: 700,
          animation: 'successCheckPop 0.3s ease-out 0.2s both',
        }}>
          ✓
        </div>

        {/* Message */}
        <div>
          <div style={{
            fontSize: '14px',
            fontWeight: 700,
            color: HOLO_COLORS.textPrimary,
            marginBottom: '4px',
          }}>
            Swap Successful!
          </div>
          <div style={{
            fontSize: '12px',
            color: HOLO_COLORS.textSecondary,
          }}>
            <span style={{ color: HOLO_COLORS.red, fontWeight: 600 }}>
              {swapSuccess.dropped?.symbol}
            </span>
            {' → '}
            <span style={{ color: HOLO_COLORS.green, fontWeight: 600 }}>
              {swapSuccess.added?.symbol}
            </span>
          </div>
        </div>

        {/* Dismiss Button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              background: 'none',
              border: 'none',
              color: HOLO_COLORS.textMuted,
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px',
              marginLeft: '8px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>

      <style>{`
        @keyframes successToastIn {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px) scale(0.9);
          }
          100% {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }

        @keyframes successCheckPop {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default SwapSuccessToast;
