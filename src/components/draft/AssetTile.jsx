import React, { useState } from 'react';
import { HOLO_COLORS, CATEGORY_CONFIG } from '../../constants/holoTheme';
import ScoreBreakdownPopover from './ScoreBreakdownPopover';

/**
 * AssetTile - Individual asset card for the 3x3 portfolio grid
 *
 * NEW LAYOUT (Change 1 - Squad Box Redesign):
 * ┌─────────────────────────────────────┐
 * │ [S]  AAPL              +1 pts      │
 * │ ⚡2.3%  💣0 📉0          +0.1%      │
 * └─────────────────────────────────────┘
 *
 * Left side: Category badge [S/R/D], symbol, threshold %, BaggerBomb count 💣, Bust count 📉
 * Right side: Points (larger/prominent), % change
 *
 * Change 3: Points are now tappable to show ScoreBreakdownPopover
 */
const AssetTile = ({
  asset,              // { symbol, gain, lockedPrice, currentPrice, category, threshold, baggerBombs, busts, totalScore, basePoints, baggerBombPoints, bustPoints }
  isScoutMode = false,
  comparisonData = null, // { isLinked, isThreat, isSectorRival, deltaVsYourBest }
  compact = false,
}) => {
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);

  // Get category color (fallback to cyan if unknown)
  const categoryColor = CATEGORY_CONFIG[asset?.category]?.color || HOLO_COLORS.cyan;
  const categoryLetter = CATEGORY_CONFIG[asset?.category]?.letter || 'S';

  // Determine special highlighting for scout mode
  let borderColor = categoryColor;
  let glowEffect = 'none';
  let badge = null;

  if (isScoutMode && comparisonData) {
    if (comparisonData.isThreat) {
      borderColor = HOLO_COLORS.purple;
      glowEffect = `0 0 10px ${HOLO_COLORS.purple}66`;
      badge = { text: 'THREAT', color: HOLO_COLORS.purple, bg: 'rgba(139, 92, 246, 0.3)' };
    } else if (comparisonData.isLinked) {
      borderColor = HOLO_COLORS.cyan;
      badge = { text: 'LINKED', color: HOLO_COLORS.cyan, bg: 'rgba(0, 255, 255, 0.2)' };
    } else if (comparisonData.isSectorRival) {
      badge = { text: 'RIVAL', color: HOLO_COLORS.amber, bg: 'rgba(245, 158, 11, 0.3)' };
    }
  }

  const gainValue = typeof asset?.gain === 'number' ? asset.gain : 0;
  const isPositive = gainValue >= 0;
  const totalScore = asset?.totalScore ?? 0;
  const isScorePositive = totalScore >= 0;

  if (!asset || !asset.symbol) {
    return (
      <div style={{
        background: HOLO_COLORS.bgCard,
        borderRadius: '8px',
        border: `1px dashed ${HOLO_COLORS.borderSubtle}`,
        minHeight: compact ? '52px' : '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ color: HOLO_COLORS.textMuted, fontSize: '10px' }}>-</span>
      </div>
    );
  }

  return (
    <>
      <div style={{
        position: 'relative',
        background: HOLO_COLORS.bgCard,
        borderRadius: '8px',
        borderLeft: `3px solid ${borderColor}`,
        boxShadow: glowEffect,
        padding: compact ? '8px 10px' : '10px 12px',
        transition: 'all 0.2s ease',
        minHeight: compact ? '52px' : '64px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}>
        {/* Badge for scout mode */}
        {badge && (
          <div style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            background: badge.bg,
            border: `1px solid ${badge.color}`,
            color: badge.color,
            fontSize: '8px',
            fontWeight: 700,
            padding: '3px 6px',
            borderRadius: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            boxShadow: comparisonData?.isThreat
              ? `0 0 8px ${badge.color}, 0 0 16px ${badge.color}44`
              : 'none',
            animation: comparisonData?.isThreat
              ? 'threatPulse 1.5s ease-in-out infinite'
              : 'none',
            zIndex: 10,
          }}>
            {badge.text}
          </div>
        )}

        {/* Threat pulse animation */}
        {comparisonData?.isThreat && (
          <style>{`
            @keyframes threatPulse {
              0%, 100% {
                box-shadow: 0 0 8px ${HOLO_COLORS.purple}, 0 0 16px rgba(139, 92, 246, 0.4);
                transform: scale(1);
              }
              50% {
                box-shadow: 0 0 12px ${HOLO_COLORS.purple}, 0 0 24px rgba(139, 92, 246, 0.6);
                transform: scale(1.05);
              }
            }
          `}</style>
        )}

        {/* ROW 1: Category Badge + Symbol + Points */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '4px',
        }}>
          {/* Left: Category Badge + Symbol */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            {/* Category Badge [S/R/D] */}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: compact ? '16px' : '18px',
              height: compact ? '16px' : '18px',
              borderRadius: '4px',
              background: `${categoryColor}33`,
              border: `1px solid ${categoryColor}66`,
              color: categoryColor,
              fontSize: compact ? '9px' : '10px',
              fontWeight: 700,
            }}>
              {categoryLetter}
            </span>

            {/* Symbol */}
            <span style={{
              fontSize: compact ? '12px' : '14px',
              fontWeight: 700,
              color: HOLO_COLORS.textPrimary,
            }}>
              {asset.symbol}
            </span>
          </div>

          {/* Right: Points (TAPPABLE - Change 3) */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              setShowScoreBreakdown(true);
            }}
            style={{
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: '4px',
              background: isScorePositive ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 51, 102, 0.1)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isScorePositive ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 51, 102, 0.2)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isScorePositive ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 51, 102, 0.1)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <span style={{
              fontSize: compact ? '12px' : '14px',
              fontWeight: 700,
              fontFamily: 'monospace',
              color: isScorePositive ? HOLO_COLORS.green : HOLO_COLORS.red,
            }}>
              {isScorePositive ? '+' : ''}{totalScore.toFixed(0)} pts
            </span>
          </div>
        </div>

        {/* ROW 2: Threshold + BaggerBombs/Busts + % Change */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Left: Threshold + BaggerBomb/Bust counts */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: compact ? '6px' : '8px',
            fontSize: compact ? '9px' : '10px',
          }}>
            {/* Threshold */}
            {asset.threshold && (
              <span style={{
                color: HOLO_COLORS.textMuted,
                fontFamily: 'monospace',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
              }} title={`Threshold: ${asset.threshold}%`}>
                <span style={{
                  textShadow: '0 0 8px rgba(255, 215, 0, 0.8), 0 0 16px rgba(255, 215, 0, 0.4)',
                }}>⚡</span>
                {asset.threshold.toFixed(1)}%
              </span>
            )}

            {/* BaggerBomb count */}
            <span style={{
              color: (asset.baggerBombs || 0) > 0 ? HOLO_COLORS.green : HOLO_COLORS.textMuted,
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
            }}>
              <span style={{
                textShadow: (asset.baggerBombs || 0) > 0
                  ? '0 0 8px rgba(0, 255, 170, 0.8), 0 0 16px rgba(0, 255, 170, 0.4)'
                  : 'none',
              }}>💣</span>
              {asset.baggerBombs || 0}
            </span>

            {/* Bust count */}
            <span style={{
              color: (asset.busts || 0) > 0 ? HOLO_COLORS.red : HOLO_COLORS.textMuted,
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
            }}>
              <span style={{
                textShadow: (asset.busts || 0) > 0
                  ? '0 0 8px rgba(255, 100, 100, 0.8), 0 0 16px rgba(255, 100, 100, 0.4)'
                  : 'none',
              }}>📉</span>
              {asset.busts || 0}
            </span>
          </div>

          {/* Right: Percentage change */}
          <span style={{
            fontSize: compact ? '10px' : '11px',
            fontFamily: 'monospace',
            color: isPositive ? HOLO_COLORS.green : HOLO_COLORS.red,
            opacity: 0.8,
          }}>
            {isPositive ? '+' : ''}{gainValue.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Score Breakdown Popover (Change 3) */}
      {showScoreBreakdown && (
        <ScoreBreakdownPopover
          asset={asset}
          onClose={() => setShowScoreBreakdown(false)}
        />
      )}
    </>
  );
};

export default AssetTile;
