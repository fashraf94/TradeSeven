// api/_utils/learning/measureCorpus.js
//
// Agent Learning System — L1 Foundation. The M1–M9 MEASUREMENT HARNESS.
//
// This is the aggregation companion the pre-flight check names but is not
// (preflightReceiptCheck.js: "it is NOT the M1–M9 harness"). It answers the
// predicate / data-quality questions the D1/D2/D3 contracts have been guessing
// at, by aggregating over the CAPTURED receipt corpus.
//
// HARD BOUNDARY — OUTCOME-BLIND, ABSOLUTELY (mirrors the receipt's own contract):
// it reads ONLY predicate class labels, null rates, staleness, provenance, and
// opportunity counts. NO return, regret, contrast, effect, P&L, exit price, or
// win/loss is read, computed, stored, or referenced — the receipt schema carries
// no such field (learningSchemas.js), so this is structural, not merely a promise.
//
// PURE + READ-ONLY: no Firestore I/O, no writes, no side effects, no clock/random
// (all timestamps come from the receipts). The thin DB runner
// (scripts/measure-l1-corpus.js) fetches the corpus and calls measureCorpus().
//
// CLASSIFIER REUSE (BUILD_RULES §4 — never copy detector/scoring logic): the D2
// and D3 class computations delegate to the frozen pure classifiers in
// detectorClassifiers.js. M1–M3 read the STORED D1 dual-rule labels off the
// receipt (measuring what capture actually wrote); a capture-consistency guard
// (dataQuality) optionally re-derives them to detect drift.
//
// EVIDENCE DENOMINATOR (L1 Capture — exclude non-evidence agents): every metric
// computes over receipts positively labelled `evidenceClass === 'live_agent'`.
// cpu / training / unknown (and legacy unlabelled) receipts are EXCLUDED and
// counted separately — reported, never silently dropped.

import {
  classifyD1,
  classifyD1DrAbstain,
  classifyD2,
  classifyD3Predicate,
  D1_CLASSES,
  D2_CLASSES,
  D1_DR_NULL_REASONS,
  D3_COUNTING_SCOPES,
} from './detectorClassifiers.js';
import { D2_THRESHOLDS } from './constructThresholds.js';

const MS_PER_MIN = 60_000;
const MS_PER_HOUR = 3_600_000;

// The candidate W grid for M8, in MINUTES. W is UNCALIBRATED and INJECTED
// (detectorClassifiers.js: "NOT CALIBRATED — injected, REQUIRED. Never
// hardcode/derive."); the real P-W-GRID is a contract-owned set, absent from the
// codebase by design. This default is a measurement convenience only — override
// via opts.wGridMinutes — and is reported as such, never as a calibration.
export const DEFAULT_W_GRID_MINUTES = Object.freeze([5, 10, 15, 20, 30, 45, 60]);

// Staleness horizons the report tabulates exceedance against (minutes).
const STALENESS_HORIZONS_MIN = Object.freeze([15, 30, 45]);

// ── tiny pure utilities (no domain logic; not a scoring copy) ─────────────────

/** epoch-ms from a Firestore Timestamp / ISO string / number; else null. */
export function toMillis(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v?.toMillis === 'function') {
    const ms = v.toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof v?.toDate === 'function') {
    const d = v.toDate();
    return d instanceof Date && Number.isFinite(d.getTime()) ? d.getTime() : null;
  }
  if (typeof v === 'string') {
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

const share = (num, den) => (den > 0 ? num / den : null);

/** Count map keyed by a getter; null/undefined bucketed under 'null'. */
export function distribution(items, getter) {
  const out = {};
  for (const it of items) {
    const k = getter(it);
    const key = k === null || k === undefined ? 'null' : String(k);
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

/** Linear-interpolation quantile over a numeric array (NOT mutated). q in [0,1]. */
export function quantile(values, q) {
  const xs = values.filter((v) => typeof v === 'number' && Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (xs.length === 0) return null;
  if (xs.length === 1) return xs[0];
  const pos = (xs.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return xs[lo];
  return xs[lo] + (xs[hi] - xs[lo]) * (pos - lo);
}

const median = (values) => quantile(values, 0.5);

export function mean(values) {
  const xs = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Sample standard deviation (n−1). null if fewer than 2 finite values. */
export function sampleStd(values) {
  const xs = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (xs.length < 2) return null;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const ss = xs.reduce((a, b) => a + (b - m) * (b - m), 0);
  return Math.sqrt(ss / (xs.length - 1));
}

/**
 * Standardized mean difference (Cohen's d, pooled). Returns null when either
 * group is too thin (< 2) to have a variance — never fabricates a number.
 */
export function standardizedMeanDiff(a, b) {
  const xa = a.filter((v) => typeof v === 'number' && Number.isFinite(v));
  const xb = b.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (xa.length < 2 || xb.length < 2) return null;
  const ma = mean(xa);
  const mb = mean(xb);
  const sa = sampleStd(xa);
  const sb = sampleStd(xb);
  const pooled = Math.sqrt(((xa.length - 1) * sa * sa + (xb.length - 1) * sb * sb) / (xa.length + xb.length - 2));
  if (!(pooled > 0)) return null;
  return (ma - mb) / pooled;
}

// ── field accessors (all OUTCOME-BLIND — predicate/class/provenance only) ─────

const pcIn = (r) => r?.predicateClassification?.symbolIn ?? {};
const piIn = (r) => r?.predicateInputs?.symbolIn ?? {};
const piOut = (r) => r?.predicateInputs?.symbolOut ?? {};

// ── M1 — D1 class distribution, three rules side by side ──────────────────────
// Reads the STORED labels d1ClassAsSpecced / d1ClassDrAbstain. The third column
// (abstain-only-on-blue-sky) is derived offline from the stored abstain label +
// drNullReason: UNSCORABLE on an 'ambiguous' null, otherwise the abstain label.
export function thirdRuleClass(pc) {
  if (pc?.drNullReason === D1_DR_NULL_REASONS.AMBIGUOUS) return D1_CLASSES.UNSCORABLE;
  return pc?.d1ClassDrAbstain ?? null;
}

const D1_ORDER = [D1_CLASSES.EXTENDED, D1_CLASSES.ROOM, D1_CLASSES.INDETERMINATE, D1_CLASSES.UNSCORABLE];

function d1Column(entries, getLabel) {
  const counts = {};
  for (const k of D1_ORDER) counts[k] = 0;
  let other = 0;
  for (const e of entries) {
    const lbl = getLabel(e);
    if (lbl == null) { other += 1; continue; }
    if (lbl in counts) counts[lbl] += 1;
    else other += 1;
  }
  const total = entries.length;
  const shares = {};
  for (const k of D1_ORDER) shares[k] = share(counts[k], total);
  // Gate: UNSCORABLE ≤ 0.15 AND INDETERMINATE ≤ 0.40 (coverage gates).
  const uns = shares[D1_CLASSES.UNSCORABLE];
  const ind = shares[D1_CLASSES.INDETERMINATE];
  const clearsGates = uns !== null && ind !== null ? uns <= 0.15 && ind <= 0.40 : null;
  return { counts, shares, other, clearsGates };
}

function computeM1(entries) {
  return {
    n: entries.length,
    asSpecced: d1Column(entries, (e) => e.pc.d1ClassAsSpecced),
    drAbstain: d1Column(entries, (e) => e.pc.d1ClassDrAbstain),
    abstainBlueSkyOnly: d1Column(entries, (e) => thirdRuleClass(e.pc)),
  };
}

// ── M2 — dR null decomposition ────────────────────────────────────────────────
function computeM2(entries) {
  const nulls = entries.filter((e) => e.pi.distanceToResistancePct === null);
  const byReason = distribution(nulls, (e) => e.pc.drNullReason);
  return {
    n: nulls.length,
    nEntries: entries.length,
    drNullShareOfEntries: share(nulls.length, entries.length),
    byReason,
    blueSkyShare: share(byReason[D1_DR_NULL_REASONS.BLUE_SKY] || 0, nulls.length),
    ambiguousShare: share(byReason[D1_DR_NULL_REASONS.AMBIGUOUS] || 0, nulls.length),
    // 'present' among dR-null entries would be a capture defect — surfaced, not hidden.
    presentAmongNulls: byReason[D1_DR_NULL_REASONS.PRESENT] || 0,
  };
}

// ── M3 — asymmetric-evidence check ────────────────────────────────────────────
// EXTENDED rate under the abstain rule, split by drNullReason group. blue_sky has
// 2 available markers (2-of-2 needed); present has 3 (2-of-3). A lower bar for the
// blue-sky population would show as a differential EXTENDED rate.
function extendedRateFor(entries, reason) {
  const group = entries.filter((e) => e.pc.drNullReason === reason);
  const ext = group.filter((e) => e.pc.d1ClassDrAbstain === D1_CLASSES.EXTENDED).length;
  return { n: group.length, extended: ext, extendedRate: share(ext, group.length) };
}

function computeM3(entries) {
  return {
    n: entries.length,
    blueSky: extendedRateFor(entries, D1_DR_NULL_REASONS.BLUE_SKY), // 2-of-2
    present: extendedRateFor(entries, D1_DR_NULL_REASONS.PRESENT), // 2-of-3
    ambiguous: extendedRateFor(entries, D1_DR_NULL_REASONS.AMBIGUOUS), // abstains too; reported for completeness
  };
}

// ── M4 — predicate staleness distribution ─────────────────────────────────────
function computeM4(entries) {
  const all = entries
    .map((e) => e.pc.predicateStalenessMs)
    .filter((v) => typeof v === 'number' && Number.isFinite(v));
  const negatives = all.filter((v) => v < 0);
  const exceed = {};
  for (const m of STALENESS_HORIZONS_MIN) {
    const thresh = m * MS_PER_MIN;
    exceed[`${m}min`] = share(all.filter((v) => v > thresh).length, all.length);
  }
  return {
    n: all.length,
    nEntries: entries.length,
    nullStalenessShare: share(entries.length - all.length, entries.length),
    medianMs: median(all),
    p90Ms: quantile(all, 0.9),
    maxMs: all.length ? Math.max(...all) : null,
    minMs: all.length ? Math.min(...all) : null,
    // Clock-skew: a small negative share is expected; a large one is a bug.
    negativeShare: share(negatives.length, all.length),
    negativeCount: negatives.length,
    exceedShare: exceed, // share with staleness strictly greater than 15/30/45 min
  };
}

// ── M5 — staleness × class (validity threat) ──────────────────────────────────
// Median staleness within each D1 class (as-specced — the rule the ROOM arm is
// built from). SMD(EXTENDED, ROOM) when both groups are thick enough; else medians
// only (the flag says which).
function classStaleness(entries, cls) {
  const vals = entries
    .filter((e) => e.pc.d1ClassAsSpecced === cls)
    .map((e) => e.pc.predicateStalenessMs)
    .filter((v) => typeof v === 'number' && Number.isFinite(v));
  return { n: vals.length, medianMs: median(vals), meanMs: mean(vals), stdMs: sampleStd(vals), _vals: vals };
}

function computeM5(entries, opts = {}) {
  const minPerGroupForSmd = opts.minPerGroupForSmd ?? 8;
  const perClass = {};
  for (const cls of D1_ORDER) {
    const c = classStaleness(entries, cls);
    perClass[cls] = { n: c.n, medianMs: c.medianMs, meanMs: c.meanMs, stdMs: c.stdMs };
  }
  const ext = classStaleness(entries, D1_CLASSES.EXTENDED);
  const room = classStaleness(entries, D1_CLASSES.ROOM);
  const smd = standardizedMeanDiff(ext._vals, room._vals);
  const smdReliable = ext._vals.length >= minPerGroupForSmd && room._vals.length >= minPerGroupForSmd && smd !== null;
  return {
    n: entries.length,
    perClass,
    smdExtendedVsRoom: smd,
    smdReliable,
    smdBasis: { extendedN: ext._vals.length, roomN: room._vals.length, minPerGroupForSmd },
  };
}

// ── M6 — symbol-hour clustering ───────────────────────────────────────────────
function computeM6(entries) {
  const keyed = entries.map((e) => e.pc.symbolHourKey).filter((k) => k != null);
  const counts = {};
  for (const k of keyed) counts[k] = (counts[k] || 0) + 1;
  const distinctKeys = Object.keys(counts).length;
  const sizes = Object.values(counts);
  const sharedEntries = sizes.filter((c) => c >= 2).reduce((a, c) => a + c, 0);
  // Histogram of cluster sizes: { "1": nKeysOfSize1, "2": ..., ... }.
  const sizeHistogram = {};
  for (const c of sizes) sizeHistogram[String(c)] = (sizeHistogram[String(c)] || 0) + 1;
  return {
    n: entries.length,
    nWithKey: keyed.length,
    nullKeyShare: share(entries.length - keyed.length, entries.length),
    distinctKeys,
    maxClusterSize: sizes.length ? Math.max(...sizes) : 0,
    sharedKeyShare: share(sharedEntries, keyed.length), // entries sharing a key with ≥1 other
    sizeHistogram,
  };
}

// ── M7 — D2 confirmation, entry-weighted ──────────────────────────────────────
// upDayVolRatio pass rate (≥ 1.2). D2 UNSCORABLE share via the FROZEN classifyD2
// (intraday-placeholder rule applied). dataMode === 'intraday' share.
function computeM7(entries) {
  const uvVals = entries.map((e) => e.pi.upDayVolRatio);
  const uvNonNull = uvVals.filter((v) => typeof v === 'number' && Number.isFinite(v));
  const uvPass = uvNonNull.filter((v) => v >= D2_THRESHOLDS.upDayVolRatioGte).length;

  let d2Unscorable = 0;
  let d2Confirmed = 0;
  const d2ClassCounts = {};
  for (const e of entries) {
    const cls = classifyD2({
      volumeRatio: e.pi.volumeRatio,
      upDayVolRatio: e.pi.upDayVolRatio,
      macdAboveSignal: e.pi.macdAboveSignal,
      macdFreshBullishCross: e.pi.macdFreshBullishCross,
      dataMode: e.pi.dataMode,
    }).class;
    d2ClassCounts[cls] = (d2ClassCounts[cls] || 0) + 1;
    if (cls === D2_CLASSES.UNSCORABLE) d2Unscorable += 1;
    if (cls === D2_CLASSES.CONFIRMED) d2Confirmed += 1;
  }

  const intraday = entries.filter((e) => e.pi.dataMode === 'intraday').length;
  return {
    n: entries.length,
    upDayVolRatio: {
      threshold: D2_THRESHOLDS.upDayVolRatioGte,
      nNonNull: uvNonNull.length,
      nNull: entries.length - uvNonNull.length,
      passRateOfNonNull: share(uvPass, uvNonNull.length),
      passRateOfAll: share(uvPass, entries.length),
    },
    d2ClassCounts,
    d2UnscorableShare: share(d2Unscorable, entries.length),
    d2ConfirmedShare: share(d2Confirmed, entries.length),
    intradayShare: share(intraday, entries.length),
  };
}

// ── M8 — D3 opportunity counts ────────────────────────────────────────────────
// regime distribution; chop+churn opportunities per battle-day per candidate W
// (frozen scope: same agent, same battle, strictly-prior by receiptSeq); span2
// (t_i − t_(i−2)); trades[] truncation rate.
function buildSwaps(live) {
  // Each live receipt is one decision/swap. Outcome-blind fields only.
  return live.map((r) => ({
    agentId: r?.agentId ?? null,
    battleId: r?.battleId ?? null,
    battleDay: r?.battleDay ?? null,
    timestamp: toMillis(r?.timestamp),
    receiptSeq: typeof r?.receiptSeq === 'number' ? r.receiptSeq : null,
    exitReason: r?.exitReason ?? null,
    outgoingRegime: piOut(r).regime ?? null,
  }));
}

function computeM8(live, entries, opts = {}) {
  const wGridMinutes = opts.wGridMinutes ?? DEFAULT_W_GRID_MINUTES;
  const countingScope = opts.countingScope ?? D3_COUNTING_SCOPES.SAME_AGENT_SAME_BATTLE;

  // regime distribution — the D3 chop input is the OUTGOING (symbolOut) regime.
  const regimeOut = distribution(live, (r) => piOut(r).regime);
  const regimeIn = distribution(entries, (e) => e.pi.regime);
  const choppyOut = regimeOut.choppy || 0;
  const totalRegimeOut = live.filter((r) => piOut(r).regime != null).length;

  // opportunities per candidate W.
  const swaps = buildSwaps(live);
  const decidable = swaps.filter((s) => typeof s.timestamp === 'number' && Number.isFinite(s.timestamp));
  const battleDayKey = (s) => `${s.battleId}|${s.battleDay}`;
  const distinctBattleDays = new Set(decidable.map(battleDayKey)).size;

  const perW = wGridMinutes.map((min) => {
    const windowMs = min * MS_PER_MIN;
    let opportunities = 0;
    let chopCount = 0;
    let churnStateCount = 0;
    for (const decision of decidable) {
      const res = classifyD3Predicate({
        outgoingRegime: decision.outgoingRegime,
        decision,
        priorSwaps: swaps, // classifier scopes to same-agent/same-battle + strictly-prior
        windowMs,
        countingScope,
      });
      if (res.chop) chopCount += 1;
      if (res.churnState) churnStateCount += 1;
      if (res.opportunity) opportunities += 1;
    }
    return {
      windowMinutes: min,
      opportunities,
      chopCount,
      churnStateCount,
      opportunitiesPerBattleDay: share(opportunities, distinctBattleDays),
    };
  });

  // span2: within each (agent, battle) swap sequence ordered by receiptSeq, the
  // gap t_i − t_(i−2). Feeds W selection (how fast do 2 swaps stack up?).
  const seqGroups = {};
  for (const s of decidable) {
    if (s.receiptSeq == null) continue;
    const key = `${s.agentId}|${s.battleId}`;
    (seqGroups[key] ||= []).push(s);
  }
  const span2 = [];
  for (const arr of Object.values(seqGroups)) {
    arr.sort((a, b) => a.receiptSeq - b.receiptSeq);
    for (let i = 2; i < arr.length; i++) {
      const d = arr[i].timestamp - arr[i - 2].timestamp;
      if (Number.isFinite(d)) span2.push(d);
    }
  }

  // trades[] truncation: tradeCountAtDecision > tradesLenAtDecision.
  let truncated = 0;
  let truncDen = 0;
  for (const r of live) {
    const tc = r?.swapContext?.tradeCountAtDecision;
    const tl = r?.swapContext?.tradesLenAtDecision;
    if (typeof tc === 'number' && typeof tl === 'number') {
      truncDen += 1;
      if (tc > tl) truncated += 1;
    }
  }

  return {
    n: live.length,
    regime: {
      symbolOut: regimeOut,
      symbolIn: regimeIn,
      choppyPresent: choppyOut > 0,
      choppyShareOfLegsWithRegime: share(choppyOut, totalRegimeOut),
    },
    windowGridMinutes: wGridMinutes,
    countingScope,
    distinctBattleDays,
    perW,
    span2: {
      n: span2.length,
      medianMs: median(span2),
      p90Ms: quantile(span2, 0.9),
      minMs: span2.length ? Math.min(...span2) : null,
      maxMs: span2.length ? Math.max(...span2) : null,
    },
    truncation: {
      n: truncDen,
      truncatedCount: truncated,
      truncationRate: share(truncated, truncDen),
    },
  };
}

// ── M9 — version-stamp & provenance availability ──────────────────────────────
const VERSION_KEYS = Object.freeze([
  'detectorVersion',
  'evaluationSpecVersion',
  'calibrationManifestVersion',
  'leanRenderConfigVersion',
  'archetypeIntegrityMode', // the one live stamp in L1
  'ruleLibraryVersion',
  'archetypeVersion',
  'regimeClassifierVersion',
]);

function computeM9(live, entries) {
  const versions = {};
  for (const k of VERSION_KEYS) {
    const nonNull = live.filter((r) => r?.versions?.[k] != null);
    versions[k] = {
      nonNullCount: nonNull.length,
      nonNullShare: share(nonNull.length, live.length),
      distinctValues: [...new Set(nonNull.map((r) => String(r.versions[k])))].slice(0, 8),
    };
  }
  return {
    n: live.length,
    nEntries: entries.length,
    versions,
    entrySnapshotSource: distribution(entries, (e) => e.pc.entrySnapshotSource),
    entryAtrSource: distribution(live, (r) => r?.entryAtrSource),
    // Corpus scope note (archetype-agnostic in practice): identity vs version.
    archetype: distribution(live, (r) => r?.archetype),
    archetypeVersionNonNull: live.filter((r) => r?.versions?.archetypeVersion != null).length,
  };
}

// ── capture-consistency guard (data quality — NOT a metric) ───────────────────
// Re-derive the D1 dual-rule labels from the STORED raw predicate inputs and
// compare to the STORED labels. A mismatch means the captured label drifted from
// the frozen classifier — a corpus-integrity signal, outcome-blind.
function computeConsistency(entries) {
  let asSpeccedMismatch = 0;
  let drAbstainMismatch = 0;
  for (const e of entries) {
    const inputs = {
      bbPercentB: e.pi.bbPercentB,
      distanceToResistancePct: e.pi.distanceToResistancePct,
      distTo52wkHigh: e.pi.distTo52wkHigh,
    };
    if (e.pc.d1ClassAsSpecced != null && classifyD1(inputs).class !== e.pc.d1ClassAsSpecced) asSpeccedMismatch += 1;
    if (e.pc.d1ClassDrAbstain != null && classifyD1DrAbstain(inputs).class !== e.pc.d1ClassDrAbstain) drAbstainMismatch += 1;
  }
  return {
    n: entries.length,
    d1AsSpeccedMismatch: asSpeccedMismatch,
    d1DrAbstainMismatch: drAbstainMismatch,
    clean: asSpeccedMismatch === 0 && drAbstainMismatch === 0,
  };
}

/**
 * Aggregate the M1–M9 measurement over a captured receipt corpus.
 *
 * @param {Array<Object>} receipts  captured receipt docs (any evidenceClass).
 * @param {Object} [opts]
 * @param {number[]} [opts.wGridMinutes]      M8 candidate W grid (minutes). Injected.
 * @param {string}  [opts.countingScope]      M8 D3 scope; default SAME_AGENT_SAME_BATTLE.
 * @param {number}  [opts.minPerGroupForSmd]  M5 min per-group N to trust the SMD (default 8).
 * @returns {Object} { meta, m1..m9, dataQuality } — every metric carries its own N.
 */
export function measureCorpus(receipts, opts = {}) {
  const all = Array.isArray(receipts) ? receipts : [];

  // Evidence partition — live_agent is the only evidence class.
  const live = [];
  const excludedByClass = {};
  for (const r of all) {
    if (r?.evidenceClass === 'live_agent') live.push(r);
    else {
      const c = r?.evidenceClass ?? 'unknown';
      excludedByClass[c] = (excludedByClass[c] || 0) + 1;
    }
  }

  // Entry legs: symbolIn side with role === 'entry' (the D1 signal of record).
  // A live receipt whose symbolIn role isn't 'entry' is a role anomaly (surfaced).
  const entries = [];
  let roleAnomalies = 0;
  for (const r of live) {
    const pc = pcIn(r);
    if (pc?.role === 'entry') entries.push({ r, pc, pi: piIn(r) });
    else roleAnomalies += 1;
  }

  const meta = {
    totalReceipts: all.length,
    liveAgentReceipts: live.length,
    excludedCount: all.length - live.length,
    excludedByClass,
    entryLegs: entries.length,
    roleAnomalies,
  };

  return {
    meta,
    m1: computeM1(entries),
    m2: computeM2(entries),
    m3: computeM3(entries),
    m4: computeM4(entries),
    m5: computeM5(entries, opts),
    m6: computeM6(entries),
    m7: computeM7(entries),
    m8: computeM8(live, entries, opts),
    m9: computeM9(live, entries),
    dataQuality: computeConsistency(entries),
  };
}
