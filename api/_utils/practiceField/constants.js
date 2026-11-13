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

/** The fixed phrase naming the question each comparison answers (contract §4.1). */
export const COMPARISON_QUESTIONS = Object.freeze({
  same_stock_held: 'Did managing these stocks beat simply holding the same shares?',
  sector_fund: 'Did these stocks beat their sector fund?',
  frozen_basket: 'Did these stocks beat the fixed basket named at the start?',
});

/** Contract §4.1's risk assumption, frozen with the contract. */
export const RISK_ASSUMPTION = 'exit_at_line_next_eligible_fill';

/** The idea's run statuses this build writes (contract §4.3; the rest are T1a-2's). */
export const IDEA_STATUS = Object.freeze({
  ACCEPTED: 'accepted',
  ENTERING: 'entering',
  HOLDING: 'holding',
  CANCELLED: 'cancelled',
});

/** Why an idea that never filled was cancelled. */
export const CANCEL_REASON = Object.freeze({ ENTRY_TIMEOUT: 'entry_timeout', RELEASED: 'released' });

/** The label every valuation carries until an official-close source is verified (concept ruling 21). */
export const VALUATION_LABEL = 'post_close_snapshot';

/** Mark qualities on a valuation row (build prompt §7). Only `vendor_time` supports a full-quality row. */
export const MARK_QUALITY = Object.freeze({
  VENDOR_TIME: 'vendor_time',
  RECEIPT_TIME_FALLBACK: 'receipt_time_fallback',
  CARRIED_FORWARD: 'carried_forward',
});

/** The origin every code-made basket entry decision carries. */
export const DECISION_ORIGIN_BASKET_ENTRY = 'basket_entry';

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
