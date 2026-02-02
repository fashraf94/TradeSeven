// StatusBadge - Reusable status indicator badge
// Used for expiration warnings, success states, info messages

import React from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { HOLO_COLORS } from '../../constants/holoTheme';

/**
 * Status configuration with colors and default icons
 */
const STATUS_CONFIG = {
  warning: {
    color: HOLO_COLORS.amber,
    bgColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    Icon: AlertTriangle,
    emoji: '⚠️',
  },
  urgent: {
    color: HOLO_COLORS.redMuted,
    bgColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    Icon: AlertCircle,
    emoji: '🔴',
  },
  success: {
    color: HOLO_COLORS.greenMuted,
    bgColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    Icon: CheckCircle,
    emoji: '✅',
  },
  info: {
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    Icon: Info,
    emoji: 'ℹ️',
  },
};

/**
 * StatusBadge - Visual indicator for various states
 *
 * @param {Object} props
 * @param {'warning'|'urgent'|'success'|'info'} props.status - Status type
 * @param {string} props.message - Text to display
 * @param {React.ReactNode} props.icon - Optional icon override (component or emoji string)
 * @param {'sm'|'md'} props.size - Badge size (default: 'sm')
 * @param {boolean} props.pulse - Enable pulse animation (default: false for warning, true for urgent)
 * @param {Object} props.style - Additional inline styles
 */
export default function StatusBadge({
  status = 'warning',
  message,
  icon,
  size = 'sm',
  pulse,
  style = {},
}) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.warning;
  const { color, bgColor, borderColor, Icon, emoji } = config;

  // Determine if pulse should be enabled
  const shouldPulse = pulse !== undefined ? pulse : status === 'urgent';

  // Size configurations
  const sizeConfig = {
    sm: {
      padding: '4px 8px',
      fontSize: '11px',
      iconSize: 12,
      gap: '4px',
    },
    md: {
      padding: '6px 12px',
      fontSize: '13px',
      iconSize: 14,
      gap: '6px',
    },
  };

  const sizes = sizeConfig[size] || sizeConfig.sm;

  // Render icon (can be component, emoji string, or default)
  const renderIcon = () => {
    if (icon === null) return null; // Explicitly no icon

    if (typeof icon === 'string') {
      return <span style={{ fontSize: sizes.iconSize }}>{icon}</span>;
    }

    if (React.isValidElement(icon)) {
      return icon;
    }

    // Default: use Lucide icon
    return <Icon size={sizes.iconSize} color={color} />;
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: sizes.gap,
        padding: sizes.padding,
        borderRadius: '6px',
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}`,
        animation: shouldPulse ? 'statusPulse 1.5s ease-in-out infinite' : 'none',
        ...style,
      }}
    >
      <style>{`
        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>

      {renderIcon()}

      {message && (
        <span
          style={{
            color,
            fontSize: sizes.fontSize,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {message}
        </span>
      )}
    </div>
  );
}

StatusBadge.propTypes = {
  status: PropTypes.oneOf(['warning', 'urgent', 'success', 'info']),
  message: PropTypes.string,
  icon: PropTypes.node,
  size: PropTypes.oneOf(['sm', 'md']),
  pulse: PropTypes.bool,
  style: PropTypes.object,
};

StatusBadge.defaultProps = {
  status: 'warning',
  message: '',
  icon: undefined,
  size: 'sm',
  pulse: undefined,
  style: {},
};

// Export status config for external use
export { STATUS_CONFIG };
