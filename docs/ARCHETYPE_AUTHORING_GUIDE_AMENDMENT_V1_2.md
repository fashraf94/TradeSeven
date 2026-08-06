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


---

## V1.2.4 Addendum (Jul 25 — Signal Inventory V2 ratifications-pending; binding on cell authoring, line-itemed in the first cell-batch review)

**C-14 (status enum extension):** `VERIFIED (unwired)` — real, computed, persisted; no agent decision path reads it. Cells may NOT cite an unwired row as available evidence; metadata may reference it with status disclosed. Neither VERIFIED nor ABSENT expresses this truthfully. First clients: SIG-021…028, SIG-042 siblings (the `peerRankings` family).

**C-15 (dormant-path marking):** signals and predicates on the de-registered season evaluation path (SIG-029/036/037, the `seasonRuleRegistry` deterministic predicates, pit-stop state) are **DORMANT, not absent** — code-complete, unreachable at HEAD (Finding E, commit `d80aee25`). Cells citing them carry `pathStatus: dormant` and become live only on re-registration (a founder-gated scheduling decision, ~2 cron slots after the §6 pit-stop consolidation).

**C-16 (path-naming rule):** there is no single eval context — four assembly paths carry different fields (battle eval · BaggerBomb portfolio construction · tournament draft board · season daily eval). **Every compat cell citing signal availability names its path.** Notable asymmetries now verified: the draft board is institutionally and FantasyTimes-blind; the Sonnet shortlist call never receives the institutional block (weight-not-admit); VWAP is held-positions/exit-side only.

**C-17 (emergency-path statement):** `pickEmergencyReplacement` is signal-free (cooldown + asset-type filter, sorted by daily change alone) and emergency reasons bypass the hurdle and the swap-window cap. **Every cell asserting swap-in quality states its emergency-path behavior explicitly** — silence would re-create the exact promise-vs-machinery gap this program exists to close.

**C-18 (evidence-hygiene rules, from the author traps):** prompt prose, Forge rule text, and configuration sliders are never evidence of a signal (Finding B) · `technicalScore` is not sector-neutral (sectorRS is 15/100 of it — citing both double-counts) · null-laundering: `?? 50` composites make missing data look neutral — never treat a mid-range composite as proof its inputs existed · the rounding seam: bind boundary-valued predicates to ONE rendering (draft rounds, eval doesn't) · `arch_scores` is persisted but agent-invisible (rank-time recompute is what agents see) · the DR-13 identity block carries nothing until its flag flips — cells resting on that carrier are resting on a deliberately-dark wire and say so.


---

## V1.2.5 Addendum (Jul 25 — founder rulings)

**C-19 (FOUNDER RULING — SEASON MODE SCRAPPED):** season mode was deliberately scrapped in favor of league/flagship games and is not planned. The Jun-4 cron de-registration stands as the permanent state; the dormancy finding resolves as *intended, now formalized*. Consequences: (a) the **26 season-only templates** (`sx-*`, `se-*`, `sr-*`, `ss-*`) are `status: mode_scrapped` — metadata retained as record, excluded from every equip surface, **their compat cells are permanently out of scope** (they were already outside the 702 gate); (b) the `seasonRuleRegistry` deterministic predicates, SIG-029/036/037, and the pit-stop machinery are formally dead, not dormant-pending; (c) formal-shelving hygiene rides a docs PR: correct the falsified schedule comment (`season-daily-evaluate.js:9-11`), note the ruling in BUILD_RULES, leave handler deletion as optional cleanup. **Nuance preserved:** the three verified deterministic mechanisms (stop %, trailing %, sector cap) are **dimension-bridge features live in battles** — user strategy-lab dimensions, not corpus-rule equips — and are wholly unaffected by season's death.

**C-20 (FOUNDER RULING — THE RULE HONESTY GATE):** *"Only support and display rules that can actually be detected, verified, and enforced."* Elevated from authoring convention to product policy. Operationalized by the Rule Support Triage (companion document): every template classified by real substrate; ABSENT-signal rules are hidden or their substrate is built; prompt prose claiming nonexistent indicators is corrected; expansion arcs (institutional depth, added indicators/timeframes) proceed where build cost is low.


---

## V1.2.6 Addendum (Jul 31 — C-21, promoted to guide level at the C6 closure)

**C-21 · THE ACTION-PRECEDENCE CONTRACT (binding on all cell authoring; carried in every batch authority line as `conventions C-13…C-18, C-21`).**

> **Deterministic risk lines preempt advisory rules, always.** The engine's guardrail pass and `pickEmergencyReplacement` run *after* the model's decision and read no equipped-rule text. No advisory instruction — however absolute its wording, and regardless of whether it carries a carve-out — can suppress a stop-loss, a trailing-stop breach, a sector-cap block, or a bust-avoidance exit.

**What this means for authoring:**
1. **Compatibility evaluates advisory behavior only**, after deterministic platform and guardrail precedence has been applied. A rule cannot be graded as though it overrides a mechanism the runtime never lets it reach.
2. **A rule-level swap-block still binds the model's discretionary behavior** — profit-side exits, thesis-completion exits, opportunity-cost rotations, and discretionary swaps. That is where the kernels' exit doctrines mostly live, so swap-blocks are graded on *that* surface rather than dismissed as harmless.
3. **The absence of a carve-out proves nothing about protection.** (Origin: C6 V1.0 graded `mb-08` as a Guardian core_conflict for lacking an exception while grading `mb-10` neutral for having a narrow one — two readings of one unstated contract.)
4. **Receipts and tests:** a receipt may claim an advisory instruction was *rendered*; it may never claim a guardrail value changed. Acceptance tests verify prompt rendering and behavioral interpretation, never deterministic guardrail mutation.
