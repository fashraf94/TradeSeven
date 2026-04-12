// src/components/Season/PitStopConversation.jsx
//
// Pit Stop conversation panel — chat-style interface for the user to discuss
// strategy with their agent during the weekend pit stop. The flow is:
//
//   1. User types a message and hits send.
//   2. Client writes `pendingUserMessage` to the pitStop doc.
//   3. Client calls POST /api/season/pit-stop-reply.
//   4. Server re-reads pendingUserMessage, runs the LLM, appends both the
//      user turn and the assistant turn (with scratchpad + suggestedAction)
//      to `conversation[]`, and clears pendingUserMessage.
//   5. Client re-reads the pitStop doc via `onRefreshPitStop()` to pick up
//      the enriched conversation — optimistic updates would lose the
//      server-only metadata (scratchpad/suggestedAction).
//
// Props:
//   entryId            - seasonEntry doc id
//   week               - pit stop week number
//   conversation       - current pitStop.conversation[] from parent
//   conversationCount  - current pitStop.conversationCount from parent
//   isOpen             - true when pitStop.status === 'open'
//   onRefreshPitStop   - async () => void; re-reads the pitStop doc
//
// Bubble styling mirrors `src/components/Agent/AgentChat.jsx` but swaps
// the cyan accent for trophy gold to match the pit-stop theme.

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { HOLO_COLORS } from '../../constants/holoTheme';
import { fetchWithAuth } from '../../utils/fetchWithAuth';

const TROPHY_GOLD = '#F0C75E';
const MAX_EXCHANGES = 30;
const MAX_USER_MESSAGE_LENGTH = 2000;

// ─── Helpers ─────────────────────────────────────────────────

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const then = new Date(timestamp).getTime();
  if (!Number.isFinite(then)) return '';
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

// ─── Typing indicator (three pulsing dots) ───────────────────

function TypingIndicator() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          background: '#15171E',
          borderLeft: `3px solid ${TROPHY_GOLD}`,
          borderRadius: '0 12px 12px 12px',
          padding: '12px 14px',
          maxWidth: '85%',
        }}
      >
        <div style={{ display: 'flex', gap: 5 }}>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: TROPHY_GOLD,
                display: 'block',
              }}
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Message bubbles ─────────────────────────────────────────

function UserBubble({ message }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          background: '#1C1A27',
          border: `1px solid rgba(255,255,255,0.08)`,
          borderRadius: '12px 12px 0 12px',
          padding: '10px 14px',
          maxWidth: '85%',
          color: HOLO_COLORS.textPrimary,
          fontSize: 13,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {message.content}
      </div>
      <span
        style={{
          fontSize: 10,
          color: HOLO_COLORS.textMuted,
          marginTop: 4,
          marginRight: 4,
        }}
      >
        {formatRelativeTime(message.timestamp)}
      </span>
    </div>
  );
}

function AssistantBubble({ message }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          background: '#15171E',
          borderLeft: `3px solid ${TROPHY_GOLD}`,
          borderRadius: '0 12px 12px 12px',
          padding: '10px 14px',
          maxWidth: '85%',
          color: HOLO_COLORS.textPrimary,
          fontSize: 13,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {message.content}
      </div>
      <span
        style={{
          fontSize: 10,
          color: HOLO_COLORS.textMuted,
          marginTop: 4,
          marginLeft: 4,
        }}
      >
        {formatRelativeTime(message.timestamp)}
      </span>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────

export default function PitStopConversation({
  entryId,
  week,
  conversation,
  conversationCount,
  isOpen,
  onRefreshPitStop,
}) {
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const listEndRef = useRef(null);

  const messages = Array.isArray(conversation) ? conversation : [];
  const exchangeCount = Number.isFinite(conversationCount)
    ? conversationCount
    : Math.floor(messages.length / 2);
  const atCap = exchangeCount >= MAX_EXCHANGES;
  const disabled = !isOpen || atCap || sending;

  // Auto-scroll to the bottom whenever new messages arrive or we start sending.
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sending]);

  const handleSend = async () => {
    const trimmed = inputText.trim().slice(0, MAX_USER_MESSAGE_LENGTH);
    if (!trimmed || disabled) return;

    setSending(true);
    setError(null);
    try {
      const pitStopRef = doc(
        db,
        'seasonEntries',
        entryId,
        'pitStops',
        String(week),
      );

      // 1. Write the pending message so the server can read it.
      await updateDoc(pitStopRef, {
        pendingUserMessage: trimmed,
        updatedAt: new Date().toISOString(),
      });

      // 2. Call the reply endpoint — server appends both turns to conversation[].
      const response = await fetchWithAuth('/api/season/pit-stop-reply', {
        method: 'POST',
        body: JSON.stringify({ entryId, week }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || `Reply failed (${response.status})`);
      }

      // 3. Re-read the pit stop doc so we pick up server-enriched assistant turn
      //    (scratchpad, suggestedAction) — optimistic append would lose those.
      if (onRefreshPitStop) {
        await onRefreshPitStop();
      }

      setInputText('');
    } catch (err) {
      console.error('[PitStopConversation] send failed', err);
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const placeholder = !isOpen
    ? 'Weekly review closed'
    : atCap
    ? 'Conversation limit reached'
    : 'Ask about your strategy...';

  return (
    <section
      style={{
        background: HOLO_COLORS.bgElevated,
        border: `1px solid ${HOLO_COLORS.borderSubtle}`,
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 1,
            color: TROPHY_GOLD,
          }}
        >
          Discuss Strategy
        </span>
        <span
          style={{
            fontSize: 11,
            color: HOLO_COLORS.textSecondary,
          }}
        >
          {exchangeCount} / {MAX_EXCHANGES} exchanges
        </span>
      </div>

      {/* Message list */}
      <div
        style={{
          padding: '14px 14px 6px',
          maxHeight: 420,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {messages.length === 0 && !sending && (
          <div
            style={{
              fontSize: 12,
              color: HOLO_COLORS.textMuted,
              fontStyle: 'italic',
              padding: '20px 4px',
              textAlign: 'center',
            }}
          >
            {isOpen
              ? 'Start a conversation with your agent about this week\u2019s performance.'
              : 'This weekly review had no conversation.'}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <UserBubble key={`u-${i}`} message={m} />
          ) : (
            <AssistantBubble key={`a-${i}`} message={m} />
          ),
        )}
        {sending && <TypingIndicator />}
        <div ref={listEndRef} />
      </div>

      {/* Error line */}
      {error && (
        <div
          style={{
            fontSize: 11,
            color: HOLO_COLORS.red,
            padding: '0 14px 8px',
          }}
        >
          {error}
        </div>
      )}

      {/* Input row — hidden entirely when pit stop is closed */}
      {isOpen && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '8px 12px 12px',
            borderTop: `1px solid rgba(255,255,255,0.06)`,
            alignItems: 'flex-end',
          }}
        >
          <textarea
            value={inputText}
            onChange={(e) =>
              setInputText(e.target.value.slice(0, MAX_USER_MESSAGE_LENGTH))
            }
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            style={{
              flex: 1,
              background: '#1C1A27',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              padding: '10px 14px',
              color: '#FFFFFF',
              fontSize: 14,
              outline: 'none',
              resize: 'none',
              minHeight: 42,
              maxHeight: 120,
              fontFamily: 'inherit',
              lineHeight: '1.4',
              opacity: disabled ? 0.5 : 1,
            }}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || disabled}
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background:
                !inputText.trim() || disabled
                  ? 'rgba(240, 199, 94, 0.15)'
                  : TROPHY_GOLD,
              border: 'none',
              cursor: !inputText.trim() || disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: !inputText.trim() || disabled ? TROPHY_GOLD : '#1a1200',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </div>
      )}

      {inputText.length > 1800 && (
        <div
          style={{
            textAlign: 'right',
            padding: '0 16px 6px',
            fontSize: 11,
            color:
              inputText.length > 1950 ? HOLO_COLORS.red : HOLO_COLORS.textMuted,
          }}
        >
          {inputText.length} / {MAX_USER_MESSAGE_LENGTH}
        </div>
      )}
    </section>
  );
}
