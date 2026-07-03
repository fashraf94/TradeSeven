/**
 * Correlation Intelligence — Break Context V2 (V2 Build 3): the technical
 * state of the GROUP COMPOSITE at the moment each regime break fired
 * (price vs 50DMA, RSI-14 zone), plus 50DMA-conditioned base rates.
 *
 * Non-handler home (the correlationAssembly.js rule: handler files are not
 * import targets) so the deep-dive endpoint imports from a module and the
 * pieces unit-test in isolation. Deliberately NOT in correlationMath.js —
 * that module pins ZERO imports in its header, and this one must import
 * technicalCalculations. Both shared modules are used CALL-ONLY; neither is
 * modified (technicalCalculations.js is do-not-modify, reverse-fence
 * adjacency).
 *
 * ── THE order adapter (one adapter, one place — Build 3 spec) ──────────────
 * Composite levels arrive CHRONOLOGICAL / oldest-first (the correlationMath.js
 * array-order contract: index 0 is the earliest bar). technicalCalculations.js
 * expects NEWEST-FIRST (its module header: "All functions take arrays of
 * numeric data (newest-first)"). computeContextAtFlag reverse-COPIES the
 * chronological prefix ending at the episode anchor c — index 0 of the copy is
 * the level AT c — so calculateSMA/calculateRSI read the window ENDING at c.
 * No other call site may re-adapt; anything downstream of this module speaks
 * chronological only.
 */
import { calculateSMA, calculateRSI, classifyTrend } from '../_utils/technicalCalculations.js';
import { forwardReturns } from '../_utils/correlationMath.js';

export const CONTEXT_SMA_PERIOD = 50;
export const CONTEXT_RSI_PERIOD = 14;
/**
 * Tier discipline, inherited verbatim (pinned): a conditioned partition
 * carries mean/median/hitRate only at ≥ 3 independent episodes — below that
 * the counts render and the stats are NULL (never a 2-episode "median").
 * The no-percentage-under-5 rule is a COPY rule and lives in the UI, exactly
 * as it does for the unconditioned tiers.
 */
export const CONDITION_MIN_INDEPENDENT = 3;

const NULL_CONTEXT = Object.freeze({ vs50DMA: null, rsi14: null, rsiZone: null });

/**
 * Technical state of the composite at close index `c` (an episode's
 * startCloseIndex): { vs50DMA: 'above'|'below'|null, rsi14: number|null,
 * rsiZone: 'overbought'|'neutral'|'oversold'|null }.
 *
 * Null conventions come from technicalCalculations itself (pinned in the
 * Phase 0-lite report): vs50DMA is null when fewer than CONTEXT_SMA_PERIOD
 * levels up to AND INCLUDING c exist (calculateSMA's length < period rule);
 * rsi14/rsiZone are null below CONTEXT_RSI_PERIOD + 1 levels (calculateRSI's
 * rule). A null is a null — never guessed, never zero-filled.
 *
 * @param {number[]} levels - composite levels, CHRONOLOGICAL (oldest-first)
 * @param {number} c - episode anchor close index into `levels`
 */
export function computeContextAtFlag(levels, c) {
  if (!Array.isArray(levels) || !Number.isInteger(c) || c < 0 || c >= levels.length) {
    return { ...NULL_CONTEXT };
  }
  // Reverse-copy at the call boundary: CHRONOLOGICAL levels[0..c] →
  // NEWEST-FIRST copy whose index 0 is the level AT c (see module header).
  // slice() before reverse() so the caller's array is never mutated.
  const newestFirst = levels.slice(0, c + 1).reverse();

  // A corrupt level anywhere in the prefix nulls EVERY stamp: calculateSMA
  // would propagate NaN (and 'level > NaN' would stamp a confident 'below')
  // and calculateRSI silently treats a NaN change as a flat day — both are
  // guessed states this module's contract forbids. Unreachable through the
  // current endpoint (computeReturnsSeries rejects non-finite closes), but
  // this is the reusable home, so it guards its own boundary (the
  // correlationMath isFiniteNumberArray idiom).
  if (!newestFirst.every((v) => Number.isFinite(v))) {
    return { ...NULL_CONTEXT };
  }

  // 50-period SMA ENDING at c (the newest `period` entries of the adapted copy).
  const sma50 = calculateSMA(newestFirst, CONTEXT_SMA_PERIOD);
  // classifyTrend owns the equality convention (level === sma is not-above →
  // 'down'); mapping its vocabulary keeps the two surfaces agreeing by
  // construction instead of by parallel comparison code.
  const trend = classifyTrend(levels[c], sma50);
  const vs50DMA = trend == null ? null : trend === 'up' ? 'above' : 'below';

  // RSI-14 at c: Wilder's running average over the full joined history up to
  // c. Wilder RSI is prefix-deterministic, so truncate-then-compute equals the
  // per-bar calculateRSISeries value at c. The zone comes back pinned at
  // ≥ 70 / 30–70 / ≤ 30 from calculateRSI itself — never re-derived here.
  const rsi = calculateRSI(newestFirst, CONTEXT_RSI_PERIOD);

  return {
    vs50DMA,
    rsi14: rsi ? rsi.value : null,
    rsiZone: rsi ? rsi.zone : null,
  };
}

/**
 * 50DMA-conditioned base rates over the GROUP's forward returns only:
 * `{ below50DMA, above50DMA }`, each a per-horizon map of blocks carrying the
 * SAME five aggregate fields as the unconditioned baseRates blocks
 * (eligibleCount, independentCount, mean, median, hitRate) — and nothing else
 * (the pinned conditioned shape; `details` stays unconditioned-only).
 *
 * The partition is each episode's OWN vs50DMA stamp; episodes with a null
 * stamp fall in NEITHER partition (never guessed). The non-overlap walk runs
 * WITHIN each partition — forwardReturns is handed only that partition's
 * episodes, so independence is independent-within-condition by construction
 * (call-only reuse; no second walk implementation).
 *
 * Returns null on invalid levels/dates/horizons input (no answer is null,
 * never a zero-count block dressed as clean history).
 *
 * @param {number[]} levels - composite levels, CHRONOLOGICAL (oldest-first)
 * @param {string[]} dates - joined dates parallel to levels
 * @param {Array<object>} episodes - contextAtFlag-enriched episodes
 * @param {number[]} [horizons] - omit to inherit forwardReturns' own pinned
 *   [5, 10, 20] default — the horizon list has exactly ONE home, so the
 *   conditioned and unconditioned blocks can never drift apart
 */
export function conditionedBaseRates(levels, dates, episodes, horizons) {
  if (!Array.isArray(episodes)) return null;
  const sides = { below50DMA: 'below', above50DMA: 'above' };
  const out = {};
  for (const [key, side] of Object.entries(sides)) {
    const partition = episodes.filter((ep) => ep?.contextAtFlag?.vs50DMA === side);
    // An undefined `horizons` falls through to forwardReturns' own default
    // parameter — never a second copy of the pinned list here.
    const fr = forwardReturns(levels, dates, partition, horizons);
    if (fr === null) return null;
    out[key] = {};
    for (const h of Object.keys(fr)) {
      const block = fr[h];
      const gated = block.independentCount >= CONDITION_MIN_INDEPENDENT;
      out[key][h] = {
        eligibleCount: block.eligibleCount,
        independentCount: block.independentCount,
        mean: gated ? block.mean : null,
        median: gated ? block.median : null,
        hitRate: gated ? block.hitRate : null,
      };
    }
  }
  return out;
}
