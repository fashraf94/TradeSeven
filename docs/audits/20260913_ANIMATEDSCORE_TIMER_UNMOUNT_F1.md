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
| Adjacent defects found | **2 reported, 0 fixed at the time** (§5) — per §3. **§5A has since been CLOSED by the addendum below**; §5B remains open |
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

**A. The `requestAnimationFrame` ramp is never cancelled.** ~~Open~~ — **CLOSED by the addendum below; kept here as the original finding.** The effect calls `requestAnimationFrame(tick)` (`AnimatedScore.jsx:46`, `:69`) and never `cancelAnimationFrame`. Unmounting **mid-ramp** therefore lets the loop keep ticking on a dead component, reach `p === 1`, and arm a *fresh* flash-clear **after** the unmount cleanup has already run — so that path still leaks. **This is how I found it:** my first draft included a mid-ramp unmount row, and it stayed red after the F1 fix. Rather than widen the fix past its brief, the row was removed and the limit documented in the test header. *Consequence at the time: F1 closed the ramp-completed path, not the mid-ramp path. The addendum closes the mid-ramp path too.*

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
- ~~**The mid-ramp unmount path still leaks** (§5A). F1 as scoped does not close it.~~ **Superseded:** closed by the addendum. What remains not claimed is §5B (the supersession flicker) and the mounted-phase `act` warnings in `AgentBattleScreen.pane.jsdom.test.jsx`, which the rAF cancel measurably does not change.

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

---

# Addendum — §5A closed (the rAF ramp), and the `showIt` premise tested

**One commit after the record, same branch.** `git fetch origin` ran first again (§3): it brought in one unrelated branch ref and left `origin/main` where it was, so this addendum still sits two commits above the `main` the record cites.

## 5A-closed. The requestAnimationFrame ramp is now cancelled on unmount

`§5A` reported the ramp as leaking and deliberately unfixed. It is now fixed, in the same unmount cleanup that clears the flash timer:

```js
const rafId = useRef(null);                       // :19
useEffect(() => () => {                            // :40-43
  clearTimeout(flashTimer.current);
  cancelAnimationFrame(rafId.current);
}, []);
```

### The brief said `:46, :69`; the correct fix needs four sites, not two

Those two anchors are where each loop is *kicked off*. But both loops **re-schedule themselves** from inside `tick`, so capturing only the kickoffs would leave `rafId` holding an id that had already fired, and `cancelAnimationFrame` would be a silent no-op from frame two onward. Every scheduling site therefore assigns:

| Site (post-fix line) | Which loop | Role |
|---|---|---|
| `:59` | count-up | in-loop re-schedule |
| `:61` | count-up | kickoff (the brief's `:46`) |
| `:78` | value-change | in-loop re-schedule |
| `:84` | value-change | kickoff (the brief's `:69`) |

**This is not a stylistic preference — it is measured.** Mutation C below implements the brief's two-site version *literally* and the suite goes red. The reasoning was checked against the test rather than trusted.

### Two rows, red first then green

The mid-ramp row from the original build is restored as `cancels the ramp when unmounted MID-ramp, before any flash-clear is armed`, and a second row was added for the count-up loop — without it, the mount-path capture would have been unguarded (mutation D proves the gap was real).

Each row takes three independent readings: no pending frame after unmount, **no further frames scheduled** after unmount (a direct "the loop stopped" observable via a `requestAnimationFrame` spy, mirroring the existing 300 ms `setTimeout` spy), and no flash-clear armed or fired.

```
RED FIRST (exit 1)
 ✓ arms the flash-clear once the value-change ramp completes
 ✓ clears the flash-clear timer when unmounted inside the 300 ms window
 × cancels the ramp when unmounted MID-ramp, before any flash-clear is armed
 ✓ FORWARD-GUARD ONLY — silent on React 19 …
AssertionError: unmount must leave no pending frame: expected 1 to be +0
 Tests  1 failed | 3 passed (4)

GREEN AFTER (exit 0)
 Tests  5 passed (5)
```

### Mutation matrix — every capture site is load-bearing

| Mutation | Rows reddened | Exit |
|---|---|---|
| **A** — drop `cancelAnimationFrame` from the cleanup | mid-ramp + count-up | **1** |
| **B** — drop all four `rafId.current =` assignments | mid-ramp + count-up | **1** |
| **C** — capture ONLY the two kickoffs (the brief's `:46`/`:69` read literally) | mid-ramp + count-up | **1** |
| **D** — keep the change-ramp capture, drop the mount loop's two sites | count-up only | **1** |

D reddening *only* the count-up row is the useful detail: it shows the new row is not redundant with the mid-ramp one, and that the mount path had been genuinely unguarded.

## The `showIt` premise, tested — and NO test-only change made

The instruction was conditional: *if* `src/screens/AgentBattleScreen.showIt.jsdom.test.jsx` does not unmount its root before teardown, add `root.unmount()` to its `afterEach`. **It already does, so nothing was added.**

```js
// src/screens/AgentBattleScreen.showIt.jsdom.test.jsx:143-147  — VERIFIED
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
```

Every `createRoot` in that file is either in `beforeEach` (`:141`) or immediately preceded by an unmount (`:231` → `:235`, `:257` → `:261`), so no code path there leaves a root mounted. **VERIFIED** at each anchor.

Nor could I reproduce a flake in it: green in all three original full-suite runs (12 tests, 3949–4163 ms) and green in a targeted run, **both with and without** the rAF fix.

### What the act-warnings in the suite actually are

Chasing the flake premise turned up something worth recording, because it is easy to misattribute. The `not wrapped in act(...)` warnings in the suite log do **not** come from `showIt` — they come from `src/screens/AgentBattleScreen.pane.jsdom.test.jsx`, which renders the arena header and therefore `AnimatedScore` (`ArenaHeader.jsx:228`, `:289`).

That file does `vi.useFakeTimers({ toFake: ['Date'] })` with a pinned system time (`:113-114`) and advances it in only one test (`:360`). With `Date` frozen, `elapsed = Date.now() - start` is permanently 0, so `p` never reaches 1 and the count-up becomes an **unbounded** rAF loop, calling `setDisplay` outside `act` on every frame. That is the warnings' mechanism, and it is also the real-world shape the new count-up row models.

**The rAF cancel does NOT silence those warnings, and I am not claiming it does.** Measured on that file plus `showIt` together:

| | act-warnings | Tests | Exit |
|---|---|---|---|
| with `cancelAnimationFrame` | **192** | 109 passed | 0 |
| without it (cancel removed) | **192** | 109 passed | 0 |

Identical, because the warnings are emitted while the component is still **mounted** — an unmount cleanup cannot reach them. What the fix does change is the *post-unmount* half: that unbounded loop no longer survives its component. Silencing the mounted-phase warnings would mean either advancing the clock in `pane`'s fake-timer setup or wrapping its renders differently — a change to that test file's own timer contract, outside this addendum, and not made.

`pane` also already unmounts (`afterEach:124-128`, **VERIFIED**).

## Addendum — verification

| Check | Result |
|---|---|
| Ramp rows red first | **exit 1** — `unmount must leave no pending frame: expected 1 to be +0` |
| Ramp rows green after | **exit 0** — 5 rows |
| Mutation matrix (A–D) | **all four redden**; C is the brief's literal two-site version, D proves the count-up row is not redundant |
| ESLint (touched files) | **exit 0** |
| `vite build` | **exit 0**, 26.71s |
| Full suite, 3× `--maxWorkers=2` | **exit 0 on all three** — `656 passed \| 3 skipped (659)` files, `12373 passed \| 64 skipped (12437)` tests, identical every run (172.95s / 171.39s / 173.05s). That is **+2 tests** against the record's 12371 — the two new ramp rows, and nothing else moved |
| Fenced files touched | **zero** — the change stays in `src/components/shared/` |
| `showIt` test-only change | **none made** — it already unmounts (`:143-147`) |

## Addendum — what is NOT claimed

- **The mounted-phase `act` warnings are unchanged** (192 with the cancel, 192 without). The fix addresses the post-unmount half only. Anyone reading this as "the rAF fix cleaned up the pane test" would be wrong.
- **No flake was reproduced in `showIt`.** It was green in every run, before and after. The instruction's premise did not hold, so no edit was made rather than an unnecessary one.
- **§5B (the supersession flicker) is still open.** Cancelling on value change would close it but re-opens the stranded-flash hazard at `AnimatedScore.jsx:36-39`; it needs a decision on the sub-0.01 path, so it stays a separate task.
- **Pushed ≠ deployed** (§2). Pushed to the branch only; no PR; the founder merges manually.

## Addendum — evidence files

| File | What it is |
|---|---|
| `20_raf_prefix_failing.txt` | the ramp row red on the un-cancelled component — exit 1 |
| `21_raf_postfix_passing.txt` | green after the cancel — exit 0 |
| `24_mutA.txt` … `27_mutD.txt` | the four-way mutation matrix |
| `30_pane_postfix.txt` / `31_pane_prefix.txt` | the 192-vs-192 act-warning measurement |
| `32_vite_build.txt` | `vite build` — exit 0 |
| `40_addendum_run1.txt` … `run3.txt` | the three `--maxWorkers=2` suite runs |

All three ran against one tree, hashes recorded at run time:

```
82cc700b96fca48a5a6a7a35d1b49a344ada8bde  src/components/shared/AnimatedScore.jsx
4667871d804a05cf2ff8f1fbd0a361a895bc9e64  src/components/shared/AnimatedScore.unmount.test.jsx
```

As in the original build, an earlier partial set was discarded rather than reported: it had started
before the test header's stale "§5A deliberately unfixed" note was corrected, and before two drifted
`file:line` cross-references were refreshed. Comment-only changes cannot alter a result, but they
change the file hash the table is pinned to, so the set was re-run rather than explained away.
