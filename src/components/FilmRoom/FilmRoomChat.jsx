import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import {
  renderMessageWithEntities,
  RENDER_CONFIG,
  resolveMessageType,
} from '../../utils/renderMessageWithEntities';

const REVIEW_BUDGET_LIMIT = 5;

// Coerce Firestore timestamp shapes (Timestamp | ISO string | epoch ms) to ms.
function tsToMs(raw) {
  if (raw == null) return 0;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const n = new Date(raw).getTime();
    return Number.isNaN(n) ? 0 : n;
  }
  if (typeof raw === 'object') {
    if (typeof raw.toMillis === 'function') return raw.toMillis();
    if (typeof raw.seconds === 'number') return raw.seconds * 1000;
  }
  return 0;
}

function UserBubble({ text, tokens }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
      <div
        style={{
          background: '#1C1A27',
          borderRadius: '12px 12px 0 12px',
          padding: '10px 14px',
          maxWidth: '85%',
          color: tokens.textPrimary || '#e2e8f0',
          fontSize: 13.5,
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {text}
      </div>
    </div>
  );
}

function AgentBubble({ message, onSymbolClick, knownTickers, tokens }) {
  const messageType = resolveMessageType(message);
  const cfg = RENDER_CONFIG[messageType] || RENDER_CONFIG.user_initiated;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 10 }}>
      {cfg.label && (
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: cfg.accent,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 4,
            paddingLeft: 12,
          }}
        >
          {cfg.label.emoji} {cfg.label.text}
        </div>
      )}
      <div
        style={{
          background: '#15171E',
          borderLeft: `3px solid ${cfg.accent}`,
          borderRadius: '0 12px 12px 12px',
          padding: '10px 14px',
          maxWidth: '85%',
          color: tokens.textPrimary || '#e2e8f0',
          fontSize: 13.5,
          lineHeight: '1.55',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {renderMessageWithEntities(message.text, onSymbolClick, knownTickers)}
      </div>
    </div>
  );
}

function TypingDots({ tokens }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
      <div
        style={{
          background: '#15171E',
          borderLeft: `3px solid ${tokens.amber || '#f59e0b'}`,
          borderRadius: '0 12px 12px 12px',
          padding: '12px 14px',
        }}
      >
        <div style={{ display: 'flex', gap: 5 }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: tokens.amber || '#f59e0b',
                opacity: 0.6,
                animation: `filmRoomDot 1.2s infinite ease-in-out`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FilmRoomChat({
  agentId,
  battleId,
  chatExchanges,
  reviewBudgetUsed,
  onSymbolClick,
  knownTickers,
  tokens,
}) {
  const [inputText, setInputText] = useState('');
  const [inFlight, setInFlight] = useState([]); // [{id, role, text, isTyping?}]
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Build the Q&A timeline from review-mode exchanges. AutoDebriefHero renders
  // the auto_debrief entry separately, so exclude it here to avoid duplication.
  const serverMessages = useMemo(() => {
    const list = Array.isArray(chatExchanges) ? chatExchanges : [];
    const reviewQA = list.filter(
      (ex) => ex && ex.mode === 'review' && ex.messageType !== 'auto_debrief'
    );
    const out = [];
    reviewQA.forEach((ex, i) => {
      const ts = tsToMs(ex.timestamp);
      if (ex.userMessage) {
        out.push({
          id: `srv-${i}-user`,
          role: 'user',
          text: ex.userMessage,
          timestamp: ts,
        });
      }
      out.push({
        id: `srv-${i}-agent`,
        role: 'agent',
        text: ex.agentResponse,
        messageType: ex.messageType || 'user_initiated',
        mode: ex.mode || 'review',
        timestamp: ts,
      });
    });
    return out;
  }, [chatExchanges]);

  // Reconcile in-flight user bubbles when the server confirms them.
  useEffect(() => {
    if (inFlight.length === 0) return;
    setInFlight((prev) =>
      prev.filter((im) => {
        if (im.role !== 'user') return true;
        const imText = String(im.text || '').trim();
        if (!imText) return true;
        const matched = serverMessages.some(
          (sm) =>
            sm.role === 'user' &&
            String(sm.text || '').trim() === imText &&
            Math.abs((sm.timestamp || 0) - (im.timestamp || 0)) < 60_000
        );
        return !matched;
      })
    );
  }, [serverMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  const messages = useMemo(
    () => [...serverMessages, ...inFlight],
    [serverMessages, inFlight]
  );

  // Auto-scroll to bottom when new messages arrive.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [inputText]);

  const budgetUsed = typeof reviewBudgetUsed === 'number' ? reviewBudgetUsed : 0;
  const budgetExhausted = budgetUsed >= REVIEW_BUDGET_LIMIT;
  const budgetColor =
    budgetExhausted
      ? tokens.red || '#ef4444'
      : budgetUsed >= REVIEW_BUDGET_LIMIT * 0.8
      ? tokens.amber || '#f59e0b'
      : tokens.textFaint || '#64748b';

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || isSending || budgetExhausted) return;

    const now = Date.now();
    const userMsg = { id: `u-${now}`, role: 'user', text: trimmed, timestamp: now };
    const typingMsg = { id: `t-${now}`, role: 'agent', isTyping: true, _createdAt: now };
    setInFlight((prev) => [...prev, userMsg, typingMsg]);
    setInputText('');
    setError(null);
    setIsSending(true);

    try {
      const user = getAuth().currentUser;
      if (!user) {
        setInFlight((prev) => prev.filter((m) => m.id !== userMsg.id && m.id !== typingMsg.id));
        setError('Session expired. Please refresh.');
        return;
      }
      const idToken = await user.getIdToken();
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentId, battleId, message: trimmed, mode: 'review' }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setInFlight((prev) => prev.filter((m) => m.id !== userMsg.id && m.id !== typingMsg.id));
        if (res.status === 401) {
          setError('Session expired. Please refresh.');
        } else if (data.error === 'budget_exceeded' || data.error === 'chat_budget_exceeded') {
          setError(data.message || "You've used all 5 review messages for this battle.");
        } else if (res.status === 429) {
          setError('Slow down — too many messages. Try again in a moment.');
        } else if (res.status === 504) {
          setError('Took too long. Try again.');
        } else {
          setError(data.message || 'Could not reach the agent. Try again.');
        }
        return;
      }

      // Drop only the typing indicator. The user bubble stays until the
      // Firestore listener confirms the matching exchange landed.
      setInFlight((prev) => prev.filter((m) => m.id !== typingMsg.id));
    } catch {
      setInFlight((prev) => prev.filter((m) => m.id !== userMsg.id && m.id !== typingMsg.id));
      setError('Could not reach the agent. Try again.');
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: tokens.bgCard || '#15171E',
        border: `1px solid ${tokens.borderDefault || 'rgba(255,255,255,0.05)'}`,
        borderRadius: 12,
        margin: '0 12px',
        overflow: 'hidden',
      }}
    >
      <style>{`@keyframes filmRoomDot { 0%,100%{opacity:0.3} 50%{opacity:0.8} }`}</style>

      <div
        style={{
          padding: '10px 14px',
          borderBottom: `1px solid ${tokens.borderDefault || 'rgba(255,255,255,0.05)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: tokens.textPrimary || '#e2e8f0',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Review Chat
        </div>
        <div style={{ fontSize: 11, color: budgetColor, fontWeight: 600 }}>
          {budgetUsed}/{REVIEW_BUDGET_LIMIT} review messages
        </div>
      </div>

      <div
        style={{
          flex: 1,
          padding: '12px 14px',
          maxHeight: 360,
          minHeight: 160,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              padding: 16,
              fontSize: 12,
              color: tokens.textFaint || '#64748b',
              textAlign: 'center',
            }}
          >
            Ask a question about the tape — strategy, a specific trade, what the agent was thinking.
          </div>
        )}

        {messages.map((m) =>
          m.isTyping ? (
            <TypingDots key={m.id} tokens={tokens} />
          ) : m.role === 'user' ? (
            <UserBubble key={m.id} text={m.text} tokens={tokens} />
          ) : (
            <AgentBubble
              key={m.id}
              message={m}
              onSymbolClick={onSymbolClick}
              knownTickers={knownTickers}
              tokens={tokens}
            />
          )
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div
          style={{
            padding: '8px 14px',
            background: 'rgba(239,68,68,0.08)',
            borderTop: `1px solid ${tokens.borderDefault || 'rgba(255,255,255,0.05)'}`,
            color: tokens.red || '#ef4444',
            fontSize: 11,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          padding: '10px 12px',
          borderTop: `1px solid ${tokens.borderDefault || 'rgba(255,255,255,0.05)'}`,
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
        }}
      >
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={budgetExhausted ? "You've used all 5 review messages." : 'Ask about the tape…'}
          disabled={budgetExhausted || isSending}
          rows={1}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${tokens.borderDefault || 'rgba(255,255,255,0.08)'}`,
            borderRadius: 8,
            padding: '8px 10px',
            color: tokens.textPrimary || '#e2e8f0',
            fontSize: 13,
            lineHeight: 1.4,
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            opacity: budgetExhausted ? 0.5 : 1,
          }}
        />
        <button
          onClick={() => sendMessage(inputText)}
          disabled={budgetExhausted || isSending || !inputText.trim()}
          style={{
            background: tokens.amber || '#f59e0b',
            border: 'none',
            borderRadius: 8,
            padding: '8px 12px',
            color: '#1a1a1a',
            fontSize: 13,
            fontWeight: 700,
            cursor: budgetExhausted || isSending || !inputText.trim() ? 'not-allowed' : 'pointer',
            opacity: budgetExhausted || isSending || !inputText.trim() ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
