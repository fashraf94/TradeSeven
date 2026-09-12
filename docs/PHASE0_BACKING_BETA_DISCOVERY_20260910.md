# CC Phase 0 Read-Only Discovery: Backing Beta

**Date:** 2026-09-10 · **Repo:** fashraf94/TradeSeven · **Branch:** `main` · **HEAD:** `65237e476155eac8f0c0bf8114df7179d7b90af1` · **Scope:** spec §11 (+5 added questions), §3 contradictions, §4 risks, §5 touch list, §6 baseline. Rulings (§14) are the founder's and are not made here.

Every citation below is `file:line` on `main` at the HEAD above and is **confirmed** (read in this session) unless tagged **inferred** or **not found**.

---

## 0. Git verification

| Check | Result |
|---|---|
| `git checkout main && git pull` | Fetched `origin` first (BUILD_RULES §3): `main` moved `0e04833d..65237e47`; ~120 remote branches listed, none checked out. |
| Branch | `main` |
| HEAD | `65237e476155eac8f0c0bf8114df7179d7b90af1` |
| `git status --porcelain` | empty at start and re-verified empty at the end of the session |
| Spec on `main` | `docs/FANTASYTRADES_BACKING_BETA_SPEC_V1.md` present, blob `74085e7d` |
| Writes to repo | none by this session: no file staged/edited/created, no commit, no push, no `.env`/Vercel/Firestore touched. One disclosure: the harness had already created and pushed `claude/brave-keller-e6dlur` at container start, before the first command (reflog: `branch: Created from HEAD`, then the harness checkout, then this session's `checkout main`). It sits at `65237e47`, identical to `main`, with zero commits; this session did not create it and did not use it. |
| Packages | none installed into the repo. One disclosure: the baseline attempt ran `npx vitest run`, and npx auto-fetched `vitest@5.0.0` into its own cache outside the repo before failing (see §6). `node_modules/` does not exist in this container. |

Two housekeeping notes on the brief: the harness named a working branch `claude/brave-keller-e6dlur`; per the read-only instruction it was not used, and it carries nothing (see the row above). The seed set names `BUILD_RULES.md`; it lives only at `docs/BUILD_RULES.md`.

---

## Executive verdict

| # | Finding | Severity | Where |
|---|---|---|---|
| V1 | **No production writer of round-1 bracket groups exists.** The only bracket seeder is the admin dev seeder, which stamps `isDev: true`; the self-serve lobby forms base-layer groups, and base-layer groups complete without recomposition. The spec's "bracket only in V1" has nothing to attach to in production until a bracket launch path exists. | Blocking for PR 2/3 sequencing | `api/admin/seed-tournament-bracket.js:78-108`, `api/_utils/tournamentLobbyService.js:361-380`, `api/_utils/tournamentAdvancement.js:18-19,307-361` |
| V2 | **The placement-finality signal is the bracket game entry's `advancers`+`finalScores` lock**, written once, permanent, then rank/leaderboard side-effects, then `sideEffectsAt`, then group `complete`. Resolution should ride `runWeekSideEffects` as a third half. | Design-shaping, clean | `tournamentAdvancement.js:651-682`, `:456-518`, `:523-529` |
| V3 | **Signal Capture event #8 (nightly loadout edits) does not persist.** The "loadout changed" marker must be a hash comparison, not an event feed. | Contradicts §4 | catalog row `docs/VISION_PROGRAM_POST_LAUNCH_PLACEMENT_ADDENDUM_A_JUN10_2026.md:74`; writers grep-clean |
| V4 | **Tier/RP do not live in `masteryProfiles`.** Career rank is `tournamentRanks/{odUserId}`; `masteryProfiles` is archetype-mastery XP. | Contradicts §6 | `api/_utils/tournamentRank.js:72`, `src/constants/leagueTournament.js:798,866`, `api/_utils/masteryConfig.js:132` |
| V5 | **The advancement tiebreak never leaves a tie**: composite desc, then seat order. The spec's "if still tied, split" is unreachable unless the backing layer compares raw `finalScores`. Ruling needed. | Contradicts §3 | `src/constants/leagueTournament.js:845-849` |
| V6 | **"First battle open" is 7:00-7:30 ET Monday, not 9:30.** Drafts resolve and battles are created in the same orchestrator tick; ranked groups carry no `startAnchor`, so the pre-open helper returns false for them. | Contradicts §4 (D-c) | `api/_utils/tournamentOrchestrator.js:553-632`, `api/_utils/agentBattleService.js:132-140`, `api/tournament/resolve-user-draft.js:183-186`, `api/_utils/tournamentTime.js:125-132` |
| V7 | **Cron count is 39/40.** Zero-new-cron holds only if pool-open rides `finalizeRound` and resolution rides `runWeekSideEffects`, both inside the orchestrator's 300s/270s tick. | Confirms §7 | `vercel.json:43-199`, `api/cron/tournament-orchestrator.js:26`, `tournamentOrchestrator.js:103` |
| V8 | **Flag must be named `*_ENABLED`** or the pin guard cannot see it; `BACKING_BETA` would be invisible. | Contradicts §12 | `src/config/flagPinGuard.test.js:155` |
| V9 | **No unauthenticated read exists on any tournament collection.** "Pools are publicly readable" needs a ruling: authed-read (house pattern) or a first-ever public rule. | Contradicts §6 | `firestore.rules:531-583` |
| V10 | **The live spectator group view is the redesigned League surface** on real data; the P6b `SpectatorView` has no production mount found. A Team Card mounts per `PodRow`; a pool ticker on `PodCard`/`PodSheet`; a chip on the funnel node. But the real adapter subscribes the bracket via the viewer's *own* group, so a pure spectator with no group may see an empty funnel. | Shapes PR 4 | `src/screens/LeagueScreen.jsx:111`, `src/hooks/useRealLeagueState.js:86,99`, `src/components/League/LeaguePod.jsx:33-113` |
| V11 | **Team Card "equipped trait names" collide with the P7 WHY allowlist**, which conceals `equippedBundleIds` on live battles; yet the `agents` doc is authed-readable to anyone, rule contents included. Which source is the transparency truth needs a ruling. | Ruling needed | `api/_utils/tournamentBattleView.js:41-45`, `firestore.rules:224-225` |
| V12 | **Eval-tick deferral is mitigated, not resolved** (60s to 300s, fair rotation). No post-July production deferral measurement exists in the repo; logs are not accessible here. | Spec §12 prerequisite unresolved | `api/cron/agent-evaluate.js:130-139,322-343`, `api/_utils/agentEvalTransport.js:14,80-88` |
| V13 | **Baseline test suite could not run**: `node_modules` absent, installing forbidden. Exit code 1, no `Test Files` line. | Report-only | §6 |
| V14 | **Touch list crosses zero fenced files.** One ratchet hazard: a new importer of `agentArchetypeConfig.js` for archetype labels trips the §2.3 import-boundary ratchet; use the existing label helpers instead. | Clean | §5 |

---

## 1. Seed set read

Read in full: `docs/FANTASYTRADES_BACKING_BETA_SPEC_V1.md`, `docs/FANTASYTRADES_LEAGUE_TOURNAMENT_DESIGN_FRAMEWORK_V2_1_AGENTIC.md`, `docs/BUILD_RULES.md` (§1 fence list, §2 flag discipline and §3 discovery protocol, §6 cron constraints), `docs/README.md` reading order, and the binding `docs/FANTASYTRADES_LEAGUE_TOURNAMENT_IMPLEMENTATION_SPEC_V1.md`. Prior audits were used only as pointers; every claim below was re-read in code.

---

## 2. Spec §11 answers

### Q1. Which job writes new-round `tournamentGroups`, and which locks top two on Friday?

**Answer.** Both are the Friday advancement duty of the single tournament orchestrator cron. They are two stages of one function, not two jobs.

- **Lock top two:** `lockTopTwo` at `api/_utils/tournamentAdvancement.js:103-113` (composite desc, seat-order tiebreak via `rankByScores`). Written to the bracket doc at `:651-665` inside `advanceCohort` (`:570-700`): one `bracketRef.update` sets `rounds.r{N}.games.{gameId}.advancers / finalScores / finalUserScores / completedAt`. Guarded by `entry.advancers == null` (`:638`), refused on a degraded final snapshot (`:646-650`), refused while frozen (`:282-301`).
- **Write next-round groups:** `finalizeRound` at `:709-844`. After every game in the round is locked (`:714`), it pairs advancers (`pairAdvancers` `:120-128`), pads with CPUs (`:769-785`), fetches the ranked pool (`:790-795`), lazily creates CPU agents (`:797`), and writes each new group with `groupRef.set(groupDoc)` at `:826` using a **deterministic id equal to the bracketGameId** (`:806`), status `forming` (`:817`). It commits CPU user boards (`:828`) and then writes the round entry `rounds.r{N+1}` + `currentRound` (`:835-843`). Terminal round (exactly one game) writes the champion instead (`:724-762`).
- **Host chain:** `runFridayAdvancement` `:236-432` is called from the orchestrator tick at `api/_utils/tournamentOrchestrator.js:1047-1048` when `getDutyForInstant` routes `FRIDAY_ADVANCEMENT` (`:122-130`: Friday, ET minutes ≥ 12:00), and again as the Monday catch-up at `:505`. The cron handler is `api/cron/tournament-orchestrator.js:36-55`; schedule `vercel.json:177-178` = `*/10 11,12,13,14,21,22,23 * * 1-5`.
- **Round 1 is different.** No production code writes round-1 bracket groups. Writers of `tournamentGroups` with a `bracketGameId`: `finalizeRound` (rounds ≥ 2) and the admin dev seeder `api/admin/seed-tournament-bracket.js:78-108`, which stamps `isDev: true` at `:108`. Production formation paths write **base-layer** groups: the lobby at `api/_utils/tournamentLobbyService.js:361-380` (`baseLayerWeek` at `:372`, `roundNumber: 1` at `:364`) and the slot path at `api/_utils/liveDraftFormation.js:313-314`. The group factory enforces the XOR at `src/constants/leagueTournament.js:1524-1528`.

**Confidence:** confirmed.

### Q2. Where is the advancement tiebreak defined?

**Answer.** `rankByScores(scores, order)` at `src/constants/leagueTournament.js:845-849`: sort by score descending, then by index in the caller-supplied order. Docstring `:836-843` says the order is draft/seat order, built from one array at `:1544-1549`. Consumers: `lockTopTwo` `tournamentAdvancement.js:111`, the champion `:740`, the rank writer `api/_utils/tournamentRank.js:143`, leaderboard placement `api/_utils/tournamentLeaderboard.js:170`, and the client `src/utils/roundBoundary.js:53`. Missing or non-finite scores rank as 0 (`:846`).

**Consequence for §3.** The tournament never reports a tie. Two equal composites are ordered by seat position, invisible to a backer. The winner of record is `ranking[0]`. See contradiction C6.

**Confidence:** confirmed.

### Q3. Is `equippedConfigHash` readable server-side per agent at any time? Does event #8 persist?

**Hash.** Computed by the non-fenced builder at `api/_utils/resolvedAgentManifest.js:129-165`: `canonicalContentHash` over six axes (`activeRules`, `equippedBundleIds`, `standingLeans` + invalidated record, `dials`, `deployedGuardrails`, `equippedWatchlist` minus its `snapshotAt`), documented at `:151-164`. Persisted on every new battle doc as `resolvedAgentManifest.equippedConfigHash` by the fenced `createAgentBattle` spread at `api/_utils/agentBattleService.js:236-245`, live because `MANIFEST_WRITE_ENABLED = true` at `src/config/featureFlags.js:1326`. Composite index `agentId + resolvedAgentManifest.equippedConfigHash` at `firestore.indexes.json:300` (emulator round-trip test `test/rules/equippedConfigHashQuery.rules.mjs`, honest scope note at `:9-16`: production index is Console-created).

Server-side at any time: **yes, two ways.** (a) Read the latest battle doc's persisted hash; `latestTournamentBattlesByAgent` at `tournamentOrchestrator.js:329-344` already selects fields per agent for a group. That is the hash **at that battle's birth**, not now. (b) Compute now from the `agents` doc with `buildResolvedAgentManifest({agentData, compiledBuild, equippedWatchlist, gameMode, now})`, the same inputs the fenced call passes at `agentBattleService.js:237-244`. The builder is pure and non-fenced, but its `standingLeans`/`dials` inputs come through `buildCustomizationSnapshot` (`resolvedAgentManifest.js:27`, `:20-25`), so "hash at stake time" on a weekend means running that kernel, **inferred** (kernel not read this session). Hash-at-open for the pool on Friday evening has the same shape.

**Event #8.** **Not found.** The catalog row is `docs/VISION_PROGRAM_POST_LAUNCH_PLACEMENT_ADDENDUM_A_JUN10_2026.md:74` ("Nightly loadout edits: what changed, prior → new, timestamp, at save"). No writer persists it: `api/agent/change-archetype.js:343-372` emits a rule-compat rescan event and lean-invalidation record (composition catalog, awaited), not a prior/new loadout record; `api/agent/equip-watchlist.js` has no capture; `reforge-bundle.js:273` and `set-rule-hardness.js:208` write the `rule_compat` stream. Client services (`src/services/agentService.js`, `deployStrategyService.js`, `src/hooks/useAgent.js`) write `equippedBundleIds`/`activeRules` on the `agents` doc directly under the owner-update rule (`firestore.rules:224-262`). `src/components/Tournament/ClaimFlipWindow.jsx` contains no loadout content (grep). A "loadout changed" marker is therefore `hashAtStake !== currentHash`, computed, never fed.

**Confidence:** hash persistence confirmed; compute-now path inferred; event #8 not found.

### Q4. Do CPU teams carry a `playerId`-shaped identity compatible with §1?

**Answer: yes.** `cpuUserId(n)` = `cpu-{n}` at `src/constants/leagueTournament.js:351-356`, `isCpuUserId` `:358-360`, `cpuNFromUserId` `:367-372`; agent doc id `cpu-agent-{n}` `:375-380`. The agent doc shape is `api/_utils/tournamentCpu.js:63-93`: `ownerId: 'cpu-{n}'`, `isCpu: true`, empty `activeRules`/`equippedBundleIds`, `equippedWatchlistId: null`, fixed round-robin archetype (`:15-17`). Group seats carry `players[].isCpu` (`leagueTournament.js:1548`); bracket seats `{odUserId, isCpu}` (`tournamentAdvancement.js:138`); battle docs carry `isCpu: true` (`agentBattleService.js:137`). Rank docs exist for CPUs at `tournamentRanks/cpu-{n}` with a frozen ratchet (`tournamentRank.js:81-84`). So the §1 tuple resolves to `(bracketId, roundNumber, bracketGameId, 'cpu-{n}', 'cpu-agent-{n}', hash)`.

Three caveats. `cpu-{n}` is reused across rounds and across independently formed base-layer groups (per-round uniqueness only, `leagueTournament.js:345-349`; lobby counter `tournamentLobbyService.js` header), so `playerId` is unique only inside the tuple. All CPUs share one `equippedConfigHash` (identical empty layers). CPU "career tier/RP" is display-only, never ratchets (`tournamentRank.js:84`).

**Confidence:** confirmed.

### Q5. Exact current cron count against the ceiling.

**39 of 40.** `vercel.json:43-199`, 39 entries, first at `:44-46`, last at `:196-198`. BUILD_RULES §6 states the same. Full inventory in Q12.

**Confidence:** confirmed.

### Q6. Does the spectator group view exist as a component that can host a Team Card?

**Answer: yes, and there are two, only one of which is live.**

- **Live landing (real data):** `LEAGUE_REDESIGN_ENABLED = true` (`src/config/featureFlags.js:168`) makes `src/screens/LeagueScreen.jsx:111` render `LeagueHome` on mobile and `LeagueLobbyDesktop` on desktop (`:99-108`). Data comes only through `useLeagueState` (`src/hooks/useLeagueState.js:36-57`), which is on the real adapter because `LEAGUE_NEXT_ARC_ENABLED = true` (`featureFlags.js:191`): `src/hooks/useRealLeagueState.js` → `src/components/League/leagueAdapter.js`. The group view is `PodCard`/`PodRow` at `src/components/League/LeaguePod.jsx:74-113` and `:33-71`: four ranked seat rows with the cut line, each row a `Seat` from `buildSeat` (`leagueAdapter.js:180-200`: `id`, `name`, `archName`, `kind` cpu/human, `pscore`, `you`). Tapping a row opens `Spectate` (`src/components/League/LeagueSpectate.jsx:138`) with a per-seat `FocusRow` and a `FilmRoom` panel (`:71-114`). It is a per-seat component, not a flat list; a **Team Card mounts per `PodRow` (`:44-70`) or replaces the focus panel in `Spectate`**, a **pool ticker in the `PodCard` header or `PodSheet` (`:229-260`)**, and a **"Backing open" chip on `FunnelNode`/`Funnel` (`:194-225`)**.
- **Legacy P6b path:** `src/components/Tournament/SpectatorView.jsx:22` (`{group, uid, onBack}`) renders group standings per player (`:95-108`) plus the draft theater and the projected battle view. It is reached from `LeaderboardCard.onOpenGroup` (`LeaderboardCard.jsx:94-97`), and that card is "dev-screen mounted now" (`:3`). No production mount was found in `LeagueScreen.jsx` or `LeagueParticipantView.jsx` (grep), **inferred** dev-only.

**Confidence:** components confirmed; reachability of the legacy path inferred.

### Q7. Existing Firestore rules pattern for server-only collections.

Verbatim house pattern, `firestore.rules:531-534`:

```
match /tournamentGroups/{groupId} {
  allow read: if request.auth != null;
  allow create, update, delete: if false;
}
```

Repeated as "the tournamentGroups pattern verbatim" for subcollections `:541-544` (`{document=**}`, `allow write: if false`), `tournamentBrackets` `:551-554`, `tournamentLeaderboards` `:563-566`, `tournamentRanks` `:568-571`, `tournamentLobby` `:580-583`. The **owner-read** variant for per-user server-written docs is `masteryProfiles/{userId}` at `:988-992` (`request.auth.uid == userId`, `allow write: if false`). Display names come from `users/{uid}`, authed-read at `:161-168`. Rules do not auto-deploy; the manual Console step is documented at `:525-530` and `docs/FANTASYTRADES_LEAGUE_TOURNAMENT_LAUNCH_RUNBOOK.md:21-27`. Rules tests live in `test/rules/*.rules.mjs`, run via `npm run test:rules` with the emulator (`package.json`), e.g. `masteryDenials.rules.mjs`.

**Confidence:** confirmed.

### Q8. Where a completed round's Film Room highlights are stored.

**"Best/worst pick, decisive moment": not found as stored data.** What is stored and renderable:

- **Per-day Haiku review on the battle doc:** `api/cron/agent-batch-review.js:317-343` appends `agentBattles/{id}.dailyReviews[]` entries `{date, tradingDay, selfGrade, lessonLearned, daySummary, summary, counterfactuals, createdAt, …}` and a `film_room` statusFeed entry (`:337-342`); schedule `25 20,21 * * 1-5` (`:3-8`).
- **Trade WHAT with locked points:** `trades[]` fields `lockedPoints`, `lockedGainPct`, `symbolOut/In` are public even live (`api/_utils/tournamentBattleView.js:61`); best/worst pick is a max/min over them, a cheap computation, not a lookup.
- **Full WHY at completion:** `projectTournamentBattle` returns the whole doc for completed battles (`tournamentBattleView.js:86-90`) via `GET /api/tournament/battle-view` (`api/tournament/battle-view.js:1-15`, `maxDuration 10` at `:24`), polled at 60s by `src/hooks/useSpectatedTournamentBattles.js:19`.
- **League Score History recap:** `buildScoreHistory` (`src/components/League/battleArena/buildScoreHistory.js:1-23`, export `:86`) is a pure read of `dailyScores.dayN.closeScores[uid].compositePoints` plus the per-day swap ledger from the caller's **own** battle chain; rendered by `FilmRoomRecap` (`FilmRoomRecap.jsx:71`) behind `LEAGUE_SCORE_HISTORY_ENABLED = true` (`featureFlags.js:408`).
- **Caution:** the redesign's unlocked film room renders a **fixture** string map: `LeagueSpectate.jsx:109` reads `REASONING[player.id]` defined at `:17-27`. Under the real adapter that text is not real data. Report-only, outside scope.

A round is five daily battles per team (`fullday` at `agentBattleService.js:35`; incumbent chaining `tournamentOrchestrator.js:17-22`), so "last round's Film Room" is five docs, each with its own `dailyReviews` entry.

**Confidence:** confirmed.

### Q9. Location of the forbidden-terms test.

The copy-lexicon guard is `src/components/Dashboard/desk/deskHonesty.test.js`: `GUARDED` file list `:96-104`, `FORBIDDEN` `:106-117`, `PHASE_B_FORBIDDEN` `:129-150` merged at `:153`, comments stripped before scanning `:192-196`, suite at `:198`. It scans **Desk and Battle View sources only**; no League or tournament copy guard exists (grep). Other lexicon lists: `api/research/narrationPhrasebook.js:43` (`BANNED_LEXICON`, narration), `src/utils/conflictSurfaceCopy.js:21` (`BANNED_VERBS`). "Extend" therefore means a sibling suite for the backing surfaces copying the `strippedSource` + `GUARDED` shape, not adding rows to the Desk suite.

**Confidence:** confirmed.

### Q10. Floor top-up for users who registered mid-month.

Facts that bear on it:

- The only "round boundary" event in code is bracket composition in `finalizeRound` (`tournamentAdvancement.js:835-843`), Friday evening or Monday catch-up. Base-layer groups **complete only**, no recomposition, no boundary (`:18-19`, `:307-361`).
- Registration is a lobby join or quick-play (`api/tournament/lobby-join.js:1-14`, synchronous formation on the fourth seat) forming a base-layer group at a deterministic id equal to the lobby id (`tournamentLobbyService.js:349-380`), or a slot claim (`liveDraftFormation.js:1-60`). Nothing enumerates "all users" at any boundary; the only per-round populations are bracket seats and the field's groups.
- The monthly precedent keys a group-week to the ET month of its day-1 banking (`tournamentLeaderboard.js:74-78`, `monthKeyFromEtDate` `leagueTournament.js:853-856`), never splitting a straddling week.
- Eligibility "one completed battle" is index-backed: `agentBattles [ownerId ASC, status ASC, completedAt DESC]` (`firestore.indexes.json`, third agentBattles entry, `ownerId` at `:260`). A cheaper proxy exists: `agents.stats.gamesPlayed` is server-incremented only (`api/cron/agent-evaluate.js:4491-4516`; rule note `firestore.rules:231-234`).

**Recommendation (design, not code):** make the floor **lazy**, keyed by `(bracketId, roundNumber)` of the pool being viewed or staked: on first wallet touch, if `lastFloorRound` ≠ the current open round, raise to 1,000 and write a `floor` entry. A mid-month newcomer is floored the first time they touch an open window; nobody needs enumerating; the co-tenant job then only needs to open pools, and "floor top-up" becomes a wallet-side rule rather than a fan-out write. **Inferred.**

### Q11. Placement finality signal (added).

**The signal is the bracket game entry's lock**: `tournamentBrackets/{bracketId}.rounds.r{N}.games.{bracketGameId}.advancers` and `.finalScores` (with `finalUserScores`, `completedAt`), written in one `bracketRef.update` at `tournamentAdvancement.js:652-658`, guarded by `advancers == null` at `:638`. The comment at `:639-640` calls the lock permanent. Nothing earlier is final: banking (`isWeekBanked` `leagueTournament.js:1353-1363`) precedes the lock and can be refused (`isFinalSnapshotDegraded` `:1378-1385`, refusal at `tournamentAdvancement.js:646-650`; the freeze at `:282-301`).

**Write order after the lock:** rank + leaderboard side-effects in `runWeekSideEffects` `:456-518` (belt `:462-465`) → `sideEffectsAt` stamp `:523-529` (only when both halves clean) → group `status: complete` `:682` → round `lockedAt` `:718-722` → composition or champion.

**Readers of finality:** `finalizeRound :714` (`every g.advancers != null`); `applyLockedGameToRanks :130` (`advancers == null || finalScores == null` → no-op); the sweep `:414` (`advancers == null || sideEffectsAt != null`); client `src/utils/roundBoundary.js:26,45,53` (`completedAt`, `advancers`, `finalScores`); adapter `leagueAdapter.js:267-270` (`completedAt != null || finalScores != null` → `'final'`).

**Recommendation:** key resolution on `finalScores != null && advancers != null` on the game entry, and run it **inside `runWeekSideEffects` as a third half** gated by the same `clean` contract, so `sideEffectsAt` implies "payouts done" and the sweep's resume path (`:539-561`) retries it for free. Never key on group `status == complete` alone (base-layer and training groups complete without a lock) and never on `isWeekBanked`.

**Confidence:** confirmed.

### Q12. Cron inventory (added).

39 entries from `vercel.json:43-199`, ceiling 40 (assumed Pro), **one slot free**.

| # | Schedule (UTC) | Path |
|---|---|---|
| 1 | `*/15 9-23 * * 1-5` | /api/lobbies/cleanup-expired |
| 2 | `15 21 * * 1-5` | /api/cron/snake-draft-daily-scores |
| 3 | `*/10 * * * *` | /api/cron/snake-draft-autopick |
| 4 | `15 1 * * 2-6` | /api/cron/baggerbomb-v4-daily-scores |
| 5 | `30 1 * * 2-6` | /api/cron/compute-daily-baggerbomb-levels |
| 6 | `45 1 * * 2-6` | /api/cron/agent-daily-scores |
| 7 | `0 11 * * 1-5` | /api/cron/compute-rankings |
| 8 | `25 13,14 * * 1-5` | /api/cron/process-draft-claims |
| 9 | `0 1 * * 0` | /api/cron/compute-briefs |
| 10 | `0 10 * * 6` | /api/cron/compute-estimates |
| 11 | `30 13,14 * * 1-5` | /api/fantasytimes/generate-pulse?period=pre_market |
| 12 | `0 16,17 * * 1-5` | /api/fantasytimes/generate-pulse?period=midday |
| 13 | `15 20,21 * * 1-5` | /api/fantasytimes/generate-pulse?period=post_close |
| 14 | `0,30 13-21 * * 1-5` | /api/fantasytimes/generate-econ?mode=recap |
| 15 | `0 1 * * 1` | /api/fantasytimes/generate-econ?mode=preview |
| 16 | `0 5 * * 1-5` | /api/fantasytimes/submit-earnings-batch |
| 17 | `0 13,20,21,22,23 * * 1-5` | /api/fantasytimes/generate-recap |
| 18 | `*/15 * * * 1-5` | /api/fantasytimes/poll-batch |
| 19 | `0 10,11 * * 1` | /api/fantasytimes/generate-column?type=preview |
| 20 | `0 21,22 * * 5` | /api/fantasytimes/generate-column?type=wrap |
| 21 | `0 7 * * 1,4` | /api/fantasytimes/cleanup |
| 22 | `*/15 13-20 * * 1-5` | /api/fantasytimes/scan-movers |
| 23 | `30 23 * * 1-5` | /api/fantasytimes/ingest-earnings |
| 24 | `30 3 * * 2-6` | /api/fantasytimes/ingest-earnings |
| 25 | `45 14,18,22 * * 1-5` | /api/fantasytimes/ingest-econ |
| 26 | `0 8 * * 0` | /api/fantasytimes/ingest-cleanup |
| 27 | `30 10,11 * * 1-5` | /api/cron/compute-index-intelligence |
| 28 | `0 14-20 * * 1-5` | /api/cron/compute-index-intelligence?mode=intraday |
| 29 | `*/15 13-21 * * 1-5` | /api/cron/agent-evaluate |
| 30 | `*/15 13-20 * * 1-5` | /api/cron/voice-layer-cache |
| 31 | `0 1,2 * * 1` | /api/cron/compute-institutional-intelligence |
| 32 | `30 12 * * 1-5` | /api/cron/compute-daily-regime-brief |
| 33 | `0 10,11 * * 1` | /api/cron/promote-discover-themes |
| 34 | `*/10 11,12,13,14,21,22,23 * * 1-5` | /api/cron/tournament-orchestrator |
| 35 | `*/10 * * * *` | /api/cron/live-draft-fire |
| 36 | `*/15 14-22 * * 1-5` | /api/cron/mandate-evaluate |
| 37 | `*/15 12,13 * * 1-5` | /api/cron/mandate-rollover |
| 38 | `*/15 13-23,0 * * *` | /api/cron/process-pending-reflections |
| 39 | `25 20,21 * * 1-5` | /api/cron/agent-batch-review |

Hour lists are abbreviated as ranges where contiguous; `vercel.json` spells them out.

**Co-tenant host 1, the orchestrator (entry 34):** `maxDuration: 300` (`api/cron/tournament-orchestrator.js:26`); duty deadline `DUTY_DEADLINE_MS = 270_000` (`tournamentOrchestrator.js:103`) shared by the whole tick (`:958`); deploy pacing ≥ 20s (`:102`); failed-deploy cooldown 10 min (`:104`); per-duty per-ET-date markers written transactionally (`:138-140`, `:182-191`), sim namespace for dev clocks (`:133-137`). The Friday duty fires on the 21-23 UTC arms, i.e. 17:00-19:50 EDT or 16:00-18:50 EST, and no-ops "banking pending" until day 5 is banked (`tournamentAdvancement.js:632-636`); its marker is set only when `bankingPending === 0 && frozen === 0` (`tournamentOrchestrator.js:910-915`). **The Friday duty itself has no per-cohort budget check**: `runFridayAdvancement` loops base groups, cohorts and the bracket sweep without consulting the deadline (`:307-429`); only the deploy fan-outs honor `budget` (`:406-410`, `:546-550`, `:666-670`). Per-game try/catch isolates one game's failure from its siblings (`tournamentAdvancement.js:630-696`). Manual re-run precedent: `POST /api/tournament/run-duty` with `simulatedNow` and `duty` (`api/tournament/run-duty.js:1-22`, `maxDuration 300`).

**Co-tenant host 2, Friday scoring (entry 2, `snake-draft-daily-scores`):** fires `15 21` UTC = 17:15 EDT / 16:15 EST. No `config.maxDuration` export (grep), so it runs at the Vercel default. The tournament branch sequence is banking → training completion → ledger reconcile → leaderboard, each in its own try/catch (`api/cron/snake-draft-daily-scores.js:475-548`); banking is one quote batch for all groups (`api/_utils/tournamentBanking.js:402-425`) and one transaction per group (`:366-394`). **Note the split:** scoring (banking) and advancement (placements) are different crons; placements become final only in the orchestrator's Friday duty. The resolution co-tenant is therefore the orchestrator, not the scoring cron. The dependency is documented as normal in `docs/LAUNCH_READINESS_WATCH_LEDGER.md:80-81`.

**Confidence:** confirmed.

### Q13. Existing ledger-style writes (added).

| Writer | Shape | Cite |
|---|---|---|
| Career rank `tournamentRanks/{odUserId}` | One `db.runTransaction` per (player, group-week); idempotency key `appliedGroups.{groupId}` re-read inside the tx; an event record `{groupId, weeklyComposite, placement, cpuOpponents, raw, guard, delta, rpAfter, appliedAt}`; whole-doc `tx.set`; `history` capped at 20; dev namespace `dev-{id}`. | `api/_utils/tournamentRank.js:72-107`, `RANK_TUNING.HISTORY_CAP` `leagueTournament.js:971`, `rankDocId :866-868` |
| Seasonal leaderboard `tournamentLeaderboards/{YYYY-MM}` | One tx per month doc; entries keyed `entries.{uid}.weeks.{groupId}` and **SET, never incremented**; month total recomputed as Σ on every write; feeds computed outside the tx. 1 MiB whole-doc cap priced at ~3-5k rows. | `api/_utils/tournamentLeaderboard.js:369-414`, `:382`, `:391`, `:40-46` |
| Mastery award + profile (the closest "ledger + cached balance" precedent) | Write-once award doc guarded on absence **in the same transaction** that increments `masteryProfiles`; one tx body for every receipt path; owner-read/server-write rules. | `api/_utils/masterySettlement.js:407-451`, `firestore.rules:988-992` |
| Chat budget `agentChatBudget/{groupId}_{uid}_{dayN}` | Own top-level collection, transactional read-check-increment as the double-spend guard; "never a field on the battle doc" (fence-as-concept). | `api/_utils/agentChatBudget.js:1-30`, `:105-119` |
| Orchestrator state | Transactional read-fresh `tx.set` so concurrent writers never lose a marker. | `tournamentOrchestrator.js:182-191` |
| Held-set ledger | Sibling doc `tournamentGroups/{id}/ledger/agentHeldSet`, whole-doc `tx.set` because symbol keys contain dots. | `api/_utils/tournamentAgentLedger.js:8-11`, `:32-35` |

**Ordering relative to placements:** RP is applied from `runWeekSideEffects` (`tournamentAdvancement.js:473-491`) **after** the bracket lock (`:651-665`) and **before** the `sideEffectsAt` stamp and group completion (`:679-682`). The sweep re-applies from the bracket doc alone (`applyLockedGameToRanks` `tournamentRank.js:129-152`).

**Convention to mirror for the wallet:** per-entity doc + an idempotency map keyed by the source id (`poolId` for payouts, `(bracketId, round)` for floors) + whole-doc transactional set + dev namespace + a capped `history`, with the balance recomputed from entries on every write, the leaderboard's Σ-over-weeks discipline.

**Confidence:** confirmed.

### Q14. Flag conventions (added).

- **Registry shape** `src/config/flagPinGuard.test.js:58-145`: `const DARK_BY_DESIGN = { FLAG_NAME: 'one-line runway note', … }`. Integrity test `:302-314` requires each key to exist in a `FLAG_SOURCE_MODULES` file (`:45-49`: `featureFlags.js`, `compositionConfig.js`, `tournamentOrchestrator.js`), be `false`, and carry a note. The scanner regex at `:155` is `^export const ([A-Z][A-Z0-9_]*_ENABLED)\s*=\s*(true|false)\s*;` so **the flag must be named `*_ENABLED`**.
- **Pin format** `:185`: `expect(FLAG).toBe(false)` in any `*.test.js` under `src/` or `api/`; the definition must carry `// Pinned by: <file>.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).` directly above the export, checked at `:316-320`; example `featureFlags.js:2284-2285`.
- **Precedent to copy, `SHOW_IT_ENABLED` (Phase C, merged 2026-09-09):** docstring with FLIP MAP `featureFlags.js:2240-2283`, pin `:2284`, export `:2285`, call-time read rule `:2256-2258`; pin suite `src/config/showItFlags.test.js:1-46` (pins only this flag, `:12-14`; asserts the docstring names the suite, FLIP MAP and DARK_BY_DESIGN, `:36-45`); registry entry `flagPinGuard.test.js:98-99`; flag-off darkness suite `api/agent/research.dark.test.js:1-40` mocking the flag to explicit false; the route 404s while dark, after auth, `api/agent/research.js:197-201`. Commits: `1077806a` (flag + pin + registry + client doors), `3989182c` (route + tests), `c0ca95e5` (dark suite + copy guard rows).

**Confidence:** confirmed.

### Q15. Spectator surface inventory (added).

| Surface | File / export | Data source | Props | Renders for a non-participant? |
|---|---|---|---|---|
| League landing (mobile) | `src/components/League/LeagueHome.jsx` | `useLeagueState` → real adapter (`useLeagueState.js:36-57`, `useRealLeagueState.js:9-15`) | `{onOpenMyGame, onOpenTrainingPod, hasAgent, agentLoadout}` | Yes, any signed-in user |
| League landing (desktop) | `LeagueLobbyDesktop.jsx` (`:227`, `:254`, `:262` spectate hooks) | same | same + rails | Yes |
| Bracket funnel | `LeaguePod.jsx:194-225 Funnel({st, onPick})`; `LeagueLobbyRedesign.jsx:162-185 BracketFunnelSection` | `st.rounds` from `mapBracketToRounds` (`leagueAdapter.js:303`) ← `subscribeBracket` keyed off the **viewer's own group's** `bracketGameId` (`useRealLeagueState.js:86`) | `{st, onPick}` | Structurally yes; **inferred** empty for a viewer with no active group, because no bracket id is resolved |
| Group view / pod | `LeaguePod.jsx:74-113 PodCard({pod, accent, onSpectate})`, `:33-71 PodRow({seat,…})`, `:229-260 PodSheet` | `groupToPod` (`leagueAdapter.js:223`) / `bracketGameToPod` (`:266-292`); seat via `buildSeat` `:180-200` | see cells | Yes; other pods' seats carry `battle: null` (`:279`, `isMine` gate) |
| Spectate (two-layer read-only) | `LeagueSpectate.jsx:138 Spectate({pod, focusId, accent, onBack, onEnter})` | pod seats; reasoning lock `isReasoningLocked` (`leagueFixtures.js:195-197`, status ≠ `'final'`) | as listed | Yes; `FilmRoom :71-114` shows fixture text when unlocked (`:109`) |
| Battle books for spectators | `src/hooks/useSpectatedTournamentBattles.js:21` (60s poll of `GET /api/tournament/battle-view`) | server projection `api/_utils/tournamentBattleView.js:86-103` | `(groupId, enabled)` | Yes for the group queried; the real adapter queries only `myGroup?.id` (`useRealLeagueState.js:99`) |
| Results-and-review | `src/components/Tournament/RoundBoundaryView.jsx:20 ({bracket, uid, boundary, rankDoc, onContinue})` | `resolveRoundBoundary` (`src/utils/roundBoundary.js:40-73`) over the bracket doc; rank doc fields `tier`/`tierName`/`rp` (`:77-78`) | as listed | **No**: requires the viewer's own seat in a completed game (`roundBoundary.js:26`); eliminated players still get it via a localStorage bracket-id fallback (`LeagueParticipantView.jsx:145-148`, mount `:186-197`) |
| Film Room recap | `battleArena/FilmRoomRecap.jsx:71 ({history})`, doorway `LeagueRecapEntry.jsx:25 ({group, battleChain, uid})` | `buildScoreHistory` over the viewer's **own** completed group + battle chain | as listed | No |
| Legacy P6b spectator | `src/components/Tournament/SpectatorView.jsx:22 ({group, uid, onBack})` | `spectatorBattleSummary` (`src/utils/tournamentSurfaces.js:220-240`), `subscribeBracket`, battle-view endpoint | as listed | Yes, but no production mount found (dev screen), **inferred** |
| Leaderboard / rank cards | `LeaderboardCard.jsx:19 ({uid, dev, initialMonthKey, onOpenGroup})`, `RankCard.jsx:16 ({docId, dev, label})` | `subscribeLeaderboard`/`subscribeRank` (`src/services/tournamentGroupService.js:425-446`) | as listed | Yes; dev-screen mounted (`LeaderboardCard.jsx:3`) |

**Mount points:** Team Card per `PodRow` (`LeaguePod.jsx:44-70`) and as the focus panel in `Spectate`; pool ticker in the `PodCard` header (`:74-113`) and `PodSheet` (`:258`); "Backing open" chip on `FunnelNode` inside `Funnel` (`:194-225`) and on the `PodCard` status row. A **spectator-facing results card has no home today**: `RoundBoundaryView` is participant-only, so PR 5's results card needs a spectator surface (the `Spectate` final state is the natural one).

**Confidence:** confirmed except the two inferred cells.

---

## 3. Spec-vs-code contradictions

Each row quotes the spec line, cites the code, states the consequence.

**C1. §1 CPU identity (spec `:31`, `:34`).** Compatible (Q4). Complication only: `cpu-{n}` recurs across rounds and across concurrently formed base-layer groups, so a stake must always carry the full tuple; and every CPU shares one `equippedConfigHash`, so the "loadout changed" marker is meaningless for CPUs.

**C2. §4 "Opens at bracket reveal" (spec `:71`).** Bracket reveal is not a discrete event. For rounds ≥ 2 it is the `rounds.r{N+1}` write in `finalizeRound` (`tournamentAdvancement.js:835-843`), which happens only after **every** game in the round is locked (`:714`), Friday evening after ~17:15 ET banking or Monday morning in the catch-up (`tournamentOrchestrator.js:505`). The client "reveal" is `RoundBoundaryView`, derived from the bracket doc per viewer and acknowledged locally (`roundBoundary.js:40-73`; `LeagueParticipantView.jsx:160-167`). For round 1 there is no production reveal at all (V1). **Consequence:** pool-open for R2/R3 = the composition write, inside the same duty pass as resolution of the prior round; R1 pools need a separate opener that does not exist in production.

**C3. §4 "Closes at the group's first battle open (Monday pre-open). Draft results are visible during the window" (spec `:72`).** The Monday pipeline resolves the user draft, produces boards, resolves the agent draft and fans out deploys **in one tick** (`tournamentOrchestrator.js:553-632`), the first tick being 11:00 UTC = 7:00 EDT / 6:00 EST. Deploy creates the battle doc `status: 'active'`, `activatedAt: now` (`agentBattleService.js:132-140`), so "first battle open" by doc is ~7:00-7:30 ET, minutes after drafts become visible. Ranked groups receive no `startAnchor` (`resolve-user-draft.js:183-186`, training only), so `isPreOpenOnBattleDay` returns false for them (`tournamentTime.js:125-132`). **Consequence:** D-c's "drafts visible" window is either minutes long, or "first battle open" must be defined as 09:30 ET on the group's Monday, which needs a date source (the agent-draft stream's `resolvedAt` at `tournamentOrchestrator.js:461-479`, or the first battle's `activatedAt` plus the 09:30 constant). Eval ticks start 13:00 UTC (`vercel.json`, entry 29); nothing scores before 09:30 either way.

**C4. §4 hash-at-stake / hash-at-open (spec `:74`).** Persisted per battle at birth (Q3). "At stake time" on a weekend requires computing from the `agents` doc through the manifest builder and its customization kernel, or accepting the last battle's birth hash as "current". **Consequence:** PR 2 needs a `currentEquippedConfigHash(agentId)` helper; inferred cost is one agents-doc read plus a pure kernel.

**C5. §4 "marker fed by Signal Capture Rider event #8" (spec `:74`).** Event #8 is not persisted anywhere (Q3). **Consequence:** the marker is `hashAtStake !== currentHash`; no event feed to read.

**C6. §3 "Ties: the tournament's own advancement tiebreak applies first. If still tied, the winner share splits equally" (spec `:62`).** `rankByScores` (`leagueTournament.js:845-849`) always produces a strict order by seat position, so "still tied" is unreachable; equal composites are decided by draft order. **Consequence:** ruling: winner = `ranking[0]` (tournament-consistent; a backer can lose a coin flip they cannot see) **or** winner set = every seat whose `finalScores` equals the max (spec intent; requires the backing layer to define equality on `round2` values, `leagueTournament.js:802-804`). Note `finalScores` are composites rounded by `computeComposite`, not `round2`, at the lock (`tournamentAdvancement.js:108`).

**C7. §6 "`masteryProfiles/{userId}` (tier/RP)" (spec `:111`).** Wrong collection. RP and tier are `tournamentRanks/{odUserId}` (`tournamentRank.js:72`, `leagueTournament.js:798,866-868`; tier table `:955-963`; placement bonuses `:970`); `masteryProfiles` holds archetype XP/levels (`masteryConfig.js:132`, `firestore.rules:985-992`, owner-read). **Consequence:** the Team Card's "career tier/RP" reads `tournamentRanks` (authed read `:568-571`, client `subscribeRank` `tournamentGroupService.js:439-446`); the trainer carry display on "the player's own profile" has no existing per-user profile doc for rank, so it lands on the wallet doc or a rank-adjacent card.

**C8. §6 "Pools are publicly readable" (spec `:110`).** Every tournament rule requires `request.auth != null` (`firestore.rules:531-583`); no unauthenticated read exists in the file for these collections. **Consequence:** ruling: authed-read (house pattern, zero precedent risk) or true public (new pattern, also exposes pot sizes to crawlers).

**C9. §7 "co-tenant with whichever job writes the new round's `tournamentGroups`" (spec `:119`).** That job exists only for rounds ≥ 2 (`finalizeRound`), and only for brackets. Round 1 in production has no writer (V1); base-layer groups have no boundary. **Consequence:** PR 2's pool-open co-tenant is inert until a production bracket launch path exists, and R1 pools need their own opener (the same call from wherever R1 groups get written).

**C10. §7 "co-tenant with the Friday scoring/advancement job" (spec `:121`).** Two crons: scoring is banking on `snake-draft-daily-scores` at 21:15 UTC; placements lock in the orchestrator's Friday duty (Q12). **Consequence:** resolution rides the orchestrator, specifically `runWeekSideEffects`, not the scoring cron; and it inherits the "banking pending" wait and the Monday catch-up.

**C11. §1 "Resolution = the group's round winner by the weekly composite that already decides advancement" (spec `:33`).** The composite is the day-5 clamped snapshot (`getWeeklyComposite` `leagueTournament.js:1340-1345`). Locks are **refused** on a degraded final (`isFinalSnapshotDegraded` `:1378-1385`; `tournamentAdvancement.js:646-650`, manual review, no self-heal), while frozen (`:282-301`, `TOURNAMENT_ADVANCEMENT_FROZEN` `featureFlags.js:1143`), and on holiday weeks day 5 never banks (`:42-45`). A BATTLE group can be **voided** with no result (`GROUP_STATUS.VOIDED` `leagueTournament.js:107-115`; `voidGroup` `tournamentGroupService.js:248-264`). **Consequence:** `resolving` must be able to stay open indefinitely and `refunded` must be reachable from a void, from an admin decision, and from a never-locked game; the "winner had zero backing" refund is not the only refund path.

**C12. §5 "Loadout summary: archetype and equipped trait names" (spec `:85`).** The P7 projection treats `equippedBundleIds`, `activeRules`, `equippedWatchlist` as WHY and conceals them on live battles (`tournamentBattleView.js:41-45`; archetype is public at `:45`). But the `agents` doc is readable by any signed-in user (`firestore.rules:224-225`), rule contents included, so a client Team Card could read trait names, and rules, directly today. **Consequence:** ruling on the transparency source of truth; if the P7 allowlist is the contract, the Team Card must read trait names through a server projection (a `team-card` endpoint on the `battle-view` precedent) and the agents-doc read exposure is a pre-existing gap to note, not fix here.

**C13. §2 "Floor top-up at each round boundary" (spec `:44`).** No base-layer boundary, no user enumeration (Q10). **Consequence:** lazy floor.

**C14. §10 telemetry events (spec `:147`).** No telemetry sink exists. The front-end seam `src/services/leagueSignals.js:27-45` never persists (the persist call is commented out at `:39`; gated `isFixtures || !uid`). Server-side catalog events are domain-doc writes: flips onto `group.feed` (`api/tournament/flip.js:193-206`), claims into the `claims` subcollection (`tournamentClaimPlacement.js:12-14`), learning receipts into `learningReceipts/*/receipts` (`api/_utils/learning/captureReceipt.js:407-409`), all awaited (BUILD_RULES §5). **Consequence:** PR 5 must define where `stake_placed` et al. persist (fields on the stake/wallet entries, or a `backingEvents` subcollection) and must not rely on `logLeagueSignal`.

**C15. §12 "Flag `BACKING_BETA`" (spec `:177`).** Must be `BACKING_BETA_ENABLED` (Q14).

**C16. §5 "Backer leaderboard: seasonal (monthly reset, like the MVP board)" (spec `:95`).** The MVP board is one month-keyed whole doc with a documented 1 MiB ceiling (`tournamentLeaderboard.js:40-46`). Fine at beta scale; a per-user wallet query (`seasonNet` field + index) avoids inheriting the cap.

**C17. §0 "8 of 16 are eliminated after week one" (spec `:24`).** Consistent with the bracket shape: adjacent-game pairing (`pairAdvancers`), terminal round = one game (`:724`), funnel labels 16/8/champion (`LeaguePod.jsx:205`). R1 = 4 pools, R2 = 2, R3 = 1 holds.

**C18. §4 "the prior round's Film Room has unlocked" (spec `:71`).** True but five-fold: each team's round is five daily `fullday` battles (`agentBattleService.js:35`), each unlocking at its own close, day 5 on Friday evening after the batch review (entry 39, 20:25/21:25 UTC). The Team Card's "last round's Film Room" is five battle docs.

---

## 4. Risks and surprises

**R1. No production bracket.** Restated from V1 because it changes §12: PR 2 and PR 3's co-tenant hooks would run on nothing until a production round-1 bracket writer exists. The live product is the base-layer field via the lobby (`LEAGUE_LOBBY_ENABLED = true` `featureFlags.js:149`) plus dev-seeded brackets (`isDev`, excluded from production duties by `fetchEligibleGroupsByStatus` default, `tournamentOrchestrator.js:515-516`, `tournamentAdvancement.js:241`). The August structure ruling moved seasonal scoring to a weekly ladder on the monthly board (`featureFlags.js:1145-1202`, dark). Sequencing question for the founder, not a task.

**R2. Eval-tick deferral at 16 concurrent battles.** Code state: `maxDuration 300`, `TIME_BUDGET_MS 290_000` (`agent-evaluate.js:130-139`, "Mitigation, not architecture"), fair-rotation ordering (`:322-334`), the deferral log line (`:339-343`), a per-call reservation of the 22s Haiku ceiling plus post-call allowance (`agentEvalTransport.js:14,80-88`), `maxRetries: 0` (`:144-154`). Arithmetic: roughly 34s per triggered battle funds ~8 triggered battles per 15-minute tick; 16 tournament battles plus organic load can still defer. Repo evidence: the June audit's analysis (`docs/audits/2026-06-10_TOURNAMENT_DESIGN_AUDIT.md:80,117`), the mastery discovery's "E3 CONFIRMED" (`docs/ARCHETYPE_MASTERY_DISCOVERY_REPORT_V1.md:47`), the watch ledger's "watch after the flip: agent-evaluate deferral rate" (`docs/LAUNCH_READINESS_WATCH_LEDGER.md:116-118`), the P4 checklist item 7 "deferral count" (`docs/audits/2026-06-12_P4_STAGE0_FENCE_EDIT_MAP.md:171`). **No measured production deferral count since the July raise is in the repo, and logs are not reachable from this session.** Status: mitigated, unmeasured. Per spec `:190` this is the founder's call before PR 3.

**R3. Emergency freeze exists.** `TOURNAMENT_ADVANCEMENT_FROZEN` withholds locks, rank, leaderboard and composition (`tournamentAdvancement.js:264-301`, belt `:457-465`; leaderboard `tournamentLeaderboard.js:312-333`). Resolution inside `runWeekSideEffects` is covered by the belt automatically; anywhere else it must add its own guard.

**R4. Pools that never resolve.** Degraded final (manual review), holiday week (day 5 never banks), void (`voidGroup`), G2 casual-battle block leaving a team with no agent battle for a day (`tournamentOrchestrator.js:425-441`; `docs/LAUNCH_READINESS_WATCH_LEDGER.md:17-22`). Each needs a refund or admin path; the `run-duty` endpoint with `simulatedNow` (`api/tournament/run-duty.js:1-22`, `parseSimulatedNow` `tournamentTime.js:142-152`) is the re-run precedent, and dev markers live in a `sim:` namespace (`tournamentOrchestrator.js:133-140`) that a backing re-run must respect.

**R5. Live WHY exposure through the `agents` doc.** Any signed-in client can read `activeRules` and `equippedBundleIds` of any agent (`firestore.rules:224-225`), which is exactly what the P7 allowlist conceals on battle docs. Pre-existing; the Team Card would make it a product surface. Report-only.

**R6. Spectators without a group see an empty bracket.** The real adapter resolves the bracket id from the viewer's own group (`useRealLeagueState.js:86`) and fetches spectated battles only for `myGroup` (`:99`); `RoundBoundaryView` uses a localStorage fallback for eliminated players (`LeagueParticipantView.jsx:145-148`). A backing surface for eliminated and never-registered spectators needs a bracket source independent of "my group" (e.g. `tournamentBrackets where status == active`, single-field auto-index). Inferred from the header and call sites.

**R7. Flag naming and registry.** `*_ENABLED` suffix required (`flagPinGuard.test.js:155`); the flag must live in a `FLAG_SOURCE_MODULES` file (`:45-49`); server reads at call time, never module scope (`featureFlags.js:2256-2258`), which the spec already says.

**R8. Tick budget.** Both co-tenant hooks run inside the orchestrator's 270s deadline with no per-cohort budget check in the Friday duty (Q12). Pool-open is 2-4 pool docs per round; resolution is one tx per pool plus N stake updates. Bounded at beta scale, but every hook must be inside the per-game try/catch posture (`tournamentAdvancement.js:630-696`) so a backing failure withholds the duty marker (`tournamentOrchestrator.js:901-917`) rather than aborting siblings, and must never make `runWeekSideEffects` return `false` for a rank/leaderboard-clean week unless the founder wants payouts to gate completion.

**R9. Firestore rules and indexes are manual.** Rules deploy via Console (`firestore.rules:525-530`; runbook `:21-27`); indexes are Console-created with a dual-write note (`test/rules/equippedConfigHashQuery.rules.mjs:9-16`). PR 1's rules are inert until deployed; the emulator suite `npm run test:rules` cannot run here.

**R10. Month-doc cap precedent** (`tournamentLeaderboard.js:40-46`), see C16.

**R11. Ties on composite equality** (C6).

**R12. Baseline blocked** (§6).

**R13. Dev namespace.** Rank and leaderboard route dev-sourced weeks to `dev-` ids (`leagueTournament.js:860-868`; `tournamentLeaderboard.js:346`); pools and wallets need the same routing or a dev bracket smoke could pay real BP.

**R14. Unrelated, report-only, left for separate tasking (BUILD_RULES §3).** (a) `LeagueSpectate.jsx:109` renders fixture `REASONING` text in the unlocked film room even on real data. (b) `src/services/leagueSignals.js:39` persist path is commented out; front-end Signal Capture is log-only. (c) `api/cron/snake-draft-daily-scores.js` exports no `config.maxDuration` while carrying four tournament branches. (d) The `agents` read rule exposure in R5.

---

## 5. Proposed touch list (no code)

Naming follows the existing `api/_utils/tournament*.js` / `src/components/League/*` conventions. Constants go in a new zero-import module, not `src/constants/leagueTournament.js`, whose `TOURNAMENT_TUNING` shape is test-locked (`:965-966`).

| PR | Create | Modify |
|---|---|---|
| **1** Wallet + ledger + floor, rules, ledger math tests | `src/constants/backing.js` (+`.test.js`; floor/min/cap/rake in bps, forbidden lexicon, the one fine-print string); `api/_utils/backingWallet.js` (+`.test.js`; tx, `entries` subcollection, `lastFloorRound`, dev namespace); `src/config/backingBetaFlags.test.js` (pin); `test/rules/backingDenials.rules.mjs` | `src/config/featureFlags.js` (`BACKING_BETA_ENABLED = false`, docstring with FLIP MAP, `// Pinned by:`); `src/config/flagPinGuard.test.js` (`DARK_BY_DESIGN` entry); `firestore.rules` (`backingWallets/{userId}` owner-read + `entries` owner-read, `backingPools` authed-read, `backingStakes` owner-read, all `write: if false`); `firestore.indexes.json` (stakes by `userId`+`poolId`, `poolId`+`status`) |
| **2** Pools + stake endpoint + integrity + pool-open co-tenant | `api/_utils/backingPools.js` (+`.test.js`; open/close, hash-at-open via `resolvedAgentManifest.js` call); `api/_utils/backingEligibility.js` (+`.test.js`; own-group check on `groupMembers`, one-completed-battle via the `ownerId+status+completedAt` index); `api/tournament/backing-stake.js` (+`.test.js`, +`.dark.test.js`; `requireAuth`, 404 while dark after auth, one transaction, server-clock window, first-battle-active refusal) | `api/_utils/tournamentAdvancement.js` (`finalizeRound` after `:835-843`: open pools for `composedGroups`, own try/catch); `api/admin/seed-tournament-bracket.js` (R1 dev pools, dev namespace) |
| **3** Resolution + payout co-tenant, idempotency, admin re-run, fixtures | `api/_utils/backingResolution.js` (+`.test.js` with zero-winner-backing, tie, rounding, mid-resolution retry fixtures); `api/tournament/backing-resolve.js` (cron-secret/admin re-run on the `run-duty` precedent, `simulatedNow`, `sim:` namespace) | `api/_utils/tournamentAdvancement.js` (`runWeekSideEffects` third half, or a post-stamp pass keyed on `finalScores`; refund on VOIDED via a status read, not a `voidGroup` edit) |
| **4** Team Card + stake control + pool ticker + bracket chip | `src/components/League/backing/TeamCard.jsx`, `StakeControl.jsx`, `PoolTicker.jsx`, `BackingChip.jsx`, `backingCopy.js` + `backingCopy.test.js` (forbidden-terms guard on the `deskHonesty` shape); `src/services/backingService.js` (subscribe pool/wallet/stakes, POST stake via `fetchWithAuth`); `src/hooks/useBackingPool.js`; `api/tournament/team-card.js` (+`.test.js`; server projection of archetype + trait names + rank, if C12 rules that way) | `src/components/League/LeaguePod.jsx` (`PodRow`/`PodCard`/`PodSheet` mounts); `LeagueSpectate.jsx` (focus panel); `LeagueLobbyRedesign.jsx`, `LeagueLobbyDesktop.jsx`, `LeagueDeskParts.jsx` (chip); `src/components/League/leagueAdapter.js` (thread `poolId` per pod, or keep pools in the hook) |
| **5** Results card + backer leaderboard + carry display + telemetry | `BackingResultsCard.jsx`, `BackerLeaderboardCard.jsx`, `api/_utils/backingLeaderboard.js` (or a wallet-field query), `api/_utils/backingEvents.js` (awaited writes; no sink exists) | `RoundBoundaryView.jsx` (participant results), `LeagueSpectate.jsx` final state (spectator results), `RankCard.jsx` or the wallet card (carry display) |
| **Flip** | none | `featureFlags.js`, `backingBetaFlags.test.js`, `flagPinGuard.test.js` in one commit |

**Fence check against BUILD_RULES §1.** Files listed there: `api/agent/decide.js`, `agentSwapExecution.js`, `agentScoring.js`, `agentRiskManager.js`, `agentArchetypeConfig.js`, `agentBattleService.js`, `agentPromptAssembly.js`, `agentEvalPromptAssembly.js`, `agentGuardrails.js`, `archetypeScoring.js`, `tournamentUserScoring.js`. **Zero of the files above are fenced.** Fence-as-concept: no new key on the battle doc (the `agentChatBudget.js:1-13` posture), no scoring math (resolution reads `finalScores`), no `createAgentBattle` change. One hazard, not a fenced touch: archetype labels for the Team Card must come from existing helpers (`leagueAdapter.js:96 archetypeLabel`, `tournamentCpu.js:54 cpuAgentName`), because a **new direct importer** of `agentArchetypeConfig.js` trips the §2.3 import-boundary ratchet and must be recorded in `api/_utils/archetypeImportBoundaryBaseline.json` in the same commit. `resolvedAgentManifest.js` is non-fenced (its header `:1-8`).

Review threshold: PR 2 and PR 4 will each exceed 10 files; BUILD_RULES §2's multi-lens adversarial review with a `vite build` applies.

---

## 6. Baseline

Command: `npx vitest run` (the repo's `test:run` script is `vitest run`, `package.json`).

**Exit code: 1.** No `Test Files` line was produced. Verbatim from the log:

```
npm warn exec The following package was not found and will be installed: vitest@5.0.0
failed to load config from /home/user/TradeSeven/vitest.config.js

⎯⎯⎯⎯⎯⎯⎯ Startup Error ⎯⎯⎯⎯⎯⎯⎯⎯
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'vitest' imported from /home/user/TradeSeven/vitest.config.js.timestamp-1789010724578-631013d6da1bd.mjs
EXIT_CODE=1
```

Cause: `node_modules/` does not exist in this container (`ls node_modules/.bin/vitest`: no such file). The brief forbids installing packages, so no `npm ci` was run. npx fetched `vitest@5.0.0` into its own cache outside the repo (package.json pins `^4.0.17`); the repo tree is unchanged (porcelain empty after). The suite has 645 test files under `api/` and `src/`; CI runs it as `npm run test:run` (`.github/workflows/tests.yml`, cited at `flagPinGuard.test.js:12-13`), and `main`'s CI result at `65237e47` is the authoritative baseline until the implementation session, which may install, runs it.

---

## 7. STOP

Report delivered; a byte-identical copy was written outside the repo tree (session scratchpad) per BUILD_RULES §3 and offered for download. No branch, no commit, no repo file, no package install, no fixes. Founder rulings on spec §14 come next; nothing proceeds until then.
