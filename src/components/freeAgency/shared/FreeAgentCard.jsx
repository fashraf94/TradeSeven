import React from 'react';
import { HOLO_COLORS, CATEGORY_CONFIG } from '../../../constants/holoTheme';

/**
 * FreeAgentCard - Individual free agent card (now selectable)
 *
 * NEW FLOW: This is the first step. Tapping a card selects it.
 *
 * Features:
 * - Category color indicator
 * - Symbol and name
 * - Info button for research modal
 * - Selection state with green highlight
 * - "Adding" badge when selected
 */
const FreeAgentCard = ({
  asset,
  isSelected = false,  // Whether this agent is selected
  onSelect,
  onMoreInfo,
  disabled = false,
}) => {
  const categoryConfig = CATEGORY_CONFIG[asset.category] || CATEGORY_CONFIG.steady;

  return (
    <div
      onClick={() => !disabled && onSelect(asset)}
      style={{
        width: '100%',
        padding: '12px',
        paddingLeft: '16px',  // Extra space for category bar
        minHeight: '56px',
        background: isSelected
          ? 'rgba(0, 255, 136, 0.12)'
          : HOLO_COLORS.bgCard,
        border: isSelected
          ? `2px solid ${HOLO_COLORS.green}`
          : `1px solid ${HOLO_COLORS.borderSubtle}`,
        borderRadius: '10px',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        boxSizing: 'border-box',
        overflow: 'hidden',
        boxShadow: isSelected
          ? `0 0 15px ${HOLO_COLORS.green}44`
          : 'none',
      }}
    >
      {/* Selected Badge */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          top: '-1px',
          right: '10px',
          background: HOLO_COLORS.green,
          color: '#000',
          fontSize: '9px',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: '0 0 4px 4px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Adding
        </div>
      )}

      {/* Category indicator - left edge */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '4px',
        background: categoryConfig.color,
      }} />

      {/* Content Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
      }}>
        {/* Asset Info - Flexible, allows truncation */}
        <div style={{
          flex: '1 1 auto',
          minWidth: 0,  // Critical: allows text truncation
        }}>
          <div style={{
            fontSize: '14px',
            fontWeight: 700,
            color: isSelected ? HOLO_COLORS.green : HOLO_COLORS.textPrimary,
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

        {/* Buttons Container - Fixed, no shrink */}
        <div style={{
          display: 'flex',
          gap: '6px',
          flexShrink: 0,
        }}>
          {/* Info Button */}
          {onMoreInfo && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoreInfo(asset);
              }}
              style={{
                padding: '6px 10px',
                background: `${HOLO_COLORS.cyan}18`,
                border: `1px solid ${HOLO_COLORS.cyan}50`,
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                color: HOLO_COLORS.cyan,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Info
            </button>
          )}

          {/* Selection indicator */}
          {!isSelected && !disabled && (
            <div style={{
              padding: '6px 10px',
              background: `${HOLO_COLORS.green}15`,
              border: `1px solid ${HOLO_COLORS.green}44`,
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              color: HOLO_COLORS.green,
              whiteSpace: 'nowrap',
            }}>
              + Select
            </div>
          )}

          {/* Selected checkmark */}
          {isSelected && (
            <div style={{
              width: '26px',
              height: '26px',
              background: HOLO_COLORS.green,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3">
                <polyline points="20,6 9,17 4,12" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FreeAgentCard;
