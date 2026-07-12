# LevelStory Session 5 — Feature Layer Report

**Branch:** `claude/level-study-session5-feature-layer` (cut from the unmerged S4.1 tip `1b8b499e`; main's interim commits touch zero study files)
**Config:** `STUDY_CONFIG_VERSION = 3` (unchanged)
**Date:** 2026-07-12

---

## Executive verdict

| Item | Status |
|---|---|
| Pre-registration amendments S5-A1 (P4 → F1 vs F2) + S5-A2 (uniqueDates ≥ 15) | ✅ Recorded + wired into config and both checkpoint reporters |
| The freeze rule (pre-registration frozen forever once S6 computes an outcome) | ✅ Recorded in the rulings doc |
| 63 availability-classed features (60 pre_touch / 3 post_touch), manifest-closed | ✅ `lib/features.js:FEATURE_MANIFEST` + machine-checked closure |
| **THE LEAK TEST (§6.1)** — monster touch bar changes no pre_touch feature | ✅ **PASSES** (`tests/26`) |
| D−1 rule (daily + whole-universe market context poisoned-bar tests) | ✅ `tests/26` §6.2/§6.2b |
| ETF bar-completeness, peer windows, closure, RVOL time-matching, extension sign-normalization, own-history percentiles, 4 leg resets, null-never-zero, determinism | ✅ 25 new tests, all green |
| Suite | ✅ **130 tests: 90 pass / 40 fail — all 40 missing-data only, zero logic failures** |
| `npm run features` runner + `data/market/context_daily.json` + null-rate stats + §7 budget re-read | ✅ Built (real run founder-local) |
| **§7 post-S5 budget re-read on real data** | ⛔ **PENDING founder-local run** (no data/network in this container) |

## What was built

- `lib/features-daily.js` — HTF context (weekly/monthly stacks, 52w distances, HH/LL, ATR/compression percentiles), relative momentum (vs SPY/sector, β), the deterministic **leg lifecycle** (invalidation / deep-pullback reset / sideways reset / most-recent-wins, per `config.trend.currentLegOrigin`), `base_count`, sign-normalized **extension** + own-history percentile + NOT_EXT/MID/EXT buckets, `move_origin` + earnings timing. Every function reads indices ≤ `L = i−1`.
- `lib/features-intraday.js` — fingerprint (velocity, time-of-day-matched RVOL + pre-registered buckets, VWAP, consolidation, ToD, gap context) + momentum quality (path efficiency, acceleration, pullback depth, HL progression, OR30/extreme distances, volume slope), all from `preTouchBars` — the single boundary line. ETF direction tags with the bar-completeness rule.
- `lib/features-market.js` — the regime meter (T−21 formation, 60d rel-SPY ranking, sector-neutral demeaning, 20-session basket spread, MOMO_ON/OFF/NEUTRAL with 81-session spin-up) + breadth + beta appetite + SPY vol-regime percentile; group/peer features with the `minEligiblePeers` gate.
- `lib/features.js` — `FEATURE_MANIFEST` (the availability registry), `assertAvailabilityClosure` (machine-checkable, runs at every assembly), `assembleEventFeatures` (routing + `knownAt` stamp).
- `04-features.js` + `npm run features` — per-symbol `data/features/{sym}.json`, `data/market/context_daily.json`, `_stats.json` with per-feature null rates, and the **§7 budget re-read** (P3/P4/P6 measured cells + P1/P2/P5 base + required-class-share, every cell carrying `n`, `uniqueDates`, and the dual-floor verdict).
- S4 checkpoint reporter retrofitted with per-side `uniqueDates` (S5-A2's "every checkpoint from here forward").

## The touch-bar rule (S5 §3.2), as enforced

`touchAt` is the touch bar's open label; the bar's OHLCV is observable only at its close. **No feature reads any field of the touch bar or anything after it** — including its open (S5-C4: a touch on the session's first bar nulls every intraday feature; the S4-era opening-print allowance was dropped as leak-unsafe). The leak test poisons the touch bar + all later bars at ×1000 price / ×1e6 volume and asserts byte-identical `pre_touch` output and `knownAt`.

## Known limitations (stated, not fixed — the expansion evidence)

1. **Peer features ~100% null at 11 symbols**: max same-sector peer count is 4 (XLK) < `minEligiblePeers` 5 → every peer rate + `rs_rank_in_group` null for every symbol. The null condition is the design working; per-feature null rates print in the runner and persist in `_stats.json`.
2. **`momo_regime` not trustworthy at 11 symbols** — deciles ≈ 1 name; built correctly, tagged, flagged in the runner banner.
3. **Sector-relative features null for 6/11 symbols** (only XLK/XLE context data frozen in the probe); `sector_direction_at_touch` exists only for XLK names.
4. `peer_confirmations_same_session_before_touch` = null stub until S6. `prior_probe_count` = structural 0 (S5-C9).

## §7 — the post-S5 budget re-read: PENDING the founder-local run

This container has no `data/` and no eodhd.com network (unchanged since S4). The re-read is fully implemented and prints from `npm run features`; no counts are projected here (S4 §8 stands). **Founder-local sequence:**

```
cd research/level-study
npm test           # 130 tests; 25 new S5 suites green, 40 data-blocked failures expected to clear
npm run levels     # (unchanged artifacts; re-stamp familyAnchor if not already)
npm run events     # S4.1-corrected events + checkpoint (now with uniqueDates)
npm run features   # feature artifacts + null rates + THE §7 BUDGET RE-READ
```

The re-read will state, with measured splits: P3 (F2+ × 3 RVOL buckets × side), P6 (F2+ × EXT/NOT_EXT × side + the regime interaction under its pre-registered drop-first ladder), P4 (F1 vs F2 × side per S5-A1, F3 footnote), P1/P2/P5 base cells + the hourly-class share each side needs (S6), every cell against **n ≥ 30 AND uniqueDates ≥ 15**, plus the peer/regime null rates. Which questions survive at 11 symbols — and what expansion buys — is read from that output; the decision is the founder's.
