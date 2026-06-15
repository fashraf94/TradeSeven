# League Next-Arc — Read-Only Discovery Audit

**Date:** 2026-06-15 · **Type:** Read-only discovery (no spec, no build, no edits)
**Branch:** `claude/awesome-darwin-rq1e6n` · **HEAD:** `0164659` (*Merge PR #510 — League redesign*) · **Tree:** clean
**Scope run against:** current `main` (the merged League redesign; `LEAGUE_REDESIGN_ENABLED = true`)

### Preamble / protocol notes (BUILD_RULES.md §3)
- **Read-only honored.** No project files were modified. This report file is the only write; a byte-identical copy was placed outside the repo tree (`~/2026-06-15_LEAGUE_NEXT_ARC_DISCOVERY.md`) per §3.
- **Git history is shallow** (270 commits, `.git/shallow` present). I did **not** unshallow — a current-`main` surface audit needs no history. Recorded here per §3.
- **Calibration fence (§1):** `api/_utils/agentScoring.js` was *read only* (grep + the `BAGGER_TIERS` import site). No fenced file was edited or called from a new site.
- **VERIFIED** = I read the cited line this session. **ASSUMED (sub-agent)** = surfaced by a research sub-agent and consistent with verified neighbors, but not personally re-opened at that exact line. Re-verify ASSUMED anchors before building on them.

---

## Executive verdict

| # | Item the next arc wants | Verdict | One-line truth |
|---|---|---|---|
| 1 | Training / "Quick Play" solo-vs-CPU pod (creation → draft → play) | **EXISTS (×2, different things) / ABSENT in the redesign** | Two unrelated "Quick Play"s exist server-side; neither is wired into the redesigned lobby. "Click to start" is **net-new routing**, not a one-line addition like `onOpenMyGame`. |
| 2 | BaggerBomb live-pulse ("X hit a TenBagger" intraday) | **PARTIAL — feasible but must be DERIVED** | Discrete "TenBagger" *event feed* exists only in the **legacy PvP** system. The **Tournament** path exposes `thresholdHistory` + badges live (60 s poll, per-group) — derivable, not a ready-made firehose. |
| 3 | Base-layer weekly groups ("the field") with real data | **EXISTS server-side / PARTIAL in UI** | Real `baseLayerWeek` groups exist and feed a real leaderboard. The redesigned "field" renders **100% fixtures**. |
| 4 | LeagueHome lobby structure + the follow-rail slot | **EXISTS** | Sections fully mapped. The follow-rail (`FollowRail`) is the exact slot a live-pulse would replace. A Training/Ranked tab-switcher is a **lobby-shell restructure**, not a drop-in. |
| 5 | Five-day daily-close standings shape (altitude climb) | **EXISTS (data) / ABSENT (view)** | Cumulative per-day-per-player shape is banked nightly in `tournamentGroups.dailyScores.day1..5`. No altitude-climb view reads it yet; the field name is `dailyScores`, **not** `dailyData`. |
| 6 | WHY-hidden projection wiring path (film-room lock) | **EXISTS (projection) / PARTIAL (lock is fixtures)** | The server WHY-projection + `useSpectatedTournamentBattles` are complete and live on the Tournament spectate surface. The redesign's film-room reads **fixture** reasoning. The swap seam is one hook. |
| 7 | Training feeds nothing (no cut, no ladder) | **CONFIRMED for one path / CONTRADICTED for the other** | Dashboard training (`createTrainingDraft`) feeds nothing — confirmed. But the redesign's "Quick Play" **copy** describes the lobby base-layer group, which **does** feed the leaderboard. Name collision — flagged. |

**Bottom line for the spec:** the *data and contracts* for the next arc largely exist (Tournament layer: groups, daily closes, WHY-projection, leaderboard, base-layer). What's absent is **wiring** — the redesigned surface is a fixtures-first shell joined to reality by exactly one seam (`useLeagueState`) plus one real bridge (`onOpenMyGame` → `LeagueParticipantView`). Three of the four asked-for features (live-pulse, altitude standings, real field) are **adapter-and-derivation** work, not greenfield. The training-pod "click to start" is the one genuinely net-new flow, and it sits on top of a **name collision** that must be resolved before it can be specified.

---

## The three-systems map (the spine — read this first)

The codebase carries **three** overlapping things that all say "league / draft / quick play." Conflating them is the main risk for the spec.

- **System 1 — League Tournament (the real build).** Firestore `tournamentGroups` + `agentBattles`. Snake-draft daily-close banking → `dailyScores.day{N}`. Groups are **bracket `XOR` baseLayerWeek**. Self-serve lobby (`lobby-quickplay/matchmake/create/join`). WHY-hidden projection (`tournamentBattleView.js` → `/api/tournament/battle-view` → `useSpectatedTournamentBattles`). Rendered by `LeagueParticipantView` + `Flat6BattleView`. **This is what the redesign's "Open my game" bridges into.**
- **System 2 — Legacy PvP BaggerBomb + Dashboard training.** Firestore `battles` (V4 PvP) and `drafts` (`createTrainingDraft`, `isTraining:true`). This is where the **discrete `events[]` "TenBagger" feed** and the **no-stakes training draft** live. Separate collections, separate UI (Dashboard/`DraftRoomScreen`), not on the League tab.
- **System 3 — The redesigned League UI (just merged, flag ON).** `src/components/League/*` + `useLeagueState`. **Fixtures-first**: every surface reads `leagueState(fill)` (`isFixtures:true`), never Firestore. Signal-capture is log-only while fixtures. The lobby's "Enter tournament" mode-picker (Quick Play / Ranked) is **presentation + signal only** — it creates no game.

> The next arc = bind **System 3's** surfaces to **System 1's** data through the `useLeagueState` adapter, and decide whether "Training" means **System 2** (no-stakes draft) or **System 1** (base-layer quickplay group). Those are different products with the same label.

---

## Item 1 — Training / "Quick Play" draft flow

**Verdict: EXISTS twice (two different things) · ABSENT from the redesigned lobby.**

There is no single "Quick Play." There are **three** referents:

**(1a) Dashboard *training draft* — solo vs 3 CPU, no stakes** — *VERIFIED*
- Creation: `src/services/draftService.js:134` `createTrainingDraft(userId, username, type)` → 1 human + 3 CPUs, `isTraining:true`, `status:'active'`, written to the `drafts` collection (`:203`).
- Entry points: `QuickPlayModal` (Dashboard) mounted at `src/components/Dashboard/DashboardLoop.jsx:667` and `DashboardDesktop.jsx:526`; `DraftTrainingScreen.jsx:121` calls `createTrainingDraft`; also `src/hooks/useDraft.js:339`.
- Play-out routing: `src/App.jsx:8894` mounts `DraftTrainingScreen`; on start it routes to `DraftRoomScreen` (App.jsx screen-state, `setScreen('draftRoom')`) — *ASSUMED (sub-agent)* for the exact `draftRoom` transition line.

**(1b) League lobby "Quick Play" — a *real* CPU-padded base-layer group** — *VERIFIED*
- `src/services/tournamentLobbyActions.js:46` `quickPlay()` → POST `api/tournament/lobby-quickplay.js:14`. The endpoint header (`:3-7`): *"open a private lobby and IMMEDIATELY form a CPU-padded **base-layer** group (one human + three CPUs), playable from the next Monday."*
- This forms a genuine **System 1** group (a `baseLayerWeek` group) that surfaces via `subscribeMyGroup` and opens the board flow in `LeagueParticipantView`. **It is not no-stakes** — see Item 7.

**(1c) The redesign's "Quick Play" mode option — inert** — *VERIFIED*
- `src/components/League/LeagueAction.jsx:66-71` `ActionLayer` renders a "Quick Play" (Solo·Training) option beside "Ranked Play" (`:72-77`). But `onPick` only flows to `LeagueHome.jsx:65` `pickMode` → sets `joined` + `signal('enter-mode')` and shows `JoinConfirm` (a "Seat reserved" screen, `LeagueAction.jsx:93-118`). **No `quickPlay()` / `createTrainingDraft()` call anywhere in the redesign.**

**Routing comparison (the asked question).** `onOpenMyGame` is a clean, real bridge: `LeagueHome.jsx:71` passes it to the lobby; `MyGameBar` (`LeagueLobbyRedesign.jsx:137-152`) calls it; `LeagueScreen.jsx:55,35-50` flips to `view:'mygame'` and pushes `LeagueParticipantView` full-screen. **A "click to start" into a training pod cannot reuse this**, because:
- The redesign's only real outbound route is `onOpenMyGame` → the *tournament participant* view (System 1), not a training pod.
- The training pod (1a) lives in a different screen tree (App.jsx draft screens, System 2) with no League-tab entry.
- The lobby quickplay (1b) *does* land in `LeagueParticipantView` via `subscribeMyGroup` — but only after a server round-trip that forms a group; it is not currently invoked from the redesign.

**What it would take.** Net-new: a handler analogous to `onOpenMyGame` that (decision required) either calls `lobbyActions.quickPlay()` and then pushes `LeagueParticipantView` (reusing the System 1 bridge), **or** stands up a training-pod surface over System 2. This is **routing + a real action call + a product decision**, not a one-liner.

> **Flagged question Q-1 (contradiction):** Three things named "Quick Play / Training" with different semantics (no-stakes draft vs leaderboard-feeding base-layer group vs inert UI copy). The redesign's `JoinConfirm` copy ("Your training group is ready… the draft runs Monday", `LeagueAction.jsx:109`) describes **1b** (a real base-layer group), while the kicker says "Solo · Training / No stakes" (`:67-68`), which describes **1a**. **Which one is the next arc's "training pod"?** The answer changes Item 7's "no cut, feeds nothing" premise.

---

## Item 2 — BaggerBomb live-event readability

**Verdict: PARTIAL — an intraday live-pulse is feasible, but on the Tournament (Ranked) surface it must be DERIVED, not read from a ready-made event feed.**

Two scoring worlds share one canonical scorer but differ sharply in *event surfacing*:

**Legacy PvP V4 (System 2)** — discrete event feed exists — *ASSUMED (sub-agent)*
- Threshold crossings are detected live (`src/utils/baggerBombUtils.js:127-153` `detectThresholdCross`; `:508-520` `createThresholdEvent`) and written to `battles/{id}/events[]` via `src/firebase/firebaseService.js:1283-1295` `addBaggerBombEvent`, on a ~60 s poll (`src/hooks/useBaggerBombBattleV4.js`). A live "X hit a TenBagger" feed is directly queryable here. Banked again at daily close by `api/cron/baggerbomb-v4-daily-scores.js`.

**League Tournament (System 1)** — badges + thresholds live, but no discrete event objects — *VERIFIED*
- Constants: `src/constants/baggerBombScoring.js` `BAGGER_TIERS` (bagger / doubleBagger / tenBagger). The Tournament battle view consumes them: `src/components/Tournament/Flat6BattleView.jsx:42,46,56-58` renders a per-asset "threshold progress" bar toward TenBagger and `badges`.
- The WHY-hidden projection makes the raw material **publicly readable for non-owners on active battles**: `api/_utils/tournamentBattleView.js:39` lists `scoring`, `scoreState`, **`thresholdHistory`** in `PUBLIC_TOP_LEVEL`, and `:48` puts `score` in the public `statusFeed`. Fetched via the 60 s-polled `/api/tournament/battle-view` per group (`src/hooks/useSpectatedTournamentBattles.js:21,38`).
- **There is no `tournamentGroups`/`agentBattles` equivalent of `events[]`** — no discrete "TenBagger event" object stream. The pulse would be derived by diffing `thresholdHistory` / badge transitions per battle.

**Freshness / queryability today.** On the Ranked (Tournament) surface: intraday data is **~60 s fresh, per-group** (the spectate hook fetches one group's battles). It is not a global, real-time, cross-group firehose. Daily banking closes at ~8 PM ET (cron) for the post-close record.

**What it would take.** A live-pulse "X hit a TenBagger" on a Ranked surface is feasible but requires (a) **deriving** crossing events from `thresholdHistory`/badge deltas, and (b) a cross-group fan-in if the pulse is meant to be league-wide (today's read is per-group). Reusing the PvP `events[]` feed would mean surfacing **System 2** data on a **System 1** surface — a cross-system bridge, not a wiring tweak.

> **Flagged question Q-2:** The "live pulse" as imagined ("X hit a TenBagger" intraday, league-wide) maps cleanly onto the **PvP** event feed but **not** onto the Tournament read-model, which is per-group and event-less. **Is the live-pulse meant to read PvP battles, or to derive from Tournament `thresholdHistory`?** If league-wide and intraday, neither path provides it off-the-shelf.

---

## Item 3 — Base-layer weekly-group data ("the field")

**Verdict: EXISTS server-side (real) · PARTIAL in the redesigned UI (fixtures).**

**Real, server-side base-layer groups** — *VERIFIED*
- The group schema is **bracket `XOR` baseLayerWeek**: `src/constants/leagueTournament.js:995-999` throws unless exactly one is provided; `:1009` writes `{ baseLayerWeek }`. Created by `createTournamentGroupDoc` (`:965`).
- Formed by the lobby (Item 1b): `api/tournament/lobby-quickplay.js` forms a CPU-padded **base-layer** group; matchmake/create/join siblings exist (`tournamentLobbyActions.js`).
- Read by the live participant view: `src/screens/LeagueParticipantView.jsx:53` `subscribeMyGroup`, `:159` renders `Base week ${group.baseLayerWeek}`.
- **Feeds a real leaderboard:** `api/_utils/tournamentLeaderboard.js:3` ("the seasonal leaderboard writer"), `:124` records `{ baseLayerWeek }` on entries, `:315` `aggregateTournamentLeaderboards`. *(:124/:315 VERIFIED via grep; full write path ASSUMED.)*

**The redesigned "field" is 100% fixtures** — *VERIFIED*
- `src/components/League/leagueFixtures.js:157-161` `BASE_GROUPS` (Vanguard / Meridian / Summit) → `:162-167` `baseGames`, hardcoded. The seam (`:15-17`) says real Firestore is mapped on "by a future adapter."
- `useLeagueState.js:28` returns `isFixtures:true`. The field section (`LeagueLobbyRedesign.jsx:184-193`) renders `st.baseGames` (fixtures) under copy "weekly base-layer groups … feed the leaderboard … don't ladder into the bracket" (`:189`).

**Can "the field" show real non-bracket groups of four?** Yes — the data exists (`tournamentGroups` with `baseLayerWeek`). Today it shows mock data because the adapter behind `useLeagueState` isn't wired.

**What it would take.** A read path: subscribe to base-layer `tournamentGroups` (+ projected battles) and map them onto the `Pod/Seat` fixture shapes inside `useLeagueState`. The contract shapes already match by design.

> **Flagged question Q-3:** The redesign's field copy asserts base-layer groups "feed the leaderboard." Server-side that's **real** (`tournamentLeaderboard.js`), but the UI shows fixtures — so the claim is *true of the system, not of what the user currently sees*. Confirm the adapter is in the next arc's scope so the copy isn't live-but-false.

---

## Item 4 — Current LeagueHome lobby structure (+ the follow-rail slot)

**Verdict: EXISTS — fully mapped.**

`LeagueHome.jsx` is a state machine (lobby ⇄ spectate, with pod-sheet / action / join overlays); it delegates lobby content to `LeagueLobbyRedesign.jsx` (`Lobby`). Render order (*all VERIFIED*, `LeagueLobbyRedesign.jsx`):

1. **MyGameBar** `:137-152` (rendered `:159`) — the **one real bridge** to System 1 (`onOpenMyGame`).
2. **EnterButton** `:14-36` (`:160`) — opens the `ActionLayer` mode-picker (Item 1c).
3. **LobbyHero** `:48-67` (`:162`) — headline + live/players/CPU stats.
4. **FollowRail** `:70-99` (`:164`) — **"Live now · people you follow"** horizontal presence rail, driven by `st.followLive`. **← this is the slot a live-pulse would replace.**
5. **The Funnel** `:167-179` — the bracket hero (16→8→4→1), `st.rounds` via `Funnel`.
6. **YourGroup** `:102-133` (`:182`) — your named pod micro-community.
7. **The Field** `:184-193` — base-layer `PodCard`s from `st.baseGames` (Item 3).

The follow-rail's data (`st.followLive`) is built in `leagueFixtures.js:170-176` (followed humans whose pod is live). Signal seam: `src/services/leagueSignals.js` logs `spectate-open / pod-tap / enter-tournament / enter-mode` — **log-only while `isFixtures`** (`:26`).

**What a Training/Ranked tab-switcher would touch.** Today the Training/Ranked split is a **transient bottom-sheet** (`ActionLayer`, Item 1c), not a persistent surface. A tab-switcher restructure touches:
- `LeagueHome.jsx:42,69-71` — add a Training/Ranked dimension to the `screen` state (currently `'lobby' | 'spectate'`).
- `LeagueLobbyRedesign.jsx` `Lobby` (`:156-201`) — decide which sections belong to which tab (e.g., bracket/funnel = Ranked; base-layer field + training = Training).
- The follow-rail slot (`:164`) — decide if the live-pulse is Ranked-only.
- Possibly `LeagueScreen.jsx` (the front door) and `leagueSignals.js` (new tab-switch events vs the §4 catalog).

**What it would take.** A lobby-shell refactor + a state-model decision (tabs vs the existing modal). The pieces (mode copy, section components) exist; their **arrangement** is what changes.

---

## Item 5 — Five-day daily-close standings shape (altitude climb)

**Verdict: EXISTS (data, banked nightly) · ABSENT (no altitude-climb view reads it).**

**The tournament inherits the snake-draft daily-close pattern — into its own field.** — *VERIFIED*
- `api/_utils/tournamentBanking.js:3-7` — "the **ONLY** writer of `tournamentGroups` `dailyScores`"; P6a adds the agent layer + composite in the same transaction.
- Write: `bankGroup` (`:286`) `tx.update(... [\`dailyScores.${dayKey}\`]: dayEntry ...)` (`:300-305`).
- **Cumulative-snapshot model** (`:9-13`): `dailyScores.day{N}.closeScores[odUserId].totalPoints` is the player's **cumulative standing at that close**; the weekly score is the **final day's** snapshot, **never a sum over days** — corroborated by `getWeeklyScore` (`leagueTournament.js:828-829`, reads the latest day's `totalPoints`) and `WEEK_DAYS_REQUIRED = 5` / `isWeekBanked` (`:850-854`).

**The real per-day shape that would feed an altitude climb** (*VERIFIED* at `tournamentBanking.js:245-253,262-274*):
```
tournamentGroups/{groupId}.dailyScores = {
  day1..day5: {
    closeScores: { [odUserId]: { totalPoints, picks, agentPoints, compositePoints } },  // totalPoints = cumulative standing at that close
    recordedAt, recordedBy, recordedDate, agentScoresCarried?
  }
}
```
A per-player altitude line = read `closeScores[uid].totalPoints` (or `compositePoints`) across `day1..day5`. The data is there per day.

**Naming caution (load-bearing).** The Tournament field is **`dailyScores`**, not `dailyData`. `dailyData.day{N}` is the **legacy PvP snake-draft** field (`drafts` collection). The task's "dailyData.day1–5" phrasing matches the legacy system; the tournament's is `dailyScores.day{N}`. The closest existing *altitude view* (`src/components/draft/AltitudeMap.jsx`, `DailyScoresModal.jsx`) reads the **legacy** `dailyData`, **not** the tournament's `dailyScores` — *ASSUMED (sub-agent)*.

**What it would take.** An altitude-climb standings view reading `tournamentGroups.dailyScores.day1..5` (per-player cumulative). Cron-ride of the nightly banking is `bankAllTournamentGroups` on the snake-draft handler — *ASSUMED (sub-agent)* `api/cron/snake-draft-daily-scores.js:471-479`.

> **Flagged question Q-5 (design note):** Because `totalPoints` is **cumulative standing** (not a per-day delta) and the **weekly** score is the **final day's** snapshot, an altitude-climb must plot the per-day cumulative values directly and must **not** re-sum days. Confirm the climb's y-axis is "cumulative standing at close," matching the banked model.

---

## Item 6 — WHY-hidden projection wiring path (film-room lock)

**Verdict: EXISTS (projection, fully live on the Tournament surface) · PARTIAL (the redesign's film-room reads fixtures).**

**The WHY-hidden projection is complete** — *VERIFIED*
- `api/_utils/tournamentBattleView.js:76-93` `projectTournamentBattle`: owner or completed → full doc; **non-owner active → allowlist WHAT-only**, stamped `_whyConcealed:true`. Allowlists (`:36-51`) deliberately exclude `innerMonologue / strategyBrief / activeRules / trade_reasoning / citedRules`, etc.
- `src/hooks/useSpectatedTournamentBattles.js:23-67` polls `/api/tournament/battle-view?groupId=…` (60 s) and returns `{ battles, loading, error }` (ownerId → projected battle).
- Consumed today on the **Tournament** spectate surface: `src/components/Tournament/SpectatorView.jsx:17,45` → `Flat6BattleView` reads `battle._whyConcealed` and renders the lock vs the monologue — *ASSUMED (sub-agent)* for the exact Flat6 lines.
- Battle selection helper `pickCurrentTournamentBattle` (`leagueTournament.js:480`) — *VERIFIED*.

**The redesign's film-room is fixtures** — *VERIFIED*
- `src/components/League/LeagueSpectate.jsx:71-114` `FilmRoom(player, locked)`: locked → redacted bars + "private reasoning stays sealed until the group completes" (`:90`); unlocked → `REASONING[player.id]` (`:109`), a **static fixture object** (`:22-39`).
- Lock rule: `:142` `isReasoningLocked(pod)` → `leagueFixtures.js:195-197` (`pod.status !== 'final'`). The file header (`:7-11`) names the future swap explicitly: *"When wired to real data, the server WHY-projection enforces the same gate; `useSpectatedTournamentBattles` already omits reasoning for live pods."*

**The wiring path (the asked question).** The film-room lock moves from fixtures to server in exactly one place:
1. `src/hooks/useLeagueState.js:28` — flip `isFixtures` to `false` and have the adapter map `useSpectatedTournamentBattles` (+ `subscribeBracket/Group`) battles onto the `Pod/Seat` shapes. (The seam comment at `useLeagueState.js:10-12` and `leagueFixtures.js:15-17` says this verbatim.)
2. The adapter supplies each seat's reasoning from the **projected** battle (present only when owner/completed) instead of the static `REASONING` map.
3. `LeagueSpectate.jsx` needs **no change** — `isReasoningLocked(pod)` already mirrors the server gate; the lock just starts reading server-sourced reasoning.

**Usage status.** `useSpectatedTournamentBattles` is wired **only** in `Tournament/SpectatorView.jsx`; it is **not** imported by any `src/components/League/*` file (grep clean). The redesign surface is deliberately unwired (fixtures-first sequencing).

> No contradiction — this is a clean, documented seam. The only watch-item: the projection is **per-group** and **60 s-polled**, so the film-room's "live" positions inherit that cadence.

---

## Item 7 — Training model (does training feed the ladder?)

**Verdict: CONFIRMED no-stakes for the *Dashboard training draft* · CONTRADICTED by the *lobby base-layer* path that shares the "training" label.**

**Dashboard training draft (System 2, 1a) feeds nothing** — *VERIFIED (writes) + ASSUMED (cron exclusions)*
- Results write only to `drafts/{id}` (`draftService.js:203`; completion updates the same doc — *ASSUMED (sub-agent)* `:1187-1199`).
- Scoring crons **exclude** training: `api/cron/baggerbomb-v4-daily-scores.js:321` and `compute-daily-baggerbomb-levels.js:296` filter `!data.isTraining` — *ASSUMED (sub-agent)*. No season/leaderboard/rank write. The "+10 XP" line in `DraftTrainingScreen` is UI copy with no writer — *ASSUMED (sub-agent)*. → **No cut, no ladder, ephemeral. Confirmed.**

**Lobby "Quick Play" base-layer group (System 1, 1b) DOES feed the leaderboard** — *VERIFIED*
- It forms a real `baseLayerWeek` `tournamentGroups` doc (`lobby-quickplay.js:3-7`), banked nightly (`tournamentBanking.js`), and aggregated into the seasonal leaderboard with a `baseLayerWeek` entry (`tournamentLeaderboard.js:124,315`). The base-layer is explicitly **no-cut / non-laddering into the bracket** (`leagueFixtures.js:154-156`, `LeagueLobbyRedesign.jsx:189`) — but it is **not** "feeds nothing": it feeds the **leaderboard**.

So "training has no cut and feeds nothing — the basis for the no-cut standings" is **half true**: *no cut* holds for the base layer; *feeds nothing* holds only for the **Dashboard** training draft, not the lobby base-layer group the redesign's copy points at.

> **Flagged question Q-7 (contradiction, ties to Q-1):** The no-cut-standings premise needs a single definition of "training." If the next arc's training = **base-layer quickplay**, it **does** feed the seasonal leaderboard (no cut, but it ladders into *standings*). If training = **Dashboard draft**, it feeds nothing but isn't on the League tab at all. These can't both be "the training pod" — pick one before the standings model is specified.

---

## Consolidated flagged questions (for founder review — not fixes)

- **Q-1 / Q-7 (same root):** "Quick Play / Training" names three different things (no-stakes Dashboard draft · leaderboard-feeding base-layer lobby group · inert redesign mode-copy). Which is the next arc's training pod? This decides both the "click to start" routing target and the "feeds nothing" standings premise.
- **Q-2:** The intraday "TenBagger" live-pulse exists as an event feed only in the **legacy PvP** system; the **Tournament** read-model is event-less and per-group. Is the pulse reading PvP, or deriving from Tournament `thresholdHistory` (and is it league-wide or per-group)?
- **Q-3:** The redesigned "field" claims it feeds the leaderboard; that's true server-side but the UI is fixtures. Confirm the base-layer read adapter is in scope so the copy isn't live-but-false.
- **Q-5:** Altitude standings must plot **cumulative standing at close** (banked model), not per-day deltas or a day-sum; the Tournament field is `dailyScores`, **not** the legacy `dailyData`.

## What is genuinely net-new vs wiring (for scoping)

- **Wiring / derivation (contracts exist):** real "field" (Item 3), altitude standings (Item 5), film-room server-sourcing (Item 6), live-pulse derivation (Item 2). All hang off the single `useLeagueState` adapter + existing System 1 reads.
- **Net-new + decision-gated:** the training-pod "click to start" flow (Item 1) and the Training/Ranked **persistent** tab-switcher (Item 4) — both blocked on resolving Q-1/Q-7.

---

## Provenance & sub-agent note
Items 4, 6, and the System-1 anchors (groups, banking shape, projection, leaderboard, lobby, signals, fixtures) were **read directly this session** (VERIFIED). Legacy-PvP internals (Item 2 `events[]`, Item 7 cron exclusions) and a few App.jsx/Flat6/DailyScoresModal lines are **ASSUMED (sub-agent)** — consistent with verified neighbors but not personally re-opened at the exact line. Four read-only research sub-agents (Quick Play, BaggerBomb, base-layer/daily-close, spectated-battles) were used for fan-out; their raw transcripts are not part of this record.

**HARD STOP.** No spec, no build, no code edits, no commit/push. This report is the deliverable.
