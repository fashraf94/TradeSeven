# Phase 0 Addenda — Intraday Data (read-only)

**Date:** 2026-09-19 · **Branch:** `claude/phase0-intraday-addenda` · **Base:** `origin/main` @ `19ee6919` (PR #867 merge, Fri Sep 18 19:10 −05; clean tree at session open)
**Scope:** read-only on the codebase. No source file changed. **One new file: this report.** The founder fixture is NOT committed — see the blocker below.
**Grounding:** `docs/audits/20260918_PHASE0_INTRADAY_DATA.md` (the Phase 0 report). Every anchor it supplies that this report leans on was re-read at this HEAD; the file `agent-evaluate.js` is 4,875 lines here and its cited lines held.

**Preamble (BUILD_RULES §3):**
- `git fetch origin` was the first step of the session (recorded). `origin/main` = `19ee6919`; the branch was cut from it. `claude/phase0-intraday-addenda` did not exist on origin — created fresh. The harness nominated `claude/gracious-wright-mjybtr` (on origin at the same SHA as `main`, zero commits beyond it); the task prompt names `claude/phase0-intraday-addenda`, and the prompt wins.
- The container is a shallow clone (323 commits reachable). It was **not** unshallowed: every commit this report cites (`68723eee`, `79aa5c91`, `3597b921`) was reachable.
- **Fence:** `agentEvalPromptAssembly.js`, `agentRiskManager.js`, `agentSwapExecution.js`, `agentBattleService.js`, `agentScoring.js` and `api/agent/decide.js` were READ (anchors in items 6–9). Nothing was edited.
- Markers: **VERIFIED** = read at that line in this session. **MEASURED** = computed in this session from data in the repo. **ASSUMED** = vendor documentation or founder report, not reproduced here. **NOT MEASURED** = the task asked for a measurement this session could not make.

## The blocker, stated first

**This session holds no EODHD credential and no Firebase credential.** `EODHD_API_KEY` is absent from the environment (VERIFIED: every env-var name containing `key`, `token`, `secret`, `eod` or `cred` was enumerated — none is EODHD's; the tree holds only `.env.example`, no `.env`/`.env.local`, no `.vercel/`). `FIREBASE_PROJECT_ID` / `FIREBASE_PRIVATE_KEY` are likewise absent, so `indexIntelligence/stockRankings` cannot be read from here.

**The founder's 391-row fixture is not in the repo, on any remote ref, or in the session.** `docs/audits/fixtures/` does not exist at HEAD (VERIFIED); `git log --all --full-history -- 'docs/audits/fixtures/*'` is empty; `git ls-tree -r` over every one of the ~30 `origin/*` branches finds no `audits/fixtures` path and no `AAPL_2026-09` file (VERIFIED); nothing was pasted into the task. It could not be fetched (no key). **It is therefore not committed**, and items 2, 3 (as specified), 4 and 5 (the live calls) are **NOT MEASURED** here. Each of those items records the exact request the founder can run, its unit cost, and what the repo already knows.

**External calls made from this session: 0 EODHD calls, 0 units** (ledger at the end). Git fetch/push to GitHub are the only network operations.

---

## Executive verdict

| # | Item | Verdict | Marker |
|---|---|---|---|
| 1 | Budget in units | Fixed weekday baseline **≈ 9,010 units** (was 6,530 "calls"): fundamentals at 10/request move `compute-rankings` from 252 to **2,502**. `agent-evaluate` costs **98 units per battle per evaluating tick**, and there are **26** evaluating ticks per weekday, not 36 — the `isMarketOpen()` guard skips 10 of the cron's 36 fires — so **≈ 2,548 units per active battle per day** from the evaluator (**≈ 2,888** with voice cache + daily scores). Headroom at ten battles with mandate live **≈ 44,300**. Seeding + validation at 5 units/symbol-day: **1,275 each per day for 255 names**. **Eight** shipped comments still budget in requests. | VERIFIED (anchors) / ASSUMED (non-founder unit costs) |
| 2 | Prior-session publish time | **NOT MEASURED** — no key. 0 attempts, 0 units. Earliest evidence remains the founder's 19:11 ET Friday run returning Thursday in full (ASSUMED). The repo carries two in-code traces that today's bars can be absent while yesterday's are present. | NOT MEASURED |
| 3 | Volume reconciliation | Founder fixture unavailable → **NOT MEASURED as specified**. **MEASURED proxy** on the in-repo June 2026 AAPL 5-minute fixture vs the EOD fixture, 21 sessions: Σ(bar volume) / EOD volume **median 74.3 %, mean 72.7 %, range 36.7 – 98.6 %**; the 16:00 row is present on all 21 sessions with **`volume: null`** and O=H=L=C — the exact shape `fetchIntradayCandles` strips. Not classified. | MEASURED (proxy) |
| 4 | Bulk endpoint | **NOT MEASURED**. The only bulk endpoint in the repo is `/eod-bulk-last-day/US` (`compute-rankings.js:1490`), 100 units/request (ASSUMED); it is an **end-of-day** feed carrying `date`, not `timestamp` (ASSUMED). No EODHD "bulk live" endpoint without symbols is known to this session; `/real-time/` requires symbols and bills per ticker. | NOT MEASURED / ASSUMED |
| 5 | Exchange calendar | `/exchange-details/US` is **not called anywhere** in the repo (VERIFIED). The platform's equivalent is the hard-coded `marketSchedule.js` (2026–2027 holidays, two early-close dates per year at 13:00 ET) plus **eight sibling copies** of the holiday list, only two of which carry early closes. Nothing caches a vendor calendar. Vendor shape and 1-unit cost ASSUMED. | VERIFIED (repo) / ASSUMED (vendor) |
| 6 | Indicator functions | `calculateRSI` and `calculateMACD` are **batch, latest-value-only, SMA-seeded** (Wilder smoothing for RSI; SMA-seeded EMA series for MACD, signal EMA seeded over the valid MACD values). They accept newest-first arrays and expose **no state in or out**. They **cannot** be driven one bar at a time without new functions. Every consumer today feeds them **daily** bars; a 5-minute MACD "is never computed anywhere" (in-code comment). | VERIFIED |
| 7 | Crypto consumers | The agent evaluator is **already equities-hours-only** (`isMarketOpen()` guard) even though a crypto book's battle closes at **20:00 ET**; two nightly crons (`agent-daily-scores` 21:45 ET, `compute-daily-baggerbomb-levels` 21:30 ET) price crypto **outside** equities hours; the voice cache formats every held symbol as `.US` and so never prices crypto; the intraday session filter clips crypto bars to the **ET RTH window**. | VERIFIED |
| 8 | Firestore volume | **No measured daily read/write figure exists in the repo.** The Mar 17 commit `68723eee` records an *estimate* ("50K reads/day → ~12-15K reads/day", client-side); `firestoreReadCounter.js` is a dev-console counter that persists nothing. From code, one quiet evaluating tick per battle costs **≈ 24–34 reads and ≈ 36 writes**, of which **~34 writes are `marketDataCache/{SYM}_daily` refreshes** issued by the price loop. | VERIFIED (code) / absence VERIFIED |
| 9 | Readers of evaluation entries | **31 readers** enumerated (14 server, 17 client), each with its field list and its sink. Four feed a **later prompt** (the decider's own next prompt via `formatRecentEvals`; the narrator's YOUR RECORD block, shadow-only today; the reflection prompt → `agent.memory[]`; the anticipation note). The rest are display, counts, or projections. The battle doc is read **wholesale** by the client subscription, by chat/reflect/batch-review/voice-cache/daily-scores, and by the tournament projection (owner path). | VERIFIED |
| 10 | Index exemptions | `firebase.json` → `firestore.indexes.json`; its `"fieldOverrides": []` is **empty** (`:566`). **No collection uses a single-field exemption in source.** `FIRESTORE_INDEX_DRIFT_CLEANUP.md` records that CLI index deploys have been **blocked since May 24 2026** (HTTP 400 on an `ingestedClaims` entry; 13+ production indexes drifted), so exemptions today are **console-only**, and production state is unknowable from here. | VERIFIED |

---

## 1. Budget in units

### 1.1 Unit costs applied

| Endpoint family | Units | Basis |
|---|---|---|
| `/real-time/` (quotes; path list or `s=`) | **1 per ticker** | VERIFIED — founder-stated in this task; founder-measured 2026-09-18 (Phase 0 §6) |
| `/intraday/` | **5 per request** | VERIFIED — founder-stated |
| `/fundamentals/` | **10 per request** | VERIFIED — founder-stated |
| `/technical/` | **5 per request** | VERIFIED — founder-stated |
| `/news` | **5 per request** | VERIFIED — founder-stated |
| `/eod/` | 1 per request | ASSUMED (vendor docs) |
| `/eod-bulk-last-day/` | 100 per request | ASSUMED (vendor docs; item 4) |
| `/calendar/earnings`, `/calendar/trends` | 1 per request | ASSUMED |
| `/economic-events` | 1 per request | ASSUMED |
| `/splits/`, `/div/` | 1 per request each | ASSUMED |
| `/exchange-details/` | 1 per request | ASSUMED (item 5) |

Endpoint per call site was re-verified at HEAD: `fetchOHLCV` → `/eod/` (`compute-index-intelligence.js:201-205` via `fetchBatch`); `fetchRealtimeQuotes` → `/real-time/` groups of 20 with `s=` (`:298-305`); `fetchSingleFundamental` → `/fundamentals/…&filter=` (`compute-rankings.js:116-118`); bulk → `/eod-bulk-last-day/US` (`:1489-1491`); ETF history → `fetchHistoricalPrices` over `['SPY', …11 sector ETFs]` = **12** symbols (`:1500-1501`); `scan-movers` `fetchQuote` → `/real-time/{sym}.US` one per symbol (`scan-movers.js:42`); `generate-pulse` `fetchBatchPrices` → one `/real-time/` per symbol (`generate-pulse.js:79-90`) plus one `/news?limit=3` (`:199`); `submit-earnings-batch` → `/fundamentals/{sym}.US` full doc per symbol (`:65`); `voice-layer-cache` `fetchBulkPrices` → `/real-time/{a,b,…}.US` in path-lists of 20 (`voice-layer-cache.js:33`, `:52-56`); `agent-evaluate` price loop → `getStockAnalysisData(sym, { forceRefresh: true, fields: ['daily','price'] })` = one `/eod/` + one `/real-time/` (`agent-evaluate.js:721`; `marketDataCache.js:638-640`, `:684-686`, `:742-745`); intraday → `fetchIntradayBatch(portfolioSymbols, { interval: '5m' })` (`agent-evaluate.js:958` → `marketDataCache.js:799`); mandate quotes → `fetchBatchQuotes` (`mandateUniverseSnapshot.js:32`, `:502-508`), mandate corporate actions → `/splits/` + `/div/` per symbol (`:317-320`). All VERIFIED.

### 1.2 Correction to the run count: 26 evaluating ticks, not 36

`agent-evaluate` is scheduled `*/15 13,…,21 * * 1-5` = 36 fires (Phase 0 §5.1 row 29, VERIFIED against `vercel.json`). But `if (!isMarketOpen()) return res.status(200).json({ skipped: true, reason: 'market_closed', … })` runs **before any per-battle work** (`agent-evaluate.js:303-306`, VERIFIED), and `isMarketOpen()` is `09:30 ≤ t < 16:00` ET on non-holiday weekdays (`marketSchedule.js:158-176`, VERIFIED). The fires that evaluate are 09:30, 09:45 … 15:45 ET = **26 per weekday** in both EDT and EST (the 13:00/13:15 UTC fires and the 20:00–21:45 UTC fires are skipped under EDT; 13:00–14:15 and 21:00–21:45 under EST). The expiry sweep (`:230`) runs on all 36 fires but makes **no EODHD call** (VERIFIED: `completeBattle` at `:4486` fetches no price). Phase 0 §6.2 multiplied by 36; the per-battle figures below use 26. (`voice-layer-cache` has no such guard in the lines read; its 32 runs stand as ASSUMED.)

### 1.3 Fixed weekday baseline, in units

| Cron | Per run | Runs/weekday | Units/weekday | Was (requests) |
|---|---|---|---|---|
| `compute-index-intelligence` pre-market (×2, no ET guard — Phase 0 §6.2) | 256 `/eod/` × 1 | 2 | **512** | 512 |
| `compute-index-intelligence?mode=intraday` | 256 `/eod/` + 255 quotes | 7 | **3,577** | 3,577 |
| `compute-rankings` | 239 `/fundamentals/` × **10** + bulk **100** + 12 `/eod/` | 1 | **2,502** | 252 |
| `fantasytimes/scan-movers` | 54 quotes | 32 | **1,728** | 1,728 |
| `fantasytimes/generate-pulse` | 58 quotes + 1 `/news` × **5** | 6 | **378** | ~354 |
| `fantasytimes/generate-econ?mode=recap` | 2 quotes + 1 econ-events | 18 | **54** | ~54 |
| `fantasytimes/generate-recap` | 1 calendar + E≈10 quotes | 5 | **55** | ~55 |
| `fantasytimes/submit-earnings-batch` | 1 calendar + F≈20 `/fundamentals/` × **10** | 1 | **201** | ~21 |
| `fantasytimes/ingest-earnings` ×2 | 1 calendar | 2 | **2** | 2 |
| `compute-daily-regime-brief` | 1 calendar | 1 | **1** | 1 |
| weekly items (`generate-column` 5 quotes ×4/wk, `compute-estimates` 2 calendar) | — | weekly | ~+5/day amortised (excluded, as in Phase 0) | — |
| **Fixed subtotal** | | | **≈ 9,010** | ≈ 6,530 |

E and F are Phase 0's ASSUMED typical counts. The **+2,480** over Phase 0 is almost entirely fundamentals (`compute-rankings` +2,151, `submit-earnings-batch` +180), then the bulk request (+99) and news (+24).

### 1.4 Units per active battle per day

| Path | Per tick | Ticks | Units/day |
|---|---|---|---|
| `agent-evaluate` price loop: ~34 symbols × (1 `/eod/` + 1 quote) | 68 | 26 | 1,768 |
| `agent-evaluate` intraday: 6 held × `/intraday/` × **5** | 30 | 26 | 780 |
| **`agent-evaluate` subtotal** | **98** | 26 | **2,548** (Phase 0: 2,664 requests over 36 ticks; the same code over 26 ticks is 1,924 requests) |
| cascade-guard re-qualification `fetchIntradayCandles` (`:515-545`) | 5 per fire past the 4th | conditional | +5 each |
| `voice-layer-cache` `fetchBulkPrices`: S ≈ 10 quotes | 10 | 32 | 320 (ASSUMED runs) |
| `agent-daily-scores`: S × (1 `/eod/` + 1 quote) | — | 1 | 20 |
| **Per active battle per day** | | | **≈ 2,888** |

The ~34 and S ≈ 10 are Phase 0's ASSUMED typical values; the per-tick formula (`2 × |allSymbols| + 5 × |portfolioSymbols|`) is exact (`agent-evaluate.js:710`, `:721`, `:958`, VERIFIED). Symbols shared by two battles are fetched twice (the loop is per battle).

`mandate-evaluate` at its 300-symbol cap: ≤ 300 quotes × 36 + ≤ 600 corporate-action requests × 1 = **≤ 11,400 units** — unchanged, every endpoint on that path is 1 unit (ASSUMED for `/splits/`, `/div/`). One caveat: `mandateUniverseSnapshot.js:358` resolves `getFundamentals` through `getStockAnalysisData(sym, { fields: ['fundamentals'] })`, cache-first (`marketDataCache.js:622-632`); every cache miss is **10 units**, not 1 (VERIFIED path, cost per founder rule).

### 1.5 Headroom under 100,000

| Scenario | Units/weekday | Headroom |
|---|---|---|
| Fixed | 9,010 | 90,990 |
| + B = 1 / 3 / 5 / 10 battles | 11,898 / 17,674 / 23,450 / 37,890 | 88,102 / 82,326 / 76,550 / 62,110 |
| + `mandate-evaluate` at cap (B = 10) | 49,290 | **50,710** |
| Worst plausible today (B = 10, mandate at cap, +10 % for user-traffic routes) | ≈ 54,200 | ≈ **45,800** |

Phase 0 §6.4's cadence arithmetic changes unit by unit:

| Poller | Units/day | Note |
|---|---|---|
| 5-minute universe poll of 239 names via **quotes** (78 × 239 × 1) | **18,642** | unchanged — fits |
| the same via **`/intraday/` per symbol** (78 × 239 × 5) | **93,210** | exceeds the whole budget on its own |
| 1-minute held poll, H = 6 × B, via quotes (390 × 6 × B) | 2,340 × B | unchanged |
| the same via `/intraday/` (390 × 6 × 5 × B) | 11,700 × B | B = 4 alone exceeds the remaining headroom |

**So an intraday-bars poller cannot be the per-tick primitive at either cadence; only the quote endpoint (1 unit/ticker) or a bulk request (item 4) can carry a universe poll.**

### 1.6 Seeding and validation calls, corrected

The task defines both at **5 units per symbol-day** (one `/intraday/` request per symbol per day). Neither exists in the codebase (VERIFIED: the only `/intraday/` consumers are `agent-evaluate.js:958`, `:521` and `api/stocks/historical.js:210, :246, :333`), so the figures are the spec's, priced here:

| Scope | Symbol-days | Seeding (×5) | Validation (×5) | Both | At 1 unit (the old count) |
|---|---|---|---|---|---|
| 255-name universe (5 index + 11 ETF + 239) | 255 | **1,275** | **1,275** | **2,550** | 255 each |
| 239 stocks only | 239 | 1,195 | 1,195 | 2,390 | 239 each |
| held names only, 6 × B | 6B | 30B | 30B | 60B | 6B each |

The correction is exactly ×5. At the universe scope, both together are **≈ 28 % of the fixed baseline**, and they are once-a-day, so they do not compete with the poll cadence.

### 1.7 Every shipped comment that still budgets in requests

| # | Anchor | Text | Actual units |
|---|---|---|---|
| 1 | `api/_utils/mandateConfig.js:110` | `MANDATE_QUOTE_BATCH_SIZE = 100; // 300-cap → ≤3 calls/tick` | ≤ 300 |
| 2 | `api/_utils/mandateUniverseSnapshot.js:463`, `:508` | "one chunk == one counted upstream call"; `upstreamCalls = groups.length` | the persisted counter under-reports by the chunk size |
| 3 | `api/cron/compute-index-intelligence.js:291-295` | "collapse the ~255-symbol universe into a handful of calls" | 255 |
| 4 | `api/cron/voice-layer-cache.js:39-43` | section header `EODHD BULK PRICE FETCH` / `fetchBulkPrices` | 1 per symbol |
| 5 | `api/cron/compute-rankings.js:1473` | `// A2: Fetch fundamentals (batched, ~220 calls)` | 239 requests = **2,390 units** |
| 6 | `api/cron/compute-rankings.js:1486` | `// A3: Fetch bulk last-day prices (1 call)` | **100 units** |
| 7 | `api/cron/compute-rankings.js:1498` | `// A4: Fetch historical prices for SPY + sector ETFs (13 calls)` | 12 requests (`:1500-1501`), 12 units — unit-correct, count off by one |
| 8 | `api/_utils/mandateUniverseSnapshot.js:313-320` | `calls++` per corporate-action request | 1 each — correct only because those endpoints happen to cost 1 (ASSUMED) |

Rows 1–4 are Phase 0 §6.5's; rows 5–8 are new. All VERIFIED at these lines. Phase 0 §6 itself is written in requests and should be read through this table.

---

## 2. Prior-session publish time

**NOT MEASURED. Attempts: 0. Units: 0.** The session has no `EODHD_API_KEY` (blocker above), so the 30-minute loop (≤ 25 attempts × 5 units = ≤ 125 units) was not run.

**The request that was to be made**, in the exact URL shape `fetchIntradayCandles` builds (`marketDataCache.js:792-804`, VERIFIED — it sends `&from=&to=` only when `hoursBack` is passed; the fixture window uses absolute bounds):

```
# most recent completed session at session open = Fri 2026-09-18, 09:30–16:00 ET = 13:30–20:00 UTC (EDT)
https://eodhd.com/api/intraday/AAPL.US?api_token=<KEY>&fmt=json&interval=1m&from=1789738200&to=1789761660
# the founder's Thursday window, for the same-shape comparison
https://eodhd.com/api/intraday/AAPL.US?api_token=<KEY>&fmt=json&interval=1m&from=1789651800&to=1789675260
```
(`to` is 20:01 UTC so an inclusive-or-exclusive `to` both admit the 16:00 row; 391 rows = 09:30 … 16:00 inclusive at one minute.) Success criterion per the task: ≥ 380 rows. Record the first UTC time it holds.

**Earliest evidence available (all ASSUMED — founder-reported, not reproduced):** the founder's 19:11 ET Friday 2026-09-18 run returned Thursday 2026-09-17 in full (391 rows). That bounds Thursday's publish at **≤ 27 h 11 m after Thursday's close**; it says nothing about how soon after the close. The same founder finding — "prior-session 1-minute bars are available with a date window and today's are not" — is the premise of this task and is likewise ASSUMED here.

**What the repo already records about this**, both VERIFIED as code/comments (the incidents behind them are ASSUMED):
- `marketDataCache.js:787-789` — `hoursBack` is optional and its omission is "recommended — sidesteps feed-delay edge cases where a NOW-relative window can fall entirely outside published candles." A NOW-relative window has, in production, returned nothing while a windowless request returned bars.
- `agentVwapFloor.js:3-4` — the module header names the "June 11 incident: agent 'Shadow', 12 swaps in ~2h on stale-session VWAP": the intraday endpoint served the **prior** session's bars during a live session, and `filterToLatestSession` anchored on them. That is the "prior session present, today absent" state observed in production before the date gate existed.
- `fixtures/README.md:1-20` — the July 10 capture returned full 5-minute months for June 2026 and June 2023; historical windows are complete once published.

---

## 3. Volume reconciliation

### 3.1 The founder's fixture — NOT MEASURED

Not available (blocker above), so `Σ(volume over 391 rows)` vs the EOD daily volume for 2026-09-17 is not computed. The procedure, for when it is: sum `volume` over the 391 rows; take the EOD volume from `indexIntelligence/stockRankings` (Firestore, no credential here) or from one `/eod/AAPL.US?from=2026-09-17&to=2026-09-17&fmt=json` (1 unit, ASSUMED); report Σ/EOD and `row[16:00].volume / EOD`. Do not classify the 16:00 row (F-2).

### 3.2 MEASURED proxy — the in-repo AAPL 5-minute fixture, June 2026

`fixtures/sample-5m/AAPL_5m_2026-06.json` (5-minute bars, 2026-06-01 → 06-30, captured 2026-07-10 — `fixtures/README.md:54`) against `fixtures/daily/AAPL_eod_2018-01-01_2026-07-10.json`. Bars grouped by ET date (UTC−4); RTH = 09:30 … 15:55; the 16:00 row taken separately. 1,659 bars, 21 sessions, **79 bars each, every session running 09:30 → 16:00 inclusive**.

| ET date | Σ vol (78 RTH bars) | EOD volume | Σ/EOD | 16:00 row |
|---|---|---|---|---|
| 2026-06-01 | 36,722,740 | 48,849,900 | 75.17 % | present, `volume: null`, O=H=L=C=306.31 |
| 2026-06-02 | 33,076,567 | 44,534,700 | 74.27 % | present, null, flat |
| 2026-06-03 | 38,301,306 | 50,836,700 | 75.34 % | present, null, flat |
| 2026-06-04 | 28,829,520 | 44,869,100 | 64.25 % | present, null, flat |
| 2026-06-05 | 51,303,426 | 65,310,500 | 78.55 % | present, null, flat |
| 2026-06-08 | 64,003,663 | 77,949,100 | 82.11 % | present, null, flat |
| 2026-06-09 | 58,634,763 | 70,108,800 | 83.63 % | present, null, flat |
| 2026-06-10 | 42,651,843 | 52,793,300 | 80.79 % | present, null, flat |
| 2026-06-11 | 31,814,827 | 42,572,500 | 74.73 % | present, null, flat |
| 2026-06-12 | 30,634,660 | 38,742,100 | 79.07 % | present, null, flat |
| 2026-06-15 | 45,108,814 | 45,732,600 | 98.64 % | present, null, flat |
| 2026-06-16 | 29,559,145 | 39,874,400 | 74.13 % | present, null, flat |
| 2026-06-17 | 28,949,447 | 42,745,100 | 67.73 % | present, null, flat |
| 2026-06-18 | 54,363,398 | 85,962,200 | 63.24 % | present, null, flat |
| 2026-06-22 | 30,103,364 | 44,879,900 | 67.08 % | present, null, flat |
| 2026-06-23 | 37,196,282 | 52,010,900 | 71.52 % | present, null, flat |
| 2026-06-24 | 34,185,618 | 53,081,900 | 64.40 % | present, null, flat |
| 2026-06-25 | 89,039,509 | 107,013,700 | 83.20 % | present, null, flat |
| 2026-06-26 | 95,963,261 | 261,775,500 | **36.66 %** | present, null, flat |
| 2026-06-29 | 47,529,761 | 66,427,000 | 71.55 % | present, null, flat |
| 2026-06-30 | 38,893,285 | 65,100,200 | 59.74 % | present, null, flat |

**Σ/EOD: median 74.27 %, mean 72.66 %, min 36.66 % (Fri Jun 26), max 98.64 %.** The 16:00 row's share of EOD volume is **undefined on this endpoint — its `volume` is `null` on all 21 sessions**, with O=H=L=C. That is byte-for-byte the "synthetic close-print bar" that `fetchIntradayCandles` strips (`marketDataCache.js:851-858`, VERIFIED: `volume === null || undefined` AND `open === high === low === close`), documented there as "verified empirically across 4 sessions." (MEASURED; the script ran in the session scratchpad and touched nothing in the tree.)

**What this does and does not say.** It is 5-minute, not 1-minute; June, not Sep 17; and the vendor's 5-minute close-print row carries no volume, so this endpoint cannot show the 16:00 share at all. It does establish, on 21 sessions, that the **intraday bar sum is systematically below the EOD daily volume by roughly a quarter**, with a wide tail (the 36.66 % session is a Friday with ~4× normal EOD volume). Whether the founder's 1-minute 16:00 row carries the difference is exactly F-2, and is left to the vendor.

---

## 4. Bulk quote endpoint

**NOT MEASURED** — no key. Response size, symbol count, latency and the 255-name coverage check were not run. **Units spent: 0.** Expected charge per the task: 100 (ASSUMED, documented figure; the founder's dashboard delta is the measurement of record when supplied).

**What the repo knows (VERIFIED):**
- The only bulk consumer is `compute-rankings.js:1489-1491`: `` `${API_BASE}/eod-bulk-last-day/US?api_token=${API_KEY}&fmt=json` ``, once per weekday (`0 11 * * 1-5`), its comment says "(1 call)" (`:1486` — item 1.7 row 6). The code reads only `entry.code || entry.symbol` and `entry.close` (`:206-215`, `:757-761`); no other field is consumed.
- The 255-name universe is `INDEX_SYMBOLS` (5: SPY, QQQ, DIA, IWM, RSP — `compute-index-intelligence.js:80-86`) + `SECTOR_ETFS` (11 — `rankingConfig.js:362`, length MEASURED by import) + `ALL_TICKERS` (239 — `rankingConfig.js:359`, MEASURED) = 255, assembled at `compute-index-intelligence.js:738-742`.

**What the vendor documents (ASSUMED, to be confirmed by the founder's call):**
- `/eod-bulk-last-day/{EXCHANGE}` returns one row per listed symbol on the exchange (US: order of 10⁴ rows, low single-digit MB), fields `code, exchange_short_name, date, open, high, low, close, adjusted_close, volume`; `&symbols=` narrows it; `&date=YYYY-MM-DD` selects a past session; `&filter=extended` adds prior-close/change and average-volume columns. Cost **100 units per request** regardless of `symbols`.
- It is an **end-of-day** product: it carries a `date`, **not** a `timestamp`, and does not update intraday. So the task's five-field check (`volume, high, low, close, timestamp`) fails on `timestamp` by construction, and the row is the prior session's bar during RTH.
- This session knows of **no** EODHD endpoint that returns live/delayed quotes for a whole exchange without a symbol list. `/real-time/` needs symbols and bills 1 per ticker (item 1.1). If "bulk US live" means a `/real-time/` request with the full universe in `s=`, its charge is 255, not 100, and the request is the same per-ticker rule Phase 0 measured.

**The one design use the bulk endpoint does have:** an EOD daily volume for the whole universe in **100 units** (one request with `date=`) instead of 239 `/eod/` requests — relevant to seeding an RVOL baseline, not to polling.

The request to run: `curl -sS -w '\n%{size_download} bytes %{time_total}s\n' "https://eodhd.com/api/eod-bulk-last-day/US?api_token=<KEY>&fmt=json" -o bulk.json` then count `code`s and intersect with the 255 names.

---

## 5. Exchange calendar

**Vendor endpoint — ASSUMED throughout (not called; not in the repo).** `GET /api/exchange-details/US?api_token=…&fmt=json` returns `{ Name, Code, OperatingMIC, Country, Currency, Timezone, isOpen, TradingHours: { Open, Close, OpenUTC, CloseUTC, WorkingDays }, ExchangeHolidays: { "0": { Holiday, Date, Type }, … }, ExchangeActiveTickers, ExchangeUpdatedTickers }`, with optional `from=`/`to=` on the holiday range. Cost **1 unit per request**. **Early closes:** the documented `ExchangeHolidays[].Type` vocabulary is `official` / `bank`; this session has **no evidence that half-days are represented at all**. Build 1 must fetch it and look for `2026-11-27` before relying on it; if absent, the platform's own list (below) stays the source of record for early closes.

**Platform state (all VERIFIED):**
- **Not called anywhere.** Zero hits for `exchange-details`, `exchanges-list`, `trading-hours` / `tradingHours` across `api/` and `src/`.
- **The equivalent is hard-coded** in `api/_utils/marketSchedule.js`: `NYSE_HOLIDAYS_2026` (`:32-43`, 10 dates), `NYSE_EARLY_CLOSE_2026` (`:46-49`: 11-27, 12-24), `NYSE_HOLIDAYS_2027` (`:52-63`), `NYSE_EARLY_CLOSE_2027` (`:68-70`: 11-26 only), `EARLY_CLOSE_HOUR = 13` (`:28`), `MAINTAINED_HOLIDAY_YEARS = [2026, 2027]` (`:77`), `isMarketHoliday` (`:111`), `isEarlyCloseDay` (`:128-131`), and early-close-aware `isMarketOpen` / `getMarketState` / `getNextMarketClose` (`:158-176`, `:180-215`, `:258-291`). A TODO asks for 2028 "by December 2027" (`:10`).
- **Eight files carry the 2026 holiday list** (`marketSchedule.js:12-14` says so; grep confirms): `api/_utils/marketSchedule.js`, `api/_utils/marketHolidayCheck.js`, `api/cron/snake-draft-daily-scores.js`, `api/cron/compute-daily-baggerbomb-levels.js`, `api/cron/process-draft-claims.js`, `src/constants/battleTimingV4.js`, `src/data/staticMacroEvents.js`, `src/utils/marketHolidays.js`. **Only two carry early closes:** `marketSchedule.js` and `src/data/staticMacroEvents.js:171-172` (`type: 'early_close', time: '13:00'`, accessor `getEarlyClose` `:216-218`). The other six treat an early-close day as a full session.
- **Early-close-aware consumers on the intraday/tournament paths:** `filterToLatestSession` clips the session window at 13:00 on early-close dates (`marketDataCache.js:1065-1067`); `mandateSessionSlots.js:87-99`; `mandateCalendar.js:119`; `tournamentTime.js:85`; `correlationAssembly.js:141-149`; `agentBattleService.js:378-379` (battle expiry via `getNextMarketClose`).
- **Nothing caches a vendor calendar.** No `exchangeCalendar` / `marketCalendar` / `holidayCache` in `api/` or `src/`; the only `tradingCalendar` is the scrapped season mode's per-season array (`seasonCalendar.js:9`).

---

## 6. Indicator functions — `api/_utils/technicalCalculations.js`

All VERIFIED at this HEAD (file is 528 lines; header `:1-7` says "Pure math module … arrays of numeric data (newest-first)").

| Function | Signature | Input | Minimum length | Seed | Smoothing | Output | Batch or incremental |
|---|---|---|---|---|---|---|---|
| `calculateRSI` `:61-97` | `(closes, period = 14)` | newest-first closes; reversed internally `:65` | `period + 1` `:62` | **SMA seed** — simple mean of the first `period` gains and losses `:76-78` | Wilder: `avg = (avg × (period−1) + x) / period` `:80-83` | `{ value: 2dp, zone }` or `null`; `avgLoss === 0 → 100` `:85-94` | **Batch, latest only** |
| `calculateRSISeries` `:112-148` | `(closes, period = 14)` | same | same | same SMA seed `:124-130` | same Wilder loop `:135-142` | full series newest-first, nulls for the first `period` bars | **Batch, whole series** |
| `calculateEMASeries` `:158-181` (private) | `(data, period)` | **oldest-first** | `period` | **SMA seed** at index `period−1` `:169-173` | `ema = (x − prev) × 2/(period+1) + prev` `:176-178` | series with leading nulls | Batch |
| `calculateMACD` `:194-233` | `(closes, fast = 12, slow = 26, signal = 9)` | newest-first; reversed `:198` | `slow + signal` = **35** `:195` | fast/slow EMAs via `calculateEMASeries` (SMA-seeded); signal = EMA(9) **over the valid MACD values only** `:214-219`, itself SMA-seeded | as above | `{ macd, signal, histogram }` at 4dp, **latest only** `:221-232` | **Batch, latest only** |
| `calculateEMA` `:32-47` | `(closes, period)` | newest-first | `period` | SMA seed `:39` | standard | scalar 4dp | Batch |

**Can they be driven one bar at a time with persisted state?** **No — not as written.** None accepts or returns state: no `prevEma`, `avgGain`, `avgLoss` or seed-buffer parameter exists in the file, and no incremental/streaming indicator exists anywhere in `api/_utils/` (VERIFIED by grep). Each call recomputes from the full array. Two consequences a build must respect:
1. **Wilder RSI is path-dependent.** Its value at bar *n* depends on every bar since the seed; `calculateRSI` over a 15-bar window and over a 200-bar window ending at the same bar return **different numbers**. "Recompute batch over a persisted rolling window" therefore does not reproduce the existing function unless the window is the same one the batch caller uses. An incremental `rsiStep({ avgGain, avgLoss, prevClose }, close)` reproduces `calculateRSISeries` exactly only if its seed phase copies `:124-130`.
2. **MACD's signal line is seeded on the valid-MACD subsequence** (`:214-219`), so an incremental implementation must start the signal EMA at the 34th bar's MACD value (the first bar with both EMAs defined) — not at bar 9. New functions are needed: an EMA step, a MACD step composed of three EMA steps, and an RSI step, each with an explicit seed-phase state machine.

**Who calls them today, and on what bars:** `compute-index-intelligence.js:407-410` (index RSI/MACD, daily), `:963-973` (per-stock RSI + MACD and previous-bar MACD for the cross, daily), `:1088` (`calculateRSISeries`, daily), `api/research/breakContext.js:85` (daily) — all VERIFIED. The client mirror is `src/services/technicalIndicators.js:120` / `:212` (parity ASSUMED per the server header `:6`). **No caller passes intraday bars.** `anticipationThresholdLint.js:9` states the fact in code: "5-minute MACD histogram (never computed anywhere)" (VERIFIED comment); `MACD_5M` is in its `NEVER_PRESENT_SIGNALS` set (`:56`, `:74`). `marketDataCache.js:222` and `:268` document that `calculateMACD`'s 35-row minimum is why the daily window is sized as it is.

---

## 7. Crypto consumers

**Routing primitives (VERIFIED):** `isCryptoSymbol` = `-USD.CC` / `.CC` suffix or membership of `VALID_CRYPTO_SYMBOLS` (`marketDataCache.js:76-80`); `formatEODHDSymbol` → `{SYM}-USD.CC` (`:86-90`); `CRYPTO_FIELDS = ['daily','technicals','news']` — no fundamentals/earnings (`:51`, `:570`); crypto **never** receives the closed-market TTL extension (`marketSchedule.js:312-318`, `:345-348`; `marketDataCache.js:132`). The agent crypto pool is `agentCryptoAssets.js:5-11` (BTC/ETH/SOL/BNB … `baseATR` 5–6). `hasCryptoInPortfolio` looks at star/core/support only (`agentBattleService.js:363-366`; "crypto lives inside support[2]", `:361`).

| # | Path | Anchor | Feed | When it runs | Marker |
|---|---|---|---|---|---|
| A1 | `agent-evaluate` macro line `BTC-USD.CC` | `agent-evaluate.js:705`, `:758` → `agentEvalPromptAssembly.js:1139` (fenced, read) | `/real-time/BTC-USD.CC` via the `:721` loop (delayed quote) | every evaluating tick — **09:30–16:00 ET only** (`:303-306` guard) | VERIFIED |
| A2 | `agent-evaluate` held/bench crypto price | `:721` (same loop; `allSymbols` `:710`); badge baseline on the **UTC** day `:803-811`, `:853-861` → `baselineValidation.js:233-234` | `/eod/` + `/real-time/` with `.CC` suffix | same ticks | VERIFIED |
| A3 | `agent-evaluate` intraday for a held crypto | `:958` → `marketDataCache.js:796-799` (`.CC` routing); then `filterToLatestSession` applies the **ET RTH window with no crypto branch** (`:1032-1076`) | `/intraday/{SYM}-USD.CC` 5m | same ticks | VERIFIED |
| A4 | Battle close for a crypto book | `agentBattleService.js:377-379` → `getNextMarketClose({ cryptoExtended: true })` = **20:00 ET** (`marketSchedule.js:255-271`), except early-close days | — | at battle creation; expiry completed by the sweep "regardless of market hours" (`agent-evaluate.js:230`) with **no price fetch** (`completeBattle` `:4486`) | VERIFIED |
| A5 | `agent-daily-scores` | `:257-260` (`['daily','price']`), crypto guard-2 with `utcToday` `:65-66`, `:98-106` | `/eod/` + `/real-time/` `.CC` | `45 1 * * 2-6` = **21:45 ET** (Phase 0 §5.1 row 6) | VERIFIED |
| A6 | `voice-layer-cache` | `fetchBulkPrices` formats **every** symbol as `{sym}.US` (`:55`), and `allSymbols` includes star/core/support (`:842-849`); bench crypto explicitly skipped (`:835-838`, `:860`) | `/real-time/{SYM}.US` — a held crypto is requested as `BTC.US` | `*/15 13-20 * * 1-5` | VERIFIED — held crypto gets no voice-cache price |
| A7 | `compute-daily-baggerbomb-levels` | `fetchStockPrices` splits stocks/crypto, `-USD.CC` (`:120-125`), batches of 20 (`:138`) | `/real-time/` | `30 1 * * 2-6` = **21:30 ET** | VERIFIED |
| A8 | `snake-draft-daily-scores` | `fetchStockPrices` joins raw pick symbols into `/real-time/{list}` with **no suffix logic** (`:174-186`, `:580-593`) | `/real-time/` | `15 21 * * 1-5` = 17:15 ET | VERIFIED — crypto handling depends on the stored symbol string (ASSUMED absent) |
| A9 | Tournament user layer: `fetchBatchQuotes` (crypto-aware, `tournamentPrices.js:57-60`) | `canonicalOpen.js:68` (open capture sweep, from `agent-evaluate.js:316`), `tournamentBanking.js` via `snake-draft-daily-scores.js:482`, `tournamentLiveComposite.js:98`, `api/tournament/flip.js:108`, `marketDataCache.js:949-950` wrapper | `/real-time/` `.CC` | sweep: evaluating ticks; banking: 17:15 ET; flip: user-driven | VERIFIED |
| A10 | Mandate path | `mandateUniverseSnapshot.js:32` quotes via `fetchBatchQuotes`; corporate actions `.US`-only (`:317-320`) | `/real-time/` | `*/15 14-22` | VERIFIED — equities universe |
| A11 | User routes | `api/crypto/prices.js:40-41` (`/real-time/{SYM}-USD.CC,…`, returns `open/high/low/volume/timestamp`), `api/crypto/metrics.js:46-51` (`/eod/`), `api/stocks/historical.js:166`, `api/volatility/thresholds.js:217-218`, `api/research/driverRegistry.js:302-311` (BTC driver) | as named | on request | VERIFIED |
| A12 | Client | `src/services/eodhdAPI.js:266-296` (`getMultipleCryptoPrices` → `/api/crypto/prices`, cache `'crypto'`), `useArenaPriceContext.js:30-55` (60 s REST poll for the user's picks), `buildArenaModel.js:246-248` (crypto degraded-null fallback), `websocketService.js` crypto socket (inert since `b4ff276e`, Phase 0 §3) | proxy routes | while a battle view is open | VERIFIED |
| A13 | Fenced logic (read-only) | `agentSwapExecution.js:70-71`, `:223`, `:285-290`, `:326` (crypto↔crypto slot exclusivity, `baseATR` 5.0 default, `direction`); `agentRiskManager.js:402`, `:445` (replacement must match crypto-ness); `decide.js:1180-1182` (`support_crypto: 'BTC'`, `bench_crypto: 'ETH'`) | — | draft / swap time | VERIFIED |

**What breaks if crypto prices come only from an equities-hours poller (the spec's question):**
1. **On the agent evaluator, nothing new** — it is already equities-hours-only (`:303-306`), and a crypto book's 16:00–20:00 ET extension (A4) is **already unpriced by the evaluator today**. The evaluator's crypto VWAP is already an ET-RTH-window VWAP (A3).
2. **Two nightly crons would regress**: `agent-daily-scores` (21:45 ET, A5) and `compute-daily-baggerbomb-levels` (21:30 ET, A7) price crypto **after** equities hours today; fed from an equities-hours poller they would bank badge points and levels off a **≈ 5.75-hour-old** print for a 24/7 asset, and `previousClose` for crypto is the UTC-day boundary the code already acknowledges (`baselineValidation.js:234`).
3. **The voice layer would not notice** — it has no crypto price now (A6).
4. **The tournament user layer** (A9) banks at 17:15 ET and flips on demand; a user pick in crypto would carry a 16:00 print into a 17:15 bank.
5. The user routes and the client poll (A11–A12) are independent of any poller.

---

## 8. Firestore volume

### 8.1 Recorded figures — none measured

- `68723eee` (2026-03-17, "feat: firestore read optimization — cut estimated reads by 70%"): body says "Estimated impact: 50K reads/day → ~12-15K reads/day" — an **estimate of client-side reads**, produced with `src/utils/firestoreReadCounter.js` (added in that commit: a **dev-mode console counter**, `trackRead(source, count)`, `if (!isDev) return;` — it persists nothing and never ran in production). It also moved `snake-draft-autopick` `* * * * *` → `*/5` and `lobbies/cleanup-expired` `*/5` → `*/15` (Phase 0 §5.2). VERIFIED.
- **No later audit records a measured daily read or write count.** A grep of `docs/` and the root `*.md` for `reads/day`, `K reads`, `reads per day`, `writes/day`, `document reads/writes`, `read quota`, `quota exhaust` returns no figure (VERIFIED by absence). Two per-path counts exist in prose: `docs/audits/2026-06-10_TOURNAMENT_DESIGN_AUDIT.md:80` ("~15 Firestore reads (:454-462); ≥1 doc write (:1560)" per battle per tick, June anchors) and `docs/audits/20260912_PHASE0_SHADOW_ASSEMBLY.md:23, :150` ("14–24 extra document reads" per institutional-agent tick under the shadow pair, now dark).
- A remote branch `origin/claude/fix-firestore-quota-exhaustion-TNld9` exists (VERIFIED name only; not read — not on `main`).

### 8.2 `agent-evaluate` per battle per evaluating tick, from code at HEAD

Quiet tick = HOLD, no swap, non-tournament, agent without institutional rules, not the first tick. All anchors VERIFIED.

| Op | Anchor | Reads | Writes |
|---|---|---|---|
| Active-battle query (run-level, all 36 fires) | `agentBattleService.js:43-50` | B per fire (1 amortised per battle-tick; **36 × B per day** because the expiry sweep runs on skipped fires too) | — |
| GC-repair query (run-level) | `agent-evaluate.js:297`, `:4844-4850` | ≥ 1 per fire | — |
| Lock transaction | `:568-601` | 1 | 1 |
| Migration guard | `:628-645` | — | 1 only for pre-Sprint docs |
| Price loop `getStockAnalysisData(forceRefresh)` — **no cache reads** (`marketDataCache.js:622-632` skipped) but **one `marketDataCache/{SYM}_daily` `.set()` per symbol** on every fresh daily fetch (`:657-659` → `:188-194`) | `:721` | 0 | **≈ 34** (one per `allSymbols` member; plus one per hotBench/catalyst/proposal symbol fetched at `:1088`, `:1919`, `:3231`) |
| `stockRankings` doc | `:959` | 1 | — |
| `stockTechnicalScores` `getAll` over held ∪ bench | `:954-955`, `:960` | ≈ 10 | — |
| `marketContext` + `SPY` `getAll` | `:961-964` | 2 | — |
| `fetchRecentNews`: one query per symbol, ≤ 10 symbols, `limit(2)` | `:1887` → `agentTriggerGate.js:200-217` | 10 queries, ≤ 20 docs (an empty query still bills one read — ASSUMED vendor billing) | — |
| `regimeAtStart` transaction (first tick only) | `:1178-1184` | 1 | 1 |
| `controlEpochLog` append (only when an epoch changes) | `controlSuppressionTelemetry.js:234` | — | conditional |
| Institutional context (only agents with an `institutional` rule) | `agentEvalPromptAssembly.js:891-919` | ≈ |symbols| + 1 | — |
| Shadow capture | `shadowAssemblyCapture.js:257-262` | 0 — `SHADOW_ASSEMBLY_ENABLED = false` (`featureFlags.js:1482`) | 0 |
| Final flush (exactly one of the five paths, or the CPU-passive path) | `:941`, `:1822`, `:1839`, `:1879`, `:1958`, `:3113`; helper `agentCronState.js:38-49` | — | 1 |
| Swap paths (per swap): `refreshBattleFromDoc` `:481`; `agentSwapExecution.js:118` update + `:144` price refresh (fenced, read); narration `voiceLayerTradeNarration.js:98`, `:275`; anticipation `voiceLayerAnticipation.js:182`; tournament ledger `tournamentAgentLedger.js` (27 op sites) | as listed | +1–3 | +2–6 |
| **Quiet tick total** | | **≈ 24–34 reads** | **≈ 36 writes** |

Per active battle per day at 26 evaluating ticks: **≈ 620–880 reads and ≈ 940 writes**, plus 36 × B doc reads from the run-level query. **The dominant term is not the battle document — it is the ~34 fire-and-forget cache writes per tick**, each rewriting a `{SYM}_daily` document that holds the full daily OHLCV window, and each rewritten once per battle that holds the symbol (the loop is per battle, `:718-732`). The battle document itself is written once per tick (plus the lock).

---

## 9. Every reader of evaluation entries, `evidence`, `vintages`, `statusFeed`, or the battle document wholesale

**The entry shape at the writer** (VERIFIED): `agent-evaluate.js:3016-3029` appends one entry per decided check and caps the array at **150**; `tickStamps.js:87` adds four keys per entry — `heard`, `evidence`, `vintages`, `candidates` — composed at `:334-345`. `evidence[sym]` carries **eight** fields: `px, chg, atrX, vwapDev, bbPct, nr7, regime, risk` (`:192-201`) — the `featureFlags.js:2339` comment says "nine"; the code says eight. `vintages` is one block per entry: `quote, vwap, techAt, fundAsOf, rankingsAt` (`:258-264`, Phase 0 §8.2). `heard` is `{ directiveThreadId, suppressed }` (read at `decisionRecord.js:648-655`). `statusFeed` is appended per tick and capped at **100 for agent battles, else 50** (`agent-evaluate.js:692`, `:3021-3028`).

### 9.1 Server-side readers

| # | Reader | Anchor | Fields read | Sink |
|---|---|---|---|---|
| S1 | **The decider's own next prompt** — `formatRecentEvals(battle.evaluations, 3)` | `agentEvalPromptAssembly.js:1279` → `:1389-1400` (fenced) | last 3 entries: `evalId, timestamp, decision, symbolOut, symbolIn, tier, rationale` (80 chars), `hypothesis` (60 chars) | **later prompt** (every evaluating tick) — a NEW key on an entry is invisible here unless the fenced formatter changes |
| S2 | Trigger gate | `agentTriggerGate.js:22-27` | `evaluations.length` only | forced_open trigger |
| S3 | Evaluator bookkeeping | `agent-evaluate.js:2050` (passes the array to S1), `:2163` (`length` → next `evalId`), `:3016-3029` (writer) | length | — |
| S4 | **Narrator YOUR RECORD block** — `buildYourRecordBlock({ evaluations, directive })` → `renderRecordEntry` → `renderEvidenceLines` | `voiceLayerPrompt.js:3205-3209` → `voiceLayerGrounding.js:348-380`, `:213-229`; facts via the **shared** `evidenceFactLines` (`decisionRecord.js:1003-1047`, keys `px, chg, atrX, vwapDev, bbPct, nr7, regime, risk`) and `provenanceLine` (`:1069-1098`, keys `fundAsOf, techAt, rankingsAt`) | last `RECORD_WINDOW` entries: `timestamp, triggers, decision, rationale, evidence[sym].*, vintages, heard` | **later prompt** (chat) — only under `grounded`; `VOICE_GROUNDING_MODE = 'shadow'` (`featureFlags.js:2271`) so no live user sees it today (shadow semantics per `:813-836`, ASSUMED) |
| S5 | Anticipation note | `voiceLayerAnticipation.js:97-100` | entry by `evalId` → `timestamp` | chat exchange (summary) |
| S6 | **Reflection** — `truncateBattleHistory` → reflection prompt | `agentReflectionUtils.js:155-221`, `:311-326`; called from `process-pending-reflections.js:79` (`generateReflection`) and `api/agent/reflect.js:52` | entries: first 3 + last 5 + SWAP/PROPOSAL middles → `evalId, timestamp, decision, conviction, scores.total, hypothesis`; `statusFeed`: last 10 + high-signal `timestamp, action, message`; `trades` all | **later prompt → `agent.memory[]`** (`reflect.js:132-133`) → **consolidation dossier** (`agentConsolidationPrompt.js:136-137` `{{agent.memory}}`) — **agent memory** |
| S7 | Reflection shadow log | `reflect.js:127` | `evaluations.length` | shadow log |
| S8 | `agent-batch-review` | `:189` (`e.day === currentDay`), `:198` | `day`, count; `statusFeed` at `:316`, `:337` (append) | gate only; lessons → `agents.lessons` arrayUnion (`:453-457`) come from trades, not entries |
| S9 | Shadow assembly capture | `shadowAssemblyCapture.js:196-200` (dark: flag false), `:430`, `:435-442` (settlement counts) | array (dark) / `length` | shadow diff / settlement record |
| S10 | Tournament projection | `tournamentBattleView.js:36-40` (`PUBLIC_TOP_LEVEL` **omits `evaluations`**), `:58`, `:87-89` (owner or completed → **whole doc unchanged**), `:95-96` (`statusFeed` → `timestamp, message, action, regime, score, symbolOut, symbolIn`); served by `api/tournament/battle-view.js:43` | as listed | client display; **owner/completed = wholesale** |
| S11 | `voice-layer-cache` | `:827` (all active docs wholesale) → `:929` `cronState.intradayMomentum`, portfolio, watchlist | not `evaluations`; the VWAP map | `voiceLayerCache/{battleId}` → narrator prompt (`buildIntradayLine`, Phase 0 §8.3) — **a summary that feeds a later prompt** |
| S12 | `agent-daily-scores` | `:230` (wholesale) | portfolio, prices, `thresholdHistory` — **not `evaluations`** (VERIFIED by grep) | banking |
| S13 | `api/agent/chat.js` | `:439` (wholesale) → `voiceLayerPrompt` | → S4 under `grounded`; `statusFeed` via `:1008` comment path | prompt |
| S14 | Other wholesale doc readers (no entry-field reads) | `chat-budget.js:47`, `debate.js:204`, `research.js:254`, `file-directive.js:192`, `ensure-opener.js:164`, `set-opponent.js:38`, `decide.js:711`, `:1364`, `tournamentOrchestrator.js:371`, `masterySettlement.js:278`, `:307`, `:679`, `backingSettlement.js:408`, `backing-stake.js:181`, `:207`; field-masked: `tournamentAgentLedger.js:596-600`, `tournamentBanking.js:63-65` | — | as named |

### 9.2 Client-side readers (the whole document arrives via `onSnapshot`)

| # | Reader | Anchor | Fields | Sink |
|---|---|---|---|---|
| C1 | `useAgentBattle` — **subscribes to the whole doc**; every byte on every entry reaches the browser | `src/hooks/useAgentBattle.js:49-58` | all | everything below |
| C2 | `deriveHeard` → `heardStamps` | `AgentBattleScreen.jsx:1496` → `deriveHeard.js:68` → `decisionRecord.js:644-658` | `heard.directiveThreadId, heard.suppressed, timestamp` | receipts (display) |
| C3 | `buildTape` → `buildCheckEntries` | `AgentBattleScreen.jsx:1506-1520` → `buildTape.js:214-320` | `timestamp, evalId, decision, downgraded, haikuError, scores.banked`, + C4 | tape (display) |
| C4 | `selectWhyState` | `selectWhyState.js:91-215` | `timestamp, triggers, haikuError.failureClass, rationale, downgraded, decision, symbolOut, symbolIn` | Why panel (display) |
| C5 | `selectEvidence` → `WhyPanel` | `selectEvidence.js:33-56` → `WhyPanel.jsx:219-230`; facts via `evidenceFactLines`, provenance via `provenanceLine` (same functions as S4) | `evidence[symbol].*`, `vintages`, `timestamp` | Why panel evidence + provenance line (display) |
| C6 | `selectBench` | `selectBench.js:73-120`, `:188-203` | `rationale`, `candidates` | bench pane (display) |
| C7 | `deriveTurnLine` | `deriveTurnLine.js:103-115` | latest entry `timestamp`, decision | turn line (display) |
| C8 | Tournament `Flat6BattleView` | `:221-231` | last 3 `rationale, hypothesis, evalId` | owner-only rows (display; S10 strips them for rivals) |
| C9 | `forgeStatsService` | `:71-95` | `citedForgeRules[].ruleId`, overrides | Forge stats (summary, display) |
| C10 | `statusFeed` consumers | `AgentBattleScreen.jsx:1508-1515`, `:1709`; `Flat6BattleView.jsx:193`; `statusFeedToVoice.js:52-53` → `buildArenaModel.js:439`; `presenceBinding.js:159-162` → `useAgentPresence.js:59-67`; `LiveActivityPanel.jsx:265-307`, `:398-407`; `AgentChat.jsx:1193-1248`; `AgentActivityFeed.jsx:654-679`; `HypothesisTicker.jsx:7-26`; `StatusFeedTimeline.jsx:263-269`; `ForgeCitationCard.jsx:37-41`; `GameTapeView.jsx:488-497`; `AgentDesk.jsx:76`, `:152-170` | entry `timestamp, action, message, hypothesis, citedRules…`, `length` | display, presence events, command-dot |
| C11 | Fixture / flag prose | `agentBattleScreenGoldenFixture.js:99`, `featureFlags.js:2333-2339`, `decisionRecord.js:200`, `:277` | — | tests / docs |

### 9.3 The diagnostic-exclusion list this yields

A per-symbol diagnostic added to an `evaluations[]` entry (a delay, an as-of instant, a source tag, a bar count) is **not read by any prompt renderer today** — S1, S4 and S6 each name their keys explicitly, and `evidenceFactLines` / `provenanceLine` are key-explicit (`decisionRecord.js:1003-1047`, `:1086-1097`). It **is** carried, byte for byte, by: the client subscription (C1), the owner/completed projection (S10), every wholesale doc read in S11–S14, the reflection cron's doc read (S6) and the 150-entry cap's storage cost. If it is placed on `evidence[sym]` instead of beside it, it also enters S4/C5 the moment `evidenceFactLines` learns the key. The four **prompt-feeding** readers a spec must list as exclusions or opt-ins are **S1 (fenced), S4 (shadow), S5, S6 (→ memory)**; the two **summary** paths are S11 and C9.

---

## 10. Index exemptions

| Fact | Anchor | Marker |
|---|---|---|
| Firestore config points at `firestore.indexes.json` and `firestore.rules` | `firebase.json:1-6` | VERIFIED |
| `firestore.indexes.json` is 566 lines: **37 composite indexes**, and `"fieldOverrides": []` — **empty** | `firestore.indexes.json:566` | VERIFIED |
| `fieldOverrides` has been touched by exactly one commit in reachable history (`79aa5c91`, the PR #800 merge); it has never held an entry | `git log -S'fieldOverrides' -- firestore.indexes.json` | VERIFIED |
| No `.firebaserc`; the project id (`tradeseven`) appears only in the drift doc's CLI examples | root listing; `FIRESTORE_INDEX_DRIFT_CLEANUP.md:38`, `:49` | VERIFIED |
| **CLI index deploys are blocked** since May 24 2026: `firebase deploy --only firestore:indexes` fails HTTP 400 on an `ingestedClaims` entry — "this index is not necessary, configure using single field index controls" — and prompts to delete 13+ production-only indexes. "All future Firestore index creation must be done manually via the Firebase Console until this is resolved." | `FIRESTORE_INDEX_DRIFT_CLEANUP.md:1-66` | VERIFIED (doc); production state ASSUMED |
| The drift doc prescribes where an exemption would live: "Single-field exemptions live in the `fieldOverrides` section of `firestore.indexes.json`, not the `indexes` section" — and none has been added | `FIRESTORE_INDEX_DRIFT_CLEANUP.md:59`, `:62` | VERIFIED |
| **No collection uses a single-field exemption in source.** The in-code mentions of "single-field index" all describe reliance on Firestore's **default** single-field indexes for one-filter queries, not exemptions | `useMyTournamentBattle.js:7`, `tournamentGroupService.js:364`, `moverCandidates.js:240`, `backingSettlement.js:439`, `liveDraftFormation.js:280`, `agent-batch-review.reviewPending.test.js:15` | VERIFIED |
| `agentBattles` has six composite indexes in the file (ownerId/agentId/createdAt; status/pendingReflection/completedAt; ownerId/status/completedAt; ownerId/agentContext.archetype/createdAt; status/completionReason/completedAt; agentId/resolvedAgentManifest.equippedConfigHash) | `firestore.indexes.json:202-309` | VERIFIED |

**What this means for build 1.** Any new per-tick field on `agentBattles` (a bars map, a per-symbol vintage map, a diagnostics array) is indexed by every default single-field index Firestore creates for map sub-fields and array members, which is the write-cost and the 40,000-index-entries-per-document ceiling the spec has to price (vendor limits ASSUMED). Turning that off is a `fieldOverrides` entry that **cannot be deployed from this repo today** — it would be a console action, repeated by hand, until the drift-cleanup workstream lands. The same applies to any composite index the poller's reads need.

---

## External-call ledger

| Call | Endpoint | Attempts | Units |
|---|---|---|---|
| Item 2 — prior-session 1m window | `/intraday/AAPL.US?interval=1m&from=&to=` | **0** (no key) | 0 |
| Item 3 — EOD volume | `/eod/AAPL.US` or Firestore `stockRankings` | **0** (no key / no Firebase credential) | 0 |
| Item 4 — bulk | `/eod-bulk-last-day/US` | **0** | 0 |
| Item 5 — calendar | `/exchange-details/US` | **0** | 0 |
| **Total** | | **0** | **0** |

Network operations made: `git fetch origin` (start), `git push -u origin claude/phase0-intraday-addenda` (end). No other host was contacted. The item 3 proxy ran `node` over two files already in the tree, from the session scratchpad; the script is not committed.

---

## Facts that constrain build 1

1. **Budget:** the fixed baseline is **≈ 9,010 units/weekday** and each active battle adds **≈ 2,888 units/day** (98 per evaluating tick × **26** ticks — the `isMarketOpen()` guard at `agent-evaluate.js:303-306` skips 10 of 36 fires); an `/intraday/`-per-symbol poll is **93,210 units/day at 5 minutes** and cannot be the primitive — only quotes (1/ticker) or a bulk request can carry a universe poll; seeding + validation at 255 names cost **1,275 units/day each**; eight shipped comments (item 1.7) still count requests.
2. **Publish time is unmeasured** — 0 attempts; the founder's ≤ 27 h bound is the only evidence, and the repo already records two production cases of today's bars being absent while the prior session's were present (`marketDataCache.js:787-789`; `agentVwapFloor.js:3-4`).
3. **On 21 measured 5-minute sessions the bar sum is ~74 % of EOD volume** (range 37–99 %) and the vendor's 16:00 row on that endpoint carries **`volume: null`** — the row `fetchIntradayCandles` already strips (`marketDataCache.js:851-858`); the 1-minute fixture's 16:00 share is unmeasured and unclassified (F-2).
4. **The only bulk endpoint is end-of-day** (`compute-rankings.js:1490`; 100 units, `date` not `timestamp`, ASSUMED) — it can seed an EOD-volume baseline for 255 names in one request but cannot poll; no symbol-less live endpoint is known.
5. **The exchange calendar is not fetched anywhere;** `marketSchedule.js` is the source of record (2026–2027, early closes 13:00 ET) with eight sibling copies, six of them early-close-blind; whether the vendor endpoint represents half-days at all is ASSUMED-unknown and must be checked before it replaces the list.
6. **`calculateRSI` / `calculateMACD` are batch, latest-only, SMA-seeded, stateless** (`technicalCalculations.js:61-97`, `:158-233`); a one-bar-at-a-time poller needs **new step functions** whose seed phases copy `:76-78` and `:169-173`/`:214-219`, and Wilder RSI's path dependence means a "rolling window recompute" is not the same number as the batch call over a longer window; no caller feeds intraday bars today.
7. **The agent evaluator is already equities-hours-only** (`:303-306`) while a crypto book closes at **20:00 ET** (`agentBattleService.js:377-379`); an equities-hours poller regresses only the two nightly crons that price crypto after hours (`agent-daily-scores` 21:45 ET, `compute-daily-baggerbomb-levels` 21:30 ET) and the user-layer bank at 17:15 ET; the voice cache already has no crypto price (`voice-layer-cache.js:55`), and `filterToLatestSession` already clips crypto to the ET RTH window (`marketDataCache.js:1065-1076`).
8. **No measured Firestore volume exists** (only the Mar 17 client-side *estimate*); from code a quiet evaluating tick costs **≈ 24–34 reads and ≈ 36 writes per battle**, and **~34 of the writes are `marketDataCache/{SYM}_daily` rewrites** issued by the `forceRefresh` price loop (`marketDataCache.js:657-659`), once per battle per symbol — that, not the battle doc, is the write term a poller changes.
9. **No prompt renders an unknown key on an evaluation entry** — the four prompt-feeding readers (`formatRecentEvals` fenced `:1389-1400`; the narrator's record block, shadow-only; the anticipation note; the reflection prompt → `agent.memory[]`) and the two shared renderers `evidenceFactLines` / `provenanceLine` are key-explicit — but every byte of every entry reaches the browser (`useAgentBattle.js:49`), the owner/completed projection, and the reflection cron's wholesale read, under a 150-entry cap.
10. **Single-field exemptions are console-only today:** `fieldOverrides` is empty (`firestore.indexes.json:566`), no collection uses one, and CLI index deploys have been blocked since May 24 2026 (`FIRESTORE_INDEX_DRIFT_CLEANUP.md`) — a bars map on `agentBattles` is fully auto-indexed unless someone exempts it by hand.
