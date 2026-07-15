// research/level-study/lib/packets.js
//
// LevelStory Session 7 — MANUAL-VALIDATION SAMPLING (parent §12; Addendum §A4.1). The pure, DETERMINISTIC
// core of the chart-packet export: pick 100 events stratified across the three ATR%-vol tertiles, so
// the same 100 events are drawn on every run (the founder grades a FIXED sample; a genuinely fresh
// sample is only ever drawn by advancing the seed — never silently).
//
// ── STRATA (S56-A3, ruling of record) ──────────────────────────────────────────────────────────────
//   The four hand-assigned strata (mega_cap_tech / low_volatility / high_beta / gap_prone) were retired
//   at S5.6 because they do not scale to ~230 names and were never mechanical. They are replaced by
//   THREE ATR%-percentile tertiles — LOW_VOL / MID_VOL / HIGH_VOL — computed per symbol over the study
//   window (median ATR14/close), cut on the R2-PASS set. This lives on each universe member as
//   `stratum`. (config.manualReview.stratified still lists the dead four-way set — a known config drift;
//   the frozen ruling S56-A3 wins, so this module stratifies on the universe file's `stratum` field.)
//
// Pure module: imports ./stats.js (the seeded PRNG only) + ../config.js. Zero product imports.

import CONFIG from '../config.js';
import { mulberry32 } from './stats.js';

export const STRATA = ['LOW_VOL', 'MID_VOL', 'HIGH_VOL']; // S56-A3, fixed order
export const SAMPLE_SIZE = CONFIG.manualReview.sampleSize; // 100 (parent §12)
export const PACKET_SEED = 0x50_4b_54_31; // "PKT1" — the fixed sampling seed; advance ONLY for a fresh re-draw

/** Deterministic Fisher–Yates shuffle seeded from `seed` (does not mutate the input). */
export function seededShuffle(arr, seed) {
  const a = [...arr];
  const rng = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Allocate `total` across the strata proportionally to availability, redistributing any shortfall (a
 * stratum with fewer events than its target) to the others in fixed order. Deterministic.
 * @param {Object<string,number>} available  events available per stratum
 * @returns {Object<string,number>} target count per stratum (sums to min(total, Σavailable))
 */
export function allocate(available, total = SAMPLE_SIZE) {
  const strata = STRATA.filter((s) => (available[s] || 0) > 0);
  const alloc = {};
  for (const s of STRATA) alloc[s] = 0;
  // Even base split across non-empty strata, remainder to the earliest strata in fixed order.
  const base = Math.floor(total / strata.length);
  let remainder = total - base * strata.length;
  for (const s of strata) { alloc[s] = base + (remainder > 0 ? 1 : 0); if (remainder > 0) remainder -= 1; }
  // Cap each at availability; collect shortfall.
  let shortfall = 0;
  for (const s of STRATA) { if (alloc[s] > (available[s] || 0)) { shortfall += alloc[s] - available[s]; alloc[s] = available[s] || 0; } }
  // Redistribute shortfall to strata with spare capacity, fixed order, until exhausted.
  while (shortfall > 0) {
    let progressed = false;
    for (const s of STRATA) {
      const spare = (available[s] || 0) - alloc[s];
      if (spare > 0) { alloc[s] += 1; shortfall -= 1; progressed = true; if (shortfall === 0) break; }
    }
    if (!progressed) break; // no capacity anywhere
  }
  return alloc;
}

/**
 * Draw the stratified sample. `events` carry at least { eventId, symbol }; `stratumBySymbol` maps a
 * symbol → its tertile. Only events whose symbol has a known stratum are eligible.
 *
 * @returns {{ sample:Array, allocation:Object, availability:Object, eligibleTotal:number }}
 *   sample is deterministic: within each stratum, events are sorted by eventId, seeded-shuffled, and
 *   the first `allocation[stratum]` taken; the sample is concatenated in STRATA order.
 */
export function stratifiedSample(events, stratumBySymbol, { total = SAMPLE_SIZE, seed = PACKET_SEED } = {}) {
  const byStratum = { LOW_VOL: [], MID_VOL: [], HIGH_VOL: [] };
  for (const e of events) {
    const st = stratumBySymbol[e.symbol];
    if (st && byStratum[st]) byStratum[st].push(e);
  }
  const availability = {};
  for (const s of STRATA) availability[s] = byStratum[s].length;
  const allocation = allocate(availability, total);
  const sample = [];
  for (const s of STRATA) {
    const sorted = [...byStratum[s]].sort((a, b) => (a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0));
    const shuffled = seededShuffle(sorted, seed ^ hashStratum(s));
    for (const e of shuffled.slice(0, allocation[s])) sample.push({ ...e, stratum: s });
  }
  return { sample, allocation, availability, eligibleTotal: STRATA.reduce((a, s) => a + availability[s], 0) };
}

/** A small deterministic per-stratum seed offset so the three strata don't share a draw sequence. */
function hashStratum(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}
