> **Provenance note:** founder upload (byte-exact below this note), added at the Ask 3 build kickoff (2026-08-19) per founder instruction, same relay pattern as the Aug 16 addendum. Content below the rule is the founder's original, unmodified.

---

# Exit-Behavior Rebalance — Fable Design Review V1
## Adversarial review of Tier 2 §7 Design Brief V2 (all three asks)

**Date:** 2026-08-15
**Reviews:** `20260813_EXIT_BEHAVIOR_REBALANCE_TIER2_S7_BRIEF_V2` (supersedes V1)
**Reads with:** Swap-Decision Audit, Ruled-Designs Verification Audit (HEAD `5103e834`), Tier 1 build + code-review record, FORGE_ENFORCEMENT_KEYSTONE_SPEC_V1_4, ARCHETYPE_DEF docs (2026-06-24), Strategy Laboratory Phase 4 guardrail semantics (Apr 12).
**Status:** DESIGN REVIEW → founder rules per-ask. Not a build order. Discovery items marked **[P0-VERIFY]** require file:line citation before build (plan-said ≠ code-did).

---

## 0. Verdict summary

| Ask | Verdict | Blocking condition |
|---|---|---|
| **Ask 1** — prompt contradiction | **APPROVE direction** | Executor-conditional copy variants; precedence model ruled; churn rollback trigger defined pre-flip |
| **Ask 2** — archetype gains-stances | **APPROVE with one BLOCK** | F1: TF-translation contradicts Ask 3's deterministic guarantee — target semantics must be ruled first |
| **Ask 3** — profitTarget executor | **APPROVE concept; sufficiency NOT yet met** | F2–F4 + edge-case rulings below resolved in the build spec, not discovered mid-build |

The brief's core move — restraint migrated from prompt prohibition to keystone physics, so the prohibition is now a redundant relic that also happens to be wrong — is sound. The gaps are in the seams: the brief contains one internal contradiction of exactly the class Ask 1 exists to fix (F1), and Ask 3's §9 promise collides with two LOCKED invariants and one structural fact of BaggerBomb (F2).

---

## 1. Findings, ranked

### F1 — CRITICAL (brief-internal): Ask 2's TF translation contradicts Ask 3's deterministic guarantee

Ask 3: "a **user-set** target must hold deterministically." Ask 2: the TF-with-user-target case "resolves by TF-native translation (trail-tighten to bank at no worse than X), not refusal and not fold."

These cannot both be true. If the executor fires at X for every archetype, TF's translation never gets to run — the position is gone at X. If TF's translation converts the target into a trail, the target did **not** hold deterministically at X (a trail banks at peak-minus-width, which is a different number, sometimes better, sometimes — on a gap — worse). This is a live self-contradiction inside the brief, same species as the SX-04 prompt contradiction the brief opens with.

**Three resolutions:**

- **(a) Target is target.** Fires at X, every archetype, uniformly. Archetype character lives *below* X: earlier discretionary exits, narration, and — the TF-native move — a *conversational proposal* ("want me to convert that target to a trail?") that routes through the coming Tier-3 per-position lever, where the **user** re-authors the directive. Translation-as-proposal, not translation-as-unilateral-reinterpretation.
- **(b) Archetype-native compilation.** TF's SX-04 compiles to a deterministic trail-at-X floor (engine-owned, still model-independent). §9-survivable **only** if the UI promise changes per archetype — a per-archetype enforcement semantic is a per-archetype promise and must be displayed as such. Six different promise texts for one rule.
- **(c) User selects semantics** at equip time ("hard target at X" vs "protect gains from X"). Honest, but it's a second lever pretending to be one, and it front-runs the Tier-3 per-position lever's job.

**Recommendation: (a) at launch.** One semantic, one promise text, simplest §9 story, and it hands TF its character back through the conversation road — which is where the archetype framework already puts overrides ("act early only by conversation, never on silence"). (b) is the elegant trap: it re-opens the exact promise-drift the executor exists to close. **Founder ruling required before Ask 2 authoring begins.**

### F2 — CRITICAL (structural): "Sell at +X%" is physically conditional in BaggerBomb — the promise must be scoped, and the bypass class must be decided against LOCKED Invariant 1

Three verified facts collide with the naive promise:

1. **Exits are swaps.** BaggerBomb has fixed tier slots, no cash state (`maxPosition` is `skipped_incompatible` for this reason). Stop-loss enforcement forces a SWAP via `pickEmergencyReplacement`. A profit-target exit therefore *requires a replacement*. If the bench is exhausted by cooldowns/filters, the target physically cannot fire that tick.
2. **Knob B gates non-emergency swaps** by `byReason` hurdle + `requireBenchPositive`. If `profit_target` is a gated reason, a target hit on a red-market day (no bench candidate positive) or with no candidate clearing the hurdle is **blocked** — the engine breaks the user's promise for a quality opinion the user didn't ask for. This is the same safety-regression shape the A2 fix prevented for stops.
3. **Invariant 1 is LOCKED** with a closed set semantically defined as *protective*: `{bust_avoidance, vwap_failure, stepped_trail, guardrail_stopLoss, guardrail_trailingStop}`. A profit-target fire is not protective — nothing bad is happening. Stuffing it into `EMERGENCY_BYPASS_REASONS` dilutes the set's meaning; leaving it out breaks the promise.

**Recommendation:** introduce a **parallel constant** — `USER_DIRECTIVE_BYPASS_REASONS = {guardrail_profitTarget}` — consumed by Knob B and Knob C alongside the emergency set. Keystone explicitly sanctions additive extension ("future reasons added via additive extension only"), so this respects the lock while keeping the taxonomy honest: *emergency = protective*, *user-directive = the user's explicit deterministic order*. Both bypass, for different stated reasons. This is a fenced `agentArchetypeConfig`/keystone-adjacent change — proposed here explicitly per T1-a, not discovered mid-build.

**And the promise text must carry the physics.** Deliverable §9 language is approximately: *"Sells the position at the next evaluation (~15-min market-hours cadence) once gain from entry ≥ X%, by swapping to the best available bench candidate; if no bench candidate is eligible, fires at the first evaluation one becomes eligible."* Cron granularity, swap-not-sell, and replacement availability are all part of the truth. A promise that omits them is the `maxPosition` label lie with better intentions.

### F3 — HIGH: The executor must stamp `swapMotive: null` — never `'profit_take'`

`swapMotive` is defined as *the model's declared judgment*. A deterministic fire contains no model judgment. If the executor stamps `profit_take`, the Tier-1 motive baseline is permanently poisoned: engine physics becomes indistinguishable from model behavior, and the exact question this program needs answered — *does the model take profit when permitted?* — becomes unanswerable. This is T1-b's provenance-purity requirement stated positively: the executor constructs its receipt from scratch (`exitReason`, `source`, `swapMotive: null`), inherits nothing from any prior `haikuResult`, and a contract test pins motive-null on all deterministic reasons.

### F4 — HIGH: Challenge the brief's "learning allowlist — presumably yes"

The allowlist is named `D3_DISCRETIONARY_EXIT_REASONS`, and it is fail-closed for a reason. A deterministic target fire is not discretionary — the model decided nothing, so there is nothing to learn *about the model* from it. Including it teaches the learner from engine physics.

**Recommendation: mirror stop-loss exactly.** **[P0-VERIFY]** whether `guardrail_stopLoss` / `guardrail_trailingStop` are in D3 today. If stops are excluded (expected, given the name), `guardrail_profitTarget` is excluded, and the symmetry principle in F6 governs. If the learning layer later wants *rule-quality* signal (was the user's target well-placed?), that is a different, explicitly-partitioned channel — not the discretionary allowlist.

### F5 — HIGH: The anti-churn replacement mostly already shipped — the prompt's job changes from prohibition to pricing

The brief's hardest Ask-1 question has a more structural answer than new prompt language. The prohibition predates the keystone. Since V1.4, churn restraint is deterministic: Knob B hurdle floor on every `haiku_decision` swap, Knob C circuit breaker, cooldowns, and the crystallization economics themselves. The prohibition is a belt worn over a bolted harness — and the belt is lying.

**The replacement, in four parts:**
1. **Physics (already live):** hurdle + breaker + cooldowns keep restraining. No new prohibition needed; say so in the design record so the deletion isn't read as loosening.
2. **Pricing (the prompt's new job):** state the crystallization cost as a decision input — decomposed (base ×10, badge terms), not synthesized, unless the synthesized number is *provably* the same computation the ledger applies. A number in the prompt is a display surface; §9 applies to prompt prose (this is the Signal Inventory's own "prompt prose is not evidence" principle pointed at ourselves). If exact parity isn't cheaply computable at eval time, show the decomposition. **[P0-VERIFY]** what threshold-proximity and badge data the eval prompt already carries; if distance-to-threshold is absent, that's a data add, because a hurdle-clearing profit-take can still be value-destructive next to an imminent badge.
3. **Character (Ask 2):** TF's "never cuts strength early," CP's patience — archetype stances carry the in-character patience the blanket line crudely approximated.
4. **Measurement backstop with a pre-committed rollback trigger:** Tier-1 telemetry gives a churn early-warning for free. Define it **before** the flip, e.g.: *if non-emergency swap rate rises >N% week-over-week against the pre-change baseline without a corresponding rise in hurdle-block rate, revert the prompt flag.* The founder sets N at flip time; the point is the trigger exists before the temptation to rationalize does.

**One hard NO to record now: gates must never key on `swapMotive`.** The brief flags motive-aware hurdle gating as a possible fenced ask. Recommend it be ruled out permanently: motive is model-declared and unverifiable, so a motive-differentiated hurdle creates a direct incentive to declare whichever motive carries the lower floor — motive-laundering by construction. Gates key on deterministic provenance (`reason`), never on declared judgment. This also conveniently means Ask 1 requires **no** fenced `agentArchetypeConfig` change.

### F6 — MEDIUM: Naming — `guardrail_profitTarget`, not `profit_target`; and the reason/motive vocabulary near-collision

The brief's literal `exitReason:'profit_target'` breaks the established convention: guardrail-origin reasons are prefixed (`guardrail_stopLoss`, `guardrail_trailingStop`), and the brief itself places the executor on the guardrail path. `guardrail_profitTarget` buys taxonomic consistency, natural membership in a bypass set, and regex adjacency for the receipt-source derivation. Separately: `profit_target` (reason) vs `profit_take` (motive) is a one-character-class collision in greps, dashboards, and human conversation — the prefix also solves that. If the founder prefers the user-directive class to be visibly distinct from guardrails, then name it `user_profitTarget` — but pick deliberately; the brief's string should not be treated as settled. Note the contract test byte-freezes *existing* literals; adding a value is the sanctioned additive path, but the test must be amended **in the same PR** (the CI-discipline lesson, applied prospectively).

**Meta-principle that collapses most of Ask 3's open decisions:** *`guardrail_profitTarget` mirrors `guardrail_stopLoss` across all four keyed subsystems* — bypass class, receipt source, learning membership, calibration partition — with deviations argued explicitly. The brief already names stop-loss "the proven precedent"; take that as a full-surface symmetry contract, not a rhetorical flourish.

### F7 — MEDIUM: Same-tick precedence must be pinned, not discovered

Two live collisions:
- **Stop and target true on the same position, same tick.** Not hypothetical: target +15%, trailing stop 10%, peak +30%, now +17% → gain ≥ target AND drawdown ≥ trail. Same action, different `exitReason` → different bypass class narrative, learning partition, receipt, and story. **Recommendation: protective wins.** Check order: emergencies → stops → target → discretionary. Rationale: the binding-constraint story belongs to the protective trigger, and stops are the precedent. Pin with a test.
- **Multiple positions over target + single-swap-per-eval invariant.** Mirror stops: most-breaching (largest gain over target) fires first; others wait a tick. And across *types*: a stop-breach on position A and target-cross on position B in one tick → A fires (protective first). The promise language inherits "one exit per evaluation" — disclose it.

### F8 — MEDIUM: LOCK interaction — mirror stops, disclose the carve-out, reject the deferral heuristic

"LOCKED positions never force-exited" is an existing guardrail safety property. If stop-loss respects LOCK today **[P0-VERIFY]**, the target inherits identically — symmetric and defensible — and the UI promise discloses it. The brief's floated heuristic (defer the target when within 0.2×ATR of a bonus threshold) should be **rejected**: it embeds a judgment call inside a deterministic executor, i.e., the engine second-guessing the user's explicit order. Badge-aware exit behavior is the rules layer's job (th-05 / postThresholdAction), where the user opted into it. The executor's virtue is that it is dumb and predictable.

### F9 — MEDIUM: Contrarian restore — YES, but signal-grounded or it violates our own doctrine

Restore. The DEF calls asymmetric exits "the most distinctive thing about this archetype" and the shipped identity contract dropped it — the audit's finding stands. But "profit-taking into resistance" requires a resistance read, and the DEF itself flags that the deterministic versions are fenced-path and that language must be softened "to what's actually computed." Restoring the words without the signal is the §9 failure one level up ("prompt prose is not evidence of a signal" — Signal Inventory, our own document). **[P0-VERIFY]** the battle-context indicator set; author the restored stance against observable signals (gain-into-fading-momentum / overbought reads if available), with "resistance" language only where a resistance-adjacent read actually crosses. Same discipline for CN-05/CN-08 wording.

### F10 — MEDIUM: Ask 2 stances must be authored *over* the postThresholdAction vocabulary, with yield clauses

The game already has a gain-side action vocabulary — EXTEND / LOCK / HARVEST_SWAP / DEMOTE_KEEP — and live rules on it (th-04, th-05, tv-15, mb-08). Free-form identity prose about gains will re-create Ask 1's contradiction one layer down the moment a user equips th-04 on a LOCK-inclined archetype. Two disciplines:
1. Each archetype's gains-stance is authored as a **default over the same enum** the rules use (TF ≈ EXTEND-leaning with trail-bank on reversal; CP ≈ LOCK-leaning; Speculator ≈ HARVEST_SWAP-leaning; Contrarian ≈ its asymmetric pair; Diversifier's native profit-taking is *rebalance-trimming* — book-shape language, a genuinely good fit; FI ≈ thesis-completion, clock-bound).
2. Every identity block carries the same yield clause as Ask 1's framework: *equipped exit rules outrank my instinct.*

**Also:** a user-vs-user gain-side conflict is now possible — SX-04 (sell at +15%) + mb-08 (veto profit-taking before threshold) with the target below the next threshold. `projectActiveRules` is pure additive set-union, no conflict resolution. **Recommendation:** deterministic executor > prompt-delegated veto (mb-08 is prompt-layer), and the compiler flags the combination at equip time. Declared, not discovered.

**Capital Preserver:** "least change" is fine, but record the consequence deliberately — if CP's discretionary profit-taking stays rare in-character, CP agents' locked-P&L composition stays negative-skewed *by design*. Write that down now so a future ledger read doesn't misdiagnose it as this bug's regression.

**Speculator:** "banks outsized spikes" must not claim mechanical behavior — forced rotation has winner suppression (dailyPct ≥ winnerThreshold suppresses rotation on winners), so the banking is discretionary/prompt-layer. Stance text should say what the machinery actually does.

### F11 — LOW/MEDIUM: Make the promise-delivery pairing structural — kill the `maxPosition` bug class, not the instance

The brief's condition — `profitTarget` enters `SUPPORTED_GUARDRAIL_SHAPES` only together with a real executor — should be enforced by construction, not by review vigilance:
- **One flag gates both** compiler acceptance and executor registration.
- **A pairing test:** for every shape in `SUPPORTED_GUARDRAIL_SHAPES`, assert a registered executor exists (or an explicit, displayed advisory classification). Future shapes then *cannot* enter the supported set promise-first. This is §9 as a test, and it retroactively guards every existing shape too.
- **Per-position-ready data model from day one:** SX-04 is a global %; the Tier-3 per-position lever is coming. The executor should resolve `targetFor(position)` (global with per-position override hook) now — trivially cheap today, a rebuild later.

### F12 — LOW: Small pins

- **Gap-through:** fire at market at the next eval. Arming a trail instead is reinterpreting the user's order — no. "At or above X at next evaluation" is the honest promise; intra-tick peaks don't exist to a cron engine, and the 15-min cadence is disclosed (F2).
- **Gameplan-suppression day:** user-directive class fires through suppression, matching whatever stops do **[P0-VERIFY]** — suppression governs discretionary trading, not the user's standing deterministic orders. If stops turn out to be suppressed too (unexpected), that's a separate finding to surface, not a precedent to copy silently.
- **Entry-baseline definition:** `returnSinceEntry` must be computed with the same entry definition the UI/ledger displays (the mb-04 Gain%-vs-Daily% baseline trap, avoided). **[P0-VERIFY]** the entry-price source at the executor's read site.
- **Circuit breaker (Knob C):** user-directive reasons bypass the window count (breaker exists to stop *model* churn). Note the accepted consequence: a 5%-minimum target in a volatile name can fire often; it's user-authored and cooldowns still bound it.
- **Tier-1 motive baseline:** it's a *pre-treatment* baseline — behavior measured under the prohibition. Use it for before/after comparison and the F5 rollback trigger; never as a calibration anchor for where anything "should" be.
- **Ask 1 copy is executor-conditional:** until Ask 3 ships, the prompt must not claim the engine enforces the target (§9). Two copy variants, or flip Ask 1 and Ask 3 together.

---

## 2. Ask-by-ask design answers (the brief's explicit questions)

**Ask 1 — precedence language.** Four explicit layers, stated once in the framework, replacing "constraints always override strategy preferences":
1. **Deterministic platform floors & guardrails** — engine-owned; the prompt acknowledges, never re-litigates.
2. **User-equipped rules** — hard, then soft. The critical inversion: *user soft preferences outrank framework defaults and archetype stance.* A soft rule is the user's voice; today's language makes generic framework prose beat it, which is precisely how SX-04 became a dead letter. Post-executor, the SX-04 render becomes: "the user's target is X; the engine enforces it; you may exit earlier in character; the target is never negotiable."
3. **Archetype stance** (Ask 2's blocks) — modulates *how*, never *whether*, within layers 1–2.
4. **Framework defaults** — the residual.

**Ask 1 — anti-churn replacement.** F5 in full: physics (shipped) + pricing (decomposed crystallization cost, §9-true) + character (Ask 2) + a pre-committed telemetry rollback trigger. Plus the permanent rule: no gate ever keys on declared motive.

**Ask 2 — the TF case.** F1: recommend option (a) — uniform target semantics, TF's translation expressed as a conversational re-authoring proposal through the Tier-3 lever. Founder rules.

**Ask 3 — keyed-subsystem integration (explicit list, per T1-a):**

| Subsystem | Recommendation | Class |
|---|---|---|
| Hurdle gate (Knob B) | **Bypass** via new `USER_DIRECTIVE_BYPASS_REASONS` constant (F2); `requireBenchPositive` bypassed with it | Fenced; proposed here explicitly |
| Circuit breaker (Knob C) | **Bypass** (F12) | Fenced-adjacent; same constant |
| Learning allowlist (D3) | **Exclude** — mirror stops (F4) | Verify stops' membership first |
| Receipt source | `guardrail` (or `user_directive` if the class is split) — consistent with the F6 naming ruling | Additive; regex verified |
| Calibration partition | Deterministic partition, mirroring stops | Additive |
| Contract test | Amend additively **in the same PR** as the new literal | CI-discipline rule |

**Ask 3 — the §9 test, answered honestly:** after this build, UI promise === engine delivery **only if the promise text carries the physics** (F2): next-eval cadence, swap-not-sell, replacement availability, LOCK carve-out, one-exit-per-eval. Promise-true means the promise got more precise, not that the engine got omniscient.

---

## 3. Founder rulings required (per-ask, per the process)

1. **F1 — target semantics:** (a) uniform fire-at-X / (b) archetype-native compilation with per-archetype promises / (c) user-selected semantics. *Recommend (a).*
2. **F2 — bypass class:** new `USER_DIRECTIVE_BYPASS_REASONS` constant vs amending the LOCKED emergency set. *Recommend the new constant.*
3. **F6 — reason literal:** `guardrail_profitTarget` vs `user_profitTarget` vs the brief's `profit_target`. *Recommend `guardrail_profitTarget`.*
4. **F4 — D3 membership:** exclude (mirror stops) vs the brief's "presumably yes." *Recommend exclude, pending stop-membership verification.*
5. **F5 — motive-keyed gating:** permanently rule out gates keyed on `swapMotive`. *Recommend YES, rule it out.*
6. **F8 — LOCK + deferral:** mirror stops on LOCK; reject the ATR-proximity deferral heuristic. *Recommend both as stated.*
7. **F9 — Contrarian restore:** restore, signal-grounded per the DEF's own build-calibration note. *Recommend restore.*
8. **F10 — SX-04 × mb-08 conflict:** executor wins over prompt-veto + compiler flag at equip. *Recommend as stated.*
9. **F5 — rollback trigger value (N%):** set at flip time, but the trigger's existence is committed now.
10. **Sequencing:** build 3 → 1 → 2; flip Asks 1+3 together (so Ask 1's copy is enforcement-true on day one); Ask 2 flips after. Ask 3 merges dark behind its own flag regardless.

## 4. Phase-0 discovery obligations (file:line citations before build)

1. D3 membership of `guardrail_stopLoss` / `guardrail_trailingStop` (F4).
2. Stop behavior on gameplan-suppression days (F12).
3. Stop behavior vs LOCK at the executor level (F8).
4. Entry-price definition at the executor's read site vs UI/ledger display (F12).
5. Threshold-proximity / badge data currently present in the eval prompt context (F5.2).
6. Battle-context technical indicator set available for the Contrarian restore wording (F9).
7. Receipt-source regex compatibility with the chosen reason literal (F6).
8. `pickEmergencyReplacement` pool semantics for the target's replacement path — same four questions the keystone posed for Knob A (bench pool parity, hotBench recency, held-symbol exclusion, clean null).

---

*Fable — design review, adversarial pass. Attach the Tier-1 motive baseline when the week accrues; per T1-c it informs the F5 rollback trigger and before/after read, and blocks nothing above.*
