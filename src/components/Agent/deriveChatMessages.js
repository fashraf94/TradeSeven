// src/components/Agent/deriveChatMessages.js
//
// THE MESSAGES A CONVERSATION IS MADE OF — Phase A2 (A2.3). PURE.
//
// Lifted out of AgentChat's `serverMessages` memo unchanged. Two callers now
// need the same list and they are in different components:
//
//   · the CHAT renders it (merged with its optimistic in-flight bubbles);
//   · the SCREEN counts it, for `In the chat · {n}` on the Why? panel.
//
// The rule that makes it a list rather than a mapping is the one that would
// have been copied: an AGENT-INITIATED exchange suppresses its user half. A
// first message, an auto-debrief, a trade narration and the legacy
// `__REVIEW_START__` sentinel all carry a `userMessage` that was never typed
// by anyone, and rendering it would put words in the player's mouth. Counting
// it would be the same error one step removed — `In the chat · 3` where the
// player wrote once. One derivation, so the number and the bubbles cannot
// disagree (BUILD_RULES §9).
//
// Nothing here changed in the lift. The chat golden covers the SHAPE, but it
// cannot see two of the rules above (review L3-F2's sibling finding): its
// fixture's first exchange is an `auto_debrief`, so the `__REVIEW_START__`
// sentinel is never the conjunct that fires, and every non-last exchange
// carries `suggestedActions: null`. Both are pinned by name in
// `deriveChatMessages.test.js` instead.

import { GROUNDING_VERSION, DIRECTIVE_FILED_MESSAGE_TYPE, RESEARCH_MESSAGE_TYPE } from '../../data/decisionRecord';
// Cockpit Build 2a (Build 1a spec docs/COCKPIT_BUILD1A_SPEC_V1_2.md:39): the
// server's cockpit rule for history windows, ONE home (zero product imports
// beyond decisionRecord.js) — the client's mode gate is that same rule.
import { excludeCockpitFilings, isCockpitFiling } from '../../../api/_utils/chatHistoryWindow.js';

/**
 * THE CLIENT MODE GATE (Cockpit Build 2a; Build 1a spec :39 — "Build 2 adds
 * the mode gate to the UI"). A cockpit filing — the thread exchange the answer
 * endpoint writes, `source: 'cockpit'` — is removed from the conversation
 * unless the battle is cockpit-on, exactly as the server removes it from both
 * history windows below `on` (chatHistoryWindow.js excludeCockpitFilings), so
 * the chat the player reads and the context the agent reads agree; a
 * call-family directive is inactive at every reader below `on`. With no
 * cockpit filing in the list — every battle while the cockpit has never been
 * on — the SAME array is returned, so nothing downstream re-derives.
 *
 * @param {Array|null} chatExchanges
 * @param {boolean} cockpitOn  the screen's cockpit-on (flag AND the server's answer)
 */
export function gateCockpitFilings(chatExchanges, cockpitOn) {
  if (cockpitOn || !Array.isArray(chatExchanges) || !chatExchanges.some(isCockpitFiling)) return chatExchanges;
  return excludeCockpitFilings(chatExchanges, 'off');
}

/**
 * @param {Array|null} chatExchanges  the subscribed doc's exchanges
 * @returns {Array<object>} message items, oldest first, two per user-initiated
 *   exchange and one per agent-initiated one
 */
export function deriveChatMessages(chatExchanges) {
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
      // Whether the exchange has a USER HALF that renders (flip-prep, item 2).
      // `Reply` is a claim about a PAIR — the player wrote and the character
      // answered — and `messageType` alone cannot make it: the default above
      // is `user_initiated`, so a legacy exchange with no type and no
      // `userMessage` would have had its answer labelled a reply to a question
      // nobody asked. This is the same conjunct that decides whether the user
      // bubble renders, carried onto the agent half rather than re-derived.
      _hasUserHalf: !isAgentInitiated,
      // The anticipation's own DIRECTION, as the server persisted it (review
      // L1-F1). `anticipationCandidates[].direction` is a required enum on the
      // eval schema — `potential_entry` is a bench candidate worth bringing
      // in, `potential_exit` is an ACTIVE HOLDING whose signal profile
      // degraded — and `voiceLayerAnticipation.js` writes it onto the exchange
      // as `anticipationContext.direction`. Without it here the eyebrow could
      // only see the type, and a note about a piece in the player's own book
      // was labelled `Bench note`.
      _anticipationDirection: ex.anticipationContext?.direction ?? null,
      // Voice-layer grounding §6.3: the no-change status line renders ONLY from
      // a persisted exchange produced under the grounding contract on which the
      // gate ran and wrote no directive — never from a reply body in flight,
      // never on a legacy exchange (there the status was the prose's claim).
      _grounded: ex.groundingVersion === GROUNDING_VERSION,
      _gateRan: Boolean(ex.archetypeGate),
      // A chip filing's audit exchange: no narrator words — the ExecutionCard
      // is its whole render, so the bubble body is skipped (review R-04).
      _filed: ex.messageType === DIRECTIVE_FILED_MESSAGE_TYPE,
      // Cockpit Build 2a (spec §8.2): the answer endpoint's filing carries
      // `source: 'cockpit'` — kept so its card can say where it came from. (A
      // cockpit filing reaches this projection only while the battle is
      // cockpit-on: gateCockpitFilings above removes it otherwise.) Present
      // only on such a card, so every other message is the object it was.
      ...(isCockpitFiling(ex) ? { _fromCockpit: true } : {}),
      // Phase C §3 — the research card, as the server composed it. Carried, not
      // recomposed: every string on it is the platform's own (BUILD_RULES §9).
      // Like a chip filing, this exchange has no narrator words, so the bubble
      // body is skipped and the card is its whole render.
      _research: ex.messageType === RESEARCH_MESSAGE_TYPE ? (ex.card || null) : null,
      // The card's scope is a FACT on the record, not a detection over prose —
      // the card names one piece by construction (scopeTape.js).
      _researchSymbol: ex.messageType === RESEARCH_MESSAGE_TYPE ? (ex.symbol || null) : null,
      mode: ex.mode || 'battle',
      timestamp: ts,
      _serverIndex: i,
    });
  });
  return out;
}

export default deriveChatMessages;
