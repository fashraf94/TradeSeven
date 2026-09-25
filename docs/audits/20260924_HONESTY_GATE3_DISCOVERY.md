# Pre-flip honesty fixes (Backing gate 3) — discovery record and build report

**Date:** 2026-09-24 · **Branch:** `honesty/gate3-fixes` (cut from `main` @ `b746dd7e`) · **Preamble:** `git fetch origin` ran via `git pull` at session start (BUILD_RULES §3); porcelain empty; `npm ci` run; no `.env` or Vercel change. **Flags stay `false`** (`BACKING_BETA_ENABLED` = `false`, `src/config/featureFlags.js:2531` VERIFIED). **Fenced files (§1):** none read for editing, none edited, none called — `git diff --stat` in §7.
**Scope:** the two fixes the Backing spec lists as pre-flip gate 3 (`docs/FANTASYTRADES_BACKING_BETA_SPEC_V1_3.md:220` VERIFIED): fixture `REASONING` text in the unlocked film room (`LeagueSpectate.jsx`), and the `agents` read rule exposing live rules and traits to any signed-in user (`firestore.rules:224-225`).

## 0. Executive verdict

| | |
| --- | --- |
| **Fix A — the film room** | **Built.** `LeagueSpectate.jsx` no longer carries any reasoning text and looks nothing up by id. `seat.reasoning` is a Seat-contract field written by exactly two adapters: the fixture world (`leagueFixtures.leagueState`, from the moved-in `FIXTURE_REASONING`) and the real adapter (`leagueAdapter.battleToReasoning`, from the COMPLETED battle `GET /api/tournament/battle-view` returns). A settled seat with nothing recorded renders **"No reasoning recorded for this battle."** The mobile byte-pin holds (a single unlabelled line renders the exact DOM main shipped). |
| **Why it mattered today** | The real adapter is LIVE — `LEAGUE_NEXT_ARC_ENABLED = true` (`featureFlags.js:191` VERIFIED) — and backing's tape link builds its pod through the same `groupToPod` (`backingService.js:178-192` VERIFIED). On a real seat `REASONING[player.id]` rendered an empty paragraph; on an id collision it would have presented a demo sentence as the player's reasoning. |
| **Fix B — owner-only agent reads** | **Built.** `agents/{agentId}` read admits only `resource.data.ownerId == request.auth.uid`; writes unchanged. **Discovery found ZERO live cross-user client reads** (§2): every live handle is keyed on the signed-in user's own agent; the two readers that would be denied (`getLeaderboard`, unfiltered; `getAgentById`, by any id) have no live caller. **No screen was migrated and no new projection was needed.** CPU agent documents are read by no client path. |
| **Rules deploy** | `firestore.rules` changes are **inert until deployed manually via the Firebase Console** after merge (the runbook step) — say so at merge time. |
| **Tests** | 3 new files: `LeagueSpectate.honesty.test.jsx` (24 rows), `test/rules/agentsOwnerRead.rules.mjs` (13 rows, emulator), `src/services/agentReadCensus.guard.test.js` (7 rows). Both prescribed mutations red the named rows (§6). `npm run test:run`, `npm run test:rules`, `vite build`, `lint:gate` in §7. |
| **Review threshold** | 9 files on the cumulative branch diff — under the §2 ≥10-file threshold, so the multi-lens review is not mandated. The prompt's one lens — **"find a screen this breaks"** — was still run by an independent reviewer on an isolated snapshot tree: **CONFIRMED, the census could not be refuted** (§5.1); two of its findings were folded into the guard (a dead-file correction and a literal-sweep row). |
| **Found outside the task (reported, not fixed — §3)** | `RIVALRY` in `LeagueSpectate.jsx` is the same fixture-by-id pattern (cannot fire on real ids today); the `masteryDenials` row title "authed read passes" now reads as an owner read; the battle-view projection hands one battle per owner, so the film room shows the settled week's CURRENT battle's words, not the whole week's. |

## 1. Fix A — the film room

### 1.1 Before (VERIFIED at `main` @ `b746dd7e`)
`src/components/League/LeagueSpectate.jsx:28-45` declared a fixture `REASONING` map and `:115` rendered `REASONING[player.id]` inside the unlocked `FilmRoom`. The component is mounted for both adapters (`LeagueHome.jsx:164`, `LeagueLobbyDesktop.jsx:374`) and for backing's tape (`LeagueHome.jsx:130-139`, `LeagueLobbyDesktop.jsx:305-314` → `backingService.fetchTapePod`). Real seat ids are uids / `cpu-*` ids (`leagueAdapter.buildSeat`), so the lookup rendered `undefined` — an empty paragraph, not an honest state — and any id collision would have rendered fixture prose.

### 1.2 After
| Where | What | Cite (VERIFIED, this branch) |
| --- | --- | --- |
| `leagueFixtures.js` | `FIXTURE_REASONING` (the map, moved verbatim) + `fixtureReasoning(id)`; `leagueState()` attaches `reasoning` to every fixture seat. Seat contract gains `reasoning: ReasoningLine[] \| null`, `ReasoningLine { key, label, text }`. | `:110-133`, `:166`, header `:9-18` |
| `leagueAdapter.js` | `battleToReasoning(battle)`: null unless `status === 'completed'` and not `_whyConcealed`; lines = `agentContext.innerMonologue.strategy` (the paragraph `Flat6BattleView.jsx:199,356` opens its Film Room with), then one labelled line per `trades[]` entry with `rationale` else `hypothesis` (the team-card rule, `api/tournament/team-card.js:371-373`), each through `renderMotive` (`src/data/decisionRecord.js:300`, hazard 29 — no guardrail code on screen). `buildSeat` attaches it. An ACTIVE battle yields null even for its owner. | `:36`, `:200-224`, `:253` |
| `LeagueSpectate.jsx` | The map and its lookup are gone. `FilmRoom` (unlocked) renders `player.reasoning`'s lines, or `NO_REASONING_RECORDED`. Header states the two sources. `isReasoningLocked` still gates the branch. | `:7-23`, `:42`, `:101-126` |

The real adapter never imports `leagueFixtures` (pinned); no surface, hook, service or adapter imports `FIXTURE_REASONING` (pinned — only `leagueFixtures.js` references it).

### 1.3 Honest limits, stated
- `GET /api/tournament/battle-view` returns ONE battle per owner — the active one, else the most recent (`api/_utils/tournamentBattleView.js:115-126`, `pickCurrentTournamentBattle`). Tournament battles are daily-chained, so for a settled week the film room shows the words recorded on that owner's CURRENT (last) battle, not the whole week's. The task prescribes this projection; a whole-week film room is a projection change for separate tasking (the team-card projection already folds a week's battles for the backing tape).
- The film room's strategy line reads `agentContext.innerMonologue.strategy` as-is (the model's own words, C1); swap lines go through `renderMotive`. `evaluations[].rationale` (the per-check motives Flat6BattleView also shows) is NOT folded in — kept to the two sources the existing surfaces already treat as the agent's recorded reasoning.

## 2. Fix B — discovery: every client-side read of an `agents` document in `src/`

Method: `grep` for `'agents'` / `"agents"` / `AGENTS_COLLECTION` / `` agents/${ `` / `/agents/` across `src/` (tests, `__fixtures__`, `__mocks__` excluded), then every caller of each reader traced to the id/uid it passes. Subcollection handles (`agents/{id}/rules|bundles|battlePatterns` — `useForge.js`, `forgeService.js`, `dimensionMapper.js`, `SeasonReview.jsx:206`, `PlaybookPanel.ARCHIVED.jsx:83`) are out of scope: their rules already required the parent's ownerId and are untouched.

| # | Read site (VERIFIED) | Read | Keyed on → origin (VERIFIED) | Fields the screen uses | Scope | Projection? |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/services/agentService.js:16-24` `subscribeToUserAgent(ownerId)` | `onSnapshot` query `where('ownerId','==',ownerId)` | `useAgent(userId)` (`useAgent.js:26`) ← `user?.uid` / `user?.odUserId` at every caller: `App.jsx:2297`, `ForgeScreen.jsx:55`, `CommandDashboard.jsx:139`, `CommandDashboardDesktop.jsx:90`, `WatchlistListPanel.jsx:33`, `AgentCreationFlow.jsx:220`, `useWatchlistGroup.js:36`, `useAgentBookGroup.js:55` | the whole ranked agent | **OWN** | n/a |
| 2 | `agentService.js:49-50` `subscribeToAgentDoc(agentId)` | `onSnapshot` by id | sole caller `useDeployTargetProgress.js:37` ← the deploy target: the owner's ranked agent or `casual-agent-{uid}` (`ownerId: odUserId` — `api/_utils/casualClone.js:64`) | `deployProgress`, `lastDeployedAt`, `lastDecision` | **OWN** | n/a |
| 3 | `agentService.js:66-69` `getAgentById(agentId)` | `getDoc` by id | **zero callers** repo-wide | — | **DEAD** (annotated in code) | — |
| 4 | `agentService.js:83-102` `getLeaderboard()` | two `getDocs` queries, NO ownerId filter (`stats.gamesPlayed` order) | only `AgentLeaderboardTab.ARCHIVED.jsx:253`, which nothing imports | `stats`, `name` | **DEAD — cross-user by design; now DENIED** (annotated; degrades to `[]`) | a server leaderboard projection if ever revived |
| 5 | `agentService.js` directive/memory writers (`addDirective :214`, `toggleDirective :247`, `pinDirective :257`) | `getDoc` before `updateDoc` | `useAgent` → `agent.id` (own) | `directives` | **OWN** | n/a |
| 6 | `src/components/Forge/ForgeLanding.jsx:1700-1704` | `getDocs` query `where('ownerId','==',user.uid)` | `user.uid` | `isTrainingClone`/`isCasualClone` (existence) | **OWN** — and the file is DEAD besides: no live importer (`ForgeWorkshop.jsx:3` replaced it; reviewer finding, §5) | n/a |
| 7 | `src/services/tournamentGroupService.js:486-489` `assembleBoardPrefill(uid)` | `getDocs` query `where('ownerId','==',uid)` | `BoardEditor.jsx:59` ← the `uid` whose OWN board it edits (`BoardCommitFlow.jsx:31` `subscribeOwnBoard(groupId, uid)`) | `equippedWatchlistId`, `activeBattleId` | **OWN** | n/a |
| 8 | `src/hooks/useTraits.js:59-60`, `:170` | `getDoc` by id (×2) | `agentId = agent?.id` from `useAgent(user.uid)`: `ForgeScreen.jsx:56-60`, `ForgeWorkshop.jsx:61-72`, `TraitsSheet.jsx:119-147` | `equippedTraits`, `activeBattleId` | **OWN** | n/a |
| 9 | `src/services/forgeService.js:148` `resolveArchetypeForCompat(agentId)` (+ `:380` touch ref) | `getDoc` by id | `useTraits.js:215` (own, #8); `forgeService.js:174,297` create/update rule on the Forge's own agent | `archetype` | **OWN** | n/a |
| 10 | `src/screens/PitStopScreen.jsx:671` | `getDoc` by `entry.agentId` | `entry = activeSeasonEntry` (`App.jsx:9688`) ← `seasonEntries where userId == user.uid` (`App.jsx:3649`) | `name` | **OWN** (season mode scrapped, C-19; screen still mounted) | n/a |

**CPU agent documents** (`cpu-agent-*`, `ownerId: 'cpu-*'`): reached by no client path — the by-id readers (#2, #8, #9, #10) take own-agent ids; the queries (#1, #6, #7) filter on the caller's uid; #3/#4 are dead. Server-side only, as required.

**Distinct cross-user read sites:** 0 live, 1 dead (#4) — far below the ~10 STOP threshold; nothing sits in a fenced file. **Migrated screens:** none needed. **New projection:** none.

### 2.1 The rule (VERIFIED, this branch `firestore.rules:224-247`)
```
     match /agents/{agentId} {
-      allow read: if request.auth != null;
+      allow read: if request.auth != null
+                  && resource.data.ownerId == request.auth.uid;
```
(with a comment block recording the rationale and the census). Create / update / delete rules unchanged (`:248-320`). Subcollection rules unchanged (`:349-450`).

Consequences under Firestore query semantics: a LIST on `agents` is admitted only when it carries `where('ownerId', '==', <caller uid>)` — #1, #6, #7 do; #4 does not (dead, denied, degrades to `[]` through its own catch). A doc without `ownerId` denies (field access errors → false).

### 2.2 The rows
- `test/rules/agentsOwnerRead.rules.mjs` (emulator, 13 rows): owner GET succeeds with the live WHY on the doc (positive control); another user denied; anonymous denied; CPU doc denied to everyone; ownerId-less doc denied; the owner's casual clone readable by id, by nobody else; own-scoped LIST admitted and returns only the owner's docs; LIST scoped to another ownerId denied; unfiltered LIST (the leaderboard's two shapes) denied for the owner; anonymous LIST denied; CREATE (the live shape) passes for its owner and is denied under another ownerId; UPDATE allowlist admits exactly its keys and nothing for another user; DELETE denied for all. Prints the sha256 of the rules text it loaded; honours `COMPOSITION_RULES_TEXT_PATH` for a deployed-ruleset proof.
- `src/services/agentReadCensus.guard.test.js` (default suite, 8 rows): the set of `src/` files taking a top-level `agents` handle and their handle counts equal the pinned census (§2's table); **the literal sweep** — the set of files naming the collection by its literal in any spelling (comments stripped) is exactly the census files plus the three subcollection-only files (`useForge.js`, `SeasonReview.jsx`, `dimensionMapper.js`), closing the handle regex's blind spot the reviewer named (§5; a computed string is the stated residual); every `agents` LIST query filters on ownerId except the two `addDoc` creates and the one dead reader; the dead reader's only caller is archived and unimported; every census row records its ownership evidence; and — on a stubbed `firebase/firestore` — `subscribeToUserAgent(uid)` and `assembleBoardPrefill(uid)` build exactly `where('ownerId','==',uid)` on `agents`, and `getLeaderboard`'s denial degrades to `[]`.

## 3. Found outside the task — reported for separate tasking, not fixed (BUILD_RULES §3)
1. **`RIVALRY` in `LeagueSpectate.jsx:45,164`** — the same fixture-by-id pattern ("You've faced Vela 3× — Vela leads 2–1"). It cannot fire on a real seat today (keys are fixture ids; real ids are uids / `cpu-*`), but it is the class fix A removed. Same treatment: move it to the fixture seat (`seat.rivalry`) or drop it.
2. **`test/rules/masteryDenials.rules.mjs:385`** — the row titled "READ posture unchanged (authed read passes)" seeds `ownerId: OWNER_UID` and reads as the owner, so it still passes; its title now under-describes the posture (owner read). Cosmetic; not touched to keep this diff under the review threshold.
3. **Whole-week film room** — §1.3: the battle-view projection is per-owner-current-battle; a week-long film room needs the projection (or the team-card's week fold) — a projection change, separate tasking.
4. **`getAgentById` / `getLeaderboard`** — dead readers in `agentService.js` (annotated, not removed: removal is cleanup, not this task).

Raised by the §5 reviewer, out of its lens (VERIFIED by it at the cited lines; not fixed here):

5. **`src/components/Forge/ForgeLanding.jsx`** (~2,200 lines) and `Forge/DiscoverTab.jsx` are dead — no live importer (`ForgeWorkshop.jsx:3` replaced it; stale comment at `App.jsx:8621`). Candidate for `.ARCHIVED.` + a census row update.
6. **`src/components/Tournament/SpectatorView.jsx:66`** renders a raw `odUserId` as a player name — outside the backing raw-id guard's walk.
7. **`PitStopScreen`** is still routed (`App.jsx:9585, 9656`) though season mode is scrapped (BUILD_RULES §6, C-19).
8. Dead exports on `useAgent` (`addDirective`, `removeDirective`, `seedTestAgent` — `useAgent.js:222-224`); `OpenChatPanel.jsx`'s only renderer is archived.
9. `user.uid` and `user.odUserId` are two spellings of one identity (`contexts/UserContext.jsx:29-30`); a one-line equality pin in the UserContext tests would make the census's "own uid" claim mechanical.

## 4. The "no fixture text on a real path" pin — how it is proven
`src/components/League/LeagueSpectate.honesty.test.jsx` (SSR, 24 rows): (a) separation — `LeagueSpectate.jsx` has no `REASONING` identifier, no fixture value, no id lookup, reads `player.reasoning`; `FIXTURE_REASONING` is referenced by `leagueFixtures.js` alone; the real adapter never reaches `leagueFixtures`; a fixture seat carries its sentence as the seat field. (b) EVERY real state, EVERY seat — 8 pods built by `groupToPod` from a production-shaped group and the endpoint's projections (live concealed beside the viewer's own full-WHY active battle; upcoming; final with words / without / with no battles at all; a group settled while a battle doc is still active; expired; bracket final; bracket live), every seat focused, every fixture value asserted absent from the VISIBLE text (tags stripped, entities decoded — a positive control proves the decoder sees text). (c) THE ID-COLLISION TRAP — a real seat with id `atlas`. (d) the empty state, the real words (strategy, labelled swap rationale, an engine motive without its code), the locked note for live/upcoming and for the owner's own live WHY. (e) `battleToReasoning` / `buildSeat` unit rows. (f) POSITIVE CONTROL — the fixture world still renders its own sentence.

## 5. The one lens — "find a screen this breaks" (independent reviewer, isolated snapshot)
Run by a separate reviewer agent on a tar snapshot of the working tree under the session scratchpad (`review/lens-screens`, `node_modules` symlinked), read-only on git and on the shared tree, briefed to REFUTE the §2 census: any client path that reads another user's or a CPU agent document, or an unfiltered `agents` query, traced to the id it is keyed on. Its report: `scratchpad/review/reports/lens-screens.md` (outside the repo). **Verdict:** see §5.1.

### 5.1 Reviewer verdict — CONFIRMED (the census could not be refuted)
Read-only on its snapshot (no reads of the shared tree, no git, no repo writes; the census test re-run there: 7/7 at the time, 8/8 after the sweep row below). Every client-side handle on a top-level `agents` document is keyed on the signed-in user's OWN agent (ranked agent or own casual clone) or has no live caller. Its four explicit answers: (1) no live path reads a `cpu-agent-*` document from the client — every `isCpu` / `cpu-` reference renders flags from group, pool or battle docs or projections; (2) no unfiltered or foreign-ownerId `agents` query beyond the dead leaderboard pair and the two `addDoc` creates — the complete `collection(db,'agents')` set is 7 sites, all classified; (3) no screen renders another user's agent NAME/ARCHETYPE from a client `agents` read — only `battle.agentContext`, the group's `seatNames`, and the three projections; (4) no `src/` test asserts a now-impossible cross-user client read (`backingRawIds.guard.test.jsx:215-216`'s foreign-owner seed is consumed by `api/` handlers through an Admin-equivalent db).

Traces it added beyond §2 (VERIFIED by it): the deploy target on the clone path — `DeployCeremony.jsx:61` → `agentDeploy.js:48` (ranked own `agent.id`) then `:81` (`cloneId` from `/api/agent/ensure-casual-clone`, which takes `odUserId` from the TOKEN, `api/agent/ensure-casual-clone.js:69-73`, and mints `ownerId: odUserId`); `assembleBoardPrefill`'s two hosts (`LeagueParticipantView.jsx:63-64,384`, `TournamentDevScreen.jsx:220-221,1189`, both `useUser().user.uid`); `entry.agentId` ownership-checked server-side at write (`api/season/create-entry.js:465-472`); `odUserId === uid === Firebase auth uid` (`contexts/UserContext.jsx:29-30`; its one ASSUMED: `users/{uid}.auth.uid` never drifts from the auth uid after sign-up — the write is at `src/firebase/authService.js:55-56, 295-296`). Evasion sweeps, all negative for `agents`: identifier-keyed handles, non-`db` Firestore instances (single `db`, `firebase/config.js:69`), `collectionGroup` / `documentId`, `runTransaction` / `writeBatch`, all 14 dynamic `import('firebase/firestore')` sites in `App.jsx` plus 6 elsewhere, `*FromServer` / `*FromCache`, Firestore REST, the client clone-id builders, every `where('ownerId'`.

**Two corrections taken from it:** (a) `ForgeLanding.jsx` is dead as well as own-scoped — the census evidence now says so (§2 row 6); (b) the census regex was blind to `doc(db,'agents', fn())`, template-literal paths, `collectionGroup`, the compat API and a second Firestore instance — the guard gained **the literal sweep** row (§2.2), mutation-checked: a new `useOpponentAgent.js` spelling a cross-user read as `collectionGroup(db, 'agents')` on the isolated copy reds the sweep while the handle row stays green — the exact gap it named. Its remaining out-of-lens items are §3 items 5–9. Full report: `scratchpad/review/reports/lens-screens.md` (outside the repo).

## 6. Mutation results (each on an isolated copy — the repo untouched)
| Mutation | How | Result |
| --- | --- | --- |
| **A — restore `REASONING[player.id]` on the real path** | tar copy of the working tree; `LeagueSpectate.jsx` re-imports the map (`FIXTURE_REASONING as REASONING`) and renders `REASONING[player.id]` ahead of the seat lines | **8 rows red** of 24: both separation pins, the five settled real states (words / no battles / settled-while-active / expired / bracket final) and THE ID-COLLISION TRAP. Live/upcoming rows stay green (locked branch never reads reasoning — correct). |
| **C — a cross-user read spelled past the handle regex** (`collectionGroup(db, 'agents')` in a new `src/hooks/useOpponentAgent.js`, on the isolated copy) | **the literal sweep row red; the handle-census row green** — the gap the reviewer named, closed by the sweep. |
| **B — revert the read rule to `request.auth != null`** | mutated rules copy in the scratchpad, run through `COMPOSITION_RULES_TEXT_PATH` under the emulator (sha256 `f86bc5a9…` vs the branch's `d6ecb108…`) | **6 rows red** of 13: another signed-in user DENIED; the CPU doc; the ownerId-less doc; the clone readable by nobody else; a query scoped to another ownerId; the unfiltered list. Anonymous rows and the write rows stay green (correct — unchanged). |

## 7. Verification
| Check | Result |
| --- | --- |
| `npm run test:run` (tree at `567568cb`, before the literal-sweep row) | `Test Files  794 passed | 3 skipped (797)` · `Tests  15781 passed | 64 skipped (15845)` |
| `npm run test:run` (final tree, re-run after the sweep row) | `Test Files  794 passed | 3 skipped (797)` · `Tests  15782 passed | 64 skipped (15846)` |
| `npm run test:rules` (emulator, `cloud-firestore-emulator-v1.21.0.jar`) | `Test Files  17 passed (17)` · `Tests  311 passed (311)` — the new file included (`[agentsOwnerRead] rules text: firestore.rules sha256=d6ecb108aa10764f46eb1512f6036623f2d5c298c701795c28e5560b0f08defa`) |
| `vite build` | `✓ built in 33.23s` (the pre-existing chunk-size warnings only) |
| `npm run lint:gate` | exit 0, zero warnings |
| Mobile byte-pin (`backingMobilePin.test.jsx`, 53 rows) | green — `spectate/final-with-results` byte-identical (a single unlabelled line renders main's exact DOM) |
| `git diff --stat` (cumulative, fenced files) | 9 files; **zero fenced files** (9 files changed, 1055 insertions(+), 25 deletions(-): `docs/audits/20260924_HONESTY_GATE3_DISCOVERY.md`, `firestore.rules`, `src/components/League/LeagueSpectate.honesty.test.jsx`, `src/components/League/LeagueSpectate.jsx`, `src/components/League/leagueAdapter.js`, `src/components/League/leagueFixtures.js`, `src/services/agentReadCensus.guard.test.js`, `src/services/agentService.js`, `test/rules/agentsOwnerRead.rules.mjs`) |

## 8. Manual step after merge
Deploy `firestore.rules` via the Firebase Console (the runbook step); capture the live ruleset first for rollback; then prove the deployed text with `COMPOSITION_RULES_TEXT_PATH=<fetched rules> npm run test:rules`.
