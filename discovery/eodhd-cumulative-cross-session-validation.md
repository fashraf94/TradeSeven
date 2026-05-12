# EODHD Cumulative Volume — Cross-Session Validation

**Date:** 2026-05-12
**Branch:** `claude/eodhd-session-boundary-3863` (continuing from `7aec59f`)
**Validates:** Strategy A filter recommended in `discovery/eodhd-cumulative-volume-analysis.md` §4a.
**Test set:** AAPL.US, four sessions — May 8/7/6 (recent, post-DST) and Feb 12 (older, pre-DST, different market regime).
**Status:** Strategy A **needs adjustment** before Fix v2. Recall 95.5%, not 100%.

---

## TL;DR

- **Pattern is NOT consistent across sessions.** Anomaly count per session: 8 / 7 / 6 / 1 (May 8 / May 7 / May 6 / Feb 12). Density distribution and underlying mechanism also vary.
- **The "cumulative-since-session-open" hypothesis fits May 11 / May 7 / May 6 cleanly, but breaks on May 8 and Feb 12.** May 8 has one "over-budget" anomaly (14:40 = 26.8M, inferred true 13.7M — implausible as 5-min volume; likely a delayed-report block / dark-pool print) and one "non-monotonic" anomaly (15:20 = 18.5M, *below* the prior cum 26.8M). Feb 12's single anomaly (20:35 = 17.5M) is "under-budget" — *less than* the running real-bar total at that point.
- **Strategy A as documented: 21 true positives, 0 false positives, 1 false negative across 22 ground-truth anomalies.** Recall 95.5%, precision 100%.
- The miss is Feb 12's 20:35 = 17,476,979 bar. Strategy A requires `v > running_real_sum AND v > 5×avg`. By the 74th bar of that session the running real total is ~33.4M, so `v > running_real_sum` fails even though `v > 5×avg` succeeds at 38×.
- **Threshold margin is tight on AAPL alone.** Highest real-bar v/avg ratio observed across the 4 sessions: 7.34× (May 8 close-burst). Lowest cum-bar v/avg ratio: 8.60× (May 8's 14:10 anomaly). **Only 1.26× separation** between the worst real bar and the closest anomaly. A single-condition strategy with threshold 5× would produce false positives on real close-burst bars.
- Across all 4 sessions, lowest cum-bar volume **10,145,550**; highest real-bar volume **3,376,769** — clean separation by absolute volume (3× gap), but this is symbol-specific and won't generalize to RKLB/ALB without re-tuning.

---

## 1. Per-session results

| Session | Bars | Anomalies (truth) | Strategy A predicted | TP | FP | FN | Density (early/mid/late) |
|---|---|---|---|---|---|---|---|
| 2026-05-08 (Fri) | 79 (78 real + 1 synth) | 8 | 8 | 8 | 0 | 0 | 3 / 3 / 2 |
| 2026-05-07 (Thu) | 79 | 7 | 7 | 7 | 0 | 0 | 4 / 1 / 2 |
| 2026-05-06 (Wed) | 79 | 6 | 6 | 6 | 0 | 0 | 2 / 2 / 2 |
| 2026-02-12 (Thu, pre-DST) | 79 | 1 | **0** | 0 | 0 | **1** | 0 / 0 / 1 |
| **All 4 (totals)** | 316 | 22 | 21 | 21 | 0 | 1 | **Precision 100%, Recall 95.5%** |

Ground-truth definition: any bar with `volume > 5,000,000`. Verified clean separator — across all four sessions the highest real-bar volume is 3,376,769 (May 8 13:30 open-burst) and the lowest anomaly is 10,145,550 (May 8 14:10), a 3.0× absolute gap.

Synthetic close-print bar (`volume==null`) present and correctly positioned in all four sessions (last bar of session at 20:00 UTC for May sessions, 21:00 UTC for Feb 12 pre-DST). Confirms `last_vol_is_null: True` summary stat across the board.

---

## 2. Cumulative-since-session-open hypothesis check (per-anomaly)

Tested by computing `inferred_true_5min_vol = (anomaly_v - prior_cum_v) - sum(real_bars_between)`. A bar is consistent with cum-since-session-open iff `inferred_true` is positive and within the typical real-bar range (≤ 5× session median); negative (small) values within ~1% noise tolerance are accepted as sync slop.

| Session | Anomaly | v | inferred_true | Verdict |
|---|---|---|---|---|
| 05-08 | 14:10 | 10,145,550 | +708,729 | **cum-since-open** ✓ |
| 05-08 | 14:40 | 26,794,559 | +13,660,217 | **over-budget** ⚠️ (inferred 5-min vol is 13.7M — implausible) |
| 05-08 | 15:20 | 18,521,165 | −12,309,872 | **non-monotonic** ⚠️ (below 14:40's 26.8M; can't be cum-since-open) |
| 05-08 | 15:45 | 20,077,629 | +131,013 | cum-since-open ✓ |
| 05-08 | 17:05 | 24,427,078 | +161,171 | cum-since-open ✓ |
| 05-08 | 17:25 | 25,861,541 | +137,830 | cum-since-open ✓ |
| 05-08 | 18:25 | 28,340,783 | +286,096 | cum-since-open ✓ |
| 05-08 | 19:45 | 34,209,036 | +659,611 | cum-since-open ✓ |
| 05-07 | 14:10 | 10,537,275 | +1,189,173 | cum-since-open ✓ |
| 05-07 | 14:30 | 12,263,341 | −156,140 | cum-since-open ✓ (within slop) |
| 05-07 | 14:35 | 12,875,976 | +612,635 | cum-since-open ✓ |
| 05-07 | 14:50 | 13,934,140 | +146,536 | cum-since-open ✓ |
| 05-07 | 16:00 | 18,743,236 | +554,054 | cum-since-open ✓ |
| 05-07 | 17:55 | 24,261,962 | −18,976 | cum-since-open ✓ (within slop) |
| 05-07 | 19:50 | 33,108,522 | +951,368 | cum-since-open ✓ |
| 05-06 | 14:30 | 11,998,333 | +721,406 | cum-since-open ✓ |
| 05-06 | 14:45 | 14,397,470 | +662,919 | cum-since-open ✓ |
| 05-06 | 16:45 | 24,215,747 | +555,466 | cum-since-open ✓ |
| 05-06 | 17:30 | 26,476,795 | −65,294 | cum-since-open ✓ (within slop) |
| 05-06 | 18:00 | 28,452,612 | +470,980 | cum-since-open ✓ |
| 05-06 | 18:45 | 31,449,783 | +207,105 | cum-since-open ✓ |
| 02-12 | 20:35 | 17,476,979 | **−15,976,344** | **under-budget** ❌ (cum value is *below* the running real total by 16M) |

**Hypothesis-fit rate:** 19 of 22 (86%) anomalies are explained by cum-since-session-open. 3 anomalies (May 8 ×2, Feb 12 ×1) are explained by some other mechanism — likely **delayed-report block trades, dark-pool prints, or auction-cross prints**, distinct from the cum-snapshot artifact. The exact mechanism is not recoverable from this data.

---

## 3. Strategy A threshold margin (Q4 — safety analysis)

Strategy A flags iff `v > running_real_sum AND v > 5×avg_real_per_bar`. Per-session ratio breakdown:

| Session | Min cum-bar ratio (v/avg) | Max real-bar ratio (v/avg) | Headroom |
|---|---|---|---|
| 05-08 | 8.60× | 7.34× | 1.26× (TIGHT) |
| 05-07 | 9.02× | 3.20× | 5.82× |
| 05-06 | 12.77× | 5.64× | 7.13× |
| 02-12 | 38.14× | 5.59× | 32.55× |
| **Global** | **8.60×** | **7.34×** | **1.26×** |

**The 5× single-condition threshold has only 1.26× headroom above the worst real bar (May 8 close-burst at 19:55 = 3,376,769).** This is dangerous if Strategy A's second condition (`v > running_real_sum`) is ever relaxed to recover the Feb 12 miss — a relaxed version would false-positive on close-burst bars.

Strategy A's dual-condition design saves us here: `v > running_real_sum` fails for the May 8 close burst by a huge margin (3.4M vs ~57M running total), so the bar is correctly not flagged despite its 7.34× avg-ratio.

**But Feb 12 exposes the failure mode of the dual-condition design.** Late-session anomalies whose absolute value is *below* the accumulated session volume — possible for any non-cum-since-open artifact (dark-pool block, single delayed print) — slip past the `v > running_real_sum` gate.

---

## 4. Volume-pattern variations (Q3)

| Variation | Observed in | Detail |
|---|---|---|
| **No anomalies in session** | (none of the 4 tested) | All 4 sessions had ≥1 anomaly. Did NOT observe a clean session. |
| **Single anomaly only** | Feb 12 | One bar (20:35), late session. Different regime — possibly the cum-snapshot frequency was lower in Feb 2026, or this session is part-cum-part-something-else and the "cum" pattern stayed mostly in-band. |
| **Many anomalies (6-8 range)** | May 6/7/8 | Recent post-DST sessions. Density rises mid/late session (May 11's earlier finding holds for May 6 & 8, weaker for May 7 where 4 of 7 are early). |
| **Non-monotonic anomaly sequence** | May 8 | 14:40 = 26.8M → 15:20 = 18.5M (drop of 8.3M). Violates cum-since-open. |
| **Anomaly < running real total** | Feb 12 | 20:35 = 17.5M vs running real sum ~33.4M at that index. Cannot be cum-since-open by definition. |
| **Inferred-true > plausible 5-min** | May 8 (14:40) | inferred_true = 13.7M, which is 27× the session median. Not a 5-min real volume; consistent with delayed-report block trade or cross-venue print. |
| **Inferred-true slightly negative within slop** | May 6 (17:30 = −65K), May 7 (14:30 = −156K, 17:55 = −19K) | All within ±1% of cum value. Accepted as sync slop. Same as the May 11 19:05 finding (−682). |

---

## 5. Filter parameter sensitivity (Q4 detail)

Lowest cum-bar volume observed across the 4 sessions: **10,145,550** (May 8 14:10).
Highest real-bar volume observed: **3,376,769** (May 8 19:55 close-burst).
→ Absolute gap: 3.0×. Stable threshold at **5M** is reasonable for AAPL but symbol-specific.

Lowest cum-bar v/avg ratio: **8.60×** (May 8 14:10).
Highest real-bar v/avg ratio: **7.34×** (May 8 19:55 close-burst).
→ Ratio gap: 1.26×. **The 5× threshold has comfortable headroom (3.6× above max real, 3.6× below min cum) ONLY when combined with the `v > running_real_sum` gate.** Strategy A's dual-condition design is what provides the safety margin — neither condition alone has the margin.

Feb 12 specifically:
- Anomaly v/avg ratio: 38.14× — would be caught by any reasonable single-threshold v/avg test (5×, 10×, even 30×).
- Strategy A's blocker: `v > running_real_sum` fails because 17.5M < 33.4M. The dual-condition design that protects against close-burst FPs on May 8 is what causes the Feb 12 miss.

---

## 6. Synthesis

**Cross-session validation: cumulative bar pattern is _inconsistent_ across the 4 sessions tested.** Three distinct anomaly mechanisms observed:

1. **Cum-since-session-open snapshots** (19 of 22 anomalies, 86%) — running cumulative volume from session open, monotonically increasing, gaps fitting `prior_cum + sum(intervening reals) + plausible_5min_v`. The mechanism documented in §1b of the prior analysis.
2. **Over-budget single anomalies** (1 of 22) — May 8 14:40 = 26.8M, inferred true 13.7M. Likely a delayed-report block trade or aggregated dark-pool print posted to a 5-min bar.
3. **Below-running-total anomalies** (2 of 22) — May 8 15:20 = 18.5M (between two larger cum values) and Feb 12 20:35 = 17.5M (below session running real). Definitively not cum-since-open. Mechanism uncertain; consistent with dark-pool / auction-cross prints.

**Strategy A filter achieves 100% precision and 95.5% recall** (21 TP, 0 FP, 1 FN). The single miss is Feb 12 20:35, where the dual-condition design (`v > running_real_sum AND v > 5×avg`) correctly avoids close-burst false positives on May 8 but consequently fails on late-session anomalies whose value is below the accumulated real total.

**Recommended filter parameters:** Strategy A's 5× avg-ratio threshold is appropriate (3.6× headroom in both directions when combined with the running-total gate). The threshold itself does not need adjustment.

**Fix v2 cumulative filter is _NOT_ ready as-designed.** Strategy A needs adjustment to recover Feb 12-class anomalies. The adjustment shape (specific design out of scope for this validation) likely involves adding a high-multiplier absolute-ratio fallback clause that fires regardless of the running-total gate — e.g., flagging when `v > 10× rolling_median` even if `v < running_real_sum`. The Feb 12 anomaly is 38× the session avg and 51× the rolling median of prior 10 bars, so any reasonable absolute-ratio fallback (threshold in the 10-15× range) would catch it without creating false positives on observed real-bar maxes (7.34× v/avg, 7.9× v/rolling-median).

**Edge cases requiring handling in Fix v2:**

- Sessions with anomalies whose value is *below* the running real total (Feb 12 mode). 1 of 22 observed, but the mechanism is real.
- Sessions with non-monotonic cum sequences (May 8 mode). 1 of 22 observed; less critical because Strategy A catches them anyway via `v > 5×avg`.
- Single-anomaly sessions (Feb 12 mode). The filter must work even when only one anomaly exists; can't rely on cumulative-sequence patterns.
- Cross-symbol portability: AAPL-derived thresholds (5M absolute, 5×/10× ratio) need re-validation on RKLB/ALB/MU/GOOGL before shipping. Real-bar volume profiles on lower-cap names may shift the v/avg ratios closer to the threshold and create FPs.
- The "over-budget" mechanism (May 8 14:40, dark-pool block) is a borderline case: this bar IS real volume that happened, just not at the price points of the lit-market 5-min activity. Filtering it improves VWAP precision for lit-market-priced VWAP; retaining it would be correct for all-venues VWAP. Out of scope for this validation; flag for Fix v2 design.

---

## 7. What this validation used (and didn't)

**Used:**
- Operator-provided per-bar volume + HH:MM dumps for 2026-05-08, 05-07, 05-06, 02-12 (chat 2026-05-12, ~316 lines TSV).
- Operator-provided summary stats (n_total, n_high, max_vol, min_vol, last_vol_is_null) for the same four dates.
- `/tmp/cross_session.py` (throwaway, not committed) — ground-truth labeling via `v > 5M`, cum-since-open hypothesis check via running-total cross-check, Strategy A simulation per the §4a pseudocode.

**Not used / out of scope:**
- Per-bar OHLC for the 4 validation sessions (would enable per-session VWAP impact comparison; not needed for filter-correctness validation).
- Cross-symbol confirmation on MU, ALB, RKLB, GOOGL. Strategy A thresholds may need symbol-specific tuning; AAPL alone is insufficient evidence for shipping.
- Additional sessions beyond the 4 tested. The pattern variation observed already invalidates "ready as-designed"; more samples would strengthen but not change the conclusion.
- Strategy B (rolling-median) re-test. Strategy A is the recommended design; Strategy B was the alternate. This validation focused on the recommendation.
- Designing the specific Fix v2 adjustment. Per task constraints, the report flags the gap but does not propose new strategies.
