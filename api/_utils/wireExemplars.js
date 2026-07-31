// api/_utils/wireExemplars.js
// FantasyTimes Wire — N2 few-shot exemplars (Spec V1.2 §3 N2 / N2.1, and the
// July 29 partial-exemplar ruling).
//
// WHAT THESE ARE. Each entry is a real historical FantasyTimes story reduced to
// (a) a compact SITUATION cue and (b) the qualified typed-facts COMPANION the
// reporter should emit for it. They are embedded — writes-gated — into the
// agentFacts prompt addendum (buildAgentFactsInstruction), so they appear on the
// wire exactly when the agentFacts field is offered (WIRE_WRITES_ENABLED). Under
// metrics-only / flag-off the addendum is empty and the prompt is byte-identical
// (M8), so no exemplar text reaches the model until writes flip.
//
// QUALIFICATION (N2.1, the gate is the verdict — P9). Every companion below was
// model-generated from its story's prose, then held to the REAL machinery:
// validateAgentFacts -> renderWireDigest -> the P3 editorial agreement adapters,
// reproducing wireWriteThrough's persistedFacts construction. A candidate that
// could not produce a clean dual output is not here. The permanent regression of
// that gate lives in wireExemplars.test.js (each agentFacts re-validated + a
// clean digest asserted) — so a future edit that breaks an exemplar fails CI.
//
// WHAT'S EMBEDDED (11), and WHY the set is partial:
//   alex market_mover  — 4 (AMD/TSLA/UNH/RTX): the gold standard, every
//                          dimension operand-grounded; three carry keyLevels.
//   kai  index_move    — 3 (SPX/NDX/SPX): a real subjectRef spread — the NDX
//                          case teaches "headline the index the prose emphasizes,
//                          not a default SPX." The 4th slot is intentionally
//                          EMPTY: aW5 (Dow) + its alternate YJy2 (Nasdaq) both
//                          failed identically because the pulse seam sets
//                          primaryTicker=SPY and the A2 remap then forces
//                          subjectRef->SPX (filed defect: DRIFT_LEDGER D-3,
//                          must land before WIRE_WRITES flips). Two failures in
//                          one group is a seam finding, not a pick problem — no
//                          third pick was pulled.
//   doug earnings_preview — 4 (AAPL/META/V/MSFT): head-only by necessity — the
//                          preview snapshot carries null EPS/revenue estimates,
//                          so the faithful companion is ticker+eventType with NO
//                          direction (forbidden on previews) and NO invented
//                          numbers. They teach "don't fabricate what the data
//                          doesn't give you." (MSFT is the alternate; the primary
//                          BX was off the Wire universe.)
//   kim  sector_rotation  — 0, DEFERRED to the post-gate iteration. sector_vs_spy
//                          has no SPY operand at the S7 seam, so the only
//                          magnitude basis Kim can carry cannot be truthfully
//                          populated (DRIFT_LEDGER D-4, a founder decision memo).
//                          Teaching a false basis at a gate-silent seam violates
//                          the honesty rule, so nothing is embedded.
//   neta econ_*, doug earnings_recap — 0, deferred post-gate per the July 29
//                          zero-groups ruling (never-written / timing-zeroed
//                          production defects to fix first).
//
// PROVENANCE. Each entry records its source storyId and the source primaryTicker
// (the operand the seam would resolve), so the qualification is reproducible.
// WIRE_EXEMPLAR_VERSION identifies the set; the deployment of a new set bumps
// WIRE_GENERATION_VERSION (this file is a GENERATION_SURFACE member) and, per
// Spec V1.2 §3, feeds gateEpoch ("final exemplar deployment").

/**
 * The exemplar-set version. Integer, bumped when the embedded set changes.
 *   1 — first embed (July 31, 2026): alex×4, kai×3, doug earnings_preview×4.
 *       kim / neta / doug earnings_recap deferred post-gate.
 * A v2 will follow post-gate when the deferred types have real stories and
 * their seam defects are fixed.
 */
export const WIRE_EXEMPLAR_VERSION = 1;

/**
 * Per-reporter exemplars. Keyed by reporter; each entry declares its eventType
 * so a pinned seam (V1.6 A4) renders only its own row. `situation` and
 * `agentFacts` are what the model sees; `storyId` / `primaryTicker` are
 * provenance (never rendered). `agentFacts` is the MINIMAL faithful payload —
 * every field the source data cannot ground is omitted, modelling the "omit
 * what you can't ground" rule the instruction states.
 */
export const WIRE_EXEMPLARS = Object.freeze({
  alex: Object.freeze([
    Object.freeze({
      storyId: 'sZx9qteVDWNzcACxbJ2S', eventType: 'market_mover', primaryTicker: 'AMD',
      situation: 'AMD Crashes on Profit-Taking After AI Momentum Run — AMD fell 5.51% on the day; the story cites no specific price level.',
      agentFacts: Object.freeze({
        eventType: 'market_mover', tickers: ['AMD'], direction: 'down',
        magnitude: Object.freeze({ value: -5.5123, unit: 'pct', basis: 'price_vs_prior_close' }),
      }),
    }),
    Object.freeze({
      storyId: 'f9BnH825q1kLx4FFPMVd', eventType: 'market_mover', primaryTicker: 'TSLA',
      situation: 'Tesla Slides on Rivian R2 Production Concerns Ahead of Q2 Preview — TSLA down 3.03%, breaking below support at 295.',
      agentFacts: Object.freeze({
        eventType: 'market_mover', tickers: ['TSLA'], direction: 'down',
        magnitude: Object.freeze({ value: -3.0315, unit: 'pct', basis: 'price_vs_prior_close' }),
        keyLevel: Object.freeze({ price: 295, type: 'support' }),
      }),
    }),
    Object.freeze({
      storyId: 'mgFSjOxnoePTFfAu2JXU', eventType: 'market_mover', primaryTicker: 'UNH',
      situation: 'UNH Ripping Higher as Dividend Strength Powers Healthcare — UNH up 3.05%, holding above support at 425.',
      agentFacts: Object.freeze({
        eventType: 'market_mover', tickers: ['UNH'], direction: 'up',
        magnitude: Object.freeze({ value: 3.0481, unit: 'pct', basis: 'price_vs_prior_close' }),
        keyLevel: Object.freeze({ price: 425, type: 'support' }),
      }),
    }),
    Object.freeze({
      storyId: 'fzp43ZTAhbEnSxsJHaiT', eventType: 'market_mover', primaryTicker: 'RTX',
      situation: 'RTX Rips Higher on Industrials Momentum — RTX up 3.21%, pushing through resistance at 219.63.',
      agentFacts: Object.freeze({
        eventType: 'market_mover', tickers: ['RTX'], direction: 'up',
        magnitude: Object.freeze({ value: 3.2121, unit: 'pct', basis: 'price_vs_prior_close' }),
        keyLevel: Object.freeze({ price: 219.63, type: 'resistance' }),
      }),
    }),
  ]),
  kai: Object.freeze([
    Object.freeze({
      storyId: 'GYLp3Uwk4aCOmmb2ADnx', eventType: 'index_move', primaryTicker: 'SPY',
      situation: 'S&P 500 futures slide 1.5% as tech earnings disappoint — the S&P is the story (SPY -1.54% leads the tape). subjectRef SPX; tickers empty for a market-wide move.',
      agentFacts: Object.freeze({
        eventType: 'index_move', tickers: [], direction: 'down',
        magnitude: Object.freeze({ value: -1.5388, unit: 'pct', basis: 'index_vs_prior_close' }),
        subjectRef: 'SPX',
      }),
    }),
    Object.freeze({
      storyId: 'oNNylvdfilPSPzsvJBKV', eventType: 'index_move', primaryTicker: null,
      situation: 'Tech Tumbles as Nvidia, AMD Slide; Small Caps Rally on Divergence — the Nasdaq is the story (QQQ -0.25%) while the S&P held flat and small caps rose. Headline the index the prose emphasizes: subjectRef NDX, not a default SPX.',
      agentFacts: Object.freeze({
        eventType: 'index_move', tickers: [], direction: 'down',
        magnitude: Object.freeze({ value: -0.2485, unit: 'pct', basis: 'index_vs_prior_close' }),
        subjectRef: 'NDX',
      }),
    }),
    Object.freeze({
      storyId: 'ubvi4lVNvdsQq5BfQe4t', eventType: 'index_move', primaryTicker: 'SPY',
      situation: 'S&P 500 rises on blue-chip strength while tech treads water — the S&P leads (SPY +0.59%) while the Nasdaq lags. subjectRef SPX.',
      agentFacts: Object.freeze({
        eventType: 'index_move', tickers: [], direction: 'up',
        magnitude: Object.freeze({ value: 0.592, unit: 'pct', basis: 'index_vs_prior_close' }),
        subjectRef: 'SPX',
      }),
    }),
  ]),
  doug: Object.freeze([
    Object.freeze({
      storyId: '6kcO5ZgkOOyg0C8LvGXo', eventType: 'earnings_preview', primaryTicker: 'AAPL',
      situation: 'Apple Q3 FY2026 Earnings Preview — a forward-looking preview with no consensus estimates in the data. Head-only: ticker + eventType, NO direction (previews carry none), no invented numbers.',
      agentFacts: Object.freeze({ eventType: 'earnings_preview', tickers: ['AAPL'] }),
    }),
    Object.freeze({
      storyId: 'J6cLaezUeI8R4bMHTcto', eventType: 'earnings_preview', primaryTicker: 'META',
      situation: 'Meta Platforms Q2 2026 Earnings Preview — no consensus estimates available. Head-only, no direction.',
      agentFacts: Object.freeze({ eventType: 'earnings_preview', tickers: ['META'] }),
    }),
    Object.freeze({
      storyId: 'xvXdcTQO1WUufhuxFnJX', eventType: 'earnings_preview', primaryTicker: 'V',
      situation: 'Visa Q3 FY2026 Earnings Preview — no consensus estimates available. Head-only, no direction.',
      agentFacts: Object.freeze({ eventType: 'earnings_preview', tickers: ['V'] }),
    }),
    Object.freeze({
      storyId: 'ZwIf659TYSTs6cn392nA', eventType: 'earnings_preview', primaryTicker: 'MSFT',
      situation: 'Microsoft Q4 FY2026 Earnings Preview — no consensus estimates available. Head-only, no direction.',
      agentFacts: Object.freeze({ eventType: 'earnings_preview', tickers: ['MSFT'] }),
    }),
  ]),
  // kim: deferred (D-4 — sector_vs_spy has no SPY operand at S7).
  // neta / doug earnings_recap: deferred post-gate (July 29 zero-groups ruling).
});

/**
 * Render the writes-gated few-shot block for a seam. Returns '' when the seam
 * has no exemplars (so callers can concatenate unconditionally and the flag-off
 * / no-exemplar prompt stays byte-identical). When `pinEventType` is given
 * (V1.6 A4 single-eventType seams), only exemplars of that eventType render.
 *
 * @param {string} reporter — 'kai'|'alex'|'doug'|'kim'|'neta'
 * @param {object} [opts]
 * @param {string} [opts.pinEventType]
 * @returns {string} the block (leading '\n', no trailing newline), or ''
 */
export function renderExemplarBlock(reporter, { pinEventType } = {}) {
  const all = WIRE_EXEMPLARS[reporter] || [];
  const picked = pinEventType ? all.filter((e) => e.eventType === pinEventType) : all;
  if (picked.length === 0) return '';
  const lines = ['', 'EXAMPLES — faithful agentFacts for real stories (match this shape; omit any field the data cannot ground):'];
  for (const ex of picked) {
    lines.push(`- ${ex.situation}`);
    lines.push(`  agentFacts: ${JSON.stringify(ex.agentFacts)}`);
  }
  return lines.join('\n');
}
