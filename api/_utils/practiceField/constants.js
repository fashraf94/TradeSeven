// api/_utils/practiceField/constants.js
//
// Practice Field T1a-1 — the idea book's server-side constants that are NOT founder slots (the slots B1–B9 live in
// src/data/practiceFieldSlots.js). Pure data, zero imports.

/** Concept V6.1 ruling 11: the book's starting paper money. */
export const IDEA_BOOK_STARTING_CAPITAL_USD = 100_000;

/** Shared contract V2's version, stamped on the book and frozen into every idea. */
export const PRACTICE_FIELD_CONTRACT_VERSION = 2;

/**
 * The versioned discriminant an idea book resolves its frozen config through (contract §3: "an idea book loads its
 * immutable epoch config, never the quarterly archetype vintage").
 */
export const IDEA_BOOK_CONFIG_VERSION = 1;

/** The idea document's schema version (its own family; starts at 1). */
export const IDEA_SCHEMA_VERSION = 1;

/** Amendment B item 4: the Film Room copies the thesis onto the card and refuses rather than truncates. */
export const THESIS_MAX_CODE_POINTS = 400;

/** Who may author a thesis in this build: the agent (T1d's drafting) or a founder fixture. */
export const THESIS_AUTHORS = Object.freeze(['agent', 'founder_fixture']);

/** The comparison types this build supports (contract §4.1's `industry_fund` waits for T6). */
export const COMPARISON_TYPES = Object.freeze(['same_stock_held', 'sector_fund', 'frozen_basket']);

/** A frozen basket lists 2–8 universe stocks, fixed at admission. */
export const FROZEN_BASKET_SIZE = Object.freeze({ min: 2, max: 8 });

/**
 * The smallest planned leg, USD (review L1-1). The engine fills in millionths of a share, so a leg must be able to
 * buy at least one millionth at any price the universe can show: $1 does up to $1,000,000 a share. A smaller leg
 * could never fill (the all-or-nothing entry would time out) or would leave a holding a later reverse split
 * rounds to nothing. A builder's guard, not a founder slot.
 */
export const MIN_LEG_USD = 1;

/** The fixed phrase naming the question each comparison answers (contract §4.1). */
export const COMPARISON_QUESTIONS = Object.freeze({
  same_stock_held: 'Did managing these stocks beat simply holding the same shares?',
  sector_fund: 'Did these stocks beat their sector fund?',
  frozen_basket: 'Did these stocks beat the fixed basket named at the start?',
});

/** Contract §4.1's risk assumption, frozen with the contract. */
export const RISK_ASSUMPTION = 'exit_at_line_next_eligible_fill';

/**
 * The idea's run statuses (contract §4.3; Amendment E14):
 *   accepted → entering → holding ⇄ line_hit_exit_pending → settled → resulted     (or accepted → cancelled)
 * `settled` is written at the endpoint, with the endpoint row and the result; `resulted` when the liquidation has
 * filled, the cash is back in the treasury and the slot is free. `retired` and `abandoned` are later builds'.
 */
export const IDEA_STATUS = Object.freeze({
  ACCEPTED: 'accepted',
  ENTERING: 'entering',
  HOLDING: 'holding',
  LINE_HIT_EXIT_PENDING: 'line_hit_exit_pending',
  SETTLED: 'settled',
  RESULTED: 'resulted',
  CANCELLED: 'cancelled',
});

/**
 * The statuses that still own cash or shares — the book's open set (Astra T1A-C01). A `resulted` or `cancelled` idea
 * owns nothing and is out of it.
 */
export const OPEN_IDEA_STATUSES = Object.freeze([
  IDEA_STATUS.ACCEPTED, IDEA_STATUS.ENTERING, IDEA_STATUS.HOLDING, IDEA_STATUS.LINE_HIT_EXIT_PENDING, IDEA_STATUS.SETTLED,
]);

/** The open statuses of an idea whose basket has filled: three ledgers, a fill count, the same-stock tie. */
export const FILLED_IDEA_STATUSES = Object.freeze([
  IDEA_STATUS.HOLDING, IDEA_STATUS.LINE_HIT_EXIT_PENDING, IDEA_STATUS.SETTLED,
]);

/** The filled statuses that have not reached their endpoint: code still reads their lines each close. */
export const RUNNING_IDEA_STATUSES = Object.freeze([IDEA_STATUS.HOLDING, IDEA_STATUS.LINE_HIT_EXIT_PENDING]);

/** Why an idea that never filled was cancelled. */
export const CANCEL_REASON = Object.freeze({ ENTRY_TIMEOUT: 'entry_timeout', RELEASED: 'released' });

/** The label every valuation carries until an official-close source is verified (concept ruling 21). */
export const VALUATION_LABEL = 'post_close_snapshot';

/** The label of a row of a session that has NO stored close snapshot (Amendment E12; review RH-8): nothing was observed. */
export const VALUATION_LABEL_UNOBSERVED = 'unobserved';

/**
 * Mark qualities on a valuation row (build prompt §7). Only `vendor_time` supports a full-quality row.
 * `pre_open_print` (Amendment D Q-3): the vendor's own time is on the session's date but before its open — a print
 * from before the session is not that session's close. `unobserved` (Amendment E12): the session has no stored close
 * snapshot at all; the mark is the one carried from the last close.
 */
export const MARK_QUALITY = Object.freeze({
  VENDOR_TIME: 'vendor_time',
  RECEIPT_TIME_FALLBACK: 'receipt_time_fallback',
  CARRIED_FORWARD: 'carried_forward',
  PRE_OPEN_PRINT: 'pre_open_print',
  UNOBSERVED: 'unobserved',
});

/** The origin every code-made basket entry decision carries. */
export const DECISION_ORIGIN_BASKET_ENTRY = 'basket_entry';

/** The origins of the two sales code makes (Amendment E1, E4): a line's own holding, and what is left at settlement. */
export const DECISION_ORIGIN_LINE_EXIT = 'line_exit';
export const DECISION_ORIGIN_SETTLEMENT = 'settlement';
/**
 * NOT a third origin (the build prompt names two: every decision record and sale receipt carries one of them). It is
 * the CAUSE of a sale whose origin is `line_exit` but whose holding was left waiting by a delisting with no cash
 * amount (Amendment E11): no line was recognised, so the result counts it apart from the line exits and the process
 * column names it (review RH-3). Read from the receipt's `queuedBy.reason`, never from the origin.
 */
export const SALE_CAUSE_DELISTING = 'delisting_exit';

/** Why a holding is waiting to be sold before the idea's endpoint (Amendment E1, E11). */
export const EXIT_REASON = Object.freeze({ LINE: 'line', DELISTING: 'delisting' });

/** The result's five columns (contract §4.4; Amendment E6, E10, E15, E16). */
export const CONTRACT_CONDITION = Object.freeze({ MET: 'met', BREACHED: 'breached', UNOBSERVED: 'unobserved' });
export const ECONOMIC_RESULT = Object.freeze({
  AHEAD: 'ahead', BEHIND: 'behind', WITHIN_BAND: 'within_band', UNMEASURABLE: 'unmeasurable',
});
/** `deviated` is reserved for the manager's own actions (T1b); this build never writes it. */
export const PROCESS_QUALITY = Object.freeze({ FOLLOWED_PLAN: 'followed_plan', BLOCKED: 'blocked' });
export const EVIDENCE_SCOPE_SINGLE = 'single_forward_observation';
export const ADOPTION_NO_OFFER = 'no_offer';

/** The result document's own version (its own family; starts at 1). */
export const RESULT_VERSION = 1;

/** Amendment E9: a sale that has waited this many sessions alerts, once per session, until it fills. */
export const SALE_WAITING_ALERT_SESSIONS = 5;

/** How many of a waiting sale's most recent refusals its holding keeps (the count and the sessions are kept whole). */
export const SALE_WAITING_REFUSALS_KEPT = 12;

/**
 * The most missed sessions one close call catches up (Amendment E12) before it stops and leaves the rest to the
 * next fire. A bound on one call's work, never on the catch-up: nothing is skipped, and the requested date is not
 * closed until every session before it is.
 */
export const CATCH_UP_MAX_SESSIONS_PER_CALL = 20;

/** Stores (the collection literals are restated at each write site for the protected-store scan). */
export const PRACTICE_FIELD_BOOKS_COLLECTION = 'practiceFieldBooks';
export const PRACTICE_FIELD_BOOK_REGISTRY_ID = '_registry';
export const PRACTICE_FIELD_COVERAGE_COLLECTION = 'practiceFieldCoverage';
export const PRACTICE_FIELD_COVERAGE_ID = 'current';

/** Coverage roles (build prompt §5). */
export const COVERAGE_ROLE = Object.freeze({
  PENDING: 'pending', HELD: 'held', COMPARISON: 'comparison', BENCHMARK: 'benchmark',
});

/** The first epoch's id. A later epoch opens only by an explicit migration policy (contract §3.1). */
export const FIRST_EPOCH_ID = 'epoch-0001';
