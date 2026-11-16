# Fix — security pack: the league view, `set-opponent`, the old `battles` rule

**Date:** 15 Nov 2026 · **Branch:** `claude/security-pack-league-view` · **Basis:** `docs/audits/20261115_PHASE0_BAGGERBOMB_TRADER_GAME.md` (draft PR #1070, read from `origin/claude/phase0-baggerbomb-trader-game`), section F5 and "Bugs and hazards found outside the task", items 1–3.

## Preamble

**Founder ruling (15 Nov 2026, R-F), verbatim:**

> A security fix pack runs now, as its own small task: the league view (no full record at completion, no account ids), the unused `set-opponent` endpoint, and the update rule on the old `battles` collection.
> Spectating stays possible. The fix is what a non-owner can see, at any battle status.

- **Session opening (BUILD_RULES §2/§3).** `git fetch origin` ran first. Branch `claude/security-pack-league-view` cut from `origin/main` at `71bc6bde` ("Merge pull request #1073"); tree clean.
- **Model.** Opus 5.5, as the prompt names.
- **Fenced files.** None edited. None called in a new way. (`api/agent/decide.js:828` is only cited, for the caller history of fix 2.)
- **Production.** Read-only, 15 Nov 2026, about 11 PM ET. Three count-only reads of the old `battles` collection (field-masked `runQuery`; `users/{id}` existence by field-masked `batchGet`; Firebase Auth `accounts:lookup` for existence only) and one read of the deployed Firestore ruleset. Each script was checked for write calls before it ran. Output is counts and field names only. **No account id appears in this report, the scripts' output, the code, the tests or the fixtures** (the tests use synthetic ids such as `PLANTEDrivalUid00000000000BB`).
- **Rules.** Not published. The deployed ruleset was read and is byte-identical to `main`'s `firestore.rules` (1,521 lines, released 15 Nov 2026 19:48 UTC), so publishing after the merge changes exactly the `battles` block of fix 3.

## Verdict

| Fix | What changed | What a rival's screen shows now | Status |
|---|---|---|---|
| 1 — the league view | A non-owner gets the allowlist projection at **every** status; completion opens nothing more. `ownerId` left the allowlist. The reply's battles are keyed by **seat** (`'0'`–`'3'`), never by account id; the client joins seats back to players through the group document it already holds. | Positions, books, scores, the agent's name and archetype, the narration feed: unchanged. A rival's reasoning (strategy read, each swap's reason, the recent checks) no longer appears at completion; the film room stays locked and says the reasoning is private to its owner. | Built, tested, mutation-checked |
| 2 — `set-opponent` | Every request gets **410** before any read or write. No caller exists. | Nothing (no screen calls it). | Built, tested, mutation-checked |
| 3 — old `battles` update rule | `update` is limited to the record's participants (`creator.uid`, `creator.odUserId`, `opponent.uid`, `opponent.odUserId`). Read unchanged. | Nothing (no reachable screen writes there today). | Built; new emulator suite; rule mutants killed. **Not published** — the founder publishes after the merge. |

REVIEW_AND_CHECKS_PLACEHOLDER

---

## Fix 1 — the league view

### Before (at `71bc6bde`, re-verified this session)

- `api/_utils/tournamentBattleView.js:37` — the non-owner allowlist carried `'ownerId'`.
- `api/_utils/tournamentBattleView.js:100` — `if (battle.status === 'completed') {` … `:105` — `return { ...battle, agentContext };`: a non-owner got the whole record at completion, minus only `agentContext.equippedHypothesis` (chat, the instruction, the list, the hot bench, reasoning, proposals, guardrail levels and the loadout included).
- `api/tournament/battle-view.js:31` — `const user = await requireAuth(req, res);` is the only gate (unchanged: spectating stays possible).
- `api/tournament/battle-view.js:55` — `battles[ownerId] = projectTournamentBattle(...)`: the reply was keyed by account id, so every seat's account id reached every caller as a key.

### After

- `api/_utils/tournamentBattleView.js:50`–`:54` — `PUBLIC_TOP_LEVEL` without `ownerId`.
- `api/_utils/tournamentBattleView.js:108`–`:123` — `projectTournamentBattle`: the owner gets the record unchanged (`:110`); everyone else gets the allowlist projection, stamped `_whyConcealed: true` (`:121`), whatever the status.
- `api/_utils/tournamentBattleView.js:161`–`:170` — new `projectBattlesBySeat(battles, players, viewerUid)`: each seat's current battle, projected for the viewer, keyed by the owner's index in the group's `players`. A battle whose owner holds no seat is left out.
- `api/tournament/battle-view.js:53`–`:54` — reads the group document for the seat order; `:65` — `projectBattlesBySeat(raw, players, viewerUid)`. No membership check was added (R-F: spectating stays possible).
- `src/constants/leagueTournament.js:920` `seatIndexByOwner` and `:938` `battlesByOwnerFromSeats` — the one home for the seat rule. The server keys with the first; every client reader joins back with the second, so they cannot disagree on a seat.
- **Seat order is stable while battles exist.** Every writer of `tournamentGroups.players` during or after a battle rewrites it with `map()` or a deep copy (`api/_utils/tournamentBanking.js:213`, `api/_utils/tournamentClaims.js:170`, `api/tournament/flip.js:141`, `api/tournament/resolve-user-draft.js:164`, `api/_utils/trainingLifecycle.js:376`, `api/_utils/canonicalOpenSweep.js:71`). The only writers that insert or remove a seat run while a pod forms, before any battle exists (`api/_utils/liveDraftFormation.js:521`, `:600`).
- **No account id in the allowlisted subtrees.** Battle ids are auto-ids (`api/_utils/compositionGenerationFence.js:170`/`:172`); CPU agent ids are `cpu-agent-{n}` (`src/constants/leagueTournament.js:378`); no writer puts an owner, user or account id inside `portfolio`, `scoring`, `scoreState`, `timing` or `thresholdHistory` (searched `api/` for those paths with `uid|owner|user`; the one hit, `api/_utils/stockThresholdAdmission.js:306`, writes scores and a timestamp only). `opponent` is `null` on every tournament battle (`api/agent/decide.js:1559`).

### The reader table

Every client reader of `GET /api/tournament/battle-view`, and the one server reader of its projector, with the fields each reads from a **rival's** battle.

| # | Reader | Fields read from a rival's battle | Active | Completed — before | Completed — after (what the screen shows instead) |
|---|---|---|---|---|---|
| 1 | `useSpectatedTournamentBattles` → `useRealLeagueState.js:115` → `leagueAdapter.groupToPod`/`bracketGameToPod` → `buildSeat` (`leagueAdapter.js:234`) → the League pod cards and Spectate (`LeagueHome.jsx:173`, `LeagueLobbyDesktop.jsx:389`, `:431`) | `agentContext.archetype` (`:242`); `portfolio.*[].symbol`, else `agentContext.initialPortfolio` (`battleToAgentBook`, `:171`); `status`, `_whyConcealed`, `agentContext.innerMonologue.strategy`, `trades[].rationale`/`hypothesis`/`symbolOut`/`symbolIn` (`battleToReasoning`, `:205`) | archetype, book: shown. Reasoning: never (film room locked). | archetype, book; **the rival's strategy read and every swap's reason** in "Film room · unlocked" | archetype, book: unchanged. Reasoning: removed. The film room stays **locked** and reads "Every position and score is open to all — but {name}'s **reasoning stays private to its owner.**" (`LeagueSpectate.jsx:87`, `:106`). The viewer's own seat still opens at completion. |
| 2 | `useSpectatedTournamentBattles` → `useArenaModel.js:62` → `buildArenaModel.js:178` (the climb's rival armor) | `agentContext.archetype` | shown | shown | unchanged |
| 3 | `useSpectatedTournamentBattles` → `SpectatorView.jsx:45` → `Flat6BattleView` (mounted only by the dev screen `TournamentDevScreen.jsx:860`) | WHAT: `agentContext.agentName`/`archetype`/`tournament.doubleDownSymbols`, `isCpu`, `statusFeed[]` (public fields), `portfolio`, `scoring.thresholds`, `thresholdHistory`, `trades[].lockedPoints`, `scoreState.currentScore`, `status`, `activatedAt`/`createdAt`. WHY: `agentContext.innerMonologue.strategy`, `evaluations[].rationale`/`hypothesis` | WHAT shown; WHY: the old "opens to everyone at completion" note | WHAT; **the strategy read and the last three checks' reasons** under "The agent's read" | WHAT unchanged. Under "The agent's read": "The agent's reasoning is private to its owner." (`Flat6BattleView.jsx:114`, `:362`) |
| 4 | `useSpectatedTournamentBattles` → `YourBacking.jsx:267`, `:311` → `weekCardModel` → `agentSixFor` (`:93`) | `portfolio.*[].symbol`, else `agentContext.initialPortfolio` | shown | shown | unchanged (Backing is dark: `BACKING_BETA_ENABLED = false`, `src/config/featureFlags.js:2589`) |
| 5 | `backingService.fetchTapePod` (`backingService.js:193`–`:205`) → `groupToPod` → Spectate (backing's tape link) | as reader 1 | as reader 1 | as reader 1 | as reader 1 (Backing is dark) |
| 6 | `finishedRivalRead.js:18` → `LeagueAgentForm.jsx:38` (a finished game's rival armor) | `agentContext.archetype` | n/a (read after the bell) | shown | unchanged |
| 7 | server: `api/tournament/team-card.js:258`–`:274` → `agentLayerFrom` (`:354`–`:410`) | `agentContext.initialPortfolio`, `portfolio`, `agentContext.agentName`, `trades[].symbolOut`/`symbolIn`/`swappedOutAt`, `trades[].rationale`/`hypothesis` | (completed battles only) | the six, the swaps, **each swap's recorded reason** | the six and the swaps unchanged; each swap's reason is `null`, so the card shows "—" beside each swap under "The why · as recorded on the trade" (`TeamCard.jsx:237`, `BackingParts.jsx` TapeLine). Backing is dark. |

**The per-seat key.** Readers 1–6 joined the reply to the group's seats by the map key, which was the account id. None read `ownerId` from a projection. They now join by seat index (`battlesByOwnerFromSeats`), using the `players` of the group document each already holds: the hook takes them as a third argument at all five call sites (`useRealLeagueState.js:115`, `useArenaModel.js:65`, `SpectatorView.jsx:45`, `YourBacking.jsx:267`, `:311`); `fetchTapePod` uses the group it reads (`backingService.js:201`); `finishedRivalRead` gets them through the form scope (`leagueAgentFormSlot.jsx:33`, `LeagueBattleArenaLive.jsx:94`, `:114`, `LeagueAgentForm.jsx:38`).

**STOP conditions checked.** No reader needs the account id itself (each needs a per-seat key, which the seat index gives). No screen's purpose is to show a rival's chat or instructions: no reader reads `chatExchanges` or `directive` (searched every reader above). The film room shows reasoning; the ruling closes reasoning, and the screen now says so.

### Copy the change would otherwise have made false

- `src/components/League/LeagueSpectate.jsx` — before, a rival's completed seat read "Film room · unlocked" with its words, and a live rival's note promised "sealed until the group completes … Come back for the film room". After, `leagueAdapter.js:261` marks every seat but the viewer's `reasoningPrivate` (the same predicate the server projects on: owner = viewer), and such a seat's film room stays locked with the private note (`:52`, `:87`, `:106`). The viewer's own seat keeps both old behaviours (sealed while live, its words at completion). The dev fixture world is untouched.
- `src/components/Tournament/Flat6BattleView.jsx:356` (before) promised the reasoning "opens to everyone at completion — the Film Room"; now `WHY_PRIVATE_NOTE` (`:114`).

---

## Fix 2 — `/api/agent/set-opponent`

**Before** (`71bc6bde`): `api/agent/set-opponent.js:60` accepted a battle under five minutes old; `:65` only skipped a battle that already had an opponent — every new league battle is created with `opponent: null` (`api/agent/decide.js:1559`); `:101` and `:102` wrote client-supplied `startingPrices` and thresholds built from client-supplied `baseATR`.

**Caller proof** (searched at `71bc6bde`):

| Where | Search | Result |
|---|---|---|
| Whole repo except `docs/` | `git grep -n "set-opponent"` | only the handler itself (`api/agent/set-opponent.js:8`, `:108`) and a comment, `api/agent/decide.js:828` ("eliminates fragile client set-opponent call") |
| Docs | same | 13 files under `docs/` plus `CALIBRATION_DATA_DISCOVERY_REPORT.md` — citations, not callers |
| `src/`, `api/`, `scripts/`, `test/`, `vercel.json` | `setOpponent`, `set_opponent` | only an unrelated React state setter (`setOpponentChallenges`) |
| String-built URLs | `api/agent/${`, `api/agent/' +` | none |
| `vercel.json` | `agent` | four cron paths, none to this route; no rewrite to it |
| History | `git log -S "set-opponent" -- src` | the last client call left in `f9e7af093` (8 Apr 2026, "generate CPU opponent server-side"), seven months ago, so no live bundle still carries it |

**After:** `api/agent/set-opponent.js:21`–`:22` — the handler returns `410 { error: 'gone' }` as its only statement: no security middleware, no token check, no Firestore import. The file stays, with a header naming this fix.

---

## Fix 3 — the old `battles` collection's update rule

**Before** (`71bc6bde`): `firestore.rules:606` `allow read: if request.auth != null;` and `:608` `allow update: if request.auth != null;` — any signed-in user could update any record.

**The participant fields.** The writers put each player in a side map: `creator.{uid, odUserId}` and `opponent.{uid, odUserId}` (`src/firebase/firebaseService.js` create/join paths; the client's own battle queries match a user on exactly these four fields, `firebaseService.js:454`–`:486`). Production, read count-only on 15 Nov 2026:

| Count (of 76 records: 66 active, 10 waiting) | Value |
|---|---|
| `creator.uid` present | 76 |
| `creator.uid` in account-id shape (28 alphanumerics) | 14 |
| `opponent.uid` in account-id shape | 12 |
| Account-shaped `uid` equal to the same side's `odUserId` | 14 of 14 creator, 12 of 12 opponent |
| Account-shaped value in `odUserId` but not in `uid` | 0 |
| Account-shaped value anywhere else in a record (all fields, four levels) | 0 |
| Distinct account-shaped participants | 5 — all have a `users/{id}` document |
| Records with no account-shaped participant at all | 62 — their participant values are short handles; none is a Firebase Auth account (0 of 50 distinct values) and none has a `users/{id}` document |

So the participant fields are reliable: wherever an account plays, `uid` (and `odUserId`) hold its id; no record names an account anywhere else. The 62 handle-only records name no account, so after this rule no client can update them (the Admin SDK jobs still can).

**After:** `firestore.rules:617`–`:628` — `allow update: if request.auth != null && request.auth.uid in [creator.uid, creator.odUserId, opponent.uid, opponent.odUserId]`, each read with `.get(…, default)` so a missing side denies rather than errors. **Read (`:618`) and create (`:619`) are not changed in this task.** Delete stays denied.

**Consequences.**
- Joining a **waiting** record is an update by a non-participant, so joins are closed too. No join door is reachable at today's flag values: the lobby and join screens are reached only from the legacy dashboards, which lose to `COMMAND_DASHBOARD_ENABLED = true` / `COMMAND_DASHBOARD_DESKTOP_ENABLED = true` (`src/config/featureFlags.js:23`, `:35`; `src/App.jsx:8984`, `:9043`); `BattleActionCards` and `GameModeCarousels` are imported nowhere; `setShowBuilderModal(true)` has no caller; no URL parameter opens them.
- **The Admin SDK jobs are unaffected:** `api/lobbies/cleanup-expired.js:16`–`:17`, `api/cron/compute-daily-baggerbomb-levels.js:12`–`:13` and `api/cron/baggerbomb-v4-daily-scores.js:21`–`:22` import `firebase-admin`, which bypasses rules. (The prompt named two jobs; three touch the collection.)

---

## Tests

| File | Rows | What it pins |
|---|---|---|
| `api/_utils/tournamentBattleView.test.js` | 29 at head (18 → 28 `it` declarations) | A non-owner's projection of a **completed** battle equals the hand-written allowlist shape (fails at `71bc6bde`); the same shape at every status; no `ownerId`; a recursive scan of every non-owner projection (active and completed) finds none of `ownerId`, `chatExchanges`, `directive`, `equippedWatchlist`, `hotBench`, `pendingProposal`, `deployedGuardrails`, `activeRules`, each planted at its real path, and no planted account id or private text anywhere; the owner's projection is the same object with every key; `projectBattlesBySeat` keys, owner seat, seatless battle, current-battle pick. |
| `api/tournament/battle-view.test.js` | 7 → 9 | Seat keys; the owner's seat full; a completed rival seat WHAT-only; no rival account id anywhere in the reply (key or value) and no private key in any rival seat, active and completed; a seatless spectator sees every seat WHAT-only; missing group → no battles. |
| `api/agent/set-opponent.test.js` (new) | 8 | Seven method/body shapes → 410, and no middleware, token check, Firestore `get` or `update` call; an unauthenticated caller → the same 410. |
| `test/rules/battlesParticipantUpdate.rules.mjs` (new, emulator) | 11 | Creator and opponent can update (positive controls); an `odUserId`-only participant can; a signed-in stranger cannot; an anonymous caller cannot; a stranger cannot join a waiting record; a missing side denies, never errors into an allow; a record naming nobody is closed; read, create and delete unchanged. |
| `src/constants/leagueTournament.test.js` | +5 | The seat rule and the round trip. |
| `src/hooks/useSpectatedTournamentBattles.seatJoin.jsdom.test.jsx` (new) | 11 | The real hook and the real `fetchTapePod` join seats back to players; no players or an owner-keyed reply places nothing; a call-site census pins the players argument at all five calls. |
| `src/components/League/LeagueSpectate.honesty.test.jsx` | 17 → 21 `it` declarations | The real-words and empty-state rows read the viewer's own seat; new R-F rows: a rival's film room is private at every status, even if a reply carried its words. The ID-collision trap stays armed through a viewer whose own id is the fixture key. |
| `src/components/Tournament/Flat6BattleView.recordRendering.jsdom.test.jsx` | +2 | A spectator opening a rival's completed battle reads the private note and never the words; the owner still reads theirs. |
| `api/tournament/team-card.test.js` | 1 updated | A swap's reason is `null` on the card. |
| `finishedRivalRead.test.js`, `LeagueAgentForm.jsdom.test.jsx`, `leagueAgentForm.sites.jsdom.test.jsx` | updated | Seat-keyed replies; the scope carries the players. |
| `equippedHypothesisRefs.census.test.js`, `carriage.test.js` | descriptions only | Both files still name `equippedHypothesis` (in comments); the description now says the allowlist never carries it. |

### Mutation checks

Each mutant was applied to the committed file, the related tests run with a JSON reporter, the rows that newly failed compared with a clean baseline, and the file restored from `HEAD`. **All 27 code mutants and 3 rule mutants were killed; none broke its anchor.**

| Id | Mutant | Newly failing rows |
|---|---|---|
| MA | restore the completion unlock (`if (status === 'completed') return battle`) | 13 |
| MB | put `ownerId` back on the allowlist | 11 |
| MC | key the seat map by owner | 11 |
| MD | project the viewer's own seat as a non-owner | 3 |
| MD2 | keep a seatless battle | 2 |
| ME | client joins by owner id | 11 |
| MF | seat index off by one | 20 |
| MF2 | a repeated owner takes its last seat | 1 |
| MG | hook skips the join | 4 |
| MG2 | hook memo ignores a new seat order | 1 |
| MH | tape pod skips the join | 2 |
| MI | after-bell read skips the join | 3 |
| MJ | the form does not pass the players | 1 |
| MK | the arena scope does not pass the players | 2 |
| MK2 | the scope drops the players | 3 |
| ML / MM / MM2 / MM3 | a hook caller drops the players (arena / backing / league state / spectator view) | 1 each |
| MN | no seat is private | 6 |
| MO | a private seat's film room unlocks at completion | 4 |
| MP | a private seat gets the old "sealed until the group completes" note | 5 |
| MQ | Flat6's note back to "opens to everyone at completion" | 1 |
| MS | the route seats by battle owner instead of the group's players | 2 |
| MS2 | the route never recognizes the viewer | 2 |
| MR / MR2 | set-opponent reaches Firestore / the token check before refusing | 5 / 6 |
| R-M1 | rule back to `request.auth != null` | 4 (stranger, join, missing side, nobody) |
| R-M2 | rule without the sign-in guard | 1 (anonymous) |
| R-M3 | rule without the two `odUserId` fields | 1 (`odUserId`-only participant) |

---

## Found and not fixed (for separate tasking)

FOUND_NOT_FIXED_PLACEHOLDER

## Founder questions

FOUNDER_QUESTIONS_PLACEHOLDER
