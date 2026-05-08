// src/components/SignalDrop/components/ActionChip.jsx
//
// Sprint 6 Phase 3B — tappable suggested-action chip for the WatchlistChat
// dialogue. Three variants:
//   * primary       — teal accent, default for most suggestedActions
//   * secondary     — muted, for low-emphasis options like "skip"
//   * phase-advance — gold accent, signals "move to next phase" actions
//
// Tap target is 44px tall on mobile to satisfy minimum tap-target
// guidelines; desktop renders smaller (32px) for visual density.

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../../contexts/ThemeContext';
import { useIsMobile } from '../../../hooks/useIsMobile';

function variantPalette(variant, tokens) {
  switch (variant) {
    case 'phase-advance':
      return {
        idleBorder: `${tokens.medalGold}55`,
        hoverBorder: tokens.medalGold,
        idleBg: 'transparent',
        hoverBg: `${tokens.medalGold}14`,
        color: tokens.medalGold,
        weight: 700,
      };
    case 'secondary':
      return {
        idleBorder: tokens.borderInput,
        hoverBorder: tokens.textMuted,
        idleBg: 'transparent',
        hoverBg: tokens.bgIcon,
        color: tokens.textSecondary,
        weight: 600,
      };
    case 'primary':
    default:
      return {
        idleBorder: `${tokens.teal}59`,
        hoverBorder: tokens.teal,
        idleBg: 'transparent',
        hoverBg: `${tokens.teal}14`,
        color: tokens.teal,
        weight: 600,
      };
  }
}

export default function ActionChip({
  label,
  onClick,
  disabled = false,
  variant = 'primary',
}) {
  const { tokens } = useTheme();
  const { isDesktop } = useIsMobile();
  const [hovered, setHovered] = useState(false);
  const palette = variantPalette(variant, tokens);

  const minHeight = isDesktop ? 32 : 44;
  const padX = isDesktop ? 14 : 16;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18 }}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        if (!disabled && typeof onClick === 'function') onClick(label);
      }}
      disabled={disabled}
      style={{
        appearance: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight,
        padding: `0 ${padX}px`,
        borderRadius: 999,
        background: hovered && !disabled ? palette.hoverBg : palette.idleBg,
        border: `1px solid ${
          hovered && !disabled ? palette.hoverBorder : palette.idleBorder
        }`,
        color: palette.color,
        fontSize: 13,
        fontWeight: palette.weight,
        letterSpacing: '0.2px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'inherit',
        transition: 'background 0.15s ease, border-color 0.15s ease',
      }}
    >
      {label}
    </motion.button>
  );
}
