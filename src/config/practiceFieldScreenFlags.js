// src/config/practiceFieldScreenFlags.js
//
// The idea book screen's switch (Practice Field build B3, ruling B3-8; design of record
// docs/design/practice-field/IDEA_BOOK_ROUND_2.html; build report docs/audits/20261123_BUILD_B3_THE_IDEA_BOOK_SCREEN.md).
//
// A FLAG-SOURCE MODULE OF ITS OWN, NOT A LINE IN THE MODE'S FLAG MODULE. Both sides read this switch: the server's
// endpoint (api/practice-field/book.js, through api/_utils/practiceField/mode.js) and the client, which must know it
// WITHOUT a request (with it off the app makes no new request and shows no new card). The mode's flag module (the one
// holding PRACTICE_FIELD_MODE) is pinned "no module under src/ imports this file", so the client cannot read the switch there;
// a zero-import module of its own keeps PRACTICE_FIELD_MODE out of the client bundle and lets Rollup fold every client
// read of this literal. No imports.

/**
 * PRACTICE_FIELD_SCREEN_ENABLED — the idea book screen: a read-only positions page for the owner of an idea book
 * (Positions, Desks and History), its one endpoint `GET /api/practice-field/book`, and the Command Center entry card.
 *
 * ON (the founder's screen-on PR, ruling B3-13), and a kill switch: with it false the client makes no request, renders no card and changes nothing on the
 * hub; the endpoint answers 404 before it authenticates or reads. It also needs PRACTICE_FIELD_MODE not 'off', and the
 * caller admitted by that mode (mode.js practiceFieldAdmits).
 * Runway: false shipped with B3 (B3-8); the screen-on PR flipped it, moving this literal, its pin row in
 * practiceFieldScreenFlags.test.js and its DARK_BY_DESIGN entry in flagPinGuard.test.js in one commit (BUILD_RULES §2).
 * Rollback: the literal and its pin row back to false; the DARK_BY_DESIGN entry stays out (a kill switch now).
 */
// Pinned by: practiceFieldScreenFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const PRACTICE_FIELD_SCREEN_ENABLED = true;
