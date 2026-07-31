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

export const WIRE_SCHEMA_VERSION = 'wire-1.6';
export const WIRE_VALIDATOR_VERSION = '1.6.0';

// ── Phase 2 provenance versions (Spec V1.3 N0, D-P2-9 + companion) ────────
//
// WIRE_GENERATION_VERSION — the global generation-surface version (F-M1
// semantics): bump on ANY change to reporter prompt files, tool schemas,
// model ids, or sampling params (max_tokens included — the seams raise it
// under WIRE_WRITES_ENABLED). Read exclusively through
// getGenerationConfig(seam, flags) (wireGenerationConfig.js) so tests can
// bump it with a mutable mock (P2-22). Enforced by the committed-baseline
// content hash over the GENERATION_SURFACE manifest
// (wireGenerationSurface.js + wireGenerationBaseline.json, P2-15): a diff
// inside the manifest without a bump fails CI, and the baseline cannot be
// regenerated without one.
//
// WIRE_DIGEST_RENDERER_VERSION — versions renderWireDigest's OUTPUT
// semantics (wireDigest.js): templates, formatting, zero-suppression. Two
// entries with identical typed facts can differ in digest text across
// renderer versions; this constant is what a fail-closed consumer (N1.4)
// checks. Entries written before the stamp exists carry `undefined` =
// pre-stamp LEGACY, renderable (Amendment J) — never treated as unknown.
// Bound to wireDigest.js content in the same committed baseline.
//
// Note (recorded, deliberate): all three sibling constants live in this
// file, and this file is itself inside the GENERATION_SURFACE manifest — so
// bumping the validator or renderer version also dirties the generation
// surface and forces a WIRE_GENERATION_VERSION bump. That coupling is
// epoch-consistent by design: gateEpoch resets on ANY of these changes
// (Spec V1.2 N0), so the forced joint bump never creates a gate state the
// spec doesn't already mandate.
// v2 (P1 code review): ingestedClaims.js added to the GENERATION_SURFACE
// manifest — formatClaimsForPrompt shapes five reporter prompts and was a
// false-negative hole in v1. The bump is the mechanism working as designed:
// a manifest membership change forces the version forward.
// v3 (P1 closeout, founder ruling): rankingConfig value locks added —
// ALL_TICKERS + TICKER_TO_SECTOR hashed by VALUE into the baseline
// (GENERATION_VALUE_EXPORTS), so universe changes force a bump while
// unrelated rankingConfig edits touch nothing.
// v4 (FINAL LOCK, Jul 29): the §7.4 ratification caveat made mechanical —
// assessTickerUniverseCaveat refuses a regen carrying a TICKER_TO_SECTOR
// change without a WIRE_VALIDATOR_VERSION bump (each stamp truthful about
// its own axis). Manifest-module change → mechanism-scope bump.
// v5 (P3/N0): generationConfig threaded through the six inline publish
// calls + the batch-doc carry — request-constructor files changed (no
// request byte changed; the file-level conservatism is the accepted cost,
// and the lock catching its own arc's diff is the mechanism working).
// v6 (P2+N0 fix-forward): assessRegen/assessTickerUniverseCaveat hardened to
// require a strictly-FORWARD version bump (a downgrade no longer satisfies
// the caveat) — a manifest-module edit, so the mechanism forces this bump.
// v7 (Recap Restoration mini-arc, Jul 30 rulings): S3/S5 recap seams
// restored — deterministic array-driven Tier-1 + EODHD econ operands +
// econPrint verifier/plausibility gates (R-B1/R-B1a/R-A1), referent dedup
// (R-B4), ET-date + morning-window fixes (R-B2), F2 honest price-move
// labeling (R-B5). Two modules added to the manifest
// (fetchEconomicEventsEODHD.js, econPrintVerifier.js); writer + prompt
// content changed. The ONE pre-window epoch reset of ruling R-B7.
// v8 (P3/N1.4; renumbered from v7 at the rebase onto the Recap Restoration
// merge — both lineages had claimed v7 for different content): the
// recognized-versions registries below + wireEntryGuard.js (new manifest
// member) + the guard landing in wireContinuity's entry loop — guard rules
// decide which digests reach reporter prompts, so the mechanism forces
// this bump.
// v9 (P3/N3; renumbered from v8 at the same rebase): BASIS_SCOPE + the
// editorial version constants land in this manifest module (the addendum
// §3 recorded that the static scope classification lives here) — a
// contracts-file edit, so the mechanism forces this bump. No
// reporter-request byte changes.
// v10 (P3/N4; renumbered from v9 at the same rebase): the orphaned
// economic-calendar reader removed from fantasyTimesConsensus.js (a
// manifest member — its formatter half shapes five reporter prompts, so
// the conservative file-level bump fires even though only the dead
// data-read half changed).
// v11 (N2 exemplars; coordinated against main after #695 merged): the first
// few-shot exemplar set (wireExemplars.js, a new manifest member) embedded
// writes-gated into the agentFacts addendum — alex×4, kai×3, doug
// earnings_preview×4 (kim/neta/doug-recap deferred post-gate). Changes the
// reporter-request bytes ONLY under WIRE_WRITES (flag-off byte-identity
// intact, M8); feeds gateEpoch as the "final exemplar deployment" input
// (Spec V1.2 §3 / §4 step 2).
// v12 (D-3 pre-runway fix): the Kai pulse seam (generate-pulse.js, a manifest
// member) now nulls the WIRE primaryTicker on cardinality-0 eventTypes
// (index_move) so the A2 consistency remap no longer overwrites a correct
// model-emitted subjectRef (e.g. NDX/DJI) with SPX from the "the market"
// proxy. A conservative file-level bump — the outbound model request is
// unchanged (M8 intact); only the post-call persisted primaryTicker differs.
// The validator's A2 remap is untouched. Must land before WIRE_WRITES flips.
export const WIRE_GENERATION_VERSION = 12;
export const WIRE_DIGEST_RENDERER_VERSION = '1.0.0';

// ── N3 editorial version constants (Spec V1.2 N3, F-M3/F-M4) ──────────────
//
// WIRE_EDITORIAL_REVIEW_VERSION — versions the review MACHINERY semantics:
// sampling rules (strata, ceiling, seed derivation), verdict pass rule,
// memo rendering. Part of the sampling seed (N3.2: seed = isoWeek +
// reviewVersion) and fixed across the two qualifying periods (F-M3).
//
// WIRE_EDITORIAL_ADAPTER_VERSION — versions the deterministic verdict
// adapters (shape detection, recomputation formulas, tolerances §6).
// Changing ANY tolerance bumps this and resets the two-period window
// (F-M4, recorded at FINAL LOCK).
export const WIRE_EDITORIAL_REVIEW_VERSION = '1.0.0';
export const WIRE_EDITORIAL_ADAPTER_VERSION = '1.0.0';
export const WIRE_EDITORIAL_COLLECTION = 'wireEditorial';

// ── N1.4 recognized-versions registries (Spec V1.5 R4-M2) ─────────────────
//
// The ordered consumer state machine gates on these: (1) all epoch fields
// absent → LEGACY (renderable, Amendment J); (2) schemaVersion present AND
// registered here → completeness checked against THAT version's required
// set → STAMPED; (3) otherwise → fail closed (VERSION_SKIP for a version
// this build doesn't know, MALFORMED for a shape no writer ever produced).
// Checking completeness against the consumer's CURRENT set was the R4-M2
// defect — it would make every valid vN entry "malformed" the day vN+1
// ships. The registry keeps one required set PER recognized version so a
// vN+1 consumer classifies a complete vN entry stamped-vN, never malformed
// (P2-30 permutation).
//
// requiredFacts = the agentFacts fields a wire-1.6 writer unconditionally
// stamps AND a consumer renders on trust. Deliberately NOT included:
// tickers (legitimately empty on macro entries), chainId/observedAt
// (advisory metadata), subjectRef/primaryTicker (null is a valid value).
// Over-requiring here turns benign shape evolution into false MALFORMED.
export const RECOGNIZED_WIRE_SCHEMA_VERSIONS = Object.freeze({
  'wire-1.6': Object.freeze({
    requiredFacts: Object.freeze(['eventType', 'digest', 'digestRendererVersion', 'validatorVersion']),
  }),
});

// Renderer versions whose digest OUTPUT this build knows how to trust
// (N1.4: an unknown digestRendererVersion is never rendered on trust).
export const RECOGNIZED_WIRE_DIGEST_RENDERER_VERSIONS = Object.freeze(['1.0.0']);

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
  SALVAGE_SUBJECTREF: 'SALVAGE_SUBJECTREF',
  S1_SUBJECT_REMAPPED: 'S1_SUBJECT_REMAPPED',
  R4_TICKER_EMPTY: 'R4_TICKER_EMPTY',
  F1_OFFUNIVERSE: 'F1_OFFUNIVERSE',
  F1_PRIMARY_DROPPED: 'F1_PRIMARY_DROPPED',
  F2_QUARANTINE: 'F2_QUARANTINE',
});

// wireConflict class codes — the genuinely ANOMALOUS terminal states only
// (story-doc pipeline state). V1.6 A1/D9: the same-key mismatch classes
// (hash_mismatch / story_mismatch) RETIRED — a same-key surplus attempt is
// unclassifiable (retries regenerate; the hash cannot carry classification)
// and is handled as a SUPERSEDED attempt (`wireSuperseded: true`, its own
// benign field), never as a conflict.
export const WIRE_CONFLICTS = Object.freeze({
  ENVELOPE_MISSING: 'envelope_missing',
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
  'wireSuperseded',
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

// ── subjectRef vocabularies (V1.6 A2) ────────────────────────────────────
// index_move: MODEL-EMITTED, required — Kai's idempotency key is a time-slot
// trigger carrying no symbol; the model selects which index to headline.
export const INDEX_SUBJECTS = Object.freeze(['SPX', 'NDX', 'DJI', 'RUT', 'VIX']);

// Internal-consistency map (A2/M2): when the model's primaryTicker is one of
// these ETFs and disagrees with its subjectRef, the subjectRef is REMAPPED to
// the mapped index (S1_SUBJECT_REMAPPED). Catches internal inconsistency,
// not truth (m7 — enum-valid-but-wrong with no mappable cross-check is
// structurally uncatchable here; index_move joins the Phase 2 editorial
// stratified sampling explicitly for subject correctness).
export const ETF_TO_INDEX = Object.freeze({
  SPY: 'SPX', QQQ: 'NDX', DIA: 'DJI', IWM: 'RUT',
});

// Neta's seams: SERVER-STAMPED pre-call from the trigger's event name. The
// closed slug→subject set (A2); unknown aliases degrade to null exactly as
// the idempotency-key canonicalization degrades.
export const ECON_SUBJECT_REFS = Object.freeze({
  cpi: 'CPI', ppi: 'PPI', nfp: 'NFP', fomc: 'FOMC', pce: 'PCE', gdp: 'GDP',
  retail_sales: 'RETAIL_SALES', claims: 'JOBLESS_CLAIMS',
  ism_mfg: 'ISM_MFG', ism_svc: 'ISM_SVC',
});

/** Server subjectRef for a canonicalized econ slug; null on unknown alias. */
export function econSubjectRefForSlug(slug) {
  return ECON_SUBJECT_REFS[slug] || null;
}

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
    directionBases: Object.freeze(['price_vs_level', 'price_vs_prior_close']),
    qualifiers: Object.freeze([]), macroEligible: false, label: 'technical break',
  }),
  volume_surge: Object.freeze({
    family: 'technical', tickers: Object.freeze([1, 1]), direction: 'optional',
    magnitudeBases: Object.freeze(['volume_vs_avg']),
    directionBases: Object.freeze(['volume_vs_avg']),
    qualifiers: Object.freeze([]), macroEligible: false, label: 'volume surge',
  }),
  volatility_event: Object.freeze({
    family: 'technical', tickers: Object.freeze([0, 1]), direction: 'optional',
    magnitudeBases: Object.freeze(['range_vs_atr']),
    directionBases: Object.freeze(['range_vs_atr']),
    qualifiers: Object.freeze([]), macroEligible: false, label: 'volatility',
  }),
  index_move: Object.freeze({
    family: 'macro', tickers: Object.freeze([0, 0]), direction: 'optional',
    magnitudeBases: Object.freeze(['index_vs_prior_close']),
    directionBases: Object.freeze(['index_vs_prior_close']),
    subjectRef: 'model_required',
    qualifiers: Object.freeze([]), macroEligible: true, label: 'move',
    zeroTickerSubject: 'Index',
  }),
  market_mover: Object.freeze({
    family: 'technical', tickers: Object.freeze([1, 1]), direction: 'optional',
    magnitudeBases: Object.freeze(['price_vs_prior_close']),
    directionBases: Object.freeze(['price_vs_prior_close']),
    qualifiers: Object.freeze([]), macroEligible: false, label: 'move',
  }),
  gap_event: Object.freeze({
    family: 'technical', tickers: Object.freeze([1, 1]), direction: 'optional',
    magnitudeBases: Object.freeze(['gap_vs_prior_close']),
    directionBases: Object.freeze(['gap_vs_prior_close', 'price_vs_prior_close']),
    qualifiers: Object.freeze([]), macroEligible: false, label: 'gap',
  }),
  econ_print: Object.freeze({
    family: 'econ', tickers: Object.freeze([0, 0]), direction: 'optional',
    magnitudeBases: Object.freeze(['print_vs_expected']),
    directionBases: Object.freeze(['print_vs_expected']),
    subjectRef: 'server',
    qualifiers: Object.freeze(['prior_revised_up', 'prior_revised_down']),
    macroEligible: true, label: 'print', zeroTickerSubject: 'Econ',
  }),
  econ_preview: Object.freeze({
    family: 'econ', tickers: Object.freeze([0, 0]), direction: 'forbidden',
    magnitudeBases: Object.freeze(['consensus_estimate', 'prior_print']),
    directionBases: Object.freeze([]),
    subjectRef: 'server',
    qualifiers: Object.freeze([]), macroEligible: true, label: 'preview',
    zeroTickerSubject: 'Econ',
  }),
  earnings_recap: Object.freeze({
    family: 'earnings', tickers: Object.freeze([1, 10]), direction: 'optional',
    magnitudeBases: Object.freeze(['eps_vs_consensus', 'revenue_vs_consensus', 'price_vs_prior_close']),
    directionBases: Object.freeze(['price_vs_prior_close']),
    qualifiers: Object.freeze([
      'guidance_raised', 'guidance_lowered', 'guidance_reaffirmed',
      'guidance_withdrawn', 'dividend_raised', 'buyback_announced',
    ]),
    macroEligible: false, label: 'earnings',
  }),
  earnings_preview: Object.freeze({
    family: 'earnings', tickers: Object.freeze([1, 10]), direction: 'forbidden',
    magnitudeBases: Object.freeze(['consensus_estimate', 'prior_print']),
    directionBases: Object.freeze([]),
    qualifiers: Object.freeze([]), macroEligible: false, label: 'earnings preview',
  }),
  sector_rotation: Object.freeze({
    family: 'sector', tickers: Object.freeze([0, 5]), direction: 'optional',
    magnitudeBases: Object.freeze(['sector_vs_spy']),
    directionBases: Object.freeze(['sector_vs_spy']),
    qualifiers: Object.freeze([]), macroEligible: false, label: 'rotation',
    zeroTickerSubject: 'Sector',
  }),
  leadership_shift: Object.freeze({
    family: 'sector', tickers: Object.freeze([1, 5]), direction: 'optional',
    magnitudeBases: Object.freeze(['rs_vs_peers']),
    directionBases: Object.freeze(['rs_vs_peers']),
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

// N3 Amendment C: `activeReporters` is DERIVED from the allowlist keys —
// never a hand-count (seam-count readings of 7 or 8 would brick the
// editorial gate forever). The P2-35 CI assertion pins the count at 5 so a
// sixth reporter fails CI instead of silently making every week
// `insufficient` (minimumSize 3×6=18 still fits the ceiling, but the
// assertion forces the growth to be a REVIEWED editorial-sizing decision).
export const WIRE_ACTIVE_REPORTERS = Object.freeze(Object.keys(REPORTER_EVENT_ALLOWLIST));

// ── Static basis scope classification (N3, Calibration Addendum §3) ──────
// The R4-M1 binding precondition consults this: a figure BINDS to
// `primaryTicker` only when its basis is statically `ticker_scoped`;
// `market_scoped` bases verify through their subject legs (index proxy,
// econ subjectRef, sector ETF), never through ticker binding. Recorded at
// FINAL LOCK verbatim: index_vs_prior_close, print_vs_expected,
// consensus_estimate, prior_print, sector_vs_spy classify market_scoped;
// the rest ticker_scoped. (consensus_estimate / prior_print appear only on
// the two preview rows — both CIRCULAR, never adapted — so their scope is
// recorded but structurally unconsulted in Phase 2.)
export const BASIS_SCOPE = Object.freeze({
  price_vs_level: 'ticker_scoped',
  volume_vs_avg: 'ticker_scoped',
  range_vs_atr: 'ticker_scoped',
  price_vs_prior_close: 'ticker_scoped',
  gap_vs_prior_close: 'ticker_scoped',
  eps_vs_consensus: 'ticker_scoped',
  revenue_vs_consensus: 'ticker_scoped',
  rs_vs_peers: 'ticker_scoped',
  index_vs_prior_close: 'market_scoped',
  print_vs_expected: 'market_scoped',
  consensus_estimate: 'market_scoped',
  prior_print: 'market_scoped',
  sector_vs_spy: 'market_scoped',
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
