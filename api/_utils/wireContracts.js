// api/_utils/wireContracts.js
// FantasyTimes Wire — the typed-facts contract (Spec V1.5 §4.1, §4.4).
//
// Single source of truth for every closed vocabulary in the Wire arc:
// eventType contract rows, per-reporter allowlists, enums, outcome and
// class-code constants, versions. The validator, renderer, schema extension,
// and tests all DERIVE from these exports — nothing re-literals them
// (the derived-not-literal contract pattern, agentGuardrails.bypassContract
// precedent; Spec §4.2).
//
// Extensible by spec version only: adding an eventType, basis, or qualifier
// is a Wire spec amendment, not a drive-by edit.

export const WIRE_SCHEMA_VERSION = 'wire-1.5';
export const WIRE_VALIDATOR_VERSION = '1.5.0';

// Firestore collection names (server-only; deny-all in firestore.rules).
export const WIRE_COLLECTION = 'fantasyTimesWire';
export const WIRE_ENVELOPE_COLLECTION = 'fantasyTimesWireEnvelopes';
export const WIRE_METRICS_COLLECTION = 'wireMetrics';

// ── Outcomes (Spec §4.5) — every generation resolves to exactly one ──────
export const WIRE_OUTCOMES = Object.freeze({
  PASSED: 'passed',
  SALVAGED: 'salvaged',
  REJECTED: 'rejected',
  QUARANTINED: 'quarantined',
  TRUNCATED: 'truncated',
});

// Outcomes that produce a Wire ENTRY (REJECT/truncated produce receipt+stats only).
export const ENTRY_OUTCOMES = Object.freeze([
  WIRE_OUTCOMES.PASSED,
  WIRE_OUTCOMES.SALVAGED,
  WIRE_OUTCOMES.QUARANTINED,
]);

// ── Validation class codes (F2-3) ────────────────────────────────────────
// These codes — and ONLY these codes — may appear on the public story doc's
// wireValidation.codes. Full reason strings (which may echo model output)
// live exclusively in the envelope and receipt, server-side.
export const WIRE_CODES = Object.freeze({
  R1_UNKNOWN_KEYS: 'R1_UNKNOWN_KEYS',
  R2_DIRECTIVE_FIELD: 'R2_DIRECTIVE_FIELD',
  R3_EVENTTYPE: 'R3_EVENTTYPE',
  R4_MISSING: 'R4_MISSING',
  R4_TYPE: 'R4_TYPE',
  R4_ENUM: 'R4_ENUM',
  R4_CARDINALITY: 'R4_CARDINALITY',
  R4_OVERSIZE: 'R4_OVERSIZE',
  R4_SIGN: 'R4_SIGN',
  R4_DIRECTION_ON_PREVIEW: 'R4_DIRECTION_ON_PREVIEW',
  R5_TRUNCATED: 'R5_TRUNCATED',
  SALVAGE_MAGNITUDE: 'SALVAGE_MAGNITUDE',
  SALVAGE_KEYLEVEL: 'SALVAGE_KEYLEVEL',
  SALVAGE_QUALIFIER: 'SALVAGE_QUALIFIER',
  SALVAGE_FIGURE: 'SALVAGE_FIGURE',
  SALVAGE_DIRECTION: 'SALVAGE_DIRECTION',
  R4_TICKER_EMPTY: 'R4_TICKER_EMPTY',
  F1_OFFUNIVERSE: 'F1_OFFUNIVERSE',
  F1_PRIMARY_DROPPED: 'F1_PRIMARY_DROPPED',
  F2_QUARANTINE: 'F2_QUARANTINE',
});

// wireConflict class codes (story-doc pipeline state; F2-1/§4.7).
export const WIRE_CONFLICTS = Object.freeze({
  ENVELOPE_MISSING: 'envelope_missing',
  HASH_MISMATCH: 'hash_mismatch',
  STORY_MISMATCH: 'story_mismatch',
  REPLAY_EXHAUSTED: 'replay_exhausted',
});

// ── Public-surface hygiene (§4.3, F2-3) ──────────────────────────────────
// The Wire pipeline-state fields that live ON the story document. They are
// server-internal: the replay sweep queries Firestore directly, never the
// public API. fantasyTimesStories is `allow read: if true`, so the two
// public readers strip these rather than publish the internal validation
// taxonomy, per-story validator verdicts and reconciliation state to an
// unauthenticated, CDN-cached response.
export const WIRE_STORY_STATE_FIELDS = Object.freeze([
  'wireValidation', 'wirePending', 'wireConflict', 'wireReplayAttempts',
]);

/** Return a copy of a story document without any Wire pipeline state. */
export function stripWireState(data) {
  const out = { ...data };
  for (const field of WIRE_STORY_STATE_FIELDS) delete out[field];
  return out;
}

// ── Closed field enums (§4.1) ────────────────────────────────────────────
export const DIRECTIONS = Object.freeze(['up', 'down']);

export const UNITS = Object.freeze(['pct', 'pp', 'x', 'usd', 'pts', 'count']);

export const KEY_LEVEL_TYPES = Object.freeze([
  'prior_high', 'prior_low', 'resistance', 'support',
  'sma50', 'sma200', 'open', 'prior_close', 'vwap',
]);

// figures[].basis draws from the union of the row's magnitude bases plus this
// shared set (V1.2 §4.4, closed at build).
export const SHARED_FIGURE_BASES = Object.freeze([
  'gap_vs_prior_close', 'price_vs_prior_close', 'volume_vs_avg',
]);

export const FIGURES_CAP = 4;
export const QUALIFIERS_CAP = 3;
export const TICKER_MAX_LENGTH = 12;

// ── Per-eventType contract table (§4.4, V1.5 grounding) ──────────────────
// tickers: [min, max] cardinality on the PRE-STRIP (model-emitted) array.
// direction: 'optional' (nullable, sign-checked when present) or
//            'forbidden' (previews — non-null direction is REJECT-class).
// qualifiers: closed per-eventType allowlist; starter sets per V1.2 §4.1,
//             empty where the spec authored none (extensible by spec version).
// macroEligible: entry joins macroEntries iff eventType is macro-eligible AND
//                the PRE-STRIP tickers[] was empty (B7).
// `macro_alert` is deliberately ABSENT: its producer seam is dead (V1.5 §4.4
// "producer-dead, inert") and no reporter allowlists it.
export const EVENT_CONTRACTS = Object.freeze({
  technical_break: Object.freeze({
    family: 'technical', tickers: Object.freeze([1, 1]), direction: 'optional',
    magnitudeBases: Object.freeze(['price_vs_level']),
    qualifiers: Object.freeze([]), macroEligible: false, label: 'technical break',
  }),
  volume_surge: Object.freeze({
    family: 'technical', tickers: Object.freeze([1, 1]), direction: 'optional',
    magnitudeBases: Object.freeze(['volume_vs_avg']),
    qualifiers: Object.freeze([]), macroEligible: false, label: 'volume surge',
  }),
  volatility_event: Object.freeze({
    family: 'technical', tickers: Object.freeze([0, 1]), direction: 'optional',
    magnitudeBases: Object.freeze(['range_vs_atr']),
    qualifiers: Object.freeze([]), macroEligible: false, label: 'volatility',
  }),
  index_move: Object.freeze({
    family: 'macro', tickers: Object.freeze([0, 0]), direction: 'optional',
    magnitudeBases: Object.freeze(['index_vs_prior_close']),
    qualifiers: Object.freeze([]), macroEligible: true, label: 'move',
    zeroTickerSubject: 'Index',
  }),
  market_mover: Object.freeze({
    family: 'technical', tickers: Object.freeze([1, 1]), direction: 'optional',
    magnitudeBases: Object.freeze(['price_vs_prior_close']),
    qualifiers: Object.freeze([]), macroEligible: false, label: 'move',
  }),
  gap_event: Object.freeze({
    family: 'technical', tickers: Object.freeze([1, 1]), direction: 'optional',
    magnitudeBases: Object.freeze(['gap_vs_prior_close']),
    qualifiers: Object.freeze([]), macroEligible: false, label: 'gap',
  }),
  econ_print: Object.freeze({
    family: 'econ', tickers: Object.freeze([0, 0]), direction: 'optional',
    magnitudeBases: Object.freeze(['print_vs_expected']),
    qualifiers: Object.freeze(['prior_revised_up', 'prior_revised_down']),
    macroEligible: true, label: 'print', zeroTickerSubject: 'Econ',
  }),
  econ_preview: Object.freeze({
    family: 'econ', tickers: Object.freeze([0, 0]), direction: 'forbidden',
    magnitudeBases: Object.freeze(['consensus_estimate', 'prior_print']),
    qualifiers: Object.freeze([]), macroEligible: true, label: 'preview',
    zeroTickerSubject: 'Econ',
  }),
  earnings_recap: Object.freeze({
    family: 'earnings', tickers: Object.freeze([1, 10]), direction: 'optional',
    magnitudeBases: Object.freeze(['eps_vs_consensus', 'revenue_vs_consensus', 'price_vs_prior_close']),
    qualifiers: Object.freeze([
      'guidance_raised', 'guidance_lowered', 'guidance_reaffirmed',
      'guidance_withdrawn', 'dividend_raised', 'buyback_announced',
    ]),
    macroEligible: false, label: 'earnings',
  }),
  earnings_preview: Object.freeze({
    family: 'earnings', tickers: Object.freeze([1, 10]), direction: 'forbidden',
    magnitudeBases: Object.freeze(['consensus_estimate', 'prior_print']),
    qualifiers: Object.freeze([]), macroEligible: false, label: 'earnings preview',
  }),
  sector_rotation: Object.freeze({
    family: 'sector', tickers: Object.freeze([0, 5]), direction: 'optional',
    magnitudeBases: Object.freeze(['sector_vs_spy']),
    qualifiers: Object.freeze([]), macroEligible: false, label: 'rotation',
    zeroTickerSubject: 'Sector',
  }),
  leadership_shift: Object.freeze({
    family: 'sector', tickers: Object.freeze([1, 5]), direction: 'optional',
    magnitudeBases: Object.freeze(['rs_vs_peers']),
    qualifiers: Object.freeze([]), macroEligible: false, label: 'leadership shift',
  }),
});

export const EVENT_TYPES = Object.freeze(Object.keys(EVENT_CONTRACTS));

// ── Per-reporter eventType allowlists (§4.4; validator rule R3) ──────────
// Vera is excluded from Wire v1 (P5-adjacent; V1.5 §4.1).
export const REPORTER_EVENT_ALLOWLIST = Object.freeze({
  kai: Object.freeze(['technical_break', 'volume_surge', 'volatility_event', 'index_move']),
  alex: Object.freeze(['market_mover', 'gap_event']),
  neta: Object.freeze(['econ_print', 'econ_preview']),
  doug: Object.freeze(['earnings_recap', 'earnings_preview']),
  kim: Object.freeze(['sector_rotation', 'leadership_shift']),
});

/** Every basis a given eventType accepts in figures[] (row bases + shared set). */
export function figureBasesFor(eventType) {
  const row = EVENT_CONTRACTS[eventType];
  if (!row) return [...SHARED_FIGURE_BASES];
  return [...new Set([...row.magnitudeBases, ...SHARED_FIGURE_BASES])];
}

/** Union of magnitude bases across a reporter's allowlist (schema extension). */
export function magnitudeBasesForReporter(reporter) {
  const types = REPORTER_EVENT_ALLOWLIST[reporter] || [];
  return [...new Set(types.flatMap((t) => EVENT_CONTRACTS[t].magnitudeBases))];
}

/** Union of qualifiers across a reporter's allowlist (schema extension). */
export function qualifiersForReporter(reporter) {
  const types = REPORTER_EVENT_ALLOWLIST[reporter] || [];
  return [...new Set(types.flatMap((t) => EVENT_CONTRACTS[t].qualifiers))];
}
