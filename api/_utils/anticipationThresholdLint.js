// api/_utils/anticipationThresholdLint.js
//
// THE THRESHOLD LINT — no promise on a signal the tick did not hold.
//
// Basis: docs/audits/20260915_PHASE0_SIGNAL_LANGUAGE.md §5 (the signal table,
// the authority for what counts as present) and §7.2 shape 2. Of the four
// thresholds the Sep 14 agent wrote, three cite a signal it was never shown:
// daily VWAP (computed, discarded by the freshness gate since 2026-06-12), a
// 5-minute MACD histogram (never computed anywhere), and RSI on a HELD name
// (rendered for bench names only). The player reads "I'll act if X" with no
// way to learn that X was never watched.
//
// Pure module: no I/O, no Firestore, no fetch, no imports — the
// agentVwapFloor.js pattern. The cron (api/cron/agent-evaluate.js) owns all
// I/O and both persistence sites; this module only answers two questions.
//
// THE INVARIANT: an accepted threshold is byte-identical to what the decider
// wrote. This module REJECTS; it never rewrites. Rewriting the agent's own
// sentence to remove an absent clause would be a second honesty problem —
// the player would then read a promise the agent never made.

// ---------------------------------------------------------------------------
// The signal names
// ---------------------------------------------------------------------------

/**
 * Every signal name this module can put in a `present` set or an `absent`
 * list. Frozen and exported so the build report and the tests name the same
 * strings the code does.
 */
export const SIGNAL_NAMES = Object.freeze({
  // Held-side, rendered by the ACTIVE POSITIONS CSV / INTRADAY MOMENTUM
  // SNAPSHOT / STOCK REGIMES blocks.
  ATR: 'ATR',
  VWAP: 'VWAP',
  BB_WIDTH: 'BB_WIDTH',
  NR7: 'NR7',
  REGIME: 'REGIME',
  // Both classes — the held row's Levels cell and the bench Levels line read
  // the SAME rankings `levels` object.
  LEVELS: 'LEVELS',
  // Bench-side, rendered by BENCH TECHNICAL CONTEXT from the stockTechnicalScores
  // doc. NEVER rendered for a held name (Phase 0 §5: techScoresMap is consumed
  // only by the bench block).
  RSI: 'RSI',
  MACD_CROSS: 'MACD_CROSS',
  BB_PCT_B: 'BB_PCT_B',
  RVOL: 'RVOL',
  RS_PERCENTILE: 'RS_PERCENTILE',
  // Named by equipped Forge rules and by the tool schema's own example, but
  // computed on NO path for ANY symbol (Phase 0 §5, "not in the data at all").
  MACD_5M: 'MACD_5M',
  RSI_5M: 'RSI_5M',
  VWAP_5M: 'VWAP_5M',
  SMA_20_LEVEL: 'SMA_20_LEVEL',
});

/**
 * The four that are never present for any symbol under any input. Exported
 * for the A-2 row that asserts exactly that, and for the report.
 */
export const NEVER_PRESENT_SIGNALS = Object.freeze([
  SIGNAL_NAMES.MACD_5M,
  SIGNAL_NAMES.RSI_5M,
  SIGNAL_NAMES.VWAP_5M,
  SIGNAL_NAMES.SMA_20_LEVEL,
]);

// ---------------------------------------------------------------------------
// The vocabulary table
// ---------------------------------------------------------------------------

/**
 * THE VOCABULARY — regex → signal name, as data so the build report can list
 * it and so a row can be deleted in a mutation check.
 *
 * Two orderings ride this one table, deliberately:
 *
 *   • DECLARATION order is the order below, and is the order `absent` comes
 *     out in. It is the order the Phase 0 brief lists, so the shipped table
 *     and the report read the same way.
 *
 *   • MATCH order is `matchFirst` ascending (stable within a group). The
 *     three 5-minute rows match FIRST and CONSUME the text they matched, so
 *     the general `/\bMACD\b/i`, `/\bRSI\b/i` and `/\bVWAP\b/i` rows cannot
 *     re-match a mention a 5-minute row already claimed. That is how the
 *     brief's "(not 5-minute)" qualifier on MACD_CROSS is encoded — as
 *     precedence, not as a negative lookaround that would have to be
 *     repeated on every general row.
 *
 * Every pattern is case-insensitive and global (the matcher needs `g` to walk
 * all matches in one sentence).
 */
export const THRESHOLD_SIGNAL_VOCABULARY = Object.freeze([
  { signal: SIGNAL_NAMES.VWAP, pattern: /\bVWAP\b/gi, matchFirst: 1 },
  { signal: SIGNAL_NAMES.MACD_5M, pattern: /5[- ]?min(ute)?\s+MACD|MACD\s+histogram/gi, matchFirst: 0 },
  { signal: SIGNAL_NAMES.RSI_5M, pattern: /5[- ]?min(ute)?\s+RSI/gi, matchFirst: 0 },
  { signal: SIGNAL_NAMES.VWAP_5M, pattern: /5[- ]?min(ute)?\s+VWAP/gi, matchFirst: 0 },
  { signal: SIGNAL_NAMES.RVOL, pattern: /\bRVOL\b|relative volume|volume ratio/gi, matchFirst: 1 },
  { signal: SIGNAL_NAMES.RSI, pattern: /\bRSI\b/gi, matchFirst: 1 },
  { signal: SIGNAL_NAMES.SMA_20_LEVEL, pattern: /\b(the )?20[- ]day\b/gi, matchFirst: 1 },
  { signal: SIGNAL_NAMES.MACD_CROSS, pattern: /\bMACD\b/gi, matchFirst: 1 },
  { signal: SIGNAL_NAMES.BB_PCT_B, pattern: /%B|percent B/gi, matchFirst: 1 },
  { signal: SIGNAL_NAMES.RS_PERCENTILE, pattern: /rsPercentile|relative strength percentile/gi, matchFirst: 1 },
]);

/**
 * The two orderings for a table: `declaration` (the order `absent` comes out
 * in) and `match` (`matchFirst` ascending — the 5-minute rows first). Stable:
 * Array.prototype.sort is stable in every engine this runs on (ES2019+).
 *
 * Computed once for the shipped table; recomputed for a caller-supplied one,
 * which is how the mutation check runs the REAL matcher over a table with one
 * row deleted rather than over a copy of this logic (BUILD_RULES §4).
 */
function orderings(vocabulary) {
  if (vocabulary === THRESHOLD_SIGNAL_VOCABULARY) return DEFAULT_ORDERINGS;
  return {
    declaration: vocabulary.map((r) => r.signal),
    match: [...vocabulary].sort((a, b) => a.matchFirst - b.matchFirst),
  };
}
const DEFAULT_ORDERINGS = {
  declaration: THRESHOLD_SIGNAL_VOCABULARY.map((r) => r.signal),
  match: [...THRESHOLD_SIGNAL_VOCABULARY].sort((a, b) => a.matchFirst - b.matchFirst),
};

// ---------------------------------------------------------------------------
// buildPresentSignals
// ---------------------------------------------------------------------------

/** A finite number, or a non-empty string — the "the doc carries a reading" test. */
const isReading = (v) => (typeof v === 'number' ? Number.isFinite(v) : typeof v === 'string' && v !== '');

/** Unique, defined, non-empty strings from an array-ish. */
function symbolList(v) {
  const out = [];
  const seen = new Set();
  for (const s of Array.isArray(v) ? v : []) {
    if (typeof s !== 'string' || !s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/**
 * The signals the decider's prompt actually rendered THIS TICK, per symbol,
 * built from the same in-memory objects the prompt was built from.
 *
 * The asymmetry is the prompt's, not this module's (Phase 0 §5): held
 * positions get the ACTIVE POSITIONS CSV, the momentum snapshot and the
 * regime line; BENCH names get BENCH TECHNICAL CONTEXT. `techScoresMap` is
 * consumed ONLY by the bench block, so RSI / MACD / %B / RVOL / rsPercentile
 * are never rendered for a held name; the intraday fetch is held-only
 * (`fetchIntradayBatch(portfolioSymbols, …)`), so VWAP is never rendered for
 * a bench name.
 *
 * A symbol in BOTH lists is treated as held (the held read is the one the
 * decider sees for a position it owns).
 *
 * @param {Object} args
 * @param {Object} [args.momentumData] - the cron's momentumData: `{ vwap,
 *   rankings, regimes, … }`
 * @param {Object} [args.techScoresMap] - stockTechnicalScores docs by symbol
 * @param {Object} [args.rankingsMap] - stockRankings rows by symbol
 * @param {string[]} [args.heldSymbols] - the portfolio symbols the CSV rendered
 * @param {string[]} [args.benchSymbols] - the bench symbols the bench block rendered
 * @returns {Map<string, Set<string>>} symbol → the set of present signal names
 */
export function buildPresentSignals({ momentumData, techScoresMap, rankingsMap, heldSymbols, benchSymbols } = {}) {
  const present = new Map();

  const vwapMap = momentumData?.vwap || {};
  const regimes = momentumData?.regimes || {};
  const rankings = rankingsMap || momentumData?.rankingsMap || {};
  const techs = techScoresMap || momentumData?.techScoresMap || {};

  const held = symbolList(heldSymbols);
  const heldSet = new Set(held);

  for (const sym of held) {
    const set = new Set();
    // The ATR Mult column and ATR% are on EVERY held row, unconditionally
    // (buildPortfolioCSV renders them from the fenced scorer's own numbers).
    set.add(SIGNAL_NAMES.ATR);
    // The momentum snapshot renders the VWAP part only when the deviation is
    // a reading — the same `!= null` test the renderer applies.
    if (vwapMap[sym]?.vwapDeviation != null) set.add(SIGNAL_NAMES.VWAP);
    const rank = rankings[sym];
    if (rank) {
      if (rank.bBandwidthPercentile != null) set.add(SIGNAL_NAMES.BB_WIDTH);
      // The rankings row CARRIES the NR7 measurement whenever the field is a
      // boolean — `false` is a reading ("no contraction today"), which is why
      // the evidence stamp records it as `false` rather than null.
      if (rank.nr7Flag != null) set.add(SIGNAL_NAMES.NR7);
      if (rank.levels) set.add(SIGNAL_NAMES.LEVELS);
    }
    if (isReading(regimes[sym])) set.add(SIGNAL_NAMES.REGIME);
    present.set(sym, set);
  }

  for (const sym of symbolList(benchSymbols)) {
    if (heldSet.has(sym)) continue;
    const set = new Set();
    const tech = techs[sym];
    const factors = tech?.factors;
    if (factors?.rsi != null) set.add(SIGNAL_NAMES.RSI);
    if (factors?.macdAboveSignal != null) set.add(SIGNAL_NAMES.MACD_CROSS);
    if (tech?.bbPercentB != null) set.add(SIGNAL_NAMES.BB_PCT_B);
    if (tech?.volumeProfile?.ratio != null) set.add(SIGNAL_NAMES.RVOL);
    if (factors?.rsPercentile != null) set.add(SIGNAL_NAMES.RS_PERCENTILE);
    if (rankings[sym]?.levels) set.add(SIGNAL_NAMES.LEVELS);
    present.set(sym, set);
  }

  return present;
}

// ---------------------------------------------------------------------------
// lintThreshold
// ---------------------------------------------------------------------------

/**
 * Every signal name the sentence NAMES, in declaration order, deduped.
 *
 * Matching consumes: each row blanks the spans it matched (same length, so
 * every later row still sees a correctly-shaped string), and rows run in
 * `matchFirst` order — so "the 5-minute MACD" is MACD_5M and never also
 * MACD_CROSS.
 *
 * @param {string} threshold
 * @param {Array} [vocabulary] - the table to match with; defaults to the
 *   shipped one. Only the mutation check passes another.
 * @returns {string[]}
 */
export function namedSignals(threshold, vocabulary = THRESHOLD_SIGNAL_VOCABULARY) {
  if (typeof threshold !== 'string' || !threshold) return [];
  const { declaration, match } = orderings(vocabulary);
  let rest = threshold;
  const hit = new Set();
  for (const row of match) {
    // A fresh regex per call — a module-scope /g regex carries lastIndex
    // across calls and would skip matches on the second sentence.
    const re = new RegExp(row.pattern.source, row.pattern.flags);
    let m;
    let matched = false;
    while ((m = re.exec(rest)) !== null) {
      if (m[0].length === 0) { re.lastIndex += 1; continue; }
      matched = true;
      rest = rest.slice(0, m.index) + ' '.repeat(m[0].length) + rest.slice(m.index + m[0].length);
    }
    if (matched) hit.add(row.signal);
  }
  return declaration.filter((s) => hit.has(s));
}

/**
 * Does this threshold promise only on signals the tick held for this symbol?
 *
 * A signal name the sentence uses that is absent from `present.get(symbol)`
 * goes in `absent`. A symbol the map does not know at all (neither held nor
 * bench this tick) has an empty present set, so every named signal is absent —
 * the honest read: the prompt rendered nothing for it.
 *
 * Signals the vocabulary does not name — ATR multiples, a named resistance
 * level, the regime, NR7, BB width — are accepted by omission: no row claims
 * them, so no mention of them can ever land in `absent`.
 *
 * A null / empty / non-string threshold is `ok` — a candidate that makes no
 * promise cannot make a false one.
 *
 * @param {Object} args
 * @param {string|null} args.threshold - the decider's own sentence, untouched
 * @param {string} args.symbol
 * @param {Map<string, Set<string>>} args.present - from buildPresentSignals
 * @param {Array} [args.vocabulary] - the table to match with (mutation check only)
 * @returns {{ok: true} | {ok: false, absent: string[]}}
 */
export function lintThreshold({ threshold, symbol, present, vocabulary } = {}) {
  const named = namedSignals(threshold, vocabulary || THRESHOLD_SIGNAL_VOCABULARY);
  if (named.length === 0) return { ok: true };
  const have = (present instanceof Map ? present.get(symbol) : null) || new Set();
  const absent = named.filter((s) => !have.has(s));
  return absent.length === 0 ? { ok: true } : { ok: false, absent };
}
