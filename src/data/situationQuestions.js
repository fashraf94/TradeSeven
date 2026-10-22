// src/data/situationQuestions.js
//
// Film Room Build B (spec docs/specs/FILM_ROOM_BUILD_B_CARD_SPEC_V1_20261010.md
// §1, §10; Amendment G RG-8) — THE QUESTION MENU: the short list a card's
// question is picked from. Founder slot S11 is the three `stalled` questions,
// word for word from spec §1.
//
// Zero-import, Node-clean and browser-clean, after src/data/situationRegistry.js:
// the card endpoint (api/film-room/card.js) checks a card's question against
// this menu, and the screen (src/screens/filmRoomV2) offers it. DATA ONLY: no
// function lives here. The copy is swept like all screen copy.
//
// VERSION RULE (spec §1; RG-8): a question changes only by a PR that bumps its
// `version` (and SITUATION_QUESTIONS_VERSION). A card keeps the version it was
// written under (`questionVersion`).

/** The menu's own version. */
export const SITUATION_QUESTIONS_VERSION = 1;

/** Each entry: `{ id, version, situationId, text }`, in menu order. */
export const SITUATION_QUESTIONS = Object.freeze([
  Object.freeze({ id: 'stalled.want', version: 1, situationId: 'stalled', text: 'What do you want to happen when a holding stops moving like this?' }),
  Object.freeze({ id: 'stalled.whose', version: 1, situationId: 'stalled', text: 'Whose call is it to move on from a holding that has stopped moving?' }),
  Object.freeze({ id: 'stalled.ready', version: 1, situationId: 'stalled', text: 'Were other ideas ready to take its place?' }),
]);
