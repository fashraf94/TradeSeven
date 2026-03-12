import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SHOCKWAVE_CONFIG } from '../../utils/shockwaveUtils';

/**
 * HoloAssetCard - Holographic Asset Module Card
 *
 * A cyberpunk-styled card for displaying draft assets with sector-specific colors.
 * States:
 * - available: Sector-themed, interactive, with ACQUIRE button
 * - locked: Red-themed, dimmed, with diagonal "SYSTEM LOCKED" stripe
 *
 * Features:
 * - Sector-specific color theming
 * - Selection state with glow effect
 * - Pick confirmation animation with particles effect
 * - Separate "Get Info" button for research modal
 */

// Sector color definitions - matches App.jsx SECTOR_COLORS
const SECTOR_COLORS = {
  // Technology - Blue
  'Technology': { primary: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  'Information Technology': { primary: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  // Energy - Red/Orange
  'Energy': { primary: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)' },
  // Healthcare - Teal
  'Healthcare': { primary: '#14b8a6', glow: 'rgba(20, 184, 166, 0.4)' },
  'Health Care': { primary: '#14b8a6', glow: 'rgba(20, 184, 166, 0.4)' },
  // Financials - Green
  'Financials': { primary: '#22c55e', glow: 'rgba(34, 197, 94, 0.4)' },
  'Financial Services': { primary: '#22c55e', glow: 'rgba(34, 197, 94, 0.4)' },
  // Consumer Discretionary - Purple
  'Consumer Cyclical': { primary: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)' },
  'Consumer Discretionary': { primary: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)' },
  // Consumer Staples - Pink
  'Consumer Defensive': { primary: '#ec4899', glow: 'rgba(236, 72, 153, 0.4)' },
  'Consumer Staples': { primary: '#ec4899', glow: 'rgba(236, 72, 153, 0.4)' },
  // Industrials - Amber
  'Industrials': { primary: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' },
  // Materials - Orange
  'Basic Materials': { primary: '#f97316', glow: 'rgba(249, 115, 22, 0.4)' },
  'Materials': { primary: '#f97316', glow: 'rgba(249, 115, 22, 0.4)' },
  // Real Estate - Indigo
  'Real Estate': { primary: '#6366f1', glow: 'rgba(99, 102, 241, 0.4)' },
  // Utilities - Slate
  'Utilities': { primary: '#64748b', glow: 'rgba(100, 116, 139, 0.4)' },
  // Communication - Cyan
  'Communication Services': { primary: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)' },
  // Cryptocurrency - Gold
  'Cryptocurrency': { primary: '#fbbf24', glow: 'rgba(251, 191, 36, 0.4)' },
  'Crypto': { primary: '#fbbf24', glow: 'rgba(251, 191, 36, 0.4)' },
  // DeFi - Ethereum blue
  'DeFi': { primary: '#627eea', glow: 'rgba(98, 126, 234, 0.4)' },
  // Layer1 - Cyan
  'Layer1': { primary: '#00d9ff', glow: 'rgba(0, 217, 255, 0.4)' },
  // Default - Cyan (brand color)
  'default': { primary: '#00d9ff', glow: 'rgba(0, 217, 255, 0.4)' }
};

const HoloAssetCard = React.forwardRef(({
  symbol,
  name,
  price,
  change = 0,
  dataChange,
  volumeChange,
  sector,                    // NEW: Sector for color theming
  status = 'available',
  lockedBy,
  isSelected = false,        // NEW: Selection state
  onSelect,                  // NEW: Called when card body is clicked
  onGetInfo,                 // NEW: Called when "Get Info" button is clicked
  onAcquire,                 // Keep for backward compatibility
  category = 'neutral',
  disabled = false,
  compact = false,           // Phone-optimized compact mode
  shockwaveDelay = null,     // Shockwave ripple delay in seconds (null = inactive)
}, ref) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  const [flinchActive, setFlinchActive] = useState(false);

  // Shockwave card flinch — delayed trigger based on distance from epicenter
  useEffect(() => {
    if (shockwaveDelay == null) {
      setFlinchActive(false);
      return;
    }
    let resetTimer;
    const delayTimer = setTimeout(() => {
      setFlinchActive(true);
      resetTimer = setTimeout(() => setFlinchActive(false), 350);
    }, shockwaveDelay * 1000);
    return () => {
      clearTimeout(delayTimer);
      clearTimeout(resetTimer);
    };
  }, [shockwaveDelay]);

  // Flinch style — applied to root div in both compact and full-size modes
  const flinchStyle = flinchActive ? {
    transform: `scale(${SHOCKWAVE_CONFIG.flinchScale}) translateY(${SHOCKWAVE_CONFIG.flinchTranslateY}px)`,
    transition: 'transform 0.1s ease-in',
  } : {
    transform: 'scale(1) translateY(0)',
    transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
  };

  // Flinch glow — brief cyan edge glow during flinch
  const flinchGlow = flinchActive
    ? '0 0 12px rgba(0, 217, 255, 0.4), inset 0 0 8px rgba(0, 217, 255, 0.1)'
    : undefined;

  // Get sector colors
  const sectorColor = SECTOR_COLORS[sector] || SECTOR_COLORS.default;
  const accentColor = sectorColor.primary;
  const accentGlow = sectorColor.glow;

  // Category color for INFO button dot
  const categoryColor = category === 'neutral' ? '#00d9ff'
    : category === 'aggressive' ? '#f59e0b'
    : '#10b981';

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

  // Handle card body click for selection
  const handleCardClick = useCallback((e) => {
    if (status !== 'available' || disabled) return;
    // Don't trigger selection if clicking a button
    if (e.target.tagName === 'BUTTON') return;
    onSelect?.();
  }, [status, disabled, onSelect]);

  const isAvailable = status === 'available';
  const isLocked = status === 'locked';

  // Category configuration
  const categoryConfig = {
    neutral: { letter: 'N', color: '#10b981', label: 'Neutral' },
    aggressive: { letter: 'A', color: '#f59e0b', label: 'Aggressive' },
    defensive: { letter: 'D', color: '#3b82f6', label: 'Defensive' },
  };

  const catConfig = categoryConfig[category] || categoryConfig.neutral;

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

  // ========== COMPACT MODE RENDER (Phone <768px) ==========
  if (compact) {
    const compactBorder = isLocked
      ? '1px solid rgba(255, 51, 102, 0.4)'
      : isSelected
        ? `2px solid ${accentColor}`
        : `1px solid ${accentColor}50`;

    const compactShadow = isSelected
      ? `0 0 12px ${accentGlow}`
      : isLocked
        ? '0 0 8px rgba(255, 51, 102, 0.2)'
        : `0 0 6px ${accentGlow}`;

    return (
      <div
        ref={ref}
        className={`holo-asset-card-compact ${isSelected ? 'selected' : ''}`}
        onClick={handleCardClick}
        style={{
          position: 'relative',
          width: '100%',
          minWidth: '85px',
          maxWidth: '120px',
          background: isLocked
            ? 'rgba(20, 15, 20, 0.9)'
            : isSelected
              ? `${accentColor}15`
              : 'rgba(10, 20, 30, 0.9)',
          border: compactBorder,
          borderRadius: '8px',
          padding: '8px',
          opacity: isLocked ? 0.7 : 1,
          filter: isLocked ? 'saturate(0.5)' : 'none',
          boxShadow: flinchGlow ? `${compactShadow}, ${flinchGlow}` : compactShadow,
          cursor: isLocked || disabled ? 'not-allowed' : 'pointer',
          ...flinchStyle,
        }}
      >
        {/* Top Row: Category Badge + Status */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px',
        }}>
          {/* Category Badge */}
          <span style={{
            width: '18px',
            height: '18px',
            borderRadius: '4px',
            background: `${catConfig.color}25`,
            border: `1px solid ${catConfig.color}50`,
            color: catConfig.color,
            fontSize: '10px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {catConfig.letter}
          </span>

          {/* Status Badge */}
          <span style={{
            fontSize: '7px',
            fontWeight: '700',
            padding: '2px 4px',
            borderRadius: '3px',
            textTransform: 'uppercase',
            letterSpacing: '0.3px',
            background: isLocked ? 'rgba(255,51,102,0.2)' : `${accentColor}22`,
            color: isLocked ? '#ff3366' : accentColor,
          }}>
            {isLocked ? 'LOCKED' : 'AVAIL'}
          </span>
        </div>

        {/* Symbol */}
        <div style={{
          fontSize: '14px',
          fontWeight: '700',
          color: isLocked ? '#6e7681' : '#fff',
          marginBottom: '2px',
        }}>
          {symbol}
        </div>

        {/* Price */}
        <div style={{
          fontSize: '13px',
          fontWeight: '600',
          color: isLocked ? '#6e7681' : '#e6edf3',
          fontFamily: 'monospace',
        }}>
          {formatPrice(price)}
        </div>

        {/* Change */}
        <div style={{
          fontSize: '10px',
          fontWeight: '500',
          color: displayDataChange >= 0 ? '#00ff88' : '#ff4444',
          marginTop: '2px',
        }}>
          {formatChange(displayDataChange)}
        </div>

        {/* INFO Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation();
            onGetInfo?.();
          }}
          style={{
            width: '100%',
            marginTop: '6px',
            padding: '6px 8px',
            fontSize: '10px',
            fontWeight: '600',
            letterSpacing: '0.5px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '6px',
            color: '#8b949e',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 217, 255, 0.06)';
            e.currentTarget.style.borderColor = 'rgba(0, 217, 255, 0.25)';
            e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 217, 255, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: categoryColor,
            boxShadow: `0 0 6px ${categoryColor}80`,
          }} />
          INFO
        </motion.button>

        {/* Selection Indicator */}
        {isSelected && (
          <div style={{
            position: 'absolute',
            top: '-6px',
            right: '-6px',
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: accentColor,
            border: '2px solid #0a0e14',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 10px ${accentGlow}`,
          }}>
            <span style={{ color: '#000', fontSize: '10px', fontWeight: 'bold' }}>✓</span>
          </div>
        )}
      </div>
    );
  }

  // ========== FULL SIZE MODE RENDER (Desktop/Tablet) ==========

  // Determine border and shadow based on state
  const getBorderStyle = () => {
    if (isLocked) return '1px solid rgba(255, 51, 102, 0.4)';
    if (isPicking) return `2px solid ${accentColor}`;
    if (isSelected) return `2px solid ${accentColor}`;
    if (isHovered) return `1px solid ${accentColor}90`;
    return `1px solid ${accentColor}40`;
  };

  const getBoxShadow = () => {
    if (isLocked) return '0 0 15px rgba(255, 51, 102, 0.2)';
    if (isPicking) return `0 0 30px ${accentGlow}, 0 0 60px ${accentGlow}, inset 0 0 30px ${accentGlow}`;
    if (isSelected) return `0 0 20px ${accentGlow}, 0 0 40px ${accentGlow}`;
    if (isHovered) return `0 0 20px ${accentGlow}, 0 0 40px ${accentGlow}`;
    return `0 0 10px ${accentGlow}`;
  };

  // Merge flinch transform with existing hover/pick transforms
  const baseTransform = isPicking ? 'scale(1.05)' : isHovered && isAvailable ? 'translateY(-2px)' : 'none';
  const fullTransform = flinchActive
    ? `scale(${SHOCKWAVE_CONFIG.flinchScale}) translateY(${SHOCKWAVE_CONFIG.flinchTranslateY}px)`
    : baseTransform;
  const fullTransition = flinchActive
    ? 'transform 0.1s ease-in, box-shadow 0.1s ease-in'
    : shockwaveDelay != null
      ? 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease-out'
      : 'all 0.15s ease';
  const fullBoxShadow = flinchGlow ? `${getBoxShadow()}, ${flinchGlow}` : getBoxShadow();

  return (
    <div
      ref={ref}
      className={`holo-asset-card ${isAvailable ? 'holo-card-hover' : ''} ${isPicking ? 'pick-confirming' : ''} ${isSelected ? 'card-selected' : ''}`}
      onClick={handleCardClick}
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
            ? `${accentColor}20`
            : isSelected
              ? `${accentColor}15`
              : 'rgba(10, 20, 30, 0.9)',
        border: getBorderStyle(),
        borderRadius: '4px',
        clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%)',
        padding: '0',
        overflow: 'hidden',
        opacity: isLocked ? 0.85 : 1,
        filter: isLocked ? 'saturate(0.6)' : isPicking ? 'brightness(1.3)' : 'none',
        boxShadow: fullBoxShadow,
        transition: fullTransition,
        transform: fullTransform,
        cursor: isLocked || disabled || isPicking ? 'not-allowed' : 'pointer',
      }}
    >
      {/* Sector Color Accent Bar at Top */}
      <div
        style={{
          height: '3px',
          background: isLocked ? 'rgba(255, 51, 102, 0.6)' : accentColor,
          boxShadow: isLocked ? '0 0 10px rgba(255, 51, 102, 0.4)' : `0 0 10px ${accentGlow}`,
        }}
      />

      {/* Scanline Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            ${accentColor}05 2px,
            ${accentColor}05 4px
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
            : `linear-gradient(180deg, ${accentColor}15 0%, transparent 100%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Status Badge - Top */}
      <div
        style={{
          position: 'absolute',
          top: '11px',
          right: '8px',
          padding: '2px 8px',
          background: isLocked ? 'rgba(255, 51, 102, 0.9)' : `${accentColor}22`,
          color: isLocked ? '#fff' : accentColor,
          border: isLocked ? 'none' : `1px solid ${accentColor}44`,
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
          top: '11px',
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

      {/* Selection Indicator */}
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            top: '11px',
            left: '36px',
            width: '18px',
            height: '18px',
            background: accentColor,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            boxShadow: `0 0 10px ${accentGlow}`,
          }}
        >
          <span style={{ color: '#000', fontSize: '12px', fontWeight: 'bold' }}>✓</span>
        </div>
      )}

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
            textShadow: isLocked ? 'none' : `0 0 10px ${accentGlow}`,
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

        {/* Sector Badge */}
        {sector && (
          <div
            style={{
              fontSize: '9px',
              color: accentColor,
              background: `${accentColor}15`,
              border: `1px solid ${accentColor}30`,
              padding: '2px 6px',
              borderRadius: '3px',
              display: 'inline-block',
              marginBottom: '8px',
              letterSpacing: '0.5px',
            }}
          >
            {sector}
          </div>
        )}

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
                    ? accentColor
                    : 'var(--neon-red, #ff3366)',
                fontWeight: '600',
              }}
            >
              {formatChange(displayDataChange)}
            </span>
          </div>
          <div>
            <span style={{ color: '#6e7681' }}>Vol </span>
            <span
              style={{
                color: isLocked
                  ? '#6e7681'
                  : displayVolumeChange >= 0
                    ? accentColor
                    : 'var(--neon-red, #ff3366)',
                fontWeight: '600',
              }}
            >
              {formatChange(displayVolumeChange)}
            </span>
          </div>
        </div>

        {/* Action Button - GET INFO only (picking is done by clicking card + Command Deck confirmation) */}
        <div style={{ display: 'flex', gap: '6px', flexDirection: 'column' }}>
          {/* INFO Button - ALWAYS visible and clickable for ALL assets */}
          {onGetInfo && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                onGetInfo?.();
              }}
              style={{
                width: '100%',
                padding: '8px 14px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                color: '#8b949e',
                fontSize: '12px',
                fontWeight: '600',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 217, 255, 0.06)';
                e.currentTarget.style.borderColor = 'rgba(0, 217, 255, 0.25)';
                e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 217, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: categoryColor,
                boxShadow: `0 0 6px ${categoryColor}80`,
              }} />
              INFO
            </motion.button>
          )}

          {/* LOCKED indicator - shown below GET INFO for locked assets */}
          {isLocked && (
            <div
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(255, 51, 102, 0.1)',
                border: '1px solid rgba(255, 51, 102, 0.4)',
                borderRadius: '2px',
                clipPath: 'polygon(8px 0, 100% 0, 100% 100%, 0 100%, 0 8px)',
                color: 'var(--neon-red, #ff3366)',
                fontSize: '10px',
                fontWeight: '700',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                textAlign: 'center',
                opacity: 0.7,
              }}
            >
              LOCKED BY {lockedBy?.toUpperCase() || 'OPPONENT'}
            </div>
          )}
        </div>
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
            : `linear-gradient(135deg, transparent 50%, ${accentColor}4D 50%)`,
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
                background: accentColor,
                borderRadius: '50%',
                boxShadow: `0 0 6px ${accentColor}, 0 0 12px ${accentColor}`,
                animation: `particle-burst-${i % 4} 0.6s ease-out forwards`,
                opacity: 0,
              }}
            />
          ))}
        </div>
      )}

      {/* CSS Animations */}
      {/* Most animations consolidated in index.css: pick-confirm, particle-burst-0/1/2/3 */}
      {/* Dynamic card-select-pulse kept inline due to accentGlow variable */}
      <style>{`
        .pick-confirming {
          animation: pick-confirm 0.4s ease-out;
        }
        .card-selected {
          animation: card-select-pulse 2s ease-in-out infinite;
        }
        @keyframes card-select-pulse {
          0%, 100% { box-shadow: 0 0 20px ${accentGlow}, 0 0 40px ${accentGlow}; }
          50% { box-shadow: 0 0 25px ${accentGlow}, 0 0 50px ${accentGlow}; }
        }
      `}</style>
    </div>
  );
});

HoloAssetCard.displayName = 'HoloAssetCard';

export default HoloAssetCard;
