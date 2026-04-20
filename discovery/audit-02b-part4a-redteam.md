# Audit 02b — Part 4a: Red-Team (Section F)

**Purpose:** Stress-test the R1–R7 + S5 overlay design against realistic battle states beyond the 7 documented contradictions. Each scenario uses concrete numbers (score, time, positions, signals), not hypotheticals.

## Scenario 1 — R4/R5 greenfield vs. archetype conflict

**Category:** R4/R5 greenfield risk.

**State:**
- Day 2 of 3, 2h 10m until market close.
- Agent score **148**, opponent **82** (+66 delta — large lead).
- Agent archetype: **Alpha Hunter** (`riskTolerance: 75/100`). Agent's strategic brief emphasizes "aggressive Star tier plays, high-ATR names, swing for bonuses."
- Portfolio:
  - Star: NVDA at **+1.35x ATR** (BaggerBomb earned, +15 locked bonus), TSLA at **+0.3x ATR**.
  - Core: GOOGL at **+0.2x ATR**, AMD at **-0.1x ATR**.
  - Support: AVGO at **+0.05x ATR**, ARM at **-0.2x ATR**, MU at **+0.4x ATR**.
- Bench: MSFT +1.8% today with BB squeeze firing; META flat; QQQM +0.6%.
- Market posture: `risk_on`. All active positions in `directional_expansion` except AMD (`choppy`).

**Regime classification:** R5 Protect Lead fires (delta > +50 threshold, assumed). R1 does not fire (no position in 0.2x bonus proximity). No R2/R3/R4/R6.

**Framework prescription:** R5 → "defensive posture, preserve banked score." Bias toward HOLD everything; cut only weak positions (ARM at -0.2x would be candidate for rotation only if it weakens further). Reject offensive swap-in on MSFT despite the BB squeeze trigger. Raise conviction floor to 80%+.

**Why it's wrong/risky:**
- The user *explicitly chose an aggressive archetype*. The agent's strategic brief, written at draft time, promised aggressive Star plays.
- R5's defensive tilt is the correct game-theoretic move (protecting a +66 lead), but it produces a trading pattern that **directly contradicts the agent's declared identity**.
- From the user's perspective, the agent they built is behaving like a different agent. No status-feed message will explain the switch without explicit R4/R5 announcements — and audit 02a confirmed the prompt has *no prior vocabulary* for this.
- The BB squeeze on MSFT is a textbook Alpha Hunter setup being declined for a reason the user was never told the agent would honor.

**Design implication:**
R5 is correct game-theoretically but user-experience-risky. Three options, only one is scalable:

1. **Let R5 override archetype silently.** (Current default reading of the design.) High risk of user confusion.
2. **Respect archetype over R5.** (Aggressive archetypes stay aggressive when ahead.) Game-theoretically wrong.
3. **Modulate R5 by archetype + announce the shift.** R5 tilt is dampened for aggressive archetypes (e.g. conviction floor raised to 75% instead of 85%); status feed emits a line like "Protecting a big lead — tightening up." This becomes a requirement on R5's framework spec, not just "be defensive."

**This is a product decision, not an architecture bug.** Flagged for Questions for Flash.

---

## Scenario 2 — Implicit default exposure: ID-5 (regime-vs-clock precedence)

**Category:** Implicit default exposure.

**State:**
- Day 3 of 3, 25 minutes until market close (`FINAL_HOUR` → R3).
- Agent score 64, opponent 61 (+3 delta — functionally tied, below any R4/R5 threshold).
- Active positions:
  - Core: LUMN at **-0.92x ATR** — within 0.08x of Bust. `distressed` stock regime. R2 fires.
  - Support: KO at **+0.1x ATR** — calm.
- Bench: QQQM with **BB squeeze** (`bBandwidthPercentile: 12th`), +0.4% today, `directional_expansion` regime.

**Regime classification:**
- R2 Bust Defense on LUMN: fires (within 0.2x of penalty, distressed).
- R3 Endgame: fires (FINAL_HOUR).
- S5 overlay: does NOT fire on QQQM (no FantasyTimes story — squeeze alone isn't S5).
- Priority R1 → R2 → R3. **R2 wins.** Framework prescribes SWAP LUMN out.

**Framework prescription after R2 wins:**
- Swap-out target: LUMN (Core tier).
- Swap-in candidate: QQQM is the only bench option matching the forward-EV frame (other bench stocks lower conviction).
- But R3 says (Rule 4c): "swaps are DEFENSIVE ONLY — cut a position approaching Bust/Crash to protect banked points. Do NOT chase momentum late."
- R3's "defensive only" permits the cut (LUMN is near Bust). R3's "do NOT chase momentum late" forbids swapping *in* to a momentum target (QQQM on a BB squeeze is exactly momentum).

**Why it's ambiguous:**
Rule 4c has two clauses that partially contradict when a Bust cut has no non-momentum target: *cut losers* (mandates the swap-out) ∧ *no momentum chase* (forbids the swap-in). R2 + R3 converge on the swap-out decision and diverge on the swap-in decision. The priority rule (R2 > R3) says R2 wins, which means swap both out and in — but R3's second clause remains textually unaddressed.

This is **ID-5 (regime-vs-clock precedence) becoming load-bearing.** Audit 02a noted this as a silent gap in the current prompt. Under the new design it becomes a concrete routing decision.

**Design implication:**
Framework must specify **clause-level priority**, not just regime-level priority. R2's swap-out clause wins over R3's "don't chase" on its own terms (Bust loss is worse than momentum-chase risk in FINAL_HOUR when both rules fire). But the priority-ordering model assumes regimes are atomic. They aren't — each regime is a bundle of clauses.

Two fixes:
1. **Explicitly decompose each regime's framework into {required, forbidden, preferred} clauses** and resolve conflicts clause-by-clause rather than regime-by-regime. More work, correct model.
2. **Add a "Bust cut overrides momentum-chase guard" exception** to R3's framework. Targeted patch, preserves the clean regime-as-atom model.

Recommend (2) for MVP, (1) for follow-up if more clause conflicts surface.

---

## Scenario 3 — Ambiguous classification: regime scope mismatch

**Category:** Ambiguous classification (priority ordering doesn't resolve cleanly).

**State:**
- Day 2 of 3, 1h 45m until close (LATE phase, R3 threshold boundary).
- Agent score 92, opponent 107 (-15 delta — **exactly** on R4 threshold boundary, assuming threshold = -15).
- Active positions:
  - Star: NVDA at **+0.88x ATR** (0.12x from BaggerBomb → R1 fires).
  - Core: AAPL at **+0.15x ATR** (calm).
  - Support: TSLA at **-0.1x ATR** (calm).
- Bench: META with **all S5 conditions matching** — positive FantasyTimes story from 12 minutes ago (bullish sentiment, volume ratio 1.4x, 5-min break above prev day high, price +0.7% above VWAP, ATR bucket Normal → S5 forces Core tier).

**Regime classification:**
- R1: fires on NVDA (per-position).
- R3: fires (LATE, portfolio-wide clock).
- R4: fires at boundary (portfolio-wide score state, depending on how "on the threshold" resolves).
- S5 overlay: fires on META (bench-candidate level).
- Priority R1 → R2 → R3 → R4. **R1 wins at the regime-priority level.**

**Framework prescription under "R1 wins":**
R1 Bonus Lock-In → HOLD NVDA, no swap-out of NVDA. Terminal decision: HOLD the whole portfolio? Or HOLD just NVDA and let lower-priority regimes act on the rest?

**Why it's ambiguous:**
**Regimes operate at different scopes:**
- R1 is **per-position** (NVDA specifically).
- R3 is **portfolio-wide** (clock applies to all decisions).
- R4 is **portfolio-wide** (score state applies to all decisions).
- S5 is **bench-candidate level** (applies to META specifically).

Priority ordering treats them as composable atoms, but they don't compose cleanly. R1 "owns" NVDA's decision slot; R3/R4 modulate the broader decision space (what to do about AAPL/TSLA, whether to entertain S5's META elevation). Strict priority-R1-wins prescribes HOLD everything — but that discards legitimate downstream decisions.

Conversely, "R1 owns only NVDA, rest of regimes compose below" is the structurally correct answer but isn't what the priority-ordering model says.

**S5 interaction compounds this:**
- S5 elevated META to priority swap-in candidate with forced Core tier.
- R3 says "do NOT chase momentum late" — S5 candidates are momentum.
- R4 (at boundary) says offense permitted (catch up).
- Does S5 fire? Does R3 suppress it? Does R4 un-suppress it?

**Design implication:**
**Priority ordering is insufficient. The design needs per-scope resolution:**

1. **Per-position regimes (R1, R2)** lock their own position's decision. NVDA is HOLD per R1. LUMN in scenario 2 is SWAP-OUT per R2. These are terminal for their position.
2. **Portfolio regimes (R3, R4, R5)** modulate the remaining decision space (unlocked positions + bench).
3. **Candidate-level overlays (S5)** surface targets subject to portfolio-regime allowance.

Without this scope decomposition, priority ordering will produce incorrect terminal-HOLD decisions in multi-signal states. This is a **Layer 2 router architecture revision**, not a prompt revision.

Mark as **revision required** before implementation.

---

## Scenario 4 — Fall-through to R7 with load-bearing shared context

**Category:** Fall-through to R7.

**State:**
- Day 1 of 3, 11:20 AM ET (EARLY, first 2 hours of trading day 1).
- Agent score 22, opponent 25 (-3 delta, well inside R4/R5 deadband).
- Portfolio all within ±0.35x ATR (nothing near thresholds).
  - Star: NVDA +0.3x (`directional_expansion`), AMD -0.25x (`choppy`).
  - Core: MSFT +0.15x (`directional_contraction`), GOOGL -0.1x (`choppy`).
  - Support: AAPL +0.05x, META +0.1x, AMZN -0.15x.
- Bench: ORCL with **BB squeeze** (`bBandwidthPercentile: 18th`), flat on the day. No FantasyTimes story.
- Market posture: **selective**.

**Trigger gate:** fires on `bandwidth_squeeze` (ORCL is squeezed on the bench — Rule 15 flags it as swap opportunity).

**Regime classification:**
- R1 no, R2 no, R3 no (EARLY), R4 no (near-tied), R5 no (near-tied), R6 no (no Forge conflict).
- **R7 fires** (default fall-through).

**Framework prescription under narrow R7 (Cluster 3 per Part 2a):**
R7's 5-rule framework:
1. Rule 2a — don't sell winners with momentum.
2. Rule 2c — forward-EV frame.
3. Rule 4a — EARLY, offense OK.
4. Rule 5 — prefer Support tier.
5. Rule 7 — sector awareness.

**Why this is a visible design gap risk:**

These 5 rules say nothing about:
- Stock regimes (NVDA is `directional_expansion` — hold winners per Rule 20, now in Cluster 2 shared context).
- Market posture `selective` → raises conviction floor to 80% per Rule 18 (now also in shared context; also a universal guard per Cluster 1).
- BB squeeze semantics on bench (Rule 15 says swap opportunity; now in shared context).
- `choppy` regime warning (Rule 22 says avoid swap-in; now in shared context).

**If Layer 3 prompt assembly correctly injects the full shared context block + universal guards with R7's 5-rule framework**, Haiku has everything the current prompt has. R7 works.

**If Layer 3 prompt assembly trims shared context "because R7 is the default and we want a small prompt"**, Haiku loses regime-aware guidance entirely. The ORCL BB squeeze becomes a bare swap-candidate with no sector/posture/regime qualification. Haiku might:
- Swap a Star winner (NVDA `directional_expansion`) for ORCL at Support tier, violating Rule 20's "hold winners" guidance that's now in shared context.
- Swap into ORCL without applying the 80% conviction floor for `selective` posture, violating Rule 18.

**Design implication:**
**R7 is not "smaller than other regimes" in terms of prompt content — it's only smaller in terms of regime-specific rules.** The shared context block is *mandatory* for R7, not optional. The implementation temptation to trim R7's prompt must be explicitly resisted.

Add to Layer 3 implementation spec: **every regime's Haiku prompt = [identity] + [shared context block] + [regime framework] + [universal guard reminders]. No trimming permitted, regardless of regime.**

This is an **implementation-spec requirement**, not a design revision. Flag as an explicit line in the Layer 3 build doc.

---

## Red-team summary

| # | Category | Severity | Fix type |
|---|----------|----------|----------|
| 1 | R4/R5 greenfield vs archetype | **Medium** (UX risk, game-theoretic correct but identity-inconsistent) | Product decision on archetype-modulated R4/R5 tilts; announce shift in status feed |
| 2 | ID-5 regime-vs-clock, clause-level | **Medium** (silent gap becomes routing decision) | Targeted patch to R3's framework: "Bust cut overrides momentum-chase guard" |
| 3 | Regime scope mismatch | **High** (architecture revision) | Layer 2 router must distinguish per-position vs portfolio vs overlay scopes before priority-ordering |
| 4 | R7 shared-context dependency | **Medium** (implementation trap) | Explicit Layer 3 spec requirement: R7 prompt includes full shared context, never trimmed |

**Findings:**
- **Scenarios 1, 2, 4 are product/spec fixes** — the design is sound, but three concrete requirements emerge.
- **Scenario 3 is an architecture revision** — priority ordering alone is insufficient; scope-aware composition required at Layer 2.

This does not flip the acceptance test verdict. Part 3 confirmed the design handles all 7 documented contradictions. The red-team surfaces implementation-level requirements and one architectural refinement.

## Part 4a → Part 4b handoff

Part 4b contains: final design recommendations incorporating Scenario 3's scope-aware routing requirement, implementation readiness assessment, and Questions for Flash (C-4 bleeding threshold, C-5 accelerating metric, R4/R5 greenfield product decision, plus a new one emerging from Scenario 1 on archetype-regime interaction).
