# EODHD Intraday — Cumulative Volume Bar Analysis

**Date:** 2026-05-12
**Branch:** `claude/eodhd-session-boundary-3863` (continuing from `49ccc9e`)
**Author:** Claude (read-only discovery)
**Companion to:**
- `discovery/eodhd-live-verification.md` (curl harness, on `claude/eodhd-live-verification-2245`)
- `discovery/eodhd-session-boundary-analysis.md` (session anatomy, this branch — flagged the cum-bar pattern as side finding)
**Status:** Complete for May 11 single-session deep dive. **Cross-session confirmation pending operator-side jq run** (see §1c).

---

## TL;DR

- **Cumulative-volume bars are confirmed** in EODHD's intraday default-window response. On 2026-05-11, **12 of 78 real RTH bars (15%)** had their `volume` field replaced with a running session-cumulative total instead of the per-5-minute volume.
- The cumulative interpretation is rigorously confirmed by a running-total cross-check (§1b): every cum-bar's value matches `prior_cum + sum(intervening real volumes) + plausible_5min_volume` within ≤1% sync slop.
- **OHLC is unaffected** — only the `volume` field is corrupted. Open/high/low/close on cum-bar slots reflect the real 5-min OHLC for that interval.
- Cum bars contribute **89.4%** of the session's total summed volume (`217.8M of 243.6M`), even though they're only 15% of the bar count.
- **Surprising VWAP impact:** despite the 89% volume-weight share, filtering cum bars on May 11 shifts VWAP only **0.06%** (from `292.1383` → `291.9612`). Current price `292.679992` deviates `-0.185%` from the broken VWAP and `-0.246%` from the filtered VWAP. **Both are well under 1%.**
- **Implication for the 16-67% production deviations:** the cumulative-bar bug **is not the dominant cause**. The dominant cause is the **multi-day VWAP window** previously identified — 82 trading days of price variation gets averaged together regardless of cum-bar handling. Cum filtering on top of session-boundary fix is a precision improvement (~0.06% magnitude on a single liquid name), not a magnitude fix.
- Bar position is **not predictable** by clock-time, modulo, or any other deterministic pattern observed. Filtering must be value-based (running-cumulative match or rolling-median outlier), not position-based.
- Two filter strategies tested (§5); both achieve **zero false positives, zero false negatives** on May 11. Recommend the cumulative-match strategy (most rigorous, also recovers an inferred per-bar "true" volume).
- Synthetic close-print bar (volume=null at 4:00 PM ET) is a **distinct artifact** from the cum-bar pattern; the two have non-overlapping signatures. Both should be filtered, with separate detection rules.

---

## 1. Q1 — Cumulative bar pattern characterization

### 1a. Identification on May 11 (the only fully-captured session)

Of the 79 candles in the May 11 dump (78 real + 1 synthetic close-print), **12 carry suspect-cumulative volumes**. Identified by initial heuristic `volume >= 5,000,000` (real-bar max on AAPL May 11 was 2.48M at the open burst, so 5M is comfortably above any plausible per-bar volume), then **confirmed semantically** in §1b. Timestamps in chronological order:

| # | UTC | ET | Volume |
|---|---|---|---|
| 1 | `14:15` | `10:15 AM` | 8,392,872 |
| 2 | `15:00` | `11:00 AM` | 12,313,158 |
| 3 | `15:10` | `11:10 AM` | 13,031,691 |
| 4 | `15:35` | `11:35 AM` | 14,227,907 |
| 5 | `16:05` | `12:05 PM` | 16,570,819 |
| 6 | `16:15` | `12:15 PM` | 16,935,213 |
| 7 | `16:25` | `12:25 PM` | 17,410,196 |
| 8 | `17:50` | `1:50 PM` | 21,641,651 |
| 9 | `18:05` | `2:05 PM` | 22,548,226 |
| 10 | `18:45` | `2:45 PM` | 24,398,672 |
| 11 | `19:05` | `3:05 PM` | 25,020,935 |
| 12 | `19:10` | `3:10 PM` | 25,283,503 |

Volumes are **strictly monotonically increasing** across this list. Real per-bar volumes elsewhere in the session range 118K–2.48M with median ~300K — three+ orders of magnitude smaller.

### 1b. Cumulative confirmation via running-total cross-check

If a bar's volume is the running session-cumulative total (rather than the bar's per-5-min volume), then `cum_at_bar_j - cum_at_bar_i` (for two consecutive cum bars `i < j`) should equal the **sum of all real per-bar volumes between them**, plus an "inferred true 5-min volume" for bar `j` (which is unobservable directly because that slot was overwritten with the cum value).

Walking the May 11 sequence in order and computing `inferred_true_j = (cum_j - cum_i) - sum(real volumes strictly between i and j)`:

| j | cum_dt (UTC) | cum_vol | prior_cum | diff | sum(real between) | **inferred true 5-min vol on slot j** |
|---|---|---|---|---|---|---|
| 1 | `14:15` | 8,392,872 | 0 | 8,392,872 | 7,756,374 | **636,498** |
| 2 | `15:00` | 12,313,158 | 8,392,872 | 3,920,286 | 2,989,084 | **931,202** |
| 3 | `15:10` | 13,031,691 | 12,313,158 | 718,533 | 372,850 | **345,683** |
| 4 | `15:35` | 14,227,907 | 13,031,691 | 1,196,216 | 1,141,839 | **54,377** |
| 5 | `16:05` | 16,570,819 | 14,227,907 | 2,342,912 | 1,824,012 | **518,900** |
| 6 | `16:15` | 16,935,213 | 16,570,819 | 364,394 | 248,001 | **116,393** |
| 7 | `16:25` | 17,410,196 | 16,935,213 | 474,983 | 291,893 | **183,090** |
| 8 | `17:50` | 21,641,651 | 17,410,196 | 4,231,455 | 4,077,709 | **153,746** |
| 9 | `18:05` | 22,548,226 | 21,641,651 | 906,575 | 744,157 | **162,418** |
| 10 | `18:45` | 24,398,672 | 22,548,226 | 1,850,446 | 1,392,881 | **457,565** |
| 11 | `19:05` | 25,020,935 | 24,398,672 | 622,263 | 622,945 | **−682** ⚠️ |
| 12 | `19:10` | 25,283,503 | 25,020,935 | 262,568 | 0 | **262,568** |

**11 of 12 inferred true volumes are positive and within the typical real-bar range (54K–931K), consistent with the surrounding real bars' volumes**. The single "−682" at row 11 is a sync slop of 0.003% (relative to the 25M cum value) — well within the precision noise expected from EODHD's snapshot timing vs. the per-bar accumulator.

This is **definitive**: the suspected bars are running session-cumulative volume snapshots, not legitimately-large per-bar volumes. The OHLC fields on those slots remain real per-5-min values (verified in §2a — open is contiguous with prior bar's close).

### 1c. Multi-session consistency — **data-limited**

The operator's earlier capture only included full per-bar dumps for **May 11** (and a 3-bar tail for May 8). Per-day counts are uniformly 79 across all 82 trading days, but uniform count does **not** confirm uniform cum-bar pattern (cum bars overwrite, they don't add).

To extend Q1.3 to May 8/7/6 (and ideally a sample from January for pre-DST coverage), the operator can run a single jq summary that returns per-session counts of bars exceeding the threshold:

```bash
jq '[group_by(.datetime[0:10])[]
     | {date: .[0].datetime[0:10],
        n_total: length,
        n_high_volume: ([.[] | select(.volume != null and .volume > 5000000)] | length),
        max_vol: ([.[] | select(.volume != null) | .volume] | max)}]
    | sort_by(.date)' aapl_default.json
```

This produces ~82 lines of `{date, n_total: 79, n_high_volume: N, max_vol: V}`. If `n_high_volume` is consistently in the 8-20 range across all sessions and `max_vol` is consistently within 10-30M, the cum-bar phenomenon is systemic across the entire response. If `n_high_volume == 0` for some sessions, the pattern is intermittent and detection logic must handle absence gracefully (which the proposed filter naturally does — it just doesn't flag anything).

Until that's run, this report's conclusions rest on the May 11 single-session evidence. The session-boundary uniformity (78+1 bar shape) is identical across all 82 days, which is **suggestive** but not **proof** that cum-bar overlay is also uniform.

### 1d. Position pattern — none observed

| metric | observation |
|---|---|
| Fixed clock-time positions? | No. Cum bars at 10:15, 11:00, 11:10, 11:35, 12:05, 12:15, 12:25, 1:50, 2:05, 2:45, 3:05, 3:10 ET — irregular. |
| Top-of-hour bias? | Weak. 11:00, 12:00 (no — `12:05`), 1:00 (no), 2:00 (no — `2:05`), 3:00 (no — `3:05`). 3 of 12 are within 5 min of an hour boundary; 9 are not. |
| Modulo-N bar position? | No. Indices 9, 18, 20, 25, 31, 33, 35, 52, 55, 63, 67, 68 — gaps of 9, 2, 5, 6, 2, 2, 17, 3, 8, 4, 1. No GCD pattern. |
| Density gradient (more late-session)? | Yes. 4 cum bars in 13:30-15:00 (1.5h, 18 bars), 8 cum bars in 15:00-19:30 (4.5h, 54 bars). Density rises mid-session and stays elevated. Plausibly tied to EODHD's batch refresh cadence accelerating during US RTH peak hours. |

**Implication:** detection cannot be position-based. Must be value-based.

---

## 2. Q2 — Distinguishing features between real and cumulative bars

### 2a. Field-by-field comparison (cum bar vs. adjacent real bars)

Comparing the `15:00` cum bar against the surrounding real bars `14:55` and `15:05`:

| field | 14:55 (real) | 15:00 (cum) | 15:05 (real) | observation |
|---|---|---|---|---|
| `timestamp` | 1,778,511,300 | 1,778,511,600 | 1,778,511,900 | Exactly 5 min apart on both sides. **No anomaly.** |
| `gmtoffset` | 0 | 0 | 0 | Constant. **No discriminator.** |
| `datetime` | `2026-05-11 14:55:00` | `2026-05-11 15:00:00` | `2026-05-11 15:05:00` | Contiguous 5-min stamps. **No anomaly.** |
| `open` | 292.635009 | 292.53009 | 292.619995 | Cum's open ≈ prior bar's close (292.549987). **OHLC continuity preserved.** |
| `high` | 292.959991 | 292.640014 | 293.23999 | Plausible 5-min range. **Real OHLC.** |
| `low` | 292.429992 | 292.25 | 292.510009 | Plausible 5-min range. **Real OHLC.** |
| `close` | 292.549987 | 292.609985 | 293.200012 | Cum's close → next bar's open is contiguous. **Real OHLC.** |
| **`volume`** | **226,743** | **12,313,158** | **372,850** | **The only anomaly.** Cum is 54x the surrounding median. |

**Conclusion:** the **only** distinguishing field is `volume`. OHLC, timestamp, gmtoffset, and datetime are all valid per-5-min real values. This is consistent with EODHD overwriting just the volume column on snapshot intervals, not emitting separate "summary" rows.

### 2b. Reliable filter signals (ranked)

| signal | reliability | implementability | false-positive risk |
|---|---|---|---|
| **Running-cumulative match** (this bar's volume ≈ sum of all prior real volumes) | **Highest** — directly tests the cum semantic. | Medium — requires sequential session walk with stateful accumulator. | Negligible. Only triggers when the math actually works out. |
| **Rolling-median ratio** (volume > 10× median of prior 10 real bars) | High — works on this data with 13.4×–117.6× margin. | Easy — small sliding window. | Low — but a real news-spike bar (e.g., earnings printout) could exceed 10× median. Real-bar max on May 11 was 2.48M at open vs. session median 300K = 8.3× ratio. So the 10× threshold survives the open-burst false positive by a thin margin; tightening to 8× would break that, loosening to 5× would catch the open burst as cum. |
| **Absolute volume threshold** (volume > 5M) | Symbol-specific — works on AAPL, breaks on lower-volume names. | Trivial. | High for low-volume symbols (RKLB, ALB). |
| **Position-based** (every Nth bar) | None — no pattern exists. | N/A | N/A — not applicable. |

### 2c. Relationship to the synthetic close-print bar

The two artifacts are **distinct and non-overlapping**:

| property | synthetic close-print bar | cumulative volume bar |
|---|---|---|
| Position | Always last bar of session, exactly at RTH close (`16:00` ET) | Irregular, mid-to-late session |
| OHLC | All four equal | Real per-5-min OHLC |
| `volume` raw | `null` | Large positive integer |
| `volume` after `d.volume \|\| 0` | `0` | unchanged (overflows the typical cap) |
| Detection signal | `raw volume === null` AND `O==H==L==C` AND time-at-RTH-close | running-cumulative match OR rolling-median outlier |
| VWAP impact | None (zero volume contributes zero) | Significant volume weight, modest price impact |

They share **no field signature**. Filters for them must be implemented independently. (Confirmed by inspecting May 11's last bar (`20:00`): `O=H=L=C=292.679992`, `volume=null`, **not flagged** by either cum-bar detection strategy in §5.)

---

## 3. Q3 — VWAP impact estimation

### 3a, 3b — Calculations

VWAP = `Σ(typical_price × volume) / Σ(volume)` where `typical_price = (high + low + close) / 3`.

Computed against the May 11 inline data:

| variant | candles included | VWAP | Σvolume |
|---|---|---|---|
| **All bars** (current production behavior — synthetic dropped via `volume===0` skip in `calculateVWAP`, cum bars passed through) | 78 (synthetic skipped because `(d.volume \|\| 0) === 0` evaluates to falsy contribution) | **292.1383** | 243,612,833 |
| **Cum bars filtered** (real bars only; synthetic also skipped) | 66 | **291.9612** | 25,837,990 |

Difference: **292.1383 − 291.9612 = 0.1771** = **0.061%** of the all-bars VWAP.

### 3c — Significance

The cum-bar contamination shifts VWAP by **6 basis points** on May 11. This is **substantial in absolute volume terms** (cum bars carry 89.4% of the summed weight) but **tiny in price-displacement terms** because cum-bar typical prices cluster in the same 291.9–293.5 band as the surrounding real bars. Cum bars don't introduce price OUTLIERS — they introduce volume OUTLIERS at price points that happen to be representative of the mid-to-late session.

### 3d — Plausibility check vs. observed close

| anchor | value | distance from real-only VWAP (291.9612) | distance from all-bars VWAP (292.1383) |
|---|---|---|---|
| Synthetic close-print | 292.6800 | +0.246% | +0.185% |
| Last real bar (19:55) close | 292.7400 | +0.266% | +0.205% |
| Session high (within 14:25 bar) | 293.6000 | +0.561% | +0.500% |
| Session low (within 13:30 bar) | 290.2300 | −0.594% | −0.654% |

**Both VWAP variants are plausible session VWAPs** (all within 0.3% of close, well inside the typical 0.5–2% session deviation range for a low-volatility large-cap on a quiet day). The all-bars VWAP is *closer* to the close (smaller deviation), but that's misleading — it's closer because cum bars overweight late-session prices, which trivially pulls the weighted average toward the close. The real-only VWAP is the correct measurement.

### 3e — Extrapolation to <5% deviation target

**The cum-bar filter does not produce the magnitude reduction needed to fix the 16-67% production deviations.** Cum filtering shifts May 11 VWAP by 0.06%; the production deviations are 100–1000× larger.

The 16–67% deviations come from the **82-day price range being averaged into a single VWAP**. AAPL alone moved through ~290–295 in the captured window's most recent week, but probably moved through a much wider range (e.g., 230–295) over the full 82 trading days. A multi-day VWAP that averages all 82 days produces a value substantially below current price — the deviation magnitude scales with the price range traversed by the window, not with the volume-weighting precision within each session.

**Order of magnitude:** the dominant variable is `(price_range_in_window) / current_price`. For a 4-month window on a stock that's risen 25%, deviation will be in the 12–15% range regardless of cum-bar handling. For a stock that's risen 50%, deviation will be 20–30%. The 16–67% spread observed across MU/ALB/RKLB/GOOGL is consistent with each name having different 4-month price-range profiles.

**Cum-bar filtering on top of session-boundary fix is a precision improvement (~6 bps), not a magnitude fix.** The session-boundary fix is the load-bearing change. Cum filtering matters for downstream consumers that use volume directly (volume histograms, MFI/CMF) more than for VWAP itself.

---

## 4. Q4 — Filter design

### 4a. Recommended criterion

**Strategy A — Running-cumulative match (recommended).** A bar is cumulative iff:
1. `bar.volume > 5 × (running_real_sum_through_prior_bar / bar_index)` — i.e., this bar's volume is more than 5× the average per-bar real volume seen so far this session, AND
2. `bar.volume > running_real_sum_through_prior_bar` — i.e., the value is plausible as a cumulative-since-open total.

When flagged, **drop the bar entirely from VWAP** (do not attempt to substitute the inferred true volume — the inference precision is ±10% and the dropped bar's contribution is one of 78 anyway, so substitution is more risk than reward).

Pseudocode:

```js
function stripCumulativeBars(candles) {
  let runningRealSum = 0;
  let realBarCount = 0;
  return candles.filter(c => {
    const v = c.volume || 0;
    if (realBarCount === 0) {
      // First bar — never enough context to flag as cumulative
      runningRealSum += v;
      realBarCount += 1;
      return true;
    }
    const avgReal = runningRealSum / realBarCount;
    const looksCumulative = v > runningRealSum && v > 5 * avgReal;
    if (!looksCumulative) {
      runningRealSum += v;
      realBarCount += 1;
    }
    return !looksCumulative;
  });
}
```

**Why this over Strategy B (rolling-median outlier):** Strategy A directly tests the cumulative semantic. Strategy B works on May 11 with a 13.4× minimum margin, but a hypothetical earnings-day open burst could trigger it (real-bar max of 2.48M vs. median of 300K is already 8.3×, only one threshold tightening away from a false positive). Strategy A's cumulative-sum match is robust to volume spikes that aren't actually cumulative — a real 8M bar at the open will not satisfy `v > running_real_sum_through_prior_bar` because there's no prior real sum to exceed. Both strategies achieved zero FP/FN on May 11 (§5 backing data); Strategy A has higher headroom against future edge cases.

### 4b. Edge cases

| edge case | Strategy A behavior | mitigation needed? |
|---|---|---|
| Real volume happens to match cum signature on a low-volume name with one extreme bar | Triggered if `v > running_sum AND v > 5 × avg`. For a low-volume name (e.g., RKLB) with a single 5M bar amid 50K bars, both conditions fire → false positive. | **Yes.** Tighten the multiplier on a per-symbol basis, OR add a third condition: `v > N_min_absolute` where `N_min_absolute` is a low absolute floor (e.g., 1M). Prevents false positives on micro-cap volume profiles where 5× the average is still small. |
| First bar of session has unusual volume | First bar is never flagged (filter returns true unconditionally for `realBarCount === 0`). | None needed; this is correct behavior. |
| Pre-market or after-hours bars (if EODHD ever starts including them) | Strategy A walks chronologically, so off-RTH bars would be folded into the running sum. If RTH-open's first cum bar then matches `cum ≈ off-RTH-real-sum + RTH-real-sum-so-far`, detection still works. | None needed if RTH filter runs first; strip post-`filterToCurrentSession` as a defense-in-depth measure. |
| Two cum bars at the same timestamp (duplicates) | Strategy A's flag-then-don't-add prevents the second from being incorporated; both would be flagged. | None needed. |
| Cumulative value resets mid-session (EODHD bug recovery) | Strategy A would fail to detect a "smaller" cum bar after a big one. Real cum bars are strictly monotonically increasing (verified §1a), so this is hypothetical. | None needed unless evidence shows it happens. |
| Pure consolidation session (all real bars near identical volume) | `5 × avg` threshold scales with whatever the average is, so even uniformly-low-volume sessions retain detection sensitivity. | None needed. |

### 4c. Pipeline placement

**Recommend: in `fetchIntradayCandles`, immediately after the synthetic close-print strip, before the `Number.isFinite` validity filter at line 668.**

Rationale:
- Single point of fix — every consumer of `fetchIntradayCandles` (VWAP, future volume analytics, intraday line rendering) gets clean data automatically.
- `fetchIntradayCandles` already owns "data shape normalization" responsibility (it converts EODHD's response into the stable internal shape). Cum-bar stripping is the same kind of normalization.
- Placing it in `calculateVWAP` would help VWAP only; future MFI/CMF/volume-histogram code would have to re-derive the same filter. DRY violation.
- Placing it in `agent-evaluate.js` between fetch and calc isolates the change from `marketDataCache.js` but obscures the data-source contract — callers wouldn't know they need to filter.
- Order matters: **synthetic strip first, cum strip second, OHLC validity third**. Synthetic bars have `volume===null` which would crash a sum-based cum detector if not stripped first.

```js
// inside fetchIntradayCandles, after `data` array obtained:
const noSynthetic = data.filter(d => !isSyntheticClosePrint(d));     // §5d Option A from prior doc
const noCumulative = stripCumulativeBars(noSynthetic);               // this doc's §4a
const validCandles = noCumulative.filter(d => /* OHLC isFinite */);  // existing line 668-674
```

The cumulative-bar detector should also emit a single `console.warn` per session-fetch summarizing how many bars were stripped, mirroring the existing `droppedCount` warning pattern at line 678. That gives us observability if EODHD's behavior shifts (e.g., suddenly emits 30 cum bars instead of 12 — would warrant investigation).

---

## 5. Filter validation backing data

Both proposed strategies were tested against the May 11 ground-truth set (12 known cum bars, 66 known real bars). Threshold tuning details:

**Strategy A — Running-cumulative match (`v > running_real_sum AND v > 5 × prior_avg`):**

All 12 known cum bars correctly flagged. Zero false positives. Headroom: smallest flagged ratio was at bar `14:15` where `v=8,392,872`, `running_sum=7,756,374`, `prior_avg=861,819`, ratio to avg = 9.7× (well above the 5× threshold).

**Strategy B — Rolling-median outlier (`v > 10 × median(prior 10 reals)`):**

All 12 known cum bars correctly flagged. Zero false positives. Headroom: smallest ratio was 13.4× at `14:15` (median of prior 10 reals = 625,613). All others ranged 30.9× → 121.8×.

Both strategies survive on May 11. Strategy A's robustness against future false positives (earnings-spike bars, gap opens) is the deciding factor in the §4a recommendation.

---

## 6. Q5 — Fix v2 scope implications

### 6a. Bundle vs. separate

| fix | brings to | magnitude impact on production VWAP deviation | risk if shipped alone |
|---|---|---|---|
| **Session boundary anchored on latest-date-in-response** | Bounds VWAP to single session, eliminates 82-day price-range averaging | **Large — primary lever for the 16-67% deviation magnitude.** | If shipped without cum filter: VWAP moves into the right magnitude (sub-1% deviation typical), but is still off by ~6 bps from "true" session VWAP due to cum bar overweighting. Acceptable for risk-manager triggers (sign correctness preserved); marginal for high-precision use cases. |
| **Synthetic close-print bar strip** | Removes the volume=0 trailing bar | **Zero on VWAP** (volume=0 contributes nothing). | None for VWAP. Avoids latent footgun for future volume-derived metrics. Trivial to implement. |
| **Cumulative-volume bar filter** | Removes the 12 cum bars per session, restores real per-bar volumes | **6 bps on May 11.** Likely similar order-of-magnitude on other sessions and other liquid symbols. May be larger on smaller-cap names where cum-bar volumes are a higher multiple of real volumes. | If shipped without session-boundary fix: improves precision of the still-multi-day VWAP by 6 bps, which is invisible against the 16-67% magnitude error. Net useless without the boundary fix landing first. |

### 6b. Recommendation

**Bundle all three into Fix v2**, in this order of priority:

1. **Session boundary fix (must-have, P0).** Without this, the 16-67% deviations persist and Phase 5B-main rendering remains miscalibrated. The "anchor on latest date in response" approach handles the EODHD lag gracefully — when today's data is missing, fall back to the most recent complete session and annotate the brief as "intraday (Mon close)" or similar. This is the load-bearing change.

2. **Cumulative-volume bar filter (should-have, P1).** Once #1 lands, the residual ~6 bps precision error from cum bars becomes visible. This filter eliminates it. It also unlocks correct downstream volume analytics (volume histograms, MFI, CMF) that don't currently exist but might be added soon. Strategy A from §4a, placed in `fetchIntradayCandles` per §4c.

3. **Synthetic close-print bar strip (should-have, P1).** Zero VWAP impact, trivial implementation, future-proofs against new consumers. Cheap to bundle, no reason to defer.

**Why bundle vs. separate PRs:**
- All three target the same file (`fetchIntradayCandles` in `marketDataCache.js`) and the same code path.
- Reviewer cognitive load is lower for one coherent "EODHD response normalization hardening" PR than three small interleaved ones.
- Single test surface: integration tests can verify `fetchIntradayCandles` produces clean data in one suite rather than three.
- Single rollout, single rollback, single Vercel deploy.

**The argument for separate PRs is rollback granularity** — if the cum-bar filter has a bug that affects a low-volume symbol, we'd want to disable it without rolling back the boundary fix. Mitigations within a single bundled PR:
- Feature-flag the cum-bar and synthetic strips behind env vars (default-on, kill-switch via Vercel).
- Wrap each filter in a `try/catch` with fall-through; a filter exception leaves the bar in rather than crashing the cron.

If the team's preference is rollback granularity over reviewer-cognitive load, splitting into 2 PRs is reasonable: (1) **session boundary + synthetic strip + cum filter (data integrity)**, (2) **brief-rendering changes that consume the cleaner data**. Splitting cum from synthetic from boundary feels like over-rotation given they all touch one function.

### 6c. Risk of shipping session-boundary fix without cum filter

| risk | severity | rationale |
|---|---|---|
| VWAP still wrong, just differently | **Low.** Residual error is ~6 bps on May 11 AAPL. | Production currently has 16-67% errors; 6 bps is 99%+ improvement. Not a regression. |
| Phase 5B-main rendering miscalibrated | **Low.** | If 5B-main triggers operate on price-vs-VWAP threshold (e.g., "alert when deviation > 2%"), 6 bps noise is well below any actionable threshold. |
| Risk-manager triggers operate on bad data | **Low.** | Same as above. Trigger thresholds are typically % of price; 0.06% noise is below resolution of any sensible threshold. |
| Loss of confidence in data integrity | **Medium.** | Once the team knows about the cum-bar pattern, leaving it unfilled feels like leaving a known bug in. Worth fixing for hygiene + future-volume-analytic-readiness, even if VWAP impact is marginal. |
| Future intraday volume metrics will inherit the bug | **Medium.** | Anyone who later writes "average bar volume" or "5-min volume change" will get garbage from cum bars, with no obvious clue why. |

**Net: shipping session-boundary alone is safe and recoverable.** It would be a reasonable phased approach if cum-filter implementation reveals complications. But there's no implementation reason to split — Strategy A is ~15 lines.

---

## 7. Synthesis

**Cumulative volume bars appear at irregular mid-to-late-session positions** (12 of 78 real bars on May 11; cluster density rises after ~1.5h into the session, no clean clock-time or modulo pattern observed). They can be filtered by **a running-cumulative match** (Strategy A in §4a: `volume > running_real_sum AND volume > 5× prior_avg_per_bar`), which on the May 11 ground-truth set produces zero false positives and zero false negatives with comfortable margin. Filtering them changes May 11 VWAP from `292.1383` to `291.9612`, producing deviation of **−0.246%** vs current price `292.679992` (vs current broken value of **−0.185%**). **Fix v2 should bundle all three fixes (session-boundary anchor, synthetic close-print strip, cumulative-volume filter)** because they all target the same `fetchIntradayCandles` normalization path; the session-boundary fix is the load-bearing magnitude fix (closes the 16-67% gap), while cum-filter and synthetic-strip are precision/hygiene improvements that prevent the same data-shape issues from contaminating future intraday volume analytics. Cumulative-bar filtering alone does **not** close the production deviation magnitude — that gap is dominated by the multi-day window length, not by intra-session weighting precision.

---

## 8. What this analysis used (and didn't)

**Used:**
- The full May 11 per-bar dump from operator's earlier jq output (chat 2026-05-12, 79 bars).
- The May 8 last-3-bar tail (synthetic-bar shape cross-check).
- A throwaway Python script (`/tmp/cum_analysis.py`, not committed) to compute VWAPs, running-totals, rolling medians, and filter-strategy validation against the ground-truth set.
- `api/_utils/technicalCalculations.js:378` — `calculateVWAP` signature and null-handling (already read for prior discovery).
- `api/_utils/marketDataCache.js:617-689` — `fetchIntradayCandles` placement target (already read).

**Not used / data-limited:**
- May 6, May 7, May 8 full per-bar dumps (Q1.3 cross-session consistency). The §1c jq command can extend coverage to all 82 days in one operator-side run.
- January (pre-DST) sessions for the cum-bar pattern. Same jq command would cover them.
- MU.US, GOOGL, RKLB, ALB cross-symbol confirmation. Each would need its own `fetchIntradayCandles` curl + `jq` summary; the threshold multipliers in Strategy A may need per-symbol tuning if cum-bar volumes scale differently relative to median volumes on lower-cap names.
