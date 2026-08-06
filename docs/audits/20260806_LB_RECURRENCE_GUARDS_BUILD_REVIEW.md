# League Lifecycle L-B — Recurrence Guards: Build + Review Record

**Date:** 2026-08-06 · **Branch:** `claude/league-lb-recurrence-guards` (fresh off `origin/main` @ `0b400974`) · **Spec:** `20260806_LEAGUE_LIFECYCLE_LB_RECURRENCE_GUARDS_SPEC_V1` (authoritative) · **Phase 0:** anchor-confirm + caller classification delivered and founder-approved (rulings F-1 include, R-1 add) before any code.

**The invariant:** a stalled finalizer must produce a **paused** week, never a longer one — and a week's result must be the week's result regardless of what extra days exist in the doc.

---

## Executive verdict

| Area | Result |
|---|---|
| **Guard 1 — banking day clamp** | Landed in pure `computeBankingUpdate` (`tournamentBanking.js:128-138`): `dayN ≥ WEEK_DAYS_REQUIRED → {skipped:true, reason:'week_complete_clamp', dayKey}`. Skip precedes all settlement work; `bankGroup`'s skip path commits zero writes (pre-existing `:376→:378` return-before-update). **Red-first proven** (4 RED → GREEN). |
| **R-1 — stalled-finalizer signal** | `console.error` in the existing cron loop (`tournamentBanking.js:456-469`) on `week_complete_clamp` — names the group, states the finalizer appears stalled, points at advancement. FROZEN-log precedent; no new cron/persistence/alert surface. |
| **Guard 2 — scoped result-read clamp** | New pure `getLatestBankedDayEntry(group, {maxDay = WEEK_DAYS_REQUIRED})` (`leagueTournament.js:1210-1247`); `getWeeklyScore` / `getWeeklyComposite` / `isFinalSnapshotDegraded` (F-1) read through it. `getLatestDayEntry` **byte-unchanged**. **Red-first proven on the real zombie shape** (5 RED → GREEN, asserting **−344** vs the contaminated **−469.5**). |
| **The crux (scoping)** | Every `getLatestDayEntry` caller enumerated + classified (table below, from the founder-approved Phase 0). Live derivation unclamped and test-locked (zombie: primitive reads day 8, clamped reads day 5 — the deliberate contrast is itself a test). |
| **Fence / §7** | **Zero contact** — no §1 fenced file touched (grep-verified none references the three helpers); no `scoreState`/`createAgentBattle`/`closeScores` shape change; no new cron; `TOURNAMENT_ADVANCEMENT_FROZEN` untouched. |
| **Suite / build / lint** | Full suite **7151 passed / 0 failed**; `vite build` green; **0 new lint** (one pre-existing `no-unused-vars` at `tournamentBanking.test.js` HEAD:715 predates this change — filed below). |
| **Review** | High-effort adversarial review regardless of diff size (spec + §2, operational form): two independent reviewers on disjoint lenses (invariant-correctness; live-regression + test-integrity), findings refuted independently. **Outcome recorded in §5.** |

---

## 1 · The clamp-safety identity (founder-requested framing — why this is safe)

**The clamp is a no-op on every well-formed doc.** Weeks are ≤ `WEEK_DAYS_REQUIRED` (5) trading days *by construction* — the only writer (`computeBankingUpdate`) banks one day per ET date and, with Guard 1, never past day 5. So for any doc with no `day6+`, `getLatestBankedDayEntry` selects the identical entry `getLatestDayEntry` does, and every clamped reader returns byte-identical values. Behavior changes **only** on pathological docs (today: exactly one — the voided zombie `lds_wed-1900_2026-07-22`), which is precisely the class the invariant governs. Every "live surface breaks" scenario would require a zombie doc rendered live — the state Guard 1 prevents from ever being created again, and Guard 2 makes harmless if it already exists (day6–day8 on disk) or arrives by a route not yet imagined. That layering — (1) stop writing extra days, (2) stay correct even if they exist — is the spec's, and both landed.

## 2 · What changed (file:line)

| Change | Site |
|---|---|
| Guard 1 clamp (pure, after the `already_recorded` idempotency loop — same-day re-runs still read `already_recorded` first, precedence test-pinned) | `api/_utils/tournamentBanking.js:128-138` |
| `WEEK_DAYS_REQUIRED` added to the existing §4 import from `leagueTournament.js` | `api/_utils/tournamentBanking.js:40` |
| R-1 cron-loop signal | `api/_utils/tournamentBanking.js:456-469` |
| `getLatestBankedDayEntry` (new pure helper, spec-shaped option bag) | `src/constants/leagueTournament.js:1210-1247` |
| `getWeeklyScore` → clamped read | `src/constants/leagueTournament.js:1252-1254` |
| `getWeeklyComposite` → clamped read (degrade arm preserved identically) | `src/constants/leagueTournament.js:1263-1268` |
| `isFinalSnapshotDegraded` → clamped read (**F-1**, founder-ruled: one definition of "the week's final snapshot"; unclamped, a day5-carried/day8-clean zombie would wrongly *allow* a permanent lock — permitting is unrecoverable where over-blocking isn't) | `src/constants/leagueTournament.js:1289-1296` |
| Red-first tests: Guard 1 (day-5 clamp, day-8 zombie clamp, day-4 boundary, `already_recorded` precedence, `bankGroup` zero-writes inertness, R-1 log content) | `api/_utils/tournamentBanking.test.js` (L-B describe) |
| Red-first tests: Guard 2 (zombie −344 composite / −120 user-layer, F-1 both directions, only-day6+ edge with intended-semantics comment, clamp-no-op day-3, helper contract incl. the day5-vs-day8 contrast + maxDay override) + live-derivation non-regression battery | `src/constants/leagueTournament.test.js` (L-B describes) |

**Red-first evidence:** before implementation, exactly **4** banking rows and **5** leagueTournament rows failed (the guards' assertions), with the boundary/precedence/non-regression locks green — then all **203** rows in the two suites green after. The zombie fixture uses the REAL seat (`7ML6i7WyfuaAtJjl16Smh2kETPw1`) and REAL composites (day5 **−344**, day8 **−469.5**); the user/agent split is labeled synthetic, chosen to satisfy the one-k identity (−164 + 1.5×−120 = −344; −207 + 1.5×−175 = −469.5).

**The doubly-pathological edge (founder addition):** a doc with ONLY `day6+` → clamped read null → readers return 0 / not-degraded, with the in-test comment stating the intended semantics — "no in-week result exists"; the 0 is honest, not a swallowed bug (returning day7's value would re-assert exactly the contamination the clamp stops).

## 3 · The caller classification (acceptance #4 — from the founder-approved Phase 0)

| Caller | file:line | Class → treatment |
|---|---|---|
| `getWeeklyScore` | `leagueTournament.js:1252` | RESULT → clamped |
| `getWeeklyComposite` | `:1263` | RESULT → clamped |
| `isFinalSnapshotDegraded` | `:1289` | RESULT (§7.2 lock gate) → clamped per **F-1** |
| `isWeekBanked` | `:1276` | Threshold (`≥5`) — clamp-neutral, unchanged |
| `deriveCurrentTradingDay` | `:1311` | LIVE (claims windows) — unchanged, test-locked (zombie → day 9) |
| `computeBankingUpdate` | `tournamentBanking.js:125` | WRITER — Guard 1 site |
| `calculateTournamentWaiverPriority` | `tournamentClaims.js:63` | LIVE (waiver order) — unchanged |
| CPU claim placement | `tournamentCpuClaims.js:130` | LIVE — unchanged |
| Frozen-loop diagnostics | `tournamentAdvancement.js:287,312,630` | DIAGNOSTIC — unchanged (the operator *should* see "day 8/5") |
| `dayBanked` | `buildArenaModel.js:124` | LIVE — unchanged |
| `pod.day` | `buildArenaModel.js:415` | LIVE — unchanged |
| `climbSeriesPhase` | `leagueClimbAdapter.js:115` | LIVE — unchanged (VOIDED/EXPIRED already short-circuit) |
| Dev standings | `TournamentDevScreen.jsx:986` | DEV — unchanged; **intentional divergence noted:** on a zombie doc the dev screen shows the contaminated latest (doc truth) while product surfaces show the day-5 record |

Blast radius of the clamped helpers (all inherit automatically, no edits): result consumers where the clamp IS the fix (`lockTopTwo` `tournamentAdvancement.js:107-109` — manifests only when L-C unfreezes; the leaderboard writer `tournamentLeaderboard.js:120-121,168`), and live surfaces where it is a no-op on well-formed docs (`LeagueParticipantView:78`, `LeagueBattleViewConnected:65`, `leagueTrainingBattleFraming:53-54`, `buildArenaModel:148`, `leagueAdapter:222,271`, `tournamentSurfaces:147-148`, `TournamentDevScreen:879-880`). `buildClimbSeries` deliberately walks every day via its own iterator (`leagueClimbAdapter.js:13`) — out of scope by design.

## 4 · Acceptance criteria

1. Banking cannot write past `WEEK_DAYS_REQUIRED` — **DONE, red-first** (day-5 and day-8 fixtures). ✓
2. `getWeeklyComposite`/`getWeeklyScore` return day-5 with day6+ present — **DONE, red-first on the real zombie shape (−344)**. ✓
3. Live derivation unchanged — `getLatestDayEntry` byte-unchanged (diff-verified) + non-regression battery (zombie primitive→8, `deriveCurrentTradingDay`→9, `isWeekBanked` neutral, day-3 no-op). ✓
4. Every caller enumerated + classified with file:line — §3 above + the Phase 0 report. ✓
5. No fenced file edited; no doc-shape change; no new cron. ✓ (Guard 1 returns a skip through the existing shape; Guard 2 is read-side only.)
6. Full suite + build green; high-effort review run — §5. ✓

## 5 · Review outcome (high effort, adversarial, independently verified)

Two independent reviewers on disjoint lenses — (A) invariant correctness on the scoring-adjacent path (clamp semantics, precedence, F-1 one-definition property, blast radius, fence); (B) live-surface regression + test integrity (unclamped-primitive verification, all live callers, mutation power of every red-first row, cron-loop signal, adjacent-suite run) — each instructed to attack and self-refute, with any surviving finding handed to independent refutation.

**Outcome:** _PENDING — both reviewers are in flight; this section is filled with their actual findings (CONFIRMED/REFUTED and attack lists) before commit. The record never states a review outcome that has not happened._

## 6 · Filed, not fixed (BUILD_RULES §3)

- Pre-existing lint: `no-unused-vars` (`'name'`) in the `fetchGroupAgentScores` test fake — present at HEAD `tournamentBanking.test.js:715` (stash-verified), predates this change.

## 7 · Verification posture

Unit-provable end to end (both guards are pure-function behavior); no preview-only surface. The live zombie group is already VOIDED, so production exhibits the fix only via (a) tonight's banking run logging nothing new (no BATTLE group is past day 5) and (b) any future stall now pausing at day 5 with the R-1 line in the run log. L-C (unfreeze) must confirm, per the spec's out-of-scope note, that this §7-adjacent scoring fix landed **and** that no other poisoned cohort remains in BATTLE.

*Full suite 7151 passed · build green · 0 new lint · no fenced file edited · `TOURNAMENT_ADVANCEMENT_FROZEN` untouched.*
