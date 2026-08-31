# Weekly Ladder — Build Report + Cumulative Code Review

**Date:** 2026-08-31
**Spec:** `20260831_WEEKLY_LADDER_BUILD_SPEC_V1` (authoritative) · reads with the Phase 0 anchor-confirm (`docs/audits/20260831_WEEKLY_LADDER_PHASE0_ANCHOR_CONFIRM.md`) and the Phase 0 discovery.
**Branch:** `claude/weekly-ladder-build-bmf4uy`, cut fresh from `origin/main` `a2bd72b5`. Clean tree. `git fetch origin` ran first (§3).
**Flag:** `WEEKLY_LADDER_PLACEMENT_ENABLED` — ships **false**. Flag-off is byte-identical and asserted, not assumed.
**Status:** pushed. **STOP for founder smoke.** The flip is a separate one-line PR.

---

## EXECUTIVE VERDICT

| # | Acceptance criterion (spec §Acceptance) | Verdict | Evidence |
|---|---|---|---|
| 1 | 3/2/1/0 by day-5 finish order; training awards nothing | **MET** | `tournamentLeaderboard.placement.test.js` — the award table, order-of-record, and the training pod that never reaches the aggregation |
| 2 | Board sorts on cumulative placement points; margin tiebreak testable on a constructed tie | **MET** | `weeklyLadderSurface.test.js` — placement DESC, a constructed margin tie, a constructed full tie |
| 3 | Re-running finalization does not double-award (red-first) | **MET, mutation-checked** | see §3 — the guard was proven able to fail |
| 4 | CPU seats appear, archetype-named, visually marked, eligible for any position | **MET** | CPU-on-top test; `displayName` is `cpuAgentName`; BOT chip + muted name |
| 5 | Season surface renders on the League path and decomposes per-week (§9) | **MET** | `DeskSeasonRail` on the lobby rail; `decomposeEntryWeeks`; render battery |
| 6 | No new cron; career `tournamentRanks` + `cpuFarmGuard` untouched | **MET** | 39/40 crons unchanged; no career-rank import added |
| 7 | Flag-off byte-identical; board scores as today | **MET** | exact flag-off key-set assertion + dark render photograph |
| — | Week boundary (D-WEEKBOUNDARY) fixed | **MET** | read/write agree at all 168 hours of an ET week |

**Suites:** `Test Files 512 passed | 1 skipped (513)` · `Tests 8456 passed | 62 skipped (8518)` · **exit 0**.
**Lint:** exit 0 on every changed file. (Repo-wide `eslint .` reports 1678 pre-existing problems in `tracer/`, `vite.config.js` etc. — this build adds none.)
**Build:** `vite build` → **exit 0**, `✓ built in 27.15s`.

---

## 1. What was built

**The award (§1).** `placementPointsFor` / `PLACEMENT_POINTS` — the frozen 3/2/1/0 table. `buildPlacementForGroup` derives per-seat placement and composite margin **purely from the group doc**: the finish order is `rankByScores` over each seat's `getWeeklyComposite`, which is exactly what `lockTopTwo` computes, so no new read and no second definition of "who won".

It ranks over **`groupMembers`**, not `players`. Those hold the same seats in the same order at creation (`leagueTournament.js:1459`), but `groupMembers` is the sequence `rankByScores` uses for its draft-order tiebreak — ranking anything else could yield a finish order disagreeing with the one the career path already recorded for the same week. A test pins this by reversing `groupMembers` under a constructed tie and asserting the placements swap.

**The month total (§2).** `placementPoints` and `compositeMargin` accumulate on the **same Σ-over-weeks grain** as the existing `points` — SET-not-increment, recomputed every write. The cumulative composite is retained as the stored tiebreak input, not dropped.

**The tiebreak and final ordering rule (§3).** Stated as spec §3 requires:

> **placement points DESC → cumulative composite margin DESC → cumulative composite DESC → `odUserId` ASC.**

The third key is a **refinement of founder decision D2, raised here for ratification** — D2 named placement → margin → `odUserId`. Review finding F2 (CONFIRMED, §4) showed the two-key form collapses to alphabetical-by-user-id on a mid-month flip. Composite is not a third scoring dimension: it is the value margin is derived from and the score this board ranked on all month, used only after both ladder keys tie. It changes nothing D2 decided about primary or secondary ordering.

**Final-only award (D1).** A week contributes its outcome only once `final` is true. The nightly pass rewrites in-progress rows with 0, so the season rank cannot churn on a day nobody finished.

**The surface (§5).** `LeaderboardCard` promoted: rows expand into the weeks that produced the total, read from the **stored** week values — never re-derived, so parts and whole cannot disagree (§9). CPU rows carry the archetype `displayName` plus a BOT chip and muted treatment. Mounted on the League path via `DeskSeasonRail`, a tab strip that keeps **THE FIELD's current-week view alongside** the season view, per §5.

**One ordering home.** `rankLeaderboardEntries` in `tournamentSurfaces.js` is the only comparator; `LeaderboardCard` no longer carries a local sort. This was the founder's explicit instruction and it is load-bearing: a second copy is how the season view and THE FIELD drift apart.

## 2. The week-boundary fix (not behind the flag)

`currentBaseLayerWeek` is the ET-anchored read-side twin of the write-side `deriveBaseLayerWeek`. `isoWeekString(new Date())` is pure UTC and advanced the queried week **4–5 hours early — Sunday 20:00 ET (EDT) / 19:00 ET (EST)** — emptying THE FIELD in that window.

**This fix ships live on merge, not behind the dark flag**, because it is a correctness fix and gating it would mean the bug persists until an unrelated flag flips. It is the one behavior change in this PR that is active flag-off. Asserted at **all 168 hours** of an ET week against the write side, in both DST regimes.

## 3. Idempotency — mutation-checked, as directed

The board is idempotent **by construction**, so the mandated red-first test would have passed vacuously. Per BUILD_RULES §2 and the founder's approval, the guard was proven able to fail:

| Step | Result |
|---|---|
| Guard as written | 17/17 pass, exit 0 |
| Month accumulator mutated `Σ over weeks` → `prior + row` | **exit 1 — 2 tests red: `expected 6 to be 3`, `expected 9 to be 3`** |
| Mutation reverted | 17/17 pass, exit 0 |

6 and 9 are precisely the double- and triple-award the guard names. Recorded in the test's own comment so the next reader knows it was checked.

## 4. Cumulative code review (BUILD_RULES §2 — mandatory at 12 files / 1073 lines)

Ran at high effort, then **every finding was handed to an adversarial reviewer instructed to refute it with an executable repro**. Two CONFIRMED, one REFUTED, two confirmed by direct structural read.

| ID | Finding | Verdict | Disposition |
|---|---|---|---|
| **F1** | The ET-anchored read regresses the lobby write path; a lobby group vanishes from THE FIELD in the Sunday window | **REFUTED** | Premise false — see below |
| **F2** | Mid-month flip: no backfill → every entry reads 0/0 → board goes **alphabetical by user id** | **CONFIRMED** | **Fixed** (composite fallback) + flip constrained to a month boundary |
| **F3** | Training-tab rail wires an opener that branch never renders → dead affordance + surprise docked pod | **CONFIRMED** | **Fixed** — opener removed on that branch |
| **F4** | Docking a pod unmounts the rail, silently resetting Season → The Field | **CONFIRMED** | **Fixed** — tab lifted and made controlled |

**F1 REFUTED, with numbers.** The finding's load-bearing premise — "before this change both sides used the same UTC call and always matched" — is false. The dominant **slot** path (`liveDraftFormation.js:301`) stamps the ET battle week and disagreed with the old UTC read at **154 of 168 hours** of an ET week. In the named window the lobby's UTC stamp coincidentally equals the *correct* battle week (`2026-W37`), and a current-week FIELD is right to omit a pod that plays next week. Measured across all 168 formation hours, the new read gives a group **more** FIELD time in 167 hours, **less in zero**.

**F2 CONFIRMED, and worse than first stated.** Repro: a board of five pre-flip entries came out `alpha-1 > bravo-2 > cpu-40 > mike-5 > zeta-9` — exactly alphabetical, with the worst performer (composite −8.9) at #1 and the best (+116.3) at #4. Two harms:
- *Transient:* total ordering collapse. **Fixed** — the composite fallback degrades to today's order instead of nonsense, with the all-pre-flip case now tested (the pre-existing "tolerates absent fields" test used a **mixed** doc and passed vacuously — a fair hit).
- *Permanent:* dark weeks count 0 toward the month Σ forever, so a mid-month flip under-scores the month (a 3-week month scoring out of 1 week) and shows "—" against weeks a player actually won. **Not fixable by ordering.** The flag docstring now requires a **month-boundary flip**, and records that if a mid-month flip is ever needed, a backfill is possible **from the month doc alone** — every seat's composite for a week is recoverable as `entries[*].weeks[groupId].points` across the four seats, so placement and margin can be re-derived without re-reading group docs.

**A defect I introduced and caught during the fix pass:** a bare `useState` in `LeagueLobbyDesktop`, which imports React as a default only. Neither eslint nor `vite build` catches that — it is a runtime `ReferenceError` that would have crashed the League desktop lobby for **every player, flag-off included**, since the line sits outside the dark branch. Fixed, and `DeskSeasonRail.render.test.jsx` now executes both flag positions through `renderToString` so this class cannot recur silently.

## 5. ⚠ A correction to my own Phase 0 report

**In the anchor-confirm I told you the lobby's `baseLayerWeek` stamp "self-corrects at draft fire," and you filed `tournamentLobbyService.js:349` on that basis. That was wrong.**

The three restamp sites (`liveDraftLifecycle.js:252/337/423`) are each gated on `isLiveDraft === true` (`:180`, `:284`, `:387`), and `isLiveDraft: true` is set in exactly one place — `liveDraftFormation.js:302`, the **slot** path. A lobby group has neither `isLiveDraft` nor `battleStartWeek`, so it never enters those functions. **The lobby stamp is permanent.**

The real consequence is larger than the transient cosmetic I described: a lobby/quickPlay pod formed any time from Monday's open through Sunday 19:59 ET is stamped with its **formation** week while it plays the **following** week — so it is in THE FIELD for **zero hours of the week it actually plays**. The same file already computes the right key at `:285` for its own mirror guard.

This is **pre-existing and unchanged by this commit** (identical before and after), so per §3 I have not fixed it. But the reasoning you filed it under no longer holds, so the filing is yours to re-make.

## 6. Register — reported, not fixed (BUILD_RULES §3)

| ID | Finding | Anchor |
|---|---|---|
| **D-LOBBYWEEK** | Lobby/quickPlay groups stamp the formation week, not the battle week; permanent (see §5). Pod is absent from THE FIELD for its whole battle week. | `tournamentLobbyService.js:109, 349` vs its own `:285` |
| **D-WEEKMEMO** | `useRealLeagueState`'s `currentWeek` is a `useMemo(…, [])` — a session open across the ET week boundary keeps a stale week until reload. Pre-existing; the fix makes the *value* right, not its refresh. | `useRealLeagueState.js:52-60` |
| D-CRON | BUILD_RULES §6 still says 37/40; actual is 39/40. | `docs/BUILD_RULES.md` vs `vercel.json` |

## 7. What I did NOT do

- No fenced file edited. `getArchetypeLabel` reaches the board only through the pre-existing `tournamentCpu.js` call.
- No new cron (39/40 unchanged).
- Career `tournamentRanks` / `cpuFarmGuard` untouched — the monthly board has no code path to that guard.
- No CPU eligibility exclusion built. A CPU may top the board; that is accepted and pre-ruled. Recorded in the flag docstring, along with the stated future state that CPUs come off the board as a **display change, not a data migration**, so their presence is not read as permanent.
- No PR opened, no CI watched, no merge driven (§2).

## 8. Founder decisions carried in

D1 final-only award · D2 ordering (**with the composite-fallback refinement in §1 for your ratification**) · D3 expand-in-place then mount, review run rather than scope shrunk · week-boundary fixed in-build · mutation check performed and recorded.

*Anchors verified at `a2bd72b5`/`59c1b1f4`; re-verify before relying, per §3.*
