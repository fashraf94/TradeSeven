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
  asset,              // { symbol, name, category, priceChange }
  onSelect,
  disabled = false,
  isSelectable = false,  // Only selectable when a drop is chosen
}) => {
  const categoryConfig = CATEGORY_CONFIG[asset.category] || CATEGORY_CONFIG.steady;

  // Placeholder for price change (would come from API in real implementation)
  const priceChange = asset.priceChange || (Math.random() * 10 - 3); // Simulated for demo
  const isPositive = priceChange >= 0;

  return (
    <button
      onClick={() => isSelectable && !disabled && onSelect(asset)}
      disabled={disabled || !isSelectable}
      style={{
        width: '100%',
        padding: '12px',
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
      {/* Category indicator */}
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '14px',
            fontWeight: 700,
            color: HOLO_COLORS.textPrimary,
          }}>
            {asset.symbol}
          </div>
          <div style={{
            fontSize: '10px',
            color: HOLO_COLORS.textMuted,
            marginTop: '2px',
            maxWidth: '100px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {asset.name || asset.symbol}
          </div>
        </div>

        {/* Mini Sparkline */}
        <div style={{
          width: '50px',
          height: '24px',
          background: `linear-gradient(90deg, transparent, ${isPositive ? HOLO_COLORS.green : HOLO_COLORS.red}22)`,
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width="40" height="16" viewBox="0 0 40 16">
            <path
              d={isPositive
                ? "M0,12 Q10,10 20,8 T40,4"
                : "M0,4 Q10,6 20,8 T40,12"
              }
              fill="none"
              stroke={isPositive ? HOLO_COLORS.green : HOLO_COLORS.red}
              strokeWidth="1.5"
              opacity="0.8"
            />
          </svg>
        </div>

        {/* Price change or Add indicator */}
        {isSelectable ? (
          <div style={{
            padding: '6px 10px',
            background: `${HOLO_COLORS.green}22`,
            border: `1px solid ${HOLO_COLORS.green}66`,
            borderRadius: '6px',
            fontSize: '10px',
            fontWeight: 700,
            color: HOLO_COLORS.green,
            textTransform: 'uppercase',
          }}>
            + Add
          </div>
        ) : (
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: isPositive ? HOLO_COLORS.green : HOLO_COLORS.red,
            minWidth: '50px',
            textAlign: 'right',
          }}>
            {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
          </div>
        )}
      </div>
    </button>
  );
};

export default FreeAgentCard;
