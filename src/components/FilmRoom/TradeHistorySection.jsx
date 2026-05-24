import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { filterTradesByDay } from '../../utils/computeDayScore';

const TIER_STYLES = {
  star:    { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)', label: 'Star' },
  core:    { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', label: 'Core' },
  support: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', label: 'Support' },
};

const formatPrice = (n) =>
  typeof n === 'number' && Number.isFinite(n) ? `$${n.toFixed(2)}` : '—';

const formatPct = (n) =>
  typeof n === 'number' && Number.isFinite(n) ? `${n >= 0 ? '+' : ''}${n.toFixed(2)}%` : '—';

const formatTimestamp = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    hour: 'numeric', minute: '2-digit',
  });
};

function TradeRow({ trade, tokens, onSymbolClick }) {
  const tierKey = trade?.tier || 'support';
  const tierStyle = TIER_STYLES[tierKey] || TIER_STYLES.support;

  const entryPrice = Number(trade?.entryPrice);
  const exitPrice = Number(trade?.exitPrice);
  const hasPnl = Number.isFinite(entryPrice) && Number.isFinite(exitPrice) && entryPrice !== 0;
  const pnlPct = hasPnl ? ((exitPrice - entryPrice) / entryPrice) * 100 : null;
  const pnlColor =
    pnlPct == null
      ? tokens.textFaint || '#64748b'
      : pnlPct >= 0
      ? tokens.emerald || '#34d399'
      : tokens.red || '#ef4444';
  const PnlIcon = pnlPct == null ? null : pnlPct >= 0 ? ArrowUpRight : ArrowDownRight;

  const handleSymbolClick = (sym) => {
    if (sym && onSymbolClick) onSymbolClick({ symbol: sym });
  };

  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 10,
        background: tokens.bgCard || '#15171E',
        border: `1px solid ${tokens.borderDefault || 'rgba(255,255,255,0.05)'}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            padding: '2px 7px',
            borderRadius: 6,
            background: tierStyle.bg,
            color: tierStyle.color,
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {tierStyle.label}
        </span>
        <span
          onClick={() => handleSymbolClick(trade?.symbolOut)}
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: tokens.textPrimary || '#e2e8f0',
            cursor: trade?.symbolOut ? 'pointer' : 'default',
          }}
        >
          {trade?.symbolOut || '—'}
        </span>
        <span style={{ color: tokens.textFaint || '#64748b', fontSize: 12 }}>→</span>
        <span
          onClick={() => handleSymbolClick(trade?.symbolIn)}
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: tokens.teal || '#5eead4',
            cursor: trade?.symbolIn ? 'pointer' : 'default',
          }}
        >
          {trade?.symbolIn || '—'}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: pnlColor,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {PnlIcon && <PnlIcon size={12} />}
          {formatPct(pnlPct)}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          fontSize: 10.5,
          color: tokens.textMuted || '#94a3b8',
        }}
      >
        <span>Entry {formatPrice(entryPrice)}</span>
        <span>Exit {formatPrice(exitPrice)}</span>
        {typeof trade?.lockedPoints === 'number' && (
          <span>Banked {trade.lockedPoints.toFixed(1)} pts</span>
        )}
        {trade?.swappedOutAt && (
          <span style={{ marginLeft: 'auto', color: tokens.textFaint || '#64748b' }}>
            {formatTimestamp(trade.swappedOutAt)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function TradeHistorySection({ battle, dayNum, onSymbolClick, tokens }) {
  const trades = Array.isArray(battle?.trades) ? battle.trades : [];
  const dayTrades = filterTradesByDay(trades, dayNum, battle);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          padding: '6px 16px 4px',
          fontSize: 11,
          fontWeight: 700,
          color: tokens.textPrimary || '#e2e8f0',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Trade History ({dayTrades.length})
      </div>

      {dayTrades.length === 0 ? (
        <div
          style={{
            margin: '0 12px',
            padding: '14px 16px',
            borderRadius: 12,
            border: `1px dashed ${tokens.borderDefault || 'rgba(255,255,255,0.05)'}`,
            color: tokens.textFaint || '#64748b',
            fontSize: 12,
            textAlign: 'center',
          }}
        >
          No trades on this day.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 12px' }}>
          {dayTrades.map((trade, i) => (
            <TradeRow
              key={trade?.evalId || `${trade?.symbolOut || 'x'}-${trade?.swapDay ?? i}-${i}`}
              trade={trade}
              tokens={tokens}
              onSymbolClick={onSymbolClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
