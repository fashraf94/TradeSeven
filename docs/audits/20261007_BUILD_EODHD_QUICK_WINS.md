# Build report — EODHD Quick Wins (re-scoped)

**Branches:**
- `perf/eodhd-quick-wins` — the build. It merges dark: nothing changes until the flip.
- `flip/eodhd-quick-wins` — one commit that turns the flag on, cut from the finished build.

**Built from:** `origin/main` = `6cef568677c3145b5b68394e4795fb5dbf3502b1` ("Merge pull request #936 from fashraf94/backing/qa-fixes"). `git fetch origin` was run first.
**Rulings:** Fable and Flash, 2026-10-07, after the Step 1 STOP report.
**Review record:** `docs/audits/20261007_EODHD_QUICK_WINS_BUILD_REVIEW.md` (BUILD_RULES §2).
**Executed by:** Claude Code (Opus 5.5). **Date:** 2026-10-07.

---

## Executive verdict

| Change | What it does | Status | Saving per trading day: today (7 battles) | Saving per trading day: 40 games |
|---|---|---|---|---|
| **QW-1** | Agent ticks reuse the shared 90-day daily series instead of re-downloading it for every battle on every tick. The live quote is still fetched every time. | Built, behind the flag | ≈ 5,500–6,300* | ≈ 57,700–61,900* |
| **QW-3** | The keep-warm robot stops calling EODHD. The health check probes EODHD only when asked (`?deep=1`). | Built, **not flagged** (live on merge) | 648 (every day) | 648 |
| **QW-4** | Every open tab reads the popular-stock/crypto list from one shared copy, refreshed at most once a minute. | Built, behind the flag | ≈ 0–3,400 | ≈ 60,200 |
| **QW-6** | The index-intelligence cron keeps its 256 daily histories for up to 4 hours within a session instead of re-downloading them every hour. | Built (bullet 1), behind the flag | ≈ 1,530 | ≈ 1,530 |
| **QW-7** | Mandate evaluation skips its market snapshot when there are no mandate books and no open batches. | Built, behind the flag | ≈ 816 (+0–1,360) on zero-book days | same |
| QW-2, QW-5, QW-6 bullet 2 | — | **Dropped by ruling** | — | — |
| QW-6 bullet 3 (holiday gate) | — | **Approved, NOT built**: it would change what decision paths read on holidays (§2.4) | (≈ 4,000 per weekday holiday, about 9 a year) | |
| **Total** | | | **≈ 8,500–12,700** of ≈ 86,000 | **≈ 120,900–125,100** of ≈ 409,000–467,000 |

\* QW-1's saving depends on one number nobody has measured: how often EODHD's live `previousClose` exactly equals its own `/eod/` raw close. If they routinely differ, QW-1 saves nearly nothing, but it never changes a number either. The smoke log line in §7 measures it on day one.

**Invariant.** No change alters a scored number, a banked score, a baseline, a threshold check or an agent decision input. Each change carries its proof tests. Two residuals and two founder decisions are listed in §8.

**Even with every quick win, the server side at 40 games stays at ≈ 236,400–240,600 calls a day, 2.4× the budget.** The Price Authority work is still required.

**Suite of record (Linux/WSL, CI-shaped `--maxWorkers=2`, TZ=UTC):** green. The verbatim lines are in §9. `vite build`, the CI lint gate, a 5-lens adversarial review with 4 independent verifiers, and mutation checks are all done (§9, review record).

---

## 1. SHA, tree state, and citation verification

- **Fetch.** `git fetch origin` was run first. `origin/main` = `6cef5686`.
- **Since the STOP report** (taken at `2cc4e8b3`), main gained #936 (backing QA fixes). It touches none of this build's files (`git diff --name-only 2cc4e8b3 6cef5686`).
- **Tree state.** The shared checkout `C:/Users/fashr/portfolio-duel` held three untracked files from another session:
  - `docs/audits/20260911_VOICE_GROUNDING_PAIRED_HARNESS.md`
  - `exit-dials-live-census-report.json`
  - `vwap-exit-dating-census-report.json`

  The build was cut and committed in a private worktree (`git status` clean). The foreign files were not touched.
- **Fenced files** (BUILD_RULES §1): none edited. `decide.js`, `agentSwapExecution.js` and `agentEvalPromptAssembly.js` were read only. `getStockAnalysisData` is not fenced. The fenced swap path (`agentSwapExecution.js:144`) keeps its forced refresh.

**Step 1 citation verification** (census taken at `8c5f56b8`; re-verified at `2cc4e8b3` in the STOP report, and #936 changed none of these files):

| QW | Cited site | Status |
|---|---|---|
| QW-1 | `api/cron/agent-evaluate.js:1042`, `:1452`, `:2486`, `:4733` (forced refresh) | CONFIRMED. Only `:1042` reads the series (Guard 2); the other three read `data.price` only. |
| QW-1 | `api/_utils/marketDataCache.js:742` (live price never cached) | CONFIRMED |
| QW-1 | `baselineValidation.js:219-233` (`resolveBadgeBaseline`) | CONFIRMED, at `:233-242` |
| QW-1 out of scope | `agent-daily-scores.js:257-260`, `decide.js:1044`, `agentSwapExecution.js:144` | CONFIRMED, untouched |
| QW-3 | `.github/workflows/main.yml:36`, `:45`, `:54`; `api/health.js:25`; `api/crypto/prices.js:55` | CONFIRMED |
| QW-4 | `src/App.jsx:3443-3471`; `getPopularStocks` / `getPopularCrypto` | CONFIRMED |
| QW-6 | `api/cron/compute-index-intelligence.js:147-149`, `:305-308` | CONFIRMED |
| QW-7 | `api/cron/mandate-evaluate.js` (no book check before the build) | CONFIRMED |
| QW-2, QW-5 | — | Dropped; their Step 1 findings are in the STOP report and in §4 here |

---

## 2. What changed, with proof and savings

**Census formulas** (census §3 Q-06, Q-07, Q-08; Q-09 for the loads):
- **(a) today:** 7 BaggerBomb agent battles, 26 evaluating ticks.
- **(b) 40 games:** 24 BaggerBomb + 16 League pods.
- Symbols per battle: 36 for BaggerBomb, 24 for a League seat.
- **ASSUMED** values are marked.

### 2.0 The flag

- `EODHD_QUICK_WINS_ENABLED = false` at `src/config/featureFlags.js:3063`.
  - Its docstring lists what sits behind the flag, what does not (QW-3), and the flip map.
  - A `// Pinned by: eodhdQuickWinsFlags.test.js` pointer sits above it.
- Pin test: `src/config/eodhdQuickWinsFlags.test.js` (value, `Pinned by`, registration, docstring rows).
- Registered `DARK_BY_DESIGN` at `src/config/flagPinGuard.test.js:196`.
- **Every consumer reads the flag at call time inside a try/catch.** A hermetic `featureFlags` mock that omits the name throws on access under vitest, so it must read as off.

### 2.1 QW-1: the evaluator honours the daily-series cache

**What changed**
- `api/cron/agent-evaluate.js:826` `evaluatorQuoteOptions()`. All four sites (`:1068`, `:1478`, `:2512`, `:4759`) call it.
  - Flag off: `{ forceRefresh: true, fields: ['daily','price'] }`, exactly the base literal.
  - Flag on: `{ fields: ['daily','price'], dailyPolicy: 'session_current' }`.
- `api/_utils/marketDataCache.js`:
  - `DAILY_POLICY_SESSION_CURRENT` (`:580`)
  - `previousUtcDate`
  - `dailySeriesCurrency` (`:603`)
  - `PRIOR_CLOSE_AGREEMENT_TOLERANCE = 0` (`:625`)
  - `priorCloseAgrees` (`:628`)
  - `dailyFallbackPrice` (`:641`), the one builder for the quote-failure fallback
  - the policy branch in `getStockAnalysisData` (`:696` onward; served at `:747`; post-quote checks at `:837`)
- The rule is in §3.

**Proof**
- `api/_utils/marketDataCache.qw1.test.js` (26 rows) runs the real two-layer cache with the vendor stubbed:
  - **P1:** the Guard 2 reference and every field the evaluator reads are identical, cache vs fresh, for a stock, a stock where Guard 2 substitutes, and crypto.
  - **P2, red-then-green:** a series one session stale must refetch. The red half is mutant M1 in review record §6.
  - Every refusal case: a bar dated today, TTL-stale, null calendar, session closed, failed refetch never served stale, `forceRefresh` wins.
  - The quote-failure refetch, including a revised close.
  - The review E1-1 rows (R1 corrected close, R2 glitched close, null raw close, quote without `previousClose`, exact vs rounding) and the E1-2 rows.
- `api/cron/agent-evaluate.qw1.test.js` (9 rows):
  - flag off passes `forceRefresh: true` at all four sites, shown three ways: the helper, a source scan of exactly four sites, and the real `processAgentBattle`;
  - flag on uses the policy;
  - the local policy literal equals the cache module's;
  - the flag read sits inside a fail-safe.

**Saving** (only the `/eod/` leg; the live quote is unchanged)
- **Today:**
  - Before: 26 ticks × 7 battles × 36 symbols = **6,552** `/eod/` calls a day.
  - After: about 2 fetches per distinct symbol per session (one per 4 h TTL in a 6.5 h session). ASSUMED ≈ 135 distinct symbols → 270.
  - If crypto series always refetch: 4 crypto per BaggerBomb battle (held, bench, CPU, `BTC-USD.CC` macro) × 7 × 26 = 728.
  - **Saving 6,552 − 270 − (0…728) ≈ 5,500–6,300.**
- **40 games:**
  - Before: 26 × (24 × 36 + 64 × 24) = 26 × 2,400 = **62,400** (census Q-10).
  - After: 2 × 266 distinct (Q-10) = 532, plus crypto (24 × 4 + 64) × 26 = 0…4,160.
  - **Saving ≈ 57,700–61,900.**
- **Caveat:** each `prev_close_mismatch` refetch costs one call back. The rate is unmeasured (\*).

### 2.2 QW-3: keep-warm stops spending EODHD calls (not flagged)

**What changed**
- `.github/workflows/main.yml`:
  - The stock-prices and crypto-prices steps are removed. Only "Warm Health Endpoint" remains (`:38`).
  - The header cost comment is corrected (`:7`): 216 pings a day and **zero** EODHD calls. The old comment claimed "~864 total, < 1%".
- `api/health.js`: the EODHD probe runs only on `?deep=1` (`:139`). Otherwise the EODHD row reports `not_checked` (`:20`), and the overall status is judged on the checks that ran. Firebase, Claude key and cache checks are unchanged.

**Proof:** `api/health.qw3.test.js` (7 rows).
- No outbound EODHD request without `?deep=1`.
- Exactly one with it.
- Only the literal `1` opts in.
- A probe that was not requested never degrades the status.
- The workflow no longer references `/api/stocks/prices` or `/api/crypto/prices`, still pings health without `deep`, and has the corrected header.

**Saving:** 3 pings × 216 a day = **648 a day, every day**. That assumes the workflow is enabled (UNKNOWN).

**Recorded, not fixed (as instructed):** the old crypto ping built `BTC-USD-USD.CC`. The route appends `-USD.CC` to `BTC-USD` (now `api/crypto/prices.js` `cryptoRealtimeSymbolList`).

### 2.3 QW-4: the app-wide market poll becomes one shared fetch

**What changed**
- **New route** `GET /api/market/popular` (`api/market/popular.js`).
  - It takes no symbol parameters. The server owns the lists (`src/data/assets.js`, the source of `getPopularStocks` / `getPopularCrypto`).
  - The vendor fetch is bounded at `POPULAR_VENDOR_TIMEOUT_MS` = 10 s (`:53`), below the lease.
  - Flag off → 404 with no read of any kind.
  - CDN header (`s-maxage` 60 ≤ TTL, `stale-while-revalidate` 30, the per-symbol routes' own tier) only on a complete answer.
- **Shared cache** `api/_utils/popularMarketCache.js`:
  - Firestore `marketDataCache/{stocks,crypto}_popular`, using the `marketDataCache` L2 conventions.
  - `POPULAR_MARKET_TTL_MS = 60_000` (`:55`), the one named constant the ruling asked for.
  - Off-hours settle rule (`POPULAR_CLOSE_SETTLE_MS`, `:63`; `popularEffectiveTtlMs`, `:91`).
  - Lease (`:115`), fenced write (`:246`), fail-open (§5).
- **Record builders.** The per-symbol routes' builders were extracted, byte-identical, and are reused (`api/stocks/prices.js:38-61`, `api/crypto/prices.js:28-51`), so a tab gets the record shape it always got. Both routes' OFF-reference suites still pass.
- **Client:**
  - `src/services/eodhdAPI.js`: normalizers extracted (`:134` onward), list builders (`:302`), and `getPopularMarketData` (`:504`). **It never writes the per-tab price cache.** It returns `null` on a 404.
  - `src/services/popularMarketLoader.js:35`.
  - `src/App.jsx:16` (import) and `:3454` (the call). The visibility gate and the 5-minute interval are unchanged.

**Proof**
- `api/market/popular.test.js` (32 rows), on the transaction-faithful Firestore fake:
  - **N simulated tabs (1, 5, 40) → one upstream fetch per list, independent of N.** Every tab gets the same lists. Within the TTL, polls cost nothing; after it, one fetch.
  - Records are field-for-field those of `/api/stocks/prices` and `/api/crypto/prices` for the whole list.
  - TTL, closed-market, pre-market and settle rules, including partial and empty lists.
  - Lease takeover, waiting, fail-open, and the fenced write.
  - Strict-fake validity (rejects `undefined`), timeout, partial outage, 502, 405, flag-off 404.
- `src/services/popularMarketLoader.test.js` (9 rows), end to end with the real routes in process:
  - **Flag off uses the old path** (stocks then crypto, never the new route).
  - Flag on makes one request and **no per-tab cache writes**.
  - **The lists App.jsx receives are identical, field for field**: on success, with a withheld symbol, with one list down, and with everything down.
  - Every consumed field is present.
  - A 404 falls back to the per-symbol path.
  - A hermetic mock reads as off.
  - App.jsx wiring is pinned by source scan.

**Saving** (row A only; census Q-07)
- **Today** (7 tab-hours in session):
  - Before: 7 × 1,044 = **7,308**.
  - After: 87 symbols × the number of minutes in which at least one poll lands.
    - 7 tab-hours spread across the day share almost no minutes, so the saving is ≈ 0.
    - 7 tabs inside one hour: 84 polls in 60 minutes, P(a minute has a poll) = 1 − e^−1.4 = 0.75 → 45 × 87 = 3,915.
  - **Saving ≈ 0–3,400.**
- **40 games:**
  - Before: 88 × 1,044 = **91,872** (census, no CDN collapse).
  - After: about 13.5 concurrent tabs → 2.7 polls a minute → P = 1 − e^−2.7 = 0.93 → 390 × 0.93 × 87 = 31,657.
  - **Saving ≈ 60,200.**
- Off-hours crypto now collapses to at most 33 a minute across all tabs (not modelled).
- **Minus a give-back:** with the flag on, battle screens and baseline captures no longer find the App poll's per-tab entries, so they fetch their own (review E2-5; not quantified; a founder decision in §8).

### 2.4 QW-6: index intelligence fetches daily histories once per session (bullet 1)

**What changed**
- `api/_utils/indexHistoryCache.js`: its own per-session store, `indexHistoryCache/{symbol}`. It is **not** `marketDataCache/_daily`: the windows differ (378 / 75 / 45 calendar days against 90).
  - `checkStoredHistory` (`:70`), `createSessionHistoryStore` (`:99`).
  - Serving rule: this ET date, this window, age ≤ 4 h, newest bar = prior completed session, before the session close, not a `.INDX` symbol, and (in intraday mode) raw close = the live `previousClose`.
  - `dropped` is stored and replayed.
- `api/cron/compute-index-intelligence.js`:
  - `fetchHistoryRows` (`:164`) split from `fetchOHLCV`; the store is wired in at `:207`.
  - The store is created only when the flag is on (`:766`).
  - One summary log line per run.

**Proof**
- `api/cron/compute-index-intelligence.qw6.test.js` (7 rows) drives the **real handler** end to end, the first harness that does. The outputs written to `indexIntelligence/*` and `stockTechnicalScores/*` are **identical** whether histories come from the store or a fresh fetch:
  - flag off = flag on with a cold store = flag on with a warm store, pre-market and intraday, `droppedRows` included;
  - the early-close row with a vendor that publishes the day's bar;
  - the 4 h cap, the glitched-bar row, the new-session-date row, and flag off never touching the store.
- `api/_utils/indexHistoryCache.test.js` (13 rows).

**Saving**
- Before: 9 runs × 256 = **2,304** histories a day.
- After: the store is refetched when older than 4 h and after the close, and TNX is always fetched.
  - EDT: 10:30Z fetch, 11:30/14:00 served, 15:00 refetch, 16–19:00 served, 20:00 after the close fresh.
  - That is 3 × 256 + 6 TNX = 774 (the same in EST).
- **Saving ≈ 1,530 a trading day.** Holidays behave alike, since the gate was not built.

**Bullet 2 dropped (ruling). Bullet 3 not built**, although approved. On a holiday, today's intraday wakes recompute `stockRankings`, `marketContext` and `stockTechnicalScores` with a holiday-dated bar. A gate would leave the last trading day's final intraday state instead. Those docs are read on holidays by:
- `decide.js` deploys;
- `live-draft-fire` (every 10 minutes);
- the tournament draft and board paths (including Monday-holiday draft resolution);
- `tournamentUserScoring.js` (fenced).

So the gate would change agent decision inputs. Review lens E3 and verifier EV3 both confirmed this. Value forgone: 4,089 per weekday holiday (about 9 a year).

### 2.5 QW-7: mandate evaluation does nothing with zero books

**What changed** — `api/cron/mandate-evaluate.js`:
- `nothingToMark` (`:87`) is true only with the flag on, zero active books and zero open batches.
- Its batch probe fails safe, so a probe error means "build as before".
- Eval sweep (`:324`): a fire whose snapshot is not built yet returns `no_active_books` before any build.
- Close sweep (`:710`, `:752`): the close snapshot and the book page are skipped, but the completion duty (retention cleanup, calendar-horizon probe) still runs, as on a zero-book day today.
- **With books, or with an open batch, every step is the pre-build path, with no extra read.**

**Proof:** `api/cron/mandate-evaluate.qw7.test.js` (12 rows), real sweep drivers on the transaction-faithful fake.
- Zero books → no build and no vendor call, on both sweeps; retention still runs on the close.
- An open batch keeps the build; a closed batch does not count.
- Flag off with zero books builds, as today.
- **One book: flag off and flag on give the same response, the same builder calls, the same model calls, the same final store, and the same Firestore collections touched in the same order.**
- Probe failure on both sweeps; batch transport.

**Saving:** 4 × 136 + 2 × 136 = **816 a zero-book day**, plus 10 per fundamentals miss (0–1,360) (census Q-04). 0 on days with books.

---

## 3. QW-1: partial current-day bars, and the rule implemented

**Finding.**
- The only `/eod/` capture in the repo taken during a session had **no** current-day bar: `discovery/recon-log.json` `R2_eod_AAPL_5.4yr`, Fri 2026-07-10 16:04:51 UTC (12:04 ET), `to=2026-07-10`; newest bar 2026-07-09.
- That is one symbol at one time of day. **No crypto `/eod/` capture exists.**
- The cron's own comment expects a same-day bar can appear "just after close" (`compute-index-intelligence.js` `injectIntradayBar`).

**How the consumers treat it**
- Guard 2 (`selectPriorSessionBar`) skips any bar dated today and reads the prior bar's **raw** close.
- The only other evaluator reader is the real-time-failure fallback, which reads `daily[0].close`.
- The swap path (Guard 3) is fenced and keeps its forced refresh.

**The rule implemented.** All flag-on; flag off is the forced refresh.
1. Only while the regular session is open (`isMarketOpen()`). Outside it, the series is fetched fresh.
2. A cached series is served only if:
   - it is TTL-fresh (4 h);
   - `daily[0].date` is the prior completed session: for a stock `getPreviousSessionDate(etToday)` from the calendar of record, for crypto the previous UTC date. A bar dated today, a stale series or a null calendar all refetch;
   - once the live quote is in, `daily[0].rawClose` **exactly** equals its `previousClose` (review E1-1). So Guard 2 can only fire on a fresh series, for any `baseATR`.
3. A refused series is never served, not even as a stale fallback.
4. On a real-time failure, the series is refetched before the fallback price is built. The end state is the forced path's own.

---

## 4. QW-2 (not shipped): worst-case bar age and VWAP classification

From the STOP report, unchanged.
- **Worst-case age:** a shared 5-minute-bar memo would be about **290–300 s old** when the last battle reads it (`TIME_BUDGET_MS` 290 s, `maxDuration` 300 s).
- **It can classify a battle's VWAP differently**, in four ways:
  - coverage at the open (MIN_SESSION_CANDLES = 3), in 357 of 357 sessions replayed;
  - session date before the first bar of the day;
  - freshness around a feed stall;
  - **the strike itself**. With a memo one bar behind, it flipped in 3.0 / 3.7 / 4.8% of 27,126 replayed bar steps at dead-bands 0.7 / 0.5 / 0.3. The deviation moved by a median 0.073 pp (p99 0.913 pp).
- Not shipped, per its own rule. Forgone saving at 40 games ≈ 51,600.

---

## 5. QW-4: the concurrency choice, and why

**One Firestore lease per list** (`marketDataLeases/{kind}_popular`), taken in a transaction.

**Why a lease and not write-if-older:** a write-if-older transaction alone does not stop several cold instances from each paying for the fetch before one commits. With the lease:
- The holder fetches and writes.
- The others poll the document, about 400 ms apart, until it is fresh.

**Hardened after review:**
- The vendor fetch is aborted at 10 s, below the 15 s lease (E2-4). A healthy holder therefore cannot lose its lease mid-fetch.
- The document write sits inside a transaction that still sees the writer as the lease owner. A late holder therefore can never overwrite a newer list.
- `cachedAt` is the fetch's start time.
- A holder that dies leaves a lease that expires after 15 s, and a waiter takes it over.
- **Firestore fails open** (E2-3). No handle, a read or transaction error, or a lease still busy after 20 s → that request fetches directly, uncached, exactly as a tab did before. Only a **vendor** failure makes a list unavailable, as today.

**Ruled 60 s TTL** (founder, Oct 7). It matches the age envelope of today's `/api/stocks/prices` (60 s server cache + CDN 60/30).

**Off-hours (review E2-1, HIGH):**
- A stock list freezes (until roughly the midpoint to the next open, the client's own `getEffectiveTTL` rule) only when it is **complete** and was written at least 30 min after the close, once the vendor's delayed closing prints have settled.
- In-session, settling, partial and empty lists keep 60 s.
- The 9:20–9:30 ET pre-market window is 60 s.

---

## 6. Observations (recorded; nothing here was fixed unless stated)

1. **Settlement defect (founder ruling: record, do not change).**
   - When the activation capture misses a symbol, a battle's starting price falls back to the asset's popular-list price: `startingPrices[sym] || asset.price`.
   - Sites at the base `6cef5686`: `src/App.jsx:5867`, `:6040`, `:6045`, `:6215`, `:6220`, `:6446-6453`. At this build: `:5865`, `:6038`, `:6043`, `:6213`, `:6218`, `:6444-6451`.
   - Also `:6900` (the V4 portfolio map) and `BattleViewScreen.jsx:156`, `:163`.
   - Review EV2 adds: in the classic battle flow the **creator's** entry price is the popular-list price itself (`handleCreateBattle`). The list's vintage is therefore a scored baseline there.
2. **E2-5 (founder decision §8).** With the flag on, the classic join (`getStockPrice`) and `capturePreviousClosePrices` (`src/utils/priceCapture.js:127-150`) no longer read the App poll's warm per-tab entries.
   - Normally: a fresher starting price than today's.
   - In a vendor outage: the configured fallback constant. Today that hazard applies only to symbols that are not cached.
3. **The QW-1 residual** (§8, EV1): a vendor rewrite of an already-published prior-session raw close after the cache write. EODHD back-adjusts raw daily closes for spinoffs (`docs/discovery/SESSION5_6_PHASE_B_REPORT.md:209`). Bounded by the 4 h TTL.
4. **The QW-6 residual** (§8, E3-5): a mid-session re-adjustment is seen within 4 h. Vendor assumption: **no today-dated bar for an NYSE symbol before the NYSE close** (TNX excluded for exactly that reason).
5. **QW-7 and a mid-slot first book** (E3-3, §8).
6. **BRK.B** in the popular list (pre-existing, unchanged). The server files the record under `BRK.B`, so the client's `BRK-B` lookup always falls back. Both paths behave identically (review E2).
7. **The crypto keep-warm ping** built `BTC-USD-USD.CC` (§2.2).
8. **Not in this build** (record only):
   - the intraday poller's publish ceiling (`intradayConfig.js:146-157`; Price Authority);
   - voice-layer requesting held crypto as `BTC.US` (`voice-layer-cache.js:845-851`; Price Authority);
   - the orchestrator's uncapped deploy retries (`tournamentOrchestrator.js:509-511`; tournament ledger);
   - the open fan-out routes (`earnings/resolve-tournament.js:182-183`, `sync-queue.js:105-109`, `verify-batch.js:44-49`, `options/resolve-tournament.js:205-215`; security register).
9. **Windows-only test failures** (memory list): on this Windows checkout the same 8 rows fail on the untouched base as on the build. Linux is the record.
10. **A scratch copy to delete:** verifier EV3 left `scratchpad/ev3-repro/b8/node_modules` as a 595 MB copy (not a link). It sits outside the repo and is safe to delete as an ordinary folder.

---

## 7. Smoke plan for Flash

**Step 1: merge the build PR.**
- Nothing in the app changes: the flag is off.
- Two things go live at once, because QW-3 is not flagged:
  - The keep-warm GitHub workflow now pings only `/api/health`. Check one run under Actions → "Keep Vercel Functions Warm": one step, "Warm Health Endpoint".
  - `https://<prod>/api/health` answers `"eodhd":{"status":"not_checked",…}`. `https://<prod>/api/health?deep=1` still probes EODHD.

**Step 2: merge the flip PR** (`flip/eodhd-quick-wins`). Crons do not run on preview, so the server-side checks happen in production. QW-4 can also be seen on the flip's Vercel preview.

**Step 3: read the logs on the first trading day after the flip.** In Vercel → Logs:

**(a) A cache-served daily series passing the currency check** (function `/api/cron/agent-evaluate`, search `QW1`).
- **First tick of the session:** many lines like `[MarketDataCache] QW1 DAILY_REFETCH | key=AAPL_daily | reason=ttl_stale` (or `reason=miss`). That is expected: last night's copies are more than 4 h old.
- **The second battle in that tick, and every later tick:** `[MarketDataCache] QW1 DAILY_SERVED | key=AAPL_daily | newest=<previous trading day> | expected=<previous trading day> | source=firestore` (or `source=memory`). **Seeing `newest` equal to `expected` is the pass.**
- **Count `QW1 DAILY_REFETCH | … | reason=prev_close_mismatch` lines** against `DAILY_SERVED` lines. That ratio is QW-1's real saving (the \* in the verdict). If almost every symbol mismatches, QW-1 saves little, and that is safe.

**(b) One 5-minute fetch shared by several battles: N/A.** QW-2 was not shipped. Each battle still logs its own `[MarketDataCache] Fetching intraday 5m for …`.

**(c) One popular-list fetch serving many tabs** (function `/api/market/popular`).
- At most one line per minute per list: `[PopularMarket] FETCH | kind=stocks | symbols=54 | one upstream request, shared by every tab for 60s` (and `kind=crypto`, `symbols=33`).
- Every other request that minute: `[PopularMarket] HIT | kind=stocks | ageMs=<0–60000> | source=cache`.
- In the browser (two tabs open), DevTools → Network → `popular`: one request per tab every 5 minutes, and its JSON `source` reads `cache` for the tab that did not fetch.
- **Should never appear** (they indicate degraded paths): `FETCH_DIRECT` (Firestore failing open) and `FETCH_UNCACHED`.

**Also on day one:**
- `/api/cron/compute-index-intelligence`: one line per run, `[IndexIntelligence] QW6 HISTORY_STORE | etDate=… | expectedNewest=… | served=… | fetched=… | stored=…`.
  - The 10:30Z run shows `fetched=256 stored=255`.
  - 11:30Z, 14:00Z and similar runs show `served=255 fetched=1` (TNX).
- `/api/cron/mandate-evaluate`, if there are no books: `[MandateEvaluate] QW7 NO_BOOKS | <date>_<slot> — zero active books and zero open batches; snapshot build skipped (no EODHD call)`.

**Step 4: day-over-day EODHD dashboard comparison.**
- Compare the first full trading day after the flip with the same weekday one week earlier.
- Normalise for game count: subtract each day's poller units from `intradayBudget/{etDate}.unitsRequested` (the poller is untouched).
- **Expected drop at today's load: ≈ 8,500–12,700 calls**, more if the QW-1 mismatch rate is low. The 648 from QW-3 shows up from the build merge, every day including weekends.

**Rollback:** revert the flip commit (the flag goes back to `false`).
- Every flagged change returns to the pre-build path at once.
- Open tabs on the flag-on bundle fall back to the old popular-list path by themselves, because the route answers 404 (review E2-2).
- QW-3 is unflagged: revert its two files (`.github/workflows/main.yml`, `api/health.js`) only if needed.

---

## 8. Decisions for the founder (from the review)

1. **E2-5.** With the flag on, the "never write the per-tab cache" ruling moves classic-battle join baselines: fresher normally, the configured fallback constant in a vendor outage. Options:
   - (a) accept;
   - (b) seed the per-tab cache from the shared list with a TTL shortened by the list's age;
   - (c) separately, make baseline captures reject `isFallback` records (this also changes flag-off behaviour).
2. **E3-3.** With the flag on, a first mandate book created between two fires of a slot evaluates against that slot's later snapshot. Remedy: create the first book outside any slot or close window, or accept.
3. **The QW-1 residual.** Accept (bounded by the 4 h TTL; measurable through `prev_close_mismatch`), or shorten the served age.
4. **The QW-6 residual.** Accept (bounded by 4 h), or exclude symbols with a corporate action dated today.

---

## 9. Verification record

- **Suite of record:** Linux via WSL, CI-shaped (`npx vitest run --maxWorkers=2`, `TZ=UTC`, `CI=true`). Exit code asserted.
  - Build head `8aa973ff`: `EXIT=0`, ` Test Files  875 passed | 6 skipped (881)`, `      Tests  18110 passed | 87 skipped (18197)`.
  - Code head `a53c0cdf`: `EXIT=0`, ` Test Files  875 passed | 6 skipped (881)`, `      Tests  18113 passed | 87 skipped (18200)`.
  - **Code-final head `70c5b7f8`** (the last code or test change; every commit after it is docs-only): `EXIT=0`, ` Test Files  875 passed | 6 skipped (881)`, `      Tests  18114 passed | 87 skipped (18201)`.
- **First run** on the first build commit `8c5f56b8`: 2 failed. These were the repo guards `indexIntelligenceHygiene` A-0 and `compositionProtectedStores` DENY-BY-DEFAULT, fixed in `cfe281cc`.
- **Flag-on preview** (whole suite with the flag `true`): only the three flip-map rows fail (`eodhdQuickWinsFlags` pin, `flagPinGuard` live-value, `flagPinGuard` DARK_BY_DESIGN integrity).
- **Flip branch suite:** `flip/eodhd-quick-wins` = `e7e25e45`, one commit on top of the build at `38c1b533`. Linux, CI-shaped: `EXIT=0`, ` Test Files  875 passed | 6 skipped (881)`, `      Tests  18114 passed | 87 skipped (18201)`. The flip commit reconciles the value pin, the registration row and the DARK_BY_DESIGN entry, so the three flip-map rows that failed in the flag-on preview pass.
- **`vite build`** on LF `git archive` trees: exit 0 for the build at `38c1b533` and for the flip head `e7e25e45`. Both bundles contain `/market/popular`. The build branch's final, docs-only commit, which records these results, was built again before the push; the result is in the handover.
- **CI lint gate** (`npm run lint:gate`): exit 0.
- **Review:** 5 lenses (E1–E5), 4 independent verifiers (EV1–EV4), 26 findings, 25 CONFIRMED and 1 REFUTED (E4-6; E2-5's premise was also refuted). Every finding a code change can close is fixed. 21 named mutants, all killed; the P2 red-then-green evidence is quoted in review record §6. See the review record.

*End of report. Pushed, not merged; no PR opened (as instructed).*
