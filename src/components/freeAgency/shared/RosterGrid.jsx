import React from 'react';
import { HOLO_COLORS, CATEGORY_CONFIG } from '../../../constants/holoTheme';
import RosterAssetCard from './RosterAssetCard';

/**
 * RosterGrid - Desktop version of roster display
 *
 * NEW FLOW: Step 2 - User selects which asset to DROP after selecting a free agent.
 *
 * Features:
 * - 3x3 grid organized by category (Neutral/Aggressive/Defensive)
 * - Category headers with colored indicators
 * - Only active when a free agent is selected
 * - Highlights matching category
 */
const RosterGrid = ({
  roster,           // { neutral: [], aggressive: [], defensive: [] }
  selectedDrop,
  selectedAdd,      // NEW: the free agent being added
  onSelectDrop,
  onMoreInfo,
  canSwap,
  orangeZoneLocked = {},  // Orange Zone swap lock status by symbol
}) => {
  const categories = ['neutral', 'aggressive', 'defensive'];
  const isActive = selectedAdd !== null;

  return (
    <div>
      {/* Helper text when no free agent selected */}
      {!isActive && (
        <div style={{
          padding: '12px',
          background: `${HOLO_COLORS.cyan}11`,
          border: `1px solid ${HOLO_COLORS.cyan}33`,
          borderRadius: '8px',
          marginBottom: '16px',
          textAlign: 'center',
          fontSize: '12px',
          color: HOLO_COLORS.cyan,
        }}>
          Select a free agent first →
        </div>
      )}

      {categories.map((category) => {
        const assets = roster[category] || [];
        const config = CATEGORY_CONFIG[category];
        const isMatchingCategory = isActive && selectedAdd.category === category;

        return (
          <div
            key={category}
            style={{
              marginBottom: '20px',
              opacity: isActive ? (isMatchingCategory ? 1 : 0.4) : 0.6,
              pointerEvents: isActive && isMatchingCategory ? 'auto' : (isActive ? 'none' : 'auto'),
            }}
          >
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
              {isMatchingCategory && (
                <span style={{
                  fontSize: '10px',
                  color: HOLO_COLORS.amber,
                  marginLeft: 'auto',
                }}>
                  ← Select to drop
                </span>
              )}
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
                  disabled={!canSwap || !isActive || !isMatchingCategory}
                  isLocked={!!orangeZoneLocked[asset.symbol]}
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
