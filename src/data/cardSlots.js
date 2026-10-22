// src/data/cardSlots.js
//
// Film Room Build B (spec docs/specs/FILM_ROOM_BUILD_B_CARD_SPEC_V1_20261010.md
// §10; Amendment G RG-8) — THE CARD'S FOUNDER SLOTS, in their own small module:
//   S9   open cards per agent — counting only cards that are neither shelved
//        nor retired (shelving is computed at read, never written);
//   S10  the note's length, in characters after trimming.
// They do NOT live in src/data/situationRegistry.js on purpose (RG-8): every
// tape stores the registry's version, so a bump there would move it on every
// new day; a bump here moves nothing stored.
//
// Zero-import, Node-clean and browser-clean, after the registry: the card
// endpoint (api/film-room/card.js) enforces both, and the screen shows them.
// DATA ONLY: no function lives here.
//
// VERSION RULE (RG-8): a slot value changes only by a PR that bumps
// CARD_SLOTS_VERSION.

/** The slots' own version. */
export const CARD_SLOTS_VERSION = 1;

export const CARD_SLOTS = Object.freeze({
  // S9 — open cards per agent (active: neither shelved nor retired).
  S9: Object.freeze({ openCardsPerAgent: 5 }),
  // S10 — the note's length, in characters (code points) after trimming.
  S10: Object.freeze({ noteMaxChars: 280 }),
});
