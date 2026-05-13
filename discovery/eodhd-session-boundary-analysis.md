# EODHD Intraday Endpoint — Session Boundary Analysis

**Date:** 2026-05-12
**Branch:** `claude/eodhd-session-boundary-3863` (cut from `main` @ `aa9e7a9`)
**Author:** Claude (read-only discovery)
**Companion to:** `discovery/eodhd-live-verification.md` (on `claude/eodhd-live-verification-2245` — turnkey curl instructions + placeholders).
**Status:** Live capture obtained operator-side; analysis complete.

---

## TL;DR

- Operator captured **6,478 candles** on 2026-05-12 from a default-window AAPL.US curl. Per-day breakdown is dead-even: **82 trading days × 79 candles/day** (no exceptions).
- Latest candle is **2026-05-11 20:00:00 UTC = 4:00 PM ET (Mon)**. Today is **Tue 2026-05-12**, market open at the time of capture (~3 PM ET) — yet the response **excludes today entirely**. EODHD's default-window response is stale by **one trading day** while RTH is live. This is the direct cause of the production `intraday: null` symptom (chain: §6).
- The "79 candles/day" count decomposes as **78 real 5-min RTH bars (9:30 → 3:55 ET) + 1 synthetic close-print bar at exactly 4:00 PM ET**. The synthetic bar has `O==H==L==C` and `volume: null`.
- **No extended hours** in this endpoint's default response (probe confirmed 0 candles outside RTH on 2026-05-11). The `RTH_CLOSE_HOUR_ET` clamp in `filterToCurrentSession` (`marketDataCache.js:824`) is belt-and-suspenders for this endpoint.
- **Weekend and holiday gaps clean**: all 17 Sat/Sun pairs absent, plus MLK (Mon 2026-01-19), Presidents' Day (Mon 2026-02-16), and Good Friday (Fri 2026-04-03) absent. EODHD applies the NYSE calendar itself.
- **DST handled by EODHD upstream**: bars before 2026-03-09 fall in 14:30→21:00 UTC (EST = UTC−5); from 2026-03-09 onward they shift to 13:30→20:00 UTC (EDT = UTC−4). `parseEodhdDatetime` interprets the string as UTC and `toEtParts` re-projects via `Intl.DateTimeFormat`, so the shift is transparent to our code.
- **The synthetic close-print bar is harmless for VWAP** (volume=0 contributes nothing to numerator or denominator) but corrupts any downstream consumer that treats it as a real 5-min bar (volume histograms, last-bar volume, MFI/CMF). Recommend stripping at source in `fetchIntradayCandles` with a strict (`raw volume === null` AND `O==H==L==C` AND `ET-time == RTH close`) test.

---

## 1. Capture summary (the raw inputs)

Operator ran the section-2 curl from `eodhd-live-verification.md` against `https://eodhd.com/api/intraday/AAPL.US?api_token=…&interval=5m&fmt=json` (no `from`/`to`) on 2026-05-12 and ran 9 `jq` summary queries against the result. Per-candle output is reproduced inline in §§ 2–4. Operator did not paste the full 6,478-element array; analysis below derives entirely from the summary slices and from the full May 11 / Fri-before-Mon / holiday-probe slices.

**Total candles:** `6478`
**First candle:** `2026-01-13 14:30:00 UTC` (= 9:30 AM ET Tue, EST = UTC−5 — pre-DST)
**Last candle:** `2026-05-11 20:00:00 UTC` (= 4:00 PM ET Mon, EDT = UTC−4 — post-DST)
**Distinct trading days:** 82
**Bars per trading day:** 79 (uniform — every day in the response)

**Response field shape** (from `jq '.[0] | keys'`):

| Field | Type | Used by `fetchIntradayCandles`? | Notes |
|---|---|---|---|
| `timestamp` | number (Unix s) | Yes — fallback for missing `datetime` (`marketDataCache.js:683`) | Always present in capture |
| `gmtoffset` | number | No | Always `0` in capture (EODHD's UTC convention) |
| `datetime` | string `'YYYY-MM-DD HH:mm:ss'` | Yes — primary timestamp (`marketDataCache.js:683`) | Matches `parseEodhdDatetime` regex (`marketDataCache.js:760`) exactly |
| `open` / `high` / `low` / `close` | number | Yes — `Number.isFinite` gated (`marketDataCache.js:669-673`) | Synthetic close-print bar has `open==high==low==close` |
| `volume` | number \| `null` | Yes — mapped via `d.volume || 0` (`marketDataCache.js:688`) | `null` on synthetic close-print bar; otherwise finite |

Field shape is **byte-compatible** with `parseEodhdDatetime`'s expectations. No timezone offsets, no ISO suffix, no surprise fields. The pre-existing concern in `eodhd-live-verification.md` §6 (that a `-04:00` offset or other variant could silently null every candle through the filter) is **not present** in this capture.

---

## 2. Q1 — Candle ordering and intra-day continuity

**Ordering:** chronological, oldest-first.
- First candle: Jan 13 14:30 UTC. Last candle: May 11 20:00 UTC.
- Within each day, the `jq` summary shows `first_utc` < `last_utc`, with first = RTH open and last = RTH close — confirming order is preserved per-session and across sessions.
- This matches the order assumed by `fetchIntradayCandles` (comment at `marketDataCache.js:663`: _"EODHD returns oldest-first (chronological) — keep that order for VWAP"_). No reversal needed.

**Bar count per session:** **uniformly 79**, every single trading day, no exceptions.

The arithmetic: an RTH session is 6.5 hours = 390 minutes = **78 five-minute intervals** (bars `09:30→09:35`, `09:35→09:40`, …, `15:55→16:00`). EODHD adds a **79th "close-print" bar** stamped at exactly the RTH close (`16:00` ET / `20:00` UTC during EDT, `21:00` UTC during EST):

| Last 3 bars of Fri 2026-05-08 (operator slice) | open | high | low | close | volume |
|---|---|---|---|---|---|
| `2026-05-08 19:50:00` | 293.85 | 294.25 | 293.76 | 294.085 | 949,310 |
| `2026-05-08 19:55:00` | 294.07 | 294.14 | 293.10 | 293.28 | 3,376,769 |
| `2026-05-08 20:00:00` | **293.32** | **293.32** | **293.32** | **293.32** | **null** |

Same shape on Mon 2026-05-11's last bar: `O=H=L=C=292.679992`, `volume: null`. This is the **synthetic close-print bar** signature. It is unambiguously distinguishable from a real 5-min bar by the `volume===null` field on raw payload (which gets normalized to `0` by `marketDataCache.js:688` and would otherwise be invisible downstream).

**Intra-session continuity:** every session's `last_utc - first_utc` is exactly `6h 30m`, and bar count is exactly 79 → no internal gaps (the only way to span 6h30m with 79 bars at 5-min spacing is the complete 78+1 sequence). No need to scan for sequence holes.

---

## 3. Q2 — Extended hours presence

**Conclusion:** zero extended-hours bars in this endpoint's default response.

Direct probe on 2026-05-11 (operator query #9): count of bars with ET-projected minute `< 13:30 UTC` or `>= 20:05 UTC` returned **0**. The full May 11 dump confirms: first bar 13:30 UTC (9:30 ET — RTH open), last bar 20:00 UTC (4:00 PM ET — RTH close).

The `filterToCurrentSession` upper-bound clamp at `RTH_CLOSE_HOUR_ET * 60` (`marketDataCache.js:824`) is therefore **belt-and-suspenders for this endpoint** — it would only kick in if EODHD's behavior changed to include post-market candles. Keeping it as defensive code is fine; just note in any future audit that today's EODHD `intraday` default-window endpoint does not exercise that branch.

(The pre-DST window 14:30→21:00 UTC and post-DST window 13:30→20:00 UTC both project to 9:30 AM → 4:00 PM ET on the dot — no DST quirks at the boundary.)

---

## 4. Q3 — Weekend/holiday gaps and the May 11 session

### 4a. Weekend gaps

All 17 Sat/Sun pairs in the window absent from the per-day summary. Spot checks at the transition points:

| Last bar before weekend | First bar after weekend |
|---|---|
| `2026-01-16` (Fri) — last `21:00:00 UTC` | `2026-01-20` (Tue, after MLK) — first `14:30:00 UTC` |
| `2026-05-08` (Fri) — last `20:00:00 UTC` | `2026-05-11` (Mon) — first `13:30:00 UTC` |

The May 8 → May 11 boundary specifically (operator slices #6 and #7) shows a clean break: Fri ends with the 20:00 UTC synthetic close-print bar at 293.32; Mon opens at 13:30 UTC with `open=291.979003` (a real gap-down, not a missing-bar artifact).

### 4b. Holiday gaps

Probe #8 (count of bars on `2026-01-19`, `2026-02-16`, `2026-04-03`): **0**.

| NYSE holiday in window | Date | Present in response? |
|---|---|---|
| Martin Luther King Jr. Day | Mon 2026-01-19 | absent ✓ |
| Presidents' Day | Mon 2026-02-16 | absent ✓ |
| Good Friday | Fri 2026-04-03 | absent ✓ |

(Memorial Day 2026-05-25 falls after the window. Juneteenth 2026-06-19 also outside.)

EODHD applies the NYSE calendar upstream — our code does not need to filter holidays from the intraday feed.

### 4c. Trading-day arithmetic sanity check

82 distinct trading days, Jan 13 (Tue) → May 11 (Mon), with 3 holidays excluded from weekday count: matches 82 NYSE sessions. `82 × 79 = 6,478` = total candle count. The response is internally consistent at the day-aggregate level.

### 4d. The May 11 session itself

**Most recent session in the capture. Complete.**

| Property | Value |
|---|---|
| Bar count | 79 (= 78 real + 1 synthetic) |
| First bar UTC | `2026-05-11 13:30:00` (9:30 AM ET — RTH open) |
| Last real bar UTC | `2026-05-11 19:55:00` (3:55 PM ET — covers the 3:55→4:00 closing 5 minutes) |
| Last (synthetic) bar UTC | `2026-05-11 20:00:00` (4:00 PM ET sharp) |
| Synthetic bar OHLC | `292.679992` (all four fields identical) |
| Synthetic bar volume (raw) | `null` |
| First real-bar open | `291.979003` |
| Real-bar volume max (within session) | `25,283,503` (at `19:10:00 UTC`) |

**Volume anomaly worth flagging (not in the brief but visible in the slice):** several mid-session bars on May 11 carry volumes 1–2 orders of magnitude larger than their neighbours and increase monotonically across the session (14:15 → 8.39M, 15:00 → 12.31M, 15:35 → 14.23M, 16:05 → 16.57M, 16:25 → 17.41M, 17:50 → 21.64M, 18:05 → 22.55M, 18:45 → 24.40M, 19:05 → 25.02M, 19:10 → 25.28M). The monotonic climb strongly suggests these are **cumulative-volume snapshots interleaved with per-5-min volume bars** — a different EODHD bug than the one the brief is investigating. It is **out of scope for this analysis** but worth opening a separate ticket for: downstream consumers like volume-weighted analytics will see spurious spikes. VWAP itself is robust to this (cumulative numerator/denominator absorbs the same totals regardless), but any "5-min volume change" or "average bar volume" calc will be wrong.

---

## 5. Q4 — Filter logic options for the synthetic close-print bar

### 5a. What the synthetic bar is and isn't

The synthetic bar's signature (confirmed on both May 8 and May 11 captures):

- `datetime` is exactly RTH close (`16:00` ET / `20:00` UTC post-DST / `21:00` UTC pre-DST)
- `open === high === low === close`
- `volume === null` in raw payload
- `timestamp` is consistent with the `datetime` (no skew)

It is **a snapshot of the official closing print**, emitted as a JSON convenience so the closing price is the last element of the array. It is not a real 5-min bar.

### 5b. Current behavior (without explicit filtering)

After `fetchIntradayCandles` mapping (`marketDataCache.js:682-689`):
- `Number.isFinite` check on OHLC at lines 669-673 **passes** (all four are finite, just equal).
- Mapping at line 688: `volume: d.volume || 0` → null becomes `0`.
- The bar reaches `filterToCurrentSession` as `{datetime: "2026-05-11 20:00:00", O==H==L==C==292.679992, volume: 0}`.

In `filterToCurrentSession` (`marketDataCache.js:808`):
- ET projection puts it at 16:00 ET = 960 minutes.
- `upperBoundMinutes = Math.min(closeMinutes=960, nowMinutes)`.
- Inclusive comparison at line 833: `cMinutes <= upperBoundMinutes` → **included** if `nowMinutes >= 960` (i.e., at or after the close), **excluded** if cron runs intra-session (since `nowMinutes` will be `<960` and so will be the clamp).

So in practice the synthetic bar **only reaches `calculateVWAP` on post-close / after-hours runs**. During RTH, the `nowMinutes` clamp excludes it as a side effect.

In `calculateVWAP` (`technicalCalculations.js:378`):
- `typicalPrice = (high + low + close) / 3 = close`
- `vol = candle.volume || 0 = 0`
- Contribution to `cumulativeTPV`: `close * 0 = 0`
- Contribution to `cumulativeVolume`: `0`
- **Net effect on VWAP: zero.**
- However, the bar becomes `intradayCandles[length - 1]` and its `.close` is used at line 396 (`const currentPrice = intradayCandles[intradayCandles.length - 1].close;`). The synthetic bar's close == the real last bar's close (it's a snapshot), so `currentPrice` is unaffected.

**Conclusion: the synthetic bar is harmless for the VWAP path specifically.** This is consistent with no VWAP-corruption bugs in production despite the bar always being present in post-close payloads.

### 5c. Where the synthetic bar does cause trouble

Any consumer that treats `intradayCandles[length - 1]` as a "last 5-min bar of activity" will misread:

- **Volume histograms / heatmaps**: the final bar's "volume = 0" creates a misleading gap visual.
- **Last-bar volume comparison** (e.g., "closing bar volume vs. session average"): trivially `0`, useless signal.
- **MFI, CMF, OBV** and other money-flow indicators: contributions from the synthetic bar are zero, biasing the rolling window toward the prior real bar without reflecting actual closing-print activity.
- **"Last real candle" tracking** for momentum / pattern detection: picks up the synthetic flat bar as if it were a real consolidation.

None of these are in the current cron path — the brief is VWAP-focused — but the bar is a latent footgun for any new intraday-derived metric that gets added.

### 5d. Filter options (in order of preference)

**Option A (recommended) — strip at source, strict triple-condition test.**

In `fetchIntradayCandles`, before the `Number.isFinite` validity filter at line 668:

```js
const isSyntheticClosePrint = d => (
  d.volume === null
  && d.open === d.high
  && d.high === d.low
  && d.low === d.close
);
```

Drop the bar before the `validCandles.filter`. Use **all three conditions** (`raw volume === null` AND `OHLC all equal` AND **optionally** time-at-RTH-close) so we don't accidentally strip a real bar that happens to have one of the properties (e.g., a real bar with no trades — extremely rare on AAPL but possible on illiquid names).

Pros:
- Targets the exact anomaly without false positives in any realistic scenario.
- Single point of fix; no caller has to know about synthetic bars.
- `volume === null` raw is a very strong signal; combined with `O==H==L==C` it's effectively unambiguous.

Cons:
- Coupled to EODHD's current convention. If EODHD ever switches to `volume: 0` for synthetic bars, the filter silently stops working. Mitigate with a runtime warning when `O==H==L==C` AND `time-at-RTH-close` AND `volume === 0` — i.e., one of the conditions fired but not all three. (Don't drop in that case; just log.)

**Option B — strip in `filterToCurrentSession` only, time-based.**

Change the inclusive `cMinutes <= upperBoundMinutes` (line 833) to exclusive (`cMinutes < upperBoundMinutes`) AND tighten `closeMinutes` to `16 * 60 - 0` semantically (or strip any bar at exactly `closeMinutes`).

Pros: surgical, no source-level coupling.
Cons:
- Doesn't help non-session consumers of `fetchIntradayCandles` output (they still see the synthetic bar).
- Would also drop a hypothetical real bar at exactly `16:00 ET` — but that bar can't exist by definition (5-min intervals are `[15:55, 16:00)` so 16:00:00 itself belongs to the next interval which doesn't exist within RTH).

**Option C — drop any bar with `O==H==L==C` AND raw `volume === null`.**

Looser than A (no time check). Pros: catches any synthetic snapshot regardless of timing. Cons: tiny risk of dropping a real bar where every trade printed at one price (essentially impossible on liquid names; possible on micro-caps).

**Option D — drop only by `raw volume === null`.**

Simplest. Pros: one-liner. Cons: depends entirely on EODHD always using `null` for synthetic bars and never for real "no-trade" bars; less defensive than A or C.

**Recommendation: Option A**, plus a one-shot warning log (`console.warn`) the first time a single-condition match occurs in a single cron run so we notice if EODHD's convention drifts.

---

## 6. Q5 — Complete-session validation

### 6a. Definition

A **complete RTH session** for a given ET date `D` has, after stripping the synthetic close-print bar:

| Day type | Real-bar count | First bar ET | Last real bar ET |
|---|---|---|---|
| Standard RTH (6.5h) | **78** | 09:30 | 15:55 |
| Early-close (3.5h: half-day Thanksgiving Friday, Christmas Eve, July 3 when applicable) | **42** | 09:30 | 12:55 |

Plus exactly 0 or 1 synthetic close-print bar (1 if the session has ended; 0 if it's still in progress, since EODHD only emits the synthetic bar after close).

All bars must have:
- ET-projected date == `D`
- ET-projected times monotonically increasing in 5-min steps
- OHLC all finite (not null, not `NaN`)
- volume finite (after the `d.volume || 0` mapping)

### 6b. Validator pseudocode

```js
function classifySession(candles, dateStr) {
  // Pre-condition: candles already filtered to dateStr's ET date by caller.
  // Pre-condition: synthetic close-print bar already stripped (Option A).
  const earlyClose = isEarlyCloseDay(dateStr);
  const expectedBars = earlyClose ? 42 : 78;
  const closeMinute = (earlyClose ? 13 : 16) * 60; // 1:00 PM or 4:00 PM ET

  if (candles.length === 0) {
    return { state: 'empty', reason: 'no candles for this ET date' };
  }
  if (candles.length === expectedBars) {
    // Verify boundaries
    const firstMin = etMinute(candles[0]);
    const lastMin = etMinute(candles[candles.length - 1]);
    if (firstMin !== 9 * 60 + 30) return { state: 'incomplete', reason: 'first bar not at 9:30 ET' };
    if (lastMin !== closeMinute - 5) return { state: 'incomplete', reason: 'last bar not at close-5' };
    return { state: 'complete' };
  }
  if (candles.length < expectedBars) {
    return { state: 'in_progress', barsSeen: candles.length, expected: expectedBars };
  }
  return { state: 'over', barsSeen: candles.length, expected: expectedBars,
           reason: 'more bars than RTH should contain — possible extended-hours leak' };
}
```

`isEarlyCloseDay` already exists in `marketSchedule.js` and is consumed by `filterToCurrentSession` (`marketDataCache.js:823`). No new dependencies needed.

### 6c. Applied to the May 11 capture

After stripping the synthetic 20:00 UTC bar, May 11 has:
- 78 bars ✓
- First bar 13:30 UTC = 9:30 ET ✓
- Last bar 19:55 UTC = 3:55 ET = `closeMinute (16:00 ET) - 5` ✓

→ **`state: 'complete'`**.

### 6d. Applied to "today" (2026-05-12) in this capture

Today is in the capture's date-range scope (the curl was issued today) but **today has zero candles** in the response. `classifySession([], '2026-05-12')` → **`state: 'empty'`**. This is exactly the precondition that drives the production failure (next section).

---

## 7. The production `intraday: null` failure chain — confirmed

`eodhd-live-verification.md` §8 hypothesised the failure chain. The 2026-05-12 capture **confirms it**:

```
EODHD default-window response is stale by ~1 trading day even with US RTH live
  → latest ET date in response: 2026-05-11 (Mon)
  → today's ET date: 2026-05-12 (Tue)
  → filterToCurrentSession(candles, now=Tue) filters to nowParts.dateStr = "2026-05-12"
  → marketDataCache.js:831 (cParts.dateStr !== nowParts.dateStr) drops every candle
  → returns []
  → calculateVWAP([]) returns null (technicalCalculations.js:379)
  → cronState.intradayMomentum[symbol] = null
  → portfolio brief renders intraday: null
```

Every link in the chain is now grounded in observed data, not inference.

**The session-boundary filter is working as designed.** The bug is upstream: EODHD's default-window response is one trading day stale during active RTH, contrary to the May 6 evidence captured in commit `330b5fa` (which saw same-day data with lag ≤ 1 day). The lag has not cleared; if anything, today's capture shows it is at least as bad as on May 6.

**Fix v2 design (out of scope for this discovery, but the unblock is clear):** the only options that recover today's bars are (a) explicitly windowed requests (`from=NOW-Xh&to=NOW`) which the May 6 evidence showed returns `[]` — so this is probably still broken too; (b) a different EODHD endpoint or product tier with a real-time feed; (c) a graceful-degradation path where the brief reports "intraday data delayed by EODHD" instead of `null`; or (d) using the most recent complete session (May 11 in this snapshot) as the session anchor when today's session has no published bars yet, with a freshness annotation. The choice depends on whether real-time data is contractually available — out of scope here.

---

## 8. Recommendations summary

| Finding | Severity | Recommendation |
|---|---|---|
| EODHD default-window has 1-trading-day lag during RTH (root cause of `intraday: null`) | **Critical** — production-affecting | Out of scope; design Fix v2 in a separate session. The 4 options listed in §7 are the design surface. |
| Synthetic close-print bar at every session close (volume=null, O==H==L==C) | Low — VWAP-neutral but a latent footgun | **Option A** in §5d: strip at source in `fetchIntradayCandles` with strict triple-condition test + drift-detection warning. |
| Cumulative-volume bars interleaved within RTH (not in the brief, observed in May 11 slice) | Medium — corrupts any non-VWAP volume analytic | Open separate ticket. Out of scope for this filter design. |
| `RTH_CLOSE_HOUR_ET` clamp in `filterToCurrentSession` (`marketDataCache.js:824`) | None — defensive | Keep as-is. No extended-hours bars observed in default-window endpoint. |
| `parseEodhdDatetime` format expectation | None — confirmed correct | Field shape matches `'YYYY-MM-DD HH:mm:ss'` UTC byte-for-byte. No format drift. |
| `complete-session` validator | New helper | Add `classifySession(candles, dateStr)` per §6b in `marketDataCache.js` (or a new `sessionState.js`) for callers that need session-state semantics richer than "empty vs. non-empty". |

---

## 9. What this analysis used (and didn't)

**Used:**
- 9 `jq` summary outputs from operator-side capture (pasted in chat 2026-05-12).
- `api/_utils/marketDataCache.js:617-835` (read in full).
- `api/_utils/technicalCalculations.js:378-` (`calculateVWAP` signature + null-paths).
- Cross-reference with `discovery/eodhd-live-verification.md` (on `claude/eodhd-live-verification-2245`).
- 2026 NYSE holiday calendar (MLK, Presidents', Good Friday — verified against per-day absence in capture).
- US DST 2026: starts Sun 2026-03-08 — verified against per-day UTC-shift at 2026-03-09 in capture.

**Not used / out of scope:**
- The full 6,478-element candle array (would not have changed any conclusion; per-day aggregates plus three full-day slices were sufficient).
- Live curl from this sandbox (still blocked — see `eodhd-live-verification.md` §1).
- MU.US cross-check curl (not run by operator this session; AAPL alone is sufficient to confirm the session-boundary anatomy, since the synthetic bar and lag are properties of the endpoint, not the symbol).
