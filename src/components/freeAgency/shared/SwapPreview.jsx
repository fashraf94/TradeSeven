import React from 'react';
import { HOLO_COLORS } from '../../../constants/holoTheme';

/**
 * SwapPreview - Fixed bottom bar showing the pending swap
 *
 * NEW FLOW: Shows ADD → DROP (user selects free agent first)
 *
 * Features:
 * - Shows ADD → DROP flow visualization
 * - Cancel and Confirm buttons
 * - Slide-up animation
 * - Safe area padding for iPhone notches
 */
const SwapPreview = ({
  selectedAdd,         // First: the free agent to add
  selectedDrop,        // Second: the roster asset to drop
  onCancel,
  onConfirm,
  swapsRemaining,
  isSwapping,
}) => {
  // Only show if at least the free agent is selected
  if (!selectedAdd) return null;

  const isComplete = selectedAdd && selectedDrop;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'linear-gradient(to top, rgba(10, 14, 20, 0.98) 0%, rgba(10, 14, 20, 0.95) 100%)',
      backdropFilter: 'blur(16px)',
      borderTop: `1px solid ${isComplete ? HOLO_COLORS.green : HOLO_COLORS.cyan}`,
      padding: '12px 16px',
      paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      zIndex: 50,
      animation: 'swapSlideUp 0.3s ease-out',
    }}>
      {/* Swap Preview Row: ADD → DROP */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        marginBottom: '12px',
      }}>
        {/* Adding (Free Agent) - First */}
        <div style={{
          padding: '8px 14px',
          background: 'rgba(0, 255, 136, 0.15)',
          border: `1px solid ${HOLO_COLORS.green}66`,
          borderRadius: '8px',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: '9px',
            color: HOLO_COLORS.green,
            textTransform: 'uppercase',
            marginBottom: '2px',
          }}>
            Add
          </div>
          <div style={{
            fontSize: '14px',
            fontWeight: 700,
            color: HOLO_COLORS.textPrimary,
          }}>
            {selectedAdd.symbol}
          </div>
        </div>

        {/* Arrow */}
        <div style={{
          color: isComplete ? HOLO_COLORS.green : HOLO_COLORS.textMuted,
          fontSize: '20px',
        }}>
          →
        </div>

        {/* Dropping (Roster Asset) - Second */}
        <div style={{
          padding: '8px 14px',
          background: isComplete ? 'rgba(255, 51, 102, 0.15)' : HOLO_COLORS.bgCard,
          border: `1px solid ${isComplete ? HOLO_COLORS.red + '66' : HOLO_COLORS.borderSubtle}`,
          borderRadius: '8px',
          textAlign: 'center',
          minWidth: '80px',
        }}>
          <div style={{
            fontSize: '9px',
            color: isComplete ? HOLO_COLORS.red : HOLO_COLORS.textMuted,
            textTransform: 'uppercase',
            marginBottom: '2px',
          }}>
            Drop
          </div>
          <div style={{
            fontSize: '14px',
            fontWeight: 700,
            color: isComplete ? HOLO_COLORS.textPrimary : HOLO_COLORS.textMuted,
          }}>
            {selectedDrop?.symbol || '?'}
          </div>
        </div>
      </div>

      {/* Helper text when drop not selected */}
      {!isComplete && (
        <div style={{
          fontSize: '10px',
          color: HOLO_COLORS.amber,
          textAlign: 'center',
          marginBottom: '10px',
        }}>
          ↑ Select a {selectedAdd.category} asset above to drop
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: '12px',
            background: 'transparent',
            border: `1px solid ${HOLO_COLORS.borderSubtle}`,
            borderRadius: '8px',
            color: HOLO_COLORS.textSecondary,
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>

        <button
          onClick={onConfirm}
          disabled={!isComplete || isSwapping}
          style={{
            flex: 2,
            padding: '12px',
            background: isComplete
              ? 'linear-gradient(135deg, rgba(0, 255, 136, 0.3) 0%, rgba(0, 255, 136, 0.1) 100%)'
              : HOLO_COLORS.bgCard,
            border: `1px solid ${isComplete ? HOLO_COLORS.green : HOLO_COLORS.borderSubtle}`,
            boxShadow: isComplete ? `0 0 20px ${HOLO_COLORS.green}33` : 'none',
            borderRadius: '8px',
            color: isComplete ? HOLO_COLORS.textPrimary : HOLO_COLORS.textMuted,
            fontWeight: 700,
            fontSize: '14px',
            cursor: isComplete && !isSwapping ? 'pointer' : 'not-allowed',
            opacity: isComplete ? 1 : 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {isSwapping ? (
            <>
              <div style={{
                width: '14px',
                height: '14px',
                border: '2px solid transparent',
                borderTop: `2px solid ${HOLO_COLORS.green}`,
                borderRadius: '50%',
                animation: 'swapSpin 0.8s linear infinite',
              }} />
              Swapping...
            </>
          ) : (
            <>
              Confirm Swap ({swapsRemaining} left)
            </>
          )}
        </button>
      </div>

      <style>{`
        @keyframes swapSlideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes swapSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SwapPreview;
