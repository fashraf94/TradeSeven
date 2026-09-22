// api/_utils/intraday/validator.js
//
// Intraday Data — Build 1, contract §10.2–§10.5: the bar-derived reference
// VWAP, coverage, alignment, the series metrics and the evaluation-linked
// metrics, and the reported document. PURE, no Date.now().
//
//   refVWAP(t) = Σ(HLC3 × volume) / Σ volume over 1-minute bars with
//                start + 60_000 ≤ t                                   (§10.2)
//   quoteCumulativeVolumeRatio = Σ(bar volume) / the last accepted quote's
//   cumulative session volume, a DIAGNOSTIC (A5); barsMissing decides coverage
//   per log entry: estimateCutoff (null → excluded, cutoff_unconfirmed);
//     referenceCutoff = end of the last completed bar ≤ estimateCutoff;
//     alignmentLagMs; comparisonResidual = estimate − refVWAP(referenceCutoff);
//     price-source residual = price − refClose(referenceCutoff), separate  (§10.3)
//   closeQualified is CHECKED, not merely recorded: unqualified series are
//   excluded from every qualification metric                        (§10.2/§6.7)
//   `unavailable` names a reason for every metric with no denominator —
//   never a zero                                                     (§10.5)
//
// THE WINDOW IS THE GRADED SESSION'S, NOT THE GRADER'S (calcVersion 2).
// calcVersion 2 moved the session for the estimate, the buckets, seeding and
// validation to the continuous session, 09:30–15:59 (§15 item 2). A session
// COLLECTED under calcVersion 1 was collected against the old window — through
// the 16:00 row — so grading it against the new one would compare a v1 series
// to a v2 reference and report the difference as error. The window is
// therefore chosen from the calcVersion stamped on the session's own LOG
// ENTRIES (§7.1), not from the validator's current constant. A symbol-session
// whose entries carry more than one calcVersion straddles the change and
// cannot be graded against either window: it is marked `calc_version_mixed`
// and excluded from qualification.

import { sessionKeys, BUCKET_MS } from './buckets.js';
import { barTimeMs } from './seed.js';
import { stepSma, stepMacd, SMA_PERIOD } from './stepIndicators.js';
import { strikeFromView } from './view.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
export const BAR_MS = 60_000;
export const LAG_BINS = Object.freeze([0, 60_000, 120_000, 300_000, 600_000]);

/** The calcVersion from which the reference window is the continuous session. */
export const CONTINUOUS_SESSION_CALC_VERSION = 2;

/**
 * §10.2 — the START of the last 1-minute bar the reference window includes.
 *
 * calcVersion 1: the calendar close itself, so the vendor's 16:00 row (which
 * carries the closing auction — 19.1 M shares on the founder's AAPL fixture)
 * is part of the reference. calcVersion 2: 15:59, so it is not. On an early
 * close the same rule gives 12:59.
 */
export function lastReferenceBarStartMs(session, sessionCalcVersion) {
  return sessionCalcVersion >= CONTINUOUS_SESSION_CALC_VERSION ? session.closeMs - BAR_MS : session.closeMs;
}

/**
 * §10.2 / §10.7 — the calcVersion a symbol-session was COLLECTED under, read
 * off its own log entries. `mixed` when the entries straddle a bump.
 */
export function sessionCalcVersionOf(log, fallback) {
  const seen = [...new Set((Array.isArray(log) ? log : []).map((e) => e?.calcVersion).filter(isNum))].sort((a, b) => a - b);
  if (!seen.length) return { calcVersion: fallback, mixed: false, versions: [], source: 'fallback' };
  // A mixed session is graded against the NEWER window so the metrics are at
  // least internally consistent, but it never qualifies — see `qualification`.
  return { calcVersion: seen[seen.length - 1], mixed: seen.length > 1, versions: seen, source: 'log' };
}

/** Sorted, cumulative reference series over the session's 1-minute bars. */
export function buildReferenceSeries(bars, session, { sessionCalcVersion = 1 } = {}) {
  const lastBarStart = lastReferenceBarStartMs(session, sessionCalcVersion);
  const rows = [];
  for (const bar of Array.isArray(bars) ? bars : []) {
    const start = barTimeMs(bar);
    if (start === null || start < session.openMs || start > lastBarStart) continue;
    if (!isNum(bar.close)) continue;
    const vol = isNum(bar.volume) ? bar.volume : 0;
    const hlc3 = isNum(bar.high) && isNum(bar.low) ? (bar.high + bar.low + bar.close) / 3 : bar.close;
    rows.push({ startMs: start, endMs: start + BAR_MS, close: bar.close, hlc3, volume: vol });
  }
  rows.sort((a, b) => a.startMs - b.startMs);
  let cumTPV = 0; let cumVol = 0;
  for (const r of rows) { cumTPV += r.hlc3 * r.volume; cumVol += r.volume; r.cumTPV = cumTPV; r.cumVol = cumVol; r.vwap = cumVol > 0 ? cumTPV / cumVol : null; }
  return rows;
}

/** The last completed bar (start + 60 s ≤ t), or null. */
export function lastCompletedBarAt(series, t) {
  let lo = 0; let hi = series.length - 1; let ans = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (series[mid].endMs <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
  return ans >= 0 ? series[ans] : null;
}

/**
 * §10.2 coverage. Expected bars: every minute from the open to the last bar
 * of the graded session's window — the calendar close under calcVersion 1
 * (the vendor's 16:00 row), 15:59 under calcVersion 2.
 *
 * Addendum A5 — what the ratio is, and what it is not.
 *
 * The contract called this `referenceCoveragePct` = Σ(bar volume) / EOD
 * volume, and gated qualification on it falling below 90 %. There is no EOD
 * volume in build 1 and no unit budgeted to fetch one, so the denominator is
 * the vendor's cumulative session `volume` carried on the LAST QUOTE THE
 * ACCUMULATOR ACCEPTED that day (`quoteCumulativeVolume`). On a 15-minute
 * delayed feed that quote's priceAsOf is ~15 minutes before the last sweep,
 * so the denominator structurally omits the closing auction — 42.9 % of the
 * day on the founder's AAPL fixture. Measured against that fixture the ratio
 * reads 197 %, not 100 %.
 *
 * So the `< 90 %` leg could never fire while the bar series was complete,
 * and could only fire in the inverted case — a vendor `volume` that is not
 * regular-session-cumulative (G7 records this as UNCONFIRMED), which would
 * empty the qualification set on day 1 for a reason that has nothing to do
 * with coverage. It is removed. `coverage` is now decided by `barsMissing`
 * alone, which is the leg that was doing the real work.
 *
 * The ratio is still reported — it is genuinely informative once §15 lands,
 * and a day-2 value far from ~1.97 says the vendor's `volume` is not what
 * G7 assumes — but as a DIAGNOSTIC under an honest name, never as a gate.
 */
export function computeCoverage({ series, session, quoteCumulativeVolume, sessionCalcVersion = 1 }) {
  const lastBarStart = lastReferenceBarStartMs(session, sessionCalcVersion);
  const expected = Math.floor((lastBarStart - session.openMs) / BAR_MS) + 1;
  const present = new Set(series.map((r) => r.startMs));
  let barsMissing = 0;
  const missingStarts = [];
  for (let t = session.openMs; t <= lastBarStart; t += BAR_MS) if (!present.has(t)) { barsMissing += 1; if (missingStarts.length < 50) missingStarts.push(t); }
  const sumVol = series.reduce((a, r) => a + r.volume, 0);
  const denominatorOk = isNum(quoteCumulativeVolume) && quoteCumulativeVolume > 0;
  const ratio = denominatorOk ? sumVol / quoteCumulativeVolume : null;
  // A5: bar completeness decides coverage. Nothing else does.
  const coverage = barsMissing > 0 ? 'partial' : 'full';
  const reason = barsMissing > 0 ? 'bars_missing' : null;
  return {
    // The diagnostic, honestly named and sourced.
    quoteCumulativeVolumeRatio: ratio,
    denominatorSource: denominatorOk ? 'live_v2_last_accepted_volume' : null,
    ratioUnavailableReason: denominatorOk ? null : 'quote_cumulative_volume_unavailable',
    quoteCumulativeVolume: isNum(quoteCumulativeVolume) ? quoteCumulativeVolume : null,
    barsMissing, barsPresent: series.length, barsExpected: expected, sumBarVolume: sumVol,
    coverage, reason, missingStarts,
  };
}

/** §10.3 alignment of every log entry. */
export function alignLogEntries({ log, series, missingStarts = [] }) {
  const missingSet = new Set(missingStarts);
  return (Array.isArray(log) ? log : []).map((e) => {
    const out = { sweepAt: e.sweepAt, priceAsOf: e.priceAsOf, price: e.price, estimate: e.estimate, estimateCutoff: e.estimateCutoff ?? null, strikeKey: e.strikeKey, excluded: null, referenceCutoff: null, alignmentLagMs: null, refVwap: null, comparisonResidual: null, missingBarBefore: false, priceReferenceCutoff: null, refClose: null, priceResidual: null };
    // Price-source residual is aligned on priceAsOf and is independent of the estimate cutoff.
    if (isNum(e.priceAsOf) && isNum(e.price)) {
      const pb = lastCompletedBarAt(series, e.priceAsOf);
      if (pb) { out.priceReferenceCutoff = pb.endMs; out.refClose = pb.close; out.priceResidual = e.price - pb.close; }
    }
    if (!isNum(e.estimateCutoff)) { out.excluded = 'cutoff_unconfirmed'; return out; }
    if (!isNum(e.estimate)) { out.excluded = 'no_estimate'; return out; }
    const bar = lastCompletedBarAt(series, e.estimateCutoff);
    if (!bar || bar.vwap === null) { out.excluded = 'no_reference_bar'; return out; }
    out.referenceCutoff = bar.endMs;
    out.alignmentLagMs = e.estimateCutoff - bar.endMs;
    out.refVwap = bar.vwap;
    out.comparisonResidual = e.estimate - bar.vwap;
    for (let t = bar.endMs; t < e.estimateCutoff; t += BAR_MS) if (missingSet.has(t)) { out.missingBarBefore = true; break; }
    if (out.missingBarBefore) out.excluded = 'missing_bar_before_comparison';
    return out;
  });
}

const p95 = (values) => {
  const v = values.filter(isNum).sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.min(v.length - 1, Math.ceil(0.95 * v.length) - 1)];
};
const lagBin = (lag) => { let bin = LAG_BINS[0]; for (const b of LAG_BINS) if (lag >= b) bin = b; return String(bin); };

/**
 * Reference 5-minute closes keyed by bucket key, from the 1-minute series.
 * Under calcVersion 1 the 16:00 row folds into the last bucket; under
 * calcVersion 2 `buildReferenceSeries` has already dropped it, and the
 * fold-in would be unreachable — it stays as the v1 path.
 */
export function referenceBucketCloses(series, session) {
  const { lastKey } = sessionKeys(session);
  const byKey = new Map();
  for (const r of series) {
    const k = r.startMs === session.closeMs ? lastKey : Math.floor(r.startMs / BUCKET_MS);
    if (k > lastKey) continue;
    const cur = byKey.get(k);
    if (!cur || r.startMs > cur.startMs) byKey.set(k, { key: k, startMs: r.startMs, close: r.close });
  }
  return byKey;
}

/** §10.4 / §10.5 series metrics for one symbol-session. */
export function seriesMetrics({ aligned, ring, series, session, closeQualifiedSeries }) {
  const included = aligned.filter((a) => a.excluded === null);
  const residualsOverPrice = included.map((a) => (isNum(a.price) && a.price > 0 ? Math.abs(a.comparisonResidual) / a.price : null));
  const byLag = {};
  for (const a of included) { const b = lagBin(a.alignmentLagMs); (byLag[b] ||= []).push(a.comparisonResidual); }
  const residualByLagBin = Object.fromEntries(Object.entries(byLag).map(([b, v]) => [b, { n: v.length, p95Abs: p95(v.map(Math.abs)), mean: v.reduce((x, y) => x + y, 0) / v.length }]));
  const priceRes = aligned.filter((a) => isNum(a.priceResidual));

  // Bucket closes vs reference 5-minute closes; SMA20 residual; MACD event agreement — session-only, same keys both sides.
  const ref5 = referenceBucketCloses(series, session);
  const completed = (ring?.buckets || []).filter((b) => b.sessionEtDate === session.etDate && b.status === 'completed' && isNum(b.close)).sort((a, b) => a.key - b.key);
  const closeResiduals = []; const closeResidualsOverPrice = [];
  for (const b of completed) { const r = ref5.get(b.key); if (r) { closeResiduals.push(b.close - r.close); closeResidualsOverPrice.push(Math.abs(b.close - r.close) / r.close); } }
  // SMA20: step both series over the same contiguous keys.
  let ours = stepSma.init([], { period: SMA_PERIOD }); let theirs = stepSma.init([], { period: SMA_PERIOD });
  let oursMacd = stepMacd.init([]); let theirsMacd = stepMacd.init([]);
  const smaResidualsOverPrice = []; const ourEvents = new Set(); const refEvents = new Set();
  let prevKey = null; let qualifiedSoFar = true;
  for (const b of completed) {
    const r = ref5.get(b.key);
    if (!r) { prevKey = null; continue; }
    if (prevKey !== null && b.key !== prevKey + 1) { ours = stepSma.init([], { period: SMA_PERIOD }); theirs = stepSma.init([], { period: SMA_PERIOD }); oursMacd = stepMacd.init([]); theirsMacd = stepMacd.init([]); }
    prevKey = b.key;
    if (b.closeQualified === false) qualifiedSoFar = false;
    ours = stepSma.step(ours, b.close); theirs = stepSma.step(theirs, r.close);
    oursMacd = stepMacd.step(oursMacd, b.close, b.key); theirsMacd = stepMacd.step(theirsMacd, r.close, b.key);
    const o = stepSma.value(ours); const t = stepSma.value(theirs);
    if (o !== null && t !== null && b.closeQualified !== false) smaResidualsOverPrice.push(Math.abs(o - t) / t);
    const om = stepMacd.value(oursMacd); const tm = stepMacd.value(theirsMacd);
    if (om?.event) ourEvents.add(b.key);
    if (tm?.event) refEvents.add(b.key);
  }
  const eventUnion = new Set([...ourEvents, ...refEvents]);
  const eventAgree = [...eventUnion].filter((k) => ourEvents.has(k) && refEvents.has(k)).length;

  const unavailable = {};
  const metric = (name, value, n, reason) => { if (n > 0 && value !== null) return value; unavailable[name] = reason; return null; };
  return {
    comparisons: included.length, excludedByReason: countBy(aligned.filter((a) => a.excluded).map((a) => a.excluded)),
    residualByLagBin,
    p95AbsResidualOverPrice: metric('p95AbsResidualOverPrice', p95(residualsOverPrice), residualsOverPrice.length, 'no_aligned_comparisons'),
    priceResidualP95Abs: metric('priceResidualP95Abs', p95(priceRes.map((a) => Math.abs(a.priceResidual))), priceRes.length, 'no_price_comparisons'),
    bucketCloseP95AbsResidualOverPrice: metric('bucketCloseP95AbsResidualOverPrice', p95(closeResidualsOverPrice), closeResidualsOverPrice.length, 'no_completed_buckets_with_reference'),
    bucketCloseComparisons: closeResiduals.length,
    sma20P95AbsResidualOverPrice: closeQualifiedSeries === false
      ? metric('sma20P95AbsResidualOverPrice', null, 0, 'close_unqualified')
      : metric('sma20P95AbsResidualOverPrice', p95(smaResidualsOverPrice), smaResidualsOverPrice.length, 'no_sma20_comparisons'),
    macdEventAgreement: closeQualifiedSeries === false
      ? metric('macdEventAgreement', null, 0, 'close_unqualified')
      : metric('macdEventAgreement', eventUnion.size ? eventAgree / eventUnion.size : null, eventUnion.size, 'no_macd_events'),
    eventCounts: { ourEvents: ourEvents.size, refEvents: refEvents.size, agreed: eventAgree },
    unavailable,
    closeQualifiedSeries: closeQualifiedSeries !== false && qualifiedSoFar,
  };
}

function countBy(list) { const o = {}; for (const k of list) o[k] = (o[k] || 0) + 1; return o; }

/**
 * §10.4 evaluation-linked metrics for one symbol from its stored views (in
 * evaluatedAt order). `refDevAt(t)` gives the reference deviation at an
 * instant (null when unavailable). The consecutive-strike counter is
 * replayed on both series keyed by strikeKey, firing at `fireTicks`.
 */
export function evaluationMetrics({ views, sym, series, fireTicksOf, nearBand = 0.25 }) {
  const rows = [];
  for (const v of views) {
    const rec = v.symbols?.[sym];
    if (!rec || !isNum(rec.price?.value)) continue;
    const est = strikeFromView(rec, v.presetBand);
    const cutoff = rec.indicators?.vwap?.estimateCutoff ?? null;
    let refDev = null; let excluded = null;
    if (!isNum(cutoff)) excluded = 'cutoff_unconfirmed';
    else { const bar = lastCompletedBarAt(series, cutoff); if (bar && bar.vwap) refDev = ((rec.price.value - bar.vwap) / bar.vwap) * 100; else excluded = 'no_reference_bar'; }
    rows.push({ evalId: v.evalId, battleId: v.battleId, evaluatedAt: v.evaluatedAt, presetId: v.presetId, presetBand: v.presetBand, strikeKey: est.strikeKey, estDev: est.estDev, isEstStrike: est.isVwapStrike, refDev, isRefStrike: refDev !== null && refDev < -v.presetBand, excluded });
  }
  const usable = rows.filter((r) => r.excluded === null && r.estDev !== null);
  const unavailable = {};
  if (!rows.length) return { evaluations: 0, unavailable: { evaluationLinked: 'no_evaluation_evidence' }, rows: [] };
  if (!usable.length) return { evaluations: rows.length, unavailable: { evaluationLinked: countBy(rows.map((r) => r.excluded || 'no_estimate')) }, rows };
  let agree = 0; let falseStrike = 0; let missedStrike = 0; let nearDisagree = 0; let near = 0; let refStrikes = 0;
  for (const r of usable) {
    if (r.isEstStrike === r.isRefStrike) agree += 1;
    if (r.isEstStrike && !r.isRefStrike) falseStrike += 1;
    if (!r.isEstStrike && r.isRefStrike) missedStrike += 1;
    if (r.isRefStrike) refStrikes += 1;
    if (Math.abs(r.refDev - (-r.presetBand)) <= nearBand) { near += 1; if (r.isEstStrike !== r.isRefStrike) nearDisagree += 1; }
  }
  // Replay the consecutive-strike counter on both series per battle, keyed by strikeKey.
  let exitDisagreements = 0; let fires = 0;
  const byBattle = {};
  for (const r of usable) (byBattle[r.battleId] ||= []).push(r);
  for (const list of Object.values(byBattle)) {
    let estCount = 0; let refCount = 0; let lastKey = null;
    for (const r of list.sort((a, b) => a.evaluatedAt - b.evaluatedAt)) {
      const ticks = fireTicksOf(r.presetId);
      if (r.strikeKey === lastKey) continue; // stage-4 rule: the counter advances only on a new strikeKey
      lastKey = r.strikeKey;
      estCount = r.isEstStrike ? estCount + 1 : 0;
      refCount = r.isRefStrike ? refCount + 1 : 0;
      const estFire = estCount >= ticks; const refFire = refCount >= ticks;
      if (estFire || refFire) { fires += 1; if (estFire !== refFire) exitDisagreements += 1; }
      if (estFire) estCount = 0;
      if (refFire) refCount = 0;
    }
  }
  const rate = (num, den, name, reason) => { if (den > 0) return num / den; unavailable[name] = reason; return null; };
  return {
    evaluations: rows.length, usable: usable.length,
    agreement: agree / usable.length,
    falseStrikeRate: rate(falseStrike, usable.filter((r) => r.isEstStrike).length, 'falseStrikeRate', 'no_estimate_strikes'),
    missedStrikeRate: rate(missedStrike, refStrikes, 'missedStrikeRate', 'no_reference_strikes'),
    nearThresholdDisagreement: rate(nearDisagree, near, 'nearThresholdDisagreement', 'no_near_threshold_points'),
    replayedExitDisagreement: rate(exitDisagreements, fires, 'replayedExitDisagreement', 'no_replayed_fires'),
    counts: { agree, falseStrike, missedStrike, near, nearDisagree, fires, exitDisagreements, refStrikes },
    unavailable, rows,
  };
}

/** §10.5 — the per-symbol result. */
export function validateSymbolSession({ sym, bars, session, doc, quoteCumulativeVolume, views, fireTicksOf, calcVersion, policyVersion }) {
  // The window is the GRADED session's, read off its own log entries.
  const graded = sessionCalcVersionOf(doc?.log, calcVersion);
  const sessionCalcVersion = graded.calcVersion;
  const series = buildReferenceSeries(bars, session, { sessionCalcVersion });
  const cov = computeCoverage({ series, session, quoteCumulativeVolume, sessionCalcVersion });
  const aligned = alignLogEntries({ log: doc?.log || [], series, missingStarts: cov.missingStarts });
  const closingUnresolved = (doc?.ring?.buckets || []).some((b) => b.sessionEtDate === session.etDate && b.isLast && b.closeQualified === false)
    || !(doc?.ring?.buckets || []).some((b) => b.sessionEtDate === session.etDate && b.isLast);
  const closeQualifiedSeries = !closingUnresolved && cov.coverage === 'full';
  const s = seriesMetrics({ aligned, ring: doc?.ring, series, session, closeQualifiedSeries });
  const e = evaluationMetrics({ views: views || [], sym, series, fireTicksOf });
  // A session that straddles a calcVersion bump is graded — the numbers are
  // still reported — but never qualified: half its entries were produced
  // against a different window from the one they are compared with.
  const qualification = graded.mixed
    ? { included: false, reason: 'calc_version_mixed' }
    : cov.coverage !== 'full' ? { included: false, reason: cov.reason || cov.coverage } : (closeQualifiedSeries ? { included: true, reason: null } : { included: false, reason: 'close_unqualified' });
  return {
    sym, etDate: session.etDate, calcVersion, policyVersion,
    sessionCalcVersion, calcVersionMixed: graded.mixed, calcVersions: graded.versions, calcVersionSource: graded.source,
    referenceWindow: { openMs: session.openMs, lastBarStartMs: lastReferenceBarStartMs(session, sessionCalcVersion) },
    coverage: {
      // A5: the gate (bar completeness) and the diagnostic (the ratio) are
      // now separate fields with separate names, so neither can be read as
      // the other.
      coverage: cov.coverage, reason: cov.reason,
      barsMissing: cov.barsMissing, barsPresent: cov.barsPresent, barsExpected: cov.barsExpected,
      quoteCumulativeVolumeRatio: cov.quoteCumulativeVolumeRatio,
      denominatorSource: cov.denominatorSource,
      ratioUnavailableReason: cov.ratioUnavailableReason,
    },
    closeQualified: closeQualifiedSeries, qualification,
    series: s, evaluationLinked: e,
    logEntries: aligned.length,
  };
}

/**
 * §10.5 — the reason a qualification metric has no denominator BECAUSE the
 * day qualified nothing. Distinct from the per-metric reasons ("no aligned
 * comparisons", "no MACD events"), which mean the included set exists but is
 * silent on that metric.
 */
export const NO_QUALIFIED_SESSIONS = 'no_qualified_sessions';

/**
 * §10.2 / §10.5 — every reported metric over ONE set of symbol-session
 * results, with `unavailable` naming a reason for each metric that has no
 * denominator (never a zero).
 *
 * Addendum A — review finding R1. The whole metric block is computed here,
 * once, so the qualification aggregate and the all-symbol diagnostic cannot
 * drift apart: `aggregateValidation` calls it twice over two different SETS,
 * never with two different formulas (BUILD_RULES §4 — no local copy of the
 * same computation; §9 — one source).
 *
 * `rows` is the membership decision. It is the only difference between the
 * qualification aggregate and the diagnostic.
 */
function metricsOverResults(rows, { emptyReason }) {
  const unavailable = {};
  const mean = (v) => (v ? v.reduce((a, b) => a + b, 0) / v.length : null);
  const median = (v) => { if (!v) return null; const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const collect = (pick, name, reason) => {
    if (!rows.length) { unavailable[name] = emptyReason; return null; }
    const v = rows.map(pick).filter(isNum);
    if (!v.length) { unavailable[name] = reason; return null; }
    return v;
  };
  const p95s = collect((r) => r.series.p95AbsResidualOverPrice, 'p95AbsResidualOverPrice', 'no_aligned_comparisons');
  const sma = collect((r) => r.series.sma20P95AbsResidualOverPrice, 'sma20P95AbsResidualOverPrice', 'no_sma20_comparisons');
  const macd = collect((r) => r.series.macdEventAgreement, 'macdEventAgreement', 'no_macd_events');
  const cov = collect((r) => r.coverage.quoteCumulativeVolumeRatio, 'quoteCumulativeVolumeRatio', 'quote_cumulative_volume_unavailable');
  const evalRows = rows.map((r) => r.evaluationLinked).filter((e) => e.usable > 0);
  // `reportedAs` is the key the metric appears under in the DOCUMENT, which
  // is not always the key it is read from on the per-symbol row: the row
  // carries `agreement`, the document reports `overallDisagreement`. §10.5
  // says `unavailable` names a reason for every metric with no denominator,
  // and a reason filed under a name the document never prints is not one
  // (BUILD_RULES §9 — the label and its reason come from one source).
  const evalMetric = (key, reason, reportedAs = key) => {
    if (!rows.length) { unavailable[reportedAs] = emptyReason; return null; }
    const v = evalRows.map((e) => e[key]).filter(isNum);
    if (!v.length) { unavailable[reportedAs] = evalRows.length ? reason : 'no_evaluation_evidence'; return null; }
    return mean(v);
  };
  const residualByLagBin = {};
  for (const r of rows) for (const [bin, v] of Object.entries(r.series.residualByLagBin || {})) { const cur = residualByLagBin[bin] || { n: 0, p95Abs: [] }; cur.n += v.n; cur.p95Abs.push(v.p95Abs); residualByLagBin[bin] = cur; }
  for (const bin of Object.keys(residualByLagBin)) residualByLagBin[bin].p95Abs = median(residualByLagBin[bin].p95Abs.filter(isNum));
  const eventCounts = rows.reduce((a, r) => ({ ourEvents: a.ourEvents + (r.series.eventCounts?.ourEvents || 0), refEvents: a.refEvents + (r.series.eventCounts?.refEvents || 0), agreed: a.agreed + (r.series.eventCounts?.agreed || 0), evaluations: a.evaluations + (r.evaluationLinked.evaluations || 0) }), { ourEvents: 0, refEvents: 0, agreed: 0, evaluations: 0 });
  // Called ONCE: `evalMetric` writes into `unavailable`, so a second call
  // would restate the reason as a side effect of formatting the value.
  const agreement = evalMetric('agreement', 'no_usable_evaluations', 'overallDisagreement');
  return {
    sessions: rows.length,
    residualByLagBin,
    p95AbsResidualOverPrice: p95s ? p95(p95s) : null,
    overallDisagreement: agreement === null ? null : 1 - agreement,
    falseStrikeRate: evalMetric('falseStrikeRate', 'no_estimate_strikes'),
    missedStrikeRate: evalMetric('missedStrikeRate', 'no_reference_strikes'),
    nearThresholdDisagreement: evalMetric('nearThresholdDisagreement', 'no_near_threshold_points'),
    replayedExitDisagreement: evalMetric('replayedExitDisagreement', 'no_replayed_fires'),
    sma20P95AbsResidualOverPrice: sma ? p95(sma) : null,
    macdEventAgreement: mean(macd),
    quoteCumulativeVolumeRatio: median(cov),
    eventCounts,
    unavailable,
  };
}

/**
 * §10.5 — the reported document's aggregates over the per-symbol results.
 *
 * ADDENDUM A / REVIEW R1: every QUALIFICATION aggregate counts symbol-sessions
 * with `qualification.included === true` and nothing else.
 *
 * Before this, only SMA20 and the MACD event agreement tested qualification.
 * The residual P95, the evaluation-linked rates, the lag bins and the event
 * counts read every symbol — so a session the §10.2 check had just excluded
 * still moved the number the founder reads as "the VWAP error", and the
 * §10.5 trailing rollup carried it forward. The review reproduced it: adding
 * one excluded mixed-version session took the aggregate
 * `p95AbsResidualOverPrice` from 0.0058 to 1.69 while `symbolsQualified`
 * stayed at 1.
 *
 * The filter is `included`, not `calc_version_mixed`, deliberately and more
 * broadly than the review asked. §10.2 says unqualified series are excluded
 * from EVERY qualification metric, and `included: false` is also how
 * `close_unqualified` and partial coverage are recorded — one membership
 * test, so a new exclusion reason is covered the day it is added rather than
 * the day someone remembers to extend a list of reasons.
 *
 * Per-symbol results are unchanged and still reported in full under
 * `symbols`. The all-symbol numbers survive under `diagnosticAllSymbols`,
 * named for what they are; nothing reads that block — the trailing rollup
 * (validationRunner.js) reads only the top-level qualification aggregate.
 * The census fields (`symbolsValidated`, `symbolsByCalcVersion`,
 * `symbolsCalcVersionMixed`, `lostCoverageByReason`) count every symbol by
 * definition: they exist to say who was left out and why.
 */
export function aggregateValidation(results, { etDate, calcVersion, policyVersion, firstPublishHourUtc, status, unvalidated = [], computedAt }) {
  const syms = Object.values(results);
  const qualified = syms.filter((r) => r.qualification.included);
  const q = metricsOverResults(qualified, { emptyReason: NO_QUALIFIED_SESSIONS });
  const all = metricsOverResults(syms, { emptyReason: 'no_symbols_validated' });
  return {
    etDate, calcVersion, policyVersion, computedAt, status, firstPublishHourUtc: firstPublishHourUtc ?? null,
    symbolsValidated: syms.length, symbolsQualified: qualified.length, unvalidated,
    // §10.7 — which window each symbol-session was graded under, and how many
    // straddled the bump (excluded from qualification, never silently).
    symbolsByCalcVersion: countBy(syms.map((r) => String(r.sessionCalcVersion ?? 'unknown'))),
    symbolsCalcVersionMixed: syms.filter((r) => r.calcVersionMixed === true).length,
    // The exclusion ledger: over EVERY symbol, because its job is to name the
    // ones the aggregate above left out.
    lostCoverageByReason: countBy(syms.filter((r) => r.coverage.coverage !== 'full').map((r) => r.coverage.reason || r.coverage.coverage)),
    // ---- The qualification aggregate (§10.2-included sessions only) ----
    residualByLagBin: q.residualByLagBin,
    p95AbsResidualOverPrice: q.p95AbsResidualOverPrice,
    overallDisagreement: q.overallDisagreement,
    falseStrikeRate: q.falseStrikeRate,
    missedStrikeRate: q.missedStrikeRate,
    nearThresholdDisagreement: q.nearThresholdDisagreement,
    replayedExitDisagreement: q.replayedExitDisagreement,
    sma20P95AbsResidualOverPrice: q.sma20P95AbsResidualOverPrice,
    macdEventAgreement: q.macdEventAgreement,
    quoteCumulativeVolumeRatio: q.quoteCumulativeVolumeRatio,
    eventCounts: q.eventCounts,
    unavailable: q.unavailable,
    // ---- The same metrics over EVERY validated session, for diagnosis only.
    // Never a qualification metric, never read by the trailing rollup. It
    // exists so a day that qualifies nothing still shows its numbers instead
    // of an empty document.
    diagnosticAllSymbols: all,
    symbols: results,
  };
}
