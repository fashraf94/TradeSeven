# Phase 3 Metadata — Batch Review Package (Batch 2: EXIT_STOPS + ENTRY_CRITERIA)

**For:** ChatGPT · **Date:** July 24, 2026 · **Artifacts under review:** `PHASE3_METADATA_BATCH4_SIGNALS_V1.md` · plus one ratification line item:
- **L1 — Render token-cap change (ratify):** CC's DR-13 Phase 0 measured all six golden renders at 179–209 real tokens against the documented 175 cap — the declared ~175s were authoring-side estimation, and the cap conflicts with R1-9's mandatory-coverage rule as authored. Founder-ruled: cap raised to **240 tokens**, CI asserts **≤1050 characters** (deterministic, offline), measured equivalence recorded in the contract, R1-9 coverage preserved untouched. Ratify the change to this reviewer-locked value (the 175 references in the guide/constitutions sweep on your ratification), or state the objection. **Same item, second ratification:** the DR-13 subordination clause ships as a shared renderer-level suffix in this smoothed wording of record — "Platform limits and enforced values override this identity. Your equipped rules refine how you apply these principles but never reverse them." — rather than the spec parenthetical's draft phrasing; confirm the smoothed form as the operative text.
**Review type:** BATCH EXECUTION PASS — not a design round. **Target: ONE round.**

---

## 1. Where this sits

You reviewed and locked the Phase 3 design package (six archetype constitutions + Authoring Guide V1.1 + Amendment Sheet B) across five rounds; verdict LOCK-READY. **That design is now locked and is not under review here.** Batches 1–3 are accepted — 53/143. This is Batch 4: 39 templates (technical 25 + fundamental 14), the signal family — the largest and most homogeneous batch, entirely gate-relevant. It introduces a **compressed entry format with declared batch-level defaults** (itself submitted for ratification) and rests on one structural finding: most fundamental sub-metrics have no verified SIG row.

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

**MV-3 · The [U] signal-status system.** The batch marks every required signal [V]/[U]/[CAL] and proposes the interim rule: metadata may cite [U] signals with status disclosed; compat cells may NOT until a SIG row is minted by the proposed CC signal-inventory read. Ratify or reject that rule; and attack the statuses themselves — any signal marked [V] that the SIG table doesn't actually cover is a finding (the SIG-001…008 table is in the guide you hold).

**MV-4 · Fallback legality** per §5.4 across all 12, including the two candidates' conditional flips.

**MV-5 · The compressed format + one secondaryEffects use.** Batch-level defaults replace per-entry repetition (declared in the header). Attack: (a) any entry whose omitted field should differ from a default; (b) the single `conditional_tightening` on f-09 — right call? — and any of the 38 zero-effect entries hiding a genuine second mechanism (tv-02's action select and tv-13's tier assignment were classified into intendedMode instead — verify).

**MV-6 · intendedMode fidelity at scale.** 39 assignments across the eligibility/scoring/execution lines, several judgment calls flagged inline (t-11 and t-14 as eligibility despite preference language; tv-02, tv-13, tv-23/25 as execution on their action clauses; tv-06 as scoring with tierRule as parameter). Attack the line-drawing systematically — an inconsistent pattern across similar rules is a finding even if each call is individually defensible. Also verify the 21 claimed CC corroborations against the six rubrics (the double-CC claims on fund-value-pe and f-10 especially).

**MV-7 · Conventions.** `receiptTag` values are permanent identifiers (`rsk_*` here). Is the namespace sound and collision-safe across 143 rules and 12 remaining categories?

## 5. Caveat

You do not have repo access, and the rule texts, parameters, bounds, and stored compat states quoted in the batch come from a verified corpus export (module-import extract, adversarially re-checked, zero discrepancies). Treat those as given. Flag anything **internally inconsistent** within the artifact, but do not speculate about values you cannot see.

## 6. Verdict format

Findings numbered, standard severity (`BLOCKER | MAJOR | MINOR | QUESTION`), each naming the entry number and the smallest fix. Then one line:

**BATCH ACCEPTED** (may enter the gate count once the named CC verification items resolve) — or — **BATCH REJECTED**, with the specific defects.
