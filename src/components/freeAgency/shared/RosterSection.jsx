import React from 'react';
import { HOLO_COLORS } from '../../../constants/holoTheme';
import RosterAssetCard from './RosterAssetCard';

/**
 * RosterSection - Horizontal scrolling row of user's assets to drop
 *
 * NEW FLOW: User selects FREE AGENT first, then selects which roster asset to DROP.
 * This section is only active after a free agent is selected.
 *
 * Features:
 * - Shows roster assets matching the selected free agent's category
 * - Highlights worst performer in that category
 * - Inactive state when no free agent is selected
 */
const RosterSection = ({
  roster,
  selectedDrop,
  selectedAdd,        // NEW: the free agent being added
  onSelectDrop,
  onMoreInfo,
  canSwap,
}) => {
  // Flatten roster with gains for display
  const allAssets = [
    ...(roster.steady || []),
    ...(roster.risky || []),
    ...(roster.defensive || []),
  ];

  // Determine if section is active (free agent selected)
  const isActive = selectedAdd !== null;

  // Filter to show only matching category when a free agent is selected
  const displayedAssets = isActive
    ? allAssets.filter(asset => asset.category === selectedAdd.category)
    : allAssets;

  // Find worst performer in the displayed assets
  const worstAsset = displayedAssets.reduce((worst, asset) => {
    if (!worst || (asset.gain || 0) < (worst.gain || 0)) {
      return asset;
    }
    return worst;
  }, null);

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
          color: isActive ? HOLO_COLORS.textPrimary : HOLO_COLORS.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          {isActive ? `Step 2: Drop a ${selectedAdd.category}` : 'Your Roster'}
        </div>

        {isActive && worstAsset && !selectedDrop && (
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

        {!isActive && (
          <div style={{
            fontSize: '9px',
            color: HOLO_COLORS.textMuted,
          }}>
            Select free agent first ↓
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
        opacity: isActive ? 1 : 0.4,
        pointerEvents: isActive ? 'auto' : 'none',
      }}>
        {displayedAssets.length === 0 ? (
          <div style={{
            padding: '20px',
            color: HOLO_COLORS.textMuted,
            fontSize: '12px',
          }}>
            {isActive ? `No ${selectedAdd.category} assets in roster` : 'No assets in roster'}
          </div>
        ) : (
          displayedAssets.map((asset) => (
            <RosterAssetCard
              key={asset.symbol}
              asset={asset}
              isSelected={selectedDrop?.symbol === asset.symbol}
              onSelect={onSelectDrop}
              onMoreInfo={onMoreInfo}
              disabled={!isActive || !canSwap}
              compact
            />
          ))
        )}
      </div>

      {/* Helper text */}
      {isActive && !selectedDrop && displayedAssets.length > 0 && (
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
