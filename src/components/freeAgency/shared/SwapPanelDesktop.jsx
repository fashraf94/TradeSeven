import React from 'react';
import { HOLO_COLORS, GLOW_EFFECTS } from '../../../constants/holoTheme';

/**
 * SwapPanelDesktop - Side panel showing swap preview for desktop
 *
 * NEW FLOW: Shows ADD → DROP (user selects free agent first)
 *
 * Features:
 * - Shows in left column (not fixed bottom bar)
 * - Visual ADD → DROP preview
 * - Confirm/Cancel buttons
 */
const SwapPanelDesktop = ({
  selectedAdd,       // First: the free agent to add
  selectedDrop,      // Second: the roster asset to drop
  onCancel,
  onConfirm,
  swapsRemaining,
  isSwapping,
}) => {
  const isComplete = selectedAdd && selectedDrop;

  return (
    <div style={{
      background: HOLO_COLORS.bgCard,
      border: `1px solid ${isComplete ? HOLO_COLORS.green + '66' : HOLO_COLORS.borderSubtle}`,
      borderRadius: '12px',
      padding: '20px',
      transition: 'all 0.3s ease',
    }}>
      {/* Header */}
      <div style={{
        fontSize: '12px',
        fontWeight: 700,
        color: HOLO_COLORS.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: '1px',
        marginBottom: '16px',
        textAlign: 'center',
      }}>
        {selectedAdd ? 'Pending Swap' : 'Select a Free Agent'}
      </div>

      {!selectedAdd ? (
        // Empty state
        <div style={{
          padding: '30px 20px',
          textAlign: 'center',
          color: HOLO_COLORS.textMuted,
          fontSize: '13px',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.5 }}>
            🔄
          </div>
          Select a free agent from the marketplace to begin a swap
        </div>
      ) : (
        <>
          {/* Swap Visualization: ADD → DROP */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            marginBottom: '20px',
          }}>
            {/* Add Asset - First */}
            <div style={{
              flex: 1,
              padding: '16px',
              background: 'rgba(0, 255, 136, 0.1)',
              border: `1px solid ${HOLO_COLORS.green}44`,
              borderRadius: '10px',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: '10px',
                color: HOLO_COLORS.green,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '6px',
              }}>
                Adding
              </div>
              <div style={{
                fontSize: '18px',
                fontWeight: 700,
                color: HOLO_COLORS.textPrimary,
              }}>
                {selectedAdd.symbol}
              </div>
            </div>

            {/* Arrow */}
            <div style={{
              fontSize: '24px',
              color: isComplete ? HOLO_COLORS.green : HOLO_COLORS.textMuted,
              textShadow: isComplete ? `0 0 10px ${HOLO_COLORS.green}` : 'none',
            }}>
              →
            </div>

            {/* Drop Asset - Second */}
            <div style={{
              flex: 1,
              padding: '16px',
              background: isComplete ? 'rgba(255, 51, 102, 0.1)' : HOLO_COLORS.bgElevated,
              border: `1px solid ${isComplete ? HOLO_COLORS.red + '44' : HOLO_COLORS.borderSubtle}`,
              borderRadius: '10px',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: '10px',
                color: isComplete ? HOLO_COLORS.red : HOLO_COLORS.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '6px',
              }}>
                Dropping
              </div>
              <div style={{
                fontSize: '18px',
                fontWeight: 700,
                color: isComplete ? HOLO_COLORS.textPrimary : HOLO_COLORS.textMuted,
              }}>
                {selectedDrop?.symbol || '?'}
              </div>
              {!isComplete && (
                <div style={{
                  fontSize: '11px',
                  color: HOLO_COLORS.textMuted,
                  marginTop: '4px',
                }}>
                  Select from roster
                </div>
              )}
              {isComplete && (
                <div style={{
                  fontSize: '11px',
                  color: (selectedDrop.gain || 0) >= 0 ? HOLO_COLORS.green : HOLO_COLORS.red,
                  marginTop: '4px',
                }}>
                  {(selectedDrop.gain || 0) >= 0 ? '+' : ''}{(selectedDrop.gain || 0).toFixed(2)}%
                </div>
              )}
            </div>
          </div>

          {/* Helper text when drop not selected */}
          {!isComplete && (
            <div style={{
              padding: '10px',
              background: `${HOLO_COLORS.amber}11`,
              border: `1px solid ${HOLO_COLORS.amber}33`,
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '11px',
              color: HOLO_COLORS.amber,
              textAlign: 'center',
            }}>
              ← Select a {selectedAdd.category} asset from your roster to drop
            </div>
          )}

          {/* Warning */}
          {isComplete && (
            <div style={{
              padding: '10px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: `1px solid ${HOLO_COLORS.amber}33`,
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '11px',
              color: HOLO_COLORS.amber,
              textAlign: 'center',
            }}>
              Swaps are permanent and cannot be undone
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onCancel}
              disabled={isSwapping}
              style={{
                flex: 1,
                padding: '12px',
                background: 'transparent',
                border: `1px solid ${HOLO_COLORS.borderSubtle}`,
                borderRadius: '8px',
                color: HOLO_COLORS.textSecondary,
                fontWeight: 600,
                fontSize: '13px',
                cursor: isSwapping ? 'not-allowed' : 'pointer',
                opacity: isSwapping ? 0.5 : 1,
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
                  : HOLO_COLORS.bgElevated,
                border: `1px solid ${isComplete ? HOLO_COLORS.green : HOLO_COLORS.borderSubtle}`,
                boxShadow: isComplete ? GLOW_EFFECTS.green : 'none',
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
                    borderTop: `2px solid ${HOLO_COLORS.textPrimary}`,
                    borderRadius: '50%',
                    animation: 'swapPanelSpin 0.8s linear infinite',
                  }} />
                  Swapping...
                </>
              ) : (
                `Confirm (${swapsRemaining} left)`
              )}
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes swapPanelSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SwapPanelDesktop;
