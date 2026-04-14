// LiveActivityPanel - Right-side panel in AgentChat.
//
// Two stacked sections:
//   1. EVALUATIONS (primary, always visible)
//      Haiku non-trade event cards from statusFeed with a 4-color semantic
//      palette: teal=info (evaluation/hold/watchlist), red=risk
//      (risk_alert/threshold_event), amber=override/exception
//      (rule_override/catalyst_override/hypothesis_resolved/lock),
//      purple=opponent (opponent_trade/opponent_threshold/gameplan_meeting).
//   2. AGENT REASONING (N) (secondary, collapsible, default collapsed)
//      Gemma scratchpad entries with gray muted styling.
//
// Trade events (swap/emergency_swap/trade_executed/etc.) are excluded — they
// now live inline in the chat timeline as TradeTickerCards (Phase 2).

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';

// ─── Palette ──────────────────────────────────────────────────────────────────

const PALETTE = {
  teal:   '#5EEAD4',
  red:    '#EF4444',
  amber:  '#F59E0B',
  purple: '#A78BFA',
  gray:   '#6B7280',
  muted:  '#9CA3AF',
  body:   '#D1D5DB',
  bgCard: '#15171E',
  border: 'rgba(255,255,255,0.05)',
};

// Each badge maps to a compact 3-4 char label and a palette color.
// The card's 3px left border matches the badge color.
const BADGE_MAP = {
  evaluation:          { label: 'EVAL',   color: PALETTE.teal },
  evaluation_summary:  { label: 'EVAL',   color: PALETTE.teal },
  hold:                { label: 'HOLD',   color: PALETTE.teal },
  hold_decision:       { label: 'HOLD',   color: PALETTE.teal },
  watchlist_refresh:   { label: 'WATCH',  color: PALETTE.teal },
  risk_alert:          { label: 'RISK',   color: PALETTE.red },
  threshold_event:     { label: 'THRESH', color: PALETTE.red },
  rule_override:       { label: 'RULE',   color: PALETTE.amber },
  catalyst_override:   { label: 'CAT',    color: PALETTE.amber },
  hypothesis_resolved: { label: 'HYPO',   color: PALETTE.amber },
  lock:                { label: 'LOCK',   color: PALETTE.amber },
  gameplan_meeting:    { label: 'PLAN',   color: PALETTE.purple },
  opponent_trade:      { label: 'OPP',    color: PALETTE.purple },
  opponent_threshold:  { label: 'OPP',    color: PALETTE.purple },
};

const FALLBACK_BADGE = { label: 'INFO', color: PALETTE.teal };

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ children, color = PALETTE.teal, style }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 700,
      color,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      margin: '4px 0 2px',
      ...style,
    }}>
      {children}
    </div>
  );
}

function EvalCard({ event, onCitationTap }) {
  const key = event.action || event.type;
  const badge = BADGE_MAP[key] || FALLBACK_BADGE;
  const ts = normalizeTimestamp(event.timestamp);
  const body = event.message || event.rationale || event.description || event.summary || '';
  const citedRules = event.citedForgeRules || event.citedRules || [];

  const hasSymbolFlow = event.symbolOut && event.symbolIn;
  const hasMeta = hasSymbolFlow || event.regime;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        background: PALETTE.bgCard,
        border: `1px solid ${PALETTE.border}`,
        borderLeft: `3px solid ${badge.color}`,
        borderRadius: 10,
        padding: '10px 12px 10px 13px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {/* Header: badge + timestamp */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color: badge.color,
          background: hexToRgba(badge.color, 0.12),
          padding: '2px 6px',
          borderRadius: 3,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}>
          {badge.label}
        </span>
        <span style={{ fontSize: 10, color: PALETTE.gray, whiteSpace: 'nowrap' }}>
          {formatTime(ts)}
        </span>
      </div>

      {/* Body text */}
      {body && (
        <div style={{
          fontSize: 13,
          color: PALETTE.body,
          lineHeight: 1.5,
          wordBreak: 'break-word',
        }}>
          {body}
        </div>
      )}

      {/* Optional meta row: symbol flow + regime */}
      {hasMeta && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: PALETTE.gray,
        }}>
          {hasSymbolFlow && (
            <span>
              <span style={{ color: PALETTE.red }}>{event.symbolOut}</span>
              {' → '}
              <span style={{ color: PALETTE.teal }}>{event.symbolIn}</span>
            </span>
          )}
          {event.regime && <span>· {event.regime}</span>}
        </div>
      )}

      {/* Forge citation pills */}
      {citedRules.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {citedRules.map((rule, i) => (
            <button
              key={`${rule}-${i}`}
              onClick={(e) => { e.stopPropagation(); onCitationTap?.(rule); }}
              style={{
                padding: '2px 7px',
                borderRadius: 6,
                border: `1px solid rgba(94,234,212,0.25)`,
                background: 'rgba(94,234,212,0.08)',
                color: PALETTE.teal,
                fontSize: 9.5,
                fontWeight: 600,
                cursor: onCitationTap ? 'pointer' : 'default',
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

function InlineEmptyEval() {
  return (
    <div style={{
      fontSize: 13,
      color: PALETTE.gray,
      fontStyle: 'italic',
      padding: '8px 4px',
      lineHeight: 1.5,
    }}>
      No evaluations yet.
    </div>
  );
}

function FullEmptyState() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      color: PALETTE.gray,
      fontSize: 13,
      textAlign: 'center',
      padding: '32px 24px',
      lineHeight: 1.5,
    }}>
      No evaluations yet. Activity will appear here when your agent starts analyzing.
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

function LiveActivityPanel({ messages = [], statusFeed = [], onCitationTap }) {
  const [reasoningOpen, setReasoningOpen] = useState(false);

  // Primary feed: admit only known eval/hold/risk/override/opponent types.
  // Key off action || type (backend writes either depending on producer).
  const evalEntries = useMemo(() => {
    const keep = new Set(Object.keys(BADGE_MAP));
    return (statusFeed || [])
      .filter(e => keep.has(e?.action) || keep.has(e?.type))
      .map(e => ({ event: e, timestamp: normalizeTimestamp(e.timestamp) }))
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [statusFeed]);

  // Scratchpad: compute msgIndex in chat order first so "MSG N" is stable,
  // then sort newest first for display.
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

  const bothEmpty = evalEntries.length === 0 && scratchpadEntries.length === 0;

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {bothEmpty ? (
        <FullEmptyState />
      ) : (
        <>
          {/* ── Primary: EVALUATIONS ──────────────────────────────────── */}
          <SectionHeader color={PALETTE.teal}>Evaluations</SectionHeader>
          {evalEntries.length === 0 ? (
            <InlineEmptyEval />
          ) : (
            evalEntries.map((entry, i) => (
              <EvalCard
                key={entry.event.id || `${entry.timestamp}-${i}`}
                event={entry.event}
                onCitationTap={onCitationTap}
              />
            ))
          )}

          {/* ── Secondary: AGENT REASONING (collapsible) ─────────────── */}
          {scratchpadEntries.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setReasoningOpen(v => !v)}
                style={{
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
            </>
          )}
        </>
      )}
    </div>
  );
}

export default LiveActivityPanel;
