import React, { useState, useCallback } from 'react';

/**
 * HoloAssetCard - Holographic Asset Module Card
 *
 * A cyberpunk-styled card for displaying draft assets with two states:
 * - available: Cyan-themed, interactive, with ACQUIRE button
 * - locked: Red-themed, dimmed, with diagonal "SYSTEM LOCKED" stripe
 *
 * Features pick confirmation animation with particles effect.
 */

const HoloAssetCard = ({
  symbol,
  name,
  price,
  change = 0,
  dataChange,
  volumeChange,
  status = 'available',
  lockedBy,
  onAcquire,
  category = 'steady',
  disabled = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [showParticles, setShowParticles] = useState(false);

  // Handle pick with animation
  const handleAcquire = useCallback(() => {
    if (isPicking) return;

    setIsPicking(true);
    setShowParticles(true);

    // Trigger actual pick after animation starts
    setTimeout(() => {
      onAcquire?.();
    }, 150);

    // Clean up animation states
    setTimeout(() => {
      setShowParticles(false);
      setIsPicking(false);
    }, 600);
  }, [onAcquire, isPicking]);

  const isAvailable = status === 'available';
  const isLocked = status === 'locked';

  // Category configuration
  const categoryConfig = {
    steady: { letter: 'S', color: '#10b981', label: 'Steady' },
    risky: { letter: 'R', color: '#f59e0b', label: 'Risky' },
    defensive: { letter: 'D', color: '#3b82f6', label: 'Defensive' },
  };

  const catConfig = categoryConfig[category] || categoryConfig.steady;

  // Format price
  const formatPrice = (p) => {
    if (p === undefined || p === null) return '$0.00';
    return `$${p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format percentage change
  const formatChange = (val) => {
    if (val === undefined || val === null) return '+0.0%';
    const prefix = val >= 0 ? '+' : '';
    return `${prefix}${val.toFixed(1)}%`;
  };

  // Use provided data/volume changes or fallback to price change
  const displayDataChange = dataChange !== undefined ? dataChange : change;
  const displayVolumeChange = volumeChange !== undefined ? volumeChange : change;

  return (
    <div
      className={`holo-asset-card ${isAvailable ? 'holo-card-hover' : ''} ${isPicking ? 'pick-confirming' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      style={{
        position: 'relative',
        width: '100%',
        minWidth: '140px',
        maxWidth: '180px',
        background: isLocked
          ? 'rgba(20, 15, 20, 0.9)'
          : isPicking
            ? 'rgba(0, 255, 255, 0.15)'
            : 'rgba(10, 20, 30, 0.9)',
        border: isLocked
          ? '1px solid rgba(255, 51, 102, 0.4)'
          : isPicking
            ? '1px solid rgba(0, 255, 255, 0.9)'
            : isHovered
              ? '1px solid rgba(0, 255, 255, 0.6)'
              : '1px solid rgba(0, 255, 255, 0.3)',
        borderRadius: '4px',
        clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%)',
        padding: '0',
        overflow: 'hidden',
        opacity: isLocked ? 0.85 : 1,
        filter: isLocked ? 'saturate(0.6)' : isPicking ? 'brightness(1.3)' : 'none',
        boxShadow: isLocked
          ? '0 0 15px rgba(255, 51, 102, 0.2)'
          : isPicking
            ? '0 0 30px rgba(0, 255, 255, 0.8), 0 0 60px rgba(0, 255, 255, 0.4), inset 0 0 30px rgba(0, 255, 255, 0.2)'
            : isHovered
              ? '0 0 20px rgba(0, 255, 255, 0.4), 0 0 40px rgba(0, 255, 255, 0.2)'
              : '0 0 15px rgba(0, 255, 255, 0.15)',
        transition: 'all 0.15s ease',
        transform: isPicking ? 'scale(1.05)' : isHovered && isAvailable ? 'translateY(-2px)' : 'none',
        cursor: isLocked || disabled || isPicking ? 'not-allowed' : 'pointer',
      }}
    >
      {/* Scanline Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 255, 255, 0.02) 2px,
            rgba(0, 255, 255, 0.02) 4px
          )`,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Inner glow/reflection effect */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '60px',
          background: isLocked
            ? 'linear-gradient(180deg, rgba(255, 51, 102, 0.08) 0%, transparent 100%)'
            : 'linear-gradient(180deg, rgba(0, 255, 255, 0.08) 0%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Status Badge - Top */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          padding: '2px 8px',
          background: isLocked ? 'rgba(255, 51, 102, 0.9)' : 'rgba(0, 255, 255, 0.9)',
          color: '#000',
          fontSize: '9px',
          fontWeight: '700',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          borderRadius: '2px',
          zIndex: 2,
        }}
      >
        {isLocked ? 'Locked' : 'Available'}
      </div>

      {/* Category Badge - Top Left */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          width: '22px',
          height: '22px',
          background: `${catConfig.color}25`,
          border: `1px solid ${catConfig.color}60`,
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          fontWeight: '700',
          color: catConfig.color,
          zIndex: 2,
        }}
        title={catConfig.label}
      >
        {catConfig.letter}
      </div>

      {/* Card Content */}
      <div style={{ padding: '16px 12px', paddingTop: '36px', position: 'relative', zIndex: 2 }}>
        {/* Symbol */}
        <div
          style={{
            fontSize: '20px',
            fontWeight: '800',
            color: isLocked ? '#8b949e' : '#ffffff',
            letterSpacing: '0.5px',
            marginBottom: '2px',
            textShadow: isLocked ? 'none' : '0 0 10px rgba(255, 255, 255, 0.3)',
          }}
        >
          {symbol}
        </div>

        {/* Company Name */}
        <div
          style={{
            fontSize: '11px',
            color: '#6e7681',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: '12px',
          }}
        >
          {name}
        </div>

        {/* Price */}
        <div
          style={{
            fontSize: '18px',
            fontWeight: '700',
            color: isLocked ? '#6e7681' : '#ffffff',
            marginBottom: '10px',
            fontFamily: "'SF Mono', 'Monaco', monospace",
          }}
        >
          {formatPrice(price)}
        </div>

        {/* Data & Volume Stats */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '10px',
            marginBottom: '14px',
          }}
        >
          <div>
            <span style={{ color: '#6e7681' }}>Data </span>
            <span
              style={{
                color: isLocked
                  ? '#6e7681'
                  : displayDataChange >= 0
                    ? 'var(--neon-cyan, #00ffff)'
                    : 'var(--neon-red, #ff3366)',
                fontWeight: '600',
              }}
            >
              {formatChange(displayDataChange)}
            </span>
          </div>
          <div>
            <span style={{ color: '#6e7681' }}>Volume </span>
            <span
              style={{
                color: isLocked
                  ? '#6e7681'
                  : displayVolumeChange >= 0
                    ? 'var(--neon-cyan, #00ffff)'
                    : 'var(--neon-red, #ff3366)',
                fontWeight: '600',
              }}
            >
              {formatChange(displayVolumeChange)}
            </span>
          </div>
        </div>

        {/* ACQUIRE Button (Available state) */}
        {isAvailable && !disabled && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAcquire();
            }}
            onMouseDown={() => setIsPressed(true)}
            onMouseUp={() => setIsPressed(false)}
            onMouseLeave={() => setIsPressed(false)}
            disabled={isPicking}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: isPicking
                ? 'linear-gradient(180deg, rgba(0, 255, 255, 0.6) 0%, rgba(0, 255, 255, 0.4) 100%)'
                : isPressed
                  ? 'linear-gradient(180deg, rgba(0, 255, 255, 0.4) 0%, rgba(0, 255, 255, 0.25) 100%)'
                  : isHovered
                    ? 'linear-gradient(180deg, rgba(0, 255, 255, 0.3) 0%, rgba(0, 255, 255, 0.15) 100%)'
                    : 'linear-gradient(180deg, rgba(0, 255, 255, 0.2) 0%, rgba(0, 255, 255, 0.1) 100%)',
              border: '1px solid var(--neon-cyan, #00ffff)',
              borderRadius: '2px',
              clipPath: 'polygon(8px 0, 100% 0, 100% 100%, 0 100%, 0 8px)',
              color: 'var(--neon-cyan, #00ffff)',
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              cursor: isPicking ? 'wait' : 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: isPicking
                ? '0 0 20px rgba(0, 255, 255, 0.6), inset 0 0 30px rgba(0, 255, 255, 0.2)'
                : isHovered
                  ? '0 0 15px rgba(0, 255, 255, 0.4), inset 0 0 20px rgba(0, 255, 255, 0.1)'
                  : 'inset 0 0 15px rgba(0, 255, 255, 0.05)',
              transform: isPressed ? 'scale(0.98)' : 'none',
            }}
          >
            {isPicking ? 'ACQUIRING...' : 'ACQUIRE'}
          </button>
        )}

        {/* LOCKED Button (Locked state) */}
        {isLocked && (
          <div
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'rgba(255, 51, 102, 0.1)',
              border: '1px solid rgba(255, 51, 102, 0.4)',
              borderRadius: '2px',
              clipPath: 'polygon(8px 0, 100% 0, 100% 100%, 0 100%, 0 8px)',
              color: 'var(--neon-red, #ff3366)',
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              textAlign: 'center',
              opacity: 0.7,
            }}
          >
            LOCKED
          </div>
        )}
      </div>

      {/* LOCKED Diagonal Stripe Overlay */}
      {isLocked && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {/* Hazard stripe background */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-35deg)',
              width: '200%',
              padding: '6px 0',
              background: `repeating-linear-gradient(
                90deg,
                rgba(255, 51, 102, 0.85) 0px,
                rgba(255, 51, 102, 0.85) 10px,
                rgba(180, 30, 70, 0.85) 10px,
                rgba(180, 30, 70, 0.85) 20px
              )`,
              borderTop: '2px solid #ff3366',
              borderBottom: '2px solid #ff3366',
              boxShadow: '0 0 20px rgba(255, 51, 102, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                color: '#ffffff',
                fontSize: '9px',
                fontWeight: '800',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                padding: '0 20px',
              }}
            >
              SYSTEM LOCKED BY {lockedBy?.toUpperCase() || 'OPPONENT'}
            </div>
          </div>
        </div>
      )}

      {/* Corner accent (bottom-right cut visualization) */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: '16px',
          height: '16px',
          background: isLocked
            ? 'linear-gradient(135deg, transparent 50%, rgba(255, 51, 102, 0.3) 50%)'
            : 'linear-gradient(135deg, transparent 50%, rgba(0, 255, 255, 0.3) 50%)',
          pointerEvents: 'none',
        }}
      />

      {/* Particles Effect on Pick */}
      {showParticles && (
        <div className="pick-particles" style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 20,
          overflow: 'visible',
        }}>
          {/* Burst particles */}
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="particle"
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: '4px',
                height: '4px',
                background: '#00ffff',
                borderRadius: '50%',
                boxShadow: '0 0 6px #00ffff, 0 0 12px #00ffff',
                animation: `particle-burst-${i % 4} 0.6s ease-out forwards`,
                opacity: 0,
              }}
            />
          ))}
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        .pick-confirming {
          animation: pick-confirm 0.4s ease-out;
        }

        @keyframes pick-confirm {
          0% { transform: scale(1); filter: brightness(1); }
          30% { transform: scale(1.08); filter: brightness(1.5); }
          60% { transform: scale(1.03); filter: brightness(1.2); }
          100% { transform: scale(1.05); filter: brightness(1.3); }
        }

        @keyframes particle-burst-0 {
          0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(calc(-50% + 40px), calc(-50% - 30px)) scale(0.5); }
        }
        @keyframes particle-burst-1 {
          0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(calc(-50% - 35px), calc(-50% - 25px)) scale(0.5); }
        }
        @keyframes particle-burst-2 {
          0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(calc(-50% + 45px), calc(-50% + 20px)) scale(0.5); }
        }
        @keyframes particle-burst-3 {
          0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(calc(-50% - 40px), calc(-50% + 25px)) scale(0.5); }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .pick-confirming,
          .particle {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default HoloAssetCard;
