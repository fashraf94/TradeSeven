// LiveActivityPanel - Right-side panel in AgentChat showing agent activity.
// Rendered in both desktop side-by-side layout and mobile sub-tab layout.
//
// C1 (net-zero extraction): moves the existing ScratchpadCard, TradeEventCard,
// thinkingEntries useMemo, and thinkingContent JSX out of AgentChat.jsx with
// no behavior changes. C2 will rewrite the filter + split into two sections.

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

// ─── Cards ────────────────────────────────────────────────────────────────────

function ScratchpadCard({ message, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'rgba(94, 234, 212, 0.04)',
        border: '1px solid rgba(94, 234, 212, 0.1)',
        borderRadius: 10,
        padding: '12px 14px',
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, color: '#5EEAD4',
          letterSpacing: '0.5px', textTransform: 'uppercase',
        }}>Scratchpad — msg {index}</span>
        <span style={{ fontSize: 10, color: '#6B7280' }}>
          {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </span>
      </div>
      <div style={{
        fontSize: 12, color: '#9CA3AF', lineHeight: '1.6', fontFamily: 'monospace',
      }}>
        {message.scratchpad}
      </div>
    </motion.div>
  );
}

function TradeEventCard({ event }) {
  return (
    <div style={{
      background: 'rgba(94, 234, 212, 0.04)',
      border: '1px solid rgba(94, 234, 212, 0.12)',
      borderRadius: 10,
      padding: '12px 14px',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, color: '#5EEAD4',
          letterSpacing: '0.5px', textTransform: 'uppercase',
        }}>Trade executed</span>
        <span style={{ fontSize: 10, color: '#6B7280' }}>
          {event.timestamp ? new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: '1.6' }}>
        {event.summary || event.description || `${event.action || 'SWAP'}: ${event.details || ''}`}
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

function LiveActivityPanel({ messages = [], statusFeed = [] /*, onCitationTap */ }) {
  // Build thinking panel entries (scratchpad + trade events).
  const thinkingEntries = useMemo(() => {
    const entries = [];

    // Scratchpad entries from agent messages
    let msgIndex = 0;
    messages.forEach(m => {
      if (m.role === 'agent' && !m.isTyping) {
        msgIndex++;
        if (m.scratchpad) {
          entries.push({ type: 'scratchpad', message: m, index: msgIndex, timestamp: m.timestamp });
        }
      }
    });

    // Trade events from statusFeed
    const tradeActions = ['swap', 'emergency_swap', 'trade_executed'];
    (statusFeed || []).forEach(event => {
      if (tradeActions.includes(event.action)) {
        const ts = event.timestamp?.toMillis?.() || (typeof event.timestamp === 'string' ? new Date(event.timestamp).getTime() : event.timestamp) || 0;
        entries.push({ type: 'trade', event, timestamp: ts });
      }
    });

    // Sort newest first
    entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return entries;
  }, [messages, statusFeed]);

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {thinkingEntries.length === 0 ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          color: '#6B7280',
          fontSize: 13,
          textAlign: 'center',
          padding: '32px 24px',
          lineHeight: '1.5',
        }}>
          No thinking data yet. Start a conversation and your agent's reasoning will appear here.
        </div>
      ) : (
        thinkingEntries.map((entry, i) =>
          entry.type === 'scratchpad' ? (
            <ScratchpadCard key={`sp-${entry.index}`} message={entry.message} index={entry.index} />
          ) : (
            <TradeEventCard key={`te-${i}`} event={entry.event} />
          )
        )
      )}
    </div>
  );
}

export default LiveActivityPanel;
