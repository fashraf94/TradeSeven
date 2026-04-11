// src/components/Season/SeasonActivityFeed.jsx
//
// Activity feed for the Season Dashboard Overview tab. Shows trade
// actions (BUY/SELL/TRIM/ADD/REDUCE) grouped by trading day. The most
// recent day is expanded by default; older days collapse to a one-line
// summary pill (trade count + daily alpha) that can be tapped to expand.
//
// Schemas (confirmed from api/_utils/seasonSettlement.js):
//   recentActivity[] — capped at 10, newest first:
//     { day, date, type, ticker, reason, timestamp, ...type-specific }
//     SELL: rules, returnAtAction, soldPrice
//     BUY : rules, entryPrice, weight
//     ADD : rules, sharesBought
//     TRIM/REDUCE: rules, sharesSold
//
//   dailySnapshots[] — one per trading day:
//     { day, date, tradesExecuted, dailyAlpha, ... }
//
// Props:
//   recentActivity   - array from entry.recentActivity
//   dailySnapshots   - array from entry.dailySnapshots
//   onLoadDayDetail  - optional (day) => void CTA callback; wired to the
//                      Day-by-Day tab for now.

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  ChevronDown,
} from 'lucide-react';
import { HOLO_COLORS } from '../../constants/holoTheme';

const POSITIVE = '#34D399';
const NEGATIVE = '#EF4444';
const PURPLE = '#8B5CF6';

const TYPE_CONFIG = {
  SELL:   { Icon: TrendingDown, color: NEGATIVE, label: 'SELL'   },
  BUY:    { Icon: TrendingUp,   color: POSITIVE, label: 'BUY'    },
  ADD:    { Icon: Plus,         color: POSITIVE, label: 'ADD'    },
  TRIM:   { Icon: Minus,        color: PURPLE,   label: 'TRIM'   },
  REDUCE: { Icon: Minus,        color: PURPLE,   label: 'REDUCE' },
};

// ─── Formatters ─────────────────────────────────────────────

function formatPct(value, withSign = true) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const prefix = withSign && value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
}

function formatPrice(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `$${value.toFixed(2)}`;
}

function formatShares(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toLocaleString();
}

function pluralizeTrades(n) {
  if (n === 0) return 'No trades';
  if (n === 1) return '1 trade';
  return `${n} trades`;
}

// ─── Building blocks ────────────────────────────────────────

function RuleChip({ rule }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 10,
        fontWeight: 600,
        color: HOLO_COLORS.textSecondary,
        padding: '2px 6px',
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${HOLO_COLORS.borderSubtle}`,
        borderRadius: 4,
        letterSpacing: '0.3px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      {rule}
    </span>
  );
}

function TradeCard({ trade }) {
  const config = TYPE_CONFIG[trade.type] || TYPE_CONFIG.SELL;
  const { Icon, color, label } = config;

  let keyStat = null;
  if (trade.type === 'SELL') {
    const returnColor =
      typeof trade.returnAtAction === 'number' && trade.returnAtAction >= 0
        ? POSITIVE
        : NEGATIVE;
    keyStat = (
      <>
        <span>
          Return:{' '}
          <span style={{ color: returnColor, fontWeight: 600 }}>
            {formatPct(trade.returnAtAction)}
          </span>
        </span>
        {Number.isFinite(trade.soldPrice) && (
          <>
            <span style={{ color: HOLO_COLORS.textMuted }}> • </span>
            <span>Sold @ {formatPrice(trade.soldPrice)}</span>
          </>
        )}
      </>
    );
  } else if (trade.type === 'BUY') {
    keyStat = (
      <>
        {Number.isFinite(trade.entryPrice) && (
          <span>Entry @ {formatPrice(trade.entryPrice)}</span>
        )}
        {Number.isFinite(trade.weight) && (
          <>
            <span style={{ color: HOLO_COLORS.textMuted }}> • </span>
            <span>
              Weight{' '}
              <span style={{ color: HOLO_COLORS.textPrimary, fontWeight: 600 }}>
                {trade.weight.toFixed(1)}%
              </span>
            </span>
          </>
        )}
      </>
    );
  } else if (trade.type === 'TRIM' || trade.type === 'REDUCE') {
    keyStat = <span>Sold {formatShares(trade.sharesSold)} shares</span>;
  } else if (trade.type === 'ADD') {
    keyStat = <span>Bought {formatShares(trade.sharesBought)} shares</span>;
  }

  const rules = Array.isArray(trade.rules) ? trade.rules.filter(Boolean) : [];

  return (
    <motion.div
      initial={{ y: 8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{
        padding: '12px 14px',
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${HOLO_COLORS.borderSubtle}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 10,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      {/* Icon badge */}
      <div
        style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: 8,
          background: `${color}1A`, // ~10% alpha
          border: `1px solid ${color}4D`, // ~30% alpha
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color,
        }}
      >
        <Icon size={16} strokeWidth={2.5} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color,
            letterSpacing: '0.3px',
            marginBottom: 2,
          }}
        >
          {label}{' '}
          <span style={{ color: HOLO_COLORS.textPrimary }}>{trade.ticker}</span>
        </div>

        {trade.reason && (
          <div
            style={{
              fontSize: 12,
              color: HOLO_COLORS.textSecondary,
              lineHeight: 1.5,
              marginBottom: 6,
            }}
          >
            {trade.reason.length > 160
              ? `${trade.reason.slice(0, 160)}…`
              : trade.reason}
          </div>
        )}

        {keyStat && (
          <div
            style={{
              fontSize: 12,
              color: HOLO_COLORS.textSecondary,
              marginBottom: rules.length > 0 ? 8 : 0,
            }}
          >
            {keyStat}
          </div>
        )}

        {rules.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: HOLO_COLORS.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
                marginRight: 2,
              }}
            >
              Rules:
            </span>
            {rules.map((r, i) => (
              <RuleChip key={`${r}-${i}`} rule={r} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function DaySummaryHeader({ day, tradesExecuted, dailyAlpha, expanded, onToggle }) {
  const alphaColor = dailyAlpha >= 0 ? POSITIVE : NEGATIVE;
  return (
    <button
      onClick={onToggle}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 14px',
        background: HOLO_COLORS.bgElevated,
        border: `1px solid ${HOLO_COLORS.borderSubtle}`,
        borderRadius: expanded ? '10px 10px 0 0' : 10,
        cursor: 'pointer',
        color: HOLO_COLORS.textPrimary,
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            color: HOLO_COLORS.textSecondary,
          }}
        >
          <ChevronDown size={16} strokeWidth={2.5} />
        </motion.div>
        <span style={{ fontSize: 13, fontWeight: 600, color: HOLO_COLORS.textPrimary }}>
          Day {day}
        </span>
        <span
          style={{
            fontSize: 12,
            color: HOLO_COLORS.textSecondary,
          }}
        >
          {pluralizeTrades(tradesExecuted)}
        </span>
      </div>
      <span style={{ fontSize: 12, color: alphaColor, fontWeight: 600 }}>
        {formatPct(dailyAlpha)} alpha
      </span>
    </button>
  );
}

function DayBlock({ dayEntry, expanded, onToggle, onLoadDayDetail }) {
  const { day, trades, tradesExecuted, dailyAlpha } = dayEntry;
  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{ marginBottom: 10 }}
    >
      <DaySummaryHeader
        day={day}
        tradesExecuted={tradesExecuted}
        dailyAlpha={dailyAlpha}
        expanded={expanded}
        onToggle={onToggle}
      />
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key={`day-${day}-body`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{
              overflow: 'hidden',
              background: HOLO_COLORS.bgElevated,
              border: `1px solid ${HOLO_COLORS.borderSubtle}`,
              borderTop: 'none',
              borderRadius: '0 0 10px 10px',
            }}
          >
            <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {trades.length > 0 ? (
                trades.map((t, i) => <TradeCard key={`${day}-${i}`} trade={t} />)
              ) : (
                <div
                  style={{
                    fontSize: 12,
                    color: HOLO_COLORS.textMuted,
                    textAlign: 'center',
                    padding: '10px 8px',
                    fontStyle: 'italic',
                  }}
                >
                  No trades — your algorithm evaluated but didn{"\u2019"}t act.
                </div>
              )}

              {onLoadDayDetail && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoadDayDetail(day);
                  }}
                  style={{
                    alignSelf: 'flex-end',
                    marginTop: 4,
                    padding: '6px 10px',
                    background: 'transparent',
                    border: 'none',
                    color: HOLO_COLORS.primary,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    letterSpacing: '0.3px',
                  }}
                >
                  View full evaluation detail →
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main component ─────────────────────────────────────────

export default function SeasonActivityFeed({
  recentActivity,
  dailySnapshots,
  onLoadDayDetail,
}) {
  // Group activity by day
  const activitiesByDay = useMemo(() => {
    const map = new Map();
    if (!Array.isArray(recentActivity)) return map;
    for (const item of recentActivity) {
      if (!item || typeof item.day !== 'number') continue;
      if (!map.has(item.day)) map.set(item.day, []);
      map.get(item.day).push(item);
    }
    return map;
  }, [recentActivity]);

  // Build days list (from snapshots), sorted newest first
  const days = useMemo(() => {
    const snaps = Array.isArray(dailySnapshots) ? dailySnapshots : [];
    return [...snaps]
      .filter((s) => typeof s?.day === 'number')
      .sort((a, b) => b.day - a.day)
      .map((snap) => ({
        day: snap.day,
        date: snap.date,
        trades: activitiesByDay.get(snap.day) || [],
        tradesExecuted: Number.isFinite(snap.tradesExecuted) ? snap.tradesExecuted : 0,
        dailyAlpha: Number.isFinite(snap.dailyAlpha) ? snap.dailyAlpha : 0,
      }));
  }, [dailySnapshots, activitiesByDay]);

  const mostRecentDay = days[0]?.day ?? null;
  const [expandedDays, setExpandedDays] = useState(() => {
    const set = new Set();
    if (mostRecentDay != null) set.add(mostRecentDay);
    return set;
  });

  const toggleDay = (day) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  // ─── Empty states ─────────────────────────────────────────
  const hasSnapshots = days.length > 0;
  const hasActivity =
    Array.isArray(recentActivity) && recentActivity.length > 0;

  if (!hasSnapshots && !hasActivity) {
    return (
      <ShellCard>
        <div
          style={{
            textAlign: 'center',
            padding: '20px 12px',
            color: HOLO_COLORS.textMuted,
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          No activity yet — your algorithm will start executing on Day 1.
        </div>
      </ShellCard>
    );
  }

  if (hasSnapshots && !hasActivity) {
    return (
      <ShellCard title="Recent Activity">
        <div
          style={{
            textAlign: 'center',
            padding: '16px 12px',
            color: HOLO_COLORS.textMuted,
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          No trades yet. Your algorithm is evaluating but hasn{"\u2019"}t
          triggered any actions.
        </div>
      </ShellCard>
    );
  }

  return (
    <ShellCard title="Recent Activity">
      {days.map((dayEntry) => (
        <DayBlock
          key={dayEntry.day}
          dayEntry={dayEntry}
          expanded={expandedDays.has(dayEntry.day)}
          onToggle={() => toggleDay(dayEntry.day)}
          onLoadDayDetail={onLoadDayDetail}
        />
      ))}
    </ShellCard>
  );
}

function ShellCard({ title, children }) {
  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{
        background: HOLO_COLORS.bgCard,
        border: `1px solid ${HOLO_COLORS.borderSubtle}`,
        borderRadius: 12,
        padding: '14px 12px 6px',
      }}
    >
      {title && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: HOLO_COLORS.textPrimary,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            padding: '0 4px 10px',
          }}
        >
          {title}
        </div>
      )}
      {children}
    </motion.div>
  );
}

SeasonActivityFeed.displayName = 'SeasonActivityFeed';
