import React, { useMemo } from 'react';
import { HOLO_COLORS, CATEGORY_CONFIG, GLOW_EFFECTS } from '../../constants/holoTheme';
import { TrophyIcon, UserIcon } from './HoloIcons';

/**
 * TopPerformersModal - Shows top 5 performing assets across all portfolios
 *
 * Aggregates assets from all players, dedupes by symbol, and displays
 * the top performers with their owners.
 *
 * Phase 5.5: Replaces "All Picks" button functionality
 * Phase 5.6: Updated to use styled HoloIcons
 */
const TopPerformersModal = ({
  isOpen,
  onClose,
  standings,      // Array of player standings with portfolios
  currentUserId,  // Current user's ID for highlighting
}) => {
  // Aggregate and sort all assets across portfolios
  const topAssets = useMemo(() => {
    if (!standings?.length) return [];

    // Build a map of unique assets with their best gain and owners
    const assetMap = new Map();

    standings.forEach((player) => {
      player.portfolio?.forEach((asset) => {
        if (!asset?.symbol) return;

        const existing = assetMap.get(asset.symbol);
        if (!existing || asset.gain > existing.gain) {
          assetMap.set(asset.symbol, {
            symbol: asset.symbol,
            gain: asset.gain,
            category: asset.category,
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

    // Sort by gain descending and take top 5
    return Array.from(assetMap.values())
      .sort((a, b) => b.gain - a.gain)
      .slice(0, 5);
  }, [standings]);

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

                    {/* Asset Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '4px',
                      }}>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: HOLO_COLORS.textPrimary,
                        }}>
                          {asset.symbol}
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
                        </span>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          color: isPositive ? HOLO_COLORS.green : HOLO_COLORS.red,
                        }}>
                          {isPositive ? '+' : ''}{asset.gain.toFixed(2)}%
                        </span>
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
    </>
  );
};

export default TopPerformersModal;
