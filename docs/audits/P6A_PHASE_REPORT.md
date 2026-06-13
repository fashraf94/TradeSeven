# P6a — Aggregation Data Layer: Phase Report (Composite · Seasonal Leaderboard · Career Rank · Recap Backfill)

**Phase:** P6a (the data half of the founder-approved P6a/P6b split; Spec §1.5/§4 P6)
**Branch:** `claude/peaceful-lamport-pzugpk` · cut from `main` @ `d0e62b0` · tip `7325a0b`
**Date:** June 12, 2026
**Stage 0 artifact:** `P6_STAGE0_REPORT.md` (delivered this session; rulings: **A-1 composite** with `finalUserScores` sibling, **A-2 waiver stays user-layer** (rationale recorded in the PR), **A-3** day-1 month attribution, **A-4** dev-namespaced docs, **B-1 ladder signed as proposed**, **B-2 math signed as proposed** — fully-padded weeks earn zero positive RP, consciously noted, **C-1/D-1** ratified for P6b, **split approved, P6a first**).
**Commits:** 5 (schema · aggregation+leaderboard · rank+advancement · rules+dev surface · code-review fixes), signed, suite green at every commit.

---

## 1. Executive verdict table

| # | Question | Verdict |
|---|---|---|
| 1 | The composite exists? | **YES — built, not surfaced-only** (the Stage 0 §1 finding). Every banking snapshot now carries `agentPoints` (cumulative, from the group's battles) and `compositePoints` (= agent + 1.5 × user via the ONE `computeComposite` home); `getWeeklyComposite` keeps the final-snapshot-never-a-sum identity. |
| 2 | Ruling A-1 honored? | **YES** — `lockTopTwo` ranks by composite; bracket `finalScores` are composite with the `finalUserScores` sibling; champion + recap follow; `recap.finalComposite` (the P3b contract) is **closed** — the championship week's composite, live. |
| 3 | Seasonal leaderboard? | **SHIPPED** — month-keyed docs (`tournamentLeaderboards/{YYYY-MM}`; reset = a new key, nothing deleted); idempotent SET grain (`entries.{uid}.weeks.{groupId}` — re-run = same totals, test-locked); signed totals never floored; CPU rows marked; names denormalized; nightly writer rides the snake-draft handler as the third fire-walled tournament branch. |
| 4 | Career rank? | **SHIPPED** — `tournamentRanks/{odUserId}`; the founder-signed B-1 ladder + B-2 math live in the schema module (every value a config entry); the CPU-farm guard active in the writer (gains only); ratchet floors permanent, no debt; full per-week audit events (`raw/guard/delta` from ONE computation); writer rides the Friday advancement at game lock — idempotent per (player, group). |
| 5 | Zero new cron entries? | **YES — 38/40 untouched.** Hosts: the nightly handler (third branch, after banking), the Friday duty, the existing claim/flip-free manual endpoints. |
| 6 | Zero fence contact? | **YES** — no fenced file edited. Fenced exports *called* read-only: `getArchetypeLabel` (agentArchetypeConfig.js; the tournamentCpu.js precedent). Fence-grep proof rides the PR. |
| 7 | Rules? | Two new read blocks (`tournamentLeaderboards`, `tournamentRanks` — authenticated read, Admin-SDK-only writes; rank deliberately NOT on owner-writable `users/{uid}`). **Manual Console deploy required** — the standing caveat. |
| 8 | `/code-review` (mandatory at 19 files)? | **RUN at max effort** — 9 finder angles + verification + gap sweep; ~30 corroborated findings → all confirmed items fixed in `7325a0b` (§5). |
| 9 | Tests | **2,632 passing** (2,568 at P5 + 64 new across six batteries); client build clean; lint delta = baseline classes only (the 5 pre-existing `process` flags, count identical via stash comparison). |
| 10 | Dev posture (A-4)? | **Production docs can never see smoke data**: dev groups → `dev-{YYYY-MM}` / `dev-{uid}`; materialized brackets inherit `isDev`; the sweep skips dev brackets on production ticks; both side-effect halves route from ONE namespace decision. Test-locked. |

## 2. What the founder should know in three sentences

The composite is real: every nightly banking pass now writes each player's agent-layer cumulative and the composite of record into the same snapshot it always wrote, the Friday lock advances on that composite (with the user-layer detail kept alongside), and the champion recap's `finalComposite` is live — the last open P3b contract, closed. The seasonal leaderboard and career rank exist as server-written, client-readable collections: month docs that "reset" by simply starting a new key, and rank docs that apply the signed ladder/guard/ratchet math once per finalized week with a full audit trail — and on your padded dev bracket the guard will visibly pay **zero** positive RP, which is the B-2 ruling working, not a bug. The review pass made the finalization loss-proof: a group can no longer complete (and a champion can no longer be crowned) until its rank and leaderboard writes have actually landed, every applied game carries a durable stamp, and smoke data is structurally fenced out of the production boards.

## 3. The deliverables (file:line at tip `7325a0b`)

**Schema + signed math — `src/constants/leagueTournament.js`**
- `computeComposite` (`:341-343` region) — THE home for k; `getWeeklyComposite` (final snapshot; pre-P6a snapshots degrade honestly); `WEEK_DAYS_REQUIRED`/`isWeekBanked` hoisted (advancement re-exports); `monthKeyFromEtDate` / `leaderboardDocId` / `rankDocId` (rulings A-3/A-4); `rankByScores` (ONE comparator home — four copies converged); `round2`.
- **The founder-signed tables (B-1/B-2):** `RANK_TIERS` (Intern 0 → Market Legend 11,000), `RANK_TUNING` (scale 1.0; placement 100/66/33/0), `tierForRp`, `cpuFarmGuard` (1 − cpuOpponents/3, gains only), `computeRankBreakdown` → `{raw, guard, delta}` (math AND audit from one computation), `applyRankWeek` (ratchet: floors permanent, within-tier slide, no debt). Every value is a config entry — recalibration is an edit here, nowhere else.
- `createBracketGame` gains `finalUserScores` + `sideEffectsAt` (the finalization completion record).

**Banking composite — `api/_utils/tournamentBanking.js`**
- `fetchGroupAgentScores`: one field-masked equality query (the ledger precedent) summing `scoreState.currentScore` per owner over the group's tournament battles; joint-stamp safety; poisoned-score skip.
- `computeBankingUpdate`: snapshots gain `agentPoints` + `compositePoints`; **two carry-forward arms** (whole-read failure → carry all; per-owner hole → carry that owner) so a cumulative standing never regresses on a read artifact; the durable `agentScoresCarried` flag on degraded day entries; waiver priority **stays user-layer** (ruling A-2, comment cites the rationale).
- The manual `bank-daily-scores` endpoint mirrors the cron path and upserts the leaderboard for smoke parity (retrying even on the idempotency skip — sticky-failure fix).

**Seasonal leaderboard — `api/_utils/tournamentLeaderboard.js` (new)**
- Month-keyed whole-doc upserts; `entries.{uid}` = `{displayName, isCpu, points (signed Σ weeks), weeks{groupId → {points, userPoints, final, …}}, currentGroupId}`; cohorting by (namespace, month); name resolution from `users/{uid}` with CPU names from the ONE `cpuAgentName` home (tournamentCpu.js); the `dev` override so advancement routes both halves from one decision; the **1 MiB ceiling priced in the header** (~3–5k players/month; per-entry sharding MUST land before open registration — P6b/P8 checklist).
- `aggregateTournamentLeaderboards` rides the nightly handler (`api/cron/snake-draft-daily-scores.js:486-499`) after banking, fire-walled like its two siblings.

**Career rank — `api/_utils/tournamentRank.js` (new)**
- `applyGroupWeekToRanks` / `applyLockedGameToRanks`: once-only per (player, group) via `appliedGroups`; full audit event per week (capped history); CPUs accrue, marked; refusal-with-loud-error on incomplete `finalScores`; dev namespace per A-4.

**Advancement — `api/_utils/tournamentAdvancement.js`**
- `lockTopTwo` → composite + `finalUserScores` (`rankByScores`); `buildChampionRecap` → `finalComposite` live.
- **The finalization mechanism (code review):** ONE side-effect core (`runWeekSideEffects`) + the per-entry `sideEffectsAt` stamp; group completion, the stamp, and the champion write are all **gated on a clean pass** — a caught failure defers (the group stays in the battle query; the withheld duty marker re-ticks it), the sweep resumes any unstamped entry from the bracket alone at zero cost for stamped ones, and the terminal game must be stamped before the champion can be crowned. Base-layer groups (no bracket) are protected by the completion gate itself.
- Dev integrity: unified `bracket.isDev || group.isDev` everywhere; materialized brackets inherit an all-dev cohort's flag; the sweep skips dev brackets on production ticks (the P4 companion-(a) posture, now loophole-free).
- Degrade honesty: finalizing a week whose final snapshot carries `agentScoresCarried` logs loudly and counts `summary.degradedLocks` — **whether such weeks should refuse to lock is a founder decision (§7.2), not improvised.**

**Rules + client + dev surface** — `firestore.rules:327-341` (two blocks, Console-deploy caveat); `subscribeLeaderboard`/`subscribeRank` (`src/services/tournamentGroupService.js`); dev screen: leaderboard card (signed composite rows, CPU chips, teal you-row, red negatives), career-rank card (tier/RP/floor + per-week `raw · guard · Δ` audit lines — the guard made visible), Standings card now sorted/led by the composite of record with the agent/user split and the degrade marker, smoke steps 18–19.

## 4. Founder smoke script (dev screen header, steps 18–19)

**18 — Composite week + leaderboard:** run the bracket arc (steps 10–13). Each "Bank scores" click writes `agentPoints`/`compositePoints` into the snapshot and upserts the **dev** month doc — the Leaderboard card fills after the first bank (composite rows, CPU chips, your teal row). Negative case: flip a winning pick short before banking — the row goes red and stays ranked where it falls. Re-bank the same day: idempotency skip, totals unchanged.
**19 — Rank + guard:** the Friday duty applies career rank at each game lock. On the padded dev bracket expect `raw > 0 · guard ×0 · Δ +0` — **the B-2 ruling working** (fully-padded weeks earn zero positive RP; tier crossings are locked by the unit battery and observable in the first real-population weeks). Re-run: `rankApplied 0`, no double application — and re-runs are free (the `sideEffectsAt` stamp). The champion recap line ends with `final composite N`.

## 5. Code review (mandatory; max effort — 9 angles, verification, gap sweep)

All confirmed findings fixed in `7325a0b`. The ones worth knowing about:

| Finding | Severity | Fix |
|---|---|---|
| Base-layer groups: a CAUGHT side-effect failure still completed the group — with no bracket entry, the week's RP/leaderboard row was permanently orphaned and the duty marker then set cleanly | **Severe** | Completion gated on a clean pass; the group stays in the battle query and the withheld marker re-ticks it (test-locked both ticks). |
| The sweep's leaderboard heal was gated on `rank.applied > 0` — a leaderboard-only failure after rank success was never retried once the group completed | **Severe** | ONE core runs both halves unconditionally; the `sideEffectsAt` stamp (written only after a clean pass) is the resume key. |
| The champion write proceeded despite failed terminal side-effects — the completed bracket then left the sweep forever, orphaning the championship week | **Severe** | The champion write is gated on the terminal game's stamp; withholding retries next tick. |
| Dev-namespace asymmetry + the materialization fallback dropping `isDev` → a rebuilt dev bracket would have re-applied smoke RP onto PRODUCTION rank docs (per-doc idempotency can't block a namespace switch) | **Severe** (A-4 violation) | Unified `bracket‖group` derivation at every site; materialized brackets inherit the all-dev cohort flag; the leaderboard gains the caller-resolved dev override (test-locked, incl. the materialization case). |
| The sweep had no dev filter — a wedged smoke bracket could withhold the production Friday marker every tick | High | Production ticks skip dev brackets (the dev duty surface owns them). |
| Per-owner carry-forward hole: an owner whose battles vanished from a *successful* read regressed to `agentPoints: 0` in a cumulative snapshot | High | Per-owner carry with a loud warning; finite-guards stop NaN perpetuation and poisoned scores. |
| Silent agent-layer degrade: a week-long battles-read failure would lock k×user composites with zero error surface | High | The durable `agentScoresCarried` snapshot flag + `degradedLocks` counter + loud log; **refusal is the §7.2 founder decision**. |
| The sweep re-read 4 rank docs + profiles per locked game per evening tick; terminal Fridays triple-applied intra-tick | Efficiency | The stamp makes repeat ticks free (checked on the bracket doc already in hand). |
| Four tie-break comparator copies; the rank writer re-derived `raw`/`guard` beside the signed function; a third eligibility-query copy; duplicated round2/toIso/CPU-name constructions | Convergence | `rankByScores` + `computeRankBreakdown` + `fetchEligibleGroupsByStatus` reuse + shared `round2`/`toIso`/`cpuAgentName` homes. |
| Dev surface: the Standings card still sorted by user-only points (contradicting the lock on the verification surface itself); the month fallback used the UTC month | Surface | Composite-sorted standings with the agent/user split + degrade marker; ET month fallback. |

**Dispositioned, not changed (priced in code/report):** per-group month-doc transactions at lock time (G ≤ 4 at V1, once-ever per game with the stamp); nightly `users/{uid}` name-freshness reads (small at launch); the manual endpoint's post-bank group re-read (1 read, smoke path); `final`'s status arm (forward-correct for manually completed weeks); fetchGroupAgentScores' full weekly recompute (buys late-completion self-healing, priced in code).

## 6. Known edges + notes

- **Crons don't run on preview** (BUILD_RULES §6): the nightly third branch and the Friday rank application were exercised through the unit/integration batteries + the dev duty surface; the first production tick (quiet skip lines, zero groups) is the live observation point. Nothing here is claimed "preview-tested" as a cron.
- **firestore.rules** for the two new collections requires the manual Console deploy (standing caveat; inert until deployed — the dev cards are the first readers).
- A persistently failing group/bracket now **wedges the Friday duty marker by design** (completion withheld until side-effects land) — loud, founder-visible, the banking-pending posture. A poison group is a founder-attention event, not silent loss.
- The leaderboard month doc is one whole-doc board: **the 1 MiB ceiling (~3–5k players/month) is priced in the module header; per-entry sharding must land before open registration** (P6b/P8 checklist item).

## 7. Founder decisions surfaced by this phase (not improvised)

1. **CPU identity pooling (from the review's gap sweep):** leaderboard/rank rows key by `odUserId`, and `cpu-1..n` are deliberately reused across groups, rounds, and brackets (the B1 per-round-uniqueness design) — so one CPU id's month row sums every seat it was padded into, and `tournamentRanks/cpu-1` accrues RP from all of them. Bounded at V1 single-bracket scale, and the per-group `weeks` map makes any later re-aggregation lossless — but whether CPU rows should pool, split per seat, or be excluded from the month *sort* is a P6b ruling. Recommend deciding before the leaderboard surface ships.
2. **Degraded-lock refusal:** weeks finalized from `agentScoresCarried` snapshots currently proceed (loud + counted on `degradedLocks`). Should advancement REFUSE to lock such weeks until the agent layer reads clean? Recommend: yes for bracket games (banking self-heals next pass), founder to confirm.
3. **Recorded for P8 hygiene:** the four pre-P6a private `toIso` copies (P3-era modules) converge on the new `tournamentTime.toIso`; the leaderboard sharding checklist item; the review's out-of-scope note that dev run-duty (includeDev) also processes production groups (pre-existing superset semantics, unchanged).

## 8. P6b hand-off (cuts fresh off main after this merges)

Consumes: `getWeeklyComposite` + the snapshot fields (surfaces), `tournamentLeaderboards/{YYYY-MM}` + `subscribeLeaderboard` (month nav = doc keys), `tournamentRanks/{uid}` + `subscribeRank` (tier/floor/progress; the audit events power the rank surface's week lines), `currentGroupId` (tier-2 spectator entry), `cpuAgentName`, the ratified C-1 feeds (derived fields on the month doc, written by the same nightly branch) and D-1 vocabulary (`formed/broken/flipped`, `side: 'user'`, ledger home + feed entry — the detection hooks were verified at Stage 0 §3.4). Owns: leaderboard/rank/spectator surfaces, feeds, the user-side double-down, and the §7.1 CPU-row ruling's implementation.
