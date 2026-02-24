import React, { useMemo } from 'react';
import ReactDOM from 'react-dom';
import { HOLO_COLORS } from '../../constants/holoTheme';

const NEGATIVE_TYPES = ['bust', 'crash', 'meltdown'];

/**
 * ScoreBreakdownPopover - Shows detailed score breakdown when user taps points
 *
 * Content:
 * ┌─────────────────────────────────────┐
 * │  CAT Score Breakdown           ✕   │
 * ├─────────────────────────────────────┤
 * │                                     │
 * │  Base (3.5% × 10)       +35.0 pts  │
 * │  💣 BaggerBomb ×2        +30.0 pts  │
 * │  📉 Busts ×0              -0.0 pts  │
 * │  ───────────────────────────────── │
 * │  TOTAL                  +60.0 pts  │
 * │                                     │
 * │  TIMELINE                          │
 * │  💣 Hit at 10:42 AM (+2.4%)        │
 * │  💣 Hit at 11:15 AM (+3.5%)        │
 * │                                     │
 * └─────────────────────────────────────┘
 */
const ScoreBreakdownPopover = ({ asset, events: battleEvents = [], onClose }) => {
  if (!asset) return null;

  const {
    symbol,
    gain = 0,
    threshold = 2.5,  // Default matches BaggerBombTab fallback
    baggerBombs = 0,
    busts = 0,
    basePoints = 0,
    baggerBombPoints = 0,
    bustPoints = 0,
    totalScore = 0,
  } = asset;

  // Build timeline from real persisted events (filtered to this symbol).
  // Falls back to a badge-only summary for legacy battles without events.
  const timeline = useMemo(() => {
    const symbolEvents = (battleEvents || [])
      .filter(e => e.symbol === symbol)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map(e => {
        const isNeg = NEGATIVE_TYPES.includes(e.type);
        return {
          type: isNeg ? 'bust' : 'baggerbomb',
          time: new Date(e.timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'America/New_York',
          }),
          percent: e.multiplier != null ? e.multiplier * threshold : 0,
          hasRealTime: true,
        };
      });

    // If no persisted events but badges exist, show badge summary without timestamps
    if (symbolEvents.length === 0 && (baggerBombs > 0 || busts > 0)) {
      for (let i = 0; i < baggerBombs; i++) {
        symbolEvents.push({
          type: 'baggerbomb',
          time: null,
          percent: threshold * (i + 1),
          hasRealTime: false,
        });
      }
      for (let i = 0; i < busts; i++) {
        symbolEvents.push({
          type: 'bust',
          time: null,
          percent: -(threshold * (i + 1)),
          hasRealTime: false,
        });
      }
    }

    return symbolEvents;
  }, [battleEvents, symbol, threshold, baggerBombs, busts]);

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
                Base ({gain >= 0 ? '+' : ''}{gain.toFixed(1)}% × 10)
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

          {/* Timeline Section */}
          {timeline.length > 0 && (
            <div>
              <div style={{
                fontSize: '10px',
                fontWeight: 700,
                color: HOLO_COLORS.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <span style={{ color: HOLO_COLORS.cyan }}>⏱</span>
                TIMELINE
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                maxHeight: '120px',
                overflowY: 'auto',
              }}>
                {timeline.map((event, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '6px',
                      fontSize: '11px',
                    }}
                  >
                    <span style={{
                      textShadow: event.type === 'baggerbomb'
                        ? '0 0 8px rgba(0, 255, 170, 0.8), 0 0 16px rgba(0, 255, 170, 0.4)'
                        : '0 0 8px rgba(255, 100, 100, 0.8), 0 0 16px rgba(255, 100, 100, 0.4)',
                    }}>{event.type === 'baggerbomb' ? '💣' : '📉'}</span>
                    <span style={{ color: HOLO_COLORS.textMuted }}>
                      {event.hasRealTime ? `Hit at ${event.time}` : (event.type === 'baggerbomb' ? 'BaggerBomb' : 'Bust')}
                    </span>
                    <span style={{
                      marginLeft: 'auto',
                      fontFamily: 'monospace',
                      color: event.type === 'baggerbomb' ? HOLO_COLORS.green : HOLO_COLORS.red,
                      fontWeight: 600,
                    }}>
                      ({event.percent >= 0 ? '+' : ''}{event.percent.toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Events Message */}
          {timeline.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '16px',
              color: HOLO_COLORS.textMuted,
              fontSize: '12px',
            }}>
              No BaggerBombs or Busts triggered yet
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
