// src/components/Season/SeasonScoreHeader.jsx
//
// Hero card at the top of the Season Dashboard Overview tab.
// Shows animated alpha, a 3-stat grid (return / S&P / rank), and a
// week/day progress bar. Pure presentational — all data is passed in.
//
// Props:
//   entry              - seasonEntries document (alphaVsSpy, totalReturn, ...)
//   season             - seasons document (weeks, tradingCalendar, benchmark, ...)
//   rank               - number | null — user's rank from leaderboard doc
//   totalParticipants  - number | null — total active entries
//
// When the user has no dailySnapshots yet (pre-Day-1), the 3 stat values
// render "—" but the progress context still shows so the user knows where
// they are in the season calendar.

import React, { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';

const TROPHY_GOLD = '#F0C75E';
const POSITIVE = '#34D399';
const NEGATIVE = '#EF4444';

// ─── Animated percentage display ─────────────────────────────
// Uses framer-motion's useSpring + useTransform so the value counts up
// from 0 → target smoothly on mount and on subsequent changes.
function AnimatedPct({ value, color, fontSize = 36, fontWeight = 800 }) {
  const spring = useSpring(0, { stiffness: 80, damping: 20 });

  useEffect(() => {
    spring.set(typeof value === 'number' && Number.isFinite(value) ? value : 0);
  }, [value, spring]);

  const display = useTransform(spring, (v) => {
    // Round to 0.1% so the DOM text doesn't churn at 60fps with long decimals
    const rounded = Math.round(v * 10) / 10;
    return `${rounded >= 0 ? '+' : ''}${rounded.toFixed(1)}%`;
  });

  return (
    <motion.span style={{ color, fontSize, fontWeight, lineHeight: 1 }}>
      {display}
    </motion.span>
  );
}

function StatCell({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color,
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          color: HOLO_COLORS.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function formatPct(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export default function SeasonScoreHeader({ entry, season, rank, totalParticipants }) {
  // ─── Derive values from confirmed schemas ──────────────────
  const snapshots = Array.isArray(entry?.dailySnapshots) ? entry.dailySnapshots : [];
  const hasSnapshots = snapshots.length > 0;

  const alpha = entry?.seasonState?.alphaVsSpy ?? 0;
  const totalReturn = entry?.portfolio?.totalReturn ?? 0;

  const lastSnapshot = snapshots[snapshots.length - 1];
  const spyReturn =
    lastSnapshot?.spyReturn ?? season?.benchmark?.spyReturn ?? 0;

  const week = entry?.seasonState?.currentWeek || season?.currentWeek || 1;
  const totalWeeks = Array.isArray(season?.weeks) ? season.weeks.length : 4;

  const currentTradingDay =
    season?.currentTradingDay || entry?.seasonState?.currentTradingDay || 0;
  const totalTradingDays = Array.isArray(season?.tradingCalendar)
    ? season.tradingCalendar.length
    : 20;

  const progressPct =
    totalTradingDays > 0
      ? Math.max(0, Math.min(100, (currentTradingDay / totalTradingDays) * 100))
      : 0;

  const alphaColor = alpha >= 0 ? POSITIVE : NEGATIVE;
  const returnColor = totalReturn >= 0 ? POSITIVE : NEGATIVE;

  // Pre-Day-1 display: animated alpha still runs (to 0), but secondary stats
  // show "—" to make it clear no trading has happened yet.
  const returnDisplay = hasSnapshots ? formatPct(totalReturn) : '—';
  const spyDisplay = hasSnapshots ? formatPct(spyReturn) : '—';
  const rankDisplay = rank
    ? `#${rank}${totalParticipants ? ` of ${totalParticipants}` : ''}`
    : '—';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        background: HOLO_COLORS.bgElevated,
        border: `1px solid ${HOLO_COLORS.borderSubtle}`,
        borderTop: `3px solid ${TROPHY_GOLD}`,
        borderRadius: 16,
        padding: '20px 16px',
      }}
    >
      {/* ─── Big alpha number ─── */}
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <AnimatedPct value={alpha} color={alphaColor} />
      </div>
      <div
        style={{
          textAlign: 'center',
          fontSize: 11,
          color: HOLO_COLORS.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '1.5px',
          fontWeight: 600,
          marginBottom: 18,
        }}
      >
        Alpha
      </div>

      {/* ─── 3-stat grid ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          padding: '14px 0',
          borderTop: `1px solid ${HOLO_COLORS.borderSubtle}`,
          borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
        }}
      >
        <StatCell
          label="Your Return"
          value={returnDisplay}
          color={hasSnapshots ? returnColor : HOLO_COLORS.textPrimary}
        />
        <StatCell
          label="S&P 500"
          value={spyDisplay}
          color={HOLO_COLORS.textPrimary}
        />
        <StatCell
          label="Rank"
          value={rankDisplay}
          color={rank ? TROPHY_GOLD : HOLO_COLORS.textPrimary}
        />
      </div>

      {/* ─── Progress context ─── */}
      <div style={{ marginTop: 14 }}>
        <div
          style={{
            fontSize: 12,
            color: HOLO_COLORS.textSecondary,
            marginBottom: 8,
            textAlign: 'center',
          }}
        >
          Week {week} of {totalWeeks} • Day {currentTradingDay} of {totalTradingDays}
        </div>
        <div
          style={{
            height: 4,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{
              height: '100%',
              background: TROPHY_GOLD,
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}

SeasonScoreHeader.displayName = 'SeasonScoreHeader';
