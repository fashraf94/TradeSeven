// api/_utils/setupMenuLabels/constants.js
//
// Measured Trend Evidence Slice 2 — THE NAMED LIMITS AND CLOSED LISTS (spec V2 §4–§7, as amended by
// the founder's kickoff of 7 Nov 2026, Corrections A–D; build report
// docs/audits/20261107_BUILD_SETUP_MENU_LABELS.md). Pure: numbers and names only, no imports.
//
// The store's provider timeout, lease and confirmation interval are RESTATED here (never imported),
// so the census can load this module without loading the store's write-capable modules;
// constants.test.js pins each equal to setupEvidence/acquire.js and store.js.

// ---- The store's own numbers (restated; pinned) -------------------------------------------------
/** setupEvidence/acquire.js ACQUIRE_TIMEOUT_MS: the bound on one provider read. */
export const STORE_ACQUIRE_TIMEOUT_MS = 5_000;
/** setupEvidence/store.js LEASE_MS: a claim is live while |now − claimedAt| < this. */
export const STORE_LEASE_MS = 120_000;
/** setupEvidence/store.js CONFIRM_AFTER_MS: the gap between the two samples of a confirmed refusal. */
export const STORE_CONFIRM_AFTER_MS = 30 * 60_000;

// ---- The record block (spec V2 §5; Correction C) ------------------------------------------------
/** Candidates kept on the block, in presentation order; the rest are omitted, counted and never read. */
export const SETUP_MENU_MAX_CANDIDATES = 48;
/** The composed block's own byte cap (the writer's approxBytes); candidates are dropped from the tail above it. */
export const SETUP_MENU_MAX_BYTES = 24 * 1024;

// ---- The reads inside a tick (spec V2 §4.3; Correction A) ---------------------------------------
/**
 * One absolute deadline per observation, from its read start, for the state read and every snapshot
 * read: the observation is sealed when it passes. Correction A: NOTHING WAITS for it. The capture
 * stage takes only the results already available (the settlement wait is zero), so this deadline
 * only closes the observation early; it never delays a tick.
 */
export const LABEL_READ_DEADLINE_MS = 3_000;
/**
 * Snapshot reads UNRESOLVED at once, across every tick of one handler invocation. A read is charged
 * from its issue until its own promise resolves or rejects; no deadline, seal or elapsed time releases
 * the charge (correction round F1 — a timeout cancels no RPC). Hung reads exhaust this capacity for
 * the rest of the invocation: later ticks' distinct names stay `read_unsettled`, never extra requests.
 */
export const LABEL_READ_CONCURRENCY = 5;
/**
 * Distinct snapshot reads one handler invocation may issue, across all its ticks. A read is issued
 * once per snapshot id per invocation and shared by every tick that wants it (the run memo).
 */
export const LABEL_READS_PER_RUN_MAX = 240;

// ---- The tenant (spec V2 §6; Correction B) ------------------------------------------------------
/** The tenant's own slice, from its start. */
export const TENANT_SLICE_MS = 20_000;
/** From the handler's start: an ADMISSION deadline, not a completion bound (TIME_BUDGET_MS stays 50 s; maxDuration 120 s is the hard stop). */
export const TENANT_ADMISSION_CEILING_MS = 100_000;
/** A run with less than this until its deadline defers with no read. */
export const MIN_RUN_MS = 15_000;
/** From the tenant's start: no preparation read starts after it. */
export const PREP_BUDGET_MS = 6_000;
/** A reservation and its store call start only with at least this much left before the deadline; rechecked after the reservation returns. */
export const ADMISSION_RESERVE_MS = STORE_ACQUIRE_TIMEOUT_MS + 2_000;
/** Store calls started per run. */
export const MAX_ACQUISITIONS_PER_RUN = 12;
/** Store calls in flight at once. */
export const ACQUISITION_CONCURRENCY = 3;
/** Battles read per owner per run, and in all. */
export const MAX_BATTLES_PER_OWNER_PER_RUN = 10;
export const MAX_BATTLES_PER_RUN = 25;
/** Non-refunded reservations per key per session: the hard cap. A `pending` outcome and a cancelled reservation are refunded. */
export const MAX_RESERVATIONS_PER_KEY_PER_SESSION = 3;
/** A reservation's in-flight period: while it runs the key is refused `in_flight`. */
export const IN_FLIGHT_MS = 120_000;
/** The next scheduled run of the reflections cron (every 15 min), less a minute of jitter. */
export const NEXT_RUN_MS = 14 * 60_000;
/** Margin past the store's confirmation interval. */
export const CONFIRM_MARGIN_MS = 60_000;
/**
 * Correction B: a reservation whose outcome was never saved is RECOVERED once its in-flight period
 * has passed, and its next attempt is due this long after the recovery observation. It is Slice 2's
 * own schedule; it cannot guarantee a confirmation if ID-1's observer changes the store's refusal
 * observation meanwhile, and a further `retryable` outcome is then legitimate.
 */
export const RECOVERY_DUE_MS = STORE_CONFIRM_AFTER_MS + CONFIRM_MARGIN_MS;
/** The state's key cap: a new key past it is refused (`state_full`); nothing is ever evicted to admit one. */
export const STATE_MAX_KEYS = 400;
/** Below this before the deadline, the end-of-run state transaction is skipped (cursors and pruning wait for a later run). */
export const STATE_WRITE_RESERVE_MS = 1_000;

/** The battle fields the tenant reads (a field mask: nothing else leaves Firestore). */
export const BATTLE_FIELDS = Object.freeze(['ownerId', 'status', 'gameMode', 'isCpu', 'agentId', 'agentContext.archetype', 'watchlist.hotBench']);

/** Collections. */
export const STATE_COLLECTION = 'setupMenuLabelState';
export const STATE_DOC = 'main';
export const STATE_SCHEMA_VERSION = 1;
/** The one snapshot schema this slice knows (setupEvidence/acquire.js SNAPSHOT_SCHEMA_VERSION; pinned). */
export const SNAPSHOT_SCHEMA_VERSION = 1;
/** The store's lease host for this tenant's calls. */
export const TENANT_HOST = 'setup-menu-labels';

/**
 * Reasons the store returns with `retryable` that a next run can cure (the request failed or the
 * calendar could not answer): due at the next run. Every other reason, unlisted ones included, is
 * treated as adapter-class and waits out the store's confirmation interval.
 */
export const TRANSIENT_REASONS = Object.freeze(['fetch_failed', 'non_array_payload', 'malformed_payload', 'calendar_missing', 'asOf_in_future']);
/**
 * The typed reasons the state may store (Correction D.3): every reason the store can return with
 * `retryable` (the observer's MISSING_DETAILS list) — anything else is stored as `other`.
 */
export const STATE_REASONS = Object.freeze([
  'missing_bar', 'unordered_bars', 'calendar_missing', 'asOf_in_future', 'insufficient_history', 'missing_fact',
  'adjustment_metadata_absent', 'adjusted_close_missing', 'adjusted_close_nonpositive',
  'fetch_failed', 'non_array_payload', 'malformed_payload', 'other',
]);
/** A state entry's recorded outcomes. `unresolved` is a recovered reservation whose outcome was never saved. */
export const STATE_OUTCOMES = Object.freeze(['final', 'excluded', 'retryable', 'pending', 'threw', 'unresolved']);

// ---- The record's closed lists (spec V2 §5.2, amended) — captureConfig.js holds the same lists; pinned equal.
export const SETUP_MENU_BLOCK_STATUSES = Object.freeze(['ok', 'truncated', 'reads_unsettled', 'calendar_missing', 'error']);
export const SETUP_MENU_SELECTORS = Object.freeze(['archetype', 'legacy', 'carried']);
export const SETUP_MENU_SOURCES = Object.freeze(['hotbench', 'catalyst']);
export const SETUP_LABEL_STATUSES = Object.freeze(['labelled', 'refused', 'absent', 'excluded', 'symbol_form', 'stale_snapshot', 'read_failed', 'read_unsettled']);
export const SETUP_VERDICTS = Object.freeze(['valid', 'invalid', 'unknown']);
export const SETUP_PATTERNS = Object.freeze(['breakout', 'pullback_resume']);
export const SETUP_REGIMES = Object.freeze(['uptrend', 'downtrend', 'no_trend', 'unknown']);
export const SETUP_BARS_CLASSES = Object.freeze(['contemporaneous', 'later_reconstruction']);
export const SETUP_SNAPSHOT_STATUSES = Object.freeze(['ok', 'refused']);
export const SETUP_S2_OUTCOMES = STATE_OUTCOMES;
/** The block's error codes (an `id` on the record). */
export const SETUP_MENU_ERROR_CODES = Object.freeze(['compose_failed', 'freeze_failed', 'block_rejected', 'record_budget']);
