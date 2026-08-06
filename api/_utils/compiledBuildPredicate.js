// api/_utils/compiledBuildPredicate.js
//
// Composition PR 3 — THE A15 read predicate: is a CompiledBuild admissible
// as an identity source? PURE, ZERO imports — consumable by the compiler
// layer, the deploy path (PR 4), and the assembler-side advisory renderer
// without any surface contact (the M11 one-hop ban stays trivially clean).
//
// FAIL-CLOSED SEMANTICS: the predicate answers the CANDIDATE-boundary
// question only — illegal pairs and quarantined values. It deliberately does
// NOT require validation.pass (the Phase-2 ruling stands: §4.4 validation is
// a recorded field, not a deploy gate — metadata gaps are the activation
// gate's jurisdiction, not this predicate's).
//
//   inadmissible ⇐ build absent
//              ⇐ build.quarantined === true            (A7: out-of-domain value)
//              ⇐ any core_conflict/deferred verdict entry NOT blocked:true
//                                                      (A15: illegal pair must
//                                                       have failed closed)
//
// The assembler assertion (A15's second half): the advisory renderer calls
// this before rendering ANYTHING from a build; an inadmissible build renders
// nothing (fail closed — never a partial identity).

export const ILLEGAL_PAIR_VERDICTS = Object.freeze(['core_conflict', 'deferred']);

/**
 * @returns {{ admissible: boolean, reasons: string[] }}
 */
export function checkCompiledBuildAdmissible(build) {
  const reasons = [];
  if (!build || typeof build !== 'object') {
    return { admissible: false, reasons: ['build_missing'] };
  }
  if (build.quarantined === true) reasons.push('quarantined');
  for (const v of build.compatVerdicts ?? []) {
    if (ILLEGAL_PAIR_VERDICTS.includes(v.verdict) && v.blocked !== true) {
      reasons.push(`unblocked_illegal_pair:${v.ruleId ?? 'unknown'}:${v.verdict}`);
    }
  }
  return { admissible: reasons.length === 0, reasons };
}

/** Boolean convenience for read-path guards. */
export function isCompiledBuildAdmissible(build) {
  return checkCompiledBuildAdmissible(build).admissible;
}
