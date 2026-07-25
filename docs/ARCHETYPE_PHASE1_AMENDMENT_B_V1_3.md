# Phase 1 Master Spec — Amendment Sheet B (V1.2 → V1.3)

**Date:** July 23, 2026 · **Trigger:** Phase 2 exit (PR #651 merged). Ratifies the two items accumulated on the founder-directed Amendment B ledger during the Phase 2 build. V1.3 = V1.1 + Sheet A + this sheet.
**Scope discipline:** both items are implementation-mapping ratifications surfaced by build/review — neither changes a Decision Record or a Phase 1 ruling.

---

## B-1. `valueParamKey` joins the guardrailBinding descriptor (§5.1)

The Spec's eight binding-descriptor fields (`type, scope, basis, unit, trigger, side, resetBehavior, evaluationTiming`) define how a rule's semantics must match a supported guardrail shape, but never state **where the compiled value comes from**. Ratified as implemented in P2.3 (`compileBuild.js`):

- The descriptor gains a ninth required field, **`valueParamKey`** — an explicit pointer into the rule's frozen `ruleSnapshots[].paramValues`.
- Resolution failure (absent key, unresolvable path, non-numeric value where the binding demands one) is an **authoring error**: compilation of that rule fails loudly; the compiler never guesses, defaults, or falls back to advisory silently. (An authored `advisoryDowngrade` tension treatment remains the legal route to advisory.)
- Phase 3 authoring format MUST populate `valueParamKey` for every rule carrying a `guardrailBinding`; the fixture metadata already models this.

## B-2. `strategyPreset` default bound to one constant

Code-review finding 8: the battle-creation preset default (`agentBattleService.js:216`, `'balanced'`) and the manifest builder's preset layer default are independent string literals — documented deliberate duplication during P2.5, since binding them required a fenced edit outside that commit's sign-off.

Ratified contract: one exported constant, `DEFAULT_STRATEGY_PRESET`, owned by a non-fenced module and imported by both sites. The manifest may never disagree with the battle doc on the default by construction (§9 display-agreement applied to defaults).

**Transitional rule (R1 finding 13):** until `agentBattleService` imports `DEFAULT_STRATEGY_PRESET`, both defaults are pinned to `'balanced'`; neither value changes unless both sites change in the same §7-gated commit; a parity test asserts the battle-creation default equals the manifest builder default.

**Execution note (not part of this sheet's ratification):** the one-line fenced edit to `agentBattleService.js` rides the **next §7-gated arc that touches that file** (expected: Phase 3 reader-migration work) — logged on that arc's ledger now so it cannot be dropped. No dedicated branch; no urgency while both literals read `'balanced'` and the P4 battery photographs the doc.

---

## ChatGPT closure-pass relay instruction (verbatim)

"Closure pass only, per the every-phase review rule. Two ratifications: B-1 adds a ninth required field (`valueParamKey`, a pointer into frozen paramValues, loud-fail on unresolvable) to the §5.1 guardrailBinding descriptor; B-2 binds the battle and manifest strategyPreset defaults to a single exported constant, with the fenced edit riding the next signed arc. Confirm neither ratification (a) contradicts a V1.2 contract or Decision Record, (b) creates a new enforcement or provenance gap, or (c) requires a transitional rule the sheet omits. Verdict: RATIFY or the specific defect."
