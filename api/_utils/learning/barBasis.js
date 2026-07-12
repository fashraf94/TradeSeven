// api/_utils/learning/barBasis.js
//
// Agent Learning System — L1 Foundation, Phase 3.
// The BAR-BASIS semantics table for every D1/D2 predicate field.
// Source of truth: L1 Foundation Build Spec §4 / ANNEX A7 + this session's
// data-provenance discovery (compute-index-intelligence.js pipeline, VERIFIED).
//
// WHY THIS EXISTS: "Any field whose bar basis cannot be pinned from live code is
// DISQUALIFIED from predicates — report it, do not assume." Guessing here
// silently reintroduces lookahead, which is the single failure the fixture
// suites exist to prevent. This table is the pinned answer, so the within-bar
// fixture suite (suite 3) has a contract to test against.
//
// DISCOVERY RESULT (VERIFIED): every predicate field is PINNABLE. All seven
// share ONE mechanism — both source docs (stockTechnicalScores/{symbol} and
// indexIntelligence/stockRankings) are written by the single cron
// api/cron/compute-index-intelligence.js from EODHD daily EOD bars (period=d,
// reversed newest-first; index 0 = most recent daily bar). That cron runs in
// two modes, which makes each field's basis DUAL-MODE:
//
//   PREMARKET run ('30 10,11 * * 1-5'): index 0 = LAST FULLY-CLOSED DAILY BAR.
//   INTRADAY run  ('0 14-20 * * 1-5', ?mode=intraday): EODHD real-time quote is
//     spliced as a synthetic index-0 bar (injectIntradayBar) →
//     POINT-IN-TIME PARTIAL (INTRADAY) BAR.
//
// The intraday recompute OVERWRITES the doc in place hourly during RTH, and
// agent-evaluate reads the doc as-is at decision time, so the operative
// decision-time basis for most of the session is the partial intraday bar.
// This is CONTEMPORANEOUS, not forward-lookahead (the partial bar is the
// current instant, never a future bar).
//
// This DUAL-MODE reality REFINES spec A7's single-basis-per-field assumption —
// flagged for Fable's review. Each receipt records the raw `dataMode` of the
// snapshot doc, which, with this table, pins the actual basis at capture time.

/** The three basis kinds from ANNEX A7. */
export const BAR_BASIS = Object.freeze({
  LAST_CLOSED: 'last_fully_closed_bar',
  PARTIAL: 'point_in_time_partial_bar',
  TICK: 'tick_value',
});

/** Bump when any field's basis semantics change. Stamped onto receipts. */
export const BAR_BASIS_TABLE_VERSION = 1;

/**
 * Per predicate field: its basis under each write mode of the source cron,
 * whether it is pinnable, the source anchor, and any caveat.
 * `mode`: which cron run last wrote the doc → which basis is in force.
 */
export const PREDICATE_BAR_BASIS = Object.freeze({
  'volatility.bbPercentB': Object.freeze({
    premarket: BAR_BASIS.LAST_CLOSED,
    intraday: BAR_BASIS.PARTIAL,
    pinnable: true,
    source: 'compute-index-intelligence.js:700,770; technicalCalculations.js:260-262',
    caveat: null,
  }),
  'levels.distanceToResistancePct': Object.freeze({
    premarket: BAR_BASIS.LAST_CLOSED,
    intraday: BAR_BASIS.PARTIAL,
    pinnable: true,
    source: 'indexIntelligence.js (findNearestLevels, currentPrice=closes[0])',
    // Level ANCHORS are daily swing clusters (bars index 2..20) in BOTH modes;
    // only the distance numerator/denominator (currentPrice) goes intraday-partial.
    caveat: 'level anchors are daily in both modes; only currentPrice is intraday-partial during RTH',
  }),
  'smaStack.distTo52wkHigh': Object.freeze({
    premarket: BAR_BASIS.LAST_CLOSED,
    intraday: BAR_BASIS.PARTIAL,
    pinnable: true,
    source: 'indexIntelligence.js:277,316-318,396',
    caveat: null,
  }),
  'volume.ratio': Object.freeze({
    premarket: BAR_BASIS.LAST_CLOSED,
    intraday: BAR_BASIS.PARTIAL,
    pinnable: true,
    source: 'technicalCalculations.js:339,349; compute-index-intelligence.js:704,773',
    // injectIntradayBar NEUTRALIZES the synthetic index-0 bar's volume to the
    // trailing ~30-bar average, so the intraday ratio collapses to ~1.0 and is
    // NOT a true partial-bar volume — a neutralized placeholder.
    caveat: 'intraday value is a neutralized ~1.0 placeholder, NOT true partial-bar volume',
  }),
  'momentum.upDayVolRatio': Object.freeze({
    premarket: BAR_BASIS.LAST_CLOSED,
    intraday: BAR_BASIS.PARTIAL,
    pinnable: true,
    source: 'indexIntelligence.js:366-376,397',
    caveat: 'only the newest of 20 bars shifts basis intraday; its volume is the neutralized synthetic',
  }),
  'momentum.macdAboveSignal': Object.freeze({
    premarket: BAR_BASIS.LAST_CLOSED,
    intraday: BAR_BASIS.PARTIAL,
    pinnable: true,
    source: 'indexIntelligence.js:400; technicalCalculations.js:194',
    caveat: null,
  }),
  'momentum.macdFreshBullishCross': Object.freeze({
    premarket: BAR_BASIS.LAST_CLOSED,
    intraday: BAR_BASIS.PARTIAL,
    pinnable: true,
    source: 'compute-index-intelligence.js:672-690; indexIntelligence.js:401',
    caveat: "'now' vs 'prev' are same-bar vs prior-bar (no future data); intraday the 'now' bar is partial",
  }),
});

/**
 * Resolve the in-force basis for a field given the snapshot doc's write mode.
 * @param {string} fieldPath  key into PREDICATE_BAR_BASIS
 * @param {'premarket'|'intraday'|string|null|undefined} dataMode
 * @returns {string|null} a BAR_BASIS value, or null if the field is unknown.
 */
export function resolveBarBasis(fieldPath, dataMode) {
  const row = PREDICATE_BAR_BASIS[fieldPath];
  if (!row) return null;
  return dataMode === 'intraday' ? row.intraday : row.premarket;
}

/** True iff every predicate field is pinnable (the calibration gate prerequisite). */
export function allFieldsPinned() {
  return Object.values(PREDICATE_BAR_BASIS).every((r) => r.pinnable === true);
}
