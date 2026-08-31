# Weekly Ladder — Phase 0 Anchor-Confirm (build gate)

**Date:** 2026-08-31
**Serves:** `20260831_WEEKLY_LADDER_BUILD_SPEC_V1` (authoritative) · reads with `20260831_TOURNAMENT_STRUCTURE_RULING_V1` (⚠ not present — see Gap G1) · `20260831_WEEKLY_LADDER_PHASE0_DISCOVERY` (`docs/audits/`)
**Type:** READ-ONLY anchor-confirm (BUILD_RULES §3). No code written. **HARD STOP for founder review.**
**Branch / HEAD:** `claude/weekly-ladder-build-bmf4uy` @ `a2bd72b5` — **clean tree**, branch tip == `origin/main`, no commits made before this report.
**Fetch (BUILD_RULES §3):** `git fetch origin` run as the first action. `origin/main` = `a2bd72b5` ("Merge #795"). Recorded per rule.
**Drift since the discovery HEAD:** `git diff --stat fa6dfed7..a2bd72b5` = **one file, docs only** (the Phase 0 discovery report itself, +158 lines). **No code moved.** Every anchor below was nonetheless re-read this session — inherited anchors are never trusted (§3).

---

## EXECUTIVE VERDICT

| # | Gate | Verdict | One line |
|---|---|---|---|
| 1 | Anchors re-verified | **PASS** | 47 anchors checked; **44 exact**, 1 real drift (−6 lines), 2 report-side wording slips. No anchor invalidates the spec. |
| 2 | The load-bearing decision (monthly board, not career doc) | **CONFIRMED CORRECT** | `cpuFarmGuard` has exactly ONE production call chain, and it is the career path. The monthly board cannot reach it. |
| 3 | Idempotency precedent | **STRONGER than the spec assumes** | The monthly board is already idempotent *by construction* (SET-not-increment + Σ-recompute). This has a test-integrity consequence — see §5. |
| 4 | CPU naming (`cpuAgentName`) | **ALREADY WIRED on this path** | The leaderboard writer already stores `"CPU — <Archetype>"` as `displayName`. A raw `cpu-40` cannot reach the board today. |
| 5 | Zero new crons | **CONFIRMED FEASIBLE** | 39/40 used (BUILD_RULES §6's "37" is stale — D-CRON stands). The write branches inside an existing handler. |
| 6 | UTC-week vs ET-trading-week | **MECHANISM CONFIRMED — numerically, no production data needed** | Read side flips the week **4–5 h early, Sunday evening ET**. Fix is **small and in scope**. A second, larger-looking write-side suspect was chased down and is **self-correcting** — not a bug. |
| 7 | Ready to build? | **YES — pending 3 founder decisions (§6)** | None are blocking-by-safety; all three change what a player sees, so they are yours, not mine. |

---

## 1. Anchor-confirm results

Method: each claim was checked by reading the cited line and matching an expected token, not by grepping for the symbol and trusting the first hit.

### 1a. Exact — re-verified at `a2bd72b5` (VERIFIED)

**Scoring / ladder core**
`tournamentRank.js`: `:53` `applyGroupWeekToRanks` · `:62` `placement = ranking.indexOf(odUserId)+1` · `:72` write ref · `:76` `appliedGroups` guard · `:96` the single `tx.set` · `:129` `applyLockedGameToRanks` · `:143` `rankByScores` rebuild
`tournamentAdvancement.js`: `:85` rank-writer import · `:103` `lockTopTwo` · `:111` full `ranking` · `:236` `runFridayAdvancement` · `:324-329` **training branch (exact)** · `:349` `runWeekSideEffects` · `:479` rank write · `:500` leaderboard upsert · `:570` `advanceCohort`
`leagueTournament.js`: `:771` **`selectBaseLayerField` (spec-cited — holds)** · `:798` ranks collection · `:845` `rankByScores` · `:853`/`:860`/`:866`/`:872` month+doc-id helpers · `:888` `isoWeekString` · `:923` `PLACEMENT_BONUS [100,66,33,0]` · `:968` `cpuFarmGuard` · `:983` `computeRankBreakdown` · `:1005` `applyRankWeek` · `:1027` `applyRankWeekFrozen` · `:1293` `getWeeklyComposite`
`tournamentLeaderboard.js`: `:115` rows over all `group.players` · `:120` **`points: getWeeklyComposite(...)` — the line the spec replaces** · `:301` `weeks` SET · `:310` Σ-recompute · `:345` `excludeTraining`

**Surfaces / wiring**
`tournamentGroupService.js`: `:315` `subscribeBaseLayerGroups` · `:322` `where('baseLayerWeek','==',…)` · `:439` `subscribeRank`
`TournamentDevScreen.jsx:855` `LeaderboardCard` (dev-only mount) · `:865` `RankCard` · `LeagueParticipantView.jsx:144` · `RoundBoundaryView.jsx:77` · `leagueAdapter.js:399` `bracketPending`
`tournamentOrchestrator.js:1048` Friday dispatch · `featureFlags.js:1080` `TOURNAMENT_ADVANCEMENT_FROZEN = false`

### 1b. Real drift — correct these before citing

| Claim | Cited | **Actual** | Note |
|---|---|---|---|
| `getDutyForInstant` | `tournamentOrchestrator.js:128` | **`:122`** | −6 lines. Cosmetic; routing unchanged. |

### 1c. Report-side wording, not code drift (anchors hold)

| Claim | Finding |
|---|---|
| "`DeskLeaderboard` sorts by `getWeeklyComposite` (`LeagueDeskParts.jsx:148-149`)" | **Wrong file for the composite.** `DeskLeaderboard` *is* at `:148`, but it sorts a **pre-computed `p.score`** (`:149`). The composite is computed one layer up at **`leagueAdapter.js:228`** (`score: getWeeklyComposite(group, p.odUserId)`). Substance correct, anchor misattributed. **This matters for §9** — the season surface must bind its number and its label to one source the same way. |
| "`tournamentRank.js:72` = `db.collection('tournamentRanks')`" | Anchor exact; the code uses the **`TOURNAMENT_RANKS_COLLECTION` const**, not a string literal. Paraphrase, not drift. |
| "feeds at `tournamentLeaderboard.js:161`" | Exact — `buildLeaderboardFeeds`. (My first check missed it on case.) |
| "`useRealLeagueState.js:52-54, 86`" | Exact as a range: `currentWeek` `:52`, `isoWeekString` `:53`, subscribe `:85-86`. |

### 1d. Cron budget
`vercel.json` = **39** `"schedule"` entries (counted). BUILD_RULES §6 still says 37 — **D-CRON confirmed, still stale**. The spec's "39/40, one free — do not consume it" is the accurate figure. This build adds **zero**.

---

## 2. The load-bearing decision — independently confirmed

The spec's central call (build on `tournamentLeaderboards/{YYYY-MM}`, not `tournamentRanks/{odUserId}`) is **correct, and the reason is stronger than stated**:

- `cpuFarmGuard` (`leagueTournament.js:968`) has **exactly one** production caller: `computeRankBreakdown` (`:986`).
- `computeRankBreakdown` has **exactly one** production caller: `tournamentRank.js:80` — the career-RP writer.
- `tournamentLeaderboard.js` imports **nothing** from the career-rank family (import block `:45-60` verified in full).

So the monthly board is not merely "guard-free today" — it has **no code path to the guard at all**. Building there satisfies the CPU ruling structurally rather than by omission, and the career `tournamentRanks` doc and its guard are untouched (acceptance criterion 6 is satisfied by construction, not by discipline).

---

## 3. What the four new pieces actually cost

Each maps onto an existing pure function; none requires a new read, a new cron, or a new collection.

| Spec item | Where it lands | Cost |
|---|---|---|
| §1 3/2/1/0 award | `buildGroupWeekRows` (`tournamentLeaderboard.js:113`) — the finish order is derivable **purely from the group doc** via the same `rankByScores(finalScores, groupMembers)` `lockTopTwo` uses. No new read. | small |
| §2 sum into monthly doc | the entry aggregation (`:296-312`) — add `placementPoints: Σ weeks` alongside the existing `points: Σ weeks` | small |
| §3 margin tiebreak | same pure row builder — `seat.composite − mean(group composites)`, stored per week, summed | small |
| §5 season surface | `LeaderboardCard.jsx` (sort `:31-34`) + a League mount beside `DeskLeaderboard` (`LeagueLobbyDesktop.jsx:206/250`) | **the largest piece** — see §6 D3 |

**One correctness detail I will honour:** placement must be computed over **`group.groupMembers`**, not `group.players`. They are the same set and order at creation (`leagueTournament.js:1459` — `ids = players.map(...)`), but `groupMembers` is the order `rankByScores` uses for its draft-order tiebreak, and it is what `lockTopTwo` ranks. Using `players` would risk a finish order that disagrees with the one the career path already recorded for the same week.

---

## 4. The UTC-week vs ET-trading-week boundary — confirmed without production data

**No credentialed read is needed.** The mechanism is provable from the code plus a clock, and I proved it:

**The asymmetry.** The *write* side is ET-anchored; the *read* side is not.

- **Write** — `deriveBaseLayerWeek` (`liveDraftFormation.js:220-223`) takes the battle week's **ET Monday** and converts via `etDateToUtcNoon(monday)` before labelling. Noon UTC on a Monday is unambiguously Monday in UTC, so the label is DST-immune and ET-true. Correct.
- **Read** — `useRealLeagueState.js:53` calls `isoWeekString(new Date())` on the **raw current instant**. `isoWeekString` (`leagueTournament.js:888-898`) is pure UTC (`Date.UTC`, `getUTC*`).

**Measured window** (executed against the real `isoWeekString`, both DST regimes):

```
EDT: UTC 2026-09-06T23:00 | ET Sun 19:00 -> 2026-W36
     UTC 2026-09-07T00:00 | ET Sun 20:00 -> 2026-W37   <<< flips
EST: UTC 2026-01-04T23:00 | ET Sun 18:00 -> 2026-W01
     UTC 2026-01-05T00:00 | ET Sun 19:00 -> 2026-W02   <<< flips
```

THE FIELD advances to the next week at **Sunday 20:00 ET (EDT) / 19:00 ET (EST)** — **4–5 hours before the ET week turns over**. In that window the query asks for a week that has no groups yet, while the week just played is dropped. **THE FIELD renders empty.** That is the reported symptom, and it is the same class as the zombie: an exact-equality match against a frozen week stamp.

**Same-layer inconsistency that makes this a live risk for THIS build:** the month reader `etMonthKey` (`tournamentSurfaces.js:112-119`) **is** ET-correct (`Intl`, `America/New_York`). So the surface I am promoting reads *months* in ET and *weeks* in UTC. The season view's per-week decomposition (§5 / §9) would label rows with a week string derived one way while the rows were stamped the other — a §9 display-agreement violation by construction, in exactly the surface this build makes player-facing.

**Recommended fix (small, in scope):** give the read side the same ET-anchored derivation the write side already uses — one exported helper (`currentBaseLayerWeek()`: ET Monday of the current ET week → `isoWeekString(etDateToUtcNoon(monday))`), consumed at `useRealLeagueState.js:53`. This makes read and write share **one** definition (the BUILD_RULES §4 one-home rule, and the pattern `deriveBaseLayerWeek` already sets). Purely unit-testable by injecting a `Date` — no production data, no cron observation.

### 4a. A larger suspect, chased down and cleared — do NOT fix

While scoping the above I found what looked like a worse, unrecorded write-side bug and want it on the record as **investigated and benign**, so nobody re-opens it:

`tournamentLobbyService.js:109` and `:349` stamp `baseLayerWeek: isoWeekString(now)` — the **formation** week — while the same file's mirror-guard docstring at `:275-277` explicitly says *"NEVER `isoWeekString(now)`"* and its guard (`:283`) keys on the **battle** week. A lobby formed Wed/Sat/Sun would be filed a week early — the exact bug class the slot-side fix corrected.

**It self-corrects.** Lobby groups carry no `battleStartWeek`, so `effectiveBattleAnchor` (`liveDraftFormation.js:238-247`) always returns `restamped: true` for them, and every draft-lifecycle site then rewrites the cohort key from the ET anchor: `liveDraftLifecycle.js:252`, `:337`, `:423` — `groupUpdate.baseLayerWeek = deriveBaseLayerWeek(anchor.battleStartWeek)`. The wrong stamp exists only between lobby formation and draft fire, before the group has any score.

**Residue (filed, not fixed):** during that pre-draft window the group *is* visible in THE FIELD under the wrong week — `subscribeBaseLayerGroups` applies **no status filter** (`tournamentGroupService.js:320-323`), and `selectBaseLayerField` excludes only training and VOIDED (`leagueTournament.js:776`). Cosmetic, self-clearing, zero score impact. **Register item, per BUILD_RULES §3 — not this build's to fix.**

---

## 5. Test-integrity warning on the mandated red-first idempotency test

The spec's acceptance 3 ("re-running finalization does not double-award, red-first") has a trap, and I want it stated before I write the test rather than discovered in review:

The monthly board is **already idempotent by construction** — `entries.{uid}.weeks.{groupId}` is **SET, never incremented**, and the total is **recomputed as Σ over the weeks map on every write** (`tournamentLeaderboard.js:301, 310`). If I sum placement points the same way (which is the right design), then **a double-invocation test passes the moment it is written, and would pass even if the feature were broken in other ways.**

Per BUILD_RULES §2 ("a row that cannot fail under the defect it names is not a guard"), I will **mutation-check it**: temporarily convert the accumulator to `+=`, confirm the test goes red, revert, confirm green — and record that mutation in the build report. Otherwise the acceptance criterion is satisfied vacuously.

---

## 6. Three decisions I need from you (none blocking-by-safety; all change what a player sees)

**D1 — Mid-week provisional placement points.** The nightly pass (`aggregateTournamentLeaderboards`) rewrites rows every night for in-progress BATTLE groups, where the finish order is not yet real. Two options:
- **(a) Award only on a final row** — `final: true` already exists on every row (`:114`, day-5 banked or COMPLETE). The season board shows **0 for the current week until Friday**, then the week lands whole. Honest, stable, no churn. ← **my recommendation**
- (b) Award provisionally and let it churn nightly — a player's rank would move on days nobody finished anything.

**D2 — the final ordering rule** (spec §3 asks me to state it). Proposal: **placement points DESC → cumulative composite margin DESC → `odUserId` ASC.** The last key is deterministic and stable across renames; `displayName` is not (it can change and can collide, including across two CPUs of the same archetype). No third scoring dimension invented, per §3.

**D3 — how much surface.** §5 wants per-week decomposition (§9: "the number shown must decompose into the weeks that produced it"). `LeaderboardCard` today shows only a **`N wk` count** (`:83`), not the weeks. So this is a real UI addition, and it is the piece most likely to push the diff toward the ≥10-file / ≥1500-line mandatory-review threshold (BUILD_RULES §2). Options: expand rows in place (an expandable row per player) vs. a dedicated season panel beside `DeskLeaderboard`. I will take **expand-in-place on `LeaderboardCard`, then mount it on the League path** unless you say otherwise — smallest diff, one reader, no second copy of the sort.

---

## 7. Gaps on the record

**G1 — the structure ruling is missing.** `20260831_TOURNAMENT_STRUCTURE_RULING_V1` is **not in the repo** (`find` across the tree: only the discovery report matches `20260831*`) and was **not among the attachments** — only the build spec was. Precedence is spec → ruling → discovery, and the spec is authoritative and highest, so I am **not blocked**: the spec restates the ruling's operative content (§4 CPU visibility and eligibility, the 3/2/1/0 award, the monthly-board mapping). But **any ruling clause the spec does not restate is invisible to me.** If the ruling carries anything beyond §1-§6 of the spec, send it before I build.

**G2 — the Phase 0 discovery report is already committed.** `docs/audits/20260831_WEEKLY_LADDER_PHASE0_DISCOVERY.md` landed at `f8a2eb67` ("Add files via upload") and is present at HEAD, byte-unmodified. Your "commit the Phase 0 report, verbatim relay" instruction is therefore **already satisfied** — I have not rewritten or re-relayed it. This anchor-confirm is committed alongside it as the build's own Phase 0 record.

---

## 8. STOP

**Read-only. No project state changed** — no code written, no fenced file edited (fenced modules `agentArchetypeConfig.js` / `archetypeScoring.js` were not read; `getArchetypeLabel` reaches the board only through the existing `tournamentCpu.js` call, unchanged by this build).

Awaiting founder sign-off on **D1, D2, D3** and, if it exists, the **G1** ruling document. On sign-off: build behind a dark flag → suites/lint/`vite build` green with exit codes asserted and the `Test Files` line read (never piped through `tail`) → adversarial multi-lens review if the diff crosses the §2 threshold → push and STOP for smoke. Flag flip stays a separate one-line PR.

*Anchors verified at HEAD `a2bd72b5`; re-verify before relying, per §3.*
