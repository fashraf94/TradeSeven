# Build report — Research modal follow-up: F3 (200-day average) + four display-agreement fixes

**Date:** October 15, 2026 · **Branch:** `claude/research-modal-f3-200day` · **Ends as:** a DRAFT pull request (not merged, CI not watched)
**Cut from `main` @** `83ec3b88ce1cdec1ea8b3a0a841d15e20edd20f2` (the merge of PR #971) · **Code commits:** `ce31757a` (the build), `767e1116` (the review fixes), `adb4f4d0` (the verifier's correction) · **Branch HEAD:** the commit that adds this report (see the PR)

## Verdict

All five items are done and both read-only gate checks passed. Two things went beyond the prompt's words. F3 needed one more test constant re-pinned than the founder's ruling covered: I stopped before writing code, asked, and the founder extended the ruling (§1). And the mandatory review (11 files) found that D-1, as first built, made the chart's S/R lines disagree with the Technical tab. That is fixed inside the fence: the chart and the tab now side every level from the same price (§7).

| Item | Status | What the player sees now | What the player saw before |
|---|---|---|---|
| **F3** 200-day average | **done** (re-pin ruled + extended) | The Technical tab is computed from about 13 months of daily prices. The 200-day average now counts toward price levels. The range reads **"52-week range"** (a true year), and "30d Avg" is a 30-session average. The 1D chart still opens on exactly the same ~6 months as before. | 6 months of daily prices: no 200-day average, and the range read "Range (6 mo)". |
| **D-1** Level distance and side | **done** | Each level's distance ("-1.05%") and whether it sits above or below **come from the price in the "Current" row**. A level between yesterday's close and that price moves to the correct side, in the tab **and** in the chart's S/R lines. | Measured from yesterday's close while "Current" showed another price. A level could sit on the wrong side, with a distance that didn't match the dollar gap on screen. |
| **D-2** S/R toggle on 1W/1M | **done** | Turning S/R on draws the daily levels. It fetches them once if needed, and that request is shared with the Technical tab, so opening the tab afterwards fetches nothing more. | On a modal opened on the weekly or bomb view, S/R drew **nothing** until the Technical tab had been opened. |
| **D-3** MACD wording | **done** | **"Bullish cross · latest session"** for a cross on the newest bar. Older crosses keep "· 1d ago", "· 2d ago". | "Bullish cross · 0d ago". |
| **D-4** "Today" volume | **done** | The first volume bar reads **"Today"** only when it really is the current session's bar. Otherwise it reads **"Last session · Oct 14"**. | Always "Today", even during market hours, when the bar is yesterday's. |
| **V-1** Server honors `days` on daily data | **passed** | — | — |
| **V-2** Client cache keyed by `days` | **passed** (founder ruling: report the gap) | — | The cache key ignores `from`/`to`. This was harmless; see §2 and §8. |

## 1. Preamble

- `git fetch origin` ran first. `main` was `83ec3b88` (the merge of PR #971, so the prerequisite holds), and the branch was cut there with a clean tree. The app names the worktree branch `claude/research-modal-f3-200day-d3be95`; it is pushed as `claude/research-modal-f3-200day`. `main` did not move during the session (re-fetched before the final runs and before the push: still `83ec3b88`).
- **Two founder rulings were given in this session**, asked before any code was written:
  1. **Re-pin extended.** F3 also changes `DAILY_CALL` in `src/components/Research/useResearchData.dailySeries.test.jsx:112`. That is the prior build's own F2 test, and it records the 1D chart's request as `'1d', null`. Three of its rows fail under `days: 400`. The prior report's "7 rows" proof ran only the two reference files, so it never counted this file. Ruling: *"Extend re-pin"* — that one constant also becomes `{ days: 400 }`. Its diff is quoted in §3.
  2. **V-2 passes, gap reported.** The client cache keys on `days` but not on `from`/`to`. Ruling: *"Pass, report the gap"* (§2, §8).
- No feature flag (same ruling as the prior build).
- **Fence.** Fenced files (BUILD_RULES §1): none edited, none called. Also untouched: `api/_utils/`, `api/stocks/historical.js`, `src/services/eodhdAPI.js`, `src/services/technicalIndicators.js`, `src/services/levelDetection.js` and `src/components/Research/StockChart.jsx`. Functions called but not edited: `fetchHistoricalOHLCV` (new options), `calculateSMA`, `calculateRSI`, `calculateMACD`, `calculateRollingSMA` and `detectLevels` (now fed 400 days).
- **Controlled quotes.** No controlled-quote behavior changed. There is no quote request in controlled mode, and history requests on mount are unchanged apart from the ruled `days` value. The controlled 1D chart gets the same bars as before.
- **Files: 11.** 3 source files; 4 existing test files, each change ruled or authorized (the two re-pins, the extended re-pin, and the D-3 row the prompt names); 3 new test files; this report. That crosses the BUILD_RULES §2 threshold (≥ 10 files), so the multi-lens adversarial review ran (§7). The branch diff is about 1,050 lines of code and tests plus this report, under 1,500.

## 2. Gate checks (read at `83ec3b88`, VERIFIED)

**V-1 — the server honors `days` for daily data: PASSED.**
- `api/stocks/historical.js:145` reads `days` from the query.
- `:169` sets `numDays = days ? Math.min(parseInt(days, 10), 1095) : config.days`.
- `:184-187` derives the start date from it (`from` = the UTC date of now − numDays).
- The daily (`eod`) path at `:360-362` requests `…&from=${fromDate}`, so `days` applies to `'1d'`, not only to the intraday paths.
- The server's own cache key includes `numDays` (`:172`).

**V-2 — the client cache is keyed by `days`: PASSED (with a reported gap).** `src/services/eodhdAPI.js:804` and `:843`:

```js
const cacheKey = `ohlcv_${upperSymbol}_${timeframe}${days ? `_${days}d` : ''}`;
// …
const actualCacheKey = `ohlcv_${upperSymbol}_${result.timeframe}${days ? `_${days}d` : ''}`;
```

- **Days separation holds.** Keys are namespaced by data type (`cacheService.js:108`; `'historical'` is the 24-hour tier at `:53`). The 5-day request is cached as `historical:ohlcv_AAPL_1d_5d` and the 400-day one as `historical:ohlcv_AAPL_1d_400d`, so neither can ever be served for the other.
- **Gap:** `from`/`to` are not in the key.
  - The only `'1d'` caller that sends them is `src/components/draft/ScoreBreakdownPopover.jsx:58` (`{ from, to }`, no `days`). It is cached as `historical:ohlcv_SYM_1d`, the same key the modal's 1D request used **before** this build.
  - The server ignores `from`/`to` on the daily path (`historical.js:192-201` uses them only for intraday). So both callers got the same 180-day series, and nothing wrong was ever shown.
  - After this build the modal uses `…_1d_400d` and no longer shares a key with the popover.

## 3. The re-pin — the full diffs, verbatim

The ruling allows, in the two generated reference files, only the `days` value on the 1D request rows plus one note line per file. The diffs below show exactly that:
- 7 `null` → `{ "days": 400 }`;
- one crypto request gains `"days": 400,`;
- 2 note lines.

The ON row "1D and 1W: no getStockPrice either; history requests unchanged" reads `OFF.stock1D`, so it is re-pinned with no line of its own. The review checked that the pinned blocks equal a capture taken at the code head, byte for byte, for all 6 + 4 entries (§7, lens C).

```diff
diff --git a/src/components/Research/useResearchData.controlledQuote.test.jsx b/src/components/Research/useResearchData.controlledQuote.test.jsx
index 02981a53..0ca98b85 100644
--- a/src/components/Research/useResearchData.controlledQuote.test.jsx
+++ b/src/components/Research/useResearchData.controlledQuote.test.jsx
@@ -139,6 +139,7 @@ function sessionBars(date, startPrice, { upto = '19:30' } = {}) {
 // BEGIN GENERATED OFF REFERENCES — captured at the pre-build SHA 44d0c63eba4e3099552d3ec3dbde6a89660a7e06 (6 entries).
 // Regenerate ONLY by re-running this file's OFF rows at that SHA with
 // SHADOW_OFF_CAPTURE_DIR set; never by blessing build output.
+// re-pinned by founder ruling 2026-10-15 (research modal F3), 1D request now `{ days: 400 }`; all other rows unchanged.
 const OFF = {
  "cryptoEveningPriority2": {
   "calls": [
@@ -147,6 +148,7 @@ const OFF = {
     "BTC",
     "1d",
     {
+     "days": 400,
      "type": "crypto"
     }
    ],
@@ -201,7 +203,9 @@ const OFF = {
     "fetchHistoricalOHLCV",
     "AAPL",
     "1d",
-    null
+    {
+     "days": 400
+    }
    ],
    [
     "getStockPrice",
@@ -493,7 +497,9 @@ const OFF = {
     "fetchHistoricalOHLCV",
     "AAPL",
     "1d",
-    null
+    {
+     "days": 400
+    }
    ],
    [
     "getStockPrice",
@@ -503,7 +509,9 @@ const OFF = {
     "fetchHistoricalOHLCV",
     "MSFT",
     "1d",
-    null
+    {
+     "days": 400
+    }
    ],
    [
     "getStockPrice",
diff --git a/src/components/draft/AssetResearchModal.controlledQuote.test.jsx b/src/components/draft/AssetResearchModal.controlledQuote.test.jsx
index 4609e148..5f5564e0 100644
--- a/src/components/draft/AssetResearchModal.controlledQuote.test.jsx
+++ b/src/components/draft/AssetResearchModal.controlledQuote.test.jsx
@@ -204,6 +204,7 @@ const LEGACY_PROPS = {
 // BEGIN GENERATED OFF REFERENCES — captured at the pre-build SHA 44d0c63eba4e3099552d3ec3dbde6a89660a7e06 (4 entries).
 // Regenerate ONLY by re-running this file's OFF rows at that SHA with
 // SHADOW_OFF_CAPTURE_DIR set; never by blessing build output.
+// re-pinned by founder ruling 2026-10-15 (research modal F3), 1D request now `{ days: 400 }`; all other rows unchanged.
 const OFF = {
  "heldLegacy": {
   "body": {
@@ -267,7 +268,9 @@ const OFF = {
      "fetchHistoricalOHLCV",
      "AAPL",
      "1d",
-     null
+     {
+      "days": 400
+     }
     ],
     [
      "getStockPrice",
@@ -277,7 +280,9 @@ const OFF = {
      "fetchHistoricalOHLCV",
      "MSFT",
      "1d",
-     null
+     {
+      "days": 400
+     }
     ],
     [
      "getStockPrice",
@@ -304,7 +309,9 @@ const OFF = {
     "fetchHistoricalOHLCV",
     "TSLA",
     "1d",
-    null
+    {
+     "days": 400
+    }
    ],
    [
     "getStockPrice",
@@ -322,7 +329,9 @@ const OFF = {
     "fetchHistoricalOHLCV",
     "AAPL",
     "1d",
-    null
+    {
+     "days": 400
+    }
    ],
    [
     "getStockPrice",
```

**The extended re-pin** (ruling 1 in §1). The same line's trailing comment records the ruling:

```diff
diff --git a/src/components/Research/useResearchData.dailySeries.test.jsx b/src/components/Research/useResearchData.dailySeries.test.jsx
index fcad3a8d..2f5be593 100644
--- a/src/components/Research/useResearchData.dailySeries.test.jsx
+++ b/src/components/Research/useResearchData.dailySeries.test.jsx
@@ -109,7 +109,7 @@ function seed() {
 }
 const BOMB_CALL = ['fetchHistoricalOHLCV', 'AAPL', '30m', { days: 20 }];
 const DAILY_CHANGE_CALL = ['fetchHistoricalOHLCV', 'AAPL', '1d', { days: 5 }];
-const DAILY_CALL = ['fetchHistoricalOHLCV', 'AAPL', '1d', null]; // the 1D chart's own request
+const DAILY_CALL = ['fetchHistoricalOHLCV', 'AAPL', '1d', { days: 400 }]; // the 1D chart's own request (re-pinned by founder ruling 2026-10-15, research modal F3)
```

**The D-3 row the prompt names** ("update the F8 row that expects '0d ago'"):

```diff
diff --git a/src/components/Research/TechnicalTabV2.honesty.test.jsx b/src/components/Research/TechnicalTabV2.honesty.test.jsx
index e1ee58c4..d4d311af 100644
--- a/src/components/Research/TechnicalTabV2.honesty.test.jsx
+++ b/src/components/Research/TechnicalTabV2.honesty.test.jsx
@@ -138,9 +138,9 @@ describe('F8 — MACD says "cross" only when one happened', () => {
     expect(rowText('MACD Signal')).toBe('MACD Signal Bullish cross · 2d ago');
   });
 
-  it('positive → negative on the latest bar → "Bearish cross · 0d ago"; negative throughout → "Below signal line"', async () => {
+  it('positive → negative on the latest bar → "Bearish cross · latest session"; negative throughout → "Below signal line"', async () => {
     await render({ indicators: { ...QUIET, macd: { macd: -1, signal: -0.8, histogram: -0.2 }, macdHistogram: [-0.2, 0.1, 0.2, 0.3, 0.4, 0.5] } });
-    expect(rowText('MACD Signal')).toBe('MACD Signal Bearish cross · 0d ago');
+    expect(rowText('MACD Signal')).toBe('MACD Signal Bearish cross · latest session');
     await render({ indicators: { ...QUIET, macd: { macd: -1, signal: -0.8, histogram: -0.2 }, macdHistogram: [-0.2, -0.1, -0.2, -0.3, -0.4, -0.5] } });
     expect(rowText('MACD Signal')).toBe('MACD Signal Below signal line');
   });
```

No other existing test changed; the review commits `767e1116` and `adb4f4d0` touch none of these four files.

**How the re-pin was proven:**
1. Applying `days: 400` with the reference files untouched failed exactly these rows: the 7 re-pinned rows, the 3 `DAILY_CALL` rows, and the F8 "0d ago" row.
2. After the re-pin, all rows pass. The rows assert the whole recorded view (requests, lengths, tails, header, readout), so the requests' `days` value was the only difference.
3. Reverting `days: 400` again (mutant `F3-request`, §4) fails the 7 re-pinned rows and the 3 `DAILY_CALL` rows.

## 4. Per item — files, lines, tests, mutation checks

Lines are at the final code commit `adb4f4d0`. Each mutation check applied one defect in the working tree, ran the named tests, and restored the file byte for byte (SHA-256 identical before and after).
- **Round 1** (the build, `ce31757a`): 9 of 9 caught.
- **Round 2** (after the review fixes, `767e1116`): 23 of 23 caught.
- **Round 3** (after the verifier's correction, `adb4f4d0`): **6 of 6** caught. These are the D-1 mutants re-run against the changed helper, plus the cents rule and a tie mutant. The other round-2 mutants touch no line that changed.

The counts below are the latest run of each mutant.

| Item | Files and lines | Acceptance test(s) | Mutation check (round 2) |
|---|---|---|---|
| F3 request | `useResearchData.js` `:161-172` (`DAILY_HISTORY_DAYS = 400`, `CHART_1D_DAYS = 180`, `chartWindow1D`); `:320-323` (the chart's `'1d'` request gets `{ days: 400, …crypto }`; `'1w'` stays `null`); `:436` (lazy daily fetch); `:845` (Retry) | `useResearchData.f3.test.jsx`: one `{ days: 400 }` request, ≥ 260 closes, `sma200` = the mean of the newest 200 closes (the fixture's closes differ by period, so 50 or 126 closes give a different mean); levels include a `200-day SMA` factor; the real Technical tab reads "52-week range" and "30d Avg" = 2.0M over 30 sessions | old options at the three request sites: **28 rows fail**, including the **7 re-pinned rows** and the 3 `DAILY_CALL` rows. `sma200` over 50 closes: **1 fails** |
| F3 framing | `useResearchData.js` `:302` (cache hit), `:350` (fresh fetch), `:853` (Retry): on 1D the chart gets `chartWindow1D(…)`; the cache and the daily series keep all 400 days | the chart's series **equals** what the server's 180-day default returns (stock: weekdays from `UTC(now − 180 d)`; crypto: 180 daily bars), and so does its SMA overlay; the same after 1D → 1W → 1D (cache) and after Retry | window dropped at the fresh fetch: **2 fail**; at the cache hit: **1**; at Retry: **1** |
| F3 stale-only series | `useResearchData.js` `:173-175` (`noChartBars1D`), used at `:327`, `:438`, `:849` | a symbol with bars only 7+ months old: error "No historical data available" (Retry shows), no chart bars, no daily series, **no previous close or daily change**. Retry says the same, and the lazy fetch keeps nothing | rule removed at the fetch / Retry / lazy fetch: **1 / 1 / 1 fail** |
| D-1 | `useResearchData.js` `:177-202` (`sideOfShownPrice`, `sideLevelsAt`, `distanceFromShownPrice`: real prices, `detectLevels`' formula and tie rule); `TechnicalTabV2.jsx` `:73-76`, `:129` (the rows), `:31-38` (`formatDistance` rounds before signing); `AssetResearchModal.jsx` `:245-256` (`chartLevels`, `chartHighlight`, memoized), `:805`, `:807` | `TechnicalTabV2.displayAgreement.test.jsx`: $470.62 vs shown $475.60 (close $485.05) reads **"-1.05%"**, not "-2.97%"; $480 flips to resistance (click reports `RESISTANCE`, "+0.93%"); $490 flips to support below $495; a level exactly at the shown price is resistance "0.00%"; DOGE-like $0.2001 / $0.2051 around $0.2049 read support "-2.34%" / resistance "+0.10%"; SHIB-like sub-cent levels get real distances; never "-0.00%"; with no shown price the stored sides stay and no distance shows. `AssetResearchModal.displayAgreement.test.jsx`: the chart's dashed line at $480 is red (resistance), the tab row is red, the tapped highlight is red; in controlled mode, a quote above $480 turns the line and the highlight to support | tab back to stored sides and distance: **8 fail**; compare at cents (the reverted rule): **3**; a tie counted as support: **1**; sign before rounding: **2**; chart given the close-sided levels: **1**; highlight keeps its tapped side: **1** |
| D-2 | hook `useResearchData.js` `:214-216` (`srRequested`), `:420-446` (the lazy fetch runs for `technicalActive \|\| srRequested`, each listed as its own dependency); modal `AssetResearchModal.jsx` `:180-183` (`srSymbol`), `:235`, `:239-244` (click capture), `:763` | hook: toggle on with nothing cached → one daily request, then the tab → none; the reverse order; the toggle during an in-flight request; after a **failed** request, opening the tab asks again; neither → none. Modal (clicks the REAL pill in the REAL chart): one request and lines drawn (none before); a second click and the SMA pill add nothing; 1D adds nothing; a new symbol starts with S/R off; controlled view: one history request, never a quote | hook ignores the toggle: **6 fail**; one combined dependency: **1**; no in-flight guard: **1**; modal stops noticing the click: **4** |
| D-3 | `TechnicalTabV2.jsx` `:55` | the F8 row (prompt-named) expects "latest session"; a new row: a cross one bar back still reads "1d ago" | "0d ago" restored: **1 fails**; "latest session" also for one bar back: **1 fails** |
| D-4 | `TechnicalTabV2.jsx` `:288-308` (label from the newest volume bar's date vs `sessionDate`), `:350-376` and `:418-448` (both bars share a 3-column grid so the longer label fits); `useResearchData.js` `:38` (`sessionDateOf` exported); `AssetResearchModal.jsx` `:910` | tab: newest bar = session date → "Today" 2.5M; Oct 14 bar on Oct 15 → "Last session · Oct 14". Modal (real tab): a stock after the close with today's bar → "Today"; BTC at 9 PM ET with the UTC Oct 16 bar → "Today" (an ET date would say "Last session · Oct 16"). `sessionDateOf` at 10 PM ET: stock "2026-10-14", crypto "2026-10-15" | label fixed at "Today": **1 fails**; no session date passed: **2**; crypto flag dropped: **1** |

New tests: 3 files, **35 rows**: `useResearchData.f3.test.jsx` 15, `TechnicalTabV2.displayAgreement.test.jsx` 11, `AssetResearchModal.displayAgreement.test.jsx` 9. The modal file was first written as `AssetResearchModal.srToggle.test.jsx` and renamed in `767e1116` when it took on D-1 and D-4.

**Layout (D-4), measured in headless Edge, not jsdom.** I took the real tab's HTML, rendered it at 280, 320, 390 and 480 px, and measured:
- "Last session · Oct 14" stays on one line (98 px wide, the same 15 px height as "30d Avg").
- Both bars start at the same x, and nothing overflows the page.
- With "Today", the bar starts at 74 px, where the old flex layout put it (16 + 50 + 8).

**Choices the prompt left open:**
- **F3 framing is by date, not a bar count.** The chart is handed the bars dated on or after `UTC(now − 180 days)`. That is exactly the start date the server computes for its default request, so the chart shows the same bars as before. The prompt's "~126 bars" is that window for a US stock. For crypto, a 126-bar count would have cut the chart from 6 months to about 4; the date window keeps its 180 daily bars.
- **The chart's SMA overlay stays computed on the 6-month window** (it derives from the chart's series), so the 50-day line still starts 50 bars into the chart.
- **A symbol with no bar in the last 180 days** (halted or delisted) gets the same "no data" it got from the 180-day request: "Chart data unavailable" with Retry, and no daily change.
- **D-1 siding lives in the hook module.** The helper is in `useResearchData.js` rather than in `TechnicalTabV2.jsx`. The tab still calls it at render time, as the prompt asks. The reason: every existing modal test mocks `TechnicalTabV2` as `{ default: () => null }`, so a helper exported from that file would have broken those tests. The modal hands the chart the same sided levels, which is what makes the chart and the tab agree.
- **D-1 uses the real prices, with `detectLevels`' formula and tie rule** (a level at the price is resistance).
  - The review fix first compared at cents, to match the two decimals shown. The verifier showed that breaks sub-dollar and sub-cent crypto: every DOGE-class level reads "$0.20", a level 2.3% below the price came out as resistance at "0.00%", and the chart drew it on the wrong side. Corrected in `adb4f4d0`.
  - The cost is small: a level within half a cent of the price can print the same "$x.xx" as "Current" and still sit on the side its real price puts it (§8).
- **D-1 with no shown price** (the "Current" row reads $0.00): the levels keep `detectLevels`' sides and show no distance.
- **D-2 detection.** The S/R toggle's on/off state is private to `StockChart.jsx` (`useState` at `:71`, no callback prop), and that file is outside the fence.
  - So the modal watches clicks in the chart area (capture phase), recognizes the pill by its text `S/R`, and records the symbol the click was for. The chart remounts per symbol (`key`), which turns S/R off again.
  - The first click on a mounted chart is always "on". A later "off" click asks for nothing new, because the series is cached by then.
  - The coupling is to the pill's text: if `StockChart` renames it, the toggle goes back to drawing nothing until the Technical tab opens, and the modal test fails.
  - A cleaner wiring, an `onToggleSR` prop, needs a `StockChart.jsx` edit (§8).
- **D-4 label.** The date is the bar's own `YYYY-MM-DD`, printed as "Oct 14" with UTC formatting of the date string, so no time zone can shift it. "Today" is decided against `sessionDateOf`, the hook's existing session-date function (ET for stocks, UTC for crypto).
- **D-1's acceptance figure.** The prompt says "-1.04%". The code's formula, the one `detectLevels` uses — (level − reference) / reference — gives (470.62 − 475.60) / 475.60 = −1.0471%, which rounds to **"-1.05%"**. The test asserts what the code shows. The prompt's figure looks like truncation.

## 5. Call count — `/api/stocks/historical` requests per modal open

Counted as calls to `fetchHistoricalOHLCV` with a cold browser cache, from the test rows named. Its 24-hour client cache can only lower these.

| Scenario | Before (`main`) | After | Change | Pinned by |
|---|---|---|---|---|
| (1) open on 1D, view the Technical tab | 1 (`1d`, server default 180 days) | 1 (`1d {days:400}`) | **unchanged count** (the request is longer) | `dailySeries` "1D chart + Technical tab"; `f3` "one request for { days: 400 }" |
| (2) open on the bomb view, view the Technical tab | 3 (`30m` 20d, `1d` 5d, `1d`) | 3 (`30m` 20d, `1d` 5d, `1d` 400d) | **unchanged** | `dailySeries` "bomb view + Technical tab" |
| (3) open on the bomb view, never open the Technical tab | 2 | 2 | **unchanged** | `dailySeries` "Technical tab never opened" |
| (4) open on 1W, turn S/R on | 2, and S/R drew nothing | 3 (`1w`, `1d` 5d, `1d` 400d), and S/R draws the levels | **+1, once per symbol** | `f3` D-2 rows; modal "1W: S/R on" |
| (4′) then open the Technical tab, or toggle S/R again | — | +0 | shared | same rows |
| 1W, neither S/R nor the tab | 2 | 2 | unchanged | `f3` "neither the toggle nor the tab" |

The +1 in (4) is the same request the Technical tab already made in (2); the prompt's rule allows at most +1 per symbol per modal, shared. After a **failed** daily request, opening the Technical tab asks again, as it did before this build. Remaining failure-path corners are in §8.

## 6. Visible changes (plain terms)

1. Technical tab: the price levels can now include the 200-day average. Some levels appear, move or change strength.
2. Technical tab: the levels' "High Volume Node" ingredient now looks at about 13 months of trading instead of 6, so a level can move for that reason too. This is per spec ("levels from the full series").
3. Technical tab: RSI, MACD and the 50-day comparison read the same numbers as before; the longer warm-up changes them by tiny amounts.
4. Range: the label reads **"52-week range"** for any stock with a year of history (it read "Range (6 mo)"). The high and low now cover the full year.
5. Volume: "30d Avg" covers 30 sessions everywhere, including the bomb and weekly views.
6. The 1D chart opens exactly as before: same bars, same framing, same SMA lines.
7. A stock with no trades in the last 6 months shows "Chart data unavailable" with Retry, as before.
8. Price levels: each level's side and distance are measured from the "Current" price shown above them. A level between yesterday's close and that price moves to the other list and changes color.
9. Chart, with S/R on: the dashed lines are colored by the same rule, so a line's color always matches its row in the tab. Before, they were colored by yesterday's close. In a held (controlled) view, a line can change color when a new accepted price crosses it.
10. Chart: a tapped level's solid line uses the same color as its row, and follows if the price crosses it.
11. Distances never read "-0.00%". A level exactly at the "Current" price reads "0.00%" and counts as resistance.
12. Chart S/R toggle on the weekly view: draws the daily levels at once. The first time it needs one extra request, shared with the Technical tab.
13. MACD: "Bullish cross · latest session" instead of "· 0d ago".
14. Volume: the first bar reads "Today" only when it is today's session; during market hours it reads "Last session · Oct 14". The bars line up whatever the label's length.

## 7. Review (BUILD_RULES §2: 11 files)

**How it ran.**
- Four lenses, one reviewer each, on `ce31757a`: A domain correctness, B wiring/lifecycle/request counts, C test integrity and the re-pin bound, D display agreement/quote integrity/fence.
- Each worked on its own LF `git archive` snapshot in the session scratchpad, read-only on git and on the working tree.
- Each lens's findings went to a separate refuter, told to refute with a concrete repro. All four refuters ran code (scratch tests in their snapshots, deleted afterwards).
- The fixes landed as one commit, `767e1116`. One more verifier read the fix diff (result below), and the round-2 mutation set (§4) covers every fix.

**Outcome: 31 findings** (30 plus one informational).
- 26 CONFIRMED, 5 PARTLY (a part refuted: A5, B4, B6, D6, D8), 0 fully REFUTED. Two more claims inside CONFIRMED findings were refuted: A1's "proxy message" and a B2 sub-case.
- A1 = B1 = D9 and A2 = C4 = D1 are the same defects found by different lenses.
- Fixed in `767e1116` (one part corrected in `adb4f4d0`): 6 code defects (B2 and D3 only partly) and 5 test gaps, plus one retitled row.
- The rest are pre-existing, per spec, or need a fenced file: reported in §8.

| ID | Finding | Verdict | Disposition |
|---|---|---|---|
| A1 / B1 / D9 | A symbol whose bars are all 180–400 days old got a blank chart (no error, no Retry), and the header read e.g. "▲ 35% today" from a months-old close | CONFIRMED (medium). The refuter also found the stale close feeding the bomb view's baseline. Its "or a proxy message" detail is refuted: the fetcher never throws | **Fixed** (`noChartBars1D` at all three sites) |
| A2 / C4 / D1 | After D-1, the chart's S/R line and the tab put a level between the close and the shown price on opposite sides, in opposite colors | CONFIRMED (medium) | **Fixed**: one helper sides levels for the tab and the chart |
| D2 | The tapped highlight kept the side recorded at the tap after the shown price moved | CONFIRMED (low) | **Fixed** (side re-derived from the highlight's price) |
| D3 | Sides and distances used raw floats while both prices show cents ("$475.60" vs "$475.60" → support "-0.00%") | CONFIRMED (low) | **Partly fixed.** "-0.00%" is gone (A4). The cents comparison tried in `767e1116` was reverted in `adb4f4d0` (verifier V2): sides stay on real prices, and the sub-cent edge goes to §8 |
| A4 | "-0.00%" for a distance under 0.005% | CONFIRMED (low) | **Fixed** (`formatDistance` rounds before signing) |
| B2 | The S/R flag never clears. After a failed daily request: (a) no retry, including on Technical-tab re-entry; (b) a later bomb switch or A→B→A could fetch once with S/R off | CONFIRMED (narrow). One sub-case PARTLY: the toggle was still on | **Partly fixed**: separate dependencies, so tab re-entry retries again. Remainder in §8: toggling S/R off/on still doesn't retry, and (b) |
| C1 | The in-flight row could not fail when the guard was removed | CONFIRMED | **Fixed** (by the B2 dependency split; mutant now fails it) |
| C2 | The sma200 row did not pin the 200-close period | CONFIRMED | **Fixed** (fixture) |
| C3 | Nothing pinned the modal's session-date prop or its crypto flag | CONFIRMED | **Fixed** (two modal rows, real tab) |
| C6 | No row for "1d ago" next to "latest session" | CONFIRMED | **Fixed** (row) |
| C7 | A level exactly at the shown price was untested | CONFIRMED | **Fixed** (exact-tie row; the tie mutant fails it) |
| C-info | The modal row "S/R off again" could not see the off state | CONFIRMED | Row retitled to what it tests ("a second S/R click") |
| A3 | detectLevels keeps 4 levels per side from the close; after re-siding, a side can show fewer than 2 rows | CONFIRMED (low) | Report (§8; `levelDetection.js` is outside the fence) |
| A5 | Levels now see 400 days. The swing-points part is REFUTED (they never change); the volume-profile part is real (143 of 300 synthetic series moved) | PARTLY | Per spec (the prompt puts levels on the full series); stated in §6 |
| A6 / D4 | "Current" is the price at open in legacy mode, while the chart's live candle and the header's % follow the live price | CONFIRMED, pre-existing | Report (§8, founder question) |
| B3 | 1W → S/R → 1D re-asks the identical 400-day request (usually a client-cache hit) | CONFIRMED, pre-existing shape | Report |
| B4 | The in-flight slot holds one symbol (A→B→A while in flight → a duplicate request). The "not via D-2" part is refuted: S/R can reach it too | PARTLY, pre-existing | Report |
| B5 | Retry has no symbol guard; a late retry can write A's data under B | CONFIRMED, pre-existing | Report |
| B6 | "Today" can stay until the next re-render after midnight (≤ 60 s in legacy mode) | PARTLY: not a regression (before, it always said "Today") | Report |
| C5 | The framing fixture uses the same date formula as the code; a local-date mutant survives under UTC (CI runs UTC); `>`-for-`>=` is caught only by the crypto row | CONFIRMED (low) | Report |
| C8 | `shortDate`'s UTC pin is guarded only when the suite runs west of UTC | CONFIRMED (low) | Report |
| D5 | "N% through range" can exceed 100 while the dot is clamped | CONFIRMED, pre-existing | Report |
| D6 | Legacy crypto: the header's % uses an ET-keyed previous close; the new label uses the UTC session | PARTLY: the header keying is the pre-existing part | Report |
| D7 | "1d ago" counts sessions but reads like calendar days | CONFIRMED (wording) | Report (founder's call) |
| D8 | In a controlled view, S/R on 1W makes one history request (no quote request). The "new request class" part is refuted: the Technical tab already made it | PARTLY | Covered by a new controlled row; no code change |
| D10 | `CHART_1D_DAYS = 180` copies the server's default by hand | CONFIRMED (low) | Report |

**Verifier read of `767e1116`.** An independent agent checked each fix on its own snapshot.

What it verified:
- The stale-only rule, at all three sites. It also confirmed nothing else can pick up a months-old close (daily change, bomb baseline, today's candle).
- The memoized sided levels: above the early returns, no redraw on every tick, the same price for the tab and the chart.
- Rounding, the dependency split (request counts unchanged), the three test files, and the fence (none of the four ruled test files touched).

It found three things:

| ID | Finding | Verdict | Disposition |
|---|---|---|---|
| V1 | The cents helper rounded with `Math.round(x*100)` while the screen uses `toFixed(2)`. They disagree on about 41% of exact half-cent prices | CONFIRMED | Moot: the cents helper was removed in `adb4f4d0` |
| V2 | Comparing at cents broke sub-dollar and sub-cent crypto. DOGE-like $0.2001 read as resistance "0.00%" 2.3% below a $0.2049 price; SHIB-like levels all became resistance with a blank distance; the chart drew lines on the wrong side | CONFIRMED (medium, introduced by `767e1116`) | **Fixed** in `adb4f4d0`: real prices again, plus a DOGE-like row and a sub-cent row (the cents rule fails all three new rows) |
| V3 | With S/R on, after a **failed** daily request, closing the Technical tab also re-asks (the dependency split re-runs the effect on every tab change) | CONFIRMED (low; failure path only) | Report (§8) |

It also re-reported, as pre-existing, the tapped highlight that is never cleared on a symbol change (§8).

## 8. Found on the way — reported, not fixed

1. **Which price the levels are measured from (founder question).**
   - In the default (legacy) modal, the "Current" row and the header price are the asset's price when the modal opened. The chart's live candle and the header's "% today" follow the live price (`AssetResearchModal.jsx:147-161`, `:229-231`).
   - D-1 binds the levels to "Current", as the prompt says, so levels, "Current" and the chart's S/R colors agree. They can still disagree with the live candle mid-session.
   - Moving everything to the live price is a separate decision; it would move pinned OFF rows (`samePriceUpdate`).
2. **S/R toggle wiring.** The modal recognizes the S/R pill by its text, because the toggle's state is private to `StockChart.jsx`. An `onToggleSR` prop on `StockChart` would remove the coupling, and with it the failure-path remainders (B2, V3). After a failed daily request with S/R on:
   - toggling S/R off and on doesn't retry (re-entering the Technical tab does);
   - closing the Technical tab also re-asks;
   - a later switch to the bomb view, or A→B→A, can fetch once with S/R off.
3. **Prices print with two decimals for every asset** (pre-existing). A DOGE-class level reads "$0.20" whatever its real value, and a level within half a cent of a stock's price can print the same "$x.xx" as "Current" while sitting on the side its real price puts it. The sides and distances are right (real prices); only the printed precision is short. A per-asset price format would fix both.
4. **`detectLevels` keeps the 4 closest levels per side from the close** (`levelDetection.js:49`, `:54`). After re-siding around a price far from the close, one side can show fewer than two rows, even though a fifth level existed.
5. **Duplicate daily requests (pre-existing shapes):**
   - 1W → S/R or Technical → 1D re-asks the same 400-day request; the main fetch's cache check ignores `${symbol}_1d_technical`.
   - The in-flight slot holds one symbol.
   - The client fetcher does not merge identical in-flight requests.
6. **Retry has no symbol guard** (`useResearchData.js` `retry`). A Retry that resolves after navigating to another symbol writes the old symbol's data under the new one.
7. **A tapped level's highlight is never cleared on a symbol change.** The next symbol's chart draws the old level's line (pre-existing).
8. **"N% through range" is not clamped** (e.g. "104% through range" on a new-high day); the dot is (`TechnicalTabV2.jsx`, Volume & Range).
9. **"1d ago" counts sessions**, so on a Monday morning "1d ago" is Thursday. "N sessions ago" would be exact (founder's call; D-3 fixed only "0d ago").
10. **Legacy crypto header.** Between 00:00 and 04:00 UTC the header's "% today" is measured from an ET-dated previous close (`useResearchData.js:17-25`, `:203`); controlled mode already uses UTC for crypto.
11. **`CHART_1D_DAYS = 180` mirrors the server's `'1d'` default** (`api/stocks/historical.js:32`). A change there must be mirrored, or the 1D chart's framing drifts.
12. **Two guards only fail outside UTC**, and CI runs UTC: the local-date variant of `chartWindow1D`, and `shortDate`'s `timeZone: 'UTC'`. Both are correct in code.
13. **V-2 gap.** The client cache key omits `from`/`to` (`eodhdAPI.js:804`). Harmless today, because the server ignores them on daily data. A future daily `from`/`to` caller would share a key with a plain daily request.
14. **The two reference headers still say "Regenerate ONLY … at that SHA (44d0c63)".** Regenerating by that instruction would bring back `null` and turn the suite red (detectable). The added note line records the re-pin.
15. **The prompt's D-1 figure.** "-1.04%" for $470.62 vs $475.60 is a rounding slip; the code shows "-1.05%" (§4).

## 9. Checks

- **Full suite (Linux, CI-shaped).** WSL Ubuntu, Node 20.20.2, `TZ=UTC`, `vitest run --maxWorkers=2` (the CI command), in a private clone checked out at each code head.
  - **`adb4f4d0` (final code):** `Test Files  990 passed | 7 skipped (997)`, `Tests  21037 passed | 88 skipped (21125)` (= 21,002 at `main` + the 35 new rows), exit code **0**. Tested head recorded in the clone: `adb4f4d054be57f15f76e38066294298cf080bd6`.
  - **`767e1116`:** `Test Files  990 passed | 7 skipped (997)`, `Tests  21035 passed | 88 skipped (21123)`, exit **0**.
  - **`ce31757a`:** `Test Files  990 passed | 7 skipped (997)`, `Tests  21024 passed | 88 skipped (21112)`, exit **0**.
  - `main` was `83ec3b88` throughout (re-fetched before each run and before the push), and the branch is cut on it, so the branch is the PR's merge result.
- **`npm run lint:gate`** (the CI gate) at all three code heads: exit **0**.
- **`vite build`** at all three code heads: exit **0**. The report commit is docs-only; `lint:gate` and `vite build` were re-run on that exact head before the push (result in the PR description).
- **Mutation checks:** round 1, 9/9 caught; round 2, 23/23; round 3, 6/6. Every file was restored byte for byte (§4).
- **On Windows:** the 9 affected test files pass (108 tests). The full Windows suite is not the suite of record: its known platform-only failures (path separators, CRLF, and `StockChart.controlledSession` under the Eastern zone) are pre-existing and untouched here.
- **The rules suite** (`npm run test:rules`, Firestore emulator) was not run: no rules, API or server file changed.
