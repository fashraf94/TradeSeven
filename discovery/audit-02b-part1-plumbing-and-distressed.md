# Audit 02b — Part 1: Dead Plumbing Evaluation + Distressed Block Compatibility

**Prerequisite read:** `audit-02a-part1..part4`, `audit-01-assessment.md`, `audit-01b-regime-classifier.md`. Focus files: `api/_utils/agentRegimeClassifier.js` (full), `api/cron/agent-evaluate.js:846–880`.

## Section A — Dead plumbing evaluation

### A.1 Return shapes of `getStrategiesForRegime` and `getPresetAdjustedStrategies`

**`getStrategiesForRegime(regime)`** — `agentRegimeClassifier.js:99–112`.

- **Input:** one string.
- **Output:** `string[]`.
- **Mapping (switch statement):**
  - `'directional_expansion'` → `['volatility_squeeze_breakout', '52w_high_breakout']`
  - `'directional_contraction'` → `['rs_momentum_vwap_pullback']`
  - `'choppy'` → `['vwap_mean_reversion']`
  - `'distressed'` → `[]` (no buy strategies — exit only)
  - `default:` → `[]`

**`getPresetAdjustedStrategies(regime, presetConfig)`** — `agentRegimeClassifier.js:122–149`.

- **Input:** regime string + preset config object (shape from `agentPresetConfig.js`, exposes `regime.holdOnlyRegimes: string[]` and `regime.favoredStrategies: string[]`).
- **Output:** `string[]`. Empty array means HOLD-ONLY.
- **Logic:**
  1. If `presetConfig` missing → fall through to `getStrategiesForRegime(regime)`.
  2. If `holdOnlyRegimes` includes the regime → return `[]` (force HOLD).
  3. If base strategies exist → intersect with `favoredStrategies` (keep favored order).
  4. If base empty and regime is `'distressed'` → return `[]` (preserve exit-only).
  5. Otherwise → return `favoredStrategies`.

**Bottom line:** both functions return `string[]`. They are pure value-to-value mappers — no Firestore, no side effects, no awareness of battle state. The strings are **opaque** to the classifier; they only have meaning downstream (in prompts or strategy dispatchers that recognize names like `'volatility_squeeze_breakout'`).

### A.2 Can the signatures accept R1–R7 game-state regimes?

**Function signature: yes, trivially** — both accept `regime: string`. Passing `'R1_BonusLockIn'` would not crash; it would just fall through to the `default` branch and return `[]`.

**Switch semantics: no, not as written** — the switch in `getStrategiesForRegime` is hard-coded to the four market-state regime literals. R1–R7 inputs fall through to `default:` → `[]` (HOLD-ONLY), which means every game-state regime would currently prescribe HOLD. That's a fail state, not extension.

**Preset interaction:** `getPresetAdjustedStrategies` consults `presetConfig.regime.holdOnlyRegimes` and `.favoredStrategies`. Those lists are currently populated with market-state regime names in `agentPresetConfig.js`. They would need to be rekeyed if R1–R7 shared the same namespace.

### A.3 Minimum change to make the functions R1–R7-aware

The cleanest minimum change:

1. **Keep `getStrategiesForRegime` as-is** (tied to market-state regimes — that's its documented contract).
2. **Add a parallel function** `getFrameworkForGameRegime(situationAssessment) → FrameworkSpec` that returns the decision framework for a game-state regime. Distinct namespace, distinct return shape (a framework is richer than a strategy-name list — see A.4).
3. **Compose them at the call site:** the router calls `getFrameworkForGameRegime(sa)` to pick the framework, and inside that framework the market-state regime and its `getStrategiesForRegime` output remain available as context inputs, not drivers.

Why not reuse `getStrategiesForRegime` by extending the switch: the market-state regime is a **stock property** (per-symbol), the game regime is a **situation property** (per-decision). Cramming both into one string → string[] mapper conflates axes that Audit 01b confirmed are orthogonal.

### A.4 Proposed signature for `getFrameworkForGameRegime`

```js
/**
 * Select the decision framework for a game-state regime (R1–R7).
 * Pure logic; no Firestore, no side effects.
 *
 * @param {Object} situationAssessment  // from Layer 1 (audit 01)
 * @returns {{
 *   regime: 'R1'|'R2'|'R3'|'R4'|'R5'|'R6'|'R7',
 *   prescribedAction: 'HOLD' | 'SWAP' | 'EVALUATE_SWAP',
 *   forcedConstraints: string[],        // hard rules (e.g. ["no swap-out", "support tier only"])
 *   allowedStrategies: string[],        // consumed by downstream prompt builder
 *   convictionFloor: number,            // e.g. 70 or 80
 *   citedRules: string[],               // for status feed provenance
 *   overlays: { s5Eligible: boolean },  // cross-regime overlays (see Section D)
 * }}
 */
export function getFrameworkForGameRegime(situationAssessment) { ... }
```

- **Deterministic:** a router can short-circuit `prescribedAction === 'HOLD'` without calling Haiku at all (matches the Rule 33 "one swap max" and Rule 1 "default HOLD" patterns).
- **LLM-as-executor, not router:** when `prescribedAction === 'EVALUATE_SWAP'`, Haiku only picks the swap target within `allowedStrategies`. The regime is pre-selected by code.
- **Auditable:** `citedRules` gives the status feed its provenance line. Matches the existing `cited_rules` field in the Haiku tool schema (`agentEvalToolSchema.js`).

### A.5 Git-history findings on why the dead plumbing was never wired up

`git log --follow api/_utils/agentRegimeClassifier.js` shows two commits, both on 2026-04-08 (merge + a same-day fix on intraday prices). The file itself was introduced earlier by `ab368a8` (2026-03-26, "feat: add regime classification, risk management, and status feed to agent eval"). That commit message is explicit:

> Modified files: ... `agentEvalPromptAssembly.js`: **Inject regime context, strategy rules per regime, and risk status into eval prompt**

"Strategy rules per regime" went into the prompt as prose (the `━━━ REGIME-AWARE STRATEGY ━━━` block, `agentEvalPromptAssembly.js:104–136`), not into code dispatch. `getStrategiesForRegime` and `getPresetAdjustedStrategies` appear to be **speculative scaffolding** — written alongside the classifier, intended for future deterministic dispatch, but never wired up because the team chose prompt-based routing from the start.

No commit message suggests the pattern was *abandoned*. It was simply **never attempted**. This is mildly good news for the 02b redesign — there's no prior unhappy experience to overcome.

## Section B — Distressed block compatibility

Block at `api/cron/agent-evaluate.js:858–864`:

```js
// Block Haiku from swapping IN distressed stocks
if (decision === 'SWAP' && haikuResult && stockRegimes[haikuResult.symbolIn] === 'distressed') {
  validationErrors.push(`${haikuResult.symbolIn} is DISTRESSED regime — swap blocked`);
  decision = 'HOLD';
  downgraded = true;
  console.warn(`${LOG_PREFIX} SWAP blocked: ${haikuResult.symbolIn} is distressed`);
}
```

**Behavior:** fires only on SWAP decisions. Blocks swap-in of a distressed symbol by forcing HOLD. Does not block swap-out of a distressed symbol currently held. `stockRegimes` is computed at `agent-evaluate.js:496` for every portfolio + bench symbol via `classifyStockRegime`.

### B.1 Scenario table

| # | Scenario | Distressed block fires? | Correct under new design? | Implication |
|---|----------|-------------------------|---------------------------|-------------|
| 1 | **R4 Catch-Up picks a distressed bench stock for high-ATR variance** | **Yes** — `stockRegimes[symbolIn] === 'distressed'` → forced HOLD | **Yes — preserved correctly.** The block protects R4 from its own aggression. R4's "buy volatility" tilt should not override the distressed exclusion. | **(a) preserved correctly.** No change needed. R4 framework should pre-filter distressed bench symbols so Haiku doesn't even try — the code block is a safety net. |
| 2 | **R5 Protect Lead picks a low-ATR safety bench stock** | **Unlikely to fire** — distressed requires high ATR + below SMA20 + negative MACD (per `classifyStockRegime`); low-ATR safety picks typically fail the high-vol precondition. | **Correct by construction.** The block is orthogonal to R5's decision space. | **(a) preserved correctly.** No change; but R5 framework should explicitly prefer regime ∈ {`directional_expansion`, `directional_contraction`} for swap-in to reinforce the implicit guarantee. |
| 3 | **R2 Bust Defense swaps OUT a distressed holding** | **Does not fire** — block only gates swap-IN. Swap-OUT of distressed is not only permitted but encouraged by Rule 23. | **Correct.** R2 + distressed-in-portfolio is exactly the case Rule 23 is designed for. | **(a) preserved correctly.** R2 framework should explicitly mark distressed holdings as priority swap-out candidates. |
| 4 | **R1 Bonus Lock-In does not swap** | **Does not fire** — block only applies when `decision === 'SWAP'`. R1's prescribed action is HOLD (Rule 6a, Rule 26 LOCKED). | **Correct.** No interaction. | **(a) preserved correctly.** |
| 5 | **R7 Normal Optimization picks a bench stock that happens to be distressed** | **Yes — forced HOLD, decision downgraded.** This is the block's happy path today. | **Yes — preserved correctly**, but the block **silently** downgrades a SWAP to HOLD. Under the new design, R7 should pre-filter distressed bench symbols so the block never fires (cleaner provenance). | **(b) needs explicit awareness in framework.** R7's `allowedStrategies` / bench-candidate filter should exclude distressed up front, making the code block a **redundant backstop** rather than the primary enforcement. |
| 6 | **Rule 24 (S5 News-Catalyst) + R4 — S5 explicitly excludes distressed; does this conflict?** | **No conflict at the code level.** S5 already carries `stockRegime !== 'distressed'` as a precondition (audit-02a Rule 24). Even if Haiku attempted S5 on a distressed catalyst, the block at 858 catches it. | **Correct by layered defense.** Prompt-level S5 filter + code-level block converge. | **(a) preserved correctly.** Under the new design, the S5 overlay (see Section D) must reproduce the `!== 'distressed'` guard, OR leave it to the block — either works. |

### B.2 Verdict on the block itself

**Keep the block.** Three reasons:

1. **Layered defense.** It's a 6-line, zero-cost backstop that would catch any regime-framework bug that lets a distressed swap-in through. The cost of removing it is disproportionate to the risk of keeping it.
2. **Prior art.** It's the *only* code-level regime branch in the cron today. The new regime router will introduce *many* such branches. Retaining the distressed block establishes the architectural precedent the router extends. Removing it because "the router does that now" would be premature — the router is new code; the block has been in production for weeks.
3. **Semantic clarity.** The block encodes Rule 23's "STRICT EXCLUSION" as code, not prose. Keeping it makes the strict-exclusion promise enforceable regardless of prompt drift.

**Minor improvement:** log the block's firing more visibly in the status feed so we detect when the router lets a distressed-in slip through. Today the firing emits `console.warn` + a validationError, but does not add a dedicated status-feed entry for user visibility. Not a blocker for the regime design — a follow-up cleanup.

### B.3 Do any of scenarios 1–6 motivate lifting the block into the router?

**No.** The block is at the right layer:

- Lifting into the router would duplicate the guard in each of R4, R5, R7 (scenarios 1, 2, 5) — cost without benefit.
- The router can still pre-filter distressed bench symbols before Haiku even sees them; the block catches the edge case where the pre-filter is incomplete or a regime change happens mid-evaluation.

Recommendation: **router performs defense-in-depth pre-filtering; code block remains as the final enforcement.**

## Part 1 → Part 2 handoff

Section A concludes that `getStrategiesForRegime` should be left as a market-state helper and a parallel `getFrameworkForGameRegime` should be built; the dead plumbing is speculative scaffolding, not an abandoned pattern.

Section B concludes that the distressed code-level block is correct, well-placed, and should be preserved under the new design; all 6 scenarios are either correctly handled today or require only framework-level pre-filtering to improve provenance.

Part 2 tackles Section C (R7 subdivision — the question of whether "Normal Optimization" absorbing 20 rules actually defeats the pipeline's narrow-prompt goal) and Section D (Rule 24 / S5 cross-regime override architecture).
