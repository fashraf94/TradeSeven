# Authoring Guide — Amendment V1.2 (Vocabulary Ratifications)

**Date:** July 23, 2026 · **Trigger:** Batch 1 review [GUIDE-DEFECT] — §7's optional-field set shipped without vocabularies or registries, forcing ad-hoc invention mid-batch. **Guide V1.2 = Guide V1.1 + this sheet.** Non-blocking to Batch 1 (accepted with fixes); binding on Batch 2 onward.

## C-1. `secondaryEffects` closed vocabulary
Legal values: `conditional_tightening` · `posture_shift` · `scope_narrowing` (definitions per Batch 1 V1.1 conventions). Extension is by amendment to this guide only — a batch may propose a new value in its findings section but may not use it until ratified.

## C-2. `predicateDefined: boolean` (optional field, default `true`)
For rules whose trigger has no bound signal or defined threshold. The honest alternative to inventing signals. A `predicateDefined: false` rule can never earn `effectiveEnforcement:'deterministic'` until the predicate is defined and bound — the field is a standing gate, not a shrug.

## C-3. `copyClass` present-truth rule
`copyClass ∈ {deterministic, advisory}` only — no pending/conditional states. The value records enforcement truth at authoring HEAD; it flips to `deterministic` only as part of the compile-verification event itself (same event-coupled discipline as the `missingDataFallback` flip). Batch files may carry a prose flip-note; the field carries a legal value.

## C-4. `receiptTag` namespace + cumulative registry
Category prefixes reserved: `rsk_ xst_ alc_ tec_ fun_ mid_ gst_ thr_ tir_ ins_ ent_ reb_ ssn_`. Each batch's Appendix A carries the cumulative registry; uniqueness is re-verified per batch. Tags are permanent and never reused, including for deprecated rules.

## C-5. Book-scope clarification (§7)
`eligibility_constraint` covers conditions over the resulting book (spread, composition, cap structure), not only per-candidate properties — "candidate invalid when the condition fails" includes book-state conditions.

**Closure:** verified as a line item inside the Batch 2 review package (no separate round).


---

## V1.2.1 Addendum (Jul 24 — ratified/logged in Batch 2 V1.3 + Batch 3 R1)

**C-6 (RATIFIED, Batch 3 R1):** a `guardrailBinding` or `guardrailBindingCandidate` may be authored ONLY by copying the eight descriptor tokens verbatim from `SUPPORTED_GUARDRAIL_SHAPES` and appending `valueParamKey`. Divergences from the rule's semantics go in explicit mismatch notes. Authors never synthesize descriptor vocabulary from intent. (Origin: Batch 2 V1.3 Finding 8 — three descriptors with 4/8 invented tokens each.)

**C-7 (LOGGED — Amendment-C-class engine item, not a guide rule):** the shape contract's `trailingStop.basis:'hwm'` misdescribes the engine's modeled-ATR-peak trailing line (arms only in-profit with valid `baseATR`). Fix belongs in `compileBuild.js` (declare the real basis); metadata cannot repair a false substrate contract locally. (Batch 2 V1.3 Finding 9.)

**C-8 (RATIFIED, Batch 3 closure):** `secondaryEffects` value `initial_allocation_policy` — a rule clause that sets initial capital/reserve allocation at battle start, distinct from its ongoing mechanism. First client: sr-02's Day-1 reserve clause.


---

## V1.2.2 Addendum (Jul 24 — Batch 4 L1 ratifications)

**C-9 (RATIFIED):** eval-render token cap **240** (supersedes 175, which was authoring-side estimation conflicting with R1-9 mandatory coverage; measured renders 179–209). CI asserts **≤1050 characters** — a deterministic offline ceiling *correlated with* the measured 240-token budget, never claimed as mathematical proof of token count. Renders re-measure and re-record after every renderer change. The DR-13 subordination clause's wording of record: "Platform limits and enforced values override this identity. Your equipped rules refine how you apply these principles but never reverse them."

**C-10 (RATIFIED):** unverified-signal formalization — `availabilityStatus: UNVERIFIED` · `verificationId: null` · compat-cell citation prohibited until a SIG row is minted. Metadata may cite with the status disclosed inline.

**C-11 (LOGGED — proposed, not ratified):** clause-level dependency metadata (which signals belong to which clause of a compound rule, and per-clause failure behavior). If the entry-38 pattern recurs, this becomes a schema amendment; scalar fields must never encode clause-scoped meaning.


---

## V1.2.3 Addendum (Jul 24 — Batch 5 R1 ratifications)

**C-12 (RATIFIED):** BATTLE_STATE signal class — `sourceClass: BATTLE_STATE · scope: battle|season · availabilityStatus: VERIFIED|FIELD_UNVERIFIED · verificationRef: file:line|null`. Bare [B]/[B-season] notation means FIELD_UNVERIFIED unless a verificationRef is supplied; [B-season] is a scope, never a separate class. Compat cells may not cite FIELD_UNVERIFIED battle-state fields (the C-10 mirror).

**C-13 (PROMOTED from C-11 — schema amendment, binding BEFORE compat-cell authoring):** clause-level signal dependencies. `requiredSignals` splits into **primary / secondary / exception** dependency tiers with per-tier missing-data behavior: missing secondary or exception data disables *that clause only*, never the primary mechanism (the mb-10/mb-11/gs-06/ss-02 pattern; f-13 was the first sighting). Recurrence condition met per Batch 5 R1; full-corpus retrofit happens per-rule at cell authoring, with the four Batch-5 exemplars retrofitted in the batch itself as first clients.
