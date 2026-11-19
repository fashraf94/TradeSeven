# Review — scoring shape and the three-day threshold unit (BUILD_RULES §2)

**Date:** 18 Nov 2026 · **Branch:** `claude/scoring-shape-three-day-unit` · **Report under review:** `docs/audits/20261118_SCORING_SHAPE_AND_THREE_DAY_UNIT.md` · **Out-of-tree copy:** `C:/Users/fashr/Documents/FantasyTrades/ScoringShape/20261118_SCORING_SHAPE_AND_THREE_DAY_UNIT_REVIEW.md`.

## Verdict table

| Item | Result |
|---|---|
| Why a review | The branch adds 12 files and about 2,700 lines (ten scripts, the report, this record), past both of BUILD_RULES §2's thresholds |
| Shape of the review | 3 independent lenses; every finding handed to a refuter told to refute it with a concrete repro; 16 refuters |
| Findings | **22**: 11 CONFIRMED, 10 PARTLY CONFIRMED, 1 REFUTED |
| Severity | 1 high (B1), 7 medium, 14 low or low-medium |
| Did a headline change? | **Yes, one.** The snap-exit answer under exit-only is now **sensitive to how a sale at a 15-minute check is priced**, not "even" (B1, refuter R8). The one-day exit-only "SELL clearly wins" fell to a lean. The unit recommendation (×2 from the open, about ×√3 from the prior close) and every shape count stood |
| Code fixes | step4SnapExit (S5 day-1 pricing, block bootstrap, strict-best and tie shares, by-day table, the penalty and check-priced variants, the n = 0 winner), step3Shapes (under-water price, give-backs with carries, scored penalty sensitivity, base percentiles), touchGap (no "bound", intervals, shortfall and overshoot), buildHolds and lib (comments), and a new `verdicts.mjs` that applies one stated rule |
| Mutation check | Not applicable: no test was added |
| Build, lint, suite | `vite build`, `npm run lint:gate` and the full Linux suite (`TZ=UTC`, 8 workers, `flock`) run on the pushed head; results in the PR |

## How it ran

- **Isolation (BUILD_RULES §2, reviewer isolation).** Each lens worked on its own LF `git -c core.autocrlf=false archive` extraction under the session scratchpad, `node_modules` linked as a junction, with a private output folder holding read-only copies of the inputs. No reviewer or refuter wrote to the repository or ran a git write.
  - Lenses A and B reviewed commit `33a386ce`.
  - Lens C reviewed `67f43cea`, which added the long window and the prior-close fill.
- **The lenses.**
  - **A — the shapes, the snap-exit policies and the use of the real scorer.** Judged against the prompt's letter.
  - **B — data, units, reproduction and statistics.** Look-ahead, windows, the unit construction, the touch gap and the resampling.
  - **C — every report claim against the outputs and the cited code.** Also prompt compliance and the rules.
- **The refuters.** One refuter took each finding or tight group of findings (R1–R16). Each re-ran the reviewer's repro in its own folder and tried to break the finding. Each finding got its own verdict.
  - R1 took A1 and B2; R3 took A3 and A6; R7 took A8 and B3; R9 took B4 and B5; R12 took C1 and C5; R14 took C3 and C4.
  - The other ten refuters took one finding each.

## Findings, verdicts and dispositions

### Lens A — shapes, policies, scorer

| Id | Sev. | Finding | Verdict (refuter) | Disposition |
|---|---|---|---|---|
| A1 | med | At `33a386ce` the report lacked the one-session snap-exit baseline, the bootstrap table and a by-day-of-first-touch table | PARTLY CONFIRMED (R1). Baseline and bootstrap already fixed at `67f43cea`; the by-day **table** still missing | Fixed: `step4SnapExit.mjs` prints n, means, medians, single-best shares and the winner by session of first touch; the report carries the table |
| A2 | med | S5's "under water" share prices an on-touch bonus at the level even when the session opened beyond it; on day 1 under the prior-close anchor the open is the fill | CONFIRMED (R2). Prior-close 9.90% → 6.55% (679 → 449 of 6,858); entry anchor 7.88% → 7.66%; the anchor order reverses. 217 day-1 bonuses were crossed by the overnight move before entry. S5 at each close unaffected | Fixed: `step3Shapes.mjs` prices the moment at max(open, level) and counts session-1 levels at or below the fill separately; report §5 and FQ-2 |
| A3 | low | The "penalties follow the bonus rule" reading never ran in Step 4; Step 3's sensitivity gave counts only and left out S5 at each close | PARTLY CONFIRMED (R3). No SELL verdict changes; S5 at each close loses more clearly; Step 3 scores move a lot (S5 at each close median 8 → 36) | Fixed: Step 4 runs the reading as a variant; Step 3's sensitivity is now scored rows (with the one-day baseline and S5 at each close); report wording scoped |
| A4 | low | Best-of-three shares are mostly split BELL = HOLD ties; "HOLD wins via a long right tail" had no statistic | CONFIRMED (R4). BELL = HOLD in 64% (U1) and 76–80% (U4–U6) of holds, by construction. SELL is never the single best when they differ. Under S4 HOLD's edge is a broad shift of about one carry, not a tail | Fixed: Step 4 prints strict single-best shares, the BELL = HOLD tie rate and how often SELL beats HOLD; the report's paragraph rewritten |
| A5 | low | The uncertainty language treated SELL and HOLD differently | PARTLY CONFIRMED (R5). Several cells still overstated at `67f43cea` (C = 10 on U4/U5 in V2's window; S3 on U4/U6 long; "100%") | Fixed with C1/C2/C5: one stated rule in `verdicts.mjs`; every label comes from it |
| A6 | low | S4's give-back share left carries out while its bonus share counted them | CONFIRMED (R3). Including carries lowers it by 0.2–1.1 points; nothing was hidden | Fixed in `step3Shapes.mjs` (`giveCarries`) |
| A7 | low | "8,892 of 8,892 agree with the legacy scorer's nightly badges" overstates: the nightly path reads a check-sampled history and anchors day 1 at the entry | CONFIRMED (R6). The check proves the legacy branch's arithmetic, given the day's high and low, draws the same lines; a close-only control agrees on 4,874 only, so it is not vacuous | Fixed: comments in `shapes.mjs`, `lib.mjs`, the Step 3 label, and the report: S5 on touch is an upper bound on the dormant nightly path |
| A8 | low | Calling the entry session "the independent unit" ignores that consecutive entries share two sessions | CONFIRMED (R7), more serious on the long window: per-session SELL − HOLD autocorrelation +0.31 to +0.36 there | Fixed: Step 4's bootstrap resamples circular blocks of 3 entry sessions |

### Lens B — data, units, statistics

| Id | Sev. | Finding | Verdict (refuter) | Disposition |
|---|---|---|---|---|
| B1 | **high** | The snap-exit sample is chosen by daily highs and SELL fills exactly at the line, which flatters SELL. Weighted by the chance a 15-minute check sees the line, the V2-window lean toward SELL reverses | PARTLY CONFIRMED (R8). The mechanism is real (agents sell only at a check, at its quote) and the weights calibrate on the tape (22.4 predicted against 23 seen). But the reviewer counted only the check's cost, not its gain: a check sale sits a mean 0.123 one-day units past the line, and a gap-through can only fill at the open. Priced that way, exit-only **leans toward SELL** on the scaled units (U5 clearly on the long window). The one-day exit-only "clear win" falls to a lean (+1.4 to +2.0, intervals spanning zero) | Fixed: `touchGap.mjs` records the tape's shortfall and overshoot; `step4SnapExit.mjs` adds the check-priced sensitivity; `verdicts.mjs` gives its verdict beside the primary; the report states that the snap-exit sign under exit-only depends on execution pricing, and drops "100%" and "clearly wins" for the one-day game |
| B2 | med | The one-day baseline's snap-exit result was computed but left out | REFUTED (R1): already in the report at `67f43cea`, numbers matching a byte-identical re-run | None needed |
| B3 | med | §10 overstated the effective sample of three-session figures (overlapping holds) | PARTLY CONFIRMED (R7). Three-session levels carry roughly 15–25 independent sessions' information in V2's window (60–100 of 174 long). The unit choice is not affected: the gap it compares is not autocorrelated, and U5 is picked in 92–98% of block resamples (exact multiple ×1.86–2.21 V2, ×1.90–2.05 long; √3 outside both) | Fixed: report §10 wording; the block bootstrap in Step 4 |
| B4 | low | The touch-gap estimate is less precise than stated; the 10-minute sample is not a bound | CONFIRMED (R9). The checks sit on a different grid; 23 of 27 is the same on both samplers where they overlap; intervals 0.76–0.93 (checks) and 0.76–0.88 (10-minute closes); the larger sample spans 26 sessions, not 11 | Fixed: `touchGap.mjs` prints both session-resampled intervals and calls the second sample a second estimate; report §4 and §10 |
| B5 | low | "The ratio applies alike to one- and three-session holds" is unsupported | CONFIRMED (R9), mechanism amended: three-session holds get a second chance on a later session (329 of 981 U5 holds touch again); modelled ratio 0.85–0.90 against 0.83–0.85; the game-visible match moves ×2.03 → ×2.03–2.07; the ranking holds | Fixed: report §4 wording (modelled, not observed) |
| B6 | low | Adjusted prices can fake moves inside a hold (CTVA spin-off) | PARTLY CONFIRMED (R10). Two CTVA holds carry an adjusted +24% opening gap nobody held; the 1 Oct entry claim is refuted; dividends small and disclosed. Excluding every hold near a factor step changes no recommendation and no Step 4 winner; the prior-close long-window pick becomes a U4/U6 tie | Fixed: `buildHolds.mjs` header; report §10 and the §4 prior-close row |
| B7 | low | The last bar on disk is provisional and the report misstated its capture lag | CONFIRMED (R11). 17 Nov bars were read at 7:10 PM ET (3 h 10 min after the close). Against a later capture on disk, 123 of 228 changed a high, low or open; the effect is one hold in Step 2, one printed cell in Step 3 (−318 → −317), none in Step 4, and 28.5% → 28.4% in Step 5 | Fixed: report §10 |

### Lens C — the report against the outputs

| Id | Sev. | Finding | Verdict (refuter) | Disposition |
|---|---|---|---|---|
| C1 | med | "Clearly loses" at C = 10 on V2's window did not meet the report's own bar | PARTLY CONFIRMED (R12): true for U4 and U5 (V2 intervals reach +0.2 and +0.6; 5.2% and 7.3%), refuted for U6 | Fixed: `verdicts.mjs` applies one rule; those cells read "SELL loses*" |
| C2 | med | The verdict rule changed from cell to cell; S5's day-1 gap sale was priced at a line below the fill | (a) PARTLY CONFIRMED (R13): an unstated rule reproduced 27 of 28 labels; the legend did not state it; (b) the missing session guard is REFUTED as a bug, but the **pricing defect is CONFIRMED**: 152 (V2) and 542 (long) day-1 gap-throughs sold at a line below the price paid, 41 / 200 at a price never traded after the fill | Fixed: the rule is stated and coded; S5's day-1 gap sale is priced at the open (the line is a variant); S5 at each close moves from "BELL" to a cell the rule decides |
| C3 | low-med | The 15-minute estimate went past its own "bound"; "+1.5 at 80–85%" too high; "applies alike" unmeasured | PARTLY CONFIRMED (R14): the "bound" premise is false, so the reviewer's cap is not adopted either; +1.5 is about 75%; U5 stays the pick unless the three-session ratio falls below 0.79× (V2) or 0.89× (long) of the one-session ratio | Fixed with B4/B5 |
| C4 | low-med | FQ-2's "460 of 3,747" mixes session-1 opening gaps with later sessions | CONFIRMED (R14): 460 = 152 (session 1) + 112 + 196; in 109 of the 152 the entry anchor pays no +1.0 that day | Fixed: `lineBelowFill` counted by session; FQ-2 and the §6 counts table |
| C5 | low | Rounding and margins: 60% (59.5%), "100%" (99.9%), "at most 7%" (7.3%); "leads by up to 4.2" was over HOLD, not the next best | CONFIRMED (R12) | Fixed: summary margins are now SELL minus the next-best policy; shares to one decimal |
| C6 | low-med | No out-of-tree copy yet; no by-day table; baseline missing from three tables; §10 omitted the S5 open-fill flip | CONFIRMED (R15), all four | Fixed: the copies are written from `git show HEAD:` at the end and hash-checked; by-day table; baseline rows; §10 |
| C7 | low | Provenance and wording (the scorer-only claim, a misquote at `:211`, missing line numbers, the unmerged Phase 0 doc, figures in no output, overstated wording in FQ-3/FQ-5 and §5) | PARTLY CONFIRMED (R16): all wording; no number moves; the S1–S3 crossed-set override changes nothing (0 differences in 26,676 checks per unit); "H1 cited" refuted | Fixed: report wording, citations with lines, the Phase 0 doc marked unmerged, step3 prints base percentiles |

## What changed in the numbers

- **Step 4 (the snap-exit test).**
  - The bootstrap now resamples blocks of three entry sessions.
  - S5's day-1 gap-throughs sell at the open.
  - Each figure in the report is the re-run's, and `verdicts.mjs` sets every verdict word.
  - A check-priced sensitivity sits beside the primary.
- **Step 3.**
  - S5's under-water share: prior-close anchor 9.9% → about 6.5%.
  - S4's give-back share now counts carries.
  - The penalty sensitivity is scored.
- **Steps 1, 2 and 5:** no figure moved.
- **The setup payoff check.** It was found after the first draft, in another session's local branch (`claude/setup-payoff-check` at `7133ec29`, not pushed). The report quotes it marked unmerged.
