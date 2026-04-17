# Audit 02b — Part 2b: S5 Cross-Regime Override Architecture (Section D)

**Context:** Rule 24 (S5 News-Catalyst Momentum, `agentEvalPromptAssembly.js:128–134`) explicitly applies "across ALL regimes except Distressed." It breaks the mutually-exclusive regime assumption implicit in the R1–R7 matrix. This section evaluates whether S5 should live as a cross-regime overlay (Approach 1) or be duplicated into each regime's framework (Approach 2).

## D.0 — S5 as encoded in the prompt (verbatim)

Rule 24, `agentEvalPromptAssembly.js:128–134`:

> S5 News-Catalyst Momentum (Star/Core tier): When a FantasyTimes story with positive sentiment tags a stock AND volume ratio > 1.2x AND 5-min price breaks above previous day's high AND price is above VWAP → strong entry signal. Assign to Star if ATR High/Extreme, Core if ATR Normal. Exit when 5-min RSI > 85 then drops below 80 (hype exhaustion) OR a negative FantasyTimes story appears on the ticker. Applies across ALL regimes except Distressed.

**Inputs:** FantasyTimes story sentiment + ticker, volume ratio, 5-min price break vs prev-day high, VWAP deviation, ATR bucket, 5-min RSI, distressed flag.

**Effect:** forces a swap-in (entry) on match; forces a swap-out (exit) on hype-exhaustion or negative story.

**Cross-regime semantics:** applies to any `stockRegime` other than `distressed`, meaning it can trigger under R1, R3, R4, R5, R6, R7 — and even R2 (Bust Defense, which typically focuses on swapping out weakness, not swapping in momentum, so R2 interaction is constrained).

## D.1 — The two approaches

### Approach 1 — Cross-regime overlay

S5 evaluation runs after regime selection but before the final tool output. If S5's trigger conditions match a bench candidate, it overrides (or augments) the regime's swap-in recommendation with its own Star/Core tier assignment.

**Pipeline shape:**

```
Layer 1: SituationAssessment (data)
Layer 2: RegimeRouter → picks R1..R7
Layer 3: FrameworkBuilder(regime) → base framework
Layer 3.5: S5Overlay(framework, situation) → augmented framework  ← NEW
Layer 4: PromptAssembler → Haiku call
```

### Approach 2 — Per-regime duplication

Each regime's framework (R1, R3, R4, R5, R6, R7 — excluding R2 distressed-case) includes S5 trigger evaluation independently. Rule 24's logic is reproduced inside each regime's framework specification.

**Pipeline shape:**

```
Layer 1: SituationAssessment (data)
Layer 2: RegimeRouter → picks R1..R7
Layer 3: FrameworkBuilder(regime) → framework (S5 logic baked in per regime)
Layer 4: PromptAssembler → Haiku call
```

## D.2 — Four-dimension comparison

### (1) Interaction with the deterministic router design

**Approach 1 (Overlay):**
- Router remains single-regime. Overlay runs after router, in its own module.
- **Cleaner separation of concerns:** regime = "what game situation am I in?" S5 = "is there a news catalyst I should act on, regardless of situation?"
- Router's output is augmented deterministically — overlay logic can be tested in isolation.
- If S5 fires, it can either (a) replace the regime's swap target, or (b) get merged into the regime's prompt as an additional candidate. Either way, the regime router itself doesn't know about S5.

**Approach 2 (Per-regime duplication):**
- Each regime's framework function grows to include S5 trigger evaluation.
- **Router stays single-regime**, but every regime builder must import/consume the S5 logic.
- If S5 logic lives in a shared helper and is called from each regime, this is de-facto an overlay with per-regime entry points — worst of both worlds (the shared helper exists anyway, but now it's called in 6 places instead of 1).

**Edge:** Approach 1 makes the pipeline's regime dimension cleanly orthogonal to its catalyst dimension. Approach 2 tangles them.

### (2) Interaction with the existing distressed code-level block (`agent-evaluate.js:858`)

**Approach 1 (Overlay):**
- Overlay module carries its own `stockRegime !== 'distressed'` precondition (mirroring Rule 24's text).
- Even if the overlay misses the check, the code block at line 858 catches the distressed-in.
- **Defense in depth.** The block remains the final backstop.

**Approach 2 (Per-regime duplication):**
- Every per-regime S5 invocation must include the distressed check.
- If one regime's framework omits the check (a refactor bug, an off-by-one in a new regime), the code block catches it — but now the failure is per-regime rather than per-overlay.
- Same backstop applies, but the "primary" enforcement is distributed across 6 regimes instead of 1 overlay, increasing the surface for bugs.

**Edge:** Approach 1. Single enforcement point is easier to keep correct.

### (3) Maintenance cost when Rule 24's parameters change

Rule 24 has seven parameters in its trigger:
- FantasyTimes sentiment = 'positive'
- volumeRatio > 1.2
- 5-min price break > prevDayHigh
- price > VWAP
- ATR bucket classification (High / Extreme / Normal)
- 5-min RSI > 85 → < 80 exit trigger
- Negative story exit trigger

Plus the tier-assignment rule (Star if ATR High/Extreme, Core if Normal).

**Approach 1 (Overlay):**
- Tuning any parameter → edit **one** function (`s5Overlay.js` or similar).
- Adding a new condition (e.g. "and not in cooldown") → one edit.
- Removing S5 entirely → delete the overlay + its one invocation site.

**Approach 2 (Per-regime duplication):**
- Tuning any parameter → edit **six** framework builders (R1, R3, R4, R5, R6, R7).
- Shared helper reduces this to **one** edit if all regimes import the helper — but then the "duplication" is syntactic, not logical, and you're back to an overlay.
- Removing S5 entirely → delete six invocations + the shared helper (if any).

**Edge:** Approach 1, decisively. Approach 2 either forces N-way sync (real duplication) or collapses into an overlay (fake duplication). Neither is better than just building the overlay.

### (4) Match with existing codebase patterns

The cron already has precedent for **post-regime, pre-Haiku augmentation layers**:

- **Risk Manager** (`agent-evaluate.js:547–610`, `agentRiskManager.js`): runs after regime classification, before trigger gate; can force emergency swaps bypassing Haiku entirely.
- **Guardrails** (`agent-evaluate.js:802–848`, `agentGuardrails.js`): runs after Haiku returns; can override Haiku's decision based on deterministic thresholds.

Both are essentially overlays. The risk manager is a pre-Haiku overlay; guardrails are a post-Haiku overlay. Neither is duplicated per regime.

**S5 fits the same pattern naturally.** It is a cross-cutting concern (news-catalyst momentum) that applies regardless of game situation — exactly like risk management (applies regardless of regime) and guardrails (applies regardless of regime). Modeling S5 as a third overlay module (`s5Overlay.js` or `agentCatalystOverlay.js`) is structurally consistent with what's already there.

**Approach 2 has no analogue in the existing code.** There is no precedent for per-regime duplication of a cross-cutting rule.

**Edge:** Approach 1, matching established architecture.

## D.3 — Verdict

**Approach 1 (Cross-regime overlay) wins on all four dimensions.**

| Dimension | Approach 1 (Overlay) | Approach 2 (Duplication) |
|-----------|---------------------|--------------------------|
| 1. Router interaction | Cleaner separation | Tangles regime + catalyst |
| 2. Distressed block interaction | Single primary enforcement | Per-regime enforcement, higher bug surface |
| 3. Parameter maintenance | One edit point | N-way sync or collapses to overlay |
| 4. Codebase pattern match | Matches risk-manager + guardrails pattern | No precedent |

### Recommended implementation sketch

```js
// api/_utils/agentCatalystOverlay.js
/**
 * Evaluate S5 News-Catalyst Momentum trigger.
 * Pure logic; consumes SituationAssessment + per-candidate technicals.
 *
 * @param {Object} situationAssessment - Layer 1 output
 * @param {Object[]} benchCandidates - With stockRegime, ATR bucket, VWAP, RSI, story feed
 * @returns {null | {
 *   kind: 's5_entry',
 *   symbol: string,
 *   tier: 'star' | 'core',
 *   thesis: string,
 *   exitConditions: { rsiHypeExhaustion: boolean, negativeStory: boolean }
 * }}
 */
export function evaluateCatalystOverlay(situationAssessment, benchCandidates) {
  // Preconditions: filter distressed (Rule 24 explicit exclusion + redundant backstop at line 858)
  const eligible = benchCandidates.filter(c => c.stockRegime !== 'distressed');

  // Trigger: positive story + volume > 1.2x + 5-min break > prevDayHigh + price > VWAP
  for (const candidate of eligible) {
    if (matchesS5Entry(candidate)) {
      const tier = (candidate.atrBucket === 'High' || candidate.atrBucket === 'Extreme')
        ? 'star' : 'core';
      return { kind: 's5_entry', symbol: candidate.symbol, tier, /* ... */ };
    }
  }

  return null;
}
```

**Invocation site in `agent-evaluate.js`:** after regime selection (Layer 2), before prompt assembly (Layer 3). If overlay returns non-null, its output is merged into the framework passed to the prompt builder — either as a priority swap-in candidate or as a forced-decision (same pattern as guardrails).

### What this preserves

- **Rule 24's trigger semantics** — verbatim implementation of the seven parameters.
- **The distressed exclusion** — enforced twice (overlay precondition + code block at line 858).
- **Tier forcing (Star/Core by ATR)** — overlay returns the tier directly.
- **Exit conditions** — the overlay's return shape carries them so the regime framework can incorporate them into Haiku's prompt (e.g., "S5 exit watch: RSI > 85 then < 80 OR negative story").

### What this breaks (intentionally)

- **C-2 contradiction** — Rule 5 ("prefer Support") vs Rule 24 ("assign Star/Core by ATR") — resolved by overlay: when S5 fires, its tier assignment supersedes Rule 5. The overlay's explicit precondition (S5 fired) means Rule 5's "unless the case for Star is overwhelming" clause is satisfied by S5's trigger match.
- **C-3 contradiction** — Rule 22 (avoid choppy swap-in) vs Rule 24 (S5 cross-regime) — resolved by overlay: S5 fires before regime-level swap-in filters, so it can swap into a choppy stock if the S5 trigger matches. Rule 22 remains the default when S5 does not fire.

Both resolutions match the prompt's textual intent (Rule 24's "across ALL regimes except Distressed" is the more-specific clause and should win).

## Part 2b → Part 3 handoff

S5 resolves cleanly as a cross-regime overlay matching the existing risk-manager + guardrails pattern. No per-regime duplication required. Two documented contradictions (C-2, C-3) are pre-resolved by this choice.

Part 3 is the acceptance test: run all 7 documented contradictions (C-1 through C-7) through the new design and verify the design produces deterministic, correct answers for each. Pass/fail gate for the whole regime matrix.
