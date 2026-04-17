# Audit 02a — Part 4: Implicit Defaults, Rule Interactions, Contradictions, R1–R7 Implications

**Source:** Analysis derived from Parts 1–3 (37 behavioral rules indexed across `api/_utils/agentEvalPromptAssembly.js:21–290`).

## Implicit defaults (behavioral assumptions not stated as rules)

These are game-state conditions the current prompt **never addresses** — behavior under them is whatever the LLM decides unprompted. Each is a candidate for a dedicated R1–R7 rule.

### ID-1 — Opponent score state is absent

The entire system prompt **never references opponent score, score delta, or whether the agent is ahead/behind/tied**. The closest proxy is `pvp_context` (line 146) — a status-feed output field, not a decision rule. Implication: R4 (Catch-Up) and R5 (Protect Lead) have **no behavioral ancestry** in the current prompt. Whatever catch-up or protect-lead behavior exists today is emergent, not directed.

### ID-2 — Score-delta-near-zero case

When score delta is small (tied or near-tied), the prompt offers no guidance distinct from R7. The LLM defaults to Rule 1 (HOLD) + Rule 8 (70% conviction floor). No rule says "when tied, bias offense" or "when tied, bias defense."

### ID-3 — "Bleeding" is undefined (Rule 16)

Rule 16 says "Do NOT swap out NR7 stocks unless they're bleeding." **"Bleeding" is never quantified.** Candidate interpretations: (a) priceChange < 0; (b) multiplier < -0.5; (c) past a Bust; (d) subjective. The LLM picks — and the interpretation is unstable across calls.

### ID-4 — "Accelerating toward Bust" is undefined (Rule 35 Survival Mode)

Rule 35 permits directive override when a position "is accelerating toward it [Bust] with no sign of reversal." **No metric is given** for "accelerating" — no velocity, no derivative of multiplier, no tick-over-tick threshold. The LLM's interpretation determines whether Survival Mode fires. This is the **highest-stakes undefined trigger** in the prompt (it permits directive override).

### ID-5 — Regime-vs-clock precedence

When stock regime (Rule 20 `directional_expansion` → "hold winners") conflicts with clock (Rule 4c Late battle → "DEFENSIVE ONLY"), the prompt doesn't say which wins. The LLM resolves it ad-hoc.

### ID-6 — Regime-vs-threshold-proximity precedence

When Rule 22 (`choppy` → "avoid swapping INTO") meets Rule 6b (near penalty → "consider cutting"), the cut implies swapping INTO *something* — potentially a choppy bench candidate. No guidance on which bench regime is preferred for a defensive cut.

### ID-7 — Forge-rule-vs-regime precedence

When a Forge constraint (Rule 29, e.g. "only hold Star tier tech stocks") conflicts with a regime call (e.g., Rule 23 distressed swap-out from a tech Star), the prompt says "constraints override preferences" (Rule 31), but says nothing about constraint-vs-regime. Rule 36 (C_INST) addresses only the institutional-vs-technicals case.

### ID-8 — Tier assignment precedence on swaps

When Rule 5 (prefer Support) conflicts with Rule 24 (S5 forces Star/Core), Rule 24 implicitly wins (it explicitly assigns tier), but the prompt never says so.

## Rule interactions (explicit overrides)

These are **stated** precedence relations in the prompt.

| Higher-priority rule | Overrides | Stated where |
|---|---|---|
| Rule 35 Survival Mode | User directives (any) | line 183 ("permission to OVERRIDE user directives") |
| Rule 35 Survival Mode | Rule 29 Forge constraints | line 167 ("unless Survival Mode activates") |
| Rule 31 Constraints | Rule 30 Strategy preferences | line 170 |
| Rule 36 C_INST | Rule 29 Institutional forge rule | lines 276–281 ("Intraday technicals ALWAYS override stale institutional signals") |
| Rule 8 Conviction floor | Rule 2a/2b/etc. swap temptations | line 85 ("MUST output decision 'HOLD'") |
| Rule 26 LOCKED | Rule 2b cut-loser, Rule 6b cut-near-penalty, Rule 4c late-cut | line 139 ("LOCKED positions CANNOT be swapped out. Only hard stops override locks") |
| Rule 32 COOLDOWN | Any swap-in candidate | line 174 ("OFF LIMITS regardless of how attractive") |
| Rule 33 ONE SWAP MAX | Multi-swap reasoning | line 176 |
| Rule 34 NO ROUND-TRIPS | Recent reverse-swap | lines 177–179 |

## Contradictions and ambiguities

Places where two rules could give the LLM conflicting guidance in the same situation. These are the exact cases where code-as-router (R1–R7) can produce a deterministic outcome.

### C-1 — Rule 8 (70% conviction floor) vs Rule 18 (selective posture → 80%)

**Situation:** Swap candidate with conviction = 75%, marketPosture = `selective`.
**Rule 8 says:** conviction ≥ 70% is the floor to swap.
**Rule 18 says:** swap only on `>80%` conviction under selective.
**Conflict:** 75% passes Rule 8 but fails Rule 18. Prompt doesn't specify stacking semantics — take-max? take-min? compound?
**Resolution in practice:** ambiguous. R7 regime should pick the higher floor (80%) when selective is active; a code layer eliminates the guesswork.

### C-2 — Rule 5 (prefer Support) vs Rule 24 (S5 assigns Star/Core by ATR)

**Situation:** News-catalyst momentum setup on a high-ATR stock.
**Rule 5 says:** "Prefer swapping in Support tier unless the case for Star is overwhelming."
**Rule 24 says:** "Assign to Star if ATR High/Extreme, Core if ATR Normal."
**Conflict:** Rule 24 forces Star/Core tier; Rule 5 biases Support. Rule 24 takes precedence *in practice* (it's more specific), but the prompt doesn't state this.
**Resolution:** R4 (Catch-Up, when behind) would want S5's aggressive Star/Core assignment; R7 would want Rule 5's Support default. Code layer can disambiguate by regime.

### C-3 — Rule 22 (`choppy`: avoid swapping INTO) vs Rule 24 (S5 applies "across ALL regimes except Distressed")

**Situation:** A stock classified `choppy` hits the S5 setup (positive news + vol + break + above VWAP).
**Rule 22 says:** avoid swapping into choppy stocks.
**Rule 24 says:** S5 applies across ALL regimes except distressed — so choppy is explicitly included.
**Direct contradiction.** Rule 24 wins textually ("across ALL regimes except Distressed" is more specific), but Rule 22 reads as absolute.

### C-4 — Rule 16 NR7 "bleeding" ambiguity

**Situation:** NR7-flagged active holding, priceChange = -0.5% (at -0.25x ATR for a 2% ATR stock).
**Rule 16 says:** don't swap out NR7 unless bleeding.
**Undefined:** is -0.5% "bleeding"? The behavior flips on the LLM's interpretation.
**Related:** Rule 6b (within 0.2x of -1.0x ATR penalty → consider cutting) would trigger at ~-1.6% for a 2% ATR stock. Below that, Rule 16 holds; above, Rule 6b may cut. The gap between -0.5% and -1.6% is the ambiguous zone.

### C-5 — Rule 35 Survival Mode "accelerating" ambiguity

**Situation:** Position at -0.85x ATR (not yet Bust), multiplier dropped from -0.50x to -0.85x in the last 15 minutes.
**Rule 35 says:** override directives if "accelerating toward it [Bust] with no sign of reversal."
**Undefined:** is a 0.35x jump in 15 minutes "accelerating"? The permission to **override user directives** hinges on this undefined threshold. This is the most consequential ambiguity in the current prompt.

### C-6 — Rule 4c (Late battle DEFENSIVE ONLY) vs Rule 20 (directional_expansion "hold winners, do not fight the trend")

**Situation:** Late battle, an active Star-tier winner is in `directional_expansion`, at +0.9x ATR approaching BaggerBomb (+1.0x).
**Rule 4c says:** swaps defensive only; cut near-penalty positions; "do NOT chase momentum late."
**Rule 20 + Rule 6a say:** hold winners; don't swap out within 0.2x of bonus.
**Resolution:** both converge on HOLD for this specific case (the winner). But Rule 4c's "do NOT chase momentum late" implicitly *permits* holding an existing winner, not entering a new one. Prompt leaves this implicit.

### C-7 — Rule 28 (risk manager handles emergencies) vs Rule 35 (Haiku may override directives for Bust)

**Situation:** Position at -1.0x ATR.
**Rule 28 says:** "The risk manager handles emergency exits automatically — focus on strategic decisions."
**Rule 35 says:** Haiku may override directives at Bust.
**Conflict:** if the risk manager already auto-exits at Bust, why does Haiku also need override permission? Two systems can fire on the same signal. Code path in `agent-evaluate.js:547–610` shows the risk manager *does* pre-execute emergency swaps before Haiku sees the state — so Rule 35 is a backstop for cases the risk manager doesn't catch (e.g., "accelerating toward" without having breached).

## R1–R7 coverage analysis

### Regime-by-regime inventory

| Regime | Anchor rules (verbatim-strong) | Supporting rules | Gap |
|---|---|---|---|
| **R1 Bonus Lock-In** | 6a (within 0.2x of bonus → HOLD), 26 (LOCKED) | 2a, 14 (BB squeeze on active), 16 (NR7), 20 (hold winners) | None — well-covered. |
| **R2 Bust Defense** | 6b (within 0.2x of penalty → consider cut), 23 (distressed strict), 27 (WARNING), 35 (Survival Mode) | 2b, 4c (late defensive), 19 (defensive posture) | None — well-covered. |
| **R3 Endgame** | 4c (<30% time remaining → defensive only) | 4b (mid → 80% conviction) | **Weakly-anchored.** Only one dedicated rule; no explicit "final hour" anchor despite `FINAL_HOUR` phase label flowing through the prompt. |
| **R4 Catch-Up** | *(none)* | 17 (risk_on allows offense), 24 (S5 aggressive entry) | **No dedicated rule.** The prompt never references being behind. |
| **R5 Protect Lead** | *(none)* | 19 (defensive), 28 (risk manager) | **No dedicated rule.** The prompt never references being ahead. |
| **R6 Rule-Directive Conflict** | 31 (constraints > preferences), 35 (Survival Mode), 36 (C_INST), 37 (checklist) | 29, 30 | Covered but scattered across 4+ places. |
| **R7 Normal Optimization** | 1 (DEFAULT HOLD), 2c (forward EV frame), 8 (70% conviction floor) | 3, 4a, 5, 7, 13, 15, 17, 20–22, 25, 28, 32–34 | Default bucket — most rules route here. |

### Headline findings

1. **Score state is absent.** Rules 1–37 collectively do not reference opponent score. R4 (Catch-Up) and R5 (Protect Lead) would be new behavior, not ports — they have no textual ancestor to preserve.
2. **R3 Endgame is thin.** Only Rule 4c explicitly addresses late-battle behavior. `computeBattlePhase()` produces a `FINAL_HOUR` label (`agentEvalPromptAssembly.js:640`) but the prompt never distinguishes `FINAL_HOUR` from `LATE`. Strengthening R3 is additive, not a port.
3. **R1/R2 are the cleanest ports.** Rules 6a/6b/23/26/27/35 already give deterministic triggers (0.2x ATR, -1.0x ATR, LOCK, WARNING). Moving these to code-as-router is a near-direct translation.
4. **R6 is scattered.** Four rules (29, 31, 35, 36, 37) address rule/directive conflict from different angles. A single R6 regime consolidates them.
5. **R7 is a grab-bag.** ~20 rules map to R7. The deterministic router should treat R7 as the default fall-through after testing R1–R6.
6. **The prompt encodes 7 contradictions/ambiguities** (C-1 through C-7). Each is a concrete test case for the new design: a deterministic router must produce a single action under each contradiction, not punt to the LLM.

## Implications for the 3-layer pipeline design

1. **Direct ports exist.** R1, R2, R6 rules have explicit triggers (ATR thresholds, LOCK/WARNING states, constraint violations) — the router can fire them from `SituationAssessment` fields already computable per Audit 01 (with `nearestThreshold` + `thresholdsFired[]` being the must-have inputs).
2. **R3 needs strengthening.** Add dedicated FINAL_HOUR behavior distinct from LATE. Port Rule 4c verbatim into R3; add a sub-rule for `FINAL_HOUR` that's stricter than `LATE`.
3. **R4/R5 are greenfield.** Opponent score data flows through the system (`battle.scoreState.opponentScore` is updated at `agent-evaluate.js:322`) but is never consulted by the prompt. R4/R5 would be net-new behavior, not regressions. Decide explicitly whether to introduce them or leave the current "score-blind" behavior.
4. **Rule 24 (S5 News-Catalyst) breaks regime partitioning.** It explicitly applies across all non-distressed regimes. Either (a) keep it as a cross-regime override layer outside R1–R7, or (b) duplicate its trigger into every regime's rule set.
5. **The code-level distressed gate (`agent-evaluate.js:858`) is the architectural precedent** — other regime rules should follow the same pattern: compute the trigger in code, short-circuit or force the decision, let Haiku's output be a default the code can override.
6. **Seven contradictions (C-1..C-7) become test cases.** Each is a known-ambiguous input. A successful router produces one answer per contradiction and documents it.

## Cross-part index

- Part 1 (`audit-02a-part1-summary-and-rules-1-12.md`) — executive summary + Rules 1–12 (Decision Framework).
- Part 2 (`audit-02a-part2-rules-13-25.md`) — Rules 13–25 (Intraday Momentum + Regime-Aware Strategy).
- Part 3 (`audit-02a-part3-rules-26-37.md`) — Rules 26–37 (Risk Status, Forge Rules, Anti-Thrash, Survival Mode, Institutional Lag) + meta blocks.
- Part 4 (this file) — Implicit defaults (ID-1..ID-8), Rule interactions, Contradictions (C-1..C-7), R1–R7 implications.
