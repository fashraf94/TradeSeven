import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { SHOCKWAVE_CONFIG } from '../../utils/shockwaveUtils';

/**
 * CommandDeckConfirmButton - "DRAFT NOW" Confirm Button for Command Deck
 *
 * Replaces the YOU panel with a prominent confirm button.
 * Features slanted shape matching War Room aesthetic.
 *
 * States:
 * - Disabled (not your turn): Gray, "WAITING FOR [PLAYER]..."
 * - Ready (your turn, no selection): Muted, "SELECT A STOCK"
 * - Active (your turn, asset selected): Pulsing green glow, "DRAFT NOW"
 * - Loading: "CONFIRMING..." spinner
 */

const CommandDeckConfirmButton = ({
  selectedAsset,
  onConfirm,
  onShockwave,
  isYourTurn,
  isLoading = false,
  currentPickerName = 'opponent',
}) => {
  const [particles, setParticles] = useState([]);
  const buttonRef = useRef(null);
  const recoilControls = useAnimationControls();

  const isDisabled = !selectedAsset || !isYourTurn || isLoading;
  const hasSelection = !!selectedAsset && isYourTurn;
  const isReady = hasSelection && !isLoading;

  const handleDraft = useCallback(() => {
    if (!selectedAsset || !isYourTurn || isLoading) return;

    // Enhanced haptic feedback — burst pattern, fails silently on desktop
    try { navigator.vibrate?.(SHOCKWAVE_CONFIG.hapticPattern); } catch {}

    // Button recoil: compress → spring back
    recoilControls.start({ scale: SHOCKWAVE_CONFIG.recoilScale, transition: { duration: SHOCKWAVE_CONFIG.recoilDuration, ease: 'easeIn' } })
      .then(() => recoilControls.start({ scale: 1, transition: { type: 'spring', ...SHOCKWAVE_CONFIG.recoilSpring } }));

    // Fire shockwave callback with button center coordinates
    if (onShockwave && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      onShockwave({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    }

    // Fire-and-forget particle burst
    const newParticles = Array.from({ length: 6 }, (_, i) => ({
      id: Date.now() + i,
      angle: (i / 6) * 360,
      distance: 40 + Math.random() * 30,
    }));
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 600);

    // Confirm immediately — no delay
    onConfirm?.(selectedAsset);
  }, [selectedAsset, isYourTurn, isLoading, onConfirm, onShockwave, recoilControls]);

  return (
    <div style={{ position: 'relative' }}>
      {/* Particle burst layer */}
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            animate={{
              opacity: 0,
              scale: 0.5,
              x: Math.cos((p.angle * Math.PI) / 180) * p.distance,
              y: Math.sin((p.angle * Math.PI) / 180) * p.distance,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 8px #10b981',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          />
        ))}
      </AnimatePresence>

      {/* Main button */}
      <motion.button
        ref={buttonRef}
        onClick={handleDraft}
        disabled={isDisabled}
        className={isReady ? 'confirm-btn-ready' : ''}
        whileHover={isReady ? { scale: 1.03 } : {}}
        whileTap={isReady ? { scale: 0.96 } : {}}
        animate={recoilControls}
        style={{
          // Slanted shape like the old YOU panel
          clipPath: 'polygon(20px 0, calc(100% - 20px) 0, 100% 100%, 0 100%)',

          background: isLoading
            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
            : isReady
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
              : isYourTurn
                ? 'rgba(255, 255, 255, 0.05)'
                : 'rgba(255, 255, 255, 0.03)',

          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',

          color: isReady || isLoading ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',

          padding: '16px 48px',
          border: isReady
            ? '2px solid rgba(16, 185, 129, 0.5)'
            : isYourTurn
              ? '1.5px solid rgba(255, 255, 255, 0.2)'
              : '1px solid rgba(255, 255, 255, 0.1)',
          fontSize: '16px',
          fontWeight: '700',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          cursor: isDisabled ? 'not-allowed' : 'pointer',

          minWidth: '220px',
          position: 'relative',
          overflow: 'hidden',
          width: '100%',
          animation: isReady ? 'confirmGlowPulse 2s ease-in-out infinite' : 'none',
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

        {/* Shimmer overlay (only when ready) */}
        {isReady && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '-200%',
              width: '200%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
              animation: 'commandDeckShimmer 3s infinite',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Button content */}
        <span style={{ position: 'relative', zIndex: 1 }}>
          {isLoading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <span
                className="confirm-spinner"
                style={{
                  width: '14px',
                  height: '14px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTopColor: '#ffffff',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              CONFIRMING...
            </span>
          ) : !isYourTurn ? (
            <span style={{ fontSize: '13px' }}>
              WAITING FOR {currentPickerName.toUpperCase()}...
            </span>
          ) : selectedAsset ? (
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <span style={{ fontSize: '11px', opacity: 0.8 }}>DRAFT NOW</span>
              <span style={{ fontSize: '18px', fontWeight: '800' }}>{selectedAsset.symbol}</span>
            </span>
          ) : (
            <span style={{ fontSize: '14px' }}>SELECT A STOCK</span>
          )}
        </span>

        {/* Animations */}
      </motion.button>

      {/* CSS for shimmer + glow pulse animations */}
      <style>{`
        @keyframes commandDeckShimmer {
          0% { transform: translateX(0); }
          100% { transform: translateX(100%); }
        }
        @keyframes confirmGlowPulse {
          0%, 100% { box-shadow: 0 0 15px rgba(16, 185, 129, 0.3); }
          50% { box-shadow: 0 0 25px rgba(16, 185, 129, 0.5); }
        }
      `}</style>
    </div>
  );
};

export default CommandDeckConfirmButton;
