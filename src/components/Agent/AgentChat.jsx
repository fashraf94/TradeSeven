import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';
import { getAuth } from 'firebase/auth';

// ─── Sub-components ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 12 }}>
      <div style={{
        background: '#15171E',
        borderLeft: '3px solid #5EEAD4',
        borderRadius: '0 12px 12px 12px',
        padding: '12px 14px',
        maxWidth: '85%',
      }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              style={{
                width: 7, height: 7,
                borderRadius: '50%',
                background: '#5EEAD4',
                opacity: 0.6,
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

function ActionButton({ text, onClick, disabled }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      whileTap={{ scale: 0.95 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick(text)}
      disabled={disabled}
      style={{
        background: hovered ? 'rgba(94, 234, 212, 0.08)' : 'transparent',
        border: hovered ? '1px solid #5EEAD4' : '1px solid rgba(94, 234, 212, 0.35)',
        borderRadius: 20,
        padding: '6px 14px',
        color: '#5EEAD4',
        fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {text}
    </motion.button>
  );
}

function ExecutionCard({ directive }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        background: 'rgba(94, 234, 212, 0.06)',
        border: '1px solid rgba(94, 234, 212, 0.2)',
        borderRadius: 12,
        padding: '14px 16px',
        marginTop: 8,
        maxWidth: '85%',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 700,
        color: '#5EEAD4',
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        <span>⚡</span>
        <span>DIRECTIVE LOCKED IN</span>
      </div>
      <div style={{
        fontSize: 13,
        color: '#FFFFFF',
        lineHeight: '1.5',
        marginBottom: 10,
      }}>
        {directive.text}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: '#5EEAD4',
                display: 'block',
              }}
              animate={{ opacity: [0.2, 0.7, 0.2] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
            />
          ))}
        </div>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>
          Haiku will act on next evaluation
        </span>
      </div>
    </motion.div>
  );
}

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
      background: 'rgba(245, 158, 11, 0.06)',
      border: '1px solid rgba(245, 158, 11, 0.15)',
      borderRadius: 10,
      padding: '12px 14px',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, color: '#F59E0B',
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

function MessageBubble({ message, agentName, isLastAgent, onActionClick, isSending }) {
  if (message.role === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}
      >
        <div style={{
          background: '#1C1A27',
          borderRadius: '12px 12px 0 12px',
          padding: '10px 14px',
          maxWidth: '85%',
          color: '#FFFFFF',
          fontSize: 14,
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {message.text}
        </div>
      </motion.div>
    );
  }

  // Agent message
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 12 }}
    >
      <div style={{
        color: '#5EEAD4',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        marginBottom: 4,
        paddingLeft: 4,
      }}>
        {agentName}
      </div>
      <div style={{
        background: '#15171E',
        borderLeft: '3px solid #5EEAD4',
        borderRadius: '0 12px 12px 12px',
        padding: '10px 14px',
        maxWidth: '85%',
        color: '#FFFFFF',
        fontSize: 14,
        lineHeight: '1.5',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {message.text}
      </div>
      {message.directive ? (
        <ExecutionCard directive={message.directive} />
      ) : isLastAgent && message.suggestedActions?.length > 0 && !isSending ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, paddingLeft: 4 }}>
          {message.suggestedActions.map((action, i) => (
            <ActionButton key={i} text={action} onClick={onActionClick} disabled={isSending} />
          ))}
        </div>
      ) : null}
    </motion.div>
  );
}

function EmptyState({ onQuickStart, disabled }) {
  const quickStarts = [
    "How's our portfolio looking?",
    "What's the market doing today?",
    "Any moves we should make?",
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      padding: '32px 24px',
      gap: 16,
    }}>
      <div style={{
        color: '#9CA3AF',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: '1.5',
      }}>
        Your agent is ready. Ask about today's market, your portfolio, or what move to make next.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {quickStarts.map((text, i) => (
          <ActionButton key={i} text={text} onClick={onQuickStart} disabled={disabled} />
        ))}
      </div>
    </div>
  );
}

// ─── Budget Pips ─────────────────────────────────────────────────────────────

function BudgetPips({ used, total }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: i < used ? '#5EEAD4' : 'rgba(255,255,255,0.1)',
            transition: 'background 0.2s ease',
          }}
        />
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AgentChat({ battleId, agentId, agentName, chatExchanges, battleStatus, statusFeed }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [budgetUsed, setBudgetUsed] = useState(0);
  const [error, setError] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('chat');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const initialLoadRef = useRef(false);

  const isDisabled = isSending || budgetUsed >= 10 || battleStatus === 'completed';

  // ── Load existing history from chatExchanges prop (first mount only) ───────

  useEffect(() => {
    if (!chatExchanges || initialLoadRef.current) return;

    const loaded = [];
    chatExchanges.forEach((ex, i) => {
      loaded.push({
        id: `exchange-${i}-user`,
        role: 'user',
        text: ex.userMessage,
        suggestedActions: null,
        timestamp: ex.timestamp?.toMillis?.() || Date.now(),
      });

      const isLast = i === chatExchanges.length - 1;
      loaded.push({
        id: `exchange-${i}-agent`,
        role: 'agent',
        text: ex.agentResponse,
        suggestedActions: isLast ? (ex.suggestedActions || null) : null,
        scratchpad: ex.scratchpad || null,
        hasDirective: ex.hasDirective || false,
        directive: ex.hasDirective && ex.directive ? { text: ex.directive.text } : null,
        timestamp: ex.timestamp?.toMillis?.() || Date.now(),
      });
    });

    if (loaded.length > 0) {
      setMessages(loaded);
      setBudgetUsed(chatExchanges.length);
    }
    initialLoadRef.current = true;
  }, [chatExchanges]);

  // ── Auto-scroll on new messages ────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ── Auto-resize textarea ───────────────────────────────────────────────────

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [inputText]);

  // ── Send message ───────────────────────────────────────────────────────────

  async function sendMessage(text) {
    if (!text.trim() || isSending || budgetUsed >= 10) return;

    const trimmed = text.trim();

    // 1. Append user bubble
    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      suggestedActions: null,
      timestamp: Date.now(),
    };

    setMessages(prev => {
      // Clear suggestedActions on the last agent message
      const updated = prev.map((m, i) => {
        if (i === prev.length - 1 && m.role === 'agent' && m.suggestedActions) {
          return { ...m, suggestedActions: null };
        }
        return m;
      });
      return [...updated, userMsg];
    });

    setInputText('');
    setError(null);
    setIsSending(true);

    // 2. Append typing indicator
    const typingId = `typing-${Date.now()}`;
    setMessages(prev => [...prev, { id: typingId, role: 'agent', isTyping: true }]);

    try {
      const user = getAuth().currentUser;
      if (!user) {
        setMessages(prev => prev.filter(m => m.id !== typingId));
        setError('Session expired. Please refresh.');
        return;
      }
      const idToken = await user.getIdToken();
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentId, battleId, message: trimmed }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Remove typing indicator
        setMessages(prev => prev.filter(m => m.id !== typingId));

        if (res.status === 401) {
          setError('Session expired. Please refresh.');
        } else if (res.status === 429) {
          setError('Slow down — too many messages. Try again in a moment.');
        } else if (res.status === 504) {
          setError('Agent took too long. Try again.');
        } else if (data.error === 'chat_budget_exceeded') {
          setError("You've used all 10 messages for this battle.");
          setBudgetUsed(10);
        } else {
          setError('Agent is thinking too hard. Try again.');
        }
        return;
      }

      // 3. Replace typing indicator with real agent message
      const agentMsg = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        text: data.agentMessage,
        suggestedActions: data.suggestedActions || null,
        scratchpad: data.scratchpad || null,
        hasDirective: data.hasDirective || false,
        directive: data.directive || data.extractedRule || null,
        timestamp: Date.now(),
      };

      setMessages(prev => prev.map(m => m.id === typingId ? agentMsg : m));
      setBudgetUsed(prev => data.exchangeNumber || prev + 1);
    } catch (err) {
      // Remove typing indicator on network error
      setMessages(prev => prev.filter(m => m.id !== typingId));
      setError('Agent is thinking too hard. Try again.');
    } finally {
      setIsSending(false);
    }
  }

  // ── Handle action button click ─────────────────────────────────────────────

  function handleActionClick(actionText) {
    sendMessage(actionText);
  }

  // ── Handle keyboard ────────────────────────────────────────────────────────

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  }

  // ── Budget color ───────────────────────────────────────────────────────────

  const budgetColor = budgetUsed >= 10 ? '#EF4444' : budgetUsed >= 8 ? '#F59E0B' : '#6B7280';

  // ── Find last agent message index ──────────────────────────────────────────

  let lastAgentIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'agent' && !messages[i].isTyping) {
      lastAgentIdx = i;
      break;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // ── Build thinking panel entries ────────────────────────────────────────────

  const thinkingEntries = React.useMemo(() => {
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
    const tradeTypes = ['swap', 'emergency_swap', 'trade_executed'];
    (statusFeed || []).forEach(event => {
      if (tradeTypes.includes(event.type)) {
        const ts = event.timestamp?.toMillis?.() || (typeof event.timestamp === 'string' ? new Date(event.timestamp).getTime() : event.timestamp) || 0;
        entries.push({ type: 'trade', event, timestamp: ts });
      }
    });

    // Sort newest first
    entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return entries;
  }, [messages, statusFeed]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
    }}>
      {/* ── Sub-tab bar ───────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {['chat', 'thinking'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              borderBottom: activeSubTab === tab ? '2px solid #5EEAD4' : '2px solid transparent',
              padding: '10px 0',
              fontSize: 13,
              fontWeight: activeSubTab === tab ? 600 : 500,
              color: activeSubTab === tab ? '#5EEAD4' : '#6B7280',
              cursor: 'pointer',
            }}
          >
            {tab === 'chat' ? 'Chat' : 'Agent Thinking'}
          </button>
        ))}
      </div>

      {activeSubTab === 'chat' ? (
        <>
          {/* ── Message scroll area ──────────────────────────────────────── */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 12px 8px',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {messages.length === 0 ? (
              <EmptyState onQuickStart={handleActionClick} disabled={isDisabled} />
            ) : (
              messages.map((msg, i) => {
                if (msg.isTyping) {
                  return <TypingIndicator key={msg.id} />;
                }
                return (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    agentName={agentName}
                    isLastAgent={i === lastAgentIdx}
                    onActionClick={handleActionClick}
                    isSending={isSending}
                  />
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Error message ────────────────────────────────────────────── */}
          {error && (
            <div style={{
              padding: '6px 16px',
              color: '#EF4444',
              fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* ── Budget row ───────────────────────────────────────────────── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 16px 4px',
            color: budgetColor,
            fontSize: 12,
          }}>
            <span>Messages: {budgetUsed} / 10</span>
            <BudgetPips used={budgetUsed} total={10} />
          </div>

          {/* ── Input row ────────────────────────────────────────────────── */}
          <div style={{
            display: 'flex',
            gap: 8,
            padding: '8px 12px 12px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            alignItems: 'flex-end',
          }}>
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={e => setInputText(e.target.value.slice(0, 2000))}
              onKeyDown={handleKeyDown}
              placeholder={battleStatus === 'completed' ? 'Battle ended' : 'Talk to your agent...'}
              disabled={isDisabled}
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
                opacity: isDisabled ? 0.5 : 1,
              }}
            />
            <button
              onClick={() => sendMessage(inputText)}
              disabled={!inputText.trim() || isDisabled}
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: (!inputText.trim() || isDisabled) ? 'rgba(94, 234, 212, 0.15)' : '#5EEAD4',
                border: 'none',
                cursor: (!inputText.trim() || isDisabled) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: (!inputText.trim() || isDisabled) ? '#5EEAD4' : '#0D0E12',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
            >
              <Send size={18} />
            </button>
          </div>

          {/* ── Character count (near limit) ─────────────────────────────── */}
          {inputText.length > 1800 && (
            <div style={{
              textAlign: 'right',
              padding: '0 16px 4px',
              fontSize: 11,
              color: inputText.length > 1950 ? '#EF4444' : '#6B7280',
            }}>
              {inputText.length} / 2000
            </div>
          )}
        </>
      ) : (
        /* ── Agent Thinking panel ──────────────────────────────────────────── */
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
      )}
    </div>
  );
}
