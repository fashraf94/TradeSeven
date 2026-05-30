# Bench-Staleness Rescore — Phase 1 STEP A Gating Findings (STOPPED before edits)

| | |
|---|---|
| **Status** | ⛔ **STOP-AND-REPORT triggered at STEP A item 2.** No production code modified. |
| **Date** | 2026-05-30 |
| **Branch** | `claude/bench-staleness-rescore` (workstream branch; stayed on it) |
| **Phase** | Phase 1 — demand-driven candidate rescore (B1–B5). **Implementation NOT started** — a gating verification fired its STOP condition. |
| **Baseline** | Full suite **green: 1573 tests / 56 files** (`npx vitest run`, after `npm install`). No edits, so this is both the pre- and post-state. |
| **Spec note** | No file named `BENCH_STALENESS_RESCORE_SPEC_V1` exists on disk (`ls` + `rg` → 0 hits). Worked from the task body's inlined B1–B5 + DO-NOT-MODIFY list and `BENCH_STALENESS_RESCORE_DISCOVERY.md` (Phase 0). |

---

## TL;DR

The rescore as specified — **B2: "rescore the price-derived dims of `baggerBombFit` for the candidate set from fresh intraday bars, re-blended with the daily fundamental dim, REUSING the existing scoring code (no new formula)"** — is **not achievable as a clean seam.** The scoring function `computeGameModeFits` is pure, but **its inputs are (a) built from long daily lookbacks and (b) cross-sectional percentile ranks over the full ~239-name universe.** Feeding a ~24-symbol intraday subset into it the "same shape" is impossible without one of the three things the task explicitly forbids (a scoring refactor, a full-universe intraday recompute, or a new formula).

Per the task's instruction — *"⚠️ STOP-AND-REPORT if the contract is anything other than a clean seam … Do NOT improvise a scoring refactor"* — I stopped before editing and am surfacing the path decision.

---

## STEP A.1 — Anchor re-verification (all CONFIRMED on current HEAD `b5793a8`)

| Anchor | Verified location | Note |
|---|---|---|
| Intraday fetch (held only) | `agent-evaluate.js:395` `fetchIntradayBatch(portfolioSymbols, { interval: '5m' })` | inside `Promise.allSettled` at `:394-402` |
| Intraday processing (held only) | `agent-evaluate.js:413-426` — `if (intradayResult … fulfilled) { for (const symbol of portfolioSymbols) … calculateVWAP / calculate5minSMA20 → momentumData.vwap[symbol] }` | **portfolioSymbols only**, confirmed |
| hotBench rebuild (gated, daily) | `agent-evaluate.js:440-448` — `isNewTradingDay = currentDay > lastEvalDay …; if (isNewTradingDay && battle.watchlist) { candidates = stockRankingsArray.filter(…).sort((a,b)=>(b.baggerBombFit||0)-(a.baggerBombFit||0)); newHotBench = candidates.slice(0,15) }` | once-per-trading-day; soft-cap 20 after equipped union (`watchlistEquip.js`) |
| Rankings write (no expiresAt) | `compute-index-intelligence.js:850-856` — `batch.set(rankingsRef, { stocks, totalTechStocks, sectors, updatedAt: FieldValue.serverTimestamp() })` | `updatedAt` only — confirmed |
| baggerBombFit weights | `rankingConfig.js:821-838` — **fund 0.10 / tech 0.70 / mom 0.20 / atrModifier +0.20** (+ technicalOverrides rsVsSpy 1.2 / sectorRS 1.3 / macd 1.5 / volume 1.4 / weekHighProx 1.3) | **upgrades the Phase-0 `[map]` to `[direct]`** — exact weights confirmed |
| Scoring fn | `gameModeScoring.js:91` `computeGameModeFits({ pillarScores, technicalFactorScores, atrPercentile, momentumData })` | pure math, no I/O — confirmed |

All four task-listed anchors and the scoring path are exactly where Phase 0 placed them.

---

## STEP A.2 — Scoring-function input contract ⛔ **THE BLOCKER** (does NOT hold as a clean seam)

`computeGameModeFits` (`gameModeScoring.js:91-138`) is pure and would happily take fresher numbers. **The problem is upstream — how its inputs are produced.** It consumes four things, none of which is a per-symbol function of an intraday session:

### (1) `technicalFactorScores` — built from LONG DAILY lookbacks, and assembled INLINE in the cron
- Assembled inline at `compute-index-intelligence.js:744-752` (a literal object, **not** a reusable function — `rg "technicalFactorScores ="` returns only this cron) from the outputs of `computeTechnicalScore`.
- `computeTechnicalScore` (`indexIntelligence.js:266-360+`) requires multi-month daily history:
  - **SMA200 / SMA50 / SMA20 position** — needs up to 200 daily bars.
  - **52-week-high proximity** — `high52w = Math.max(...highs.slice(0, Math.min(252, highs.length)))` — needs up to **252 daily bars**.
  - **Volume confirmation** — 20-day up-day/down-day volume ratio (`closes.length >= 20 && volumes.length >= 20`).
- A single RTH intraday session is **~79 five-minute bars.** SMA200 / 52w-high / 20-day-vol cannot be computed from it; feeding intraday closes here produces garbage (an "SMA200" over 79 intraday bars is not an SMA200), i.e. it **changes the meaning of the features**, not just their freshness.

### (2) `atrPercentile` — CROSS-SECTIONAL over the whole universe
- `compute-index-intelligence.js:694-704`: every stock's `atrPercent` is sorted across **all scored stocks** and the percentile is `idx / (atrValues.length - 1)`. A candidate's `atrPercentile` is **defined only relative to the full ~239-name distribution.**

### (3) `technicalFactorScores.rsVsSpy` / `.sectorRS` — CROSS-SECTIONAL ranks
- `rsPercentileMap` (`:414-416`) ranks RS-vs-SPY across **all stocks**; `sectorRSMap` (`:421-440`) ranks within each sector group. Same universe-dependence.

### (4) `momentumData.heat` — z-scored + percentile-ranked across the universe
- `computeMomentumRankings` (`momentumScoring.js:451+`) computes raw metrics per stock, then `zScoreWinsorize` / `percentileRank` **across the entire `stockDataArray`** (`:464,:489-491`). Heat is meaningless for an isolated subset.

### Why this is a hard STOP (not a wiring nuisance)
A "rescore the candidate subset" needs comparable percentiles, but **three of the four inputs are percentiles of the candidate within the full universe's distribution.** You cannot recompute them for ~24 symbols in isolation. The only ways to honor B2's "reuse the existing scoring code, no new formula" are:
1. **Re-run the full ~239-name pipeline intraday** so the cross-sectional ranks are valid → this *is* the **"full-universe intraday recompute cron" the task explicitly excludes.**
2. **Refactor `computeTechnicalScore` / the inline factor assembly** to accept intraday-derived features and shorter lookbacks → **"Do NOT improvise a scoring refactor"** (explicitly forbidden), and it would also redefine the features.
3. **Invent an intraday feature→score mapping** for the candidate subset → **"no new formula"** (explicitly forbidden).

There is no fourth door that keeps the existing shape. **Both halves of the task's disqualifier are present:** the inputs are *deeply coupled to the daily pipeline* (long lookbacks) **and** *cross-sectional* (universe-wide percentiles). → **STOP.**

### Corroborating facts
- `stockRankings` persists **scalars only** (`baggerBombFit`, rounded `atrPercentile`, mirrored factor sub-scores) — `compute-index-intelligence.js:770-802`. The **raw bars and the intermediate `technicalFactorScores` are not retained**, so a cheap "re-blend from stored inputs" is also unavailable.
- `agent-evaluate.js` has **no daily-OHLCV path for candidate symbols** wired for scoring — `getStockAnalysisData(…, fields:['daily','price'])` is used for held/price purposes (`:255,:496,:933,:1592`), not to re-run the technical+momentum+RS pipeline per candidate per tick.

---

## STEP A.3 — API budget (reported for completeness; SECONDARY to the A.2 block)

- **Billing = per-symbol HTTP call.** `fetchIntradayCandles` (`marketDataCache.js:632`) issues **one `GET /intraday/{symbol}`** per symbol. `fetchIntradayBatch` (`:723`) runs `CONCURRENCY=5` with a 200 ms inter-batch pause. **The intraday path is UNCACHED** (unlike the cached daily `getStockAnalysisData`) — every tick re-hits EODHD.
- **Sizing.** Held ≈ 5/battle → held ∪ candidates ≈ **24/battle** (5 held + 3 bench stocks + 1 bench crypto + up to 15 hotBench). Agent ticks every 15 min over 13–21 UTC ≈ **~32 ticks/session**.
  - **Per battle, undeduped:** ~24 × 32 ≈ **~768 intraday calls/day** (vs ~160 today) — a **~4.8×** increase.
  - **Deduped across battles (required, and the task asks for it):** candidates are drawn from the *shared* `stockRankings` universe, so hotBench overlaps heavily; the true cost floor is `(unique candidate symbols across all active battles) × ~32 ticks`. The unique candidate set is plausibly **50–150 names** → **~1,600–4,800 intraday calls/day** on top of the held fetches.
- **Verdict:** every-tick, uncached rescore of the candidate set is a **material multiplier** on intraday API volume. On its own this would warrant the task's *"choose a tolerance fallback rather than improvise"* path. **But it is moot here** — A.2 already blocks the implementation regardless of budget.

---

## What I did NOT do
No production file was edited. No new branch. Baseline suite run only (read-only). This report is the only new file.

---

## Options for the path forward (the decision the task reserved — none chosen here)

The honest situation: **demand-driven candidate rescore that "reuses the existing scoring code" is incompatible with how that code computes scores** (long daily lookbacks + universe-wide percentiles). The discovery's seam (a)/(b) was real for *wiring the bars in*, but the *scoring math on the other side of the seam* is daily-and-cross-sectional. Plausible directions, with their tradeoffs:

1. **Pivot the rescore mechanism to a partial-universe intraday recompute** (Phase-0 option B): on a sub-daily cadence, re-run the **full** technical/momentum/RS pipeline with the latest *daily-shaped* bars updated by the current session, so the cross-sectional ranks stay valid, then re-derive `baggerBombFit`. This is heavier and was named "excluded" for *this* phase — so it's a **scope/spec decision**, not something to improvise.
2. **Pivot to the freshness-weighted-hurdle mechanism** (Phase-0 option C): leave `baggerBombFit` daily; fold ranking *age* into the swap hurdle (needs only the §7.2 `computedAt`/`expiresAt` stamp). Small blast radius; fixes the *hurdle*, not the *candidate menu* ordering — a different shape of fix than B1–B3 describe.
3. **Define an explicit intraday rescore formula** (a *new*, deliberately-specified blend of intraday price features, separate from the daily `computeGameModeFits`) — i.e., amend the spec to *allow* a new formula. This is the only way to keep "rescore the ~24 candidates cheaply, every tick," but it contradicts the current "no new formula / reuse existing code" constraint, so it needs explicit sign-off.
4. **Ship only B5 (the freshness stamp) now** as a safe, in-scope sliver (add `computedAt`/`expiresAt` to the rankings write), and route B1–B4 back to design with this finding.

**These are surfaced, not chosen.** The task said *"we'll choose a tolerance fallback rather than improvise"* for the budget case; the scoring-contract block is the larger one and similarly needs your call on which mechanism the spec should actually target.
