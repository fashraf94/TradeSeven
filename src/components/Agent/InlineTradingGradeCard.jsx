// InlineTradingGradeCard - Compact one-row card for grading a trade in the chat
// timeline during review mode.
//
// Renders in the chat column after the post-market auto-debrief message so the
// user can walk through the day's trades and tag each with A/B/C/D/F. Writes
// flow through the parent's onGrade callback, which is wired to
// agentService.submitDailyGrades.
//
// Visual language distinguishes this from TradeTickerCard (teal, trade
// notifications) and eval cards: amber left accent + subtle amber wash
// reinforces the review-mode context.

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_STYLES = {
  star:    { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.14)', label: 'STAR' },
  core:    { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.14)', label: 'CORE' },
  support: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.14)', label: 'SUPPORT' },
};

// Color a grade pill uses when it is the selected grade. Ungraded pills are
// muted / outlined regardless of which letter they are.
const GRADE_COLORS = {
  A: '#10b981', // emerald
  B: '#10b981', // emerald
  C: '#f59e0b', // amber
  D: '#ef4444', // red
  F: '#ef4444', // red
};

const GRADES = ['A', 'B', 'C', 'D', 'F'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const computePnlPct = (entry, exit) => {
  const a = Number(entry);
  const b = Number(exit);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return ((b - a) / a) * 100;
};

// Add alpha to a 6-digit hex color. Used for the selected-pill background wash.
const hexToRgba = (hex, alpha) => {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// ─── Grade Pill ───────────────────────────────────────────────────────────────

function GradePill({ letter, isSelected, onClick, disabled }) {
  const [hovered, setHovered] = useState(false);
  const activeColor = GRADE_COLORS[letter];
  const muted = '#6B7280';

  const borderColor = isSelected
    ? activeColor
    : hovered
      ? 'rgba(255,255,255,0.35)'
      : 'rgba(255,255,255,0.15)';

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      style={{
        width: 28,
        height: 26,
        padding: 0,
        borderRadius: 6,
        border: `1px solid ${borderColor}`,
        background: isSelected ? hexToRgba(activeColor, 0.14) : 'transparent',
        color: isSelected ? activeColor : muted,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.02em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'inherit',
      }}
      aria-label={`Grade ${letter}`}
      aria-pressed={isSelected}
    >
      {letter}
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * @param {Object} props
 * @param {Object} props.trade          - Trade object (symbolOut, symbolIn, tier, prices, lockedGainPct, etc.)
 * @param {string|number} props.tradeId - Stable identifier the parent uses to key grades (typically tradeIndex)
 * @param {'A'|'B'|'C'|'D'|'F'|null} props.currentGrade - Pre-existing grade from battle.dailyGrades (null if ungraded)
 * @param {Function} props.onGrade      - (tradeId, grade) => void
 * @param {Object} [props.agentGrade]   - Optional: { grade, quote } from the Gemma debrief
 * @param {boolean} [props.disabled]    - Disables grade input (e.g., grading window closed)
 * @param {Object} [props.tokens]       - Design tokens (same pattern as TradeTickerCard)
 */
function InlineTradingGradeCard({
  trade,
  tradeId,
  currentGrade,
  onGrade,
  agentGrade,
  disabled,
  tokens = {},
}) {
  const [localGrade, setLocalGrade] = useState(currentGrade || null);

  if (!trade) return null;

  const amber = tokens.amber || '#f59e0b';
  const teal = tokens.teal || '#5EEAD4';
  const red = tokens.red || '#ef4444';
  const faint = tokens.textFaint || '#6B7280';
  const emerald = tokens.emerald || '#34d399';

  const tierKey = trade.tier || 'support';
  const tierStyle = TIER_STYLES[tierKey] || TIER_STYLES.support;

  // Prefer server-computed lockedGainPct; fall back to entry/exit calc.
  const pnlPct = Number.isFinite(Number(trade.lockedGainPct))
    ? Number(trade.lockedGainPct)
    : computePnlPct(trade.entryPrice, trade.exitPrice);
  const pnlAvailable = pnlPct != null;
  const pnlColor = !pnlAvailable
    ? faint
    : pnlPct >= 0
      ? emerald
      : red;

  const handlePick = (letter) => {
    if (disabled) return;
    // Optimistic update — assume the parent's write to Firestore will succeed.
    // If the parent wants to roll back on failure, it can re-render with a
    // different `currentGrade` prop (the local state is seeded from it on
    // initial mount, but a parent-controlled grade can still override visually
    // via `currentGrade` on future updates to the prop — see below).
    setLocalGrade(letter);
    if (typeof onGrade === 'function') {
      onGrade(tradeId, letter);
    }
  };

  // Keep local state in sync when the parent updates `currentGrade` (e.g.,
  // after a successful Firestore round-trip or a rollback).
  useEffect(() => {
    setLocalGrade(currentGrade || null);
  }, [currentGrade]);

  const selected = localGrade;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        alignSelf: 'stretch',
        margin: '6px 0',
        padding: '10px 12px',
        background: 'rgba(245, 158, 11, 0.04)',
        borderLeft: `2px solid ${amber}`,
        borderTop: '1px solid rgba(255,255,255,0.04)',
        borderRight: '1px solid rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        borderRadius: '0 8px 8px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontSize: 12.5,
      }}
    >
      {/* ── Top row: trade summary (left) + grade pills (right) ───────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minWidth: 0,
      }}>
        {/* Trade summary */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 0,
          flex: 1,
          flexWrap: 'wrap',
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
          }}>
            <span style={{ color: red, fontWeight: 700 }}>
              {trade.symbolOut || '?'}
            </span>
            <span style={{ color: faint, fontSize: 11 }}>→</span>
            <span style={{ color: teal, fontWeight: 700 }}>
              {trade.symbolIn || '?'}
            </span>
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
        </div>

        {/* Grade pills */}
        <div style={{
          display: 'inline-flex',
          gap: 4,
          flexShrink: 0,
        }}>
          {GRADES.map((letter) => (
            <GradePill
              key={letter}
              letter={letter}
              isSelected={selected === letter}
              onClick={() => handlePick(letter)}
              disabled={disabled}
            />
          ))}
        </div>
      </div>

      {/* ── Optional bottom row: agent's suggested grade ───────────────── */}
      {agentGrade && agentGrade.grade ? (
        <div style={{
          fontSize: 12,
          color: faint,
          lineHeight: 1.4,
          paddingLeft: 2,
        }}>
          <span style={{ color: faint }}>Agent grade: </span>
          <span style={{
            color: GRADE_COLORS[agentGrade.grade] || faint,
            fontWeight: 700,
          }}>
            {agentGrade.grade}
          </span>
          {agentGrade.quote ? (
            <span style={{ color: faint }}> — “{agentGrade.quote}”</span>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  );
}

export default InlineTradingGradeCard;
