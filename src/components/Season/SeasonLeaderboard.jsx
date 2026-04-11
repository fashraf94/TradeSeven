// src/components/Season/SeasonLeaderboard.jsx
//
// Season Leaderboard — the Leaderboard tab content in SeasonDashboard.
// Phase C-5a: replaces the placeholder with a sortable ranking list
// backed by the seasonLeaderboard/{seasonId} doc that the parent self-loads.
//
// Props:
//   leaderboard     - seasonLeaderboard document ({ rankings, stats, ... }) or null
//   currentEntryId  - string - the viewing user's seasonEntry id (for row highlight)
//
// Value units (verified against seasonSettlement.js:394, seasonLeaderboard.js:271,
// and SeasonScoreHeader.jsx:78): alpha, totalReturn, maxDrawdown, weeklyAlpha,
// and all stats percentages are stored as RAW PERCENTAGES (e.g. 2.34 means
// 2.34%), not decimals. Never multiply by 100 here.
//
// Competitive edge: rule NAMES and IDs are never rendered — only rule count.

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';

const TEAL = '#5EEAD4';
const GOLD = '#F0C75E';
const POSITIVE = '#34D399';
const NEGATIVE = '#EF4444';
const MUTED = '#8B949E';

const SORT_OPTIONS = [
  { key: 'alpha', label: 'Alpha' },
  { key: 'safest', label: 'Safest' },
  { key: 'totalReturn', label: 'Total Return' },
];

// ─── Formatting helpers ─────────────────────────────────────────

function formatPct(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function pctColor(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return HOLO_COLORS.textPrimary;
  return n >= 0 ? POSITIVE : NEGATIVE;
}

// ─── Stats bar ──────────────────────────────────────────────────

function StatsBar({ stats }) {
  if (!stats) return null;
  const {
    beatingMarket = 0,
    participantCount = 0,
    avgAlpha,
    bestAlpha,
    spyReturn,
  } = stats;

  const Pill = ({ label, value, color }) => (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color: color || HOLO_COLORS.textPrimary }}>
        {value}
      </span>
    </span>
  );

  return (
    <div
      style={{
        padding: '12px 16px',
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${HOLO_COLORS.borderSubtle}`,
        borderRadius: 10,
        marginBottom: 12,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        alignItems: 'center',
      }}
    >
      <span style={{ fontSize: 13, color: HOLO_COLORS.textPrimary }}>
        <span style={{ color: POSITIVE, fontWeight: 700 }}>{beatingMarket}</span>
        <span style={{ color: MUTED }}> of </span>
        <span style={{ fontWeight: 700 }}>{participantCount}</span>
        <span style={{ color: MUTED }}> beating the market</span>
      </span>
      <Pill label="Avg" value={formatPct(avgAlpha)} color={pctColor(avgAlpha)} />
      <Pill label="Best" value={formatPct(bestAlpha)} color={pctColor(bestAlpha)} />
      <Pill label="S&P" value={formatPct(spyReturn)} color={HOLO_COLORS.textPrimary} />
    </div>
  );
}

// ─── Sort pills ────────────────────────────────────────────────

function SortPills({ sortBy, setSortBy }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
      {SORT_OPTIONS.map((opt) => {
        const isActive = sortBy === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              background: isActive ? 'rgba(94,234,212,0.1)' : 'transparent',
              color: isActive ? TEAL : MUTED,
              border: isActive
                ? '1px solid rgba(94,234,212,0.3)'
                : `1px solid ${HOLO_COLORS.borderSubtle}`,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Rank movement arrow ───────────────────────────────────────

function RankMovement({ current, previous }) {
  if (previous == null || current === previous) {
    return <span style={{ color: MUTED, fontSize: 12 }}>—</span>;
  }
  const improved = current < previous; // lower rank number = better
  const diff = Math.abs(current - previous);
  return (
    <motion.span
      key={`${previous}-${current}`}
      initial={{ y: improved ? -5 : 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{
        color: improved ? POSITIVE : NEGATIVE,
        fontSize: 12,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      {improved ? '↑' : '↓'}
      {diff}
    </motion.span>
  );
}

// ─── Expanded detail drawer ────────────────────────────────────

function ExpandedDetails({ row }) {
  const weekly = Array.isArray(row.weeklyAlpha) ? row.weeklyAlpha : [];
  return (
    <div
      style={{
        padding: '12px 16px',
        margin: '2px 0 6px 0',
        background: 'rgba(0,0,0,0.25)',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <DetailRow
        label="Trading Style"
        value={row.tradingStyle || 'Unspecified'}
      />
      <DetailRow
        label="Rules"
        value={row.ruleCount != null ? String(row.ruleCount) : '—'}
      />
      <DetailRow
        label="Max Drawdown"
        value={formatPct(row.maxDrawdown)}
        valueColor={
          typeof row.maxDrawdown === 'number' && row.maxDrawdown < 0
            ? NEGATIVE
            : HOLO_COLORS.textPrimary
        }
      />
      <div>
        <div style={detailLabelStyle}>Weekly Alpha</div>
        {weekly.length === 0 ? (
          <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
            No weekly data yet
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 4,
            }}
          >
            {weekly.map((w, i) => (
              <span
                key={i}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: pctColor(w),
                }}
              >
                W{i + 1} {formatPct(w)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const detailLabelStyle = {
  fontSize: 10,
  fontWeight: 700,
  color: MUTED,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

function DetailRow({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <span style={detailLabelStyle}>{label}</span>
      <span
        style={{
          fontSize: 13,
          color: valueColor || HOLO_COLORS.textPrimary,
          fontWeight: 600,
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Ranking row ───────────────────────────────────────────────

function RankingRow({ row, isOwn, isExpanded, onToggle }) {
  const rankColor = row.rank <= 3 ? GOLD : HOLO_COLORS.textPrimary;

  return (
    <div>
      <div
        onClick={isOwn ? undefined : () => onToggle(row.entryId)}
        role={isOwn ? undefined : 'button'}
        tabIndex={isOwn ? undefined : 0}
        onKeyDown={
          isOwn
            ? undefined
            : (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggle(row.entryId);
                }
              }
        }
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          borderLeft: isOwn ? `3px solid ${TEAL}` : '3px solid transparent',
          background: isOwn ? 'rgba(94,234,212,0.08)' : HOLO_COLORS.bgElevated,
          borderRadius: 8,
          marginBottom: 6,
          cursor: isOwn ? 'default' : 'pointer',
          transition: 'background 0.15s',
        }}
      >
        {/* Rank number */}
        <div
          style={{
            width: 36,
            fontSize: 16,
            fontWeight: 700,
            color: rankColor,
            flexShrink: 0,
          }}
        >
          #{row.rank}
        </div>

        {/* Rank movement */}
        <div
          style={{
            width: 28,
            display: 'flex',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <RankMovement current={row.rank} previous={row.previousRank} />
        </div>

        {/* Name + style/rules */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: HOLO_COLORS.textPrimary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {row.displayName || row.displayId || 'Unknown'}
            {isOwn && (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 10,
                  fontWeight: 700,
                  color: TEAL,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                You
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
            {row.tradingStyle || 'No style'}
            {row.ruleCount != null ? ` · ${row.ruleCount} rules` : ''}
          </div>
        </div>

        {/* Alpha value */}
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: pctColor(row.alpha),
            textAlign: 'right',
            flexShrink: 0,
          }}
        >
          {formatPct(row.alpha)}
        </div>
      </div>

      {/* Expandable drawer — never for own row */}
      <AnimatePresence initial={false}>
        {isExpanded && !isOwn && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <ExpandedDetails row={row} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────

export default function SeasonLeaderboard({ leaderboard, currentEntryId }) {
  const [sortBy, setSortBy] = useState('alpha');
  const [expandedEntryId, setExpandedEntryId] = useState(null);

  const sortedRows = useMemo(() => {
    const rankings = leaderboard?.rankings;
    if (!Array.isArray(rankings) || rankings.length === 0) return [];

    const copy = rankings.slice();
    const byRank = (a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity);

    switch (sortBy) {
      case 'safest':
        // maxDrawdown is stored as a negative percentage; closer to 0 = safer.
        // Sort descending so the least-bad drawdown is first.
        copy.sort((a, b) => {
          const av = typeof a.maxDrawdown === 'number' ? a.maxDrawdown : -Infinity;
          const bv = typeof b.maxDrawdown === 'number' ? b.maxDrawdown : -Infinity;
          if (bv !== av) return bv - av;
          return byRank(a, b);
        });
        break;
      case 'totalReturn':
        copy.sort((a, b) => {
          const av = typeof a.totalReturn === 'number' ? a.totalReturn : -Infinity;
          const bv = typeof b.totalReturn === 'number' ? b.totalReturn : -Infinity;
          if (bv !== av) return bv - av;
          return byRank(a, b);
        });
        break;
      case 'alpha':
      default:
        copy.sort((a, b) => {
          const av = typeof a.alpha === 'number' ? a.alpha : -Infinity;
          const bv = typeof b.alpha === 'number' ? b.alpha : -Infinity;
          if (bv !== av) return bv - av;
          return byRank(a, b);
        });
        break;
    }

    return copy;
  }, [leaderboard?.rankings, sortBy]);

  const handleToggle = (entryId) => {
    setExpandedEntryId((prev) => (prev === entryId ? null : entryId));
  };

  // Empty state: no doc yet, or no rankings
  if (!leaderboard || !Array.isArray(leaderboard.rankings) || leaderboard.rankings.length === 0) {
    return (
      <div
        style={{
          padding: '40px 16px',
          textAlign: 'center',
          color: MUTED,
          fontSize: 13,
        }}
      >
        Leaderboard will appear after Day 1 evaluations.
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <StatsBar stats={leaderboard.stats} />
      <SortPills sortBy={sortBy} setSortBy={setSortBy} />
      <div>
        {sortedRows.map((row) => {
          const isOwn = row.entryId === currentEntryId;
          return (
            <RankingRow
              key={row.entryId}
              row={row}
              isOwn={isOwn}
              isExpanded={expandedEntryId === row.entryId}
              onToggle={handleToggle}
            />
          );
        })}
      </div>
    </div>
  );
}
