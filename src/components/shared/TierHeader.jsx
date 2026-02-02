// TierHeader - Section header for time-based groupings
// Used in lobby lists, portfolio tiers, and other tiered displays

import React from 'react';
import PropTypes from 'prop-types';
import { Clock, Flame, Calendar, CalendarDays, Star, Gem, BarChart3 } from 'lucide-react';
import { HOLO_COLORS } from '../../constants/holoTheme';

/**
 * Icon mapping for tier headers
 */
const TIER_ICONS = {
  // Time-based icons
  Flame,
  Clock,
  Calendar,
  CalendarDays,
  // Portfolio tier icons
  Star,
  Gem,
  BarChart3,
};

/**
 * Variant configurations for different use cases
 */
const VARIANT_CONFIG = {
  // Urgent/soon - amber styling
  urgent: {
    iconBg: 'rgba(245, 158, 11, 0.15)',
    iconBorder: 'rgba(245, 158, 11, 0.3)',
    labelColor: HOLO_COLORS.amber,
    countBg: 'rgba(245, 158, 11, 0.2)',
    countColor: HOLO_COLORS.amber,
  },
  // Warning - amber but less emphasis
  warning: {
    iconBg: 'rgba(245, 158, 11, 0.1)',
    iconBorder: 'rgba(245, 158, 11, 0.2)',
    labelColor: HOLO_COLORS.textPrimary,
    countBg: 'rgba(245, 158, 11, 0.15)',
    countColor: HOLO_COLORS.amber,
  },
  // Normal - default gray styling
  normal: {
    iconBg: HOLO_COLORS.bgElevated,
    iconBorder: HOLO_COLORS.borderSubtle,
    labelColor: HOLO_COLORS.textPrimary,
    countBg: HOLO_COLORS.bgElevated,
    countColor: HOLO_COLORS.textSecondary,
  },
  // Portfolio star tier - cyan
  star: {
    iconBg: 'rgba(0, 217, 255, 0.15)',
    iconBorder: 'rgba(0, 217, 255, 0.3)',
    labelColor: HOLO_COLORS.primary,
    countBg: 'rgba(0, 217, 255, 0.2)',
    countColor: HOLO_COLORS.primary,
  },
  // Portfolio core tier - purple
  core: {
    iconBg: 'rgba(139, 92, 246, 0.15)',
    iconBorder: 'rgba(139, 92, 246, 0.3)',
    labelColor: HOLO_COLORS.purple,
    countBg: 'rgba(139, 92, 246, 0.2)',
    countColor: HOLO_COLORS.purple,
  },
  // Portfolio support tier - green
  support: {
    iconBg: 'rgba(16, 185, 129, 0.15)',
    iconBorder: 'rgba(16, 185, 129, 0.3)',
    labelColor: HOLO_COLORS.greenMuted,
    countBg: 'rgba(16, 185, 129, 0.2)',
    countColor: HOLO_COLORS.greenMuted,
  },
};

/**
 * TierHeader - Visual section header for tiered groupings
 *
 * @param {Object} props
 * @param {string} props.icon - Icon name from TIER_ICONS ('Flame', 'Clock', 'Star', etc.)
 * @param {string} props.iconColor - Override icon color
 * @param {string} props.label - Main header text
 * @param {string} props.sublabel - Secondary text (optional)
 * @param {number} props.count - Item count badge (optional)
 * @param {'urgent'|'warning'|'normal'|'star'|'core'|'support'} props.variant - Styling variant
 * @param {Object} props.style - Additional inline styles
 */
export default function TierHeader({
  icon = 'Clock',
  iconColor,
  label,
  sublabel,
  count,
  variant = 'normal',
  style = {},
}) {
  const IconComponent = TIER_ICONS[icon] || Clock;
  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.normal;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '12px',
        marginTop: '8px',
        ...style,
      }}
    >
      {/* Icon container */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: config.iconBg,
          border: `1px solid ${config.iconBorder}`,
          flexShrink: 0,
        }}
      >
        <IconComponent
          size={16}
          color={iconColor || config.labelColor}
        />
      </div>

      {/* Label and sublabel */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: config.labelColor,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {label}
          </span>

          {/* Count badge */}
          {count !== undefined && count > 0 && (
            <span
              style={{
                backgroundColor: config.countBg,
                color: config.countColor,
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {count}
            </span>
          )}
        </div>

        {/* Sublabel */}
        {sublabel && (
          <div
            style={{
              fontSize: '11px',
              color: HOLO_COLORS.textMuted,
              marginTop: '2px',
            }}
          >
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}

TierHeader.propTypes = {
  icon: PropTypes.oneOf(Object.keys(TIER_ICONS)),
  iconColor: PropTypes.string,
  label: PropTypes.string.isRequired,
  sublabel: PropTypes.string,
  count: PropTypes.number,
  variant: PropTypes.oneOf(Object.keys(VARIANT_CONFIG)),
  style: PropTypes.object,
};

TierHeader.defaultProps = {
  icon: 'Clock',
  iconColor: undefined,
  sublabel: undefined,
  count: undefined,
  variant: 'normal',
  style: {},
};

// Export icon and variant configs for external use
export { TIER_ICONS, VARIANT_CONFIG };
