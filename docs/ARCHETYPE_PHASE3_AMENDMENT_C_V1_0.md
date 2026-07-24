# Phase 3 Design Package — Amendment Sheet C (V1.1)

**Date:** July 23, 2026 · **Amends:** the locked Phase 3 design package (six constitutions + Authoring Guide V1.2) and, where noted, Spec V1.3.
**Trigger:** six items accumulated on the Amendment-C watchlist across the sector-cap arc, the corpus export, the weight verification, and Batch 1's binding verifications. Locked artifacts change only by amendment — this is that amendment.
**Review status:** R1 closure pass returned C-2/C-4/C-5/C-6 **RATIFIED**; C-1 and C-3 blocked with prescribed fixes — **V1.1 applies both verbatim** and adds C-7 (three field ratifications surfaced by the Batch 2 R1 review). Round 2 verifies C-1/C-3 closure + C-7 only.

---

## C-1. Diversifier cap — mode-scope qualification (amends `CONSTITUTION_DIVERSIFIER_V1.md` kernel §6 + phase notes)

**Verified fact (sector-cap arc, `agentGuardrails.js:69,71`):** the Diversifier core concentration cap evaluates only in flat6 (`baggerbomb_tournament`); it does not exist in tiered mode. This is not an oversight to "fix" by extending the gate: the slot-count→percentage derivation is exact **only under equal weighting** (`flatMultiplier: 1.0`). In tiered mode, two same-sector slots can carry far more than two-sixths of scoring weight — a *weight-aware* cap is a different mechanism, not a config change.

**Amendment (targets EXPANDED per R1 — constitution AND Guide §6 + §10(b)):** the kernel's refusal "never permits a swap that pushes a sector past the cap — deterministic, not a conversation" is qualified: *deterministic in equal-weight modes; constitutional (identity-enforced, prompt-carried) in tiered modes pending a weight-aware cap, which is a logged future engine arc.* The compat rubric is unaffected — concentration-requiring rules remain core_conflict everywhere; only the enforcement-substrate claim is mode-scoped. **Guide lock criteria amended to match (closing the R1 contradiction):** *Diversifier's lock dependency closes when the flat6 cap is in enforce mode and verified. Tiered mode remains constitutionally enforced pending the separately specified weight-aware-cap arc and does not independently block V1 lock.* (Guide §6's "inert defining wire prevents lock" reads as satisfied by the flat6-enforce verification.) Verification note: the tiered-multiplier premise (`flatMultiplier: 1.0` flat6 vs. non-1.0 tiered) is CC-confirmed for flat6; the tiered-side multiplier values should be cited when the weight-aware arc is scoped.

## C-2. `learned` provenance sourceType (amends Spec §4.1 `effectiveParameters` provenance enum)

`sourceType` gains a seventh value: `learned` — for parameters and rules originating from the Agent Learning System's promotion pipeline ("learning proposes; the existing control system disposes"). A promoted claim compiles into a rule with full §5.1 metadata and enters the build delta or baseline rulebook through the normal admission machinery (kernel compat verdict included); it never becomes a fourth control channel. The manifest records `{sourceType:'learned', sourceId:<claimId>, maturityAtPromotion}` so receipts can attribute decisions to learned content and the displacement vector can measure whether learning pulls builds away from parent identity. **Admissibility rubric = the constitutions' compat rubrics, unchanged** — a statistically valid but archetype-illegal claim is core_conflict for that archetype and is retained as evidence about *other* archetypes (white-space discovery), not deleted.

## C-3. Presentation-vs-identity hash split (amends Spec §2.3 / registry contract — DEFERRED-ACTIVATION)

**REWRITTEN per R1 (the deferred-computation design was self-defeating — changing the hash computation later would change every identityHash with zero identity change, forcing the exact fleet rebase this item exists to prevent):** **both hashes are computed from the FIRST registry composition.** `identityHash` excludes Partner Contract and voice/display content from day one; `presentationHash` covers that content, hashing a defined empty/sentinel payload for archetypes whose Partner Contract is not yet authored. What is deferred is only the *use* of `presentationHash`: until the activation trigger (first post-launch Partner Contract edit, or the first time a presentation change would rebase >0 live user builds), it is recorded but participates in no build-validity or activation check. The split is a computation-day-one fact; activation is a policy flip, never a hash migration.

## C-4. FI deterministic admission gate — logged future engine arc (no artifact text change)

Formally logs what the corrected FI constitution and Guide §7 already state: **no deterministic shortlist/admission substrate exists at HEAD**, and building one (a real `fundamentalScore` gate at draft and/or swap) is a discrete future arc, fence-gated, with its own spec. Until it ships: all gate-shaped rules author `prompt_advisory`; the DR-13 identity block remains the only swap-time carrier of quality-floor language. This item exists so the arc has a name and cannot be "discovered" as a gap twice.

## C-5. ATR-unit stop shape — logged engine gap (Batch 1 verification, item 1)

The engine's `stopLoss` is pct-of-entry only; no supported guardrail shape carries an ATR basis/unit, so `risk-exit-atr-stop` (and any future ATR-denominated stop rule) cannot compile — correctly, per DR-4. Logged as an engine-shape gap with a strong feasibility note: the risk manager's trailing mechanism is already ATR-denominated (`position.baseATR`), so the unit exists engine-side. When scoped, the arc adds a fourth supported shape `{type: stopLoss, basis: entry, unit: atr}` + the select-param numeric migration, and the retained Batch-1 descriptor is its spec. Priority input: this unlocks the stop-family's archetype-differentiated bounds (Contrarian scalpel / Speculator wide / CP patient) on the corpus's main clash-mode stop rule.

## C-6. Two-writers reconciliation: dimension bridge vs. compiler (amends Spec §5.5 / DR-4 scope — **binding on Phase 4**)

**Verified fact (Batch 1 verification, item 2):** `deployedGuardrails.maxSectorWeight` already has a live writer at HEAD — the dimension bridge (`se-07` → `maxSectorWeightPct` → `dimensionsToGuardrails` → deploy), enforced by the cron. The Phase-2 compiler, when activated, would be a **second writer** of the same guardrail field — the exact two-sources defect this program exists to eliminate, one layer up.

**Amendment:** before the compiler may claim any guardrail type in production, Phase 4 must rule per type: (a) the bridge remains the sole writer and the compiler defers (records provenance only), or (b) the compiler subsumes the bridge's mapping for that type with the bridge retired as a writer, or (c) both write under the existing strictest-wins merge **with per-writer provenance mandatory** in CompiledBuild/manifest. No guardrail type may have two undeclared writers. Also logged: the stale `dimensionsToGuardrails` docstring ("nothing in the battle path reads them yet" — false since Phase 4B) joins the erratum list.

## C-7. Metadata field ratifications (from Batch 2 R1 — amends Guide §7 vocabulary)

Three ratifications, immediately binding on all batches (retroactively applied to Batch 1's two retained descriptors):
1. **`guardrailBindingCandidate`** — a distinct field for descriptors authored to a rule's semantics without a verified exact match against a quoted supported shape. `guardrailBinding` (authoritative) requires descriptor-exactness against the verified shape contract; candidates never compile and carry their open verification items inline.
2. **Writer-status stamps** on any deterministic enforcement claim: `enforcementProvenance` · `activeWriter` · `compilerEligibility` (e.g. `blocked_pending_C6`) — the C-6 gate expressed as data a future compiler can check, not prose it can miss.
3. **Present-truth restated field-wide:** no field may hold a transition plan or dual value (`missingDataFallback: 'x while advisory; y if verified'` is banned). Planned flips live in a non-field **Promotion note** and execute atomically with their verification event.

---

## Closure-pass relay instruction (verbatim, for ChatGPT)

"Round 2 — closure verification only. C-2/C-4/C-5/C-6 are ratified and unchanged. Verify: (1) C-1 now amends the Guide lock criteria per your prescribed language and the contradiction is closed; (2) C-3 now computes both hashes from first composition with sentinel payloads, deferring only presentationHash's operational use — your prescribed replacement, applied; (3) C-7's three field ratifications are coherent with §5.1 and the present-truth discipline. Verdict: SHEET RATIFIED or the specific residual defect."
