# Build report — Stock Research Modal honesty fixes (F1–F9)

**Date:** October 15, 2026 · **Branch:** `claude/research-modal-honesty-fixes` · **Ends as:** a DRAFT pull request (not merged)
**Cut from `main` @** `11ecd41b77015f41b81904c4d31ce52d84ffb112` · **Code commit:** `f457e67c3fd31bff49ed1d93286ebda1d0db663e` · **Branch HEAD:** the commit that adds this report (see the PR)

## Verdict

Eight of the nine fixes are done. **F3 is stopped**: the only way to give the 1D chart a longer daily history changes a request that two existing tests photograph, and the build rules say an existing test may not be changed. Everything else below works with or without F3; the one thing F3 would add is a working 200-day average and a true "52-week" range.

| Fix | Status | What the player sees now | What the player saw before |
|---|---|---|---|
| **F1** Analysis-tab rating | **done** | A chip: **"Wall St: Buy · 24 analysts"**. Uncovered stocks: **"Wall St: no coverage"**. While loading or if loading fails: nothing in that spot. | **"● Buy"** — read like the platform's own verdict. A made-up "Buy" for most tickers when the data hadn't loaded, "Hold" for stocks no analyst covers, and the previous stock's rating after moving to another stock. |
| **F2** Technical tab follows the chart | **done** | RSI, MACD, the 50-day comparison and the price levels always come from daily prices, whichever chart view is on. | On the bomb view they were computed from 30-minute bars (and on 1W from weekly bars) while still labeled "day". |
| **F3** 200-day average never fills | **stopped** | Unchanged: the daily history is 6 months, too short for a 200-day average. | Same. |
| **F4** 50-day average ignored in price levels | **done** | The 50-day average counts toward support/resistance, so some levels appear, move or get stronger. | It was silently left out of every level. |
| **F5** "30d Avg" volume was 20 days | **done** | "30d Avg" is a 30-session average; with fewer sessions the label says so (e.g. "25d Avg"). | A 20-bar average labeled "30d", over whatever bars the chart showed. |
| **F6** "52-week range" | **done** | A label over the range bar: **"52-week range"** only when a full year of daily data is loaded; otherwise the span, e.g. **"Range (6 mo)"** — which is what it reads today, because F3 is stopped. | No label, and the range was whatever the chart had loaded: about 6 months on 1D, 10 days of 30-minute bars on the bomb view. |
| **F7** RSI | **done** | No reading → **"—"** with no zone word and no dot. The zone word now matches the shown number (69.96 shows "70.0 Overbought"). | A missing RSI showed as "50.0 Neutral". 69.96 showed "70.0 Neutral". |
| **F8** MACD "cross" | **done** | **"Above signal line"** / **"Below signal line"**; **"Bullish cross · 2d ago"** only when a cross happened in the last 5 days; **"—"** when there is no MACD. | "Bullish Cross" / "Bearish Cross" whenever MACD was above/below its signal line, cross or not; "Neutral" when missing. |
| **F9** Level distance | **done** | **"-2.97%"** / **"+3.10%"**. | "-2.97" with no unit next to a dollar price. |

## 1. Preamble

- `git fetch origin` ran first. `main` was `11ecd41b` (= the anchor SHA in the prompt); the branch was cut there with a clean tree. The app names the worktree branch `claude/research-modal-honesty-fixes-0cb389`; it is pushed as `claude/research-modal-honesty-fixes`.
- `main` moved during the session to `7d26161f` (PRs #968, #969, #970). None of them touches the four edited files or the modules they read here (`StockChart.jsx`, `technicalIndicators.js`, `eodhdAPI.js`, `fundamentals.js`, `holoTheme.js`). The final checks ran on the branch **merged with `7d26161f`** (a throwaway merge in a private Linux clone), which is what CI tests.
- No feature flag (founder ruling): each change corrects a display that is wrong today.
- Fenced files (BUILD_RULES §1): none called, none edited. The build calls `calculateRSI`, `calculateMACD` and `calculateSMA` from `src/services/technicalIndicators.js` (not fenced, not edited). Not edited either: `api/_utils/`, `api/stocks/fundamentals.js`, `src/components/Research/StockChart.jsx`, `src/constants/holoTheme.js` (the muted color `HOLO_COLORS.textMuted` already existed).

## 2. Reconciliation gate (anchors read at `11ecd41b`, all VERIFIED)

Every anchor was found doing what the prompt described. Line drift only:

| Anchor in the prompt | At `11ecd41b` |
|---|---|
| `useResearchData.js:261-262` (`fetchOpts`, no `days` for 1D) | `:265-266` |
| `eodhdAPI.js:823` (`days` query parameter) | `:822` |
| `fundamentals.js:125-139` (`ratingText`, `analystConsensus`) | `:125-138`; the "Hold" default is `analystRating = 3` at `:93` |
| All other anchors (F1 `:56-82`, `:308-319`, `:343`, `:347`, `:796-801`, v1 `:1102`/`:1220`; F2 `:695-713`, `:726-735`; F4 `levelDetection.js:77-79`; F5 `TechnicalTabV2.jsx:237`/`:275`; F6 `:240-245`; F7 `:139-141`, `:163`; F8 `:144-146`, `:201-205`; F9 `levelDetection.js:353`, `TechnicalTabV2.jsx:84`; `historical.js:29-34`; `StockChart.jsx:598,608,612`) | at the cited lines |

`distanceFromCurrent` readers (F9): only `TechnicalTabV2.jsx`. `confluenceDetection.js:129` builds its own unrelated field; `StockChart.jsx` draws levels by `price` only. The stored field's shape is unchanged.

## 3. The stop — F3, in plain terms

**What F3 needs.** A 200-day average needs about 260 days of daily prices; the 1D chart asks for 6 months (~126 days). The fix is to ask for ~400 calendar days in that same single request.

**Why it stopped.** That request is exactly what two existing test files photograph. Their "OFF references" were captured at an earlier commit (`44d0c63e`) and carry the instruction *"Regenerate ONLY by re-running this file's OFF rows at that SHA … never by blessing build output."* Adding `days: 400` to the 1D request fails 7 rows (proven by applying it and running both files, then restoring):

- `src/components/Research/useResearchData.controlledQuote.test.jsx` — `OFF stock1D`, `OFF cryptoEveningPriority2`, `OFF symbolChange`, and `ON … 1D and 1W: no getStockPrice either; history requests unchanged`.
- `src/components/draft/AssetResearchModal.controlledQuote.test.jsx` — `OFF samePriceUpdate`, `OFF priceless`, `OFF internalNavigation`.

The other routes are closed too: changing the server's 1D default (`api/stocks/historical.js`) or the client fetcher (`src/services/eodhdAPI.js`) is outside this build's fence, and a second, longer daily request on 1D would add a call to scenario (1), which the prompt forbids.

**What the founder can choose.**
1. **Approve re-pinning those 7 rows** to the new request (the OFF references would record `{ days: 400 }` for the 1D request). Then F3 is a small follow-up: the longer request plus handing the chart only its usual ~6 months so the 1D chart's framing does not change. (ASSUMED feasible without touching `StockChart.jsx`; not built.)
2. **Change the server's 1D default** in `api/stocks/historical.js` (a separate, wider task: every 1D history caller would get the longer series).
3. **Leave it.** The 200-day average is only ever a hidden level source (no number shows), so nothing on screen is false; the range simply keeps saying "Range (6 mo)".

**Effect of the stop on the other fixes.** None is blocked. The daily series is the 1D chart's 6-month request (F2 asks for exactly the same thing off 1D, so the Technical tab reads the same on every chart view). So in production today: no 200-day average, and the range label reads "Range (6 mo)", never "52-week". Both become true automatically if F3 lands.

## 4. Per fix — files, lines, tests, mutation checks

Line ranges are at the code commit `f457e67c`. Each mutation check reverted the fix in the working tree, ran its test file, and restored the file byte-for-byte (diff hash identical before and after). **All 13 mutants were caught.**

| Fix | Files and lines | Acceptance test(s) | Mutation check |
|---|---|---|---|
| F1 | `AssetResearchModal.jsx` `:61`, `:70-77` (mock ratings deleted), `:176` (`profileSymbol`), `:311-327` (clear on symbol change, late answers dropped), `:354-375` (chip), `:824-829` (v2 render), `:1119-1131` (v1 render) | `AssetResearchModal.analystChip.test.jsx` (a) covered, (a′) singular, (b) no coverage, (c) no profile, (d) symbol change clears, (d′) late answer dropped | whole file back to `main`: **6/6 fail**. Clear + symbol binding removed: **(d) fails**. Late-answer guard removed: **(d′) fails** (the old company's description appeared under the new one). |
| F2 | `useResearchData.js` `:169-174` (option), `:195-199` (state), `:258`, `:307`, `:803` (on 1D the chart's series is the daily series), `:369-395` (lazy daily fetch), `:733-762` (indicators from it), `:776-785` (levels from it), `:877-883` (returned); `AssetResearchModal.jsx` `:230` (`technicalActive`), `:883` (`dailyData` to the tab) | `useResearchData.dailySeries.test.jsx` — 5 F2 rows | indicators/levels back on the chart's series: **4 fail**. Daily fetch without the Technical-tab gate: **2 fail**. Extra daily fetch on 1D: **1 fails**. |
| F3 | — (stopped) | — | the stop itself is proven: **7 pinned rows fail** (§3) |
| F4 | `levelDetection.js` `:77-80` | `levelDetection.test.js` — 50-day SMA joins the $100 round number (+ two controls) | `.value` reads restored: **1 fails** |
| F5 | `TechnicalTabV2.jsx` `:276-287`, `:340` | `TechnicalTabV2.honesty.test.jsx` — 40 bars → "30d Avg" = 1.7M; 25 bars → "25d Avg" | 20-bar average + fixed label: **2 fail** |
| F6 | `TechnicalTabV2.jsx` `:270-274`, `:288-312`, `:351-356` | same file — 300 bars → "52-week range", old extremes excluded; 120 bars → "Range (5 mo)", all 120 counted | all bars + fixed label: **2 fail** |
| F7 | `TechnicalTabV2.jsx` `:170-179`, `:199-227` | same file — null → "—"; 69.96 → "70.0 Overbought"; 30.04 → "30.0 Oversold" | `rsi ?? 50`, zone from the raw value: **3 fail** |
| F8 | `TechnicalTabV2.jsx` `:37-58` (`describeMacd`), `:182-183`, `:236-246`; hook `:753-762` (6-bar histogram) | same file — 5 rows (above, bullish 2d ago, bearish 0d ago / below, old flip ignored, null "—"); hook file — histogram row | sign-only "Bullish/Bearish Cross": **6 fail** (5 F8 + the F7 null row, which forbids "Neutral") |
| F9 | `TechnicalTabV2.jsx` `:29-35` (`formatDistance`), `:118` | same file — "-2.97%" and "+3.10%" | raw string restored: **1 fails** |

New tests: 4 files, 28 rows. No existing test was modified.

**How the definitions were pinned down** (choices the prompt left open):
- F1 — the chip shows only when the profile **for the displayed symbol** has arrived and carries an analyst count. A missing count shows nothing rather than a rating without its count.
- F6 — "trailing 52 weeks" is taken by date (364 days back from the newest bar): about 252 trading sessions for US stocks, and every day for crypto (which has this tab too; a 252-bar window would have been 36 weeks of crypto called "52-week"). Shorter spans are named in months from the first and last bar dates (capped at 11 so a short year is never called 12 months), or weeks under a month.
- F8 — "n d ago" counts daily bars back to the first bar on the current side of the signal line: `[+,+,+,−,…]` is "2d ago". A cross on the newest bar reads **"0d ago"** — see §7.
- F5 — the newest session is included in the average, as before.

## 5. F2 call count — `/api/stocks/historical` requests per modal open

Counted as calls to `fetchHistoricalOHLCV` with a cold browser cache (its 24-hour client cache can only lower these). "Before" is taken from the pinned OFF references (`stock1D`, `stockBombMidSession`); "after" from the new hook test rows.

| Scenario | Before | After | Change |
|---|---|---|---|
| (1) open on 1D, view the Technical tab | 1 (`1d`) | 1 (`1d`) | **unchanged** |
| (2) open on the bomb view, view the Technical tab | 2 (`30m` 20 days, `1d` 5 days) | 3 (+ `1d`, the same request the 1D chart makes) | **+1** |
| (3) open on the bomb view, never open the Technical tab | 2 | 2 | **unchanged** |

Opening on 1W behaves like (2)/(3). The extra request happens once per symbol per modal: closing and reopening the tab, or switching the chart to 1D afterwards, adds nothing (the switch re-asks for the identical `1d` request, which the client cache answers — VERIFIED by reading `eodhdAPI.js:804`/`:843`, not by a test).

## 6. Visible changes (plain terms)

1. Analysis tab: "● Buy" becomes a chip "Wall St: Buy · 24 analysts", colored by the rating as before.
2. Analysis tab: a stock no analyst covers shows "Wall St: no coverage" in grey instead of "Hold".
3. Analysis tab: if the rating has not loaded or cannot load, nothing shows in that spot (before: an invented "Buy", or a hardcoded rating for eight big names).
4. Analysis tab: after moving to another stock inside the modal, the previous stock's rating, sector and description no longer linger while the new one loads.
5. Technical tab on the bomb or weekly view: RSI, MACD, the 50-day comparison and the price levels now read daily data.
6. Technical tab on the bomb or weekly view: the first open of the tab can show "Loading indicators…" for a moment while the daily data arrives (the one extra request).
7. Chart S/R toggle on the 1W/1M view: draws the same daily levels the Technical tab lists. If the modal opened on the bomb or weekly view and the Technical tab has not been opened yet, the toggle draws nothing (before: levels computed from weekly candles). Modals that open on 1D are unaffected.
8. Price levels: the 50-day average now counts, so some levels appear, move, or change strength.
9. Price levels: distances read "-2.97%" / "+3.10%".
10. Volume: "30d Avg" is a real 30-session average; with fewer sessions the label shows the count, e.g. "25d Avg".
11. Range: a new small label over the range bar — "52-week range" only with a full year of data; today "Range (6 mo)". On the bomb view the range is now the daily range, not 10 days of 30-minute bars.
12. RSI: missing shows "—" with no zone word and no dot (before "50.0 Neutral"); the zone word matches the shown number at the 30/70 edges.
13. MACD: "Above signal line" / "Below signal line" by default; "Bullish cross · 2d ago" / "Bearish cross · 1d ago" only after a real cross in the last 5 days; "—" when missing. The chip no longer capitalizes every word.

## 7. Found on the way — reported, not fixed

- **Level distances are measured from yesterday's close, not the price shown above them** (BUILD_RULES §9). `detectLevels` takes "current" as the newest daily close (`levelDetection.js:16`) while the tab's "Current" row shows the live price (`TechnicalTabV2.jsx:17`, `:139-141`). Mid-session the "-2.97%" can disagree with the dollar gap the player sees. Suggested: compute the distance from the displayed price at render time.
- **"Today" volume** (`TechnicalTabV2.jsx`, the first volume bar) is the newest completed daily session — during market hours, yesterday's.
- **MACD "0d ago"** reads oddly for a cross on the newest bar; "latest session" may be better wording. Founder's call.
- **The v1 modal layout** (the `version < 2` branches of `AssetResearchModal.jsx`, e.g. the AI Analysis section from `:937`) is unreachable: every caller passes `version={2}` or relies on the default 2. It still feeds `getMockFundamentals`' invented 52-week numbers to `TechnicalAnalysisTab` (`:1247`), which is why the mock function had to stay. This build touched v1 only so it renders the same chip.
- **`src/components/BaggerBomb/StockDetailModal.jsx` is not dead**, contrary to the prompt: `PortfolioBuilderBaggerBomb.jsx:15` imports it and renders it at `:1910`, and `App.jsx` imports that screen. Left alone.
- **`technicalAnalysisAI.js`** has no references; **`confluenceDetection.js`** and **`technicalUtils.js`** are referenced only by each other and by comments in `api/_utils/analyticalPrimitives.js`. Left alone.
- `api/stocks/fundamentals.js:71-79` already computes a 50/200-day average and a 52-week high/low server-side (EODHD technicals, else 365 days of its own history). Using them in the tab would be a second, parallel source (§9), so this build did not; noted in case it helps decide F3.
- On Windows, `src/components/Research/StockChart.controlledSession.test.jsx` fails 5 OFF rows under the machine's Eastern time zone (every chart time is off by exactly 5 hours) and passes under `TZ=UTC`. `StockChart.jsx` and everything it imports are untouched by this build; this is the known platform-only failure, and Linux is the suite of record.

## 8. Checks

- **Full suite (Linux, CI-shaped: WSL Ubuntu, Node 20, `TZ=UTC`, `npm run test:run -- --maxWorkers=2`), on `f457e67c` merged with `main` `7d26161f`:** `Test Files  987 passed | 7 skipped (994)` — exit code **0**. `Tests  21002 passed | 88 skipped (21090)`, 0 failed. Tested tree `e7ae9398` = `f457e67c` + `7d26161f`.
- **`npm run lint:gate`** (the CI gate): exit **0**. Full `eslint` on the touched files, before → after: `AssetResearchModal.jsx` 1 error / 4 warnings → 1 / 4; `useResearchData.js` 0 / 4 → 0 / 4; `TechnicalTabV2.jsx` 0 / 0 → 0 / 0; `levelDetection.js` 1 / 0 → 1 / 0 (all pre-existing); the four new test files 0 / 0.
- **`vite build`:** exit **0** (code commit merged with `main`). The report commit is docs-only; suite, `lint:gate` and build were re-run on it (merged with `main`) before the push, with the result in the PR description.
- **The four existing tests named in the prompt** (`useResearchData.controlledQuote`, `AssetResearchModal.controlledQuote`, `AssetResearchModal.stockReward`, `StockChart.controlledSession`): unmodified; 72/72 pass under `TZ=UTC` on Windows and in the Linux run (24 + 22 + 2 + 24). The four new files pass 28/28 there.
- **Review threshold (BUILD_RULES §2):** the branch diff is 9 files and about 1,035 lines including this report, under 10 files / 1,500 lines, so the multi-lens adversarial review is not required and was not run. File count stayed inside the §0 fence (4 source files, 4 new tests, this report).
