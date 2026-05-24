import React from 'react';
import { computeDayScore } from '../../utils/computeDayScore';

function formatPts(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '0';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}`;
}

export default function ScoreSummaryCard({ battle, dayNum, tokens }) {
  const { tradePoints, badgePoints, total } = computeDayScore(battle, dayNum);

  const totalColor =
    total > 0 ? tokens.emerald || '#34d399' : total < 0 ? tokens.red || '#ef4444' : tokens.textMuted || '#94a3b8';

  return (
    <div
      style={{
        margin: '0 12px',
        padding: '14px 16px',
        borderRadius: 12,
        background: tokens.bgCard || '#15171E',
        border: `1px solid ${tokens.borderDefault || 'rgba(255,255,255,0.05)'}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: tokens.textFaint || '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        Day {dayNum} Score
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: totalColor }}>{formatPts(total)}</span>
          <span style={{ fontSize: 10, color: tokens.textFaint || '#64748b' }}>Total</span>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 14,
            paddingLeft: 12,
            borderLeft: `1px solid ${tokens.borderDefault || 'rgba(255,255,255,0.08)'}`,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: tokens.teal || '#5eead4' }}>
              {formatPts(tradePoints)}
            </span>
            <span style={{ fontSize: 10, color: tokens.textFaint || '#64748b' }}>Trades</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: tokens.amber || '#f59e0b' }}>
              {formatPts(badgePoints)}
            </span>
            <span style={{ fontSize: 10, color: tokens.textFaint || '#64748b' }}>Badges</span>
          </div>
        </div>
      </div>
    </div>
  );
}
