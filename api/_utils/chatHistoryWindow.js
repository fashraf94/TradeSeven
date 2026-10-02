// api/_utils/chatHistoryWindow.js
//
// Cockpit Build 1a — THE HISTORY WINDOWS' cockpit rule (spec
// docs/COCKPIT_BUILD1A_SPEC_V1_2.md §3 "History windows"; contract Amendment B
// §10; Astra B1R2-5).
//
// A cockpit filing — the thread exchange the answer endpoint writes when a
// player's answer files a call directive — is chip-shaped: no user half,
// `messageType: 'directive_filed'`, and `source: 'cockpit'`. Both history
// windows (the legacy chat window below, chat.js; the grounded window,
// voiceLayerGrounding.js selectHistoryWindow) SLICE the last ten exchanges
// BEFORE they drop agent-initiated entries, so a cockpit filing that merely
// fell out afterwards would still have displaced one ordinary turn — and the
// prompt would no longer be the pre-build prompt at `off`.
//
// THE RULE: when the battle's RESOLVED calls mode is not 'on', cockpit filings
// are removed BEFORE the slice — every window is then exactly the window of
// the same exchanges without them (the pre-build fixture,
// __fixtures__/historyWindowPreBuild.json). At 'on' they are treated exactly
// as chip filings are today: sliced in, then excluded as agent-initiated
// entries with no user half. A caller that passes no mode gets the exclusion
// (fail closed). The filter keys on the durable `source` marker alone — never
// a calls-store lookup.
//
// ZERO product imports beyond the message-type constant (decisionRecord.js is
// itself zero-import), so chat.js and voiceLayerGrounding.js can both consume
// it without a cycle.

import { RESEARCH_MESSAGE_TYPE } from '../../src/data/decisionRecord.js';

/** The marker a cockpit filing carries (the chip route's `source: 'chip'` precedent). */
export const COCKPIT_SOURCE = 'cockpit';

/** The legacy chat window's length (chat.js's `.slice(-10)`, unchanged). */
export const LEGACY_CHAT_WINDOW = 10;

/** Is this exchange a cockpit filing? (By its durable marker; nothing else.) */
export function isCockpitFiling(exchange) {
  return !!exchange && typeof exchange === 'object' && exchange.source === COCKPIT_SOURCE;
}

/**
 * The exchanges a window may count — cockpit filings removed unless the
 * resolved mode is 'on'. A non-array is returned as-is so the caller's own
 * handling of a malformed field is unchanged.
 *
 * @param {Array} chatExchanges
 * @param {'off'|'shadow'|'on'|null|undefined} callsMode  the battle's resolved mode
 */
export function excludeCockpitFilings(chatExchanges, callsMode) {
  if (!Array.isArray(chatExchanges)) return chatExchanges;
  if (callsMode === 'on') return chatExchanges;
  return chatExchanges.filter((ex) => !isCockpitFiling(ex));
}

/**
 * THE LEGACY CHAT WINDOW — chat.js's shipped history, byte for byte (research
 * cards out, the last ten, then the null-user drop, then the alternating
 * user/assistant array the model receives) — with the cockpit rule applied
 * BEFORE the slice. On a list without cockpit filings this is exactly the
 * pre-build expression (the fixture proves it).
 *
 * @param {Array} chatExchanges
 * @param {{ callsMode?: string|null }} [opts]
 */
export function selectLegacyChatHistory(chatExchanges, { callsMode = null } = {}) {
  const previousExchanges = excludeCockpitFilings(chatExchanges || [], callsMode)
    .filter((ex) => ex?.messageType !== RESEARCH_MESSAGE_TYPE)
    .slice(-LEGACY_CHAT_WINDOW)
    .filter((ex) => typeof ex?.userMessage === 'string' && ex.userMessage.length > 0);
  return previousExchanges.flatMap((ex) => [
    { role: 'user', content: ex.userMessage },
    { role: 'assistant', content: ex.agentResponse || ex.agentMessage || '' },
  ]);
}
