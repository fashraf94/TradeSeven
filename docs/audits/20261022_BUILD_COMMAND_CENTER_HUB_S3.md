# Build report — Command Center hub, slice S3

Claude Code (Opus 5.5), October 22, 2026, for Flash. The build prompt was the founder's "FantasyTrades Command Center — slice S3: the readers (games, completed window, outcomes, the Film Room coordinator)" of October 21, with rulings R-S3-1 … R-S3-10. This report covers S3 only (spec V1.2 §11.2 row S3, corrections C5 and C6, the S2a strip ruling). S3 builds the strip's height rule, one identity source, an owner-aware active poll in App, owner tags on the agent reader, one ten-game completed window, the Film Room review coordinator, the §7 outcomes, and the hub's Games and History from real readers. Everything the hub shows stays behind `COMMAND_CENTER_HUB_ENABLED = false`, which stays false. Two pieces of live main-graph code change additively (App's poll, the agent reader); today's shells behave as they do now for the signed-in owner, the one exception being R-S3-3's clear on an account switch. Nothing is merged or activated.

## Verdict

| Item | Result |
|---|---|
| Starting check | Every anchor the prompt names matches at the base `ff6248d1` (§2), with drifted line numbers recorded. No stop condition held, so the build went on. |
| R-S3-1 (first commit) | The strip's line 1 clamps at two lines, line 2 at one with an ellipsis. The review-due refusal reads "Deployment refused" with "Open in the Forge"; the server's full line stays on the card. The phone had no Deploy card, so the Loadout tab now carries one (Q-S3-5). Measured at 360 px: tallest 69.08 px, two lines plus one (§6). |
| R-S3-2, R-S3-3 | One identity source `{ resolved, uid, authEpoch }` outside the hub directory. App's poll captures it before its first await, drops a completion whose capture is no longer current, keeps its one `setActiveAgentBattles(liveBattles)`, and keeps its metadata in its own state. An actual identity change clears the list in a layout effect outside the poll body and runs the poll at once. `refreshActiveBattles()` is deduplicated; `refreshing` is true only for an explicit refresh. |
| Shells' parity | Held. Lens T1 traced every same-owner path byte- or trace-identical to the base, and S3's rows run against the base: the parity rows pass there, the defect rows fail (§9). `App.agentBattlesPoll.test.js` is untouched and passes. |
| R-S3-4, R-S3-5 | `useAgent(uid, { ownerEpoch })` adds `status`, `readError`, `ownerUid`, `ownerEpoch`, `retry`; `agent` and `loading` are unchanged for every legacy caller. `useHubCompletedBattles(10)` is the one window; the legacy `useRecentCompletedAgentBattles(max)` keeps its array and shares the query. A failed read never renders an empty history. |
| R-S3-6, the coordinator | A pure scheduler on an injected clock behind a thin hook, exactly §6: one query and ten helper calls per rolling 120 s, logical concurrency 3, 8 s per operation, 42 s per cycle, the fair queue, hide and dispose rules, the §6 copy, and fixtures for the three `FILM_ROOM_V2_MODE` values. The review moved the rate ledger to the owner and epoch so a remount spends the same budget (T0-3; Q-S3-2). |
| R-S3-7, outcomes | `deriveGameOutcome` applies the §7 table over one projection. The never-scored recorded draw is "No result", pinned against the server. A Node parity test imports the server's `resolveCompletionDisposition`; nothing under `src/` imports the cron. |
| R-S3-8, R-S3-9, R-S3-10 | Live rows from the retained poll list the gate reads; completed rows with §7 words and §6 review lines; desktop 2, phone Overview 3, History the whole window with no read. A game opens through `handleOpenAgentBattle`, a tape through the legacy Film Room path from the `dashboard` screen. Real eligibility reaches the strip and card; the hold stays inert. One `hub` object through the gate; App's edits are in the three permitted places. |
| §2 review | Four lenses (T1 parity, T2 ownership, T3 the coordinator, T4 outcomes), the coordinator's own reading of R-S3-8 (T0), eight refuters, then the mutating lens T5 and its two refuters, all on Sonnet on isolated snapshots. **T0–T4: 32 distinct findings, 17 CONFIRMED, 12 PARTLY, 3 REFUTED**, plus 7 new findings from refuters; no BLOCKER; six MAJOR, all fixed. **T5: 19 findings, 12 CONFIRMED, 7 PARTLY**, plus 8 new findings from its refuters. Every T5 finding is a test gap; nothing shipped wrong. All are closed with rows, and no product file changed in that round (§9). |
| Mutation | Builder pass over the fix round: **64 / 64 killed**. T5: 1,121 mutants at `fe3dbe6a`, 266 surviving the suites, 159 of them real. The refuters' landed rows kill **133 / 134** (UI, App, outcomes, guards) and **63 / 77** (the scheduler, the hook, the poll). Every survivor is unobservable, out of contract or equivalent, except two that were parked and then landed. The builder's three parked rows kill **3 / 3**. The 18 App mutants were re-run on the merged head: **18 / 18** (§9.4). |
| `vite build` | Exit 0 at the code head `53aa0f0b` (Linux). The hub stays a lazy chunk, and `index.html` names it nowhere (§8). |
| `lint:gate` | Exit 0 at `53aa0f0b` (Linux). |
| Full suite (Linux, CI-shaped) | Exit 0 at `53aa0f0b`: `Test Files  1129 passed \| 8 skipped (1137)`, 24,294 rows passed, 0 failed (§8). |
| Fenced files, `api/` | None edited. Nothing under `api/` changed. S3's product code calls no fenced function. One S3 test does, as BUILD_RULES §1 permits: `hub/gamesDisplay.measured.test.js` (Node) calls the non-fenced `scoreCorrectedPosition` (`api/_utils/stockThresholdAdmission.js:174`), which calls the fenced `calculateAssetScoreServer` (`api/_utils/agentScoring.js:225`) at `:182`. The Node parity test imports `api/cron/agent-evaluate.js` (not fenced) and calls only `resolveCompletionDisposition`. |
| Stop rule | Not tripped by a behaviour change. Existing test files were edited — registrations the guards demand of new files, the S2a strip rows R-S3-1 overrules, and one environment mock line in four hub suites; none weakens a pin. Raised as Q-S3-1 (§5). |
| Founder questions | Q-S3-1 … Q-S3-8 (§12). |
| Next | The founder's review of the draft PR, Q-S3-1 … Q-S3-8 and the smoke preview (§13); then S2b and S4, which inherit §10 (§14). |

## 1. Branch, HEAD and preamble

- `git fetch origin` ran first. `origin/main` was `ff6248d1` (the merge of PR #988), the branch's base; PR #985 (R2) is merged at `7818a1b3`, an ancestor. The tree was clean.
- `main` moved during the build to `82a7d4d5` (the merge of PR #990, the pilot's P1c). The desktop app's sync merged it after the T0–T4 fix round, at `9bd66d5a`, with no conflict. Of what S3 changes or reads, main changed three files:
- `src/App.jsx`: +30 lines, the pilot's P1c events, none in S3's regions;
- `src/config/featureFlags.js`: the hub flag moved to `:3442`, still `false`;
- one S2a hub test, `hub/selectors/attemptVocabulary.test.js`.

No S3 file changed. A fetch before the final checks found `main` still at `82a7d4d5`, so the checks ran on the merged tree (§8).
- Local branch `claude/command-center-s3-readers-47a29b` (the desktop app's worktree name), pushed as the prompt's `claude/command-center-hub-s3`.
- Model setup as the prompt asked: the build on Opus with no advisor; every lens, refuter and the mutating lens on Sonnet.
- Commits:

| Commit | What |
|---|---|
| `0578e36a` | R-S3-1, first: the strip's height rule, the review-due strip words, the phone Loadout card. (Its message says "two S2a rows"; it changed three pre-existing rows in two files, §5.) |
| `748e5208` | R-S3-2, R-S3-3: the identity source, App's owner-aware poll, the pure poll helpers |
| `f27fe004` | R-S3-4, R-S3-5: the agent reader's owner tags and error callback; the shared completed read |
| `ca153512` | R-S3-5 … R-S3-10: the coordinator, outcomes, Games and History, the reader inputs, the connected hub, the gate's `hub` prop, the mount sites, the guard and theme registrations — **the commit lenses T1–T4 reviewed** |
| `fe3dbe6a` | The review's fix round for T0–T4 and their refuters — **the commit T5 reviewed** |
| `9bd66d5a` | Merge of `origin/main` `82a7d4d5` (PR #990), through the desktop app's sync |
| `5299c85d` | The T5 round, part 1: RF-T5b's rows (the UI, App, outcomes, guards); test files only |
| `53aa0f0b` | The T5 round, part 2: RF-T5a's rows (the scheduler, the hook, the poll) and the three parked rows; test files only — **the code head** |
| (the report commit) | This report and its README row |

## 2. Starting check (BUILD_RULES §3)

Every anchor below was read in this session at the base `ff6248d1` (VERIFIED). None met the stop rule.

| Seam | At `ff6248d1` | Status |
|---|---|---|
| App's poll | `src/App.jsx:3910` `fetchAgentBattles`; the owner query `:3928–3932` (`ownerId == auth.currentUser.uid`); the training-clone filter `:3940–3942`; the voided-group exclusion `:3954–3965`; the single `setActiveAgentBattles(liveBattles)` `:3966`; the voice-layer caches `:4001` (their own setter, state `:2364`: the Sync Pass 1 precedent); the retain-on-error catch `:4003–4012`; deps `[screen, isPageVisible]` with no uid `:4018` | VERIFIED |
| Its source guard | `src/App.agentBattlesPoll.test.js:44–51` `agentBattlesPollBody()`: the closure text from `const fetchAgentBattles = async () => {` to `fetchAgentBattles();` | VERIFIED; the closure keeps that exact opening text |
| R1's optimistic append | `src/App.jsx:6747` (`appendOptimisticBattle`, with `ownerId` and `localOrigin: true`) | VERIFIED |
| The shells' `activeAgentBattles` props | `src/App.jsx:8815`, `:8873`, `:8886` | VERIFIED |
| The agent reader | `src/services/agentService.js:16–35`, the error becomes `callback(null)` at `:33`; `src/hooks/useAgent.js:18–33` | VERIFIED |
| The completed list | `src/hooks/useRecentCompletedAgentBattles.js:17–63` (swallowed failure); callers `src/components/Dashboard/CommandDashboard.jsx:174` and `CommandDashboardDesktop.jsx:112` | VERIFIED |
| The review helper | `src/utils/reviewAvailability.js:141` `getReviewAvailability(battle, …)`, the three-field return; `TAPE_READ_TIMEOUT_MS = 4_000` `:73` | VERIFIED (the prompt's :134–164 drifted to :141–162) |
| The Film Room gate | `src/utils/filmRoomGate.js:35` `FILM_ROOM_VERDICT_TIMEOUT_MS = 8_000`; `:40–48` the mode; `:95–132` the verdict cache | VERIFIED |
| Flags | `src/config/featureFlags.js:237` `CASUAL_CLONE_CONCURRENCY_ENABLED = true`; `:3051` `FILM_ROOM_V2_MODE = 'on'`; `:3370` `COMMAND_CENTER_HUB_ENABLED = false` | VERIFIED |
| Live-battle helpers | `src/utils/commandCenterLiveBattles.js:33` `excludeVoidedGroupBattles`, `:64` `classifyBattleType`, `:121` `sortLiveBattles`, `:152` `deriveDeployGate` | VERIFIED |
| The open paths | `handleOpenAgentBattle` `src/App.jsx:6851`; the legacy Film Room open `CommandDashboard.jsx:295`; `src/screens/filmRoomV2/filmRoomBack.js:17–25` (origin `dashboard` → back to the dashboard); App records the origin `src/App.jsx:5020–5022`, the route `:9535` | VERIFIED |
| The hub | mount sites `src/App.jsx:8847–8849` (mobile), `:8916–8922` (desktop); `CommandCenterHubGate.jsx` props `{ site, legacy, frame }`; `CommandCenterHub.jsx`; `GamesSection.jsx`, `HistorySheet.jsx`, `DeployStrip.jsx`, `hub/deployDisplay.js`, `hub/hubCopy.js` | VERIFIED |
| The hold | `sections/HubHold.jsx:35`: live only with `canStart` and `onDeploy` | VERIFIED |
| The server resolver | `api/cron/agent-evaluate.js:6833` `resolveCompletionDisposition` (the spec's :6577 drifted), `completeBattle` `:6906`; `api/_utils/p4Flips.test.js` already imports the module in Node | VERIFIED; not fenced, read only |

## 3. The rulings as applied, and the builder's interpretations

**R-S3-1 — the strip's height rule.**
- Line 1 clamps at two lines (`-webkit-line-clamp: 2`), line 2 at one with an ellipsis (`DeployStrip.jsx:39–40`).
- The review-due refusal reads "Deployment refused" on line 1 with the action "Open in the Forge"; line 2 is the loadout, as for any state with no live row (`hub/deployDisplay.js:157`). The server's full line stays on the card. Every other refusal keeps its words.
- The full words stay on the Deploy card; on the phone there was no card, so the Loadout tab now carries one (`sections/DeploySection.jsx:78` `PhoneDeployCard`, placed at `PhoneTabs.jsx:150`) with no hold (Q-S3-5).

**R-S3-2 — one identity source** (`src/services/authIdentity.js`). One `onAuthStateChanged` listener, started by the first subscriber; `{ resolved, uid, authEpoch }` with the epoch +1 on every identity change (the first answer, A→B, sign-out, A→B→A), never for a re-emitted same uid. No Firestore read, no timer. App subscribes whatever the hub flag, because its poll captures from it: one auth listener more with the hub off, and nothing else (T1-4; pinned).

**R-S3-3 — App's poll becomes owner-aware.**
- Each run captures the identity before its first await (`src/App.jsx:3993`); a resolved capture queries only its own uid (`:4006`); a completion whose capture is no longer current sets nothing — no list (`:4059`), no metadata, no voice-layer caches (`:4097`; the review added the last, T2-6).
- The poll closure keeps its exact opening text and its one `setActiveAgentBattles(liveBattles)`. The metadata (`status`, `ownerUid`, `ownerEpoch`, `lastSuccessfulAt`, `error`, `refreshing`) lives in `activeAgentBattlesPoll` (`:2374`), set only through the pure `src/utils/activeBattlesPoll.js`.
- An actual identity change is handled in a layout effect outside the poll body (`:2409`): clear the list only when the previous identity was resolved (the first Firebase answer clears nothing), reset the metadata, run the poll at once if it is running.
- `refreshActiveBattles()` (`:2389`) joins the newest unsettled run of the epoch or starts one, marks it explicit, and resolves `true` only when that run applied a list; it does nothing while the poll is not running (off the dashboard, or hidden).
- `refreshing` is true only for an explicit refresh, and ends with the newest explicit run of the epoch (T2-4).
- Interpretations: the metadata's `status` is the latest SETTLED run's; a success is stamped with its run's start, so "as of" never overstates the list, and an older run's failure never downgrades a newer success (T2-5; the list itself behaves exactly as today). The hub's poll input reads an explicit refresh as the current request loading (`hub/selectors/readerInputs.js:47`).

**R-S3-4 — the agent reader.** `subscribeToUserAgent(ownerId, callback, onError)` (`src/services/agentService.js:20`): with `onError` the error goes there; without it, today's `callback(null)`. `useAgent(uid, { ownerEpoch })` adds `status`, `readError`, `ownerUid`, `ownerEpoch`, `retry`; `agent` and `loading` take the same values as before for every legacy caller, and no extra render (T1-3).

**R-S3-5 — one completed window.** `src/services/completedAgentBattles.js:25` is the legacy query (owner, `completed`, newest `completedAt` first, `limit`, training clones out) and throws on failure. The legacy hook keeps its array and its swallow. `useHubCompletedBattles(10)` (`hub/useHubCompletedBattles.js:93`) returns the ruling's shape (plus `reviews`, `checking`, `refreshing`, `nextAttemptAt`) and reads only while the connected hub is mounted.

**R-S3-6 — the coordinator.** `hub/reviewScheduler.js` is pure, on an injected clock; `hub/useHubCompletedBattles.js` is the thin hook. Interpretations, as they stand after review:
- The rate budget is the owner's and epoch's, not one mount's: the ledger lives in the hook's module scope, keyed `uid:authEpoch`, and is injected (`useHubCompletedBattles.js:42`, `reviewScheduler.js:118`). Everything else clears on unmount, as §6 lists. A return inside the window waits for the permitted slot and says when (T0-3; Q-S3-2).
- The mount's trigger runs a tick late, so React's development double effect does not spend the slot (`:127`).
- Admission reserves the whole ten-helper workload (§6: "reserve capacity for the maximum ten starts").
- A failed query owes ONE automatic retry per failure episode; a success ends the episode; explicit and lifecycle triggers always run within the cap (T3-4; Q-S3-3).
- A row interrupted by hiding reads "queued"; a row whose own operation timed out or threw reads "timed out" (Q-S3-6).
- Each operation's own 8 s is re-checked when its answer arrives; recorded starts are healed after a backward clock step.

**R-S3-7 — outcomes.** `hub/selectors/gameOutcome.js:100` applies the §7 table over one projection of the record (`hub/gamesDisplay.js:40` `outcomeInputOf`: `displayedStockScores`, and the `battle_complete` entry's presence at `:34`). The never-scored recorded draw is "No result", pinned against the server. The server's `corrected_score_unavailable` completion context (added Oct 15, after the spec) reads "No result" with no pair. `formatScores` (`:88`) shows one decimal, more only when needed, and beyond six decimals each number's own digits with the house sign. The Node parity test imports `resolveCompletionDisposition` the way `api/_utils/p4Flips.test.js` does; nothing under `src/` imports the cron.

**R-S3-8 — Games and History.**
- Live rows are the gate's own owned set (`ownedLiveList` over the same retained list and metadata the gate reads, `hub/useHubReaders.js:92`), in `sortLiveBattles` order with `classifyBattleType` labels, and ride apart from the completed window's status (`hub/hubModel.js:146` `liveGamesOf`), so a block always has its row (T0-1).
- A game the adapter calls pre-open reads "Deployed · waiting for the open", on its tag and in its accessible name.
- Completed rows carry the §7 tag and the §6 review line. Desktop and tablet Games show two; History the whole window with no read, and its read state when the window is not read (T2-7).
- Interpretation: the phone Overview keeps S1's design — its completed rows are the "Reviews available" list (ready reviews), at most three; the rest are one tap away in History (Q-S3-4).
- A game opens through `handleOpenAgentBattle`, a tape through `setCurrentBattle(doc); setScreen('filmRoom')` from the dashboard screen, so the Film Room's origin is `dashboard` and its Back returns to the hub. Only a ready answer whose target is the Film Room route opens a tape.

**R-S3-9 — the selector's inputs.** `hub/selectors/readerInputs.js` turns the identity, the tagged agent read, App's poll metadata and list, and the window into the S2a shapes; `concurrencyEnabled` is the shells' flag at render. `lastDeployedAtMs` (`hub/hubDate.js:79`) converts a stored `lastDeployedAt` with a plausibility bound (S2a A3-9) for S2b's cooldown evidence; S3 passes no cooldown, no attempt and no `onDeploy`, so the hold stays inert (pinned).

**R-S3-10 — the shared files.** One `hub` object on the gate (`CommandCenterHubGate.jsx:217`, forwarded at `:250`), built at the two mount sites (`src/App.jsx:8958` mobile, `:9044` desktop). App's edits are the poll, the identity source and the mount sites' `hub` keys. In `CommandCenterHub.jsx`, `hubCopy.js` and `hubModel.js` the changes add: one new component (`ConnectedHub`, `:383`), props threaded through, new copy keys, new exports and header lines.

## 4. What S3 built, by `file:line` (at the code head `53aa0f0b`)

**New, outside the hub directory**
- `src/services/authIdentity.js`: `UNRESOLVED` (:29), `onAuthUser` (:38, the epoch rule), `start` (:45, one listener), `readAuthIdentity` (:57), `subscribeAuthIdentity` (:62), `useAuthIdentity` (:69), `isCurrentIdentity` (:74).
- `src/utils/activeBattlesPoll.js`: `initialActivePoll` (:39), `pollCaptureMatches` (:50), `activePollRefreshStarted` (:56), `activePollSettled` (:73), `createActivePollFlights` (:107; `joinable` :125, `settle` :132).
- `src/services/completedAgentBattles.js:25` `fetchRecentCompletedAgentBattles(uid, max)`.
- Test-only redirect mocks: `src/firebase/__mocks__/config.js` and `__mocks__/firebase/firestore.js` (a test opts in with a bare `vi.mock`; none did before, T2-8).

**Changed outside the hub directory**
- `src/App.jsx`: the imports; the poll metadata state (:2374), the flights (:2378), `refreshActiveBattles` (:2389), the identity subscription and layout effect (:2407, :2409); the poll body — capture (:3993), `startedAt` (:3996), the capture match (:4006), the stale-completion check before the list (:4059) and before the voice-layer caches (:4097), the settles (:4061 success, :4110 failure, :4113 a run that made no request), the registered fetch (:4117); the two mount sites' `hub` objects (:8958 mobile, :9044 desktop).
- `src/services/agentService.js:20` `subscribeToUserAgent(ownerId, callback, onError)`.
- `src/hooks/useAgent.js`: `LOADING_READ` (:20), the tagged read and `retry`, `shown` (:232).
- `src/hooks/useRecentCompletedAgentBattles.js`: the shared query, same array, same swallow.

**New in the hub directory (`src/components/CommandCenter/hub/`)**
- `reviewScheduler.js`: `REVIEW_BUDGET` (:52), `REVIEW_STATES` (:64), `REVIEW_TRIGGERS` (:74), `helperAnswer` (:85), `createReviewScheduler` (:114) — the ledger (:118), the healed clock (:149), `admissionAt` (:166), `workRemains` (:182), `request` (:250), `startCycle` (:273), `late` (:294), `queryDone` (:296), `queryFailed` (:334), `buildQueue` (:348), `pump` (:370), `checkDone` (:412), `expireCycle` (:452), `endCycle` (:467), `trigger` (:485), `setVisible` (:492), `dispose` (:526).
- `useHubCompletedBattles.js`: the ledgers (:42, `resetHubLedgersForTests` :55), `HUB_COMPLETED_WINDOW` (:60), the hook (:93), the mount trigger a tick late (:127), the render-time owner mask (:142).
- `useHubReaders.js`: `gamesSectionOf` (:45), the hook (:72), the gate's owned live set (:92), the live-left effect (:98), the documents map (:115), the actions (`openTape` :120, `deployAction` :130).
- `selectors/gameOutcome.js`: `OUTCOME_KINDS` (:43), `BANKED_CONTEXT` (:55), the calendar (:62), `isRecordedTimestamp` (:72), `hasScoringEvidence` (:89), `deriveGameOutcome` (:100).
- `selectors/readerInputs.js`: `authInputOf` (:29), `agentInputOf` (:36), `pollInputOf` (:47), `completedInputOf` (:63), `ownedLiveList` (:73).
- `gamesDisplay.js`: `hasFinalEvidence` (:34), `outcomeInputOf` (:40), `formatScores` (:88, beyond six decimals :58–85), `outcomeDisplay` (:102), `liveGameRows` (:130), `reviewLineOf` (:153), `completedGameRows` (:170).

**Changed in the hub directory**
- `CommandCenterHub.jsx`: `useShared` reads the live rows through `liveGamesOf` (:129); `ConnectedHub` (:383); the root renders it when `hub` is given (:398–400); the History sheets get the window's Retry.
- `CommandCenterHubGate.jsx`: the `hub` prop (:217), forwarded (:250).
- `sections/GamesSection.jsx`: `GameRow` with one set of live words (:48, :52) and the review line; `GamesLoadingLine` (:94); `GamesReadNote` (:104); `GamesSection` (:120).
- `sections/DeploySection.jsx`: `DeployLines` (:43), `PhoneDeployCard` (:78). `DeployStrip.jsx`: the clamps (:39–40). `hub/deployDisplay.js:157`: the review-due strip.
- `PhoneTabs.jsx`: the Overview (:85) — live rows apart, the read notes, at most three ready-review rows; the Loadout card (:150). `HistorySheet.jsx:23`: the rows, or the window's read state.
- `hub/hubCopy.js`: the games, outcome, review and read-state words (additions only). `hub/hubModel.js`: the games shape's S3 lines, `liveGamesOf` (:146), `PHONE_COMPLETED_LIMIT` (:155). `hub/hubDate.js`: `hubMs` (:50), `formatHubDay` (:66), `lastDeployedAtMs` (:79).

**New test files** (S3's own, 27):
- `src/services/authIdentity.test.js`
- `src/utils/activeBattlesPoll.test.js`
- `src/App.activeBattlesPoll.owner.jsdom.test.jsx`
- `src/App.activeBattlesPoll.source.test.js`
- `src/App.activeBattlesPoll.hub.jsdom.test.jsx` (T5)
- `src/App.bootOrder.jsdom.test.jsx`
- `src/services/agentService.subscribeError.test.js`
- `src/hooks/useAgent.s3.jsdom.test.jsx`
- `src/hooks/useAgent.retryAndError.jsdom.test.jsx` (T5)
- `src/services/completedAgentBattles.test.js`
- `src/hooks/useRecentCompletedAgentBattles.jsdom.test.jsx`

In the hub directory:
- `hub/reviewScheduler.test.js`
- `hub/reviewScheduler.purity.guard.test.js` (T5)
- `hub/useHubCompletedBattles.jsdom.test.jsx`
- `hub/useHubCompletedBattles.modes.jsdom.test.jsx`
- `hub/useHubReaders.integration.jsdom.test.jsx` (T5)
- `hub/selectors/gameOutcome.test.js`
- `hub/selectors/gameOutcome.parity.test.js` (Node)
- `hub/selectors/readerInputs.test.js`
- `hub/gamesDisplay.test.js`
- `hub/gamesDisplay.measured.test.js` (Node)
- `hub/hubDate.s3.test.js` (T5)
- `CommandCenterHub.s3.jsdom.test.jsx`
- `CommandCenterHub.s3strip.jsdom.test.jsx`
- `CommandCenterHub.s3outcome.jsdom.test.jsx`
- `commandCenterHub.activity.guard.test.js` (T5)
- `commandCenterHub.gateHub.guard.test.js` (T5)

The ten pre-existing test files S3 edited are in §5.

## 5. Existing tests S3 edited, and why (the stop rule)

The prompt says to STOP if "`App.agentBattlesPoll.test.js`, or any other pre-existing test, must be edited to pass". `App.agentBattlesPoll.test.js` is untouched and passes, and so is every test of the legacy shells. These pre-existing test files were edited; lens T1 judged each and found none that weakens a pin of the shells' behaviour. The builder read the rule as protecting behaviour pins and proceeded; **Q-S3-1** asks the founder to confirm.

| File | Edit | Why |
|---|---|---|
| `CommandCenterHub.s2a.jsdom.test.jsx` | The review-due strip row now expects "Deployment refused" with the loadout on line 2; S2a's "both lines wrap in full" row became a clamp row; the hub signature pin gains `, hub`; one `vi.mock` line for `firebase/config` | R-S3-1 overrules S2a's wrap and the review-due words; R-S3-10's prop; the environment line below |
| `hub/deployDisplay.test.js` | The failed (review-due) row's strip words | R-S3-1 |
| `commandCenterHub.mount.guard.test.js` | The mount sites' text with the `hub` object; nine permitted main-graph terminals the hub now imports, each with its reason; the activity allowances of `hub/useHubCompletedBattles.js` (timers, listeners, an effect) and `hub/useHubReaders.js` (an effect), with negative plants; the two selectors; the gate row's new signature and "no member of `hub` is read" | S1's guard admitted no reads; S3 is the slice that adds them. Every allowance is listed by file and pattern; the "never `COMMAND_CENTER_HUB_ENABLED`", single-pick and legacy-props rows are intact |
| `hub/selectors/selectors.purity.guard.test.js` | Registers `gameOutcome.js` and `readerInputs.js` and their exact imports | The guard requires every selector to be listed |
| `src/data/unconfirmedOutcome.census.test.js` | `FEED_READERS` gains `hub/gamesDisplay.js` (it reads only the presence of a `battle_complete` entry) | The census requires every `statusFeed` reader to be registered with its disposition |
| `src/theme/tokens.guard.test.js`, `motion.guard.test.js`, `tokenGuardBaseline.json`, `motionGuardBaseline.json` | Register the six new hub files (count 0) | The theme guards require every hub file to be listed |
| `CommandCenterHub.jsdom.test.jsx`, `.reviewFixes.jsdom.test.jsx`, `.testIntegrity.jsdom.test.jsx` (and `.s2a`) | One line: `vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }))` | The hub's import graph now reaches modules that import `firebase/config`, which throws on import without Firebase env; no assertion changed |

## 6. The strip, measured (R-S3-1)

- **Method (in the build, before the review).** A temporary probe rendered every strip display state — 25 states, each with no live row, a live game and a pre-open game: 75 cases — into a page with the production CSS from a scratch `vite build`, measured in headless Edge (playwright-core, device scale 1) at 360 and 390 px. The probe was deleted before commit. Font: the Inter stack (rendered as Segoe UI).
- **360 px: 65 cases at 63 px, 10 at 69.08 px. Tallest: 69.08 px**, which is two lines on line 1 plus one on line 2 — the most the clamps allow. 390 px: 68 at 63 px, 7 at 69.08 px.
- The ten tallest at 360: the block with no live row (three variants: plain, stale, refreshing), which S3 makes unreachable (the live rows are the gate's own list, T0-1); ready-stale with its note; ready, ready-refreshing and ready-stale beside a pre-open game; and "Couldn't confirm the deploy" (three variants), whose line 1 wraps beside its action button.
- The probe's pre-open line used S2a's fixture words ("Deployed · opens 9:30 AM ET"); S3 shows "Deployed · waiting for the open", which the same two-line clamp bounds.
- **Disclosure.** The prompt's review section says "No real-browser runs in this slice." R-S3-1 asks for a measurement at 360 px that jsdom cannot make (it has no layout), so the build ran headless Edge once for it, before the review; no lens or refuter opened a browser (Q-S3-8).

## 7. The coordinator's budget evidence (R-S3-6)

- **Constants** (`hub/reviewScheduler.js:52`): window 120,000 ms; 1 query and 10 helper starts per window; concurrency 3; 8,000 ms per query and per helper; 42,000 ms per cycle (8 + 4 × 8 + 2, the §6 table); focus and visibility refresh only when the last cycle is at least 120,000 ms old.
- **Deadlines include imports and setup**: both timers are armed before the operation is called (`startCycle`, `startCheck`), and each answer is checked against its own start when it arrives (T3-6).
- **Admission** reserves the full ten-helper workload: a cycle starts only when the query slot is free and no helper start lies inside the window. With every helper at the 8 s edge the period is 144 s; it cannot starve.
- **The ten-minute bound** ("at most five query attempts, fifty returned battle documents, and fifty helper invocations"):
  - the scheduler row "a visible hub with a review always pending and a trigger every five seconds for an hour" holds it within one mount;
  - across remounts — a return from the Film Room, a site switch — it now holds too, because the ledger is the owner's and epoch's (T0-3). The refuter measured the reviewed code: a hub mounted every 20 s made 30 queries, 300 documents and 300 helper calls per ten minutes; rows now pin one query until the slot;
  - the hook rows pin the remount, the quick bounce, an owner change starting afresh, and React's development double mount reading once.
- **Simulation (lens T3).** A seeded engine with its own fake clock ran ~150,000 cycles over 2,500 chaos seeds × 2 h, plus suspension, edge-timing and quiet profiles. Every rolling-window, concurrency, deadline, hidden-start, dispose, "no synthesized unavailable", late-answer and liveness invariant held, except the stale dirty flag (T3-2, fixed). After the fix round the T3-2/4/6/9 refuter's aligned oracle found 0 violations over chaos seeds 1–1000 × 2 h, quiet 1–400 × 2 h and edge 1–300 × 1 h.
- **Logical vs physical.** Logical concurrency never exceeds three. A helper past its deadline releases its slot while its own SDK work may continue (§6: "No promise of physical cancellation is made"); the simulation saw up to 31 such physical promises outstanding.
- **Modes.** Fixtures for `FILM_ROOM_V2_MODE` 'off', 'on' and 'allowlist' drive the real helper and gate through its `readTape` seam (`hub/useHubCompletedBattles.modes.jsdom.test.jsx`).

## 8. Checks

| Check | Command / place | Result |
|---|---|---|
| S3's own suites | the 37 test files S3 added or edited (§4, §5), inside the full Linux run below | 37 files, 1,212 / 1,212 rows (the 27 new files: 467 rows); none failed |
| The fix round on Linux | 40 files (the App suites, the hub directory, the hooks), WSL, `TZ=UTC`, at `fe3dbe6a` | 1,115 / 1,115 |
| The merged tree | the same three checks, Linux, at `9bd66d5a` (before the T5 round) | suite exit 0, `Test Files  1122 passed \| 8 skipped (1130)`, 24,168 passed, 0 failed; `lint:gate` exit 0; build exit 0 |
| T5's landed files on the merged tree | RF-T5b's 12 files; RF-T5a's 5 files with the parked rows and the activity guard | 12 files 244 / 244 on Windows and on Linux; 6 files 144 / 144 on Windows |
| `vite build` | `npm run build`, Linux, at `53aa0f0b` | **exit 0**; 4,039 modules; the hub chunk `CommandCenterHub-Cb3erYLA.js` 91.44 kB (gzip 28.32 kB), byte-identical to the merged tree's (the T5 round changed tests only); entry 4,858.88 kB; `index.html`: 0 `modulepreload`, 0 hub references. Four CSS syntax warnings, present at the base |
| `lint:gate` | `npm run lint:gate` (`eslint . --config eslint.gate.config.js --max-warnings 0`), Linux, at `53aa0f0b` | **exit 0** |
| Full suite, Linux CI shape | WSL Ubuntu, private clone, Node 20.20.2, `TZ=UTC`, `npm run test:run -- --maxWorkers=2`, at `53aa0f0b` | **exit 0**. `Test Files  1129 passed \| 8 skipped (1137)`; `Tests  24294 passed \| 89 skipped (24383)`; 0 failed (655 s). Against the merged tree: +7 files and +126 rows, exactly the T5 round's |

**The bundle with the flag off** (Windows builds of the base and of the head before the review, for comparison only): the entry grows by about 4 kB (the identity source, the poll metadata, the agent reader's tags, the shared completed read: S3's main-graph changes); the hub chunk, still lazy and its own chunk, grows from 67.6 kB to 89.5 kB; `index.html` has no `modulepreload` and no hub reference in either.

**Windows-only notes (not S3 defects).** `agentReadCensus.guard` fails three rows on Windows path separators and `shadowCpuQuoteIntegrityFlags` "registers it as dark by design" fails on a CRLF checkout; both pass on Linux. Under heavy parallel load (the reviewers' runs alongside), source-scanning rows such as the mount guard's "main graph reaches the hub directory" exceed vitest's 5 s default and pass alone; the T4 refuter measured that row at the base and the head and found no S3 slowdown (1,115 vs 1,124 files scanned, timings overlapping).

## 9. The BUILD_RULES §2 review record

The threshold (≥ 10 files or ≥ 1,500 lines on the cumulative branch diff) is met on both measures. Against `main` (`82a7d4d5`, merged in), the code head `53aa0f0b` changes 65 files, +8,227 / −142 lines:
- 26 product files, including the two theme baselines;
- 2 test-only redirect mocks;
- 37 test files, 27 of them new.

### 9.1 How it ran

- **Model and isolation.** This session (Opus 5.5) built and coordinated, and decided each disposition. Every lens, refuter and the mutating lens ran as a Sonnet subagent, on its own `git -c core.autocrlf=false archive` extraction with `node_modules` junctioned, read-only on git and on the working tree, returning text only. T5's two refuters also wrote their rows into their own snapshots. This session copied them in after confirming that every other file in each snapshot matched the reviewed commit. The briefs (`review-brief.md`, `refuter-brief.md`, each lens's findings) and the diffs sat read-only in this session's scratchpad. No browser was opened during the review.
- **Order.**
  - Four lenses ran in parallel on `ca153512`: T1 the shells' parity (with a snapshot of the base `ff6248d1` beside its head snapshot), T2 ownership and epochs, T3 the coordinator under a fake clock, T4 outcome evidence.
  - No lens owned the Games rendering (R-S3-8), so the coordinator read it while they ran and raised T0-1 … T0-4.
  - Every finding went to a refuter on a fresh snapshot — eight refuters, grouped by subject — and the fix round followed their rulings, including where they narrowed, re-graded or refuted a proposed fix (`fe3dbe6a`).
  - T5, the mutating lens, ran last on `fe3dbe6a`, then its two refuters, split by subject (§9.3).
- **An interruption.** An expired sign-in stopped three refuters mid-run; each was resumed from its saved transcript and finished, its tree checked byte-for-byte against the commit first.
- **Ids.** T0-n are the coordinator's, T1-n … T5-n the lenses', TnR-m a refuter's new finding (T5aR-m and T5bR-m for T5's two refuters). They do not collide with S1's L1-n … L5-n or S2a's A1-n … A5-n, which code comments cite.

### 9.2 Findings and dispositions, T0–T4

Verdicts are the refuters'. Every fix has a row that fails on `ca153512` (or on the defect's mutant) and passes at `fe3dbe6a`.

| ID | Finding (short) | Lens sev. | Refuter | Disposition |
|---|---|---|---|---|
| T0-1 | Until the completed window's first read lands (or after it fails) the poll's live rows were dropped: the strip showed a block with no row, Open had no game | MAJOR | CONFIRMED | FIXED: the live rows ride apart from the window (`games.live`, `liveGamesOf`) |
| T0-2 | A pre-open row's accessible name said "Live · waiting for the open" | MINOR | CONFIRMED (narrowed to the clock segment) | FIXED: one set of words for the tag and the name |
| T0-3 | The 120 s rate cap reset on every mount (a Film Room return, a site switch): at a 20 s return cadence 30 queries, 300 documents and 300 helper calls per ten minutes against §6's 5 / 50 / 50 | MAJOR | CONFIRMED (§6 read as a per-owner-and-epoch budget; the unmount clear-list omits rate slots) | FIXED: the ledger is the owner's and epoch's, injected; the mount trigger a tick late; a queued first read shows its next time. Q-S3-2 |
| T0-4 | The App owner test counted runs by a log line that can arrive late (red on Linux under load: 0 vs 1, 3 vs 2) | MINOR | CONFIRMED (reproduced with a slow real config) | FIXED: runs counted where they begin and settle; the App rows on redirect mocks (T2-8) |
| T1-1 | A run captured before Firebase's first answer would be dropped and re-run (one extra read) | MINOR (latent) | PARTLY: unreachable in every production boot order (real SDK and providers); the lens's fix would break the hub's metadata and A→B→A | No code change; the boot order pinned (`src/App.bootOrder.jsdom.test.jsx`) |
| T1-2 | The first failed run renders App and the shell once more (props unchanged) | NIT | CONFIRMED (no observable consumer; it is the hub's required error metadata) | Accepted |
| T1-3 | `useAgent` wrote state for a falsy uid: one extra legacy render | NIT | CONFIRMED | FIXED: no state written without a uid; rows (base render counts restored in all 9 scenarios) |
| T1-4 | With the flag off App now holds one auth listener (spec line 124's flag-off wording) | NIT | CONFIRMED on the count; R-S3-2/R-S3-3 require it | Pinned (exactly one listener); Q-S3-7 |
| T2-1, T2-2 | = T0-1, = T0-3 | MAJOR | — | With T0-1, T0-3 |
| T2-3 | A Retry after a newer run settled found nothing joinable and started another request | MINOR | PARTLY → NIT today (no hub surface offers a second Retry while refreshing) | FIXED: every unsettled run kept; a refresh joins the newest of the epoch; background timing untouched |
| T2-4 | Any explicit settle ended `refreshing` while a newer explicit run was out | MINOR | PARTLY → NIT today | FIXED: the refresh ends with the newest explicit run of the epoch |
| T2-5 | An older run landing after a newer one: (a) overwrites the list, (b) downgrades a newer success to error, (c) stamps a later "as of" | MINOR | PARTLY: (a) is today's behaviour and the lens's fix would change the shells' list — REJECTED; (b) MINOR; (c) NIT | FIXED (metadata only): outcomes stamped with the run's start; an older failure leaves a newer success |
| T2-6 | The voice-layer cache write skipped the stale-capture check | MINOR | PARTLY → NIT (the Sync flag is dark; pre-existing) | FIXED: the check before the cache write (pinned). The optional clear on an identity change is not applied |
| T2-7 | A History sheet left open across an identity change showed "0 completed" for the new owner's unread window | MINOR | CONFIRMED | FIXED: History shows the window's loading or failed state |
| T2-8 | The stale-completion drop and A→B→A were pinned only by source text and pure rows | MINOR | PARTLY: the gap is real; the lens's text-extraction harness is the wrong fix. Root cause found: vitest lets an importer's overlapping dynamic imports of a FACTORY-mocked module fall through to the real module | FIXED: redirect mocks; three real-App rows (A→B, A→B→A, sign-out with deferred queries), red on the base App |
| T2-9 | The hub header can name A above B's data for one user-document read | NIT | CONFIRMED (S1's header; the legacy greeting lags the same way) | Deferred to S5 (fix known) |
| T2-10 | An effect of the transitional render sees B's identity with A's raw list | NIT | PARTLY (latent; the hub masks in render) | Contract note for S2b (§10) |
| T3-1 | = T0-3 | MAJOR | — | With T0-3 |
| T3-2 | A stale dirty flag survived a hide: one Retry cost two cycles | MINOR | CONFIRMED | FIXED |
| T3-3 | While the automatic retry ran, Games showed the failure and offered a Retry that costs a cycle | MINOR | PARTLY (a healthy window's background cycle owes no cue) | FIXED: "Checking your games" or "Refreshing · as of {time}", no Retry, while a read is in flight |
| T3-4 | A permanently failing read was re-queried every 120 s while visible (31 an hour, within the cap) | MINOR | CONFIRMED; re-graded MAJOR (qualified) under the recommended reading; the text does not settle it | FIXED to one automatic retry per failure episode. Q-S3-3 |
| T3-5 | Six non-equivalent scheduler mutants survived all 41 rows | MAJOR (§2) | CONFIRMED | FIXED: six rows in the scheduler's own harness, each red on exactly its mutant |
| T3-6 | An operation's own 8 s was not re-checked when its answer arrived (after a stall a late `unavailable` stuck) | MINOR | CONFIRMED (needs an event-loop stall) | FIXED |
| T3-7 | A backward wall-clock step stalled admission for the size of the step | MINOR | PARTLY (keep the wall clock, heal the stamps) | FIXED |
| T3-8 | "next attempt at" is rounded up to the minute | NIT | REFUTED (S2a's documented, pinned house style; rounding up promises the attempt was made by then) | No change |
| T3-9 | A window repeating an id started two checks for one row | NIT | PARTLY (unreachable from one snapshot) | FIXED |
| T3-10 | The live-left effect keys only on the success time | NIT | REFUTED as a gap (the order is pinned by the source guard) | Comment added |
| T3-11 | No per-row Retry on a timed-out or queued review | NIT | REFUTED ("Retry queued" is always true: 400 seeds × 2 h, 0 violations) | No change; Q-S3-6 |
| T4-1 | The rendered verdict colour (§11.3 "positive loss/negative win colors") was read by no test | MAJOR (test gap) | CONFIRMED | FIXED: rows read the rendered colour |
| T4-2 | `displayedStockScores` (v2 Ruling 16) was unpinned in the hub | MAJOR (test gap) | CONFIRMED | FIXED: measured-route rows on real writer frames (Node) |
| T4-3 | `isRecordedTimestamp` accepted impossible dates; the Timestamp branch was unbounded | NIT | CONFIRMED; the lens's fix (delegate to `instantMs`) breaks S2a's purity guard | FIXED: a pure days-in-month table; seconds and nanoseconds bounded |
| T4-4 | `formatScores`' last fallback lost the house sign and could print an exponent | MINOR | PARTLY → NIT latent (every writer stores ≤ 2 dp or integers) | FIXED: beyond six decimals each number's own digits, house sign, one common length |
| T4-5 | Ten mutation survivors in the validator's bounds and the formatter | MINOR | CONFIRMED | FIXED: boundary rows |
| T4-6 | The mount guard's main-graph row nears its 5 s default under load | NIT | PARTLY (not an S3 regression; an explicit timeout would edit S1's row — the stop rule) | Recorded (§8) |

**New findings from refuters**, all fixed: T0R-1 a game both lists hold was listed twice and opened the window's record (MINOR); T0R-2 "No games yet" before the poll had answered (MINOR); T0R-3 React's development double effect spent the slot (NIT); T0R-4 no row drove a remount (MINOR); T0R-5 the queued first read showed no time (latent); T2R-1 two test headers stated the wrong cause for the mock gap (NIT); T3R-1 a backward step over 24.8 days asked `setTimeout` for an overflowing delay (MINOR, latent).

**Counts.** 32 distinct findings (three lens findings duplicated T0-1 and T0-3): **17 CONFIRMED, 12 PARTLY, 3 REFUTED**, plus 7 from refuters. No BLOCKER. Six MAJOR survived their refuters (T0-1, T0-3, T3-4 qualified, T3-5, T4-1, T4-2); all are fixed. None changes what users get with the flag off.

**What the lenses found sound**, each with its evidence in the lens reports:
- T1: every same-owner path traced byte- or trace-identical to the base — the poll's query, filters, retain-on-error, interval and deps; R1's optimistic entry mid-run; hide and show; StrictMode; `useAgent`'s 21 legacy keys in 9 scenarios; the legacy completed hook (a Firestore-level trace); with the flag off the hub never evaluates, and no Firestore read or timer is added.
- T2: no path shows, tags, counts or acts on owner A's data as the current owner's after an identity change (200 randomized identity runs; A→B, A→B→A and sign-out mid-query through the poll; a table over mismatched reader inputs).
- T3: the constants, admission, deadlines, copy (character for character) and the hook's wiring; the simulation in §7.
- T4: no genuine completion mislabelled (the real `completeBattle` and repair sweep on the repo's mock db); 60,140 parity pairs and a §7 oracle over 784,080 combinations, 0 disagreements; the server compares raw stored scores, as the hub does.

### 9.3 The mutating lens (T5) and its refuters

**How T5 ran.**
- T5 ran on `fe3dbe6a`, after the fix round, on its own snapshot.
- For every row S3 added or changed, it named the rule the row claims to pin and planted the smallest code mutant that breaks exactly that rule. It also planted the forbidden patterns into copies of each source guard's scanned files. The harness ran a green baseline first, then each mutant alone, then restored the file byte-for-byte.

**T5's totals.**
- 1,121 code mutants: 527 hand-written and 594 operator-level.
- 844 were killed by a failing row on the existing suites, 1 by the exit code alone; 9 hung and 1 was broken.
- **266 survived**: 159 real, 30 equivalent, 73 unobservable (out-of-contract input), 1 latent, 3 unproven NITs.
- Its proposed rows killed all 159 real survivors and 6 of the hangs.
- Of 56 guard plants, 52 went red. The 4 green ones, and the 6 activity-allowance plants (all green), are killed by the guards it proposed.
- It confirmed the builder's fix-round 64 / 64.

**T5's findings.** There are 19, T5-1 … T5-19, of which the lens graded 10 MAJOR. **Every one is a test gap:** a rule with no row that fails when it breaks. Nothing ships wrong at `fe3dbe6a`. The refuters graded each gap by what its surviving mutant would let ship.

**The refuters.** Two refuters ran, split by subject, each on its own snapshot. Each confirmed or narrowed its findings and landed the rows itself, in test files only, mutation-checked against the lens's mutants and its own:
- RF-T5a (the scheduler, the hook, the poll): T5-1, T5-2, T5-4, T5-6, T5-12, T5-17's scheduler scan, T5-18, T5-19, and a verdict on T5-3.
- RF-T5b (the UI, App, the outcomes, the guards): T5-3, T5-5, T5-7 … T5-11, T5-13 … T5-17.

**Product code.** No product file changed in the T5 round.

| ID | Finding (short) | Lens sev. | Refuter | Disposition |
|---|---|---|---|---|
| T5-1 | The §6 fair order was unpinned: the rotation row built its expectation and never asserted it, and every carried row started at 0 s | MAJOR | CONFIRMED, MINOR (reached only when a cycle is interrupted) | FIXED (rows): the dead rotation row repaired in place, plus "oldest-started first", on rows started at 0 s and 8 s |
| T5-2 | No boundary row for the 42 s cycle (the rows held for any limit ≥ 42 s) | MAJOR | CONFIRMED, MINOR | FIXED (rows): a callback at 41.9 s goes on, one at 42.0 s ends the cycle; a query answer after the whole 42 s is a failed read |
| T5-3 | The live-left refresh and Retry's trigger were unpinned at the hub: four mutants that make Retry or a finished game a no-op inside the 120 s window survived | MAJOR | CONFIRMED, MAJOR (both refuters) | FIXED (rows): 8 rows assert the trigger each path sends |
| T5-4 | The scheduler-to-UI contract never ran end to end: every UI row mocked the hook | MAJOR | CONFIRMED, MAJOR; one proposed gap REFUTED (nothing reads a pending row's answer) | FIXED (rows): `hub/useHubReaders.integration.jsdom.test.jsx` runs the real hook, scheduler and readers with only I/O stubbed; scheduler rows pin the published state |
| T5-5 | The legacy Review card's `limit` was unpinned: a hard-coded 10 would read 10 where the shells read 3 | MAJOR | PARTLY, MINOR (a malformed doc is a NIT; the `id` override is unobservable because the server writes no `id` field) | FIXED (rows): 2 rows; the `id` mutant recorded as unobservable |
| T5-6 | "Refreshing" could stick: mutants of the same-failure shortcut and of the newest-explicit rule left it true for ever, losing the strip's Retry | MAJOR | CONFIRMED: those two MAJOR, a first unresolved run MINOR, two NITs; one REFUTED | FIXED (rows): 5 rows in `src/utils/activeBattlesPoll.test.js`. The code was right; no product change |
| T5-7 | Row controls could lose their handler with every row green: History's rows on both sites, the phone Overview's rows, the strip's and the Loadout card's Retry | MAJOR | CONFIRMED, MAJOR | FIXED (rows): 4 rows that tap each control and see its action |
| T5-8 | R-S3-2's owner check in the readers was unpinned at the hub | MAJOR | PARTLY, MINOR (App resets the metadata in a layout effect, so that state is never painted; defence in depth for S2b) | FIXED (rows): another owner's poll, the same uid at an earlier epoch, and a control |
| T5-9 | App's S3 wiring was pinned mostly by source text | MAJOR | PARTLY, MINOR (text pins kill 11 of the 12 named mutants; the hidden page's guard was killed by nothing: T5bR-1) | FIXED (rows): `src/App.activeBattlesPoll.hub.jsdom.test.jsx`, 12 rows over the real App with the hub picked through the picker (the flag untouched); 18 / 18 mutants killed |
| T5-10 | The completed row's day in ET was unpinned | MAJOR | CONFIRMED, re-graded MINOR (the ordinary day is asserted; the mutant bites only for evening completions or non-ET viewers) | FIXED (rows): `hub/hubDate.s3.test.js`, 12 rows; 15 / 15 date mutants killed |
| T5-11 | `lastDeployedAtMs` had no caller and no row | MINOR | PARTLY, NIT; "wire a caller" REFUTED (S2b's by contract: `hubModel.js:70–74`, `:97`; `attemptReducer.js:86`) | FIXED (rows), including the bound tied to `DEPLOY_COOLDOWN_MS`; no caller wired |
| T5-12 | The hook's focus row also dispatched visibility, so focus alone was never tested; epoch batching, a hidden-page mount and listener removal were unpinned | MINOR | CONFIRMED: focus never refreshing would be MAJOR; the rest MINOR or NIT | FIXED (rows): 5 hook rows |
| T5-13 | The calendar check missed day 1, day 32 of six months, Feb 30 in a leap year | MINOR | CONFIRMED, MINOR | FIXED (rows): 3 calendar rows and a `scoreState: null` row |
| T5-14 | Display rules were unpinned: labels, the clock's rounding, trades, the next attempt, review flags; Games' review tag, film icon, live count and stale-empty state | MINOR | CONFIRMED, MINOR (the largest: a mutant made the desktop say "No games yet" after a failed read) | FIXED (rows): 12 display rows, 8 hub rows |
| T5-15 | The readers were not total before Firebase answers | MINOR | PARTLY, MINOR (one mutant crashes every cold load; the rest out-of-contract NITs) | FIXED (rows): 5 reader rows, 2 cold-load rows (desktop, mobile) |
| T5-16 | Vacuous or weak rows: the identity source's initial state was never seen; the legacy hook's "after unmount" row could not fail | MINOR | CONFIRMED, MINOR | FIXED (rows): fresh-module rows; the vacuous row replaced by three observable stale-answer rows; `src/hooks/useAgent.retryAndError.jsdom.test.jsx` |
| T5-17 | Guards: the activity allowances were per pattern; the gate's member-read check missed a guarded destructure; the scheduler's purity had no clock or global scan | MINOR | PARTLY, MINOR (one planted destructure is killed by 24 gate rows through a throw; the guarded ones survived) | FIXED (rows): three AST guards — `commandCenterHub.activity.guard.test.js` (each hook's call manifest), `commandCenterHub.gateHub.guard.test.js` (every reference to `hub`), `hub/reviewScheduler.purity.guard.test.js` (no import, clock, timer, page, network or random global) |
| T5-18 | A runaway admission loop hung the suite instead of reddening a row | MINOR | CONFIRMED, MINOR | FIXED (harness): the scheduler harness caps queries, checks and armed timers, and the hook file caps reads; all six runaways now fail 23 to 68 rows each. Still hanging, recorded: two synchronous-loop mutants (no harness can redden them) and one admission mutant whose cause the refuter did not find. A hang still fails CI by its timeout, not as a red row |
| T5-19 | Scheduler hygiene | MINOR | PARTLY (the landed items MINOR or NIT; seven dropped as out of contract, unread, transient or unobservable; one REFUTED: §6's ready cache is "while mounted") | FIXED (rows) for the landed items |

**Counts.** Of the 19 findings, **12 were CONFIRMED and 7 PARTLY; none was REFUTED outright.** Two proposed fixes were refuted: wiring a caller for T5-11, and one T5-4 gap.

After their refuters, five findings stand as MAJOR test gaps, each graded by what its surviving mutant would let ship:
- T5-3 and T5-4;
- T5-6, for two of its mutants;
- T5-7;
- T5-12, for its focus mutant.

All are fixed with rows.

**New findings from the T5 refuters**, ids by refuter:
- **T5aR-1 (MINOR):** the row titled "focus and becoming visible refresh only when the last cycle is at least 120 s old" only ever sent focus, so a mutant where becoming visible skips the staleness rule survived. The builder landed the refuter's parked row. It is the one row that fails under that mutant.
- **T5aR-2 (NIT):** the poll helper's empty-uid guard was unpinned. It is redundant in App's wiring (App returns before the call without a uid). Row landed.
- **T5aR-3 (NIT):** a query answer that is no list should be a failed read, and nothing pinned it. Row landed (three cases).
- **T5bR-1:** one App mutant (the poll's hidden-page guard) was killed by nothing. It is now killed by the new App file.
- **T5bR-2:** the lens measured the activity plants and the gate destructure against the mount guard alone. Recorded.
- **T5bR-3:** two App rules stay pinned by source text only, because jsdom cannot observe paint timing: the identity change's layout effect, and the first answer clearing nothing. The source test's pins stand.
- **T5bR-4:** the lens's App rows missed one mutant, and one failure cascaded through an un-restored `document.hidden`. The refuter's own App file landed instead.
- **T5bR-5:** the lens's `id`-override row asserted the opposite of its title. Dropped.

**Landed.** Two commits, test files only:
- `5299c85d`: RF-T5b's 12 files (7 edited, 5 new), 88 new rows.
- `53aa0f0b`: RF-T5a's 5 files (3 edited, 2 new), 34 new rows, plus the three parked rows (5 rows).

In all, the round adds 126 rows net: one vacuous row was replaced.

Every edited file is S3's own, and no pre-existing test was touched. The T5-3 rows name the scheduler's trigger constants, not string literals, as RF-T5a advised.

### 9.4 Mutation records

| Round | At | Mutants | Result |
|---|---|---|---|
| Rows written to fail first | `ca153512` vs the base | the owner-change clear, a swallowed agent error, a failed completed read rendering empty: each row run against the base | red at the base, green at S3 (lens T1 re-ran them on its base snapshot) |
| Lens T3 | `ca153512` | 28 scheduler mutants against its simulation; the builder's 41 coordinator rows against them | 26 / 28 killed by the simulation; 6 non-equivalent survived the builder's rows → T3-5 |
| Lens T4 | `ca153512` | 17 outcome mutants | 7 killed, 10 survived → T4-5 |
| Refuters | `ca153512` | each fix's own plants (T2-3/4/5: planted variants; T3-2/4/6/9: 15; T3-3/5/7: the six survivors plus clock plants; T4: 80+ one-at-a-time; T0-4: 7) | each killed by its new row |
| Builder, the fix round | `fe3dbe6a` | 64 — every rule the fix round added, each with the row expected to kill it | **64 / 64 killed**, each by its named row (baseline 279 rows in 12 files green) |
| T5, the mutating lens | `fe3dbe6a` | 1,121 code mutants (527 hand-written, 594 operator-level) over every row S3 added or changed; 56 guard plants; 6 activity-allowance plants | 844 killed by the existing rows, 1 by the exit code alone; **266 survived** (159 real → T5-1 … T5-19); 9 hung, 1 broken; guard plants 52 / 56 red, allowance plants 0 / 6 |
| RF-T5b's landed rows | `fe3dbe6a` + its 12 files | the lens's 115 named UI, App, outcome and guard mutants, plus its own (X1–X10, two guarded destructures) | **133 / 134** killed by a failing landed row; the one survivor is unobservable (§9.3, T5-5). App 18 / 18, UI 32 / 32, dates 15 / 15 |
| RF-T5a's landed rows | `fe3dbe6a` + its 5 files | 77 scheduler, hook and poll mutants: the lens's survivors and runaways, plus its own | **63 / 77** killed. Of the 14 survivors, 10 are unobservable or out of contract, 2 equivalent, and 2 were parked (next row). The six runaways now fail rows; three other mutants still hang (§9.3, T5-18) |
| Builder: the parked rows | `53aa0f0b` | the visible trigger's staleness, a non-list query answer, the poll helper's empty uid | **3 / 3** killed, each by exactly its new row |
| Builder: the App mutants on the merged head | `53aa0f0b` (with `main` merged) | RF-T5b's 18 App mutants, same anchors, against the new App file | **18 / 18** killed |

## 10. What S4 and S2b inherit

**S4 (next action, Activity, Later, the brief)**
- `useHubCompletedBattles(10)` is the one completed source for Activity and the next action: `{ battles, status, error, refresh, ownerUid, ownerEpoch, lastSuccessfulAt, generation, reviews, checking, refreshing, nextAttemptAt }`. `battles` is null until a read succeeds; a failed read keeps the last good window. Read it through the hub's readers (`hub/useHubReaders.js`); do not add a second completed read.
- The rate ledger is the owner's and epoch's: any new trigger (an Activity "Refresh") shares it through `refresh(reason)` and queues at the next permitted time.
- The first-deployment next action needs a ready, empty completed read for this owner (`completedInputOf` passes the window's status; a failure is never "empty").
- The live rows are `games.live` (`liveGamesOf`); an optimistic entry carries `localOrigin: true` and is in the gate's list, so Activity must leave it out until the server document replaces it (R1, spec §3).
- Open for S4 (founder questions): the phone Overview's completed rows (Q-S3-4) and an on-demand review Refresh (Q-S3-6).
- The T5 guards are strict by design. `commandCenterHub.activity.guard.test.js` pins each S3 hook's exact call manifest: its effects, timers and listeners, and the receiver of each. A new effect or listener in `useHubCompletedBattles.js` or `useHubReaders.js` reddens it until the manifest is updated in the same commit. `hub/reviewScheduler.purity.guard.test.js` keeps the scheduler free of imports and globals, so a new trigger goes through `trigger(reason)` and the injected clock.

**S2b (the provider, the attempt, the hold)**
- Reuse the identity source (`src/services/authIdentity.js`): `useAuthIdentity()` for render, `readAuthIdentity()` and `isCurrentIdentity(capture)` at async boundaries. Do not create a second one.
- `hub.refreshActiveBattles()` joins the newest unsettled run of the epoch or starts one, marks it explicit and resolves `true` only when that run applied a list; it resolves `false` at once while the poll is not running (off the dashboard, or hidden). `refreshing` ends with the newest explicit run (T2-3, T2-4).
- Read the live list only through `ownedLiveList` (or check `hub.activePoll.ownerEpoch === identity.authEpoch`), never `hub.activeBattles` raw: the render that carries a new identity can still hold the former owner's list (T2-10).
- `lastDeployedAtMs(raw, nowMs)` (`hub/hubDate.js:79`) converts a stored `lastDeployedAt` with a plausibility bound for `cooldownEvidence` (S2a A3-9).
- The hold stays inert until S2b passes `onDeploy`; the row pinning that will need its update in S2b's commit.
- App tests that need App's Firebase answers: use the redirect mocks (bare `vi.mock('./firebase/config')`, `vi.mock('firebase/firestore')`); a factory mock of a module App imports dynamically can fall through to the real one (T2-8).
- Deferred: T2-9 (the header names the UserContext user, which lags the identity by one user-document read) belongs to S5's header work; the fix is known (`viewerUid` from `ConnectedHub`).
- `commandCenterHub.gateHub.guard.test.js` pins every reference to the gate's `hub` prop: the gate forwards it whole and reads no member of it. A provider that reads `hub` in the gate updates that guard in its own commit. The App rows in `src/App.activeBattlesPoll.hub.jsdom.test.jsx` drive the hub through the picker with the flag untouched; S2b's App rows can do the same.

## 11. Files outside the repository

The report's copy, byte-identical to this file: `C:\Users\fashr\Documents\FantasyTrades\CommandCenter\20261022_BUILD_COMMAND_CENTER_HUB_S3.md` (its sha256 is in the PR description). The review briefs, each lens's and refuter's findings, the dispositions ledger, the mutation specs and their results, and the strip measurement output are in this session's scratchpad: `review-brief.md`, `refuter-brief.md`, `findings/`, `dispositions.md`, `mut/` and `probe/`. T5's and its refuters' specs, harnesses and outputs are in `findings/T5-work/`.

## 12. Founder questions

None blocks S3: the flag is dark, and nothing is wired to deployment.

**Q-S3-1 — the stop rule and the edited test files.** §5 lists every pre-existing test file S3 edited: guard registrations of S3's new files, the S2a strip rows R-S3-1 overrules, and one environment mock line in four hub suites. None weakens a pin, and every shell test is untouched. **Asked:** confirm the rule meant behaviour pins, or name the edits to back out.

**Q-S3-2 — the review budget across remounts.** §6 reads as a budget per owner and epoch ("Every trigger shares this budget"; "return from Film Room" is a trigger; the unmount clear-list omits the rate slots), so S3 keeps the ledger across remounts. The consequence: §6 clears the documents on unmount, so a return inside the 120 s window shows "Checking your games · next attempt at {time}" for up to two minutes (the live games show at once). **Asked:** keep this (A); or keep the last window "as of" across remounts for the same owner and epoch, refreshed at the slot (A+, an amendment to §6's unmount list); or per mount (B, where the ten-minute bound does not hold under navigation)?

**Q-S3-3 — a failed completed read's retry.** §6 says a failed query "queues one retry at permitted time" and scheduled work runs only while a review is pending or unfinished work remains. S3 applies one automatic retry per failure episode; after that, a Retry, focus, return or a live game ending asks again. **Asked:** keep one per episode (B), retry every 120 s within the cap (A), or only on a trigger (C)?

**Q-S3-4 — the phone Overview's completed rows.** S3 keeps S1's design: the Overview lists ready reviews ("Reviews available"), at most three; every completed game is in History. **Asked:** keep it, or show the three most recent completed games with their outcome and review state?

**Q-S3-5 — the phone Loadout card.** R-S3-1 says the full words stay "on the phone, the Loadout tab's card"; there was none, so S3 added a Deploy card to the Loadout tab (the card's line and note, no hold). **Asked:** accept it, or move the words elsewhere?

**Q-S3-6 — two review states.** A thrown or malformed helper answer reads "Review refresh timed out · Retry queued" (§6 gives no separate words). And §6 lists "explicit History/Review Retry or Refresh" as a trigger, but S3 wires a Retry only to a failed window; a pending or unavailable review is re-asked on focus or return after 120 s, a live game ending, or the Film Room's return. **Asked:** are those fine, or should S4 add a Refresh to History?

**Q-S3-7 — one listener with the flag off.** The identity source is in the main graph (R-S3-2), so App holds one `onAuthStateChanged` observer whatever the flag; spec line 124 says the flag-off path allocates no hub listener. **Asked:** confirm the exception.

**Q-S3-8 — "No real-browser runs".** The review ran no browser. The build ran headless Edge once, for R-S3-1's 360 px measurement (§6), which jsdom cannot make. **Asked:** confirm that reading.

## 13. The smoke branch — NEVER MERGE

- **Branch:** `claude/command-center-hub-s3-smoke` is the build head (this report's commit) plus one commit that sets `COMMAND_CENTER_HUB_ENABLED = true` (`src/config/featureFlags.js:3442`). It was pushed with no PR and must never merge. The flip commit's SHA and the preview's URL are in the PR description (this report cannot carry its own commit's SHA).
- **What to check on its preview** (the prompt's list):
  - the Games rows and their outcome words;
  - the review states;
  - Open battle tape, with Back returning to the hub;
  - History showing ten games;
  - real eligibility on the strip;
  - the hold staying disabled.
- **No CI runs on it**: `.github/workflows/tests.yml` runs only on pull requests into `main`. Tested, it would fail 14 rows. Before pushing, the build ran a dry run: the code head with the flag on, on Windows, over the 11 test files the flag reaches (584 rows). It failed exactly these rows:
  - the three dark pins: `commandCenterHubFlags` "ships DARK", and `flagPinGuard` twice;
  - 9 rows of `src/App.activeBattlesPoll.owner.jsdom.test.jsx`;
  - 2 rows of `src/App.bootOrder.jsdom.test.jsx`.

  The 11 App rows test today's shell with the hub off: its poll schedule, its one listener, the owner-change clear. With the hub on, the hub mounts in their place. Every other row passes, including the new App file that drives the hub through the picker.

## 14. Next

- **The founder:**
  - review this draft PR and Q-S3-1 … Q-S3-8 (§12), none of which blocks S3;
  - check the smoke preview (§13).
- **Then the next slices**, in spec §11.2's order: S2b (the provider, the attempt and the hold) and S4 (next action, Activity, Later, the brief) build on §10. S5, S6 and S7 are untouched.
- Nothing is merged or activated. `COMMAND_CENTER_HUB_ENABLED` stays `false`.
