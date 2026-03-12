import React from 'react';
import { HOLO_COLORS } from '../../../constants/holoTheme';
import RosterAssetCard from './RosterAssetCard';

/**
 * RosterSection - Horizontal scrolling row of user's assets to drop
 *
 * BIDIRECTIONAL FLOW: User can select roster asset to drop first OR
 * free agent to add first. This section is always active.
 *
 * Features:
 * - Always active and tappable (no inactive state)
 * - When nothing selected: shows all roster assets
 * - When free agent selected: filters to matching category
 * - When roster asset selected first: highlights selected, shows category
 * - Highlights worst performer in the displayed category
 */
const RosterSection = ({
  roster,
  selectedDrop,
  selectedAdd,
  activeCategory,     // Category filter from either selection
  onSelectDrop,
  onMoreInfo,
  canSwap,
  orangeZoneLocked = {},  // Orange Zone swap lock status by symbol
}) => {
  // Flatten roster with gains for display
  const allAssets = [
    ...(roster.neutral || []),
    ...(roster.aggressive || []),
    ...(roster.defensive || []),
  ];

  // Filter to matching category when any selection is made
  const displayedAssets = activeCategory
    ? allAssets.filter(asset => asset.category === activeCategory)
    : allAssets;

  // Find worst performer in the displayed assets (only when filtered)
  const worstAsset = activeCategory ? displayedAssets.reduce((worst, asset) => {
    if (!worst || (asset.gain || 0) < (worst.gain || 0)) {
      return asset;
    }
    return worst;
  }, null) : null;

  // Determine section header text
  const getHeaderText = () => {
    if (activeCategory) {
      return `Your ${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)} Assets`;
    }
    return 'Your Roster';
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      {/* Section Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
        paddingLeft: '4px',
        paddingRight: '4px',
      }}>
        <div style={{
          fontSize: '11px',
          fontWeight: 700,
          color: HOLO_COLORS.textPrimary,
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          {getHeaderText()}
        </div>

        {/* Show worst performer hint when category is filtered and no drop selected */}
        {activeCategory && worstAsset && !selectedDrop && (
          <div style={{
            fontSize: '9px',
            color: HOLO_COLORS.amber,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: HOLO_COLORS.amber,
              animation: 'rosterPulse 1.5s ease-in-out infinite',
            }} />
            Worst: {worstAsset.symbol}
          </div>
        )}

        {/* Show count when no category filter */}
        {!activeCategory && (
          <div style={{
            fontSize: '9px',
            color: HOLO_COLORS.textMuted,
          }}>
            {allAssets.length} assets
          </div>
        )}
      </div>

      {/* Horizontal Scrolling Cards */}
      <div style={{
        display: 'flex',
        gap: '10px',
        overflowX: 'auto',
        paddingBottom: '8px',
        paddingTop: '14px',
        marginLeft: '-16px',
        marginRight: '-16px',
        paddingLeft: '16px',
        paddingRight: '16px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
      }}>
        {displayedAssets.length === 0 ? (
          <div style={{
            padding: '20px',
            color: HOLO_COLORS.textMuted,
            fontSize: '12px',
          }}>
            {activeCategory ? `No ${activeCategory} assets in roster` : 'No assets in roster'}
          </div>
        ) : (
          displayedAssets.map((asset) => (
            <RosterAssetCard
              key={asset.symbol}
              asset={asset}
              isSelected={selectedDrop?.symbol === asset.symbol}
              onSelect={onSelectDrop}
              onMoreInfo={onMoreInfo}
              disabled={!canSwap}
              isLocked={!!orangeZoneLocked[asset.symbol]}
              compact
            />
          ))
        )}
      </div>

      {/* Helper text - show when free agent selected but no drop yet */}
      {selectedAdd && !selectedDrop && displayedAssets.length > 0 && (
        <div style={{
          fontSize: '10px',
          color: HOLO_COLORS.amber,
          textAlign: 'center',
          marginTop: '8px',
        }}>
          Tap a {selectedAdd.category} asset to drop for {selectedAdd.symbol}
        </div>
      )}

      <style>{`
        @keyframes rosterPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default RosterSection;
