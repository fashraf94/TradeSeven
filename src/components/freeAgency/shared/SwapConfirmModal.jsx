import React from 'react';
import { HOLO_COLORS, GLOW_EFFECTS } from '../../../constants/holoTheme';

/**
 * SwapConfirmModal - Confirmation modal for swaps
 *
 * Features:
 * - Slide-up modal design
 * - Visual swap preview
 * - Warning about remaining swaps
 * - Loading state during swap
 */
const SwapConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  selectedDrop,
  selectedAdd,
  swapsRemaining,
  isSwapping,
}) => {
  if (!isOpen || !selectedDrop || !selectedAdd) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          animation: 'modalFadeIn 0.2s ease-out',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: HOLO_COLORS.bgCard,
        borderTop: `1px solid ${HOLO_COLORS.cyan}44`,
        borderRadius: '20px 20px 0 0',
        padding: '24px 20px',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        zIndex: 101,
        animation: 'modalSlideUp 0.3s ease-out',
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '20px',
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 700,
            color: HOLO_COLORS.textPrimary,
          }}>
            Confirm Swap
          </h3>
          <p style={{
            margin: '6px 0 0 0',
            fontSize: '12px',
            color: HOLO_COLORS.textMuted,
          }}>
            This action cannot be undone
          </p>
        </div>

        {/* Swap Visualization */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          marginBottom: '24px',
        }}>
          {/* Drop */}
          <div style={{
            flex: 1,
            maxWidth: '120px',
            padding: '16px',
            background: 'rgba(255, 51, 102, 0.1)',
            border: `1px solid ${HOLO_COLORS.red}66`,
            borderRadius: '12px',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '10px',
              color: HOLO_COLORS.red,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '8px',
            }}>
              Dropping
            </div>
            <div style={{
              fontSize: '20px',
              fontWeight: 700,
              color: HOLO_COLORS.textPrimary,
            }}>
              {selectedDrop.symbol}
            </div>
          </div>

          {/* Arrow */}
          <div style={{
            fontSize: '24px',
            color: HOLO_COLORS.green,
            textShadow: `0 0 10px ${HOLO_COLORS.green}`,
          }}>
            →
          </div>

          {/* Add */}
          <div style={{
            flex: 1,
            maxWidth: '120px',
            padding: '16px',
            background: 'rgba(0, 255, 136, 0.1)',
            border: `1px solid ${HOLO_COLORS.green}66`,
            borderRadius: '12px',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '10px',
              color: HOLO_COLORS.green,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '8px',
            }}>
              Adding
            </div>
            <div style={{
              fontSize: '20px',
              fontWeight: 700,
              color: HOLO_COLORS.textPrimary,
            }}>
              {selectedAdd.symbol}
            </div>
          </div>
        </div>

        {/* Warning */}
        <div style={{
          padding: '12px',
          background: 'rgba(245, 158, 11, 0.1)',
          border: `1px solid ${HOLO_COLORS.amber}44`,
          borderRadius: '8px',
          marginBottom: '20px',
        }}>
          <div style={{
            fontSize: '11px',
            color: HOLO_COLORS.amber,
            textAlign: 'center',
          }}>
            This will use 1 of your {swapsRemaining} remaining swaps today
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onClose}
            disabled={isSwapping}
            style={{
              flex: 1,
              padding: '14px',
              background: 'transparent',
              border: `1px solid ${HOLO_COLORS.borderSubtle}`,
              borderRadius: '10px',
              color: HOLO_COLORS.textSecondary,
              fontWeight: 600,
              fontSize: '14px',
              cursor: isSwapping ? 'not-allowed' : 'pointer',
              opacity: isSwapping ? 0.5 : 1,
            }}
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            disabled={isSwapping}
            style={{
              flex: 2,
              padding: '14px',
              background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.4) 0%, rgba(0, 255, 136, 0.2) 100%)',
              border: `1px solid ${HOLO_COLORS.green}`,
              boxShadow: GLOW_EFFECTS.green,
              borderRadius: '10px',
              color: HOLO_COLORS.textPrimary,
              fontWeight: 700,
              fontSize: '15px',
              cursor: isSwapping ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {isSwapping ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid transparent',
                  borderTop: `2px solid ${HOLO_COLORS.textPrimary}`,
                  borderRadius: '50%',
                  animation: 'confirmSpin 0.8s linear infinite',
                }} />
                Swapping...
              </>
            ) : (
              'Confirm Swap'
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes confirmSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default SwapConfirmModal;
