# Exit-Behavior Rebalance — Tier 2 Phase 0 Verification

**Read-only discovery report — the eight facts the build depends on.**
Prepared for founder review. **HARD STOP after the eight** — no code written, no fenced edits. The build spec follows your review.

---

## Session preamble (BUILD_RULES §2 / §3)

| | |
|---|---|
| **Branch** | `claude/tier2-phase0-verification-10boz2` |
| **HEAD SHA** | `24145cf0fe7d645f4ec57621f942cbf4b99b1d46` |
| **Base** | Identical to `origin/main` (`24145cf0`) — 0 commits ahead, cut fresh off main |
| **Tree** | Clean |
| **`git fetch origin`** | Run at session start (§3 first-step); `origin/main` re-confirmed at `24145cf0` |
| **Mode** | READ-ONLY. Reading fenced calibration files is §1-permitted; nothing was edited or staged. |

### ⚠️ Document-availability caveat (read this first)

The three authoritative documents you attached — `20260815_EXIT_BEHAVIOR_TIER2_FOUNDER_RULINGS_V1`, the **Fable Design Review V1**, and **Brief V2** — were referenced by **local Windows paths** (`C:\Users\fashr\Downloads\…`) and **did not travel into the cloud container**; they are not present on disk here. I therefore verified the eight facts **directly against the code**, using the assumption embedded in each Phase-0 item as you stated it in the prompt. Where a finding turns on the *intent* of a specific ruling (R4, the Contrarian wording), I've marked what the **code** says and flagged the interpretive half as yours to adjudicate. If any ruling's exact wording matters to a verdict below, re-attach the docs via the GitHub UI (or paste them) and I'll re-check against the literal text.

### Method

8 verification lanes, each run as an independent discovery agent **and** an adversarial verifier instructed to *refute* it with a concrete re-read (BUILD_RULES §2 adversarial standard). Every `file:line` below was opened this session and cross-checked by the refuter; **all eight findings survived refutation, all citations re-confirmed accurate.** Items 1, 3, 4 were additionally read by me directly. (Item 2's discovery agent hit a structured-output failure and was re-run as a standalone author-then-refute pair; its refuter confirmed the finding and could not break it.)

Legend: **BUILT** = built as the item assumes · **DIVERGES** = built but differs materially · **ABSENT** = the thing asked about doesn't exist · **MIXED** = part BUILT / part ABSENT.

---

## Executive verdict table

| # | Fact under test | Verdict | Founder-revisit? |
|---|---|---|---|
| 1 | `guardrail_stopLoss`/`guardrail_trailingStop` in the **D3 allowlist**? | **BUILT** — they're OUT of it (deterministic, fail-closed) | No |
| 2 | Do deterministic **stops fire through gameplan-suppression**? | **DIVERGES** — the **guardrail** stops are **SUPPRESSED** in the gameplan window; risk-manager stops are not | **⚠️ YES** |
| 3 | Does the stop path respect **LOCKED** positions? | **BUILT** — guardrail stop defers on a locked symbol (`blocked_by_lock`) | No (one caveat) |
| 4 | **Entry-price** baseline — executor vs UI/ledger (Gain%-vs-Daily% trap)? | **BUILT / agrees** — both use `swapPrice‖startingPrice` (Gain-since-entry) | No (build hazard noted) |
| 5 | **Distance-to-threshold / badge** data already in the eval prompt? | **MIXED** — badges/ATR-mult present; numeric distance-to-threshold **ABSENT** → data add | No (data add) |
| 6 | **Battle-context technical indicators** — does a resistance read exist? | **MIXED** — none in the battle doc; the eval-time set **does** include resistance | **⚠️ YES (good news)** |
| 7 | **Receipt-source regex** compatible with literal `guardrail_profitTarget`? | **ABSENT (no regex)** — enum-membership gate rejects it fail-closed → data add | No (data add) |
| 8 | **`pickEmergencyReplacement`** pool semantics for the target's replacement path | **MIXED** — held-exclusion & hotBench recency **ABSENT**; and the function is **DEAD** (no live caller) | **⚠️ YES** |

**Three items warrant a founder look before the build spec locks:** #2 (stops silently suppressed in the gameplan window), #6 (a resistance read *does* exist — the Contrarian wording is grounded, so the "only where they exist" guard passes), and #8 (`pickEmergencyReplacement` is the wrong — retired — function to model the target's replacement path on).

---

## The findings in detail

### 1 — D3 allowlist membership of the stop exit reasons → **BUILT**

`guardrail_stopLoss` and `guardrail_trailingStop` are members of the **valid-exit-reason enum** `RECEIPT_EXIT_REASONS` (`api/_utils/learning/learningEnums.js:36-37`) but are **NOT** in the **D3 discretionary allowlist** `D3_DISCRETIONARY_EXIT_REASONS`, which is frozen to exactly `['haiku_decision']` (`learningEnums.js:49`). `isAllowlistedDiscretionary()` returns `false` for both, fail-closed (`learningEnums.js:66-67`).

"The D3 allowlist" resolves unambiguously to `D3_DISCRETIONARY_EXIT_REASONS`: its sole non-test consumer is the D3 churn predicate `classifyD3Predicate`, which skips any prior swap whose exit reason isn't allowlisted (`api/_utils/learning/detectorClassifiers.js:329`, import at `:21`, comment at `:327`). The ANNEX A5 doc-comment names this array "D3's positive allowlist" and warns it is deliberately **not** `EMERGENCY_BYPASS_REASONS` (`learningEnums.js:42-46`).

**Consistent with "R4 mirrors whatever stops do":** a new profit-target R4 exit reason modeled on the stops would be **added to `RECEIPT_EXIT_REASONS`** (validity) while staying **OUT of `D3_DISCRETIONARY_EXIT_REASONS`**, so it would not count as discretionary churn — exactly how the stops behave. *Scope note (adversarial residual):* this item pins **only** D3 membership. Receipt **validity** is a separate gate — `isValidExitReason` (`learningEnums.js:57-58`) — and a stop-modeled R4 not present in `RECEIPT_EXIT_REASONS` would be rejected fail-closed (this overlaps item 7's data add). *(All VERIFIED.)*

---

### 2 — Stop behavior on gameplan-suppression days → **DIVERGES ⚠️ FOUNDER-REVISIT**

**There are two deterministic stop tiers, and they sit on opposite sides of the gameplan gate:**

- **Risk-manager tier** — `evaluateRisk()` (`api/cron/agent-evaluate.js:1349`) yields actions `EMERGENCY_SWAP / SWAP_OUT / TRAIL_STOP` (reasons `bust_avoidance / vwap_failure / stepped_trail / stagnation`), collected into `riskSwaps` (`:1360-1361`) and executed in the "Execute risk-triggered swaps (no Haiku needed)" loop at **`:1371`** — **upstream** of the gameplan gate.
- **Guardrail tier** — `applyGuardrails()` enforces the deployed `stopLoss`/`trailingStop` and emits `sourceNote: \`guardrail_${forcedType}\`` (`api/_utils/agentGuardrails.js:441, :502`). Its **only** non-test call site is **`agent-evaluate.js:2065`** — **downstream** of the gameplan gate.

**The gameplan gate returns before the guardrail tier runs.** On a suppression tick the per-battle function `processAgentBattle` early-`return`s at:
- **`agent-evaluate.js:1803`** — `handleGameplanMeeting()` returned `'skip_haiku'`, or
- **`agent-evaluate.js:1831`** — a fresh meeting was just created ("*Write and skip Haiku — gameplan IS the evaluation*").

Both returns precede `:2065` in the same function scope, so **`applyGuardrails` is never reached** on those ticks. **Consequence: the guardrail deterministic stops (`guardrail_stopLoss`/`guardrail_trailingStop`) do NOT fire during gameplan suppression.** The risk-manager stops (executed at `:1371`) **do** still fire — they're not suppressed.

**Scope, sharpened by the adversarial pass (important):** suppression is **per-tick and time-bounded**, not a whole "day." `handleGameplanMeeting` returns `'skip_haiku'` on **only one** sub-path — *meeting pending AND not expired* (`agent-evaluate.js:3505-3507`). The other resolutions `return 'continue'` and **fall through to `applyGuardrails` normally**: `approved` (`:3472`), `rejected` (`:3484`), `expired` (`:3502`). So guardrail stops are suppressed (a) on every tick a meeting is pending-and-unexpired, and (b) on the tick that first creates one — a window bounded by `expiresAt` / user resolution — and resume on the resolution/expiry tick. Approved-gameplan swaps themselves exit with `exitReason: 'gameplan_rotation'` (`:3353, :3439`), never a `guardrail_*` reason.

**Why it matters:** since "R4 mirrors whatever stops do" and the sibling items (D3, receipt regex) center on the **`guardrail_*`** exit reasons, R4 (profit-target) modeled on the guardrail tier would inherit this suppression window. If the intended behavior is "the protective/profit-target stop fires no matter what," that is **not** today's behavior for the guardrail tier — **the ruling premise may need revisiting. This is a founder call, not mine.** *(All VERIFIED; finding survived adversarial refutation — no counterexample found.)*

---

### 3 — Stop behavior vs LOCK at the executor level → **BUILT**

The guardrail stop path explicitly respects a LOCKED position. When a stop-loss/trailing breach is picked (`forcedBreach`, `agentGuardrails.js:303`), the **first** branch of the compose block checks the lock (`:401` → `:403 if (locked.has(forcedBreach.symbol))`) and, if locked, records `action: 'blocked_by_lock'` (`:410`, comment "*never force exit a locked position*" `:402`) and returns passthrough — **the stop does not fire.** The `locked` set is a first-class input (`:234`), populated by the executor solely from the risk manager's `LOCK` action (`agent-evaluate.js:1363-1364`) and passed in at `:2070`. A second, corroborating gate blocks a **Haiku** SWAP of a locked `symbolOut` (`agent-evaluate.js:2112`).

**Two caveats worth your eye (both VERIFIED, neither breaks the verdict):**
1. The lock respected is the **agent bonus-proximity risk LOCK** (within 0.2× ATR of a bonus, `agentRiskManager.js:129`), **not** a user "locked-in for the day" position/pick flag — no user-layer lock is read anywhere in the stop path.
2. The **harder risk-manager exits outrank LOCK**: `bust_avoidance` (priority 1) and `vwap_failure` (priority 2) return *before* `LOCK` (priority 3) in `evaluateRisk`, so those protective exits **will** fire on a bonus-proximate position and are **not** lock-gated. Only the guardrail stops and the priority-outranked `TRAIL_STOP` defer on LOCK. *(All VERIFIED.)*

---

### 4 — Entry-price definition: executor vs UI/ledger (the Gain%-vs-Daily% trap) → **BUILT / agrees**

There is **no** Gain%-vs-Daily% mismatch on the entry-price axis today — the executor's stop read site and the displayed ledger derive their baseline from the **same** field precedence, `swapPrice ‖ startingPrice` (cost basis → Gain-since-entry):

- **Executor / stop side:** `entryPrice = asset?.swapPrice || startingPrices[…]` (`agent-evaluate.js:1313`) flows into `evaluateRisk`, which measures `priceChangePct = ((currentPrice - entryPrice) / entryPrice) * 100` (`agentRiskManager.js:97`; param doc `:54`). The guardrail tier uses the identical basis via `getEntryPrice` = `swapPrice ‖ startingPrices` (`agentGuardrails.js:539-546`).
- **Display / ledger side:** the swap executor writes `entryPrice = outAsset.swapPrice || startingPrices[…]` (`agentSwapExecution.js:191-192`) and `lockedGainPct = scoreResult.priceChange` (`:242`, from `rawPctChange = ((exitPrice-entryPrice)/entryPrice)*100` `:233`); the ledger reads that as `gainPct` (`leagueSwapLedger.js:118`). `priceChange` is documented "Percent change **from entry price**" (`agentScoring.js:218`).

The separate `dailyPct` / `changePercent` field is isolated to **bench/forced-rotation momentum** logic and never enters the stop threshold.

**Build hazard to carry into the spec (not a current defect):** the "trap" is live risk **for the new profit-target read** — it must compute against `getEntryPrice`/`swapPrice‖startingPrice` (Gain-since-entry), **not** `prices[symbol].changePercent` (Daily%), or the fired threshold would disagree with the displayed Gain%. *Adversarial residual:* a short-direction **sign** convention differs between the two sides (scorer negates for shorts, `agentSwapExecution.js:231`; the stop formula `agentRiskManager.js:97` does not) — a sign/direction concern adjacent to, but not on, the baseline axis; worth a glance if profit-target must handle shorts. *(All VERIFIED.)*

---

### 5 — Threshold-proximity / badge data in the eval prompt → **MIXED (data add)**

**Present (BUILT):** per active position the eval prompt's Live-Context CSV carries `$Entry, $Current, Gain%, ATR Mult, Badges, ATR%` (`agentEvalPromptAssembly.js:1181`; badge render `:1191, :1193`; badges computed in `agentScoring.js:80, :297`). The system prompt also has an explicit **"THRESHOLD PROXIMITY"** section (`agentEvalPromptAssembly.js:125`) with the prose rule "within 0.2× ATR of a bonus → HOLD."

**Absent (data add):** there is **no computed numeric distance-to-threshold** field. The model is handed the raw `ATR Mult` and the list of already-crossed badges and must **derive** proximity itself from the prose rule. The scoring module *already computes* a distance internally — `detectRedZone()` (within 25% of the next uncrossed threshold) and the band-distance `distPct = (nextPositive - currentMultiplier) * baseATR` (`agentScoring.js:190`) — but the eval assembly never calls it, and the returned score object (`agentScoring.js:288-302`) omits any red-zone/distance field.

**The data add:** wire an explicit per-position "Δ to next bonus (× ATR / %)" into the eval context. *Adversarial residual:* `detectRedZone`/`isSwapLocked` only return a value inside their proximity bands (else null), so an **always-present** column needs a fresh compute (next-threshold − current-multiplier × baseATR), not merely a call to either as-is. *(All VERIFIED. Function is named `detectRedZone`, not `getRedZone`.)*

---

### 6 — Battle-context technical indicator set → **MIXED ⚠️ FOUNDER-REVISIT (grounds the Contrarian wording)**

**In the battle doc itself: nothing.** `createAgentBattle` (`agentBattleService.js`) attaches **zero** technical indicators — the doc holds roster tiers (`star/core/support` are *roster* tiers, not price support — `:157`), scoring, `agentContext` (`:181`), and `startingPrices` only.

**At evaluation time: a real set exists, resistance included.** `buildTechnicalSnapshot.js` surfaces `rsi` (`:48`), `nearestResistance` (`:88`), `vwap` (`:100`), `aboveSMA20` (`:74`); the composite `technicalScore` (`indexIntelligence.js:363`, `computeTechnicalScore` `:266`) is built from RS-vs-SPY + sector-RS + SMA + MACD + high-proximity + volume + RSI. The **support/resistance / ceiling-proximity** read is genuine: `analyticalPrimitives.findNearestLevels` (`:139`) computes `nearestResistance` (`:161`), stored on `stockRankings.levels` and rendered into the eval prompt's bench "Levels" line (`agentEvalPromptAssembly.js:1410-1414`).

**Premise contradiction (in your favor):** the item's guard ("so the Contrarian wording cannot claim a resistance read that does not exist") presumed resistance **might be absent**. It is **not** — a resistance-adjacent read is real code, so Contrarian "restore"/ceiling-proximity wording is **grounded**. **Two nuances to keep** (both VERIFIED): (a) the levels read is **conditionally populated** — `findNearestLevels` returns null on a side when no qualifying swing cluster (≥2 touches) sits strictly above/below price, so `nearestResistance` is *frequently null* and the whole Levels line drops when both sides are empty (`agentEvalPromptAssembly.js:1419`); the read is grounded **where it exists**, not guaranteed every symbol/eval. (b) It renders on **bench-candidate** lines (`ranking.levels`), so scope the wording to where the surface actually shows it. *(All VERIFIED; finding survived refutation.)*

---

### 7 — Receipt-source regex vs literal `guardrail_profitTarget` → **ABSENT (no regex) — data add**

There is **no receipt-source/exitReason regex** anywhere in the validation path. Provenance is validated by **closed-array membership**, not pattern matching: `learningValidators.js:19` (`if (!set.includes(value))`), `:58` (`inSet(receipt.exitReason, RECEIPT_EXIT_REASONS, …)`); `isValidExitReason` also uses `.includes` (`learningEnums.js:57-58`). Repo-wide grep found no runtime `RegExp` classifying source/exitReason.

Under that enum gate, **`guardrail_profitTarget` is EXCLUDED fail-closed today** — it is not a member of `RECEIPT_EXIT_REASONS` (`learningEnums.js:30-39`, which has only `guardrail_stopLoss`/`guardrail_trailingStop`), and the fail-closed contract (`:10-12`) rejects any non-member. It would also mislabel in the ledger: `DETERMINISTIC_LABELS` (`leagueSwapLedger.js:58`) lacks the key, so `swapReasonLabel` (`:87`) falls through to "agent decision." *(The item anticipated the no-regex case — no founder-revisit flag.)*

**The data add (two pure data edits, no logic change):**
1. Add `'guardrail_profitTarget'` to `RECEIPT_EXIT_REASONS` (`learningEnums.js:30-39`) so receipt validity stops failing it closed.
2. Add a `guardrail_profitTarget` key to `DETERMINISTIC_LABELS` (`leagueSwapLedger.js:58-66`, e.g. → `'profit target'`) so it renders as a deterministic protective exit.

The **source** side needs no change — it stays `'guardrail'`, already a member of `RECEIPT_SOURCES` and already stamped via the ternary at `agent-evaluate.js:2202`. Note also that `profitTarget` is currently a **soft** guardrail (note-only, no override — `agentGuardrails.js:375-398`), so no executor emits `guardrail_profitTarget` today; making it fire is itself part of the build, not a Phase-0 fact. *(All VERIFIED.)*

---

### 8 — `pickEmergencyReplacement` pool semantics → **MIXED ⚠️ FOUNDER-REVISIT**

Judged on its own four axes (`agentRiskManager.js:356-378`):

| Axis | Verdict | Evidence |
|---|---|---|
| **Bench parity** | **BUILT** | Draws from the flattened bench with the same cooldown + asset-type filters as the live path (`:360, :362, :364`). |
| **hotBench recency** | **ABSENT** | Never references hotBench; recency handled *only* by skipping future-dated `cooldownUntil` (`:362`). |
| **Held-symbol exclusion** | **ABSENT** | No held filter at all — signature has no `heldSymbols` param. |
| **Clean null** | **BUILT** | Returns clean `null` on empty bench (`:357`) and on no candidate (`:368`); never throws. |

**Premise contradiction (the load-bearing one):** the item treats `pickEmergencyReplacement` as "the target's replacement path," but **that function is DEAD — zero live callers.** Repo-wide it appears only at its definition (`:356`), a self-referential JSDoc (`:382`), and a **negative regression test** asserting the cron does *not* use it (`agent-evaluate.test.js:310`). The **live** emergency/forced-exit replacement path runs through **`pickSwapReplacementCandidate`** (`agent-evaluate.js:1441`, imported `:55`), which **does** exclude held symbols (`agentRiskManager.js:403`) and returns clean null handled safely by the caller (`agent-evaluate.js:1449`). The guardrail forced-exit path likewise uses `pickSwapReplacementCandidate` with `heldSymbols` (`agentGuardrails.js:449-454`).

The missing held-exclusion is exactly the defect its successor was written to fix — the June-11 **LRCX→LRCX self-swap / PANW triple-slot** bugs (comment `agent-evaluate.js:1408-1410`). **Recommendation for the spec:** model the profit-target ("target") replacement path on **`pickSwapReplacementCandidate`** (held-excluding, cooldown-aware, quality-predicate seam, clean-null veto), **not** on the retired `pickEmergencyReplacement` — otherwise the build reintroduces a documented, regression-locked bug class. Whether to instead revive/repair `pickEmergencyReplacement` is a founder call. *(All VERIFIED; finding survived refutation — caller grep re-confirmed exactly 3 hits, none live.)*

---

## Data-adds surfaced (for the build spec, not Phase-0 defects)

- **Item 5:** an explicit per-position **distance-to-threshold** number in the eval context (fresh compute; existing `detectRedZone`/band math is proximity-banded, not always-present).
- **Item 7:** add `guardrail_profitTarget` to `RECEIPT_EXIT_REASONS` (validity) **and** to `DETERMINISTIC_LABELS` (label); source side unchanged.

## For your revisit (premise-affecting)

- **Item 2** — guardrail stops (`guardrail_*`) are **suppressed in the gameplan pending-and-unexpired window**; risk-manager stops are not. If R4/profit-target is meant to fire unconditionally, the guardrail-tier placement contradicts that.
- **Item 6** — a resistance read **exists** (eval-time, conditionally populated): the "resistance-adjacent reads only where they exist" guard **passes**; Contrarian wording is grounded, scope it to the bench Levels surface.
- **Item 8** — `pickEmergencyReplacement` is **retired/held-blind**; the target's replacement path should be built on `pickSwapReplacementCandidate`.

---

## HARD STOP

The eight Phase-0 facts are verified and adversarially confirmed. No code was written; no fenced file was edited. **Awaiting your build spec.**
