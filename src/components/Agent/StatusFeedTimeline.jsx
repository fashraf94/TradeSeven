import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRightLeft, ShieldAlert, Lock, MessageSquare } from 'lucide-react';

// ── Label Maps ─────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────

const hexToRgba = (hex, alpha) => {
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

const getActionConfig = (action, tokens) => {
  switch (action) {
    case 'swap':
      return { color: tokens.teal, icon: ArrowRightLeft, label: 'Trade' };
    case 'emergency_swap':
      return { color: tokens.amber, icon: ShieldAlert, label: 'Emergency' };
    case 'swap_out':
      return { color: tokens.amber, icon: ShieldAlert, label: 'Risk Exit' };
    case 'trail_stop':
      return { color: tokens.amber, icon: ShieldAlert, label: 'Trail Stop' };
    case 'lock':
      return { color: '#eab308', icon: Lock, label: 'Locked' };
    case 'hold':
      return { color: tokens.textMuted, icon: MessageSquare, label: 'Hold' };
    default:
      return { color: tokens.textMuted, icon: MessageSquare, label: 'Update' };
  }
};

const isRiskAction = (action) =>
  ['emergency_swap', 'swap_out', 'trail_stop'].includes(action);

// ── Pill Badge ─────────────────────────────────────────────

const Pill = ({ label, color, tokens }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '10px',
    fontWeight: '600',
    letterSpacing: '0.3px',
    color: color,
    background: hexToRgba(color, 0.12),
    border: `1px solid ${hexToRgba(color, 0.2)}`,
    whiteSpace: 'nowrap',
  }}>
    {label}
  </span>
);

// ── Single Feed Entry ──────────────────────────────────────

const entryVariants = {
  hidden: { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const FeedEntry = ({ entry, tokens }) => {
  const config = getActionConfig(entry.action, tokens);
  const Icon = config.icon;
  const isRisk = isRiskAction(entry.action);
  const isTrade = entry.action === 'swap' || isRisk;
  const accentColor = config.color;

  return (
    <motion.div
      variants={entryVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      style={{
        background: tokens.bgCard,
        borderRadius: '12px',
        border: `1px solid ${hexToRgba(accentColor, isTrade ? 0.2 : 0.08)}`,
        padding: '12px 14px',
        boxShadow: tokens.obsidianShadow,
        backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 40%)',
      }}
    >
      {/* Header row: timestamp + action badge + strategy pills */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: entry.message || isTrade ? '8px' : 0,
      }}>
        <Icon size={14} color={accentColor} style={{ flexShrink: 0 }} />
        <span style={{
          fontSize: '11px',
          fontWeight: '600',
          color: accentColor,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          {config.label}
        </span>
        <span style={{ fontSize: '11px', color: tokens.textFaint, marginLeft: 'auto', flexShrink: 0 }}>
          {formatTime(entry.timestamp)}
        </span>
      </div>

      {/* Swap details */}
      {isTrade && entry.symbolOut && entry.symbolIn && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '6px',
          fontSize: '13px',
          fontWeight: '600',
          color: tokens.textWhite,
        }}>
          <span>{entry.symbolOut}</span>
          <ArrowRightLeft size={12} color={tokens.textMuted} />
          <span>{entry.symbolIn}</span>
        </div>
      )}

      {/* Agent message */}
      {entry.message && (
        <p style={{
          fontSize: '13px',
          color: tokens.textSecondary,
          lineHeight: '1.5',
          margin: 0,
          marginBottom: '8px',
        }}>
          {entry.message}
        </p>
      )}

      {/* PvP context */}
      {entry.pvpContext && (
        <p style={{
          fontSize: '11px',
          color: tokens.textFaint,
          lineHeight: '1.4',
          margin: 0,
          marginBottom: '8px',
          fontStyle: 'italic',
        }}>
          {entry.pvpContext}
        </p>
      )}

      {/* Footer: pills + score */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '4px',
      }}>
        {/* Strategy pills */}
        {(entry.citedRules || []).map((rule, i) => (
          <Pill
            key={`rule-${i}`}
            label={STRATEGY_LABELS[rule] || rule}
            color={isRisk ? tokens.amber : tokens.teal}
            tokens={tokens}
          />
        ))}

        {/* Regime pill */}
        {entry.regime && REGIME_LABELS[entry.regime] && (
          <Pill
            label={REGIME_LABELS[entry.regime]}
            color={REGIME_COLORS[entry.regime] || tokens.textMuted}
            tokens={tokens}
          />
        )}

        {/* Score */}
        {entry.score != null && (
          <span style={{
            marginLeft: 'auto',
            fontSize: '12px',
            fontWeight: '600',
            fontFamily: 'monospace',
            color: entry.score >= 0 ? tokens.emerald : tokens.red,
            flexShrink: 0,
          }}>
            {entry.score >= 0 ? '+' : ''}{entry.score.toFixed(1)}
          </span>
        )}
      </div>
    </motion.div>
  );
};

// ── Main Timeline ──────────────────────────────────────────

const StatusFeedTimeline = ({ statusFeed = [], tokens, isDesktop, isMobile }) => {
  // Reverse to show newest first; filter out empty entries
  const entries = [...statusFeed]
    .reverse()
    .filter(e => e.message || e.action);

  if (entries.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        textAlign: 'center',
        gap: '12px',
      }}>
        <MessageSquare size={32} color={tokens.textFaint} style={{ opacity: 0.5 }} />
        <p style={{
          fontSize: '14px',
          color: tokens.textMuted,
          lineHeight: '1.6',
          maxWidth: '280px',
          margin: 0,
        }}>
          Your agent is analyzing the market. The strategy feed will update when the next evaluation runs.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      overflowY: 'auto',
      maxHeight: isDesktop ? 'calc(100vh - 240px)' : 'calc(100vh - 200px)',
      paddingRight: '4px',
    }}>
      <AnimatePresence mode="popLayout">
        {entries.map((entry, i) => (
          <FeedEntry
            key={entry.evalId || entry.timestamp || i}
            entry={entry}
            tokens={tokens}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default StatusFeedTimeline;
