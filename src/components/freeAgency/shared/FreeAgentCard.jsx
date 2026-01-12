import React from 'react';
import { HOLO_COLORS, CATEGORY_CONFIG } from '../../../constants/holoTheme';

/**
 * FreeAgentCard - Individual free agent card
 *
 * Features:
 * - Category color indicator
 * - Symbol and name
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

      {/* Content Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        marginLeft: '10px',
        gap: '12px',
      }}>
        {/* Asset Info - Constrained width, not flex */}
        <div style={{
          minWidth: '100px',
          maxWidth: '180px',
        }}>
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

        {/* Spacer - pushes Add button to right */}
        <div style={{ flex: 1 }} />

        {/* Add Button - Far right, only when selectable */}
        {isSelectable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) onSelect(asset);
            }}
            disabled={disabled}
            style={{
              padding: '6px 14px',
              background: `${HOLO_COLORS.green}22`,
              border: `1px solid ${HOLO_COLORS.green}66`,
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              color: HOLO_COLORS.green,
              textTransform: 'uppercase',
              cursor: disabled ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            + Add
          </button>
        )}
      </div>
    </div>
  );
};

export default FreeAgentCard;
