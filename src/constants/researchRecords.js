// src/constants/researchRecords.js
//
// Pilot P2 — THE RESEARCH-RECORD VOCABULARY, one source for the server and the
// Forge (pilot spec docs/specs/20260923_BAGGERBOMB_PARTNERSHIP_PILOT_SPEC_V1_4.md
// §3–§4; the P2 build prompt's "The research record"). The server's record
// model (api/_utils/researchRecords/model.js) and the Forge's research line
// (src/components/Forge/Watchlist/ideaCopy.js) both import from here, so the
// stage order the server writes is the order the Forge reads (BUILD_RULES §9).
//
// PURE and dependency-free: no imports at all, so it is Node-clean for the
// api/ importers under the BUILD_RULES §4 import rule (their test imports are
// the dependency-surface guard).

/** Where a research run came from. `analysis` is a session over a SAVED list. */
export const RESEARCH_ORIGINS = Object.freeze(['signaldrop', 'theme', 'screener', 'analysis', 'manual']);

/** A record is `open` until its host closes it; a session that never closes stays open (that is honest, not a bug). */
export const RESEARCH_STATES = Object.freeze(['open', 'completed', 'abandoned', 'failed']);
export const RESEARCH_TERMINAL_STATES = Object.freeze(['completed', 'abandoned', 'failed']);

/** The cumulative funnel (spec §3), in PIPELINE ORDER — the Forge renders in this order. */
export const RESEARCH_STAGES = Object.freeze([
  'universeSize', 'matchedPreLimit', 'shortlisted', 'selectedForInvestigation', 'investigationsCompleted', 'eligible',
]);

/**
 * The stages each origin's host actually has (the build prompt's per-origin
 * table, as built). Every other stage is `null` on that origin's record —
 * never 0: a 0 claims the stage ran and nothing reached it.
 */
export const STAGES_BY_ORIGIN = Object.freeze({
  signaldrop: Object.freeze(['shortlisted', 'selectedForInvestigation', 'eligible']),
  theme: Object.freeze(['shortlisted', 'selectedForInvestigation', 'eligible']),
  screener: Object.freeze(['universeSize', 'matchedPreLimit', 'shortlisted', 'eligible']),
  analysis: Object.freeze(['selectedForInvestigation', 'investigationsCompleted']),
  manual: Object.freeze([]),
});

/** A symbol's terminal outcome — disjoint within the cohort. `null` only while the record is open and nothing has decided it yet. */
export const SYMBOL_OUTCOMES = Object.freeze(['eligible', 'rejected', 'data_missing', 'cancelled', 'failed']);

/** The kind a hypothesis version's evidenceRefs[] uses to cite a research record. */
export const RESEARCH_EVIDENCE_KIND = 'researchWork';
