// src/components/Season/SeasonPortfolioStrip.jsx
//
// Horizontal scroll strip of position pills for the Season Dashboard
// Overview tab. Each pill shows ticker, return since entry, and current
// weight. A final cash pill is always appended after the positions.
//
// Mirrors the scroll-container pattern in AgentPortfolioStrip.jsx so the
// mobile touch-scroll behaviour and hidden-scrollbar styling stays
// consistent across the app.
//
// Props:
//   positions      - object keyed by ticker (from entry.portfolio.positions).
//                    Each value has { currentWeight, returnSinceEntry, ... }.
//   cash           - number, unused for display but kept for API symmetry
//   cashPct        - percent of portfolio held in cash
//   onPositionTap  - optional (ticker) => void callback for pill taps

import React from 'react';
import { motion } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';

const POSITIVE = '#34D399';
const NEGATIVE = '#EF4444';
const PILL_BG = '#15171E';
const PILL_BORDER = 'rgba(255,255,255,0.06)';

function formatPct(value, withSign = true) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const prefix = withSign && value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
}

function PositionPill({ ticker, returnPct, weightPct, index, onTap }) {
  const color = returnPct >= 0 ? POSITIVE : NEGATIVE;
  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: 'easeOut' }}
      onClick={() => onTap && onTap(ticker)}
      role={onTap ? 'button' : undefined}
      tabIndex={onTap ? 0 : undefined}
      onKeyDown={(e) => {
        if (onTap && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onTap(ticker);
        }
      }}
      style={{
        flexShrink: 0,
        minWidth: 92,
        padding: '10px 12px',
        background: PILL_BG,
        border: `1px solid ${PILL_BORDER}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 10,
        cursor: onTap ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
        }}
      >
        {ticker}
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color,
          lineHeight: 1.2,
        }}
      >
        {formatPct(returnPct)}
      </div>
      <div
        style={{
          fontSize: 10,
          color: HOLO_COLORS.textMuted,
          lineHeight: 1.2,
        }}
      >
        {typeof weightPct === 'number' ? `${weightPct.toFixed(1)}% weight` : '—'}
      </div>
    </motion.div>
  );
}

function CashPill({ cashPct, index }) {
  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: 'easeOut' }}
      style={{
        flexShrink: 0,
        minWidth: 92,
        padding: '10px 12px',
        background: PILL_BG,
        border: `1px solid ${PILL_BORDER}`,
        borderLeft: `3px solid ${HOLO_COLORS.textMuted}`,
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 13,
          fontWeight: 700,
          color: HOLO_COLORS.textSecondary,
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
        }}
      >
        <DollarIcon />
        Cash
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: HOLO_COLORS.textMuted,
          lineHeight: 1.2,
        }}
      >
        {typeof cashPct === 'number' ? `${cashPct.toFixed(1)}%` : '—'}
      </div>
      <div
        style={{
          fontSize: 10,
          color: HOLO_COLORS.textMuted,
          lineHeight: 1.2,
        }}
      >
        reserve
      </div>
    </motion.div>
  );
}

function DollarIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

export default function SeasonPortfolioStrip({
  positions,
  cash, // eslint-disable-line no-unused-vars
  cashPct,
  onPositionTap,
}) {
  const positionList = Object.entries(positions || {})
    .filter(([, pos]) => pos && typeof pos === 'object')
    .map(([ticker, pos]) => ({
      ticker,
      returnPct: Number.isFinite(pos.returnSinceEntry) ? pos.returnSinceEntry : 0,
      weightPct: Number.isFinite(pos.currentWeight) ? pos.currentWeight : 0,
    }))
    .sort((a, b) => b.weightPct - a.weightPct);

  if (positionList.length === 0) {
    return (
      <div
        style={{
          background: HOLO_COLORS.bgElevated,
          border: `1px solid ${HOLO_COLORS.borderSubtle}`,
          borderRadius: 12,
          padding: '20px 16px',
          textAlign: 'center',
          color: HOLO_COLORS.textMuted,
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        Portfolio is empty — waiting for Day 1 construction.
      </div>
    );
  }

  return (
    <div>
      <div
        className="season-portfolio-strip"
        style={{
          display: 'flex',
          gap: 8,
          padding: '4px 2px 8px',
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {positionList.map((p, idx) => (
          <PositionPill
            key={p.ticker}
            ticker={p.ticker}
            returnPct={p.returnPct}
            weightPct={p.weightPct}
            index={idx}
            onTap={onPositionTap}
          />
        ))}
        <CashPill cashPct={cashPct} index={positionList.length} />
      </div>
      <style>{`.season-portfolio-strip::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}

SeasonPortfolioStrip.displayName = 'SeasonPortfolioStrip';
