# Trader game replay pack — rescore, schedule, cost census

**Date:** 16 Nov 2026 (prompt of 15 Nov 2026) · **Branch:** `claude/trader-game-replay-pack` from `origin/main` at `71bc6bde` · **Mode:** offline scripts over a read-only production export. No product code changed; no production write. Model calls only in Part D, after the founder's approval (16 Nov 2026): **$1.35 spent** of the $5 cap. Part E was added with that approval.

**Basis:** `docs/audits/20261115_PHASE0_BAGGERBOMB_TRADER_GAME.md` (draft PR #1070, read from `origin/claude/phase0-baggerbomb-trader-game`), Part G and sections C2, D1.

**Review:** the branch crossed the review threshold when Parts D and E were added. The four-lens adversarial review is recorded in `docs/audits/20261116_REPLAY_PACK_REVIEW.md`. Its corrections are in this report; where a number changed, the finding id is cited (for example "review B1").

## Preamble

- **Session opening (BUILD_RULES §2, §3).** `git fetch origin` ran first. The worktree branch was renamed to `claude/trader-game-replay-pack`; HEAD `71bc6bde` equals `origin/main`; tree clean.
- **Model.** Opus 5.5, as the prompt asks.
- **Production** (project `tradeseven`), read once on 16 Nov 2026 at about 12:27 PM ET by `exportReplay.mjs`: one `where('gameMode','==','baggerbomb_agent').get()`, then `.get()` on each battle's subcollections (including `tape/{day}/series`) and on the top-level `learningReceipts/{id}/receipts`. The script holds no write call; it was searched for `.set( .update( .add( .create( .delete( batch runTransaction` before it ran (the only hits are JavaScript `Set`/`Map` calls).
- **Exports** are in a folder outside the repository (`Documents/FantasyTrades/BaggerBombTraderGame/replay/` under the founder's profile), one file per battle, named by ordinal. Every battle id, owner id and agent id is replaced inside the files by an ordinal (`battle-001`, `acct-01`, `agent-01`). The scan of every written file for every mapped id found 0 hits. After review finding X3, a scan for any token shaped like an account id (28 letters and digits) was added to the script; run over the existing files, it also finds 0. This report uses battle ordinals only.
- **What stays in the out-of-tree export** (review X4): rule, watchlist and story document ids (20 characters, not account ids), the three agent names, chat messages and watchlist names. None of them appears in this report.
- **What the id replacement changes** (review X2, X6): stored content hashes computed over an id (a measured receipt's `receiptHash`, a manifest's `manifestHash`) no longer match their rewritten content. 8 request texts are 42 bytes shorter than what was sent. No part recomputes a hash, and Part D checks each resent request against the stored SHA-256.
- **Determinism.** Parts A–C and E read only the export, and Part D's `analyze` step reads only saved files. Each ran twice and once under `TZ=UTC`; the outputs were byte-identical. Part D's `live`, `submit` and `collect` steps use the network and, for latency, the clock.
- **Fence (BUILD_RULES §1).** Called, not edited: `calculateAssetScoreServer` and `flattenPortfolioServer` (`api/_utils/agentScoring.js`). Also called (not fenced): `stockRewardContext`, `initialRewardHistory`, `stockModelRoute`, `positions`, `isStock` (`src/utils/stockThresholdModel.js`). No scoring math is copied (§4). No legacy archetype table is imported (§2.3 ratchet untouched).
- **Part D** did not run in the first pass: the first prompt did not end with `PART D APPROVED, $5`. The founder then sent that line on 16 Nov 2026, with Part E. Part D ran on the existing export, with no new production read: 350 batch requests and 30 live calls, using `CLAUDE_API_KEY` from the local environment (never printed). **Actual spend: $1.35.**

### Founder rulings (15 Nov 2026), verbatim

| # | Ruling |
|---|---|
| BB-14 | Bank on exit is rescored on past battles before it is built. |
| Q20 | A script may hand the real scorer a reset touch record. It edits nothing. |
| Q21 | Scope: the exit rule only, on the battles with complete data. |
| BB-23 | Measured before adopted: the agent's scheduled check moves from every 15 minutes to every 30, plus event checks (a fill, a big move, a cockpit command). |
| BB-24 | Proposed, measured before adopted: the trading brain moves from Claude Haiku 4.5 to Claude Haiku 5.5. |

## Summary

| Part | Headline | Sample |
|---|---|---|
| Export | 50 agent-mode battles from 10 Aug; 49 completed (36 legacy, 13 measured), 1 in progress today and left out. Matches Phase 0's counts exactly. | 50 battles |
| A — bank on exit | 43 of 49 completed battles reproduce their stored score; under bank on exit **5 change and 1 winner flips** (a measured battle, where the CPU loses 45 points). Mean change −2.9 points for the agent, −3.5 for the CPU. 25% of the bonus points on record (275 of 1,100) came from positions whose last price no longer cleared the level. Those 1,100 points are the agent side in all 43 battles plus the CPU side in the 13 measured ones. **Every lost bonus was on a position held to the end; no sold position ever carried a bonus.** | 43 battles, 453 positions |
| B — 30-minute schedule | Today the model is called on 78% of checks (459 of 589). It answered 398 of those calls and **returned a hold on 81.4% (324 of 398)**; the code's own checks blocked 59 of its 74 swaps, so 96.2% (383) ended as holds. The other 61 calls failed into a fallback hold. The schedule cuts model calls from **14.8 to 9.4 per battle-day** at X = 0.5. Of the 15 executed model swaps, 9 fell on checks the schedule skips; event checks catch 1; **8 are missed at every X**. Waiting 15 minutes for them is **small and mixed**: **+11 points in total** priced the way the stored fills were (one check earlier; 4 gains, 3 losses), or −10 priced at each check's own minute. No case exceeds ±14. | 31 battle-days, 589 checks |
| C — cost | No request carries `cache_control` today. About 71% of each request repeats between consecutive checks of a battle and already sits at the front. Four cost rows below; the schedule cuts each by 32–37%. | 459 calls (52 estimated) |
| D — model comparison | **$1.35 spent.** Every arm returns valid tool calls (99–100%). Haiku 4.5 rerun agrees with its own stored decision 90% of the time (all holds, 80% of swaps). **Haiku 5.5 returns a hold on almost every stored swap**: 1 of 74 swaps again at default effort, 2 at low, and 0 of the 15 swaps the code executed. It agrees on holds (99–100%). It uses no thinking tokens (the forced tool call skips thinking). A call costs $0.0028 at list price against Haiku 4.5's $0.0245, and the median latency is 5.9 s against 18.4 s. | 150 calls × 2 arms + 50 |
| E — narrower gate | If nr7_contraction and bench_outperformance can no longer wake the model on their own: **8.5 calls per battle-day, 3 of 15 executed model swaps missed**. With the 30-minute schedule as well: **6.2–6.5 calls per battle-day, 8–10 missed**. The range depends on how long a news story left unseen by a dropped call keeps waking the model. | 31 battle-days |

**The four cost rows** (per battle-day, list prices of 15 Nov 2026; Haiku 5.5 rows assume 1.3× tokens and exclude thinking — see C5):

| Row | Today's checks | 30-min schedule, X = 0.5 |
|---|---|---|
| Haiku 4.5 as sent today | **$0.354** | $0.225 |
| Haiku 4.5, repeating prefix first, cached 1 h | $0.226 | $0.153 |
| Haiku 5.5 as sent today | $0.046 | $0.029 |
| Haiku 5.5, repeating prefix first, cached 1 h | $0.029 | **$0.020** |

## The export (prompt §3)

`scripts/experiments/trader-game-replay/exportReplay.mjs` follows `scripts/calibration/export-agent-battles.js` (it imports that file's `serialize` and `parseEnvFile`): one single-field equality query, the date window applied client-side on the first trading day (`timing.tradingDays[0]`, else the creation date).

Per battle it reads the record (with `evaluations[]`), `learningReceipts/{id}/receipts` and `ticks`, as §3 lists, **plus four sources §3 does not name**, each needed by one part:

- `tickBodies` (Part C): the request text and the response usage. The permanent `ticks` row holds input and output tokens only, not cache tokens or the request.
- `calls` (Part B): the cockpit commands and the time each was filed.
- `tape` and `tape/{day}/series` (Part B): the price of each held and traded stock at every check, and 10-minute bars.
- `intradayViews` (Part B, a price fallback): empty for every battle.

**Completed battles by archetype and scoring path:**

| Archetype | Legacy | Measured | Total |
|---|---|---|---|
| momentum_chaser | 15 | 5 | 20 |
| diversifier | 12 | 1 | 13 |
| contrarian | 4 | 2 | 6 |
| analyst | 1 | 3 | 4 |
| degen | 3 | 1 | 4 |
| guardian | 1 | 1 | 2 |
| **Total** | **36** | **13** | **49** |

31 of the 49 have `ticks` rows (from 22 Sep 2026); all 31 have film tape.

## Part A — rescore under bank on exit (BB-14, Q20, Q21)

Script: `partA-rescore.mjs`. Each position is scored twice with the real scorer, one call per leg:

- **Stored leg:** the touch record as stored. This is the gate.
- **Rescored leg (Q20):** the same call with the upside reset.
  - Legacy: `maxMultiplier` 0, `minMultiplier` kept.
  - Measured: the history reset to the fill (`initialRewardHistory`), the stored low kept, and the earned tiers trimmed to the stored penalty tiers. The reward context then re-derives which bonus tiers the exit price clears.
- **Price used:** the exit price for a sale; the last scored price for a position held to the end. Penalties are unchanged.

**A self-test runs first,** with a position that peaks at 1.2 units, on each path. Exit at 0.8 units: the +15 must drop. Exit at 1.1 units: nothing may change. The measured case is planted on a real stored position, so the real receipt validators run. Both cases pass.

### A1. The gate

The gate checks, within 0.01:

- the agent's active score (held positions);
- each sale's locked points (legacy: rebuilt from the sale receipt's touch record, entry and volatility unit; measured: from the sale's receipt and exit context);
- the banked score;
- active plus banked against the stored total.

**43 of 49 pass, the same 43 Phase 0 counted complete.** Excluded:

| Battle | Path | Reason |
|---|---|---|
| 001 | legacy | a sale has no receipt (its touch record at the sale is not stored)* |
| 018, 022, 031, 039 | legacy | no final score |
| 034 | legacy | no last price for a held position |

\* The review (finding A4) showed this record is bounded from above: the battle's day-1 touch record allows no bonus, and the sale's locked points equal its base points. Including the battle would give 44 kept with Δ 0; the legacy mean Δ would move from −3.67 to −3.55, and the overall mean from −2.91 to −2.84. It stays excluded under Q21's complete-data rule.

**The opponent's gate:**

- **Measured battles (13):** each CPU stock position's recomputed score equals the score of its committed frame, checked position by position (added after review finding A2; before that, the check was only implied by the total). The CPU's crypto slot is scored by the legacy scorer and no price for it is stored, so it is taken as the remainder (−36 to +15 points, the size of a 1–4% crypto move). **Not verified.**
- **Legacy battles:** no stored field holds a last price per CPU position, so the CPU score is **not verified**. The CPU's legacy scoring call gets an empty touch record (Phase 0 G2), so bank on exit cannot change it.

**Three rules the gate relies on:**

- **Legacy touch record.** The nightly job moves it to `thresholdHistory[symbol].dailyThresholds.day1` and renames `swapPrice` to `previousSwapPrice`. The script reads both shapes.
- **Nightly reset.** That job does not change `currentScore`, so a one-day battle's stored score is its last 15-minute frame. A battle scored after its nightly reset would be excluded; none passed the other checks.
- **Unknown baselines.** In 5 legacy battles, activated outside a session before their first trading day (one of them on a market holiday), the touch baseline was the previous close, which is not stored. The entry price stands in. 35 positions are affected, and none holds a stored bonus. Since review finding A1, a position like that which does hold a bonus excludes its battle, because its bonus could be wrong in either direction.
- **Sale units.** A legacy sale's volatility unit follows the executor's precedence (`scoring.thresholds[symbol].threshold`, then the receipt's copy of the slot's unit, then 2.5; `api/_utils/agentSwapExecution.js:347`). Review finding A3; on this data every receipt already matched.

### A2. Per battle

`Δ` is the agent's change. Legacy CPU scores are unchanged by construction.

| Battle | Archetype | Path | Stored | Rescored | Δ | CPU stored | CPU rescored | Winner before → after |
|---|---|---|---|---|---|---|---|---|
| 002 | guardian | legacy | -44 | -44 | 0 | -37 | (unchanged) | CPU → same |
| 003 | diversifier | legacy | -20 | -20 | 0 | -16 | (unchanged) | CPU → same |
| 004 | diversifier | legacy | 59 | 59 | 0 | -4 | (unchanged) | agent → same |
| 005 | diversifier | legacy | 61 | 61 | 0 | 8 | (unchanged) | agent → same |
| 006 | momentum_chaser | legacy | 5 | 5 | 0 | -26 | (unchanged) | agent → same |
| 007 | momentum_chaser | legacy | -145 | -145 | 0 | -256 | (unchanged) | agent → same |
| 008 | diversifier | legacy | -11 | -11 | 0 | -7 | (unchanged) | CPU → same |
| 009 | momentum_chaser | legacy | -162 | -162 | 0 | 360 | (unchanged) | CPU → same |
| 010 | contrarian | legacy | -131 | -131 | 0 | -60 | (unchanged) | CPU → same |
| 011 | degen | legacy | 125 | 110 | -15 | -103 | (unchanged) | agent → same |
| 012 | diversifier | legacy | 45 | 45 | 0 | 160 | (unchanged) | CPU → same |
| 013 | momentum_chaser | legacy | -245 | -245 | 0 | -174 | (unchanged) | CPU → same |
| 014 | momentum_chaser | legacy | 20 | 20 | 0 | 5 | (unchanged) | agent → same |
| 015 | contrarian | legacy | -59 | -59 | 0 | 59 | (unchanged) | CPU → same |
| 016 | momentum_chaser | legacy | 28 | 28 | 0 | 70 | (unchanged) | CPU → same |
| 017 | momentum_chaser | legacy | -47 | -47 | 0 | -93 | (unchanged) | agent → same |
| 019 | contrarian | legacy | -5 | -5 | 0 | 8 | (unchanged) | CPU → same |
| 020 | momentum_chaser | legacy | 19 | 19 | 0 | 27 | (unchanged) | CPU → same |
| 021 | momentum_chaser | legacy | 157 | 157 | 0 | -49 | (unchanged) | agent → same |
| 023 | momentum_chaser | legacy | -96 | -96 | 0 | -6 | (unchanged) | CPU → same |
| 024 | diversifier | legacy | 27 | 27 | 0 | -50 | (unchanged) | agent → same |
| 025 | momentum_chaser | legacy | 31 | 31 | 0 | 62 | (unchanged) | CPU → same |
| 026 | diversifier | legacy | 22 | 22 | 0 | 19 | (unchanged) | agent → same |
| 027 | momentum_chaser | legacy | 120 | 120 | 0 | 46 | (unchanged) | agent → same |
| 028 | momentum_chaser | legacy | 141 | 46 | -95 | -30 | (unchanged) | agent → same |
| 029 | diversifier | legacy | -1 | -1 | 0 | -16 | (unchanged) | agent → same |
| 030 | momentum_chaser | legacy | 219 | 219 | 0 | 8 | (unchanged) | agent → same |
| 032 | diversifier | legacy | -37 | -37 | 0 | 27 | (unchanged) | CPU → same |
| 033 | diversifier | legacy | 151 | 151 | 0 | 210 | (unchanged) | CPU → same |
| 035 | degen | legacy | 46 | 46 | 0 | 15 | (unchanged) | agent → same |
| 036 | analyst | measured | 21 | 21 | 0 | 40 | 40 | CPU → same |
| 037 | momentum_chaser | measured | -2 | -2 | 0 | -9 | -9 | agent → same |
| 038 | analyst | measured | -58 | -58 | 0 | 16 | 16 | CPU → same |
| 040 | analyst | measured | 173 | 173 | 0 | 191 | 146 | CPU → **agent** |
| 041 | momentum_chaser | measured | 31 | 31 | 0 | 98 | 98 | CPU → same |
| 042 | momentum_chaser | measured | 53 | 53 | 0 | -35 | -35 | agent → same |
| 043 | contrarian | measured | -61 | -61 | 0 | 264 | 234 | CPU → same |
| 044 | momentum_chaser | measured | -60 | -60 | 0 | -82 | -82 | agent → same |
| 045 | momentum_chaser | measured | 2 | -13 | -15 | -44 | -119 | agent → same |
| 046 | diversifier | measured | 39 | 39 | 0 | 512 | 512 | CPU → same |
| 047 | contrarian | measured | -115 | -115 | 0 | -50 | -50 | CPU → same |
| 048 | degen | measured | -293 | -293 | 0 | -71 | -71 | CPU → same |
| 049 | guardian | measured | 22 | 22 | 0 | -86 | -86 | agent → same |

### A3. By path and by archetype

"Bonus lost" is the share of bonus points on record (all of them from positions held to the end) whose exit or last price no longer cleared the level. Legacy rows count the agent side only, so the "all" and archetype rows mix the two scopes.

| Group | Battles | Changed | Mean Δ agent | Mean Δ CPU | Winner flips | Bonus lost, both sides | Agent side only |
|---|---|---|---|---|---|---|---|
| measured | 13 | 3 | −1.15 | −11.54 | 1 | 27.7% (165 of 595) | 20.0% (15 of 75) |
| legacy | 30 | 2 | −3.67 | 0 | 0 | 21.8% (110 of 505) | 21.8% (110 of 505) |
| all | 43 | 5 | −2.91 | −3.49 | 1 | 25.0% (275 of 1,100) | 21.6% (125 of 580) |
| analyst | 3 | 1 | 0 | −15 | 1 | 22.5% (45 of 200) | 0% (0 of 45) |
| contrarian | 5 | 1 | 0 | −6 | 0 | 19.4% (30 of 155) | — (0 of 0) |
| degen | 3 | 1 | −5 | 0 | 0 | 50% (15 of 30) | 50% (15 of 30) |
| diversifier | 11 | 0 | 0 | 0 | 0 | 0% (0 of 280) | 0% (0 of 190) |
| guardian | 2 | 0 | 0 | 0 | 0 | — | — |
| momentum_chaser | 19 | 2 | −5.79 | −3.95 | 0 | 42.5% (185 of 435) | 34.9% (110 of 315) |

**Legacy flips: none (0 of 30).** The legacy CPU side has no touch memory and cannot lose points, so bank on exit can only lower the agent there. In this sample it never changed a legacy winner.

**Where the change lands.** 9 positions lose a bonus: 3 on the agent side, 6 on the CPU side, all held to the end. Of the 74 sold positions, none carried a stored bonus, so selling never banked a bonus that the exit price had already given back.

## Part B — the 30-minute schedule (BB-23)

Script: `partB-schedule.mjs`. Scope: the 31 completed battles with `ticks` rows. Every model call joins its stored evaluation by `evalId` (459 of 459); no `tickSeq` is missing in any battle.

**The slot rule, exactly:**

- A check's slot is its capture time floored to the 15-minute cron grid.
- A check is **scheduled** when its slot is an even number of 15-minute steps after the battle's first check's slot: the battle's first check, then every 30 minutes. Every other check is **skipped**.
- The grid follows each battle's own start. 9 of 31 battles start on a :15 or :45 slot; for those, a fixed 9:30-based grid would pick different checks.

**Eligible checks** are the ones that reach the trigger gate today. These never call the model, on either schedule:

- a check that ended on the gameplan-meeting path (102);
- a check that ended on degraded quotes (17);
- a check that stopped before the gate because the measured reward frame was unavailable (2; review B2).

### B1. Today

| Per battle-day | Total | Median | Mean |
|---|---|---|---|
| Checks run | 589 | 20 | 19.0 |
| Eligible | 468 | 16 | 15.1 |
| Model calls | 459 | 16 | 14.8 |

Of the 459 model calls, **398 were answered.**

- **What the model returned** (the tick's `decision.original`): a hold on **81.4% (324 of 398)** and a swap on 74.
- **What the check did:** the code's own checks blocked 59 of those 74 swaps (29 stock-for-crypto, 29 by the hurdle floor (28 below the floor, 1 with no positive bench candidate), 1 on cooldown), so 383 answered calls (96.2%) ended as holds and 15 swaps executed.
- **Failed calls:** the other 61 failed and the check fell back to a hold (`holdKind: 'default_failure'`): 52 SDK timeouts with no response, and 9 invalid tool results. Of the 589 checks, 130 made no call: 102 gameplan-meeting checks, 17 degraded quotes, 9 where the gate found no trigger, and 2 that stopped before the gate (no reward frame).

**What opened the gate** (a call can carry several triggers):

| Trigger | Share of calls |
|---|---|
| nr7_contraction | 80.0% (367 of 459) |
| bench_outperformance | 73.4% (337) |
| bandwidth_squeeze | 25.7% (118) |
| price_drop | 17.4% (80) |
| threshold_proximity | 13.1% (60) |
| forced_open | 6.5% (30) |
| news_catalyst | 5.2% (24) |

The most common sets are "bench_outperformance + nr7_contraction" (129 calls), then the same with bandwidth_squeeze (67), and nr7_contraction alone (49). The gate rarely stays shut.

### B2. Event checks

A skipped eligible check still calls the model if any of these happened after the last scheduled check, up to this one:

- **fill:** a sale committed in that window, or by the code's own exits at this check. The model's own swap at this check is the action, not its trigger.
- **move X:** a held stock moved at least X volatility units, measured from its price at the last scheduled check.
  - The unit is `baseATR` for legacy battles and the receipt's `scoringPct` for measured ones.
  - Prices are the film tape's price at each check. Crypto has no tape, so its moves are not measured.
- **level:** the gate's own stored `threshold_proximity` trigger at this check: within 0.2 units below a bonus not yet earned, or within 0.2 units above a penalty level. On measured battles that is the next uncrossed penalty; on legacy battles it is any penalty level, crossed or not (`api/_utils/agentTriggerGate.js:86`; review B5). It is stored only where the gate ran, and a check with no trigger had none.
- **command:** a cockpit command (`calls[].playerResponse.filedAt`), or a chat message or filed directive (`chatExchanges[].timestamp`).

**How often each event fired** at the 234 skipped eligible checks:

| Event | Checks |
|---|---|
| fill | 16 |
| level | 31 |
| command | 9 |
| move ≥ 0.25 / 0.5 / 0.75 | 24 / 10 / 6 |

### B3. Model calls per battle-day

Two readings of "scheduled check". **(i)** The gate still decides at scheduled checks. **(ii)** The model always runs at scheduled checks. Founder question 2 asks which one is meant.

| | Event checks (all battles) | Calls/day, reading (i) | Calls/day, reading (ii) | Model swaps missed |
|---|---|---|---|---|
| today | — | 14.81 | — | — |
| X = 0.25 | 73 | 9.77 | 9.90 | 8 |
| X = 0.5 | 62 | 9.42 | 9.55 | 8 |
| X = 0.75 | 58 | 9.29 | 9.42 | 8 |

Today 230 model calls fall on checks the schedule keeps and 229 on checks it skips.

### B4. Model swaps at skipped checks, and the cost of waiting

9 of the 15 executed model swaps fell on skipped checks. One was caught by an event (a cockpit command filed in the window). **The other 8 are missed at every X**: no fill, no level, no command and no move of even 0.25 units preceded them. The model swapped on its own reading of a quiet check.

**The delay cost** is the swap taken at the next scheduled check (14–15 minutes later in every case) minus the swap as taken, in points: **+ means waiting would have gained points**. It is scored with the real scorer from tape prices:

- the outgoing position, from its entry to its exit;
- the incoming one, from its fill to its own exit (all 9 were held to the end).

**Which price a fill gets.** A swap fills at the battle's own quote, which is about 16 minutes old (Phase 0 C3). Checked against the tape, 89% of stored fill prices (73 of 82) sit closer to the tape price at the check *before* the executing check than at the executing check itself. The median gap is 0.04% against 0.2%. The cost is therefore given two ways (review B1):

- **lag 1:** each fill at the tape price one check earlier. This matches the stored fills; scored this way, the outgoing leg lands a median 1 point (largest 4) from the stored locked points.
- **lag 0:** each fill at the check's own minute. Here the outgoing leg lands a median 2 points (largest 14) from the stored locked points.

| X | Missed | Total, lag 1 (matches the fills) | Median, lag 1 | Total, lag 0 | Median, lag 0 |
|---|---|---|---|---|---|
| 0.25, 0.5, 0.75 | 8 | **+11** | +2 | −10 | −2.5 |

**Per missed swap:**

- **Lag 1:** −2, 0, +6, +4, −7, +7, +6, −3. Waiting gained points in 4 cases, lost in 3, and was neutral in 1.
- **Lag 0:** 0, −11, −3, −5, +1, −2, −4, +14.

Each leg's points are rounded as the game rounds them. Unrounded, the lag-0 total is −8.

The sign depends on the convention, and every case is within ±14 points. **Read this as "small and mixed": waiting 15 minutes neither reliably costs nor reliably gains.**

**The three worst cases for waiting, lag 1** (points: outgoing leg, incoming leg, as done → delayed):

1. **−7.** A momentum chaser's Star swap at 11:16 AM ET on 2 Nov. The outgoing stock recovered (−42 → −37), but the incoming one's early gain was missed (+47 → +35).
2. **−3.** A degen's Core swap at 11:16 AM ET on 12 Nov. The outgoing stock recovered (−84 → −73), but the incoming one fell further after the later entry (−2 → −16).
3. **−2.** A momentum chaser's Support swap at 2:01 PM ET on 23 Sep. Outgoing −8 → −10; incoming +4 → +4.

**Best for waiting, lag 1:** a contrarian's Core swap at 11:16 AM ET on 10 Nov, +7 (outgoing −74 → −72, incoming +8 → +13).

**Unchanged by the schedule:** the code's own risk exits (bust avoidance, VWAP failure, stagnation rotation) run on every 15-minute check before the gate (`api/cron/agent-evaluate.js:1872`). Only the model call moves.

## Part C — the cost census

Script: `partC-cost.mjs` (reads Part B's result file for the schedule rows).

**Scope:**

- Included: the trading brain's one call per check, 459 calls in the 31 battles with tick rows, all to `claude-haiku-4-5-20251001`.
- Not costed: 202 stored evaluations in the 18 earlier battles. Neither their request nor their usage is stored.
- Not counted: other model calls (chat, narration, meetings, reviews). They are not in the export.

### C1. Tokens per call

| Tokens | Median | Mean | Max | Total |
|---|---|---|---|---|
| Input | 16,640 | 16,314 | 19,231 | 7,487,970 |
| Output | 1,507 | 1,523 | 2,506 | 699,160 |
| Cache read | 0 | 0 | 0 | 0 |
| Cache write | 0 | 0 | 0 | 0 |

- **ESTIMATED rows.** Usage is stored for 407 calls: the 398 answered calls and 9 whose tool result was invalid (answered at HTTP 200, so billed). The other 52 were SDK timeouts with no response stored. Their input is estimated as request bytes × 0.320 tokens per byte (the median of the stored calls), and their output as the median 1,507.
- **Not verified:** whether those 52 timed-out calls were billed. All 52 aborted at the 20-second SDK timeout then in force. The SDK cancels the request, but whether Anthropic bills a request cancelled mid-generation was not checked.
  - **If they were not billed,** the totals overstate by up to 11%.
  - **If they were billed,** the totals understate a little: answered calls that ran 20 seconds or more wrote a median 1,904 output tokens, above the 1,507 used here, adding about 1% to the Haiku 4.5 total (review C6).

### C2. `cache_control` today

**None.** 0 of 459 requests carry `cache_control`. The system prompt is sent as a plain string.

### C3. Size map

Each part's share of a request, by bytes of text, as a mean over requests. A part's tokens are its byte share of the stored input (the tool-use text the API adds is invisible in the bytes and is spread across the shares).

| Part | Share | ≈ tokens per call |
|---|---|---|
| System text | 34.4% | 5,616 |
| The tool (decision schema) | 25.2% | 4,106 |
| Per-check context | 14.7% | 2,389 |
| Bench (the bench table and the bench technical context) | 11.4% | 1,859 |
| Identity (about you, strategic brief and wisdom, initial rationale, decision precedence) | 7.6% | 1,239 |
| The rules (YOUR FORGE RULES) | 4.2% | 692 |
| Positions table (ACTIVE POSITIONS) | 2.1% | 344 |
| Anything else (fixed acknowledgement, request envelope) | 0.4% | 68 |

The per-check context includes these named sections:

- **FUNDAMENTALS** (9.4% of the request); it changes with price and bench membership;
- **TRIGGER** (1.1%);
- **YOUR LAST 3 DECISIONS** (1.0%);
- **INTRADAY MOMENTUM** (0.9%);
- **REGIME** (0.8%);
- the opening **LIVE BATTLE STATE** lines (score, time left).

### C4. The repeating prefix

Measured in cache order (tools → system → messages), over the raw text of each block (the export's text, which for 8 requests is 42 bytes shorter than what was sent; review X6, under 0.1% of those requests). Each share is of the first request in the pair, and the table gives the median share (review C1).

| Between | Pairs | Median repeating prefix | Of which block-aligned (cacheable as sent today) | First changing byte |
|---|---|---|---|---|
| Consecutive checks of one battle | 429 | 71.0% | 70.9% | line 2 of the per-check context, the "Day N of M \| Xh Ym remaining" line, in all 429 (line 1, the battle-state banner, never changes) |
| Different battles in the same cron run | 67 | 26.5% | 26.5% | system text byte 8, the agent's name (57); inside the tool, where the cockpit declarations text begins (10) |
| Battles on the same archetype (first call of each) | 116 | 27.2% | 27.1% | inside the tool (46); system text byte 8, the agent's name (29); system text line 14, a template line that changed between versions (14); the identity block (27) |

- **Within a battle**, everything before the per-check context repeats: the tool, the system text, the identity block and the acknowledgement. It already sits first, so one breakpoint at the end of the acknowledgement caches it as sent today: a median 70.9% of a request per pair. The cost rows use a slightly larger share, a median **71.1%**: the parts identical on every call of the battle. That share includes two sections that sit after the changing lines (REGIME CONTEXT in 62 calls, STANDING LEANS in 21), so it assumes those are moved first. Using the as-sent share instead moves the Haiku 4.5 cached row by $0.0002 per battle-day (review C3).
- **Across battles,** only three agent names appear in the 30 battles that made a model call. Two battles of the same agent repeat the tool and the system text, and differ first in the identity block; 27 of the 116 same-archetype pairs are like that, with a median common prefix around 60% (review C2). Two different agents share only the tool and the first 8 bytes of the system text ("You are \<name\>"). The tool comes in 3 versions, which differ near the end, where the cockpit declarations text begins. 13 distinct system texts were seen across the 30 battles that made a model call.

### C5. Cost per call and per battle-day

**Assumptions:**

1. **Prices** are the prompt's table (per million tokens, checked 15 Nov 2026).
2. **"Cached 1 h"** is one breakpoint at the end of each battle's repeating parts, which are about 11,600 tokens on Haiku 4.5. That is above the minimum cacheable prompt for both models: Haiku 4.5 needs 4,096 tokens and Haiku 5.5 needs 512 (Claude API skill, `shared/prompt-caching.md` § API reference; live page `platform.claude.com/docs/en/build-with-claude/prompt-caching`).
3. **TTL simulation:**
   - The first call of a battle writes the entry at 2× the input price.
   - A later call that starts within an hour of the previous read or write reads it at 0.1× and refreshes the timer.
   - The rest of each request is billed at the full input price.
   - 9 gaps between a battle's calls ran over an hour (the longest 150 minutes); each starts a fresh write.
   - Battles do not share a cache. Every pair of battles in the same cron run is two different agents, whose prefixes part at the tool or at byte 8 of the system text. Battles of the same agent ran on different days, more than an hour apart.
4. **Haiku 5.5 rows:**
   - Today's tokens are scaled by **1.3×**, input and output, because Haiku 5.5 counts the same text as about 30% more tokens (Claude API skill, `shared/model-migration.md` → Migrating to Claude Haiku 5.5).
   - Thinking tokens are **excluded**. Haiku 5.5 thinks by default, at medium effort, and how much it would think here is unmeasured; that is Part D's job.
   - The largest scaled prompt is 25,000 tokens, inside the ≤ 100,000-token price band.
   - The request as sent today would not run unchanged: Haiku 5.5 rejects a non-default `temperature` (0.4 today).
5. **Schedule rows** are Part B's schedule at X = 0.5, reading (i): 292 calls.
   - Of these, 39 use the estimates in C1.
   - 1 more is an event check where no model ran today; it is costed at the battle's mean tokens. Together that makes the 40 estimated calls in the table note below.

| Row | Calls | $ per call | $ per battle-day | $ total |
|---|---|---|---|---|
| Haiku 4.5 as sent today | 459 | 0.02393 | 0.3543 | 10.98 |
| Haiku 4.5, repeating prefix first, cached 1 h | 459 | 0.01527 | 0.2262 | 7.01 |
| Haiku 5.5 as sent today | 459 | 0.00311 | 0.0461 | 1.43 |
| Haiku 5.5, repeating prefix first, cached 1 h | 459 | 0.00199 | 0.0294 | 0.91 |
| *Under the schedule, X = 0.5:* | | | | |
| Haiku 4.5 as sent today | 292 | 0.02386 | 0.2247 | 6.97 |
| Haiku 4.5, repeating prefix first, cached 1 h | 292 | 0.01627 | 0.1532 | 4.75 |
| Haiku 5.5 as sent today | 292 | 0.00310 | 0.0292 | 0.91 |
| Haiku 5.5, repeating prefix first, cached 1 h | 292 | 0.00212 | 0.0199 | 0.62 |

ESTIMATED: 52 of 459 calls in the first block and 40 of 292 in the second.

## Part D — the model comparison (BB-24)

**Run on 16 Nov 2026** after the founder's line `PART D APPROVED, $5`, on the existing export: no production read, Parts A–C not repeated. Script: `partD-models.mjs`. **Actual spend: $1.35** (from the returned usage), against a worst-case estimate of $1.76 made before anything was sent. Nothing was written anywhere but the out-of-tree `replay/partD/` folder.

### D1. Sample and arms

- **Population:** the 398 answered calls with their stored request and the model's own stored tool call.
- **Sample:** 150 calls, with the model's stored decision split as evenly as the data allows. That is all 74 stored swaps and 76 holds, each spread round-robin across archetypes in a fixed hash order. By archetype: momentum_chaser 57, diversifier 29, degen 20, contrarian 17, analyst 15, guardian 12.
- **Arms:**
  - (a) Haiku 4.5 again on 50 of them (25 swaps, 25 holds), the noise floor;
  - (b) Haiku 5.5 at its default effort, on all 150;
  - (c) Haiku 5.5 at low effort, on all 150.
- **How they ran:** all 350 requests went through one Message Batch. Ten rows common to all three arms were also sent live, one call at a time, for latency (30 calls).

### D2. What changed in each request (every byte that differs from the stored request)

All 150 stored request texts re-serialize byte-identically. For 146 of them that text is exactly what production sent; their stored SHA-256 matches. The other 4 are holds, 2 of them in arm (a) and 2 among the live rows. In each, the per-check context named a directive thread id that held the account id twice; the export replaced it with `acct-NN`, so the request sent here was 42 bytes shorter than production's. The account id was never sent (review X6).

| Arm | Differences from the stored request |
|---|---|
| (a) | none |
| (b) | `"model":"claude-haiku-4-5-20251001"` → `"model":"claude-haiku-5-5"`; `"temperature":0.4` removed |
| (c) | the same two, plus `"output_config":{"effort":"low"}` added |

`max_tokens` (3,072 on 145 rows, 2,048 on 5 older ones), the system text, the messages, the tool and the forced `tool_choice` are unchanged.

**Why each change, from Anthropic's documentation (read 16 Nov 2026):**

- **Model id.** `claude-haiku-5-5` is the Claude API id (`platform.claude.com/docs/en/about-claude/models/overview.md`; the Haiku 5.5 migration guide, `platform.claude.com/docs/en/models/haiku-5-5/migration-guide.md`: "a fixed model ID with no date suffix and no separate alias"). `claude-haiku-4-5-20251001` is valid (`platform.claude.com/docs/en/api/messages/create.md`).
- **Temperature removed.** On Haiku 5.5 "non-default `temperature`, `top_p`, or `top_k` values return a 400 error" (`platform.claude.com/docs/en/build-with-claude/thinking.md`, Sampling parameters). The migration guide: "On Claude Haiku 5.5, omit `temperature`, `top_p`, and `top_k`."
- **Effort.** "Claude Haiku 5.5 supports all five effort levels, and `medium` is the default", set with `output_config.effort` (`platform.claude.com/docs/en/build-with-claude/effort.md`). Arm (b) omits it; arm (c) sends `low`.
- **Forced tool choice kept.** Adaptive thinking "supports forced tool use, except on" a list that does not include Haiku 5.5 (thinking.md, "Thinking with tool use"). The migration guide: Haiku 5.5 "accepts a forced `tool_choice` … but the response starts with the tool call and has no `thinking` block."
- **Thinking tokens** are reported in `usage.output_tokens_details.thinking_tokens`, and `output_tokens` stays the inclusive billed total (`platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost`).
- **Batch pricing.** "All usage is charged at 50 percent of the standard API prices" (`platform.claude.com/docs/en/build-with-claude/batch-processing.md`). The list prices match the prompt's table (`platform.claude.com/docs/en/about-claude/pricing.md`).

### D3. Results per arm

**Valid** means a `submit_trade_decision` tool call, not stopped at `max_tokens`, that passes the production validator (`validateTradeToolResult`, `api/_utils/agentEvalToolResultValidation.js`). **Agreement** is against the model's own stored decision, not the final decision after the code's checks.

| Arm | Valid tool calls | Agree hold/swap | On stored holds | On stored swaps | Same symbols (stored swaps) | Median input tokens | Median output tokens | Mean thinking tokens | $ per call, batch | $ per call, list |
|---|---|---|---|---|---|---|---|---|---|---|
| (a) Haiku 4.5 again, 50 | 100% (50 of 50) | 90% (45 of 50) | 100% (25 of 25) | 80% (20 of 25) | 56% (14 of 25) | 17,021 | 1,536 | 0 | 0.01222 | 0.02445 |
| (b) Haiku 5.5 default effort, 150 | 99.3% (149 of 150) | 50.7% (76 of 150) | 98.7% (75 of 76) | 1.4% (1 of 74) | 0% (0 of 74) | 22,816 | 1,214 | **0** | 0.00142 | 0.00284 |
| (b) on the same 50 | 100% (50 of 50) | 52% (26 of 50) | 100% (25 of 25) | 4% (1 of 25) | 0% (0 of 25) | 23,016 | 1,246 | 0 | 0.00143 | 0.00285 |
| (c) Haiku 5.5 low effort, 150 | 100% (150 of 150) | 52% (78 of 150) | 100% (76 of 76) | 2.7% (2 of 74) | 1.4% (1 of 74) | 22,816 | 1,025 | **0** | 0.00138 | 0.00275 |
| (c) on the same 50 | 100% (50 of 50) | 52% (26 of 50) | 100% (25 of 25) | 4% (1 of 25) | 0% (0 of 25) | 23,016 | 1,033 | 0 | 0.00138 | 0.00277 |

- **The one invalid call** in arm (b) omitted the required `hypothesis` field.
- **Thinking tokens are 0 on every Haiku 5.5 call,** in the batch and live, at both efforts. The forced tool call starts the response, as the documentation says. Cost per call therefore includes no thinking.
- **What Haiku 5.5 returned on the 74 stored swaps:** a hold on 73 at default effort and on 72 at low effort.
- **Stored swaps split by what the code did with them.** This is descriptive only.

| Arm | Swaps again where the code executed the stored swap | Swaps again where the code blocked it |
|---|---|---|
| (a) Haiku 4.5 | 75% (6 of 8) | 82% (14 of 17) |
| (b) Haiku 5.5 default | 0% (0 of 15) | 1.7% (1 of 59) |
| (c) Haiku 5.5 low | 0% (0 of 15) | 3.4% (2 of 59) |

**Latency** (10 live calls per arm, the same 10 rows, one at a time):

| Arm | Median | Min | Max |
|---|---|---|---|
| (a) Haiku 4.5 | 18.4 s | 14.4 s | 24.5 s |
| (b) Haiku 5.5 default | 5.9 s | 4.3 s | 9.0 s |
| (c) Haiku 5.5 low | 5.1 s | 3.1 s | 7.8 s |

**Measured tokens against Part C's assumption.** On the same 50 rows, Haiku 5.5 read 1.35× the input tokens of Haiku 4.5, and wrote 0.81× the output at default effort and 0.67× at low effort. Part C assumed 1.3× for both. At list price, a Haiku 5.5 call measured $0.00284 at default effort, against Part C's $0.00311 estimate.

### D4. Five cases where Haiku 5.5 (b) and the stored decision disagree

Quoted without ids, the first five in the fixed hash order. Each is a stored swap that Haiku 5.5 held. Rationales are cut at 220 characters.

1. **Diversifier.** Stored: SWAP BTC → LLY, conviction 78: "BTC has been a persistent drag on my portfolio for three consecutive evaluations, now at +0.54% (0.11x ATR) with only 5h 45m remaining…" Haiku 5.5: HOLD, conviction 62: "Book is 8.0 pts with 5h 45m left, all positions within a fraction of an ATR of zero… AMZN +0.69x (closest to a bonus, +1.0x needs about +0.3x more)…"
2. **Diversifier, an earlier check of the same battle.** Stored: SWAP BTC → LLY, conviction 82: "BTC has been a persistent drag for three consecutive evaluations, stalled at +0.77% (0.15x ATR) while the broader market is down 0.36%…" Haiku 5.5: HOLD, conviction 72: "Portfolio is spread across Energy (MPC, VLO), Materials (CTVA), Consumer Discretionary (GME, AMZN), Healthcare (ABBV), and Crypto (BTC), with no sector past the 40% cap…"
3. **Degen.** Stored: SWAP BTC → XOM, conviction 72: "BTC is bleeding hard — down 3.04% from entry, which is -0.61x its 5.0% ATR baseline. I'm approaching the Bust threshold…" Haiku 5.5: HOLD, conviction 55: "I'm at -293 with 4h 15m left… Every candidate I could bring in is either locked (MOS, NEM, TTWO, DHI, RKLB), crypto…"
4. **Momentum chaser.** Stored: SWAP CCI → EOG, conviction 78: "CCI has bled for four consecutive evaluations, now at -0.63x its frozen measured 3.95% ATR — approaching the -1.0x Bust threshold…" Haiku 5.5: HOLD, conviction 62: "AMT is at -1.00x its frozen 2.81%… so it has crossed Bust and is sitting on the -10 penalty; it is not yet at Crash (-1.5x)…"
5. **Degen, an earlier check of the same battle as case 3.** Stored: SWAP BTC → XOM, conviction 72: "I'm down -265 points with 4h 45m remaining — final day, catastrophic deficit. BTC is at -2.94% from entry…" Haiku 5.5: HOLD, conviction 72: "…a swap now runs into several hard blocks. It's 11:30–2:00 mid-session window per S14…"

All five of these stored swaps were blocked by the code's own checks when they happened (the final decision was a hold). Four are crypto-for-stock swaps, a pairing the code refuses: 29 of the 59 blocked swaps were blocked for that reason. The report states agreement and validity only; it does not score either model as better or worse.

## Part E — a narrower trigger gate (no model call)

Added by the founder with the Part D approval (16 Nov 2026). Script: `partE-gate.mjs`, offline over the same export. It reuses Part B's check analysis.

**The rule tested:** `nr7_contraction` and `bench_outperformance` can no longer open the gate on their own. A check whose stored triggers are only those two no longer calls the model. Any other trigger still does, and so does a check with no stored trigger list.

### E1. The triggers at each executed model swap

| Battle | Archetype | ET | Triggers at that check | Only nr7/bench? | 30-min schedule | Event at X = 0.5 |
|---|---|---|---|---|---|---|
| 016 | momentum_chaser | 22 Sep 12:16 | bandwidth_squeeze, bench_outperformance, nr7_contraction, price_drop | no | kept | — |
| 017 | momentum_chaser | 23 Sep 14:01 | bench_outperformance, nr7_contraction | **yes** | skipped | no |
| 019 | contrarian | 29 Sep 14:46 | bandwidth_squeeze, bench_outperformance, nr7_contraction | no | skipped | no |
| 019 | contrarian | 29 Sep 15:01 | bandwidth_squeeze, bench_outperformance, nr7_contraction | no | kept | — |
| 024 | diversifier | 6 Oct 13:16 | bandwidth_squeeze, bench_outperformance, nr7_contraction | no | skipped | no |
| 040 | analyst | 22 Oct 12:16 | bandwidth_squeeze, bench_outperformance, price_drop | no | skipped | no |
| 042 | momentum_chaser | 23 Oct 12:01 | bench_outperformance, nr7_contraction | **yes** | kept | — |
| 044 | momentum_chaser | 30 Oct 12:46 | bench_outperformance, nr7_contraction | **yes** | kept | — |
| 045 | momentum_chaser | 2 Nov 11:16 | bench_outperformance, nr7_contraction, price_drop | no | skipped | no |
| 045 | momentum_chaser | 2 Nov 14:31 | bench_outperformance, nr7_contraction, price_drop | no | kept | — |
| 047 | contrarian | 10 Nov 11:16 | bench_outperformance, nr7_contraction, price_drop | no | skipped | no |
| 047 | contrarian | 10 Nov 13:46 | nr7_contraction, price_drop | no | skipped | no |
| 048 | degen | 12 Nov 11:16 | bench_outperformance, nr7_contraction, price_drop | no | skipped | no |
| 048 | degen | 12 Nov 11:31 | bench_outperformance, nr7_contraction, price_drop | no | kept | — |
| 048 | degen | 12 Nov 11:46 | bench_outperformance, nr7_contraction, price_drop | no | skipped | yes (command) |

`nr7_contraction` is present at 14 of the 15 swaps and `bench_outperformance` at 14. Only 3 swaps had nothing else; 9 also had `price_drop` and 5 had `bandwidth_squeeze`.

### E2. Model calls per battle-day and executed model swaps missed

| Gate | Model calls | Per battle-day | Executed model swaps missed (of 15) |
|---|---|---|---|
| Today | 459 | 14.81 | 0 |
| Narrower gate, every 15 minutes | 262 | **8.45** | **3** |
| 30-minute schedule, X = 0.5 (Part B, reading i) | 292 | 9.42 | 8 |
| Narrower gate + schedule, nothing carried forward | 192 | 6.19 | 10 |
| Narrower gate + schedule, `forced_open` carried (exact) | 194 | 6.26 | 10 |
| Narrower gate + schedule, `forced_open` and news carried (news: upper bound) | 201 | **6.48** | **8** |

- **Which calls go.** 197 of today's 459 calls were woken only by these two triggers: 129 by both, 49 by `nr7_contraction` alone and 19 by `bench_outperformance` alone.
- **What the model did at them.** 179 of those calls were answered and 18 failed. The model proposed a swap at 31 of the answered calls, and the code blocked 28 of the 31. Only 3 became executed swaps, which are the 3 missed in the second row.
- **The combination.** At a scheduled check the narrower gate decides; at a skipped check an event still calls the model.
- **What a dropped call carries forward** (review E1). When the schedule drops a skipped check's call, two things the gate reads change:
  - the battle may still have no evaluation, so `forced_open` fires at the next check that reaches the gate (`api/_utils/agentTriggerGate.js:46`). This carry is exact.
  - a news story is marked seen only after a call resolves, so a story that woke a dropped call can wake the next scheduled check. Because a story's age is not stored, the simulation carries it for up to 120 minutes after the dropped check (the gate's news window). That makes this row an upper bound. An independent check of each carry against the prompts found 198 certain calls, or about 200 with the probable ones (6.39–6.45 per battle-day); the missed count of 8 held.
- **With both carried,** the two kept checks that had only nr7/bench (battles 042 and 044) open on a carried news story, so 8 swaps are missed, all of them Part B's skipped-check swaps. With nothing carried, those two are missed too (10).
- **Unaffected:** the narrower gate alone (no check it drops carries news or `forced_open`) and Part B's schedule alone.

## Limits of each measurement

**Part A**

- **15-minute resolution.** A touch is the highest price seen at a check; the tape's 10-minute bars were not used to find touches between checks. This matches how the battles were actually scored.
- **The stop half of BB-8 is out of scope (Q21).** No stop was ever stored.
- **Unknown baselines.** In 5 legacy battles the touch baseline was the previous close, which is not stored. None of the 35 affected positions holds a bonus.
- **Untested paths.** A crypto sale in a measured battle is scored on the legacy path, which needs a receipt; production needs none (`api/_utils/stockThresholdAdmission.js:258`). There is no such sale in this data (review A7). The self-test plants the reset on both paths, the previous-close guard and both touch-record shapes. The receipt join, measured sales and the CPU side are covered only by the real-data gate (review A6).
- **CPU scores.** The legacy CPU score and the measured CPU crypto slot are not verified (no stored price).
- **The end of the battle counts as an exit** at the last scored price, as the prompt specifies. Phase 0 founder question 17 is still open.

**Part B**

- **Decisions held fixed.** Each scheduled check is assumed to make the decision it made today.
- **First-order only.** The delay cost prices each missed swap alone; it does not follow how the book would differ afterwards.
- **Prices.** The tape is a different price source from the battle's own quote. The battle's fills match the tape one check earlier, so the delay cost is given under both conventions, and its sign depends on the choice (+11 or −10).
- **Other data** (review M1–M7; none applies here):
  - a stock bought at the last scheduled check is not move-checked;
  - a guardrail fill after a scheduled check's model call is not an event;
  - the bar fallback can be up to 10 minutes stale;
  - the case where the incoming stock is sold before the next scheduled check is modelled as no swap.
- **Crypto.** Crypto moves are not measured.
- **Event coverage.** The "level" event is known only where the gate ran.
- **Sample.** 15 executed model swaps in 31 battle-days is a small sample.

**Part C**

- **Token shares** are byte shares.
- **Estimates.** 52 calls have no stored usage, and it is not verified whether they were billed.
- **Haiku 5.5 rows** scale today's tokens by 1.3× and leave thinking out, so they are a floor for that model.
- **Scope.** Only the trading brain's calls are counted.

**Part D**

- **The sample is balanced, not weighted to traffic.** Swaps are half the sample and a fifth of answered calls, so read the hold and swap rows separately.
- **One run per arm.** Only Haiku 4.5 has a noise floor. Haiku 5.5's own run-to-run variation is not measured.
- **Validation.** The validator checks the tool call's fields, not the domain rules applied in production (lock, cooldown, hurdle floor, stock-for-crypto), which need the battle's state at the check. So a "valid" Haiku 4.5 swap may be one the code would block.
- **Agreement** is against the model's own stored decision, not the final decision after the code's checks.
- **Temperature.** The stored calls and arm (a) ran at 0.4; the Haiku 5.5 arms ran at the API default, because Haiku 5.5 refuses 0.4. Temperature is therefore confounded with the model in the agreement figures (review D3).
- **Latency** is 10 sequential calls per arm from this machine, at one time of day. The 10 rows are 9 stored holds and 1 stored swap, and all 10 ended as holds, so they are not the balanced sample (review D3).

**Part E**

- **Decisions held fixed.** A check that still calls the model is assumed to decide what it decided today.
- **Trigger sets** are the ones stored on each evaluation. Failed calls count as calls, as in Part B.

## Founder questions

1. **Bank on exit for the CPU.** In measured battles the CPU is rescored too. That is where the one winner flip comes from (battle 040: the CPU loses 45 points and the agent wins). Should BB-8 apply to the CPU opponent, or to the player's agent only?
2. **What a scheduled check means.** (a) The gate still decides at scheduled checks (9.42 calls/day at X = 0.5). (b) The model always runs at scheduled checks (9.55). The cost rows use (a).
3. **The grid's anchor.** (a) Every 30 minutes from the battle's first check, as measured here. (b) A fixed 9:30-based grid; 9 of 31 battles start on a :15 or :45 slot, and for them it would change which checks run.
4. **Quiet-check swaps.** 8 of the 9 model swaps on skipped checks had no event before them, at any X. Waiting 15 minutes changes their points by a small, mixed amount: +11 in total priced as the fills were, −10 priced at the check's own minute. Is that delay acceptable, or should a rule keep them (for example, an event when the bench outperforms by some margin)?
5. **Crypto in the move event.** Crypto has no tape price. Should the move event (a) ignore crypto, or (b) read the battle's own crypto quote?
6. **Cross-battle caching.** The system text starts with the agent's name, so no two agents share more than the tool. Moving the name and archetype lines below the shared rules would let battles in one run share most of the system text as well. Should a build propose that? It changes the prompt's text order, which is fenced (`api/_utils/agentEvalPromptAssembly.js`).
7. **Haiku 5.5's holds (BB-24).** On the same requests Haiku 5.5 almost never swaps: 1 or 2 of 74 stored swaps, and none of the 15 the code executed. Its rationales cite blocks and locks. Before adopting it on cost and speed, should a follow-up find out why? For example: (a) rerun Haiku 5.5 on the same 150 to measure its own noise; (b) test whether the prompt's block rules read differently to it.
8. **The narrower gate.** (a) Adopt it alone: 8.5 calls per battle-day, 3 of 15 executed model swaps missed. (b) Combine it with the 30-minute schedule: 6.2–6.5 calls per battle-day, 8–10 missed. (c) Neither.
9. **The 59 blocked swaps.** The model proposes a swap on 19% of answered calls, but the code blocks 4 in 5 of them, half for pairing a stock with crypto. Should the prompt tell the model which pairings are refused, so fewer calls end in a blocked swap?

## Files

- `scripts/experiments/trader-game-replay/exportReplay.mjs` — the read-only export
- `scripts/experiments/trader-game-replay/replayLib.mjs` — shared pure helpers (Eastern time via Intl, tables)
- `scripts/experiments/trader-game-replay/partA-rescore.mjs` — Part A, with its self-test
- `scripts/experiments/trader-game-replay/partB-schedule.mjs` — Part B
- `scripts/experiments/trader-game-replay/partC-cost.mjs` — Part C
- `scripts/experiments/trader-game-replay/partD-models.mjs` — Part D (the only script that calls a model)
- `scripts/experiments/trader-game-replay/partE-gate.mjs` — Part E

**Run order (from the repo root):**

1. `node scripts/experiments/trader-game-replay/exportReplay.mjs --out <dir> --env <path to .env.local>` — the only step that reads production.
2. `node scripts/experiments/trader-game-replay/partA-rescore.mjs --in <dir>`
3. `node scripts/experiments/trader-game-replay/partB-schedule.mjs --in <dir>`
4. `node scripts/experiments/trader-game-replay/partC-cost.mjs --in <dir>` — after Part B; it reads Part B's result file.
5. `node scripts/experiments/trader-game-replay/partE-gate.mjs --in <dir>`
6. `node scripts/experiments/trader-game-replay/partD-models.mjs <step> --in <dir> [--env <path to .env.local>]`, with the steps `plan`, `live`, `submit`, `collect` (repeat until the batch ends), then `analyze`. Only `live`, `submit` and `collect` use the network. `live` and `submit` refuse to run twice.

Each of Parts A–C and E writes its results to `<dir>/results/`; Part D writes to `<dir>/partD/`. Every part prints Markdown.
