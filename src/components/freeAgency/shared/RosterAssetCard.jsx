import React from 'react';
import { HOLO_COLORS, CATEGORY_CONFIG } from '../../../constants/holoTheme';

/**
 * RosterAssetCard - Individual asset card in the "Select to Drop" section
 *
 * Displays user's portfolio asset with:
 * - Category color indicator
 * - Symbol and gain/loss percentage
 * - Selected state with red highlight and "DROP" badge
 */
const RosterAssetCard = ({
  asset,              // { symbol, category, gain }
  isSelected,         // Is this the asset selected to drop?
  onSelect,
  disabled = false,
  compact = false,
}) => {
  const categoryConfig = CATEGORY_CONFIG[asset.category] || CATEGORY_CONFIG.steady;
  const gain = asset.gain || 0;
  const isPositive = gain >= 0;

  return (
    <button
      onClick={() => !disabled && onSelect(asset)}
      disabled={disabled}
      style={{
        position: 'relative',
        width: compact ? '100px' : '110px',
        minWidth: compact ? '100px' : '110px',
        padding: compact ? '10px' : '12px',
        background: isSelected
          ? 'rgba(255, 51, 102, 0.15)'
          : HOLO_COLORS.bgCard,
        border: isSelected
          ? `2px solid ${HOLO_COLORS.red}`
          : `1px solid ${HOLO_COLORS.borderSubtle}`,
        borderRadius: '10px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s ease',
        textAlign: 'left',
        boxShadow: isSelected
          ? `0 0 15px ${HOLO_COLORS.red}44, inset 0 0 20px ${HOLO_COLORS.red}11`
          : 'none',
      }}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          top: '-8px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: HOLO_COLORS.red,
          color: '#000',
          fontSize: '8px',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: '4px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Drop
        </div>
      )}

      {/* Category indicator line */}
      <div style={{
        position: 'absolute',
        top: '8px',
        left: '8px',
        bottom: '8px',
        width: '3px',
        borderRadius: '2px',
        background: categoryConfig.color,
        boxShadow: `0 0 6px ${categoryConfig.color}66`,
      }} />

      {/* Content */}
      <div style={{ marginLeft: '10px' }}>
        {/* Symbol */}
        <div style={{
          fontSize: compact ? '13px' : '14px',
          fontWeight: 700,
          color: HOLO_COLORS.textPrimary,
          marginBottom: '4px',
        }}>
          {asset.symbol}
        </div>

        {/* Gain */}
        <div style={{
          fontSize: compact ? '11px' : '12px',
          fontWeight: 600,
          color: isPositive ? HOLO_COLORS.green : HOLO_COLORS.red,
        }}>
          {isPositive ? '+' : ''}{gain.toFixed(2)}%
        </div>

        {/* Category badge */}
        <div style={{
          fontSize: '9px',
          color: categoryConfig.color,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginTop: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: categoryConfig.color,
          }} />
          {categoryConfig.letter}
        </div>
      </div>
    </button>
  );
};

export default RosterAssetCard;
