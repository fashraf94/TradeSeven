# Phase 0 — BaggerBomb trader game, launch set (read-only discovery)

**Date:** 15 Nov 2026 · **Branch:** `claude/phase0-baggerbomb-trader-game` from `origin/main` at `ea5e0c5b` · **Mode:** read-only. No source, test, flag, rule or config change; no deploy; no production write. The only file written in the repository is this report.

**Serves:** rulings BB-1, BB-3, BB-4 to BB-8, BB-11, BB-13 to BB-16 of 15 Nov 2026 ("BaggerBomb as the trading game"). It designs nothing. Not studied, as instructed: starting flat (BB-9), scoring in risk units (BB-12), rewards, the cockpit's new tasks.

## Preamble

- **Session opening (BUILD_RULES §2).** `git fetch origin` ran first. Branch `claude/phase0-baggerbomb-trader-game`, HEAD `ea5e0c5b` (equal to `origin/main`), tree clean.
- **Model.** The prompt names Opus; this session ran on Fable 5.2.
- **The capacity lane.** `claude/eval-capacity-build1` exists only as a local branch in another worktree (head `c9fe26b2` when this report was written). It is not on origin and is not merged into `origin/main`. It edits `api/cron/agent-evaluate.js` and `api/_utils/marketDataCache.js`. This report reads `origin/main` only, so its line numbers in the evaluator will move when that branch merges.
- **How the code was read.** Eight readers each took one part of the tree at HEAD and returned findings with a file, a line and the exact text of that line. The coordinator re-read the code behind the verdicts that carry the most weight (the quiet-check path, the lock deferral, the entry-price fallback, the league view at completion, the nightly reset, the measured-battle scope, completion and the winner).
- **How citations were checked.** Every citation in this report that quotes a line was tested by a script: the file at HEAD must hold that text on that line. A citation given as `file:line` with no quoted text was read by a reader and checked only for the file's existence and length. Anything not established is marked "not verified".
- **Production.** Project `tradeseven`, read on 15 Nov 2026 between about 4:40 and 5:20 PM ET, with `count()` and field-limited `get()` calls only. The five read scripts are outside the repository; their queries are in Appendix P. Each was searched for write calls before it ran. No index was created (one query that needed a new index was dropped and replaced with a client-side filter).
- **Account ids.** None appears in this report or in any script output. Counts only.
- **Not run.** No test or lint ran, because the change is one report file. No build ran either: the stylesheet scan excludes `docs/` (`src/index.css:9` — `@source not "../docs";`), and a local build cannot run on this machine because one package is not installed. The Vercel preview build is the real check. No model call and no market-data call was made.

## Verdicts

| Part | Ruling | Verdict in one line | What it means for the launch set |
|---|---|---|---|
| A | BB-1 hide the league | Nothing is in flight: 0 league groups active, the last league week ended 30 Oct. One client flag hides the nav and route today but removes the slot and leaves five other doors open. No single league flag exists on the server. | A new flag, read at the client sites listed in A6 and at the entry endpoints. No fenced file. The settle-first condition is already met. |
| B | BB-3 three or five days | Every battle is one trading day. The player has no picker and the server hard-codes one day. Multi-day code exists, is switched off, and would break at the first night. | The largest gap in the set. It touches the fenced creation record, the nightly job, the measured-threshold approval (pinned to one day), and a league test that depends on one-day battles. |
| C | BB-7 stops and targets | A stop or target today is one percentage for the whole battle, set by the player, and no battle has ever carried one (0 of 98). It fires only when the model is woken, never on a quiet check. Every exit is a swap into a replacement. | Per-position levels are new: a model-visible tool change, a fenced guardrail change, and a seventh exit site, where four test rows pin the count at six. A code-only pass must run for every battle on every check. |
| D | BB-8 bank on exit | Bonuses bank at the first 15-minute check that sees the level, and never un-bank. About 30 lines tell the model so. A sold position keeps its points. | A scoring-engine change (fenced as a concept), a rewrite of the model's scoring instructions, and about 15 readers of the banked value. |
| E | BB-13 version stamp; BB-11 trader's line | A battle carries no scoring version. Closed trades are recorded. A per-check score series exists from 22 Sep 2026. Battles won per agent exists; the other numbers are stored nowhere. | The stamp is fence contact (creation record). The trader's line can be computed from stored data for recent battles. |
| F | BB-15, BB-16 Agent vs Agent | The opponent is a frozen random book. A battle starts the moment it is deployed, with no waiting state and no cancel. Outside the league there is no rank and no notion of practice; every win on record is a win over the CPU. Rules keep everything owner-only, and most private things are fields on the battle record. | Two shapes are laid out, not chosen. Pairing at the open has no existing home. A shared record would expose chat, instructions and the list. |
| G | BB-14 rescore first | Yes for "the bonus counts only if the exit price still clears the level": 43 of 49 battles since 10 Aug have complete stored data, and no model call is needed. No for "or the stop has moved beyond the level": no stop was ever stored. | A small offline script. One founder ruling on whether a script may hand the real scorer a reset touch record. |
| H | BB-4 to BB-6 match cash | Star 2.0, Core 1.5, Support 1.0 with 2, 2 and 3 slots. The numbers 20, 15, 10 already exist in code and add to 100. No cash or share concept exists. Points alone already decide the winner. | The mapping holds only if each slot keeps a fixed dollar size. Dollars would be new on every surface. |

## Part A — the league (BB-1)

### A1. Doors

**Verdict.** The league has two navigation items and one route, all behind one existing flag, `TOURNAMENT_TAB_ENABLED` (true). Five more doors bypass that flag: the hub's game rows, the hub's League loadout card, three web-address parameters, and one "back" button. The scrapped Season mode still has one live door, a phone banner.

"League" below means the League Tournament (groups of four, weekly). "Season" means the scrapped Season mode.

| # | Door | Where | Gate (value at HEAD) |
|---|---|---|---|
| 1 | League: phone bottom nav item | `src/components/Navigation/BottomNav.jsx:11` — `? [{ id: 'league', label: 'League', icon: Trophy, screen: 'league', iconSize: 24 }]` | `src/config/featureFlags.js:130` — `export const TOURNAMENT_TAB_ENABLED = true;` |
| 2 | League: desktop sidebar item | `src/components/Navigation/DesktopSidebar.jsx:15` — `? [{ id: 'league', label: 'League', Icon: Trophy, screen: 'league' }]` | same flag |
| 3 | League: the route | `src/App.jsx:10199` — `if (TOURNAMENT_TAB_ENABLED && screen === 'league') {` | same flag |
| 4 | League: "back" from a training battle | `src/App.jsx:9562` — `onBack={() => setScreen('league')}` | no flag |
| 5 | League: hub game rows, live and finished | `src/components/CommandCenter/hub/useHubReaders.js:195` — `const documents = new Map([...(completed.battles \|\| []), ...live].map((b) => [b.id, b]));` | hub flag only: `src/config/featureFlags.js:3485` — `export const COMMAND_CENTER_HUB_ENABLED = true;` |
| 6 | League: hub strip "Open game" and next-action card | `src/components/CommandCenter/CommandCenterHub.jsx:227` — `const liveGame = live.find((g) => g.kind === BATTLE_TYPE_BAGGERBOMB) \|\| live[0] \|\| null;` | hub flag only |
| 7 | League: where rows 5–6 land (the League Arena) | `src/screens/BattleViewScreen.jsx:37` — `<LeagueBattleViewConnected groupId={currentBattle.groupId} onBack={onBack} />` | `src/config/featureFlags.js:266` — `export const LEAGUE_BATTLEVIEW_ROUTING_ENABLED = true;` |
| 8 | League: the hub Loadout tab's League card | `src/components/CommandCenter/LoadoutCards.jsx:176` — `{[cards.baggerbomb, cards.league].map((card) => (` | two loadout flags, both true |
| 9 | League: address `?trainingDraft=<id>` | `src/App.jsx:2284` — `const gid = new URLSearchParams(window.location.search).get('trainingDraft');` | no flag |
| 10 | League: address `?trainingBattle=<id>` | `src/App.jsx:2298` — `const pid = new URLSearchParams(window.location.search).get('trainingBattle');` | no flag |
| 11 | League: address `?tournamentDev=1` (developer screen) | `src/App.jsx:2240` — `if (new URLSearchParams(window.location.search).get('tournamentDev') === '1') {` | no flag |
| 12 | League: Battle History list | `src/App.jsx:4953` — `collection(db, 'agentBattles'),` | no flag; what a league row opens is not verified |
| 13 | League Backing (predictions on league pods) | `src/hooks/useBackingLit.js:48` — `return BACKING_BETA_ENABLED === true \|\| answered;` | `src/config/featureFlags.js:2589` — `export const BACKING_BETA_ENABLED = false;` Dark. |
| 14 | Season: phone banner | `src/App.jsx:12687` — `onTap={() => setScreen('seasonDashboard')}` | no flag; needs an active season entry. Production: 0 active entries (Appendix P). |
| 15 | Season: Forge "season" switch | `src/components/Forge/ForgeScreen.jsx:374` — `{forgeMode === 'season' && onNavigateToSeasonHub && (` | dead: that screen is never mounted |
| 16 | Season: the entry modal | `src/App.jsx:12705` — `<SeasonEntryModal` | no flag; opened only from inside the four Season screens (`src/App.jsx:9806`, `:9835`, `:9877`, `:9940`) |

Notes on the rows:
- **Rows 5–6 open any league battle the player owns.** The live poll drops only training clones (`src/App.jsx:4061`), and the finished-games read has no league filter (`src/services/completedAgentBattles.js:29` — `where('status', '==', 'completed'),`). A row with a group id is labelled ranked: `src/utils/commandCenterLiveBattles.js:65` — `return battle && battle.groupId ? BATTLE_TYPE_RANKED : BATTLE_TYPE_BAGGERBOMB;`
- **Row 7's flag must not be the hide lever.** Its own comment says so: `src/config/featureFlags.js:254` — `calls (60 of 127 exit calls at the count). DO NOT TURN THIS FLAG OFF until the cockpit`. With it off, league battles fall into the BaggerBomb battle screen and the cockpit.
- **Row 8 also runs a league read on every hub visit:** `src/components/CommandCenter/PerGameLoadoutScope.jsx:24` — `const lockRead = useLeagueLoadoutLock(agent ? agent.ownerId ?? null : null);`
- **Doors behind the route** vanish with row 3: the lobby's Ranked and Training tabs, spectating, the training-pod start, the enrollment picker and the draft room all mount inside `LeagueScreen`.
- **Not league doors:** `CompeteTab` is the research sheet's sector-ranks tab and has no league import (`src/components/Research/Sheet/ShellTabs.jsx:99`). Onboarding has no league text. No push, email or in-app notification system was found (searches for service workers, push, messaging and mail libraries returned nothing).

**Tests that pin a league door** (they would need a deliberate change): `src/config/perGameLoadoutFlags.test.js:142`, `src/config/agentFormFlags.test.js:139`, `src/config/leagueBattleviewRoutingWall.test.js:42`, `src/screens/LeagueEnrollment.routing.test.jsx:2`, `src/components/CommandCenter/CommandCenterHub.loadouts.jsdom.test.jsx:684`, `src/components/CommandCenter/hubChrome.test.js:20`. No test names `TOURNAMENT_TAB_ENABLED`.

### A2. Jobs

**Verdict.** No job creates a league group on its own. With no human entering, every league job finds zero groups and returns without writing. Four scheduled jobs must keep running until the last group is complete, and one of them (the nightly banking inside `snake-draft-daily-scores`) is not on the prompt's list. Production shows no group in flight today (A4), so nothing is waiting to settle.

**The week, phase by phase.** A group is one `tournamentGroups` record: four seats, one week. Its in-flight statuses are `forming`, `drafting`, `awaiting_open` and `battle`; its final statuses are `complete`, `expired` and `voided` (`src/constants/leagueTournament.js:84` — `export const GROUP_STATUS = Object.freeze({`).

1. **Formation, on a human's request only.** A slot claim creates a `forming` group holding only that human: `api/_utils/liveDraftFormation.js:406` — `players: [{ odUserId, picks: [] }],`. The older lobby path creates a full four with CPU padding (`api/_utils/tournamentLobbyService.js:340`).
2. **Draft.** The `live-draft-fire` cron fills empty seats with CPUs when the slot time arrives and moves the group to `drafting`: `api/_utils/liveDraftLifecycle.js:177` — `const cpuCount = GROUP_SIZE - humanIds.length;`. It also auto-picks overdue turns.
3. **Open.** The orchestrator's weekday-morning run moves `awaiting_open` to `battle`: `api/_utils/trainingLifecycle.js:678` — `await transitionStatus(db, pod.id, GROUP_STATUS.BATTLE, nowIso, stamp);`
4. **Daily battles.** Each trading morning the orchestrator creates one fresh agent battle per seat by calling the deploy endpoint (`api/_utils/tournamentOrchestrator.js:315`). The evaluator scores it all day. At 21:15 UTC the nightly cron banks the day: `api/cron/snake-draft-daily-scores.js:482` — `tournament = await bankAllTournamentGroups(db);`
5. **Settlement.** Every weekday evening the orchestrator runs advancement. It acts only when day 5 is banked: `src/constants/leagueTournament.js:1442` — `return (getLatestBankedDayEntry(group)?.dayN || 0) >= WEEK_DAYS_REQUIRED;`. It then writes rank and leaderboard and sets `complete`: `api/_utils/tournamentAdvancement.js:362` — `await transitionStatus(db, group.id, GROUP_STATUS.COMPLETE, nowIso);`

A week is five banked trading days, not Monday to Friday, so a holiday week ends later. A week whose final snapshot is flagged incomplete never seals without a person: advancement refuses it and there is no automatic repair (`api/_utils/tournamentAdvancement.js:347`).

| Job (schedule in `vercel.json`) | What it does for the league | When nobody can enter | Verdict |
|---|---|---|---|
| `tournament-orchestrator` (`vercel.json:189`) | Morning: opens waiting groups and creates the day's agent battles. Evening: seals banked weeks. | `api/_utils/tournamentOrchestrator.js:619` — `if (groups.length === 0) return summary;` | Must keep while any group is in flight |
| `snake-draft-daily-scores` (`vercel.json:49`) | Banks each day's scores, reconciles the agent ledger, aggregates the leaderboard, completes training pods. | `api/_utils/tournamentBanking.js:482` — `if (groups.length === 0) return summary;` | Must keep while any group is in flight |
| `agent-evaluate` and its settle run (`vercel.json:157`, `:161`) | Scores every active agent battle, league included. League branches run only for a stamped battle: `api/_utils/tournamentAgentLedger.js:306` — `if (!battle \|\| battle.gameMode !== TOURNAMENT_GAME_MODE) return null;` | Unchanged; it is BaggerBomb's own evaluator. | Must keep (shared) |
| `live-draft-fire` (`vercel.json:193`) | Fires due slot groups, fills CPU seats, auto-picks. | Two status queries, no writes. | Must keep until no `forming` or `drafting` group remains; then it can stop |
| `process-draft-claims` (`vercel.json:73`) | Resolves players' overnight pick claims for groups in `battle`. | Zero groups, no work. | Keep for players in flight; not needed to seal |
| `agent-daily-scores` (`vercel.json:65`) | No league code; handles every active agent battle. | Unchanged. | Shared; not a league job |
| `compute-rankings` (`vercel.json:69`) | Not a league job. It ranks stocks, and has no league reference. | n/a | Out of scope |
| `lobbies/cleanup-expired` (`vercel.json:45`) | Not a league job. It cleans the old human `drafts` and `battles` lobbies. | n/a | Out of scope |

Four other jobs handle every active agent battle and are shared with BaggerBomb: reflections, the daily review, the voice cache and the film tape. They were not classified for the league.

**Why the orchestrator must keep running mid-week.** Banking sums every league battle a group ever had. If morning deploys stop mid-week, a seat that already has battles is not flagged missing, so the agent half of the score freezes silently and the week still seals on a short total.

**Endpoints under `api/tournament/`, by kind.**
- **Entry doors, which can close:** `slot-claim`, the five `lobby-*` endpoints, `lobby-quickplay-training`.
- **In-week player actions, needed while a group is in flight:** `live-draft-pick`, `slot-release`, `training-pick`, `activate-training-pod`, `commit-board`, `flip`, `place-claim`.
- **Read-only views:** `battle-view`, `live-composites`, `team-card`, `slot-schedule`, `backing-pools`.
- **Operator levers behind the admin secret, kept as recovery:** `run-duty`, `bank-daily-scores`, `process-claims` and six more.

**Server flags that gate league entry or jobs.**

| Flag | Value, defined | Read at | Gates |
|---|---|---|---|
| `LEAGUE_LOBBY_ENABLED` | true, `src/config/featureFlags.js:149` | `api/_utils/lobbyEndpoint.js:87` — `if (!LEAGUE_LOBBY_ENABLED) {` | Entry only (all `lobby-*`) |
| `LEAGUE_LIVE_DRAFT` | true, `src/config/featureFlags.js:452` | `api/cron/live-draft-fire.js:45` — `if (!LEAGUE_LIVE_DRAFT) {` | Entry and in-flight work (the fire cron, draft picks) |
| `LEAGUE_NEXT_ARC_ENABLED` | true, `src/config/featureFlags.js:191` | three training endpoints | Training entry and in-flight work |
| `TOURNAMENT_DEPLOY_ENABLED` | true, `api/_utils/tournamentOrchestrator.js:120` | same file | The daily agent battles |
| `TOURNAMENT_ADVANCEMENT_FROZEN` | false, `src/config/featureFlags.js:1269` | `api/_utils/tournamentAdvancement.js:285` | Settlement (true would block sealing) |
| `BACKING_BETA_ENABLED` | false, `src/config/featureFlags.js:2589` | settlement | Backing |
| `PER_GAME_LOADOUT_ENABLED` | true, `src/config/perGameLoadoutFlags.js:39` | `api/agent/change-archetype.js:253` | The loadout lock (A3) |

There is no single league flag today. Two of the existing flags also switch off machinery an in-flight group needs, so reusing one as the hide would strand such a group.

### A3. Shared records

**Verdict.** Almost nothing the league writes is read by BaggerBomb. The one real coupling is the League loadout lock.

| Record | Where it lives and who writes it | Read outside the league | When league entry stops |
|---|---|---|---|
| League career rank | `tournamentRanks`, written only by week settlement: `api/_utils/tournamentRank.js:72` — `const ref = db.collection(TOURNAMENT_RANKS_COLLECTION).doc(rankDocId(odUserId, { dev }));` | League screens and Backing (dark) | Freezes at its last value. Production: 22 records, 20 of them CPU. |
| Agent win and loss record | `agents/{id}.stats`, moved by BaggerBomb battles only. A league battle never moves it: `api/cron/agent-evaluate.js:6994` — `updateAgentStats: false,` | BaggerBomb surfaces | Unaffected |
| Composite score | Computed in one place (`src/constants/leagueTournament.js:913` — `return (agentPoints \|\| 0) + TOURNAMENT_TUNING.USER_LAYER_K * (userPoints \|\| 0);`) and stored on the group | League and Backing only | Nothing else reads it |
| Directive and chat charges | Two separate counters. League: 10 a day (`api/_utils/agentChatBudget.js:36` — `export const AGENT_CHAT_DAILY_LIMIT = 10;`). Every other battle: a field on its own record (`api/_utils/directiveFiling.js:97` — `export const BATTLE_CHAT_BUDGET = Object.freeze({ field: 'chatBudgetUsed', limit: 10 });`) | — | Unaffected; the league grants nothing that is spent elsewhere |
| The casual clone | `agents/casual-agent-{player}`: a copy of the player's main agent that plays BaggerBomb so it can run beside a league battle. It copies the loadout and memory from the main agent (`api/_utils/casualClone.js:86` — `rankedAgentId: rankedAgent.id, // the attribution target for every redirect`). It reads no group. | It is the BaggerBomb identity | Keeps working |
| **The League loadout lock** | While a player has a ranked group in any in-flight status, a change to the main agent's archetype is refused: `api/agent/change-archetype.js:255` — `if (lock.locked) throw leagueLockedError(SENTINEL_PREFIX, lock);` | Hub and Forge edits to the main agent | A group stuck in flight would lock that player indefinitely. None is in flight today. |
| Backing weeks | Dark (`BACKING_BETA_ENABLED = false`) | — | Nothing while dark |
| The evaluator's league handling | A league battle gets other seats' stocks filtered out and a reserve-and-confirm ledger around swaps (`api/cron/agent-evaluate.js:1155`); CPU seats are scored but never trade (`api/cron/agent-evaluate.js:1493` — `if (battle.isCpu === true) {`); no win or loss at completion | — | These branches go idle |
| The cockpit's release switch | Control record `cockpitConfig/release` (`api/_utils/callRecords/release.js:59` — `export const RELEASE_COLLECTION = 'cockpitConfig';`). It admits agent-mode battles only: `api/_utils/callRecords/release.js:146` — `if (battle.gameMode !== RELEASE_COHORT_GAME_MODE) return false;` | Cockpit | No dependence on league state |

One model call stops when the league stops: the Monday agent-board production (`api/_utils/tournamentAgentBoards.js:369` — `const response = await anthropic.messages.create({`).

### A4. Counts (production, read 15 Nov 2026)

**Verdict.** No league group and no league week is in flight. The last league week traded 26–30 Oct 2026. Nothing is waiting to settle, so "the league week in progress settles first" is already met, unless someone claims a slot before the hide ships.

| Count | Value |
|---|---|
| League groups in flight (`forming`, `drafting`, `awaiting_open`, `battle`) | **0** |
| League groups on record | 18: 17 complete, 1 voided |
| Active league agent battles | 0 (the last league trading day on record is 30 Oct 2026) |
| League agent battles created in November | 0 |
| Lobby records | 20: 19 formed, each with one human member; 1 counter record |
| Distinct human accounts across every league group ever | 2 |
| Rank records | 22: 20 CPU, 2 human; last written 30 Oct 2026 |

**Humans against CPU seats per week.** A group has four seats. The table gives the last four calendar weeks, then the two earlier weeks that had play.

| Week (Monday) | Groups | Human seats | CPU seats | Notes |
|---|---|---|---|---|
| 9 Nov 2026 | 0 | 0 | 0 | no league play |
| 2 Nov 2026 | 0 | 0 | 0 | no league play |
| 26 Oct 2026 | 1 | 1 | 3 | ranked, live draft |
| 19 Oct 2026 | 1 | 2 | 2 | ranked, live draft |
| 5 Oct 2026 | 3 | 3 | 9 | 1 ranked live draft, 1 ranked lobby, 1 training |
| 28 Sep 2026 | 2 | 2 | 6 | 1 ranked live draft, 1 training |

The same picture shows in the league agent battles created per week: 20 in the week of 26 Oct (5 by a human's agent, 15 by CPU agents), 20 in the week of 19 Oct (10 and 10), none since.

### A5. The freed screen

**Verdict.** The league screen is `LeagueScreen` (`src/App.jsx:10206` — `<LeagueScreen`). The hub's deploy control and games list can be reused in function, but a repo guard forbids importing hub components from outside the hub's folder, and three hub modules import league code.

**What `LeagueScreen` renders.** On desktop, a three-column lobby (`src/screens/LeagueScreen.jsx:102` — `<LeagueLobbyDesktop`). On the phone, `LeagueHome` (`:111`): the Ranked and Training lobby, spectating and a pod sheet. "Open my game" shows `LeagueParticipantView` (`:93`), which holds the enrollment picker, the draft room, claims and flips, and the board commit.

**Reusable from the hub's deploy flow.** There is no deploy form with fields. The launcher is a press-and-hold control.

| Piece | Where | League-specific imports |
|---|---|---|
| `DeployAttemptProvider` and `useDeployAttempt()` | `src/contexts/DeployAttemptContext.jsx:862`, `:118`. Already mounted around every screen at `src/App.jsx:10403`. | none direct |
| `useHubDeploy` (hold, tap, cancel, progress) | `src/components/CommandCenter/hub/useHubDeploy.js:41` | none |
| `DeploySection`, `PhoneDeployCard`, `DeployStrip`, `HubHold` | `src/components/CommandCenter/sections/DeploySection.jsx:155`, `:125` | indirect: its loadout line runs the League lock read (row 8) |
| `deriveHubDeployState` | `src/components/CommandCenter/hub/selectors/deployState.js:155` | `:42` — `import { TRAINING_CLONE_ID_PREFIX } from '../../../../constants/leagueTournament';` |
| `ScoutingBoardSheet` ("See what it's eyeing", with its own deploy) | `src/components/Dashboard/ScoutingBoardSheet.jsx:113`. Outside the hub folder. | none |
| `deployAgent` (the request) | `src/services/agentDeploy.js:108`. The request carries only the agent: `:272` — `body: JSON.stringify({ agentId: deployAgentId }),` | none |

**Reusable from the hub's games list.**

| Piece | Where | League-specific imports |
|---|---|---|
| `GamesSection`, `GameRow`, `HistorySheet` | `src/components/CommandCenter/sections/GamesSection.jsx:153`, `:49` | none direct |
| `liveGameRows`, `completedGameRows` | `src/components/CommandCenter/hub/gamesDisplay.js:137`, `:211` | `:21` imports the ranked label; rows mix league and BaggerBomb |
| `deriveGameOutcome` | `src/components/CommandCenter/hub/selectors/gameOutcome.js:100` | `:41` — `import { TOURNAMENT_GAME_MODE } from '../../../../constants/leagueTournament';` |
| `useHubReaders`, `useHubCompletedBattles` (a window of 10) | `src/components/CommandCenter/hub/useHubReaders.js:106`; `src/components/CommandCenter/hub/useHubCompletedBattles.js:152` | via `src/utils/commandCenterLiveBattles.js:17` — `import { deriveArenaTerminalKind } from '../components/League/battleArena/arenaStateMap';` |

**The constraint on reuse.** `src/components/CommandCenter/commandCenterHub.mount.guard.test.js:1094` pins that the main app reaches the hub's folder only through a short permitted list (`:1117`–`:1128`). A page outside `CommandCenter/` that imports `DeploySection` or `GamesSection` fails that row.

### A6. The smallest hide

**Recommendation.** Read one flag at the three sites that read `TOURNAMENT_TAB_ENABLED` today, with the route choosing the BaggerBomb page instead of dropping the slot. Read it also at the leak sites below. On the server, the same flag closes the enrollment endpoints (A2).

**Sites a hide must read.**
1. `src/components/Navigation/BottomNav.jsx:10`
2. `src/components/Navigation/DesktopSidebar.jsx:14`
3. `src/App.jsx:10199` (which component the slot renders)
4. `src/App.jsx:9562` (the back target after a training battle)
5. `src/App.jsx:2284` and `:2298` (training address parameters); `:2240` if the developer screen closes too
6. `src/components/CommandCenter/LoadoutCards.jsx:176`, with the lock read at `src/components/CommandCenter/PerGameLoadoutScope.jsx:24`

**The founder's call, not a must.**
7. Ranked rows in the hub (`src/components/CommandCenter/hub/gamesDisplay.js:138` live, `:212` finished). They are history today; no league battle is in flight.
8. The Season banner (`src/App.jsx:12682`).

**What existing flags already do.**
- `TOURNAMENT_TAB_ENABLED` set to false hides sites 1–3 by removal. It does not hand the slot to BaggerBomb, and it leaves sites 4–6 open. A comment claims otherwise: `src/App.jsx:10198` — `// With the flag off, 'league' is unreachable: the nav items are its only setters.` Row 4 is a third setter.
- `LEAGUE_LIVE_DRAFT` (`src/config/featureFlags.js:452`, true) is read by the server too, so it is not a pure hide.
- `LEAGUE_BATTLEVIEW_ROUTING_ENABLED` must stay on (row 7).
- `BACKING_BETA_ENABLED` is already false.

## Part B — battle length (BB-3)

### B1. How length is set, and whether a multi-day battle works today

**Verdict.** Every agent battle is exactly one trading day. The player has no length picker, and the server hard-codes one day whatever is sent. Multi-day code exists but is switched off. If it were switched on it would break at the first night for swapped-in positions on legacy battles, and measured battles would be refused. Production agrees: of 645 agent battles, three ever ran three days, all in March 2026 before the switch (Appendix P).

**The client sends only the agent.** `src/services/agentDeploy.js:272` — `body: JSON.stringify({ agentId: deployAgentId }),`

**The server reads a length nobody sends, and creation ignores it.**
- `api/agent/decide.js:967` — `duration: req.body.duration || '1d',`
- `api/_utils/agentBattleService.js:41` — `const AGENT_BATTLE_DURATION_MODE = 'fullday';`
- `api/_utils/agentBattleService.js:129` — `tradingDays = [fullDay.targetDateStr];`
- `api/_utils/agentBattleService.js:148` — `duration: AGENT_BATTLE_DURATION_MODE === 'fullday' ? 'fullday' : duration,`
- The switched-off branch accepts one, three or five days: `api/_utils/agentBattleService.js:358` — `const dayCount = duration === '1d' ? 1 : duration === '5d' ? 5 : 3;`
- A battle deployed in the last 45 minutes of a session plays the next session (`src/utils/stockAdmissionWindow.js:70`). It expires at the close, or at 8:00 PM ET when the roster holds crypto.

**What is live.**
- Client: `useAgentBattle`, reached from `src/screens/BattleViewScreen.jsx:43` — `if (currentBattle.agentDeployed === true && AgentBattleScreen) {` and `src/hooks/useAgentBattle.js:69` — `const battleRef = doc(db, 'agentBattles', agentBattleId);`. The `useBaggerBombBattle*` hooks serve the old human battle only.
- Server: `agent-evaluate` (with its settle run) and `agent-daily-scores` (`api/cron/agent-daily-scores.js:252` — `const battles = await findActiveAgentBattles(db);`). The crons `compute-daily-baggerbomb-levels` and `baggerbomb-v4-daily-scores` are scheduled but read the old human `battles` collection: `api/cron/compute-daily-baggerbomb-levels.js:288` — `const battlesSnapshot = await db.collection('battles')`

**A multi-day agent battle, step by step.**

| Step | Today | Evidence |
|---|---|---|
| Creation | Cannot be created | The constant above. The switched-off branch also ignores the late-start rule and always ends at 16:00 (`api/_utils/agentBattleService.js:400`). |
| Daily levels | Not applicable | "Levels" are dollar targets written on old human battles only. An agent battle computes its baseline inside each check (`api/cron/agent-evaluate.js:1332`). |
| Scoring across days, legacy | Breaks for swapped-in positions | The night job deletes the swap entry price: `api/cron/agent-daily-scores.js:187` — `delete asset.swapPrice;`. Next day the scorer falls back to the creation price or to nothing: `api/cron/agent-evaluate.js:1297` — `const entryPrice = asset.swapPrice \|\| battle.portfolio?.startingPrices?.[asset.symbol] \|\| 0;`. Traced by reading, not run. |
| Scoring across days, legacy, CPU side | Uneven | The CPU has no stored history, so its bonuses and penalties are never banked overnight while the agent's are. |
| Scoring across days, measured | Refused | `src/utils/stockThresholdModel.js:30` — `if (battle.gameMode !== 'baggerbomb_agent' \|\| battle.duration !== 'fullday' \|\| !battle.opponent?.portfolio) return unavailable('unsupported_stock_scope');` |
| Banked trades | Breaks past 50 swaps | `api/_utils/agentSwapExecution.js:499` (the list keeps the last 50, and the legacy banked score sums that list) |
| Overnight, weekend, holiday | Works | Out of hours only the expiry sweep runs: `api/cron/agent-evaluate.js:455` — `if (!isMarketOpen()) {`; the night job skips non-trading days: `api/cron/agent-daily-scores.js:241` — `if (!isTradingDay()) {` |
| Completion | Works | Purely by expiry: `api/cron/agent-evaluate.js:365` — `if (battle.expiresAt && new Date(battle.expiresAt) < new Date()) {` |
| Film Room tape | Works by design | One record per battle per day (`src/utils/tapeSchedule.js:108`). Multi-day is covered only by test fixtures. |
| Reflection | Works, once per battle | `api/cron/process-pending-reflections.js:123` — `.where('pendingReflection', '==', true)`. The daily review is already per day. |
| Hub active list | Works (the query) | `src/App.jsx:4050` — `where('status', '==', 'active')`. Display wording not verified. |
| Battle screen live score | Breaks from day 2, legacy | The client omits banked bonuses: `src/screens/AgentBattleScreen.jsx:1767` — `() => Math.round(sumPortfolioPoints(enrichedPlayerPortfolio) + bankedScore),` |

### B2. Everything that assumes one day

| Item | Budget | Where | Effect of 3 or 5 days |
|---|---|---|---|
| Cockpit commands | 7 per battle | `api/_utils/callRecords/commands.js:26` — `export const COCKPIT_COMMANDS_LIMIT = 7;`; enforced at `api/agent/call-response.js:408` — `if (used >= COCKPIT_COMMANDS_LIMIT) return refused('budget');` | 7 for the whole battle |
| Chat | 10 per battle | `api/_utils/directiveFiling.js:97` | 10 for the whole battle |
| Review chat | 5 per battle | `api/agent/chat.js:384` — `review: { field: 'reviewBudgetUsed', limit: 5 },` | 5 shared across every day's review |
| Directive lifetime | Whole battle | `api/_utils/directiveUtils.js:53` — `if (expiry === 'end_of_battle') return true;` | An instruction given on day 1 binds through the last day unless replaced |
| Call horizons | Per call | `api/_utils/callRecords/horizon.js:149` — `case 'this_session': {` and `:153` — `case 'this_battle':` | Already correct; the two stop meaning the same thing |
| Hot bench | Per day | `api/cron/agent-evaluate.js:285` — `return isNewTradingDay \|\| (rankingsComputedMs > lastHotBenchComputedMs);` | Works |
| Weekly ranks | Not a battle budget | `compute-rankings` ranks stocks daily. Player rank moves per league week only. | An agent-mode battle moves only the win and loss record today |
| Gameplan meeting | 1 per day | `api/cron/agent-evaluate.js:6837` — `if (battle.cronState?.lastGameplanDate === todayET) return null;` | Works. Its 16:00 is fixed, so it ignores early closes. |
| Threshold reset | Legacy: zeroed nightly. Measured: never. | `api/cron/agent-daily-scores.js:196`; policy `docs/specs/BAGGERBOMB_STOCK_THRESHOLDS_POLICY_V2_20261015.json:59` — `"freeze": "position_lifetime",` | Legacy also resets the trailing stop's peak each night |
| Stored model checks | 150 per battle | `api/cron/agent-evaluate.js:4798` — `const evaluations = [...(battle.evaluations \|\| []), evaluation].slice(-150);` | About 26 checks a day; five days nears the cap |

**Tests that pin one day:**
- `src/components/League/battleArena/buildArenaModel.test.js:513` — `expect(battleServiceSource).toContain("const AGENT_BATTLE_DURATION_MODE = 'fullday'");` The league arena double-counts if this constant flips, so length would have to be set per mode.
- `api/_utils/p4Equivalence.battery.test.js:602` — `expect(doc.duration).toBe('fullday');`
- `api/cron/agent-evaluate.stockThresholds.test.js:197` — `expect(battle.timing.tradingDays).toEqual(['2026-10-14']);`
- Sixteen fixture files carry `duration: 'fullday'`. `agent-daily-scores` has no day-2 test.

### B3. The measured thresholds

**Verdict.** A measured threshold is one day's typical range (the 14-day average true range as a percentage of price), frozen at entry and counted from the fill for the life of the position. It is approved and hash-pinned for one-day battles only. It does not hold as approved for 3 or 5 days: a one-day unit counted over several days is crossed far more often.

- **Data:** 15 consecutive daily bars, fully adjusted, ending at the last completed session.
- **Formula:** `api/_utils/measuredStockThreshold.js:77` — `const atr14Dollars = trueRanges.reduce((sum, tr) => sum + tr, 0) / 14;` and `api/_utils/measuredStockThreshold.js:78` — `const measuredPct = 100 * atr14Dollars / bars.at(-1).close;`
- **Levels:** the fill price plus or minus 1.0, 1.5 and 2.0 times that percentage (`src/utils/stockThresholdModel.js:72`). Points: +15, +30, +50 and −10, −20, −35.
- **Scope:** the policy file pins one day (`docs/specs/BAGGERBOMB_STOCK_THRESHOLDS_POLICY_V2_20261015.json:13` — `"creationDuration": "fullday",`), the model id is `stock_measured_atr14_fullday_v2`, and the registry refuses a changed policy.
- **Legacy thresholds** are a volatility rank times eight (`api/agent/decide.js:1267` — `baseATR: (stock.atrPercentile \|\| 0.5) * 8,`), counted from the entry price on day 1 and from the previous close on later days. Crypto always uses the legacy path.
- **Which path runs today:** the code flag is on, and the production control record decides per battle (D1; production state in Appendix P).

## Part C — stops and targets (BB-7)

### C1. Today's machinery

**Verdict.** Today a stop or target is one percentage for the whole battle, copied from the agent when the battle is created. It is not per position and it is not declared when a position opens. The platform's own risk exits are separate and are not player-set levels. In production no battle in the last 30 days carried any stop or target (counts below).

**Player guardrails: stop-loss, trailing stop, profit target.**
- The levels live on the agent and are frozen onto the battle at creation: `api/_utils/agentBattleService.js:200` — `deployedGuardrails: Array.isArray(agentData.deployedStrategy?.guardrails)`
- The stop is a percentage below entry, applied to every held position: `api/_utils/agentGuardrails.js:262` — `return pnl <= -Math.abs(stopLoss.value) ? pnl : null;`
- The profit target is flag-gated, and the flag is on: `api/_utils/agentGuardrails.js:320` — `PROFIT_TARGET_EXECUTOR_ENABLED &&`; `src/config/featureFlags.js:2010` — `export const PROFIT_TARGET_EXECUTOR_ENABLED = true;`
- A per-position target hook has a reader and no writer: `api/_utils/agentGuardrails.js:592` — `const override = position?.profitTargetOverridePct;`. Stops have no such hook.
- The trailing stop uses an implied peak, not an observed one: `api/_utils/agentGuardrails.js:724` — `const impliedPeakPrice = entry * (1 + (peakMultiplier * baseATR) / 100);`
- **Who can set them:** the player, through Forge sliders. The ranges exist in the interface only (stop 3–20%, trailing 3–25%, target 5–50%; `src/components/Forge/StrategyDimensions.jsx:102`, `:103`, `:144`); no server-side range check was found. The sliders become guardrails at `src/utils/dimensionMapper.js:1330` — `out.push({ type: 'stopLoss', value: stopLoss, unit: '%', enforcement: 'hard' });`
- **Whether a player can still reach the sliders is not verified.** `StrategyDimensions` is imported only by the Season entry modal, and the deploy step only by the Season review screen, and Season mode is scrapped.
- **The model cannot set a level.** The guardrail code reads only the frozen list.
- **Per-archetype bounds on stops or targets:** none enforced.

**The platform's risk manager (not player levels).**
- Bust avoidance, VWAP failure and a stepped trail come from the preset: `api/_utils/agentRiskManager.js:120` — `const bustBuffer = presetOverrides.bustBuffer ?? -0.85;`
- Every battle is created on one preset: `api/_utils/agentBattleService.js:287` — `strategyPreset: 'balanced',     // 'aggressive' | 'balanced' | 'defensive' (Sprint 4)`. The preset control is imported by the battle screen but not rendered. The rules still let the owner write the field directly (`firestore.rules:478`).
- Stagnation rotation is set per archetype (`api/_utils/agentArchetypeConfig.js:199`).
- The tempo dial moves the swap cap, rotation timing and the hurdle. It does not move stops or targets.

**Exit reasons on a closed trade** (`trades[].exitReason`, with `trades[].source` beside it):

| Value | Written at |
|---|---|
| `bust_avoidance`, `vwap_failure`, `stepped_trail`, `stagnation` | `api/cron/agent-evaluate.js:2233` — `exitReason: riskResult.reason,` |
| `guardrail_stopLoss`, `guardrail_trailingStop`, `guardrail_profitTarget`, or `haiku_decision` (the model's own swap) | `api/cron/agent-evaluate.js:3960` — `exitReason: haikuSwapReason,` |
| the three `guardrail_*` values, from the suppression pass | `api/cron/agent-evaluate.js:6138` — `exitReason: deterministicExitReason,` |
| `gameplan_rotation` | `api/cron/agent-evaluate.js:6554` |

**Production counts, last 30 days** (agent-mode battles created on or after 16 Oct 2026):

| Count | Value |
|---|---|
| Agent-mode battles in the window | 17 (16 completed, 1 active) |
| Battles with any stop, trailing stop or target | **0** |
| Agent-mode battles with one, all time (98 battles) | **0** |
| League battles with one, all time (547 battles) | **0** |
| Agents with one saved in their strategy today (104 agents) | **0** |
| Exits (closed trades) | 37, in 13 of the 17 battles |
| Exits by reason | stagnation rotation 24; the model's decision 10; bust avoidance 3 |
| Exits by a player stop, trailing stop or target | **0** (no stored model check in the window carries a guardrail note: 0 of 252) |
| Exits by reason, all time (240 exits) | VWAP failure 96; stagnation rotation 67; the model's decision 54; bust avoidance 21; gameplan rotation 2 |

So the stop and target machinery exists, is switched on, and has never fired in an agent-mode battle, because no battle has ever carried a level. Every exit on record is a swap into a replacement.

### C2. Where a code-only pass would run

**Verdict.** The platform's risk exits run on every check that reaches a battle. The player's stop and target run only when the trigger gate opens, or on three special paths. They never run on a quiet check, and nothing at all runs for a battle the loop does not reach in time.

**Order inside one check** (`processAgentBattle`, section lines): dormant skip `:930`; price fetch `:1205` and quote guard `:1229`; scoring `:1260`; risk loop `:1872` and risk swaps `:2052`; pending proposal `:2621`; gameplan meeting `:2653`; trigger gate `:2904`; model call `:3009`; guardrails `:3633`; swap `:4046`.

- The risk manager runs before the gate: `api/cron/agent-evaluate.js:1872` — `// ---- Risk evaluation layer (runs BEFORE trigger gate) ----`
- **A quiet check runs no player guardrail.** `api/cron/agent-evaluate.js:2958` — `if (!shouldEvaluate) {` writes scores and returns with no guardrail call.
- **The suppression pass is not the quiet-check path.** It runs in three places: while a gameplan meeting is pending (`:2670`), when a measured score frame is unavailable (`:2728`), and on the check that creates a meeting (`:2793`). It is flag-gated: `api/cron/agent-evaluate.js:5963` — `if (!PROFIT_TARGET_EXECUTOR_ENABLED) return;`
- **A battle the loop defers gets nothing:** `api/cron/agent-evaluate.js:524` — `if (elapsed > TIME_BUDGET_MS) {`
- The player-facing wording already admits the gap: `src/constants/profitTargetPromise.js:24` — `+ 'Evaluations tick ~every 15 min in market hours but only run on market triggers — a quiet stretch can defer the fire, '`

**A code-only pass.**
- It needs no model. The guardrail code already runs with none: `api/cron/agent-evaluate.js:5994` — `haikuResult: null,`
- **With the capacity lane.** The fan-out discovery (draft PR #1069, the report file 20261115_PHASE0_EVAL_FANOUT.md on the branch `claude/phase0-eval-fanout`, not merged; its numbered finding 10 and its section on where a code-only pass would sit) says a code-only pass must run for every battle on every check, outside the model's budget. It offers two positions: between the sort and the model loop, or as each pool worker's first, unconditional phase. A pass placed only inside `processAgentBattle` still misses deferred battles. The capacity build branch `claude/eval-capacity-build1` is local only and not merged; this report reads `origin/main`.
- **A new exit site is the seventh `executeSwapServer` call site** (BUILD_RULES §7), and these tests pin six:
  - `api/cron/agent-evaluate.test.js:161` — `expect((code.match(/await executeSwapServer\(/g) || []).length).toBe(6);`
  - `api/cron/agent-evaluate.test.js:751` — `it('every one of the 6 executeSwapServer call sites is preceded by the shared phase-1 reserve helper', () => {`
  - `api/cron/agent-evaluate.test.js:868` — `it('REPO-LEVEL: executeSwapServer has no consumers outside the fenced module and this wrapped cron', () => {`
  - `api/cron/agent-evaluate.retrySafe.test.js:295` (the same count)

### C3. The fill price

**Verdict.** Every fill is at the observed quote, never at the level. The measured-battle executor refuses an exit without a dated quote. The legacy executor can fill an exit at the entry price when the outgoing quote is missing; that path is latent today because held quotes are vetted first. The legacy executor also accepts yesterday's close standing in for a live quote, and checks no quote age.

**Legacy executor.**
- The fill is the fetched quote: `api/_utils/agentSwapExecution.js:330` — `return currentPrices[symbol]?.current;`
- A missing outgoing quote fills at the entry price: `api/_utils/agentSwapExecution.js:337` — `const exitPrice = getPrice(outSymbol) || entryPrice;`. This contradicts "a missing price never produces a fill", but it is latent: on the cron paths the held quotes are vetted first (`api/cron/agent-evaluate.js:1239` — `const quoteHealth = assessRequiredQuotes(requiredQuoteSymbols, prices);`).
- A missing incoming quote aborts the whole swap, so the exit does not happen: `api/_utils/agentSwapExecution.js:423`.
- "Current" can be yesterday's close: `api/_utils/marketDataCache.js:799` — `const selected = data.close || data.previousClose || 0;`. The quote guard checks held and CPU symbols only, so a bench symbol's fallback price can become an entry price.

**Measured executor.**
- No exit without a dated quote: `api/_utils/stockThresholdAdmission.js:254` — `if (!positive(outQuote.price) || instantMs(outQuote.asOf) === null || instantMs(outQuote.asOf) > instantMs(at)) refuseStock('missing_exit_quote');`
- A stand-in or fallback price reads as no price, and an exit needs a quote later than the fill quote.

**Quote age.** Earlier work measured each provider quote at about 16 minutes behind the check that observes it (`docs/audits/20261111_BUILD_BOMB_BOTH_DIRECTIONS.md`). "First observed price after the level is crossed" therefore means a price that is already about a quarter-hour old.

### C4. What the model returns

**Verdict.** The model returns no stop and no target. The model-visible tool would have to change, or the levels would have to come from somewhere other than the model.

- Mid-battle tool: `api/_utils/agentEvalToolSchema.js:10` — `required: ['decision', 'rationale', 'conviction', 'hypothesis', 'riskAssessment'],`. Its other fields are the symbols in and out, the swap type, directive references, a status line, trade reasoning, cited rules and anticipation candidates. None is a price level for the new position; `hypothesis` is free text.
- The one typed level is in an optional "called shots" block: `api/_utils/agentEvalToolSchema.js:279` — `level: { type: 'number', description: 'The price level.' },`. Its own text forbids execution: `api/_utils/agentEvalToolSchema.js:444` — `'Nothing in this block executes a trade by itself, and it does not change this check\'s decision.';`. It is sent only to the cockpit cohort.
- Deploy tool: tickers and rationale text only (`api/_utils/agentToolSchema.js:59`).
- Four of the six swap sites open a position with no model output at all (the risk loop, the suppression pass, the gameplan leg, the guardrail-forced swap). A stop and target "declared when it opens" needs a source for those.

### C5. Where the entry price lives

- **Positions opened at the start:** `portfolio.startingPrices[symbol]` (`api/_utils/agentBattleService.js:174` — `startingPrices: { ...startingPrices },`).
- **Positions swapped in:** `swapPrice` on the slot, with `swappedInAt` and `swappedInDay` (`api/_utils/agentSwapExecution.js:431` — `swapPrice,`).
- **Measured battles, start and swap alike:** the slot's fill receipt: `api/_utils/stockThresholdAdmission.js:102` — `Object.assign(a, { positionId: p.positionId, slotVersion: 1, stockThresholdReceipt: receipt, swapPrice: receipt.fill, swappedInAt: at });`
- **Read precedence everywhere:** `api/cron/agent-evaluate.js:1975` — `const entryPrice = asset?.swapPrice || startingPrices[score.symbol] || 0;`
- A battle created late plays the next session, but its entry price is the creation-time price.

## Part D — bank on exit (BB-8)

Three terms used below. A **legacy battle** has no `scoring.stockThresholdModel` stamp on its record. A **measured battle** carries that stamp (the code calls it "corrected"). A **check** is one 15-minute run of the evaluator.

### D1. How a bonus or penalty banks today

**Verdict.** A bonus or penalty banks the first time a 15-minute check sees the price at the level, and it never un-banks. There are two server mechanisms, one for legacy battles and one for measured battles. For a legacy battle the phone also recomputes the score from live prices and can disagree with the server. The winner is read from the server's last stored score. A sold position keeps its points and its bonuses.

**Which path a battle takes.**
- `src/utils/stockThresholdModel.js:27` — `if (!Object.hasOwn(battle?.scoring || {}, 'stockThresholdModel')) return { status: 'legacy' };`
- A new tiered battle becomes measured when the production control record selects its owner: `api/_utils/stockThresholdAdmission.js:58` — `if (!stockAdmissionSelects(control, battleDoc.ownerId)) return null;`. The code flag is on: `src/config/featureFlags.js:3427` — `export const STOCK_MEASURED_THRESHOLDS_ADMISSION_ENABLED = true;`. Production (Appendix P): the control record is enabled for everyone, and 14 of the 16 agent-mode battles played since 19 Oct 2026 carry the stamp.
- Crypto stays on the legacy scorer even inside a measured battle: `api/cron/agent-evaluate.js:1295` — `if (correctedStockGame && isStock(asset)) return scoreCorrectedPosition(battle, asset, 'agent', prices, new Date().toISOString());`

**Legacy banking.** The battle stores each symbol's best and worst move in volatility units, and the scorer pays every tier those extremes reached.
- `api/_utils/agentScoring.js:280` — `const effectiveMax = Math.max(historyMax, highMultiplier, multiplier);`
- `api/_utils/agentScoring.js:288` — `const bonusPoints = calculatePointsServer(badges);`
- The cron passes no intraday high or low (`api/cron/agent-evaluate.js:1341` — `{},`), so "touch" means the quote at a 15-minute check, not a spike between checks.
- The level is measured from the swap price, else the entry price on day 1, else the previous close: `api/cron/agent-evaluate.js:1332` — `|| (isActivationDay ? (battle.portfolio?.startingPrices?.[asset.symbol] || previousClose) : previousClose);`

**Measured banking.** Each position has its own high and low since its fill, and tiers are measured from the fill.
- `src/utils/stockThresholdModel.js:74` — `const crossedTiers = targets.filter(t => t.k > 0 ? high >= t.target : low <= t.target).map(t => t.key);`
- A tier can never be un-earned: `src/utils/stockThresholdModel.js:75` — `h.crossedTiers.some(k => !crossedTiers.includes(k))) return unavailable('inconsistent_reward_history');`

**The nightly bank (legacy, multi-day only).** `api/cron/agent-daily-scores.js:198` — ``[`scoreState.bankedBadgePoints.total`]: FieldValue.increment(todayBadgePoints),``; then every symbol's history is zeroed (`api/cron/agent-daily-scores.js:162` — `maxMultiplier: 0,`). The same tier can therefore be earned again the next day against the previous close. This path is dormant today because every battle is one day (Part B).

**Score authorities.**
- Server total: `api/cron/agent-evaluate.js:1408` — `let currentScore = activeScore + bankedScore + bankedBadgePoints;`
- The legacy client recomputes from live prices and merges its own live move into the peak: `src/screens/AgentBattleScreen.jsx:348` — `maxMultiplier: Math.max(persistedHistory.maxMultiplier || 0, multiplier > 0 ? multiplier : 0),`. So the phone can show a bonus touched between checks that the server never banks.
- Measured battles have one authority; the client reads only the committed frame: `src/screens/AgentBattleScreen.jsx:268` — `const context = route.status === 'corrected' ? committedStockContext(stockBattle, asset, stockSide, tier, stockSlot) : route;`

**Winner.** `api/cron/agent-evaluate.js:7000` — `const result = currentScore > opponentScore ? 'win' : (currentScore < opponentScore ? 'loss' : 'draw');`. The expiry sweep completes a battle before any scoring in that run, so the deciding frame is the last check before the close; the closing price itself is not scored (not verified against a live battle). No `result` field is written on the battle (production probe: 0 of 40 recent battles carry one); readers re-derive it.

**Sold positions keep their points (a realised bucket).**
- Legacy: `api/_utils/agentSwapExecution.js:393` — `lockedPoints = scoreResult.totalPoints;` (base plus bonuses), summed at `api/cron/agent-evaluate.js:1402` — `return sum + (Number.isFinite(t?.lockedPoints) ? t.lockedPoints : 0);`
- Measured: `api/_utils/stockThresholdAdmission.js:276` — `components[out.positionId] = { status: 'closed', positionId: out.positionId, side: 'agent', points: score.totalPoints,`

**"LOCKED near a bonus threshold".** A position within 0.2 volatility units below its next bonus is locked.
- `api/_utils/agentRiskManager.js:155` — `if (atrMultiplier >= threshold - LOCK_PROXIMITY && atrMultiplier < threshold) {` (legacy)
- `src/utils/stockThresholdModel.js:81` — `locked: quote.price < nextTarget.target && distance > 0 && distance <= 0.2` (measured)
- It blocks the model's swap: `api/cron/agent-evaluate.js:3780` — ``validationErrors.push(`${haikuResult.symbolOut} is LOCKED (near bonus threshold) — swap blocked`);``
- It defers a breached stop, trailing stop or profit target for that check: `api/_utils/agentGuardrails.js:454` — `if (locked.has(forcedBreach.symbol)) {`. The deferral is re-evaluated each check and lasts until the price leaves the band.

### D2. Readers of the banked value

| Surface | Where |
|---|---|
| Board fuse | `src/components/BaggerBomb/ChamberFuse.jsx:230` — `? Object.fromEntries(Object.keys(MULTIPLIERS).map(key => [key, rewardContext.crossedTiers.includes(key)]))` |
| Proximity label | `src/components/BaggerBomb/computeProximity.js:51` — `const maxReached = history?.maxMultiplier \|\| 0;` |
| Touch celebration | `src/screens/battleView/deriveBaggerMoment.js:75` — `return c.crossedTiers.includes('bagger') ? BAGGER_LINE : 0;` |
| Score breakdown | `src/components/draft/ScoreBreakdownPopover.jsx:310` — `{bankedBadgePoints !== 0 && (` |
| Research modal, Bomb tab | `src/components/draft/ResearchTabs/BaggerBombTab.jsx:18` — `if (context.crossedTiers.includes(t.key)) return 'earned';` |
| Film Room tape | `api/_utils/filmTape/tapeAssemble.js:552` — `lockedPoints: num(action?.lockedPoints) ?? num(trade?.lockedPoints),`; `src/components/FilmRoom/TradeHistorySection.jsx:166` — `<span>Banked {trade.lockedPoints.toFixed(1)} pts</span>` |
| Reflection | `api/_utils/agentReflectionUtils.js:235` — ``return `  ${symbol}: baseATR=${t.threshold}, maxMult=${maxMult}, minMult=${minMult}`;`` |
| Daily review | `api/cron/agent-batch-review.js:291` (score line with banked parts) |
| Voice layer | `api/cron/voice-layer-cache.js:372` — `brief.existingBadges = [...c.crossedTiers];` |
| Trigger gate | Approach to a level opens the gate; a touch itself does not. `api/_utils/agentTriggerGate.js:104` — `if (mult > 0 && mult < threshold.level && mult >= threshold.level - 0.2) {` |
| Trailing-stop guardrail | `api/_utils/agentGuardrails.js:718` — `? battle?.scoring?.stockRiskHistory?.agent?.[position.positionId]` |
| Trait logger | `api/_utils/battlePatternLogger.js:182` — `if (max >= 1.0) bagger++;` |
| Hub | `src/components/CommandCenter/hub/gamesDisplay.js:48` — `scoreState: displayedStockScores(battle \|\| {}),` |
| Cockpit | A search of `api/agent/cockpit-status.js` and `api/agent/cockpit-bench.js` found no read of the banked value. |

**Forge rules that name thresholds** (`src/data/forgeKnowledgeBase.js`): mb-01 (`:576`), mb-08 (`:730` — `text: 'Do not swap any stock with positive P&L until it reaches the {threshold} scoring threshold',`), th-01 (`:1224`), th-04 (`:1251`), th-05 (`:1277`), th-08 (`:1328`), th-09 (`:1354`), th-10 (`:1379`, "In Harvest mode, swap stocks after BaggerBomb for fresh candidates"). Whether each can be equipped today is not verified.

**Tests that pin bank-on-touch** (a later build must change them deliberately): `src/screens/stockThresholdRendered.test.jsx:58`, `src/utils/stockThresholdModel.test.js:125`, `api/_utils/tournamentUserScoring.test.js:141`, `api/_utils/evalStockRewardBlock.test.js:44`, and the prompt goldens `api/_utils/agentEvalPromptAssembly.ask1.test.js` and `.ask2.test.js` (not opened).

### D3. What the trading brain is told about scoring

Which variant is live depends on three flags: `PROFIT_TARGET_EXECUTOR_ENABLED = true` (`src/config/featureFlags.js:2010`), `EQUIPPED_RULE_PRECEDENCE_ENABLED = false` (`:2142`), `CRYPTO_SLOT_PROMPT_ENABLED = true` (`:3416`). Measured or legacy wording is chosen per battle.

**Evaluator system prompt, `api/_utils/agentEvalPromptAssembly.js` (fenced):**
- `:363` — `actively managing a tiered stock portfolio to maximize your score.`
- `:367` — `Base points = (currentPrice - entryPrice) / entryPrice × 100 × 10 × tierMultiplier`
- `:368` — `Tier multipliers: Star = 2.0x, Core = 1.5x, Support = 1.0x`
- `:372` — `When you swap out an asset, its current points are LOCKED permanently. The incoming asset starts scoring fresh from its price at swap time.`
- `:133` — `Do NOT hold a bleeding loser just to avoid locking in a loss. If the`
- `:136` — `Ask: "Over the remaining battle time, which asset will earn MORE`
- `:255` — `Most evaluations should result in HOLD. Trading is expensive — the`
- `:256` — `incoming asset resets to 0 points and needs time to earn bonuses.`
- `:284` — `4. CLOCK MANAGEMENT: New assets start at 0 points and need TIME to reach`
- `:289` — `Late battle (<30% remaining): Swaps are DEFENSIVE ONLY — cut a`
- `:290` — `position approaching Bust/Crash to protect banked points. Do NOT`
- `:385` — `Star swaps affect score at 2.0x — high reward but high cost if wrong.`
- `:386` — `Support swaps are low-impact (1.0x) — safer to experiment.`
- `:387` — `Prefer swapping in Support tier unless the case for Star is overwhelming.`
- `:396` — `are not worth the cost of resetting a scoring baseline.`
- `:445` — `- LOCKED positions CANNOT be swapped out. Only hard stops override locks.`
- `:446` — `- If a position shows WARNING status, consider preemptive swap before penalty.`
- `:499` — `OR within 0.2x ATR of a penalty band (-10/-20/-35)`
- `:214` — `Deterministic protection floors are facts of the environment.`
- Not live while the profit-target flag is true: `:110` — `Do NOT sell a winner just to "bank" positive points if its momentum`
- League-only wording (hidden under BB-1): `:554`–`:566`, `:582`–`:586`, `:641`, `:729`–`:735`.

**Per-check context, same file:**
- `:1134` — the score line, `Current Score: … (Active: … + BankedTrades: … + BankedBadges: …)`
- `:1477` — ``` `${baseHeader},LockNow(base/badges),NextBonus,Levels` ```
- `:1487` — the measured position row: `crossed [...]`, `lock`, `next`, `points`
- `:1759` — `'CLOSED TRADES THIS BATTLE:\nSymbol,Tier,Exit Day,Entry→Exit (Now $Ghost),Gain%,Locked Pts'`
- `:1811` — ``entries.push(`${score.symbol}: LOCKED (${risk.detail})`);``
- `:834` — `YOUR FORGE RULES:` renders equipped rule text, including the threshold rules in D2.

**`api/_utils/evalStockRewardBlock.js` (a registered prompt module):**
- `:22` — the fixed table: "Threshold bonuses (flat, triggered when ATR multiplier … crosses level): +1.0x ATR → BaggerBomb: +15 pts … -2.0x ATR → Meltdown: -35 pts"
- `:24` — the measured rules, including "A quote at or beyond a target crosses it, and an earned tier stays earned for that position's life."
- `:26` and `:28` — "If an active stock is within 0.2x ATR of a bonus (+15/+30/+50), HOLD. Let it earn the bonus." and "seriously consider cutting it before the penalty locks in."
- `:34` and `:38` — two worked monologues ("a new position won't have time to reach the 1.0x ATR bonus", "locking in only -2.1 pts").

**Deploy prompt, `api/_utils/agentPromptAssembly.js` (fenced):**
- `:45` — `- Portfolio tiers: Star (2 stocks, 2x multiplier), Core (2 stocks, 1.5x), Support (2 stocks + 1 crypto, 1x)`
- `:47` — `- Scoring: priceChange × 10 × tierMultiplier + threshold bonuses`
- `:48` — `- Star amplifies gains AND losses — only put high-conviction plays here`
- `:49` — `- BaggerBomb bonuses: +15 (1x ATR), +30 (1.5x ATR), +50 (2x ATR)`
- `:50` — `- Bust penalties: -10 (1x ATR), -20 (1.5x ATR), -35 (2x ATR)`
- `api/_utils/archetypeScoring.js:93` — `Your edge is avoiding busts, not chasing baggers.`

**Tool schemas:**
- `api/_utils/agentToolSchema.js:59`, `:66`, `:73` — "Exactly 2 stock tickers for Star tier (2x multiplier)" and the Core and Support equivalents.
- `api/_utils/agentEvalToolSchema.js:46` — `Example: "Hypothesis: MSFT will reach 1.0x ATR bonus within the next trading day."`
- `api/_utils/agentEvalToolSchema.js:119` — the rule names `"bust_avoidance", "vwap_failure", "threshold_lock"`

**Chat, reflection, review:**
- `api/_utils/voiceLayerPrompt.js:61`–`:65` — the "BAGGERBOMB RULES (permanent)" block: tiers at 2x / 1.5x / 1x, "Points are scored when a stock's price move hits ATR-based threshold levels", "The goal: outscore the opponent over the battle duration."
- `api/_utils/agentReflectionUtils.js:210` — `Result: ${result}`, followed on the next line by the final score of both sides.
- `api/cron/agent-batch-review.js:261` and `:291`.
- A search of `api/agent/research.js`, `scouting-board.js`, `ensure-opener.js`, `call-response.js`, `chat.js` and `voiceLayerTradeNarration.js` found no scoring-rule wording.

## Part E — version stamp and the trader's line (BB-13, BB-11)

### E1. Version fields

**Verdict.** A battle carries no scoring-rules version today.

- **The measured-model stamp** is the nearest thing, on measured battles only: `api/_utils/stockThresholdAdmission.js:88` — `battleDoc.scoring.stockThresholdModel = { ...prepared.model, admittedAt: at };`. It holds a model id and hashes. Any other stamp value makes the battle unscoreable (`src/utils/stockThresholdModel.js:29`), so two measured versions cannot coexist today.
- **`scoring.stockScoreVersion` is a frame counter**, not a rules version: `api/_utils/stockThresholdAdmission.js:176` — `'scoring.stockScoreVersion': battle.scoring.stockScoreVersion + 1,`
- **`scoring.pointValues` and `scoring.tierMultipliers`** are written and never read: `api/_utils/agentBattleService.js:181` — `// Written-never-read snapshot (June 10 audit; founder ruling D1: the`
- **Manifest stamps** (flag `MANIFEST_WRITE_ENABLED = true`): `api/_utils/resolvedAgentManifest.js:195` — `gameModePolicyVersionAtLock: GAME_MODE_POLICY_VERSION,` and three siblings for prompt, guardrail and knob versions.

**Where a scoring version would be stamped.** The `scoring` block in `createAgentBattle` (`api/_utils/agentBattleService.js:179`, fenced record shape), or the measured decorator at `api/_utils/stockThresholdAdmission.js:88` (not a fenced file, but it alters the creation record, so it is fence contact by concept).

**Readers that would branch on it:** the server scorers (`api/_utils/agentScoring.js:225`, `src/utils/stockThresholdModel.js:62`), the swap writers (`api/_utils/agentSwapExecution.js:391`, `api/_utils/stockThresholdAdmission.js:258`), the nightly cron (`api/cron/agent-daily-scores.js:144`), the risk lock (`api/_utils/agentRiskManager.js:150`), the trigger gate (`api/_utils/agentTriggerGate.js:72`), the prompt switch (`api/cron/agent-evaluate.js:3152`), the client board (`src/screens/AgentBattleScreen.jsx:265`, `src/components/BaggerBomb/ChamberFuse.jsx:229`), the Film Room tape, reflection (`api/_utils/agentReflectionUtils.js:244`), the voice cache (`api/cron/voice-layer-cache.js:363`), the trait logger (`api/_utils/battlePatternLogger.js:174`), the stats writer (`api/cron/agent-evaluate.js:7306`) and the hub (`src/components/CommandCenter/hub/gamesDisplay.js:48`).

### E2. Closed trades, score series, and BB-11's three numbers

**Closed trades** are recorded in the battle's `trades[]` list.
- Legacy rows (`api/_utils/agentSwapExecution.js:398`–`:418`) hold `symbolOut`, `symbolIn`, `tier`, `slotIndex`, `entryPrice`, `exitPrice`, `lockedPoints`, `lockedGainPct`, `swappedOutAt`, `swapDay`, plus the caller's `trigger`, `rationale` and `exitReason`. A legacy row has an exit time and a reason but no entry time.
- Measured rows add `outgoingReceipt` (which holds the entry time), `rewardContext` and `outgoingRiskHistory` (`api/_utils/stockThresholdAdmission.js:270`).
- The list is capped at 50: `api/_utils/agentSwapExecution.js:499` — `const trades = [...(liveData.trades || []), closedTrade].slice(-50);`
- A position still held at the end has no trade row.

**Score series.**
- Every check writes a row under the battle's `ticks` subcollection with the active, banked, total and opponent scores (`api/_utils/tickCapture/captureSerializer.js:194`–`:198`). The flag is on: `src/config/featureFlags.js:2755` — `export const TICK_CAPTURE_ENABLED = true;`. A check with a degraded quote writes no score. Production coverage is in Part G.
- Checks that woke the model also store scores in `evaluations[]`, capped at 150.
- The battle stores its peak score but no trough (`scoreState.peakScore`).

**BB-11 today.**
- **Battles won per agent already exists.** `api/cron/agent-evaluate.js:7328`–`:7336` writes `stats` with wins, losses, draws, games played, total and average score, and streaks. League battles and no-result battles are skipped. The hub shows it: `src/components/CommandCenter/hub/selectors/loadout.js:199` — `const wins = agent.stats?.wins;`
- **Win rate by closed position, and average win against average loss,** can be computed per battle from `trades[].lockedPoints` or `lockedGainPct`, for at most 50 exits and excluding positions held to the end. Nothing is stored across battles.
- **Worst drawdown** can be computed per battle from the `ticks` series. It is stored nowhere.
- `BaggerBombScoreboard.jsx` is the scoreboard of the old human battle (rendered only at `src/components/BaggerBomb/BaggerBombBattleView.jsx:321`). It shows no trader statistics.

## Part F — Agent vs Agent (BB-15, BB-16)

"CPU" means two things in the code. The **CPU opponent** is the dummy book embedded in a BaggerBomb battle. A **league CPU seat** is a computer-run seat in a league group. This part keeps them apart.

### F1. The CPU opponent, and whether player-against-player BaggerBomb still exists

**Verdict.** The CPU opponent is a set of randomly picked stocks plus a crypto, chosen once at deploy and never traded. The battle compares the agent's score with that frozen book. Human-against-human BaggerBomb has no reachable start screen at today's flag values, but two of its crons still run. No agent-against-agent field exists anywhere outside the league.

**How the CPU opponent is built.**
- At deploy, after the model has finished: `api/agent/decide.js:837` — `const cpuOpponent = generateCPUOpponent(stockUniverse, CRYPTO_ASSETS, agentSymbols);`. This is the only production caller.
- Picks are random, one per sector: `api/_utils/cpuOpponentGenerator.js:37` — `const pick = sectorStocks[Math.floor(Math.random() * sectorStocks.length)];`. The agent's own symbols are excluded, so the two books never share a symbol today.

**What the opponent side of a battle holds.**
- A portfolio, a bench, a fixed name and a fixed id (`api/agent/decide.js:947` — `username: 'CPU Opponent',`), stored as given: `api/_utils/agentBattleService.js:177` — `opponent: options.opponent || null,`
- The opponent's entry prices and thresholds sit in the agent's own symbol-keyed maps on the same record.
- It is re-scored on every check and never trades: `api/cron/agent-evaluate.js:1349` — `let cpuAssetScores = cpuPortfolioFlat.map(asset => {`; the score is written at `api/cron/agent-evaluate.js:1414` — `'scoreState.opponentScore': Math.round(opponentScore * 100) / 100,`
- One missing opponent quote skips the agent's whole check: `api/cron/agent-evaluate.js:1238` — `const requiredQuoteSymbols = [...new Set([...portfolioSymbols, ...cpuSymbols])];`

**How the winner is decided.** `api/cron/agent-evaluate.js:7000` compares the two stored scores. The completion message hard-codes "CPU" (`api/cron/agent-evaluate.js:7005`). League battles get no result (`api/cron/agent-evaluate.js:6991` — `result: null,`). Production: of 90 completed battles between a player's agent and the CPU opponent, 42 are wins, 41 are losses and 7 have no score. The other eight agent-mode records are one active battle, four test battles run by CPU agents on 5 Aug 2026, and three March battles with no opponent.

**Human-against-human BaggerBomb.**
- **Starting one: dead.** The lobby screen exists (`src/App.jsx:9195` — `if (screen === 'baggerBombLobby') {`), but its only doors are in the two legacy dashboards, which lose both choices at today's flag values: `src/App.jsx:8984` — `const DashboardComponent = COMMAND_DASHBOARD_ENABLED ? CommandDashboard : DashboardLoop;` with `src/config/featureFlags.js:23` — `export const COMMAND_DASHBOARD_ENABLED = true;` and `src/config/featureFlags.js:35` — `export const COMMAND_DASHBOARD_DESKTOP_ENABLED = true;`. The current dashboards and the hub hold no reference to the lobby.
- **Opening an existing one:** the router still exists (`src/screens/BattleViewScreen.jsx:72`). Whether Battle History can open one is not verified.
- **Server work: still running.** `lobbies/cleanup-expired` runs every 15 minutes and `baggerbomb-v4-daily-scores` runs nightly (`vercel.json:45`, `:57`); both read the old `battles` collection. Production holds 76 records there: 66 still marked active and 10 waiting. The nightly job picks up 44 of the active ones every night. Only five records carry a creation date, all March 2026.
- **Shared parts are live.** The agent battle screen imports board components from the same folder (`src/screens/AgentBattleScreen.jsx:123` — `import TacticalRow from '../components/BaggerBomb/TacticalRow';`), so the folder is not one verdict.
- **Matchmaking:** only the league's. None exists for BaggerBomb.

**How the league pits agents against each other.** Each of four seats gets its own battle record with no opponent (`api/agent/decide.js:1559` — `opponent: null, // founder ruling D4: no embedded CPU opponent in tournament battles`). The records share a group id, and a group ledger stops two agents holding one symbol. Placement is by the weekly composite. This is the one precedent: separate records pointing at a shared parent, never at each other.

### F2. The two shapes for an agent opponent

No choice is made here. Common ground first:
- **The evaluator** lists battles with one query (`api/_utils/agentBattleService.js:52` — `.where('status', '==', 'active')`) and processes them one at a time. Each run of `processAgentBattle` is one record and one agent.
- **The lock** is one field per battle record, taken in a transaction (`api/cron/agent-evaluate.js:985` — `'cronState.evaluatingAt': new Date().toISOString(),`) and treated as stale after two minutes (`api/cron/agent-evaluate.js:241`).
- **Completion** is one transaction on one battle record plus its agent record (`api/cron/agent-evaluate.js:7062` — `const txOutcome = await db.runTransaction(async (t) => {`), fired per battle as it expires.

| Area | Shape (i): one record, two agent seats | Shape (ii): two records that reference each other |
|---|---|---|
| Evaluator | Every read of the book, the agent context, trades, checks, watch tiers and cron state is single-agent, and all would become seat-addressed. The six swap sites call the fenced executor, which opens the record by id (`api/_utils/agentSwapExecution.js:237` — `const battleRef = db.collection('agentBattles').doc(battleId);`). | The loop is unchanged. Each check reads the partner's record for its score: one extra read per battle. |
| Lock | One lock would make the two agents wait on each other; a per-seat lock is new. | Unchanged. The two checks are not simultaneous, so each side sees the other's score up to one check late. |
| Scoring | The symbol-keyed maps (thresholds, entry prices, touch history) collide if both agents hold one symbol at different entries. | Each record keeps computing its own score. The opponent score becomes a copy of the partner's score, and the CPU scoring block is skipped. |
| Completion | One transaction, two agent-record writes, two reflections. The reflection and review flags are single flags today. | Two transactions. Books can expire at different times when one holds crypto (8 PM against 4 PM, `src/utils/stockAdmissionWindow.js:72`), so "both final" needs a rule. |
| Film Room | The tape lives under the battle, so two agents would share one tape. | Unchanged per agent. The opponent label needs a third value: `api/_utils/filmTape/tapeAssemble.js:203` — `export const opponentBasisOf = (battle) => (isObj(battle?.opponent) ? 'cpu_portfolio' : 'none');` |
| Symbol exclusivity | Needed for correctness, or the maps must be re-keyed by seat. | Not needed for correctness; a product choice. The ledger is league-only today. |
| Reads and binding | The owner check and the client's battle lookup both assume one owner (F5). | Unchanged. |

In both shapes, measured thresholds require an embedded opponent today: `api/_utils/stockThresholdAdmission.js:49` — `if (battleDoc.gameMode !== 'baggerbomb_agent' || battleDoc.duration !== 'fullday' || !battleDoc.opponent?.portfolio) return null;`. A battle created without one silently becomes a legacy battle.

### F3. The deploy flow, and where pairing at the open could happen

**Verdict.** A battle is created active the moment the deploy finishes, priced at that moment. There is no waiting state, no cancel and no server-side hold. "Paired at the open" has no existing home.

- **The path.** The hub's press-and-hold control calls the deploy service (`src/contexts/DeployAttemptContext.jsx:493` — `result = await deployAgent(agent.id, onCreate, onTarget, { isCurrent });`), which first ensures the player's casual clone and then calls the deploy endpoint with only the agent id.
- **"Hold" is a 1.3-second press, not a reservation:** `src/hooks/useHoldToDeploy.js:209` — `const HOLD_MS = 1300;`. The "claim" is one variable in the browser tab: `src/hooks/holdClaim.js:54` — `let slot = null;`. Neither reserves anything on the server.
- **Server limits.** A two-minute deploy lock and cooldown (`api/agent/decide.js:184` — `if (deployAge < 120000) {`), and one active battle per agent (`api/agent/decide.js:758` — `.where('agentId', '==', agentDoc.id)`). With one clone per player, that is one BaggerBomb battle per player at a time.
- **Between deploy and the open.** The battle is already active: `api/_utils/agentBattleService.js:142` — `status: 'active',`. A deploy overnight or in the last 45 minutes of a session targets the next session, and the evaluator skips it until then (`api/cron/agent-evaluate.js:930` — `if (beforeFirstTradingDay(battle)) {`). Any other deploy plays the same day, starting mid-session. Its entry prices are the deploy-moment prices, not the open.
- **Cancel: none.** Clients cannot create or delete a battle (`firestore.rules:480` — `allow create, delete: if false;`), and no cancel, forfeit or recall endpoint was found. The only status change is expiry.
- **Where pairing could run.**
  - *At deploy,* inside the fenced deploy endpoint. The partner may not have deployed yet.
  - *In a cron near the open.* `process-draft-claims` is the pattern for an Eastern-Time minute: a 9:20–9:35 ET window, two UTC schedule entries and a per-day stamp (`vercel.json:74` — `"schedule": "25 13,14 * * 1-5"`; `api/cron/process-draft-claims.js:569` — `if (!win.inWindow) {`).
  - *In the evaluator.* Its pre-open runs already do the expiry sweep and stop at `api/cron/agent-evaluate.js:455`. A pairing step could branch there, or in the first open check, with no new schedule entry.
  - The cron budget is 45 of 100 (BUILD_RULES §6), which prefers branching inside an existing handler.

### F4. Rank stores outside the league, and the CPU-farm guard

**Verdict.** Outside the league, an agent battle feeds only the agent's win and loss record, a level computed from games played, and a dark mastery ledger. None of them tells a win over the CPU from any other win, and every win on record today is a win over the CPU.

| Store | What it ranks | Writer | Do CPU battles count? |
|---|---|---|---|
| `compute-rankings`, `rankingConfig.js`, `archetypeScoring.js`, `CompeteTab` | Stocks | the daily stock cron | not applicable |
| Agent `stats` (wins, losses, draws, games played, streaks) | Agents | `api/cron/agent-evaluate.js:7327` — `t.update(statsTargetRef, {`, redirected from a casual clone to its parent agent (`api/_utils/casualClone.js:385`) | Yes. Only CPU battles feed it today; league battles are excluded. |
| Agent level | Agents, from games played only (`src/constants/agentProgression.js:60` — `if (gamesPlayed >= 15) return 'partner';`) | computed on read | Yes |
| Mastery | Players, per archetype | dark: `api/_utils/masteryConfig.js:41` — `export const MASTERY_XP_ENABLED = false; // P4 cutover flips this (§7). Keep false through P1–P3.` | It would count them at full weight: `api/_utils/masterySettlement.js:131` — `if (gameMode === TIERED_GAME_MODE) return 'ranked';` |
| League `tournamentRanks` | Players | league settlement only | guarded (below) |

No live agent leaderboard exists.

**The CPU-farm guard is league-only.** It counts CPU seats in a group of four and scales down positive rank points: `src/constants/leagueTournament.js:1097` — `return 1 - n / (GROUP_SIZE - 1);` and `src/constants/leagueTournament.js:1114` — `return { raw, guard, delta: raw > 0 ? raw * guard : raw };`. Against three CPUs a player earns no positive points. Outside the league no flag, field or check marks a battle as practice or as rank-eligible (searches for such names returned nothing).

**Candidates for "Agent vs Agent carries the rank"** (no choice made): the agent `stats` record, with CPU battles excluded from it; a new agent-level rating; the player-level league rank, which BB-1 hides; or mastery, which is dark and per player.

### F5. What the rules let a player read of an opponent

**Verdict.** Every agent battle and agent record is readable by its owner only, or by the server only. Nearly everything private (chat, the current instruction, the list, the hot bench, guardrail levels, the reasoning feed, proposals, the loadout) is a field on the battle record itself. A shared battle record would therefore expose all of it. Two separate records expose nothing, and also show nothing of the opponent without a server-built view. Whether the deployed rules match this file is not verified.

**Who can read what today.**

| Record | Rule (`firestore.rules`) | Who reads |
|---|---|---|
| Agent battle | `firestore.rules:471` — `allow read: if request.auth != null`; `firestore.rules:472` — `&& resource.data.ownerId == request.auth.uid;` | Owner only |
| Battle sub-records: intraday views, declarations, calls, call observations, call events | `firestore.rules:491` — `&& get(/databases/$(database)/documents/agentBattles/$(battleId)).data.ownerId == request.auth.uid;` (same shape at `:504`–`:525`) | Owner of the parent battle |
| Film tape under a battle | `firestore.rules:539` — `allow read: if request.auth != null && resource.data.ownerId == request.auth.uid;` | Owner |
| Tick capture under a battle | no rule block; the default applies: `firestore.rules:1517` — `allow read, write: if false;` | Nobody (server only) |
| Agent | `firestore.rules:246` — `allow read: if request.auth != null`; `firestore.rules:247` — `&& resource.data.ownerId == request.auth.uid;` | Owner only |
| Agent sub-records: rules, bundles, battle patterns, Film Room plays | `firestore.rules:353`, `:463` | Owner |
| Watchlists ("the list") | `firestore.rules:1211` — `&& resource.data.userId == request.auth.uid;` | Owner |
| League group and everything under it | `firestore.rules:649` — `allow read: if request.auth != null;`; `firestore.rules:659` — `allow read: if request.auth != null;` | Any signed-in user |
| League ranks, leaderboards, lobby | `firestore.rules:681`, `:686`, `:862` | Any signed-in user |
| User profile | `firestore.rules:162` — `allow read: if request.auth != null;` | Any signed-in user |
| Old human battle (`battles`) | `firestore.rules:606` — `allow read: if request.auth != null;`; `firestore.rules:608` — `allow update: if request.auth != null;` | Any signed-in user can read and write |

**Private things that are fields on the battle record** (so they travel with any read of it):

| Private thing | Field | Where written |
|---|---|---|
| Chat with the agent | `chatExchanges[]` | `api/_utils/agentBattleService.js:293` — `chatExchanges: [],              // Open chat history (Sprint 6)` |
| The current instruction | `directive` | `api/agent/chat.js:1174` — `directive: buildDirectiveSlot(lintedDirective, directiveThreadId, new Date().toISOString()),` |
| The list | `agentContext.equippedWatchlist` | `api/_utils/agentBattleService.js:208` — `equippedWatchlist: options.equippedWatchlist` |
| The hot bench | `watchlist.hotBench` | `api/cron/agent-evaluate.js:1666` — `hotBench: newHotBench,` |
| Reasoning and feed | `statusFeed[]`, `evaluations[]`, `agentContext.innerMonologue` | `api/_utils/agentBattleService.js:278`–`:280` |
| Proposals | `pendingProposal`, `proposalHistory`, `battleLedger` | `api/_utils/agentBattleService.js:288` — `pendingProposal: null,          // Set when Haiku proposes a swap in copilot/manual mode` |
| Stop and target levels | `agentContext.deployedGuardrails` | `api/_utils/agentBattleService.js:200` — `deployedGuardrails: Array.isArray(agentData.deployedStrategy?.guardrails)` |
| The loadout | `agentContext.activeRules`, the customization snapshot, `resolvedAgentManifest` | `api/_utils/agentBattleService.js:196` — `activeRules: agentData.activeRules \|\| [],` |

**The league precedent.** A league player never reads a rival's battle from the database. The client calls one server endpoint, which builds a view per viewer: `api/tournament/battle-view.js:55` — `battles[ownerId] = projectTournamentBattle(battle, { isOwner: ownerId === viewerUid });`
- While the battle is active, a non-owner gets an allowlist: positions, bench, thresholds, scores, the agent's name and archetype, and trimmed feed and trade rows (`api/_utils/tournamentBattleView.js:45` — `const PUBLIC_AGENT_CONTEXT = ['agentName', 'archetype', 'tournament', 'initialPortfolio'];`). The allowlist includes `ownerId`, so account ids travel to other players' browsers (`api/_utils/tournamentBattleView.js:37`).
- Once the battle completes, a non-owner gets the whole record minus one key: `api/_utils/tournamentBattleView.js:100` — `if (battle.status === 'completed') {`; `api/_utils/tournamentBattleView.js:105` — `return { ...battle, agentContext };`. That includes chat, the instruction, the list and the hot bench. League battles complete every day, so this opens each evening.
- The endpoint has no membership check. Its only gates are a sign-in (`api/tournament/battle-view.js:31` — `const user = await requireAuth(req, res);`) and a well-formed group id, and group ids are readable by any signed-in user.

**What each Agent vs Agent shape would expose.**
- **One record, two seats.** Any rule that lets the second owner read the record hands over every field in the table above. The owner's write allowlist and the five sub-record rules are keyed to a single `ownerId`, so both would need rework. Smallest rule shape: read for either seat's owner, safe only after every private field moves to per-seat, owner-only sub-records.
- **Two records that reference each other.** Under today's rules each stays owner-only: nothing is exposed and nothing of the opponent is visible. The opponent's board then comes from a server-built view or a server-written public copy, and the exposure is exactly what that view includes. Reusing the league view as it stands would open the rival's full record at each completion. Smallest rule shape: no rule change.

**What the client reads for the CPU side today** (the minimum an opponent's board needs): the CPU's static positions in three tiers (`src/screens/AgentBattleScreen.jsx:1477` — `const liveOpponentPortfolio = useContentStable(controllerOn ? (agentBattle?.opponent?.portfolio || null) : null);`), each with symbol, name, price and volatility base; the shared thresholds and entry prices; and one stored opponent score (`scoreState.opponentScore`). The CPU has no trades and no banked points, and its name is a fixed label (`api/agent/decide.js:947` — `username: 'CPU Opponent',`). An agent opponent's board would also need its banked points from closed trades.

**Rules tests that pin these reads:** `test/rules/agentsOwnerRead.rules.mjs`, `agentBattlesHypothesisCarriage.rules.mjs`, `intradayViewsDenials.rules.mjs`, the four call-record suites, `filmTapeDenials.rules.mjs`, `filmRoomPlaysDenials.rules.mjs`, `tickCaptureDenials.rules.mjs`. No suite pins the league-group "any signed-in user" read.

## Part G — rescoring past battles (BB-14)

### G1. Can a finished battle be rescored from stored data alone?

**Verdict.** Yes for one half of BB-8 and no for the other. "The bonus counts only if the price at exit still clears the level" can be rescored from stored data, with no model call and no price path. "Or when the stop has moved beyond the level" cannot: no stop is stored for any past position.

**Why no price path is needed.** A "touch" today is already a stored number. Every agent scoring call passes empty intraday extremes, so a touch is the highest multiple seen at a 15-minute check, and that is what the battle stores.
- `api/cron/agent-evaluate.js:1340` — `battle.thresholdHistory?.[asset.symbol] || {},`
- `api/_utils/agentSwapExecution.js:391` — `const scoreResult = calculateAssetScoreServer(assetObj, rawPctChange, assetHistory, {}, thresholdPriceChange);`

**No model is in the scoring path.** `api/_utils/agentScoring.js:25` — `import { calculateAssetScoreV3 } from '../../src/utils/baggerBombUtils.js';` is its only non-constant import, and the scorer is arithmetic.

**What is stored, and since when.**

| Store | Fields | Written at | Since |
|---|---|---|---|
| Entry at deploy | `portfolio.startingPrices` | `api/_utils/agentBattleService.js:174` — `startingPrices: { ...startingPrices },` | always |
| Entry on swap-in | `swapPrice`, `swappedInAt` on the slot | `api/_utils/agentSwapExecution.js:431` — `swapPrice,` | always |
| Closed trades | `trades[]`: `entryPrice`, `exitPrice`, `lockedPoints`, `swappedOutAt`, `tier`, `exitReason` | `api/_utils/agentSwapExecution.js:406` — `lockedPoints: Math.round(lockedPoints * 100) / 100,` | always; last 50 only |
| Touch record (legacy) | `thresholdHistory[symbol].maxMultiplier` and `minMultiplier` | `api/cron/agent-evaluate.js:1484` | always |
| Sale-time touch record | `learningReceipts/{battleId}/receipts/{id}.guardrailReplay` | `api/_utils/learning/captureReceipt.js:421` — `await ref.create(receipt);` | model-decided swaps from 12 Jul 2026; all swap kinds from 10 Aug 2026 (flip-commit dates) |
| Measured model | the stamp, each slot's fill receipt, per-position high, low and crossed tiers | `api/_utils/stockThresholdAdmission.js:88` | code flag on from 15 Oct 2026; production dates in the counts below |
| Last price of a position held to the end | legacy `cronState.lastTickPrice[symbol]`; measured, the stored reward context | `api/cron/agent-evaluate.js:2002` — `lastTickPrice[score.symbol] = stag.lastTickPrice;` | from 30 May 2026 |
| Final scores | `scoreState.currentScore`, `scoreState.opponentScore` | `api/cron/agent-evaluate.js:1413` — `'scoreState.currentScore': Math.round(currentScore * 100) / 100,` | always |
| Per-check records | `agentBattles/{id}/ticks` | `src/config/featureFlags.js:2755` — `export const TICK_CAPTURE_ENABLED = true;` | flag on from 21 Sep 2026; request bodies expire after 120 days |
| Film tape (10-minute bars) | `agentBattles/{id}/tape/{date}/series/{symbol}` | `src/config/featureFlags.js:3041` — `export const FILM_TAPE_WRITE_ENABLED = true;` | flag on from 1 Oct 2026; stocks only |

**The finished legacy record is rewritten before it completes.** The nightly job takes every active battle at 01:45 UTC, moves the touch record to `thresholdHistory[symbol].dailyThresholds.day1`, zeroes the live fields (`api/cron/agent-daily-scores.js:196` — `thresholdHistory: resetHistory,`) and renames `swapPrice` (`api/cron/agent-daily-scores.js:185` — `asset.previousSwapPrice = asset.swapPrice;`). A rescore must read either shape.

**Gaps that make a battle not rescorable, or only partly.**
1. **The stop half, every battle.** No stop is stored: `api/_utils/learning/learningSchemas.js:158` — `highWaterMark: null, // NOT stored — null-flagged`
2. **More than 50 swaps:** older trade rows are gone.
3. **Legacy sales carry one total** with no split between base points and bonus. The split is recoverable by arithmetic, but the touch record at the moment of sale needs the receipt, which swaps not decided by the model lack before 10 Aug 2026.
4. **"Result unavailable" completions** have no score to compare.
5. **Entry prices set before the 14 Oct 2026 invalid-quote fix** may be wrong, and nothing on the battle marks them.
6. **Baselines taken from the previous close** are not stored.

**Production count** (agent-mode battles whose trading day is on or after 10 Aug 2026):

| Archetype | Completed | Complete data | With a gap |
|---|---|---|---|
| momentum_chaser | 20 | 19 | 1 |
| diversifier | 13 | 11 | 2 |
| contrarian | 6 | 5 | 1 |
| analyst | 4 | 3 | 1 |
| degen | 4 | 3 | 1 |
| guardian | 2 | 2 | 0 |
| **Total** | **49** | **43** | **6** |

- By scoring path: 30 legacy and 13 measured battles are complete; all 6 gaps are legacy.
- Gap reasons (a battle can have more than one): no last price for a held position, 5; no final score, 4; no touch record, 1; fewer sale receipts than sales, 1.
- "Complete" here means the stored-field checklist passed: final scores for both sides; a full trade list under the cap, each row with entry price, exit price, points and tier; and per held position an entry price, a volatility base, a touch record and a last price (legacy), or a fill receipt, a reward history and a valid last frame (measured). The final gate, that a script reproduces the stored score before it rescores, was not run.
- Two more limits of this count. The sale receipts were counted, not opened, so the touch record inside each is assumed present. Measured battles were checked on the agent's side only; the CPU side's stored history was not checked, and a rescore needs both.
- 16 of the 49 battles made no sale at all, so for them BB-8 changes only positions held to the end.
- No battle is near the 50-trade cap (the most is 26).
- Per-check score rows (`ticks`) exist for 31 of the 49, from 22 Sep 2026, with a median of 20 rows a battle. Four battles after that date have none. Film tape exists for 35 of the 49, from 21 Sep 2026.

### G2. The smallest script

**Recommendation.** Extend `scripts/calibration/export-agent-battles.js` to also read each battle's receipts, and run it read-only on the founder's machine to a local file. Add one offline script that calls the imported scorer twice per position, once as recorded and once with the stored upside touch record reset, and reports score changes and winner flips by archetype. No model, no price fetch, no production write; the stop half is left out.

- The exporter already reads finished battles: `scripts/calibration/export-agent-battles.js:105` — `if (flags.status && flags.status !== 'all') q = q.where('status', '==', flags.status);`. It lacks sub-record reads and any scoring.
- The offline pattern exists: `scripts/calibration/aggregate-real-battles.js:33` — `// Offline + deterministic: no network, no Firestore read/write, no Date.now,`
- A script importing the fenced scorer has precedent: `scripts/experiments/growth-replay/changedMomentsScore.js:207` — `import { calculateAssetScoreServer, THRESHOLD_MULTIPLIERS, getBadgesFromHistoryServer } from '../../../api/_utils/agentScoring.js';`
- **Legacy battles need no new scoring math.** The scorer takes the touch record as an argument, so "bank on exit" is the same call with the stored upside peak set to zero and the stored downside kept.
- **Measured battles:** the scorer takes its earned tiers from the stored context (`src/utils/baggerBombUtils.js:540` — `const badges = rewardContext.crossedTiers;`). Resetting the stored high to the fill and trimming the earned tiers to the penalty keys should pass the model's guards. This was traced by reading and not run.
- The scripts named in the prompt (`threshold-audit*.js`, `collect-threshold-export.js`, `threshold-closeout.verify.mjs`) audit the volatility measurement, not battle scores. `export-film-tape.js` only prints tapes. `paired-eval-harness.js` replays prompts through a model.
- **Direction of the result.** In legacy battles the CPU side has no touch memory (`api/cron/agent-evaluate.js:1391` — `{},` is the history argument of its scoring call), so its bonuses already follow the last price. BB-8 would therefore leave the CPU's score unchanged and could only lower the agent's. Measured battles ratchet both sides.

## Part H — match cash (BB-4 to BB-6)

### H1. Tier multipliers, slot counts, and every place that would show dollars

**Verdict.** Today's multipliers are Star 2.0, Core 1.5, Support 1.0, with two, two and three slots. The numbers 20, 15 and 10 already exist in code as each slot's `allocation`, and they map exactly onto those multipliers. No cash, notional value or share count exists anywhere in agent-mode BaggerBomb. Points alone already decide the winner.

- **Multipliers:** `src/constants/baggerBombScoring.js:57` — `star: 2.0,` (Core 1.5 at `:58`, Support 1.0 at `:59`). They apply to percentage points only: `src/utils/baggerBombUtils.js:596` — `const basePoints = priceChange * 10 * tierMultiplier;`. Bonuses are flat.
- **Slots:** `src/constants/agentGameModes.js:45` — `composition: Object.freeze({ star: 2, core: 2, support: 3 }),` (the third Support slot is crypto). The league mode uses two, two and two with a flat multiplier of 1.0 (`:61`, `:70`).
- **How a tier is stored:** by which list the position sits in (`api/_utils/agentBattleService.js:165`). A closed trade carries `tier`. The record's own multiplier table is never read.
- **20/15/10 already exists:** `api/_utils/agentScoring.js:42` — `if (asset) flat.push({ ...asset, tier: 'star', allocation: 20, slotIndex: index });` (Core 15 at `:45`, Support 10 at `:48`). Two at 20, two at 15 and three at 10 add to exactly 100.
- **The mapping.** Multiplier equals allocation divided by ten, so base points equal the percentage move times the allocation. On $1,000,000 that is $100 per base point, but only if each slot keeps a fixed dollar size. A swapped-in position scores at the full multiplier from its own fill, so the equivalence fails if sale proceeds are reinvested. Flat bonuses and penalties have no dollar equivalent.
- **Dollars shown today are per-share prices only.** The model sees them in the positions table (`api/_utils/agentEvalPromptAssembly.js:1476` — `: 'Tier,Symbol,Sector,Entry,$Entry,$Current,Gain%,ATR Mult,Badges,ATR%';`); the board shows a tier label such as "2x" (`src/screens/AgentBattleScreen.jsx:168`). A search for cash, notional, position size, shares and capital across the battle screen, the board components, the hub, the Film Room, the research modal, `api/agent`, the film tape and the evaluator found no size concept.
- **A position-size guardrail exists as a stub:** `api/_utils/agentGuardrails.js:410` — `// ---- 4) Max position size (hard): architecturally N/A for BaggerBomb ----`
- **Places that would show dollars if match cash is built:** the board's tier headers and position rows, the score breakdown, the hub's game rows and deploy card, the Film Room trade rows ("Banked … pts"), the research modal's Bomb tab, the reflection and daily-review prompts, the per-check positions table and score line, and the chat rules block. All of these show points or per-share prices today; the readers are the ones listed in D2.
- **The model's tier lines** (all would change): `api/_utils/agentPromptAssembly.js:45`, `api/_utils/agentEvalPromptAssembly.js:368` and `:385`, `api/_utils/agentToolSchema.js:59` — `description: 'Exactly 2 stock tickers for Star tier (2x multiplier)',`, and `api/_utils/voiceLayerPrompt.js:62` — `Stocks are placed in three tiers: Star (2x points), Core (1.5x points), Support (1x points).`
- **Winner:** `api/cron/agent-evaluate.js:7000` compares the two stored scores. This matches "points alone decide the winner".

## Fence contact

"Fenced" means BUILD_RULES §1: reading and calling is allowed, editing needs the founder's gate. The creation record of a battle and the scoring engine are fenced as concepts, so a change to them from a non-fenced file counts too.

| Part | File | Why a change would touch it |
|---|---|---|
| A (BB-1) | none | The client hide and the closed entry doors are in non-fenced files. A league week in flight uses fenced files unchanged. |
| B (BB-3) | `api/_utils/agentBattleService.js` | The one-day constant, the trading-day list, the stored length and the expiry are all part of the creation record. |
| B | `api/agent/decide.js` | Accepting and validating a length; the league path's fixed one day. |
| B | `api/_utils/agentSwapExecution.js` | The 50-trade cap and the entry-price precedence. |
| B | `api/_utils/agentScoring.js` (scoring concept) | Whether thresholds count per day or from entry across days. |
| B | `api/_utils/agentGuardrails.js` | The trailing stop reads the history that the nightly job zeroes. |
| B | not fenced, but owner-approved and hash-pinned | The measured-threshold policy file, `src/utils/stockThresholdModel.js`, `api/_utils/stockThresholdAdmission.js`; and the nightly job `api/cron/agent-daily-scores.js`. |
| C (BB-7) | `api/_utils/agentGuardrails.js` | Per-position levels, and any change to when a stop or target fires. |
| C | `api/_utils/agentSwapExecution.js` | The entry-price fallback; storing a stop and target on the incoming position; any exit that is not a swap. |
| C | `api/_utils/agentBattleService.js` | A stop and target on the positions a battle starts with. |
| C | `api/agent/decide.js` | Deploy-time picks that carry levels. |
| C | `api/_utils/agentRiskManager.js` | Where a new exit reason sits among the existing bypass rules; the replacement picker. |
| C | both prompt assemblers | Telling the model to declare levels. |
| C | not fenced | `api/cron/agent-evaluate.js` (a seventh exit site with the reserve, confirm and release wrapper; four tests pin six), `api/_utils/stockThresholdAdmission.js`. |
| D (BB-8) | `api/_utils/agentScoring.js` and the scorer `calculateAssetScoreV3` | When a bonus counts. |
| D | `api/_utils/agentSwapExecution.js` | The exit is where a bonus would bank; the closed-trade fields. |
| D | `api/_utils/agentRiskManager.js` | The lock exists to let a touch bank. |
| D | `api/_utils/agentGuardrails.js` | The lock deferral; the trailing stop reads the peak. |
| D | `api/_utils/agentEvalPromptAssembly.js`, `api/_utils/agentPromptAssembly.js` | The scoring wording (D3). |
| D | `api/_utils/tournamentUserScoring.js` | It ports the same threshold math; league only. |
| D | not fenced, scoring concept | `src/utils/stockThresholdModel.js`, `api/_utils/stockThresholdAdmission.js`, `api/cron/agent-daily-scores.js`. |
| E (BB-13) | `api/_utils/agentBattleService.js` | A version stamp changes the creation record. |
| E (BB-11) | none | The three numbers can be computed by a non-fenced reader. |
| F (BB-15, BB-16) | `api/_utils/agentBattleService.js` | An opponent agent, a paired-battle reference, a rank-eligibility stamp or a waiting status, each at creation. |
| F | `api/agent/decide.js` | It builds the CPU opponent and enforces one active battle per agent; pairing at deploy would be an edit here. |
| F | `api/_utils/agentScoring.js` (scoring concept) | Who computes the opponent's score. The two-record shape can avoid this by copying the partner's stored score. |
| F | `api/_utils/agentSwapExecution.js`, `api/_utils/agentGuardrails.js`, `api/_utils/agentRiskManager.js` | The one-record shape only: each addresses one book per record. |
| F | both prompt assemblers | Only if the trading model is told about its opponent. |
| F | BUILD_RULES §6 | A new job at the open counts against the cron budget (45 of 100) and needs the Eastern-Time pattern. |
| G (BB-14) | none edited | The script calls the real scorer. Whether handing it a reset touch record counts as "a local copy of scoring math" (BUILD_RULES §4) is founder question 20. |
| H (BB-4 to BB-6) | `api/_utils/agentBattleService.js` | A cash or size field at creation. |
| H | `api/_utils/agentScoring.js` | The `allocation` values. |
| H | `api/_utils/agentGuardrails.js` | The position-size guardrail would become live. |
| H | both prompt assemblers | The tier wording. |

## What the model would see differently

| Part | What changes |
|---|---|
| A (BB-1) | Nothing. One model call stops when the league stops: the Monday agent-board production. |
| B (BB-3) | The per-check header already prints the length, and its values change: `api/_utils/agentEvalPromptAssembly.js:1133` — `Day ${currentDay} of ${totalDays} \| ${timeRemaining} remaining \| Phase: ${phase}`. The banked-badges figure becomes non-zero from day 2 on legacy battles. The reflection prompt prints the stored length (`api/_utils/agentReflectionUtils.js:209`). The call horizon "this battle" starts to mean several days. |
| C (BB-7) | New stop and target fields on the mid-battle tool (`api/_utils/agentEvalToolSchema.js`), and on the deploy tool if deploy picks declare levels (`api/_utils/agentToolSchema.js`). The profit-target rule text, which today tells the model the engine enforces one percentage (`api/_utils/agentEvalPromptAssembly.js:197`). The preset guidance (`api/_utils/agentEvalPromptAssembly.js:1156`). |
| D (BB-8) | Every line in D3. The largest: "LOCKED permanently" on a swap; "an earned tier stays earned"; "HOLD. Let it earn the bonus"; the crossed, lock, next-bonus and lock-now cells of the positions table; the banked-badges part of the score line; the worked monologues; the `threshold_lock` rule name in the tool; the Forge threshold rules; the chat rules block. |
| E (BB-13, BB-11) | Nothing by itself. The wording switch between legacy and measured battles (`api/cron/agent-evaluate.js:3152`) would gain a third case. |
| F (BB-15, BB-16) | The trading model sees no opponent today: neither assembler and neither tool schema mentions one. The chat voice sees the score gap (`api/_utils/voiceLayerPrompt.js:1165`), reflection sees the result and the opponent's score (`api/_utils/agentReflectionUtils.js:211`), and memory consolidation reads the record (`api/_utils/agentConsolidationPrompt.js:301`). A live, trading opponent changes what those numbers mean. Any opponent name, rank or holdings in a prompt would be new. |
| G (BB-14) | Nothing. The rescore is offline. |
| H (BB-4 to BB-6) | Every tier line: `api/_utils/agentPromptAssembly.js:45`, `api/_utils/agentEvalPromptAssembly.js:368` and `:385`, `api/_utils/agentToolSchema.js:59`, `:66`, `:73`, and `api/_utils/voiceLayerPrompt.js:62`. Through `allocation`, the Huddle's exposure ranking too. |

## Surprises: code that contradicts a ruling

1. **BB-3. Every battle is one trading day, and three things pin it.** The creation constant (`api/_utils/agentBattleService.js:41`), the approved measured-threshold policy (one day only), and a league test that fails if the constant changes. Production: 642 of 645 agent battles are one day; the other three are from March.
2. **BB-7. No position has ever carried a stop or a target.** The existing stop is one percentage per battle, set by the player in a screen that may no longer be reachable, and none of the 645 battles and 104 agents on record has one. The machinery is on and has never fired.
3. **BB-7. A player stop does not run on a quiet check.** It runs only when the trigger gate wakes the model, or on three special paths. A battle the loop does not reach in time gets no check at all.
4. **BB-7. Every exit is a swap.** No replacement on the bench means no exit that check. A position locked near a bonus is not exited. Only one forced exit happens per check. A replacement in a distressed regime blocks the swap.
5. **BB-7. "A missing price never produces a fill" is not true of the legacy executor.** It falls back to the entry price when the outgoing quote is missing (latent today), and it accepts yesterday's close as the current price. The measured executor refuses both.
6. **BB-7. "The first observed price after the level is crossed" is about 16 minutes old.** Each provider quote is 15.5 to 17.5 minutes behind the check that reads it, as measured on 11 Nov 2026.
7. **BB-8. The model is told the opposite in about 30 places,** and the lock exists so that a touch can bank. The prompt also says hard stops override locks; the code defers them.
8. **BB-8. "Penalties measured from entry" is not what the legacy path does from day 2.** It measures from the previous close and lets a tier be earned again each day. Dormant while battles are one day.
9. **BB-1. The existing flags do not do what the ruling asks.** `TOURNAMENT_TAB_ENABLED` removes the slot and leaves five doors open. `LEAGUE_LIVE_DRAFT` and `LEAGUE_NEXT_ARC_ENABLED` would strand a group in flight. There is no league week in progress to settle.
10. **BB-13. A battle has no scoring version,** and two measured versions cannot coexist: any stamp other than the one accepted value makes a battle unscoreable.
11. **BB-14. Half of BB-8 cannot be rescored.** No stop was ever stored. And on legacy battles the rescore can only lower the agent's score, because the CPU side never had a touch memory, so winner flips run one way.
12. **BB-15. "Paired at the open" has no home.** A battle starts at the moment of deploy, mid-session included, priced at that moment, with no waiting state and no cancel. There is one length, so there is nothing to pair by yet.
13. **BB-16. "Agent vs CPU is practice" is the reverse of today.** Wins over the CPU are the only thing that moves an agent's record, and the dark mastery ledger labels them "ranked".
14. **BB-15. The hub treats any battle with a group id as a league battle** (`src/utils/commandCenterLiveBattles.js:65`), and its wording assumes a CPU. A pairing that stamps a group id would be labelled "Ranked · League group".
15. **BB-4 to BB-6. The 20/15/10 sizes equal today's multipliers only while each slot keeps a fixed size.** A swapped-in position scores at the full multiplier from its own fill. If sale proceeds were reinvested, the multiplier would become a new number. Flat bonuses and penalties have no dollar equivalent.
16. **BB-11. The drawdown series is partial.** Per-check score rows start on 22 Sep 2026, are missing for four battles since, and are not written on a check with a degraded quote.
17. **Scale.** Six accounts have ever played an agent-mode battle, three of them in the last 30 days. Those 30 days hold 17 battles on 14 trading days, and two battles fell on the same day three times. Two human accounts have ever sat in a league group. At this scale, pairing by rank at the open will usually find nobody to pair with.

## Bugs and hazards found outside the task

Reported for separate tasking, not fixed (BUILD_RULES §3).

1. **The league view opens a rival's whole battle at completion.** Chat, the instruction, the list and the hot bench are returned to any signed-in caller holding a group id, there is no membership check, and account ids travel in the live view (F5).
2. **`/api/agent/set-opponent` has no caller and still accepts client-supplied prices and thresholds** for a battle under five minutes old with no opponent, which is every new league battle (`api/agent/set-opponent.js:65`, `:101`, `:102`).
3. **Any signed-in user can update any record in the old `battles` collection** (`firestore.rules:608`).
4. **Multi-day, dormant:** the nightly job deletes the swap entry price, so a swapped-in position would score zero the next day (`api/cron/agent-daily-scores.js:187`). Traced, not run.
5. **Dormant:** the 50-row trade cap would drop the oldest sale's banked points on a legacy battle. The most on record is 26.
6. **Latent:** the legacy executor fills an exit at the entry price when the outgoing quote is missing (`api/_utils/agentSwapExecution.js:337`).
7. **Suspected, dormant:** the trailing stop's peak is measured from the threshold baseline but applied to the entry price (`api/_utils/agentGuardrails.js:724`).
8. **A client write the rules refuse.** The battle screen writes fresh entry prices to the battle (`src/App.jsx:6964` — `await updateDoc(doc(db, 'agentBattles', agentBattleId), {`), a field outside the owner's write allowlist (`firestore.rules:478`). The failure is caught and logged. Not verified against the deployed rules.
9. **A battle holding crypto expires at 8:00 PM ET, but the last scoring check is before the 4:00 PM close,** so the evening crypto session is never scored. Not verified against a live battle.
10. **The old human-battle crons still run** every 15 minutes and nightly against the old `battles` collection. It holds 76 records, 66 still marked active and none dated after March 2026, and the nightly job re-reads 44 of them every night.
11. **Season mode is scrapped but still wired:** four routes, a banner, and a `seasonEntries` query for every signed-in user. Production holds no active entry.
12. **Inferred, not observed:** the pattern log counts threshold hits after the nightly job has zeroed them (`api/_utils/battlePatternLogger.js:175`).
13. **Not verified:** on a Monday the league pipeline builds seats from the original draft (`api/_utils/tournamentOrchestrator.js:1033`), which may redeploy the drafted six on a holiday-carried day 5.
14. **Stale comments** that describe a state the code is no longer in: `src/App.jsx:10198` and `:2237`, `src/screens/BattleViewScreen.jsx:26`, `src/screens/LeagueScreen.jsx:32`, `api/cron/agent-evaluate.js:828` ("five" call sites; there are six).

## Founder questions

**The league (BB-1)**
1. **What does the one flag close?** (a) A new flag read by the client doors and the entry endpoints only, with the jobs untouched. (b) Reuse an existing league flag, which would strand any group in flight.
2. **Ranked rows in the hub's games list.** (a) Keep them as history. (b) Hide them with the league.
3. **The hub's League loadout card.** (a) Hide it with the league. (b) Keep it. Related: the main agent stays the source for the BaggerBomb clone, so where do players edit it once the league screen is gone?
4. **Training pods.** (a) Close them with the league. (b) Keep a door for pods already running (none is running today).
5. **The nav slot.** What is its new label and icon?
6. **Housekeeping in the same change.** Remove the Season banner and close the three web-address doors, or leave them?

**Battle length (BB-3)**
7. **Thresholds over several days.** (a) Count from entry with today's one-day unit, which is crossed far more often. (b) Count from entry with a unit scaled to the battle's length. (c) Reset every day from the previous close.
8. **Measured thresholds.** (a) Approve a new policy version for 3 and 5 days first. (b) Run multi-day on the legacy thresholds first.
9. **Commands (7), chat (10) and review chat (5).** (a) Keep them per battle. (b) Make them per day. (c) Scale them with length.
10. **The league's own battles.** Do they stay one day each while BaggerBomb becomes 3 or 5? If so, length must be set per mode.
11. **Start and end.** Does the late-start rule stay (a deploy in the last 45 minutes plays the next session), and does a book holding crypto end at 8:00 PM or at 4:00 PM?
12. **One battle per agent.** A 5-day battle holds an agent for five days. Is that intended, or may an agent hold more than one?

**Stops and targets (BB-7)**
13. **Is a stop or target exit a sale to cash or a swap?** (a) Cash: the exit always happens and the slot sits empty. (b) A swap, as today: the exit waits for an eligible replacement.
14. **Who declares the levels when there is no model output?** Four of the six swap sites open a position without the model. (a) The model on every open. (b) A code default from the player's percentages. (c) A code default from the stock's volatility unit.
15. **What stays beside the declared stop?** The platform's own exits (bust avoidance, VWAP failure, stagnation rotation), the lock near a bonus, the one-exit-per-check limit, and the player's battle-wide percentage: keep, retire, or keep as a cap?
16. **Which quote counts as "observed"?** The evaluator's own quote, which is about 16 minutes old, or a fresher source?

**Bank on exit (BB-8)**
17. **Does the end of the battle count as an exit** for a position still held? (a) Yes, bank at the last score. (b) No, unbanked bonuses are lost.
18. **"The stop has moved beyond the level"** has no data until per-position stops exist. Does BB-8 wait for BB-7, or ship first with the exit rule alone?
19. **Does the phone keep its own live score** for legacy battles, where it can disagree with the server?

**Rescoring (BB-14)**
20. **May a script hand the real scorer a reset touch record,** or must the scorer first gain a sanctioned bank-on-exit setting (a fenced edit before any rescore)?
21. **Scope of the rescore.** (a) The exit rule only, on the 43 complete battles, at 15-minute resolution. (b) Also approximate a stop, which adds assumptions.

**Version stamp and the trader's line (BB-13, BB-11)**
22. **Which win rate?** (a) Battles won, which exists. (b) Closed positions with a gain, which is new and excludes positions held to the end.
23. **Do past battles get a version stamp,** or does "no stamp" keep meaning the old rules?

**Agent vs Agent (BB-15, BB-16)**
24. **Rank of what?** (a) The agent's record. (b) A new agent rating. (c) The player's league rank.
25. **A deploy at 11 AM.** (a) Waits for the next open to be paired. (b) Plays the CPU today. (c) Is paired on the spot.
26. **What may an opponent see, and when?** During the match: positions and score only, or also the bench and the narration? Reasoning and chat: never, at the end of the match, or at each day's close (the league's behaviour today)?
27. **May paired agents hold the same stock?** The league says no; the CPU never does, by construction.
28. **Existing records are all CPU results.** Reset them, keep them as a practice record, or carry them over? Does an unpaired game still count toward games played and the level?
29. **Does the trading model learn who its opponent is** (name, rank, holdings), or only the score gap, as the chat voice does today?

**Match cash (BB-4 to BB-6)**
30. **Fixed slots or reinvested proceeds?** Star at 20% maps to today's 2.0 only if each slot keeps a fixed dollar size.
31. **Flat bonuses in a dollar game.** Keep +15, +30, +50 as points beside the cash, or convert them?

## Appendix P — production queries

All reads ran against project `tradeseven`, database `(default)`, with the Admin SDK from the main checkout, on 15 Nov 2026. Calls used: `collection().count().get()`, `query.select(...).get()`, `collection().get()` on four small league collections, `doc().get()` on two control records, and `listCollections()` for names. Output was counts and non-identifying values only.

| Count in this report | Query |
|---|---|
| Battles by mode, status, length | `agentBattles` `.count()`; then all 645 with `.select('status','gameMode','duration','createdAt','completedAt','timing.tradingDays','agentContext.archetype','isCpu','completionContext')`, tallied in memory |
| League groups by status, seats per week (A4) | `tournamentGroups` `.get()` (18 records); `players[].isCpu`, `status`, `baseLayerWeek`, `isTraining`, `isLiveDraft`, `createdAt` |
| League battles per week | `agentBattles` `.where('gameMode','==','baggerbomb_tournament').select('createdAt','isCpu','status','timing.tradingDays')` |
| Lobby, ranks, leaderboards, orchestrator | `.get()` on `tournamentLobby` (20), `tournamentRanks` (22), `tournamentLeaderboards` (4), `tournamentOrchestrator` (1); `.count()` on the others |
| Agent-mode detail (C1, D1, F1, G1) | `agentBattles` `.where('gameMode','==','baggerbomb_agent')` with a field list covering dates, archetype, `agentContext.deployedGuardrails`, `scoring.stockThresholdModel.modelId`, reward history and contexts, `scoreState`, `trades`, `thresholdHistory`, `cronState.lastTickPrice`, `portfolio`, completion fields (98 records) |
| Stored model checks, last 30 days | the same 17 battles, `.select('evaluations')` |
| Per-check rows, tape and sale receipts per battle (G1) | `.count()` on `agentBattles/{id}/ticks`, `agentBattles/{id}/tape` and `learningReceipts/{id}/receipts` for the 49 battles |
| Stops and targets on league battles | `agentBattles` `.where('gameMode','==','baggerbomb_tournament').select('agentContext.deployedGuardrails','trades')` (547 records, none with a guardrail) |
| The old human battles | `battles` `.select('_v','state.status','status','createdAt','state.createdAt','state.startedAt','isTraining','gameMode')` (76 records) |
| Measured-threshold switch | `stockThresholdControl/admission` `.get()`: schema 2, enabled, epoch 2, audience "all" |
| Cockpit release switch | `cockpitConfig/release` `.get()`: the record does not exist |
| Season entries | `seasonEntries` `.select('status')`: 4 completed, 0 active |
| Distinct accounts with an agent-mode battle | `agentBattles` `.where('gameMode','==','baggerbomb_agent').select('ownerId','timing.tradingDays','createdAt','status','agentId')`, distinct owners counted in memory: 6 all time, 3 in the last 30 days |
| Agents by kind | `agents` `.select('stats.gamesPlayed','deployedStrategy.guardrails','activeBattleId')` (104 records: 82 CPU, 12 training clones, 7 main agents, 3 casual clones) |

Windows: "last 30 days" is a first trading day on or after 16 Oct 2026; "since 10 Aug" is a first trading day on or after 10 Aug 2026. A win is the stored agent score above the stored opponent score; the battle record holds no result field.
