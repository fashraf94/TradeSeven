# Trader game replay pack — rescore, schedule, cost census

**Date:** 16 Nov 2026 (prompt of 15 Nov 2026) · **Branch:** `claude/trader-game-replay-pack` from `origin/main` at `71bc6bde` · **Mode:** offline scripts over a read-only production export. No product code changed; no production write; **no model call of any kind**.

**Basis:** `docs/audits/20261115_PHASE0_BAGGERBOMB_TRADER_GAME.md` (draft PR #1070, read from `origin/claude/phase0-baggerbomb-trader-game`), Part G and sections C2, D1.

## Preamble

- **Session opening (BUILD_RULES §2, §3).** `git fetch origin` ran first. The worktree branch was renamed to `claude/trader-game-replay-pack`; HEAD `71bc6bde` equals `origin/main`; tree clean.
- **Model.** Opus 5.5, as the prompt asks.
- **Production** (project `tradeseven`), read once on 16 Nov 2026 at about 12:27 PM ET by `exportReplay.mjs`: one `where('gameMode','==','baggerbomb_agent').get()` and `.get()` on each battle's subcollections. The script holds no write call; it was searched for `.set( .update( .add( .create( .delete( batch runTransaction` before it ran (the only hits are JavaScript `Set`/`Map` calls).
- **Exports** are in `C:/Users/fashr/Documents/FantasyTrades/BaggerBombTraderGame/replay/` (outside the repository), one file per battle, named by ordinal. Every battle id, owner id and agent id is replaced inside the files by an ordinal (`battle-001`, `acct-01`, `agent-01`); a scan of every written file for every original id found 0 hits. This report uses battle ordinals only.
- **Determinism.** Parts A–C read only the export. Each ran twice and once under `TZ=UTC`; all six outputs were byte-identical.
- **Fence (BUILD_RULES §1).** Called, not edited: `calculateAssetScoreServer` and `flattenPortfolioServer` (`api/_utils/agentScoring.js`). Also called (not fenced): `stockRewardContext`, `initialRewardHistory`, `stockModelRoute`, `positions`, `isStock` (`src/utils/stockThresholdModel.js`). No scoring math is copied (§4). No legacy archetype table is imported (§2.3 ratchet untouched).
- **Part D did not run.** The prompt's paste does not end with `PART D APPROVED, $5`. Spend: **$0**. No Part D code was written.

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
| A — bank on exit | 43 of 49 completed battles reproduce their stored score; under bank on exit **5 change and 1 winner flips** (a measured battle, where the CPU loses 45 points). Mean change −2.9 points for the agent, −3.5 for the CPU. 25% of banked bonus points (275 of 1,100) came from positions whose last price no longer cleared the level. **Every lost bonus was on a position held to the end; no sold position ever carried a bonus.** | 43 battles, 453 positions |
| B — 30-minute schedule | Today the model runs on 78% of checks (459 of 589) and holds 96.7% of the time. The schedule cuts model calls from **14.8 to 9.4 per battle-day** at X = 0.5. Of 15 model swaps, 9 fell on checks the schedule skips; event checks catch 1; **8 are missed at every X**, and waiting 15 minutes would have cost **−10 points in total** (median −2.5, range −11 to +14). | 31 battle-days, 589 checks |
| C — cost | No request carries `cache_control` today. 72% of each request repeats between consecutive checks of a battle and already sits at the front. Four cost rows below; the schedule cuts each by 32–37%. | 459 calls (52 estimated) |
| D — model comparison | **Not run** (no approval line). $0. | — |

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
| 001 | legacy | a sale has no receipt (its touch record is unknown) |
| 018, 022, 031, 039 | legacy | no final score |
| 034 | legacy | no last price for a held position |

**The opponent's gate:**

- **Measured battles (13):** every CPU stock position reproduces. The CPU's crypto slot is scored by the legacy scorer and no price for it is stored, so it is taken as the remainder (−36 to +15 points, the size of a 1–4% crypto move). **Not verified.**
- **Legacy battles:** no stored field holds a last price per CPU position, so the CPU score is **not verified**. The CPU's legacy scoring call gets an empty touch record (Phase 0 G2), so bank on exit cannot change it.

**Three rules the gate relies on:**

- **Legacy touch record.** The nightly job moves it to `thresholdHistory[symbol].dailyThresholds.day1` and renames `swapPrice` to `previousSwapPrice`. The script reads both shapes.
- **Nightly reset.** That job does not change `currentScore`, so a one-day battle's stored score is its last 15-minute frame. A battle scored after its nightly reset would be excluded; none passed the other checks.
- **Unknown baselines.** In 5 legacy battles, activated the evening before, the touch baseline was the previous close, which is not stored. The entry price stands in. 35 positions are affected, and in none of them does a banked bonus depend on that baseline.

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

"Bonus lost" is the share of banked bonus points from positions whose exit (or last) price no longer cleared the level. Legacy rows count the agent side only.

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
- The grid follows each battle's own start. 26 of 31 battles start off the half-hour, so for most battles a fixed 9:30-based grid would give different checks.

**Eligible checks** are the ones that can reach the model today. A check that ended on the gameplan-meeting path (102) or on degraded quotes (17) never calls it, on either schedule.

### B1. Today

| Per battle-day | Total | Median | Mean |
|---|---|---|---|
| Checks run | 589 | 20 | 19.0 |
| Eligible | 470 | 16 | 15.2 |
| Model calls | 459 | 16 | 14.8 |

The model returns a hold on **96.7% of calls (444 of 459)**; it swaps on 15. Of the 589 checks, 130 made no call: 102 gameplan-meeting checks, 17 degraded quotes, and 11 where the gate found no trigger.

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
- **level:** the gate's own stored `threshold_proximity` trigger at this check, which is exactly "within 0.2 units of an unearned bonus or an uncrossed penalty". It is stored only where the gate ran, and a check with no trigger had none.
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
| X = 0.25 | 73 | 9.77 | 9.97 | 8 |
| X = 0.5 | 62 | 9.42 | 9.61 | 8 |
| X = 0.75 | 58 | 9.29 | 9.48 | 8 |

Today 230 model calls fall on checks the schedule keeps and 229 on checks it skips.

### B4. Model swaps at skipped checks, and the cost of waiting

9 of the 15 model swaps fell on skipped checks. One was caught by an event (a cockpit command filed in the window). **The other 8 are missed at every X**: no fill, no level, no command and no move of even 0.25 units preceded them. The model swapped on its own reading of a quiet check.

**The delay cost** is the same swap taken at the next scheduled check, 14–15 minutes later in every case, minus the swap as taken. It is scored with the real scorer from tape prices:

- the outgoing position, from its entry to its exit;
- the incoming one, from its fill to its own exit (all 9 were held to the end).

| X | Missed | Total cost of delay (pts) | Median |
|---|---|---|---|
| 0.25, 0.5, 0.75 | 8 | **−10** | −2.5 |

Per missed swap: 0, −11, −3, −5, +1, −2, −4, +14. Waiting lost points in 5, gained in 2, and was neutral in 1.

**The three worst cases** (points: outgoing leg + incoming leg, as done → delayed):

1. **−11.** A contrarian's Core swap at 2:46 PM ET on 29 Sep. The outgoing stock kept falling (−5 → −9), and the incoming one rose before the later entry (+4 → −3).
2. **−5.** An analyst's Support swap at 12:16 PM ET on 22 Oct. The outgoing stock slipped another point (−12 → −13), and the incoming one's gain was already taken (+4 → 0).
3. **−4.** A contrarian's Star swap at 1:46 PM ET on 10 Nov. Outgoing −48 → −49; incoming +20 → +17.

The best case for waiting: a degen's Core swap on 12 Nov, where the outgoing stock recovered 12 points in 15 minutes (+14).

**Price-source check.** Scoring the outgoing leg from tape prices lands a median 2 points (largest 14) from the stored locked points of the same sale. The stored fill used the battle's own quote, about 16 minutes old (Phase 0 C3); the tape prices the check's own minute. The delay costs are of the same size as this gap, so read them as "small, mixed sign", not as exact values.

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

- **ESTIMATED rows.** Usage is stored for 407 calls. For the other 52 the model call failed and no response was stored. Their input is estimated as request bytes × 0.320 tokens per byte (the median of the stored calls), and their output as the median 1,507.
- **Not verified:** whether those 52 failed calls were billed. They are costed in full, so the totals are an upper bound by up to 11%.

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
- **INTRADAY MOMENTUM** (1.0%);
- **REGIME** (0.8%);
- the opening **LIVE BATTLE STATE** lines (score, time left).

### C4. The repeating prefix

Measured in cache order (tools → system → messages), over the raw text of each block.

| Between | Pairs | Median repeating prefix | Of which block-aligned (cacheable as sent today) | First changing byte |
|---|---|---|---|---|
| Consecutive checks of one battle | 429 | 72.4% | 72.3% | the first line of the per-check context (the live battle-state lines), in all 429 |
| Different battles in the same cron run | 67 | 26.2% | 26.2% | system text byte 8 (the agent's name) or byte 83 (the archetype) in 57; inside the tool in 10 |
| Battles on the same archetype | 116 | 26.2% | 26.2% | the tool (46), the system text's name line (43), the identity block (27) |

- **Within a battle**, everything before the per-check context repeats: the tool, the system text, the identity block and the acknowledgement. It already sits first, so one breakpoint at the end of the acknowledgement caches it with no reordering. The parts identical on every call of a battle are a median **71.1%** of a request; the cost rows use that share.
- **Across battles**, only the tool and the system text's first 8 bytes repeat. The tool comes in 3 versions, which differ near the end (the cockpit declarations text). The system text starts with "You are \<name\>". 13 distinct system texts were seen across the 30 battles that made a model call.

### C5. Cost per call and per battle-day

**Assumptions:**

1. **Prices** are the prompt's table (per million tokens, checked 15 Nov 2026).
2. **"Cached 1 h"** is one breakpoint at the end of each battle's repeating parts, which are about 11,600 tokens on Haiku 4.5. That is above the minimum cacheable prompt for both models: Haiku 4.5 needs 4,096 tokens and Haiku 5.5 needs 512 (Claude API skill, `shared/prompt-caching.md` § API reference; live page `platform.claude.com/docs/en/build-with-claude/prompt-caching`).
3. **TTL simulation:**
   - The first call of a battle writes the entry at 2× the input price.
   - A later call that starts within an hour of the previous read or write reads it at 0.1× and refreshes the timer.
   - The rest of each request is billed at the full input price.
   - 9 gaps between a battle's calls ran over an hour (the longest 150 minutes); each starts a fresh write.
   - Battles do not share a cache, because their prefixes differ after byte 8 of the system text.
4. **Haiku 5.5 rows:**
   - Today's tokens are scaled by **1.3×**, input and output, because Haiku 5.5 counts the same text as about 30% more tokens (Claude API skill, `shared/model-migration.md` → Migrating to Claude Haiku 5.5).
   - Thinking tokens are **excluded**. Haiku 5.5 thinks by default, at medium effort, and how much it would think here is unmeasured; that is Part D's job.
   - The largest scaled prompt is 25,000 tokens, inside the ≤ 100,000-token price band.
   - The request as sent today would not run unchanged: Haiku 5.5 rejects a non-default `temperature` (0.4 today).
5. **Schedule rows** are Part B's schedule at X = 0.5, reading (i): 292 calls.
   - Of these, 40 use the estimates in C1.
   - 1 is an event check where no model ran today; it is costed at the battle's mean tokens.

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

**Not run.** The prompt's paste does not end with the line `PART D APPROVED, $5`. No batch, no live call, no token-counting call, and no Part D script. Spend: **$0**.

## Limits of each measurement

**Part A**

- **15-minute resolution.** A touch is the highest price seen at a check; the tape's 10-minute bars were not used to find touches between checks. This matches how the battles were actually scored.
- **The stop half of BB-8 is out of scope (Q21).** No stop was ever stored.
- **Unknown baselines.** In 5 legacy battles the touch baseline was the previous close, which is not stored. No bonus depended on it here.
- **CPU scores.** The legacy CPU score and the measured CPU crypto slot are not verified (no stored price).
- **The end of the battle counts as an exit** at the last scored price, as the prompt specifies. Phase 0 founder question 17 is still open.

**Part B**

- **Decisions held fixed.** Each scheduled check is assumed to make the decision it made today.
- **First-order only.** The delay cost prices each missed swap alone; it does not follow how the book would differ afterwards.
- **Prices.** The tape is a different price source from the battle's own quote (median gap 2 points per sale).
- **Crypto.** Crypto moves are not measured.
- **Event coverage.** The "level" event is known only where the gate ran.
- **Sample.** 15 model swaps in 31 battle-days is a small sample.

**Part C**

- **Token shares** are byte shares.
- **Estimates.** 52 calls have no stored usage, and it is not verified whether they were billed.
- **Haiku 5.5 rows** scale today's tokens by 1.3× and leave thinking out, so they are a floor for that model.
- **Scope.** Only the trading brain's calls are counted.

## Founder questions

1. **Bank on exit for the CPU.** In measured battles the CPU is rescored too. That is where the one winner flip comes from (battle 040: the CPU loses 45 points and the agent wins). Should BB-8 apply to the CPU opponent, or to the player's agent only?
2. **What a scheduled check means.** (a) The gate still decides at scheduled checks (9.42 calls/day at X = 0.5). (b) The model always runs at scheduled checks (9.61). The cost rows use (a).
3. **The grid's anchor.** (a) Every 30 minutes from the battle's first check, as measured here. (b) A fixed 9:30-based grid; 26 of 31 battles start off the half-hour, so it would change which checks run.
4. **Quiet-check swaps.** 8 of the 9 model swaps on skipped checks had no event before them, at any X. Waiting cost −10 points in total across the 8. Is a 15-minute delay on those acceptable, or should a rule keep them (for example, an event when the bench outperforms by some margin)?
5. **Crypto in the move event.** Crypto has no tape price. Should the move event (a) ignore crypto, or (b) read the battle's own crypto quote?
6. **Cross-battle caching.** The system text starts with the agent's name, so no two agents share more than the tool. Moving the name and archetype lines below the shared rules would let battles in one run share most of the system text as well. Should a build propose that? It changes the prompt's text order, which is fenced (`api/_utils/agentEvalPromptAssembly.js`).
7. **Part D.** To run the model comparison, re-send this prompt ending with `PART D APPROVED, $5`. Before sending, note that Haiku 5.5 rejects today's `temperature: 0.4`, runs thinking by default, and counts about 30% more tokens; arm (c)'s "low effort" is set by `output_config.effort`.

## Files

- `scripts/experiments/trader-game-replay/exportReplay.mjs` — the read-only export
- `scripts/experiments/trader-game-replay/replayLib.mjs` — shared pure helpers (Eastern time via Intl, tables)
- `scripts/experiments/trader-game-replay/partA-rescore.mjs` — Part A, with its self-test
- `scripts/experiments/trader-game-replay/partB-schedule.mjs` — Part B
- `scripts/experiments/trader-game-replay/partC-cost.mjs` — Part C

**Run order (from the repo root):**

1. `node scripts/experiments/trader-game-replay/exportReplay.mjs --out <dir> --env <path to .env.local>` — the only step that reads production.
2. `node scripts/experiments/trader-game-replay/partA-rescore.mjs --in <dir>`
3. `node scripts/experiments/trader-game-replay/partB-schedule.mjs --in <dir>`
4. `node scripts/experiments/trader-game-replay/partC-cost.mjs --in <dir>` — after Part B; it reads Part B's result file.

Each part writes its results to `<dir>/results/` and prints Markdown.
