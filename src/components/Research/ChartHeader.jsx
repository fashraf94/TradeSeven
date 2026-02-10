import React from 'react';
import { HOLO_COLORS, CATEGORY_CONFIG, getSectorColor } from '../../constants/holoTheme';

/**
 * ChartHeader - Compact 56px header bar for the redesigned research modal.
 * Replaces the giant hero block with a space-efficient layout.
 */
const ChartHeader = ({ asset, sector, category, onClose }) => {
  if (!asset) return null;

  const sectorColor = getSectorColor(sector);
  const priceChange = asset.percentChange || asset.change || 0;
  const isPositive = priceChange >= 0;
  const catConfig = category ? CATEGORY_CONFIG[category] : null;

  return (
    <div style={{
      height: '52px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      background: HOLO_COLORS.bgCard,
      borderBottom: '1px solid rgba(0, 217, 255, 0.1)',
      flexShrink: 0,
    }}>
      {/* Left: Symbol + Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
        <span style={{
          fontSize: '16px',
          fontWeight: '800',
          color: HOLO_COLORS.textPrimary,
          letterSpacing: '0.5px',
        }}>
          {asset.symbol}
        </span>

        <span style={{
          fontSize: '14px',
          color: HOLO_COLORS.textSecondary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {asset.name}
        </span>

        {/* Category pill */}
        {catConfig && (
          <span style={{
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: '700',
            textTransform: 'uppercase',
            background: `${catConfig.color}20`,
            color: catConfig.color,
            border: `1px solid ${catConfig.color}40`,
            flexShrink: 0,
          }}>
            {catConfig.letter}
          </span>
        )}

        {/* Sector badge */}
        {sector && (
          <span style={{
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: '600',
            background: `${sectorColor}15`,
            color: sectorColor,
            flexShrink: 0,
            display: 'none', // Hidden on small screens, visible on wider
          }}>
            {sector}
          </span>
        )}
      </div>

      {/* Right: Price + Change + Close */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span style={{
          fontSize: '15px',
          fontWeight: '700',
          color: HOLO_COLORS.textPrimary,
          fontFamily: 'monospace',
        }}>
          ${asset.price?.toFixed(2) || '\u2014'}
        </span>

        {/* Daily change pill */}
        <span style={{
          padding: '2px 6px',
          borderRadius: '10px',
          fontSize: '12px',
          fontWeight: '600',
          background: isPositive ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 71, 87, 0.15)',
          color: isPositive ? '#00ff88' : '#ff4757',
        }}>
          {isPositive ? '\u25B2' : '\u25BC'} {Math.abs(priceChange)?.toFixed(2)}%
        </span>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: HOLO_COLORS.textSecondary,
            cursor: 'pointer',
            padding: '4px',
            fontSize: '18px',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          \u2715
        </button>
      </div>
    </div>
  );
};

export default ChartHeader;
