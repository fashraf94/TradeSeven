// src/components/SignalDrop/WatchlistChat.jsx
//
// Sprint 6 Phase 3B — phased dialogue UI for the Signal Drop V2 flow.
//
// Layout:
//   * Full-screen modal (zIndex 300, above SignalDropEntry's 250).
//   * Header — title + budget pill + (mobile) sidebar toggle + close.
//   * PhaseIndicator strip — 4 dots, current phase highlighted.
//   * Body — chat thread (left, ~70%) + sidebar (right, ~30%).
//   * Composer — textarea + send button, budget-exhausted fallback.
//
// API: POST /api/forge/watchlist-dialogue
//   * First turn: { agentId, parseResult, dropId, message } — no sessionId
//   * Subsequent turns: { agentId, sessionId, message, phaseRequest? }
//
// Error handling matrix:
//   * HTTP 200 + error:true (structured)        → fallback bubble, preserve state
//   * HTTP 504 (gemma_timeout, structured)      → fallback bubble, preserve state
//   * HTTP 403 budget_exceeded                  → finalize CTA, composer disabled
//   * HTTP 400 session_not_active / HTTP 404    → toast + close
//   * HTTP 409 concurrent_modification          → auto-retry once after 500ms
//   * Network / AbortError                      → red banner, restore composer text
//
// First-turn failure semantics: when error:true comes back with
// sessionId:null, we LEAVE component sessionId as null so retry triggers
// another first-turn POST (parseResult + dropId, no sessionId). Caching a
// null sessionId would break the retry path.
//
// Sidebar in 3B is a temporary slot-grouped ticker list. Phase 3C
// replaces with WatchlistAnatomyPanel.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles, ListTree, ChevronDown, AlertCircle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { fetchWithAuth } from '../../utils/fetchWithAuth';
import PhaseIndicator from './PhaseIndicator';
import ChatBubble from './components/ChatBubble';
import ActionChip from './components/ActionChip';
import TypingIndicator from './components/TypingIndicator';

const REQUEST_TIMEOUT_MS = 25_000;
const CONCURRENT_RETRY_DELAY_MS = 500;
const MESSAGE_CHAR_CAP = 2000;
const DEFAULT_MESSAGE_BUDGET = 20;

const SLOT_GROUPS = [
  { key: 'core', label: 'Core Plays' },
  { key: 'discovery', label: 'Discovery Plays' },
  { key: 'cross_current', label: 'Cross-Currents' },
  { key: 'unassigned', label: 'Unassigned' },
];

const PHASE_ADVANCE_MARKERS = ['advance', 'move to next phase', 'next phase'];

function isPhaseAdvanceLabel(label) {
  if (typeof label !== 'string') return false;
  const lc = label.toLowerCase();
  return PHASE_ADVANCE_MARKERS.some((m) => lc.includes(m));
}

function isFinalizeLabel(label) {
  if (typeof label !== 'string') return false;
  const lc = label.toLowerCase();
  return lc.includes('finalize') || lc.includes('looks good') || lc.includes('lock in');
}

function isRetryLabel(label) {
  if (typeof label !== 'string') return false;
  return label.trim().toLowerCase() === 'retry';
}

function variantForChip(label, currentPhase) {
  if (isFinalizeLabel(label) || isPhaseAdvanceLabel(label)) {
    return 'phase-advance';
  }
  if (isRetryLabel(label)) {
    return 'secondary';
  }
  if (currentPhase === 'finalize') return 'phase-advance';
  return 'primary';
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function groupTickersBySlot(tickers) {
  const groups = { core: [], discovery: [], cross_current: [], unassigned: [] };
  if (!Array.isArray(tickers)) return groups;
  for (const t of tickers) {
    if (!t?.symbol) continue;
    const slot = t.slot && groups[t.slot] !== undefined ? t.slot : 'unassigned';
    groups[slot].push(t);
  }
  return groups;
}

export default function WatchlistChat({
  isOpen,
  onClose,
  parseResult,
  dropId,
  agentId,
  agentName,
  showToast,
}) {
  const { tokens } = useTheme();
  const { isDesktop } = useIsMobile();

  // ── Session / dialogue state ──────────────────────────────────────
  const [sessionId, setSessionId] = useState(null);
  const [exchanges, setExchanges] = useState([]);
  const [candidateTickers, setCandidateTickers] = useState([]);
  // Anatomy is captured here so the value is updated each turn — Phase
  // 3C reads it via the WatchlistAnatomyPanel. 3B only renders the
  // slot-grouped ticker list, so the read-side of the destructure is
  // intentionally omitted.
  const [, setAnatomy] = useState({
    thesis: null,
    activationConditions: [],
    invalidationConditions: [],
  });
  const [phase, setPhase] = useState('explore');
  const [messagesUsed, setMessagesUsed] = useState(0);
  const [messageBudget, setMessageBudget] = useState(DEFAULT_MESSAGE_BUDGET);
  const [suggestedActions, setSuggestedActions] = useState([]);
  const [readyToFinalize, setReadyToFinalize] = useState(false);

  // ── UI state ──────────────────────────────────────────────────────
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [hardError, setHardError] = useState(null);
  const [budgetExceeded, setBudgetExceeded] = useState(false);
  const [showSidebarMobile, setShowSidebarMobile] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  // Track whether a 409 retry is already in flight so we don't loop.
  const concurrentRetryRef = useRef(false);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const abortRef = useRef(null);

  // Reset everything when (re-)opening.
  useEffect(() => {
    if (!isOpen) return;
    setSessionId(null);
    setExchanges([]);
    setCandidateTickers([]);
    setAnatomy({ thesis: null, activationConditions: [], invalidationConditions: [] });
    setPhase('explore');
    setMessagesUsed(0);
    setMessageBudget(DEFAULT_MESSAGE_BUDGET);
    setSuggestedActions([]);
    setReadyToFinalize(false);
    setInputText('');
    setIsSending(false);
    setHardError(null);
    setBudgetExceeded(false);
    setShowSidebarMobile(false);
    setCloseConfirmOpen(false);
    concurrentRetryRef.current = false;
  }, [isOpen]);

  // Body scroll-lock + Esc handler. Esc suppressed while sending so a
  // mistaken keystroke doesn't kill an in-flight request.
  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(e) {
      if (e.key === 'Escape' && !isSending) {
        handleCloseRequest();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
    // handleCloseRequest captured via closure; fine to omit from deps
    // because we only need the latest values when Esc fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isSending, exchanges.length, budgetExceeded]);

  // Auto-scroll on new messages / typing flips.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [exchanges.length, isSending]);

  // Auto-resize textarea.
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputText]);

  // Cleanup any in-flight request on unmount.
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch {
          // best-effort
        }
      }
    };
  }, []);

  function pushAgentExchange({ content, phase: msgPhase, suggestedActions: actions }) {
    setExchanges((prev) => [
      ...prev,
      {
        id: makeId('agent'),
        role: 'agent',
        content,
        phase: msgPhase,
        suggestedActions: Array.isArray(actions) ? actions : null,
      },
    ]);
  }

  function pushUserExchange({ content, phase: msgPhase }) {
    setExchanges((prev) => [
      ...prev,
      {
        id: makeId('user'),
        role: 'user',
        content,
        phase: msgPhase,
      },
    ]);
  }

  // The core POST. Returns { ok, retryable, kind } so callers can decide
  // what to do next. Mutates state for happy paths and structured errors;
  // throws only for unrecoverable network failures (which the caller
  // catches and surfaces as the hard banner).
  async function postDialogueTurn({ message, phaseRequest, isRetry }) {
    if (!agentId) {
      setHardError('No agent available. Create an agent first.');
      return { ok: false, kind: 'no_agent' };
    }

    const body = sessionId
      ? { agentId, sessionId, message, ...(phaseRequest ? { phaseRequest } : {}) }
      : { agentId, parseResult, dropId, message };

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res;
    try {
      res = await fetchWithAuth('/api/forge/watchlist-dialogue', {
        method: 'POST',
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      abortRef.current = null;
      if (err?.name === 'AbortError') {
        setHardError('That took too long — connection timed out. Try again.');
      } else {
        setHardError(err?.message || 'Connection issue — try again?');
      }
      return { ok: false, kind: 'network' };
    }

    clearTimeout(timeoutId);
    abortRef.current = null;

    let data = null;
    try {
      data = await res.json();
    } catch {
      setHardError('Got an unexpected response from the server. Try again.');
      return { ok: false, kind: 'parse' };
    }

    // ── HTTP 409 — concurrent_modification, single auto-retry ──
    if (res.status === 409 && data?.error === 'concurrent_modification') {
      if (!isRetry && !concurrentRetryRef.current) {
        concurrentRetryRef.current = true;
        pushAgentExchange({
          content: 'Hmm, let me try that again…',
          phase: data.phase || phase,
          suggestedActions: null,
        });
        await new Promise((r) => setTimeout(r, CONCURRENT_RETRY_DELAY_MS));
        const retryResult = await postDialogueTurn({
          message,
          phaseRequest,
          isRetry: true,
        });
        concurrentRetryRef.current = false;
        return retryResult;
      }
      // Retry also failed — surface a manual retry chip.
      pushAgentExchange({
        content:
          'Still hitting a hiccup on my side — try sending that again in a moment.',
        phase: data.phase || phase,
        suggestedActions: ['Retry'],
      });
      if (Array.isArray(data.candidateTickers)) setCandidateTickers(data.candidateTickers);
      if (typeof data.messagesUsed === 'number') setMessagesUsed(data.messagesUsed);
      if (typeof data.messageBudget === 'number') setMessageBudget(data.messageBudget);
      if (data.phase) setPhase(data.phase);
      setSuggestedActions(['Retry']);
      return { ok: false, kind: 'concurrent' };
    }

    // ── HTTP 403 — budget_exceeded ──
    if (res.status === 403 && data?.error === 'budget_exceeded') {
      setBudgetExceeded(true);
      if (typeof data.messageBudget === 'number') setMessageBudget(data.messageBudget);
      // We weren't able to send, so the optimistic user bubble is now
      // stale advice. Push a guidance bubble explaining the state.
      pushAgentExchange({
        content:
          "We've covered a lot of ground here. Want to lock in the list as it stands?",
        phase: 'finalize',
        suggestedActions: ['Finalize watchlist'],
      });
      setSuggestedActions(['Finalize watchlist']);
      return { ok: false, kind: 'budget' };
    }

    // ── HTTP 400 session_not_active or HTTP 404 — session terminated ──
    if (
      (res.status === 400 && data?.error === 'session_not_active') ||
      res.status === 404
    ) {
      if (typeof showToast === 'function') {
        showToast(
          data?.message ||
            'This dialogue has ended. Drop a new signal to start another.',
        );
      }
      onClose?.();
      return { ok: false, kind: 'session_gone' };
    }

    // ── Hard 4xx/5xx with non-structured shape ──
    if (!res.ok && data?.error !== true) {
      const msg =
        (typeof data?.message === 'string' && data.message) ||
        (typeof data?.error === 'string' && data.error) ||
        `Request failed (${res.status}). Try again.`;
      setHardError(msg);
      return { ok: false, kind: 'http' };
    }

    // ── Structured error path (HTTP 200 or 504 with error:true) ──
    if (data?.error === true) {
      // Per audit observation: only adopt sessionId from the response when
      // the response actually carries one. First-turn failures return
      // sessionId:null AND we must keep our component sessionId at null
      // so the next attempt is another first-turn POST.
      if (data.sessionId && !sessionId) setSessionId(data.sessionId);
      if (Array.isArray(data.candidateTickers)) setCandidateTickers(data.candidateTickers);
      if (data.anatomy && typeof data.anatomy === 'object') setAnatomy(data.anatomy);
      if (data.phase) setPhase(data.phase);
      if (typeof data.messagesUsed === 'number') setMessagesUsed(data.messagesUsed);
      if (typeof data.messageBudget === 'number') setMessageBudget(data.messageBudget);
      const fallbackActions = Array.isArray(data.suggestedActions)
        ? data.suggestedActions.map((a) => (a === 'retry' ? 'Retry' : a))
        : ['Retry'];
      pushAgentExchange({
        content:
          data.agentMessage ||
          'I hit a snag processing that — could you try again?',
        phase: data.phase || phase,
        suggestedActions: fallbackActions,
      });
      setSuggestedActions(fallbackActions);
      return { ok: false, kind: 'structured' };
    }

    // ── Happy path ──
    if (data.sessionId && !sessionId) setSessionId(data.sessionId);
    if (Array.isArray(data.candidateTickers)) setCandidateTickers(data.candidateTickers);
    if (data.anatomy && typeof data.anatomy === 'object') setAnatomy(data.anatomy);
    if (data.phase) setPhase(data.phase);
    if (typeof data.messagesUsed === 'number') setMessagesUsed(data.messagesUsed);
    if (typeof data.messageBudget === 'number') setMessageBudget(data.messageBudget);
    setReadyToFinalize(Boolean(data.readyToFinalize));
    const nextActions = Array.isArray(data.suggestedActions) ? data.suggestedActions : [];
    setSuggestedActions(nextActions);
    pushAgentExchange({
      content: data.agentMessage || '',
      phase: data.phase || phase,
      suggestedActions: nextActions.length > 0 ? nextActions : null,
    });
    return { ok: true, kind: 'happy' };
  }

  const sendMessage = useCallback(
    async (rawText, options = {}) => {
      const { phaseRequest = null } = options;
      const trimmed = (rawText || '').trim();
      if (!trimmed) return;
      if (isSending) return;
      if (budgetExceeded && !phaseRequest) return;

      setHardError(null);
      setIsSending(true);

      // Optimistically render the user message at the CURRENT phase
      // (before the server may advance it).
      pushUserExchange({ content: trimmed, phase });

      // Clear the input only after we've captured the trimmed payload —
      // if the network fails we restore it from `trimmed` on the user's
      // next attempt by leaving the composer focused.
      setInputText('');

      // Strip any chips on the previous agent bubble — they're stale once
      // the user has responded.
      setSuggestedActions([]);
      setExchanges((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last.role === 'agent' && last.suggestedActions) {
          return [...prev.slice(0, -1), { ...last, suggestedActions: null }];
        }
        return prev;
      });

      try {
        const result = await postDialogueTurn({
          message: trimmed,
          phaseRequest,
          isRetry: false,
        });
        // On hard network failure, restore the composer text so the user
        // can fix and retry without re-typing.
        if (!result.ok && result.kind === 'network') {
          setInputText(trimmed);
        }
      } catch (err) {
        console.error('[WatchlistChat] sendMessage failed:', err);
        setHardError(err?.message || 'Something went wrong. Try again.');
        setInputText(trimmed);
      } finally {
        setIsSending(false);
      }
    },
    // postDialogueTurn closes over many state setters; we only need the
    // function identity to be stable enough to memoize — full deps would
    // recreate on every state change. The values it reads (sessionId,
    // phase, etc.) come through state setters which are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSending, budgetExceeded, phase, sessionId, agentId, parseResult, dropId],
  );

  function handleActionChipClick(label) {
    if (isRetryLabel(label)) {
      // Re-send the most recent user message verbatim. If we can't find
      // one (shouldn't happen post-first-turn), fall through to typing.
      const lastUser = [...exchanges].reverse().find((e) => e.role === 'user');
      if (lastUser?.content) {
        sendMessage(lastUser.content);
        return;
      }
    }
    if (isPhaseAdvanceLabel(label) || isFinalizeLabel(label)) {
      sendMessage(label, { phaseRequest: 'advance' });
      return;
    }
    sendMessage(label);
  }

  function handleFinalizeClose() {
    // Phase 4 will replace this with the WatchlistEditor handoff. For
    // 3B, finalize-and-close just dismisses the dialogue with a toast.
    if (typeof showToast === 'function') {
      showToast('Watchlist saved as a draft. (Editor lands in Phase 4.)');
    }
    onClose?.();
  }

  function handleCloseRequest() {
    // If the user has nothing to lose (no exchanges, or budget already
    // exhausted and we showed the finalize CTA), close immediately.
    if (exchanges.length === 0) {
      onClose?.();
      return;
    }
    setCloseConfirmOpen(true);
  }

  function handleConfirmClose() {
    setCloseConfirmOpen(false);
    onClose?.();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  }

  if (!isOpen) return null;

  // Find the id of the latest agent exchange so chips render only on it.
  let lastAgentId = null;
  for (let i = exchanges.length - 1; i >= 0; i--) {
    if (exchanges[i].role === 'agent') {
      lastAgentId = exchanges[i].id;
      break;
    }
  }

  const tickerCount = candidateTickers.length;
  const grouped = groupTickersBySlot(candidateTickers);
  const topic =
    typeof parseResult?.parse?.topic === 'string'
      ? parseResult.parse.topic.trim()
      : '';
  const parsedTickers = Array.isArray(parseResult?.parse?.tickers)
    ? parseResult.parse.tickers
    : [];
  const composerDisabled = isSending || budgetExceeded;
  const canSend = !composerDisabled && inputText.trim().length > 0;
  const showFinalizeCTA =
    budgetExceeded || (readyToFinalize && phase === 'finalize');

  return (
    <AnimatePresence>
      <motion.div
        key="watchlist-chat-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 300,
          background: tokens.bgApp,
          display: 'flex',
          flexDirection: 'column',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Watchlist dialogue"
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            background: tokens.bgCard,
            borderBottom: `1px solid ${tokens.borderDefault}`,
            minHeight: 60,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `${tokens.teal}1a`,
              border: `1px solid ${tokens.teal}40`,
              borderRadius: 8,
              color: tokens.teal,
            }}
          >
            <Sparkles size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: tokens.textPrimary,
                lineHeight: 1.25,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Watchlist Workshop with {agentName || 'Gemma'}
            </div>
            <div
              style={{
                marginTop: 2,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                color: tokens.teal,
              }}
            >
              Signal Drop · Dialogue
            </div>
          </div>
          {!isDesktop && (
            <button
              type="button"
              onClick={() => setShowSidebarMobile((v) => !v)}
              aria-label={
                showSidebarMobile ? 'Hide candidate tickers' : 'Show candidate tickers'
              }
              style={{
                position: 'relative',
                width: 36,
                height: 36,
                borderRadius: 8,
                border: `1px solid ${tokens.borderDefault}`,
                background: showSidebarMobile ? tokens.bgAgent : 'transparent',
                color: tokens.textSecondary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ListTree size={16} />
              {tickerCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    minWidth: 16,
                    height: 16,
                    padding: '0 4px',
                    borderRadius: 8,
                    background: tokens.teal,
                    color: tokens.bgApp,
                    fontSize: 10,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {tickerCount}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={handleCloseRequest}
            aria-label="Close dialogue"
            disabled={isSending}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: tokens.textMuted,
              cursor: isSending ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              opacity: isSending ? 0.5 : 1,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Phase indicator strip */}
        <PhaseIndicator
          currentPhase={phase}
          messagesUsed={messagesUsed}
          messageBudget={messageBudget}
        />

        {/* Body — chat thread + sidebar */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          {/* Chat panel */}
          <div
            style={{
              flex: 1,
              display: isDesktop ? 'flex' : showSidebarMobile ? 'none' : 'flex',
              flexDirection: 'column',
              minWidth: 0,
              background: tokens.bgApp,
            }}
          >
            <div
              ref={scrollRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 16px 8px',
                scrollBehavior: 'smooth',
              }}
            >
              {exchanges.length === 0 && !isSending ? (
                <EmptyState
                  topic={topic}
                  parsedTickers={parsedTickers}
                  agentName={agentName}
                  tokens={tokens}
                />
              ) : (
                <>
                  {exchanges.map((ex) => (
                    <ChatBubble
                      key={ex.id}
                      role={ex.role}
                      content={ex.content}
                      phase={ex.phase}
                      agentName={agentName}
                    />
                  ))}
                  {isSending && <TypingIndicator agentName={agentName} />}
                </>
              )}

              {/* Action chips below the latest agent message */}
              {!isSending && lastAgentId && suggestedActions.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginTop: 4,
                    marginBottom: 12,
                    paddingLeft: 4,
                  }}
                >
                  {suggestedActions.map((label, i) => (
                    <ActionChip
                      key={`${lastAgentId}-action-${i}`}
                      label={label}
                      onClick={handleActionChipClick}
                      variant={variantForChip(label, phase)}
                      disabled={isSending}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Hard error banner */}
            {hardError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '10px 16px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  borderTop: `1px solid ${tokens.red}`,
                  color: tokens.red,
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>{hardError}</div>
                <button
                  type="button"
                  onClick={() => setHardError(null)}
                  aria-label="Dismiss error"
                  style={{
                    appearance: 'none',
                    background: 'transparent',
                    border: 'none',
                    color: tokens.red,
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Composer */}
            <Composer
              tokens={tokens}
              textareaRef={textareaRef}
              inputText={inputText}
              setInputText={setInputText}
              onKeyDown={handleKeyDown}
              onSend={() => sendMessage(inputText)}
              canSend={canSend}
              disabled={composerDisabled}
              budgetExceeded={budgetExceeded}
              isSending={isSending}
              showFinalizeCTA={showFinalizeCTA}
              onFinalize={handleFinalizeClose}
            />
          </div>

          {/* Sidebar */}
          <div
            style={{
              width: isDesktop ? 320 : '100%',
              display: isDesktop ? 'flex' : showSidebarMobile ? 'flex' : 'none',
              flexDirection: 'column',
              borderLeft: isDesktop ? `1px solid ${tokens.borderDefault}` : 'none',
              background: tokens.bgCard,
              flexShrink: 0,
              minWidth: 0,
            }}
          >
            {!isDesktop && (
              <button
                type="button"
                onClick={() => setShowSidebarMobile(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  border: 'none',
                  borderBottom: `1px solid ${tokens.borderDefault}`,
                  background: 'transparent',
                  color: tokens.textSecondary,
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <ChevronDown size={14} /> Back to chat
              </button>
            )}
            <SidebarHeader tokens={tokens} count={tickerCount} />
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {SLOT_GROUPS.map((g) => (
                <SlotGroup
                  key={g.key}
                  label={g.label}
                  tickers={grouped[g.key]}
                  tokens={tokens}
                />
              ))}
              <div
                style={{
                  marginTop: 12,
                  fontSize: 10,
                  color: tokens.textFaint,
                  fontStyle: 'italic',
                  lineHeight: 1.5,
                }}
              >
                Phase 3C will replace this list with the full watchlist
                anatomy panel — thesis, activation conditions, and
                invalidation signals per slot.
              </div>
            </div>
          </div>
        </div>

        {/* Close confirmation */}
        <AnimatePresence>
          {closeConfirmOpen && (
            <CloseConfirm
              tokens={tokens}
              onCancel={() => setCloseConfirmOpen(false)}
              onConfirm={handleConfirmClose}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Subviews ──────────────────────────────────────────────────────────

function EmptyState({ topic, parsedTickers, agentName, tokens }) {
  const intro = topic
    ? `Let's explore: ${topic}`
    : `${agentName || 'Gemma'} is ready when you are.`;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 14,
        padding: '8px 4px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: tokens.teal,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
        }}
      >
        <Sparkles size={14} /> {agentName || 'Gemma'}
      </div>

      <div
        style={{
          background: tokens.bgCard,
          borderLeft: `3px solid ${tokens.teal}`,
          borderRadius: '0 12px 12px 12px',
          padding: '14px 16px',
          maxWidth: '92%',
          color: tokens.textPrimary,
          fontSize: 14,
          lineHeight: 1.55,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{intro}</div>
        <div style={{ color: tokens.textSecondary, fontSize: 13 }}>
          What angle of this caught your eye? Tell me what you saw, what you
          want to test, or what you don&apos;t buy yet — we&apos;ll shape a
          watchlist together.
        </div>
      </div>

      {parsedTickers.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            paddingLeft: 4,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              color: tokens.textMuted,
            }}
          >
            Tickers we read
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {parsedTickers.map((sym) => (
              <span
                key={sym}
                style={{
                  background: tokens.bgAgent,
                  border: `1px solid ${tokens.borderDefault}`,
                  color: tokens.teal,
                  padding: '4px 9px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                  letterSpacing: '0.3px',
                }}
              >
                {sym}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarHeader({ tokens, count }) {
  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${tokens.borderDefault}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: tokens.textPrimary,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
        }}
      >
        <ListTree size={14} color={tokens.teal} />
        Candidate Tickers
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 999,
          background: tokens.bgIcon,
          color: count > 0 ? tokens.teal : tokens.textMuted,
        }}
      >
        {count}
      </span>
    </div>
  );
}

function SlotGroup({ label, tickers, tokens }) {
  const list = Array.isArray(tickers) ? tickers : [];
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.6px',
            textTransform: 'uppercase',
            color: tokens.textMuted,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: tokens.textFaint,
          }}
        >
          ({list.length})
        </span>
      </div>
      {list.length === 0 ? (
        <div
          style={{
            fontSize: 11,
            color: tokens.textFaint,
            fontStyle: 'italic',
            paddingLeft: 2,
          }}
        >
          (none yet)
        </div>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {list.map((t) => (
            <li
              key={t.symbol}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '6px 8px',
                background: tokens.bgApp,
                border: `1px solid ${tokens.borderDefault}`,
                borderRadius: 6,
              }}
            >
              <span
                style={{
                  color: tokens.teal,
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                  letterSpacing: '0.3px',
                  flexShrink: 0,
                  minWidth: 48,
                }}
              >
                {t.symbol}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: tokens.textSecondary,
                  lineHeight: 1.4,
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {t.reasoning || t.category || '—'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Composer({
  tokens,
  textareaRef,
  inputText,
  setInputText,
  onKeyDown,
  onSend,
  canSend,
  disabled,
  budgetExceeded,
  isSending,
  showFinalizeCTA,
  onFinalize,
}) {
  if (showFinalizeCTA) {
    return (
      <div
        style={{
          padding: '12px 16px',
          borderTop: `1px solid ${tokens.borderDefault}`,
          background: tokens.bgCard,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: tokens.textSecondary,
            lineHeight: 1.5,
          }}
        >
          {budgetExceeded
            ? "You've reached the message limit. Want to finalize what you've built?"
            : 'Looks ready to lock in. Want to save this watchlist?'}
        </div>
        <button
          type="button"
          onClick={onFinalize}
          style={{
            appearance: 'none',
            padding: '12px 16px',
            background: tokens.medalGold,
            color: tokens.bgApp,
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.3px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Sparkles size={14} />
          {budgetExceeded ? 'Finalize watchlist' : "Looks good — let's edit and save"}
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 12,
        borderTop: `1px solid ${tokens.borderDefault}`,
        background: tokens.bgCard,
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
        flexShrink: 0,
      }}
    >
      <textarea
        ref={textareaRef}
        value={inputText}
        onChange={(e) => setInputText(e.target.value.slice(0, MESSAGE_CHAR_CAP))}
        onKeyDown={onKeyDown}
        placeholder={
          isSending
            ? 'Thinking…'
            : "Tell me what caught your eye…"
        }
        disabled={disabled}
        rows={1}
        style={{
          flex: 1,
          background: tokens.bgApp,
          border: `1px solid ${tokens.borderInput}`,
          borderRadius: 12,
          padding: '10px 14px',
          color: tokens.textPrimary,
          fontSize: 14,
          outline: 'none',
          resize: 'none',
          minHeight: 42,
          maxHeight: 120,
          fontFamily: 'inherit',
          lineHeight: 1.4,
          opacity: disabled ? 0.5 : 1,
        }}
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!canSend}
        aria-label="Send message"
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: canSend ? tokens.teal : `${tokens.teal}26`,
          color: canSend ? tokens.bgApp : tokens.teal,
          border: 'none',
          cursor: canSend ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontFamily: 'inherit',
        }}
      >
        <Send size={18} />
      </button>
    </div>
  );
}

function CloseConfirm({ tokens, onCancel, onConfirm }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 10,
      }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 360,
          background: tokens.bgCard,
          border: `1px solid ${tokens.borderDefault}`,
          borderRadius: 14,
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: tokens.textPrimary,
          }}
        >
          End this dialogue?
        </div>
        <div
          style={{
            fontSize: 13,
            color: tokens.textSecondary,
            lineHeight: 1.5,
          }}
        >
          Your progress isn&apos;t saved yet. Closing now drops what you&apos;ve
          built so far.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              appearance: 'none',
              padding: '10px 14px',
              background: 'transparent',
              border: `1px solid ${tokens.borderInput}`,
              borderRadius: 10,
              color: tokens.textSecondary,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Keep going
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              appearance: 'none',
              padding: '10px 14px',
              background: tokens.red,
              border: 'none',
              borderRadius: 10,
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            End dialogue
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
