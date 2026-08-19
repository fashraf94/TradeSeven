> **Provenance note:** founder upload (byte-exact below this note), added at the Ask 3 build kickoff (2026-08-19) per founder instruction, same relay pattern as the Aug 16 addendum. The upload's filename stem carried a browser download-copy suffix (`_V1_3`); committed under the canonical name every set citation uses (`…FOUNDER_RULINGS_V1`). Content below the rule is the founder's original, unmodified.

---

# Exit-Behavior Rebalance — Founder Rulings on Fable Review V1
## Tier 2 rulings, closed. Reads with Brief V2 + Fable Design Review V1.

**Date:** 2026-08-15
**Authoritative set for the Tier 2 build:** this document + `Exit-Behavior_Rebalance___Fable_Design_Review_V1` + `20260814_EXIT_BEHAVIOR_REBALANCE_TIER2_S7_BRIEF_V2`. Where they conflict, this document wins.
**Process:** CC runs Phase 0 (the eight P0-VERIFY items) → hard STOP → build spec per the sequence below → §7 gated build (dual adversarial review on every fenced diff, `/code-review` high effort regardless of size, calibration smoke where `agentArchetypeConfig`-adjacent, dark flags).

---

## The ten rulings

**R1 (F1) — Target semantics: option (a), uniform fire-at-X.** One semantic, one promise, every archetype. The channel determines the category: a numeric target set via Exit Discipline / the per-position lever is Category B (deterministic, fires at X); conversational "take profit-ish" direction is Category A (archetype-translated). TF's trail-tighten becomes a **Tier-3 conversational re-authoring proposal** — the agent may propose converting the target to a trail; only user consent re-authors the directive. Translation by consent, never unilateral.

**R2 (F2) — Bypass class: new `USER_DIRECTIVE_BYPASS_REASONS` constant** (additive keystone extension), consumed by Knob B (including `requireBenchPositive` bypass) and Knob C alongside the emergency set. The LOCKED emergency set stays semantically pure (*protective*); the new class is *the user's explicit deterministic order*. **The promise text carries the physics:** next-eval cadence (~15-min market hours), swap-not-sell, replacement availability, LOCK carve-out, one-exit-per-eval. Promise-true means the promise got more precise.

**R3 (F6) — Reason literal: `guardrail_profitTarget`.** Matches the guardrail family, kills the `profit_target`/`profit_take` grep collision. Contract test amended **additively in the same PR** as the new literal. **Meta-principle adopted:** `guardrail_profitTarget` mirrors `guardrail_stopLoss` across all four keyed subsystems (bypass class, receipt source, learning membership, calibration partition); deviations argued explicitly.

**R4 (F4) — D3 learning allowlist: EXCLUDE.** The brief's "presumably yes" is overruled. The allowlist is discretionary by name and by function; a deterministic fire contains no model judgment — including it teaches the learner engine physics. Mirror stops (P0-1 verifies their membership). Rule-quality signal ("was the user's target well-placed?") is a future, explicitly-partitioned channel if ever wanted — never the discretionary allowlist.

**R5 (F5) — DOCTRINE, permanent: no gate ever keys on `swapMotive`.** Motive is model-declared and unverifiable; motive-differentiated gates create motive-laundering by construction. Gates key on deterministic provenance (`reason`) only. Consequence: Ask 1 requires no fenced `agentArchetypeConfig` change.

**R6 (F8) — LOCK: mirror stops (P0-3 verifies); disclose the carve-out in the promise. The ATR-proximity deferral heuristic is REJECTED** (withdrawn — it was the brief's own float). A deterministic executor never second-guesses the user's order; badge-aware exit behavior lives in the rules layer where the user opts in (th-05/postThresholdAction). The executor is dumb and predictable by design.

**R7 (F9) — Contrarian: RESTORE, signal-grounded.** The grounding requirement likely explains the original drop (the constitution pass softened prose to what's actually computed — §9 discipline, not a philosophy reversal). The restored stance is authored against **observable signals only** (P0-6 inventories the battle-context indicator set); "resistance" language appears only where a resistance-adjacent read actually crosses. Same discipline for CN-05/CN-08 wording.

**R8 (F10) — SX-04 × mb-08: the executor wins over the prompt-delegated veto; the compiler flags the combination at equip time** (declared, not discovered). **Ask 2 authoring discipline adopted:** every archetype gains-stance is authored as a default over the existing postThresholdAction enum (TF ≈ EXTEND-leaning w/ trail-bank on reversal; CP ≈ LOCK-leaning; Speculator ≈ HARVEST_SWAP-leaning; Contrarian ≈ its asymmetric pair; Diversifier ≈ rebalance-trim; FI ≈ thesis-completion) with the yield clause in every identity block: *equipped exit rules outrank my instinct.* **Recorded deliberately:** CP's locked-P&L composition stays negative-skewed **by design** (do not misdiagnose as this bug's regression later); Speculator's stance text describes actual machinery (winner suppression → its banking is discretionary, not mechanical).

**R9 (F5) — Rollback trigger: committed NOW, N set at flip.** Shape: *if non-emergency swap rate rises >N% week-over-week against the pre-change baseline without a corresponding rise in hurdle-block rate, revert the prompt flag.* The trigger exists before the temptation to rationalize does. The Tier-1 motive baseline is **pre-treatment** — before/after evidence and the trigger's baseline, never a calibration anchor.

**R10 — Sequencing: build Ask 3 → Ask 1 → Ask 2. Flip Asks 1+3 together** (Ask 1's copy must be enforcement-true on day one; until Ask 3 ships, the prompt must not claim the engine enforces targets). Ask 2 flips after. Ask 3 merges dark behind its own flag regardless.

## Endorsed structural constraints (binding on the build spec)

- **F3 — Provenance purity:** the executor constructs its receipt from scratch (`exitReason: guardrail_profitTarget`, `source`, **`swapMotive: null`**), inherits nothing from any prior `haikuResult`; contract test pins motive-null on all deterministic reasons. The Tier-1 motive baseline stays clean.
- **F7 — Same-tick precedence, pinned by test:** emergencies → stops → target → discretionary (protective wins the narrative); most-breaching fires first under one-exit-per-eval; cross-type same-tick (stop on A, target on B) → protective first. Disclosed in the promise.
- **F11 — Kill the bug class:** one flag gates compiler acceptance AND executor registration; a **pairing test** asserts every shape in `SUPPORTED_GUARDRAIL_SHAPES` has a registered executor (or explicit displayed advisory classification) — no future shape enters promise-first; `targetFor(position)` override hook from day one (Tier-3-ready).
- **Ask 1 precedence, four layers** (replacing "constraints always override strategy preferences"): 1) deterministic floors/guardrails — acknowledged, never re-litigated; 2) user-equipped rules, hard then soft — **the inversion: user soft preferences outrank framework defaults and archetype stance**; 3) archetype stance — modulates *how*, never *whether*; 4) framework defaults. Post-executor SX-04 render: "the user's target is X; the engine enforces it; you may exit earlier in character; the target is never negotiable."
- **Anti-churn replacement (four parts):** physics (keystone — already live; record that the deletion is not loosening), pricing (decomposed crystallization cost as decision input — base ×10 + badge terms, decomposed unless synthesized parity is provable; §9 applies to prompt prose), character (Ask 2), measurement backstop (R9's trigger).
- **F12 pins:** gap-through fires at market at next eval (no trail reinterpretation); user-directive class fires through gameplan suppression, matching stops (P0-2; if stops turn out suppressed, surface it — don't copy silently); entry baseline = the same entry definition the UI/ledger displays (P0-4); breaker bypass for user-directive reasons with the accepted volatile-name consequence noted.

## Phase 0 obligations (CC, file:line, before build)
1. D3 membership of `guardrail_stopLoss`/`guardrail_trailingStop` (R4).
2. Stop behavior on gameplan-suppression days (F12).
3. Stop behavior vs LOCK at the executor level (R6).
4. Entry-price definition at the executor's read site vs UI/ledger display (F12).
5. Threshold-proximity / badge data currently in the eval prompt context (pricing input; if distance-to-threshold is absent, it's a data add).
6. Battle-context technical indicator set (grounds R7's Contrarian wording).
7. Receipt-source regex compatibility with `guardrail_profitTarget` (R3).
8. `pickEmergencyReplacement` pool semantics for the target's replacement path (bench parity, hotBench recency, held-symbol exclusion, clean null).

## Out of scope (unchanged)
Tier 3: per-position conversational lever, directive-gate numeric translation, research-driven gameplan sessions (screener/correlation tools for agents). Crystallization math. HOLD/SWAP action space beyond the shipped motive enum.
