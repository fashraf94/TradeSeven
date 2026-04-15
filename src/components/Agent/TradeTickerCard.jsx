// TradeTickerCard - Compact one-line trade notification for the chat timeline.
//
// Renders a single trade as a slim, tappable row (~36-40px tall). Full trade
// detail (reasoning, regime, citations, banked points) lives in the Game Tape.
//
// Tap anywhere on the row (except ticker symbols) -> onTradeClick(trade) which
// switches to the Game Tape tab for full detail.
// Tap a ticker symbol -> onSymbolClick({ symbol }) which opens the asset
// research modal. stopPropagation keeps the row-tap from firing.

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_STYLES = {
  star:    { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.14)', label: 'STAR' },
  core:    { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.14)', label: 'CORE' },
  support: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.14)', label: 'SUPPORT' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatTimestamp = (value) => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const computePnlPct = (entry, exit) => {
  const a = Number(entry);
  const b = Number(exit);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return ((b - a) / a) * 100;
};

// ─── Component ────────────────────────────────────────────────────────────────

function TradeTickerCard({ trade, tokens = {}, onSymbolClick, onTradeClick, isDirectiveLinked = false }) {
  if (!trade) return null;

  const tierKey = trade.tier || 'support';
  const tierStyle = TIER_STYLES[tierKey] || TIER_STYLES.support;

  // Prefer server-computed lockedGainPct when present; fall back to our own calc.
  const pnlPct = Number.isFinite(Number(trade.lockedGainPct))
    ? Number(trade.lockedGainPct)
    : computePnlPct(trade.entryPrice, trade.exitPrice);
  const pnlAvailable = pnlPct != null;
  const pnlColor = !pnlAvailable
    ? (tokens.textFaint || '#6B7280')
    : pnlPct >= 0
      ? (tokens.emerald || '#34d399')
      : (tokens.red || '#ef4444');

  const teal = tokens.teal || '#5EEAD4';
  const red = tokens.red || '#ef4444';
  const faint = tokens.textFaint || '#6B7280';

  const handleRowClick = onTradeClick ? () => onTradeClick(trade) : undefined;
  const clickable = !!onTradeClick;

  const symbolOutEl = (
    <span
      onClick={onSymbolClick && trade.symbolOut
        ? (e) => { e.stopPropagation(); onSymbolClick({ symbol: trade.symbolOut }); }
        : undefined}
      style={{
        color: red,
        fontWeight: 700,
        cursor: onSymbolClick && trade.symbolOut ? 'pointer' : 'inherit',
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
        color: teal,
        fontWeight: 700,
        cursor: onSymbolClick && trade.symbolIn ? 'pointer' : 'inherit',
        borderBottom: onSymbolClick && trade.symbolIn ? '1px dotted rgba(94,234,212,0.4)' : 'none',
      }}
    >
      {trade.symbolIn || '?'}
    </span>
  );

  return (
    <motion.div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={handleRowClick}
      onKeyDown={clickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(); }
      } : undefined}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        alignSelf: 'stretch',
        margin: '4px 0',
        padding: '8px 12px',
        minHeight: 36,
        background: 'rgba(94, 234, 212, 0.04)',
        borderLeft: `${isDirectiveLinked ? 3 : 2}px solid ${teal}`,
        borderRadius: '0 6px 6px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12.5,
        cursor: clickable ? 'pointer' : 'default',
      }}
    >
      <ArrowLeftRight size={13} color={teal} style={{ flexShrink: 0 }} />

      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
      }}>
        {symbolOutEl}
        <span style={{ color: faint, fontSize: 11 }}>→</span>
        {symbolInEl}
      </span>

      <span style={{ color: faint }}>·</span>

      <span style={{
        padding: '1px 6px',
        borderRadius: 4,
        background: tierStyle.bg,
        color: tierStyle.color,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.04em',
        flexShrink: 0,
      }}>
        {tierStyle.label}
      </span>

      <span style={{ color: faint }}>·</span>

      <span style={{
        color: pnlColor,
        fontWeight: 700,
        fontSize: 12.5,
        flexShrink: 0,
      }}>
        {pnlAvailable
          ? `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`
          : 'open'}
      </span>

      <span style={{
        marginLeft: 'auto',
        color: faint,
        fontSize: 10.5,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>
        {formatTimestamp(trade.timestamp)}
      </span>
    </motion.div>
  );
}

export default TradeTickerCard;
