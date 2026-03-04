import React from 'react';
import ReactDOM from 'react-dom';
import { HOLO_COLORS } from '../../constants/holoTheme';

/**
 * ScoreBreakdownPopover - Shows detailed score breakdown when user taps points
 *
 * Content:
 * ┌─────────────────────────────────────┐
 * │  CAT Score Breakdown           ✕   │
 * ├─────────────────────────────────────┤
 * │  ENTRY PRICE | CURRENT | TOTAL     │  ← from battle startingPrices
 * │  DAY BASELINE| CURRENT | TODAY     │  ← daily open for scoring context
 * │                                     │
 * │  Base (3.5% × 10)       +35.0 pts  │
 * │  💣 BaggerBomb ×2        +30.0 pts  │
 * │  📉 Busts ×0              -0.0 pts  │
 * │  ───────────────────────────────── │
 * │  TOTAL                  +60.0 pts  │
 * │                                     │
 * │  POSITION SUMMARY                  │
 * │  Entry Price        $112.50        │
 * │  Days Held          3 days         │
 * │  Total P&L         +$7.01          │
 * │                                     │
 * └─────────────────────────────────────┘
 */
const ScoreBreakdownPopover = ({ asset, events: battleEvents = [], onClose, entryPrice: entryPriceProp = 0, battleCreatedAt = null }) => {
  if (!asset) return null;

  const {
    symbol,
    gain = 0,
    threshold = 2.5,  // Default matches BaggerBombTab fallback
    tierMultiplier = 1,
    baggerBombs = 0,
    busts = 0,
    basePoints = 0,
    baggerBombPoints = 0,
    bustPoints = 0,
    totalScore = 0,
    startingPrice = 0,
    currentPrice = 0,
    lockedPrice = 0,
    baselinePrice = 0,
  } = asset;

  // Battle entry price: the price when the battle became active (activation price)
  // This is now sourced from battle.state.startingPrices via the enriched asset
  const battleEntry = baselinePrice || startingPrice || lockedPrice || (entryPriceProp > 0 ? entryPriceProp : 0);
  const hasBattleEntry = battleEntry > 0 && currentPrice > 0;
  const changeFromEntry = hasBattleEntry ? ((currentPrice - battleEntry) / battleEntry) * 100 : 0;

  return ReactDOM.createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 200,
          animation: 'fadeIn 0.15s ease-out',
        }}
      />

      {/* Popover Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(calc(100vw - 48px), 320px)',
          background: '#0d1117',
          borderRadius: '12px',
          border: `1px solid ${HOLO_COLORS.cyan}66`,
          boxShadow: `0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px ${HOLO_COLORS.cyan}22`,
          zIndex: 201,
          overflow: 'hidden',
          animation: 'popoverSlideIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 16px',
          borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
          background: 'rgba(0, 255, 255, 0.05)',
        }}>
          <span style={{
            fontSize: '14px',
            fontWeight: 700,
            color: HOLO_COLORS.textPrimary,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{ color: HOLO_COLORS.cyan }}>📊</span>
            {symbol} Score Breakdown
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: HOLO_COLORS.textMuted,
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px' }}>
          {/* Battle Entry Row — activation price when the battle went active */}
          {hasBattleEntry && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              marginBottom: '12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(0, 217, 255, 0.06)',
              border: '1px solid rgba(0, 217, 255, 0.15)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Daily Baseline
                </span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                  ${battleEntry.toFixed(2)}
                </span>
              </div>
              <div style={{ width: '1px', height: '30px', backgroundColor: 'rgba(255,255,255,0.1)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Current
                </span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                  ${currentPrice.toFixed(2)}
                </span>
              </div>
              <div style={{ width: '1px', height: '30px', backgroundColor: 'rgba(255,255,255,0.1)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Today
                </span>
                <span style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: changeFromEntry >= 0 ? '#10b981' : '#ef4444',
                }}>
                  {changeFromEntry >= 0 ? '+' : ''}{changeFromEntry.toFixed(2)}%
                </span>
              </div>
            </div>
          )}

          {/* Score Rows */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginBottom: '16px',
          }}>
            {/* Base Points Row */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
            }}>
              <span style={{
                color: HOLO_COLORS.textSecondary,
                fontSize: '12px',
              }}>
                Base ({gain >= 0 ? '+' : ''}{gain.toFixed(1)}% × 10{tierMultiplier > 1 ? ` × ${tierMultiplier}` : ''})
              </span>
              <span style={{
                fontFamily: 'monospace',
                fontWeight: 600,
                fontSize: '13px',
                color: basePoints >= 0 ? HOLO_COLORS.green : HOLO_COLORS.red,
              }}>
                {basePoints >= 0 ? '+' : ''}{basePoints.toFixed(1)} pts
              </span>
            </div>

            {/* BaggerBomb Row */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              background: baggerBombs > 0 ? 'rgba(0, 255, 136, 0.08)' : 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              border: baggerBombs > 0 ? `1px solid ${HOLO_COLORS.green}33` : 'none',
            }}>
              <span style={{
                color: baggerBombs > 0 ? HOLO_COLORS.green : HOLO_COLORS.textMuted,
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <span style={{
                  textShadow: baggerBombs > 0 ? '0 0 8px rgba(0, 255, 170, 0.8), 0 0 16px rgba(0, 255, 170, 0.4)' : 'none',
                }}>💣</span>
                BaggerBomb ×{baggerBombs}
              </span>
              <span style={{
                fontFamily: 'monospace',
                fontWeight: 600,
                fontSize: '13px',
                color: baggerBombs > 0 ? HOLO_COLORS.green : HOLO_COLORS.textMuted,
              }}>
                +{baggerBombPoints.toFixed(1)} pts
              </span>
            </div>

            {/* Busts Row */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              background: busts > 0 ? 'rgba(255, 51, 102, 0.08)' : 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              border: busts > 0 ? `1px solid ${HOLO_COLORS.red}33` : 'none',
            }}>
              <span style={{
                color: busts > 0 ? HOLO_COLORS.red : HOLO_COLORS.textMuted,
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <span style={{
                  textShadow: busts > 0 ? '0 0 8px rgba(255, 100, 100, 0.8), 0 0 16px rgba(255, 100, 100, 0.4)' : 'none',
                }}>📉</span>
                Busts ×{busts}
              </span>
              <span style={{
                fontFamily: 'monospace',
                fontWeight: 600,
                fontSize: '13px',
                color: busts > 0 ? HOLO_COLORS.red : HOLO_COLORS.textMuted,
              }}>
                {bustPoints.toFixed(1)} pts
              </span>
            </div>

            {/* Divider */}
            <div style={{
              height: '1px',
              background: `linear-gradient(90deg, transparent 0%, ${HOLO_COLORS.borderSubtle} 20%, ${HOLO_COLORS.borderSubtle} 80%, transparent 100%)`,
              margin: '4px 0',
            }} />

            {/* Total Row */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              background: totalScore >= 0
                ? 'linear-gradient(135deg, rgba(0, 255, 136, 0.15) 0%, rgba(0, 255, 136, 0.05) 100%)'
                : 'linear-gradient(135deg, rgba(255, 51, 102, 0.15) 0%, rgba(255, 51, 102, 0.05) 100%)',
              borderRadius: '8px',
              border: `1px solid ${totalScore >= 0 ? HOLO_COLORS.green : HOLO_COLORS.red}44`,
            }}>
              <span style={{
                color: HOLO_COLORS.textPrimary,
                fontSize: '13px',
                fontWeight: 700,
              }}>
                TOTAL
              </span>
              <span style={{
                fontFamily: 'monospace',
                fontWeight: 700,
                fontSize: '16px',
                color: totalScore >= 0 ? HOLO_COLORS.green : HOLO_COLORS.red,
                textShadow: totalScore >= 0
                  ? '0 0 10px rgba(0, 255, 136, 0.5)'
                  : '0 0 10px rgba(255, 51, 102, 0.5)',
              }}>
                {totalScore >= 0 ? '+' : ''}{totalScore.toFixed(1)} pts
              </span>
            </div>
          </div>

          {/* Position Summary — replaces Timeline */}
          {hasBattleEntry && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}>
              <div style={{
                fontSize: '11px',
                color: '#6e7681',
                letterSpacing: '1px',
                fontWeight: 700,
                marginBottom: '10px',
                textTransform: 'uppercase',
              }}>
                Position Summary
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: '#8b949e' }}>Entry Price</span>
                <span style={{ fontSize: '13px', color: '#e6edf3', fontWeight: 600 }}>
                  ${battleEntry.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {battleCreatedAt && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', color: '#8b949e' }}>Days Held</span>
                  <span style={{ fontSize: '13px', color: '#e6edf3', fontWeight: 600 }}>
                    {(() => {
                      const start = battleCreatedAt?.toDate ? battleCreatedAt.toDate() : new Date(battleCreatedAt);
                      const now = new Date();
                      const days = Math.max(1, Math.ceil((now - start) / (1000 * 60 * 60 * 24)));
                      return `${days} day${days !== 1 ? 's' : ''}`;
                    })()}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#8b949e' }}>Total P&L</span>
                {(() => {
                  const pnl = currentPrice - battleEntry;
                  const isPositive = pnl >= 0;
                  return (
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: isPositive ? '#10b981' : '#ef4444',
                    }}>
                      {isPositive ? '+' : ''}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Threshold Info */}
          <div style={{
            marginTop: '16px',
            padding: '10px 12px',
            background: 'rgba(0, 255, 255, 0.05)',
            borderRadius: '8px',
            border: `1px solid ${HOLO_COLORS.cyan}22`,
            fontSize: '10px',
            color: HOLO_COLORS.textMuted,
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span>Threshold for this asset:</span>
              <span style={{
                fontFamily: 'monospace',
                color: HOLO_COLORS.cyan,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span style={{ textShadow: '0 0 8px rgba(255, 215, 0, 0.8), 0 0 16px rgba(255, 215, 0, 0.4)' }}>⚡</span>
                {threshold.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Animations */}
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes popoverSlideIn {
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
      </div>
    </>,
    document.body
  );
};

export default ScoreBreakdownPopover;
