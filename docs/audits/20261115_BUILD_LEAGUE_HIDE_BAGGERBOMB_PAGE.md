# Build report — hide the league, the BaggerBomb page (dark)

**Date:** 15 Nov 2026 · **Branch:** `claude/league-hide-baggerbomb-page` from `origin/main` `71bc6bde7c0553cdb16e5c5f3752d248968967c3` · **Prompt:** `BUILD_PROMPT_LEAGUE_HIDE_BAGGERBOMB_PAGE_NOV15_2026.md` (Fable, the BaggerBomb revamp chat) · **Basis:** `docs/audits/20261115_PHASE0_BAGGERBOMB_TRADER_GAME.md` Part A (draft PR #1070) · **Session:** Sonnet 5.5 with the Opus advisor.

**Status: dark. With `LEAGUE_HIDE_ENABLED` at its shipped value (`false`) nothing changes for any player.** Two draft PRs and one never-merge preview branch; no merge, no deploy, no flag flip on `main`.

## Verdicts

| Question | Answer |
|---|---|
| Does anything change for a player when this merges? | **No.** The flag ships `false`. Every new branch is a literal-ternary or early return on it; the flag-off build was compared with `main`'s (§6): no page chunk is emitted, the hub's chunk is the same size, and 54 of the 56 JS and CSS files are the same size, the exception being the main entry (+31 bytes). The file names (content hashes) of most chunks change, so returning players re-download them once; that is a consequence of any change to the main entry, and it is stated here rather than claimed away. |
| What does the flag do when it is on? | The nav slot reads "BaggerBomb" (bomb icon) and opens the BaggerBomb page; the three web-address doors close; the hub's League loadout card and its lock read go; the Season banner goes; the seven league entry endpoints refuse with one typed 404 (`league_hidden`). In-week, read-only and operator endpoints are unchanged. No job, cron, rule or scoring file reads the flag (a census row pins it). |
| Was the "main agent can only be edited through the League card" STOP hit (ruling Q3)? | **No.** BaggerBomb deploys read their own loadout slot (`agents/{id}.loadouts.baggerbomb`, `api/_utils/perGameLoadout.js:93-97` → `casualClone.js`), and the BaggerBomb card writes that slot with no lock. §2. |
| Is a fenced file touched? | **No.** None of the 33 changed files is a BUILD_RULES §1 file. |
| League groups in flight (the settle-first condition)? | **0** (`forming` 0, `drafting` 0, `awaiting_open` 0, `battle` 0; 18 groups on record; 0 active league battles). Read-only `count()` calls, this build, 15 Nov 2026. |
| Tests | Full suite on Linux at the code head `708a34ca`: **1,509 files passed, 12 skipped; 33,956 tests passed, 0 failed**, exit 0 (CI-shaped: 8 workers, `TZ=UTC`). `npm run lint:gate` exit 0. `vite build` exit 0 on the head and on `main`. |
| Mutation battery (BUILD_RULES §2) | **94 mutants, 93 killed, 1 survived, 0 errors, 0 broken.** The survivor is named in §9. |
| BUILD_RULES §2 review (≥10 files) | Done: four independent lenses, then four refuters. §8. |
| Founder questions | Seven. §10. |

## 0. Session preamble (BUILD_RULES §2, §3)

- `git fetch origin` ran first, before any comparison. `origin/main` = `71bc6bde` at the start and at the end (re-fetched before the final checks; it did not move).
- Branch `claude/league-hide-baggerbomb-page`, cut from `origin/main`; HEAD at the start `71bc6bde`, working tree clean (the session began on `claude/advisor-opus-b22b34` at the same commit; the prompt's branch was created from `origin/main` before any write).
- **First commit** (`29575710`): the three attached files, byte-identical, under `docs/design/` with the `20261115_` prefix, with their rows in `docs/README.md`. Blob hashes were compared with the files as attached (`git hash-object` equal). The session was first handed only Amendment A; the direction note and the ruling sheet were supplied a few minutes later, and nothing was committed until all three were on disk. The ruling sheet's header still says "proposed"; Amendment A is the record of its adoption.
- Linux checks ran in WSL (a private worktree of `~/pd-ci`, one full suite at a time under `flock`, `TZ=UTC`, 8 workers). The Windows tree is CRLF and shows platform-only failures (path separators, 5 s timeouts under load); every number below that says "suite" is the Linux one.
- No account id appears in code, tests, output or this report. The production reads printed counts only.
- Production was read, never written: `query.count().get()` on `tournamentGroups` and `agentBattles`. The script is outside the repository and contains no write call.

## 1. The rulings (15 Nov 2026), verbatim

| # | Ruling |
|---|---|
| BB-1 | The league layer is hidden for the beta behind one flag. Its screen becomes the BaggerBomb page and launcher. Nothing is deleted. |
| Q1 | A new flag, read by the client doors and the entry endpoints only. Jobs untouched. |
| Q2 | Ranked rows in the hub's games list stay, as history. |
| Q3 | The hub's League loadout card is hidden. The BaggerBomb card is the one loadout. |
| Q4 | Training pods close with the league. |
| Q5 | The nav slot is labelled "BaggerBomb" with a bomb icon. |
| Q6 | The Season banner is removed and the three web-address doors are closed, in the same change. |

## 2. The gate, re-verified at HEAD

Every site of the discovery's A1 table and A6 list was re-read at `71bc6bde`. The discovery's base was `ea5e0c5b`; `main` has moved since, and the line numbers of the discovery still held at HEAD (re-read, not assumed).

| # | Door (discovery A1) | At HEAD | Closed by |
|---|---|---|---|
| 1 | Phone nav item | `src/components/Navigation/BottomNav.jsx:11` | `BottomNav.jsx:12-17` |
| 2 | Desktop nav item | `src/components/Navigation/DesktopSidebar.jsx:15` | `DesktopSidebar.jsx:16-21` |
| 3 | The route | `src/App.jsx` `if (TOURNAMENT_TAB_ENABLED && screen === 'league')` (unchanged line) | the page's route block before it, `App.jsx:10210` |
| 4 | "Back" after a training battle | `src/App.jsx:9571` `onBack={() => setScreen('league')}` | **unchanged**: it sets the id the route now gives to the page; with the flag on it is unreachable (its doors are closed) |
| 5 | Hub game rows, live and finished | `hub/useHubReaders.js:195` | **kept** (ruling Q2): history |
| 6 | Hub "Open game" / next action | `CommandCenterHub.jsx:227` | **kept** (history, in-flight) |
| 7 | League Arena routing | `screens/BattleViewScreen.jsx:37`, `LEAGUE_BATTLEVIEW_ROUTING_ENABLED` | **kept** — it is the cockpit wall and stays on |
| 8 | Hub Loadout tab's League card | `LoadoutCards.jsx:179` (was `:176`) | `LoadoutCards.jsx:179` ternary |
| 9–11 | `?trainingDraft`, `?trainingBattle`, `?tournamentDev` | `App.jsx:2284/2298/2240` (now `:2289`, `:2304`, `:2244`) | an early return as the first statement of each effect |
| 12 | Battle History list | `App.jsx:4953` | kept: history. A reviewer traced what a league row opens: a Film Room (`BattleHistoryScreen.jsx:328`) — the discovery's "not verified" is closed |
| 13 | Backing | dark | unchanged |
| 14 | Season banner | `App.jsx:12687` | the flag's ternary after the banner's own condition, `App.jsx:12712` |
| 15–16 | Season Forge switch / entry modal | dead / only reachable from the Season screens | unchanged |

**The lock read** (discovery A6 site 6): `PerGameLoadoutScope.jsx:27` hands `useLeagueLoadoutLock` a `null` owner when the flag is on; the hook (still called every render, so the rules of hooks hold) starts no subscription for a falsy owner.

**Doors the discovery missed.** None that starts or enters league play (the entry endpoints are the complete creator set: `slot-claim` and the six `lobby-*` routes; the in-week routes serve groups already seated; Firestore rules make `tournamentGroups` and `tournamentLobby` `write: false` for clients; nothing calls the entry endpoints internally). Two things the flag does **not** hide, found by the reviewers: the hub's stage summary still reads "BaggerBomb · X · League · Y" and the Loadout tab's Forge line still says "both games" (founder question Q-A). And a side effect worth saying: closing `?tournamentDev` removes the only in-app UI for the operator levers (`run-duty`, `bank-daily-scores`, `process-claims`, `reconcile-ledger`, …); they remain callable with the admin secret.

**Doors this build had to fix, found by the gate.** The active-battle poll runs only while `screen === 'dashboard'` (`App.jsx:4025`, the line `if (screen !== 'dashboard' || !isPageVisible) return;`). The page reads that poll through the hub's readers; without a change it would have shown a stale or empty live list. With the flag on the poll also runs on `'league'` (a literal ternary: flag-off it is today's line).

**Q3 check, made concrete.** Writers of the main agent's own `archetype`/`equippedWatchlistId`: the League loadout (the ranked record's own fields; `loadoutKindOf(undefined)` is League, so Forge and any writer sending no `loadout` edit it) and the BaggerBomb slot (`loadouts.baggerbomb`, server-written with `loadout: 'baggerbomb'`, no lock). The casual clone that plays BaggerBomb is built with `applyBaggerbombLoadout(fields, rankedAgent)` (`api/_utils/perGameLoadout.js:93-97`): the slot's archetype and book, or the ranked fields while the slot is absent. So the BaggerBomb card edits exactly what BaggerBomb plays. **Not a STOP.**

## 3. Part 1 — the flag and the doors

`src/config/featureFlags.js:150` `export const LEAGUE_HIDE_ENABLED = false;` with its docstring and `// Pinned by: leagueHideFlag.test.js`; `src/config/leagueHideFlag.test.js` pins it (`false`) where `flagPinGuard.test.js` sees it; the flag is registered in the guard's `DARK_BY_DESIGN` with a runway note ("only while no league group is in flight"), so the flip PR must drop it in the same commit.

**Client, flag on** (file:line at the final head):

| Door | Site |
|---|---|
| Nav, phone and desktop: label "BaggerBomb", bomb icon, still sets `'league'` | `BottomNav.jsx:12-17`, `DesktopSidebar.jsx:16-21` |
| The route renders the page, in place of `LeagueScreen` | `App.jsx:10210` (page: `App.jsx:57` lazy, `:10215` element) |
| Back target after a training battle | unchanged text `App.jsx:9571`, sets `'league'` → the page (unreachable flag-on) |
| `?tournamentDev`, `?trainingDraft`, `?trainingBattle` ignored | `App.jsx:2244`, `:2289`, `:2304` |
| League loadout card not rendered; its lock read does not run | `LoadoutCards.jsx:179`, `PerGameLoadoutScope.jsx:27` |
| Season banner not rendered | `App.jsx:12712` |
| Poll runs on the page's screen | `App.jsx:4025` |
| Ranked rows in the hub's games list | unchanged (nothing in the hub's games path reads the flag) |

The stale comment at the route (the nav items "are its only setters") is corrected, as is its twin in the `TOURNAMENT_TAB_ENABLED` docstring: the "back" button after a training battle is a third setter.

**Server, flag on:** `api/_utils/leagueHidden.js` (one module, one refusal): `404 {error: 'league_hidden', message: 'The league is not available right now.'}`, in the shape the lobby's own "disabled" path returns, after the method guard and **before** the lobby flag, the live-draft flag and auth. `runLobbyEndpoint` (`lobbyEndpoint.js:90`) covers all six `lobby-*` routes (create, form, join, matchmake, quickplay, quickplay-training); `runSlotEndpoint` takes a `leagueEntry` option that only `slot-claim` sets (`liveDraftEndpoint.js:91`, `slot-claim.js:20`), so `slot-release`, `live-draft-pick` and `slot-schedule` keep answering.

`TOURNAMENT_TAB_ENABLED`, `LEAGUE_LIVE_DRAFT`, `LEAGUE_NEXT_ARC_ENABLED` and `LEAGUE_BATTLEVIEW_ROUTING_ENABLED` keep their values and meaning.

## 4. Part 2 — the BaggerBomb page, version 1

`src/components/CommandCenter/BaggerBombPage.jsx` , `baggerBombPageModel.js` (pure derivations), copy in `src/constants/baggerBombPageCopy.js`. One page, phone and desktop, four parts and nothing else:

1. **Deploy** — the hub's own `DeploySection` with the hub's `useHubDeploy` wiring, through the deploy provider App already mounts around every screen: the same press-and-hold control, admission table and ceremony, and the card's "Next deploy carries …" line, whose door takes the player to the hub's Loadout tab.
2. **Current game** — the live BaggerBomb rows with "Open game" (App's `handleOpenAgentBattle`, through the hub's reader). With no BaggerBomb row there is **no fallback to the first live game** (the hub's strip falls back to `live[0]`); a live league game is never shown as the BaggerBomb game. Labelled "Current game", not "Live game": a game deployed and waiting for the open is listed here, and the hub never calls that live.
3. **Finished games** — the hub's completed window and its History sheet, league rows excluded; three rows, then "History".
4. **Record** — wins, losses and games played from the agent's stored stats (`stats.wins`, `stats.losses`, `stats.gamesPlayed`; the same fields and the same rule as the hub's own career line: both counts or "unavailable", games played only when stored, never derived).

**Constraints held.** No new endpoint and no new query shape (every read is the hub's readers or App's existing poll). Colours only through `hub/hubStyle.js` (the `--ft-*` tokens): the three new source files contain no hex, rgb or hsl and no transition literal. The structure is one plain column of sections, kept simple to restyle. No effect, timer or listener lives in the page file. No mode picker, no length picker, no dollars.

**What the page reads** (a reviewer traced it): the hub's readers `useAgent`, `useHubCompletedBattles` (limit 10) and App's poll, plus **one read none of its four parts uses**: `useHubBrief` → `getDoc(indexIntelligence/dailyRegimeBrief)` (one retry after 1.5 s on failure). It is an existing query shape. App's poll now also runs on the page's screen (one `getDocs` per 120 s and at each dashboard↔page tap, plus one `tournamentGroups` `getDoc` per distinct group id in the list).

**What is not on the page's Deploy card** (the hub's card has them): the "Deploying with" idea line, the Huddle reconfirm line, the Scouting Board link, and the book's "· N names" in the loadout line (they need the hub's runtime and committed lists). Founder question Q-B.

**Honest states** (the review's main yield, §8): the Live part says "checking" — never "no game" — while the live poll has not answered for this owner (the hub's own T0R-2 rule); it says the poll's age after a failed run; the Finished part never reads a failed or stale read as empty; a 10-game window made only of league games reads "No BaggerBomb games among your latest games" instead of "No finished games yet" (the hub reads its latest ten before any filter).

## 5. The guard decision

**Chosen: house the page under `src/components/CommandCenter/` and load it lazily**, the smaller of the two options. The mount guard (`commandCenterHub.mount.guard.test.js`) exists to keep hub modules out of the main chunk; a lazy `import()` keeps that true, and extracting the hub's readers, sections and sheet into shared code would have moved a dozen modules and every test that names them.

**Every edit to a guard or a guard-adjacent test is deliberate; each with its reason:**

| File | Edit | Why |
|---|---|---|
| `commandCenterHub.mount.guard.test.js` | the permitted-edges list gains `src/App.jsx -> lazy …/BaggerBombPage.jsx`, and the literal list its path; `hubProps` use count 3 → 4; the closed list of names the hub may take from `featureFlags` gains `LEAGUE_HIDE_ENABLED`; one comment corrected | the page is a new lazy edge from App; the page's route is the fourth use of App's `hubProps` (outside the dashboard block, whose two-gate row is unchanged); `LoadoutCards.jsx` and `PerGameLoadoutScope.jsx` read the flag |
| `src/theme/tokens.guard.test.js`, `motion.guard.test.js`, `tokenGuardBaseline.json`, `motionGuardBaseline.json` | the two new hub files registered on both lists; baselines updated in the same commit (hazard 34) | the directory census rows ("every file under `src/components/CommandCenter/` is on this list") fail only in the full suite; both files have no hex and no transition literal |
| `src/config/flagPinGuard.test.js` | `LEAGUE_HIDE_ENABLED` registered in `DARK_BY_DESIGN` with a runway note | so the flip is read as deliberate, and the entry must be dropped in the flip commit |
| `api/tournament/lobby-endpoints.test.js`, `slot-endpoints.test.js` | one line each: `LEAGUE_HIDE_ENABLED: false` in their closed `featureFlags` mocks | the two endpoint wrappers now read one more flag; a closed factory throws on an export it does not list. **This is the one departure from "no edit other than new pins"**: two existing test files each gained one mock line. No assertion changed. |

A reviewer noted the guard's graph rows walk only from `CommandCenterHub.jsx`; the page is a second root, so a source row now pins the page's exact import list (no service, no firebase, no new package, no dynamic import) in `src/leagueHide.app.source.test.js`.

## 6. The flag-off proof

**Files changed outside new files and the flag: 17** — 8 source files (`App.jsx`, `BottomNav.jsx`, `DesktopSidebar.jsx`, `LoadoutCards.jsx`, `PerGameLoadoutScope.jsx`, `lobbyEndpoint.js`, `liveDraftEndpoint.js`, `slot-claim.js`), 6 existing test files (the five in §5 plus `flagPinGuard`), 2 baseline JSONs, and `docs/README.md`. New files: 15 (three design docs, `leagueHidden.js`, the page, its model, its copy, and eight test files). The flag file itself: `featureFlags.js` (+20 lines, no other change). 33 files changed in all (`+2,635 / −26`; 291 of the insertions are the three design documents and their README rows).

**Every existing test passes with no edit other than the six listed.** The tests that pin a league door (the discovery's A1 list: `perGameLoadoutFlags.test.js:142`, `agentFormFlags.test.js:139`, `leagueBattleviewRoutingWall.test.js:42`, `LeagueEnrollment.routing.test.jsx:2`, `CommandCenterHub.loadouts.jsdom.test.jsx:684`, `hubChrome.test.js:20`) are **untouched** and green. Shape of each edit to keep pinned text intact: the route is a separate block before the pinned `if (TOURNAMENT_TAB_ENABLED && screen === 'league')` line; the Season banner's pinned condition is left whole with the flag's ternary after its `&& (`; the League card's array becomes `(FLAG ? [bb] : [bb, league])`; `hubChrome.js` is not touched (its test mocks the flag module with one export).

**Full suite, Linux, code head `708a34ca`:** 1,509 files passed / 12 skipped / 0 failed; **33,956 tests passed / 135 skipped / 0 failed**; exit 0; 338 s. An earlier run at `fbd4380e` had two failures (the two hazard-34 census rows above), fixed in `e0fe2d54`. `npm run lint:gate`: exit 0. `vite build`: exit 0.

**Dist comparison, flag off, head vs `main` (`vite build`, same machine, `three` present):**

| | `main` | head |
|---|---|---|
| Files in `dist/` | 113 | 113 |
| `BaggerBombPage` chunk | — | **none emitted** |
| `CommandCenterHub` chunk | 208.87 kB | 208.87 kB (not split) |
| Main entry (`index-*.js`) | 5,042,359 B | 5,042,390 B (**+31 B**) |
| JS and CSS files | 56 | 56; **54 the same size**, the main entry the exception |
| File names (content hashes) | | 108 of 113 files carry a new hash (the chunks import from the entry); 5 are byte-identical at the same path |

This is **not** a byte-identical dist and the report does not claim it. The first version of the page used a bare `lazy(() => import(…))`, which a reviewer showed still emitted a page chunk flag-off, split the hub's chunk and moved 15 other lazies; the build then adopted the repo's own flagged-lazy pattern (`FLAG ? lazy(…) : null`, as `AGENT_FORM_LAB_ENABLED` does), and the table above is the measurement of the final code.

## 7. The flip (PR 2)

PR 2 is a draft stacked on PR 1's head: it sets `LEAGUE_HIDE_ENABLED = true`, moves the pin in `leagueHideFlag.test.js`, drops the flag's `DARK_BY_DESIGN` entry, and holds the League-card rows of `CommandCenterHub.loadouts.jsdom.test.jsx` at the flag-off state. **How the rows were found:** the flag was set to `true` in a private Linux tree and the **whole** suite run (1,521 files). Exactly three files went red, 15 rows: `flagPinGuard.test.js` and `leagueHideFlag.test.js` (the pin, as expected) and **13 rows of `CommandCenterHub.loadouts.jsdom.test.jsx`**, which render the League card and its lock (`board 1`, `board 4`, `board 5`, the book door and `LD-1`). Nothing else in the suite sees the flag. Those 13 rows guard the League card's own behaviour; PR 2 holds that file's `featureFlags` mock at `LEAGUE_HIDE_ENABLED: false`, so they keep proving the card for the day the league returns. The flip is therefore **not** a one-line PR; the flag's docstring and the pin test say so.

**Pre-merge check, in PR 2's description:** league groups in flight must be **0** — read-only:

```js
// project tradeseven, database (default); count() only, no write
const inFlight = ['forming', 'drafting', 'awaiting_open', 'battle'];
for (const s of inFlight) console.log(s, (await db.collection('tournamentGroups').where('status', '==', s).count().get()).data().count);
console.log('active league battles', (await db.collection('agentBattles')
  .where('gameMode', '==', 'baggerbomb_tournament').where('status', '==', 'active').count().get()).data().count);
```

Read in this build (15 Nov 2026): 0, 0, 0, 0 and 0. If any is non-zero, do not merge: a group in flight would lose its entry points but keep its jobs, and a player could be stranded mid-week. Merge after 6 PM ET (PR 1's rule) and only after the preview smoke (§12).

## 8. Review record (BUILD_RULES §2)

The diff is 33 files (≥10), so the review is mandatory. It was run as the rule states: **four independent lenses** (A the dark / flag-off guarantee; B doors, wiring and lifecycle with the flag on; C the page's data, display agreement and states; D test integrity), each on its own `git archive` snapshot, read-only on git and on the working tree; then **four refuters**, each instructed to refute every finding with evidence from the fixed code and to check that each claimed fix really closes it; an explicit `vite build` (§6); the mutation battery (§9). The lens reports and the refuter reports are in this session's record; the findings, the verdicts and the dispositions are below.

**Outcome: no reviewer's claim was refuted on the facts. Two of the build's own dispositions did not hold** (A2's "inherent" was refuted; D7's "stays source-text pinned" was false). One finding, seen by three lenses, was a blocker for CI: the hazard-34 census rows.

| Finding (lens) | What | Verdict | Disposition |
|---|---|---|---|
| A1 / C1 / D1 | the two new hub files not on the hazard-34 lists → CI red | CONFIRMED | **fixed** (`e0fe2d54`) |
| A2 = B5 | flag-off dist not chunk-identical; the page's bare `lazy()` stays a retained statement | CONFIRMED; **the build's "inherent" was REFUTED** (the repo's flagged lazies use `FLAG ? lazy() : null`) | **fixed** (`708a34ca`); measured, §6 |
| A3 | needless Fragment around the Season banner (~60 B) | CONFIRMED; the build's reason "the pin forbids it" only partly true (a ternary after the pinned `&& (` works) | **fixed** |
| A4 / D2 | "the flip is a one-line PR" is false (13 League-card rows) | CONFIRMED | docstring and pin comment corrected; rows move in PR 2 (§7) |
| A5, A6 | stale comments; flag not in `DARK_BY_DESIGN` | CONFIRMED (mount-guard half of A5 FIX-INADEQUATE at first) | **fixed** |
| B1 = C2 | the hub's scoped box-model and focus CSS never reached the page (selectors name `[data-hub="shell"]`) → content-box page, no focus ring | CONFIRMED | **fixed**: the page root carries the hub's marker (no opposite risk found: only two non-test readers of the marker, never mounted together) |
| B2 = C4 = D4 | Live part said "No game live" for a poll it had not read (the hub's T0R-2 rule) | CONFIRMED | **fixed**, with rows (poll unanswered, poll failed, window failed, and the control) |
| B3 = D3 | the hub's stage summary prints "League · {archetype}" | CONFIRMED | **not fixed**: outside the ruling's letter → Q-A |
| R2-1 | the Loadout tab's Forge line still says "both games" | CONFIRMED | **not fixed** → Q-A |
| B4 | Back from the battle view and the Film Room return go to the dashboard, not the page | CONFIRMED | comments corrected; same as from any screen |
| B6 = C9 | the page silently needs `COMMAND_CENTER_HUB_ENABLED` and the two loadout flags (rollback states render inert / dangling) | CONFIRMED, dormant | not fixed; a row proves the page renders and is inert with no provider |
| B7 | the poll restarts on each dashboard↔page tap | CONFIRMED, low | not fixed (same class as any dashboard re-entry) |
| B8 = C3 | no live region on the page; focus fell to `<body>` after the ceremony | PARTIAL (the ceremony has its own live region while open) | focus **fixed** by the marker; announcements after the ceremony → Q-D |
| B9 = C6 | the Deploy card lost "Next deploy carries …" | CONFIRMED; the fix is PARTIAL (the "· N names" is still absent) | **fixed** (scope mounted, door to the Loadout tab); the count → Q-B |
| R2-3 | the card drops the idea line, the Huddle reconfirm line, the Scouting Board link | CONFIRMED | header says so; → Q-B |
| B10 = C5 | a 10-game window of league games read "No finished games yet" | CONFIRMED | **fixed** |
| B11 / R2-2 / R1-1 / R3-3 | page not keyed by site; stale header comment | CONFIRMED | **fixed** |
| C7 | W + L may not equal Games played (draws; a 0–0 game is a recorded draw) | CONFIRMED, low | not fixed → Q-C |
| C8 a / b / c / d | loading line from the wrong source; no as-of note with an empty live list; "Live game" over a waiting game; two controls, one action | CONFIRMED | a, b, c **fixed**; d benign |
| C10 | reads beyond the four parts | CONFIRMED with corrections (§4) | reported |
| R3-1 | if the first poll fails the Live part reads "checking" until the next tick | CONFIRMED, low | not fixed (self-heals; the card carries Retry) |
| R3-4, R3-5, R4-2, R4-3, R1-3 | copy wording ("Record unavailable" vs the hub's); History sheet after a refresh; two vacuous assertions; token baseline key order | CONFIRMED, nits | not fixed |
| D5 | wiring and states no row drove | PARTIAL → closed | rows added: finished row and tape link, History on the phone (docking, 44 px targets), window loading and stale, overlay cancels a hold, modal state, no-provider render, a read's Retry, the loadout line and its door, a width flip mid-deploy |
| D6 | no row mounts the hub's games list flag-on | PARTIAL | a count pin on App's reads of the flag (8) and the SCOPE census; nothing in the hub's games path reads the flag |
| D7 | in-week rows stopped at auth; order against other flags unpinned | PARTIAL (the build's "stays source-text pinned" was false) | signed-in rows and rows with the lobby and live-draft flags off added |
| D8 | the mount guard walks only from `CommandCenterHub.jsx`; the page is a second root | CONFIRMED | a source row pins the page's imports |
| D9, D11 | a poll-deps pin matched an unrelated effect; the refusal message compared with itself | CONFIRMED | **fixed** |
| D10 | weak assertions remain (`not.toBe('ready')`, either-attribute `\|\|`) | PARTIAL | not all fixed; each has a stronger neighbour |
| R4-1 | nothing exercised the phone path | CONFIRMED | **fixed** |
| R4-4 | the census walks `src` and `api`, not `scripts/` (ten scripts import `featureFlags`) | CONFIRMED, low | not fixed; scripts are not deployed jobs |
| Lens B: missed doors | none | agreed by the refuter | — |

**Brittle spots the test refuter named** (accepted, stated): `src/App.leagueHide.jsdom.test.jsx` uses real time (10 ms polls, 300 ms negative waits); the hold rows hard-code the hold length; a lucide bump could change the `lucide-bomb` class the nav rows read.

## 9. Tests and the mutation battery

**New rows: 118 in eight files**, all green on Windows and in the Linux suite: `api/tournament/leagueHide.endpoints.test.js` (the seven entry doors refuse with one typed answer before auth and the database; method guard first; the same answer for a signed-in caller; the hide answers before the lobby and live-draft flags; in-week, read-only, internal and operator routes still answer, with and without a user; flag-off controls), `src/components/Navigation/leagueHide.nav.jsdom.test.jsx` (label, icon and target on phone and desktop, ON and OFF, with and without the old tab flag), `src/App.leagueHide.jsdom.test.jsx` (the real App: the route, the poll, each address door, the Season banner — each with a flag-off control; the address rows mount with no user so that App's own "go to the dashboard" effect cannot hide a door), `src/components/CommandCenter/BaggerBombPage.jsdom.test.jsx` (the four parts with no battles, one live game, finished games, a league row among both; every state of the poll and the window; the deploy hold through the real provider on both widths), `baggerBombPageModel.test.js`, `leagueHide.loadout.jsdom.test.jsx` (the League card and the lock read, ON and OFF), `src/leagueHide.app.source.test.js` (the SCOPE census: exactly who reads the flag and that no job does; the flag-off arms; the doors; the page's import list), `src/config/leagueHideFlag.test.js` (the pin). Each ON row has a flag-off control, or a visibility control, in its own file, except the ones the test reviewer listed.

**Mutation battery** (BUILD_RULES §2) over the new rows, run by a runner outside the repository: each mutant changes one defect-sized piece of one source line (or a pair that makes one defect), runs only the test files that cover it, and is judged by vitest's exit code with at least one failed row (a crash or a load error is never a kill). A mutant whose anchor no longer matches is reported BROKEN, not skipped; the file is restored byte for byte after each run and the tree was clean after each battery.

| Area | Mutants | Killed |
|---|---|---|
| The flag (ships true) | 1 | 1 |
| Server: never refuses, always refuses, wrong status, wrong key, no message, refusal after auth, before the method guard, after the lobby or live-draft flag, in-week route made an entry door, slot-claim not an entry door, training quick play off the wrapper | 18 | 18 |
| Nav: label, icon, target, the hide never applying, the hide needing the old tab flag, the flag-off slot lost (phone and desktop) | 11 | 11 |
| App: the route, the width fork, the hub object, the loadout door, the poll (off the page / on with the flag off), each of the three address doors, the Season banner (stays / hidden flag-off), the back target, the stale comment, the old route's tab flag, a new read of the flag, a bare lazy | 17 | 17 |
| The hub's Loadout tab: the card never hidden / wrong card / hidden flag-off; the lock read still runs / never runs | 5 | 5 |
| The page's model: every row counted as BaggerBomb, league rows kept (finished / live), one row too many, History at exactly the limit, a half record, derived games played, swapped career, loading read as unavailable, a live league game falling back in, other-kind games not counted | 12 | 12 |
| The page: league rows shown everywhere, History over the unfiltered section, the hold inert, "Open game" dead, games played never shown, each part dropped, History never opens, the loadout scope dropped, the live part silent / using the window for the poll / without its checking line, the finished part without its checking line, a stale empty window read as empty, finished rows not openable, the sheet never phone, sheet rows dead, Refresh dead, an overlay no longer cancelling a hold, the page throwing without the provider, a read's Retry sent to the attempt, the hub marker dropped, the loadout door unwired, the modal state unread, the poll's age said only beside a row, a service imported | 29 | 28 |
| The census: a job reads the flag | 1 | 1 |

The first battery (68 mutants) was killed in full. The review then fixed and added rows; the second (88) left three survivors and one drifted anchor, which the next rows closed (the sheet's phone docking and 44 px targets, the hold disabled while a sheet is open, the league-row filter re-anchored); the third and fourth re-ran the mutants whose anchors the review round changed; the last (94) is the table above, run on the frozen code.

**The survivor, stated:** `G24` (`BaggerBombPage.jsx`, `deploy.existingRead.attemptId === readers.inputs.attempt?.attemptId` inverted). It is the page's copy of the hub's own wiring (`CommandCenterHub.jsx:915-916`), which the hub's S2b and S7 rows exercise through the real ceremony and `findActiveBattleForAgent`; reproducing it on the page needs both, and no page row drives it. Accepted, not hidden.

## 10. Founder questions

- **Q-A. The hub still says "League" in two places with the flag on.** The stage summary ("BaggerBomb · X · League · Y", `constants/loadoutCopy.js:61`) and the Loadout tab's line "Your Forge strategy rides into both games." (`:84`). Ruling Q3 hides the card and its lock read; these two strings are outside its letter. Proposed: with the flag on, the summary names the BaggerBomb loadout only and the line says "…rides into your games" — two copy edits behind the flag, in the flip PR. Two reviewers would treat it as blocking the flip.
- **Q-B. Should the page's Deploy card carry the hub's extras?** The "Deploying with" idea line, the Huddle reconfirm line, the Scouting Board link, and the "· N names" beside the book. They need the hub's runtime; adding them means running more of it on this page. Today a player can deploy from the page without being told an idea or a reconfirm is in play.
- **Q-C. Show draws in the record?** `stats.gamesPlayed` counts draws and a 0–0 game is a recorded draw, so Wins + Losses may not equal Games played, while that game's finished row reads "No result". The page shows the three stored numbers as asked; the hub's career line is W–L only.
- **Q-D. Announcements.** The hub has one live region (the Shadow stage's status line); the page has none, so the Deploy card's state after the ceremony closes is not announced. A design-round item, unless you want it in version 1.
- **Q-E. Operator levers.** Closing `?tournamentDev` removes the only in-app buttons for `run-duty` and the other operator levers; they remain callable with the admin secret. Confirm that is acceptable for the beta.
- **Q-F. Where "Back" from a game goes.** After "Open game" the battle view's Back (and the Film Room's) returns to the Command Center dashboard, as from any screen, not to the page. Keep, or make the page the return for games opened from it?
- **Q-G. The flip PR's size.** It is not one line (§7). Confirm the held League-card rows are the right shape (held at the flag-off state, not deleted), or ask for them to branch on the flag.

## 11. Outside the task, and what surprised

Reported for separate tasking (BUILD_RULES §3), not fixed:

1. **A pre-existing ordering defect.** App's "go to the dashboard when the user loads" effect (`App.jsx:3494`) can clobber the screen the address-parameter effects set, whenever the user is already loaded at mount (their `screen === 'home'` is a stale closure value). In production the dev doors only work if the user arrives after mount. The build's tests had to mount with no user for the control rows to see the doors.
2. The hub's `liveResolved` is false until a first poll success, so a first failed poll leaves the hub's own Games section on "checking" too (the page now does the same).
3. The flag's census does not cover `scripts/` (R4-4).
4. `README.md` rows for design documents are appended in no order; the three new rows sit after the `20261113_` design cluster.

What surprised: the active poll runs on the dashboard only; closed `featureFlags` mocks in two endpoint tests; the three directory-wide census guards that fail only in the full suite; and that the review's best finding (the hub's CSS never reaching the page) was invisible to jsdom.

## 12. Branches, PRs and how to see it

- **PR 1 (dark):** `feat(league): hide flag and the BaggerBomb page (dark)` — `claude/league-hide-baggerbomb-page`. First line of its description: *Dark — merge after 6 PM ET on green. With the flag off nothing changes.* <<PR1>>
- **Preview branch (never merged):** `claude/league-hide-smoke` — PR 1's head plus the flag on, nothing else. <<PREVIEW>>
- **PR 2 (the flip), draft:** `claude/league-hide-flip` — stacked on PR 1; its description carries the pre-merge check (§7). <<PR2>>
- Seeing it: on the preview, sign in on a phone and a desktop width. The nav slot reads "BaggerBomb" and opens the page; deploy by pressing and holding; "Open game" opens the live game; History opens the hub's sheet; the Compete tab's Loadout shows one card; `?tournamentDev=1`, `?trainingDraft=x` and `?trainingBattle=x` open nothing. A signed-in curl to `/api/tournament/lobby-create` and `/api/tournament/slot-claim` returns `404 league_hidden`; `/api/tournament/slot-schedule` still answers.
- Out-of-tree copy of this report: `C:/Users/fashr/Documents/FantasyTrades/LeagueHide/20261115_BUILD_LEAGUE_HIDE_BAGGERBOMB_PAGE.md`.

## 13. Not in this build

The security fixes to the league view (a separate task on `claude/security-pack-league-view`); trader v1, match cash, Agent vs Agent, rewards; removing Season mode or the old human-battle jobs.
