import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRightLeft, ShieldAlert, Lock, Trophy, AlertTriangle, Brain,
  Bookmark, BookmarkCheck, ChevronDown, ChevronUp, X, ArrowDown,
  MessageSquare, Eye, ClipboardList,
} from 'lucide-react';
import GameplanMeetingCard from './GameplanMeetingCard';

// ── Label Maps (mirrored from StatusFeedTimeline) ─────────────────────────────

const STRATEGY_LABELS = {
  volatility_squeeze: 'Squeeze',
  '52w_high_breakout': '52W High',
  rs_momentum: 'RS Mom',
  vwap_mean_reversion: 'VWAP MR',
  news_catalyst: 'News',
  bust_avoidance: 'Bust Guard',
  vwap_failure: 'VWAP Fail',
  threshold_lock: 'Locked',
};

const REGIME_LABELS = {
  directional_expansion: 'Expanding',
  directional_contraction: 'Contracting',
  choppy: 'Choppy',
  distressed: 'Distressed',
};

const REGIME_COLORS = {
  directional_expansion: '#34d399',
  directional_contraction: '#5eead4',
  choppy: '#94a3b8',
  distressed: '#ef4444',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const hexToRgba = (hex, alpha) => {
  if (!hex || hex.charAt(0) !== '#') return `rgba(100,100,100,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getEntryId = (entry, index) =>
  entry.evalId || entry.id || `${entry.timestamp || ''}_${index}`;

// ── Tier Classification ───────────────────────────────────────────────────────

const HIGH_TYPES = new Set([
  'trade_executed', 'trade_blocked', 'threshold_event', 'risk_alert',
  'gameplan_meeting', 'hypothesis_resolved', 'opponent_trade', 'opponent_threshold',
]);

const LOW_TYPES = new Set([
  'evaluation_summary', 'evaluation', 'hold', 'hold_decision', 'rule_override',
]);

const HIGH_ACTIONS = new Set([
  'swap', 'emergency_swap', 'swap_out', 'trail_stop', 'lock',
]);

const LOW_ACTIONS = new Set([
  'watchlist_refresh', 'catalyst_override',
]);

function getEntryTier(entry) {
  const type = entry.type;
  if (type && HIGH_TYPES.has(type)) return 'HIGH';
  if (type && LOW_TYPES.has(type)) {
    // Promote rule_override with Forge citations
    if (type === 'rule_override' && entry.citedForgeRules?.length > 0) return 'HIGH';
    // Promote any LOW with Forge citations
    if (entry.citedForgeRules?.length > 0) return 'HIGH';
    return 'LOW';
  }
  // Fallback to action field
  if (entry.action && HIGH_ACTIONS.has(entry.action)) return 'HIGH';
  if (entry.action === 'hold') return 'LOW';
  if (entry.action && LOW_ACTIONS.has(entry.action)) return 'LOW';
  // Default: if it has a message but no recognized type/action, treat as LOW
  if (!entry.action && !type) return 'LOW';
  return 'HIGH';
}

// ── Entry Config (color, icon, label) ─────────────────────────────────────────

function getEntryConfig(entry, tokens) {
  const type = entry.type;
  const action = entry.action;

  // Type-based config (preferred)
  if (type) {
    switch (type) {
      case 'trade_executed':
        return { color: tokens.teal || '#5eead4', icon: ArrowRightLeft, label: 'Trade' };
      case 'trade_blocked':
        return { color: tokens.amber || '#f59e0b', icon: ShieldAlert, label: 'Blocked' };
      case 'threshold_event':
        return { color: '#eab308', icon: Trophy, label: 'Threshold' };
      case 'risk_alert':
        return { color: tokens.red || '#ef4444', icon: AlertTriangle, label: 'Risk Alert' };
      case 'gameplan_meeting':
        return { color: tokens.amber || '#f59e0b', icon: ClipboardList, label: 'Gameplan' };
      case 'hypothesis_resolved':
        return {
          color: entry.confirmed ? (tokens.emerald || '#34d399') : (tokens.red || '#ef4444'),
          icon: Brain,
          label: 'Hypothesis',
        };
      case 'opponent_trade':
        return { color: tokens.textMuted || '#6e7681', icon: ArrowRightLeft, label: 'Opponent Trade' };
      case 'opponent_threshold':
        return { color: '#b8860b', icon: Trophy, label: 'Opponent Threshold' };
      case 'evaluation_summary':
      case 'evaluation':
        return { color: tokens.textMuted || '#6e7681', icon: Eye, label: 'Evaluation' };
      case 'hold':
      case 'hold_decision':
        return { color: tokens.textMuted || '#6e7681', icon: MessageSquare, label: 'Hold' };
      case 'rule_override':
        return { color: tokens.amber || '#f59e0b', icon: ShieldAlert, label: 'Override' };
      default:
        break;
    }
  }

  // Action-based fallback
  switch (action) {
    case 'swap':
      return { color: tokens.teal || '#5eead4', icon: ArrowRightLeft, label: 'Trade' };
    case 'emergency_swap':
      return { color: tokens.amber || '#f59e0b', icon: ShieldAlert, label: 'Emergency' };
    case 'swap_out':
      return { color: tokens.amber || '#f59e0b', icon: ShieldAlert, label: 'Risk Exit' };
    case 'trail_stop':
      return { color: tokens.amber || '#f59e0b', icon: ShieldAlert, label: 'Trail Stop' };
    case 'lock':
      return { color: '#eab308', icon: Lock, label: 'Locked' };
    case 'hold':
      return { color: tokens.textMuted || '#6e7681', icon: MessageSquare, label: 'Hold' };
    default:
      return { color: tokens.textMuted || '#6e7681', icon: MessageSquare, label: 'Update' };
  }
}

const isTradeEntry = (entry) =>
  ['trade_executed', 'trade_blocked'].includes(entry.type) ||
  ['swap', 'emergency_swap', 'swap_out', 'trail_stop'].includes(entry.action);

// ── Ticker Filter ─────────────────────────────────────────────────────────────

function matchesTicker(entry, ticker) {
  if (!ticker) return true;
  const t = ticker.toUpperCase();
  if (entry.action?.ticker?.toUpperCase() === t) return true;
  if (entry.symbolOut?.toUpperCase() === t) return true;
  if (entry.symbolIn?.toUpperCase() === t) return true;
  if (entry.message?.toUpperCase().includes(t)) return true;
  return false;
}

// ── Semantic Grouping ─────────────────────────────────────────────────────────

function buildGroupedFeed(entries, filterTicker) {
  const filtered = filterTicker
    ? entries.filter(e => matchesTicker(e, filterTicker))
    : entries;

  const result = [];
  let lowGroup = [];

  const flushLowGroup = () => {
    if (lowGroup.length === 0) return;
    const first = lowGroup[0];
    const last = lowGroup[lowGroup.length - 1];
    result.push({
      kind: 'group',
      entries: [...lowGroup],
      count: lowGroup.length,
      timeRange: {
        start: last.timestamp,
        end: first.timestamp,
      },
    });
    lowGroup = [];
  };

  for (const entry of filtered) {
    const tier = getEntryTier(entry);
    if (tier === 'HIGH') {
      flushLowGroup();
      result.push({ kind: 'high', entry });
    } else {
      lowGroup.push(entry);
    }
  }
  flushLowGroup();

  return result;
}

// ── Animation Variants ────────────────────────────────────────────────────────

const entryVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const groupExpandVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: { opacity: 1, height: 'auto', transition: { type: 'spring', stiffness: 300, damping: 28 } },
  exit: { opacity: 0, height: 0, transition: { duration: 0.2 } },
};

// ── Forge Payoff Shimmer ──────────────────────────────────────────────────────

const shimmerKeyframes = {
  backgroundPosition: ['200% 0', '-200% 0'],
};

const ForgePayoffBadge = ({ ruleName, pointsSaved }) => (
  <motion.div
    animate={shimmerKeyframes}
    transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 10px',
      borderRadius: 10,
      fontSize: 10,
      fontWeight: 700,
      color: '#ffd700',
      background: 'linear-gradient(90deg, transparent 0%, rgba(255,215,0,0.15) 25%, rgba(255,215,0,0.3) 50%, rgba(255,215,0,0.15) 75%, transparent 100%)',
      backgroundSize: '200% 100%',
      border: '1px solid rgba(255,215,0,0.3)',
    }}
  >
    {ruleName ? `Rule ${ruleName}` : 'Forge Rule'} saved {pointsSaved != null ? `${pointsSaved} pts` : 'pts'}!
  </motion.div>
);

// ── Pill Badge ────────────────────────────────────────────────────────────────

const Pill = ({ label, color, onClick }) => (
  <span
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 10,
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.3px',
      color: color,
      background: hexToRgba(color, 0.12),
      border: `1px solid ${hexToRgba(color, 0.2)}`,
      whiteSpace: 'nowrap',
      cursor: onClick ? 'pointer' : 'default',
    }}
  >
    {label}
  </span>
);

// ── HIGH-Tier Entry Card ──────────────────────────────────────────────────────

const HighTierCard = ({
  entry, entryId, tokens, feedBookmarks, onBookmark, onUnbookmark,
  onChallenge, onCitationTap, isOpponent, readOnly = false,
}) => {
  const config = getEntryConfig(entry, tokens);
  const Icon = config.icon;
  const isTrade = isTradeEntry(entry);
  const accentColor = config.color;
  const isBookmarked = feedBookmarks.includes(entryId);
  const citedRules = entry.citedForgeRules || entry.citedRules || [];

  return (
    <motion.div
      variants={entryVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      whileHover={{ background: isOpponent ? hexToRgba(tokens.bgCard || '#0d1117', 0.65) : hexToRgba(tokens.bgCard || '#0d1117', 1) }}
      style={{
        display: 'flex',
        background: isOpponent ? hexToRgba(tokens.bgCard || '#0d1117', 0.6) : (tokens.bgCard || '#0d1117'),
        borderRadius: 12,
        border: `1px solid ${hexToRgba(accentColor, isTrade ? 0.2 : 0.08)}`,
        overflow: 'hidden',
        boxShadow: tokens.obsidianShadow,
        backgroundImage: isOpponent ? 'none' : 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 40%)',
        opacity: isOpponent ? 0.7 : 1,
        transition: 'background 0.15s ease',
      }}
    >
      {/* Left accent bar */}
      <div style={{
        width: 4,
        flexShrink: 0,
        background: accentColor,
        borderRadius: '12px 0 0 12px',
      }} />

      {/* Content */}
      <div style={{ flex: 1, padding: '12px 14px', minWidth: 0 }}>
        {/* Header row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: entry.message || isTrade ? 8 : 0,
        }}>
          <Icon size={14} color={accentColor} style={{ flexShrink: 0 }} />
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: accentColor,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {config.label}
          </span>
          <span style={{ fontSize: 11, color: tokens.textFaint, marginLeft: 'auto', flexShrink: 0 }}>
            {formatTime(entry.timestamp)}
          </span>
        </div>

        {/* Swap details */}
        {isTrade && entry.symbolOut && entry.symbolIn && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 6,
            fontSize: 13,
            fontWeight: 600,
            color: tokens.textWhite || '#e6edf3',
          }}>
            <span>{entry.symbolOut}</span>
            <ArrowRightLeft size={12} color={tokens.textMuted} />
            <span>{entry.symbolIn}</span>
          </div>
        )}

        {/* Agent message */}
        {entry.message && (
          <p style={{
            fontSize: 13,
            color: isOpponent ? (tokens.textFaint || '#6e7681') : (tokens.textSecondary || '#8b949e'),
            lineHeight: 1.5,
            margin: 0,
            marginBottom: 8,
          }}>
            {entry.message}
          </p>
        )}

        {/* PvP context */}
        {entry.pvpContext && (
          <p style={{
            fontSize: 11,
            color: tokens.textFaint,
            lineHeight: 1.4,
            margin: 0,
            marginBottom: 8,
            fontStyle: 'italic',
          }}>
            {entry.pvpContext}
          </p>
        )}

        {/* Forge Payoff */}
        {entry.forgePayoff && (
          <div style={{ marginBottom: 8 }}>
            <ForgePayoffBadge
              ruleName={citedRules[0] ? (STRATEGY_LABELS[citedRules[0]] || citedRules[0]) : null}
              pointsSaved={entry.forgePayoffPoints}
            />
          </div>
        )}

        {/* Footer: pills + actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 4,
        }}>
          {/* Forge citation pills (tappable) */}
          {citedRules.map((rule, i) => (
            <Pill
              key={`cite-${i}`}
              label={STRATEGY_LABELS[rule] || rule}
              color={tokens.teal || '#5eead4'}
              onClick={() => onCitationTap?.(rule)}
            />
          ))}

          {/* Regime pill */}
          {entry.regime && REGIME_LABELS[entry.regime] && (
            <Pill
              label={REGIME_LABELS[entry.regime]}
              color={REGIME_COLORS[entry.regime] || tokens.textMuted}
            />
          )}

          {/* Strategy pill */}
          {entry.strategy && (
            <Pill
              label={entry.strategy}
              color={tokens.teal || '#5eead4'}
            />
          )}

          {/* Score */}
          {entry.score != null && (
            <span style={{
              marginLeft: 'auto',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'monospace',
              color: entry.score >= 0 ? (tokens.emerald || '#34d399') : (tokens.red || '#ef4444'),
              flexShrink: 0,
            }}>
              {entry.score >= 0 ? '+' : ''}{entry.score.toFixed(1)}
            </span>
          )}

          {/* Spacer to push actions right */}
          {entry.score == null && <span style={{ marginLeft: 'auto' }} />}

          {/* Bookmark */}
          {!isOpponent && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                isBookmarked ? onUnbookmark?.(entryId) : onBookmark?.(entryId);
              }}
              aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                margin: -10,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {isBookmarked
                ? <BookmarkCheck size={14} color={tokens.teal || '#5eead4'} />
                : <Bookmark size={14} color={tokens.textFaint || '#6e7681'} />}
            </button>
          )}

          {/* Challenge */}
          {!isOpponent && onChallenge && entry.symbolOut && !readOnly && (
            <button
              onClick={(e) => { e.stopPropagation(); onChallenge(entry); }}
              aria-label={`Challenge ${entry.symbolOut} trade`}
              style={{
                padding: '6px 10px',
                minHeight: 32,
                borderRadius: 8,
                border: '1px solid rgba(245, 158, 11, 0.25)',
                background: 'rgba(245, 158, 11, 0.08)',
                color: '#f59e0b',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
                fontFamily: 'inherit',
              }}
            >
              Challenge
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ── Collapsible Group (LOW-tier) ──────────────────────────────────────────────

const CollapsibleGroup = ({ group, tokens }) => {
  const [expanded, setExpanded] = useState(false);
  const { count, timeRange, entries } = group;

  const startTime = formatTime(timeRange.start);
  const endTime = formatTime(timeRange.end);
  const timeLabel = startTime === endTime ? startTime : `${endTime} – ${startTime}`;

  return (
    <motion.div variants={entryVariants} initial="hidden" animate="visible" exit="exit" layout>
      {/* Collapsed pill */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        aria-label={`${count} grouped evaluations, tap to ${expanded ? 'collapse' : 'expand'}`}
        aria-expanded={expanded}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          padding: '10px 14px',
          minHeight: 44,
          borderRadius: 10,
          border: `1px solid ${hexToRgba(tokens.textMuted || '#6e7681', 0.12)}`,
          background: hexToRgba(tokens.bgCard || '#0d1117', 0.5),
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 12, color: tokens.textFaint || '#6e7681' }}>↳</span>
        <span style={{ fontSize: 12, color: tokens.textMuted || '#6e7681', fontWeight: 500 }}>
          {count} evaluation{count !== 1 ? 's' : ''}
        </span>
        <span style={{ fontSize: 10, color: tokens.textFaint || '#6e7681' }}>·</span>
        <span style={{ fontSize: 10, color: tokens.textFaint || '#6e7681' }}>{timeLabel}</span>
        <span style={{ marginLeft: 'auto', flexShrink: 0 }}>
          {expanded
            ? <ChevronUp size={14} color={tokens.textFaint || '#6e7681'} />
            : <ChevronDown size={14} color={tokens.textFaint || '#6e7681'} />}
        </span>
      </button>

      {/* Expanded entries */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            variants={groupExpandVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              paddingTop: 6,
              paddingLeft: 12,
              overflow: 'hidden',
            }}
          >
            {entries.map((entry, i) => {
              const config = getEntryConfig(entry, tokens);
              const Icon = config.icon;
              return (
                <motion.div
                  key={getEntryId(entry, i)}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `1px solid ${hexToRgba(tokens.textMuted || '#6e7681', 0.06)}`,
                    background: hexToRgba(tokens.bgCard || '#0d1117', 0.3),
                  }}
                >
                  <Icon size={12} color={tokens.textFaint || '#6e7681'} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {entry.message && (
                      <p style={{
                        fontSize: 12,
                        color: tokens.textMuted || '#6e7681',
                        lineHeight: 1.4,
                        margin: 0,
                      }}>
                        {entry.message}
                      </p>
                    )}
                    {(entry.citedRules || []).length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                        {entry.citedRules.map((r, j) => (
                          <Pill
                            key={j}
                            label={STRATEGY_LABELS[r] || r}
                            color={tokens.textMuted || '#6e7681'}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: tokens.textFaint || '#6e7681', flexShrink: 0 }}>
                    {formatTime(entry.timestamp)}
                  </span>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── Main AgentActivityFeed ────────────────────────────────────────────────────

const AgentActivityFeed = ({
  statusFeed = [],
  feedBookmarks = [],
  filterTicker = null,
  onClearFilter,
  onBookmark,
  onUnbookmark,
  onChallenge,
  onCitationTap,
  battleId,
  isAgentVsAgent = false,
  gameplanMeeting,
  tokens,
  readOnly = false,
}) => {
  const feedRef = useRef(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const prevLengthRef = useRef(statusFeed.length);

  // Reverse feed: newest first
  const reversedFeed = useMemo(() =>
    [...statusFeed].reverse().filter(e => e.message || e.action || e.type),
    [statusFeed]
  );

  // Build grouped feed
  const groupedFeed = useMemo(() =>
    buildGroupedFeed(reversedFeed, filterTicker),
    [reversedFeed, filterTicker]
  );

  // Auto-scroll on new entries
  useEffect(() => {
    if (statusFeed.length > prevLengthRef.current && !userScrolledUp && feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    prevLengthRef.current = statusFeed.length;
  }, [statusFeed.length, userScrolledUp]);

  // Scroll handler to detect manual scroll
  const handleScroll = useCallback(() => {
    if (!feedRef.current) return;
    const { scrollTop } = feedRef.current;
    const isNearTop = scrollTop <= 100;
    setUserScrolledUp(!isNearTop);
  }, []);

  const jumpToLatest = useCallback(() => {
    if (feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      setUserScrolledUp(false);
    }
  }, []);

  // Empty state
  if (reversedFeed.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        textAlign: 'center',
        gap: 12,
        flex: 1,
      }}>
        <MessageSquare size={32} color={tokens.textFaint} style={{ opacity: 0.5 }} />
        <p style={{
          fontSize: 14,
          color: tokens.textMuted,
          lineHeight: 1.6,
          maxWidth: 280,
          margin: 0,
        }}>
          Your agent is analyzing the market. The activity feed will update when the next evaluation runs.
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Filter ticker pill */}
      {filterTicker && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 16px',
          flexShrink: 0,
        }}>
          <button
            onClick={onClearFilter}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 20,
              border: `1px solid ${hexToRgba(tokens.teal || '#5eead4', 0.3)}`,
              background: hexToRgba(tokens.teal || '#5eead4', 0.08),
              color: tokens.teal || '#5eead4',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <span>Filtering: {filterTicker}</span>
            <X size={12} />
          </button>
        </div>
      )}

      {/* Gameplan meeting card (HIGH-tier, always at top if pending) */}
      {gameplanMeeting?.status === 'pending' && (
        <div style={{ padding: '0 12px 8px', flexShrink: 0 }}>
          <GameplanMeetingCard battleId={battleId} meeting={gameplanMeeting} tokens={tokens} />
        </div>
      )}

      {/* Feed container */}
      <div
        ref={feedRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '0 12px 12px',
        }}
      >
        <AnimatePresence mode="popLayout">
          {groupedFeed.map((item, i) => {
            if (item.kind === 'high') {
              const entry = item.entry;
              const entryId = getEntryId(entry, i);
              const isOpponent = entry.type === 'opponent_trade' || entry.type === 'opponent_threshold';
              return (
                <HighTierCard
                  key={entryId}
                  entry={entry}
                  entryId={entryId}
                  tokens={tokens}
                  feedBookmarks={feedBookmarks}
                  onBookmark={onBookmark}
                  onUnbookmark={onUnbookmark}
                  onChallenge={onChallenge}
                  onCitationTap={onCitationTap}
                  isOpponent={isOpponent && isAgentVsAgent}
                  readOnly={readOnly}
                />
              );
            }

            // Collapsible group
            return (
              <CollapsibleGroup
                key={`group-${i}-${item.count}`}
                group={item}
                tokens={tokens}
              />
            );
          })}
        </AnimatePresence>
      </div>

      {/* Jump to latest pill */}
      <AnimatePresence>
        {userScrolledUp && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          onClick={jumpToLatest}
          aria-label="Jump to latest feed entries"
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            minHeight: 44,
            borderRadius: 20,
            border: `1px solid ${hexToRgba(tokens.teal || '#5eead4', 0.3)}`,
            background: tokens.bgCard || '#0d1117',
            color: tokens.teal || '#5eead4',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            zIndex: 10,
          }}
        >
          <ArrowDown size={12} style={{ transform: 'rotate(180deg)' }} />
          Jump to latest
        </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AgentActivityFeed;
