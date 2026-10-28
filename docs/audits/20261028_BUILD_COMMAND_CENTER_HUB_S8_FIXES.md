# Build report — Command Center hub, the S8 fix build

Claude Code (Opus 5.5), October 28, 2026. The prompt: "FantasyTrades Command Center — S8 fix build: the cumulative review's fix list" (prepared October 26, 2026). It authorizes the S8 fix build only. The hub flag `COMMAND_CENTER_HUB_ENABLED` stays `false`; switching it on is a separate PR.

| | |
|---|---|
| **Branch** | `claude/command-center-hub-s8-fixes` (pushed by refspec; the app's local worktree branch is `claude/command-center-hub-s8-fixes-47cf3b`) |
| **Base** | `main` at `24495eba` (PR #998). `05b73287`, the head the S8 review read, is its ancestor, and `src/` is byte-identical between them, so every `file:line` of the review held at the base. `git fetch origin` ran first and again before the push; `main` did not move. |
| **Code head** | `3430e39a` (17 commits on the base; the first commits the review byte-identical). The PR head is that plus this report. |
| **Smoke** | `claude/command-center-hub-s8-fixes-smoke`, NEVER MERGE, no PR: the PR head plus one commit that sets the flag `true` (§10). |
| **Diff** | 43 files, +2,283 / −90 (20 source files, +356 / −62; the rest tests and three documents). No file under `api/`, no fenced file (BUILD_RULES §1), no `firestore.rules`, `vercel.json` or `package*` file. |

## 1. Verdict

**Every item the S8 review graded "before activation" is built under its ruling, each with a row that fails before the fix and passes after.** The flag stays `false`. With it off, a player sees exactly the four accepted changes and nothing else (§2); the build's own flag-off lens traced every source hunk to confirm it. The build's review found no BLOCKER and no MAJOR. It found eight MINOR findings, of which five are fixed and three are recorded, plus NITs. The mutating lens left six test gaps, and each is now closed by a row that kills its mutant. Two questions for the founder came out of it (§9).

| Review finding | Ruling | What changed | Red before (row, failure) | Green after |
|---|---|---|---|---|
| **S8-1** MAJOR: S0's picker put the retired `DashboardLoop` / `DashboardDesktop` back in the entry chunk | R-S8F-1 | Each site's legacy element is decided from `COMMAND_DASHBOARD_ENABLED` / `COMMAND_DASHBOARD_DESKTOP_ENABLED` again; the pick decides the hub only. The mount guard's App pins moved in the same commit. | `commandCenterHub.mount.guard.test.js`: 5 failed (the two new S8-1 rows, the mobile and desktop site rows, the whole-block row) | 62/62; the entry chunk −75,141 B raw, −18,712 B gzip, all fifteen modules gone (§3) |
| **S8-11** letter-blocker: the Loadout's lists keyed by uid alone | R-S8F-2 | `useHubLoadout`: the render-phase reset when `enabled` drops | `useHubLoadout.jsdom` 3 failed ("expected 'ready' to be 'loading'" / "'error'"); `useHubRuntime.jsdom` 1 failed ("expected 'Epoch one' not to be 'Epoch one'") | 32/32, 23/23 |
| **S8-12** letter-blocker: an identity change leaves the provider's deadline timer | R-S8F-3 | `identityChanged` clears and empties the `timers` Set | `DeployAttemptContext.jsdom` X7b, X7c: "expected 1 to be +0" | green; the review's own Q3 row passes too (§7.4) |
| **S8-13** letter-blocker: the brief hook's retry reads after an unmount | R-S8F-4 | `useDailyRegimeBrief`: `aliveRef`; after an unmount the 1.5 s retry reads nothing | `useDailyRegimeBrief.generatedAt.jsdom`: "expected 2 to be 1" | 9/9 (a control: the retry still runs while mounted) |
| **S8-14** letter-blocker, **S8-15**, **K-5** | R-S8F-5 | While the due-idea screen or the root ceremony is up, every `<body>` child but the overlay's own root is inert (the refcounted `inertSiblings`); the effect is keyed on the overlay on screen; on close the inert goes first, then focus returns to the captured invoker, else `[data-hub="shell"]` | new `DeployAttemptContext.overlayInert.jsdom`: 18 of 18 failed (the board's portal not inert; focus on `<body>`; the K-5 6 × 2 rows) | 22/22 (with the review round's 4); Edge: S8-14 closed (§7.2) |
| **S8-8** MAJOR (K-6): the shipped sheets have no dialog semantics | R-S8F-6 | `EquipSheet.jsx` (Q-S5-7 lifted for this file only): role dialog, `aria-modal`, `aria-labelledby` its title, focus on Close, Escape, Tab kept inside, focus back to the opener exactly once; the review round adds the keys pressed while focus has fallen out of the sheet (L1-1). `legacySheetStubs.jsx` stops claiming `role="dialog"`. | `CommandCenterHub.realSheets.jsdom` 4 failed ("expected [] to have a length of 1": no dialog); `ScoutingBoardSheet.s8.jsdom` 2 failed | 25/25 and 13/13 (with the review rounds' rows) |
| **S8-2** MAJOR, **K-1** | R-S8F-7 | One count, `liveCountsOf`, beside `liveGamesOf`, for the Games header and the status line: "N live" counts opened games; all waiting shows the waiting phrase; every opened game past its end reads the strip's "Live · ending" | 12 failed across `CommandCenterHub.s8.jsdom`, `hubModel.liveCounts`, `gamesDisplay`, `shadowStatus` | 76/76; two controls green both sides |
| **S8-3** MAJOR | R-S8F-8 | After a failed poll the Games live rows show `COPY.games.staleAsOf(time)` and the next action's live candidate carries it, from the Deploy card's own `freshness`; the review round adds the phone Overview's own live rows (L3-2) | 4 failed (`nextAction`, `CommandCenterHub.s8`) | 51/51; three controls |
| **S8-4** MINOR, **K-9** | R-S8F-9 | `formatHubDayYear` on Games and History rows, the tape link and the next-action title; "ends" names a short day when the end is not today (`COPY.games.endsWhen`, `formatHubOtherDay`) | 10 failed (`gamesDisplay`, `nextAction`, `hubDate.s4`, `CommandCenterHub.s8`) | 110/110 |
| **S8-9** MINOR | R-S8F-10 | Two rows in `ScoutingBoardSheet.close.test.jsx` (no code change) | each row fails under its half of `deployBusy` (the review's Q6M-11 and its mirror) | 9/9 |
| **K-7** (Q-S5-6) | R-S8F-11 | The gate's boundary falls back for a render error too (the same shell and notice, the fallback signal raised so "Report a bug" comes back) and logs it once under `Command Center hub (render)` | 6 failed (`CommandCenterHubGate.jsdom`, `.fallback.jsdom`) | 130/130 across the gate and guard suites |
| **S8-5** MINOR | R-S8F-12 | The Scouting Board's subtitle: "Ranked from today's read" only for today's ET date, else "Ranked from {day}'s read"; the review round adds the year for another year (L3-1) | `ScoutingBoardSheet.s8.jsdom` 4 failed | green; the "today" control both sides |
| **S8-10** (Q-S8-1), **Q-S8-2**, the two records | R-S8F-13 | Amendment C to spec V1.2 (`docs/specs/COMMAND_CENTER_CORE_IMPLEMENTATION_SPEC_V1_2_AMENDMENT_C_20261026.md`, README row): §6's trigger sentence amended (the active poll, as built); Later keyed by uid as §8.2 writes it; the lift of Q-S5-7 for `EquipSheet.jsx`; the status line's "Live · ending" | — (records) | — |

Every red run was the new rows against the source as it stood before that fix (the fixed files swapped out for their parent commit's, then restored), on Windows; every green run is on the fix commit. The full log, with commands and counts, is in §8.1.

## 2. What a player sees with the flag off — the four accepted live changes, and nothing else

The build's lens L1 walked every source hunk of `24495eba..3430e39a` and classified each as hub-only (reachable only through the lazy hub chunk or the live provider) or flag-off. The flag-off hunks are exactly these four; `DeployAttemptProvider` is a pass-through with the flag off (`src/contexts/DeployAttemptContext.jsx:865`), so the provider's new effects never run, and the gate's new code is behind `dashboardPick.shell === HUB`.

| # | Change | Before | After |
|---|---|---|---|
| 1 | **S8-1, the bundle** (`src/App.jsx:8959`, `:9018`) | The legacy element came from `pickDashboardShell(...).legacyShell`; Rollup could not fold it, so `DashboardLoop.jsx`, `DashboardDesktop.jsx` and thirteen modules only they reach (75.8 kB raw) shipped to every player and ran nothing | The same element from the same constants, the same props: nothing on screen changes. The fifteen modules leave the entry chunk (§3). |
| 2 | **S8-8, the shared sheet** (`src/components/Dashboard/EquipSheet.jsx`) | No role or label; focus stayed on the page when a sheet opened; Escape did nothing; Tab walked out of the sheet into the page | A dialog named by its title; focus on Close when it opens; Escape closes it; Tab and Shift+Tab stay inside; focus returns to the control that opened it. Every sheet on the primitive gains it: the agent record, the archetype picker, the traits sheet, the watchlist sheet (EquipStation, EquipBench), the Scouting Board, the rule-bundle picker and the League's loadout chooser (LeagueDeskParts, LeagueLobbyRedesign). Nothing is restyled. |
| 3 | **S8-13, the brief hook** (`src/hooks/useDailyRegimeBrief.js:35`, `:53`) | A reader that unmounted inside the 1.5 s retry wait still fired one Firestore read | No read after an unmount. The Read station (CommandDashboard, desktop ReadColumn) shows the same brief, the same retry, the same error. |
| 4 | **S8-5, the Scouting Board's wording** (`src/components/Dashboard/ScoutingBoardSheet.jsx:83`, `:148`) | "Ranked from today's read" whenever a ranking existed, weekends and early mornings included | "Ranked from today's read" for today's ranking; "Ranked from Friday's read" within the week; "Ranked from Oct 16's read" older ("Oct 16, 2025's read" from another year) |

The lens also checked, for change 2: no Escape handler elsewhere double-fires (the App tour listens on `window`; the sheet's Escape stops there), no consumer holds an input that loses autofocus, a reopen inside the exit animation keeps one dialog, the archetype picker's confirm step relabels the dialog, the traits sheet's keyed remount captures its opener. For change 3: StrictMode and `refetch` behave as before (a probe table in §7.1).

## 3. The entry chunk (R-S8F-1)

`vite build` on Linux (Node 20.20.2), the entry chunk attributed by its sourcemap (`@jridgewell/trace-mapping`, generated bytes per source):

| | main `24495eba` | S8-1 alone `03457c46` | code head `3430e39a` |
|---|---|---|---|
| Entry chunk | `index-BvBYFcJi.js` 4,902,069 B | `index-C8uCw-BC.js` 4,824,449 B | `index-Dmv0YZgn.js` 4,827,363 B |
| gzip | 1,320,893 B | 1,301,276 B | 1,302,354 B |
| Against main | — | **−77,620 raw / −19,617 gzip** | **−74,706 raw / −18,539 gzip** |

- **Gone from the entry chunk (all fifteen the review named):** `DashboardLoop.jsx` 14,070 B, `DashboardDesktop.jsx` 11,377, `PendingLobbiesSection.jsx` 8,781, `DashboardBattleCard.jsx` 7,049, `GamesModal.jsx` 5,534, `QuickPlayModal.jsx` 5,067, `useBaggerBombCardScore.js` 4,755, `useDashboardScores.js` 4,658, `FantasyTimesTeaser.jsx` 4,502, `BattleRow.jsx` 3,289, `ClashCard/index.jsx` 2,279, `AnimatedScore.jsx` 1,972, `reporterTheme.js` 1,620, `useFantasyTimes.js` 527, `TapGlint.jsx` 298 (75,778 B), with the parts of `battleHelpers.js` (−597), `timerFormatters.js` (−194) and lucide's `copy` icon (−355) only they used.
- **Added by the other live changes (at the code head):** `EquipSheet.jsx` +1,322 B, `ScoutingBoardSheet.jsx` +739, `DeployAttemptContext.jsx` +601 (the provider's hub-only code ships in the entry chunk with the provider, as before), `CommandCenterHubGate.jsx` +163, `useDailyRegimeBrief.js` +86.
- **Expected vs measured.** The prompt expected about −75.8 kB raw and −20.6 kB gzip. S8-1 alone measured −77.6 kB / −19.6 kB, which is the fifteen modules plus the shared code only they used. The review's +20.6 kB gzip was measured from the arc base to the S0 merge and included S0's own 3.5 kB of gate code. The code head is −74.7 kB raw / −18.5 kB gzip: the other accepted changes add 2.9 kB raw back.
- **No hub-chunk module entered the entry chunk** (K-14, R-S7-9): `activityDates`, `gamesDisplay`, `nextAction`, `hubModel` and `shadowStatus` are absent from it; the hub-folder and provider modules there are the provider's closure and the S0 gate, as at the review (13 modules, 43,039 B). `overlayStack.js` only exports its existing `tryFocus`.
- The hub chunk: `CommandCenterHub-CcuZnCVK.js` 151,424 B (gzip 46,619 B), against 150,092 B at `main`.

## 4. Files, by `file:line` (at the code head)

**Live with the flag off (§2):**
- `src/App.jsx:8959` (mobile: `COMMAND_DASHBOARD_ENABLED ? CommandDashboard : DashboardLoop`), `:9018` (desktop: `COMMAND_DASHBOARD_DESKTOP_ENABLED ? (…) : (<DashboardDesktop …/>)`).
- `src/components/Dashboard/EquipSheet.jsx:30` (title id), `:34` (the latest onClose), `:37–48` (focus on Close at open; the one restore, `:44`), `:51` (Escape and the Tab trap), `:84–96` (keys whose target is `<body>`, unless the sheet is inert — review L1-1), `:118–123` (role, `aria-modal`, `aria-labelledby`, `tabIndex`, `onKeyDown`), the title's `id` and Close's `ref`.
- `src/hooks/useDailyRegimeBrief.js:35`, `:53`, the `aliveRef` effect.
- `src/components/Dashboard/ScoutingBoardSheet.jsx:69–97` (`etDayNumber`, `readLabelOf`), `:148` (the subtitle).

**Hub-only:**
- `src/components/CommandCenter/hub/useHubLoadout.js:58` — the render-phase reset (S8-11).
- `src/contexts/DeployAttemptContext.jsx:110–115` (`OVERLAY_ROOT_CLASS`, `overlayRootOf`), `:345–346` (the identity change clears the timers, S8-12), `:917–939` (`overlayKey`; the inert effect keyed on it with the invoker captured once per sequence; the close effect: invoker, else the shell), the `tryFocus` import.
- `src/components/CommandCenter/hub/overlayStack.js:92` — `tryFocus` exported, unchanged.
- `src/components/CommandCenter/hub/hubModel.js:189` — `liveCountsOf`.
- `src/components/CommandCenter/hub/gamesDisplay.js:143` (`ends` with its day), `:152` (`ending`), `:184` (`formatHubDayYear`), `minutesLeft` / `timeLeft`.
- `src/components/CommandCenter/sections/GamesSection.jsx:136` (`GamesLiveNote`), `:163–166` (the header from `liveCountsOf`; the waiting phrase), the note over the live rows.
- `src/components/CommandCenter/PhoneTabs.jsx:111` — the note over the phone Overview's own live rows (review L3-2).
- `src/components/CommandCenter/CommandCenterHub.jsx:186` — `liveCounts` for the status line.
- `src/components/CommandCenter/hub/shadowStatus.js:90` — rule 5's "Live · ending".
- `src/components/CommandCenter/hub/useHubReaders.js:72` (`liveAge`), `:178` (`liveFreshness`), the clock into `completedGameRows` and `deriveNextAction`.
- `src/components/CommandCenter/hub/nextAction.js:66` (the age in the live candidate's detail), `:85` (the year in the review title).
- `src/components/CommandCenter/hub/activityDates.js:63` — `formatHubOtherDay`.
- `src/components/CommandCenter/hub/hubCopy.js:301` — `COPY.games.endsWhen`.
- `src/components/CommandCenter/CommandCenterHubGate.jsx:80` (`HUB_RENDER_REPORT`), `:102` (`reportHubRenderFailure`), `:147` (`componentDidCatch`), the boundary's render.
- Comments only: `pickDashboardShell.js`, `hubChrome.js`.

**Documents:** `docs/audits/20261026_FABLE_REVIEW_S8_CUMULATIVE.md` (byte-identical, SHA-256 `7ff4bdc3…6d93847`), Amendment C, this report, three `docs/README.md` rows.

**Fenced functions called, none edited:** none newly called.

## 5. Rows and pins edited (the stop rule's list)

The prompt allows registration lists, guard manifests and pins of hub-owned files that a ruling moves; everything else that pinned behaviour is listed here.
- **Moved by R-S8F-1:** `commandCenterHub.mount.guard.test.js` — the S0 rows that pinned "the two dashboard flags reach the sites only through the pick" now pin the constants' ternaries (each flag 3 times, one ternary each), the mobile and desktop site rows, and the whole-block row. A new row pins that App never reads `legacyShell`. The terminal note for `useDailyRegimeBrief.js` names R-S8F-4.
- **Moved by R-S8F-9:** `hub/hubDate.s4.test.js` (`activityDates.js`'s formatter count 5 → 6, the short weekday); `hub/s4Modules.purity.guard.test.js` (`nextAction.js` may import `./activityDates`).
- **Named by R-S8F-6:** `__fixtures__/legacySheetStubs.jsx` no longer claims `role="dialog"`; the one S5 row that counted stub dialogs (`CommandCenterHub.s5.jsdom.test.jsx`, "one sheet open at a time") counts `[data-stub]`.
- **Turned around with R-S8F-11 (pinned the old rethrow; edited, not deleted):** `CommandCenterHubGate.jsdom.test.jsx` "only a rejected import falls back" (now three rows: the render error falls back with its own report; Retry; the loader keeps its own report) and `CommandCenterHubGate.fallback.jsdom.test.jsx` "… the Dashboard boundary takes over …" (now the legacy shell, the notice, the signal raised, the button back; plus a first-try row). These rows pinned exactly the behaviour Q-S5-6 asked to change.
- **This build's own row, re-scoped by the L1-1 fix:** `ScoutingBoardSheet.s8.jsdom.test.jsx` "Escape … not the sheet's" now uses a control outside the sheet, and also pins that a key on `<body>` is the sheet's.

No other pre-existing row of behaviour was edited.

## 6. Checks

| Check | Where | Result |
|---|---|---|
| `vite build`, code head | Linux, `~/pd-ci-s8f` (a worktree of `~/pd-ci`, `node_modules` linked, lockfile `22fa2b71904c`) | Exit 0. Entry `index-Dmv0YZgn.js` 4,827,363 B (gzip 1,302,354 B); hub chunk 151,424 B |
| `npm run lint:gate` | Linux, code head | Exit 0, no output (`--max-warnings 0`) |
| Full suite, `TZ=UTC`, `--maxWorkers=8`, under `flock /tmp/pd-suite.lock` | Linux, code head | **Exit 0. `Test Files  1193 passed \| 8 skipped (1201)`; `Tests  26059 passed \| 89 skipped (26148)`; 274 s** |
| Flag-on dry run (the flag `true` in the Linux worktree only, the full suite, then restored) | Linux, code head | **Exactly the 14 by-design rows, in the same four files as S3, S4, S6 and the S8 review:** `App.activeBattlesPoll.owner.jsdom.test.jsx` 9, `App.bootOrder.jsdom.test.jsx` 2, `commandCenterHubFlags.test.js` 1, `flagPinGuard.test.js` 2. `Tests  14 failed \| 26045 passed \| 89 skipped (26148)`. The flag file was restored (`git status` clean) |
| Earlier full suite, at `f8a5c468` (before the review rounds) | Linux | exit 0, `Test Files  1193 passed \| 8 skipped (1201)`, `Tests  26045 passed \| 89 skipped (26134)`, 437 s |
| Targeted runs, Windows (each red and green in §1) | the worktree | as §8.1; the wide Windows runs fail only `League/LeagueSpectate.honesty` and `League/backing/backingDark` (platform-only, green on Linux) and, once, `CommandCenterHub.testIntegrity` on its 5 s timeout under load (30/30 alone) |
| The review's own lens rows (§7.4) | Windows snapshots of base and head | every finding row the review wrote passes at the head |

## 7. The review record (BUILD_RULES §2)

The diff passes the threshold (43 files, 2,283 lines), so the review was multi-lens and adversarial. Three lenses ran on Sonnet 5.5 in parallel, each on its own `git archive` snapshot of `f8a5c468`. Each lens's findings went to an independent Sonnet refuter on a fresh snapshot. The mutating lens ran last, on the head after the fix rounds. Every reviewer was read-only on git and on the worktree.

### 7.1 Lens L1 — flag-off parity

Verdict: the four changes and nothing else. Every non-test hunk was classified (§2); there was no `api/`, fenced, rules, `vercel.json` or `package` change. A probe table for the brief hook: plain and mounted, 2 reads; plain and unmounted before the retry, 1; StrictMode mounted, 4; StrictMode unmounted, 2. StrictMode's extra reads are `loadedRef`'s, unchanged.

| Id | Finding | Refuter | Disposition |
|---|---|---|---|
| L1-1 MINOR | Once the focused control unmounts (the archetype picker's card → confirm step), focus falls to `<body>`; Escape stops closing the sheet and Tab walks into the page | CONFIRMED (real picker, jsdom) | **Fixed** `8049b170`: the sheet takes keys whose target is `<body>` while open, unless it is inert. Rows red 2 → green; Edge confirmed on the new head (§7.3). |
| L1-2 MINOR | Close and the rows use `all: 'unset'`, so keyboard focus on them has no visible ring with the flag off | PARTLY: real, not new (it was invisible when tabbing in before) | **Not built**: a visual change beyond the ruling → founder question Q-S8F-2 |
| L1-3 NIT | `focus()` on Close without `preventScroll` | REFUTED: the overlay is `position: fixed`, nothing to scroll | No change |
| L1-4 NIT | No try/catch around `Intl`; a future `asOf` (client clock behind) reads as a date | PARTLY: the future half is real and cosmetic; `Intl` with America/New_York does not throw on supported browsers | No change: the ruling's letter ("today's" only for today's ET date) |

### 7.2 Lens L2 — focus and inert, in jsdom and headless Edge

The S8 review's own Q4 harness (it survived in that session's scratchpad) was copied and re-pointed at a snapshot with the flag true: the real hub, provider, ceremony, due screen, overlay stack and sheets; Edge through `playwright-core`; StrictMode on; 390, 1280 and 1440 px. Verdict: **PASS.** The inert set was right in every state, focus never reached anything outside the top overlay, nothing stayed inert after the last overlay closed, and the hold was reachable again. The measured states:

| State | Inert `<body>` children | Focus on open / after close | Restores |
|---|---|---|---|
| A sheet alone (Escape, Close, backdrop), ×4 sheets | `#root` | Close / the opener | 1 |
| Board → due screen | `#root` + the board's portal | the due screen / — | — |
| Board → "Deploy without it" → ceremony | `#root` + the board (or `#root` alone once a created answer closed the board) | the ceremony | — |
| Ceremony → Back to hub, board closed by a created answer | none | the hub shell (L2-1) | 1 landed |
| Ceremony → Back to hub, board open after a refusal | `#root` (the board stays) | the board's "Deploy this agent" | 1 landed |
| Ceremony over nothing | `#root`, then none | the hold | 1 landed |
| A JS `.click()` on the board's Close under the ceremony | the board closes; `#root` stays inert | the ceremony keeps focus | no deploy |
| Accessibility tree, board under the ceremony | — | only "Deploying your agent" is a dialog; the board's Close, the hold and the menu are absent | — |
| Site flip with each overlay; board reopened inside its exit ×3; redeploy ×3 | no stale node, nothing stuck | Close / the shell | — |

| Id | Finding | Refuter (Edge, newer head `8049b170`) | Disposition |
|---|---|---|---|
| L2-1 MINOR | A board deploy that answers "created" closes the board under the ceremony; Back to hub then focuses the hub shell, not "See what it's eyeing" (the captured invoker, the board's footer button, is gone) | CONFIRMED at 390, 1280, 1440; the ruling's letter; the opener stays reachable by Tab | **Not built** → founder question Q-S8F-1 |
| L2-2 MINOR | `useModalFocus` (due screen, ceremony): with focus on the dialog container, the first Shift+Tab leaves the page and the second re-enters; nothing in the background is reached | CONFIRMED; pre-existing (the file is untouched; the flag-off ceremonies use the same hook); harmless under inert | **Not built**: a change to a hook the legacy ceremonies use, beyond the ruling → Q-S8F-3 |
| L2-3 NIT | On the swap and on close, the overlay's own restore calls `focus()` on an inert invoker (it does not land) before the provider's lands | consistent where measured | Recorded: one restore lands |
| L2-4 NIT | At 390 a refused ceremony ends on the shell (the strip's hold was replaced by "Deployment refused") | CONFIRMED: the designed fallback | Recorded |
| L2-5 NIT | Escape does nothing on the due screen or the ceremony | CONFIRMED: pre-existing; every due-screen action deploys (ruling E1) | Recorded; backlog |

The refuter also measured the L1-1 fix in Edge: (a) Escape on `<body>` does not close the board under the due screen or the ceremony (its portal is inert); (b) after a picked card drops focus, Escape closes the archetype picker and focus returns to "Change archetype", and Tab on `<body>` re-enters at Close; (c) the inert sets are unchanged.

### 7.3 Lens L3 — one rule per fact

Verdict: the three rulings hold on every surface it could drive (waiting, opened and waiting, ending, the retained list's age, refreshing, years, Dec 31 / Jan 1 in ET, an end on another ET day, the DST change on Nov 1, 2026, phone and desktop, History, the copy guards, the entry chunk).

| Id | Finding | Refuter | Disposition |
|---|---|---|---|
| L3-1 MINOR | The board's older read has no year from another year | CONFIRMED | **Fixed** `eef79327` ("Oct 16, 2025's read"); row red → green |
| L3-2 MINOR | The phone Overview's own live rows carry no age after a failed poll | CONFIRMED (the Overview lists every live game but the next action's) | **Fixed** `eef79327`: `GamesLiveNote` over every list of live rows; row red → green |
| L3-3 NIT | With the window and the poll both failed, two "As of … couldn't refresh" notes stack | CONFIRMED | Recorded: each time is true for its list; the window's carries Retry, the poll's Retry is the card's |
| L3-4 NIT | The all-waiting header tag was the bare "waiting for the open" | CONFIRMED | **Fixed** `eef79327`: "Deployed · waiting for the open", the phrase every other surface says; row red → green |

### 7.4 The S8 review's own lens rows, run against this head

The review's lens snapshots also survived. Its eleven row files (92 rows) were copied unchanged into a snapshot of `f8a5c468` and of the base:
- **Each finding's repro row fails at the base and passes at the head:** S8-2 ×2, S8-3 ×2, S8-4 ×2, S8-11 ×2, S8-13, and S8-12 (its row looks timers up by source line; with only its anchors moved to the new lines, `:170` → `:182` and `:179` → `:191`, it passes).
- **The refuter rows that asserted a defect exists now fail, as they should:** S8-11 (a) and (b), S8-12's two "survivor" rows and S8-13's flag-off probe.
- **A row that pinned the declared Q-S7-3 words** ("Live game in progress" for a retained list) now reads "Live · ending", because its game is past its end: R-S8F-7, as ruled.
- **The cooldown-clock row** passes once its line anchor moves (`:885` → `:901`), so it is not a regression.
- **The Saturday Scouting Board row still fails**, because it bans "today" anywhere in the sheet, and the eyebrow "In Degen's wheelhouse today" (`ScoutingBoardSheet.jsx`, the ranked list's eyebrow) and the off-universe line "outside today's ranked universe" still say it. The review cited those lines (`:181`, `:199` at `05b73287`). The ruling names the subtitle only, so this is founder question Q-S8F-4.
- **The rest fail at the base and at the head alike.** Those rows document NITs and refuted items (S8-N1, N6, N7, N8, N14, Q5-3(d)).

### 7.5 Lens L4 — test integrity, mutating (last)

60 mutants (the cap) on the rows this build adds, each run against 17 targeted files (521 rows) with `--bail=1`, each source restored and sha256-checked (18 files, all byte-identical). **51 killed, 9 survived.**

| Survivor | Kind | Disposition |
|---|---|---|
| M04 (the reset keeps `committed`) | equivalent: `ownerKey: null` alone hides it | — |
| M15 (restore before the release) | mis-modelled; the ordering defect is caught by the final focus and inert assertions | — |
| M09 (`overlayRootOf` takes the first match) | low gap: only one overlay root ever exists | recorded |
| M40 (weekday compared instead of day and year) | low gap: needs an end a week or more away on the same weekday | recorded |
| M10 (the inert effect keyed on a boolean) | the ruling's re-key was unpinned | **row added; re-planted: KILLED** |
| M16 (`<body>` taken as an invoker) | gap | **row added; KILLED** |
| M17 (`tryFocus` reports a landing that did not land) | gap | **row added; KILLED** (first by an existing overlay-stack row the lens had not run) |
| M25 (Escape without `stopPropagation`) | gap | **row added; KILLED** |
| M30 (the stray-key listener ignores inert) | gap | **row added; KILLED** |
| M31 (the stray-key listener never removed) | gap | **row added; KILLED** |
| M32 (the portal-child guard dropped) | gap | **row added; KILLED** |

Critical reading: L4-2, a title that promised more than its body asserted (fixed: the title now says what the body pins). L4-1 and L4-3 need no change (the four-sheet row does catch a double restore; the M31 row now pins the listener's lifetime). L4-4: the two `deployBusy` mutants were already run at R-S8F-10, and both are killed. L4-5: no vacuous `.not` assertion was found.

## 8. Mutation, and the red/green log

### 8.1 Red before, green after (Windows targeted runs)

- **R-S8F-1:** the mount guard at the unfixed App: 5 failed | 57 passed; fixed, with `pickDashboardShell`, `starfield.inert`, `activeNavigation.shelvedSurfaces`, `hubChrome`, `App.xpModal`: 137 passed.
- **R-S8F-2:** loadout 3 failed | 29 passed; runtime 1 failed | 22 passed; fixed: 5 files, 179 passed.
- **R-S8F-3:** `-t X7` 2 failed | 1 passed; fixed: `src/contexts` and the S2b hub suites, 187 passed.
- **R-S8F-4:** 1 failed | 8 passed; fixed: 4 files, 165 passed.
- **R-S8F-5:** 18 of 18 failed; fixed 18/18; `src/contexts`, `src/components/CommandCenter` and `deployCeremony`: 2,814 passed.
- **R-S8F-6:** real sheets 4 failed; board 2 failed | 1 passed; fixed 19/19 and 3/3.
- **R-S8F-7:** 12 failed | 64 passed; fixed 76/76; the hub folder 2,433 passed.
- **R-S8F-8:** 4 failed | 47 passed; fixed 51/51.
- **R-S8F-9:** 10 failed | 100 passed; fixed 110/110; the hub folder 2,450 passed.
- **R-S8F-10:** each row fails under its half of `deployBusy`; 9/9.
- **R-S8F-11:** 6 failed | 42 passed at the old gate; fixed 130/130.
- **R-S8F-12:** 4 failed | 4 passed; fixed 17/17.
- **Review round L3:** 3 failed | 22 passed at `f8a5c468`; fixed 25/25.
- **Review round L1-1:** 2 failed | 1 passed at `f8a5c468`; fixed; the four folders 5,802 passed (only the two platform-only League rows red).
- **Review round L4:** each of the seven re-planted mutants killed (§7.5); `src/contexts`, `src/components/Dashboard` and `src/components/CommandCenter` at the code head: 125 files, 4,462 passed.

### 8.2 Mutants

60 distinct mutants (the prompt's cap), all on this build's rows: 51 killed, 7 more killed after their rows were added (the same edits re-planted), 2 equivalent or mis-modelled, 2 low gaps recorded. The two `deployBusy` mutants of R-S8F-10 were the red-before evidence for those rows and both are killed.

## 9. Founder questions

- **Q-S8F-1 (L2-1).** A Scouting Board deploy that answers "created" closes the board while the ceremony is up. "Back to hub" then puts focus on the hub (the ruling's fallback), not on "See what it's eyeing", the button that opened the board. Should the fallback first try the opener the hub's stack still owes, before the shell? This is a small provider change. Default: as built, matching the ruling's letter.
- **Q-S8F-2 (L1-2).** The shared sheet's Close and row buttons have no visible keyboard focus ring (`all: 'unset'`), and now focus moves to Close on open. Should they get a focus-visible outline? That is a visual change to the legacy shells too. Default: not built.
- **Q-S8F-3 (L2-2).** `useModalFocus` (the due screen and the ceremony, legacy and hub): the first Shift+Tab from the dialog itself leaves the page, and the second comes back to its last control. Nothing behind it is reachable. Should the hook treat focus on the dialog as its first item, which is the review's option (a) for S8-14? This would change the legacy ceremonies too. Default: not built; option (b), as ruled, already contains it.
- **Q-S8F-4 (the review's own S8-5 row).** On a weekend the board still says "In Degen's wheelhouse today" above the ranked rows, and "outside today's ranked universe" in the watchlist group. Should those follow the subtitle's day rule? Default: not built (the ruling names the subtitle).

## 10. Delivery, and the founder's checklist

- **Draft PR** from `claude/command-center-hub-s8-fixes` into `main`, citing these changes by `file:line`. No fenced file and nothing under `api/` changed.
- **Smoke branch:** `claude/command-center-hub-s8-fixes-smoke` = the PR head (the commit carrying this report) plus one commit that sets `COMMAND_CENTER_HUB_ENABLED = true` (`src/config/featureFlags.js`, one line; built by git plumbing; `git diff --stat` one file, one line). **NEVER MERGE**, no PR.
- Pushed, reported, STOP: no merge, no CI watched.

**On the PR's own preview (flag off):**
- [ ] The phone and the desktop dashboards look and behave as they do today.
- [ ] The archetype picker: it opens with focus on Close; Escape closes it; pick an archetype (the confirm step) and press Escape: it closes.
- [ ] The Scouting Board ("See what it's eyeing"): it opens with focus on Close; Escape closes it; on a weekend, or on a weekday before the morning ranking run (11:00 UTC: 7 AM ET until Nov 1, then 6 AM), its subtitle names the day of the read ("Ranked from Friday's read"); after the run, "Ranked from today's read".

**On the smoke preview (flag on):**
- [ ] The same two sheets from the hub: focus on Close, Escape closes, and focus goes back to the button you opened them from.
- [ ] The Games header during a live game says "1 live"; after the market closes, a newly deployed game says "Deployed · waiting for the open", with no "1 live".
- [ ] A date from another year, if your history has one: "Dec 3, 2025" on the Games row and on the next action.

## 11. Backlog — not built (the prompt's §6, by id)

S8-6 (the copy guards' ratchet) · S8-7 (the Agent record sheet's wording stays) · K-3 (Reduce Motion read once) · K-4 (a "Skip to Deploy" link for the stacked band) · K-6b (App's phone drawer semantics) · K-11 · K-13 (S4's suite noise) · S8-N1, S8-N2, S8-N3, S8-N4, S8-N5, S8-N6, S8-N7, S8-N8, S8-N9, S8-N10, S8-N11, S8-N12, S8-N13, S8-N14, S8-N15, S8-N16, S8-N17, S8-N18, S8-N19. Also recorded from this build's review, not built: L1-3, L1-4, L2-3, L2-4, L2-5, L3-3, M09, M40.

## 12. What I could not check

- Real screen readers (DOM semantics, focus, inert and the Chromium accessibility tree only); WebKit / iOS touch; the ceremony's reveal phase in Edge (the harness stubs Firestore progress; the jsdom rows drive the refused terminal).
- The traits sheet in Edge (`TRAIT_SLOT_ENABLED` is off; it was driven in jsdom).
- The legacy shells' sheets in Edge: their single restore is covered in jsdom (the Scouting Board with no host); the founder's checklist covers them on the preview.
- The deployed build: pushed is not deployed (BUILD_RULES §2).

## 13. The founder's rulings on Q-S8F-1 … Q-S8F-4 (October 28, 2026)

The same branch and PR (#1000). The stop rule was unchanged. Four commits on top of `d63dea92`, then the mutation round; the code head is now `dfcfb072`.

| Question | Ruling | What changed | Red before | Green after |
|---|---|---|---|---|
| **Q-S8F-1** (L2-1) | Yes | After the ceremony, focus goes to the opener the hub's stack still owes ("See what it's eyeing"), while it is in the document and enabled, before the shell. When a sheet's close cannot give focus back because the page is inert under the provider's overlay, the stack records its opener (`hub/overlayStack.js:103–110`, `:172`). The provider's close tries that opener first, then the captured invoker, then `[data-hub="shell"]` (`src/contexts/DeployAttemptContext.jsx:943–945`). A sequence starts owing nothing (`:926`). | `DeployAttemptContext.overlayInert.jsdom` "created from the board, then Back to hub": focus on the shell (at `d63dea92`); "… while the closed board is still leaving": focus on the leaving footer (the invoker-first order of `390f98e7`, mutant N06) | green; two controls green both sides (the opener disabled → the shell; an opener owed from before the sequence → not used) |
| **Q-S8F-2** (L1-2) | Yes; an accepted live change for the legacy shells | `EquipSheet.jsx:31` (`CONTROL_FOCUS_CSS`), `:147` (the scoped `<style>`), `:163`, `:183` (the marker on Close and the rows). The rule is `[data-equip-sheet-control]:focus-visible { outline: 2px solid var(--ft-teal) !important; outline-offset: 2px !important; }`, using the hub's own focus colour (`hub/hubStyle.js` `HUB_FOCUS_CSS`) as a token through `cssVar`. It is `!important` because the buttons' inline `all: 'unset'` takes their outline with it. Only Close and the rows carry the marker; the footer and child controls keep their own styles. | `ScoutingBoardSheet.s8.jsdom` "Close and every row carry the marker …": no rule (`expected '' to be …`) | green |
| **Q-S8F-3** (L2-2) | Keep as built | Nothing; backlog | — | — |
| **Q-S8F-4** | Yes; an accepted live change | `ScoutingBoardSheet.jsx:85–100` (`readDayOf`: today, the day, or none), `:153–164` (one `readDay` feeds the subtitle, the ranked heading and the off-universe line), `:221`, `:239`. Today: "In Degen's wheelhouse today" / "outside today's ranked universe", as before. Otherwise: "In Degen's wheelhouse on Friday's read" / "outside Friday's ranked universe" (a date a week or more old, and its year from another year). A ranking with no readable time names no day: "In Degen's wheelhouse" / "outside the ranked universe". The empty board's "today's ranked board isn't in yet" lines are unchanged (no ranking is on show). | `ScoutingBoardSheet.s8.jsdom`: Saturday with Friday's ranking (no "today" anywhere: the S8 review's own row's test), a week-old ranking, no time: 3 failed at `a045dec5` | green; the today control green both sides |

### 13.1 What a player sees with the flag off, now

The four accepted changes of §2, plus the two these rulings accept:

| # | Change | Before | After |
|---|---|---|---|
| 5 | **Q-S8F-2, the sheet's focus outline** (every sheet on `EquipSheet`) | Keyboard focus on Close and the rows was invisible (`all: unset`) | A 2 px teal outline on keyboard focus only (Tab); none for a click or a touch |
| 6 | **Q-S8F-4, the board's heading and off-universe line** | "In Degen's wheelhouse today" and "outside today's ranked universe" whatever the ranking's day | The same words for today's ranking; the read's day otherwise ("on Friday's read", "outside Friday's ranked universe") |

Q-S8F-1 is hub-only: the provider is a pass-through with the flag off. The legacy shells have no overlay stack, so nothing is ever owed there.

### 13.2 Headless Edge, Q-S8F-2

The real `EquipSheet` from an LF snapshot of `a045dec5`, with `tokens.css`, rendered by a throwaway Vite page as a legacy shell opens it (an opener and two rows), in headless Edge through `playwright-core`, at 390 × 844 (bottom dock) and 1280 × 800 (centred dialog):

| Interaction | 390 | 1280 |
|---|---|---|
| Tab to the opener, Enter: focus on Close | outline `solid 2px rgb(94, 234, 212)` (`--ft-teal` = `#5eead4`), `:focus-visible` true | the same |
| Tab to the first row | `solid 2px rgb(94, 234, 212)` | the same |
| A click on the opener: focus on Close (by script) | outline `none`, `:focus-visible` false | the same |
| A click on a row | `none`, `:focus-visible` false | the same |
| **Before** (`390f98e7`'s sheet): Tab, Enter, Close; Tab, a row | `none` on both, though `:focus-visible` matched | the same |

### 13.3 Mutation (cap 20, on this round's rows only)

17 distinct edits: 16 planted against the new rows, plus N06 re-planted in its inverse form after the order changed.
- **Q-S8F-1:** N01 (owed never recorded) killed; N05 (the owed opener never tried) killed; N02 (owed recorded without the inert test) survived, equivalent, because owed focus is taken only inside a provider sequence, when the page is always inert.
- **N03 and N04 survived the first run.** N03 is `takeOwedFocus` not clearing; N04 is no discard at the start of a sequence. The "owed from before the sequence" row was vacuous: the stack's own release removed the inert the row had set by hand, so nothing was ever owed. The row now marks the shell inert, outside the stack's own marks, and both mutants are killed.
- **N06 (the owed opener tried before the invoker) survived the first run, and led to reading the ruling's order again.** Q-S8F-1 says to restore to the owed opener and then fall back to the shell. An owed opener exists only when a sheet closed under the ceremony, so the invoker is that sheet's own footer, gone or still leaving. The close now tries the owed opener first. The old order, re-planted, is killed by the new "still leaving" row.
- **Q-S8F-2:** N07 (no rule), N08 (no `!important`), N09 (`:focus` instead of `:focus-visible`), N10 (Close unmarked) and N11 (rows unmarked): all killed.
- **Q-S8F-4:** N12 (heading always "today"), N13 (off-universe always "today"), N14 and N16 (no day reads "today"), N15 (the heading drops "'s read"): all killed.
- Every mutated file was restored byte-identical (sha256 compared per mutant).
- **Totals:** 15 of 16 planted mutants killed, 1 equivalent.

### 13.4 Checks (Linux, code head `dfcfb072`)

| Check | Result |
|---|---|
| `vite build` | Exit 0; hub chunk `CommandCenterHub-CSG8yQ1h.js` 151,424 B (unchanged) |
| Entry chunk | `index-CoSovhZM.js` 4,827,957 B (gzip 1,302,468 B): **−74,112 raw / −18,425 gzip against `main`**; +594 raw / +114 gzip against `3430e39a` (`EquipSheet.jsx` +218, `ScoutingBoardSheet.jsx` +226, `overlayStack.js` +126, `DeployAttemptContext.jsx` +15). `DashboardLoop.jsx` and `DashboardDesktop.jsx` still absent; `main` and `3430e39a` rebuilt in the same worktree reproduce their earlier hashes |
| `npm run lint:gate` | Exit 0, no output |
| Full suite, `TZ=UTC`, `--maxWorkers=8`, under `flock /tmp/pd-suite.lock` | **Exit 0. `Test Files  1193 passed \| 8 skipped (1201)`; `Tests  26068 passed \| 89 skipped (26157)`; 322 s** |
| Flag-on dry run | **Exactly the 14 by-design rows**: `App.activeBattlesPoll.owner` 9, `App.bootOrder` 2, `commandCenterHubFlags` 1, `flagPinGuard` 2 (`Tests  14 failed \| 26054 passed \| 89 skipped (26157)`); the flag restored |

### 13.5 Founder questions and backlog

- No new questions.
- Q-S8F-3 is moved to the backlog (§11).
- **The smoke branch is rebuilt** as the new PR head plus the flag-true commit (pushed with `--force-with-lease`).
- **The checklist (§10) gains, on the PR's preview:**
  - [ ] Tab into the archetype picker: Close and its rows show a teal outline; a mouse click shows none.
  - [ ] On a weekend, the Scouting Board's heading says "on Friday's read", not "today".
- **On the smoke preview:**
  - [ ] Deploy from the Scouting Board until the ceremony shows, then "Back to hub": focus is on "See what it's eyeing".

## 14. The merge with `main` at `62380f14` (#999, BaggerBomb cleanup; October 28, 2026)

`main` moved while #1000 waited. PR #999 changed `hub/gamesDisplay.js`, `hub/hubCopy.js` and `hub/hubDate.js`, and #1000 conflicted with it in `hub/gamesDisplay.js`. This is the same branch and PR, with the stop rule unchanged.

The sequence:
- `git fetch origin`, then `origin/main` merged into the branch as `1034b2b0` (parents `285ac5d0` and `62380f14`).
- One commit of rows after it: `31ba188d`, the code head.

`hubCopy.js`, `activityDates.js` and `hubDate.js` are now byte-identical to `main`'s. Against the new `main`, measured at the code head `31ba188d`, the PR is 42 files, +2,857 / −93 (18 source files, +388 / −67). Nothing is under `api/`, no file is fenced, and no `firestore.rules`, `vercel.json` or `package*` file changes.

### 14.1 The conflict and its resolution

Both sides changed `liveGameRows` (`hub/gamesDisplay.js:133`):

| | S8 (`285ac5d0`) | `main` (`62380f14`) | Merged |
|---|---|---|---|
| Waiting or live | `derivePhase(battle, marketState)` | `derivePhase(battle, marketState, nowMs)` (#999 C5: a game before its first trading day is waiting, even with the market open) | `main`'s (`:137`) |
| A waiting game's clock | "waiting for the open" | "Starts Wed 9:30 AM ET" (`deriveStartsAtEt`, `:138`), else "waiting for the open" | `main`'s (`:156`) |
| "ends" on another day | `COPY.games.endsWhen(…, formatHubOtherDay(…))` (`activityDates.js`) | `COPY.time.et(formatHubTimeOnDay(…))` (`hubDate.js:73`) | `main`'s (`:146`), the one helper |
| An opened game past its end | `ending` and `minutesLeft` (R-S8F-7) | — | S8's (`:119`, `:155`) |
| A completed game from another year | `formatHubDayYear` (R-S8F-9) | `formatHubDay` | S8's (`:187`) |

**The two "ends" helpers gave the same text, so S8's is gone.** Before removing it, I ran both side by side in the merged tree over 283,178 pairs, with no difference:
- ends from three days before the clock to four days after, every 23 minutes;
- clocks every 37 minutes across March's and November's DST changes, the year's turn and a weekend;
- the ET-midnight edges and a year apart;
- seven unusable clocks.

So, by the ruling:
- `formatHubOtherDay` (and its weekday formatter) and `COPY.games.endsWhen` are removed.
- S8's rows for them are re-pointed at `formatHubTimeOnDay` (`hubDate.s4.test.js:72`). They use the same instants, now expecting the whole time: "Wed 4:00 PM", "11:59 PM", "Wed 12:00 AM", "Mon 11:00 AM" for a year back, and the bare time with no clock. The `activityDates.js` formatter count is back to `main`'s 5.
- S8's Games rows check the finished text and pass unchanged: `gamesDisplay.test.js` "dates on the Games rows (S8-4)" and the `CommandCenterHub.s8.jsdom` R-S8F-9 rows.

S8's helper lived in the hub's lazy chunk. `main`'s lives in `hubDate.js`, which ships in the entry chunk (#999's own placement).

### 14.2 One `derivePhase` call for every surface (BUILD_RULES §9)

Every hub surface that says live or waiting reads the rows of the one call at `hub/useHubReaders.js:152`: `liveGameRows(live, { nowMs: Date.now(), marketState: getMarketState() })`. It is the only `derivePhase` in `src/components/CommandCenter`. `gamesSectionOf` copies those rows into `games.live` (`:69`), and the next action takes the same array (`:171`).

| Surface | What it reads | Where it decides |
|---|---|---|
| The Games rows (desktop and tablet) | `row.preOpen`, `row.clock` | `sections/GamesSection.jsx:52` |
| The Games header | `liveCountsOf(games)` (`hub/hubModel.js:189`) | `GamesSection.jsx:162`, `:166` |
| The status line | the same counts (`CommandCenterHub.jsx:186`, `:208–210`) | `hub/shadowStatus.js:91–92` |
| The strip | the first live row (`CommandCenterHub.jsx:189–190`) | `hub/deployDisplay.js:170` |
| The next-action card | `liveRows` | `hub/nextAction.js:71` |
| The phone Overview | `liveGamesOf(games)` (`PhoneTabs.jsx:93`, `:99`) | the same `GameRow` (`GamesSection.jsx:52`) |

No row covered a game deployed between 3:15 and 4:00 PM ET on the connected hub:
- S8's waiting rows use the old rule (no evaluation, market closed).
- `main`'s C5 rows check `liveGameRows` and `deployDisplay` on their own.

I added three rows (`CommandCenterHub.s8.jsdom.test.jsx:240`). They are set on Tuesday at 3:30 PM ET with the market open, for a game whose first trading day is Wednesday:

| Row | Red before (`285ac5d0`, the pre-merge head) | Green after |
|---|---|---|
| Desktop: the Games header and the status line say "Deployed · waiting for the open"; the row says "Deployed · Starts Wed 9:30 AM ET" and "ends Wed 4:00 PM ET"; the next action is "Your game is deployed"; nothing says live | `expected 'Games1 liveHistory' not to match /\d+ live/` | green |
| Phone: the strip, the status line, the next action and the Overview's own live row say the same | `expected 'Live · 24h 30m leftDeploy unavailable…' to contain 'Deployed · Starts Wed 9:30 AM ET'` | green |
| Control: at the same instant, a game whose first trading day is today reads live on every surface | green | green |

Every surface says waiting, as the ruling asked. The words differ, though: the header and the status line say "waiting for the open", while the row and the strip say when the game starts. That is Q-S8F-5 (§14.5). The desktop row above pins the header's words as built, and it moves with the answer.

### 14.3 Mutation (cap 10, on the new rows only)

All 10 mutants were killed against the new describe. Each file was restored byte-identical (sha256 compared), and the tree was committed before the round.

| # | Mutant | Killed by |
|---|---|---|
| M01 | `derivePhase` without the row's clock (S8's side of the conflict, `gamesDisplay.js:137`) | desktop, phone |
| M02 | the reader hands the rows no clock (`useHubReaders.js:152`) | desktop, phone |
| M03 | `liveCountsOf` counts a waiting game as opened | desktop, phone |
| M04 | the status line counts waiting games as live (`CommandCenterHub.jsx:208`) | desktop, phone |
| M05 | the next action's title ignores `preOpen` | desktop, phone |
| M06 | the strip ignores `preOpen` | phone |
| M07 | the row tag ignores `preOpen` | desktop, phone |
| M08 | the header drops its waiting tag | desktop |
| M09 | the waiting clock never says when it starts | desktop, phone |
| M10 | every game not completed reads waiting | the control |

### 14.4 Checks (Linux, code head `31ba188d`)

| Check | Result |
|---|---|
| `vite build` | Exit 0 on the code head and on the new `main`. The hub chunk is `CommandCenterHub-CFpUpqdh.js` at 151,164 B: `main`'s is 150,172 B, and at `dfcfb072` it was 151,424 B (S8's helper and its copy left; #999's C5 code came in) |
| Entry chunk | `index-ConuQaGW.js`, 4,830,272 B (gzip 1,303,113 B), against the new `main`'s `index-CLx1U8Yq.js`, 4,904,384 B (gzip 1,321,424 B): **−74,112 raw / −18,311 gzip** (detail below the table) |
| `npm run lint:gate` | Exit 0, no output |
| Full suite, `TZ=UTC`, `--maxWorkers=8`, under `flock /tmp/pd-suite.lock` | **Exit 0. `Test Files  1202 passed \| 8 skipped (1210)`; `Tests  26193 passed \| 89 skipped (26282)`; 277 s** |
| Flag-on dry run | **Exactly the 14 by-design rows**: `App.activeBattlesPoll.owner` 9, `App.bootOrder` 2, `commandCenterHubFlags` 1, `flagPinGuard` 2 (`Tests  14 failed \| 26179 passed \| 89 skipped (26282)`); the flag was restored and the tree is clean |

**The entry chunk's raw delta is the same as against the old `main`, and the sourcemap attribution says why:**
- The merge changed nothing the entry chunk carries from this PR. `hubCopy.js`, `activityDates.js` and `gamesDisplay.js` are not in it, and `hubDate.js` is 1,340 B on both sides.
- #999's own entry-chunk additions, +2,315 B, are on both sides.
- `DashboardLoop.jsx` and `DashboardDesktop.jsx` are still absent (`main` carries them at 14,070 B and 11,377 B).
- The PR's other entry bytes are as in §13.4: `EquipSheet.jsx` +1,540, `ScoutingBoardSheet.jsx` +965, `DeployAttemptContext.jsx` +616, `CommandCenterHubGate.jsx` +163, `overlayStack.js` +124 and `useDailyRegimeBrief.js` +86.
- 42 sources differ by 1–3 B (the minifier's names), net +90.

On Windows, the hub folder and the adapter (89 files) ran green but for one load timeout. `CommandCenterHub.testIntegrity.jsdom` hit its 5 s limit with six workers and passes alone; Linux is the record.

### 14.5 What a player sees with the flag off, the smoke, and questions

- **Nothing new from the merge.** The PR's flag-off changes are still §2's four and §13.1's two. `formatHubTimeOnDay` and the C5 rows are drawn only by the hub. #999's live changes (the Desk, the Battle View, the crons) are `main`'s, already merged.
- **The smoke branch is rebuilt** as the new PR head plus the flag-true commit, pushed with `--force-with-lease`.
- **One new founder question, Q-S8F-5** (below).
- **The checklist (§10) gains, on the smoke preview:**
  - [ ] Deploy between 3:15 and 4:00 PM ET. The hub says the game is waiting everywhere:
    - the row and the strip: "Deployed · Starts {next session} 9:30 AM ET";
    - the Games header and the status line: "Deployed · waiting for the open";
    - the next action: "Your game is deployed".

**Q-S8F-5: the waiting wording after the merge (BUILD_RULES §9).**

- **What a player sees.** Since #999, a game before its first trading day says when it starts on its row and the strip: "Deployed · Starts Wed 9:30 AM ET". The Games header's tag and the status line keep the aggregate "Deployed · waiting for the open" (`sections/GamesSection.jsx:166`, `hub/shadowStatus.js:92`).
- **The rule this bends.** Both say waiting, so the ruling's check holds. But one fact now has two phrasings, which S8's own L3-4 fix was meant to rule out. Its row (`CommandCenterHub.s8.jsdom` "L3-4 the all-waiting header …") still passes only because its fixture is the old shape, with no `timing.tradingDays`.
- **How often.** BR-2 gives every game created from 45 minutes before a close, or overnight, a next-session `timing.tradingDays[0]` (`src/utils/tieredFirstTradingDay.js:6–8`). In production, then, every after-hours game reads "Starts …" on its row and "waiting for the open" on the header.
- **Between 3:15 and 4:00 PM ET** the header says "waiting for the open" while the market is open.
- **Where the old phrase still fits.** The rows' own "waiting for the open" remains for a game on its first trading day before the open.
- **Why it isn't changed here.** A wording change goes beyond the ruling, which the stop rule forbids.

Options:
- **(a)** Keep as built.
- **(b)** The header's tag and the status line take the first waiting row's clock ("Deployed · Starts Wed 9:30 AM ET"), so they say what the rows and the strip say.
- **(c)** Reword the aggregate phrase so it is true at any hour (for example, "Deployed · not started yet").
