# Setup payoff check — tf-setup-v1 against ordinary days (offline)

**Date:** Wednesday 18 Nov 2026 (the run began 5:17 PM ET, after the close) · **Run by:** Claude Code (Opus), local session · **Prompt:** *Experiment prompt — does a valid setup beat an ordinary day? (offline check)* (Fable, architecture review chat, 18 Nov 2026) · **Branch:** `claude/setup-payoff-check`, cut from `origin/main` at `bd841257` (#1087 had merged) · **Scripts:** `scripts/experiments/setup-payoff/` · **Review:** `docs/audits/20261118_SETUP_PAYOFF_CHECK_REVIEW.md` · **Out-of-tree copy:** `C:/Users/fashr/Documents/FantasyTrades/SetupPayoff/20261118_SETUP_PAYOFF_CHECK.md` (BUILD_RULES §3).

This check counts past price moves on paper. It ignores trading costs and the game's delayed quotes, proves no trading edge and changes no rule. Every Part B candidate is a proposal for a later rule-set version, for the founder to decide.

## Does the setup pay, in plain terms

- **Not reliably.** The test named in advance compares a fresh Pullback and Resume with uptrending stocks that have no setup, over three sessions.
  - **120-session window: better.** +0.15 units (+0.34%), each session weighted equally.
  - **But confirmation does not confirm.** Development reads better (+0.18); confirmation reads **no clear difference** (+0.08).
  - **All of 2026: no clear difference** (+0.03 units). Its development period, January to early August, is also no clear difference (−0.03). Its confirmation period, August to November, reads better in units (+0.15) but no clear difference in percent (+0.29%), and sits inside the 120-session window.
- **It does not beat an ordinary stock.** Against every stock in the universe there is **no clear difference** over three sessions in either window (−0.005 units short, −0.033 across 2026). A fresh setup's own three-session average is about zero (−0.09% short, −0.01% across 2026). Where it beats uptrending names, those names are the ones lagging: on the same sessions they trail every stock by about 0.15 units.
- **Over one session it is no better.**
  - Against uptrending names: **no clear difference** (−0.032 units short, −0.010 across 2026).
  - Against every stock: the short window reads slightly **worse** (−0.047 units, −0.15%); all of 2026 reads no clear difference (−0.009).
  - Within three sessions, 33% of setups reach +1 unit first and 35% reach −1 unit first. Every stock gives 35% and 32%.
- **January to May, a row added after the results (post hoc).** The estimate against uptrending names is negative (−0.11 units). It reads worse under the fixed test, but not once the overlap of three-session windows is allowed for (blocks of three: [−0.232, +0.003]), so it is no evidence of a reversal.
- **No Trend Breakout candidate qualified.** Even with no extension limit, a valid breakout appears on a median of **1** name a morning (none on 47% of mornings); the rule asked for 3. What binds is the pattern itself and the uptrend, not the limit. In the short window the looser candidate sets did worse than every stock over three sessions (L3–L5, about −0.3 units).
- **The archetypes' rules (today's scores, approximate).**
  - Of the 228 stocks, **198** score 40 or more, **125** 50 or more, **30** 60 or more and **2** 70 or more. The Capital Preserver's two conditions pass **16** and the Speculator's **45**.
  - Valid setups a morning among them, short window: 15, 9, 2 and 0 by score level, 1 for the Capital Preserver, 4 for the Speculator.
- **The squeeze reading now varies.** Each stock is measured against its own last 120 sessions. Between 12 and 98 names are squeezed per session (median 59.5 over the 90 short-window sessions with that history; 10 to 98 across 2026). Ranking stocks against each other always gave 47. A precondition only.
- **Seven slots from the whole universe** (short window, today's scores where a gate uses them). Names count when valid at the prior close and enterable at the open.
  - **All seven on a typical morning:** Trend Follower (97% of mornings), Fundamental Investor at 40 or more, and Diversifier.
  - **Fewer:** Trend Follower limited to the top sectors fills 6 (all seven on 42% of mornings), Speculator 3, Capital Preserver 1 (none on 29%), Fundamental Investor above 70 0 (none on 85%).
  - **Read as the code's "at least 3" quota,** the Speculator fills all seven on 64% of mornings.
  - **Counting only names that turned valid at that close:** Speculator 1, Capital Preserver 0.

| Item | Verdict |
|---|---|
| Step 0 | **Reproduced.** Median 18; 31 valid breakouts of 27,360; 456 of 456 stored records; 28,920 of 28,920 replay records equal to the frequency run's. No STOP |
| Long window | **221 sessions** (2 Jan → 17 Nov 2026), not 500: the calendar of record maintains 2026 and 2027 only. Overlap with the stored run: **0 verdict differences** in 28,920 |
| Part A, the test named in advance (three sessions vs G2) | **Short:** better, +0.146 units [+0.053, +0.247] (development better +0.179; confirmation no clear difference +0.076). **Long:** no clear difference, +0.027 [−0.042, +0.095] |
| Part A, against every stock | **Three sessions:** no clear difference in both windows (−0.005, −0.033). **One session:** short worse (−0.047), long no clear difference (−0.009) |
| Part A, overlap sensitivity | The short window's "better" holds with blocks of 3 and 5 sessions. The post-hoc January–May "worse" does not |
| Part B | **No candidate qualifies.** The highest development median is 1 valid breakout a morning. Recommendation: none, under both readings |
| Part C | 198 / 125 / 30 / 2 stocks at 40 / 50 / 60 / 70. Capital Preserver 16, Speculator 45 (today's scores, approximate) |
| Part D | **Varies:** 12–98 names a session (short), 10–98 (long). A precondition only |
| Part E | **All seven:** Trend Follower, Fundamental Investor ≥40, Diversifier. **Speculator** 3 (quota reading: all seven on 64%). **Capital Preserver** 1. **Fundamental Investor >70** 0. Medians, literal reading |
| Requests | **241 EODHD requests** of the 260 cap, 0 failed, outside market hours. No model call. No production read |
| Rules | New files only. No evaluator, threshold, golden, store, sweep, flag, rule, fenced file or test changed. **No new import-guard entry** |
| Review (BUILD_RULES §2) | 3 lenses, 3 refuters: **29 findings, 15 confirmed, 12 partly, 2 refuted; no high.** No fixed figure moved; the wording and disclosures changed (the post-hoc January–May row hedged; reading R-10 added). Fixes in `7133ec29`, `43beaf0c` and this report. Record: `…_REVIEW.md` |

## Preamble

**In plain terms.** This section records what the session started from and what it touched. It changed nothing in the product: five scripts, this report and its review record. The definitions were committed before any outcome was computed, and that commit is the proof. Where the work's order differed from the prompt's, it says so.

- **Session opening (BUILD_RULES §2, §3).** `git fetch origin` ran first and succeeded. `origin/main` = `bd841257`, the merge of #1087 (the frequency count). So by rule 1 the branch was cut from `origin/main`: `claude/setup-payoff-check`, HEAD `bd841257`, tree clean. This PR's diff carries only this check's files.
- **The order of work, against the prompt's "before anything else" (review SP-L2-1).**
  - The prompt asks for Step 0 before anything else. The one long fetch ran first, at 22:27 UTC. The Step 0 re-run followed at 22:42–22:49 UTC.
  - The fetch is read-only, capped and computes no outcome. Had Step 0 failed, though, its 241 requests would have been spent for nothing.
  - `fetchLong.mjs` ran before it was committed; it was committed unchanged in `30954dc2`.
  - `analyze.mjs` now computes Step 0 before it reads anything the fetch produced.
- **Definitions before results.** Every definition is `DEFINITIONS` in `scripts/experiments/setup-payoff/lib.mjs`. It was committed with the analysis at `30954dc2`, before `analyze.mjs` first ran.
  - **After the first results (`285cc844`).** One citation was corrected and three added. One disclosure was added: rows missing in 2025.
  - **The Part D comparison was replaced.** The first run's line set fetched bars on all 120 short-window sessions (median 49) beside stored bars on 90. It became the two sources on the same 90 sessions.
  - **Also in `285cc844`:** the January–May row, labelled post hoc, and fuller tables.
  - **After the review:** the changes are in the review record.
  - **Every fixed figure stayed byte-identical** through both. `DEFINITIONS` is unchanged. The prompt left ten points open, and the readings R-1 to R-10 below settle them.
- **The store is reached only through the frequency run's own module,** `scripts/experiments/setup-frequency/storeReplay.mjs`: `replayOne` at `:42` and `compactOf` at `:56`. That module is already on the import guard's list (`api/_utils/setupEvidence/setupEvidenceImportGuard.test.js:82`). No new file names the store's folder or collections, and the guard passes unchanged (72 of 72).
- **Product modules called, read only:**
  - the calendar (`marketSchedule.js`) and the universe (`rankingConfig.js`);
  - the bar mapper `mapDailyRows` (`api/_utils/marketDataCache.js:317`);
  - the band-width function (`api/_utils/technicalCalculations.js:247`);
  - the evaluator's decimal helpers (`api/_utils/setupEvaluator/evidenceValues.js`);
  - the provider request `fetchDailyPayload` (`api/_utils/eodhdDailyWindow.js:34`), in `fetchLong.mjs` only.
- **Fenced functions: none called, none edited.** `api/_utils/archetypeScoring.js` (fenced, `docs/BUILD_RULES.md:23`) is read as text, and each cited level is asserted on its line.
- **Markers.** Every `file:line` is VERIFIED: read at `bd841257` in this session and re-asserted by `analyze.mjs` at run time.
- **No account ids, player text or list names** appear anywhere. The check reads only symbols, scores, bars and verdicts.
- **Two operational notes.**
  - The first enrichment attempt ran 12 processes with no heap cap, and free memory fell to 0.5 GB of 32 GB. Those processes were stopped by their own command line, and the step re-ran with a 600 MB heap, six at a time. Nothing from the first attempt is used.
  - During the review, a determinism re-run rewrote `summary.json` in the run folder with identical bytes.

**Readings (where the prompt was open):**

| Id | Point | Reading |
|---|---|---|
| R-1 | "Entered the same way" for the comparison groups | The entry filter (open ≤ the record's own limit) applies to every arm. Each arm without the filter is a secondary row. The headline label is the same either way (short +0.146 filtered, +0.147 unfiltered) |
| R-2 | "Fresh only: names valid at the prior close" | Taken literally, the three-session shelf life is a *subset* of fresh. Both readings are reported: literal, and "turned valid at the prior close". Founder question 3 |
| R-3 | A day where both patterns hold | The rule names it breakout (`tfSetupV1.js:80`, `:297`), so it is not a Pullback and Resume event |
| R-4 | The Diversifier's "seven names across at least five sectors" | A seven-name book spanning at least 5 sectors holds at most S + 2 valid names when they cover S sectors: fill = min(7, N, S + 2). The code's own 7-sector rule (`archetypeScoring.js:87`) sits beside it: min(7, N, S) |
| R-5 | Part B's "not below zero" | The estimate is ≥ 0. The interval reading (not wholly below zero) sits beside it. Both give none |
| R-6 | "Tightest" across the L and H families | Fewest candidate-valid stock-days in development: L0 < L1 < H1 < L2 < H2 < L3 < L4 < L5 in both windows |
| R-7 | Volatility thirds | Per session: the unit (ATR ÷ close) ranked among that session's stocks |
| R-8 | Part D ties and coverage | idx = how many of the other 119 sessions are strictly narrower; pct = round(idx ÷ 119 × 100) ≤ 20, the producer's own formula applied along time. A session counts only when all 228 stocks have 120 trailing sessions |
| R-9 | Splits and dividends in the outcome window | Raw prices. An adjusted-to-raw step above 10% (the evaluator's split rule) excludes the outcome at that horizon. Smaller steps (ex-dividend days) are kept, counted, and dropped in one sensitivity row. That row also drops an ex-dividend day at *t* + 1, which cannot move a return measured from that day's open, so it is conservative. The headline is unchanged (short +0.148) |
| R-10 | The archetypes' levels in Part E | The code states quotas on the deploy model's 25–35-name shortlist ("at least 3 stocks with ATR percentile above 0.80", `archetypeScoring.js:89`; "at least 5 … above 70", `:91`; "at least 5 … above 60", `:93`), not rules on seven slots. Part E applies each level to every slot, following the prompt's "gates" and the frequency run's overlays. Added after the review: the same levels read as quotas over the seven slots. The Speculator then fills all seven on 64% of short-window mornings (66% long). The Fundamental Investor above 70 never does. The Capital Preserver does on 0% short and 4% long (Part E) |

## Step 0 — reproduce, then fix the windows

**In plain terms.** The check re-ran the frequency count's own replay and got its numbers exactly. It also fetched a longer price history (the fetch ran first, as the Preamble says) and replayed every 2026 session. On the 120 sessions the two runs share, every verdict matched.

- **The re-run.** The frequency run's stored output drops ATR, the 20-day average, the swing high and the pattern assessments, which Parts A and B need. So `enrich.mjs` re-ran that run's own module over its stored bars for all 241 symbols × 120 sessions, keeping those values beside each record. `analyze.mjs` then compares every compact record with the frequency run's `replay.json`, field for field. It also checks each record's own extension limit against its 20-day average and ATR, rebuilt in exact decimal: 28,654 of 28,654 stored records and 52,696 of 52,696 fetched agree. That ties the two facts `replay.json` does not carry to one it does.
- **The three figures,** recounted from that re-run. `analyze.mjs` stops before any outcome if one differs:

| Check | Expected | Re-run |
|---|---|---|
| Median valid names a morning | 18 | 18 |
| Valid Trend Breakout stock-days | 31 | 31 of 27360 |
| Stored records matching | 456 of 456 | 456 of 456 |
| Compact records equal to the frequency run's replay.json | all | 28920 of 28920 |

- **The long window.**
  - **Why 221 sessions.** The calendar of record maintains 2026 and 2027 only (`src/utils/marketCalendar.js:69`). For an earlier session the calendar names no session, so the replay cannot set its clock (`storeReplay.mjs:46`), and the store's adapter refuses it (`calendar_missing`, `dailyBarsAdapter.js:97`). Extending the calendar is a product change. So the long window is **every 2026 session to 17 Nov: 221**.
  - **Periods.** Development is the first 147 (2 Jan → 4 Aug) and confirmation the last 74 (5 Aug → 17 Nov). In the short window, development is 29 May → 22 Sep (80 sessions) and confirmation 23 Sep → 17 Nov (40).
  - **Sources.** The fetch supplies the first 101 sessions. On the 120 shared sessions the long window uses the stored run, for verdicts and prices, as the prompt asks.
- **Overlap check.** The fetched bars, replayed on the 120 shared sessions for all 241 symbols, give the **same verdict, reason, pattern, patterns satisfied, regime and refusal on all 28,920** stock-days.
  - On 86 of them the ATR and the extension limit differ, all on 17 Nov. The stored series read that day's bar at 7:10 PM ET, before the provider's final values; no verdict changed.
- **Refusals in the 101 fetched sessions.** 119 split refusals among the 228 stocks (`basis_discontinuity`), nothing else. Five sector funds also carry split refusals keyed to 5 Dec 2025, but no part reads a fund's verdict. SPY is never refused.
- **The 2025 rows.** 54 long-window sessions read bars from 2025, back to 15 Oct 2025. The adapter's missing-bar check is not available for those rows (`dailyBarsAdapter.js:214`). Checked directly: no universe series misses or adds a date against SPY's 54 rows there.
- **Limits, stated up front.** The 228 stocks are today's ranked list applied to past sessions, which favours survivors. Both windows lie inside one year: the short window is June to November 2026, the long window January to November 2026.

## Part A — Pullback and Resume against an ordinary day

**In plain terms.** Buying a fresh Pullback and Resume at the next open earned about nothing over the next one or three sessions on average. Over three sessions that is about the same as buying any of the 228; over one session it was slightly worse in the short window. By the test named in advance it beat uptrending stocks with no setup in the June–November window, but not across all of 2026, and the confirmation period does not confirm in either window. A January–May row added afterwards points the other way, but not robustly.

**The method** (`lib.mjs` `DEFINITIONS`; `analyze.mjs` `outcomeOf`, `measure` and `compare`):
- **The event.** Valid with pattern `pullback_resume` at the close of *t* and not valid at *t* − 1. The secondary table counts every such valid day.
- **The entry.** The raw open of *t* + 1, only when it is at or below the record's own extension limit. This removes **24 of 980** events in the short window and **48 of 1,948** in the long.
- **The moves.** To the raw close of *t* + 1 and of *t* + 3, in percent and in units. A unit is the record's own ATR ÷ close at *t*. **The three-session move uses the one-day unit**, because the 3-day scaled unit is not adopted.
- **The barrier.** Up is entry × (1 + unit) and down is entry × (1 − unit), on raw highs and lows. A session that reaches both counts the adverse one first.
- **The groups.** G1 is every stock with a record; G2 is invalid · no setup; G3 is invalid · extended. Each is measured on the sessions with at least one event.
- **The test.** For each session, the event mean minus the group mean. These differences are averaged across sessions, each session weighted equally, as the prompt defines it. The 90% interval comes from 2,000 resamples of whole sessions (mulberry32, seed 20261118).

**The labels** (units first; percent in the full tables). The January–May column was added after the results and is not a fixed label:

| Comparison | Short · development | Short · confirmation | Short · whole | Long · development | Long · confirmation | Long · whole | Jan–May (post hoc) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Event vs G2 (uptrend, no setup), three sessions, units (headline)** | better +0.179 [+0.069, +0.286] | no clear difference +0.076 [-0.123, +0.281] | better +0.146 [+0.053, +0.247] | no clear difference -0.030 [-0.115, +0.054] | better +0.145 [+0.013, +0.270] | no clear difference +0.027 [-0.042, +0.095] | worse -0.108 [-0.210, -0.007] |
| Event vs G2 (uptrend, no setup), three sessions, % | better +0.44 [+0.09, +0.78] | no clear difference +0.14 [-0.52, +0.84] | better +0.34 [+0.03, +0.68] | no clear difference -0.11 [-0.40, +0.17] | no clear difference +0.29 [-0.16, +0.70] | no clear difference +0.02 [-0.21, +0.25] | worse -0.36 [-0.71, -0.02] |
| Event vs G2 (uptrend, no setup), one session, units | no clear difference -0.012 [-0.070, +0.044] | no clear difference -0.073 [-0.180, +0.028] | no clear difference -0.032 [-0.085, +0.019] | no clear difference +0.004 [-0.038, +0.047] | no clear difference -0.037 [-0.108, +0.030] | no clear difference -0.010 [-0.050, +0.030] | no clear difference +0.016 [-0.041, +0.074] |
| Event vs G2 (uptrend, no setup), one session, % | no clear difference -0.05 [-0.22, +0.12] | no clear difference -0.28 [-0.62, +0.05] | no clear difference -0.12 [-0.29, +0.04] | no clear difference -0.00 [-0.14, +0.15] | no clear difference -0.15 [-0.38, +0.06] | no clear difference -0.05 [-0.18, +0.08] | no clear difference +0.03 [-0.16, +0.23] |
| Event vs G1 (every stock), three sessions, units | no clear difference +0.043 [-0.046, +0.132] | no clear difference -0.109 [-0.280, +0.052] | no clear difference -0.005 [-0.086, +0.074] | no clear difference -0.060 [-0.131, +0.015] | no clear difference +0.022 [-0.086, +0.121] | no clear difference -0.033 [-0.091, +0.025] | no clear difference -0.069 [-0.153, +0.018] |
| Event vs G1 (every stock), three sessions, % | no clear difference +0.05 [-0.25, +0.36] | no clear difference -0.33 [-0.95, +0.29] | no clear difference -0.07 [-0.35, +0.21] | no clear difference -0.17 [-0.40, +0.07] | no clear difference -0.03 [-0.41, +0.33] | no clear difference -0.12 [-0.31, +0.08] | no clear difference -0.19 [-0.47, +0.08] |
| Event vs G1 (every stock), one session, units | no clear difference -0.029 [-0.079, +0.022] | no clear difference -0.082 [-0.175, +0.010] | worse -0.047 [-0.091, -0.003] | no clear difference +0.005 [-0.032, +0.044] | no clear difference -0.039 [-0.102, +0.019] | no clear difference -0.009 [-0.041, +0.025] | no clear difference +0.033 [-0.012, +0.080] |
| Event vs G1 (every stock), one session, % | no clear difference -0.09 [-0.24, +0.06] | no clear difference -0.28 [-0.58, +0.01] | worse -0.15 [-0.29, -0.02] | no clear difference +0.01 [-0.11, +0.16] | no clear difference -0.14 [-0.34, +0.04] | no clear difference -0.04 [-0.15, +0.07] | no clear difference +0.09 [-0.07, +0.27] |

**What the arms did on average** (whole window; per trade, in units, with percent in brackets). The test above averages *per-session* differences instead. On the 116 paired short-window sessions, each weighted equally, the event averages +0.028 units, G2 −0.118 and every stock +0.033. That is why the +0.146 is mostly G2 lagging.

| Arm | Short: n (3-day) | Short: 1-day | Short: 3-day | Short: 3-day ≥+1u / ≤−1u | Long: n (3-day) | Long: 1-day | Long: 3-day | Long: 3-day ≥+1u / ≤−1u |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The event (first valid day) | 931 | -0.063 (-0.17%) | -0.019 (-0.09%) | 18.9% / 17% | 1875 | -0.012 (-0.04%) | -0.004 (-0.01%) | 18.3% / 17.5% |
| Every valid pullback day | 2186 | -0.031 (-0.09%) | -0.034 (-0.12%) | 17.3% / 17.4% | 4518 | -0.003 (-0.02%) | -0.006 (-0.02%) | 18.4% / 17.9% |
| G1 every stock | 22528 | -0.016 (-0.04%) | +0.030 (+0.07%) | 18.6% / 16.7% | 41674 | -0.002 (-0.00%) | +0.037 (+0.11%) | 18.8% / 17.1% |
| G2 uptrend, no setup | 2817 | -0.021 (-0.05%) | -0.059 (-0.17%) | 17.6% / 19.3% | 5149 | +0.010 (+0.03%) | +0.015 (+0.05%) | 18.8% / 17.8% |
| G3 extended (small) | 34 | +0.182 (+0.65%) | +0.012 (-0.03%) | 26.5% / 23.5% | 69 | -0.118 (-0.26%) | +0.063 (+0.23%) | 29% / 26.1% |

- **The barrier.** Over one session the event touches −1 unit first more often than +1 unit. In the short window: 13.7% against 9.6% (every stock: 9.2% and 8.9%).
- **Within three sessions** the three outcomes are about a third each: +1 unit first, −1 unit first, or neither.
- **Both barriers in one session** happened 3 times in 931 three-session events (short window), so the adverse-first convention moves the shares by at most 0.3 points.
- **Splits** (full tables below; units, three sessions against G2):
  - **Low volatility.** The lowest-volatility third is the only split labelled better in both windows (short +0.275, long +0.149). It is one of 120 split labels a window at 90%, so a few such labels are expected by chance.
  - **Capital Preserver's rule** (today's scores, approximate). No clear difference short (+0.073, small); better long (+0.264, small).
  - **Speculator's rule** (today's scores, approximate). No clear difference (+0.002 short, −0.101 long).
  - **SPY downtrend.** No clear difference (−0.014 short, small; −0.136 long).
  - **Few sessions.** A split with fewer than five paired sessions is shown as "too few sessions", not by its label. The Fundamental Investor above 70 rests on 0 to 1 paired sessions against G2.
- **The overlap sensitivity** (table below).
  - Adjacent sessions' three-session windows overlap, so resampling whole sessions can understate the interval. The same per-session differences were re-drawn in blocks of 3 and 5 sessions.
  - The short window's "better" holds (blocks of three [+0.047, +0.248]), and so does the long confirmation's (+0.005 at the low end).
  - The January–May "worse" does not ([−0.232, +0.003]).

<details><summary>Part A, short window: every table (measurements and tests by period, splits)</summary>

### Part A — short window (120 sessions, 2026-05-29 → 2026-11-17; development 80, confirmation 40)

**Development — measurements.** Groups are measured on the sessions that have at least one event.

| Arm | Stock-days | Removed by entry | No next open | n 1-day | n 3-day | 3-day censored / split | 1-day % | 1-day units | 3-day % | 3-day units | 3-day median units | 1-day ≥+1u / ≤−1u | 3-day ≥+1u / ≤−1u | 1-day barrier up / down / neither (both same session) | 3-day barrier up / down / neither (both) | 3-day dividend steps |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Valid · pullback, first day (the event) | 758 | 17 | 0 | 741 | 739 | 0 / 2 | -0.17 | -0.069 | -0.10 | -0.038 | -0.102 | 3.9% / 5.4% | 18.4% / 17.3% | 9.9% / 14% / 76.1% (1) | 33.3% / 35.5% / 31.3% (2) | 29 |
| Valid · pullback, every day (secondary) | 1770 | 47 | 0 | 1723 | 1719 | 0 / 4 | -0.09 | -0.036 | -0.19 | -0.069 | -0.116 | 4.1% / 4.9% | 16.5% / 18.2% | 10% / 11.3% / 78.7% (1) | 32.6% / 34.9% / 32.5% (4) | 60 |
| Event, no entry filter | 758 | 0 | 0 | 758 | 756 | 0 / 2 | -0.20 | -0.077 | -0.16 | -0.055 | -0.117 | 3.8% / 5.5% | 18.3% / 17.9% | 9.9% / 14.4% / 75.7% (3) | 32.9% / 36.4% / 30.7% (4) | 30 |
| G1 every stock | 17781 | 1990 | 0 | 15789 | 15785 | 0 / 6 | -0.07 | -0.033 | +0.02 | -0.019 | -0.036 | 3.7% / 4.5% | 16.9% / 17.5% | 8.5% / 9.3% / 82.3% (11) | 33.3% / 33% / 33.7% (38) | 685 |
| G2 uptrend, no setup | 3263 | 1167 | 0 | 2095 | 2095 | 0 / 1 | -0.08 | -0.037 | -0.23 | -0.102 | -0.048 | 4.3% / 5.3% | 17% / 21.1% | 8.9% / 9.3% / 81.8% (3) | 34.2% / 35% / 30.7% (7) | 99 |
| G3 extended | 179 | 151 | 0 | 27 | 27 | 0 / 1 | +0.56 | +0.142 | -0.20 | -0.048 | -0.007 | 14.8% / 7.4% | 29.6% / 25.9% | 18.5% / 22.2% / 59.3% (0) | 40.7% / 40.7% / 18.5% (0) | 0 |
| G1, no entry filter | 17781 | 0 | 0 | 17778 | 17772 | 0 / 9 | -0.09 | -0.037 | -0.05 | -0.039 | -0.049 | 3.8% / 4.7% | 16.6% / 18.1% | 8.6% / 9.6% / 81.8% (18) | 33% / 33.9% / 33.1% (50) | 761 |
| G2, no entry filter | 3263 | 0 | 0 | 3262 | 3261 | 0 / 2 | -0.14 | -0.058 | -0.39 | -0.147 | -0.116 | 4.2% / 5.6% | 15.4% / 21.9% | 8.6% / 10.2% / 81.2% (5) | 32.1% / 37.1% / 30.8% (13) | 149 |
| G3, no entry filter | 179 | 0 | 0 | 178 | 177 | 0 / 2 | -0.01 | -0.024 | -0.76 | -0.279 | -0.072 | 5.6% / 6.7% | 10.7% / 22.6% | 12.9% / 15.2% / 71.9% (0) | 31.6% / 40.1% / 28.2% (0) | 2 |

**Confirmation — measurements.** Groups are measured on the sessions that have at least one event.

| Arm | Stock-days | Removed by entry | No next open | n 1-day | n 3-day | 3-day censored / split | 1-day % | 1-day units | 3-day % | 3-day units | 3-day median units | 1-day ≥+1u / ≤−1u | 3-day ≥+1u / ≤−1u | 1-day barrier up / down / neither (both same session) | 3-day barrier up / down / neither (both) | 3-day dividend steps |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Valid · pullback, first day (the event) | 222 | 7 | 7 | 208 | 192 | 16 / 0 | -0.17 | -0.042 | -0.07 | +0.057 | +0.042 | 3.8% / 6.7% | 20.8% / 15.6% | 8.7% / 12.5% / 78.8% (1) | 33.3% / 31.8% / 34.9% (1) | 8 |
| Valid · pullback, every day (secondary) | 529 | 13 | 12 | 504 | 467 | 37 / 0 | -0.07 | -0.013 | +0.15 | +0.096 | +0.113 | 3.4% / 5% | 20.1% / 14.6% | 9.1% / 10.3% / 80.6% (1) | 35.8% / 30.6% / 33.6% (1) | 13 |
| Event, no entry filter | 222 | 0 | 7 | 215 | 199 | 16 / 0 | -0.24 | -0.071 | -0.09 | +0.036 | +0.033 | 3.7% / 7.9% | 20.6% / 16.1% | 8.4% / 13.5% / 78.1% (1) | 32.7% / 32.2% / 35.2% (1) | 8 |
| G1 every stock | 9086 | 1699 | 227 | 7159 | 6743 | 414 / 3 | +0.01 | +0.020 | +0.20 | +0.144 | +0.148 | 4.7% / 4.3% | 22.6% / 14.8% | 9.7% / 9.1% / 81.2% (17) | 38.7% / 30.9% / 30.5% (35) | 245 |
| G2 uptrend, no setup | 1577 | 684 | 57 | 836 | 722 | 114 / 0 | +0.03 | +0.019 | -0.00 | +0.063 | +0.103 | 3.8% / 3.8% | 19.3% / 14.1% | 7.9% / 6.7% / 85.4% (1) | 38.4% / 26.7% / 34.9% (5) | 53 |
| G3 extended | 83 | 75 | 1 | 7 | 7 | 0 / 0 | +1.02 | +0.336 | +0.66 | +0.243 | -0.210 | 14.3% / 14.3% | 14.3% / 14.3% | 14.3% / 14.3% / 71.4% (0) | 28.6% / 42.9% / 28.6% (0) | 1 |
| G1, no entry filter | 9086 | 0 | 227 | 8858 | 8402 | 454 / 3 | -0.01 | +0.010 | +0.16 | +0.129 | +0.117 | 5.3% / 5% | 22.7% / 15.5% | 10.1% / 10.5% / 79.3% (21) | 39.1% / 32% / 28.9% (46) | 291 |
| G2, no entry filter | 1577 | 0 | 57 | 1520 | 1375 | 145 / 0 | -0.05 | -0.014 | -0.24 | -0.038 | -0.033 | 4.9% / 5.1% | 18% / 17.2% | 9.2% / 10.4% / 80.4% (1) | 37.2% / 32.7% / 30% (8) | 77 |
| G3, no entry filter | 83 | 0 | 1 | 82 | 81 | 1 / 0 | -0.61 | -0.265 | -0.53 | -0.163 | -0.265 | 7.3% / 22% | 14.8% / 27.2% | 7.3% / 31.7% / 61% (0) | 28.4% / 56.8% / 14.8% (0) | 5 |

**Whole window — measurements.** Groups are measured on the sessions that have at least one event.

| Arm | Stock-days | Removed by entry | No next open | n 1-day | n 3-day | 3-day censored / split | 1-day % | 1-day units | 3-day % | 3-day units | 3-day median units | 1-day ≥+1u / ≤−1u | 3-day ≥+1u / ≤−1u | 1-day barrier up / down / neither (both same session) | 3-day barrier up / down / neither (both) | 3-day dividend steps |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Valid · pullback, first day (the event) | 980 | 24 | 7 | 949 | 931 | 16 / 2 | -0.17 | -0.063 | -0.09 | -0.019 | -0.062 | 3.9% / 5.7% | 18.9% / 17% | 9.6% / 13.7% / 76.7% (2) | 33.3% / 34.7% / 32% (3) | 37 |
| Valid · pullback, every day (secondary) | 2299 | 60 | 12 | 2227 | 2186 | 37 / 4 | -0.09 | -0.031 | -0.12 | -0.034 | -0.054 | 3.9% / 4.9% | 17.3% / 17.4% | 9.8% / 11.1% / 79.1% (2) | 33.3% / 34% / 32.8% (5) | 73 |
| Event, no entry filter | 980 | 0 | 7 | 973 | 955 | 16 / 2 | -0.21 | -0.076 | -0.15 | -0.036 | -0.078 | 3.8% / 6.1% | 18.7% / 17.5% | 9.6% / 14.2% / 76.3% (4) | 32.9% / 35.5% / 31.6% (5) | 38 |
| G1 every stock | 26867 | 3689 | 227 | 22948 | 22528 | 414 / 9 | -0.04 | -0.016 | +0.07 | +0.030 | +0.013 | 4% / 4.5% | 18.6% / 16.7% | 8.9% / 9.2% / 81.9% (28) | 34.9% / 32.4% / 32.7% (73) | 930 |
| G2 uptrend, no setup | 4840 | 1851 | 57 | 2931 | 2817 | 114 / 1 | -0.05 | -0.021 | -0.17 | -0.059 | -0.010 | 4.2% / 4.9% | 17.6% / 19.3% | 8.6% / 8.6% / 82.8% (4) | 35.3% / 32.9% / 31.8% (12) | 152 |
| G3 extended | 262 | 226 | 1 | 34 | 34 | 0 / 1 | +0.65 | +0.182 | -0.03 | +0.012 | -0.038 | 14.7% / 8.8% | 26.5% / 23.5% | 17.6% / 20.6% / 61.8% (0) | 38.2% / 41.2% / 20.6% (0) | 1 |
| G1, no entry filter | 26867 | 0 | 227 | 26636 | 26174 | 454 / 12 | -0.06 | -0.022 | +0.02 | +0.015 | +0.000 | 4.3% / 4.8% | 18.5% / 17.3% | 9.1% / 9.9% / 81% (39) | 35% / 33.3% / 31.7% (96) | 1052 |
| G2, no entry filter | 4840 | 0 | 57 | 4782 | 4636 | 145 / 2 | -0.12 | -0.044 | -0.34 | -0.114 | -0.089 | 4.4% / 5.5% | 16.2% / 20.5% | 8.8% / 10.2% / 80.9% (6) | 33.6% / 35.8% / 30.6% (21) | 226 |
| G3, no entry filter | 262 | 0 | 1 | 260 | 258 | 1 / 2 | -0.20 | -0.100 | -0.69 | -0.243 | -0.194 | 6.2% / 11.5% | 12% / 24% | 11.2% / 20.4% / 68.5% (0) | 30.6% / 45.3% / 24% (0) | 7 |

**The test — three-session move, units.** Mean of per-session differences (valid arm minus group) [90% interval]; sessions paired.

| Comparison | Development | Confirmation | Whole window | Sessions (whole) | n event / n group (whole) |
|---|---|---|---|---|---|
| Event vs G2 (headline) | better: +0.179 [+0.069, +0.286] | no clear difference: +0.076 [-0.123, +0.281] | better: +0.146 [+0.053, +0.247] | 116 | 931 / 2817 |
| Event vs G1 | no clear difference: +0.043 [-0.046, +0.132] | no clear difference: -0.109 [-0.280, +0.052] | no clear difference: -0.005 [-0.086, +0.074] | 116 | 931 / 22528 |
| Event vs G3 | no clear difference · small: -0.018 [-0.579, +0.540] | no clear difference · small: -0.201 [-1.952, +1.422] | no clear difference · small: -0.079 [-0.732, +0.601] | 21 | 168 / 34 |
| Every valid day vs G2 | better: +0.099 [+0.018, +0.180] | no clear difference: +0.174 [-0.026, +0.372] | better: +0.123 [+0.040, +0.210] | 117 | 2186 / 2837 |
| Every valid day vs G1 | no clear difference: -0.029 [-0.087, +0.031] | no clear difference: -0.011 [-0.148, +0.118] | no clear difference: -0.023 [-0.081, +0.035] | 117 | 2186 / 22724 |
| Every valid day vs G3 | no clear difference · small: -0.101 [-0.619, +0.365] | no clear difference · small: +0.025 [-1.404, +1.501] | no clear difference · small: -0.059 [-0.638, +0.579] | 21 | 415 / 34 |
| Event vs G2, no entry filter | better: +0.177 [+0.076, +0.277] | no clear difference: +0.084 [-0.080, +0.252] | better: +0.147 [+0.062, +0.235] | 116 | 955 / 4636 |
| Event vs G1, no entry filter | no clear difference: +0.045 [-0.042, +0.132] | no clear difference: -0.094 [-0.266, +0.071] | no clear difference: +0.001 [-0.078, +0.078] | 116 | 955 / 26174 |
| Event vs G3, no entry filter | better: +0.277 [+0.075, +0.485] | no clear difference · small: +0.070 [-0.454, +0.492] | better: +0.224 [+0.025, +0.426] | 78 | 694 / 258 |
| Event vs G2, dividend steps dropped | better: +0.170 [+0.056, +0.285] | no clear difference: +0.099 [-0.097, +0.294] | better: +0.148 [+0.050, +0.252] | 115 | 894 / 2625 |

**The test — three-session move, percent.** Mean of per-session differences (valid arm minus group) [90% interval]; sessions paired.

| Comparison | Development | Confirmation | Whole window | Sessions (whole) | n event / n group (whole) |
|---|---|---|---|---|---|
| Event vs G2 (headline) | better: +0.44 [+0.09, +0.78] | no clear difference: +0.14 [-0.52, +0.84] | better: +0.34 [+0.03, +0.68] | 116 | 931 / 2817 |
| Event vs G1 | no clear difference: +0.05 [-0.25, +0.36] | no clear difference: -0.33 [-0.95, +0.29] | no clear difference: -0.07 [-0.35, +0.21] | 116 | 931 / 22528 |
| Event vs G3 | no clear difference · small: +0.08 [-1.52, +1.69] | no clear difference · small: -1.17 [-5.74, +2.84] | no clear difference · small: -0.34 [-2.09, +1.41] | 21 | 168 / 34 |
| Every valid day vs G2 | no clear difference: +0.21 [-0.07, +0.47] | no clear difference: +0.59 [-0.00, +1.18] | better: +0.33 [+0.07, +0.59] | 117 | 2186 / 2837 |
| Every valid day vs G1 | no clear difference: -0.16 [-0.35, +0.03] | no clear difference: +0.12 [-0.33, +0.54] | no clear difference: -0.07 [-0.26, +0.12] | 117 | 2186 / 22724 |
| Every valid day vs G3 | no clear difference · small: -0.32 [-1.65, +0.88] | no clear difference · small: -0.03 [-3.25, +3.32] | no clear difference · small: -0.22 [-1.57, +1.27] | 21 | 415 / 34 |
| Event vs G2, no entry filter | better: +0.45 [+0.12, +0.78] | no clear difference: +0.18 [-0.39, +0.80] | better: +0.37 [+0.08, +0.67] | 116 | 955 / 4636 |
| Event vs G1, no entry filter | no clear difference: +0.05 [-0.24, +0.35] | no clear difference: -0.22 [-0.82, +0.39] | no clear difference: -0.03 [-0.31, +0.25] | 116 | 955 / 26174 |
| Event vs G3, no entry filter | better: +0.72 [+0.02, +1.41] | no clear difference · small: +0.04 [-1.55, +1.45] | no clear difference: +0.54 [-0.10, +1.21] | 78 | 694 / 258 |
| Event vs G2, dividend steps dropped | better: +0.41 [+0.04, +0.78] | no clear difference: +0.19 [-0.49, +0.86] | better: +0.34 [+0.02, +0.69] | 115 | 894 / 2625 |

**The test — one-session move, units.** Mean of per-session differences (valid arm minus group) [90% interval]; sessions paired.

| Comparison | Development | Confirmation | Whole window | Sessions (whole) | n event / n group (whole) |
|---|---|---|---|---|---|
| Event vs G2 (headline) | no clear difference: -0.012 [-0.070, +0.044] | no clear difference: -0.073 [-0.180, +0.028] | no clear difference: -0.032 [-0.085, +0.019] | 118 | 949 / 2931 |
| Event vs G1 | no clear difference: -0.029 [-0.079, +0.022] | no clear difference: -0.082 [-0.175, +0.010] | worse: -0.047 [-0.091, -0.003] | 118 | 949 / 22948 |
| Event vs G3 | no clear difference · small: -0.126 [-0.447, +0.246] | no clear difference · small: -0.355 [-1.018, +0.266] | no clear difference · small: -0.202 [-0.494, +0.121] | 21 | 168 / 34 |
| Every valid day vs G2 | no clear difference: +0.014 [-0.028, +0.056] | no clear difference: -0.010 [-0.079, +0.057] | no clear difference: +0.006 [-0.028, +0.041] | 119 | 2227 / 2951 |
| Every valid day vs G1 | no clear difference: -0.001 [-0.032, +0.029] | no clear difference: -0.019 [-0.079, +0.041] | no clear difference: -0.007 [-0.034, +0.022] | 119 | 2227 / 23144 |
| Every valid day vs G3 | no clear difference · small: -0.087 [-0.402, +0.280] | no clear difference · small: -0.196 [-0.806, +0.399] | no clear difference · small: -0.123 [-0.395, +0.180] | 21 | 417 / 34 |
| Event vs G2, no entry filter | no clear difference: -0.011 [-0.068, +0.043] | no clear difference: -0.071 [-0.176, +0.034] | no clear difference: -0.031 [-0.081, +0.022] | 118 | 973 / 4782 |
| Event vs G1, no entry filter | no clear difference: -0.035 [-0.083, +0.014] | no clear difference: -0.093 [-0.194, +0.010] | worse: -0.054 [-0.099, -0.008] | 118 | 973 / 26636 |
| Event vs G3, no entry filter | no clear difference: -0.009 [-0.123, +0.107] | no clear difference · small: -0.048 [-0.267, +0.179] | no clear difference: -0.019 [-0.125, +0.082] | 80 | 706 / 260 |
| Event vs G2, dividend steps dropped | no clear difference: -0.011 [-0.070, +0.046] | no clear difference: -0.077 [-0.183, +0.026] | no clear difference: -0.032 [-0.086, +0.019] | 118 | 933 / 2878 |

**The test — one-session move, percent.** Mean of per-session differences (valid arm minus group) [90% interval]; sessions paired.

| Comparison | Development | Confirmation | Whole window | Sessions (whole) | n event / n group (whole) |
|---|---|---|---|---|---|
| Event vs G2 (headline) | no clear difference: -0.05 [-0.22, +0.12] | no clear difference: -0.28 [-0.62, +0.05] | no clear difference: -0.12 [-0.29, +0.04] | 118 | 949 / 2931 |
| Event vs G1 | no clear difference: -0.09 [-0.24, +0.06] | no clear difference: -0.28 [-0.58, +0.01] | worse: -0.15 [-0.29, -0.02] | 118 | 949 / 22948 |
| Event vs G3 | no clear difference · small: -0.60 [-1.46, +0.24] | no clear difference · small: -1.17 [-2.87, +0.45] | worse · small: -0.79 [-1.54, -0.02] | 21 | 168 / 34 |
| Every valid day vs G2 | no clear difference: +0.04 [-0.10, +0.16] | no clear difference: -0.03 [-0.25, +0.19] | no clear difference: +0.01 [-0.10, +0.13] | 119 | 2227 / 2951 |
| Every valid day vs G1 | no clear difference: -0.01 [-0.11, +0.08] | no clear difference: -0.03 [-0.22, +0.16] | no clear difference: -0.02 [-0.10, +0.08] | 119 | 2227 / 23144 |
| Every valid day vs G3 | no clear difference · small: -0.47 [-1.37, +0.41] | no clear difference · small: -0.53 [-1.84, +0.76] | no clear difference · small: -0.49 [-1.17, +0.23] | 21 | 417 / 34 |
| Event vs G2, no entry filter | no clear difference: -0.05 [-0.22, +0.12] | no clear difference: -0.29 [-0.63, +0.06] | no clear difference: -0.13 [-0.29, +0.03] | 118 | 973 / 4782 |
| Event vs G1, no entry filter | no clear difference: -0.11 [-0.26, +0.04] | worse: -0.32 [-0.63, -0.01] | worse: -0.18 [-0.32, -0.04] | 118 | 973 / 26636 |
| Event vs G3, no entry filter | no clear difference: -0.08 [-0.50, +0.34] | no clear difference · small: -0.25 [-0.95, +0.50] | no clear difference: -0.13 [-0.51, +0.24] | 80 | 706 / 260 |
| Event vs G2, dividend steps dropped | no clear difference: -0.05 [-0.23, +0.12] | no clear difference: -0.28 [-0.62, +0.05] | no clear difference: -0.13 [-0.29, +0.04] | 118 | 933 / 2878 |

**Splits** (units; "small" where an arm has fewer than 100 observations; "sessions" = the paired sessions behind each table's own comparison, dev / conf / whole; archetype rules use today's scores, approximate).


*three sessions against G2*

| Split | Events entered (dev / conf / whole) | Sessions | Development | Confirmation | Whole window |
|---|---|---|---|---|---|
| SPY regime: spy_uptrend | 397 / 63 / 460 | 42 / 13 / 55 | better: +0.164 [+0.015, +0.296] | no clear difference · small: +0.145 [-0.234, +0.530] | better: +0.160 [+0.014, +0.299] |
| SPY regime: spy_no_trend | 344 / 79 / 423 | 37 / 18 / 55 | better: +0.195 [+0.031, +0.360] | no clear difference · small: +0.057 [-0.244, +0.348] | better: +0.150 [+0.000, +0.293] |
| SPY regime: spy_downtrend | 0 / 66 / 66 | 0 / 6 / 6 | no data | no clear difference · small: -0.014 [-0.208, +0.167] | no clear difference · small: -0.014 [-0.208, +0.167] |
| volatility third: vol_low | 269 / 48 / 317 | 75 / 17 / 92 | better: +0.259 [+0.047, +0.494] | no clear difference · small: +0.344 [-0.020, +0.697] | better: +0.275 [+0.092, +0.475] |
| volatility third: vol_mid | 258 / 76 / 334 | 74 / 28 / 102 | better: +0.234 [+0.045, +0.427] | no clear difference · small: +0.117 [-0.204, +0.447] | better: +0.202 [+0.033, +0.362] |
| volatility third: vol_high | 214 / 84 / 298 | 72 / 31 / 103 | no clear difference: -0.001 [-0.174, +0.170] | no clear difference · small: +0.053 [-0.198, +0.310] | no clear difference: +0.016 [-0.126, +0.155] |
| archetype rule: speculator | 127 / 53 / 180 | 58 / 24 / 82 | no clear difference: -0.070 [-0.310, +0.155] | no clear difference · small: +0.176 [-0.197, +0.566] | no clear difference: +0.002 [-0.202, +0.205] |
| archetype rule: preserver | 48 / 13 / 61 | 27 / 7 / 34 | no clear difference · small: -0.094 [-0.437, +0.235] | no clear difference · small: +0.720 [-0.338, +1.794] | no clear difference · small: +0.073 [-0.269, +0.458] |
| archetype rule: fi40 | 638 / 170 / 808 | 79 / 35 / 114 | better: +0.237 [+0.118, +0.354] | no clear difference: +0.115 [-0.132, +0.377] | better: +0.199 [+0.088, +0.312] |
| archetype rule: fi70 | 4 / 2 / 6 | 0 / 0 / 0 | no data | no data | no data |

*one session against G2*

| Split | Events entered (dev / conf / whole) | Sessions | Development | Confirmation | Whole window |
|---|---|---|---|---|---|
| SPY regime: spy_uptrend | 397 / 63 / 460 | 42 / 13 / 55 | no clear difference: +0.004 [-0.076, +0.079] | no clear difference · small: -0.093 [-0.320, +0.124] | no clear difference: -0.019 [-0.101, +0.054] |
| SPY regime: spy_no_trend | 344 / 79 / 423 | 37 / 18 / 55 | no clear difference: -0.031 [-0.116, +0.056] | no clear difference · small: -0.071 [-0.232, +0.091] | no clear difference: -0.044 [-0.120, +0.036] |
| SPY regime: spy_downtrend | 0 / 66 / 66 | 0 / 8 / 8 | no data | no clear difference · small: -0.046 [-0.161, +0.069] | no clear difference · small: -0.046 [-0.161, +0.069] |
| volatility third: vol_low | 269 / 48 / 317 | 75 / 19 / 94 | no clear difference: -0.046 [-0.151, +0.060] | no clear difference · small: -0.000 [-0.166, +0.158] | no clear difference: -0.037 [-0.125, +0.051] |
| volatility third: vol_mid | 258 / 76 / 334 | 74 / 30 / 104 | no clear difference: +0.008 [-0.085, +0.102] | no clear difference · small: +0.002 [-0.189, +0.179] | no clear difference: +0.006 [-0.079, +0.089] |
| volatility third: vol_high | 214 / 84 / 298 | 72 / 33 / 105 | no clear difference: -0.045 [-0.130, +0.038] | no clear difference · small: -0.093 [-0.217, +0.031] | no clear difference: -0.060 [-0.128, +0.011] |
| archetype rule: speculator | 127 / 53 / 180 | 58 / 25 / 83 | no clear difference: -0.031 [-0.152, +0.085] | no clear difference · small: +0.087 [-0.132, +0.321] | no clear difference: +0.005 [-0.103, +0.110] |
| archetype rule: preserver | 48 / 13 / 61 | 27 / 8 / 35 | no clear difference · small: -0.013 [-0.243, +0.221] | no clear difference · small: -0.156 [-0.467, +0.129] | no clear difference · small: -0.046 [-0.252, +0.146] |
| archetype rule: fi40 | 638 / 170 / 808 | 79 / 37 / 116 | no clear difference: +0.002 [-0.064, +0.065] | no clear difference: -0.079 [-0.216, +0.046] | no clear difference: -0.024 [-0.089, +0.038] |
| archetype rule: fi70 | 4 / 2 / 6 | 0 / 0 / 0 | no data | no data | no data |

*three sessions against G1*

| Split | Events entered (dev / conf / whole) | Sessions | Development | Confirmation | Whole window |
|---|---|---|---|---|---|
| SPY regime: spy_uptrend | 397 / 63 / 460 | 42 / 13 / 55 | no clear difference: +0.108 [-0.007, +0.217] | no clear difference · small: -0.206 [-0.561, +0.104] | no clear difference: +0.034 [-0.092, +0.153] |
| SPY regime: spy_no_trend | 344 / 79 / 423 | 37 / 18 / 55 | no clear difference: -0.031 [-0.176, +0.123] | no clear difference · small: -0.079 [-0.291, +0.133] | no clear difference: -0.047 [-0.170, +0.077] |
| SPY regime: spy_downtrend | 0 / 66 / 66 | 0 / 6 / 6 | no data | no clear difference · small: +0.012 [-0.139, +0.141] | no clear difference · small: +0.012 [-0.139, +0.141] |
| volatility third: vol_low | 269 / 48 / 317 | 75 / 22 / 97 | no clear difference: +0.114 [-0.033, +0.268] | no clear difference · small: +0.222 [-0.028, +0.483] | better: +0.139 [+0.010, +0.272] |
| volatility third: vol_mid | 258 / 76 / 334 | 75 / 31 / 106 | no clear difference: +0.036 [-0.114, +0.182] | no clear difference · small: -0.028 [-0.298, +0.210] | no clear difference: +0.017 [-0.111, +0.146] |
| volatility third: vol_high | 214 / 84 / 298 | 72 / 31 / 103 | no clear difference: -0.055 [-0.206, +0.094] | worse · small: -0.247 [-0.497, -0.016] | no clear difference: -0.113 [-0.240, +0.019] |
| archetype rule: speculator | 127 / 53 / 180 | 59 / 25 / 84 | no clear difference: -0.103 [-0.288, +0.088] | no clear difference · small: -0.105 [-0.437, +0.205] | no clear difference: -0.104 [-0.268, +0.056] |
| archetype rule: preserver | 48 / 13 / 61 | 36 / 10 / 46 | no clear difference · small: -0.156 [-0.432, +0.137] | no clear difference · small: +0.146 [-0.413, +0.782] | no clear difference · small: -0.091 [-0.343, +0.187] |
| archetype rule: fi40 | 638 / 170 / 808 | 79 / 35 / 114 | no clear difference: +0.087 [-0.015, +0.188] | no clear difference: -0.105 [-0.318, +0.110] | no clear difference: +0.028 [-0.072, +0.129] |
| archetype rule: fi70 | 4 / 2 / 6 | 4 / 2 / 6 | too few sessions (4): +0.007 | too few sessions (2): -0.524 | no clear difference · small: -0.170 [-0.744, +0.326] |

*one session against G1*

| Split | Events entered (dev / conf / whole) | Sessions | Development | Confirmation | Whole window |
|---|---|---|---|---|---|
| SPY regime: spy_uptrend | 397 / 63 / 460 | 42 / 13 / 55 | no clear difference: -0.005 [-0.071, +0.059] | no clear difference · small: -0.113 [-0.347, +0.107] | no clear difference: -0.031 [-0.104, +0.042] |
| SPY regime: spy_no_trend | 344 / 79 / 423 | 37 / 18 / 55 | no clear difference: -0.057 [-0.129, +0.022] | no clear difference · small: -0.081 [-0.197, +0.037] | no clear difference: -0.064 [-0.127, +0.000] |
| SPY regime: spy_downtrend | 0 / 66 / 66 | 0 / 8 / 8 | no data | no clear difference · small: -0.036 [-0.102, +0.027] | no clear difference · small: -0.036 [-0.102, +0.027] |
| volatility third: vol_low | 269 / 48 / 317 | 75 / 24 / 99 | no clear difference: -0.042 [-0.122, +0.034] | no clear difference · small: +0.008 [-0.113, +0.126] | no clear difference: -0.030 [-0.094, +0.035] |
| volatility third: vol_mid | 258 / 76 / 334 | 75 / 33 / 108 | no clear difference: -0.020 [-0.089, +0.049] | no clear difference · small: +0.036 [-0.109, +0.187] | no clear difference: -0.003 [-0.071, +0.069] |
| volatility third: vol_high | 214 / 84 / 298 | 72 / 33 / 105 | no clear difference: -0.037 [-0.110, +0.039] | worse · small: -0.191 [-0.335, -0.065] | worse: -0.085 [-0.148, -0.019] |
| archetype rule: speculator | 127 / 53 / 180 | 59 / 26 / 85 | no clear difference: -0.010 [-0.106, +0.093] | no clear difference · small: -0.116 [-0.316, +0.094] | no clear difference: -0.042 [-0.131, +0.050] |
| archetype rule: preserver | 48 / 13 / 61 | 36 / 11 / 47 | no clear difference · small: -0.103 [-0.256, +0.056] | no clear difference · small: +0.073 [-0.196, +0.379] | no clear difference · small: -0.061 [-0.204, +0.077] |
| archetype rule: fi40 | 638 / 170 / 808 | 79 / 37 / 116 | no clear difference: -0.017 [-0.073, +0.041] | no clear difference: -0.104 [-0.226, +0.011] | no clear difference: -0.045 [-0.101, +0.012] |
| archetype rule: fi70 | 4 / 2 / 6 | 4 / 2 / 6 | too few sessions (4): +0.028 | too few sessions (2): -0.436 | no clear difference · small: -0.127 [-0.386, +0.080] |

</details>

<details><summary>Part A, long window: every table</summary>

### Part A — long window (221 sessions, 2026-01-02 → 2026-11-17; development 147, confirmation 74)

**Development — measurements.** Groups are measured on the sessions that have at least one event.

| Arm | Stock-days | Removed by entry | No next open | n 1-day | n 3-day | 3-day censored / split | 1-day % | 1-day units | 3-day % | 3-day units | 3-day median units | 1-day ≥+1u / ≤−1u | 3-day ≥+1u / ≤−1u | 1-day barrier up / down / neither (both same session) | 3-day barrier up / down / neither (both) | 3-day dividend steps |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Valid · pullback, first day (the event) | 1446 | 40 | 0 | 1406 | 1404 | 0 / 2 | -0.02 | -0.004 | -0.01 | -0.010 | -0.011 | 5.4% / 5.5% | 17.7% / 18.2% | 11.7% / 12.5% / 75.7% (3) | 34.3% / 37% / 28.7% (6) | 51 |
| Valid · pullback, every day (secondary) | 3475 | 113 | 0 | 3362 | 3358 | 0 / 4 | -0.02 | -0.001 | -0.01 | -0.008 | +0.001 | 6.1% / 5.3% | 18.7% / 18.6% | 12% / 11.7% / 76.3% (5) | 34.5% / 37% / 28.5% (11) | 134 |
| Event, no entry filter | 1446 | 0 | 0 | 1446 | 1444 | 0 / 2 | -0.04 | -0.009 | -0.04 | -0.019 | -0.027 | 5.4% / 5.7% | 17.8% / 18.7% | 11.6% / 13% / 75.4% (5) | 34.1% / 37.7% / 28.1% (8) | 53 |
| G1 every stock | 33023 | 5019 | 0 | 28000 | 27994 | 0 / 10 | +0.03 | +0.009 | +0.19 | +0.062 | +0.057 | 5% / 4.7% | 19.3% / 16.9% | 10.1% / 9.8% / 80.1% (28) | 35.8% / 33.2% / 31% (95) | 1113 |
| G2 uptrend, no setup | 6520 | 2960 | 0 | 3558 | 3558 | 0 / 2 | +0.04 | +0.016 | +0.12 | +0.043 | +0.054 | 5.3% / 4.4% | 19.2% / 17.3% | 10.5% / 10% / 79.5% (6) | 37.1% / 34.2% / 28.8% (21) | 169 |
| G3 extended | 485 | 435 | 0 | 49 | 49 | 0 / 1 | -0.79 | -0.292 | +0.16 | +0.045 | +0.059 | 6.1% / 22.4% | 28.6% / 26.5% | 12.2% / 38.8% / 49% (1) | 30.6% / 61.2% / 8.2% (1) | 2 |
| G1, no entry filter | 33023 | 0 | 0 | 33018 | 33008 | 0 / 15 | +0.02 | +0.007 | +0.19 | +0.061 | +0.054 | 5.2% / 4.9% | 19.6% / 17.1% | 10.4% / 10.4% / 79.2% (47) | 35.9% / 34% / 30.1% (126) | 1275 |
| G2, no entry filter | 6520 | 0 | 0 | 6518 | 6515 | 0 / 5 | +0.02 | +0.006 | +0.16 | +0.050 | +0.045 | 5.4% / 4.8% | 19.8% / 17.4% | 10.7% / 11.1% / 78.2% (14) | 36.6% / 35.7% / 27.6% (38) | 284 |
| G3, no entry filter | 485 | 0 | 0 | 484 | 483 | 0 / 2 | +0.01 | -0.005 | +0.22 | +0.071 | +0.059 | 9.1% / 8.3% | 21.3% / 17.8% | 16.5% / 16.5% / 66.9% (1) | 37.3% / 42.7% / 20.1% (2) | 7 |

**Confirmation — measurements.** Groups are measured on the sessions that have at least one event.

| Arm | Stock-days | Removed by entry | No next open | n 1-day | n 3-day | 3-day censored / split | 1-day % | 1-day units | 3-day % | 3-day units | 3-day median units | 1-day ≥+1u / ≤−1u | 3-day ≥+1u / ≤−1u | 1-day barrier up / down / neither (both same session) | 3-day barrier up / down / neither (both) | 3-day dividend steps |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Valid · pullback, first day (the event) | 502 | 8 | 7 | 487 | 471 | 16 / 0 | -0.10 | -0.037 | -0.01 | +0.015 | -0.041 | 3.9% / 5.3% | 20% / 15.3% | 10.1% / 12.1% / 77.8% (1) | 33.5% / 31% / 35.5% (2) | 18 |
| Valid · pullback, every day (secondary) | 1230 | 21 | 12 | 1197 | 1160 | 37 / 0 | -0.03 | -0.012 | -0.05 | -0.002 | -0.017 | 3.3% / 4.7% | 17.7% / 15.9% | 9.3% / 9.9% / 80.8% (1) | 33.4% / 31% / 35.5% (3) | 39 |
| Event, no entry filter | 502 | 0 | 7 | 495 | 479 | 16 / 0 | -0.12 | -0.048 | -0.00 | +0.011 | -0.041 | 3.8% / 5.9% | 20% / 15.4% | 10.1% / 12.5% / 77.4% (1) | 33.4% / 31.1% / 35.5% (2) | 18 |
| G1 every stock | 16755 | 2431 | 227 | 14096 | 13680 | 414 / 3 | -0.05 | -0.022 | -0.04 | -0.015 | -0.039 | 3.8% / 4.4% | 17.6% / 17.4% | 8.3% / 9.1% / 82.6% (21) | 32.6% / 33.1% / 34.4% (52) | 599 |
| G2 uptrend, no setup | 2945 | 1183 | 57 | 1705 | 1591 | 114 / 0 | +0.01 | -0.004 | -0.10 | -0.046 | -0.018 | 3.9% / 4.4% | 17.7% / 18.9% | 7.6% / 7.7% / 84.8% (2) | 33.8% / 31.6% / 34.6% (7) | 98 |
| G3 extended | 147 | 126 | 1 | 20 | 20 | 0 / 0 | +1.03 | +0.308 | +0.40 | +0.106 | +0.469 | 20% / 10% | 30% / 25% | 20% / 15% / 65% (0) | 35% / 35% / 30% (0) | 1 |
| G1, no entry filter | 16755 | 0 | 227 | 16527 | 16071 | 454 / 3 | -0.06 | -0.024 | -0.05 | -0.011 | -0.035 | 4.2% / 4.8% | 17.9% / 17.6% | 8.7% / 9.9% / 81.5% (26) | 33.3% / 33.5% / 33.2% (64) | 677 |
| G2, no entry filter | 2945 | 0 | 57 | 2888 | 2743 | 145 / 0 | -0.06 | -0.023 | -0.26 | -0.093 | -0.084 | 4.3% / 5% | 16.3% / 19.2% | 8.3% / 9.4% / 82.3% (2) | 32.8% / 33.9% / 33.3% (10) | 145 |
| G3, no entry filter | 147 | 0 | 1 | 146 | 145 | 1 / 0 | -0.22 | -0.127 | -0.29 | -0.124 | -0.071 | 8.2% / 17.1% | 15.2% / 24.1% | 11% / 24.7% / 64.4% (0) | 32.4% / 45.5% / 22.1% (0) | 7 |

**Whole window — measurements.** Groups are measured on the sessions that have at least one event.

| Arm | Stock-days | Removed by entry | No next open | n 1-day | n 3-day | 3-day censored / split | 1-day % | 1-day units | 3-day % | 3-day units | 3-day median units | 1-day ≥+1u / ≤−1u | 3-day ≥+1u / ≤−1u | 1-day barrier up / down / neither (both same session) | 3-day barrier up / down / neither (both) | 3-day dividend steps |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Valid · pullback, first day (the event) | 1948 | 48 | 7 | 1893 | 1875 | 16 / 2 | -0.04 | -0.012 | -0.01 | -0.004 | -0.023 | 5% / 5.5% | 18.3% / 17.5% | 11.3% / 12.4% / 76.3% (4) | 34.1% / 35.5% / 30.4% (8) | 69 |
| Valid · pullback, every day (secondary) | 4705 | 134 | 12 | 4559 | 4518 | 37 / 4 | -0.02 | -0.003 | -0.02 | -0.006 | -0.000 | 5.4% / 5.1% | 18.4% / 17.9% | 11.3% / 11.2% / 77.5% (6) | 34.3% / 35.5% / 30.3% (14) | 173 |
| Event, no entry filter | 1948 | 0 | 7 | 1941 | 1923 | 16 / 2 | -0.06 | -0.019 | -0.03 | -0.012 | -0.034 | 5% / 5.7% | 18.4% / 17.9% | 11.2% / 12.9% / 75.9% (6) | 34% / 36.1% / 30% (10) | 71 |
| G1 every stock | 49778 | 7450 | 227 | 42096 | 41674 | 414 / 13 | -0.00 | -0.002 | +0.11 | +0.037 | +0.027 | 4.6% / 4.6% | 18.8% / 17.1% | 9.5% / 9.6% / 80.9% (49) | 34.7% / 33.2% / 32.1% (147) | 1712 |
| G2 uptrend, no setup | 9465 | 4143 | 57 | 5263 | 5149 | 114 / 2 | +0.03 | +0.010 | +0.05 | +0.015 | +0.029 | 4.8% / 4.4% | 18.8% / 17.8% | 9.6% / 9.2% / 81.2% (8) | 36% / 33.4% / 30.6% (28) | 267 |
| G3 extended | 632 | 561 | 1 | 69 | 69 | 0 / 1 | -0.26 | -0.118 | +0.23 | +0.063 | +0.064 | 10.1% / 18.8% | 29% / 26.1% | 14.5% / 31.9% / 53.6% (1) | 31.9% / 53.6% / 14.5% (1) | 3 |
| G1, no entry filter | 49778 | 0 | 227 | 49545 | 49079 | 454 / 18 | -0.00 | -0.003 | +0.11 | +0.038 | +0.024 | 4.9% / 4.8% | 19% / 17.3% | 9.8% / 10.2% / 80% (73) | 35% / 33.8% / 31.1% (190) | 1952 |
| G2, no entry filter | 9465 | 0 | 57 | 9406 | 9258 | 145 / 5 | -0.00 | -0.003 | +0.03 | +0.007 | +0.001 | 5% / 4.8% | 18.8% / 18% | 10% / 10.6% / 79.5% (16) | 35.5% / 35.2% / 29.3% (48) | 429 |
| G3, no entry filter | 632 | 0 | 1 | 630 | 628 | 1 / 2 | -0.04 | -0.033 | +0.10 | +0.026 | +0.015 | 8.9% / 10.3% | 19.9% / 19.3% | 15.2% / 18.4% / 66.3% (1) | 36.1% / 43.3% / 20.5% (2) | 14 |

**The test — three-session move, units.** Mean of per-session differences (valid arm minus group) [90% interval]; sessions paired.

| Comparison | Development | Confirmation | Whole window | Sessions (whole) | n event / n group (whole) |
|---|---|---|---|---|---|
| Event vs G2 (headline) | no clear difference: -0.030 [-0.115, +0.054] | better: +0.145 [+0.013, +0.270] | no clear difference: +0.027 [-0.042, +0.095] | 217 | 1875 / 5149 |
| Event vs G1 | no clear difference: -0.060 [-0.131, +0.015] | no clear difference: +0.022 [-0.086, +0.121] | no clear difference: -0.033 [-0.091, +0.025] | 217 | 1875 / 41674 |
| Event vs G3 | no clear difference · small: -0.146 [-0.512, +0.208] | no clear difference · small: -0.033 [-1.145, +0.962] | no clear difference · small: -0.115 [-0.515, +0.262] | 47 | 441 / 69 |
| Every valid day vs G2 | no clear difference: -0.026 [-0.092, +0.041] | better: +0.152 [+0.032, +0.270] | no clear difference: +0.032 [-0.026, +0.091] | 218 | 4518 / 5170 |
| Every valid day vs G1 | worse: -0.054 [-0.108, -0.002] | no clear difference: +0.029 [-0.054, +0.109] | no clear difference: -0.027 [-0.070, +0.016] | 218 | 4518 / 41874 |
| Every valid day vs G3 | no clear difference · small: -0.099 [-0.464, +0.254] | no clear difference · small: +0.046 [-0.904, +0.964] | no clear difference · small: -0.059 [-0.425, +0.301] | 47 | 1089 / 69 |
| Event vs G2, no entry filter | no clear difference: -0.060 [-0.141, +0.023] | better: +0.147 [+0.035, +0.253] | no clear difference: +0.008 [-0.058, +0.073] | 217 | 1923 / 9258 |
| Event vs G1, no entry filter | no clear difference: -0.067 [-0.137, +0.006] | no clear difference: +0.034 [-0.073, +0.133] | no clear difference: -0.034 [-0.092, +0.024] | 217 | 1923 / 49079 |
| Event vs G3, no entry filter | no clear difference: -0.085 [-0.260, +0.083] | no clear difference: +0.117 [-0.176, +0.385] | no clear difference: -0.029 [-0.174, +0.115] | 155 | 1460 / 628 |
| Event vs G2, dividend steps dropped | no clear difference: -0.025 [-0.113, +0.060] | better: +0.142 [+0.015, +0.275] | no clear difference: +0.029 [-0.041, +0.103] | 216 | 1806 / 4842 |

**The test — three-session move, percent.** Mean of per-session differences (valid arm minus group) [90% interval]; sessions paired.

| Comparison | Development | Confirmation | Whole window | Sessions (whole) | n event / n group (whole) |
|---|---|---|---|---|---|
| Event vs G2 (headline) | no clear difference: -0.11 [-0.40, +0.17] | no clear difference: +0.29 [-0.16, +0.70] | no clear difference: +0.02 [-0.21, +0.25] | 217 | 1875 / 5149 |
| Event vs G1 | no clear difference: -0.17 [-0.40, +0.07] | no clear difference: -0.03 [-0.41, +0.33] | no clear difference: -0.12 [-0.31, +0.08] | 217 | 1875 / 41674 |
| Event vs G3 | no clear difference · small: -0.45 [-1.43, +0.55] | no clear difference · small: -0.48 [-3.45, +2.14] | no clear difference · small: -0.46 [-1.54, +0.54] | 47 | 441 / 69 |
| Every valid day vs G2 | no clear difference: -0.09 [-0.31, +0.13] | better: +0.38 [+0.01, +0.73] | no clear difference: +0.06 [-0.13, +0.25] | 218 | 4518 / 5170 |
| Every valid day vs G1 | no clear difference: -0.14 [-0.30, +0.03] | no clear difference: +0.06 [-0.20, +0.33] | no clear difference: -0.07 [-0.21, +0.07] | 218 | 4518 / 41874 |
| Every valid day vs G3 | no clear difference · small: -0.19 [-1.08, +0.67] | no clear difference · small: -0.09 [-2.30, +2.11] | no clear difference · small: -0.16 [-1.04, +0.71] | 47 | 1089 / 69 |
| Event vs G2, no entry filter | no clear difference: -0.23 [-0.51, +0.04] | no clear difference: +0.33 [-0.04, +0.70] | no clear difference: -0.05 [-0.27, +0.18] | 217 | 1923 / 9258 |
| Event vs G1, no entry filter | no clear difference: -0.20 [-0.44, +0.03] | no clear difference: +0.05 [-0.33, +0.41] | no clear difference: -0.12 [-0.31, +0.08] | 217 | 1923 / 49079 |
| Event vs G3, no entry filter | no clear difference: -0.38 [-0.95, +0.17] | no clear difference: +0.21 [-0.68, +1.09] | no clear difference: -0.22 [-0.70, +0.26] | 155 | 1460 / 628 |
| Event vs G2, dividend steps dropped | no clear difference: -0.11 [-0.40, +0.18] | no clear difference: +0.27 [-0.15, +0.72] | no clear difference: +0.01 [-0.22, +0.25] | 216 | 1806 / 4842 |

**The test — one-session move, units.** Mean of per-session differences (valid arm minus group) [90% interval]; sessions paired.

| Comparison | Development | Confirmation | Whole window | Sessions (whole) | n event / n group (whole) |
|---|---|---|---|---|---|
| Event vs G2 (headline) | no clear difference: +0.004 [-0.038, +0.047] | no clear difference: -0.037 [-0.108, +0.030] | no clear difference: -0.010 [-0.050, +0.030] | 219 | 1893 / 5263 |
| Event vs G1 | no clear difference: +0.005 [-0.032, +0.044] | no clear difference: -0.039 [-0.102, +0.019] | no clear difference: -0.009 [-0.041, +0.025] | 219 | 1893 / 42096 |
| Event vs G3 | better · small: +0.287 [+0.084, +0.489] | no clear difference · small: -0.289 [-0.750, +0.181] | no clear difference · small: +0.128 [-0.077, +0.329] | 47 | 441 / 69 |
| Every valid day vs G2 | no clear difference: -0.011 [-0.046, +0.027] | no clear difference: +0.013 [-0.035, +0.058] | no clear difference: -0.003 [-0.032, +0.028] | 220 | 4559 / 5284 |
| Every valid day vs G1 | no clear difference: -0.008 [-0.036, +0.021] | no clear difference: +0.011 [-0.030, +0.049] | no clear difference: -0.002 [-0.024, +0.020] | 220 | 4559 / 42296 |
| Every valid day vs G3 | better · small: +0.284 [+0.088, +0.483] | no clear difference · small: -0.157 [-0.569, +0.279] | no clear difference · small: +0.162 [-0.030, +0.353] | 47 | 1091 / 69 |
| Event vs G2, no entry filter | no clear difference: -0.005 [-0.043, +0.036] | no clear difference: -0.034 [-0.105, +0.034] | no clear difference: -0.015 [-0.053, +0.021] | 219 | 1941 / 9406 |
| Event vs G1, no entry filter | no clear difference: -0.001 [-0.037, +0.037] | no clear difference: -0.043 [-0.111, +0.018] | no clear difference: -0.015 [-0.048, +0.019] | 219 | 1941 / 49545 |
| Event vs G3, no entry filter | no clear difference: -0.004 [-0.091, +0.087] | no clear difference: -0.036 [-0.184, +0.111] | no clear difference: -0.013 [-0.087, +0.067] | 157 | 1472 / 630 |
| Event vs G2, dividend steps dropped | no clear difference: +0.008 [-0.036, +0.052] | no clear difference: -0.040 [-0.112, +0.027] | no clear difference: -0.008 [-0.048, +0.031] | 219 | 1868 / 5164 |

**The test — one-session move, percent.** Mean of per-session differences (valid arm minus group) [90% interval]; sessions paired.

| Comparison | Development | Confirmation | Whole window | Sessions (whole) | n event / n group (whole) |
|---|---|---|---|---|---|
| Event vs G2 (headline) | no clear difference: -0.00 [-0.14, +0.15] | no clear difference: -0.15 [-0.38, +0.06] | no clear difference: -0.05 [-0.18, +0.08] | 219 | 1893 / 5263 |
| Event vs G1 | no clear difference: +0.01 [-0.11, +0.16] | no clear difference: -0.14 [-0.34, +0.04] | no clear difference: -0.04 [-0.15, +0.07] | 219 | 1893 / 42096 |
| Event vs G3 | better · small: +0.72 [+0.12, +1.38] | no clear difference · small: -1.08 [-2.22, +0.01] | no clear difference · small: +0.22 [-0.36, +0.81] | 47 | 441 / 69 |
| Every valid day vs G2 | no clear difference: -0.05 [-0.16, +0.06] | no clear difference: +0.03 [-0.12, +0.17] | no clear difference: -0.02 [-0.11, +0.07] | 220 | 4559 / 5284 |
| Every valid day vs G1 | no clear difference: -0.03 [-0.12, +0.06] | no clear difference: +0.04 [-0.09, +0.16] | no clear difference: -0.01 [-0.08, +0.06] | 220 | 4559 / 42296 |
| Every valid day vs G3 | better · small: +0.75 [+0.17, +1.38] | no clear difference · small: -0.53 [-1.50, +0.47] | no clear difference · small: +0.40 [-0.14, +0.91] | 47 | 1091 / 69 |
| Event vs G2, no entry filter | no clear difference: -0.04 [-0.17, +0.09] | no clear difference: -0.15 [-0.38, +0.07] | no clear difference: -0.08 [-0.20, +0.04] | 219 | 1941 / 9406 |
| Event vs G1, no entry filter | no clear difference: -0.01 [-0.14, +0.13] | no clear difference: -0.16 [-0.37, +0.03] | no clear difference: -0.06 [-0.17, +0.05] | 219 | 1941 / 49545 |
| Event vs G3, no entry filter | no clear difference: -0.06 [-0.39, +0.28] | no clear difference: -0.24 [-0.73, +0.26] | no clear difference: -0.11 [-0.38, +0.16] | 157 | 1472 / 630 |
| Event vs G2, dividend steps dropped | no clear difference: +0.01 [-0.14, +0.16] | no clear difference: -0.16 [-0.39, +0.05] | no clear difference: -0.05 [-0.18, +0.08] | 219 | 1868 / 5164 |

**Splits** (units; "small" where an arm has fewer than 100 observations; "sessions" = the paired sessions behind each table's own comparison, dev / conf / whole; archetype rules use today's scores, approximate).


*three sessions against G2*

| Split | Events entered (dev / conf / whole) | Sessions | Development | Confirmation | Whole window |
|---|---|---|---|---|---|
| SPY regime: spy_uptrend | 745 / 228 / 973 | 73 / 33 / 106 | no clear difference: -0.022 [-0.134, +0.091] | better: +0.192 [+0.015, +0.379] | no clear difference: +0.045 [-0.056, +0.140] |
| SPY regime: spy_no_trend | 506 / 193 / 699 | 54 / 32 / 86 | no clear difference: +0.011 [-0.116, +0.141] | no clear difference: +0.125 [-0.085, +0.344] | no clear difference: +0.053 [-0.058, +0.164] |
| SPY regime: spy_downtrend | 155 / 66 / 221 | 19 / 6 / 25 | no clear difference: -0.174 [-0.506, +0.135] | no clear difference · small: -0.014 [-0.208, +0.167] | no clear difference: -0.136 [-0.378, +0.111] |
| volatility third: vol_low | 540 / 135 / 675 | 134 / 49 / 183 | no clear difference: +0.053 [-0.086, +0.204] | better: +0.412 [+0.181, +0.648] | better: +0.149 [+0.020, +0.273] |
| volatility third: vol_mid | 471 / 181 / 652 | 123 / 58 / 181 | no clear difference: +0.043 [-0.107, +0.180] | no clear difference: +0.202 [-0.007, +0.399] | no clear difference: +0.094 [-0.021, +0.214] |
| volatility third: vol_high | 395 / 171 / 566 | 129 / 62 / 191 | no clear difference: -0.087 [-0.231, +0.053] | no clear difference: +0.064 [-0.118, +0.245] | no clear difference: -0.038 [-0.150, +0.074] |
| archetype rule: speculator | 244 / 99 / 343 | 103 / 49 / 152 | no clear difference: -0.173 [-0.383, +0.029] | no clear difference · small: +0.050 [-0.244, +0.346] | no clear difference: -0.101 [-0.273, +0.065] |
| archetype rule: preserver | 103 / 33 / 136 | 52 / 19 / 71 | no clear difference · small: +0.180 [-0.116, +0.505] | no clear difference · small: +0.493 [-0.067, +1.047] | better · small: +0.264 [+0.009, +0.537] |
| archetype rule: fi40 | 1222 / 408 / 1630 | 146 / 69 / 215 | no clear difference: -0.016 [-0.109, +0.073] | better: +0.221 [+0.070, +0.372] | no clear difference: +0.060 [-0.021, +0.141] |
| archetype rule: fi70 | 12 / 5 / 17 | 1 / 0 / 1 | too few sessions (1): -0.284 | no data | too few sessions (1): -0.284 |

*one session against G2*

| Split | Events entered (dev / conf / whole) | Sessions | Development | Confirmation | Whole window |
|---|---|---|---|---|---|
| SPY regime: spy_uptrend | 745 / 228 / 973 | 73 / 33 / 106 | no clear difference: +0.011 [-0.048, +0.066] | no clear difference: -0.040 [-0.151, +0.067] | no clear difference: -0.005 [-0.058, +0.045] |
| SPY regime: spy_no_trend | 506 / 193 / 699 | 54 / 32 / 86 | no clear difference: -0.018 [-0.091, +0.060] | no clear difference: -0.032 [-0.147, +0.075] | no clear difference: -0.023 [-0.087, +0.040] |
| SPY regime: spy_downtrend | 155 / 66 / 221 | 19 / 8 / 27 | no clear difference: +0.039 [-0.093, +0.179] | no clear difference · small: -0.046 [-0.161, +0.069] | no clear difference: +0.014 [-0.087, +0.121] |
| volatility third: vol_low | 540 / 135 / 675 | 134 / 51 / 185 | no clear difference: -0.033 [-0.102, +0.037] | no clear difference: -0.024 [-0.140, +0.098] | no clear difference: -0.031 [-0.089, +0.031] |
| volatility third: vol_mid | 471 / 181 / 652 | 123 / 60 / 183 | no clear difference: +0.032 [-0.030, +0.091] | no clear difference: +0.044 [-0.077, +0.164] | no clear difference: +0.036 [-0.023, +0.090] |
| volatility third: vol_high | 395 / 171 / 566 | 129 / 64 / 193 | no clear difference: -0.036 [-0.108, +0.033] | no clear difference: -0.057 [-0.154, +0.034] | no clear difference: -0.043 [-0.097, +0.015] |
| archetype rule: speculator | 244 / 99 / 343 | 103 / 50 / 153 | no clear difference: +0.027 [-0.067, +0.122] | no clear difference · small: +0.018 [-0.135, +0.174] | no clear difference: +0.024 [-0.060, +0.103] |
| archetype rule: preserver | 103 / 33 / 136 | 52 / 20 / 72 | no clear difference · small: +0.023 [-0.136, +0.170] | no clear difference · small: +0.101 [-0.098, +0.302] | no clear difference · small: +0.045 [-0.081, +0.166] |
| archetype rule: fi40 | 1222 / 408 / 1630 | 146 / 71 / 217 | no clear difference: +0.011 [-0.035, +0.058] | no clear difference: -0.028 [-0.117, +0.054] | no clear difference: -0.002 [-0.043, +0.041] |
| archetype rule: fi70 | 12 / 5 / 17 | 1 / 0 / 1 | too few sessions (1): +0.580 | no data | too few sessions (1): +0.580 |

*three sessions against G1*

| Split | Events entered (dev / conf / whole) | Sessions | Development | Confirmation | Whole window |
|---|---|---|---|---|---|
| SPY regime: spy_uptrend | 745 / 228 / 973 | 73 / 33 / 106 | no clear difference: -0.006 [-0.098, +0.088] | no clear difference: +0.052 [-0.126, +0.206] | no clear difference: +0.012 [-0.076, +0.094] |
| SPY regime: spy_no_trend | 506 / 193 / 699 | 54 / 32 / 86 | worse: -0.135 [-0.267, -0.003] | no clear difference: -0.008 [-0.155, +0.149] | no clear difference: -0.088 [-0.188, +0.016] |
| SPY regime: spy_downtrend | 155 / 66 / 221 | 19 / 6 / 25 | no clear difference: -0.052 [-0.213, +0.110] | no clear difference · small: +0.012 [-0.139, +0.141] | no clear difference: -0.037 [-0.172, +0.084] |
| volatility third: vol_low | 540 / 135 / 675 | 139 / 54 / 193 | no clear difference: -0.080 [-0.175, +0.019] | better: +0.338 [+0.146, +0.519] | no clear difference: +0.037 [-0.054, +0.124] |
| volatility third: vol_mid | 471 / 181 / 652 | 127 / 62 / 189 | no clear difference: -0.002 [-0.127, +0.126] | no clear difference: +0.051 [-0.108, +0.197] | no clear difference: +0.015 [-0.083, +0.113] |
| volatility third: vol_high | 395 / 171 / 566 | 131 / 62 / 193 | no clear difference: -0.049 [-0.160, +0.058] | no clear difference: -0.086 [-0.242, +0.068] | no clear difference: -0.061 [-0.157, +0.030] |
| archetype rule: speculator | 244 / 99 / 343 | 110 / 50 / 160 | no clear difference: -0.053 [-0.201, +0.097] | no clear difference · small: -0.087 [-0.320, +0.143] | no clear difference: -0.063 [-0.185, +0.064] |
| archetype rule: preserver | 103 / 33 / 136 | 67 / 25 / 92 | no clear difference: -0.015 [-0.230, +0.224] | no clear difference · small: +0.099 [-0.204, +0.403] | no clear difference: +0.016 [-0.165, +0.198] |
| archetype rule: fi40 | 1222 / 408 / 1630 | 146 / 69 / 215 | no clear difference: -0.043 [-0.123, +0.039] | no clear difference: +0.080 [-0.049, +0.209] | no clear difference: -0.004 [-0.073, +0.065] |
| archetype rule: fi70 | 12 / 5 / 17 | 12 / 5 / 17 | no clear difference · small: -0.096 [-0.466, +0.323] | no clear difference · small: -0.166 [-0.843, +0.416] | no clear difference · small: -0.117 [-0.437, +0.220] |

*one session against G1*

| Split | Events entered (dev / conf / whole) | Sessions | Development | Confirmation | Whole window |
|---|---|---|---|---|---|
| SPY regime: spy_uptrend | 745 / 228 / 973 | 73 / 33 / 106 | no clear difference: +0.023 [-0.019, +0.067] | no clear difference: -0.043 [-0.154, +0.057] | no clear difference: +0.002 [-0.046, +0.046] |
| SPY regime: spy_no_trend | 506 / 193 / 699 | 54 / 32 / 86 | no clear difference: -0.042 [-0.116, +0.035] | no clear difference: -0.034 [-0.118, +0.056] | no clear difference: -0.039 [-0.096, +0.019] |
| SPY regime: spy_downtrend | 155 / 66 / 221 | 19 / 8 / 27 | no clear difference: +0.072 [-0.016, +0.154] | no clear difference · small: -0.036 [-0.102, +0.027] | no clear difference: +0.040 [-0.024, +0.101] |
| volatility third: vol_low | 540 / 135 / 675 | 139 / 56 / 195 | no clear difference: -0.045 [-0.098, +0.006] | no clear difference: +0.016 [-0.075, +0.113] | no clear difference: -0.027 [-0.072, +0.016] |
| volatility third: vol_mid | 471 / 181 / 652 | 127 / 64 / 191 | no clear difference: +0.024 [-0.026, +0.073] | no clear difference: +0.046 [-0.052, +0.140] | no clear difference: +0.032 [-0.016, +0.075] |
| volatility third: vol_high | 395 / 171 / 566 | 131 / 64 / 195 | no clear difference: +0.006 [-0.060, +0.071] | worse: -0.107 [-0.201, -0.023] | no clear difference: -0.031 [-0.081, +0.022] |
| archetype rule: speculator | 244 / 99 / 343 | 110 / 51 / 161 | no clear difference: +0.048 [-0.035, +0.137] | no clear difference · small: -0.060 [-0.191, +0.084] | no clear difference: +0.014 [-0.060, +0.090] |
| archetype rule: preserver | 103 / 33 / 136 | 67 / 26 / 93 | no clear difference: -0.045 [-0.152, +0.063] | no clear difference · small: +0.109 [-0.027, +0.250] | no clear difference: -0.002 [-0.090, +0.087] |
| archetype rule: fi40 | 1222 / 408 / 1630 | 146 / 71 / 217 | no clear difference: +0.007 [-0.033, +0.048] | no clear difference: -0.033 [-0.111, +0.037] | no clear difference: -0.006 [-0.043, +0.031] |
| archetype rule: fi70 | 12 / 5 / 17 | 12 / 5 / 17 | no clear difference · small: -0.053 [-0.188, +0.071] | no clear difference · small: -0.173 [-0.452, +0.075] | no clear difference · small: -0.088 [-0.210, +0.028] |

</details>

### Post hoc — the long window before the short window (101 sessions, 2026-01-02 → 2026-05-28)

Added after the first results were seen. Not one of the fixed labels; the same arms, test and words.

| Comparison | 3-day units | 3-day % | 1-day units | 1-day % | n event / n group (3-day) |
|---|---|---|---|---|---|
| Event vs G1 | no clear difference: -0.069 [-0.153, +0.018] | no clear difference: -0.19 [-0.47, +0.08] | no clear difference: +0.033 [-0.012, +0.080] | no clear difference: +0.09 [-0.07, +0.27] | 935 / 18950 |
| Event vs G2 | worse: -0.108 [-0.210, -0.007] | worse: -0.36 [-0.71, -0.02] | no clear difference: +0.016 [-0.041, +0.074] | no clear difference: +0.03 [-0.16, +0.23] | 935 / 2312 |
| Event vs G3 | no clear difference · small: -0.144 [-0.620, +0.287] | no clear difference · small: -0.55 [-1.76, +0.63] | better · small: +0.394 [+0.154, +0.634] | better · small: +1.04 [+0.29, +1.77] | 273 / 35 |

Means, three sessions (units / %): event +0.009 / +0.07 (n 935); G1 +0.046 / +0.16; G2 +0.104 / +0.31.
### Post review — the overlap sensitivity

Adjacent sessions' three-session windows overlap, so resampling whole sessions can understate the interval. This re-draws the same per-session differences in blocks of 3 and 5 consecutive sessions (a circular block bootstrap, same seed and count). A sensitivity, not a label.

| Comparison | Estimate | Whole-session interval (the test) | Label | Lag-1 correlation | Blocks of 3 | Blocks of 5 |
|---|---|---|---|---|---|---|
| short dev event vs G2, 3-session units | +0.179 | [+0.069, +0.286] | better | 0.05 | [+0.066, +0.291] | [+0.068, +0.293] |
| short dev event vs G1, 1-session units | -0.029 | [-0.079, +0.022] | no clear difference | 0.10 | [-0.080, +0.027] | [-0.079, +0.021] |
| short conf event vs G2, 3-session units | +0.076 | [-0.123, +0.281] | no clear difference | 0.04 | [-0.129, +0.295] | [-0.081, +0.257] |
| short conf event vs G1, 1-session units | -0.082 | [-0.175, +0.010] | no clear difference | -0.12 | [-0.185, +0.005] | [-0.181, +0.006] |
| short whole event vs G2, 3-session units | +0.146 | [+0.053, +0.247] | better | 0.05 | [+0.047, +0.248] | [+0.053, +0.239] |
| short whole event vs G1, 1-session units | -0.047 | [-0.091, -0.003] | worse | 0.02 | [-0.094, -0.001] | [-0.094, -0.001] |
| long dev event vs G2, 3-session units | -0.030 | [-0.115, +0.054] | no clear difference | 0.23 | [-0.132, +0.067] | [-0.129, +0.077] |
| long dev event vs G1, 1-session units | +0.005 | [-0.032, +0.044] | no clear difference | 0.09 | [-0.034, +0.046] | [-0.033, +0.044] |
| long conf event vs G2, 3-session units | +0.145 | [+0.013, +0.270] | better | 0.05 | [+0.005, +0.283] | [+0.019, +0.269] |
| long conf event vs G1, 1-session units | -0.039 | [-0.102, +0.019] | no clear difference | -0.01 | [-0.100, +0.020] | [-0.102, +0.021] |
| long whole event vs G2, 3-session units | +0.027 | [-0.042, +0.095] | no clear difference | 0.18 | [-0.049, +0.110] | [-0.053, +0.108] |
| long whole event vs G1, 1-session units | -0.009 | [-0.041, +0.025] | no clear difference | 0.05 | [-0.041, +0.025] | [-0.044, +0.025] |
| post hoc Jan-May event vs G2, 3-session units | -0.108 | [-0.210, -0.007] | worse | 0.26 | [-0.232, +0.003] | [-0.232, +0.011] |
| post hoc Jan-May event vs G2, 3-session percent | -0.358 | [-0.714, -0.020] | worse | 0.35 | [-0.788, +0.027] | [-0.763, +0.037] |

## Part B — Trend Breakout with its own limit

**In plain terms.** Loosening the extension limit does not make Trend Breakout common enough. Even with no limit at all, a valid breakout shows up on about one name a typical morning, and on none on nearly half of mornings. The looser candidate sets also did worse than an average stock over three sessions: in the short window L3–L5 did; across 2026 L2–L4 did, and L5 did not. No candidate qualifies, so none is recommended.

- **The base.** Every stock-day in an uptrend with the breakout pattern satisfied, whatever the extension check said: **189** in the short window (development 127, confirmation 62) and **465** in the long. That averages 1.6 a morning in the short window before any limit.
- **What binds.** The pattern is a close at the 20-day high on heavy volume. It is satisfied on 346 stock-days in any regime, and on only 189 in an uptrend, so the pattern and the uptrend bind before any limit does.
- **How limits are computed.** Each candidate's limit is rebuilt from the record's own facts, in exact decimal, as the evaluator builds its guard (`tfSetupV1.js:242`).
- **Self-check.** L0 reproduces the record's own extension result on **189 of 189** (465 of 465 long), with the limit equal to the stored one on every record. It gives exactly **31** valid breakouts (70 long).
- **Every candidate did poorly.** Three-session averages run from −0.21 to −0.37 units in the short window, today's limit included (−0.244). The label against every stock reaches "worse" only where events are numerous:
  - Short window: L3 −0.301, L4 −0.315, L5 −0.322, H2 −0.238.
  - Long window: L2 −0.209, L3 −0.177, L4 −0.177; L5 is no clear difference (−0.119).
  - The names a looser limit adds were not tested on their own.
- **The recommendation**, by the rule fixed in advance on development data: **none**, under both readings of "not below zero". No candidate reaches a development median of 3 valid breakouts a morning. The highest is 1: L3, L4, L5 and H2 in the short window; L2 to L5 and H2 in the long. With none recommended, there are no confirmation figures for a recommended candidate.

### Part B — short window

Base: 189 stock-days (development 127, confirmation 62) with the breakout pattern satisfied in an uptrend (346 in any regime). L0 check: agrees with the record's own extension result on 189 of 189; limit equal on 189; valid under L0: 31.

| Candidate | Per morning · dev (median, p10–p90, none) | Per morning · conf | Per morning · whole | Events (whole) / entered / removed | 3-day vs G2 · dev | 3-day vs G2 · conf | 3-day vs G2 · whole | 1-day vs G2 · whole | 3-day vs G1 · whole | 3-day mean units / ≥+1u / ≤−1u (whole) |
|---|---|---|---|---|---|---|---|---|---|---|
| L0 | 0, 0–1, 76.3% | 0, 0–0, 90% | 0, 0–1, 80.8% | 29 / 20 / 9 | no clear difference · small: -0.019 [-0.413, +0.381] | too few sessions (3): +0.105 | no clear difference · small: +0.003 [-0.333, +0.340] | no clear difference · small: +0.016 [-0.246, +0.267] | no clear difference · small: -0.171 [-0.510, +0.178] | -0.244 / 10% / 20% |
| L1 | 0, 0–2, 60% | 0, 0–1, 72.5% | 0, 0–2, 64.2% | 58 / 48 / 10 | no clear difference · small: -0.025 [-0.353, +0.293] | no clear difference · small: +0.708 [-0.181, +1.734] | no clear difference · small: +0.158 [-0.183, +0.504] | no clear difference · small: +0.089 [-0.117, +0.291] | no clear difference · small: -0.085 [-0.429, +0.303] | -0.212 / 10.4% / 22.9% |
| L2 | 0.5, 0–3, 50% | 0, 0–2, 60% | 0, 0–2, 53.3% | 101 / 90 / 11 | no clear difference · small: -0.190 [-0.457, +0.072] | no clear difference · small: +0.351 [-0.312, +1.092] | no clear difference · small: -0.049 [-0.346, +0.242] | no clear difference · small: +0.025 [-0.139, +0.180] | no clear difference · small: -0.292 [-0.578, +0.001] | -0.357 / 10.1% / 27% |
| L3 | 1, 0–3, 48.8% | 0, 0–3, 57.5% | 0, 0–3, 51.7% | 129 / 118 / 11 | no clear difference · small: -0.233 [-0.479, +0.002] | no clear difference · small: +0.346 [-0.184, +0.931] | no clear difference: -0.062 [-0.313, +0.190] | no clear difference: +0.031 [-0.126, +0.177] | worse: -0.301 [-0.548, -0.047] | -0.292 / 10.3% / 24.1% |
| L4 | 1, 0–3, 43.8% | 0, 0–4, 57.5% | 1, 0–3, 48.3% | 141 / 136 / 5 | no clear difference · small: -0.218 [-0.458, +0.019] | no clear difference · small: +0.259 [-0.186, +0.709] | no clear difference: -0.079 [-0.308, +0.131] | no clear difference: +0.014 [-0.128, +0.147] | worse: -0.315 [-0.536, -0.089] | -0.316 / 9.7% / 24.6% |
| L5 | 1, 0–3, 41.3% | 0, 0–4, 57.5% | 1, 0–4, 46.7% | 156 / 156 / 0 | no clear difference · small: -0.186 [-0.439, +0.043] | no clear difference · small: +0.158 [-0.284, +0.611] | no clear difference: -0.091 [-0.312, +0.129] | no clear difference: +0.000 [-0.134, +0.129] | worse: -0.322 [-0.544, -0.099] | -0.373 / 9.7% / 28.6% |
| H1 | 0, 0–1, 63.8% | 0, 0–2, 70% | 0, 0–2, 65.8% | 75 / 54 / 21 | no clear difference · small: -0.309 [-0.687, +0.079] | no clear difference · small: +0.332 [-0.134, +0.905] | no clear difference · small: -0.134 [-0.434, +0.170] | no clear difference · small: +0.012 [-0.182, +0.194] | no clear difference · small: -0.293 [-0.617, +0.050] | -0.210 / 7.4% / 24.1% |
| H2 | 1, 0–3, 47.5% | 0, 0–3, 62.5% | 0, 0–3, 52.5% | 120 / 104 / 16 | no clear difference · small: -0.221 [-0.490, +0.059] | better · small: +0.552 [+0.158, +0.989] | no clear difference: -0.032 [-0.287, +0.211] | no clear difference: +0.063 [-0.093, +0.211] | worse: -0.238 [-0.488, -0.010] | -0.267 / 9.7% / 23.3% |

Tightness order (development stock-days): L0 < L1 < H1 < L2 < H2 < L3 < L4 < L5. Recommendation (estimate reading): **none**; interval reading: none.

<details><summary>Every candidate by period: tests and measurements</summary>


*one session against G2, units*

| Candidate | Development | Confirmation | Whole window |
|---|---|---|---|
| L0 | no clear difference · small: +0.086 [-0.226, +0.371] | too few sessions (3): -0.312 | no clear difference · small: +0.016 [-0.246, +0.267] |
| L1 | no clear difference · small: +0.072 [-0.136, +0.270] | no clear difference · small: +0.138 [-0.427, +0.737] | no clear difference · small: +0.089 [-0.117, +0.291] |
| L2 | no clear difference · small: -0.026 [-0.206, +0.134] | no clear difference · small: +0.160 [-0.204, +0.532] | no clear difference · small: +0.025 [-0.139, +0.180] |
| L3 | no clear difference · small: -0.025 [-0.200, +0.136] | no clear difference · small: +0.157 [-0.141, +0.468] | no clear difference: +0.031 [-0.126, +0.177] |
| L4 | no clear difference · small: -0.016 [-0.190, +0.142] | no clear difference · small: +0.081 [-0.168, +0.323] | no clear difference: +0.014 [-0.128, +0.147] |
| L5 | no clear difference · small: +0.004 [-0.159, +0.155] | no clear difference · small: -0.009 [-0.268, +0.245] | no clear difference: +0.000 [-0.134, +0.129] |
| H1 | no clear difference · small: -0.002 [-0.261, +0.227] | no clear difference · small: +0.048 [-0.222, +0.297] | no clear difference · small: +0.012 [-0.182, +0.194] |
| H2 | no clear difference · small: +0.035 [-0.154, +0.213] | no clear difference · small: +0.151 [-0.074, +0.373] | no clear difference: +0.063 [-0.093, +0.211] |

*three sessions against G1, units*

| Candidate | Development | Confirmation | Whole window |
|---|---|---|---|
| L0 | no clear difference · small: -0.146 [-0.572, +0.297] | too few sessions (3): -0.286 | no clear difference · small: -0.171 [-0.510, +0.178] |
| L1 | no clear difference · small: -0.203 [-0.524, +0.126] | no clear difference · small: +0.270 [-0.684, +1.496] | no clear difference · small: -0.085 [-0.429, +0.303] |
| L2 | worse · small: -0.335 [-0.601, -0.080] | no clear difference · small: -0.168 [-0.860, +0.714] | no clear difference · small: -0.292 [-0.578, +0.001] |
| L3 | worse · small: -0.383 [-0.629, -0.149] | no clear difference · small: -0.105 [-0.661, +0.583] | worse: -0.301 [-0.548, -0.047] |
| L4 | worse · small: -0.366 [-0.597, -0.131] | no clear difference · small: -0.192 [-0.657, +0.340] | worse: -0.315 [-0.536, -0.089] |
| L5 | worse · small: -0.332 [-0.586, -0.085] | no clear difference · small: -0.293 [-0.750, +0.237] | worse: -0.322 [-0.544, -0.099] |
| H1 | no clear difference · small: -0.379 [-0.781, +0.008] | no clear difference · small: -0.064 [-0.610, +0.716] | no clear difference · small: -0.293 [-0.617, +0.050] |
| H2 | worse · small: -0.329 [-0.610, -0.052] | no clear difference · small: +0.043 [-0.361, +0.592] | worse: -0.238 [-0.488, -0.010] |

*one session against G1, units*

| Candidate | Development | Confirmation | Whole window |
|---|---|---|---|
| L0 | no clear difference · small: +0.075 [-0.230, +0.354] | too few sessions (3): -0.374 | no clear difference · small: -0.005 [-0.267, +0.248] |
| L1 | no clear difference · small: +0.034 [-0.180, +0.230] | no clear difference · small: +0.049 [-0.526, +0.720] | no clear difference · small: +0.038 [-0.180, +0.261] |
| L2 | no clear difference · small: -0.050 [-0.231, +0.106] | no clear difference · small: +0.069 [-0.321, +0.484] | no clear difference · small: -0.018 [-0.184, +0.147] |
| L3 | no clear difference · small: -0.046 [-0.218, +0.117] | no clear difference · small: +0.083 [-0.231, +0.445] | no clear difference: -0.006 [-0.167, +0.143] |
| L4 | no clear difference · small: -0.035 [-0.203, +0.115] | no clear difference · small: +0.006 [-0.246, +0.272] | no clear difference: -0.022 [-0.167, +0.115] |
| L5 | no clear difference · small: -0.016 [-0.178, +0.132] | no clear difference · small: -0.084 [-0.346, +0.192] | no clear difference: -0.036 [-0.172, +0.095] |
| H1 | no clear difference · small: +0.014 [-0.220, +0.224] | no clear difference · small: +0.013 [-0.306, +0.349] | no clear difference · small: +0.014 [-0.176, +0.196] |
| H2 | no clear difference · small: +0.027 [-0.145, +0.193] | no clear difference · small: +0.048 [-0.182, +0.296] | no clear difference: +0.032 [-0.112, +0.173] |

*three sessions against G2, percent*

| Candidate | Development | Confirmation | Whole window |
|---|---|---|---|
| L0 | no clear difference · small: -0.27 [-1.72, +1.29] | too few sessions (3): +0.46 | no clear difference · small: -0.14 [-1.38, +1.10] |
| L1 | no clear difference · small: -0.09 [-1.26, +1.08] | no clear difference · small: +1.66 [-1.11, +4.49] | no clear difference · small: +0.35 [-0.75, +1.44] |
| L2 | no clear difference · small: -0.53 [-1.52, +0.46] | no clear difference · small: +0.67 [-1.63, +2.98] | no clear difference · small: -0.22 [-1.26, +0.83] |
| L3 | no clear difference · small: -0.72 [-1.61, +0.12] | no clear difference · small: +0.72 [-1.10, +2.56] | no clear difference: -0.30 [-1.18, +0.55] |
| L4 | no clear difference · small: -0.67 [-1.54, +0.19] | no clear difference · small: +0.49 [-1.19, +2.01] | no clear difference: -0.33 [-1.15, +0.42] |
| L5 | no clear difference · small: -0.61 [-1.50, +0.26] | no clear difference · small: +0.35 [-1.24, +1.80] | no clear difference: -0.34 [-1.13, +0.40] |
| H1 | no clear difference · small: -0.90 [-2.23, +0.39] | no clear difference · small: +1.00 [-0.15, +2.37] | no clear difference · small: -0.38 [-1.41, +0.57] |
| H2 | no clear difference · small: -0.62 [-1.64, +0.44] | better · small: +1.78 [+0.61, +3.04] | no clear difference: -0.03 [-0.92, +0.87] |

*one session against G2, percent*

| Candidate | Development | Confirmation | Whole window |
|---|---|---|---|
| L0 | no clear difference · small: +0.39 [-0.76, +1.47] | too few sessions (3): -0.36 | no clear difference · small: +0.25 [-0.73, +1.15] |
| L1 | no clear difference · small: +0.35 [-0.44, +1.09] | no clear difference · small: +0.37 [-1.26, +2.04] | no clear difference · small: +0.35 [-0.35, +1.03] |
| L2 | no clear difference · small: -0.07 [-0.68, +0.48] | no clear difference · small: +0.38 [-0.81, +1.54] | no clear difference · small: +0.05 [-0.52, +0.56] |
| L3 | no clear difference · small: -0.03 [-0.64, +0.54] | no clear difference · small: +0.42 [-0.56, +1.38] | no clear difference: +0.11 [-0.43, +0.60] |
| L4 | no clear difference · small: +0.03 [-0.55, +0.57] | no clear difference · small: +0.24 [-0.64, +1.06] | no clear difference: +0.09 [-0.40, +0.56] |
| L5 | no clear difference · small: +0.08 [-0.48, +0.60] | no clear difference · small: +0.04 [-0.83, +0.86] | no clear difference: +0.07 [-0.37, +0.49] |
| H1 | no clear difference · small: +0.18 [-0.71, +0.96] | no clear difference · small: +0.37 [-0.33, +1.00] | no clear difference · small: +0.23 [-0.40, +0.85] |
| H2 | no clear difference · small: +0.17 [-0.47, +0.79] | no clear difference · small: +0.68 [-0.02, +1.39] | no clear difference: +0.29 [-0.24, +0.82] |

*three sessions against G1, percent*

| Candidate | Development | Confirmation | Whole window |
|---|---|---|---|
| L0 | no clear difference · small: -0.67 [-2.15, +0.91] | too few sessions (3): -0.63 | no clear difference · small: -0.66 [-1.92, +0.60] |
| L1 | no clear difference · small: -0.61 [-1.73, +0.54] | no clear difference · small: +0.48 [-2.27, +3.80] | no clear difference · small: -0.34 [-1.41, +0.80] |
| L2 | no clear difference · small: -0.92 [-1.90, +0.09] | no clear difference · small: -0.74 [-2.92, +1.77] | no clear difference · small: -0.87 [-1.86, +0.11] |
| L3 | worse · small: -1.14 [-1.98, -0.33] | no clear difference · small: -0.49 [-2.30, +1.48] | worse: -0.95 [-1.75, -0.11] |
| L4 | worse · small: -1.09 [-1.90, -0.28] | no clear difference · small: -0.72 [-2.29, +0.86] | worse: -0.98 [-1.73, -0.25] |
| L5 | worse · small: -1.02 [-1.89, -0.18] | no clear difference · small: -0.86 [-2.35, +0.65] | worse: -0.98 [-1.73, -0.25] |
| H1 | no clear difference · small: -1.10 [-2.43, +0.17] | no clear difference · small: -0.23 [-1.64, +1.79] | no clear difference · small: -0.87 [-1.90, +0.18] |
| H2 | no clear difference · small: -0.91 [-1.89, +0.15] | no clear difference · small: +0.20 [-0.97, +1.61] | no clear difference: -0.64 [-1.51, +0.19] |

*one session against G1, percent*

| Candidate | Development | Confirmation | Whole window |
|---|---|---|---|
| L0 | no clear difference · small: +0.37 [-0.80, +1.49] | too few sessions (3): -0.40 | no clear difference · small: +0.24 [-0.77, +1.14] |
| L1 | no clear difference · small: +0.25 [-0.55, +0.98] | no clear difference · small: +0.11 [-1.51, +1.93] | no clear difference · small: +0.21 [-0.52, +0.91] |
| L2 | no clear difference · small: -0.11 [-0.71, +0.45] | no clear difference · small: +0.18 [-1.10, +1.40] | no clear difference · small: -0.03 [-0.60, +0.52] |
| L3 | no clear difference · small: -0.07 [-0.65, +0.47] | no clear difference · small: +0.23 [-0.79, +1.31] | no clear difference: +0.02 [-0.51, +0.52] |
| L4 | no clear difference · small: -0.00 [-0.57, +0.51] | no clear difference · small: +0.05 [-0.86, +0.92] | no clear difference: +0.01 [-0.47, +0.49] |
| L5 | no clear difference · small: +0.03 [-0.51, +0.54] | no clear difference · small: -0.15 [-1.07, +0.73] | no clear difference: -0.02 [-0.47, +0.41] |
| H1 | no clear difference · small: +0.28 [-0.52, +0.97] | no clear difference · small: +0.31 [-0.56, +1.15] | no clear difference · small: +0.29 [-0.32, +0.89] |
| H2 | no clear difference · small: +0.18 [-0.40, +0.75] | no clear difference · small: +0.38 [-0.31, +1.10] | no clear difference: +0.23 [-0.27, +0.72] |

*Measurements, one session (mean units / mean %; ≥+1u / ≤−1u; barrier up / down / neither)*

| Candidate | Development | Confirmation | Whole window |
|---|---|---|---|
| L0 | +0.010 / +0.19; 0% / 5.9%; 5.9% / 5.9% / 88.2% | -0.653 / -1.83; 0% / 33.3%; 0% / 33.3% / 66.7% | -0.089 / -0.11; 0% / 10%; 5% / 10% / 85% |
| L1 | +0.024 / +0.30; 5.7% / 5.7%; 14.3% / 8.6% / 77.1% | -0.097 / -0.58; 7.7% / 15.4%; 7.7% / 30.8% / 61.5% | -0.008 / +0.06; 6.3% / 8.3%; 12.5% / 14.6% / 72.9% |
| L2 | +0.002 / +0.12; 4.5% / 6.1%; 15.2% / 7.6% / 77.3% | -0.138 / -0.56; 8.3% / 20.8%; 8.3% / 33.3% / 58.3% | -0.035 / -0.06; 5.6% / 10%; 13.3% / 14.4% / 72.2% |
| L3 | +0.015 / +0.14; 7.2% / 6%; 15.7% / 10.8% / 73.5% | -0.102 / -0.43; 8.8% / 17.6%; 8.8% / 26.5% / 64.7% | -0.019 / -0.02; 7.7% / 9.4%; 13.7% / 15.4% / 70.9% |
| L4 | +0.001 / +0.10; 6.7% / 5.6%; 14.4% / 12.2% / 73.3% | -0.304 / -0.88; 6.7% / 26.7%; 6.7% / 35.6% / 57.8% | -0.101 / -0.23; 6.7% / 12.6%; 11.9% / 20% / 68.1% |
| L5 | +0.007 / +0.13; 6.1% / 5.1%; 15.3% / 12.2% / 72.4% | -0.430 / -1.14; 5.3% / 29.8%; 5.3% / 43.9% / 50.9% | -0.154 / -0.34; 5.8% / 14.2%; 11.6% / 23.9% / 64.5% |
| H1 | +0.018 / +0.23; 2.6% / 7.9%; 13.2% / 13.2% / 73.7% | -0.025 / -0.12; 6.3% / 12.5%; 6.3% / 12.5% / 81.3% | +0.005 / +0.13; 3.7% / 9.3%; 11.1% / 13% / 75.9% |
| H2 | +0.027 / +0.22; 4.3% / 5.7%; 14.3% / 8.6% / 77.1% | -0.143 / -0.44; 6.1% / 21.2%; 6.1% / 24.2% / 69.7% | -0.027 / +0.01; 4.9% / 10.7%; 11.7% / 13.6% / 74.8% |

*Measurements, three sessions (events / entered / removed by entry; mean units; ≥+1u / ≤−1u; barrier up / down / neither)*

| Candidate | Development | Confirmation | Whole window |
|---|---|---|---|
| L0 | 24 / 17 / 7; -0.228; 11.8% / 23.5%; 23.5% / 52.9% / 23.5% | 5 / 3 / 2; -0.337; 0% / 0%; 0% / 66.7% / 33.3% | 29 / 20 / 9; -0.244; 10% / 20%; 20% / 55% / 25% |
| L1 | 42 / 35 / 7; -0.294; 8.6% / 22.9%; 28.6% / 51.4% / 20% | 16 / 13 / 3; +0.009; 15.4% / 23.1%; 30.8% / 53.8% / 15.4% | 58 / 48 / 10; -0.212; 10.4% / 22.9%; 29.2% / 52.1% / 18.8% |
| L2 | 73 / 66 / 7; -0.352; 9.1% / 25.8%; 34.8% / 45.5% / 19.7% | 28 / 24 / 4; -0.372; 13% / 30.4%; 21.7% / 56.5% / 21.7% | 101 / 90 / 11; -0.357; 10.1% / 27%; 31.5% / 48.3% / 20.2% |
| L3 | 86 / 84 / 2; -0.340; 8.4% / 25.3%; 34.9% / 43.4% / 21.7% | 43 / 34 / 9; -0.172; 15.2% / 21.2%; 27.3% / 51.5% / 21.2% | 129 / 118 / 11; -0.292; 10.3% / 24.1%; 32.8% / 45.7% / 21.6% |
| L4 | 92 / 91 / 1; -0.328; 7.8% / 24.4%; 33.3% / 42.2% / 24.4% | 49 / 45 / 4; -0.290; 13.6% / 25%; 22.7% / 59.1% / 18.2% | 141 / 136 / 5; -0.316; 9.7% / 24.6%; 29.9% / 47.8% / 22.4% |
| L5 | 99 / 99 / 0; -0.300; 9.2% / 24.5%; 34.7% / 40.8% / 24.5% | 57 / 57 / 0; -0.501; 10.7% / 35.7%; 17.9% / 67.9% / 14.3% | 156 / 156 / 0; -0.373; 9.7% / 28.6%; 28.6% / 50.6% / 20.8% |
| H1 | 48 / 38 / 10; -0.366; 5.3% / 28.9%; 28.9% / 50% / 21.1% | 27 / 16 / 11; +0.160; 12.5% / 12.5%; 25% / 37.5% / 37.5% | 75 / 54 / 21; -0.210; 7.4% / 24.1%; 27.8% / 46.3% / 25.9% |
| H2 | 81 / 71 / 10; -0.365; 7.1% / 25.7%; 31.4% / 41.4% / 27.1% | 39 / 33 / 6; -0.058; 15.2% / 18.2%; 27.3% / 51.5% / 21.2% | 120 / 104 / 16; -0.267; 9.7% / 23.3%; 30.1% / 44.7% / 25.2% |

</details>

### Part B — long window

Base: 465 stock-days (development 355, confirmation 110) with the breakout pattern satisfied in an uptrend (768 in any regime). L0 check: agrees with the record's own extension result on 465 of 465; limit equal on 465; valid under L0: 70.

| Candidate | Per morning · dev (median, p10–p90, none) | Per morning · conf | Per morning · whole | Events (whole) / entered / removed | 3-day vs G2 · dev | 3-day vs G2 · conf | 3-day vs G2 · whole | 1-day vs G2 · whole | 3-day vs G1 · whole | 3-day mean units / ≥+1u / ≤−1u (whole) |
|---|---|---|---|---|---|---|---|---|---|---|
| L0 | 0, 0–1, 76.2% | 0, 0–1, 79.7% | 0, 0–1, 77.4% | 69 / 49 / 20 | no clear difference · small: +0.064 [-0.245, +0.354] | no clear difference · small: -0.121 [-0.519, +0.276] | no clear difference · small: +0.012 [-0.241, +0.257] | no clear difference · small: +0.047 [-0.176, +0.288] | no clear difference · small: -0.048 [-0.287, +0.200] | -0.086 / 14.3% / 14.3% |
| L1 | 0, 0–2, 59.2% | 0, 0–2, 64.9% | 0, 0–2, 61.1% | 137 / 116 / 21 | no clear difference · small: -0.179 [-0.430, +0.067] | no clear difference · small: +0.190 [-0.243, +0.662] | no clear difference: -0.075 [-0.288, +0.146] | no clear difference: -0.063 [-0.227, +0.105] | no clear difference: -0.162 [-0.384, +0.061] | -0.119 / 15.5% / 23.3% |
| L2 | 1, 0–3, 48.3% | 0, 0–2, 55.4% | 0, 0–3, 50.7% | 224 / 199 / 25 | no clear difference: -0.190 [-0.393, +0.004] | no clear difference · small: +0.042 [-0.323, +0.438] | no clear difference: -0.123 [-0.301, +0.062] | no clear difference: -0.040 [-0.161, +0.086] | worse: -0.209 [-0.383, -0.023] | -0.201 / 13.6% / 23.7% |
| L3 | 1, 0–5, 42.2% | 0, 0–3, 54.1% | 1, 0–3, 46.2% | 293 / 267 / 26 | no clear difference: -0.166 [-0.362, +0.025] | no clear difference · small: +0.081 [-0.227, +0.434] | no clear difference: -0.094 [-0.264, +0.076] | no clear difference: -0.041 [-0.153, +0.082] | worse: -0.177 [-0.349, -0.002] | -0.113 / 15.5% / 20.8% |
| L4 | 1, 0–5, 37.4% | 0.5, 0–3, 50% | 1, 0–5, 41.6% | 338 / 319 / 19 | no clear difference: -0.149 [-0.336, +0.032] | no clear difference · small: +0.046 [-0.228, +0.331] | no clear difference: -0.095 [-0.254, +0.055] | no clear difference: -0.037 [-0.149, +0.080] | worse: -0.177 [-0.334, -0.019] | -0.072 / 17% / 19.6% |
| L5 | 1, 0–7, 34% | 1, 0–4, 47.3% | 1, 0–5, 38.5% | 398 / 398 / 0 | no clear difference: -0.079 [-0.268, +0.095] | no clear difference · small: +0.055 [-0.202, +0.325] | no clear difference: -0.042 [-0.194, +0.108] | no clear difference: -0.030 [-0.127, +0.071] | no clear difference: -0.119 [-0.275, +0.045] | -0.062 / 17.9% / 21.2% |
| H1 | 0, 0–3, 58.5% | 0, 0–2, 66.2% | 0, 0–3, 61.1% | 168 / 124 / 44 | no clear difference · small: +0.047 [-0.249, +0.402] | no clear difference · small: -0.025 [-0.420, +0.383] | no clear difference: +0.027 [-0.229, +0.287] | no clear difference: -0.087 [-0.224, +0.046] | no clear difference: -0.030 [-0.286, +0.247] | -0.032 / 16.1% / 20.2% |
| H2 | 1, 0–4, 42.2% | 0, 0–3, 54.1% | 1, 0–4, 46.2% | 279 / 240 / 39 | no clear difference: -0.077 [-0.314, +0.151] | no clear difference · small: +0.138 [-0.131, +0.440] | no clear difference: -0.018 [-0.200, +0.172] | no clear difference: -0.006 [-0.134, +0.125] | no clear difference: -0.085 [-0.268, +0.104] | -0.043 / 18% / 19.7% |

Tightness order (development stock-days): L0 < L1 < H1 < L2 < H2 < L3 < L4 < L5. Recommendation (estimate reading): **none**; interval reading: none.

<details><summary>Every candidate by period: tests and measurements</summary>


*one session against G2, units*

| Candidate | Development | Confirmation | Whole window |
|---|---|---|---|
| L0 | no clear difference · small: +0.185 [-0.105, +0.500] | worse · small: -0.303 [-0.608, -0.019] | no clear difference · small: +0.047 [-0.176, +0.288] |
| L1 | no clear difference · small: -0.063 [-0.274, +0.145] | no clear difference · small: -0.063 [-0.350, +0.229] | no clear difference: -0.063 [-0.227, +0.105] |
| L2 | no clear difference: -0.053 [-0.204, +0.098] | no clear difference · small: -0.010 [-0.236, +0.215] | no clear difference: -0.040 [-0.161, +0.086] |
| L3 | no clear difference: -0.061 [-0.208, +0.071] | no clear difference · small: +0.008 [-0.195, +0.217] | no clear difference: -0.041 [-0.153, +0.082] |
| L4 | no clear difference: -0.045 [-0.193, +0.104] | no clear difference · small: -0.019 [-0.203, +0.155] | no clear difference: -0.037 [-0.149, +0.080] |
| L5 | no clear difference: -0.034 [-0.160, +0.087] | no clear difference · small: -0.022 [-0.203, +0.153] | no clear difference: -0.030 [-0.127, +0.071] |
| H1 | no clear difference · small: -0.096 [-0.256, +0.059] | no clear difference · small: -0.064 [-0.310, +0.168] | no clear difference: -0.087 [-0.224, +0.046] |
| H2 | no clear difference: -0.020 [-0.181, +0.139] | no clear difference · small: +0.028 [-0.177, +0.216] | no clear difference: -0.006 [-0.134, +0.125] |

*three sessions against G1, units*

| Candidate | Development | Confirmation | Whole window |
|---|---|---|---|
| L0 | no clear difference · small: +0.013 [-0.256, +0.291] | no clear difference · small: -0.204 [-0.671, +0.280] | no clear difference · small: -0.048 [-0.287, +0.200] |
| L1 | no clear difference · small: -0.199 [-0.427, +0.020] | no clear difference · small: -0.068 [-0.562, +0.494] | no clear difference: -0.162 [-0.384, +0.061] |
| L2 | worse: -0.196 [-0.382, -0.013] | no clear difference · small: -0.241 [-0.623, +0.206] | worse: -0.209 [-0.383, -0.023] |
| L3 | no clear difference: -0.171 [-0.362, +0.013] | no clear difference · small: -0.191 [-0.528, +0.200] | worse: -0.177 [-0.349, -0.002] |
| L4 | no clear difference: -0.160 [-0.355, +0.025] | no clear difference · small: -0.220 [-0.518, +0.094] | worse: -0.177 [-0.334, -0.019] |
| L5 | no clear difference: -0.089 [-0.280, +0.095] | no clear difference · small: -0.195 [-0.486, +0.127] | no clear difference: -0.119 [-0.275, +0.045] |
| H1 | no clear difference · small: +0.011 [-0.284, +0.365] | no clear difference · small: -0.138 [-0.580, +0.347] | no clear difference: -0.030 [-0.286, +0.247] |
| H2 | no clear difference: -0.085 [-0.326, +0.145] | no clear difference · small: -0.085 [-0.366, +0.233] | no clear difference: -0.085 [-0.268, +0.104] |

*one session against G1, units*

| Candidate | Development | Confirmation | Whole window |
|---|---|---|---|
| L0 | no clear difference · small: +0.159 [-0.103, +0.434] | no clear difference · small: -0.270 [-0.617, +0.061] | no clear difference · small: +0.038 [-0.161, +0.252] |
| L1 | no clear difference · small: -0.064 [-0.248, +0.115] | no clear difference · small: -0.100 [-0.408, +0.238] | no clear difference: -0.074 [-0.228, +0.079] |
| L2 | no clear difference: -0.060 [-0.193, +0.072] | no clear difference · small: -0.039 [-0.284, +0.207] | no clear difference: -0.054 [-0.168, +0.070] |
| L3 | no clear difference: -0.056 [-0.188, +0.072] | no clear difference · small: -0.018 [-0.238, +0.218] | no clear difference: -0.044 [-0.160, +0.076] |
| L4 | no clear difference: -0.037 [-0.174, +0.106] | no clear difference · small: -0.042 [-0.234, +0.143] | no clear difference: -0.038 [-0.150, +0.076] |
| L5 | no clear difference: -0.027 [-0.147, +0.093] | no clear difference · small: -0.043 [-0.223, +0.152] | no clear difference: -0.032 [-0.126, +0.070] |
| H1 | no clear difference · small: -0.083 [-0.240, +0.070] | no clear difference · small: -0.017 [-0.267, +0.226] | no clear difference: -0.065 [-0.196, +0.067] |
| H2 | no clear difference: -0.018 [-0.172, +0.130] | no clear difference · small: +0.016 [-0.184, +0.206] | no clear difference: -0.009 [-0.128, +0.115] |

*three sessions against G2, percent*

| Candidate | Development | Confirmation | Whole window |
|---|---|---|---|
| L0 | no clear difference · small: +0.34 [-0.55, +1.20] | no clear difference · small: -0.65 [-2.13, +0.83] | no clear difference · small: +0.06 [-0.73, +0.84] |
| L1 | no clear difference · small: -0.40 [-1.15, +0.36] | no clear difference · small: +0.22 [-1.18, +1.70] | no clear difference: -0.22 [-0.89, +0.46] |
| L2 | no clear difference: -0.41 [-1.07, +0.21] | no clear difference · small: -0.18 [-1.42, +1.15] | no clear difference: -0.34 [-0.91, +0.26] |
| L3 | no clear difference: -0.32 [-0.94, +0.29] | no clear difference · small: -0.05 [-1.11, +1.09] | no clear difference: -0.24 [-0.80, +0.30] |
| L4 | no clear difference: -0.28 [-0.88, +0.30] | no clear difference · small: -0.13 [-1.15, +0.91] | no clear difference: -0.23 [-0.78, +0.29] |
| L5 | no clear difference: -0.08 [-0.74, +0.54] | no clear difference · small: +0.01 [-0.93, +0.93] | no clear difference: -0.05 [-0.57, +0.48] |
| H1 | no clear difference · small: -0.01 [-0.87, +0.92] | no clear difference · small: -0.18 [-1.46, +1.07] | no clear difference: -0.06 [-0.81, +0.68] |
| H2 | no clear difference: -0.08 [-0.99, +0.83] | no clear difference · small: +0.29 [-0.64, +1.29] | no clear difference: +0.03 [-0.69, +0.72] |

*one session against G2, percent*

| Candidate | Development | Confirmation | Whole window |
|---|---|---|---|
| L0 | no clear difference · small: +0.49 [-0.52, +1.53] | no clear difference · small: -0.86 [-1.95, +0.13] | no clear difference · small: +0.11 [-0.68, +0.90] |
| L1 | no clear difference · small: -0.04 [-0.66, +0.62] | no clear difference · small: -0.27 [-1.16, +0.64] | no clear difference: -0.10 [-0.62, +0.42] |
| L2 | no clear difference: -0.02 [-0.49, +0.46] | no clear difference · small: -0.15 [-0.92, +0.60] | no clear difference: -0.06 [-0.44, +0.34] |
| L3 | no clear difference: -0.03 [-0.50, +0.42] | no clear difference · small: -0.08 [-0.77, +0.60] | no clear difference: -0.04 [-0.41, +0.37] |
| L4 | no clear difference: +0.01 [-0.49, +0.52] | no clear difference · small: -0.09 [-0.75, +0.54] | no clear difference: -0.02 [-0.41, +0.36] |
| L5 | no clear difference: -0.01 [-0.42, +0.40] | no clear difference · small: -0.04 [-0.66, +0.57] | no clear difference: -0.02 [-0.34, +0.32] |
| H1 | no clear difference · small: -0.28 [-0.80, +0.24] | no clear difference · small: -0.05 [-0.86, +0.70] | no clear difference: -0.22 [-0.67, +0.21] |
| H2 | no clear difference: +0.03 [-0.54, +0.57] | no clear difference · small: +0.16 [-0.54, +0.84] | no clear difference: +0.07 [-0.37, +0.53] |

*three sessions against G1, percent*

| Candidate | Development | Confirmation | Whole window |
|---|---|---|---|
| L0 | no clear difference · small: +0.17 [-0.69, +1.02] | no clear difference · small: -0.88 [-2.53, +0.85] | no clear difference · small: -0.13 [-0.93, +0.68] |
| L1 | no clear difference · small: -0.48 [-1.16, +0.20] | no clear difference · small: -0.52 [-2.05, +1.19] | no clear difference: -0.49 [-1.16, +0.21] |
| L2 | no clear difference: -0.43 [-1.05, +0.19] | no clear difference · small: -0.94 [-2.15, +0.42] | no clear difference: -0.58 [-1.14, +0.03] |
| L3 | no clear difference: -0.33 [-0.94, +0.27] | no clear difference · small: -0.77 [-1.83, +0.40] | no clear difference: -0.45 [-0.99, +0.12] |
| L4 | no clear difference: -0.31 [-0.92, +0.28] | no clear difference · small: -0.83 [-1.84, +0.15] | no clear difference: -0.45 [-0.96, +0.09] |
| L5 | no clear difference: -0.10 [-0.75, +0.53] | no clear difference · small: -0.66 [-1.60, +0.33] | no clear difference: -0.25 [-0.77, +0.30] |
| H1 | no clear difference · small: -0.11 [-0.99, +0.83] | no clear difference · small: -0.47 [-1.78, +0.95] | no clear difference: -0.21 [-0.93, +0.57] |
| H2 | no clear difference: -0.08 [-0.98, +0.82] | no clear difference · small: -0.37 [-1.25, +0.59] | no clear difference: -0.16 [-0.81, +0.53] |

*one session against G1, percent*

| Candidate | Development | Confirmation | Whole window |
|---|---|---|---|
| L0 | no clear difference · small: +0.44 [-0.46, +1.39] | no clear difference · small: -0.74 [-1.99, +0.45] | no clear difference · small: +0.11 [-0.62, +0.88] |
| L1 | no clear difference · small: -0.08 [-0.61, +0.50] | no clear difference · small: -0.38 [-1.39, +0.69] | no clear difference: -0.16 [-0.64, +0.34] |
| L2 | no clear difference: -0.07 [-0.49, +0.38] | no clear difference · small: -0.18 [-1.01, +0.63] | no clear difference: -0.10 [-0.47, +0.29] |
| L3 | no clear difference: -0.04 [-0.47, +0.40] | no clear difference · small: -0.12 [-0.87, +0.65] | no clear difference: -0.06 [-0.45, +0.35] |
| L4 | no clear difference: +0.01 [-0.46, +0.51] | no clear difference · small: -0.12 [-0.83, +0.55] | no clear difference: -0.03 [-0.41, +0.36] |
| L5 | no clear difference: -0.00 [-0.40, +0.39] | no clear difference · small: -0.08 [-0.74, +0.56] | no clear difference: -0.03 [-0.36, +0.31] |
| H1 | no clear difference · small: -0.27 [-0.77, +0.21] | no clear difference · small: +0.13 [-0.63, +0.91] | no clear difference: -0.16 [-0.58, +0.25] |
| H2 | no clear difference: +0.02 [-0.53, +0.54] | no clear difference · small: +0.16 [-0.55, +0.83] | no clear difference: +0.06 [-0.37, +0.50] |

*Measurements, one session (mean units / mean %; ≥+1u / ≤−1u; barrier up / down / neither)*

| Candidate | Development | Confirmation | Whole window |
|---|---|---|---|
| L0 | +0.059 / +0.19; 8.1% / 8.1%; 16.2% / 21.6% / 62.2% | -0.384 / -1.24; 0% / 16.7%; 0% / 16.7% / 83.3% | -0.050 / -0.16; 6.1% / 10.2%; 12.2% / 20.4% / 67.3% |
| L1 | -0.030 / -0.05; 9.1% / 10.2%; 18.2% / 20.5% / 61.4% | -0.198 / -0.74; 7.1% / 14.3%; 7.1% / 21.4% / 71.4% | -0.070 / -0.21; 8.6% / 11.2%; 15.5% / 20.7% / 63.8% |
| L2 | +0.011 / +0.03; 9.3% / 7.9%; 19.2% / 17.2% / 63.6% | -0.131 / -0.43; 8.3% / 16.7%; 10.4% / 22.9% / 66.7% | -0.023 / -0.08; 9% / 10.1%; 17.1% / 18.6% / 64.3% |
| L3 | +0.011 / +0.06; 10.4% / 8.4%; 18.8% / 16.3% / 64.9% | -0.105 / -0.35; 9.4% / 14.1%; 10.9% / 21.9% / 67.2% | -0.017 / -0.04; 10.2% / 9.8%; 16.9% / 17.7% / 65.4% |
| L4 | +0.024 / +0.09; 11.3% / 8.4%; 19.2% / 17.6% / 63.2% | -0.227 / -0.63; 7.6% / 19%; 8.9% / 27.8% / 63.3% | -0.038 / -0.09; 10.4% / 11%; 16.7% / 20.1% / 63.2% |
| L5 | +0.047 / +0.14; 12% / 7.3%; 20.3% / 16.6% / 63.1% | -0.286 / -0.72; 6.3% / 20.8%; 8.3% / 32.3% / 59.4% | -0.034 / -0.07; 10.6% / 10.6%; 17.4% / 20.4% / 62.2% |
| H1 | -0.050 / -0.21; 7.4% / 9.6%; 14.9% / 17% / 68.1% | -0.049 / -0.09; 3.3% / 13.3%; 6.7% / 13.3% / 80% | -0.050 / -0.18; 6.5% / 10.5%; 12.9% / 16.1% / 71% |
| H2 | -0.019 / -0.07; 10.1% / 9.5%; 16.2% / 17.3% / 66.5% | -0.081 / -0.20; 5% / 15%; 10% / 16.7% / 73.3% | -0.035 / -0.10; 8.8% / 10.9%; 14.6% / 17.2% / 68.2% |

*Measurements, three sessions (events / entered / removed by entry; mean units; ≥+1u / ≤−1u; barrier up / down / neither)*

| Candidate | Development | Confirmation | Whole window |
|---|---|---|---|
| L0 | 51 / 37 / 14; -0.000; 16.2% / 10.8%; 40.5% / 48.6% / 10.8% | 18 / 12 / 6; -0.352; 8.3% / 25%; 8.3% / 50% / 41.7% | 69 / 49 / 20; -0.086; 14.3% / 14.3%; 32.7% / 49% / 18.4% |
| L1 | 103 / 88 / 15; -0.066; 17% / 21.6%; 34.1% / 51.1% / 14.8% | 34 / 28 / 6; -0.283; 10.7% / 28.6%; 21.4% / 53.6% / 25% | 137 / 116 / 21; -0.119; 15.5% / 23.3%; 31% / 51.7% / 17.2% |
| L2 | 168 / 151 / 17; -0.142; 14.6% / 21.2%; 36.4% / 48.3% / 15.2% | 56 / 48 / 8; -0.390; 10.6% / 31.9%; 25.5% / 51.1% / 23.4% | 224 / 199 / 25; -0.201; 13.6% / 23.7%; 33.8% / 49% / 17.2% |
| L3 | 219 / 203 / 16; -0.072; 16.3% / 19.3%; 37.1% / 45.5% / 17.3% | 74 / 64 / 10; -0.247; 12.7% / 25.4%; 30.2% / 47.6% / 22.2% | 293 / 267 / 26; -0.113; 15.5% / 20.8%; 35.5% / 46% / 18.5% |
| L4 | 255 / 240 / 15; +0.002; 18.8% / 17.6%; 38.5% / 44.4% / 17.2% | 83 / 79 / 4; -0.297; 11.5% / 25.6%; 25.6% / 51.3% / 23.1% | 338 / 319 / 19; -0.072; 17% / 19.6%; 35.3% / 46.1% / 18.6% |
| L5 | 302 / 302 / 0; +0.038; 20.3% / 18.3%; 39.2% / 43.5% / 17.3% | 96 / 96 / 0; -0.377; 10.5% / 30.5%; 24.2% / 54.7% / 21.1% | 398 / 398 / 0; -0.062; 17.9% / 21.2%; 35.6% / 46.2% / 18.2% |
| H1 | 124 / 94 / 30; -0.022; 18.1% / 20.2%; 33% / 51.1% / 16% | 44 / 30 / 14; -0.062; 10% / 20%; 26.7% / 40% / 33.3% | 168 / 124 / 44; -0.032; 16.1% / 20.2%; 31.5% / 48.4% / 20.2% |
| H2 | 209 / 180 / 29; -0.001; 20.1% / 19%; 36.3% / 44.7% / 19% | 70 / 60 / 10; -0.168; 11.7% / 21.7%; 30% / 45% / 25% | 279 / 240 / 39; -0.043; 18% / 19.7%; 34.7% / 44.8% / 20.5% |

</details>

## Part C — the archetypes' own rules

**In plain terms.** Applying today's scores to every past day: most stocks pass a score bar of 40, half pass 50, and almost none pass 70. The Capital Preserver's two conditions together leave 16 stocks, and on a typical morning only one of them is in a valid setup. The Speculator's volatility rule leaves 45 stocks, about four of them in a setup a morning.

**Today's scores, approximate**: the one rankings document of 17 Nov 2026, 20:01 UTC, applied to every session. **The rules as the code states them** (`api/_utils/archetypeScoring.js`, read as text at HEAD; reading R-10):
- **Speculator** (`:89`): "Your shortlist MUST include at least 3 stocks with ATR percentile above 0.80."
- **Fundamental Investor** (`:91`): "Your shortlist MUST include at least 5 stocks with fundamentalScore above 70. Exclude any stock with fundamentalScore below 40."
- **Capital Preserver** (`:93`): "Your shortlist MUST include at least 5 stocks with fundamentalScore above 60. Spread across at least 6 sectors. Avoid stocks with ATR percentile above 0.75." Its two halves here are score > 60 and ATR percentile ≤ 0.75.


Scores computed 2026-11-17T20:01:10.084Z; 228 of 228 matched. Fundamental score: min 24, median 50, max 81; deciles (10th … 90th): 38, 42, 45, 48, 50, 52, 55, 57, 62.

| Score band | 20–29 | 30–39 | 40–49 | 50–59 | 60–69 | 70–79 | 80–89 |
|---|---|---|---|---|---|---|---|
| Stocks | 1 | 29 | 73 | 95 | 28 | 1 | 1 |

| Rule | Stocks of 228 | short · Development (median, p10–p90, none) | short · Confirmation (median, p10–p90, none) | short · Whole window (median, p10–p90, none) | long · Development (median, p10–p90, none) | long · Confirmation (median, p10–p90, none) | long · Whole window (median, p10–p90, none) |
|---|---|---|---|---|---|---|---|
| score>=40 | 198 | 19, 11–27, 0% | 10, 5–18, 0% | 15, 8–27, 0% | 21, 9–33, 0% | 12, 6–24, 0% | 18, 8–32, 0% |
| score>=50 | 125 | 12, 6–17, 0% | 6, 3–12, 0% | 9, 5–17, 0% | 13, 6–22, 0% | 7.5, 4–15, 0% | 12, 5–20, 0% |
| score>=60 | 30 | 2, 1–4, 8.8% | 2, 0–4, 10% | 2, 1–4, 9.2% | 3, 1–7, 9.5% | 2, 1–4, 9.5% | 3, 1–6, 9.5% |
| score>=70 | 2 | 0, 0–1, 81.3% | 0, 0–0, 90% | 0, 0–1, 84.2% | 0, 0–1, 76.2% | 0, 0–1, 86.5% | 0, 0–1, 79.6% |
| score>70 (FI code) | 2 | 0, 0–1, 81.3% | 0, 0–0, 90% | 0, 0–1, 84.2% | 0, 0–1, 76.2% | 0, 0–1, 86.5% | 0, 0–1, 79.6% |
| CP: score>60 | 26 | 2, 0–4, 11.3% | 2, 0–3, 12.5% | 2, 0–4, 11.7% | 3, 0–6, 11.6% | 2, 0–4, 10.8% | 2, 0–6, 11.3% |
| CP: atrPct<=0.75 | 172 | 16.5, 9–26, 0% | 7.5, 3–17, 0% | 13.5, 5–25, 0% | 17, 7–30, 0% | 12, 4–23, 0% | 16, 6–29, 0% |
| CP: both | 16 | 1, 0–3, 21.3% | 1, 0–2, 40% | 1, 0–3, 27.5% | 1, 0–4, 25.9% | 1, 0–3, 29.7% | 1, 0–4, 27.1% |
| Speculator: atrPct>0.80 | 45 | 4, 1–8, 1.3% | 3, 0–6, 10% | 4, 1–7, 4.2% | 4, 1–9, 2% | 3, 1–6, 6.8% | 4, 1–8, 3.6% |

## Part D — squeeze against a stock's own history

**In plain terms.** Measured against each stock's own past rather than against the other stocks, the "squeezed" count now varies from session to session, from about a dozen names to nearly a hundred. Whether it tracks later market moves was not tested. It is a precondition only: a squeeze is not a Compression Breakout, which has no detector.

The band width is the repository's own `calculateBollingerBands(closes, 20, 2)` (`technicalCalculations.js:247`), called as the rankings producer calls it (`compute-index-intelligence.js:1000`) on the mapper's adjusted closes. The producer's percentile formula (`:1293`) is applied along each stock's own trailing 120 sessions (reading R-8).
- **The short window counts 90 of its 120 sessions** (14 Jul → 17 Nov). The stored series' first bar is 22 Dec 2025 (requested from 20 Dec), so the first 30 sessions lack 120 trailing sessions.
- **The long window counts all 221.**
- **The two bar sources agree exactly** on the 90 shared sessions.

**A precondition only.**

**short window, stored bars:** 90 sessions counted (all 228 with 120 trailing sessions); 30 not counted; eligible names per session 0–228.

| Period | Sessions | Median | p10–p90 | Min–max |
|---|---|---|---|---|
| Development | 50 | 62 | 42–84 | 38–98 |
| Confirmation | 40 | 49.5 | 16–69 | 12–73 |
| Whole window | 90 | 59.5 | 22–80 | 12–98 |

| Week of | Sessions | Median | Range |
|---|---|---|---|
| 2026-07-13 | 4 | 40 | 38–41 |
| 2026-07-20 | 5 | 62 | 49–63 |
| 2026-07-27 | 5 | 55 | 49–66 |
| 2026-08-03 | 5 | 49 | 43–62 |
| 2026-08-10 | 5 | 45 | 42–51 |
| 2026-08-17 | 5 | 51 | 43–62 |
| 2026-08-24 | 5 | 89 | 62–98 |
| 2026-08-31 | 5 | 84 | 80–87 |
| 2026-09-07 | 4 | 73.5 | 69–83 |
| 2026-09-14 | 5 | 77 | 76–82 |
| 2026-09-21 | 5 | 65 | 60–69 |
| 2026-09-28 | 5 | 61 | 59–66 |
| 2026-10-05 | 5 | 66 | 63–71 |
| 2026-10-12 | 5 | 70 | 54–73 |
| 2026-10-19 | 5 | 49 | 32–57 |
| 2026-10-26 | 5 | 22 | 19–26 |
| 2026-11-02 | 5 | 13 | 12–20 |
| 2026-11-09 | 5 | 24 | 18–30 |
| 2026-11-16 | 2 | 32 | 32–32 |

**long window, fetched bars:** 221 sessions counted (all 228 with 120 trailing sessions); 0 not counted; eligible names per session 228–228.

| Period | Sessions | Median | p10–p90 | Min–max |
|---|---|---|---|---|
| Development | 147 | 33 | 18–60 | 10–78 |
| Confirmation | 74 | 60.5 | 20–83 | 12–98 |
| Whole window | 221 | 40 | 18–69 | 10–98 |

| Week of | Sessions | Median | Range |
|---|---|---|---|
| 2025-12-29 | 1 | 78 | 78–78 |
| 2026-01-05 | 5 | 67 | 60–67 |
| 2026-01-12 | 5 | 54 | 44–68 |
| 2026-01-19 | 4 | 30.5 | 20–39 |
| 2026-01-26 | 5 | 16 | 15–22 |
| 2026-02-02 | 5 | 18 | 15–24 |
| 2026-02-09 | 5 | 18 | 13–20 |
| 2026-02-16 | 4 | 11.5 | 10–13 |
| 2026-02-23 | 5 | 18 | 14–20 |
| 2026-03-02 | 5 | 30 | 18–32 |
| 2026-03-09 | 5 | 42 | 36–45 |
| 2026-03-16 | 5 | 41 | 29–45 |
| 2026-03-23 | 5 | 30 | 28–31 |
| 2026-03-30 | 4 | 34 | 27–41 |
| 2026-04-06 | 5 | 36 | 30–42 |
| 2026-04-13 | 5 | 32 | 25–35 |
| 2026-04-20 | 5 | 27 | 24–33 |
| 2026-04-27 | 5 | 30 | 29–32 |
| 2026-05-04 | 5 | 46 | 38–50 |
| 2026-05-11 | 5 | 39 | 36–49 |
| 2026-05-18 | 5 | 45 | 38–45 |
| 2026-05-25 | 4 | 51.5 | 47–58 |
| 2026-06-01 | 5 | 44 | 42–50 |
| 2026-06-08 | 5 | 40 | 31–51 |
| 2026-06-15 | 4 | 31.5 | 28–35 |
| 2026-06-22 | 5 | 28 | 22–31 |
| 2026-06-29 | 4 | 24 | 22–26 |
| 2026-07-06 | 5 | 21 | 19–32 |
| 2026-07-13 | 5 | 40 | 37–41 |
| 2026-07-20 | 5 | 62 | 49–63 |
| 2026-07-27 | 5 | 55 | 49–66 |
| 2026-08-03 | 5 | 49 | 43–62 |
| 2026-08-10 | 5 | 45 | 42–51 |
| 2026-08-17 | 5 | 51 | 43–62 |
| 2026-08-24 | 5 | 89 | 62–98 |
| 2026-08-31 | 5 | 84 | 80–87 |
| 2026-09-07 | 4 | 73.5 | 69–83 |
| 2026-09-14 | 5 | 77 | 76–82 |
| 2026-09-21 | 5 | 65 | 60–69 |
| 2026-09-28 | 5 | 61 | 59–66 |
| 2026-10-05 | 5 | 66 | 63–71 |
| 2026-10-12 | 5 | 70 | 54–73 |
| 2026-10-19 | 5 | 49 | 32–57 |
| 2026-10-26 | 5 | 22 | 19–26 |
| 2026-11-02 | 5 | 13 | 12–20 |
| 2026-11-09 | 5 | 24 | 18–30 |
| 2026-11-16 | 2 | 32 | 32–32 |

The two sources on the same 90 sessions: stored median 59.5 (12–98), fetched median 59.5 (12–98); 0 sessions differ, by at most 0 names.

## Part E — seven slots from the universe

**In plain terms.** If an agent could pick from all 228 stocks, three archetypes could fill all seven opening slots with valid setups on most mornings: a Trend Follower, a Fundamental Investor at a score bar of 40, and a Diversifier. The archetypes with tight score or volatility rules cannot: the Speculator fills about three, the Capital Preserver about one, and the Fundamental Investor at a bar of 70 none. Requiring the setup to be brand new cuts these numbers sharply, and reading the Speculator's level as a quota rather than a gate on every slot raises its count to seven.

- **Mornings.** Each window session from the fourth onward that has a next open: 116 short, 217 long.
- **Candidates** come from all 228 at the prior close. A candidate is enterable when its next open is at or below its own limit.
- **Readings** (R-2): literal "valid at the prior close"; "turned valid at the prior close"; and the three-session shelf life.
- **Fill.** min(7, eligible names), except the Diversifier (R-4).
- **Gates** (the Speculator, Fundamental Investor and Capital Preserver rows) use today's scores, approximate. They apply each level to every slot (R-10). The quota reading is the last table below.
- **The Trend Follower's top sectors** use the frequency run's stand-in: the three sector funds with the best one-day move, any down more than 1% dropped.
- **The Capital Preserver's "at least 6 sectors"** rule, applied as a book rule, never binds: its row equals the plain row everywhere.
- **The Contrarian** is not applicable: it has no detector.

Whole window; each cell is the median slots filled · share of mornings filling all seven · share filling none.

| Archetype (gate) | Literal · short | Literal · long | Turned valid · short | Turned valid · long | Shelf life 3 · short | Shelf life 3 · long |
| --- | --- | --- | --- | --- | --- | --- |
| Trend Follower (no gate) | 7 · 96.6% · 0% | 7 · 97.2% · 0% | 7 · 61.2% · 0% | 7 · 64.5% · 0% | 7 · 94% · 0% | 7 · 92.6% · 0% |
| Trend Follower (top sectors) | 6 · 42.2% · 5.2% | 6 · 48.8% · 3.2% | 3 · 9.5% · 15.5% | 3 · 11.1% · 14.7% | 5 · 31% · 5.2% | 5 · 38.7% · 4.6% |
| Speculator | 3 · 12.1% · 4.3% | 4 · 18% · 4.1% | 1 · 0% · 27.6% | 1 · 0.5% · 25.3% | 3 · 6% · 6.9% | 3 · 10.1% · 7.4% |
| Fundamental Investor (>=40) | 7 · 92.2% · 0% | 7 · 92.2% · 0% | 6 · 46.6% · 1.7% | 7 · 51.2% · 0.9% | 7 · 86.2% · 0% | 7 · 86.6% · 0% |
| Fundamental Investor (>70) | 0 · 0% · 84.5% | 0 · 0% · 80.6% | 0 · 0% · 94.8% | 0 · 0% · 92.2% | 0 · 0% · 87.9% | 0 · 0% · 83.9% |
| Capital Preserver | 1 · 0% · 29.3% | 1 · 0% · 29% | 0 · 0% · 60.3% | 0 · 0% · 58.1% | 1 · 0% · 33.6% | 1 · 0% · 32.7% |
| Capital Preserver (6 sectors) | 1 · 0% · 29.3% | 1 · 0% · 29% | 0 · 0% · 60.3% | 0 · 0% · 58.1% | 1 · 0% · 33.6% | 1 · 0% · 32.7% |
| Diversifier (5 sectors) | 7 · 88.8% · 0% | 7 · 89.4% · 0% | 7 · 51.7% · 0% | 7 · 55.8% · 0% | 7 · 82.8% · 0% | 7 · 83.4% · 0% |
| Diversifier (code: 7 sectors) | 7 · 66.4% · 0% | 7 · 71.9% · 0% | 5 · 19.8% · 0% | 5 · 24.4% · 0% | 7 · 60.3% · 0% | 7 · 68.2% · 0% |
| Speculator, quota reading (R-10) | 7 · 63.8% · 0% | 7 · 66.4% · 0% | — | — | — | — |
| Fundamental Investor, quota reading (R-10) | 2 · 0% · 0% | 2 · 0% · 0% | — | — | — | — |
| Capital Preserver, quota reading (R-10) | 3 · 0% · 0% | 3 · 4.1% · 0% | — | — | — | — |

<details><summary>Part E, every reading by period, and the quota reading (median · all seven · at least four · none)</summary>

### Part E — short window (116 mornings)

**valid at the prior close (the prompt's words).** Slots of seven a valid, enterable setup could fill: median; share of mornings filling all seven, at least four, none.

| Archetype (gate) | Development | Confirmation | Whole window |
|---|---|---|---|
| Trend Follower (no gate) | 7 · 100% · 100% · 0% | 7 · 89.7% · 100% · 0% | 7 · 96.6% · 100% · 0% |
| Trend Follower (top sectors) | 7 · 55.8% · 89.6% · 0% | 4 · 15.4% · 59% · 15.4% | 6 · 42.2% · 79.3% · 5.2% |
| Speculator | 3 · 13% · 49.4% · 1.3% | 3 · 10.3% · 46.2% · 10.3% | 3 · 12.1% · 48.3% · 4.3% |
| Fundamental Investor (>=40) | 7 · 100% · 100% · 0% | 7 · 76.9% · 94.9% · 0% | 7 · 92.2% · 98.3% · 0% |
| Fundamental Investor (>70) | 0 · 0% · 0% · 81.8% | 0 · 0% · 0% · 89.7% | 0 · 0% · 0% · 84.5% |
| Capital Preserver | 1 · 0% · 3.9% · 22.1% | 1 · 0% · 2.6% · 43.6% | 1 · 0% · 3.4% · 29.3% |
| Capital Preserver (6 sectors) | 1 · 0% · 3.9% · 22.1% | 1 · 0% · 2.6% · 43.6% | 1 · 0% · 3.4% · 29.3% |
| Diversifier (5 sectors) | 7 · 100% · 100% · 0% | 7 · 66.7% · 100% · 0% | 7 · 88.8% · 100% · 0% |
| Diversifier (code: 7 sectors) | 7 · 87% · 100% · 0% | 5 · 25.6% · 84.6% · 0% | 7 · 66.4% · 94.8% · 0% |

**turned valid at the prior close.** Slots of seven a valid, enterable setup could fill: median; share of mornings filling all seven, at least four, none.

| Archetype (gate) | Development | Confirmation | Whole window |
|---|---|---|---|
| Trend Follower (no gate) | 7 · 75.3% · 98.7% · 0% | 5 · 33.3% · 69.2% · 0% | 7 · 61.2% · 88.8% · 0% |
| Trend Follower (top sectors) | 3 · 13% · 42.9% · 5.2% | 2 · 2.6% · 17.9% · 35.9% | 3 · 9.5% · 34.5% · 15.5% |
| Speculator | 1 · 0% · 11.7% · 24.7% | 1 · 0% · 7.7% · 33.3% | 1 · 0% · 10.3% · 27.6% |
| Fundamental Investor (>=40) | 7 · 58.4% · 89.6% · 0% | 4 · 23.1% · 56.4% · 5.1% | 6 · 46.6% · 78.4% · 1.7% |
| Fundamental Investor (>70) | 0 · 0% · 0% · 94.8% | 0 · 0% · 0% · 94.9% | 0 · 0% · 0% · 94.8% |
| Capital Preserver | 0 · 0% · 0% · 54.5% | 0 · 0% · 0% · 71.8% | 0 · 0% · 0% · 60.3% |
| Capital Preserver (6 sectors) | 0 · 0% · 0% · 54.5% | 0 · 0% · 0% · 71.8% | 0 · 0% · 0% · 60.3% |
| Diversifier (5 sectors) | 7 · 66.2% · 98.7% · 0% | 5 · 23.1% · 66.7% · 0% | 7 · 51.7% · 87.9% · 0% |
| Diversifier (code: 7 sectors) | 6 · 26% · 88.3% · 0% | 3 · 7.7% · 43.6% · 0% | 5 · 19.8% · 73.3% · 0% |

**three-session shelf life.** Slots of seven a valid, enterable setup could fill: median; share of mornings filling all seven, at least four, none.

| Archetype (gate) | Development | Confirmation | Whole window |
|---|---|---|---|
| Trend Follower (no gate) | 7 · 98.7% · 100% · 0% | 7 · 84.6% · 94.9% · 0% | 7 · 94% · 98.3% · 0% |
| Trend Follower (top sectors) | 6 · 44.2% · 83.1% · 0% | 3 · 5.1% · 48.7% · 15.4% | 5 · 31% · 71.6% · 5.2% |
| Speculator | 3 · 7.8% · 44.2% · 3.9% | 3 · 2.6% · 30.8% · 12.8% | 3 · 6% · 39.7% · 6.9% |
| Fundamental Investor (>=40) | 7 · 96.1% · 100% · 0% | 7 · 66.7% · 87.2% · 0% | 7 · 86.2% · 95.7% · 0% |
| Fundamental Investor (>70) | 0 · 0% · 0% · 87% | 0 · 0% · 0% · 89.7% | 0 · 0% · 0% · 87.9% |
| Capital Preserver | 1 · 0% · 0% · 26% | 1 · 0% · 0% · 48.7% | 1 · 0% · 0% · 33.6% |
| Capital Preserver (6 sectors) | 1 · 0% · 0% · 26% | 1 · 0% · 0% · 48.7% | 1 · 0% · 0% · 33.6% |
| Diversifier (5 sectors) | 7 · 97.4% · 100% · 0% | 7 · 53.8% · 94.9% · 0% | 7 · 82.8% · 98.3% · 0% |
| Diversifier (code: 7 sectors) | 7 · 81.8% · 97.4% · 0% | 5 · 17.9% · 82.1% · 0% | 7 · 60.3% · 92.2% · 0% |

**Post review — the code's levels read as quotas over the seven slots** (literal reading; not a fixed figure; median · all seven · at least four · none).

| Archetype (quota) | Development | Confirmation | Whole window |
|---|---|---|---|
| Speculator (at least 3 with ATR percentile > 0.80) | 7 · 64.9% · 100% · 0% | 7 · 61.5% · 100% · 0% | 7 · 63.8% · 100% · 0% |
| Fundamental Investor (at least 5 > 70, none < 40) | 2 · 0% · 0% · 0% | 2 · 0% · 0% · 0% | 2 · 0% · 0% · 0% |
| Capital Preserver (at least 5 > 60, none with ATR percentile > 0.75; sectors not applied) | 3 · 0% · 45.5% · 0% | 3 · 0% · 17.9% · 0% | 3 · 0% · 36.2% · 0% |

Contrarian: not applicable (no detector).

### Part E — long window (217 mornings)

**valid at the prior close (the prompt's words).** Slots of seven a valid, enterable setup could fill: median; share of mornings filling all seven, at least four, none.

| Archetype (gate) | Development | Confirmation | Whole window |
|---|---|---|---|
| Trend Follower (no gate) | 7 · 98.6% · 100% · 0% | 7 · 94.5% · 100% · 0% | 7 · 97.2% · 100% · 0% |
| Trend Follower (top sectors) | 7 · 55.6% · 86.1% · 0.7% | 5 · 35.6% · 75.3% · 8.2% | 6 · 48.8% · 82.5% · 3.2% |
| Speculator | 4 · 22.9% · 54.2% · 2.8% | 3 · 8.2% · 46.6% · 6.8% | 4 · 18% · 51.6% · 4.1% |
| Fundamental Investor (>=40) | 7 · 94.4% · 99.3% · 0% | 7 · 87.7% · 97.3% · 0% | 7 · 92.2% · 98.6% · 0% |
| Fundamental Investor (>70) | 0 · 0% · 0% · 77.8% | 0 · 0% · 0% · 86.3% | 0 · 0% · 0% · 80.6% |
| Capital Preserver | 1 · 0% · 12.5% · 27.8% | 1 · 0% · 4.1% · 31.5% | 1 · 0% · 9.7% · 29% |
| Capital Preserver (6 sectors) | 1 · 0% · 12.5% · 27.8% | 1 · 0% · 4.1% · 31.5% | 1 · 0% · 9.7% · 29% |
| Diversifier (5 sectors) | 7 · 93.1% · 100% · 0% | 7 · 82.2% · 100% · 0% | 7 · 89.4% · 100% · 0% |
| Diversifier (code: 7 sectors) | 7 · 83.3% · 97.2% · 0% | 6 · 49.3% · 91.8% · 0% | 7 · 71.9% · 95.4% · 0% |

**turned valid at the prior close.** Slots of seven a valid, enterable setup could fill: median; share of mornings filling all seven, at least four, none.

| Archetype (gate) | Development | Confirmation | Whole window |
|---|---|---|---|
| Trend Follower (no gate) | 7 · 72.2% · 91% · 0% | 6 · 49.3% · 82.2% · 0% | 7 · 64.5% · 88% · 0% |
| Trend Follower (top sectors) | 3 · 11.8% · 45.8% · 10.4% | 3 · 9.6% · 28.8% · 23.3% | 3 · 11.1% · 40.1% · 14.7% |
| Speculator | 1 · 0.7% · 13.2% · 22.9% | 1 · 0% · 8.2% · 30.1% | 1 · 0.5% · 11.5% · 25.3% |
| Fundamental Investor (>=40) | 7 · 60.4% · 84.7% · 0% | 5 · 32.9% · 71.2% · 2.7% | 7 · 51.2% · 80.2% · 0.9% |
| Fundamental Investor (>70) | 0 · 0% · 0% · 91.7% | 0 · 0% · 0% · 93.2% | 0 · 0% · 0% · 92.2% |
| Capital Preserver | 0 · 0% · 2.1% · 54.9% | 0 · 0% · 0% · 64.4% | 0 · 0% · 1.4% · 58.1% |
| Capital Preserver (6 sectors) | 0 · 0% · 2.1% · 54.9% | 0 · 0% · 0% · 64.4% | 0 · 0% · 1.4% · 58.1% |
| Diversifier (5 sectors) | 7 · 65.3% · 90.3% · 0% | 6 · 37% · 80.8% · 0% | 7 · 55.8% · 87.1% · 0% |
| Diversifier (code: 7 sectors) | 6 · 29.2% · 82.6% · 0% | 4 · 15.1% · 63% · 0% | 5 · 24.4% · 76% · 0% |

**three-session shelf life.** Slots of seven a valid, enterable setup could fill: median; share of mornings filling all seven, at least four, none.

| Archetype (gate) | Development | Confirmation | Whole window |
|---|---|---|---|
| Trend Follower (no gate) | 7 · 93.8% · 99.3% · 0% | 7 · 90.4% · 97.3% · 0% | 7 · 92.6% · 98.6% · 0% |
| Trend Follower (top sectors) | 6 · 45.8% · 75% · 2.8% | 5 · 24.7% · 67.1% · 8.2% | 5 · 38.7% · 72.4% · 4.6% |
| Speculator | 3 · 13.9% · 42.4% · 6.3% | 3 · 2.7% · 37% · 9.6% | 3 · 10.1% · 40.6% · 7.4% |
| Fundamental Investor (>=40) | 7 · 90.3% · 99.3% · 0% | 7 · 79.5% · 93.2% · 0% | 7 · 86.6% · 97.2% · 0% |
| Fundamental Investor (>70) | 0 · 0% · 0% · 81.9% | 0 · 0% · 0% · 87.7% | 0 · 0% · 0% · 83.9% |
| Capital Preserver | 1 · 0% · 7.6% · 31.9% | 1 · 0% · 0% · 34.2% | 1 · 0% · 5.1% · 32.7% |
| Capital Preserver (6 sectors) | 1 · 0% · 7.6% · 31.9% | 1 · 0% · 0% · 34.2% | 1 · 0% · 5.1% · 32.7% |
| Diversifier (5 sectors) | 7 · 88.2% · 99.3% · 0% | 7 · 74% · 97.3% · 0% | 7 · 83.4% · 98.6% · 0% |
| Diversifier (code: 7 sectors) | 7 · 81.9% · 95.8% · 0% | 6 · 41.1% · 89% · 0% | 7 · 68.2% · 93.5% · 0% |

**Post review — the code's levels read as quotas over the seven slots** (literal reading; not a fixed figure; median · all seven · at least four · none).

| Archetype (quota) | Development | Confirmation | Whole window |
|---|---|---|---|
| Speculator (at least 3 with ATR percentile > 0.80) | 7 · 67.4% · 100% · 0% | 7 · 64.4% · 100% · 0% | 7 · 66.4% · 100% · 0% |
| Fundamental Investor (at least 5 > 70, none < 40) | 2 · 0% · 5.6% · 0% | 2 · 0% · 0% · 0% | 2 · 0% · 3.7% · 0% |
| Capital Preserver (at least 5 > 60, none with ATR percentile > 0.75; sectors not applied) | 3 · 6.3% · 43.8% · 0% | 3 · 0% · 35.6% · 0% | 3 · 4.1% · 41% · 0% |

Contrarian: not applicable (no detector).

</details>

## Requests

**In plain terms.** The one fetch the prompt allows used 241 of its 260 requests, after the close, with none failing. Nothing was read from production and no model was called.

- **EODHD: 241 requests of the 260 cap, 0 failed** (MEASURED, `requests.json` in the run folder).
  - **When:** 22:27:01 → 22:27:15 UTC on 18 Nov (5:27 PM ET, after the close). The script refuses to start inside a session's hours and checks the hours before every request.
  - **What:** one long series per symbol, 1 Nov 2024 → 17 Nov 2026, for the frequency run's 241 symbols. Each came back with 512 rows, except CRWV with 413 (listed March 2025).
  - Each place was written to disk before its request.
  - The fetched bars already reach 1 Nov 2024, so a 2025 replay would need the calendar change, not a new fetch.
- **Hardened after the review.** The script now takes its lock before it reads the counter, and counts the cap across every run folder. The run itself used the version at `30954dc2`. Only one run folder exists, and its 241 log entries match its 241 bar files.
- **Production: no read.** Everything else is the frequency run's local export.
- **No model call.**

## Limits

**In plain terms.** The check is narrow: one year of one survivor-biased list, on paper, with no costs. Its intervals are a little optimistic, and with so many split labels a few are expected to be wrong by chance.

- **Survivors.** The 228 are today's ranked list applied to past sessions, which favours names that did well.
- **One year.** Both windows lie in 2026, because the calendar of record stops at 2 Jan 2026. There is no 2025 or older stretch and no long bear market.
- **No costs, no delayed quotes, daily bars.** The barrier's order inside a session is unknown, so the adverse side is counted first.
- **Today's scores** apply to every past session (the archetype splits in Part A, and Parts C and E).
- **The intervals are somewhat narrow.** Adjacent sessions' three-session windows overlap. The overlap sensitivity shows the headline labels hold, and the post-hoc January–May "worse" does not.
- **Many labels.** Ten splits, each against two groups over two horizons and three periods, make 120 split labels a window at 90%. Some "better" or "worse" labels among them are expected by chance. The headline is one comparison named in advance.
- **The one-day unit is used for three sessions,** since the 3-day scaled unit is not adopted.
- **Reconstruction.** Every bar was fetched on 17–18 Nov. The stored series read 17 Nov's bar in preliminary form, and the short window uses it as stored, as the prompt asks. That bar feeds the one-session game from 16 Nov and the three-session game from 12 Nov. In the review, replacing it with the final bar changed no verdict and no label; a few third-decimal interval ends moved.
- **G3 (extended) is small** once the entry filter applies (34 short, 69 long); its rows are labelled small.

## Surprises

**In plain terms.** Six results that the setup's design does not lead you to expect. The first two bear most directly on trader v1.

1. **The setup's own three-session average is about zero.** Where it beats G2, G2 is lagging. On the same sessions, uptrending names with no setup trailed every stock by about 0.15 units over three sessions (short window), while the setup itself matched every stock (−0.005).
2. **The two pre-named windows disagree.** The short window reads better against G2 (+0.146); all of 2026 reads no clear difference (+0.027). Neither window's confirmation agrees with its development. A January–May row added afterwards has a negative estimate (−0.11), but that does not survive the overlap sensitivity.
3. **Breakout is limited by its pattern, not its limit.** With no limit at all the median is 1 valid breakout a morning. The looser candidate sets did worse than an average stock over three sessions (short L3–L5; long L2–L4).
4. **The entry filter removes 38% of G2** (1,851 of 4,840, short window). Many "uptrend, no setup" names open above the extension limit; they are already extended.
5. **The calendar of record stops at 2 Jan 2026,** so the long window holds 221 sessions, not 500.
6. **The squeeze count swings between about 10 and 98 names** once each stock is measured against its own history, where the cross-sectional reading was fixed at 47.

## Founder questions (only where a number forces a choice)

**In plain terms.** Five choices that these numbers force. Each can be answered in a line.

1. **Pullback and Resume does not reliably beat an ordinary day.**
   - Against every stock: no clear difference in both windows (−0.005 and −0.033 units).
   - Against uptrending names: better in the short window (+0.146) and no clear difference across 2026 (+0.027).

   Should trader v1 still launch with a valid setup as the entry gate, as a framing of the agent's choice rather than an edge? Or wait for a detector that measures better?
2. **Trend Breakout.** No extension limit makes it common: at most a median of 1 a morning, even with no limit. Leave it off the launch menu, or task a recount with a different volume or high condition (a new `SETUP_VERSION`)?
3. **What "fresh" and the archetype levels mean for the seven-slot count.**
   - Taken literally ("valid at the prior close"), the Speculator fills 3 slots and the Capital Preserver 1. Counting only names that turned valid at that close, they fill 1 and 0.
   - Read as the code's quotas (R-10) rather than a gate on every slot, the Speculator fills all seven on 64% of mornings.

   Which readings do you mean?
4. **The Capital Preserver and the Fundamental Investor above 70.**
   - A gate on every slot: on a typical morning they fill 1 and 0 of seven slots with valid setups.
   - Read as quotas: a median of 3 and 2, and almost never all seven.

   Let them hold names with no setup? Drop the setup requirement for them? Or change their score bars (`archetypeScoring.js`, a fenced file)?
5. **A longer test.** The two pre-named windows disagree: the short window reads better, all of 2026 no clear difference. A January–May row added afterwards has a negative estimate, though not a robust one. Going back before 2026 needs the market calendar extended (`src/utils/marketCalendar.js:69`, a product change); the bars are already fetched. Is a 2025 replay worth that change before launch?

## Files

**In plain terms.** Five small scripts do the work in order: fetch, re-run the replay, analyse, render the tables. All but the fetch run offline and give the same output every time from the same inputs.

| File | What it does |
|---|---|
| `scripts/experiments/setup-payoff/lib.mjs` | `DEFINITIONS` (fixed before results), the run folder, the write-verb grep (a tripwire: it also refuses a store path, a raw request and a Google Cloud client), sessions, the seeded resampling and the labels |
| `scripts/experiments/setup-payoff/fetchLong.mjs` | The one optional fetch: the cap across run folders, the counter, the lock, the market-hours check |
| `scripts/experiments/setup-payoff/enrich.mjs` | Re-runs the frequency run's replay module and keeps each record's facts |
| `scripts/experiments/setup-payoff/analyze.mjs` | Step 0 (first, against `replay.json` itself), the overlap check, Parts A–E, the post-hoc row, the overlap sensitivity and the quota reading; `summary.json` |
| `scripts/experiments/setup-payoff/tables.mjs` | Renders `summary.json` as the report's tables (`tables.md`) |
| `docs/audits/20261118_SETUP_PAYOFF_CHECK_REVIEW.md` | The BUILD_RULES §2 review record |

**Re-running** (from the repo root; the run folder defaults to `C:/Users/fashr/Documents/FantasyTrades/SetupPayoff/run-20261118`, the frequency run's folder is read only, and `--run` must be absolute):
1. `fetchLong.mjs`
2. `enrich.mjs --source stored --shard k --of 6` and `--source fetched` for k = 0…5. Use `node --max-old-space-size=600`, at most six at a time.
3. `analyze.mjs`
4. `tables.mjs`
