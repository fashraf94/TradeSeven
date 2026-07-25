// api/_utils/__fixtures__/promptHonestyRegistry.js
//
// C-20 prose-honesty registry — the ONE source for the forbidden/required
// signal lists and for WHICH modules the source sweep covers.
//
// Founder-ruled Jul 25 2026 (Fundamental Wire PR-A review, finding F2): the
// DR-13 flag-split pattern (dark render module + a one-import/one-call fenced
// splice) deliberately moves prompt prose OUT of the fenced assemblers — and
// therefore out of the sweep's original two-file scope. Every application of
// the pattern widens that hole unless the new module joins the registry, so:
//
//   THE RULE (BUILD_RULES §1): any module that renders prompt text via the
//   flag-split MUST be added to PROMPT_CONTRIBUTING_MODULES in the SAME
//   commit as the fenced splice. The import-classification tripwire in
//   agentEvalPromptAssembly.honesty.test.js fails CI on any fenced-assembler
//   import that is classified in neither list below.
//
// Lives in __fixtures__ (the controlsPromptFixtures precedent) so the two
// consuming test files cannot drift apart on these lists. ZERO imports on
// purpose — this module must never join a mocked graph.

// Signals that do not exist on any running path (Signal Inventory V2 §3B).
export const FORBIDDEN_SIGNALS = [
  ['5min RSI', /5-?min\s+RSI/i],
  ['5-minute MACD', /5-?min(ute)?\s+MACD/i],
  ['VWAP sigma-band', /std\s+below\s+VWAP|standard deviation.*VWAP/i],
  ['BB width 5th pctl (of-history implication)', /BB width 5th pctl/i],
  ['intraday range position', /intraday range\s*\n?\s*position|range position/i],
  ['52-week-high proximity', /within \d+% of 52W high/i],
  ['5-min price breakout', /5-?min price breaks/i],
];

// Signals that ARE supplied and must keep appearing in the eval system
// prompt — the guard against "fixing" prose by deleting it.
export const REQUIRED_SIGNALS = [
  ['cross-sectional BB width squeeze', /20th pctl/],
  ['rsPercentile', /rsPercentile/],
  ['NR7', /NR7/],
  ['stock regime', /directional_expansion/],
  ['RSI-14', /RSI-14/],
  ['BB %B', /BB %B/],
];

// Modules whose SOURCE is swept for FORBIDDEN_SIGNALS: the two fenced
// assemblers plus every flag-split prose module.
export const PROMPT_CONTRIBUTING_MODULES = [
  'agentEvalPromptAssembly.js',
  'agentPromptAssembly.js',
  'evalIdentityBlocks.js',   // DR-13 identity blocks (pre-existing split)
  'fundamentalsRender.js',   // Fundamental Wire Commit 2
];

// Every OTHER same-directory module the two fenced assemblers import,
// explicitly classified so the tripwire can tell "known" from "new". Two
// honest sub-groups, one list:
//   - data/infra imports that contribute no prompt prose (firebaseAdmin,
//     marketSchedule, ruleHardness, directiveUtils, agentScoring,
//     agentRegimeClassifier, analyticalPrimitives, leanRevalidation);
//   - PRE-REGISTRY prose contributors (controlPromptRenderer,
//     agentNewsContext, archetypeScoring's ARCHETYPE_CONSTRAINTS): listed
//     here for classification ONLY — this is NOT an assertion that they are
//     prose-free. Expanding the sweep to them is separately tasked; moving
//     one into PROMPT_CONTRIBUTING_MODULES must not happen silently as a
//     side effect of an unrelated commit.
export const CLASSIFIED_NON_REGISTRY_IMPORTS = [
  'agentNewsContext.js',
  'agentRegimeClassifier.js',
  'agentScoring.js',
  'analyticalPrimitives.js',
  'archetypeScoring.js',
  'controlPromptRenderer.js',
  'directiveUtils.js',
  'firebaseAdmin.js',
  'leanRevalidation.js',
  'marketSchedule.js',
  'ruleHardness.js',
];
