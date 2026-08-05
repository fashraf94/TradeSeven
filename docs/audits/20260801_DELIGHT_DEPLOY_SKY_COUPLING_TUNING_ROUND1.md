# Delight Layer · Task 4 — Feel-pass tuning round 1

**Date:** Aug 1, 2026 · **Branch:** `claude/delight-deploy-sky-coupling-0q1kc6` · **Phase:** 1 (Phase 2 not started).
**Authority:** founder feel pass, round 1 (T1, T2, T3). All values tuning-exempt — spec V2 §4 D2 (Task 2 tiers) and spec V1 D2 (Task 4 intent curve). No spec re-version required.

**Supersedes** the tuning table in `20260801_DELIGHT_DEPLOY_SKY_COUPLING_PHASE1_BUILD_REPORT.md` §2, which records the as-built Phase 1 values and is left unedited (audit records are immutable once added). **This document holds the current values.**

---

## 1. What changed

| # | Constant | Was | Now | Founder rationale |
|---|---|---|---|---|
| T1 | `INTENT_CURVE_EXPONENT` | `2.5` | `1.2` | The ramp must begin responding the instant the press starts; at 2.5 the first half of the hold was effectively dead (18% of peak at halfway). 1.2 keeps a little late steepening while making the start immediate. |
| T2 | `INTENT_PEAK` | `1.4` | `1.8` | The top of the ramp needs more authority. Still below `SPEED_ENDGAME_PEAK` 2.2 per D2. |
| T3 | `SPEED_RESTING` | `0.12` | `0.08` | Perceived motion compresses at low speeds, so a 4× multiple didn't read as 4×. Lowering resting also honours R-REST more faithfully. |
| T3 | `SPEED_LIVE` | `0.5` | `0.7` | Same — widen the RESTING→BATTLE LIVE gap so BATTLE LIVE reads as clearly different. |

RESTING→BATTLE LIVE ratio: **4.2× → 8.75×**. Resting star traversal: ~91s → **~136s** per star (the `Z_RATE` docstring moved with it).

D2 bounds still hold and are still pinned by a test row: `SPEED_LIVE 0.7 < INTENT_PEAK 1.8 < SPEED_ENDGAME_PEAK 2.2`.

## 2. Measured effect — when the hold becomes visible

The number that matters for T1 is **how much of the 1300ms press elapses before the sky is doing something you can see**. Because intent is `max(coreSpeed, curve)`, that depends on the tier the sky is already in:

| Sky is at | Before (peak 1.4, exp 2.5) | **After (peak 1.8, exp 1.2)** |
|---|---|---|
| RESTING | 37.4% of the press — **487ms** | **7.5% — 97ms** ✅ |
| BATTLE LIVE | 66.2% — 861ms | **45.5% — 592ms** ⚠️ |
| ENDGAME floor (0.8) | 79.9% — 1039ms | 50.9% — 661ms |
| ENDGAME peak (2.2) | never (by design, D2) | never (by design, D2) |

Curve shape, as fraction of peak delivered:

| progress | old (2.5) | **new (1.2)** | linear |
|---|---|---|---|
| 10% | 0.003 | **0.063** | 0.100 |
| 25% | 0.031 | **0.189** | 0.250 |
| 50% | 0.177 | **0.435** | 0.500 |
| 66.7% | 0.363 | **0.615** | 0.667 |
| 90% | 0.768 | **0.881** | 0.900 |

Every interior point still sits **below** the linear line, so the curve remains convex and the late steepening the threshold feeling depends on survives — now pinned by its own row.

## 3. The one thing to judge in round 2

**T1's goal is met at rest and only partly met during a live battle.** From RESTING the ramp now starts at ~97ms — genuinely immediate. From BATTLE LIVE it does not clear the floor until **~592ms, 45% of the press**: the first fifth of a second reads as responsive at rest and the first half-second reads as dead mid-battle.

This is the interaction the founder predicted, and it is correct behaviour — `max()` with a higher floor, exactly as Amendment C requires. It is also larger than "slightly": T3 raised the floor 40% (0.5 → 0.7) while T2 raised the ceiling only 29% (1.4 → 1.8), so the live-battle crossover moved *less* than the at-rest one.

**If round 2 wants the live-battle ramp to start as early as the at-rest one, the lever is `INTENT_PEAK`, not the exponent.** Indicative crossovers during a BATTLE LIVE sky (0.7), holding exp at 1.2:

| `INTENT_PEAK` | live-battle crossover | headroom under 2.2 |
|---|---|---|
| 1.8 (now) | 45.5% — 592ms | 0.4 |
| 2.0 | 39.6% — 515ms | 0.2 |
| 2.1 | 37.0% — 481ms | 0.1 |

The D2 ceiling (2.2) bounds how far this can go, so a live-battle start under ~35% is not reachable by peak alone. If the founder wants parity at both tiers, that is a design question for a later round — the honest options would be scaling the curve against the *current* tier speed rather than absolute speed, which is a change to Amendment C's shape and would need a ruling.

**Recommendation:** judge 1.8 on the preview first. If the live-battle hold still reads soft, try 2.0 before anything structural.

## 4. Pins moved in the same commit

Per the BUILD_RULES §2/§11 discipline (a tune moves every assertion and docstring that pins the old value, in the same commit):

- `warpStateMachine.js:27-28` — module-header State Map table (0.12/0.5 → 0.08/0.7).
- `warpStateMachine.js:94` — `Z_RATE` docstring (~92s → ~136s per star at rest).
- `warpStateMachine.js:66-74` — `SPEED_RESTING`/`SPEED_LIVE` with the T3 rationale.
- `warpStateMachine.js:128-156` — `INTENT_PEAK` (`:136`) / `INTENT_CURVE_EXPONENT` (`:156`) docstrings rewritten, including the tier-interaction note.
- `warpStateMachine.test.js` — the old "gentle through the first two-thirds" row encoded the *rejected* shape and would have failed. Replaced by two rows that pin what was actually ruled: **convexity** (late steepening still exists) and **the RESTING sky lifts within the first 15% of the press** (T1's requirement, in perceptual terms).

Every Task-2 tier row asserts against `WARP_TUNING.SPEED_*` **by reference**, not by literal, so T3 needed no test edits — the ratio-based rows (ease, ramp, decay, monotonicity) all still hold.

## 5. Verification

- Mutation-checked, each reverted after: exponent back to 2.5 → the T1 row fails; exponent 1.0 (linear) → the convexity row fails; peak 2.5 → the D2 bound row fails. Each fails **only** its own row.
- Starfield suites: 174 passed (7 files). Full suite: **6709 passed / 53 skipped / 0 failed** (383 files). `eslint` clean.
- Flag posture unchanged: `DEPLOY_SKY_COUPLING_ENABLED = false`, preview via `?deploySkyCoupling=1`. **Note T3 ships in the LIVE Task-2 starfield** — `STARFIELD_BACKGROUND_ENABLED`/`STARFIELD_MOBILE_ENABLED` are both true, so the RESTING/BATTLE LIVE change is visible in production on merge, independent of the coupling flag. T1/T2 remain dark.
