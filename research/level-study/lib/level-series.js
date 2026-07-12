// research/level-study/lib/level-series.js
//
// Prefix-safe daily-series backbone for level construction (Session 3).
//
// THE PREFIX PROPERTY (the point of this module): every precomputed structure here,
// when queried for a registry day built on the first N bars (data through D−1 close),
// reads ONLY bars 0..N−1 — so its answers are bit-identical whether computed over the
// full series or over a series physically truncated at N. This is what makes the
// incremental forward engine provably equivalent to the from-scratch truncated rebuild
// (parent §5.2; S3 prompt §3.1 equivalence harness):
//
//   - adjusted OHLC / typical price / weights: pure per-bar transforms.
//   - cumulative Σ(tp·w), Σw: prefix sums (entry i uses bars 0..i).
//   - ATR(14): Wilder smoothing computed strictly left-to-right.
//   - fractal swing flags: flag at i uses bars i−k..i+k; consumers must (and do) filter
//     i + k ≤ N−1, so a flag is only ever read when its full window sits inside the prefix.
//   - range-min/max sparse tables: built over the whole array, but every query is bounded
//     by N−1 by the caller; a range query over identical bars returns identical values.
//
// Price basis: ADJUSTED (A1 one-basis rule; config levels.construction.priceBasis) —
// raw OHLC × per-session adjFactor, the same basis the 5m grain is placed on. Weights
// are volume ÷ adjFactor (S3-C1) so split-era share counts are comparable.
//
// Imports only the frozen config. Zero product imports.

import CONFIG from '../config.js';

const ATR_PERIOD = CONFIG.episode.atr.period;                       // 14 (parent §6.1)
const K = CONFIG.levels.sourceFamilies.structural.fractalK;         // 3  (parent §5.1)

/**
 * @param {Array} bars normalized daily bars ({date, open, high, low, close,
 *   adjustedClose, volume, adjFactor, ...} — the shape data/normalized/{sym}/daily.json
 *   and normalizeDaily() produce). MUST be date-ascending.
 * @returns series object (see fields below)
 */
export function buildSeries(bars) {
  const n = bars.length;
  const dates = new Array(n);
  const aOpen = new Array(n), aHigh = new Array(n), aLow = new Array(n), aClose = new Array(n);
  const tp = new Array(n), w = new Array(n);
  const cumTpw = new Array(n), cumW = new Array(n);
  const atr = new Array(n);
  const isSwingHigh = new Array(n).fill(false), isSwingLow = new Array(n).fill(false);

  let trSum = 0;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    dates[i] = b.date;
    // Quarantine, don't degrade (parent §4.3): a bar without a usable adjustment basis
    // would silently mix raw and adjusted prices inside one series — a phantom fractal /
    // ATR shock near any split. Loud failure quarantines the symbol until explained.
    if (b.adjFactor == null || b.adjustedClose == null) {
      throw new Error(`adjustment-basis quarantine: bar ${b.date} has adjFactor=${b.adjFactor}, adjustedClose=${b.adjustedClose} (parent §4.3: quarantine until explained)`);
    }
    const f = b.adjFactor;
    aOpen[i] = b.open * f;
    aHigh[i] = b.high * f;
    aLow[i] = b.low * f;
    aClose[i] = b.adjustedClose;
    tp[i] = (aHigh[i] + aLow[i] + aClose[i]) / 3;                   // S3-C2: HLC3
    w[i] = b.volume != null ? b.volume / f : 0;                     // S3-C1: V/f
    cumTpw[i] = (i ? cumTpw[i - 1] : 0) + tp[i] * w[i];
    cumW[i] = (i ? cumW[i - 1] : 0) + w[i];

    // Wilder ATR, strictly left-to-right (prefix-safe).
    const tr = i === 0
      ? aHigh[i] - aLow[i]
      : Math.max(aHigh[i] - aLow[i], Math.abs(aHigh[i] - aClose[i - 1]), Math.abs(aLow[i] - aClose[i - 1]));
    if (i < ATR_PERIOD - 1) { trSum += tr; atr[i] = null; }
    else if (i === ATR_PERIOD - 1) { trSum += tr; atr[i] = trSum / ATR_PERIOD; }
    else atr[i] = (atr[i - 1] * (ATR_PERIOD - 1) + tr) / ATR_PERIOD;
  }

  // Fractal swing flags (S3-C3: strict comparison; ties → no fractal). The flag at i is
  // defined only for K ≤ i ≤ n−1−K; consumers additionally require i+K ≤ N−1 so the full
  // right side is inside their prefix.
  for (let i = K; i <= n - 1 - K; i++) {
    let sh = true, sl = true;
    for (let j = 1; j <= K && (sh || sl); j++) {
      if (!(aHigh[i] > aHigh[i - j] && aHigh[i] > aHigh[i + j])) sh = false;
      if (!(aLow[i] < aLow[i - j] && aLow[i] < aLow[i + j])) sl = false;
    }
    isSwingHigh[i] = sh;
    isSwingLow[i] = sl;
  }

  const dateIndex = new Map(dates.map((d, i) => [d, i]));

  return {
    n, dates, dateIndex,
    aOpen, aHigh, aLow, aClose, tp, w, cumTpw, cumW, atr,
    isSwingHigh, isSwingLow,
    minLowTable: buildSparse(aLow, Math.min),
    maxHighTable: buildSparse(aHigh, Math.max),
    k: K,
  };
}

/** Range-min/max over aLow/aHigh, inclusive indices. Callers bound r by N−1 (prefix-safe). */
function buildSparse(arr, pick) {
  const n = arr.length;
  const levels = n > 0 ? 31 - Math.clz32(n) : 0; // floor(log2 n): query() indexes row ≤ floor(log2 span), span ≤ n
  const table = [arr.slice()];
  for (let j = 1; j <= levels; j++) {
    const span = 1 << j, half = span >> 1;
    const prev = table[j - 1];
    const row = new Array(Math.max(0, n - span + 1));
    for (let i = 0; i + span <= n; i++) row[i] = pick(prev[i], prev[i + half]);
    table.push(row);
  }
  return {
    /** min/max of arr[l..r], inclusive; l ≤ r required. */
    query(l, r) {
      const j = 31 - Math.clz32(r - l + 1);
      return pick(table[j][l], table[j][r - (1 << j) + 1]);
    },
  };
}

/**
 * Smallest index j in [lo, hi] such that extreme(arr[lo..j]) crosses `threshold`
 * (≤ threshold for min-crossing, ≥ threshold for max-crossing) — or null if never.
 * Used for the first date an AVWAP anchor's ≥5% move became observable (parent §5.3):
 * binary search over the monotone running extreme; O(log n) sparse-table queries.
 */
export function firstCrossingIndex(table, lo, hi, threshold, direction) {
  const crossed = (j) => direction === 'min'
    ? table.query(lo, j) <= threshold
    : table.query(lo, j) >= threshold;
  if (lo > hi || !crossed(hi)) return null;
  let a = lo, b = hi;
  while (a < b) {
    const mid = (a + b) >> 1;
    if (crossed(mid)) b = mid; else a = mid + 1;
  }
  return a;
}
