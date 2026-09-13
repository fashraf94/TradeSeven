# F1 — AnimatedScore's flash-clear timer no longer outlives the component

**A two-line leak fixed, and the two adjacent leaks it exposed reported rather than quietly absorbed.** Branch `claude/fix-animatedscore-timer` cut fresh from `origin/main` @ `1c4a8d3b`, clean tree. Code commit `8caca216`; this record follows in a second commit on the same branch. `git fetch origin` ran as the session's first step (§3) and **mattered**: it moved `origin/main` `0e04833d..1c4a8d3b`, so the branch is cut from the real tip rather than a stale ref.

**Fence statement (§1):** **zero fenced files touched.** The change is confined to `src/components/shared/`; no fenced function was called or edited. Verified mechanically against the full §1 list, not by eye — see §7.

---

## 1. Executive verdict

| Item | Status |
|---|---|
| The F1 defect | **FIXED** — handle held in a ref (`AnimatedScore.jsx:18`), cleared in an effect cleanup (`:28`), captured at the arming site (`:66`) |
| Failing-first test | **SHOWN RED FIRST** — exit code **1**, 2 rows red on the unfixed component, then exit **0** after the fix |
| Mutation check (§2) | **BOTH mutations redden the guard** — deleting the cleanup, and dropping the ref assignment while keeping the cleanup |
| Vacuous-guard audit | **One row proved vacuous and is labelled as such** — React 19 is silent on post-unmount `setState`, so `not.toThrow()` / `console.error` cannot catch this bug. The teeth are elsewhere (§4) |
| Full suite, 3× `--maxWorkers=2` | **exit 0 on all three** — `656 passed \| 3 skipped (659)` files, `12371 passed \| 64 skipped (12435)` tests, identical every run (§6) |
| `vite build` | **exit 0**, 27.87s |
| ESLint (changed files) | **exit 0** |
| Scope | 2 code files, +196/−1 (plus this record). Under the §2 review threshold (≥10 files OR ≥1500 lines), so the mandatory adversarial review is **not** triggered |
| Adjacent defects found | **2 reported, 0 fixed** (§5) — per §3, "report it for separate tasking; do not fix it" |
| Deviation from the literal prompt | **1, stated plainly** (§3) — cleanup scoped to unmount, not hung on the `[value]` effect |

---

## 2. The defect, and why it was real in production

`AnimatedScore` ends its value-change ramp by arming a timer that clears the green/red flash:

```js
// BEFORE — AnimatedScore.jsx:55
setTimeout(() => setFlash(null), 300);
```

The handle was never captured and the effect returned no cleanup function, so the callback stayed armed on a dead component when the user navigated away inside that 300 ms window — a queued state update on unmounted state, plus a closure retained over the component's scope until the clock caught up. **VERIFIED** at `AnimatedScore.jsx:55` (pre-fix line numbering).

This is not theoretical. The component renders on exactly the surfaces where scores tick and users navigate away mid-tick — all **VERIFIED** in this session:

| Consumer | Anchor |
|---|---|
| `DashboardBattleCard` (two instances) | `src/components/Dashboard/DashboardBattleCard.jsx:162`, `:180` |
| `AgentBattleScreen` (two instances) | `src/screens/AgentBattleScreen.jsx:328`, `:382` |
| `ArenaHeader` (two instances) | `src/screens/battleView/ArenaHeader.jsx:228`, `:289` |

A score flashes, the user taps back within 300 ms, and the timer fires into nothing.

## 3. The fix — and the one deviation from the literal prompt

```js
const flashTimer = useRef(null);                                   // :18
useEffect(() => () => clearTimeout(flashTimer.current), []);       // :28
...
flashTimer.current = setTimeout(() => setFlash(null), 300);        // :66
```

The prompt said "clearTimeout it in **the effect's cleanup**", whose most literal reading is the existing `[value]` effect. **I did not do that, and this is the one place I departed from the brief.** The reason is a regression that reading would have introduced:

A cleanup on the `[value]` effect runs on **every** value change, not just unmount. The effect has an early return at `AnimatedScore.jsx:52` — `if (Math.abs(diff) < 0.01) return;` — that arms no replacement timer. So a sub-0.01 value change arriving inside the 300 ms window would cancel the pending clear and arm nothing in its place, **stranding the flash lit** until the next material change. The fix would have introduced a new visible bug.

An unmount-scoped cleanup (`[]` deps) fixes F1 completely — which is precisely what the task title asks, "clear AnimatedScore's timer on unmount" — while changing **nothing** about mounted behaviour, so it carries no regression risk. The trade-off is recorded in-code at `AnimatedScore.jsx:24-27` so the next reader does not "helpfully" move it onto the `[value]` effect and reintroduce the stranding.

Flagging rather than relitigating, per the preamble to BUILD_RULES. **If you would rather have the literal `[value]`-effect cleanup, it needs the stranded-flash path handled in the same change — say so and I will build that instead.**

## 4. The test, and an honest account of what each row can and cannot catch

`src/components/shared/AnimatedScore.unmount.test.jsx` (new, 3 rows). Follows the repo's existing mount convention — `@vitest-environment jsdom`, `act` from `react`, `createRoot`, no Testing Library (it is not a dependency).

**A measured finding reshaped this file.** I probed the environment before writing assertions rather than assuming, and at **react 19.2.4 / vitest 4.0.17** a post-unmount `setState` is a **silent no-op**: the armed callback runs, `setFlash` is called on the unmounted component, and `console.error`, `console.warn` and `throw` are **all** silent (0 calls). So the obvious instruments — `expect(...).not.toThrow()` and a `console.error` spy — **cannot fail under this defect**. Per §2, "a row that cannot fail under the defect it names is not a guard," so they are kept only as forward-guards and **labelled as such in the file**, never presented as the thing that catches F1.

The teeth observe the timer itself:

| Row | What it asserts | Pre-fix |
|---|---|---|
| `arms the flash-clear once the ramp completes` | Preconditions read **off the DOM**: text is `+20` (ramp reached `p === 1`, so `:66` executed) and the flash colour is still applied (window genuinely still open). Then mounted-and-left-alone, the timer does its job | green (precondition row) |
| `clears the flash-clear timer when unmounted inside the 300 ms window` | **(1)** `vi.getTimerCount() === 0` after unmount — the update is not merely harmless but *unreachable*; **(2)** the armed callback never executes — "no state update", read directly | **RED ×2** |
| `FORWARD-GUARD ONLY` | no `console.error` across unmount + drain — explicitly documented as unable to fail under F1 today | green (by design) |

Two details that keep the file from passing for the wrong reason:

- **`getTimerCount() === 1` alone would be ambiguous.** A still-running rAF ramp *also* counts as one pending timer, so a test that never reached `:66` would sail through the post-unmount rows. The DOM preconditions rule that out before unmounting.
- **The 300 ms instrument is scoped to 300 ms.** The `setTimeout` spy wraps only calls at exactly that delay — the component's flash-clear is the sole timer there — so React's own internal timers cannot inflate the count.
- Colour expectations are **derived** from the hex constants rather than written out a second time, so expectation and value cannot drift (§9).

Precedent for the shape: `src/components/League/battleArena/useSessionCompositeTrail.test.jsx:224-230`, "clears its timer on unmount (no orphaned clock)".

### Red-first evidence (exit code 1)

```
 ✓ arms the flash-clear once the value-change ramp completes
 × clears the flash-clear timer when unmounted inside the 300 ms window
 × a value change clears the PREVIOUS flash-clear instead of letting it fire
 ✓ FORWARD-GUARD ONLY — silent on React 19, kept for a future React that is not

AssertionError: unmount must leave no orphaned timer: expected 1 to be +0
AssertionError: the new flash must survive the old timer: expected 'rgb(148, 163, 184)' to be 'rgb(94, 234, 212)'
 Tests  2 failed | 2 passed (4)   → exit 1
```

The second failure is the supersession flicker described in §5; that row was **removed** rather than shipped, for the reason given there.

### Mutation check (§2)

| Mutation | Result |
|---|---|
| Delete `useEffect(() => () => clearTimeout(...), [])` | **RED** — `expected 1 to be +0`, exit 1 |
| Keep the cleanup, drop `flashTimer.current =` at the arming site | **RED** — `expected 1 to be +0`, exit 1 |

Both reduce to the same message, which is the point: the guard tracks *the timer surviving unmount*, not the shape of the code.

## 5. Adjacent defects — REPORTED, NOT FIXED (§3)

Both surfaced while building the test. Neither is fixed here.

**A. The `requestAnimationFrame` ramp is never cancelled.** The effect calls `requestAnimationFrame(tick)` (`AnimatedScore.jsx:46`, `:69`) and never `cancelAnimationFrame`. Unmounting **mid-ramp** therefore lets the loop keep ticking on a dead component, reach `p === 1`, and arm a *fresh* flash-clear **after** the unmount cleanup has already run — so that path still leaks. **This is how I found it:** my first draft included a mid-ramp unmount row, and it stayed red after the F1 fix. Rather than widen the fix past its brief, the row was removed and the limit documented in the test header. *Consequence: F1 closes the ramp-completed path, not the mid-ramp path.*

**B. A superseded flash-clear fires into the next animation.** Because the cleanup is unmount-scoped (§3), a clear armed by one animation is not cancelled when a new value arrives inside its 300 ms window: it fires partway through the new ramp and nulls that flash early — a visible flicker back to the resting colour while the number is still climbing. Demonstrated live in the red-first run above. Fixing it means cancelling on value change too, which re-opens the stranded-flash hazard of §3, so it needs its own task and a decision on the sub-0.01 path.

Neither is pinned as a test row: asserting today's wrong behaviour would redden the moment someone fixes it.

## 6. Full suite — three runs at `--maxWorkers=2`

Run on the FINAL tree — the same two file hashes for all three runs, recorded at run time so the
record cannot be confused with an earlier draft:

```
1838e63d5399d84fb70728fc97d77a096f6cf2b8  src/components/shared/AnimatedScore.jsx
3af9ed0b6ab6bd6effcab35273dcd3eea72d8604  src/components/shared/AnimatedScore.unmount.test.jsx
```

| Run | Exit code | Test Files | Tests | Duration |
|---|---|---|---|---|
| 1 | **0** | 656 passed \| 3 skipped (659) | 12371 passed \| 64 skipped (12435) | 172.97s |
| 2 | **0** | 656 passed \| 3 skipped (659) | 12371 passed \| 64 skipped (12435) | 172.07s |
| 3 | **0** | 656 passed \| 3 skipped (659) | 12371 passed \| 64 skipped (12435) | 173.25s |

**Zero failures, zero flakes: the three runs are identical in every count**, which is what should
happen here — the new rows are driven entirely by fake timers, so there is no wall-clock race to
flake on. The exit code was captured per run via `$?` immediately after each invocation, not
inferred from the summary text. `src/components/shared/AnimatedScore.unmount.test.jsx (3 tests)`
is green in all three logs.

An earlier pair of runs was discarded rather than reported: they had started before two late edits
to the test file (deriving the colour expectations, and the `afterEach` ordering fix in §4), so they
would have mixed file versions across the three runs. The table above is a clean set.


## 7. Fence + scope verification (§1, §8)

Checked mechanically against the full §1 list rather than by eye:

```
=== §1 fenced files — modified by this branch? ===
  NONE — zero fenced files touched.

 M src/components/shared/AnimatedScore.jsx
?? src/components/shared/AnimatedScore.unmount.test.jsx
 2 files changed, 196 insertions(+), 1 deletion(-)
```

No fenced function called or edited. No new importer of a legacy archetype table, so the §2.3 import-boundary ratchet is untouched. No feature flag moved, so §2's flip-reconciliation rule does not apply. No cron entry (§6), no scoring math copied (§4), no new colour or motion literal (§10, §11) — the component's existing hexes are untouched and it is not in either guard's file list.

## 8. What is NOT claimed

- **Pushed ≠ deployed** (§2). This is pushed to the branch only. No PR was opened; nothing is deployed; Vercel preview is the smoke-test surface and the founder merges manually.
- **No PR driven, no CI watched, no review requested** (§2). Delivery ends at *pushed*.
- **Not verified in a browser.** The evidence is unit-level plus `vite build`; the leak is invisible at runtime by nature (React 19 swallows it), which is exactly why the timer-count instrument was used instead of a console assertion.
- **The mid-ramp unmount path still leaks** (§5A). F1 as scoped does not close it.

## 9. Evidence files

Written outside the repo tree as §3 requires, and offered for download alongside this record:

| File | What it is |
|---|---|
| `01_prefix_failing.txt` | the red-first run on the unfixed component — exit 1 |
| `02_postfix_passing.txt` | the same file green after the fix — exit 0 |
| `03_mutation1.txt` | mutation 1 (cleanup deleted) — red |
| `04_mutation2.txt` | mutation 2 (ref assignment dropped) — red |
| `05_vite_build.txt` | `vite build` — exit 0, 27.87s |
| `10_suite_run1.txt` … `10_suite_run3.txt` | the three `--maxWorkers=2` suite runs |

## 10. Session preamble (§2, §3)

| Fact | Value |
|---|---|
| `git fetch origin` as first step | **yes** — and it mattered: `origin/main` moved `0e04833d..1c4a8d3b` |
| Branch | `claude/fix-animatedscore-timer`, cut from `origin/main` |
| HEAD at cut | `1c4a8d3b` |
| Tree at cut | clean |
| Dependencies | `node_modules` was absent in this container; `npm install` run (exit 0) before any test |

**One process note, for the record.** The harness instructed development on a different branch
(`claude/lucid-cori-0bb2y9`, its auto-created session branch) than the task prompt, which named
`claude/fix-animatedscore-timer` off `origin/main`. I followed the task prompt: the harness branch
is a harness artifact, not a founder checkout, and §2's "if you're not on the expected branch, STOP"
is about the branch the *task* names. Because `HEAD` already equalled `origin/main`, cutting the
named branch was "fresh from current `main`" exactly as §2 requires — not a mid-task branch. Noted
here rather than silently resolved, since §2 treats branch discipline as load-bearing.
