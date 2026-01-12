import React from 'react';
import { HOLO_COLORS } from '../../constants/holoTheme';

/**
 * GainLossBadge - Reusable percentage gain/loss display component
 *
 * Displays percentage values with appropriate color coding (green for positive,
 * red for negative). Uses centralized HOLO_COLORS for consistent styling.
 *
 * @param {number} value - The percentage value to display
 * @param {string} variant - 'text' | 'pill' | 'compact' (default: 'text')
 * @param {string} size - 'sm' | 'md' | 'lg' (default: 'md')
 * @param {boolean} showSign - Show +/- prefix (default: true)
 * @param {number} decimals - Decimal places (default: 2)
 * @param {boolean} showPercent - Show % suffix (default: true)
 * @param {object} style - Additional inline styles
 */
const GainLossBadge = ({
  value,
  variant = 'text',
  size = 'md',
  showSign = true,
  decimals = 2,
  showPercent = true,
  style = {},
}) => {
  // Handle invalid values
  if (value === null || value === undefined || isNaN(value)) {
    return (
      <span style={{ color: HOLO_COLORS.textMuted, ...style }}>
        —
      </span>
    );
  }

  const numValue = Number(value);
  const isPositive = numValue >= 0;
  const color = isPositive ? HOLO_COLORS.green : HOLO_COLORS.red;

  // Format the value
  const formattedValue = Math.abs(numValue).toFixed(decimals);
  const sign = showSign ? (isPositive ? '+' : '-') : (isPositive ? '' : '-');
  const percent = showPercent ? '%' : '';
  const displayText = `${sign}${formattedValue}${percent}`;

  // Size configurations
  const sizes = {
    sm: { font: 11, padding: '2px 6px' },
    md: { font: 12, padding: '4px 10px' },
    lg: { font: 14, padding: '6px 14px' },
  };
  const s = sizes[size] || sizes.md;

  // Variant: text (simple colored text)
  if (variant === 'text') {
    return (
      <span
        style={{
          fontSize: `${s.font}px`,
          fontWeight: 600,
          color: color,
          ...style,
        }}
      >
        {displayText}
      </span>
    );
  }

  // Variant: compact (bold colored text, typically used inline)
  if (variant === 'compact') {
    return (
      <span
        style={{
          fontSize: `${s.font}px`,
          fontWeight: 700,
          color: color,
          fontFamily: 'monospace',
          ...style,
        }}
      >
        {displayText}
      </span>
    );
  }

  // Variant: pill (background pill with colored text)
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
          borderRadius: '20px',
          fontSize: `${s.font}px`,
          fontWeight: 600,
          background: hexToRgba(color, 0.15),
          color: color,
          ...style,
        }}
      >
        {displayText}
      </span>
    );
  }

  // Fallback to text variant
  return (
    <span
      style={{
        fontSize: `${s.font}px`,
        fontWeight: 600,
        color: color,
        ...style,
      }}
    >
      {displayText}
    </span>
  );
};

export default GainLossBadge;
