# Phase 3 Metadata — Batch Review Package (Batch 2: EXIT_STOPS + ENTRY_CRITERIA)

**For:** ChatGPT · **Date:** July 24, 2026 · **Artifacts under review:** `PHASE3_METADATA_BATCH5_INBATTLE_V1.md` · plus one long-outstanding line item on the attached `PHASE3_METADATA_BATCH2_STOPS_ENTRIES_V1_3.md`:
- **L1 — Render token-cap change (ratify):** CC's DR-13 Phase 0 measured all six golden renders at 179–209 real tokens against the documented 175 cap — the declared ~175s were authoring-side estimation, and the cap conflicts with R1-9's mandatory-coverage rule as authored. Founder-ruled: cap raised to **240 tokens**, CI asserts **≤1050 characters** (deterministic, offline), measured equivalence recorded in the contract, R1-9 coverage preserved untouched. Ratify the change to this reviewer-locked value (the 175 references in the guide/constitutions sweep on your ratification), or state the objection.
**Review type:** BATCH EXECUTION PASS — not a design round. **Target: ONE round.**

---

## 1. Where this sits

You reviewed and locked the Phase 3 design package (six archetype constitutions + Authoring Guide V1.1 + Amendment Sheet B) across five rounds; verdict LOCK-READY. **That design is now locked and is not under review here.** Batches 1–4 are accepted — 92/143. **This is the final batch: 51 templates across the five in-battle/lifecycle families. On acceptance, the base-metadata denominator closes at 143/143.** It declares one new signal class ([B] battle-state), logs the corpus's largest coherent substrate gap (dynamic modulation), and marks the institutional family wholly [U].

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

**MV-3 · The [B] battle-state class.** Ratify or reject the declared class (engine-owned battle/eval-context fields, present by construction, SIG-mint inapplicable, unverified-field discipline mirroring C-10). Then attack the assignments: any [B] that is actually a stock-doc signal (or vice versa) is a finding, as is any [V] lacking its SIG id.

**MV-4 · Fallback legality** per §5.4 across all 12, including the two candidates' conditional flips.

**MV-5 · posture_shift ×5.** The vocabulary value found its natural family (gs-04/05/06, th-10, ss-02). Attack each: is the posture language a genuine secondary effect riding a concrete mechanism, or is any of the five a single mechanism mislabeled — and conversely, do any of the 46 zero-effect entries (mb-10's exception clause, mb-11's focus lean, ss-01's conditional shift) hide a genuine second mechanism?

**MV-6 · The batch's three structural claims.** (a) The dynamic-modulation gap (Finding 3): nine rules modulating engine-real parameters with no rule→parameter path — verify the family membership and that "advisory today, named future arc" is the right disposition rather than nine individual candidates. (b) The wholesale-[U] institutional family (Finding 4): confirm advisory-on-unverified-data is correctly the weakest honesty class and its cell-blocking follows from C-10. (c) The corroboration tally (Finding 7 — computed this time): 13 rules / 17 claims incl. the program's first analyst core_conflicts; verify against the rubrics.

**MV-7 · Conventions.** `receiptTag` values are permanent identifiers (`rsk_*` here). Is the namespace sound and collision-safe across 143 rules and 12 remaining categories?

## 5. Caveat

You do not have repo access, and the rule texts, parameters, bounds, and stored compat states quoted in the batch come from a verified corpus export (module-import extract, adversarially re-checked, zero discrepancies). Treat those as given. Flag anything **internally inconsistent** within the artifact, but do not speculate about values you cannot see.

## 6. Verdict format

Findings numbered, standard severity (`BLOCKER | MAJOR | MINOR | QUESTION`), each naming the entry number and the smallest fix. Then one line:

**BATCH ACCEPTED** (may enter the gate count once the named CC verification items resolve) — or — **BATCH REJECTED**, with the specific defects.
