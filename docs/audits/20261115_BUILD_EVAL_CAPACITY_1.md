# Evaluator capacity, Build 1 — the pool, the EODHD guard and cuts, the limits on record (dark)

**Date:** 2026-11-15 (Sunday) · **Branch:** `claude/eval-capacity-build1` · **Basis:** `docs/audits/20261115_PHASE0_EVAL_FANOUT.md` (PR #1069, merged into this branch) · **Review record:** `docs/audits/20261115_BUILD_EVAL_CAPACITY_1_REVIEW.md`

**Markers (BUILD_RULES §3).** **VERIFIED** = read at that `file:line` in this session. **MEASURED** = produced by a run in this session (the dark proof, the suites, the battery, the sweep). **ASSUMED** = not checked, with the reason. Line numbers are at the final code commit `97dff8d8` and drift.

---

## Verdict

| Part | What it does | Shipped state | Proof |
|---|---|---|---|
| **1. The pool** | The handler's sequential loop becomes a dispatcher: at most K battles checked at once, started in rotation order; a start cutoff; deferred = never started; League group-mates never in flight together; one capture scope and one catch per battle. | `EVAL_POOL_K = 1` — **today's loop** | Dark proof against `origin/main`: **16 cases, 128 comparisons, 0 differences**. 22 dispatcher rows + 14 handler rows. |
| **2. EODHD fetch guard** | Every EODHD request in `marketDataCache.js` goes through one helper: a 10 s timeout (dispatch → end of body) and a process-wide limit of 32 in flight. | `EODHD_FETCH_GUARD_ENABLED = false` — `fetch(url)` exactly; only counted | 19 guard rows. A full-suite sweep with the flag ON lists what the flip PR must change (review §6). |
| **3. Market-data cuts** | Daily bars once per symbol per ET session (reused only when the series holds the expected prior-session bar); SPY, QQQ, BTC-USD.CC once per run, never for a battle that owns the instrument. | `EVAL_MARKET_DATA_CUTS_ENABLED = false` | 44 rows. Dark-proof control with the flag ON: in all 16 cases the battle writes, the model requests, the run record and the response are identical to `main`; only cache writes and EODHD traffic change. |
| **4. The limits on record** | The run record gains `pool`, `anthropic` (from the `anthropic-ratelimit-*` response headers) and `eodhd` (requests by endpoint, timeouts, non-2xx) blocks; the read script prints them per session. | **Live from merge** | 28 rows — 18 unit rows (4 of them through the **real** SDK 0.71.2) and 10 handler rows through an SDK double, with tick capture on and off — plus 8 script rows. |

**Units per agent-mode check (from the code, the discovery's B4 method):** flag off **117** (unchanged); flag on **≈ 74.6 + 3 ÷ B** (B = battles per run): ≈ 77.6 with one battle per run, → ≈ 74.6 as runs fill, toward 73 only as battles share symbols. Per battle-day **3,042 → ≈ 1,940–2,020**. §5.5.

**Review:** 5 lenses, 42 findings, each refuted or verified; no defect at the shipped values, no fence contact; one high (a test gap, no code defect) and eleven medium, all fixed with rows. **Mutation:** **123 / 123 killed** at the final code — the builder's 88 and the test-integrity lens's own 35.

**Nothing in a fenced file, `agentEvalTransport.js` or `vercel.json` changed** (§10). No production read, write, deploy, flag flip or setting change was made.

---

## 0. Preamble (BUILD_RULES §2, §3)

| | |
|---|---|
| Fetch | `git fetch origin` was the first step. `origin/main` = `ea5e0c5b406cf9060c42d32ee8e754998e4fb280` (merge of #1068); still that commit at the final checks. |
| Branch | `claude/eval-capacity-build1`, cut from `origin/main` at `ea5e0c5b`; **clean tree** at the start. |
| Discovery branch | `scripts/eval-capacity-read.mjs` exists only on `origin/claude/phase0-eval-fanout` (PR #1069, a draft). It was **merged** into this branch (`187ef495`) rather than copied, so #1069 landing first leaves no add/add conflict. Merge #1069 first; this PR's own diff is then `187ef495..HEAD`. |
| Commits | `fddbc826` the build · `4406c6e4`, `2e125db8` rows · `c9fe26b2` report draft (the reviewed commit) · `0de5b894`, `29e42a78` the review's fix round · `97dff8d8` the test-integrity lens's rows · then the report and review record (docs only) |
| Files changed (own diff) | 22 code and test files plus these two reports — over the BUILD_RULES §2 review threshold; the review is §11 and its record. |
| Production | **None touched.** No Firestore read or write, no EODHD or Anthropic call, no deploy, no flag flip, no environment variable, no Vercel or Firebase setting. The one external page read was Anthropic's public rate-limits documentation (§6). |
| Ids | None in code, tests, fixtures, output or this report. |
| Linux | WSL worktrees of `~/pd-ci` (`pd-ci-cap1` with its own `npm ci`, lockfile `40382e64edb6` = `main`'s; `pd-ci-cap1dp` for the dark proof and the battery), `TZ=UTC`, `--maxWorkers=8`, full suites under `flock /tmp/pd-suite.lock`. No other session's tree was touched. |
| Report copy | A byte copy is kept outside the repo tree in the session scratchpad (BUILD_RULES §3). |

---

## 1. Founder rulings (15 Nov 2026) — verbatim

| # | Ruling |
|---|---|
| R1 | **The beta's planning target is 25 players in battles at the same time.** |
| R2 | **EODHD plan: 100,000 calls a day.** The per-minute limit is not known; plan against 1,000 a minute (the public plan's figure, as the discovery assumed). |
| R3 | **The Anthropic organisation's rate limits are not known** (no spend or rate limit was set by the founder; Anthropic's per-tier limits still apply). This build reads them from the API's own response headers and records them; nobody looks them up by hand. |
| R4 | **Shape (d), the pool,** is built first, shipped at K = 1. K is not raised above 2 until the market-data plan for 25 players lands (a separate spec). |
| R5 | Everything that changes behaviour ships dark behind its own flag. Observability fields in the run record are live from merge. |
| R6 | This work belongs to the capacity lane (this chat), not the BaggerBomb revamp. The revamp's code-only pass for stops (BB-7) is **not** in this build. |

---

## 2. The gate, re-verified at this HEAD

All VERIFIED at `97dff8d8`; the prompt's numbers were from `0b720acc` / `ea5e0c5b`.

| Prompt anchor | Now | Note |
|---|---|---|
| handler `:288` | `api/cron/agent-evaluate.js:297` | |
| release read `:488` | `:503` | still one forced read per run, before the first dispatch |
| sort `:517-519` | `:532-534` | unchanged |
| loop and budget break `:522-536` | the dispatcher `:544-628` | §3 |
| per-battle scope and catch `:547-576` | `:589-627`, inside the pool's `run` | body unchanged, re-indented |
| deferred beats `:579-582`, `:701-726` | `:631-634`; `writeDeferredBeats` unchanged | |
| `composeEvalRunRecord` `:641-661`; write `:668-684` | `:711-737`; `writeEvalRunRecord` `:768-787` | three blocks added at the end |
| Anthropic client `:245-272` | `:254-281`, **byte-identical** | the observing fetch only when `TICK_CAPTURE_ENABLED` (`:277`) |
| `processAgentBattle` `:926` | `:1029` | signature unchanged |
| price fan-out `:1185-1227` | `:1288-1345` (macros `:1301`, the fetch `:1326`, Guard 2's series `:1313`, `:1332-1333`) | |
| admission test `:3067` | `:3185` | unchanged |
| `messages.create` `:3215` | `:3333` (`response = await anthropic.messages.create(` — the literal kept) | |
| `TIME_BUDGET_MS` `:238` | `:251` | |
| `getStockAnalysisData` `:560` | `api/_utils/marketDataCache.js:570`; the daily branch `:632-683`; the narrow-payload comment `:602-627` | |
| `fetchDailyOHLCV` `:352-375` · `fetchRealTimePrice` `:792` · `fetchIntradayBatch` `:947-973` | `:356-379` · `:802` · `:965-994` | |
| the seven bare `fetch(url)` | `eodhdFetch(url, kind)` at `:361`, `:388`, `:458`, `:481`, `:509`, `:805`, `:889` | |
| `CACHE_TTL` `:30-34` | `:34-41` | unchanged |
| timeout precedents | `intraday/intradayFetch.js:34-47` (AbortController + setTimeout, 10 s; `mapConcurrent` 4); `eodhdDailyWindow.js:42` (`AbortSignal.timeout`) | |

**The discovery's Part C.** Items 6 (dispatcher), 10 (EODHD burst) and 11 (League) were "needs a change" — all three built (§3, §4). The safe items stay safe: 1 (module state — one capture scope per battle, pinned under concurrency), 2 (`summary` gains no key; the run's share rides a `WeakMap` keyed on it, the `setupMenuLabels/reads.js` precedent), 3 (memos), 4 (tick capture — unchanged; the stale "serially" comments fixed: `captureBodyObserver.js:25-31`, `captureContext.js:24-29`, the handler's loop comment), 5 (the model request — untouched, §7), 7–9, 12–13 (unchanged), 14 (the 51 existing suites — green; two shape assertions edited, §9).

---

## 3. Part 1 — the pool (`EVAL_POOL_K`, shipped 1)

**The settings** (`src/config/featureFlags.js`): `EVAL_POOL_K = 1` (`:2840`) and `EVAL_POOL_START_CUTOFF_MS = 200_000` (`:2855`), each with `// Pinned by: evalCapacityFlags.test.js`. `flagPinGuard.test.js` saw only boolean `*_ENABLED` flags, so it gained a **named numeric-settings block** (four rows, one a planted contradiction) — a disclosed guard edit.

**The dispatcher** (`api/_utils/evalPool.js`, pure, no I/O, no clock):
- `clampPoolK` `:31` — an integer 1–8 as is, anything else 1; `runEvalPool` clamps again itself.
- `poolStartCutoffMs` `:41` — `TIME_BUDGET_MS` at K = 1; the pool's cutoff above, unless it is not a finite number in (0, budget], which reads as the budget.
- `poolGroupOf` `:51` — the battle's `groupId` when a non-empty string (the field `resolveTournamentContext` reads, `tournamentAgentLedger.js:305-307`).
- `runEvalPool` `:84` — before each start, and only while a battle waits, the start rule is asked; the first "no" stops it for good and hands the never-started battles, in rotation order, to `onStop` at that instant. A battle whose group has one in flight is passed over; the first later battle whose group is free starts; the passed-over one is reconsidered ahead of later ones. It resolves only when nothing is in flight. A `run` that rejects (with any reason, falsy included) or a start rule that throws stops new starts, waits for the rest, then rejects with the first error, deferring nothing — as the loop's exception did.

**The handler** (`api/cron/agent-evaluate.js:544-628`):
- **K = 1 is the loop, await for await:** the rule `elapsed ≤ TIME_BUDGET_MS` (i.e. not `elapsed > TIME_BUDGET_MS`) is asked before each battle; the first "no" sets `deferredBattleIds`, `deferredAt` and the `deferred`/`skipped` counts exactly as the loop's break did, with the same log line. The next battle starts one microtask hop later than in the loop (the pool's own `.then`); no I/O can observe it and the dark proof compares every effect. Affinity never binds at K = 1.
- **The `for (const [index, battle] of activeBattles.entries())` statement is kept** as the pass that builds the items (`:560-562`): `api/_utils/callRecords/releaseSites.test.js:74` anchors its "release read before the loop" check on that literal; the guarantee it protects still holds.
- **One capture scope and one catch per battle:** the pool's `run` (`:589-627`) is the loop body — `newTickCaptureScope()` per battle, `runInTickCaptureScope`, the per-battle catch with its `cronErrors` receipt and `finalizeAbandonedTickCapture(db, captureScope, …)`. A row pins it under concurrency: a battle whose final write throws while another is in flight gets its own receipt and its own `tick_error` capture record; the other keeps its own `cpu_passive` record.
- The handler `await`s the pool, so every in-flight battle ends before the deferred beat and the run record. At K > 1, `deferredAt` is the first refusal — the decision point, as `main` stamps it.

**Why 200 s.** The admission test closes at 222 s at `on` (10 + 42 + 12 + 4 = 68 s of the 290 s budget; discovery §2). The measured agent-mode pre-call phase is median 13.5 s, **max 22.1 s** (discovery §B2) — lock → prompt-build start, so also an upper bound on lock → admission, which comes first. A battle started at 200 s that runs to that max reaches admission at 222.1 s and takes a **clean budget skip**: no model call, its final write well inside the 300 s ceiling; a typical one is admitted. So the cutoff targets a clean finish, not a model call. **These pace figures were measured at K = 1** (every production check so far ran one at a time); **at K > 1 they are ASSUMED** until the run record's `pool` block and tick times show otherwise. With the guard off, concurrent pre-call phases have no EODHD bound at all, so K > 1 should follow the guard flip (founder question 5).

**Rows:** `api/_utils/evalPool.test.js` (22) and `api/cron/agent-evaluate.pool.test.js` (14, the real handler).

---

## 4. Part 2 — the EODHD fetch guard (`EODHD_FETCH_GUARD_ENABLED`, shipped false)

**The helper** (`api/_utils/eodhdFetchGuard.js`), `eodhdFetch(url, kind)` `:187`. The seven bare `fetch(url)` sites of `marketDataCache.js` call it; `fetchIntradayBatch` reaches it through `fetchIntradayCandles`.

- **Flag off:** a non-async pass-through — `fetch(url)` with one argument, no signal, no wait; the caller awaits **the very promise `fetch` returned** (row: `toBe`; no unhandled rejection). Counting reads `response.status` only.
- **Flag on:** a **10 s timeout** (`EODHD_FETCH_TIMEOUT_MS` `:40`) from **dispatch** to the **end of the body** — read inside the window and handed back as a buffered `Response`, so the caller's own `response.json()` cannot hang; a **process-wide limiter of 32** (`EODHD_FETCH_CONCURRENCY` `:52`), first come first served, the slot handed over on release; `fetchIntradayBatch` keeps its 5-at-a-time pacing inside it. Statuses that carry no body (101, 103, 204, 205, 304) come back without one.
- **`setTimeout` + `AbortController`** (the intraday poller's precedent), not `AbortSignal.timeout`: Node's runs on internal timers that test fake timers do not drive, so the required fake-timer row could not exercise it.

**Why 32.** One agent-mode check fans out up to 82 GETs at once (41 symbols × `/eod/` + `/real-time/`) plus 7 intraday requests. At 32 the fan-out runs in about three waves; at an EODHD round trip of roughly 150–300 ms (ASSUMED — no latency is recorded anywhere) that adds about **0.3–0.6 s** to a 13.5 s median pre-call phase at K = 1, while K = 8 lanes (≈ 656 GETs) can no longer open 656 sockets together. Below ~16 the waves cost seconds; above ~64 one lane is never limited. With EODHD hung, N requests clear in ⌈N ÷ 32⌉ × 10 s.

**A timeout takes the network-error path, caller by caller** (VERIFIED; rows compare a timeout and a network error field for field through the real `getStockAnalysisData`):

| Caller | Existing error path | A timeout |
|---|---|---|
| daily, forced (the evaluator's) — `getStockAnalysisData` `:632-683` | `errors.daily`, **no bars** (`forceRefresh` skips the cache read, so there is no stale backup) | same |
| daily, cached (research and others) | `errors.daily`, then the **stale document** | same |
| fundamentals, news, earnings | the same `try` → `errors.<field>` → stale when cached | same |
| holders — `getCachedHolders` `:1248` | `fetchHolders` throws out to its caller | same |
| real-time, daily+price call — `fetchRealTimePrice` catch `:833-852` | **the latest daily close as `{ current, fallback: true }`** — refused for every held and CPU symbol by the quote guard (`agentQuoteHealth.js:23-29`) | same |
| real-time, price-only call | `errors.price`, **no price** | same |
| intraday — `fetchIntradayBatch` | `Promise.allSettled` → `[]` for that symbol | same |
| intraday — cascade qualification `agent-evaluate.js:960-990` | its own **5 s** race (`CASCADE_QUALIFY_TIMEOUT_MS`); any throw disqualifies | same. With the guard on and K ≥ 2, time in the limiter's queue counts against that 5 s; the outcome is the designed fail-closed skip-and-hold |

Two premises in the prompt read differently in the code: the evaluator's daily path has **no** stale fallback, and the real-time path **does** make a price on a failed request — the `fallback: true` close, refused for held symbols, unchanged by this build.

**Other EODHD callers (not changed in this build).** A delegated read-only census traced each to its request (one row NOT TRACED):

| Caller | Request | Per-request timeout | Concurrency |
|---|---|---|---|
| Intraday poller and validator | `intraday/intradayFetch.js:38` — `/us-quote-delayed`, `/real-time/` (crypto), `/intraday/` 1m | **10 s**, AbortController | quotes `mapConcurrent` 4; seed 3 over ≤ 10 symbols; validator sequential |
| Voice layer | `voice-layer-cache.js:63` — `/real-time/`, 20 a request | **none** | sequential batches, 200 ms gaps |
| Scan-movers | `scan-movers.js:43` — `/real-time/` | **5 s** | chunks of 8, no gap |
| Mandate | quotes `tournamentPrices.js:65` (via `mandateUniverseSnapshot.js:566`); `/splits`, `/div` `:340`; fundamentals via `marketDataCache` | quotes and corporate actions **none**; fundamentals guarded with the flag | quotes sequential chunks of 100; daily chunks of 8 |
| Index intelligence | `compute-index-intelligence.js:149` `/eod/`, `:308` `/real-time/` | **none** | stocks batches of 10 / 500 ms; index, TNX, sector ETFs **one unbounded** `allSettled` (`:758-766`); real-time batches of 20 / 300 ms |
| Rankings | `compute-rankings.js:120`, `:182`, `:248`, `:1489` | **none** | batches of 10 / 250 ms; ETF history **one unbounded** `Promise.all` (`:1500-1507`) |
| From the evaluator: `tournamentPrices.fetchBatchQuotes` (canonical-open sweep, `agent-evaluate.js:486`) | `tournamentPrices.js:65` | none of its own; the sweep's 15 s budget aborts it | one request per group, sequential |
| From the evaluator: the stock-threshold provider (a corrected stock swap) | `stockThresholdMeasurementProvider.js:49` | **10 s**, `AbortSignal.timeout` | 3 sequential, no limiter |
| `eodhdDailyWindow.js:42` | `/eod/` | only when the caller passes one (5 s from `setupEvidence/acquire.js`; none from `hypothesisRecords/review.js:215`) | ≤ 3 in flight via `setupMenuLabels` |
| Huddle earnings; Sonar news; validated catalysts; FantasyTimes consensus | `huddle/sharedLayer.js:51`; `sonarCatalystFetch.js:124`, `:149`; `validatedCatalystCache.js:89`; `fantasyTimesConsensus.js:34`, `:49`, `:70` | **none** | one or a few sequential each |
| `evidence/eodhdNews.js:137` | `/news` | NOT TRACED | NOT TRACED |

`getCachedBatchQuotes` sits in `marketDataCache.js` but delegates to `tournamentPrices.fetchBatchQuotes`, so it is **neither guarded nor counted** (outside the prompt's seven sites).

---

## 5. Part 3 — the evaluator's market-data cuts (`EVAL_MARKET_DATA_CUTS_ENABLED`, shipped false)

### 5.1 Why the evaluator forces a refresh

`git log -S'forceRefresh: true' -- api/cron/agent-evaluate.js` → `c315707db` (2026-03-25): the fan-out was born `getStockAnalysisData(symbol, { forceRefresh: true, fields: ['daily'] })`, which fetched **no** price; `12a715577` (2026-03-30) added `'price'` ("…skipped the real-time price fetch, causing all scores to compute as 0"); `d037b2fa1` (2026-06-03, Guard 2) **reused** the already-fetched daily series ("in-memory only; never written to the doc"). None asks for bars that change during the session: `forceRefresh` was there for the price, and the bars rode along.

### 5.2 Every reader of the check's daily bars

| Reader | What it reads | Same input from a session-stable series? |
|---|---|---|
| **Guard 2, held positions** — `agent-evaluate.js:1428` → `resolveBadgeBaseline` (`baselineValidation.js:233-242`) → `selectPriorSessionBar` (`:142-150`) | **the newest bar dated before the cutoff** (ET today for a stock, UTC today for a crypto pair), its `rawClose` first | **Yes, by construction:** a series is stored and reused only when that bar IS the expected one (`isReusableSessionSeries`, `evalMarketData.js:118`: the previous NYSE session from the calendar of record; the previous UTC day for crypto). Past rows not changing intraday is ASSUMED (not observable without an EODHD call); the reader takes one row, and the check makes that row's date certain. |
| **Guard 2, CPU positions** — `:1481` | the same | the same |
| **The real-time fallback** — `fetchRealTimePrice` catch, `marketDataCache.js:833-852` | **`daily[0].close` — the newest row, not date-filtered** — when the quote request fails | **Never served from the stored series.** Whether `/eod/` carries a same-day row intraday is not known (field inventory S2), so this path fetches `/eod/` **fresh** (`loadFallbackDaily`, `:841-843`; `evalMarketData.js:259`), exactly as the daily+price call did, on a warm or a cold instance; `data.daily` then carries those fresh bars to Guard 2 too. |
| Hot-bench rebuild `:1806-1816`, catalysts `:2994-3000`, proposals `fetchPricesForProposal` `:5406` | `data.price` only (their bars feed only the same fallback) | not cut: they keep `forceRefresh` daily+price (founder question 2) |
| Regime | `stockTechnicalScores/{sym}` (`:1642`, `:1922-1926`) | not daily bars |
| ATR, thresholds | `asset.baseATR` / the score's; `battle.thresholdHistory` | not daily bars |
| The risk manager | `evaluateRisk(…)` (`:2124`) — quotes, `changePercent`, 5-minute candles | not daily bars |
| The swap executor | its own Guard 3 refresh; the corrected-stock path its own provider | not the check's bars |
| (side effect) `marketDataCache/{SYM}_daily` | rewritten every check today; with the cut, by the session fetch and any fresh fallback (once per session at least) | other readers — founder question 4 |

`dailySeries` is filled only at `:1332-1333` and read only at `:1428` and `:1481` (grep, VERIFIED; the GC lens confirmed it independently). **No reader needs bars that change during the session — no STOP.**

### 5.3 What 3a does (`api/_utils/evalMarketData.js`)

- `fetchEvalSymbolData` `:248` replaces the fan-out's call only with the flag on (`agent-evaluate.js:1326`): the **quote** is fetched fresh every check (`fields: ['price']`); the **bars** come from `sessionDailySeries` `:202`.
- **Where the series lives, and why:** `evalSessionDaily/{eodSymbol}_{etDate}` in Firestore plus a process memo keyed by the cutoff too. A document lets a cold instance reuse what a warm one fetched; the memo makes a symbol's first fetch **single-flight** across battles in flight. Not `marketDataCache/{SYM}_daily`: other paths write that one, its window can be narrower and it carries no session stamp. The collection is named literally at both calls (the protected-store write scan resolves literals only); no client rule grants it.
- **"Narrow"**: a `windowDays` stamp other than `DAILY_WINDOW_CALENDAR_DAYS` (90), or fewer than **55 rows** (`SESSION_DAILY_MIN_ROWS` `:67`). A narrow, foreign-stamped or prior-bar-less document is never used; a narrow or prior-bar-less fetch is never stored, so each check fetches as before.
- **Bounded, fail open:** store reads and writes 1.5 s; a check waiting on another check's first fetch **15 s** (`SESSION_DAILY_WAIT_TIMEOUT_MS` `:82`), after which it drops the stuck entry and fetches daily+price itself; a failed first fetch is not remembered; a read that fails, times out or finds an invalid document falls back to the fetch as it was.
- **Past the calendar's horizon** (`MAINTAINED_HOLIDAY_YEARS` = 2026–2027) no stock series is reusable: the cut stops saving (each check fetches as before) and says so once per process. The units in §5.5 assume a maintained calendar.

### 5.4 3b — macro quotes once per run, and every per-battle effect

With the flag on, `prepareRunMarketShare` (`evalMarketData.js:276`, called once at `agent-evaluate.js:542`, before the first dispatch) fetches SPY, QQQ and BTC-USD.CC through `fetchEvalSymbolData`, each bounded to 10 s, and keeps **only a usable quote** (`isSettlementQuoteUsable`, `:284` — never a `fallback: true` close). `sharedMacroQuote` (`:301`) hands each battle **a deep copy** with the run fetch's instant — unless the battle holds, benches, hot-benches or scores **the same instrument** (`ownMarketSymbols`, `agent-evaluate.js:1321`, compared by the symbol EODHD prices, so a held `'BTC'` owns `'BTC-USD.CC'`), in which case its own fetch serves both roles as before.

| Per-battle effect of a fetched quote | With the run's copy |
|---|---|
| `prices[sym]` (`:1328`) | the copy — no battle can change another's |
| the calls step `recordFetchedQuote(…, fetchedAtMs)` (`:1330`) | the **run fetch's instant** (row: SPY/QQQ carry the share's instant, NVDA the check's). An observation never admits a quote fetched after its instant (`observe.js:74-75`); a run-start quote is always earlier |
| the quote guard / `degradedQuotes` (`:1350-1363`) | macros are required only when held — and a held instrument is never shared |
| scoring, the risk manager, the executor | an owned instrument is never shared; a swap target must be a bench asset (`findBenchAsset`, `:5395`, reads the bench built from rankings), so a run-start quote never reaches them |
| the prompt (`macroPrices` `:1366`, `prices`) | the copy's values |
| the tick capture | records scores and the universe, never quotes (`:1568-1579`) |
| a symbol the run could not price, or priced only by fallback | not shared; each battle fetches its own |
| a macro joining the hot bench mid-check (the equipped-ticker union on a rebuild tick) | the copy can appear in the prompt's hot-bench list on that tick only (the union persists into `watchlist.hotBench`, so later checks own it); it cannot become a bench asset. Founder question 1 |

**No effect is lost — no STOP.** The ownership rule is stricter than the letter ("handed to each battle"): founder question 1.

**Evidence beyond the rows:** the dark-proof harness with this flag **ON** gives, in all 16 cases, battle writes, run records (minus the new blocks), model requests, start order and responses **identical to `main`**; only cache writes and EODHD traffic differ (three CPU seats: 12 `/eod/` + 12 quotes → 0 + 6).

### 5.5 Units per check (the discovery's B4 method)

An agent-mode check: 41 symbols (31 universe + 7 CPU book + 3 macros), each `/eod/` (1 unit) and `/real-time/` (1 unit); 7 held symbols' 5-minute candles at 5 units.

| | `/eod/` | `/real-time/` | intraday | **per check** | **per battle-day (26 checks)** |
|---|---|---|---|---|---|
| flag off (today) | 41 | 41 | 35 | **117** | **3,042** |
| flag on, B battles per run | ≈ 41 ÷ 26 ≈ 1.6 every session (one per symbol per session; less with overlap; + one per hot-bench name new that session) | 38 + 3 ÷ B | 35 | **≈ 74.6 + 3 ÷ B** (B = 1: ≈ 77.6) | **≈ 1,940 + 78 ÷ B** (B = 1: ≈ 2,017) |

A failed quote adds one fresh `/eod/` (rare). At 25 players (R1, 26 checks each): evaluator ≈ 76,050 → ≈ 49,000 units a day. The run record's `eodhd` block counts **requests**, not units (an intraday request bills 5): a flag-off agent-mode check is ≈ 89 requests.

---

## 6. Part 4 — the limits on record (live from merge)

**The run record** (`composeEvalRunRecord`, `agent-evaluate.js:711`) keeps its 14 fields and adds, at the end:
- `pool: { k, startCutoffMs, maxInFlight, dispatched }` — `startCutoffMs` is the rule in force (290 000 at K = 1); a run that never dispatched records the settings with zeros (`idlePoolBlock` `:740`).
- `anthropic: { requestsLimit, inputTokensLimit, outputTokensLimit, minRequestsRemaining, minInputTokensRemaining, minOutputTokensRemaining, responses429 }` — the **lowest** limit and the **minimum** remaining seen across the run's model calls (values recover between calls; the record keeps the lows); `null` where no call carried the header; `responses429` counts the run's 429s — complete because the client is built with `maxRetries: 0` (stated in the module; pinned by `tickCapture.bodies.test.js`).
- `eodhd: { requests: { eod, realTime, intraday, other }, timeouts, non2xx: { '429', '5xx', other } }` — the process counters of `eodhdFetchGuard.js` as a **difference** from the handler's first statement (`:318`) to the record (`eodhdRunBlock` `:117`). **`timeouts` is `null` while the guard is off** (no timeout can fire) — never a measured zero. Its limits, in the comment at `writeEvalRunRecord`: (1) one evaluator invocation per process window — a second invocation sharing the process is counted in both (now logged when it happens); (2) a request left in flight (the GET that loses the cascade's 5 s race; a macro fetch past its bound) is counted here, but its status lands after the record — usually in no record; (3) a failed request with no response is a request only; (4) `marketDataCache.js` traffic only.

**The header names** (Anthropic API documentation, "Rate limits" → "Response headers", `platform.claude.com/docs/en/api/rate-limits`, read 2026-11-15): `anthropic-ratelimit-requests-limit` / `-remaining`, `anthropic-ratelimit-input-tokens-limit` / `-remaining`, `anthropic-ratelimit-output-tokens-limit` / `-remaining` (integers; token remaining rounded to the nearest thousand). The installed SDK (0.71.2) names none; it exposes the raw `Response` through `APIPromise.asResponse()` (`core/api-promise.mjs`) and a failed request's headers on `APIError.headers` (`core/error.mjs`; a non-2xx rejects the response promise, `client.mjs:280-309`).

**The seam, and why this one** (`api/_utils/anthropicRateLimits.js`). Two seams were ruled out by pins this build may not edit: the client's construction (`tickCapture.bodies.test.js:139-159`) and the call literal `await anthropic.messages.create(` (`tickStamps.pins.test.js:164`, `cryptoSlotVerdict.test.js:364`). So the evaluator observes **the client it uses for its one call**: `const anthropic = observeRateLimits(getAnthropicClient());` (`:3129`). `observeRateLimits` (`:167`) calls the SDK's own `client.messages.create(body, options)` with the same arguments by reference and returns **the SDK's own promise**; beside it, it asks that promise for its raw response, which neither consumes the body nor changes what the call site awaits. It does not depend on the capture's observing `fetch`. Every read is wrapped; a failure is a `null`. **Through the real SDK 0.71.2** (four rows): 200, 429, 500 and a network error each give one request with identical bytes and identical results or errors (class, status, message) to an unobserved twin; the headers are read; a 429 is counted once; no unhandled rejection. The dark proof shows the request bytes unchanged in the handler (§8).

**The read script** (`scripts/eval-capacity-read.mjs`, read-only, no ids): `runRow` keeps the blocks as numbers (`limitsOfRun` `:180`); section **L** (`limitsRead` `:210`, `renderLimits` `:581`) prints per session the limits seen, the minimum remaining, the 429s, EODHD **requests per battle evaluated** by endpoint (labelled as requests, not the discovery's units), timeouts (`—` when not measured), non-2xx, K and the maximum in flight. A row runs `gather()` and `render()` over a read-only fake handle.

---

## 7. The model request is untouched

Request construction is unchanged (client options, model, tool, prompt, parameters). The dark proof compares the real SDK's outgoing **method, URL, headers (minus the key) and body bytes** in every case that calls the model: identical (§8). The tool and prompt pins stayed green without edits (the DK lens ran 98 suites at `c9fe26b2`, all the source-pin suites among them).

---

## 8. The dark proof (required — K = 1, every flag at its shipped value)

**Harness.** One test file, copied byte for byte into one Linux tree at **one path** (`~/pd-ci-cap1dp`, moved between SHAs) — `origin/main` (`ea5e0c5b`) and the build. Doubled: the network (one global `fetch` — EODHD and Anthropic) and Firestore (one in-memory store recording every write with its sentinels and timestamps, and every read). **Real:** the handler, `processAgentBattle`, the Anthropic SDK, `marketDataCache`, and **every feature flag at its shipped value** (tick capture on). Mocked identically in both trees (the evalRun suite's set): the active-battle query, the canonical-open sweep, the mastery repair sweep, the tournament ledger, the pattern logger, the voice layer's Gemma calls, the shadow logger. A fake clock; each fixture charges its cost at its final score write.

**Compared per case:** the order battles start (lock transactions), every Firestore write (op, path, data, in order), every Firestore read (op, path, in order), every model request (method, URL, headers, body bytes), every EODHD URL (in order), other requests, the run record (the build's three blocks checked present and `main`'s absent, then stripped), the HTTP response.

**16 cases:** agent mode HOLD; agent mode SWAP (the real executor); three CPU seats; League group-mates (`baggerbomb_tournament`, one `groupId`) + one agent battle; no trigger; budget skip (admission after 222 s); deferred (two battles past 290 s); lock skip; an error battle (its document gone); near the budget (a start at 289.999 s, a deferral at 290.001 s); degraded quotes; `/eod/` down; gameplan pending; proposal pending; a mixed six-battle run (HOLD, SWAP, CPU, League, a stale lock stolen, a budget skip, a deferral); an empty run. Every case but the empty run reached its named exit with writes and requests; the empty run writes only its record.

**Result at the final code `97dff8d8`: 16 cases, 128 comparisons, 0 differences (391 reads compared).** Earlier passes: `fddbc826` (writes only) 16 / 112 / 0; `0de5b894` (after the fix round, reads added) 16 / 128 / 0. A pass in two differently named trees differed in one field — the 200-character stack stored in `cronErrors` carries the tree's path — which the same-path runs remove.

**Controls (planted differences, same harness):** `EVAL_POOL_K = 2` → 8 cases differ (8 of the 9 multi-battle cases; `lock_skip` does not discriminate); `EVAL_MARKET_DATA_CUTS_ENABLED = true` → 15 differ (all but the empty run) — and, with cache writes set aside, **all 16 identical** (§5.4).

Artifacts (scratchpad, out of tree): the harness, `compare.mjs`, `cuts-scope.mjs`, `summarize.mjs`, the per-case JSON for `main`, the build and both controls.

---

## 9. Tests

**New files (rows at `97dff8d8`):** `api/_utils/evalPool.test.js` (22), `api/cron/agent-evaluate.pool.test.js` (14), `api/_utils/eodhdFetchGuard.test.js` (19), `api/_utils/evalMarketData.test.js` (35), `api/cron/agent-evaluate.marketDataCuts.test.js` (8), `api/_utils/anthropicRateLimits.test.js` (18), `api/cron/agent-evaluate.limitsOnRecord.test.js` (8), `scripts/eval-capacity-read.limits.test.js` (8), `src/config/evalCapacityFlags.test.js` (7).

**Edited assertions (the one sanctioned kind — the run record's exact shape):** `api/cron/agent-evaluate.evalRun.test.js` — `RUN_KEYS` gains `'pool', 'anthropic', 'eodhd'` (used by TEST 1 and the composer boundary row); TEST 1's `toEqual` gains the three blocks (K = 1, cutoff 290 000, max in flight 1, dispatched 3; no headers → nulls; EODHD doubled → zero requests, `timeouts: null`). Nothing else in the 51 `agent-evaluate.*.test.js` files changed; `agent-evaluate.tickCapture.isolation.test.js` is unchanged.

**Guard edit (disclosed):** `src/config/flagPinGuard.test.js` — two `DARK_BY_DESIGN` entries and the named numeric-settings block (four rows).

**Mutation** (BUILD_RULES §2; Linux, `scratchpad/mutants/mutate.mjs`: each anchor must match exactly once, the file is restored from `HEAD` after each mutant, KILLED needs a non-zero exit AND a failed row). At `97dff8d8`: **123 mutants, 123 KILLED** (0 survived, 0 broken, 0 error), 10 suite baselines green — the builder's 88 (the build's 69 and 19 for the review's fix rows) and the test-integrity lens's 35 (27 of which survived the tests at `29e42a78` and were then closed with rows). By group and verdict: the review record §4–§5; every mutant's edit and first failing rows: `scratchpad/mutants/run3/results.json` (out of tree).

---

## 10. Fenced functions called — none edited

`git diff --quiet 187ef495 HEAD` on every §1 file, `agentEvalTransport.js` and `vercel.json`: **untouched**. This build adds **no** new call to a fenced function. `processAgentBattle` keeps calling, unchanged: `executeSwapServer` (`agentSwapExecution.js`), `evaluateRisk` (`agentRiskManager.js`), `calculateAssetScoreServer` (`agentScoring.js`), the eval prompt builders (`agentEvalPromptAssembly.js`), the archetype config readers (`agentArchetypeConfig.js`), `findActiveAgentBattles` / `completeBattle` (`agentBattleService.js`), `applyGuardrails` (`agentGuardrails.js`). The new modules import only non-fenced code: `marketDataCache.js`, `marketSchedule.js`, `baselineValidation.js`, `agentQuoteHealth.js`, `intraday/evaluatorHook.js`, `featureFlags.js`. With the flags at their shipped values nothing the scoring engine or the risk manager receives changes (§8); with the cuts on, the dark-proof control shows their writes unchanged (§5.4).

---

## 11. The review

Five lenses on per-reviewer snapshot trees — pool lifecycle, the dark guarantee, the guard and cuts, observability, then test integrity (mutating, last) — and a refuter for every finding of the first four; the fifth's findings are each reproduced by its own surviving mutant. **42 findings: none a defect at the shipped values, no fence contact.** One high (TI-1, a test gap: a cold instance's store-served path was never asserted) and eleven medium (PL-1 and TI-2 to TI-9 test gaps; GC-1 a waiter with no bound; OB-1 `timeouts` read as a measured zero) — all fixed with rows that fail without the fix, and all 35 of the test-integrity lens's mutants killed after. Refuters refuted five sub-claims (e.g. GC-1's "rest of the ET date": Node's fetch gives up after ~300 s and the entry is dropped). **Found, not fixed:** the plain-object `fetch` doubles that go red with the guard on — measured by a full-suite sweep (44 rows in 13 files: 6 are the flip's own pins, 38 are doubles in 9 files) — for the flip PR. Full record: `docs/audits/20261115_BUILD_EVAL_CAPACITY_1_REVIEW.md`.

---

## 12. Checks on the final head, merged with current `main`

On Linux (WSL worktree of `~/pd-ci` with its own `npm ci`, lockfile `40382e64edb6` = `main`'s; Node 20.20.2; `TZ=UTC`), at `cf19a89c` — the build with `origin/main` (`ea5e0c5b`, unchanged since the start, re-fetched before the checks) already merged in:

| Check | Result |
|---|---|
| Full suite, `--maxWorkers=8`, under `flock /tmp/pd-suite.lock` | **exit 0 — 1,515 files, 33,791 rows: 33,656 passed, 0 failed, 135 skipped** (328 s). A first run the same hour had one row red: `src/components/League/leagueRawIds.guard.test.jsx` ("every League seat surface…"), timed out at 5.18 s against its 5 s limit under load — a file this build does not touch; alone it passed 3 of 3 (≈ 1.9 s of tests each), and the quiet rerun above is the record. |
| `npm run lint:gate` | **exit 0** |
| `npm run build` (`vite build`) | **exit 0** (the usual chunk-size warning) |
| `lint:gate` and `vite build` again on the pushed head (this report's check lines only) | **exit 0, exit 0** |

The Windows checkout (CRLF, `core.autocrlf=true`) has three known platform-only reds in the evaluator suites (`tickCoherence`, `tickStamps.pins` resolveControls, the `firestore.rules` tripwire), green on Linux. The emulator rules suite was not run: this build touches no rules file and no rules-read flag.

---

## 13. Founder questions

1. **A macro the battle owns.** Built: SPY, QQQ or BTC-USD.CC is shared only with battles that do not hold, bench, hot-bench or score that instrument; an owning battle fetches its own, as today. The letter ("handed to each battle") would also share with those battles, and a run-start quote would then reach their scoring and risk manager. Keep the stricter rule (recommended), or share with every battle? (On a hot-bench rebuild tick a newly equipped macro can show the run's copy in the prompt's hot-bench list — prompt only.)
2. **The three occasional fetch sites** (hot-bench rebuild, catalysts, proposal prices) still fetch daily+price with `forceRefresh` each time. Cut them in the flip PR, or leave them (a small share of units)?
3. **A TTL policy for `evalSessionDaily`.** Each document carries `expiresAt` (session + 3 days); no policy exists, and creating one is a Firebase setting this build may not make. About 41 small documents a session today. Create it, or leave them?
4. **The shared `marketDataCache/{SYM}_daily` document** is rewritten every check today; with the cuts on, at least once a session. Its other readers fetch on their own 4 h TTL; `compute-institutional-intelligence.js:213` reads its newest close directly. Acceptable?
5. **Flip order.** Recommended from the review: the guard first (it changes no input, and it bounds the cuts' own first fetch, which the 15 s waiter bound only partly covers), then the cuts, then K = 2 only with the guard on (the 200 s cutoff's margin is ASSUMED at K > 1). The guard's flip PR must also move 38 test doubles to real Responses (review §6). Agree, or flip guard and cuts together?
