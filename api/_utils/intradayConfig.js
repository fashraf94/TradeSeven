// api/_utils/intradayConfig.js
//
// Intraday Data — Build 1, contract §5.2: the poller's tiers, cadence and
// vendor-answered configuration (§15). PURE CONSTANTS, zero imports.
//
// Changing ANY of these is a founder PR that bumps CALC_VERSION (contract
// §5.2 / §10.7) — the validator's qualification calendar resets on a change
// to source, cadence, seeding, calcVersion or policy (§10.6).

/** Universe (255 real-time names) swept every N ET minutes; actionable every minute. */
export const UNIVERSE_CADENCE_MIN = 5;
/** Actionable tier (held ∪ bench across active battles) swept every invocation. */
export const HELD_TIER_ENABLED = true;
/**
 * Lease on intradaySnapshots/latest (§7.4).
 *
 * Addendum A1: 90_000 → 50_000. The lease MUST expire before the function
 * does (`intraday-poll.js` `maxDuration: 60`), or an invocation killed at the
 * platform limit leaves a lease the next minute's invocation cannot take —
 * one dead sweep for every killed one. 50 s gives the killed invocation's
 * lease 10 s to lapse before the next minute begins.
 */
export const LEASE_MS = 50_000;
/** Live v2 accepts ≤ 20 tickers per request, 1 unit each (G1, §4). */
export const MAX_TICKERS_PER_REQUEST = 20;

// ---- Vendor-answered (contract §15) — EODHD, 2026-09-21. ----
//
// THE TWO CUTOFF FIELDS NAME AN OBSERVATION KEY (`resolveCutoff` reads
// `obs[field]` — accumulator.js), and only two values are permitted: `null`,
// or `'priceAsOf'` — the Observation field the Live v2 adapter maps from the
// vendor's `lastTradeTime` (observation.js:95, :101).
//
// `'snapshotTs'` IS EXCLUDED, and was never a pending option. It carries the
// vendor's `timestamp`, and on all 21 quotes of the founder's Live v2
// responses (2026-09-20, 2 symbols then 20) that field is exactly
// `floor(lastTradeTime / 60_000) × 60 + 14_400` — the last-trade minute plus
// the Eastern offset, matching the example on EODHD's Live v2 documentation
// page. `lastTradeTime`, `bidTime`, `askTime` and `ethTime` agree with one
// another; `timestamp` carries NO INDEPENDENT INFORMATION. It is an identity
// (it changes when the quote changes, which is what `observationId` uses it
// for) and must never be read as the instant a cumulative field is cumulative
// TO. Locked by intradayConfig.test.js, which also traps the literal
// `'lastTradeTime'`: no Observation key is named that, so it would resolve to
// null and read as "cutoff unconfirmed" while looking configured.
//
// THE VENDOR'S ANSWERS (2026-09-21), and why each field is now `'priceAsOf'`:
//
//   (1) Live v2 `volume` is consolidated REGULAR-SESSION volume for the
//       current day, accumulated as the session runs; it does NOT include
//       `ethVolume`. So while the session is running it is cumulative to the
//       last trade — `priceAsOf`. After 16:00 ET it stops at the session
//       total while `lastTradePrice`/`lastTradeTime` keep updating with
//       extended-hours prints, so after the close `priceAsOf` is LATER than
//       the point `volume` reflects. That is why §5.5 now classifies an
//       observation with `priceAsOf ≥ sessionCloseMs` as `post_close` and
//       updates no session aggregate from it: only a PRE-CLOSE observation's
//       clock is a valid cutoff.
//   (2) Live v2 `high` and `low` are regular-session only — same clock, same
//       post-close rule.
//
/** Which Observation field `volume` is cumulative TO. null | 'priceAsOf' only. null → cutoff unconfirmed. */
export const VOLUME_CUTOFF_FIELD = 'priceAsOf';
/** Which Observation field session high/low/open are cumulative TO. null | 'priceAsOf' only. */
export const HL_CUTOFF_FIELD = 'priceAsOf';
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

// ---- Seed-loop bounds (addendum A1) ----
//
// The first sweep of EVERY trading day must seed every actionable symbol,
// because intradayCalcState is sharded per ET date — so the seed loop is the
// longest-running part of the longest-running invocation of the day, inside a
// function with `maxDuration: 60`. Unbounded and sequential at
// FETCH_TIMEOUT_MS each, seven timing-out symbols exhaust the budget; the
// invocation is killed, no units are recorded and no attempt is stamped, and
// the next minute replans the same symbols. These three bound it: deferred
// seeds simply run on subsequent invocations (§6.6's retry interval governs
// re-attempts, not first attempts).
/** Wall-clock budget for the whole seed loop, measured from invocation start. */
export const SEED_TIME_BUDGET_MS = 35_000;
/** At most this many symbols attempt a seed in one invocation. */
export const SEED_MAX_PER_INVOCATION = 10;
/** Concurrent seed fetches (quotes use FETCH_CONCURRENCY). */
export const SEED_CONCURRENCY = 3;

/**
 * Addendum A4 — the publish transaction refuses rather than attempts above
 * this. Firestore's hard limit on one transaction is 10 MiB; 9 MiB leaves
 * headroom for the accounting's own approximation. The review's exact model
 * puts the crossing at 81 actionable symbols (~7 concurrent battles at
 * held ∪ bench), and because the log grows through the session it would be
 * crossed near the CLOSE — taking exactly the data the validator needs. An
 * attempted over-limit transaction also stalls the sweep permanently: it
 * writes nothing, so the next minute reloads the same document, appends one
 * more log entry and fails identically, while units keep being charged.
 */
export const PUBLISH_MAX_BYTES = 9 * 1024 * 1024;

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
