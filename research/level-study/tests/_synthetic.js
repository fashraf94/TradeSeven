// research/level-study/tests/_synthetic.js — constructed-price-series builders for the
// Phase A lineage scenario tests. Zero product imports, zero fetched-data dependency.
//
// Bars are produced directly in the normalized-daily shape runLevels() consumes
// ({date, open, high, low, close, adjustedClose, volume, adjFactor, ...}) with
// adjFactor 1 (no corporate actions in synthetic scenarios). Dates are consecutive
// weekdays, so weekly-pivot logic behaves normally.

/** Consecutive weekdays starting at `start` (an ISO date that should be a weekday). */
export function weekdayDates(start, n) {
  const out = [];
  const d = new Date(`${start}T00:00:00Z`);
  while (out.length < n) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/**
 * Build bars from a close series. Symmetric range: high = close + h, low = close − h —
 * which makes typical price (H+L+C)/3 equal the close exactly, so AVWAP positions are
 * analytically steerable while ATR is set independently via h.
 * @param {Array<number|{c,h?,v?}>} closes plain closes or per-bar overrides
 * @param {{start?:string, h?:number, v?:number}} opts defaults: h halfRange, v volume
 */
export function synthBars(closes, opts = {}) {
  const { start = '2024-01-01', h: defH = 0.5, v: defV = 1000 } = opts; // 2024-01-01 is a Monday
  const dates = weekdayDates(start, closes.length);
  let prevClose = null;
  return closes.map((entry, i) => {
    const spec = typeof entry === 'number' ? { c: entry } : entry;
    const c = spec.c, h = spec.h ?? defH, v = spec.v ?? defV;
    const open = prevClose ?? c;
    prevClose = c;
    return {
      date: dates[i],
      open, high: c + h, low: c - h, close: c,
      adjustedClose: c, volume: v, adjFactor: 1,
      warmup: false, holdout: false,
    };
  });
}

/**
 * Period-4 zigzag segment: [base, base+amp/2, base+amp, base+amp/2] repeated.
 * Swing highs form at the peaks (base+amp) and swing lows at the troughs (base) — each
 * is a strict k=3 fractal because the three neighbors on each side are strictly inside.
 * `drift` shifts the base per bar (slow zone drift for the identity-stability scenario).
 */
export function zigzag(base, amp, cycles, { drift = 0 } = {}) {
  const out = [];
  for (let cy = 0; cy < cycles; cy++) {
    for (const phase of [0, 0.5, 1, 0.5]) {
      out.push(base + amp * phase);
      base += drift;
    }
  }
  return out;
}

/** Linear ramp from `from` toward `to` in steps of `step` (exclusive of `from`). */
export function rampTo(from, to, step) {
  const out = [];
  const dir = Math.sign(to - from) || 1;
  let c = from;
  while ((to - c) * dir > 1e-9) {
    c = dir > 0 ? Math.min(c + step, to) : Math.max(c - step, to);
    out.push(c);
  }
  return out;
}

/** n copies of value v. */
export function flat(v, n) {
  return new Array(n).fill(v);
}

/** Find the family (in a runLevels result) whose anchor is nearest `price`, optionally filtered. */
export function familyNearest(result, price, filter = () => true) {
  let best = null, bestDist = Infinity;
  for (const fam of Object.values(result.families)) {
    if (!filter(fam)) continue;
    const d = Math.abs(fam.anchor - price);
    if (d < bestDist) { best = fam; bestDist = d; }
  }
  return best;
}

/** Deterministic PRNG (mulberry32) for reproducible "random" day sampling in tests. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sample `count` distinct items from arr, deterministic under `seed`. */
export function sampleDistinct(arr, count, seed) {
  const rnd = mulberry32(seed);
  const picked = new Set();
  const out = [];
  while (out.length < Math.min(count, arr.length)) {
    const i = Math.floor(rnd() * arr.length);
    if (picked.has(i)) continue;
    picked.add(i);
    out.push(arr[i]);
  }
  return out;
}
