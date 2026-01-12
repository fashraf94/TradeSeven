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
        padding: '14px 16px',
        minHeight: '60px',
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
          right: '12px',
          background: HOLO_COLORS.green,
          color: '#000',
          fontSize: '9px',
          fontWeight: 700,
          padding: '3px 10px',
          borderRadius: '0 0 6px 6px',
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
        width: '100%',
        marginLeft: '10px',
        gap: '12px',
      }}>
        {/* Asset Info - Constrained width */}
        <div style={{
          minWidth: '100px',
          maxWidth: '180px',
        }}>
          <div style={{
            fontSize: '15px',
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

        {/* Info Button - Right after the name */}
        {onMoreInfo && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoreInfo(asset);
            }}
            style={{
              padding: '6px 14px',
              background: `${HOLO_COLORS.cyan}18`,
              border: `1px solid ${HOLO_COLORS.cyan}50`,
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              color: HOLO_COLORS.cyan,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
          >
            Info
          </button>
        )}

        {/* Spacer - pushes selection indicator to right */}
        <div style={{ flex: 1 }} />

        {/* Selection indicator */}
        {!isSelected && !disabled && (
          <div style={{
            padding: '6px 12px',
            background: `${HOLO_COLORS.green}15`,
            border: `1px solid ${HOLO_COLORS.green}44`,
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            color: HOLO_COLORS.green,
            flexShrink: 0,
          }}>
            + Select
          </div>
        )}

        {/* Selected checkmark */}
        {isSelected && (
          <div style={{
            width: '28px',
            height: '28px',
            background: HOLO_COLORS.green,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3">
              <polyline points="20,6 9,17 4,12" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

export default FreeAgentCard;
