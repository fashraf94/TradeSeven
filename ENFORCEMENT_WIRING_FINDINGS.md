# Forge Rule Enforcement-Wiring Audit — Findings

**Type:** Read-only discovery. No code was modified; this report is the only file created.
**Date:** 2026-05-29
**Method:** Static read of the actual code in the repo (`rg`/`Read`). Design docs and prior recon were *not* trusted — every verdict below is backed by a pasted snippet with `file:line`.

**The one question:** For each mechanism the design treats as "hard," is it actually enforced by code today, or does it exist only as words injected into a prompt that Haiku is free to ignore?

**Short answer up front:** The platform has a **small, real deterministic core** (the Risk Manager + the 24h cooldown + the trigger gate + the deployed-strategy Guardrails), and a **large prompt-only surface** (every `mb-*` Forge rule the user authors). The `injectionClass` enum from the design **does not exist anywhere in the codebase** — not in code, not in markdown, not in the .docx specs. So the design's "hard vs. soft" tagging is, today, decorative: it is not the thing that decides whether a rule is enforced.

---

## 1. Determinism Map (headline table)

| Mechanism | Intended injectionClass | Verdict | Evidence (file:line) |
|---|---|---|---|
| **Trigger gate** | — (gate) | **CODE-ENFORCED** | `api/_utils/agentTriggerGate.js:20-184`; called `api/cron/agent-evaluate.js:859`, gate at `:867` |
| **Hurdle (mb-04)** | hurdle_modifier | **PROMPT-ONLY** | Defined only in `src/data/forgeKnowledgeBase.js:617-638` & collections; **zero** hurdle math in `api/`. `agentSwapExecution.js:66` |
| **Circuit breaker (mb-07)** | veto | **NOT FOUND** | `mb-07` only in `src/data/*`; no `maxSwaps`/`swapsThisWindow`/window-cap in code. `agentSwapExecution.js:66` |
| **Stagnation exit (mb-03)** | forced_exit | **PROMPT-ONLY** | Defined `forgeKnowledgeBase.js:589-613`; no "moved < X ATR in Y min" code anywhere |
| **VWAP invalidation (mb-15)** | hard_constraint | **Split: platform = CODE-ENFORCED; user mb-15 = PROMPT-ONLY** | Platform: `agentRiskManager.js:52-58` (+ tick counter `agent-evaluate.js:624-629`, consumed `:647`). User rule: `forgeKnowledgeBase.js:896-918` |
| **Stop loss (mb-09 user rule)** | hard_constraint | **PROMPT-ONLY** | mb-09 (ATR-based) defined `forgeKnowledgeBase.js:743-766` → rendered to prompt only. (A *different* %-based stop-loss exists as a deployed guardrail — see below.) |
| **Bust buffer (platform floor)** | — (risk mgr) | **CODE-ENFORCED** | `agentRiskManager.js:35,43-49`; consumed `agent-evaluate.js:647` → executes `:713` |
| **Patience veto (mb-01)** | veto | **PROMPT-ONLY** | mb-01 `forgeKnowledgeBase.js:564-587`; `swappedInAt` is *written* (`agentSwapExecution.js:194`) but never *read* for a hold-time gate |
| **Risk Manager (whole)** | — | **CODE-ENFORCED** | `agentRiskManager.js:30-86`; wired `agent-evaluate.js:612-752` |
| **Deployed Guardrails (whole)** | — | **CODE-ENFORCED (conditional on a deployed strategy)** | `agentGuardrails.js:58-331`; wired into the BaggerBomb cron `agent-evaluate.js:964-1010` |
| **User-authored Forge rules** | preference | **PROMPT-ONLY** | `agentEvalPromptAssembly.js:283-322` renders them as text; no decision branch consumes `activeRules` |
| **`injectionClass` field itself** | — | **NOT FOUND** | `rg "injectionClass"` → 0 hits across `.js`, `.md`, `.docx` |

> **Crucial distinction used throughout:** prompt text that says "MUST" (e.g. the tool description "you MUST choose HOLD") is **PROMPT-ONLY**. CODE-ENFORCED means JavaScript reads a value, compares it, and changes the outcome regardless of what Haiku returned — and below I paste that comparison/override logic in every CODE-ENFORCED case.

---

## 2. Per-Task Evidence Appendix

### Task 1 — Does `injectionClass` exist in code at all? → **NOT FOUND (entire enum)**

Commands:
```
rg -n "injectionClass" --type js      # 0 hits
rg -n "injectionClass"                # 0 hits (all file types)
rg -n "injectionClass" --glob "*.md"  # 0 hits
for f in *.docx; do grep -a -o "injectionClass" "$f"; done  # 0 hits
```
**Result: zero occurrences anywhere in the repository** — not in source, not in the markdown design docs, not even as a string inside the `.docx` specs.

*What this means:* the `injectionClass` taxonomy (`hard_constraint` / `forced_exit` / `veto` / `hurdle_modifier` / `preference`) is **spec-only / decorative**. There is no field on any rule object, and — critically — there is **no branch anywhere of the form `if (rule.injectionClass === 'forced_exit') {…}`**. The schema cannot be the thing that decides enforcement, because the code has never heard of it. This alone largely answers the audit: enforcement is decided by *which hardcoded subsystem* a behavior lives in, not by any per-rule tag.

The actual `mb-*` rule objects carry `id`, `category`, `forgeTemplates`, `params`, `tags`, etc. — but no enforcement class:
```js
// src/data/forgeKnowledgeBase.js:564
{ id: 'mb-01', category: 'mid_battle', modes: 'clash', headline: 'Give your pick time to work',
  description: '…', forgeTemplates: [ { text: 'Do not swap a stock held for less than {minutes} minutes…', params: {…} } ],
  tags: ['swap','patience','timing','hold'], agentUseDescription: 'Your agent will refuse to swap…' }
```

---

### Task 2 — The full mid-battle swap pipeline, stage by stage

Entry point: **`api/cron/agent-evaluate.js`**, scheduled in `vercel.json`:
```json
{ "path": "/api/cron/agent-evaluate", "schedule": "*/15 13,14,15,16,17,18,19,20,21 * * 1-5" }
```
i.e. **every 15 minutes during market hours, weekdays** — this is the mid-battle cron. (Season Mode is a different, daily pipeline: `season-daily-evaluate`, `"schedule":"30 20,21 * * 1-5"`; `agent-evaluate.js` imports **none** of the season rule machinery.)

Order of operations the cron actually runs (line numbers from `agent-evaluate.js`):

**Stage 0 — Risk Manager (runs BEFORE the gate and BEFORE Haiku). Verdict: CODE-ENFORCED.**
```js
// agent-evaluate.js:612   "// ---- Risk evaluation layer (runs BEFORE trigger gate) ----"
// :637
const riskResult = evaluateRisk(
  { symbol: score.symbol, tier: asset?.tier, baseATR: score.baseATR },
  currentPrice, entryPrice, score.baseATR, intradaySnapshot,
  { ticksBelowVwap: vwapTicks[score.symbol] }, presetConfig.risk );
// :647
if (['EMERGENCY_SWAP', 'SWAP_OUT', 'TRAIL_STOP'].includes(riskResult.action)) { riskSwaps.push({ score, asset, riskResult }); }
// :713  — executes WITHOUT any Haiku call
const riskSwapResult = await executeSwapServer(db, battle.id, battle, slot.tier, slot.slotIndex, replacement, currentDay, prices, evaluationMetadata, snapshot);
```
*This is the strongest deterministic path: a computed condition forces a real swap before the LLM is ever consulted.* Detail in Task 7.

**Stage 1 — Trigger gate. Verdict: CODE-ENFORCED (deterministic).**
```js
// agent-evaluate.js:859
const { shouldEvaluate, triggers, newStoryIds } = evaluateTriggers(battle, assetScores, prices, news, momentumData, seenStoryIds);
// :867
if (!shouldEvaluate) { … summary.held++; return; }   // no triggers → Haiku is never called
```
Trigger categories & thresholds in Task 3.

**Stage 2 — Haiku call. Verdict: the discretionary brain.**
```js
// agent-evaluate.js:896
anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 1024,
  temperature: 0.4,
  system: buildEvalSystemPrompt(agentName, archetype),
  messages: [ … buildLiveContextBlock(…) … ],
  tools: [TRADE_DECISION_TOOL],
  tool_choice: { type: 'tool', name: 'submit_trade_decision' },
})
```
Decision values it can return — only **two** (`api/_utils/agentEvalToolSchema.js:12-17`):
```js
decision: { type: 'string', enum: ['HOLD', 'SWAP'], description: 'HOLD = keep all positions. SWAP = replace one active position…' }
```
There is **no `SWAP_IN` / `SWAP_OUT` / `DEBATE`** in the mid-battle tool. (A `SWAP_OUT` string exists only as a *Risk-Manager* internal action; `DEBATE` lives in the separate deploy-time `api/agent/debate.js`.) On timeout/error the cron defaults to HOLD (`:928`).

**Stage 3 — Hurdle check (mb-04). Verdict: NOT PRESENT (Haiku's word goes straight through).** There is no code between Haiku returning a SWAP and execution that computes a bench-vs-active ATR margin. See Task 4.

**Stage 4 — Circuit breaker (mb-07). Verdict: NOT PRESENT.** No swap-count-per-window cap. See Task 5.

**Stage 5 — Guardrails / Risk overrides on Haiku's decision. Verdict: CODE-ENFORCED.**
- Deployed Guardrails can rewrite Haiku's decision (`:964-1010`, detail in Task 7).
- LOCK veto: `:1013` — `if (decision==='SWAP' && lockedPositions.has(haikuResult.symbolOut)) { … decision='HOLD'; }`
- Distressed-in veto: `:1021` — blocks swapping *into* a `distressed` regime stock.
- Validation: `:1031` `validateTradeDecision(haikuResult, battle)` (conviction floor, cooldown, type match).

**Stage 6 — Execution. Verdict: single gated writer.**
```js
// agent-evaluate.js:1030
if (decision === 'SWAP' && haikuResult) {
  const validation = validateTradeDecision(haikuResult, battle);
  if (!validation.valid) { … decision='HOLD'; downgraded=true; }     // :1032 hard gate
  else { … if (mode === 'autopilot') { … executeSwapServer(…) } }    // :1048,:1084
}
```
`executeSwapServer` (`api/_utils/agentSwapExecution.js:102`) is the sole bench/swap writer; it runs a Firestore transaction and only writes when a valid live price exists (`:184` throws otherwise). Copilot/manual proposal mode is **launch-guarded off** — `:1043` forces `mode='autopilot'`, so the proposal branch (`:1104+`) is dead in normal operation.

**Numbered trace:**
1. Risk Manager → **CODE-ENFORCED** (can force a swap pre-Haiku)
2. Trigger gate → **CODE-ENFORCED** (decides if Haiku runs)
3. Haiku → discretionary (HOLD/SWAP only)
4. Hurdle (mb-04) → **NOT PRESENT** / PROMPT-ONLY
5. Circuit breaker (mb-07) → **NOT FOUND**
6. Deployed Guardrails + LOCK/distressed/validation vetoes → **CODE-ENFORCED**
7. Execution (`executeSwapServer`) → **CODE-ENFORCED** single writer

---

### Task 3 — The trigger gate, in detail (the HFT frequency floor)

`api/_utils/agentTriggerGate.js:evaluateTriggers(battle, assetScores, prices, news, momentumData, seenStoryIds)`. Note the signature takes **no preset/archetype argument** — so **every threshold below is a HARDCODED literal**, not tunable per archetype.

| # | Trigger type | Condition (pasted) | Threshold source |
|---|---|---|---|
| 1 | `forced_open` | `if (evaluations.length === 0)` → always fire (`:27`) | hardcoded |
| 2 | `forced_close` | `if (phase === 'FINAL_HOUR')` (`:34`) | hardcoded (≤60 min to close, `:258`) |
| 3 | `price_drop` | `if (score.multiplier <= -0.5)` (`:43`) | **hardcoded −0.5x ATR** |
| 4 | `threshold_proximity` (penalty) | within `0.2` of −1.0/−1.5/−2.0 (`:56-68`) | **hardcoded 0.2x + fixed bands** |
| 5 | `threshold_proximity` (bonus) | within `0.2` of +1.0/+1.5/+2.0, badge not earned (`:72-87`) | **hardcoded** |
| 6 | `bench_outperformance` | `benchATRMult = dailyChangePct / benchATR; if (benchATRMult >= 0.5)` (`:104-106`) | mult **hardcoded 0.5**; `benchATR = benchAsset.baseATR || 2.5` (per-asset ATR, not per-archetype) |
| 7 | `vwap_deviation` | `if (Math.abs(dev) >= 1.5)` (`:123`) | **hardcoded 1.5%** |
| 8 | `bandwidth_squeeze` | `if (bBandwidthPercentile <= 20)` (`:140`) | **hardcoded 20th pctl** |
| 9 | `nr7_contraction` | `if (rankInfo.nr7Flag)` (`:148`) | boolean flag |
| 10 | `news_catalyst` | FantasyTimes story tickers ∩ active/bench symbols, unseen (`:161-176`) | n/a |

Pasted example (the only "per-asset" value, and it's an ATR, not a tunable threshold):
```js
// agentTriggerGate.js:102
const dailyChangePct = benchPrice.changePercent || 0;
const benchATR = benchAsset.baseATR || 2.5;
const benchATRMult = dailyChangePct / benchATR;
if (benchATRMult >= 0.5) { triggers.push({ type: 'bench_outperformance', … }); }
```

**Stagnation / dead-money trigger (suspected mb-03: "hasn't moved X ATR in Y minutes"): NOT FOUND in the gate or anywhere in code.**
```
rg -ni "stagnation|stagnant|dead.?money|movedLess|hasn.t moved|flatlin" api/   # only stockIntelligenceData prose + no logic
```
There is no `atr`/`minutes` stagnation parameter read from a per-archetype param because there is no stagnation code at all. (mb-03 exists only as a Forge rule definition + prompt text — Task 6.)

**Verdict — Task 3:** the trigger gate is **CODE-ENFORCED and deterministic**, but its frequency thresholds are **hardcoded constants, not archetype/rule/config-tunable.** The agent's "how often do I wake up" floor is fixed in source.

---

### Task 4 — The hurdle (mb-04) → **PROMPT-ONLY**

Commands:
```
rg -n "mb-04|hurdle|hurdleConfig|hurdleRate|final_hurdle|finalHurdle" --type js
rg -ni "hurdle|outperform|exceeds.*atr|margin" api/cron/agent-evaluate.js api/_utils/agentEvalPromptAssembly.js api/_utils/agentSwapExecution.js
```
Findings:
- **All `mb-04`/"hurdle" hits live in `src/data/`** (`forgeKnowledgeBase.js`, `forgeCollections.js`, `traitLibrary.js`) — these are rule-library *content*, not decision logic. The definition:
```js
// src/data/forgeKnowledgeBase.js:617
{ id: 'mb-04', headline: 'Demand proof before swapping',
  forgeTemplates: [{ text: "Only swap if the bench stock's intraday performance exceeds the active stock's by at least {atr} ATR",
    params: { atr: { default: 0.5, min: 0.25, max: 1.0, … } } }] }
```
- In `api/` decision code, the only "hurdle/outperform" matches are **prose inside prompt strings / few-shot examples** (e.g. `agentEvalPromptAssembly.js:230` is a sample monologue). **There is no `final_hurdle`, no `base × streak × volume` computation, and no numeric branch that gates a swap on a hurdle.** ("BEM Phase 6" appears nowhere in `.js`.)
- Confirming the absence of *any* margin gate, the swap validator explicitly documents that there is no quantity gate at all:
```js
// agentSwapExecution.js:66
// NO swap budget check (Amendment 2: unlimited agent swaps)
```

**Verdict:** the hurdle concept lives **only in prompt assembly / rule-library data.** Its output is never consumed by a code branch that gates a swap. Haiku's word goes straight through. (Prior recon's "`grep mb-04 api/` returns zero hits" is **confirmed** — `rg -n "mb-0[34579]|mb-15" api/` → empty.)

---

### Task 5 — The circuit breaker (mb-07) → **NOT FOUND**; the 24h cooldown → **CODE-ENFORCED**

Command:
```
rg -n "mb-07|maxSwaps|swapCount|circuit|effective_max_swaps|swapsThisWindow|cooldown" --type js
```
- `mb-07` appears **only** in `src/data/*`. There is **no** `maxSwaps`, `swapsThisWindow`, `effective_max_swaps`, or any "count swaps in a window and block past a cap" code. The mb-07 definition is data only:
```js
// src/data/forgeKnowledgeBase.js:701
text: 'If {swaps} or more swaps are executed within {window} minutes, disable non-emergency evaluations for {freeze} minutes'
```
- The one `agent-evaluate.js` "circuit" hit (`:1515`) is an unrelated comment about *autopilot proposal expiry* ("circuits autopilot mode to auto_executed"), not a swap-frequency cap.
- Explicitly, swaps are uncapped: `agentSwapExecution.js:66  // NO swap budget check (Amendment 2: unlimited agent swaps)`.

**The 24h bench cooldown IS code-enforced — and it's a clean example of what real enforcement looks like in this codebase.** Two halves:
```js
// (a) WRITE the cooldown when an asset goes to bench — agentSwapExecution.js:213-221 (revolving door)
const outgoingForBench = { symbol: outAsset.symbol, …,
  cooldownUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() };

// (b) BLOCK swap-in while cooled — agentSwapExecution.js:43-49
if (benchAsset?.cooldownUntil) {
  const cooldownEnd = new Date(benchAsset.cooldownUntil);
  if (cooldownEnd > new Date()) { errors.push(`symbolIn "${decision.symbolIn}" is on 24h cooldown until …`); }
}
```
That `errors` array is what flips a SWAP to HOLD at `agent-evaluate.js:1032-1036`. The cooldown is also honored by the Risk Manager's replacement picker (`agentRiskManager.js:115-117`) and the trigger gate (`agentTriggerGate.js:97`).

**Verdict:** "max N swaps in M minutes" is **purely prompt text** (and even the prompt's "ONE SWAP MAXIMUM / NO ROUND-TRIPS" anti-thrash block at `agentEvalPromptAssembly.js:175-182` is prompt-only). The only code-enforced anti-churn mechanism is the **24h revolving-door cooldown**.

---

### Task 6 — Forced exits & hard constraints (mb-03, mb-15, mb-09)

**mb-03 (stagnation forced exit) → PROMPT-ONLY.** Defined `forgeKnowledgeBase.js:589-613` ("Swap any stock that has moved less than {atr} ATR … over the last {minutes} minutes"). No "moved < X ATR in Y min" computation exists in code (see Task 3 empty search). Not evaluated, not acted on.

**mb-15 (VWAP invalidation) → the *platform* version is CODE-ENFORCED; the *user mb-15 rule* is PROMPT-ONLY.**
- Platform VWAP-failure is real. The cron counts consecutive below-VWAP ticks:
```js
// agent-evaluate.js:624
if (vwapInfo && vwapInfo.vwapDeviation < 0) { vwapTicks[score.symbol] = (vwapTicks[score.symbol]||0)+1; } else { vwapTicks[score.symbol]=0; }
```
and the Risk Manager forces a swap on it:
```js
// agentRiskManager.js:52
if (intradaySnapshot && cronMemory?.ticksBelowVwap >= vwapTicks) {
  return { action: 'SWAP_OUT', reason: 'vwap_failure', detail: `${position.symbol} below VWAP … for ${cronMemory.ticksBelowVwap} consecutive ticks…` };
}
```
`vwapTicks` defaults to 2 and is **preset-tunable** (`agentRiskManager.js:36` `?? 2`; presets 1/2/3 in `agentPresetConfig.js`).
- But the **user's mb-15 Forge rule** (`forgeKnowledgeBase.js:896-918`, configurable `intervals` 2-5, default 3) is *not* wired to that `vwapFailureTicks` value — there is no code reading mb-15's `intervals` param. The user-facing rule reaches Haiku only as prompt text.

**mb-09 (stop loss) — two layers, and they are NOT the same mechanism:**

(a) **The user's mb-09 Forge rule → PROMPT-ONLY.** Note it is **ATR-based**, not %-of-entry as the task framing assumed:
```js
// src/data/forgeKnowledgeBase.js:753
text: 'Automatically swap any stock that drops below {atr} ATR from entry, regardless of tier or hold time',
params: { atr: { default: -1.0, min: -1.5, max: -0.5, … } }
```
This is rendered into the prompt (as a CONSTRAINT) and otherwise never enforced.

(b) **The platform `bustBuffer` → CODE-ENFORCED.** This is the real deterministic backstop, in the Risk Manager, and it is ATR-based:
```js
// agentRiskManager.js:35
const bustBuffer = presetOverrides.bustBuffer ?? -0.85;
…
// :43
if (atrMultiplier <= bustBuffer) {
  return { action: 'EMERGENCY_SWAP', reason: 'bust_avoidance', detail: `… Hit ${bustBuffer}x bust avoidance buffer. Emergency rotation…` };
}
```
Consumed at `agent-evaluate.js:647` and executed at `:713` with **no Haiku involvement**. Default −0.85x ATR, preset-tunable (`agentPresetConfig.js`: aggressive −0.90 / balanced −0.85 / defensive −0.75).

(c) **A *third* stop-loss exists — the deployed-strategy `stopLoss` guardrail — and it IS %-of-entry and CODE-ENFORCED** (see Task 7). It comes from the Strategy-Lab dimension surface, *not* from the mb-09 Forge rule.

**So: (a) and (b) are two different layers.** The user's mb-09 (ATR, prompt-only) and the platform bustBuffer (ATR, code-enforced) are independent; a user editing mb-09 does **not** change the bustBuffer. The only user-tunable lever on the bustBuffer is the battle's `strategyPreset`.

---

### Task 7 — Characterize the deterministic surface that DOES exist

#### 7a. Risk Manager (`api/_utils/agentRiskManager.js`) — CODE-ENFORCED

Pure function `evaluateRisk(...)` returns the single highest-priority action. Hardcoded constants + the exact firing conditions:

| Priority | Action | Condition (pasted) | Constants |
|---|---|---|---|
| 1 | `EMERGENCY_SWAP` (bust) | `if (atrMultiplier <= bustBuffer)` (`:43`) | `bustBuffer ?? -0.85` (`:35`) |
| 2 | `SWAP_OUT` (VWAP fail) | `if (intradaySnapshot && cronMemory?.ticksBelowVwap >= vwapTicks)` (`:52`) | `vwapTicks ?? 2` (`:36`) |
| 3 | `LOCK` (near bonus) | `if (atrMultiplier >= threshold-0.2 && atrMultiplier < threshold)` (`:63`) | `BONUS_THRESHOLDS=[1.0,1.5,2.0]` (`:7`), `LOCK_PROXIMITY=0.2` (`:8`) |
| 4 | `TRAIL_STOP` | `if (atrMultiplier >= trailATR && currentPrice < intradaySnapshot.sma20_5m)` (`:76`) | `trailATR ?? 1.5` (`:37`) |
| 5 | `HOLD` | default (`:85`) | — |

Wiring (`agent-evaluate.js`): `EMERGENCY_SWAP|SWAP_OUT|TRAIL_STOP` → `executeSwapServer` at `:713` (pre-Haiku, deterministic); `LOCK` → `lockedPositions.add(...)` (`:651`), which later vetoes any Haiku SWAP of that symbol (`:1013`). Thresholds are fed from `presetConfig.risk` (`:642`) keyed on `battle.strategyPreset` (`:231`).

#### 7b. Deployed Guardrails (`api/_utils/agentGuardrails.js`) — CODE-ENFORCED, and **it runs for BaggerBomb agent battles** (conditional on a deployed strategy)

`applyGuardrails(...)` inspects Haiku's decision and **overrides it**. The hard checks and their override logic:
```js
// stopLoss (hard): force exit on P&L breach — agentGuardrails.js:97-109
stopLossBreach = pickWorstBreach(held, prices, battle,
  pos => { const pnl = computePnLPct(pos, prices, battle); return pnl <= -Math.abs(stopLoss.value) ? pnl : null; },
  -Math.abs(stopLoss.value));
// computePnLPct is %-of-entry — agentGuardrails.js:364-369: ((current - entry)/entry)*100
```
```js
// On a breach it REWRITES the decision to a forced SWAP — agentGuardrails.js:307-314
return { decision: 'SWAP', symbolOut: forcedBreach.symbol, symbolIn: replacement.symbol, overrides,
         statusMessage: `Guardrail override: ${thresholdLabel} breached on ${forcedBreach.symbol} … Forcing exit → ${replacement.symbol}.`,
         sourceNote: `guardrail_${forcedType}` };
```
Field-by-field enforcement: `stopLoss` (hard, %-of-entry, force SWAP), `trailingStop` (hard, drawdown from implied peak via `thresholdHistory.maxMultiplier`, `:376-390`), `maxSectorWeight` (hard, blocks the SWAP → HOLD, `:317-326` + `checkSectorCap` `:423-454`), `maxPosition` (logged `skipped_incompatible` — "BaggerBomb uses fixed tier slots", `:181-192`), `profitTarget` (soft, note only, `:194-217`).

**Call site proving it runs in the BaggerBomb mid-battle cron (not just Season Mode):**
```js
// api/cron/agent-evaluate.js:964
const deployedGuardrails = battle.agentContext?.deployedGuardrails || [];
if (deployedGuardrails.length > 0) {
  const result = applyGuardrails({ haikuResult, guardrails: deployedGuardrails, battle, prices, lockedPositions, stockRegimes });
  …
  if (result.decision === 'SWAP') { haikuResult = { …, decision:'SWAP', symbolOut: result.symbolOut, symbolIn: result.symbolIn, … }; decision = 'SWAP'; }  // :985-997 materializes the override
  else if (result.decision === 'HOLD' && originalDecision === 'SWAP') { … decision = 'HOLD'; downgraded = true; }                                            // :998-1002 blocks the swap
}
```
**What `deployedGuardrails` contains at runtime** and how it gets there (the full chain):
1. Authored as Strategy-Lab **dimensions** → converted by `dimensionsToGuardrails(dv)`:
```js
// src/utils/dimensionMapper.js:1269
out.push({ type: 'stopLoss',        value: stopLoss,        unit: '%', enforcement: 'hard' });
out.push({ type: 'trailingStop',    value: trailingStop,    unit: '%', enforcement: 'hard' });
out.push({ type: 'maxSectorWeight', value: maxSectorWeight, unit: '%', enforcement: 'hard' });
out.push({ type: 'maxPosition',     value: maxPosition,     unit: '%', enforcement: 'hard' });
out.push({ type: 'profitTarget',    value: profitTarget,    unit: '%', enforcement: 'soft' });
```
   (A **fixed set of 5** — no stop-loss-ATR, no hurdle, no circuit breaker.)
2. Written onto the agent doc by the deploy service:
```js
// src/services/deployStrategyService.js:152-160
const deployedStrategy = { …, directives: …, guardrails: Array.isArray(guardrails) ? guardrails : [], … };
// :172  await updateDoc(agentRef, { deployedStrategy, … });
```
3. **Snapshotted into the battle at creation** (this is the BaggerBomb agent-battle creator, called from `api/agent/decide.js:550`):
```js
// api/_utils/agentBattleService.js:123  (inside createAgentBattle)
deployedGuardrails: Array.isArray(agentData.deployedStrategy?.guardrails) ? agentData.deployedStrategy.guardrails : [],
```
4. Read & enforced by the BaggerBomb cron at `agent-evaluate.js:964` (above).

**Verdict — Task 7:** Guardrail enforcement **does run for BaggerBomb agent battles** — it is wired end-to-end. It is **conditional**: if the agent has no deployed strategy, `deployedGuardrails` is `[]` and `applyGuardrails` is a no-op (`:965` guard). Note this surface is fed by the **dimension** authoring UI, *not* by the `mb-*` Forge rules.

---

### Task 8 — How Forge rules reach the prompt → user-authored Forge rules are **PROMPT-ONLY**

Rendering site (`api/_utils/agentEvalPromptAssembly.js:282-322`). Framing **does vary**, but it varies by `r.category`, not by any `injectionClass`:
```js
// :283
const activeRules = ctx.activeRules || [];
if (activeRules.length > 0) {
  const constraintCats = new Set(['risk', 'allocation']);
  const constraints = activeRules.filter(r => constraintCats.has(r.category));
  const strategies  = activeRules.filter(r => !constraintCats.has(r.category));
  …
  ruleLines.push(`== CONSTRAINTS (must obey) ==\n${cLines.join('\n')}`);        // :294
  …
  ruleLines.push(`== STRATEGY PREFERENCES (should follow) ==\n${sLines.join('\n')}`);  // :300
  parts.push(`YOUR FORGE RULES:\n${ruleLines.join('\n\n')}`);                   // :322
}
```
Reinforced by system-prompt text:
```
// :170-171
- CONSTRAINTS (C1, C2, ...) are HARD rules — you must obey them unless Survival Mode activates.
- STRATEGY PREFERENCES (S1, S2, ...) are SOFT rules — follow them when possible but you may deviate with explanation.
```
**But this "must obey" is addressed to the LLM, not to any code.** `activeRules` is consumed in exactly three places — all prompt-building or telemetry, never a decision branch:
- rendered as the text above (`:322`);
- to *gate which news/institutional context* to fetch (`:738-758`);
- nowhere does `if (activeRules…)` change a swap outcome.

**Verdict — Task 8:** Confirmed — **user-authored Forge rules are PROMPT-ONLY, with no path to deterministic enforcement.** The "CONSTRAINT vs. STRATEGY PREFERENCE" framing is a *prompt label* keyed on `category ∈ {risk, allocation}`; whether Haiku honors a "CONSTRAINT" is entirely Haiku's discretion. The only way a user-authored quantity becomes deterministically enforced is by going through the *separate* Strategy-Lab dimension → guardrail pipeline (Task 7), which a user authoring `mb-*` rules never touches.

---

## 3. The two-sentence summary a non-coder needs

**Of the rules the design treats as hard, almost none of the *user-facing* ones are enforced in code: the forced exits and hard constraints you write in Forge (mb-03 stagnation, mb-09 stop-loss, mb-15 VWAP exit), the hurdle (mb-04), the circuit breaker (mb-07), and the patience veto (mb-01) are all just words injected into Haiku's prompt that it may weigh or ignore — the only truly code-enforced "physics" today is the platform Risk Manager (bust buffer at −0.85× ATR, VWAP-failure, LOCK, trailing stop), the 24-hour bench cooldown, the deterministic trigger gate, and the small set of validation vetoes (conviction ≥ 70, type-match, distressed/LOCKED blocks).**

**Yes, there is exactly one family of code paths that changes a swap outcome without going through Haiku's discretion: (1) the Risk Manager, which executes emergency/VWAP/trail swaps *before* Haiku is even called (`agent-evaluate.js:713`), and (2) the Deployed Guardrails, which override Haiku's decision after the fact (`agent-evaluate.js:964-1010`) — but Guardrails are fed only by the Strategy-Laboratory "dimensions" deploy (a fixed set of 5: stopLoss, trailingStop, maxSectorWeight, maxPosition, profitTarget), and are inert unless a strategy has been deployed onto the agent; the Forge rule builder the user normally edits has no wire into either path.**

---

## 4. Anything surprising (noted, NOT fixed)

1. **`injectionClass` exists nowhere in the repo** — not in code, markdown, or the `.docx` specs. The taxonomy that frames this whole audit is, in the shipped codebase, an idea with no representation. Enforcement is decided by *which subsystem* owns a behavior, never by a per-rule class.

2. **Two parallel, non-communicating rule systems.** (a) **Forge rules** (`mb-*`, `agent.activeRules`) → prompt-only. (b) **Strategy-Lab dimensions** → `guardrails` → genuinely enforced. A user who writes "stop-loss at −1.0 ATR" in the Forge rule builder (mb-09) gets a *prompt suggestion*; the only way to get an enforced stop is to author a `stopLossPct` dimension in the Strategy Lab and *deploy* it. Same words, completely different teeth, with no bridge between the two UIs. This is the single most important finding for "why does the agent ignore my rules."

3. **Stale enforcement comment.** `src/utils/dimensionMapper.js:1267` still says *"Phase 4A only persists them — nothing in the battle path reads them yet."* That is no longer true: Phase 4B (`agent-evaluate.js:964` + `agentGuardrails.js`) reads and enforces them. The comment understates what the code now does.

4. **`agentArchetypeConfig.js` risk overrides look dead — and have the wrong sign.** Each archetype carries `riskOverrides.bustBuffer` as a **positive** number (`0.90 / 0.85 / 0.75`, `agentArchetypeConfig.js:16,39,…`). But the Risk Manager compares `if (atrMultiplier <= bustBuffer)` and is actually fed from `agentPresetConfig.js`, which uses **negative** values (`-0.90 / -0.85 / -0.75`). `getArchetypeConfig` is only imported by `api/agent/create-profile.js` (for default slider values), **never** by `evaluateRisk`. So the archetype `riskOverrides` are unused for the risk path today — and if anyone ever wired them in as-is, a positive `bustBuffer` would make `atrMultiplier <= 0.85` true for almost every position and fire emergency swaps constantly. Latent bug; left untouched.

5. **mb-09's unit contradicts the task's framing.** The audit brief assumed the user stop-loss rule "speaks %-of-entry." The actual mb-09 template speaks **ATR** (`default: -1.0` ATR, `forgeKnowledgeBase.js:757`). The %-of-entry stop-loss is a *different* object — the deployed `stopLoss` guardrail derived from the `riskPosture.stopLossPct` dimension (`dimensionMapper.js:1278-1281`). Worth aligning the mental model: there are effectively **three** stop concepts (mb-09 ATR prompt-rule; deployed %-guardrail; platform bustBuffer ATR).

6. **Circuit breaker was explicitly dropped even from the dimension surface.** `dimensionMapper.js:23`: *"Dropped: riskPosture.circuitBreaker … (no matching season rule template)."* So mb-07 has no path to enforcement on *either* surface.

7. **Copilot/manual execution modes are launch-guarded dead code.** `agent-evaluate.js:1043` forces `mode='autopilot'` and warns if anything set otherwise; the entire proposal-creation branch (`:1104-1177`) and parts of the proposal-resolution machinery are preserved-but-unreachable in normal operation.

8. **Prompt "MANDATORY" anti-thrash rules have no code backstop except the cooldown.** `agentEvalPromptAssembly.js:175-182` tells Haiku "ONE SWAP MAXIMUM per evaluation" and "NO ROUND-TRIPS," but nothing in code blocks a round-trip beyond the 24h bench cooldown; "one swap max" holds only because the tool schema structurally allows a single `symbolOut`/`symbolIn`.

9. **Conviction floor is enforced twice and described once.** The tool description says "you MUST choose HOLD" if conviction < 70 (prompt), *and* `validateTradeDecision` re-checks it in code (`agentSwapExecution.js:62`), which is the real gate. A good example of a rule that is both PROMPT-stated and CODE-ENFORCED — most rules are only the former.
