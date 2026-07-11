/**
 * POST /api/research/driver-audit — Correlation Intelligence V3 Sub-build 3.
 *
 * The LIQUIDITY GATE: permanent driver-admission tooling. Before any symbol
 * enters the registry's live scan path it must pass TWO gates, run by the
 * founder against live EODHD data on the Vercel preview:
 *   Gate 1 — availability: EODHD returns clean daily bars on this plan, with
 *            adequate history (rowCount, first/last date, no big calendar gap).
 *   Gate 2 — liquidity / data-quality: real trading volume, no stale or
 *            single-print days (median volume, zero-volume days, single-print
 *            days = raw high==low==open==close).
 * This endpoint audits HISTORY and predicts nothing — every number is a
 * past-tense fact and the verdict is the conjunction of the pinned thresholds.
 * It is why CEW is out (≈1.8–3.3k avg volume with zero-volume days failed
 * Gate 2) and why every future addition is verified, not asserted (the
 * CEW/BZ.COMM lesson made structural).
 *
 * Gated by the existing dev-tier posture (404 unless CORRELATION_LAB_ENABLED) —
 * NOT the extended-drivers flag: the whole point is to audit a candidate BEFORE
 * it is admitted, while the extended tier is still dark. requireAuth,
 * rate-limited, and NEVER cached (no Firestore, no serverCache — every run hits
 * the wire fresh; the HTTP no-store headers come free from the security
 * middleware). Reachable in the Lab via the `?driverAudit=1` dev param.
 */
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { fetchEodCloses } from './fetchDriverSeries.js';
import { CORRELATION_LAB_ENABLED } from '../../src/config/featureFlags.js';

// Up to 10 symbols × ~504 daily bars, chunked 5-concurrent (the scan cadence).
export const config = { maxDuration: 30 };

const SYMBOL_RE = /^[A-Z][A-Z0-9.-]{0,9}$/; // same pinned form as the scan (accepts SMH.US, BTC-USD.CC)
const AUDIT_LOOKBACK = 504; // ~2y of trading days — enough history for the rowCount gate
const TRAILING_WINDOW = 250; // ~1y trailing window for the zero-volume / single-print checks
const CHUNK_SIZE = 5;
const CHUNK_DELAY_MS = 300;

// The pinned admission thresholds — rendered beside each value in the dev UI.
// Past-tense: these describe the fetched history, they predict nothing.
export const AUDIT_THRESHOLDS = {
  rowCount: 450, // ≥
  medianDailyVolume: 50000, // ≥
  zeroVolumeDays: 0, // = (trailing 250)
  singlePrintDays: 0, // = (trailing 250)
  maxCalendarGapTradingDays: 5, // ≤
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function median(nums) {
  const arr = nums.filter(Number.isFinite).sort((a, b) => a - b);
  if (arr.length === 0) return null;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

/**
 * Weekday distance between two YYYY-MM-DD dates (count of Mon–Fri strictly after
 * `aStr`, up to and including `bStr`; b must be ≥ a). Holiday-AGNOSTIC on
 * purpose: getPreviousTradingDay is scoped to the 2026 NYSE holiday table, but
 * these bars span multiple prior years, so a weekday count is the robust proxy —
 * a clean daily series yields 1 per step, a single-holiday gap yields 2, and a
 * real multi-day hole yields a number the ≤5 threshold catches. Capped so a huge
 * gap can't loop unbounded (it returns a value well over the threshold anyway).
 */
function weekdaysBetween(aStr, bStr) {
  const a = new Date(`${aStr}T00:00:00Z`);
  const b = new Date(`${bStr}T00:00:00Z`);
  if (!(b > a)) return 0;
  let count = 0;
  const cur = new Date(a);
  for (let i = 0; i < 40; i++) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    if (cur >= b) break;
  }
  return count;
}

/**
 * Audit one symbol's ~504 daily bars (fetched WITH raw OHLC + volume). Returns
 * the per-symbol fact block + per-criterion pass/fail + the conjunction verdict.
 * A failed/absent fetch → httpOk:false, null metrics, verdict:'fail' (a symbol
 * that doesn't return can't be admitted).
 */
function auditRows(symbol, rows) {
  const rowCount = rows.length;
  const dates = rows.map((r) => r.date).filter((d) => typeof d === 'string');
  const sortedDates = [...dates].sort();
  const firstDate = sortedDates.length ? sortedDates[0] : null;
  const lastDate = sortedDates.length ? sortedDates[sortedDates.length - 1] : null;

  const medianDailyVolume = median(rows.map((r) => r.volume));

  // Trailing window = the most RECENT bars. fetchEodCloses returns newest-first,
  // but we don't rely on that — take the trailing slice by date.
  const byDateDesc = [...rows].sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
  const trailing = byDateDesc.slice(0, TRAILING_WINDOW);
  const zeroVolumeDays = trailing.filter((r) => r.volume === 0).length;
  const singlePrintDays = trailing.filter(
    (r) =>
      Number.isFinite(r.open) &&
      Number.isFinite(r.high) &&
      Number.isFinite(r.low) &&
      Number.isFinite(r.rawClose) &&
      r.open === r.high &&
      r.high === r.low &&
      r.low === r.rawClose
  ).length;

  let maxCalendarGapTradingDays = sortedDates.length > 1 ? 0 : null;
  for (let i = 1; i < sortedDates.length; i += 1) {
    const gap = weekdaysBetween(sortedDates[i - 1], sortedDates[i]);
    if (gap > maxCalendarGapTradingDays) maxCalendarGapTradingDays = gap;
  }

  const criteria = {
    rowCount: rowCount >= AUDIT_THRESHOLDS.rowCount,
    medianDailyVolume: medianDailyVolume != null && medianDailyVolume >= AUDIT_THRESHOLDS.medianDailyVolume,
    zeroVolumeDays: zeroVolumeDays === AUDIT_THRESHOLDS.zeroVolumeDays,
    singlePrintDays: singlePrintDays === AUDIT_THRESHOLDS.singlePrintDays,
    maxCalendarGapTradingDays:
      maxCalendarGapTradingDays != null && maxCalendarGapTradingDays <= AUDIT_THRESHOLDS.maxCalendarGapTradingDays,
  };
  const verdict = Object.values(criteria).every(Boolean) ? 'pass' : 'fail';

  return {
    symbol,
    httpOk: true,
    rowCount,
    firstDate,
    lastDate,
    medianDailyVolume,
    zeroVolumeDays,
    singlePrintDays,
    maxCalendarGapTradingDays,
    criteria,
    verdict,
  };
}

function failedResult(symbol) {
  return {
    symbol,
    httpOk: false,
    rowCount: null,
    firstDate: null,
    lastDate: null,
    medianDailyVolume: null,
    zeroVolumeDays: null,
    singlePrintDays: null,
    maxCalendarGapTradingDays: null,
    criteria: {
      rowCount: false,
      medianDailyVolume: false,
      zeroVolumeDays: false,
      singlePrintDays: false,
      maxCalendarGapTradingDays: false,
    },
    verdict: 'fail',
  };
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) return;

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Dev-tier posture (correlation-scan.js precedent): dark ⇒ reveal nothing,
  // read nothing, spend no EODHD quota. Gated by the LAB flag only — auditing a
  // candidate must work while the extended tier is still dark.
  if (!CORRELATION_LAB_ENABLED) return res.status(404).json({ error: 'not_found' });

  const user = await requireAuth(req, res);
  if (!user) return;

  const body = req.body || {};
  if (!Array.isArray(body.symbols) || body.symbols.length < 1 || body.symbols.length > 10) {
    return res.status(400).json({ error: 'invalid_symbols', message: 'symbols must be 1–10 tickers.' });
  }
  // Symbols are audited VERBATIM (driver-registry symbols are used verbatim on
  // the wire), uppercased + deduped. The audit tests the exact EODHD symbol a
  // driver would carry — e.g. SMH.US, not SMH.
  const symbols = [...new Set(body.symbols.map((s) => String(s).trim().toUpperCase()))];
  if (!symbols.every((s) => SYMBOL_RE.test(s))) {
    return res.status(400).json({ error: 'invalid_symbol', message: 'Invalid ticker symbol format.' });
  }

  if (!process.env.EODHD_API_KEY) {
    return res.status(500).json({ error: 'API not configured' });
  }

  try {
    const results = [];
    for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
      const chunk = symbols.slice(i, i + CHUNK_SIZE);
      const settled = await Promise.allSettled(
        chunk.map((symbol) => fetchEodCloses(symbol, AUDIT_LOOKBACK, { withVolume: true }))
      );
      settled.forEach((outcome, k) => {
        const symbol = chunk[k];
        results.push(
          outcome.status === 'fulfilled' && Array.isArray(outcome.value)
            ? auditRows(symbol, outcome.value)
            : failedResult(symbol)
        );
      });
      if (i + CHUNK_SIZE < symbols.length) await sleep(CHUNK_DELAY_MS);
    }

    // NEVER cached — no Firestore write, no L1 set. Every run is fresh.
    return res.status(200).json({ thresholds: AUDIT_THRESHOLDS, results });
  } catch (err) {
    console.error('[driver-audit] unexpected error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
