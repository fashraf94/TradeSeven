import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import TradeTickerCard from './TradeTickerCard';
import LiveActivityPanel from './LiveActivityPanel';

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
          Executing on next evaluation window
        </span>
      </div>
    </motion.div>
  );
}

// ── Ticker detection in chat messages ─────────────────────────────────────────

const EXCLUDED_WORDS = new Set([
  'I', 'A', 'AM', 'PM', 'AT', 'IN', 'ON', 'OR', 'IF', 'IT', 'IS', 'TO',
  'THE', 'AND', 'BUT', 'FOR', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS',
  'ONE', 'OUR', 'OUT', 'ARE', 'HAS', 'HIS', 'HOW', 'ITS', 'LET', 'MAY',
  'NEW', 'NOW', 'OLD', 'SEE', 'WAY', 'WHO', 'DID', 'GET', 'HIM', 'GOT',
  'SAY', 'SHE', 'TOO', 'USE', 'ATR', 'ETF', 'CEO', 'IPO',
  'HOLD', 'SWAP', 'STAR', 'CORE', 'WITH', 'THAT', 'THIS', 'FROM',
  'HAVE', 'BEEN', 'WILL', 'YOUR', 'WHAT', 'WHEN', 'MAKE', 'LIKE',
  'JUST', 'OVER', 'SUCH', 'TAKE', 'THAN', 'THEM', 'VERY', 'SOME',
  'INTO', 'MOST', 'ALSO', 'DONE', 'WANT', 'GOES', 'MUCH',
]);

function renderMessageWithTickers(text, onSymbolClick, knownTickers) {
  if (!text || !onSymbolClick) return text;

  const parts = [];
  let lastIndex = 0;
  const regex = /\b([A-Z]{1,5})\b/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const word = match[1];
    const isKnown = knownTickers?.has(word);
    const isExcluded = EXCLUDED_WORDS.has(word);

    if (isKnown || (!isExcluded && word.length >= 2)) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      parts.push(
        <span
          key={match.index}
          onClick={() => onSymbolClick({ symbol: word })}
          style={{
            color: '#5EEAD4',
            cursor: 'pointer',
            borderBottom: '1px dotted rgba(94, 234, 212, 0.4)',
          }}
        >
          {word}
        </span>
      );
      lastIndex = match.index + word.length;
    }
  }

  if (lastIndex === 0) return text;
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function MessageBubble({ message, agentName, isLastAgent, onActionClick, isSending, onSymbolClick, knownTickers }) {
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
        {renderMessageWithTickers(message.text, onSymbolClick, knownTickers)}
      </div>
      {message.hasDirective && message.directive ? (
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

export default function AgentChat({ battleId, agentId, agentName, chatExchanges, battleStatus, statusFeed, trades = [], onSymbolClick, onCitationTap, knownTickers }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [budgetUsed, setBudgetUsed] = useState(0);
  const [error, setError] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('chat');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const initialLoadRef = useRef(false);

  // Desktop detection (≥768px → side-by-side, <768px → tabs)
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' && window.innerWidth >= 768
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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

  // ── Find last agent message (by id, for combined timeline) ─────────────────

  let lastAgentId = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'agent' && !messages[i].isTyping) {
      lastAgentId = messages[i].id;
      break;
    }
  }

  // ── Extract trade events from statusFeed and merge with battle.trades ─────
  // Reasoning + citations live on statusFeed; prices + P&L live on battle.trades.
  // Join primarily on evalId/evaluationId; fall back to symbolOut+symbolIn.

  const tradeEvents = React.useMemo(() => {
    if (!statusFeed) return [];
    const tradeActions = ['swap', 'emergency_swap', 'trade_executed'];

    // Build lookup maps from battle.trades for O(1) merge.
    const byEvalId = new Map();
    const bySymbolPair = new Map();
    (trades || []).forEach(t => {
      if (!t) return;
      if (t.evaluationId) byEvalId.set(t.evaluationId, t);
      if (t.symbolOut && t.symbolIn) {
        bySymbolPair.set(`${t.symbolOut}__${t.symbolIn}`, t);
      }
    });

    return statusFeed
      .filter(entry => tradeActions.includes(entry.action))
      .map(entry => {
        const ts = typeof entry.timestamp === 'string'
          ? new Date(entry.timestamp)
          : entry.timestamp?.toDate?.()
            || (entry.timestamp?.seconds ? new Date(entry.timestamp.seconds * 1000) : new Date());

        // Find matching trade: evalId first, then symbol pair.
        const tradeMatch = (entry.evalId && byEvalId.get(entry.evalId))
          || (entry.symbolOut && entry.symbolIn
              ? bySymbolPair.get(`${entry.symbolOut}__${entry.symbolIn}`)
              : null)
          || null;

        return {
          id: `trade-${ts.getTime()}-${entry.symbolOut || ''}-${entry.symbolIn || ''}`,
          _type: 'trade',
          timestamp: ts,
          action: entry.action,
          symbolOut: entry.symbolOut || tradeMatch?.symbolOut || null,
          symbolIn: entry.symbolIn || tradeMatch?.symbolIn || null,
          message: entry.message || entry.rationale || '',
          citedForgeRules: entry.citedForgeRules || entry.citedRules || [],
          evalId: entry.evalId || tradeMatch?.evaluationId || null,
          regime: entry.regime || tradeMatch?.entryRegime || null,
          // P&L fields from battle.trades (null when no match — open position).
          tier: tradeMatch?.tier || null,
          entryPrice: tradeMatch?.entryPrice ?? null,
          exitPrice: tradeMatch?.exitPrice ?? null,
          lockedPoints: tradeMatch?.lockedPoints ?? null,
          lockedGainPct: tradeMatch?.lockedGainPct ?? null,
        };
      });
  }, [statusFeed, trades]);

  // ── Combined timeline: messages + trade events sorted chronologically ─────

  const combinedTimeline = React.useMemo(() => {
    const allItems = [
      ...messages.map(m => ({ ...m, _type: 'message', timestamp: m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp || 0) })),
      ...tradeEvents,
    ];
    return allItems.sort((a, b) => {
      const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
      const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
      return timeA - timeB;
    });
  }, [messages, tradeEvents]);

  // ── Render ─────────────────────────────────────────────────────────────────

  // ── Shared JSX fragments ──────────────────────────────────────────────────

  const chatContent = (
    <>
      {/* ── Message scroll area ──────────────────────────────────────── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 12px 8px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {messages.length === 0 && tradeEvents.length === 0 ? (
          <EmptyState onQuickStart={handleActionClick} disabled={isDisabled} />
        ) : (
          combinedTimeline.map((item) => {
            if (item._type === 'trade') {
              return (
                <TradeTickerCard
                  key={item.id}
                  trade={item}
                  onSymbolClick={onSymbolClick}
                  onCitationTap={onCitationTap}
                />
              );
            }
            if (item.isTyping) {
              return <TypingIndicator key={item.id} />;
            }
            return (
              <MessageBubble
                key={item.id}
                message={item}
                agentName={agentName}
                isLastAgent={item.id === lastAgentId}
                onActionClick={handleActionClick}
                isSending={isSending}
                onSymbolClick={onSymbolClick}
                knownTickers={knownTickers}
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
  );

  const activityContent = (
    <LiveActivityPanel
      messages={messages}
      statusFeed={statusFeed}
      onCitationTap={onCitationTap}
    />
  );

  // ── Layout ──────────────────────────────────────────────────────────────────

  if (isDesktop) {
    // ── Desktop: side-by-side ──────────────────────────────────────────────
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}>
        <div style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          gap: '1px',
          background: 'rgba(255,255,255,0.06)',
        }}>
          {/* ── Left: Chat ─────────────────────────────────────────────── */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            background: '#0D0E12',
          }}>
            {chatContent}
          </div>

          {/* ── Right: Live Activity ───────────────────────────────────── */}
          <div style={{
            width: '380px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            background: '#0D0E12',
            minHeight: 0,
          }}>
            <div style={{
              padding: '12px 14px 8px',
              fontSize: '11px',
              fontWeight: 700,
              color: '#5EEAD4',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              Live Activity
            </div>
            {activityContent}
          </div>
        </div>
      </div>
    );
  }

  // ── Mobile: tabbed layout (unchanged) ─────────────────────────────────────
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
        {['chat', 'activity'].map(tab => (
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
            {tab === 'chat' ? 'Chat' : 'Live Activity'}
          </button>
        ))}
      </div>

      {activeSubTab === 'chat' ? chatContent : activityContent}
    </div>
  );
}
