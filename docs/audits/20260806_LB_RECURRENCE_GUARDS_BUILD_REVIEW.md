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
| **Suite / build / lint** | Full suite **7153 passed / 0 failed** (post-review-fix); `vite build` green; **0 new lint** (one pre-existing `no-unused-vars` at `tournamentBanking.test.js` HEAD:715 predates this change — filed below). |
| **Review** | High-effort adversarial review regardless of diff size (spec + §2, operational form): two independent reviewers on disjoint lenses (invariant-correctness; live-regression + test-integrity), findings refuted independently. **6 CONFIRMED → 3 fixed on-branch (A-F1 gate hardening, B-F1/B-F2 test de-vacuation, mutants re-run and killed), 2 accepted-explicitly (§9-on-pathological-docs class), 1 ruled + closed out (B-F3, §6a). Attack lists in §5.** |

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
| `isWeekBanked` | `:1276` | Threshold (`≥5`) — **clamped per review A-F1** (Phase-0 called it clamp-neutral; the review refuted that on the only-day6+ edge, in the unrecoverable direction — identical on every doc with any day ≤ 5, incl. the zombie) |
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

**Lens A (invariant correctness) — returned.** Verified the committed `639f0bde` byte-identical to its reviewed tree (hash-checked; its transient mutants restored clean). Touched suites 203/203, adjacent suites 172/172, build green. **2 CONFIRMED (both LOW) · 10 attack classes refuted · 6/6 test mutants killed.**

- **A-F1 (LOW, CONFIRMED → FIXED on-branch):** on the doubly-pathological only-day6+ shape, `isWeekBanked` (unclamped: 7 ≥ 5 → true) and the clamped readers (no in-week entry → 0 / not-degraded) disagree — so the §7.2 gate flips from BLOCK to ALLOW and a post-L-C `runFridayAdvancement` could **permanently lock an all-zero result** (`tournamentAdvancement.js:311→335`, `:629→641`; executed repro). The exact direction F-1's rationale forbids (permitting is unrecoverable). Writer-unreachable (banking is contiguous from day1; Guard 1 stops day6+ — hence LOW), but the Phase-0 "clamp-neutral" classification of `isWeekBanked` was proven wrong on precisely this edge. **Fix:** `isWeekBanked` reads the clamped entry — identical on every doc with any day ≤ 5 (incl. the real zombie: clamped day5 → 5 ≥ 5 true), and the only-day6+ shape becomes a loud, recoverable "banking pending" no-op instead of a silently lockable zero. One definition of the week's final snapshot now covers the gate too (the F-1 principle, completed). Test-pinned both ways. _Deviation from the founder-approved Phase-0 classification, made because the review refuted its neutrality claim on this edge in the unrecoverable direction — flagged in the handoff for founder review._
- **A-F2 (LOW, CONFIRMED → ACCEPTED-EXPLICITLY, no code change):** on a >5-day doc, the seat "score of record" (clamped, −344) and the climb terminus/altitude/rank (unclamped `buildClimbSeries` doc-truth walk, −469.5) are two numbers on one screen (§9 class). Reachability today is nil-by-layers: Guard 1 stops new >5-day docs; the only existing one is VOIDED — excluded from `selectMyGroup`, excluded from the Command-Center live poll (`b3cb3b95`), and its arena render collapses to base-camp with score labels, rank digits, crown and cut suppressed (the (B) voided treatment), so the climb shows no contaminated number there. Clamping the series would contradict its deliberate walk-every-day design. **Disposition:** the acceptance is now explicit — §3's `buildClimbSeries` note names the terminus/altitude/rank render sites (`ClimbArena.jsx:76` via `seatAltitude`, `buildArenaModel.js:447-457` youRank) as doc-truth surfaces whose voided/terminal suppression is the gate. Any future non-voided >5-day doc re-opens this consciously, not silently.
- Notable refuted attacks (A): Guard-1 off-by-one boundary sweep + `>=`→`>` mutant killed; `already_recorded`-before-clamp precedence (deliberate: same-day re-runs stay quiet; the clamp + R-1 signal fire from the next ET day); garbage/non-contiguous day keys (day0/dayX ignored; day1+day7 pauses the week); `WEEK_DAYS_REQUIRED` TDZ default safe (zero-import module, no module-init caller); clamp-safety identity verified programmatically over contiguous 0–5-day docs; the manual `bank-daily-scores.js:117` seam refuted as production-impacting (nightly leaderboard upsert is independent) — noted for one PR sentence.

**Lens B (live-regression + test integrity) — returned.** Verified `getLatestDayEntry` byte-unchanged (`-U0` pure insertion), every live caller of the unclamped primitive untouched on well-formed AND zombie docs, ≤5-day byte-identity at every clamped-helper consumer, clamp placement/precedence mechanics, false-alarm timing across the real cron schedules, and the red-first mutation counts (Guard 1 removal → exactly 4 red; Guard 2 unwiring → exactly 5 red — matching §2's claim). Suites: 286/286 across the seven requested files + 164 across eight adjacent. **4 CONFIRMED.**

- **B-F1 (MED, test integrity → FIXED on-branch):** the R-1 test's content assertions were 2/3 vacuous — the fixture id `g-stalled` itself satisfied `toContain('stalled')`, and an incidental agent-score-read error line (the makeDb fake makes `fetchGroupAgentScores` throw) pre-satisfied the group-id check. Executed mutants M1 ("STALLED"→"WEDGED") and M7 (strip the group id) both survived. **Fix:** fixture renamed `g-full-week`; assertions run on the clamp line only (filtered on `week_complete_clamp`, exactly one), pinning the group id and the verbatim `appears STALLED`. **M1 re-run post-fix: killed** (1 red).
- **B-F2 (LOW/MED, test integrity → FIXED on-branch):** nothing pinned the signal to clamp-only skips — mutant M2 (`reason === 'week_complete_clamp'` → `result.skipped`) survived, i.e. a refactor could page "finalizer STALLED" on every routine same-day re-run without a red test. **Fix:** negative lock added — an `already_recorded` run through `bankAllTournamentGroups` asserts NO clamp/STALLED line. **M2 re-run post-fix: killed** (1 red).
- **B-F3 (MED, live behavior + stale contract text → RULED + CLOSED OUT, §6a below):** Guard 1 retires §7.2's documented self-heal. Pre-change, a week whose **day-5** snapshot banked carried (`agentScoresCarried`) healed when the next pass banked day6 with a fresh agent read — which is exactly the day6+ contamination L-B outlaws. Post-change that shape pauses **permanently**: banking clamps every day, the §7.2 gate refuses every tick, the manual `bank-daily-scores` endpoint is clamped identically — and the two nightly logs point at each other (banking: "investigate advancement"; advancement: "banking self-heals next pass (§7.2)" — now false, in four committed comment/log sites: `leagueTournament.js` §7.2 docstring, `tournamentAdvancement.js:333-334, :639-640, :449-450`). The pause itself is arguably the invariant working (over-blocking recoverable); the *contradictory operator guidance* and the un-recorded retirement of the self-heal are the defects. Not pre-decided here — advancement text is frozen-path territory and the semantics choice (bless manual-intervention vs sanction a heal path) is the founder's.
- **B-F4 (LOW, §9 on pathological docs → ACCEPTED-EXPLICITLY, same class as A-F2):** executed repro — on the zombie shape one arena model carries `seats[].score = −344` (clamped) beside climb terminus/`youRank` basis −469.5 and `pod.day = 8/5` (unclamped by design). Reachable only for pre-existing day6+ docs via an explicit groupId render; the voided treatment suppresses the climb's numbers there. Noted: `seatAltitude.js:15`'s comment asserts a seat-score↔series equivalence that no longer holds on these docs. Filed for the L-C/arena backlog with A-F2.

**Both lenses' verdict after fixes:** 6 CONFIRMED total (2 LOW Lens A, 4 Lens B) — **3 fixed on-branch** (A-F1, B-F1, B-F2), **2 accepted-explicitly and filed** (A-F2/B-F4, one class), **1 referred to the founder** (B-F3). Post-fix state: mutants M1/M2 re-run and killed; full suite **7153 passed**; build green.

## 6 · Founder decision + filed items

**6a · B-F3 — RULED (founder, 2026-08-06) and CLOSED OUT on-branch.** Ruling: **"day-5-carried ⇒ paused pending manual intervention." No heal path.** The old self-heal-via-day-6 resolved a degraded day 5 by making day 6 the week's result — it was the contamination mechanism, and its retirement is the fix working. A degraded final is a genuine human-judgment condition (why §7.2 refuses it), has never actually occurred, and a deliberate heal gets designed only with a real failure in front of us. Closeouts executed (comment/log-only, no behavior change):
1. The stale "self-heals next pass" texts corrected — `leagueTournament.js` §7.2 docstring, `tournamentAdvancement.js` base-layer + bracket comments and both refusal logs, and the advancement test's title/comment (which modeled the marker-clear as an overnight bank; it now models the operator's manual step). Reviewer B's fourth cite (`tournamentAdvancement.js` DEGRADE-HONESTY docstring, ~:449) makes no self-heal promise on re-read (it describes legacy resumed locks) and stands.
2. The two operator logs are now distinguishable from the log line alone: **banking clamp** = `"…the finalizer appears STALLED; investigate the advancement freeze…"` (with an in-line pointer distinguishing it from §7.2); **§7.2 refusal** = `"final snapshot degraded (agentScoresCarried) — needs MANUAL REVIEW; …no self-heal past day 5 (§7.2 / L-B B-F3)"`.
3. **L-C GATE NOTE (binding on the unfreeze report):** the L-C unfreeze report must state whether any BATTLE group is **day-5-carried** (`isFinalSnapshotDegraded` true) at flip time — such a week will pause under §7.2 with no self-heal, so the flip decision must be made knowing whether a manual review is immediately owed. (This joins the spec's existing L-C precondition: confirm the §7 scoring fix landed and no other poisoned cohort remains in BATTLE.)

**Filed, not fixed (BUILD_RULES §3):**
- A-F2/B-F4 (one class): climb terminus/`youRank`/`pod.day` are doc-truth on day6+ docs beside clamped seat scores — accepted explicitly (voided render suppresses the numbers today); `seatAltitude.js:15`'s equivalence comment is stale on those docs. L-C/arena backlog.
- Lens A's manual-endpoint seam: `bank-daily-scores.js:117` skips its leaderboard-upsert retry on the new reason — refuted as production-impacting (the nightly branch upserts independently); noted for one PR sentence.
- Lens A pre-existing: a null-VALUED top day key (`day9: null`) makes `getLatestDayEntry` return null → banking would re-bank day1 — byte-identical to pre-change behavior, requires a hand-written null entry.
- Pre-existing lint: `no-unused-vars` (`'name'`) in the `fetchGroupAgentScores` test fake — present at HEAD `tournamentBanking.test.js:715` (stash-verified), predates this change.

## 7 · Verification posture

Unit-provable end to end (both guards are pure-function behavior); no preview-only surface. The live zombie group is already VOIDED, so production exhibits the fix only via (a) tonight's banking run logging nothing new (no BATTLE group is past day 5) and (b) any future stall now pausing at day 5 with the R-1 line in the run log. L-C (unfreeze) must confirm, per the spec's out-of-scope note, that this §7-adjacent scoring fix landed **and** that no other poisoned cohort remains in BATTLE.

*Full suite 7151 passed · build green · 0 new lint · no fenced file edited · `TOURNAMENT_ADVANCEMENT_FROZEN` untouched.*
