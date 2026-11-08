# Flip: the armory and per-game loadouts go live (build report)

**Date:** 2026-11-07. **Model:** Claude Opus 5.5. **Branch:** `claude/armory-flip`, cut from `main` @ `d09603b2` (the merge of PR #1029, Build A2), pushed from the worktree branch by refspec. **PR:** see the PR that cites this report (`claude/armory-flip`), draft. **Smoke:** `claude/armory-flip-smoke` @ `f2e826e6`. **Preview:** https://trade-seven-mnd439rkr-fais-projects-bc179554.vercel.app/?loadoutStates=1 (the Command Center itself is at the same address without the query, signed in).

**Preamble.** `git fetch origin` ran first; `origin/main` was `d09603b2`, which holds PR #1029's merge, so the brief's STOP does not apply. The tree was clean. Fenced files edited: none. Fenced functions called: none (`decide.js`, `agentBattleService.js` and `createAgentBattle` have no diff). Nothing under `api/` changed except tests and two test fixtures.

**The founder merges. Nothing reaches players until he does, and the merge waits for #1029's `firestore.rules` in the Firebase Console.**

---

## Executive verdict

| # | Item | Result |
|---|---|---|
| 1 | **The flip (FL1)** | **Both flags are `true` in one commit** (`8763e57a`) with their pins, both `DARK_BY_DESIGN` entries dropped, and FL2's rollback story in the docstrings and pin titles. |
| 2 | **Kill switches (FL2)** | Kept. `LoadoutChooserSheet.jsx` and every flag-off arm stay. Rollback is two steps (§6). |
| 3 | **Red rows** | **464 rows in 42 files went red** with both flags on. **274 are kill-switch rows** (held off by mock), **186 rewritten** (they run with the flags on, assertions unchanged), **4 pins moved**, **0 deleted** (§2). |
| 4 | **FL3** | A pin row: per-game loadouts never run without casual clones. It fails with casual clones off (§5). |
| 5 | **FL4** | Built as ruled: two literal ternaries. **One of them does not fold** (it sits inside a `try`, where Rollup does not tree-shake), so the kill-switch build is not byte-identical to `main`: **2 lines in the entry chunk differ**. The behaviour is today's. A form that makes it identical was built and measured on a scratch tree (byte-identical off, only the two strings on, lint green); whether to swap it in is the one founder question (§4, §10 Q1). |
| 6 | **Kill-switch build** | **54 of 55 non-map files identical** (hash-masked); the entry chunk differs by FL4's 2 lines. Not 0 (§4). |
| 7 | **Flags-on build** | Against `main` with the two literals `true`: **56 of 57 non-map files identical** (hash-masked); the entry chunk (where `agentDeploy.js` lives) differs by 3 lines, all FL4's (§4). |
| 8 | **One-flag rollback** | `PER_GAME_LOADOUT_ENABLED` and its pin back to `false`, the armory still `true`: **full suite exit 0**, 1,315 files, 29,016 rows, 0 failed (§3). |
| 9 | **Full Linux suite** | **Exit 0** on the code head `73e142da`: 1,315 files (1,307 passed, 8 skipped), 29,016 rows (28,927 passed, 89 skipped, **0 failed**), 293 s. Also exit 0 on the flip commit `8763e57a` before the census (1,314 files, 29,004 rows, 0 failed). |
| 10 | **`lint:gate`** | Exit 0. **Minified build:** exit 0. |
| 11 | **Mutation** | **4 of 4 killed:** FL3's row with casual clones off; the hub's League card, the League line and the Training line, one mutant each (§5). |
| 12 | **Census (FL6)** | **0 ranked groups lock at the flip, 0 players, 0 stale.** Production holds 18 group documents, none in a locking status (§7). |
| 13 | **Review threshold** | **Over it:** the cumulative diff against `main` is **51 files, about 1,350 lines** (+1,295 / −54 with this report; without it, 50 files, +950 / −54 = 1,004 lines). The file count alone crosses the threshold (10), so **a review session runs before merge**; the line count does not (1,500). BUILD_RULES §2 asks for a review at 10 files or 1,500 lines. |

---

## §0 Founder rulings (Nov 7, 2026), as built

| # | Ruling | Built |
|---|---|---|
| FL1 | Both flags on together, in one commit with their pins. | `8763e57a`: `src/config/agentFormFlags.js:101` and `src/config/perGameLoadoutFlags.js:39` → `true`; the pins in `agentFormFlags.test.js` and `perGameLoadoutFlags.test.js` → `true`; both `DARK_BY_DESIGN` entries out of `flagPinGuard.test.js`, whose note now says why, and the rows that read the guard assert the entries are gone. |
| FL2 | The flags stay as kill switches; `LoadoutChooserSheet.jsx` and every flag-off arm stay; replaces item 3 of the A2 report's §16. | Nothing deleted. The same rollback paragraph is in four places: the two flag docstrings, the per-game pin file's header, the armory pin's block in `agentFormFlags.test.js`, and the guard's note. The pin rows' titles say "a kill switch" and name the step. |
| FL2, rollback | Two steps; the armory never goes off while per-game loadouts are on; a rollback moves a flag and its pin; `DARK_BY_DESIGN` stays out. | §6. The existing pin row (`!PER_GAME_LOADOUT_ENABLED \|\| AGENT_FORM_ARMORY_ENABLED`) is retitled to say it. Step 1 was run on the whole suite (§3). |
| FL3 | Per-game loadouts never run without casual clones: a pin row with a message that says why. | `perGameLoadoutFlags.test.js:72`, "is on only while casual clones are on (FL3)": `!PER_GAME_LOADOUT_ENABLED \|\| CASUAL_CLONE_CONCURRENCY_ENABLED`, message: "FL3: per-game loadouts never run without casual clones. With CASUAL_CLONE_CONCURRENCY_ENABLED off, every BaggerBomb deploy runs on the ranked record in the League loadout (the BaggerBomb loadout lives only on the clone). Turn PER_GAME_LOADOUT_ENABLED off (with its pin) before casual clones." |
| FL4 | The refusal's two log lines tell the truth: each a literal ternary on the flag; on, it says the deploy is refused; off, today's text exactly; both reads in `CLIENT_READS`. | `src/services/agentDeploy.js:216`, `:221`: on, "… — refusing the BaggerBomb deploy:"; off, "… — deploying the real agent:", unchanged. Both lines are in `CLIENT_READS`. **The first one does not fold in the build** (§4). |
| FL5 | The A2 report's §17.6 readings are accepted as built. | No change. `BackingPreviewScreen.jsx` shows Checking (dev-only). |
| FL6 | Count the locks before they switch on. | `scripts/per-game-loadout-preflip-census.mjs` and its test; run against production (§7). |

---

## §1 What changed

| Commit | What |
|---|---|
| `96f6b43f` | The dispositions of the red rows (§2): test files and two fixtures only. Neutral with today's literals: the 42 files and the bundle test, **43 files, 1,351 rows, exit 0** with both flags off (Linux, `TZ=UTC`). |
| `8763e57a` | The flip (FL1, FL2's words, FL3, FL4): 6 files, +68 / −34. |
| `73e142da` | The census (FL6): the script, its test, one `.gitignore` line. |
| (the last commit) | This report. |

Every line of the source diff that is not a test or a fixture:

| File | Change |
|---|---|
| `src/config/agentFormFlags.js` | The armory's literal → `true`; its docstring (comments) |
| `src/config/perGameLoadoutFlags.js` | The literal → `true`; its docstring (comments) |
| `src/services/agentDeploy.js:216`, `:221` | FL4's two ternaries, and one comment |
| `scripts/per-game-loadout-preflip-census.mjs` | New (FL6) |
| `.gitignore` | The census report's name |

---

## §2 The rows that went red

The flip alone (both literals `true` on `main` @ `d09603b2`), full Linux suite: **464 rows red in 42 files** (`Test Files 42 failed | 1264 passed | 8 skipped`, `Tests 464 failed | 28450 passed | 89 skipped`). Two mock gaps caused most of them, not behaviour:

- **The hub's suites** mock `firebase/config` as `{}`. With both flags on the hub mounts the per-game scope, whose League lock read (`src/services/leagueLockService.js`) calls Firestore's `collection()` on that `{}` and throws. That one throw took 277 rows down in 8 hub files.
- **The League lobby suites** mock `tournamentGroupService` without `subscribeMyGroupOrFailure`, the failure-aware read the lobbies use with the flags on (A2R-1). 37 rows in 5 files.

### How each row was decided

- **Kill-switch row:** the row drives a surface that exists only with the flags off, or pins a rule the flags change. It runs with the flags **held off** by mock and keeps guarding what a rollback restores.
- **Rewrite:** the behaviour exists with the flags on. The row runs with the flags **on** and its assertions are unchanged (no looser): what changed is the fixture or the mock (a lock read stubbed "no ranked group", the failure-aware read standing in beside `subscribeMyGroup`, a `tournamentGroups` collection in a writer's fake Firestore, a `firestore` back-reference on a clone's doc ref).
- **Delete:** none. Every row's subject still exists with one flag setting or the other.

**Every suite holds the flags in its own mock rather than reading them live** (the agent-form flip's lesson): rows that run flags-on hold them on, kill-switch rows hold them off, so a rollback reddens only the pins. Where a file has both kinds, the kill-switch rows are named one by one in a `KILL_SWITCH_ROWS` set at the top of the file, and a `beforeEach` sets the flags from it; every other row in the file runs with the flags on.

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

Unminified Linux builds (`vite build --minify false`, WSL, Node 20.20.2, lockfile `40382e64edb6` on every tree).

**A raw `diff -rq` is not the measure here, and why.** With any one chunk changed, its content hash changes, so every chunk that imports it is renamed too: the raw `diff -rq` (maps excluded) lists 99 entries for the kill switch and 103 for flags on, almost all of them "only in A / only in B" pairs of the same file under two names. So each pair of trees was compared with the content hashes masked in file names and in the text, and every non-map file paired with its masked twin. (A first masked pass reported 0 differences for flags on: it keyed files by masked name, and two `index-*.js` files collided. That 0 was wrong, which the string search below showed; the pairing that replaced it matches by name and content.)

**Kill switch:** the code head `73e142da` with only the two literals set back to `false`, against `main` @ `d09603b2`.

| | Result |
|---|---|
| Non-map files | 55 and 55 |
| Identical once hashes are masked | **54** |
| Differing | **1, the entry chunk (`index-*.js`), by 2 lines** |
| Docstring comments in the diff | none (esbuild drops them) |

```diff
+ const PER_GAME_LOADOUT_ENABLED = false;
- console.warn("[Deploy] casual clone ensure did not return a clone — deploying the real agent:", cloneRes.status, cloneData?.error || "");
+ console.warn(PER_GAME_LOADOUT_ENABLED ? "[Deploy] casual clone ensure did not return a clone — refusing the BaggerBomb deploy:" : "[Deploy] casual clone ensure did not return a clone — deploying the real agent:", cloneRes.status, cloneData?.error || "");
```

**This is not the 0 the brief asks for.** Both lines are FL4's first ternary, which does not fold (§4). With the flags off the app logs today's words: the ternary picks them at run time.

**Flags on:** the code head `73e142da` against `main` with only the two literals set to `true`.

| | Result |
|---|---|
| Non-map files | 57 and 57 |
| Identical once hashes are masked | **56** |
| Differing | **1, the entry chunk, where `agentDeploy.js` lives, by 3 lines** |

```diff
+ const PER_GAME_LOADOUT_ENABLED = true;
- console.warn("[Deploy] casual clone ensure did not return a clone — deploying the real agent:", cloneRes.status, cloneData?.error || "");
+ console.warn(PER_GAME_LOADOUT_ENABLED ? "[Deploy] casual clone ensure did not return a clone — refusing the BaggerBomb deploy:" : "[Deploy] casual clone ensure did not return a clone — deploying the real agent:", cloneRes.status, cloneData?.error || "");
- console.warn("[Deploy] casual clone ensure errored — deploying the real agent:", err?.message || err);
+ console.warn("[Deploy] casual clone ensure errored — refusing the BaggerBomb deploy:", err?.message || err);
```

So only `agentDeploy.js`'s chunk differs, and only by FL4's two strings, **but one of them ships as the unfolded ternary, with the flag's declaration beside it.** The minified build (`73e142da`) carries the same: both of the first line's strings are in the shipped entry chunk.

### One-flag rollback

On a scratch tree at `73e142da`: `PER_GAME_LOADOUT_ENABLED = false` and its pin (`expect(PER_GAME_LOADOUT_ENABLED).toBe(false)`), the armory still `true`, nothing else. Full Linux suite under the lock: **exit 0**, `Test Files 1307 passed | 8 skipped (1315)`, `Tests 28927 passed | 89 skipped (29016)`, vitest's Duration 263 s. FL3's row and the armory-before-per-game row both hold with per-game loadouts off. So step 1 of the rollback is one literal and one pin, as FL2 says. Step 2 (both off) is the kill-switch build above. A full suite with both flags and both pins back was not run (the brief asks for step 1's); what ran with both off is commit 1's 43 files (below), and the 274 kill-switch rows run that way in every suite.

### Suite, lint, minified build

- **Full Linux suite** (WSL, `flock /tmp/pd-suite.lock`, `TZ=UTC`, 8 workers):
  - on the code head `73e142da`: **exit 0**, `Test Files 1307 passed | 8 skipped (1315)`, `Tests 28927 passed | 89 skipped (29016)`, vitest's Duration 293 s;
  - on the flip commit `8763e57a`: exit 0, `Test Files 1306 passed | 8 skipped (1314)`, `Tests 28915 passed | 89 skipped (29004)`, 304 s. The 12 rows between the two are the census test's.
- **Commit 1 alone** (`96f6b43f`, today's literals): the 42 red files and the bundle test, 43 files, 1,351 rows, exit 0. The dispositions are neutral with the flags off.
- **`lint:gate`** on `73e142da`: exit 0.
- **Minified build** (`vite build`) of `73e142da`: exit 0, 111 files. `edc7b189` after it changes one comment in `agentDeploy.js` (esbuild drops comments), and the pushed head adds only this report. The minified build of the exact pushed head ran last, after this text was final; its result is in the PR description.

---

## §4 FL4 and the build: why one ternary does not fold

FL4 is built as ruled (`src/services/agentDeploy.js:216`, `:221`):

```js
console.warn(PER_GAME_LOADOUT_ENABLED ? '[Deploy] casual clone ensure did not return a clone — refusing the BaggerBomb deploy:' : '[Deploy] casual clone ensure did not return a clone — deploying the real agent:', cloneRes.status, cloneData?.error || '');
console.warn(PER_GAME_LOADOUT_ENABLED ? '[Deploy] casual clone ensure errored — refusing the BaggerBomb deploy:' : '[Deploy] casual clone ensure errored — deploying the real agent:', err?.message || err);
```

Every other client read of the two flags is a literal ternary that Rollup folds, which is what keeps a rolled-back build identical to `main`. **These two sit in a `try … catch`.** The first is inside the `try` block (the clone answer's `else` branch), the second inside the `catch`. Rollup's default `treeshake.tryCatchDeoptimization` keeps everything inside a `try` block as written, so the first ternary is emitted whole, and the flag module's `const` comes into the entry chunk with it. The `catch` block is not deoptimized, so the second folds. The minifier does not fold it either (the minified entry carries both strings).

**What it changes:** nothing a player sees. Flags on, the line reads "… refusing the BaggerBomb deploy:"; flags off, "… deploying the real agent:", exactly today's. What it costs is the build-level proof: the kill-switch build differs from `main` by those 2 lines, and the flags-on build carries one unused string.

**A form that folds, measured on a scratch tree (not in the PR).** The choice moves outside the `try`, as a statement-level literal `if` with brace-less arms, and `main`'s `try … catch` block stays verbatim as the `else` arm:

```js
if (PER_GAME_LOADOUT_ENABLED) try {
  …main's block, with the two refusing lines…
} catch (err) {
  …
} else try {
  …main's block, verbatim…
} catch (err) {
  …
}
```

Rollup folds a literal `if` outside a `try` by cutting `if (…) … else ` and keeping the other arm's exact text. (A braced arm would leave a bare `{ }` block and break identity again.) Measured, on `73e142da` with only this change:

| Check | Result |
|---|---|
| Flags off vs `main` | **byte-identical**: the same entry file name (`index-ok8k4FzL.js`, so its content hash too), and 54 of 54 other non-map files twins |
| Flags on vs `main` + literals | only the entry chunk differs, by **exactly FL4's two strings**, no ternary and no flag declaration |
| `lint:gate` on the file | exit 0 (the gate enforces `no-undef` and rules-of-hooks; `curly` is not in it) |
| Cost | +24 lines in `agentDeploy.js`: the 24-line block duplicated, as A2's desktop lobby duplicated its `<DeskLobby>` arm. The cleanup PR deletes the flag-off arm. |

The diff is saved at `C:/Users/fashr/Documents/FantasyTrades/AgentForm/20261107_FL4_fold_variant.diff`. In the PR it would also change `CLIENT_READS`' two FL4 entries to the one `if (PER_GAME_LOADOUT_ENABLED) try {` line and widen that row's shape check to allow it. **It is not in the PR because it is not FL4's ruled form (a literal ternary).** It is the founder question (§10).

---

## §5 Mutation

Each mutant is one edit on the scratch tree `~/pd-ci-flipx` at the code head `73e142da`, checked to land exactly once. The run is the files vitest relates to the edited module (`vitest related`, the pin and census files among them), `TZ=UTC`, 8 workers, with a control of the same set first. Killed means a non-zero exit. The tree is reset after each.

| # | Mutant | Edit | Run | Result | Rows that caught it |
|---|---|---|---|---|---|
| FL3 | casual clones turned off with per-game loadouts on | `CASUAL_CLONE_CONCURRENCY_ENABLED = false` (`src/config/featureFlags.js:237`) | `perGameLoadoutFlags.test.js`, 27 rows (control green) | **killed**, 1 row | "is on only while casual clones are on (FL3)", with its message |
| M1 | the hub's League card ignores the week lock | `const weekLocked = false;` (`hub/perGameLoadoutModel.js:64`) | 974 rows (control green) | **killed**, 6 rows | `CommandCenterHub.loadouts.jsdom` "board 1 … League: checking …, open, then locked with the week's end" and "board 4 … League locked: … Equip is the lock line"; `perGameLoadoutModel.test.js` (League locked; a lock with no end; the week lock wins during a game; the armory's context) |
| M2 | the League line reads every known week as open | `const lock = leagueLockOf([]);` (`League/LeagueLoadoutLine.jsx:56`) | 317 rows (control green) | **killed**, 5 rows | `LeagueLoadoutLine.jsdom` (locked by the ranked group; the phone League tab locked by the active group) and `LeagueLoadoutLine.lobbies.jsdom` (both real lobbies: Checking, then Open, then Locked; the context reaching the slot) |
| M3 | the Training line draws nothing | `TrainingLoadoutLine` returns null for any loadout (`LeagueLoadoutLine.jsx:86`) | 317 rows (control green) | **killed**, 3 rows | `LeagueLoadoutLine.jsdom`: the Training tab's line, the phone Training tab, the desktop Training panel |

**4 of 4 killed.** The rows that caught M1 to M3 are A2's flag-on rows, which hold the flags on in their own mocks. None of this PR's 186 rewritten rows assert the cards or the lines (they are the hub's and the lobbies' other behaviour, made to run with the flags on); with the flags now live those A2 rows are the shipped state's guard, and the mutants show they bite. Two more spot mutants were run on the census (§7).

---

## §6 Rollback

1. **`PER_GAME_LOADOUT_ENABLED` alone back to `false`** (`src/config/perGameLoadoutFlags.js:39`), with its pin (`perGameLoadoutFlags.test.js`, "is live: true since the flip …" → `toBe(false)`): A1's armory with one loadout. The full suite is green this way (§3).
2. **Both flags back to `false`**, each with its pin (`agentFormFlags.test.js`, "the armory is live …" → `toBe(false)`): the app as it was before the flip (§3 and §4 for the build).

The armory never goes off while per-game loadouts are on: the pin row fails if it does. A rollback moves a flag and its pin; the `DARK_BY_DESIGN` entries stay out (the guard's rows assert they are gone). Per-game loadouts must also go off before casual clones do (FL3).

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

`claude/armory-flip-smoke` @ `f2e826e6`: one commit, "SMOKE ONLY, NEVER MERGE", whose parent is the flip's code head `73e142da` (the PR's head adds only this report on top). Built by git plumbing (a temporary index and `commit-tree`), so it touches exactly two files:

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

1. **The flip preview, signed in:** open the Command Center. The hero is the bare Shadow, breathing. Tap Loadout: two cards, BaggerBomb on top, League under it.
2. **The League card:** if you have a ranked group for next week, it is locked and reads "Locked until the week is scored, after the close on Fri Nov 13."; otherwise it is open. (The census found no ranked group in any locking status tonight, so expect open unless you register first.)
3. **Change BaggerBomb's armor and hold Deploy:** the game wears the new armor.
4. **The League tab:** its line reads Checking for a moment, then open or locked. **The Training tab** says it uses your League loadout, and there is no Customize loadout button.
5. **The smoke states page** (`?loadoutStates=1` on the smoke preview): every frame marked New. The League lock dated "Fri Nov 13" and undated, on the card, the League line and the armory (its context and Equip); the League line's Checking; "Locked while a game is running." on the card and in the armory; and the Deploy strip's "Couldn’t start the BaggerBomb game · try again" with its Retry.

---

## §10 Founder question

**Q1. FL4's first log line: keep the ternary, or fold it?** The ruling's literal ternary is built, and it logs the right words either way. But the first of the two sits inside a `try` block, where the build cannot fold it, so the rolled-back build is not byte-for-byte `main`'s (2 lines in the entry chunk, §3) and the live build ships one unused string. Pick one:

- **(a) Fold it (recommended).** Swap in the form measured in §4: the rolled-back build is then `main`'s byte for byte and the live build carries only the refusing words, at the cost of 24 duplicated lines until the cleanup PR. One commit on this PR; the build checks re-run.
- **(b) Keep it as built.** Nothing else changes; the logs are right either way, and the cleanup PR that removes the flag-off arms makes the line plain. The rollback proof stays "54 of 55 files, and 2 named lines".
- **(c) Change only the second line** (the one in `catch`, which folds) and leave the first as today: the rolled-back build is `main`'s exactly, but while the flags are on the first line says "deploying the real agent" when it does not. Not recommended: it is what FL4 set out to fix.

---

## §11 What ran, where

- **Windows:** worktree `C:/Users/fashr/portfolio-duel/.claude/worktrees/armory-loadouts-flip-9203f6`, branch `claude/armory-flip` (cut from `origin/main` @ `d09603b2`), pushed by refspec. The pin files and the census test ran there too (vitest from the parent checkout's `node_modules`). The census ran there, against production, read-only.
- **WSL:** `~/pd-ci-flip` (the suites, `lint:gate`, the flip's builds), `~/pd-ci-flipm` (`main`'s builds, the smoke build) and `~/pd-ci-flipx` (the discovery runs, the kill-switch build, the mutants, the FL4 variant, the one-flag rollback), detached worktrees of `~/pd-ci` with `node_modules` linked to `~/pd-af0` (lockfile `40382e64edb6` on every tree). Node 20.20.2, `TZ=UTC`, 8 workers, each full suite under `flock /tmp/pd-suite.lock`. Runs went under `~/pd-flip-runs/armory/` (the folder `~/pd-flip-runs` already held another session's Oct 28 files, left alone).
- **Cleanup:** the three trees and `~/pd-flip-runs/armory/` were removed after the last build, under the suite lock (`unlink` each `node_modules` link, `git -C ~/pd-ci worktree remove --force`, `worktree prune`). `~/pd-ci`, `~/pd-ci-af1`, `~/pd-af0` and other sessions' trees were not touched. The space freed is in the PR description.
- **Scripts** in the session scratchpad (not committed): the sync, step, list, build, compare, mutant, variant, rollback and cleanup runners, the dispositions generator, and the smoke composer.
