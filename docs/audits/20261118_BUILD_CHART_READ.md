# Build report — the measured read on the Chart view

**Date:** Wednesday 18 November 2026. **Built by:** Claude Code (Opus), from the build prompt *The measured read on the Chart view* (the AssetResearch planning chat, 18 Nov 2026). **Spec of record:** `docs/specs/CHART_READ_SPEC_V1.md`. **Design of record:** `docs/design/research-modal/Research Modal - Round 6 (standalone).html`. **Base:** `origin/main` at `2e069d42` (#1086), fetched first and again before the push (unchanged).

## 1. Verdict

| | |
|---|---|
| **What ships** | Three PRs, merged A → B → C. A: the route's `previous` and the pure logic. B: the read on the Chart view, its marks, the Rule chip, the sheet, the unadjusted 1D candles, this report and the spec. C: `CHART_READ_MODE = 'allowlist'`. |
| **Flag off** | Byte-identical: no request, no element, no chart-library call. A differential renders the real modal at flag off on a browse and a battle mount through 20 steps (open, Chart, 1W, SMA, S/R, 1D, a record-day chip, Analysis, Chart, Escape) and records the DOM, every chart-library call, every request and the focused element: `main`'s four screen files vs the final B head `f2c77918`, **0 diffs**; positive control (one flag-off style changed) 16 diffs. Lens 3 ran the same check at `a9a9afb6`: 0 diffs. |
| **Never** | A verdict computed, a model call, a provider call, a write, a stop or a target. |
| **Review** | Three lenses, each with a refuter (BUILD_RULES §2). 28 findings: 23 confirmed, 1 refuted (L1-9), 3 partly refuted (L2-3, L2-10, L3-8), 1 a duplicate (L2-9). Every confirmed defect is fixed with a row that failed first, except one pre-existing hook defect for separate tasking (L2-2) and the items that follow ruled text (founder questions §7). |
| **Mutation** | 71 mutants: 69 killed, 2 equivalent (S4, H2). |
| **Real browser** | Headless Edge at 390 and 320: round 6 A, C, D, F1, F2 and the sheet — 65 rows, 0 failing (§5). |
| **Checks** | See §9: the full Linux suite, `lint:gate`, `vite build` and `test:rules` on the final heads. |
| **For the founder** | Seven questions (§7), the other-reading lines to check (§8), the live checklist (§10). |

## 2. Phase 0 — the eight findings

1. **The route as built.** Body, projection and two-session rule as the spec of record says. **Finding:** the uptrend's first two checks are ONE recorded check (`regime_stack`, a chain). Reading R-1: the sheet's three rows and RD-7's words read each pair from that check's own recorded sides and operator; the pairs must AND to the recorded result, else the record is not shown.
2. **Where the candles are adjusted.** `prepareChartData` (`chartUtils.js`) is the one place; one caller (`StockChart.jsx`); the read's flag reaches only the shell's Chart view mount. 1W rows carry no adjusted close; intraday rows map adjusted = raw.
3. **The live patch.** On today's row the hook keeps the stored adjusted close and sets the close to the live price, so the adjusted path draws the stored adjusted close; the raw path draws the live price (UC-4) with no hook change. (East of UTC the hook's own "today" is off by a day — L2-2, pre-existing, separate tasking.)
4. **The chart's own averages.** The same float mean of the same raw closes; the record keeps four decimals, the chart two. Same printed cent except the double-rounding band (a four-decimal value ending in exactly *5* at the third decimal): DOWNTREND's 20-day 154.455 prints *$154.46*, drawn at 154.45; its 50-day 160.905 *$160.91* vs 160.90. Half a cent in position; the drawn line carries no number. Lens 2 brute-forced 400,000 cases: every parting in that band, the print always above, never more than half a cent.
5. **The plumbing.** Markers draw shapes; price lines are full width. The marks are a lightweight-charts series primitive placed with the library's own coordinates inside its render pass.
6. **The sector rank.** `stockTechnicalScores/{SYM}.factors.sectorRSPercentile` (0 weakest, 20 sessions vs the sector ETF) and `updatedAt`. **Finding:** the modal does not hold this document on the Chart view; the sheet reads it with `useTechnicalScore` only while open.
7. **The band.** Record-day chips, then the Technical content; the read goes between.
8. **The honesty test.** It scanned `sheetCopy.js` only; PR A adds the chart read's copy to it.

The per-player allowlist verdict exists only on the server; the client's gate is the route's answer (R-2).

## 3. What was built

**PR A** — `api/research/setup-read.js` (`sessionBefore`, `previous`; 0 – 3 record reads, one `readSnapshot` call site), `api/_utils/setupRead/projection.js` (`projectPreviousRecord`), the contract and client read; `src/components/Research/ChartRead/` `marks.js`, `chartRead.js`, `chartReadCopy.js`, `format.js`, fixtures made by the store's own evaluator.

**PR B** — `ChartRead/` `useChartRead.js`, `ChartReadBand.jsx`, `ChartReadSheet.jsx`, `ruleMarksPrimitive.js`, `placeMarks.js`, `chartProps.js`; `StockChart.jsx` (five optional props), `chartUtils.js` (`basis: 'raw'`), `TechnicalTabV2.jsx` (`levelsNote`), `AssetResearchModal.jsx` (the wiring); the spec, this report, the round 6 file, the browser evidence. One guard premise moved (`intradayDiagnosticCopy.test.js`: the chart read's sector line uses the words *no reading*, named by file and phrase; a second carrier still fails).

**PR C** — `CHART_READ_MODE = 'allowlist'`, its pin and docstring in one commit.

No fenced file edited; no fenced function called.

## 4. The review (BUILD_RULES §2)

Three lenses on snapshot trees (git archive of `a9a9afb6`), each with a refuter on its own tree; the mutation battery on a fourth.

| Id | Sev | Finding | Refuter | Disposition |
|---|---|---|---|---|
| L1-1 | high | `formatVolume` cut the zeros of whole numbers (150,000 → "15K") | CONFIRMED | fixed `745a70a8`; X5, X6 killed |
| L1-2 | med | only one sheet state failed closed on a chain that disagrees with its pairs; the others opened a null sheet (blank, no Escape) | CONFIRMED (corrupt record only) | fixed `745a70a8` |
| L1-3 | med | an untestable other pattern read *not present* | CONFIRMED | fixed `745a70a8`; X7 killed |
| L1-4 | med | the chip *New since Mon: touched the 20-day…* after an *extended* record that already held the pullback | CONFIRMED, literal to the ruled table | founder Q-1 |
| L1-5 | low | *the other pattern* on the satisfied pattern of a stretched breakout | CONFIRMED | fixed `745a70a8`; X8 killed |
| L1-6 | low | the regime second line (ruled) and my separates text named conditions that may hold | CONFIRMED | separates rewritten; second line → Q-2 |
| L1-7 | low | RD-9 on a weekend, RD-8 while behind, the refused lead's *today* | CONFIRMED, literal to ruled text | Q-3 |
| L1-8 | low | three test gaps | CONFIRMED | rows; X1 – X3 killed |
| L1-9 | low | the record's basis never checked | REFUTED (the adapter's basis is a constant) | guard kept as defence in depth; X4 killed |
| L2-1 | med | 1D → 1W: marks by the week rule on 52 adjusted daily bars while the weekly fetch is pending | see §4.1 | fixed `9c9cf103` (`barsMatchTimeframe`); Y5 killed |
| L2-2 | med | UC-4 east of UTC: the hook dates the synthetic today row by local midnight | see §4.1 | pre-existing hook code — separate tasking (§11) |
| L2-3 | med | lit marks and the open sheet followed navigation | see §4.1 | fixed `9c9cf103`, `a889ab77`; Y6, Y7 killed |
| L2-4 | med | 1W with SMA on: marks 1 – 2 against 20/50-WEEK lines (CR-4 vs MK-5) | see §4.1 | founder Q-4 |
| L2-5 | med | no autoscale: the Battle stub could sit off the pane | see §4.1 | fixed `9c9cf103`; Y8, Y15 killed |
| L2-6 | med | the SMA agreement test was blind to the drawn line's source | see §4.1 | modal row; Y14 killed |
| L2-7 | low | time-zone placement not pinned in CI | see §4.1 | test reader fixed; CI is UTC — disclosed |
| L2-8 | low | coincident squares overlapped | see §4.1 | fixed; Y9 killed |
| L2-9 | low | = L3-7 | — | fixed |
| L2-10 | low | a number's two copies never compared | see §4.1 | fixed (`copiesAgree`); Y10 killed |
| L3-1 | med | the sheet's keys lived on its root: after a tap outside, Escape reached the screen beneath (battle: closes the modal) | CONFIRMED | fixed `41cd9e48` (document capture listener); Y1 killed |
| L3-2 | low-med | `'allowlist'`: a 401, the per-IP 429 or a network failure showed the failed line before admission was known | CONFIRMED | fixed `41cd9e48`; Y2 killed |
| L3-3 | low | the Rule chip's hit area 41 px, its label 11 px | CONFIRMED | fixed `41cd9e48`; four-edge hit test in Edge; Y3 killed |
| L3-4 | low | the plot-shrink rows could not fail | CONFIRMED | strict rows; Y11 killed |
| L3-5 | low | TechnicalTabV2's no-note output unpinned | CONFIRMED | new file; Y12 killed |
| L3-6 | low | "a markless row is not a button" untested | CONFIRMED | row; Y13 killed |
| L3-7 | low | the Rule chip read *off* while the open sheet draws every mark | CONFIRMED | pressed and disabled while open; Y4 killed |
| L3-8 | low | the chart rebuilds on sheet open/close and loses pan/zoom; adjusted → raw swap on arrival | first half REFUTED (the range is restored); second CONFIRMED | the one-time swap is the cost of R-2; disclosed |
| L3-9 | low | A → B → A asks for A again | CONFIRMED | comment corrected (the route's cache serves it) |

Also found by the mutation tree's fresh run: the lens-1 fix declared `other` twice in `sheetOf` (the worktree's green run was a stale transform); fixed in the next commit, and every final run used `--no-cache`.

### 4.1 Lens 2's refuter

| Id | Verdict |
|---|---|
| L2-1 | CONFIRMED, severity lowered to medium: the window lasts the first weekly fetch per symbol; the 1W → 1D mirror is one commit that is likely never painted. |
| L2-2 | CONFIRMED in Berlin and Tokyo (UTC and New York pass); predates this build — the adjusted path fails the same way. |
| L2-3 | CONFIRMED for lit marks with the sheet closed (Chart → Analysis → Chart; Back from another stock). The sheet re-opening by itself is not reachable through the modal's own navigation (every forward door is on the Analysis view, which clears it) but is when a parent swaps `asset` A → B → A on an open modal. The fix covers both. |
| L2-4 | CONFIRMED by citation: a ruling (Q-4). |
| L2-5 | CONFIRMED: the stub sits 8.9 % below the price on the EXTENDED fixture — off a ±1.5 % intraday pane. |
| L2-6 | CONFIRMED (test gap). |
| L2-7 | CONFIRMED (test gap; the code is zone-correct in all four zones tried). |
| L2-8 | CONFIRMED, and commoner than the fixture: marks 1 and 2 share a bar, so any pair within 13 px overlaps. |
| L2-10 | First half CONFIRMED but latent (no divergence reachable today); second half REFUTED — mark 3's day on the client's daily dates is the adopted reading R-5. |

### 4.2 The mutation battery

Build battery 48: 45 killed; S4 and H2 equivalent (`placeMarks` already returns nothing off 1D/1W; `startedRef` already holds a finished key); Q5 (reduced motion) killed by a new jsdom row. Review-fix batteries X1 – X8 and Y1 – Y15: all killed (Y7 after a new row). 71 mutants, 69 killed, 2 equivalent.

## 5. The real browser

Headless Edge (playwright-core), 390 × 844 and 320 × 640, against a scratch fixture page (`docs/audits/20261118_BUILD_CHART_READ/fixture-page.jsx.txt`, records from the store's evaluator via `fixture-gen.test.js.txt`; the flags forced on in the scratch tree only). 65 rows, 0 failing (`browser-report.json`, `measure.mjs.txt`): round 6 A, C, D, F1, F2 and the sheet; no sideways scroll (page and sheet); the marks re-drawn on their bars after a pan, a zoom and a rotation (each draw's x / y against the chart's own coordinates at that moment, and the draw count rising); the Rule chip 44 × 54 with all four edges hittable; the band 44 px+; the sheet at the plot's lower edge, scrolling inside itself, every control 44 px+, the view still; Escape from inside and from the Rule chip closes only the sheet; reduced motion: no rise. Screenshots: `A-390.png`, `A-320.png`, `C-*.png`, `D-*.png`, `F1-*.png`, `F2-*.png`, `sheet-*.png`, `A-390-zoomed.png`, `A-rotated.png`.

## 6. Readings (approve-by-default; spec §1.1)

R-1 the uptrend's two recorded checks; R-2 the route's answer is the client's gate (under `'allowlist'` only a 5xx or a malformed 200 is a failed read); R-3 RD-7 true at equality; R-4 mark 4 is the `pullback_touch` check's lhs; R-5 mark 3's day counted on the daily series; R-6 the candles unadjusted under every read that shows; R-7 the Battle chart's note; R-8 the sheet's room (action row hidden, plot to ~42 %, a 40 % floor); R-9 the other pattern's group quiet only when the record says it failed; R-10 an unknown rule set and an unshowable record; R-11 an unreadable earlier record is a 500; R-12 prices half up from the record's decimal. Also: a record whose copies of one number disagree is not shown (L2-10).

## 7. Questions for the founder

| # | Question |
|---|---|
| Q-1 | **The change chip after a stretched day.** Previous *invalid · extended* (the pullback already present) → today *valid · Pullback*: the ruled table prints *New since Mon: touched the 20-day and closed back above it.* Built to the letter. Should rows 1 – 2 require that the previous record did not already hold that pattern (no chip, or *Since Mon: back within the stretch limit.*)? |
| Q-2 | **The not-in-an-uptrend second line** names the close and the 50-day whichever check failed (REGIME_B fails only the 20-day vs 50-day). Built to the letter. Build it from the failed checks instead? |
| Q-3 | **Three ruled phrases on non-session days:** *(today's isn't in yet)* on a Saturday (the missing record is Friday's); the RD-8 note while `behind`; *No read for this stock today* beside an earlier date. Reword? |
| Q-4 | **1W with SMA on:** the chart draws 20/50-WEEK lines there, so marks 1 – 2 cannot sit on them (CR-4) while MK-5 puts them on 1W. Keep, hide marks 1 – 3 on 1W while SMA is on, or draw the daily SMAs on 1W? |
| Q-5 | **The one-time candle swap.** Under `'allowlist'` the client learns admission from the answer, so the 1D chart first draws adjusted candles, then raw when the read lands (the range is kept). Accept, or add a client-side admission signal? |
| Q-6 | **The other-reading lines** I wrote (§8): approve or replace. |
| Q-7 | **The guard premise** (`intradayDiagnosticCopy.test.js`): the sector line keeps the ruled words *no reading* and the guard names that one pair. Accept? |

## 8. The other-reading lines (SH-5)

| State | The other reading | What separates them |
|---|---|---|
| valid · Pullback and Resume (round 6) | A failed bounce in a weakening trend. | The next close against that session's own 20-day. That number doesn't exist yet; mark 1 is {Tue}'s. |
| valid · Trend Breakout | A breakout that slips back under the high it cleared. | The next closes against the 20-session high it cleared. Mark 5 is the high before {Tue}; each session has its own. |
| not in an uptrend | A dip inside a trend that hasn't turned. | The three uptrend checks: a close above the 20-day, the 20-day above the 50-day, and the 50-day rising. Marks 1 and 2 are {Tue}'s; mark 3 is the 50-day five sessions earlier. |
| in an uptrend, no pattern | A trend that is tiring, not pausing. | A low that reaches the 20-day (mark 1), or a close at or above the 20-session high (mark 5) on 1.5× average volume. |
| stretched | Strength that keeps going without a pullback. | The close coming back within the stretch limit while the pattern still holds. Mark 7 is {Tue}'s limit; each session has its own. |

## 9. Checks

Linux (WSL Ubuntu, Node 20.20.2, `TZ=UTC`, `--maxWorkers=8` under `flock`), each in a fresh worktree at the exact commit with an install whose lockfile matches; `origin/main` re-fetched before the push: still `2e069d42`, so no merge was needed.

| Head | Commit | Full suite | `lint:gate` | `vite build` | `test:rules` |
|---|---|---|---|---|---|
| A (first) | `2e7c6540` | 1 failed: the intraday copy guard (see below) | 0 problems | built | — |
| A | `b3a1529b` | 35,573 passed, 0 failed | 0 problems (`2e7c6540` whole tree; the two changed files again) | built | — |
| B (code) | `0a03291b` | 35,707 passed, 0 failed | 0 problems | built | — |
| C (code) | `b052cda6` | 35,707 passed, 0 failed | 0 problems | built | 46 files, 839 passed |

B and C were then re-cut with this report as B's last commit (documentation only); their exact pushed heads were built again before the push (the results are in PR B's and PR C's descriptions).

The first full Linux run on B (`50aab38a`) failed one row, the intraday copy guard (§3, commit `b2db4c92`). A alone failed the same row (A carries the copy file, the fix was on B): the fix is cherry-picked onto A (`b3a1529b`) and A is merged into B (`61773d25`; B's tree unchanged, `git diff 0a03291b 61773d25` empty), so `main` is green after A alone. On Windows two rows fail on every head and on `main` alike (a load timeout in `backingBetaFlags.test.js`, a CRLF regex in `shadowCpuQuoteIntegrityFlags.test.js`); both pass on Linux. Every targeted run after the lens-1 fix used `--no-cache` (a stale transform had hidden a parse error once, §4).

## 10. Live checklist (founder, on a phone, after C merges and deploys)

The daily sweep is on in `main` (#1082), so the ranked stocks have records. A stock whose line reads *Measured after each close; no read yet* has none yet: try another ranked stock.

1. Signed in on an allowlisted account, open a ranked stock from one of your agent battles → Chart. Under the plot: *Setup check · daily*, the date, one sentence; *prices unadjusted* under the OHLC row; the Rule chip lit.
2. The numbered ticks sit on the candles near the right edge. Tap Rule: they go; tap again: they come back.
3. Tap the read: the sheet rises from the plot's lower edge (the plot gets shorter, the Ask row hides); the uptrend group shows *n of 3*.
4. Tap *The touch*: marks 4 and 1 thicken and their prices show on the right scale; tap it again: they clear.
5. Tap ✕ on the sheet: only the sheet closes; the read and the Ask row are back.
6. Tap 1W: the ticks sit on the weeks; *prices unadjusted* is gone.
7. Tap Battle: no ticks; one short *20-day · daily · {day} close* stub at the right edge; the read says where its marks are.
8. On an account that is not on the allowlist: the same Chart view shows no read and no Rule chip.

## 11. For separate tasking (found, not fixed)

- **L2-2 (pre-existing):** `useResearchData.js` dates the synthetic today row by the device's local midnight and decides the weekend locally: east of UTC the last 1D candle is not today's live price. Affects every chart, not only this build's path.
- **Pre-existing at 320:** a battle mount's control bar (1D 1W Battle · SMA S/R Idea) is 344 px and overflows a 320 px screen without the read; with the read it now wraps.
- **Pre-existing:** at 320 the OHLC row's *Vol* reaches under the price scale.
