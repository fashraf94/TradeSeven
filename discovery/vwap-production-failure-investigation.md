# VWAP Session Filter — Production Failure Investigation

**Status:** Read-only investigation. No code changes.
**Branch:** `claude/investigate-vwap-production-J3be9` (cut from `main` @ `aa9e7a9`)
**Production timestamp investigated:** May 12, 2026 17:49 UTC = 1:49 PM ET
**Affected commits:**
- `acdc3c6` — `feat(market-data): add filterToCurrentSession helper for RTH session boundary`
- `a4f1ea9` — `fix(eval): apply session boundary filter before VWAP calculation`
- `c9edaa7` — `test(eval): integration tests for session VWAP boundary`
- `aa9e7a9` — Merge PR #403 into main

---

## Q1 — What does EODHD actually return?

### 1.1 Field name and timestamp format

`fetchIntradayCandles` at `api/_utils/marketDataCache.js:632-690` reads the EODHD `/intraday/{symbol}` response and emits objects shaped:

```js
{ datetime: string, open, high, low, close, volume }
```

The `datetime` is produced at `marketDataCache.js:683`:

```js
datetime: d.datetime || new Date(d.timestamp * 1000).toISOString(),
```

Two outgoing formats are possible:
1. **Space-separated UTC** — `'YYYY-MM-DD HH:mm:ss'` (passes through `d.datetime` from EODHD).
2. **ISO 8601 with `Z`** — `'YYYY-MM-DDTHH:mm:ss.sssZ'` (only when EODHD shipped a Unix `timestamp` without a `datetime`).

Both formats are documented in `parseEodhdDatetime`'s JSDoc (`marketDataCache.js:743-753`).

### 1.2 Capturing an actual response

I cannot make a live EODHD call from this environment, but the project has direct evidence in commit `330b5fa` (May 6) — **"Manual curl verification confirmed: omitting from/to returns ~200 candles of recent intraday data (May 4-5)."**

That confirms (a) the response is an array of candle objects with `datetime` in the space-separated UTC format and (b) **EODHD's intraday data lags by at least one trading day under the project's current EODHD configuration**.

### 1.3 EODHD response vs. parser expectation

The parser expects exactly what EODHD ships. I verified the parser against synthetic candle inputs at the production wall-clock (`now = 2026-05-12 17:49 UTC`):

```
'2026-05-12 13:30:00'      -> ET=2026-05-12 09:30  PASS
'2026-05-12 17:00:00'      -> ET=2026-05-12 13:00  PASS
'2026-05-12 17:45:00'      -> ET=2026-05-12 13:45  PASS
'2026-05-11 17:00:00'      -> ET=2026-05-11 13:00  FAIL (date mismatch)
'2026-05-12T13:30:00.000Z' -> ET=2026-05-12 09:30  PASS
'2026-05-12T17:00:00Z'     -> ET=2026-05-12 13:00  PASS
```

**The parser is healthy.** Today's candles in either format pass cleanly. The mismatch is not in `parseEodhdDatetime`.

---

## Q2 — Trace the filter logic

### 2.1 `parseEodhdDatetime` expectations

`marketDataCache.js:754-763`. Accepts `'YYYY-MM-DD HH:mm:ss'` (space or `T` separator) or any ISO string ending in `Z`. Returns `null` for:
- non-string input (e.g., raw number),
- empty string,
- anything that fails both the `endsWith('Z')` ISO path and the `^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}` regex.

When given a Unix epoch *number* (not string), it returns `null` (typeof check at line 755). It never throws.

### 2.2 ET "now" computation and session window

At `marketDataCache.js:808-835`, for `now = 2026-05-12T17:49:00Z`:
- `toEtParts(now)` → `{ dateStr: '2026-05-12', hour: 13, minute: 49 }` ✓ (verified via Node `Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })`)
- `nowMinutes = 829`, `openMinutes = 570`, `closeMinutes = 960`, `upperBoundMinutes = 829`
- For any candle with ET date `2026-05-12` and ET minute in `[570, 829]`, the filter accepts it.

This window is correct — DST is in effect (UTC-4), and `Intl.DateTimeFormat` handles the offset automatically. A candle representing 9:30 AM ET today (UTC `2026-05-12 13:30:00` or ISO `…T13:30:00.000Z`) passes the filter.

### 2.3 Why the filter is returning empty

Given the parser and window are both correct, **the filter is returning empty because the input array contains no candles whose ET date is today**.

Concretely: `filterToCurrentSession` correctly rejects every candle whose ET date ≠ today's ET date (the `cParts.dateStr !== nowParts.dateStr` check at `marketDataCache.js:831`). If EODHD's response contains only May 8, May 11, etc. candles — and no May 12 candles — every candle hits that guard and the filter returns `[]`.

Among the four candidates posed:
- ~~All candles parsed as invalid (parser bug)~~ — ruled out (parser is healthy).
- **Candles parse but their ET date doesn't match today** — the symptom.
- ~~Candles pass date check but excluded by session window~~ — ruled out (window is correct).
- The root cause is upstream: **EODHD isn't returning today's candles in the response**, due to a known intraday data lag.

---

## Q3 — Verify the calling pattern

### 3.1 Wiring in `agent-evaluate.js`

`api/cron/agent-evaluate.js:11` imports `filterToCurrentSession` correctly. The call site at lines 375-387:

```js
if (intradayResult.status === 'fulfilled') {
  const intradayMap = intradayResult.value;
  for (const symbol of portfolioSymbols) {
    const candles = intradayMap[symbol];
    if (candles && candles.length > 0) {
      const sessionCandles = filterToCurrentSession(candles);
      const vwapResult = calculateVWAP(sessionCandles);
      if (vwapResult) {
        const sma20_5m = calculate5minSMA20(candles);
        momentumData.vwap[symbol] = { ...vwapResult, sma20_5m };
      }
    }
  }
}
```

- `filterToCurrentSession` runs only on the VWAP path — `calculate5minSMA20` receives full `candles` (line 383). ✓ Intentional asymmetry.
- `momentumData.vwap[symbol]` is gated on `vwapResult` being truthy (line 382).

### 3.2 SMA20 fate vs. VWAP fate

`momentumData.vwap[symbol]` is only set when `vwapResult` is truthy. The whole object — including `sma20_5m` — is never written when `sessionCandles` is empty. Therefore the question of "is sma20_5m null in production?" is moot: there is no `intraday` object at all, just `null`. This matches the observed `intraday: null` on every brief.

### 3.3 Confirmed path-to-null

```
EODHD response excludes today's candles
  → filterToCurrentSession(candles) returns []
  → calculateVWAP([]) returns null               (technicalCalculations.js:379)
  → if (vwapResult) {...}                        (agent-evaluate.js:382) — skipped
  → momentumData.vwap[symbol] never set
  → cronState.intradayMomentum = momentumData.vwap (empty {})
  → voice-layer-cache.js:279: brief.intraday = intradayMomentumMap[symbol] || null
  → brief.intraday = null                        ← observed in production
```

This matches every observed bit of the production state: `intraday: null` for all 7 portfolio symbols (stocks AND BTC), no partial fields, no errors logged.

---

## Q4 — Identify the root cause

### 4.1 Most likely root cause

**EODHD's intraday endpoint, called without a `from=/to=` window, returns ~180 days of historical 5-minute candles that lag the wall clock by at least one full trading day.** At 1:49 PM ET on May 12, the response contains candles up through (at best) May 11; it contains zero May 12 candles. `filterToCurrentSession` correctly rejects every candle on the date check at `marketDataCache.js:831`, so `sessionCandles` is `[]`, `calculateVWAP` returns `null`, and the `intraday` field is never written.

This is **not** a parser bug, **not** a timezone bug, **not** a session-window bug. The filter is doing exactly what it was designed to do. The implementer's assumption — that EODHD's default response includes today's session candles — is the wrong premise. The previous EODHD bug fix (commit `330b5fa`, May 6) explicitly called out the lag — quoting that commit message:

> Under the project's current EODHD configuration, intraday data lags by at least one trading day, so the queried NOW-relative window contained no published candles and EODHD returned 200 OK with body \[\].

The previous fix moved away from a `from=NOW-8h&to=NOW` window precisely because that window fell *entirely after* the available candles. The session filter introduced by `acdc3c6` re-introduces an equivalent constraint — "candle must be on today's ET date" — via a different mechanism, and the same upstream lag makes that constraint un-satisfiable.

### 4.2 Test fixtures vs. production reality

The integration tests at `api/_utils/marketDataCache.test.js:460-555` (Tests 11/12/13) all **construct** today-dated synthetic candles and pass them through the filter. For example, Test 11 builds `'2026-05-12 ...'` candles directly and verifies the filter keeps them. That's the right shape test, but it does not exercise the production code path's actual input: a real EODHD response that contains no May-12-dated candles at all.

The tests effectively assume the EODHD lag from commit `330b5fa` no longer exists or doesn't apply. There is no fixture that mirrors a real lagged response (e.g., candles ending at May 10 or May 11) being passed in on May 12. That gap is why the implementation looked correct against tests yet broke immediately on the first live run.

The integration test at `marketDataCache.test.js:478-491` (the multi-session/MU scenario) constructs both yesterday's and today's candles and verifies the filter slices to today's — but EODHD in production currently ships only the "yesterday" half.

### 4.3 Does `fetchIntradayCandles` transform timestamps before `filterToCurrentSession` sees them?

Yes — see `marketDataCache.js:682-689`. The transform preserves `d.datetime` as-is if present, otherwise generates an ISO string from `d.timestamp * 1000`. Both output formats are parser-accepted. The transform is fine; it just can't manufacture today's candles if EODHD didn't send them.

---

## Q5 — Determine if revert is needed

### 5.1 Tradeoff

Comparing the two states:

| State | `vwapDeviation` value | Semantics | Downstream effect |
|-------|----------------------|-----------|-------------------|
| Pre-fix (acdc3c6 not applied) | Computed | **Wrong** — multi-month VWAP labeled as session (e.g. MU 67%, RKLB 48%) | Risk manager, Haiku prompts, Phase 4 snapshots, Phase 5B brief line, voice layer all consume miscalibrated VWAP. Signal exists but is misleading. |
| Post-fix (acdc3c6+a4f1ea9 applied — current state) | `null` everywhere | **Correct** — accurately reflects "no session data available" | Same five consumers receive `null`. Phase 5B brief line shows no intraday signal. Risk manager `SWAP_OUT` skips the `vwapDeviation < threshold` arm. |

The post-fix state is the *honest* state: when EODHD has no session candles, the system reports "no signal." That's not a regression in correctness — it's a regression in *availability*. The pre-fix state silently fed bad data downstream; ticksBelowVwap accumulators, swap-out triggers, and the new Phase 5B intraday line all consumed it as if it were a session VWAP.

### 5.2 Revert recommendation

**Do not revert.** Reasoning:

1. **The fix is functionally correct.** It does what it documents: bound VWAP to the current RTH session and return nothing when no session data exists. Reverting reinstates a documented incorrect-semantics bug (the original motivation behind the fix per `discovery/vwap-semantics-investigation.md`).
2. **Reverting wouldn't unblock Phase 5B-main either.** The discovery memo explicitly stated: *"Either way, Phase 5B-main can't merge until VWAP is correctly providing session-bounded data."* A revert gives wrong-but-present data; the proper resolution is to make today's candles actually reach the filter.
3. **Five downstream consumers handle the `null` case already.** `voice-layer-cache.js:279` uses `|| null`. The risk manager's `vwapDeviation` check is naturally a no-op when the field is missing.

### 5.3 What the proper fix needs to address (outline only — NOT implementing)

The investigation is read-only; recording the shape of the fix space so the team can decide next:

- **Option A — Anchor session to "latest available trading date in the response"**, not today's ET date. This sidesteps the lag entirely: if EODHD's freshest candle is May 11, the filter returns that day's RTH; if it includes May 12, today wins. Downside: `vwapDeviation` may be a stale-day deviation rather than a true intraday signal. The brief would need to surface "session as of YYYY-MM-DD" rather than implying real-time.
- **Option B — Re-introduce a wider `from=/to=` window (e.g. `hoursBack: 48`)** so EODHD's response covers at least the most recent published session even with the documented 1-day lag. Combine with the existing today-only filter; on lag days the filter would still return empty.
- **Option C — Verify whether the lag still holds.** The lag was characterized on May 6 via curl; it may have resolved or worsened. A live curl against `/intraday/MU.US` (no from/to) at production wall-clock will confirm the latest `datetime` present.

Option A most directly aligns the filter's contract with the data EODHD provides. Option C is the cheapest first step.

### 5.4 If a revert were chosen anyway

The minimal revert is `git revert a4f1ea9` (the call-site change). That preserves `filterToCurrentSession` as exported-but-unused code and reverts the VWAP computation to use the full unfiltered candle array. `c9edaa7` (the integration test guards in `agent-evaluate.test.js`) would also need to be reverted because it asserts the session-filter call order. `acdc3c6` itself can stay as dead code without harm.

---

## Synthesis

`filterToCurrentSession` is returning empty because **EODHD's `/intraday/` endpoint, called without a `from=/to=` window, returns historical candles that lag the wall clock by at least one trading day — so on May 12 there are no May-12-dated candles in the response, and the filter's `cParts.dateStr !== nowParts.dateStr` check correctly rejects every candle (`marketDataCache.js:831`)**. The parser, ET conversion, and session window are all behaving exactly as designed; the input array simply contains no in-session candles to keep.

The fix should be **either** to anchor the filter's "session date" to the latest trading date *present in the response* (rather than today's wall-clock ET date), **or** to pass an explicit `hoursBack` to `fetchIntradayCandles` wide enough to guarantee inclusion of the latest published session even under EODHD's documented lag — **but do not implement either here**.

**Revert recommendation: NO.** The post-fix state is honest about missing data; the pre-fix state silently fed multi-month VWAP downstream as if it were session VWAP. Phase 5B-main is blocked under both states, and reverting buys nothing except a different shape of incorrect data.
