# Independent review — repair R2: the hold claim, the atomic commitment, charging cancellation

Reviewer: Claude Fable 5.1, fresh session, 2026-10-21. Brief: "Independent review brief — repair R2", version 2 of October 21, 2026. Contract: `CommandCenter_R2_Kickoff_20261017.md`, the founder rulings of brief §1.1 (which win over the kickoff), spec V1.2 §5.5 and the §11.3 rows "Hold C4" and "Lifetime/intent". The build's own report (`docs/audits/20261021_BUILD_DEPLOY_R2_HOLD_CLAIM.md`, its copy in this folder) and the PR description were **not read** until section 6 below.

**Provenance of the kickoff.** The brief says the kickoff is attached; no file by that name exists in this folder, the repo, Downloads, or the worktrees. I recovered it by exporting the R2 build session's transcript (session `local_5a119df9-6224-4918-be5d-900efb75f932`, zip `C:\Users\fashr\Downloads\session-export-1792615143485.zip`, unpacked into my scratchpad) and running a script that prints **only the first user-role message containing both `R-R2-1` and `R-R2-3`**, which is the kickoff prompt as pasted to the builder. Nothing else from that transcript was read.

**Isolation.** `git fetch origin` first. Two `git -c core.autocrlf=false archive c86b0d5c` extractions under the session scratchpad, `node_modules` junctioned to the parent checkout: `snap` for reading and my harness rows, `snap-mut` for the mutation pass (run last). No git writes, no working-tree writes; the only file written outside the scratchpad is this one.

---

## 1. Verdict table

| | |
|---|---|
| **Verdict** | **MERGE WITH CHANGES** — two test-only changes (FR2-1, FR2-2). No code change is required. |
| **Blocking findings** | None. No finding meets exit criteria 1–7. |
| **Criterion 1 — more than one deploy** | PASS. Two controls pressed in one tick, pointer then key and key then pointer on one control, two keydowns plus a pointerdown in one tick, a reentrant release on the commit event, an owner running `run` twice: one `onComplete` each (harness Q1/Q2, 17 rows). Mutants M01–M03, M21, M41 killed. |
| **Criterion 2 — a deploy after a shown cancellation** | PASS. Cancellation-first in one frame for all six exits (up, leave, cancel, own capture loss, blur, hidden): 0 deploys, 1 abort, label "Deploy"; a disabled blip during the beat keeps "Locked in" and deploys once; a beat revoked before it runs deploys nothing and idles the display. |
| **Criterion 3 — a commit after the gesture was lost** | PASS. Hidden, blur and the button's own capture loss while charging cancel; the resumed frame after a suspension that delivered the visibility event (hidden alone, and the hidden→visible pair in one task) does not commit; a frame that runs while still hidden cancels. A stall that delivers **no** event commits on the next frame, exactly as on `main` (brief §1.1 accepted; my recorded row). |
| **Criterion 4 — a denied claim has effects** | PASS. The denied control shows 0 rAF, 0 timers, 0 haptics, 0 sky events, 0 capture calls, 0 `onComplete`, label and fill unchanged (Q2 rows; Q1 pointer-then-key). `e.preventDefault()` on the denied pointerdown/keydown is `main`'s too. |
| **Criterion 5 — single-hold parity** | PASS. 15 scripted gestures traced step by step against `main`'s hook (0fc78b02) under one fake clock: phase, `isActive`, progress, label, every sky event with its timestamp, haptics with timestamps, frame requests, pending frames, `onComplete` timestamps — identical for an ordinary hold (touch/mouse/pen), early release, mouse drag-off, pointercancel, Enter, Space, "Spacebar", non-deploy keys, disabled mid-charge, disabled during the beat then re-enabled, unmount mid-charge, unmount during the beat, `enabled=false`. `setPointerCapture` (spied on `Element.prototype`) never called for mouse, touch, pen or typeless pointers. The four kickoff tests are untouched (`git diff --name-status 0fc78b02 c86b0d5c` lists no M for them) and green. |
| **Criterion 6 — the claim stranded or freed wrongly** | PASS. Held at 179,999 ms, free at 180,000 ms; the timer survives unmount; a settle before 180 s clears it (timer count 0); a newer hold claimed after an early settle survives the first hold's mark; a first request settling after its release does not free the newer hold; a stale token cannot release; nothing else holds the slot past the release (timer count 0, a second control claims and deploys). Mutants M15–M17, M27–M30, M42 killed. One seam caveat recorded as FR2-5 (an owner that takes the beat and never runs it). |
| **Criterion 7 — a fenced file or `api/` changed** | PASS. The branch diff is 10 files: `src/hooks/holdClaim.js` (A), `useHoldToDeploy.js` (M), `HoldToDeployButton.jsx` (M), six new test files (A), the build report (A). Nothing under `api/`, nothing in the BUILD_RULES §1 list. |
| **Reviewed head** | `c86b0d5c4c22f302e7b1d93eb4a5d386d10f4afd` on `origin/claude/deploy-r2-hold-claim` (draft PR #985); unmoved at fetch time. Merge base with `main`: `0fc78b025eeabe70ed8ac6fb35249cd0bf2d6ba7`. |
| **Files read** | `src/hooks/holdClaim.js`, `src/hooks/useHoldToDeploy.js` (and `main`'s at 0fc78b02), `src/components/Dashboard/deployCeremony/HoldToDeployButton.jsx` (+ diff vs `main`); `src/components/warpStateMachine.js:789-1010` (`DEPLOY_INTENT_EVENT` :805, `reduceIntentEvent` :937); the six sites `DeployStation.jsx:27`, `desktop/DeployCard.jsx:38`, `desktop/ReadColumn.jsx:142,189`, `CommandDashboard.jsx:467,514`, and `CommandCenter/sections/HubHold.jsx`; `CommandDashboard.jsx:237-282` and `CommandDashboardDesktop.jsx:150` (`handleDeploy` is `async` and returns the request's result); `src/theme/motion.js:155-163`; the six new test files in full; the four kickoff tests' row lists; spec V1.2 §5.5 and §11.3 rows "Hold C4"/"Lifetime/intent". |
| **Tests run (snapshot)** | The ten in-scope files: `holdClaim.test.js`, `useHoldToDeploy.r2 / r2review / safetyRelease / seam .jsdom.test.jsx`, `HoldToDeployButton.reducedMotion.jsdom.test.jsx`, `starfield.intent.test.jsx`, `warpStateMachine.test.js`, `DeployCeremonyHold.smoke.test.jsx`, `holdDuringLiveBattle.test.js` → **10 files, 272 tests, 0 failing** (8.6 s). My harness: 3 files, **62 rows, 0 failing** (section 3). Mutation pass: 43 mutants (section 4). Not run: lint, build, the full suite (brief §2 bound). |

---

## 2. Findings, most severe first

No BLOCKER. No MAJOR.

### FR2-1 · MINOR · test integrity — `pointercancel` while charging has no guard row; mutant M08 is green against all 272 rows

- **Where:** `src/hooks/useHoldToDeploy.r2.jsdom.test.jsx:507` (the D5 exits list: `window blur`, `lost pointer capture`). The hook is correct: `useHoldToDeploy.js:540` binds `onPointerCancel: cancel`, as `main` does.
- **Reproduction:** mutate `useHoldToDeploy.js:540` to `onPointerCancel: () => {},` and run the ten files: 272 passed, 0 failed. The only rows that fire `pointercancel` do so after the lock (D1 commitment-first at :250, "after commitment" at :627, the seam's reentrant row), where a no-op is the expected answer. R-R2-4 names `pointercancel` as a cancel trigger and the kickoff required every added row to be mutation-checked; this trigger is unpinned.
- **My rows that kill it (both fail under M08):** harness `fr2.orderings` "pointercancel, then the threshold frame, in one frame: 0 onComplete, 0 commit, 1 abort, Deploy", and `fr2.parity` "pointercancel mid-charge" (the R2 trace stops matching `main`'s).
- **Smallest fix (one line):** in the D5 `for` at `:507`, add `['pointercancel', (b) => ev.cancel(b)]` to the exits array. The existing row body already asserts one abort, "Deploy", `0%` fill, no frames and no `onComplete` after `step(2000); advance(1000)`, which fails under M08.

### FR2-2 · MINOR · test integrity — "locked before anything else" (R-R2-5) is not pinned against the commit dispatch; mutant M25 is green

- **Where:** `src/hooks/useHoldToDeploy.js:318` (`stateRef.current = 'locked'`) relative to `:332` (`dispatchIntent(null, 'commit')`). The code is in the right order. The nearest existing row, `useHoldToDeploy.seam.jsdom.test.jsx:135` ("a reentrant release inside onCommit cannot undo the commitment"), exercises reentrancy through `onCommit`, which the hook calls **after** the dispatch, so it passes whether or not `stateRef` is set before the sky event.
- **Reproduction:** move `stateRef.current = 'locked'` to just after `dispatchIntent(null, 'commit')` (M25): 272 passed, 0 failed. Under that mutant a listener on the intent channel that releases the pointer during the commit event finds `stateRef` still `'charging'`, so `cancel()` runs: the slot is released, "Deploy" is shown with an abort after the commit, the beat still fires 450 ms later and runs the revoked branch — a shown cancellation with a completion still scheduled, and the sky gets commit then abort.
- **Reachability:** no production listener dispatches pointer events; `StarfieldBackground` only folds the payload. This is a structural pin of the ruling, not a reachable defect, hence MINOR and test-only.
- **Smallest fix:** add this row (it fails under M25 and passes at the head) to `useHoldToDeploy.r2.jsdom.test.jsx` beside the D1 rows:

```jsx
it('a pointerup delivered by a listener on the COMMIT event cannot undo the lock', () => {
  const onComplete = vi.fn();
  render(<Hold onComplete={onComplete} />);
  const [b] = buttons();
  const releaseOnCommit = (e) => { if (e.detail.reason === 'commit') { ev.up(b); ev.leave(b); ev.blur(); } };
  window.addEventListener(DEPLOY_INTENT_EVENT, releaseOnCommit);
  try {
    act(() => { ev.down(b); });
    step(600); step(1300);
  } finally {
    window.removeEventListener(DEPLOY_INTENT_EVENT, releaseOnCommit);
  }
  advance(450);
  expect(b.textContent).toBe('Locked in');
  expect(count('abort')).toBe(0);
  expect(count('commit')).toBe(1);
  expect(onComplete).toHaveBeenCalledTimes(1);
});
```

### FR2-3 · NIT · wording — a failed `commitHold` emits one abort where R-R2-5 says "the hook does nothing"

- **Where:** `src/hooks/useHoldToDeploy.js:312-317`.
- **What:** R-R2-5: "If commitHold returns false, the hook does nothing (the cancel that revoked it already emitted the abort)." The code calls `cancel()`. The two agree whenever the revoke went through the hook's own `cancel` (then `stateRef` is already `'idle'` and `fireComplete` returns at `:310` before reaching `commitHold`). They differ only for a revoke from **outside** (`releaseHold` by S2b's provider) reaching the threshold frame itself, where the code's one abort is the §5.5 answer ("emits one abort") and the kickoff's "nothing" would leave the display at full charge with no terminal. Verified: harness row "a claim revoked inside the threshold frame itself cannot commit" (build r2review) and my M04/M23 kills.
- **Fix:** none to the code. Record the deviation in the report (section 6 says whether the build did).

### FR2-4 · NIT · S2b seam — an external revoke of a charging claim is honoured one frame late, not synchronously

- **Where:** `src/hooks/useHoldToDeploy.js:413-416` (the `tick` check), `:342-348` (the beat's check).
- **What:** spec §5.5 words the revoke as synchronous ("overlay opening … synchronously revokes the uncommitted hold token … emits one abort"). The hook learns of a `releaseHold` from outside at its **next frame** (the charge keeps its display and its listeners until then; ≤ one frame on a visible page). With the page hidden no frame runs, but the visibility listener has already cancelled in that case. The hook exposes no synchronous cancel to the owner, and R-R2-10 says the seam is "currentHold(), onCommit, beatOwner and nothing more", so this is by design.
- **Fix:** none for R2. For S2b: if the provider needs the abort and the display reset in the same task as the revoke (e.g. the overlay opens and the sky must exhale at once), it will need a cancel entry on the seam; record it on S2b's list.

### FR2-5 · NIT · S2b seam — an owner that takes the beat and never runs it leaves the slot locked with no bound

- **Where:** `src/hooks/useHoldToDeploy.js:352` (the safety release is armed inside `run`), `:383-395` (the owner receives `run`).
- **Reproduction (my harness, recorded row):** `beatOwner.commit` stores nothing; unmount; advance 10 min: `currentHold()` still `{ phase: 'locked' }`, 0 timers, no control can claim.
- **Assessment:** the hook's header states it ("A beat handed to a beatOwner is released by its run, or by the owner"), and no caller passes `beatOwner` today. Not a stranding at any site at this head. S2b's provider must either run the beat or `releaseHold` its token on every exit, including its own unmount.
- **Fix:** none for R2; a one-line pointer in the S2b inheritance list.

### FR2-6 · NIT · thin guards — fifteen mutants are each caught by exactly one row

For information, not a change request: M04 (commit check ignored), M07 (pointerleave), M09 (lost capture), M14 (`document.hidden` guard), M16 (safety release token scope), M19 (`e.repeat`), M20 (key idle guard), M21 (`run` one-shot), M23 (`tick` token check), M30 (settle clears the safety timer), M31 (child capture-loss bubbling), M32/M33 (listener detach on cancel/commit), M34 (per-button `controlId`), M35 (re-enable reset vs a live charge), M39 (owner throws, hook keeps the beat), M41 (`commitHold` current-token check). Each is killed; each has a single point of failure. Full table in section 4.

### Accepted items (brief §1.1) — none made worse than `main`

| Accepted item | Evidence at the head |
|---|---|
| A release after a long main-thread task loses to the threshold frame | Same frame-wins order as `main` (parity traces); not changed by R2. |
| A second finger lifting from the same control cancels the first | The second pointerdown is denied (D3); its `pointerup` still reaches `cancel` as on `main`. S2b's `inputId`. |
| Unmounting during the 450 ms beat cancels the deploy | Identical on `main` and R2 (harness Q6, both hooks: no `onComplete`, 0 timers, no abort). |
| Taps take no claim | Unchanged code paths (ceremony-off `onClick`, Scouting Board). |
| `decide.js` check-then-write lock | Untouched (criterion 7). |
| The 429 copy | Untouched. |
| After a remount mid-deploy a hold is denied for up to 180 s | By design; a settle frees it earlier (Q4 rows). Note that the mobile and desktop shells each own their `deploying` flag, so a width change mid-request mounts enabled buttons whose holds are then silently denied — the claim is doing what R-R2-7 asks, and the in-flight rendering across widths is S2b's. |

---

## 3. What was run — the review harness (62 rows, all green at the head)

Three files under `snap/src/hooks/__review__/` (scratchpad only; not for the repo). Harness: `createRoot` + `act`, a hand-run rAF map, `performance.now` on one clock, fake `setTimeout`/`clearTimeout`, `document.hidden` and `visibilityState` as controllable getters, `navigator.vibrate` recorded, `Element.prototype.setPointerCapture` spied. Rows marked RECORDED pass by design and document an accepted behaviour.

**Q1 same-frame orderings (fr2.orderings, real button, 18 rows).** For each of six exits — pointerup, pointerleave, pointercancel, the button's own `lostpointercapture`, window blur, visibilitychange→hidden — (a) the exit then the threshold frame in one frame: `{ onComplete: 0, commit: 0, abort: 1, label: 'Deploy', fill: '0%', slot: null }`, no frame pending; (b) the threshold frame then the exit in one frame: `{ commit: 1, abort: 0, label: 'Locked in', fill: '100%', slot: 'locked' }`, `onComplete` at +450 and not at +449, slot freed by the settle, label stays "Locked in" (as `main`). Plus: a child's bubbling capture loss does not cancel while the button's own does; key then pointer in one tick → one commit, 0 frames, one deploy; pointer then key → the key has zero effects, one commit at the threshold; a blur raised by an intent listener inside the threshold frame (after the `progress: 1` event) → 0 commit, 1 abort, 0 deploy, haptics stop at the 25 % rung; a pointerup/leave/blur raised by a listener on the commit event → "Locked in", one deploy; two keydowns + a pointerdown + a repeat in one tick → one commit, one haptic, one deploy.

**Q2 competing controls (7 rows).** Pointer down on both in one tick (either order) → one charge, the other control `{ frames: +0, events: 0, buzz: 0, timers: 0 }`, its later up/leave/lost do nothing, no capture; pointer on A + Enter on B and Enter on A + pointer on B → the second is denied; a second control denied during the beat and while the first request is pending, admitted after it resolves and deploys (two commits total); admitted after the first request **rejects** (the rejection surfaces exactly once, counted by swapping the process `unhandledRejection` listeners for the row); a denied control unmounting or lifting leaves the owner charging to completion.

**Q3 suspension (4 rows).** Charge to 60 % (fill `60%`), hide, clock to +60 s, show, first frame back → no commit; the hidden→visible pair delivered in one task before the resumed frame → no commit; a frame while still hidden with no event → cancels; RECORDED: a stall with neither event commits on the next frame, as on `main`.

**Q4 claim lifetime (fr2.lifetime, real button, 10 rows).** Unmount mid-charge → slot free in the removing commit, one abort, no frame, blur listener removed once, another control claims; unmount during the beat → beat timer cleared, slot free, no deploy; unmount after `onComplete` → locked until the settle; throwing `onComplete` → free at once, 0 timers; never-settling → held at 179,999, free at 180,000, 0 timers left, the other control deploys, the dead control keeps "Locked in"; the timer survives an unmount 1 s after `onComplete`; a settle at 30 s clears it (timer count 1 → 0) and a newer hold survives the first mark with only its own timer left; a first request settling (and a late reject) after its release leaves the newer hold; a stale token cannot release a re-claimed slot; re-enable after a settled deploy idles and claims again, a re-enable during the beat keeps "Locked in" and deploys once.

**Q6 the seam (hook alone, 7 rows).** `onCommit` once, synchronously inside the threshold frame (asserted inside the `act`), with the slot's token, after the slot is locked and the commit terminal sent; keyboard the same; `beatOwner.commit` once, synchronously, with `(token, run)`, after `onCommit`, 0 hook timers; an owned beat survives unmount, its `run` deploys once (second call ignored) and arms the 180 s release; RECORDED: an owner that never runs leaves the slot locked without bound; without either prop, unmount during the beat on R2 and on `main`: no `onComplete`, 0 timers, no abort, identical sky stream.

**Q5 parity (fr2.parity, 16 rows).** The 15 traces listed in the verdict table, each `toEqual` between `main`'s hook and R2's and with an empty capture log; plus the R2 ordinary-hold trace pinned literally: progress events at 16/200/325/600/975/1000/1299/1300 ms, `commit@1300`, haptics `[325,12] [975,12] [975,12] [1300,60] [1300,60]`, 8 frame requests, one `onComplete`. Note for the harness: R2 frees the slot on a microtask after `onComplete` returns, so the runner awaits `act(async …)` per step; a synchronous runner would misreport a denied re-hold.

---

## 4. Mutation pass (`snap-mut`, the branch's ten test files, 272 rows)

43 mutants of `useHoldToDeploy.js`, `holdClaim.js` and `HoldToDeployButton.jsx`, each applied alone and restored. **40 killed, 1 equivalent, 2 survived.**

| Id | Mutant | Rows failed |
|---|---|---|
| M01 | pointer claim check removed | 13 |
| M02 | `claimHold` overwrites a held slot | 10 |
| M03 | key claim check removed | 4 |
| M04 | `commitHold() === false` ignored | 1 (r2review L4-2 "revoked inside the threshold frame") |
| M05 | `fireComplete`'s `stateRef !== 'charging'` guard removed | **0 — equivalent**: unreachable, `tick` checks `stateRef` and the token at :427 before calling it, `onKeyDown` sets `'charging'` at :467 immediately before |
| M06 | pointerup cancel removed | 9 |
| M07 | pointerleave cancel removed | 1 |
| M08 | pointercancel cancel removed | **0 — survives (FR2-1)** |
| M09 | lostpointercapture cancel removed | 1 |
| M10 | blur listener never attached | 4 |
| M11 | visibilitychange listener never attached | 2 |
| M12 | disabled / enabled=false mid-charge cancel removed | 3 |
| M13 | unmount cancel removed | 51 |
| M14 | `document.hidden` guard in `tick` removed | 1 |
| M15 | release on settle removed | 60 |
| M16 | safety release frees whatever is held | 1 |
| M17 | safety release cleared on unmount | 2 (second pass) |
| M18 | `setPointerCapture` on pointerdown | 4 |
| M19 | `e.repeat` not checked | 1 |
| M20 | key idle guard removed | 1 |
| M21 | `run` one-shot guard removed | 1 |
| M22 | `run` token validation removed | 5 |
| M23 | `tick` token validation removed | 1 |
| M24 | `tick` post-dispatch recheck removed | 2 |
| M25 | `stateRef = 'locked'` moved after the commit dispatch | **0 — survives (FR2-2)** |
| M26 | re-enable reset ignores a pending beat | 2 |
| M27 | unmount during the legacy beat does not release | 29 |
| M28 | `cancel` does not release | 59 |
| M29 | throwing `onComplete` does not release | 6 |
| M30 | settle does not clear the safety timer | 1 |
| M31 | capture loss cancels on a bubbling child loss too | 1 |
| M32 | `cancel` leaves the listeners attached | 1 |
| M33 | commitment leaves the listeners attached | 1 |
| M34 | every button shares one `controlId` | 1 |
| M35 | re-enable reset ignores a live charge | 1 |
| M36 | `beatPendingRef` never set at commitment | 2 |
| M37 | `beatPendingRef` never cleared by `run` | 3 (second pass, re-anchored) |
| M38 | owner that ran then threw: hook re-arms anyway | 2 |
| M39 | owner that throws: hook drops the beat | 1 |
| M40 | legacy beat armed after `onCommit` | 2 (second pass) |
| M41 | `commitHold` locks any token | 1 |
| M42 | `releaseHold` frees any token | 3 |
| M43 | `cancel` allowed after the lock | 19 |

Runner disclosure: my first pass applied only the **last** edit of the three two-edit mutants (M17, M25, M40), so they showed 0 failures for the wrong reason; the runner was corrected (read the file as edited before the next edit) and the three re-run: M17 and M40 are killed, M25 still survives. M37's first anchor matched two places (the `run` reset and the unmount cleanup) and was re-anchored to the `run` copy. Against my own 62 rows: M08 is killed by 2 rows, M25 by 1 row, M05 by none (consistent with equivalence).

---

## 5. What I did not check

- **Real browsers.** No WebKit, Gecko or Chromium was run. Only a device shows: whether iOS WebKit ever fires `lostpointercapture` on the button element itself mid-hold (it targets the touched element; the hook cancels only on `e.target === e.currentTarget`), the order of `pointerup` and `lostpointercapture` on lift, `pointerout` with a null `relatedTarget` on moves within the button now that nothing is captured, whether `visibilitychange`/`blur` are delivered on app switch, Control Center and the notification shade, and whether a 180 s `setTimeout` is throttled in a backgrounded tab (it would fire late, never early). The founder's iPhone check covers these.
- **The six sites were read, not driven.** `handleDeploy` at both shells is `async` and returns the request's result, so the claim spans the request there; HubHold's S2b handler does not exist yet, and a handler that returns nothing frees the claim on the next microtask (R-R2-7 only binds "its result").
- **`motion.button` forwarding of `onLostPointerCapture`** is proven in jsdom only (the D5 rows drive the filled variant).
- **`useReducedMotion` on first render** (R-R2-9): cosmetic, not in the exit criteria; not traced.
- **Not run, by the brief's bound:** `lint:gate`, `vite build`, the full suite, the rules suite.
- **Not read before the verdict:** the PR description (any section), the build report, the build session's review record.

---

## 6. Reconciliation (written after the verdict; the verdict above is unchanged)

Read for this section only: the committed build report (`docs/audits/20261021_BUILD_DEPLOY_R2_HOLD_CLAIM.md` at `c86b0d5c`, sections 1–14), the PR #985 description (head `c86b0d5c`, draft, base `main`), and the build session's mutant lists in its scratchpad (`review/mutants.json`, 81 entries; `review/L5c-tools/mutants.json`, 19; `mutation-rulings.txt`, RS1–RS14).

| Mine | Build's record | Does its disposition hold? |
|---|---|---|
| **FR2-1** `pointercancel` while charging unguarded (M08 survives) | **Not recorded.** No mutant in any of the three lists removes `onPointerCancel`; §8.3's "every R-R2-4 trigger is wired" is a reading claim, and §4's only `pointercancel` rows are the after-the-lock ones. | New. The one-line fix stands. |
| **FR2-2** `stateRef = 'locked'` not pinned against the commit dispatch (M25 survives) | **Partly.** The build's M16 ("locked set only after `onCommit`") is killed by the seam's reentrant-`onCommit` row, as §8.4 says. My mutant moves the lock after `dispatchIntent(null, 'commit')` but before `onCommit`, a window that row does not reach. | New (narrower than M16). The build's disposition of M16 holds for M16; it does not cover the dispatch window. |
| **FR2-3** one abort on `commitHold === false` vs the kickoff's "does nothing" | **Recorded** as BI-2 (§3, R-R2-5 row: "the prompt said 'does nothing'; tearing down is what keeps one abort per stream"), guarded by the r2review row "a claim revoked inside the threshold frame itself cannot commit". | Holds. Same reading as mine. |
| **FR2-4** an external revoke is honoured one frame late | **Recorded** in §10 ("a charge ends at its next frame … the cleanest revocation is through props: flipping `enabled`/`disabled` cancels in the same commit"), from L4-2/L3-4. | Holds. The props route answers the §5.5 "synchronously" wording for S2b; my note adds only the citation. |
| **FR2-5** an owner that never runs the beat leaves the slot locked with no bound | **Recorded** as L4-3b (NIT) and in §10: "an owner that abandons a beat has no way to return the control to idle". | Holds, with one disagreement in emphasis: the build describes the cost as the **control** stuck "Locked in"; the cost is the **slot**, so every hold in the app is denied with no bound, since the safety release is armed only inside `run`. The disposition (S2b's contract) is unchanged. |
| **FR2-6** fifteen single-row kills | **Partly recorded** (§8.4 names four "killed only by" cases: M16, M17, M46, M53). | Information only. |
| Accepted items, none worse than `main` | §10–§12 record each; the build measured the second-finger and stall cases in Chromium (base and R2 alike). | Agrees. |

Other points of comparison, no finding either way:

- **Parity evidence.** The build's jsdom differential (114/122 byte-identical, the 8 being the old hook's duplicate abort in one jsdom-only unmount step) and its headless-Edge runs (§9.1) go further than my 15 jsdom traces, which found no difference in any scripted step. I ran no browser, per the brief.
- **Counts agree.** The build's targeted run at `f1b5a705` is "10 files, 272 tests"; mine at `c86b0d5c` is the same 272.
- **§10's "unruled corner" (RF1):** an `onCommit` that unmounts the control synchronously, then an owner whose `commit` throws without running, arms the fallback after the unmount. I did not probe that two-fault shape; it is contrived and recorded, and I have nothing to add.
- **The build's correction to R-R2-4's rationale** (the visibility listener, not the hidden-frame check, is what stops a resumed frame; §3, L3-1) matches my Q3 rows: the hidden→visible pair before the resumed frame does not commit, and a frame while still hidden cancels as defence in depth.
- **The PR description** restates §14 and the checks; nothing in it bears on the findings above. It claims `lint:gate` and `vite build` exit 0 at `c86b0d5c`; I did not run either.

Verdict after reconciliation: **MERGE WITH CHANGES**, the two test rows of FR2-1 and FR2-2. No code change. The build's dispositions of FR2-3, FR2-4 and FR2-5 hold.
