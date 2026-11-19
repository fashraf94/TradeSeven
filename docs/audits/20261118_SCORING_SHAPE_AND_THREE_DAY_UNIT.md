# Scoring shape and the three-day threshold unit — measurement (read-only)

**Date:** Wednesday 18 Nov 2026 (run after the close) · **Run by:** Claude Code (Opus 5.5), local session · **Prompt:** *Experiment prompt — the scoring shape and the threshold unit for the 3-day game* (Fable, the BaggerBomb revamp chat, 18 Nov 2026; supersedes the unrun Nov 16 prompt) · **Branch:** `claude/scoring-shape-three-day-unit`, cut from `origin/main` at `bd841257` · **Scripts:** `scripts/experiments/scoring-shape/` · **Review:** `docs/audits/20261118_SCORING_SHAPE_AND_THREE_DAY_UNIT_REVIEW.md` (3 lenses, 16 refuters, 22 findings) · **Out-of-tree copies:** `C:/Users/fashr/Documents/FantasyTrades/ScoringShape/` (BUILD_RULES §3).

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

Each cell: **bonuses per 7-position match · share of match-days with at least one bonus · snap-exit verdict** (Support position), with SELL's margin over the next-best policy per position, V2's window / the long window.

- The first two figures: V2's window, 8,892 holds, 15,600 seeded matches, entries 22 Sep → 13 Nov 2026, fill at the open.
- **The verdict rule** (`verdicts.mjs`, applied in code):
  - In each window, SELL **clearly loses** when it is the best policy on average in at most 5% of 2,000 resamples of blocks of entry sessions, and **clearly wins** at 95% or more.
  - "SELL loses" / "SELL wins": clear in both windows.
  - \*: clear in one, within noise in the other, with the same sign.
  - "even": anything else.
  - †: the best-on-average policy changes when a gap through the line is sold at the open.
- **In brackets, the check-priced verdict.** The same rule, with SELL sold as a 15-minute check would sell: only lines a check sees, filled past the line, gap-throughs at the open (§6). The primary sells exactly at the line on a daily-high touch.

| Shape | U1 — today's one-day unit, unscaled | U4 — × √3 | U6 — measured 3-session range | **U5 — × 2 (recommended, open fill)** |
|---|---|---|---|---|
| **Baseline: today's one-day game** (V2 unit, touch) | 0.98 · 47% · SELL loses (−11.4 / −8.7) [loses] | | | |
| One-day game, exit only (practice under BB-8) | 0.51 · 27% · SELL wins\* (+1.2 / +4.1) [**even**: −1.4 / +1.4] | | | |
| **S1** touch (today) | 5.21 · 62% · SELL loses (−29.7 / −28.3) [loses] | 1.57 · 28% · loses (−11.1 / −15.0) [loses] | 1.55 · 28% · loses (−12.2 / −15.0) [loses] | 1.01 · 20% · loses (−9.7 / −13.8) [loses] |
| **S2** exit only (BB-8 as adopted) | 2.68 · 24% · loses (−7.9 / −7.0) [loses] | 0.76 · 13% · even† (+1.8 / −1.1) [even: +4.1 / +2.0] | 0.75 · 12% · even† (+1.8 / −1.3) [even: +4.9 / +1.7] | 0.47 · 9% · even† (+3.2 / −0.6) [**SELL wins\***: +6.2 / +2.9] |
| **S3** at the bell | 3.31 · 45% · loses (−12.3 / −11.1) [loses] | 0.88 · 18% · even† (+1.1 / −3.1) [even] | 0.88 · 18% · even† (+0.2 / −3.3) [even] | 0.55 · 12% · even† (+2.4 / −2.2) [even: +5.1 / +1.0] |
| **S4** bell + carry, C = 5 | 3.31 · 45% (52% with carries) · loses (−17.4 / −16.0) [loses] | 0.88 · 18% (21%) · loses\*† (−2.7 / −7.0) [loses\*] | 0.88 · 18% (21%) · loses\* (−3.6 / −7.2) [loses\*] | 0.55 · 12% (15%) · loses\*† (−1.2 / −5.9) [even] |
| **S4** C = 10 | same counts · loses (−22.5 / −20.8) [loses] | loses (−6.6 / −11.0) [loses\*] | loses (−7.5 / −11.2) [loses\*] | loses\* (−4.8 / −9.7) [loses\*] |
| **S4** C = 15 | same counts · loses (−27.5 / −25.6) [loses] | loses (−10.4 / −14.9) [loses] | loses (−11.3 / −15.1) [loses] | loses (−8.5 / −13.4) [loses] |
| **S5** daily reset, on touch (dormant legacy) | 5.40 · 59% · loses (−19.9 / −17.7) | one-day unit only | | |
| **S5** daily reset, at each close | 2.93 · 38% · even† (−3.8 / −0.4) | one-day unit only | | |

**The recommended unit depends on the fill** (§4). With the open fill used throughout, U5 (×2) matches V2's one-day rarity. With the prior-close fill V2 uses for a battle created out of hours, U4 (×√3) or U6 does.

## In plain terms

- **V2 reproduced.**
  - Its published one-day figures come back bit-exact from its own inputs (228 of 228).
  - From the bars on disk, three stocks miss the tolerance set beforehand. Every miss is the provider finalising the 12 Oct bar after V2 read it (§3).
- **The unit that keeps V2's rarity is ×2 if a match fills at the open, and about ×√3 if it fills at the prior close.**
  - From the open: a stock touches its one-day +1.0 line in 10.7% of sessions.
    - Over three sessions, ×2 (U5) gives 11.0%, ×√3 (U4) 16.4%, the measured three-session range (U6) 16.1%, and the unscaled unit 41.0%.
    - The exact match is ×2.03 (×1.97 over March–November).
    - Resampling blocks of sessions, U5 is picked 92–98% of the time and ×√3 lies outside every interval.
  - From the prior close, with the opening gap counted as V2 counts it out of hours: the exact match is ×1.83 (×1.77), and U6 or U4 is picked.
  - The fill convention for ranked matches has to be fixed before the unit (§4, FQ-8).
- **Every three-day shape on a scaled unit has fewer scoring moments than today's game.**
  - Today's game banks a bonus on 47% of match-days. On U5, the three-day shapes bank on 9% (exit only) to 20% (touch).
  - 68–72% of three-day matches on U5 bank no bonus at all under exit-only or at-the-bell, against 53% of today's one-day matches (§5).
- **The snap exit (§6): selling at the line clearly loses under today's touch rule, the unscaled unit, the daily reset on touch, and the carry. Under exit-only and at-the-bell on the scaled units, the answer turns on how a sale is priced.**
  - **Clearly loses, however the sale is priced:**
    - today's touch rule (S1), on every unit;
    - every shape on the unscaled unit;
    - the daily reset on touch;
    - the carry (S4): at C = 15 on every unit; at C = 10 on every unit, though on U5 V2's window alone is within noise; at C = 5 on the long window.
  - **Exit-only (S2) and at-the-bell (S3) on U4–U6, sale priced exactly at the line on a daily-high touch:**
    - SELL leads by up to 3.2 points over the next-best policy in V2's window, and trails by up to 3.3 over March–November.
    - The verdict is "even".
  - **The same shapes priced as a 15-minute check would sell:**
    - Only touches a check sees count. Such a sale fills a mean 0.12 one-day units past the line, and a gap-through fills at the open.
    - Exit-only then leads in both windows: +4.1 to +6.2 in V2's window, +1.7 to +2.9 over March–November.
    - That is clear only on U5 ("SELL wins\*", 97.8% of V2-window resamples, 92.7% long). At-the-bell stays even.
- **The carry does what it was proposed to do, with a margin.** At C = 10 or 15, holding beats selling under every pricing. At C = 5, holding wins clearly over March–November. In V2's window it is within noise, and on U5 it is even when check-priced.
- **One-day exit-only (practice, if BB-8 applies to it).**
  - Sold exactly at the line on a daily-high touch, SELL beats holding to the close by +4.1 points over March–November (99.8% of resamples).
  - Priced as a check would sell, that lead shrinks to +1.4 (84%), and to −1.4 in V2's window: even.
  - Under today's touch rule the same sale clearly loses (−8.7 to −11.4).
- **One day against three.**
  - Three re-entered one-day matches pay 0.97 bonuses a day (0.82 over March–November).
  - One three-day match on U5 pays 0.34 a day under touch (0.27), and 0.16–0.18 under exit-only or at-the-bell (0.13–0.15).
  - The two overnight gaps carry 28.5% of the variance of a three-day match's conviction-weighted price move (27.6% long). Removing them flips that move's sign in 16% of matches. Scores and wins were not tested this way (§7).
- **The 15-minute check sees about 85% of the +1.0 touches that daily highs show.**
  - Resampling sessions, the interval is 0.76–0.93 (23 of 27 at real checks; 58 of 70 at 10-minute closes). It sees about 75% of the +1.5 touches.
  - Touch-based figures here are about that much too high for the game. Three-session holds lose slightly fewer touches, and the unit ranking holds (§4).
- **No market-data request and no production read.** Every input was already on this machine.

## Preamble

- **Session opening (BUILD_RULES §2, §3).**
  - `git fetch origin` ran first. `origin/main` = `bd841257`. Branch `claude/scoring-shape-three-day-unit` was cut from it: HEAD `bd841257`, tree clean.
  - The fetch was repeated before writing and before pushing (results in the PR).
- **Model.** The prompt names Opus; this session ran on Opus 5.5.
- **New files only:** ten scripts under `scripts/experiments/scoring-shape/`, this report and its review record. No scorer, threshold model, admission, measurement, policy, registry, pin, flag, rule or test file changed.
- **Fenced functions (BUILD_RULES §1).** `calculateAssetScoreServer` (`api/_utils/agentScoring.js:225`) was called and never edited:
  - on its measured branch (`:226`, into `calculateAssetScoreV3`, `src/utils/baggerBombUtils.js:535`; base `:542`, bonus `:541`, total `:543`);
  - and on its legacy branch, for the S5 cross-check.
  - No legacy archetype table is imported (§2.3 ratchet untouched).
- **Also called, not fenced, not changed:**
  - `stockRewardContext` and `STOCK_MODEL` (`src/utils/stockThresholdModel.js:62`, `:7`);
  - `calculateMeasuredATR` and `normalizeRawSnapshot` (`api/_utils/measuredStockThreshold.js:73`, `:48`);
  - `effectiveStockPercentage` (`api/_utils/stockThresholdAdmission.js:11`);
  - the canonical constants `THRESHOLD_POINTS` and `CONVICTION_MULTIPLIERS` (`src/constants/baggerBombScoring.js:33`, `:56`).
- **No scoring math is copied (BUILD_RULES §4).**
  - Every unit comes from the V2 calculator and is quantised by admission's own function.
  - Every tier crossing is decided by `stockRewardContext`. The scripts show the model each session's touch record and each close (`shapes.mjs` `pathSets`), and take the union of its answers for the shape.
  - That set goes to the fenced scorer in place of the model's own `crossedTiers` (`lib.mjs`, `points`). For S1–S3, the set and the total equal what the model and scorer give for one touch record: 0 differences in 26,676 checks per unit (review C7).
  - S4 adds C per carry. S5 adds the scorer's bonus for each day's set to its base, because one call cannot bank a tier twice. Both are sums of scorer outputs.
  - Precedent: replay-pack ruling Q20, *"A script may hand the real scorer a reset touch record"* (`docs/audits/20261115_REPLAY_PACK_TRADER_GAME.md:26`).
- **A synthetic battle passes the scope guard.** To call `stockRewardContext` for any anchor and unit, the scripts build a one-position battle that passes `validateStockReceipt`. Its `duration` is `'fullday'` only because the measured route refuses anything else (`src/utils/stockThresholdModel.js:30`).
- **Production:** not read and not written. No Firestore import exists in the scripts.
- **Market data:** 0 EODHD requests (§8).
- **Account ids:** none. The film tape in the replay export is already pseudonymised, and no id or ordinal is printed.
- **Markers.** Every `file:line` here was read at `bd841257` in this session (VERIFIED), except two documents on unmerged branches, marked where cited. MEASURED marks a figure produced by a script in this run. Every figure is from the final run, after the review's fixes.

## 3. Step 1 — how V2's one-day unit was chosen, and the reproduction

### How it was chosen, in plain words

- **What is measured.** One day's typical range: the simple average of the last 14 daily true ranges, divided by the last close, on fully adjusted prices.
  - A true range is the larger of the day's high-to-low and the gap from the prior close to either extreme.
  - Formula: `api/_utils/measuredStockThreshold.js:76–78`.
  - Spec: `docs/specs/BAGGERBOMB_THRESHOLD_CORRECTION_SPEC_V1_1_20261012.md:25` (D1). Wilder smoothing, percentile ranks, blends and extra multipliers were excluded.
- **Window.** The 15 consecutive completed sessions ending at the last completed session before the position is committed (policy `"requiredConsecutiveSessionBars": 15`, `docs/specs/BAGGERBOMB_STOCK_THRESHOLDS_POLICY_V2_20261015.json:23`).
- **Entry rule.**
  - The unit is frozen at the validated fill and counted from the fill for the position's life (policy `:58–59`).
  - It is quantised once, to six decimals, half-even (`api/_utils/stockThresholdAdmission.js:13`).
  - Levels sit at ±1.0, 1.5 and 2.0 units from the fill (`src/utils/stockThresholdModel.js:72`). A level crosses at equality (policy `:62`).
- **Universe.** The ranked catalogue on 12 Oct 2026: 228 of 239 entries qualified (`docs/audits/BAGGERBOMB_MEASUREMENT_CLOSEOUT_20261012.md:82`).
- **The criteria were about measurement, not gameplay.**
  - Its arithmetic matched an independent decimal reference on all 229 complete windows (closeout `:74`).
  - Its inputs and identities qualified.
  - Its publication timing met the provider's 15-minute rule (closeout `:35`).
  - D3 adopted no floor or cap (policy `:49`); a 1% floor would have moved only BRK-B (closeout `:100`).
- **V2 was not calibrated to a bonus frequency, and published no touch rates.** The one-session touch rates below are measured here for the first time, from the same 228 stocks.
- **What V2 published:** one cross-section, the session of 12 Oct 2026.

| Statistic over the 228 qualified stocks | Published |
|---|---|
| Minimum (BRK-B) | 0.9581309339810106% |
| Median (middle-pair mean) | 2.3356234754480862% |
| 95th percentile (nearest rank; ACN) | 4.623061120012764% |
| Maximum (BE) | 7.825987494280925% |
| UNP / HUM / ACN | 1.3613716964571096% / 4.529210743120777% / 4.623061120012764% |

### The reproduction

Script: `step1Reproduce.mjs`. Tolerance, fixed before the run: each stock within 0.5% relative of V2's value, and each of the four statistics within 0.01 percentage points.

| Check | Result (MEASURED) |
|---|---|
| (a) V2's own 12 Oct export through today's calculator | **228 of 228 bit-exact**; all four statistics and UNP / HUM / ACN bit-exact |
| (b) The 17 Nov bars on disk, cut at 12 Oct | 225 of 228 within 0.5%; 71 bit-exact; median gap 0.00004 points. **Misses: NUE 0.86%, SPG 0.62%, BRK-B 0.504%.** All four statistics within 0.005 points of the published values |
| (c) Diagnosis, added after (b) missed; the tolerance was not changed | See below |

What (c) found:
- **131 of the 228 stocks' 12 Oct bars changed after V2's capture.**
  - V2 read them at 5:55–6:00 PM ET, about two hours after the close. The provider then finalised the session high or low.
  - Example: NUE's 12 Oct low reads 250.66 in V2's export and 249.54 in the 17 Nov bars. Both are read from the two files; Step 1 does not print them.
- **With V2's own 12 Oct bar put back, all 228 fall within tolerance** (largest gap 0.157%; 129 bit-exact). The remaining small gaps are revisions of older bars.
- **The two captures' adjustment factors agree.** Their ratio is uniform across every window, so no dividend or split since 12 Oct moves anything.
- **Disclosed:** that uniformity test was first run with a spread limit of 1e-9.
  - It flagged 68 stocks, because EODHD gives `adjusted_close` to four decimals, so even a uniform factor differs row to row by up to about 7e-6. This is reproducible from the two captures and is not written by Step 1.
  - The limit was then set to 0.01%, well below a dividend step of about 0.5%. Any limit from 1e-5 up gives the same answer (review B, Step 1).
  - The limit was chosen after the first run. The per-stock tolerance was never changed.

**Verdict: reproduced.**
- The published figures come back exactly from V2's inputs, and the bars this study uses measure V2's unit.
- The only gaps come from the provider finalising the 12 Oct bar after V2's capture. The setup-frequency count also recorded this effect (`docs/audits/20261117_SETUP_FREQUENCY_COUNT.md`, §1).
- It is not a STOP, because the published figures reproduced. The three per-stock misses are listed here, not hidden.

## 4. Step 2 — the unit

### The holds

Script: `buildHolds.mjs` (MEASURED).
- **Universe:** V2's 228 stocks.
- **Bars:** the 17 Nov setup-frequency export, one EODHD series per stock, 20 Dec 2025 → 17 Nov 2026.
  - Adjusted by V2's own normaliser.
  - Bars before 2026 are not used: the pinned calendar maintains 2026–2027 only (`src/utils/marketCalendar.js:69`).
- **Entry:**
  - The fill is the open of entry session t.
  - The one-day unit comes from the 15 bars ending at t−1, so there is no look-ahead.
  - Every entry gets a one-session hold (t) and a three-session hold (t, t+1, t+2) from the same fill.
- **Window ("V2's sessions plus every session since"):** read here as entries from 22 Sep 2026 to 13 Nov 2026.
  - 22 Sep is the first session of V2's published window. 13 Nov is the last entry whose three sessions end on the last session on disk (17 Nov).
  - That gives **39 entry sessions and 8,892 holds**; nothing was skipped.
  - A longer window, 10 Mar → 13 Nov (174 sessions, 39,672 holds), runs as a check.
  - Review B recomputed every hold without the library and found no difference.
- **U6:** the V2 calculator run on 15 non-overlapping three-session bars ending at t−1. That is 14 three-session true ranges, averaged, over the last close.
- **U2–U5:** these scale the measured one-day unit before admission's 6-decimal quantisation.

**The recommendation rule, fixed before any result was seen** (`lib.mjs:54`, `RECOMMENDATION_RULE`):
- Pick the candidate whose three-session +1.0 touch rate on daily highs is nearest V2's one-session +1.0 touch rate on the same entries.
- Ties go to the smaller mean gap over all six tiers.

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

**Recommended: U5.**
- Its gap to V2's +1.0 rate is 0.4 points. The others are U1 30.3, U2 20.3, U3 11.8, U4 5.8 and U6 5.5.
- The exact multiple of the one-day unit that matches is **×2.03**, read off the real model's own `maxMultiplier`.
- U5's other bonus tiers also sit close to V2's: +1.5 2.7% against 2.6%, and +2.0 0.7% against 0.8%.
- On the penalty side U4 sits nearer V2 than U5 does (−1.0: 12.7% and 8.8% against 11.0%).

**Robustness:**
- **Long window:** V2 9.2%; U5 8.9%, U4 13.2%, U6 11.9%. U5 again, exact ×1.97.
- **Block resampling of sessions** (review B3, refuter R7): U5 is picked in 92–98% of resamples (V2's window) and 97–98% (long).
  - The exact multiple's interval is ×1.86–2.21 (V2) and ×1.90–2.05 (long). √3 = 1.73 lies outside both.
- **Excluding every hold near a split, spin-off or in-hold dividend** (review B6): U5 is still picked in both windows (×2.02).

### The answer depends on where a match fills (sensitivity, added after the first run)

How V2 fills a battle depends on when it is created:
- **Out of hours:** at the prior close, so the opening jump counts as movement after the fill (policy `offHoursCreation`, Ruling 7: `"openingJump": "post_fill_movement"`, `docs/specs/BAGGERBOMB_STOCK_THRESHOLDS_POLICY_V2_20261015.json:97`).
- **During the session:** at the live price.

`step2Units.mjs --fill prior_close` fills every hold at the close of t−1 and leaves the unit unchanged:

| Fill | V2 one-session +1.0 | U4 × √3 | U5 × 2 | U6 measured | Rule picks | Exact multiple |
|---|---|---|---|---|---|---|
| Open, V2's window (primary) | 10.7% | 16.4% | 11.0% | 16.1% | **U5** | ×2.03 |
| Open, long window | 9.2% | 13.2% | 8.9% | 11.9% | **U5** | ×1.97 |
| Prior close, V2's window | 17.1% | 19.2% | 13.7% | 19.0% | **U6** (U4 0.2 points behind) | ×1.83 |
| Prior close, long window | 15.0% | 15.7% | 11.0% | 14.2% | **U4** (U6 0.1 behind; a tie once holds near a factor step are dropped) | ×1.77 |

**Plain reading.**
- A match that starts at the open needs about twice the one-day unit to keep V2's rarity.
- A match that starts from the prior close, with the opening gap counted, needs about √3 times. The opening gap adds proportionally more to a one-session hold than to a three-session one.
- The unit cannot be chosen until FQ-8 fixes how a ranked match fills.
- Steps 3–5 use the open fill. U4 and U6 appear in all of their tables, measured from the open.

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

Each session's close:

| Hold and unit | +1.0 at close 1 / 2 / 3 | −1.0 at close 1 / 2 / 3 |
|---|---|---|
| **V2 one session (U1)** | 5.4% / — / — | 5.2% / — / — |
| U1, three sessions | 5.4 / 14.4 / 21.9% | 5.2 / 11.6 / 16.0% |
| U2 | 2.6 / 9.0 / 15.7% | 2.9 / 7.6 / 11.6% |
| U3 | 1.4 / 5.7 / 11.0% | 1.5 / 4.9 / 8.3% |
| U4 | 0.9 / 3.7 / 8.1% | 0.8 / 3.3 / 5.8% |
| U5 | 0.4 / 2.1 / 5.4% | 0.5 / 2.2 / 4.0% |
| U6 | 0.8 / 3.6 / 7.9% | 0.9 / 3.4 / 5.7% |

On U5 a three-session hold ends beyond its +1.0 line as often as a one-session hold does today: 5.4% each.

### How much the 15-minute check misses (MEASURED, `touchGap.mjs`)

A battle sees a price every 15 minutes, so it never sees a spike between checks. The only stored intraday series on this machine is the film tape in the replay export: 10-minute bars and the price each check saw, in 600 series covering 511 distinct stock-sessions.

- **Agreement.** The tape's 10-minute extremes match the EOD daily high and low (median gap 0.0000%). Same provider.
- **Real checks.** 128 stock-sessions over 11 sessions have a check within 20 minutes of the open and one within 30 minutes of the close.
  - Of the touches daily highs and lows show, the checks saw:
    - +1.0: 23 of 27 (0.85; resampling sessions, 0.76–0.93)
    - +1.5: 9 of 11
    - +2.0: 1 of 4
    - −1.0: 7 of 9
  - Two of the 11 sessions hold 13 of the 27 touches.
- **A second estimate, at the 10-minute closes.** 309 stock-sessions over 26 sessions.
  - Most checks land at :01, :16, :31 and :46, so this is a different grid, not a superset of the check prices and not a bound.
  - Results: +1.0 58 of 70 (0.83; 0.76–0.88); +1.5 19 of 25 (0.76); −1.0 23 of 25.
  - On the 128 sessions both samples cover, they see the same 23 of 27 +1.0 touches.
- **Estimate.**
  - The game sees about 85% of the +1.0 touches daily bars show (between about 75% and 93%), and about 75% of the +1.5 touches.
  - The touch figures in this report (S1, S5 on touch, every "touch" rate above) are about that much too high for the game.
- **One session against three.**
  - These ratios are measured on single sessions; the tape holds too few complete three-session paths to measure directly.
  - A three-session hold gets a second chance: 329 of U5's 981 +1.0 holds touch again on a later session. A gap through the line at the open is seen by the first check, a modelled 91–94% of the time.
  - A visibility model fitted on the tape puts the three-session ratio at 0.85–0.90, against 0.83–0.85 for one session. That moves the game-visible match from ×2.03 to ×2.03–2.07 (×1.97 to ×1.98–2.02 long). U5 stays nearest (review B5).
- **The close.**
  - The last check comes a median 14 minutes before the 16:00 close, and its price sits a median 0.07 units from the close.
  - The +1.0 verdict at the last check differs from the close's in 2 stock-sessions (the close cleared +1.0 in 18). The −1.0 verdict differs in 4 (the close cleared −1.0 in 4).
  - A bank-at-the-bell shape must say which price is "the bell" (FQ-6).
- **How far the day's high sits above the highest check:** median 0.077 one-day units, 90th percentile 0.28. The first check at or past the +1.0 line sits a mean 0.123 one-day units beyond it (median 0.060; 23 sessions). Both feed the check-priced test in §6.
- **Limits:** a handful of sessions; only stocks agents held; one session at a time.

## 5. Step 3 — the scoring shapes

Script: `step3Shapes.mjs` (shape logic in `shapes.mjs`). **Base points always run from the entry.**
- Base = gain% × 10 × the conviction multiplier (Star 2.0, Core 1.5, Support 1.0).
- Plus the flat points of every banked tier: +15 / +30 / +50 and −10 / −20 / −35.
- Tiers add up: reaching +1.5 pays +15 and +30 (`src/utils/baggerBombUtils.js:535–543`; constants `src/constants/baggerBombScoring.js:14–28`).

| Shape | A bonus tier banks when | Penalties |
|---|---|---|
| S1 touch | any session's high (low) reaches it | on touch, from the entry |
| S2 exit only | the end close is beyond it | on touch, from the entry |
| S3 at the bell | any session's close is beyond it; kept | on touch, from the entry |
| S4 | S3, plus C for each session close beyond +1.0 | on touch, from the entry |
| S5 daily reset | each session, from that session's anchor, with the one-day unit frozen at entry; earnable again each day. On touch (legacy) or at each close | on touch, from the day's anchor |

**Two readings, both put to the founder:**
- **Penalties.** The prompt's table defines when a *bonus* banks and gives penalties only an anchor. So penalties keep today's rule, on touch, in every shape. The alternative, penalties following the bonus rule, is run in full below and in §6 (FQ-1).
- **S5's first anchor.** The letter ("levels reset each session from the prior close") anchors day 1 at the prior close. The legacy code anchors the activation day at the entry (`api/cron/agent-evaluate.js:1453` — `|| (isActivationDay ? (battle.portfolio?.startingPrices?.[asset.symbol] || previousClose) : previousClose);`). The letter is the primary; the entry anchor is the variant (FQ-2).

**Cross-check (S5).** On every day of every hold, the tiers the measured model finds for S5 on touch equal the badges the fenced scorer's legacy branch awards (8,892 of 8,892 holds; 39,672 of 39,672 long). The legacy branch was given the same anchor, the one-day unit as `baseATR`, and that day's high and low as extremes.
- **What this shows:** the measured model's six levels and the legacy multiplier thresholds draw the same lines.
- **What it does not show:** the nightly badges a live battle would bank.
  - The nightly path passes no extremes (`api/cron/agent-daily-scores.js:144–150`). It reads the history the 15-minute checks saved (`api/cron/agent-evaluate.js:1458–1464`, saved at `:1605`), so it sees the checks' prices, not the day's high and low.
  - On day 1 it anchors at the entry.
  - S5's on-touch figures are therefore an upper bound on what the dormant nightly path would pay (review A7).

**Matches.** Seven distinct stocks are entered at the same open: 400 seeded draws per entry session, 15,600 matches in all.
- Slots: Star, Star, Core, Core, Support, Support, Support.
- Every shape uses the same draws.
- "Matches with none" counts the sampled matches, because positions entered on the same day move together.

### Per 7-position match (MEASURED, V2's window)

| Shape · unit | Bonuses | Busts | Crashes | Meltdowns | Bonus share | Bonus + penalty share | Final score: median [10th, 90th pct] | Match-days with a bonus | Matches with none | Give-backs |
|---|---|---|---|---|---|---|---|---|---|---|
| **One-day game (V2, touch)** | **0.98** | 0.77 | 0.23 | 0.07 | 11.3% | 19.9% | 8 [−129, 154] | **47.3%** | 52.7% | 48.0% |
| One-day game, exit only | 0.51 | 0.77 | 0.23 | 0.07 | 6.4% | 15.4% | 2 [−132, 133] | 27.1% | 72.9% | 0% |
| S1 · U1 | 5.21 | 2.38 | 1.22 | 0.60 | 27.3% | 41.9% | 60 [−303, 458] | 62.3% | 8.3% | 49.5% |
| S2 · U1 | 2.68 | 2.38 | 1.22 | 0.60 | 15.9% | 32.9% | −1 [−340, 363] | 23.7% | 28.8% | 0% |
| S3 · U1 | 3.31 | 2.38 | 1.22 | 0.60 | 18.7% | 35.1% | 12 [−331, 383] | 44.9% | 20.6% | 17.4% |
| S4 · U1 · C 5 / 10 / 15 | 3.31 | 2.38 | 1.22 | 0.60 | 21.4 / 23.9 / 26.3% | 37.2 / 39.3 / 41.2% | 25 / 37 / 50 [−326…−318, 411…470] | 44.9% (51.7% with carries) | 20.6% | 16.9 / 16.6 / 16.4% |
| S1 · U4 | 1.57 | 0.88 | 0.27 | 0.08 | 9.8% | 15.0% | 20 [−245, 301] | 28.2% | 39.6% | 52.6% |
| S2 · U4 | 0.76 | 0.88 | 0.27 | 0.08 | 4.9% | 10.4% | 7 [−254, 272] | 12.7% | 62.0% | 0% |
| S3 · U4 | 0.88 | 0.88 | 0.27 | 0.08 | 5.6% | 11.1% | 9 [−252, 275] | 17.9% | 57.0% | 13.5% |
| S4 · U4 · C 5 / 10 / 15 | 0.88 | 0.88 | 0.27 | 0.08 | 6.9 / 8.2 / 9.5% | 12.4 / 13.6 / 14.8% | 11 / 14 / 17 [−251…−248, 286…307] | 17.9% (21.1%) | 57.0% | 13.3 / 13.1 / 13.0% |
| S1 · U6 | 1.55 | 0.87 | 0.26 | 0.09 | 9.7% | 15.0% | 20 [−245, 303] | 27.7% | 41.1% | 52.6% |
| S2 · U6 | 0.75 | 0.87 | 0.26 | 0.09 | 4.9% | 10.5% | 8 [−255, 271] | 12.4% | 62.7% | 0% |
| S3 · U6 | 0.88 | 0.87 | 0.26 | 0.09 | 5.7% | 11.2% | 9 [−253, 276] | 17.6% | 57.8% | 14.4% |
| S4 · U6 · C 5 / 10 / 15 | 0.88 | 0.87 | 0.26 | 0.09 | 7.0 / 8.2 / 9.5% | 12.4 / 13.6 / 14.8% | 12 / 15 / 17 [−251…−249, 287…308] | 17.6% (20.7%) | 57.8% | 14.0 / 13.7 / 13.5% |
| **S1 · U5** | **1.01** | 0.60 | 0.16 | 0.05 | 6.5% | 10.1% | 16 [−239, 281] | 20.2% | 53.2% | 54.9% |
| **S2 · U5** | **0.47** | 0.60 | 0.16 | 0.05 | 3.0% | 6.8% | 8 [−243, 258] | 9.4% | 71.9% | 0% |
| **S3 · U5** | **0.55** | 0.60 | 0.16 | 0.05 | 3.5% | 7.2% | 9 [−242, 261] | 12.4% | 68.3% | 13.4% |
| **S4 · U5 · C 5 / 10 / 15** | **0.55** | 0.60 | 0.16 | 0.05 | 4.4 / 5.3 / 6.2% | 8.1 / 9.0 / 9.8% | 11 / 12 / 14 [−241, 269…282] | 12.4% (14.6%) | 68.3% | 12.9 / 12.5 / 12.3% |
| S5 on touch, prior-close anchor | 5.40 | 2.86 | 0.97 | 0.40 | 26.0% | 39.6% | 57 [−248, 396] | 59.5% | 10.4% | 50.1% |
| S5 at each close, prior-close anchor | 2.93 | 2.86 | 0.97 | 0.40 | 16.1% | 31.5% | 8 [−284, 316] | 37.8% | 26.7% | 26.2% |
| S5 on touch, entry anchor (variant) | 4.61 | 2.70 | 0.88 | 0.34 | 23.0% | 36.1% | 43 [−260, 381] | 55.3% | 12.2% | 49.4% |
| S5 at each close, entry anchor (variant) | 2.48 | 2.70 | 0.88 | 0.34 | 14.0% | 28.6% | 6 [−290, 310] | 34.4% | 29.3% | 23.7% |

How to read the measures:
- **Bonus share:** bonus points (carries included) as a share of all absolute points (|base| + bonuses + |penalties|).
- **Match-days with a bonus:** the share of a match's days on which at least one tier bonus banks. The bracket also counts S4's carries. A carry follows a banked +1.0 tier, so it never rescues a match with no bonus.
- **Give-backs:** the share of bonus points (carries included for S4) paid on tiers whose level the end close no longer clears.
- **Base points alone:** they spread about twice as wide over three days. The 10th–90th percentile of a match's base points is −223 to +239, against −107 to +115 for today's one-day game.

**Under water and paid (S5).** This counts S5 bonuses paid while the position is below its entry price at that moment. On touch, that moment's price is the level, or the open when the session opened beyond the level. At each close, it is the close.

| S5 variant | Bonuses | Paid under water | Session-1 level at or below the fill (crossed by the overnight move before entry) |
|---|---|---|---|
| On touch, prior-close anchor | 6,858 | 449 (6.5%) | 217 (3.2%) |
| At each close, prior-close anchor | 3,727 | 178 (4.8%) | 140 (3.8%) |
| On touch, entry anchor | 5,861 | 449 (7.7%) | 0 |
| At each close, entry anchor | 3,147 | 146 (4.6%) | 0 |

Every on-touch under-water bonus falls on sessions 2–3, where the two anchors agree, which is why the count is 449 under both.

**Sensitivity: penalties bank by the shape's own bonus rule** (at the end close for S2, at any close for S3 and for S5 at each close), per match (MEASURED):

| Shape · unit (penalties at the close) | Bonuses | Busts | Crashes | Meltdowns | Bonus + penalty share | Final score: median [10th, 90th] | Mean |
|---|---|---|---|---|---|---|---|
| One-day game, exit only | 0.51 | 0.37 | 0.11 | 0.03 | 11.1% | 7 [−119, 138] | 5.0 |
| S2 · U1 / S3 · U1 | 2.68 / 3.31 | 1.12 / 1.44 | 0.58 / 0.70 | 0.28 / 0.35 | 26.2 / 30.4% | 34 / 39 [−288…−280, 382…396] | 42.2 / 48.0 |
| S2 · U4 / S3 · U4 | 0.76 / 0.88 | 0.40 / 0.49 | 0.12 / 0.15 | 0.04 / 0.04 | 7.7 / 8.8% | 14 / 15 [−238…−236, 275…278] | 16.8 / 17.6 |
| S2 · U6 / S3 · U6 | 0.75 / 0.88 | 0.40 / 0.49 | 0.12 / 0.14 | 0.04 / 0.05 | 7.7 / 8.9% | 14 / 16 [−238…−236, 274…278] | 16.8 / 17.7 |
| S2 · U5 / S3 · U5 | 0.47 / 0.55 | 0.28 / 0.35 | 0.07 / 0.08 | 0.03 / 0.03 | 4.9 / 5.7% | 12 / 12 [−234…−232, 260…263] | 13.5 / 13.9 |
| S5 at each close | 2.93 | 1.41 | 0.49 | 0.20 | 25.8% | 36 [−245, 342] | 43.2 |

What the tables say:
- **On U5 the three-day match banks about as many bonuses as today's one-day match under the same banking rule:** 1.01 against 0.98 on touch, and 0.47 against 0.51 under exit only. It takes three days to do it.
- **Bonuses carry half the weight:** 6.5% of points against 11.3%, because base points spread about twice as wide.
- **On the unscaled unit the three-day match is bonus-rich:** 5.21 bonuses on touch, 27% of points.
- **Moving penalties to the close roughly halves them** on every unit, and lifts the typical score (S2 · U1 median −1 → 34; S2 · U5 8 → 12).

## 6. Step 4 — the snap-exit test

Script: `step4SnapExit.mjs`. It takes every three-session hold whose daily high reaches its +1.0 line, first on session d, and compares three policies:
- **SELL:** sold at the line on session d. Base points at the line, plus what the shape banks: the +1.0 tier, and the penalties touched before the sale. The slot holds cash to the end.
  - On session d itself, daily bars cannot order the high and the low. The primary reads the bar as open → low → high → close when it closed at or above its open, and as open → high → low → close otherwise.
- **BELL:** held to the close of session d; sold there if that close is still beyond the line, otherwise held to the end.
- **HOLD:** held to the end.

Each S5 variant uses its own daily +1.0 line, the one-day unit from that day's anchor.

**Pricing of S5's day-1 gap-through, corrected in review C2.** On session 1 under the prior-close anchor, a stock that gapped through the line at the open has its line *below* the fill. The first chance to sell is the fill itself, so that sale is priced at the open. The line price is kept as a variant.

**The one-session game is the baseline:** SELL at the line against holding to that session's close. On one session BELL and HOLD are the same sale.

| Line (V2's window) | Holds reaching +1.0 | First on session 1 / 2 / 3 | Same-session penalty (primary order) | Session d opened beyond the line |
|---|---|---|---|---|
| **One-session game (U1)** | 947 | 947 / — / — | 22 | 0 |
| U1 | 3,643 | 947 / 1,604 / 1,092 | 54 | 641 |
| U4 | 1,459 | 143 / 549 / 767 | 6 | 238 |
| U6 | 1,432 | 140 / 555 / 737 | 4 | 236 |
| U5 | 981 | 74 / 353 / 554 | 2 | 163 |
| S5 daily line | 3,747 | 1,520 / 1,272 / 955 | 57 | 353. The line sat below the fill in 152 / 112 / 196 by session of first touch: on session 1 always a gap-through; on sessions 2–3, a position more than a unit under water |

Long window (174 sessions):
- One-session game: 3,663.
- U1: 14,384 (3,663 / 6,331 / 4,390).
- U4: 5,242. U6: 4,719.
- U5: 3,533 (209 / 1,390 / 1,934).
- S5: 15,057 (line below the fill on session 1: 542 of 5,948).

### The verdicts

**Uncertainty.** Holds entered on the same day move together, so whole entry sessions are resampled, not holds.
- Consecutive entries share two of their three sessions, so the resample draws **circular blocks of 3 consecutive entry sessions** (review A8, B3).
- On the long window this widens the intervals by about 10–25%; on V2's window it does not.
- Margins are SELL minus the next-best policy, per Support position, with 90% intervals.
- "Best in x%" is the share of 2,000 resamples in which SELL has the highest average of the three policies.

| Shape · unit | V2's window: SELL − next best [90%] · SELL best | Long window: SELL − next best [90%] · SELL best | Best on average (V2 / long) | **Verdict** | Check-priced: V2 · long → verdict |
|---|---|---|---|---|---|
| **One-session game, touch** | −11.4 [−16.0, −6.6] · 0.0% | −8.7 [−10.5, −7.0] · 0.0% | HOLD / HOLD | **SELL loses** | −14.3 · 0.0% / −11.5 · 0.0% → loses |
| **One-session game, exit only** | +1.2 [−4.2, +6.7] · 68.3% | +4.1 [+2.0, +6.0] · 99.8% | SELL / SELL | **SELL wins\*** | −1.4 · 40.8% / +1.4 · 83.8% → **even** |
| S1 · U1 / U4 / U6 / U5 | −29.7 / −11.1 / −12.2 / −9.7 · 0.0% | −28.3 / −15.0 / −15.0 / −13.8 · 0.0% | HOLD / HOLD | **SELL loses** | all loses |
| S2 · U1 | −7.9 [−13.4, −2.8] · 0.7% | −7.0 [−9.5, −4.3] · 0.0% | BELL / HOLD | **SELL loses** | loses |
| S2 · U4 | +1.8 [−2.5, +6.0] · 75.0% | −1.1 [−4.2, +1.6] · 25.7% | SELL / HOLD | **even†** | +4.1 · 94.5% / +2.0 · 87.3% → even |
| S2 · U6 | +1.8 [−3.4, +6.3] · 68.6% | −1.3 [−4.6, +1.7] · 25.2% | SELL / HOLD | **even†** | +4.9 · 93.0% / +1.7 · 80.5% → even |
| S2 · U5 | +3.2 [−1.6, +7.8] · 87.1% | −0.6 [−4.2, +2.4] · 37.6% | SELL / HOLD | **even†** | +6.2 · 97.8% / +2.9 · 92.7% → **SELL wins\*** |
| S3 · U1 | −12.3 [−17.5, −5.5] · 0.3% | −11.1 [−13.7, −8.5] · 0.0% | HOLD / HOLD | **SELL loses** | loses |
| S3 · U4 | +1.1 [−3.7, +5.8] · 63.3% | −3.1 [−6.2, −0.1] · 4.5% | SELL / HOLD | **even†** | +3.1 · 86.0% / −0.3 · 44.5% → even |
| S3 · U6 | +0.2 [−5.0, +5.6] · 51.6% | −3.3 [−6.6, −0.2] · 4.1% | SELL / HOLD | **even†** | +3.0 · 82.1% / −0.6 · 38.6% → even |
| S3 · U5 | +2.4 [−2.4, +7.2] · 80.0% | −2.2 [−5.9, +1.0] · 13.4% | SELL / HOLD | **even†** | +5.1 · 94.9% / +1.0 · 72.5% → even |
| S4 · C = 5 · U1 / U4 / U6 / U5 | −17.4 / −2.7 / −3.6 / −1.2 · 0.0 / 17.8 / 14.2 / 33.1% | −16.0 / −7.0 / −7.2 / −5.9 · 0.0 / 0.1 / 0.0 / 0.1% | HOLD / HOLD | **loses / loses\*† / loses\* / loses\*†** | loses / loses\* / loses\* / **even** (+1.1 · 62.8% / −3.2 · 5.1%) |
| S4 · C = 10 · U1 / U4 / U6 / U5 | −22.5 / −6.6 / −7.5 / −4.8 · 0.0 / 3.0 / 2.4 / 7.9% | −20.8 / −11.0 / −11.2 / −9.7 · 0.0% | HOLD / HOLD | **loses / loses / loses / loses\*** | loses / loses\* / loses\* / loses\* |
| S4 · C = 15 · U1 / U4 / U6 / U5 | −27.5 / −10.4 / −11.3 / −8.5 · 0.0 / 0.4 / 0.4 / 0.8% | −25.6 / −14.9 / −15.1 / −13.4 · 0.0% | HOLD / HOLD | **SELL loses** | all loses |
| S5 on touch | −19.9 [−24.8, −15.6] · 0.0% | −17.7 [−19.9, −15.3] · 0.0% | HOLD / HOLD | **SELL loses** | — |
| S5 at each close | −3.8 [−8.1, +0.8] · 8.6% | −0.4 [−2.6, +1.5] · 35.1% | BELL / BELL | **even†** | — |

For the one-session game, "HOLD" is the shared BELL = HOLD sale.

**The check-priced column (review B1).** Selling exactly at the line on a session whose *daily high* reached it flatters SELL in one way and handicaps it in another:
- **The flattery.** An agent sells only at a 15-minute check, at that check's quote (`api/cron/agent-evaluate.js`; `api/_utils/agentSwapExecution.js`), so a line the high only just reached is often never seen.
- **The handicap.** A check that does see the line usually sells past it.
- **What the column does** (`step4SnapExit.mjs`, from `touch-gap.json`):
  - Each non-gap case is weighted by the share of tape sessions whose shortfall (the day's high above the highest check) is no more than the case's excess (the high above the line).
  - The sale is priced at the line plus the tape's mean overshoot (0.123 one-day units), capped at the highest check.
  - Within that band the banked set never changes, so the fenced scorer is called once, at the mean sale price.
  - Gap-throughs are seen by the first check and sold at the open.
- **Calibration:** these weights predict 22.4 of the 27 tape touches the checks should see; 23 were seen (refuter R8). About 82% of three-session and 76% of one-session touches are seen.
- **Weights alone, sale at the line:** these figures are in `step4.md`. Exit-only on U4–U6 still leads in V2's window and is within noise.

**Answering the prompt: which shapes make SELL the best policy on average, and by how much?**
- **None clearly, with a sale at the line on daily bars.**
  - Under exit only (S2) and at the bell (S3) on U4–U6, SELL leads in V2's window by +0.2 to +3.2 over the next best. It trails over the long window by 0.6 to 3.3.
  - Every one of those cells reads "even". Pricing gap-throughs at the open (†) flips them back to SELL on the long window.
- **Exit only on U5, priced as a check would sell:** SELL wins\*. It leads by +6.2 in V2's window (97.8% of resamples) and by +2.9 over the long window (92.7%), per Support position.
- **The one-day exit-only game:** SELL wins\* with a sale at the line (+4.1 over March–November, 99.8%). Priced as a check would sell, it is even (−1.4 / +1.4).
- **Everywhere else SELL loses**, and at C = 10–15 under every pricing.

### Points per policy, V2's window (Support)

| Shape · unit | n | Mean SELL / BELL / HOLD | Median SELL / BELL / HOLD | Single best: SELL / BELL / HOLD · BELL = HOLD | SELL beats HOLD |
|---|---|---|---|---|---|
| One-session game, touch | 947 | 42.3 / 53.7 / 53.7 | 40 / 41 / 41 | 43% / — / — · 100% | 43% |
| One-session game, exit only | 947 | 42.3 / 41.1 / 41.1 | 40 / 34 / 34 | 50% / — / — · 100% | 50% |
| S1 · U1 | 3,643 | 41.4 / 64.3 / 71.1 | 39 / 50 / 60 | 29% / 15% / 21% · 64% | 35% |
| S2 · U1 | 3,643 | 41.4 / 49.2 / 48.9 | 39 / 41 / 36 | 34% / 19% / 16% · 64% | 47% |
| S3 · U1 | 3,643 | 41.4 / 49.6 / 53.6 | 39 / 41 / 40 | 34% / 19% / 17% · 64% | 44% |
| S4 · U1 · C 5 / 10 / 15 | 3,643 | 41.4 / 53.1…60.2 / 58.7…68.9 | 39 / 46…56 / 45…56 | 33–34% / 13–16% / 20–23% · 64% | 38–42% |
| S1 · U4 | 1,459 | 60.6 / 69.9 / 71.8 | 55 / 59 / 58 | 38% / 11% / 12% · 76% | 45% |
| S2 · U4 | 1,459 | 60.6 / 58.9 / 57.5 | 55 / 53 / 49 | 42% / 13% / 10% · 76% | 51% |
| S3 · U4 | 1,459 | 60.6 / 59.0 / 59.5 | 55 / 53 / 50 | 42% / 13% / 10% · 76% | 50% |
| S4 · U4 · C 5 / 10 / 15 | 1,459 | 60.6 / 61.9…67.8 / 63.4…71.1 | 55 / 57…66 / 55…64 | 42% / 9–11% / 12–14% · 76% | 46–49% |
| S1 · U6 | 1,432 | 61.0 / 70.5 / 73.2 | 56 / 60 / 59 | 40% / 10% / 12% · 77% | 46% |
| S2 · U6 | 1,432 | 61.0 / 59.3 / 58.6 | 56 / 54 / 50 | 42% / 12% / 10% · 77% | 51% |
| S3 · U6 | 1,432 | 61.0 / 59.4 / 60.8 | 56 / 54 / 52 | 42% / 12% / 10% · 77% | 50% |
| S4 · U6 · C 5 / 10 / 15 | 1,432 | 61.0 / 62.4…68.3 / 64.7…72.4 | 56 / 58…68 / 57…66 | 42% / 9–10% / 12–14% · 77–78% | 46–48% |
| S1 · U5 | 981 | 67.6 / 75.2 / 77.3 | 61 / 62 / 62 | 41% / 9% / 10% · 80% | 47% |
| S2 · U5 | 981 | 67.6 / 64.4 / 63.4 | 61 / 57 / 54 | 44% / 11% / 9% · 80% | 51% |
| S3 · U5 | 981 | 67.6 / 64.4 / 65.2 | 61 / 57 / 56 | 44% / 10% / 9% · 80% | 51% |
| S4 · U5 · C 5 / 10 / 15 | 981 | 67.6 / 67.3…73.0 / 68.8…76.0 | 61 / 62…71 / 61…70 | 43–44% / 8–10% / 10–12% · 80% | 47–49% |
| S5 on touch | 3,747 | 29.1 / 48.9 / 49.0 | 31 / 43 / 42 | 29% / 20% / 19% · 60% | 38% |
| S5 at each close | 3,747 | 29.1 / 33.0 / 31.0 | 31 / 32 / 28 | 39% / 21% / 18% · 60% | 51% |

**Reading the single-best shares (review A4).**
- BELL and HOLD are the same sale whenever the line is first reached on session 3, or when session d closes back under the line. That happens in 64% of holds on U1 and 76–80% on U4–U6, so the three-way shares are mostly SELL against one shared held outcome.
- SELL is never the single best when BELL and HOLD differ.
- Head to head, SELL beats HOLD in 50–51% of holds under exit-only and at-the-bell on the scaled units, and in 46–49% under the carry.
- Under the carry, HOLD's edge is a broad shift of about one carry, not a long right tail.

### By session of first touch (Support, V2's window)

Each cell gives n · mean SELL / BELL / HOLD · median SELL / BELL / HOLD · single best SELL / BELL / HOLD % · best on average. On session 3, BELL and HOLD are the same sale, so "BELL" there means the shared held outcome.

| Shape · unit | Session 1 | Session 2 | Session 3 |
|---|---|---|---|
| One-session game, touch | 947 · 42.3/53.7/53.7 · 40/41/41 · 43/0/0% · HOLD | — | — |
| One-session game, exit only | 947 · 42.3/41.1/41.1 · 40/34/34 · 50/0/0% · SELL | — | — |
| S1 · U1 | 947 · 42.3/67.2/80.6 · 40/55/72 · 22/18/31% · HOLD | 1604 · 41.9/64.3/71.8 · 39/54/65 · 27/23/29% · HOLD | 1092 · 39.8/61.8/61.8 · 38/44/44 · 38/0/0% · BELL |
| S2 · U1 | 947 · 42.3/51.8/53.6 · 40/43/36 · 27/25/24% · HOLD | 1604 · 41.9/49.5/47.6 · 39/42/35 · 31/28/23% · BELL | 1092 · 39.8/46.6/46.6 · 38/36/36 · 44/0/0% · BELL |
| S3 · U1 | 947 · 42.3/53.2/62.2 · 40/44/46 · 27/24/25% · HOLD | 1604 · 41.9/49.5/53.4 · 39/42/40 · 31/28/23% · HOLD | 1092 · 39.8/46.6/46.6 · 38/36/36 · 44/0/0% · BELL |
| S4 C=5 · U1 | 947 · 42.3/57.7/69.5 · 40/49/54 · 26/22/28% · HOLD | 1604 · 41.9/52.9/58.7 · 39/46/47 · 31/23/29% · HOLD | 1092 · 39.8/49.4/49.4 · 38/40/40 · 44/0/0% · BELL |
| S4 C=10 · U1 | 947 · 42.3/62.1/76.9 · 40/55/62 · 25/21/30% · HOLD | 1604 · 41.9/56.4/64.0 · 39/51/54 · 31/20/33% · HOLD | 1092 · 39.8/52.2/52.2 · 38/45/45 · 44/0/0% · BELL |
| S4 C=15 · U1 | 947 · 42.3/66.6/84.3 · 40/60/70 · 25/20/31% · HOLD | 1604 · 41.9/59.9/69.3 · 39/56/62 · 31/19/34% · HOLD | 1092 · 39.8/55.0/55.0 · 38/50/50 · 44/0/0% · BELL |
| S1 · U4 | 143 · 60.2/65.6/66.9 · 55/60/52 · 26/25/24% · HOLD | 549 · 60.9/72.5/77.2 · 56/61/62 · 33/23/25% · HOLD | 767 · 60.5/68.8/68.8 · 55/57/57 · 44/0/0% · BELL |
| S2 · U4 | 143 · 60.2/56.4/48.4 · 55/58/40 · 29/31/17% · SELL | 549 · 60.9/61.5/60.0 · 56/55/48 · 35/27/22% · BELL | 767 · 60.5/57.4/57.4 · 55/50/50 · 49/0/0% · SELL |
| S3 · U4 | 143 · 60.2/57.1/54.6 · 55/58/47 · 29/30/18% · SELL | 549 · 60.9/61.5/63.7 · 56/55/52 · 35/27/22% · HOLD | 767 · 60.5/57.4/57.4 · 55/50/50 · 49/0/0% · SELL |
| S4 C=5 · U4 | 143 · 60.2/61.3/61.3 · 55/63/54 · 28/30/23% · HOLD | 549 · 60.9/64.8/68.7 · 56/60/58 · 35/22/27% · HOLD | 767 · 60.5/60.0/60.0 · 55/53/53 · 49/0/0% · SELL |
| S4 C=10 · U4 | 143 · 60.2/65.5/68.1 · 55/69/61 · 28/26/27% · HOLD | 549 · 60.9/68.0/73.6 · 56/65/63 · 35/20/29% · HOLD | 767 · 60.5/62.5/62.5 · 55/58/58 · 49/0/0% · BELL |
| S4 C=15 · U4 | 143 · 60.2/69.7/74.9 · 55/74/66 · 28/24/29% · HOLD | 549 · 60.9/71.3/78.5 · 56/70/69 · 35/19/31% · HOLD | 767 · 60.5/65.0/65.0 · 55/61/61 · 49/0/0% · BELL |
| S1 · U6 | 140 · 58.8/72.7/77.1 · 55/61/61 · 21/24/24% · HOLD | 555 · 61.8/70.9/76.7 · 56/61/62 · 37/20/25% · HOLD | 737 · 60.9/69.8/69.8 · 56/59/59 · 45/0/0% · BELL |
| S2 · U6 | 140 · 58.8/62.5/58.9 · 55/57/47 · 24/30/17% · BELL | 555 · 61.8/59.6/58.8 · 56/55/47 · 38/24/20% · SELL | 737 · 60.9/58.4/58.4 · 56/52/52 · 49/0/0% · SELL |
| S3 · U6 | 140 · 58.8/63.7/66.2 · 55/58/51 · 24/28/19% · HOLD | 555 · 61.8/59.6/62.7 · 56/55/52 · 38/24/20% · HOLD | 737 · 60.9/58.4/58.4 · 56/52/52 · 49/0/0% · SELL |
| S4 C=5 · U6 | 140 · 58.8/68.5/73.7 · 55/63/62 · 22/27/24% · HOLD | 555 · 61.8/62.7/67.3 · 56/60/58 · 38/20/25% · HOLD | 737 · 60.9/61.0/61.0 · 56/55/55 · 49/0/0% · BELL |
| S4 C=10 · U6 | 140 · 58.8/73.3/81.1 · 55/69/70 · 22/24/28% · HOLD | 555 · 61.8/65.8/72.0 · 56/65/63 · 38/19/27% · HOLD | 737 · 60.9/63.5/63.5 · 56/59/59 · 49/0/0% · BELL |
| S4 C=15 · U6 | 140 · 58.8/78.0/88.6 · 55/74/76 · 22/22/29% · HOLD | 555 · 61.8/68.9/76.6 · 56/70/68 · 38/17/29% · HOLD | 737 · 60.9/66.1/66.1 · 56/63/63 · 49/0/0% · BELL |
| S1 · U5 | 74 · 69.0/69.4/73.8 · 63/64/60 · 28/22/24% · HOLD | 353 · 67.7/78.0/82.8 · 62/65/66 · 35/20/24% · HOLD | 554 · 67.3/74.2/74.2 · 61/61/61 · 46/0/0% · BELL |
| S2 · U5 | 74 · 69.0/61.2/58.0 · 63/60/51 · 28/27/19% · SELL | 353 · 67.7/67.3/65.2 · 62/60/53 · 37/24/20% · SELL | 554 · 67.3/63.0/63.0 · 61/57/57 · 50/0/0% · SELL |
| S3 · U5 | 74 · 69.0/61.8/64.1 · 63/61/54 · 28/26/20% · SELL | 353 · 67.7/67.3/68.8 · 62/60/55 · 37/24/20% · HOLD | 554 · 67.3/63.0/63.0 · 61/57/57 · 50/0/0% · SELL |
| S4 C=5 · U5 | 74 · 69.0/66.0/70.9 · 63/66/62 · 28/31/23% · HOLD | 353 · 67.7/70.4/73.5 · 62/64/62 · 37/21/24% · HOLD | 554 · 67.3/65.5/65.5 · 61/60/60 · 50/0/0% · SELL |
| S4 C=10 · U5 | 74 · 69.0/70.2/77.7 · 63/71/67 · 28/26/28% · HOLD | 353 · 67.7/73.6/78.2 · 62/69/67 · 37/19/26% · HOLD | 554 · 67.3/68.0/68.0 · 61/65/65 · 50/0/0% · BELL |
| S4 C=15 · U5 | 74 · 69.0/74.4/84.5 · 63/76/73 · 26/26/28% · HOLD | 353 · 67.7/76.7/83.0 · 62/74/73 · 37/17/28% · HOLD | 554 · 67.3/70.5/70.5 · 61/69/69 · 50/0/0% · BELL |
| S5 on touch | 1520 · 31.9/52.2/54.8 · 29/45/45 · 24/25/26% · HOLD | 1272 · 32.3/53.5/50.9 · 35/47/43 · 28/30/24% · BELL | 955 · 20.6/37.4/37.4 · 31/36/36 · 38/0/0% · BELL |
| S5 at each close | 1520 · 31.9/35.0/34.1 · 29/32/28 · 36/26/25% · BELL | 1272 · 32.3/38.1/33.4 · 35/34/31 · 38/31/23% · BELL | 955 · 20.6/22.8/22.8 · 31/24/24 · 45/0/0% · BELL |

The long window's version, and the Star tier, are in the run folder's `step4-long.md` and `step4.md`.

### Variants, and whether a Support verdict changes

- **The order of the high and the low on session d.** A penalty touched in the same session as the line is counted always, or never. Neither changes any verdict. The cases are few: 2–57 (V2), 3–167 (long).
- **A gap through the line, filled at the open (†).**
  - V2's window: S4 · C = 5 flips to SELL on U4 and U5.
  - Long window: S2 and S3 on U4–U6 flip to SELL, and so does S5 at each close.
- **S5's day-1 gap sale at the line** (the old primary). It sells below the price paid: 41 such sales in V2's window and 200 long were at a price never traded after the fill. Under it, S5 at each close read "BELL", SELL best in 1–3% of resamples. Priced at the open it reads even.
- **S4 + BELL.** The variant settles whether the close BELL sells at earns its carry. No verdict changes.
- **Penalties bank by the shape's own bonus rule** (FQ-1). No SELL verdict changes.
  - S2–S4 move by at most 0.7 points.
  - The one-session exit-only game: +4.1 → +4.0 (long).
  - S5 at each close: SELL loses more (−3.8 → −5.1 in V2's window), and its long-window best-on-average flips from BELL to HOLD.
- **Star position (conviction 2.0), the check.** The verdicts point the same way as the Support rows in the primary, with three differences:
  - a few cells are one notch weaker (C = 10 on U4 and U6 reads "SELL loses\*", not "SELL loses");
  - S5 on touch's best-on-average is BELL in V2's window;
  - check-priced, exit-only and at-the-bell on U4–U6 lead by +6.1 to +9.2 per Star position in V2's window (87–97% of resamples).

## 7. Step 5 — one day against three

Script: `step5OneVsThree.mjs`. The same seeded seven-stock matches, with no setup filter, are each scored two ways:
- **one 3-day match**, entered at the open of session 1 and held to the close of session 3;
- **three consecutive 1-day matches**: the same seven stocks re-entered at each open, each with that day's one-day unit.

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

**How much the overnight gaps decide (MEASURED).** These are price moves, not scores or wins:
- **28.5%** of the variance of a match's three-day conviction-weighted log return comes from the two overnight moves. 78.6% comes from the three sessions, and the covariance is −7.1%. Long window: 27.6%, 77.1% and −4.7%.
- Removing the two overnight moves changes the sign of that return in **16.1%** of matches (16.6% long).
- Per position, 31.9% of the absolute movement is overnight (30.4% long).
- On U5 under touch, 1,197 of 1,277 bonus first-touches come on sessions 2 or 3. **209 of those (17.5%) happen at the open**, by a gap through the level. Long window: 776 of 4,419, 17.6%.

Two readings:
- **Per day, the one-day game pays about three times the bonuses** of a three-day match on U5 under touch (0.97 against 0.34). Against exit-only or at-the-bell it pays about six times as many (0.16–0.18).
- **The unscaled unit under exit only nearly matches today's game per day** (0.89 against 0.97). But it puts a stock beyond its +1.0 line at the end in 21.9% of holds, and on that unit selling at the line clearly loses (§6).

**The setup payoff check.** None is merged, but one dated 18 Nov 2026 exists in this machine's checkout: `docs/audits/20261118_SETUP_PAYOFF_CHECK.md` on another session's local branch, `claude/setup-payoff-check` at `7133ec29`. It is not pushed, its review is pending, and its figures may change. As it stands, it compares a fresh Pullback-and-Resume setup with stocks that have none. Its "unit" is the record's own ATR ÷ close, so the three-session move is also in one-day units. Its one-session and three-session results, with 90% intervals from resampling sessions, short window / all of 2026:

| Comparison | Short window (120 sessions) | All of 2026 (221 sessions) |
|---|---|---|
| Setup vs uptrending stocks with no setup, **three sessions** | better +0.146 [+0.053, +0.247] | no clear difference +0.027 [−0.042, +0.095] |
| Setup vs uptrending stocks, **one session** | no clear difference −0.032 [−0.085, +0.019] | no clear difference −0.010 [−0.050, +0.030] |
| Setup vs every stock, **three sessions** | no clear difference −0.005 [−0.086, +0.074] | no clear difference −0.033 [−0.091, +0.025] |
| Setup vs every stock, **one session** | worse −0.047 [−0.091, −0.003] | no clear difference −0.009 [−0.041, +0.025] |

Beside this section, the draft says a valid setup does not reliably move further over three sessions than over one. It does not beat an ordinary stock over either.

## 8. Market-data requests and production

- **EODHD requests: 0.**
  - Every bar came from the 17 Nov setup-frequency export (`C:/Users/fashr/Documents/FantasyTrades/SetupFrequency/run-20261117/bars/`). That run counted its own 241 requests in its ledger.
  - The Oct 12 evidence and the replay export were already on disk.
  - One review check (B7) compared the 17 Nov bars with a later capture another session had already saved (`SetupPayoff/run-20261118/bars/`).
- **18 Nov was not fetched.** It would have cost 228 requests to add one entry session, and the prompt prefers local bars. The window ends at the 17 Nov close.
- **Production: 0 reads, 0 writes.**

## 9. What a trader v1 build must change to admit a second unit

Cited at `bd841257`, all VERIFIED; nothing was changed. "Concept-fenced" means the file is not on BUILD_RULES §1's list, but the change alters the scoring engine or the creation record, which §1 fences as concepts.

| # | Where | What blocks a second unit | Fence |
|---|---|---|---|
| 1 | `src/utils/stockThresholdModel.js:29` — `if (!sameModel(stamp) \|\| instantMs(stamp.admittedAt) === null) return unavailable('unsupported_stock_model');` | `sameModel` (`:23`) compares a stamp to the ONE frozen `STOCK_MODEL` (`:7–13`, model `stock_measured_atr14_fullday_v2`). A second model is refused as unsupported. Needs a model registry | Concept-fenced (scoring engine) |
| 2 | `src/utils/stockThresholdModel.js:30` — `if (battle.gameMode !== 'baggerbomb_agent' \|\| battle.duration !== 'fullday' \|\| !battle.opponent?.portfolio) return unavailable('unsupported_stock_scope');` | Any multi-day battle is refused. Must admit the 3-day duration, for the 3-day model only | Concept-fenced (scoring engine) |
| 3 | `api/_utils/stockThresholdAdmission.js:30` (the receipt binds `effectiveStockPercentage(m.measuredPct)`) and `:211`, which refuses with `measurement_replay_mismatch` when `effectiveStockPercentage(replay.measuredPct).scoringPctDecimal !== r.scoringPctDecimal` | A scaled unit (U5 = 2 × the measurement) fails the replay check unless the receipt records the scale or the model | Not on the §1 list (on the prompt's no-change list); concept-fenced |
| 4 | `api/_utils/stockThresholdPolicyRegistry.js:1`, `:5–6`, `:12` | One policy file is imported; any content change throws `Registered stock policy content changed`; `resolveStockApproval` approves only `sameModel`. Needs a new policy file, a new hash, a new approval record and a registry that holds both | Not fenced; owner approval needed |
| 5 | `docs/specs/BAGGERBOMB_STOCK_THRESHOLDS_POLICY_V2_20261015.json:9`, `:13` (`"creationDuration": "fullday"`) | V2 is hash-pinned and one-day by content. A 3-day unit is a new policy, never an edit | Pinned by hash |
| 6 | `api/_utils/measuredStockThreshold.js:6` (`period: 14`) and `:73–79` | U5 or U4 needs no new measurement (a scale). U6 would need a new calculator over three-session bars | Not fenced |
| 7 | `api/_utils/agentBattleService.js:41` — `const AGENT_BATTLE_DURATION_MODE = 'fullday';` | Every battle is created one-day | **§1-fenced file** |
| 8 | Tests pinning one day or one model: `src/utils/stockThresholdModel.test.js:232`, `src/components/League/battleArena/buildArenaModel.test.js:513`, `api/_utils/p4Equivalence.battery.test.js:602`, `api/cron/agent-evaluate.stockThresholds.test.js:197` | Must move deliberately with the change | — |

## 10. Limits

- **Daily bars cannot order a session's high and low.**
  - SELL's same-session penalty reads the bar as low-first when it closed at or above its open.
  - Both bounds were run, and no verdict changes. The cases are few: 2–57 on V2's window, 3–167 long.
- **Where SELL fills drives the exit-only verdicts** (§6).
  - The primary sells exactly at the line on a daily-high touch. A gap-through cannot fill there.
  - Pricing gap-throughs at the open flips:
    - S4 at C = 5 on U4 and U5 (V2's window);
    - S2 and S3 on U4–U6, and S5 at each close (long window).
  - The check-priced sensitivity is fitted on 128 tape sessions (visibility) and 23 (overshoot). Its intervals hold those tape parameters fixed, so they understate the uncertainty. A touch missed on session d and seen later is dropped, not re-entered.
- **A seller could refill the slot.** This test does not credit it; SELL's cash earns nothing.
- **The 15-minute check** sees about 85% of +1.0 touches (0.76–0.93) and about 75% of +1.5 touches.
  - This rests on 128 stock-sessions over 11 sessions at real checks and 309 over 26 at 10-minute closes, from stocks agents held.
  - The three-session ratio is modelled, not observed.
  - Close-based shapes are not affected by sampling, but the last check comes about 14 minutes before the close.
- **The sample.**
  - Stocks on the same day move together, and consecutive three-session holds share two sessions. For three-session levels, V2's 39 sessions carry roughly the information of 15–25 independent ones (60–100 of 174 on the long window; review B3, refuter R7).
  - Steps 2–3 publish no intervals. The unit choice compares rates on the same entries; that difference is not autocorrelated, and U5 is picked in 92–98% of block resamples.
  - November was a down-trending market (setup-frequency count, §2).
  - Steps 2–5 were also run on the 174-session window.
- **The entry is the session open.**
  - Real battles fill at the deploy time: mid-session, or at the prior close when created out of hours (V2 Ruling 7).
  - Step 2 was re-run with the prior-close fill, and the recommended unit moves (§4). Steps 3–5 were not.
- **Adjusted prices.**
  - An ex-dividend drop inside a hold does not appear, though the game would see it. That affects 208 holds; on raw prices U5's −1.0 rate is 8.9%, not 8.8%.
  - CTVA's 1 Oct spin-off, booked by the provider as a split, opens 24% above its adjusted prior close, so two holds show highs nobody held.
  - Dropping every hold within 45 sessions of a split, spin-off or in-hold dividend changes no recommendation and no Step 4 winner (review B6).
- **Provider revisions.**
  - The bars were served at 7:10 PM ET on 17 Nov, about three hours after that day's close, and the 17 Nov bar was still provisional. A capture a day later, already on disk, differs on its open, high or low for 123 of the 228 stocks. The largest change is 0.79%, and no close changed.
  - The 17 Nov bar is only the third session of the 228 holds entered 13 Nov, and it enters no unit.
  - Re-run with the later bar on V2's window:
    - one hold changes in Step 2;
    - one printed cell moves (S4 · U1 · C = 15, 10th percentile −318 → −317);
    - Step 4 is unchanged;
    - the overnight variance share moves 28.5% → 28.4% (review B7).
- **Random seven-stock matches.** No setup filter, no agent selection, no opponent: points are not compared against a CPU book.
- **S5's unit is frozen at entry,** as the legacy battle froze its base unit. S5 on touch is an upper bound on the dormant nightly path, which sees only the checks' prices (§5).
- **Penalty banking** stays on touch in S2–S4 by reading. The alternative is run in full: Step 3's scored sensitivity and Step 4's variant.
- **The synthetic battle** used to call the real model carries `duration: 'fullday'` to pass the scope guard (`src/utils/stockThresholdModel.js:30`).

## 11. Founder questions

- **FQ-1 — Penalties under exit-only and at-the-bell.**
  - BB-8 says when a *bonus* banks. Should penalties (Bust, Crash, Meltdown) also bank only on exit or at a close, or keep banking on touch, as measured here?
  - Moving them to the close roughly halves them: today's one-day game 0.77 → 0.37 Busts per match, U5 0.60 → 0.28. It also lifts the typical score (S2 · U1 median −1 → 34).
  - It changes no snap-exit verdict.
- **FQ-2 — S5's first-day anchor, if a daily reset is pursued.**
  - The prior close is the prompt's letter. The entry is what the legacy code did (`api/cron/agent-evaluate.js:1453`).
  - With the prior close, a bonus can be paid for an opening gap the position never held. On session 1 the line sat below the fill in 152 of 1,520 session-1 first touches (542 of 5,948 long). In 109 of them (390 long) the entry anchor pays no +1.0 that day.
  - Across all tiers, 217 of 6,858 on-touch bonuses (3.2%) were crossed by the overnight move before entry.
- **FQ-3 — The unit's target.**
  - Keeping V2's one-day rarity per match (U5 from the open; U4 or U6 from the prior close) leaves about as many bonuses per three-day match as today's game under the same banking rule: 1.01 against 0.98 on touch, 0.47 against 0.51 under exit only.
  - Per day that is a third of today's on touch (0.34 against 0.97), and about a sixth when a three-day exit-only or at-the-bell match is set against today's touch game.
  - Is the target equal rarity per match, or more scoring moments per day? A smaller unit gives more: U1 under exit only pays 0.89 bonuses a day.
- **FQ-4 — The carry's size.**
  - At C = 15, holding beats selling at the line on every unit, in both windows, under every pricing.
  - At C = 10 the same holds, though on U5 V2's window alone is within noise.
  - At C = 5 holding wins clearly over March–November. In V2's window it is within noise, and check-priced on U5 it is even.
  - Without a carry, exit-only and at-the-bell on the scaled units are even, or lean to SELL when a sale is priced as a check would make it.
  - Which C, if any?
- **FQ-5 — Match length.**
  - Per day, today's one-day game pays about three times the bonuses of a three-day match on U5 under touch.
  - The two overnight gaps carry 28.5% of the variance of a three-day match's conviction-weighted price move, and removing them changes that move's sign in 16% of matches. Scores and wins were not measured this way.
  - Which length?
- **FQ-6 — Which price is "the bell"?**
  - The last 15-minute check comes about 14 minutes before the close and sits a median 0.07 units from it.
  - The expiry sweep completes a battle before that run scores it (`api/cron/agent-evaluate.js:372`; winner at `:7127`), so the closing price itself appears not to be scored. This is ASSUMED and not verified against a live battle. It matches the Phase 0 trader-game discovery, D1 (`docs/audits/20261115_PHASE0_BAGGERBOMB_TRADER_GAME.md:412`, on `origin/claude/phase0-baggerbomb-trader-game` at `d770cd20`, not merged).
  - S3 and S4 need the bell named: the 16:00 close, or the last check.
- **FQ-7 — Exit-only in one-day practice.**
  - Sold exactly at the +1.0 line on a daily-high touch, the one-day exit-only game favours selling: +4.1 points per Support position over March–November (99.8% of resamples; within noise in V2's window).
  - Priced as a 15-minute check would sell, it is even (+1.4 long, −1.4 V2).
  - Under today's touch rule the same sale clearly loses.
  - Does BB-8 apply to one-day practice matches?
- **FQ-8 — How a ranked match fills.**
  - At the open, ×2 (U5) keeps V2's rarity.
  - At the prior close, with the opening gap counted (what V2 does for a battle created out of hours), about ×√3 (U4) or the measured three-session range (U6) does.
  - Which fill will a ranked three-day match use?
- **FQ-9 — The window reading.** "V2's sessions plus every session since" was read as entries 22 Sep → 13 Nov, the last entry with three sessions on disk. 18 Nov was not fetched (0 requests). Say if a different window was meant.
- **FQ-10 — Settle the snap exit on intraday data?**
  - Under exit-only on the scaled units, daily bars give only a range. SELL's sign turns on where a sale at a 15-minute check fills: even at the line, a lean or clear win for SELL priced past it.
  - The film tape covers only 11 full sessions. A check-by-check replay over stored battles' tapes would settle it.
  - Is that wanted before ruling on BB-8 and the carry?

## Reproduce

Run offline, in order. Each script writes to `C:/Users/fashr/Documents/FantasyTrades/ScoringShape/run-20261118/`, outside the repository, and refuses an output folder inside it. Inputs default to the paths named in `lib.mjs`.

1. `node scripts/experiments/scoring-shape/step1Reproduce.mjs`
2. `node scripts/experiments/scoring-shape/buildHolds.mjs`
3. `node scripts/experiments/scoring-shape/touchGap.mjs` (Step 4 reads its `touch-gap.json`)
4. `node scripts/experiments/scoring-shape/step2Units.mjs` (`--long` for the 174-session check; `--fill prior_close` for the fill sensitivity)
5. `node scripts/experiments/scoring-shape/step3Shapes.mjs` (and `--long`)
6. `node scripts/experiments/scoring-shape/step4SnapExit.mjs` (and `--long`)
7. `node scripts/experiments/scoring-shape/step5OneVsThree.mjs` (and `--long`)
8. `node scripts/experiments/scoring-shape/verdicts.mjs` (reads both Step 4 outputs)

Steps 5–7 read Step 2's recommended unit from `step2-units.json` (or `step2-units-long.json`). The matches are seeded (`RNG_SEED = 20261118`, 400 per entry session). The bootstraps are seeded, with 2,000 draws.
