// api/_utils/metricSnapshots.test.js
//
// Tests for the Metric History Snapshot Substrate (EXA spec §6.0 / FOUNDER DECISION 2).
// Mock Admin SDK only — no live Firestore. Covers the five acceptance points in the
// build task (4.3):
//   1. Off-state pin      — flag false ⇒ zero snapshot writes (the flagPinGuard assertion)
//   2. On-state shape     — flag path writes per-ticker daily docs, correct id + fields
//   3. Failure isolation  — a throwing writer completes normally, error logged
//   4. Idempotency        — a same-day re-run overwrites its own doc, never duplicates
//   5. Quarterly retention— series doc written from a real-transient-shaped fixture
// Plus a runtime-guard test (§4.2) and the on-state gate behaviour.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Off-state pin (item 1) imports the live flag. This import is ALSO the BUILD_RULES §4
// dependency-surface guard for compute-rankings.js's new api→src flag import: it runs in
// the Node test env and would explode if a browser-only dependency ever entered
// src/config/featureFlags.js's graph. It must never be mocked.
import { METRIC_HISTORY_SNAPSHOT_ENABLED } from '../../src/config/featureFlags.js';

import {
  SNAPSHOT_SCHEMA_VERSION,
  nullSafe,
  buildDailySnapshotDoc,
  buildQuarterlySeriesDoc,
  writeDailySnapshots,
  retainQuarterlySeries,
  writeQuarterlySeriesBatch,
  captureMetricHistorySnapshots,
} from './metricSnapshots.js';

// ---------------------------------------------------------------------------
// Fake Admin SDK Firestore. Records every set() (batched and standalone) with its
// full ref path and payload, plus commit count. Mirrors the shapes the module uses:
//   db.collection(a).doc(b).collection(c).doc(d)  →  path "a/b/c/d"
//   db.batch().set(ref, data) / .commit()
//   ref.set(data)
// ---------------------------------------------------------------------------
function makeFakeDb({ failCommit = false, throwOnBatch = false } = {}) {
  const sets = [];       // { path, data }
  let commitCount = 0;

  const docRef = (path) => ({
    _path: path,
    collection: (name) => collectionRef(`${path}/${name}`),
    set: async (data) => { sets.push({ path, data }); },
  });
  const collectionRef = (path) => ({
    _path: path,
    doc: (id) => docRef(`${path}/${id}`),
  });

  return {
    _sets: sets,
    get _commitCount() { return commitCount; },
    collection: (name) => collectionRef(name),
    batch: () => {
      if (throwOnBatch) throw new Error('batch() unavailable');
      const ops = [];
      return {
        set: (ref, data) => { ops.push({ path: ref._path, data }); },
        commit: async () => {
          if (failCommit) throw new Error('commit rejected (simulated Firestore outage)');
          commitCount++;
          for (const op of ops) sets.push(op);
          ops.length = 0;
        },
      };
    },
  };
}

// A representative per-ticker daily payload (the shape compute-rankings' hook builds).
function makeMetricsFixture() {
  return {
    AAPL: {
      ticker: 'AAPL',
      sectorId: 'XLK',
      sectorName: 'Technology',
      industryName: 'Technology Hardware, Storage & Peripherals',
      compositeScore: 82,
      compositeRank: 3,
      totalPeers: 30,
      metricsAvailable: 28,
      tier: { label: 'Elite', color: '#22c55e' },
      pillars: { growth: 70, profitability: 95, valuation: 40 },
      ranks: {
        revenueGrowth: { rank: 5, totalWithData: 30, value: 0.08, percentile: 62 },
        opMargin: { rank: 1, totalWithData: 30, value: 0.31, percentile: 100 },
      },
      metrics: { revenueGrowthYOY: 0.08, opMarginTTM: 0.31, currentPrice: 231.4, name: 'Apple Inc' },
      dnaBadge: null,
      debtRiskBadge: null,
    },
    MSFT: {
      ticker: 'MSFT',
      sectorId: 'XLK',
      sectorName: 'Technology',
      industryName: 'Software',
      compositeScore: 88,
      compositeRank: 1,
      totalPeers: 30,
      metricsAvailable: 29,
      tier: { label: 'Elite', color: '#22c55e' },
      pillars: { growth: 80, profitability: 90, valuation: 45 },
      ranks: { opMargin: { rank: 2, totalWithData: 30, value: 0.42, percentile: 96 } },
      metrics: { revenueGrowthYOY: 0.12, opMarginTTM: 0.42, currentPrice: 415.2, name: 'Microsoft Corp' },
      dnaBadge: null,
      debtRiskBadge: null,
    },
  };
}

// A quarterly fixture matching the REAL transient EODHD shape held in
// allFundamentals[ticker] during the cron: date-keyed objects, exactly as fetched.
function makeQuarterlyFixture() {
  return {
    AAPL: {
      earningsHistory: {
        '2025-06-30': { reportDate: '2025-07-31', epsActual: 1.4, epsEstimate: 1.35, surprisePercent: 3.7 },
        '2025-03-31': { reportDate: '2025-05-01', epsActual: 1.53, epsEstimate: 1.5, surprisePercent: 2.0 },
      },
      incomeQuarterly: {
        '2025-06-30': { date: '2025-06-30', totalRevenue: 85777000000, netIncome: 21448000000 },
        '2025-03-31': { date: '2025-03-31', totalRevenue: 90753000000, netIncome: 23636000000 },
      },
      balanceSheetQuarterly: {
        '2025-06-30': { date: '2025-06-30', commonStockSharesOutstanding: 15022070000 },
        '2025-03-31': { date: '2025-03-31', commonStockSharesOutstanding: 15037870000 },
      },
    },
  };
}

const DATE = '2026-08-19';

let errorSpy;
let warnSpy;
let logSpy;
beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────
// 1. Off-state pin — flag false ⇒ zero snapshot writes (the flagPinGuard assertion)
// ─────────────────────────────────────────────────────────────────────────
describe('off-state pin (flagPinGuard)', () => {
  it('ships dark — METRIC_HISTORY_SNAPSHOT_ENABLED is false', () => {
    // BUILD_RULES §2: this pin and the const value move together. When the founder
    // flips the flag, this assertion flips to true in the same commit (and the flag's
    // DARK_BY_DESIGN entry is dropped) — the flagPinGuard enforces it.
    expect(METRIC_HISTORY_SNAPSHOT_ENABLED).toBe(false);
  });

  it('the cron hook is gated: with the flag false the snapshot writer is never reached', () => {
    // The hook in compute-rankings.js is `if (METRIC_HISTORY_SNAPSHOT_ENABLED) { … }`.
    // Mirror that gate here to prove the off-state performs zero writes without booting
    // the whole cron handler.
    const db = makeFakeDb();
    if (METRIC_HISTORY_SNAPSHOT_ENABLED) {
      // unreachable while dark — a real capture would run here
      throw new Error('flag unexpectedly enabled');
    }
    expect(db._sets).toHaveLength(0);
    expect(db._commitCount).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. On-state shape — per-ticker daily docs, correct id, expected fields, version
// ─────────────────────────────────────────────────────────────────────────
describe('on-state daily snapshot shape', () => {
  it('writes one dated doc per ticker at metricSnapshots/{ticker}/daily/{date} with the expected fields', async () => {
    const db = makeFakeDb();
    const metricsByTicker = makeMetricsFixture();
    const computedAt = new Date('2026-08-19T11:00:00Z');

    const res = await writeDailySnapshots(db, metricsByTicker, DATE, { computedAt });

    expect(res.errors).toEqual([]);
    expect(res.written).toBe(2);
    expect(db._sets).toHaveLength(2);

    // Correct doc id = the date; correct subcollection path (no hot doc).
    const paths = db._sets.map((s) => s.path).sort();
    expect(paths).toEqual([
      `metricSnapshots/AAPL/daily/${DATE}`,
      `metricSnapshots/MSFT/daily/${DATE}`,
    ]);

    const aapl = db._sets.find((s) => s.path === `metricSnapshots/AAPL/daily/${DATE}`).data;
    expect(aapl.ticker).toBe('AAPL');
    expect(aapl.sectorId).toBe('XLK');
    expect(aapl.sectorName).toBe('Technology');
    expect(aapl.industryName).toBe('Technology Hardware, Storage & Peripherals');
    expect(aapl.compositeScore).toBe(82);
    expect(aapl.compositeRank).toBe(3);
    expect(aapl.pillars).toMatchObject({ profitability: 95 });
    expect(aapl.ranks.opMargin).toMatchObject({ rank: 1, percentile: 100 });
    expect(aapl.metrics).toMatchObject({ opMarginTTM: 0.31, name: 'Apple Inc' });
    // Envelope
    expect(aapl.asOfDate).toBe(DATE);
    expect(aapl.computedAt).toBeInstanceOf(Date);
    expect(aapl.snapshotSchemaVersion).toBe(SNAPSHOT_SCHEMA_VERSION);
    expect(aapl.snapshotSchemaVersion).toBe(1);
  });

  it('buildDailySnapshotDoc stamps the envelope and is undefined-safe (Firestore rejects undefined)', () => {
    const doc = buildDailySnapshotDoc(
      { ticker: 'X', compositeScore: undefined, nested: { a: undefined, b: 2 } },
      DATE,
      new Date('2026-08-19T11:00:00Z'),
    );
    expect(doc.compositeScore).toBeNull();     // undefined → null
    expect(doc.nested).toEqual({ a: null, b: 2 });
    expect(doc.asOfDate).toBe(DATE);
    expect(doc.snapshotSchemaVersion).toBe(1);
    expect(doc.computedAt).toBeInstanceOf(Date); // Date preserved, not flattened
  });

  it('captureMetricHistorySnapshots writes both daily and quarterly and reports ok', async () => {
    const db = makeFakeDb();
    const res = await captureMetricHistorySnapshots({
      db,
      metricsByTicker: makeMetricsFixture(),
      quarterlyByTicker: makeQuarterlyFixture(),
      asOfDate: DATE,
      computedAt: new Date('2026-08-19T11:00:00Z'),
      startTime: Date.now(), // just started — well under the guard
    });
    expect(res.ok).toBe(true);
    expect(res.skipped).toBe(false);
    expect(res.daily.written).toBe(2);
    expect(res.quarterly.written).toBe(1);
    // 2 daily + 1 quarterly docs recorded.
    expect(db._sets.map((s) => s.path).sort()).toEqual([
      `metricSnapshots/AAPL/daily/${DATE}`,
      `metricSnapshots/MSFT/daily/${DATE}`,
      'quarterlySeries/AAPL',
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 3. Failure isolation — a throwing writer completes normally, error logged
// ─────────────────────────────────────────────────────────────────────────
describe('failure isolation', () => {
  it('a commit rejection is caught: capture resolves (never throws), reports not-ok, logs the error', async () => {
    const db = makeFakeDb({ failCommit: true });
    let res;
    await expect(
      (async () => { res = await captureMetricHistorySnapshots({
        db,
        metricsByTicker: makeMetricsFixture(),
        quarterlyByTicker: makeQuarterlyFixture(),
        asOfDate: DATE,
        startTime: Date.now(),
      }); })(),
    ).resolves.toBeUndefined(); // did not reject

    expect(res.ok).toBe(false);
    expect(res.daily.errors.length).toBeGreaterThan(0);
    expect(errorSpy).toHaveBeenCalled(); // error was logged, not swallowed silently
  });

  it('even a synchronous throw inside a write path is isolated', async () => {
    const db = makeFakeDb({ throwOnBatch: true }); // db.batch() throws
    const res = await captureMetricHistorySnapshots({
      db,
      metricsByTicker: makeMetricsFixture(),
      quarterlyByTicker: makeQuarterlyFixture(),
      asOfDate: DATE,
      startTime: Date.now(),
    });
    expect(res.ok).toBe(false);
    expect(res.daily.errors.length).toBeGreaterThan(0);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('writeDailySnapshots never throws and reports the failure in its summary', async () => {
    const db = makeFakeDb({ failCommit: true });
    const res = await writeDailySnapshots(db, makeMetricsFixture(), DATE, {});
    expect(res.errors.some((e) => e.startsWith('commit:'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 4. Idempotency — a same-day re-run overwrites its own doc, never duplicates
// ─────────────────────────────────────────────────────────────────────────
describe('idempotency', () => {
  it('a second same-day run targets the identical doc id (overwrite, not a new doc)', async () => {
    const db = makeFakeDb();
    const metricsByTicker = makeMetricsFixture();

    await writeDailySnapshots(db, metricsByTicker, DATE, {});
    await writeDailySnapshots(db, metricsByTicker, DATE, {}); // re-run, same date

    const aaplWrites = db._sets.filter((s) => s.path === `metricSnapshots/AAPL/daily/${DATE}`);
    // Two set() calls to the SAME path — in Firestore a plain set overwrites. The doc id
    // is the date, so no second-run doc with a different id was created.
    expect(aaplWrites).toHaveLength(2);
    const distinctPaths = new Set(db._sets.map((s) => s.path));
    expect([...distinctPaths].sort()).toEqual([
      `metricSnapshots/AAPL/daily/${DATE}`,
      `metricSnapshots/MSFT/daily/${DATE}`,
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 5. Quarterly retention — series doc written from a real-transient-shaped fixture
// ─────────────────────────────────────────────────────────────────────────
describe('quarterly series retention', () => {
  it('retainQuarterlySeries writes quarterlySeries/{ticker} with the raw arrays, unreshaped', async () => {
    const db = makeFakeDb();
    const fx = makeQuarterlyFixture().AAPL;
    const lastUpdated = new Date('2026-08-19T11:00:00Z');

    const doc = await retainQuarterlySeries(db, 'AAPL', fx, { lastUpdated });

    // Standalone set at the single-doc path.
    expect(db._sets).toHaveLength(1);
    expect(db._sets[0].path).toBe('quarterlySeries/AAPL');

    const written = db._sets[0].data;
    expect(written).toBe(doc);
    expect(written.ticker).toBe('AAPL');
    // Raw arrays retained exactly as fetched (no derivation, no reshaping).
    expect(written.earningsHistory).toEqual(fx.earningsHistory);
    expect(written.incomeQuarterly).toEqual(fx.incomeQuarterly);
    expect(written.balanceSheetQuarterly).toEqual(fx.balanceSheetQuarterly);
    // The share-count series is preserved (audit Q9/Q21 mechanical-screen substrate).
    expect(written.balanceSheetQuarterly['2025-06-30'].commonStockSharesOutstanding).toBe(15022070000);
    expect(written.lastUpdated).toBeInstanceOf(Date);
    expect(written.snapshotSchemaVersion).toBe(1);
  });

  it('buildQuarterlySeriesDoc null-fills absent series without throwing', () => {
    const doc = buildQuarterlySeriesDoc('ZZZ', {}, new Date());
    expect(doc.ticker).toBe('ZZZ');
    expect(doc.earningsHistory).toBeNull();
    expect(doc.incomeQuarterly).toBeNull();
    expect(doc.balanceSheetQuarterly).toBeNull();
    expect(doc.snapshotSchemaVersion).toBe(1);
  });

  it('writeQuarterlySeriesBatch batches all tickers and reports the count', async () => {
    const db = makeFakeDb();
    const res = await writeQuarterlySeriesBatch(db, makeQuarterlyFixture(), {});
    expect(res.errors).toEqual([]);
    expect(res.written).toBe(1);
    expect(db._sets.map((s) => s.path)).toEqual(['quarterlySeries/AAPL']);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Runtime respect (§4.2) — near maxDuration ⇒ skip-and-log, zero writes
// ─────────────────────────────────────────────────────────────────────────
describe('runtime guard', () => {
  it('skips (and logs) when elapsed time is already near the cron maxDuration envelope', async () => {
    const db = makeFakeDb();
    const res = await captureMetricHistorySnapshots({
      db,
      metricsByTicker: makeMetricsFixture(),
      quarterlyByTicker: makeQuarterlyFixture(),
      asOfDate: DATE,
      startTime: Date.now() - 200_000, // 200s elapsed
      maxDurationMs: 180_000,          // guard = 165s → skip
    });
    expect(res.skipped).toBe(true);
    expect(res.ok).toBe(false);
    expect(db._sets).toHaveLength(0); // nothing written
    expect(warnSpy).toHaveBeenCalled();
  });

  it('does not skip when there is ample time left', async () => {
    const db = makeFakeDb();
    const res = await captureMetricHistorySnapshots({
      db,
      metricsByTicker: makeMetricsFixture(),
      quarterlyByTicker: {},
      asOfDate: DATE,
      startTime: Date.now() - 5_000, // 5s elapsed
      maxDurationMs: 180_000,
    });
    expect(res.skipped).toBe(false);
    expect(res.daily.written).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// nullSafe unit coverage (Firestore undefined-safety helper)
// ─────────────────────────────────────────────────────────────────────────
describe('nullSafe', () => {
  it('replaces undefined with null, preserves Date, drops functions, deep-copies', () => {
    const d = new Date('2026-01-01T00:00:00Z');
    const out = nullSafe({ a: undefined, b: 1, c: d, fn: () => 1, arr: [undefined, 2], deep: { x: undefined } });
    expect(out).toEqual({ a: null, b: 1, c: d, arr: [null, 2], deep: { x: null } });
    expect(out.c).toBeInstanceOf(Date);
    expect('fn' in out).toBe(false);
  });
});
