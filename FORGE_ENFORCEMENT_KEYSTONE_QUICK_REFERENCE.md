# Forge Enforcement Keystone — Quick Reference

**Purpose:** Fast lookup of V1.4 decisions and patterns during implementation.
**Full spec:** `FORGE_ENFORCEMENT_KEYSTONE_SPEC_V1_4.md`
**Status:** LOCKED — pre-implementation reference

---

## The four cross-cutting decisions

| # | Decision | Locked choice |
|---|---|---|
| 1 | Emergency bypass key | `reason`, NEVER `action`. Bypass set: `{bust_avoidance, vwap_failure, stepped_trail, guardrail_stopLoss, guardrail_trailingStop}` |
| 2 | Archetype precedence | Third option: archetype-locked HFT knobs + preset-toggleable base levers |
| 3 | Config shape | Shape-B (per-reason table) for `hurdleFloor`; Shape-A (single scalar) for `forcedRotation` and `swapWindow` |
| 4 | "Meaningful move" | D2 (threshold-crossing vs last tick) with tick-age guard and winner suppression |

## Critical field references (A1-class bug prevention)

- ✅ `ctx.archetype` (cron-bound; `agent-evaluate.js:224, :888`)
- ✅ `battle.agent_context?.archetype` (when ctx not bound)
- ❌ `battle.archetype` — DOES NOT EXIST. Reading this causes silent fallback to analyst-default.

## EMERGENCY_BYPASS_REASONS (Invariant 1)

```
EMERGENCY_BYPASS_REASONS = new Set([
  'bust_avoidance',      // risk-manager protective
  'vwap_failure',        // risk-manager protective
  'stepped_trail',       // risk-manager protective
  'guardrail_stopLoss',  // guardrail-protective (A2 fix)
  'guardrail_trailingStop' // guardrail-protective (A2 fix)
])
```

Gated (non-emergency) reasons: `stagnation, haiku_decision, gameplan_proposal, gameplan_meeting`
Non-swap reasons: `threshold_proximity, hold`

## archetype.hftConfig schema (Decision 3)

```
archetype.hftConfig = {
  forcedRotation: {           // Shape-A
    enabled: boolean,
    pctThreshold: number,     // e.g., 0.001 = 0.1%
    ticksThreshold: number,
    maxTickAgeMinutes: number, // default 20
    winnerThreshold: number    // e.g., 0.002 = +0.2%
  },
  hurdleFloor: {              // Shape-B
    enabled: boolean,
    byReason: {
      haiku_decision: { atrMultiplier: number },
      stagnation: { atrMultiplier: number }
    },
    default: { atrMultiplier: number },
    requireBenchPositive: boolean
  },
  swapWindow: {               // Shape-A
    enabled: boolean,
    capPerWindow: number,
    windowMinutes: number,
    countEmergencies: boolean  // default false
  }
}
```

## Illustrative archetype values (NOT calibrated)

| Archetype | forcedRotation | hurdleFloor (haiku/stag) | swapWindow |
|---|---|---|---|
| degen | enabled, 0.1%/3 ticks | 0.2 / 0.6 | 12 / 60min |
| momentum_chaser | enabled, 0.15%/3 ticks | 0.3 / 0.55 | 8 / 60min |
| analyst | enabled, 0.3%/6 ticks | 0.4 / 0.5 | 4 / 60min |
| diversifier | enabled, 0.3%/6 ticks | 0.4 / 0.5 | 4 / 60min |
| contrarian | enabled, 0.3%/6 ticks | 0.4 / 0.5 | 4 / 60min |
| guardian | disabled | 0.5 / 0.5 | 2 / 120min |

Note the corrected pattern: degen has LOW Haiku floor (0.2 — act on thin edges) and HIGH stagnation floor (0.6 — mechanical rotation needs quality bar).

## Key code anchors (from discovery audit)

| File | Lines | What |
|---|---|---|
| `agent-evaluate.js` | `:224` | `ctx.archetype` binding |
| `agent-evaluate.js` | `:637` | `evaluateRisk` call site (only one) |
| `agent-evaluate.js` | `:647-649` | `riskSwaps` push |
| `agent-evaluate.js` | `:657-752` | Risk-swap execution loop (Knob C in-loop binding location) |
| `agent-evaluate.js` | `:713` | `executeSwapServer` call from risk loop |
| `agent-evaluate.js` | `:747-748` | Battle doc re-read after each risk swap |
| `agent-evaluate.js` | `:760, :775, :800, :872, :1329` | 5 persistence return paths |
| `agent-evaluate.js` | `:1084` | post-Haiku swap execution (Knob B hook) |
| `agentRiskManager.js` | `:30` | `evaluateRisk` signature |
| `agentRiskManager.js` | `:35` | `bustBuffer` read |
| `agentRiskManager.js` | `:111-133` | `pickEmergencyReplacement` |
| `agentSwapExecution.js` | `:21-74` | `validateTradeDecision` (Knob B + C Haiku hook) |
| `agentSwapExecution.js` | `:43-49` | Cooldown block (Knob C pattern reference) |
| `agentSwapExecution.js` | `:61-64` | Conviction floor (Knob C Haiku block after this) |
| `agentSwapExecution.js` | `:172, :242-255` | `trades[]` write with swappedOutAt + reason |
| `agentArchetypeConfig.js` | various | Dead `riskOverrides` to delete; new `hftConfig` to add |
| `agentBattleService.js` | `:116` | `agent_context.archetype` persistence |

## Phase 8 sub-gates (behavioral verification)

### Mechanism gates (calibration-independent)

- **8C — Hurdle floor protection:** blocks at least one below-floor non-emergency swap; emergencies bypass every time; non-emergencies never bypass
- **8D — Circuit breaker protection:** blocks non-emergency swaps at cap; emergencies bypass; **within-tick binding catches bursts**
- **8E — No archetype inversion:** degen trades more than guardian; preset toggle doesn't change HFT knobs

### Calibration-dependent gates (pass after calibration tuning)

- **8A — Archetype divergence:** degen median ≥ 3× guardian non-emergency rotations
- **8B — Forced rotation prevalence:** degen stagnation 15-45% of rotations; guardian <5%

## Common pitfalls (silent-failure bugs)

1. **`battle.archetype` instead of `ctx.archetype`** → every archetype runs analyst physics
2. **Action-keyed bypass instead of reason-keyed** → Knob A forced rotations bypass Knobs B and C
3. **Missing guardrail reasons from bypass set** → stop-loss-breached positions stay parked
4. **Pre-computed Knob C count against frozen riskSwaps** → multiple forced rotations all pass in same tick
5. **Reviving dead `riskOverrides`** → sign/schema-incompatible values
6. **D2 without tick-age guard** → "3 ticks" can be 45min or 90min depending on data gaps
7. **D2 without winner suppression** → rotating out of winning positions consolidating

## Branch discipline

- Use `claude/forge-enforcement-keystone-implementation` (the task's explicit name)
- NEVER use session default branch name
- ONE branch through all 8 phases — do not branch off mid-implementation
- STOP between every phase for Flash approval
