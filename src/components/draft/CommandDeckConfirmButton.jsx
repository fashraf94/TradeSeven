import React from 'react';

/**
 * CommandDeckConfirmButton - Confirm Pick Button for Command Deck
 *
 * Replaces the YOU panel with a prominent confirm button.
 * Features slanted shape matching War Room aesthetic.
 *
 * States:
 * - Disabled (not your turn): Gray, "WAITING FOR [PLAYER]..."
 * - Ready (your turn, no selection): Gray, "SELECT A STOCK"
 * - Active (your turn, asset selected): Green glow, "CONFIRM: [SYMBOL]"
 * - Loading: "CONFIRMING..."
 */

const CommandDeckConfirmButton = ({
  selectedAsset,
  onConfirm,
  isYourTurn,
  isLoading = false,
  currentPickerName = 'opponent',
}) => {
  const isDisabled = !selectedAsset || !isYourTurn || isLoading;
  const hasSelection = !!selectedAsset && isYourTurn;

  return (
    <button
      onClick={() => !isDisabled && onConfirm?.(selectedAsset)}
      disabled={isDisabled}
      className={hasSelection ? 'confirm-btn-ready' : ''}
      style={{
        // Slanted shape like the old YOU panel
        clipPath: 'polygon(20px 0, calc(100% - 20px) 0, 100% 100%, 0 100%)',

        background: isLoading
          ? 'linear-gradient(180deg, #00cc6a 0%, #009952 100%)'
          : hasSelection
            ? 'linear-gradient(180deg, #00ff88 0%, #00cc6a 100%)'
            : isYourTurn
              ? 'rgba(255, 255, 255, 0.15)'
              : 'rgba(255, 255, 255, 0.08)',

        color: hasSelection || isLoading ? '#0a0e14' : 'rgba(255, 255, 255, 0.5)',

        padding: '16px 48px',
        border: hasSelection
          ? '2px solid #00ff88'
          : isYourTurn
            ? '1px solid rgba(255, 255, 255, 0.2)'
            : '1px solid rgba(255, 255, 255, 0.1)',
        fontSize: '16px',
        fontWeight: '700',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',

        boxShadow: hasSelection
          ? '0 0 30px rgba(0, 255, 136, 0.5), 0 0 60px rgba(0, 255, 136, 0.25), inset 0 0 20px rgba(0, 255, 136, 0.1)'
          : 'none',

        minWidth: '220px',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.transform = 'scale(1.02)';
          if (hasSelection) {
            e.currentTarget.style.boxShadow = '0 0 40px rgba(0, 255, 136, 0.6), 0 0 80px rgba(0, 255, 136, 0.3), inset 0 0 25px rgba(0, 255, 136, 0.15)';
          }
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        if (hasSelection) {
          e.currentTarget.style.boxShadow = '0 0 30px rgba(0, 255, 136, 0.5), 0 0 60px rgba(0, 255, 136, 0.25), inset 0 0 20px rgba(0, 255, 136, 0.1)';
        }
      }}
    >
      {/* Scanline overlay for depth */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.03) 2px,
            rgba(0, 0, 0, 0.03) 4px
          )`,
          pointerEvents: 'none',
        }}
      />

      {/* Button content */}
      <span style={{ position: 'relative', zIndex: 1 }}>
        {isLoading ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <span className="confirm-spinner" style={{
              width: '14px',
              height: '14px',
              border: '2px solid rgba(10, 14, 20, 0.3)',
              borderTopColor: '#0a0e14',
              borderRadius: '50%',
              animation: 'confirm-spin 0.8s linear infinite',
            }} />
            CONFIRMING...
          </span>
        ) : !isYourTurn ? (
          <span style={{ fontSize: '13px' }}>
            WAITING FOR {currentPickerName.toUpperCase()}...
          </span>
        ) : selectedAsset ? (
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <span style={{ fontSize: '11px', opacity: 0.8 }}>CONFIRM PICK</span>
            <span style={{ fontSize: '18px', fontWeight: '800' }}>{selectedAsset.symbol}</span>
          </span>
        ) : (
          <span style={{ fontSize: '14px' }}>SELECT A STOCK</span>
        )}
      </span>

      {/* CSS Animations */}
      <style>{`
        @keyframes confirm-spin {
          to { transform: rotate(360deg); }
        }

        .confirm-btn-ready {
          animation: confirm-pulse 2s ease-in-out infinite;
        }

        @keyframes confirm-pulse {
          0%, 100% {
            box-shadow: 0 0 30px rgba(0, 255, 136, 0.5), 0 0 60px rgba(0, 255, 136, 0.25), inset 0 0 20px rgba(0, 255, 136, 0.1);
          }
          50% {
            box-shadow: 0 0 40px rgba(0, 255, 136, 0.6), 0 0 80px rgba(0, 255, 136, 0.35), inset 0 0 25px rgba(0, 255, 136, 0.15);
          }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .confirm-btn-ready,
          .confirm-spinner {
            animation: none !important;
          }
        }
      `}</style>
    </button>
  );
};

export default CommandDeckConfirmButton;
