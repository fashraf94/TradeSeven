// api/_utils/compositionAdvisoryRender.js
//
// Composition PR 3 — the D3/A13 advisory renderer (the DR-13 flag-split
// pattern: dark render module + a one-import fenced splice in each
// assembler). Registered in PROMPT_CONTRIBUTING_MODULES in the SAME commit
// as the fenced splices (BUILD_RULES §1, the flag-split prose rule).
//
// SOURCE OF TRUTH (A25): the advisory sentences REACH this module only
// through the ACTIVATED CompiledBuild — never a registry read. The eval
// assembler's surface is the battle's frozen manifest slice
// (resolvedAgentManifest.compositionCompat — attached at battle creation from
// the deploy gate's build); the draft assembler's surface is
// `agent.compositionCompat`, which NOTHING populates in PR 3 (dark by
// absence) — the PR-4 sanctioned decide.js splice (already REQUIRED by the
// reversed derived-classification ruling) threads it from the loader.
//
// DARK POSTURE: COMPOSITION_COMPILED_IDENTITY_ENABLED=false ⇒ the index is
// null and appendCompositionAdvisory returns the rule text UNCHANGED —
// byte-identical prompts (the dark golden battery pins this). The advisory
// data itself only exists on candidate-mode builds, so flag-off is dark
// twice over.
//
// A15 (the assembler assertion): an INADMISSIBLE compat surface (quarantined
// build, unblocked illegal pair) renders NOTHING — fail closed, never a
// partial identity. A14: native/neutral rules have no advisory entry and
// render byte-identically. A13: the advisory lands on the equipped rule's
// OWN line, at most once — the index is consulted per rendered rule line and
// each rule renders on exactly one line per prompt.

import { COMPOSITION_COMPILED_IDENTITY_ENABLED } from './compositionConfig.js';
import { checkCompiledBuildAdmissible } from './compiledBuildPredicate.js';

/**
 * Build the per-prompt advisory index from a compat surface — either a full
 * CompiledBuild or the manifest's compositionCompat slice
 * ({ quarantined?, entries: [...] }).
 *
 * @returns null while dark or without a surface (render unchanged);
 *          a Map(ruleId → advisory) when lit and admissible;
 *          { inadmissible: true } when the surface fails the A15 predicate
 *          (renders nothing — the caller's append is a no-op, and the
 *          returned marker lets harnesses assert the fail-closed path).
 */
export function buildCompositionAdvisoryIndex(compatSurface, {
  enabled = COMPOSITION_COMPILED_IDENTITY_ENABLED,
} = {}) {
  if (!enabled || !compatSurface) return null;
  const entries = Array.isArray(compatSurface.compatVerdicts)
    ? compatSurface.compatVerdicts
    : Array.isArray(compatSurface.entries) ? compatSurface.entries : [];
  const { admissible } = checkCompiledBuildAdmissible({
    compatVerdicts: entries,
    ...(compatSurface.quarantined === true ? { quarantined: true } : {}),
  });
  if (!admissible) return { inadmissible: true };
  const idx = new Map();
  for (const e of entries) {
    if (e.verdict === 'tension' && typeof e.advisory === 'string' && e.advisory && e.blocked !== true) {
      idx.set(e.ruleId, e.advisory);
    }
  }
  return idx;
}

/**
 * D3: append the advisory to the equipped rule's OWN text, exactly once.
 * No entry (native/neutral/blocked), no index (dark), or an inadmissible
 * surface ⇒ the text returns UNCHANGED.
 */
export function appendCompositionAdvisory(ruleText, rule, index) {
  if (!index || index.inadmissible === true || typeof index.get !== 'function') return ruleText;
  const advisory = index.get(rule?.ruleId);
  if (!advisory) return ruleText;
  return `${ruleText} — Advisory: ${advisory}`;
}
