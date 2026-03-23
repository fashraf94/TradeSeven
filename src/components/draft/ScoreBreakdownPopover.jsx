import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { HOLO_COLORS } from '../../constants/holoTheme';
import { fetchHistoricalOHLCV } from '../../services/eodhdAPI';

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
const ScoreBreakdownPopover = ({ asset, events: battleEvents = [], onClose, entryPrice: entryPriceProp = 0, battleCreatedAt = null, priceHistory = [], bankedBadgePoints = 0 }) => {
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
  } = asset || {};

  // Fetch historical daily OHLCV for multi-day sparkline
  const [historicalCandles, setHistoricalCandles] = useState(null);

  useEffect(() => {
    if (!symbol || !battleCreatedAt) return;
    const start = battleCreatedAt?.toDate ? battleCreatedAt.toDate() : new Date(battleCreatedAt);
    const fromDate = start.toISOString().split('T')[0];
    const toDate = new Date().toISOString().split('T')[0];
    if (fromDate === toDate) return; // same-day battle — no daily candles yet

    let cancelled = false;
    fetchHistoricalOHLCV(symbol, '1d', { from: fromDate, to: toDate })
      .then(data => {
        if (!cancelled && data && data.length > 0) setHistoricalCandles(data);
      });
    return () => { cancelled = true; };
  }, [symbol, battleCreatedAt]);

  if (!asset) return null;

  // Battle entry price: the price when the battle became active (activation price)
  // This is now sourced from battle.state.startingPrices via the enriched asset
  const battleEntry = baselinePrice || startingPrice || lockedPrice || (entryPriceProp > 0 ? entryPriceProp : 0);
  const hasBattleEntry = battleEntry > 0 && currentPrice > 0;
  const rawChangeFromEntry = hasBattleEntry ? ((currentPrice - battleEntry) / battleEntry) * 100 : 0;
  // Negate for short positions — price going up is bad for shorts
  const isShort = asset.direction === 'short';
  const changeFromEntry = isShort ? -rawChangeFromEntry : rawChangeFromEntry;

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
            {symbol}{isShort && <span style={{ fontSize: '10px', fontWeight: 600, color: '#ff6b6b', background: 'rgba(255, 107, 107, 0.15)', padding: '1px 5px', borderRadius: '3px', marginLeft: '4px' }}>SHORT ↓</span>} Score Breakdown
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
                  Entry Price
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

          {/* Today's Baseline (from cron dailyLevels) */}
          {asset?.dailyLevels?.baseline > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 14px',
              marginBottom: '8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(245, 158, 11, 0.06)',
              border: '1px solid rgba(245, 158, 11, 0.15)',
              fontSize: '12px',
            }}>
              <span style={{ color: '#9ca3af' }}>Today&apos;s Baseline</span>
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                ${asset.dailyLevels.baseline.toFixed(2)}
              </span>
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

            {/* Banked Badge Points from Previous Days */}
            {bankedBadgePoints !== 0 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 12px',
                borderTop: `1px solid ${HOLO_COLORS.borderSubtle}33`,
                marginTop: '2px',
              }}>
                <span style={{
                  color: HOLO_COLORS.textSecondary,
                  fontSize: '12px',
                }}>
                  Previous Days: Badges
                </span>
                <span style={{
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  fontSize: '13px',
                  color: bankedBadgePoints >= 0 ? HOLO_COLORS.green : HOLO_COLORS.red,
                }}>
                  {bankedBadgePoints >= 0 ? '+' : ''}{bankedBadgePoints.toFixed(1)} pts
                </span>
              </div>
            )}

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

          {/* Sparkline Chart — entry to current price (historical OHLCV + intraday) */}
          {hasBattleEntry && (() => {
            const pnl = currentPrice - battleEntry;
            const isPositive = pnl >= 0;
            const color = isPositive ? '#10b981' : '#ef4444';

            // Days held
            let daysText = '';
            if (battleCreatedAt) {
              const start = battleCreatedAt?.toDate ? battleCreatedAt.toDate() : new Date(battleCreatedAt);
              const days = Math.max(1, Math.ceil((new Date() - start) / (1000 * 60 * 60 * 24)));
              daysText = `${days} day${days !== 1 ? 's' : ''}`;
            }

            // Entry timestamp
            const entryTime = battleCreatedAt
              ? (battleCreatedAt?.toDate ? battleCreatedAt.toDate().getTime() : new Date(battleCreatedAt).getTime())
              : Date.now() - 86400000;

            // Historical daily closes (coarse, multi-day shape)
            const histPoints = (historicalCandles || []).map(c => ({
              time: new Date(c.date).getTime() + 43200000, // noon offset to center on day
              price: c.close,
            }));

            // Intraday polling ticks — only those AFTER last historical candle
            const lastHistTime = histPoints.length > 0 ? histPoints[histPoints.length - 1].time : 0;
            const intradayPoints = priceHistory.filter(p => p.time > lastHistTime);

            // Merge: entry anchor + historical closes + intraday ticks + current anchor
            const rawPoints = [
              { time: entryTime, price: battleEntry },
              ...histPoints,
              ...intradayPoints,
              { time: Date.now(), price: currentPrice },
            ];

            // Deduplicate points too close in time (< 1 min)
            const points = rawPoints.reduce((acc, p) => {
              if (acc.length === 0 || p.time - acc[acc.length - 1].time > 60000) acc.push(p);
              return acc;
            }, []);

            // SVG layout — taller for axis labels
            const W = 280, H = 88;
            const pad = { top: 8, bottom: 20, left: 8, right: 42 };
            const plotW = W - pad.left - pad.right;
            const plotH = H - pad.top - pad.bottom;

            const prices = points.map(p => p.price);
            const minP = Math.min(...prices);
            const maxP = Math.max(...prices);
            const range = maxP - minP || battleEntry * 0.01 || 1;
            const timeMin = points[0].time;
            const timeMax = points[points.length - 1].time;
            const timeRange = timeMax - timeMin || 1;

            const toX = (t) => pad.left + ((t - timeMin) / timeRange) * plotW;
            const toY = (p) => pad.top + plotH * (1 - (p - minP) / range);

            const polyPoints = points.map(p => `${toX(p.time)},${toY(p.price)}`).join(' ');
            const entryY = toY(battleEntry);
            const lastX = toX(points[points.length - 1].time);
            const lastY = toY(currentPrice);
            const firstX = toX(points[0].time);

            // Date labels: first, middle, last
            const dateLabelIndices = points.length >= 3
              ? [0, Math.floor(points.length / 2), points.length - 1]
              : points.length === 2 ? [0, 1] : [0];
            const dateLabels = dateLabelIndices.map(i => {
              const d = new Date(points[i].time);
              return { x: toX(points[i].time), label: `${d.getMonth() + 1}/${d.getDate()}` };
            });

            // Price label formatting
            const fmtPrice = (p) => p >= 1000 ? `$${Math.round(p)}` : p >= 100 ? `$${p.toFixed(0)}` : `$${p.toFixed(2)}`;

            return (
              <div style={{
                padding: '12px 16px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}>
                <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
                  {/* Gradient fill definition */}
                  <defs>
                    <linearGradient id={`sparkFill-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                      <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  {/* Area fill under curve */}
                  <polygon
                    points={`${polyPoints} ${lastX},${pad.top + plotH} ${firstX},${pad.top + plotH}`}
                    fill={`url(#sparkFill-${symbol})`}
                  />
                  {/* Entry price baseline — dashed */}
                  <line x1={pad.left} y1={entryY} x2={W - pad.right} y2={entryY}
                    stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 3" />
                  {/* Price path */}
                  <polyline points={polyPoints}
                    fill="none" stroke={color} strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round" />
                  {/* X-axis date labels */}
                  {dateLabels.map((dl, i) => (
                    <text
                      key={i}
                      x={dl.x}
                      y={H - 4}
                      fill="rgba(255,255,255,0.35)"
                      fontSize="8"
                      fontFamily="monospace"
                      textAnchor={i === 0 ? 'start' : i === dateLabels.length - 1 ? 'end' : 'middle'}
                    >
                      {dl.label}
                    </text>
                  ))}
                  {/* Y-axis: entry price label */}
                  <text
                    x={W - 2}
                    y={Math.max(pad.top + 6, Math.min(entryY + 3, pad.top + plotH))}
                    fill="rgba(255,255,255,0.4)"
                    fontSize="8"
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    {fmtPrice(battleEntry)}
                  </text>
                  {/* Y-axis: current price label (only if visually separated from entry) */}
                  {Math.abs(lastY - entryY) > 10 && (
                    <text
                      x={W - 2}
                      y={Math.max(pad.top + 6, Math.min(lastY + 3, pad.top + plotH))}
                      fill={color}
                      fontSize="8"
                      fontFamily="monospace"
                      textAnchor="end"
                      fontWeight="600"
                    >
                      {fmtPrice(currentPrice)}
                    </text>
                  )}
                  {/* Entry dot */}
                  <circle cx={firstX} cy={toY(battleEntry)} r="3" fill={color} />
                  {/* Current price dot with glow ring */}
                  <circle cx={lastX} cy={lastY} r="4" fill={color} opacity="0.2" />
                  <circle cx={lastX} cy={lastY} r="3" fill={color} />
                </svg>
                {/* Summary: days held + P&L */}
                <div style={{
                  display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px',
                  fontSize: '11px', color: '#8b949e', marginTop: '4px',
                }}>
                  {daysText && <span>{daysText}</span>}
                  {daysText && <span style={{ opacity: 0.4 }}>&middot;</span>}
                  <span style={{ color, fontWeight: 600 }}>
                    {isPositive ? '+' : ''}{pnl < 0 ? '-' : ''}${Math.abs(pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            );
          })()}

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
