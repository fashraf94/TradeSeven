# Build report: research universe, Build 2 (a research stock's numbers on request)

**Date:** 26 Nov 2026 · **Asked by:** the Explore content chat (Fable), for the founder · **Base:** `origin/main` @ `a88c204a` (#1118)

**PRs, in merge order:**
- **A** `claude/research-directory-corrections`: §3, the corrections list.
- **B** `claude/research-numbers`: §4–§7 and this report. B is cut from A and contains A's commits (A's tip merged in at `e619bc62`).

Both PRs have `main` as their base.

**Preamble.**
- **Fetch first.** `git fetch origin` ran first. `HEAD` = `origin/main` = `a88c204a019d7521a17b1d79dcad598a1b03d143`, clean tree. Fetched again before the final checks: `main` had not moved, so the final checks ran on the branch head, which is the merged tree.
- **Read:** `docs/BUILD_RULES.md`, the Build 1 report, and the census Parts B3, D2 and G (from `origin/claude/research-universe-census` @ `fd909746`).
- **EODHD calls: 80 in all.**
  - §2 point 4: 10 (one GLW fundamentals request).
  - §3: **0**. Build 1's saved fetch was found and reused.
  - §7: 70. That is 30 for the three compares, 30 for the three fetches, 0 for the second GLW, and 10 for one currency check on TSM, explained in §7.
  - Every figure is measured on EODHD's user endpoint, which costs 0: 555 → 565 for §2, then 668 → 738 for §7.
- **Production Firestore.**
  - Reads: `peerRankings` (all docs, once, for §2; then NVDA, JPM and XOM in the compares), `estimatesCache/latest` (once), and `researchMeasures` / `researchFetchDays` by the script.
  - **Writes: only by §7 step 2, only to the two new collections:** `researchMeasures/GLW`, `researchMeasures/ANET`, `researchMeasures/TSM`, and `researchFetchDays/2026-11-27`.
- No model call, no scheduled-job change, no `firestore.rules` change. No secret, uid or email appears in this report, the code or the PRs.
- **VERIFIED** means read or measured in this session at the commit named; **ASSUMED** marks anything not seen.

---

## 0. Verdict

| Question | Answer |
|---|---|
| Is the list cleaned? | **Yes (PR A).** A named corrections list (21 left out, 2 sector fixes, 2 restores, BATS allowed) is applied by the generator on every run. The directory went **2,259 → 2,241**: entered AGM-A, CBOE, MOG-B; left the 14 closed-end funds, DTW, AFGE, VYLR, BRK-A, FOX, LEN-B, NWSA; changed LION, XXI (§3). |
| Stale corrections / retired symbols in the directory | **None / none.** |
| Does a research stock get the game's numbers? | **Yes (PR B).** One fundamentals request (10 calls) gives the same 31 measures `peerRankings` stores, computed by **the same code**, now in `api/_utils/stockMeasures.js`. They are kept in `researchMeasures/{symbol}` and reused for 7 days (§4, §5). |
| Is the rankings job unchanged? | **Yes.** The move is verbatim: every body is identical to `main`'s, a golden captured before the move passes after it, and the client bundle is byte-identical. The live compare of NVDA, JPM and XOM agrees on all ten measures. |
| Do the analyst estimates come with it? | **Yes**, at no extra call: `Earnings.Trend` carries the current-year and next-year growth and the analyst count (§2.4). |
| A rank for a research stock? | **None stored**, at any depth (RU-15). |
| Calls | **80** (10 + 70); the daily counter reads **3 of 200** fetches (30 calls) for 2026-11-27 UTC. |
| Corning, as stored | Revenue growth 18.40% · earnings growth 56.00% · profit margin **null** (§11) · gross margin 36.48% · FCF yield 6.86% · FCF margin 33.43% · debt/equity 0.87 · current ratio 1.59 · interest coverage 6.78 · net debt/EBITDA 2.40. |
| Review | Two lenses, each with a refuter. **15 findings: 11 confirmed, 3 confirmed in part, 1 refuted** (details in §8). Every confirmed finding is fixed with a row that failed first, or recorded. Mutation battery **63 of 64** killed (the survivor is equivalent). |
| Stopped on a ruling | Nothing blocks a merge. 13 questions in §12. The most important: a verbatim move breaks one text row of a named pin (§4.5); foreign filers' cash-flow measures are unreliable (TSM: mixed currencies, and a cash-flow sum that looks inflated; §7); three faults in the response the rankings job reads (§11). |
| Full suite (Linux) | **exit 0** · `Test Files 1684 passed | 14 skipped (1698)` · 39,264 rows passed, 0 failed · 488 s (§9) |


---

## 1. In plain terms

- **The list is cleaner.**
  - Funds, two bonds and a shell that slipped in are gone, as are four second share classes of game stocks.
  - Two companies have their right sector.
  - Moog class B, Farmer Mac class A and Cboe Global Markets are in.
  - Every correction is on one short named list, and each monthly rebuild reports what it did with it.
- **A research stock's numbers, on request.** The first time someone asks about a research stock, one request to the data provider gives the same business measures the game keeps for its 228 stocks. The same code works them out, and they are saved and reused for a week.
- **What it costs.**
  - A stock nobody has asked about costs 10 calls once a week.
  - A stock the provider has nothing for costs 10 calls at most once a day.
  - No more than 200 stocks can be fetched a day, which is 2,000 calls.
- **It never ranks a research stock**, never touches anything the game reads, and never fetches for one of the 228.
- **Nothing in the app calls it yet.** A hand-run script is the only way in.
- **Three things to know:**
  - The game's own stored numbers have three blind spots that came to light here. The profit margin and short interest are always empty, and the company name is always the ticker. They are not fixed here; fixing them would move the 228's rankings.
  - For a foreign company that reports in its own currency (TSM, in Taiwan dollars), the free-cash-flow numbers come out wrong. The yield divides Taiwan dollars by a US-dollar market value, and the vendor's quarterly cash flow itself looks too large.
  - One existing test had to be pointed at the file the math moved to.

---

## 2. Read first (build prompt §2)

Every finding is **VERIFIED**: read at `main` @ `a88c204a` in this session (line numbers are `main`'s), or measured.

### 2.1 Rules and earlier work

Read: `docs/BUILD_RULES.md`; the Build 1 report `docs/audits/20261126_BUILD_RESEARCH_DIRECTORY.md`; the census `docs/audits/20261126_RESEARCH_UNIVERSE_CENSUS.md` Parts B3, D2 and G, read from `origin/claude/research-universe-census` @ `fd909746` (not on `main`).

### 2.2 The per-stock math: what each function reads besides its arguments

| Function (`api/cron/compute-rankings.js`) | Reads besides its arguments | Pure? |
|---|---|---|
| `fetchSingleFundamental` (`:116`) | `fetch` (network), `API_BASE` (`:114`), `EODHD_FUNDAMENTALS_FILTER` (`rankingConfig.js:813`) | No: it makes the request. Its response shaping (`:124-136`) reads only `data` and `ticker`: pure. That part moved as `shapeFundamentals(data, ticker)`. |
| `getQuarterlyTTM` (`:361`) | nothing | Yes |
| `computeEpsRevisionScore` (`:379`) | nothing | Yes |
| `computeAvgSurprise` (`:397`) | nothing | Yes |
| `extractBalanceSheetMetrics` (`:426`) | nothing (its `sectorId` parameter is never used) | Yes |
| `computeEarningsConsistency` (`:521`) | `SECTOR_BEAT_RATES` (`rankingConfig.js:820`, a constant table); `logInfo` (`:56`), which writes a console line with the clock's time when a stock has history but fewer than 4 usable quarters (`:551`) | Its output depends only on its arguments and the constant. The log line is its one side effect. |
| `computeShortInterestMetrics` (`:591`) | nothing | Yes |
| `extractYearlyDebtMetrics` (`:606`) | nothing | Yes |
| `extractMetrics` (`:622`) | `TICKER_TO_SECTOR` (`rankingConfig.js:453`: the 228, the sector funds, the industry funds and the 11 retired stocks), for the sector it hands to `computeEarningsConsistency` (`:682`) | Its output depends only on its arguments and the constant. |

**Not a stop.** No function had to be edited to move, and nothing it reads changes its output. Two consequences were built around and are recorded here:
- **The log line.** `computeEarningsConsistency` calls the job's own `logInfo`. A copy of `logInfo` with the same `[RankingsCron]` prefix moved with it, so the job's log lines are unchanged (the golden compares them).
- **The sector.** `extractMetrics` looks the sector up in the 228's map, which holds no research stock, so it can't be handed `researchSectorOf(symbol)` without editing its body. The sector changes one thing only: the sector-default beat rate when a stock has fewer than 4 usable quarters. So the research path calls `extractMetrics` unchanged, then runs `computeEarningsConsistency` again, the same function, with the research sector, and keeps that group (`researchMeasures.js` `measuresOf`). For one of the 228 with its own sector the result equals the rankings job's stored block exactly (a test row per golden case).

### 2.3 The stored shape: `peerRankings/{sym}.metrics`

`persistResults` writes 31 keys (`:1365-1402`), each `stock.metrics?.<key> ?? null` except `squeezeWatch ?? false`:

| Key | Unit as stored |
|---|---|
| `revenueGrowthYOY`, `earningsGrowthYOY` | fraction (EODHD's `QuarterlyRevenueGrowthYOY` / `QuarterlyEarningsGrowthYOY`, raw) |
| `opMarginTTM`, `profitMarginTTM`, `grossMargin`, `roaTTM`, `roeTTM`, `dividendYield` | fraction |
| `evEbitda`, `trailingPE`, `priceSalesTTM`, `priceBookMRQ` | multiple (out-of-range values set to null) |
| `fcfYield`, `fcfMargin` | **percent (×100)** |
| `sixMonthReturn`, `threeMonthReturn`, `oneMonthReturn` | percent, filled later from the job's rolling price history |
| `debtToEquity`, `currentRatio`, `interestCoverage`, `netDebtEbitda` | ratio (`interestCoverage` 100 = net cash with no interest expense; `netDebtEbitda` −1 = net cash) |
| `beatRate` | percent; `beatRateSource` `'computed'` or `'sector_default'` |
| `avgSurpriseMag`, `surpriseConsistency`, `earningsRevisions`, `avgEarningsSurprise` | percent |
| `shortInterestScore`, `shortRatio`, `squeezeWatch`, `marketCap` | EODHD's raw value, days, true/false, dollars |

The census's note holds: `fcfYield` and `fcfMargin` are ×100, while `grossMargin` and the growth figures are fractions.

**Read from production (Firestore, read only; no write).** `peerRankings` holds **240** documents, not 228. In **all 240**, `name` equals the ticker, and `profitMarginTTM` and `shortInterestScore` are null. The cause is in the response, below.

### 2.4 Analyst estimates: **yes**

One fundamentals request for `GLW` with `EODHD_FUNDAMENTALS_FILTER` (10 calls, measured: 555 → 565 on EODHD's user endpoint). `Earnings.Trend` carries what `estimatesFactOf` (`api/_utils/sharedResearch/opening.js:85`) needs:
- **current fiscal year growth:** the row with `period: '0y'`, field `earningsEstimateGrowth` (GLW `"0.3400"`);
- **next fiscal year growth:** `period: '+1y'`, `earningsEstimateGrowth` (`"0.3477"`);
- **the analyst count:** `period: '+1y'`, `earningsEstimateNumberOfAnalysts` (`"19.0000"`).

The rows also carry `earningsEstimateAvg/High/Low`, `epsTrendCurrent`, `epsTrend7/30/60/90daysAgo`, `epsRevisionsUp/DownLast7/30days` and revenue estimates. The values are strings, which is how `estimatesCache` holds them too (its `forwardEstimates` values are strings: read from `estimatesCache/latest`).

Two catches, both built around (`researchMeasures.js` `estimatesOf`):
- Trend keeps **every past period under its old label**: GLW has 41 rows, with every past year still `0y` and every past quarter still `0q`.
- Rows are **keyed by date**, so a quarter that ends with the fiscal year loses its `0q` row to the year's `0y` row. GLW's key `2026-12-31` holds the `0y` row; its latest `0q` row (2026-09-30) is a quarter that was reported on Oct 27.

The rule: a period comes only from the latest-dated row with its label that ends after the last quarter with a reported actual. Otherwise it is null. For GLW that gives the current and next year and the next quarter, and no current quarter.

**Three faults in the response the rankings job reads** (the same response; reported, not fixed, §11):
- Highlights carries `ProfitMargin`, not `ProfitMarginTTM`, which `extractMetrics` reads (`:633`).
- SharesStats carries `ShortPercentFloat`, not `ShortPercentOfFloat` (`:592`).
- The filter's `General::Name` comes back as a top-level key `"General::Name"`, not `General.Name` (`:135`).

### 2.5 Firestore rules: clients denied by default

`firestore.rules` has three wildcard matches. None admits a collection the file does not name:
- `/tournamentGroups/{groupId}/{document=**}` (`:729`) only reaches below `tournamentGroups`.
- `/{path=**}/hypothesisVersions/{versionId}` (`:1312`) only reaches collections named `hypothesisVersions`, and only for a `list` of the caller's own rows.
- `/{document=**}` (`:1641`) is the last rule: `allow read, write: if false`.

So `researchMeasures` and `researchFetchDays` are denied to every client. **No change to `firestore.rules`.** `researchMeasures.test.js` pins all of this from the file.

### 2.6 The saved fetch from Build 1: **found**

Build 1's `raw.json` (Nov 26, 21:29 UTC; 6,062 screener rows, 50,435 exchange-list rows) was still on this machine, in Build 1's session scratchpad. It was copied, and the unmodified generator rebuilt from it byte-identically to the committed directory, so §3 made **no network call**.

---

## 3. PR A: the corrections list (build prompt §3)

### 3.1 What was built

- **`scripts/research-directory-corrections.mjs`** (new, data only, no imports, frozen). Every correction has its ruling and a one-line reason:
  - **leave out (21):** 14 closed-end funds (RU-6), 2 debentures (RU-7), 1 shell (RU-7), 4 second share classes of game stocks (RU-13);
  - **sector fixes (2):** LION → XLC Entertainment, XXI → XLF Capital Markets (RU-7);
  - **restores (2):** MOG-B, AGM-A (RU-11);
  - **venues (1):** BATS (RU-8).
- **`scripts/build-research-directory.mjs`** (edited):
  - `validateCorrections` refuses a malformed list before any network call or write (`runMain` checks it first: review R2-7). It catches a symbol named twice, one of the 228, an unknown kind, a sector that isn't a house id, a missing reason or ruling, a venue that is already kept, and a symbol not in house spelling.
  - `buildDirectory` takes the list as `corrections` (default: none, so Build 1's filter tests are unchanged). The venue correction relaxes the venue filter, and a restore relaxes the type filter, for the rows they name. Every later filter still applies: an ETF on BATS is still dropped by type, and a restored symbol still needs a mapped sector and a name.
  - The leave-outs and sector fixes are applied **after** the filters (`applyCorrectionsAfterFilters`).
  - A row both corrections let through (a restored share class on BATS) counts under both (review R2-8).
  - Every correction is accounted for exactly once: **applied**; **stale** (no screener row names the symbol: reported, not an error); or **no effect** (a filter dropped the row first, and the filter is named).
  - `runMain` applies the named list on every run and writes all of that to `run-report.json`, together with:
    - every BATS row it let in, by name;
    - every retired game symbol in the directory (RU-14);
    - the rows that entered, left or changed against the directory it replaces (`diffDirectories`, read back with `parseDirectoryModuleEntries`).
  - It logs one line for each.
  - The generated header names the list.
- **`api/_utils/researchDirectory.js`**: regenerated from the saved Nov 26 fetch, with no network call.
- **`api/_utils/researchUniverse.boundary.test.js`**: the list and its test are added to the files allowed to name the directory.

### 3.2 The run (offline, from Build 1's `raw.json`)

```
[raw] rebuilt from …/build1-run/raw.json, no network call
[build] 2241 kept, 3594 dropped {"exchange":3374,"type":182,"otc_shaped_code":14,"sector_unmapped":3,"correction_leave_out":21}; 227 game rows
[corrections] 26 applied, 0 stale, 0 with no effect; venue let in CBOE (Cboe Global Markets Inc)
[retired] retired game symbols in the directory: none
[diff] 2259 -> 2241: 3 entered, 21 left, 2 changed
```

| | Rows |
|---|---|
| **Before** | **2,259** |
| **Entered (3)** | **AGM-A** Federal Agricultural Mortgage Corporation (XLF, Credit Services; RU-11) · **CBOE** Cboe Global Markets Inc (XLF, Financial Data & Stock Exchanges; RU-8) · **MOG-B** Moog Inc (XLI, Aerospace & Defense; RU-11) |
| **Left (21)** | Closed-end funds: BCAT, BTT, CET, DXYZ, ECAT, FSCO, GAM, HQH, NBXG, PDO, PSUS, RVT, STEW, TY · Debt: AFGE, DTW · Shell: VYLR · Game share classes: BRK-A, FOX, LEN-B, NWSA |
| **Changed (2)** | **LION** Lionsgate Studios: XLF "Shell Companies" → **XLC "Entertainment"** · **XXI** Twenty One Capital: XLP "Education & Training Services" → **XLF "Capital Markets"** |
| **After** | **2,241** |
| Stale corrections | **none** |
| Retired game symbols in the directory | **none** |

**Rows the BATS rule let in: one, CBOE.** The other two BATS rows the screener returned, EZU and IGV, are ETFs and are still dropped by the type filter. Nothing on the leave-out list came from BATS.

**Per sector after:** XLK 344 · XLV 342 · XLF 376 · XLE 137 · XLY 242 · XLP 92 · XLI 320 · XLB 123 · XLU 61 · XLRE 111 · XLC 93.

A rebuild of the committed file from the saved data, with the committed directory as "previous", is **byte-identical** and reports 0 entered, 0 left, 0 changed.

### 3.3 Tests

`scripts/research-directory-corrections.test.js` (new, 47 rows):
- **the list:** exactly what the rulings name, well formed, data only, frozen, and no business development company left out;
- **`validateCorrections`:** refuses each malformed form; a real run with a malformed list makes no request and writes nothing (R2-7);
- **a restored BATS row** is named among the venue's rows (R2-8);
- **the generator, on fixtures:**
  - each kind of correction;
  - a stale correction;
  - a leave-out a filter beat;
  - a restored symbol with no sector, and one with no name, both still dropped;
  - a restore on an OTC venue, still dropped;
  - a restore the filters did not need;
  - BATS common kept, while a BATS ETF and an OTC line are dropped;
  - every correction accounted once;
  - no corrections = Build 1;
- **`runMain` on a saved fetch:** the real list applied, the report, the log line, RU-14 with a planted retired symbol (MMC), and the entered / left / changed list;
- **the header and the helpers;**
- **the committed directory:** none of the 21, the two fixes, the three entries, every BDC and the four RU-12 symbols present, 2,241.

Every Build 1 directory test passes against the regenerated file unchanged (`build-research-directory.test.js` 91, `researchDirectory.test.js` 18, `researchUniverse.test.js` 101, `researchUniverse.precedence.test.js` 3, boundary 18).

---

## 4. PR B, part 1: one home for the per-stock math (build prompt §4)

### 4.1 Order of commits

1. **`0f0cbd0e` — the golden, before the move.**
   - Twelve made-up fundamentals responses (`api/_utils/__fixtures__/stockMeasuresGoldenInputs.js`) and the exact output of the **unmoved** `fetchSingleFundamental` + `extractMetrics` for each (`api/_utils/__fixtures__/stockMeasures.golden.json`). Captured by running the unmoved code, with `fetch` stubbed.
   - The encoding keeps NaN, Infinity, −0, undefined and key order (a JSON round trip would hide all five). The request URL and the log lines (timestamp cut) are part of each case.
   - The test is `api/cron/compute-rankings.measuresGolden.test.js`.
   - The only change to `compute-rankings.js` in this commit is the `export` keyword on `fetchSingleFundamental` and `extractMetrics`, so the golden can call the unmoved code. Bodies are unchanged.
2. **`73f41b28` — the move.** A script cut exact line ranges out of `compute-rankings.js`, checking every anchor line first, so no body was retyped.
3. The golden passed **unchanged** after the move: 26 rows, the same file byte for byte. (After the review it holds 15 cases and 37 rows; see below.)

### 4.2 The cases (every branch named in the prompt, and more)

| Case | Reaches |
|---|---|
| `full-xlk` (AAPL) | every section; 13 usable quarters (12 read); `General.Name` present; debt, interest, depreciation |
| `financial-no-history` (JPM) | a financial-sector stock (XLF): gross profit = revenue, no capex, **no earnings history** (XLF default); the real `"General::Name"` key |
| `net-cash-no-interest` (XOM) | **a net-cash company**: coverage 100, net debt / EBITDA −1; Trend with no `0y` (the `+1q` fallback) |
| `research-stock-short-history` (GLW) | a symbol outside the 228 (the 0.68 default); **fewer than four quarters** of history and of cash flow; a zero estimate and a missing actual skipped |
| `negative-earnings` (INTC) | **negative earnings**: coverage < 0 → null, EBITDA ≤ 0 → null, negative P/E and EV/EBITDA, zero P/S, negative P/B, negative equity, zero current liabilities |
| `empty-response` (BRK-B) | **every section missing** |
| `valuation-outliers` (KO) | EV/EBITDA > 200, P/E > 500; a zero 30-day-ago estimate; every estimate zero |
| `squeeze-and-odd-debt` (NVDA) | short interest > 15%; a non-numeric debt field with positive equity; no interest expense with net cash; no depreciation; all beats |
| `long-term-debt-only` (MSFT) | `longTermDebt` only; no interest expense with positive net debt; zero revenue; no market value |
| `no-balance-sheet-ebit-field` (PG) | no balance sheet; `ebit` instead of `operatingIncome`; Trend with neither `0y` nor `+1q` |
| `misses-only` (HD) | every quarter a miss; a balance sheet with no yearly income statement |
| `cash-flow-gap` (AMZN) | a non-numeric value in the last four quarters; quarters keyed out of order |
| failure | an HTTP 404 throws `HTTP 404` |
| *Added after the review (L1-2, L1-3), captured, like the twelve, from the unmoved code (the tree at `0f0cbd0e`):* | |
| `fallback-fields` (CSCO) | no debt field (debt 0); `ebit` beside a balance sheet (the fallback in coverage and EBITDA); depreciation not a number; exactly two usable quarters; EV/EBITDA exactly 200, P/E exactly 500, short interest exactly 15 (kept / no squeeze); P/B exactly 0 (null) |
| `odd-income` (ORCL) | operating income not a number and no `ebit` (coverage, EBITDA and the badge EBIT null); equity exactly 0; net debt exactly 0; exactly one usable quarter |
| `no-history-unknown-sector` (ANET) | a symbol outside the 228 with no earnings at all (the 0.68 default of the no-history branch); EBIT exactly 0 with interest (coverage null) |

The review found that the first twelve cases missed six reachable branches and eight boundaries: their mutants survived the golden (lens 1, L1-2 and L1-3). The three cases above were added to the inputs, and the golden was captured again **from the unmoved tree at `0f0cbd0e`**. The first twelve cases came out identical, and the moved code passes all fifteen. Every one of those 14 mutants is now killed by the golden (§9).

### 4.3 The text check: each moved body against `main`

From `compare-bodies.mjs` (each function's body in `api/_utils/stockMeasures.js` against its body in `main`'s `api/cron/compute-rankings.js`):

```
getQuarterlyTTM              main   13 lines | stockMeasures   13 lines | parameters same | body IDENTICAL
computeEpsRevisionScore      main   14 lines | stockMeasures   14 lines | parameters same | body IDENTICAL
computeAvgSurprise           main   15 lines | stockMeasures   15 lines | parameters same | body IDENTICAL
extractBalanceSheetMetrics   main   75 lines | stockMeasures   75 lines | parameters same | body IDENTICAL
computeEarningsConsistency   main   58 lines | stockMeasures   58 lines | parameters same | body IDENTICAL
computeShortInterestMetrics  main   10 lines | stockMeasures   10 lines | parameters same | body IDENTICAL
extractYearlyDebtMetrics     main   12 lines | stockMeasures   12 lines | parameters same | body IDENTICAL
extractMetrics               main  127 lines | stockMeasures  127 lines | parameters same | body IDENTICAL
logInfo                      main    5 lines | stockMeasures    5 lines | parameters same | body IDENTICAL
shapeFundamentals            main's return statement in fetchSingleFundamental (13 lines) | the whole body of shapeFundamentals | IDENTICAL
ALL IDENTICAL
```

### 4.4 Everything else in `compute-rankings.js`

Against `main`, the whole diff is:
- `SECTOR_BEAT_RATES` leaves the `rankingConfig.js` import list (its only reader moved);
- `import { shapeFundamentals, extractMetrics, computeEarningsConsistency } from '../_utils/stockMeasures.js'` and `export { extractMetrics, computeEarningsConsistency }` (the same function objects: `stockMeasures.test.js` checks identity);
- `export` on `fetchSingleFundamental`, whose return becomes `return shapeFundamentals(data, ticker);`;
- lines 354–748 (the moved functions) become a seven-line pointer comment.

The fetch loop, the ranking, the scanner and the writes are not touched. **It keeps exporting `computeEarningsConsistency`**, so the existing test's import still resolves. It also re-exports `extractMetrics` and exports `fetchSingleFundamental`. Those two exports are the one addition beyond the prompt's letter: the golden calls them.

`stockMeasures.js` imports `rankingConfig.js` only (`stockMeasures.test.js` pins it), so the rankings job's import graph cannot reach a research module.

### 4.5 One existing pin touched: a conflict between §4 and §6

`compute-rankings.beatRateSource.test.js` has a static-source row, "extractMetrics forwards the marker". It reads `compute-rankings.js` as text and looks for the line `beatRateSource: earningsConsistencyMetrics.beatRateSource,`. That line is inside `extractMetrics`, so a verbatim move takes it out of the file. The prompt asks for the move (§4) **and** for this pin to pass unchanged (§6). Both cannot hold.

**As built:** the row now reads `stockMeasures.js`, where the line lives, with the regex unchanged, and also pins `compute-rankings.js`'s import of `extractMetrics` from it. Its other rows (the behaviour rows, and the `persistResults` text row) are unchanged. The row still fails if the marker stops being forwarded, wherever `extractMetrics` lives. Recorded in §12 as a question.

---

## 5. PR B, part 2: the fetch and the store (build prompt §5)

### 5.1 `fetchResearchStock(symbol, { db, apiKey, fetchImpl, now, ceiling })` (`api/_utils/researchMeasures.js`)

The store, the network and the clock are passed in. The module imports `rankingConfig.js`, `researchUniverse.js` and `stockMeasures.js` only: no SDK, no environment.

1. **Refusals, before anything is read** (`refusalOf`):
   - one of the 228 → `game_stock`;
   - a retired game stock → `retired`, checked before the directory: Build 1 showed a retired symbol can enter it (Q9);
   - anything not in the directory → `not_on_list`.
   No read, no write, no call.
2. **Kept numbers first** (`planResearchFetch`): a record fetched **7 days ago or less** (exactly 7 days included), in the current shape version, comes back as it is, at 0 calls.
3. **If the last attempt failed less than a day ago** (exactly 1 day included), there is no call: kept numbers from an earlier fetch come back marked stale, else the unavailable mark.
4. **Otherwise one fundamentals request** with the rankings job's own URL and `EODHD_FUNDAMENTALS_FILTER`, after a slot is claimed (5.3).
5. **The numbers** (`measuresOf`):
   - `extractMetrics` runs exactly as in the rankings job;
   - then the earnings-consistency group is recomputed by `computeEarningsConsistency` with `researchSectorOf(symbol)` (§2.2);
   - then each of the 31 `peerRankings` keys is taken `?? null` (`squeezeWatch ?? false`), as `persistResults` does.
   The three momentum keys are null: no price history in this build.
6. **Estimates** (`estimatesOf`), from the same response (§2.4), at no extra call.

### 5.2 What is stored: `researchMeasures/{symbol}`

| Field | |
|---|---|
| `symbol`, `name` | the fundamentals name (from the response's `"General::Name"` key; the directory's name when absent) |
| `sectorId`, `industry` | the directory's |
| `status` | `'ok'` or `'unavailable'` |
| `metrics` | the 31 keys of `peerRankings/{sym}.metrics`, the same units, raw values (a test reads the key list and the defaults out of `compute-rankings.js`) |
| `estimates` | `estimatesCache`'s shape for one stock, less `emsPercentile`: `forwardEstimates` {`currentQtr`, `nextQtr`, `currentYear`, `nextYear`} each {`avg`, `high`, `low`, `numAnalysts`, `growth`}, and the `0y` row's `earningsEstimateNumberOfAnalysts` and 30-day revisions; `rsr`, `ems`, `surpriseStreak`, `avgSurprise` and `estimateSpread` null (Q-2); or `null` |
| `fetchedAt` | the last successful fetch (ISO) |
| `unavailable` | `null`, or `{ reason, at }` for the last failed attempt |
| `shapeVersion` | `1` |

**Never stored:** a rank, a percentile, a tier, a composite score, a pillar, a sector median, a leaderboard (a test walks every key at every depth). `netDebtEbitda` is carried exactly as the math gives it.

### 5.3 The ceiling

- **200 fetches a day** (`DAILY_FETCH_CEILING`; 10 calls each, so 2,000 calls), counted in `researchFetchDays/{YYYY-MM-DD}`.
- The counter is keyed by the **UTC date**, the day EODHD's own usage counter uses: its user endpoint already reported `2026-11-27` at 00:30 UTC on Nov 26 Eastern.
- Each fetch claims a slot in a **Firestore transaction before the call** (`claimFetchSlot`). Over the ceiling nothing is written and no call is made. Kept numbers come back however old, marked stale; with none, `over_ceiling` and no record ("not available today").
- `fetch` without `--go`, `status` and `compare` claim nothing.

### 5.4 Failures

- A non-OK status, a network error, a body that isn't JSON, or an empty response (`{}`, `[]`, or neither Highlights nor Financials) stores `unavailable: { reason, at }`.
- The reason is a fixed code (`http_404`, `network_error`, `bad_json`, `empty_response`). It never carries the URL (which holds the key) or any error text.
- The next touch retries only after 1 day.
- A failed **refetch** keeps the earlier numbers and adds the mark. Old numbers are not thrown away (Q-6).
- Nothing partial is stored as complete: a measure the response lacks is null.

### 5.5 Firestore

Two new collections: `researchMeasures` and `researchFetchDays`. They are written only here, through the Admin SDK the caller passes in. `firestore.rules` is unchanged: clients are denied by default (§2.5). No collection the game reads is named by the module (a test checks every `.collection(...)` call).

### 5.6 `scripts/research-stock.mjs`

| Command | Does | Calls |
|---|---|---|
| `status <SYM>` | what is kept, its age, and today's counter | 0 |
| `fetch <SYM>` | what a fetch would do and cost; writes nothing | 0 |
| `fetch <SYM> --go` | fetches if needed, stores, prints the measures with plain labels | 0 or 10 |
| `compare <SYM>` | one of the 228 only: a fresh response through the research path's own code (`measuresOf` with the house sector) beside `peerRankings/{SYM}.metrics`; writes nothing, claims no slot | 10 |

Credentials come from `.env.local` through `scripts/loadLocalEnv.js` and `api/_utils/firebaseAdmin.js`, as `scripts/explore-publish.mjs` does. Every printed line has the key cut out. Exit codes: 0 done, 1 failed, 2 refused, 3 a compare measure differs.

### 5.7 Still dark

`researchUniverse.boundary.test.js` now guards three names:
- the directory and accessor, as in Build 1, plus `researchMeasures.js` and its test, which import the accessor;
- **the fetch module and the script:** named only by each other, their tests and the boundary test;
- **`stockMeasures.js`:** named only by `compute-rankings.js`, the research modules, the golden and its fixture, `beatRateSource.test.js` and the module's own test.

Planted rows prove each guard catches a route, a cron, a screen, a case variant and a copy. Nothing in the app imports any of them, and the client bundle is byte-identical to `main`'s (§9).

### 5.8 What the review changed in the fetch (§8)

- **At most one fetch per symbol per UTC day** (R2-1, R2-2). The claim transaction records the symbol in the day's counter and refuses a second claim for it (`symbol_claimed_today`: no slot taken, no call). Two consequences:
  - Whatever fails after the call costs one request a day, never one a touch. That covers a store write that fails, and math that throws on an odd response, which is now caught and stored as `compute_error`.
  - Two touches at once cannot both fetch a stock. The second gets what the first stored, or "not available" with no call.
- **A failure is stored in a transaction that reads the record as it is now** (R2-2). Numbers stored by another touch after the attempt began are never replaced by the older failure.
- **A stored time more than a minute in the future is not fresh** (R2-4), so a bad clock cannot pin old numbers or a failure mark for ever.
- **A malformed counter refuses every claim** (R2-5: fail closed; outcome `over_ceiling`, reason `counter_malformed`).
- **The dry run refuses before it reads** (R2-3).
- **A failed refetch keeps the record's own shape version** (R2-6, refuted as unreachable, kept as hardening).
- **The protected-store write scan** (L1-1):
  - The plain write takes its ref by its literal collection name and resolves to `researchMeasures`.
  - The two transaction writes (`claimFetchSlot`, `storeFailure`) are handle-form, which the scan always lists. They are allowlisted by name with a human-review note (`compositionProtectedStoresAllowlist.json`, `_notes_research_numbers`), as the Explore publish step's were.


---

## 6. Tests (build prompt §6)

| File | Rows | What it pins |
|---|---|---|
| `scripts/research-directory-corrections.test.js` (new, PR A) | 47 | §3.3 |
| `api/cron/compute-rankings.measuresGolden.test.js` (new) | 37 | The golden, fifteen cases (§4.2), through the rankings job's own path. |
| `api/_utils/stockMeasures.test.js` (new) | 34 | Imports `rankingConfig.js` only (every import form, a bare one included); exports the shaper and the eight; makes no call and touches no store; the job re-exports the same function objects; the research path reaches the golden through the module directly; pure (same input, same output, input untouched). |
| `api/_utils/researchMeasures.test.js` (new) | 81 | See below. |
| `api/_utils/researchMeasures.precedence.test.js` (new) | 3 | A retired game symbol planted in the directory is refused, with no read, write or call (R2-9). |
| `scripts/research-stock.test.js` (new) | 32 | See below. |
| `api/_utils/researchUniverse.boundary.test.js` (amended, §5.7) | 30 | The three guards, with planted rows for each. |
| `api/cron/compute-rankings.beatRateSource.test.js` (one row amended, §4.5) | 6 | Unchanged but for the one row. |
| `api/_utils/compositionProtectedStoresAllowlist.json` (two keys, one note) | — | The scan's pins (L1-1). |

`researchMeasures.test.js` (81 rows) covers:
- **refusals:** the 228, a game share class, a retired stock, an unlisted symbol, a left-out row, a lower-case spelling, nothing at all; no read, write or call in each case;
- **the record:**
  - the metrics keys and defaults equal `persistResults`', read out of `compute-rankings.js`;
  - no rank, percentile, tier, composite, pillar, median, leaderboard or peers key at any depth;
  - the name, sector, industry, time and version;
  - the units are `extractMetrics`' own;
  - a missing measure is null;
- **the sector:** the sector handed to the math is the research sector; for each of the 228 cases, `measuresOf` is exactly the stored block;
- **estimates:**
  - the period rule;
  - a reported quarter is not the current one;
  - a past `0y` row is never taken;
  - the shape without `emsPercentile`;
  - `estimatesFactOf` reads it;
  - the picker equals `compute-estimates.js`'s `extractForwardEstimate`, body for body;
- **the rules:**
  - kept at 1 hour and at exactly 7 days; refetched at 7 days + 1 ms; an older shape refetched;
  - seven failure kinds stored without the URL or key;
  - retry at exactly 1 day, not before; ten touches of a stock with no data cost one request;
  - a failed refetch keeps the numbers;
- **the ceiling:**
  - the 200th fetch goes through and the 201st makes no call;
  - stale over the ceiling;
  - a new UTC day;
  - two claims at once take two slots;
  - the last slot cannot be passed;
  - a symbol once a day;
  - two touches of one stock at once make one call;
  - a malformed counter fails closed;
  - a refused claim writes nothing;
- **errors after the call:** a failed write and math that throws;
- **a slower failure:** never replaces newer numbers;
- **clocks:** a future time is not fresh;
- **what it may touch:** collections, imports, `firestore.rules`.

`scripts/research-stock.test.js` (32 rows) covers:
- **arguments;**
- **`fetch` without `--go`:** no call and no write; kept; over the ceiling; refused before any read (R2-3);
- **`fetch --go`:** 10 calls and then 0; a failure, with the key never printed;
- **`status`:** reads only;
- **`compare`:** agrees and writes nothing; a differing measure (exit 3), with the fcfYield allowance; "both null" said as such; refuses a research, retired or unknown symbol with no call; claims no slot;
- **secrets and side effects:** the key cut out of every line; runs only when invoked directly.

**No test calls the provider or Firestore.** Every store is the in-memory fake `api/_utils/__testsupport__/mandateFakeFirestore.js`, which re-runs transactions faithfully, and every fetch is a fake.

**Existing pins** pass unchanged: `rankingConfig.test.js`, `compute-index-intelligence.fundamentalsMirror.test.js`, `metricSnapshots.test.js`, `wireGenerationSurface.test.js`, and Build 1's tests (`researchDirectory`, `researchUniverse`, `researchUniverse.precedence`, `build-research-directory`). Two exceptions:
- `compute-rankings.beatRateSource.test.js` has one row amended (§4.5).
- The boundary test is amended as §5.7 asks.

On Windows, `wireGenerationSurface.test.js` fails its 2 hash rows in this worktree, at `main` and at head alike. The checkout is CRLF, so the hashes change. It passes in an LF snapshot and on Linux (the known Windows-only class).

---

## 7. Live check (build prompt §7)

Run from this worktree with `node --env-file=<the main checkout's .env.local> scripts/research-stock.mjs …`. Outputs are verbatim, abridged to the rows asked for.

### 7.1 `compare NVDA`, `compare JPM`, `compare XOM` (30 calls; 668 → 698)

| Measure | NVDA stored = new | JPM stored = new | XOM stored = new |
|---|---|---|---|
| revenueGrowthYOY | 1.032 | 0.102 | 0.326 |
| earningsGrowthYOY | 1.077 | 0.099 | 1.114 |
| profitMarginTTM | **null = null** (equal because both are null, §11) | null = null | null = null |
| grossMargin | 0.7492067656725026 | 1 | 0.29808466057275973 |
| fcfYield | 4.6877975479095415 | −10.005376256128969 | 15.230672162975806 |
| fcfMargin | 46.710409544580614 | −44.12398656970955 | 25.297760936273516 |
| debtToEquity | 0.07255249756823254 | 1.379496631147948 | 0.16784637567177874 |
| currentRatio | 3.905263812455306 | 14.853263554402865 | 1.1527996681874741 |
| interestCoverage | 503.42471042471044 | 0.7415371100533208 | 56.281923714759536 |
| netDebtEbitda | 0.006057194325602342 | 1.9239952834823622 | 0.54823046503479 |
| Result | **all ten agree** | **all ten agree** | **all ten agree** |

The stored side is `peerRankings/{SYM}.metrics` as computed at 2026-11-26T11:00:51Z. The new side is the research path's own `measuresOf`, run with the house sector on a fresh response. `fcfYield` agrees exactly: the market was closed for Thanksgiving, so the market value had not moved. Nothing was written.

### 7.2 `fetch GLW --go`, `fetch ANET --go`, `fetch TSM --go` (30 calls; 698 → 728)

Each dry run said *"Would make one fundamentals request: 10 calls, fetch N of 200 today …"*. Each `--go` said *"Fetched and stored. Calls: 10."*.

**Corning (GLW), as stored:**

| Measure | Value |
|---|---|
| Revenue growth, latest quarter against a year earlier | 18.40% (raw 0.184) |
| Earnings growth, latest quarter against a year earlier | 56.00% (raw 0.56) |
| Profit margin, last twelve months | not available (null; §11) |
| Gross margin, last twelve months | 36.48% (raw 0.36480616006625166) |
| Free cash flow yield | 6.86% (raw 6.859544431650795) |
| Free cash flow margin | 33.43% (raw 33.427396133545926) |
| Debt to equity | 0.87 (raw 0.8658422969424917) |
| Current ratio | 1.59 (raw 1.587775408670931) |
| Interest coverage | 6.78 (raw 6.782738095238095) |
| Net debt to EBITDA | 2.40 (raw 2.398510755653613) |

The record also holds:
- name "Corning Incorporated", sector XLK, industry Electronic Components;
- beat rate 83.3 (computed);
- analyst estimates: EPS growth 34.0% this fiscal year and 34.8% next, 19 analysts on the next year;
- `currentQtr` null (§2.4).

**ANET:** gross margin 62.88%, FCF yield 2.64%, FCF margin 45.93%, debt/equity 0, interest coverage 100 and net debt/EBITDA −1 (net cash), beat rate 100.

**TSM:** FCF yield **271.56%**, FCF margin **97.51%**, P/S 0.3591. These are implausible. A 10-call check of the same response's currency fields (728 → 738) shows the cause:
- `Financials.*.currency_symbol` is **TWD**;
- `General::CurrencyCode` is USD, and `Highlights.MarketCapitalization` (1,775,537,094,656) is in dollars.

That explains two of the three bad numbers:
- **`fcfYield`** divides Taiwan-dollar cash flow by a dollar market value.
- **EODHD's own P/S** is a dollar market value over Taiwan-dollar revenue: 1.7755T / 4.9448T = 0.359.

It does **not** explain the **97.5% FCF margin**, because cash flow and revenue are both in Taiwan dollars. The implied four-quarter free cash flow (about 4.82T TWD) is close to the whole year's revenue (about 4.94T TWD), so the four-quarter cash-flow sum itself looks inflated, about 4.8×. One possible cause is cumulative (year-to-date) or semiannual quarterly statements for a Taiwanese filer. This is **ASSUMED, not checked**; no more calls were spent on it. A currency conversion alone would not fix TSM.

The math is the rankings job's own and is not changed here (§12, Q-12).

### 7.3 `status` on each, then `fetch GLW --go` again

```
GLW … kept numbers are 0.0 hours old
Today's counter (2026-11-27, UTC): 3 of 200 fetches used (30 calls).
(ANET and TSM: the same counter line)
=== fetch GLW --go (again)
Kept numbers used. Calls: 0.
after the second GLW: apiRequests 728 on 2026-11-27
```

**The daily counter after the run: 3 of 200 fetches (30 calls) for 2026-11-27 UTC.**

---

## 8. Review (BUILD_RULES §2)

The cumulative diff is past both thresholds, so review was required, and the prompt asked for two lenses with a refuter each.
- **Lenses:** each lens read a `git archive` snapshot at `853fdf54`, read only.
- **Refuters:** each lens's findings went to a refuter on a fresh snapshot, told to refute them with a concrete repro.
- **Fixes:** the coordinator applied them test-first. Each new row failed on the unfixed code (19 rows for lens 2's findings, recorded before any fix), then passed.
- **Coordinator's own check:** a preliminary full Linux suite at `853fdf54`, before the fixes, found the protected-store red independently of lens 1.

### Lens 1: the rankings job is unchanged

The lens found the output, writes, logs and import graph unchanged, and proved the move three ways:
- the body-by-body comparison;
- `main`'s whole 394-line removed region is one contiguous block of `stockMeasures.js`;
- the golden passes on `0f0cbd0e`'s unmoved code.

| # | Sev. | Finding | Refuter | Disposition |
|---|---|---|---|---|
| L1-1 | important | `compositionProtectedStores.scan.test.js` red: two new write sites not on its allowlist | CONFIRMED (a real CI red, not an OS artifact; it also corrected the count: three sites under two keys at `853fdf54`) | **Fixed**: the plain write takes its ref by literal collection (resolves); the two transaction writes allowlisted with a human-review note (§5.8) |
| L1-2 | important | The golden misses six reachable branches of the moved code (no debt field; the `ebit` fallbacks beside a balance sheet; non-numeric depreciation / operating income; no history with no sector; non-numeric badge EBIT) | CONFIRMED IN PART: the branches are unreached, and reachable with EODHD-shaped nulls; the L224 default is REFUTED as a survivor (killed by `beatRateSource.test.js`, unreachable for the 228); the rankings job is unchanged in these branches (all bodies identical), so the fault is the golden's stated guarantee | **Fixed**: three golden cases captured from the unmoved tree (§4.2); each mutant now killed |
| L1-3 | nit | Eight boundary mutants survive | CONFIRMED (none equivalent; one boundary input each; the squeeze boundary is dead in production while the field name is wrong, §11.2) | **Fixed** in the same cases; each now killed |
| L1-4 | nit | The pointer comment says all eight are "imported above" | CONFIRMED | **Fixed** |
| L1-5 | nit | The import check misses a bare side-effect import | CONFIRMED (partly backstopped: a research module imported that way still fails the boundary test) | **Fixed** (with a row) |
| L1-6 | nit | The research path prints `[RankingsCron]` log lines | CONFIRMED (two lines, the first with an undefined sector) | Recorded (Q-11) |

### Lens 2: the research path is safe and right

| # | Sev. | Finding | Refuter | Disposition |
|---|---|---|---|---|
| R2-1 | important | An error after the call (a failed store write, math that throws) leaves no mark, so every touch pays 10 calls again, up to the ceiling | CONFIRMED IN PART: the write-failure path is real; the math path needs a null map entry EODHD is not known to send; minor while the script is the only caller, important once the app calls it (one symbol could use the shared ceiling) | **Fixed**: at most one fetch per symbol per UTC day; a math error stored as `compute_error` |
| R2-2 | important (latent) | Two touches at once: a slower failure overwrites a faster success | CONFIRMED (minor, latent) | **Fixed**: the failure is stored in a transaction on the record as it is now; numbers fetched after the attempt began stay |
| R2-3 | nit | The dry run reads before refusing | CONFIRMED | **Fixed** |
| R2-4 | nit | A future-dated record is kept or waited on for ever | CONFIRMED | **Fixed**: beyond a minute of skew, not fresh |
| R2-5 | nit | A malformed counter lets requests through | CONFIRMED | **Fixed**: fail closed |
| R2-6 | nit | A failed refetch stamps the current shape version on a record that had none | **REFUTED**: every record the code writes carries the field; the realistic version-bump case is handled | Kept as one-word hardening, with a row |
| R2-7 | nit | The corrections list was checked only after the directory fetch spent calls | CONFIRMED | **Fixed** (PR A) |
| R2-8 | nit | A restored BATS row was missing from the venue's admitted list | CONFIRMED IN PART: the row was named under `applied`, just not under the venue | **Fixed** (PR A) |
| R2-9 | test gap | No test plants a retired symbol in the directory | CONFIRMED (the mutant survived 95 rows) | **Test added** (`researchMeasures.precedence.test.js`) |

**Split:** 15 findings: **11 CONFIRMED** (L1-1, L1-3, L1-4, L1-5, L1-6, R2-2, R2-3, R2-4, R2-5, R2-7, R2-9), **3 CONFIRMED IN PART** (L1-2, R2-1, R2-8), **1 REFUTED** (R2-6). Fixed with a row that failed before the fix: L1-1, L1-5, R2-1, R2-2, R2-3, R2-4, R2-5, R2-7, R2-8. Fixed in the golden, shown by its mutants (survived before, killed now): L1-2, L1-3. Comment fixed: L1-4. Test added: R2-9. Kept as hardening: R2-6. Recorded: L1-6 (Q-11).

### Mutation batteries

- **The coordinator's, on the final code (`e619bc62`), in its own snapshot.**
  - **64 mutants: 63 killed**, each by the row its spec names. There were no load failures and no broken anchors.
  - The 64 are: the fetch module (16), the script (5), the corrections code and list (9), the moved math (6), the boundary guard (2), lens 1's surviving branch and boundary mutants (15), one per review fix (10), and the import check (1).
  - **The survivor** is `measuresOf`'s `squeezeWatch ?? false` → `?? null`. It is **equivalent**: `computeShortInterestMetrics` always returns a boolean, so the default never fires. It mirrors `persistResults` for parity.
- **Lens 1:** 30 mutants on the moved math. 15 killed by the golden at `853fdf54`; the 14 golden survivors are covered above. One more, the L224 default, was killed only by `beatRateSource.test.js` at the time.
- **Lens 2:** 37 mutants. 36 killed; RM4b survived and became R2-9.

### Found by the coordinator, outside the lenses

- The preliminary full suite at `853fdf54` was the first to show the protected-store red (L1-1). It also had one League raw-ids jsdom row time out at 5 s. That row is a known load-sensitive one: the run shared the machine with the review agents and the battery, and no file in this build reaches it. See §9 for the quiet run.
- My own typed full SHA failed the WSL fetch guard (`not our ref`). Nothing ran; it was re-run with the resolved SHA.

---

## 9. Verification

All at the branch head `e619bc62` (`main` had not moved: §0).

| Check | Result |
|---|---|
| Full suite, Linux (WSL, `TZ=UTC`, `--maxWorkers=8`, under the shared suite lock, a private worktree with its own `npm ci` of this lockfile) | **exit 0** · `Test Files  1684 passed | 14 skipped (1698)` · `Tests  39264 passed | 197 skipped (39461)` · 488 s. Tested head `e619bc62` (recorded by the run); every new file ran: `researchMeasures` 81, its precedence 3, `stockMeasures` 34, the golden 37, `research-stock` 32, the corrections 47, the boundary 30, the protected-store scan 30, `beatRateSource` 6. The preliminary run at `853fdf54`, before the review fixes, had 2 failed files: the protected-store scan (L1-1) and one League raw-ids row timing out at 5 s under load. Both pass here, with the League file at 11 of 11. |
| `lint:gate` (whole repo, Windows) | exit 0 |
| `vite build`, `main` @ `a88c204a` and the branch in one tree | **byte-identical** `dist/` (`diff -rq`: no difference; 125 files), at `853fdf54` and again at `dca4bf23` (the review fixes and this report; the commit that adds this line changes only this file). |
| The verbatim move | every moved body identical to `main`'s (§4.3) |
| The golden | 15 cases; captured from the unmoved code at `0f0cbd0e`; passes on the head |
| Offline rebuild of the directory (PR A) | byte-identical to the committed file |
| Mutation battery | 63 of 64 killed; the survivor is equivalent (§8) |
| New files: control, zero-width or bidi characters | none (the moved comments carry `main`'s em dashes, arrows and box-drawing rules) |
| Rules suite | not run: `firestore.rules` is unchanged, and the new collections fall to its default deny (pinned from the file in `researchMeasures.test.js`) |

**Not verified here.** Crons do not run on preview, and nothing here is scheduled. Production saw only the §7 run.

---

## 10. Calls spent

| Step | Calls | Measured (EODHD user endpoint) |
|---|---|---|
| §2 point 4: GLW fundamentals | 10 | 555 → 565 |
| §3: the directory rebuild | 0 | Build 1's saved fetch |
| §7.1: compare NVDA, JPM, XOM | 30 | 668 → 698 |
| §7.2: fetch GLW, ANET, TSM | 30 | 698 → 728 |
| §7.3: status ×3, fetch GLW again | 0 | 728 → 728 |
| §7.2: TSM currency check | 10 | 728 → 738 |
| **Total** | **80** (§7: 70 of its 80) | |

The daily counter `researchFetchDays/2026-11-27`: **3 of 200**.

---

## 11. Found outside the task

Reported for separate tasking; none was fixed (BUILD_RULES §3).

1. **`profitMarginTTM` is always null** for all 240 `peerRankings` docs.
   - `extractMetrics` reads `Highlights.ProfitMarginTTM`; EODHD sends `ProfitMargin` (GLW 0.1213).
   - The ranked dimension `netMargin` (`rankingConfig.js` DIMENSIONS) therefore ranks no stock, and the profitability pillar averages without it.
   - **Fixing it moves the 228's ranks and pillars.**
2. **`shortInterestScore` is always null.**
   - The code reads `SharesStats.ShortPercentOfFloat`; EODHD sends `ShortPercentFloat` (GLW 0.0269).
   - The `shortInterest` dimension ranks no stock, and `squeezeWatch` never fires.
   - The fix also moves ranks. Note too that EODHD's value is a fraction, while the squeeze test `> 15` reads it as a percent.
3. **Every `peerRankings` name is the ticker.** The filter's `General::Name` comes back as a top-level `"General::Name"` key, but `fetchSingleFundamental` reads `data.General?.Name`. The research record reads the right key (§5.2).
4. **`peerRankings` holds 240 documents, not 228.** The extra 12 were not examined.
5. **The moved math throws on a null entry** in `Earnings.History`, the first `Earnings.Trend` row, or a cash-flow quarter (refuter of lens 2, 26 shapes tried on the real GLW response). The rankings job runs `extractMetrics` per ticker with no `try` (`compute-rankings.js`, Phase B1), so one such response would stop the nightly job. EODHD is not known to send one. The research path now catches it (R2-1).
6. **Foreign filers' cash-flow measures are unreliable** (TSM, §7.2).
   - `fcfYield` mixes currencies, and so does EODHD's own `PriceSalesTTM` (0.3591).
   - Separately, the four-quarter cash-flow sum looks inflated about 4.8×, so `fcfMargin` reads 97.5% inside one currency (cause ASSUMED: cumulative or semiannual quarterly statements).
   - None of the 228 was checked for either.
7. **Windows-only:** `wireGenerationSurface.test.js` reds on a CRLF checkout (the known class; passes on LF).

---

## 12. Stopped on a ruling

Built to the letter where one exists. Each looser or stricter reading is a question, not a change. None blocks a merge.

| # | Question | As built |
|---|---|---|
| Q-1 | **§4 and §6 conflict.** A verbatim move takes the line `beatRateSource: earningsConsistencyMetrics.beatRateSource,` out of `compute-rankings.js`, and a row of `compute-rankings.beatRateSource.test.js` (a named pin) reads that file for it. | The one row reads `stockMeasures.js` instead (same regex) and pins the import (§4.5). |
| Q-2 | **Estimates' computed fields.** `rsr`, `ems`, `surpriseStreak`, `avgSurprise` and `estimateSpread` are computed by `compute-estimates.js` functions it does not export. A copy would drift (§4's reason for the move); moving them is a change to another cron (§9). Move them in a later build, as §4 moved the measures? | null |
| Q-3 | **`emsPercentile`** is part of `estimatesCache`'s shape for one stock, and it is a percentile (RU-15). | Left out |
| Q-4 | **The current quarter.** Trend loses the current quarter's `0q` row when the quarter ends with the fiscal year (§2.4). | null when no unreported `0q` row exists |
| Q-5 | **The name** is read from the response's `"General::Name"` key, outside the moved shaper, whose name is always the ticker (§11.3). | Fundamentals name, else the directory's |
| Q-6 | **A failed refetch of a stock with numbers.** §5.4 says store an "unavailable" record. | The old numbers stay, marked with the failure, and come back stale; nothing is thrown away |
| Q-7 | **One fetch per symbol per UTC day** (added by the review, R2-1, R2-2). It bites only after a failure, a shape change, or two touches at once. | As built |
| Q-8 | **The counter's day** is the UTC date, the day EODHD's own counter keys. | UTC |
| Q-9 | **`compare`** costs 10 calls outside the 200-fetch ceiling, and claims no slot (it writes nothing). | As built |
| Q-10 | **Exports beyond "keeps exporting `computeEarningsConsistency`"**: `fetchSingleFundamental` is exported and `extractMetrics` re-exported, for the golden. | As built |
| Q-11 | **The research path logs `[RankingsCron] [RANK] …` lines** (the moved logger; L1-6). For a research stock with fewer than 4 usable quarters, one line names an undefined sector. | As built |
| Q-12 | **Foreign filers (ADRs).** The directory keeps ADRs (Build 1). A filer reporting in its own currency gets a cross-currency FCF yield (TSM 271.56%), and TSM's four-quarter cash flow also looks inflated about 4.8× (FCF margin 97.5%; cause unchecked), so converting currencies would not fix it. Leave as the math gives it; hold back the cash-flow measures when the statement currency is not USD; or keep such filers out of comparisons? | As the math gives it |
| Q-13 | **The three response faults (§11.1–3).** Fixing them is a rankings change: `netMargin` and `shortInterest` would start ranking the 228. A separate build? | Not touched |

---

## 13. Recorded for later builds

- Connect Work an idea, Explore, search, the research modal, Signal Drop and the idea book (Builds 3 to 7). No route, cron or screen imports the new modules today.
- Price history, holders, chart evidence and earnings-call claims for research stocks (out of scope, §9 of the prompt).
- The monthly rebuild reviews the corrections list: stale entries removed, and any retired symbol the run report names ruled on (RU-14).

---

*Report path: `docs/audits/20261126_BUILD_RESEARCH_NUMBERS.md`.*
