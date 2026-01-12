import React from 'react';
import { HOLO_COLORS, CATEGORY_CONFIG } from '../../../constants/holoTheme';

/**
 * FreeAgentCard - Individual free agent card with mini chart
 *
 * Features:
 * - Category color indicator
 * - Symbol and name
 * - Mini sparkline visualization
 * - "+ Add" indicator when selectable
 */
const FreeAgentCard = ({
  asset,
  onSelect,
  disabled = false,
  isSelectable = false,
}) => {
  const categoryConfig = CATEGORY_CONFIG[asset.category] || CATEGORY_CONFIG.steady;
  const priceChange = asset.priceChange || 0;
  const isPositive = priceChange >= 0;

  return (
    <button
      onClick={() => isSelectable && !disabled && onSelect(asset)}
      disabled={disabled || !isSelectable}
      style={{
        width: '100%',
        padding: '14px 16px',
        minHeight: '60px',
        background: HOLO_COLORS.bgCard,
        border: `1px solid ${isSelectable ? categoryConfig.color + '66' : HOLO_COLORS.borderSubtle}`,
        borderRadius: '10px',
        cursor: isSelectable && !disabled ? 'pointer' : 'default',
        opacity: disabled ? 0.4 : isSelectable ? 1 : 0.6,
        transition: 'all 0.2s ease',
        textAlign: 'left',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Category indicator - left edge */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '4px',
        background: categoryConfig.color,
      }} />

      {/* Content */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginLeft: '8px',
      }}>
        {/* Asset Info */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '15px',
            fontWeight: 700,
            color: HOLO_COLORS.textPrimary,
            marginBottom: '2px',
          }}>
            {asset.symbol}
          </div>
          <div style={{
            fontSize: '11px',
            color: HOLO_COLORS.textMuted,
            maxWidth: '120px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {asset.name || asset.symbol}
          </div>
        </div>

        {/* Mini Sparkline Placeholder */}
        <div style={{
          width: '60px',
          height: '28px',
          background: `linear-gradient(90deg, transparent, ${isPositive ? HOLO_COLORS.green : HOLO_COLORS.red}22)`,
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width="50" height="20" viewBox="0 0 50 20">
            <path
              d={isPositive
                ? "M0,15 Q12,12 25,8 T50,3"
                : "M0,3 Q12,8 25,12 T50,17"
              }
              fill="none"
              stroke={isPositive ? HOLO_COLORS.green : HOLO_COLORS.red}
              strokeWidth="2"
              opacity="0.8"
            />
          </svg>
        </div>

        {/* Add indicator when selectable */}
        {isSelectable && (
          <div style={{
            padding: '8px 12px',
            background: `${HOLO_COLORS.green}22`,
            border: `1px solid ${HOLO_COLORS.green}66`,
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 700,
            color: HOLO_COLORS.green,
            textTransform: 'uppercase',
          }}>
            + Add
          </div>
        )}
      </div>
    </button>
  );
};

export default FreeAgentCard;
