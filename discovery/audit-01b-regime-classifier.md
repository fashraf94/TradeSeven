# Audit 01b — Probe: `agentRegimeClassifier.js`

**Scope:** Single-file probe. Answers 9 questions about the existing regime classifier before we design a regime-based decision pipeline.

**File:** `api/_utils/agentRegimeClassifier.js` — 150 lines.

---

## 1. Exports

| Export | Signature | Lines | Return |
|---|---|---|---|
| `classifyStockRegime` | `classifyStockRegime(stockData)` | 25–55 | `'directional_expansion' \| 'directional_contraction' \| 'choppy' \| 'distressed'` |
| `classifyMarketPosture` | `classifyMarketPosture(marketContext, spyData)` | 68–90 | `'risk_on' \| 'selective' \| 'defensive'` |
| `getStrategiesForRegime` | `getStrategiesForRegime(regime)` | 99–112 | `string[]` (strategy names, possibly empty) |
| `getPresetAdjustedStrategies` | `getPresetAdjustedStrategies(regime, presetConfig)` | 122–149 | `string[]` — wraps `getStrategiesForRegime` with preset overrides |

Internal helpers (not exported): `getATRRegime(atrPercent)` at line 6, plus module-private constants `HIGH_VOL_REGIMES`, `LOW_VOL_REGIMES` at lines 14–15.

## 2. Regime vocabulary (verbatim)

**Stock regimes** (returned by `classifyStockRegime`):
- `'directional_expansion'`
- `'directional_contraction'`
- `'choppy'`
- `'distressed'`

**Market postures** (returned by `classifyMarketPosture`):
- `'risk_on'`
- `'selective'`
- `'defensive'`

**Internal ATR regime labels** (used only inside `getATRRegime`):
- `'extreme'` (ATR% > 4)
- `'high'` (ATR% > 3)
- `'normal'` (ATR% > 1.5)
- `'low'` (ATR% ≤ 1.5)

## 3. Inputs

- **`classifyStockRegime(stockData)`** — expects a `stockTechnicalScores` document shape:
  - `stockData.atrPercent` (number)
  - `stockData.factors`: `{ aboveSMA20, aboveSMA50, aboveSMA200, rsi, macdHistogram, macdAboveSignal, upDayVolRatio }` — lines 28–36 read these.
  - **Not battle-aware.** Does not take battle, scores, prices, or portfolio. Pure per-stock technical classification.
- **`classifyMarketPosture(marketContext, spyData)`** — expects:
  - `marketContext`: `indexIntelligence/marketContext` Firestore doc with `regime` (`'bull' | 'correction' | 'bear' | 'recovery'`) and `volatilityRegime` (`'extreme' | 'high' | 'normal' | 'low'`) — lines 71–72.
  - `spyData`: `indexIntelligence/SPY` Firestore doc with `sma200.position` (`'above' | 'below'`) and `sma200.distance` (number) — lines 73–74.
  - **Not battle-aware.** No per-agent or per-battle inputs.
- **`getStrategiesForRegime(regime)`** — regime string only.
- **`getPresetAdjustedStrategies(regime, presetConfig)`** — regime string + a `presetConfig` object from `api/_utils/agentPresetConfig.js` (reads `presetConfig.regime.holdOnlyRegimes` and `presetConfig.regime.favoredStrategies`).

## 4. Outputs

- `classifyStockRegime` → single regime string (one of four), falling through to `'choppy'` when nothing else matches (line 54) or when input is missing (line 26).
- `classifyMarketPosture` → single posture string (one of three), defaulting to `'selective'` when data is missing (line 69) or when no priority branch hits (line 89).
- `getStrategiesForRegime` → ordered `string[]` of strategy names; empty array for `'distressed'` (exit-only) or unknown regimes.
- `getPresetAdjustedStrategies` → `string[]` filtered/overridden by preset; empty array means HOLD_ONLY.

All outputs are plain strings or arrays — no structs, no metadata wrappers, no confidence scores.

## 5. Callsites

Exhaustive grep across `api/` + `src/`:

- **`api/cron/agent-evaluate.js:30`** — imports `classifyStockRegime`, `classifyMarketPosture`, `getPresetAdjustedStrategies`.
- **`api/cron/agent-evaluate.js:490`** — `const marketPosture = (marketContext && spyData) ? classifyMarketPosture(marketContext, spyData) : 'selective';` Result stored on `momentumData.marketPosture` (line 500) and passed into the prompt + stamped on every evaluation record.
- **`api/cron/agent-evaluate.js:496`** — `stockRegimes[symbol] = classifyStockRegime(techScore);` inside a per-symbol loop; result stored on `momentumData.regimes` (line 499).
- **`getPresetAdjustedStrategies`** — imported at `agent-evaluate.js:30` but **never invoked**. No callsites anywhere.
- **`getStrategiesForRegime`** — no external callers; referenced only on line 132 of the same file (internal use inside `getPresetAdjustedStrategies`).

**Net:** the file is wired into the cron for two functions (`classifyStockRegime`, `classifyMarketPosture`). The strategy-mapping half (`getStrategiesForRegime`, `getPresetAdjustedStrategies`) is **dead code** today.

## 6. Decision-routing layer

**There is no code-level decision-routing layer that branches on regime.** The regime labels flow through two channels:

1. **Prompt metadata.** `agent-evaluate.js:499–500` attaches `momentumData.regimes` and `momentumData.marketPosture`; `agentEvalPromptAssembly.js:518–520` injects them via `buildRegimeContext` (defined at lines 815–832), which renders:
   - `MARKET POSTURE: <posture>`
   - `STOCK REGIMES: SYM=label, SYM=label, ...`
   These are just labels — no per-regime conditional prompt text is assembled in code.
2. **LLM-as-router.** The system prompt itself (`agentEvalPromptAssembly.js:113–134`, block header `━━━ REGIME-AWARE STRATEGY ━━━`) spells out the behavior per regime *in prose* (verbatim excerpt):
   > STOCK REGIMES:
   > - directional_expansion: Strong trend + volume. Strategies: …
   > - directional_contraction: Quiet uptrend. Strategy: …
   > - choppy: No clear direction. Strategy: S4 VWAP Mean Reversion only …
   > - distressed: High volatility + downtrend. STRICT EXCLUSION. Do NOT buy distressed stocks. If held, evaluate for swap-out immediately.

   Haiku reads the regime label for a stock and applies the prose rules itself.
3. **One hard code-level gate** — `agent-evaluate.js:858–864` blocks any Haiku SWAP whose `symbolIn` carries `stockRegimes[symbolIn] === 'distressed'`. This is the only code path that branches on a regime value.

There is no `switch (regime)`, no per-regime prompt template, no per-regime tool choice, and no per-regime tier rules in code. The classifier is a **metadata producer**, not a router.

## 7. Git history

- `git log --follow --format="%h %ad %s" --date=short api/_utils/agentRegimeClassifier.js`
- **First commit:** `136d19e` — 2026-04-08 (merge of PR #277).
- **Most recent:** `9b0d97a` — 2026-04-08 ("fix: use real-time client prices instead of 15-min delayed EODHD REST").
- File is new (created within the last ~8 days) and has not churned.

## 8. Header comment

Lines 1–3:

```
// api/_utils/agentRegimeClassifier.js
// Per-stock regime classification + market posture detection.
// Pure logic — no API calls, no Firestore, no side effects.
```

Self-describing: a pure-logic utility that reads pre-computed technical data and returns labels.

## 9. Overlap with proposed R1–R7

The existing regimes describe **market/technical state**. The proposed R1–R7 describe **game-state situations** (score posture, clock position, conflicts). They are orthogonal axes — a single position can simultaneously sit in `directional_expansion` (existing) and `R1 Bonus Lock-In` (proposed).

| Existing | Proposed map |
|---|---|
| `directional_expansion` | No 1:1. Enables R1 (Bonus Lock-In) when also near a bonus threshold; compatible with R7 (Normal Optimization). |
| `directional_contraction` | No 1:1. Compatible with R7. |
| `choppy` | No 1:1. Compatible with R7; weakly correlates with R4 (Catch-Up) when dwell time produces mediocre scoring. |
| `distressed` | **Partial overlap with R2 (Bust Defense)**: a distressed stock that is also near a `-1.0x`/`-1.5x`/`-2.0x` ATR threshold is the exact population R2 targets. Distinction: existing `distressed` fires purely on technicals (ATR regime + SMA20 + MACD) regardless of score; R2 is score-/threshold-driven. The two can coincide but are defined on different signals. |
| `risk_on` (posture) | No 1:1. Cross-cuts every R. |
| `selective` (posture) | No 1:1. Cross-cuts every R. |
| `defensive` (posture) | No 1:1. Weakly correlates with R2/R5 (Bust Defense / Protect Lead) as a multiplier on defensiveness, but is not a substitute. |

Conversely, none of R3 (Endgame), R4 (Catch-Up), R5 (Protect Lead), R6 (Rule-Directive Conflict) have *any* representation in the existing classifier — those are pure game-state constructs with no technical-market analogue.

---

## Implications for the 3-layer pipeline design

1. **No lock-in.** `agentRegimeClassifier.js` is a 150-line pure-logic utility with two live callsites and no schema dependencies. Extending or ignoring it carries negligible cost.
2. **LLM-as-router is already the pattern.** The existing design attaches regime labels as prompt metadata and lets the LLM act on them via prose system-prompt rules. Adding R1–R7 as *additional* metadata labels fits this pattern without touching code-level routing. If the new pipeline wants code-level routing (different tools/prompts per regime), that would be a new layer on top — the existing file doesn't stand in the way.
3. **Dead-code recovery opportunity.** `getStrategiesForRegime` and `getPresetAdjustedStrategies` are imported but never invoked. If the new pipeline wants deterministic strategy selection per regime, these functions can be activated rather than rewritten.
4. **`distressed` gate is the only precedent** for a hard code-level regime branch (`agent-evaluate.js:858–864`). When proposing code-level branches for R1–R7, this is the architectural model to follow.
