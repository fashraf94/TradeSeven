import React, { useMemo } from 'react';
import { HOLO_COLORS, GLOW_EFFECTS } from '../../constants/holoTheme';
import AssetTile from './AssetTile';

/**
 * CommandConsole - Fixed bottom HUD for Draft Battle
 *
 * Displays user's 3x3 portfolio grid, best/worst assets,
 * and action buttons. In scout mode, shows opponent's portfolio
 * with comparison analysis.
 */
const CommandConsole = ({
  userStanding,       // Current user's standing object with portfolio
  scoutedPlayer,      // Opponent being scouted (null if not scouting)
  isScoutMode,
  onExitScout,
  onFreeAgency,
  onViewAll,
}) => {
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
        ? 'linear-gradient(to top, rgba(245, 158, 11, 0.08) 0%, rgba(10, 14, 20, 0.98) 100%)'
        : 'linear-gradient(to top, rgba(0, 255, 255, 0.06) 0%, rgba(10, 14, 20, 0.98) 100%)',
      backdropFilter: 'blur(16px)',
      borderTop: `1px solid ${isScoutMode ? HOLO_COLORS.amber : HOLO_COLORS.cyan}`,
      boxShadow: isScoutMode
        ? '0 -4px 30px rgba(245, 158, 11, 0.15)'
        : '0 -4px 30px rgba(0, 255, 255, 0.15)',
      padding: '12px 16px',
      paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      transition: 'all 0.3s ease',
      zIndex: 50,
    }}>
      {/* Console Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
      }}>
        <div style={{
          fontSize: '11px',
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
              <span style={{
                display: 'inline-block',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}>!</span>
              SCOUTING: {scoutedPlayer?.displayName}
            </>
          ) : (
            <>
              <span style={{
                width: '6px',
                height: '6px',
                background: HOLO_COLORS.cyan,
                borderRadius: '50%',
              }} />
              YOUR SQUAD
            </>
          )}
        </div>

        {/* Compact Best/Worst on header */}
        {!isScoutMode && bestAsset && (
          <div style={{
            display: 'flex',
            gap: '12px',
            fontSize: '10px',
          }}>
            <span style={{ color: HOLO_COLORS.green }}>
              BEST: {bestAsset.symbol}
            </span>
            <span style={{ color: HOLO_COLORS.red }}>
              WORST: {worstAsset?.symbol}
            </span>
          </div>
        )}
      </div>

      {/* 3x3 Portfolio Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px',
        marginBottom: '10px',
      }}>
        {portfolio.slice(0, 9).map((asset, idx) => (
          <AssetTile
            key={asset?.symbol || idx}
            asset={asset}
            isScoutMode={isScoutMode}
            comparisonData={getComparisonData(asset)}
            compact={true}
          />
        ))}
        {/* Fill empty slots if less than 9 assets */}
        {portfolio.length < 9 && [...Array(9 - Math.max(0, portfolio.length))].map((_, idx) => (
          <AssetTile
            key={`empty-${idx}`}
            asset={null}
            compact={true}
          />
        ))}
      </div>

      {/* Best/Worst Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        marginBottom: '10px',
      }}>
        {/* Best Asset */}
        <div style={{
          background: 'rgba(0, 255, 136, 0.08)',
          border: `1px solid ${HOLO_COLORS.green}33`,
          borderRadius: '8px',
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <span style={{
            fontSize: '9px',
            color: HOLO_COLORS.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '2px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <span>BEST</span>
          </span>
          <span style={{
            fontSize: '13px',
            fontWeight: 700,
            color: HOLO_COLORS.green,
          }}>
            {bestAsset?.symbol || '—'} {bestAsset?.gain !== undefined ? `+${bestAsset.gain.toFixed(2)}%` : ''}
          </span>
        </div>

        {/* Worst Asset */}
        <div style={{
          background: 'rgba(255, 51, 102, 0.08)',
          border: `1px solid ${HOLO_COLORS.red}33`,
          borderRadius: '8px',
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <span style={{
            fontSize: '9px',
            color: HOLO_COLORS.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '2px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <span>WORST</span>
          </span>
          <span style={{
            fontSize: '13px',
            fontWeight: 700,
            color: HOLO_COLORS.red,
          }}>
            {worstAsset?.symbol || '—'} {worstAsset?.gain !== undefined ? `${worstAsset.gain.toFixed(2)}%` : ''}
          </span>
        </div>
      </div>

      {/* Scout Mode Summary */}
      {isScoutMode && scoutSummary && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'rgba(245, 158, 11, 0.08)',
          border: `1px solid ${HOLO_COLORS.amber}33`,
          borderRadius: '6px',
          marginBottom: '10px',
          fontSize: '11px',
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
            color: scoutSummary.youLeadBest
              ? HOLO_COLORS.green
              : HOLO_COLORS.red,
            fontWeight: 700,
          }}>
            Gap: {scoutSummary.gap.toFixed(1)}%
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px' }}>
        {isScoutMode ? (
          <button
            onClick={onExitScout}
            style={{
              flex: 1,
              padding: '12px',
              background: 'rgba(245, 158, 11, 0.15)',
              border: `1px solid ${HOLO_COLORS.amber}`,
              borderRadius: '8px',
              color: HOLO_COLORS.amber,
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            EXIT SCOUT VIEW
          </button>
        ) : (
          <>
            <button
              onClick={onFreeAgency}
              style={{
                flex: 1,
                padding: '12px',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(139, 92, 246, 0.1) 100%)',
                border: `1px solid ${HOLO_COLORS.purple}`,
                boxShadow: `0 0 15px ${HOLO_COLORS.purple}22`,
                borderRadius: '8px',
                color: HOLO_COLORS.textPrimary,
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
            >
              Free Agency
            </button>
            <button
              onClick={onViewAll}
              style={{
                flex: 1,
                padding: '12px',
                background: 'transparent',
                border: `1px solid ${HOLO_COLORS.borderSubtle}`,
                borderRadius: '8px',
                color: HOLO_COLORS.textSecondary,
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
            >
              All Picks
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
