// api/_utils/callRecords/commands.js
//
// Cockpit Build 2b — THE COMMANDS COUNT (contract Amendment D, D-1; spec S-5,
// §4 "Commands used"). ONE pure helper, imported by the answer endpoint
// (api/agent/call-response.js, which refuses the eighth) and by the cockpit's
// meter (src/screens/battleView/cockpit2bModel.js), so the two can never
// disagree: both count the same array the same way.
//
// THE COUNT IS DERIVED, NOT STORED (D-1): the entries of the battle
// document's `chatExchanges` whose `source` is 'cockpit' and that carry a
// directive. Each accepted directive answer appends exactly one such entry
// (call-response.js buildCockpitExchange) and no other writer uses that
// source; `chatExchanges` is append-only (arrayUnion in directiveWriter.js) and
// not owner-writable, so the count can be neither trimmed nor forged. An
// acknowledgment appends nothing and is never counted. A command that a later
// one replaced was still spent: its entry stays, and it still counts.
//
// The client must hand in the RAW battle document's array — never the
// cockpit-gated chat projection (deriveChatMessages gateCockpitFilings drops
// cockpit filings while the battle is not cockpit-on).
//
// Pure, Node-clean and browser-clean: no import. The source literal equals
// chatHistoryWindow.js COCKPIT_SOURCE (commands.test.js pins it).

/** Commands per battle (D-1). Chat keeps its own 10 (directiveFiling.js BATTLE_CHAT_BUDGET). */
export const COCKPIT_COMMANDS_LIMIT = 7;

/** The exchange source the answer endpoint writes (chatHistoryWindow.js COCKPIT_SOURCE). */
export const COMMAND_SOURCE = 'cockpit';

/** How many commands this battle has spent: cockpit filings that carry a directive. */
export function cockpitCommandsUsed(chatExchanges) {
  if (!Array.isArray(chatExchanges)) return 0;
  let used = 0;
  for (const ex of chatExchanges) {
    if (ex && typeof ex === 'object' && ex.source === COMMAND_SOURCE && ex.hasDirective === true) used += 1;
  }
  return used;
}

/** Commands left, never below zero. */
export function cockpitCommandsLeft(chatExchanges) {
  return Math.max(0, COCKPIT_COMMANDS_LIMIT - cockpitCommandsUsed(chatExchanges));
}
