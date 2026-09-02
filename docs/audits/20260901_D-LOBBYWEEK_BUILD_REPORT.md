# D-LOBBYWEEK — Build Report (lobby groups stamped the wrong week)

**Date:** 2026-09-01
**Branch:** `claude/lobby-groups-week-stamp-039arn`, cut fresh from `origin/main` `bd60837`. Clean tree. `git fetch origin` ran first (§3).
**Phase 0:** the read-only discovery + its founder rulings (R1–R4) precede this build; the pre-check script it delivered is `scripts/lobbyweek-stamp-precheck.js`.
**Flag:** none. This is a correctness fix and ships live on merge — there is no dark runway. No live flag was touched (`TOURNAMENT_ADVANCEMENT_FROZEN`, `WEEKLY_LADDER_PLACEMENT_ENABLED` untouched).
**Status:** pushed. **STOP for founder smoke.** No PR opened, no CI watched (§2).

---

## EXECUTIVE VERDICT

| # | Item | Verdict |
|---|---|---|
| 1 | Lobby/quickPlay formation stamps the **battle** week, not the formation week | **DONE** — `tournamentLobbyService.js:110` (lobby doc), `:372` (group doc) |
| 2 | `baseLayerWeek` re-stamped at FORMING→BATTLE (the lingering case) | **DONE** — `resolve-user-draft.js:207-209` |
| 3 | Same canonical helper pair, no second definition | **DONE** — one shared expression, `tournamentLobbyService.js:283` |
| 4 | A lobby-formed group is detected by the one-game-per-battle-week guard | **DONE, mutation-checked** — the guard bypass is closed |
| 5 | Write side proven at all 168 hours of an ET week, both DST regimes | **DONE** — mirrors the weekly-ladder read-side rigor |
| 6 | Slot path unchanged | **DONE** — not edited; its whole battery still green |
| 7 | **Existing production data corrected** | **NOT NEEDED — founder-ruled.** See §2. Do not re-litigate. |

**Suite:** `Test Files 528 passed | 1 skipped (529)` · `Tests 8819 passed | 62 skipped (8881)` · **exit 0**.
**Lint:** exit 0 on every changed file. **Build:** `vite build` → **exit 0**.
**Scope:** 5 files changed (+ the pre-check script committed earlier) — under the §2 review threshold, and Phase 0 Q6 found no settlement-path consumer, so the brief's `/code-review` trigger did not fire.

---

## 1. The defect, and what was built

A lobby/quickPlay group stamped `baseLayerWeek = isoWeekString(now)` — the week it was **formed** — while a lobby pod plays the **next Monday-open**. THE FIELD is a current-week equality query keyed on the ET-anchored battle Monday, so a mis-stamped pod was **absent from THE FIELD for the entire week it actually played**. The three restamp sites that would have healed it are gated on `isLiveDraft === true` (slot-path only), so the stamp was permanent.

**(i) Formation stamps the battle week.** `battleWeekKeyFor(nowIso)` (`tournamentLobbyService.js:283`) is ONE expression — `deriveBaseLayerWeek(deriveBattleStartWeek(nowIso))`, the canonical slot-side helper pair, never a local re-derivation — now shared by the mirror guard's conflict key (`:299`) **and** both formation stamps (`:110`, `:372`). Binding the guard's key and the stored key to one expression is deliberate: the week a pod is *filed* under and the week the guard *tests for* can no longer drift apart.

**(ii) Re-stamped at FORMING→BATTLE.** `resolve-user-draft.js:207-209` writes `baseLayerWeek: currentBaseLayerWeek(now)` — the ET-anchored **read**-side twin THE FIELD queries with — into the resolution `groupUpdate`. Formation-time derivation alone is not sufficient: a pod that lingers in FORMING past its formation-derived Monday battles a later week (there is no expiry backstop for a non-training lobby pod), and its formation stamp would stay wrong forever. The slot path's `effectiveBattleAnchor` restamp is the precedent.

The restamp is **gated twice, deliberately**:
- `targetStatus === GROUP_STATUS.BATTLE` — the FORMING→BATTLE transition only. The training on-demand path resolves to `AWAITING_OPEN` and has not started its battle; stamping there would be premature.
- `group.baseLayerWeek != null` — base-layer pods only. A **bracket** pod carries `bracketGameId` and never a `baseLayerWeek` (the `createTournamentGroupDoc` XOR, `leagueTournament.js:1526`), and bracket groups resolve through this very path — an unconditional stamp would have broken that invariant and silently changed the doc shape. Both gates are mutation-proven load-bearing (§3).

`currentBaseLayerWeek` was added to `resolve-user-draft.js`'s **existing** `src/constants/leagueTournament.js` import — no new `api/` → `src/` boundary, so no new dependency-surface guard was required (BUILD_RULES §4).

## 2. ⚠ The production pre-check: NO migration needed (founder-ruled)

**Recorded so no future reader re-litigates this.** `scripts/lobbyweek-stamp-precheck.js` was run against production before the fix was written. Result:

- **8 of 8** lobby-shaped groups carried a formation-week stamp — the defect was universal on that path.
- **All 8 were `isTraining: true`.** Training pods are excluded from THE FIELD (`selectBaseLayerField` filters `isTraining`) and from the leaderboard, so **there was no user-visible damage on disk and nothing to correct**. The two active rows were training pods in battle.
- **No competitive group was affected.** The live ranked group came through the **slot** path, which was already stamping the battle week correctly.

**Founder ruling: NO migration.** No historical correction was authored, and none is needed. The fix is forward-only.

## 3. Tests — every new row mutation-checked

Per §2, a row that cannot fail under the defect it names is not a guard. Each battery was proven able to fail:

| Mutation | Result |
|---|---|
| Formation stamp reverted to `isoWeekString(now)` (the pre-fix defect) | **exit 1 — the 7 new D-LOBBYWEEK rows red**, all 31 pre-existing rows still green |
| Restamp removed entirely | **exit 1 — the lingering row red** |
| Restamp made unconditional (both gates dropped) | **exit 1 — the bracket-XOR row and the AWAITING_OPEN row red** |
| All mutations reverted | green, exit 0 |

That the 31 pre-existing lobby rows stayed green under the first mutation is itself the finding: the old suite was structurally blind to this defect, which is why it shipped.

**Coverage added** (`tournamentLobbyService.test.js:575`, `:656`; `resolve-user-draft.test.js:242`):
- Formation stamps the battle week (`formGroupFromLobby`, `quickPlay`, and the lobby doc), each explicitly asserting the value is **not** `isoWeekString(now)`.
- **All 168 hours of an ET week, in both DST regimes** — the stamp equals the canonical battle-week derivation, and the read side (`currentBaseLayerWeek`) agrees with it on the pod's own battle Monday. This mirrors the weekly-ladder build's read-side rigor on the write side.
- A formed pod **is** in THE FIELD every ET day of its battle week, and is correctly **absent** during its formation week (the phantom-early presence is gone too).
- **The guard bypass is closed** (founder-flagged escalation): a second competitive entry in the same battle week as an existing **lobby-formed** pod is now blocked. The pre-existing mirror-guard battery only ever used a *slot* pod as the blocker — slot pods were always stamped correctly, so those rows passed even with the defect present.
- The restamp: lingering pod re-stamped; on-time resolution unchanged; bracket XOR preserved; AWAITING_OPEN not restamped.

The lingering fixture is modelled on the real production document the pre-check surfaced: created 2026-07-01 (formation derives `2026-W28`) but first banked 2026-07-15 (`2026-W29`) — it sat through two Mondays.

## 4. Blast radius — DE-ESCALATED, and corrected at its source

Phase 0 measured every `baseLayerWeek` consumer. **This is a DISPLAY defect plus a GUARD bypass — NOT a settlement defect:**

- **THE FIELD** current-week query (`src/services/tournamentGroupService.js:322`) — display. The primary symptom.
- **The one-game-per-battle-week guard** (`findActiveGroupInBattleWeek`, `liveDraftFormation.js:285`) — a false-**negative** only, one-directional (the stored key is always exactly one ISO week early, and the guard's query key is always ≥ the pod's true battle week, so it can never false-positive).
- Season/ladder decomposition, participant/spectator/dev screens — display **labels** only.
- **No settlement path keys on `baseLayerWeek`:** the monthly board buckets on `dailyScores.day1.recordedDate` (`tournamentLeaderboard.js:76-77`) and keys per-week rows on `groupId` (`:198`, `:382`); placement points come from group composites (`:160-183`); banking/sweep/orchestrator select by **status**; advancement keys on `bracketGameId`. `tournamentBanking.js`, `canonicalOpenSweep.js` and `tournamentOrchestrator.js` contain zero `baseLayerWeek` tokens.

**Stale framing corrected at its source.** `liveDraftFormation.js:219` previously asserted a formation-week key mis-files a pod in "the base-layer cohort / **leaderboard / advancement** (all `baseLayerWeek ==` scoped)". That was measured and is **false** at this HEAD; the docstring now says so explicitly and names the measurements, so the wider claim is not re-inherited. The same claim in `docs/audits/BASE_LAYER_WEEK_FORMATION_VS_BATTLE_WEEK_BACKLOG_2026-08-28.md` is corrected by a superseding banner at the top of that file — its original analysis and citations are left **byte-intact**, per the README's immutability rule.

## 5. Register — reported, not fixed (BUILD_RULES §3)

| ID | Finding | Anchor |
|---|---|---|
| **D-DEVFIELD** | **`isDev` does not gate THE FIELD.** `selectBaseLayerField` filters only `isTraining` and `VOIDED`, so a dev-seeded group whose `baseLayerWeek` matches the current week **can leak into production standings**. `isDev` excludes only from the leaderboard. Founder-logged 2026-09-01, explicitly **not** this fix. | `src/constants/leagueTournament.js:776` vs `api/admin/seed-tournament-group.js:76,81` |
| **D-SEEDWEEK** | The dev seeder repeats the formation-week stamp. Harmless today only because a seeded pod plays the week it is stamped — same code smell, not the same bug. | `api/admin/seed-tournament-group.js:76` |
| **D-WEEKMEMO** | Read-side `useMemo(…, [])` staleness across the ET week boundary. No collision with this work (write-side vs read-refresh). | `src/hooks/useRealLeagueState.js:59-61` |

## 6. What I did NOT do

- **No fenced file** read for edit or edited. No fenced function called.
- **No schema change** — the fix writes an existing field with the right value; the `bracketGameId | baseLayerWeek` XOR is explicitly preserved and tested.
- **No migration** — founder-ruled unnecessary (§2).
- **No flag touched**; no new cron.
- **No PR, no CI watched, no merge driven** (§2).

*Anchors verified at the commit this report ships in; re-verify before relying, per BUILD_RULES §3.*
