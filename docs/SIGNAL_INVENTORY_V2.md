# Signal Inventory Verification — Read-Only Discovery — **V2**

**Date:** July 25, 2026
**Supersedes:** V1 (same date, delivered earlier this session). V2 folds in a completed 16-agent adversarial cross-check plus targeted re-verification. **Four V1 claims are corrected — they are marked ⚠ CORRECTED FROM V1 and listed together in §12.** Read V2 only; V1 is superseded in full.
**Scope:** SIG-mint read gating compat-cell authoring for the technical, fundamental and institutional rule families, plus the C-12 battle-state field verification.
**Type:** Read-only. No code written, no branch work, no commits. Project state untouched.

---

## Preamble — session record (BUILD_RULES §3)

| Item | Value |
|---|---|
| `git fetch origin` | **Run first**, before any remote comparison. Brought `main` `57b36dde..a04a291d` + 3 new branch refs. |
| Branch | `claude/signal-inventory-verification-u5c0lv` (the designated branch) |
| HEAD SHA | `a04a291d11ef47cbba62ffdb33f193d5177d4a59` |
| `origin/main` | `a04a291d` — **identical** |
| Tree | **Clean** (`git status --porcelain` empty) |
| History inspection | **Recorded per §3** — read-only history inspection was used to date the season-cron de-registration (`git show d80aee25`, `git show d80aee25^:vercel.json`). The clone is shallow (233 commits); no `--unshallow` was needed. No project state altered. |

**Provenance note on "Guide C-10/C-12".** At HEAD these do not exist in the repo: `docs/ARCHETYPE_PHASE3_AMENDMENT_C_V1_0.md` (V1.1) runs **C-1 … C-7** and terminates; repo-wide search for `C-10`/`C-12` in Markdown returns **zero hits**. They are items in a founder-side revision not yet committed. When they land, cross-check the SIG ids minted here against their final wording.

---

## 1. Executive verdict

| # | Question asked | Verdict |
|---|---|---|
| 1 | Fundamental sub-metrics | **Premise REFUTED.** ~20 sub-metrics are computed and persisted on `peerRankings/{ticker}` — **a document no agent path reads.** Real and unreachable. Only the composite crosses. |
| 2 | Technical [U] signals | **Mixed.** `technicalScore`, `highProximity`, sector RS, sector peer rank, Bollinger %B all **MINTED**. VWAP-as-selection, σ-bands, VWAP reclaim, 5-min RSI/MACD, intraday range position all **ABSENT** — several named in the eval prompt's own prose while never supplied. |
| 3 | Institutional / 13F runtime | **NOT absent — the opposite, and this is the single biggest correction in the read.** Live EODHD pipeline, cron-registered, two collections, read by two agent prompts. **The ten `ins_` rules are NOT permanently blocked.** Caveats: activation gate, board is blind, **shortlist is selected institutionally blind**, **insider/Form 4 ABSENT**. |
| 4 | FantasyTimes binding | **REAL and wired** as prose. Coverage hard-capped at **10 tickers / 2 stories / 120-min window**. Tournament agents are *not* end-to-end blind — only the board-ranking stage is. |
| 5 | Earnings + macro calendars | **Both exist as data; neither reaches an agent as structured fact.** Earnings dates reach only the **dormant** season path. A real hand-maintained macro calendar exists but terminates in a prose line in the agent-chat prompt. |
| 6 | Beta | **EXISTS** — but only in the **dormant** season context. Absent from every path that actually runs. |
| 7 | C-12 battle-state | **8 of 10 confirmed**; `score-vs-par` and `hold duration` ABSENT. |

### The five findings that most change authoring

**A. There is no single "the eval context" — there are FOUR assembly paths carrying different fields.**

| Path | Assembler ← caller | Carries |
|---|---|---|
| Battle eval / swap | `agentEvalPromptAssembly.js` ← `agent-evaluate.js` | technicals, bench block, institutional, triggers, regime — **no fundamentals beyond the composite, no beta, no earnings** |
| BaggerBomb portfolio construction | `agentPromptAssembly.js` ← `decide.js:370,475` | market CSV incl. **FUND** column; the **only** caller of `buildInstitutionalBlock` (`decide.js:483`) |
| Tournament draft board | `tournamentAgentBoards.js` | CSV only — **institutionally blind** |
| Season daily eval | `seasonEvalContext.js` ← `season-daily-evaluate.js` | beta, P/E, market cap, next-earnings-date — **but see finding E: this path does not run** |

**Every cell must name its path.**

**B. The product instructs models — and lets users configure rules — against signals that are never supplied.** Three independent surfaces:
- **Eval system prompt prose:** "5min RSI" ×7 (`agentEvalPromptAssembly.js:159,162,386,389,397,573,700`), "1 std below VWAP" (`:162,:389`), "BB width 5th pctl" (`:195,:421`), plus S5 "News-Catalyst Momentum" (`:167-173`, `:394-400`) and "Squeezes on bench stocks suggest swap opportunity" (`:138`).
- **Equipped Forge rule text**, rendered verbatim into both prompts via `resolveRuleText` (`agentPromptAssembly.js:93,96,314`) — a rule can *say* "avoid earnings within N days" with no earnings datum present.
- **A user-facing configuration slider.** `eventRisk.earningsAvoidanceDays` (`api/forge/compile-dimensions.js:112-116`; rule `se-04`, integer 0–10, default 3) renders the directive *"Avoid stocks within N trading days of earnings announcements."* (`src/utils/dimensionMapper.js:1277-1278`), and `fomcDefensive` renders *"Reduce high-beta exposure in the days before Fed / CPI releases."* (`:1280-1282`) — **while no earnings date, no FOMC date, and no beta reaches the battle agent.**

This is the §9 display-agreement failure one level up. **Prompt prose and rule text are not evidence of a signal.**

**C. The battle agent cannot see any fundamental SUB-METRIC — but two fundamental COMPOSITES do cross.** `agent-evaluate.js` reads exactly `stockTechnicalScores/{sym}` (`:885`) and `indexIntelligence/stockRankings` (`:889`) — never `peerRankings`. **This is why SIG-003 verified only the composite.** What crosses is:
1. **`fundamentalScore`** — mirrored at `compute-index-intelligence.js:1000`, rendered as the `FUND` column (`agentPromptAssembly.js:222-230`, called from `decide.js:370,475`).
2. **The eight fundamental pillars, compressed into `baggerBombFit`** — verified end to end: `peerRankings.pillars.<p>.percentile` (computed `compute-rankings.js:836-848`, written `:1342`) → `pillarScores` rebuild (`compute-index-intelligence.js:957-962`) → `computeGameModeFits` call (`:982-987`) → `computeWeightedScore(pillarScores, adjFundWeights)` (`gameModeScoring.js:97,100`) → `baggerBombFit` (`compute-index-intelligence.js:1008`) → `BB_FIT` column (`agentPromptAssembly.js:223`). The weights are knowable and worth citing: BaggerBomb runs **fundamental 0.10 / technical 0.70 / momentum 0.20** with `atrModifier 0.20`, and a **sentiment override of 1.5×** (`rankingConfig.js:820-836`, commented "short-squeeze potential + analyst upgrades"), over base `COMPETE_PILLAR_WEIGHTS` (`:692-701`).

Note the two draft-time calls are **not** equivalent: `decide.js:370` → `buildStrategySystemPrompt` (`:375`) is the **Sonnet strategy/shortlist** call; `decide.js:475` → `buildPortfolioSystemPrompt` (`:486-489`) is the **Haiku portfolio-construction** call and the only one receiving `instBlock` (`:482`). That asymmetry is the mechanism behind §2C constraint 3.

So a cell needing "quality participates here" is not empty-handed — it can cite the fundamental leg of BB_FIT **at a known 10% weight**. It simply cannot cite P/E, D/E, or any individual metric.

**D. The emergency swap path is signal-free — every signal in this inventory is bypassed on it.** `pickEmergencyReplacement` (`agentRiskManager.js:356-378`) filters bench candidates on **cooldown and asset-type only** (`:361-367`), sorts by **daily `changePercent` alone** (`:371-375`), returns `candidates[0]`. No technicalScore, no fundamentalScore, no archetype weighting, no quality predicate of any kind. Combined with `EMERGENCY_BYPASS_REASONS` clearing the hurdle (`:310`) and being excluded from the swap-window cap (`:494`), **any cell asserting swap-in quality is silently inapplicable whenever an emergency fires.** Every such cell must state its behaviour on the emergency path.

**E. ⚠ CORRECTED FROM V1 — the season EVALUATION path is code-complete but DORMANT, by deliberate de-registration.** V1 treated it as a live agent path. Verified across four independent angles (scheduler sweep, call-graph reachability, git history, and my own direct reads):

- **Zero** season entries in `vercel.json` (parsed the full file: only `framework`, `headers`, `crons`; the crons array is exactly **37** entries; no `rewrites`/`redirects`/`routes` block exists that could alias a path onto a season handler).
- **No invoker** — `executePipeline`, `settleDay`, `buildDailyLog`, `buildEvaluationContext` have **zero call sites** outside `season-daily-evaluate.js`. No GitHub Actions workflow hits them (the only scheduled workflow, `.github/workflows/main.yml:21-57`, is a warmer that curls three unrelated endpoints); `tournament-orchestrator.js` has zero season references; `firebase.json` declares no `functions` block and no `functions/` directory exists.
- **The cleanest corroboration, verified directly:** `api/cron/` holds **21** non-test handler files; **19** distinct handlers are registered in `vercel.json`. The **only two unregistered handlers in the entire directory** are `season-daily-evaluate` and `season-pit-stop-manage`.
- **Honest caveat:** both handlers accept `Bearer ${process.env.CRON_SECRET}` (`season-daily-evaluate.js:90-92`, `season-pit-stop-manage.js:58-61`), so an out-of-repo caller holding that secret could invoke them. Nothing *in the repo* does, and nothing at HEAD schedules them — but a Vercel-dashboard cron or third-party pinger is not visible from source and cannot be excluded from here. **This is the one question only the founder can close.**
- **It was scheduled, then removed.** Commit **`d80aee25`** ("Forge redesign Phase 1: new mobile workshop shell", Jun 4 2026) deleted exactly three entries, taking the cron count **40 → 37** (verified by parsing `d80aee25^:vercel.json` vs `d80aee25:vercel.json`):

  | Deleted entry | Schedule |
  |---|---|
  | `/api/cron/season-daily-evaluate` | `30 20,21 * * 1-5` |
  | `/api/cron/season-pit-stop-manage?action=open` | `0 13,14 * * 6` |
  | `/api/cron/season-pit-stop-manage?action=lockin` | `0 3,4 * * 1` |

- **This explains the stale comment.** `season-daily-evaluate.js:9-11` claims *"Triggered by Vercel Cron twice (UTC 20:30 and 21:30)"* — which is **exactly the deleted `30 20,21 * * 1-5` schedule.** The comment was true when written and was silently falsified by a UI-redesign commit. A code comment asserting a schedule is the same trap class as a spec asserting a signal, and it is the only remaining trace of the removal.

**The split that matters.** The season *product surface* is live — `api/season/create-entry.js`, `pit-stop-reply.js`, `generate-debrief.js` are user-triggered HTTP routes that execute and read persisted season state. What does **not** run is the **daily evaluation pipeline**, which is precisely where the signals live. So beta (SIG-029), next-earnings proximity (SIG-036), and the recomputation of `alphaVsSpy` (SIG-037), together with the deterministic `seasonRuleRegistry` predicates, are **never computed by any executing code at HEAD.**

**Consequence for authoring:** these are **dormant, not absent.** Cells citing them must be marked dormant-path. **Restoration is not free:** re-adding all three entries takes 37 → 40, exactly the assumed ceiling, leaving **zero** for the tournament build's BUILD_RULES §6 allowance of "at most 2" (37 + 3 + 2 = 42 > 40). The §6-recommended fix applies directly — branch the two pit-stop actions inside one handler, taking restoration from 3 slots to 2.

---

## 2. SIG-mint table (SIG-009+)

Format per Guide §5; all rows verified at HEAD `a04a291d` (`SIG-0xx@a04a291d`).

Status vocabulary extended with **`VERIFIED (unwired)`** — real and persisted, but no agent decision path reads it. The Guide's enum cannot express this and collapsing it either way would be false. **Cells may not cite an `(unwired)` row as available evidence.**

### 2A. Technical family

| verificationId | Kernel category | Verified binding | Status |
|---|---|---|---|
| SIG-009 | technical composite | **`technicalScore`** — `indexIntelligence.js:266,363`; 7 components then `Math.min(100,…)` `:379`: rsVsSpy 22 + **sectorRS 15** + sma 18 + macd 12 + highProximity 12 + volumeConfirmation 12 + rsiContext 9. Persisted twice: `stockTechnicalScores/{sym}` (`compute-index-intelligence.js:889-892`) and `stockRankings.stocks[]` (`:1003`). Draft as `TECH`, **rounded** (`agentPromptAssembly.js:226`); eval bench block, **unrounded** (`agentEvalPromptAssembly.js:1408`). ⚠ **Not sector-neutral.** | **VERIFIED** |
| SIG-010 | 52-week-high proximity (tv-11) | **`highProximity`** — `indexIntelligence.js:315-324`, buckets ≤5→12, ≤10→10, ≤20→7, ≤30→4, else 1; `factors.distTo52wkHigh` `:396` (**non-negative by construction**, not signed). `weekHighProx` mirror `compute-index-intelligence.js:971`. | **VERIFIED** |
| SIG-011 | sector relative strength (tv-14) | **`sectorRSPercentile`** — RS vs own sector ETF over 20 bars, percentile-ranked **within sector** (`compute-index-intelligence.js:631-651`, assigned `:707`); scored `indexIntelligence.js:282-284`. Reaches eval bench block (`agentEvalPromptAssembly.js:1364-1367`) **and** the learning receipt (`buildTechnicalSnapshot.js:81-84`). | **VERIFIED** |
| SIG-012 | sector peer ranking | **`sectorTechnicalRank` / `sectorTechnicalTotal`** — `compute-index-intelligence.js:1004-1005`. | **VERIFIED** |
| SIG-013 | band position | **`bbPercentB`** — eval bench block with band labels (`agentEvalPromptAssembly.js:1320-1327`); receipt `buildTechnicalSnapshot.js:58`. ⚠ Siblings **`bbUpper`/`bbLower`** are persisted (`compute-index-intelligence.js:771-772`) and on the receipt (`buildTechnicalSnapshot.js:59-60`) but **rendered in no prompt**. | **VERIFIED** (bands unwired) |
| SIG-014 | volatility compression | **`bBandwidthPercentile`** — ⚠ **cross-sectional percentile, NOT self-history.** `compute-index-intelligence.js:927-937`, persisted `:1013`, rendered `[SQUEEZE]`/`[EXPANDED]` `agentEvalPromptAssembly.js:1528-1531`. | **VERIFIED (corrected semantics)** |
| SIG-015 | up/down volume balance | **`factors.upDayVolRatio`** (`indexIntelligence.js:365-375,397`), banded into `volumeConfirmation` (`:326-350`). **A level, not a derivative.** | **VERIFIED (corrected semantics)** |
| SIG-016 | intraday VWAP deviation | `momentumData.vwap[sym] = { vwap, currentPrice, vwapDeviation, sma20_5m, sessionDate }` (`buildTechnicalSnapshot.js:103`). ⚠ **Held positions only** (`agentEvalPromptAssembly.js:1518`). **Two render channels:** the momentum snapshot (`:1524-1526`) and the `vwap_deviation` **wake trigger** at \|dev\| ≥ 1.5 with a directional verdict (`agentTriggerGate.js:115-131` → TRIGGER block `agentEvalPromptAssembly.js:933-936`). Also **persisted** to `cronState.intradayMomentum` (`agentCronState.js:39`, written `agent-evaluate.js:2673`), read back by `voice-layer-cache.js:667`. | **VERIFIED (positions only)** |
| SIG-017 | sector performance aggregate (ss-05) | **`sectorSnapshot`** — 11 sector **ETFs** × `{sector, etf, changePercent, weekChange, monthChange}` (`compute-index-intelligence.js:499-515,524`), persisted to `marketContext` (`:874`). ⚠ ETF-proxy, not a constituent aggregate. **Wired to the season rule evaluator** (`seasonEvalContext.js:190→207→287`; `seasonRuleRegistry.js:226` se-09 → `:252,:260-265`) — **dormant per finding E**. Not in the two tournament prompts. | **VERIFIED (ETF proxy; season-wired, dormant)** |
| SIG-018 | industry performance aggregate | **`industries`** rollup — median of `return1W/1M/3M/YTD/12M` + `momentumScore`, gated `MIN_INDUSTRY_SIZE` (`compute-index-intelligence.js:397-426`, built `:1088`). **Rides inside the doc both agent paths already read** — the cheapest sector-ish aggregate to expose. | **VERIFIED** |
| SIG-019 | trend / structure (bench-visible) | `trend.{shortTerm,intermediate,longTerm}` + `sma200_position` (`agentEvalPromptAssembly.js:1277-1287`), `momentum.divergence` (`:1308`), `levels`, `recentAction.lastCandlePattern` (`:1399`) — persisted `compute-index-intelligence.js:1019-1029`. | **VERIFIED** |
| SIG-020 | price-momentum acceleration | **`momentumFactors.acceleration`** — 1W vs 1M ROC (`momentumScoring.js:120-129`), weight 0.15 (`:35`); persisted via `momentumFactors` (`compute-index-intelligence.js:1017`). ⚠ **PRICE acceleration — not growth acceleration.** | **VERIFIED** |
| SIG-038 | intraday trend reference | **`sma20_5m`** — `calculate5minSMA20` (`agentRiskManager.js:238-244`), SMA20 over 20 **five-minute** candles; consumed by **TRAIL_STOP** (`:138`). ⚠ **The only intraday-timeframe indicator in the codebase.** Risk layer only. | **VERIFIED (risk layer only)** |
| SIG-039 | per-stock market regime | **`classifyStockRegime`** (`agentRegimeClassifier.js:25`, reads `stockData.factors` + `getATRRegime`) → `directional_expansion \| directional_contraction \| choppy \| distressed`. Computed for **every portfolio + bench symbol** (`agent-evaluate.js:1127-1131`), assigned `momentumData.regimes` (`:1133`). ⚠ **Asymmetry:** the `STOCK REGIMES:` prompt line maps over `assetScores` — **held positions only** (`agentEvalPromptAssembly.js:1456-1460`) — so bench regimes are computed but never rendered. The value is also stamped onto individual decision records (`agent-evaluate.js:1351,1422,1434`). | **VERIFIED (rendered for held only)** |
| SIG-040 | ATR-normalized daily move | **`benchATRMult`** = `dailyChangePct / benchATR` (`agentTriggerGate.js:102-104`), fires ≥ 0.5 (`:106`), rendered as *"{SYM} up X% today (Y.YYx ATR from daily open)"* (`:109`) into the eval TRIGGER block (`agentEvalPromptAssembly.js:932-937`). Computed **for every bench candidate**. ⚠ Three qualifications: the divisor is **`baseATR`, a percentile-derived proxy — not ATR-14 itself**; it **defaults to 2.5 when missing** (`:103`), so an absent ATR silently yields a plausible-looking multiple; and this is move÷ATR, **not ts-01's realized-range÷ATR-14**. | **VERIFIED (proxy divisor)** |
| SIG-041 | residual momentum vs SPY | **`momentumFactors.residualMomentum`** — winsorized Z of SPY-residualized momentum (`momentumScoring.js:489,553-554`), persisted on the stock literal (`compute-index-intelligence.js:1017`). **The closest real thing to a beta-adjacent market-relative measure on a path that runs.** | **VERIFIED** |

### 2B. Fundamental family — all `VERIFIED (unwired)`

All rows live on **`peerRankings/{ticker}`** (cron `0 11 * * 1-5`). **No agent path reads this collection.** Consumers: stock-detail API, Forge watchlist, cohort digest, voice layer.

| verificationId | Kernel category | Verified binding | Status |
|---|---|---|---|
| SIG-021 | valuation ratios | `metrics.trailingPE` (`compute-rankings.js:629`; clamped <0 or >500 → null `:630-632`; written `:1352`) · `priceBookMRQ` (`:637`, ≤0 → null; `:1354`) · `evEbitda` `:1351` · `priceSalesTTM` `:1353`. ⚠ Field is **`priceBookMRQ`**. **`forwardPE` ABSENT** (dead UI reader only). | **VERIFIED (unwired)** |
| SIG-022 | leverage / solvency | `debtToEquity` — genuinely computed `(shortLongTermDebtTotal ?? longTermDebt) / totalStockholderEquity` (`compute-rankings.js:434-437`), no-debt→0 (`:438-439`), written `:1363`. Siblings `currentRatio` `:1364`, `interestCoverage` `:1365`, `netDebtEbitda` `:1366`. ⚠ From the most recent **YEARLY** balance sheet (`:429-431`) — the real staleness bound is the last annual filing. | **VERIFIED (unwired)** |
| SIG-023 | cash generation | `fcfYield` = `(fcfTTM / marketCap) × 100` (`:649-650`, written `:1355`); `fcfMargin` `:1357`. ⚠ **Absolute FCF not persisted**; explicitly `null` in the season context (`seasonEvalContext.js:120`). | **VERIFIED (unwired)** |
| SIG-024 | growth | `revenueGrowthYOY` `:1344` (EODHD `QuarterlyRevenueGrowthYOY`, `marketDataCache.js:292`) · `earningsGrowthYOY` `:1345`. **Plus forward consensus growth**: `estimatesCache/latest.stocks.<t>.forwardEstimates.{currentYear,nextYear}.growth` (`compute-estimates.js:265`, assembled `:311-316`, persisted `:458`). | **VERIFIED (unwired)** |
| SIG-025 | earnings surprise history | `beatRate` `:1368` · `avgSurpriseMag` `:1369` · `surpriseConsistency` `:1370` · `avgEarningsSurprise` `:1373`. ⚠ **Four inconsistent surprise definitions exist**, two inside one function: `compute-rankings.js:527-533` uses mean-of-**ABSOLUTE** for 2–3 usable quarters and mean-of-**POSITIVE** (`:548-551`) for ≥4. No decile. | **VERIFIED (unwired, definition-inconsistent)** |
| SIG-026 | sector-relative valuation | **`pillars.<p>.dimensions.<d>.{value, rank, percentile, sectorMedian}`** — `compute-rankings.js:1309-1329`; medians computed in `rankSectorStocks` (`:902-912`), landed `:1320`. **This is the sector-average answer: medians + within-sector percentile per ranked dimension.** | **VERIFIED (unwired)** |
| SIG-027 | analyst consensus trend | `earningsRevisions` `:1372`; upstream `computeRSR` (`compute-estimates.js:210-215`), `computeEMS` (`:217-222`), `epsRevisionsUp/DownLast30days` (`:303-304`), sector revision diffusion `(up−down)/total` (`:324-349`), `emsPercentile` (**within-sector**, `:358-382`). | **VERIFIED (unwired)** |
| SIG-028 | market capitalization | `metrics.marketCap` (`compute-rankings.js:643,719,1377`). Reaches the **dormant** season context (`seasonEvalContext.js:121`). ⚠ **Raw value only — no classification buckets.** | **VERIFIED (raw value)** |
| SIG-029 | systematic risk / beta | **`fundamentals.beta`** — EODHD `Technicals.Beta` (`marketDataCache.js:294`) → `seasonEvalContext.js:123`. ⚠ **Season path only — dormant per finding E.** Answers ss-01/02/04. | **VERIFIED (dormant path)** |
| SIG-042 | numeric sentiment | **`pillars.sentiment.percentile`** (0–100) — `compute-rankings.js:843`; `PILLARS.sentiment` weight 0.15 (`rankingConfig.js:685`), dimensions **`earningsRevisions` · `avgSurprise` (field `avgEarningsSurprise`) · `shortInterest` (field `shortInterestScore`, INVERTED)** (`:646-668`) — ⚠ **estimate-revision + short-interest sentiment, NOT news sentiment.** **Reaches the draft agent** via the fully-verified BB_FIT chain in finding C, carrying a **1.5× BaggerBomb override** (`rankingConfig.js:826-828`). Siblings `shortInterestScore`/`shortRatio`/`squeezeWatch` persisted `compute-rankings.js:1374-1376` — `squeezeWatch` is the closest thing to a queryable per-ticker bullish-catalyst boolean, but is itself unwired. | **VERIFIED (reaches draft via BB_FIT)** |

### 2C. Institutional family

**Live and not stubbed.** Source: **EODHD Fundamentals** `?filter=Holders` (`marketDataCache.js:323`), equities only, ~10 API calls/request (`:318`). Cron registered `vercel.json:150-151`, `0 1,2 * * 1` — **weekly Mondays**, auth-gated `:60-66`, `maxDuration` 120 s (`:357`). Writes are **idempotent `.set()` with no history** (`:108`, `:324`) — **no institutional time series exists**; holders cache TTL is exactly 7 days (`marketDataCache.js:36`) against a weekly cron, so each run is effectively a cold fetch.

| verificationId | Kernel category | Verified binding | Status |
|---|---|---|---|
| SIG-030 | institutional conviction | **`institutionalHoldings/{symbol}.summary`** — written `compute-institutional-intelligence.js:108-115`; shape `institutionalIntelligence.js:176-191`. `computeConvictionScore` `:130-153` (passive-filtered, weighted by `change_p × totalAssets`, buckets `:146-150`). Read `agentEvalPromptAssembly.js:655`, rendered `:711-722`. | **VERIFIED (gated)** |
| SIG-031 | holder flows / fresh positions | `buyersCount`/`sellersCount` (`:163-164`) · **`newPositionsCount`** via `classifySignal(...)==='new_position'` (`:165-170`) · **`clusterBuy`** = ≥3 new positions (`:176`). Per-holder `enrichHolder` (`:197-212`). ⚠ `unchangedCount` (`:181`) is persisted but **never printed** — only reader is a UI tab. | **VERIFIED** |
| SIG-032 | transient-institution classification | **`INSTITUTION_ARCHETYPES`** (`institutionalIntelligence.js:15`) + **`getArchetype()`** (`:89-100`), exact-match then substring fallback. Classes incl. **`transient`** (`:44-51`), `index_passive`, `quantitative`, `activist`, `long_only`. ⚠ **CORRECTED FROM V1: `computeFreshness` (`:217`) is DEAD** — sole repo-wide hit is its own definition; never invoked, never imported by the cron. **There is no archetype-aware freshness decay in production.** V1 asserted this wire fires; it does not. | **VERIFIED (classification only)** |
| SIG-033 | crowding / fund overlap | `allInstitutions[name].stocksHeld` (`compute-institutional-intelligence.js:129-139`, passive excluded `:130`) · `activeHolderCount` (`institutionalIntelligence.js:633-656`). Counts, not a normalized score. | **VERIFIED (as counts)** |
| SIG-034 | institutional sector flows | **`institutionalAggregates/latest.sectorFlows`** — accumulated `:179-189`, bucketed `:268-279` (≥0.65 bullish/bearish), written `:324`; rendered `agentEvalPromptAssembly.js:734-738`, `agentPromptAssembly.js:420-424`. ⚠ **No per-symbol sector at eval time** — the flows block is a global list, so i-07 is materially weaker on the eval path. | **VERIFIED** |

> ⚠ **Four constraints binding on all ten `ins_` cells.**
> 1. **Activation gate** — `fetchInstitutionalContext` returns `null` unless an institutional-category rule is *already* equipped (`agentEvalPromptAssembly.js:643-644`; `agentPromptAssembly.js:329`). Availability is conditional on the consumer.
> 2. **Path coverage.** ✅ BaggerBomb portfolio construction (`decide.js:483` → `agentPromptAssembly.js:441,341`, rendered `:383-428`, interpolated `:206`). ✅ Battle eval/swap (`agentEvalPromptAssembly.js:987-998`, consumed `agent-evaluate.js:1932`). ❌ **Tournament draft board — BLIND** (`tournamentAgentBoards.js` has zero institutional references; `buildInstitutionalBlock` has exactly one caller repo-wide).
> 3. **The shortlist is selected institutionally blind.** `institutionalBlock` appears only in `buildPortfolioSystemPrompt` (signature `:180`, interpolation `:206`). The strategy call that *produces* `strategy.shortlist` never receives it — institutional evidence arrives **after** candidate selection, so it can only influence weighting, never admission.
> 4. **Six-field prompt ceiling + silent coverage failure.** Only `conviction, convictionScore, buyersCount, sellersCount, newPositionsCount, clusterBuy` are printed (`:404-407` / `:718-721`); `activeHolders` is not — so "Buyers 12 Sellers 3" has no denominator. And `if (snap.exists)` (`:345` / `:659`) means a missing doc yields no row and no note: **the agent cannot distinguish "no institutional interest" from "not covered."**
>
> **Staleness:** block self-declares "lagged by up to 135 days" (`:698`). **Coverage:** top-20 institutions + top-20 funds per stock (`compute-institutional-intelligence.js:101-102`) over 239 tickers, with a **110 s timeout break** (`:87-90`) and a 100 ms per-ticker sleep (`:200`) — a mid-universe truncation is plausible and would be **silent** (nothing reads `stocksProcessed`; no alerting). Flagged as a risk, not a measured fact.

### 2D. Catalyst / calendar family

| verificationId | Kernel category | Verified binding | Status |
|---|---|---|---|
| SIG-035 | catalyst / news (FantasyTimes) | **`fantasyTimesStories`** — queried `tickers array-contains` + `publishedAt > cutoff` (`agentTriggerGate.js:211-217`) from `agent-evaluate.js:1800`; reporter-beat map `agentNewsContext.js:10-59` (alex, kai, neta, doug, kim). **Prose, LLM-interpreted.** Also reaches the BaggerBomb path headline-only (`decide.js:359-374` → `agentPromptAssembly.js:40`). ⚠ Only the **board-ranking** stage is FantasyTimes-blind. | **VERIFIED (prose)** |
| SIG-036 | next-earnings proximity | **`earnings[ticker] = { nextEarningsDate, tradingDaysUntil }`** — `seasonEvalContext.js:128-133`. Underlying `nextEarningsDate` from EODHD `General.NextEarningsDate` (`marketDataCache.js:385`). ⚠ **Season path only — dormant per finding E.** | **VERIFIED (dormant path)** |
| SIG-037 | season alpha vs benchmark | **`alphaVsSpy`** = `portfolioReturn − spyReturn` (`seasonEvalContext.js:256`; `seasonSettlement.js:394`). Consumed by deterministic predicates `seasonRuleRegistry.js:547,562` (ss-01/ss-02) and `sr-05` (`:532-533`). ⚠ **Dormant per finding E.** | **VERIFIED (dormant path)** |
| SIG-043 | macro event calendar | **`api/_utils/macroCalendar.js`** — a real, hand-maintained module: `FOMC_DECISIONS_2026` (`:100-105`, five entries from 2026-06-17), `CPI_RELEASES_2026`, unified query `getMacroEventsInWindow` (`:391`). Sole consumer `fetchMacroEvents.js:18` → **only** `compute-daily-regime-brief.js:23`. ⚠ **Agent-blind as structured data** — see the REFUTED list for the precise terminus. | **VERIFIED (unwired to agents)** |

**FantasyTimes coverage caps — hard limits (`agentTriggerGate.js:196-217`):**

| Cap | Value | Line | Consequence |
|---|---|---|---|
| `maxSymbols` | **10** | `:201`, applied `:209` | only the first 10 of portfolio ∪ bench ∪ hotBench are queried. Silent truncation. |
| `limitPerSymbol` | **2** | `:200`, applied `:216` | ≤2 stories per ticker. |
| `cutoffMinutes` | **120** | `:199`, applied `:203` | 2-hour window; older catalysts invisible. |
| deepdive filter | excluded | `:224` | Vera deepdives skipped pending Phase 2. |
| error handling | swallowed | `:229-232` | a missing index yields zero stories, indistinguishable from "no news". |
| **status filter** | **NONE** | `:211-217`; `decide.js:359-363` | ⚠ **Expired stories can still reach both prompts** — cleanup only runs `0 7 * * 1,4`. |
| universe | 53 of 54 | `fantasyTimesTickers.js` vs `rankingConfig.js` | TGT is in `FANTASYTIMES_TICKERS` but not `ALL_TICKERS` — covered but not agent-draftable. |

---

## 3. REFUTED / ABSENT list

### 3A. Refuted as named (bind to the real neighbour)

| Requested | Verdict | Cite instead |
|---|---|---|
| **BBW percentile-of-history** | **REFUTED AS NAMED** | `bBandwidthPercentile` is **cross-sectional** (`compute-index-intelligence.js:927-937`). No rolling self-history percentile. "Squeeze vs its own past" is **not** authorable; "narrow vs the universe today" is (SIG-014). |
| **"rising down-volume"** | **REFUTED AS NAMED** | `upDayVolRatio` is a 20-bar **level** (`indexIntelligence.js:375`). Nothing computes whether down-volume is *rising*. |
| **QoQ growth acceleration** | **REFUTED AS NAMED** | "acceleration" is **price** momentum (`momentumScoring.js:129`, SIG-020). No second derivative of revenue/earnings growth. `institutionalIntelligence.js:107`'s "QoQ" is 13F holder share change — a third meaning. |
| **Market-cap classification** | **REFUTED AS NAMED** | Raw `marketCap` persisted (SIG-028); **no bucket field on any doc.** Bucketing exists only as an ephemeral earnings-queue priority heuristic (`api/earnings/sync-queue.js:339-341`) and in a client service (`src/services/recommendationEngine.js:188-202`) — neither persisted nor on an agent path. **The value is bound to a doc; the classification is not.** |
| **Intraday ATR vs 14-day ATR (ts-01)** | **REFUTED AS NAMED** | Strict range÷ATR-14 is absent. But **`benchATRMult` = dailyChangePct ÷ ATR IS computed for every bench candidate and rendered** (`agentTriggerGate.js:104-109`) — SIG-040. Cite that, not ts-01. |
| **Sector peer ranking (fundamental)** | **PARTIALLY REFUTED** | Two disconnected axes: technical (`sectorTechnicalRank`, SIG-012, agent-visible) and fundamental (`sectorMedian` + within-sector percentile, SIG-026, **unwired**). |

### 3B. Genuinely absent

| Requested | Evidence for the negative |
|---|---|
| **5-min RSI / 5-min MACD** | **ABSENT.** 5-min candles are fetched (`marketDataCache.js:631-638`) and used for VWAP (`agentVwapFloor.js:10-13`) and **5-min SMA20** (`agentRiskManager.js:238`, SIG-038). **No RSI or MACD on any intraday timeframe.** ⚠ "5min RSI" appears **seven times** in eval prompt prose. **The most dangerous false-positive in the codebase for this exercise.** Note: the gap is a **computation** gap, not a data gap — bars and one indicator already exist. |
| **VWAP σ-bands** | **ABSENT.** Snapshot carries `{vwap, currentPrice, vwapDeviation, sma20_5m, sessionDate}`. "1 std below VWAP" is prose only (`:162,:389`). No σ computation on VWAP anywhere. |
| **VWAP reclaim pattern** | **ABSENT.** Only the **failure** direction exists: `vwapTicks` strike counter, dead-band gated (`agentVwapFloor.js:49-51`). |
| **VWAP as a selection signal** | **ABSENT.** `buildMomentumSnapshot` iterates `assetScores` — held only (`:1518`); the bench block renders no VWAP line. Confirmed by the fetch itself: `agent-evaluate.js:888` fetches intraday for `portfolioSymbols` only, while `allTechSymbols` (portfolio+bench) is defined one line earlier at `:884` — **the narrowing is deliberate.** |
| **Intraday range position** | **ABSENT.** `dailyRange` (`:1011`, rendered `:1536-1537`) is range **magnitude**. Nothing computes position within the day's range. (`compute-index-intelligence.js:346` `rangePosition` is a different, 52-week construct.) |
| **Sector-average volatility** | **ABSENT — by the code's own admission.** `season-daily-evaluate.js:444`: `sectorVolatility: null, // TODO`. |
| **VIX / volatility-regime meter** | **ABSENT.** `season-daily-evaluate.js:441`: `vixLevel: null, // TODO`. |
| **Insider transactions (Form 4)** | **ABSENT.** Independently re-swept with `form_?4`, `sec_?filing`, `officerTrade`, `executiveTrade`, `insiderBuy/Sell`, `openMarketPurchase`, `InsiderTransactions` — **zero hits**. Only two prose hits in an unrelated crypto-advisor prompt (`api/ai-advisor.js:863,886`). **13F ≠ insider.** |
| **Ownership concentration** | **ABSENT as computed.** `ownershipConcentration`, `concentrationRatio`, `top10Pct`, `percentHeld` — zero. Derivable from `totalSharesPct` (`institutionalIntelligence.js:205`) + `topHolderShares` (`:188-189`), but not derived. |
| **Earnings dates on any path that runs** | **ABSENT.** Zero substantive earnings references in `agent-evaluate.js` / `agentEvalPromptAssembly.js` / `decide.js` / `agentPromptAssembly.js` (apparent hits are `LEARNING_*`). Un-done wire recorded at `compute-index-intelligence.js:817`. Reaches only the **dormant** season path. |
| **Macro calendar as structured agent fact** | **ABSENT, with a precise terminus.** The calendar is real (SIG-043) and flows: `macroCalendar.js` → `fetchMacroEvents` → `compute-daily-regime-brief.js` → `indexIntelligence/dailyRegimeBrief`. `decide.js:1434` **does read that doc** — but takes **only `drb.dailyBrief`, a prose string**, gated on `forDate === today` (`:1446-1450`), into the **agent-chat first-message** prompt. **`keyEvents[]` is never read by any agent** (zero `keyEvents` hits in `decide.js`). So no agent can evaluate "is FOMC within N days". `macroPrices` (`agent-evaluate.js:695`) is SPY/QQQ/BTC percent change — not a calendar. |
| **`economicCalendar` collection** | **READ BUT NEVER WRITTEN.** `fantasyTimesConsensus.js:90` and `api/health.js:81` read `economicCalendar/latest`; **no writer exists anywhere in the repo.** A permanently-empty read. |
| **score-vs-par** | **ABSENT.** No `scoreVsPar`/`parScore`/`expectedScore`/`targetScore`. The live state block (`agentEvalPromptAssembly.js:884-890`) shows absolute score, trade count, eval count **plus SPY/QQQ/BTC daily %** — no par, no opponent, no rank. **Substitute:** own score vs the macro line, both already in that block. |
| **Hold duration** | **ABSENT as a field.** Substitutes: `stagnationTicks` (`agentRiskManager.js:203-230`), `cronState.consecutiveHolds` (`agentBattleService.js:278`), trade timestamps. |
| **Per-sector valuation metric selection** | **ABSENT.** Uniform metric set for all stocks (`compute-rankings.js:1343-1378`); sector-relativity comes from ranking within sector + `sectorMedian`. ⚠ `extractBalanceSheetMetrics` **accepts `sectorId` and never uses it** (`:419`) — the hook exists, unused. |
| **Forward P/E** | **ABSENT.** No production writer; only a dead UI reader (`src/components/draft/SectorTab.jsx:144-145`, row dropped by a null filter `:149`). |
| **Absolute free cash flow** | **ABSENT as a field.** Only `fcfYield`/`fcfMargin`; explicitly `null` in the season context (`seasonEvalContext.js:120`). |
| **Earnings-surprise decile** | **ABSENT.** Magnitude and beat rate are real (SIG-025); no decile bucketing. |
| **News-sentiment scalar** | **ABSENT as a FantasyTimes/news scalar.** Third-party sentiment is *cached but never scored*: `marketDataCache.js:366` stores `sentiment: item.sentiment \|\| null` per EODHD headline, passthrough only. The real numeric sentiment (SIG-042) is **estimate-revision** sentiment, not news. |

---

## 4. C-12 — Battle-state field verification

`file:line` each; **no cadence required.** "Visible at decision time" = readable in `decide.js`/`agent-evaluate.js` or rendered into the eval prompt.

| # | Field | Exists? | Anchor(s) | Shape / values | Visible |
|---|---|---|---|---|---|
| 1 | **phase + EARLY/FINAL_HOUR** | ✅ **YES — DERIVED, not stored** | `agentEvalPromptAssembly.js:1036-1069`; rendered `:885` | `computeBattlePhase()` → **`EARLY`** (`:1066`, progress <0.4) · `MID` (`:1038,1055,1067`) · `LATE` (`:1068`) · **`FINAL_HOUR`** (`:1049`, ≤60 min to close on the last day). **EARLY and FINAL_HOUR are the exact literals.** | ✅ `Phase: ${phase}` |
| 2 | **score-vs-par** | ❌ **ABSENT** | — | No par concept; absolute score only (`agentBattleService.js:256-268`). | ❌ |
| 3 | **swap count / window** | ✅ **YES** | `agentRiskManager.js:476`; config `agentArchetypeConfig.js:59,90,119,146,177,209`; read `agent-evaluate.js:1341` | `getRecentSwapCount` over `trades[]` by `swappedOutAt`, dedupe by `t.id`, **excludes emergency reasons** unless `countEmergencies` (`:494`). Caps 6/4/4/4/**12**/2 per 60 min (CP: 2 per **120**). | ✅ |
| 4 | **per-position P&L cycle** | ✅ **YES (two halves)** | live `agentRiskManager.js:96-97`; realized `agentSwapExecution.js:196,241,254` | Live unrealized in **ATR multiples** (`atrMultiplier = priceChangePct / baseATR`); realized at close as **`lockedPoints`**. | ✅ |
| 5 | **hold duration** | ❌ **ABSENT** | `agentRiskManager.js:203-230`; `agentBattleService.js:278` | Substitutes: `stagnationTicks` (+ `withinAge` validity gate), `consecutiveHolds`, trade timestamps. | ⚠ substitutes |
| 6 | **consecutive-below-VWAP** | ✅ **YES** | `agent-evaluate.js:1284,1286,1317,1748`; `agentVwapFloor.js:49-51,63-69` | `cronState.vwapTicks[symbol]`, **dead-band gated** (`< -deadBandPct`), pruned on un-held symbols. Companion `vwapFireGuard {date,count}`, `VWAP_CASCADE_GUARD_N = 4`. | ✅ |
| 7 | **bench + eval-count** | ✅ **YES** | `agentBattleService.js:143-145`, `:248-254`, `:264`; rendered `agentEvalPromptAssembly.js:887` | `portfolio.bench {stocks,crypto}`; `watchlist {active,hotBench,monitoring,…}`; `scoreState.evaluationCount` (+`tradeCount`,`holdCount`). | ✅ |
| 8 | **emergency-exception predicate** | ✅ **YES — named, single-source** | `agentRiskManager.js:28-34`; used `:310`, `:494`; action `:103` | **`EMERGENCY_BYPASS_REASONS`** = `{bust_avoidance, vwap_failure, stepped_trail, guardrail_stopLoss, guardrail_trailingStop}`. Clears the hurdle unconditionally (`:310`); excluded from the window cap (`:494`). In-code contract at `:26`. ⚠ **See finding D — the emergency replacement is chosen with no quality signal at all** (`:356-378`). | ✅ |
| 9 | **season benchmark gap** | ✅ **YES — a live rule predicate, on a dormant path** | `seasonEvalContext.js:256`; `seasonSettlement.js:394`; consumed `seasonRuleRegistry.js:547,562,532-533` | **`alphaVsSpy`**. Benchmark persisted `season-daily-evaluate.js:188-197`; `categorizeSpyTrend` `:37`. ⚠ Finding E. | ⚠ dormant |
| 10 | **pit-stop shortlist** | ✅ **YES — dormant path** | `season-pit-stop-manage.js:154-163`, validators `:28-29` | `pitStops/{week}` with `shortlist: []` + `shortlistRationale: {}`; `validateShortlist` on close. ⚠ Finding E. | ⚠ dormant |

**Tally: 8 of 10 real; 2 absent. Of the 8, two (items 9–10) sit on the dormant season path.**

---

## 5. Authoring disposition per rule family

| Family | Disposition | Basis |
|---|---|---|
| **Technical [U]** | ✅ **UNBLOCKED** — SIG-009…020, 038…041 | technicalScore minted; sector RS, sector peer rank, %B, highProximity, per-stock regime, ATR-normalized move all real and agent-visible. |
| **Technical — intraday/VWAP subset** | ⛔ **BLOCKED at HEAD** (not permanently) | 5-min RSI/MACD, σ-bands, reclaim, VWAP-as-selection, range position: no substrate. **Prompt prose is not a substrate.** Cheaper than it looks — bars + one 5-min indicator already ship. |
| **Fundamental** | ⚠ **CONDITIONALLY BLOCKED — one wire away** | SIG-021…028, 042 are real and persisted; the battle agent cannot read `peerRankings`. Authorable in substance, **not citable as available** until a mirror lands. A wiring gap, not a data gap. |
| **Institutional (`ins_` ×10)** | ✅ **UNBLOCKED — blocking hypothesis refuted** | Live pipeline on two of three tournament-side paths. **8 of 10 concepts bound.** Blocked: insider/Form 4. Absent-but-derivable: ownership concentration. Every cell must satisfy the four §2C constraints. |
| **Calendar [CAL]** | ⛔ **BLOCKED on every path that runs** | Earnings and macro both exist as data; neither reaches a running agent as structured fact. ⚠ **The product already ships an `earningsAvoidanceDays` slider and an `fomcDefensive` toggle that emit directive prose** — those directives are currently unbacked. |
| **Beta (ss-01/02/04)** | ⚠ **DORMANT-PATH ONLY** | SIG-029 exists in the season context, which does not execute (finding E). On running paths the honest substitutes are `residualMomentum` (SIG-041) and RS-vs-SPY. |
| **Sector (ss-05, tv-14)** | ✅ **UNBLOCKED** | tv-14 (SIG-011) and ss-05 (SIG-017) real. **Plus** `detectGameplanMeetingTrigger` (`agent-evaluate.js:3460`, invoked `:1771`) performs held-book sector P&L rollups at request time on the eval path (`:3486-3502`) — sector aggregation *does* participate in a tournament decision. Sector-average **volatility** stays blocked. |

---

## 6. Author traps — read before writing any cell

1. **Null-laundering, two instances.** `archetypeScoring.js:121` reads `technicalScore ?? 50` (also `:120,:122,:123,:124`); `compute-rankings.js:933-935` makes `relMomentum3M` fall back to `0`. In both, missing data is indistinguishable from neutral data. Never treat a mid-range composite as evidence its inputs existed.
2. **`technicalScore` is not sector-neutral** — sector RS is 15 of its 100 points (`indexIntelligence.js:284`). Citing both double-counts.
3. **The weight key is `technicalScore`, not `technical`.** No `technical` key exists in `ARCHETYPE_WEIGHTS`; every such hit is a UI label map. Weights: momentum_chaser 0.40 · analyst 0.30 · diversifier 0.20 · guardian 0.20 · degen 0.15 · contrarian 0.10 (`archetypeScoring.js:17,25,33,41,49,57`).
4. **`arch_scores` is persisted but agent-invisible.** The ARCH column is a **rank-time recompute** (`archetypeScoring.js:137`; `tournamentAgentBoards.js:462`, `decide.js:323`); the stored field (`compute-index-intelligence.js:1066`) is read only by the screener/voice layer. A cell saying "arch_scores is queryable *and* the agent sees it" is half wrong.
5. **`bBandwidthPercentile` is cross-sectional, not historical.**
6. **VWAP is exit-side only** — held positions, never candidates; the narrowing at `agent-evaluate.js:884-888` is deliberate.
7. **`peerRankings` is invisible to the battle agent.**
8. **Four paths — always name yours.**
9. **Prompt prose, Forge rule text, and configuration sliders are not data** (finding B).
10. **The rounding seam.** `technicalScore` reaches the draft prompt **rounded** (`agentPromptAssembly.js:226`) and the eval bench block **unrounded** (`agentEvalPromptAssembly.js:1408`). A boundary-valued threshold can disagree across paths — §9 display-agreement applies: bind the predicate to one rendering.
11. **The emergency path ignores every signal** (finding D) — state each quality cell's emergency behaviour explicitly.
12. **The institutional shortlist gate** — institutional evidence arrives *after* candidate selection, so it can weight but never admit.
13. **Staleness horizon** on the rankings doc: `expiresAt = now + 75 min` (intraday) / `24 h` (premarket), `compute-index-intelligence.js:1100`.
14. **The DR-13 identity block is DARK at HEAD — by design, not by breakage.** `EVAL_IDENTITY_BLOCK_ENABLED = false` (`src/config/featureFlags.js:1082`); `evalIdentityBlocks.js:150-157` early-returns `''`. The flag header states the contract explicitly (`featureFlags.js:1071-1081`): *"When FALSE (DEFAULT, merge-dark), renderEvalIdentityBlock returns '' for every key and both eval system prompts stay byte-identical."* Guide §7 calls the identity block "the only carrier of quality-floor language into swap decisions" — **at HEAD it carries nothing**, including the `guardian` block's "low-beta required" text (`evalIdentityBlocks.js:115-117`). Any cell resting on that carrier is resting on a deliberately-dark wire; it becomes live only on the flag flip.
15. **Duplicated templates — a fix must touch two files.** `ARCHETYPE_CONSTRAINTS` injection is byte-identical in `agentPromptAssembly.js:22-23` and `tournamentAgentBoards.js:121-122`; the institutional fetch/format pair is duplicated between `agentPromptAssembly.js:329,341,383` and `agentEvalPromptAssembly.js:642,691,697`.

---

## 7. Re-verification of inherited SIG-001…008 at HEAD `a04a291d`

**All eight hold; no drift.**

| Id | Status @ `a04a291d` |
|---|---|
| SIG-001 | ✅ ATR percentile map `compute-index-intelligence.js:916-925`; persisted `:1009` |
| SIG-002 | ✅ `baggerBombFit` `:1008` |
| SIG-003 | ✅ `fundamentalScore` `:1000` |
| SIG-004 | ✅ `momentumScore` `:1015`, `arch_scores` `:1066`, `return1M` `:1034`. ⚠ The "distinct from technicalScore" note is resolved by SIG-009 — a real sibling field, not an absence. ⚠ `arch_scores` is agent-invisible (trap 4). |
| SIG-005 | ✅ `inverseComposite` — not in the persisted entry (`:992-1038`) |
| SIG-006 | ✅ `sectorDiversity` — computed inside `computeArchetypeRankings` (`:1059`), not persisted |
| SIG-007 | ✅ still refuted as named |
| SIG-008 | ✅ `:661-758` — SMA 20/50/200 `:661-663`, RSI-14 `:664`, MACD `:667`+ |

---

## 8. Cadence reference

`vercel.json` — **37 of the assumed 40 cron entries used** (matches BUILD_RULES §6). All UTC.

| Producer | Schedule | Feeds |
|---|---|---|
| `compute-index-intelligence` | `30 10,11 * * 1-5` | SIG-001…020, 038…041 |
| `compute-index-intelligence?mode=intraday` | `0 14-20 * * 1-5` | intraday refresh; `expiresAt` 75 min |
| `compute-rankings` | `0 11 * * 1-5` | SIG-021…028, 042 (`peerRankings`) |
| `compute-institutional-intelligence` | `0 1,2 * * 1` (**weekly Mon**) | SIG-030…034 |
| `agent-evaluate` | `*/15 13-21 * * 1-5` | battle eval tick (consumer) |
| `compute-estimates` | `0 10 * * 6` (weekly Sat) | forward estimates, `emsPercentile` |
| `compute-daily-regime-brief` | `30 12 * * 1-5` | SIG-043 → DRB (agent-blind as structured data) |
| FantasyTimes `scan-movers` | `*/15 13-20 * * 1-5` | SIG-035 |
| **season-daily-evaluate** | **— NOT REGISTERED —** | SIG-029, 036, 037, pit-stop (finding E) |
| **season-pit-stop-manage** | **— NOT REGISTERED —** | pit-stop shortlist (finding E) |

---

## 9. Found outside scope — reported, not fixed (BUILD_RULES §3)

Separate tasking candidates. **None acted on.**

1. **⭐ Season evaluation de-registered as collateral in a UI commit** (finding E) — `d80aee25` ("Forge redesign Phase 1") deleted all three season cron entries (40 → 37) while `season-daily-evaluate.js:9-11` still claims the deleted schedule. Highest-value item here. Whether the shelving was intended is a founder question; what is certain is that **the code still says it runs**. Either restore scheduling (costing 2 slots if the two pit-stop actions branch inside one handler, per §6) or correct the comment — the stale comment nearly drove a wrong conclusion in this very read.
2. **⭐ Prompt/rule/slider-vs-payload disagreement** (finding B) — the model is instructed, and users can configure rules, against data that is never supplied. §9 display-agreement one level up.
3. **`economicCalendar` is read but never written** (`fantasyTimesConsensus.js:90`, `api/health.js:81`) — a permanently-empty read, one of which is a **health probe**.
4. **`computeFreshness` is dead code** (`institutionalIntelligence.js:217`) — defined, documented, never called.
5. **`fetchRecentNews` silent truncation** (`agentTriggerGate.js:209`) — `maxSymbols = 10`, no signal about what was dropped.
6. **Expired FantasyTimes stories can reach both prompts** — no status filter on either retrieval path; cleanup runs only twice weekly.
7. **Macro stories may be structurally unreachable** — `tickers array-contains` cannot match a macro story with no tickers.
8. **News-query failures indistinguishable from "no news"** (`agentTriggerGate.js:229-232`) — adjacent to the Signal Capture Rider's silent-loss concern.
9. **Institutional cron has no failure signal** — `stocksProcessed` is written (`:343`) but nothing reads it; a mid-universe timeout break (`:87-90`) is silent.
10. **Institutional coverage failure is silent and asymmetric** — `if (snap.exists)` yields no row and no note.
11. **No institutional history** — idempotent `.set()` plus the Monday DST double-run means no time series exists for any "change in positioning" rule.
12. **Four inconsistent earnings-surprise definitions**, two inside one function (`compute-rankings.js:527-533` vs `:548-551`).
13. **Stale comment on the composite gate** — `compute-rankings.js:864` says "at least 3 of 7 pillars"; `PILLARS` defines **8** (`rankingConfig.js:680-689`).
14. **Duplicated templates** (trap 15) — two copies each of the archetype-constraint text and the institutional fetch/format pair.
15. **Dead/decoy code an author may find and misuse** — `src/services/breadthIndicatorService.js:18` `calculateSectorBreadth` (per-sector %-above-SMA aggregates, no agent consumer); `intelligencePrompt.js:495-496` emits `Market Cap:`/`P/E:` into a prompt whose builder has zero importers.
16. **Level Study earnings machinery** — `research/level-study/lib/features.js:87-89`, `features-daily.js:355-381`, `config.js:595-609` implement `sessions_since_last_earnings` and related features with **zero product or agent consumers**.
17. **Unused `sectorId` parameter** (`compute-rankings.js:419`) — a latent hook for sector-relative leverage.
18. **Load-bearing TODOs** — `vixLevel` (`season-daily-evaluate.js:441`), `sectorVolatility` (`:444`), earnings wire (`compute-index-intelligence.js:817`).

---

## 10. Fence statement

No fenced file was edited. Fenced files were **read only**, which BUILD_RULES §1 expressly permits: `decide.js`, `agentSwapExecution.js`, `agentScoring.js`, `agentRiskManager.js`, `agentArchetypeConfig.js`, `agentBattleService.js`, `agentPromptAssembly.js`, `agentEvalPromptAssembly.js`, `agentGuardrails.js`, `archetypeScoring.js`. No fenced function was called. No new importer of any legacy archetype table was created — the §2.3 import-boundary ratchet is untouched.

---

## 11. Method

Every finding is a **first-hand read of code at HEAD `a04a291d`**. No row rests on a summary, a spec, or another agent's report unaccompanied by my own read of the anchor.

A **16-agent adversarial cross-check completed** (nine domain inventories, seven paired verification passes instructed to hunt both false presence and false absence with independent vocabulary). It produced **30 non-confirmed verdicts and 59 missed items**. Every one that touched a claim in this report was re-opened and settled by reading the code directly; those that survived are folded in above. A second focused workflow adversarially tested the season-dormancy finding from three independent angles — external schedulers, call-graph reachability, and git history — returning **2 × DORMANT_CONFIRMED plus one correct split** (the evaluation pipeline is unreachable; the season HTTP product surface is live). I then verified the de-registration commit myself by parsing `d80aee25^:vercel.json` against `d80aee25:vercel.json`.

A third workflow stage reconciled seven load-bearing corrections: **4 CONFIRMED, 3 CORRECTED** (all three refinements to description rather than reversals — the sentiment-chain line numbers, the `benchATRMult` proxy divisor, and the VWAP channel taxonomy). Those refinements are applied above.

**Two agent claims were themselves wrong and are not relied upon:** one reported 39 registered cron entries (the array is **37** — 1 lobbies + 20 `api/cron` + 16 fantasytimes, parsed programmatically, matching BUILD_RULES §6 exactly), and one asserted the institutional cron "times out mid-universe every run," which is an unverified estimate and appears here only as a risk. Agent output was treated as a lead, never as evidence — every claim that survived into this report was re-read at its anchor.

Still outstanding when this was written: two verification agents from the first workflow (C-12 battle-state, eval-context census) had not returned. Both cover ground verified first-hand here; nothing in this report depends on them, and any material correction will be reported if they land.

The absence claims were deliberately attacked rather than defended. Two survived a re-sweep with different vocabulary (insider/Form 4; strict ts-01). **Four did not, and were corrected** — see §12. That is the reason to trust the rest.

No claim rests on a specification document, a code comment, or the product's own prompt text. Where any of those disagree with the code, the code is reported.

---

## 12. Corrections from V1 (full list)

| # | V1 claim | V2 correction |
|---|---|---|
| 1 | The season path is a live agent path; beta/earnings/`alphaVsSpy` are "season-path only" but available. | **The season path is DORMANT** — not cron-registered, no invoker. Those signals are dormant-path, not available. (Finding E, §9-1.) |
| 2 | Institutional signals carry "archetype-aware freshness decay" via `computeFreshness`. | **`computeFreshness` is dead code** — never invoked. No freshness decay occurs. (SIG-032.) |
| 3 | "No indicator is computed on intraday bars." | **5-min SMA20 exists** (`agentRiskManager.js:238`, SIG-038). 5-min RSI/MACD remain absent. |
| 4 | Macro calendar absent; catalyst reaches the agent as prose only. | **A real macro calendar module exists** (SIG-043) and terminates in a prose line in the agent-chat prompt; `keyEvents[]` never reaches an agent. **A numeric sentiment score also exists** (SIG-042) and reaches the draft agent indirectly via `BB_FIT`. |

Additionally, V2 adds SIG-039…043 (per-stock regime, ATR-normalized move, residual momentum, numeric sentiment, macro calendar), finding D (the signal-free emergency path), and eleven new out-of-scope items.
