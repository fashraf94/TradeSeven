# Scoring shape and the three-day threshold unit — measurement (read-only)

**Date:** Wednesday 18 Nov 2026 (run after the close) · **Run by:** Claude Code (Opus 5.5), local session · **Prompt:** *Experiment prompt — the scoring shape and the threshold unit for the 3-day game* (Fable, the BaggerBomb revamp chat, 18 Nov 2026; supersedes the unrun Nov 16 prompt) · **Branch:** `claude/scoring-shape-three-day-unit`, cut from `origin/main` at `bd841257` · **Scripts:** `scripts/experiments/scoring-shape/` · **Review:** `docs/audits/20261118_SCORING_SHAPE_AND_THREE_DAY_UNIT_REVIEW.md` · **Out-of-tree copy:** `C:/Users/fashr/Documents/FantasyTrades/ScoringShape/20261118_SCORING_SHAPE_AND_THREE_DAY_UNIT.md` (BUILD_RULES §3).

This report measures. It rules on nothing and changes no product code. No policy file is drafted.

## What the founder is deciding (recorded verbatim from the prompt, §1)

> Adopted so far (15–16 Nov 2026): ranked matches run 3 trading days and practice runs 1 day (BB-3). The 3-day game counts thresholds from entry with a unit scaled to three days (Q7, Q8). Bonuses bank on exit, not on touch, and the end of the match counts as an exit (BB-8, Q17).
>
> Reopened by the founder on 18 Nov 2026:
>
> 1. **Scoring moments.** Thresholds that span three days from entry pay far fewer bonuses per day than thresholds that reset every day.
> 2. **The snap exit.** If a bonus banks only on exit, players and agents will sell the moment a stock crosses its BaggerBomb line.
> 3. **His proposed fix:** an added bonus for staying in a position that holds above its line, so that staying or banking is a real choice.
> 4. **Match length:** one day or three.
>
> This task measures those four. It rules on none of them.

## Summary table — shape × unit

Each cell gives three things:
1. Bonuses banked per 7-position match.
2. The share of match-days with at least one bonus.
3. The snap-exit verdict: which policy wins on average, with SELL's mean margin over HOLD per Support position. Margins are given for V2's window (39 entry sessions) / the long window (174).

The verdict words:
- **HOLD** or **BELL**: SELL clearly loses (best in at most 7% of resamples of whole entry sessions).
- **even**: no clear winner.
- **SELL**: SELL clearly wins.

The first two figures come from V2's window: 8,892 holds and 15,600 seeded matches, entries 22 Sep → 13 Nov 2026, fill at the open.

| Shape | U1 — today's one-day unit, unscaled | U4 — × √3 | U6 — measured 3-session range | **U5 — × 2 (recommended, open fill)** |
|---|---|---|---|---|
| **Baseline: today's one-day game** (V2 unit, touch) | 0.98 · 47% · HOLD (−11.4 / −8.7) | | | |
| One-day game, exit only (practice under BB-8) | 0.51 · 27% · **SELL (+1.2 / +4.1)** | | | |
| **S1** touch (today) | 5.21 · 62% · HOLD (−29.7 / −28.3) | 1.57 · 28% · HOLD (−11.1 / −15.0) | 1.55 · 28% · HOLD (−12.2 / −15.0) | 1.01 · 20% · HOLD (−9.7 / −13.8) |
| **S2** exit only (BB-8 as adopted) | 2.68 · 24% · HOLD/BELL (−7.5 / −7.0) | 0.76 · 13% · even (+3.1 / −1.1) | 0.75 · 12% · even (+2.4 / −1.3) | 0.47 · 9% · even (+4.2 / −0.6) |
| **S3** at the bell | 3.31 · 45% · HOLD (−12.3 / −11.1) | 0.88 · 18% · even (+1.1 / −3.1) | 0.88 · 18% · even (+0.2 / −3.3) | 0.55 · 12% · even (+2.4 / −2.2) |
| **S4** bell + carry, C = 5 | 3.31 · 45% (52% with carries) · HOLD (−17.4 / −16.0) | 0.88 · 18% (21%) · HOLD (−2.7 / −7.0)\* | 0.88 · 18% (21%) · HOLD (−3.6 / −7.2)\* | 0.55 · 12% (15%) · HOLD (−1.2 / −5.9)\* |
| **S4** C = 10 | same counts · HOLD (−22.5 / −20.8) | same · HOLD (−6.6 / −11.0) | same · HOLD (−7.5 / −11.2) | same · HOLD (−4.8 / −9.7) |
| **S4** C = 15 | same counts · HOLD (−27.5 / −25.6) | same · HOLD (−10.4 / −14.9) | same · HOLD (−11.3 / −15.1) | same · HOLD (−8.5 / −13.4) |
| **S5** daily reset, on touch (dormant legacy) | 5.40 · 60% · HOLD (−21.1 / −19.1) | one-day unit only | | |
| **S5** daily reset, at each close | 2.93 · 38% · BELL (−3.0 / −1.5) | one-day unit only | | |

\* At C = 5, V2's window is within noise (SELL best in 15–34% of resamples). The long window is clear (0%).

**The recommended unit depends on the fill** (§4). With the open fill used throughout, U5 (×2) matches V2's one-day rarity. With the prior-close fill V2 uses for a battle created out of hours, U4 (×√3) or U6 does.

## In plain terms

- **V2 reproduced.** Its published one-day figures come back bit-exact from its own inputs (228 of 228). Rebuilt from the bars on disk, three stocks miss the tolerance set beforehand. In every case the provider finalised the 12 Oct bar after V2 read it (§3).
- **The unit that keeps V2's rarity is ×2 if a match fills at the open, and about ×√3 if it fills at the prior close.**
  - From the open: a stock touches its one-day +1.0 line in 10.7% of sessions. Over three sessions, ×2 (U5) gives 11.0%, ×√3 (U4) 16.4%, the measured three-session range (U6) 16.1%, and the unscaled unit 41.0%. The exact match is ×2.03, and ×1.97 over March–November.
  - From the prior close, with the opening gap counted as V2 counts it out of hours: the exact match is ×1.83 (×1.77 over March–November), and the rule picks U6 or U4.
  - The fill convention for ranked matches must be fixed before the unit (§4, FQ-8).
- **Every three-day shape on a scaled unit has fewer scoring moments than today's game.**
  - Today's game banks a bonus on 47% of match-days. On U5 the three-day shapes bank on 9% (exit only) to 20% (touch).
  - 68–72% of three-day matches on U5 bank no bonus at all under exit-only or at-the-bell, against 53% of today's one-day matches (§5).
- **In the three-day game, no shape makes selling at the line a clear winner** (§6).
  - Exit-only (S2) and at-the-bell (S3) on the wider units come out even. SELL leads by up to 4.2 points per Support position over V2's window and trails by up to 3.3 over the long window, and no lead clears the noise.
  - Selling clearly loses under today's touch rule, on the unscaled unit, under the daily reset on touch, and under the bell with a carry. With C = 10 or 15 that holds on every unit and in both windows. With C = 5 it holds on the long window.
- **In the one-day game, exit-only does make selling at the line pay.** Over March–November, selling at the +1.0 line beats holding to the close by +4.1 points per Support position, interval +2.0 to +6.1, in 100% of resamples. Under today's touch rule the same sale loses 8.7 points. If BB-8 applies to one-day practice, the snap exit shows up there (§6).
- **One day against three.**
  - Three re-entered one-day matches pay 0.97 bonuses a day (0.82 over March–November). One three-day match on U5 pays 0.34 a day under touch (0.27), and 0.16–0.18 under exit-only or at-the-bell (0.13–0.15).
  - The two overnight gaps supply 28.5% of a three-day match's variance (27.6%). Removing them flips the sign of 16% of matches (17%).
  - On U5, about 17.5% of bonus first-touches after day 1 happen at the open (§7).
- **The 15-minute check sees about 85% of the +1.0 touches that daily highs show** (23 of 27 on real checks; 58 of 70 on a larger 10-minute-bar sample). Touch-based figures here are that much too high for the game. Close-based shapes are unaffected, except that the last check comes about 14 minutes before the close (§4).
- **No market-data request and no production read.** Every input was already on this machine.

## Preamble

- **Session opening (BUILD_RULES §2, §3).** `git fetch origin` ran first. `origin/main` = `bd841257`. Branch `claude/scoring-shape-three-day-unit` cut from it, HEAD `bd841257`, tree clean. The fetch was repeated before the report was written: `origin/main` still `bd841257`.
- **Model.** The prompt names Opus; this session ran on Opus 5.5.
- **New files only:** nine scripts under `scripts/experiments/scoring-shape/`, this report and its review record. No scorer, threshold model, admission, measurement, policy, registry, pin, flag, rule or test file changed.
- **Fenced functions (BUILD_RULES §1).** Called, never edited: `calculateAssetScoreServer` (`api/_utils/agentScoring.js:225`), on both its measured branch (`:226`, into `calculateAssetScoreV3`) and its legacy branch (the S5 cross-check). No legacy archetype table is imported (§2.3 ratchet untouched).
- **Also called, not fenced, not changed:** `stockRewardContext` and `STOCK_MODEL` (`src/utils/stockThresholdModel.js:7`, `:62`), `calculateMeasuredATR` and `normalizeRawSnapshot` (`api/_utils/measuredStockThreshold.js:73`, `:48`), `effectiveStockPercentage` (`api/_utils/stockThresholdAdmission.js:11`), and the canonical constants `THRESHOLD_POINTS` and `CONVICTION_MULTIPLIERS` (`src/constants/baggerBombScoring.js:33`, `:56`).
- **No scoring math is copied (BUILD_RULES §4).**
  - Every unit comes from the V2 calculator. Every unit is quantised by admission's own function.
  - Every tier crossing is decided by `stockRewardContext`. Every position total is the fenced scorer's.
  - The scripts choose only which prices the model is shown: the shape's touch record. Precedent: replay-pack ruling Q20, *"A script may hand the real scorer a reset touch record"* (`docs/audits/20261115_REPLAY_PACK_TRADER_GAME.md:26`).
  - The S4 carry is a parameter of the shape under test. It exists in no scorer and is added outside it.
- **A synthetic battle passes the scope guard.** To call `stockRewardContext` for any anchor and unit, the scripts build a one-position battle that passes `validateStockReceipt`. Its `duration` is `'fullday'` only because the measured route refuses anything else (`src/utils/stockThresholdModel.js:30`). The levels it returns depend on the anchor and the unit alone.
- **Production:** not read and not written. No Firestore import exists in the scripts.
- **Market data:** 0 EODHD requests (§8).
- **Account ids:** none. The film tape in the replay export is already pseudonymised (`battle-NNN`, `acct-NN`); no id or ordinal is printed by any script or in this report.
- **Markers.** Every `file:line` in this report was read at `bd841257` in this session (VERIFIED). MEASURED marks a figure produced by a script in this run.

## 3. Step 1 — how V2's one-day unit was chosen, and the reproduction

### How it was chosen, in plain words

- **What is measured.** One day's typical range: the simple average of the last 14 daily true ranges, divided by the last close, on fully adjusted prices. A true range is the larger of the day's high-to-low and the gap from the prior close to either extreme.
  - Formula: `api/_utils/measuredStockThreshold.js:76–78`, for example `:77` — `const atr14Dollars = trueRanges.reduce((sum, tr) => sum + tr, 0) / 14;`.
  - Spec: `docs/specs/BAGGERBOMB_THRESHOLD_CORRECTION_SPEC_V1_1_20261012.md`, decision D1. Wilder smoothing, percentile ranks, blends and extra multipliers were excluded.
- **Window.** The 15 consecutive completed sessions ending at the last completed session before the position is committed. V2 policy: `"requiredConsecutiveSessionBars": 15` (`docs/specs/BAGGERBOMB_STOCK_THRESHOLDS_POLICY_V2_20261015.json:23`).
- **Entry rule.** The unit is frozen at the validated fill and counted from the fill for the position's life (`"anchor": "validated_position_entry_or_swap_fill"`, `"freeze": "position_lifetime"`, policy `:58–59`). It is quantised once, to six decimals, half-even (`api/_utils/stockThresholdAdmission.js:13`). Levels sit at ±1.0, 1.5 and 2.0 units from the fill (`src/utils/stockThresholdModel.js:72`).
- **Universe.** The ranked catalogue on 12 Oct 2026. 228 of 239 entries qualified; 8 discontinued or reused symbols and 3 configured exclusions were set aside (`docs/audits/BAGGERBOMB_MEASUREMENT_CLOSEOUT_20261012.md`).
- **The criteria were about measurement, not gameplay.** The unit was accepted because:
  - its arithmetic matched an independent decimal reference on all 229 complete windows;
  - its inputs and identities qualified;
  - its publication timing met the provider's 15-minute rule.

  The bounds decision (D3) adopted no floor or cap; a 1% floor would have moved one stock, BRK-B. **V2 was not calibrated to a bonus frequency.** It published no touch rates. The one-session touch rates below are measured here for the first time, from the same 228 stocks.
- **What V2 published.** One cross-section, the session of 12 Oct 2026:

| Statistic over the 228 qualified stocks | Published |
|---|---|
| Minimum (BRK-B) | 0.9581309339810106% |
| Median (middle-pair mean) | 2.3356234754480862% |
| 95th percentile (nearest rank; ACN) | 4.623061120012764% |
| Maximum (BE) | 7.825987494280925% |
| UNP / HUM / ACN | 1.3613716964571096% / 4.529210743120777% / 4.623061120012764% |

### The reproduction

Script: `step1Reproduce.mjs`. Tolerance, fixed before the run:
- each stock within 0.5% relative of V2's value;
- each of the four statistics within 0.01 percentage points.

| Check | Result (MEASURED) |
|---|---|
| (a) V2's own 12 Oct export through today's calculator | **228 of 228 bit-exact**; all four statistics and UNP / HUM / ACN bit-exact |
| (b) The 17 Nov bars on disk, cut at 12 Oct | 225 of 228 within 0.5%; 71 bit-exact; median gap 0.00004 points. **Misses: NUE 0.86%, SPG 0.62%, BRK-B 0.504%.** All four statistics within 0.005 points of the published values |
| (c) Diagnosis, added after (b) missed; the tolerance was not changed | 131 of the 228 stocks' 12 Oct bars changed after V2's capture. V2 read them about two hours after the close, and the provider then finalised the session high or low (NUE's low 250.66 → 249.54). With V2's own 12 Oct bar put back, **all 228 fall within tolerance** (largest gap 0.157%; 129 bit-exact). The remaining small gaps are revisions of older bars. No adjustment factor varies within a window, so dividends and splits move nothing. **Disclosed:** this uniformity test was first run with a spread limit of 1e-9 and flagged 68 stocks. EODHD gives `adjusted_close` to four decimals, so a uniform factor still differs row to row by about 1e-6. The limit was then set to 0.01%, well below a dividend step of about 0.5%. That limit was chosen after the first run; the per-stock tolerance was never changed |

**Verdict: reproduced.** The published figures come back exactly from V2's inputs. The bars this study uses measure V2's unit. The only gaps come from the provider finalising the 12 Oct bar after V2's capture, an effect the setup-frequency count also recorded (`docs/audits/20261117_SETUP_FREQUENCY_COUNT.md`, §1). It is not a STOP: the published figures reproduced. The three per-stock misses are listed here, not hidden.

## 4. Step 2 — the unit

### The holds

Script: `buildHolds.mjs` (MEASURED).
- **Universe:** V2's 228 stocks.
- **Bars:** the 17 Nov setup-frequency export (one EODHD series per stock, 20 Dec 2025 → 17 Nov 2026), fully adjusted by V2's own normaliser. Bars before 2026 are not used, because the pinned calendar maintains 2026–2027 only (`src/utils/marketCalendar.js:69`).
- **Entry:** the fill is the open of entry session t. The one-day unit comes from the 15 bars ending at t−1, so there is no look-ahead. From the same fill, every entry gets:
  - a one-session hold (session t);
  - a three-session hold (t, t+1, t+2).
- **Window ("V2's sessions plus every session since"):** read here as entries from 22 Sep 2026, the first session of V2's published window, to 13 Nov 2026, the last entry whose three sessions end on the last session on disk (17 Nov).
  - That is **39 entry sessions and 8,892 holds**; no stock or session was skipped.
  - 18 Nov was not fetched (§8).
  - A longer window, 10 Mar → 13 Nov (174 sessions, 39,672 holds), is run as a check.
- **U6:** the V2 calculator run on 15 non-overlapping three-session bars ending at t−1 (45 sessions back): 14 three-session true ranges, averaged, divided by the last close.
- **Units U2–U5** scale the measured one-day unit before admission's 6-decimal quantisation, as admission would quantise an effective unit once.

**The recommendation rule, fixed before any result was seen** (`lib.mjs`, `RECOMMENDATION_RULE`): the candidate whose three-session +1.0 touch rate on daily highs is nearest V2's one-session +1.0 touch rate on the same entries. Ties go to the smaller mean gap over all six tiers.

### Touch on daily highs and lows, from the entry open (MEASURED, `step2Units.mjs`)

| Hold and unit | Median unit | +1.0 | +1.5 | +2.0 | −1.0 | −1.5 | −2.0 |
|---|---|---|---|---|---|---|---|
| **V2 one session (U1)** | 2.61% | **10.7%** | 2.6% | 0.8% | 11.0% | 3.2% | 1.0% |
| U1 × 1, three sessions | 2.61% | 41.0% | 22.5% | 11.0% | 34.1% | 17.4% | 8.8% |
| U2 × 1.25 | 3.26% | 30.9% | 13.6% | 5.2% | 24.8% | 10.5% | 4.4% |
| U3 × 1.5 | 3.92% | 22.5% | 7.6% | 2.7% | 17.4% | 6.2% | 2.3% |
| U4 × √3 | 4.52% | 16.4% | 4.6% | 1.2% | 12.7% | 3.9% | 1.2% |
| **U5 × 2** | 5.22% | **11.0%** | 2.7% | 0.7% | 8.8% | 2.3% | 0.7% |
| U6 measured three-session range | 4.56% | 16.1% | 4.6% | 1.3% | 12.5% | 3.7% | 1.4% |

**Recommended: U5.** Its gap to V2's +1.0 rate is 0.4 points. The others are U1 30.3, U2 20.3, U3 11.8, U4 5.8 and U6 5.5. The exact multiple of the one-day unit that matches V2's +1.0 rate is **×2.03**, read off the real model's own `maxMultiplier`. U5's other tiers also sit close to V2's: +1.5 2.7% against 2.6%, +2.0 0.7% against 0.8%. Its penalties are a little rarer: −1.0 8.8% against 11.0%.

**The long window agrees** (MEASURED, 39,672 holds): V2's one-session +1.0 rate is 9.2%; U5 8.9%, U4 13.2%, U6 11.9%. Recommended again: U5, exact multiple ×1.97.

### The answer depends on where a match fills (sensitivity, added after the first run)

V2 fills a battle created out of hours at the prior close, so the opening jump counts as movement after the fill (policy `offHoursCreation`, Ruling 7: `"openingJump": "post_fill_movement"`, `docs/specs/BAGGERBOMB_STOCK_THRESHOLDS_POLICY_V2_20261015.json:97`). A battle created during the session fills at the live price. Re-running Step 2 with every hold filled at the close of t−1 (`step2Units.mjs --fill prior_close`; the unit is unchanged) moves the answer:

| Fill | V2 one-session +1.0 | U4 × √3 | U5 × 2 | U6 measured | Rule picks | Exact multiple |
|---|---|---|---|---|---|---|
| Open, V2's window (primary) | 10.7% | 16.4% | 11.0% | 16.1% | **U5** | ×2.03 |
| Open, long window | 9.2% | 13.2% | 8.9% | 11.9% | **U5** | ×1.97 |
| Prior close, V2's window | 17.1% | 19.2% | 13.7% | 19.0% | **U6** (U4 0.2 points behind) | ×1.83 |
| Prior close, long window | 15.0% | 15.7% | 11.0% | 14.2% | **U4** (U6 0.1 points behind) | ×1.77 |

**Plain reading.** A match that starts at the open needs about twice the one-day unit to keep V2's rarity. A match that starts from the prior close, with the opening gap counted, needs about √3 times. The opening gap is one more overnight move on the one-day side, and it adds proportionally more to a one-session hold than to a three-session one. The unit cannot be chosen without first fixing how a ranked match fills (FQ-8). Steps 3–5 use the open fill throughout. U4 and U6 appear in every one of their tables, so the prior-close candidates' shape and snap-exit figures are already there, though measured from the open.

### Cleared at a close

| Hold and unit | +1.0 | +1.5 | +2.0 | −1.0 | −1.5 | −2.0 |
|---|---|---|---|---|---|---|
| **V2 one session (U1): the close** | 5.4% | 1.4% | 0.4% | 5.2% | 1.5% | 0.5% |
| U1: any of the three closes / the end close | 27.5% / 21.9% | 13.3% / 11.0% | 6.3% / 5.4% | 20.5% / 16.0% | 10.1% / 8.3% | 5.1% / 4.0% |
| U2 | 19.4% / 15.7% | 7.5% / 6.5% | 2.8% / 2.5% | 14.6% / 11.6% | 5.9% / 4.8% | 2.3% / 1.9% |
| U3 | 13.3% / 11.0% | 4.1% / 3.6% | 1.2% / 1.0% | 10.1% / 8.3% | 3.2% / 2.7% | 1.2% / 1.0% |
| U4 | 9.6% / 8.1% | 2.4% / 2.2% | 0.6% / 0.5% | 7.1% / 5.8% | 2.1% / 1.7% | 0.6% / 0.6% |
| **U5** | **6.3% / 5.4%** | 1.2% / 1.0% | 0.3% / 0.3% | 5.1% / 4.0% | 1.2% / 1.0% | 0.4% / 0.4% |
| U6 | 9.3% / 7.9% | 2.5% / 2.2% | 0.7% / 0.5% | 7.1% / 5.7% | 2.0% / 1.7% | 0.7% / 0.6% |

Each session's close, three-session holds: +1.0 cleared at close 1 / 2 / 3:

| Unit | U1 | U2 | U3 | U4 | U5 | U6 |
|---|---|---|---|---|---|---|
| +1.0 at close 1 / 2 / 3 | 5.4 / 14.4 / 21.9% | 2.6 / 9.0 / 15.7% | 1.4 / 5.7 / 11.0% | 0.9 / 3.7 / 8.1% | 0.4 / 2.1 / 5.4% | 0.8 / 3.6 / 7.9% |
| −1.0 at close 1 / 2 / 3 | 5.2 / 11.6 / 16.0% | 2.9 / 7.6 / 11.6% | 1.5 / 4.9 / 8.3% | 0.8 / 3.3 / 5.8% | 0.5 / 2.2 / 4.0% | 0.9 / 3.4 / 5.7% |

On U5 a three-session hold ends beyond its +1.0 line as often as a one-session hold does today (5.4% and 5.4%).

### How much the 15-minute check misses (MEASURED, `touchGap.mjs`)

A battle sees a price every 15 minutes, so a spike between checks is never seen. The only stored intraday series on this machine is the film tape in the replay export: 10-minute bars, plus the price each check saw. It holds 600 series, 511 distinct stock-sessions.

- **Agreement first.** The tape's 10-minute extremes match the EOD daily high and low: median gap 0.0000%, 5th percentile −0.0018%. Same provider.
- **Real checks.** 128 stock-sessions have a check within 20 minutes of the open and one within 30 minutes of the close; most tape days start when the battle was deployed. Of the touches daily highs and lows show, the checks saw:
  - +1.0: 23 of 27 (0.85)
  - +1.5: 9 of 11 (0.82)
  - +2.0: 1 of 4
  - −1.0: 7 of 9 (0.78)
- **A larger sample, sampled at the 10-minute closes.** 309 stock-sessions. This is denser than the checks, so it bounds the miss from below:
  - +1.0: 58 of 70 (0.83)
  - +1.5: 19 of 25 (0.76)
  - −1.0: 23 of 25 (0.92)
- **Estimate:** the game sees about **80–85%** of the +1.0 and +1.5 touches that daily bars show. The touch figures in this report (S1, S5 on touch, and every "touch" rate above) are that much too high for the game. The ratio applies alike to one- and three-session holds, so the unit ranking does not change.
- **The close.** The last check comes a median 14 minutes before the 16:00 close (at most 15); its price sits a median 0.07 units from the close (90th percentile 0.16). The +1.0 verdict at the last check differs from the close's in 2 stock-sessions (the close cleared +1.0 in 18); the −1.0 verdict differs in 4 (the close cleared −1.0 in 4). A bank-at-the-bell shape must say which price is "the bell" (founder question FQ-6).
- **Limits of this estimate:** 11 sessions only; only stocks agents held; one session at a time, never a three-day path.

## 5. Step 3 — the scoring shapes

Script: `step3Shapes.mjs` (shape logic in `shapes.mjs`). **Base points always run from the entry. Points come from the fenced scorer's measured branch:**
- base = gain% × 10 × the conviction multiplier: Star 2.0, Core 1.5, Support 1.0;
- plus the flat points of every banked tier: +15 / +30 / +50 and −10 / −20 / −35.

Tiers add up: reaching +1.5 pays +15 and +30 (`src/utils/baggerBombUtils.js`, `calculateAssetScoreV3`; constants `src/constants/baggerBombScoring.js:14–28`).

**What each shape lets bank.** A tier crosses at equality (V2 policy `"boundaryEquality": "crossed_at_equality…"`). Every hold is held to the end.

| Shape | A bonus tier banks when | Penalties |
|---|---|---|
| S1 touch | any session's high (low) reaches it | on touch, from the entry |
| S2 exit only | the end close is beyond it | on touch, from the entry |
| S3 at the bell | any session's close is beyond it; kept | on touch, from the entry |
| S4 | S3, plus C for each session close beyond +1.0 | on touch, from the entry |
| S5 daily reset | each session, from that session's anchor, with the one-day unit frozen at entry; earnable again each day. On touch (legacy) or at each close | on touch, from the day's anchor |

**Two readings, both put to the founder:**
- **Penalties.** The prompt's table says when a *bonus* banks; it gives penalties only an anchor. Penalties therefore keep today's rule, on touch, in every shape. A sensitivity where penalties follow the bonus rule is reported (FQ-1).
- **S5's first anchor.** The letter ("levels reset each session from the prior close") anchors day 1 at the prior close. The legacy code anchors the activation day at the entry (`api/cron/agent-evaluate.js:1453` — `|| (isActivationDay ? (battle.portfolio?.startingPrices?.[asset.symbol] || previousClose) : previousClose);`). The letter is the primary; the entry anchor is the variant (FQ-2).

**Cross-check.** S5's day-by-day tiers, found by the measured model, agree with the legacy scorer's own nightly badges (the `api/cron/agent-daily-scores.js:144` path, called through the fenced scorer's legacy branch) on **8,892 of 8,892** holds.

**Matches.** Seven distinct stocks are entered at the same open, 400 seeded draws per entry session (15,600 matches), in Star, Star, Core, Core, Support, Support, Support. The same draws serve every shape. "Matches with none" counts the sampled matches: same-day positions move together.

### Per 7-position match (MEASURED, V2's window)

| Shape · unit | Bonuses | Busts | Crashes | Meltdowns | Bonus share | Bonus + penalty share | Final score: median [10th, 90th pct] | Match-days with a bonus | Matches with none | Give-backs |
|---|---|---|---|---|---|---|---|---|---|---|
| **One-day game (V2, touch)** | **0.98** | 0.77 | 0.23 | 0.07 | 11.3% | 19.9% | 8 [−129, 154] | **47.3%** | 52.7% | 48.0% |
| One-day game, exit only | 0.51 | 0.77 | 0.23 | 0.07 | 6.4% | 15.4% | 2 [−132, 133] | 27.1% | 72.9% | 0% |
| S1 · U1 | 5.21 | 2.38 | 1.22 | 0.60 | 27.3% | 41.9% | 60 [−303, 458] | 62.3% | 8.3% | 49.5% |
| S2 · U1 | 2.68 | 2.38 | 1.22 | 0.60 | 15.9% | 32.9% | −1 [−340, 363] | 23.7% | 28.8% | 0% |
| S3 · U1 | 3.31 | 2.38 | 1.22 | 0.60 | 18.7% | 35.1% | 12 [−331, 383] | 44.9% | 20.6% | 17.4% |
| S4 · U1 · C 5 / 10 / 15 | 3.31 | 2.38 | 1.22 | 0.60 | 21.4 / 23.9 / 26.3% | 37.2 / 39.3 / 41.2% | 25 / 37 / 50 [−326…−318, 411…470] | 44.9% (51.7% with carries) | 20.6% | 17.4% |
| S1 · U4 | 1.57 | 0.88 | 0.27 | 0.08 | 9.8% | 15.0% | 20 [−245, 301] | 28.2% | 39.6% | 52.6% |
| S2 · U4 | 0.76 | 0.88 | 0.27 | 0.08 | 4.9% | 10.4% | 7 [−254, 272] | 12.7% | 62.0% | 0% |
| S3 · U4 | 0.88 | 0.88 | 0.27 | 0.08 | 5.6% | 11.1% | 9 [−252, 275] | 17.9% | 57.0% | 13.5% |
| S4 · U4 · C 5 / 10 / 15 | 0.88 | 0.88 | 0.27 | 0.08 | 6.9 / 8.2 / 9.5% | 12.4 / 13.6 / 14.8% | 11 / 14 / 17 [−251…−248, 286…307] | 17.9% (21.1%) | 57.0% | 13.5% |
| S1 · U6 | 1.55 | 0.87 | 0.26 | 0.09 | 9.7% | 15.0% | 20 [−245, 303] | 27.7% | 41.1% | 52.6% |
| S2 · U6 | 0.75 | 0.87 | 0.26 | 0.09 | 4.9% | 10.5% | 8 [−255, 271] | 12.4% | 62.7% | 0% |
| S3 · U6 | 0.88 | 0.87 | 0.26 | 0.09 | 5.7% | 11.2% | 9 [−253, 276] | 17.6% | 57.8% | 14.4% |
| S4 · U6 · C 5 / 10 / 15 | 0.88 | 0.87 | 0.26 | 0.09 | 7.0 / 8.2 / 9.5% | 12.4 / 13.6 / 14.8% | 12 / 15 / 17 [−251…−249, 287…308] | 17.6% (20.7%) | 57.8% | 14.4% |
| **S1 · U5** | **1.01** | 0.60 | 0.16 | 0.05 | 6.5% | 10.1% | 16 [−239, 281] | 20.2% | 53.2% | 54.9% |
| **S2 · U5** | **0.47** | 0.60 | 0.16 | 0.05 | 3.0% | 6.8% | 8 [−243, 258] | 9.4% | 71.9% | 0% |
| **S3 · U5** | **0.55** | 0.60 | 0.16 | 0.05 | 3.5% | 7.2% | 9 [−242, 261] | 12.4% | 68.3% | 13.4% |
| **S4 · U5 · C 5 / 10 / 15** | **0.55** | 0.60 | 0.16 | 0.05 | 4.4 / 5.3 / 6.2% | 8.1 / 9.0 / 9.8% | 11 / 12 / 14 [−241, 269…282] | 12.4% (14.6%) | 68.3% | 13.4% |
| S5 on touch, prior-close anchor | 5.40 | 2.86 | 0.97 | 0.40 | 26.0% | 39.6% | 57 [−248, 396] | 59.5% | 10.4% | 50.1% |
| S5 at each close, prior-close anchor | 2.93 | 2.86 | 0.97 | 0.40 | 16.1% | 31.5% | 8 [−284, 316] | 37.8% | 26.7% | 26.2% |
| S5 on touch, entry anchor (variant) | 4.61 | 2.70 | 0.88 | 0.34 | 23.0% | 36.1% | 43 [−260, 381] | 55.3% | 12.2% | 49.4% |
| S5 at each close, entry anchor (variant) | 2.48 | 2.70 | 0.88 | 0.34 | 14.0% | 28.6% | 6 [−290, 310] | 34.4% | 29.3% | 23.7% |

How to read the measures:
- **Bonus share:** the bonus points (carries included) as a share of all absolute points: |base| + bonuses + |penalties|.
- **Match-days with a bonus:** the share of a match's days on which at least one tier bonus banks. The figure in brackets also counts S4's carries. A carry is paid only after the +1.0 tier has banked, so it never rescues a match with no bonus.
- **Give-backs:** the share of bonus points paid on tiers whose level the end close no longer clears.

**Under water and paid (S5).** Under the daily reset a bonus can be paid to a position below its entry price at that moment:
- on touch: 9.9% of S5 bonuses with the prior-close anchor (7.9% with the entry anchor);
- at each close: 4.8% (4.6%).

**Penalties banked by the shape's own bonus rule (sensitivity, per match):**

| | U1 | U4 | U6 | U5 |
|---|---|---|---|---|
| S2, penalties at the end close: Busts / Crashes / Meltdowns | 1.12 / 0.58 / 0.28 | 0.41 / 0.12 / 0.04 | 0.40 / 0.12 / 0.04 | 0.28 / 0.07 / 0.03 |
| S3, penalties at any close | 1.44 / 0.71 / 0.36 | 0.50 / 0.14 / 0.04 | 0.50 / 0.14 / 0.05 | 0.36 / 0.08 / 0.03 |

What the table says:
- On U5 the three-day match banks about as many bonuses as one of today's one-day matches: 1.01 against 0.98 on touch, and 0.47 against 0.51 on exit only. But it takes three days to do it.
- Base points over three days spread twice as wide (P10–P90 about ±260 against ±140), so bonuses carry half the weight: 6.5% of points against 11.3%.
- On the unscaled unit the three-day match is bonus-rich: 5.21 bonuses on touch, 27% of points.

## 6. Step 4 — the snap-exit test

Script: `step4SnapExit.mjs`. Every three-session hold whose daily high reaches its +1.0 line, first on session d:
- **SELL:** sold at the line on session d. Base points at the line, plus what the shape banks: the +1.0 tier, and penalties touched before the sale. The slot holds cash to the end.
- **BELL:** held to the close of session d; sold there if that close is still beyond the line, else held to the end.
- **HOLD:** held to the end.

S5 uses its own daily +1.0 line, the one-day unit from the day's anchor.

| Line | Holds reaching +1.0 | First on session 1 / 2 / 3 | Session-d penalty also touched (primary order) | Session d opened beyond the line |
|---|---|---|---|---|
| U1 | 3,643 | 947 / 1,604 / 1,092 | 54 | 641 |
| U4 | 1,459 | 143 / 549 / 767 | 6 | 238 |
| U6 | 1,432 | 140 / 555 / 737 | 4 | 236 |
| U5 | 981 | 74 / 353 / 554 | 2 | 163 |
| S5 daily line | 3,747 | 1,520 / 1,272 / 955 | 57 | 353 (the line sat below the fill in 460) |

The same counts over the long window (174 entry sessions, 10 Mar → 13 Nov): U1 14,384 (first on session 1 / 2 / 3: 3,663 / 6,331 / 4,390), U4 5,242, U6 4,719, U5 3,533 (209 / 1,390 / 1,934), S5 15,057. The one-session game's line is reached in 947 holds (V2's window) and 3,663 (long window).

### The verdicts (MEASURED, Support position)

The test is run on two windows: V2's (39 entry sessions) and the long one (174). Margins are SELL's mean points minus HOLD's, per Support position.

**Uncertainty is measured by resampling whole entry sessions.** Holds entered on the same day move together, so the session, not the hold, is the independent unit.
- 2,000 seeded resamples, drawn with replacement.
- "SELL best in x%" is the share of resamples in which SELL has the highest average of the three policies.
- Brackets are 90% intervals.

**1. SELL clearly loses.** SELL is best in 0–3% of long-window resamples, and in at most 7% of V2-window resamples.
- Today's touch rule (S1), on every unit: −9.7 to −29.7 (V2), −13.8 to −28.3 (long).
- Every shape on the unscaled unit U1: −7.0 to −29.7.
- The daily reset on touch (S5): −21.1 (V2), −19.1 (long).
- The daily reset at each close (S5): BELL wins. SELL is best in 1% (V2) and 3% (long) of resamples.
- The bell with a carry (S4):
  - C = 10 and 15: on every unit and in both windows.
  - C = 5: on the long window, −5.9 to −7.2 on U4–U6 (0% of resamples). On V2's window C = 5 is within noise: −1.2 to −3.6, SELL best in 15–34%.

**2. Even, with no clear winner: exit only (S2) and at-the-bell (S3) on the wider units U4, U5 and U6.**
- On V2's window, SELL leads by +0.2 to +4.2. Every 90% interval spans zero, and SELL is best in 52–86% of resamples.
- On the long window, SELL trails:
  - S2: −0.6 to −1.3. The intervals span zero, and SELL is best in 20–34%.
  - S3: −2.2 to −3.3. Two of the three intervals end below zero, and SELL is best in 2–9%.
- The sign also depends on how a gap-through sale is priced. Filling it at the open instead of at the line flips the long window's S2 and S3 back to SELL.

**3. SELL clearly wins: the one-session game under exit only.** That is practice, if BB-8 applies to it. Across the long window, selling at the +1.0 line beats holding to the close:
- by **+4.1** points [+2.0, +6.1], best in **100%** of resamples (long window);
- by +1.2 [−3.9, +6.5], best in 71% (V2's window).

The same game under today's touch rule goes the other way: SELL loses −8.7 [−10.4, −7.0] (long) and −11.4 (V2).

| Shape · unit | V2's window: SELL − HOLD [90%] · SELL best | Long window: SELL − HOLD [90%] · SELL best | Best on average (V2 / long) |
|---|---|---|---|
| **One-session game, touch (today)** | −11.4 [−15.6, −6.8] · 0% | −8.7 [−10.4, −7.0] · 0% | HOLD = BELL / HOLD = BELL |
| **One-session game, exit only** | +1.2 [−3.9, +6.5] · 71% | **+4.1 [+2.0, +6.1] · 100%** | SELL / **SELL** |
| S1 · U1 / U4 / U6 / U5 | −29.7 / −11.1 / −12.2 / −9.7 · 0% | −28.3 / −15.0 / −15.0 / −13.8 · 0% | HOLD / HOLD |
| S2 · U1 | −7.5 [−13.3, −0.7] · 0% | −7.0 [−9.6, −4.6] · 0% | BELL / HOLD |
| S2 · U4 | +3.1 [−2.2, +9.4] · 72% | −1.1 [−3.9, +1.6] · 22% | SELL / HOLD |
| S2 · U6 | +2.4 [−3.1, +8.8] · 68% | −1.3 [−4.2, +1.4] · 20% | SELL / HOLD |
| S2 · U5 | +4.2 [−1.0, +9.4] · 86% | −0.6 [−3.5, +2.2] · 34% | SELL / HOLD |
| S3 · U1 | −12.3 [−17.6, −5.8] · 0% | −11.1 [−13.6, −8.8] · 0% | HOLD / HOLD |
| S3 · U4 | +1.1 [−3.9, +7.1] · 61% | −3.1 [−5.8, −0.5] · 2% | SELL / HOLD |
| S3 · U6 | +0.2 [−4.8, +6.2] · 52% | −3.3 [−6.2, −0.6] · 2% | SELL / HOLD |
| S3 · U5 | +2.4 [−2.5, +7.4] · 78% | −2.2 [−5.1, +0.5] · 9% | SELL / HOLD |
| S4 · C = 5 · U1 / U4 / U6 / U5 | −17.4 / −2.7 / −3.6 / −1.2 · 0 / 21 / 15 / 34% | −16.0 / −7.0 / −7.2 / −5.9 · 0% | HOLD / HOLD |
| S4 · C = 10 · U1 / U4 / U6 / U5 | −22.5 / −6.6 / −7.5 / −4.8 · 0 / 5 / 4 / 7% | −20.8 / −11.0 / −11.2 / −9.7 · 0% | HOLD / HOLD |
| S4 · C = 15 · U1 / U4 / U6 / U5 | −27.5 / −10.4 / −11.3 / −8.5 · 0 / 1 / 1 / 1% | −25.6 / −14.9 / −15.1 / −13.4 · 0% | HOLD / HOLD |
| S5 on touch | −21.1 [−25.9, −16.2] · 0% | −19.1 [−21.2, −17.1] · 0% | HOLD / HOLD |
| S5 at each close | −3.0 [−7.6, +1.7] · 1% | −1.5 [−3.6, +0.4] · 3% | BELL / BELL |

**The prompt asks which shapes make SELL the best policy on average, and by how much:**
- **Three-day game:** none, clearly. On V2's window SELL leads under exit only (+2.4 to +4.2 over HOLD) and at the bell (+0.2 to +2.4) on U4–U6, but none of those leads clears noise, and over the long window all of them turn negative.
- **One-day game:** exit only makes SELL the best policy, by about 4 points per Support position over the long window (about 9% of the 44 points a sale at the line earns).

### Points per policy, V2's window (Support)

| Shape · unit | n | Mean SELL / BELL / HOLD | Median SELL / BELL / HOLD | Best of three: SELL / BELL / HOLD |
|---|---|---|---|---|
| One-session game, touch | 947 | 42.3 / 53.7 / 53.7 | 40 / 41 / 41 | 45% / 27% / 27% (BELL = HOLD) |
| One-session game, exit only | 947 | 42.3 / 41.1 / 41.1 | 40 / 34 / 34 | 51% / 25% / 25% (BELL = HOLD) |
| S1 · U1 | 3,643 | 41.4 / 64.3 / 71.1 | 39 / 50 / 60 | 30% / 32% / 38% |
| S2 · U1 | 3,643 | 41.4 / 49.2 / 48.9 | 39 / 41 / 36 | 35% / 34% / 31% |
| S3 · U1 | 3,643 | 41.4 / 49.6 / 53.6 | 39 / 41 / 40 | 34% / 34% / 32% |
| S4 · U1 · C 5 / 10 / 15 | 3,643 | 41.4 / 53.1…60.2 / 58.7…68.9 | 39 / 46…56 / 45…56 | 33–34% / 29–31% / 35–38% |
| S1 · U4 | 1,459 | 60.6 / 69.9 / 71.8 | 55 / 59 / 58 | 39% / 30% / 31% |
| S2 · U4 | 1,459 | 60.6 / 58.9 / 57.5 | 55 / 53 / 49 | 43% / 30% / 27% |
| S3 · U4 | 1,459 | 60.6 / 59.0 / 59.5 | 55 / 53 / 50 | 43% / 30% / 27% |
| S4 · U4 · C 5 / 10 / 15 | 1,459 | 60.6 / 61.9…67.8 / 63.4…71.1 | 55 / 57…66 / 55…64 | 42% / 27–28% / 30–32% |
| S1 · U6 | 1,432 | 61.0 / 70.5 / 73.2 | 56 / 60 / 59 | 41% / 29% / 30% |
| S2 · U6 | 1,432 | 61.0 / 59.3 / 58.6 | 56 / 54 / 50 | 43% / 30% / 27% |
| S3 · U6 | 1,432 | 61.0 / 59.4 / 60.8 | 56 / 54 / 52 | 43% / 30% / 27% |
| S4 · U6 · C 5 / 10 / 15 | 1,432 | 61.0 / 62.4…68.3 / 64.7…72.4 | 56 / 58…68 / 57…66 | 42% / 26–28% / 30–31% |
| S1 · U5 | 981 | 67.6 / 75.2 / 77.3 | 61 / 62 / 62 | 42% / 28% / 30% |
| S2 · U5 | 981 | 67.6 / 64.4 / 63.4 | 61 / 57 / 54 | 44% / 29% / 26% |
| S3 · U5 | 981 | 67.6 / 64.4 / 65.2 | 61 / 57 / 56 | 44% / 29% / 27% |
| S4 · U5 · C 5 / 10 / 15 | 981 | 67.6 / 67.3…73.0 / 68.8…76.0 | 61 / 62…71 / 61…70 | 43–44% / 26–28% / 28–30% |
| S5 on touch | 3,747 | 28.0 / 48.9 / 49.0 | 30 / 43 / 42 | 29% / 36% / 34% |
| S5 at each close | 3,747 | 28.0 / 33.0 / 31.0 | 30 / 32 / 28 | 40% / 32% / 29% |

"Best of three" splits ties equally. On one session BELL and HOLD are the same sale, so they share a tie.

**SELL is often the single best outcome but rarely the best average.**
- Under S2–S4 on the wider units, SELL is the single best policy in 42–44% of holds, more often than either other policy.
- HOLD still wins on average in most of those rows, because a minority of held positions run much further.

**Star position (conviction 2.0), the check.** Bonuses are flat and base points double, so the balance barely moves.
- **V2's window:** the same winners, except S5 on touch, which goes to BELL (68.7 against HOLD's 67.5). SELL leads under S2 and S3 on U4–U6 by +0.7 to +4.8 over HOLD, best in 52–73% of resamples.
- **Long window:** HOLD leads under S2 and S3 on U4–U6 (SELL best in 2–10%). The one-session exit-only game again favours SELL: +4.6 [+1.7, +7.5], 100%.

**By the session of first touch (Support, V2's window):**
- Touches on session 3 make BELL equal to HOLD by construction. There, SELL wins under S2 and S3 on U4, U5 and U6, and under S4 with C = 5 on U4 and U5.
- Touches on session 2 favour HOLD under S3 and S4 on every unit.
- Session-1 touches are rare on U5 (74 of 981). The full table is in `step4-snap-exit.json` under `byDay`.

**Variants run, and whether a Support winner flips:**
- **Session-d ordering.** The variant counts a penalty touched in the same session as the line always, or never. **No flips in either window.** The cases are few: 2–57 (V2), 3–167 (long).
- **Gap through the line, filled at the open.** The stock opened beyond the line, so no sale at the line was possible.
  - V2's window: flips S4 · C = 5 to SELL on U4 and U5.
  - Long window: flips S2 and S3 on U4–U6, and S5 at each close, to SELL.
  - Nothing else flips.
- **S4 + BELL.** The variant settles whether the close BELL sells at earns its carry. **No flips.**

## 7. Step 5 — one day against three

Script: `step5OneVsThree.mjs`. The same seeded seven-stock matches, no setup filter, each scored two ways:
- **one 3-day match**, entered at the open of session 1 and held to the close of session 3;
- **three consecutive 1-day matches**, the same seven re-entered at each open, each with that day's one-day unit, measured from the 15 bars before that session as V2 would.

| Game (MEASURED) | Points per day | Bonuses per day | Penalties per day | Three days' total: median [10th, 90th pct] | Long window: points / bonuses per day |
|---|---|---|---|---|---|
| **Three 1-day matches, touch (today)** | 5.2 | **0.97** | 1.04 | 13 [−252, 289] | −0.6 / 0.82 |
| Three 1-day matches, exit only | −4.0 | 0.50 | 1.04 | −8 [−271, 246] | −8.8 / 0.39 |
| 3-day, S1 · U5 | 6.2 | 0.34 | 0.27 | 16 [−239, 281] | 4.5 / 0.27 |
| 3-day, S2 · U5 | 2.5 | 0.16 | 0.27 | 8 [−243, 258] | 1.8 / 0.13 |
| 3-day, S3 · U5 | 3.0 | 0.18 | 0.27 | 9 [−242, 261] | 2.1 / 0.15 |
| 3-day, S4 · U5 · C = 10 | 4.9 | 0.18 | 0.27 | 12 [−241, 275] | 3.7 / 0.15 |
| 3-day, S1 · U1 | 23.1 | 1.74 | 1.40 | 60 [−303, 458] | 15.5 / 1.48 |
| 3-day, S2 · U1 | 1.8 | 0.89 | 1.40 | −1 [−340, 363] | −2.5 / 0.74 |
| 3-day, S3 · U1 | 6.5 | 1.10 | 1.40 | 12 [−331, 383] | 1.0 / 0.90 |
| 3-day, S4 · U1 · C = 10 | 16.2 | 1.10 | 1.40 | 37 [−323, 440] | 9.1 / 0.90 |
| 3-day, S5 on touch | 22.0 | 1.80 | 1.41 | 57 [−248, 396] | 15.8 / 1.51 |
| 3-day, S5 at each close | 4.1 | 0.98 | 1.41 | 8 [−284, 316] | 0.4 / 0.76 |

**How much of the 3-day result the overnight gaps decide (MEASURED):**
- **28.5%** of the variance of a match's three-day move (conviction-weighted log return) comes from the two overnight moves. 78.6% comes from the three sessions, and the covariance is −7.1%.
- Removing the two overnight moves changes the sign of **16.1%** of matches' three-day moves.
- Per position, 31.9% of all absolute movement over the three days happens overnight.
- On U5 under touch, 1,197 of 1,277 bonus first-touches come on sessions 2 or 3. **209 of those (17.5%) are made at the open**, by a gap through the level, not during a session.
- The long window agrees: 27.6% of the variance (intraday 77.1%, covariance −4.7%); 16.6% of signs flip; 30.4% of absolute movement is overnight; 776 of 4,419 later first touches (17.6%) are made at the open.

Two readings:
- **Per day, the one-day game pays about three times the bonuses** of a three-day match on the recommended unit (0.97 against 0.34 on touch).
- **The unscaled unit under exit-only nearly matches it per day** (0.89 against 0.97, S2 · U1). But it puts a stock beyond its +1.0 line at the end in 21.9% of holds, and on that unit selling at the line clearly loses (§6).

**The setup payoff check.** `docs/audits/` at `origin/main` (`bd841257`, fetched 18 Nov) holds no setup payoff check dated 18 Nov 2026 or later. No branch on origin holds one either (searched with `git ls-tree` over every remote branch for "payoff"). There is nothing to quote beside this section.

## 8. Market-data requests and production

- **EODHD requests: 0.** Every bar came from the 17 Nov setup-frequency export (`C:/Users/fashr/Documents/FantasyTrades/SetupFrequency/run-20261117/bars/`, 241 series, 241 requests counted in that run's own ledger). The Oct 12 evidence and the replay export were also already on disk.
- **18 Nov was not fetched.** It would have cost 228 requests to add one entry session; the prompt prefers local bars. The window ends at the 17 Nov close.
- **Production: 0 reads, 0 writes.**

## 9. What a trader v1 build must change to admit a second unit

Cited at `bd841257`, all VERIFIED; nothing changed. "Concept-fenced" means the file is not on BUILD_RULES §1's list, but the change alters the scoring engine or the creation record, which §1 fences as concepts.

| # | Where | What blocks a second unit | Fence |
|---|---|---|---|
| 1 | `src/utils/stockThresholdModel.js:29` — `if (!sameModel(stamp) \|\| instantMs(stamp.admittedAt) === null) return unavailable('unsupported_stock_model');` | `sameModel` (`:23`) compares a stamp to the ONE frozen `STOCK_MODEL` (`:7–13`, model `stock_measured_atr14_fullday_v2`). A second model is refused as unsupported. Needs a model registry. | Concept-fenced (scoring engine) |
| 2 | `src/utils/stockThresholdModel.js:30` — `if (battle.gameMode !== 'baggerbomb_agent' \|\| battle.duration !== 'fullday' \|\| !battle.opponent?.portfolio) return unavailable('unsupported_stock_scope');` | Any multi-day battle is refused. Must admit the 3-day duration for the 3-day model only. | Concept-fenced (scoring engine) |
| 3 | `api/_utils/stockThresholdAdmission.js:30` (receipt binds `effectiveStockPercentage(m.measuredPct)`) and `:211` (replay requires `effectiveStockPercentage(replay.measuredPct).scoringPctDecimal === r.scoringPctDecimal`) | A scaled unit (U5 = 2 × the measurement) fails the replay check unless the receipt records the scale or the model. | Not on the §1 list (it is the prompt's no-change list); concept-fenced |
| 4 | `api/_utils/stockThresholdPolicyRegistry.js:1`, `:5–6`, `:12` | One policy file is imported; any content change throws `Registered stock policy content changed`; `resolveStockApproval` approves only `sameModel`. A new policy file, a new hash, a new approval record and a registry that holds both. | Not fenced; owner approval needed |
| 5 | `docs/specs/BAGGERBOMB_STOCK_THRESHOLDS_POLICY_V2_20261015.json:9`, `:13` (`"creationDuration": "fullday"`) | V2 is hash-pinned and one-day by content; a 3-day unit is a new policy, never an edit. | Pinned by hash |
| 6 | `api/_utils/measuredStockThreshold.js:6` (`period: 14`) and `:73–79` | U5 needs no new measurement (a scale). U6 would need a new calculator over three-session bars. | Not fenced |
| 7 | `api/_utils/agentBattleService.js:41` — `const AGENT_BATTLE_DURATION_MODE = 'fullday';` | Every battle is created one-day (Phase 0 B1). | **§1-fenced file** |
| 8 | Tests pinning one day or one model: `src/utils/stockThresholdModel.test.js:232`, `src/components/League/battleArena/buildArenaModel.test.js:513`, `api/_utils/p4Equivalence.battery.test.js:602`, `api/cron/agent-evaluate.stockThresholds.test.js:197` | Must move deliberately with the change. | — |

## 10. Limits

- **Daily bars cannot order a session's high and low.** SELL's same-session penalty uses a rule: the low came first if the session closed at or above its open. Both bounds were run (§6); no winner flips. The cases are few (2–57 on V2's window, 3–167 on the long one).
- **SELL assumes a fill at the line.** Sessions that opened beyond the line (163–641 per unit) cannot fill there. The open-fill variant flips S4 at C = 5 on U4 and U5 (V2's window), and S2 and S3 on U4–U6 (long window). Note the other direction too: a seller acting at a 15-minute check usually sells above the line. That favours SELL slightly and is not measured here.
- **A seller could refill the slot.** This test does not credit it; SELL's cash earns nothing.
- **The 15-minute check** sees about 80–85% of daily-bar touches. That estimate rests on 128 and 309 stock-sessions over 11 sessions, from stocks agents held. Close-based shapes are not affected by sampling, but the last check is about 14 minutes before the close.
- **The sample.**
  - 39 entry sessions (22 Sep → 13 Nov 2026). Stocks on the same day move together, so the effective sample is closer to 39 market days than to 8,892 holds.
  - November was a down-trending market (setup-frequency count, §2).
  - Steps 2–5 were also run over the 174-session window (10 Mar → 13 Nov). The unit choice and every shape count hold there. The snap-exit leads that SELL showed on V2's window under S2 and S3 do not.
- **The entry is the session open.** Real battles fill at the deploy time: mid-session, or at the prior close when deployed out of hours (V2 Ruling 7). Step 2 was re-run with the prior-close fill and the recommended unit moves (§4). Steps 3–5 were not.
- **Fully adjusted prices.** An ex-dividend drop inside a hold does not appear; the game would see it.
- **Provider revisions.** Bars are as served on 17 Nov; the latest sessions' bars were read about two hours after their close (§3).
- **Random seven-stock matches.** No setup filter, no agent selection, no opponent: points are not compared against a CPU book.
- **S5's unit is frozen at entry,** as the legacy battle froze its base unit. A one-day unit re-measured each day would differ slightly; the re-entered one-day matches of §7 do re-measure.
- **Penalty banking** stays on touch in S2–S4 by reading (§5); the sensitivity is shown.
- **The synthetic battle** used to call the real model carries `duration: 'fullday'` to pass the scope guard (`src/utils/stockThresholdModel.js:30`).

## 11. Founder questions

- **FQ-1 — Penalties under exit-only and at-the-bell.** BB-8 says when a *bonus* banks. Should penalties (Bust, Crash, Meltdown) also bank only on exit, or at a close? Or keep banking on touch, as measured here? On U5, penalties at the end close cut Busts per match from 0.60 to 0.28.
- **FQ-2 — S5's first-day anchor, if a daily reset is pursued.** The prior close is the prompt's letter. The entry is what the legacy code did (`api/cron/agent-evaluate.js:1453`). With the prior close, a bonus can be paid for an opening gap the position never held: the line sat below the fill in 460 of 3,747 first touches.
- **FQ-3 — The unit's target.** Keeping V2's one-day rarity per match (U5 from the open, U4 or U6 from the prior close) leaves about one bonus per three-day match, a third of today's per day. Is the target equal rarity per match, or more scoring moments per day? A smaller unit gives more: U1 under exit-only pays 0.89 bonuses a day, against 0.97 today.
- **FQ-4 — The carry's size.** At C = 10 or more, holding beats selling at the line on every unit, in both windows. At C = 5 it does so clearly over March–November, and within noise over V2's window. Without a carry, exit-only and at-the-bell are already even on the scaled units. Which C, if any?
- **FQ-5 — Match length.** Per day, today's one-day game pays about three times the bonuses of a three-day match on U5. Overnight gaps decide 28.5% of a three-day match's variance and flip 16% of results. Which length?
- **FQ-6 — Which price is "the bell"?** The last 15-minute check runs about 14 minutes before the close and sits a median 0.07 units from it. Phase 0 D1 read that the closing price itself is not scored today (not verified against a live battle). S3 and S4 need it named: the 16:00 close, or the last check.
- **FQ-7 — Exit-only in one-day practice.** In the one-day game, exit-only makes selling at the +1.0 line the better policy: +4.1 points per Support position over March–November, in 100% of resamples. Under today's touch rule the same sale loses 8.7 points. Does BB-8 apply to one-day practice matches?
- **FQ-8 — How a ranked match fills.** At the open, ×2 (U5) keeps V2's rarity. At the prior close, with the opening gap counted (what V2 does for a battle created out of hours), about ×√3 (U4) or the measured three-session range (U6) does. Which fill will a ranked three-day match use?
- **FQ-9 — The window reading.** "V2's sessions plus every session since" was read as entries 22 Sep → 13 Nov (the last entry with three sessions on disk); 18 Nov was not fetched (0 requests). Say if a different window was meant.

## Reproduce

Offline, in order. Each script writes to `C:/Users/fashr/Documents/FantasyTrades/ScoringShape/run-20261118/` (outside the repository) and refuses an output folder inside it. Inputs default to the paths named in `lib.mjs`.

1. `node scripts/experiments/scoring-shape/step1Reproduce.mjs`
2. `node scripts/experiments/scoring-shape/buildHolds.mjs`
3. `node scripts/experiments/scoring-shape/step2Units.mjs` (add `--long` for the 174-session check, `--fill prior_close` for the fill sensitivity)
4. `node scripts/experiments/scoring-shape/touchGap.mjs`
5. `node scripts/experiments/scoring-shape/step3Shapes.mjs`
6. `node scripts/experiments/scoring-shape/step4SnapExit.mjs`
7. `node scripts/experiments/scoring-shape/step5OneVsThree.mjs`

Steps 5–7 take `--long` too, and read Step 2's recommended unit from `step2-units.json` (or `step2-units-long.json`). The matches are seeded (`RNG_SEED = 20261118`, 400 per entry session).
