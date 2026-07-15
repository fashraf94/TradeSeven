// research/level-study/lib/stats.js
//
// LevelStory Session 7 — THE STATISTICS MACHINERY (parent §11). The layer that separates a real
// effect from cross-symbol market-episode noise. Everything here is a PURE, DETERMINISTIC function
// of its inputs: the same rows in the same order produce byte-identical CIs, every run, forever.
// That is not a nicety — a研究 verdict that changed between runs would be indistinguishable from a
// bug, and this study's whole reason to exist is that its numbers are trustworthy.
//
// ── WHY EACH PIECE EXISTS (parent §11.1, §11.2, pitfall #5) ───────────────────────────────────────
//   "Five tech names rejecting support during one Nasdaq reversal ≈ one economic observation."
//   Naive n inflates confidence. So:
//     • the bootstrap resamples DATES, not events — all events on a date move together (§11.2);
//     • the stability review FAILS a result if any single removal flips the sibling-difference sign;
//     • the concentration diagnostics are always displayed so a thin/​concentrated cell is visible.
//
// ── DETERMINISM (S7 §5 test 7) ────────────────────────────────────────────────────────────────────
//   The bootstrap needs randomness; a research pipeline needs reproducibility. Resolved with a SEEDED
//   PRNG (mulberry32) and a FIXED seed constant. No Math.random anywhere. The date list is sorted
//   before resampling, so the draw sequence is a pure function of the data, independent of input order.
//
// Pure module: imports ../config.js only (for the frozen iteration count / CI width). Zero product
// imports. Every exported function is a pure function of its arguments.

import CONFIG from '../config.js';

const BOOT = CONFIG.honesty.bootstrap;            // { clustering:'date', iterations:2000, ciPct:90 }
export const ITERATIONS = BOOT.iterations;        // 2000 (parent §11.2)
export const CI_PCT = BOOT.ciPct;                 // 90 (parent §11.2)

// The fixed bootstrap seed. A constant, so every run is byte-identical (S7 §5 test 7). It is a plain
// reproducibility anchor, not a tunable knob — it does not appear in config (which is the frozen
// research contract) because changing it changes nothing about the study definition, only the
// pseudo-random draw sequence. Documented here so the value is auditable.
export const BOOTSTRAP_SEED = 0x1e51_57a7; // "LEVELSTAT" mnemonic; any fixed 32-bit value would serve

// ── Seeded PRNG (mulberry32) — deterministic, no Math.random ───────────────────────────────────────

/** A mulberry32 generator seeded from `seed`; returns a function producing floats in [0,1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Small numeric helpers (null-aware; a null value is EXCLUDED, never coerced to zero) ─────────────

/** Mean of the non-null values; null if none (never 0 from an empty set — parent null-never-zero). */
export function mean(values) {
  const v = values.filter((x) => x != null && !Number.isNaN(x));
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

/** Median of the non-null values; null if none. */
export function median(values) {
  const v = values.filter((x) => x != null && !Number.isNaN(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Linear-interpolated percentile p∈[0,1] of an array (sorted internally). null if empty. */
export function percentile(values, p) {
  const v = values.filter((x) => x != null && !Number.isNaN(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const idx = (v.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (idx - lo);
}

export const round2 = (x) => (x == null || Number.isNaN(x) ? null : Math.round(x * 100) / 100);
export const round1 = (x) => (x == null || Number.isNaN(x) ? null : Math.round(x * 10) / 10);

/** Group an array by a key function into an insertion-ordered Map. */
export function groupBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

// ── The date-clustered bootstrap (parent §11.2) ────────────────────────────────────────────────────
//
// Resample the CLUSTER UNITS with replacement — by default the event DATE, so every event sharing a
// date moves together (the economic-observation rule, §11.1). `statistic` is computed on each
// resample; the empirical [ (100−ciPct)/2 , 100−(100−ciPct)/2 ] percentiles are the CI.
//
// `clusterKeyFn` is configurable ONLY so a test can demonstrate the clustering effect on identical
// data (per-observation key ⇒ the naive bootstrap; date key ⇒ the clustered one). Production always
// clusters by date (the caller passes nothing and gets `o => o.date`). This is the S7 §5 test-2
// mechanism: same rows, naive CI narrow, clustered CI materially wider.

/**
 * @param {Array} observations  each an object (must carry the clustering key; date by default)
 * @param {(sample:Array)=>number|null} statistic  computed on the full sample and each resample
 * @param {object} [opts]  { iterations, ciPct, seed, clusterKeyFn }
 * @returns {{ point, lo, hi, width, iterations, nClusters }}
 */
export function clusteredBootstrap(observations, statistic, opts = {}) {
  const iterations = opts.iterations ?? ITERATIONS;
  const ciPct = opts.ciPct ?? CI_PCT;
  const seed = opts.seed ?? BOOTSTRAP_SEED;
  const clusterKeyFn = opts.clusterKeyFn ?? ((o) => o.date);

  const point = statistic(observations);
  const byCluster = groupBy(observations, clusterKeyFn);
  // Sort cluster keys so the draw sequence is independent of input order (determinism).
  const keys = [...byCluster.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const D = keys.length;
  if (D === 0) return { point, lo: null, hi: null, width: null, iterations: 0, nClusters: 0 };

  const rng = mulberry32(seed);
  const stats = [];
  for (let it = 0; it < iterations; it++) {
    const sample = [];
    for (let d = 0; d < D; d++) {
      const draw = Math.floor(rng() * D);
      const bucket = byCluster.get(keys[draw]);
      for (let j = 0; j < bucket.length; j++) sample.push(bucket[j]);
    }
    const s = statistic(sample);
    if (s != null && !Number.isNaN(s)) stats.push(s);
  }
  stats.sort((a, b) => a - b);
  const alpha = (100 - ciPct) / 2 / 100;
  const lo = percentile(stats, alpha);
  const hi = percentile(stats, 1 - alpha);
  return {
    point,
    lo,
    hi,
    width: lo != null && hi != null ? hi - lo : null,
    iterations: stats.length,
    nClusters: D,
  };
}

// ── Rate and sibling-difference statistics ─────────────────────────────────────────────────────────
//
// A "cell" is an array of joined event records. Each carries { date, symbol, sector, y } where y is
// the binary outcome (1/0) or a numeric endpoint. Rate cells exclude null-y rows from the denominator
// (null-never-zero); the excluded count is surfaced by the caller.

/** Fraction of y===1 over non-null y (as a 0–1 rate); null if no non-null y. */
export function rateOf(cell) {
  return mean(cell.map((r) => r.y));
}

/** The clustered 90% CI on a cell's rate (parent §11.2 — a CI on every displayed rate). */
export function rateCI(cell, opts = {}) {
  return clusteredBootstrap(cell, rateOf, opts);
}

/** The clustered 90% CI on a cell's median endpoint (for P2's fractionElapsed / MFE medians). */
export function medianCI(cell, opts = {}) {
  return clusteredBootstrap(cell, (s) => median(s.map((r) => r.y)), opts);
}

/**
 * The clustered 90% CI on a SIBLING DIFFERENCE (rateA − rateB). Both cells are unioned and resampled
 * BY THE SAME DATES, so a date carrying events in both siblings moves both together — the correct
 * clustered estimator for a between-condition difference (parent §11.2). The point difference is in
 * RATE units (0–1); the caller renders it in points (×100).
 *
 * @returns {{ point, lo, hi, width, iterations, nClusters, pointA, pointB }}
 */
export function siblingDiffCI(cellA, cellB, opts = {}) {
  const union = [
    ...cellA.map((r) => ({ ...r, __g: 'A' })),
    ...cellB.map((r) => ({ ...r, __g: 'B' })),
  ];
  const diff = (sample) => {
    const a = mean(sample.filter((r) => r.__g === 'A').map((r) => r.y));
    const b = mean(sample.filter((r) => r.__g === 'B').map((r) => r.y));
    if (a == null || b == null) return null;
    return a - b;
  };
  const boot = clusteredBootstrap(union, diff, opts);
  return { ...boot, pointA: rateOf(cellA), pointB: rateOf(cellB) };
}

/** Does a CI exclude zero? (Both bounds strictly on the same side.) Null-safe: null CI ⇒ false. */
export function ciExcludesZero(ci) {
  if (!ci || ci.lo == null || ci.hi == null) return false;
  return (ci.lo > 0 && ci.hi > 0) || (ci.lo < 0 && ci.hi < 0);
}

// ── Concentration diagnostics (parent §11.2 — always displayed) ────────────────────────────────────

/**
 * unique event dates, and the concentration of the cell by SYMBOL and by SECTOR — both required by the
 * §A7 validation view (symbol concentration + sector concentration + unique-event-date count).
 */
export function concentration(cell) {
  const uniqueDates = new Set(cell.map((r) => r.date)).size;
  if (!cell.length) return { n: 0, uniqueDates: 0, top5SymbolPct: null, topSymbols: [], topSectorPct: null, topSectors: [] };
  const rank = (keyFn) => [...groupBy(cell, keyFn).entries()]
    .map(([k, rows]) => ({ k, count: rows.length }))
    .sort((a, b) => b.count - a.count || (String(a.k) < String(b.k) ? -1 : 1));
  const sym = rank((r) => r.symbol);
  const sec = rank((r) => r.sector);
  const top5sym = sym.slice(0, 5).reduce((a, c) => a + c.count, 0);
  return {
    n: cell.length,
    uniqueDates,
    top5SymbolPct: round1((top5sym / cell.length) * 100),
    topSymbols: sym.slice(0, 5).map((c) => c.k),
    // sector concentration: the share of the cell from its single largest sector, plus the top-3 mix.
    topSectorPct: round1((sec[0].count / cell.length) * 100),
    topSectors: sec.slice(0, 3).map((c) => `${c.k}:${round1((c.count / cell.length) * 100)}%`),
  };
}

// ── Stability review (parent §11.2 — FAIL if any single removal flips the sibling-difference sign) ──
//
// Three removals, each recomputed as a plain point difference (no bootstrap — a sign flip is a
// point-estimate fact): leave-one-symbol-out across the TOP contributors, leave-one-sector-out, and
// leave-one-5-session-market-episode-out. A "5-session market episode" is a consecutive block of 5
// distinct event dates over the UNION timeline (pitfall #5: cross-symbol clustering rides the market
// calendar, so the episode unit is calendar dates, not per-symbol).
//
// A removal that empties either sibling (diff undefined) does NOT count as a flip — you cannot flip a
// sign you cannot compute — but it IS recorded, so a cell so concentrated that dropping one unit
// erases a sibling is visible as fragility.

/** The top-K contributing symbols across both siblings, by combined count. */
function topContributorSymbols(cellA, cellB, k = 5) {
  const bySym = groupBy([...cellA, ...cellB], (r) => r.symbol);
  return [...bySym.entries()]
    .map(([symbol, rows]) => ({ symbol, count: rows.length }))
    .sort((a, b) => b.count - a.count || (a.symbol < b.symbol ? -1 : 1))
    .slice(0, k)
    .map((c) => c.symbol);
}

/** Consecutive 5-date episode id for each date over the sorted union of both cells' dates. */
function episodeIndexByDate(cellA, cellB, blockSize = 5) {
  const dates = [...new Set([...cellA, ...cellB].map((r) => r.date))].sort();
  const idx = new Map();
  dates.forEach((d, i) => idx.set(d, Math.floor(i / blockSize)));
  return idx;
}

function pointDiff(cellA, cellB) {
  const a = rateOf(cellA);
  const b = rateOf(cellB);
  if (a == null || b == null) return null;
  return a - b;
}

/**
 * The GENERIC stability review, parameterised by the sibling-difference statistic `diffFn(A,B)` (a
 * rate difference, a median difference, …). This is the single source of the three mandated removals
 * (parent §11.2) so every question — rate OR continuous-endpoint (P5) — runs the SAME leave-one-out
 * battery: leave-one-symbol-out (top contributors), leave-one-sector-out, leave-one-5-session-episode-out.
 *
 * @returns {{ pass, fullDiff, fullSign, flips:[{type,key,diff}], undefinedRemovals:[{type,key}] }}
 *   pass is true iff NO removal flips the sign of the full sibling difference.
 */
export function stabilityReviewWith(cellA, cellB, diffFn, opts = {}) {
  const topK = opts.topSymbols ?? 5;
  const fullDiff = diffFn(cellA, cellB);
  const flips = [];
  const undefinedRemovals = [];
  if (fullDiff == null || fullDiff === 0) {
    // No stable sign to preserve — a zero or undefined full difference cannot "pass" a sign-stability
    // review meaningfully; report it as not-passing so the verdict layer treats it as non-graduating.
    return { pass: false, fullDiff, fullSign: 0, flips, undefinedRemovals, reason: fullDiff == null ? 'undefined' : 'zero' };
  }
  const fullSign = Math.sign(fullDiff);

  const check = (type, key, subA, subB) => {
    const d = diffFn(subA, subB);
    if (d == null) { undefinedRemovals.push({ type, key }); return; }
    if (Math.sign(d) !== fullSign) flips.push({ type, key, diff: d });
  };

  // leave-one-symbol-out (top contributors)
  for (const sym of topContributorSymbols(cellA, cellB, topK)) {
    check('symbol', sym, cellA.filter((r) => r.symbol !== sym), cellB.filter((r) => r.symbol !== sym));
  }
  // leave-one-sector-out (all sectors present)
  for (const sec of new Set([...cellA, ...cellB].map((r) => r.sector))) {
    check('sector', sec, cellA.filter((r) => r.sector !== sec), cellB.filter((r) => r.sector !== sec));
  }
  // leave-one-5-session-market-episode-out (all episodes over the union timeline)
  const epIdx = episodeIndexByDate(cellA, cellB);
  for (const ep of new Set(epIdx.values())) {
    check('episode', ep, cellA.filter((r) => epIdx.get(r.date) !== ep), cellB.filter((r) => epIdx.get(r.date) !== ep));
  }

  return { pass: flips.length === 0, fullDiff, fullSign, flips, undefinedRemovals };
}

/** The rate-difference stability review (the common case): sibling difference = rateA − rateB. */
export function stabilityReview(cellA, cellB, opts = {}) {
  return stabilityReviewWith(cellA, cellB, pointDiff, opts);
}

/** The median-difference stability review (P5's continuous forward-MFE endpoint). */
export function medianDiffStabilityReview(cellA, cellB, opts = {}) {
  const medDiff = (A, B) => {
    const a = median(A.map((r) => r.y));
    const b = median(B.map((r) => r.y));
    return a == null || b == null ? null : a - b;
  };
  return stabilityReviewWith(cellA, cellB, medDiff, opts);
}

// ── Incremental lift (parent §11.3 — EXPLORATORY APPENDIX; a DIRECTIONAL FLAG, never a rate) ─────────
//
// A pre-registered logistic model per primary question. The reported quantity is whether the focal
// predictor (hourly_class for P1/P4/P5; rvol/extension bucket for P3/P6) retains significance after
// controls — a YES/NO, plus a direction word. The §11.3 GUARD is absolute: NO regression output ever
// becomes a displayed composite score, so this function returns a flag object with NO numeric rate,
// NO coefficient, NO probability — only booleans and a direction string. (S7 §5 test 6.)
//
// Implementation: ridge-regularised IRLS logistic regression, context-only vs +focal-dummies; the
// focal block's joint contribution is judged by whether ANY focal coefficient's date-clustered
// bootstrap CI excludes zero. Defensive: non-convergence / rank-deficiency / underpowered ⇒ the flag
// is `null` ("insufficient"), never a fabricated yes.

function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }

/** Ridge IRLS logistic fit. X includes an intercept column. Returns coefficients or null. */
function fitLogistic(X, y, { ridge = 1e-3, maxIter = 50, tol = 1e-8 } = {}) {
  const n = X.length;
  if (!n) return null;
  const p = X[0].length;
  let beta = new Array(p).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    // Gradient g = Xᵀ(μ−y) + ridge·β ; Hessian H = XᵀWX + ridge·I
    const g = new Array(p).fill(0);
    const H = Array.from({ length: p }, () => new Array(p).fill(0));
    for (let i = 0; i < n; i++) {
      const xi = X[i];
      let z = 0;
      for (let j = 0; j < p; j++) z += beta[j] * xi[j];
      const mu = sigmoid(z);
      const w = Math.max(mu * (1 - mu), 1e-6);
      const r = mu - y[i];
      for (let j = 0; j < p; j++) {
        g[j] += xi[j] * r;
        for (let k = 0; k < p; k++) H[j][k] += xi[j] * xi[k] * w;
      }
    }
    for (let j = 0; j < p; j++) { g[j] += ridge * beta[j]; H[j][j] += ridge; }
    const step = solveLinear(H, g);
    if (!step) return null;
    let maxDelta = 0;
    for (let j = 0; j < p; j++) { beta[j] -= step[j]; maxDelta = Math.max(maxDelta, Math.abs(step[j])); }
    if (maxDelta < tol) break;
  }
  return beta.every((b) => Number.isFinite(b)) ? beta : null;
}

/** Gaussian elimination with partial pivoting; solves H·x = g. Returns x or null if singular. */
function solveLinear(Hin, gin) {
  const p = gin.length;
  const A = Hin.map((row, i) => [...row, gin[i]]);
  for (let c = 0; c < p; c++) {
    let piv = c;
    for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-12) return null;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < p; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= p; k++) A[r][k] -= f * A[c][k];
    }
  }
  return A.map((row, i) => row[p] / row[i][i]);
}

/** One-hot encode a categorical, dropping the first level (reference). Returns { cols, levels }. */
function oneHot(values, drop = true) {
  const levels = [...new Set(values.filter((v) => v != null))].sort();
  const used = drop ? levels.slice(1) : levels;
  return { levels: used, encode: (v) => used.map((L) => (v === L ? 1 : 0)) };
}

/**
 * @param {Array} rows joined records with { y (0/1), focal (categorical), controls:{...} }
 * @param {string} focalName label for the direction message (e.g. 'hourly_class')
 * @returns {{ retainedSignificance:boolean|null, direction:'positive'|'negative'|'mixed'|null, note:string }}
 *   NO rate, NO coefficient, NO probability — a flag object only (parent §11.3 guard; S7 §5 test 6).
 */
export function incrementalLift(rows, focalName = 'focal', opts = {}) {
  const usable = rows.filter((r) => r.y === 0 || r.y === 1);
  if (usable.length < (opts.minN ?? 40)) {
    return { retainedSignificance: null, direction: null, note: `insufficient (n=${usable.length}) — appendix only` };
  }
  const focalVals = usable.map((r) => r.focal);
  if (new Set(focalVals.filter((v) => v != null)).size < 2) {
    return { retainedSignificance: null, direction: null, note: 'focal has <2 levels — no contrast' };
  }
  // Assemble control columns from whatever controls are present (numeric passthrough, categorical
  // one-hot). Missing/null controls degrade to 0 with a mean-centred numeric where possible.
  const controlKeys = Object.keys(usable[0].controls || {});
  const numericKeys = controlKeys.filter((k) => usable.every((r) => r.controls[k] == null || typeof r.controls[k] === 'number'));
  const catKeys = controlKeys.filter((k) => !numericKeys.includes(k));
  const catEnc = {};
  for (const k of catKeys) catEnc[k] = oneHot(usable.map((r) => r.controls[k]));
  const focal = oneHot(focalVals);

  const numMean = {};
  for (const k of numericKeys) numMean[k] = mean(usable.map((r) => r.controls[k])) ?? 0;

  const buildRow = (r, withFocal) => {
    const x = [1];
    for (const k of numericKeys) x.push((r.controls[k] ?? numMean[k]) - numMean[k]);
    for (const k of catKeys) x.push(...catEnc[k].encode(r.controls[k]));
    if (withFocal) x.push(...focal.encode(r.focal));
    return x;
  };

  const y = usable.map((r) => r.y);
  const Xfull = usable.map((r) => buildRow(r, true));
  const betaFull = fitLogistic(Xfull, y);
  if (!betaFull) return { retainedSignificance: null, direction: null, note: 'model did not converge — appendix only' };

  // Index range of the focal block in the full design.
  const preFocalCols = 1 + numericKeys.length + catKeys.reduce((a, k) => a + catEnc[k].levels.length, 0);
  const focalCols = focal.levels.length;

  // Date-clustered bootstrap of the focal coefficients: does ANY exclude zero?
  const seed = opts.seed ?? BOOTSTRAP_SEED;
  const iterations = opts.liftIterations ?? Math.min(ITERATIONS, 500); // lift is appendix-only; cap cost
  const byDate = groupBy(usable, (r) => r.date);
  const dates = [...byDate.keys()].sort();
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const draws = Array.from({ length: focalCols }, () => []);
  for (let it = 0; it < iterations; it++) {
    const sample = [];
    for (let d = 0; d < dates.length; d++) sample.push(...byDate.get(dates[Math.floor(rng() * dates.length)]));
    const b = fitLogistic(sample.map((r) => buildRow(r, true)), sample.map((r) => r.y));
    if (!b) continue;
    for (let c = 0; c < focalCols; c++) draws[c].push(b[preFocalCols + c]);
  }
  const signs = [];
  for (let c = 0; c < focalCols; c++) {
    if (draws[c].length < iterations * 0.5) { signs.push(null); continue; }
    const lo = percentile(draws[c], 0.05);
    const hi = percentile(draws[c], 0.95);
    if (lo != null && hi != null && ((lo > 0 && hi > 0) || (lo < 0 && hi < 0))) {
      signs.push(betaFull[preFocalCols + c] > 0 ? 'positive' : 'negative');
    } else signs.push('ns');
  }
  const significant = signs.filter((s) => s === 'positive' || s === 'negative');
  const retained = significant.length > 0;
  let direction = null;
  if (retained) {
    const pos = significant.filter((s) => s === 'positive').length;
    const neg = significant.length - pos;
    direction = pos && neg ? 'mixed' : pos ? 'positive' : 'negative';
  }
  return {
    retainedSignificance: retained,
    direction,
    note: retained
      ? `${focalName} retained significance after controls (${significant.length}/${focalCols} level(s), ${direction})`
      : `${focalName} did not retain significance after controls`,
  };
}
