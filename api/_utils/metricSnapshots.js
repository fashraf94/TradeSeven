// api/_utils/metricSnapshots.js
//
// Metric History Snapshot Substrate — dark; gated by METRIC_HISTORY_SNAPSHOT_ENABLED.
//
// Persists the daily per-ticker metric history that Workstream B's decomposition
// gate will need weeks from now (EXA_RETRIEVAL_INTEGRATION_SPEC_V1_4 §6.0, FOUNDER
// DECISION 2). This is DETECTION SUBSTRATE — pure data accumulation. Nothing reads
// it yet; nothing is user-facing; no EXA, no retrieval, no new EODHD fetches, no new
// cron slots. It runs as a FAILURE-ISOLATED co-tenant write inside the existing
// ranking cron (api/cron/compute-rankings.js), AFTER the ranking documents persist.
//
// The value of this data cannot be backfilled — every day without persistence is
// history permanently lost — which is why the substrate ships ahead of the EXA arc.
//
// Two responsibilities, no opinions about ranking logic (the ranking→snapshot field
// mapping lives at the call site in compute-rankings.js, which owns those shapes):
//   - writeDailySnapshots(db, metricsByTicker, asOfDate)
//       → one doc per ticker per trading day at metricSnapshots/{ticker}/daily/{YYYY-MM-DD}
//         (subcollection shape per the seasonEntries/{id}/dailyLogs/{day} precedent —
//         no hot docs). Doc id = date ⇒ a same-day re-run overwrites its own snapshot,
//         idempotent by construction; a plain `set` is correct.
//   - retainQuarterlySeries(db, ticker, rawSeries)
//       → quarterlySeries/{ticker} single doc: the raw quarterly series the ranking
//         cron already fetches transiently and then discards (EPS history + quarterly
//         income (revenue) + quarterly balance sheet (share-count series)), stored
//         exactly as fetched. Overwrite each run is fine — the series is append-mostly
//         and small.
//
// Storage sanity: ~239 daily + ~239 quarterly docs/run ≈ 60K daily docs/year —
// negligible. No TTL, deliberately: history is the product. New collections
// (metricSnapshots, quarterlySeries) are client-denied by the firestore.rules
// terminal catch-all (the ingestedClaims / archetypeVintages precedent — server-write
// only, headless substrate), so no firestore.rules change is required. No Firestore
// index additions — no consumer exists yet.
//
// Batched writes in ≤500-doc chunks (the ingestedClaims precedent). Every write path
// is wrapped so a snapshot failure only logs and returns — it must never fail or delay
// the ranking computation.

const LOG_PREFIX = '[MetricSnapshots]';

// Semantic schema version stamped on every snapshot / series doc.
export const SNAPSHOT_SCHEMA_VERSION = 1;

// Firestore batches cap at 500 writes (ingestedClaims precedent).
export const MAX_BATCH_SIZE = 500;

// Runtime respect (§4.2): the ranking cron's maxDuration is 180s. If the run is
// already near that envelope when snapshots would begin, skip-and-log rather than
// risk the host. The default guard leaves 15s of headroom for the ~1–2 batch commits
// this does (measured overhead is a couple of seconds — see the PR report).
const DEFAULT_MAX_DURATION_MS = 180_000;
const ELAPSED_GUARD_HEADROOM_MS = 15_000;

// ---------------------------------------------------------------------------
// Firestore-safety
// ---------------------------------------------------------------------------

/**
 * Firestore's Admin SDK throws on `undefined` field values, and a single stray
 * undefined would fail the ENTIRE batch commit (batches are all-or-nothing) — so a
 * snapshot doc is passed through this before it is enrolled. Recursively replaces
 * `undefined` with `null`, preserves `Date` instances (they map to Firestore
 * Timestamps), and drops function-valued keys. Plain objects/arrays are deep-copied.
 * Exported for direct unit testing.
 */
export function nullSafe(value) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(nullSafe);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === 'function') continue;
      out[k] = nullSafe(v);
    }
    return out;
  }
  return value; // number | string | boolean
}

// ---------------------------------------------------------------------------
// Daily per-ticker snapshots → metricSnapshots/{ticker}/daily/{YYYY-MM-DD}
// ---------------------------------------------------------------------------

/**
 * Build the daily snapshot document for one ticker. Pure; no Firestore access.
 * `fields` is the per-ticker payload the caller captured from the in-memory ranking
 * state (ranks, scores, pillar/dimension detail, raw metrics, sector/industry
 * membership). The envelope (asOfDate, computedAt, snapshotSchemaVersion) is stamped
 * here so every doc is self-describing. Exported for unit tests.
 */
export function buildDailySnapshotDoc(fields, asOfDate, computedAt) {
  return nullSafe({
    ...(fields || {}),
    asOfDate,
    computedAt: computedAt ?? new Date(),
    snapshotSchemaVersion: SNAPSHOT_SCHEMA_VERSION,
  });
}

/**
 * Write one daily snapshot doc per ticker at metricSnapshots/{ticker}/daily/{asOfDate},
 * batched in ≤500-doc chunks. Idempotent: the doc id is the date, so a same-day re-run
 * overwrites rather than duplicates. Never throws — a commit failure is caught, logged,
 * and reported in the returned summary.
 *
 * @param {FirebaseFirestore.Firestore} db  Admin SDK Firestore handle (injected).
 * @param {Object<string, Object>} metricsByTicker  ticker → per-ticker snapshot fields.
 * @param {string} asOfDate  'YYYY-MM-DD' trading day; also the daily doc id.
 * @returns {Promise<{ written: number, errors: string[] }>}
 */
export async function writeDailySnapshots(db, metricsByTicker, asOfDate, { computedAt = new Date() } = {}) {
  const errors = [];
  let written = 0;
  try {
    if (!db) return { written, errors: ['no db handle'] };
    if (!asOfDate) return { written, errors: ['no asOfDate'] };

    const tickers = Object.keys(metricsByTicker || {});
    let batch = db.batch();
    let inBatch = 0;

    for (const ticker of tickers) {
      try {
        const doc = buildDailySnapshotDoc(metricsByTicker[ticker], asOfDate, computedAt);
        const ref = db.collection('metricSnapshots').doc(ticker).collection('daily').doc(asOfDate);
        batch.set(ref, doc);
        inBatch++;
        written++;
      } catch (err) {
        errors.push(`${ticker}: ${err.message}`);
        continue;
      }
      // Commit outside the per-ticker try so a commit failure surfaces to the outer
      // catch instead of poisoning the same batch on the next iteration.
      if (inBatch >= MAX_BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        inBatch = 0;
      }
    }

    if (inBatch > 0) await batch.commit();
  } catch (err) {
    errors.push(`commit: ${err.message}`);
  }
  return { written, errors };
}

// ---------------------------------------------------------------------------
// Raw quarterly series → quarterlySeries/{ticker}
// ---------------------------------------------------------------------------

/**
 * Build the quarterly-series document for one ticker. Pure; no Firestore access.
 * The raw arrays are stored EXACTLY as fetched by the ranking cron (no derivation, no
 * reshaping beyond field naming):
 *   - earningsHistory        : EODHD Earnings.History            (raw quarterly EPS series)
 *   - incomeQuarterly        : EODHD Financials.Income_Statement.quarterly   (revenue series)
 *   - balanceSheetQuarterly  : EODHD Financials.Balance_Sheet.quarterly      (share-count series)
 * Exported for unit tests.
 */
export function buildQuarterlySeriesDoc(ticker, rawSeries, lastUpdated) {
  const s = rawSeries || {};
  return nullSafe({
    ticker,
    earningsHistory: s.earningsHistory ?? null,
    incomeQuarterly: s.incomeQuarterly ?? null,
    balanceSheetQuarterly: s.balanceSheetQuarterly ?? null,
    lastUpdated: lastUpdated ?? new Date(),
    snapshotSchemaVersion: SNAPSHOT_SCHEMA_VERSION,
  });
}

/**
 * Retain one ticker's raw quarterly series at quarterlySeries/{ticker}. Overwrite on
 * each run (plain `set`). If a write `batch` is supplied the write is enrolled in it
 * (the caller commits — the batched hot path); otherwise a standalone awaited `set`
 * runs. Returns the doc that was written/enrolled.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} ticker
 * @param {Object} rawSeries  { earningsHistory, incomeQuarterly, balanceSheetQuarterly }
 */
export async function retainQuarterlySeries(db, ticker, rawSeries, { batch = null, lastUpdated } = {}) {
  const doc = buildQuarterlySeriesDoc(ticker, rawSeries, lastUpdated ?? new Date());
  const ref = db.collection('quarterlySeries').doc(ticker);
  if (batch) {
    batch.set(ref, doc);
  } else {
    await ref.set(doc);
  }
  return doc;
}

/**
 * Batched retention of every ticker's raw quarterly series, in ≤500-doc chunks via
 * retainQuarterlySeries. Never throws — mirrors writeDailySnapshots' isolation.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object<string, Object>} seriesByTicker  ticker → rawSeries
 * @returns {Promise<{ written: number, errors: string[] }>}
 */
export async function writeQuarterlySeriesBatch(db, seriesByTicker, { lastUpdated = new Date() } = {}) {
  const errors = [];
  let written = 0;
  try {
    if (!db) return { written, errors: ['no db handle'] };

    const tickers = Object.keys(seriesByTicker || {});
    let batch = db.batch();
    let inBatch = 0;

    for (const ticker of tickers) {
      try {
        await retainQuarterlySeries(db, ticker, seriesByTicker[ticker], { batch, lastUpdated });
        inBatch++;
        written++;
      } catch (err) {
        errors.push(`${ticker}: ${err.message}`);
        continue;
      }
      if (inBatch >= MAX_BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        inBatch = 0;
      }
    }

    if (inBatch > 0) await batch.commit();
  } catch (err) {
    errors.push(`commit: ${err.message}`);
  }
  return { written, errors };
}

// ---------------------------------------------------------------------------
// Failure-isolated orchestrator (the single thing the cron hook calls)
// ---------------------------------------------------------------------------

/**
 * Capture the daily snapshots and the quarterly series for a ranking run. This is the
 * failure-isolated entry point the compute-rankings hook calls: it applies the
 * elapsed-time runtime guard, runs both write paths, and NEVER throws — any error is
 * caught, logged, and folded into the returned summary so the ranking cron is untouched.
 *
 * @param {Object} args
 * @param {FirebaseFirestore.Firestore} args.db
 * @param {Object<string, Object>} args.metricsByTicker   ticker → daily snapshot fields
 * @param {Object<string, Object>} args.quarterlyByTicker ticker → raw quarterly series
 * @param {string} args.asOfDate         'YYYY-MM-DD'
 * @param {Date}   [args.computedAt]     stamped on every doc (and used as lastUpdated)
 * @param {number} [args.startTime]      Date.now() at cron start (for the elapsed guard)
 * @param {number} [args.maxDurationMs]  the cron's maxDuration in ms (default 180000)
 * @param {number} [args.elapsedGuardMs] override the computed skip threshold
 * @returns {Promise<{ ok, skipped, reason, daily, quarterly }>}
 */
export async function captureMetricHistorySnapshots({
  db,
  metricsByTicker = {},
  quarterlyByTicker = {},
  asOfDate,
  computedAt = new Date(),
  startTime = null,
  maxDurationMs = DEFAULT_MAX_DURATION_MS,
  elapsedGuardMs = null,
} = {}) {
  const result = { ok: false, skipped: false, reason: null, daily: null, quarterly: null };
  try {
    if (!db) { result.reason = 'no db handle'; console.warn(`${LOG_PREFIX} skipped: ${result.reason}`); return result; }
    if (!asOfDate) { result.reason = 'no asOfDate'; console.warn(`${LOG_PREFIX} skipped: ${result.reason}`); return result; }

    // Runtime respect: skip-and-log if the run is already near its maxDuration envelope.
    if (startTime != null) {
      const guard = elapsedGuardMs ?? Math.max(0, maxDurationMs - ELAPSED_GUARD_HEADROOM_MS);
      const elapsedMs = Date.now() - startTime;
      if (elapsedMs > guard) {
        result.skipped = true;
        result.reason = `elapsed ${(elapsedMs / 1000).toFixed(1)}s exceeds guard ${(guard / 1000).toFixed(1)}s (maxDuration ${(maxDurationMs / 1000).toFixed(0)}s)`;
        console.warn(`${LOG_PREFIX} skipped: ${result.reason}`);
        return result;
      }
    }

    result.daily = await writeDailySnapshots(db, metricsByTicker, asOfDate, { computedAt });
    result.quarterly = await writeQuarterlySeriesBatch(db, quarterlyByTicker, { lastUpdated: computedAt });
    result.ok = result.daily.errors.length === 0 && result.quarterly.errors.length === 0;

    console.log(
      `${LOG_PREFIX} asOf ${asOfDate}: daily ${result.daily.written} written (${result.daily.errors.length} err), ` +
      `quarterly ${result.quarterly.written} written (${result.quarterly.errors.length} err)`
    );
    // A write-path failure is isolated (the ranking cron already completed), but it must
    // still be visible in the logs — surface it explicitly rather than only in the return.
    if (!result.ok) {
      const firstErrors = [...result.daily.errors, ...result.quarterly.errors].slice(0, 3).join(' | ');
      console.error(`${LOG_PREFIX} snapshot write reported errors (rankings unaffected): ${firstErrors}`);
    }
    return result;
  } catch (err) {
    // Belt-and-suspenders: the write paths above already isolate their own failures,
    // so reaching here means something upstream of them threw. Swallow-and-log — the
    // ranking computation has already completed and persisted; this must not disturb it.
    result.reason = err.message;
    console.error(`${LOG_PREFIX} capture failed (isolated, rankings unaffected): ${err.message}`);
    return result;
  }
}
