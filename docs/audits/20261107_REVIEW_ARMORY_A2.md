# Review: Armory A2, per-game loadouts (PR #1029)

**Date:** 2026-11-07. **Reviewer:** Claude Fable 5.1, a fresh session, independent of the build. **Target:** PR #1029, `claude/armory-a2` @ `c5fc2c6e` (code head `ab79a9e6`; the pushed head adds the report's final text on top of it). Base: `main` @ `7969c350`. **Out of scope:** the smoke branch `claude/armory-a2-smoke` @ `06e5ff02`; checked only that nothing from it reached the PR.
**Brief:** the founder's review brief of Nov 7, 2026 (lenses 1–11). **Read first, as asked:** the A2 report, Phase 0 §1–§4 and §9, the A1 report §0 and §14, the A1 review §5, BUILD_RULES.
**Written to the repo** as this file; a copy was not needed outside the tree (BUILD_RULES §3's file-not-chat rule is met by the commit).

## In plain words

The server side of per-game loadouts is built the way the rulings say: the BaggerBomb slot, the League week lock and the clone's resync all do what the report claims, with every read before every write and nothing reaching the fenced files, and the flag-off build is main's byte for byte. Three things should be fixed before the flags turn on: the League lobby's new line says "Open" before it has checked (and after a failed check); no test pins that the lock is read inside the transaction (the one claim the report makes about races); and a BaggerBomb deploy that falls back to the ranked agent would wear the League loadout and leave the League card saying "Open" while the server says a game is running.

## Verdict

**MERGE AFTER FIXES.** 0 blocking · 3 should-fix (A2R-1, A2R-2, A2R-3) · 7 notes (A2R-4 to A2R-10). The fix pass that applies the founder's Q1 and Q3 rulings can carry the three fixes; none needs a design change. The refutation pass (§6) is recorded per finding.

| Lens | Result |
|---|---|
| 1 Flag-off identity | **Holds.** Unminified Linux builds of `main` @ `7969c350` and the head @ `c5fc2c6e`: all 55 non-map files byte-identical, hashes included (the raw `diff -rq` excluding `.map`, 0 differing). Minified build exit 0. The two leak fixes are each guarded by a plant that fails the bundle row (§1.1). Server flag-off: every read is an `if`, a ternary or an `&&` on the literal, and the pin lists each one (§1.1). |
| 2 The three writers | **Hold.** Reads precede writes in all six transaction bodies; `invalid_loadout` 400 before any read; `not_ranked_agent` on a clone; the epoch fence, owner check and idempotency hold. B3: the three writes are exactly what the allowlist note says (§4). |
| 3 The League lock | **Holds, one test gap, one overstatement.** The rule is `selectMyGroup`'s allowlist, the same function on both sides; a failed server read is a 500 with nothing written; the end date walks the NYSE calendar; Q2's sign-up states are a lobby seat and a slot claim, and nothing is built from a lobby. The in-transaction read is unpinned (A2R-2); the "serialized with a registration" claim is overstated (A2R-2). |
| 4 The clone | **Holds.** Resync applies the slot or the default; GUARD 1 unchanged; the trait seed, the retirement of replaced docs and the return to the parent's traits each have a row and a mutant; `activeRules` are re-projected at deploy from the clone's own traits (proved end to end, §4.2). R7 as read. One reader-side gap on the fallback path (A2R-3). |
| 5 Training | **Holds.** `loadoutSpecByUser` is dead under the flag (the clone and the endpoint), a pre-flip pod included; nothing else reads it. |
| 6 R3 and R4 | **Hold.** The adapter's order flips under the flag only; the ledger's predicate reads both loadouts; `card.js` passes the battle's own archetype; flag-off `shelf === archetype`, so the count and the refusal are today's. |
| 7 Rules | **Q1 confirmed, no sibling gap.** The update rule's `hasOnly` closes updates; no wildcard rule; the server endpoints take allowlisted fields. The create rule's row belongs in `test/rules/masteryDenials.rules.mjs`'s denied-birth table (A2R-6). `tournamentGroups` reads need no change. |
| 8 The surfaces | **Hold, with A2R-1 and A2R-3.** The hub's cards never claim open while checking or after a failed read; the League lobby's line does (A2R-1). N1 holds (every live form bare). The copy guard's "next deploy" move is BaggerBomb-only with a biting plant. AR-5, AR-6 and AR-1 taken from the build's rows and its headless-Edge table; not re-measured here. The chooser's two mounts render nothing with the flag on. |
| 9 Guards | **Hold, none loosened.** B3 three keys at count 1; `ALLOWED_ACTIVITY` two patterns pinned call by call; `NAMED` four plus one names; three importer lines; "next deploy" in six named BaggerBomb strings only. |
| 10 Tests | **Real.** The e2e runs the real `decide.js`, `createAgentBattle`, writers and clone provisioning through the strict double (reads before writes enforced). My 14-file control: 288 rows, exit 0. Five mutants of my own: four killed, one survived (A2R-2). |
| 11 Checks | **Green on the pushed head.** Full Linux suite exit 0: 1,313 files (1,305 passed, 8 skipped), 28,978 rows (28,889 passed, 89 skipped, 0 failed), 267 s. `lint:gate` exit 0. Minified build exit 0. |

## 0. The founder's rulings, as the brief gives them (recorded, not counted)

| # | Ruling | Where it stands in the code at `c5fc2c6e` |
|---|---|---|
| Q1 | Close the agent-create rules gap in the fix pass: deny a `loadouts` key, with a rules-suite row. Console deploy before the flip. | Confirmed open: `firestore.rules:283-286` denies eleven birth keys and `loadouts` is not among them (§1.7, A2R-6). |
| Q2 | "Registration" is the moment a ranked group names the player, as built. | Checked: the two earlier sign-up states are a lobby seat and a slot claim; nothing builds a board or a draft from a lobby; a slot claim creates the group document (§1.3, A2R-5). |
| Q3 | Reword the lock line: "Locked until the week is scored, after the close on {day date}." The armory's context and the cards follow. | Checked against the copy guard: passes its banned list and digit rule; eight pinned strings in four test files move with it; the formatter always appends a time (§1.8, A2R-7). |
| R1–R4, R6–R11, Q8, Q9 | Accepted as built. | — |
| R5 | Carried to A3. | §8. |

The A2 report's §0 (D1, FD-1 to FD-4, FD-10, FD-11, N1, the board adjustments, the A1 carries) was checked against the code lens by lens below.

## 1. Lens by lens

### 1.1 Flag-off identity (lens 1) — holds

**Client, measured.** Both trees built in WSL (`vite build --minify false`, Node 20.20.2, the lockfile `40382e64edb6` shared by both commits): `~/pd-ci-a2rm` at `7969c350`, `~/pd-ci-a2r` at `c5fc2c6e`. 107 files each. The authoritative number is the raw comparison with source maps excluded: **0 differing files of 55**, which means the content hashes in the names are identical too. The masked-and-renamed comparison (the A1 review's method) agreed on every non-map file but dropped one file because two chunks are both named `index-*.js` and collide once masked; the raw comparison does not have that problem and is the one to cite. Of the 52 source maps, 50 differ only in the tree's name inside `sources` (`pd-ci-a2rm` vs `pd-ci-a2r`); 2 (`CommandCenterHub-CIfDFKLB.js.map`, `index-ok8k4FzL.js.map`) also differ in `sourcesContent` (18 and 13 mentions of the flag on the head side, none on main; the same module count, 55 and 1,142) because the source text changed while the emitted code did not. `vite.config.js:14` sets `sourcemap: true`, so the maps ship as they did at A1, where the review recorded the same (A1 review §1.1). Minified build of the head: exit 0, 107 files.

**The two leak fixes are guarded against a re-leak.** `agentForm.flagOffBundle.test.js` plants exactly the two shapes that leaked during the build: the League line declared without its flags (`leagueLoadoutSlot.jsx`, commit `6d08fbf8`'s fix) and a model constant that reads another binding's property (`src/constants/perGameLoadout.js`, commit `85ececdc`'s fix), and expects leftovers in the bundle for each (`agentForm.flagOffBundle.test.js:318-320`). The ten A2 modules bundle to nothing when imported unused, and the five shipped hub modules that read the flag bundle with nothing of A2 (`:236-254`).

**Server, read.** With the literal false: the three writers ignore `loadout` (`change-archetype.js:220`, `equip-watchlist.js:160`, `unequip-watchlist.js:115`), read no lock (`:253`, `:189`, `:139`), spread no slot (`:361`, `:224`, `:164`) and map no `league_locked` (`:137`, `:61`, `:52`); the clone passes the inherited fields through (`casualClone.js:82`, `:120`) and seeds nothing (`:260`, `:291`); training reads the override as today (`trainingClone.js:281`); the lobby validates `loadoutSpec` as today (`lobby-quickplay-training.js:76`); the ledger's `shelf` is the archetype (`cardStore.js:149`) and the refusal compares the agent's (`:280`); the adapter's order is today's (`baggerbombAdapter.js:597`). `perGameLoadoutFlags.test.js:73-161` pins every one of these lines and fails on any other reader under `api/` or `src/` (`:178-183`). The pin itself is `false` (`:47-49`) and `DARK_BY_DESIGN` names it (`flagPinGuard.test.js:153-154`).

### 1.2 The three writers (lens 2) — hold

Read in full: `api/agent/change-archetype.js` (567 lines), `equip-watchlist.js` (284), `unequip-watchlist.js` (212), with `api/_utils/perGameLoadout.js` (93) and `src/constants/perGameLoadout.js` (230).

- **Ordering.** Each BaggerBomb path is one transaction: the agent get, the epoch fence (`validateWriteEpochInTx`), the list get where there is one, then the checks, then one `tx.update` (`change-archetype.js:159-170`, `equip-watchlist.js:91-102`, `unequip-watchlist.js:70-77`). The archetype path's composition check reads bundles with `tx.getAll` before the write (`change-archetype.js:167`, `:111-131`). Each League path adds the lock read to the read phase before `battle_active`, idempotency and the compile reads (`change-archetype.js:253-256`, `equip-watchlist.js:189-192`, `unequip-watchlist.js:139-142`). Materialization is one spread inside the same `txUpdateAgentSettings` call (`change-archetype.js:361`, `equip-watchlist.js:224`, `unequip-watchlist.js:164`), so the slot and the change commit together. The e2e's double throws on a write before a read (`callsFirestore.js:244-246`), and the e2e drives both equip paths and the BaggerBomb archetype path through it.
- **Refusals.** `invalid_loadout` is answered after auth and the id checks and before `getFirebaseAdmin()` (`change-archetype.js:220-223`, `equip-watchlist.js:160-163`, `unequip-watchlist.js:115-118`); a non-string or an unknown word is `null` from `loadoutKindOf` (`perGameLoadout.js:42-45`). `not_ranked_agent` comes after the owner check, so a clone, which carries the player's `ownerId`, is refused for being a clone (`isRankedAgentDoc`, `perGameLoadout.js:60-62`). The epoch fence and the owner check are the same calls the League paths make. Idempotency: a BaggerBomb change to the archetype the loadout already wears, the default included, writes nothing and logs nothing (`change-archetype.js:165-166`); the book paths likewise (`equip-watchlist.js:99-100`, `unequip-watchlist.js:76`). One consequence worth knowing: a League re-equip of the already-equipped list during the lock answers 409, not 200, because the lock read precedes the idempotency return; today's `battle_active` sits in the same place, so this is today's shape.
- **B3.** See §4.
- **The allowlist.** Exactly three keys, each at count 1, under `_notes_per_game_loadouts_a2` (`compositionProtectedStoresAllowlist.json:390-392`, `:510-512`); the note's description of the writes matches the code.

### 1.3 The League lock (lens 3) — holds, with A2R-2

- **The rule.** `leagueLockOf(docs) = leagueLockOfGroup(selectMyGroup(docs))` (`src/constants/perGameLoadout.js:200-208`); `selectMyGroup` keeps `isTraining !== true` groups in `forming`, `drafting`, `awaiting_open`, `battle` (`leagueTournament.js:686-695`), so `complete`, `expired` and `voided` do not lock and training pods never do. The server reads it through `readLeagueLockInTx` (`api/_utils/perGameLoadout.js:32-37`), the client through `subscribeLeagueLock` (`leagueLockService.js:16-24`): the same query, the same function. Mutant R2 (only `battle` locks) failed 8 rows across the writers and the model.
- **The in-transaction read.** `tx.get(query)` (`perGameLoadout.js:34`) is a transactional read of the documents the query returns. Firestore serializes the transaction against those documents; a group document created in the same instant is a phantom under either implementation. The report's §4 ("a registration racing the write is serialized with it") overstates. It does not matter for correctness: the race that FD-3 closes is a League write landing after the board and the draft, and by then the group exists in `forming` or `drafting`, which the read sees. But nothing pins that the read goes through the transaction at all (A2R-2).
- **When the read fails.** Server: a thrown `tx.get` is not a sentinel, so each writer answers 500 `server_error` with nothing written (`change-archetype.js:402-408`, `equip-watchlist.js:248-252`, `unequip-watchlist.js:182-186`). Client (the hub): `useLeagueLoadoutLock` holds `{ lock: null, failed: true }` and the card stays CHECKING, which is treated as locked (`perGameLoadoutModel.js:57-58`, `:81`); the row at `CommandCenterHub.loadouts.jsdom.test.jsx:181-200` drives all three states. The League lobby's line is the exception (A2R-1).
- **The end date.** `leagueWeekEndMsOf` counts `WEEK_DAYS_REQUIRED` trading days from the anchor on the NYSE calendar and returns that day's `closeMs` (`src/constants/perGameLoadout.js:179-194`), so a holiday walks forward (R1) and an early close ends at 1:00 PM; rows for both (`perGameLoadout.test.js:135-144`). The anchor order is the handoff's `startAnchor`, the first banked day, the slot claim's `battleStartWeek`, then the formation instant through a read-side twin of `deriveBattleStartWeek` (`:165-172`); the twin is held equal to the real writer at every half hour of three weeks, imported from `liveDraftFormation.js`, not copied (`api/_utils/perGameLoadout.test.js:24`, `:120-131`). Outside the calendar's years the end is null and the lock holds undated (`:184-193`).
- **Q2.** Two states precede a group document naming the player: a lobby seat (`tournamentLobbies`, created by `createLobby`, joined by `joinLobby` or `matchmakeJoin`, formed into a group at `forming` by `formGroupFromLobby`, `tournamentLobbyService.js:308-375`) and a live-draft slot claim, which creates the group document at `forming` with `groupMembers: [odUserId]` on the first claim (`liveDraftFormation.js:397-405`) and appends later claimants (`:520`), so it locks from the claim. Boards and drafts read groups only (`produce-agent-boards.js`, `resolve-agent-draft.js`, the orchestrator's `fetchEligibleGroupsByStatus(FORMING)` at `tournamentOrchestrator.js:577`). Nothing is built from a lobby, so "registration = the group names the player" holds and the lobby seat is not a finding (A2R-5).

### 1.4 The clone (lens 4) — holds

- **Resync and GUARD 1.** `buildCasualCloneResync` applies the slot or passes the default through (`casualClone.js:110-121`); `ensureCasualClone` resyncs only when the fresh read shows no `activeBattleId` (`:240-262`), unchanged from main apart from the seed. The resync has no `settingsRev` gate: every deploy's `ensure-casual-clone` call resyncs a clone that is not mid-battle, which is what lets a BaggerBomb change reach the next deploy without touching the ranked record's revision (§4).
- **The trait seed.** When the slot's archetype differs from the parent's, `seedBaggerbombTraits` seeds that archetype's born-with set with deterministic ids and soft-deletes every trait rule doc outside the final set (`:131-144`), the training override's rule (`trainingClone.js:295-313`); returning to the parent's archetype takes the parent's traits back and retires the last set's docs. Rows: `casualClone.perGame.test.js:109-156`; mutant R3 (the retirement skipped) failed 2 rows. The lease is re-checked after the seed on both the resync (`:260-262`) and the creation (`:291-294`).
- **`activeRules` at deploy.** `decide.js:260` re-projects `activeRules` from the clone's own `equippedTraits` and rule docs before the battle snapshot freezes them; my end-to-end row (§4.2) shows the second casual battle's `activeRules` carry the new archetype's trait ids and differ from the first battle's.
- **Character settings.** The battle snapshot judges the clone's leans against the clone's archetype (`casualClone.perGame.test.js:184-203`, through the real `buildCustomizationSnapshot`).
- **R7.** The clone keeps inheriting `equippedAt`, `archetypeDrift`, `personality`, `config`, colours, `deployedStrategy`, the Character settings and `settingsRev` (`trainingClone.js:65-99`); `archetypeDrift`'s readers are the ranked record's surfaces and the CPU builder, not the clone. Accepted as read.
- **Cost, noted.** The seed's soft-delete scans the clone's whole `rules` collection on every resync (A2R-8).

### 1.5 Training (lens 5) — holds

`trainingClone.js:281` reads `loadoutSpecByUser` only when the flag is off; `lobby-quickplay-training.js:76` treats any `loadoutSpec` as `{ valid: true, value: null }` under the flag, so an old client's spec is ignored, not refused, and `trainingLifecycle.js:507` then writes no `loadoutSpecByUser`. The only other reader, `tournamentOrchestrator.js:885`, hands the pod's field to `ensureTrainingClones`, which ignores it. Rows: `trainingClone.test.js:434-460` (a pre-flip spec not read; the slot never reaches training), `lobby-endpoints.test.js:395-423`. The chooser's two mounts render `null` under the flag (`LeagueDeskParts.jsx:605`, `LeagueLobbyRedesign.jsx:485`); the file stays for identity and goes in the flip PR.

### 1.6 R3 and R4 (lens 6) — hold

`baggerbombAdapter.js:597`: a literal ternary, the battle's snapshot first under the flag, today's order otherwise. `cardStore.js:149` sets `shelf` to both loadouts' archetypes under the flag and to the agent's otherwise; `isShelved` takes a list or a string (`:157`); the create refusal compares the tape day's archetype with `battleArchetype` under the flag (`:280`), which `card.js:206` passes from `battle.agentContext.archetype` (always a string: `createAgentBattle` stamps `agentData.archetype || 'unknown'`). Flag-off the count's `+1` is unchanged (`:285`: a new card's archetype equals the agent's, so it is open). Mutant M9 (the build's) and the rows at `cardStore.perGame.test.js` cover both arms.

### 1.7 Rules (lens 7) — Q1 confirmed, no sibling

`firestore.rules:270-331` (create) denies `standingLeans, dials, settingsRev, equippedTraits, deployedStrategy, activeBattleId, lessons, forgeSuggestions, isTrainingClone, isCasualClone, rankedAgentId`; a `loadouts` map passes. `:332-335` (update) admits only `directives, lastViewedEvolutionCycle, starterKitCompleted, updatedAt`, so no client update, merge or set can write `loadouts`. No `{document=**}` rule grants writes (`:77-154`, `:445`, all `false`). Server endpoints that take a body write allowlisted fields (`update-agent-settings.js:65` `FIELD_VALIDATORS`; the writers above). `tournamentGroups` reads are already authenticated-any (`:648-660`), which the client's lock query needs and no more. The create row belongs in the denied-birth table at `test/rules/masteryDenials.rules.mjs:259-285` (A2R-6).

### 1.8 The surfaces (lens 8) — hold, with A2R-1 and A2R-3

- **Boards 1–5.** The cards, the Deploy line, the League lines and the armory's context read as the boards with the founder's adjustments: "No book · open market" is a state, not a block (`perGameLoadoutModel.js:67`, `LOADOUT_COPY.lines.nobook`; the Hold row at `CommandCenterHub.loadouts.jsdom.test.jsx:267`); the record slot is not rendered; BaggerBomb first.
- **Checking.** The hub never claims open before the read answers or after it fails (`:181-200`); the armory's Equip for a CHECKING or LOCKED League card is disabled with the lock or checking label (`Armory.jsx:356-359`, `:378`), and the hook refuses too (`:209`, row `:351-369`). The League lobby's line has no such state (A2R-1).
- **N1.** The hero's read stays `armoryHeroRead` under both flags (`CommandCenterHub.jsx:723`); the only dressed figures are `LoadoutStill` at 48/40 px (`LoadoutStill.jsx:21`, `rate: 'still'`) and the armory's preview; row `:466`.
- **The copy guard's move.** "next deploy" is allowed in exactly six BaggerBomb keys and checked absent from eleven League keys (`hubCopy.guard.test.js:594-606`); the plant row (`:636-643`) catches a League "next deploy", a count and a waiting Deploy. The FD-1 pin moved to `footnoteBaggerbomb` (`:608-613`).
- **AR-5, AR-6, AR-1.** AR-5: `ArmorySheetContext` carries the opener to `HubSheet` at both shells (`CommandCenterHub.jsx:451-463`, `:619-631`; `Armory.jsx:405`, `:436`); row `:380`. AR-6: under 315 px the six sets sit in a 3 × 2 grid inside the hero's box (`Armory.jsx:98-110`, `:553-565`; `ShadowStage.jsx:280`); row `:454`. AR-1: the build's headless-Edge table (A2 report §7) shows the hero in view after every close path at 390 and 320; I took it as reported and did not re-measure.
- **The chooser's mounts** render nothing under the flag (§1.5).

### 1.9 Guards (lens 9) — none loosened

B3: three keys at count 1 (`compositionProtectedStoresAllowlist.json:390-392`). `ALLOWED_ACTIVITY['hub/useLeagueLoadoutLock.js']`: two patterns (`commandCenterHub.mount.guard.test.js:765`), pinned call by call (one effect, one `subscribeLeagueLock`, the cleanup its return, `commandCenterHub.activity.guard.test.js:246-271`), with a biting plant. `NAMED`: `loadoutService` four names and `leagueLockService` one (`mount.guard:1268-1269`), each file's own names pinned (`:1319-1320`). Three importer lines (`:1314-1317`). Five permitted terminals, each a purpose (`:626-634`); `LoadoutStill.jsx` in the wrapper list (`:702-703`). Token and motion guards: eleven files registered at zero (`tokens.guard.test.js`, `motion.guard.test.js`, both baselines).

### 1.10 Tests (lens 10) — real

- **The e2e** (`api/agent/perGameLoadout.e2e.test.js`) mocks the model, the flag, auth and the loggers only; `decide.js`, `createAgentBattle` (through `decide`), the three writers and `ensureCasualClone` are the real modules, on the harness double that enforces reads before writes and retries on version conflicts (`callsFirestore.js:239-275`). The double's only A2 change is `array-contains` support (`:167`).
- **Vacuity.** The writers' rows assert the stored document, the response, the shadow log and the recorded queries (`perGameLoadout.writers.test.js`, `loadoutWriterDb.js:64-75`: the groups query is recorded, so "no lock read" rows mean it). The clone rows assert document states and the rule docs' `isDeleted`. The hub rows drive the lock through three states.
- **Order dependence.** The one leak the build found (a failing row leaving a card mounted) was fixed in `ab79a9e6`; my control run of the 14 A2 files passed 288 rows in 5 s.
- **Mutants.** §5.

### 1.11 Checks (lens 11) — green

On `c5fc2c6e` in `~/pd-ci-a2r` (WSL Ubuntu, Node 20.20.2, `TZ=UTC`, `flock /tmp/pd-suite.lock`, 8 workers): the full suite exit 0, **1,313 files (1,305 passed, 8 skipped), 28,978 rows (28,889 passed, 89 skipped, 0 failed), 267 s** (18:23:38–18:28:07 UTC); `lint:gate` exit 0; minified `vite build` exit 0 (17 s). The rows that fail only on Windows on this machine pass here, as the report says.

## 2. Findings

Severity: **blocking** · **should-fix** · **note**. Each should-fix finding has one refuter (§6).

### A2R-1 · should-fix · the League lobby's line claims "Open" with a null group

- **Where:** `src/components/League/LeagueLoadoutLine.jsx:50`, `:59`; `LeagueHome.jsx:87`, `:98`; `LeagueLobbyDesktop.jsx:295`; `tournamentGroupService.js:225`.
- **Evidence:** the line judges `leagueLockOf(group ? [group] : [])`, so a null group is "no group", which is open, and `door = !lock.locked && …` makes it a button to the Command Center. Both lobbies hold `activeGroup` in `useState(null)` and set it from `subscribeMyGroup`'s first snapshot, so the line renders "Open · locks when you register" with a door until the snapshot lands; and `subscribeMyGroup`'s error handler calls `callback(null)`, so a failed read reads as open for good. The hub's cards have CHECKING for both cases (`perGameLoadoutModel.js:57-58`); the brief's lens 8 asks that the checking state never claim open. The build's own row pins the null case as open (`LeagueLoadoutLine.jsdom.test.jsx:68-81`). The server refuses anyway, so no wrong write follows; this is a display claim that disagrees with the server (BUILD_RULES §9).
- **Smallest fix (the refuter's, better than my first):** both lobbies already hold a readiness flag, `seatKnown` (`LeagueHome.jsx:146`, `LeagueLobbyDesktop.jsx:351`), which gates `backingSlot` but not the line. Thread `groupKnown={seatKnown}` to `LeagueLoadoutSlot` / `LeagueLoadoutLine` (a boolean, not an `undefined` tri-state: `LobbyTabbed` at `:508` and `DeskLobby` at `:136` default `activeGroup = null` and would swallow it); when false, render a no-door section with `LOADOUT_COPY.lines.checking` and `tags.checking`, which already exist (`loadoutCopy.js:25`, `:48`). Keep the `group={null}` row (answered none = open) and add a `groupKnown={false}` → checking row. The error case is a residue: `subscribeMyGroup`'s callback cannot tell failure from "none" (`seatFor(uid)` is set either way), so the lobbies' callback has to learn the distinction, as `subscribeLeagueLock` already draws it (`leagueLockService.js:6-8`).
- **Refuter:** §6.1, CONFIRMED.

### A2R-2 · should-fix (test) · nothing pins the lock read inside the transaction, and the report overstates what it buys

- **Where:** `api/_utils/perGameLoadout.js:34`; `api/_utils/__fixtures__/loadoutWriterDb.js:86-91`; `api/_utils/perGameLoadout.test.js:31-43`; A2 report §4.
- **Evidence:** mutant R1 replaces `await tx.get(query)` with a read outside the transaction whenever the query has a `.get()` method (production always does) and **survives** the six lock files, 82 rows (§5). Two fixture facts let it: the writers' fake `runTransaction` does not record `tx.get` calls, and the unit test's query stub has no `.get()`, so the mutant falls back to `tx.get` there. The report's §4 says the in-transaction read serializes a racing registration; a transaction serializes against the documents it read, and a new group document is a phantom either way. The race FD-3 exists to close (a League write after the board and the draft) is covered because the group then exists in `forming` or `drafting`.
- **Smallest fix (proved by the refuter, §6.2):** in the e2e, before step 1's League write, seed a finished group in the player's history (`tournamentGroups/grp-old`, `status: 'complete'`, `groupMembers: [H.OWNER, …]`), set the double's `afterTxBody` hook to collect `readPaths`, run the write and expect the paths to include `tournamentGroups/grp-old`; under mutant R1 that row fails (`expected [ 'agents/agent-p1b-1' ] to include 'tournamentGroups/grp-old'`), unmutated it passes. Two fixture facts shape it: the hook fires only after the transaction body resolves, so a refused League write never reaches it, and `tx.get(query)` records the paths of the documents returned, so an empty answer records nothing; hence a successful write with a non-locking group in history. The fuller alternative, `loadoutWriterDb.js`'s `runTransaction` recording `tx.get` calls with each writer's League row asserting the groups query went through `tx`, also pins that all three writers hand the live transaction to the helper. Reword §4 to "read in the transaction, so a group already written is seen consistently with the agent read".
- **Refuter:** §6.2, CONFIRMED.

### A2R-3 · should-fix · a BaggerBomb deploy that falls back to the ranked agent wears the League loadout, and the League card does not see the game

- **Where:** `src/services/agentDeploy.js:181-220`; `src/config/featureFlags.js:237`; `api/_utils/casualClone.js:82`, `:120`; `api/agent/decide.js:991`; `src/components/CommandCenter/hub/perGameLoadoutModel.js:57-58`, `:81`; `hub/useHubRuntime.js:177-178`.
- **Evidence:** with `CASUAL_CLONE_CONCURRENCY_ENABLED` on, the deploy service resolves the clone first and "on ANY failure we fall back to the real agentId: the deploy proceeds exactly as today, degraded to the real agent, never blocked" (`agentDeploy.js:181-190`, `:206-215`). A2 applies the BaggerBomb slot only on the clone, so a fallback BaggerBomb game runs on the ranked record in the **League** loadout (ruling D1 broken on the degraded path), and `decide.js:991` sets the ranked record's `activeBattleId`. The hub's League card derives its state from the lock read and the book alone and never reads `agent.activeBattleId` (the pre-A2 card did: `hub/selectors/loadout.js:136`), and the hub's doors are regated from `unlocked` to `ready` (`useHubRuntime.js:177-178`), so with no ranked group the card reads **Open** with a door while every League write answers 409 `battle_active`; the armory shows A1's "Locked while a game is running" line only after the attempt. The running strip would show the game in the League archetype, which is at least what it wears. The flag is dark and the path is degraded-only; the report does not mention the fallback.
- **Smallest fix:** (a) in `deriveLoadoutCards`, treat a non-null `agent.activeBattleId` as League LOCKED with `when: null` and a battle-lock line of its own (not `lockedUndated`, whose "Set when you registered" is wrong here; A1's "Locked while a game is running" words), one model row and one hub row; and regate `changeAdjustments` (`useHubRuntime.js:179`) the same way as its two neighbours, or say why it differs. (b) A founder question for the flip PR: with per-game loadouts on, should the fallback still deploy the ranked agent (wearing the League loadout, and saying so), or refuse the BaggerBomb deploy when the clone cannot be ensured (a REFUSED outcome, `markCloneFallback` kept)?
- **Refuter:** §6.3, CONFIRMED (both parts).

### A2R-4 · note · an abandoned ranked pre-battle group holds the lock indefinitely

- **Where:** `api/_utils/trainingLifecycle.js:860-945` (`expireStaleTrainingPods`, "TRAINING-ONLY BY CONSTRUCTION"); `tournamentGroupService.js:226` (`voidGroup`, from `battle` only); `src/constants/perGameLoadout.js:206-208`.
- **Evidence:** the only writer of `expired` is the training sweep, which skips `isTraining !== true` and `isLiveDraft === true` by construction; `voided` is reachable from `battle` only. A ranked group that forms (from a lobby or a slot) and never advances therefore stays `forming`, which already blocks a second registration through `selectMyGroup` and, with A2, also freezes the League loadout, with the line dated to a derived week that has passed or undated. Pre-existing lifecycle gap; A2 adds a consequence. For separate tasking, not a fix here.

### A2R-5 · note · Q2: the two sign-up states before a group names the player

Recorded in §1.3: a lobby seat (nothing is built from a lobby) and a slot claim (which creates the group document and so locks from the claim). The ruling "registration = the group names the player" stands as built.

### A2R-6 · note · Q1: the gap, no sibling, where the row goes

Confirmed at `firestore.rules:283-286`; updates are closed by `:334-335`; no other client path can write `loadouts` (§1.7). The fix pass adds `'loadouts'` to the `hasAny` list and a row to `test/rules/masteryDenials.rules.mjs`'s denied-birth table (`:259-285`), and the founder deploys the rules in the Console before the flip, as ruled.

### A2R-7 · note · Q3: the reword passes the guards; what moves with it

"Locked until the week is scored, after the close on {day date}." matches none of the copy guard's banned claims (`hubCopy.guard.test.js:375-379`) and none of the A2 rows' growth words (`:581`); the date is an argument, so the digit rule is untouched. Two things for the fix pass: `formatLockEnd` always appends the time ("Fri Nov 6, 4:00 PM", `src/constants/perGameLoadout.js:220-224`), so the new sentence wants a date-only variant or accepts the time; and eight pinned strings move: `hubCopy.guard.test.js:616-620` (four), `perGameLoadoutModel.test.js`, `CommandCenterHub.loadouts.jsdom.test.jsx:190`, `LeagueLoadoutLine.jsdom.test.jsx:88`, plus the report's §3 example and the server's `message` (`api/_utils/perGameLoadout.js:54`) if it is to say the same.

### A2R-8 · note · the seed's soft-delete scans the clone's rules on every resync

`casualClone.js:143` calls `softDeleteReplacedTraitRuleDocs` on every resync, archetype changed or not; it reads the clone's whole `rules` collection and updates each live trait doc outside the final set (`archetypeSeeding.js:136-156`). That is N reads and up to K writes per deploy that the clone did not pay before, and it also retires any parent orphan copied onto the clone (harmless: inert either way). Acceptable; recorded so the cost is known.

### A2R-9 · note · dark-flag carries

`COMPILER_ENABLED` is false: the compiled build's source vector has no archetype component (`deployBuildValidation.js:68-80`), and the clone carries no compiled build (`copyAgentSubcollections` copies `rules` and `bundles` only), so a future compile at deploy would derive from the clone's own fields. `MASTERY_ENFORCEMENT_ENABLED` is false: the League archetype change revalidates an aggressive tempo dial at switch time (`change-archetype.js:293-307`); the BaggerBomb path does not, and the battle snapshot revalidates leans but not the dial. Neither is A2's to fix; both belong in those flags' flip checklists.

### A2R-10 · note · the identity method

The masked-and-renamed comparison collides the two `index-*.js` chunks and under-counts by one file; the raw `diff -rq` with maps excluded is the check to cite (0 of 55). Recorded in §1.1 and in the reviewer's memory.

## 3. The three writers, as B3 asks: a human review of the BaggerBomb slot writes

**Verdict: ACCEPTED.** The three `tx.update`s on `agents/{agentId}` are what the allowlist note says and nothing more.

| Writer | Transaction body | Writes | Skips `txUpdateAgentSettings` |
|---|---|---|---|
| `change-archetype.js` `changeBaggerbombArchetype` `:158-170` | agent get → epoch fence → exists, owner, ranked → idempotency → composition legality (bundle `getAll`) → one update | `loadouts` (the whole map with `baggerbomb` replaced), `updatedAt` | Yes: no ranked setting changes, no trait seed on the ranked record, no battle lock (FD-1) |
| `equip-watchlist.js` `equipBaggerbombBook` `:90-104` | agent get → epoch fence → list get → exists, owner, ranked → list committed and owned → idempotency → one update | `loadouts`, `updatedAt` | Yes |
| `unequip-watchlist.js` `unequipBaggerbombBook` `:69-79` | agent get → epoch fence → exists, owner, ranked → idempotency → one update | `loadouts`, `updatedAt` | Yes |

**Does skipping the revision lose a change?** Every reader that keys on `settingsRev`, the manifest or `updatedAt` was checked: the clone's resync has no revision gate and runs at every deploy that is not mid-battle (`casualClone.js:208-262`); `compileOnSettingsChange` and `deployBuildValidation` are dark (`COMPILER_ENABLED = false`); `resolvedAgentManifest` has zero readers and pairs the frozen `settingsRev` with the snapshot's leans (`:20-24`); the hub reads the agent document live and re-renders on the slot's change. Proof by running: the build's e2e proves the book (step 4b); this review's scratch row proves the archetype the same way (§4.2): the ranked record's `settingsRev` is unchanged through a slot change, and the next deploy's battle wears the new archetype with its traits projected. The one place a BaggerBomb change does not reach is a deploy that never goes through the clone (A2R-3), which is a reader-side matter, not these writers'.

## 4. What this review ran

### 4.1 Trees

`~/pd-ci-a2r` (`c5fc2c6e`: suite, lint, builds), `~/pd-ci-a2rm` (`7969c350`: the identity base), `~/pd-ci-a2rx` (`c5fc2c6e`: the mutants, restored from `HEAD` after each), all detached worktrees of `~/pd-ci` with `node_modules` linked to `~/pd-af0` (lockfile `40382e64edb6` on both commits), runs under `~/pd-a2r-runs`.

### 4.2 The archetype's end-to-end proof (not committed)

A copy of the build's e2e row, run in `~/pd-ci-a2rx` and deleted afterwards (the tree clean), through the same real modules: BaggerBomb set to `degen` on the slot while the record stays `momentum_chaser`; the clone is born `degen` with `degen`'s born-with traits and its first battle is `degen` with those rules; mid-game BaggerBomb is set to `guardian` and the ranked record's `settingsRev` does not move; the running clone is untouched (GUARD 1) and its battle stays `degen`; after the game the resync alone makes the clone `guardian` with `guardian`'s traits, retires `degen`'s seeded docs, and `decide.js` deploys a `guardian` battle whose `activeRules` carry `guardian`'s trait ids and differ from the first battle's; the ranked record ends `momentum_chaser` with its original `settingsRev` and traits. Exit 0, 1.8 s.

## 5. Mutants of this review

Control (unmutated), the 14 A2 files: 288 rows, exit 0, 5 s. Each mutant: one edit on `~/pd-ci-a2rx`, the named files run (`TZ=UTC`, 6 workers), killed = nonzero exit, files restored from `git show HEAD:path`, the tree confirmed clean.

| # | Mutant | Files | Result |
|---|---|---|---|
| R1 | the lock read leaves the transaction: `tx.get(query)` → `query.get()` when the query has one (`perGameLoadout.js:34`) | the six lock files, 82 rows | **survived** (82/82) → A2R-2 |
| R2 | only a `battle` group locks (`leagueLockOfGroup`, `src/constants/perGameLoadout.js:201`) | the same six | killed, 8 rows (the writers' forming and drafting; the model's allowlist, three statuses, re-registration and the undated end) |
| R3 | the resync never retires replaced trait docs (`casualClone.js:143`) | `casualClone.perGame`, `casualClone`, the e2e; 45 rows | killed, 2 rows (the parent's docs go inert; the return to the parent's traits) |
| R4 | the BaggerBomb book equip also writes the ranked record's book (`equip-watchlist.js:102`) | the writers, the e2e, `equip-watchlist`, the unit file; 56 rows | killed, 2 rows (the e2e's final record check; "the ranked book untouched") |
| R5 | a clone document is treated as a ranked record (`isRankedAgentDoc`, `perGameLoadout.js:61`) | the same four | killed, 2 rows (the 409; "only the ranked record holds the slot") |

## 6. The refutation pass (BUILD_RULES §2)

Each should-fix finding was handed to a separate reviewer told to refute it with a concrete repro, working read-only on the snapshot trees (A and C on `~/pd-ci-a2r`, B on `~/pd-ci-a2rx` through the mutant runner, which restores the tree). All three findings survived: **3 CONFIRMED, 0 REFUTED.** The notes (A2R-4 to A2R-10) were not sent out; each rests on a read cited above.

### 6.1 A2R-1 — refuter A: CONFIRMED

Read-only on the Windows worktree and `~/pd-ci-a2r`. Tried to find a gate and found none: `LeagueHome.jsx:54` and `LeagueLobbyDesktop.jsx:254` destructure `{ state, isFixtures }` from the League state hook and drop its `loading`; `useRealLeagueState.js:75`, `:155` compute `groupReady` and `loading`, but no lobby reads them; `LeagueScreen.jsx` has no loading branch. `LobbyTabbed` renders on first paint with `activeGroup` still `null` (`LeagueHome.jsx:87`, `:154-155`), the desktop likewise (`LeagueLobbyDesktop.jsx:282`, `:361`), and the slot receives it (`LeagueLobbyRedesign.jsx:521`, `LeagueLobbyDesktop.jsx:201`). Suspense does not cover it: `React.lazy` memoizes after its first resolution and `LeagueScreen` mounts only while `screen === 'league'` (`App.jsx:10197`), so every return to the League remounts the lobby with `activeGroup = null`, the chunk resolves at once and `fallback={null}` covers nothing; the dashboard's same-query listener (`CommandDashboard.jsx:240`) is unmounted by then and `firebase/config.js:69` sets no persistence, so the fresh `onSnapshot` needs a server round trip. On error, `tournamentGroupService.js:225-226` calls the same callback with `null`, and the callback also sets `seatFor(uid)`, so even the lobby's readiness flag cannot tell failure from "answered: none". The build knew the distinction: `leagueLockService.js:6-8` says a failed read is told apart from "no group", then the line was fed `subscribeMyGroup`. **Window:** for a seated player, from the lobby's first paint until the first snapshot (one round trip; seconds on a cold start), on every League entry; indefinitely after an error. **Severity view:** should-fix, not blocking (the writers refuse; the door lands in the hub, which shows CHECKING), not a note (a visible, recurring contradiction of lens 8 on the same lock, with the null→open behaviour pinned as correct). The fix in A2R-1 is the refuter's.

### 6.2 A2R-2 — refuter B: CONFIRMED

On `~/pd-ci-a2rx` through the mutant runner, the tree clean before and after each run. Ran the unchanged R1 spec against a wider set (R1x1: 14 files — the flag-off writers, the clone, the ledger, the hub jsdom, the flag pin, training, the lobby endpoints, the adapter, `change-archetype`, `equip-watchlist`, `change-archetype.compat`, `change-archetype.leanrider`, the B3 protected-store scan, `casualClone`): **290 of 290 rows pass, exit 0**. With the build's six files that is 20 files and 372 rows the mutant survives. Why the wider set is vacuous: line 34 runs only with the flag on, on a League write, when the fixture's `where()` answers an object with `.get()`; the pre-A2 writer suites run the real flag (false) and mention no `loadout`; the flag-on clone, training, lobby, ledger and adapter files never call a writer; the jsdom, pin and model files are client or static. The protected-store scan walks write methods only (`set`, `update`, `create`, `delete`, `add`), so a changed read is invisible to it by construction. Then proved a kill: R1x2 (the mutant plus the proposed e2e row) fails that one row, R1x3 (the row alone, unmutated) passes. Specs under the session scratchpad's `refuterB/`; outputs under `~/pd-a2r-runs/mutants/R1x1`, `R1x2`, `R1x3`. (`api/agent/unequip-watchlist.test.js` does not exist, hence 14 files, not 15.)

### 6.3 A2R-3 — refuter C: CONFIRMED, both parts

Read-only on the Windows worktree; no row run. **The fallback is reachable and unflagged** beyond `CASUAL_CLONE_CONCURRENCY_ENABLED = true` (`featureFlags.js:237`): any non-ok response, a body without a string `cloneId`, or a thrown fetch leaves the deploy target at the ranked id (`agentDeploy.js:161`, `:188-218`) and posts it (`:236`); `agentDeploy.js` never reads the per-game flag. The non-200 answers of `api/agent/ensure-casual-clone.js`: 429 (ten a minute, `:51`), 401 (`:59`), 409 `no_ranked_agent` (`:76`), 409 `epoch_closed` (`:82`, dark), 409 `provisioner_lease_expired` (`:102`), 500 on any throw (`:105`), the 60 s kill (`:48`), or a network error; and A2 widens the 500 surface, since the trait seed's writes now sit in the ensure path (`casualClone.js:259-262`, `:291-294`). The fallback is pinned as intended by `ceremonyDeployTarget.test.jsx:118` ("fallback: clone ensure fails → target stays the RANKED agent"). **`decide.js` refuses nothing:** no `isCasualClone`, `casual-agent`, `rankedAgentId` or `loadouts` in it; the tiered path reads `agent.archetype` (`:370`) and `agent.equippedWatchlistId` (`:382`) from whatever document the id names and writes its `activeBattleId` (`:991`); the slot is applied only in `casualClone.js:83`, `:120`. So the fallback game wears the League loadout: D1 broken on the degraded path. **The hub counts the game and ignores the lock:** the active poll is owner plus active minus the training prefix (`App.jsx:4045-4059`), a battle with no `groupId` is BaggerBomb (`commandCenterLiveBattles.js:64-66`, `:106-110`), so the BaggerBomb card reads RUNNING in the League archetype (honest); `deriveLoadoutCards` never reads `agent.activeBattleId`, the scope passes only the agent, the lock and the live games (`PerGameLoadoutScope.jsx:27-37`), the door and Equip follow `card.locked` alone (`LoadoutCards.jsx:108`, `:129-131`; `Armory.jsx:211`), the doors are regated on `ready` (`useHubRuntime.js:177-178`). One more inconsistency: `changeAdjustments` still uses `unlocked` (`:179`), so Adjustments is locked while League says Open. **Coverage:** no `activeBattleId` in the hub's A2 rows or the model's; the lock rows use the week lock only; the report never mentions the fallback. **Severity view:** should-fix, not blocking: both flags dark, degraded-only, the server refuses and nothing wrong is written; but pre-A2 the same path showed "Locked in battle" (`selectors/loadout.js:133-137`, `LoadoutPanel.jsx:147`, `:224`), so flag-on it is a §9 regression and D1 breaks silently. The fixes in A2R-3 are the refuter's, with one correction of mine adopted from it: the undated League line says "Set when you registered", which is wrong for a battle lock, so the battle lock needs its own words (A1's "Locked while a game is running").

## 7. Carry into the flip PR

1. **Q1:** `'loadouts'` in the create rule's `hasAny` list; a row in `masteryDenials.rules.mjs`'s denied-birth table; the Console deploy before the flip.
2. **Q3:** the reword in `LOADOUT_COPY` (`lines.locked`, `leagueLocked`, `contextLocked`, `lockedEquip*`), a date-only formatter or the accepted time, the eight pins, the report's example, the server's `message` if it follows.
3. **A2R-1:** the League line's checking state and its rows.
4. **A2R-2:** the fixture recording `tx.get`, the League refusal row asserting the transactional read, the §4 wording.
5. **A2R-3:** the League card reading `agent.activeBattleId` as a lock; the founder's answer on the fallback (refuse, or deploy as League and say so).
6. Delete `LoadoutChooserSheet.jsx` and the flag-off arms; move the pins; drop the `DARK_BY_DESIGN` entry; refresh the flag-off bundle rows that become flag-on rows (the report's §16).
7. The founder's phone check (A2 report §14), not received by this review.

## 8. Carry into A3 (and separate tasking)

- **R5:** the Film Room's card list still names the ranked archetype (`cardStore.js:335` `archetypeCodeId: agent.archetype`); each archetype's own save settles it.
- **Memory on the clone:** the resync still copies the parent's `memory`, `consolidatedInsight` and `evolutionCycle` whatever archetype the clone wears (Phase 0 §4.3); A3's saves.
- **A2R-4** (an abandoned ranked pre-battle group): a League lifecycle task, not A3.
- **A2R-9:** the `COMPILER_ENABLED` and mastery flip checklists.

## 9. The founder's phone check (A2 report §14)

Not received by this review: the brief said it would be pasted under it, and nothing followed the heading. Recorded in the report's §14 by this commit; the fix pass fills the result.

## 10. What ran, where

- Windows worktree `C:\Users\fashr\portfolio-duel\.claude\worktrees\armory-a2-review-dad934` on `claude/armory-a2` at `c5fc2c6e` for reading and the two doc edits; no code change.
- WSL: the three trees and the runs folder of §4.1, left for the fix pass to remove (`unlink` each `node_modules` link first, then `git -C ~/pd-ci worktree remove --force`, then `worktree prune`; `rm -rf ~/pd-a2r-runs`).
- Scripts in the session scratchpad (not committed): the setup, step, identity, mutant and scratch-e2e runners.
