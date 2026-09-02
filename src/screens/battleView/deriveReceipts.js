// src/screens/battleView/deriveReceipts.js
//
// Receipts — Phase A (A3). PURE.
//
// The vocabulary is D-51: `Filed · Acted · Replaced · Expired`. Each is a
// state the data can PROVE (design brief §6 rule 8); none is inferred:
//
//   filed     the exchange that carried the directive was written — the
//             directive's own thread id, stamped on that exchange, is the
//             proof. Filed is not heard; heard is not will-do.
//   replaced  a LATER exchange filed a DIFFERENT thread id: battle.directive
//             is a single slot, latest wins (chat.js), so the earlier one is
//             no longer the directive in front of the agent. Time = when the
//             replacing directive was filed. Copy never says "never seen"
//             (hazard 3): a replaced directive may have been in a prompt.
//   expired   the battle is complete (D-61). Under fullday a `3_games`
//             directive cannot expire mid-battle; `expiry` is an ENUM
//             (`end_of_battle | 3_games | permanent`), never a timestamp
//             (hazard 20), and the client never imports directiveUtils.js
//             (hazard 22).
//   acted     is NOT derived here. It is the shipped `↳ from directive` on a
//             statusFeed swap entry (AgentChat.jsx), keyed to the model's own
//             echo of the thread id — unchanged by Phase A.
//
// Computed in the screen from the subscribed doc and passed AgentChat →
// MessageBubble → ExecutionCard; nothing in the chat reads battle.directive.

import { toIso } from '../../adapters/baggerbombAdapter';

export const RECEIPT_STATE = Object.freeze({
  FILED: 'filed',
  REPLACED: 'replaced',
  EXPIRED: 'expired',
});

const threadIdOf = (exchange) => {
  if (!exchange || typeof exchange !== 'object') return null;
  const id = exchange.directiveThreadId ?? exchange.directive?.directiveThreadId ?? null;
  return typeof id === 'string' && id ? id : null;
};

/**
 * @param {Array} chatExchanges   battle.chatExchanges, in write order
 * @param {object|null} directive battle.directive — the single active slot
 * @param {string|null} battleStatus battle.status
 * @returns {{ [directiveThreadId: string]: { state: 'filed'|'replaced'|'expired', at: string|null } }}
 *   `at` is the ISO time of the exchange that PROVES the state: the filing
 *   exchange for `filed`, the replacing exchange for `replaced`, null for
 *   `expired` (the copy is the bare word).
 */
export function deriveReceipts(chatExchanges, directive, battleStatus) {
  const receipts = {};
  if (!Array.isArray(chatExchanges) || chatExchanges.length === 0) return receipts;

  // Every directive-carrying exchange, in write order, first filing wins per
  // thread id (a thread id is minted once, chat.js; a duplicate would be a
  // replay and must not move the filed time).
  const filings = [];
  for (const exchange of chatExchanges) {
    const threadId = threadIdOf(exchange);
    if (!threadId) continue;
    if (receipts[threadId]) continue;
    const at = toIso(exchange.timestamp);
    receipts[threadId] = { state: RECEIPT_STATE.FILED, at };
    filings.push({ threadId, at });
  }
  if (filings.length === 0) return receipts;

  // The current directive: the slot if it names a filed thread, else the
  // latest filing (a doc with the slot cleared or absent still has a newest).
  const slotId = typeof directive?.directiveThreadId === 'string' ? directive.directiveThreadId : null;
  const currentId = slotId && receipts[slotId] ? slotId : filings[filings.length - 1].threadId;

  // Replaced: every filing before the current one — the time is the NEXT
  // filing's, the exchange that displaced it.
  for (let i = 0; i < filings.length; i += 1) {
    const { threadId } = filings[i];
    if (threadId === currentId) break;
    const replacedBy = filings[i + 1];
    receipts[threadId] = { state: RECEIPT_STATE.REPLACED, at: replacedBy ? replacedBy.at : null };
  }

  // Expired: battle complete only (D-61) — every directive, current included.
  if (battleStatus === 'completed') {
    for (const threadId of Object.keys(receipts)) {
      receipts[threadId] = { state: RECEIPT_STATE.EXPIRED, at: null };
    }
  }

  return receipts;
}

export default deriveReceipts;
