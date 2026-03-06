import React, { useState } from 'react';
import { HOLO_COLORS, GLOW_EFFECTS } from '../../constants/holoTheme';

/**
 * HoloCard - Reusable card component with holographic theme variants
 *
 * A flexible card container that supports multiple visual styles consistent
 * with the FantasyTrades holographic design system.
 *
 * @param {string|Component} as - Element type to render ('div', 'button', etc.)
 * @param {string} variant - 'default' | 'elevated' | 'highlighted' | 'interactive'
 * @param {string} accentColor - 'cyan' | 'green' | 'amber' | 'red' | 'purple' | null
 * @param {string} size - 'sm' | 'md' | 'lg' (affects padding and border-radius)
 * @param {boolean} glow - Enable glow effect (requires accentColor)
 * @param {function} onClick - Click handler (automatically enables hover states)
 * @param {boolean} selected - For selected state styling
 * @param {boolean} disabled - Disabled state
 * @param {object} style - Additional inline styles
 * @param {string} className - Additional CSS class
 * @param {ReactNode} children - Card content
 */
const HoloCard = ({
  as: Component = 'div',
  variant = 'default',
  accentColor = null,
  size = 'md',
  glow = false,
  onClick,
  selected = false,
  disabled = false,
  style = {},
  className = '',
  children,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Size configurations
  const sizes = {
    sm: { padding: '8px 10px', borderRadius: '8px' },
    md: { padding: '12px 14px', borderRadius: '10px' },
    lg: { padding: '16px 20px', borderRadius: '16px' },
  };
  const sizeConfig = sizes[size] || sizes.md;

  // Get accent color value from HOLO_COLORS
  const getAccentValue = (color) => {
    if (!color) return null;
    return HOLO_COLORS[color] || color;
  };
  const accent = getAccentValue(accentColor);

  // Helper: convert hex to rgba
  const hexToRgba = (hex, alpha) => {
    if (!hex || !hex.startsWith('#')) return `rgba(128, 128, 128, ${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Background based on variant and state
  const getBackground = () => {
    if (selected && accent) {
      return hexToRgba(accent, 0.12);
    }
    if (variant === 'elevated') {
      return HOLO_COLORS.bgElevated;
    }
    return HOLO_COLORS.bgCard;
  };

  // Border based on variant and state
  const getBorder = () => {
    if (selected && accent) {
      return `2px solid ${accent}`;
    }
    if (variant === 'highlighted' && accent) {
      return `2px solid ${accent}`;
    }
    if (isHovered && variant === 'interactive' && accent) {
      return `1px solid ${hexToRgba(accent, 0.6)}`;
    }
    return `1px solid ${HOLO_COLORS.borderSubtle}`;
  };

  // Box shadow for glow and selected states
  const getBoxShadow = () => {
    if (glow && accent && GLOW_EFFECTS[accentColor]) {
      return GLOW_EFFECTS[accentColor];
    }
    if (glow && accent) {
      return `0 0 15px ${hexToRgba(accent, 0.4)}, 0 0 30px ${hexToRgba(accent, 0.2)}`;
    }
    if (selected && accent) {
      return `0 0 15px ${hexToRgba(accent, 0.3)}`;
    }
    if (isHovered && variant === 'interactive') {
      return accent
        ? `0 0 10px ${hexToRgba(accent, 0.2)}`
        : `0 4px 12px rgba(0, 0, 0, 0.3)`;
    }
    return 'none';
  };

  // Cursor style
  const getCursor = () => {
    if (disabled) return 'not-allowed';
    if (onClick || variant === 'interactive') return 'pointer';
    return 'default';
  };

  // Handle click
  const handleClick = (e) => {
    if (!disabled && onClick) {
      onClick(e);
    }
  };

  // Hover handlers for interactive variant
  const handleMouseEnter = () => {
    if (!disabled && (variant === 'interactive' || onClick)) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  // Build final styles
  const cardStyle = {
    background: getBackground(),
    border: getBorder(),
    borderRadius: sizeConfig.borderRadius,
    padding: sizeConfig.padding,
    boxShadow: getBoxShadow(),
    cursor: getCursor(),
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.2s ease',
    transform: isHovered && !disabled ? 'scale(1.01)' : 'scale(1)',
    boxSizing: 'border-box',
    ...style,
  };

  // Props for the component (button needs disabled prop)
  const componentProps = {
    className,
    style: cardStyle,
    onClick: handleClick,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  };

  // Add disabled prop for button elements
  if (Component === 'button') {
    componentProps.disabled = disabled;
  }

  return (
    <Component {...componentProps}>
      {children}
    </Component>
  );
};

export default HoloCard;
