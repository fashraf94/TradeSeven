// api/_utils/intradayConfig.js
//
// Intraday Data — Build 1, contract §5.2: the poller's tiers, cadence and
// vendor-pending configuration. PURE CONSTANTS, zero imports.
//
// Changing ANY of these is a founder PR that bumps CALC_VERSION (contract
// §5.2 / §10.7) — the validator's qualification calendar resets on a change
// to source, cadence, seeding, calcVersion or policy (§10.6).

/** Universe (255 real-time names) swept every N ET minutes; actionable every minute. */
export const UNIVERSE_CADENCE_MIN = 5;
/** Actionable tier (held ∪ bench across active battles) swept every invocation. */
export const HELD_TIER_ENABLED = true;
/** Lease on intradaySnapshots/latest (§7.4). */
export const LEASE_MS = 90_000;
/** Live v2 accepts ≤ 20 tickers per request, 1 unit each (G1, §4). */
export const MAX_TICKERS_PER_REQUEST = 20;

// ---- Vendor-pending (contract §15) — each null until the vendor answers. ----
/** Which Observation field `volume` is cumulative TO (e.g. 'snapshotTs'). null → cutoff unconfirmed. */
export const VOLUME_CUTOFF_FIELD = null;
/** Which Observation field session high/low/open are cumulative TO. null → cutoff unconfirmed. */
export const HL_CUTOFF_FIELD = null;
/** Closing-row assignment policy (§15 item 2). null → the closing bar is unresolved. */
export const CLOSING_ROW_POLICY = null;

/** §10.7 — covers §5.4–5.6, §6, §10.2–10.3. */
export const CALC_VERSION = 1;
/** §10.7 — covers §8.3. */
export const POLICY_VERSION = 1;

// ---- Derived timing constants (contract text, not tunables) ----
export const BUCKET_MS = 300_000;
/** Quote collection window: [open, close + 30 min] (§5.1). */
export const COLLECTION_WINDOW_AFTER_CLOSE_MS = 30 * 60_000;
/** Deadline for a last bucket not normally completed: close + 30 min (§6.2). */
export const DEADLINE_AFTER_CLOSE_MS = 30 * 60_000;
/** priceAsOf may lead availableAt by at most this much (§5.5 reject rule). */
export const PRICE_AS_OF_FUTURE_TOLERANCE_MS = 60_000;
/** volumePace needs at least this many elapsed session minutes (§5.4). */
export const VOLUME_PACE_MIN_ELAPSED_MIN = 5;
/** A snapshot whose last successful sweep is older than this at the check is collectionStalled (§8.2). */
export const COLLECTION_STALL_MS = 5 * 60_000;
/** Accumulator samples required for eligibility (§8.3). */
export const MIN_ACCUMULATOR_SAMPLES = 3;

// ---- Seeding (§6.6) ----
export const SEED_MAX_BUCKETS = 60;
export const SEED_MIN_BUCKETS = 35;
export const SEED_MAX_SESSIONS = 2;
export const SEED_RETRY_INTERVAL_MS = 15 * 60_000;
export const SEED_RETRY_WINDOW_MS = 2 * 60 * 60_000;

// ---- Fetch (§5.3) ----
export const FETCH_TIMEOUT_MS = 10_000;
export const FETCH_CONCURRENCY = 4;

// ---- Consumers (§8.3) ----
export const CONSUMER_MAX_AGE_MS = Object.freeze({
  display: 45 * 60_000,
  stage4: 25 * 60_000,
});

// ---- Validator (§10) ----
export const VALIDATOR_SYMBOLS_PER_INVOCATION = 20;
export const VALIDATOR_BUDGET_MS = 60_000;
export const VALIDATOR_WINDOW_CLOSE_HOUR_UTC = 16;
export const REFERENCE_COVERAGE_MIN_PCT = 90;
export const NEAR_THRESHOLD_BAND_PCT = 0.25;
