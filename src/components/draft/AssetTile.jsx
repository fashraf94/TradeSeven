import React from 'react';
import { HOLO_COLORS, CATEGORY_CONFIG } from '../../constants/holoTheme';

/**
 * AssetTile - Individual asset card for the 3x3 portfolio grid
 *
 * Displays asset symbol, gain percentage, and category color indicator.
 * In scout mode, shows comparison badges (THREAT, LINKED, RIVAL).
 */
const AssetTile = ({
  asset,              // { symbol, gain, lockedPrice, currentPrice, category }
  isScoutMode = false,
  comparisonData = null, // { isLinked, isThreat, isSectorRival, deltaVsYourBest }
  compact = false,
}) => {
  // Get category color (fallback to cyan if unknown)
  const categoryColor = CATEGORY_CONFIG[asset?.category]?.color || HOLO_COLORS.cyan;

  // Determine special highlighting for scout mode
  let borderColor = categoryColor;
  let glowEffect = 'none';
  let badge = null;

  if (isScoutMode && comparisonData) {
    if (comparisonData.isThreat) {
      borderColor = HOLO_COLORS.purple;
      glowEffect = `0 0 10px ${HOLO_COLORS.purple}66`;
      badge = { text: 'THREAT', color: HOLO_COLORS.purple, bg: 'rgba(139, 92, 246, 0.3)' };
    } else if (comparisonData.isLinked) {
      borderColor = HOLO_COLORS.cyan;
      badge = { text: 'LINKED', color: HOLO_COLORS.cyan, bg: 'rgba(0, 255, 255, 0.2)' };
    } else if (comparisonData.isSectorRival) {
      badge = { text: 'RIVAL', color: HOLO_COLORS.amber, bg: 'rgba(245, 158, 11, 0.3)' };
    }
  }

  const gainValue = typeof asset?.gain === 'number' ? asset.gain : 0;
  const isPositive = gainValue >= 0;

  if (!asset || !asset.symbol) {
    return (
      <div style={{
        background: HOLO_COLORS.bgCard,
        borderRadius: '8px',
        border: `1px dashed ${HOLO_COLORS.borderSubtle}`,
        minHeight: compact ? '50px' : '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ color: HOLO_COLORS.textMuted, fontSize: '10px' }}>-</span>
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative',
      background: HOLO_COLORS.bgCard,
      borderRadius: '8px',
      borderLeft: `3px solid ${borderColor}`,
      boxShadow: glowEffect,
      padding: compact ? '8px 10px' : '10px 12px',
      transition: 'all 0.2s ease',
      minHeight: compact ? '50px' : '60px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }}>
      {/* Badge for scout mode */}
      {badge && (
        <div style={{
          position: 'absolute',
          top: '-6px',
          right: '-6px',
          background: badge.bg,
          border: `1px solid ${badge.color}`,
          color: badge.color,
          fontSize: '7px',
          fontWeight: 700,
          padding: '2px 5px',
          borderRadius: '4px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          zIndex: 1,
        }}>
          {badge.text}
        </div>
      )}

      {/* Symbol */}
      <div style={{
        fontSize: compact ? '11px' : '13px',
        fontWeight: 600,
        color: HOLO_COLORS.textPrimary,
        marginBottom: '2px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span>{asset.symbol}</span>
        {/* Category letter indicator */}
        <span style={{
          fontSize: '8px',
          color: categoryColor,
          fontWeight: 700,
          opacity: 0.8,
        }}>
          {CATEGORY_CONFIG[asset.category]?.letter || ''}
        </span>
      </div>

      {/* Gain Percentage */}
      <div style={{
        fontSize: compact ? '12px' : '14px',
        fontWeight: 700,
        fontFamily: 'monospace',
        color: isPositive ? HOLO_COLORS.green : HOLO_COLORS.red,
      }}>
        {isPositive ? '+' : ''}{gainValue.toFixed(2)}%
      </div>

      {/* Category indicator dot */}
      <div style={{
        position: 'absolute',
        bottom: '6px',
        right: '6px',
        width: '5px',
        height: '5px',
        borderRadius: '50%',
        background: categoryColor,
        boxShadow: `0 0 4px ${categoryColor}`,
      }} />
    </div>
  );
};

export default AssetTile;
