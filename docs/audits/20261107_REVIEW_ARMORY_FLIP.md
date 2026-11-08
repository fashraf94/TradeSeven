# Review: the armory flip (PR #1033)

**Review date:** November 7, 2026 (CT) · **Model:** Fable · **Reviewed:** `claude/armory-flip` @ `023d6aa5`, which contains `main` @ `7b1d8d26` (merged as `477b96fe`); every diff below is against `7b1d8d26` · **PR:** [#1033](https://github.com/fashraf94/TradeSeven/pull/1033), open and marked ready (not draft) at the time of this review, left as found · **Build report:** `docs/audits/20261107_BUILD_ARMORY_FLIP.md` · **Smoke branch:** `claude/armory-flip-smoke` @ `f2e826e6`, out of scope; only its absence from the PR is checked · **Finding ids:** AF-1, AF-2, …

**Preamble.** `git fetch origin` ran first: `origin/claude/armory-flip` = `023d6aa5` and `origin/main` = `7b1d8d26`, the heads the brief names, so the STOP does not apply; `7b1d8d26` is an ancestor of `023d6aa5`. This review made no code change and did not merge `main`. It worked from the app worktree `claude/review-armory-flip-pr-75b7e2`; this document is its one commit, built by git plumbing onto `023d6aa5` and pushed by refspec (the branch is checked out in another worktree at an older tip). Linux runs were WSL worktrees of `~/pd-ci` with `node_modules` linked to `~/pd-af0` (lockfile blob `7608d574` on `main`, the head and the install): `~/pd-ci-afr` @ `023d6aa5` (the head's builds), `~/pd-ci-afrm` @ `7b1d8d26` (`main`'s builds, the red-row sweep) and `~/pd-ci-afrx` @ `023d6aa5` (the kill-switch and step-1 builds, the kill-switch mutants, the rules suite in three states, the two rollback suites, this review's mutants). Node 22.22.2, JDK 21.0.13, `TZ=UTC`, 8 workers, each full suite under `flock /tmp/pd-suite.lock`; runs under `~/pd-afr-runs`. Subagent reviewers and refuters each worked on their own LF `git archive` extraction under the session scratchpad (eight snapshot trees for the lenses, six for the refuters), read-only on git. Fenced files read, never edited, never called: `api/_utils/agentBattleService.js:193` and `api/agent/decide.js` (`:370`, `:931-933`, `:964`, `:1554`), for lens 8. The founder's phone check runs while this review does and is recorded as pending (§6).

---

## In plain language

The switch itself is right. With both switches set back off, the app builds byte for byte as `main` does today; with them on, the only difference from `main`-with-the-switches-on is the two log lines the founder asked for. Every one of the 270 test rows that hold the switches off goes red the moment it is made to run with them on, so each is guarding something a rollback would restore; the two rollback dry runs redden only the pins and the guard that points at them; the Firestore rules suite is green in all three switch states; and the census is read-only by construction. No battle can be left with every card refused. Five small things should be fixed before merge, all in tests, comments or the report, none in the app: one copy of the clone-ensure code that no test ever runs, a census test that cannot see a missing field, the League arena's reduced-motion hand-off that no row pins, a sentence in the report that claims a safety mechanism 13 test files do not use, and a pointer the casual-clone flag's own comment lacks. Everything behind the switches was reviewed in A1 and A2 except both builds' fix passes, which this review lists; the softer, breathing core is one of them, and it reaches the battle and League figures too, so the founder's phone check should look at those as well as the hub.

## Verdict: MERGE AFTER FIXES

**Findings:** 0 blocking · 5 should-fix (AF-1 to AF-5) · 15 notes (AF-6 to AF-20) · 8 refuted (§4). Every should-fix is a test row, a comment or a report sentence; no app code needs to move. **Checks:** both builds exit 0; the kill-switch build differs from `main` in 0 of 55 non-map files; the flags-on build differs from `main`-plus-literals in exactly FL4's two strings; rules suite 33 files / 641 rows green in all three flag states; rollback step 1 reddens 2 rows (the per-game pin and the guard), step 2 reddens 3 (both pins and the guard); 270 of 274 kill-switch rows mutation-verified; 9 of 12 kinds of mutant of this review killed, the 3 survivors being the findings AF-1, AF-3 and AF-6.

| # | Lens | Result |
|---|---|---|
| 1 | **The source-diff claim** | **Holds.** Outside tests, fixtures, docs, `.gitignore` and the census script: `src/config/agentFormFlags.js` and `src/config/perGameLoadoutFlags.js` (a literal and a docstring each) and `src/services/agentDeploy.js:194-243`. The `else` arm's 24 body lines are byte-identical to `main`'s block (`cmp`); the flag-on arm differs from it in the two `console.warn` strings only; lines 1-193 and 244-end are `main`'s. Nothing from the smoke commit reached the PR (§3.1). |
| 2 | **The kill switches** | **Hold.** Both literals `false`: raw `diff -rq` of the unminified Linux builds, maps excluded, **0 of 55 non-map files differ**, the entry `index-D8o2oLzt.js` in both; 1 map differs (the entry's). Flags on against `main` with the literals `true`: **56 of 57 non-map twins**, the entry chunk differs in exactly 2 lines each way, FL4's two strings. Rollback dry runs with the pins untouched: step 1 **2 red rows** (the per-game pin and the guard row naming it), step 2 **3 red rows** (both pins and the guard). Rules suite: both on, step 1, both off, each **33 files, 641 rows, exit 0** (§3.2). |
| 3 | **The red rows** | **Hold, with one report sentence wrong (AF-4).** Expect-line diff `main` → head over the 45 changed test files: 5 lines removed, all in the two pin files; the 186 rewrites removed or loosened no assertion (reviewer A, line by line). 17 files carry a `KILL_SWITCH_ROWS` set, 169 entries: 0 name mismatches, 169 of 169 red with the set emptied, 0 pass in both states; the 5 whole-file-off files redden 48 / 4 / 9 / 19 / 21 rows with their mocks flipped, the report's counts. The hub's lock stub hides nothing the rewritten rows look at; the locked League is driven by A2's `CommandCenterHub.loadouts.jsdom.test.jsx:181,203,223,343,359,371`. The sweep reproduces the report's 464 red rows in 42 files on `main` with both literals `true` (§3.3). |
| 4 | **FL3 and the pins** | **Match the rulings.** Both literals `true`, both pins `true`, both `DARK_BY_DESIGN` entries out, the guard's integrity row bites (mutant M-R2, 2 rows), the rollback paragraph is word-identical in its five places, the two-step order is enforced by a row (`perGameLoadoutFlags.test.js:68`), and FL3's row is the one and only red row when casual clones go off (27 rows, 1 red). Notes: the order row has no remedy message (AF-10); the casual-clone flag's own docstring has no pointer to FL3 (AF-5). |
| 5 | **FL4-b** | **Holds, with two gaps.** `ceremonyDeployTarget.test.jsx:145-162` drives the flag-on arm's both branches; `:134-141` drives the `else` arm's non-ok branch; **nothing drives the `else` arm's `catch`** (AF-1). `readsOf('src/services/agentDeploy.js')` is exactly the FL4-b `if` line and the A2R-3 (b) `if` line; the exact-list row is the gate and the census row walks `src/` and `api/`; the shape regex is secondary and was already loose on `main`. No row asserts the two log texts: the build comparison is their only guard (AF-6). Both builds exit 0: unminified 111 files, minified 111 files. |
| 6 | **The census** | **Read-only by construction; one test gap (AF-2).** A frozen one-method reader over `collection → where → limit → select → get`; credentials only inside `main()`; counts only on stdout, no player id in the JSON, the name in `.gitignore`; locking and training decided by `leagueLockOf` and `selectMyGroup`'s own checks. Every field the lock path reads is in `GROUP_FIELDS`, but the fixture double ignores the mask, so the row named for it cannot fail under an omitted field. The report's two mutants reproduced; this review's CPU-seat mutant killed (3 rows). |
| 7 | **The CI fixes** | **Match CI-1.** 1 kill-switch row (its body unchanged, its name an exact match), 4 rewrites with assertions unchanged, 2 flag-on twins (R6: shelved at birth with `open` 0; the 409 with exactly `{ error, message, archetypeCodeId, current }` and nothing written), 0 deletes. The replay-owner rewrites hand the store a literal battle's field in the route's expression shape; the store never reads the battle, so it is behaviourally identical (§4, D-1 refuted). C1 re-run here: killed on the emulator (both twins) and in the default suite (6 rows). |
| 8 | **The production check** | **Holds; the alias case closes it.** `tapeTags.js:200` stores the raw `str(battle.agentContext.archetype)`, the OK path's `inputs.archetypeCodeId` is that same variable (`:233`), and `archetypeRegistry.js:123` resolves no aliases, so a non-canonical value cannot produce a tagged day at all; `agentBattleService.js:193` writes the field once; `firestore.rules:475-480` closes the client; no server path writes it (search). `tags_unavailable` is `card.js:94`, inside `sourceOfDay`, ahead of the store in both flag states. **No battle can have every card from its days refused for good.** The server half of the invariant is pinned by no test (AF-18). |
| 9 | **What goes live unseen** | **Listed (§3.9).** A1's fix pass (AR-1's fix, N3, N4, D-A, D-B, D-C) and A2's fix pass (A2R-1, A2R-2, A2R-3 (a) and (b), Q1, Q3) were built after their reviews and read by no reviewer; this PR's flag-on arm is console-only. Reduced motion holds the breath at its midpoint through the hub's real prop chain, pinned link by link; the battle seats' link is pinned; **the League seats' link is not** (AF-3). D-B and D-C reach every engine-drawn form, including the live battle and League figures (AF-9). `main`'s merge (#1030, #1031) reads neither flag and mounts no loadout piece. |
| 10 | **The rules dependency** | **Holds.** `git diff --stat 7b1d8d26 023d6aa5 -- firestore.rules`: empty. `main`'s last change to the file is `a3ecb897` (Nov 7, Q1): one hunk, one line, `'isCasualClone', 'rankedAgentId'])` → `'isCasualClone', 'rankedAgentId', 'loadouts'])` at `firestore.rules:286`. The founder's Console publish is exactly that line. |

---

## 1. The founder's rulings, checked against the code

| # | Ruling | In the code |
|---|---|---|
| FL1 | Both flags on together, in one commit with their pins | `8763e57a`: `src/config/agentFormFlags.js:101` and `src/config/perGameLoadoutFlags.js:39` are `true`; the pins `agentFormFlags.test.js:68` and `perGameLoadoutFlags.test.js:53` assert `true`; both `DARK_BY_DESIGN` entries gone (`flagPinGuard.test.js:153-159`, a note in their place); `// Pinned by:` at `agentFormFlags.js:100` and `perGameLoadoutFlags.js:38`. **VERIFIED** |
| FL2 | Kill switches; `LoadoutChooserSheet.jsx` and every flag-off arm stay; two rollback steps; a rollback moves a flag and its pin, `DARK_BY_DESIGN` stays out | `src/components/League/LoadoutChooserSheet.jsx` is byte-identical to `main`'s (the brief's `CommandCenter/` path exists on neither tree); the 13 other `CLIENT_READS` files are byte-identical to `main`'s; the five rollback paragraphs are word-identical and agree with the turned-around pin rows (FO-3's trap avoided); the order is enforced by `perGameLoadoutFlags.test.js:68-70`; the dry runs redden only the pins and the guard (§3.2). **VERIFIED** |
| FL3 | Per-game loadouts never run without casual clones (a pin row) | `perGameLoadoutFlags.test.js:72-80`: `expect(!PER_GAME_LOADOUT_ENABLED \|\| CASUAL_CLONE_CONCURRENCY_ENABLED, '<message naming the step>').toBe(true)`, the flag imported from the real `featureFlags.js`; casual clones `false` → 27 rows, exactly this one red, with its message. **VERIFIED** |
| FL4-b | The log lines true in both states through a doubled `try`; the `else` arm `main`'s block verbatim; the cleanup PR collapses it | `agentDeploy.js:194` (the comment), `:195-218` (the flag-on arm, `main`'s block with the two strings changed at `:211`, `:216`), `:219-243` (the `else` arm: 24 body lines `cmp`-identical to `main`'s `:195-218`); flag-off build identical to `main`'s, flags-on build differs by the two strings. **VERIFIED** |
| FL5 | §17.6's readings accepted | No change in this PR; `BackingPreviewScreen.jsx:725` shows Checking under `?preview=backing`, which the gate in `src/main.jsx:40` / `backingPreview.js:62-68` keeps off production hosts (AF-20). **VERIFIED** |
| FL6 | A read-only census of the League locks | `scripts/per-game-loadout-preflip-census.mjs` (§3.6); its production run is the report's claim (0 of 18), not re-run here by the brief. The construction is **VERIFIED**; the number is **ASSUMED** from the report. |
| CI-1 | The emulator rows: kill-switch, rewrite with no looser assertions, or delete only when the subject exists in neither state | §3.7: 1 / 4 / 2 twins / 0. **VERIFIED** |

---

## 2. Findings

### Should-fix (tests, comments and the report; no app code)

#### AF-1 · should-fix · the `else` arm's `catch` is executed by no row

**Where:** `src/services/agentDeploy.js:239-243` (the kill-switch path's thrown-fetch branch); `src/components/Dashboard/deployCeremony/ceremonyDeployTarget.test.jsx:109` (`cloneThrows`), `:134-141` (the one flag-off fallback row, `cloneOk:false` only), `:145-162` (the `cloneThrows` rows, all `perGame.on = true`).

**Evidence.** The only throw on the clone URL in any test is `ceremonyDeployTarget.test.jsx:109`, consumed only by the flag-on rows. Mutant M-R4b, the `else` arm's `catch` body line `:242` replaced by `throw err;`: `ceremonyDeployTarget` + `ceremonyTiming` + `agentDeploy.outcomes` **134 rows green** (WSL); the refuter widened it to all 22 files that import `agentDeploy.js`, **665 rows green**. One flag-off row (`perGame.on = false`, `cloneThrows:true`, expecting `success`, `reported` `[RANKED]`, `body.agentId === RANKED`, `cloneFallbacks` `['threw']`) reddens under the mutant and is green on the pristine file. The missing flag-off throw row is pre-existing (`main`'s `ceremonyDeployTarget.test.jsx:95-165` is byte-identical), but `main` had one `catch`, executed by the flag-on `cloneThrows` row; FL4-b made a second copy that nothing executes, and that copy is the rollback path. Today the arm is `main`'s text byte for byte, so the exposure is to a later edit of the arm, bounded by the cleanup PR that deletes it.

**Smallest fix (test only).** The row above, beside `:134`.

#### AF-2 · should-fix · the census test cannot see a field the mask omits

**Where:** `scripts/per-game-loadout-preflip-census.test.js:41-44` (the double returns whole documents and ignores `fields`), `:164-187` (the row named for the mask asserts the `select` list equals `GROUP_FIELDS`, the same export); `scripts/per-game-loadout-preflip-census.mjs:47-50` (`GROUP_FIELDS`).

**Evidence.** Delete `'battleStartWeek.anchorEtDate'` from `GROUP_FIELDS` and run the test: **12 of 12 still pass** (the refuter's run); against Firestore, fixture G's week would read null and the group `no_lock_end` stale. The mask is complete today: `selectMyGroup` reads `isTraining`, `status`, `updatedAt` (`src/constants/leagueTournament.js:686-694`); `leagueLockOfGroup` reads `id` and `status` (`src/constants/perGameLoadout.js:200-203`); `battleAnchorEtDateOf` reads the six week fields (`:165-172`); the census adds `groupMembers`; all ten are in the mask. The production zero does not depend on it (`locked` depends only on `status` and `isTraining`), but the founder is told to re-run the census just before merge, and a registration in that window creates exactly G's shape (`liveDraftFormation.js:394-414` stamps `battleStartWeek`), whose stale verdict does depend on the mask. A mask-honouring double (a Firestore-style pick of the field paths) gives the same answer as whole documents on the seven fixtures and reddens under the deletion. BUILD_RULES §2: a row that cannot fail under the defect it names is not a guard.

**Smallest fix (test only).** Make `readerOf` apply `fields` to the documents it returns (about eight lines); the existing twelve rows then become the guard.

#### AF-3 · should-fix · the League seats' reduced-motion hand-off is pinned by no row

**Where:** `src/components/League/battleArena/ClimbArena.jsx:237` and `FuseHero.jsx:104` (`reducedMotion={reduce}` from `prefersReducedMotion()`, `arenaEngineCore.js:214-215`); `src/components/AgentForm/engine/vocab.js:187-189` (the breath held at its midpoint only when the frame is `held`), `engine.js:265`.

**Evidence.** With the armory flag on, D-C's breath runs in every engine-drawn form (`form.js:73` poses the core on a literal `AGENT_FORM_ARMORY_ENABLED` ternary with no site gate), and D-C's own rule is that Reduce Motion holds it at the midpoint. The hub's chain is pinned link by link (`CommandCenterHub.s7.jsdom.test.jsx:247` flags on, `HubAgentForm.jsdom.test.jsx:109-111`, `AgentForm.jsdom.test.jsx:94-97`, `engine.breath.jsdom.test.js:91`, the mount guard `:1154`); the battle seats' by `battleAgentForm.sites.render.test.jsx:118-120`. The League seats: mutant `ClimbArena.jsx:237` `reducedMotion={reduce}` → `{false}`, then `src/components/League/battleArena/*.test.jsx`: **279 of 279 pass** (20 files, 17 skipped browser rows); the same for `FuseHero.jsx:104`. No League test names `reducedMotion`; `leagueAgentForm.sites.jsdom.test.jsx:18-28`'s probe records the props but no row asserts the field. A regression would make the League figures breathe under Reduce Motion. The gap predates the PR (the A1 fix pass built D-C); the flip is what turns it on.

**Smallest fix (test only).** One row per seat asserting the form receives `reducedMotion: true` when the arena reads it, in `leagueAgentForm.sites.jsdom.test.jsx` or the two files' own suites.

#### AF-4 · should-fix (the report) · "every suite holds the flags in its own mock" is false for 13 rewrite-only files

**Where:** `docs/audits/20261107_BUILD_ARMORY_FLIP.md:96`; the files: `api/_utils/casualClone.test.js`, `api/agent/change-archetype.test.js`, `change-archetype.compat.test.js`, `change-archetype.leanrider.test.js`, `composition.endpoints.test.js`, `composition.fenceBehavior.test.js`, `ensure-casual-clone.test.js`, `equip-watchlist.test.js`, `masteryEnforcement.behavior.test.js`, `src/components/League/backing/backingLanding.test.jsx`, `backingStripRefresh.test.jsx`, `src/components/League/leagueDevPods.guard.test.jsx`, `src/screens/LeagueEnrollment.routing.test.jsx` (71 rows).

**Evidence.** None of the 13 names `perGameLoadoutFlags` or `AGENT_FORM_ARMORY_ENABLED` (0 hits each; no `setupFiles`, no `__mocks__` redirect, no fixture holds a flag); they read the live literal. Their fixtures are additive, so they pass with the flag off too: the step-2 rollback suite (§3.2) reddens only the pins, and the refuter's control runs are green with the literal `true` and `false`. Four of them say so in their own headers ("these rows run the same with the flags on or rolled back", `backingLanding.test.jsx:58-59`, `backingStripRefresh.test.jsx:112-113`, `LeagueEnrollment.routing.test.jsx:33-34`, `leagueDevPods.guard.test.jsx:122`), and the report's §1 ("neutral with today's literals") shows the design was deliberate. The sentence at `:96` says the opposite and cites the agent-form flip's lesson, which was precisely that live-reading rewrites redden on a rollback. The rows do exercise the flag-on code while the literal is `true` (with `readLeagueLockInTx` made to throw: `equip-watchlist` 11 red, `change-archetype` 5 red, the table's own counts) and stop after a rollback, which is harmless because each path is pinned by mock-held suites in both states: `api/agent/perGameLoadout.writers.test.js:22,57,140-249` and `perGameLoadout.e2e.test.js:159-172` (the lock read), `api/_utils/casualClone.perGame.test.js:19,46,109-179` (the trait scan through `ref.firestore`), `src/components/League/LeagueLoadoutLine.lobbies.jsdom.test.jsx:18,27,78,114-141` (the failure-aware read). The refuter's "pin nothing" half of the claim is refuted; the sentence is not.

**Smallest fix (the report).** One sentence at `:96`: every suite with kill-switch rows holds the flags in its own mock; the 13 rewrite-only files run flag-neutral fixtures against the live literal, so a rollback leaves them green and their paths are pinned by the mock-held suites named above. Do not add a mock per file: it would contradict the four headers and change nothing the rows assert.

#### AF-5 · should-fix (a comment) · the casual-clone flag's own docstring has no pointer to FL3

**Where:** `src/config/featureFlags.js:218-237` (`CASUAL_CLONE_CONCURRENCY_ENABLED`, unchanged by the PR; no `// Pinned by:` line, unlike every other pinned flag in the file); `src/config/perGameLoadoutFlags.js:35-36` and `perGameLoadoutFlags.test.js:72-80` (where the dependency lives); `docs/composition/ACTIVATION_RUNBOOK.md:745` ("no hardcoded value pin exists … nothing to reconcile", now stale).

**Evidence.** Turning casual clones off is a real operation: the docstring itself designs for "a mid-pilot rollback" (`:234-235`) and the runbook records the founder turning it `false` (`:26`, `:52`, Aug 19, 2026) and back (`:849`). Someone doing that from the definition finds no mention of per-game loadouts; the FL3 row is invisible to the guard's `// Pinned by:` check (its `PIN_RE`, `flagPinGuard.test.js:374`, matches `expect(FLAG).toBe(…)` only), so nothing enforces a pointer. The remedy is named at run time: with the flag `false`, `perGameLoadoutFlags.test.js:79` fails with "… Turn PER_GAME_LOADOUT_ENABLED off (with its pin) before casual clones." (and `ceremonyTiming.test.jsx` reddens 3 pre-existing clone-round-trip rows, as on `main`). The gap is pre-run discoverability only.

**Smallest fix.** One line in the docstring at `:237` ("Per-game loadouts go off before this flag: perGameLoadoutFlags.test.js, the FL3 row"), and the runbook sentence.

### Notes

#### AF-6 · note · nothing but the build guards FL4's words

**Where:** `agentDeploy.js:211`, `:216` (the flag-on arm's strings), `:237`, `:242` (`main`'s). **Evidence.** No test under `src/`, `api/` or `test/` asserts "refusing the BaggerBomb deploy", "deploying the real agent" or a `console.warn` from `agentDeploy.js` (the only `[Deploy]` asserts are the orphan messages, `agentDeploy.outcomes.test.js:449,457`); `perGameLoadoutFlags.test.js`'s `readsOf` keeps only lines carrying the flag token, so neither warn line is scanned. Mutant M-R3, `main`'s words copied into the flag-on arm: 68 rows green here, 23 files green at the refuter; deleting both flag-on warn lines outright: 23 files green. The founder's acceptance for FL4-b was the build comparison, which this review repeated (§3.2); a static row asserting the first arm's two `console.warn` lines contain "refusing" and the `else` arm's "deploying the real agent" would make the words a CI fact. Optional.

#### AF-7 · note · the shipped state has no hub row for D-A, AR-1 or N4

**Where:** `CommandCenterHub.armory.jsdom.test.jsx:40` (per-game `false`), `:350`, `:586-603`, `:741-790` (the D-A sizes, the stacked layout, AR-1's `preventScroll`); `CommandCenterHub.loadouts.jsdom.test.jsx:454` (both on; asserts only the open size). **Evidence.** Mutant `ShadowStage.jsx:305` `hero.size` → `200`: `loadouts.jsdom` 28 of 28 and `s7.jsdom` 73 of 73 pass with both flags on; `armory.jsdom` kills it (15 red). Filed as should-fix; re-graded here because the hero code never reads the per-game flag: the phone arm at `CommandCenterHub.jsx:371` ternaries on the armory flag alone, `PER_GAME_LOADOUT_ENABLED` wraps only `PhonePanel` (`:410-417`), and `ShadowStage.jsx:196` picks `PhoneArmoryStage` on the armory flag; inside `PhoneArmoryScope` the one per-game read (`Armory.jsx:502`) feeds which set is previewed, not `phoneHero(width)` (`:535`), not `close()`'s focus (`:516`), not the stage box. So `armory.jsdom`'s per-game-off rows exercise the exact hero that ships; a flags-on twin would defend only against a future change that makes the hero read per-game state.

#### AF-8 · note · the book sheet's return re-read (lists and idea) has no flags-on assertion

**Where:** `src/components/CommandCenter/hub/useHubRuntime.js:164-172` (closing the WATCHLIST sheet refreshes the lists and invalidates the idea read); the rows that covered it are kill-switch: `s6.jsdom.test.jsx:1039,1054`, `s5.jsdom.test.jsx:547,578,1062`; `CommandCenterHub.loadouts.jsdom.test.jsx:414-442` opens and closes the book sheet with `listWatchlists` a `vi.fn` (`:104`) and asserts no call count. **Evidence.** Mutant `useHubRuntime.js:168` `was === HUB_SHEETS.WATCHLIST` → `false`: `s6` 9 red (all in its kill-switch set, flags off), `loadouts` 28 of 28 and `useHubRuntime.jsdom` 23 of 23 green. The code is flag-independent, so the flags-off rows do exercise the shipped path; the report's coverage note names the idea half only. **Smallest fix:** one `toHaveBeenCalledTimes` on `listWatchlists` (and an `invalidate` spy) in the existing `loadouts` row.

#### AF-9 · note · D-B and D-C reach the live battle and League figures, which no review scoped

**Where:** `src/components/AgentForm/engine/vocab.js:175-189`, `form.js:73`, `core.js:151-153`; `agentFormFlags.js:66`, `:82` (battle and League forms `true`). **Evidence.** The core at 60 % of its source light and the 4.5 s breath are posed for every form the engine draws on the armory flag; the A1 ruling D-B says so ("wherever the core draws … the armory flag decides it everywhere"). Both were built in the A1 fix pass after the A1 review; neither review document mentions `D-A`, `D-B`, `D-C`, `breath`, a battle seat or a League seat (grep); the founder saw the softer core on the hub smoke only. Intended, unreviewed, and the first thing the phone check will show on a battle or League figure (§6).

#### AF-10 · note · the order row has no remedy message

**Where:** `perGameLoadoutFlags.test.js:68-70`. **Evidence.** With `AGENT_FORM_ARMORY_ENABLED` set `false` alone the operator sees "expected false to be true" under the title "… the armory never goes off while per-game loadouts are on"; the FL3 row beside it names the step and the pin; the guard's message for the same flip ("Update THIS assertion…") is the remedy for the pin, not the order. **Smallest fix:** a second argument like FL3's.

#### AF-11 · note (pre-existing) · a one-line renamed import slips both read gates

**Where:** `perGameLoadoutFlags.test.js:32-34` (`readsOf` drops `^\s*import` lines), `:208`, `:214-219`. **Evidence.** A planted `src/services/zzRenamedReader.js` with `import { PER_GAME_LOADOUT_ENABLED as X } from '../config/perGameLoadoutFlags.js'` and a use of `X`: `perGameLoadoutFlags`, `flagPinGuard`, `agentFormFlags` 46 rows green; the multi-line import, `import * as ns` and `export { … } from` forms are all caught. `readsOf` is unchanged from `main`. **Smallest fix:** count a renamed import as a read in the census filter.

#### AF-12 · note · nothing checks that a `KILL_SWITCH_ROWS` entry is consumed

**Where:** the 18 `beforeEach` lines keyed on `expect.getState().currentTestName` (e.g. `CommandCenterHub.s5.jsdom.test.jsx:83`, `test/rules/filmRoomCardAttribution.rules.mjs:138`). **Evidence.** Today every one of the 169 entries matches a row and every one fails flags-on, so a renamed title is self-revealing (the row runs flags-on and goes red). What is not: a set row deleted or turned `it.skip` (`beforeEach` does not run for a skipped test): `ceremonyTiming.test.jsx:304` → `it.skip` gives 12 passed, 1 skipped, 0 failed. No file uses `.skip`, `.todo`, `.only` or `it.concurrent`. An `afterAll` asserting every entry was seen is set hygiene, not a correctness gap.

#### AF-13 · note · the report says "four places"; the rollback paragraph is in five

**Where:** `docs/audits/20261107_BUILD_ARMORY_FLIP.md:40`; the texts: `agentFormFlags.js:93-97`, `perGameLoadoutFlags.js:28-32`, `perGameLoadoutFlags.test.js:4-8`, `agentFormFlags.test.js:59-63`, `flagPinGuard.test.js:153-159`, word-identical. The sentence's own list is four items, the first plural. One word.

#### AF-14 · note (docs) · the AgentForm engine's motion exception is not in BUILD_RULES §11

**Where:** `docs/BUILD_RULES.md` §11 names `faceEngineCore.js` as the stated rAF exception; the AgentForm engine's equip timeline and breath are exempted only by the mount guard's rows (`commandCenterHub.mount.guard.test.js:1147`, `:1154`) and called "the §11 exception" in the S1, S2 and A1 reports. The motion guard lists the hub and form files (`motion.guard.test.js:89-101`) and is blind to a rAF breath by design; the token guard covers `core.js`, `engine.js`, `form.js`, `vocab.js` for hexes. One §11 line closes it.

#### AF-15 · note · "no cooldown, as `postIssued` is false" is right by a different mechanism

**Where:** the A2 report §17.2 and the flip report §8; `attemptReducer.js:103-109`, `:305-321`; `DeployAttemptContext.jsx:383-396`, `:957`. **Evidence.** The reducer never reads `postIssued`; a cooldown is written only by `cooldownEvidence`, dispatched when a result carries `retryAfter` (the clone refusal has none) or from the target's `lastDeployedAt`, which no POST means never moves; `postIssued` is read by the context at `:957` to end the stamp listener early. A bound already held for the ranked target is never lowered (`:311-312`) and would still show, independent of the refusal. The sentence is imprecise, not wrong.

#### AF-16 · note · `weekFieldOf` can name a field the week did not come from

**Where:** `scripts/per-game-loadout-preflip-census.mjs:58-64` vs `src/constants/perGameLoadout.js:165-172`. **Evidence.** `isLiveDraft: true` with an unparseable `scheduledDraftAt` and a parseable `createdAt`: the label says `scheduledDraftAt`, the week came from `createdAt`; the agreement row (`test:83-91`) never sees it because every fixture parses. Counts and the stale verdict are unaffected (the informational `weekField` only). Unreachable in production: the only writer stamps `.toISOString()` (`liveDraftFormation.js:137-149`, `:402`) and clients cannot write the collection (`firestore.rules:648-651`).

#### AF-17 · note · a bad `--json` path fails after the production read

**Where:** `scripts/per-game-loadout-preflip-census.mjs:164`, `:175-176`, `:188`. **Evidence.** `--json` as the last argument gives an undefined path; the JSON write (`:175`) runs before the counts are logged (`:176`), so the operator sees `census failed: ERR_INVALID_ARG_TYPE` and no counts after one read-only query; nothing leaks, nothing is written. The documented command has no `--json`. Validate the path in `parseArgs`, or log before writing.

#### AF-18 · note · the server half of "nothing writes `agentContext.archetype` after creation" is pinned by no test

**Where:** `api/_utils/filmRoom/cardStore.js:280`; `api/_utils/agentBattleService.js:191-193`; `test/rules/agentBattlesHypothesisCarriage.rules.mjs:103-135` (the client half IS pinned: dot-path, replacement, merge and delete of `agentContext` all refused, the owner-update `hasOnly` named); `api/_utils/compositionProtectedStoresScan.js:72-76` (`agentBattles` is not a protected collection, so a planted `update({ 'agentContext.archetype': x })` in a non-test `api/_utils/*.js` passes the scan guard 9 of 9). **Evidence.** The invariant the production check rests on is proven by search only; a future server writer would make every card from that battle's tagged days 409 for good, which is Twin 2's pinned behaviour (`filmRoomCardAttribution.rules.mjs:226-233`). The flip shrinks this exposure class: flag off compares the day with `agent.archetype`, which `change-archetype.js:168` does write after the battle; flag on compares with a field nothing writes. A static census row (no `agentContext.archetype` writer outside `createAgentBattle`) would also guard the mastery and learning readers of the same field. Hardening, not a flip defect.

#### AF-19 · note (pre-existing, for separate tasking) · the agents create rule does not pin `archetype`

**Where:** `firestore.rules:270-330` (no `archetype` clause); `src/services/agentService.js:136-182` (the live client create passes `archetype` through raw). **Evidence.** A client can birth an agent with any archetype string; its battles carry it, their days never tag (`tapeTags.js:205`), and the route refuses `tags_unavailable` in both flag states; self-inflicted and unchanged by the flip. Recorded because the brief asked what values the field can carry.

#### AF-20 · note (pre-existing) · the backing preview gate rests on a hand-kept host list

**Where:** `src/main.jsx:40`, `src/…/backingPreview.js:50-68`. **Evidence.** `?preview=backing` is allowed under `DEV`, refused when `VITE_VERCEL_ENV` is `production`, else only on a `.vercel.app` host not in `PRODUCTION_VERCEL_HOSTS`; `VITE_VERCEL_ENV` is set nowhere in the repo, so the list is the only guard for a future production alias. FL5's Checking on `BackingPreviewScreen` is therefore not player-reachable today. No action for this PR.

---

## 3. Lens notes

### 3.1 The source diff (lens 1)

`git diff --name-only 7b1d8d26 023d6aa5` is 53 files; excluding `*.test.js|jsx|mjs`, `*.rules.mjs`, `__fixtures__/`, `docs/`, `.gitignore` and `scripts/per-game-loadout-preflip-census.mjs` leaves exactly `src/config/agentFormFlags.js`, `src/config/perGameLoadoutFlags.js`, `src/services/agentDeploy.js`. The two flag files change the literal and the docstring only (read in full). `agentDeploy.js`: lines 1-193 identical to `main`'s, lines 244-end identical to `main`'s 219-end; the `else` arm `:219-243` against `main`'s `:194-218`: the opening line differs by design (`} else try {` vs `try {`) and the 24 body lines are byte-identical (`cmp`, exit 0); the flag-on arm `:195-218` differs from `main`'s block in the two `console.warn` strings only. **The smoke stayed out:** `f2e826e6` is not an ancestor of `023d6aa5`; its two files are `src/App.jsx`, which has no diff between `7b1d8d26` and `023d6aa5`, and `src/screens/LoadoutStatesSmoke.jsx`, absent from the head. The PR's ten commits are `96f6b43f`, `8763e57a`, `73e142da`, `edc7b189`, `845f83d7`, `2623d31e`, `54a2725c`, `a82d1830`, `477b96fe` (the merge), `023d6aa5`.

### 3.2 The kill switches (lens 2)

Unminified Linux builds (`vite build --minify false`), WSL, Node 22.22.2, lockfile blob `7608d574` on all three trees and the install.

| Build | Exit | Files | Non-map | Entry | Against |
|---|---|---|---|---|---|
| `main` `7b1d8d26` | 0 | 107 | 55 | `index-D8o2oLzt.js` | — |
| head, both literals `false` | 0 | 107 | 55 | `index-D8o2oLzt.js` | `main`: raw `diff -rq -x '*.map'` **0 entries**; 1 map differs (the entry's, `agentDeploy.js`'s source text in `sourcesContent`) |
| `main` with both literals `true` | 0 | 111 | 57 | `index-CZaGfyRm.js` | — |
| head as shipped | 0 | 111 | 57 | `index-BGMusx9b.js` | `main`+literals: non-map files paired by hash-masked name AND content, **56 of 57 twins**; the entry chunk 9,055,073 vs 9,055,061 bytes, 206,594 lines each, 2 lines only-in-each: FL4's two `console.warn` strings. No ternary, no flag declaration. |
| head, step 1 (per-game `false`, armory `true`) | 0 | 107 | 55 | `index-BjXSCXem.js` | `main`: 44 of 55 twins, 11 pairs differ by export-alias shifts (information: the report makes no byte claim for step 1; as the last flip's FO-2 said, a one-flag rollback restores the surface, not `main`'s bytes) |

Minified (`vite build`): `main` exit 0, 107 files; head exit 0, 111 files.

**Rules suite** (`npm run test:rules`, the emulator, JDK 21.0.13), on `~/pd-ci-afrx`: both on **exit 0, 33 files, 641 rows** (120.8 s); step 1 **exit 0, 33 files, 641 rows** (127.4 s); both off **exit 0, 33 files, 641 rows** (131.0 s).

**Rollback dry runs** (the literals back, the pins untouched; full suite, `flock`, `TZ=UTC`, 8 workers): step 1 — **1,342 files, 29,492 rows: 2 failed, 29,401 passed, 89 skipped** (285 s): `perGameLoadoutFlags.test.js:53` (the pin) and `flagPinGuard.test.js:478` ("PER_GAME_LOADOUT_ENABLED is live false … but this assertion pins true. Update THIS assertion…"). Step 2 — **3 failed, 29,400 passed, 89 skipped** (300 s): both pins (`agentFormFlags.test.js:68`, `perGameLoadoutFlags.test.js:53`) and the guard row naming both. So a rollback reddens the pins and the one guard that points at them, nothing else; FL3's row and the order row stay green in both steps.

**The head's own full suite** was not re-run here: CI run 42441082469 on exactly `023d6aa5` passed `vitest (unit)` (17 m 12 s) and `firestore rules + emulator suites` (3 m 5 s), with Vercel and both Socket checks; the report's own run on the merged tree gives 1,342 files, 29,492 rows, 0 failed.

### 3.3 The red rows (lens 3)

**Assertions.** An expect-line multiset diff (every line carrying `expect(`, `toThrow` or `rejects.`) over the 45 changed test files: 5 removed, 19 added; the removals are the two pin files' moved pins and turned-around `DARK_BY_DESIGN` checks. Reviewer A read the full test diff (1,613 lines) for what a line diff cannot see: no multi-line argument changed, no fixture makes an assertion vacuous, no `toEqual` → `toMatchObject`, no exact string → regex, no count loosened, no `.skip`/`.todo`/`.only`, no timeout change, no captured reference moved. Where subjects broadened they broadened without a new assertion: the League writers flag-on also write the `loadouts` slot (`materializeOnLeagueWrite`), which the rows do not read; the clone suites flag-on also run the trait scan through `ref.firestore`, which writes nothing on their fixtures; `leagueDevPods.guard` keeps only `baseLayerWeek` queries, so registering the failure-aware read admits nothing. The lobby stand-ins answer synchronously with `subscribeMyGroup`'s value and never `onError`, so no row runs with a read that never answers.

**The kill-switch rows.** Per file with a set: a control run, the set emptied (every row runs flags-on), `git checkout --`; names from vitest's JSON joined as `expect.getState().currentTestName` joins them.

| File | Rows | Set | Mismatches | Red with the set emptied | Green in both states |
|---|---|---|---|---|---|
| `api/_utils/filmRoom/cardCounter.test.js` | 37 | 6 | 0 | 6 | 0 |
| `api/_utils/filmRoom/cardStore.test.js` | 22 | 20 | 0 | 20 | 0 |
| `api/_utils/filmRoom/oneDoor.acceptanceC.test.js` | 4 | 4 | 0 | 4 | 0 |
| `api/_utils/tournamentOrchestrator.test.js` | 82 | 1 | 0 | 1 | 0 |
| `api/film-room/card.test.js` | 46 | 2 | 0 | 2 | 0 |
| `api/film-room/counter.test.js` | 6 | 1 | 0 | 1 | 0 |
| `CommandCenterHub.jsdom` | 91 | 2 | 0 | 2 | 0 |
| `CommandCenterHub.realSheets.jsdom` | 22 | 16 | 0 | 16 | 0 |
| `CommandCenterHub.reviewFixes.jsdom` | 32 | 5 | 0 | 5 | 0 |
| `CommandCenterHub.s4.jsdom` | 88 | 1 | 0 | 1 | 0 |
| `CommandCenterHub.s5.jsdom` | 107 | 57 | 0 | 57 | 0 |
| `CommandCenterHub.s6.jsdom` | 78 | 24 | 0 | 24 | 0 |
| `CommandCenterHub.s7.jsdom` | 73 | 23 | 0 | 23 | 0 |
| `CommandCenterHub.testIntegrity.jsdom` | 30 | 1 | 0 | 1 | 0 |
| `hub/useHubRuntime.jsdom` | 23 | 1 | 0 | 1 | 0 |
| `deployCeremony/ceremonyTiming` | 13 | 1 | 0 | 1 | 0 |
| `filmRoomV2/FilmRoomCards.jsdom` | 72 | 4 | 0 | 4 | 0 |
| **17 files** | | **169** | **0** | **169** | **0** |

The five whole-file-off files with their mocks set to `true`: `CommandCenterHub.armory.jsdom` 48 of 51 red, `CommandCenterHub.s2b.jsdom` 4 of 15, `panels/LoadoutPanel.layout` 9 of 14, `backing/backingDark` 19 of 64, `backing/backingMobilePin` 21 of 53: **101**, the report's five counts. 169 + 101 = **270 of the report's 274**; the other 4 are `CommandCenterHub.killSwitch.jsdom` (3) and `ShadowStage.agentForm.jsdom` (1), whose premise is the forms' kill switch (both flags held `false` by the files' existing mocks; not mutated). The emulator file's one entry is a character-exact match to its describe and it titles (271 chars), and the emulator suite's three-state run is its proof. No set row passes with the flags on, so none is guarding nothing (the brief's question).

**The sweep.** `main` @ `7b1d8d26` with both literals `true`, the 42 of the PR's test files that exist on `main` plus `api/agent/masteryEnforcement.behavior.test.js` (which the PR touches through its fixture only): **464 red rows in 42 files**, per file the report's table exactly (s5 98, s6 76, armory 48, s7 28, realSheets 22, backingMobilePin 21, cardStore 20, backingDark 19, equip-watchlist 11, casualClone 10, s4s2b 10, …, masteryEnforcement 5).

**The mock gaps.** The hub stub answers `{ locked: false, groupId: null, status: null, endsAtMs: null }` synchronously in 12 hub files. The League lock reaches only `deriveLoadoutCards` (the League card, the armory's context, Equip and footnote); `deployLineOf` and `loadoutSummaryOf` do not read it, and the rewritten rows' lock-titled subjects (`s5:442,454`, `useHubRuntime:158,174,180`) test the battle predicate `lockedInGame`, which the stub cannot touch. The locked League is driven flags-on by `CommandCenterHub.loadouts.jsdom.test.jsx:181` (Checking → Open → Locked with the dated line, the armor row's aria, a failed read back to Checking), `:203` (A2R-3 (a), the battle lock), `:223`, `:343` (Equip is the lock line), `:359` (the server's 409), `:371`. `agentForm.flagOffBundle.test.js` rewrites both modules to `false` at load (`:124-125`, self-checked at `:181`); seven titles changed, the assertions byte-identical to `main`'s.

### 3.4 FL3 and the pins (lens 4)

Reviewer B ran `perGameLoadoutFlags`, `agentFormFlags`, `flagPinGuard` and `ceremonyDeployTarget` on the head: 74 rows green. The integrity row (`flagPinGuard.test.js:491-503`) fails on `value !== false` for any `DARK_BY_DESIGN` entry; mutant M-R2 (the per-game entry re-added while it ships `true`): 2 red, the integrity row and the turned-around pin. The guard's `PIN_RE` (`:374`) does not match `expect(!A || B)`, so neither FL3's row nor the order row is mistaken for a value pin. The FO-3 trap, both ways: a rollback as the comments say (flag, pin, entry stays out) is green; re-adding the entry reds the turned-around row; re-adding while still `true` reds that and the integrity row. FL3 mutant (casual clones `false` on `~/pd-ci-afrx`): 27 rows, 1 red, the FL3 row with its message; tree restored. The report's "any flag change runs `npm run test:rules`" lives in the report's §6 and §12 only, not in a docstring (information).

### 3.5 FL4-b (lens 5)

`ceremonyDeployTarget.test.jsx:30-33` holds the flag through a getter on `perGame.on`; `:145-162` loop over a non-ok answer (`http_500`) and a thrown fetch (`threw`) with the flag on: `REFUSED` / `casual_clone_unavailable`, no `/api/agent/decide` call, `markCloneFallback` recorded; `:164-171` a clone that resolves deploys the clone; `:134-141` flag off, `cloneOk:false`: the target stays RANKED with `['http_500']`. Mutant M-R5 (the refusal's test made `false`): 2 red, the two flag-on rows. `readsOf('src/services/agentDeploy.js')` on the head is `['if (PER_GAME_LOADOUT_ENABLED) try {', "if (PER_GAME_LOADOUT_ENABLED && cloneId === null) return {…};"]`; the exact-list row (`:208`) is the gate; the shape regex (`:210`) admits a ternary, `FLAG && <anything without ?>`, a bare `FLAG` at end of line (all pre-existing, the `|$` alternative) and now `) try {` at end of line; the census row (`:214-219`) walks `api/` and `src/` for any other reader. `lint:gate` was not re-run here (the PR's CI runs it; the report's exit 0).

### 3.6 The census (lens 6)

`restrictedReader` (`census.mjs:70-79`) is a frozen object with one `query` method over `collection → where → limit → select → get`; `runCensus` (`:88`) receives it and never the handle; `./loadLocalEnv.js` and `../api/_utils/firebaseAdmin.js` are dynamic imports inside `main()` (`:182-183`), pinned by the test (`:136-143`); the only `.set(` is the `byPlayer` Map (`:116`, pinned `:160-161`); stdout is `renderCounts` (`:149-159`), the JSON carries group ids, status, week, players as a count, lock end and stale; the error path prints `err?.code ?? err?.name` (`:188`). `status` is in both the `in` filter and the mask, so on a single document `locked === false` is exactly `isTraining === true`, and `trainingExcluded` counts training pods only; the per-player lock sorts by `String(updatedAt)` as `subscribeMyGroup`, `subscribeLeagueLock` and `readLeagueLockInTx` do, and every server writer of `tournamentGroups.updatedAt` stamps an ISO string (a Timestamp would sort as `[object Object]`; none exists; outside this PR). The fixture test runs 12 of 12 on the head; the report's two mutants reproduced (training pods counted: 4 rows; a lock end exactly now: 1 row); this review's M-R1 (a CPU seat counted as a player): 3 rows red. The ALLOWED member-call scan blanks template literals whole, but the write-name regex at `test:159` runs on the unblanked source: `.set`, `.update`, `.create`, `.delete`, `batch().commit()` planted inside an interpolation each red the row, and `runCensus` never holds `db` in any case (refuted as a risk, §4). `.gitignore:102` carries the report's name.

### 3.7 The CI fixes (lens 7)

`filmRoomCardAttribution.rules.mjs`: the kill-switch row (`:191-209`) has no hunk; the set's one entry equals its describe (`:158`) + " > " + its title (`:191`), 271 characters; `beforeEach` (`:138`) sets `flip.on` from it; vitest 4.0.17 joins with " > " (`@vitest/runner` `chunk-tasks.js:336-338`). The Watch-card rewrite (`:268-284`) reads the ranked battle from the emulator and passes `rankedBattle?.agentContext?.archetype ?? null`; the three replay-owner rows pass `BATTLE.agentContext?.archetype ?? null` from a literal (`filmRoomCardReplayOwner.rules.mjs:73-75`); `createCard` never reads the battle (`cardStore.js:218-231`; `verifySource` null), and the pre-flip file wrote no battle document at all, so the literal is the one argument the store now needs (D-1 refuted). Twin 1 (`:211-224`): 200, `{ idempotent: false, open: 0, cap: 5 }`, the card under the parent with the day's archetype, nothing under the clone, the counter `[[PARENT, 'momentum_chaser', true]]` with `open` 0. Twin 2 (`:226-233`): 409 with exactly `{ error: 'archetype_changed', message, archetypeCodeId: 'momentum_chaser', current: 'guardian' }`, nothing under either agent; `beforeAll` pins the fixture's archetype at `:133-134`. Counts 1 / 4 / 2 / 0; nothing skipped. Mutant C1 re-run on `~/pd-ci-afrx`: emulator 2 red (both twins), default suite 6 red (`cardStore.perGame.test.js`); control green.

### 3.8 The production check (lens 8)

Anchors at their lines: `tapeTags.js:200` (`str(battle?.agentContext?.archetype)`, `str` at `:83`), the OK path stores that variable (`:233`), the failure path writes `items: null` with the raw id (`:453`; the report's `:451-455`); `writeTapeDay.js:142-150` re-reads the battle inside the tape write's transaction; `card.js:142` → `tapeSources.js:26-30`; `card.js:206`; `agentBattleService.js:193`; `decide.js:964`, `:1554`; `compositionGenerationFence.js:167-170`; `firestore.rules:480` (`allow create, delete: if false`, the owner-update allowlist just above); `card.js:94` is `tags_unavailable` inside `sourceOfDay` (`:92-100`), which `resolveCreateSource` (`:196`) runs before `createCard` (`:206`); on a source refusal `replayCreate` (`:201`) can only return an entry already filed under the op id. The flag is read at `cardStore.js:149`, `:280`, `:335` only. Aliases: `getArchetypeDefinition` returns null unless the id is in `VALID_ARCHETYPES` (`archetypeRegistry.js:123`; `agentArchetypeConfig.js:247`, six keys), and no normalise or alias table exists, so an alias never tags. Writers: `agentContext:` as a key appears in non-test `api/` and `scripts/` only at the create literal (`agentBattleService.js:191`) and the in-memory view (`shadowAssemblyCapture.js:146`, no write-back); every `battleRef.update(` site (`decide.js:816,1484,1754`, `ensure-opener.js:309`, `research.js:354`, `set-opponent.js:94`, `agent-batch-review.js`, `agent-daily-scores.js:216`, `agent-evaluate.js` incl. `migrationFields` `:1073-1093`, `baggerbomb-v4-daily-scores.js:278`, `process-pending-reflections.js`) touches other fields; `tags.inputs` is written only by `tapeTags.js:233,453` inside `writeTapeDay`'s transaction (callers `closePass.js:292-322` via `api/cron/film-tape-close.js:88`; `scripts/census-film-room-b1.mjs:178` writes nothing). A casual-clone battle carries the clone's archetype at creation (`decide.js:931-933`, `casualClone.js:45-48,112-122`), tags from it and is checked against it. A day never re-tagged, or tagged with no archetype, is `tags_unavailable` either way. **Answer: no battle can have every card from its days refused for good once the flags are on.**

### 3.9 What goes live that no review saw (lens 9)

| Item | What ships with the flags on | Guard rows | Reviewed by | Risk |
|---|---|---|---|---|
| D-A, the bare phone hero 250 px (245 under 375 px), words stacked under 426 px | `Armory.jsx:123-130`, `ShadowStage.jsx:277-305`, `CommandCenterHub.jsx:371-383` | `Armory.test.js:117-154`; `armory.jsdom:350,586-603,741-790` (per-game off; the same hero code, AF-7) | none; the founder saw the 250 px hero on the A2 smoke incidentally | low |
| D-B, the core at 60 % | `vocab.js:175`, `core.js:151-153`, `form.js:73`, every form | `coreLevel.test.js:57-85`, `vocab.test.js:163`, the armory read census | none | medium (AF-9: the live battle and League figures) |
| D-C, the 4.5 s breath, held under reduced motion | `vocab.js:177-189`, `engine.js:183,265` | `engine.breath.jsdom.test.js:65-152`, `coreLevel.test.js:105-152`, mount guard `:1154`; the hub chain link by link; the battle seats `battleAgentForm.sites.render.test.jsx:118-120`; the League seats unpinned (AF-3) | none | low to medium |
| AR-1's fix, N3, N4, AR-2 to AR-4's rows | A1 §15 | the A1 fix pass's rows | none (A2's build re-measured AR-1 on the taller stage; no reviewer read the code) | low |
| A2R-1, Checking until the group read answers, a failed read stays Checking | `LeagueLoadoutLine.jsx:51-60`, `leagueLoadoutSlot.jsx:26-36` (default `false`), both lobbies | `LeagueLoadoutLine.lobbies.jsdom.test.jsx:86-152` (12 rows, green here); flip mutant M2 | the A2 refuter proposed the fix; the code unreviewed | low (fail-closed) |
| A2R-2, the lock read in the transaction | `api/_utils/perGameLoadout.js:33-38` | `perGameLoadout.writers.test.js` ×7, the e2e row, A2 R1 killed | none | low |
| A2R-3 (a), the League card locks on `activeBattleId` | `perGameLoadoutModel.js:64-67` | `loadouts.jsdom:203`, the model rows, A2 F3 | none | low |
| A2R-3 (b), the refused BaggerBomb deploy with Retry | `agentDeploy.js:253`, `loadoutCopy.js:80`, `attemptVocabulary.js:158,266`, `DeployStrip.jsx:34-36` | `ceremonyDeployTarget:147` (translation); the generic refusal in the DOM `s7:558` (flags on) and `s2b:340,447` (per-game off); the clone-specific line and Retry in the DOM: no row (note, below) | none (a founder ruling built after the review) | medium: every ensure failure (429 at 10/min, 401, 409s, 500s) now refuses instead of falling back |
| Q1, `loadouts` denied on create | `firestore.rules:286` | `masteryDenials.rules.mjs:281-282`; the rules suite in three states | the A2 review confirmed the gap; the line unreviewed; the Console deploy is the founder's step | low |
| Q3, the dated lock in ET | `perGameLoadout.js:212-225`, `api/_utils/perGameLoadout.js:51-62` | `constants/perGameLoadout.test.js`; the eight moved pins | FL5 accepted the words | low |
| `useHubRuntime.js:177-179`, the doors on `ready`, Adjustments on `unlocked` | the pickers open in a live game, Adjustments stay locked | `loadouts.jsdom:203-219` pins the `ready` gating (mutant M2a: 1 red) and `useHubRuntime.jsdom`'s flags-on rows pin the `ready` arm (M2b: 4 red) | the fix pass kept `:179`; unreviewed | low |
| This PR's flag-on arm | `agentDeploy.js:195-218`, two console strings | the flags-on build | this review | none player-facing |

The clone-specific refusal in the DOM (E-2, recorded here rather than as a finding): no flags-on row drives `deployAgent` to `casual_clone_unavailable` and asserts the card's "Couldn’t start the BaggerBomb game · try again" and the strip's Retry; `ceremonyDeployTarget:147-160` pins the translation, `s7:558-566` pins a generic refusal's stage words flags-on, and the smoke page is the line's only render. One `loadouts.jsdom` row would close it. `ceremonyTiming.test.jsx:296` runs flags off by design; flags on the refusal fires first and `ceremonyDeployTarget:147-160` pins it with `markCloneFallback` still recorded; only the timing summary text after a refusal is unpinned.

**`main`'s merge.** Of the 81 files `d09603b2..7b1d8d26` changed, the only ones naming either flag or a loadout piece are `api/_utils/compositionProtectedStoresAllowlist.json` (A2's own `_notes_per_game_loadouts_a2` entry, from `406b1a63` before `d09603b2`), the #1030 report, and `src/config/flagPinGuard.test.js` (the shared file, merged cleanly). Nothing #1030 or #1031 added renders inside the hub or the League lobbies (`DraftBoardRoom.jsx:31`'s `AssetResearchModal` is the draft room; `RESEARCH_MODAL_BOMB_MODE` is `'off'`). `AgentBattleScreen.jsx`, which #1031 touched, mounts the battle forms that now draw D-B and D-C: the engine's change, not #1031's.

### 3.10 The rules dependency (lens 10)

In §0's table above. `firestore.rules`, `api/_utils/agentBattleService.js` and `api/agent/decide.js` have no diff in this PR.

### 3.11 Mutants of this review

On `~/pd-ci-afrx` at `023d6aa5` unless named; each one edit, checked to land once, run, the file restored from the tree and the tree confirmed clean; killed means a non-zero exit.

| # | Mutant | Rows run | Result |
|---|---|---|---|
| KS ×17 | each `KILL_SWITCH_ROWS` set emptied | the file | **killed**, 169 of 169 entries red (§3.3) |
| WF ×5 | each whole-file-off mock set `true` | the file | **killed**, 48 / 4 / 9 / 19 / 21 |
| FL3 | `CASUAL_CLONE_CONCURRENCY_ENABLED = false` | `perGameLoadoutFlags.test.js`, 27 | **killed**, 1 row, FL3's with its message |
| M-R1 | the census counts CPU seats as players (`isCpuSeat` → `false`) | the census test, 12 | **killed**, 3 rows |
| M-R2 | the per-game `DARK_BY_DESIGN` entry re-added while it ships `true` | `flagPinGuard` + `perGameLoadoutFlags`, 33 | **killed**, 2 rows (the integrity row, the turned-around pin) |
| M-R3 | `main`'s words in the flag-on arm's first `console.warn` | `ceremonyDeployTarget` + `ceremonyTiming` + `perGameLoadoutFlags`, 68 | **survived** (AF-6) |
| M-R4b | the `else` arm's `catch` rethrows | `ceremonyDeployTarget` + `ceremonyTiming` + `agentDeploy.outcomes`, 134 | **survived** (AF-1); 665 rows across all 22 importers at the refuter |
| M-R5 | A2R-3 (b)'s refusal removed (`false && …`) | `ceremonyDeployTarget` + `ceremonyTiming`, 41 | **killed**, 2 rows |
| M-C1 | the store compares with the parent's archetype while the flag is on | emulator `filmRoomCard*` 13; default `cardStore`, `cardStore.perGame`, `card`, 74 | **killed**: emulator 2 (both twins), default 6 |
| E-1 (refuter) | `ShadowStage.jsx:305` hero size → 200 | `loadouts` + `s7` + `armory.jsdom` | killed by `armory.jsdom` only (15 red), flags-on files green (AF-7) |
| E-3 (refuter) | `ClimbArena.jsx:237` / `FuseHero.jsx:104` `reducedMotion` → `false` | `League/battleArena/*.test.jsx`, 279 | **survived**, both (AF-3) |
| E-6 (refuter) | `useHubRuntime.js:168` WATCHLIST close → `false`; `:177` `ready` → `unlocked`; `:177` `ready` → `true` | `s6`, `loadouts`, `useHubRuntime.jsdom` | killed (9 red, flags off); killed (1 red, flags on); killed (4 red, flags on) |

9 of 12 kinds killed; the three survivors are AF-1 (M-R4b), AF-3 (E-3) and AF-6 (M-R3).

---

## 4. The adversarial pass (BUILD_RULES §2)

Five lens reviewers (A: the rewrites and mock gaps; B: FL3, the pins, FL4-b; C: the census; D: the CI fixes and the production check; E: what goes live unseen) each on its own snapshot, then six refuters, one per reviewer's findings plus this review's own, each on its own snapshot and told to refute with a concrete repro.

| Finding as filed | Refuter | Disposition |
|---|---|---|
| A-1 the 13 live-reading rewrite files | R5 | **CONFIRMED** for the report sentence (AF-4); **REFUTED** for "the rows pin nothing" (mock-held suites pin every path in both states) and for the per-file mock as the remedy |
| A-2 the book sheet's return re-read | R5 | **CONFIRMED, narrowed** to one missing assertion in an existing flags-on row (AF-8) |
| A-3 `perGameLoadoutFlags.test.js` counted as "1 pin" | R5 | **REFUTED**: the table counts rows the literal flip reddened (1); the other changes are described in §0, §4, §5, §6 |
| A-4 `masteryMockDb.js`'s transaction query bypass | R5 | **REFUTED**: no row depends on it; the query read is still counted; the same shape as `loadoutWriterDb.js:92` |
| A-5 a stale comment at `CommandCenterHub.jsdom.test.jsx:37` | R5 | **REFUTED**: the comment predates the flip and heads `AGENT_FORM_HUB_ENABLED: true`, still true of every row |
| B-1 "four places" | R1 | **CONFIRMED** (AF-13) |
| B-2 no FL3 pointer at the casual-clone flag | R1 | **CONFIRMED, narrowed** to pre-run discoverability (AF-5) |
| B-3 the `else` arm's `catch` uncovered | R2 | **CONFIRMED, narrowed**: the flag-off throw row is a pre-existing gap; the uncovered second `catch` is new (AF-1) |
| B-4 no row asserts FL4's words | R2 | **CONFIRMED** (AF-6) |
| B-5 the order row's missing message | R1 | **CONFIRMED** (AF-10) |
| B-6 the renamed import slips `readsOf` | R2 | **CONFIRMED, narrowed** to the one-line `as` form; pre-existing (AF-11) |
| B-7 the brief's path for `LoadoutChooserSheet.jsx` | R1 | **CONFIRMED**, the brief's error, not the PR's |
| KS-names (this review) no consumption check | R2 | **CONFIRMED, narrowed**: a rename self-reveals; a deleted or skipped row does not (AF-12) |
| C-1 the mask untested | R3 | **CONFIRMED**, grade stands (AF-2) |
| C-2 `weekFieldOf`'s label | R3 | **CONFIRMED, narrowed**: unreachable in production (AF-16) |
| C-3 the member-call scan's blind region | R3 | **REFUTED as a risk**: the write-name regex runs on the unblanked source and the reader never holds `db` |
| C-4 `--json` fails after the read | R3 | **CONFIRMED**, harmless (AF-17) |
| C-5 a Timestamp `updatedAt` would mis-sort | R3 | **premise REFUTED**: every writer stamps an ISO string; outside this PR |
| D-1 the replay-owner literal battle | R4 | **REFUTED**: the store never reads the battle; results `toEqual` with a planted document |
| D-2 the create rule does not pin `archetype` | R4 | **CONFIRMED**, pre-existing, both flag states identical (AF-19) |
| D-3 the invariant pinned by no test | R4 | **CONFIRMED, narrowed**: the client half is pinned by the rules rows; the server half is not; the flip shrinks the exposure (AF-18) |
| E-1 no flags-on hub row for D-A, AR-1, N4 | R6 | counts **CONFIRMED**, substance **re-graded to note**: the hero code never reads the per-game flag (AF-7) |
| E-2 the refusal never rendered flags-on | R6 | **CONFIRMED** (§3.9) |
| E-3 D-B/D-C reach battle and League forms; the League link unpinned | R6 | **CONFIRMED**, both halves, by mutant (AF-3, AF-9) |
| E-4 the §11 exception not in BUILD_RULES | R6 | **CONFIRMED** (AF-14) |
| E-5 the cooldown sentence | R6 | **CONFIRMED**: right by a different mechanism (AF-15) |
| E-6 (a) the doors' flags-on gating unpinned | R6 | **REFUTED**: `loadouts.jsdom:203-219` and four `useHubRuntime.jsdom` rows kill both directions |
| E-6 (b) the book sheet's re-read | R6 | **CONFIRMED, narrowed** to "no flags-on row" (AF-8) |
| E-6 (c) `ceremonyTiming`'s fallback | R6 | **CONFIRMED** as a wording gap at most (§3.9) |
| E-7 `BackingPreviewScreen` not player-reachable | R6 | **CONFIRMED**, with the host-list caveat (AF-20) |

**8 refuted** (A-3, A-4, A-5, C-3, C-5, D-1, E-6 (a), and A-1's second half), **1 re-graded** (E-1), the rest confirmed or confirmed narrowed.

---

## 5. What the fix pass should do

1. **AF-1** (should-fix, test): one flag-off `cloneThrows` row in `ceremonyDeployTarget.test.jsx` beside `:134`, expecting the ranked fallback with `cloneFallbacks` `['threw']`; it reddens under M-R4b.
2. **AF-2** (should-fix, test): make the census test's `readerOf` honour `fields` (a Firestore-style pick of the field paths); the twelve rows then redden on an omitted mask entry.
3. **AF-3** (should-fix, test): one row per League seat (`ClimbArena.jsx:237`, `FuseHero.jsx:104`) asserting the form receives `reducedMotion` when the arena reads it; each reddens under the `{false}` mutant.
4. **AF-4** (should-fix, the report): one sentence at `20261107_BUILD_ARMORY_FLIP.md:96`, as worded in AF-4. No mocks added.
5. **AF-5** (should-fix, a comment): one line at `featureFlags.js:237` pointing at FL3's row, and the runbook sentence at `ACTIVATION_RUNBOOK.md:745`.
6. Notes worth a line each while there: AF-10 (a message on the order row), AF-13 ("five places"), AF-8 (one `toHaveBeenCalledTimes` in the existing `loadouts` row), AF-6 (a static row on the two arms' words, optional).
7. **For separate tasking, not this PR:** AF-18 (a static census of `agentContext.archetype` writers), AF-19 (the create rule), AF-14 (a §11 line), AF-11 (the `readsOf` filter), AF-20 (the preview host list).
8. Then merge current `origin/main` and run the final checks on the merged tree: the full Linux suite, `npm run test:rules` in both flag states (the report's own §6 line 3), `lint:gate`, both builds.

---

## 6. The founder's phone check: pending

The brief says the check runs while this review does; nothing had arrived in this session by the time this document was written (Nov 7, 2026, about 10:50 PM CT). **Recorded as pending; the fix pass fills it in.** Two things it will be the first to see, and one to add: the bare 250 px hero breathing (the A1 dials check in A1 §10 has no recorded answer, so a "too dim" or "too slow" reading would be anyone's first verdict on D-B and D-C); the League card's dated lock, which shows only if the founder registers for a ranked group first (the census found none locking, so the check will most likely exercise Checking → Open and the smoke page's "Fri Nov 13"); and, to add (AF-9), a glance at a battle figure and a League seat, which now draw the softer, breathing core too.

---

## 7. What ran, where, and cleanup

- **Windows:** the app worktree `C:/Users/fashr/portfolio-duel/.claude/worktrees/review-armory-flip-pr-75b7e2` (branch `claude/review-armory-flip-pr-75b7e2` at `main` `7b1d8d26`, untouched); the git diffs, the expect-line diff and the else-arm `cmp` ran against the object store; this document was committed by plumbing (a temporary index from `023d6aa5`'s tree plus the file, `commit-tree -p 023d6aa5`) and pushed by refspec to `claude/armory-flip` after re-checking that `origin/claude/armory-flip` was still `023d6aa5`. CI and the PR's state were read with `gh` (`pr view`, `pr checks`); nothing was watched, requested or merged.
- **Snapshot trees** (LF `git -c core.autocrlf=false archive`, a `node_modules` junction each, under the session scratchpad): `head-A` to `head-F` and `main-A` for the five lens reviewers, `ref-1` to `ref-6` for the refuters, `mut` unused. The first extraction came out CRLF (`core.autocrlf=true` here) and was redone; every tree was `cmp`-checked against the blobs. Reviewers were read-only on their trees; refuters edited only their own trees for mutants and restored them (`cmp`); reviewer C ran its two mutants on a copy outside its snapshot. Refuters R2 and R4 each ran one read-only `git show origin/main:<file>` from the primary checkout. Subagent reports were returned as text and are folded into §2 to §4; none was committed.
- **WSL:** `~/pd-ci-afr`, `~/pd-ci-afrm`, `~/pd-ci-afrx` (§ Preamble), runs under `~/pd-afr-runs` (five unminified and two minified dists, the suite and rules logs and JSON, the mutant logs); 137 MB per tree and 302 MB of runs before cleanup. **One deviation from "the mutating lens runs last," stated on purpose:** the kill-switch mutants and this review's mutants ran on `~/pd-ci-afrx` before that tree's rules suites and rollback suites (each mutant restored the file and the tree was checked clean before the suites started), because nothing else used `afrx` and the suites' flock would otherwise have idled the lens reviewers' hour. The suites and builds are on a tree that was clean at their start (`git status` 0 lines, logged).
- **Cleanup:** the three WSL trees, `~/pd-afr-runs` and the two refs this review added to `~/pd-ci` (`refs/afr/head`, `refs/afr/main`) are removed after the push, under the suite lock (`unlink <tree>/node_modules`, `git -C ~/pd-ci worktree remove --force`, `worktree prune`); `~/pd-ci`, `~/pd-ci-af1`, `~/pd-af0` and other sessions' trees were not touched. The space freed is in the session's closing message. The Windows snapshot trees and their junctions (junctions deleted non-recursively first) are removed with the session scratchpad.
- **A copy of this document:** `C:/Users/fashr/Documents/FantasyTrades/AgentForm/20261107_REVIEW_ARMORY_FLIP.md` (BUILD_RULES §3).
