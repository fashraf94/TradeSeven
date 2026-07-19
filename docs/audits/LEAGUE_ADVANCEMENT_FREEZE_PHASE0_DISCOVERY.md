# Advancement Freeze — Phase 0 Read-Only Discovery

**Date:** 2026-07-19
**Branch:** `claude/league-scoring-anomaly-v6b19j` · **HEAD:** `aba32397` · tree clean at start
**Preamble (BUILD_RULES §3):** `git fetch origin` run first — note **`origin/main` advanced to `7b28d15e`** since this branch's base (`51bc50ad`). Every citation below was read at this session's checkout **this session**; all are **VERIFIED** unless marked ASSUMED. No code edits, no writes beyond this report file. **HARD STOP after this report — no build until founder review.**

---

## Executive verdict (read this first)

| Question | Answer |
|---|---|
| Can one guard freeze both bracket advancement **and** rank ingestion? | **Yes — one guard at the top of `runFridayAdvancement` (tournamentAdvancement.js:236) covers every production path to both**, including the manual admin trigger. An optional second belt inside `runWeekSideEffects` is available but not structurally required. |
| Is a freeze a pause or a hold-forever? | **A pause.** The day-5 gate (`isWeekBanked`) is `>= 5` and day indexes only grow, duty markers are per-date and only written on success, and two in-code precedents (bankingPending, §7.2 degraded-lock) already do exactly this skip-and-re-tick. Banking keeps recording throughout. |
| Does the flag mechanism exist and is it legal for `api/`? | **Yes.** `src/config/featureFlags.js` is a **zero-import** (Node-clean by construction) module already imported by **31 `api/` files — including `tournamentAdvancement.js:87` itself.** Zero new import-surface risk. |
| Any consumer that bypasses the guard? | **Career rank: no** (single importer). **Bracket/champion/composition: no** (all inside advancement). **Seasonal leaderboard: YES — it ingests the composite nightly, outside advancement, and marks the week `final` on day-5 banking alone.** It is fully self-healing on re-aggregation (SET + recompute, no ratchet) — but the founder must decide whether that exposure is acceptable during the freeze. |
| Fence contact needed? | **None.** The guard sites (`tournamentAdvancement.js`, optionally `tournamentOrchestrator.js`, `featureFlags.js`) are not on the §1 fence list. This remains a hotfix, not a §7 pass. |
| Is the Tuesday 21:15 UTC deadline right? | **Banking timing confirmed; ingestion timing corrected.** Day-5 **banks** Tue Jul 21 21:15 UTC (cron verified). But scheduled advancement **cannot fire before Friday Jul 24 ~21:00 UTC** — the duty table routes `FRIDAY_ADVANCEMENT` only on Friday evenings (Tue evening ticks are `SKIP`), with Monday-morning catch-up as backstop. The manual `run-duty` endpoint *can* force advancement any day, so **deploying before Tuesday remains the right posture** — but the automatic point of no return is Friday evening, not Tuesday. |

**One paragraph:** The freeze is small, well-precedented, and placeable at a single non-fenced choke point through which every production trigger (Friday-evening duty, Monday catch-up, manual `run-duty`) already flows. Skipping while frozen reuses the code's own "not ready, re-tick" shape, so nothing is missed permanently and banking continues untouched. Two things need founder eyes at review: (1) the seasonal leaderboard will keep ingesting the poisoned composites nightly regardless (recoverable by one re-aggregation after remediation, but visible meanwhile); (2) when eventually unfrozen, a group locks at its **latest** banked snapshot, not its day-5 snapshot — inherent to `getWeeklyComposite`, and moot if the orphaned pods are voided, but it affects any healthy group frozen alongside.

---

## 1. Exact call sites: day-5 trigger → lock → rank

**The day-5 gate.** `isWeekBanked(group)` = `(getLatestDayEntry(group)?.dayN || 0) >= WEEK_DAYS_REQUIRED` (5) — `src/constants/leagueTournament.js:1090-1094` [VERIFIED]. Checked at **two** advancement gates:
- Base-layer loop: `tournamentAdvancement.js:269-272` (`bankingPending` no-op below day 5).
- Bracket per-game lock: `tournamentAdvancement.js:577-580` (same).

**The lock.** `lockTopTwo(group)` builds `finalScores[uid] = getWeeklyComposite(group, uid)` — `tournamentAdvancement.js:103-113` [VERIFIED]. Called at:
- `tournamentAdvancement.js:423` — base-layer groups, inside `runWeekSideEffects` (rank input only; base-layer writes no bracket doc).
- `tournamentAdvancement.js:594` — bracket games; **`finalScores` written to the bracket doc at :595-601** (the permanent lock), then side-effects, then group `COMPLETE` at :625.

**Rank application.** One core: `runWeekSideEffects` — `tournamentAdvancement.js:411-463` [VERIFIED] — calls
- `applyLockedGameToRanks` (`:421`, bracket-entry path) → delegates to `applyGroupWeekToRanks` (`tournamentRank.js:129-152`, delegation at `:144`), or
- `applyGroupWeekToRanks` directly (`:424-431`, base-layer path).

`applyGroupWeekToRanks` — `tournamentRank.js:53-121` [VERIFIED]: per-seat transaction; once-only guard `if (prior?.appliedGroups?.[groupId]) return 'skipped'` at **:76**; math via `computeRankBreakdown` → `applyRankWeek` / `applyRankWeekFrozen` at **:80-84**; the durable write (`tx.set` incl. **`appliedGroups: {..., [groupId]: event}`**) at **:96-105** (appliedGroups at :101). This is the write the task calls migration-only-to-undo.

**The trigger chain (corrected).** Advancement is **not** invoked from the banking cron. Two crons are involved:
- **Banking:** `snake-draft-daily-scores` — vercel.json:26-27, schedule **`15 21 * * 1-5`** (21:15 UTC Mon–Fri) → `bankAllTournamentGroups` at `api/cron/snake-draft-daily-scores.js:483` [VERIFIED]. Its post-banking sequence is CPU claims → `completeBankedTrainingPods` (training only) → ledger reconcile → `aggregateTournamentLeaderboards` (`:544`). **No advancement call anywhere in this handler** [VERIFIED].
- **Advancement:** `tournament-orchestrator` — vercel.json:162-163, schedule **`*/10 11,12,13,14,21,22,23 * * 1-5`** → `runOrchestratorTick` dispatch: duty table `getDutyForInstant` — `tournamentOrchestrator.js:119-127` [VERIFIED] — routes `FRIDAY_ADVANCEMENT` **only when `!morning && weekday === 'Fri'`** (`:125`; morning = before ET noon, `:111,121`). Dispatch to `runFridayAdvancement` at `:952-953`. Second production caller: the **Monday catch-up**, first statement of `runMondayPipeline` — `:432-438` ("a Friday that crashed or stayed banking-pending finishes here"). Third trigger: **manual** `POST /api/tournament/run-duty` (`api/tournament/run-duty.js:24,38-45`) — admin-secret-gated, can **force `friday_advancement` on any day** and/or simulate a clock; it flows through `runOrchestratorTick` → the same dispatch [VERIFIED].

**Corrected ingestion timeline** (banking days: day3 = Fri Jul 17; Sat/Sun no cron):
| When (UTC) | What happens |
|---|---|
| Mon Jul 20 21:15 | day4 banks |
| **Tue Jul 21 21:15** | **day5 banks** → same handler: leaderboard aggregation ingests the day-5 composite and marks the week row `final` (see §5); training pods complete (plain finish, no rank). Tue-evening orchestrator ticks are duty `SKIP` (`:122-126,934-937`). |
| Wed/Thu | banking continues (day6, day7 — no upper cap; see §4). Morning duty = WEEKDAY_FANOUT, no advancement. |
| **Fri Jul 24 ~21:00** | **first scheduled `FRIDAY_ADVANCEMENT` tick that can consume day-5 → lockTopTwo → finalScores → `appliedGroups`.** |
| Mon Jul 27 ~11:00 | catch-up backstop (`runMondayPipeline:435`). |
| any time | `run-duty` can force advancement manually (admin secret). |

The founder's "before Tue Jul 21 21:15 UTC" deadline is therefore **conservative but sound** (day-5 exists from Tuesday; only the duty table and admin discipline stand between it and ingestion). The hard automatic deadline is **Fri Jul 24 ~21:00 UTC**.

## 2. Single guard point or two?

**One guard suffices, placed at the top of `runFridayAdvancement` (`tournamentAdvancement.js:236`).** Proof of coverage:
- **Rank:** `tournamentRank.js`'s only non-test importer in the codebase is `tournamentAdvancement.js` (grep over `api/` + `src/`: `api/_utils/tournamentAdvancement.js:85` only) [VERIFIED]. Both rank entry points funnel through `applyGroupWeekToRanks`, and both are called only from `runWeekSideEffects` (`:421,:424`), which is called only from the base-layer loop (`:304`), the bracket per-game path (`:617`), and `resumeEntrySideEffects` (`:496`) — all inside `runFridayAdvancement`'s call tree (`:267-316`, `:334-341` → `advanceCohort:515`, `:343-384` sweep) [VERIFIED].
- **Bracket writes:** game lock `:595-601`, side-effects stamp `:468-474`, round lock `:662`, champion `:692-697`, next-round composition `:779-783` — every one inside `advanceCohort`/`finalizeRound`/the sweep, all reachable only from `runFridayAdvancement` [VERIFIED].
- **All three production triggers** (§1) call `runFridayAdvancement` itself — the orchestrator's two sites (`:435`, `:953`) and `run-duty` via the same dispatch [VERIFIED].

**Optional second belt (founder's call):** a redundant check inside `runWeekSideEffects` (`:411`) would also shield rank if some future caller bypasses `runFridayAdvancement`. Not structurally needed today; costs one line.

**Side-effects of guarding at `:236` (all consistent with the task's intent):**
- Training pods' *Friday-path* plain finish (`:282-287`) also freezes — harmless: training pods complete **nightly** via `completeBankedTrainingPods` (`trainingLifecycle.js:665-676`, `transitionStatus` COMPLETE only, **no scores consumed, no rank/leaderboard writes**) [VERIFIED]; the Friday path is explicitly "the idempotent backstop" (`snake-draft-daily-scores.js` comment at ~:509).
- Next-round composition and the champion write freeze too — that *is* advancement; intended.
- Banking is untouched (different cron, different module) — day4/day5 record normally, satisfying the task's Phase-2 requirement by construction.

## 3. The feature-flag mechanism

`src/config/featureFlags.js` is a **zero-import module** — no `import`/`require` lines exist in the file [VERIFIED by grep + head read] — so its transitive import surface is Node-clean **by construction** (the same structural argument as `leagueTournament.js`'s zero-import rule). It is already imported by **31 `api/` files**, and — decisive precedent — by **`tournamentAdvancement.js:87` itself** (`LEAGUE_CANONICAL_OPEN_CAPTURE`, consumed at `:763`) [VERIFIED]. The dependency-surface guard demanded by BUILD_RULES §4 already exists: `tournamentAdvancement.test.js:12` documents that its real import of the module **is** the runtime guard. Adding `TOURNAMENT_ADVANCEMENT_FROZEN = true` (naming matches the file's SCREAMING_SNAKE constants; default-frozen inversion per the task) and reading it in the guard adds **zero** new import-surface questions.

## 4. Pause or hold-forever? — **Pause.** (resumability mechanics)

1. **The gate cannot expire.** `isWeekBanked` is `>= 5` (`leagueTournament.js:1092-1094`) and `dayN` is monotonic (`dayN = max existing + 1`, `tournamentBanking.js:125-127`, **no upper cap**) — a group banked through day 5 satisfies the gate on every later run, forever. Banking also keeps running while frozen: `bankAllTournamentGroups` queries `status == 'battle'` (`tournamentBanking.js:388-391`) and a frozen group never leaves `battle` (completion happens only inside advancement).
2. **Duty markers cannot wedge it.** The marker is written **only** when `isDutySatisfied` (`tournamentOrchestrator.js:965-968`); `FRIDAY_ADVANCEMENT` is satisfied **iff `bankingPending === 0`** (`:840-842`) and any `errors > 0` also unsatisfies (`:832`); unsatisfied logs "incomplete (resumes next tick)" (`:969`) and the 10-minute cadence re-dispatches within the same evening window. Markers are **per-ET-date** (`dutyMarkerKey`, `:152-153`) — a frozen Friday never pre-satisfies the next Friday.
3. **The catch-up cannot be blocked.** The Monday catch-up is the unconditional first statement of `runMondayPipeline` (`:432-438`) and its counts are "logged, not folded into the Monday marker" — a frozen advancement never wedges Monday's own duties, and the catch-up re-fires every Monday until unfrozen.
4. **The exact skip-and-re-tick shape already exists twice:** `bankingPending` (`:269-273`) and the §7.2 degraded-snapshot refusal (`:293-297`, `:589-593`) both defer without writing and rely on the group staying in the battle query. The freeze is a third instance of the same pattern.

**Design constraint for Phase 1 (mechanics only, decision at review):** the frozen early-return's summary must keep `isDutySatisfied` false and must preserve the zero-groups quiet-skip contract (`:959-963`). Two clean shapes: **(a)** count frozen groups into the existing `bankingPending` counter (zero orchestrator changes; the log line carries the FROZEN reason) or **(b)** add a `frozen` counter + a one-line `isDutySatisfied` change (more honest telemetry; touches `tournamentOrchestrator.js` too — also non-fenced).

**One behavioral consequence to state plainly:** `lockTopTwo` reads `getWeeklyComposite` = the **latest** banked snapshot (`leagueTournament.js:1079-1084`). Because banking continues past day 5 while frozen, a group unfrozen on day N locks at its day-N standing, **not** its day-5 standing. Moot for pods the founder voids; real for any healthy group frozen alongside.

## 5. Consumers that bypass the guard point

| Consumer | Path | Bypasses guard? | Risk shape |
|---|---|---|---|
| **Career rank** (`tournamentRanks`) | only via `runWeekSideEffects` → `applyGroupWeekToRanks` | **No** — single importer, inside advancement [VERIFIED] | frozen |
| **Bracket doc** (finalScores/advancers/champion/next round) | only inside `advanceCohort`/`finalizeRound`/sweep | **No** [VERIFIED] | frozen |
| **Seasonal leaderboard** (`tournamentLeaderboards`) | (i) **nightly** `aggregateTournamentLeaderboards` — `tournamentLeaderboard.js:315-328` → `upsertLeaderboardForGroups`, called from the banking cron at `snake-draft-daily-scores.js:544`; (ii) the **manual bank endpoint** `api/tournament/bank-daily-scores.js:120` | **YES — both** | It ingests `getWeeklyComposite` for every non-training battle group **every night** (`buildGroupWeekRows`, `:119`) and stamps the week row **`final: true` on `isWeekBanked` alone** (`:113`) — i.e., Tue Jul 21 the ranked group's poisoned composite lands as a `final` leaderboard row **regardless of the freeze**. **Recoverable:** the write is a `tx.set` of `weeks.{groupId}` with the month total **recomputed from the weeks map on every write** ("re-run = same totals", `:284-286`, `:298`) — one re-aggregation after remediation heals it; no ratchet, no idempotency lock. Training pods are excluded (`:318` area / `buildGroupWeekRows` consumers filter). Whether this visible-but-recoverable exposure is acceptable during the freeze is a **founder decision** — gating it is outside this task's stated scope. |
| **Training completion** | nightly `completeBankedTrainingPods` (`trainingLifecycle.js:665-676`) | Bypasses, but consumes **no composite** — status transition only [VERIFIED] | benign |
| **Client surfaces** (orbs, standings, climb) | read `dailyScores` directly | Bypass, display-only, no persistence (Phase 0 finding, `buildArenaModel.js:138`) | benign |

## Fence check & Phase-2 feasibility notes

- **No fence contact required.** Candidate edit sites — `tournamentAdvancement.js`, `featureFlags.js`, optionally `tournamentOrchestrator.js` — are none of the §1 fenced files [VERIFIED against BUILD_RULES §1 list]. The task's escape hatch ("if the guard cannot be placed without editing a fenced file, STOP") is **not triggered**.
- **Phase-2 verification path exists without waiting for a real Friday:** crons don't run on Vercel preview (BUILD_RULES §6), but `run-duty` is explicitly the preview/smoke surface — `simulatedNow` + forced `duty: 'friday_advancement'`, with **sim-namespaced duty markers** that can never pre-satisfy production (`run-duty.js:9-19`, `tournamentOrchestrator.js:130-134,152-153`) [VERIFIED]. Unit precedent: `tournamentAdvancement.test.js` drives `runFridayAdvancement` against a fake db throughout.
- **Timing note for the deploy:** the real automatic ingestion moment is **Fri Jul 24 ~21:00 UTC**; Tue Jul 21 21:15 UTC is when day-5 *data* exists (and when the leaderboard's `final` row lands). Deploying the freeze before Tuesday remains the right posture — it also forecloses the manual-trigger path.

## Open items for founder review (the STOP)

1. **Branch for Phase 1.** BUILD_RULES §2 requires one task = one fresh branch from current `main` (`origin/main` is now `7b28d15e`). This session's harness is pinned to `claude/league-scoring-anomaly-v6b19j` and may not push elsewhere without explicit permission. **Direct me:** cut a fresh branch (name of your choosing) for the freeze build, or explicitly authorize building it on a branch you designate.
2. **Frozen-summary shape:** option (a) reuse `bankingPending` (zero orchestrator delta) vs option (b) honest `frozen` counter + one-line `isDutySatisfied` change. Recommendation: **(b)** — the freeze should be legible in the duty summaries the marker system records, and the extra edit is one non-fenced line.
3. **Second belt in `runWeekSideEffects`:** structurally unnecessary today; one line of insurance. Recommendation: include.
4. **Leaderboard exposure during the freeze** (see §5): accept-and-heal-later (in scope: nothing) vs extend the freeze to the leaderboard writer (scope change — your call, not assumed).
5. **Unfreeze semantics** (§4 note): groups lock at latest-snapshot-at-unfreeze, not day-5. Fine if the poisoned cohort is voided before unfreezing; flag if any healthy ranked group is mid-flight at unfreeze time.

**HARD STOP. No build performed. Awaiting founder review.**
