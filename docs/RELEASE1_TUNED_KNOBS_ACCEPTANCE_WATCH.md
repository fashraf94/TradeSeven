# Release 1 — Tuned Knob Values Landing: Acceptance & Watch Record

**Date:** 2026-07-08 · **Branch:** `claude/release-1-tuned-knob-values-7d3xlt`
**Spec:** Release 1 Build Spec V1.1 (Tuned Knob Values Landing) · **Fence auth:** spec §3
**Basis:** `20260704_KNOB_CALIBRATION_B4_ACCEPTANCE_REPORT.md` (the B4 acceptance report, PROVISIONAL values)
**Category:** LIVE-DEFAULT — changes every standard-dial degen & momentum_chaser agent on merge.

This is the "§4 thresholds + §5 plan in hand" artifact the LIVE-DEFAULT merge (Phase 3) requires. It is a **living operational record**: the frozen baseline (§5.1) and watch results are appended at their phases.

---

## 1. What landed (the fenced values)

Landed in `api/_utils/agentArchetypeConfig.js` (the single §3-authorized fenced file):

| Archetype | Knob | Change |
|---|---|---|
| degen | `hurdleFloor.stagnation.atrMultiplier` | 0.6 → **0.3** |
| momentum_chaser | `forcedRotation.ticksThreshold` | 3 → **5** |
| momentum_chaser | `swapWindow.capPerWindow` | 8 → **6** |
| momentum_chaser | `hurdleFloor.haiku_decision.atrMultiplier` | 0.3 → **0.35** |
| momentum_chaser | `hurdleFloor.stagnation.atrMultiplier` | 0.55 → **0.5** |
| momentum_chaser | `hurdleFloor.default.atrMultiplier` | 0.3 → **0.35** |
| — | `KNOB_CONFIG_VERSION` | new `= 2` (monotonic; rollback → v3) |

Rationale anchor (B4 §F3): the degen 0.6→0.3 drop is a **deliberate identity-rationale evolution** (the Speculator refuses boring), not a gate-compelled tuning artifact — the ratio gates passed at the shipped values too. Shape-B survives directionally (degen stagnation 0.3 > degen haiku 0.2); Knob C's cap (12/60min) remains the churn ceiling.

---

## 2. §4.3 acceptance bands — pinned from B4 (2026-07-04)

**Important — what B4 provides.** B4's real per-archetype tempo numbers are **"pending live export"** (B4 lines 15, 45, 56); the sandbox has no DB creds (B4 line 110), so **absolute tempo centers do not exist in B4**. B4 pins **relational** bands (ratios, shares, ordering) verified on the synthetic gate-replay harness. Per B4's own cross-check framing (lines 103–115), the pre-change real battles *validate direction + set the baseline, not the deltas*; the **post-landing re-run** is the true confirmation. This **supersedes the spec §4.3 "[B4 center ± tol]" absolute-center framing** — which cannot be honored because those numbers aren't in B4 and would be fabrication. The relational bands below are the measurable §4.3 acceptance criteria, and every one is derivable from `aggregate-real-battles.js`.

| # | B4 band (pinned) | Grade | B4 source | Measured from (`aggregate-real-battles.js`) |
|---|---|---|---|---|
| B4-1 | **degen ÷ mc tempo ratio ∈ [2.08, 2.25]** (named: degen÷mc ≥ ~2) | **diagnostic** (flag-and-look) | line 56 | `perArchetype.{degen,momentum_chaser}.nonEmergencyRotationsPerBattle.median` |
| B4-2 | **degen ≥ 3× guardian** (median non-emergency rotations) | **gate-grade** | line 56 | same field, degen vs guardian |
| B4-3 | **mc ≥ 1.5× guardian** | **gate-grade** | line 56 | same field, mc vs guardian |
| B4-4 | **8B stagnation share: degen 15–45%, guardian <5%, analyst < degen** | **diagnostic** | line 57 | `perArchetype.*.stagnationSharePct` (+ `unknownReason.sharePctOfNonEmergency` quoted beside it) |
| B4-5 | **Ordering (named acceptance check): degen ≫ mc > analyst≈diversifier≈contrarian > guardian** | **gate-grade** | line 63 | `tempoOrdering` |

**Grade (founder ruling, 2026-07-08).** The **gate-grade** relational checks — the ones that gate promotion — are the **ordering (B4-5)** plus the **≥3× / ≥1.5× thresholds (B4-2, B4-3)**. The **degen÷mc ratio (B4-1)** and the **8B stagnation share (B4-4)** are **diagnostic (flag-and-look)**: reported and flagged if off, but never a promotion gate or a revert trigger — live regime can move them legitimately.

**Directional expectation (not an absolute band — the centers are ~0 pre-change):** the frozen baseline (§5.1) will show degen & mc tempo ≈ 0 (the "zero floor"). Post-landing, both move **up off zero**: degen strongly, mc **less** (the tempering). The **§4.3 acceptance is the gate-grade set** — the ordering holds (B4-5) and degen ≥3× / mc ≥1.5× guardian (B4-2/B4-3) — evaluated on wholly-contained battles at v2 against the frozen v-pre baseline. The degen÷mc ratio landing in [2.08, 2.25] is **diagnostic color** on top of that, not itself a gate.

**Caveat carried from B4 (lines 29, 57, 113):** the 8B share and any tempo count inherit the **unknown-reason inflation** risk (pre-V1.4 `exitReason` default-denied to non-emergency). The aggregator surfaces `unknownReason.sharePctOfNonEmergency` per archetype; if that share is material, treat the tempo/8B read as provisional until the taxonomy is reconciled.

---

## 3. §4 trigger table (SET BEFORE MERGE) — split by response type

**Standing rule:** every trigger below is measurable from `aggregate-real-battles.js` + receipts by merge day. Unmeasurables are dropped (win/loss volatility: cut).

### 3.1 HARM triggers → REVERT (roll back to v3)

| Metric | Band / trigger | Measured from |
|---|---|---|
| **Swap-cap pinning** (live-anchored runaway) | mc (or degen) reaches `capPerWindow` in **≥50% of cap-subject rolling windows** across **≥2 consecutive sessions** | `perArchetype.*.swapCapPinning.pinnedSharePct` (≥50), sustained ≥2 sessions |
| Tempo runaway vs B4-synthetic | any changed archetype **> 3× its B4-synthetic tempo**, sustained ≥2 sessions | tempo median vs B4 expectation (regime guard: single volatile sessions don't count) |
| Unchanged-archetype movement | material tempo or exit-rate shift in **analyst / diversifier / contrarian / guardian**, sustained ≥2 sessions | their `nonEmergencyRotationsPerBattle` / `emergencyBypass` — knobs didn't move, so movement = unexpected interaction |
| Sector concentration | rise **> +10pp** median top-sector weight vs baseline, sustained *(provisional magnitude — confirm/adjust against the frozen baseline distribution at §5.1)* | portfolio top-sector weight from receipts/holdings |
| Failed-eval rate | any rise attributable to the config change | `cronState.cronErrors` / failed-eval receipts |

### 3.2 NO-EFFECT triggers → STOP-AND-DIAGNOSE (do NOT revert)

| Metric | Trigger | Diagnose |
|---|---|---|
| degen/mc tempo unchanged | median non-emergency rotations still ~0 after the N-gated window | values not deployed, resolve-path issue, generation mis-bucketing, or flat-tape regime |
| Bands missed low | tempo far below the B4 ratio/ordering expectation | same path; check a volatility read before concluding plumbing |

Reverting a config that had **no effect** fixes nothing — diagnose first (§4.2 of the spec).

---

## 4. §5 watch window (the promotion gate)

**Tick-time reality (PROVEN, spec §2.1):** knob values resolve from the deployed module at each tick (`agent-evaluate.js:52 → :1003 getArchetypeConfig(ctx.archetype) → :1011 resolveHftConfig → agentArchetypeConfig.js:218`); the battle snapshot freezes only the archetype **name** (`agentBattleService.js:152`). So a merge/rollback flips in-flight battles at their **next tick**. Attribution therefore uses **wholly-contained** battles only (created AND completed within one generation).

1. **Freeze the baseline pre-merge (§5.1).** Immediately before merging, run — *Flash runs this; sandbox has no DB creds (B4 line 110):*
   - `node scripts/calibration/export-agent-battles.js` → `export.json`
   - `node scripts/calibration/aggregate-real-battles.js --input export.json --format json --out baseline_v-pre.json`
   Pin `baseline_v-pre.json` into this record (§6 below) — the saved "before" artifact, NOT a later reconstruction. Confirm the B4-5 ordering-direction holds on real data and the unknown-reason share is small (B4 line 113 acceptance).
2. **Merge after market close** — the generation boundary aligns with a session boundary, cleanly containing all 1-day battles on both sides.
3. **Post-merge attribution:** run the aggregator with `--generation-boundary <the after-close merge timestamp, ISO>`; the promote/revert comparison uses only wholly-contained battles per generation. Straddlers/in-flight are auto-excluded and tallied.
4. **Monotonic versioning:** merge = **v2**. If reverted, the revert deploy = **v3** (never back to v1).
5. **N-gated window:** closes when **≥ N = 10 wholly-contained completed battles per changed archetype** (degen, mc) exist at v2. *(N is a Phase-1 judgment: B4 flagged the real corpus (~22 total, all archetypes) as too thin for per-archetype significance (B4 lines 29, 123); 10 wholly-contained per changed archetype is the minimum for a stable median. Flash may adjust.)* cpu-opponent and player-opponent battles **both** count toward N and toward the promote/revert decision (knob physics are opponent-independent); the aggregator splits them and flags material tempo divergence for investigation only.
6. **Promotion:** the **gate-grade** checks pass — ordering (B4-5) + degen ≥3× guardian (B4-2) + mc ≥1.5× guardian (B4-3) — **and** no HARM trigger → PROVISIONAL → **CALIBRATED**. The diagnostic bands (degen÷mc ratio B4-1, 8B share B4-4) are reported and flagged if off but do **not** block promotion (live regime can move them legitimately). Release 2's dial bands (multipliers 0.7/1.0/1.3, B4 §D) are then authored against confirmed values.
7. **Revert:** HARM trigger → revert PR (v3), diagnose against the harness, re-tune. **No-effect** → diagnose without reverting.

---

## 5. Phase 3 readiness checklist

| Step | Owner | Status |
|---|---|---|
| Values + `KNOB_CONFIG_VERSION` landed, tested, pushed | done | ✅ commit `ce740c0` |
| Aggregator watch tooling (generation / wholly-contained / cap-pinning / opponent split) + fixture tests | done | ✅ |
| Verification script green (resolve==B4 table both modes; bucketing dry-run) | done | ✅ 19/19 |
| Full suite green | done | ✅ 212 files / 4152 passed |
| §4.3 bands pinned from B4; §4 trigger table + §5 watch plan | done | ✅ this doc |
| `/code-review` | n/a | not mandatory — 8 files / ~526 lines < the ≥10-file/≥1500-line threshold |
| **Baseline freeze run (§5.1)** | **Flash** | ⏳ needs DB creds (sandbox has none) |
| Founder smoke | Flash | ⏳ |
| PR | on founder request | ⏳ |
| **LIVE-DEFAULT merge, after market close** | **Flash (founder-gated)** | ⏳ |
| Post-landing re-run (true delta confirmation) | Flash (scheduled) | ⏳ post-merge |

---

## 6. Frozen baseline (§5.1) — TO BE APPENDED at the pre-merge run

*(Placeholder for the saved `baseline_v-pre.json` numbers — degen/mc/guardian median non-emergency rotations (~0 expected), 8B stagnation shares, emergency-bypass by reason, unknown-reason share, top-sector weight. Pinned here by Flash immediately before the after-close merge. This is NOT a band placeholder — it is the deliberate §5.1 pre-merge freeze step.)*
