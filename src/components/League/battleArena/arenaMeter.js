// src/components/League/battleArena/arenaMeter.js
//
// League Battle View V2 — the STAR METER's geometry + threshold readout (Phase 2,
// pure + node-clean). The horizontal gauge inside a StarCell: 0 at center, the
// good thresholds to the right, the bad ones to the left, the live multiplier
// bead riding between them and pulsing as it nears the next line.
//
// SCORING DISCIPLINE (BUILD_RULES §4): NO copied threshold table. The tick set is
// DERIVED from the canonical BAGGER_TIERS / BUST_TIERS (src/constants/
// baggerBombScoring.js) — the very constants the scorer and the Phase-1 meter
// reader (leagueStarMeter.topBadgeLabel) already cite. A bad tier stores its
// multiplier POSITIVE (1.0 / 1.5 / 2.0); the meter places it at the NEGATIVE
// mirror (−m), matching THRESHOLD_MULTIPLIERS.{bust,crash,meltdown}. If the tiers
// ever retune, the meter moves with them — there is no second source to drift.

import { BAGGER_TIERS, BUST_TIERS } from '../../../constants/baggerBombScoring';

// The meter's visible multiplier domain (presentation-only): the gauge clamps to
// ±ST_DOM so a runaway multiplier still reads on-scale instead of pinning.
export const ST_DOM = 2.15;

// Ordered ticks — good (positive m) then bad (negative m) — each carrying its
// crossing label. Built once from canon; treat as frozen.
export const METER_TICKS = Object.freeze([
  ...BAGGER_TIERS.map((t) => ({ m: t.multiplier, name: t.label, kind: 'good' })),
  ...BUST_TIERS.map((t) => ({ m: -t.multiplier, name: t.label, kind: 'bad' })),
]);

// ascending +1.0,+1.5,+2.0
const GOOD_TICKS = METER_TICKS.filter((t) => t.kind === 'good').sort((a, b) => a.m - b.m);
// descending −1.0,−1.5,−2.0
const BAD_TICKS = METER_TICKS.filter((t) => t.kind === 'bad').sort((a, b) => b.m - a.m);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const safe = (m) => (Number.isFinite(m) ? m : 0);

/** multiplier → horizontal % across the gauge (0 → 50, +ST_DOM → 100, −ST_DOM → 0). */
export function meterPct(mult) {
  return 50 + (clamp(safe(mult), -ST_DOM, ST_DOM) / ST_DOM) * 50;
}

/** Has the gauge crossed a given tick at this multiplier? (good = ≥, bad = ≤). */
export function tickCrossed(tick, mult) {
  const m = safe(mult);
  return tick.m >= 0 ? m >= tick.m : m <= tick.m;
}

/**
 * The threshold readout for a multiplier: the next good line above, the next bad
 * line below, and the top good / lowest bad line already crossed.
 * @param {number} mult
 * @returns {{ nextUp:Object|null, nextDown:Object|null, topUp:Object|null, lowDown:Object|null }}
 */
export function meterInfo(mult) {
  const m = safe(mult);
  const crossedUp = GOOD_TICKS.filter((t) => m >= t.m);
  const crossedDown = BAD_TICKS.filter((t) => m <= t.m);
  return {
    nextUp: GOOD_TICKS.find((t) => m < t.m) || null,
    nextDown: BAD_TICKS.find((t) => m > t.m) || null,
    topUp: crossedUp.length ? crossedUp[crossedUp.length - 1] : null,
    lowDown: crossedDown.length ? crossedDown[crossedDown.length - 1] : null,
  };
}

/** Is the bead within `band` of the line it's straining toward? (drives the pulse). */
export function meterNear(mult, climbing, band = 0.35) {
  const info = meterInfo(mult);
  const target = climbing ? info.nextUp : info.nextDown;
  if (!target) return false;
  return Math.abs(target.m - safe(mult)) <= band;
}
