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
 * The unpublished-session brake (a reading, spec §5.4): this many `missing_bar` retryables in a row,
 * each from a request this run made, and the run stops admitting — the provider has not yet published
 * the session's bar, and the next run tries again. Any other outcome resets the streak.
 */
export const UNPUBLISHED_STREAK_STOP = 8;
/**
 * The provider-failure brake (review L2-1, a reading beside R-3): this many transport failures in a row (a failed or
 * timed-out request, a non-array or unreadable body — and a missing key, which fails before the network), each from a
 * request this run counted, and the run stops admitting. Without it an outage would spend the session's whole cap on
 * failures and leave the morning's catch-up nothing. A request that reached the provider and came back usable resets it.
 */
export const PROVIDER_FAILURE_STREAK_STOP = 8;
/** The store's retryable reasons that mean the request itself failed (a subset of RETRYABLE_REASONS; pinned). */
export const TRANSPORT_FAILURE_REASONS = Object.freeze(['fetch_failed', 'non_array_payload', 'malformed_payload']);
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
export const DEFERRED_REASONS = Object.freeze(['deadline', 'cap', 'unpublished', 'provider_failing', 'state_unreadable', 'programming_error', 'calendar_missing', 'non_session']);
/** Where a failure happened (the prefix of a failure count's key). */
export const FAILURE_STAGES = Object.freeze(['state', 'read', 'reserve', 'acquire', 'record', 'unit']);
export const HEALTH_LINE_PREFIX = '[setupEvidenceSweep]';
