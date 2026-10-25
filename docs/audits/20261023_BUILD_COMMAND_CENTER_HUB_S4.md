# Build report — Command Center hub, slice S4

Claude Code (Sonnet 5.5 at High effort, with an Opus 5.5 advisor consulted at three points; the review lenses, the refuters and the mutating lens on Sonnet 5.5), October 23, 2026, for Flash. The build prompt was the founder's "FantasyTrades Command Center — slice S4: Activity, the next action, Later, and the brief" of October 23, with rulings R-S4-1 … R-S4-8. This report covers S4 only (spec V1.2 §11.2 row S4; reviews IR-11, IR-12; the S3 rulings Q-S3-6, Q-S3-9, Q-S3-10). Everything is behind `COMMAND_CENTER_HUB_ENABLED = false` (`src/config/featureFlags.js:3442`), which stays false: with the flag off nothing a player sees changes.

Not in S4, and not touched: the deploy action and its wiring (S2b, parallel), Research and idea rows (S6), the Shadow canvas (S7), anything under `api/`.

## Verdict

| Item | Result |
|---|---|
| **Status** | **Draft PR, STOP.** Nothing merged; nothing activated. The flag is `false` at the PR head. |
| Branch and head | Local branch `claude/dreamy-payne-ea9e2d` (the desktop app's worktree name), pushed as the prompt's `claude/command-center-hub-s4`. **After the merge round (Oct 24, §13):** `main` `7d0daf10` (S2b, #993) is merged in and the code head is `b14d3973`; the commit after it adds only this report's §13 and its README row. Before it, the build was cut from `main` `82ea84bb` and its code head was `201de4ab` (§1 – §12 describe that build). |
| Starting check | Every seam the rulings lean on matches at the base (§2). No stop condition held. |
| R-S4-1 Activity | A bounded projection of records, never an event log: kinds `completed`, `deployed`, `loadout` (watchlist, adjustment); `idea` reserved for S6. Newest first, then kind order, then id; absolute ET with a year when not this year's; nothing older than the oldest completed record of the window; the optimistic entry excluded; History changes neither rows nor count. "All activity · N" opens an Activity sheet in S5's overlay stack (§3). |
| R-S4-2 Next action | The three rules in order, then none: an owned live game in `sortLiveBattles` order (a pre-open game says deployed and waiting for the open); the newest helper-READY review; the first deployment, only on a ready, empty completed read with no live game, finite `gamesPlayed === 0` and `canStart` (§3). |
| R-S4-3 Later | `openGame:{id}`, `review:{id}`, `deploy:first` in `sessionStorage` under `cc.later.{uid}`; survives remounts, clears on a resolved identity change; the next candidate within the same rule is offered first; every storage call is in try/catch (§3). |
| R-S4-4 Brief | More/Less on the body; the captions and states as ruled; `generatedAt` added additively to `useDailyRegimeBrief` (`src/hooks/useDailyRegimeBrief.js:70`), the two legacy callers unchanged and pinned. No fetch time shown as a publication time; no sources count (§3). |
| R-S4-5 History Refresh | `completed.refresh('history')` through the scheduler's rolling budget; a queued read shows its next permitted time (§3). |
| R-S4-6, R-S4-7 | Recorded as Amendment B to spec §6: `docs/specs/COMMAND_CENTER_CORE_IMPLEMENTATION_SPEC_V1_2_AMENDMENT_B_20261023.md` (README row added); the spec file is unchanged. A late first read is kept per owner and epoch; the kept window keeps its rows' READY review answers. The rows are listed in §8. |
| R-S4-8 | Added rather than rewrote in the shared hub files. S2b merged (#993) and its names won (Q-S4-10): `NextActionCard` takes `holdWiring` / `holding`; S4's `onDeploy` prop and its pass-throughs are gone (§13). |
| §2 review | Four lenses K (the kept window), N (the next action and Later), H (honesty of Activity) and T (test integrity, mutating); refuters for K, N and H. **32 findings: K, N and H 19 (17 CONFIRMED / 2 PARTLY / 0 REFUTED); T 13 (a mutating lens, no refuter ran: §7).** All fixed or answered with a founder question (§7). |
| Mutation | Builder passes: 133 mutants (99 + 34); T lens: 326 mutants; closure pass: 24 of 24 re-planted survivors killed at the head, 20 of them survived at the pre-closure head (§7). |
| `vite build` | Exit 0 at the code head `201de4ab` (Linux). The hub stays a lazy chunk and `index.html` names it nowhere. Hub chunk 128.06 kB / 38.99 kB gzip against 112.40 kB / 34.60 kB at the base (+15.66 kB / +4.39 kB gzip, S4's own code); the entry chunk 4,859.78 kB against 4,859.72 kB (+0.06 kB) (§6). *(at the build head `201de4ab`; the merged tree: §13.7.)* |
| `lint:gate` | Exit 0 at `201de4ab` (Linux). *(at the build head `201de4ab`; the merged tree: §13.7.)* |
| Full suite (Linux, CI-shaped) | Exit 0 at `201de4ab`: `Test Files  1156 passed \| 8 skipped (1164)`, 25,076 rows passed, 0 failed (§6). S4's 12 new test files hold 266 rows. *(at the build head `201de4ab`; the merged tree: §13.7.)* |
| Flag-on dry run | The smoke state (flag `true`), full suite on Linux: 14 failing rows in 4 files — the same 14 as S3's, all by design (§9). S4 adds no red row. *(at the build head `201de4ab`; the merged tree: §13.7.)* |
| Fenced files, `api/` | None edited. Nothing under `api/` changed (`git diff 82ea84bb..HEAD --name-only` lists no `api/` path). S4's product code calls no fenced function; it calls the non-fenced `revalidateStandingLeans` (`api/_utils/leanRevalidation.js:181`, from `src/components/CommandCenter/hub/activityRows.js:70`), which BUILD_RULES §1 does not list. `src/hooks/useDailyRegimeBrief.js` is not listed either. |
| Stop rule | Not tripped by a behaviour change to today's (flag-off) behaviour. Existing test files were edited — registrations the guards demand of new files, rows that pin S1/S3 hub states which the amendment or S4 now changes, and one environment mock line; none weakens a pin of live behaviour. Raised as Q-S4-1 (§5). |
| Founder questions | Q-S4-1 … Q-S4-11 (§10), answered in §13.3; new: Q-S4-12, Q-S4-13 (§13.9). |
| Next | The founder's review of the draft PR (as merged with S2b) and the smoke preview (§9, §13.8); S6, S7 and S8 inherit §11 as updated by §13.10. |
| Merge with S2b and founder rulings (Oct 24) | `main` `7d0daf10` (S2b, #993) merged: six conflicts, S2b's `holdWiring` / `holding` win and S4's `onDeploy` is gone; the first-deployment card's hold stays mounted while its own hold charges and deploys once through the real provider (11 rows). Rulings applied: Q-S4-1, 3, 4, 9 confirmed, 2, 6, 7 as built, **Q-S4-5 recorded for the `TRAIT_SLOT_ENABLED` flip, Q-S4-8 → the desktop Activity count is 5** (the mock-up fixes none), Q-S4-11 → S8. One lens (M): 7 findings, none MAJOR (no refuter); 32 mutants, every gap closed; S4's date helpers moved to a hub-only module so the entry chunk carries none (+0.38 kB over `main`). Checks on the merged tree: full suite exit 0 (`1171 passed \| 8 skipped (1179)`, 25,349 rows), `lint:gate` exit 0, `vite build` exit 0, flag-on dry run the same 14 by-design rows (§13). |

## 1. Branch, HEAD and preamble

- `git fetch origin` ran first. `origin/main` was `82ea84bb` (the merge of PR #992, the S3 build), the branch's base; a fetch before the final checks found it unchanged, so there was nothing to merge and the checks ran on the tree that is pushed. (The merge round's own fetch, on Oct 24, is in §13.1.)
- Local branch `claude/dreamy-payne-ea9e2d`, pushed by refspec as `claude/command-center-hub-s4`.
- Model setup as the prompt asked: Sonnet 5.5 at High effort, an Opus advisor consulted at three points only (after the starting check, on the STOP-rule reading, and before this report); review agents do not consult the advisor.
- Commits since the base:

| Commit | What |
|---|---|
| `05cd1f29` | The build: Activity, the next action and Later, the brief, History Refresh, Amendment B, the modules, sections, copy and their rows |
| `1cb52da2` | Two redundant lines dropped, a vacuous row removed, a duplicate lean pin pinned |
| `57a1c3d3` | The live game's visibility on the phone pinned by the card (S3 review T0-1) |
| `31cbe8bd` | The date test does not set `TZ` in a worker (it crashed the Linux worker) |
| `8d9f3a67` | The builder's mutation pass: four gaps closed; the date check drops a redundant comparison |
| `0adf885f` | The review round's fixes K-1 K-2 K-3, N-1 N-2 N-3, H-1 H-2 H-3 H-4 H-5 H-7 H-8 and their rows — **the commit lens T reviewed** |
| `971f3a75` | Test only: the hub's clock pinned for years and the archetype name on the adjustment row |
| `201de4ab` | Lens T's gaps closed (T-1 … T-13): rows, one guard file, one redundant defensive line removed — **the code head** |
| (the report commit) | This report and its README row |

Lenses K, N and H reviewed the build as of `8d9f3a67`.

## 2. Starting check (BUILD_RULES §3)

Read in this session at the base `82ea84bb` (`api/` is unchanged by S4, so those lines are the base's). None met the stop rule.

| Seam | At the base | Status |
|---|---|---|
| The watchlist's equip time | `api/agent/equip-watchlist.js:121` writes `equippedAt: nowIso` with `equippedWatchlistId` in one transaction; re-equipping the same list is idempotent and keeps the recorded time (`:105`); `api/agent/unequip-watchlist.js:87` writes `equippedAt: null` | VERIFIED. The agent document records one time for the equipped list; a bundle's `equippedAt` is on the bundle document (`api/agent/equip-bundle.js:219`), not the agent's |
| The adjustments' equip time | `api/agent/equip-lean.js:216` pins `{ adjustmentId, version, equippedAt: nowIso }` in `agent.standingLeans` | VERIFIED. Each pin records its own time; an unreadable one yields no row |
| Which leans a game carries | `revalidateStandingLeans` (`api/_utils/leanRevalidation.js:181`), default cap `resolveLeanCap` (`:82`, 2 while mastery enforcement is off); the Forge Character tab and the battle snapshot make the same call | VERIFIED. Activity asks the kernel instead of listing every stored pin (BUILD_RULES §9) |
| Which list is equipped | `api/_utils/watchlistEquip.js:51` `resolveEquippedWatchlist`; the hub's own `deriveWatchlist` (`src/components/CommandCenter/hub/selectors/loadout.js:94`) calls a list that is equipped but no longer committed `unavailable` | VERIFIED. The watchlist row waits for the Loadout card to have found the list (review H-1) |
| The brief's generation time | `api/cron/compute-daily-regime-brief.js:209` writes `generatedAt: FieldValue.serverTimestamp()` on `indexIntelligence/dailyRegimeBrief`; `useDailyRegimeBrief` read the document but returned no `generatedAt` | VERIFIED. The additive return is the only change to the hook |
| The first-deployment rule | `src/components/CommandCenter/hub/selectors/deployState.js:277` `firstDeploymentCandidate` (ready, owned, empty completed read; empty owned poll list; finite `gamesPlayed === 0`; `canStart`) | VERIFIED; the offer reuses it (`hub/nextAction.js:38`) |
| Live order | `sortLiveBattles` (`src/utils/commandCenterLiveBattles.js:121`), used by Games' live rows (`hub/gamesDisplay.js:21`) | VERIFIED |
| The scheduler's budget | `REVIEW_BUDGET` (`hub/reviewScheduler.js:67`): one query and ten helper calls per rolling 120 s, per owner and epoch | VERIFIED; History Refresh shares it |
| Spec §8.2 | The activity table, the heading and the next-action priority (`docs/specs/20261012_COMMAND_CENTER_CORE_IMPLEMENTATION_SPEC_V1_2.md:284–300`) | VERIFIED; rulings R-S4-1 and R-S4-2 are its text made exact |

## 3. The rulings as applied

Files and lines are at the code head `201de4ab`.

**R-S4-1 Activity.**
- `hub/activityRows.js:128` `deriveActivity` is pure: it reads only its arguments (pinned by `hub/s4Modules.purity.guard.test.js`). Kinds `completed:{id}` (at `completedAt`, with Games' own §7 outcome words), `deployed:{id}` (at the server `activatedAt`, else `createdAt`; an entry with `localOrigin: true` is skipped), `loadout:watchlist:{id}` and `loadout:adjustment:{id}` (`:78` `loadoutEvents`, only where an equip time is recorded). Sorted newest first, then kind order, then id; each kind-specific id once.
- The cutoff is the oldest readable `completedAt` of the window (`:61`); with no completed record the current-state rows stay and no history is claimed. A game the window holds completed while the poll still lists it live is listed once, live.
- Display: `hub/hubDate.js:124` `formatHubDayTime`, `:130` `formatHubDayYear` (absolute ET; the year only when it is not this year's).
- The heading is `hub/hubCopy.js:370` "Recent activity · your last 10 games and current loadout". `hub/hubCopy.js:368` is the table: no "event", "log" or "history of" word survives the copy guard (`hubCopy.s4.guard.test.js`).
- `:216` `activitySectionOf` finishes the section where the Loadout is known (`hub/useHubRuntime.js:113`), so the readers pass only the inputs (`hub/useHubReaders.js:143` `activityInputs`). Opening History neither adds nor removes a row.
- `sections/ActivitySection.jsx:68` (desktop limit 10 at the build head, 5 since the merge round — §13.3; `hub/hubModel.js:170` then; phone 3), `:23` `ActivityRows`, `:53` `ActivityAgeNote`; "All activity · N" opens `ActivitySheet.jsx:19` through `openAllActivity` (`CommandCenterHub.jsx:234`, `:316`), kind `ACTIVITY` in `hub/useHubSheets.js:36` — registered in S5's overlay stack. A row opens its game only when it carries a `battleId`.

**R-S4-2 Next action.**
- `hub/nextAction.js:108` `deriveNextAction({ liveRows, battles, rowsById, firstDeployment, liveResolved, dismissed })` returns `{ status, candidate }`. Rule 1 takes the first owned live row in `sortLiveBattles` order (`:47`; a pre-open game says "Your game is deployed" and waiting for the open). Rule 2 is the newest review whose `rowsById` row has `review === true` — the same test as the tape link — by `completedAt` then id (`:60`); a pending, unavailable, timed-out or queued answer is never offered. Rule 3 is the first deployment (`:72`, `firstDeploymentOffer` `:38`).
- A game opens through `hub.openGame`, a review through `hub.openFilmRoom` (`hub/useHubReaders.js:163,166`; the card's action `:182`). The first-deployment card's hold is `HubHold` with `onDeploy` — see §11 for what `actions.deploy` is today.
- `sections/NextActionCard.jsx:28`; the phone Overview shows the card in place of listing its live game twice (`PhoneTabs.jsx:109`, `:111`).

**R-S4-3 Later.**
- `hub/useHubLater.js:28` key `cc.later.{uid}`; `:81` the hook, whose state resets during render (`:86–91`; no effect, timer or listener — `commandCenterHub.mount.guard.test.js` pins that the file names `sessionStorage` and nothing else). Dismissing a candidate offers the next candidate within the same rule first, then falls to the next rule (`nextAction.js:115,121,125`); two Laters in one tick both land (a `latest` ref, `:93`). Every storage call is in try/catch; `:57` `forgetOthers` removes other accounts' keys on mount.
- A resolved identity change clears the set (`:86`); an unresolved frame (`auth` null) clears nothing.
- `hub/useHubReaders.js:188` `laterNextAction` hands focus to the card that replaces the dismissed one (`flushSync`, `data-hub-later` on `NextActionCard.jsx:57`).

**R-S4-4 Brief.**
- `hub/useHubBrief.js:28` `briefCaption`: "Brief for {date}"; "Generated {time ET}" only when the document returned `generatedAt`; stale = "Last session's brief · for {date}" (`hub/hubCopy.js:409–411`). `:41` `briefSectionOf`; states "No brief available" and "Couldn't load the brief · Retry" (`:53` `retry: () => drb.refetch()` — never the hook's `refetch` itself: a click would arrive as its `isRetry` argument).
- `hub/hubDate.js:147` `formatHubMarketDate` for the brief's date. `sections/BriefSection.jsx:44`; More/Less on the body, the phone's Retry outside the toggle button.
- `src/hooks/useDailyRegimeBrief.js:70,72`: `generatedAt` added to the return; the two legacy callers ignore it (`useDailyRegimeBrief.generatedAt.jsdom.test.jsx`).

**R-S4-5 History Refresh.** `hub/useHubReaders.js:179` `refreshHistory: () => refresh(REVIEW_TRIGGERS.HISTORY)` with `HISTORY` added to the scheduler's triggers (`hub/reviewScheduler.js:96`); it shares the rolling budget, so a refresh inside the cap is queued. `HistorySheet.jsx:33` `HistoryRefresh`: the link, "Refreshing…", or "Next refresh at {time}" (rounded up). A stale or carried window offers no link.

**R-S4-6, R-S4-7 Amendment B.** `hub/reviewScheduler.js:212,224,418,661` (`onLate`, `lateRead`, `lateDone`), `:125` `keptReadyAnswers`, `:140` `carriedWindow`, `:158` `carriedState`; `hub/useHubCompletedBattles.js:67,72,87,105,180,220`. The record is `docs/specs/COMMAND_CENTER_CORE_IMPLEMENTATION_SPEC_V1_2_AMENDMENT_B_20261023.md`. No effect changed and no listener or timer was added, so `commandCenterHub.activity.guard.test.js` (the strict activity manifest) is unchanged; the mount guard's manifests gained the S4 lines listed in §5.

**R-S4-8.** The shared hub files were extended, not rewritten: `CommandCenterHub.jsx` (the sheet, the cards' props), `hub/hubCopy.js`, `hub/hubModel.js` (`DESKTOP_ACTIVITY_LIMIT`), `hub/useHubSheets.js`, `commandCenterHub.mount.guard.test.js`. The one `hubProps` object gained no key (the brief is read inside the readers; nothing from App's data was needed).

### Interpretations the prompt left open

1. **Adjustment rows are standing leans, through the kernel at its default cap.** The Forge's Character tab and the battle snapshot make the same call (review H-3, Q-S4-4). Only with `RELEASE3_CHARACTER_TAB_ENABLED` on (`hub/useHubRuntime.js:120`).
2. **A carried (kept) empty window counts as a ready, empty read for the first deployment; a stale one does not.** (Q-S4-3.)
3. **Later survives App's real logout.** App unmounts the dashboard before the identity resolves to signed out, so a same-uid sign-in in the same tab finds its Laters. A sign-out the mounted hub sees clears them. (N-4, Q-S4-6.)
4. **A late read is kept only if it is the owner's first, and only while the owner has no window yet.** (K-3, Q-S4-2.)
5. **The brief is read once per hub mount** (its one automatic retry included); a bounce re-reads. (Q-S4-7.)
6. **The desktop section lists up to 10 rows at the build head (5 since the founder's ruling Q-S4-8, §13.3), the phone Overview 3** (`PHONE_ACTIVITY_LIMIT`); the sheet lists all. (Q-S4-8.)
7. **Rule 2 and the first deployment wait for the live poll to answer** (`liveResolved`): until then rule 1 is unknown, so the card says "loading" rather than guess (review N-2). With a poll that never answers they stay hidden. (Q-S4-9.)
8. **The first-deployment offer sets the owner's own hold aside** (`firstDeploymentOffer` passes `hold: null`): once S2b's hold is charging the card must not unmount under the pointer (review N-1). `canStart` stays false on the hold surfaces themselves.
9. **The empty Activity list waits for what is unknown.** While the Loadout is loading or failed it is "loading" / "couldn't load", not "Nothing recorded yet" (`hub/activityRows.js:196` `LOADOUT_KNOWLEDGE`, review H-4).

## 4. Files, by `file:line` (code head `201de4ab`)

New product files (all under `src/components/CommandCenter/`):

| File | What |
|---|---|
| `hub/activityRows.js:128,196,199,216` | `deriveActivity`, `LOADOUT_KNOWLEDGE`, `loadoutKnowledgeOf`, `activitySectionOf` |
| `hub/nextAction.js:28,38,43,108` | `NEXT_ACTION_KINDS`, `firstDeploymentOffer`, `laterKeyOf`, `deriveNextAction` |
| `hub/useHubLater.js:28,57,70` | the Later store and hook |
| `hub/useHubBrief.js:28,41,53` | the brief's caption, section and hook |
| `ActivitySheet.jsx:19` | the Activity sheet |
| `docs/specs/…_AMENDMENT_B_20261023.md` | Amendment B |

Modified product files:

| File | What |
|---|---|
| `hub/useHubReaders.js:99,100,143,155–158,179–195,204` | the Later and brief hooks; `activityInputs`; the next action; `refreshHistory`, `nextAction`, `laterNextAction`, `retryBrief`, `openActivity`; `sections` |
| `hub/useHubRuntime.js:113–121` | the final Activity section |
| `hub/reviewScheduler.js:96,125,140,158,212,224,418,661` | `HISTORY`; Amendment B |
| `hub/useHubCompletedBattles.js:67,72,87,105,180,220` | the kept window's record, ready answers, render fallback |
| `hub/hubDate.js:124,130,147` | day-and-time, year, market date |
| `hub/hubCopy.js:194,273,368,401` | `nextAction`, `history.refresh*`, `activity`, `brief` strings |
| `hub/hubModel.js:170`, `hub/useHubSheets.js:36` | `DESKTOP_ACTIVITY_LIMIT`; the `ACTIVITY` sheet |
| `CommandCenterHub.jsx:234,282–285,316,349–357,389–392` | `openAllActivity`; the sheet and the cards' props in both shells; the header note on `actions.deploy` (`:56`) |
| `PhoneTabs.jsx:109–131` | the card slots, Activity, the brief's Retry |
| `HistorySheet.jsx:33,43,73`, `HubParts.jsx:122` | the Refresh line; `HubButton` passes through extra props |
| `sections/ActivitySection.jsx:23,53,68`, `sections/BriefSection.jsx:30,44`, `sections/NextActionCard.jsx:28,57` | the rows, age note, states, the card's buttons |
| `src/hooks/useDailyRegimeBrief.js:70,72` | `generatedAt` (additive) |

New tests: `hub/activityRows.test.js` (59 rows), `hub/nextAction.test.js` (28), `hub/hubDate.s4.test.js` (6), `hub/useHubBrief.test.js` (13), `hub/useHubLater.jsdom.test.jsx` (17), `hub/reviewScheduler.amendmentB.test.js` (17), `hub/useHubCompletedBattles.amendmentB.jsdom.test.jsx` (17), `hub/useHubReaders.s4.integration.jsdom.test.jsx` (6), `CommandCenterHub.s4.jsdom.test.jsx` (79), `hubCopy.s4.guard.test.js` (13), `hub/s4Modules.purity.guard.test.js` (4), `src/hooks/useDailyRegimeBrief.generatedAt.jsdom.test.jsx` (7): 266 rows.

## 5. Pre-existing tests edited (the stop-rule reading)

| File | Change | Why |
|---|---|---|
| `CommandCenterHub.reviewFixes.jsdom.test.jsx` (L1-3) | the phone "All activity" link is enabled (`disabled` true → false); its title no longer says "until S4" | the row's own title said the link waits for S4; R-S4-1 wires it |
| `hub/useHubCompletedBattles.jsdom.test.jsx` (two rows) | a kept row's READY answer survives an unmount (`ready`, 10 checks not 20); a first read that lands after the unmount is kept (`ready`, `carried`, generation 1) | the two Amendment B clauses (R-S4-6, R-S4-7) change exactly what those rows pinned |
| `CommandCenterHub.s3.jsdom.test.jsx` | `sessionStorage.clear()` in `afterEach`; two rows set the next action aside through Later's store | a live game or a ready review on the phone Overview is now the card, not a list row; those rows are about the list rows (S1 review L1-2) |
| `hub/useHubReaders.integration.jsdom.test.jsx` | one `vi.mock` of the brief hook | the readers now call the brief's hook, whose module reads Firebase's config at load |
| `commandCenterHub.mount.guard.test.js` | manifests: two terminals (the brief's hook, the lean kernel), Later's storage and its no-effect patterns, two imported names, and the S4 describe | registrations the guard demands of new files |
| `src/theme/motion.guard.test.js`, `tokens.guard.test.js`, `motionGuardBaseline.json`, `tokenGuardBaseline.json` | the five new files registered, count 0 | token-only from birth (hazard 34) |

No row of today's flag-off behaviour was edited. Raised as Q-S4-1.

## 6. Checks

All on Linux (WSL Ubuntu, Node 20.20.2, `TZ=UTC`), in a git worktree of the one reusable clone `~/pd-ci` (see §12), at the exact code head `201de4ab`:

| Check | Result |
|---|---|
| Full suite, CI shape (`--maxWorkers=2`) | exit 0; `Test Files  1156 passed \| 8 skipped (1164)`; `Tests  25076 passed \| 89 skipped (25165)`; 0 failed; 752 s |
| `npm run lint:gate` | exit 0 |
| `npm run build` | exit 0; 4,056 modules (4,051 at the base: five new modules) |
| Windows hub and theme suites (after the review rounds) | 70 files, 2,455 rows, all passing |

Bundle, measured at the base `82ea84bb` and at `201de4ab`, same toolchain:

| Chunk | Base | `201de4ab` | Delta |
|---|---|---|---|
| `CommandCenterHub-*.js` | 112.40 kB / 34.60 kB gzip | 128.06 kB / 38.99 kB gzip | +15.66 kB / +4.39 kB gzip |
| `index-*.js` (the entry; flag off) | 4,859.72 kB / 1,307.09 kB gzip | 4,859.78 kB / 1,307.11 kB gzip | +0.06 kB (the `generatedAt` line) |

The hub chunk is S4's own code. `api/_utils/leanRevalidation.js` and `src/data/archetypeAdjustments.js` already live in the entry chunk (the Forge Overview imports them); the hub chunk's source map names neither, so the import adds no bytes to it. `index.html` names the hub chunk nowhere.

The report commit is docs-only; no test reads `docs/README.md` or `docs/audits/`, and `vite build` ran again on the pushed commit (see the PR).

## 7. The §2 review record

BUILD_RULES §2 applies (44 files, 4,459 lines at the code head). The lenses and refuters ran on isolated `git archive` snapshots, all on Sonnet 5.5; no real-browser runs (the prompt's). Each finding below is a claim a reviewer made and a second reviewer tried to refute.

### Lenses K, N and H (reviewed `8d9f3a67`; fixed in `0adf885f`)

19 findings: 17 CONFIRMED, 2 PARTLY, 0 REFUTED.

| ID | Claim | Verdict | Disposition and evidence |
|---|---|---|---|
| K-1 | A shown kept window hid the scheduler's own in-flight, queued and failed state (BLOCKER claimed) | CONFIRMED | Fixed: `useHubCompletedBattles.js:105` `withReadOf`; rows `useHubCompletedBattles.amendmentB.jsdom.test.jsx:189–269` |
| K-2 | An earlier cycle's stale answer spent the live first read's one slot | CONFIRMED | Fixed: `reviewScheduler.js:418` checks the read's id before clearing; row `reviewScheduler.amendmentB.test.js:135` |
| K-3 | A late read replaced a window the hub was already showing | CONFIRMED | Fixed: `useHubCompletedBattles.js:180` keeps it only if the owner has no window; row `…amendmentB.jsdom.test.jsx:271` |
| N-1 | The first-deployment card would unmount under a charging hold once S2b feeds it (MAJOR, latent) | CONFIRMED | Fixed: `nextAction.js:38` offers with the own hold set aside; `nextAction.test.js` |
| N-2 | A ready review was offered before the live poll answered | CONFIRMED | Fixed: `liveResolved` (`nextAction.js:108`); rows in `nextAction.test.js` and the s4 jsdom file |
| N-3 | Setting aside the last candidate dropped focus to the body | CONFIRMED | Fixed: `useHubReaders.js:188` hands focus to the card that replaces it; `CommandCenterHub.s4.jsdom.test.jsx` |
| N-4 | "Sign-out starts empty" is untrue on App's real logout path | CONFIRMED | Behaviour kept; the header comment corrected (`useHubLater.js`). Q-S4-6 |
| N-5 | A store whose read throws but write works overwrites the saved list with the new key | CONFIRMED (NIT) | Left: Later is a per-tab convenience; no real store reads-fails-writes-works |
| N-6 | The hub header named `actions.deploy` as if defined | CONFIRMED (NIT) | Fixed: `CommandCenterHub.jsx:56` says it is defined nowhere yet and S2b must supply it to all three surfaces |
| H-1 | "Watchlist equipped" shown for a list since deleted or taken back to draft (MAJOR) | CONFIRMED | Fixed: the row waits for the Loadout card to have found the list (`activityRows.js:83`, `useHubRuntime.js:113`) |
| H-2 | The row's second line showed the stored name, the card the current one | CONFIRMED | Fixed: named as the card names it (`activityRows.js:89`) |
| H-3 | Leans at the structural cap 4, the Forge and the snapshot at the default 2 | PARTLY | Fixed to the default cap (`:70`); Q-S4-4 |
| H-4 | "Nothing recorded yet" while the loadout was still unknown | CONFIRMED | Fixed: `LOADOUT_KNOWLEDGE`, `loadoutKnowledgeOf` (`:196`, `:199`) |
| H-5 | A kept or failed window's rows carried no age | PARTLY | Fixed: `ActivityAgeNote` (`ActivitySection.jsx:53`, `ActivitySheet.jsx`) |
| H-6 | "Adjustment" is standing leans while the S5 Adjustments card is the (dark) trait slot | CONFIRMED (latent) | Left, flagged: Q-S4-5 |
| H-7 | Dates carried no year (a 2020 equip read as this year) | CONFIRMED | Fixed: `hubDate.js:130` |
| H-8 | `seen.add` after the time check let a duplicate's time stand in | CONFIRMED | Fixed: `activityRows.js:100` |
| H-9 | Records with none readable: a ready, empty list | CONFIRMED (NIT) | Left: not reachable with the current writers |
| H-10 | In the fall-back hour two instants print the same text | CONFIRMED (NIT) | Left: absolute ET is the ruling; the text is the format's limit |

### Lens T (test integrity, mutating; reviewed `0adf885f`; closed in `971f3a75`, `201de4ab`)

T planted 326 distinct mutants across the S4 production files, `useDailyRegimeBrief.js`, `hubModel.js`, `useHubSheets.js`, `selectors/deployState.js`, `hubCopy.js` and the two legacy brief callers: 249 killed by S4's own rows, 10 killed only by older rows, 25 equivalent, dead code or control, 40 survived on a reachable gap, and 2 more survived on its snapshot but were closed by `971f3a75`. It reported 13 findings: T-1 MAJOR (the phone's "All activity" link, sheet and rows had no row), T-2 … T-10 MINOR, T-11 … T-13 NIT. No production defect.

**No refuter ran for lens T.** A mutant that survives is itself an executable repro, so the finding's evidence is a re-plant, not an opinion; I ran that check instead of a refuter: the 24 named survivors, re-planted on the pre-closure head `971f3a75` and again on `201de4ab`.
- At `971f3a75`: 20 survived; 3 (the purity guard's) had no guard file to run; 1 was already killed.
- At `201de4ab`: **24 of 24 killed.**
- The closing rows (`201de4ab`): the phone's "All activity" link, sheet and rows (T-1); the card's order on the phone (T-2); the brief on the phone and the desktop un-clamp (T-3); the sweep for other accounts' keys behind a throwing store (T-4); the retry in flight (T-5); a timeless live game (T-6); the visible time and second line (T-7); the Character-tab flag at the hub level (T-8); `hub/s4Modules.purity.guard.test.js` (T-9); literal pins for the remaining words and the ban on an event log (T-10); T-11 … T-13 as rows (the rounded time as a literal among them), and one defensive `Object.hasOwn` that decided nothing removed (`reviewScheduler.js`).

### Builder mutation passes

133 mutants over the build (99 in the first pass: 88 killed, 10 survived, 1 broken; 34 in the second: 32 killed, 2 survived). The survivors that exposed a gap were closed with rows (`05cd1f29`, `1cb52da2`, `8d9f3a67`); three were judged equivalent in that pass and left: A06 (drop the null-time skip for a completed document), S05 (arm `onLate` from any phase, not only a query) and K05 (drop the `review.state === 'ready'` test beside `result.ready === true`). The ids are in the builder's mutant files, not in the repo. The 326 and the 24 are T's and the closure pass's; the numbers are not summed.

## 8. Amendment B: the rows that pin it

`hub/reviewScheduler.amendmentB.test.js` (the scheduler, 17 rows) and `hub/useHubCompletedBattles.amendmentB.jsdom.test.jsx` (the hook, 17 rows):

| Clause | Rows |
|---|---|
| A late first read of the same owner and epoch is kept | scheduler `:55` (handed to `onLate` with the owner's documents, generation 1, the time it landed); hook `:88` (the return shows it "as of" its read, owner-filtered, the slot still spent) |
| Inside the query's own 8 s and the cycle's 42 s; a list only; a failure keeps nothing | scheduler `:71`, `:91`, `:103`; hook `:108`, `:294` |
| Another owner or another epoch gets none; a sign-out drops the record | hook `:119`, `:136`, `:156` |
| Only the owner's first read; never replacing a window the hub already shows (K-3); a stale earlier answer spends no slot (K-2) | scheduler `:124`, `:135`; hook `:271` |
| A return before the late answer lands | hook `:171` |
| The shown kept window tells the truth about the scheduler's own read (K-1) | hook `:189–269` |
| No slot of its own; no `onLate` loses it quietly | scheduler `:171`, `:161` |
| Ready answers survive a remount, for rows in the window only | scheduler `:185`, `:215`, `:229`, `:240`; hook `:312`, `:326`, `:339`, `:355` |
| Pending, unavailable, timed-out and queued answers do not | scheduler `:198`; hook `:312` (every other row is queued) |
| Another owner, another epoch and a sign-out get no ready answers | hook `:372` |
| The shape of a window with no ready answers is Amendment A's | scheduler `:203` |

## 9. The smoke state and the flag-on dry run

Smoke branch `claude/command-center-hub-s4-smoke`: the pushed build head plus one commit setting the hub flag `true` (`src/config/featureFlags.js:3442`). **NEVER MERGE. No PR is opened for it.** Its Vercel preview is the founder's surface; its URL is in the PR description.

**Dry run.** The full suite on Linux with `COMMAND_CENTER_HUB_ENABLED = true` at `201de4ab`: `Test Files  4 failed | 1152 passed | 8 skipped (1164)`, `Tests  14 failed | 25062 passed | 89 skipped`. The 14 are the same as S3's and are by design (they pin the flag dark, or the flag-off App):
- 3 dark pins: `src/config/commandCenterHubFlags.test.js` (1), `src/config/flagPinGuard.test.js` (2);
- 9 in `src/App.activeBattlesPoll.owner.jsdom.test.jsx`;
- 2 in `src/App.bootOrder.jsdom.test.jsx`.

S4 adds no red row (the brief hook under App changed none). The smoke branch's CI will show these 14 red by design.

**The founder's checklist on the preview** (no real-browser runs were made in this slice; S8 re-runs them):
1. The next action for a live game, then — once it ends — for a ready review; Later, and the next candidate that replaces it.
2. Recent activity on the phone Overview (three rows) and "All activity · N" (the sheet); on desktop (ten rows at the build head, five since §13.3).
3. The brief: More/Less, the caption ("Brief for {date}", "Generated {time ET}" when the cron stored it).
4. History's Refresh, and its "Next refresh at {time}" inside the cap.
5. A quick return from the Film Room shows the games, and an openable tape, at once.

## 10. Founder questions

*Answered on Oct 24 (§13.3): Q-S4-1, 3, 4, 9 confirmed; Q-S4-2, 6, 7 accepted as built; Q-S4-5 recorded for the `TRAIT_SLOT_ENABLED` flip; Q-S4-8 → five rows; Q-S4-10 answered by the merge; Q-S4-11 → S8.*

- **Q-S4-1.** The stop-rule reading: the pre-existing test files S4 edited (§5) change hub-only states; none pins today's flag-off behaviour. Confirm (as Q-S3-1).
- **Q-S4-2.** Amendment B keeps only the owner's first late read, and only while no window is held (K-3). Widen it to every late success?
- **Q-S4-3.** A kept (carried) empty window counts as a ready, empty read for the first-deployment offer; a stale one does not. Confirm?
- **Q-S4-4.** Adjustment rows use the default lean cap (2 while mastery enforcement is off), as the Forge's Character tab and the battle snapshot do. The Forge Overview's structural cap (4) would show more. Confirm the default (H-3).
- **Q-S4-5.** Activity's "Adjustment equipped" is standing leans; the S5 Adjustments card is the dark trait slot. Reconcile when `TRAIT_SLOT_ENABLED` turns on (H-6)?
- **Q-S4-6.** Later survives a same-uid re-login in the same tab, because App unmounts the hub before the identity resolves to signed out (N-4). Accept, or clear on logout from App?
- **Q-S4-7.** The brief is re-read on every hub mount (one Firestore document, the hook's one automatic retry). Accept?
- **Q-S4-8.** The desktop Activity section lists 10 rows (the whole window's worth), the phone 3. Confirm 10?
- **Q-S4-9.** The review and first-deployment cards wait for the live poll to answer; if it never answers they stay hidden. Confirm?
- **Q-S4-10.** S2b's wiring differs from S4's (§11). Confirm that the merge round takes S2b's `holdWiring` / `holding` names and removes S4's `onDeploy` prop?
- **Q-S4-11.** Games' rows carry no year in their dates (outside S4; Activity's do when not this year's). Take it up in S8?

## 11. What S2b, S6, S7 and S8 inherit

**S2b (and the merge round) — done in §13.** *(What follows is the trial merge made before it, kept as written.)* S2b is on origin (`claude/command-center-hub-s2b`, `e7e8761c`). A trial merge of it into this head, in a scratch worktree and aborted, conflicts in five files: `CommandCenterHub.jsx` (3 hunks), `PhoneTabs.jsx` (1), `commandCenterHub.mount.guard.test.js` (2), `hub/useHubReaders.js` (3) and `sections/NextActionCard.jsx` (2); `hub/hubCopy.js`, `hub/hubModel.js`, `hub/useHubSheets.js`, the theme guards and `docs/README.md` merge cleanly. Nothing was resolved (the merge round's job).
- **Names.** S4's `NextActionCard` takes `onDeploy` and the hub passes `onDeploy={actions.deploy}` (`CommandCenterHub.jsx:357`, `PhoneTabs.jsx:109,111`); `actions.deploy` is defined nowhere. S2b's card takes `holdWiring` and `holding` (from `deployActionsOf`, `actions.nextActionHold` on the phone) and passes `onAct` to its hold's `onDeploy`. At the merge, S2b's names win and S4's `onDeploy` prop and its three pass-throughs go (Q-S4-10). The hub already has `actions.deployAction` (the Deploy card's `onAction`, S2a); that is not a rename candidate.
- **Behaviour S4 depends on.** Hold surfaces get `canStart = false` while the owner's own hold is charging; S4's offer sets the own hold aside so the card stays mounted (N-1). The optimistic entry (`localOrigin: true`) and the provider's record stay out of Activity: the record is not an event.
- **Shared names.** `hub/useHubReaders.js` returns `sections: { games, deploy, activityInputs, nextAction, brief }` and the `actions` above; S2b adds its half of the inputs next to them.

**S6 (Research and idea rows).** `ACTIVITY_KINDS.IDEA` and the kind order are in place; add `idea.created:{list}:v{n}` and `idea.state:{list}:v{n}:{status}` rows in `deriveActivity` and join the idea reader to `loadoutKnowledgeOf` so "Nothing recorded yet" waits for it (H-4). The watchlist card's labels still wait for S6's `ideaAccess` (S5).

**S7 (the Shadow canvas).** Nothing from S4: no S4 file touches the canvas or the status line.

**S8 (cumulative review).**
- No real-browser run was made for S4: re-run the smoke checklist (§9) at 390/1440, and check the Activity sheet's focus, inert background and return focus (it is a `HubSheet` in S5's stack), the brief toggle's `aria-expanded`, and the Later button's focus handoff (`flushSync`, `data-hub-later`).
- The four shipped sheets' gaps against spec §10 (S5's list) are unchanged.
- Q-S4-11 (years in Games' dates).

## 12. Deviations and notes

- **Linux checks ran in a git worktree of `~/pd-ci`, not in `~/pd-ci` itself.** Another session shares that clone and moved its HEAD under my first full-suite run, so that run was discarded (it showed failures in files S4 never touched). The final runs used `~/pd-ci-s4`, a worktree sharing the clone's object store, with `node_modules` symlinked to the clone's. No new clone was created; the worktree is removed with `unlink` of the symlink first.
- `hubDate.s4.test.js` first set `process.env.TZ` and crashed the Linux worker; the TZ plumbing was removed (`31cbe8bd`). The tests rely on the hub's own `America/New_York` formatter.
- A trial merge of S2b was made only to count conflicts; no S2b file was in this branch until the merge round (§13).
- The merge round ran its Linux checks the same way (a worktree of `~/pd-ci`), and merged through the desktop app's sync (`sync_with_base_branch`), which left the six conflicts for hand resolution.
- 🤖 Generated with [Claude Code](https://claude.com/claude-code)

## 13. Merge with S2b and founder rulings (Oct 24, 2026)

The founder's merge-round prompt of Oct 24: `main` moved (S2b, #993, merged); one round — merge `main`, S2b's names win (Q-S4-10), keep the next action's own-hold set-aside (N-1) working with S2b's real hold, apply the rulings, one focused lens on the merge (a refuter for any MAJOR), mutate the new rows, check the merged tree, update the smoke branch and the PR, push, STOP. Sections 1 – 12 describe the build as it stood at `201de4ab`; where this round changed one of their statements, this section says so and the older line is marked.

### 13.1 Branch, HEAD and the merge

- `git fetch origin` ran first. The branch was `claude/dreamy-payne-ea9e2d` at `15914588` (the pushed head), tree clean; `origin/main` was `7d0daf10` (the merge of PR #993, S2b), 17 commits ahead of the base `82ea84bb`.
- The merge ran through the desktop app's sync (`sync_with_base_branch`): six conflicted files — the trial merge of §11 found five; `docs/README.md` is the sixth, because S2b's two README rows landed where S4's did.
- Commits since `15914588`:

| Commit | What |
|---|---|
| `d5b5c62b` | The merge of `main` `7d0daf10`: the six resolutions (below), S4's `onDeploy` removed, the new rows `CommandCenterHub.s4s2b.jsdom.test.jsx`, the Q-S4-8 limit |
| `b193e56a` | The mutation pass's six gaps closed (seven rows in three files) |
| `5f16e77d` | The merge lens's fixes M-1, M-5, M-6 and the first half of M-7 |
| `b14d3973` | S4's date helpers move to a hub-only module, `hub/activityDates.js` (the second half of M-7) — **the code head** |
| (the report commit) | This section and the README row |

### 13.2 The six conflicts, and how each was resolved

| File | Hunks | Resolution |
|---|---|---|
| `sections/NextActionCard.jsx` | 2 | S2b's signature `({ nextAction, deploy, onAct, onLater, holdWiring = null, holding = null })` and its hold. S4's `onDeploy` prop is gone. One line differs from S2b's: `HubHold` is not given `onDeploy={onAct}` (`:54`), so the card's open action can never arm the hold — the S4 invariant "opening a game never starts a deployment", which the S4 row pinned, now holds with the provider's wiring as the only way in |
| `CommandCenterHub.jsx` | 3 | Imports: S4's `DESKTOP_ACTIVITY_LIMIT` with S2b's `useHubModalOpen` (`:105`). The side column: S2b's `DeploySection` with its wiring, S4's `ActivitySection` and `BriefSection` (`:417–427`). The card: `onAct`, `onLater`, `holdWiring={actions.nextActionHold}`, `holding={actions.nextActionHolding}` (`:435`) |
| `PhoneTabs.jsx` | 1 | S2b's two card slots (`:109`, `:111`): `holdWiring` and `holding` through `actions.nextActionHold` / `actions.nextActionHolding`; no `onDeploy` |
| `hub/useHubReaders.js` | 3 | S2b's attempt inputs (`attemptInputsOf`, `:121`) beside S4's brief hook; the return carries S4's `sections` (`games`, `deploy`, `activityInputs`, `nextAction`, `brief`) and `actions` with S2b's `inputs`, `agent`, `liveBattles` (`:225`) and `ceremonyAgent` (`:226`); the header comment holds both slices' paragraphs |
| `commandCenterHub.mount.guard.test.js` | 2 | Both slices' registrations: S2b's three terminals and its `useHubDeploy.js` effect allowance, S4's two terminals and Later's storage |
| `docs/README.md` | 1 | S2b's two rows, then S4's |

Nothing else needed a hand: `hub/hubCopy.js`, `hub/hubModel.js`, `hub/useHubSheets.js` and the theme guards merged cleanly. No fenced file, and nothing under `api/`, differs from `main` in this branch's diff.

### 13.3 The founder's rulings, as applied

| Ruling | Applied |
|---|---|
| Q-S4-1, 3, 4, 9 confirmed | Nothing to change: §5's edited rows stand (their reading is confirmed); a kept empty window counts for the first deployment and a stale one does not; the default lean cap; the review and first-deployment cards wait for the live poll |
| Q-S4-2, 6, 7 accepted as built | Nothing to change (the late read is the owner's first only; Later survives a same-uid re-login in the tab; the brief is read once per mount) |
| Q-S4-5 → recorded for the `TRAIT_SLOT_ENABLED` flip | **Recorded here as an item of the activation checklist, nothing built:** when `TRAIT_SLOT_ENABLED` (`src/config/featureFlags.js:118`, false) turns on, Activity's "Adjustment equipped" rows (standing leans, `hub/activityRows.js`) and the Loadout's Adjustments card (the trait slot) must be reconciled in the flip PR, the same commit (BUILD_RULES §9 and the flag-flip rule of §2): one source of "adjustment", or one word for each |
| Q-S4-8 → the design's desktop count, else 5 | The committed mock-up fixes no desktop count: `ff-side.jsx`'s `ActivitySection` (bundled module `5b2af642…`) cuts `st.activity` only `if (limit)`, the phone's Overview is the one caller that passes one (`limit={3}`), and the desktop side column renders it with none (the whole fixture). So `DESKTOP_ACTIVITY_LIMIT` is **5** (`hub/hubModel.js:187`, was 10), and "All activity · N" holds the rest. Rows: `CommandCenterHub.s4.jsdom.test.jsx` (the five-row side column; exactly five rows has no link; six has "All activity · 6"); the S1 row L1-3's second half (`CommandCenterHub.reviewFixes.jsdom.test.jsx`) said the desktop shows the whole fixture and links nothing — restated: five rows and an enabled "All activity · 10". The older "ten" in §3, §9 and §10 is marked below |
| Q-S4-11 → S8 | Carried to S8 (§11) |

### 13.4 The next action's hold with S2b's real hold (N-1)

`hub/nextAction.js:38` `firstDeploymentOffer(inputs)` is still `firstDeploymentCandidate({ ...inputs, hold: null })`. `inputs` now carries S2b's `attempt`, `hold`, `cooldown`, `now` and `modalOpen` (`readerInputs.js attemptInputsOf`), so every block of the S2a/S2b table other than the hold still takes the card away; the hold alone is set aside, so the control being pressed does not leave and the charge is not cancelled by its own unmount. The card's hold is live while it is the card's own hold that stands (`HubHold`'s `own`, keyed to `hub-next-action`), and denied while any other control's does.

`CommandCenterHub.s4s2b.jsdom.test.jsx` (11 rows) drives the hub inside the real `DeployAttemptProvider`, with S2b's harness (the identity source real; the agent read and the window stand-ins; the service and ceremony stand-ins):
- the desktop card's hold charges to its threshold with the card and the very hold node mounted throughout, locks, and deploys exactly once after the beat (`:163`);
- the phone's Overview card the same, and while it charges the strip's hold is denied (`:190`); while the strip's charges the card stays and its hold is denied (`:287`);
- once the deployment is under way the card is gone while the attempt stands, and no second request starts (`:207`); after the answer, with App's optimistic entry (`buildOptimisticBattleEntry`) in the live list, the card is that game (`:220`);
- a release before the threshold cancels and the card is still offered (`:238`); Later during a charge sets the card aside and no hold stands, nothing deploys (`:252`);
- a live game takes the card, and setting it aside with Later does not put the first deployment in its place (`:266`, `:277`); a player who has played gets no card and the Deploy card's hold deploys once (`:303`);
- the names: the hub files pass `holdWiring` / `holding`, and `onDeploy` / `actions.deploy` appear nowhere in them or in `NextActionCard` (`:317`).

`hub/useHubReaders.s4.integration.jsdom.test.jsx` gained four rows (`:213`): the readers' return carries S2b's `liveBattles` (the owner's own documents only) and `ceremonyAgent.directiveCount`, and S4's sections and actions in the same return — nothing of either slice was lost in the resolution. The two rows of `CommandCenterHub.s4.jsdom.test.jsx` that spoke of `onDeploy` are restated under S2b's names (the hold is armed by the wiring and by nothing the card's `onAct` carries; without a provider the hold is inert).

### 13.5 The review (one lens, M)

One focused lens, on Sonnet, on an isolated `git archive` snapshot of `d5b5c62b` (`node_modules` junctioned; it ran its own throwaway tests under `scratch/`): the next action's hold with S2b's provider, both slices' rows green, flag-off parity, and the merged readers. It ran the hub, provider and theme suites (77 files, 2,656 rows green), 18 flag-off and shared-path files and 30 deploy-path files (all green). **No BLOCKER and no MAJOR, so no refuter was needed.** Seven findings:

| ID | Severity | Claim | Disposition |
|---|---|---|---|
| M-1 | MINOR | Row 3 of the merge file said the answer "changes nothing" but looked at the card only before it; in the harness (poll list stays empty) the first-deployment card and a second request return after a `created` answer | **Fixed.** In production App's handoff appends the optimistic entry before the answer settles, so the card is the new game (the lens's own production-shaped test showed `openGame`, no hold). The row now says what it pins, and a new row rebuilds App's entry with `buildOptimisticBattleEntry` and asserts the live-game card (`:220`) |
| M-2 | MINOR | A hub sheet that opens withdraws the first-deployment card (`modalOpen` feeds the offer): on desktop the next slot is `display:none` and the grid reflows behind the scrim; on the phone the "No games yet" note takes its place; it returns when the sheet closes | **Left, asked:** S4's own pin (`hub/nextAction.test.js`, "every OTHER block…") says a modal takes it away, and the lens read it as intended. Cosmetic, behind the scrim. **Q-S4-12** |
| M-3 | MINOR | A failed refresh of the completed read mid-charge withdraws the card and cancels the hold (the selector wants a ready read); the strip's identical hold would still commit | **Left, per design** (Q-S4-3: a stale window does not count; `nextAction.js:36` names it). A live game or a foreign owner mid-charge also cancels, correctly. **Q-S4-13** |
| M-4 | NIT | Later pressed in the 450 ms locked beat stores `deploy:first` while the deploy still goes; after a refusal and Dismiss the card does not return in the tab | Left: a 450 ms window; the Deploy card's hold stays live, no capability is lost |
| M-5 | NIT | Rows overclaim: a title says "completing it deploys nothing" though nothing is pressed; two `not.toHaveBeenCalled` assertions had nothing pressed; the frame loop re-checks one render | **Fixed.** Titles say what is asserted; the vacuous assertions are gone; the loop's comment says frames write only the progress store. The lens's mutations: the offer without its set-aside turns three rows red, setting the attempt aside turns one red; setting the cooldown or the modal aside is caught by `nextAction.test.js` (`:228`, `:233`), so no pin is weakened |
| M-6 | NIT | `ActivitySection.jsx:65` and §3 of this report still say "ten" | **Fixed** (the comment; the report lines are marked) |
| M-7 | NIT (flag-off, static) | `hub/hubDate.js` is in the main bundle (the deploy provider imports it) and S4 had added five module-scope `Intl.DateTimeFormat` constructions that run at boot for every player, hub off | **Fixed, twice.** First the five were built on first use. Then the merge's flag-off bundle comparison showed S4's date helpers also *shipping* in the entry chunk (+1.75 kB, +0.47 kB gzip over `main`, for the same reason), so they moved to `hub/activityDates.js`, which only the lazy hub chunk imports; `hub/hubDate.js` is back to S3's contents. S3's own three formatters are untouched. Rows in `hub/hubDate.s4.test.js`: the main-bundle file names none of them, and none is built at load; the mount guard's exact list of outside edges into the hub still holds, so no file outside the hub can import the new module |

Nothing was found in the other dimensions: the set-aside cannot start a deployment `canStart` would deny (the claim and the threshold `canCommit` both run the full selector, the latter with `hold: null`, the offer's own input), the unwired path is inert, refused/uncertain/existing attempts keep the card away, a site flip cancels a charge and keeps the card, a sign-out mid-charge leaves no hold, the Enter key deploys once; the theme and mount-guard registrations of both slices are intact; `DeployAttemptProvider` is a pass-through flag off and `useDailyRegimeBrief`'s change is additive; the merged return lost nothing.

### 13.6 Mutation

32 mutants on the code behind the new rows (28 on the merge's rows, 4 on the date module), on a snapshot of `d5b5c62b` (own-hold set-aside; the offer's other inputs; the card's wiring; the hub's and the phone's pass-throughs; the control id and the holding phase; the readers' offer and returns; the first-deployment rule; the desktop limit). **Of the 28, 21 were killed; 7 survived and 6 of those were gaps:**

| Survivor | Gap | Row that now kills it |
|---|---|---|
| N3 (the offer ignores the live poll) | a live game set aside with Later would have put the first deployment in its place | `s4s2b` `:277` |
| W5, H8 (the card's hold always arms; the holding phase of any control) | another control's charge would not deny the card's hold | `s4s2b` `:287` |
| R4, R5 (the readers drop `liveBattles` / `ceremonyAgent`) | the merge's own return was unpinned | `useHubReaders.s4.integration` `:213` |
| L5 (the "All activity" link at `>=` the limit) | a link that holds nothing | `s4` "exactly as many rows as the limit" |

The seventh, R3 (the connected hub hands the deploy candidate a no-op `onAct`), is equivalent since the card no longer passes `onAct` to the hold. All six re-planted survivors are killed at the tested tree. The four on the date module (a formatter built at load, the main-bundle file importing the helpers, a derivation importing a date module the guard does not list, a formatter built twice) are all killed.

### 13.7 Checks on the merged tree

At the code head `5f16e77d`, on Linux in a git worktree of the one reusable clone `~/pd-ci` (as in §12), one run at a time:

| Check | Result |
|---|---|
| Full suite, CI shape (`--maxWorkers=2`) | exit 0; `Test Files  1171 passed \| 8 skipped (1179)`; `Tests  25349 passed \| 89 skipped (25438)`; 0 failed. An earlier run at `5f16e77d` (before the date helpers moved) was green too: 1171 files, 25,343 rows; the 6 more rows are the two new date rows and the two rows each theme guard gets for the new file |
| `npm run lint:gate` | exit 0 |
| `npm run build` | exit 0; 4,061 modules; the hub stays a lazy chunk and `index.html` names it nowhere |
| Flag-on dry run (the smoke state), full suite | `Test Files  4 failed \| 1167 passed \| 8 skipped (1179)`, `Tests  14 failed \| 25335 passed`: the same 14 rows in the same 4 files as S3's and the build's (3 dark pins: `commandCenterHubFlags.test.js` 1, `flagPinGuard.test.js` 2; 9 in `App.activeBattlesPoll.owner.jsdom.test.jsx`; 2 in `App.bootOrder.jsdom.test.jsx`), all by design. S2b and S4 together add no red row |
| Fenced files, `api/` | `git diff origin/main..HEAD --name-only` lists no `api/` path (46 files, the hub, its tests, the theme guards, the brief hook and docs); no fenced file edited, none called |

Bundle, measured at `main` `7d0daf10` (S2b merged) and at the code head, same toolchain:

| Chunk | `main` `7d0daf10` | `b14d3973` | Delta |
|---|---|---|---|
| `CommandCenterHub-*.js` | 109.54 kB / 33.90 kB gzip | 124.91 kB / 38.16 kB gzip | +15.37 kB / +4.26 kB gzip (S4's own code) |
| `index-*.js` (the entry; hub off) | 4,901.43 kB / 1,320.64 kB gzip | 4,901.81 kB / 1,320.75 kB gzip | +0.38 kB / +0.11 kB gzip |

The only module that differs in the entry chunk's source map is `src/hooks/useDailyRegimeBrief.js` (the one `generatedAt` line); `hub/hubDate.js` is byte-identical to `main`'s. The 0.38 kB is more than that line alone; the rest is not attributed. For comparison, with S4's date helpers still inside `hub/hubDate.js` the entry was 4,903.18 kB (+1.75 kB) — the reason they moved (M-7).

### 13.8 Smoke state

`claude/command-center-hub-s4-smoke` is rebuilt on the new PR head with the one flag commit; its CI shows the flag-on red rows below (by design). Rebuilt on the PR head (the report commit) with the one flag commit setting `COMMAND_CENTER_HUB_ENABLED` to `true` (`src/config/featureFlags.js:3442`). **NEVER MERGE; no PR.** Its commit and Vercel preview URL are in the PR description. The founder's checklist (§9) holds, with the first-deployment card's hold added: on a first-time account (an agent with no games played) hold the card's "Hold to deploy" at 390 and at 1440 px, release early once, then hold to the end.

### 13.9 New founder questions

- **Q-S4-12.** While a hub sheet is open the first-deployment card is withdrawn and returns when the sheet closes (M-2). Keep, or keep the card mounted behind the sheet with its hold disabled (one more input set aside in the offer, `modalOpen: false`, and one pin of `nextAction.test.js` restated)?
- **Q-S4-13.** A failed refresh of the completed read while the card's hold charges withdraws the card and cancels the hold (M-3), where the strip's hold would commit. Keep (a stale read is not a ready, empty one), or let a charge in progress ride through it?

### 13.10 What changes for the slices that follow

- **S2b's names are settled** (Q-S4-10 is answered by this merge). S4's `actions.deploy` never existed in the merged tree.
- **S6** still adds `idea` rows and joins its reader to `loadoutKnowledgeOf` (§11).
- **S8** adds to §11's list: the first-deployment card's hold with real input at 390 and 1440 px on the smoke preview (hold, quick release, Enter, a sheet opened mid-charge, a site flip mid-charge), the Activity side column at five rows, and Q-S4-11.
- **The activation checklist** gains the `TRAIT_SLOT_ENABLED` item (13.3).
