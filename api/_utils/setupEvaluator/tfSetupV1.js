// api/_utils/setupEvaluator/tfSetupV1.js
//
// Measured Trend Evidence, slice 1 (P3) — the pure Trend Follower evaluator:
// entry qualification (evaluateTfEntry) and, separately, the holding
// assessment of the chart leg (evaluateTfHolding), per
// docs/specs/TREND_FOLLOWER_SETUP_DEFINITION_V1.md §1–§5 as clarified by C1
// (founder ruling FD-P3-1, option (a), 28 Oct 2026) on the raw basis
// (FD-P3-2).
//
// Pure: a function of the evidence it is handed and the frozen threshold
// object. No clock, no I/O, no fetch, no store. It imports thresholds.js, the
// shared volume policy, and calculateSMA / calculateATR from
// api/_utils/technicalCalculations.js (pure math) and nothing else. It never
// executes, fires or suppresses anything: `unknown` forbids entry and is never
// a protective signal; a chartLeg result alone never decides a holding policy.
//
// THE STRATEGY CARD for tf-setup-v1 (the 28 Oct 2026 review decision report,
// §2 "Q1 — the strategy card", reproduced verbatim):
//
// | Element | `tf-setup-v1` (definition §1–§5, §8) | Constitution kernel it expresses | Class |
// |---|---|---|---|
// | Purpose | A measurable gate: is this name a Trend Follower entry setup as of the last completed session, and is a held name's chart leg intact | sourceOfEdge "join confirmed strength, never predict turns" | identity (what the gate is for) |
// | Market and instruments | US-listed equities in the BaggerBomb universe, EODHD daily bars; crypto out of slice 1 | — | implementation mapping (P3 Phase 0) |
// | Horizon | Completed daily bars only; verdict dated `asOf` the last completed session; never intraday (R9). Idea review windows H1–H4 live in the same document but are not slice 1's | timeDoctrine "days, not quarters" | fixed structure |
// | Regime | uptrend = C > SMA20 > SMA50 and SMA50 rising over 5 bars; downtrend mirror; else no-trend. Entries exist only in uptrend | coreRefusal "never buy weakness"; evidencePriority 1 (own chart) | founder configuration (S1, S2, S6) |
// | Pattern A, breakout | C ≥ 20-bar swing high and V ≥ 1.5 × 20-bar average volume | errorPreference "late and confirmed"; evidencePriority 5 (volume confirmation) | founder configuration (S3, S5, S7) |
// | Pattern B, pullback-and-resume | a low of the last 3 bars touched or crossed SMA20, and C > SMA20; no volume rule | evidencePriority 1 | founder configuration (S8, S9) |
// | Extension limit | C ≤ SMA20 + 2.0 × ATR14, else `invalid(extended)` | evidencePriority 3 (band fit); riskDoctrine "raise its own bar" | founder configuration (S4, S10) |
// | Holding checks (chart leg) | close below SMA50; close below the anchor swing low recorded at activation; regime flip to downtrend | holding nuance: "one breaks → hold and surface it"; coreRefusal "never hold a broken chart" | fixed structure; the anchor is ID-1's record |
// | Required evidence | nine facts, each `{source, asOf}`; `unknown` when missing; verdict lists what is missing | — | fixed structure (§1, §5) |
// | Known exclusions | no sector leg (the constitution's second leg stays in the prompt's regime context; a typed sector evaluator is deferred); no fundamentals (tie-break only in the constitution, absent here by design); no stall rotation (the platform's stagnation rule and forced rotation); no execution or protective authority; no intraday confirmation (NOW's 15-minute condition is the Intraday arc's) | — | boundary |
//
// THE PHASE 0 FACT MAPPING (definition line 19 delegates it here; recorded in
// SEMANTICS_NOTES): bars newest first, bar 0 = asOf. C = bars[0].close (raw).
// SMA_fast = calculateSMA(closes[0..19], 20); SMA_slow = calculateSMA(closes[0..49],
// 50); SMA_slow_5ago = calculateSMA(closes[5..54], 50). swingHigh / swingLow =
// the max high / min low over bars 1..20 with the date of the extreme (the
// most recent bar on a tie); computed here, never through the pivot detector
// findSwingHighsLows, which answers a different question. ATR =
// calculateATR(bars 0..14, 14).value, the mean of the 14 true ranges of bars
// 0..13. V and V_avg per the shared volume policy (bars 0 and 1..20). A price
// fact is null when any bar it reads has a null or non-positive price input,
// or when fewer bars exist than it needs. Every comparison uses the recorded
// factsUsed values, and the verdict derives from `checks` and `patterns` and
// nothing else (BUILD_RULES §9): deriveEntryVerdict / deriveChartLeg are the
// derivations, exported so a test can recompute a record's verdict from its
// own checks.
//
// Records carry no owner and no raw battle id.

import { TF_SETUP_V1_THRESHOLDS as T, MIN_COMPLETED_BARS, describeRuleSet } from './thresholds.js';
import { classifyVolume } from './volumePolicy.js';
import { calculateSMA, calculateATR } from '../technicalCalculations.js';

export const FACT_NAMES = Object.freeze(['C', 'SMA_fast', 'SMA_slow', 'SMA_slow_5ago', 'swingHigh', 'swingLow', 'ATR', 'V', 'V_avg']);
export const REGIME_FACTS = Object.freeze(['C', 'SMA_fast', 'SMA_slow', 'SMA_slow_5ago']);
/** Pattern order: the first satisfied pattern names the verdict's `pattern`. */
export const PATTERN_ORDER = Object.freeze(['breakout', 'pullback_resume']);
export const PATTERN_CHECKS = Object.freeze({
  breakout: Object.freeze(['breakout_close', 'breakout_volume']),
  pullback_resume: Object.freeze(['pullback_touch', 'pullback_close']),
});
export const REGIME_CHECKS = Object.freeze(['regime_stack', 'slow_rising', 'regime_stack_down', 'slow_falling']);
export const HOLDING_CHECKS = Object.freeze(['close_below_slow', 'structure_break', 'regime_flip']);

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isPrice = (v) => isNum(v) && v > 0;

// ---------------------------------------------------------------- facts

/** `{from, to}` dates of bars[a..b] (newest first), or null when the bars do not reach. */
function windowOf(bars, a, b) {
  if (bars.length <= b) return null;
  return { from: bars[b].date, to: bars[a].date };
}

/** The closes of bars[a..b] when every one is a price; else null. */
function priceSlice(bars, field, a, b) {
  if (bars.length <= b) return null;
  const out = [];
  for (let i = a; i <= b; i++) {
    const v = bars[i][field];
    if (!isPrice(v)) return null;
    out.push(v);
  }
  return out;
}

/** The dated extreme of `field` over bars[a..b] (most recent bar wins a tie), or null. */
function extremeOf(bars, field, a, b, pick) {
  const vals = priceSlice(bars, field, a, b);
  if (!vals) return { value: null, date: null };
  let best = { value: vals[0], date: bars[a].date };
  for (let i = 1; i < vals.length; i++) {
    if (pick(vals[i], best.value)) best = { value: vals[i], date: bars[a + i].date };
  }
  return best;
}

/**
 * The nine facts and the evidence block, from the adapter's bars (newest
 * first). Reads nothing but `bars`; never mutates its input.
 */
export function computeTfFacts(evidence) {
  const bars = Array.isArray(evidence?.bars) ? evidence.bars : [];
  const n = bars.length;
  const fast = T.smaFastLength;
  const slow = T.smaSlowLength;
  const rise = T.slowSmaRisingWindowBars;
  const swing = T.swingLookbackBars;
  const atrLen = T.atrLength;
  const volLen = T.volumeAverageLength;
  const touch = T.pullbackTouchWindowBars;

  const C = n > 0 && isPrice(bars[0].close) ? bars[0].close : null;

  const fastCloses = priceSlice(bars, 'close', 0, fast - 1);
  const SMA_fast = fastCloses ? calculateSMA(fastCloses, fast) : null;

  const slowCloses = priceSlice(bars, 'close', 0, slow - 1);
  const SMA_slow = slowCloses ? calculateSMA(slowCloses, slow) : null;

  const priorCloses = priceSlice(bars, 'close', rise, rise + slow - 1);
  const SMA_slow_5ago = priorCloses ? calculateSMA(priorCloses, slow) : null;

  const swingHigh = extremeOf(bars, 'high', 1, swing, (v, best) => v > best);
  const swingLow = extremeOf(bars, 'low', 1, swing, (v, best) => v < best);

  const atrHighs = priceSlice(bars, 'high', 0, atrLen);
  const atrLows = priceSlice(bars, 'low', 0, atrLen);
  const atrCloses = priceSlice(bars, 'close', 0, atrLen);
  const atrResult = atrHighs && atrLows && atrCloses ? calculateATR(atrHighs, atrLows, atrCloses, atrLen) : null;
  const ATR = atrResult && isNum(atrResult.value) ? atrResult.value : null;

  // Volume, per the shared policy (V3 §6.3).
  const bar0 = n > 0 ? bars[0] : null;
  const bar0Class = classifyVolume(bar0 ? bar0.volume : null);
  const V = bar0 && bar0Class.usable ? bar0.volume : null;
  const bar0Record = {
    date: bar0 ? bar0.date : null,
    value: bar0 && isNum(bar0.volume) ? bar0.volume : null,
    usable: bar0Class.usable,
    reason: bar0Class.reason,
  };
  const unusable = [];
  let barsUsable = 0;
  let volSum = 0;
  const volWindowComplete = n > volLen;
  for (let i = 1; i <= volLen && i < n; i++) {
    const cls = classifyVolume(bars[i].volume);
    if (cls.usable) { barsUsable += 1; volSum += bars[i].volume; } else unusable.push({ date: bars[i].date, reason: cls.reason });
  }
  const V_avg = volWindowComplete && barsUsable === volLen ? volSum / volLen : null;

  const pullbackLows = [];
  for (let i = 0; i < touch && i < n; i++) pullbackLows.push({ date: bars[i].date, low: isNum(bars[i].low) ? bars[i].low : null });

  return {
    facts: { C, SMA_fast, SMA_slow, SMA_slow_5ago, swingHigh: swingHigh.value, swingLow: swingLow.value, ATR, V, V_avg },
    evidence: {
      bars: { count: n, newest: n > 0 ? bars[0].date : null, oldest: n > 0 ? bars[n - 1].date : null },
      windows: {
        smaFast: windowOf(bars, 0, fast - 1),
        smaSlow: windowOf(bars, 0, slow - 1),
        smaSlowPrior: windowOf(bars, rise, rise + slow - 1),
        swing: windowOf(bars, 1, swing),
        atr: windowOf(bars, 0, atrLen),
        volumeAvg: windowOf(bars, 1, volLen),
        pullbackTouch: windowOf(bars, 0, touch - 1),
      },
      pullbackLows,
      swingHigh,
      swingLow,
      volume: {
        bar0: bar0Record,
        avg: { value: V_avg, barsRequired: volLen, barsUsable, unusable },
      },
    },
  };
}

// ---------------------------------------------------------------- checks

function compare(op, a, b) {
  if (!isNum(a) || !isNum(b)) return 'unknown';
  switch (op) {
    case '>': return a > b;
    case '<': return a < b;
    case '>=': return a >= b;
    case '<=': return a <= b;
    default: throw new Error(`tfSetupV1: unknown operator ${op}`);
  }
}

/** A chained comparison lhs[i] op rhs[i] for every i; unknown when any operand is not a number. */
function chain(op, lhs, rhs) {
  for (let i = 0; i < lhs.length; i++) {
    const r = compare(op, lhs[i], rhs[i]);
    if (r === 'unknown') return 'unknown';
    if (r === false) return false;
  }
  return true;
}

function check(id, lhs, op, rhs, result, facts) {
  return { id, lhs, op, rhs, result, facts };
}

/** The four regime checks and the pattern and extension checks, from the facts and the dated lows. */
export function entryChecks(facts, pullbackLows) {
  const { C, SMA_fast, SMA_slow, SMA_slow_5ago, swingHigh, ATR, V, V_avg } = facts;
  const lows = pullbackLows.map((p) => p.low);
  const touchComplete = lows.length === T.pullbackTouchWindowBars && lows.every(isPrice);
  const minLow = touchComplete ? Math.min(...lows) : null;
  const volumeFloor = isNum(V_avg) ? T.breakoutVolumeMultiple * V_avg : null;
  const guard = isNum(SMA_fast) && isNum(ATR) ? SMA_fast + T.extensionGuardAtrMultiple * ATR : null;
  return [
    check('regime_stack', [C, SMA_fast], '>', [SMA_fast, SMA_slow], chain('>', [C, SMA_fast], [SMA_fast, SMA_slow]), ['C', 'SMA_fast', 'SMA_slow']),
    check('slow_rising', SMA_slow, '>', SMA_slow_5ago, compare('>', SMA_slow, SMA_slow_5ago), ['SMA_slow', 'SMA_slow_5ago']),
    check('regime_stack_down', [C, SMA_fast], '<', [SMA_fast, SMA_slow], chain('<', [C, SMA_fast], [SMA_fast, SMA_slow]), ['C', 'SMA_fast', 'SMA_slow']),
    check('slow_falling', SMA_slow, '<', SMA_slow_5ago, compare('<', SMA_slow, SMA_slow_5ago), ['SMA_slow', 'SMA_slow_5ago']),
    check('breakout_close', C, '>=', swingHigh, compare('>=', C, swingHigh), ['C', 'swingHigh']),
    check('breakout_volume', V, '>=', volumeFloor, compare('>=', V, volumeFloor), ['V', 'V_avg']),
    check('pullback_touch', minLow, '<=', SMA_fast, compare('<=', minLow, SMA_fast), ['pullbackLows', 'SMA_fast']),
    check('pullback_close', C, '>', SMA_fast, compare('>', C, SMA_fast), ['C', 'SMA_fast']),
    check('extension', C, '<=', guard, compare('<=', C, guard), ['C', 'SMA_fast', 'ATR']),
  ];
}

const byId = (checks) => Object.fromEntries(checks.map((c) => [c.id, c]));

/** The regime, derived from the four regime checks and nothing else. */
export function deriveRegime(checks) {
  const c = byId(checks);
  const results = REGIME_CHECKS.map((id) => c[id]?.result);
  if (results.some((r) => r === 'unknown' || r === undefined)) return 'unknown';
  if (c.regime_stack.result === true && c.slow_rising.result === true) return 'uptrend';
  if (c.regime_stack_down.result === true && c.slow_falling.result === true) return 'downtrend';
  return 'no_trend';
}

/** Each pattern's assessment from its checks: satisfied | failed | untestable (SEMANTICS_NOTES). */
export function derivePatterns(checks) {
  const c = byId(checks);
  const out = {};
  for (const name of PATTERN_ORDER) {
    const results = PATTERN_CHECKS[name].map((id) => c[id]?.result);
    if (results.every((r) => r === true)) out[name] = 'satisfied';
    else if (results.some((r) => r === 'unknown' || r === undefined)) out[name] = 'untestable';
    else out[name] = 'failed';
  }
  return out;
}

/**
 * The entry verdict from checks, patterns and the bar count (definition
 * §1–§5 as clarified by C1; V3 §6.4). Nothing else is read.
 */
export function deriveEntryVerdict({ checks, patterns, barCount }) {
  const regime = deriveRegime(checks);
  if (!isNum(barCount) || barCount < MIN_COMPLETED_BARS) {
    return { verdict: 'unknown', reason: 'insufficient_history', pattern: null, patternsSatisfied: [], regime: 'unknown' };
  }
  if (regime === 'unknown') return { verdict: 'unknown', reason: 'missing_fact', pattern: null, patternsSatisfied: [], regime };
  if (regime !== 'uptrend') return { verdict: 'invalid', reason: 'regime', pattern: null, patternsSatisfied: [], regime };
  const satisfied = PATTERN_ORDER.filter((p) => patterns[p] === 'satisfied');
  if (satisfied.length > 0) {
    const ext = byId(checks).extension?.result;
    if (ext === 'unknown' || ext === undefined) return { verdict: 'unknown', reason: 'missing_fact', pattern: null, patternsSatisfied: satisfied, regime };
    if (ext === false) return { verdict: 'invalid', reason: 'extended', pattern: null, patternsSatisfied: satisfied, regime };
    return { verdict: 'valid', reason: null, pattern: satisfied[0], patternsSatisfied: satisfied, regime };
  }
  if (PATTERN_ORDER.every((p) => patterns[p] === 'failed')) return { verdict: 'invalid', reason: 'no_setup', pattern: null, patternsSatisfied: [], regime };
  return { verdict: 'unknown', reason: 'missing_fact', pattern: null, patternsSatisfied: [], regime };
}

// ---------------------------------------------------------------- records

function commonBlock(evidence, computed, checks, patterns) {
  const { facts } = computed;
  const asOf = evidence.asOf ?? null;
  const basis = evidence.basis ?? null;
  const source = evidence.source ?? null;
  const factsUsed = {};
  for (const name of FACT_NAMES) factsUsed[name] = { value: facts[name], asOf, source, basis };
  return {
    ruleSet: describeRuleSet(),
    asOf,
    basis,
    source,
    sourceMeta: evidence.sourceMeta ?? null,
    evidenceClass: { bars: evidence.evidenceClass?.bars ?? null, verdict: 'derived' },
    evidence: {
      ...computed.evidence,
      adjustment: evidence.adjustment ? { metadata: evidence.adjustment.metadata, missingDates: [...(evidence.adjustment.missingDates ?? [])] } : { metadata: 'absent', missingDates: [] },
    },
    factsUsed,
    missing: FACT_NAMES.filter((name) => facts[name] === null),
    patterns,
    checks,
  };
}

/** The record for an adapter refusal: every fact null, every check unknown, verdict unknown with the typed reason. */
function refusalRecord(evidence) {
  const computed = computeTfFacts({ bars: [] });
  const checks = entryChecks(computed.facts, []);
  const patterns = derivePatterns(checks);
  return {
    ...commonBlock(evidence, computed, checks, patterns),
    refusal: { reason: evidence.reason ?? null, detail: evidence.detail ?? null },
  };
}

/**
 * Entry qualification (definition §3 as clarified by C1) for the name whose
 * bars the evidence carries. `evidence` is the daily-bars adapter's result; a
 * refusal (`ok: false`) yields `unknown(<the adapter's reason>)`.
 */
export function evaluateTfEntry(evidence) {
  if (!evidence || evidence.ok === false) {
    return { ...refusalRecord(evidence ?? {}), verdict: 'unknown', reason: evidence?.reason ?? 'missing_fact', pattern: null, patternsSatisfied: [], regime: 'unknown' };
  }
  const computed = computeTfFacts(evidence);
  const checks = entryChecks(computed.facts, computed.evidence.pullbackLows);
  const patterns = derivePatterns(checks);
  const derived = deriveEntryVerdict({ checks, patterns, barCount: computed.evidence.bars.count });
  return { ...commonBlock(evidence, computed, checks, patterns), ...derived };
}

/** The chart leg from the three holding checks and nothing else (V3 §7). */
export function deriveChartLeg(checks) {
  const c = byId(checks);
  const results = HOLDING_CHECKS.map((id) => c[id]?.result);
  if (results.some((r) => r === true)) return 'broken';
  if (results.every((r) => r === false)) return 'intact';
  return 'unknown';
}

/**
 * Holding assessment of the chart leg (definition §4; Amendment A, A6).
 * A separate function and record: it never reads an entry verdict. The
 * anchor swing low is ID-1's record, never re-derived here; absent or
 * non-finite, `structure_break` is unknown and the provenance says so.
 */
export function evaluateTfHolding(evidence, { anchorSwingLow = null } = {}) {
  const anchorSupplied = isNum(anchorSwingLow);
  const anchor = { value: anchorSupplied ? anchorSwingLow : null, provenance: anchorSupplied ? 'supplied' : 'absent' };
  if (!evidence || evidence.ok === false) {
    const base = refusalRecord(evidence ?? {});
    const regimeChecks = base.checks.filter((c) => REGIME_CHECKS.includes(c.id));
    const checks = [
      ...regimeChecks,
      check('close_below_slow', null, '<', null, 'unknown', ['C', 'SMA_slow']),
      check('structure_break', null, '<', anchor.value, 'unknown', ['C', 'anchorSwingLow']),
      check('regime_flip', 'unknown', '===', 'downtrend', 'unknown', ['regime']),
    ];
    return { ...base, checks, regime: 'unknown', chartLeg: 'unknown', reasons: [], anchorSwingLow: anchor };
  }
  const computed = computeTfFacts(evidence);
  const { C, SMA_slow } = computed.facts;
  const allEntry = entryChecks(computed.facts, computed.evidence.pullbackLows);
  const regimeChecks = allEntry.filter((c) => REGIME_CHECKS.includes(c.id));
  const regime = deriveRegime(regimeChecks);
  const patterns = derivePatterns(allEntry);
  const checks = [
    ...regimeChecks,
    check('close_below_slow', C, '<', SMA_slow, compare('<', C, SMA_slow), ['C', 'SMA_slow']),
    check('structure_break', C, '<', anchor.value, compare('<', C, anchor.value), ['C', 'anchorSwingLow']),
    check('regime_flip', regime, '===', 'downtrend', regime === 'unknown' ? 'unknown' : regime === 'downtrend', ['regime']),
  ];
  const chartLeg = deriveChartLeg(checks);
  const reasons = HOLDING_CHECKS.filter((id) => byId(checks)[id].result === true);
  return { ...commonBlock(evidence, computed, checks, patterns), regime, chartLeg, reasons, anchorSwingLow: anchor };
}
