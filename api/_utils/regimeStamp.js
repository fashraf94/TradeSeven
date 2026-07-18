// api/_utils/regimeStamp.js
//
// Corpus Capture Patch W3 — the `regimeAtStart` stamp on agentBattles docs.
//
// WHY: no battle carries a regime stamp, and the regime source docs are
// overwrite-in-place singletons (Discovery A3 / P1 flag #1) — "regime during
// battle X" is unrecoverable after the next cron run. This stamp is the
// minimum that unblocks T3 (regime-conditional) learning and trial
// conditioning, forward-only from the flip date.
//
// SEMANTICS (Build Spec §5, founder-confirmed item 6):
// - FIRST-EVALUATION-TICK stamping in the (non-fenced) evaluator — an
//   AWAITING_OPEN pod gets stamped when the battle actually begins, not when
//   the draft was created. Hence `regimeAtStart`, deliberately NOT
//   `regimeAtCreation`.
// - WRITE-ONCE, IF-ABSENT: stamp only when the field is undefined on the doc;
//   never overwrite. Idempotent under retries. A missing marketContext doc
//   skips the pass (the next tick retries) rather than burning the write-once
//   slot on an empty stamp.
// - STALENESS IS RECORDED, NOT ADJUDICATED: an old `updatedAt`
//   (weekend/holiday) still stamps — `observedAt` lets consumers judge
//   freshness. The stamper stays dumb. Likewise an 'unknown' regime string is
//   recorded verbatim, never coerced.
// - ZERO ADDED READS: the evaluator already loads
//   indexIntelligence/marketContext once per battle in its parallel getAll
//   batch; the stamp reuses that in-scope doc. The DRB is NOT read in the
//   tick and no DRB read is authorized (founder ruling) — drbRegime /
//   drbForDate stay null.
//
// Pure module: no Firestore I/O, no imports — the cron owns the write. This
// split exists so write-once / flag-off / shape semantics are behaviorally
// unit-testable (the evaluator handler itself is not decomposed for that —
// see agent-evaluate.test.js's static-guard preamble).

/** Bump if the stamp's regime taxonomy ever changes meaning. */
export const REGIME_STAMP_TAXONOMY_VERSION = 1;

/** The stamp's provenance literal — the one doc the regime is read from. */
export const REGIME_STAMP_SOURCE = 'indexIntelligence/marketContext';

/**
 * Should this evaluation pass stamp `regimeAtStart` on this battle?
 *
 * True iff: the flag is on, the battle doc does not already carry the field
 * (write-once — `=== undefined` mirrors the migration-fields precedent; an
 * explicit null is still "present" and is never overwritten), and the
 * marketContext doc was actually loaded this tick (doc-missing ⇒ false ⇒ the
 * next tick retries instead of stamping an empty shell).
 *
 * @param {{ battle: object, marketContext: object|null, enabled: boolean }} args
 * @returns {boolean}
 */
export function shouldStampRegime({ battle, marketContext, enabled } = {}) {
  if (!enabled) return false;
  if (!battle || battle.regimeAtStart !== undefined) return false;
  if (!marketContext || typeof marketContext !== 'object') return false;
  // /code-review fix: a doc that EXISTS but carries no regime label (partial
  // upstream write) must not burn the write-once slot with an all-null stamp
  // — skip and let the next tick retry, exactly like the doc-missing case.
  // An 'unknown' regime is a real label and still stamps (recorded verbatim,
  // never adjudicated); only a missing/non-string label skips.
  if (typeof marketContext.regime !== 'string' || marketContext.regime.length === 0) return false;
  return true;
}

/**
 * Build the immutable `regimeAtStart` stamp from the in-scope marketContext
 * doc. Shape per Build Spec §5.3. Missing fields stay null (recorded, never
 * fabricated); Firestore Timestamp values pass through untouched.
 *
 * @param {object} marketContext - indexIntelligence/marketContext doc data
 * @param {string} nowIso - stamp time, ISO string (caller supplies)
 * @returns {object} the regimeAtStart stamp
 */
export function buildRegimeAtStart(marketContext, nowIso) {
  return {
    // Canonical market-level taxonomy: bull | correction | bear | recovery
    // (classifyRegime), with 'unknown' possible upstream — recorded verbatim.
    regime: marketContext?.regime ?? null,
    source: REGIME_STAMP_SOURCE,
    // The doc has no forDate (Discovery note #31) — carry its updatedAt.
    observedAt: marketContext?.updatedAt ?? null,
    // No DRB read is authorized in the tick (founder ruling, item 6) — these
    // secondary fields ship null until a future patch pays for that read.
    drbRegime: null,
    drbForDate: null,
    // Deliberately NOT null-coalesced: nowIso is required and caller-supplied;
    // a forgotten argument should surface loudly (Firestore rejects undefined)
    // rather than persist a silent permanent null on a write-once field.
    stampedAt: nowIso,
    taxonomyVersion: REGIME_STAMP_TAXONOMY_VERSION,
  };
}
