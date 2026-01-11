import React from 'react';
import { HOLO_COLORS } from '../../../constants/holoTheme';
import RosterAssetCard from './RosterAssetCard';

/**
 * RosterSection - Horizontal scrolling row of user's assets to drop
 *
 * Features:
 * - Shows all 9 roster assets in horizontal scroll
 * - Highlights worst performer
 * - Category color coding
 * - Touch-friendly scrolling
 */
const RosterSection = ({
  roster,           // { steady: [], risky: [], defensive: [] }
  selectedDrop,
  onSelectDrop,
  canSwap,
}) => {
  // Flatten roster with gains for display
  const allAssets = [
    ...(roster.steady || []),
    ...(roster.risky || []),
    ...(roster.defensive || []),
  ];

  // Find worst performer to highlight
  const worstAsset = allAssets.reduce((worst, asset) => {
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
          color: HOLO_COLORS.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          Select Asset to Drop
        </div>

        {worstAsset && !selectedDrop && (
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
      </div>

      {/* Horizontal Scrolling Cards */}
      <div style={{
        display: 'flex',
        gap: '10px',
        overflowX: 'auto',
        paddingBottom: '8px',
        marginLeft: '-16px',
        marginRight: '-16px',
        paddingLeft: '16px',
        paddingRight: '16px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
      }}>
        {allAssets.length === 0 ? (
          <div style={{
            padding: '20px',
            color: HOLO_COLORS.textMuted,
            fontSize: '12px',
          }}>
            No assets in roster
          </div>
        ) : (
          allAssets.map((asset) => (
            <RosterAssetCard
              key={asset.symbol}
              asset={asset}
              isSelected={selectedDrop?.symbol === asset.symbol}
              onSelect={onSelectDrop}
              disabled={!canSwap}
              compact
            />
          ))
        )}
      </div>

      {/* Helper text */}
      {canSwap && !selectedDrop && allAssets.length > 0 && (
        <div style={{
          fontSize: '10px',
          color: HOLO_COLORS.textMuted,
          textAlign: 'center',
          marginTop: '8px',
        }}>
          Tap an asset to select it for swap
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
