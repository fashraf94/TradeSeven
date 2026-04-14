// LiveActivityPanel - Agent Pulse
//
// A quiet, always-present indicator that the agent is alive and working.
// Design principle: the chat is the star. This panel supports the
// conversation; it is not a data dashboard.
//
// Structure (top to bottom):
//   1. AgentStatusIndicator -- pulsing dot + one-line status from the most
//      recent statusFeed entry's message. Crossfade when the source changes.
//   2. BreakthroughAlerts -- compact cards for 5 admitted types
//      (risk_alert, threshold_event, gameplan_meeting, lock,
//      hypothesis_resolved). Max 3 visible. Auto-dismiss after 60s OR
//      tap-to-dismiss-early. Routine evaluations/holds do NOT appear here;
//      they feed the status indicator only.
//   3. Agent Reasoning (N) -- collapsible Gemma scratchpad section, gray
//      and muted, default collapsed. Hidden when no entries exist.
//   4. View Full Log -- bottom link that calls onSwitchToGameTape.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, X, Trophy, AlertTriangle, Users, Lightbulb, Lock } from 'lucide-react';

// ─── Palette ──────────────────────────────────────────────────────────────────

const PALETTE = {
  teal:   '#5EEAD4',
  red:    '#EF4444',
  amber:  '#F59E0B',
  gold:   '#FBBF24',
  purple: '#A78BFA',
  gray:   '#6B7280',
  muted:  '#9CA3AF',
  body:   '#D1D5DB',
  bgCard: '#15171E',
  border: 'rgba(255,255,255,0.05)',
};

// Breakthrough types only. Everything else feeds the status indicator text.
// threshold_event and lock use GOLD (scoring milestones / celebratory),
// risk_alert uses RED, gameplan_meeting uses PURPLE, hypothesis_resolved
// uses AMBER (pending outcome).
const BREAKTHROUGH_MAP = {
  risk_alert:          { label: 'RISK',   color: PALETTE.red,    Icon: AlertTriangle },
  threshold_event:     { label: 'SCORE',  color: PALETTE.gold,   Icon: Trophy },
  lock:                { label: 'LOCK',   color: PALETTE.gold,   Icon: Lock },
  gameplan_meeting:    { label: 'PLAN',   color: PALETTE.purple, Icon: Users },
  hypothesis_resolved: { label: 'HYPO',   color: PALETTE.amber,  Icon: Lightbulb },
};

const BREAKTHROUGH_KEYS = new Set(Object.keys(BREAKTHROUGH_MAP));
const ALERT_TTL_MS = 60_000;
const MAX_VISIBLE_ALERTS = 3;
const STATUS_MAX_CHARS = 80;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeTimestamp = (ts) => {
  if (!ts) return 0;
  if (typeof ts?.toMillis === 'function') return ts.toMillis();
  if (typeof ts === 'string') return new Date(ts).getTime() || 0;
  if (typeof ts === 'number') return ts;
  if (ts instanceof Date) return ts.getTime();
  return 0;
};

const formatTime = (ms) => {
  if (!ms) return '';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const hexToRgba = (hex, alpha) => {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const extractMessage = (entry) =>
  (entry?.message || entry?.rationale || entry?.description || entry?.summary || '').toString();

const truncate = (text, max = STATUS_MAX_CHARS) => {
  const t = (text || '').trim().replace(/\s+/g, ' ');
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
};

const entryKey = (entry, fallbackIndex) =>
  entry?.id || entry?.evalId || `${normalizeTimestamp(entry?.timestamp)}-${fallbackIndex}`;

// ─── AgentStatusIndicator ─────────────────────────────────────────────────────

function AgentStatusIndicator({ latestEntry }) {
  const isActive = !!latestEntry;
  const statusText = latestEntry
    ? truncate(extractMessage(latestEntry)) || 'Agent is active.'
    : 'Your agent will start analyzing when the market opens.';

  const dotColor = isActive ? PALETTE.teal : PALETTE.gray;
  const crossfadeKey = latestEntry ? entryKey(latestEntry, 0) : 'idle';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      padding: '14px 12px 12px',
      borderBottom: `1px solid ${PALETTE.border}`,
    }}>
      {/* Pulsing dot */}
      <div style={{
        position: 'relative',
        width: 10,
        height: 10,
        marginTop: 4,
        flexShrink: 0,
      }}>
        <motion.span
          animate={isActive
            ? { scale: [1, 1.9, 1], opacity: [0.45, 0, 0.45] }
            : { scale: 1, opacity: 0 }}
          transition={isActive
            ? { duration: 2.2, ease: 'easeInOut', repeat: Infinity }
            : { duration: 0 }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: dotColor,
          }}
        />
        <span style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: dotColor,
          opacity: isActive ? 1 : 0.5,
        }} />
      </div>

      {/* Status text with crossfade */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          color: dotColor,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}>
          {isActive ? 'Agent Pulse' : 'Standing by'}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={crossfadeKey}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.25 }}
            style={{
              fontSize: 13,
              color: isActive ? PALETTE.body : PALETTE.gray,
              lineHeight: 1.45,
              wordBreak: 'break-word',
            }}
          >
            {statusText}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── BreakthroughAlertCard ────────────────────────────────────────────────────

function BreakthroughAlertCard({ alert, onDismiss }) {
  const cfg = BREAKTHROUGH_MAP[alert.key] || BREAKTHROUGH_MAP.risk_alert;
  const ts = normalizeTimestamp(alert.timestamp);
  const body = truncate(extractMessage(alert.event), 140);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{
        background: PALETTE.bgCard,
        border: `1px solid ${PALETTE.border}`,
        borderLeft: `3px solid ${cfg.color}`,
        borderRadius: 8,
        padding: '8px 10px 8px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <cfg.Icon size={12} color={cfg.color} style={{ flexShrink: 0 }} />
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color: cfg.color,
          background: hexToRgba(cfg.color, 0.14),
          padding: '2px 6px',
          borderRadius: 3,
          letterSpacing: '0.04em',
        }}>
          {cfg.label}
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 10,
          color: PALETTE.gray,
          whiteSpace: 'nowrap',
        }}>
          {formatTime(ts)}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(alert.id); }}
          aria-label="Dismiss alert"
          style={{
            background: 'none',
            border: 'none',
            padding: 2,
            marginLeft: 2,
            cursor: 'pointer',
            display: 'inline-flex',
            color: PALETTE.gray,
          }}
        >
          <X size={12} />
        </button>
      </div>
      {body && (
        <div style={{
          fontSize: 12.5,
          color: PALETTE.body,
          lineHeight: 1.45,
          wordBreak: 'break-word',
        }}>
          {body}
        </div>
      )}
    </motion.div>
  );
}

// ─── BreakthroughAlerts ───────────────────────────────────────────────────────
// Manages the visible alert list. Each incoming breakthrough entry becomes an
// alert that auto-dismisses after ALERT_TTL_MS; user can also tap X to
// dismiss early. Oldest dismissed when a 4th arrives (MAX_VISIBLE_ALERTS=3).

function useBreakthroughAlerts(statusFeed) {
  const [visible, setVisible] = useState([]); // [{ id, key, event, timestamp }]
  const seenIdsRef = useRef(new Set());
  const timersRef = useRef(new Map());

  const dismiss = React.useCallback((id) => {
    setVisible(prev => prev.filter(a => a.id !== id));
    const t = timersRef.current.get(id);
    if (t) { clearTimeout(t); timersRef.current.delete(id); }
  }, []);

  // Detect new breakthrough entries and push them into the visible list.
  useEffect(() => {
    if (!Array.isArray(statusFeed) || statusFeed.length === 0) return;
    const additions = [];
    for (let i = 0; i < statusFeed.length; i++) {
      const entry = statusFeed[i];
      const key = entry?.action || entry?.type;
      if (!BREAKTHROUGH_KEYS.has(key)) continue;
      const id = entryKey(entry, i);
      if (seenIdsRef.current.has(id)) continue;
      seenIdsRef.current.add(id);
      additions.push({
        id,
        key,
        event: entry,
        timestamp: normalizeTimestamp(entry.timestamp),
      });
    }
    if (additions.length === 0) return;

    setVisible(prev => {
      // Newest on top, cap at MAX_VISIBLE_ALERTS.
      const merged = [...additions.reverse(), ...prev];
      return merged.slice(0, MAX_VISIBLE_ALERTS);
    });

    // Schedule auto-dismiss for each new alert.
    additions.forEach(a => {
      const t = setTimeout(() => dismiss(a.id), ALERT_TTL_MS);
      timersRef.current.set(a.id, t);
    });
  }, [statusFeed, dismiss]);

  // Cleanup any pending timers on unmount.
  useEffect(() => () => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current.clear();
  }, []);

  return { visible, dismiss };
}

function BreakthroughAlerts({ statusFeed }) {
  const { visible, dismiss } = useBreakthroughAlerts(statusFeed);
  if (visible.length === 0) return null;
  return (
    <div style={{
      padding: '10px 12px 4px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <AnimatePresence initial={false}>
        {visible.map(alert => (
          <BreakthroughAlertCard key={alert.id} alert={alert} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── ScratchpadCard (unchanged from Phase 3) ──────────────────────────────────

function ScratchpadCard({ message, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        background: 'rgba(148, 163, 184, 0.04)',
        border: `1px solid ${PALETTE.border}`,
        borderLeft: `3px solid ${PALETTE.gray}`,
        borderRadius: 10,
        padding: '10px 12px 10px 13px',
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color: PALETTE.gray,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          Scratchpad — msg {index}
        </span>
        <span style={{ fontSize: 10, color: PALETTE.gray }}>
          {message.timestamp ? formatTime(normalizeTimestamp(message.timestamp)) : ''}
        </span>
      </div>
      <div style={{
        fontSize: 12,
        color: PALETTE.muted,
        lineHeight: 1.6,
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {message.scratchpad}
      </div>
    </motion.div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

function LiveActivityPanel({
  messages = [],
  statusFeed = [],
  onSwitchToGameTape,
}) {
  const [reasoningOpen, setReasoningOpen] = useState(false);

  // Latest statusFeed entry (any type) powers the status-indicator text.
  const latestEntry = useMemo(() => {
    if (!Array.isArray(statusFeed) || statusFeed.length === 0) return null;
    let best = null;
    let bestTs = -Infinity;
    for (const e of statusFeed) {
      const ts = normalizeTimestamp(e?.timestamp);
      if (ts >= bestTs) { best = e; bestTs = ts; }
    }
    return best;
  }, [statusFeed]);

  // Scratchpad entries for Agent Reasoning section. Chat-ordered msgIndex,
  // then sorted newest-first for display.
  const scratchpadEntries = useMemo(() => {
    const out = [];
    let msgIndex = 0;
    (messages || []).forEach(m => {
      if (m?.role === 'agent' && !m.isTyping) {
        msgIndex++;
        if (m.scratchpad) {
          out.push({ message: m, index: msgIndex, timestamp: normalizeTimestamp(m.timestamp) });
        }
      }
    });
    return out.sort((a, b) => b.timestamp - a.timestamp);
  }, [messages]);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
    }}>
      <AgentStatusIndicator latestEntry={latestEntry} />

      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}>
        <BreakthroughAlerts statusFeed={statusFeed} />

        {/* Agent Reasoning collapsible (unchanged behavior from Phase 3) */}
        {scratchpadEntries.length > 0 && (
          <div style={{ padding: '4px 12px 8px' }}>
            <button
              type="button"
              onClick={() => setReasoningOpen(v => !v)}
              style={{
                width: '100%',
                marginTop: 4,
                padding: '8px 4px',
                background: 'none',
                border: 'none',
                borderTop: `1px solid ${PALETTE.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                fontFamily: 'inherit',
                color: PALETTE.gray,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              <span>Agent Reasoning ({scratchpadEntries.length})</span>
              {reasoningOpen
                ? <ChevronUp size={14} color={PALETTE.gray} />
                : <ChevronDown size={14} color={PALETTE.gray} />}
            </button>
            <AnimatePresence initial={false}>
              {reasoningOpen && (
                <motion.div
                  key="reasoning-body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8,
                  }}>
                    {scratchpadEntries.map(entry => (
                      <ScratchpadCard
                        key={`sp-${entry.index}`}
                        message={entry.message}
                        index={entry.index}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* View Full Log link */}
      {onSwitchToGameTape && (
        <button
          type="button"
          onClick={onSwitchToGameTape}
          style={{
            flexShrink: 0,
            padding: '10px 12px',
            background: 'none',
            border: 'none',
            borderTop: `1px solid ${PALETTE.border}`,
            textAlign: 'center',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 11.5,
            fontWeight: 600,
            color: PALETTE.teal,
            letterSpacing: '0.02em',
          }}
        >
          View full activity log →
        </button>
      )}
    </div>
  );
}

export default LiveActivityPanel;
