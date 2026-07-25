# Phase 3 Metadata — Batch Review Package (Batch 2: EXIT_STOPS + ENTRY_CRITERIA)

**For:** ChatGPT · **Date:** July 24, 2026 · **Artifacts under review:** `PHASE3_METADATA_BATCH2_STOPS_ENTRIES_V1.md` · plus one line item: confirm `ARCHETYPE_AUTHORING_GUIDE_AMENDMENT_V1_2.md` closes Batch 1's [GUIDE-DEFECT] (C-1…C-5 vocabulary/field ratifications)
**Review type:** BATCH EXECUTION PASS — not a design round. **Target: ONE round.**

---

## 1. Where this sits

You reviewed and locked the Phase 3 design package (six archetype constitutions + Authoring Guide V1.1 + Amendment Sheet B) across five rounds; verdict LOCK-READY. **That design is now locked and is not under review here.** Batch 1 (risk, 12 templates) was ACCEPTED in one round and is in the gate count. This is Batch 2: 15 templates (exit_stops 7 + entry_criteria 8), authored under Guide V1.2 (Batch 1's ratified conventions now formalized).

Twelve more batches follow. Please calibrate accordingly — batch passes must converge in one round or the authoring program stalls. **Raise defects in the entries, not preferences about the framework.** If you find a genuine defect in the locked guide itself, flag it separately as `[GUIDE-DEFECT]` — it does not block this batch and goes to a separate amendment.

## 2. Substrate facts you need (verified at HEAD, Jul 23)

- The corpus previously carried **zero** enforcement metadata. Every field in this batch is authored from scratch — there is no prior vocabulary to reconcile.
- **Only three deterministic guardrail shapes exist:** `stopLoss`, `trailingStop`, `maxSectorWeight`. `maxPosition` and `profitTarget` are deliberately unsupported (engine no-ops).
- **No deterministic admission/shortlist substrate exists.** Archetype quality floors and constraints are soft prompt text injected at draft assembly only; the eval/swap path never reads them. So `detectorSource: llm_prompt` and `copyClass: advisory` are the *honest* defaults, not laziness.
- `intendedMode` is **immutable per ruleId** and never varies by archetype (Spec §5.1). Archetype-relative modulation happens only via the `advisoryDowngrade` tension treatment, authored later.
- Fallback legality (§5.4): deterministic-enforced rules may only `abstain`/`block`/fail-compile; `ignore_rule` is legal **only** for advisory.
- Amendment B-1: every `guardrailBinding` carries nine fields including `valueParamKey`; unresolvable = loud authoring error. DR-4 forbids lossy coercion — a non-exact semantic match must **not** compile.

## 3. Explicitly OUT of scope for this batch

Compat cell verdicts · tension treatments · `paramBounds` · baseline rulebooks · Partner Contracts. Those are later steps under guide §8 (cells are authored rule-major with bounds atomically). **If the batch has authored anything belonging to those steps, that is itself a finding** (scope creep) — please check for it.

## 4. Attack vectors

**MV-1 · `intendedMode` fidelity.** Does each assignment match what the rule does to candidate/book flow rather than its tone? Attack the `eligibility_constraint` vs `execution_constraint` line specifically — several entries are book-scoped (composition, spread) rather than candidate-scoped; is `eligibility_constraint` right for those, or does book-scope need a different treatment the enum doesn't offer?

**MV-2 · Honesty in both directions.** Does any entry claim deterministic copy or enforcement it lacks? **And the inverse** — does any entry mark something advisory that the verified substrate actually enforces? (The inverse error was a real defect in the design round.)

**MV-3 · Binding descriptors + the first deterministic claim.** Three targets: (a) sx-01 claims the program's first EXACT-MATCH descriptor against the verified stopLoss shape — check all nine fields against the quoted shape contract; (b) sx-02's descriptor is authored to the rule's pct-from-HWM semantics while the engine's trailing math is ATR-multiple-from-peak — is the open verification correctly scoped, and is authoring the descriptor to the rule (not the engine) the right discipline? (c) se-07 carries the program's first `copyClass: deterministic`, resting on the verified dimension-bridge enforcement chain rather than the compiler — attack whether a bridge-backed deterministic claim is legitimate before Amendment C-6 formally classifies the bridge as a substrate, and whether the C-6 gating language in the entry is sufficient.

**MV-4 · Fallback legality** per §5.4 across all 12, including the two candidates' conditional flips.

**MV-5 · Compound rules.** `secondaryEffects[]` was used ZERO times in this batch — deliberately: sx-05's trigger select and sx-06's onlyIfProfitable toggle were judged parameters, not effects. Challenge both withholdings, and find any entry where a select/toggle actually changes the rule's *mechanism* rather than its scope.

**MV-6 · The batch's three claims.** (a) The season-only finding and its product consequence — "at launch, clash mode has no compilable stop rule at all" (Finding 2): verify the inference chain from the modes data given. (b) The sx-04 guardian flag — a potential kernel↔map disagreement deferred to cell time: is deferral right, or does it need resolution now? (c) The gate accounting — 27/143 metadata, zero of 702 cells: consistent with Spec §5.6 + A-4 as quoted?

**MV-7 · Conventions.** `receiptTag` values are permanent identifiers (`rsk_*` here). Is the namespace sound and collision-safe across 143 rules and 12 remaining categories?

## 5. Caveat

You do not have repo access, and the rule texts, parameters, bounds, and stored compat states quoted in the batch come from a verified corpus export (module-import extract, adversarially re-checked, zero discrepancies). Treat those as given. Flag anything **internally inconsistent** within the artifact, but do not speculate about values you cannot see.

## 6. Verdict format

Findings numbered, standard severity (`BLOCKER | MAJOR | MINOR | QUESTION`), each naming the entry number and the smallest fix. Then one line:

**BATCH ACCEPTED** (may enter the gate count once the named CC verification items resolve) — or — **BATCH REJECTED**, with the specific defects.
