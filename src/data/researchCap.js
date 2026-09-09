// src/data/researchCap.js
//
// THE RESEARCH CAP — Phase C (Show it), spec §4 + V1.1 ruling 2 (D-122). PURE.
//
// The cap is DERIVED, NOT STORED: three per battle, counted off the `research`
// exchanges the route persisted on the battle doc. No new battle-doc key (which
// would be `createAgentBattle` doc-shape contact — a §7 STOP), no new
// collection, no message charged (D-118: the message budget is for influence;
// research is not influence).
//
// ONE DEFINITION, THREE READERS (Sol C-2; BUILD_RULES §9). The number on the
// door, the number the route enforces and the number the tests assert all come
// from this module. Sol's finding was that "the count of persisted research
// cards" and the "1" in `Show it · 1 of 3` are two different numbers before the
// first tap — 0 persisted, ordinal 1 — so the spec had not said which integer is
// printed. It is the ORDINAL OF THE NEXT CARD, clamped to the cap, because the
// door states the cost of the tap you are about to make (D-31, cost-before-tap):
//
//     used 0 → `Show it · 1 of 3`, enabled
//     used 1 → `Show it · 2 of 3`, enabled
//     used 2 → `Show it · 3 of 3`, enabled   ← the last one
//     used 3 → `Show it · 3 of 3`, DISABLED  ← exhausted
//
// The last two share their text ON PURPOSE and are distinguished by `enabled`,
// never by the string — spec §4 writes both as `3 of 3`, and inventing a fourth
// wording for the exhausted state would be a ruling this module does not have.
//
// A DISPLAYED COUNT IS NEVER AUTHORIZATION. The route re-reads the count inside
// its own transaction on every call; a client renders from the subscribed doc
// (or the count the route returned) and never from an optimistic increment that
// survived a failed request.

import { RESEARCH_MESSAGE_TYPE } from './decisionRecord';

/** Three per battle (spec §4). */
export const RESEARCH_CAP = 3;

/** The route's status when a fourth tap arrives (spec §4). */
export const RESEARCH_EXHAUSTED_STATUS = 'research_exhausted';

/**
 * The cards already persisted on this battle. The ONLY source — an exchange
 * counts when its `messageType` is the research type and nothing else does.
 *
 * @param {Array|null|undefined} chatExchanges  the battle doc's exchanges
 * @returns {number}
 */
export function countResearchUsed(chatExchanges) {
  if (!Array.isArray(chatExchanges)) return 0;
  let used = 0;
  for (const ex of chatExchanges) {
    if (ex && typeof ex === 'object' && ex.messageType === RESEARCH_MESSAGE_TYPE) used += 1;
  }
  return used;
}

/** A count that is not a non-negative integer is 0 uses, never a negative door. */
function normalizeUsed(used) {
  return Number.isFinite(used) && used > 0 ? Math.floor(used) : 0;
}

/** The integer the door prints: the ordinal of the NEXT card, clamped to the cap. */
export function researchDoorOrdinal(used) {
  return Math.min(normalizeUsed(used) + 1, RESEARCH_CAP);
}

/** Whether a tap is still allowed. The exhausted state's ONLY distinguishing fact. */
export function researchDoorEnabled(used) {
  return normalizeUsed(used) < RESEARCH_CAP;
}

/** How many taps are left. The route returns this; the client reconciles to it. */
export function researchRemaining(used) {
  return Math.max(0, RESEARCH_CAP - normalizeUsed(used));
}
