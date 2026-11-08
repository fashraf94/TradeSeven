# Flip: the armory and per-game loadouts go live (build report)

**Date:** 2026-11-07. **Model:** Claude Opus 5.5. **Branch:** `claude/armory-flip`, cut from `main` @ `d09603b2` (the merge of PR #1029, Build A2), pushed from the worktree branch by refspec. **PR:** see the PR that cites this report (`claude/armory-flip`). **Smoke:** `claude/armory-flip-smoke` @ `f2e826e6`. **Smoke preview:** https://trade-seven-mnd439rkr-fais-projects-bc179554.vercel.app/?loadoutStates=1. **The PR's own preview** (Vercel's comment on the PR; it follows the branch's latest push): https://trade-seven-git-claude-armory-flip-fais-projects-bc179554.vercel.app

**Preamble.** `git fetch origin` ran first; `origin/main` was `d09603b2`, which holds PR #1029's merge, so the brief's STOP does not apply. The tree was clean. Fenced files edited: none. Fenced functions called: none (`decide.js`, `agentBattleService.js` and `createAgentBattle` have no diff). Nothing under `api/` changed except tests and two test fixtures.

**CI fixes (a second session, Nov 7, 2026).** The PR's `firestore rules + emulator suites` job was red: 5 rows in 2 emulator files that the first session's red-row sweep never ran. The fix brief's rulings FL4-b (fold FL4) and CI-1 (the emulator rows' dispositions) are built, the production check it asked for is settled from the code. `main` moved during that session (to `7b1d8d26`: PRs #1030 and #1031) and was merged into the branch (`477b96fe`, no conflict), and every check below was re-run on that merged tree, against `main` @ `7b1d8d26`. That session's own account is §12; the sections above it are updated where the fixes changed them.

**The founder merges. Nothing reaches players until he does, and the merge waits for #1029's `firestore.rules` in the Firebase Console.**

---

## Executive verdict

| # | Item | Result |
|---|---|---|
| 1 | **The flip (FL1)** | **Both flags are `true` in one commit** (`8763e57a`) with their pins, both `DARK_BY_DESIGN` entries dropped, and FL2's rollback story in the docstrings and pin titles. |
| 2 | **Kill switches (FL2)** | Kept. `LoadoutChooserSheet.jsx` and every flag-off arm stay. Rollback is two steps (§6). |
| 3 | **Red rows** | **464 rows in 42 files went red** in the default suite with both flags on. **274 are kill-switch rows** (held off by mock), **186 rewritten** (they run with the flags on, assertions unchanged), **4 pins moved**, **0 deleted** (§2). The emulator suite's 5 are row 14. |
| 4 | **FL3** | A pin row: per-game loadouts never run without casual clones. It fails with casual clones off (§5). |
| 5 | **FL4** | **Folded (FL4-b).** First built as two literal ternaries, one of which sat inside a `try`, where Rollup does not fold. The flag now picks a whole `try` block outside it: `if (PER_GAME_LOADOUT_ENABLED) try {…} catch {…} else try {…main's block verbatim…} catch {…}` (`src/services/agentDeploy.js:194-243`, §4). |
| 6 | **Kill-switch build** | **0 of 55 non-map files differ** from `main` @ `7b1d8d26`: the raw `diff -rq` of the unminified Linux builds, source maps excluded, hashes in the names included (the entry is `index-D8o2oLzt.js` in both). The same held against `d09603b2` before the merge (§3). |
| 7 | **Flags-on build** | Against `main` @ `7b1d8d26` with the two literals `true`: **56 of 57 non-map files are twins**; the entry chunk differs by **exactly FL4's two strings**, with no ternary and no flag declaration (§3). |
| 8 | **One-flag rollback** | `PER_GAME_LOADOUT_ENABLED` and its pin back to `false`, the armory still `true`: **full suite exit 0**, 1,315 files, 29,016 rows, 0 failed (§3; run on `73e142da`, before the CI fixes). |
| 9 | **Full Linux suite** | **Exit 0** on the merged tree `477b96fe`: 1,342 files (1,334 passed, 8 skipped), 29,492 rows (29,403 passed, 89 skipped, **0 failed**), 296 s. Exit 0 also on `54a2725c` before the merge (1,315 files, 29,016 rows), and before the CI fixes on `73e142da` and the flip commit `8763e57a` (§3). |
| 10 | **`lint:gate`** | Exit 0 on `477b96fe`. **Minified build:** exit 0, 111 files. |
| 11 | **Mutation** | **4 of 4 killed:** FL3's row with casual clones off; the hub's League card, the League line and the Training line, one mutant each (§5). **The CI fixes: 2 of 2 killed** (§12). |
| 12 | **Census (FL6)** | **0 ranked groups lock at the flip, 0 players, 0 stale.** Production holds 18 group documents, none in a locking status (§7). |
| 13 | **Review threshold** | **Over it:** the cumulative diff against `main` @ `7b1d8d26` is **53 files, about 1,560 lines** (+1,495 / −66, this report included; without it, 52 files, +1,041 / −66 = 1,107 lines). The file count crosses the threshold (10), and with this report the line count does too (1,500), so **a review session runs before merge**. BUILD_RULES §2 asks for a review at 10 files or 1,500 lines. |
| 14 | **The rules job (CI)** | **It was red on the PR: 5 rows in 2 emulator files** (`filmRoomCardAttribution.rules.mjs`, `filmRoomCardReplayOwner.rules.mjs`), which ran with the live flag. Fixed (CI-1, §12): 1 kill-switch row, 2 flag-on twins, 4 rows handed the battle's archetype and run flags-on, 0 deleted. `npm run test:rules` on Linux, on the merged tree: **exit 0, 33 files, 641 rows** with both flags on, and the same with both literals `false` (`main` added one file, 8 rows; before the merge, 32 files and 633 rows in both states). |
| 15 | **Production check** | **No battle can have its cards refused for good.** The tape day's archetype is written from the same battle field the route hands the store, and nothing changes that field after the battle is created; a battle without one has untagged days, which the route already refuses before the store, flags on or off. No fallback added; no production count needed (§12). |

---

## §0 Founder rulings (Nov 7, 2026), as built

| # | Ruling | Built |
|---|---|---|
| FL1 | Both flags on together, in one commit with their pins. | `8763e57a`: `src/config/agentFormFlags.js:101` and `src/config/perGameLoadoutFlags.js:39` → `true`; the pins in `agentFormFlags.test.js` and `perGameLoadoutFlags.test.js` → `true`; both `DARK_BY_DESIGN` entries out of `flagPinGuard.test.js`, whose note now says why, and the rows that read the guard assert the entries are gone. |
| FL2 | The flags stay as kill switches; `LoadoutChooserSheet.jsx` and every flag-off arm stay; replaces item 3 of the A2 report's §16. | Nothing deleted. The same rollback paragraph is in five places: the two flag docstrings, the per-game pin file's header, the armory pin's block in `agentFormFlags.test.js`, and the guard's note. The pin rows' titles say "a kill switch" and name the step. |
| FL2, rollback | Two steps; the armory never goes off while per-game loadouts are on; a rollback moves a flag and its pin; `DARK_BY_DESIGN` stays out. | §6. The existing pin row (`!PER_GAME_LOADOUT_ENABLED \|\| AGENT_FORM_ARMORY_ENABLED`) is retitled to say it. Step 1 was run on the whole suite (§3). |
| FL3 | Per-game loadouts never run without casual clones: a pin row with a message that says why. | `perGameLoadoutFlags.test.js:72`, "is on only while casual clones are on (FL3)": `!PER_GAME_LOADOUT_ENABLED \|\| CASUAL_CLONE_CONCURRENCY_ENABLED`, message: "FL3: per-game loadouts never run without casual clones. With CASUAL_CLONE_CONCURRENCY_ENABLED off, every BaggerBomb deploy runs on the ranked record in the League loadout (the BaggerBomb loadout lives only on the clone). Turn PER_GAME_LOADOUT_ENABLED off (with its pin) before casual clones." |
| FL4 | The refusal's two log lines tell the truth: each a literal ternary on the flag; on, it says the deploy is refused; off, today's text exactly; both reads in `CLIENT_READS`. | First built as ruled (`8763e57a`): on, "… — refusing the BaggerBomb deploy:"; off, "… — deploying the real agent:", unchanged. The first ternary did not fold in the build (§4). **Replaced by FL4-b's form.** |
| FL5 | The A2 report's §17.6 readings are accepted as built. | No change. `BackingPreviewScreen.jsx` shows Checking (dev-only). |
| FL6 | Count the locks before they switch on. | `scripts/per-game-loadout-preflip-census.mjs` and its test; run against production (§7). |

**The fix brief's rulings (Nov 7, 2026), as built (§12):**

| # | Ruling | Built |
|---|---|---|
| FL4-b | Take the fold built on the scratch tree, `if (PER_GAME_LOADOUT_ENABLED) try {…} else try {…main's block verbatim…}`, in place of FL4's ternaries, with a one-line comment at the `if` saying why the block is doubled and that the cleanup PR collapses it. | `54a2725c`: `src/services/agentDeploy.js:194-243`. The comment is `:194`; the `else` arm (`:219-243`) is `main`'s block byte for byte. `CLIENT_READS` lists `if (PER_GAME_LOADOUT_ENABLED) try {` in place of the two ternaries, and its shape check admits that line (§4). |
| CI-1 | The emulator job's red rows get the step-2 dispositions: kill-switch row (flag held `false`), rewrite (flag on, no looser), or delete (only if the subject exists with neither flag setting); list each. | `2623d31e`: 1 kill-switch row, 4 rewrites, 2 flag-on twins, 0 deletes; each listed in §12. |

---

## §1 What changed

| Commit | What |
|---|---|
| `96f6b43f` | The dispositions of the red rows (§2): test files and two fixtures only. Neutral with today's literals: the 42 files and the bundle test, **43 files, 1,351 rows, exit 0** with both flags off (Linux, `TZ=UTC`). |
| `8763e57a` | The flip (FL1, FL2's words, FL3, FL4): 6 files, +68 / −34. |
| `73e142da` | The census (FL6): the script, its test, one `.gitignore` line. |
| `edc7b189` | FL4's comment corrected to what the build measured: the `try` block's ternary does not fold (a comment only). |
| `845f83d7` | This report, as first pushed. |
| `2623d31e` | CI-1: the two Film Room emulator files hold the per-game flag; 1 kill-switch row, 2 flag-on twins, 4 rows handed the battle's archetype (§12). |
| `54a2725c` | FL4-b: the fold (§4), and `CLIENT_READS` with its shape check. |
| `a82d1830` | This report's CI fixes, first draft. |
| `477b96fe` | Merge of `origin/main` @ `7b1d8d26` (PRs #1030, #1031): no conflict. The one file both sides touched, `src/config/flagPinGuard.test.js`, merged cleanly (this PR's two dropped `DARK_BY_DESIGN` entries and their note, beside `main`'s new comment on `RESEARCH_MODAL_BOMB_MODE`). `main`'s new lines read neither flag. |
| (the last commit) | This report, with the merged tree's checks. |

Every line of the source diff that is not a test or a fixture:

| File | Change |
|---|---|
| `src/config/agentFormFlags.js` | The armory's literal → `true`; its docstring (comments) |
| `src/config/perGameLoadoutFlags.js` | The literal → `true`; its docstring (comments) |
| `src/services/agentDeploy.js:194-243` | FL4-b's doubled `try` block: the flag-on arm with the two refusing lines, `main`'s block verbatim as the `else` arm, and one comment |
| `scripts/per-game-loadout-preflip-census.mjs` | New (FL6) |
| `.gitignore` | The census report's name |

---

## §2 The rows that went red

The flip alone (both literals `true` on `main` @ `d09603b2`), full Linux suite: **464 rows red in 42 files** (`Test Files 42 failed | 1264 passed | 8 skipped`, `Tests 464 failed | 28450 passed | 89 skipped`). **This sweep ran the default suite only** (`vitest run`). The emulator suite (`npm run test:rules`, the `*.rules.mjs` files) is a separate runner the sweep never started, and 5 of its rows were red too; CI found them, and §12 disposes of them. Two mock gaps caused most of the default suite's 464, not behaviour:

- **The hub's suites** mock `firebase/config` as `{}`. With both flags on the hub mounts the per-game scope, whose League lock read (`src/services/leagueLockService.js`) calls Firestore's `collection()` on that `{}` and throws. That one throw took 277 rows down in 8 hub files.
- **The League lobby suites** mock `tournamentGroupService` without `subscribeMyGroupOrFailure`, the failure-aware read the lobbies use with the flags on (A2R-1). 37 rows in 5 files.

### How each row was decided

- **Kill-switch row:** the row drives a surface that exists only with the flags off, or pins a rule the flags change. It runs with the flags **held off** by mock and keeps guarding what a rollback restores.
- **Rewrite:** the behaviour exists with the flags on. The row runs with the flags **on** and its assertions are unchanged (no looser): what changed is the fixture or the mock (a lock read stubbed "no ranked group", the failure-aware read standing in beside `subscribeMyGroup`, a `tournamentGroups` collection in a writer's fake Firestore, a `firestore` back-reference on a clone's doc ref).
- **Delete:** none. Every row's subject still exists with one flag setting or the other.

**Every suite with kill-switch rows holds the flags in its own mock** (the agent-form flip's lesson): rows that run flags-on hold them on, kill-switch rows hold them off, so a rollback reddens only the pins. **The 13 rewrite-only files run flag-neutral fixtures against the live literal** (`api/_utils/casualClone.test.js`, `api/agent/change-archetype.test.js`, `change-archetype.compat.test.js`, `change-archetype.leanrider.test.js`, `composition.endpoints.test.js`, `composition.fenceBehavior.test.js`, `ensure-casual-clone.test.js`, `equip-watchlist.test.js`, `masteryEnforcement.behavior.test.js`, `src/components/League/backing/backingLanding.test.jsx`, `backingStripRefresh.test.jsx`, `src/components/League/leagueDevPods.guard.test.jsx`, `src/screens/LeagueEnrollment.routing.test.jsx`), so a rollback leaves them green, and their paths are pinned in both states by the mock-held suites `api/agent/perGameLoadout.writers.test.js` and `perGameLoadout.e2e.test.js` (the lock read), `api/_utils/casualClone.perGame.test.js` (the trait scan) and `src/components/League/LeagueLoadoutLine.lobbies.jsdom.test.jsx` (the failure-aware read). *(Corrected by the review fix pass, AF-4: this sentence first said every suite holds the flags in its own mock, which those 13 files do not, by design.)* Where a file has both kinds, the kill-switch rows are named one by one in a `KILL_SWITCH_ROWS` set at the top of the file, and a `beforeEach` sets the flags from it; every other row in the file runs with the flags on.

### The table

| File | Red | Kill-switch | Rewrite | Pin | Why |
|---|---|---|---|---|---|
| `CommandCenterHub.s5.jsdom` | 98 | 57 | 41 | | 57 drive the pre-flip Loadout tab: its archetype and watchlist cards, their Change buttons, the legacy sheets those open, and the strip's pre-flip loadout line. The other 41 only fell to the lock read's throw and run flags-on unchanged. |
| `CommandCenterHub.s6.jsdom` | 76 | 24 | 52 | | 24 reach the Research reader through the old watchlist card (its idea label, its Change watchlist and the legacy sheet's return). 52 fell to the throw. |
| `CommandCenterHub.armory.jsdom` | 48 | 48 | | | **Rollback step 1's set:** A1's armory with one loadout. Per-game held off, the armory as the file already toggled it. |
| `CommandCenterHub.s7.jsdom` | 28 | 23 | 5 | | 23 pin the hero as it was before the armory (200/196 px on the phone, its mood following the deploy); the armory's hero is A1's suites'. 5 fell to the throw. |
| `CommandCenterHub.realSheets.jsdom` | 22 | 16 | 6 | | 16 open the legacy archetype and watchlist sheets from the old cards. 6 fell to the throw. |
| `backing/backingMobilePin` | 21 | 21 | | | **The phone League lobby's set** (its League and Training tabs, the landing): captured markup of today's lobby. Whole file held off. |
| `filmRoom/cardStore` | 20 | 20 | | | The ledger's flag-off predicate (A2's R4): cards filed against the agent's current archetype. The flag-on predicate is `cardStore.perGame.test.js`'s; nothing else in the ledger reads the flag. |
| `backing/backingDark` | 19 | 19 | | | **The desktop League lobby's set** (League and Training panels): captured markup and today's group read. Whole file held off. |
| `api/agent/equip-watchlist` | 11 | | 11 | | The League writers read the lock inside the transaction; the fake Firestore now has `tournamentGroups` (`api/_utils/__fixtures__/leagueGroupsDouble.js`, empty: the player between weeks). |
| `api/_utils/casualClone` | 10 | | 10 | | The clone's trait scan reaches the store through `ref.firestore`; the fake refs now carry it. |
| `CommandCenterHub.s4s2b.jsdom` | 10 | | 10 | | Fell to the throw; held on. |
| `panels/LoadoutPanel.layout` | 9 | 9 | | | **The hub's Loadout tab set:** the pre-flip panel. Whole file held off. |
| `backing/backingLanding` | 9 | | 9 | | The failure-aware read stands in beside `subscribeMyGroup`. |
| `LeagueEnrollment.routing` | 7 | | 7 | | The same. |
| `leagueDevPods.guard` | 7 | | 7 | | The guard stands in the member-scoped reads; the failure-aware read is one of them now (registered, not loosened). |
| `change-archetype.compat` | 6 | | 6 | | `tournamentGroups` stand-in. |
| `filmRoom/cardCounter` | 6 | 6 | | | Its cards are filed through the flag-off predicate (as `cardStore`). |
| `change-archetype` | 5 | | 5 | | `tournamentGroups` stand-in. |
| `masteryEnforcement.behavior` | 5 | | 5 | | `masteryMockDb.js` gains `array-contains` and a query read inside a transaction (additive branches). |
| `CommandCenterHub.reviewFixes.jsdom` | 5 | 5 | | | The old cards' layout, focus and lock line. |
| `filmRoom/oneDoor.acceptanceC` | 4 | 4 | | | Its ledger is filed through the flag-off predicate; acceptance C (the prompt never reads the ledger) does not read the flag. |
| `CommandCenterHub.s2b.jsdom` | 4 | 4 | | | Rollback step 1: A1's armory opened from the pre-flip Loadout tab. Per-game held off in the file. |
| `FilmRoomCards.jsdom` | 4 | 4 | | | As `cardStore`. |
| `composition.fenceBehavior` | 3 | | 3 | | `tournamentGroups` stand-in. |
| `ensure-casual-clone` | 3 | | 3 | | `firestore` back-reference. |
| `CommandCenterHub.killSwitch.jsdom` | 3 | 3 | | | The forms' kill switch (the agent-form flip's): the armory and per-game loadouts now go off with the hub's form, as the armory's pin requires. |
| `change-archetype.leanrider` | 2 | | 2 | | `tournamentGroups` stand-in. |
| `composition.endpoints` | 2 | | 2 | | `tournamentGroups` stand-in. |
| `api/film-room/card` | 2 | 2 | | | The flag-off predicate, through the handler. |
| `flagPinGuard` | 2 | | | 2 | The two `DARK_BY_DESIGN` entries dropped. |
| `CommandCenterHub.jsdom` | 2 | 2 | | | The old Change archetype in the loading state; the pre-armory hero size. |
| `tournamentOrchestrator` | 1 | 1 | | | The chooser's per-pod override, which FD-4 retires (`trainingClone.test.js` and `lobby-endpoints.test.js` hold the flag-on side). |
| `api/film-room/counter` | 1 | 1 | | | As `cardStore`. |
| `agentFormFlags` | 1 | | | 1 | The armory's pin → `true`. |
| `perGameLoadoutFlags` | 1 | | | 1 | The pin → `true`. |
| `CommandCenterHub.merge.jsdom` | 1 | | 1 | | Fell to the throw; held on. |
| `CommandCenterHub.s4.jsdom` | 1 | 1 | | | The old watchlist card's unavailable list. |
| `CommandCenterHub.testIntegrity.jsdom` | 1 | 1 | | | The Deploy card's pre-flip Loadout link. |
| `ShadowStage.agentForm.jsdom` | 1 | 1 | | | The forms' kill switch: the armory now follows the hub flag in the file. |
| `hub/useHubRuntime.jsdom` | 1 | 1 | | | The pre-flip lock gate on the pickers (`unlocked`; the per-game cards carry their own lock, so the flag-on gate is `ready`). |
| `ceremonyTiming` | 1 | 1 | | | **The deploy fallback:** the fallback to the ranked agent, which with per-game loadouts on is refused (A2R-3 (b)). |
| `backing/backingStripRefresh` | 1 | | 1 | | The failure-aware read stands in. |
| **Total** | **464** | **274** | **186** | **4** | |

**The kill-switch sets per surface the brief asks for:**

| Surface | Set |
|---|---|
| The hub's Loadout tab | `LoadoutPanel.layout` (9), the 57 Loadout-tab rows of `s5`, `realSheets` (16), `reviewFixes` (5), `s4` (1), `jsdom` (2); rollback step 1: `armory.jsdom` (48), `s2b` (4) |
| The Deploy card's line | `s5`'s "the strip-and-card loadout line" row and `testIntegrity`'s Loadout link (both in the sets above) |
| The League lobby | `backingDark` (desktop) and `backingMobilePin` (phone), whole files |
| The Training lobby | the same two files' Training tab and panel, and `LeagueLoadoutLine.jsdom`'s existing "flag off: the Customize loadout button and its sheet, as before" |
| The deploy fallback | `ceremonyDeployTarget.test.jsx` (A2's, already a getter) and `ceremonyTiming`'s fallback row |
| The server's writers | `perGameLoadout.writers.flagOff.test.js` (A2's, already mocked) |

**Captured references:** none moved. The two lobby files whose captures would have moved are kill-switch files and keep today's captures; no capture was recaptured.

**Not red, retitled (step 4):** the flag-off bundle rows in `agentForm.flagOffBundle.test.js` already rewrite both flag modules false, so none read a live value. The seven A1 and A2 rows are retitled "kill switch, the armory off …" / "kill switch, per-game loadouts off …", and the file's two headers say both flags are live and these rows read what each module leaves when it is set back.

**A coverage note, for the review.** The rows that went kill-switch because they reach a behaviour through a pre-flip control are not replaced by a flag-on row of their own. The flag-on side of the Loadout tab is A2's (`CommandCenterHub.loadouts.jsdom`, 27 rows, flags held on). One behaviour I could not point to a flag-on row for: `s6`'s "the watchlist sheet's return reads the idea once more". With the flags on the book sheet (`LoadoutBookSheet`) mounts under the same sheet id and the same `onClose` (`LoadoutSheets.jsx:151-158`), so the return read should be unchanged, but no row drives it through the book sheet.

---

## §3 Checks

### Kill switch and flags on (the builds)

Unminified Linux builds (`vite build --minify false`, WSL, Node 20.20.2, lockfile `40382e64edb6` on every tree), on the merged tree `477b96fe` (after FL4-b, §4, and the merge of `main` @ `7b1d8d26`), against `main` @ `7b1d8d26`.

**Kill switch:** `477b96fe` with only the two literals set back to `false`, against `main` @ `7b1d8d26`.

| | Result |
|---|---|
| Non-map files | 55 and 55 (107 files each) |
| Raw `diff -rq`, source maps excluded | **0 entries: 0 of 55 non-map files differ**, content hashes in the names included |
| The entry chunk | `index-D8o2oLzt.js` in both, so its content hash too |
| Maps | 49 differ: 48 only by the tree's directory in `sources`; the entry's map also in `sourcesContent` and `mappings`, because `agentDeploy.js`'s source text changed (the doubled block) while its emitted code did not (`vite.config.js` sets `sourcemap: true`) |
| Before the merge | the same on `54a2725c` against `d09603b2`: 0 of 55, the entry `index-ok8k4FzL.js` in both |

**Flags on:** `477b96fe` against `main` @ `7b1d8d26` with only the two literals set to `true`. The entry chunk changes, so its content hash changes and every chunk that imports it is renamed: the raw `diff -rq` (maps excluded) lists 103 entries, all "only in A / only in B" pairs of the same file under two names. So the non-map files were paired by their masked name **and** their masked content (hashes masked in names and in the text), which keeps the two `index-*.js` files from colliding.

| | Result |
|---|---|
| Non-map files | 57 and 57 |
| Twins (same masked name and masked content) | **56** |
| Left over | **1, the entry chunk** (`index-CZaGfyRm.js` → `index-BGMusx9b.js`), **by exactly FL4's two strings** (the same before the merge: `54a2725c` against `d09603b2`, 56 twins, `index-CC_2ttPZ.js` → `index-mv_AsICR.js` by these lines) |

```diff
-        console.warn("[Deploy] casual clone ensure did not return a clone — deploying the real agent:", cloneRes.status, cloneData?.error || "");
+        console.warn("[Deploy] casual clone ensure did not return a clone — refusing the BaggerBomb deploy:", cloneRes.status, cloneData?.error || "");
-      console.warn("[Deploy] casual clone ensure errored — deploying the real agent:", err?.message || err);
+      console.warn("[Deploy] casual clone ensure errored — refusing the BaggerBomb deploy:", err?.message || err);
```

No ternary and no flag declaration ship.

**Before FL4-b** (the code head as first pushed, `73e142da`): the kill-switch build differed from `main` by 2 entry-chunk lines (FL4's first ternary, unfolded, and `const PER_GAME_LOADOUT_ENABLED = false;`), and the flags-on build by 3 (the same two and the second string). §4 says why.

### The Firestore rules suite, both flag states

`npm run test:rules` (the Firestore emulator; WSL, Temurin JDK 21.0.13, Node 20.20.2), the `firestore rules + emulator suites` job's own command:

- **Both flags on** (the merged tree `477b96fe`): **exit 0, `Test Files 33 passed (33)`, `Tests 641 passed (641)`**, 192 s.
- **The kill-switch state** (both literals `false`, on a scratch tree at `477b96fe`): **exit 0, 33 files, 641 rows**, 132 s.
- Before the merge, on `54a2725c`: exit 0 in both states, 32 files and 633 rows each (CI's 631 and the two flag-on twins, §12). `main` brought one more file (`test/rules/researchRecordExtension.rules.mjs`, 8 rows).

### One-flag rollback

On a scratch tree at `73e142da`: `PER_GAME_LOADOUT_ENABLED = false` and its pin (`expect(PER_GAME_LOADOUT_ENABLED).toBe(false)`), the armory still `true`, nothing else. Full Linux suite under the lock: **exit 0**, `Test Files 1307 passed | 8 skipped (1315)`, `Tests 28927 passed | 89 skipped (29016)`, vitest's Duration 263 s. FL3's row and the armory-before-per-game row both hold with per-game loadouts off. So step 1 of the rollback is one literal and one pin, as FL2 says. Step 2 (both off) is the kill-switch build above. A full suite with both flags and both pins back was not run (the brief asks for step 1's); what ran with both off is commit 1's 43 files (below), and the 274 kill-switch rows run that way in every suite.

### Suite, lint, minified build

- **Full Linux suite** (WSL, `flock /tmp/pd-suite.lock`, `TZ=UTC`, 8 workers), the `vitest (unit)` job's command with this machine's worker count:
  - on the merged tree `477b96fe`: **exit 0**, `Test Files 1334 passed | 8 skipped (1342)`, `Tests 29403 passed | 89 skipped (29492)`, vitest's Duration 296 s;
  - on `54a2725c` before the merge: exit 0, `Test Files 1307 passed | 8 skipped (1315)`, `Tests 28927 passed | 89 skipped (29016)`, 280 s;
  - before the CI fixes, on `73e142da`: exit 0, the same counts, 293 s; on the flip commit `8763e57a`: exit 0, `Test Files 1306 passed | 8 skipped (1314)`, `Tests 28915 passed | 89 skipped (29004)`, 304 s. The 12 rows between the two are the census test's.
- **Commit 1 alone** (`96f6b43f`, today's literals): the 42 red files and the bundle test, 43 files, 1,351 rows, exit 0. The dispositions are neutral with the flags off.
- **`lint:gate`** on `477b96fe`: exit 0 (and on `54a2725c` and `73e142da` before it).
- **Minified build** (`vite build`) of `477b96fe`: exit 0, 111 files. The pushed head adds only this report on top; the checks of the exact pushed head ran last, after this text was final, and their results are in the PR description.

---

## §4 FL4 and the build: the fold (FL4-b)

**Why the first build did not fold.** FL4 was first built as ruled, two literal ternaries on the flag (`8763e57a`):

```js
console.warn(PER_GAME_LOADOUT_ENABLED ? '[Deploy] casual clone ensure did not return a clone — refusing the BaggerBomb deploy:' : '[Deploy] casual clone ensure did not return a clone — deploying the real agent:', cloneRes.status, cloneData?.error || '');
console.warn(PER_GAME_LOADOUT_ENABLED ? '[Deploy] casual clone ensure errored — refusing the BaggerBomb deploy:' : '[Deploy] casual clone ensure errored — deploying the real agent:', err?.message || err);
```

Every other client read of the two flags is a literal ternary that Rollup folds, which is what keeps a rolled-back build identical to `main`. **These two sat in a `try … catch`.** The first was inside the `try` block (the clone answer's `else` branch), the second inside the `catch`. Rollup's default `treeshake.tryCatchDeoptimization` keeps everything inside a `try` block as written, so the first ternary was emitted whole, and the flag module's `const` came into the entry chunk with it. The `catch` block is not deoptimized, so the second folded. The minifier did not fold it either. Nothing a player saw changed (the logs said the right words either way), but the kill-switch build differed from `main` by 2 lines and the live build shipped one unused string.

**The fold, built (FL4-b, `54a2725c`, `src/services/agentDeploy.js:194-243`).** The choice moves outside the `try`, as a statement-level literal `if` with brace-less arms, and `main`'s `try … catch` block stays verbatim as the `else` arm:

```js
// FL4-b (Nov 7 2026): doubled so the flag picks a whole try (Rollup never folds a ternary inside one); the cleanup PR collapses it to the first arm.
if (PER_GAME_LOADOUT_ENABLED) try {
  …main's block, with the two lines saying the deploy is refused…
} catch (err) {
  …
} else try {
  …main's block, verbatim…
} catch (err) {
  …
}
```

Rollup folds a literal `if` outside a `try` by cutting `if (…) … else ` and keeping the other arm's exact text. (A braced arm would leave a bare `{ }` block and break identity again.) It is the form measured on the scratch tree (the diff saved at `C:/Users/fashr/Documents/FantasyTrades/AgentForm/20261107_FL4_fold_variant.diff`), with the one-line comment the ruling asks for in place of `edc7b189`'s, which described the ternaries.

| Check | Result |
|---|---|
| The `else` arm | `main`'s block byte for byte (compared after the edit: 1,485 characters each, equal) |
| Flags off vs `main` | **0 of 55 non-map files differ** (raw `diff -rq`, §3) |
| Flags on vs `main` + literals | only the entry chunk differs, by **exactly FL4's two strings**, no ternary and no flag declaration (§3) |
| `CLIENT_READS` | `perGameLoadoutFlags.test.js` lists `if (PER_GAME_LOADOUT_ENABLED) try {` in place of the two ternaries; the shape check admits a line ending `) try {`; the doc comment says why |
| `lint:gate` | exit 0 (the gate enforces `no-undef` and rules-of-hooks; `curly` is not in it) |
| Rows | the full suite (§3). `ceremonyDeployTarget.test.jsx` drives both arms through its flag getter: flag on, a failed ensure refuses with `markCloneFallback` called (`:147`); flag off, the fallback deploys the ranked agent with its telemetry (`:134`) |
| Cost | +24 lines in `agentDeploy.js`: the 24-line block doubled, as A2's desktop lobby doubled its `<DeskLobby>` arm. The cleanup PR collapses it to the first arm (§6). |

---

## §5 Mutation

Each mutant is one edit on the scratch tree `~/pd-ci-flipx` at the then code head `73e142da`, checked to land exactly once. The run is the files vitest relates to the edited module (`vitest related`, the pin and census files among them), `TZ=UTC`, 8 workers, with a control of the same set first. Killed means a non-zero exit. The tree is reset after each.

| # | Mutant | Edit | Run | Result | Rows that caught it |
|---|---|---|---|---|---|
| FL3 | casual clones turned off with per-game loadouts on | `CASUAL_CLONE_CONCURRENCY_ENABLED = false` (`src/config/featureFlags.js:237`) | `perGameLoadoutFlags.test.js`, 27 rows (control green) | **killed**, 1 row | "is on only while casual clones are on (FL3)", with its message |
| M1 | the hub's League card ignores the week lock | `const weekLocked = false;` (`hub/perGameLoadoutModel.js:64`) | 974 rows (control green) | **killed**, 6 rows | `CommandCenterHub.loadouts.jsdom` "board 1 … League: checking …, open, then locked with the week's end" and "board 4 … League locked: … Equip is the lock line"; `perGameLoadoutModel.test.js` (League locked; a lock with no end; the week lock wins during a game; the armory's context) |
| M2 | the League line reads every known week as open | `const lock = leagueLockOf([]);` (`League/LeagueLoadoutLine.jsx:56`) | 317 rows (control green) | **killed**, 5 rows | `LeagueLoadoutLine.jsdom` (locked by the ranked group; the phone League tab locked by the active group) and `LeagueLoadoutLine.lobbies.jsdom` (both real lobbies: Checking, then Open, then Locked; the context reaching the slot) |
| M3 | the Training line draws nothing | `TrainingLoadoutLine` returns null for any loadout (`LeagueLoadoutLine.jsx:86`) | 317 rows (control green) | **killed**, 3 rows | `LeagueLoadoutLine.jsdom`: the Training tab's line, the phone Training tab, the desktop Training panel |

**4 of 4 killed.** The rows that caught M1 to M3 are A2's flag-on rows, which hold the flags on in their own mocks. None of this PR's 186 rewritten rows assert the cards or the lines (they are the hub's and the lobbies' other behaviour, made to run with the flags on); with the flags now live those A2 rows are the shipped state's guard, and the mutants show they bite. Two more spot mutants were run on the census (§7), and the CI fixes' two (C1, C2) are in §12.

---

## §6 Rollback

1. **`PER_GAME_LOADOUT_ENABLED` alone back to `false`** (`src/config/perGameLoadoutFlags.js:39`), with its pin (`perGameLoadoutFlags.test.js`, "is live: true since the flip …" → `toBe(false)`): A1's armory with one loadout. The full suite is green this way (§3).
2. **Both flags back to `false`**, each with its pin (`agentFormFlags.test.js`, "the armory is live …" → `toBe(false)`): the app as it was before the flip (§3 and §4 for the build).

The armory never goes off while per-game loadouts are on: the pin row fails if it does. A rollback moves a flag and its pin; the `DARK_BY_DESIGN` entries stay out (the guard's rows assert they are gone). Per-game loadouts must also go off before casual clones do (FL3). **A rollback runs `npm run test:rules` as well as the default suite** (the cleanup checklist's line 3, below): with both flags off, the emulator suite was green on a scratch tree (§3).

**The cleanup PR's checklist** (for when the kill switches are retired; FL2 keeps them for now). The flip report had no such list until the CI fixes, so it starts here:

1. Collapse FL4-b's doubled block in `src/services/agentDeploy.js` to its first arm, the one that says the deploy is refused (§4).
2. Delete `LoadoutChooserSheet.jsx`, the flag-off arms listed in `perGameLoadoutFlags.test.js` `CLIENT_READS`, and the kill-switch rows that guard them (the A2 report's §16 item 3, which FL2 deferred).
3. **Any flag change runs `npm run test:rules` as well as the default suite.** The emulator suites hold flag-dependent rows too, and the default suite never runs them: the flip's red-row sweep missed 5 that way (§12).

---

## §7 The census (FL6)

`scripts/per-game-loadout-preflip-census.mjs` (`73e142da`). Read-only by construction, as `census-activation-evidence.mjs` is: `runCensus` gets a frozen reader with one field-masked query; the credentials load only inside `main()`. One query: `tournamentGroups where status in [forming, drafting, awaiting_open, battle]`. Each group is judged by `leagueLockOf([group])`, so a training pod (`isTraining === true`, `selectMyGroup`'s check) never counts. Per group: id, status, the week (`battleAnchorEtDateOf`, with the field it came from: `startAnchor.anchorEtDate`, `dailyScores.day1.recordedDate`, `battleStartWeek.anchorEtDate`, `scheduledDraftAt` or `createdAt`), players (CPU seats apart), and the lock end. A lock end that has passed, or none, is stale. Players are counted once, by the group `selectMyGroup` picks for them. Stdout carries counts only; the JSON carries no player ids and its default name is in `.gitignore`. The fixture test (12 rows) covers each stale reason, a training pod, a CPU seat, a player in two groups, each week field, truncation, every output channel, the pinned imports, the reviewed member calls and the reader's exact query; two spot mutants (training pods counted; a lock end exactly now read as open) each failed it.

**Run on this machine** (the credentials the other census scripts use are in the main checkout's `.env.local`, loaded in-process, nothing printed), Nov 7, 2026, 6:52 PM CT:

| | Count |
|---|---|
| Ranked groups locking at the flip | **0** |
| Players locked | **0** |
| Stale groups / stale players | **0 / 0** |
| Training pods excluded | 0 |

**The zero is real, not a broken query.** A separate read-only count of the whole collection: 18 documents, none in a locking status (7 ranked complete, 10 training complete, 1 ranked voided; the newest update Oct 30). The JSON report is at `C:/Users/fashr/Documents/FantasyTrades/AgentForm/per-game-loadout-preflip-census-report.json`.

**For the founder:** run it again just before the merge, since a registration between now and then would lock that player for next week (correctly, if the week is current):

```bash
node scripts/per-game-loadout-preflip-census.mjs
```

---

## §8 The smoke branch

`claude/armory-flip-smoke` @ `f2e826e6`: one commit, "SMOKE ONLY, NEVER MERGE", whose parent is the flip's code head `73e142da` (the code head before the CI fixes; their two commits change test files, a log line's form and the census row, nothing a screen shows, so the smoke was not rebuilt). Built by git plumbing (a temporary index and `commit-tree`), so it touches exactly two files:

- `src/screens/LoadoutStatesSmoke.jsx`, brought across from `claude/armory-a2-smoke` @ `06e5ff02` and refreshed to the current copy: the League week is Nov 9–13, so a dated lock reads "Fri Nov 13"; the League lines pass `groupKnown`, which they now need (A2R-1).
- `src/App.jsx`: `?loadoutStates=1` routes to it (10 lines, as the A2 smoke had them). No corner readout this time, and both flags are already on at its parent.

**The states the founder has not yet seen on a phone, each marked "New" on the page:**

| State | Where on the page |
|---|---|
| Q3's dated lock, "Locked until the week is scored, after the close on Fri Nov 13." | the League card; the League tab's line; the armory's context and Equip |
| Q3's undated lock, "Locked until the week is scored." | the same three places (a group the calendar cannot date) |
| The League line's Checking | the League tab's line before its group read answers |
| The battle lock, "Locked while a game is running." | the League card and the armory (an agent with `activeBattleId`) |
| The Deploy strip's refusal, "Couldn’t start the BaggerBomb game · try again", with its Retry | the real `DeployStrip` (held in a transformed box, as it is fixed to the screen's bottom) and the phone's Deploy card |

**The refusal renders from fixture data without a write.** The fixture is the result `agentDeploy.js` returns when the clone cannot be ensured; it goes through the real `translateServiceResult` and `displayForAttempt`, and the deploy state is assembled as `deriveHubDeployState`'s attempt branch assembles it (no cooldown, as `postIssued` is false). Retry does nothing on the page.

Nothing on the page writes: the fixture agent has no id, the book rows and Equip change nothing, and no service is called.

**Checked before the push:** a minified build of the smoke head in WSL, exit 0 (placeholder Firebase values; Vercel builds with the real ones), with `LoadoutStatesSmoke-*.js` as its own chunk. Served locally and opened in the desktop app's browser at `?loadoutStates=1`: every frame renders with the words above (both dated lines read "Fri Nov 13"; the undated lines, Checking, the battle lock and the refusal with its Retry are all there), and the console's one error is the missing Vercel analytics script, which only Vercel serves. At 375 px the strip shows "Deployment refused" over the clamped line with its Retry, and the Deploy card under it shows the full line with Retry.

**The Vercel preview** (https://trade-seven-mnd439rkr-fais-projects-bc179554.vercel.app, built by Vercel with the real Firebase values) serves it: loaded at `?loadoutStates=1` in the same browser, 24 frames, 11 of them marked New, "Fri Nov 13" seven times, and every new state's words on the page. The one console error is Vercel's feedback widget, which the app's own Content Security Policy blocks.

---

## §9 iPhone checklist (on the flip preview, then the smoke page)

1. **The flip preview, signed in** (https://trade-seven-git-claude-armory-flip-fais-projects-bc179554.vercel.app, the PR's own preview from Vercel's comment on the PR; it serves the branch's latest push): open the Command Center. The hero is the bare Shadow, breathing. Tap Loadout: two cards, BaggerBomb on top, League under it.
2. **The League card:** if you have a ranked group for next week, it is locked and reads "Locked until the week is scored, after the close on Fri Nov 13."; otherwise it is open. (The census found no ranked group in any locking status tonight, so expect open unless you register first.)
3. **Change BaggerBomb's armor and hold Deploy:** the game wears the new armor.
4. **The League tab:** its line reads Checking for a moment, then open or locked. **The Training tab** says it uses your League loadout, and there is no Customize loadout button.
5. **The smoke states page** (`?loadoutStates=1` on the smoke preview): every frame marked New. The League lock dated "Fri Nov 13" and undated, on the card, the League line and the armory (its context and Equip); the League line's Checking; "Locked while a game is running." on the card and in the armory; and the Deploy strip's "Couldn’t start the BaggerBomb game · try again" with its Retry.

---

## §10 Founder question

**Q1 (FL4's first log line: keep the ternary, or fold it?) is answered: FL4-b, fold it** (option (a), Nov 7, 2026). Built in `54a2725c` (§4). No question is open.

---

## §11 What ran, where

- **Windows:** worktree `C:/Users/fashr/portfolio-duel/.claude/worktrees/armory-loadouts-flip-9203f6`, branch `claude/armory-flip` (cut from `origin/main` @ `d09603b2`), pushed by refspec. The pin files and the census test ran there too (vitest from the parent checkout's `node_modules`). The census ran there, against production, read-only.
- **WSL:** `~/pd-ci-flip` (the suites, `lint:gate`, the flip's builds), `~/pd-ci-flipm` (`main`'s builds, the smoke build) and `~/pd-ci-flipx` (the discovery runs, the kill-switch build, the mutants, the FL4 variant, the one-flag rollback), detached worktrees of `~/pd-ci` with `node_modules` linked to `~/pd-af0` (lockfile `40382e64edb6` on every tree). Node 20.20.2, `TZ=UTC`, 8 workers, each full suite under `flock /tmp/pd-suite.lock`. Runs went under `~/pd-flip-runs/armory/` (the folder `~/pd-flip-runs` already held another session's Oct 28 files, left alone).
- **Cleanup:** the three trees and `~/pd-flip-runs/armory/` were removed after the last build, under the suite lock (`unlink` each `node_modules` link, `git -C ~/pd-ci worktree remove --force`, `worktree prune`). `~/pd-ci`, `~/pd-ci-af1`, `~/pd-af0` and other sessions' trees were not touched. The space freed is in the PR description.
- **Scripts** in the session scratchpad (not committed): the sync, step, list, build, compare, mutant, variant, rollback and cleanup runners, the dispositions generator, and the smoke composer.

**The CI fixes (the second session):**

- **Windows:** worktree `C:/Users/fashr/portfolio-duel/.claude/worktrees/armory-flip-fixes-0b868c`, branch `claude/armory-flip-fixes-0b868c`, reset to the PR head `845f83d7` and pushed by refspec to `claude/armory-flip`. The census pin file and the two deploy-ceremony files ran there as a first check (3 files, 68 rows, exit 0).
- **WSL:** `~/pd-ci-flipfx` (the code head: the full suite, the rules suite, `lint:gate`, both builds), `~/pd-ci-flipfxm` (`main`: its build, and its build with the two literals `true`) and `~/pd-ci-flipfxx` (the kill-switch state: its rules suite and build; then the mutants), first at `54a2725c` and `d09603b2`, then moved to the merged tree `477b96fe` and `main` @ `7b1d8d26` for every check again, detached worktrees of `~/pd-ci` with `node_modules` linked to `~/pd-af0` (lockfile `40382e64edb6`, checked inside WSL on every tree). Node 20.20.2, JDK 21.0.13, `TZ=UTC`, 8 workers, the full suite under `flock /tmp/pd-suite.lock` (it waited behind another session's suite). Runs under `~/pd-flipfx-runs`.
- **Cleanup:** the three trees and `~/pd-flipfx-runs` are removed after the last check, under the suite lock; the space freed is in the PR description.

---

## §12 CI fixes (Nov 7, 2026)

**Brief:** the founder's fix brief of Nov 7, 2026 ("Flip fixes: the red emulator job, FL4's fold, and the report"), with rulings FL4-b and CI-1. **Session:** Claude Opus 5.5, a fresh session. `git fetch origin` first: the PR head was `845f83d7`, as the brief required, and `origin/main` was `d09603b2`. Fetched again before the push, `main` had moved to `7b1d8d26` (PRs #1030 and #1031, the research record extension and Bomb mode), so it was merged (`477b96fe`) before the final checks. No conflict; the one file both sides touched, `src/config/flagPinGuard.test.js`, merged cleanly, and `main`'s new lines read neither flag, so nothing in the merge touches this PR's logic. Fenced files: none edited, none called.

### What failed

`gh pr checks 1033` before the fixes listed **one failing check, `firestore rules + emulator suites`** (run `42435192524`, job `128592419410`, 2 m 28 s). The others passed: `vitest (unit)` (15 m 52 s), Vercel, Vercel Preview Comments, and both Socket Security checks. The job's log (`gh run view 42435192524 --log-failed`): `Test Files 2 failed | 30 passed (32)`, `Tests 5 failed | 626 passed (631)`. Nothing beyond these 5 rows was red.

| # | File and row | Line in CI's log | What it saw |
|---|---|---|---|
| 1 | `test/rules/filmRoomCardAttribution.rules.mjs`, "the archetype checks read the parent: the clone on the tape's archetype, the parent on another → 409 archetype_changed, …" | `:176` | `expected 200 to be 409`: the route filed the card |
| 2 | the same file, "a parent-filed Watch card lists a clone day's recurrence; …" | `:234` (its `createCard`) | `archetype_changed` thrown at `api/_utils/filmRoom/cardStore.js:280` |
| 3 | `test/rules/filmRoomCardReplayOwner.rules.mjs`, "another user's ownerId, nothing else changed → 409 op_conflict …" | `:71` (the `file` helper, `:65`) | the same |
| 4 | the same file, "no ownerId at all → the same refusal; …" | `:84` | the same |
| 5 | the same file, "the cap counts the caller's own entries: …" | `:97` | the same |

### Why (the founder's reading, confirmed from the code)

- **Neither file mocked `src/config/perGameLoadoutFlags.js`**, so both ran with the live flag, now `true`. VERIFIED (both files at `845f83d7`). The build's red-row sweep ran only the default suite; these files end in `.rules.mjs` and run only under `npm run test:rules` (`vitest.rules.config.mjs:15`).
- **Rows 2 to 5 call `createCard` directly without `battleArchetype`.** With the flag on, the store's check is `payload.archetypeCodeId !== battleArchetype` (`cardStore.js:280`), and `battleArchetype` defaults to `null` (`cardStore.js:270`), so every create compared the tape's `momentum_chaser` with `null`: 409 `archetype_changed`, `current: null`. VERIFIED.
- **Row 1 asserts today's rule**: the tape day against the attribution agent's (the parent's) current archetype. Under A2's R4 the day is compared with the battle's own archetype, which the route hands in (`api/film-room/card.js:206`: `battle?.agentContext?.archetype ?? null`) and which is the tape's, so the route filed the card: 200. VERIFIED.

### Each row's disposition (CI-1)

Both files now hold the flag in a getter mock, the default suite's pattern (`filmRoomCardAttribution.rules.mjs:37-41`, `filmRoomCardReplayOwner.rules.mjs:34-35`), so a rollback reddens only the pin.

| Row | Disposition | What changed |
|---|---|---|
| 1, "the archetype checks read the parent" (`filmRoomCardAttribution.rules.mjs:191`) | **Kill-switch row** (the flag held `false`; the file's `KILL_SWITCH_ROWS`) | Nothing in the row. It keeps guarding the rule a rollback restores. |
| 2, the counter's Watch card (`filmRoomCardAttribution.rules.mjs:268`) | **Rewrite** (flag on, no looser) | `createCard` gets the battle's own archetype, read from the battle document and passed as the route passes it (`:276-282`). Assertions unchanged. |
| 3 to 5, the replay-owner rows (`filmRoomCardReplayOwner.rules.mjs:79`, `:92`, `:105`) | **Rewrite** (flag on, no looser) | The `file` helper hands the store the battle's own archetype, as the route would (`:73-75`). Assertions unchanged. Their subject is the replay and the cap. |
| new: "flag on (A2's R4 and R6): the tape day's archetype is the battle's own → …" (`filmRoomCardAttribution.rules.mjs:211`) | **Flag-on twin** of row 1 | Through the route, on the emulator: the clone's battle and its day on `momentum_chaser`, the parent on `guardian` → 200, filed under the parent with the day's archetype, `open: 0`; the counter reads it shelved at once (R6: neither loadout wears it) with open 0; nothing under the clone. |
| new: "flag on (A2's R4): a tape day whose archetype is not the battle's own → …" (`:226`) | **Flag-on twin** of row 1 | The battle's own archetype set to `guardian` while its day records `momentum_chaser`, with the parent and the clone on `momentum_chaser` → 409 with exactly `{ error: 'archetype_changed', message, archetypeCodeId: 'momentum_chaser', current: 'guardian' }`; nothing under the parent or the clone. |
| — | **Delete** | None: every row's subject exists with one flag setting or the other. |

The attribution file's `beforeAll` also asserts that the fixture battle and its tape day both record `momentum_chaser` (`:133-134`), so the twins cannot pass on a fixture that changed under them.

### The production check

**The question.** The route passes `battle?.agentContext?.archetype ?? null` (`api/film-room/card.js:206`). With the flag on, a battle with a tape day but no `agentContext.archetype` would have every card from that day refused, for good.

**Finding: it cannot happen, so no fallback was added and no production count was run (the code settles it).**

1. **The tape day's archetype is written from the same field.** The tagger takes `tags.inputs.archetypeCodeId` from `str(battle?.agentContext?.archetype)` (`api/_utils/filmTape/tapeTags.js:200`; `str` keeps a non-empty string, `:83`), over the battle document re-read inside the tape write's own transaction (`api/_utils/filmTape/writeTapeDay.js:142-150`). The route reads the same raw document (`api/film-room/card.js:142` → `api/_utils/filmTape/tapeSources.js:26-30`) and hands the store the same field (`card.js:206`). VERIFIED.
2. **A battle without an archetype has no card to refuse.** With none (or `'unknown'`, which the registry does not know: `api/_utils/archetypeRegistry.js:123`), the tagger resolves no thresholds and writes `items: null` with the tags' coverage unavailable (`tapeTags.js:204-206`, `:451-455`). The route then refuses the day, 409 `tags_unavailable` (`card.js:94`), before the store is reached, with the flag on or off, as it does today. VERIFIED.
3. **Nothing changes the field after the battle is created.** `agentContext.archetype` is written once, by `createAgentBattle` (`api/_utils/agentBattleService.js:193`, `agentData.archetype || 'unknown'`; read, not edited), which both deploy paths call (`api/agent/decide.js:964`, `:1554`) and which commits through `commitBattleDocWithPin` (`api/_utils/compositionGenerationFence.js:167-170`). A client cannot create a battle or touch `agentContext` (`firestore.rules:475-480`: the owner's update is limited to ten other fields; create and delete are `false`). No server path updates it: a search of every non-test `agentContext` line under `api/` (136) finds reads, `createAgentBattle`'s literal, and `manifestDerivedBattleView` (`api/_utils/shadowAssemblyCapture.js:142`), which builds a copy for a capture and writes nothing back. VERIFIED by search.
4. **The dates, for the record:** battles have carried the field since `c315707d` (Mar 25, 2026); tape days began with `7f29ae6e` (Sep 27, 2026) and tags with `ec3fd0df` (Oct 14, 2026), which has read this field since its first commit. VERIFIED (`git log -S`).

So every day that reaches `createCard` was tagged from its battle's own archetype, and the route hands the store the same value: the flag-on check agrees for every real day. Its 409 guards a day and a battle that disagree, which the second twin pins.

### Mutation

On `~/pd-ci-flipfxx` at `54a2725c`, and again at the merged tree `477b96fe` with the same results: each mutant is one edit, checked to land exactly once; the file is restored from `git show HEAD:path` after each run and the tree confirmed clean. Each run is the two emulator files (`firebase emulators:exec --only firestore --project demo-tradeseven-rules "vitest run --config vitest.rules.config.mjs test/rules/filmRoomCard"`) and the default suite's three card-store files (`cardStore.test.js`, `cardStore.perGame.test.js`, `api/film-room/card.test.js`), `TZ=UTC`. Killed means a non-zero exit. **Control** (unmutated): emulator 2 files, 13 rows, exit 0; default 3 files, 74 rows, exit 0.

| # | Mutant | Edit (`cardStore.js:280`) | Emulator | Default suite |
|---|---|---|---|---|
| C1 | the store compares with the parent's archetype while the flag is on | `… ? payload.archetypeCodeId !== battleArchetype : …` → `… !== agent.archetype : …` | **killed**: both flag-on twins (2 of 13 rows) | killed: 6 rows of `cardStore.perGame.test.js` |
| C2 | the store uses the flag-on check whatever the flag | the test `PER_GAME_LOADOUT_ENABLED ?` → `true ?` | **killed**: the kill-switch row (1 of 13) | killed: the 22 kill-switch rows (20 in `cardStore.test.js`, 2 in `card.test.js`) |
| — | removing the production check's fallback | none was added (above) | — | — |

**2 of 2 killed.**

### The checks, on the merged tree `477b96fe` (against `main` @ `7b1d8d26`)

| Check | Result |
|---|---|
| `lint:gate` (the `vitest (unit)` job's gate) | exit 0 |
| Full Linux suite (the `vitest (unit)` job's command, 8 workers, `flock`, `TZ=UTC`) | **exit 0**, 1,342 files, 29,492 rows, 0 failed, 296 s |
| `npm run test:rules` (the `firestore rules + emulator suites` job's command), both flags on | **exit 0**, 33 files, 641 rows |
| `npm run test:rules`, both literals `false` | **exit 0**, 33 files, 641 rows |
| Kill-switch build vs `main` | **0 of 55** non-map files differ (raw `diff -rq`, maps excluded) |
| Flags-on build vs `main` + literals | 56 of 57 twins; the entry chunk by exactly FL4's two strings |
| Minified build | exit 0, 111 files |
| Mutation | C1 and C2 killed, as before the merge |

Before the merge, on `54a2725c` against `d09603b2`, every one of these was green too (§3 gives both).

### The report

This section; `edc7b189` in §1's table; the rules suite in both flag states in §3; FL4-b in §0, §4 and §10; the PR's own preview link in §9's step 1; and the cleanup PR's checklist in §6, which the report did not have, so it starts there with the line the brief asks for (any flag change runs `npm run test:rules` as well as the default suite).
