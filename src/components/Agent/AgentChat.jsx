import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import TradeTickerCard from './TradeTickerCard';
import LiveActivityPanel from './LiveActivityPanel';
import InlineTradingGradeCard from './InlineTradingGradeCard';
import { submitDailyGrades } from '../../services/agentService';
import {
  renderMessageWithEntities,
  RENDER_CONFIG,
  resolveMessageType,
} from '../../utils/renderMessageWithEntities';
import { OPENER_LAZY_FALLBACK_ENABLED } from '../../config/featureFlags';
// Phase A (Battle View controller): the receipt strings live in the guarded
// copy module, never inline here (this file is not under the copy guard —
// its error strings would trip it).
import { BATTLE_VIEW_COPY } from '../../screens/battleView/battleViewCopy';
import { deriveChatMessages } from './deriveChatMessages';
import { TradeCard, CheckCard, CheckRunLine } from '../../screens/battleView/TapeCards';
import { collapseQuietChecks, TAPE_KIND } from '../../screens/battleView/buildTape';
import { scopeTape } from '../../screens/battleView/scopeTape';
import { cssVar } from '../../theme/cssTokens';

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

// `receipt` (Phase A, controller flag): undefined flag-off — the shipped card,
// byte-identical; under the flag the screen passes the derived receipt for
// this thread (or null when the exchange carries no thread id), and the card
// replaces the shipped execution promise + infinite pulse with the receipt
// line (D-60: receipts cannot sit beside a promise). The receipt is derived
// from the subscribed doc in the screen (deriveReceipts.js); this card only
// renders what it is handed.
function ExecutionCard({ directive, receipt }) {
  const threadId = directive?.directiveThreadId || null;
  const controllerReceipts = receipt !== undefined;
  const receiptLine = controllerReceipts ? BATTLE_VIEW_COPY.receiptLine(receipt) : null;
  const receiptState = receipt?.state || null;
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
        {/* Under the flag the receipt line carries the state, so the eyebrow
            names the thing (D-68). Flag-off: the shipped label, byte for byte. */}
        <span>{controllerReceipts ? BATTLE_VIEW_COPY.directiveEyebrow : 'DIRECTIVE LOCKED IN'}</span>
      </div>
      <div style={{
        fontSize: 13,
        color: '#FFFFFF',
        lineHeight: '1.5',
        marginBottom: 10,
      }}>
        {directive.text}
      </div>
      {controllerReceipts ? (
        // The receipt line: still, stamped, proven — or nothing at all.
        receiptLine ? (
          <div
            data-receipt={receiptState}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                display: 'block',
                background: receiptState === 'filed' ? cssVar('teal') : 'transparent',
                border: `1px solid ${cssVar('teal')}`,
                opacity: receiptState === 'filed' ? 1 : 0.5,
              }}
            />
            <span style={{
              fontSize: 12,
              color: receiptState === 'filed' ? cssVar('teal') : cssVar('text-secondary'),
              fontVariantNumeric: 'tabular-nums',
            }}>
              {receiptLine}
            </span>
          </div>
        ) : null
      ) : (
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
      )}
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

function MessageBubble({ message, agentName, isLastAgent, onActionClick, isSending, onSymbolClick, knownTickers, receipts, showKindEyebrow = false }) {
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
  // WHAT KIND OF THING THIS IS (flip-prep, extends D-84). D-84 separated the
  // four visual CLASSES; this names the kinds inside the speech class, which
  // the eye cannot separate — a bench note, a trade narration, the seeded
  // opener and an answer to something the player typed all arrive as the same
  // bubble in the same voice. Read off the persisted `messageType`, never
  // inferred from the words.
  //
  // Controller-gated by the caller, so flag-off emits nothing.
  //
  // THREE CONJUNCTS CAME OFF HERE (review L4, mutations ac-02/03/04), because
  // each was provably inert and BUILD_RULES §2 says a conjunct that cannot
  // fail is not a guard:
  //
  //   · `!label` — meant to stop `auto_debrief` wearing two eyebrows. It
  //     cannot fire: `auto_debrief` is deliberately absent from
  //     `tapeKindEyebrow`'s map, so that call already returns null. The rule
  //     is real and is enforced where it actually lives — in the map.
  //   · `message.role === 'agent'` — this function returns for a user message
  //     forty lines above, so the role is always 'agent' by the time we get
  //     here.
  //   · `_hasUserHalf === true` — `deriveChatMessages` writes a boolean, so
  //     the strict compare and a truthiness test are the same test.
  const kindEyebrow = showKindEyebrow
    ? BATTLE_VIEW_COPY.tapeKindEyebrow(
      messageType,
      message._hasUserHalf,
      message._anticipationDirection ?? null,
    )
    : null;
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
      {kindEyebrow ? (
        <div
          data-tape-kind-eyebrow={kindEyebrow}
          style={{
            color: cssVar('text-muted'),
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 3,
            paddingLeft: 4,
          }}
        >
          {kindEyebrow}
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
        {renderMessageWithEntities(message.text, onSymbolClick, knownTickers)}
      </div>
      {message.hasDirective && message.directive ? (
        <ExecutionCard
          directive={message.directive}
          // undefined flag-off (no receipts map) → the shipped card. Under the
          // flag: this thread's receipt, or null when the exchange has none.
          receipt={receipts ? (receipts[message.directive.directiveThreadId] ?? null) : undefined}
        />
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

// Lazy-opener backfill dedupe — module-scoped so it SURVIVES the per-tab-switch
// remount of AgentChat (AgentBattleScreen mounts it under a keyed motion.div). A
// battleId lands here the first time we fire ensure-opener for it and never
// re-fires that session, so no remount can loop the endpoint.
const attemptedOpenerBattleIds = new Set();

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
  // Phase A (Battle View controller): the Why? panel's one door. A string the
  // USER edits and sends through this same path — never a UI-computed value
  // (C2). `{ text, nonce }`; a new nonce fills the composer and focuses it,
  // then the screen is told so the prefill cannot replay on a remount.
  composerPrefill = null,
  onComposerPrefillConsumed = null,
  // Phase A: { [directiveThreadId]: { state, at } } from deriveReceipts, or
  // null flag-off. AgentChat never reads battle.directive itself.
  receipts = null,
  // Phase A2 (A2.2, D-72): the tape's NON-MESSAGE entries — a card per executed
  // swap and a card per decided check — built ONCE in the screen from the
  // subscribed doc (buildTape.js) and merged into the one timeline below. Null
  // flag-off, where `tradeEvents` keeps the shipped slim notification line
  // byte for byte.
  tapeEntries = null,
  // Phase A (A4, the controller layout): render the chat column ALONE at any
  // width — no Live Activity panel, no sub-tab bar. Its status line is the
  // turn line; its alerts and "Agent Reasoning" stay on the Desk and
  // flag-off (rulings §2.5). Absent flag-off, so the shipped layouts are
  // untouched. The message list also contains its overscroll so the mobile
  // sheet owns the scroll at half / full.
  controllerLayout = false,
  // Controller layout only: the mobile sheet at PEEK collapses the message
  // list so the sheet is the handle plus the composer, however tall the
  // draft grows. Ignored flag-off and on desktop.
  listCollapsed = false,
  // Phase A2 (addendum item 11): the controller flag, passed EXPLICITLY rather
  // than inferred from `controllerLayout`. Copy and layout are two rulings and
  // one must not silently carry the other — a future mount that wants the
  // controller's words without its columns, or the reverse, should not have to
  // unpick this. False flag-off, where the shipped strings stand.
  controllerCopy = false,
  // Phase A2 (A2.3, D-73): the piece the stream is scoped to, and the way out.
  // DISPLAY FILTERING ONLY — nothing is sent, the composer is untouched, and
  // both are null flag-off, where the stream is the shipped one.
  scopeSymbol = null,
  onClearScope = null,
  // Phase A2 flip-prep (D-89): the check card `Read the full check` asked for.
  // `{ id, nonce }` — the id is `buildTape`'s own `checkEntryId`, so the card
  // the screen names and the card the builder stamps cannot drift; the nonce
  // re-fires the scroll when the SAME card is asked for twice, exactly as the
  // book panel's tick used to. Null flag-off and whenever nothing is pending.
  openCheck = null,
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
  // A2.3: the scroll area, and where the WHOLE tape was when the player
  // scoped away from it. Recorded on every scroll while unscoped, so there is
  // no transition to intercept and a remount cannot lose it mid-gesture.
  const listRef = useRef(null);
  const unscopedScrollRef = useRef(0);
  const textareaRef = useRef(null);
  // The last prefill this composer applied (Phase A). A composer that still
  // holds exactly that text is untouched and may be re-prefilled; anything
  // else is the user's draft and is never overwritten.
  const lastPrefillRef = useRef('');

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

  // A2.3: the derivation itself is `deriveChatMessages.js` — the screen's
  // `In the chat · {n}` counts the same list this renders (BUILD_RULES §9).
  const serverMessages = React.useMemo(() => deriveChatMessages(chatExchanges), [chatExchanges]);

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

  // ── Lazy opener backfill (OPENER_LAZY_FALLBACK_ENABLED) ───────────────────
  // If the deploy-time opener was silently dropped (Gemma slow → the ~15s abort
  // in the fenced deploy path), backfill it once via POST /api/agent/ensure-opener.
  // The guard is data-driven (no local first_message) PLUS a module-scoped Set
  // that survives this component's per-tab remount — marked BEFORE firing, so
  // every server outcome (generated / floored / no_action_needed) leaves the
  // battle marked and a tab remount never re-POSTs. The server is idempotent and
  // transaction-guarded, so even a stray double-fire cannot duplicate the opener.
  useEffect(() => {
    if (!OPENER_LAZY_FALLBACK_ENABLED) return;
    if (battleStatus !== 'active') return;
    if (!battleId) return; // the server resolves the agent from the battle doc — no agentId needed here
    if (attemptedOpenerBattleIds.has(battleId)) return;
    const hasFirstMessage = (chatExchanges || []).some(
      ex => ex && ex.messageType === 'first_message',
    );
    if (hasFirstMessage) return;
    // Check auth BEFORE marking — a pre-auth render must not burn the one-shot (the
    // effect re-runs when the next chatExchanges snapshot arrives). We mark only
    // once we're committed to firing, which preserves both the no-remount-loop
    // guarantee and the accepted no-retry-on-transient-failure trade-off.
    const user = getAuth().currentUser;
    if (!user) return;
    attemptedOpenerBattleIds.add(battleId);
    (async () => {
      try {
        const idToken = await user.getIdToken();
        await fetch('/api/agent/ensure-opener', {
          method: 'POST',
          headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ battleId }),
        });
        // Ignore the response — the Firestore listener repaints chatExchanges when
        // the write lands. No optimistic insert, no ordering change.
      } catch {
        // A failed backfill must never surface in the chat UI; the battle stays
        // marked (accepted no-retry-this-session trade-off). The deploy attempt
        // already failed independently.
      }
    })();
  }, [chatExchanges, battleId, battleStatus]);

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

  // A2.2 (review L2-F7): a check or trade card landing at the bottom is new
  // content in a stream whose whole premise is "newest at the bottom", and
  // `messages.length` does not move when one arrives. `tapeEntries` is null
  // flag-off, so the second dep is a constant there and the shipped scroll
  // behaviour is unchanged.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, tapeEntries?.length ?? 0]);

  // A2.3: SCOPING moves the stream to its newest entry — the premise of the
  // whole surface is newest-at-the-bottom, and a filtered list is short, so a
  // carried-over scrollTop would land the reader in clamped whitespace.
  // CLEARING puts the whole tape back where the player left it (seed §A2.3),
  // from the position recorded by the scroll handler below. Layout effect, so
  // the restore happens before paint and the list never flashes at the top.
  // THE DEP IS THE SCOPE ALONE (review L2-F5). `tapeEntries` is a fresh array
  // on every Firestore snapshot — and, through `receipts`, on renders that
  // touch nothing in the tape at all — so keeping it here made this effect
  // write `scrollTop` on the coarse clock's minute tick and on every price
  // poll. A programmatic write cancels the smooth scroll the effect above
  // starts, and nothing re-fires to finish it: the reader is left parked
  // partway with the newest card below the fold.
  //
  // THE TRANSITION IS THE SYMBOL'S, NOT THE BOOLEAN'S (review RA-F5). The ref
  // held `Boolean(scopeSymbol)`, so a scope→scope switch — open one row's
  // Why?, tap its door, open another row, tap its door, which never clears the
  // scope in between — read as "no change" and wrote nothing. The reader was
  // left at the first piece's offset in the second piece's stream, against
  // this effect's own premise that a scope opens at its newest entry.
  const scopedRef = useRef(scopeSymbol ?? null);
  useLayoutEffect(() => {
    const was = scopedRef.current;
    const now = scopeSymbol ?? null;
    scopedRef.current = now;
    const el = listRef.current;
    if (!el || !Array.isArray(tapeEntries)) return;
    if (was === now) return;
    el.scrollTop = now ? el.scrollHeight : unscopedScrollRef.current;
    // `tapeEntries` is read for the flag gate only and is deliberately not a
    // dependency; the scope's transition is the whole trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeSymbol]);

  // ── `Read the full check` lands on the card (D-89) ────────────────────────
  //
  // The door used to open the panel above the board and put focus on its
  // heading. It now opens the CHECK'S OWN CARD, here, where the check sits
  // between the checks either side of it and the player can keep reading. This
  // effect is the landing: scroll the card into view, then focus it.
  //
  // A LAYOUT EFFECT, after the list has rendered: the card may not have
  // existed on the render that requested it — it may have been inside a fold
  // until `openCheck.id` unpinned it one memo above — so the query has to run
  // after that render commits, not during it.
  //
  // Keyed on the NONCE, so asking twice for the same card scrolls twice. The
  // card is `tabIndex={-1}`, so focus lands without putting thirty cards in
  // the tab order; `preventScroll` keeps the browser from undoing the scroll
  // that just ran, which is the same pairing the panel's own landing used.
  const openCheckNonce = openCheck?.nonce ?? null;
  const openCheckId = openCheck?.id ?? null;
  useLayoutEffect(() => {
    if (openCheckNonce == null || !openCheckId) return;
    const el = listRef.current?.querySelector(`[data-tape-entry-id="${openCheckId}"]`);
    if (!el) return;
    // INSTANT, and deliberately not reduced-motion-conditional like the
    // panel landing it replaced (review L4, mutation ac-05). A smooth scroll
    // here would race the list's own auto-scroll-to-bottom two effects above,
    // and the card may have appeared on this very commit — animating to a node
    // that did not exist a frame ago is how a reader ends up somewhere neither
    // effect intended. BUILD_RULES §11 is about not inventing motion; this
    // invents none.
    el.scrollIntoView?.({ behavior: 'auto', block: 'nearest' });
    // …and the focus must not undo the scroll that just ran.
    el.focus?.({ preventScroll: true });
  }, [openCheckNonce, openCheckId]);

  // ── Composer prefill (Phase A — the Why? door) ─────────────────────────────
  useEffect(() => {
    if (!composerPrefill || composerPrefill.nonce == null) return;
    const text = String(composerPrefill.text ?? '').slice(0, 2000);
    // A draft the user already typed wins over the prefill (review finding
    // F13): an empty prefill (the book door) only focuses; a piece prefill
    // fills the composer only when it is empty or still holds the previous,
    // untouched prefill.
    const untouched = !inputText.trim() || inputText === lastPrefillRef.current;
    if (text && untouched) {
      setInputText(text);
      lastPrefillRef.current = text;
    }
    const el = textareaRef.current;
    if (el && typeof el.focus === 'function') {
      el.focus();
      // The value lands on the next render; put the caret after it then.
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
          try {
            const n = el.value.length;
            el.setSelectionRange?.(n, n);
          } catch {
            // jsdom / SSR: no selection API — the focus alone is enough.
          }
        });
      }
    }
    if (typeof onComposerPrefillConsumed === 'function') onComposerPrefillConsumed();
  }, [composerPrefill?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-resize textarea ───────────────────────────────────────────────────

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [inputText]);

  // ── Send message ───────────────────────────────────────────────────────────

  // The line a send that never reached the model leaves behind (addendum item
  // 11). One expression, so the two failure branches below — an unhandled
  // server status and a thrown request — cannot drift apart, which is exactly
  // what the shipped pair did nothing to prevent.
  const sendFailedCopy = controllerCopy
    ? BATTLE_VIEW_COPY.chatSendFailed
    : 'Agent is thinking too hard. Try again.';

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
          setError(sendFailedCopy);
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
      setError(sendFailedCopy);
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

  // ONE ARRAY, ONE SORT (A2.2). Under the controller flag the tape's entries
  // REPLACE the slim notification line — same array, same sort, richer items —
  // and runs of quiet checks fold afterwards, on the merged stream, where
  // adjacency is knowable (a swap between two checks is a trade card between
  // them, which is what makes "positions unchanged" true by construction).
  // Flag-off `tapeEntries` is null and this is the shipped path exactly.
  const combinedTimeline = React.useMemo(() => {
    const nonMessages = Array.isArray(tapeEntries) ? tapeEntries : tradeEvents;
    const allItems = [
      ...messages.map(m => ({ ...m, _type: 'message', timestamp: m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp || 0) })),
      ...nonMessages,
    ];
    const sorted = allItems.sort((a, b) => {
      const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
      const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
      return timeA - timeB;
    });
    if (!Array.isArray(tapeEntries)) return sorted;
    // A2.3: SCOPED runs over the unfolded stream and does NOT fold. `{n}
    // checks · no change` stands for a contiguous slice of the WHOLE tape;
    // a filtered stream has different adjacency, so a run built for one is
    // meaningless in the other — and a folded run shows no text, so it names
    // no piece either way (scopeTape.js).
    if (scopeSymbol) return scopeTape(sorted, scopeSymbol, knownTickers);
    // …and the card the player asked to read is never folded away (D-89): a
    // HOLD with words is `quiet` by D-77's conjuncts, so the ordinary target
    // of that door is the ordinary member of a run.
    return collapseQuietChecks(sorted, openCheck?.id ?? null);
  }, [messages, tradeEvents, tapeEntries, scopeSymbol, knownTickers, openCheck?.id]);

  // ── Review-mode injection points in the timeline ──────────────────────────
  // Unanswered proposals render BEFORE the first auto-debrief (transition point
  // from live play to review). Grading cards render AFTER the last auto-debrief
  // so the user can tag the day's trades while reading the debrief.
  //
  // A2.3: NEITHER RENDERS WHILE THE TAPE IS SCOPED (review RB-F8). Both blocks
  // are attached by INDEX, after `scopeTape` has already run, and neither is a
  // tape item that the filter could have judged: the grading block lists every
  // trade in the battle and the proposal cards are the day's unanswered ones.
  // So `NVDA · All` was showing a `GILD → MOS` grading card — the filter had
  // dropped GILD's own card one line above it. Any battle past its first
  // auto-debrief reaches this, which is every battle in review.
  //
  // -1 is the suppression, and it is the path the shipped code already takes
  // when a document has no auto-debrief at all: no `idx` can equal it.
  const firstAutoDebriefIdx = React.useMemo(() => (
    scopeSymbol ? -1 : combinedTimeline.findIndex(it => it._type === 'message' && it.isAutoDebrief)
  ), [combinedTimeline, scopeSymbol]);
  const lastAutoDebriefIdx = React.useMemo(() => {
    if (scopeSymbol) return -1;
    for (let i = combinedTimeline.length - 1; i >= 0; i--) {
      if (combinedTimeline[i]._type === 'message' && combinedTimeline[i].isAutoDebrief) return i;
    }
    return -1;
  }, [combinedTimeline, scopeSymbol]);

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

  // ── What the scope ANNOUNCES (A2.3, review RB-F10) ────────────────────────
  //
  // Activating the door moves focus to the COMPOSER, with the piece's prefill
  // — deliberately, that is the door's whole point — which throws a screen
  // reader past the stream that just changed under it with nothing said. A
  // polite live region says it instead, without taking the focus back.
  //
  // Keyed on the scope's TRANSITION, never on the stream's length: the length
  // moves on every Firestore snapshot, and a region that re-speaks on each
  // one is worse than silence. The ref holds what was last spoken; the count
  // is read at the moment of the change. Empty on mount, so nothing is
  // announced for arriving at a page.
  const [scopeAnnouncement, setScopeAnnouncement] = React.useState('');
  const scopeSpokenRef = React.useRef(scopeSymbol ?? null);
  React.useEffect(() => {
    const now = scopeSymbol ?? null;
    if (scopeSpokenRef.current === now) return;
    scopeSpokenRef.current = now;
    setScopeAnnouncement(BATTLE_VIEW_COPY.scopeAnnounce(now, combinedTimeline.length));
  }, [scopeSymbol, combinedTimeline.length]);

  // ── Render ─────────────────────────────────────────────────────────────────

  // ── Shared JSX fragments ──────────────────────────────────────────────────

  const chatContent = (
    <>
      {/* ── The piece scope (A2.3, D-73) ─────────────────────────────────
          The chip says what the stream is filtered to and how to leave:
          `NVDA · All`, where `All` is the way back to the whole tape. It is a
          fact about the DISPLAY — nothing was sent and nothing changed on the
          battle — so it sits above the stream rather than in it. Absent
          unscoped, and gated on the TAPE rather than on the caller: flag-off
          the filter below cannot run, so a chip would name a scope that is
          not applied. */}
      {Array.isArray(tapeEntries) && scopeSymbol && typeof onClearScope === 'function' && (
        <div style={{ padding: '8px 12px 0', display: 'flex' }}>
          <button
            type="button"
            data-tape-scope={scopeSymbol}
            aria-label={BATTLE_VIEW_COPY.scopeChipName(scopeSymbol)}
            onClick={onClearScope}
            style={{
              background: 'transparent',
              border: `1px solid ${cssVar('teal')}`,
              color: cssVar('teal'),
              borderRadius: 14,
              padding: '3px 10px',
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: '0.02em',
              cursor: 'pointer',
            }}
          >
            {BATTLE_VIEW_COPY.scopeChip(scopeSymbol)}
          </button>
        </div>
      )}

      {/* ── Message scroll area ──────────────────────────────────────── */}
      <div
        ref={listRef}
        onScroll={(e) => { if (!scopeSymbol) unscopedScrollRef.current = e.currentTarget.scrollTop; }}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 12px 8px',
          display: 'flex',
          flexDirection: 'column',
          ...(controllerLayout ? { overscrollBehavior: 'contain' } : {}),
          ...(controllerLayout && listCollapsed ? { display: 'none' } : {}),
        }}
      >
        {/* The empty state asks whether the TIMELINE is empty, not whether two
            of its inputs are (review L1-F8 / L2-F1 / L2-F2). Flag-off the two
            questions have the same answer — `combinedTimeline` is exactly
            `messages` plus `tradeEvents` — so this is byte-identical there.
            Under the flag `tradeEvents` no longer feeds the stream, and the
            old test both SUPPRESSED a tape of check cards on a battle with no
            chat yet, and left a blank region on a legacy doc with feed swap
            entries but no `trades[]`. */}
        {combinedTimeline.length === 0 ? (
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
            if (item._type === TAPE_KIND.CHECK) {
              body = <CheckCard key={item.id} entry={item} startExpanded={openCheck?.id === item.id} />;
            } else if (item._type === TAPE_KIND.CHECK_RUN) {
              body = <CheckRunLine key={item.id} entry={item} />;
            } else if (item._type === 'trade' && Array.isArray(tapeEntries)) {
              // Under the flag the card carries the tier, the banked points and
              // the motive with its author named — everything the slim line
              // could not (D-72). The `↳ from directive` echo rides the card.
              body = <TradeCard key={item.id} entry={item} />;
            } else if (item._type === 'trade') {
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
                  receipts={receipts}
                  // Gated on the TAPE, not on `controllerCopy`: the eyebrow
                  // names a kind of tape entry, so it belongs where the stream
                  // is the tape. Flag-off `tapeEntries` is null and the bubbles
                  // are byte-identical.
                  showKindEyebrow={Array.isArray(tapeEntries)}
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
      {/* The scope's live region (A2.3, review RB-F10). Present whenever the
          tape is — not only while scoped — so it is in the DOM BEFORE its text
          changes; a region that appears together with its content is missed by
          most readers. LAST, because the chat's own layout reads its children
          by position and a node that says nothing must not take the stream's
          place in that order. Off the screen, never off the accessibility
          tree. Absent flag-off. */}
      {Array.isArray(tapeEntries) && (
        <div
          data-scope-announce
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute', width: 1, height: 1, overflow: 'hidden',
            clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', whiteSpace: 'nowrap',
          }}
        >
          {scopeAnnouncement}
        </div>
      )}
    </>
  );

  const activityContent = controllerLayout ? null : (
    <LiveActivityPanel
      messages={messages}
      statusFeed={statusFeed}
      onSwitchToGameTape={onSwitchToGameTape}
    />
  );

  // ── Layout ──────────────────────────────────────────────────────────────────

  if (controllerLayout) {
    // ── Controller (Phase A, A4): the chat column alone, any width ───────
    return (
      <div
        data-chat-layout="controller"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
        }}
      >
        {chatContent}
      </div>
    );
  }

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
