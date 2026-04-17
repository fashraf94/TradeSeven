# Audit 02b — Part 2a: R7 Subdivision (Section C)

**Context:** Audit 02a's R1–R7 coverage map routed ~20 of the 37 behavioral rules to R7 (Normal Optimization). This threatens the "narrow prompt per regime" goal — R7 would be nearly the full current prompt minus R1/R2/R3/R6 rules. This section evaluates whether to subdivide R7 or restructure its prompt.

## C.1 — Complete list of rules currently mapped to R7

Per Audit 02a Part 4 Coverage Map, the following rules map (primary or shared) to R7. Rules that ALSO map to R1–R6 are noted in parens.

**Pure R7 (no other regime anchor):**

- **Rule 1** — DEFAULT TO HOLD (baseline disposition)
- **Rule 2c** — Ask forward-EV question (reasoning frame)
- **Rule 3** — Relative strength vs macro benchmarks
- **Rule 4a** — Clock: Early (>60%) — offense OK
- **Rule 5** — Tier impact / prefer Support swaps
- **Rule 7** — Sector awareness / diversification rotation (also relevant to R2)
- **Rule 8** — Conviction threshold floor 70% (universal floor)
- **Rule 13** — VWAP deviation significance threshold
- **Rule 15** — BB squeeze on bench = swap opportunity
- **Rule 17** — Market posture: risk_on — offense OK
- **Rule 20** — Stock regime: directional_expansion (hold winners)
- **Rule 21** — Stock regime: directional_contraction (hold, tighten)
- **Rule 22** — Stock regime: choppy (avoid swapping INTO)
- **Rule 25** — NR7 priority for S1 (Squeeze Breakout)
- **Rule 28** — Risk manager handles emergencies (framing)
- **Rule 32** — COOLDOWN — locked-until bench
- **Rule 33** — ONE SWAP MAXIMUM per evaluation
- **Rule 34** — NO ROUND-TRIPS

**R7 shared with other regimes:**

- **Rule 2a** — Don't sell a winner with intact momentum (primary: R1)
- **Rule 14** — BB squeeze on active holding = patience (primary: R1)
- **Rule 16** — NR7 — don't swap out unless bleeding (primary: R1)
- **Rule 18** — Market posture: selective (conviction raise)
- **Rule 19** — Market posture: defensive (cuts only) (shared: R2, R5 tilt)
- **Rule 24** — S5 News-Catalyst Momentum (cross-regime overlay — see Part 2b)
- **Rule 30** — Strategy preferences are SOFT rules (primary: R6)
- **Rule 37** — Forge trade checklist (primary: R6)

**Total in R7:** 18 pure + 8 shared = **26 rules reference R7**. Even if shared rules live primarily in their anchor regime, the R7 framework must reproduce enough of them to make sense in isolation. This is the problem.

## C.2 — Clustering rules by behavioral function

Five clusters emerge, not four. The candidate clustering in the audit brief lumps two distinct functions together.

### Cluster 1 — Universal guards (always-on, decision-terminating)

Apply to every regime, fire independently of situation. These are **preconditions or postconditions**, not decision-making rules.

- **Rule 1** — DEFAULT TO HOLD (precondition: require compelling reason)
- **Rule 8** — Conviction floor 70% (postcondition: reject low-conviction swaps)
- **Rule 32** — COOLDOWN (precondition: filter bench candidates)
- **Rule 33** — ONE SWAP MAXIMUM (postcondition: enforce tool schema)
- **Rule 34** — NO ROUND-TRIPS (precondition: filter recent-trade symbols)

**Observation:** none of these are regime-selectable. They guard the entire pipeline regardless of regime. Putting them in R7 is a category error — they belong one layer up (or one layer down).

### Cluster 2 — Market/regime context (interpretation, not action)

Provide input framing that the LLM uses to calibrate confidence and choose targets.

- **Rule 3** — Relative strength vs macro benchmarks
- **Rule 13** — VWAP deviation significance (>1.5%)
- **Rule 14** — BB squeeze on active → patience
- **Rule 15** — BB squeeze on bench → opportunity
- **Rule 17** — Posture risk_on → offense OK
- **Rule 18** — Posture selective → 80% conviction
- **Rule 19** — Posture defensive → cuts only
- **Rule 20** — Regime directional_expansion → hold winners
- **Rule 21** — Regime directional_contraction → hold, tighten
- **Rule 22** — Regime choppy → avoid swapping INTO
- **Rule 25** — NR7 → priority for S1

**Observation:** these inform **how** to act under any regime — they don't own the top-level decision. They belong in a **context block** injected into every regime's prompt, not in a distinct R7 regime.

### Cluster 3 — Tactical trend continuation (R7-specific behavior)

Rules that tell the agent what to do in the **absence** of a specific R1–R6 trigger — i.e. routine swap evaluation with no strong prior.

- **Rule 2a** — Don't sell a winner with intact momentum
- **Rule 2c** — Forward-EV reasoning frame
- **Rule 4a** — Clock Early (>60%) → offense OK
- **Rule 5** — Prefer Support tier for swaps
- **Rule 7** — Sector awareness / diversification rotation

**Observation:** this is the actual R7 behavior — "when nothing special is happening, default to disciplined trend-following with forward-EV scoring." These are the rules that make R7 a distinct regime.

### Cluster 4 — NR7-specific (volatility contraction)

- **Rule 16** — Don't swap out NR7 unless bleeding

**Observation:** Rule 25 (NR7 priority for S1) is about swap-in selection; Rule 16 is about holding NR7. Different decisions, both keyed on `nr7Flag`. Could merge with Cluster 2 but has a clear enough trigger to optionally become its own micro-regime.

### Cluster 5 — Framing / meta (not behavioral, not decision-making)

- **Rule 28** — Risk manager handles emergencies (divide labor)
- **Rule 30** — Strategy preferences are SOFT rules (Forge semantics)
- **Rule 37** — Forge trade checklist (Forge process)

**Observation:** these are agent-education, not regime behavior. Belong in the identity block (where Forge Rules already live) or in a persistent "how to reason" preamble — not in a regime framework.

## C.3 — Recommendation

**Recommended: Option C (a refinement not offered in the prompt, but it's the honest answer given the clustering).**

Option A (subdivide R7 into R7a/R7b/R7c) and Option B (single R7 with structured prompt) both miss the real finding: **four of the five clusters don't belong in R7 at all.** They belong at other layers of the pipeline.

### The re-layered proposal

| Cluster | Current home | Proposed home | Why |
|---------|-------------|---------------|-----|
| 1 — Universal guards | R7 | **Pipeline pre/post-conditions** (code, not prompt) | They already are enforced in code in most cases (Rule 32 cooldown via `validateTradeDecision`, Rule 33 via tool schema, Rule 26 LOCKED via `agent-evaluate.js:851`). The remaining ones (Rule 1 default-HOLD, Rule 8 conviction, Rule 34 round-trip) become deterministic gates in Layer 2 of the new pipeline. The LLM never needs to see them. |
| 2 — Market/regime context | R7 | **Shared context block** injected into every regime's prompt | Already lives in the current prompt's `━━━ REGIME-AWARE STRATEGY ━━━` section. The new design can keep that block as-is, shared across R1–R7, without making it R7's "own" content. |
| 3 — Tactical trend continuation | R7 | **R7 proper** — this is the only cluster that genuinely is R7 | Five rules, coherent behavioral function: "routine swap evaluation when no specific regime fires." The narrow-prompt goal is achievable with just these. |
| 4 — NR7-specific | R7 | **Context block** (merges with Cluster 2) | Two rules keyed on a single flag. Can ride along with Cluster 2 as an additional context signal. |
| 5 — Framing / meta | R7 | **Identity block** (Forge Rules section or agent preamble) | Already where Rule 37 lives partially. Move Rules 28 and 30 there too. |

**Result:** R7's actual framework shrinks from 20 rules to **5 rules** (Cluster 3). That's a narrow prompt.

### How this resolves the original concern

The brief asked whether to subdivide R7 (Option A) or restructure its prompt (Option B). Both assume R7 must own all 20 rules. The clustering reveals that assumption is wrong:

- **Universal guards** (Cluster 1) aren't R7's problem to solve — they're the pipeline's.
- **Context signals** (Clusters 2, 4) aren't R7's problem to solve — they're shared inputs to every regime.
- **Meta framing** (Cluster 5) isn't R7's problem to solve — it's agent identity.

Only **Cluster 3** is actually R7. Once the other clusters are moved to their proper layers, R7 is already narrow. No subdivision needed.

### Why not Option A (subdivide into R7a/R7b/R7c)?

Subdividing R7 would re-create the problem at a finer granularity: R7b "Discipline" would end up absorbing the universal guards, which belong in code not prose. R7c "Context" would absorb the shared context block, which must appear in every regime's prompt anyway — so duplicating it as a regime of its own adds no clarity. R7a "Trend" would be Cluster 3, which is fine but doesn't need the R7a label if it's just R7.

### Why not Option B (keep R7 as one regime with structured prompt)?

Option B leaves 20 rules in R7's prompt and asks Haiku to identify the relevant 2–3 per call. This is exactly what the current design does and is the failure mode the project is trying to escape. Asking the LLM to prioritize rules dynamically is the problem, not the solution.

### Verdict

**Re-layer, don't subdivide.** Move Clusters 1, 2, 4, 5 to their proper layers (code pre/postconditions, shared context block, identity preamble). Leave Cluster 3's five rules as R7's actual framework.

This also clarifies the role of each layer in the 3-layer pipeline:
- **Layer 1 (SituationAssessment):** pure data computation.
- **Layer 2 (Router):** regime selection + universal guards (Cluster 1).
- **Layer 3 (Framework → Prompt → Haiku):** per-regime prompts including shared context (Clusters 2, 4) + regime-specific framework (R1–R6's own rules, or Cluster 3 for R7) + identity/meta (Cluster 5) in the preamble.

## C.4 — Reasoning

The brief framed the subdivision question as a binary between "split R7" and "structured prompt." Honestly evaluating the clusters shows neither framing captures the real issue: R7 was assigned rules that don't belong to any single regime — they're cross-cutting concerns that the 3-layer pipeline can dispatch to their natural layers. The saving grace is that this **simplifies** the regime design rather than complicating it: R7 ends up being the simplest regime (5 rules), not a problematic oversized one.

The only open question from this section is **where exactly** Cluster 1's "Default to HOLD" (Rule 1) belongs. As a precondition, it's more properly a bias on the router's decision tree ("in the absence of a regime-specific SWAP trigger, prescribe HOLD") than a universal guard that fires late. This flips naturally into R7's design: `prescribedAction: 'HOLD'` is R7's default, `'EVALUATE_SWAP'` is the opt-in upon Cluster 3 triggers.

## Part 2a → Part 2b handoff

R7 subdivision is resolved: re-layer Clusters 1, 2, 4, 5 out of R7; keep Cluster 3 as R7's actual framework. Part 2b tackles Section D — Rule 24 (S5 News-Catalyst Momentum) and whether it should live as a cross-regime overlay or be duplicated per regime.
