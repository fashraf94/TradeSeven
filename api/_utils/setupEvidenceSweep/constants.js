// api/_utils/setupEvidenceSweep/constants.js
//
// The chart's evidence, PR B — THE SWEEP'S NAMED LIMITS AND CLOSED LISTS (spec of record
// docs/specs/CHART_EVIDENCE_SPEC_V1.md SW-1 – SW-9). Pure: numbers and names only, no imports.
//
// The store's provider timeout and confirmation interval are RESTATED here (never imported), so
// the census can load this module without loading the store's write-capable modules;
// constants.test.js pins each equal to the store's acquire.js and store.js.

// ---- The store's own numbers (restated; pinned) -------------------------------------------------
/** The store's ACQUIRE_TIMEOUT_MS: the bound on one provider read. */
export const STORE_ACQUIRE_TIMEOUT_MS = 5_000;
/** The store's CONFIRM_AFTER_MS: the gap between the two samples of a confirmed refusal. */
export const STORE_CONFIRM_AFTER_MS = 30 * 60_000;
/** The store's SNAPSHOT_SCHEMA_VERSION: the one record schema the census tallies. */
export const STORE_SNAPSHOT_SCHEMA_VERSION = 1;

// ---- The schedule (SW-3) -----------------------------------------------------------------------
/**
 * Three runs per trading session, weekdays in UTC: 22:30 and 23:30 (5:30 and 6:30 PM EST; 6:30 and
 * 7:30 PM EDT — after the 4:00 PM ET close in both, an hour apart, so the second run's fetch starts
 * well over the store's 30 minutes after the first's), and 12:30 the next weekday (7:30 AM EST; 8:30
 * AM EDT — before the 9:30 AM ET open in both). One vercel.json entry; constants.test.js pins it.
 */
export const SWEEP_SCHEDULE = '30 12,22,23 * * 1-5';
export const SWEEP_PATH = '/api/cron/setup-evidence-sweep';
/** The cron's maxDuration, in seconds (the handler's config; pinned). */
export const SWEEP_MAX_DURATION_S = 300;

// ---- One run (SW-2) ----------------------------------------------------------------------------
/** Store calls in flight at once; the record reads share the same four slots. */
export const SWEEP_CONCURRENCY = 4;
/** From the handler's start: an ADMISSION deadline. No name is read or acquired after it; every started call is awaited. */
export const SWEEP_ADMISSION_WINDOW_MS = 240_000;
/** A store call starts only with at least this much left before the admission deadline: the claim, the reservation, the 5 s fetch, the final transaction. */
export const SWEEP_ADMISSION_RESERVE_MS = STORE_ACQUIRE_TIMEOUT_MS + 7_000;
/**
 * THE BRAKE (readings R-3, R-14, R-17; review L1-1, L1-2, L2-1): this many outcomes of one kind in a row, each from a request
 * this run counted, close admission, the kind being the deferred reason:
 *   'unpublished'       missing_bar with no usable row for the session: the provider has not published it yet;
 *   'shared_refusal'    a refusal the store makes permanent through its confirm rule (CONFIRMABLE_REFUSAL_REASONS: a gap
 *                       inside the window — missing_bar WITH the session's row —, a short history, a bad date, a missing
 *                       fact), observed or confirmed as a refused record: in a row, one cause shared by every name (a
 *                       closure the calendar lacks, a provider-wide hole, a truncated answer), whose confirmations are permanent;
 *   'provider_failing'  a transport failure (TRANSPORT_FAILURE_REASONS), a missing provider key included.
 * Any other outcome of this run's own request breaks the streak; a record merely read does not.
 */
export const BRAKE_STREAK_STOP = 8;
/** The store's retryable reasons that mean the request itself failed (a subset of RETRYABLE_REASONS; pinned). */
export const TRANSPORT_FAILURE_REASONS = Object.freeze(['fetch_failed', 'non_array_payload', 'malformed_payload']);
/** The adapter's refusals the store turns into a permanent refused record by its confirm rule (or, for an older row's missing fact, at once). */
export const CONFIRMABLE_REFUSAL_REASONS = Object.freeze(['missing_bar', 'insufficient_history', 'unordered_bars', 'missing_fact']);
/** The store's lease host for the sweep's calls. */
export const SWEEP_HOST = 'setup-evidence-sweep';

// ---- The allocation (SW-4) ---------------------------------------------------------------------
/** The HARD STOP: provider requests per trading session (the day's state document). The 400th is the last. */
export const SWEEP_DAILY_PROVIDER_CAP = 400;

// ---- The state (SW-5) --------------------------------------------------------------------------
export const STATE_COLLECTION = 'setupEvidenceSweepState';
export const STATE_SCHEMA_VERSION = 1;
/** The top-level keys of a state document, in order. Counts and instants only: no symbol, no per-symbol map. */
export const STATE_FIELDS = Object.freeze(['schemaVersion', 'session', 'providerRequests', 'runs', 'firstRunAt', 'lastRunAt', 'completedAt', 'runMs', 'latest', 'updatedAt']);
/** The latest run's tallies, in order. */
export const LATEST_FIELDS = Object.freeze(['startedAt', 'names', 'final', 'acquired', 'retryable', 'pending', 'excluded', 'deferred', 'failures', 'programmingErrors']);

/**
 * The reasons the store returns with `retryable` (the observer's and Slice 2's list): kept by name;
 * anything else is counted as `other`, so neither the state nor the log can carry a free string.
 */
export const RETRYABLE_REASONS = Object.freeze([
  'missing_bar', 'unordered_bars', 'calendar_missing', 'asOf_in_future', 'insufficient_history', 'missing_fact',
  'adjustment_metadata_absent', 'adjusted_close_missing', 'adjusted_close_nonpositive',
  'fetch_failed', 'non_array_payload', 'malformed_payload', 'other',
]);
/** Why a name was not attempted this run. */
export const DEFERRED_REASONS = Object.freeze(['deadline', 'cap', 'unpublished', 'shared_refusal', 'provider_failing', 'counter_failed', 'state_unreadable', 'programming_error', 'calendar_missing', 'non_session']);
/** Where a failure happened (the prefix of a failure count's key). */
export const FAILURE_STAGES = Object.freeze(['state', 'read', 'reserve', 'acquire', 'record', 'unit']);
export const HEALTH_LINE_PREFIX = '[setupEvidenceSweep]';
