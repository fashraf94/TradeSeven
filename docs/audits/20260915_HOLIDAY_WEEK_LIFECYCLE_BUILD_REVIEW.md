# Holiday-Week Lifecycle V1 — Build + Review Record

**Date:** 2026-09-15 · **Branch:** `claude/modest-cerf-63k7fa` · **Base:** `fd470b16` (= `origin/main` at session start, `git fetch origin` run first per BUILD_RULES §3)
**Commits:** `5fef5e83` (build) · `825e3946` (review corrections)
**Reads with:** `2026-09-15_HOLIDAY_WEEK_HANDLING_DISCOVERY` (Phase 0 discovery) and the Phase 0 anchor-confirm report, both delivered out-of-tree per §3.
**Spec:** Holiday-Week Lifecycle — Build Spec V1, with two founder rulings taken at the Phase 0 STOP (§1 below).
**Fence (§1):** no fenced file edited. `decide.js`, `agentBattleService.js` were **read only**, which §1 permits. No fenced function called from new code.
**Cron (§6):** `vercel.json` `crons` = **39** at base and at HEAD. No new entry.

---

## 0. Executive verdict

| | |
|---|---|
| **Acceptance criteria** | 8 of 8 met (7 from the spec + the founder's added one-battle-per-trading-day row). §6. |
| **Review** | `/code-review` at high effort. **4 findings, 4 CONFIRMED, 0 REFUTED** — and one of them (R-2) refuted *my own* stated rationale for a guard the founder had already approved. §4. |
| **Mutation** | 11 mutants, **11 KILLED, 0 SURVIVED**. §5. |
| **Suite** | `npx vitest run` → exit **0**. `Test Files 663 passed \| 3 skipped (666)`, `Tests 12503 passed \| 64 skipped (12567)`. Baseline was 12471 → **+32 rows, 0 files added**. Full output captured; never piped through `tail`. |
| **Build** | `npx vite build` → exit **0**. |
| **Diff** | 12 files, +806 / −46. **At/over the §2 mandatory-review threshold** (≥10 files), hence this record. |
| **Landing** | No feature flag. Fix 3 changes *when* groups seal — see §7 before merging. |

---

## 1. The two founder rulings taken at the Phase 0 STOP

**Ruling 1 — Fix 1's direction was inverted in the spec.** The spec said to compare against "the anchor's own trading-day, not the calendar Monday". That describes the *existing* code (`anchorDateReached` already compared against `anchorEtDate`), which is what stranded the pod; implementing it as written would have changed nothing. Founder corrected it to the inverse: **activate on `battleStartWeek.mondayEtDate`, falling back to `startAnchor.anchorEtDate`.**

**Ruling 2 — the deploy-guard shape.** Phase 0 surfaced a blocker not in discovery: activating on the holiday Monday makes the Monday pipeline deploy into a closed market. Founder took **option (a)** — skip the Monday deploy on a non-trading day, let the existing Tue–Fri catch-up deploy on the first trading day — and docketed option (b) (re-keying the deploy idempotency guard to the target trading day) as its own task.

**⚠️ The blocker I reported to obtain Ruling 2 was WRONG in its mechanism.** See R-2 in §4. The guard is right and is kept; the reason I gave for it was not. This is recorded here rather than quietly corrected because the ruling was made on that reasoning.

---

## 2. What shipped

| Fix | Where | Shape |
|---|---|---|
| **1 — activation gate** | `trainingLifecycle.js` `activationEtDate` / `anchorDateReached` | A pod carrying a `battleStartWeek` activates on its `mondayEtDate`; a pod carrying none (every training pod) keeps `startAnchor.anchorEtDate`, which *is* its start day. Byte-identical on a normal week. Not a loosening: a future-week pod still does not activate, and the never-start-early guarantee stays in `effectiveBattleAnchor`'s stale-anchor guard, untouched. |
| **1 — anchor/week pairing** | `computeHandoffWrites` + `liveDraftLifecycle.js` ×2 | The predicate reads ONLY the caller-passed week, never `group.battleStartWeek`. The two slot-completion sites derive both through `effectiveBattleAnchor` and pass the fresh pair. |
| **1-guard (a)** | `runMondayPipeline` step 4, `runWeekdayFanout` | No deploy on a non-trading day, either duty. Steps 1–3 still write the draft stream; the first trading day deploys it. |
| **2 — audible fan-out** | `fanOutDeploys`, `isDutySatisfied`, `markerSummary` | Zero seats with the deploy gate open → `console.error` naming group + date, `deploys.emptySeats++`, marker withheld on both the Monday and weekday duties. Per-group by construction, so "no groups to serve" stays quiet and satisfied. |
| **3 — finalize on banked** | `getDutyForInstant` (`tournamentOrchestrator.js:128` — **not** `tournamentAdvancement.js:128` as the spec cited) | Advancement routes on every weekday evening. Zero cron cost, duty name kept (markers are date-scoped), the two Mon-evening SKIP pins moved in the same commit. |
| **4 — clamp discriminator** | `tournamentBanking.js` clamp + log | The clamp carries `recordedDate`; the log names it and its ET weekday with the spillover-vs-stall reading. `appears STALLED` kept **verbatim** — its two mutation-killed pins (`tournamentBanking.test.js:741`, `:763`) are intact. |
| **also** | `src/config/liveDraftSlots.js` | The "only currently-reachable trigger" claim was false and is corrected; the `mon-0845` re-enable condition now additionally requires the holiday path covered. |
| **new shared helpers** | `tournamentTime.js` | `isEtTradingDay` (date-grained — the orchestrator's morning window is pre-open on *every* trading day, so an is-market-open test would refuse every morning duty) and `etDateWeekday` (pure, for a date recorded in the past). Both read the existing `marketSchedule.js` calendar — never a further copy of the NYSE list (§4 import rule). |

---

## 3. Phase 0 anchor confirmation (summary)

Every line the spec and discovery cite was re-read at `fd470b16`. **38 of 43 exact**; 5 drifted 1–2 lines (cosmetic — the cited code sits at the drifted line): `tournamentOrchestrator.js:673→674`, `:643-680→643-698`, `:713-739→711-739`, `:463→464`, `:583/604/619→591/606/620`, `liveDraftSlots.js:43→41`. One **file-name mis-citation** in the spec: Fix 3's `tournamentAdvancement.js:128` is `tournamentOrchestrator.js:128` (discovery had it right). Full table in the out-of-tree Phase 0 report.

---

## 4. Review — findings and dispositions

`/code-review` at high effort (settlement proximity), run on `git diff HEAD~1` after the build commit. **4 findings. All 4 CONFIRMED against primary sources, all 4 fixed in `825e3946`. None REFUTED.**

### R-2 (the significant one) — CONFIRMED, and it refuted my own premise

> *"the holiday deploy guard's double-count justification is blocked by `decide.js:717-727`'s active-battle check; if it were not, `runWeekdayFanout` carries the same hazard unguarded on a Tue–Fri holiday."*

**Verified at `api/agent/decide.js:711-727`:** the endpoint queries `agentBattles where agentId == X and status == 'active'`, and if the battle exists and is not past `expiresAt`, returns `battleCreated: false` without creating anything.

Walk the Labor Day case: the holiday-Monday battle is stamped `expiresAt` = Tue 16:00 ET. Tuesday's fan-out runs ~07:00 ET, when that battle is still active and unexpired → refused. **So exactly one battle per trading day exists either way, and the double-count into `fetchGroupAgentScores` I described in the Phase 0 report does not occur.** My Phase 0 §3 blocker was wrong in its mechanism.

**Disposition — guard KEPT, rationale corrected.** Two real costs remain, and they are what the comment now states:
1. A battle opened on a closed day carries the *next* trading day (`getNextMarketClose` skips the holiday) with the *previous* session's baselines rather than the trading day's own.
2. Both model calls — strategy and portfolio — run **before** `decide.js`'s active-battle check, so the next day's refused deploy is paid for in full, per agent, per closed day.

**Disposition — the asymmetry the finding named was also fixed.** Guarding only Monday would have left Thanksgiving, Christmas and New Year's deploying into a closed market via the weekday duty (Vercel crons are holiday-blind, `* * 1-5`). `runWeekdayFanout` now carries the same guard, placed *after* the single eligibility fetch so the summary still reports the live group set and `p4Flips.test.js`'s call-site count is unchanged.

### R-3 — CONFIRMED reachable

> *"the `group?.battleStartWeek` fallback is read only by the two call sites that never run `effectiveBattleAnchor` … a competitive pod driven through the unguarded `training-pick` endpoint with a past `mondayEtDate` now lands directly in BATTLE on a dead week."*

**Verified:** `api/tournament/training-pick.js` contains no `isTraining` / `isLiveDraft` guard (grep: zero hits), and competitive pods *do* carry a `battleStartWeek`. The fallback was a new behavior on a path that previously could not produce a past activation date, because `nextMarketOpenAnchor` is never in the past.

**Disposition — fallback dropped.** `computeHandoffWrites` reads only the caller-passed override, so every no-override site behaves exactly as it did before the predicate learned about weeks. Guarded by a new row and by mutant M2.

### R-1 — CONFIRMED (observability regression introduced by Fix 3)

Mon–Thu evening advancement is structurally unsatisfiable in a normal week (`bankingPending > 0` is the *normal* mid-week state), so all ~18 of that evening's ticks run the pass and each logs `incomplete (resumes next tick)`, where previously they were SKIP. Those lines were indistinguishable from a genuinely wedged Friday.

**Disposition:** `bankingPending` added to the advancement marker summary. `bankingPending === groups` is the benign mid-week shape; `bankingPending 0` with the marker still withheld is not. The retry semantics are deliberately unchanged — "withhold until the week banks" is load-bearing and is the same behavior a normal Friday already had.

### R-4 — CONFIRMED (stale documentation)

Three headers still documented Friday-evening-only routing: the `api/cron/tournament-orchestrator.js` schedule comment, the orchestrator module header, and the `MORNING_END_MIN` comment. All corrected.

### Review-process disclosure (§2 honesty requirement)

The finding pass was multi-lens and adversarial (the `/code-review` skill's own reviewers, read-only on a snapshot). The **refutation pass was run by the coordinating session against primary sources**, not by separate independent refuter subagents — so this does not match the 22-agent `20260730_DELIGHT_STARFIELD` precedent in form. It is stated plainly rather than reported as an adversarial pass that was not run. What the refutation pass *did* produce is on the record: R-2 overturned the coordinator's own Phase 0 blocker, which is the outcome the rule exists to make possible.

---

## 5. Mutation check (§2: "a row that cannot fail under the defect it names is not a guard")

Each mutant reverts one guard to its pre-fix behavior; the named test files must go red. Restore is a **byte-exact in-memory snapshot**, never `git checkout --` (an earlier run used `git checkout --` and silently reverted four files of uncommitted review corrections — the §2 Reviewer-isolation precedent, reproduced first-hand).

| # | Mutant | Verdict |
|---|---|---|
| M1 | Fix 1 gate ignores `mondayEtDate` (the original defect) | **KILLED** |
| M2 | Fix 1 pairing: restore the unsafe group-doc fallback (R-3) | **KILLED** |
| M3 | Monday guard: deploy into the closed market anyway | **KILLED** |
| M4 | Fix 2 alarm: empty fan-out goes silent again | **KILLED** |
| M5 | Fix 2 marker: `emptySeats` stops withholding the marker | **KILLED** |
| M6 | Fix 3 routing: back to Friday-only advancement | **KILLED** |
| M7 | Fix 4: clamp line drops the discriminator | **KILLED** |
| M8 | Fix 4: `etDateWeekday` always returns null | **KILLED** |
| M9 | `isEtTradingDay` ignores the holiday calendar | **KILLED** |
| M10 | R-2 symmetry: weekday fan-out deploys on a Tue–Fri holiday | **KILLED** |
| M11 | R-1: `bankingPending` dropped from the marker summary | **KILLED** |

**11/11 killed, 0 survived.** Working tree verified byte-identical afterwards.

---

## 6. Acceptance criteria

| # | Criterion | Evidence |
|---|---|---|
| 1 | Holiday-shifted pod activates and resolves its agent draft; a future-week pod still does not | `trainingLifecycle.test.js` — 4 activation rows + 4 handoff rows; `tournamentOrchestrator.test.js` "resolves the agent draft, deploys NOTHING, and is STILL marker-worthy" asserts the `streams/agentDraft` doc. M1, M2. |
| 2 | Enabled deploy + active group + zero seats → error logged, duty not complete; genuinely no groups → quiet, complete | `tournamentOrchestrator.test.js` ×3 rows. M4, M5. |
| 3 | Five banked days seal on the next evening tick any weekday; four do not seal on Friday | `tournamentAdvancement.test.js` ×2 rows; `tournamentOrchestrator.test.js` Tue-evening dispatch row. M6. |
| 4 | The clamp log distinguishes spillover from stall | `tournamentBanking.test.js` ×3 rows, with the verbatim `appears STALLED` re-asserted in each. M7, M8. |
| 5 | `liveDraftSlots.js` comment corrected | `src/config/liveDraftSlots.js:50-67`. |
| 6 | No fenced file edited; no new cron (39/40 unchanged) | Branch diff carries no §1 file; `vercel.json` `crons` = 39 at base and HEAD. |
| 7 | Full suite with exit code asserted and the `Test Files` line read (never through `tail`); `vite build` green | §0. Output captured to file and grepped; exit codes echoed explicitly. |
| **8** | **(founder-added)** After Fix 1 + (a), a holiday-Monday group produces exactly one agent battle per trading day — no two battles share a `tradingDays[0]` for one groupId | `tournamentOrchestrator.test.js` "ONE BATTLE PER TRADING DAY". Drives the **real** `getNextMarketClose` + `formatDateString` (the pair `agentBattleService.js:377-381` uses), not a pinned date, so a calendar change moves the row. M3, M10. |

**Note on criterion 8, stated honestly:** the row pins the **deploy-call count** — without the Monday guard the run issues eight calls, all four Monday ones targeting the same `2026-09-08` as their Tuesday twin. In production `decide.js` would refuse the second half, so no duplicate battle is ever written (R-2). The invariant therefore holds in production either way; what the guard removes is the wasted decision and the stale-baseline battle. The row is a true regression guard for the guard, not for a live double-count.

---

## 7. Landing

No feature flag — these correct live lifecycle behavior. **Fix 3 changes when groups seal**, so:

- Merge when it will not interrupt a group mid-day-5-bank.
- **Merge == deploy.** State that in the deploy record.
- After deploy, watch `tournamentGroups/lds_wed-1900_2026-09-02` seal and confirm `completedAt` / `finalScores` are written and the interstitial renders.
- **BUILD_RULES §2:** this session pushes and STOPS. It has not subscribed to PR activity, watched CI, requested review, or touched merge state.

**Expected first-run signals:** Mon–Thu evening ticks now log `duty=friday_advancement — incomplete (resumes next tick)` with `"bankingPending": <n>` — that is the *normal* mid-week shape, not a fault (R-1). On a holiday Monday expect `deploy DEFERRED (<date> is not a trading day)` per group, and the deploy on the next trading day.

---

## 8. Register (reported, not fixed)

1. **The Dec 21 cascade — Fix 3 resolves it. CONFIRMED, not assumed.** The Dec 21 2026 week is short (Christmas, Fri 2026-12-25), so its day 5 banks **Mon 2026-12-28**. At base its seal fell due Fri 2027-01-01, itself a holiday. With Fix 3: banking commits day 5 at 21:15 UTC on Mon 12-28 (a trading day, so the cron's own `isTradingDay` guard passes), and the 21:20 UTC tick that same evening routes to advancement with `isWeekBanked` true — **it seals that Monday and never reaches Jan 1.** The Jan 1 tick still fires (crons are holiday-blind) but is a no-op pass for this group, which is already COMPLETE.
2. **Q1 recurrence dates, had Fix 1 not landed:** 2027-01-18 (MLK), 02-15 (Presidents'), 05-31 (Memorial), 07-05 (Independence, observed), 09-06 (Labor Day). Verified against `NYSE_HOLIDAYS_2027`. The calendar is maintained only through 2027 (`MAINTAINED_HOLIDAY_YEARS`; the file's TODO sets a Dec-2027 deadline for 2028).
3. **Option (b), docketed as its own task:** re-key `fanOutDeploys`' idempotency guard from the battle's `createdAt` ET date to its target trading day (`timing.tradingDays[0]`). **The general weakness it closes:** `fetchGroupAgentScores` sums `scoreState.currentScore` across every battle sharing a `groupId`, so ANY duplicate same-day battle double-counts into `agentPoints` and into the sealed composite. Today the only thing preventing that is `decide.js`'s active-battle check, which is a different module's contract; the orchestrator's own guard cannot see a same-day collision at all. Guard (a) removes today's trigger, not the class.
4. **Documentation drift still present** (out of scope, confirmed at HEAD): `src/constants/leagueTournament.js:87-92` and `api/_utils/tournamentOrchestrator.js:964-970` both still claim `AWAITING_OPEN` is training-only — false; `flipAwaitingOpenPods` itself branches on `pod.isLiveDraft`. `src/components/League/leagueClimbAdapter.js:102-103` claims "a holiday-short week that never reaches day 5", which is not a real shape (banking counts *banked* days, so such a week always reaches day 5, one week late).
5. **`api/tournament/training-pick.js` has no mode guard** (found while confirming R-3). A competitive `DRAFTING` pod can be driven through the training pick path. This build made that path safe for the activation predicate, but the missing guard itself is a separate concern.
6. **The evidence group's day1–day4 agent absence.** `tournamentGroups/lds_wed-1900_2026-09-02` had **no agent layer on days 1–4** (Tue 9/8 – Fri 9/11); `agentPoints` is non-zero only on day 5 (Mon 9/14). **Its weekly composite is a user-layer-only result for four of its five days and must never be read as a scoring result.** Recorded here so the seal Fix 3 will produce is never mistaken for one. (Firestore confirmation was not possible in this container — no credentials. `scripts/n1-stranded-precheck.js` implements the five-part stranded signature read-only but hardcodes `lds_mon-0845_<Monday>` occurrences and accepts `--dates=` with no slot override; adapting it is a separate build task.)
