# buildArenaModel — 4 failing tests — Phase A diagnosis (read-only)

**Date:** 2026-08-12
**Branch:** `claude/buildarenamodel-scoring-diagnosis` (cut fresh from `origin/main` `a17da59b`)
**Scope:** the 4 failures in `src/components/League/battleArena/buildArenaModel.test.js`
**Status:** Phase A complete — **read-only, no fix applied.** STOP for founder ruling before Phase B.

---

## Executive verdict

| | |
|---|---|
| **Root cause** | The feature flag `LEAGUE_LIVE_ORB_ENABLED` was flipped **false → true** in a deliberate flag-enable commit; the 4 flag-**off** behavioral tests were not reconciled, so they now fail. |
| **Which side moved** | The **flag** (not the implementation, not the test intent). The implementation's flag-**on** path is correct — the same file's 49 other tests pass, including all the live-orb math. |
| **The gate** | `LEAGUE_LIVE_ORB_ENABLED` — `src/config/featureFlags.js:282` (currently `true`). Read **correctly** at `buildArenaModel.js:115`. No gate-reading bug. |
| **User-visible defect today?** | **No — if the flip was intended.** With the flag on, ranked mode surfaces the live all-seats orb, which is the **designed** flag-on behavior (the feature enabled). The 4 failing tests are **stale flag-off expectations**. → LOW severity as a code defect; the real cost is a red `main`. |
| **Class** | Same as `WIRE_METRICS_ENABLED` (TASK 2): a deliberate flag flip that didn't reconcile its tests. These are **behavioral** tests, though, not `expect(FLAG).toBe()` pins — so the flag-pin guard does not catch them. |
| **Needs a ruling** | Was enabling the league live orb **intended for production now?** The two Phase-B fixes are opposite (reconcile the tests vs. revert the flag). |

---

## The 4 failing tests (all assert the flag-**off** contract)

| Test (`buildArenaModel.test.js`) | Asserts | Received (flag on) |
|---|---|---|
| `:261` — youLiveScore "is null in RANKED mode — Branch 1 is training-only" | `null` | `668.5` |
| `:399` — "ranked stays byte-identical — the orb never goes live" | `null` | a live score |
| `:580` — "a supplied liveComposites map is IGNORED off-gate" | `null` | `{u-riv:999, cpu-1:888}` |
| `:593` — "the decomposition is null … off-gate — even when the orb is LIVE (training)" | `null` | full decomposition object |

Their describe block names the premise: **`buildArenaModel — live orb flag gating (Option X, flag off = today)`** (`:575`), plus the ranked-banked assertions in the `youLiveScore` (`:200`) and `orb swap/drop-accurate` (`:329`) describes.

---

## Diagnostic questions (the brief's Phase A)

### 1. When did this start?
Commit **`2bd50fc9`** — *"Enable casual clone concurrency and league live orb"* (2026-08-11 09:46 −0500), body *"Updated feature flags to enable casual clone concurrency and league live orb."* `git log -S "LEAGUE_LIVE_ORB_ENABLED = true"` attributes the `= true` line to exactly this commit; it is a standalone flag-enable commit (parent `61bf6518` = Merge #738), on main's first-parent line, ancestor of current `a17da59b`. The Option-X feature and its flag-off tests were authored **dark** earlier — `efde337e` *"feat(league): Phase B-client — live all-seats orb, Option X (dark)"* and `7aaa2781` *"feat(league): Phase B decomposition — the orb, made legible (dark)"*.

**Proven causal (local experiment, reverted):** with `LEAGUE_LIVE_ORB_ENABLED` temporarily set to `false`, **all 53 tests pass**; with it `true` (current main), exactly these 4 fail. Nothing else moved.

### 2. Which side moved?
The **flag**. The implementation's flag-on path is behaving as designed and is independently verified correct — the 49 passing tests in the same file exercise the live-orb math under the flag-on state (the mock inherits the real flag; see Q3), e.g. *"§9: youLiveScore = computeComposite(…)"*, *"the orb ADDS exactly the sums"*, *"a dropped pick banked +M moves the orb by exactly 1.5×M"*. The 4 failing tests encode the flag-**off** gating contract (correct when the feature was dark) and were **not** updated when the flag flipped. The test file mocks featureFlags but only overrides `LEAGUE_AGENT_CHAT_ENABLED` — `vi.mock(..., importOriginal => ({ ...(await importOriginal()), get LEAGUE_AGENT_CHAT_ENABLED() {…} }))` (`:22-27`) — so `LEAGUE_LIVE_ORB_ENABLED` is inherited as its **real** value, and the flip reached the tests directly.

### 3. What is the gate, and is it read correctly?
`LEAGUE_LIVE_ORB_ENABLED` (`featureFlags.js:282` = `true`), read at `buildArenaModel.js:115` (`const liveOrbOn = LEAGUE_LIVE_ORB_ENABLED`) and consumed correctly at every branch:
- `rivalLive` (`:116`) — `liveOrbOn && liveComposites` → rivals live only when on (governs test `:580`).
- `modeAllowsLive` (`:261`) — `mode === 'training' || (liveOrbOn && mode === 'ranked')` → ranked live only when on (governs tests `:261`, `:399`).
- `decompLive` (`:378`) — `liveOrbOn && youOrbLive && youLiveScore != null` → decomposition only when on (governs test `:593`).

The gate is read correctly; the on-branch matches the design comments (`:250-252`, `:371-378`). There is **no gate-reading bug** — the failing assertions are simply the off-state, which is no longer today's state.

### 4. Is anything user-visible wrong today? (decisive)
**Not a defect, assuming the flip was intended.** With `LEAGUE_LIVE_ORB_ENABLED` on, ranked mode surfaces the live all-seats orb — rivals' live composites and the decomposition strip — which is exactly what the flag-on design intends (`buildArenaModel.js:252`: *"the banked-rivals climb was a §9 half-measure; the flag now brings rivals live"*). The live-orb values themselves are correct (verified by the 49 passing math tests under flag-on). So the 4 failures are **stale flag-off test expectations**, not a live behavior defect → **LOW** severity as a code defect.

The genuinely user-visible question is upstream: **was enabling the league live orb intended for production now?** The enabling commit bundled it with casual-clone-concurrency, and the feature/tests were authored "dark," which usually signals a deliberate *future* flip. If the flip was intended, ranked-live is the shipped feature and the tests are stale. If it was premature/accidental, the tests were correctly guarding and the live orb reached ranked users before it was ready — which would be a real (high-severity) behavior change that shipped early.

---

## Phase B — the opposite fixes (do not choose without the ruling)

- **If the flip was intended for production** → reconcile the 4 tests to the flag-**on** contract. Preferred shape: drive `LEAGUE_LIVE_ORB_ENABLED` through a test getter exactly like the existing `LEAGUE_AGENT_CHAT_ENABLED` idiom (`:21-27`) so **both** flag states are covered, rather than deleting the flag-off assertions and losing the off-state guard. (This is the `WIRE_METRICS_ENABLED` / TASK 2 resolution pattern, applied to behavioral tests.)
- **If the flip was premature/accidental** → revert `LEAGUE_LIVE_ORB_ENABLED` to `false` (the tests were correctly guarding); the live orb returns to dark until a deliberate, test-reconciled flip.

## Process note (for the same standing convention TASK 2 adds)
This is the second live instance of the class in one review pass (`WIRE_METRICS_ENABLED` + `LEAGUE_LIVE_ORB_ENABLED`). The flag-pin guard (`flagPinGuard.test.js`) catches `expect(FLAG).toBe()` pins but is structurally blind to **behavioral** tests that inherit a flag via `importOriginal` and assert the off-state. "Flip and pin travel together" should be read to include behavioral tests, not just literal pins — otherwise a deliberate flip silently reddens `main` through a behavioral suite the guard cannot see.
