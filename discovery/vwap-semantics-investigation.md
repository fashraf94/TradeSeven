# VWAP Semantics Investigation

**Scope:** Read-only. Trace the VWAP calculation pipeline and identify the
actual time window. Cut from main (this branch:
`claude/vwap-semantics-investigation`).

**Trigger:** Production `voiceLayerCache` data shows VWAP deviations of
16-67% — implausible for session VWAP. Phase 5B-main is queued to render
this as "session VWAP" in Gemma's prompt.

**Production samples (provided):**
| Symbol | currentPrice | vwap | vwapDeviation |
|---|---|---|---|
| MU | 795.33 | 476.21 | 67.01% |
| ALB | 209.99 | 180.66 | 16.23% |
| RKLB | 117.35 | 79.17 | 48.22% |
| GOOGL | 388.64 | 326.68 | 18.97% |

---

## Q1 — What does fetchIntradayCandles actually return?

### 1.1 — URL construction when called without `hoursBack`

`marketDataCache.js:632-644`:

```js
let url = `${API_BASE}/intraday/${eohdSymbol}?api_token=${apiKey}&fmt=json&interval=${interval}`;
if (hoursBack) {
  const fromTs = Math.floor((Date.now() - hoursBack * 60 * 60 * 1000) / 1000);
  const toTs = Math.floor(Date.now() / 1000);
  url += `&from=${fromTs}&to=${toTs}`;
}
```

When the agent-evaluate cron calls `fetchIntradayBatch(portfolioSymbols, { interval: '5m' })` (agent-evaluate.js:356), `hoursBack` is `undefined`. The URL sent to EODHD is:

```
https://eodhd.com/api/intraday/MU.US?api_token=...&fmt=json&interval=5m
```

**No `from`, no `to`, no session filter.** This is by design — see §1.2.

### 1.2 — Why the default omits from/to (historical context)

Commit `330b5fa` (May 6, 2026, 6 days before today) explicitly removed the
default `from/to` parameters. Commit message:

> Root cause: fetchIntradayCandles always sent from=NOW-8h&to=NOW Unix
> timestamps to EODHD's /intraday/ endpoint. Under the project's current
> EODHD configuration, intraday data lags by at least one trading day,
> so the queried NOW-relative window contained no published candles and
> EODHD returned 200 OK with body [].
>
> Manual curl verification confirmed: omitting from/to returns **~200
> candles of recent intraday data (May 4-5)**. The fix is to make the
> date-range filter opt-in rather than always-applied.

So the prior bug was the *opposite* problem (no data). The fix landed
6 days ago. The verifier counted ~200 candles spanning ~2 dates at the
time of the fix.

### 1.3 — How wide is EODHD's "natural window" today?

**No direct empirical evidence is available from this discovery environment.** No Firestore access, no log archive, no live EODHD call. We can only infer from the production VWAP values.

EODHD's documented behavior for the `/intraday/` endpoint at 5-minute
interval is to return up to **120 days of history** when called without
explicit `from`/`to`, with the actual response governed by the plan's
historical-data window. At 5-minute interval over a typical US trading
day (~78 RTH candles, ~192 extended-hours candles), 120 days could be
9,000-23,000 candles per symbol.

**Inferred window from production VWAP values (see Q3 for math):** the
returned candles span weeks to months, not "May 4-5" as the May 6 commit
message suggested. Either:

- (a) The May 6 spot-check undercounted (visible top-of-array dates
  ≠ full response range — EODHD-style responses can be long), or
- (b) EODHD's response width has grown since May 6 as more data has
  accumulated, or
- (c) EODHD changed the default behavior of this endpoint in the past
  6 days.

(a) is the most likely. The commit message says "~200 candles" — a count, not a date span — and the author appears to have inferred the date range from the most recent visible entries. The first entry in the array was probably from a date prior to May 4 but not closely inspected.

**What we can say with certainty:** the natural window currently being
returned by EODHD for portfolio symbols is wide enough to produce 16-67%
deviations between session-end price and the volume-weighted average of
the response. That cannot be a single session.

---

## Q2 — What does calculateVWAP do with the returned candles?

### 2.1 — No session reset

`technicalCalculations.js:378-410`:

```js
export function calculateVWAP(intradayCandles) {
  if (!intradayCandles || intradayCandles.length === 0) return null;
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  for (const candle of intradayCandles) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    const vol = candle.volume || 0;
    cumulativeTPV += typicalPrice * vol;
    cumulativeVolume += vol;
  }
  // ...
  const vwap = cumulativeTPV / cumulativeVolume;
  // ...
}
```

The function iterates **every candle in the input array** and computes
a single cumulative `TPV / volume`. There is no:
- Date-of-candle check
- Session-boundary reset
- "Reset at 9:30 ET" logic
- "Drop yesterday's candles" filter

It is mathematically a correct **window VWAP** over whatever candles it
receives. The function does its job. The caller is responsible for
bounding the window. The caller doesn't.

### 2.2 — Consequence: VWAP is whatever-window-EODHD-returns

Because `fetchIntradayCandles` returns multi-day data and `calculateVWAP`
has no session reset, the value labeled `vwap` is:

> **A multi-day, possibly multi-month, cumulative volume-weighted average
> price over the entire EODHD intraday response window.**

The variable name `vwap` and the cron-state key `intradayMomentum` are
both misleading. The data is a long-window anchor, not session VWAP.

### 2.3 — Original intent

The JSDoc at `technicalCalculations.js:372-376` doesn't claim "session"
explicitly:

> Calculate VWAP from intraday OHLCV candles.
> vwapDeviation is % above (+) or below (-) VWAP

But the Haiku prompt at `agentEvalPromptAssembly.js:96-97` is explicit:

> VWAP DEVIATION: Price above VWAP = **intraday** bullish momentum. Price
> below VWAP = **intraday** bearish momentum. Deviation >1.5% is significant.

And the risk manager comment at `agentRiskManager.js:25` calls it the
"intraday snapshot." And Phase 5B-main's `DATA_CONFIDENCE_RULE` calls it
"session VWAP." Every downstream consumer reads it as session.

**Original intent: session VWAP.** Actual implementation: window VWAP
over whatever EODHD returns. The intent and implementation diverged
silently at commit `330b5fa` six days ago, when the `from/to` window
was removed to fix the empty-response bug. That fix solved one bug
(empty data) by introducing another (wrong-window data).

---

## Q3 — Cross-check with realistic expectations

### 3.1 — MU: 67% deviation cannot be session

For MU at $795.33 with VWAP $476.21:
- Single-session VWAP for a stock at $795 would typically be within
  ±0.5% to ±5% of price.
- 67% deviation means the VWAP includes substantial volume executed at
  prices well below current.
- VWAP $476 ≈ 60% of current price. For the volume-weighted average
  to land that low, the response must include candles from periods
  when MU traded around or below $400.

### 3.2 — Ratio analysis across all four samples

| Symbol | curr/vwap ratio | Deviation | Suggested window |
|---|---|---|---|
| MU | 1.67 | 67.01% | Multi-month — significant volume at ≤50% of current price |
| RKLB | 1.48 | 48.22% | Multi-month — high-growth name, long climb |
| GOOGL | 1.19 | 18.97% | Multi-week to month — gradual gains |
| ALB | 1.16 | 16.23% | Multi-week to month — moderate gains |

The ratio spread (1.16–1.67) is consistent with a uniform fetch window
encountering different intrinsic price trajectories — high-momentum
stocks (MU, RKLB) show bigger ratios because they appreciated more
over the window; slower names (ALB, GOOGL) show smaller ratios because
they appreciated less. The window length itself is roughly constant
across symbols; the deviation tells you the **stock's drift**, not the
**window's width**.

### 3.3 — Estimating the window length

The smallest-deviation sample (ALB, 16.23%) gives a lower bound on the
window: ALB needs to have moved 16% over the window. Looking at where
the largest-deviation sample (MU, 67%) requires — substantial volume
at <60% of current — the window has to be at least several weeks
and likely months.

**Best guess:** EODHD is returning roughly the maximum 120-day window
documented for 5-minute candles, or whatever the plan-level history
window is. Without empirical observation we can't pin it more precisely,
but the order of magnitude is **weeks-to-months**, not session.

We also have indirect evidence from `buildTechnicalSnapshot.test.js:129-134`:

```js
expect(snap.intraday).toEqual({
  vwap: 433.57,
  currentPrice: 640.20,
  vwapDeviation: 47.66,
  sma20_5m: 641.22,
});
```

A 47.66% deviation. The test author chose these numbers, presumably to
match real production observation — meaning this multi-day-VWAP
behavior was already in the data when the snapshot writer landed, but
no one flagged it as bug-shaped. That test currently *locks in the bug*.

---

## Q4 — Where else is this VWAP used?

### 4.1 — Consumers of `cronState.intradayMomentum`

Five reader paths beyond Phase 5B-main:

1. **`agentRiskManager.evaluateRisk`** (`agentRiskManager.js:30-86`)
   - Reads `intradaySnapshot.vwap` (rendered in SWAP_OUT detail message)
   - Reads `intradaySnapshot.sma20_5m` (TRAIL_STOP trigger — unaffected by VWAP issue; SMA is its own field computed from the last 20 candles only)
   - Cron memory `ticksBelowVwap` (counter, see #2)

2. **`agent-evaluate.js:553-590` — `vwapTicks` counter & SWAP_OUT gate**
   - Increments `vwapTicks[symbol]` each cycle when `vwapInfo.vwapDeviation < 0`.
   - Resets to 0 when deviation ≥ 0.
   - When `ticksBelowVwap >= 2` (default), `evaluateRisk` returns `SWAP_OUT` with reason `vwap_failure`, framed as "below VWAP for N consecutive ticks. Institutional support lost."
   - **Under the bug:** "below VWAP" actually means "below the multi-week/month volume-weighted average" — a stock in a longer-term downtrend, not one losing intraday institutional support. Calibration is broken.

3. **Haiku trade-decision prompt** (`agentEvalPromptAssembly.js:96-97, 1226-1228`)
   - Live context block renders `"VWAP: $145.50 (+0.7%)"` per symbol
   - Prompt rule tells Haiku: "Price above VWAP = intraday bullish momentum. Deviation >1.5% is significant."
   - **Under the bug:** Haiku sees `"VWAP: $476.21 (+67.01%)"` for MU and is instructed to interpret as "extreme intraday bullish momentum." It's actually long-term trend.

4. **Phase 4 technical-context snapshots** (`buildTechnicalSnapshot.js:99-104`)
   - Writes `snapshot.intraday.{vwap, currentPrice, vwapDeviation, sma20_5m}` verbatim to `proposalHistory[i].snapshot` and `trades[i].snapshot`.
   - **Under the bug:** every snapshot stored from Phase 4 onward has been recording multi-day VWAP. Review-mode rendering (Phase 5C) will surface these to Gemma as "what the market looked like at trade time" — but it's the wrong "market."

5. **Phase 5B-main voice-layer briefs** (`voice-layer-cache.js:279`, this PR's `buildIntradayLine`)
   - Sets `brief.intraday` and renders "0.7% above session VWAP" prose to Gemma.
   - **Under the bug:** the prose label is wrong AND the deviation magnitude is wrong. Both the framing ("session VWAP") and the implied range (~5% normal) are violated.

### 4.2 — Per-consumer impact assessment

| Consumer | Current behavior | Under the bug | Severity |
|---|---|---|---|
| Risk manager `vwap_failure` SWAP_OUT | 2 consecutive cycles below "session VWAP" triggers swap-out | 2 consecutive cycles below multi-week VWAP triggers swap-out — i.e., any longer-term downtrend gets swapped, not a session-level institutional-support breakdown | **High** — silently swapping out positions for the wrong reason |
| Haiku trade prompts | Treats VWAP deviation as intraday signal, "1.5% significant" | Sees 16-67% deviations, treats as extreme intraday momentum, reasoning falls apart | **High** — Haiku decisions miscalibrated to wrong signal magnitude |
| Phase 4 snapshots | Stores "intraday context at trade time" | Stores wrong context; baked into the historical record | **Medium** — affects future Review-mode rendering only |
| Phase 5B-main Voice Layer | Prose-renders to Gemma as "session VWAP" | Tells Gemma the wrong thing in two ways at once | **High** — about to ship in 5B-main |
| 5m SMA20 (separate field) | Last-20-candle SMA, trail-stop trigger | **Unaffected** — sma20_5m only looks at the last 20 candles (~100 minutes), so it IS a session-ish signal even with the bigger response | **None** |

### 4.3 — Risk summary

Three production-active systems are reading the wrong VWAP and reasoning
about session positioning with multi-day data:

- The risk manager swaps positions out on "VWAP failure" using a multi-day metric
- Haiku reasons about "intraday momentum" using a multi-day metric
- Phase 5B-main (queued to merge) will tell Gemma "session VWAP" using a multi-day metric

Only `sma20_5m` is reliable as a true intraday signal — because the
`calculate5minSMA20` helper takes the last 20 candles by index, not by
date, and 20 × 5min = 100 minutes is short enough to be within-session.

---

## Q5 — Resolution options

### 5.1 — Option A: Filter candles to current trading session

**Approach:** Between `fetchIntradayBatch` and `calculateVWAP` in
agent-evaluate, filter the candle array to those matching today's US
Eastern trading session.

**Pros:**
- Matches the original intent (session VWAP)
- All downstream consumers stay correct without further changes
- Risk manager calibration (1.5%, 2-tick threshold) regains its intended meaning
- Phase 5B-main's "session VWAP" wording becomes accurate

**Cons:**
- Need session-boundary detection (DST, weekends, holidays, pre-market inclusion choice)
- Edge case: at market open before any 5m candle has closed, the filtered array could be empty → null intraday, line suppressed. Acceptable.
- Need to validate today's date in US Eastern timezone, not UTC
- Re-tests the original empty-response problem: if EODHD's feed delay extends past session start, we re-enter the bug commit `330b5fa` fixed. But unlike the prior fix's NOW-relative window, filtering AFTER EODHD returns ample data means we always have candles available; only the most-recent session might be partially populated.

**Cost:** moderate (~30-50 lines in agent-evaluate; new tests covering session-boundary logic)

### 5.2 — Option B: Acknowledge it's a long-window VWAP, rename and re-document

**Approach:** Stop calling it session VWAP. Rename `vwap` →
`anchorVwap` or `windowVwap` throughout. Update Haiku prompt,
DATA_CONFIDENCE_RULE, brief line, snapshot field name.

**Pros:**
- No calculation change, no fetcher change
- Lower risk of regression
- Long-window VWAP is a legitimate signal (a regime/trend indicator);
  just needs honest framing

**Cons:**
- Risk manager's `ticksBelowVwap` SWAP_OUT logic is calibrated for
  session VWAP. Renaming doesn't fix the calibration — a stock 3% below
  multi-month VWAP is NOT the same signal as 3% below session VWAP.
  Renaming alone leaves the risk manager broken; it'd need recalibration
  too (or removal).
- Haiku's "Deviation >1.5% is significant" threshold becomes meaningless
  when typical deviations are 16-67%.
- Phase 4 snapshots already written would still be mislabeled in any
  records that referenced the old name as session.

**Cost:** Low *for the rename*; **high** for the calibration follow-up
work, which would need separate analysis of each consumer's threshold.

### 5.3 — Option C: Bound the calculation to a defined window

**Approach:** Pass `hoursBack: 24` (or `48`) to `fetchIntradayCandles`
to bound to recent session(s). Returns to a NOW-relative window — the
exact pattern commit `330b5fa` removed because of feed delays.

**Pros:**
- Smaller code change than Option A
- Bounded window has predictable semantics

**Cons:**
- **Re-introduces the empty-response bug** that `330b5fa` solved.
- With a 24-hour window during pre-market on Monday, the window covers
  Saturday-Sunday (closed market) → empty data → null intraday
- With feed delay extending into the requested window, partial or empty
  responses re-emerge
- Doesn't cleanly enforce session boundaries (a 24-hour window starting
  at midnight ET catches 0 minutes of today's session at market open
  and 6.5 hours by close — variable scope)

**Cost:** moderate; **risk:** high (regression into a known bug)

### 5.4 — Recommended resolution path

**Recommend Option A.** Filter candles to today's US Eastern trading
session inside agent-evaluate before calling calculateVWAP. Reasoning:

1. **Restores original intent and calibration** for all downstream
   consumers without further changes. Risk manager, Haiku prompt,
   Phase 5B-main, and Phase 4 snapshots all read the field as session;
   feeding them session data makes them correct.
2. **Sidesteps the empty-response regression.** Because EODHD's natural
   window is wide, we always receive plenty of candles; we just discard
   the older ones. No NOW-relative empty window risk.
3. **Centralized fix at the data layer.** One change in agent-evaluate
   (or a session-filter helper) fixes every consumer.
4. **Phase 4 snapshots get corrected going forward** (existing snapshots
   stay mis-recorded; we'd note that as "Phase 4 review-mode renders may
   include historical mislabeled intraday data from before this fix").
5. **Option B's rename doesn't fix the calibration problem** — every
   consumer would need separate threshold rework. That's strictly more
   work than fixing the underlying calculation.
6. **Option C reintroduces a known bug.**

Open implementation question for Option A: pre-market candles
included or not? US session is typically defined as 9:30-16:00 ET, but
some traders count pre-market (4:00-9:30 ET) and after-hours
(16:00-20:00 ET). Recommend RTH-only (9:30-16:00 ET) for canonical
session VWAP — discuss before implementation.

---

## Q6 — Impact on Phase 5B-main

### 6.1 — Merge gate decision

**Recommend: BLOCK Phase 5B-main merge until VWAP semantics are
resolved.**

Reasoning:

- Merging as-is ships a `DATA_CONFIDENCE_RULE` clause that explicitly
  calls the field "session VWAP." Under the bug, this is a factual
  misrepresentation in Gemma's instruction set.
- Merging with a magnitude safeguard (e.g., `|vwapDeviation| < 5%` →
  suppress line) works mechanically — most of the time the line just
  won't render, since most production data has 16-67% deviations. But
  the safeguard hides the bug rather than fixing it, and on the
  *occasional* low-deviation symbol (e.g., a stock that hasn't moved
  much), the line WOULD render — still labeled "session VWAP" — and
  Gemma would receive correct-looking-but-not-actually-session prose.
- The cleanest path: fix the calculation (Option A), then unblock 5B-main
  and merge as-is. The wording in 5B-main becomes correct retroactively
  when the underlying data becomes correct.

### 6.2 — Why the safeguard option is not enough

A predicate gate like `if (Math.abs(intraday.vwapDeviation) > 5) return null` would:

- Suppress the line for the four observed symbols (16-67% deviations)
- Allow the line for any symbol with smaller deviation
- But for those symbols, the line would still claim "session VWAP" while
  rendering a multi-day deviation that *happens* to be small
- Worse: this would teach Gemma that "session VWAP deviations are always
  small" — when actually the data isn't session VWAP at all

The safeguard saves face (no obviously-bogus 67% line), but the
underlying contract (this is session VWAP) remains violated for every
symbol that does render.

### 6.3 — Phase 5B-main code quality is independent of this issue

To be clear: the Phase 5B-main implementation itself (helper, wiring,
rule clause) is correct as designed. The renderer correctly formats
whatever `brief.intraday` contains, and `brief.intraday` is correctly
populated from `cronState.intradayMomentum`. The bug is **upstream** in
the calculation pipeline.

The implementation can sit on the branch awaiting unblock. No 5B-main
code needs changing. Only the wording in `DATA_CONFIDENCE_RULE`'s
intraday clause might need a one-word edit IF the resolution lands as
Option B (rename), but Option A leaves 5B-main correct as-is.

### 6.4 — Suggested sequencing

1. Spike Option A: implement session-boundary candle filter in
   agent-evaluate. ~1-2 commits. New tests for session detection.
2. Verify in production: confirm VWAP deviations drop to single-digit
   percentages for stocks within session.
3. Confirm risk manager `vwap_failure` SWAP_OUT events stop firing
   inappropriately (this may have been silently churning portfolios for
   the past 6 days since `330b5fa`).
4. Unblock and merge Phase 5B-main.

---

## Synthesis

The VWAP currently being computed is **a multi-day to multi-month
window VWAP** — likely the maximum 120-day intraday history EODHD
returns by default — **not session VWAP.**

**Root cause:** Two-layer issue introduced incrementally.
1. Commit `330b5fa` (May 6, 2026) removed `fetchIntradayCandles`'s
   default `from/to` window to fix an empty-response bug. EODHD's
   "natural window" turned out to be much wider than the commit
   message implied.
2. `calculateVWAP` (`technicalCalculations.js:378-410`) iterates **every**
   candle in the input array with no session-boundary detection. It
   correctly computes the VWAP of whatever window it receives — and
   the window it receives is multi-day.

**Recommended resolution: Option A** — add a session-boundary candle
filter in `agent-evaluate.js` between `fetchIntradayBatch` and
`calculateVWAP`. Filter to today's US Eastern RTH (9:30-16:00 ET, or
the chosen pre-market policy). This:
- Restores session VWAP semantics for all five consumer paths
- Avoids the empty-response regression that Option C would reintroduce
- Avoids the calibration cascade that Option B's rename would require

**Phase 5B-main impact: BLOCK merge** until the underlying VWAP
calculation is corrected. The Phase 5B-main code itself is correct as
designed (helper, wiring, rule clause) and needs no changes — but
merging it now ships a `DATA_CONFIDENCE_RULE` claim that mislabels
multi-day data as "session VWAP" to Gemma. Fix the upstream calculation
first, then 5B-main can ship as-is.

---

## Open design questions

1. **Pre-market inclusion in the session filter.** Should the session
   boundary be RTH (9:30-16:00 ET) or include pre-market (4:00 ET) and
   after-hours (until 20:00 ET)? Strict RTH is the canonical session
   VWAP definition; including extended hours captures more institutional
   activity but is non-standard. Recommend RTH; explicit decision
   needed before implementation.

2. **Snapshot backfill or accept history loss?** Phase 4 snapshots
   already stored (`proposalHistory[i].snapshot.intraday.vwap` and
   `trades[i].snapshot.intraday.vwap`) contain the multi-day-mislabeled
   data. Options: (a) leave as-is and document, (b) wipe the
   `snapshot.intraday` field on existing records, (c) backfill by
   re-fetching historical candles and recomputing per snapshot date.
   Recommend (a) — note in Phase 5C discovery that pre-fix snapshots
   should be treated as "intraday data uncertain" if rendered.

3. **Risk manager calibration validation post-fix.** The `vwapTicks`
   threshold (2 consecutive ticks below VWAP triggers SWAP_OUT) was
   designed for session VWAP. Once Option A lands, validate that the
   threshold still triggers appropriately — the new (correct) signal
   may need tuning. Capture as a follow-up after Option A merges.

4. **Haiku prompt's "Deviation >1.5% is significant" threshold.** Same
   question — recalibrate if needed once Option A lands. Likely correct
   for true session VWAP; was meaningless under the bug.

5. **Test fixture in `buildTechnicalSnapshot.test.js:129-134`** locks
   in a 47.66% deviation as the expected shape. Once Option A lands,
   that fixture should be updated to use session-realistic values
   (single-digit percentage). Capture in the Option A implementation
   prompt.
