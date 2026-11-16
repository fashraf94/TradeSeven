# Fix — security pack: the league view, `set-opponent`, the old `battles` rule

**Date:** 15–16 Nov 2026 · **Branch:** `claude/security-pack-league-view` · **Basis:** `docs/audits/20261115_PHASE0_BAGGERBOMB_TRADER_GAME.md` (draft PR #1070, read from `origin/claude/phase0-baggerbomb-trader-game`), section F5 and "Bugs and hazards found outside the task", items 1–3.

## Preamble

**Founder ruling (15 Nov 2026, R-F), verbatim:**

> A security fix pack runs now, as its own small task: the league view (no full record at completion, no account ids), the unused `set-opponent` endpoint, and the update rule on the old `battles` collection.
> Spectating stays possible. The fix is what a non-owner can see, at any battle status.

- **Session opening (BUILD_RULES §2/§3).** `git fetch origin` ran first. Branch `claude/security-pack-league-view` cut from `origin/main` at `71bc6bde` ("Merge pull request #1073"); tree clean. Re-fetched before the final checks: `main` had not moved, so no merge was needed — the final checks ran on the branch head, which is `main` plus this work.
- **Model.** Opus 5.5, as the prompt names.
- **Fenced files (BUILD_RULES §1).** None edited, none called in a new way. `api/agent/decide.js:828` and `:1559` are only cited.
- **Production.** Read-only, 15 Nov 2026 about 11 PM ET. Three count-only reads of the old `battles` collection (field-masked `runQuery`; `users/{id}` existence by field-masked `batchGet`; Firebase Auth `accounts:lookup` for existence only) and one read of the deployed Firestore ruleset. Each script was checked for write calls before it ran. Output is counts and field names only. **No account id appears in this report, the scripts' output, the code, the tests or the fixtures** (tests use synthetic ids such as `PLANTEDrivalUid00000000000BB`).
- **Rules.** Not published. The deployed ruleset was read and is byte-identical to `main`'s `firestore.rules` (1,521 lines, released 15 Nov 2026 19:48 UTC), so publishing after the merge changes exactly the `battles` block of fix 3.
- **Review.** The branch passed 10 files, so the BUILD_RULES §2 review ran: five lenses, two refuters, the coordinator's emulator and mutation repros, and a vite build. The record is in §Review below.

## Verdict

| Fix | What changed | What a rival's screen shows now | Status |
|---|---|---|---|
| 1 — the league view | A non-owner gets the allowlist projection at **every** status; completion opens nothing more. `ownerId` and `agentId` left the allowlist, and a non-owner receives **no narration feed** (its free text carried guardrail levels, review lessons and the model's own words). The reply's battles are keyed by **seat** (`'0'`–`'3'`), never by account id; the client joins seats back through the group document it already holds. | Positions, books, scores, the agent's name and archetype: unchanged. A rival's reasoning no longer appears at completion; the film room stays locked and reads "{name}'s **reasoning is not shared with other players.**" | Built, reviewed, tested, mutation-checked |
| 2 — `set-opponent` | Every request gets **410** before any read or write. No caller exists. | Nothing (no screen calls it). | Built, reviewed, tested, mutation-checked |
| 3 — old `battles` update rule | `update` is limited to the record's participants (`creator.uid`, `creator.odUserId`, `opponent.uid`, `opponent.odUserId`), null-safe. Read unchanged. | Nothing (no reachable screen writes there today). | Built, reviewed; new emulator suite; 10 rule mutants killed. **Not published** — the founder publishes after the merge. |

## Final checks

Run on Linux (WSL, a private worktree of `~/pd-ci`, Node 20.20.2, `TZ=UTC`) on the code head `ca6fb3c2`, which is `main` (`71bc6bde`, re-fetched 16 Nov — unmoved) plus this branch. The report commit that follows adds only this file; the build was run again on that exact pushed head.

| Check | Result |
|---|---|
| Full suite, `vitest run --maxWorkers=8` | **exit 0** — 34,022 rows, 0 failed, 135 skipped |
| Rules suites, `npm run test:rules` (emulator) | **exit 0** — 43 files, 799 rows, incl. the new 15. The first attempt found the emulator ports held by another session's run; the rerun alone was green. |
| `npm run lint:gate` | **exit 0** |
| `npm run build` (vite) | **exit 0** — built in 16.9 s; the pushed head: see the PR |

On Windows, 7 rows fail for platform reasons only (path separators in census rows, a `\n` regex against a CRLF file, `ERR_UNSUPPORTED_ESM_URL_SCHEME` spawns); all pass on Linux.

---

## Fix 1 — the league view

### Before (at `71bc6bde`, re-verified this session)

- `api/_utils/tournamentBattleView.js:37` — the non-owner allowlist carried `'ownerId'` (and `'agentId'`).
- `api/_utils/tournamentBattleView.js:100` — `if (battle.status === 'completed') {` … `:105` — `return { ...battle, agentContext };`: a non-owner got the whole record at completion, minus only `agentContext.equippedHypothesis` — chat, the instruction, the list, the hot bench, reasoning, proposals, guardrail levels and the loadout included.
- `api/_utils/tournamentBattleView.js:64` — `PUBLIC_STATUSFEED` let each feed entry's free-text `message` through, at every status.
- `api/tournament/battle-view.js:31` — `const user = await requireAuth(req, res);` is the only gate (unchanged: spectating stays possible).
- `api/tournament/battle-view.js:55` — `battles[ownerId] = projectTournamentBattle(...)`: the reply was keyed by account id.

### After (at the code head `ca6fb3c2`)

- `api/_utils/tournamentBattleView.js:52`–`:56` — `PUBLIC_TOP_LEVEL` without `ownerId` and without `agentId`. A training pod's human seat deploys its training clone, whose doc id is `training-agent-{groupId}-{account id}` (`src/constants/leagueTournament.js:394`–`:397`), so `agentId` carried an account id for training pods. No reader reads either from a rival's battle.
- `api/_utils/tournamentBattleView.js:62`–`:73`, `:111` — **no `statusFeed` for a non-owner.** The feed's free-text `message` carries what the ruling keeps on the server: guardrail levels (`"Guardrail override: stop-loss at 8% breached …"`, `api/_utils/agentGuardrails.js:557`), the Film Room self-review's grade and lesson (`api/cron/agent-batch-review.js:361`–`:366`, which can carry the owner's own veto notes), the model's status line (`api/cron/agent-evaluate.js:4403`), hot-bench names (`:2898`) and the gameplan (`:2805`); `action` names the mechanism. A key allowlist cannot strip what a value says, so the whole feed stays with its owner. **No production screen read a rival's feed**: the arena's voice reads the viewer's own battle (`buildArenaModel.js:439`); only the dev screen did.
- `api/_utils/tournamentBattleView.js:104`–`:117` — `projectTournamentBattle`: the owner gets the record unchanged (`:106`); everyone else the allowlist projection, stamped `_whyConcealed: true` (`:115`), whatever the status.
- `api/_utils/tournamentBattleView.js:155`–`:164` — new `projectBattlesBySeat(battles, players, viewerUid)`: each seat's current battle, projected for the viewer, keyed by the owner's index in the group's `players`. A battle whose owner holds no seat is left out.
- `api/tournament/battle-view.js:53`–`:54` — reads the group document for the seat order; `:65` — `projectBattlesBySeat(raw, players, viewerUid)`. No membership check was added (R-F).
- `src/constants/leagueTournament.js:920` `seatIndexByOwner`, `:938` `battlesByOwnerFromSeats` — the one home for the seat rule; the server keys with the first, every client reader joins back with the second.
- `src/hooks/useSpectatedTournamentBattles.js:42`, `:63`, `:88` — a reply is joined **only to the group it was fetched for**; on a group change the hook answers `{}` until that group's reply lands (review W1).
- **Seat order is stable while battles exist.** Every writer of `tournamentGroups.players` during or after a battle rewrites it with `map()` or a deep copy (`api/_utils/tournamentBanking.js:213`, `api/_utils/tournamentClaims.js:170`, `api/tournament/flip.js:141`, `api/tournament/resolve-user-draft.js:164`, `api/_utils/trainingLifecycle.js:376`, `api/_utils/canonicalOpenSweep.js:71`). Writers that insert or remove a seat run only while a pod forms (`api/_utils/liveDraftFormation.js:521`, `:600`; `api/_utils/liveDraftLifecycle.js:184`, behind the FORMING guard at `:167`). Confirmed independently by three reviewers.
- **The allowlisted subtrees.** Battle ids are auto-ids (`api/_utils/compositionGenerationFence.js:170`/`:172`); CPU agent ids are `cpu-agent-{n}`; `opponent` is `null` on every tournament battle (`api/agent/decide.js:1559`); no writer puts an account id or a ruled-private item inside `portfolio`, `scoring`, `scoreState`, `timing`, `thresholdHistory` or the trade fields kept (the exposure lens read every writer). One free-text value still passes: `agentContext.tournament.userPicksStance` (the double-down stance, public under V2.1 §9; founder question 4).

### The reader table

Every client reader of `GET /api/tournament/battle-view`, and the one server reader of its projector, with the fields each reads from a **rival's** battle.

| # | Reader | Fields read from a rival's battle | Active | Completed — before | Completed — after (what the screen shows instead) |
|---|---|---|---|---|---|
| 1 | `useSpectatedTournamentBattles` → `useRealLeagueState.js:115` → `leagueAdapter.groupToPod`/`bracketGameToPod` → `buildSeat` (`leagueAdapter.js:234`) → League pod cards and Spectate (`LeagueHome.jsx:173`, `LeagueLobbyDesktop.jsx:389`, `:431`) | `agentContext.archetype` (`:242`); `portfolio.*[].symbol`, else `agentContext.initialPortfolio` (`battleToAgentBook`, `:171`); `status`, `_whyConcealed`, `agentContext.innerMonologue.strategy`, `trades[].rationale`/`hypothesis`/`symbolOut`/`symbolIn` (`battleToReasoning`, `:205`) | archetype, book: shown. Reasoning: never. | archetype, book; **the rival's strategy read and every swap's reason** in "Film room · unlocked" | archetype, book: unchanged. The film room stays **locked**: "{name}'s **reasoning is not shared with other players.**" (`LeagueSpectate.jsx:53`, `:88`, `:107`; `leagueAdapter.js:261` marks every seat but the viewer's). The viewer's own seat still opens at completion. |
| 2 | `useSpectatedTournamentBattles` → `useArenaModel.js:62`–`:66` → `buildArenaModel.js:178` (rival armor on the climb) | `agentContext.archetype` | shown | shown | unchanged |
| 3 | `useSpectatedTournamentBattles` → `SpectatorView.jsx:45` → `Flat6BattleView` (only on the dev screen, `?tournamentDev=1`) | WHAT: `agentContext.agentName`/`archetype`/`tournament.doubleDownSymbols`, `isCpu`, `portfolio`, `scoring.thresholds`, `thresholdHistory`, `trades[].lockedPoints`, `scoreState.currentScore`, `status`, `activatedAt`/`createdAt`; feed: `statusFeed[]`. WHY: `agentContext.innerMonologue.strategy`, `evaluations[]` | WHAT and the feed shown; WHY: a note promising it "opens to everyone at completion" | WHAT, the feed, and **the strategy read and the last three checks' reasons** | WHAT unchanged. "The agent's read": "This agent's reasoning is not shared with other players." Live feed: "This agent's live feed is not shared with other players." (`Flat6BattleView.jsx:115`, `:116`, `:347`, `:366`) |
| 4 | `useSpectatedTournamentBattles` → `YourBacking.jsx:267`, `:311` → `agentSixFor` (`:93`) | `portfolio.*[].symbol`, else `agentContext.initialPortfolio` | shown | shown | unchanged (Backing is dark: `BACKING_BETA_ENABLED = false`, `src/config/featureFlags.js:2589`) |
| 5 | `backingService.fetchTapePod` (`:193`–`:205`) → `groupToPod` → Spectate | as reader 1 | as reader 1 | as reader 1 | as reader 1 (Backing is dark) |
| 6 | `finishedRivalRead.js:24`, `:32` → `LeagueAgentForm.jsx:38` (a finished game's rival armor) | `agentContext.archetype` | n/a | shown | unchanged |
| 7 | server: `api/tournament/team-card.js` `completedBattlesFor` → `agentLayerFrom` | `agentContext.initialPortfolio`, `portfolio`, `agentContext.agentName`, `trades[].symbolOut`/`symbolIn`/`swappedOutAt`, `trades[].rationale`/`hypothesis` | (completed only) | the six, the swaps, **each swap's recorded reason** | the six and swaps unchanged; each reason is `null`, shown as "—" under "The why · as recorded on the trade" (`TeamCard.jsx:237`). Backing is dark; founder question 3. |

**The per-seat key.** Readers 1–6 joined the reply to the group's seats by the map key, which was the account id; none read `ownerId` from a projection. They now join by seat index through `battlesByOwnerFromSeats`, with the `players` of the group document each already holds: the hook's third argument at all five calls (`useRealLeagueState.js:115`, `useArenaModel.js:65`, `SpectatorView.jsx:45`, `YourBacking.jsx:267`, `:311`, pinned by a call-site census); `fetchTapePod` (`backingService.js:201`); `finishedRivalRead` through the form scope (`leagueAgentFormSlot.jsx:33`, `LeagueBattleArenaLive.jsx:94`, `:114`, `LeagueAgentForm.jsx:38`).

**STOP conditions checked.** No reader needs the account id itself (each needs a per-seat key, which the seat index gives). No screen's purpose is to show a rival's chat or instructions: no reader reads `chatExchanges` or `directive`.

### Copy the change would otherwise have made false

- `LeagueSpectate.jsx` — a rival's completed seat read "Film room · unlocked" with its words, and a live rival's note promised the room would open. Now every seat but the viewer's is `reasoningPrivate` (`leagueAdapter.js:261`, the same predicate the server projects on) and its film room stays locked with the note above — true for a CPU seat too, and it claims nothing about what else the screen shows. The learn-from-loss line "See how they traded in the film room." is gone (`:261` now reads "3 players beat your agent this week."; the hard-coded "3" is older — not fixed).
- `ArenaOverlays.jsx:173` — the rival snapshot promised "their agent's reasoning stay sealed until the battle completes — then the Film Room opens." Now: "… stay sealed until the battle completes. Their agent's reasoning is not shared with other players."
- `Flat6BattleView.jsx` — "It opens to everyone at completion — the Film Room" and, for an empty rival feed, "No moves yet today." are replaced by the two notes above.
- A source guard pins the three old promises absent from every production file (`LeagueSpectate.honesty.test.jsx`, "R-F — no production source promises …").

---

## Fix 2 — `/api/agent/set-opponent`

**Before** (`71bc6bde`): `api/agent/set-opponent.js:60` accepted a battle under five minutes old; `:65` skipped only a battle that already had an opponent — every new league battle is created with `opponent: null` (`api/agent/decide.js:1559`); `:101` and `:102` wrote client-supplied `startingPrices` and thresholds built from client-supplied `baseATR`.

**Caller proof** (searched at `71bc6bde`, re-checked by the rules lens at the head):

| Where | Search | Result |
|---|---|---|
| Whole repo except `docs/` | `git grep -n "set-opponent"` | only the handler itself and a comment, `api/agent/decide.js:828` ("eliminates fragile client set-opponent call") |
| Docs | same | 13 files under `docs/` plus `CALIBRATION_DATA_DISCOVERY_REPORT.md` — citations, not callers |
| `src/`, `api/`, `scripts/`, `test/`, `vercel.json` | `setOpponent`, `set_opponent` | only an unrelated React state setter (`setOpponentChallenges`) |
| String-built URLs | `api/agent/${`, `api/agent/' +` | none |
| `vercel.json` | routes, rewrites, middleware | four cron paths, none to this route; no rewrites, no middleware file |
| History | `git log -S "set-opponent" -- src` | the last client call left in `f9e7af093` (8 Apr 2026, "generate CPU opponent server-side"), seven months ago — no live bundle still carries it |

**After:** `api/agent/set-opponent.js:21`–`:22` — the handler's only statement returns `410 { error: 'gone' }`: no security middleware, no token check, no Firestore import, for every method including `OPTIONS`. The file stays, with a header naming this fix.

---

## Fix 3 — the old `battles` collection's update rule

**Before** (`71bc6bde`): `firestore.rules:606` `allow read: if request.auth != null;` and `:608` `allow update: if request.auth != null;` — any signed-in user could update any record.

**The participant fields.** The writers put each player in a side map: `creator.{uid, odUserId}` and `opponent.{uid, odUserId}` — classic `_v: 1` records carry `uid` only (`src/firebase/firebaseService.js` `createBattle`/`joinBattle`); the client's own battle queries match a user on exactly these four fields (`firebaseService.js:454`–`:486`); `user.uid` and `user.odUserId` are both the Firebase uid in the app (`UserContext.jsx:29`–`:30`). Production, read count-only on 15 Nov 2026:

| Count (of 76 records: 66 active, 10 waiting) | Value |
|---|---|
| `creator.uid` present | 76 |
| `creator.uid` in account-id shape (28 alphanumerics) | 14 |
| `opponent.uid` in account-id shape | 12 |
| Account-shaped `uid` equal to the same side's `odUserId` | 14 of 14 creator, 12 of 12 opponent |
| Account-shaped value in `odUserId` but not in `uid` | 0 |
| Account-shaped value anywhere else in a record (all fields, four levels) | 0 |
| Distinct account-shaped participants | 5 — all have a `users/{id}` document |
| Records with no account-shaped participant at all | 62 — short handles; none is a Firebase Auth account (0 of 50 distinct values), none has a `users/{id}` document |

So the participant fields are reliable: wherever an account plays, `uid` (and `odUserId`) hold its id; no record names an account anywhere else. The 62 handle-only records name no account, so no client can update them after this rule (the Admin SDK jobs still can).

**After:** `firestore.rules:618`–`:630`:

```
match /battles/{battleId} {
  function battleSideIds(side) {
    return side is map ? [side.get('uid', null), side.get('odUserId', null)] : [];
  }
  allow read: if request.auth != null;                       // unchanged
  allow create: if request.auth != null;                     // unchanged
  allow update: if request.auth != null
                && request.auth.uid in battleSideIds(resource.data.get('creator', null))
                                         .concat(battleSideIds(resource.data.get('opponent', null)));
  allow delete: if false;
}
```

A side that is absent, `null` or not a map names nobody and never errors the rule, so it cannot lock out the other side's participant (review R2, reproduced on the emulator). **The read rule (`:624`) is not changed in this task.**

**Consequences.**
- Joining a **waiting** record is an update by a non-participant, so joins are closed. No join door is reachable at today's flag values: the lobby and join screens are reached only from the legacy dashboards, which lose to `COMMAND_DASHBOARD_ENABLED = true` / `COMMAND_DASHBOARD_DESKTOP_ENABLED = true` (`src/config/featureFlags.js:23`, `:35`; `src/App.jsx:8984`, `:9043`); `BattleActionCards`, `GameModeCarousels` and `PvpWatchlistSection` (exported as `PvpLobbiesSection`) are imported nowhere; `setShowBuilderModal(true)` has no caller; no URL parameter opens them. The flags' documented "instant rollback" would now bring back a lobby where nobody can join (founder question 5).
- **The Admin SDK jobs are unaffected:** `api/lobbies/cleanup-expired.js:16`–`:17`, `api/cron/compute-daily-baggerbomb-levels.js:12`–`:13` and `api/cron/baggerbomb-v4-daily-scores.js:21`–`:22` import `firebase-admin`, which bypasses rules. (The prompt named two jobs; three touch the collection. No `api/` file uses the client SDK on it.)
- **Live client writers are all participants** (the rules lens traced each): the V3/V4 battle hooks and the completion processor write only the user's own subscribed battles. One non-participant write is now denied as intended: after an account switch on a shared device, the completion processor used to write the previous account's cached battle.

---

## Tests

| File | `it` rows (base → head) | What it pins |
|---|---|---|
| `api/_utils/tournamentBattleView.test.js` | 18 → 31 | A non-owner's projection of a **completed** battle equals the hand-written allowlist shape (fails at `71bc6bde`), the same at every status; no `ownerId`, no `agentId`, no feed; an unknown "canary" key at each level never passes (pins the allowlist itself); a recursive scan of every non-owner projection finds none of `ownerId`, `chatExchanges`, `directive`, `equippedWatchlist`, `hotBench`, `pendingProposal`, `deployedGuardrails`, `activeRules`, `resolvedAgentManifest`, `equippedBundleIds`, `standingLeans`, `dials`, `gameplanMeeting`, `agentId` — each planted at its real path in a fixture shaped like `createAgentBattle`'s record — and no planted account id, guardrail level, review lesson or model line anywhere; the owner's projection is the same object with every key; `projectBattlesBySeat`. |
| `api/tournament/battle-view.test.js` | 7 → 9 | Seat keys; the owner's seat full; a completed rival seat WHAT-only with no feed; no rival account id anywhere in the reply (key or value, a training-clone `agentId` planted); a seatless spectator sees every seat WHAT-only; a missing group seats nobody. |
| `api/agent/set-opponent.test.js` (new) | 8 | Seven method/body shapes → 410 with no middleware, token check, Firestore or `firebase-admin` call; an unauthenticated caller → the same 410. |
| `test/rules/battlesParticipantUpdate.rules.mjs` (new, emulator) | 15 | Creator and opponent (positive controls); each of the four fields isolated (classic `uid`-only record, `odUserId`-only creator and opponent, `uid`-only opponent beside a username); stranger and anonymous denied; a stranger cannot join; a missing, `null` or string side never errors; a record naming nobody is closed; read, create, delete unchanged. |
| `src/constants/leagueTournament.test.js` | +5 | The seat rule and the round trip. |
| `src/hooks/useSpectatedTournamentBattles.seatJoin.jsdom.test.jsx` (new) | 13 | The real hook and the real `fetchTapePod` join seats to players; an owner-keyed reply or missing players places nothing; a group change never joins the old reply (fetch pending, failed, hook disabled), and the new group's reply lands on its own players; a call-site census pins the players argument at all five calls. |
| `src/components/League/LeagueSpectate.honesty.test.jsx` | 17 → 22 | The real-words and empty-state rows read the viewer's own seat; a rival's film room is private at every status, even if a reply carried words; the ID-collision trap stays armed through a viewer whose own id is the fixture key; the three old promises appear in no production source. |
| `src/components/Tournament/Flat6BattleView.recordRendering.jsdom.test.jsx` | 9 → 11 | A spectator opening a rival's completed battle reads the private notes and no words or feed lines; the owner still reads theirs. |
| `src/data/decisionRecord.test.js`, `api/tournament/team-card.test.js` | rows updated | The owner keeps the feed's unconfirmed-outcome marker, a spectator gets no feed; a swap's reason is `null` on the team card. |
| `finishedRivalRead.test.js`, `LeagueAgentForm.jsdom.test.jsx`, `leagueAgentForm.sites.jsdom.test.jsx` | updated | Seat-keyed replies; the scope carries the players. |
| `equippedHypothesisRefs.census.test.js`, `carriage.test.js` | descriptions | Both files still name `equippedHypothesis` (comments); the description now says the allowlist never carries it. |

### Mutation checks

Each mutant was applied to the committed file, the related tests run with a JSON reporter, rows that newly failed compared with a clean baseline (3 Windows-only rows excluded), and the file restored from `HEAD`. Rule mutants ran on the emulator in WSL.

- **Battery 1** (head `5e96cf40`): 27 of 27 code mutants killed; 3 of 3 rule mutants killed.
- **Battery 2** (head `8f6ff1d1`, after the review fixes): 35 of 35 killed — the 23 still applicable from battery 1 plus 12 new: `ownerId` back (12 rows), `agentId` back (12), the old feed restored (12), a message-stripped feed with `action` (10), the hook's group binding removed (3), the binding's group never recorded (5), the join skipped inside the binding (7), Flat6's feed note bypassed (1), and the three copy promises and the old note restored (1–2 each).
- **Rule mutants, null-safe rule** (WSL emulator): 7 of 7 killed — `uid` dropped (2 rows), `odUserId` dropped (2), creator side dropped (6), opponent side dropped (4), `is map` dropped (2), rule back to `request.auth != null` (6), guard inverted (1). The repo rule: 15 of 15.
- **Test-integrity lens survivors** (A1–A5, A10, A14 — a denylist swapped in, the manifest/loadout/gameplan keys allowlisted, a trade's `trigger`/`source`/`triggeredBy` allowlisted, an ownerless doc treated as the owner's, the hot bench folded into the bench): all **7 killed** after the fixture work (battery 3).

---

## Review (BUILD_RULES §2)

**Shape.** Five lenses, each on its own LF `git archive` snapshot, read-only on git and the shared tree: exposure, client wiring, rules + 410, display honesty, test integrity (the mutating lens, last, on its own tree). Two refuter agents took the exposure findings and the wiring/copy findings and tried to refute each with a repro. Rules-lens and test-lens findings were checked by direct repro instead: the emulator (a row written for the claim, run against the old rule) and surviving mutants. Seven agents in all. Vite build: see §Final checks.

| Id | Lens | Finding | Verdict | Disposition |
|---|---|---|---|---|
| E1 | exposure | A training pod's `agentId` embeds the owner's account id and was on the allowlist | **PARTLY** — mechanism CONFIRMED (repro through `activateTrainingPod` → clone id → battle); severity low, since the group doc already lists the ids | Fixed: `agentId` off the allowlist |
| E2 | exposure | Guardrail levels reach non-owners through feed `message` | **CONFIRMED** (deterministic once a deployed stop/target fires) | Fixed: no feed for non-owners |
| E3 | exposure | The Film Room self-review's grade and lesson reach non-owners through the feed | **CONFIRMED** (no flag gates it; the lesson can carry the owner's veto notes) | Fixed: same |
| E4 | exposure | The model's `status_feed_update` (told to cite strategy and risk levels) reaches non-owners | **PARTLY** (real; content is model-dependent) | Fixed: same |
| E5 | exposure | Hot-bench names, risk details, gameplan text and mechanism words in `message`/`action` | **CONFIRMED** (catalyst and gameplan beats medium; proposal beat REFUTED — autopilot only) | Fixed: same |
| W1 | wiring + honesty | On a group change the hook joined the old group's seat map to the new group's players (one player's book on another's seat) | **PARTLY** — mechanism CONFIRMED and introduced by this branch; claimed path (week N / N+1 flip) REFUTED; real path: a bracket round advancing; "forever" REFUTED (the poll retries) | Fixed: reply bound to its group |
| W2 | wiring | Tabs open across the deploy get the seat-keyed reply with old code: empty seats and "Book drafts Monday" until reload | not refuted (static) | Reported (no active league battles this month) |
| W3 | wiring | YourBacking shows no agent six if the first group read fails | not refuted | Reported (Backing dark) |
| H1 | honesty | The arena's rival snapshot promised the rival's reasoning "then the Film Room opens" (reachable: `LEAGUE_BATTLE_VIEW_V2_ENABLED`) | **CONFIRMED** | Fixed |
| H2 | honesty | "See how they traded in the film room." on the viewer's own losing seat | **CONFIRMED** (and "see how they traded" alone is unfulfilled — no swap history on that screen) | Fixed: sentence removed |
| H4 | honesty | Completion copy "rivals' books were sealed until now. The Film Room opens the whole week." / "Everything sealed, now open" | **REFUTED** as a branch finding (already false: the recap shows only the viewer's own week) | Reported |
| H5 | honesty | The new note told CPU seats their reasoning was "private to its owner" | **CONFIRMED** (introduced) | Fixed: neutral wording |
| H6 | honesty | Team card: every swap shows "—" under "The why · as recorded on the trade" | coordinator's read (`BackingParts.jsx` TapeLine renders "—" for a null why); not handed to a refuter; Backing dark | Founder question 3 |
| H7 | honesty | The new note said "Every position and score is open to all" beside empty books | **PARTLY** (new on final pods) | Fixed: clause removed |
| H8 | honesty | The viewer's own seat in a past bracket game reads "No reasoning recorded" | **CONFIRMED**, older than this branch | Reported |
| R1 | rules | The suite pinned only one of the four fields (every seeded side had `uid === odUserId`) | **CONFIRMED** (by reading the seeds; the new isolation rows now kill each field's mutant) | Fixed |
| R2 | rules | A side stored as `null` errors the rule and locks out the other participant | **CONFIRMED** by emulator repro (the new row failed on the old rule) | Fixed: `battleSideIds` |
| R3 | rules | The suite header claimed a mutant that cannot fail (dropping `!= null` is equivalent: an error denies) | **CONFIRMED** | Fixed: header lists the mutants actually run |
| R4 | rules | Either participant can rewrite the participant fields | not refuted | Reported (outside the prompt's scope) |
| R5 | rules | The dashboard flags' rollback would revive a lobby nobody can join | not refuted | Founder question 5 |
| R6 | rules | `set-opponent.test` spied only the shared admin helper, not `firebase-admin` itself | CONFIRMED (static) | Fixed |
| R7 | rules | A fourth `api/` file (`curtain-briefing.js`) touches `battles` | **REFUTED** (it only has the word in a sentence) | — |
| T1 | tests | Nothing pinned the allowlist property; the manifest/loadout keys were never planted | **CONFIRMED** (A3, A4, A5 survived) | Fixed (now killed) |
| T2 | tests | The trade-attribution row checked keys the fixture never carried; production's key is `trigger` | **CONFIRMED** (A1, A2 survived) | Fixed |
| T3 | tests | Fixtures lacked `portfolio.bench` and the stance text | **CONFIRMED** (A14 survived) | Fixed; stance → founder question 4 |
| T4 | tests | A hook row pinned a re-seat under a new order as if correct | CONFIRMED (wording) | Row retitled with its assumption (players never reorder mid-battle) |
| T5 | tests | No row covered a doc with no `ownerId` (A10, equivalent today) | CONFIRMED | Row added |

**Split:** 22 confirmed in full or in part, 3 refuted as stated (H4 as a branch finding, R7, E5's proposal beat), 4 reported without a refuter verdict (W2, W3, R4, R5) and H6 checked by the coordinator only.

---

## Found and not fixed (for separate tasking)

1. **Account ids still reach every signed-in user outside this view:** the group document (`firestore.rules:668`–`:671`, read by any signed-in user) lists `players[].odUserId`; `GET /api/tournament/live-composites` returns composites keyed by account id (`api/_utils/tournamentLiveComposite.js:103`); `api/tournament/team-card.js` echoes the requested `odUserId` and `tape.focusId`. Read-rule changes were out of scope.
2. **Either participant of an old `battles` record can rewrite the participant fields** (hand the record to someone, or drop the other player). The create rule still lets anyone create a record that names another user as a participant.
3. **A Backing stake carries the team's `equippedConfigHash`** (`api/_utils/backingStake.js:226`–`:233`) on a document the backer reads — a loadout fingerprint, not its contents.
4. **The dev screen is reachable by URL in the production bundle** (`?tournamentDev=1`, `src/App.jsx:2240`–`:2242`), and its `SpectatorView` prints raw account ids from the group document.
5. **Copy older than this branch:** the arena's completion copy ("rivals' books were sealed until now. The Film Room opens the whole week.", "Everything sealed, now open"); the hard-coded "3 players beat your agent this week."; the rival snapshot's "their points stay sealed" while it shows their composite; the viewer's own seat in a past bracket game reading "No reasoning recorded".
6. **Deploy window:** a tab open across the deploy shows empty seats until it reloads (within one poll). No league battle has run in November.
7. **`finishedRivalRead` would pin `{}` for the page's life** if it were ever first called without the players (not reachable today: only the arena passes a group, and it passes the players).
8. **Stale comment:** `src/data/executionOutcome.js:52` still says the public projection carries the unconfirmed-outcome marker.

## Founder questions

1. **The narration feed.** Built to the letter of R-F: a non-owner receives no feed at all, because its free text carries guardrail levels, review lessons and the model's own words. No production screen showed a rival's feed. Keep it withheld, or have the server build a WHAT-only line for spectators (e.g. "Swapped AMD → NVDA") from the symbols alone?
2. **Account ids outside the view** (item 1 above): schedule the group-document read rule and `live-composites` re-keying as a follow-up?
3. **The team card's "why"** (Backing dark; blocks the Backing flip): (a) the owner's own card keeps its words and every other viewer reads "not shared", or (b) the section goes. `BackingPreviewScreen` still shows a sample reason the endpoint no longer sends.
4. **The stance text** (`agentContext.tournament.userPicksStance`, model-written, up to 280 characters) still reaches non-owners: V2.1 §9 names "the double-down stance" public, and the same text sits in `agentBoards`, readable by any signed-in user. Keep it public, or treat it as reasoning?
5. **The old `battles` collection:** joins are now closed, and the dashboard flags' "instant rollback" (`src/config/featureFlags.js:18`–`:19`, `:29`–`:30`) would bring back a lobby where nobody can join. Retire the collection and its three jobs as a separate task?
6. **Wording.** Approve: "{name}'s reasoning is not shared with other players." (Spectate), "This agent's reasoning is not shared with other players." and "This agent's live feed is not shared with other players." (dev battle view), and the arena snapshot's "… stay sealed until the battle completes. Their agent's reasoning is not shared with other players."
