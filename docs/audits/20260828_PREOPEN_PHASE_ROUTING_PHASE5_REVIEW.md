# Pre-open Phase Routing — Phase 5 cumulative review (BUILD_RULES §2)

**Branch:** `claude/preopen-phase-routing` · **Reviewed at:** `7b7ad1e3`, fixes through `b474a5f7`
**Base:** `origin/main` `621c25ca` (rebased from `0abc6cbe`; PR #790 in between)
**Diff at review:** 28 files, +1266 / −36 — **over the §2 threshold** (≥10 files), so the full review applies.
**Flag:** `PREOPEN_PHASE_ROUTING_ENABLED` — **dark**. Nothing below reaches a user until it flips.

## Method

Multi-lens and adversarial, per §2:
1. `/code-review` at high effort over the cumulative branch diff.
2. **Two independent adversarial agents**, each instructed to *refute*: one on cross-surface coherence (the founder's Sol question), one attacking the review fixes themselves.
3. Every finding re-verified by hand at `file:line` before acting.
4. Mutation checks on each new guard.
5. Explicit `vite build` (no test imports `App.jsx`).

**Disposition: 11 findings — 10 CONFIRMED, 1 REFUTED. 8 fixed, 2 deferred by ruling, 1 recorded as a documented limit.**

---

## Confirmed and fixed

| # | Severity | Finding | Fix |
|---|---|---|---|
| R1 | **HIGH** | **Stale clock.** `now` was seeded in state at mount and advanced only by a ticker that arms *while the phase is already true*. A tab open at 23:50 the night before held yesterday's date, so the ~06:00 flip evaluated against the wrong ET day and returned false — the live surface for the entire pre-open window. The exact defect the hook exists to prevent, inverted. | Clock read at render; tick is only a re-render trigger. `usePreOpenPhase.js:38-58` |
| R2 | **HIGH** | **Ranked day-1 claim window removed.** Phase 3 routed pre-open competitive pods to `LiveDraftAwaiting` (no claim controls) and suppressed the classic body. `place-claim.js:96-97` requires BATTLE and the wire shuts 09:24 ET, so Mon ~06:00–09:24 is the *only* day-1 claim window a competitive pod has. A label fix removed a capability. | Ladder revert; `showBattleBody` is `status !== FORMING` in every arm again. |
| R3 | **HIGH** | **The R2 fix was itself incomplete** (found by the second adversarial pass). It left `&& !preOpen` on the arena gate — and the arena is the *default* ranked surface with its own claim doorway (`buildArenaModel.js:458-465`, `:543`), so the user was still demoted onto the legacy column. With the ladder reverted there was no awaiting surface left to preempt, so the gate's justifying comment was false and it traded one live body for another, under an awaiting header. | Arena gate reverted. **Ranked scaled back to a safe subset** — see Deferred. |
| R4 | MED | **Flag-off delta.** `showAwaiting` carries the pre-existing, non-flag-gated `v2On && status === AWAITING_OPEN` term, so gating the arena on it changed behaviour with the flag **off**. Breaks the dark-merge guarantee. | Gate binds to `preOpenRouting` (the flag-gated half). `LeagueTrainingBattleView.jsx:99-100`, `:201` |
| R5 | MED | **Four sites, two bindings.** The block comment claimed the practice sites could not drift, but only two of four bound to `showAwaiting`; a V2 rollback would print "awaiting open" over the classic live body. | All four bound; comment corrected to state what is actually guaranteed. |
| R6 | MED | **Pre-draft copy on a post-draft pod.** `WhileYouWait`'s non-inBattle arm said "Keep your instincts sharp *before the draft*" — previously reachable only for FORMING, now reached by a pre-open BATTLE pod that drafted minutes earlier. | Three-way copy. `WhileYouWait.jsx:139-145` |
| R7 | MED | **Test integrity.** The hook suite was `renderToString`-only, so it never ran an effect: the ticker and the clock — the hook's whole reason for existing over a bare predicate — were unguarded. **R1 shipped through this gap.** | New jsdom suite (`usePreOpenPhase.rerender.test.jsx`). Mutation-checked: stale clock reds 2 rows, deleted ticker reds 3, dropped flag short-circuit reds 3. |
| R8 | MED | **Two overstated claims in shipped docs.** `featureFlags.js` promised "ranked → LiveDraftAwaiting" (no longer true); the practice comment claimed "byte-identical" without scoping it to flag-off (with PREOPEN on + V2 off the hook still ticks). | Both rewritten to state the partial coverage and the cadence caveat honestly. |

## Confirmed, deferred by ruling — the answer to the Sol question

The founder asked: *can any surface in the diff disagree with another about the same pod?* **Yes — and the honest answer is that the shipped subset is coherent only because ranked was scaled back.**

| # | Finding | Disposition |
|---|---|---|
| R9 | **The live-watch CTA contradicts its own header.** `WhileYouWait` renders "While you wait" while `liveWatchPod` (`:83-91`) classifies pods by the adapter's `status === 'live'` — chokepoint B — and `watchFocusId` prefers the viewer's **own** seat. So one component can call the same pod pre-open and offer to spectate it as live. Slot pods satisfy both `selectMyGroup` and `selectBaseLayerField`, and are the only ranked pods with an anchor, so the deferral and the derivation intersect on *exactly the same population*. | **Deferred (R-9).** Root cause is chokepoint B. Recorded as an executable **documented limit** in `WhileYouWait.smoke.test.jsx` — it pins the contradiction so it fails loudly when chokepoint B lands. The prior suite passed an empty `st` and was structurally blind to it. |
| R10 | **Ranked remains unfixed pre-open.** After R3, once the agent deploys (~06:00) the arena takes over and reads live until the bell. Only the pre-deploy window gets the honest header. Fixing ranked needs claim controls on `LiveDraftAwaiting`, or an awaiting state in the arena (Phase 0b shape (ii), rejected by R-1). | **Needs a ruling.** Stated at the flag, in the gate comment, and here. Both routing reverts are pinned by mutation-checked source-text guards, since no test mounts `LeagueParticipantView`. |

## Refuted

| # | Claim | Why it fails |
|---|---|---|
| R11 | "The same pod can render in both the practice and ranked hosts, and disagree." | Impossible. `selectMyGroup` excludes `isTraining`; `subscribeMyTrainingPod` requires it (`tournamentGroupService.js:193-194`, `:272-279`). The practice/ranked asymmetry is real but cross-mode, never same-pod. |

## Attacked and survived

- **The predicate is sound.** BATTLE ⟹ anchor ≤ today at both write sites, so the derivation is monotonic true→false and cannot strand. DST-safe via `getEtParts`.
- **Clock-at-render is safe under StrictMode/concurrent React** — `preOpen` is a plain boolean, the updater is functional and strictly increasing, and no React Compiler plugin is configured.
- **Every entry path arms the ticker**; the one theoretical exception (BATTLE with a future anchor crossing midnight) is unproducible by construction.
- **The two draft-room completion cards agree** — identical expression, same `group`, locked by the parity tripwire.
- **No import cycle**; `leagueTournament.js` has zero imports, so the new `api/ → src/` edge is safe.
- **Test isolation is clean**; the jsdom suite leaks no timers, roots or act state.

## Known residuals (recorded, not fixed)

- **Multiple independent tickers.** Each call site owns its own 30s interval, so two hooks on one screen can disagree for ≤30s across the bell (`LeagueDeskParts.jsx:458` / `:514`). Pre-existing to the fixes; visible consequence is a late card swap. The §9 "parallel source" pattern — worth consolidating if chokepoint B lands.
- **Background-tab throttling** can push the flip past the ≤30s bound.
- **Practice under a V2 rollback** reads live pre-open; this flag does not change that. Documented at the flag.

## Verification

- **Full suite: exit code 0 asserted** — `Test Files 514 passed | 1 skipped (515)`, `Tests 8499 passed | 62 skipped (8561)`, zero `FAIL` markers. Summary read directly, ANSI-stripped.
- **`vite build`: exit code 0 asserted.**
- **Mutation checks:** predicate (4 mutations), hook (3), ranked routing guards (2) — every one reds its own suite.
- **Flag-off:** the pre-existing suites for every touched file passed unchanged before new rows were added.

## Standing recommendation

Do not flip the flag. Beyond R-8's anchor-stamp gate, R10 means ranked would ship a header-only change while the arena still reads live, and R9 means a pod can read "awaiting" on its own screen and "live" in the field list. Both resolve with chokepoint B, which is itself gated on the anchor stamp.
