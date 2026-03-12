import React from 'react';
import { HOLO_COLORS, CATEGORY_CONFIG } from '../../constants/holoTheme';

/**
 * CategoryBadge - Reusable category indicator component
 *
 * Displays asset category (steady/risky/defensive) in various visual styles.
 * Uses centralized CATEGORY_CONFIG from holoTheme.js for consistent colors.
 *
 * @param {string} category - 'neutral' | 'aggressive' | 'defensive'
 * @param {string} variant - 'dot' | 'letter' | 'full' | 'pill' (default: 'letter')
 * @param {string} size - 'sm' | 'md' | 'lg' (default: 'md')
 * @param {boolean} glow - Add glow effect to dot (default: false)
 * @param {object} style - Additional inline styles
 */
const CategoryBadge = ({
  category,
  variant = 'letter',
  size = 'md',
  glow = false,
  style = {},
}) => {
  // Get config or return null for invalid category
  const config = CATEGORY_CONFIG[category];
  if (!config) return null;

  // Size configurations
  const sizes = {
    sm: { dot: 4, font: 8, padding: '2px 6px', gap: 3 },
    md: { dot: 6, font: 10, padding: '4px 10px', gap: 4 },
    lg: { dot: 8, font: 12, padding: '6px 14px', gap: 6 },
  };
  const s = sizes[size] || sizes.md;

  // Common dot style
  const dotStyle = {
    width: `${s.dot}px`,
    height: `${s.dot}px`,
    borderRadius: '50%',
    background: config.color,
    flexShrink: 0,
    ...(glow && { boxShadow: `0 0 6px ${config.color}66` }),
  };

  // Variant: dot only
  if (variant === 'dot') {
    return <span style={{ ...dotStyle, display: 'inline-block', ...style }} />;
  }

  // Variant: letter (dot + letter)
  if (variant === 'letter') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: `${s.gap}px`,
          fontSize: `${s.font}px`,
          fontWeight: 700,
          color: config.color,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          ...style,
        }}
      >
        <span style={dotStyle} />
        {config.letter}
      </span>
    );
  }

  // Variant: full (dot + full label)
  if (variant === 'full') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: `${s.gap}px`,
          fontSize: `${s.font}px`,
          fontWeight: 600,
          color: config.color,
          ...style,
        }}
      >
        <span style={dotStyle} />
        {config.label}
      </span>
    );
  }

  // Variant: pill (background pill with label)
  if (variant === 'pill') {
    // Convert hex to rgba for background
    const hexToRgba = (hex, alpha) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    return (
      <span
        style={{
          display: 'inline-block',
          padding: s.padding,
          borderRadius: '6px',
          fontSize: `${s.font}px`,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          background: hexToRgba(config.color, 0.15),
          color: config.color,
          border: `1px solid ${hexToRgba(config.color, 0.3)}`,
          ...style,
        }}
      >
        {config.label}
      </span>
    );
  }

  // Fallback to letter variant
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${s.gap}px`,
        fontSize: `${s.font}px`,
        fontWeight: 700,
        color: config.color,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        ...style,
      }}
    >
      <span style={dotStyle} />
      {config.letter}
    </span>
  );
};

export default CategoryBadge;
