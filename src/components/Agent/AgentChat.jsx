import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import TradeTickerCard from './TradeTickerCard';
import LiveActivityPanel from './LiveActivityPanel';
import InlineTradingGradeCard from './InlineTradingGradeCard';
import { submitDailyGrades } from '../../services/agentService';

// "Didn't respond" means the proposal hit its deadline without the user
// approving or vetoing. In strategist mode, agent-evaluate.js writes
// resolution='lapsed' on the resolved entry (the agent held its position).
// Copilot mode auto-executes on expiry (resolution='auto_executed'), which
// we exclude because the agent didn't hold — it traded. Vetoed proposals
// are also excluded because a veto IS a response.
export function filterUnansweredProposals(proposalHistory) {
  if (!Array.isArray(proposalHistory)) return [];
  return proposalHistory.filter(p => p && p.resolution === 'lapsed');
}

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
  const threadId = directive?.directiveThreadId || null;
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
      {threadId && (
        <div style={{
          fontSize: 10,
          color: 'rgba(94, 234, 212, 0.5)',
          fontFamily: 'monospace',
          marginTop: 6,
          letterSpacing: '0.04em',
        }}>
          thread · {threadId.slice(-6)}
        </div>
      )}
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

// Type-driven rendering config (Phase 1 Voice Layer Rework, spec §4.6). Adding
// a new agent-initiated messageType (trade_narration, anticipation, etc.) only
// requires extending this map — no MessageBubble branches.
const RENDER_CONFIG = {
  user_initiated:    { accent: '#5EEAD4', label: null },
  auto_debrief:      { accent: '#f59e0b', label: { emoji: '📋', text: 'Post-Market Debrief' } },
  first_message:     { accent: '#5EEAD4', label: null },
};

function resolveMessageType(message) {
  if (message?.messageType && RENDER_CONFIG[message.messageType]) return message.messageType;
  if (message?.isAutoDebrief) return 'auto_debrief';
  return 'user_initiated';
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

  // Agent message — type-driven accent + label.
  const messageType = resolveMessageType(message);
  const cfg = RENDER_CONFIG[messageType] || RENDER_CONFIG.user_initiated;
  const accent = cfg.accent;
  const label = cfg.label;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 12 }}
    >
      {label ? (
        <div style={{
          color: accent,
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 4,
          paddingLeft: 4,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span>{label.emoji}</span>
          <span>{label.text}</span>
        </div>
      ) : null}
      <div style={{
        color: accent,
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
        borderLeft: `3px solid ${accent}`,
        borderTop: label ? `1px solid ${accent}` : 'none',
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

// ─── Unanswered Proposal Card ────────────────────────────────────────────────

// Rendered at the transition point between live play and the post-market
// debrief for proposals that expired without a user response. Informational
// only — no approve/veto buttons (the window is closed).
function UnansweredProposalCard({ proposal }) {
  const desc = proposal?.symbolOut && proposal?.symbolIn
    ? `${proposal.symbolOut} → ${proposal.symbolIn}`
    : proposal?.description || proposal?.summary || 'an in-flight swap';
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        alignSelf: 'stretch',
        margin: '6px 0',
        padding: '10px 12px',
        background: 'rgba(245, 158, 11, 0.04)',
        borderLeft: '2px solid #f59e0b',
        borderRadius: '0 8px 8px 0',
        fontSize: 12.5,
        lineHeight: 1.45,
        color: '#9CA3AF',
      }}
    >
      You didn't respond to this proposal:{' '}
      <span style={{ color: '#E5E7EB', fontWeight: 600 }}>{desc}</span>
      . The agent held its position.
    </motion.div>
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

export default function AgentChat({
  battleId,
  agentId,
  agentName,
  chatExchanges,
  battleStatus,
  statusFeed,
  trades = [],
  onSymbolClick,
  onSwitchToGameTape,
  knownTickers,
  // Phase 6: review-mode props
  dailyGrades = {},
  chatBudgetUsed = 0,
  reviewBudgetUsed = 0,
  proposalHistory = [],
}) {
  // Phase 1 Voice Layer Rework (spec §4.5): chat exchanges are now derived
  // reactively from the chatExchanges prop so Firestore-initiated writes
  // (first-message-on-deploy, auto-debrief, future Phase 2-6 proactive types)
  // render in real time without a remount. Local state holds ONLY in-flight
  // UI items (optimistic user bubbles + typing indicator) that have not yet
  // been confirmed by the server. The two are merged at render time below.
  const [inFlightMessages, setInFlightMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('chat');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Today's date in ET — matches agent-batch-review.js and is the bucket key
  // for dailyGrades writes. Recomputed each render is fine (cheap).
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  // Current mode inferred from the most recent exchange. In review mode the
  // budget limit is 5 (vs 10 in battle mode), the send disable logic checks
  // the review counter, and the timeline gets the grading section.
  const currentMode = React.useMemo(() => {
    if (!chatExchanges || chatExchanges.length === 0) return 'battle';
    const last = chatExchanges[chatExchanges.length - 1];
    return last?.mode === 'review' ? 'review' : 'battle';
  }, [chatExchanges]);

  const activeBudgetUsed = currentMode === 'review' ? reviewBudgetUsed : chatBudgetUsed;
  const activeBudgetLimit = currentMode === 'review' ? 5 : 10;

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

  const isDisabled = isSending || activeBudgetUsed >= activeBudgetLimit || battleStatus === 'completed';

  // ── Server-confirmed messages, derived reactively from chatExchanges ──────
  // Phase 1 Voice Layer Rework (spec §4.5): replaces the prior one-shot mount
  // hydration. Whenever Firestore pushes a new exchange (first-message,
  // auto-debrief, user-initiated reply), this useMemo recomputes and the
  // chat re-renders. Suppression of the user bubble for agent-initiated
  // messages is type-driven (messageType > isAutoDebrief > userMessage check),
  // covering both the new typed schema and legacy entries.

  const serverMessages = React.useMemo(() => {
    if (!chatExchanges || chatExchanges.length === 0) return [];

    const out = [];
    chatExchanges.forEach((ex, i) => {
      const ts = ex.timestamp?.toMillis?.()
        || (typeof ex.timestamp === 'string' ? new Date(ex.timestamp).getTime() : null)
        || Date.now();

      const messageType = ex.messageType
        || (ex.isAutoDebrief ? 'auto_debrief' : 'user_initiated');

      // Suppress user half for any agent-initiated exchange.
      const isAgentInitiated =
        messageType !== 'user_initiated'
        || ex.userMessage == null
        || ex.userMessage === '__REVIEW_START__'; // legacy compat

      if (!isAgentInitiated) {
        out.push({
          id: `exchange-${i}-user`,
          role: 'user',
          text: ex.userMessage,
          suggestedActions: null,
          timestamp: ts,
          _serverIndex: i,
        });
      }

      const isLast = i === chatExchanges.length - 1;
      out.push({
        id: `exchange-${i}-agent`,
        role: 'agent',
        text: ex.agentResponse,
        suggestedActions: isLast ? (ex.suggestedActions || null) : null,
        scratchpad: ex.scratchpad || null,
        hasDirective: ex.hasDirective || false,
        directive: ex.hasDirective && ex.directive
          ? { text: ex.directive.text, directiveThreadId: ex.directive.directiveThreadId || null }
          : null,
        isAutoDebrief: !!ex.isAutoDebrief,
        messageType,
        mode: ex.mode || 'battle',
        timestamp: ts,
        _serverIndex: i,
      });
    });
    return out;
  }, [chatExchanges]);

  // ── Reconcile in-flight optimistic bubbles against server arrivals ────────
  // When the server confirms a user-initiated exchange whose userMessage
  // matches a pending optimistic bubble (trimmed text + close timestamp),
  // drop the in-flight entry so we don't double-render.

  useEffect(() => {
    if (inFlightMessages.length === 0) return;
    setInFlightMessages(prev => prev.filter(im => {
      if (im.role !== 'user') return true; // typing indicators handled elsewhere
      const imText = String(im.text || '').trim();
      if (!imText) return true;
      const matched = (chatExchanges || []).some(ex => {
        if (ex.userMessage == null) return false;
        if (String(ex.userMessage).trim() !== imText) return false;
        const exTs = ex.timestamp?.toMillis?.()
          || (typeof ex.timestamp === 'string' ? new Date(ex.timestamp).getTime() : 0);
        const imTs = im.timestamp || 0;
        return Math.abs(exTs - imTs) < 60_000;
      });
      return !matched;
    }));
  }, [chatExchanges]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 30s timeout for in-flight bubbles ─────────────────────────────────────
  // Per spec §4.5 refinement: if an optimistic user bubble has been pending
  // for more than 30 seconds without a matching server arrival, drop it and
  // surface a banner via the existing error UI. Avoids leaving "stuck"
  // bubbles in the timeline.

  useEffect(() => {
    if (inFlightMessages.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setInFlightMessages(prev => {
        let timedOut = false;
        const next = prev.filter(im => {
          if (im.role === 'user' && (now - (im.timestamp || 0)) > 30_000) {
            timedOut = true;
            return false;
          }
          // Drop stuck typing indicators that have been live for >30s too.
          if (im.isTyping && (now - (im._createdAt || 0)) > 30_000) {
            timedOut = true;
            return false;
          }
          return true;
        });
        if (timedOut) {
          setError(prevErr => prevErr || 'Message timed out. Try again.');
          setIsSending(false);
        }
        return next;
      });
    }, 5_000);
    return () => clearInterval(interval);
  }, [inFlightMessages.length]);

  // Merged view used by the timeline. Server messages first (chronological),
  // then in-flight items (always newer than anything in serverMessages because
  // the server can only confirm in the past).
  const messages = React.useMemo(
    () => [...serverMessages, ...inFlightMessages],
    [serverMessages, inFlightMessages],
  );

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
    if (!text.trim() || isSending || activeBudgetUsed >= activeBudgetLimit) return;

    const trimmed = text.trim();

    // 1. Append optimistic user bubble + typing indicator to in-flight state.
    //    The user bubble stays until the Firestore listener confirms the
    //    matching exchange landed (reconciliation effect above), or until
    //    the 30s timeout drops it.
    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      suggestedActions: null,
      timestamp: Date.now(),
    };
    const typingId = `typing-${Date.now()}`;
    const typingMsg = { id: typingId, role: 'agent', isTyping: true, _createdAt: Date.now() };

    setInFlightMessages(prev => [...prev, userMsg, typingMsg]);
    setInputText('');
    setError(null);
    setIsSending(true);

    try {
      const user = getAuth().currentUser;
      if (!user) {
        setInFlightMessages(prev => prev.filter(m => m.id !== typingId && m.id !== userMsg.id));
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
        // Drop both the typing indicator AND the optimistic user bubble — the
        // exchange didn't land. Server-side error UI takes over via setError.
        setInFlightMessages(prev => prev.filter(m => m.id !== typingId && m.id !== userMsg.id));

        if (res.status === 401) {
          setError('Session expired. Please refresh.');
        } else if (data.error === 'budget_exceeded' || data.error === 'chat_budget_exceeded') {
          // Server-side budget cap — use the message from the server when provided
          // so the copy matches the current mode (battle vs review).
          setError(data.message || (currentMode === 'review'
            ? "You've used all 5 review messages for today."
            : "You've used all 10 messages for this battle."));
        } else if (res.status === 429) {
          setError('Slow down — too many messages. Try again in a moment.');
        } else if (res.status === 504) {
          setError('Agent took too long. Try again.');
        } else {
          setError('Agent is thinking too hard. Try again.');
        }
        return;
      }

      // 2. On success: drop only the typing indicator. The user bubble stays
      //    until reconciliation matches it against the server-written exchange
      //    (typically within a few hundred ms via the Firestore listener).
      //    The agent's response renders as soon as the listener pushes the new
      //    exchange into chatExchanges — no optimistic insert needed.
      setInFlightMessages(prev => prev.filter(m => m.id !== typingId));
      // Budget counters are prop-driven (chatBudgetUsed / reviewBudgetUsed) —
      // the server's Firestore write propagates back via the snapshot listener
      // in useAgentBattle → new props → updated display.
    } catch (err) {
      // Network error — drop both in-flight items so the user can retry.
      setInFlightMessages(prev => prev.filter(m => m.id !== typingId && m.id !== userMsg.id));
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

  // Budget color reflects the ACTIVE mode's usage so it stays meaningful
  // regardless of which mode we're in.
  const budgetColor =
    activeBudgetUsed >= activeBudgetLimit ? '#EF4444'
    : activeBudgetUsed >= activeBudgetLimit * 0.8 ? '#F59E0B'
    : '#6B7280';

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
          // Phase 7: link trade notifications back to their originating directive.
          directiveThreadId: entry.directiveThreadId || null,
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

  // ── Review-mode injection points in the timeline ──────────────────────────
  // Unanswered proposals render BEFORE the first auto-debrief (transition point
  // from live play to review). Grading cards render AFTER the last auto-debrief
  // so the user can tag the day's trades while reading the debrief.
  const firstAutoDebriefIdx = React.useMemo(() => (
    combinedTimeline.findIndex(it => it._type === 'message' && it.isAutoDebrief)
  ), [combinedTimeline]);
  const lastAutoDebriefIdx = React.useMemo(() => {
    for (let i = combinedTimeline.length - 1; i >= 0; i--) {
      if (combinedTimeline[i]._type === 'message' && combinedTimeline[i].isAutoDebrief) return i;
    }
    return -1;
  }, [combinedTimeline]);

  const unansweredProposals = React.useMemo(
    () => filterUnansweredProposals(proposalHistory),
    [proposalHistory],
  );

  // Today's grades keyed by tradeIndex for fast lookup when rendering the
  // inline grading cards.
  const todayGradesByIndex = React.useMemo(() => {
    const map = new Map();
    const todayEntry = dailyGrades?.[todayStr];
    const list = Array.isArray(todayEntry?.trades) ? todayEntry.trades : [];
    list.forEach(g => {
      if (g && typeof g.tradeIndex === 'number') map.set(g.tradeIndex, g.grade);
    });
    return map;
  }, [dailyGrades, todayStr]);

  // Handle a grade tap from InlineTradingGradeCard. Read-merge-write against
  // the current `dailyGrades[today].trades` array — the service function
  // overwrites that array, so we need the full merged list.
  const handleGrade = React.useCallback(async (tradeIndex, grade) => {
    if (!battleId || typeof tradeIndex !== 'number') return;
    const trade = trades[tradeIndex] || {};
    const existing = Array.isArray(dailyGrades?.[todayStr]?.trades)
      ? dailyGrades[todayStr].trades
      : [];
    // Upsert by tradeIndex.
    const merged = [
      ...existing.filter(g => g?.tradeIndex !== tradeIndex),
      {
        tradeIndex,
        grade,
        symbolOut: trade.symbolOut || null,
        symbolIn: trade.symbolIn || null,
      },
    ];
    try {
      await submitDailyGrades(battleId, todayStr, merged);
    } catch (err) {
      console.error('[AgentChat] Failed to submit grade:', err);
      setError('Could not save grade. Try again.');
    }
  }, [battleId, trades, dailyGrades, todayStr]);

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
          combinedTimeline.map((item, idx) => {
            // Unanswered-proposals block is rendered just BEFORE the first
            // auto-debrief message in the timeline (the transition point from
            // live play to review).
            const leading = (idx === firstAutoDebriefIdx && unansweredProposals.length > 0) ? (
              <React.Fragment key={`unanswered-before-${idx}`}>
                {unansweredProposals.map((p, pi) => (
                  <UnansweredProposalCard
                    key={`unanswered-${pi}-${p?.proposalId || p?.id || pi}`}
                    proposal={p}
                  />
                ))}
              </React.Fragment>
            ) : null;

            // Grading section is rendered just AFTER the last auto-debrief.
            const trailing = (idx === lastAutoDebriefIdx && (trades?.length || 0) > 0) ? (
              <div
                key={`grading-after-${idx}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  marginTop: 4,
                  marginBottom: 8,
                }}
              >
                <div style={{
                  color: '#f59e0b',
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '4px 2px 6px',
                }}>
                  Grade Today's Trades
                </div>
                {trades.map((t, ti) => (
                  <InlineTradingGradeCard
                    key={`grade-${ti}`}
                    trade={t}
                    tradeId={ti}
                    currentGrade={todayGradesByIndex.get(ti) || null}
                    onGrade={handleGrade}
                  />
                ))}
              </div>
            ) : null;

            let body;
            if (item._type === 'trade') {
              const isDirectiveLinked = !!item.directiveThreadId;
              body = (
                <React.Fragment key={item.id}>
                  {isDirectiveLinked && (
                    <div
                      style={{
                        fontSize: 10.5,
                        color: '#5EEAD4',
                        opacity: 0.75,
                        letterSpacing: '0.04em',
                        marginLeft: 10,
                        marginTop: 6,
                        marginBottom: -2,
                      }}
                    >
                      ↳ from directive
                    </div>
                  )}
                  <TradeTickerCard
                    trade={item}
                    onSymbolClick={onSymbolClick}
                    onTradeClick={onSwitchToGameTape ? () => onSwitchToGameTape() : undefined}
                    isDirectiveLinked={isDirectiveLinked}
                  />
                </React.Fragment>
              );
            } else if (item.isTyping) {
              body = <TypingIndicator key={item.id} />;
            } else {
              body = (
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
            }

            return (
              <React.Fragment key={`tl-${idx}-${item.id}`}>
                {leading}
                {body}
                {trailing}
              </React.Fragment>
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

      {/* ── Budget row (dual counters) ───────────────────────────────── */}
      {/* Active mode's counter is prominent; inactive is muted.        */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 16px 4px',
        fontSize: 12,
      }}>
        <span style={{ color: '#6B7280' }}>
          <span>Messages: </span>
          <span style={{
            color: currentMode === 'battle' ? '#FFFFFF' : '#6B7280',
            fontWeight: currentMode === 'battle' ? 600 : 400,
          }}>
            {chatBudgetUsed}/10 battle
          </span>
          <span style={{ color: '#6B7280', margin: '0 6px' }}>·</span>
          <span style={{
            color: currentMode === 'review' ? '#FFFFFF' : '#6B7280',
            fontWeight: currentMode === 'review' ? 600 : 400,
          }}>
            {reviewBudgetUsed}/5 review
          </span>
        </span>
        <BudgetPips used={activeBudgetUsed} total={activeBudgetLimit} />
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
      onSwitchToGameTape={onSwitchToGameTape}
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
