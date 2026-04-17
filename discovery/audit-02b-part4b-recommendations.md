# Audit 02b — Part 4b: Final Design Recommendations + Questions for Flash

**Context:** This file closes Audit 02b. Prior parts established: the R1–R7 matrix passes the 7-contradiction acceptance test (Part 3), Cluster 3 is R7's narrow framework (Part 2a), S5 lives as a cross-regime overlay matching the risk-manager + guardrails pattern (Part 2b), and the red-team surfaced one architectural refinement (Scenario 3: scope-aware composition) plus three implementation-spec requirements (Part 4a).

## Final Design Recommendations

### Verdict

**PROCEED** with one architecture revision and three spec requirements.

The 7-regime matrix is sound. The acceptance test passes 5/7 clean + 2/7 conditional on product decisions (C-4, C-5). The red-team did not flip the verdict — it surfaced concrete improvements that refine the Layer 2 router without changing the matrix itself.

### Architecture revision: scope-aware composition at Layer 2

Strict priority ordering (R1 → R2 → R3 → R4 → R5 → R6 → R7) is insufficient. Red-team Scenario 3 demonstrated that regimes operate at different scopes and do not cleanly compose via priority alone. The router must distinguish three scopes:

**1. Per-position regimes (R1, R2).**
Classify each active position independently. If R1 (Bonus Lock-In) fires on a position, that slot is **locked** — the position is terminal HOLD for this tick, removed from the candidate pool. If R2 (Bust Defense) fires on a position, that slot is **marked for swap-out** — the position is terminal SWAP-OUT (the specific swap-in target is still decided downstream).

Positions with no per-position regime fire remain **unlocked** and flow into the portfolio-level decision space.

**2. Portfolio regimes (R3, R4, R5).**
Apply as **modifiers** on the remaining (unlocked) decision space. R3 (Endgame) tightens conviction floors and forbids offensive swap-ins. R4 (Catch-Up) lowers conviction floors and permits aggressive swap-ins. R5 (Protect Lead) tightens conviction and biases toward defensive holds. These do not lock or terminally decide — they shape the constraints under which downstream decisions happen.

**3. Candidate-level overlay (S5).**
Surfaces bench-candidate priority elevation (Star/Core tier forcing). Subject to portfolio-regime allowance: if R3 forbids momentum chase and S5 fires on a momentum candidate, the portfolio regime suppresses S5 for this tick. S5's "priority elevator" semantics (Part 2b) means it can be suppressed without architectural trauma.

**4. R7 fall-through.**
Handles any unlocked decision not owned by per-position regimes, subject to portfolio-regime modifiers. R7's 5-rule Cluster 3 framework (Part 2a) supplies the default behavior. The shared context block is mandatory (spec requirement 3 below).

**5. R6 Rule-Directive Conflict.**
Operates across scopes: a Forge constraint can block a swap at any scope; Rule 35 Survival Mode override (now consolidated into the risk manager per Part 3 C-7) pre-empts everything below it. R6 is best modeled as a **meta-scope** that can intervene on any scope's decision.

**Router execution order:**
```
1. Risk manager pre-executes emergency swaps (existing pattern; now catches "accelerating" per C-5)
2. For each active position: classify per-position regime. R1-fired → lock. R2-fired → mark for swap-out.
3. Classify portfolio regime (R3/R4/R5). Single regime (priority-ordered among these three only).
4. Evaluate S5 overlay against bench. Subject to portfolio-regime allowance.
5. Apply R6 meta-scope: Forge constraint checks against unlocked positions + overlays.
6. Remaining unlocked decision space → R7 default if nothing else owns it.
7. Assemble framework spec → prompt → Haiku call (one SWAP/HOLD decision over the unlocked space).
```

### Implementation spec requirements (from red-team)

1. **Archetype-modulated R4/R5 tilts** (Scenario 1). R4 and R5 frameworks must accept the agent archetype and `riskTolerance` as inputs. Aggressive archetypes' R5 tilts are dampened (smaller conviction-floor raises, smaller defensive bias). Conservative archetypes' R4 tilts are dampened. Every R4/R5 activation must emit a status-feed entry explicitly announcing the shift (e.g. "Protecting a big lead — tightening up.") so users understand the behavior change. **Product decision pending** on the exact modulation curves — see Questions for Flash.

2. **R3 "Bust cut overrides momentum-chase guard" clause patch** (Scenario 2). R3's framework specification must explicitly state that when R2 is concurrently active and mandates a swap-out, R3's "do NOT chase momentum late" clause does not block the swap-in target selection. This is a targeted patch: R3's defensive-only guard on *new* offensive swaps remains; but when the swap-in is the *consequence* of an R2-mandated cut, momentum targets are allowed.

3. **R7 shared context block is mandatory, not trimmed** (Scenario 4). The Layer 3 prompt assembler must inject the full shared context block (posture, per-stock regimes, NR7, BB squeeze, VWAP deviation, macro benchmarks) into R7 prompts. The implementation temptation to simplify R7's prompt because "R7 is the default, keep it small" must be explicitly rejected in the Layer 3 build doc. R7's narrowness applies to regime-specific rules only, not to shared context.

### Implementation readiness

**Layer 1 (SituationAssessment):** ready to build. Per Audit 01, most fields are directly computable from existing cron data. Three gaps identified: `swapsRemaining` (agent battles have no swap budget — green-field schema work), `sectorDrift` (sector ETF prices not fetched — add ~11 ETF symbols to the price batch in `agent-evaluate.js:217–237`), `nearestThreshold` (port `detectRedZone()` from `src/utils/baggerBombUtils.js:182` to `api/_utils/`). Rough estimate: **3–5 days** for a single engineer. Mostly wiring existing utilities, small schema additions, one port.

**Layer 2 (Router):** ready to build with the scope-aware composition model above. The model is more nuanced than strict priority ordering but is bounded — three scopes, well-defined transitions. Risk-manager pattern at `agent-evaluate.js:547–610` + distressed-block at `agent-evaluate.js:858` are existing architectural precedents. Rough estimate: **1.5–2 weeks** including per-regime classifier functions, unit tests for each contradiction (C-1..C-7) as test cases, and the scope composition logic. Add ~1 week if R4/R5 threshold discovery (empirical tuning) is part of scope.

**Layer 3 (Framework → Prompt → Haiku):** ready to build after Layer 2. Framework-to-prompt-string assembly is mechanical. The identity block and shared context block exist today and need modest refactoring (Cluster 5 items moved into identity, Cluster 1 items removed to become code guards, Cluster 2 items confirmed in shared context). Rough estimate: **1–1.5 weeks** plus whatever iteration is needed on per-regime prompt wording.

**Total order of magnitude:** about a month for a focused engineer, assuming no surprises and the two product decisions (C-4, C-5) are resolved within the first week. This is "weeks not months" — not a rewrite, an organized refactor over an existing codebase with identified landing zones for each piece.

### Tool schema — no extension required

Inspected `api/_utils/agentEvalToolSchema.js`. The `TRADE_DECISION_TOOL` returns a single HOLD-or-SWAP decision with at most one `symbolOut`/`symbolIn` pair. It does not express multi-position composite decisions.

**Scope-aware composition does not require schema extension.** Three reasons:

1. **R1 locks terminate in code, not prompt.** When R1 fires on NVDA, the router locks NVDA out of the decision space *before* Haiku is called. The LLM never needs to output "HOLD NVDA"; NVDA isn't on the table. This mirrors the existing risk-manager pattern: emergency swaps pre-execute, then the cron calls Haiku on the remaining state. Existing pattern precedent at `agent-evaluate.js:547–610` (risk manager) and `agent-evaluate.js:858–864` (distressed block).

2. **R2-mandated swap-outs also resolve at the router.** R2 identifies the swap-out symbol deterministically (the position near Bust). The router passes the resulting framework to Haiku as "evaluate swap-in candidates for LUMN-out; do not reconsider the swap-out." Haiku returns a single SWAP decision with LUMN as `symbolOut` — schema-compatible.

3. **Multi-position decisions across ticks, not within a single call.** A given tick produces at most one Haiku-driven SWAP (plus whatever the risk manager already pre-executed). Complex portfolio reshaping happens across multiple ticks, which is how the cron operates today anyway. Rule 33 "ONE SWAP MAXIMUM per evaluation" is preserved.

The one thing to confirm is that the status-feed + evaluations record format can represent "multiple actions per tick" — one from the risk manager + one from Haiku. Inspection of `agent-evaluate.js:583–600` shows the risk manager writes its own status-feed entry (`source: 'risk_manager'`) separate from Haiku's (`source: 'haiku'`). Pattern already supports it. No changes needed.

### Scope concerns

Two items to explicitly defer:

**Defer to follow-up phase:** clause-level regime resolution (Scenario 2's deeper fix). The recommended MVP is a targeted R3 clause patch (implementation spec requirement 2 above). A full decomposition of each regime into `{required, forbidden, preferred}` clauses with clause-wise conflict resolution is architecturally cleaner but substantially more implementation surface. Wait for telemetry on live regime conflicts before committing to the deeper model — if only the R3 case surfaces in practice, the patch is enough.

**Defer to follow-up phase:** R4/R5 threshold empirical tuning. Initial thresholds (e.g. `|scoreDelta| > 25` for R4/R5 activation, deadband `±15`) should ship as conservative defaults then be tuned against post-implementation telemetry. The design does not depend on getting these numbers right at launch.

## Questions for Flash

Four product decisions required before or during implementation. Numbered 1–4 in priority order.

### 1. C-5 "accelerating toward Bust" metric and threshold (highest priority)

**Why it matters:** Gates user-directive override in Survival Mode. Under the new design, this metric is moved into the risk manager (`agentRiskManager.js`) where it will pre-empt Haiku entirely and execute emergency swaps without evaluation. Getting it wrong in either direction:
- Threshold too loose → Survival Mode fires on normal volatility, repeatedly overriding user directives. User feels agent is ignoring them.
- Threshold too tight → real accelerating Busts go unhandled until they breach -1.0x ATR, which was the pre-Survival-Mode behavior.

**Candidate metric:** ATR-multiplier velocity over N evaluation ticks.
- Shape: `rateOfChange = (multiplier_now - multiplier_N_ticks_ago) / N_ticks`.
- Candidate default: velocity > **-0.3x ATR per 15-min tick** (i.e. `multiplier` dropped by >0.3x over one eval cycle) AND currently in the -0.7x to -1.0x band.
- Alternative: two consecutive ticks each showing a multiplier decrease of >0.2x.

**Decision needed:** pick a metric shape (velocity or consecutive-down-ticks) and commit a threshold value. Safe conservative default is acceptable and tunable post-launch.

### 2. R4/R5 archetype modulation and user-facing announcement (Scenario 1)

**Why it matters:** R4 and R5 have no behavioral ancestry in the current prompt. Introducing them means the agent behaves differently when ahead vs behind — a visible change. Aggressive archetypes shifting to defensive posture (R5 when leading) or conservative archetypes shifting to offensive posture (R4 when trailing) will surprise users unless modulated and announced.

**Decisions needed:**

**(a) Should R4/R5 tilts be modulated by agent archetype and `riskTolerance`?**
- Option: yes, with a simple linear modulation (e.g. R5's defensive-bias weight = `0.5 + (1 - riskTolerance/100)`; so risk-75 archetypes get weight 0.75, risk-25 archetypes get weight 1.25).
- Option: no, R4/R5 tilts are uniform — game-theoretic correctness over archetype consistency.
- Recommended: yes (option 1), with the modulation curves committed at launch.

**(b) Should R4/R5 activation emit an explicit status-feed entry?**
- Option: yes, every activation emits a status-feed entry like "Big lead — tightening up" (R5) or "Behind — looking for aggressive entries" (R4).
- Option: only first activation per battle, to avoid noise.
- Recommended: first activation per battle, with the tilt persisting until the delta crosses back into the deadband.

**(c) Where should the deadband sit?**
- Candidate: `scoreDelta > +25 → R5`, `scoreDelta < -25 → R4`, `|delta| ≤ 25 → R7 default`.
- BaggerBomb scoring economy: a single BaggerBomb badge at Star is +15 pts × 2x = +30 pts. One threshold crossing reshuffles the deadband. Worth thinking about whether the deadband should be absolute points (±25) or relative to the current max-possible-score remaining (≈ percent-of-possible).
- Recommended: start with absolute ±25 for MVP, revisit if telemetry shows R4/R5 flapping across the boundary.

### 3. C-4 "bleeding" threshold for NR7 swap-out rule (lower priority)

**Why it matters:** Determines whether the NR7-pattern protection (Rule 16 "don't swap out NR7 unless bleeding") permits a cut. Low-stakes vs C-5 — worst case is an NR7 stock held when it shouldn't be, or cut when it might have broken out. Not gating any override permissions.

**Candidate definition:** `isBleeding(position) = position.multiplier < -0.5` OR `position.multiplier ≤ thresholdOfLastFiredPenalty`.

**Decision needed:** pick a number. Safe conservative default is `< -0.5` (half a Bust). Tunable with no external consequences.

### 4. S5 overlay authority calibration (new, emerged from Part 2b/Scenario 3)

**Why it matters:** Part 2b recommended S5 as a "priority elevator, not a forced swap" — Haiku sees S5's candidate as the top bench option but can still decline. Scenario 3 revealed a case where R3 (portfolio regime) suppresses S5 (candidate overlay). Two related decisions:

**(a) Can portfolio regimes suppress S5?** Recommended: yes. R3 "do NOT chase momentum late" should be able to suppress S5 in FINAL_HOUR. R5 "protect lead" should be able to suppress S5 when a big lead makes offense unwarranted.

**(b) What exactly does S5 elevation mean mechanically?** Options:
- S5 candidate shows at the top of Haiku's bench listing with a "Catalyst Priority" flag.
- S5 candidate is the *only* bench candidate Haiku sees (all others suppressed for this tick).
- S5 fires → framework pre-selects it as `symbolIn` and Haiku decides HOLD-or-execute.

Recommended: option 1 (top-of-list flag). Preserves Haiku's judgment while making S5 visible and prioritized. Matches the "elevator, not forcer" language.

### Others not surfaced in this audit but likely product-adjacent

- **Does R6 trigger on a *violated* Forge constraint (e.g. a trade would violate C1) or on any *active* Forge constraint?** The audit-02a rules suggest the former (R6 fires when there is conflict to resolve), but this should be explicit in the spec.
- **Status feed naming/branding for the regimes themselves.** Users may see "R4 Catch-Up" or "R5 Protect Lead" in trade rationales. The product team may want plain-English labels ("trailing" / "leading" / "endgame") or may want to expose the regime codes for power users. Small but visible detail.

---

## Closing note

Audit 02b is complete across six files:

1. `audit-02b-part1-plumbing-and-distressed.md` — dead plumbing + distressed block (Sections A, B)
2. `audit-02b-part2a-r7-subdivision.md` — R7 cluster re-layering (Section C)
3. `audit-02b-part2b-s5-cross-regime.md` — S5 overlay architecture (Section D)
4. `audit-02b-part3-acceptance-test.md` — 7-contradiction acceptance test — PASS (Section E)
5. `audit-02b-part4a-redteam.md` — 4 red-team scenarios (Section F)
6. `audit-02b-part4b-recommendations.md` (this file) — final recommendations + Questions for Flash

Verdict: **PROCEED** with the scope-aware composition revision to Layer 2 and three implementation spec requirements. Four product decisions await Flash input; C-5 is highest priority. Implementation order-of-magnitude estimate: ~1 month focused engineering for Layers 1–3.
