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
// Nothing here changed in the lift; the chat golden is the proof.

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
      mode: ex.mode || 'battle',
      timestamp: ts,
      _serverIndex: i,
    });
  });
  return out;
}

export default deriveChatMessages;
