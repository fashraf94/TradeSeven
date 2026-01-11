import React, { useMemo, useState, useEffect } from 'react';
import { HOLO_COLORS, GLOW_EFFECTS } from '../../constants/holoTheme';
import AssetTile from './AssetTile';

/**
 * CommandConsole - Fixed bottom HUD for Draft Battle
 *
 * Displays user's 3x3 portfolio grid, best/worst assets,
 * and action buttons. In scout mode, shows opponent's portfolio
 * with comparison analysis.
 *
 * Phase 5.5: Compacted layout for more Altitude Map visibility
 */
const CommandConsole = ({
  userStanding,       // Current user's standing object with portfolio
  scoutedPlayer,      // Opponent being scouted (null if not scouting)
  isScoutMode,
  onExitScout,
  onFreeAgency,
  onTopPerformers,    // NEW - replaces onViewAll
}) => {
  // State for grid flip animation
  const [isFlipping, setIsFlipping] = useState(false);
  const [prevScoutMode, setPrevScoutMode] = useState(isScoutMode);

  // Trigger flip animation when scout mode changes
  useEffect(() => {
    if (isScoutMode !== prevScoutMode) {
      setIsFlipping(true);
      const timer = setTimeout(() => {
        setIsFlipping(false);
        setPrevScoutMode(isScoutMode);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isScoutMode, prevScoutMode]);

  // Determine which portfolio to display
  const displayPlayer = isScoutMode ? scoutedPlayer : userStanding;
  const portfolio = displayPlayer?.portfolio || [];

  // Get best and worst assets
  const bestAsset = displayPlayer?.bestAsset;
  const worstAsset = displayPlayer?.worstAsset;

  // Calculate comparison data for scout mode
  const getComparisonData = (asset) => {
    if (!isScoutMode || !userStanding || !asset) return null;

    const userOwnsAsset = userStanding.portfolio?.some(a => a.symbol === asset.symbol);
    const userBestGain = userStanding.bestAsset?.gain || 0;

    return {
      isLinked: userOwnsAsset,
      isThreat: !userOwnsAsset && asset.gain > userBestGain + 5,
      isSectorRival: asset.category === userStanding.bestAsset?.category && !userOwnsAsset,
      deltaVsYourBest: asset.gain - userBestGain,
    };
  };

  // Scout mode summary stats
  const scoutSummary = useMemo(() => {
    if (!isScoutMode || !scoutedPlayer || !userStanding) return null;

    const theirBest = scoutedPlayer.bestAsset?.gain || 0;
    const yourBest = userStanding.bestAsset?.gain || 0;
    const sharedAssets = scoutedPlayer.portfolio?.filter(a =>
      userStanding.portfolio?.some(ua => ua.symbol === a.symbol)
    ).length || 0;

    return {
      theirBest,
      yourBest,
      gap: Math.abs(theirBest - yourBest),
      sharedAssets,
      youLeadBest: yourBest > theirBest,
    };
  }, [isScoutMode, scoutedPlayer, userStanding]);

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: isScoutMode
        ? 'linear-gradient(to top, rgba(245, 158, 11, 0.1) 0%, rgba(10, 14, 20, 0.98) 100%)'
        : 'linear-gradient(to top, rgba(0, 255, 255, 0.08) 0%, rgba(10, 14, 20, 0.98) 100%)',
      backdropFilter: 'blur(16px)',
      borderTop: `1px solid ${isScoutMode ? HOLO_COLORS.amber : HOLO_COLORS.cyan}`,
      boxShadow: isScoutMode
        ? '0 -4px 30px rgba(245, 158, 11, 0.15)'
        : '0 -4px 30px rgba(0, 255, 255, 0.15)',
      padding: '10px 12px',
      paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
      transition: 'all 0.3s ease',
      zIndex: 50,
    }}>
      {/* COMPACT HEADER with inline Best/Worst */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
        padding: isScoutMode ? '6px 10px' : '0',
        background: isScoutMode ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
        borderRadius: '6px',
        border: isScoutMode ? `1px solid ${HOLO_COLORS.amber}44` : 'none',
        transition: 'all 0.3s ease',
      }}>
        <div style={{
          fontSize: '10px',
          fontWeight: 700,
          color: isScoutMode ? HOLO_COLORS.amber : HOLO_COLORS.cyan,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          {isScoutMode ? (
            <>
              <span style={{ animation: 'pulse 1s ease-in-out infinite' }}>📡</span>
              SCOUTING: {scoutedPlayer?.displayName}
            </>
          ) : (
            <>
              <span>👤</span>
              YOUR SQUAD
            </>
          )}
        </div>

        {/* Show opponent's rank when scouting */}
        {isScoutMode && scoutedPlayer && (
          <div style={{
            background: HOLO_COLORS.bgCard,
            padding: '3px 8px',
            borderRadius: '4px',
            border: `1px solid ${HOLO_COLORS.borderSubtle}`,
            fontSize: '10px',
          }}>
            <span style={{ color: HOLO_COLORS.textMuted }}>RANK</span>
            <span style={{
              fontWeight: 700,
              color: HOLO_COLORS.textPrimary,
              marginLeft: '4px',
            }}>
              #{scoutedPlayer.currentRank}
            </span>
          </div>
        )}

        {/* INLINE Best/Worst (only when not scouting) */}
        {!isScoutMode && bestAsset && (
          <div style={{
            display: 'flex',
            gap: '10px',
            fontSize: '10px',
          }}>
            <span>
              <span style={{ color: HOLO_COLORS.textMuted }}>BEST:</span>
              <span style={{ color: HOLO_COLORS.green, marginLeft: '3px', fontWeight: 600 }}>
                {bestAsset.symbol} +{bestAsset.gain?.toFixed(1)}%
              </span>
            </span>
            <span>
              <span style={{ color: HOLO_COLORS.textMuted }}>WORST:</span>
              <span style={{ color: HOLO_COLORS.red, marginLeft: '3px', fontWeight: 600 }}>
                {worstAsset?.symbol} {worstAsset?.gain?.toFixed(1)}%
              </span>
            </span>
          </div>
        )}
      </div>

      {/* COMPACT 3x3 Portfolio Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '6px',
        marginBottom: '8px',
        perspective: '1000px',
      }}>
        <div style={{
          display: 'contents',
          transform: isFlipping ? 'rotateY(90deg)' : 'rotateY(0deg)',
          transition: 'transform 0.15s ease-in-out',
        }}>
          {portfolio.slice(0, 9).map((asset, idx) => (
            <div
              key={asset?.symbol || idx}
              style={{
                opacity: isFlipping ? 0.5 : 1,
                transform: isFlipping ? 'scale(0.95)' : 'scale(1)',
                transition: 'all 0.15s ease-in-out',
              }}
            >
              <AssetTile
                asset={asset}
                isScoutMode={isScoutMode}
                comparisonData={getComparisonData(asset)}
                compact={true}
              />
            </div>
          ))}
          {/* Fill empty slots if less than 9 assets */}
          {portfolio.length < 9 && [...Array(9 - Math.max(0, portfolio.length))].map((_, idx) => (
            <div
              key={`empty-${idx}`}
              style={{
                opacity: isFlipping ? 0.5 : 1,
                transform: isFlipping ? 'scale(0.95)' : 'scale(1)',
                transition: 'all 0.15s ease-in-out',
              }}
            >
              <AssetTile
                asset={null}
                compact={true}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Scout Mode Summary - compact */}
      {isScoutMode && scoutSummary && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '6px 10px',
          background: 'rgba(245, 158, 11, 0.1)',
          borderRadius: '6px',
          marginBottom: '8px',
          fontSize: '10px',
        }}>
          <span style={{ color: HOLO_COLORS.textSecondary }}>
            Their Best: <span style={{ color: HOLO_COLORS.amber, fontWeight: 600 }}>
              +{scoutSummary.theirBest.toFixed(1)}%
            </span>
          </span>
          <span style={{ color: HOLO_COLORS.textSecondary }}>
            Your Best: <span style={{ color: HOLO_COLORS.cyan, fontWeight: 600 }}>
              +{scoutSummary.yourBest.toFixed(1)}%
            </span>
          </span>
          <span style={{
            color: scoutSummary.youLeadBest ? HOLO_COLORS.green : HOLO_COLORS.red,
            fontWeight: 700,
          }}>
            Gap: {scoutSummary.gap.toFixed(1)}%
          </span>
        </div>
      )}

      {/* Action Buttons - compact */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {isScoutMode ? (
          <button
            onClick={onExitScout}
            style={{
              flex: 1,
              padding: '10px',
              background: 'rgba(245, 158, 11, 0.15)',
              border: `1px solid ${HOLO_COLORS.amber}`,
              borderRadius: '8px',
              color: HOLO_COLORS.amber,
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            ✕ EXIT SCOUT
          </button>
        ) : (
          <>
            <button
              onClick={onFreeAgency}
              style={{
                flex: 1,
                padding: '10px',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0.1) 100%)',
                border: `1px solid ${HOLO_COLORS.purple}`,
                boxShadow: `0 0 15px ${HOLO_COLORS.purple}33`,
                borderRadius: '8px',
                color: HOLO_COLORS.textPrimary,
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
            >
              🔄 Free Agency
            </button>
            <button
              onClick={onTopPerformers}
              style={{
                flex: 1,
                padding: '10px',
                background: 'transparent',
                border: `1px solid ${HOLO_COLORS.borderSubtle}`,
                borderRadius: '8px',
                color: HOLO_COLORS.textSecondary,
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
            >
              🏆 Top Performers
            </button>
          </>
        )}
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default CommandConsole;
