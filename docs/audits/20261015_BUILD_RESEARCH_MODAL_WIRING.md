# Build report — Research modal wiring follow-up (W-1 to W-5)

**Date:** October 15, 2026 · **Branch:** `claude/research-modal-wiring` · **Ends as:** a DRAFT pull request (not merged, CI not watched)
**Cut from `main` @** `0eb36c28` (the merge of PR #973) · **Commits:** `d1bb76b5` (the build), `eb9bc516` (the merge of `main` @ `1d6d5d4a`, which brought #972 and #974), `2e74a625` (the review fixes), `3693e872` (one more review row) · **Branch HEAD:** the commit that adds this report (see the PR)

## Verdict

All five items are done. Two of them needed more than the prompt's rulings allowed, so I stopped before writing any code and asked; the founder extended both rulings (§1). The mandatory review (13 files) found no high-severity defect. Its two medium findings were a chart-label failure for coins priced below $0.0000001 (no listed coin trades there) and a header-versus-tab disagreement on a battle type that cannot be created today. The first is fixed, and the second is a founder question (§8). The review also asked for "one precision per asset" and a list of missing test rows; both are done in `2e74a625` (§7).

| Item | Status | What the player sees now | What the player saw before |
|---|---|---|---|
| **W-1** S/R toggle wiring | **done** | Turning S/R on loads the daily levels when they are missing, exactly as before. After a failed load, turning S/R off and on tries again. Closing the Technical tab, switching views, or going to another stock and back never loads anything while S/R is off. | The modal guessed the toggle from a click on a button reading "S/R". After a failed load, toggling did not retry, closing the Technical tab asked again, and a later view switch could load with S/R off. |
| **W-2** "Current" is the live price | **done** (re-pin ruled + extended) | In the default modal the header price, "Current", each level's distance and side, and the chart's S/R colours all follow the live price — the one the header's "% today" and the chart's live candle already showed. The held (controlled) view is unchanged. | The header price and "Current" stayed at the price from when the modal opened, while the "% today" and the live candle moved. |
| **W-3** Per-asset price format | **done** (fence ruled + extended) | DOGE reads **$0.2049**; a sub-cent coin reads **$0.00001234**. Each asset's prices (header, "Current", levels, range) use one precision, chosen by its price, and for sub-dollar coins the chart's axis and line labels use the same one. Stocks are unchanged (**$475.60**). | Two decimals everywhere: every DOGE level read "$0.20", and sub-cent coins read "$0.00". |
| **W-4** Cross wording by date | **done** | **"Bullish cross · latest session"** for the newest bar; an older cross reads its bar's date: **"Bullish cross · Oct 13"**. | "· 1d ago", "· 2d ago" (counting sessions, which read like days). |
| **W-5** Tapped level cleared on a symbol change | **done** | Moving to another stock (or back, or the screen reopening the modal on another stock) clears the tapped level and its line before the new chart appears. | The old stock's tapped line was drawn on the next stock's chart. |

## 1. Preamble

- **Session opener.** Branch `claude/research-modal-wiring-e236e3` (the app's worktree name; pushed as `claude/research-modal-wiring`), HEAD `0eb36c28`, clean tree. `git fetch origin` ran first: `main` was `0eb36c28`, the merge of PR #973, so the prerequisite held, and the branch was cut there.
- **`main` moved during the session** to `1d6d5d4a` (#972 BaggerBomb stock thresholds v2, #974 Command Center hub S1). Both touched `StockChart.jsx` (the bomb view's levels, hits and markers) and `AssetResearchModal.jsx` (`bombData`). Neither overlapped a line this build changed. I merged `main` with the app's sync (`eb9bc516`, no conflicts), and every final check ran on the merged tree, which is what CI tests. `main` was re-fetched before the push: still `1d6d5d4a`.
- **Two founder rulings, asked before any code was written:**
  1. **W-2 re-pin extended.** Re-pinning `samePriceUpdate` also breaks one line outside the ruled diff: the ON-F2b row read `OFF.samePriceUpdate.header[0]` and expected `'$104.00'` (`AssetResearchModal.controlledQuote.test.jsx:499`). Ruling: *"Extend re-pin to :499"* — that literal becomes `'$104.60'`, its comment says legacy now follows the live price, and the note line records both. The diff is in §3.
  2. **W-3 fence extended.** Two of W-3's surfaces were outside the files I could edit: the header price is printed in `ChartHeader.jsx`, and the tapped level's line label is the chart library's axis label. Ruling, verbatim: *"Extend the W-3 fence: ChartHeader.jsx for the price-formatting call only; StockChart.jsx for the price-line labels the modal draws and, only if the chart's price axis does not already handle sub-dollar precision, the series priceFormat precision — nothing else. Quote both diffs in the report beside the W-1 diff. Put the new formatter in its own small module beside the Research components (not inside useResearchData.js), imported by the tab, the header and the chart, so no component imports the hook for a formatter. If either file needs anything beyond that, STOP on W-3 and build the rest."* Neither file needed more (§2).
- **No existing formatter to reuse (W-3).** The only sub-dollar price formatters in the app are private to their files (`WatchlistTable.jsx:32`, `SwapMarketModal.jsx:23`, `FreeAgentBar.jsx:35`). They also use 6 fixed decimals below $0.01, which prints $0.00001234 as "$0.000012". The new helper is `src/components/Research/priceFormat.js`.
- **No feature flag** (the same ruling as the prior two builds).
- **Fence.** No BUILD_RULES §1 file was edited or called. Also untouched: `api/`, `src/services/eodhdAPI.js`, `src/services/technicalIndicators.js`, `src/services/levelDetection.js`, `StockChart.controlledSession.test.jsx` and `useResearchData.controlledQuote.test.jsx`. No new price request exists on any path: W-2 reuses the price the hook already received (`sheetPrice` is the hook's previous `currentPrice` expression, verbatim).
- **Files: 13.**
  - 6 source files: `AssetResearchModal.jsx`, `useResearchData.js`, `TechnicalTabV2.jsx`, `StockChart.jsx` (the W-1 bound plus the ruled W-3 line), `ChartHeader.jsx` (ruled), and the new `priceFormat.js`.
  - 3 existing test files, each edit allowed: the bounded re-pin, and the two W-4 files the prompt names.
  - 3 new test files (42 rows), and this report.
  - That crosses the BUILD_RULES §2 threshold (≥ 10 files), so the multi-lens adversarial review ran (§7). The code and test diff is 1,089 lines against `main`.

## 2. The `StockChart.jsx` and `ChartHeader.jsx` diffs, verbatim (against `main` @ `1d6d5d4a`)

```diff
diff --git a/src/components/Research/StockChart.jsx b/src/components/Research/StockChart.jsx
index 87ba657f..9c7a491f 100644
--- a/src/components/Research/StockChart.jsx
+++ b/src/components/Research/StockChart.jsx
@@ -5,6 +5,7 @@ import { prepareChartData, formatTime, calculateBombLevels, measuredBombLevels,
 import { detectTrendlines } from './trendlineDetection';
 import OHLCDisplay from '../shared/OHLCDisplay';
 import { getDailyHL } from '../../services/websocketService';
+import { priceDecimals } from './priceFormat';
 
 const TIMEFRAMES = [
   { key: '1D', label: '1D' },
@@ -51,6 +52,7 @@ const StockChart = ({
   todayDailyCandle,  // Today's daily OHLCV candle with authoritative high/low
   realtimeExtremes,  // Battle hook's real-time intraday high/low { high, low } (optional backup)
   controlledSession, // Optional { crypto }: controlled held research. Absent = legacy.
+  onToggleSR,        // Optional (isOn) => void, called when the S/R pill flips
 }) => {
   const chartContainerRef = useRef(null);
   const chartRef = useRef(null);
@@ -550,7 +552,10 @@ const StockChart = ({
         }
       }
     } else {
-      // Normal view: Candlestick + volume
+      // Normal view: Candlestick + volume. A sub-dollar asset's axis — and so the
+      // labels of the S/R and tapped-level lines drawn on this series — takes
+      // the modal's price precision; $1 and up keep the default two decimals.
+      const decimals = priceDecimals(chartData[chartData.length - 1]?.close);
       const candleSeries = chart.addSeries(CandlestickSeries, {
         upColor: HOLO_COLORS.green,
         downColor: '#ff4757',
@@ -558,6 +563,7 @@ const StockChart = ({
         borderDownColor: '#ff4757',
         wickUpColor: HOLO_COLORS.green,
         wickDownColor: '#ff4757',
+        ...(decimals > 2 ? { priceFormat: { type: 'price', precision: decimals, minMove: 1 / 10 ** decimals } } : {}),
       });
       candleSeriesRef.current = candleSeries;
 
@@ -935,7 +941,7 @@ const StockChart = ({
             <button onClick={() => setShowSMA(v => !v)} style={pillStyle(showSMA)}>
               SMA
             </button>
-            <button onClick={() => setShowSR(v => !v)} style={pillStyle(showSR)}>
+            <button onClick={() => { setShowSR(v => !v); onToggleSR?.(!showSR); }} style={pillStyle(showSR)}>
               S/R
             </button>
           </div>
```

```diff
diff --git a/src/components/Research/ChartHeader.jsx b/src/components/Research/ChartHeader.jsx
index 402c6f31..045c2c0f 100644
--- a/src/components/Research/ChartHeader.jsx
+++ b/src/components/Research/ChartHeader.jsx
@@ -1,6 +1,7 @@
 import React from 'react';
 import { HOLO_COLORS, CATEGORY_CONFIG, getSectorColor } from '../../constants/holoTheme';
 import { INDEX_REGISTRY } from '../../constants/indexRegistry';
+import { priceText } from './priceFormat';
 
 /**
  * ChartHeader - Compact 56px header bar for the redesigned research modal.
@@ -101,7 +102,7 @@ const ChartHeader = ({ asset, sector, category, isIndex, onClose, onWhyMoving, o
           color: HOLO_COLORS.textPrimary,
           fontFamily: 'monospace',
         }}>
-          ${asset.price?.toFixed(2) || '—'}
+          ${priceText(asset.price) || '—'}
         </span>
 
         {/* Daily change pill */}
```

**How each hunk maps to the bound:**
- **W-1** is the prop (`:55`) and its call at the pill's toggle (`:944`). Nothing else in StockChart changed for W-1: no series, lines, framing, time handling or controlled path.
  - With the prop absent, nothing new runs: no state, effect, ref or render. `StockChart.controlledSession.test.jsx` renders without it, unmodified, and passes 24/24.
  - The state update keeps its functional form. The reported value is computed from the same render; two reviewers proved that real input cannot make them disagree (§7, WB1).
- **W-3 (ruled)** is the import (`:8`) and the series precision (`:558`, `:566`).
  - *The ruling's condition holds.* lightweight-charts 5.1.0's default series format is precision 2, minMove 0.01. So the axis did not already handle sub-dollar prices: 0.2049 printed "0.20".
  - *The price-line labels.* The library labels price lines (the S/R lines and the tapped line) with the series' own formatter. So the series precision **is** the label change, and no `createPriceLine` call changed.
  - *Only the normal view's candle series gets it.* The bomb and spectate series, the volume series and the SMA/trendline series are untouched, and rows pin that. For $1+ assets no option key is added at all.
- **ChartHeader** is the one formatting call and its import.

## 3. The re-pin and the two W-4 test files — the full diffs, verbatim

The ruling (prompt + extension) allows, in `AssetResearchModal.controlledQuote.test.jsx`, only `samePriceUpdate`'s recorded view, the ON-F2b row's read of it, and one note line. Running the OFF rows against the build changed exactly one value (`header[0]`: `$104.00` → `$104.60`). The rest of the recorded view (calls, the "▲ 4.60%" pill, the readout) did not move. A review mutant that put the header back on the open price failed only "OFF samePriceUpdate" (§7, WC1). `useResearchData.controlledQuote.test.jsx` has no diff.

```diff
diff --git a/src/components/draft/AssetResearchModal.controlledQuote.test.jsx b/src/components/draft/AssetResearchModal.controlledQuote.test.jsx
index 5f5564e0..f117b5c8 100644
--- a/src/components/draft/AssetResearchModal.controlledQuote.test.jsx
+++ b/src/components/draft/AssetResearchModal.controlledQuote.test.jsx
@@ -205,6 +205,7 @@ const LEGACY_PROPS = {
 // Regenerate ONLY by re-running this file's OFF rows at that SHA with
 // SHADOW_OFF_CAPTURE_DIR set; never by blessing build output.
 // re-pinned by founder ruling 2026-10-15 (research modal F3), 1D request now `{ days: 400 }`; all other rows unchanged.
+// re-pinned by founder ruling 2026-10-15 (research modal W-2), legacy Current follows the live price: samePriceUpdate's header price and the ON-F2b row's read of it; all other rows unchanged.
 const OFF = {
  "heldLegacy": {
   "body": {
@@ -339,7 +340,7 @@ const OFF = {
    ]
   ],
   "header": [
-   "$104.00",
+   "$104.60",
    "▲ 4.60%"
   ],
   "readout": [
@@ -496,7 +497,7 @@ describe('ON — healthy held open', () => {
     expect(readout()).toEqual(['O 102.00', 'H 106.20', 'L 101.50', 'C 104.60']);
     expect(net.calls.length).toBe(before);
     expect(document.body.querySelectorAll('[data-test-drawer]').length).toBe(chartsBefore);
-    expect(OFF.samePriceUpdate.header[0]).toBe('$104.00'); // legacy kept its symbol-keyed price
+    expect(OFF.samePriceUpdate.header[0]).toBe('$104.60'); // legacy now follows the live price (research modal W-2)
   });
 
   it('crypto (V-11): no observed open anywhere — readout "—", popup body without open', async () => {
```

**W-4, the rows the prompt names** ("the two D-3 rows in `TechnicalTabV2.honesty.test.jsx` and the '1d ago' row"). The honesty file's "2d ago" row now expects the bar's date. Its "latest session" row gains the date fixture but keeps its expectation: with dates available, the newest bar must still read "latest session". The display-agreement file's "1d ago" row (and its describe title) now expects "Oct 14".

```diff
diff --git a/src/components/Research/TechnicalTabV2.honesty.test.jsx b/src/components/Research/TechnicalTabV2.honesty.test.jsx
index d4d311af..8771288c 100644
--- a/src/components/Research/TechnicalTabV2.honesty.test.jsx
+++ b/src/components/Research/TechnicalTabV2.honesty.test.jsx
@@ -126,20 +126,23 @@ describe('F7 — RSI shows a reading or nothing', () => {
 });
 
 describe('F8 — MACD says "cross" only when one happened', () => {
+  // The dates of the bars behind the histogram readings, newest first (Oct 15 2026 is a Thursday).
+  const MACD_DATES = ['2026-10-15', '2026-10-14', '2026-10-13', '2026-10-12', '2026-10-09', '2026-10-08'];
+
   it('histogram positive for 6 bars → "Above signal line"', async () => {
     const h = [0.5, 0.4, 0.3, 0.2, 0.1, 0.05];
     await render({ indicators: { ...QUIET, macd: { macd: 1, signal: 0.5, histogram: 0.5 }, macdHistogram: h } });
     expect(rowText('MACD Signal')).toBe('MACD Signal Above signal line');
   });
 
-  it('negative → positive 2 bars ago → "Bullish cross · 2d ago"', async () => {
+  it('negative → positive two bars back, on Oct 13 → "Bullish cross · Oct 13" (the date of the cross bar)', async () => {
     const h = [0.3, 0.2, 0.1, -0.1, -0.2, -0.3];
-    await render({ indicators: { ...QUIET, macd: { macd: 1, signal: 0.7, histogram: 0.3 }, macdHistogram: h } });
-    expect(rowText('MACD Signal')).toBe('MACD Signal Bullish cross · 2d ago');
+    await render({ indicators: { ...QUIET, macd: { macd: 1, signal: 0.7, histogram: 0.3 }, macdHistogram: h, macdHistogramDates: MACD_DATES } });
+    expect(rowText('MACD Signal')).toBe('MACD Signal Bullish cross · Oct 13');
   });
 
   it('positive → negative on the latest bar → "Bearish cross · latest session"; negative throughout → "Below signal line"', async () => {
-    await render({ indicators: { ...QUIET, macd: { macd: -1, signal: -0.8, histogram: -0.2 }, macdHistogram: [-0.2, 0.1, 0.2, 0.3, 0.4, 0.5] } });
+    await render({ indicators: { ...QUIET, macd: { macd: -1, signal: -0.8, histogram: -0.2 }, macdHistogram: [-0.2, 0.1, 0.2, 0.3, 0.4, 0.5], macdHistogramDates: MACD_DATES } });
     expect(rowText('MACD Signal')).toBe('MACD Signal Bearish cross · latest session');
     await render({ indicators: { ...QUIET, macd: { macd: -1, signal: -0.8, histogram: -0.2 }, macdHistogram: [-0.2, -0.1, -0.2, -0.3, -0.4, -0.5] } });
     expect(rowText('MACD Signal')).toBe('MACD Signal Below signal line');
diff --git a/src/components/Research/TechnicalTabV2.displayAgreement.test.jsx b/src/components/Research/TechnicalTabV2.displayAgreement.test.jsx
index 7e4d3d5d..cd9efc51 100644
--- a/src/components/Research/TechnicalTabV2.displayAgreement.test.jsx
+++ b/src/components/Research/TechnicalTabV2.displayAgreement.test.jsx
@@ -180,12 +180,15 @@ function firstVolumeRow() {
   return { label: row.firstElementChild.textContent, value: row.lastElementChild.textContent };
 }
 
-describe('D-3 — a cross one bar back keeps its count', () => {
-  it('negative → positive one bar before the newest → "Bullish cross · 1d ago" (only the newest bar is "latest session")', async () => {
-    const indicators = { rsi: 50, macd: { macd: 1, signal: 0.7, histogram: 0.3 }, macdHistogram: [0.3, 0.2, -0.1, -0.2, -0.3, -0.4], sma50: null };
+describe('D-3 — a cross one bar back reads the date of that bar (research modal W-4)', () => {
+  it('negative → positive one bar before the newest, on Oct 14 → "Bullish cross · Oct 14" (only the newest bar is "latest session")', async () => {
+    const indicators = {
+      rsi: 50, macd: { macd: 1, signal: 0.7, histogram: 0.3 }, macdHistogram: [0.3, 0.2, -0.1, -0.2, -0.3, -0.4], sma50: null,
+      macdHistogramDates: ['2026-10-15', '2026-10-14', '2026-10-13', '2026-10-12', '2026-10-09', '2026-10-08'],
+    };
     await render({ indicators });
     const label = [...container.querySelectorAll('span')].find((s) => s.textContent === 'MACD Signal');
-    expect(label.parentElement.textContent).toBe('MACD Signal Bullish cross · 1d ago');
+    expect(label.parentElement.textContent).toBe('MACD Signal Bullish cross · Oct 14');
   });
 });
```

**How the existing-test changes were proven.** With the build applied and these three files untouched, exactly three rows failed across all 13 affected files (286 rows): "OFF samePriceUpdate", the honesty "2d ago" row, and the display-agreement "1d ago" row. The D-2 modal rows passed unchanged; none needed a retitle (their titles don't name the click detection). No other existing test changed, and the review commits touch none of these files.

## 4. Per item — files, lines, tests, mutation checks

Lines are at `2e74a625`. Each mutation check applied one defect in the working tree, ran the 10–11 affected test files, and restored the file byte for byte (SHA-256 identical before and after).

- **Round 1** (the build): 19 of 19 caught.
- **Round 2** (the review fixes and the gaps the review named): 17 of 17 caught.
- **Round 3** (the two round-1 format mutants, re-run on the changed helper lines): 2 of 2 caught.
- **Round 4** (the row added for the WC9 refuter): 2 of 2 caught.

| Item | Files and lines | Acceptance rows | Mutants (rows failing) |
|---|---|---|---|
| **W-1** | `StockChart.jsx` `:55`, `:944`; modal `AssetResearchModal.jsx` `:180-181` (`srOn`), `:191-196` (reset with the symbol, same render), `:253` (`srRequested: srOn`), `:260-261` (reset when the chart leaves the screen), `:839`, `:855` (`onToggleSR={setSrOn}`); click detection, `srSymbol` and the capture listener removed. Hook `useResearchData.js` `:427-449`: `askDailySeries` plus one effect per trigger, so a trigger turning off never asks | The D-2 modal rows unchanged. New rows: a test-double chart whose pill reads "Levels" still triggers the fetch (`AssetResearchModal.srDouble`). Failed request → S/R off/on → exactly one retry. Failed request → closing the Technical tab → no request (reopening retries). A→B→A, a view switch, and a chart remount after a failed bomb load: none asks with S/R off. Legacy and held re-opens and the back (←) path start with S/R off. The chart reports a flip only on a click, never on mount | prop call removed: **9** (incl. the **4 D-2 modal rows**, as the prompt requires); modal not passing it: 10; one effect for both triggers: 1; S/R trigger ignored: 12; no reset on a symbol change: 2; no reset on unmount: 1; held-view reset skipped: 1; reset only on forward navigation: 2; tab trigger ignores symbol/view changes: 2; an effect reporting the state: 1 |
| **W-2** | modal `:240-245` (`sheetPrice`, `shownAsset`), `:249`, `:269-280` (sided levels memoized on which side each level is on, so a tick that moves no level across redraws nothing; tapped highlight re-sided), `:285-290` (header from `shownAsset`), `:948` (the tab gets `shownAsset`) | The legacy live tick moves the header price, "Current", the distances, the sides and the chart's S/R colours together, with no new quote request. The tapped line follows the live price across a level. A sub-throttle tick redraws no S/R line. A priceless asset, and a stock navigated to before its price arrives, still read "$—". The held view keeps the accepted price against a different `wsPrice`. The re-pinned `samePriceUpdate` | "Current" on the open price: 1; header on the open price: 2; chart sides from the open price: 2; memo ignoring side changes: 2; memo keyed on the live price: 1; the "> 0" guard dropped: 2; `wsPrice` used for a navigated stock: 1 |
| **W-3** | `priceFormat.js` (new): `priceDecimals` `:16-24` (the band from the rounded price; at most 10 decimals), `priceText` `:29-32`. `TechnicalTabV2.jsx` `:24` (one precision per asset, from the shown price), `:116`, `:158`, `:394-395`. `ChartHeader.jsx` `:105`. `StockChart.jsx` `:558`, `:566` | $475.60 → "$475.60"; $0.2049 → "$0.2049"; $0.00001234 → "$0.00001234"; two DOGE levels that both read "$0.20" at two decimals print "$0.2041" and "$0.2001". Range endpoints "$0.1523"/"$0.4871". Header DOGE/SHIB. The chart precision is 4 for DOGE and 8 for SHIB, taken from the latest candle (a coin that fell through $1), with no option for stocks. Bomb and volume series untouched. Held DOGE formatted the same. At $0.999, levels just over $1 keep 4 decimals. 0.99996 → "1.00". The 10-decimal cap | **fixed two decimals: 13 (round 3; the DOGE rows fail)**; six decimals below $0.01: 5; header back to two: 2; no chart format: 2; format on $1+ too: 1; no cap: 1; $1 band from the raw price: 1; $0.01 band from the raw price: 1; each price by its own size: 3; range by its own size: 1; no-price fallback: 1; precision from the oldest candle: 1; bomb series formatted: 1; volume series formatted: 1 |
| **W-4** | `TechnicalTabV2.jsx` `:45-70` (`describeMacd(macd, histogram, dates)`; reuses D-4's `shortDate` `:294`), `:187`, `:199`. Hook `useResearchData.js` `:793-798` (`closingBars`), `:819`, `:822` (`macdHistogramDates`, taken from the same bars whose closes feed the indicators) | The honesty row: cross on Oct 13 → "· Oct 13". The display-agreement row: one bar back → "· Oct 14". The newest bar → "· latest session", even with dates. A bar with no usable close is skipped by both the readings and their dates. Without a YYYY-MM-DD date, just "Bullish cross" | **"{n}d ago" restored: 3 (both named rows + the tab row)**; newest bar dated: 1; dates from the unfiltered bars: 1; any truthy date printed: 1 |
| **W-5** | modal `:191-196` (the tapped level is dropped in the same render as the symbol change, before the new chart mounts) | Tap a level on AAPL, navigate to MSFT → no highlight, and no highlight line ever drawn on MSFT's chart. A tap on MSFT, then back (←) → nothing on AAPL. The legacy and held re-opens on another symbol → nothing drawn | clear removed: 3; clear only on forward navigation or in the held view: 2 |

**New tests:** 3 files, **42 rows**: `AssetResearchModal.wiring.test.jsx` 27, `AssetResearchModal.srDouble.test.jsx` 1, `TechnicalTabV2.wiring.test.jsx` 14.

**Choices the prompt left open:**
- **W-1: failure-path closure by trigger, not by state.** The hook used one effect with both triggers in its dependencies. So any change while either trigger was on — closing the Technical tab with S/R still on, for example — re-ran the fetch after a failure. Each trigger now has its own effect: turning one on asks, turning one off never does. A symbol or view change asks once while a trigger is on, because both effects share the in-flight slot.
- **W-1: S/R state follows the mounted chart.** The chart remounts with S/R off when the symbol changes, and also when a failed request unmounts it (Retry brings a new one). The modal resets its S/R state in both cases. Both resets happen during the render that makes the change (React's "adjust state when a prop changes" pattern), so the new chart never mounts with stale state. Two reviewers checked that there are no warnings and no loops.
- **W-2: what follows the live price.** It covers the surfaces the prompt lists (header price, "Current", sides, distances, chart S/R colours) and the tapped line. Because they read the same price in the tab, "vs 50-Day MA" and "% through range" follow too. The BaggerBomb tab, the Health tab, the bomb chart's baseline and the "Why is it moving?" request keep the asset prop's price; the tab payload and popup body are pinned by the `heldLegacy` OFF reference (§8).
- **W-3: one precision per asset.** The prompt's rule is a function of a price. Applied to each value separately, it made a level row and its own chart line print different decimals whenever the level and the price straddled $1 or $0.01. For example, at $0.999 two levels just over $1 both printed "$1.00" — the DOGE problem again (review WA2/WD4). The asset's shown price now picks the band, as the chart's axis does. The trade-off: a range endpoint far from the price uses the asset's precision (a coin at $1.20 with a 52-week low of $0.0812 prints "$0.08").
- **W-3: the band comes from the rounded price**, so 0.99996 prints "$1.00", not "$1.0000" (BUILD_RULES §9's "round before zoning").
- **W-3: at most 10 decimals.** The chart library mislabels a precision of 11 (every label reads "0.99999999995") and throws past 16. Prices below $0.0000001 therefore show fewer than four significant figures; the cheapest listed coins (PEPE, SHIB, BONK, about $0.00002) use 8 decimals.
- **W-4: the date of the first bar on the new side.** "Latest session" is that bar when it is the newest. The date comes from the hook, beside each reading, from the same bars whose closes the readings use. The bars behind the readings are not always `dailyData[k]`, because a bar with no usable close is skipped.

## 5. Call count — `/api/stocks/historical` requests per modal open (unchanged)

Counted as calls to `fetchHistoricalOHLCV` with a cold browser cache. Two reviewers re-derived the table on the real modal and hook, build against base, with and without React StrictMode (development only; there the main and 5-day fetches run twice in both builds and the lazy daily request stays at 1).

| Scenario | Before (`main`) | After | Pinned by |
|---|---|---|---|
| (1) open on 1D, view the Technical tab | 1 (`1d` 400d) | 1 | `dailySeries` "1D chart + Technical tab"; D-2 modal "1D: S/R adds nothing" |
| (2) open on the bomb view, view the Technical tab | 3 (`30m` 20d, `1d` 5d, `1d` 400d) | 3 | `dailySeries` "bomb view + Technical tab" |
| (3) open on the bomb view, never open the Technical tab | 2 | 2 | `dailySeries` "Technical tab never opened" |
| (4) open on 1W, turn S/R on | 3 (`1w`, `1d` 5d, `1d` 400d) | 3 | D-2 modal "1W: S/R on"; `f3` D-2 rows |
| (4′) then open the Technical tab, or toggle S/R again | +0 | +0 | same rows; "a second S/R click" |
| 1W, neither S/R nor the tab | 2 | 2 | `f3` "neither the toggle nor the tab" |

Only the failure paths changed, as W-1 asks:
- After a failed daily request, S/R off and on retries (one request).
- Closing the Technical tab asks nothing.
- With S/R off, a view switch, A→B→A or a remounted chart asks nothing.
- With S/R still on, entering the bomb view after a failure asks once more. S/R is on there, just hidden; base did the same (review WB2).

## 6. Visible changes (plain terms)

1. **Header, default modal:** the price moves with the live price, as the "% today" next to it already did.
   - An asset handed to the modal with only a `currentPrice` (no `price`) now shows that price in the header and "Current". Before, it read "$—" and "$0.00", while the "% today" was already computed from it.
2. **Technical tab, default modal:** "Current" is that same live price. Each level's distance and its above/below side are measured from it, so a level can change list and colour as the price crosses it.
3. **Chart, S/R on:** the dashed lines change colour as the live price crosses them, and so does a tapped level's solid line.
4. **Held (controlled) view:** nothing moves with the live price; the accepted price is used as before.
5. **Sub-dollar coins:** prices print with 4 decimals ($0.2049), and below $0.01 with four significant figures ($0.00001234). This applies to the header, "Current", the levels and the range. The chart's axis, crosshair label, last-price tag and S/R/tapped line labels use the same precision. Stocks and coins of $1 or more are unchanged.
6. **A coin near $1** prints all its prices at the precision its own price calls for. At $0.999, levels at $1.0004 and $1.0049 are distinguishable.
7. **MACD:** "Bullish cross · latest session" for a cross on the newest bar; "Bullish cross · Oct 13" for an older one.
8. **Moving between stocks:** the tapped level is cleared, and the S/R toggle starts off for each stock — as before, but now reliably, including on the way back.
9. **After a failed level load:** turning S/R off and on tries again.

## 7. Review (BUILD_RULES §2: 13 files)

**How it ran.**
- Four lenses, one reviewer each, on the merged tree `eb9bc516`:
  - **WA:** domain and display correctness (§9).
  - **WB:** wiring, lifecycle and request counts.
  - **WC:** test integrity, ruled bounds and mutation (the mutating lens).
  - **WD:** the StockChart bound, the fence, the controlled path and byte-identity.
- Each lens worked on its own LF `git archive` snapshot in the session scratchpad, read-only on git and on the working tree, with `node_modules` linked.
- Each lens's findings went to a separate refuter, on a separate snapshot, told to refute them with a concrete repro. Every refuter ran code: scratch jsdom rows, base-versus-build runs (`git apply -R` of the build diff), the chart library's own formatter, and two runs in headless Edge.
- Finding ids use their own prefixes (WA/WB/WC/WD), distinct from the prior builds' A/B/C/D/V ids.
- The fixes landed as `2e74a625`, plus one row in `3693e872` for a refuter's wider repro. Mutation rounds 2–4 cover every fix and every gap the review named.

**Outcome: 37 findings.**
- WA 10, WB 5, WC 16, WD 6. WA9's addition is the same defect as WD1.
- Verdicts: **21 CONFIRMED**, **10 PARTLY** (a part refuted or the severity lowered: WA1, WA5, WA7, WA8, WC2, WC3, WC4, WC5, WC10, WD2), **0 fully REFUTED**. The WC refuter did not re-run six info items (WC11–WC16), which were outside its focus.
- Fixed: 3 code findings (WD1 = WA9, WA2 = WD4, WA3) and 11 test gaps (WD2, WD5, WC4–WC11). The rest are pre-existing, outside the fence, info, or founder questions (§8).

| ID | Finding | Verdict | Disposition |
|---|---|---|---|
| WD1 / WA9 | Prices in [1e-8, 1e-7) get chart precision 11, which lightweight-charts 5.1.0 mislabels ("0.99999999995" on every label); precision 17+ throws and blanks the chart. `priceText` threw past 100 decimals | CONFIRMED, medium (latent: no listed asset there). Reproduced in headless Edge with the shipped library | **Fixed**: at most 10 decimals (row; mutant caught) |
| WA2 / WD4 | Each price was formatted by its own size, the chart by one precision per asset. At $0.999 two levels print "$1.00"; a row and its own line could differ in decimals | CONFIRMED, low | **Fixed**: one precision per asset (the shown price's) in the tab (4 rows; 3 mutants caught) |
| WA3 | The band was read from the raw price: 0.99996 → "1.0000" beside "$1.00" rows | CONFIRMED, low | **Fixed**: band from the rounded price (row; 2 mutants caught) |
| WA1 | On a measured-model BaggerBomb position (#972), the header now shows the live price while the BaggerBomb tab's "Now $" shows the committed scoring snapshot | PARTLY → low. Unreachable today: only a server control document naming the owner creates such a battle. "Now" is a committed quote, and the held view already had the same split. Before the build, the header price disagreed with its own "% today" instead | **Founder question** (§8 item 1): relabel "Now" in the BaggerBomb tab (outside this build's fence) |
| WD2 | W-3 changes the held view for sub-dollar coins, unpinned | PARTLY: the facts confirmed; "out of scope" refuted (W-3 names no view; "held view unchanged" is W-2's) | **Fixed** (row) |
| WD5 | The normal-view-only bound and the precision's source were unpinned | CONFIRMED, low | **Fixed** (3 rows; 3 mutants caught) |
| WC4 | The S/R reset in the held view was unpinned | PARTLY: the gap confirmed; medium → low (a held modal never changes symbol while mounted: the screen keys it by position and quote lineage) | **Fixed** (row; mutant caught) |
| WC5 | The back (←) and legacy-re-open paths were unpinned for both resets; the "…and back to AAPL" row could not see a defect on the back path | PARTLY: "vacuous" refuted (that row did fail when the clear was removed outright); the untested paths CONFIRMED, medium | **Fixed**: that row replaced by a tap on MSFT then ←, plus 3 rows (2 mutants caught) |
| WC6 | The Technical-tab trigger's symbol/view-change half was unpinned | CONFIRMED (test gap) | **Fixed** (2 rows; mutant caught) |
| WC7 | Precision from the oldest candle survived | CONFIRMED (test gap; = WD5) | **Fixed** (row) |
| WC8 | The levels memo keyed on the price survived. The code comment overstated what it saves: the throttle releases on a 0.05% move or 3 s, so with ~1 s ticks the chart still redraws its lines about 20 times a minute, from its own rebuild (not new) | CONFIRMED (test gap + comment) | **Fixed**: row; comment corrected |
| WC9 | The "> 0" guard on the shown price was unpinned (a priceless asset would read "$0.00"); the refuter showed it also covers a stock navigated to before its quote arrives | CONFIRMED (test gap, wider reach) | **Fixed** (2 rows; 2 mutants caught) |
| WC10 | Nothing enforced "prop absent → no new effects" (an effect-based version passed everything) | PARTLY: the survivor confirmed; a direct-chart row kills it (the bound itself is verifiable only by reading) | **Fixed**: a row asserts the chart reports only on a click, never on mount (mutant caught) |
| WC11 | Boundary or equivalent survivors (no malformed-date row, etc.) | CONFIRMED (info) | Malformed-date case **added**; the rest are equivalent |
| WC1–WC3 | The re-pin and the W-4 edits are exactly within their rulings | CONFIRMED (info) | — |
| WC2 | Two stale artefacts the bound forbade touching: the samePriceUpdate title; the ON-F2b line | PARTLY: the title is stale; the ON-F2b line already compared a fixture with a literal before the build — what changed is its meaning (legacy and held now agree) | Report (§8 item 9) |
| WC12–WC16 | Caught mutants; no flakiness (4 time zones, no act warnings); Git Bash drops `TZ=Area/City`; the worktree was mid-fix during the review (the coordinator's own edits); pre-existing "Current $0.00" for a priceless asset | info | — |
| WB1 / WD6 | Two pill flips inside one script task (programmatic `.click()` twice) leave the pill off and S/R requested | CONFIRMED (mechanism only) → **info**: in headless Edge, 11 real-input scenarios (double-click, held Enter, Space, taps) all stay in sync under React 19; no production code dispatches to the pill. Base's ordinary off-click left the same state | Report (§8 item 8). The measured fix rewrites the toggle expression — beyond the W-1 bound without a ruling |
| WB2 | Bomb/spectate hide the pill but keep S/R on: after a failure, entering bomb asks once | CONFIRMED, info, pre-existing | Report |
| WB3 | A one-render fail-closed blink in the held view clears the tapped level | CONFIRMED, info, introduced; unreachable in production (the screen unmounts the modal instead) | Accepted: the tab also resets on that blink, and the S/R reset there is a fix |
| WB4, WB5 | A crypto navigation with the tab open asks once before the tab resets; 1W → 1D re-asks 400 days | CONFIRMED, info, pre-existing | Report (§8 item 10) |
| WD3 / WA4 | The OHLC readout stays at two decimals beside a 4-decimal header | CONFIRMED, low; the readout is outside the fence | Report (§8 item 2) |
| WA5 | The "Why is it moving?" request still sends the asset prop's price | PARTLY: the popup never displays a price (only sent to the model) | Report (§8 item 3) |
| WA6, WA7 | The header and "Current" are unthrottled while the live candle is throttled; the header % falls back to the parent's % | CONFIRMED / PARTLY, low; mostly pre-existing | Report (§8 items 4, 5) |
| WA8 | Tab rows (`toFixed`) and the chart's labels (`Math.round`) round half-way prices differently | CONFIRMED (mechanism), low, pre-existing for stocks | Report (§8 item 6) |
| WA10 | A MACD reading the fenced indicator rounded to −0 is not counted as a side change | CONFIRMED, low, pre-existing | Report (§8 item 7) |

## 8. Found on the way — reported, not fixed

1. **Founder question: "Now" on a measured-model position (WA1).**
   - Once the v2 measured thresholds admit a battle, the default modal's header shows the live price. Its BaggerBomb tab says "Now $101.00", which is the committed scoring snapshot, not a live price.
   - Before this build the header showed that snapshot instead, while its own "% today" and the chart's live candle followed the live price.
   - Suggested: relabel the tab's "Now" (for example "At last check"). It is `BaggerBombTab.jsx:82`, outside this build's fence. Today no battle can reach it.
2. **Two-decimal prices left in the chart area (WD3/WA4).** All of these are outside this build's fence or bound:
   - The OHLC readout (`OHLCDisplay.jsx:24`, shared) reads "C 0.20" beside "$0.2049", and "0.00" for sub-cent coins.
   - The bomb and spectate views keep two decimals.
   - So do the BaggerBomb tab's targets and the spectate distance line (`StockChart.jsx:1044`).
3. **"Why is it moving?" (WA5).** The request still sends the asset prop's price, while the header shows the live price. The popup displays no price; the figure only goes into the model's prompt. Separately and pre-existing: the popup's "%" in the default modal is the parent's `percentChange`, not the header's.
4. **Throttle (WA6).** The header, "Current" and the S/R colours follow every tick. The chart's live candle and readout update only after a 0.05% move or 3 seconds. For a moment, a level can be coloured support while the candle's close is still just below it. The prompt's two reference prices (the header %, the live candle) already differed this way.
5. **Header "%" fallback (WA7, pre-existing).** If the daily data fails to load, the header's "%" is the parent's (entry-based in BaggerBomb), now beside a live price.
6. **Half-way rounding (WA8, pre-existing for stocks).** At an exact half-way price the tab's row and the chart's label can differ in the last digit: $45.675 reads "$45.67" in the row and "45.68" on the axis. Sub-dollar coins now have the same property at 4 decimals.
7. **MACD and the fenced rounding (WA10, pre-existing).**
   - `technicalIndicators.js:250` rounds the histogram to 4 decimals. A reading that becomes −0 is not counted as the other side, so a true cross on the newest bar can read "· Oct 14".
   - For SHIB-class coins every reading is 0, so the row always says "On signal line".
   - The fix belongs in the fenced file, or in a decision on how `describeMacd` treats a zero.
8. **Two flips in one script task (WB1/WD6, info).** A scripted double `.click()` can leave the pill off with S/R still requested. Real input cannot. The fix (compute the next value once, then set it and report it) rewrites the toggle expression, which needs a ruling on the StockChart bound.
9. **Stale wording left by the rulings (WC2):**
   - `samePriceUpdate`'s title still says the price change "does not reach the legacy modal".
   - The ON-F2b line's comparison no longer contrasts legacy with held: both read $104.60.
   - `AssetResearchModal.displayAgreement.test.jsx`'s header comment (lines 8–9) still describes the click detection W-1 removed.
   - The bounds forbade touching all three.
10. **Pre-existing request shapes (WB2, WB4, WB5):**
    - Entering bomb with S/R on after a failure asks once more.
    - Navigating to a crypto with the Technical tab open asks once before the tab resets to Health.
    - 1W → 1D re-asks the 400-day request (prior report §8.5).
11. **Stablecoins.** At $0.9998 ↔ $1.0002 the rule itself switches between "$0.9998" and "$1.00" (WD4 sub-point).
12. **The parked list carries over unchanged:**
    - Retry has no symbol guard.
    - The in-flight slot holds one symbol.
    - Identical in-flight requests are not merged.
    - "N% through range" is not clamped.
    - `CHART_1D_DAYS = 180` mirrors the server default by hand.
    - `detectLevels` keeps 4 levels per side from the close.
    - The legacy crypto header uses an ET-keyed previous close.
    - The client cache key omits `from`/`to`.

## 9. Checks

- **Full suite, Linux, CI-shaped.** WSL Ubuntu, Node 20.20.2, `TZ=UTC`, `vitest run --maxWorkers=2`, in a private clone checked out at each head:
  - **`3693e872`** (final code, merged with `main` `1d6d5d4a`; the suite of record, run on a quiet machine): `Test Files  1011 passed | 7 skipped (1018)`, `Tests  21629 passed | 88 skipped (21717)` (= 21,610 at `eb9bc516` + the 19 review rows), exit code **0**. Tested head recorded in the clone: `3693e872e8707e6d9955ab1c68aee93528550c30`.
  - **`2e74a625`**, run while four review agents were running tests on the same machine: 3 failures in 2 files outside this build.
    - `api/_utils/gemmaClient.test.js`: two abort-timing rows.
    - `api/cron/film-tape-backfill.e2e.test.js` "the next candle morning…": 6,050 ms against its 5 s limit.
    - Both files re-run alone at that head: 31/31 pass (the backfill row took 2,788 ms). Neither imports anything this build changed.
  - **`eb9bc516`** (the build merged with `main` `1d6d5d4a`): `Test Files  1011 passed | 7 skipped (1018)`, `Tests  21610 passed | 88 skipped (21698)`, exit code **0**.
- **`npm run lint:gate`** (the CI gate): exit **0** at `d1bb76b5` (Windows), `eb9bc516`, `2e74a625` and `3693e872` (Linux).
- **Full eslint on the touched files, before → after:** identical counts. `StockChart.jsx` 2 errors / 3 warnings; `useResearchData.js` 0 / 4; `AssetResearchModal.jsx` 1 / 4; `ChartHeader.jsx` and `TechnicalTabV2.jsx` 0 / 0. All are pre-existing; the new files are 0 / 0.
- **`vite build`:** exit **0** at `d1bb76b5` (Windows), `eb9bc516`, `2e74a625` and `3693e872` (Linux). The report commit is docs-only; `lint:gate` and `vite build` were re-run on that exact head before the push (result in the PR description).
- **Mutation checks:** round 1, 19/19; round 2, 17/17; round 3, 2/2; round 4, 2/2. Every file was restored byte for byte.
- **On Windows (`TZ=UTC`):** the 17 affected test files pass at `3693e872`, 343 rows. The full Windows suite is not the suite of record (known platform-only failures).
- **The rules suite** (`npm run test:rules`) was not run: no rules, API or server file changed.
