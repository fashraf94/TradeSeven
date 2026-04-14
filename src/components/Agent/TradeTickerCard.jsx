// TradeTickerCard - Individual trade event card for the chat timeline
// Renders a single trade (tier, symbols, reasoning, P&L, Forge citations)
// at its chronological position in AgentChat's combined timeline.

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_STYLES = {
  star:    { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)', label: 'Star' },
  core:    { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', label: 'Core' },
  support: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', label: 'Support' },
};

const ACTION_LABELS = {
  swap: 'Swap',
  emergency_swap: 'Emergency swap',
  trade_executed: 'Trade',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatTimestamp = (value) => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const computePnlPct = (entry, exit) => {
  const a = Number(entry);
  const b = Number(exit);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return ((b - a) / a) * 100;
};

// ─── Component ────────────────────────────────────────────────────────────────

function TradeTickerCard({ trade, tokens = {}, onCitationTap, onSymbolClick }) {
  if (!trade) return null;

  const tierKey = trade.tier || 'support';
  const tierStyle = TIER_STYLES[tierKey] || TIER_STYLES.support;

  const entryPrice = Number(trade.entryPrice);
  const exitPrice = Number(trade.exitPrice);
  const hasExit = Number.isFinite(exitPrice);
  // Prefer server-computed lockedGainPct when present; fall back to our own calc.
  const pnlPct = Number.isFinite(Number(trade.lockedGainPct))
    ? Number(trade.lockedGainPct)
    : computePnlPct(entryPrice, exitPrice);

  const pnlAvailable = pnlPct != null;
  const pnlColor = !pnlAvailable
    ? (tokens.textMuted || '#9CA3AF')
    : pnlPct >= 0
      ? (tokens.emerald || '#34d399')
      : (tokens.red || '#ef4444');
  const PnlIcon = !pnlAvailable ? null : pnlPct >= 0 ? ArrowUpRight : ArrowDownRight;

  const citedRules = trade.citedForgeRules || trade.citedRules || [];
  const reasoning = (trade.message || '').trim();
  const actionLabel = ACTION_LABELS[trade.action] || 'Trade';

  const symbolOutEl = (
    <span
      onClick={onSymbolClick && trade.symbolOut
        ? (e) => { e.stopPropagation(); onSymbolClick({ symbol: trade.symbolOut }); }
        : undefined}
      style={{
        color: tokens.red || '#ef4444',
        fontWeight: 700,
        cursor: onSymbolClick && trade.symbolOut ? 'pointer' : 'default',
        borderBottom: onSymbolClick && trade.symbolOut ? '1px dotted rgba(239,68,68,0.4)' : 'none',
      }}
    >
      {trade.symbolOut || '?'}
    </span>
  );

  const symbolInEl = (
    <span
      onClick={onSymbolClick && trade.symbolIn
        ? (e) => { e.stopPropagation(); onSymbolClick({ symbol: trade.symbolIn }); }
        : undefined}
      style={{
        color: tokens.teal || '#5EEAD4',
        fontWeight: 700,
        cursor: onSymbolClick && trade.symbolIn ? 'pointer' : 'default',
        borderBottom: onSymbolClick && trade.symbolIn ? '1px dotted rgba(94,234,212,0.4)' : 'none',
      }}
    >
      {trade.symbolIn || '?'}
    </span>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        alignSelf: 'stretch',
        maxWidth: '100%',
        margin: '4px 0 12px',
        padding: '10px 14px',
        background: tokens.bgCard || '#15171E',
        borderLeft: `3px solid ${tokens.teal || '#5EEAD4'}`,
        border: `1px solid ${tokens.borderDefault || 'rgba(255,255,255,0.05)'}`,
        borderLeftWidth: 3,
        borderRadius: '0 10px 10px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {/* Header row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
      }}>
        <span style={{
          padding: '2px 7px',
          borderRadius: 6,
          background: tierStyle.bg,
          color: tierStyle.color,
          fontSize: 9,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          {tierStyle.label}
        </span>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: tokens.textFaint || '#6B7280',
        }}>
          {actionLabel}
        </span>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 13,
          color: tokens.textPrimary || '#e2e8f0',
        }}>
          {symbolOutEl}
          <span style={{ color: tokens.textFaint || '#6B7280', fontSize: 12 }}>→</span>
          {symbolInEl}
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 10.5,
          color: tokens.textFaint || '#6B7280',
          whiteSpace: 'nowrap',
        }}>
          {formatTimestamp(trade.timestamp)}
        </span>
      </div>

      {/* Reasoning */}
      {reasoning && (
        <p style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.5,
          color: tokens.textSecondary || '#d1d5db',
        }}>
          {reasoning}
        </p>
      )}

      {/* P&L row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 11.5,
      }}>
        {pnlAvailable ? (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            color: pnlColor,
            fontWeight: 700,
          }}>
            {PnlIcon && <PnlIcon size={12} />}
            {`${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`}
          </span>
        ) : (
          <span style={{
            color: tokens.textFaint || '#6B7280',
            fontStyle: 'italic',
          }}>
            {hasExit ? '—' : 'Open position'}
          </span>
        )}
        {typeof trade.lockedPoints === 'number' && Number.isFinite(trade.lockedPoints) && (
          <span style={{ color: tokens.textMuted || '#94a3b8' }}>
            Banked {trade.lockedPoints.toFixed(1)} pts
          </span>
        )}
        {trade.regime && (
          <span style={{ color: tokens.textFaint || '#6B7280' }}>
            · {trade.regime}
          </span>
        )}
      </div>

      {/* Forge citation pills */}
      {citedRules.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
          {citedRules.map((rule, i) => (
            <button
              key={`${rule}-${i}`}
              onClick={(e) => { e.stopPropagation(); onCitationTap?.(rule); }}
              style={{
                padding: '2px 7px',
                borderRadius: 6,
                border: `1px solid ${tokens.borderTeal || 'rgba(94,234,212,0.25)'}`,
                background: 'rgba(94,234,212,0.08)',
                color: tokens.teal || '#5EEAD4',
                fontSize: 9.5,
                fontWeight: 600,
                cursor: onCitationTap ? 'pointer' : 'default',
                fontFamily: 'inherit',
                letterSpacing: '0.03em',
              }}
            >
              {rule}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default TradeTickerCard;
