# Phase 3 Metadata — Batch Review Package (Batch 2: EXIT_STOPS + ENTRY_CRITERIA)

**For:** ChatGPT · **Date:** July 24, 2026 · **Artifacts under review:** `PHASE3_METADATA_BATCH3_BOOKSHAPE_V1.md` · plus two line items on the attached `PHASE3_METADATA_BATCH2_STOPS_ENTRIES_V1.md` (now V1.3):
- **L1 — Promotion-execution record:** after your R3 acceptance, a CC read verified sx-01/sx-02 ride the identical dimension bridge as se-07; their pre-authorized promotion notes executed atomically (copyClass→deterministic, real detectors, fallback→block, writer stamps). Verify this was execution of the ratified mechanism, not a silent reopen — and that sx-02's NEW escalated copy defect (engine uses a modeled ATR peak, never a "highest closing price"; cannot arm unless in-profit with valid baseATR) is correctly recorded.
- **L2 — V1.3 Findings 8–12:** notably Finding 8 (all three V1.2 descriptors used invented tokens — 4 of 8 fields wrong each — now corrected against the verbatim shape quote, with the standing rule "descriptors only by copying the verbatim shape + valueParamKey" proposed as a guide amendment) and Finding 9 (the shape contract's `trailingStop.basis:'hwm'` misdescribes the engine's modeled-ATR peak — flagged Amendment-C-class). Confirm the standing rule should be ratified.
**Review type:** BATCH EXECUTION PASS — not a design round. **Target: ONE round.**

---

## 1. Where this sits

You reviewed and locked the Phase 3 design package (six archetype constitutions + Authoring Guide V1.1 + Amendment Sheet B) across five rounds; verdict LOCK-READY. **That design is now locked and is not under review here.** Batches 1 (12) and 2 (15) are accepted — 27/143. This is Batch 3: 26 templates (allocation 11 + tier_strategy 10 + rebalancing 5), the book-shape family — and the first heavily gate-relevant batch (21 of 26 clash/both). Authored under Guide V1.2 + ratified Sheet C (C-7 conventions + the Finding-8 verbatim-token rule).

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

**MV-3 · Verbatim-token compliance + the lone candidate.** This batch claims zero authoritative bindings and one candidate (alloc-sector-cap), authored under the Finding-8 rule with two declared divergences (rebalance-vs-entry_block trigger; named-sector param the shape can't express). Verify every descriptor token against the verbatim shape quote in Batch 2 V1.3; verify no other entry SHOULD have carried a candidate (sr-01's maxPosition shape is deliberately unsupported — confirm `none` is right, not a candidate).

**MV-4 · Fallback legality** per §5.4 across all 12, including the two candidates' conditional flips.

**MV-5 · Compound rules.** `secondaryEffects[]` used ZERO times across 26 entries — the batch treats every demote+promote pair (ts-05/06), hysteresis reversal (ts-07), and time-scoped release (ts-09) as ONE tier-reallocation mechanism, and every select/toggle as a parameter. This is the strongest withholding claim yet — attack it: find the entry where the second clause is genuinely a second mechanism.

**MV-6 · The batch's semantic rulings + disagreement flags.** (a) The two header rulings — sector-pct rules are slot-expressible under equal weight (C-1 pattern for tiered), and season mode has real position sizing so the sr-* rules do NOT inherit Batch 1's vacuity ruling: verify both from the artifact's own reasoning. (b) The two NEW kernel↔map flags — alloc-tier-preference (stored contrarian CC vs. the R1-8 full-domain rule, `'undervalued'` in the param domain) and a-08 (stored contrarian CC vs. the founder-ruled name-level inversion), with tv-14 as the control case: is deferring both to cell time right, and is the tv-14 contrast sound? (c) The proposed `conflictGroup: position_sizing` (sr-01+sr-04, sourced from the corpus's own conflict note): confirm or reject the first use of that field.

**MV-7 · Conventions.** `receiptTag` values are permanent identifiers (`rsk_*` here). Is the namespace sound and collision-safe across 143 rules and 12 remaining categories?

## 5. Caveat

You do not have repo access, and the rule texts, parameters, bounds, and stored compat states quoted in the batch come from a verified corpus export (module-import extract, adversarially re-checked, zero discrepancies). Treat those as given. Flag anything **internally inconsistent** within the artifact, but do not speculate about values you cannot see.

## 6. Verdict format

Findings numbered, standard severity (`BLOCKER | MAJOR | MINOR | QUESTION`), each naming the entry number and the smallest fix. Then one line:

**BATCH ACCEPTED** (may enter the gate count once the named CC verification items resolve) — or — **BATCH REJECTED**, with the specific defects.
