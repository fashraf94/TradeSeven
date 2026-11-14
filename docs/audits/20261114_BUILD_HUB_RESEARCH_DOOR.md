# Build report: the hub research door ("Work an idea" opens Shared Research), dark

**Build:** Command Center core spec V1.2, Amendment E V1.1, Part 2, with its §12 rulings (R-D1 to R-D4).
**Branch:** `claude/hub-research-door`, cut from `origin/main` @ `c85f7b41` (#1059) after `git fetch origin`. `origin/main` was refetched before the final checks and had not moved.
**Code head:** `adb194c3`. Its two test files were strengthened after the row-named mutation battery (§4.2). This report was first committed as `7549e11b`, before `adb194c3`, and this revision follows `adb194c3`. The tree was clean at the start; the preamble STOP report is outside the repo.
**Mode:** `SHARED_RESEARCH_MODE` is `'off'`, and its pin row in `src/config/sharedResearchFlags.test.js` is unmoved.

## Verdict

| Question | Answer |
|---|---|
| Does the hub change at `'off'`? | **No.** Nothing new renders, is read or is requested. jsdom rows at both sites prove it, and mutant M07 (the mode forced on) turns 12 of them red. |
| What is built | **All of Part 2:** the admission read, the wrapper with its lazy body, `HUB_SHEETS.RESEARCH`, the Research panel's door with the in-progress line and Continue, the story selector, both readers, three research Activity rows, the §5 copy, and the guard rows. |
| R-D1 (the bundle) | **Met, with one reading (Q1).** The entry chunk changes only in its export list (`SignalDropEntry`, `REVIEW_HONEST_LINE` and `fetchFeed` added, later aliases re-lettered) and in the gate reading `.then(e=>e.C)`. Everything else is identical with hashes masked, and the CSS is byte-identical. Of 52 lazy chunks, 8 changed; 2 of those carry minifier-renamed locals (Q1). |
| Full Linux suite | **Exit 1, from one row that fails on `main` too.**<br>On `adb194c3` (`flock`, `TZ=UTC`, 8 workers): 1,486 files, 33,050 tests; 32,914 passed, 135 skipped, 1 failed, no load errors.<br>The failure is `CompeteTab.rankLabel.jsdom.test.jsx` "absent (every caller but the shell)…". It fails identically on `main` `c85f7b41` the same day (1,476 files, 32,831 tests, that one row failed), so the head's failed set equals `main`'s. Cause: a golden captured on the real clock (§4.5, "found outside this task").<br>This build's 15 test files: 387 rows passed, 0 failed, 4 skipped (the browser rows). The two theme guards it registers files in (`src/theme/motion.guard.test.js`, `tokens.guard.test.js`): 694 rows, all passed.<br>The run on `4e878335` gave the same result, with one row fewer (the door file's 44).<br>The commits after `adb194c3` are docs only (`docs/README.md` and this report), and no test reads either file. |
| Rules suite, `lint:gate`, build | **Rules:** 42 files, 784 tests, exit 0, on `4e878335`. `adb194c3` changes only two jsdom/unit test files, which the rules suite does not run.<br>**`lint:gate`:** exit 0 on `adb194c3`.<br>**`vite build`:** exit 0; the pushed head's build is checked in §4.4. |
| Mutation battery | **135 mutants: 133 killed. Every behavioural row but one fails under at least one mutant**; §4.2 names the one row and says why. The 2 survivors are equivalent, and each has a stronger twin that is killed. The first run (77 mutants) recorded no row names. Rerun with names, it showed 59 rows no mutant reached, and two of them could not fail; `adb194c3` fixes those two. |
| Real browser | **4 of 4 rows pass** at 390×844 and 1280×800 on the local smoke page; on the smoke preview: **4 of 4 pass** too, and the three browser mutants are killed. |
| Review (BUILD_RULES §2) | **3 lenses, each with a refuter; 29 findings, no must-fix.** The should-fix items that survived are fixed, each with rows and mutants. 6 questions remain for the founder (§7). |
| Founder action | The phone checklist (§5), the questions (§7), then §6 before the allowlist flip. |

## 1. Base, HEAD, and where the prompt or the amendment was made precise

**Commits:**

| Commit | What |
|---|---|
| `05c03cc2` | Amendment E V1.1, byte-identical as attached (SHA-256 `5f189f3f…6bc3b`, 25,234 bytes), plus its README row |
| `c9c76e4f` | §12 appended verbatim; the README row says so |
| `7131636f` | the code and the guard rows |
| `f2c374b9` | the behaviour rows |
| `9776a559` | the final-check fixes: no new flag read, and the new hub files registered on the theme guards |
| `457f8b2c` | the real-browser rows, gated on `HUB_DOOR_URL` |
| `2210ab0e` | the review round's fixes and rows |
| `4e878335` | one more row (mutant M36b) |
| `7549e11b` | this report (first version) and its README row |
| `adb194c3` | two rows that could not fail, strengthened (§4.2): the door's own element is checked, and the offered types are named |

**Where the prompt or the amendment was made precise or found wrong**, with evidence:

1. **The entry chunk (the preamble STOP).** Any build that reaches the body changes the entry chunk, measured by five probe builds. The rulings R-D1 to R-D4 (§12) govern: §3.2's byte-identical entry and §8's bundle row are superseded.
2. **Anchors that moved:**
   - `fetchFeed` is at `fantasyTimesClient.js:10`, not `:11`.
   - The mount guard's one-edge row was at `:854`, and its Huddle flag row at `:955`.
   - `storyOf` is at `srKit.js:118`.
3. **"{n} findings" says "finding" for one:** `hub/hubCopy.js:316` onward. The body's own Continue row says it that way (`sharedResearchCopy.js:61`, `plural(n, 'finding', 'findings')`), so the hub line and the sheet agree (BUILD_RULES §9).
4. **`{time}` is the date and time, not a bare clock time:** `COPY.time.et(formatHubDayTime(…))` gives "Nov 14, 9:35 AM ET". This is Activity's own format, and it matches the body's `formatWhen`, so a last update from another day is not read as today's.
5. **The wrapper's loading line reuses `research.loading`** ("Checking your research"), because §5 names no loading string. The body's first act is the open-work read, so the words are true.
6. **`equippedListLabel` with per-game loadouts on (main):**
   - It is the BaggerBomb card's book name (`hub/perGameLoadoutModel.js:37-41`, `:75`), the list "Use it in my next game" replaces through `equipLoadoutBook`.
   - It is chosen by whether the shell sits in a per-game loadout scope (`hub/researchDoorView.js:109`). A read of the two flags would have added sites to the censuses in `agentFormFlags.test.js` and `perGameLoadoutFlags.test.js`; the full suite caught that, and `9776a559` removed it.
7. **The sheet's entry** is `{ mode, sessionId, ownerKey }`:
   - It is held by `useHubSheets` as `entry` (`hub/useHubSheets.js:94`), replaced on every open and cleared on close (`:99`).
   - `ownerKey` came from review B3.
8. **Where the admission lives:** its own hook (`src/hooks/useHubResearchAdmission.js`), not folded into the research reader, because it answers a different question. `ConnectedHub` hands it the mode (R-D4).
9. **The selector's `question` is `questionForBeat` only.** A story's own `research.question` is "later" (§2.2, Level 2) and is not read.
10. **The stories reader's Retry** is exposed, but no Part 2 surface shows a stories error; O3's For-you card will. A failed read hands the sheet `[]`.
11. **The hub chunk also holds** `src/config/sharedResearchFlags.js`, `src/constants/sharedResearch.js` and `hub/researchDoorView.js`:
    - The constants module is shared with the body's chunk, so the body imports 10 bindings from the hub chunk.
    - That is why the gate now reads the hub's default export by name (R-D1, item 2).
12. **Prompt Part 7: "no `data-hub-research-*` element" at `'off'`.** S6's idea card already ships `data-hub-research-retry`, `-stale` and `-wait`. The rows check the six attributes this build adds.
13. **Changes beyond the files the prompt names:**
    - **The theme guards.** Part 6 names the mount, activity, boundary and `hubFlags` rows only. The full suite showed that `src/theme/motion.guard.test.js` and `tokens.guard.test.js` (hazard 34) require every new hub file to be registered. So `9776a559` adds the three new hub files to both guards and to `motionGuardBaseline.json` and `tokenGuardBaseline.json`. No existing entry moved.
    - **`HubLink`'s `ariaDisabled`** (`HubParts.jsx:153`, `:163`). Review C6 wanted Try again to say it is busy while the retry is out. `HubLink` had no disabled state, so it gained an optional `ariaDisabled`. It is off unless passed, so every existing `HubLink` renders as before.

## 2. Where admission and each prop come from

**Admission:**
- `ConnectedHub` reads `sharedResearchMode()` (`hub/hubFlags.js:46`) and hands it to `useHubResearchAdmission` (`CommandCenterHub.jsx:842-846`).
- `'off'`: nobody is admitted, and no request is sent.
- `'on'`: every signed-in player is admitted, with no request.
- `'allowlist'`: the verdict comes from `readFilmRoomVerdict(battleId, { ownerId: uid })` (`src/utils/filmRoomGate.js:116`), cached per owner per page life and shared with Bomb mode and the research sheet. The battle id comes from `admissionBattleIdOf` (`hub/researchDoorView.js:40`), which tries two sources in order:
  1. **The first owned live battle:** `readers.liveBattles` (`hub/useHubReaders.js:237`, which is `ownedLiveList`, `selectors/readerInputs.js:112`).
     - That list is App's poll of `agentBattles` (`src/App.jsx:4048`, set at `:4088`, handed as `hub.activeBattles` at `:8827`), owner-filtered and with training clones dropped.
     - Its optimistic entry carries the real `agentBattleId` (`Dashboard/deployHandoff.js:52`).
  2. **Otherwise, the first completed battle:** `readers.inputs.completed` (`selectors/readerInputs.js:82`), taken only while that window belongs to this owner and epoch.
     - That window is an `agentBattles` query by `ownerId` (`services/completedAgentBattles.js:27-28`).
- Nothing new is read to find a battle; with none, there is no request.
- The route answers for any `agentBattles` document the caller owns, of any status (`api/agent/cockpit-status.js:101-114`).
- **The server is final:** the body absorbs a `404 disabled` into its gated line.

**Each prop of the body** (§3.2's table):

| Prop | Source |
|---|---|
| `open` | `true` (`SharedResearchSheet.jsx`, the `<Body open …>` element) |
| `mode` | the entry: "Work an idea" sets `'start'` (`CommandCenterHub.jsx:368`); Continue sets `'session'` (`:369`); an Activity row sets `'session'` (`:371-374`) |
| `item`, `direction` | `null` (wrapper) |
| `sessionId` | the entry's, in `'session'` mode only (wrapper) |
| `stories` | `selectStories(…).items` over the stories reader's answer; `[]` while loading or failed (`CommandCenterHub.jsx:890`) |
| `agentName` | the ranked agent's `name`, from the readers' `loadoutAgentOf` read (`selectors/readerInputs.js:57`, `hub/useHubReaders.js:156`); `CommandCenterHub.jsx:891` |
| `agentId` | the same agent's `id`, the one the Loadout card reads and the server stamps (`CommandCenterHub.jsx:892`) |
| `equippedListLabel` | `equippedListLabelOf(use(PerGameLoadoutContext), runtime.lists, sections.loadout)` (`CommandCenterHub.jsx:548`, `:745`; §1, item 6) |
| `gated` | `!admitted`, false whenever the sheet is open (`CommandCenterHub.jsx:893`) |
| `phone`, `onClose`, `overlayStack` | the shell's site; `runtime.closeSheet`; `useHubOverlays()` in the wrapper |

## 3. The changes

38 files, +3,471/−40 at `adb194c3`, not counting this report. **No file under `api/` changed, and no rule, index, environment variable or flag value. Under `src/components/SharedResearch/` only `sharedResearch.boundary.test.js` changed. `SignalDropEntry` and `src/services/sharedResearchService.js` are untouched. No fenced file (BUILD_RULES §1) was read for editing or edited.**

**New, outside the hub directory** (each a permitted terminal of the hub's walk):

| File | What it is |
|---|---|
| `src/hooks/useHubResearchAdmission.js` | Admission. One effect, one ask per owner and epoch. |
| `src/hooks/useHubStories.js` | `fetchFeed()`, once per owner and epoch, admitted only. |
| `src/hooks/useHubSharedResearch.js` | The research reader. |
| `src/services/sharedResearchRecords.js` | Its one query: `researchWork`, `userId == uid`, `createdAt desc`, `limit 20`, kept to `shared_research`. The origin and the collection are pinned equal to the record model. |
| `src/selectors/storySelection.js` | The story selector. O3's match seam is `matchedIds()`. |

**New, inside the hub directory:**

| File | What it is |
|---|---|
| `SharedResearchSheet.jsx` | The wrapper. `createBodyLoader` (`:33`), the boundary (`:52`), the failed-load line with Try again (`:71`), the sheet (`:84-136`), and the default export over the real loader (`:138`). |
| `hub/loadSharedResearch.js` | The one `import()` of the body. |
| `hub/researchDoorView.js` | The pure view: `admissionBattleIdOf` (`:40`), `researchDoorOf` (`:68`), `researchSheetHeldBy` (`:88`), and the list label (`:93-110`). |

**Changed:**

| File | Change |
|---|---|
| `CommandCenterHub.jsx` | The imports (`:174-184`). `researchActionsOf` (`:361-376`). Both shells' actions (`:417`, `:605`), their close rule (`:437`, `:618`) and their sheet site (`:542-556`, `:739-752`). `ConnectedHub`'s admission, readers and door (`:836-848`, `:876-895`). The six shell elements (`:924-937`). |
| `hub/useHubSheets.js` | `RESEARCH` (`:53`). The held entry (`:94`, `:99`). The opener when a sheet opens from inside a sheet (`:84`). |
| `hub/hubFlags.js` | `sharedResearchMode()` (`:30`, `:46-50`). |
| `hub/hubCopy.js` | The §5 Part 2 keys (`:312-328`, `:625-628`). |
| `hub/activityRows.js` | The research kind, the clip and the rows (`:61-103`); `deriveActivity` and `activitySectionOf` take `research`. |
| `panels/ResearchPanel.jsx` | The door block (`:138-173`), mounted only when `door` is given (`:183`). |
| `panels/AreaPanel.jsx` | Passes the door and its actions (`:33`). |
| `sections/ActivitySection.jsx` | A row with `sessionId` presses too, and hands on its event (`:30`). |
| `HubParts.jsx` | `HubLink` takes `ariaDisabled` (`:153`, `:163`). |

**Guards:**
- **The mount guard:** the terminals, the second load-time edge and its plants, the readers' rows, the named imports, and the R-S6-2 note.
- **The activity guard:** the hooks call by call; the wrapper, loader, view and selector hold no activity.
- **The boundary test:** "one door".
- **The theme guards:** the three new hub files, with their baselines.
- **`hubFlags.test.js`.**

## 4. Tests, mutations, browser, bundle, review

### 4.1 Rows

| File | Rows | What it covers |
|---|---|---|
| `src/hooks/useHubResearchAdmission.jsdom.test.jsx` | 13 | `'off'` and `'on'` with no request; at `'allowlist'`, one request then cached, no battle no request, false or pending not admitted, an owner change. All against the real `filmRoomGate` cache. |
| `src/hooks/useHubResearchReaders.jsdom.test.jsx` | 28 (14 per reader) | No read unless admitted; once per owner and epoch; an owner or epoch change; a former owner's success or failure dropped; Retry; stale kept; no listener. |
| `src/selectors/storySelection.test.js` | 42 | Each eligible and excluded type; the required fields; expiry at `nowMs`; order and five; the beat's and the default question; no reason; the exact shape, against srKit. |
| `src/services/sharedResearchRecords.test.js` | 4 | The query, the filter, model parity. |
| `hub/researchDoorView.test.js` | 21 | Battle-id order and owner checks; the door's three states and its line; the held sheet; the list labels. |
| `hub/activityRows.research.test.js` | 14 | The three rows; abandoned; other origins; nothing invented; the clip; cutoff and kind order. |
| `hub/loadSharedResearch.test.js` | 2 | The kept promise; the reset after failure. |
| `SharedResearchSheet.jsdom.test.jsx` | 13 | Loading then body; failed load and Try again; `aria-disabled` while retrying; a throwing body; the HubSheet; the props table. |
| `CommandCenterHub.researchDoor.jsdom.test.jsx` | 45 (44 before `adb194c3`) | The hub end to end at both sites (detail below). |
| Guards | — | Mount, activity, boundary, `hubFlags`, copy and theme guards (§3). |

The hub end-to-end rows cover:
- `'off'`, `'on'` and `'allowlist'`;
- the door's states;
- each opener's mode and focus return;
- one overlay at a time;
- the lapse and the owner change;
- the list label.

### 4.2 The mutation battery (135 mutants, 133 killed; every behavioural row but one fails under a mutant)

**Method:**
- **Why it ran twice.** The first run (77 mutants, on `2210ab0e`) recorded only how many rows each mutant failed, not which ones, so it could not show that every behavioural row has a mutant. The battery was run again with every failed row's name recorded.
- **Trees:**
  - M01–M81 ran on an LF `git archive` tree of `4e878335`.
  - M76 (a second time) and M82–M132 ran on the same tree with `adb194c3`'s door test copied in. M95–M99 also had its selector test.
  - `adb194c3` changes only those two test files, so that tree is `adb194c3`'s.
- Each mutant ran only its named rows' files. Every anchor resolved exactly once.
- A kill means vitest exited non-zero **and** reported a failed assertion; a crash is never a kill.
- Each file was restored byte for byte, proved by SHA-256 (all `restored=true`).
- Spec, runner, and the map from each row to the mutants that fail it are in the session scratchpad: `mut/spec.json`, `mut/run-mutants.mjs`, `mut/row-killers-final.json`.

**What the row names showed, and what changed:**
- Of the nine behaviour files' 181 rows, 59 failed under no mutant. M82–M132 aim one at each of them.
- Two of those rows could not fail, so the tests changed in `adb194c3`:
  - **"Nothing announces"** checked only the door's descendants, because `querySelector` never matches the element it is called on. A live role on the door itself survived (M76). The row now checks the element too, once with the line and once with the error; M76 and M132 are killed.
  - **"%s is offered"** was generated from `ELIGIBLE_STORY_TYPES`, so dropping a type removed its row instead of failing it. The row now names the five types; M95–M99 are each killed by their own type's row.
- M107 and M109 mutate `src/constants/sharedResearch.js`: B1's `questionForBeat`, where the selector's question comes from. The rows they fail are the selector's.
- **One row has no mutant:** `CommandCenterHub.researchDoor`, "the stories read failing: the sheet opens with no stories ([])". Three guards each turn a missing list into `[]`:
  - the hub hands the selector `[]` unless the read is ready;
  - the selector reads a non-list as none (M80 kills its row);
  - the wrapper does the same (M130 kills its row).

  So no single-point mutant can hand the sheet a list the reader never had. The row's title no longer says "stale", because it never tested a kept answer.
- After `adb194c3` the nine files hold 182 rows; 181 fail under at least one mutant.

| Id | The row it targets | File mutated | Result |
|---|---|---|---|
| M01 | admission: 'off' is not admitted, no request | `hooks/useHubResearchAdmission.js` | killed (2/13 red) |
| M02 | admission: 'on' sends no request | `hooks/useHubResearchAdmission.js` | killed (1/13 red) |
| M03 | admission: no owned battle, no request | `hooks/useHubResearchAdmission.js` | killed (1/13 red) |
| M04 | admission: a false verdict is not admitted | `hooks/useHubResearchAdmission.js` | killed (3/13 red) |
| M05 | admission: cached for a second mount (admitted from the first render) | `hooks/useHubResearchAdmission.js` | killed (1/13 red) |
| M06 | admission: a former owner's yes is never the new owner's | `hooks/useHubResearchAdmission.js` | killed (1/13 red) |
| M07 | hub at 'off': nothing renders, is read or requested | `CC/CommandCenterHub.jsx` | killed (12/44 red) |
| M08 | hub at 'allowlist': the owned LIVE battle first | `CC/hub/researchDoorView.js` | killed (3/65 red) |
| M09 | sharedResearchMode: any other value reads off | `CC/hub/hubFlags.js` | killed (2/19 red) |
| M10 | stories reader: no read unless admitted | `hooks/useHubStories.js` | killed (3/28 red) |
| M11 | research reader: no read unless admitted | `hooks/useHubSharedResearch.js` | killed (3/28 red) |
| M12 | stories reader: a former owner's answer never shown | `hooks/useHubStories.js` | killed (1/28 red) |
| M13 | research reader: a former owner's answer never shown | `hooks/useHubSharedResearch.js` | killed (1/28 red) |
| M14 | research reader: a failed refresh keeps the last good answer | `hooks/useHubSharedResearch.js` | killed (1/28 red) |
| M15 | research reader: once per owner and epoch per load | `hooks/useHubSharedResearch.js` | killed (13/28 red) |
| M16 | stories reader: an owner change starts fresh | `hooks/useHubStories.js` | killed (4/28 red) |
| M17 | selector: Market Pulse is left out | `selectors/storySelection.js` | killed (3/43 red) |
| M18 | selector: the previews are left out | `selectors/storySelection.js` | killed (2/42 red) |
| M19 | selector: an expired story is dropped | `selectors/storySelection.js` | killed (2/42 red) |
| M20 | selector: newest first | `selectors/storySelection.js` | killed (3/42 red) |
| M21 | selector: at most five | `selectors/storySelection.js` | killed (1/42 red) |
| M22 | selector: the beat's question | `selectors/storySelection.js` | killed (6/42 red) |
| M23 | selector: reason null and general with no interests | `selectors/storySelection.js` | killed (3/42 red) |
| M24 | selector: the item's exact shape (context = subheadline) | `selectors/storySelection.js` | killed (1/42 red) |
| M25 | selector: a blank headline is left out | `selectors/storySelection.js` | killed (1/42 red) |
| M26 | panel: the in-progress line uses lastTurnAt | `CC/hub/researchDoorView.js` | killed (5/65 red) |
| M27 | panel: the newest OPEN investigation | `CC/hub/researchDoorView.js` | killed (3/65 red) |
| M28 | panel: the error line with Retry, the door stays | `CC/panels/ResearchPanel.jsx` | killed (3/44 red) |
| M29 | panel: Work an idea stays in every state | `CC/panels/ResearchPanel.jsx` | killed (3/44 red) |
| M30 | panel: the door only for an admitted player | `CC/CommandCenterHub.jsx` | killed (9/44 red) |
| M31 | sheet: Work an idea opens the start view | `CC/CommandCenterHub.jsx` | killed (5/44 red) |
| M32 | sheet: Continue opens its investigation | `CC/CommandCenterHub.jsx` | killed (6/44 red) |
| M33 | sheet: an Activity row opens its investigation | `CC/CommandCenterHub.jsx` | killed (7/44 red) |
| M34 | sheet: focus returns to the opener | `CC/hub/useHubSheets.js` | killed (10/44 red) |
| M35a | sheet: admission ending frees the slot (phone) | `CC/CommandCenterHub.jsx` | killed (1/44 red) |
| M35b | sheet: admission ending frees the slot (wide) | `CC/CommandCenterHub.jsx` | killed (1/44 red) |
| M36 | sheet: the entry is held with the open sheet and cleared on close | `CC/hub/useHubSheets.js` | survived (equivalent; twin killed) |
| M37 | wrapper: Try again loads with a fresh import | `CC/SharedResearchSheet.jsx` | killed (4/13 red) |
| M38 | wrapper: the line stays until the fresh import has loaded | `CC/SharedResearchSheet.jsx` | survived (equivalent; twin killed) |
| M39 | wrapper: a failed load shows its line (the boundary) | `CC/SharedResearchSheet.jsx` | killed (6/13 red) |
| M40 | wrapper: the props table (session id only in session mode) | `CC/SharedResearchSheet.jsx` | killed (1/13 red) |
| M41 | wrapper: the hub's overlay stack handed to the body | `CC/SharedResearchSheet.jsx` | killed (1/13 red) |
| M42 | loader: a failed import is not kept | `CC/hub/loadSharedResearch.js` | killed (2/75 red) |
| M43 | loader: one import per page | `CC/hub/loadSharedResearch.js` | killed (2/2 red) |
| M44 | activity: an abandoned investigation has its opened row only | `CC/hub/activityRows.js` | killed (1/14 red) |
| M45 | activity: a record of another origin yields no row | `CC/hub/activityRows.js` | killed (1/14 red) |
| M46 | activity: the same cutoff as every kind | `CC/hub/activityRows.js` | killed (1/14 red) |
| M47 | activity: the kind order puts research last | `CC/hub/activityRows.js` | killed (2/14 red) |
| M48 | activity: each row carries its session id (it opens its investigation) | `CC/hub/activityRows.js` | killed (11/58 red) |
| M49 | activity: the saved row at endedAt | `CC/hub/activityRows.js` | killed (1/14 red) |
| M50 | activity: a session row is pressable (ActivityRows) | `CC/sections/ActivitySection.jsx` | killed (7/44 red) |
| M51 | copy: "finding" for one | `CC/hub/hubCopy.js` | killed (2/71 red) |
| M52 | equippedListLabel: the BaggerBomb book inside a per-game scope | `CC/hub/researchDoorView.js` | killed (2/65 red) |
| M53 | service: the one query (userId, createdAt desc, limit 20) | `services/sharedResearchRecords.js` | killed (1/4 red) |
| M54 | service: kept to shared_research | `services/sharedResearchRecords.js` | killed (2/4 red) |
| M55 | guard: a second import() in the wrapper | `CC/SharedResearchSheet.jsx` | killed (3/111 red) |
| M56 | guard: a static import of the body in the hub graph | `CC/SharedResearchSheet.jsx` | killed (4/111 red) |
| M57 | guard: a reader with a second service import | `hooks/useHubStories.js` | killed (1/73 red) |
| M58 | guard: a reader with a focus listener | `hooks/useHubSharedResearch.js` | killed (2/53 red) |
| M59 | guard: a hub file importing the body's service | `CC/hub/researchDoorView.js` | killed (4/73 red) |
| M60 | guard: the readers called once, in ConnectedHub | `CC/CommandCenterHub.jsx` | killed (1/73 red) |
| M61 | B3: an owner change closes the former owner's sheet | `CC/hub/researchDoorView.js` | killed (3/65 red) |
| M62 | C1: a sheet opened from inside a sheet returns focus to that sheet's opener | `CC/hub/useHubSheets.js` | killed (2/44 red) |
| M63 | C3: the door Retry keeps focus on "Work an idea" | `CC/panels/ResearchPanel.jsx` | killed (2/44 red) |
| M64 | C6: Try again is aria-disabled while the retry is out | `CC/SharedResearchSheet.jsx` | killed (1/13 red) |
| M65 | C6: the loading line while the retry is out | `CC/SharedResearchSheet.jsx` | killed (1/13 red) |
| M66 | C8: the clip counts code points | `CC/hub/activityRows.js` | killed (1/14 red) |
| M67 | B4: the stories reader drops a former owner's late failure | `hooks/useHubStories.js` | killed (2/28 red) |
| M68 | B4: the research reader drops a former owner's late failure | `hooks/useHubSharedResearch.js` | killed (2/28 red) |
| M69 | B5: "Work an idea" opens the start view even with an investigation open | `CC/CommandCenterHub.jsx` | killed (3/44 red) |
| M70 | B6: desktop Continue is wired | `CC/CommandCenterHub.jsx` | killed (2/44 red) |
| M71 | B6: phone Continue is wired | `CC/CommandCenterHub.jsx` | killed (4/44 red) |
| M72 | B6: desktop door Retry is wired | `CC/CommandCenterHub.jsx` | killed (1/44 red) |
| M73 | B6: phone research Activity rows hand on their event (focus returns to the row) | `CC/PhoneTabs.jsx` | killed (1/44 red) |
| M74 | B11: research after the idea and plan rows at one time | `CC/hub/activityRows.js` | killed (1/14 red) |
| M38b | wrapper: the line stays until the fresh import has loaded (a new lazy swapped in and mounted at the press) | `CC/SharedResearchSheet.jsx` | killed (4/13 red) |
| M36b | sheet: the entry is cleared on close and replaced on every open | `CC/hub/useHubSheets.js` | killed (1/44 red) |
| M75 | panel: the door sits above the Ideas eyebrow | `CC/panels/ResearchPanel.jsx` | killed (1/44 red) |
| M76 | panel: the door holds no live region | `CC/panels/ResearchPanel.jsx` | killed (2/45 red) |
| M77 | hub: a tab switch reads nothing more | `CC/CommandCenterHub.jsx` | killed (4/44 red) |
| M78 | wrapper: a HubSheet 720 wide | `CC/SharedResearchSheet.jsx` | killed (1/13 red) |
| M79 | wrapper: the hub's title, eyebrow and label | `CC/SharedResearchSheet.jsx` | killed (1/13 red) |
| M80 | selector: anything that is not a story is skipped | `selectors/storySelection.js` | killed (1/42 red) |
| M81 | selector: the stories it was given are never changed | `selectors/storySelection.js` | killed (1/42 red) |
| M82 | view: then the completed window, while it is this owner's | `CC/hub/researchDoorView.js` | killed (1/21 red) |
| M83 | view: a battle another owner holds is never handed over | `CC/hub/researchDoorView.js` | killed (1/21 red) |
| M84 | view: no signed-in player → null (no battle handed over) | `CC/hub/researchDoorView.js` | killed (1/21 red) |
| M85 | view: a row without a usable id is skipped | `CC/hub/researchDoorView.js` | killed (1/21 red) |
| M86 | view + hub: while the read is out, no line and the door shows (loading) | `CC/hub/researchDoorView.js` | killed (2/66 red) |
| M87 | view: error is the error state, no line | `CC/hub/researchDoorView.js` | killed (1/21 red) |
| M88 | view: an open record with no session id is skipped | `CC/hub/researchDoorView.js` | killed (1/21 red) |
| M89 | view: a kept answer through a failed refresh (stale) still shows its line | `CC/hub/researchDoorView.js` | killed (1/21 red) |
| M90 | view: the session id is host.id (a blank one is none) | `CC/hub/researchDoorView.js` | killed (1/21 red) |
| M91 | view: records only from a ready read | `CC/hub/researchDoorView.js` | killed (3/21 red) |
| M92 | view: per-game loadouts, the BaggerBomb card's book name | `CC/hub/researchDoorView.js` | killed (3/21 red) |
| M93 | view + hub: no book equipped → null (not the fallback name) | `CC/hub/researchDoorView.js` | killed (2/66 red) |
| M94 | view: per-game loadouts off, the watchlist the card resolved, else null | `CC/hub/researchDoorView.js` | killed (1/21 red) |
| M95 | selector: market_mover is offered | `selectors/storySelection.js` | killed (22/42 red) |
| M96 | selector: macro_alert is offered | `selectors/storySelection.js` | killed (2/42 red) |
| M97 | selector: earnings_recap is offered | `selectors/storySelection.js` | killed (2/42 red) |
| M98 | selector: sector_column is offered | `selectors/storySelection.js` | killed (2/42 red) |
| M99 | selector: econ_recap is offered | `selectors/storySelection.js` | killed (2/42 red) |
| M100 | selector: deepdive is left out | `selectors/storySelection.js` | killed (1/42 red) |
| M101 | selector: an unknown type and no type are left out (an allowlist, not a denylist) | `selectors/storySelection.js` | killed (2/42 red) |
| M102 | selector: an empty or missing headline is left out (none is invented) | `selectors/storySelection.js` | killed (3/42 red) |
| M103 | selector: an unreadable or missing publishedAt is left out | `selectors/storySelection.js` | killed (2/42 red) |
| M104 | selector: an unreadable or missing expiresAt is left out (never "never expires") | `selectors/storySelection.js` | killed (2/42 red) |
| M105 | selector: no id or a blank id is left out | `selectors/storySelection.js` | killed (2/42 red) |
| M106 | selector: equal times are ordered by id | `selectors/storySelection.js` | killed (1/42 red) |
| M107 | selector: an unknown beat takes the default question (questionForBeat, B1's) | `constants/sharedResearch.js` | killed (2/42 red) |
| M108 | selector: no beat takes the default question | `selectors/storySelection.js` | killed (1/42 red) |
| M109 | selector: a beat that names an Object key takes the default question | `constants/sharedResearch.js` | killed (1/42 red) |
| M110 | selector: the same keys as the body's fixture story (srKit storyOf) | `selectors/storySelection.js` | killed (2/42 red) |
| M111 | service: the origin and the collection are the model's | `services/sharedResearchRecords.js` | killed (2/4 red) |
| M112 | activity: the rows use the record model's own origin word | `CC/hub/activityRows.js` | killed (12/14 red) |
| M113 | activity: nothing invented — no session id, no row | `CC/hub/activityRows.js` | killed (1/14 red) |
| M114 | activity: a missing question leaves no sub | `CC/hub/activityRows.js` | killed (1/14 red) |
| M115 | activity: no research input is no rows | `CC/hub/activityRows.js` | killed (1/14 red) |
| M116 | admission: 'on' admits at once, with no request | `hooks/useHubResearchAdmission.js` | killed (1/13 red) |
| M117 | admission: 'on' with no signed-in player is not admitted | `hooks/useHubResearchAdmission.js` | killed (1/13 red) |
| M118 | admission: admitted on a definite yes, not before the answer | `hooks/useHubResearchAdmission.js` | killed (2/13 red) |
| M119 | admission: the verdict is the owner's (another battle id asks nothing new) | `hooks/useHubResearchAdmission.js` | killed (1/13 red) |
| M120 | admission: a battle that arrives later is asked about then, once | `hooks/useHubResearchAdmission.js` | killed (2/13 red) |
| M121 | stories reader: admitted, loading then ready | `hooks/useHubStories.js` | killed (2/28 red) |
| M122 | stories reader: re-renders and a new props object read nothing more | `hooks/useHubStories.js` | killed (1/28 red) |
| M123 | stories reader: a failed read is the error state; Retry answers | `hooks/useHubStories.js` | killed (1/28 red) |
| M124 | stories reader: a failed refresh keeps the last good answer, marked stale | `hooks/useHubStories.js` | killed (1/28 red) |
| M125 | stories reader: an older Retry landing after a newer one is dropped | `hooks/useHubStories.js` | killed (1/28 red) |
| M126 | stories reader: no timer and no listener | `hooks/useHubStories.js` | killed (1/28 red) |
| M127 | wrapper: nothing is loaded until the sheet renders | `CC/SharedResearchSheet.jsx` | killed (6/13 red) |
| M128 | wrapper: a second open renders the loaded body at once, no second load | `CC/SharedResearchSheet.jsx` | killed (4/13 red) |
| M129 | wrapper: the phone is handed on to the body | `CC/SharedResearchSheet.jsx` | killed (1/13 red) |
| M130 | wrapper: stories that are not a list are [] | `CC/SharedResearchSheet.jsx` | killed (1/13 red) |
| M131 | hub at 'on' (desktop): the door shows | `CC/CommandCenterHub.jsx` | killed (7/45 red) |
| M132 | panel: nothing announces — the error row is no live region | `CC/panels/ResearchPanel.jsx` | killed (1/45 red) |

**The two survivors are equivalent:**
- **M36** (an open keeps a held entry): close clears the entry, so `prev` is always `null`. Its twin **M36b** (close keeps it too) is killed by the "Work an idea → close → Continue" row.
- **M38** (a new lazy swapped in before the retry loads): the boundary remounts only after the load succeeds, and the success overwrites the swap. Its twin **M38b** (swap and remount at the press) is killed by the "line stays while the retry is out" row.

**Browser mutants.** Each was built from the smoke commit plus one mutation, served locally, and run with the four browser rows. All three were killed:

| Id | Mutation | Result |
|---|---|---|
| BM1 | The body imported statically (no lazy chunk): `SharedResearchSheet.jsx`, default export | killed: both "Work an idea" rows ("expected [] to have a length of 1": no body chunk was requested) |
| BM2 | The opener taken as `<body>`: `useHubSheets.js`, `const target = document.body` | killed: all 4 rows (focus `'body'`, not the opener) |
| BM3 | Escape closes nothing: the wrapper hands HubSheet `onClose={() => {}}` | killed: all 4 rows (the dialog never detaches) |

Before the mutants, the same four rows passed on the smoke commit's own build.

### 4.3 Real browser

The file is `src/components/CommandCenter/researchDoor.browser.test.js`, gated on `HUB_DOOR_URL` (CI skips it). It runs headless Edge (`playwright-core`, channel `msedge`) against the smoke page `?hubResearchDoor=1`.

**What the page is:** the hub's own `ResearchPanel` door, the `useHubSheets` hook, `researchActionsOf`, `ActivityRows` and `SharedResearchSheet`, under `HubOverlayProvider`. The body loads through the real lazy edge, and every body request is answered from the body's committed fixtures. **`ConnectedHub`'s own wiring (the readers and admission) is proven in jsdom, not here.**

| Row | 390×844 | 1280×800 |
|---|---|---|
| "Work an idea" opens the sheet; the body's chunk is requested once, only at the first open; Escape closes; focus is back on "Work an idea"; a second open requests nothing; no sideways scroll | local pass; preview pass | local pass; preview pass |
| Continue opens its investigation (the fixture's Shop Pay question); Escape; focus is back on Continue | local pass; preview pass | local pass; preview pass |

### 4.4 The bundle (R-D1), checked against `main`'s build

**Method:** both minified and unminified builds of `main` `c85f7b41` and the head, compared by a script that fails on any difference R-D1 does not name (session scratchpad `wsl/bundle-delta.mjs`). The script itself was tested: six planted real changes each made it fail, with its own id.

| Check | Result |
|---|---|
| E1 · entry exports | Added: `REVIEW_HONEST_LINE`, `SignalDropEntry`, `fetchFeed`. None removed. Minified 595 → 598 pairs, 330 aliases re-lettered. |
| E2 · the rest of the entry | Identical with hashes masked, except the gate: `import("./CommandCenterHub-H.js")` → `….then(e=>e.C)`. The hub chunk exports `C`. |
| E3 · entry modules | 1,181, identical |
| C1 · CSS | byte-identical, 36,828 B |
| X1 · `index.html` and the other non-asset files | identical with hashes masked |
| L1 · lazy chunks | 52 compared; 44 identical. 6 differ only in entry aliases: `BarChart`, `FantasyTimesFeed`, `FilmRoomScreenV2`, `StonkOptionsArenaV2`, `StoryDetail`, `VeraDeepDive`. 2 differ in entry aliases plus minifier-chosen local names (Q1): `AgentBattleScreen`, `BaggerBombTrainingBattleViewV4`. The unminified twins of all 8 differ in entry aliases only. |
| H1 · hub chunk modules | 72 → 82; the added ten are this build's (§1, item 11), none removed |
| B1 · body chunk | new: `SharedResearchSheetBody-*.js`, 13 modules |

| Minified size | `main` | head |
|---|---|---|
| entry `index-*.js` | 5,010,490 | 5,010,533 (+43, the preamble's measure) |
| hub `CommandCenterHub-*.js` | 192,884 | 207,573 (+14,689: the ten hub-side modules) |
| body `SharedResearchSheetBody-*.js` | — | 77,895 (new) |
| CSS | 36,828 | 36,828 (byte-identical) |

The check ran on `4e878335` against `c85f7b41` (SHAs recorded in its JSON) and exited 0. The unminified entry went from 9,287,377 to 9,287,466 B.

**The pushed head.** Everything after `4e878335` is test files and docs, which are not in the bundle. The pushed head was built, and every output file except source maps was compared with `4e878335`'s build: none differs.

### 4.5 The review (BUILD_RULES §2)

**How it ran:**
- Three lenses: (a) dark at `'off'`, and admission; (b) the hub's rules and test integrity; (c) accessibility and the 390 px phone.
- Each worked read-only on its own LF archive tree of `457f8b2c`.
- Each finding then went to a refuter on another tree, told to disprove it with a repro.
- One round.

| # | Finding | Refuter | Disposition |
|---|---|---|---|
| A1 / B2 | At `'allowlist'`, admission drops while the hub holds no owned battle id, even with the owner's yes cached. The sheet closes, and both readers read again when the window lands. | CONFIRMED (the mechanism; reach is low) | **Q2.** §1's letter says no battle means not admitted; built to the letter. |
| A2 | A failed ask is held `false` for the mount over a later cached yes | PARTLY (it cannot happen on main's flags) | none |
| A3 / B1 | No row caught removal of either lapse-close line | CONFIRMED, at both sites | **fixed:** a re-admit row at each site; mutants M35a and M35b killed |
| A4 | The off rows check selectors, not whole-body identity | CONFIRMED, a nit (the property holds) | noted |
| A5 | R-D1 L1's third class (minifier names) | PARTLY (safe, but must be disclosed) | **Q1** |
| A6 | Gaps in the bundle script (`index.html`, other files, the gate alias, SHAs) | CONFIRMED, a nit | **fixed** in the script (X1, E2b, SHAs) |
| A7 | The server's allowlist also needs idea-record admission | REFUTED (both reduce to the cockpit list) | none |
| B3 | At `'on'`, an owner change kept the sheet open on the former owner's investigation | PARTLY (a direct A→B change) | **fixed:** the entry's `ownerKey` and `researchSheetHeldBy`; rows at both sites; M61 killed |
| B4 | The readers' catch-path guard had no row | CONFIRMED | **fixed:** rows; M67 and M68 killed |
| B5 | "Work an idea" with an investigation open: no row | CONFIRMED | **fixed:** rows; M69 killed |
| B6 | Desktop Continue, desktop Retry and phone Activity rows: no rows | CONFIRMED | **fixed:** rows at both sites; M70–M73 killed |
| B7 / C2 | The door's Retry shows no loading while out, and is unthrottled | CONFIRMED (the Huddle readers do the same) | **Q3** |
| B8 / C1 | A research row inside the Activity sheet: focus on close went to the hub root | CONFIRMED | **fixed:** a sheet opened from inside a sheet returns focus to that sheet's opener (`useHubSheets.js:84`); M62 killed |
| B9 | StrictMode reads twice in development | CONFIRMED, a nit (Huddle precedent; production unaffected) | noted |
| B10 | "Nothing recorded yet" while the research read is out | CONFIRMED, a nit (Huddle precedent) | noted |
| B11 | Research against idea and plan rows at one time: unpinned | CONFIRMED | **fixed:** a row; M74 killed |
| C3 | A successful door Retry dropped focus to `<body>` | CONFIRMED (S6 does the same) | **fixed:** the press moves focus to "Work an idea"; M63 killed |
| C4 | Continue's name is just "Continue" | CONFIRMED, a nit (WCAG 2.4.4 passes in context) | noted |
| C5 | Two "Retry" buttons when both reads fail | CONFIRMED, a nit | noted |
| C6 | Try again: no in-flight feedback, no alert, no Reload | CONFIRMED | **fixed:** `aria-disabled` and the loading line while out (M64, M65 killed). Alert and Reload: **Q4** |
| C7 | A throwing body: after Try again focus falls to `<body>` | CONFIRMED, a nit | §10's HubSheet rescue (its own PR) |
| C8 | The research sub: overflow, and the clip splitting a surrogate pair | PARTLY (overflow refuted by `index.css`'s global `overflow-wrap`) | **fixed:** the clip counts code points (M66 killed) |
| C9 | Concluded and saved rows have no sub | CONFIRMED (§3.3's letter) | **Q5** |
| C10 | The dialog title is "Work an idea" for every entry | CONFIRMED (§5's letter) | **Q6** |
| C11 | With the door present, game rows stay enabled without `openGame` | CONFIRMED, a nit (App always wires it) | noted |

**A timing failure in an earlier run.** The first full run (on `f2c374b9`) also failed `api/_utils/gemmaClient.test.js` "abort DURING BODY READ…" once. That row passed alone three times, and it passed in the final run.

**Found outside this task (for separate tasking, not fixed):**
- `src/components/draft/CompeteTab.rankLabel.jsdom.test.jsx` "absent (every caller but the shell)…" fails on `main` `c85f7b41` too.
- Its golden was captured on the real clock, and `CompeteTab.jsx:158`/`:234` age the fixture's Nov 11 data by `Date.now()`.

## 5. The founder's phone checklist (the smoke preview, iPhone)

**Smoke branch:** `claude/hub-research-door-smoke` @ `2a9b1753`, one commit on `4e878335` built by git plumbing (never merged). **Preview:** https://trade-seven-knlkzz0hr-fais-projects-bc179554.vercel.app . The bundle was checked to carry the `hubResearchDoor` switch.

What the smoke changes:
- **The mode:** the client's is forced `'on'`; the server's stays `'off'`.
- **The data:** the research reader answers two fixture records, one open and one concluded. Every Shared Research request is answered from the body's fixtures.
- **What stays real:** the stories come from the real feed. Nothing is written, and no model is called.

**Not exercised by this build:** the signed-in path (steps 1 to 6 below). The real-browser rows drove only the no-sign-in page `?hubResearchDoor=1` (§4.3), locally and on the preview. `ConnectedHub`'s own wiring is proven in jsdom only: admission, both readers and the door's data. This checklist is the first time the signed-in smoke hub is driven.

1. **Sign in.** On the **Research** tab, the door shows at the top: "Research in progress · last update {about an hour ago} · 9 findings", Continue, and "Work an idea", above the Ideas eyebrow.
2. **"Work an idea":** the sheet rises from the bottom, titled "Work an idea". After a moment the body shows the open investigation and Recent stories (real FantasyTimes stories).
3. **Tap a story:** its preview, with the beat's question. Go **back**, then close the sheet. You are on the Research tab, on "Work an idea".
4. **Continue:** the sheet opens on "Faster checkout is spreading across online stores; which company earns from it?". Close it.
5. **Overview tab:** the research rows are "Research opened" (3 hours ago), "Research concluded" (5 hours ago) and "Research opened" (7 hours ago), mixed by time with your own rows. On the phone, Overview shows only three rows (`PHONE_ACTIVITY_LIMIT`). If your newer real rows fill them, tap "All activity · N" to find the research rows. Tap "Research concluded"; the sheet opens on that investigation. Close it.
6. **With VoiceOver on, steps 2 and 4:** after closing, the cursor is back on the button you tapped.
7. **The live app at `'off'`** (production, or any preview of `main`): the Research tab is today's, with no door and no "Work an idea".

## 6. Before the allowlist flip (amendment §11, copied)

1. `firebase deploy --only firestore:rules` (the `sharedResearchSessions` and `sharedResearchQuota` blocks).
2. `firebase deploy --only firestore:indexes` (the `researchWork` indexes).
3. Part 2 merged.
4. The flip: a one-line founder PR that moves `SHARED_RESEARCH_MODE` to `'allowlist'` and its pin row (`sharedResearchFlags.test.js`). Then the spec §12 allowlist cases on the founder's and FT_QA's accounts.

**Added by this build:** answer Q2 before step 4. The allowlist accounts are exactly the accounts the case in A1 can reach.

## 7. Questions for the founder

1. **Q1 (R-D1's wording).** Two minified lazy chunks, `AgentBattleScreen` and `BaggerBombTrainingBattleViewV4`, differ in more than re-lettered aliases: the minifier also re-chose some local names (`$`↔`L`, `x`↔`_`).
   - It ranks its name alphabet by character frequency, and the new alias letters shift those counts.
   - Their unminified twins differ in entry aliases only, and the token skeletons are identical.
   - May this count as within R-D1? **Recommended: yes.**
2. **Q2 (admission with a cached yes and no battle id held).** At `'allowlist'`, an owner whose completed window holds no owned battle (before their first completed game) loses admission when their only live game leaves the poll. The investigation they have open closes, and both readers read again when the window lands (A1 / B2).
   - The fix is one line: admit on this owner's known verdict when no id is held; still no request without one.
   - It reads §1's "with no owned battle, the player is not admitted" as "nothing to ask about".
   - May it go in before the flip? **Recommended: yes.**
3. **Q3 (the door's Retry).** The readers follow the Huddle readers: the error line stays while a Retry is out, and presses are not throttled (B7 / C2).
   - S6's pattern shows the loading line and enforces a 30 s wait, with "You can try again at {time}".
   - Keep the Huddle's, or adopt S6's? **Recommended: S6's**, in a small follow-up.
4. **Q4 (the sheet's failed load).** Should the line "Couldn't open Shared Research" be announced (`role="alert"`), given the hub's rule that its status line is the only live region? The body already uses `role="alert"` inside the sheet.
   - Should it offer Reload, as the hub gate's notice does? That needs a string.
   - **Recommended: alert yes, Reload no.**
5. **Q5 (§3.3).** Should "Research concluded" and "Idea saved from research" carry the clipped question as their sub, like "Research opened"? Rows of different investigations now differ only by time. **Recommended: yes.**
6. **Q6 (§5).** The sheet is titled "Work an idea" also when opened on an existing investigation (Continue, an Activity row). Keep it? **Recommended: keep.** The body shows the investigation's question as its heading.
