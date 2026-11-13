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

/** The stages an entry is open at outright (S9 counts it when it is not shelved). `tested` is open until parked: isOpenStage. */
export const OPEN_STAGES = Object.freeze(['card', 'nominated', 'testing']);

/**
 * Open by its stage (spec §3, "Counting"): at `card`, `nominated` or `testing`; or `tested` with no `parkedAt`. Shelving is
 * the archetype's, judged beside this by the store (cardStore.js isOpen) — never here.
 */
export const isOpenStage = (entry) => OPEN_STAGES.includes(entry?.stage) || (entry?.stage === 'tested' && !entry?.parkedAt);

/**
 * A Watch card the counter follows for recurrences (RG-4), by its stage: route `watch`, still at `card`. A Watch card
 * offered later (BC-3: `nominate` works on any open card) is at `nominated` and is followed no more — its chain says
 * where it went. The server's recurrences and the screen's Watch list both read this one predicate; shelving is
 * judged beside it.
 */
export const isFollowedWatch = (entry) => entry?.route === 'watch' && entry?.stage === 'card';

/**
 * A nomination's states, as the book records them (shared contract V2 §5.2, restated in spec §4): `queued` at filing,
 * then the Practice Field's own writes, each copied onto the entry by the ledger's transition helper.
 */
export const NOMINATION_STATES = Object.freeze(['queued', 'considered', 'accepted', 'deferred', 'declined', 'expired']);

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
 * C1 fix round, Astra F3 — the stages a CREATE writes its first history row at: `card` (Watch, Set) or `nominated` (the
 * Offer route; a v1 Practice entry). The chain recognises a create row by this shape, never by its index alone.
 */
export const CREATE_ROW_STAGES = Object.freeze(['card', 'nominated']);
