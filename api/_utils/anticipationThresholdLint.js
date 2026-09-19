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
  // The three "_5M" names are historical: their rows catch ANY intraday-minute
  // timeframe, because no indicator is computed on any intraday timeframe at
  // all (the one exception, sma20_5m, is a risk-layer trail reference the
  // prompt never renders).
  MACD_5M: 'MACD_5M',
  RSI_5M: 'RSI_5M',
  VWAP_5M: 'VWAP_5M',
  SMA_20_LEVEL: 'SMA_20_LEVEL',
  // A MACD HISTOGRAM VALUE is rendered on no timeframe for any symbol: the
  // daily histogram is persisted (indexIntelligence.js) but the bench block
  // renders only "MACD above/below signal (fresh cross)". Its own name, not
  // folded into MACD_5M — the shadow log is the evidence the founder reads
  // before flipping to 'on', and a daily-histogram mention logged as a
  // 5-minute violation would mislead exactly that read (review L1-F4).
  MACD_HISTOGRAM: 'MACD_HISTOGRAM',
});

/**
 * The five intraday-timeframe names. Never present for any symbol under any
 * input WHILE INTRADAY_AGENT_USE_ENABLED IS FALSE (contract §9.3 — the shipped
 * state): with the flag true (stage 2) and a diagnostic view whose indicator
 * is `eligible`, `buildPresentSignals` adds them (see `intradaySignalsFor`).
 * Exported for the A-2 row that asserts the flag-off fact, and for the report.
 */
export const NEVER_PRESENT_SIGNALS = Object.freeze([
  SIGNAL_NAMES.MACD_5M,
  SIGNAL_NAMES.RSI_5M,
  SIGNAL_NAMES.VWAP_5M,
  SIGNAL_NAMES.SMA_20_LEVEL,
  SIGNAL_NAMES.MACD_HISTOGRAM,
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
// The intraday-timeframe phrase, shared by the three never-computed rows. ANY
// minute timeframe, not just five: no indicator is computed on any intraday
// timeframe (Phase 0 §5). Covers "5-minute", "5 min", "5min", "5m", "5-min.",
// "five-minute" and a bare "intraday".
const TF = String.raw`(?:\d{1,3}\s*-?\s*(?:m|mins?|minutes?)\b\.?|five[-\s]?minutes?\b|intraday\b)`;
/** `<timeframe> [chart] <INDICATOR>` or `<INDICATOR> on/over [the] <timeframe> [chart]`. */
const intraday = (ind) => new RegExp(
  String.raw`${TF}[\s-]*(?:chart\s+)?${ind}|${ind}\s+(?:on|over|from)\s+(?:the\s+)?${TF}(?:\s+chart)?`,
  'gi',
);

// Intraday Data Build 1 (contract §9.3): the indicator KEYS of the diagnostic
// view (`macd5m`, `rsi5m`, `sma20_5m`) as the stage-2 prompt lines would name
// them, folded into the SAME rows as alternations (one row per signal is a
// structural invariant of `namedSignals` and of the mutation table).
const orKeys = (re, keys) => new RegExp(`${re.source}|${keys}`, re.flags);

export const THRESHOLD_SIGNAL_VOCABULARY = Object.freeze([
  { signal: SIGNAL_NAMES.VWAP, pattern: /\bVWAPs?\b/gi, matchFirst: 2 },
  { signal: SIGNAL_NAMES.MACD_5M, pattern: orKeys(intraday(String.raw`\bMACD\b`), String.raw`\bmacd[_-]?5m\b`), matchFirst: 1 },
  { signal: SIGNAL_NAMES.RSI_5M, pattern: orKeys(intraday(String.raw`\bRSI\b`), String.raw`\brsi[_-]?5m\b`), matchFirst: 1 },
  { signal: SIGNAL_NAMES.VWAP_5M, pattern: intraday(String.raw`\bVWAP\b`), matchFirst: 1 },
  { signal: SIGNAL_NAMES.RVOL, pattern: /\bR-?VOL\b|\brelative[-\s]volume\b|\brel\.?\s*vol(?:ume)?\b|\bvolume[-\s]ratio\b/gi, matchFirst: 2 },
  { signal: SIGNAL_NAMES.RSI, pattern: /\bRSI[-\s]?\d*\b|\brelative strength index\b/gi, matchFirst: 2 },
  { signal: SIGNAL_NAMES.SMA_20_LEVEL, pattern: /\b(?:the\s+)?20[-\s]?day\b|\b20[-\s]?DMA\b|\bSMA[-\s]?20\b|\b(?:the\s+)?twenty[-\s]day\b|\bsma[_-]?20[_-]?5m\b/gi, matchFirst: 2 },
  { signal: SIGNAL_NAMES.MACD_CROSS, pattern: /\bMACD\b/gi, matchFirst: 2 },
  { signal: SIGNAL_NAMES.BB_PCT_B, pattern: /%[-\s]?B\b|\bpercent[-\s]?B\b|\bB%/gi, matchFirst: 2 },
  { signal: SIGNAL_NAMES.RS_PERCENTILE, pattern: /\brs[-\s]?percentile\b|\bRS\s+percentile\b|\brelative strength percentile\b/gi, matchFirst: 2 },
  // matchFirst 1: ahead of the general MACD row, so "MACD-H" is claimed whole
  // rather than losing its "MACD" to MACD_CROSS and going green.
  { signal: SIGNAL_NAMES.MACD_HISTOGRAM, pattern: /\bhistograms?\b|\bMACD[-\s]?H\b/gi, matchFirst: 1 },
]);

/**
 * NO IGNORED-SPAN ROW — deliberately, after refutation.
 *
 * The review proposed consuming "20-day high / range / average volume" before
 * the SMA_20_LEVEL row could claim them, on the theory that they name what the
 * tick rendered. The refutation overturned it, and it was reverted:
 *   • `nearestResistance` is the AVERAGE of a cluster of >=2 swing highs over a
 *     20-BAR lookback (analyticalPrimitives.js clusterSwings) — not a 20-day
 *     high, which nothing computes;
 *   • RVOL's 20-day denominator is real but the prompt renders `RVOL=1.34`
 *     alone, never the window;
 *   • the only "20-day" the agent is ever shown is the threshold instruction's
 *     own bad example, which Phase 0 §5 classifies as "not in the data (as a
 *     level)" and which the fenced twin still ships.
 * So a model writing "20-day high" is INVENTING the window, and rejecting it is
 * the row doing its job. The honest phrasings — "breaks above 181.62
 * resistance", "RVOL sustains above 1.2x" — name no table row and pass.
 */
const IGNORED_SPANS = Object.freeze([]);


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
    declaration: vocabulary.map((r) => r.signal).filter(Boolean),
    match: [...IGNORED_SPANS, ...vocabulary].sort((a, b) => a.matchFirst - b.matchFirst),
  };
}
const DEFAULT_ORDERINGS = {
  declaration: THRESHOLD_SIGNAL_VOCABULARY.map((r) => r.signal),
  match: [...IGNORED_SPANS, ...THRESHOLD_SIGNAL_VOCABULARY].sort((a, b) => a.matchFirst - b.matchFirst),
};

// ---------------------------------------------------------------------------
// buildPresentSignals
// ---------------------------------------------------------------------------

/** A finite number, or a non-empty string — the "the doc carries a reading" test. */
const isReading = (v) => (typeof v === 'number' ? Number.isFinite(v) : typeof v === 'string' && v !== '');

/**
 * The map key for a symbol. The decider FREE-TEXTS `candidate.symbol` — the
 * tool schema puts no pattern or enum on it — so "qcom", "QCOM " and "QCOM"
 * all reach the lint, while the map is keyed from the cron's own canonical
 * lists. Without this, a case or whitespace slip is an empty present set and
 * therefore a TOTAL DROP under 'on' (review L1-F6 / L2-F7). Non-strings
 * normalise too, which is what both persistence sites already do
 * (`String(c.symbol)` in composeCandidatesStamp).
 */
const symbolKey = (v) => (v == null ? '' : String(v).trim().toUpperCase());

/**
 * Does the rankings row render a Levels reading? Both renderers emit the empty
 * form when the object exists with both sides null — `levelsCell` returns '-'
 * and `renderBenchLevelsLine` returns null — so the object's mere existence is
 * not the gate (review L1-F5).
 */
const hasLevels = (rank) => rank?.levels != null
  && (rank.levels.nearestSupport != null || rank.levels.nearestResistance != null);

/** Unique, defined, non-empty strings from an array-ish. */
function symbolList(v) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(v) ? v : []) {
    if (typeof raw !== 'string') continue;
    const s = symbolKey(raw);
    if (!s || seen.has(s)) continue;
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
/**
 * Intraday Data Build 1 (contract §9.3): the intraday-timeframe names a
 * diagnostic view makes present for a symbol — ONLY when the caller passes
 * `intradayAgentUseEnabled: true` (the INTRADAY_AGENT_USE_ENABLED flag, read
 * by the cron and handed in, never read here: this module has no imports)
 * AND the view's indicator verdict is `eligible`. A `display_only` or
 * `ineligible` verdict adds nothing: the decider was shown nothing it may
 * act on. With the flag false — build 1 — this returns the empty set for
 * every input, which is exactly today's behaviour.
 */
export function intradaySignalsFor(record, intradayAgentUseEnabled) {
  const out = new Set();
  if (intradayAgentUseEnabled !== true || !record || typeof record !== 'object') return out;
  const eligible = (key) => record.indicators?.[key]?.verdict?.state === 'eligible';
  if (eligible('vwap')) out.add(SIGNAL_NAMES.VWAP_5M);
  if (eligible('macd5m')) { out.add(SIGNAL_NAMES.MACD_5M); out.add(SIGNAL_NAMES.MACD_HISTOGRAM); }
  if (eligible('rsi5m')) out.add(SIGNAL_NAMES.RSI_5M);
  if (eligible('sma20_5m')) out.add(SIGNAL_NAMES.SMA_20_LEVEL);
  return out;
}

export function buildPresentSignals({ momentumData, techScoresMap, rankingsMap, heldSymbols, benchSymbols, intradayView = null, intradayAgentUseEnabled = false } = {}) {
  const present = new Map();
  const viewSymbols = intradayView?.symbols && typeof intradayView.symbols === 'object' ? intradayView.symbols : null;
  const addIntraday = (sym, set) => {
    if (!viewSymbols) return;
    const raw = rawOf.get(sym) ?? sym;
    for (const name of intradaySignalsFor(viewSymbols[raw] ?? viewSymbols[sym], intradayAgentUseEnabled)) set.add(name);
  };

  const vwapMap = momentumData?.vwap || {};
  const regimes = momentumData?.regimes || {};
  const rankings = rankingsMap || momentumData?.rankingsMap || {};
  const techs = techScoresMap || momentumData?.techScoresMap || {};

  // The tick's own documents are keyed by the RAW symbol the cron holds, so
  // every doc read below goes through this: normalised key -> raw key.
  const rawOf = new Map();
  for (const raw of [...(Array.isArray(heldSymbols) ? heldSymbols : []), ...(Array.isArray(benchSymbols) ? benchSymbols : [])]) {
    if (typeof raw === 'string' && raw) rawOf.set(symbolKey(raw), raw);
  }
  const doc = (map, sym) => map?.[rawOf.get(sym) ?? sym];

  const held = symbolList(heldSymbols);
  const heldSet = new Set(held);

  for (const sym of held) {
    const set = new Set();
    // The ATR Mult column and ATR% are on EVERY held row, unconditionally
    // (buildPortfolioCSV renders them from the fenced scorer's own numbers).
    set.add(SIGNAL_NAMES.ATR);
    // The momentum snapshot renders the VWAP part only when the deviation is
    // a reading — the same `!= null` test the renderer applies.
    if (doc(vwapMap, sym)?.vwapDeviation != null) set.add(SIGNAL_NAMES.VWAP);
    const rank = doc(rankings, sym);
    if (rank) {
      if (rank.bBandwidthPercentile != null) set.add(SIGNAL_NAMES.BB_WIDTH);
      // TRUTHY, not `!= null` — buildMomentumSnapshot is `if (rankInfo?.nr7Flag)`
      // and prints "NR7: YES" or nothing at all. There is no "NR7: NO", so a
      // `false` flag renders no NR7 text and the agent was shown no NR7
      // (review L1-F5 / L2-F6; the earlier `!= null` read the evidence stamp's
      // model, which is a different question from what the PROMPT rendered).
      if (rank.nr7Flag === true) set.add(SIGNAL_NAMES.NR7);
      if (hasLevels(rank)) set.add(SIGNAL_NAMES.LEVELS);
    }
    if (isReading(doc(regimes, sym))) set.add(SIGNAL_NAMES.REGIME);
    addIntraday(sym, set);
    present.set(sym, set);
  }

  for (const sym of symbolList(benchSymbols)) {
    if (heldSet.has(sym)) continue;
    const set = new Set();
    const tech = doc(techs, sym);
    const factors = tech?.factors;
    if (factors?.rsi != null) set.add(SIGNAL_NAMES.RSI);
    if (factors?.macdAboveSignal != null) set.add(SIGNAL_NAMES.MACD_CROSS);
    if (tech?.bbPercentB != null) set.add(SIGNAL_NAMES.BB_PCT_B);
    if (tech?.volumeProfile?.ratio != null) set.add(SIGNAL_NAMES.RVOL);
    if (factors?.rsPercentile != null) set.add(SIGNAL_NAMES.RS_PERCENTILE);
    if (hasLevels(doc(rankings, sym))) set.add(SIGNAL_NAMES.LEVELS);
    addIntraday(sym, set);
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
    if (matched && row.signal) hit.add(row.signal);
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
  const have = (present instanceof Map ? present.get(symbolKey(symbol)) : null) || new Set();
  const absent = named.filter((s) => !have.has(s));
  return absent.length === 0 ? { ok: true } : { ok: false, absent };
}
