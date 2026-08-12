// api/_utils/__fixtures__/mandatePromptRegistry.js
//
// Spec 1 §3.2 — the mandate prompt-contributing registry + the CLOSED
// PROMPT-INPUT ALLOWLIST. Parallel to the battle C-20 registry
// (promptHonestyRegistry.js) but scoped to the mandate assembler, so the two
// subsystems' honesty sweeps never cross-couple.
//
// THE RULE (BUILD_RULES §1, §3.2): any module that renders text the mandate
// manager sees MUST be classified here in the SAME commit — as a prompt
// contributor or as prose-free infra. The tripwire in
// mandatePromptAssembly.honesty.test.js fails on any mandate-assembler local
// import classified in NEITHER list, so a new prose module cannot skip the sweep.
//
// ZERO imports on purpose (the promptHonestyRegistry precedent) — this module
// must never join a mocked graph.

// Modules that render text reaching the model (identity, context, tool schema).
export const MANDATE_PROMPT_CONTRIBUTING_MODULES = [
  'mandatePromptAssembly.js',
  'mandateContextBlock.js',
  'mandateDecisionTool.js', // the tool's description text is sent to the model
];

// Same-directory imports of the mandate assemblers that contribute NO prompt
// prose (pure math / config / snapshot readers).
export const MANDATE_PROMPT_CLASSIFIED_INFRA = [
  'mandateValuation.js',
  'mandateUniverseSnapshot.js',
  'mandateConfig.js',
];

// §3.2 CORE GUARD: identity is assembled from the PINNED vintage doc, NEVER from
// a live registry / model-config read. The mandate assembler must not import any
// of these live sources — the pinned `vintage` object is passed in as data.
export const MANDATE_FORBIDDEN_LIVE_SOURCES = [
  'archetypeRegistry.js',
  'mandateVintage.js',
  'mandateGenerationConfig.js',
];

// The closed set of sources the assembled prompt may draw from (§3.2).
export const MANDATE_PROMPT_INPUT_SOURCES = [
  'pinned_vintage', 'gate_config', 'book_state', 'tick_snapshot', 'static_scaffold',
];
