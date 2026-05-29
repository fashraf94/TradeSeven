# Forge Enforcement Keystone — Discovery Audit Report

| | |
|---|---|
| **Status** | Complete — findings report (informs V1.3 spec drafting) |
| **Date** | 2026-05-29 |
| **Branch** | `claude/forge-enforcement-keystone-discovery` |
| **Author** | Claude Code — keystone discovery audit |
| **Responds to** | The prior enforcement wiring audit (second-opinion); `FORGE_ENFORCEMENT_FORK_DECISION_DOC.md` (Path 2 chosen) |
| **Feeds** | V1.3 "Forge Enforcement Keystone" spec (next session) |
| **Type** | Discovery / investigation — **read-only, no production code changed** |
| **Scope** | Path 2 only (platform-archetype deterministic teeth). Path 1 (user-authored Lever enforcement) deferred per fork decision. |

---

## Data-access constraint

**No live data was required for this audit.** Every claim is verifiable from code + tests with file:line anchors. The one "live-flavored" question — *does the cron that hosts the three knobs actually run?* — is answered statically from `vercel.json`:

- `agent-evaluate` → `*/15 13-21 * * 1-5` (every 15 min, regular session, Mon–Fri) — **runs** (`vercel.json:137-139`).
- `compute-index-intelligence` → `30 10,11 * * 1-5` (pre-market, dual DST slots) — **runs** (`vercel.json:133-135`).

The only data dependency surfaced by the audit is **calibration of the threshold/floor/cap *values*** (not their wiring), which is a V1.3-implementation concern flagged in §6 and §7, consistent with the calibration hand-offs in the bench-staleness and mb-04 reports.

---

## Executive summary

The three knobs are **individually cheaper to wire than the prior audit estimated** — the existing risk/swap machinery already provides the execution path, the persistence sites, and a timestamped trade ledger to build on. The binding constraint is **not lines of code; it is a small set of cross-cutting architectural decisions** that propagate across all three knobs. Get them wrong and the failure is silent (the HFT floor quietly does nothing); get them right and it is one decision made early.

| Item | One-line finding | Prior est. | Revised | Verdict |
|---|---|---|---|---|
| **Knob A — Forced rotation** | Execution path already exists; reusing the `SWAP_OUT` action makes downstream **free**. Real cost = stagnation *state* (2 persisted maps × 5 sites) + thresholds. | 50–150 | **~30–100** | Confirmed; floor lower |
| **Knob B — Hurdle floor** | A real hook exists (`validateTradeDecision`) but gates **Haiku swaps only**; a true floor needs **two-site** wiring + emergency bypass. | 30–80 | **~30–50** | Confirmed; lower half |
| **Knob C — Circuit breaker** | Rolling window **derives from existing timestamped `trades[]`** — no new field, no signature change. "Extend the cooldown model" is a loose analogy (structurally new). | 30–50 | **~20–35** | Confirmed; floor lower |
| **Archetype → physics hook** | **No archetype→physics link exists today** (`riskOverrides` *and* `defaultPreset` both dead; live `strategyPreset` is hardcoded-`balanced` + user-toggled). Path 2 must **create** the wire, not repair it. | 20–40 | **~30–70** | **Higher + decision-gated** |
| **Invariant 1 (cross-knob)** | **Emergency bypass must key on `reason`, not `action`** — because Knob A reuses the `SWAP_OUT` *action*. Action-keyed bypass silently exempts forced rotation from B **and** C. | — | non-negotiable | **New load-bearing finding** |
| **Total shared core** | Lines are not the constraint; **four decisions** are (Invariant 1, precedence/philosophy, config shape, meaningful-move definition). | 130–320 | **~110–255** | Confirmed; slightly high |

---

## Section 1 — Knob A: Forced Rotation (HFT floor)

### 1.1 Prior-audit claim verification
| Claim | Verdict | Evidence |
|---|---|---|
| `vwapTicks` counter at `agent-evaluate.js:624` | ✅ **Confirmed, line refined** | Per-symbol map: decl `:616`, condition `:625` (`vwapInfo.vwapDeviation < 0`), increment `:626`, reset `:628`, read into `evaluateRisk` `:641`. The cited `:624` is the block comment; the block spans `:616–629`. |
| `evaluateRisk` returns forced actions; documentable shape | ✅ **Confirmed** | `agentRiskManager.js:30` signature; return `{ action, reason, detail }` (`:32,44,54,66,77,85`). Priority-ordered, first-match-wins: `EMERGENCY_SWAP → SWAP_OUT → LOCK → TRAIL_STOP → HOLD`. |
| An existing VWAP-failure forced swap to mirror | ✅ **Confirmed** | `agentRiskManager.js:52-58` returns `SWAP_OUT`/`vwap_failure` when `cronMemory.ticksBelowVwap >= vwapTicks`. Threshold already preset-configurable (`vwapFailureTicks ?? 2`, `:36`). |

### 1.2 Keystone finding — the forced-swap *execution* path already exists
When `evaluateRisk` returns `EMERGENCY_SWAP`/`SWAP_OUT`/`TRAIL_STOP`, the cron already:
- pushes it to `riskSwaps` (`agent-evaluate.js:647-649`);
- executes it **with no Haiku call** — `pickEmergencyReplacement` (`agentRiskManager.js:111-133`) → `findPortfolioSlot` (`:143`) → `executeSwapServer` (`agent-evaluate.js:713`); narration + status-feed queued (`:719-742`).
- The risk layer runs **before the trigger gate and before Haiku** (`agentRiskManager.js:4`; `agent-evaluate.js:612`).

**Implication:** reusing an existing action label (e.g. `action:'SWAP_OUT', reason:'stagnation'`) makes the entire execution/narration path **free**. A *new* label (`FORCED_ROTATION`) costs **+1 line** at `:647` plus narration/status reason mapping. **"Qualifying candidate exists" is also free** — `pickEmergencyReplacement` returns `null` → `:662-664` warns and skips. The open question is whether "qualifying" should mean a **quality bar** beyond "exists/not-cooldown/type-matched/highest daily %change" (`agentRiskManager.js:115-132`) — that bar **is Knob B** (see §1.5, §2.2).

> **Reason-branching verification (does "stagnation" need a new enum anywhere?) — NO.** `agentSwapExecution.js` mentions `reason`/`trigger` only in a JSDoc comment (`:98`); `evaluationMetadata` is spread onto the trade record unvalidated (`:177`). `voiceLayerTradeNarration.js` has **no** `switch`/`case` on reason (only comments `:13,115`). Status feed interpolates it (`triggeredBy:\`risk_${reason}\``, `citedRules:[reason]`, `:737,736`). The reason strings appear elsewhere **only in prompt files** (`agentEvalPromptAssembly.js`, `agentEvalToolSchema.js`). So `'stagnation'` flows through as a free string; the only optional cost is Voice Layer prompt guidance for clean narration tone (~5–15 prompt lines, non-functional).

### 1.3 "Meaningful move" definition space — **a product decision, not a line-count choice** (see §6.7)
Data in scope at the counter site (`:618-642`) with zero new plumbing: `currentPrice` (`:620`), `entryPrice` (`:621`), `score.baseATR` (→ `atrMultiplier`), `vwapInfo.{vwap,vwapDeviation,sma20_5m}` (`:622`), `prices[sym].changePercent`, `score.totalPoints`/`score.history`.

| # | "Meaningful move" = | New state | Incr. lines\* | Archetype behavior it encodes |
|---|---|---|---|---|
| D1 | Any tick-to-tick price change | `lastTickPrice` map | ~30–40 | ~Never stagnant intraday → near-useless |
| **D2** | **Threshold-cross vs last tick** (`\|Δ\|/lastTick < k·ATR`) | `lastTickPrice` map | **~30–45** | "Flatlined price" HFT — *recommended minimal* |
| D3 | P&L stall (`Δ atrMultiplier < k` since last tick) | `lastAtrMultiplier` map | ~35–50 | "Dead-money P&L" HFT |
| D4 | Bonus-tier stagnation (ticks since tier cross) | reuse `score.history` | ~40–60 | "Not progressing toward badges" HFT |

\*counter map + the new state map + `evaluateRisk` branch + threshold wiring; excludes archetype tables (§4) and reuses `SWAP_OUT` execution.

**Critical nuance:** every *stagnation* definition (D2–D4) needs a **second** persisted field (last-price / last-ATR / tier-state) **in addition** to the counter — i.e. **two maps × 5 persistence sites**, not the single counter the "mirror vwapTicks" framing implies. D1 (one field) is the only single-map option and it is the useless one.

### 1.4 Line-count verdict: prior 50–150 is **defensible; floor slightly high**
- Minimal viable (D2 + reuse `SWAP_OUT` + reuse `pickEmergencyReplacement` + single preset threshold): **~30–45** (below the 50 floor).
- Mainstream (D2/D3 + new label + narration mapping + per-archetype thresholds): **~60–100**.
- Ceiling (D4 + new label + per-archetype tables + candidate quality bar): **~120–150**.
- **Revised ~30–100** for realistic builds. Not off by >50% — confirmed, with a lower floor because reusing the existing execution path is cheaper than "mirror the counter" implies.

### 1.5 Coupling / risk flags
- **A-quality → needs B:** Knob A *ships* on `pickEmergencyReplacement` (picks highest daily %change), but that is not a *quality* bar. If forced rotation should only fire into a genuinely better slot, that bar **is Knob B's hurdle floor** (the prior audit itself: Knob B "sits in the forced-rotation candidate check"). Decoupled for mechanism, **coupled for correctness**. Dependency direction: **A-quality → B**.
- **Forced rotation bypasses Haiku + the trigger gate** (risk layer is pre-gate). Any hurdle-floor gating of forced rotation must live in the **risk-swap execution loop** (`:658-717`), not the post-Haiku path (confirmed §2.2).
- **5-site persistence fragility:** new counter + new state map must be written at all 5 mutually-exclusive return paths (`:760,775,800,872,1329`); miss one → counter silently zeroes on that path (paths characterized in §3 of this section's companion, below).

### 1.6 The 5 persistence return paths (characterized — informs "where to add counter writes")
All five build a `scoreUpdate` dict and call `battleRef.update()` — **none skip persistence**, so a new counter is **pure piggyback** (+1 line each, or one shared helper):

| Site | Semantics |
|---|---|
| `:760` | Proposal pending/not-expired → skip trigger gate + Haiku |
| `:775` | Gameplan meeting pending → skip Haiku |
| `:800` | New gameplan meeting triggered (gameplan *is* the evaluation) |
| `:872` | **No triggers fired → HOLD** (`if (!shouldEvaluate)`, `:867`) — the common path |
| `:1329` | Main Haiku-completion write |

---

## Section 2 — Knob B: Hurdle Floor (mb-04 with teeth)

### 2.1 Prior-audit claim verification
| Claim | Verdict | Evidence |
|---|---|---|
| Gate between SWAP intent and execution vs a floor | ✅ **Confirmed; hook exists** | Haiku path already validates via `validateTradeDecision` (`agentSwapExecution.js:21-74`) → `{valid,errors,resolvedTier,resolvedSlotIndex}`; `!valid` ⇒ downgrade to HOLD (`agent-evaluate.js:1031-1036`). |
| Knob B = deterministic version of V1.2's mb-04 / trigger-gate cleanup | ✅ **Confirmed; different seam, shared concept** | V1.2 cleans the *pre-Haiku wake trigger* `bench_outperformance` (`agentTriggerGate.js:90-113`, hardcoded `baseATR\|\|2.5` `:103`). Knob B is a *post-intent execution gate*. |
| Sits in forced-rotation candidate check **and** post-Haiku path | ✅ **Confirmed; two distinct sites** | Post-Haiku = `validateTradeDecision`/pre-`:1084`. Forced-rotation = risk loop after `pickEmergencyReplacement` (`:660`), before `:713`. |

### 2.2 Knob A × B interaction — resolved
`validateTradeDecision` gates **only Haiku swaps** (`:1031,:1259`). The risk-swap loop bypasses it. So the floor must be applied **selectively by intent source**:

| Intent source | Site | Apply floor? | Why |
|---|---|---|---|
| Haiku-proposed SWAP | `validateTradeDecision` / pre-`:1084` | **Yes** | Discretionary |
| Knob A forced rotation (`reason:'stagnation'`) | risk loop pre-`:713` | **Yes** | This *is* the quality bar from §1.5 |
| `EMERGENCY_SWAP` / `SWAP_OUT` / `TRAIL_STOP` | risk loop pre-`:713` | **No (bypass)** | Protective exits — leave regardless of replacement |

**Confirmed:** Knob A enforces a quality bar **only if Knob B is also wired into the risk-swap loop**, guarded to `reason==='stagnation'`. A single chokepoint inside `executeSwapServer` would **wrongly gate emergencies** (see §6.5 for the future-proof variant).

### 2.3 Design fork (both ~equal cost)
- **B1 — extend `validateTradeDecision` (rule #5):** single Haiku chokepoint; **but** breaks its current purity — it is `(decision, battle)` with no live prices; the floor needs `prices`+`momentum`+`floor` passed in. Still doesn't cover forced rotation.
- **B2 — standalone `clearsHurdleFloor()` helper** called at pre-`:1084` (Haiku) + risk loop (forced rotation): no signature change (`prices`/`momentumData` already in scope at `:660`, `:1073-1087`), explicit per-site control. **Recommended shape.**

### 2.4 "Intraday margin" data sub-decision
Existing trigger computes a **daily** margin (`dailyChangePct / benchATR`, `agentTriggerGate.js:102-104`), not intraday. Knob B's "intraday margin" is a small fork: **(a) reuse the daily formula** (cheaper, consistent with the V1.2-cleaned trigger) vs **(b) genuine intraday via VWAP** (richer, new computation). Feeds the §5 convergence.

### 2.5 V1.2 collision check
- **Line-overlap: LOW** — V1.2's trigger edits live in `agentTriggerGate.js:90-113`; Knob B lives in `agentSwapExecution.js`/`agent-evaluate.js:1084` + risk loop. No shared lines.
- **Semantic-consistency: HIGH coupling** — if V1.2 fixes the trigger's bench-margin formula, Knob B's floor must use the **same** formula or Haiku is woken by formula X then blocked by formula Y. Argues for a **shared margin helper** and V1.2-with/before-B sequencing (§5).

### 2.6 Line-count verdict: prior 30–80 **confirmed (lower half)**
Helper (~15–25) + 2 call-site insertions with intent guards (~8–12) + floor config (§4) = **~30–50** (B2). Hits the upper half only if intraday margin is fresh (2.4b) + B1's validator refactor is taken.

### 2.7 Risk flags
Validator purity (B1 breaks it; B2 avoids); **two-site enforcement is mandatory** for a true floor; **emergency bypass must be explicit** (shared with Knob C — §3.4, §6.3); a future intent source added elsewhere would be ungated (§6.5).

---

## Section 3 — Knob C: Circuit Breaker (conservative ceiling + safety)

### 3.1 Prior-audit claim verification
| Claim | Verdict | Evidence |
|---|---|---|
| Cooldown *block* at `agentSwapExecution.js:43-49` | ✅ **Confirmed** | Rule #3 in `validateTradeDecision` — rejects swap if bench `cooldownUntil > now`. Per-asset, Haiku-path only. |
| Cooldown *write* at `:213-221` | ✅ **Confirmed** | "Revolving door bench (Amendment 6)" — outgoing asset → bench with `cooldownUntil: now+24h` (`:220`) inside `executeSwapServer`. |
| Rolling-window counter "extends that pattern" | ⚠️ **Pattern-analogy only — structurally different** | Per-asset cooldown timestamp vs a **battle-level frequency cap**. Shared read-block/write *shape*, different data + scope. Not a literal extension — but cheaper than greenfield (see §3.3). |
| Emergencies bypass; "what counts as emergency?" | ✅ **Answered + canonicalized** | §3.4. |

### 3.2 No existing cap state
`grep circuit\|rolling\|swapCount\|maxSwaps\|perWindow\|rateLimit` across `api/_utils/` + `api/cron/` returns **zero** swap-frequency state (only an unrelated HTTP `rateLimit` middleware). Knob C is **new state**.

### 3.3 Cheap-implementation finding — derive the window from `trades[]`
`executeSwapServer` already writes per swap: `closedTrade.swappedOutAt` (ISO, `:172`, from `:118`), the full `...evaluationMetadata` spread (`:177` → carries `trigger`/`exitReason`/`reason`), into `battle.trades[]` (`:242`, capped 50) + `scoreState.tradeCount++` (`:251`). Therefore:
- **Count = derive, don't store:** `trades.filter(t => Date.parse(t.swappedOutAt) > now - windowMs).length` — **no new battle-doc field.**
- **Block needs no signature change:** `validateTradeDecision(decision, battle)` already has `battle.trades` (contrast Knob B, which needed `prices`).
- **Reason-filterable:** each record carries its origin reason, so the window can include/exclude emergencies precisely (§3.4–§3.5).
- **Minor risk:** `trades[]` caps at 50; an absurdly high cap could undercount a long window — self-limiting, since the breaker exists to keep counts low. Note, not blocker.

### 3.4 Canonical "emergency bypass" — **reason-keyed, not action-keyed** (→ Invariant 1, §6.3)
`evaluateRisk` reasons (`agentRiskManager.js`): `bust_avoidance` (`:46`), `vwap_failure` (`:55`), `stepped_trail` (`:79`), `threshold_proximity` (`:68`, LOCK — not a swap), HOLD. The risk-swap *execution* set is **action**-keyed today: `{EMERGENCY_SWAP,SWAP_OUT,TRAIL_STOP}` (`agent-evaluate.js:647`).

> **CANONICAL DEFINITION (shared by Knob B and Knob C):** a swap is **emergency-bypass** iff `reason ∈ {bust_avoidance, vwap_failure, stepped_trail}` (protective `evaluateRisk` origins). All other swaps (`reason ∈ {stagnation, haiku_decision, gameplan_*, …future}`) are **gated** by the hurdle floor (B) and the circuit breaker (C).

> ⚠️ **Silent-contradiction trap:** §1.2 recommends Knob A reuse the `SWAP_OUT` *action*. If bypass is keyed on **action** (the `:647` set), a forced rotation (`action:SWAP_OUT, reason:stagnation`) is mis-classified as emergency and **silently bypasses B and C** — defeating the HFT floor's entire purpose. Today the action-set maps 1:1 to the three protective reasons, so the two definitions are indistinguishable **until Knob A ships**. Keying on **`reason`** resolves it.

### 3.5 One open decision inside the definition
- **Bypass-set breadth:** `{bust_avoidance}` only (vwap/trail count toward cap) vs all three protective reasons (current `:647` grouping). `TRAIL_STOP` is a gain-lock — arguably should count toward an HFT cap.
- **Do emergencies consume window budget?** (a) count-but-bypass-own-block (conservative) vs (b) excluded entirely (clean). The reason-filter (§3.3) makes either trivial.

### 3.6 Where Knob C lives (count vs block split)
Count derives from `trades[]` (no write; `executeSwapServer` is the natural *counting* chokepoint — §6.5). Block is selective: Haiku path → new rule in `validateTradeDecision` (after conviction floor `:61-64`); forced-rotation path → guard in the risk loop (`reason==='stagnation'`). Emergency/vwap/trail risk-swaps never call `validateTradeDecision` → **bypass for free**.

### 3.7 Line-count verdict: prior 30–50 **confirmed; floor ~20**
Window helper (~8–12) + Haiku block (~6–8) + forced-rotation block (~4–6) + cap config (§4) = **~20–35**. Floor below the prior estimate because `trades[]` already carries timestamps + reasons.

---

## Section 4 — Archetype → Physics Hook (most consequential phase)

### 4.1 Prior-audit factual claims — all four CONFIRMED
| Claim | Verdict | Evidence |
|---|---|---|
| `riskOverrides.bustBuffer` per archetype | ✅ | `agentArchetypeConfig.js:16,39,60,79,100,121`. |
| It's **dead** (never read) | ✅ | `grep riskOverrides api/` → 6 *definitions*, **zero reads**. |
| **Wrong-signed** (positive; expects negative) | ✅ | Values `0.75/0.85/0.90`; `evaluateRisk` uses `bustBuffer ?? -0.85` as `atrMultiplier <= bustBuffer` (`agentRiskManager.js:35,43`). A positive `0.90` would emergency-swap any position below **+0.90x ATR** — i.e. winners. |
| `evaluateRisk` reads preset only; archetype config never imported into risk manager | ✅ | `grep` → archetype config **absent** from `agentRiskManager.js`; `bustBuffer` read only at `:35` via `presetConfig.risk` (`agent-evaluate.js:642`); archetype config imported **only** in `api/agent/create-profile.js`. |

### 4.2 Inventory — the "stale sign-flipped duplicate" pattern
| Archetype | `riskOverrides.bustBuffer` | `vwapFailureTicks` | `trailStop*` | `defaultPreset` | Preset `risk.bustBuffer` |
|---|---|---|---|---|---|
| momentum_chaser | **+0.90** | 2 | `Level:'sma20'` | aggressive | **−0.90** |
| degen | **+0.90** | 3 | `Level:'sma9'` | aggressive | **−0.90** |
| analyst | **+0.85** | 2 | `Level:'sma20'` | balanced | **−0.85** |
| diversifier | **+0.85** | 2 | `Level:'sma20'` | balanced | **−0.85** |
| contrarian | **+0.85** | 2 | `Level:'sma20'` | balanced | **−0.85** |
| guardian | **+0.75** | 1 | `Level:'sma20'` | defensive | **−0.75** |

Three corruption modes: **(i) sign** (positive vs negative); **(ii) schema** — archetype `trailStopLevel:'sma20'` (string) vs preset `trailStopATR:1.5` (number, the one `evaluateRisk` reads, `:37`); **(iii) drift** — `momentum_chaser.vwapFailureTicks:2` vs its preset's `:3`. Magnitudes are an exact sign-flipped copy of each archetype's `defaultPreset` block ⇒ a hand-copied duplicate that lost the sign convention and went stale.

### 4.3 Structural finding — **no archetype→physics link exists today**
Every candidate path from archetype to physics is dead or absent:

| Candidate link | Status | Evidence |
|---|---|---|
| `archetype.riskOverrides` → `evaluateRisk` | **Dead** (sign/schema/stale) | `grep riskOverrides` |
| `archetype.defaultPreset` → `strategyPreset` | **Dead** (declared, never read) | `grep defaultPreset api/ src/` → 6 defs, 0 reads |
| `battle.strategyPreset` (live driver) | **Not archetype-derived** | hardcoded `'balanced'` at creation (`agentBattleService.js:154`); user-toggled (`agentService.js:438`); migration default `'balanced'` (`agent-evaluate.js:210`) |

**This root-causes the launch symptom.** A `degen` HFT agent and a `guardian` agent get **identical physics** today — both run `'balanced'` unless the *user* manually toggles, because nothing routes archetype identity into `strategyPreset` or `evaluateRisk`. Path 2 must **create** the wire.

### 4.4 Precedence decision space — multi-dimensional (not "override vs compose")
**Dimension 1 — which config wins for EXISTING levers:**
- **P-A · Archetype-selects-preset:** archetype seeds `strategyPreset` at creation, delete dead `riskOverrides`; `evaluateRisk` unchanged. ~10–20 lines; respects toggle; **but collapses 6 archetypes → 3 physics profiles**.
- **P-B · Archetype overrides preset:** fix signs+schema on 6 `riskOverrides`, import into `evaluateRisk`, thread archetype through the call site. ~20–40; 6 distinct profiles; **but creates a second physics source conflicting with the user toggle**.
- **P-C · Compose (preset base + archetype delta):** most expressive; ~40–70; needs composition math; likely launch-overkill.

**Dimension 2 — archetype-fixed vs user-toggled for the NEW knobs:** for deterministic teeth, the forced-rotation floor / hurdle / cap likely must be **archetype-keyed and not neutralizable by the preset toggle** — else a user toggling a `degen` to `'defensive'` disables forced rotation and re-collapses the spectrum. Can be answered **differently** from Dimension 1. **This is a product decision about how much the archetype constrains the user.** Full scenario walk-through in §6.6.

### 4.5 Config shape — per-mechanism scalar today; global-vs-per-reason is open
Both `riskOverrides` and `preset.risk` are **per-mechanism scalars** `{bustBuffer, vwapFailureTicks, trailStop*}`, mapping 1:1 to the three protective reasons (implicitly per-protective-reason). **No `hurdleFloor` / `swapCap` / forced-rotation field exists** anywhere. Design space for the new knobs: **global-per-archetype scalar** (matches the existing pattern) vs **per-reason table** (`hurdleFloor:{haiku_decision, stagnation}` — no precedent, but expressively meaningful: forced rotation may warrant a *higher* hurdle than a Haiku-conviction swap). **If config goes per-reason, every precedence choice resolves per-reason** — pick the shape before the precedence model.

### 4.6 Line-count verdict: prior 20–40 **defensible for the wiring only; undercounts the whole — architectural risk**
P-A hook ~10–20; P-B hook ~20–40 (matches prior, *wiring only*); **plus** new-knob config across 3 presets (~9–15) or 6 archetypes (~18–30) — *not in the prior estimate*; **plus** possible Dimension-2 enforcement. **Whole archetype→physics work ≈ ~30–70 lines and is decision-gated** (swings 2–3× on precedence/shape). Per the honest-reporting bar: **architectural risk, not implementation detail.**

### 4.7 Orthogonal finding (→ §7)
`src/data/forgeKnowledgeBase.js:1532-1546` already defines a **user-facing** "stagnation → tier demotion" Forge rule with a configurable threshold (`pct` default **0.1%**, matching §1.3's D2), plus `traitLibrary.js:389` / `TraitCard.jsx:93`. This is the **Path 1** counterpart of Knob A — present as knowledge-base content, **not wired to physics** (consistent with Path 1 deferral). Path 1's 0.1% default should inform Path 2's archetype calibration.

---

## Section 5 — V1.2 Interaction Analysis

### 5.0 Triangulation basis + confidence rubric
V1.2's spec is **not on disk** (project knowledge). Reconstructed from the two **committed** reports it was drafted from — `MB04_BASELINE_NORMALIZATION_VERIFICATION_REPORT.md` and `BENCH_STALENESS_VERIFICATION_REPORT.md` (exact anchors) — plus the embedded file list + code. **High** = committed report has the anchor; **Medium** = file-list/scope implies it; **Low** = embedded description only.

> **Caveat on which V1.2 option shipped:** the MB04 report's **Option 2 (restrict to same-day modes) touches *no* mb-04 code**. The task states V1.2 touches `agentTriggerGate.js` ⇒ V1.2 adopted **Option 1 (normalize) or 3 (combined)**. *That the trigger-gate block is in scope: **HIGH**; which exact option: **MEDIUM**.*

### 5.1 V1.2 surface map (reconstructed)
| V1.2 workstream | Files + lines | Conf. |
|---|---|---|
| **(a) mb-04 baseline normalize** | `agentTriggerGate.js:92` (weak-active), `:106` (hardcoded `0.5`→user-ATR), block `:90-113`; active CSV `agentEvalPromptAssembly.js:899-916`; active baseline `agent-evaluate.js:293` | HIGH |
| **(b) bench staleness rescore** | `compute-index-intelligence.js:850-856` (writer); `agent-evaluate.js:392-394/442-446` (ranking read); `:393` (held-position intraday fetch to extend) | HIGH |

### 5.2 Knob B surface map (code-verified, Phase 2)
`validateTradeDecision` (`agentSwapExecution.js:21-74`) **or** standalone `clearsHurdleFloor()` at `agent-evaluate.js:1084` + risk loop `:658-717`; + a bench-vs-active margin computation. **HIGH.**

### 5.3 Overlap map — three coupling dimensions
**Dimension 1 — line-overlap (merge risk):** LOW everywhere. `agent-evaluate.js` edits are in **disjoint regions** (V1.2 `:293`/`:392-446` scoring/ranking; Knob B `:658-717`/`:1084` execution). `agentEvalPromptAssembly.js` and `compute-index-intelligence.js`: **NONE** for Knob B. **HIGH.**

**Dimension 2 — semantic-consistency (the real coupling): HIGH.** `agentTriggerGate.js:90-113` is the convergence point: post-V1.2 it computes a **normalized, user-ATR-respecting bench-vs-active margin**; Knob B's floor needs **exactly this**. Diverge → woken by formula X, blocked by formula Y (silent contradiction). **Resolution: extract the margin into a shared pure helper both call** — also honors the MB04 report's "don't pass over `:90-113` twice" (§6.1). Both endpoints anchored; reuse near-forced.

**Dimension 3 — user-facing reason taxonomy (forward-compat): MEDIUM.** Path 1's stagnation rule (`forgeKnowledgeBase.js:1532-1546`) and Knob A's forced rotation will **both** emit `reason:'stagnation'`; the receipt/Voice Layer must distinguish them. **Existing discriminator: the `source` field** (`source:'risk_manager'` `agent-evaluate.js:738`; `'gameplan_meeting'` `:793`). **Recommendation:** V1.3 emits `reason:'stagnation'` **+ distinct `source` (e.g. `'archetype'`)** so the future Path 1 rule (`source:'user_rule'`) slots in without a receipt migration. (Path 1 rule anchored HIGH; its eventual reason-string is deferred-work inference MEDIUM; the `source` mitigation anchored HIGH.)

### 5.4 V1.2 is **two separable workstreams** (with a calibration caveat)
Only **workstream (a)** (mb-04 / trigger-gate margin) couples to Knob B at the code level (Dimension 2). **Workstream (b)** (bench-staleness rescore) is **code-disjoint** from all three knobs.

> **Calibration coupling caveat (Phase 5 Note 2):** (b) is code-disjoint but **calibration-coupled** to Knob B — the hurdle-floor *stringency values* depend on bench-data recency. If Knob B ships before bench-staleness lands, floor-value calibration may need **re-running** once rescore changes how fresh bench candidates look. Not a sequencing blocker; a forward-compatibility note for the calibration-anchor reckoning (§6.8, §7).

### 5.5 Sequencing options + recommendation
| Option | Verdict |
|---|---|
| **S1 — V1.2-first + mandated shared-helper extraction** (V1.2 reworks `:90-113` and extracts `computeBenchVsActiveMargin(active, bench, userATR)`; Knob B consumes it) | ✅ **Recommended** — isolates the one real coupling to a single function handoff; keeps disjoint bench-staleness out of Knob B's path; avoids two passes over `:90-113`. |
| **S2 — Knob B first** (computes margin against the un-normalized hardcoded-`0.5` formula; V1.2 retrofits later) | ❌ **Reject** — builds the floor on the defect the MB04 report flags (24–35% multi-day decision flips); forces rework. |
| **S3 — Combined single spec** (mb-04 + bench-staleness + Knob B) | ⚠️ **Partial** — combining the *trigger-gate-margin* portion with Knob B is clean; folding in disjoint bench-staleness bloats the spec. Prefer S1's narrow handoff. |

**See §6.8 — S1 imposes a new requirement on V1.2 that V1.2 as drafted does not contain.**

---

## Section 6 — Total Scope Synthesis + V1.3 Spec Structure Recommendation

### 6.1 Total scope — prior 130–320 **confirmed, slightly high; but lines are not the constraint**
| Knob | Prior | Revised | Driver of the revision |
|---|---|---|---|
| A — Forced rotation | 50–150 | **30–100** | Reuse `SWAP_OUT` exec path (free); but 2 persisted maps × 5 sites |
| B — Hurdle floor | 30–80 | **30–50** | Shared helper, reuse margin |
| C — Circuit breaker | 30–50 | **20–35** | Derive window from `trades[]` (no field/signature) |
| Archetype hook | 20–40 | **30–70** | **Link must be created**; + new-knob config; decision-gated |
| **Total** | **130–320** | **~110–255** | LOW below prior (reuse patterns); HIGH below prior (no knob explodes) |

Within ±50% of the prior estimate — **confirmed**. **The meta-finding: the binding constraint is four cross-cutting decisions, not lines.** Each propagates across multiple knobs; the cost of getting one wrong is a *silent* failure (the floor quietly no-ops), the cost of getting it right is one decision made before implementation:
1. **Invariant 1 — reason-keyed bypass** (§6.3).
2. **Archetype precedence + philosophy** (§6.6).
3. **Config shape — global vs per-reason** (§4.5).
4. **"Meaningful move" definition — D2/D3/D4** (§6.7).

### 6.2 Cross-knob dependency map (hidden coupling)
```
        ┌───────────────────────────────────────────────┐
        │  Archetype → physics hook  (§4 — DOES NOT EXIST │
        │  today; must be CREATED. Supplies all config.)  │
        └───────────────┬───────────────────────────────┘
                        │ config (thresholds, floor, cap) for all three
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   Knob A           Knob B           Knob C
 (forced rot.)   (hurdle floor)  (circuit breaker)
        │   A-quality      │  shares emergency-bypass + the two
        └───── needs ──────►  gate sites (validateTradeDecision + risk loop)
                            │
              ┌─────────────┴─────────────┐
              │ INVARIANT 1: bypass keyed │
              │ on REASON, not action     │
              └───────────────────────────┘
```
- **A-quality → B:** forced-rotation quality bar = the hurdle floor (§1.5, §2.2).
- **B & C share** the emergency-bypass primitive **and** both block at the **same two gate sites** (`validateTradeDecision` + risk loop). Spec them together so bypass is defined once.
- **All three depend on the hook** for config — and the hook does not exist yet, so it is the **prerequisite** (§6.9).
- **Invariant 1 ties A↔B↔C:** A reuses the `SWAP_OUT` action, so bypass must key on reason or A silently bypasses B and C.

### 6.3 Invariant 1 — reason-keyed emergency bypass (NON-NEGOTIABLE Path 2 requirement)
> **Invariant 1.** Emergency bypass is determined by **`reason ∈ {bust_avoidance, vwap_failure, stepped_trail}`**, never by the swap's **`action`** label. Every gate (hurdle floor, circuit breaker, and any future enforcement) consults `reason`.

**Why it cannot be negotiated mid-implementation:** Knob A's cheapest, recommended build reuses the `SWAP_OUT` *action* for free downstream execution (§1.2). Today `{EMERGENCY_SWAP,SWAP_OUT,TRAIL_STOP}` (action set, `agent-evaluate.js:647`) maps 1:1 to the three protective reasons, so action-keyed and reason-keyed bypass are **indistinguishable until Knob A ships** — at which point action-keyed bypass silently exempts forced rotation from **both** B and C, and the HFT floor does nothing. The bug is invisible in code review (the labels look right) and only manifests behaviorally. **Cost of getting it wrong: a silent bug class. Cost of getting it right: one definition, locked in V1.3 before A/B/C are written.**

### 6.4 Cross-knob primitives V1.3 should define **once**
1. **Emergency-bypass predicate** (reason-keyed, Invariant 1) — used by B and C.
2. **The two gate sites** — `validateTradeDecision` (Haiku path) + the risk-swap loop (forced rotation), with emergency reasons bypassing both.
3. **Shared bench-vs-active margin helper** — `computeBenchVsActiveMargin(...)`, shared with V1.2's trigger (§5, §6.8).
4. **The `reason`/`source` taxonomy** — including the Path 1 forward-compat split (§5.3 D3).

### 6.5 Future-intent-source coverage — counting chokepoint exists; gating chokepoint does not (Phase 2 Note 2)
- **Counting chokepoint EXISTS:** `executeSwapServer` (`agentSwapExecution.js:102`) — **every** swap flows through it (risk `:713`, Haiku `:1084`, gameplan `:1680`, proposal `:1516/:1601`). Knob C's count derives from the `trades[]` it writes, so counting is universal **by construction**.
- **Gating chokepoint does NOT exist:** blocking is **distributed** — `validateTradeDecision` (Haiku only), the risk loop (risk swaps only), and **nothing** for gameplan/proposal swaps. Emergencies deliberately skip `validateTradeDecision`. **A new swap intent added at a new call site would NOT be auto-gated** — today, gating a new intent depends on the implementer *remembering* to.
- **Recommendation (forward-compat, not required for the 3 knobs):** make `executeSwapServer` require an explicit **enforcement descriptor** argument — e.g. `enforcement = { reason, bypassFloor, bypassCap }` (derivable from `evaluationMetadata.reason`). A pre-execution guard helper applies floor + cap **by default** unless the caller declares bypass. This converts bypass from **accidental** ("forgot to gate") to **explicit** ("must declare `bypass:true`"), and a new intent source cannot be added without stating its enforcement posture. *Note:* keep the margin/cap logic in a **pre-execution guard**, not inside the Firestore transaction (`executeSwapServer` runs `db.runTransaction`, `:105`) — a blocked swap should cleanly downgrade to HOLD at the call site, not throw mid-transaction. **Tradeoff for V1.3:** gate-at-known-sites (cheaper now, fragile to new intents) vs descriptor-enforced chokepoint (more upfront, future-proof). If V1.3 chooses the former, **the future-intent-source risk must be documented explicitly** so the next intent author knows to gate.

### 6.6 Archetype precedence — a **product-philosophy** decision (Phase 4 Notes 1 & 2)
The locked principle is **"archetypes are first-class authors, not personality skins."** Measured against it:
- **P-A** (archetype seeds preset, then user fully controls) makes the archetype **ranking-weights + prompt-language only**, with **preset-determined physics** — it **undermines** the first-class-author principle (and collapses 6 archetypes → 3 physics profiles).
- **P-B** (archetype overrides preset) preserves archetype-as-physics-author but **removes user agency** over the preset toggle.
- **Third option** (archetype-fixed identity at creation + preset toggle adjusts the *base* levers **within** archetype-locked HFT physics) preserves **both**.

**Four-scenario walk-through (under the third option):**
| Scenario | Base levers (bustBuffer/vwap/trail) | New HFT knobs (forced rot. / hurdle / cap) |
|---|---|---|
| degen, no toggle | aggressive defaults | degen forced rotation **ON** (tight), high cap |
| **degen, defensive toggle** | defensive (user respected) | degen forced rotation **STILL ON** → *"defensive base + degen forced rotation"* |
| **guardian, aggressive toggle** | aggressive (user respected) | guardian forced rotation **OFF/loose** → *"aggressive base + guardian no-forced-rotation"* |
| guardian, no toggle | defensive defaults | guardian forced rotation **OFF**, low cap |

The two **cross** scenarios are the crux. **P-A** erases archetype-ness on toggle (degen+defensive = pure defensive → spectrum collapses). **P-B** ignores the toggle (no user agency). **Third option** keeps the archetype's HFT teeth non-negotiable while letting the user tune the base — the only model satisfying *both* the locked principle and user agency. **V1.3 should pick deliberately on philosophy, not on the ~10–60-line cost delta.** Recommended for V1.3's consideration: the **third option**, with the new HFT knobs archetype-locked and the existing base levers preset/user-toggleable.

### 6.7 "Meaningful move" — a product decision about what stagnation *means* (Phase 1 Note 3)
D2 (price flatlines), D3 (P&L stall), D4 (no bonus-tier progress) each define a **different HFT archetype behavior** (§1.3), not merely a different line count. V1.3 should choose based on **archetype intent** — e.g. a `degen` momentum-chaser arguably wants **D2** (rotate off any price that stops moving), while a tier-optimizing archetype wants **D4**. The choice may even be **per-archetype** (which interacts with the §4.5 config-shape decision). **Do not let the implementer pick by line-count minimization.** Path 1's existing 0.1% threshold (§4.7) is a calibration anchor for the D2 variant.

### 6.8 V1.2 coordination constraint + calibration coupling (Phase 5 Notes 1 & 2)
> **V1.3-affecting coordination constraint (explicit):** S1 assumes V1.2 **extracts** the normalized bench-vs-active margin into a shared pure helper. **V1.2 as drafted commits to fixing the trigger gate *inline*, not to extraction.** If V1.2 ships with the margin inlined, Knob B's implementer must either (a) **edit V1.2's recently-merged code** to extract it (regression risk on freshly-shipped launch-blocker work) or (b) **duplicate** the formula (re-introducing the very divergence S1 exists to prevent). **Therefore V1.3 must do one of:** (1) **extend the V1.2 spec** to include the helper extraction as part of the trigger-gate rework, **or** (2) make **"extract `computeBenchVsActiveMargin` from `agentTriggerGate.js:90-113`" the explicit first implementation step of Knob B** in V1.3. This must be named in the V1.3 spec — otherwise it is exactly the "Phase 5 said X about V1.2 but V1.2 doesn't say X" silent contradiction.

> **Calibration coupling:** bench-staleness rescore (V1.2 workstream b) is code-disjoint from Knob B but **calibration-coupled** — the hurdle-floor stringency depends on how fresh bench candidates appear. If Knob B's floor values are calibrated against *stale* bench data and rescore later lands, the floor may be **mis-tuned** and need re-calibration. V1.3 should record the **calibration anchor** (which bench-freshness regime the floor values assume) so the dependency is trackable, not silent.

### 6.9 V1.3 spec structure recommendation — **one combined spec for {hook + A + B + C}; V1.2 as a documented prerequisite**
**Recommendation: a single combined V1.3 spec** covering the archetype→physics hook and all three knobs — **not** split into per-knob specs, and **not** merged with V1.2.

Rationale:
- The three knobs **share primitives** (emergency-bypass predicate, the two gate sites, the config hook) and a **single invariant** (reason-keyed bypass). Splitting them across specs is how the silent contradictions (Invariant 1; margin divergence) get introduced — each spec would re-derive the shared pieces slightly differently.
- All three **depend on the hook**, which does not exist yet — so the hook is a **prerequisite section**, not a peer knob.
- V1.2 coupling is **isolated** to one helper handoff (§6.8) — best handled as a **documented prerequisite/contract**, not by merging the disjoint bench-staleness work into V1.3.

**Decision-first ordering inside the combined spec:**
1. **Lock the four cross-cutting decisions first** (Invariant 1; archetype precedence/philosophy + the third option; config shape; meaningful-move D2/D3/D4) — each propagates across knobs, so they cannot be deferred to per-knob sections.
2. **§0 — Archetype→physics hook** (create the missing wire; fix/retire `riskOverrides`; resolve precedence). Prerequisite for everything below.
3. **§A/§B/§C — the three knobs**, each consuming the hook's config and the shared primitives.
4. **Prerequisite callout — V1.2 S1 contract** (helper extraction; calibration anchor).

This structure makes every cross-knob decision a **single locked statement** the implementer cannot silently diverge from — which is the whole point of catching these in discovery rather than in code review.

---

## Section 7 — Open Questions / Hand-offs / Orthogonal Findings

### 7.1 Orthogonal findings (discovered; **not** acted on — read-only audit)
| # | Finding | Anchor | Note for V1.3 / backlog |
|---|---|---|---|
| O1 | **Path 1 stagnation rule already exists** as user-facing content (0.1% default threshold), unwired to physics | `forgeKnowledgeBase.js:1532-1546`; `traitLibrary.js:389`; `TraitCard.jsx:93` | Calibration anchor for Knob A's D2 variant; drives the §5.3-D3 `source` forward-compat split |
| O2 | **Archetype config file-header is aspirational/false** — claims "real mechanical effects on the risk manager," but `riskOverrides` is dead | `agentArchetypeConfig.js:2-4` vs §4.1–4.3 | Update the comment when the hook is wired; today it misleads readers |
| O3 | **`trailStopLevel` schema divergence** — archetype uses a string (`'sma20'/'sma9'`), `evaluateRisk` reads a number (`trailStopATR`) | `agentArchetypeConfig.js:18,102` vs `agentRiskManager.js:37` | Latent bug if `riskOverrides` is ever wired naively (P-B); resolve during the hook fix |
| O4 | **`vwapFailureTicks` drift** — `momentum_chaser:2` vs its `aggressive` preset's `3` | `agentArchetypeConfig.js:17` vs `agentPresetConfig.js:15` | Symptom of the stale-duplicate; resolved by P-A (delete) or de-dup in P-B |
| O5 | **5-site `cronState` write duplication** — `vwapTicks` (and other cron state) written verbatim at 5 return paths | `agent-evaluate.js:760,775,800,872,1329` | Optional `finalizeCronState(scoreUpdate, …)` helper would make Knob A's new counter a 1-line add and remove the miss-a-site fragility |
| O6 | **`indexIntelligence/stockRankings` has no `expiresAt`/staleness guard** (from bench report) | `compute-index-intelligence.js:851-856` | Belongs to V1.2 workstream (b); noted here only as context for the §6.8 calibration coupling |

### 7.2 Open questions / hand-offs
- **Calibration of *values* needs data (not wiring).** Threshold (Knob A), floor (Knob B), cap (Knob C), and per-archetype tables need empirical/simulated calibration — the same kind of hand-off the bench-staleness and mb-04 reports flagged. Wiring is fully code-verified here; values are a V1.3-implementation study.
- **Which V1.2 option shipped (Option 1 vs 3)** — MEDIUM confidence (§5.0). The V1.3 drafter should confirm against the actual V1.2 spec, since it determines whether the trigger-gate margin is already being reworked (and thus whether S1's extraction rides along).
- **MB04 report's residual live study** ("does Haiku's *final* trade change?", that report's §5.2) remains open — orthogonal to keystone *wiring*, relevant to mb-04 *value* calibration.
- **Cron host confirmed running** (`agent-evaluate` `*/15 13-21 * * 1-5`, `vercel.json:137-139`) — no further data needed for the keystone's execution context.

### 7.3 What this audit did NOT do (boundaries held)
Did **not** draft V1.3; did **not** implement any knob; did **not** modify production code (every "fix" temptation routed to §7.1); did **not** address Path 1 enforcement (deferred); did **not** re-litigate Path 2 vs Path 1; did **not** modify the V1.2 spec; did **not** audit `agentGuardrails.js` beyond the bustBuffer interaction.

---

## Appendix — Load-bearing grep evidence (negative claims)
```
# Knob A counter (G1)
agent-evaluate.js:616  const vwapTicks = { ...(battle.cronState?.vwapTicks || {}) };
agent-evaluate.js:626  vwapTicks[score.symbol] = (vwapTicks[score.symbol]||0)+1;  :628 = 0

# evaluateRisk call sites (G2) — single consumer
agentRiskManager.js:30 (def);  agent-evaluate.js:637 (only call)

# riskOverrides DEAD (G14) — 6 defs, 0 reads
agentArchetypeConfig.js:15,38,59,78,99,120   (defined)
<no reads anywhere in api/>

# archetype config absent from risk manager (G16)
grep "agentArchetypeConfig|ARCHETYPE|archetype" api/_utils/agentRiskManager.js  → NO MATCH

# bustBuffer (G17) — read ONLY at :35, fed by presetConfig.risk
agentRiskManager.js:35  const bustBuffer = presetOverrides.bustBuffer ?? -0.85;
agentArchetypeConfig.js: +0.90/+0.85/+0.75 (defs);  agentPresetConfig.js: -0.90/-0.85/-0.75 (defs)

# defaultPreset DEAD (G20) — 6 defs, 0 reads
agentArchetypeConfig.js:9,32,53,72,93,114   (defined);  <no reads in api/ or src/>

# strategyPreset NOT archetype-derived (G21)
agentBattleService.js:154  strategyPreset: 'balanced'   (hardcoded at creation)
agentService.js:438        strategyPreset: preset       (user toggle)
agent-evaluate.js:231      getPresetConfig(battle.strategyPreset || 'balanced')  (live read)

# no rolling-window / cap state (G13) — none (only HTTP rateLimit middleware)
# no hurdleFloor/swapCap/forcedRotation config fields (G22) — none (Path-1 'stagnation' only in src/data Forge files)

# cron host runs (G24)
vercel.json:137-139  agent-evaluate   "*/15 13-21 * * 1-5"
vercel.json:133-135  compute-index-intelligence  "30 10,11 * * 1-5"
```
