# Forge Enforcement Keystone Spec — V1.4 (LOCKED)

| | |
|---|---|
| **Status** | V1.4 LOCKED — ready for implementation handover |
| **Date** | 2026-05-29 |
| **Type** | Pre-launch architectural spec for the Path 2 keystone work |
| **Branch model** | Spec lives here; implementation begins on `claude/forge-enforcement-keystone-implementation` |
| **Parent context** | `FORGE_ENFORCEMENT_FORK_DECISION_DOC.md` (Path 2 chosen); `FORGE_ENFORCEMENT_KEYSTONE_DISCOVERY_REPORT.md` (PR #445); `KEYSTONE_PRELOCK_FINDINGS.md` (Q1-Q6 verification audit) |
| **Critique cycles** | V1 (initial) → V1.1 (post-Opus + ChatGPT) → V1.2 (Gate 10 inversion fix) → V1.3 (post-audit) → V1.4 (post-pre-lock audit) |
| **Supersedes** | V1.2 "Swap Evaluation Pipeline Refresh" — V1.4 absorbs V1.2 workstream (a) margin normalization outright; V1.2 workstream (b) bench-staleness remains a separate dependency |

---

## 0. V1.4 critical framing (read first)

This spec creates the deterministic enforcement mechanism that gives platform archetypes real teeth at launch. Without it, the conservative-vs-active-trader spectrum doesn't exist regardless of prompt language — every archetype runs identical physics today because no archetype→physics link exists in the code.

**What V1.4 does:**

1. **Establishes the archetype→physics wire** that doesn't exist today (`riskOverrides` and `defaultPreset` are both dead in `agentArchetypeConfig.js`; live `strategyPreset` is hardcoded `'balanced'`)
2. **Adds three deterministic enforcement knobs:** Knob A (forced rotation), Knob B (hurdle floor), Knob C (circuit breaker)
3. **Locks Invariant 1:** emergency bypass keyed on `reason`, not `action` — non-negotiable; prevents the silent-failure class where forced rotations bypass quality and frequency gates
4. **Coordinates with V1.2:** absorbs workstream (a) (margin normalization); workstream (b) (bench-staleness) remains separate calibration dependency

**Cron cadence honesty:** This spec uses "HFT" and "forced rotation" framing inherited from project vocabulary, but at the cron's 15-minute granularity (`*/15 13-21 * * 1-5`), the spectrum V1.4 actually builds is **active swing trader vs. buy-and-hold**, not literal high-frequency trading. ~4 evaluation windows per hour, batched per-tick forced rotations across stagnant positions. True sub-minute HFT requires a separate sub-cron evaluation path that is firmly out of launch scope. The `hftConfig` naming and "HFT floor" descriptions are preserved for continuity with prior specs and project documentation; the behavioral target is calibrated against what the cron physically permits, not against a continuous-trading model.

**What V1.4 is NOT:**

- NOT the general Forge enforcement model question's resolution. V1.4 closes the launch-blocking mb-04 enforcement question for platform archetypes; other mid_battle rules (mb-11, mb-12, phase-decay, comeback, hot-streak) remain prompt-delegated. Path 1 user-authored Lever enforcement remains post-launch.
- NOT a calibration spec. V1.4 defines the mechanism and schema; launch-seed calibration values are implementation work that must be sufficient to pass Phase 8 behavioral verification.
- NOT a Voice Layer surface spec. User-facing "your agent rotated because the position stagnated" explanations are deferred to Voice Layer rework; V1.4 ships the receipt source-field discriminator that enables future surfacing.

**V1.4 absorbed findings from the pre-lock audit (Q1-Q6) and second critique cycle:**

- A1 (field reference bug): `battle.archetype` → `ctx.archetype` (battle.agent_context.archetype) — fixed throughout
- A2 (guardrail bypass gap): `EMERGENCY_BYPASS_REASONS` now includes guardrail-protective reasons — fixed
- B1 (within-tick circuit breaker): Knob C check explicitly inside execution loop reading post-write state — specified
- Decision 3 resolution: Shape-B for `hurdleFloor`, Shape-A for `forcedRotation` and `swapWindow` — locked
- V1.2 simplification: V1.2 isn't merged or shipped; V1.4 owns helper extraction outright — single workstream
- Framing A+ narrowing: closes launch-blocking mb-04 enforcement only; broader enforcement model question remains open
- Gate 8 hardened: five sub-gates (8A-8E) with explicit pass/fail criteria; mechanism gates vs calibration gates explicitly split
- Cron cadence honesty: explicit acknowledgment that 15-min ticks limit "HFT" to "active swing trading"
- Scope estimate revised: ~550-900 lines minimum, 850-1,300 robust (ChatGPT honest accounting)

---

## 1. Purpose

The platform archetypes — `momentum_chaser`, `degen`, `analyst`, `diversifier`, `contrarian`, `guardian` — exist today as ranking-weight and prompt-language differentiation only. Under the hood, every archetype runs the same `'balanced'` physics unless the user manually toggles the preset. This root-causes the symptom that all archetypes trade similarly: there is no mechanism connecting archetype identity to deterministic trading behavior.

V1.4 creates that connection via four pieces of work:

1. **Archetype → physics hook** — establish the wire that doesn't exist today
2. **Knob A — Forced rotation** — the active-trading floor (lets aggressive archetypes overcome Haiku's HOLD bias)
3. **Knob B — Hurdle floor** — deterministic quality gate (lets quality bar apply uniformly across non-emergency swaps)
4. **Knob C — Circuit breaker** — the conservative ceiling (limits churn for conservative archetypes within and across ticks)

Together these produce real conservative-vs-active-trader differentiation at the archetype level, calibrated to the cron's 15-minute granularity.

## 2. Scope discipline

**IN scope:**
- Archetype → physics hook (create missing wire; resolve archetype-vs-preset precedence)
- Knob A: forced rotation mechanism with archetype-keyed thresholds
- Knob B: hurdle floor as deterministic gate at two sites; **Shape-B per-reason table** for `hurdleFloor` specifically
- Knob C: rolling-window swap counter with reason-keyed emergency bypass; **within-tick binding enforced**
- Canonical `EMERGENCY_BYPASS_REASONS` constant including risk-manager AND guardrail-protective reasons
- Shared `computeBenchVsActiveMargin()` helper (V1.4 owns extraction outright; absorbs V1.2 workstream a)
- Receipt schema additions for `source` field discrimination (Path 1 forward-compat)
- `finalizeCronState()` persistence helper for cross-knob state consolidation
- Tick timestamp handling for D2 stagnation detection
- Non-emergency `benchDailyPct > 0` rule for hurdle floor
- Forced-rotation suppression for actively winning positions
- Test coverage for all four pieces including reason-keyed bypass verification matrix

**OUT of scope (deferred):**
- Path 1 user-authored Lever enforcement (compiler + UI bridge + migration)
- Hurdle floor / forced rotation / circuit breaker *production tuning values* (launch-seed values in scope; fine-tuning post-launch)
- Voice Layer surface for "agent rotated because of stagnation" user-facing explanation (Voice Layer rework)
- Bench-staleness rescore (V1.2 workstream b — runs independently; required dependency for hurdle floor calibration)
- Other mid_battle rules (mb-11, mb-12, phase-decay, comeback, hot-streak) — remain prompt-delegated
- D3 (P&L stall) and D4 (bonus-tier stagnation) variants — D2 only at launch
- Snake Draft / Season Mode extensions (BaggerBomb only per BEM scope)
- Migration backfill for legacy battle `agent_context.archetype` (accept analyst-default at launch; backfill backlog)
- True sub-minute HFT (separate sub-cron evaluation path; out of launch scope)

**Framing A+ status:** V1.4 closes the launch-blocking mb-04 enforcement question for platform archetypes. Hurdle enforcement becomes deterministic via Knob B; mb-04 prompt text remains as Haiku context but is no longer the load-bearing enforcement. V1.4 does NOT close the broader Forge enforcement model question — other mid_battle rules remain prompt-delegated, and Path 1 user-authored Levers remain post-launch. The "Gate 10 measures whether cleaner data moves LLM behavior" question from V1.2 is closed by V1.4's deterministic enforcement; it is replaced by Phase 8 behavioral verification (see §6.3).

## 3. The four cross-cutting decisions (LOCKED)

### 3.1 Decision 1 — Invariant 1: Emergency bypass keyed on `reason`, not `action`

**Locked statement:**

> A swap is emergency-bypass iff `reason ∈ EMERGENCY_BYPASS_REASONS`. All other swaps are gated by the hurdle floor (Knob B) and the circuit breaker (Knob C).
>
> `EMERGENCY_BYPASS_REASONS = {bust_avoidance, vwap_failure, stepped_trail, guardrail_stopLoss, guardrail_trailingStop}`

**Why this is non-negotiable:**

Knob A reuses the `SWAP_OUT` action for free downstream execution. Today the action set `{EMERGENCY_SWAP, SWAP_OUT, TRAIL_STOP}` maps 1:1 to the three risk-manager protective reasons, so action-keyed and reason-keyed bypass are indistinguishable. When Knob A ships, a forced rotation will carry `action: SWAP_OUT, reason: 'stagnation'`. If bypass is keyed on action, this swap silently bypasses both Knob B (no quality floor) and Knob C (no rolling window cap), defeating V1.4's entire purpose.

**Why guardrail-protective reasons are included (A2 fix):**

Guardrail-forced swaps (stopLoss / trailingStop breach) do NOT bypass structurally. `applyGuardrails` rewrites the decision and the swap flows through `validateTradeDecision`. Without including guardrail reasons in `EMERGENCY_BYPASS_REASONS`, a stop-loss-breached position whose only replacement doesn't clear the archetype hurdle would be BLOCKED by Knob B — the agent stays parked in a stop-loss-breaching position. A protective exit suppressed by a quality gate is a safety regression that Invariant 1 must prevent.

**Implementation implications:**

- Every gate consults `reason` from `evaluationMetadata`, never the action label
- `EMERGENCY_BYPASS_REASONS` is a single centrally-defined constant consumed by both Knob B and Knob C
- The full canonical reason taxonomy at V1.4 ship:
  - Emergency bypass: `bust_avoidance, vwap_failure, stepped_trail, guardrail_stopLoss, guardrail_trailingStop`
  - Gated (non-emergency): `stagnation, haiku_decision, gameplan_proposal, gameplan_meeting`
  - Non-swap: `threshold_proximity, hold`
- Adding a new emergency type post-launch (e.g., `news_event`) requires updating only the constant
- Future reasons added via additive extension only

### 3.2 Decision 2 — Archetype precedence: Third option (archetype-locked HFT knobs + preset-toggleable base levers)

**Locked choice:**

- Existing base levers (`bustBuffer`, `vwapFailureTicks`, `trailStop*`) remain preset-driven and user-toggleable via `strategyPreset`
- New HFT knobs (`hftConfig.forcedRotation`, `hftConfig.hurdleFloor`, `hftConfig.swapWindow`) are archetype-keyed and ignore preset toggle
- `riskOverrides` is deleted (dead and sign-flipped); not revived

**Four-scenario walk-through (validates the choice):**

| Scenario | Base levers (preset-driven) | HFT knobs (archetype-driven) |
|---|---|---|
| `degen`, no toggle | aggressive defaults | degen forced rotation ON (tight), high cap |
| `degen`, user toggles `defensive` | defensive (respected) | degen forced rotation **still ON** — "defensive base + degen HFT teeth" |
| `guardian`, user toggles `aggressive` | aggressive (respected) | guardian forced rotation **still OFF/loose** — "aggressive base + guardian conservative teeth" |
| `guardian`, no toggle | defensive defaults | guardian forced rotation OFF, low cap |

The cross scenarios (rows 2 and 3) preserve both archetype-as-physics-author and user agency. P-A (archetype-selects-preset) would erase archetype-ness on toggle; P-B (archetype overrides preset) would ignore the toggle.

**Implementation implications:**

- Archetype config gains new `hftConfig` field (schema in §3.3)
- `evaluateRisk` reads base levers from `presetConfig` (unchanged) AND `hftConfig` from archetype config (new)
- User toggle of `strategyPreset` affects base levers only; `hftConfig` values are untouchable from UI

### 3.3 Decision 3 — Config shape: Shape-B for `hurdleFloor`, Shape-A for `forcedRotation` and `swapWindow`

**Locked choice:**

`hurdleFloor` is shape-B (per-reason table). `forcedRotation` and `swapWindow` are shape-A (single scalar per archetype).

**Why Shape-B for `hurdleFloor` specifically:**

The Haiku-path hurdle and the forced-rotation hurdle serve opposite functions for an aggressive archetype:

- **Haiku-path hurdle:** gates discretionary swaps where Haiku has narrative reasoning. Aggressive archetype wants LOW floor — act on thin edges based on conviction
- **Forced-rotation hurdle:** gates mechanical rotation with no narrative justification. Aggressive archetype wants HIGHER floor — mechanical rotation needs a real quality bar

A single scalar cannot satisfy both. ChatGPT's critique caught this with the inverted illustrative values in V1.3 (degen 0.6, analyst 0.3 — backwards). Shape-B resolves the inversion by allowing per-reason values.

**Why Shape-A for `forcedRotation` and `swapWindow`:**

Neither has the dual-master problem. Forced rotation threshold and swap window cap are single-purpose; one value per archetype suffices. Adding per-reason granularity would be precedent-setting without benefit.

**Config schema (full):**

```
archetype.hftConfig = {
  forcedRotation: {           // Shape-A: single scalar set
    enabled: boolean,
    pctThreshold: number,     // D2 threshold (e.g., 0.001 = 0.1%)
    ticksThreshold: number,   // ticks of stagnation before fire
    maxTickAgeMinutes: number // tick timestamp guard (see §4.2)
  },
  hurdleFloor: {              // Shape-B: per-reason table
    enabled: boolean,
    byReason: {
      haiku_decision: { atrMultiplier: number },
      stagnation: { atrMultiplier: number },
      // Future reasons added here; default fallback below
    },
    default: { atrMultiplier: number },  // fallback for unenumerated reasons
    requireBenchPositive: boolean        // §4.3: enforce benchDailyPct > 0 for non-emergency
  },
  swapWindow: {               // Shape-A: single scalar set
    enabled: boolean,
    capPerWindow: number,
    windowMinutes: number,
    countEmergencies: boolean // default false; emergencies excluded from window
  }
}
```

**Illustrative values (NOT calibrated — implementation work):**

| Archetype | forcedRotation | hurdleFloor.byReason | swapWindow |
|---|---|---|---|
| `degen` | `{enabled: true, pctThreshold: 0.001, ticksThreshold: 3}` | `{haiku_decision: 0.2, stagnation: 0.6}` | `{cap: 12, windowMin: 60}` |
| `momentum_chaser` | `{enabled: true, pctThreshold: 0.0015, ticksThreshold: 3}` | `{haiku_decision: 0.3, stagnation: 0.55}` | `{cap: 8, windowMin: 60}` |
| `analyst` | `{enabled: true, pctThreshold: 0.003, ticksThreshold: 6}` | `{haiku_decision: 0.4, stagnation: 0.5}` | `{cap: 4, windowMin: 60}` |
| `diversifier` | `{enabled: true, pctThreshold: 0.003, ticksThreshold: 6}` | `{haiku_decision: 0.4, stagnation: 0.5}` | `{cap: 4, windowMin: 60}` |
| `contrarian` | `{enabled: true, pctThreshold: 0.003, ticksThreshold: 6}` | `{haiku_decision: 0.4, stagnation: 0.5}` | `{cap: 4, windowMin: 60}` |
| `guardian` | `{enabled: false}` | `{haiku_decision: 0.5, stagnation: 0.5}` | `{cap: 2, windowMin: 120}` |

Notice the corrected pattern: degen has LOW Haiku floor (0.2 — acts on thin edges) and HIGH stagnation floor (0.6 — mechanical rotation needs quality bar). The inversion from V1.3 is resolved.

Values illustrative; calibration is implementation work informed by Phase 8 behavioral verification.

### 3.4 Decision 4 — "Meaningful move" definition: D2 (threshold-crossing vs last tick) with tick-age guard

**Locked choice: D2.**

**Mechanism:**

Counter increments when `|price[t] - price[t-1]| / price[t-1] < pctThreshold`. Resets when threshold crossed. Forced rotation fires when counter ≥ `ticksThreshold` AND last tick age within `maxTickAgeMinutes`.

**Tick-age guard (ChatGPT critique addition):**

D2 as originally specified would count "3 ticks of stagnation" without tick-age awareness. Irregular cron timing (data gaps, holidays, weekends) could make 3 ticks span 15 minutes one day or 90 minutes another. The tick-age guard prevents this:

- Counter only increments if `now - lastTickTimestamp <= maxTickAgeMinutes`
- If gap exceeds `maxTickAgeMinutes`, counter pauses (does not increment, does not reset)
- New state field: `lastTickTimestamp` alongside `lastTickPrice`

Default `maxTickAgeMinutes`: 20 (allows for normal 15-min cron plus 5-min slack). Archetype-configurable.

**Forced-rotation suppression for winners (ChatGPT critique addition):**

D2 detects price flatlines but is blind to context. A stock flatlining at +4% after a breakout is a winner consolidating; forcing rotation out of it is wrong. Additional gate:

- Forced rotation eligible ONLY when `active.dailyPct < archetypeWinnerThreshold`
- Default `archetypeWinnerThreshold`: 0.2% (degen), 0% (analyst), disabled (guardian — no forced rotation anyway)
- Prevents stagnation-rotation out of actively winning positions

**Calibration anchor:**

Path 1's existing user-facing Forge stagnation rule at `forgeKnowledgeBase.js:1532-1546` uses `pct` default 0.1%, which maps to D2's `pctThreshold` field. V1.4's illustrative values align with this convention.

**Deferred to backlog:**

- D3 (P&L stall): `Δ atrMultiplier < k` since last tick
- D4 (bonus-tier stagnation): ticks since last threshold cross

If post-launch behavioral testing shows specific archetypes need D3 or D4, add as additional `forcedRotation.mode` values.

## 4. Architecture

### 4.1 The archetype → physics hook

**Current state (audit §4.3):**

Three dead paths: `archetype.riskOverrides → evaluateRisk` (dead, sign-flipped); `archetype.defaultPreset → strategyPreset` (declared, never read); `battle.strategyPreset` (hardcoded `'balanced'`, user-toggled). Zero connection between archetype identity and risk physics today.

**A1 fix — archetype field reference is `ctx.archetype` (battle.agent_context.archetype):**

The audit confirmed `battle.archetype` does NOT exist as a top-level field. Identity lives at `battle.agent_context.archetype`, persisted at `agentBattleService.js:116` and already bound as `ctx.archetype` in the cron at `agent-evaluate.js:224` (used at `:888`).

All hook references in V1.4 use `ctx.archetype` (or `battle.agent_context?.archetype` where `ctx` isn't bound). Reading non-existent `battle.archetype` causes silent fallback to `analyst` for every archetype — the production-deployment silent-failure class.

**Legacy battle handling (Decision: accept analyst-default at launch):**

Pre-existing battles created before V1.4 deployment lack any archetype-aware physics config; their `agent_context.archetype` may be unset. V1.4 accepts these resolving to analyst-default behavior. Backfill migration is post-launch backlog.

**Implementation steps:**

1. **Delete dead `riskOverrides` from 6 archetypes** in `agentArchetypeConfig.js`. Cleanup removes confusion (sign-flipped duplicates). DO NOT revive these fields; `hftConfig` is net-new.

2. **Add `hftConfig` fields to 6 archetypes** per §3.3 schema. Values illustrative; calibration is implementation work.

3. **Import archetype config into `agentRiskManager.js`:** new import statement at top.

4. **Extend `evaluateRisk` signature:** `evaluateRisk(state, presetOverrides, archetypeConfig)` with `archetypeConfig` defaulting to `null` for backward compat.

5. **Call site update at `agent-evaluate.js:637`:** pass `getArchetypeConfig(ctx.archetype)` as third argument.

6. **`getArchetypeConfig(archetypeName)` helper:** returns archetype config object; falls back to analyst-default if `archetypeName` undefined or unknown.

**Scope:** ~40-60 lines for wire creation + config field definitions + delete of dead `riskOverrides`. Calibration values not in this estimate.

### 4.2 Knob A: Forced rotation

**Mechanism:**

Per-symbol stagnation counter incremented when D2's threshold satisfied (with tick-age guard); reset when threshold crossed. When counter ≥ archetype's `ticksThreshold` AND tick age within bound AND active position not winning (`dailyPct < archetypeWinnerThreshold`) AND `pickEmergencyReplacement` returns a qualifying candidate AND that candidate clears Knob B's hurdle floor for `reason: 'stagnation'`, fire a swap with `action: 'SWAP_OUT', reason: 'stagnation', source: 'archetype'`.

**State (new):**

- `stagnationTicks`: per-symbol map analogous to existing `vwapTicks`
- `lastTickPrice`: per-symbol map for D2 comparison
- `lastTickTimestamp`: per-symbol map for tick-age guard

All three persisted via `finalizeCronState()` helper (§4.5).

**Detection logic:**

Added to `evaluateRisk` as a new branch, priority-ordered after `vwap_failure` (which is more urgent — failing VWAP is a "leave now" signal; stagnation is a "no reason to stay" signal). Pseudocode:

```
// In evaluateRisk
if (archetypeConfig?.hftConfig?.forcedRotation?.enabled) {
  const cfg = archetypeConfig.hftConfig.forcedRotation
  const tickAgeMin = (now - state.lastTickTimestamp) / 60000
  
  // Tick-age guard
  if (tickAgeMin <= cfg.maxTickAgeMinutes) {
    const pctMove = Math.abs(state.currentPrice - state.lastTickPrice) / state.lastTickPrice
    
    if (pctMove < cfg.pctThreshold) {
      // Stagnation tick — increment counter
      if (state.stagnationTicks >= cfg.ticksThreshold) {
        // Winner suppression check
        if (state.dailyPct < cfg.winnerThreshold) {
          return { action: 'SWAP_OUT', reason: 'stagnation', source: 'archetype', detail: {...} }
        }
      }
    } else {
      // Meaningful move — reset counter (handled by caller)
    }
  }
  // else: tick gap too large, pause (no increment, no reset)
}
```

**Candidate source (audit Q-question pending):**

V1.4 uses existing `pickEmergencyReplacement` (`agentRiskManager.js:111-133`) for the candidate. Function picks highest daily %change from bench pool. The implementation handover should answer:

- Does `pickEmergencyReplacement` use the same bench pool Haiku sees?
- Does it respect hotBench recency?
- Does it exclude currently held symbols?
- Does it return null cleanly if all candidates fail Knob B?

If `pickEmergencyReplacement` proves insufficient, wrap it as `pickSwapReplacementCandidate({intentSource, archetypeConfig, marginHelper})` — implementation discovery decides.

**Execution:**

Reuses existing `SWAP_OUT` action path. `pickEmergencyReplacement` returns candidate; candidate must clear Knob B's hurdle floor for `reason: 'stagnation'` (intent-source-keyed gate); if pass, swap fires through normal execution path including narration and status feed.

**Receipt:**

Carries `reason: 'stagnation'`, `source: 'archetype'`, `archetype: ctx.archetype`. The `source` field discriminator (§4.6) ensures future Path 1 user-authored stagnation rules can be distinguished without receipt migration.

**Scope:** ~80-130 lines (detection logic, tick-age guard, winner suppression, state management) + reuse of execution path (free).

### 4.3 Knob B: Hurdle floor

**Mechanism:**

Deterministic gate that computes prev-close-relative bench-vs-active Daily% margin and requires it to clear the archetype's `hurdleFloor.byReason[reason].atrMultiplier`. Applied at two sites with intent-source-keyed bypass.

**The shared margin helper (V1.4 owns extraction outright):**

V1.2 didn't ship; the keystone owns the extraction outright per pre-lock amendment C1. V1.4 ships `computeBenchVsActiveMargin()` as the canonical helper:

```
function computeBenchVsActiveMargin({
  activeDailyPct,
  benchDailyPct,
  activeSymbol,
  benchSymbol,
  atrValue,
  source
}) {
  // Both sides MUST be prev-close-relative Daily%
  // (this was the V1.2 baseline-normalization concern)
  
  return {
    activeDailyPct,
    benchDailyPct,
    rawPctMargin: benchDailyPct - activeDailyPct,
    marginAtrUnits: (benchDailyPct - activeDailyPct) / atrValue,
    atrValue,
    eligibleForComparison: (atrValue > 0 && !isNaN(activeDailyPct) && !isNaN(benchDailyPct)),
    reasonIfInvalid: null  // populated if eligibleForComparison false
  }
}
```

This helper is consumed by:
- V1.4 Knob B at both gate sites
- The pre-Haiku wake trigger at `agentTriggerGate.js:90-113` (formerly V1.2 workstream a)
- Any future enforcement surface needing the same margin computation

Single source of truth; no formula divergence possible.

**Hook points (intent-source-keyed per audit §2.2):**

| Intent source | Site | Apply hurdle? |
|---|---|---|
| Haiku-proposed SWAP | `validateTradeDecision` / pre-`:1084` | Yes — `byReason.haiku_decision` floor |
| Knob A forced rotation (`reason: 'stagnation'`) | Risk loop pre-`:713` | Yes — `byReason.stagnation` floor |
| `bust_avoidance`, `vwap_failure`, `stepped_trail` (risk-manager) | Risk loop pre-`:713` | No (bypass per Invariant 1) |
| `guardrail_stopLoss`, `guardrail_trailingStop` | `validateTradeDecision` path | No (bypass per Invariant 1 — A2 fix) |
| `gameplan_proposal`, `gameplan_meeting` | `validateTradeDecision` path | Yes — `byReason.default` floor (or specific entry) |

**Non-emergency `benchDailyPct > 0` rule (ChatGPT critique addition):**

For non-emergency swaps, `hurdleFloor.requireBenchPositive: true` (default) requires bench candidate to have positive Daily%. Prevents the case where active is -5% and bench is -1% (margin +4%) but bench is still down on the day — rotating into a losing position is rarely worth it for discretionary or forced-rotation swaps. Emergencies bypass this rule along with the rest of Knob B.

**Implementation shape (B2 standalone helper):**

Standalone `clearsHurdleFloor()` helper rather than extending `validateTradeDecision`:

```
function clearsHurdleFloor({
  active,
  benchCandidate,
  reason,
  archetypeConfig,
  userATR
}) {
  // Emergency bypass first
  if (EMERGENCY_BYPASS_REASONS.has(reason)) {
    return { clears: true, bypassed: true, reason }
  }
  
  const floorCfg = archetypeConfig?.hftConfig?.hurdleFloor
  if (!floorCfg?.enabled) {
    return { clears: true, disabled: true }
  }
  
  // Look up per-reason floor (Shape-B)
  const reasonCfg = floorCfg.byReason[reason] || floorCfg.default
  const requiredMargin = reasonCfg.atrMultiplier
  
  // Non-emergency bench-positive rule
  if (floorCfg.requireBenchPositive && benchCandidate.dailyPct <= 0) {
    return { clears: false, blockReason: 'bench_not_positive', benchDailyPct: benchCandidate.dailyPct }
  }
  
  const margin = computeBenchVsActiveMargin({...})
  if (!margin.eligibleForComparison) {
    return { clears: false, blockReason: 'margin_invalid', detail: margin.reasonIfInvalid }
  }
  
  const clears = margin.marginAtrUnits >= requiredMargin
  return { clears, blockReason: clears ? null : 'below_floor', margin, required: requiredMargin }
}
```

Pure function; preserves `validateTradeDecision` purity; explicit per-site control.

**Scope:** ~80-130 lines (helper + margin extraction + bench-positive rule + intent-source guards + both hook sites).

### 4.4 Knob C: Circuit breaker (within-tick binding)

**Mechanism:**

Rolling-window swap counter that limits non-emergency swaps per window. Derived from existing `trades[]` array. Emergency swaps bypass per Invariant 1.

**B1 fix — within-tick binding via post-write re-read:**

The pre-lock audit (Q2) confirmed `trades[]` is written per-swap inside each transaction (`agentSwapExecution.js:242-255`) and the cron re-reads the battle doc after every risk swap (`agent-evaluate.js:747-748`). Knob C's forced-rotation check MUST run inside the `:657-752` execution loop, reading the re-read live count per swap. NOT pre-computed against the frozen `riskSwaps` array.

If implemented incorrectly (pre-computed), all forced rotations in a tick see the same pre-tick count, all pass, all execute — exactly the within-tick burst the breaker exists to prevent.

**Window-count helper:**

```
function getRecentSwapCount(battle, windowMinutes, countEmergencies = false) {
  const now = Date.now()
  const windowMs = windowMinutes * 60 * 1000
  const trades = battle.trades || []
  
  return trades.filter(t => {
    // Tick-age guard
    if (!t.swappedOutAt) return false
    const swapTime = Date.parse(t.swappedOutAt)
    if (isNaN(swapTime) || swapTime < now - windowMs) return false
    
    // Reason filtering (Invariant 1)
    const reason = t.evaluationMetadata?.reason
    if (!countEmergencies && EMERGENCY_BYPASS_REASONS.has(reason)) return false
    
    return true
  }).length
}
```

**Hook points:**

- **Block at Haiku path:** new rule in `validateTradeDecision` (after conviction floor at `:61-64`). If count ≥ cap, downgrade swap to HOLD.
- **Block at forced-rotation path (in-loop):** guard inside the `:657-752` execution loop, BEFORE each `executeSwapServer` call. Reads live count from the re-read `battle.trades`. If count ≥ cap, skip the swap.
- **Emergency swaps:** bypass for free — they never call `validateTradeDecision`, and the risk loop guard checks the reason set.

**Edge case handling:**

- Trades missing `swappedOutAt`: ignored, logged
- Trades missing `reason`: treated as non-emergency unless `source` proves emergency
- Duplicate trades by id: deduped
- Clock skew in timestamp parsing: handled by `isNaN()` check

**Scope:** ~40-60 lines (helper + two hook sites + edge case handling).

### 4.5 The persistence helper (cross-knob utility)

**Problem:** Knob A introduces new state (`stagnationTicks`, `lastTickPrice`, `lastTickTimestamp`) that must be persisted at all 5 mutually-exclusive return paths (`agent-evaluate.js:760, :775, :800, :872, :1329`). Missing one silently zeroes counters on that path.

**Solution:** Extract `finalizeCronState(scoreUpdate, ...)` helper that handles writes uniformly. Knob A's new state becomes a single-line add inside the helper; future cross-cutting state inherits coverage automatically.

**Scope:** ~25-40 lines (helper + refactor of 5 sites).

### 4.6 Receipt source-field discriminator (Path 1 forward-compat)

**Mechanism:**

Every swap receipt carries a `source` field indicating the origin path. Existing discriminator pattern (`source: 'risk_manager'` at `:738`, `source: 'gameplan_meeting'` at `:793`) extends naturally.

**Source values at V1.4 ship:**

- `risk_manager` — bust_avoidance, vwap_failure, stepped_trail (existing)
- `guardrail` — guardrail_stopLoss, guardrail_trailingStop (existing? or new?)
- `archetype` — Knob A forced rotation (new — V1.4)
- `haiku_decision` — Haiku-proposed swaps (existing or implicit)
- `gameplan_meeting`, `gameplan_proposal` — gameplan-driven (existing)

**Path 1 forward-compat:**

When Path 1 user-authored Lever enforcement ships (post-launch), user-authored stagnation rules will emit `source: 'user_rule'` alongside `reason: 'stagnation'`. Voice Layer can then distinguish "your degen archetype rotated because of stagnation" from "your custom stagnation rule fired" without receipt migration.

**Receipt schema additions:**

```
receipt.swap = {
  ...existing fields,
  source: string,           // 'archetype', 'risk_manager', 'guardrail', 'haiku_decision', 'gameplan_*'
  archetype: string | null, // ctx.archetype when source === 'archetype'
  preset: string,           // battle.strategyPreset
  hftKnobsSource: string    // 'archetype' (always at launch; 'user_rule' post-Path-1)
}
```

**Scope:** ~30-50 lines (schema additions + emit logic at all swap call sites).

## 5. Implementation scope

| Component | Lines | Risk | Notes |
|---|---|---|---|
| **Phase 0: Pre-implementation discovery** | | | |
| Confirm branch base, V1.2 ship status, anchor lines (HEAD vs main) | 0 code, ~15 doc | Low | Per pre-lock amendments branch flag |
| Verify `pickEmergencyReplacement` semantics | 0 code, ~10 doc | Low | Determines wrapper need for §4.2 |
| Confirm `agent_context.archetype` exists in production battles | 0 code, ~10 doc | Low | A1 verification |
| **Phase 1: Archetype → physics hook** | | | |
| Delete dead `riskOverrides` from 6 archetypes | -50 to -70 | Low | Cleanup |
| Add `hftConfig` fields to 6 archetypes (Decision 3 schema) | 60-90 | Low | Includes Shape-B byReason tables |
| `evaluateRisk` signature extension (+archetype param, default null) | 10-15 | Medium | Backward-compat default |
| Call site at `agent-evaluate.js:637` passes `getArchetypeConfig(ctx.archetype)` | 5-10 | Low | A1 fix |
| `getArchetypeConfig()` helper with analyst-default fallback | 12-18 | Low | |
| **Phase 2: Persistence helper** | | | |
| `finalizeCronState()` helper | 20-30 | Low | Cross-knob utility |
| Refactor 5 persistence sites to use helper | 15-25 | Low | Mechanical |
| **Phase 3: Knob A — Forced rotation** | | | |
| `stagnationTicks`, `lastTickPrice`, `lastTickTimestamp` maps | 12-18 | Low | Mirror `vwapTicks` pattern |
| D2 detection logic with tick-age guard | 25-35 | Medium | Per §3.4 specification |
| Winner suppression check | 8-12 | Low | |
| `evaluateRisk` new branch (forced rotation) | 25-35 | Medium | Priority-ordered after vwap_failure |
| Reuse SWAP_OUT action + reason: 'stagnation' + source: 'archetype' | 5-8 | Low | Free per audit §1.2 |
| Knob B integration in forced-rotation candidate check | 8-12 | Low | Calls `clearsHurdleFloor()` |
| Candidate source verification or wrapper | 15-40 | Medium | Scope depends on Phase 0 audit |
| **Phase 4: Knob B — Hurdle floor** | | | |
| `EMERGENCY_BYPASS_REASONS` constant + Invariant 1 documentation | 10-15 | Low | Single source of truth |
| `computeBenchVsActiveMargin()` helper (V1.4 owns extraction) | 30-50 | Medium | Replaces V1.2 inline logic |
| `clearsHurdleFloor()` helper with Shape-B byReason lookup | 35-55 | Medium | Pure function |
| Bench-positive rule | 8-12 | Low | |
| Hook at validateTradeDecision pre-`:1084` (Haiku path) | 12-18 | Low | |
| Hook at risk loop pre-`:713` (forced rotation only) | 8-12 | Low | Reason-guarded |
| Guardrail path bypass verification (A2) | 8-15 | Medium | Verify guardrail reasons flow correctly |
| **Phase 5: Knob C — Circuit breaker (within-tick binding)** | | | |
| `getRecentSwapCount()` helper with reason filtering | 20-30 | Low | Derive from trades[] |
| Edge case handling (missing fields, dedupe, clock skew) | 15-25 | Medium | |
| `validateTradeDecision` new rule (Haiku block) | 10-15 | Low | After conviction floor at :61-64 |
| In-loop forced-rotation block (B1 within-tick binding) | 15-25 | High | Must read post-write state; critical implementation detail |
| **Phase 6: Receipt source field** | | | |
| Source field schema addition | 10-15 | Low | |
| Source-emit logic at all swap call sites | 25-40 | Low | risk_manager, guardrail, archetype, haiku_decision, gameplan_* |
| **Phase 7: Tests** | | | |
| Unit: archetype config loads correctly per archetype | 30-50 | Standard | All 6 archetypes |
| Unit: stagnation detection (D2) with tick-age guard | 40-60 | Standard | Multiple ATR + tick-gap scenarios |
| Unit: winner suppression | 15-25 | Standard | |
| Unit: hurdle floor math (Shape-B byReason lookup) | 35-50 | Standard | Multiple reasons × archetypes |
| Unit: bench-positive rule | 12-20 | Standard | |
| Unit: circuit breaker window math + edge cases | 30-45 | Standard | Including dedupe, missing fields |
| Unit: **Invariant 1 — reason × action × source matrix** | 40-60 | Standard | **LOAD-BEARING — Gate 6** |
| Integration: archetype → physics flow end-to-end per archetype | 50-80 | Standard | All 6 archetypes |
| Integration: preset toggle preserves HFT knobs | 30-50 | Standard | Validates Decision 2 third option |
| Integration: forced rotation gated by hurdle floor | 35-55 | Standard | Knob A × B interaction |
| Integration: emergency bypass for risk-manager AND guardrail | 35-55 | Standard | Invariant 1 in action (A2 verification) |
| Integration: **within-tick circuit breaker binding** | 30-50 | Medium | **B1 verification — critical** |
| **Phase 8: Behavioral verification (5 sub-gates per §6.3)** | | | |
| Test harness for archetype divergence (8A) + forced rotation prevalence (8B) | 40-60 | Medium | Calibration-dependent gates |
| Mechanism tests for hurdle floor protection (8C) + circuit breaker protection (8D) + no inversion (8E) | 30-50 | Standard | Calibration-independent |
| Behavioral verification execution + reporting | 30-50 | Medium | |
| **Total** | **~850-1,300 lines** | Medium-high overall | Honest estimate per ChatGPT critique; decision-gated upper bound |

**Scope estimate notes:**

- Lower bound (~850) assumes Phase 0 audit confirms `pickEmergencyReplacement` is usable as-is (no wrapper needed) and standard test breadth
- Upper bound (~1,300) assumes candidate wrapper needed + expanded test coverage + extensive edge case handling discovered during implementation
- ChatGPT's "550-900 minimum / 850-1,300 robust" framing applied here; V1.4 adopts the robust estimate as honest accounting

## 6. Validation gates

### 6.1 Pre-implementation gates

- **Gate 0:** Branch base confirmed; HEAD vs main anchor lines verified (per pre-lock amendments)
- **Gate 0b:** `pickEmergencyReplacement` semantics verified; wrapper decision made
- **Gate 0c:** `agent_context.archetype` confirmed present in production battle data (A1 verification)

### 6.2 Implementation gates (in order)

- **Gate 1:** Hook creation correctness — archetype config flows into `evaluateRisk` for all 6 archetypes; preset toggle no longer affects HFT knobs; **assert behavioral differentiation at runtime** (load configs for degen and guardian and verify they differ — NOT just that the call resolves). This is the A1-class bug prevention check.
- **Gate 2:** Persistence helper coverage — all 5 return paths use the helper; new state survives across cron ticks
- **Gate 3:** Stagnation detection — D2 logic fires correctly with tick-age guard; winner suppression works
- **Gate 4:** Hurdle floor enforcement — Haiku swaps blocked when margin below per-reason floor; forced rotation gated by `byReason.stagnation` floor; emergencies bypass; guardrail-protective swaps bypass (A2 verification)
- **Gate 5:** Circuit breaker enforcement — Haiku swaps blocked when window cap reached; **within-tick binding works** (B1 verification — multiple forced rotations in same tick read post-write count); emergencies bypass
- **Gate 6 (LOAD-BEARING):** Invariant 1 — comprehensive test matrix verifying reason-keyed bypass works correctly across all reason × action × source combinations including guardrail-protective reasons
- **Gate 7:** Source field discriminator — every swap carries correct source per origin path

### 6.3 Phase 8 behavioral verification (5 sub-gates with explicit pass/fail)

Replaces V1.2's Gate 10. Tests whether the deterministic enforcement produces the intended archetype spectrum. Hardened from V1.3's "vibe check" framing per ChatGPT critique.

**Mechanism gates (calibration-independent; can pass at launch readiness):**

- **Gate 8C — Hurdle floor protection:**
  - PASS: Knob B blocks at least one below-floor Haiku swap in fixtures built to trigger below-floor candidates; emergency reasons bypass Knob B every time; non-emergency reasons never bypass Knob B
  - FAIL: any non-emergency reason bypasses Knob B; any emergency reason gets blocked; margin math differs between trigger wake and hurdle floor

- **Gate 8D — Circuit breaker protection:**
  - PASS: Knob C blocks non-emergency swaps once cap is reached; emergency swaps bypass cap; rolling window count excludes emergency reasons; **within-tick binding catches multiple forced rotations in same tick**
  - FAIL: cap counts by action instead of reason; stagnation swaps bypass cap; protective swaps get blocked; within-tick burst not caught

- **Gate 8E — No archetype inversion:**
  - PASS: degen trades more than guardian; guardian blocks more non-emergency swaps via Knob C than degen (adjusted for opportunity count); degen triggers more forced rotations than guardian; preset toggle does NOT change HFT knobs
  - FAIL: guardian behaves more aggressively than degen; degen behaves indistinguishably from balanced; preset toggle changes HFT knobs

**Calibration-dependent gates (pass after calibration converges):**

- **Gate 8A — Archetype divergence:**
  - PASS: degen median non-emergency rotations per battle ≥ 3× guardian; momentum_chaser median ≥ 1.5× guardian; guardian has lowest or tied-lowest median non-emergency rotations
  - FAIL: degen < 2× guardian; guardian exceeds analyst or momentum_chaser on median non-emergency rotations without emergency-reason explanation

- **Gate 8B — Forced rotation prevalence:**
  - PASS: degen stagnation rotations = 15-45% of degen non-emergency rotations; guardian stagnation rotations < 5%; analyst stagnation rotations below degen
  - FAIL: degen stagnation rotations = 0 in most eligible battles; guardian stagnation rotations ≥ 10%; stagnation becomes dominant swap reason for every archetype

**Sequencing:** Mechanism gates (8C, 8D, 8E) must pass before launch. Behavioral gates (8A, 8B) pass during calibration phase post-implementation. Bench-staleness fix (V1.2 workstream b) must land before behavioral gate calibration begins.

**Cron cadence honesty:** Target frequency targets (3×, 1.5×) are calibrated against ~4 evaluation windows per hour, not against continuous-trading models. The behavioral spectrum V1.4 produces is "active swing trader vs buy-and-hold," appropriate to the cron's 15-minute granularity.

## 7. Pre-launch sequence impact

### 7.1 V1.2 absorption (per pre-lock amendment C1)

V1.2 is not merged and not on disk. V1.4 owns the margin helper extraction outright — no V1.2 coordination needed.

- **V1.2 workstream (a) margin normalization:** absorbed. V1.4's `computeBenchVsActiveMargin()` is the canonical helper; consumed by both the pre-Haiku trigger gate and V1.4's hurdle floor
- **V1.2 workstream (b) bench-staleness rescore:** code-disjoint from V1.4 but **calibration dependency**. Knob B's hurdle floor stringency depends on bench data recency. Must land before Phase 8 behavioral gate calibration (8A, 8B) begins.

### 7.2 Bench-staleness as calibration dependency

V1.4 mechanism gates (8C, 8D, 8E) pass independent of bench-staleness fix. Behavioral gates (8A, 8B) depend on calibrated hurdle floor values, which require fresh bench data. Sequence:

1. V1.4 ships with mechanism gates passing
2. Bench-staleness rescore (V1.2 workstream b) ships as separate small workstream
3. Hurdle floor calibration converges using fresh bench data
4. Behavioral gates 8A, 8B pass
5. Launch unblocked

### 7.3 Day-Trader / degen launch-blocker (per pre-lock amendment C2)

Clarification: `day_trader` is a Forge rule-builder construct (`dimensionMapper.js`, `forgeCollections.js`), NOT an agent archetype. The active-trading-embodying archetype is `degen`. V1.4 Phase 8 behavioral verification tests degen (not day_trader). The launch blocker that previously referenced "day-trader" is conceptual — it refers to "the platform's ability to express an actively-trading archetype" — and is closed by degen's Phase 8 8A/8B PASS.

### 7.4 Stream D unblock (three-tier per architecture gut-check)

- **Stream D spec drafting:** unblocked now (independent of V1.4)
- **Stream D calibration execution:** waits for V1.4 Phase 8 behavioral gates (8A, 8B) PASS
- **Stream D implementation:** waits for calibration PASS

### 7.5 Framing A → "Framing A+" status (narrowed per pre-lock + ChatGPT)

V1.4 closes the **launch-blocking mb-04 enforcement question for platform archetypes**:
- Hurdle enforcement becomes deterministic via Knob B
- mb-04 prompt text remains as Haiku context but is no longer the load-bearing enforcement
- V1.2's "Gate 10 measures whether cleaner data moves LLM behavior" question is closed by V1.4's deterministic enforcement

V1.4 does NOT close the **general Forge enforcement model question**:
- Other mid_battle rules (mb-11, mb-12, phase-decay, comeback, hot-streak) remain prompt-delegated
- Path 1 user-authored Lever enforcement remains post-launch (Strategy Laboratory maturation)
- The architectural question of "should all Forge rules be deterministic?" remains open

This is the narrowed framing: launch-blocking mb-04 closed; broader enforcement model open.

### 7.6 Sequence position

1. **V1.4 LOCKED (current)** — ready for implementation handover
2. **Implementation handover drafting** (next chat task in this session)
3. **Implementation begins in fresh chat** with V1.4 + handover as inputs
4. **Phase 0 discovery audit** (in implementation chat) confirms branch base + `pickEmergencyReplacement` + `agent_context.archetype` presence
5. **Phases 1-8 implementation** with gates
6. **Bench-staleness rescore (V1.2 workstream b)** ships separately (small workstream)
7. **Hurdle floor calibration** post-V1.4-merge + post-bench-staleness
8. **Phase 8 behavioral gates (8A, 8B) pass**
9. **Stream D implementation**
10. **Voice Layer rework** (post-launch consideration; informs user-facing rotation explanation)
11. **Launch**

## 8. Risk register

### 8.1 Architectural risks

- **A1-class field-reference bugs.** V1.4 fixed `battle.archetype` → `ctx.archetype`, but the same bug class exists for any field reference. Mitigation: Gate 1 explicitly asserts behavioral differentiation (degen ≠ guardian configs at runtime), not just call resolution.

- **A2-class silent safety regressions.** V1.4 expanded `EMERGENCY_BYPASS_REASONS` to include guardrail-protective reasons. Future emergency types (e.g., news_event) must be added to the constant; absence creates safety regression. Mitigation: Invariant 1 documented as single source of truth; Gate 6 tests guardrail bypass explicitly.

- **Decision 2 third option requires user-toggle isolation logic.** If implementer doesn't carefully separate base levers (preset-driven) from HFT knobs (archetype-driven), preset toggle could accidentally affect HFT knobs. Mitigation: Gate 1 explicit test for preset-toggle isolation.

- **Within-tick circuit breaker binding (B1) is implementation-detail-critical.** If Knob C's forced-rotation check is pre-computed against the frozen `riskSwaps` list instead of in-loop reading post-write state, the cap doesn't bind within a tick — exactly what Knob C exists to prevent. Mitigation: Gate 5 explicit within-tick burst test; in-loop placement specified in §4.4.

### 8.2 Implementation risks

- **`pickEmergencyReplacement` may need wrapping.** Function picks "highest daily %change" without quality consideration. Phase 0 audit determines whether wrapping is needed. Mitigation: scope estimate upper bound includes wrapper work.

- **Persistence helper refactor touches 5 sites.** Mechanical risk. Mitigation: refactor is single-PR; each site verified independently before merging.

- **Archetype config schema change requires migration handling.** Existing battles at deploy time lack `hftConfig`. Mitigation: backward-compat defaults in `getArchetypeConfig()`; pre-existing battles resolve to analyst-default (accepted per launch decision); backfill is post-launch backlog.

- **`evaluateRisk` signature change is API-visible.** Audit confirmed only one caller; third parameter defaults to null for backward compat.

### 8.3 Coordination risks

- **V1.2 workstream (b) timing.** V1.4 ships with hurdle floor values provisional; bench-staleness fix must land before calibration converges. Mitigation: explicit calibration anchor tracking; mechanism gates pass independent of calibration.

- **Path 1 forward-compat assumes specific reason taxonomy.** If Path 1 eventually emits different reason strings, `source` field discriminator handles it. Mitigation: source field captures origin regardless of reason; Path 1 can use any reason string and remain distinguishable.

- **Cron cadence vs HFT framing.** Project vocabulary uses "HFT day-trader" but cron permits ~4 ticks/hour. Mitigation: §0 explicit acknowledgment; behavioral targets calibrated to cron reality (active swing trader, not literal HFT).

### 8.4 Calibration risks

- **Phase 8 behavioral gates depend on calibration values.** Mechanism gates (8C, 8D, 8E) can pass before calibration; behavioral gates (8A, 8B) require tuned values. Mitigation: explicit split between mechanism and calibration-dependent gates; calibration is post-implementation work.

- **Hurdle floor values calibrated against stale bench data may need re-tuning.** Bench-staleness fix (V1.2 workstream b) lands separately; re-calibration after bench-staleness if needed. Mitigation: calibration anchor recorded.

- **Launch-seed calibration values may produce poor behavior.** Implementation must ship values sufficient to pass mechanism gates AND show directional behavioral differentiation, even if not optimal. Mitigation: Phase 8 behavioral verification surfaces this; calibration tuning iterates post-merge.

## 9. Locked decisions

1. **Path 2 framing:** platform archetypes get deterministic teeth; Path 1 user-authored Lever enforcement deferred to post-launch
2. **Invariant 1 (LOCKED):** emergency bypass keyed on `reason`, not `action`. `EMERGENCY_BYPASS_REASONS = {bust_avoidance, vwap_failure, stepped_trail, guardrail_stopLoss, guardrail_trailingStop}`. Non-negotiable.
3. **Decision 2 (LOCKED):** archetype precedence is third option — archetype-locked HFT knobs + preset-toggleable base levers
4. **Decision 3 (LOCKED):** Shape-B for `hurdleFloor` (per-reason table); Shape-A for `forcedRotation` and `swapWindow` (single scalar)
5. **Decision 4 (LOCKED):** "meaningful move" definition is D2 (threshold-crossing vs last tick) with tick-age guard and winner suppression
6. **A1 fix (LOCKED):** all archetype field references use `ctx.archetype` (battle.agent_context.archetype); Gate 1 asserts runtime behavioral differentiation
7. **A2 fix (LOCKED):** `EMERGENCY_BYPASS_REASONS` includes guardrail-protective reasons; canonical taxonomy in §3.1 explicit
8. **B1 fix (LOCKED):** Knob C forced-rotation check runs in-loop reading post-write state; within-tick binding is implementation requirement
9. **Archetype config gains `hftConfig` field** with `forcedRotation`, `hurdleFloor` (Shape-B byReason), `swapWindow` sub-objects per archetype
10. **Dead `riskOverrides` deleted** during hook fix; replaced by `hftConfig` (net-new fields, not revival)
11. **`evaluateRisk` signature extends with archetype param** (default null for backward compat)
12. **Persistence helper (`finalizeCronState`)** consolidates the 5-site write pattern
13. **V1.4 owns margin helper extraction outright** (`computeBenchVsActiveMargin`); V1.2 workstream (a) absorbed
14. **V1.2 workstream (b) bench-staleness** remains separate dependency; required for behavioral gate calibration
15. **Receipt schema adds `source` field** for Path 1 forward-compat (LOCKED in scope per founder decision)
16. **Phase 8 behavioral verification replaces V1.2 Gate 10** as load-bearing validation; 5 sub-gates with explicit pass/fail criteria; mechanism vs calibration-dependent split
17. **Framing A+ narrowed:** closes launch-blocking mb-04 enforcement for platform archetypes only; broader enforcement model question remains open
18. **Cron cadence honesty:** "HFT" framing acknowledged as inheriting project vocabulary; behavioral targets calibrated to ~4 ticks/hour reality (active swing trader, not literal HFT)
19. **Legacy battles accept analyst-default at launch;** backfill is post-launch backlog
20. **Launch-seed calibration values are implementation scope;** must be sufficient to pass mechanism gates and show directional behavioral differentiation
21. **Estimated total scope:** ~850-1,300 lines including tests, edge case handling, receipt work, and behavioral verification
22. **Status:** V1.4 LOCKED — ready for implementation handover

## 10. Open items deferred to post-launch backlog

- **Path 1 user-authored Lever enforcement.** Strategy Laboratory maturation work. Requires: compiler from Lever rules to physics knobs, UI bridge for two-surface precedence, migration. Estimated ~530-1,120 lines per fork decision doc.
- **D3 / D4 stagnation variants.** If specific archetypes need P&L-stall or bonus-tier stagnation detection (vs D2's price-flatline), add as additional `forcedRotation.mode` values.
- **Voice Layer surface for forced rotation.** User-facing "your agent rotated because the position stagnated" explanation. Receipt source field supports this; surface deferred to Voice Layer rework.
- **News-event emergency type.** If post-launch experience adds news events as deterministic emergencies, extend `EMERGENCY_BYPASS_REASONS` set (single point of change per Invariant 1).
- **Legacy battle migration backfill.** Backfill `agent_context.archetype` for pre-V1.4 battles. Accepted analyst-default at launch; backfill is cleanup work.
- **Sub-cron evaluation path for true HFT.** Current ~4 ticks/hour limits behavioral spectrum to active swing trader. True sub-minute HFT requires separate architectural work; firmly out of launch scope.
- **Migration to per-reason tables for `forcedRotation` and `swapWindow` (Shape-A → Shape-B).** If experience shows need for per-reason granularity beyond hurdle floor, migrate additively (each scalar becomes default for all reasons).
- **General Forge enforcement model question.** Should all mid_battle rules become deterministic? Open architectural question; V1.4 closes only the launch-blocking mb-04 question.
- **Snake Draft / Season Mode extensions.** V1.4 is BaggerBomb-only per BEM scope. Other game modes may eventually want archetype-keyed enforcement.

---

**End of Forge Enforcement Keystone Spec V1.4. LOCKED — ready for implementation handover.**

