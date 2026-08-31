# Weekly Ladder — Phase 0 Discovery Findings

**Date:** 2026-08-31
**Serves:** `20260831_TOURNAMENT_STRUCTURE_RULING_V1` (weekly-primary ladder) · reads with `20260831_LEAGUE_BETA_READINESS_CHECKLIST`
**Type:** READ-ONLY discovery (BUILD_RULES §3). No code, no schema changes, no fenced edits. Hard STOP with findings.
**Branch / HEAD:** `claude/weekly-ladder-phase-0-sbj7t4` @ `fa6dfed7` — branch tip == `origin/main`, clean tree, **no commits made** (read-only).
**Fetch (BUILD_RULES §3):** `git fetch origin` run first. `origin/main` = `fa6dfed7` ("Merge #793 league-battleview-phase0-audit"). Main is at the **most recent league work** — it has NOT moved away from the league arc since the last league merge; the three most recent merges (#793, #790, #792) are all league/tournament work.
**Method:** 6 parallel deep-read lanes (one per question) + a `tournamentLeaderboard.js` lane, each independently **refuted** by a second agent, then a completeness critic. 6/6 lane cruxes CONFIRMED on independent re-read. The lead (me) independently read the four load-bearing files in full (`tournamentRank.js`, `tournamentLeaderboard.js`, the advancement finish-order + training branch, the rank/leaderboard schema functions) to guard against agent overclaim — one was caught (see §Q2).
All citations below are **VERIFIED** (read this session at HEAD `fa6dfed7`) unless marked ASSUMED. Line anchors re-verified against the brief's inherited hints (several had drifted).

---

## EXECUTIVE VERDICT

**The weekly ladder is NOT a green field. A substantial, wired, tested, idempotent ladder pipeline already exists** — built at P6a (founder-signed, June 12 2026) and live on existing crons. The brief's Phase-0 hypotheses (drawn from older audits) understate what is built. The real gap is **scoring semantics and a player-facing surface**, not machinery.

| # | Question | Verdict | One-line finding |
|---|---|---|---|
| Q1 | `tournamentRanks/{odUserId}` — what/writers/readers | **BUILT** | A player-keyed **lifetime career-RP** doc; one writer (`tournamentRank.js`), fired on Friday advancement; read by a **production** participant surface. NOT monthly-reset, NOT 3/2/1/0. |
| Q2 | Does `runFridayAdvancement` compute a group finish order? | **YES — exists** | A full 1-2-3-4 order is computed every Friday (`lockTopTwo`→`rankByScores`, sorted on the **day-5 clamped composite**). Per-seat placement is already derived and consumed. |
| Q3 | THE FIELD / `selectBaseLayerField` — what renders | **current-week only** | `selectBaseLayerField` is a recency sort; the wired FIELD is **current-ISO-week-scoped**. A live cross-pod weekly standing renders (composite-sorted), but **no cumulative/season standing** renders on the League path. |
| Q4 | Season / monthly reset concept beyond UI copy | **partial** | A **live monthly doc partition** exists (`tournamentLeaderboards/{YYYY-MM}`, "reset = new doc key"). But **no season-lock, boundary trigger, or reset job** — the "season locks" copy is just `!bracket`. Scrapped "Season Mode" is dead (C-19). |
| Q5 | Training + CPU exclusions | **confirmed** | Training pods skip the ladder entirely (plain finish). CPU seats **are** in the finish order (counting toward the human's placement) and **CPU rank docs are written** (frozen, display-only). |
| Q6 | Where a ladder writer would live | **rides existing cron** | Friday finalization = `runFridayAdvancement` on the `tournament-orchestrator` cron; the ladder already writes inside `runWeekSideEffects`. **Zero new crons needed.** Idempotency precedent is on the path already. |

### One-line classification (the deliverable question)

**A SMALL-TO-MODERATE BUILD — a re-scoring of existing, wired machinery, plus a surface. It is neither a pure read nor a full build.** The finish order, monthly-reset persistence, per-week rows, idempotency, training exclusion, CPU inclusion, and cron hosting **all already exist**. What is genuinely NEW is: (1) the ruling's **placement-points scoring (3/2/1/0)** — which does **not** exist in code today; (2) summing those points into the **monthly** doc (which today sums *composite*, the very thing the ruling rejects); (3) the **composite-margin-over-group-average tiebreak**; and (4) promoting a **player-facing season-ladder surface** (the reader component exists but is dev-screen-only).

**⚠ One requirements fork must be settled before build (see §Classification):** the ruling's ladder maps onto the **monthly `tournamentLeaderboards` doc**, NOT the lifetime `tournamentRanks` doc. Confirm that mapping — building it on the career-RP path would collide with the `cpuFarmGuard` the ruling overturns.

---

## Q1 — `tournamentRanks/{odUserId}`: what it is, what writes it

**It is a player-keyed (no `agentId`) career-rank doc — a single LIFETIME accumulator, not a period-scoped ladder.** The brief's anchor `tournamentRank.js:72` is exact: the write ref is `db.collection('tournamentRanks').doc(rankDocId(odUserId,{dev}))` (`api/_utils/tournamentRank.js:72`; collection const `src/constants/leagueTournament.js:798`; `rankDocId` `:866`).

**Document shape (top-level)** — written by the single `tx.set` at `tournamentRank.js:96-105`:
`odUserId` (str) · `displayName` (str, resolved, falls back to id) · `isCpu` (bool) · `rp` (num) · `tier` (1-7) · `tierName` (str) · `floorRp` (num) · `peakRp` (num) · `appliedGroups` (map `groupId`→event) · `history` (event[], capped at 20) · `createdAt` · `updatedAt`.
**Per-week audit event** (value in `appliedGroups.{groupId}` and each `history` element, `:85-94`): `{groupId, weeklyComposite, placement (1-based), cpuOpponents, raw, guard, delta (signed), rpAfter, appliedAt}`.
Fixture example (`tournamentRank.test.js:66-83`): alice, composite 60, placement 1, 2 CPU opponents → `rp≈53.33`, event `{placement:1, raw:160, guard:0.33, delta≈53.33}`.

**Writers (complete set):** exactly one Firestore writer — `applyGroupWeekToRanks` (`:53`, `tx.set` `:96`). `applyLockedGameToRanks` (`:129`) does no write itself; it rebuilds the ranking from a bracket entry's `finalScores` and delegates (`:144`). The **only production importer** is `api/_utils/tournamentAdvancement.js:85`, calling both inside `runWeekSideEffects` (`:476` bracket path, `:479` base-layer). Repo-wide grep finds no other writer; `firestore.rules:568` is `write: if false` (Admin-SDK only). **Firing event:** the **Friday advancement duty only, after a week is banked** — `runFridayAdvancement` (`:236`), gated on `isWeekBanked`. Never on daily banking, never client-side.

**Readers (NOT write-only):** `subscribeRank` (`src/services/tournamentGroupService.js:439`) feeds `RankCard.jsx` (dev screen, `TournamentDevScreen.jsx:865`) **and the production participant surface** — `LeagueParticipantView.jsx:144` → `RoundBoundaryView.jsx` reads `rankDoc.tier/rp` and the per-week delta from `appliedGroups[gameId]`.

**Period concept:** NONE. `applyRankWeek` (`leagueTournament.js:1005`) keeps `floorRp` permanent (never demotes, `:1013`) and `peakRp` all-time (`:1014`); `appliedGroups` retains every group-week key forever. No season key, reset marker, or rolling window. (The monthly concept lives in the **separate** `tournamentLeaderboards` collection — see Q4/LB.) `history` cap 20 is a display cap, not a boundary.

**Placement-shaped?** Placement (finish 1-4) and a signed `delta` exist **only inside per-week audit events**, not as top-level fields. No aggregate placement stat, no W-L record. Top-level is purely RP/points-shaped.

> **Bottom line:** the rank doc already carries per-week placement + composite in its audit trail, but it is a **lifetime RP ladder**, not the ruling's monthly-reset placement-points ladder.

## Q2 — Does `runFridayAdvancement` compute a group finish order? **YES.**

This is the highest-value answer, and it is decisively **yes — the finish order is existing machinery, not a new computation.**

- `runFridayAdvancement` has no inline finish-order comparator; it delegates the cut to **`lockTopTwo`** (`api/_utils/tournamentAdvancement.js:103`). `lockTopTwo` builds `finalScores[id] = getWeeklyComposite(group,id)` over **all** group members, computes a **full** `ranking = rankByScores(finalScores, members)` (`:111`), and returns `{ advancers: ranking.slice(0,2), finalScores, finalUserScores, ranking }`. **`advancers` is just the top-2 slice of the full order.**
- **What it sorts on:** each seat's `getWeeklyComposite` (`leagueTournament.js:1293`) = the **day-5 clamped composite** — `getLatestBankedDayEntry` returns the highest banked day with `dayN ≤ WEEK_DAYS_REQUIRED (=5)`, i.e. **the L-B Guard 2 clamp** (`:1258-1272`). Comparator: composite **DESC**, tie-broken by seat/draft-order index (`rankByScores` `:845-848`). This is exactly the value the ruling says placement should read.
- **Full 1-4 order available?** Yes. Base-layer groups pass the full `ranking` straight into the rank writer (`:479-483`). Bracket entries persist a **full 4-seat `finalScores` map**; the complete order is losslessly reconstructed via `rankByScores(finalScores, seatOrder)` — already done in three live sites (`applyLockedGameToRanks` `tournamentRank.js:143`; `finalizeRound` `:740`; `buildChampionRecap` `:170`).
- **Per-player placement already computed & consumed:** `applyGroupWeekToRanks` derives `placement = ranking.indexOf(odUserId)+1` for **every** seat (`tournamentRank.js:62`) — the exact 1-4 structure placement points need.
- **Persisted per completion:** each locked entry stores `advancers`, `finalScores` (full map), `finalUserScores`, `completedAt`, `sideEffectsAt`; the terminal game also writes `champion` + `recap`.

> **⚠ Correction to prior framing (caught by the lead + the completeness critic):** one discovery agent described this as feeding **"placement points 1st=3…4th=0."** **That 3/2/1/0 scheme does not exist anywhere in code.** The finish *order* exists; the ruling's placement-*points* *scoring* does not (see §Classification and Defect D-DESIGN-1). Do not read Q2 as "the ladder is already scored 3/2/1/0."

## Q3 — THE FIELD / `selectBaseLayerField`: what it renders

- **`selectBaseLayerField`** (`src/constants/leagueTournament.js:771`) — the brief's `~646` anchor drifted to **771**. It is a **pure recency predicate**: filter `isTraining !== true` and `status !== VOIDED` (`:776`), sort by **`updatedAt` DESC** (`:777`), slice to `max` (default 12). It carries **no week scoping and no score/rank sort of its own**. (Its own comment notes it **"INCLUDES CPUs by design"**, `:757`.)
- **Week scoping is one layer up**, in `subscribeBaseLayerGroups` (`src/services/tournamentGroupService.js:315`): the Firestore query is `where('baseLayerWeek','==', baseLayerWeek)` (`:322`), value `currentWeek = isoWeekString(new Date())` (`src/hooks/useRealLeagueState.js:52-54, 86`). So the wired FIELD is **strictly current-ISO-week-scoped** — a group whose stored `baseLayerWeek` ≠ the current ISO-week string is dropped by the equality match. **This is the mechanism behind the "surface went empty when a stale `baseLayerWeek` fell out of range"** the brief cites.
- **The live render** (`DeskLeaderboard`, `src/components/League/LeagueDeskParts.jsx:148-149`) sorts `st.field` by **current-week composite DESC** (`getWeeklyComposite`) — a rank-*shaped display over single-week data. So a live per-player weekly standing already ships, but it is current-week-only, composite-sorted (not placement), and non-cumulative.
- **A season ladder (cross-week cumulative) would require:** a different read. The cumulative *data* already exists server-side — the **monthly** `tournamentLeaderboards` doc (Σ-over-weeks, see LB) and the career `tournamentRanks` RP — but it is rendered only by `LeaderboardCard.jsx`, **mounted only on the dev screen** (`TournamentDevScreen.jsx:855`). If a "season" aligns to the existing **month** key, the monthly doc + a subscribe already provide the cumulative read; if it is a different multi-week block, a new aggregation would be needed.
- **Does any multi-week standing render today?** Only in the **separate Season product** (`SeasonLeaderboard.jsx` in `SeasonDashboard`, `App.jsx:9517`) — a different system from the League Tournament arc, and adjacent to the scrapped "Season Mode" (Q4). On the **League** path, nothing cumulative renders to players.

## Q4 — Season / monthly reset: does the concept exist beyond UI copy? **Partly.**

- **A LIVE month-level partition exists** on the ladder path: `tournamentLeaderboards/{YYYY-MM}` with helpers `monthKeyFromEtDate` (`leagueTournament.js:853`), `leaderboardDocId` (`:860`), `shiftMonthKey` (`:872`), written by the live `upsertLeaderboardForGroups`. **But it is a passive doc partition, not a reset:** the writer header states *"a monthly 'reset' is simply a NEW doc key — nothing is deleted"* (`api/_utils/tournamentLeaderboard.js:4-8`). Month attribution is per-group (ET month of the day-1 banking date), not a global boundary.
- **No season-lock / boundary trigger / reset job exists.** The *"THE MONTHLY BRACKET OPENS WHEN THE SEASON LOCKS"* copy is driven purely by `bracketPending = !bracket` (`src/components/League/leagueAdapter.js:399`) — a static string keyed off the *absence* of a bracket doc. Base-layer groups only transition to COMPLETE and never seed a bracket (`tournamentAdvancement.js:18-20`); bracket seeding is admin/dev-only (`api/admin/seed-tournament-bracket.js`). The exact "season locks" string has four non-test homes: `leagueAdapter.js:361`, `SlotCenter.jsx:32`, `WhileYouWait.jsx:195`, `LeagueDeskParts.jsx:402/404`.
- **`baseLayerWeek`'s month analogue:** the ISO-week string comes from `isoWeekString` (`leagueTournament.js:888` — the one home; **not** `tournamentTime.js`). The only month-level key is the leaderboard's `YYYY-MM` above.
- **Scrapped "Season Mode" is confirmed dead** (BUILD_RULES §6 / C-19): `seasonConfig.js` (`TOTAL_WEEKS: 4`), `seasonCalendar.js`, and crons `season-daily-evaluate.js` + `season-pit-stop-manage.js` are **unscheduled** (absent from `vercel.json`). Distinct from the live monthly leaderboard — see Defect D6 (terminology collision).
- **What a monthly reset would touch, if built:** the ruling's "reset monthly" is **already satisfied structurally** by the month-keyed doc (a new `YYYY-MM` doc *is* the reset). Nothing accumulates across months that a reset must clear — the month total is `Σ` the current doc's `weeks` map only. The genuinely-missing piece is not the reset but the **season-lock → bracket-seed** mechanism the UI promises (out of the weekly-ladder scope; it belongs to the post-beta bracket, B2).

## Q5 — Exclusions: training and CPU handling on the rank path

- **Training pods skip the ladder entirely — CONFIRMED, still holds.** The base-layer loop's `isTraining` branch (`tournamentAdvancement.js:324-329`) transitions the pod straight to COMPLETE and `continue`s **before** `runWeekSideEffects` (`:349`) — the sole caller of both the rank writer (`:479`) and the leaderboard upsert (`:500`). The brief's `~316-329` anchor is exact. Training pods are structurally base-layer (`baseLayerWeek`, never a `bracketGameId`), so they can only hit this branch. The leaderboard aggregate independently excludes them (`fetchEligibleGroupsByStatus(..., { excludeTraining: true })`, `tournamentLeaderboard.js:345`). Nightly backstop `completeBankedTrainingPods` (`trainingLifecycle.js:674-696`) only transitions status. **"NEVER feeds the ladder" verified.**
- **CPU seats ARE in the group ordering — the ruling's "CPU finishes count" is already true on the finish-order path.** `lockTopTwo`/`rankByScores` rank **all** members with **no `isCpu` filter**. A 1-human-+-3-CPU group yields a four-seat finish order and the human's placement is measured against the three CPUs. The `cpuFarmGuard` (`leagueTournament.js:968`) only **discounts the human's positive RP gain by CPU density** (0 CPUs→1.0 … 3→0) on the **career-RP** path — it does **not** remove CPUs from placement, and it is **not** on the monthly-leaderboard path at all.
- **CPU rank docs ARE written** (by explicit ruling §7.1, not oversight): `applyGroupWeekToRanks` iterates every seat incl. CPUs and writes `tournamentRanks/cpu-N` via `applyRankWeekFrozen` (`isCpu:true`, `floorRp` pinned 0 — display-only, never ratchets, `leagueTournament.js:1027`). **Harmless today** because the only rank read is a per-`odUserId` single-doc `subscribeRank` — there is **no collection-level ladder query** in the tree. BUT note (critic cross-check): on the **leaderboard** surface CPUs already appear inline with a `#position` (`LeaderboardCard.jsx:66-81`, rows built over all `group.players`), so CPU inclusion is a real, already-shipping design fact on any leaderboard-based ladder — see Defect D3.

## Q6 — Where a ladder writer would live (mechanism only)

- **Friday finalization owner:** `runFridayAdvancement` (`tournamentAdvancement.js:236`), dispatched from `runOrchestratorTick` (`tournamentOrchestrator.js:1048`) when `getDutyForInstant` routes the ET-Friday tick to `FRIDAY_ADVANCEMENT` (`:128`). Handler `api/cron/tournament-orchestrator.js`, **`vercel.json` schedule `*/10 11,12,13,14,21,22,23 * * 1-5`** (the 21-23 UTC arm = Friday evening ET). Nightly banking + leaderboard aggregation ride `snake-draft-daily-scores` (`:482`, `:544`), **schedule `15 21 * * 1-5`**. Advancement is **UNFROZEN** (`TOURNAMENT_ADVANCEMENT_FROZEN = false`, `featureFlags.js:1080`).
- **Cron budget:** the ladder already writes **inside `runWeekSideEffects`** (rank + leaderboard) on the Friday path — **a ladder writer needs NO new cron; it branches there.** ⚠ **The actual `vercel.json` cron count is 39, not the 37 BUILD_RULES §6 states** — only **1** free slot remains, not 3 (Defect D-CRON). This makes the "branch, don't add a cron" posture load-bearing.
- **Idempotency precedent** (so a re-run can't double-award): two grains, both already on the path — banking's `already_recorded` guard (`tournamentBanking.js:121`), and directly on the ladder path the **rank `appliedGroups.{groupId}` transactional guard** (`tournamentRank.js:76`, re-run returns `'skipped'`) and the **leaderboard `entries.{uid}.weeks.{groupId}` SET-not-increment** with month total recomputed as `Σ weeks` (`tournamentLeaderboard.js:301, 310`). A placement-points write should mirror one of these keys.

## LB — `tournamentLeaderboard.js`: the ladder is largely built here

*(The workflow's dedicated leaderboard lane failed a schema retry; the lead read the file in full — `api/_utils/tournamentLeaderboard.js`, 353 lines — so this is first-hand VERIFIED.)*

This is **"the seasonal leaderboard writer" (P6a, rulings A-3/A-4)** and it is the doc the ruling's ladder maps onto:
- **Month-keyed** `tournamentLeaderboards/{YYYY-MM}`; **"reset = a new doc key"** (`:1-8`).
- **Scores CUMULATIVE COMPOSITE, not placement:** `buildGroupWeekRows` sets `week.points = getWeeklyComposite(...)` (`:120`); the month total is `points = Σ w.points` (`:310`) — signed, never floored, negative rows first-class. **This is exactly the composite-based ranking the ruling argues against** ("Why placement, not composite").
- **Idempotent by construction:** `entries.{uid}.weeks.{groupId}` SET, total recomputed every write (`:301, 310`).
- **Wired live** (zero new crons): nightly `aggregateTournamentLeaderboards` (rides `snake-draft-daily-scores:544`, `excludeTraining`), Friday `upsertLeaderboardForGroups` (`tournamentAdvancement.js:500`), and the manual `bank-daily-scores.js:120`.
- **CPU rows included** (built over all `group.players`, `:115`); consensus/contrarian **feeds** also computed (`:161`).
- **Reader:** `LeaderboardCard.jsx` — **dev-screen-only** today (its own header: "League home at P9").
- **Scale ceiling** (priced, `:30-37`): one whole-doc month board caps ~3-5k active players/month; per-entry sharding is the designed escape hatch and must land **before open registration** (P6b/P8) — a flagged pre-scale constraint, not a beta blocker.

---

## Classification: read vs small build vs full build

**SMALL-TO-MODERATE BUILD.** Mapping the ruling onto the code:

| Ruling requirement | Status in code | Work |
|---|---|---|
| Weekly group finish order (1-4) | **EXISTS** (`lockTopTwo`/`rankByScores`, day-5 clamped composite) | read |
| Monthly reset | **EXISTS** (`tournamentLeaderboards/{YYYY-MM}`, reset = new doc key) | read |
| Per-week persistence, cumulative-across-weeks | **EXISTS** (`entries.{uid}.weeks.{groupId}`, Σ total) | read |
| Idempotent re-run (no double-award) | **EXISTS** (`appliedGroups` / `weeks` SET) | read |
| Training never feeds the ladder | **EXISTS** (`:324-329`, `excludeTraining`) | read |
| CPU finishes count toward placement | **EXISTS** on the finish-order/leaderboard path (all 4 seats ranked; no leaderboard CPU guard) | read |
| Runs on existing cron | **EXISTS** (rides Friday `runWeekSideEffects`) | read |
| **Placement points 1st=3/2nd=2/3rd=1/4th=0** | **DOES NOT EXIST** — only `PLACEMENT_BONUS [100,66,33,0]` folded into *lifetime RP* (`computeRankBreakdown` `:983`); the monthly board sums *composite* | **NEW** |
| **Sum placement points into the monthly doc** | monthly doc sums composite, not placement points | **NEW** (re-score `upsertLeaderboardForGroups`/`buildGroupWeekRows`) |
| **Tiebreak: cumulative composite margin over group average** | composite per week exists; no margin/group-avg computation, no tiebreak sort | **NEW** |
| **Player-facing season-ladder surface** | reader component (`LeaderboardCard`) exists but is dev-screen-only; League path shows only current-week | **NEW (mostly wiring)** |

So: **not a pure read** (the scoring differs and does not exist), **not a full build** (finish order + monthly persistence + reset + idempotency + exclusions + a reader component all exist). The net-new work is a **placement-points scoring function + monthly accumulation + a margin tiebreak + surface promotion**, on top of a pipeline that is otherwise complete and wired.

**The one fork to settle before speccing:** the ruling's ladder maps onto the **monthly `tournamentLeaderboards` doc** (which resets monthly and has no CPU guard). It must **not** be built on the lifetime `tournamentRanks` RP doc — that path applies the `cpuFarmGuard` the ruling explicitly overturns and never resets. Confirming "the weekly ladder = a re-scored monthly leaderboard, not the career RP ladder" is the single decision that makes this a clean small build rather than a philosophical collision.

---

## §3 register — pre-existing defects found on the rank/advancement path (REPORT, do not fix)

| ID | Sev | Finding | Anchor |
|---|---|---|---|
| **D-DESIGN-1** | design tension | The ruling's **3/2/1/0 placement scoring does not exist**. The only placement scoring is `PLACEMENT_BONUS [100,66,33,0]` added into **lifetime career RP** (`raw = composite×RP_PER_POINT + bonus`), and the monthly board scores on **cumulative composite** — the exact thing the ruling rejects. A "plan-said ≠ code-did" gap the founder should see before speccing. | `leagueTournament.js:923, 983` · `tournamentLeaderboard.js:120,310` |
| **D-CRON** | medium | **BUILD_RULES §6 cron budget is stale**: it says 37/40 ("add at most 2"); `vercel.json` actually has **39** cron entries — only **1** slot free. A builder trusting the doc could over-allocate. (The rule's own advice — "verify against `vercel.json`" — applies to its own count.) | `docs/BUILD_RULES.md:76` vs `vercel.json` |
| **D-WEEKBOUNDARY** | medium (unconfirmed) | `baseLayerWeek` is a **UTC** ISO-week string (`isoWeekString` uses `Date.UTC`/`getUTC*`), fixed at group creation, while trading/banking is **ET**. A base-layer group still live late on an ET Friday can already be in the next UTC ISO week, so the FIELD's `where('baseLayerWeek','==',isoWeekString(new Date()))` could **drop a still-active group** at the week boundary — a candidate mechanism for the "surface went empty" symptom. Needs production data to confirm (see below). | `leagueTournament.js:888` · `tournamentGroupService.js:322` |
| **D3** | low (latent) | **CPU rank docs persist at `tournamentRanks/cpu-N`.** Harmless against today's single-doc read, but the future aggregate rank surface (P6b) must filter `isCpu` on any collection query or CPU rows (frozen floor) appear on the human ladder. The protection today is only that no collection query exists yet. | `tournamentGroupService.js:435` |
| **D-ROUNDBOUNDARY** | low | `RoundBoundaryView` poster renders `{rankDoc.tier \|\| rankDoc.tierName \|\| 'Rank'}`, but `tier` is always a truthy integer 1-7 — the `\|\| tierName` fallback is **dead**, so it shows the bare integer (e.g. `2`) instead of the tier name (`Analyst`). | `RoundBoundaryView.jsx:77` |
| **D5** | low | `DeskLeaderboard` is titled **"SEASON LEADERBOARD"** in comments but renders strictly **current-week** data (no cross-week accumulation). Naming hazard for anyone wiring a real season ladder. | `LeagueDeskParts.jsx:147` |
| **D6** | low | **Terminology collision:** the live monthly writer calls itself the **"seasonal leaderboard"** while the scrapped, dead **"Season Mode"** (4-week) also uses "season" — no code-level disambiguation. Any "season" work must state which meaning. | `tournamentLeaderboard.js:3` · `seasonConfig.js` |
| **D7** | low | **UI over-promise:** "monthly bracket coming soon" / "opens when the season locks" strings render **permanently** in production (seeding is admin/dev-only; `bracketPending = !bracket`). Deliberate per the entry-flow audits, but the copy promises a mechanism the field cannot currently trigger. | `SeatedStatusParts.jsx:468` · `awaitTokens.js:110` · `leagueAdapter.js:361` |
| **D8** | low (unreachable) | The cohort/bracket rank path (`advanceCohort`) has **no `isTraining` guard** — the training exclusion lives only in the base-layer loop. Unreachable under the current formation invariant (`bracketGameId` XOR `baseLayerWeek`), so no live impact; noted so a future formation change doesn't silently rank a training pod. | `tournamentAdvancement.js:570` |

---

## Where production data (not code) is required

The code fully answers Q1-Q6. Three items are **operational-state** questions only — a founder-run credentialed read-only script (as with the void pre-check / motive baseline) would settle them; none changes the classification above:

1. **Backfill feasibility:** whether already-locked **historical** bracket entries carry a finite composite for all four seats in `finalScores` (post-P6) vs user-only (pre-P6 dev) — decides whether a ladder can be back-computed from existing locked entries or only built go-forward. (Code guarantees a full 4-seat composite map for any *fresh* lock.)
2. **D-WEEKBOUNDARY confirmation:** the `baseLayerWeek` values on the groups that were live when the FIELD went empty, vs the client's `isoWeekString(new Date())` at that moment.
3. **CPU-doc presence:** whether `tournamentRanks/cpu-N` docs already exist in production (D3), and whether the monthly `tournamentLeaderboards/{YYYY-MM}` doc has ever been populated with real (non-dev) rows.

---

*Read-only per BUILD_RULES §3. No project state changed; no fenced files read beyond §1-permitted reads. Anchors verified at HEAD `fa6dfed7`; re-verify before relying, per §3.*
