# Evaluator capacity, Build 1 — the pool, the EODHD guard and cuts, the limits on record (dark)

**Date:** 2026-11-15 (Sunday) · **Branch:** `claude/eval-capacity-build1` · **Basis:** `docs/audits/20261115_PHASE0_EVAL_FANOUT.md` (PR #1069, merged into this branch) · **Review record:** `docs/audits/20261115_BUILD_EVAL_CAPACITY_1_REVIEW.md`

**Markers (BUILD_RULES §3).** **VERIFIED** = read at that `file:line` in this session. **MEASURED** = produced by a run in this session (the dark proof, the suites, the battery). **ASSUMED** = not checked, with the reason. Line numbers are at the build's final code commit (§0) and drift.

---

## Verdict

| Part | What it does | Shipped state | Proof |
|---|---|---|---|
| **1. The pool** | The handler's sequential loop becomes a dispatcher: at most K battles checked at once, started in rotation order; a start cutoff; deferred = never started; League group-mates never in flight together; one capture scope and one catch per battle. | `EVAL_POOL_K = 1` — **exactly today's loop** | Dark proof: 16 handler cases, 0 differences against `origin/main`. 11 pool rows + 16 dispatcher rows. |
| **2. EODHD fetch guard** | Every EODHD request in `marketDataCache.js` goes through one helper: a 10 s timeout and a process-wide limit of 32 in flight. | `EODHD_FETCH_GUARD_ENABLED = false` — the request is `fetch(url)` exactly; only counted | 15 guard rows (timeout, body timeout, queue-wait, limiter under 200 calls, the error paths). |
| **3. Market-data cuts** | Daily bars once per symbol per ET session (reused only when the series holds the expected prior-session bar); SPY, QQQ, BTC-USD.CC once per run. | `EVAL_MARKET_DATA_CUTS_ENABLED = false` | 31 rows. Dark-proof control with the flag ON: in all 16 cases the battle writes, the model requests and the run record are identical to `main`; only cache writes and EODHD traffic change. |
| **4. The limits on record** | The run record gains `pool`, `anthropic` (from the `anthropic-ratelimit-*` response headers) and `eodhd` (requests by endpoint, timeouts, non-2xx) blocks; the read script prints them per session. | **Live from merge** | 20 rows, end to end with tick capture on and off. |

**Units per agent-mode check (from the code, the discovery's B4 method):** flag off **117** (unchanged); flag on **≈ 73 + 3 ÷ B + one `/eod/` per new symbol per session** (B = battles per run) — **≈ 74–78** for one battle per run, **→ 73** as runs fill. Per battle-day: **3,042 → ≈ 1,940–2,020**. §6.4.

**Nothing in a fenced file, `agentEvalTransport.js` or `vercel.json` changed** (§10). No production read, write, deploy, flag flip or setting change was made.

---

## 0. Preamble (BUILD_RULES §2, §3)

| | |
|---|---|
| Fetch | `git fetch origin` was the first step. `origin/main` = `ea5e0c5b406cf9060c42d32ee8e754998e4fb280` (merge of #1068). |
| Branch | `claude/eval-capacity-build1`, cut from `origin/main` at `ea5e0c5b`; **clean tree** at the start. |
| Discovery branch | `scripts/eval-capacity-read.mjs` exists only on `origin/claude/phase0-eval-fanout` (PR #1069, a draft). It was **merged** into this branch (`187ef495`) rather than copied, so #1069 landing first leaves no add/add conflict. Merge #1069 first; this PR's own diff is then `187ef495..HEAD`. |
| Commits | `fddbc826` (the build), `4406c6e4` (scan fix + a row), `2e125db8` (two rows), FINAL_COMMITS |
| Files changed (own diff) | FILES_CHANGED — over the BUILD_RULES §2 review threshold; the review is §11 and its record. |
| Production | **None touched.** No Firestore read or write, no EODHD or Anthropic call, no deploy, no flag flip, no environment variable, no Vercel or Firebase setting. |
| Ids | None in code, tests, fixtures, output or this report. |
| Linux | WSL `~/pd-ci` worktrees (`pd-ci-cap1`, `pd-ci-cap1dp`): `TZ=UTC`, `--maxWorkers=8`, the full suite under `flock /tmp/pd-suite.lock`. `pd-ci-cap1` got its own `npm ci` (lockfile `40382e64edb6`, the same as `main`), so no other session's tree was touched. |
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

All VERIFIED at the final code commit; the prompt's numbers were from `0b720acc`/`ea5e0c5b`.

| Prompt anchor | Now | Note |
|---|---|---|
| handler `:288` | `api/cron/agent-evaluate.js:297` | |
| release read `:488` | `:503` (`await ensureReleaseView(db, { force: true });`) | still one forced read, before the first dispatch |
| sort `:517-519` | `:532-534` | unchanged |
| loop and budget break `:522-536` | replaced by the dispatcher `:544-628` | §3 |
| per-battle scope and catch `:547-576` | `:589-627`, inside the pool's `run` | body unchanged, re-indented |
| deferred beats `:579-582`, `:701-726` | `:631-634`; `writeDeferredBeats` unchanged | |
| `composeEvalRunRecord` `:641-661`; write `:668-684` | `:711-737`; `writeEvalRunRecord` `:758-778` | three blocks added at the end |
| Anthropic client `:245-272` | `:254-281`, **byte-identical** | the observing fetch exists only when `TICK_CAPTURE_ENABLED` (`:277`) |
| `processAgentBattle` `:926` | `:1019` | signature unchanged |
| price fan-out `:1185-1227` | `:1278-1335` (symbols `:1284-1296`, macros `:1291`, the fetch `:1316`, Guard 2 series `:1303`, `:1322-1323`) | |
| admission test `:3067` | `:3175` | unchanged |
| `messages.create` `:3215` | `:3323` (`response = await anthropic.messages.create(` — the literal kept) | |
| `TIME_BUDGET_MS` `:238` | `:251` | |
| `getStockAnalysisData` `:560` | `api/_utils/marketDataCache.js:570` | cache check and fetch `:620-686`; the narrow-doc comment `:600-617` |
| `fetchDailyOHLCV` `:352-375` | `:356-379` | |
| `fetchRealTimePrice` `:792` | `:802` | |
| `fetchIntradayBatch` `:947-973` | `:967-993` | |
| bare `fetch(url)` `:357, :384, :454, :477, :505, :795, :871` | all seven now `eodhdFetch(url, kind)`: `:361`, `:388`, `:458`, `:481`, `:509`, `:805`, `:889` | |
| `CACHE_TTL` `:30-34` | `:30-37` | unchanged |
| timeout precedents | `intraday/intradayFetch.js:34-47` (AbortController + setTimeout, 10 s; concurrency 4 via `mapConcurrent` `:21-32`); `eodhdDailyWindow.js:42-49` (`AbortSignal.timeout`) | |

**The discovery's Part C, item by item.** Items 6 (dispatcher), 10 (EODHD burst) and 11 (League) were "needs a change" — all three are built (§3, §4). The safe items stay safe: 1 (module state — one capture scope per battle, rows in §3), 2 (`summary` — nothing new is added to it; run-scoped state rides a `WeakMap` keyed on it, the `setupMenuLabels/reads.js` precedent), 3 (memos — unchanged), 4 (tick capture — unchanged; the two stale "serially" comments fixed: `captureBodyObserver.js:25-31`, the handler's loop comment), 5 (the model call — the request is untouched, §7), 7 (rotation — unchanged), 8 (`finally` — unchanged), 9 (the lock — unchanged), 12–13 (memory, logs — unchanged), 14 (the 51 existing suites — green, two shape assertions edited, §9).

---

## 3. Part 1 — the pool (`EVAL_POOL_K`, shipped 1)

**The settings** (`src/config/featureFlags.js`): `EVAL_POOL_K = 1` (`:2838`) and `EVAL_POOL_START_CUTOFF_MS = 200_000` (`:2853`), each with a `// Pinned by: evalCapacityFlags.test.js` pointer. `flagPinGuard.test.js` sees only boolean `*_ENABLED` flags, so it gained a **named numeric-settings check** (`NUMERIC_SETTINGS`, four rows, one of them a planted contradiction) — disclosed as a guard edit.

**The dispatcher** (`api/_utils/evalPool.js`, pure, no I/O, no clock):
- `clampPoolK` `:29` — an integer 1–8 as is, anything else 1 (rows: 0, 9, 1.5, "3", NaN, null, −2, Infinity, `{}`, `[2]`).
- `poolStartCutoffMs` `:37` — `TIME_BUDGET_MS` at K = 1, the pool's cutoff above.
- `poolGroupOf` `:46` — the battle's `groupId` when a non-empty string (the field `resolveTournamentContext` reads, `tournamentAgentLedger.js:305-307`), else none.
- `runEvalPool` `:79` — before each start, and only while a battle waits, the start rule is asked; the first "no" stops it for good and hands the never-started battles, in rotation order, to `onStop`. A battle whose group has one in flight is passed over; the first later battle whose group is free starts, and the passed-over one is reconsidered ahead of later ones. It resolves only when nothing is in flight. A `run` that rejects (the handler's own catch makes that a defect) stops new starts, waits for the rest, then rejects — and defers nothing, as the loop's exception did.

**The handler** (`api/cron/agent-evaluate.js:544-628`):
- `poolK = clampPoolK(EVAL_POOL_K)`; `startCutoffMs` = 290 s at K = 1, 200 s above; `evalRun.pool` is the live stats object.
- **K = 1 is the loop, step for step:** the rule is `elapsed ≤ startCutoffMs`, i.e. not `elapsed > TIME_BUDGET_MS`, asked before each battle; the first "no" sets `deferredBattleIds`, `deferredAt` and the `deferred`/`skipped` counts exactly as the loop's break did, with the same log line. Affinity never binds at K = 1 (nothing else is in flight when a battle starts).
- **The `for (const [index, battle] of activeBattles.entries())` statement is kept** as the pass that builds the pool's items (`:560-562`). `api/_utils/callRecords/releaseSites.test.js:74` anchors the "release read before the loop" check on that literal; keeping it keeps that test unedited, and the guarantee it protects (the forced read precedes every battle) still holds.
- **One capture scope per battle:** the pool's `run` (`:589-627`) is the loop body verbatim — `newTickCaptureScope()` per battle, `runInTickCaptureScope`, the per-battle catch with its `cronErrors` receipt and `finalizeAbandonedTickCapture(db, captureScope, …)`. Never one scope around several battles.
- The handler `await`s the pool, so every in-flight battle finishes before the deferred beat and the run record.
- The release read stays one forced read per run, before the first dispatch (`:503`).

**Why 200 s.** The admission test closes at 222 s at `on` (a call needs 10 + 42 + 12 + 4 = 68 s of the 290 s budget; discovery §2). The measured agent-mode pre-call phase (lock → admission) is median 13.5 s, **max 22.1 s** (discovery §B2). A battle started at 200 s whose pre-call runs to the measured max reaches admission at 222.1 s and takes a **clean budget skip**: no model call, its own final write well inside the 300 s ceiling. A typical one (13.5 s) is admitted at 213.5 s and a 42 s call ends its write by about 274 s. So the cutoff guarantees a clean finish, not a model call; 200 s gives up at most one admission per lane against a 222 s cutoff and keeps the 300 s kill out of reach. To be tuned from the run record's `pool` block (§7).

**Rows:** `api/_utils/evalPool.test.js` (16) and `api/cron/agent-evaluate.pool.test.js` (11, the real handler): K = 2 and K = 3 never exceed K and reach K; two battles in flight each in their own capture scope; a battle that throws gets its receipt while the one beside it finishes; no start after the cutoff, a start at exactly the cutoff and not 1 ms after; in-flight battles never deferred; deferred = never started, in rotation order; the run record waits for the battle in flight; K = 1 keeps 290 s; group-mates never overlap and the passed-over mate starts when its mate finishes, ahead of later battles; K = 9 runs as 1; flag off prepares no macro share.

---

## 4. Part 2 — the EODHD fetch guard (`EODHD_FETCH_GUARD_ENABLED`, shipped false)

**The helper** (`api/_utils/eodhdFetchGuard.js`), `eodhdFetch(url, kind)` `:174`. The seven bare `fetch(url)` sites of `marketDataCache.js` now call it (`:361` eod, `:388` fundamentals, `:458` holders, `:481` news, `:509` earnings, `:805` real-time, `:889` intraday — `fetchIntradayBatch` reaches it through `fetchIntradayCandles`).

- **Flag off:** a non-async pass-through — `fetch(url)` with one argument, no signal, no wait; the caller awaits **the very promise `fetch` returned** (row: `toBe`). Counting attaches a status reader beside it and never touches the body or the rejection.
- **Flag on:**
  - a **10 s timeout** (`EODHD_FETCH_TIMEOUT_MS` `:36`) from **dispatch** (after the queue) to the **end of the body**: the body is read inside the window and handed back as a buffered `Response`, so the caller's own `response.json()` cannot hang (rows: a hung request and a hung body both abort at 10 s, not 1 ms before; a request that waited 9 s in the queue still gets its full 10 s);
  - a **process-wide limiter of 32** in flight (`EODHD_FETCH_CONCURRENCY` `:48`), first come first served, the slot handed over on release (row: 200 concurrent calls never exceed 32, reach 32, all complete);
  - `fetchIntradayBatch` keeps its 5-at-a-time pacing inside the limiter (unchanged code).
- **The timer is `setTimeout` + `AbortController`** (the intraday poller's precedent), not `AbortSignal.timeout`: the prompt's precedents name both, and Node's `AbortSignal.timeout` runs on internal timers that test fake timers do not drive, so the required fake-timer row could not exercise it.

**Why 32.** One agent-mode check fans out up to 82 GETs at once (41 symbols × `/eod/` + `/real-time/`) plus 7 intraday requests. At 32 the fan-out runs in about three waves. At an EODHD round trip of roughly 150–300 ms (ASSUMED — no latency is recorded anywhere) that adds about **0.3–0.6 s** to a 13.5 s median pre-call phase at K = 1, while K = 8 lanes (≈ 656 GETs at once) can no longer open 656 sockets together. Below ~16 the waves start to cost seconds; above ~64 a single lane is never limited at all. The `eodhd` block (§7) will show the real request mix.

**A timeout takes the network-error path, caller by caller** (VERIFIED; rows in `eodhdFetchGuard.test.js` compare a timeout and a network error field for field through the real `getStockAnalysisData`):

| Caller | Existing error path | A timeout |
|---|---|---|
| daily, forced (the evaluator's) — `getStockAnalysisData` `:642-683` | `errors.daily`, **no bars**: `forceRefresh` skips the cache read, so there is no stale backup | same |
| daily, cached (research and others) | `errors.daily`, then the **stale document** (`cacheStatus 'stale_fallback'`) | same |
| fundamentals, news, earnings | the same `try` → `errors.<field>` → stale fallback when cached | same |
| holders — `getCachedHolders` `:1250` | `fetchHolders` throws out to its caller | same |
| real-time, daily+price call — `fetchRealTimePrice` catch `:836-855` | **the latest daily close as `{ current, fallback: true }`** — the existing fallback, which the evaluator's quote guard refuses for every held and CPU symbol (`agentQuoteHealth.js:23-29`) | same |
| real-time, price-only call | `errors.price`, **no price** | same |
| intraday — `fetchIntradayBatch` `:967-993` | `Promise.allSettled` → `[]` for that symbol | same |
| intraday — cascade qualification `agent-evaluate.js:950-980` | its own 6 s race; any throw disqualifies | same |

Correction to two premises in the prompt, as the code reads: the evaluator's daily path has **no** stale fallback (forced calls never fill one), and the real-time path **does** make a price on a failed request — the `fallback: true` daily close above, refused for held symbols, unchanged by this build.

**Other EODHD callers (not changed in this build):**

CENSUS_TABLE

---

## 5. Part 3 — the evaluator's market-data cuts (`EVAL_MARKET_DATA_CUTS_ENABLED`, shipped false)

### 5.1 Why the evaluator forces a refresh

`git log -S'forceRefresh: true' -- api/cron/agent-evaluate.js` → `c315707db` (2026-03-25, "add Phase 2 Haiku mid-battle evaluation system"): the fan-out was born `getStockAnalysisData(symbol, { forceRefresh: true, fields: ['daily'] })` — which fetched **no** price; `12a715577` (2026-03-30) added `'price'` ("used fields: ['daily'] which skipped the real-time price fetch, causing all scores to compute as 0"); `d037b2fa1` (2026-06-03, Guard 2) then **reused** the already-fetched daily series ("capture the already-fetched daily series (in-memory only; never written to the doc)"). None of the three, nor any audit they cite, asks for daily bars that change during the session: `forceRefresh` was there for the price, and the daily bars rode along. The real-time quote is never cached by `marketDataCache` in any case (`fetchRealTimePrice`).

### 5.2 Every reader of the check's daily bars

| Reader | What it reads | Same input from a session-stable series? |
|---|---|---|
| **Guard 2, held positions** — `agent-evaluate.js:1418` → `resolveBadgeBaseline` (`baselineValidation.js:233-242`) → `selectPriorSessionBar` (`:142-150`) | **the newest bar dated before the cutoff** — ET today for a stock, UTC today for a crypto pair; nothing else | **Yes, by construction:** a series is stored and reused only when that bar IS the expected one (`isReusableSessionSeries`, `evalMarketData.js:99-105`: the previous NYSE session from the calendar of record, `getPreviousSessionDate`; the previous UTC day for crypto). Past rows not changing intraday is ASSUMED (not observable without an EODHD call); the selector reads one row, and the check makes that row's date certain. |
| **Guard 2, CPU positions** — `:1471` | the same | the same |
| **The real-time fallback** — `fetchRealTimePrice` catch, `marketDataCache.js:836-855` | **`daily[0].close` — the newest row, not date-filtered** — when the quote request fails | **Never served from the stored series.** Whether `/eod/` carries a same-day row during the session is not known (field inventory S2), so this path fetches `/eod/` **fresh** at that moment (`loadFallbackDaily`, `:841-843`; `evalMarketData.js:221-223`), exactly as the daily+price call did; `data.daily` then carries those fresh bars to Guard 2 as well. |
| Hot-bench rebuild prices `:1791-1800`, catalysts `:2978-2985`, proposal prices `:5386-5394` | `data.price` only (their daily bars feed only the same fallback) | not cut: they keep `forceRefresh` daily+price |
| Regime | `stockTechnicalScores/{sym}` docs (`:1632`, `:1912-1916`) | not daily bars |
| ATR, thresholds | `asset.baseATR` / the score's `baseATR`; `battle.thresholdHistory` (`:1403-1421`) | not daily bars |
| The risk manager | `evaluateRisk(riskPosition {baseATR, dailyPct = changePercent}, currentPrice, entryPrice, baseATR, intradaySnapshot, …)` (`:2113-2123`) — quotes and 5-minute candles | not daily bars |
| (side effect) `marketDataCache/{SYM}_daily` | the fan-out rewrote it every check; with the cut, the session fetch and any fresh fallback still write it (once per session at least) | other readers (research via its 4 h TTL; `compute-institutional-intelligence.js:213`, newest close) — founder question 5 |

`dailySeries` is filled only at `:1322-1323` and read only at `:1418` and `:1471` (grep, VERIFIED). **No reader needs bars that change during the session — no STOP.**

### 5.3 What 3a does (`api/_utils/evalMarketData.js`)

- `fetchEvalSymbolData` `:211` replaces the fan-out's call only with the flag on (`agent-evaluate.js:1316`): the **quote** is fetched fresh every check (`fields: ['price']`); the **bars** come from `sessionDailySeries` `:174`.
- **Where the series lives, and why:** `evalSessionDaily/{eodSymbol}_{etDate}` in Firestore, plus a process memo. A document lets a cold instance reuse what a warm one fetched (cron invocations land on fresh instances often); the memo also makes a symbol's first fetch **single-flight** across battles in flight. Not `marketDataCache/{SYM}_daily`: other paths write that one, its window can be narrower (the pre-D-120 30-day payload) and it carries no session stamp.
- **"Narrow"** for this module: a `windowDays` stamp that is not `DAILY_WINDOW_CALENDAR_DAYS` (90), or fewer than **55 rows** (`SESSION_DAILY_MIN_ROWS` `:66` — 90 calendar days always yield ≥ 55 NYSE sessions; the old 30-day payload yields ~21). A narrow, foreign-stamped or prior-bar-less document is never used; a narrow or prior-bar-less fetch is never stored (each check then fetches as before).
- **Bounded, fail open:** every read and write is bounded to 1.5 s; a read that fails, times out or finds an invalid document falls back to the fetch as it was; a battle waiting on another battle's first fetch that came back unusable fetches daily+price itself.
- The session fetch goes through the one daily path (`getStockAnalysisData(sym, { forceRefresh: true, fields: ['daily'] })`), so the URL and the row mapping are the evaluator's own.

### 5.4 3b — macro quotes once per run, and every per-battle effect

With the flag on, `prepareRunMarketShare` (`evalMarketData.js:239`, called once at `agent-evaluate.js:542`, before the first dispatch) fetches SPY, QQQ and BTC-USD.CC through `fetchEvalSymbolData`, each bounded to 10 s. `sharedMacroQuote` (`:261`) hands each battle **a deep copy** with the run fetch's instant — **unless the battle holds, benches, hot-benches or scores the symbol itself** (`ownMarketSymbols`, `agent-evaluate.js:1311`), in which case its own fetch serves both roles as before.

| Per-battle effect of a fetched quote | With the run's copy |
|---|---|
| `prices[sym]` (`:1318`) | the copy — no battle can change another's (row: mutation isolation) |
| the calls step `recordFetchedQuote(…, fetchedAtMs)` (`:1320`) | the **run fetch's instant** (row: SPY/QQQ carry the share's instant, NVDA the check's). An observation never admits a quote fetched after its instant (`observe.js:74-75`); a run-start quote is always earlier, so the rule holds. |
| the quote guard / `degradedQuotes` (`:1327-1340`) | macros are not required symbols unless held — and a held macro is never shared |
| scoring and the risk manager | a held or benched macro is never shared, so a run-start quote never reaches them (row: a battle benching SPY fetches SPY itself; writes identical) |
| the prompt (`macroPrices` `:1344-1348`, `prices`) | the copy's values — identical when the quote is (rows; dark-proof control) |
| the tick capture | records scores and the universe, never quotes (`:1556-1567`) — unchanged |
| a run share that could not price a symbol | that battle fetches it itself (row) |
| the hot-bench rebuild / catalysts adding a macro mid-check | impossible: both require the name in `stockRankings`, which holds no SPY, QQQ or BTC (`rankingConfig.js`, grep) |

**No effect is lost — no STOP.** One reading is stricter than the letter ("handed to each battle"): a battle that owns a macro keeps its own fetch, so a run-start quote never reaches scoring or the risk manager. Founder question 1.

**The evidence, beyond the rows:** the dark-proof harness run with this flag **ON** (§8) gives, in all 16 cases, battle writes, run records (minus the new blocks), model requests, start order and responses **identical to `main`**; only `marketDataCache`/`evalSessionDaily` writes and EODHD traffic differ (e.g. three CPU seats: 12 `/eod/` + 12 quotes → 0 + 6).

### 5.5 Units per check (the discovery's B4 method)

An agent-mode check: 41 symbols (31 universe + 7 CPU book + 3 macros), each `/eod/` (1 unit) and `/real-time/` (1 unit); 7 held symbols' 5-minute candles at 5 units.

| | `/eod/` | `/real-time/` | intraday | **per check** | **per battle-day (26 checks)** |
|---|---|---|---|---|---|
| flag off (today) | 41 | 41 | 35 | **117** | **3,042** |
| flag on, B battles per run | ≈ 41 ÷ 26 ≈ 1.6 the first day (one per symbol per session; less with overlap; + one per hot-bench name new that session) | 38 + 3 ÷ B | 35 | **≈ 74.6 + 3 ÷ B** (B = 1: ≈ 77.6; → ≈ 74.6) — **≈ 73 + small** | **≈ 1,940 + 78 ÷ B** (B = 1: ≈ 2,017) |

A failed quote adds one fresh `/eod/` (rare). The occasional sites (hot-bench rebuild, catalysts, proposals) are unchanged. At 25 players (R1, 26 checks each): evaluator ≈ 76,050 → ≈ 49,000 units a day.

---

## 6. Part 4 — the limits on record (live from merge)

**The run record** (`composeEvalRunRecord`, `agent-evaluate.js:711`) keeps its 14 fields and adds, at the end:
- `pool: { k, startCutoffMs, maxInFlight, dispatched }` — the dispatcher's own numbers; `startCutoffMs` is the rule in force (290 000 at K = 1). A run that never dispatched (no active battle, or a throw first) records the settings with zeros (`idlePoolBlock` `:740`).
- `anthropic: { requestsLimit, inputTokensLimit, outputTokensLimit, minRequestsRemaining, minInputTokensRemaining, minOutputTokensRemaining, responses429 }` — the lowest limit and the minimum remaining seen across the run's model calls; `null` where no call carried the header; `responses429` counts the run's 429s.
- `eodhd: { requests: { eod, realTime, intraday, other }, timeouts, non2xx: { '429', '5xx', other } }` — the process counters of `eodhdFetchGuard.js` as a **difference** from the handler's first statement (`:318`) to the record's write. Why a difference is this run's own traffic, and its limit, are in the comment at `writeEvalRunRecord` (`:743-757`): one evaluator invocation per process window (a 15-minute cron whose runs end inside 300 s); a second invocation sharing the process while this one is open (a manual call during a run, or several invocations in one instance under Fluid Compute) is counted in both. The `anthropic` window has the same limit.

**The header names** (Anthropic API documentation, "Rate limits" → "Response headers", `platform.claude.com/docs/en/api/rate-limits`, read 2026-11-15): `anthropic-ratelimit-requests-limit` / `-remaining`, `anthropic-ratelimit-input-tokens-limit` / `-remaining`, `anthropic-ratelimit-output-tokens-limit` / `-remaining` (integers; token "remaining" values rounded to the nearest thousand). The installed SDK (`@anthropic-ai/sdk` 0.71.2) names none of them; it exposes the raw `Response` through `APIPromise.asResponse()` (`core/api-promise.mjs`) and a failed request's headers on the error (`APIError.headers`, `core/error.mjs`; a non-2xx rejects the response promise, `client.mjs:280-309`).

**The seam, and why this one** (`api/_utils/anthropicRateLimits.js`). Two seams were ruled out by pins this build may not edit: the client's construction (`agent-evaluate.tickCapture.bodies.test.js:139-159` pins its options to `{ apiKey, maxRetries }` plus the capture `fetch` under its flag) and the call literal `await anthropic.messages.create(` (`agent-evaluate.tickStamps.pins.test.js:164`, `cryptoSlotVerdict.test.js:364`). So the evaluator observes **the client it uses for its one call**: `const anthropic = observeRateLimits(getAnthropicClient());` (`:3119`). `observeRateLimits` (`:152`) exposes `messages.create(body, options)`, which calls the SDK's own `client.messages.create(body, options)` — the same arguments by reference, so the request bytes cannot differ — and returns **the SDK's own promise**. Beside it, it asks that promise for its raw response (`asResponse()`), which neither consumes the body nor changes what the call site awaits, and reads the headers when they arrive (success) or from the error (429). It does not depend on the capture's observing `fetch`, so it works with tick capture on and off (row: both). Every read is wrapped; a failure records nothing (`null`), never a throw into the call path (rows: a throwing headers object; a throwing `asResponse`). The dark proof shows the request bytes unchanged (§8).

**The read script** (`scripts/eval-capacity-read.mjs`, read-only, no ids): `runRow` keeps the three blocks as numbers (`limitsOfRun` `:180`); section **L** (`limitsRead` `:209`, `renderLimits` `:579`) prints per session the limits seen, the minimum remaining, the 429s, EODHD requests per check (requests ÷ battles evaluated) by endpoint with timeouts and non-2xx, K and the maximum in flight. Before the merge it says no record carries the blocks yet.

---

## 7. The model request is untouched

Request construction is unchanged (client options, model, tool, prompt, parameters); the dark proof compares the real SDK's outgoing **method, URL, headers (minus the key) and body bytes** in every case that calls the model: identical (§8). The tool and prompt pins stayed green without edits.

---

## 8. The dark proof (required — K = 1, every flag at its shipped value)

**Harness.** One test file, copied byte for byte into two Linux trees at the **same path** (`~/pd-ci-cap1dp`, moved between SHAs) — `origin/main` (`ea5e0c5b`) and the build (`DARKPROOF_SHA`). Doubled: the network (one global `fetch` — EODHD and Anthropic) and Firestore (one in-memory store; every write recorded with its sentinels and timestamps). **Real:** the handler, `processAgentBattle`, the Anthropic SDK (it builds and sends the request), `marketDataCache` (it builds and sends the EODHD requests), and **every feature flag at its shipped value** (tick capture on). Mocked identically in both trees (the evalRun suite's set): the active-battle query, the canonical-open sweep, the mastery repair sweep, the tournament ledger, the pattern logger, the voice layer's Gemma calls, the shadow logger. A fake clock; each fixture charges its cost at its final score write.

**Compared per case:** the order battles start (lock transactions), every Firestore write (op, path, data, in order), every model request (method, URL, headers, body bytes), every EODHD URL (in order), other requests, the run record (the build's three blocks checked present and `main`'s absent, then stripped), the HTTP response.

**16 cases:** agent mode HOLD; agent mode SWAP (the real executor); three CPU seats; League group-mates (`baggerbomb_tournament`, one `groupId`) + one agent battle; no trigger; budget skip (admission after 222 s); deferred (two battles past 290 s); lock skip; an error battle (its document gone); near the budget (a start at 289.999 s, a deferral at 290.001 s); degraded quotes; `/eod/` down; gameplan pending; proposal pending; a mixed six-battle run (HOLD, SWAP, CPU, League, a stale lock stolen, a budget skip, a deferral); an empty run. Every case reached its named exit with non-zero writes and requests (`summarize.mjs`).

**Result: 16 cases, 112 comparisons, 0 differences.** (A first pass in two differently named trees differed in one field — the 200-character stack stored in `cronErrors` carries the tree's path; the same-path run removed it.)

**Controls (planted differences, same harness):** with `EVAL_POOL_K = 2` the comparator reports 8 of 16 cases different (every multi-battle case); with `EVAL_MARKET_DATA_CUTS_ENABLED = true` it reports 15 of 16 (all but the empty run) — and, filtered to non-cache writes, **all 16 identical** (§5.4).

Artifacts (scratchpad, out of tree): the harness, `compare.mjs`, `cuts-scope.mjs`, `summarize.mjs`, and the per-case JSON for `main`, the build and both controls.

---

## 9. Tests

**New files (rows):** `api/_utils/evalPool.test.js` (16), `api/cron/agent-evaluate.pool.test.js` (11), `api/_utils/eodhdFetchGuard.test.js` (15), `api/_utils/evalMarketData.test.js` (24), `api/cron/agent-evaluate.marketDataCuts.test.js` (7), `api/_utils/anthropicRateLimits.test.js` (13), `api/cron/agent-evaluate.limitsOnRecord.test.js` (7), `scripts/eval-capacity-read.limits.test.js` (5), `src/config/evalCapacityFlags.test.js` (7).

**Edited assertions (the one sanctioned kind — the run record's exact shape):** `api/cron/agent-evaluate.evalRun.test.js` — `RUN_KEYS` gains `'pool', 'anthropic', 'eodhd'` (used by two rows: TEST 1 and the composer boundary row); TEST 1's `toEqual` gains the three blocks' expected values (K = 1, cutoff 290 000, max in flight 1, dispatched 3; no headers → nulls; EODHD doubled → zeros). Nothing else in the 51 `agent-evaluate.*.test.js` files changed; `agent-evaluate.tickCapture.isolation.test.js` is unchanged.

**Guard edit (disclosed):** `src/config/flagPinGuard.test.js` — two `DARK_BY_DESIGN` entries (`EODHD_FETCH_GUARD_ENABLED`, `EVAL_MARKET_DATA_CUTS_ENABLED`) and the named numeric-settings block (four rows).

**Mutation battery** (BUILD_RULES §2; Linux, applied to a clean tree and restored from `HEAD` after each; KILLED needs a non-zero exit AND a failed row): MUTATION_RESULTS

---

## 10. Fenced functions called — none edited

`git diff --quiet 187ef495 HEAD` on every §1 file, `agentEvalTransport.js` and `vercel.json`: **untouched**. This build adds **no** new call to a fenced function. `processAgentBattle` keeps calling, unchanged, what it called: `executeSwapServer` (`agentSwapExecution.js`), `evaluateRisk` (`agentRiskManager.js`), `calculateAssetScoreServer` (`agentScoring.js`), the eval prompt builders (`agentEvalPromptAssembly.js`), `getArchetypeConfig` and friends (`agentArchetypeConfig.js`), `findActiveAgentBattles` / `completeBattle` (`agentBattleService.js`), `applyGuardrails` (`agentGuardrails.js`). The new modules import only non-fenced code: `marketDataCache.js`, `marketSchedule.js`, `baselineValidation.js` (`selectPriorSessionBar`), `intraday/evaluatorHook.js` (`withTimeout`), `featureFlags.js`. With the flags at their shipped values, nothing the scoring engine or the risk manager receives changes (§8); with the cuts on, the dark-proof control shows their writes unchanged (§5.4).

---

## 11. The review

REVIEW_HEADLINE

---

## 12. Checks on the final head, merged with current `main`

FINAL_CHECKS

---

## 13. Founder questions

1. **A macro the battle owns.** Built: SPY, QQQ or BTC-USD.CC is shared only with battles that do not hold, bench or score it; an owning battle fetches its own, as today. The prompt's letter ("handed to each battle") would also share it with those battles — a run-start quote would then reach their scoring and risk manager. Keep the stricter rule (recommended), or share with every battle?
2. **The three occasional fetch sites** (hot-bench rebuild, catalysts, proposal prices) still fetch daily+price with `forceRefresh` each time they run. Cut them in the flip PR, or leave them (they are a small share of units)?
3. **A TTL policy for `evalSessionDaily`.** Each document carries `expiresAt` (session + 3 days); no TTL policy exists, and creating one is a Firebase project setting this build may not make. About 41 small documents a session at today's volume. Create the policy, or leave the documents?
4. **The shared `marketDataCache/{SYM}_daily` document** is rewritten every check today by the evaluator; with the cuts on, at least once a session. Its other readers fetch on their own 4 h TTL; `compute-institutional-intelligence.js:213` reads its newest close directly. Acceptable?
5. **Flip order** (§12 of the prompt): flip 1 turns on the guard and the cuts together after a session's baseline from the new blocks. Flip them in one PR, or the guard first (it changes no input) and the cuts a day later?
