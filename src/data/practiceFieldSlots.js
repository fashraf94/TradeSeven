// src/data/practiceFieldSlots.js
//
// The idea book's founder slots B1–B9 (shared contract V2 §13; concept V6.1's S1–S9), the slot ↔ horizon mapping
// (Amendment A F2) and the origin vocabulary (direction note ruling 6, Amendment C §6). DATA ONLY, ZERO IMPORTS.
// A value changes only by a PR that bumps PRACTICE_FIELD_SLOTS_VERSION; every idea freezes the version it was
// admitted under.
//
// The slot LENGTHS in sessions are not restated here: a slot names its horizon class, and the count is read from
// the idea record's own window table (src/constants/hypothesisRecords.js HORIZON_WINDOW_SESSIONS) by
// api/_utils/practiceField/windows.js. practiceFieldSlots.test.js binds the two.

export const PRACTICE_FIELD_SLOTS_VERSION = 1;

/** The three slots, in horizon order. One idea each. */
export const PRACTICE_FIELD_SLOT_NAMES = Object.freeze(['short', 'medium', 'long']);

/** Amendment A F2: slot → the idea record's horizon class (`horizonEnum`). */
export const PRACTICE_FIELD_SLOT_HORIZON = Object.freeze({
  short: 'swing',
  medium: 'positional',
  long: 'longterm',
});

export const PRACTICE_FIELD_SLOTS = Object.freeze({
  /** B1 — the share of the book's marked equity an idea may reserve, by slot. */
  B1_SLOT_CAP_SHARE: Object.freeze({ short: 0.20, medium: 0.30, long: 0.40 }),
  /** B2 — the cash floor: the treasury's unreserved cash, as a share of marked equity. */
  B2_CASH_FLOOR_SHARE: 0.10,
  /** B3 — names per idea. */
  B3_NAMES_PER_IDEA: Object.freeze({ min: 1, max: 4 }),
  /** B4 — the no-difference band, as a share of the idea's own reserved capital. */
  B4_BAND_SHARE_OF_RESERVED: 0.0025,
  /** B5 — the price line's distance below entry, by slot (inclusive bounds). */
  B5_LINE_DISTANCE: Object.freeze({
    short: Object.freeze({ min: 0.03, max: 0.08 }),
    medium: Object.freeze({ min: 0.06, max: 0.15 }),
    long: Object.freeze({ min: 0.10, max: 0.25 }),
  }),
  /** B6 — drafts per drafting call; refill attempts per slot per session; nomination expiry in sessions. */
  B6_DRAFTS_PER_CALL: 3,
  B6_REFILL_ATTEMPTS_PER_SLOT_PER_SESSION: 1,
  B6_NOMINATION_EXPIRY_SESSIONS: 10,
  /** B7 — the risk budget: remaining marked loss to lines, as a share of marked equity (enforced in T1e). */
  B7_RISK_BUDGET_SHARE: 0.08,
  /** B8 — the founder cap on concurrent books. */
  B8_FOUNDER_BOOK_CAP: 4,
  /** B9 — the monthly spend bound per book, USD (enforced in T1a-2). */
  B9_MONTHLY_SPEND_BOUND_USD: 3,
});

/** Direction note ruling 6: where an idea came from. Frozen with the contract; each source carries one too. */
export const PRACTICE_FIELD_ORIGIN_KINDS = Object.freeze([
  'signaldrop', 'conversation', 'game_moment', 'film_room_card', 'research', 'agent_prior_ideas', 'founder_fixture',
]);

/** `player` when the idea answers a nomination, otherwise `agent`. */
export const PRACTICE_FIELD_INITIATED_BY = Object.freeze(['player', 'agent']);

/** The one origin that may stand without a source. */
export const PRACTICE_FIELD_SOURCELESS_ORIGIN = 'founder_fixture';
