# Forge Enforcement Keystone — Phase 8 Calibration Plan (gates 8A / 8B, §6.3)

**Status: PLAN ONLY. These gates do NOT pass in Phase 8 and no green cells are
fabricated here.** Phase 8 splits into two halves that must not be conflated:

- **MECHANISM (8C / 8D / 8E)** — calibration-independent, verified NOW by
  `api/_utils/keystoneGate8.test.js` + the Phase-7 matrix
  (`api/_utils/invariant1Matrix.test.js`). Passing 8D/8E is the mechanism
  merge-unblock signal. (8C is a recorded coherence FINDING — see §6 below.)
- **CALIBRATION (8A / 8B)** — *behavioral* gates that require real battle data and
  a prerequisite production change. They are **post-merge, pre-launch** work. This
  document is their executable plan; running them is out of scope for Phase 8.

The launch-seed knob values are explicitly ILLUSTRATIVE and differentiated
(`agentArchetypeConfig.js:17-20`); 8A/8B are where they get tuned against reality.

---

## 1. Gate 8A — active-trading frequency ordering (verbatim criteria)

Over a representative window of completed battles, the **median non-emergency
rotations per battle** must satisfy:

- **degen ≥ 3× guardian**
- **momentum_chaser ≥ 1.5× guardian**
- **guardian is the lowest** of all archetypes.

"Non-emergency rotation" = a `trades[]` entry whose `exitReason ∉
EMERGENCY_BYPASS_REASONS` (i.e. `stagnation`, `haiku_decision`,
`gameplan_rotation`, or any unknown/missing reason — the same default-deny set the
gates enforce).

## 2. Gate 8B — stagnation-rotation share (verbatim criteria)

Within each archetype's non-emergency rotations, the **stagnation fraction**
(`exitReason === 'stagnation'` ÷ all non-emergency) must satisfy:

- **degen: 15–45%** of degen non-emergency rotations.
- **guardian: < 5%** (forced rotation is disabled for guardian, so stagnation
  rotations should be near-zero — any are residual/legacy).
- **analyst: below degen** (analyst's `ticksThreshold` 6 and floor 0.5 are
  stricter than degen's 3 / 0.6-vs-0.2-default, so it should rotate on stagnation
  less often).

---

## 3. Hard dependencies — BOTH must land before 8A/8B can be trusted

### (a) Bench-staleness rescore (V1.2 workstream b)

Bench **prices** ARE refreshed every tick — the cron fetches all bench symbols
with `forceRefresh: true` (`api/cron/agent-evaluate.js:248-255`). The staleness is
**not** in live price; it is in two stored, once-daily quantities:

1. **Candidate-selection rankings.** The `indexIntelligence/stockRankings` doc that
   drives bench candidate selection is computed once daily and never rescored
   intraday (~17.5–24h data age; ~43% selected-candidate change rate under
   realistic drift — `BENCH_STALENESS_VERIFICATION_REPORT.md:81-90,147-148`).
2. **Bench `baseATR`.** Set at swap-in and not rescored daily
   (`api/_utils/agentSwapExecution.js:192`). The hurdle floor and the trigger gate
   both divide by this volatility unit, so until it is rescored, hurdle/stagnation
   behavior on bench candidates is measured against **stale volatility**.

Because Knob B's floors are ATR-margin floors, calibrating them on stale `baseATR`
risks tuning to an artifact. **Rescore must land first**, or 8A/8B results are
provisional.

### (b) A real post-merge battle-data window + an aggregation script

The data shape already exists: completed battles live in the `agentBattles`
collection; each swap is appended to `battle.trades[]` with top-level
`exitReason` and `swappedOutAt` (ISO) via the `...evaluationMetadata` spread in
`executeSwapServer` (`api/_utils/agentSwapExecution.js:172-177`), and the battle's
archetype is on `battle.agentContext.archetype`
(`api/cron/agent-evaluate.js:226`; written by `agentBattleService.js:116`).

**But no cross-battle trade-stat aggregation script exists yet** — `api/scripts/`
has migration/voice/test scripts only. It must be built (greenfield). Battle count
`n` is small/unverified from here; **confirm a representative `n` post-merge**
before reading medians.

> NOTE: per-trade `archetype` (from `buildSwapReceiptSource`) is `null` for every
> non-archetype swap, so it CANNOT be the aggregation key. Key off the battle's own
> `agentContext.archetype`, which is present for all trades in the battle.

---

## 4. Calibration anchor (discovery report §:347)

Record explicitly: **the shipped floor/cap VALUES assume the current,
pre-rescore bench-freshness regime.** They are an internally-consistent launch
seed, not a measured optimum. After the §3(a) rescore lands, **re-run 8A/8B** and
re-tune — or, until then, flag every shipped floor/cap value as **provisional**.
Calibrating before the rescore bakes the staleness into the knobs.

---

## 5. Method sketch (for the future aggregation script)

1. Query `agentBattles` for completed battles in the target window.
2. Group by `battle.agentContext.archetype`.
3. For each battle, partition `battle.trades[]`:
   - `nonEmergency` = trades with `exitReason ∉ EMERGENCY_BYPASS_REASONS`
     (import the constant from `agentRiskManager.js` — do not re-list it).
   - `stagnation`   = trades with `exitReason === 'stagnation'`.
4. Per archetype, compute the **median** `nonEmergency.length` per battle (8A) and
   the **stagnation ÷ nonEmergency** fraction (8B).
5. Assert the §1 ordering (8A) and the §2 bands (8B). A miss is a **calibration
   finding** (re-tune the knob), not a mechanism bug — the mechanism is already
   proven by 8C/8D/8E + the matrix.

---

## 6. Cross-reference — the 8C coherence FINDING (open, escalated)

8C is **not** a calibration gate; it is a §7.1 cross-component **coherence**
finding recorded as a delete-on-unification tripwire in
`api/_utils/keystoneGate8.test.js`. The pre-Haiku **wake** trigger
(`agentTriggerGate.js:104`) uses a bench-ONLY margin `changePct / baseATR`, while
the hurdle **floor** uses the bench-MINUS-active `computeBenchVsActiveMargin`. They
diverge ("woken by formula X, blocked by formula Y"). Every 8C *safety* clause
already passes; only the coherence clause fails.

This is an **open design question**, escalated, not actioned in Phase 8. Two
legitimate resolutions — to be decided in a reviewed production change, with its
own trigger-threshold re-calibration if (a) is chosen:

- **(a) Unify:** extract one formula and have the trigger gate consume the helper,
  then re-calibrate the trigger threshold (`0.5`, currently tuned to the inline
  bench-only form). The tripwire test flips and is deleted as part of that change.
- **(b) Document-as-intended:** formally record that trigger-**wake** (a bench-only
  *should I look?* signal) and hurdle-**allow** (a relative-advantage *should I
  swap?* signal) are deliberately different, and amend 8C's parity clause.

Either is defensible; the decision is the escalation, not Phase-8 work.

---

## 7. Exit criteria for the calibration half (post-merge)

8A and 8B PASS **during calibration (post-merge, pre-launch)**, after:
the §3(a) bench rescore has landed, the §3(b) aggregation script is built against a
confirmed-representative `n`, and the §1/§2 thresholds are met (re-tuning knob
values as needed). Only then are the shipped floor/cap values promoted from
provisional to calibrated.
