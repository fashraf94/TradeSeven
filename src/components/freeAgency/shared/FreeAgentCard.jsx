import React from 'react';
import { HOLO_COLORS, CATEGORY_CONFIG } from '../../../constants/holoTheme';

/**
 * FreeAgentCard - Individual free agent card with mini chart
 *
 * Features:
 * - Category color indicator
 * - Symbol and name
 * - Mini sparkline visualization
 * - Info button for research modal
 * - "+ Add" button when selectable
 */
const FreeAgentCard = ({
  asset,
  onSelect,
  onMoreInfo,          // Callback for info button
  disabled = false,
  isSelectable = false,
}) => {
  const categoryConfig = CATEGORY_CONFIG[asset.category] || CATEGORY_CONFIG.steady;
  const priceChange = asset.priceChange || 0;
  const isPositive = priceChange >= 0;

  return (
    <div
      style={{
        width: '100%',
        padding: '14px 16px',
        minHeight: '60px',
        background: HOLO_COLORS.bgCard,
        border: `1px solid ${isSelectable ? categoryConfig.color + '66' : HOLO_COLORS.borderSubtle}`,
        borderRadius: '10px',
        opacity: disabled ? 0.4 : 1,
        transition: 'all 0.2s ease',
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
        gap: '10px',
        marginLeft: '8px',
      }}>
        {/* Asset Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
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
          flexShrink: 0,
        }}>
          <svg width="40" height="16" viewBox="0 0 40 16">
            <path
              d={isPositive
                ? "M0,12 Q10,10 20,6 T40,2"
                : "M0,2 Q10,6 20,10 T40,14"
              }
              fill="none"
              stroke={isPositive ? HOLO_COLORS.green : HOLO_COLORS.red}
              strokeWidth="2"
              opacity="0.8"
            />
          </svg>
        </div>

        {/* Action Buttons Container */}
        <div style={{
          display: 'flex',
          gap: '6px',
          flexShrink: 0,
        }}>
          {/* Info Button - Always visible when onMoreInfo provided */}
          {onMoreInfo && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoreInfo(asset);
              }}
              style={{
                padding: '8px 12px',
                background: `${HOLO_COLORS.cyan}15`,
                border: `1px solid ${HOLO_COLORS.cyan}44`,
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                color: HOLO_COLORS.cyan,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${HOLO_COLORS.cyan}30`;
                e.currentTarget.style.borderColor = `${HOLO_COLORS.cyan}88`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `${HOLO_COLORS.cyan}15`;
                e.currentTarget.style.borderColor = `${HOLO_COLORS.cyan}44`;
              }}
            >
              Info
            </button>
          )}

          {/* Add/Sign Button - Only when selectable */}
          {isSelectable && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!disabled) onSelect(asset);
              }}
              disabled={disabled}
              style={{
                padding: '8px 12px',
                background: `${HOLO_COLORS.green}22`,
                border: `1px solid ${HOLO_COLORS.green}66`,
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                color: HOLO_COLORS.green,
                textTransform: 'uppercase',
                cursor: disabled ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!disabled) {
                  e.currentTarget.style.background = `${HOLO_COLORS.green}35`;
                  e.currentTarget.style.borderColor = HOLO_COLORS.green;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `${HOLO_COLORS.green}22`;
                e.currentTarget.style.borderColor = `${HOLO_COLORS.green}66`;
              }}
            >
              + Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FreeAgentCard;
