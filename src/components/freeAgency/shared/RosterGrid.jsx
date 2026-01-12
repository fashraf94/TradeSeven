import React from 'react';
import { HOLO_COLORS, CATEGORY_CONFIG } from '../../../constants/holoTheme';
import RosterAssetCard from './RosterAssetCard';

/**
 * RosterGrid - Desktop version of roster display
 *
 * Features:
 * - 3x3 grid organized by category (Steady/Risky/Defensive)
 * - Category headers with colored indicators
 * - Empty slot placeholders
 */
const RosterGrid = ({
  roster,           // { steady: [], risky: [], defensive: [] }
  selectedDrop,
  onSelectDrop,
  onMoreInfo,       // Callback for researching assets
  canSwap,
}) => {
  const categories = ['steady', 'risky', 'defensive'];

  return (
    <div>
      {categories.map((category) => {
        const assets = roster[category] || [];
        const config = CATEGORY_CONFIG[category];

        return (
          <div key={category} style={{ marginBottom: '20px' }}>
            {/* Category Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '10px',
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: config.color,
                boxShadow: `0 0 6px ${config.color}`,
              }} />
              <span style={{
                fontSize: '12px',
                fontWeight: 700,
                color: config.color,
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}>
                {config.label}
              </span>
              <span style={{
                fontSize: '11px',
                color: HOLO_COLORS.textMuted,
              }}>
                ({assets.length}/3)
              </span>
            </div>

            {/* Assets Row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
            }}>
              {assets.map((asset) => (
                <RosterAssetCard
                  key={asset.symbol}
                  asset={asset}
                  isSelected={selectedDrop?.symbol === asset.symbol}
                  onSelect={onSelectDrop}
                  onMoreInfo={onMoreInfo}
                  disabled={!canSwap}
                  compact={false}
                />
              ))}

              {/* Empty slots */}
              {assets.length < 3 && [...Array(3 - assets.length)].map((_, idx) => (
                <div
                  key={`empty-${category}-${idx}`}
                  style={{
                    padding: '12px',
                    background: HOLO_COLORS.bgCard,
                    border: `1px dashed ${HOLO_COLORS.borderSubtle}`,
                    borderRadius: '10px',
                    minHeight: '80px',
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RosterGrid;
