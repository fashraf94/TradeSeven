# Bench Staleness Verification — Findings Report

**Status:** Discovery complete. **Outcome C (real gap).** Reopens the launch-blocker chain.
**Date:** 2026-05-29
**Branch:** `claude/bench-staleness-verification`
**Author / role:** Claude Code (implementation/discovery role, per `AI_ASSISTED_INFRASTRUCTURE_PLAYBOOK.md`)
**Spec:** `BENCH_STALENESS_VERIFICATION_TASK.md` V1.1 (six questions §4.1–4.6; three outcomes §6.1–6.3; behavioral test §4.6 added per ChatGPT critique #15)
**Type:** Investigation only — no production code written or modified.

---

## ⚠️ Data-access constraint (read this first)

This investigation ran in an ephemeral sandbox with **no Firebase/EODHD credentials**. Consequences, and how each was handled:

- **Cadence / code / structure (§1, §2, §4, §5):** answered fully from code + tests, with `file:line` verification anchors. No live data needed.
- **Behavioral impact test (§5):** **Path A (real swap moments) is infeasible** — no Firestore creds, evaluation records do not persist the ranking snapshot the agent saw (`agent-evaluate.js:1251-1283`), and historical ranking scores aren't retained. So **Path B (simulated)** was used, but executed through the **real production ranking code** (imported from `api/_utils/`), in a throwaway harness at `/tmp/bench_staleness_harness.mjs` — **not committed**; only this report commits. Results are flagged as simulated throughout.
- **Live SPY intraday pull (drift-grid calibration):** **attempted and blocked** — `curl https://eodhd.com/api/intraday/SPY.US?...` returned **HTTP 403 "Host not in allowlist"** (environment network policy; also no `EODHD_API_KEY`). The drift grid is therefore **estimated**; the live calibration is logged as a §7 hand-off.
- **Cron-failure frequency (§3.3 failure modes):** cannot be measured from the sandbox; routed to a §7 hand-off.

---

## Executive summary

| Question | Finding (one line) |
|---|---|
| **4.1 — Refresh cadence** | The agent's rankings doc `indexIntelligence/stockRankings` is written **once per weekday, pre-market** by `compute-index-intelligence.js` (`30 10,11 * * 1-5` UTC) from **end-of-day** data. No intraday refresh. |
| **4.2 — Tick cadence** | The agent evaluates every **15 min during the regular session only** (`agent-evaluate.js`, `*/15 13–21 * * 1-5` UTC, gated by `isMarketOpen()` = 9:30 AM–4:00 PM ET). Fixed; no mode variation. |
| **4.3 — Staleness window** | **Large.** Computation age **~2.0 h → ~9.25 h** within a session; underlying-data age **~17.5 h → ~24 h**. Silent failure modes reach **26–33 h / ~48 h**. |
| **4.4 — Source freshness** | **No.** Every bench-feeding field is end-of-day (EODHD daily bars + EOD fundamentals). The freshest the rankings can be is the **prior session's close**. |
| **4.5 — Per-tick rescoring** | **Absent.** The agent reads the precomputed doc and acts on stored values (`agent-evaluate.js:392-394, 432-433, 444`); the only per-tick live fetch is intraday prices for **held positions** (`:393`), never the rankings. |
| **4.6 — Behavioral impact test** | **FAIL.** Selected-swap-candidate change rate = **31–64%** across the drift grid; **43.3% at the realistic ±5% anchor**; **≥20% even when conditioned on a comfortable margin** at ±5%. |
| **Determination (§6)** | **Outcome C — real gap.** ≥20% behavioral change **AND** large staleness window. **Reopens the launch-blocker chain (spec §9.6).** |

**Headline:** Bench staleness is a **real behavioral problem** for BaggerBomb, not just a cadence note. The hotBench selection key (`baggerBombFit`) is **~90% price-derived** (`rankingConfig.js:821`) yet refreshed only once daily, pre-market, from end-of-day data, with **no per-tick rescoring** — so intraday price moves reshuffle the agent's swap target on **>40%** of realistic-drift swap moments. Per spec §6.1, Outcome A required *both* a bounded window *and* per-tick rescoring; **neither holds**, so A was ruled out before the behavioral test even ran. The test then distinguishes B from C, and the rate is ≥20% across the entire plausible drift range. **A design session is needed (spec §6.3).**

---

## Section 1 — Bench refresh cadence (§4.1)

The document the trading agent actually reads for rankings is **`indexIntelligence/stockRankings`** (not `peerRankings`/`sectorRankings`). It is written by a single daily pre-market cron.

| Item | Finding | Anchor |
|---|---|---|
| Writer | `compute-index-intelligence.js` → `db.collection('indexIntelligence').doc('stockRankings').set({ stocks, totalTechStocks, sectors, updatedAt })` | `compute-index-intelligence.js:850-856` |
| **Schedule** | **`"30 10,11 * * 1-5"`** — 10:30 **and** 11:30 UTC, weekdays | `vercel.json:133-136` |
| ET equivalent | EDT: 6:30 & 7:30 AM ET; EST: 5:30 & 6:30 AM ET — **always pre-market** (open is 9:30 AM ET). Header: "Idempotent — running twice overwrites the same Firestore docs." | `compute-index-intelligence.js:1-5` |
| Operative write | The **11:30 UTC** run is authoritative (overwrites the 10:30 run). | `:861` `batch.commit()` |
| Upstream | Fundamental ranks (`fundamentalRank`/`Score`) are mirrored from `peerRankings/*`, written by `compute-rankings.js` at **`"0 11 * * 1-5"`** (11:00 UTC). | `vercel.json:53-56` |
| Cadence | **Once per weekday, pre-market. No intraday refresh; no mode/market-hours variation.** | schedule strings |
| Scope | Full equity `STOCK_UNIVERSE` (~239 names / 11 sector groups); doc carries a `stocks[]` array + `totalTechStocks` + `sectors`. | `:836-856`, `rankingConfig.js` (`STOCK_UNIVERSE`/`ALL_TICKERS`) |

Each `stocks[]` entry (`:767-802`) carries `compositeScore` (sort key), **`baggerBombFit`** (the hotBench selection key — §5), `atrPercentile`, `momentumScore`, `bBandwidthPercentile`, `nr7Flag`, `trend`, `momentum`, and per-archetype `arch_scores` — all recomputed once per morning from EOD inputs.

---

## Section 2 — Agent tick cadence (§4.2)

| Item | Finding | Anchor |
|---|---|---|
| Decision loop | `processAgentBattle()` — one battle per call, idempotency-locked (`cronState.evaluatingAt`) | `agent-evaluate.js:157`, `:160-167` |
| **Schedule** | **`"*/15 13,14,15,16,17,18,19,20,21 * * 1-5"`** — every 15 min, hours 13–21 UTC, weekdays | `vercel.json:137-140` |
| Market gate | `if (!isMarketOpen()) return { skipped, reason: 'market_closed' }` | `agent-evaluate.js:95-99` |
| `isMarketOpen()` | **Regular session only: 9:30 AM–4:00 PM ET** (1:00 PM early-close days), Mon–Fri, non-holiday. No pre/post-market, no crypto-extended hours. | `marketSchedule.js:124-141`, constants `:17-23` |
| Effective window | **9:30 AM → ~3:45 PM ET** (last `*/15` tick before the 16:00 close). EDT: 13:30→19:45 UTC; EST: 14:30→20:45 UTC. | gate + schedule |
| **Variation by mode** | **None.** Fixed 15-min for every battle regardless of `duration` (fullday/1d/3d/5d), `strategyPreset`, or archetype. The only per-tick modulation is a `TIME_BUDGET_MS` guard deferring *some battles* to the next tick — it doesn't change the interval. | `:108-115` |

---

## Section 3 — Staleness window (§4.3) + source freshness (§4.4)

### 3.1 Two clocks

- **Computation age** = decision time − last `stockRankings` write (11:30 UTC). The spec's literal §3 definition.
- **Data age** = decision time − timestamp of the market data the rankings *reflect* (the prior session's close, since the morning compute runs before today's open).

The §5 behavioral test's "fresher rankings" counterfactual uses the **data-age** perspective — "fresher" means recomputing the price-derived dimensions with *current intraday prices* instead of the prior close.

### 3.2 Nominal window (both morning runs succeed)

```
COMPUTATION AGE = decision_time − 11:30 UTC
  open (9:30 ET):    EDT 13:30−11:30 = 2.0 h | EST 14:30−11:30 = 3.0 h
  last tick (15:45): EDT 19:45−11:30 = 8.25 h | EST 20:45−11:30 = 9.25 h
  → ~2.0 h → ~9.25 h

DATA AGE = decision_time − prior_session_close (T−1 16:00 ET)
  open (9:30 ET day T):   17.5 h
  last tick (15:45 ET T): 23.75 h
  → ~17.5 h → ~24 h  (price-derived dims; fundamentals can be a quarter old)
```

Both clocks are **≫ 30 min at every tick of every session**. The window is **not bounded** — rankings are computed once, pre-market, and never refresh during the 6.5-hour session.

### 3.3 Failure-mode windows (silent — no staleness guard)

- **11:30 UTC run fails/delayed →** the 10:30 UTC doc stands. Because `compute-rankings` writes fresh `peerRankings` only at 11:00 UTC, the 10:30 run read the **prior day's** fundamental ranks → the agent runs the session on **mixed-vintage rankings** (today-morning technicals on T−1 close, but fundamentals a day staler). Silent.
- **Both morning runs fail →** the write carries **no `expiresAt`** (`compute-index-intelligence.js:851-856`), so the doc retains the **prior day's** `stockRankings`: computation age → **~26–33 h**, data age → **~48 h**. Silent. This is §4.3's theoretical maximum. (Frequency of these failures is unverified — §7 hand-off.)

### 3.4 Source freshness (§4.4) — the source does not produce intraday-fresh data

| Field group | Source | Freshness | Drifts intraday if recomputed? |
|---|---|---|---|
| Prices → RS, technical factors, ATR, SMA-distance, momentum | EODHD **daily OHLCV** (`compute-index-intelligence.js:390, 399-407`) | prior **close** | **yes** (price-derived) |
| `pillarScores` → fundamental ranks | `peerRankings` (EODHD `/fundamentals/`, 24 h cache) | EOD/quarterly | no |
| `baggerBombFit`, `compositeScore` | blend of the above | EOD | partially (via price-derived inputs) |

**Verdict (§4.4): No.** The freshest the rankings can ever be is the prior session's close. Notably, intraday prices *do* exist in the system — the agent fetches 5-min bars every tick for **held positions** (`agent-evaluate.js:393`) — they are simply **never fed into the rankings** (see §6 — this makes the Outcome-B-style mitigation cheaper).

---

## Section 4 — Per-tick rescoring (§4.5)

**Verdict: definitively ABSENT.**

| Evidence | Anchor |
|---|---|
| Per tick, reads the precomputed doc: `db.collection('indexIntelligence').doc('stockRankings').get()` | `agent-evaluate.js:394` |
| Consumes the stored array verbatim: `stockRankingsArray = rankingsResult.value.data()?.stocks \|\| []` | `:432-433` |
| hotBench rebuilt by sorting the **stored** `baggerBombFit` — no recompute | `:442-444` |
| The only per-tick live fetch — `fetchIntradayBatch(portfolioSymbols, {interval:'5m'})` — feeds VWAP/SMA20 for **held positions** (triggers/P&L), not rankings | `:393`, `:412-424` |

This independently kills Outcome A (spec §6.1 credits "existing cadence **+ per-tick rescoring**"; the rescoring does not exist).

---

## Section 5 — Behavioral impact test (§4.6)

### 5.1 Method

Path B (simulated swap moments) executed through the **real** production ranking code, imported from `api/_utils/` (no Firebase):
- `computeGameModeFits` → `baggerBombFit` (`gameModeScoring.js:91`), real `baggerBomb` weight profile (`rankingConfig.js:821`: **fund 0.10 / tech 0.70 / mom 0.20 / atr +0.20** → **~90% price-derived**)
- `computeTechnicalScore` (`indexIntelligence.js:266`), `computeMomentumRankings` (`momentumScoring.js:451`), `calculateSMA/RSI/MACD/ATR`, `computeRS/RSTrend`
- The `technicalFactorScores` / `atrPercentile` assembly replicates `compute-index-intelligence.js:744-752, 698-700, 494-506` exactly.

**`buildSyntheticUniverse()` was NOT used** — it is a 7-stock fixture with hardcoded `baggerBombFit` and no price series (`compute-index-intelligence.test.js:72-85`), unusable for drift. The harness builds its own **input-bearing** universe (assumptions exposed below):
- 45 single names / 5 sectors, each a 260-bar daily-OHLCV GBM; per-stock annualized vol ~U(25–80%) (BaggerBomb candidates skew high-vol); trend μ~N(0, 9e-4); 8 fundamental pillars ~U(20–90), **held fixed** across stale/fresh.
- **Drift** (the staleness counterfactual): "fresh" prepends one intraday bar; stock *i* moves δᵢ~N(0, L), SPY by N(0, 0.5L), sectors by N(0, 0.6L), L∈{2,5,15,30}%. Moves are **mean-zero with cross-sectional dispersion** — a uniform shift wouldn't change relative rankings; the dispersion does.
- **Drift grid is estimated**, not measured (live SPY pull blocked — §7). The realistic-central anchor is **±5%** (a typical full-session move for a volatility-skewed bench candidate); ±2% is a calm floor, ±15%/±30% are catalyst/extreme.
- **Metric (spec §4.6):** P(the **selected** swap candidate — top `baggerBombFit` over hotBench∪bench, per `agent-evaluate.js:442-446` + `agentSwapExecution.js:36-41`) changes stale→fresh. 30 moments × 3 seeds. **Pass <20%; Fail ≥20%.**

### 5.2 Results — verification anchor (raw harness output)

```
Drift |  selected-cand change (mean [range])  | top3 change | exec-swap change | hotBench turnover/15
----------------------------------------------------------------------------------------------------
2%    |   31.1%  [23.3%–40.0%]                |  85.6%    |  31.1%         | 1.7/15  <-- >=20% threshold
5%    |   43.3%  [36.7%–53.3%]                |  93.3%    |  43.3%         | 2.3/15  <-- >=20% threshold
15%   |   58.9%  [53.3%–70.0%]                |  94.4%    |  58.9%         | 4.3/15  <-- >=20% threshold
30%   |   64.4%  [63.3%–66.7%]                | 100.0%    |  64.4%         | 5.7/15  <-- >=20% threshold

stale #1-vs-#2 baggerBombFit margin (mean): 4.7 pts  |  eligible candidates at fit>=98 (mean): 0.6
selected-cand change rate CONDITIONAL on a comfortable stale margin:
  L=2% : margin>=3pts -> 21.1% (n=56)  |  margin>=5pts -> 16.4% (n=42)
  L=5% : margin>=3pts -> 29.8% (n=56)  |  margin>=5pts -> 23.9% (n=42)
```

**Example swap moments — SYNTHETIC, RECONSTRUCTED from the harness (seed=1); structure runs the real `computeGameModeFits`:**
```
moment #0 @ L=5% : STALE pick S22 (baggerBombFit=99; rsVsSpy=100 macd=67 weekHighProx=33 atrPct=0.86 heat=93)
                   FRESH pick S14 (baggerBombFit=99; rsVsSpy=86  macd=100 weekHighProx=58 atrPct=0.70 heat=98)
                   → S22 re-scored to 98 under fresh data; S14 overtook it.
moment #1 @ L=5% : STALE pick S35 (baggerBombFit=99; rsVsSpy=89  macd=67 weekHighProx=83 atrPct=0.75 heat=100)
                   FRESH pick S09 (baggerBombFit=97; rsVsSpy=100 macd=100 weekHighProx=100 atrPct=0.43 heat=91)
                   → S35 re-scored to 91 under fresh data; S09 overtook it.
```

### 5.3 Interpretation (no softening)

The spec's **pass criterion (<20%) is not met at any drift level.** At the realistic **±5% anchor** the rate is **43.3%**, and it stays **≥20% even when restricted to moments where the stale #1 leads #2 by ≥5 fit points (23.9%)** — so the result is not an artifact of near-tied tops (mean #1↔#2 margin is 4.7 pts; only 0.6 candidates near the ceiling). The only sub-20% reading anywhere is the calmest-day + comfortable-margin corner (±2%, ≥5 pts → 16.4%).

This matches the **structural code fact**: `baggerBombFit` is ~90% price-derived but refreshed once daily with no per-tick rescoring, so intraday moves reshuffle the hotBench top.

### 5.4 Honest limitations

- **Drift grid estimated** (SPY pull blocked) — but the conclusion holds across the entire plausible range (31–64% unconditional). Live-SPY calibration → §7.
- **Haiku-decision proxy:** the metric uses deterministic `baggerBombFit`-argmax, isolating the *ranking-driven* component; live Haiku also weighs news/hypotheses. **Haiku-independent corroboration:** the eligible *menu* (hotBench) itself turns over **2.3/15 (±5%) → 5.7/15 (±30%)**, and `validateTradeDecision` confines swaps to hotBench∪bench (`agentSwapExecution.js:36-41`) — so the candidate set Haiku chooses from is staleness-altered regardless of how Haiku picks.

---

## Section 6 — Outcome determination (spec §5–§6)

**Outcome C — Real gap (spec §6.3).** Unambiguous.

| Spec condition | Status |
|---|---|
| Behavioral impact test ≥ 20% decision change | **Met** — 31–64% across the grid; 43.3% at ±5%; ≥20% even margin-conditioned (§5). |
| Staleness window is large | **Met** — ~2–9.25 h computation age, ~17.5–24 h data age, no per-tick rescoring (§3, §4). |

Per spec §6.1, **Outcome A was ruled out structurally** (it requires a bounded window *and* per-tick rescoring; neither holds). The window being large means the determination reduces to B vs C — and the behavioral rate is ≥20% across the plausible range → **C, not B.**

**Consequence (spec §9.6):** pre-launch design completion is contingent on this returning A or B. It returned **C**, which **reopens the launch-blocker chain**. A design session is needed.

### 6.1 Design-session inputs (spec §6.3 mechanism options)

The spec names three mechanisms to evaluate; the discovery shapes their option space:

1. **Tick-rate-aware refresh** — recompute (or partially recompute) `stockRankings` on a cadence closer to the agent's 15-min tick instead of once pre-market.
2. **Staleness-weighted hurdle** — fold the rankings' age into the mb-12 swap hurdle so the agent demands more conviction as the snapshot ages (ties directly back to mb-12's "use it or lose it").
3. **Demand-driven bench rescore** — rescore only the hotBench∪bench candidate set at decision time, rather than the full ~239-name universe.

**Partial infrastructure already exists (shapes the option space):** the agent **already fetches intraday 5-min bars every tick — but only for held positions** (`agent-evaluate.js:393`), and never feeds them into the ranking pipeline. Extending that existing fetch to the bench/hotBench candidates and recomputing the **price-derived** factors (the ~90% of `baggerBombFit` that drifts) is the natural, low-cost form of option 1/3 — the data-ingestion path is built; only the feed-back into the ranking math is missing. This makes an Outcome-B-style "per-tick rescore of fast-moving features" meaningfully cheaper than building ingestion from scratch.

---

## Section 7 — Open questions, hand-offs, and orthogonal findings

### 7.1 Verification hand-offs (sandbox could not reach the primary source)

1. **Live-SPY-pull drift-grid calibration.** The ±5% anchor is estimated; the live pull was blocked (HTTP 403 "Host not in allowlist"; no `EODHD_API_KEY`). *Hand-off:* run one `GET /api/intraday/SPY.US?interval=5m` (the endpoint the calibration discovery confirmed works) to measure the SPY intraday-range median/p90/p99, scale to single-name candidates, and re-confirm the anchor. The outcome (C) is robust across 31–64% so this refines, not overturns, the call.
2. **Cron-failure frequency for the §3.3 failure modes.** The 26–33 h / ~48 h windows assume a missed/failed morning compute. **The product owner reports no observed failures in ~8 weeks of DRB usage — but this is NOT verified against cron logs.** *Hand-off:* confirm against Vercel cron execution logs / Firestore `updatedAt` history on `indexIntelligence/stockRankings`.

### 7.2 Systemic gap (documented, not solved)

3. **No `expiresAt` / no staleness guard on `indexIntelligence/stockRankings`** (`compute-index-intelligence.js:851-856`). The agent cannot detect a stale or mixed-vintage doc; it consumes whatever is there. This underlies both §3.3 failure modes and the dual-slot inversion below. (`compute-rankings` sets a 26 h `expiresAt`; `stockRankings` sets none.)

### 7.3 Orthogonal findings (surfaced per Phase 0 discipline; not investigated further)

4. **Dual-slot timing inversion.** `compute-index-intelligence` runs at 10:30 **and** 11:30 UTC ("DST coverage"), but `compute-rankings` writes fresh `peerRankings` only at 11:00 UTC — so the 10:30 run necessarily folds in the prior day's fundamentals. Benign in the normal case (the 11:30 run overwrites it), but it is the mechanism behind failure-mode 1 in §3.3.
5. **Crypto-hours gap.** Battles holding crypto have `localClose` 20:00 ET, but `isMarketOpen()` is equity-regular-hours only (`marketSchedule.js:124-141`) — so the agent does **not** evaluate crypto positions in the 4:00–8:00 PM ET window even though the battle is "open" for crypto.

---

## Appendix — Outcome determination (spec §6)

| Item | Spec outcome | Why |
|---|---|---|
| Bench staleness (BaggerBomb) | **C — Real gap** | Behavioral test ≥20% at every plausible drift level (43.3% at ±5%; ≥20% margin-conditioned) **AND** large staleness window (~2–24 h, no per-tick rescoring). |
| Outcome A | **Ruled out** | Requires a bounded window *and* per-tick rescoring (§6.1); the window is large (§3) and rescoring is absent (§4). |
| Outcome B | **Ruled out** | B is "large window but <20% change"; the change rate is ≥20% across the plausible range (§5). |
| Launch sequence | **Reopens (spec §9.6)** | Pre-launch design completion was contingent on A or B; result is C → design session required (§6.1 mechanisms). |

*End of report.*
