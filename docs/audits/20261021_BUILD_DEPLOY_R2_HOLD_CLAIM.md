# Build report — Command Center repair R2: the hold claim, the atomic commitment, charging cancellation

Prepared 2026-10-21 by Flash (Claude Code). Prompt: "FantasyTrades Command Center — repair R2" (prepared 2026-10-17; authorizes R2 only: spec V1.2 §5.5, §11.2 row R2, correction C4, review IR-06 and IR-08). Ships live with no flag. Governing rule: **single-hold parity** — one ordinary hold, an early release and a keyboard deploy behave exactly as before, sky stream included.

## Verdict

| Question | Answer |
|---|---|
| **Founder rulings (applied)** | **Q1–Q5 answered 2026-10-21; applied in one fix round (§14).** No pointer type is captured (R-R2-3's capture half withdrawn, its claim-first half kept), so touch, pen and mouse take main's pointer path exactly — measured event for event in Chromium, mouse drag-off included. The bounded safety release is added (`HOLD_CLAIM_SAFETY_RELEASE_MS = 180000`). The stall guard is a separate task (§12); second-finger ownership is S2b's (§10). |
| Built as authorized? | **Yes**, with R-R2-3 as amended by the founder (§3, §14). Nothing under `api/` changed; no fenced file edited; no call site, shell handler or `agentDeploy.js` touched; no pre-existing test edited (the founder-replaced R2 capture rows apart). |
| Single-hold parity | **Held.** jsdom: a differential harness rendered the pre-R2 and R2 hook through the real call sites, frame by frame — 114 of 122 rows byte-identical; the 8 that differ are one jsdom-only step where the old hook sent a duplicate abort (§8.2, L1). Real browser — **Chromium only** (headless Edge, real touch/mouse/keyboard): every single-hold scenario — touch hold, touch on the padding, quick release, mouse hold still, mouse dragged off, Enter — matches main event for event (§9.1). No WebKit or Gecko was available; no pointer is captured, so every engine gets main's pointer path. The four sky tests pass unmodified. |
| The defects | **D1–D7 fixed**, each reproduced first by a row that failed on the old hook (§4). Two controls can no longer both deploy (measured in Edge: two fingers deployed twice before, once now). |
| The claim's lifetime | One hold at a time, app-wide, held from press until the deploy request settles. The review's fix round makes every continuation honour it (§5, §8). After a shell remount mid-deploy the new shell's hold is denied until the first request settles — now at most 180 s after onComplete ran, by the bounded safety release (Q3, §14). |
| Checks | Full suite on Linux, CI-shaped, at the code and test head `f1b5a705` (after the founder rulings; `origin/main` re-fetched, still `0fc78b02`, so this is the merged tree): **Test Files 1053 passed, 7 skipped; 22,772 tests passed, 0 failed**; exit 0. `lint:gate` and `vite build` exit 0 there and on the pushed head (§14.5, PR description). |
| Review | BUILD_RULES §2 run: 4 read-only lenses + 3 refuters (one per lens with findings, each on its own snapshot) + the mutating lens L5 last, on the final code. The four lenses: 16 unique findings (24 as reported, four reported twice). **None refuted outright**; sub-claims refuted or recalibrated in six; **no BLOCKER**; one upgraded to a merge gate by its refuter (the STOP). 9 led to code changes (the STOP included), backed by 15 rows that failed first on the build before them; the rest recorded (§8). L5 (on the final code): 48 of 53 listed mutants killed at first; every non-equivalent survivor, and 5 more L5 devised, is now killed by a row added for it; 4 named equivalents remain (§8.4). Rulings round: one focused lens, a refuter, and 14 mutants of the new code — all killed (§14.4). |
| Status | Pushed to the draft PR #985, **STOPPED** for the independent Fable review: no merge, no CI watching. The preview is the smoke surface — on a phone and on desktop: one ordinary hold deploys exactly as today; a quick release cancels; Enter deploys. |

## 1. Branch, HEAD and preamble

- `git fetch origin` first (BUILD_RULES §3). `origin/main` = `0fc78b02` (PR #984). The prompt cites R1 merged at `39053aed` (PR #979); `39053aed` is an ancestor of `0fc78b02` (VERIFIED), so R1 is on the base. Main had moved on since the prompt; the newer commits touch nothing R2 reads (BaggerBomb scoreboard and menu).
- Worktree branch `claude/deploy-r2-hold-claim-dadf73` (the app's suffix), cut at `0fc78b02`, clean at start. Pushed as `claude/deploy-r2-hold-claim` by refspec.
- Commits: `af4affb2` R2 build and tests · `27d70178` only the button's own capture loss cancels (amended before any push: its first message claimed a failure that headless Edge then showed Chromium does not have; the message now says "defensive narrowing") · `6cf0c79f` the review fix round · `24d3efcf` a row title (L3-1) · `5a8f8119` capture for a mouse only, touch/pen STOPPED; the L3-3 token compare · `c9be87ac` the draft report · `72a37037` the rows L5 found missing (tests only) · `356d2899`, `56d27736` the report (draft PR #985 opened at `56d27736`) · founder rulings: `c29fff3b` no pointer capture, the safety release · `9630965d` the rulings review's F1-1 fix and rows · `f1b5a705` the cross-cycle F1-1 row · the report (§14).
- Code and test head `f1b5a705` (after the founder rulings, §14); before them: code `5a8f8119`, tests `72a37037`. Report head = the PR head.

## 2. Starting check (BUILD_RULES §3)

Every anchor re-read at `0fc78b02` in this session (VERIFIED).

| Anchor (prompt §2) | At 0fc78b02 | Reading |
|---|---|---|
| `HOLD_MS = 1300`, `LOCK_BEAT_MS = 450` | `src/hooks/useHoldToDeploy.js:106`, `:107` | VERIFIED. Two tests read these lines by regex (`hubCopy.guard.test.js:294`, `warpStateMachine.test.js:62`); both lines are byte-identical at the build (`:180`, `:181`). |
| `phaseRef.current = phase` at render | `:161` | VERIFIED — start, cancel and onKeyDown read the last rendered phase. |
| fireComplete | `:170–184` | lock, `vibrate(60)`, `dispatchIntent(null,'commit')`, timer → onComplete. VERIFIED |
| tick / start / cancel / onKeyDown | `:186`, `:206`, `:216`, `:229` | VERIFIED |
| disabled-mid-hold effect / re-enable reset / unmount cleanup | `:238–241`, `:243–253`, `:255–265` | the cleanup clears the beat timer and aborts a charging stream. VERIFIED |
| bind | `:267–277` | VERIFIED |
| `HoldToDeployButton.jsx` the hook's only importer | `HoldToDeployButton.jsx:23` | only `import useHoldToDeploy` in `src/` outside tests. VERIFIED |
| `fillTransition` ignores reduced motion | `HoldToDeployButton.jsx:46` | `charging ? 'none' : 'width 250ms ease'`. VERIFIED |
| Call sites | `CommandDashboard.jsx:467`, `:514`; `DeployStation.jsx:27`; `desktop/DeployCard.jsx:38`; `desktop/ReadColumn.jsx:142`, `:189`; `CommandCenter/sections/HubHold.jsx:38` (dark) | VERIFIED. With `SCOUTING_BOARD_ENABLED = true` (`featureFlags.js:1017`) the live holds are mobile DeployStation + mobile "Deploy without previewing", desktop DeployCard + desktop ReadColumn muted. |
| Sky contract | `DEPLOY_INTENT_EVENT` `warpStateMachine.js:805`; `reduceIntentEvent` `:937` | VERIFIED |
| Flags | `DEPLOY_CEREMONY_ENABLED = true` `featureFlags.js:1503`; `DEPLOY_SKY_COUPLING_ENABLED = true` `:1856` | VERIFIED. (`featureFlags.js:1836`'s "When FALSE (CURRENT)" prose is stale; recorded in §12.) |
| Shell deploy handlers | `CommandDashboard.jsx:237` and `CommandDashboardDesktop.jsx:150`: `async`, return the result | VERIFIED — so `Promise.resolve(onComplete())` sees the real request. |
| S2a hold input | `hubModel.js:59–61`, `deployState.js:262–268` (`canCommit` needs `hold.holdToken` and a valid `holdEpoch`) | VERIFIED — see R-R2-1 below for the shape reconciliation. |

**STOP check at the start:** parity looked keepable at every site, the sky stream for an ordinary hold or release needed no change, no fenced file was involved. Recorded and continued. (The STOP reached later is §9.3.)

## 3. The rulings as applied

| Ruling | As built | Where (code head `5a8f8119`) |
|---|---|---|
| R-R2-1 one hold app-wide | `holdClaim.js`: one slot; `claimHold(controlId)` grants a fresh opaque token (`hold_N`) only to an empty slot — a second input on the holding control is denied too — and none without a control id (fails closed); `commitHold(token)` atomic; `releaseHold(token)` only for its own token; `currentHold()` frozen copy; `__resetHoldClaim()` test-only (the token counter is never reset). **Shape reconciliation:** the ruling names the slot `{ token, controlId, phase }`; S2a's selector reads `{ controlId, holdToken, holdEpoch, phase }`. `currentHold()` returns `{ controlId, holdToken, phase }`; `holdEpoch` is left for S2b to stamp, because spec §5.5's `claimHold(controlId, inputId, holdEpoch)` takes it as an input. Each button gets `useId()` as its control id. | `src/hooks/holdClaim.js:41–74`; `HoldToDeployButton.jsx:42–43` |
| R-R2-2 refs are authoritative | `stateRef` and `tokenRef` written in the call that changes them; React state mirrors for display; no guard reads a rendered phase. | `useHoldToDeploy.js:261–263` |
| R-R2-3 claim before any effect | Pointer down and Enter/Space claim first; a denied claim returns before any phase, frame, haptic, progress, sky event, timer or onComplete. **Pointer capture withdrawn by the founder (Q1/Q2): no pointer type is captured; `onPointerDown` and `start`'s signature are byte-identical to main's.** | at `f1b5a705`: `:440–455`, `:457–470`, `bind` `:535–545` |
| R-R2-4 charging cancels on every loss | up / leave / cancel / own `lostpointercapture` / hidden / blur / disabled→true / enabled→false / unmount → one `cancel()` (revoke, clear frame, reset display, one abort). Listeners attach only while charging and detach on every exit. The disabled/enabled cancel and the unmount cancel are **layout** effects, so each lands in the commit that renders it (review L2-1). A frame that runs while the document is hidden cancels. **Correction to the ruling's own rationale:** R-R2-4 says the hidden-frame check makes it so "a resumed frame after a suspension can never commit". It does not: the visibilitychange listener does (hiding fires the event before any frame can run); the frame check is defence in depth (review L3-1). | `cancel` `:284–299`; listeners `:304–314`; tick check `:406`; layout effects `:476–478`, `:504–525`; capture-loss handler `:532` |
| R-R2-5 threshold = commitment | `commitHold(token)` true → `stateRef = 'locked'` first, then display, haptic, one commit, `onCommit`, the beat. Afterwards every release-type input is a no-op. If the token was revoked, the charge is torn down with its one abort (the prompt said "does nothing"; tearing down is what keeps one abort per stream — BI-2). | `fireComplete` `:316–397` |
| R-R2-6 keyboard immediate | `e.repeat` ignored; claim → commit → same 450 ms beat; no held-key requirement. | `:457–472` |
| R-R2-7 claim through the request | The beat's run calls onComplete once; `Promise.resolve(result).finally(release)`; a synchronous throw releases and rethrows. Re-enable reset kept (not during a pending beat or over a live charge). Unmount releases only what nothing else will (BI-1). **Bounded by the founder's safety release (Q3): 180 s after onComplete ran, by token, not cleared by unmount (§14).** | run `:345–370`; reset `:487–497`; unmount `:504–525` |
| R-R2-8 beat stays with the hook; seam added | Legacy: unmount during the beat cancels the deploy, as before. `onCommit(token)` synchronous at the boundary; `beatOwner.commit(token, run)` takes the beat instead of the timer and survives unmount; `run` is one-shot. | `:372–396` |
| R-R2-9 reduced motion | `useReducedMotion()` (house precedent) → `motionToken('fade', { reducedMotion }) === instant` → fill and glow get no transition; the 250 ms drain otherwise unchanged. | `HoldToDeployButton.jsx:53–57`, `:77` |
| R-R2-10 out of scope | No tap claims; no provider; nothing under `api/`. | — |

**Builder interpretations, as they stand after review:**
- **BI-1** unmount releases the claim only while charging or when it cancels a legacy beat; once onComplete has run, the request's settle releases it — so a width change mid-request cannot start a second hold (FR-4). Its cost — a request that never settles kept every hold denied until reload — is now bounded at 180 s by the safety release (founder ruling on Q3, §14).
- **BI-2** a revoked token at the threshold → teardown with one abort.
- **BI-3** the re-enable reset never runs while a committed beat is pending (spec §5.5 "never display cancellation while a completion callback remains authorized"), nor over a live charge (review L2-5).
- **BI-4** disabled/enabled and unmount cancellation in layout effects.
- **BI-5** only the button's own `lostpointercapture` cancels: a touch keeps implicit capture on the element touched, and that element's capture loss at lift bubbles to the button.
- **BI-6** an `onCommit` or owner that throws cannot strand the commitment: the legacy beat is armed first, a throwing owner falls back to the hook's own beat, the first error is rethrown afterwards.
- **BI-7** closure semantics unchanged: the pointer path calls the onComplete of the render in which the pointer went down, the key path the keydown render's.
- **BI-8** every continuation checks the token: a tick ends a charge revoked from outside at its next frame; a beat revoked before it runs deploys nothing and returns the control to idle (spec §5.5 "every continuation validates token").

## 4. The defects, failing first

Each row was run against the hook as it was before R2 (`0fc78b02`) and failed there; logs `failing-first.clean.txt` (§13). Rows that pass on both are parity or guard rows, labelled as such.

| # | Defect | Failing-first row(s) (`src/hooks/useHoldToDeploy.r2.jsdom.test.jsx` unless named) | Failure on the old hook |
|---|---|---|---|
| D1 | threshold frame + release in one frame: display idle, commit then abort, deploy fires | "commitment first, then pointerup / pointerleave / pointercancel before a render" | `expected 'Deploy' to be 'Locked in'` (×3). The `lostpointercapture` variant passes on both — the old hook had no handler; it guards the new one. "cancellation first …" passes on both (parity). |
| D2 | two controls both charge and deploy | "a second control pressed while the first charges is denied with zero effects", "both pressed in the same tick", "Enter on a second control …", "unmounting the denied control emits no abort" | `expected 3 to be 2` (a frame requested by the denied control); `expected 2 to be 1`; `expected 'Locked in' to be 'B'`; `expected 1 to be +0` (an abort from the denied control) |
| D3 | pointer + key, or two pointers, on one control | "two pointers down … start one charge", "a pointer charging, then Enter in the same tick", "Enter first, then a pointer", "a mouse pointer down captures …", "a denied pointer is never captured" | `expected 2 to be 1`; `expected 'Locked in' to be 'Deploy'`; `expected 1 to be +0`; capture `called 0 times`; `expected [] to deeply equal [[7]]` |
| D4 | switch tabs mid-hold, return, deploys | "going hidden mid-hold cancels …", "a frame that runs while the document is still hidden …" | `expected +0 to be 1` (no abort); `expected 1 to be +0` (a commit) |
| D5 | blur / lost capture leave the charge running | "window blur mid-hold …", "lost pointer capture mid-hold …", the two listener-lifecycle rows | `expected +0 to be 1`; `{ blur: 0, visibility: 0 }` vs `{ 1, 1 }`; `expected +0 to be 1` |
| D6 | repeated keydown before a render: two commits, two haptics | "a keydown and its auto-repeat before a render", "two plain keydowns before a render", "an auto-repeat keydown on its own never deploys" | `expected 2 to be 1` (×2); `expected [ Array(1) ] to deeply equal []` |
| D7 | the drain ignores reduced motion | `HoldToDeployButton.reducedMotion.jsdom.test.jsx`, three rows | `expected 'width 250ms ease' to be 'none'` (×2); the glow `'box-shadow 250ms ease, border-color 2…'` vs `''` |
| — | enabled → false mid-charge still deployed | "enabled → false mid-charge: one abort, no deploy" | `expected +0 to be 1` |
| — | the claim's lifetime (R-R2-7) | "a second control is denied during the 450 ms beat", "… while the first deploy is in flight …", "unmounting the first control mid-deploy does not free the slot early" | `expected 5 to be 4` (×3) |
| — | a disabled blip during the beat showed idle (BI-3) | "a disabled blip during the beat keeps Locked in …" | `expected 'Deploy' to be 'Locked in'` |

`holdClaim.test.js` and `useHoldToDeploy.seam.jsdom.test.jsx` failed at import on the old tree (the module did not exist); the mutants of §8.4 stand in for their rows.

**What the old-hook failures do and do not show (review L5-10).** Inside one `act()` two dispatches land with no render between them. For D1 that is a real browser window: the threshold frame's update renders in a later task, so a release can land first. For two *input* events it is not: outside `act`, React 19 renders a discrete event's update at the microtask checkpoint the browser runs after each listener. So D3's three same-tick rows and D6's two same-act rows failed on the old hook through `act` batching; they pin R-R2-2 (no guard reads a rendered phase), not a defect a browser could reach. The browser-reachable parts are D6's lone auto-repeat (the old hook deployed on a first repeat keydown) and D2 (two controls; measured in Edge, §9.1). Also: "a denied pointer is never captured" failed on the old hook only because it never captured anything (M3, M12 and M31 are its real evidence), and the two D5 listener rows failed on their attach half (M10 and M11 cover the removal half).

**Review fix-round rows** (`src/hooks/useHoldToDeploy.r2review.jsdom.test.jsx`), run against the pre-fix build `27d70178` (log `failing-first-review-rows.txt`): 11 of 12 failed, each on its defect — L2-1 ×3 (slot still charging after the removing commit; onComplete called from a removed button ×2), L2-2 ×2, L2-3, L2-4 ×2, L4-2 (`expected 'charging' to be 'idle'` one frame after the revoke), L3-3 (`expected [12] to deeply equal []`), L2-5 (`'width 250ms ease'` vs `'none'`). The twelfth ("a claim revoked inside the threshold frame itself cannot commit") passes on both: BI-2's teardown already existed; it guards it. The BI-6 rows and the restart row were added after; the restart row failed on `24d3efcf` (state-only guard) and the three touch/pen/typeless capture rows failed on `24d3efcf` (capture called) — log `failing-first-capture-rows.txt`.

## 5. What R2 built, by `file:line` (code head `5a8f8119`)

After the founder rulings the code head is `f1b5a705`; the anchors that changed are in §14.3.

**`src/hooks/holdClaim.js` (new, 73 lines).** The slot `:38`; `claimHold` `:41–48`; `commitHold` `:50–54`; `releaseHold` `:56–60`; `currentHold` `:62–65`; `__resetHoldClaim` `:71–73`. Header `:1–36`.

**`src/hooks/useHoldToDeploy.js`.**
- Header: the contract of record kept (`DEPLOY_INTENT_EVENT`, payloads, ordering guarantee); the new section "THE HOLD CLAIM" `:24–96` (one hold app-wide; capture for a mouse only; refs; the cancel set; the commitment boundary; outside revocation; the claim's lifetime; the beat and the seam; keyboard).
- `capturePointer` `:235–244` (mouse only `:237`; feature-detected, failure swallowed).
- Refs `:261–269`. `cancel` `:284–299`. Listeners `:304–314` (`useCallback`).
- `fireComplete` `:316–397`: claim check `:321–327`; locked first `:329`; commit `:343`; `run` `:345–370` (one-shot `:346`, token recheck `:353–359`, sync-throw release `:362–366`, settle release `:369`); legacy beat armed before `onCommit` `:375–378`; `onCommit` `:380–384`; owner and its fallback `:385–394`; rethrow `:396`.
- `tick` `:399–437`: hidden frame `:406`; token check `:412`; post-dispatch guard `:426`.
- `start` `:439–455` (claim `:444`, capture `:453`); `onKeyDown` `:457–470` (`e.repeat` `:463`).
- disabled/enabled cancel (layout) `:476–478`; re-enable reset `:487–497`; unmount cleanup (layout) `:504–525`; capture-loss handler `:532`; `bind` `:534–546` (gains `onLostPointerCapture` `:541`); return shape unchanged `:547`.

**`src/components/Dashboard/deployCeremony/HoldToDeployButton.jsx`.** `useId` control id `:42–43`; reduced motion `:53–57`; glow transition `:77`. No prop, label, colour or layout change.

**Tests (new):** `src/hooks/holdClaim.test.js` (12), `src/hooks/useHoldToDeploy.r2.jsdom.test.jsx` (52), `src/hooks/useHoldToDeploy.r2review.jsdom.test.jsx` (24), `src/hooks/useHoldToDeploy.seam.jsdom.test.jsx` (13), `src/components/Dashboard/deployCeremony/HoldToDeployButton.reducedMotion.jsdom.test.jsx` (4). No existing test edited.

Not touched: every call site, both shells, `agentDeploy.js`, `warpStateMachine.js`, `StarfieldBackground.jsx`, anything under `api/`, any fenced file (BUILD_RULES §1). No fenced function is called.

## 6. Existing tests

None edited. The four the prompt names pass unmodified at every commit: `starfield.intent.test.jsx` (20), `warpStateMachine.test.js` (122), `DeployCeremonyHold.smoke.test.jsx` (4), `holdDuringLiveBattle.test.js` (10).

## 7. Checks

| Check | Head | Result |
|---|---|---|
| Full suite, Linux (WSL private clone, Node 20.20.2, `TZ=UTC`, `--maxWorkers=2`, CI-shaped) | `72a37037` (before the founder rulings; after them see §14.5) | **Test Files 1052 passed, 7 skipped (1059); tests 22,761 passed, 0 failed, 88 skipped; exit 0**; 727 s |
| Same, pre-review | `af4affb2` | Test Files 1051 passed, 7 skipped (1058); 22,732 passed, 0 failed; exit 0 |
| Targeted: the five R2 files + the four sky files | `72a37037` | 9 files, 261 tests passed (105 R2 rows) |
| `lint:gate` | `72a37037` (Linux) | exit 0; re-run at the pushed report head — PR description |
| `eslint` on every touched file (ungated) | `5a8f8119` | clean, apart from base's own `'motion' is defined but never used` (`HoldToDeployButton.jsx:21`, present at `0fc78b02` too) |
| `vite build` | `72a37037` (Linux) | exit 0 (built in 21 s); re-run at the pushed report head — PR description |
| Headless Edge, real input (§9) | `0fc78b02`, `af4affb2`, `27d70178`, `24d3efcf`, `5a8f8119` | §9 |

## 8. The BUILD_RULES §2 review record

### 8.1 How it ran

The cumulative diff is 8 files and ~2,070 changed lines, past the threshold. Each reviewer worked on its own LF `git archive` snapshot under the session scratchpad (node_modules junctioned), read-only on git and on the shared tree; the mutating lens ran last on a snapshot of the final code. Shared inputs: the diff, the pre-R2 files, a brief with every ruling and builder interpretation, the headless-Edge results.

- Lenses (read-only, run in parallel on `27d70178`): **L1** single-hold parity at every site · **L2** same-frame orderings and reentrancy · **L3** cancellation coverage · **L4** the claim's lifetime through the deploy request.
- Refuters, each on a fresh snapshot, instructed to refute with a concrete repro: **RL2** (L2), **RL3** (L3), **RL4** (L4 with L1's question folded in).
- **L5** test integrity, the mutating lens, on `5a8f8119`.

### 8.2 Findings, verdicts, dispositions

| ID | Sev. (after refuter) | Finding | Refuter verdict | Disposition |
|---|---|---|---|---|
| L3-Q2 | **MAJOR → merge gate** | Explicit capture on touch is new on every iPhone hold; an engine that sends the hand-over `pointerout` with a null `relatedTarget` makes React cancel the hold | RL3: **PARTLY** — the "lostpointercapture at the button" half REFUTED (spec and WebKit fire it at the previous owner only); the null-`relatedTarget` half **upgraded**: WebKit's iOS touch events have a null `relatedTarget` (`PointerEventIOS.cpp`), a move-target change fires `pointerout` (`PointerCaptureController.cpp`), the open caller targets the capture element; the iOS caller is closed | **STOP** for touch/pen (`5a8f8119`); Q1 → founder ruling: no capture for any pointer type (`c29fff3b`, §14). Chromium measured safe either way (§9). |
| L2-1 | MINOR | The unmount cleanup was passive: after a non-event unmount a queued frame or the beat could still act from a removed button | **CONFIRMED** — real Edge: a removed button committed in 24/26 trials (false haptic + sky surge, no deploy); the beat-timer half 1/158 in Edge (the jsdom timer row proves nothing about browser ordering — sub-claim recalibrated); "MAJOR for S2b" overstated → MINOR | **Fixed**: layout cleanup (Edge after fix: 0/24) |
| L2-2 | NIT/MINOR | An `onCommit` that `flushSync`-unmounts its control escaped the cancel | CONFIRMED (seam only) | **Fixed**: beat armed before `onCommit` |
| L2-3 = L4-1 | MINOR | A throwing `beatOwner.commit` locked the slot forever | CONFIRMED (RL2, RL4) | **Fixed**: the hook keeps the beat (one-shot `run`, so an owner that saved `run` still deploys once) |
| L2-4 = L4-3a | MINOR | A beat revoked from outside still deployed and freed the slot → two deploys | CONFIRMED; RL4: R1's identity guard does not mitigate (it captures the uid after the beat) | **Fixed**: `run` rechecks its token; display back to idle |
| L4-2 = L3-4 | MINOR | A charge revoked from outside kept charging until its threshold; two progress streams | CONFIRMED | **Fixed**: per-frame token check |
| L3-3 | NIT (lens: MINOR) | A cancel delivered inside a tick let the tick reschedule (progress after abort, stray haptics) | CONFIRMED latent; RL3: the state-only guard is incomplete (cancel-and-re-press leaves two chains) | **Fixed** with RL3's token compare; restart row added |
| L2-5 | NIT | The re-enable reset could overwrite a live charge's display | CONFIRMED; RL2: base was worse (it deployed on the ignored release) | **Fixed** |
| L3-1 | MINOR | The header/ruling claim "a resumed frame can never commit" is wrong | CONFIRMED on the wording; RL3: the premise "browsers pause frames" is wrong too (the spec allows throttled frames); the true guard is that visibilitychange fires before any frame; L3's cited starfield rows were wrong (only `:251–258` constrains a stall guard) | **Fixed** wording (header, tick comment, row title); residual recorded (Q4) |
| L1-1 = L4-4 | MINOR — question | After a shell remount mid-deploy (rotation across 768 px, or back-to-hub then return), the new shell's hold is silently denied until the first request settles (~150 s bound while the server is reachable) | CONFIRMED with corrections: the shell is chosen by `useIsMobile` (`App.jsx:2213`, fork `:8801`), not `:2508`; in base the second press drew a 429 that renders as a misleading "Couldn't confirm the deploy"; a duplicate battle is improbable, not impossible | Q3 (BI-1 as built) |
| L3-2 | MINOR, pre-existing | A touch release queued behind a long main-thread task loses to the threshold frame | CONFIRMED, measured (build 6/6, base 6/6; mouse unaffected) | Recorded; Q4 |
| L2-6 | NIT — question | A denied second finger's lift cancels the first finger's hold | CONFIRMED (Edge 3/3; base identical; fail-safe) | Q5 / S2b's `inputId` |
| L4-3b | NIT | An owner that abandons its beat leaves the control "Locked in" until remount | CONFIRMED (RL2, RL4) | S2b (§10) |
| L4-5 | MINOR, record | Retry and the board's tap take no claim | CONFIRMED; wording corrected: within one shell `deployDisabled` guards except during the 450 ms beat, where a tap plus the hold make two calls — in base too | S2b (§10) |
| L4-6 | NIT | Vite HMR of `holdClaim.js` resets the slot in dev | CONFIRMED by reading | No change (dev only) |
| L3-5 | NIT | No re-entry guard on the listener attach | CONFIRMED as stated — no defect (only `start` attaches, after the state guard) | No change: no row could kill the line |
| L1 (parity) | — | Parity at all seven sites | — | 114/122 byte-identical; the 8 differences are the old hook's same-task duplicate abort |
| (builder) | — | The touched label's own capture loss bubbling to the button | — | BI-5 (`27d70178`); first commit message overclaimed a Chromium failure, corrected before push |
| (lint) | — | `no-unsafe-finally` on the owner rethrow; an `exhaustive-deps` warning | — | Fixed in `6cf0c79f` |
| L5-1 | MINOR | The D2 "Enter on a second control" row never checked the denied key's effects (M6 survived it) | — (mutation evidence) | **Fixed** (row) |
| L5-2 | MINOR | BI-4 had no row: every disabled row ran inside `act` (M59 survived) | — | **Fixed** (row, act-less) |
| L5-3 | MINOR | No row for a rejected deploy promise (M60 survived) | — | **Fixed** (row; it listens for the one designed unhandled rejection in place of vitest's listener) |
| L5-4 | MINOR | The seam one-shot assertion was vacuous (M20 survived) | — | **Fixed** (row) |
| L5-5 | MINOR | A settled Locked-in control ignoring input had no row (M2, M5 survived — not the equivalents the brief expected) | — | **Fixed** (rows) |
| L5-6 | NIT | The revoked-beat cleanup half pinned (M61, M65) | — | **Fixed** (rows) |
| L5-7 | NIT | The settle releasing its own token unpinned (M67) | — | **Fixed** (row) |
| L5-8 | NIT | R-R2-8's "timer cleared" pinned only by outcome (M25) | — | **Fixed** (assertion) |
| L5-9 | NIT | A stable control id per button had no row (M40) | — | **Fixed** (row) |
| L5-10 | NIT | The r2 header overstated which same-act rows are browser-reachable | — | **Fixed** (header; §4) |
| L5-11 | NIT | The act-less helper rests on scheduler internals | — | **Fixed** (a self-check row) |
| L5-12 | NIT | A leak in the r2 file's last row would go unseen | — | **Fixed** (sentinel row) |
| L5-13 | NIT | Two files' `cancelAnimationFrame` stubs clear every frame | — | Recorded (harmless with one control per row) |

**Net:** 16 unique lens findings and 13 from L5. No finding was refuted outright; the refuters refuted or recalibrated sub-claims in six (L2-1b's evidence and severity, L3-1's premise and citations, L3-Q2's capture-loss half, L4-4's citation and base comparison, L4-5's wording, L3-3's fix). No BLOCKER. The one MAJOR is the STOP.

### 8.3 Checked and found sound (from the lens reports)

Every R-R2-4 trigger is wired, idempotent (one abort for any pair) and leaves no listener behind (eight exits checked); StrictMode double effects attach nothing twice; renderToString is safe; no denied claim has any effect but the pre-claim `preventDefault` the old hook also had; one commit per hold and never an abort after a commit; the settle releases its own token, never a newer one; within one shell no render shows the button enabled while the claim is held (real timers); HubHold is dark and claims nothing.

### 8.4 Mutation record (L5)

L5 ran the 53 listed mutants on a snapshot of `5a8f8119`, one at a time (the five R2 files plus `starfield.intent.test.jsx` per run; restores checked by SHA-256 against the pre-run file), then devised M54–M67. Mutant list and runner: §13.

- **Killed at first: 48 of 53.** Each row in `mutants.json` names what it breaks; the killing rows are in L5's run logs. Notable: M16 (locked set after `onCommit`) is killed only by the seam's reentrant-`onCommit` row; M17 (no teardown of a revoked token) only by "a claim revoked inside the threshold frame"; M46 (no per-frame token check) only by L4-2's row; M53 (state-only guard) only by the restart row; M52 (touch captured again) by the touch/pen/typeless rows.
- **The sky tests** went red only under the leak mutants (M23, M29, M39, M58); they never caught a sky-stream mutant, so for those the R2 rows are the only guard.
- **Survivors, now killed by rows added in `72a37037`** (re-run by the builder on the same snapshot, every restore SHA-checked): M2, M5, M6 (it survived its D2 row; the seam rows killed it), M20, M25, M40, and L5's M59, M60, M61, M65, M67. Each fails exactly the row written for it.
- **Equivalent, named:** M54 (the unmount cleanup's own detach — `cancel()` in the same cleanup detaches while charging, and the commitment already detached when locked); M62 (a revoked run keeps a stale `tokenRef` — the next claim overwrites it and every reader is gated); M63 (capture without the `pointerId` check — a real pointer event always carries one); M66 (`cancel` keeps its released token in `tokenRef` — every reader is gated by `stateRef` or the beat timer).

## 9. Real-browser measurements (headless Edge 155, playwright-core, real CDP input)

The shipped `HoldToDeployButton` was bundled (esbuild) from each tree with two instances (filled A, muted B), every pointer event and sky terminal logged. Harness and results: §13.

### 9.1 Main vs R2 after the founder rulings (`0fc78b02` vs `c29fff3b`), Chromium (headless Edge 155) only

`c29fff3b` holds the rulings' pointer code; `f1b5a705` changes only the owner path and comments, which this harness does not exercise.

| Scenario | Main | R2 |
|---|---|---|
| T1 touch hold on the label, 1.6 s, finger jitter | deploys once; capture on the label | **same events** |
| T2 touch hold on the padding | deploys once | same events |
| T3 touch release at 600 ms | one abort at release | same events |
| T4 two fingers on A and B | **both deploy** (D2) | A only |
| M1 mouse hold still | deploys once; nothing captured | same events |
| M2 mouse drags off at 400 ms, keeps holding, releases outside | abort at the drag-off | **same events** |
| M3 mouse drags off at 400 ms, releases outside at 800 ms | abort at the drag-off | same events |
| K1 Enter, then held (auto-repeat) | deploys once | deploys once |

Before the rulings (`5a8f8119`, mouse captured) M2 deployed and M3 aborted at the release instead of the drag-off; before the STOP (`27d70178`) touch was captured too.

### 9.2 Other runs

- RL2: a button unmounted by a non-event update committed in the window 24/26 times before the fix, 0/24 after; two touch points on one button — the second finger's lift cancels the first in base and R2 alike (3/3).
- RL3: a touch release behind a 300 ms main-thread task straddling the threshold commits in base and R2 alike (6/6 each); mouse aborts (2/2); with no task the same lift aborts at p 0.93–0.96. In a headless background tab the page stayed "visible" with frames throttled to 1 Hz (not a headed-browser state).
- Not possible here: hiding or blurring the page in headless; Android's real input pipeline; any WebKit or Gecko (none installed — installing one is a download needing your permission, and Playwright's desktop WebKit would not exercise the iOS touch path anyway).

### 9.3 Why no pointer is captured (the evidence behind the STOP, now ruled)

Explicit capture adds nothing for touch: the platform already captures a touch to the element touched. Moving it to the button changes which element the following moves target. What WebKit does then (source read at WebKit `main`):
- VERIFIED: touch-derived pointer events are created with a null `relatedTarget` (`Source/WebCore/dom/ios/PointerEventIOS.cpp`).
- VERIFIED: when a touch move's target differs from the previous one, `dispatchBoundaryEvents` fires `pointerout`/`pointerleave` at the old target (`Source/WebCore/page/PointerCaptureController.cpp`, `dispatchEventForTouchAtIndex`).
- VERIFIED: the open (WPE/GTK) caller passes the capture element as the move target; WebKit bug 220196 reports the related iOS behaviour.
- VERIFIED: implicit touch capture is only a pending target before `pointerdown` listeners run, so the button's capture replaces it and the label never fires `lostpointercapture` (same in Gecko: `lostpointercapture` only for a previously active override — `dom/events/PointerEventHandler.cpp`).
- ASSUMED, unread: the iOS caller (`WebKitAdditions`, closed). If it targets the capture element as the open one does, the second move of a hold that starts on the label or icon fires `pointerout` on the label with a null `relatedTarget`; React then fires the button's `onPointerLeave` and the hold cancels within tens of milliseconds (jsdom repro: `["abort"]`, no deploy). Before R2 the capture stayed on the label, so the target never changed.
- Gecko's boundary events on a capture change: not read (ASSUMED unknown).

The build stopped the touch and pen half of R-R2-3 on this evidence; the founder then withdrew the capture half for every pointer type (Q1/Q2, §14), so a mouse also keeps main's drag-off cancel. Every pointer takes main's path (measured identical in Edge, §9.1).

## 10. What S2b inherits

- **The seam.** `onCommit(token)` (synchronous, after the lock); `beatOwner.commit(token, run)` (the owner's beat survives unmount; `run` is one-shot and releases the claim when onComplete's result settles; an owner that throws does not get the beat). `currentHold()`; `releaseHold(token)` revokes: a charge ends at its next frame, a beat run after the revocation deploys nothing. The cleanest revocation is through props: flipping the control's `enabled`/`disabled` cancels in the same commit.
- **The legacy unmount-during-beat case** (R-R2-8): in today's shells, unmounting the control during the 450 ms beat cancels the deploy. S2b's provider-owned beat is what closes it.
- **The tap admission** (R-R2-10, L4-5): the Scouting Board footer, ceremony-off taps and Retry take no claim; a tap during a hold's beat makes two calls (base too).
- **Gaps L4 listed:** `claimHold` takes neither `inputId` nor `holdEpoch` (spec §5.5); `currentHold()` is pull-only (no subscribe); progress lives in the hook's React state (no owner-tagged store); `HoldToDeployButton` does not forward `onCommit`/`beatOwner`; an owner that abandons a beat has no way to return the control to idle (L4-3b).
- **`holdEpoch`**: S2a's `canCommit` requires a valid epoch on the hold; S2b stamps it.
- **A hiding boundary** (Activity/Suspense around a hold) would run the layout cleanup without unmounting; a hidden legacy beat would then show "Locked in". No such boundary wraps the dashboards today.
- **BI-1 and the safety release**: the in-flight claim is released by the settle, or by token 180 s after onComplete ran; an unmount clears neither (§14).
- **Second-finger ownership** (founder ruling on Q5): a denied second finger's lift cancels the first finger's hold (base identical; it can only cancel). S2b closes it with the input id spec §5.5 gives `claimHold(controlId, inputId, holdEpoch)`.
- **The decide 429 copy** (moved here by the founder from §12): "Deploy already in progress" renders as "Couldn't confirm the deploy" (lost-contact tone; the body carries no `details`, `CeremonyError.jsx:85`) — misleading while the first deploy is still creating the battle (RL4). S2b composes refusal words (R1 report §10).
- **A note for test authors** (rulings review F1-4): `vi.runAllTimers()` over a hold deploy now advances the fake clock 180 s more and fires the safety release before the settle's microtask; use `advanceTimersByTime` or `runAllTimersAsync`.
- **An unruled corner** (rulings refuter RF1): an `onCommit` that unmounts the control synchronously, followed by an owner whose `commit` throws without running the beat, arms the fallback after the unmount, so the deploy fires from an unmounted control. Doubly contrived, identical before and after the rulings round; recorded, not changed (a fix would change unruled semantics).

## 11. Founder questions — answered 2026-10-21

| Q | Ruling | Applied |
|---|---|---|
| Q1 touch/pen capture (the STOP) | **No explicit pointer capture for any pointer type**; R-R2-3's capture half withdrawn, the claim-first half stands; the button's own `onLostPointerCapture` cancel kept as a defensive guard (BI-5) | `c29fff3b` (§14.1) |
| Q2 mouse drag-off | Same ruling: a mouse dragged off the button cancels on leave, as on main | `c29fff3b` |
| Q3 the in-flight claim after a remount | **Keep BI-1 and add the bounded safety release now**: `HOLD_CLAIM_SAFETY_RELEASE_MS = 180000` (exported); armed when run calls onComplete; cleared by the settle; a throwing onComplete releases at once; not cleared by unmount; token-scoped | `c29fff3b`, `9630965d`, `f1b5a705` (§14.1–14.2) |
| Q4 stall guard | A separate task, not R2 | §12, open |
| Q5 pointer ownership | S2b (`inputId`) | §10 |

## 12. Found outside R2 (for separate tasking; not fixed)

- **A gated fenced-server task** (founder ruling): `api/agent/decide.js` (fenced) — the deploy lock is a check-then-write (read at `:156`, checked at `:181–186`, written at `:215–216`), not a transaction, so two near-simultaneous POSTs can both pass it; and a clone-ensure divergence (one request falls back to the ranked agent, the other resolves the clone) locks two different agent documents — a duplicate-battle path that exists today through Retry (RL4).
- **Open, a separate task** (founder ruling on Q4): a stall guard. A touch release processed after a long main-thread task loses to the threshold frame (pre-existing, measured in Edge, base and R2 alike); a suspension with no visibility event commits on the next frame. A guard needs the release's timestamp compared with the threshold, or a deferred commitment. Only `starfield.intent.test.jsx:251–258` (must pass unmodified) constrains it.
- **Rides a later change** (founder ruling; `starfield.intent.test.jsx` is not touched): `starfield.intent.test.jsx:179`'s comment "past the 1300ms hold => fireComplete" is wrong (that hold reaches p 0.846, RL3); `featureFlags.js:1836` still says the sky coupling is "FALSE (CURRENT)"; the flag is true at `:1856`.
- The decide 429 copy moved to S2b's list (§10).

## 13. Files outside the repository, and next

Scratchpad of this session (`C:/Users/fashr/AppData/Local/Temp/claude/…/scratchpad/`): `failing-first.clean.txt`, `failing-first-review-rows.txt`, `failing-first-capture-rows.txt`, `browser/` (harness, `results-first.json`, `results-fixhead-24d3efcf.json`, `results-5a8f8119.json`), `review/` (brief, findings, `mutants.json`, `mutate.mjs`). Report copy: `C:/Users/fashr/Documents/FantasyTrades/CommandCenter/20261021_BUILD_DEPLOY_R2_HOLD_CLAIM.md`.

**Next:** the independent Fable review of PR #985. Rulings-round artifacts in the same scratchpad: `failing-first-rulings.txt`, `mutation-rulings.txt`, `browser/results-c29fff3b.json`, `review/findings-F1.md`.

## 14. Founder rulings applied (2026-10-21)

Start of the round: `git fetch origin`; branch `claude/deploy-r2-hold-claim-dadf73` at `56d27736` = the remote PR head; clean tree; `origin/main` still `0fc78b02`; PR #985 open, draft, not merged.

### 14.1 The rulings and the commits

| Ruling | What was done | Commit |
|---|---|---|
| Q1 + Q2: no explicit pointer capture for any pointer type; R-R2-3's capture half withdrawn, claim-first kept; `onLostPointerCapture` (BI-5) kept as a defensive guard | `capturePointer` deleted; `start` takes no argument again and `onPointerDown` is main's line byte for byte; the header's capture section says no pointer is captured and why; the capture rows replaced (§14.2) | `c29fff3b` |
| Q3: keep BI-1 and add the bounded safety release | `HOLD_CLAIM_SAFETY_RELEASE_MS = 180000` exported; when run calls onComplete it arms `setTimeout(() => releaseHold(token), 180000)`; the settle clears it and releases as before; a throwing onComplete clears it and releases at once; the timer is a closure local the unmount cleanup cannot reach; it releases by token | `c29fff3b` |
| Rulings review F1-1 (an owner that runs the beat, then throws, left a dead beat-timer id that a later unmount read as a pending beat, freeing the in-flight claim — inherited from `56d27736`) | the owner-throw fallback re-arms the beat only if the run has not run (`if (!ran)`) | `9630965d` |
| Rulings review F1-2, F1-3 | rows for an owned beat's safety release and for a revoked beat arming none; "who releases" prose names the safety release (`holdClaim.js`, the hook) | `9630965d`, `f1b5a705` |
| Q4 stall guard | recorded open, a separate task | §12 |
| Q5 pointer ownership | recorded for S2b | §10 |
| §12 items | decide.js lock → a gated fenced-server task; the 429 copy → S2b's list; the two stale comments ride a later change (`starfield.intent.test.jsx` untouched) | §10, §12 |

No pre-existing test was edited: the four sky tests and every non-R2 test are unmodified; of R2's own rows only the capture rows the ruling replaces changed. The new timer forced no edit anywhere (so no STOP).

### 14.2 New rows, failing first

Run against the head before them (logs `failing-first-rulings.txt`, and the F1-1 rows against `c29fff3b`).

| Row | File | On the earlier head | Why |
|---|---|---|---|
| a mouse / touch / pen / typeless pointer is never captured (×4) | `useHoldToDeploy.r2.jsdom.test.jsx` | mouse **failed** on `56d27736` ("called 1 times"); touch, pen, typeless passed (already uncaptured there) | the ruling |
| a mouse dragged off mid-charge cancels on leave: one abort, no onComplete | same | passed (jsdom has no capture semantics) — the real evidence is Edge M2/M3 (§9.1: deployed at `5a8f8119`, aborts now) | guard + Edge |
| is 180,000 ms | `useHoldToDeploy.safetyRelease.jsdom.test.jsx` | **failed** (`undefined`) | Q3 |
| a never-settling deploy holds the claim at 179,999 ms and frees it at 180,000; a second control can then claim and deploy | same | **failed** (slot still held) | Q3 |
| an unmount after onComplete started does not cancel it | same | **failed** (slot still held at the bound) | Q3 |
| an early settle clears it, and a newer hold claimed afterward survives the 180 s mark | same | **failed** (no timer to count) — its guard value is against a settle that does not clear | Q3 |
| a first request that settles after its safety release does not free the newer hold | same | **failed** (no release at the bound, so no newer hold) | Q3 |
| being token-scoped, it never frees a hold claimed after its own was revoked | same | passed (guard) | Q3 |
| an owned beat run synchronously by its owner gets the safety release too; an owned beat run after the control unmounted | same | passed on `c29fff3b` (guards; F1-2) | F1-2 |
| an owner that runs the beat and then throws: a later unmount does not free the in-flight claim | same | **failed** on `c29fff3b` | F1-1 |
| …nor can that owner's commit lose a later committed deploy on the same control (RF1's cross-cycle repro) | same | **failed** on `c29fff3b` | F1-1 |
| a beat revoked before it runs arms no safety release | same | passed on `c29fff3b` (guard; F1-2) | F1-2 |
| a synchronously throwing onComplete releases at once and leaves no safety timer behind | same | passed (guard) | Q3 |

Removed (replaced by the ruling): "a mouse pointer down captures the pointer …", "a denied pointer is never captured", "a capture the platform refuses does not break the hold".

### 14.3 What changed, by `file:line` (code head `f1b5a705`)

- `src/hooks/useHoldToDeploy.js`: header "NO POINTER IS CAPTURED" `:42–50`; the claim's lifetime with the safety release `:84–93`; the seam `:95–102`; `HOLD_CLAIM_SAFETY_RELEASE_MS` `:192–197`; `run` `:334–368` (revoked-token return `:342–348`, the safety release armed `:352`, cleared on a throw `:357`, cleared by the settle `:364–367`); owner fallback `if (!ran)` `:392`; `start` `:440–455` (no capture); `bind` `:535–545` (`onPointerDown` main's line; `onLostPointerCapture` `:532`, `:541`).
- `src/hooks/holdClaim.js`: "who releases" `:33–37`; functions now at `:42–74`.
- Tests: `src/hooks/useHoldToDeploy.r2.jsdom.test.jsx` (51 rows; capture rows `:423–457`); new `src/hooks/useHoldToDeploy.safetyRelease.jsdom.test.jsx` (12 rows). R2's rows now total 116.
- Not touched: every call site, both shells, `agentDeploy.js`, the sky files, anything under `api/`, any fenced file.

### 14.4 Review of the round

- **Lens F1** (one focused lens on its own snapshot of `c29fff3b`): parity with main's pointer path — **no findings** (`bind`, `start`, effects at pointerdown identical to main apart from the claim and R2's cancel set; no capture code left; Edge identical to main in every single-hold scenario; BI-5 harmless). The safety release — no BLOCKER or MAJOR: it cannot free a newer hold, survives unmount, StrictMode and the re-enable reset, leaks no timer (five settled deploys leave none), and changes no existing test (no test that renders a hold uses `runAllTimers`; every `getTimerCount` check predates onComplete). Findings: F1-1 MINOR (inherited), F1-2 MINOR (test gap), F1-3 NIT (prose), F1-4 NIT (`runAllTimers` note).
- **Refuter RF1** (fresh snapshot): F1-1 **CONFIRMED**, and wider — the hole opens at the throw, not after 450 ms, and a cross-cycle repro showed one bad owner commit later losing a well-behaved owner's deploy on the same control; the `if (!ran)` fix is correct and sufficient across six owner shapes (and the alternative, nulling the ref in the one-shot branch, was rejected). F1-2 **CONFIRMED** (mutant "owned beats get no safety release" MINOR; "a timer armed before the revoked check" NIT). F1-3 **PARTLY** (the `:85–86` claim refuted — that paragraph already named the safety release; `:98`'s "its run releases the claim" added as imprecise). F1-4 **CONFIRMED**. One aside, recorded in §10.
- **Mutation** (builder, on a snapshot of `f1b5a705`, restores SHA-checked independently; log `mutation-rulings.txt`; baseline 116 rows): **14 of 14 killed** — RS1 no safety release (7 rows), RS2 the settle does not clear it (the early-settle row), RS3 it frees the slot's holder rather than its own token (the token-scoped row), RS4 it is tied to the beat ref so unmount clears and releases it (5 rows, the unmount row among them), RS5 the throw path leaves it armed (the throw row), RS6/RS7 the bound off by one millisecond either way (5 and 7 rows), RS8 capture re-added for every pointer (the four never-captured rows), RS9 capture for a mouse only (the mouse row), RS10 the BI-5 guard removed (the bubbled-label row), RS11 leave unbound (the drag-off row), RS12 owned beats get no safety release (3 rows), RS13 a timer armed before the revoked check (3 rows), RS14 the F1-1 fix removed (both F1-1 rows).

### 14.5 Checks

| Check | Head | Result |
|---|---|---|
| Full suite, Linux (WSL private clone, Node 20.20.2, `TZ=UTC`, `--maxWorkers=2`, CI-shaped) | `f1b5a705` | **Test Files 1053 passed, 7 skipped (1060); tests 22,772 passed, 0 failed, 88 skipped; exit 0**; 646 s |
| Targeted: the six R2 files + the four sky files | `f1b5a705` | 10 files, 272 tests passed (116 R2 rows) |
| `lint:gate` | `f1b5a705` (Linux) | exit 0; re-run at the pushed report head — PR description |
| `vite build` | `f1b5a705` (Linux) | exit 0 (built in 26 s); re-run at the pushed report head — PR description |
| Headless Edge, real input | `c29fff3b` vs main | §9.1 — identical to main in every single-hold scenario |
