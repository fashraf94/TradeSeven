// GameTapeView - Pure data reference view
// Shows: trade history, bookmarked entries, full activity log.
// Daily review (selfGrade, summary, lesson, proposed rules) lives in the
// Film Room screen (Voice Layer Phase 4).

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Clock,
  Layers,
} from 'lucide-react';
import AgentActivityFeed from './AgentActivityFeed';
import { addFeedBookmark, removeFeedBookmark } from '../../services/agentService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hexToRgba = (hex, alpha) => {
  if (!hex || hex.charAt(0) !== '#') return `rgba(150,150,150,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getEntryId = (entry, index) =>
  entry?.evalId || entry?.id || `${entry?.timestamp || ''}_${index}`;

const TIER_ORDER = { star: 0, core: 1, support: 2 };

const TIER_STYLES = {
  star:    { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)', label: 'Star' },
  core:    { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', label: 'Core' },
  support: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', label: 'Support' },
};

const toTime = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatTimestamp = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
};

const formatPrice = (n) =>
  typeof n === 'number' && Number.isFinite(n) ? `$${n.toFixed(2)}` : '—';

const formatPct = (n) =>
  typeof n === 'number' && Number.isFinite(n) ? `${n >= 0 ? '+' : ''}${n.toFixed(2)}%` : '—';

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, count, tokens }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '16px 16px 8px',
    }}>
      {Icon && <Icon size={14} color={tokens.purpleText || '#a78bfa'} />}
      <span style={{
        fontSize: 12,
        fontWeight: 700,
        color: tokens.textPrimary || '#e2e8f0',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {title}
      </span>
      {count != null && (
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: tokens.textFaint || '#64748b',
        }}>
          ({count})
        </span>
      )}
    </div>
  );
}

function EmptyBlock({ message, tokens }) {
  return (
    <div style={{
      padding: '20px 16px',
      margin: '0 12px',
      borderRadius: 12,
      background: tokens.bgCard || '#15171E',
      border: `1px dashed ${tokens.borderDefault || 'rgba(255,255,255,0.05)'}`,
      color: tokens.textFaint || '#64748b',
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 1.5,
    }}>
      {message}
    </div>
  );
}

// ─── Trade Row ────────────────────────────────────────────────────────────────

function TradeRow({ trade, tokens }) {
  const tierKey = trade?.tier || 'support';
  const tierStyle = TIER_STYLES[tierKey] || TIER_STYLES.support;

  const entryPrice = Number(trade?.entryPrice);
  const exitPrice = Number(trade?.exitPrice);
  const hasPnl = Number.isFinite(entryPrice) && Number.isFinite(exitPrice) && entryPrice !== 0;
  const pnlPct = hasPnl ? ((exitPrice - entryPrice) / entryPrice) * 100 : null;
  const pnlColor = pnlPct == null
    ? tokens.textFaint || '#64748b'
    : pnlPct >= 0
      ? tokens.emerald || '#34d399'
      : tokens.red || '#ef4444';
  const PnlIcon = pnlPct == null ? null : pnlPct >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: 10,
      background: tokens.bgCard || '#15171E',
      border: `1px solid ${tokens.borderDefault || 'rgba(255,255,255,0.05)'}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
          fontSize: 13,
          fontWeight: 700,
          color: tokens.textPrimary || '#e2e8f0',
        }}>
          {trade?.symbolOut || '—'}
        </span>
        <span style={{ color: tokens.textFaint || '#64748b', fontSize: 12 }}>→</span>
        <span style={{
          fontSize: 13,
          fontWeight: 700,
          color: tokens.teal || '#5eead4',
        }}>
          {trade?.symbolIn || '—'}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: pnlColor, fontSize: 12, fontWeight: 700 }}>
          {PnlIcon && <PnlIcon size={12} />}
          {formatPct(pnlPct)}
        </span>
      </div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        fontSize: 10.5,
        color: tokens.textMuted || '#94a3b8',
      }}>
        <span>Entry {formatPrice(entryPrice)}</span>
        <span>Exit {formatPrice(exitPrice)}</span>
        {typeof trade?.lockedPoints === 'number' && (
          <span>Banked {trade.lockedPoints.toFixed(1)} pts</span>
        )}
        {trade?.regime && <span style={{ color: tokens.textFaint || '#64748b' }}>· {trade.regime}</span>}
        {trade?.swappedOutAt && (
          <span style={{ marginLeft: 'auto', color: tokens.textFaint || '#64748b' }}>
            {formatTimestamp(trade.swappedOutAt)}
          </span>
        )}
      </div>

      {/* Phase 8: structured trade reasoning (only when Haiku populated it). */}
      {trade?.trade_reasoning && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
          paddingTop: 6,
          borderTop: `1px dashed ${tokens.borderDefault || 'rgba(255,255,255,0.05)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {trade.trade_reasoning.strategy && (
              <span style={{
                padding: '2px 7px',
                borderRadius: 6,
                background: 'rgba(94, 234, 212, 0.12)',
                color: tokens.teal || '#5eead4',
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                {trade.trade_reasoning.strategy}
              </span>
            )}
            {typeof trade.trade_reasoning.conviction === 'number' && (
              <span style={{ fontSize: 10.5, color: tokens.textFaint || '#64748b' }}>
                Conviction {Math.round(trade.trade_reasoning.conviction)}/100
              </span>
            )}
          </div>

          {trade.trade_reasoning.thesis && (
            <div style={{
              fontSize: 11.5,
              color: tokens.textPrimary || '#e2e8f0',
              lineHeight: 1.45,
            }}>
              {trade.trade_reasoning.thesis}
            </div>
          )}

          {Array.isArray(trade.trade_reasoning.indicators) && trade.trade_reasoning.indicators.length > 0 && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              fontSize: 10,
              color: tokens.textMuted || '#94a3b8',
            }}>
              {trade.trade_reasoning.indicators.map((indicator, i) => (
                <span key={i} style={{
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: tokens.bgMuted || 'rgba(255,255,255,0.03)',
                  border: `1px solid ${tokens.borderDefault || 'rgba(255,255,255,0.05)'}`,
                }}>
                  {indicator}
                </span>
              ))}
            </div>
          )}

          {Array.isArray(trade.trade_reasoning.citedRules) && trade.trade_reasoning.citedRules.length > 0 && (
            <div style={{ fontSize: 10, color: tokens.textFaint || '#64748b' }}>
              Rules: {trade.trade_reasoning.citedRules.join(' · ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Trade History Section ────────────────────────────────────────────────────

function TradeHistorySection({ trades, tokens }) {
  const [sortKey, setSortKey] = useState('time');

  const sorted = useMemo(() => {
    const list = Array.isArray(trades) ? [...trades] : [];
    const byTime = (a, b) =>
      toTime(b?.swappedOutAt) - toTime(a?.swappedOutAt)
      || (b?.swapDay ?? 0) - (a?.swapDay ?? 0)
      || String(a?.evalId || '').localeCompare(String(b?.evalId || ''));

    if (sortKey === 'pnl') {
      return list.sort((a, b) => {
        const ea = Number(a?.entryPrice), xa = Number(a?.exitPrice);
        const eb = Number(b?.entryPrice), xb = Number(b?.exitPrice);
        const pa = Number.isFinite(ea) && Number.isFinite(xa) && ea !== 0 ? (xa - ea) / ea : null;
        const pb = Number.isFinite(eb) && Number.isFinite(xb) && eb !== 0 ? (xb - eb) / eb : null;
        if (pa == null && pb == null) return byTime(a, b);
        if (pa == null) return 1;
        if (pb == null) return -1;
        return pb - pa;
      });
    }
    if (sortKey === 'tier') {
      return list.sort((a, b) => {
        const ta = TIER_ORDER[a?.tier] ?? 99;
        const tb = TIER_ORDER[b?.tier] ?? 99;
        return ta - tb || byTime(a, b);
      });
    }
    return list.sort(byTime);
  }, [trades, sortKey]);

  if (!sorted.length) {
    return (
      <EmptyBlock tokens={tokens} message="No completed trades yet." />
    );
  }

  const sortOptions = [
    { key: 'time', label: 'Time', icon: Clock },
    { key: 'pnl', label: 'P&L', icon: TrendingUp },
    { key: 'tier', label: 'Tier', icon: Layers },
  ];

  return (
    <div style={{
      margin: '0 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {sortOptions.map(opt => {
          const active = sortKey === opt.key;
          const Icon = opt.icon;
          return (
            <button
              key={opt.key}
              onClick={() => setSortKey(opt.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 10px',
                borderRadius: 8,
                border: `1px solid ${active
                  ? hexToRgba(tokens.teal || '#5eead4', 0.4)
                  : tokens.borderDefault || 'rgba(255,255,255,0.05)'}`,
                background: active
                  ? hexToRgba(tokens.teal || '#5eead4', 0.1)
                  : tokens.bgElevated || 'rgba(255,255,255,0.02)',
                color: active ? (tokens.teal || '#5eead4') : (tokens.textMuted || '#94a3b8'),
                fontSize: 10.5,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                letterSpacing: '0.03em',
              }}
            >
              <Icon size={11} />
              {opt.label}
            </button>
          );
        })}
      </div>
      {sorted.map((trade, i) => (
        <TradeRow
          key={trade?.evalId || `${trade?.symbolOut || 'x'}-${trade?.swapDay ?? i}-${i}`}
          trade={trade}
          tokens={tokens}
        />
      ))}
    </div>
  );
}

// ─── Bookmarked Entry Row ─────────────────────────────────────────────────────

function BookmarkedRow({ entry, onUnbookmark, onCitationTap, tokens }) {
  const entryId = getEntryId(entry, 0);
  const rules = entry?.citedForgeRules || entry?.citedRules || [];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24 }}
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
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: tokens.amber || '#f59e0b',
            marginBottom: 3,
          }}>
            {entry?.action || entry?.type || 'Update'}
            {entry?.symbolOut && entry?.symbolIn && (
              <span style={{ color: tokens.textMuted || '#94a3b8', marginLeft: 6 }}>
                {entry.symbolOut} → {entry.symbolIn}
              </span>
            )}
          </div>
          <p style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.5,
            color: tokens.textSecondary || '#cbd5e1',
          }}>
            {entry?.message || entry?.rationale || 'No details available'}
          </p>
          {entry?.timestamp && (
            <span style={{
              display: 'inline-block',
              marginTop: 4,
              fontSize: 10,
              color: tokens.textFaint || '#64748b',
            }}>
              {formatTimestamp(entry.timestamp)}
            </span>
          )}
        </div>
        <button
          onClick={() => onUnbookmark?.(entryId)}
          aria-label="Remove bookmark"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: tokens.teal || '#5eead4',
            flexShrink: 0,
          }}
        >
          <BookmarkCheck size={14} />
        </button>
      </div>
      {rules.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {rules.map((rule, i) => (
            <button
              key={`${rule}-${i}`}
              onClick={() => onCitationTap?.(rule)}
              style={{
                padding: '2px 7px',
                borderRadius: 6,
                border: `1px solid ${hexToRgba(tokens.purpleText || '#a78bfa', 0.3)}`,
                background: hexToRgba(tokens.purpleText || '#a78bfa', 0.08),
                color: tokens.purpleText || '#a78bfa',
                fontSize: 9.5,
                fontWeight: 600,
                cursor: 'pointer',
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

// ─── Main ─────────────────────────────────────────────────────────────────────

const GameTapeView = ({
  agentBattle,
  agentBattleId,
  statusFeed = [],
  feedBookmarks = [],
  tokens = {},
  onCitationTap,
}) => {
  const [showFullLog, setShowFullLog] = useState(false);

  const trades = agentBattle?.trades || [];

  // Resolve bookmarked entries from statusFeed (match on entry id)
  const bookmarkedEntries = useMemo(() => {
    if (!feedBookmarks?.length || !statusFeed?.length) return [];
    const bookmarkSet = new Set(feedBookmarks);
    const matched = [];
    statusFeed.forEach((entry, index) => {
      if (bookmarkSet.has(getEntryId(entry, index))) matched.push(entry);
    });
    return matched.reverse(); // newest first
  }, [feedBookmarks, statusFeed]);

  const handleAddBookmark = useCallback(async (entryId) => {
    if (!agentBattleId || !entryId) return;
    try {
      await addFeedBookmark(agentBattleId, entryId);
    } catch (err) {
      console.error('[GameTape] addFeedBookmark failed:', err?.message || err);
    }
  }, [agentBattleId]);

  const handleRemoveBookmark = useCallback(async (entryId) => {
    if (!agentBattleId || !entryId) return;
    try {
      await removeFeedBookmark(agentBattleId, entryId);
    } catch (err) {
      console.error('[GameTape] removeFeedBookmark failed:', err?.message || err);
    }
  }, [agentBattleId]);

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      paddingBottom: 24,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '16px 16px 2px',
      }}>
        <ClipboardList size={16} color={tokens.teal || '#5eead4'} />
        <span style={{
          fontSize: 13,
          fontWeight: 700,
          color: tokens.teal || '#5eead4',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          Game Tape
        </span>
      </div>
      <p style={{
        textAlign: 'center',
        fontSize: 11,
        color: tokens.textFaint || '#64748b',
        margin: '0 0 10px',
        padding: '0 16px',
      }}>
        Review today's action
      </p>

      {/* Trade History */}
      <SectionHeader
        title="Trade History"
        count={trades.length}
        tokens={tokens}
      />
      <TradeHistorySection trades={trades} tokens={tokens} />

      {/* Bookmarked Entries */}
      <SectionHeader
        icon={Bookmark}
        title="Bookmarked Entries"
        count={bookmarkedEntries.length}
        tokens={tokens}
      />
      {bookmarkedEntries.length === 0 ? (
        <EmptyBlock
          tokens={tokens}
          message="No bookmarks yet. Tap the bookmark icon on any feed entry to save it here."
        />
      ) : (
        <div style={{
          margin: '0 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <AnimatePresence>
            {bookmarkedEntries.map((entry, i) => (
              <BookmarkedRow
                key={getEntryId(entry, i)}
                entry={entry}
                onUnbookmark={handleRemoveBookmark}
                onCitationTap={onCitationTap}
                tokens={tokens}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Full Activity Log (collapsible, default collapsed) */}
      <div style={{ padding: '16px 16px 4px' }}>
        <button
          onClick={() => setShowFullLog(prev => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: tokens.textFaint || '#64748b',
            fontSize: 11,
            fontWeight: 600,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            fontFamily: 'inherit',
          }}
        >
          <FileText size={12} />
          <span>{showFullLog ? 'Hide' : 'View'} full activity log</span>
          <motion.span
            animate={{ rotate: showFullLog ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'inline-flex' }}
          >
            <ChevronDown size={12} />
          </motion.span>
        </button>
      </div>
      <AnimatePresence initial={false}>
        {showFullLog && (
          <motion.div
            key="full-log"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <AgentActivityFeed
              statusFeed={statusFeed}
              feedBookmarks={feedBookmarks}
              onBookmark={handleAddBookmark}
              onUnbookmark={handleRemoveBookmark}
              onChallenge={undefined}
              onCitationTap={onCitationTap}
              battleId={agentBattleId}
              tokens={tokens}
              readOnly={true}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GameTapeView;
