# FantasyTrades — League Next Arc Implementation Spec — V1

*(Training mode · Training/Ranked tabs · real-data wiring · altitude standings · live-pulse)*

**Date:** June 15, 2026
**Scope:** the second League arc, built on the merged redesign (PR #510). Three things: (a) bind the fixtures-first redesign (**System 3**) to the real League Tournament data (**System 1**) via the `useLeagueState` adapter; (b) add a net-new no-stakes **Training** mode; (c) restructure the lobby into persistent **Training / Ranked** tabs, with the live-pulse replacing the follow rail. Presentation + adapter wiring + one bounded net-new server variant. **Touches none of the calibration fence.**
**Relationship:** sits under `FANTASYTRADES_LEAGUE_TOURNAMENT_DESIGN_FRAMEWORK_V2_1_AGENTIC.md`; continues the presentation-layer line from the first slice. Pairs with the **altitude-climb Design files** (sent to Claude Code alongside this spec).
**Grounding:** informed by the read-only discovery audit (`docs/audits/2026-06-15_LEAGUE_NEXT_ARC_DISCOVERY.md`) — the three-systems map, the daily-close data shape, the WHY-projection, the leaderboard composition, and the "Quick Play / Training" name collision (resolved in §2).

---

## How to use this document

1. Read this + the altitude-climb Design files, then run a **read-only Phase-0 discovery** of the unknowns in §8 — cite `file:line`, report branch/HEAD. **Hard STOP** for founder review. Contradictions come back as questions, not commits.
2. **One task = one branch** off current `main`; all phases continue on it. Branch-guard each prompt.
3. **The parent redesign flag (`LEAGUE_REDESIGN_ENABLED`) is already ON in production.** So this arc ships behind its **own new sub-flag, default OFF** (e.g. `LEAGUE_NEXT_ARC_ENABLED`), so per-phase merges to `main` stay dark and the live placeholder is undisturbed until a deliberate, post-preview-smoke flip. **Do not flip it in a build PR** (this is the lesson from PR #510).
4. `/code-review` mandatory at ≥10 files or ≥1,500 lines, with a durable artifact. Smoke on the Vercel preview before merge (pushed ≠ deployed). Founder merges.

---

## 1. What we're building — the three-systems bind

Discovery established three systems:
- **System 1 — League Tournament (real):** `tournamentGroups` + `agentBattles`; daily-close banking → `dailyScores.day{N}`; groups are bracket XOR `baseLayerWeek`; the lobby (`lobby-quickplay`/matchmake/create/join); the WHY-projection (`tournamentBattleView` → `/api/tournament/battle-view` → `useSpectatedTournamentBattles`); rendered today by `LeagueParticipantView` + `Flat6BattleView`. This is where the real data and contracts live.
- **System 2 — Legacy PvP + Dashboard training:** not on the League tab; **not touched** by this arc.
- **System 3 — Redesigned League UI (merged, flag ON):** `src/components/League/*` + `useLeagueState`, fixtures-first.

This arc binds System 3's surfaces to System 1's data through the single `useLeagueState` seam, adds the net-new Training mode, and restructures the lobby into tabs. Most of it is **wiring and derivation**; the only genuinely net-new build is the no-stakes Training pod variant (§5).

## 2. Locked decisions

- **Tabs: Training | Ranked**, persistent. (Today the Training/Ranked choice is a transient bottom-sheet `ActionLayer` — this is a lobby-shell + state refactor, not just a copy change.)
- **Training** = a no-stakes 5-day **solo-vs-CPU** game in the **real parallel-layer format** (1 human + 3 CPUs), **no cut, no ladder, and excluded from the leaderboard.** Pure practice. It still **banks its own daily closes** (for the standings view). The cold-start "click to start" lands here.
- **Ranked** = the competitive surface: the **bracket funnel** + the **base-layer field** + the **live-pulse**. **Both the bracket and the always-on base layer feed the leaderboard; only Training is excluded.**
- **Standings** = the **altitude-climb** (the new Design), reused across training / base / bracket. **The verdict — cut / advance / eliminate — is bracket-only**; training and base-layer Day-5 read as a plain finish (no cut).
- **Live-pulse** (Ranked surface, in the old follow-rail slot) = **top mover + tightest cut**, derived from the live standings/leaderboard reads. **BaggerBomb-hit highlights are deferred** — there is no league-wide intraday event firehose; revisit post-launch.
- **Corrections preserved (must not regress):** never show a multiplier/ratio/formula for how the two layers combine; no cut in training or base-layer.
- **Real data via the adapter:** `useLeagueState` binds the surfaces to System-1 reads. Fixtures remain the test harness + the cold-start fill levels.
- **Film-room reasoning** routes through the WHY-hidden projection (`useSpectatedTournamentBattles`); `LeagueSpectate` needs no change — its `isReasoningLocked` predicate already mirrors the server gate.

## 3. Surfaces

- **The Training/Ranked tab-switcher** — persistent tab state in `LeagueHome` (today `'lobby'|'spectate'`); restructure the `LeagueLobbyRedesign` sections accordingly.
- **Ranked surface** — the funnel (bracket) + the field (base-layer) + the live-pulse (in the `FollowRail` slot).
- **Training surface** — the cold-start "click to start" empty seat → a training pod; the altitude-climb standings for that pod (no cut).
- **The altitude-climb standings** (the new Design) — one chart reused across all three contexts, the Day-5 verdict context-gated.
- **Spectate film-room** — WHY-sourced from the projection.

## 4. Data contracts / the seam

- **`useLeagueState` adapter:** flip `isFixtures` → real; map the System-1 reads (`subscribeBracket` / `subscribeGroup` / `subscribeMyGroup` / leaderboard, `useSpectatedTournamentBattles`) onto the Pod / Seat / BookItem shapes the surfaces already consume. The §-contract stays the component interface; only the hook's internals change.
- **Standings:** read `tournamentGroups.dailyScores.day1..5`; `closeScores[uid].totalPoints` / `compositePoints` = the **cumulative** standing at that close; **weekly = the final day's snapshot, never a re-sum.** Plot the cumulative per-day standing. **Do not reuse the legacy `AltitudeMap` / `DailyScoresModal` verbatim** — they read legacy `dailyData`, a different field on a different system; the climb chart must read `dailyScores`.
- **WHY-projection:** `tournamentBattleView` → `/api/tournament/battle-view` → `useSpectatedTournamentBattles` (owner/completed → full WHY; non-owner active → WHAT-only + `_whyConcealed`). Route spectate reasoning through this; never surface a live opponent's reasoning.
- **Leaderboard:** base-layer + bracket feed it; **`isTraining` groups are excluded** from the aggregation.
- **Live-pulse:** derive top-mover + tightest-cut from the live standings/leaderboard reads — no new firehose.

## 5. The net-new Training mode (bounded)

A no-stakes variant of the base-layer quickplay: a CPU-padded (1 human + 3 CPUs) **parallel-layer** pod, flagged `isTraining`, that **does not feed the leaderboard** and **does not ladder**. It still **banks its own daily closes** so the altitude standings render.

- **Reuses the base-layer machinery** — creation, CPU-padding, daily-close banking, and the agent layer via the **existing engine** (no fence changes). The net-new is only: the creation flag, the **leaderboard-aggregation exclusion**, and the "click to start" routing.
- **Precedent:** the Dashboard draft already carries an `isTraining` flag the crons filter on (`!data.isTraining`) — the same exclusion pattern, applied here to the leaderboard aggregation.
- **"Click to start"** = a front-door handoff (like `onOpenMyGame`): trigger the training-group creation, then route into the pod full-screen. This is net-new routing — the redesign's only real route today lands in the tournament participant view.

## 6. Phasing (one branch, behind the new sub-flag)

- **Phase 0 — Discovery (read-only, hard STOP).** Resolve §8 before any build.
- **Phase 1 — The adapter.** `useLeagueState` fixtures → System-1 reads (real field, bracket, your group, the standings data, the WHY-projection). Fixtures stay as the test harness + cold-start fill levels.
- **Phase 2 — Tab-switcher.** Persistent Training | Ranked state in `LeagueHome`; restructure the lobby shell (Ranked = funnel + field + pulse-slot; Training = the training surface).
- **Phase 3 — Training mode.** The net-new no-stakes pod (creation variant + `isTraining` + leaderboard exclusion) and the "click to start" front-door routing + the cold-start empty seat.
- **Phase 4 — Standings + pulse + WHY.** The altitude-climb standings reading real `dailyScores`, reused across contexts with the context-gated verdict; the live-pulse (top-mover + tightest-cut) in the follow-rail slot; the film-room WHY-sourcing swap.

Each phase: preview smoke, `/code-review` at the thresholds, founder merges (safe — dark behind the sub-flag). **Flip the sub-flag only when the arc is complete and preview-smoked.**

## 7. Signal capture rider (binding)

New surfaces (tab switches, training-start, pulse interactions) write events in writer-ready shape per the catalog in `VISION_PROGRAM_POST_LAUNCH_PLACEMENT_ADDENDUM_A §4`. The `leagueSignals` seam already exists and is correctly gated (real-data + real-user, awaited, not fire-and-forget). Reconcile the new event names against the catalog; keep the gating.

## 8. Phase-0 discovery questions

1. **Leaderboard-exclusion seam (the one that gates the net-new work).** Confirm `tournamentLeaderboard.js` (the aggregation) can cleanly skip an `isTraining`-flagged base-layer group, and that a training group still banks `dailyScores` (so the standings render). If it isn't a clean flag + exclusion, surface as a question before building.
2. **Training-group creation + routing.** Confirm `lobby-quickplay` / `tournamentLobbyActions` can carry an `isTraining` flag and form a no-leaderboard CPU-padded pod; confirm the "click to start" path — how the lobby triggers it and lands in the pod.
3. **Adapter mapping.** Confirm the System-1 reads map cleanly onto Pod / Seat / BookItem; identify gaps (presence/watchers; the inputs the live-pulse derivation needs).
4. **Live-pulse derivation.** Confirm top-mover + tightest-cut are derivable from the live standings/leaderboard reads without a new firehose.
5. **WHY-swap.** Reconfirm the one-hook swap — the adapter routes reasoning through `useSpectatedTournamentBattles`, `LeagueSpectate` unchanged.

## 9. Out of scope / constraints

- The **calibration fence** — untouched; training reuses the existing engine for its agent layer (no fence edits).
- **BaggerBomb-hit live highlights** and any **server-side league-wide event aggregation** — deferred (no firehose; revisit post-launch).
- **Legacy System-2** (Dashboard draft, PvP) — not touched.
- **Full desktop multi-column** — deferred (mobile column centered).
- **Constraint note:** training pods run real agent layers (engine compute / eval-ticks), so at scale they add to the cron / eval-tick budget (V2.1 §10) — fine pre-launch, worth monitoring as volume grows.
