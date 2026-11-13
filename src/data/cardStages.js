// src/data/cardStages.js
//
// Film Room Build C (spec docs/specs/FILM_ROOM_BUILD_C_LOOP_SPEC_V1_20261112.md §3) — THE LEDGER'S STAGE VOCABULARY,
// v2, in ONE place. Every reader of a card's stage reads its list, its open set and its open predicate from here: the
// store and its transitions (api/_utils/filmRoom/cardStore.js re-exports this module whole), the counter
// (cardCounter.js), the card endpoint's request boundary (cardRequest.js), the screen's grouping, labels and receipt
// (src/screens/filmRoomV2/filmRoomCards.js, FilmRoomCardRegions.jsx, filmRoomCopy.js), the screen suites' harness and
// the emulator rows. cardStages.census.test.js pins every one of them to this export: a reader with a stage list of
// its own fails it.
//
//   card → nominated → testing → tested → installed → retired
//
// `drilled`, `drafted` and `proven` were never written; they are dropped before anything writes them. An entry written
// from C1 on records `stageVocabVersion: 2`; one without the field reads as v1, and nothing ever rewrites it (v1's
// three stages — card, nominated, retired — are v2's own words, so a v1 entry reads and counts as before).
//
// Zero-import, Node-clean and browser-clean, after src/data/cardSlots.js: the server enforces it, the screen shows it.

/** The vocabulary's own version, written on every entry from C1 on (`stageVocabVersion`). */
export const CARD_STAGE_VOCAB_VERSION = 2;

/** The six stages, in order (spec §3). */
export const CARD_STAGES = Object.freeze(['card', 'nominated', 'testing', 'tested', 'installed', 'retired']);

/**
 * The stages an entry is open at OUTRIGHT (S9 counts it when it is not shelved): `card` and `testing` (Amendment A CA-3
 * narrowed it — `nominated` and `tested` are decided by isOpenStage). Never read to mean "open": every reader asks
 * isOpenStage.
 */
export const OPEN_STAGES = Object.freeze(['card', 'testing']);

/**
 * Amendment A CA-3: the nomination states that CLOSE a nominated card — the agent declined it, it expired unconsidered,
 * or the player withdrew it (CA-2). The stage stays `nominated` (contract V2, B-STAGE); `deferred` stays open.
 */
export const NOT_TAKEN_STATES = Object.freeze(['declined', 'expired', 'withdrawn']);

/** CA-3: a nominated card the agent did not take — its copy's state closes it ("Not taken"). A v1 entry (no copy) is not one. */
export const isNotTaken = (entry) => entry?.stage === 'nominated' && NOT_TAKEN_STATES.includes(entry?.nomination?.state);

/**
 * Open by its stage (spec §3, "Counting", as Amendment A CA-3 rules it): at `card` or `testing`; at `nominated` unless
 * the copy's state is declined, expired or withdrawn (no copy — a v1 entry — stays open); `tested` with no `parkedAt`.
 * Shelving is the archetype's, judged beside this by the store (cardStore.js isOpen) — never here.
 */
export function isOpenStage(entry) {
  const stage = entry?.stage;
  if (OPEN_STAGES.includes(stage)) return true;
  if (stage === 'nominated') return !isNotTaken(entry);
  return stage === 'tested' && !entry?.parkedAt;
}

/**
 * A Watch card the counter follows for recurrences (RG-4), by its stage: route `watch`, still at `card`. A Watch card
 * offered later (BC-3: `nominate` works on any open card) is at `nominated` and is followed no more — its chain says
 * where it went. The server's recurrences and the screen's Watch list both read this one predicate; shelving is
 * judged beside it.
 */
export const isFollowedWatch = (entry) => entry?.route === 'watch' && entry?.stage === 'card';

/**
 * A nomination's states, as the book records them (shared contract V2 §5.2, restated in spec §4): `queued` at filing,
 * then the Practice Field's own writes, each copied onto the entry by the ledger's transition helper. Amendment A CA-2
 * adds `withdrawn`, written ONLY by the Film Room's player retire (through the seam's buildWithdrawal) — the transition
 * helper never copies it.
 */
export const NOMINATION_STATES = Object.freeze(['queued', 'considered', 'accepted', 'deferred', 'declined', 'expired', 'withdrawn']);

/**
 * Amendment A CA-11 — THE NOMINATION ORDER: from each copy state, the states the Practice Field may copy next. `queued`
 * (the player's own copy) may move straight to any answer or to `expired`, so a lost copy never blocks the next;
 * `expired` comes only from `queued` (so "not considered within 10 sessions" is always true when shown); `accepted`,
 * `declined`, `expired` and `withdrawn` move no further. The Practice Field is asked to adopt this table exactly (CA-21).
 */
export const NOMINATION_ORDER = Object.freeze({
  queued: Object.freeze(['considered', 'accepted', 'deferred', 'declined', 'expired']),
  considered: Object.freeze(['accepted', 'deferred', 'declined']),
  deferred: Object.freeze(['considered', 'accepted', 'declined']),
});

/** CA-11: may a copy at `from` move to `to`? Anything the table does not list is refused. */
export const nominationMayMove = (from, to) => Object.prototype.hasOwnProperty.call(NOMINATION_ORDER, from) && NOMINATION_ORDER[from].includes(to);

/** CA-2: the record states a player retire may still withdraw — the agent has not taken the card. */
export const WITHDRAWABLE_STATES = Object.freeze(['queued', 'considered', 'deferred']);

/**
 * Amendment A CA-1, CA-2 (the copy's side) and CA-5 — may the PLAYER retire this card? The store and the receipt both
 * read this one predicate. Only an open card (isOpenStage); and not —
 *   CA-1  at `testing`: the idea runs with the card as its source, and its chain must be able to receive `tested`;
 *   CA-2  at `nominated` once the copy says the agent took it: only a copy `queued`, `considered` or `deferred` — or no
 *         copy at all (a v1 entry) — may be taken back (the store then reads the book's record, which decides);
 *   CA-5  at `tested` while an offer waits: the player answers the offer in the Forge.
 * A `card` and an unparked `tested` card with no offer retire as before. Shelving is judged beside it, by the store.
 */
export function isRetirableByPlayer(entry) {
  if (!isOpenStage(entry)) return false;
  const stage = entry?.stage;
  if (stage === 'testing') return false;
  if (stage === 'nominated') return entry?.nomination == null || WITHDRAWABLE_STATES.includes(entry.nomination?.state);
  if (stage === 'tested') return entry?.offer == null;
  return true;
}

/**
 * B6 (shared contract V2, restated in spec §4 and §5): a queued nomination expires after this many sessions on the
 * maintained calendar. The Practice Field's value, copied here so the record's `expiresAt` (the seam's builder) and the
 * receipt's "not considered within n sessions" read one number.
 */
export const NOMINATION_EXPIRY_SESSIONS = 10;

/** A card's three routes (spec §4): Watch, Offer, Set. BC-3: Offer replaces Practice. */
export const CARD_ROUTES = Object.freeze(['watch', 'offer', 'set']);

/** A stored route read under another name: `drill` (Practice — never written in production) reads as `offer`, and is never written again. */
export const STORED_ROUTE_ALIASES = Object.freeze({ drill: 'offer' });

/** The route a stored entry reads as (spec §4): its own, or its alias. */
export const routeOf = (route) => (Object.prototype.hasOwnProperty.call(STORED_ROUTE_ALIASES, route) ? STORED_ROUTE_ALIASES[route] : route);

/** The route that files its card at `nominated`, its nomination record written in the same transaction (spec §4). */
export const NOMINATING_ROUTE = 'offer';

/**
 * C1 fix round, Astra F3 (and its §2 review, B1) — the stage a CREATE writes its first history row at, BY THE CARD'S
 * STORED ROUTE: `nominated` for the Offer route and the stored alias `drill` (v1 Practice), `card` for Watch and Set;
 * null for a route the vocabulary does not know. The chain recognises a create row by this shape, never by its index
 * alone — so a Watch or Set card's `nominated` row is its nominate op, never its filing.
 */
export const createStageOf = (route) => {
  const r = routeOf(route);
  if (!CARD_ROUTES.includes(r)) return null;
  return r === NOMINATING_ROUTE ? 'nominated' : 'card';
};

/**
 * Amendment A CA-22 (and the §2 review's B3) — the ONE reader of the stored no-fill fact: the card's result says its
 * accepted idea ended before its first fill (`result.noFill: true`, written by the transition helper with the row's own
 * flag in the same patch). The chain's line and the stage word both read it, so they never disagree; it is never
 * inferred from a missing `testing` row.
 */
export const endedBeforeFirstFill = (entry) => entry?.result !== null && typeof entry?.result === 'object' && entry.result.noFill === true;
