import React, { useMemo, useState } from 'react';
import { HOLO_COLORS, CATEGORY_CONFIG, GLOW_EFFECTS } from '../../constants/holoTheme';
import { TrophyIcon, UserIcon } from './HoloIcons';
import AssetResearchModal from './AssetResearchModal';
import ScoreBreakdownPopover from './ScoreBreakdownPopover';

/**
 * TopPerformersModal - Shows top 5 performing assets across all portfolios
 *
 * Aggregates assets from all players, dedupes by symbol, and displays
 * the top performers with their owners.
 *
 * Phase 5.5: Replaces "All Picks" button functionality
 * Phase 5.6: Updated to use styled HoloIcons
 * Phase 5.7: Added Research Modal on ticker tap, Score Breakdown on points tap
 */
const TopPerformersModal = ({
  isOpen,
  onClose,
  standings,      // Array of player standings with portfolios
  currentUserId,  // Current user's ID for highlighting
}) => {
  // State for research modal
  const [selectedAssetForResearch, setSelectedAssetForResearch] = useState(null);
  // State for score breakdown popover
  const [selectedAssetForBreakdown, setSelectedAssetForBreakdown] = useState(null);

  // Aggregate and sort all assets across portfolios
  const topAssets = useMemo(() => {
    if (!standings?.length) return [];

    // Build a map of unique assets with their best data and owners
    const assetMap = new Map();

    standings.forEach((player) => {
      player.portfolio?.forEach((asset) => {
        if (!asset?.symbol) return;

        const existing = assetMap.get(asset.symbol);
        // Use asset with highest totalScore (or gain as fallback)
        const assetScore = asset.totalScore ?? (asset.gain * 10);
        const existingScore = existing?.totalScore ?? (existing?.gain * 10) ?? -Infinity;

        if (!existing || assetScore > existingScore) {
          assetMap.set(asset.symbol, {
            // Core data
            symbol: asset.symbol,
            name: asset.name || asset.symbol,
            gain: asset.gain,
            category: asset.category,
            sector: asset.sector,
            // BaggerBomb scoring data
            threshold: asset.threshold,
            baggerBombs: asset.baggerBombs || 0,
            busts: asset.busts || 0,
            basePoints: asset.basePoints || 0,
            baggerBombPoints: asset.baggerBombPoints || 0,
            bustPoints: asset.bustPoints || 0,
            totalScore: asset.totalScore ?? (asset.gain * 10),
            // Price data
            price: asset.currentPrice || asset.price,
            lockedPrice: asset.lockedPrice,
            currentPrice: asset.currentPrice,
            owners: existing?.owners || [],
          });
        }

        // Add owner if not already tracked
        const entry = assetMap.get(asset.symbol);
        if (!entry.owners.some(o => o.odUserId === player.odUserId)) {
          entry.owners.push({
            odUserId: player.odUserId,
            displayName: player.displayName,
            rank: player.currentRank,
          });
        }
      });
    });

    // Sort by totalScore descending and take top 5
    return Array.from(assetMap.values())
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 5);
  }, [standings]);

  // Handle ticker tap - open research modal
  const handleTickerTap = (asset, e) => {
    e.stopPropagation();
    setSelectedAssetForResearch(asset);
  };

  // Handle points tap - open score breakdown
  const handlePointsTap = (asset, e) => {
    e.stopPropagation();
    setSelectedAssetForBreakdown(asset);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          animation: 'fadeIn 0.2s ease-out',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(90vw, 360px)',
        maxHeight: '80vh',
        background: HOLO_COLORS.bgCard,
        border: `1px solid ${HOLO_COLORS.cyan}`,
        borderRadius: '12px',
        boxShadow: GLOW_EFFECTS.cyan,
        zIndex: 101,
        overflow: 'hidden',
        animation: 'modalSlideIn 0.3s ease-out',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 16px',
          background: `linear-gradient(180deg, ${HOLO_COLORS.bgElevated} 0%, ${HOLO_COLORS.bgCard} 100%)`,
          borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <TrophyIcon size={20} color={HOLO_COLORS.gold} />
            <span style={{
              fontSize: '14px',
              fontWeight: 700,
              color: HOLO_COLORS.textPrimary,
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              Top Performers
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: HOLO_COLORS.textMuted,
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: '12px 16px',
          maxHeight: 'calc(80vh - 60px)',
          overflowY: 'auto',
        }}>
          {topAssets.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '20px',
              color: HOLO_COLORS.textMuted,
            }}>
              No asset data available
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {topAssets.map((asset, idx) => {
                const categoryColor = CATEGORY_CONFIG[asset.category]?.color || HOLO_COLORS.cyan;
                const isPositive = asset.gain >= 0;
                const isPointsPositive = asset.totalScore >= 0;
                const userOwns = asset.owners.some(o => o.odUserId === currentUserId);

                return (
                  <div
                    key={asset.symbol}
                    style={{
                      background: userOwns
                        ? `linear-gradient(90deg, rgba(0, 255, 255, 0.1) 0%, ${HOLO_COLORS.bgElevated} 100%)`
                        : HOLO_COLORS.bgElevated,
                      borderRadius: '8px',
                      borderLeft: `3px solid ${categoryColor}`,
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {/* Rank Badge */}
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: idx === 0
                        ? `linear-gradient(135deg, ${HOLO_COLORS.gold} 0%, #b8860b 100%)`
                        : idx === 1
                          ? `linear-gradient(135deg, ${HOLO_COLORS.silver} 0%, #8a8a8a 100%)`
                          : idx === 2
                            ? `linear-gradient(135deg, ${HOLO_COLORS.bronze} 0%, #8b4513 100%)`
                            : HOLO_COLORS.borderSubtle,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '12px',
                      color: idx < 3 ? '#000' : HOLO_COLORS.textMuted,
                      flexShrink: 0,
                    }}>
                      {idx + 1}
                    </div>

                    {/* Asset Info - Left side (Ticker area - tappable for Research Modal) */}
                    <div
                      onClick={(e) => handleTickerTap(asset, e)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '4px',
                      }}>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: HOLO_COLORS.textPrimary,
                        }}>
                          {asset.symbol}
                        </span>
                        {userOwns && (
                          <span style={{
                            marginLeft: '6px',
                            fontSize: '9px',
                            color: HOLO_COLORS.cyan,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                          }}>
                            YOURS
                          </span>
                        )}
                      </div>

                      {/* Owners */}
                      <div style={{
                        fontSize: '10px',
                        color: HOLO_COLORS.textMuted,
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '4px',
                      }}>
                        <span>Owned by:</span>
                        {asset.owners.slice(0, 3).map((owner, oi) => (
                          <span
                            key={owner.odUserId}
                            style={{
                              color: owner.odUserId === currentUserId
                                ? HOLO_COLORS.cyan
                                : HOLO_COLORS.textSecondary,
                              fontWeight: owner.odUserId === currentUserId ? 600 : 400,
                            }}
                          >
                            {owner.displayName}{oi < Math.min(2, asset.owners.length - 1) ? ',' : ''}
                          </span>
                        ))}
                        {asset.owners.length > 3 && (
                          <span style={{ color: HOLO_COLORS.textMuted }}>
                            +{asset.owners.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right side - Points (tappable) + Percentage */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '2px',
                      flexShrink: 0,
                    }}>
                      {/* Points - tappable for Score Breakdown */}
                      <div
                        onClick={(e) => handlePointsTap(asset, e)}
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          color: isPointsPositive ? HOLO_COLORS.green : HOLO_COLORS.red,
                          cursor: 'pointer',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: `1px solid ${HOLO_COLORS.borderSubtle}`,
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {isPointsPositive ? '+' : ''}{asset.totalScore.toFixed(0)} pts
                      </div>
                      {/* Percentage */}
                      <span style={{
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: isPositive ? HOLO_COLORS.green : HOLO_COLORS.red,
                        opacity: 0.8,
                      }}>
                        {isPositive ? '+' : ''}{asset.gain.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer hint */}
          <div style={{
            marginTop: '12px',
            padding: '8px',
            background: HOLO_COLORS.bgDeep,
            borderRadius: '6px',
            fontSize: '10px',
            color: HOLO_COLORS.textMuted,
            textAlign: 'center',
          }}>
            Top performing assets across all players in this battle
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: translate(-50%, -45%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>

      {/* Asset Research Modal */}
      {selectedAssetForResearch && (
        <AssetResearchModal
          asset={{
            symbol: selectedAssetForResearch.symbol,
            name: selectedAssetForResearch.name || selectedAssetForResearch.symbol,
            price: selectedAssetForResearch.price || selectedAssetForResearch.currentPrice || 0,
            percentChange: selectedAssetForResearch.gain || 0,
            sector: selectedAssetForResearch.sector,
            // BaggerBomb scoring data
            threshold: selectedAssetForResearch.threshold,
            baggerBombs: selectedAssetForResearch.baggerBombs,
            busts: selectedAssetForResearch.busts,
            basePoints: selectedAssetForResearch.basePoints,
            baggerBombPoints: selectedAssetForResearch.baggerBombPoints,
            bustPoints: selectedAssetForResearch.bustPoints,
            totalScore: selectedAssetForResearch.totalScore,
            gain: selectedAssetForResearch.gain,
            lockedPrice: selectedAssetForResearch.lockedPrice,
            currentPrice: selectedAssetForResearch.currentPrice,
          }}
          sector={selectedAssetForResearch.sector}
          category={selectedAssetForResearch.category}
          onClose={() => setSelectedAssetForResearch(null)}
          showActionButton={false}
        />
      )}

      {/* Score Breakdown Popover */}
      {selectedAssetForBreakdown && (
        <ScoreBreakdownPopover
          asset={selectedAssetForBreakdown}
          onClose={() => setSelectedAssetForBreakdown(null)}
        />
      )}
    </>
  );
};

export default TopPerformersModal;
