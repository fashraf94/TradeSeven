// src/components/Forge/WorkshopChat.jsx
//
// Workshop Mode UI — a full-screen conversational shell for collaboratively
// developing a trading thesis with Gemma. On successful compilation it
// hands a pre-filled dimensionValues object back to the parent via the
// onCompiled callback, which routes the user into SeasonEntryModal at
// Step 1 with the sliders already tuned.
//
// Wire-up:
//   * POST /api/forge/workshop-chat — one per user message
//   * POST /api/forge/compile-dimensions — when user taps "Compile Strategy"
//
// Session lifecycle is managed server-side; this component only holds the
// sessionId for subsequent messages. When a session is compiled (terminal
// status), re-opening Workshop Mode starts fresh.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, MessageSquare, Sparkles, Target, ChevronDown } from 'lucide-react';
import { fetchWithAuth } from '../../utils/fetchWithAuth';

// ── Design tokens (match ForgeLanding / AgentChat palette) ─────
const PAGE_BG = '#0D0E12';
const CARD_BG = '#15171E';
const SURFACE_BG = '#1C1A27';
const BORDER_SUBTLE = '#21262D';
const TEXT_PRIMARY = '#F1F5F9';
const TEXT_SECONDARY = '#8B949E';
const TEXT_MUTED = '#6E7681';
const TEAL = '#5EEAD4';
const TROPHY_GOLD = '#F0C75E';
const POSITIVE = '#34D399';
const NEGATIVE = '#EF4444';

// ──────────────────────────────────────────────────────────────
// Thesis display
// ──────────────────────────────────────────────────────────────

const THESIS_FIELDS = [
  { key: 'summary', label: 'Summary' },
  { key: 'catalyst', label: 'Catalyst' },
  { key: 'instruments', label: 'Instruments' },
  { key: 'entryLogic', label: 'Entry Logic' },
  { key: 'exitLogic', label: 'Exit Logic' },
  { key: 'riskPosture', label: 'Risk Posture' },
  { key: 'invalidation', label: 'Invalidation' },
];

function ThesisField({ label, value }) {
  const isEmpty =
    !value ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'string' && value.trim() === '');

  const display = Array.isArray(value) ? value.join(', ') : value;

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.6px',
          textTransform: 'uppercase',
          color: TEXT_MUTED,
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.45,
          color: isEmpty ? TEXT_MUTED : TEXT_PRIMARY,
          fontStyle: isEmpty ? 'italic' : 'normal',
        }}
      >
        {isEmpty ? 'Not yet discussed' : display}
      </div>
    </div>
  );
}

function ConfidencePill({ confidence }) {
  const palette = {
    low: { bg: 'rgba(110, 118, 129, 0.15)', fg: TEXT_SECONDARY, label: 'Low' },
    medium: { bg: 'rgba(240, 199, 94, 0.15)', fg: TROPHY_GOLD, label: 'Medium' },
    high: { bg: 'rgba(52, 211, 153, 0.15)', fg: POSITIVE, label: 'High' },
  };
  const p = palette[confidence] || palette.low;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        padding: '3px 8px',
        borderRadius: 999,
        background: p.bg,
        color: p.fg,
      }}
    >
      {p.label}
    </span>
  );
}

function ThesisPanel({ thesis, readyToCompile, compileDisabled, onCompile, isCompiling }) {
  const t = thesis || {};
  return (
    <div
      style={{
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        height: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={16} color={TEAL} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
              color: TEXT_PRIMARY,
            }}
          >
            Active Thesis
          </span>
        </div>
        <ConfidencePill confidence={t.confidence || 'low'} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {THESIS_FIELDS.map((f) => (
          <ThesisField key={f.key} label={f.label} value={t[f.key]} />
        ))}
      </div>

      <div style={{ marginTop: 8 }}>
        {readyToCompile ? (
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={onCompile}
            disabled={compileDisabled || isCompiling}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: isCompiling ? 'rgba(240, 199, 94, 0.3)' : TROPHY_GOLD,
              color: '#0D0E12',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: isCompiling ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 8px 20px rgba(240, 199, 94, 0.25)',
            }}
          >
            <Sparkles size={16} />
            {isCompiling ? 'Compiling…' : 'Compile Strategy'}
          </motion.button>
        ) : (
          <div
            style={{
              padding: '10px 12px',
              background: SURFACE_BG,
              border: `1px dashed ${BORDER_SUBTLE}`,
              borderRadius: 10,
              fontSize: 11,
              color: TEXT_MUTED,
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            Keep talking — the compile button unlocks once entry, exit, and risk posture are defined.
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Chat bubble (local to this component — keeps AgentChat untouched)
// ──────────────────────────────────────────────────────────────

function ChatBubble({ message, agentName }) {
  const isUser = message.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'column',
        alignItems: isUser ? 'center' : 'flex-start',
        marginBottom: 12,
      }}
    >
      {!isUser && (
        <div
          style={{
            color: TEAL,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            marginBottom: 4,
            paddingLeft: 4,
          }}
        >
          {agentName || 'Gemma'}
        </div>
      )}
      <div
        style={{
          background: isUser ? SURFACE_BG : CARD_BG,
          borderLeft: isUser ? 'none' : `3px solid ${TEAL}`,
          borderRadius: isUser ? '12px 12px 0 12px' : '0 12px 12px 12px',
          padding: '10px 14px',
          maxWidth: '85%',
          color: TEXT_PRIMARY,
          fontSize: 14,
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {message.text}
      </div>
    </motion.div>
  );
}

function TypingIndicator({ agentName }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 12 }}
    >
      <div
        style={{
          color: TEAL,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginBottom: 4,
          paddingLeft: 4,
        }}
      >
        {agentName || 'Gemma'}
      </div>
      <div
        style={{
          background: CARD_BG,
          borderLeft: `3px solid ${TEAL}`,
          borderRadius: '0 12px 12px 12px',
          padding: '12px 16px',
          display: 'flex',
          gap: 4,
        }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            style={{ width: 6, height: 6, background: TEAL, borderRadius: '50%' }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────

export default function WorkshopChat({ isOpen, onClose, user, agent, onCompiled }) { // eslint-disable-line no-unused-vars -- user prop kept for future personalization
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [activeThesis, setActiveThesis] = useState(null);
  const [messagesUsed, setMessagesUsed] = useState(0);
  const [messageBudget, setMessageBudget] = useState(25);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [error, setError] = useState(null);
  const [showThesisMobile, setShowThesisMobile] = useState(false);

  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 900 : true
  );

  // Reset state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setSessionId(null);
      setMessages([]);
      setActiveThesis(null);
      setMessagesUsed(0);
      setMessageBudget(25);
      setInputText('');
      setIsSending(false);
      setIsCompiling(false);
      setError(null);
      setShowThesisMobile(false);
    }
  }, [isOpen]);

  // Responsive listener
  useEffect(() => {
    function handleResize() {
      setIsDesktop(window.innerWidth >= 900);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Auto-scroll chat on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages.length, isSending]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputText]);

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed || isSending || isCompiling) return;
      if (!agent?.id) {
        setError('No agent available. Create an agent first.');
        return;
      }

      setError(null);
      setIsSending(true);
      setInputText('');

      const userMsg = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: trimmed,
      };
      setMessages((m) => [...m, userMsg]);

      // Helper: push a graceful fallback bubble into the chat without the
      // red error banner. Used for retryable hiccups (server returned
      // non-JSON, transient Gemma/OpenRouter errors, etc.)
      const pushFallbackBubble = (text) => {
        const agentMsg = {
          id: `agent-${Date.now()}`,
          role: 'agent',
          text,
        };
        setMessages((m) => [...m, agentMsg]);
      };

      try {
        const res = await fetchWithAuth('/api/forge/workshop-chat', {
          method: 'POST',
          body: JSON.stringify({
            agentId: agent.id,
            sessionId,
            message: trimmed,
          }),
        });

        // Isolate JSON parse — if the server (or Vercel's edge) returned
        // plaintext (e.g. "An error occurred with this application..."),
        // res.json() throws a syntax error. We must NOT let that parse
        // error leak into the red toast.
        let data;
        try {
          data = await res.json();
        } catch {
          pushFallbackBubble(
            'Something went wrong — try sending your message again.'
          );
          return;
        }

        // Known-shape error from the server (valid JSON, `error: true`).
        // Display as a regular agent bubble, preserve thesis, don't burn budget.
        if (data?.error === true) {
          pushFallbackBubble(
            data.agentMessage ||
              'I hit a snag processing that — could you try that again?'
          );
          if (data.activeThesis !== undefined) {
            setActiveThesis(data.activeThesis);
          }
          if (typeof data.messagesUsed === 'number') {
            setMessagesUsed(data.messagesUsed);
          }
          if (typeof data.messageBudget === 'number') {
            setMessageBudget(data.messageBudget);
          }
          return;
        }

        // Hard failures (budget exceeded, auth problems, session closed, etc.)
        // These deserve the red banner — the user needs to know the session
        // state changed, not just that a turn hiccupped.
        if (!res.ok) {
          const msg =
            data?.message ||
            data?.error ||
            `Chat failed (${res.status}). Try again.`;
          setError(msg);
          return;
        }

        // Happy path
        if (data.sessionId && !sessionId) setSessionId(data.sessionId);
        setActiveThesis(data.activeThesis || null);
        setMessagesUsed(data.messagesUsed || 0);
        if (typeof data.messageBudget === 'number') setMessageBudget(data.messageBudget);

        pushFallbackBubble(data.agentMessage || '');
      } catch (err) {
        // Network failure, fetchWithAuth rejection, etc. Truly unexpected.
        console.error('[WorkshopChat] send failed:', err);
        setError(err.message || 'Something went wrong. Try again.');
      } finally {
        setIsSending(false);
      }
    },
    [agent?.id, sessionId, isSending, isCompiling]
  );

  const handleCompile = useCallback(async () => {
    if (!sessionId || isCompiling) return;
    setError(null);
    setIsCompiling(true);
    try {
      const res = await fetchWithAuth('/api/forge/compile-dimensions', {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          data?.message ||
          data?.error ||
          `Compile failed (${res.status}). Try again.`;
        throw new Error(msg);
      }

      if (onCompiled && data.dimensionValues) {
        onCompiled({
          dimensionValues: data.dimensionValues,
          thesisId: data.thesisId,
          confidence: data.confidence,
          warnings: data.warnings || [],
          mappingNotes: data.mappingNotes || [],
          appliedClamps: data.appliedClamps || [],
        });
      }
    } catch (err) {
      console.error('[WorkshopChat] compile failed:', err);
      setError(err.message || 'Compile failed. Try again.');
      setIsCompiling(false);
    }
  }, [sessionId, isCompiling, onCompiled]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(inputText);
      }
    },
    [inputText, sendMessage]
  );

  const budgetExhausted = messagesUsed >= messageBudget;
  const readyToCompile = Boolean(activeThesis?.readyToCompile) && Boolean(sessionId);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 300,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isDesktop ? 24 : 0,
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          style={{
            width: isDesktop ? 'min(1100px, 100%)' : '100%',
            height: isDesktop ? 'min(800px, 92vh)' : '100vh',
            background: PAGE_BG,
            borderRadius: isDesktop ? 20 : 0,
            border: `1px solid ${BORDER_SUBTLE}`,
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 16px',
              borderBottom: `1px solid ${BORDER_SUBTLE}`,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: CARD_BG,
            }}
          >
            <MessageSquare size={20} color={TROPHY_GOLD} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: TEXT_PRIMARY,
                  lineHeight: 1.2,
                }}
              >
                Workshop with {agent?.name || 'your agent'}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: TROPHY_GOLD,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginTop: 2,
                }}
              >
                Strategy Development
              </div>
            </div>
            {/* Budget pill */}
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 999,
                background: SURFACE_BG,
                border: `1px solid ${BORDER_SUBTLE}`,
                color: budgetExhausted ? NEGATIVE : TEXT_SECONDARY,
              }}
            >
              {messagesUsed} / {messageBudget}
            </div>
            {/* Mobile: Thesis toggle */}
            {!isDesktop && (
              <button
                onClick={() => setShowThesisMobile((v) => !v)}
                aria-label="Toggle thesis panel"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  border: `1px solid ${BORDER_SUBTLE}`,
                  background: showThesisMobile ? SURFACE_BG : 'transparent',
                  color: readyToCompile ? TROPHY_GOLD : TEXT_SECONDARY,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <Target size={16} />
                {readyToCompile && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: TROPHY_GOLD,
                    }}
                  />
                )}
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: TEXT_SECONDARY,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body — desktop: side-by-side, mobile: chat or thesis */}
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            {/* Chat panel */}
            <div
              style={{
                flex: isDesktop ? '1 1 auto' : '1 1 100%',
                display: isDesktop ? 'flex' : showThesisMobile ? 'none' : 'flex',
                flexDirection: 'column',
                minWidth: 0,
                background: PAGE_BG,
              }}
            >
              <div
                ref={scrollRef}
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: 16,
                  scrollBehavior: 'smooth',
                }}
              >
                {messages.length === 0 && !isSending ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      padding: '24px 16px',
                      textAlign: 'center',
                      gap: 12,
                    }}
                  >
                    <Sparkles size={28} color={TROPHY_GOLD} />
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: TEXT_PRIMARY,
                        maxWidth: 360,
                        lineHeight: 1.5,
                      }}
                    >
                      Tell your agent what kind of strategy you want to test.
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: TEXT_MUTED,
                        maxWidth: 360,
                        lineHeight: 1.6,
                      }}
                    >
                      What conditions should your algorithm exploit? When do
                      you enter, and when do you cut? Start with a rough idea
                      — we'll shape it together.
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((m) => (
                      <ChatBubble key={m.id} message={m} agentName={agent?.name} />
                    ))}
                    {isSending && <TypingIndicator agentName={agent?.name} />}
                  </>
                )}
              </div>

              {/* Error banner */}
              {error && (
                <div
                  style={{
                    padding: '10px 16px',
                    background: 'rgba(239, 68, 68, 0.08)',
                    borderTop: `1px solid ${NEGATIVE}`,
                    color: NEGATIVE,
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  {error}
                </div>
              )}

              {/* Input */}
              <div
                style={{
                  padding: 12,
                  borderTop: `1px solid ${BORDER_SUBTLE}`,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-end',
                  background: CARD_BG,
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value.slice(0, 2000))}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    budgetExhausted
                      ? 'Session full — compile or close'
                      : isCompiling
                      ? 'Compiling…'
                      : 'Describe your strategy idea…'
                  }
                  disabled={isSending || isCompiling || budgetExhausted}
                  rows={1}
                  style={{
                    flex: 1,
                    background: SURFACE_BG,
                    border: `1px solid ${BORDER_SUBTLE}`,
                    borderRadius: 12,
                    padding: '10px 14px',
                    color: TEXT_PRIMARY,
                    fontSize: 14,
                    outline: 'none',
                    resize: 'none',
                    minHeight: 42,
                    maxHeight: 120,
                    fontFamily: 'inherit',
                    lineHeight: 1.4,
                    opacity: isSending || isCompiling || budgetExhausted ? 0.5 : 1,
                  }}
                />
                <button
                  onClick={() => sendMessage(inputText)}
                  disabled={
                    !inputText.trim() || isSending || isCompiling || budgetExhausted
                  }
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background:
                      !inputText.trim() || isSending || isCompiling || budgetExhausted
                        ? 'rgba(94, 234, 212, 0.15)'
                        : TEAL,
                    color:
                      !inputText.trim() || isSending || isCompiling || budgetExhausted
                        ? TEAL
                        : '#0D0E12',
                    border: 'none',
                    cursor:
                      !inputText.trim() || isSending || isCompiling || budgetExhausted
                        ? 'not-allowed'
                        : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>

            {/* Thesis panel — desktop: sidebar, mobile: full */}
            <div
              style={{
                width: isDesktop ? 340 : '100%',
                display: isDesktop ? 'flex' : showThesisMobile ? 'flex' : 'none',
                flexDirection: 'column',
                borderLeft: isDesktop ? `1px solid ${BORDER_SUBTLE}` : 'none',
                background: CARD_BG,
                flexShrink: 0,
              }}
            >
              {!isDesktop && (
                <button
                  onClick={() => setShowThesisMobile(false)}
                  style={{
                    padding: '12px 16px',
                    border: 'none',
                    borderBottom: `1px solid ${BORDER_SUBTLE}`,
                    background: 'transparent',
                    color: TEXT_SECONDARY,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  <ChevronDown size={14} /> Back to Chat
                </button>
              )}
              <ThesisPanel
                thesis={activeThesis}
                readyToCompile={readyToCompile}
                compileDisabled={isCompiling || isSending}
                isCompiling={isCompiling}
                onCompile={handleCompile}
              />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
