// research/level-study/lib/aggregate.js
//
// LevelStory Session 7 — THE AGGREGATION LAYER (parent §10, §11, §15; Addendum §A4.3, §A7). Turns the
// joined per-event records (labels ⋈ features, on eventId) into the pre-registered verdicts, under the
// honesty gates the whole study was designed around.
//
// ── THE DISCIPLINE (S7 prompt §2, §3.2) ────────────────────────────────────────────────────────────
//   The failure mode is never a crash — it is a CONFIDENT NUMBER built on a contaminated or
//   underpowered sample. Every gate here exists to prevent exactly that, and none may be softened to
//   produce a cleaner-looking result:
//     • Floors: no rate under n=30 AND uniqueDates≥15 (S5-A2). Below either ⇒ UNCONFIRMED, no rate.
//     • Condition-vs-condition only: every cell is compared to a SIBLING cell, never to a pooled
//       headline (the truncation-bias guard, parent §10.3).
//     • No composite score anywhere: the report is a checklist of displayed facts (parent §10.3).
//     • Support and resistance stay separate (parent §10.2); pooling only under the explicit
//       same-direction/overlapping-CI condition, and still footnoting both sides.
//     • Display-agreement: every verdict is a pure function of the 2dp-rounded printed values.
//
// ── THE FROZEN QUESTIONS (parent §10.1 as amended; build EXACTLY these, no additions) ──────────────
//   P1  conf-time : hourly_class → held_EOD from entryAt, F2+, per side.            (gate: A4-eligible)
//   P2  bridge    : per hourly_class, fractionElapsedAtEntry dist + remaining MFE-vs-MAE favorable.
//   P3  touch-time: rvol_bucket → clean_bounce from touchAt, F2+, hasIntradayApproach===true, per side.
//   P4  conf-time : F1 vs F2 → held_EOD within SHARP_REJECT, per side (S5-A1; F3 = exploratory footnote).
//   P5  conf-time : BREAK_RECLAIM vs DRIFT_HOLD → forward MFE from entryAt, per side.
//   P6  conf-time : EXT vs NOT_EXT → clean_bounce from entryAt within SHARP_REJECT + F2+, per side,
//                   with the regime interaction (drops first) and the 10-point floor (Addendum §A4.3).
//   OPEN_TOUCH    : descriptive base rates only, reported separately, NEVER pooled (S56-A2).
//
// ── S7-C1 — THE PROVISIONAL VERDICT SEMANTICS (documented session decision) ─────────────────────────
//   In-sample (Phase A) applies parent §15 criteria 1–3 (floor; sibling difference ≥ minPoints AND its
//   90% clustered CI excludes zero; stability review passes). The provisional verdict maps as:
//     • CONFIRMED-pending-holdout — floor OK, significant sibling difference, stability PASSES.
//     • DEAD                      — floor OK, significant sibling difference, but stability FAILS. A
//                                   result the robustness check refuted is not merely "inconclusive";
//                                   it is affirmatively killed and is NOT carried to the single-open
//                                   holdout (§11.4 makes stability a hard graduation gate the holdout
//                                   cannot rescue). Distinct from a holdout-DEAD; labeled as such.
//     • UNCONFIRMED               — everything else (below floor, or not significant). Inconclusive.
//   This is the one reading under which all three provisional labels are reachable in Phase A (S7 §7)
//   while honoring parent §15 ("anything short of all five is UNCONFIRMED") for the inconclusive tail.
//
// Pure module: imports ./stats.js and ../config.js only. Zero product imports. Every exported function
// is a pure function of its arguments; the runner (06-aggregate.js) does all I/O and rendering.

import CONFIG from '../config.js';
import {
  rateOf, rateCI, medianCI, median, siblingDiffCI, ciExcludesZero,
  stabilityReview, medianDiffStabilityReview, concentration, incrementalLift, round1, round2, clusteredBootstrap,
} from './stats.js';

const ACC = CONFIG.honesty.acceptance;
export const MIN_N = ACC.minN;                 // 30 (parent §15.1)
export const MIN_UD = ACC.minUniqueDates;      // 15 (S5-A2)
export const MIN_DIFF_POINTS = ACC.minSiblingDiffPoints;                 // 15 (parent §15.2)
export const ASYMMETRY_MULT = ACC.confirmationTimeAsymmetry.medianRemainingMfeToMaeMult; // 2 (§15.5)
export const P6_MIN_DIFF_POINTS = CONFIG.primaryQuestions.P6.minMeaningfulDiffPoints;    // 10 (Addendum §A4.3)
export const HOLDOUT_START = CONFIG.range.holdoutStart; // '2025-12-10'
export const SIDES = ['support', 'resistance'];

// ── Gates (frozen; each cites the ruling that fixed it) ────────────────────────────────────────────
const isF2plus = (r) => r.familyTier === 'F2' || r.familyTier === 'F3'; // F2+ pools F3 (S5-A1)
const isTouch = (r) => r.disposition === 'touch';
const eligibleHourly = (r) => r.hourlyClassEligible === true;           // S56-A4 (P1/P2/P5)
const hasApproach = (r) => r.hasIntradayApproach === true;             // S56-A1 (P3)
const isSharpReject = (r) => r.hourly_class === 'SHARP_REJECT';        // parent §7 (P4/P6 within)

// ── Endpoint extractors (0/1 for binary rates; numeric for medians) ────────────────────────────────
const bool01 = (b) => (b == null ? null : b ? 1 : 0);
const heldEODentry = (r) => bool01(r.held_EOD_entry);
const cleanBounceTouch = (r) => bool01(r.clean_bounce_touch);
const cleanBounceEntry = (r) => bool01(r.clean_bounce_entry);
const mfeEODentry = (r) => r.mfe_eod_entry;
const maeEODentry = (r) => r.mae_eod_entry;

// ── Cell construction ──────────────────────────────────────────────────────────────────────────────
//
// A "cell" for the stats layer is the array of {date, symbol, sector, y} for the events matching a
// gate+split whose endpoint is NON-NULL. n = analyzable count; a null endpoint (e.g. a last-session
// event with no confirmation-time grid) is EXCLUDED from the rate denominator and counted separately
// (null-never-zero, parent §6.3). floorOk gates whether a rate is shown at all.

function toCell(records, endpointFn) {
  const cell = [];
  let nullEndpoint = 0;
  for (const r of records) {
    const y = endpointFn(r);
    if (y == null) { nullEndpoint += 1; continue; }
    cell.push({ date: r.eventDate, symbol: r.symbol, sector: r.sector, y, __rec: r });
  }
  return { cell, nullEndpoint };
}

function floorOf(cell) {
  const uniqueDates = new Set(cell.map((r) => r.date)).size;
  return { n: cell.length, uniqueDates, floorOk: cell.length >= MIN_N && uniqueDates >= MIN_UD };
}

/**
 * Describe one displayed cell: n, uniqueDates, floor status, and — ONLY when the floor clears — the
 * 2dp rate and its clustered 90% CI, plus concentration diagnostics. Below floor, rate/CI are null and
 * the label is `UNCONFIRMED — insufficient (n=…, ud=…)` (the display-agreement rule: the verdict is a
 * pure function of the printed n/ud).
 */
export function describeCell(records, endpointFn, label, opts = {}) {
  const { cell, nullEndpoint } = toCell(records, endpointFn);
  const fl = floorOf(cell);
  const conc = concentration(cell);
  // A DESCRIPTIVE cell (e.g. P6's displayed-not-tested MID bucket) below floor prints a plain
  // "insufficient" marker — never the verdict word "UNCONFIRMED", which it cannot carry because it is
  // never tested (mirrors 04-features.js descriptiveCell; a cell may not display a verdict it lacks).
  const insufficientMarker = fl.floorOk ? null
    : `${opts.descriptive ? 'insufficient' : 'UNCONFIRMED — insufficient'} (n=${fl.n}, ud=${fl.uniqueDates})`;
  const out = {
    label,
    n: fl.n,
    uniqueDates: fl.uniqueDates,
    nullEndpointExcluded: nullEndpoint,
    floorOk: fl.floorOk,
    top5SymbolPct: conc.top5SymbolPct,
    topSymbols: conc.topSymbols,
    topSectorPct: conc.topSectorPct,   // §A7 validation view: sector concentration
    topSectors: conc.topSectors,
    ratePct: null,
    rateCI: null,
    insufficient: insufficientMarker,
  };
  if (fl.floorOk) {
    const ci = rateCI(cell);
    out.ratePct = round2(rateOf(cell) * 100);
    out.rateCI = { loPct: round2(ci.lo * 100), hiPct: round2(ci.hi * 100) };
  }
  return { ...out, _cell: cell };
}

// ── The sibling contrast (parent §10.3 condition-vs-condition; §11.2 machinery; §15 verdict) ────────
//
// Given two sibling cells, compute the sibling difference (points), its clustered 90% CI, the stability
// review, and — for confirmation-time questions — the favorable-asymmetry check (§15.5). The provisional
// verdict is derived STRICTLY from the displayed rounded values (S7-C1 above).

/** median remaining MFE ≥ MULT × median remaining MAE-magnitude at EOD from entryAt (§15.5). */
function asymmetryOf(records) {
  const mfe = median(records.map(mfeEODentry).filter((x) => x != null));
  const mae = median(records.map(maeEODentry).filter((x) => x != null)); // ≤ 0 (adverse)
  if (mfe == null || mae == null) return { medianMfe: null, medianMae: null, favorable: null };
  const maeMag = Math.abs(mae);
  const favorable = round2(mfe) >= ASYMMETRY_MULT * round2(maeMag); // display-agreement: rounded values
  return { medianMfe: round2(mfe), medianMae: round2(mae), favorable };
}

export function buildContrast({
  aRecords, bRecords, endpointFn, labelA, labelB, minDiffPoints = MIN_DIFF_POINTS,
  confirmationTime = true, contrastName,
}) {
  const A = describeCell(aRecords, endpointFn, labelA);
  const B = describeCell(bRecords, endpointFn, labelB);
  const bothFloor = A.floorOk && B.floorOk;

  let diffPoints = null, diffCI = null, excludesZero = false, stability = null;
  if (bothFloor) {
    const sib = siblingDiffCI(A._cell, B._cell);
    diffPoints = round2((sib.pointA - sib.pointB) * 100);
    diffCI = { loPct: round2(sib.lo * 100), hiPct: round2(sib.hi * 100) };
    // Display-agreement (BUILD_RULES §9): the verdict's "excludes zero" is read from the SAME 2dp-rounded
    // CI the report prints, not the raw pre-rounding bounds — so a bound that rounds to 0.00 can never
    // silently read as "excludes zero" while the printed CI shows a zero edge.
    excludesZero = ciExcludesZero({ lo: diffCI.loPct, hi: diffCI.hiPct });
    stability = stabilityReview(A._cell, B._cell);
  }

  // Confirmation-time asymmetry (§15.5) on each cohort — displayed, and a graduation requirement for
  // confirmation-time buckets. Touch-time questions (P3) have no entryAt asymmetry.
  const asymmetry = confirmationTime
    ? { [labelA]: asymmetryOf(aRecords), [labelB]: asymmetryOf(bRecords) }
    : null;

  // Provisional verdict (S7-C1): pure function of the printed rounded values.
  let verdict;
  if (!bothFloor) {
    verdict = 'UNCONFIRMED';
  } else {
    const significant = excludesZero && Math.abs(diffPoints) >= minDiffPoints;
    if (!significant) verdict = 'UNCONFIRMED';
    else if (!stability.pass) verdict = 'DEAD'; // significant but stability-fragile — not carried to holdout
    else verdict = 'CONFIRMED-pending-holdout';
  }

  return {
    contrastName: contrastName || `${labelA} vs ${labelB}`,
    cellA: stripCell(A),
    cellB: stripCell(B),
    diffPoints,
    diffCI,
    ciExcludesZero: excludesZero,
    minDiffPoints,
    stability: stability ? { pass: stability.pass, flips: stability.flips, undefinedRemovals: stability.undefinedRemovals } : null,
    asymmetry,
    verdict,
    // Carried so the holdout phase can apply §11.4 crit 4 (holdout point within in-sample CI) without
    // re-reading raw cells — the in-sample CI IS this contrast's diffCI.
    _forHoldout: bothFloor ? { inSampleDiffPoints: diffPoints, inSampleDiffCI: diffCI, inSampleSign: Math.sign(diffPoints) } : null,
  };
}

function stripCell(c) { const { _cell, ...rest } = c; return rest; }

// ── Descriptive context per cohort (Addendum §A7 context view; never verdict-bearing) ──────────────
function mixOf(records, key) {
  const m = {};
  for (const r of records) { const v = r[key] == null ? 'null' : r[key]; m[v] = (m[v] || 0) + 1; }
  return m;
}
export function contextOf(records) {
  // §A7 context view content: group leadership, regime state mix, breadth at event, extension bucket,
  // leg maturity, move origin. All descriptive — never verdict-bearing.
  return {
    n: records.length,
    // group leadership (peer confirmations before this touch): median count of same-sector peers that
    // had already confirmed in-session (Addendum §A2.1) — the "is the group leading?" read.
    groupLeadershipMedianPeerConfirmations: round1(median(records.map((r) => r.peer_confirmations).filter((x) => x != null))),
    regimeMix: mixOf(records, 'momo_regime'),
    breadthMedianPctAbove50dma: round1(median(records.map((r) => r.breadth_pct_above_50dma).filter((x) => x != null))),
    extensionMix: mixOf(records, 'extension_bucket'),
    legMaturityBaseCountMedian: round1(median(records.map((r) => r.base_count).filter((x) => x != null))),
    moveOriginMix: mixOf(records, 'move_origin'),
    spyDirMix: mixOf(records, 'spy_direction_at_touch'),
  };
}

// ── Incremental lift (parent §11.3; exploratory appendix; DIRECTIONAL FLAG only) ───────────────────
//
// The pre-registered model inputs (parent §11.3): family tier, hourly class, side, tod_bucket,
// vol-regime percentile, SPY-direction-at-touch, symbol random effect (approximated as a fixed effect
// — a mixed model is out of scope for a yes/no flag). Whichever input IS the question's focal predictor
// is dropped from the control set, so it never enters the design twice (collinear).
const FOCAL_CONTROL_KEY = { hourly_class: 'hourly_class', familyTier: 'family_tier' };
function liftControlsFor(r, focalKey) {
  const c = {
    family_tier: r.familyTier,
    hourly_class: r.hourly_class,
    side: r.side,
    tod_bucket: r.tod_bucket,
    vol_regime_pctile: r.vol_regime_pctile,
    spy_direction_at_touch: r.spy_direction_at_touch,
    symbol: r.symbol,
  };
  delete c[FOCAL_CONTROL_KEY[focalKey] || focalKey]; // never control on the focal
  return c;
}
/** Build the lift flag for a question: outcome = endpointFn, focal = focalKey (e.g. 'hourly_class'). */
export function liftFor(records, endpointFn, focalKey, focalName) {
  const rows = records
    .map((r) => ({ y: endpointFn(r), focal: r[focalKey], controls: liftControlsFor(r, focalKey), date: r.eventDate }))
    .filter((r) => r.y === 0 || r.y === 1);
  return incrementalLift(rows, focalName);
}

// ── All-pairwise sibling contrasts for a multi-level question (P1, P3) ─────────────────────────────
//
// P1 (5 hourly classes) and P3 (3 rvol buckets) have no single pre-registered privileged pair, so —
// under "condition-vs-condition only, never vs pooled" and "no additions" — every FLOOR-CLEARING pair
// is rendered as its own sibling contrast, each fully evaluated (diff CI, stability, verdict). Nothing
// is collapsed to a pooled headline and nothing is cherry-picked: the full contrast set is displayed.

function pairwiseContrasts(byLevel, orderedLevels, endpointFn, { confirmationTime, minDiffPoints }) {
  const contrasts = [];
  for (let i = 0; i < orderedLevels.length; i++) {
    for (let j = i + 1; j < orderedLevels.length; j++) {
      const a = orderedLevels[i], b = orderedLevels[j];
      contrasts.push(buildContrast({
        aRecords: byLevel[a] || [], bRecords: byLevel[b] || [],
        endpointFn, labelA: a, labelB: b, confirmationTime, minDiffPoints,
      }));
    }
  }
  return contrasts;
}

// ── The six questions + OPEN_TOUCH ─────────────────────────────────────────────────────────────────
//
// Each builder takes the FULL joined record set (already mode-filtered to in-sample or holdout by the
// runner) and returns a per-side result. Support and resistance are always built separately (§10.2).

const HOURLY_ORDER = CONFIG.hourlyClass.evaluationOrder; // SHARP_REJECT..CHOP
const RVOL_ORDER = ['LOW', 'MID', 'HIGH'];

/** P1 — hourly_class → held_EOD from entryAt, F2+, per side (A4-eligible). */
export function buildP1(records) {
  const out = { question: 'P1', study: 'confirmation-time', endpoint: 'held_EOD', origin: 'entryAt',
    gate: 'F2+ AND hourlyClassEligible===true (S56-A4)', perSide: {} };
  for (const side of SIDES) {
    const pop = records.filter((r) => isTouch(r) && r.side === side && isF2plus(r) && eligibleHourly(r));
    const byClass = {};
    for (const c of HOURLY_ORDER) byClass[c] = pop.filter((r) => r.hourly_class === c);
    const cells = HOURLY_ORDER.map((c) => describeCell(byClass[c], heldEODentry, c)).map(stripCell);
    const contrasts = pairwiseContrasts(byClass, HOURLY_ORDER, heldEODentry, { confirmationTime: true, minDiffPoints: MIN_DIFF_POINTS });
    out.perSide[side] = {
      population: pop.length,
      cells,
      contrasts,
      context: contextOf(pop),
      incrementalLift: liftFor(pop, heldEODentry, 'hourly_class', 'hourly_class'),
    };
  }
  return out;
}

/** P2 — per hourly_class: fractionElapsedAtEntry distribution + remaining MFE-vs-MAE favorable, per side. */
export function buildP2(records) {
  // Gate = hourlyClassEligible only (S56-A4). The frozen P2 (parent §10.1; S7 §3.1) carries NO F2+
  // qualifier — the spec author placed "(F2+ levels)" on P1/P3 and deliberately omitted it here, so
  // gating P2 on F2+ would narrow the pre-registered population (a forbidden addition).
  const out = { question: 'P2', study: 'bridge', endpoint: 'fractionElapsedAtEntry + remaining MFE/MAE',
    origin: 'entryAt', gate: 'hourlyClassEligible===true (S56-A4); NO tier gate (parent §10.1)', perSide: {} };
  for (const side of SIDES) {
    const pop = records.filter((r) => isTouch(r) && r.side === side && eligibleHourly(r));
    const perClass = {};
    for (const c of HOURLY_ORDER) {
      const rows = pop.filter((r) => r.hourly_class === c);
      const fracCell = rows.map((r) => ({ date: r.eventDate, symbol: r.symbol, sector: r.sector, y: r.fraction_elapsed }))
        .filter((r) => r.y != null);
      const fl = floorOf(fracCell);
      const fracMedianCI = fl.floorOk ? medianCI(fracCell) : null;
      perClass[c] = {
        n: rows.length,
        fracN: fracCell.length,
        uniqueDates: fl.uniqueDates,
        floorOk: fl.floorOk,
        fractionElapsed: fl.floorOk
          ? {
            p25: round2(percentileOf(fracCell.map((r) => r.y), 0.25)),
            median: round2(median(fracCell.map((r) => r.y))),
            p75: round2(percentileOf(fracCell.map((r) => r.y), 0.75)),
            medianCI: fracMedianCI ? { lo: round2(fracMedianCI.lo), hi: round2(fracMedianCI.hi) } : null,
          }
          : null,
        asymmetry: asymmetryOf(rows),
        insufficient: fl.floorOk ? null : `UNCONFIRMED — insufficient (n=${fracCell.length}, ud=${fl.uniqueDates})`,
        // P2 is a descriptive+asymmetry question, not a sibling-difference one: its per-class provisional
        // signal is floor-clear AND favorable remaining asymmetry (§15.5).
        provisional: !fl.floorOk ? 'UNCONFIRMED'
          : asymmetryOf(rows).favorable ? 'favorable-pending-holdout' : 'UNCONFIRMED',
      };
    }
    out.perSide[side] = { population: pop.length, perClass, context: contextOf(pop) };
  }
  return out;
}

/** P3 — rvol_bucket → clean_bounce from touchAt, F2+, hasIntradayApproach===true, per side. */
export function buildP3(records) {
  const out = { question: 'P3', study: 'touch-time', endpoint: 'clean_bounce', origin: 'touchAt',
    gate: 'F2+ AND hasIntradayApproach===true (S56-A1)', perSide: {} };
  for (const side of SIDES) {
    const f2side = records.filter((r) => isTouch(r) && r.side === side && isF2plus(r));
    const pop = f2side.filter(hasApproach);
    const excludedNoApproach = f2side.length - pop.length; // S56-A1 stated, never hidden
    const byBucket = {};
    for (const b of RVOL_ORDER) byBucket[b] = pop.filter((r) => r.rvol_bucket === b);
    const nullRvol = pop.filter((r) => r.rvol_bucket == null).length;
    const cells = RVOL_ORDER.map((b) => describeCell(byBucket[b], cleanBounceTouch, b)).map(stripCell);
    const contrasts = pairwiseContrasts(byBucket, RVOL_ORDER, cleanBounceTouch, { confirmationTime: false, minDiffPoints: MIN_DIFF_POINTS });
    out.perSide[side] = {
      population: pop.length,
      excludedNoIntradayApproach: excludedNoApproach,
      nullRvolWithinApproach: nullRvol,
      cells,
      contrasts,
      context: contextOf(pop),
      incrementalLift: liftFor(pop, cleanBounceTouch, 'rvol_bucket', 'rvol_bucket'),
    };
  }
  return out;
}

/** P4 — F1 vs F2 → held_EOD within SHARP_REJECT, per side (S5-A1); F3 exploratory footnote. */
export function buildP4(records) {
  const out = { question: 'P4', study: 'confirmation-time', endpoint: 'held_EOD', origin: 'entryAt',
    within: 'SHARP_REJECT', compare: ['F1', 'F2'], gate: 'SHARP_REJECT (S5-A1: F1 vs F2)', perSide: {} };
  for (const side of SIDES) {
    const pop = records.filter((r) => isTouch(r) && r.side === side && eligibleHourly(r) && isSharpReject(r));
    const f1 = pop.filter((r) => r.familyTier === 'F1');
    const f2 = pop.filter((r) => r.familyTier === 'F2');
    const f3 = pop.filter((r) => r.familyTier === 'F3'); // exploratory footnote only
    const contrast = buildContrast({
      aRecords: f1, bRecords: f2, endpointFn: heldEODentry, labelA: 'F1', labelB: 'F2',
      confirmationTime: true, minDiffPoints: MIN_DIFF_POINTS,
    });
    out.perSide[side] = {
      population: pop.length,
      contrast,
      f3Footnote: { n: f3.length, note: 'F3 pooled into F2+ for P1/P2/P3/P6; here descriptive only (S5-A1)' },
      context: contextOf(pop),
      incrementalLift: liftFor(pop, heldEODentry, 'familyTier', 'family_tier'),
    };
  }
  return out;
}

/** P5 — BREAK_RECLAIM vs DRIFT_HOLD → forward MFE from entryAt, F2+, per side. */
export function buildP5(records) {
  // Endpoint = forward MFE from entryAt (a numeric). The "trap-pattern" verdict is a difference in
  // MEDIAN forward MFE between the two classes; the sibling machinery is the median-difference CI.
  // Gate = hourlyClassEligible only (S56-A4). The frozen P5 (parent §10.1 table; S7 §3.1) has NO F2+
  // qualifier — unlike P1/P3, which state "(F2+)". Gating P5 on F2+ would narrow the pre-registered
  // population (a forbidden addition); the S5.6 budget re-read grouped P1/P2/P5 under F2+ for a POWER
  // checkpoint, which is not the frozen question definition.
  const out = { question: 'P5', study: 'confirmation-time', endpoint: 'forward MFE (EOD, entryAt)',
    origin: 'entryAt', compare: ['BREAK_RECLAIM', 'DRIFT_HOLD'], gate: 'hourlyClassEligible===true (S56-A4); NO tier gate (parent §10.1)', perSide: {} };
  for (const side of SIDES) {
    const pop = records.filter((r) => isTouch(r) && r.side === side && eligibleHourly(r));
    const br = pop.filter((r) => r.hourly_class === 'BREAK_RECLAIM');
    const dh = pop.filter((r) => r.hourly_class === 'DRIFT_HOLD');
    out.perSide[side] = {
      population: pop.length,
      contrast: buildMedianContrast(br, dh, mfeEODentry, 'BREAK_RECLAIM', 'DRIFT_HOLD'),
      context: contextOf(pop),
      incrementalLift: liftFor(pop, heldEODentry, 'hourly_class', 'hourly_class'),
    };
  }
  return out;
}

/** P6 — EXT vs NOT_EXT → clean_bounce from entryAt within SHARP_REJECT + F2+, per side (Addendum §A4.3). */
export function buildP6(records) {
  const out = { question: 'P6', study: 'confirmation-time', endpoint: 'clean_bounce', origin: 'entryAt',
    within: 'SHARP_REJECT', gate: 'F2+ AND SHARP_REJECT', primaryComparison: ['EXT', 'NOT_EXT'],
    midDisplayedNotTested: true, minDiffPoints: P6_MIN_DIFF_POINTS, perSide: {} };
  for (const side of SIDES) {
    const pop = records.filter((r) => isTouch(r) && r.side === side && isF2plus(r) && eligibleHourly(r) && isSharpReject(r));
    const ext = pop.filter((r) => r.extension_bucket === 'EXT');
    const notExt = pop.filter((r) => r.extension_bucket === 'NOT_EXT');
    const mid = pop.filter((r) => r.extension_bucket === 'MID'); // displayed, NOT tested (Addendum §A4.3)

    const contrast = buildContrast({
      aRecords: ext, bRecords: notExt, endpointFn: cleanBounceEntry, labelA: 'EXT', labelB: 'NOT_EXT',
      confirmationTime: true, minDiffPoints: P6_MIN_DIFF_POINTS,
    });

    // The pre-registered interaction test (regime): does EXT-vs-NOT_EXT differ across momo_regime?
    // Per the frozen fallback ladder, if any EXT/NOT_EXT cell starves the interaction DROPS FIRST and
    // regime becomes a within-table annotation; the per-side primary comparison is protected last.
    const interaction = buildRegimeInteraction(ext, notExt, cleanBounceEntry);

    out.perSide[side] = {
      population: pop.length,
      contrast,
      midDisplayed: stripCell(describeCell(mid, cleanBounceEntry, 'MID (displayed, not tested)', { descriptive: true })),
      regimeInteraction: interaction,
      secondaryDiagnostics: {
        // displayed, never verdict-bearing (Addendum §A4.3)
        EXT: secondaryDiag(ext), NOT_EXT: secondaryDiag(notExt),
      },
      baseCountSplitsExploratory: baseCountExploratory(pop, cleanBounceEntry),
      context: contextOf(pop),
      incrementalLift: liftFor(pop, cleanBounceEntry, 'extension_bucket', 'extension_bucket'),
    };
  }
  return out;
}

/** OPEN_TOUCH — descriptive base rates only (held_EOD, clean_bounce, MFE/MAE), per side. NEVER pooled. */
export function buildOpenTouch(records) {
  const REG_OPEN = CONFIG.session.regularOpenEtMinutes; // 570
  const out = { question: 'OPEN_TOUCH', descriptiveOnly: true,
    gate: `disposition=touch AND hasIntradayApproach===false AND touchEtMinutes===${REG_OPEN} (S56-A2)`,
    note: 'DESCRIPTIVE ONLY — no hypothesis, no verdict, no CI-graduation. Base rates only; never pooled into P3.',
    perSide: {} };
  for (const side of SIDES) {
    const pop = records.filter((r) => isTouch(r) && r.side === side && r.hasIntradayApproach === false && r.touchEtMinutes === REG_OPEN);
    const f2 = pop.filter(isF2plus);
    out.perSide[side] = {
      n: pop.length,
      uniqueDates: new Set(pop.map((r) => r.eventDate)).size,
      f2plusN: f2.length,
      baseRates: {
        held_EOD: descriptiveRate(pop, heldEODentry),
        clean_bounce_touch: descriptiveRate(pop, cleanBounceTouch),
        medianMfeEOD: round2(median(pop.map(mfeEODentry).filter((x) => x != null))),
        medianMaeEOD: round2(median(pop.map(maeEODentry).filter((x) => x != null))),
      },
    };
  }
  return out;
}

// ── Supporting builders ────────────────────────────────────────────────────────────────────────────

/** A median-difference contrast (P5's forward-MFE), mirroring buildContrast but on medians. */
function buildMedianContrast(aRecords, bRecords, endpointFn, labelA, labelB) {
  const aCell = aRecords.map((r) => ({ date: r.eventDate, symbol: r.symbol, sector: r.sector, y: endpointFn(r) })).filter((r) => r.y != null);
  const bCell = bRecords.map((r) => ({ date: r.eventDate, symbol: r.symbol, sector: r.sector, y: endpointFn(r) })).filter((r) => r.y != null);
  const flA = floorOf(aCell), flB = floorOf(bCell);
  const bothFloor = flA.floorOk && flB.floorOk;
  const cellSummary = (records, cell, fl, label) => {
    const conc = concentration(cell);
    return {
      label, n: fl.n, uniqueDates: fl.uniqueDates, floorOk: fl.floorOk,
      medianMfe: fl.floorOk ? round2(median(cell.map((r) => r.y))) : null,
      medianCI: fl.floorOk ? (() => { const ci = medianCI(cell); return { lo: round2(ci.lo), hi: round2(ci.hi) }; })() : null,
      top5SymbolPct: conc.top5SymbolPct, topSymbols: conc.topSymbols,
      asymmetry: asymmetryOf(records),
      insufficient: fl.floorOk ? null : `UNCONFIRMED — insufficient (n=${fl.n}, ud=${fl.uniqueDates})`,
    };
  };
  let diff = null, diffCI = null, excludesZero = false, stability = null;
  if (bothFloor) {
    const union = [...aCell.map((r) => ({ ...r, __g: 'A' })), ...bCell.map((r) => ({ ...r, __g: 'B' }))];
    const stat = (s) => { const a = median(s.filter((r) => r.__g === 'A').map((r) => r.y)); const b = median(s.filter((r) => r.__g === 'B').map((r) => r.y)); return a == null || b == null ? null : a - b; };
    const boot = clusteredMedianDiff(union, stat);
    diff = round2(median(aCell.map((r) => r.y)) - median(bCell.map((r) => r.y)));
    diffCI = { lo: round2(boot.lo), hi: round2(boot.hi) };
    excludesZero = ciExcludesZero({ lo: diffCI.lo, hi: diffCI.hi }); // read from the rounded printed CI (BUILD_RULES §9)
    // Median-difference stability — the SAME three removals as the rate version (symbol/sector/episode),
    // via the shared generic, so P5 is not silently held to a weaker robustness bar (parent §11.2).
    stability = medianDiffStabilityReview(aCell, bCell);
  }
  // P5's endpoint is a CONTINUOUS forward-MFE median (ATR), not a rate — so the parent §15.2
  // "≥ 15 points" percentage-point floor does not apply; the graduation criterion is CI-excludes-zero
  // (§11.4 crit 1) + stability (§11.2). Documented so the absence of a magnitude threshold is explicit.
  let verdict;
  if (!bothFloor) verdict = 'UNCONFIRMED';
  else if (!(excludesZero)) verdict = 'UNCONFIRMED';
  else if (!stability.pass) verdict = 'DEAD';
  else verdict = 'CONFIRMED-pending-holdout';
  return {
    contrastName: `${labelA} vs ${labelB}`, metric: 'median forward MFE (ATR)',
    cellA: cellSummary(aRecords, aCell, flA, labelA), cellB: cellSummary(bRecords, bCell, flB, labelB),
    diffMedian: diff, diffCI, ciExcludesZero: excludesZero,
    stability: stability ? { pass: stability.pass, flips: stability.flips } : null,
    // Contrast-level asymmetry keyed by label — P5 is confirmation-time, so applyHoldout's §15.5 check
    // (median remaining MFE ≥ 2× median MAE on the winning cohort) reads this; without it the holdout
    // asymmetry gate would see `undefined` and P5 could never CONFIRM.
    asymmetry: { [labelA]: asymmetryOf(aRecords), [labelB]: asymmetryOf(bRecords) },
    verdict,
    _forHoldout: bothFloor ? { inSampleDiffMedian: diff, inSampleDiffCI: diffCI, inSampleSign: Math.sign(diff) } : null,
  };
}

// Median-difference clustered bootstrap (reuses the stats primitive; the mechanism is identical to
// the rate bootstrap, only the statistic differs — resample dates, compute the median difference).
function clusteredMedianDiff(union, stat) { return clusteredBootstrap(union, stat); }

/** The regime interaction for P6: EXT-vs-NOT_EXT difference within each momo_regime state. */
function buildRegimeInteraction(ext, notExt, endpointFn) {
  const states = ['MOMO_ON', 'MOMO_OFF', 'NEUTRAL'];
  const byState = {};
  let anyStarved = false;
  for (const g of states) {
    const e = ext.filter((r) => r.momo_regime === g);
    const ne = notExt.filter((r) => r.momo_regime === g);
    const cE = describeCell(e, endpointFn, `EXT/${g}`);
    const cNE = describeCell(ne, endpointFn, `NOT_EXT/${g}`);
    const starved = !(cE.floorOk && cNE.floorOk);
    if (starved) anyStarved = true;
    byState[g] = { EXT: stripCell(cE), NOT_EXT: stripCell(cNE), starved };
  }
  return {
    byState,
    dropped: anyStarved,
    disposition: anyStarved
      ? 'DROPPED — a cell starved; per the pre-registered fallback ladder the regime interaction drops FIRST and becomes a within-table annotation. The per-side EXT-vs-NOT_EXT primary comparison is protected (Addendum §A4.3).'
      : 'viable — all six regime×extension cells clear the floor; the one interaction test may be evaluated.',
  };
}

function secondaryDiag(records) {
  return {
    n: records.length,
    medianMfeEOD: round2(median(records.map(mfeEODentry).filter((x) => x != null))),
    heldEOD: descriptiveRate(records, heldEODentry),
    medianFractionElapsed: round2(median(records.map((r) => r.fraction_elapsed).filter((x) => x != null))),
  };
}

function baseCountExploratory(records, endpointFn) {
  // base_count splits are EXPLORATORY ONLY (Addendum §A4.3) and additionally demote if leg-detection
  // manual agreement < 80% (Addendum §A4.1). Rendered as descriptive base rates by base_count bucket;
  // never verdict-bearing.
  const bucketOf = (bc) => (bc == null ? 'null' : bc === 0 ? '0' : bc === 1 ? '1' : bc === 2 ? '2' : '3+');
  const buckets = {};
  for (const r of records) { const b = bucketOf(r.base_count); (buckets[b] = buckets[b] || []).push(r); }
  const out = {};
  for (const [b, rows] of Object.entries(buckets)) out[b] = { n: rows.length, cleanBounceRate: descriptiveRate(rows, endpointFn) };
  return { note: 'EXPLORATORY ONLY (Addendum §A4.3); demotes further if leg-detection manual agreement < 80% (§A4.1)', byBaseCount: out };
}

/** A descriptive rate: a 2dp % if the floor clears, else the insufficient marker. No CI-graduation. */
function descriptiveRate(records, endpointFn) {
  const { cell } = toCell(records, endpointFn);
  const fl = floorOf(cell);
  return fl.floorOk ? { ratePct: round2(rateOf(cell) * 100), n: fl.n, uniqueDates: fl.uniqueDates }
    : { ratePct: null, n: fl.n, uniqueDates: fl.uniqueDates, insufficient: `insufficient (n=${fl.n}, ud=${fl.uniqueDates})` };
}

function percentileOf(values, p) {
  const v = values.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const idx = (v.length - 1) * p; const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (idx - lo);
}

// ── The full in-sample aggregation ─────────────────────────────────────────────────────────────────
//
// L-S56-2 guard: validate every record's REQUIRED clustering inputs before any statistic is computed.
// The date is the economic observation unit (parent §11.1) and the symbol/sector drive concentration
// and stability — a record silently missing one would corrupt a clustered CI while looking correct.
// Throw rather than default (the byte-identical-guard discipline, S6 §6.11 / L-S56-2).
export function assertAggregable(records) {
  for (const r of records) {
    if (typeof r.eventDate !== 'string' || !r.eventDate) {
      throw new Error(`aggregate: record ${r.eventId ?? '(no id)'} has no string eventDate — the date is the clustering unit and is never defaulted (L-S56-2)`);
    }
    if (r.symbol == null) throw new Error(`aggregate: record ${r.eventId ?? '(no id)'} has no symbol — required for concentration/stability, never defaulted (L-S56-2)`);
    if (r.side !== 'support' && r.side !== 'resistance') {
      throw new Error(`aggregate: record ${r.eventId ?? '(no id)'} has invalid side "${r.side}" — support/resistance separation is mandatory (parent §10.2)`);
    }
  }
  return true;
}

export function aggregateInSample(records) {
  assertAggregable(records);
  return {
    P1: buildP1(records),
    P2: buildP2(records),
    P3: buildP3(records),
    P4: buildP4(records),
    P5: buildP5(records),
    P6: buildP6(records),
    OPEN_TOUCH: buildOpenTouch(records),
  };
}

// ── Sign separation / pooling guard (parent §10.2; S7 §5 test 4) ───────────────────────────────────
//
// Support and resistance NEVER pool by default. A pooled view is permitted ONLY when both sides
// independently show SAME-DIRECTION effects with OVERLAPPING clustered CIs — and even then the pooled
// view still footnotes both sides' separate numbers. This function decides ONLY whether pooling is
// permitted; it never mutates the per-side results.
export function poolingPermitted(contrastSupport, contrastResistance) {
  if (!contrastSupport || !contrastResistance) return { permitted: false, reason: 'a side is missing a contrast' };
  const dS = contrastSupport.diffPoints ?? contrastSupport.diffMedian;
  const dR = contrastResistance.diffPoints ?? contrastResistance.diffMedian;
  const ciS = contrastSupport.diffCI, ciR = contrastResistance.diffCI;
  if (dS == null || dR == null || !ciS || !ciR) return { permitted: false, reason: 'a side is below floor (no CI)' };
  const sameDirection = Math.sign(dS) === Math.sign(dR) && Math.sign(dS) !== 0;
  // Overlap of [loS,hiS] and [loR,hiR].
  const loS = ciS.loPct ?? ciS.lo, hiS = ciS.hiPct ?? ciS.hi, loR = ciR.loPct ?? ciR.lo, hiR = ciR.hiPct ?? ciR.hi;
  const overlap = Math.max(loS, loR) <= Math.min(hiS, hiR);
  const permitted = sameDirection && overlap;
  return {
    permitted,
    sameDirection,
    overlap,
    reason: permitted
      ? 'both sides same-direction with overlapping 90% CIs — a pooled view is permitted, still footnoting both sides (parent §10.2)'
      : !sameDirection ? 'sides point in different directions — pooling forbidden (parent §10.2)'
        : 'CIs do not overlap — pooling forbidden (parent §10.2)',
    footnote: { support: dS, resistance: dR }, // pooled view must always footnote both sides' separate numbers
  };
}

// ── Holdout application (parent §11.4 crit 3–4 + §15 crit 5; single-open) ───────────────────────────
//
// For each in-sample CONFIRMED-pending-holdout contrast, apply the holdout gates against the SAME
// contrast recomputed on the held-out months:
//   crit 3 (§11.4): holdout effect direction agrees with in-sample.
//   crit 4 (§11.4): holdout point estimate falls WITHIN the in-sample 90% CI.
//   crit 5 (§15):   for confirmation-time buckets, favorable asymmetry from entryAt persists in holdout
//                   (median remaining MFE ≥ 2× median MAE) — checked on the holdout cohort cells.
// SINGLE-OPEN: a failing contrast is DEAD, full stop — never re-tuned, never re-tested. There are no
// knobs to re-tune (everything is frozen); the discipline is that we do not fish the holdout for a
// rescue. This function is a pure decision over the two pre-computed contrasts.
export function applyHoldout(inSampleContrast, holdoutContrast, { confirmationTime = true } = {}) {
  if (!inSampleContrast || inSampleContrast.verdict !== 'CONFIRMED-pending-holdout') {
    return { finalVerdict: inSampleContrast ? inSampleContrast.verdict.replace('-pending-holdout', '') : 'UNCONFIRMED',
      applied: false, reason: 'not an in-sample graduation candidate — holdout not applied' };
  }
  const inDiff = inSampleContrast.diffPoints ?? inSampleContrast.diffMedian;
  const inCI = inSampleContrast.diffCI;
  const hoDiff = holdoutContrast ? (holdoutContrast.diffPoints ?? holdoutContrast.diffMedian) : null;

  if (hoDiff == null) {
    return { finalVerdict: 'DEAD', applied: true, criteria: { directionAgrees: false, withinInSampleCI: false, asymmetry: null },
      reason: 'holdout cell(s) below floor or empty — cannot confirm; DEAD under single-open (no re-test).' };
  }
  const directionAgrees = Math.sign(hoDiff) === Math.sign(inDiff) && Math.sign(inDiff) !== 0;
  const lo = inCI.loPct ?? inCI.lo, hi = inCI.hiPct ?? inCI.hi;
  const withinInSampleCI = hoDiff >= lo && hoDiff <= hi;

  // §15.5 asymmetry (confirmation-time only): the winning cohort's holdout asymmetry must remain favorable.
  let asymmetry = null;
  if (confirmationTime && holdoutContrast && holdoutContrast.asymmetry) {
    const winnerLabel = inDiff >= 0 ? holdoutContrast.cellA.label : holdoutContrast.cellB.label;
    const a = holdoutContrast.asymmetry[winnerLabel];
    asymmetry = a ? a.favorable : null;
  }
  const asymmetryOk = confirmationTime ? asymmetry === true : true;

  const pass = directionAgrees && withinInSampleCI && asymmetryOk;
  return {
    finalVerdict: pass ? 'CONFIRMED' : 'DEAD',
    applied: true,
    criteria: { directionAgrees, withinInSampleCI, asymmetry: confirmationTime ? asymmetry : 'n/a (touch-time)' },
    inSampleDiff: inDiff, inSampleCI: { lo, hi }, holdoutDiff: hoDiff,
    reason: pass
      ? 'holdout direction agrees, point estimate within in-sample 90% CI, asymmetry favorable — CONFIRMED.'
      : `holdout failed (${!directionAgrees ? 'direction disagrees; ' : ''}${!withinInSampleCI ? 'point outside in-sample CI; ' : ''}${!asymmetryOk ? 'asymmetry not favorable; ' : ''}) — DEAD under single-open (no re-test).`,
  };
}
