# Discovery — EODHD call census and price-delivery map

**Type:** read-only discovery. One new file (this report). No code changed, no network, no production data.
**Requested by:** Flash (founder). **Prompt author:** Fable (design and adjudication lead), 2026-10-07.
**Executed by:** Claude Code (Opus 5.5), on Flash's instruction, from the prompt Fable wrote for Astra.
**Date:** 2026-10-07.

---

## Executive verdict

| Question | Answer |
|---|---|
| **Can 40 concurrent games (24 BaggerBomb, 16 League pods) stay under 100,000 EODHD calls per day on today's code?** | **No.** The modelled load at 40 games is **≈ 301,000 calls per trading day from the server alone** (3.0× the budget). It is **≈ 409,000–467,000 with battle screens open** (4.1–4.7×). Even if `agent-evaluate` could only reach the 10–14 battles per tick that a 20–30 s-per-battle budget allows, the server side is still **≈ 133,000**. |
| **What does today's load cost?** | **≈ 86,000 calls per trading day** at the scale the repo's own contract models: 7 concurrent BaggerBomb agent battles and about 7 screen-hours. That leaves about 14% headroom. With **zero battles**, the weekday floor is already **≈ 31,700**. |
| **Largest consumers at 40 games** | (1) `agent-evaluate`: ≈ 196,600. (2) The app-wide browser market-data poll: up to ≈ 91,900. (3) The intraday poller: ≈ 85,400. (4) League live-composites: ≈ 46,100. (5) The League arena price poll: ≈ 17,300. |
| **Biggest single waste** | `agent-evaluate` fetches every symbol of every battle twice on every 15-minute tick with the cache deliberately bypassed. That is one `/eod/` daily series plus one `/real-time/` quote. The daily series does not change during the day. Nothing is shared between battles, so SPY, QQQ and BTC are fetched once per battle per tick. |
| **Duplication** | At 40 games, about **206,000 symbol-fetches a day** repeat a fetch that another consumer, or another battle, made in the same minute. |
| **What already exists to share** | `intradaySnapshots/latest` is the poller's per-minute snapshot of every held and bench symbol plus a 255-name universe every 5 minutes. **Nothing reads it for prices today** (`INTRADAY_PRICE_SOURCE = 'legacy'`). An adapter to the legacy price shape is already written and tested but unused. |
| **August 2026 unified data delivery design** | **Not in the repo, and in no git ref, ever.** The only trace is a queue line naming a "unified price cache". |
| **WebSocket** | No browser or server socket ever opens: `/api/ws-config` returns `available:false`. There is no server-side bridge. The code calls the 50 a "concurrent connection limit", which contradicts the reading in the prompt (50 symbols per token). At 40 games the actionable tier is about 185 symbols, more than any 50-symbol allowance. |
| **Token in the browser?** | **No.** No code path ships the EODHD token to the client at this commit. One conditional build-environment risk is noted under Q-02. |
| **The weekend-vs-weekday dashboard comparison** | **It does not isolate game cost.** About 31,700 calls a weekday run with no battles and never run on weekends. Saturday (UTC) also carries Friday's settlement tails, and browser tabs poll 33 crypto symbols every 5 minutes, all week. See §9. |

---

## 1. SHA, branch, tree state

- `git fetch origin` was run first, at 2026-10-07 session open. After the fetch, `origin/main` = `8c9ea5ef254574152d7322b95d714d8fe1ba2d50`.
- **Commit pinned:** `8c9ea5ef254574152d7322b95d714d8fe1ba2d50`, "Merge pull request #934 from fashraf94/claude/phase0-pilot-records". **Every citation in this report is at this SHA.**
- **Branch:** `docs/eodhd-call-census`, cut from `origin/main` at that SHA. The work ran in a private git worktree.
  - The shared checkout at `C:/Users/fashr/portfolio-duel` was on `main` with three untracked files belonging to another session: `docs/audits/20260911_VOICE_GROUNDING_PAIRED_HARNESS.md`, `exit-dials-live-census-report.json` and `vwap-exit-dating-census-report.json`.
  - That tree was not clean, so the gate was satisfied on a fresh worktree instead, which was clean (`git status --short` empty). The three foreign files were not touched.
- **BUILD_RULES** were read (§1 fence list, §3 session documents).
  - The fenced files `api/_utils/agentBattleService.js`, `api/_utils/agentScoring.js`, `api/_utils/agentSwapExecution.js`, `api/agent/decide.js` and `api/_utils/tournamentUserScoring.js` were **read only**. No file was edited.
- **Method.** The lead read the largest consumers directly: the intraday poller, `agent-evaluate`, `voice-layer-cache`, the shared price helpers, the League price paths and the model inputs. Four read-only census agents swept the long tail in parallel:
  1. API routes and helpers.
  2. Browser timers and WebSocket.
  3. Cron cadence and gates.
  4. Firestore stores, docs and scripts.
  - Every citation below was read in this session, either by the lead or by a census agent.
  - Figures the model depends on were re-read by the lead: the `vercel.json` schedules, `compute-index-intelligence` gates and fetches, the keep-warm workflow, the `scan-movers` set, the app-wide market poll and its list sizes, and the `decide.js` deploy roster.
  - **VERIFIED** means read at this SHA in this session. **ASSUMED** marks every assumption, including the billing weights supplied in the prompt.
- **No network.** The billing weights are those supplied in the prompt.
  - Calendar-family endpoints (`/calendar/*`, `/economic-events`, `/splits`, `/div`, legacy `/api/earnings`) are not in that list. They are counted at **1 per request (ASSUMED)**.
  - Live v2 `/us-quote-delayed` is counted at **1 per ticker**. That is the repo's own contract (G1), cited at `api/_utils/intraday/intradayFetch.js:6-8` and `api/_utils/intradayConfig.js:24`.

---

## 2. Inventory

### Q-01. Every outbound contact with EODHD

**What was searched.** `api/`, `src/`, `scripts/`, `research/`, `discovery/`, `tracer/`, `tester/`, `test/`, `dkb/`, `fixtures/` and `.github/` were searched for:
- `eodhd`, `eodhistoricaldata`, `EODHD_API_KEY`, `VITE_EODHD`, `api_token`, `ws.eodhistoricaldata`
- every endpoint path (`/real-time/`, `/eod/`, `/intraday/`, `/technical/`, `/fundamentals/`, `/bulk`, `eod-bulk-last-day`, `/news`, `/exchange-symbol-list`, `/calendar/`, `/economic-events`, `/options/`, `/splits/`, `/div/`, `us-quote-delayed`)
- every caller of the shared helpers that wrap them.

`/exchange-symbol-list`, `/technical/` outside `api/stocks/prices.js`, and `/bulk` outside `compute-rankings` returned no call sites. Test files, `__tests__/` and `__fixtures__/` were excluded.

#### 2.1 Shared helpers (most consumers reach EODHD through one of these)

| file:line | Endpoint family | Billing weight | Trigger | Symbol-set shape | Symbols per invocation | Cache in front | Consumer(s) |
|---|---|---|---|---|---|---|---|
| `api/_utils/marketDataCache.js:354-357` (`fetchDailyOHLCV`) | `/eod/`, 90 calendar days, one symbol | 1 | `getStockAnalysisData` field `daily` (`:638-639`) | caller's | 1 | L2 Firestore `marketDataCache/{SYM}_daily`, 4 h (`:30-31`), market-aware (`:131-132`); L1 5 min (`:40-41`). **`forceRefresh` skips the read** (`:622`) | agent-evaluate, agent-daily-scores, decide, agentSwapExecution, debate, seasonEvalContext |
| `api/_utils/marketDataCache.js:744-745` (`fetchRealTimePrice`) | `/real-time/`, one symbol per request | 1 | `getStockAnalysisData` whenever `fields` includes `price` or is null (`:684-686`) | caller's | 1 | **Never cached** (`:742`) | the same callers |
| `api/_utils/marketDataCache.js:381-384` (`fetchFundamentals`, filtered) | `/fundamentals/` | 10 | field `fundamentals` | caller's | 1 | L2 24 h (`:32`); L1 30 min (`:42`) | mandate slow layer, seasonEvalContext |
| `api/_utils/marketDataCache.js:451-454` (holders) | `/fundamentals/?filter=Holders` | 10 | `getCachedHolders` (`:1166-1194`) | fixed | 1 | L2 7 d (`:36`) | compute-institutional-intelligence |
| `api/_utils/marketDataCache.js:474` (news) | `/news` | 5 | field `news` | — | 1 | L2 30 min | **No caller at HEAD requests `news`** (every `getStockAnalysisData` caller names its fields; none names `news`) |
| `api/_utils/marketDataCache.js:502-505` (earnings) | `/fundamentals/?filter=General,Earnings` | 10 | field `earnings` | caller's | 1 | L2 24 h | seasonEvalContext |
| `api/_utils/marketDataCache.js:799-807` (`fetchIntradayCandles`) | `/intraday/` (5m default; 1m for film tape) | 5 per request | direct; `fetchIntradayBatch` loops one request per symbol, 5 concurrent (`:883-913`) | caller's | 1 | **none**, and no timeout (`:807`) | agent-evaluate (`:760`, `:1319`), film-tape-candles |
| `api/_utils/tournamentPrices.js:64-65` (`fetchBatchQuotes`) | `/real-time/`, comma-joined list, **unchunked** | 1 per symbol | callers below | caller's | N | **none**; returns `{}` on failure (`:85-88`) | tournament banking (`tournamentBanking.js:494`), manual banking (`api/tournament/bank-daily-scores.js:83`), canonical opens (`canonicalOpen.js:68`), mandate snapshots (`mandateUniverseSnapshot.js:505`), flips (`:93-96`), `getCachedBatchQuotes` |
| `api/_utils/marketDataCache.js:938-956` (`getCachedBatchQuotes`) | → `fetchBatchQuotes` | 1 per symbol per miss | `api/tournament/live-composites.js:70` | per pod | ≤ pod user symbols | **L1 only** (per Vercel instance), key `arenaQuotes_<sorted set>`, 45 s | League arena rival orbs |
| `api/_utils/intraday/intradayFetch.js:49`, `:73-82` (`fetchQuotes`, Live v2) | `/us-quote-delayed?s=` ≤ 20 per request (`intradayConfig.js:24-25`) | 1 per ticker (repo G1) | `pollRunner.js:219` | union across battles + fixed universe | see Q-05 | none | intraday poller |
| `api/_utils/intraday/intradayFetch.js:50-53` | `/real-time/` crypto | 1 per symbol | `pollRunner.js:219` | union across battles | A_c | none | intraday poller |
| `api/_utils/intraday/intradayFetch.js:54-55`, `:107-112` | `/intraday/` 1m, one symbol | 5 | seeds (`pollRunner.js:98`); validator (`validationRunner.js:124`) | union across battles | 1 | none | intraday poller and validator |

#### 2.2 Scheduled (cron) call sites

Schedules are from `vercel.json` (the schedule line is the line after each path, `:45-214`). Wakes are counted per UTC day.

| file:line | Endpoint family | Billing weight | Trigger (cron · schedule) | Symbol-set shape | Symbols per invocation (formula) | Cache in front | Consumer(s) |
|---|---|---|---|---|---|---|---|
| `api/cron/intraday-poll.js:39-48` → `pollRunner.js:219` (quotes), `:98` (seeds) | Live v2 quotes; `/real-time/` crypto; `/intraday/` 1m seeds | 1 per ticker; 5 per seed request | `* 13-21 * * 1-5` (`vercel.json:161-162`) | **union** (held ∪ bench across active `agentBattles`) + **fixed universe** of 255 every 5th ET minute | `A_s + A_c` per minute; `+ (255 − \|A_s ∩ U255\|)` on minutes ≡ 0 mod 5; seeds 5 × (1–2) per new actionable stock | none | `intradaySnapshots/latest` (no price reader today; §5) |
| `api/cron/intraday-validate.js` → `validationRunner.js:124` | `/intraday/` 1m | 5 | `*/30 10-16 * * 2-6` (`vercel.json:165-166`) | union (yesterday's actionable stocks) | ≤ 20 per wake (`intradayConfig.js:170`) | state doc only | validator |
| `api/cron/agent-evaluate.js:1042` | `/eod/` + `/real-time/` per symbol (`forceRefresh`, fields `daily`,`price`) | 2 per symbol | `*/15 13-21 * * 1-5` (`vercel.json:157-158`); evaluates only while `isMarketOpen()` (`:366`) → **26 ticks** | **per battle**, no cross-battle sharing | \|held ∪ bench ∪ hotBench ∪ CPU-opponent held ∪ {SPY, QQQ, BTC-USD.CC}\| (`:1019-1031`) | **bypassed** (`forceRefresh`) | scoring, guards, prompt |
| `api/cron/agent-evaluate.js:1319` | `/intraday/` 5m via `fetchIntradayBatch` | 5 per symbol | same tick; skipped for CPU-passive tournament seats (`:1279-1306`) | per battle | \|held\| (incl. crypto) | none | VWAP floor, 5m SMA20 |
| `api/cron/agent-evaluate.js:1452` | `/eod/` + `/real-time/` | 2 per symbol | hotBench rebuild (`:1392`), new tickers only | per battle | ≤ 15 (cap 20) | bypassed | hotBench |
| `api/cron/agent-evaluate.js:2486` | `/eod/` + `/real-time/` | 2 per symbol | catalyst additions (`:2467`) | per battle | ≤ 5 | bypassed | bench |
| `api/cron/agent-evaluate.js:4733` | `/eod/` + `/real-time/` | 2 per symbol | pending proposal (`fetchPricesForProposal`) | per battle | 2 | bypassed | proposal execution |
| `api/cron/agent-evaluate.js:760` | `/intraday/` 5m | 5 | VWAP cascade qualification (`:1918`), memoized per tick | per battle | 1 per replacement | per-tick memo | VWAP floor |
| `api/_utils/agentSwapExecution.js:144` (fenced; read only) | `/eod/` + `/real-time/` (`forceRefresh`) | 2 | `executeSwapServer`, Guard 3 reference only (`:136-142`) | per swap | 1 | bypassed | swap guard (the price is discarded, `:145`) |
| `api/_utils/canonicalOpenSweep.js:171` → `canonicalOpen.js:68` → `tournamentPrices.js:64` | `/real-time/` `.open` | 1 per symbol | inside agent-evaluate on every open tick (`agent-evaluate.js:382`) | **per group** (not a union) | uncaptured null-baseline symbols (`canonicalOpenSweep.js:154-167`) | captured opens are frozen in the group doc | League canonical opens |
| `api/cron/voice-layer-cache.js:58-59` | `/real-time/`, batches of 20 (`:33`, `:53-92`) | 1 per symbol | `*/15 13-20 * * 1-5` (`vercel.json:169-170`); only OPEN or PRE_MARKET (`:818-820`) → 26 wakes | **union across battles** (`:834-867`) | \|held ∪ watchlist.active ∪ bench stocks\| | none | `voiceLayerCache/{battleId}` |
| `api/cron/compute-index-intelligence.js:147-149` | `/eod/` | 1 per symbol | `30 10,11 * * 1-5` and hourly `0 14-20 * * 1-5` (`vercel.json:149-154`); **no trading-day, holiday or DST gate** | fixed | 256 per run (17 index, ETF and TNX + 239 stocks; `:80-90`, `:758-766`, `:891`) | none | `indexIntelligence/*`, `stockTechnicalScores/*` |
| `api/cron/compute-index-intelligence.js:305-308` | `/real-time/`, 13 requests of ≤ 20 | 1 per symbol | intraday mode only (`:709`, `:733-745`) | fixed | 255 (`:738-742`) | none | same |
| `api/cron/compute-rankings.js:118-120` | `/fundamentals/` | 10 | `0 11 * * 1-5` (`vercel.json:69-70`); **no trading-day or flag gate** | fixed | 239 | none | `indexIntelligence/stockRankings` |
| `api/cron/compute-rankings.js:180-182` | `/eod/` | 1 | same | fixed | 12 (SPY + 11 sector ETFs) | none | same |
| `api/cron/compute-rankings.js:1489-1491` | `/eod-bulk-last-day/US` | 100 | same | whole exchange | — | none | `priceHistory/*` |
| `api/cron/compute-rankings.js:247-248` | `/eod/` backfill | 1 | same, only when history < 130 days (`:230-262`) | fixed | 239 | none | `priceHistory/*` |
| `api/cron/compute-institutional-intelligence.js:92` | holders `/fundamentals/` | 10 | `0 1,2 * * 1` (`vercel.json:173-174`) | fixed | 239 (≈ one miss per symbol per week) | L2 7 d | `institutionalAggregates/latest` |
| `api/cron/compute-estimates.js:138`, `:176` | `/calendar/trends`, `/calendar/earnings` | 1 per request (ASSUMED) | `0 10 * * 6` | fixed | 8 chunks of 30, each | none | estimates |
| `api/cron/agent-daily-scores.js:257-260` | `/eod/` + `/real-time/` (`forceRefresh`) | 2 per symbol | `45 1 * * 2-6` | union across battles | S_A (star/core/support across active agentBattles) | bypassed | daily score banking |
| `api/cron/agent-batch-review.js:213` | `/real-time/` (fields `price`) | 1 | `25 20,21 * * 1-5` | per vetoed proposal | V_veto | none | batch review |
| `api/cron/snake-draft-daily-scores.js:186-188` | `/real-time/`, **unchunked** | 1 per symbol | `15 21 * * 1-5` (`vercel.json:49-50`) | union across 4-player drafts | S_snake | none | snake draft banking |
| `api/_utils/tournamentBanking.js:494` (same cron) | `/real-time/` via `fetchBatchQuotes` | 1 per symbol | same | **union across BATTLE groups** (`:484-491`) | S_TU (≤ 12 per pod) | none | League nightly banking |
| `api/cron/baggerbomb-v4-daily-scores.js:106-107` | `/real-time/`, unchunked | 1 per symbol | `15 1 * * 2-6` | union across V4 battles | S_v4 | none | V4 PvP banking |
| `api/cron/compute-daily-baggerbomb-levels.js:138-139` | `/real-time/`, chunks of 20 | 1 per symbol | `30 1 * * 2-6` | union across V4 battles | S_v4 | none | V4 levels |
| `api/cron/mandate-evaluate.js` → `mandateUniverseSnapshot.js:505` | `/real-time/` chunks of 100 | 1 per symbol | `*/15 14-22 * * 1-5`; builds only at 4 slot keys a day (`mandate-evaluate.js:284-286`, `:661-675`) | union: held ∪ 136 candidates (`mandateCandidateUniverse.js:33-87`) | M = 136 + H_c per build | snapshot doc per tickKey | mandate marks |
| `mandateUniverseSnapshot.js:318-319` | `/splits/`, `/div/` | 1 + 1 per symbol (ASSUMED) | daily layer, once per date (`:367-374`) | same | M | `mandateUniverseDaily/{date}` | corporate actions |
| `mandateUniverseSnapshot.js:358` | `/fundamentals/` | 10 per miss | daily layer | same | ≤ M | marketDataCache L2 24 h | mandate sector map |
| `api/cron/tournament-orchestrator.js` → HTTP `/api/agent/decide` (`tournamentOrchestrator.js:312-331`) → `decide.js:1044` | `/eod/` + `/real-time/` (`forceRefresh`) | 2 per symbol | `*/10 11-14,21-23 * * 1-5`; deploys only on morning duty ticks (`:134`, `:163-171`) | per deploy | 6 | bypassed | League agent deploys (4 per pod per day) |
| `api/cron/film-tape-candles.js:48` → `candlePass.js:162` → `fetchIntradayCandles` 1m | `/intraday/` 1m | 5 | `0 11 * * 2-6`; `FILM_TAPE_WRITE_ENABLED = true` (`featureFlags.js:2951`) | union over tapes, memo `symbol\|etDate` (`candlePass.js:155-157`) | R | in-run memo | `agentBattles/{id}/tape/*` |
| `api/cron/compute-daily-regime-brief.js:115` → `fetchEarningsCalendarEODHD.js:202-204` | `/calendar/earnings` | 1 (ASSUMED) | `30 12 * * 1-5` | fixed | — | doc guard | regime brief |
| `api/cron/process-draft-claims.js:553` → `fantasyTimesConsensus.js:35`, `:50`, `:71` | `/calendar/earnings` × 3 | 1 each (ASSUMED) | `25 13,14 * * 1-5`; only in the 09:20–09:30 ET window | fixed | — | stored in `fantasyTimesConsensus/{date}` | newsroom consensus |
| `api/fantasytimes/scan-movers.js:42` | `/real-time/`, **one request per symbol** | 1 | `*/15 13-20 * * 1-5` (`vercel.json:129-130`); holiday gate only (`:291`) | fixed | 54 (`fantasyTimesTickers.js:7-28`) | none | `moverCandidates/*` |
| `api/fantasytimes/generate-mover.js` → `validatedCatalystCache.js:88` | `/news?s=` | 5 | each confirmed mover from scan-movers | per mover | 1 | `validatedCatalysts/{UTC date}` | Alex stories |
| `api/_utils/sonarCatalystFetch.js:123`, `:148` | `/news` | 5 | only on a Sonar failure | per mover / fixed | 1 | none | catalyst fallback |
| `api/fantasytimes/generate-pulse.js:61` | `/real-time/`, per symbol in chunks of 8 | 1 | 6 cron entries (`vercel.json:85-95`); Firestore dedup first (`:137-160`) → ≈ 3 full runs | fixed | 58 (4 index ETFs + 54) | none | Kai pulse |
| `api/fantasytimes/generate-pulse.js:199` | `/news` | 5 | same | fixed | — | none | Kai pulse |
| `api/fantasytimes/generate-econ.js:77` | `/real-time/` | 1 | recap mode `0,30 13-21 * * 1-5` (18 per day), only when an event is chosen (`:333-337`) | fixed | 2 (SPY, QQQ) | none | Neta recap |
| `api/_utils/fetchEconomicEventsEODHD.js:217` | `/economic-events` | 1 (ASSUMED) | every recap firing (`generate-econ.js:226`) | fixed | — | none | Neta recap |
| `api/fantasytimes/generate-recap.js:147` / `:127` / `:339` → `getEarningsResult.js:190`, `:73` | `/calendar/earnings`; `/real-time/` ≤ 4; `/fundamentals/` + `/eod/` per uncovered candidate | 1 / 1 / 10 + 1 | `0 13,20,21,22,23 * * 1-5`. The candidate loop runs **before** the daily-ceiling check (`:329-343` vs `:393-399`) | calendar ∩ tracked | U_rc | none | Doug recap |
| `api/fantasytimes/generate-column.js:53` | `/real-time/` | 1 | Mon `0 10,11`, Fri `0 21,22` | fixed | 5 | dedup doc | Kim column |
| `api/fantasytimes/submit-earnings-batch.js:53`, `:65` | `/calendar/earnings`; `/fundamentals/` | 1 (ASSUMED); 10 | `0 5 * * 1-5` | calendar ∩ tracked | ≤ 18 (`:35`) | dedup doc | Doug previews |
| `api/fantasytimes/ingest-earnings.js:31` | `/calendar/earnings` × 2 | 1 (ASSUMED) | `30 23 * * 1-5` and `30 3 * * 2-6` | fixed | — | none | claims ingestion |

These crons make **no** EODHD contact; each closure was checked by import scan and an `eodhd.com` / `fetch(` scan:
- `lobbies/cleanup-expired`, `snake-draft-autopick`, `compute-briefs` (Sonar), `promote-discover-themes`
- `live-draft-fire`, `mandate-rollover` (`MANDATE_ROLLOVER_ENABLED = false`, `featureFlags.js:1938`), `process-pending-reflections`, `film-tape-close`
- `fantasytimes/{poll-batch, cleanup, ingest-econ, ingest-cleanup}`, `generate-econ?mode=preview` (Sonar).

#### 2.3 API routes reached from the browser

The server caches named here are defined in `api/_utils/serverCache.js`:
- **L1** is a per-instance `Map` (`:15`). It is not shared between Vercel instances.
- The **CDN** header is set by `setCacheHeaders` (`:100-109`).
- Every route behind `applySecurityMiddleware` defaults to `no-store` (`api/_utils/security.js:154-157`).

| file:line | Endpoint family | Billing weight | Trigger (route ← browser caller) | Symbol-set shape | Symbols per invocation | Cache in front | Consumer(s) |
|---|---|---|---|---|---|---|---|
| `api/stocks/prices.js:94` | `/real-time/`, comma list; duplicates not removed (`:93`); no cap | 1 per symbol | `GET /api/stocks/prices` ← `getMultipleStockPrices` (`src/services/eodhdAPI.js:161-163`) and its wrappers. Mounted timers A–U (Q-07). `fetchFreshPrices` on activation (`eodhdAPI.js:993`). Keep-warm workflow (`.github/workflows/main.yml:36`). | per viewer / per battle | the caller's uncached symbols | L1 `stock_prices_<sorted>` 60 s (`:81-82`, `:156`); CDN `s-maxage=60, swr=30` (`:87`, `:157`); `nocache=1` skips both (`:48`, `:155-158`) | every battle and draft screen, dashboards |
| `api/crypto/prices.js:56` | `/real-time/` `-USD.CC` list | 1 per symbol | `getMultipleCryptoPrices` (`eodhdAPI.js:321`); `fetchFreshPrices` (`:1014`); keep-warm (`main.yml:45`) | per viewer / per battle | uncached symbols | L1 `crypto_prices_<sorted>` 60 s; CDN 60/30; `nocache=1` | crypto pricing |
| `api/stocks/prices.js:193` | `/eod/` | 1 | `?type=historical` ← `sectorDataService.js:32`, `SectorPerformanceTable.jsx:169` | fixed | 1 | L1 1 h; CDN 3600/600 | sector views |
| `api/stocks/prices.js:276-288` | `/technical/` (rsi, macd, sma, ema, atr) | 5 | `?type=technical\|sma` ← `technicalIndicatorService.js:50`, `sectorDataService.js:84` | per viewer | 1 | L1 1 h; CDN 3600/600 | research |
| `api/stocks/eod-close.js:26` | `/eod/` limit 1 | 1 | `fetchEODClosePrices`, **one request per symbol** (`eodhdAPI.js:1045-1049`), on activation while the market is closed (`priceCapture.js:31-36`) | per battle | 1 | CDN 3600/600 on success (`:41`); no L1 | activation baselines |
| `api/stocks/historical.js:210`, `:246`, `:333` | `/intraday/` (1m / 30m / 1h; 5m fallback) | 5 | `fetchHistoricalOHLCV` (`eodhdAPI.js:820`) ← `useResearchData.js:267`, `:344`, `:396` (15 s spectate poll), `ScoreBreakdownPopover.jsx:58` | per viewer | 1 | L1 `historical_<SYM>_<tf>_<days>` 1 h (`:172`; **the key ignores from/to**); CDN 3600/600 | research charts |
| `api/stocks/historical.js:230`, `:284`, `:352`, `:365` | `/eod/` (fallback; 1d/1w) | 1 | same | per viewer | 1 | same | same |
| `api/stocks/fundamentals.js:46`, `:47` | `/fundamentals/` + `/eod/` 365 d | 11 per miss | `fundamentalsService.js:20` ← `HoldingsTab.jsx:35`, `AssetResearchModal.jsx:313`; `historicalData.js:54` | per viewer | 1 | L1 1 h; CDN 3600/600 | research |
| `api/stocks/earnings.js:46` | `/fundamentals/` | 10 per miss | `fetchLatestEarnings` (`eodhdAPI.js:755`) ← `LatestEarningsReport.jsx:44` | per viewer | 1 | L1 1 h; CDN | research |
| `api/stocks/earnings-history.js:52`, `:153` | `/fundamentals/` + `/eod/` | 11 per miss | `stockEarningsHistoryService.js:61`, `:185`; HTTP from `api/earnings/verify-stock.js:73`, `verify-batch.js:122` | per viewer | 1 | L1 1 h; CDN | earnings game |
| `api/stocks/earnings-calendar.js:49` | `/calendar/earnings` | 1 (ASSUMED) | `earningsCalendarService.js:153` ← `EarningsGameScreen.jsx:148`; HTTP from `sync-queue.js:119-121` | fixed window | — | L1 1 h; CDN | earnings game |
| `api/earnings/odds.js:105`, `:107`, `:109` | `/fundamentals/` + `/eod/` + `/options/` | 21 per miss | `getBatchOdds`, one request per symbol, ≤ 20 (`oddsService.js:143`) ← `EarningsGameScreen.jsx:148` | fixed-ish | 1 per request | L1 `earnings_odds_<SYM>_<sector>` 1 h; CDN | earnings game |
| `api/earnings/_helpers/getEarningsResult.js:190`, `:73` | `/fundamentals/` + `/eod/` | 10–11 | `GET /api/earnings/results` (`results.js:51`) ← `tournamentResolutionService.js:59` | per viewer | 1 | L1 + CDN 1 h (`results.js:41-62`) | earnings tournament |
| `api/news/market.js:37` | `/news` | 5 | `getMarketNews` (`eodhdAPI.js:503`) ← `MarketBriefing.jsx:40` (**unmounted**: no importer) | fixed | — | L1 30 min; CDN | none mounted |
| `api/news/stock.js:46` | `/news?s=` | 5 per request | `getStockNews` (`eodhdAPI.js:552`) ← `FundamentalNews.jsx:139`; `getMultipleStockNews`, one request per symbol (`:586-601`) | per viewer | 1 per request | L1 30 min; CDN | research news |
| `api/volatility/thresholds.js:218`, `:221` | `/eod/` 45 d | 1 per symbol | `volatilityService.fetchBatch` in chunks of 20 ← `firebaseService.js:844`, `sessionScoringService.js:715`, `draftService.js:558`, `DraftBattleScreenV2.jsx:391`, BaggerBomb hooks | per battle / per viewer | ≤ 20 (`:346-352`) | L1 key **not sorted** (`:354-355`) 1 h; CDN; browser localStorage 7 d | breakout thresholds |
| `api/research/fetchDriverSeries.js:55` | `/eod/` | 1 per symbol | POST `/api/research/correlation`, `/correlation-scan`, `/driver-audit` ← `CorrelationLab.jsx:1774`, `:1821`, `:1629` | user-chosen | ≤ 12 / ≈ 28–41 / ≤ 10 | L1 + Firestore `correlationIntelligence` until next close + 30 min; `forceRefresh` from the Refresh button | Correlation Lab |
| `api/tournament/live-composites.js:70` | `/real-time/` via `getCachedBatchQuotes` | 1 per symbol per miss | `useLiveComposites.js:43` every 60 s (`:24`); `LEAGUE_LIVE_ORB_ENABLED = true` (`featureFlags.js:282`) | per pod (users' held ∪ dropped) | ≤ 12 + dropped | L1 45 s per instance; **no CDN header** | arena rival orbs |
| `api/tournament/flip.js:108` | `/real-time/` via `fetchQuoteForSymbol` | 1 | user flip, market open only (`:106`) | user-chosen | 1 | none | flip execution price |
| `api/agent/decide.js:1044` | `/eod/` + `/real-time/` (`forceRefresh`) | 2 per symbol | user deploy (`:820`); internal tournament deploy (`:1410`) | per battle | BaggerBomb: agent 11 + CPU 11 = 22 (`:776-801`); League: 6 | bypassed | starting prices (Guard 1) |
| `api/agent/debate.js:235` | `/eod/` (on miss) + `/real-time/` | ≤ 2 | DebateModal | user-chosen | 1 | L1/L2 `_daily` | debate |
| `api/agent/research.js:171` | `/eod/` | ≤ 1 | **0 at HEAD**: returns 404 because `SHOW_IT_ENABLED = false` (`featureFlags.js:2420`) | — | — | — | — |
| `api/_utils/seasonEvalContext.js:41`, `:50` | daily, technicals, fundamentals, earnings, holders | up to 31 per ticker on a full miss | `POST /api/season/generate-debrief` ← `PitStopScreen.jsx:614`; unscheduled `season-daily-evaluate` | fixed (season universe, size UNKNOWN) | universe | L1/L2 | season debrief |
| `api/week-ahead-earnings.js:82` | legacy `/api/earnings` | 1 (ASSUMED) | `App.jsx:2901` | fixed window | — | L1 2 h; CDN | Week Ahead |

**Routes with no in-repo caller.** Searched `src/` for each route string:
- `api/stocks/analysis.js:160` (fundamentals 10)
- `api/stocks/options-iv.js:60-61` (options 10 + real-time 1)
- `api/crypto/metrics.js:48-51` (eod × 3)
- `api/stocks/earnings-historical-range.js:122` (fundamentals × 50 = **500 per miss**; public GET with caller-chosen dates)

#### 2.4 Admin, manual, external and out-of-`api/` call sites

| file:line | Endpoint family | Billing weight | Trigger | Shape | Symbols per invocation | Cache | Consumer |
|---|---|---|---|---|---|---|---|
| `api/health.js:25` | `/real-time/` AAPL | 1 | **GitHub Actions keep-warm, every 5 min 06:00–23:55 UTC, 7 days** (`.github/workflows/main.yml:21`, `:54`) | fixed | 1 | CDN `s-maxage=30` (`:126`), shorter than the 5-min gap | monitoring |
| `.github/workflows/main.yml:36`, `:45` | → `/api/stocks/prices?symbols=AAPL`, `/api/crypto/prices?symbols=BTC-USD` | 1 + 1 | same cron. `warmup=true` is read by neither handler (grep finds no `warmup`) | fixed | 1 + 1 | 60 s caches, shorter than the gap | **≈ 648 calls/day, every day** |
| `api/earnings/resolve-tournament.js:72`; `manual-resolve.js:247` | → `getEarningsResult` (10–11 each) | 10–11 | admin / `testMode=true` (`:179-190`); header claims a cron, but there is no `vercel.json` entry | union of pending pairs | unbounded | none | earnings tournament |
| `api/earnings/sync-queue.js:38` | `/options/` | 10 per new symbol | admin / `testMode=true` (`:101-111`) | union | unbounded | per-instance 24 h Map | verification queue |
| `api/earnings/migrate-dates.js:59` | `/calendar/earnings` | 1 (ASSUMED) per tournament | admin | union | — | none | data repair |
| `api/options/resolve-tournament.js:53` | `/real-time/`, sequential loop | 1 per symbol | CRON_SECRET or **POST with no auth** (`:203-215`); no cron entry | union | unbounded | none | options settlement |
| `api/tournament/bank-daily-scores.js:83` | `/real-time/` via `fetchBatchQuotes` | 1 per symbol | admin POST ← `TournamentDevScreen.jsx:385` | per group | ≤ 12 | none | manual banking |
| `api/academy/pull-chart-data.js:85` | `/eod/` | 1 per item | admin POST (`:136-149`); also `scripts/verify-kb-entries.js:151-163` | user-chosen | unbounded | none | academy |
| `api/admin/backfill-snake-draft-day.js:53` | `/eod/` single day | 1 per symbol | admin POST | per draft | draft size | none | backfill |
| `api/fantasytimes/test-ingestion.js:27`; `api/scripts/capture-earnings-calendar-eodhd.js:81-86`; `api/scripts/capture-econ-events-eodhd.js:73-78` | calendar / economic-events | 1 (ASSUMED) | admin / manual | — | 1 | none | debug, fixtures |
| `scripts/fetch-ticker-industries.js:165-167` | `/fundamentals/` | 10 | manual | fixed | 239 (≈ 2,390 calls; its comment says "~239 EODHD credits", `:40`) | none | industry map |
| `scripts/refresh-stock.js:218-219` | `/fundamentals/` | 10 | manual | 1 | 1 | none | — |
| `discovery/capture.mjs:30-58`; `discovery/earnings-future.mjs:5`; `discovery/recon.mjs:52-63` | `/intraday/` 5m, `/eod/`, `/calendar/earnings` | 5 / 1 / 1 | manual one-shot | fixed | 17 / 3 / 3 | none | discovery |
| `research/level-study/lib/eodhd-client.js:128-130`, `:143-150`, `:203-211`, `:223-225` | `/eod/`, `/intraday/` 5m, `/calendar/earnings`, `/fundamentals/` | 1 / 5 / 1 / 10 | manual, `npm run fetch` in `research/level-study/` | fixed (232–237) | on-disk cache, never refetched | disk | level study |

**Not callers.** `tracer/`, `tester/`, `test/`, `dkb/` and `fixtures/` contain no EODHD call.
- `tester/Dockerfile` runs offline tests.
- No daemon, pm2, systemd or worker code exists in the repo.

### Q-02. Does the browser ever hold the EODHD token?

**No. At this SHA no client bundle contains the token through any code path or runtime response.**

- **Searches.** `src/`, `index.html`, `public/`, `vite.config.js` and `.env.example` were searched for `EODHD|eodhd|api_token|eodhistoricaldata|wss://|ws://|VITE_EODHD`.
  - `api_token`, `eodhistoricaldata` and `ws(s)://` appear **only in test files that assert their absence**: `src/services/websocketService.test.js:63`, `:93-99`, `:119-124`; `src/hooks/useWebSocketPrices.disabledTransport.test.jsx:172-174`.
- **Vite inlining.** `vite.config.js:6-19` has no `define` and no `envPrefix`, so only `VITE_*` variables can be inlined.
  - The only `VITE_*` names read are the Firebase set (`src/firebase/config.js:20-25`) and `VITE_VERCEL_ENV` (`src/main.jsx:40`).
  - `.env.example:4-19` marks `EODHD_API_KEY` server-only and says not to add `VITE_` versions.
- **Every browser price request goes through same-origin `/api/*` routes** (§2.3).
  - The 20 `api/_utils` modules that `src/` imports carry no `process.env` key read that Vite would inline.
- **The former leak is closed.** `/api/ws-config` used to return a vendor socket URL with the key embedded (`KEYSTONE_PRELOCK_FINDINGS.md:110`, `:114-115`). It now reads no EODHD env var and returns `{ available: false, transport: 'rest' }` (`api/ws-config.js:4-16`, `:40`). **Whether that key was rotated afterwards is UNKNOWN.**
- **One conditional risk (ASSUMED from Vite's documented behaviour; a build would confirm it).** Bare `import.meta.env` references emit the whole client env object. Examples: `src/services/apiMonitor.js:23`, `:51`; `priceSnapshotService.js:19`; `volatilityService.js:7`; `src/utils/debug.js:45-46`; `leagueSignals.js:28`.
  - If anyone ever defined a `VITE_`-prefixed EODHD variable in Vercel, it would ship even though no code reads it.
  - Whether such a variable exists in Vercel is UNKNOWN from the repo.

### Q-03. Cache bypasses, forced refreshes and clears that precede a call

| Site | What it bypasses | Reason the code gives |
|---|---|---|
| `api/cron/agent-evaluate.js:1042`, `:1452`, `:2486`, `:4733` — `forceRefresh: true, fields: ['daily','price']` | L1 and L2 read of the daily series (`marketDataCache.js:622`). The real-time price is never cached anyway (`:742`). | **None in code.** It was introduced 2026-03-25 (`c315707d`) when `fields: ['daily']` was the only field. `price` was added 2026-03-30 (`12a71557`, "Strategy Feed 0.0 scores"). `forceRefresh` was never revisited, so the remaining effect is a fresh `/eod/` per symbol per battle per tick. The daily series is used as the Guard 2 reference (`:1035-1037`). |
| `api/cron/agent-daily-scores.js:257-260` | same | Guard 2 reference comment only (`:252-253`) |
| `api/agent/decide.js:1044` | same | "Fetch + Guard-1-validate activation prices" (`:1024`) |
| `api/_utils/agentSwapExecution.js:144` (fenced) | same; the price is discarded | "pre-fetch its daily series as the Guard 2 reference" (`:124`) |
| `src/services/eodhdAPI.js:993`, `:1014` — `fetchFreshPrices`, `nocache=1&_t=Date.now()` | server L1 and CDN (`api/stocks/prices.js:48`, `:155-158`; `api/crypto/prices.js:29`, `:98-101`) | "Used exclusively for battle activation where stale prices are unacceptable" (`eodhdAPI.js:975`). Called from `priceCapture.js:65`, `:79`, `:93` on every activation. Because the WebSocket is disabled, the "missing" set is every symbol (`websocketService.js:736-740`). |
| `src/components/draft/DraftBattleScreenV2.jsx:403-406` — `clearCache()` every 60 s | the tab's entire `prices` / `crypto` cache (`eodhdAPI.js:927-930`) | "Clear cache to ensure we get FRESH prices (not cached from when battle started)" |
| `CorrelationLab.jsx:1780`, `:1825` → `forceRefresh` in body | L1 and Firestore `correlationIntelligence` (`api/research/correlation.js:323`, `:343`; `correlation-scan.js:277`, `:320`) | user Refresh button |
| `api/earnings/resolve-tournament.js:206`, `:421` — `force=true` | re-resolves already-resolved predictions | "FORCE MODE - Re-resolving already resolved predictions" (`:212`) |
| `api/_utils/mandateUniverseSnapshot.js:356`, `:368`, `:475`, `:488` — `force` | snapshot idempotency | none |
| `api/earnings/verify-stock.js:36`, `:53` — `forceRefresh=true` | its own cache, then HTTP to `earnings-history` | none |
| Default `Cache-Control: no-store` (`api/_utils/security.js:154-157`) | every route that never calls `setCacheHeaders`: all fantasytimes, research, decide, debate | "API responses should not be cached by default" |

**Clears with no caller:** `getLivePrices` (`eodhdAPI.js:945-957`), `refreshThresholds` (`volatilityService.js:403-414`), `clearNewsCache`, `clearEarningsCache`, `clearAllCaches`, `clearHistoricalCache`, `clearTechnicalsCache`.

---

## 3. Cadence

### Q-04. Cron entries that reach a Q-01 call site

`vercel.json` has 43 cron entries (`:43-216`); **28 reach EODHD**. Crons run in UTC.
- A **trading day** below is a Mon–Fri UTC day. Entries on `2-6` land on the UTC day **after** the session they settle, Tue–Sat.
- **Weekend** means Sat and Sun UTC.
- "Flag + default" shows the checked-in value, which equals production only if this SHA is deployed.

| # | Path (`vercel.json` line) | Schedule | Wakes / trading day | Wakes / weekend day | Gates that stop the call (flag = default, file:line) | Calls per wake (formula) |
|---|---|---|---|---|---|---|
| 30 | `/api/cron/intraday-poll` (`:161`) | `* 13-21 * * 1-5` | 540 (≈ 420 collect) | 0 | `INTRADAY_COLLECT_ENABLED = true` (`src/config/featureFlags.js:2612`; `intraday-poll.js:34`); calendar trading day (`pollRunner.js:198`); window [open, close + 30 min) (`:199`; `intradayConfig.js:109`); lease (`:202-203`). **No gate on battles existing.** | Q-05 |
| 31 | `/api/cron/intraday-validate` (`:165`) | `*/30 10-16 * * 2-6` | 14 (Tue–Fri) | 14 Sat, 0 Sun | same flag (`intraday-validate.js:79`); ≤ 20 symbols, ≤ 60 s (`intradayConfig.js:170-171`) | 5 × validated (+ 5 per failed probe) |
| 29 | `/api/cron/agent-evaluate` (`:157`) | `*/15 13-21 * * 1-5` | 36 wakes, **26 evaluating** (`isMarketOpen`, `agent-evaluate.js:366`; `marketSchedule.js:129-148`) | 0 | lock per battle; 290 s budget (`:186`, `:425-438`) | Q-06 |
| 32 | `/api/cron/voice-layer-cache` (`:169`) | `*/15 13-20 * * 1-5` | 32 wakes, **26 fetching** (OPEN or PRE_MARKET, `voice-layer-cache.js:818-820`) | 0 | ≥ 1 active battle (`:828-830`) | \|union\| × 1 |
| 27 | `/api/cron/compute-index-intelligence` (`:149`) | `30 10,11 * * 1-5` | 2 (**both run fully**; no DST no-op, no holiday gate) | 0 | none | 256 × 1 |
| 28 | `…?mode=intraday` (`:153`) | `0 14-20 * * 1-5` | 7 | 0 | none | 255 + 256 = 511 |
| 7 | `/api/cron/compute-rankings` (`:69`) | `0 11 * * 1-5` | 1 (holidays too) | 0 | `EODHD_API_KEY` only (`compute-rankings.js:1453-1457`) | 239 × 10 + 100 + 12 = **2,502** (+ 239 backfill if history < 130 d) |
| 38 | `/api/cron/mandate-evaluate` (`:193`) | `*/15 14-22 * * 1-5` | 36 wakes; builds at 4 slot keys | 0 | `MANAGED_MANDATE_ENABLED = true` (`featureFlags.js:1914`), `MANDATE_EVAL_ENABLED = true` (`:1922`), `MANDATE_CLOSE_ENABLED = true` (`:1930`); slot windows (`mandateSessionSlots.js:41`, `:79-100`). **Not gated on any book existing.** | 4 × M + 2 × M (corporate actions) + 10 × fundamentals misses; M = 136 + H_c |
| 22 | `/api/fantasytimes/scan-movers` (`:129`) | `*/15 13-20 * * 1-5` | 32 (pre-open wakes included) | 0 | holiday only (`scan-movers.js:291`) | 54 |
| 11–13 | `generate-pulse` × 3 periods (`:85-95`) | dual-hour pairs | 6 wakes, ≈ 3 fetching (dedup) | 0 | Firestore dedup (`generate-pulse.js:137-160`) | 58 + 5 |
| 14 | `generate-econ?mode=recap` (`:97`) | `0,30 13-21 * * 1-5` | 18 | 0 | event chosen (`generate-econ.js:333-337`) | 1 (+ 2) |
| 17 | `generate-recap` (`:109`) | `0 13,20-23 * * 1-5` | 5 | 0 | — | 1 + ≤ 4 + 11 × U_rc |
| 16 | `submit-earnings-batch` (`:105`) | `0 5 * * 1-5` | 1 | 0 | dedup | ≤ 181 |
| 23–24 | `ingest-earnings` (`:133`, `:137`) | `30 23 * * 1-5`; `30 3 * * 2-6` | 2 | 1 Sat | — | 2 |
| 19–20 | `generate-column` (`:117`, `:121`) | Mon `0 10,11`; Fri `0 21,22` | Mon/Fri 2 (dedup → 1) | 0 | dedup | 5 |
| 8 | `/api/cron/process-draft-claims` (`:73`) | `25 13,14 * * 1-5` | 2 (one in window) | 0 | 09:20–09:30 ET pre-market window (`process-draft-claims.js:550`) | 3 |
| 34 | `/api/cron/compute-daily-regime-brief` (`:177`) | `30 12 * * 1-5` | 1 | 0 | per-day guard (`:81`, `:90-99`) | 1 |
| 36 | `/api/cron/tournament-orchestrator` (`:185`) | `*/10 11-14,21-23 * * 1-5` | 42 wakes, deploys on 24 morning duty ticks | 0 | `TOURNAMENT_DEPLOY_ENABLED = true` (`tournamentOrchestrator.js:120`); morning duties (`:134`, `:163-171`); ranked paths trading-day gated (`:626`, `:727-731`); **training path is not** (`:860-945`) | 12 per deploy (via decide) |
| 2 | `/api/cron/snake-draft-daily-scores` (`:49`) | `15 21 * * 1-5` | 1 | 0 | hard-coded **2026-only** holiday list (`snake-draft-daily-scores.js:69-73`); ≥ 1 battle draft / BATTLE group | S_snake + S_TU |
| 41 | `/api/cron/agent-batch-review` (`:205`) | `25 20,21 * * 1-5` | 2 | 0 | per-battle review idempotency (`agent-batch-review.js:176-185`) | V_veto |
| 6 | `/api/cron/agent-daily-scores` (`:65`) | `45 1 * * 2-6` | 1 (Tue–Fri) | 1 Sat | `isTradingDay` (`:219`); ≥ 1 active battle | 2 × S_A |
| 4 | `/api/cron/baggerbomb-v4-daily-scores` (`:57`) | `15 1 * * 2-6` | 1 | 1 Sat | ≥ 1 active V4 battle | S_v4 |
| 5 | `/api/cron/compute-daily-baggerbomb-levels` (`:61`) | `30 1 * * 2-6` | 1 | 1 Sat | 2026 holiday list missing 2026-06-19 (`:52-56`); no per-day idempotency | S_v4 |
| 43 | `/api/cron/film-tape-candles` (`:213`) | `0 11 * * 2-6` | 1 | 1 Sat | `FILM_TAPE_WRITE_ENABLED = true` (`featureFlags.js:2951`); ≤ 3 attempts (`filmTape.js:94`) | 5 × R |
| 33 | `/api/cron/compute-institutional-intelligence` (`:173`) | `0 1,2 * * 1` | 2 (Mon) | 0 | 7-day cache | ≈ 2,390 per week |
| 10 | `/api/cron/compute-estimates` (`:81`) | `0 10 * * 6` | 0 | 1 Sat | key only | 16 (≤ 48 with retries) |

**Fixed weekday spend with zero battles.** The poller's universe tier (21,420), compute-index-intelligence (4,089), compute-rankings (2,502), scan-movers (1,728), mandate-evaluate (816 + 0–1,360 fundamentals), the keep-warm workflow (648) and the rest of FantasyTimes (≈ 457) add up to **≈ 31,660 per trading day**.

**Weekend.** Sunday UTC ≈ 648 (keep-warm) plus browser tabs. Saturday UTC ≈ 648 + 18, plus Friday-session tails (agent-daily-scores, V4 scores and levels, the validator, film tape).

### Q-05. The intraday poller

**Cadence**
- The cron runs every minute 13:00–21:59 UTC on weekdays (`vercel.json:161-162`).
- It collects only while `now ∈ [session open, session close + 30 min)` per the calendar of record (`pollRunner.js:197-199`; `intradayConfig.js:109`).
- That is **W = 420 collecting minutes on a full day**: 09:30–16:29 ET, in both EDT and EST. It is 240 minutes on an early close.
- Deadline processing runs on every wake before the guard and makes no vendor call (`pollRunner.js:185-195`).

**Symbol sets**
- **Actionable tier, every collecting minute** (`HELD_TIER_ENABLED = true`, `intradayConfig.js:13`). This is held ∪ bench across **all** `agentBattles` with `status == 'active'`. That covers BaggerBomb agent battles and League flat6 battles alike (`agentBattleService.js:43-50`; `universe.js:34-48`).
  - Held is star + core + support. Bench is bench stocks + bench crypto.
  - It **does not** include hotBench, the embedded CPU opponent (`battle.opponent`), or League user-layer picks (those live in `tournamentGroups`).
- **Universe tier, on ET minutes ≡ 0 mod 5** (`UNIVERSE_CADENCE_MIN = 5`, `intradayConfig.js:11`; `pollRunner.js:210-212`). These are the 255 names: 5 index ETFs + 11 sector ETFs + 239 stocks (`universe.js:13-16`; counted by loading the module: `UNIVERSE_STOCKS.length = 255`).
  - **This tier runs whether or not any battle exists.**

**Dedupe across battles**
- Symbols are deduped by `Set` (`universe.js:35-48`; `pollRunner.js:211-216`): one symbol held by ten battles is one ticker.
- The universe tier and the actionable tier share one `Set`, so an actionable symbol in the universe is fetched once on universe minutes.

**Requests and units**
- Stocks are sent as Live v2 `/us-quote-delayed`, ≤ 20 per request (`intradayConfig.js:24-25`), 4 concurrent (`:161`), 10 s timeout (`:160`).
- Crypto is sent as `/real-time/` (`intradayFetch.js:72-75`).
- Units are counted **per ticker requested, whether or not it returned** (`intradayFetch.js:6-8`, `:76-77`), and written immediately to `intradayBudget/{etDate}` (`pollRunner.js:223-226`; `intradayStore.js:126-146`).
- **Seeding.** The first time an actionable stock appears in a session, the poller fetches 1–2 prior sessions of 1-minute bars (`SEED_MAX_SESSIONS = 2`, `intradayConfig.js:124`) at 5 units each (`pollRunner.js:91-111`).
  - It seeds at most 10 symbols per invocation, 3 concurrent, within 35 s (`intradayConfig.js:140-144`).
  - Failed seeds retry every 15 min for up to 2 h (`:125-126`).

**Calls per wake**

```
per collecting minute m:
  units(m) = |A_s ∪ (m ≡ 0 mod 5 ? U255 : ∅)| + A_c  + seeds(m)
per trading day (W = 420, 84 universe minutes):
  P_poll = 84·255 + 336·|A_s ∩ U255| + 420·|A_s − U255| + 420·A_c + (5…10)·A_s
         = 21,420 + 336·A_s + 420·A_c + ≈7.5·A_s          (when A_s ⊂ U255)
next trading day (validator): 5·A_s (+5 per failed probe)
```

**Why the poller is not yet the largest consumer.** It is the largest at today's scale: about 43,000 of about 86,000 at load (a), §4. At 40 games `agent-evaluate` overtakes it, because the poller dedupes across battles and `agent-evaluate` does not.

**Above about 81 actionable symbols the poller stops publishing but keeps paying.**
- `PUBLISH_MAX_BYTES` refuses the publish transaction above 9 MiB.
- The repo's own model puts the crossing at about 81 actionable symbols, "~7 concurrent battles" (`intradayConfig.js:146-157`).
- Units are recorded **before** the publish (`pollRunner.js:223-226`, `:288-300`).
- At 40 games (A_s ≈ 180) the poller would charge about 85,000 units a day and fail to publish near the close. That is the failure the comment at `intradayConfig.js:151-155` describes.

### Q-06. `agent-evaluate` per battle per tick

Battles are processed **sequentially** in fair-rotation order (`agent-evaluate.js:410-422`) under a 290 s budget (`:186`, `:425-438`). Every battle the loop reaches makes these calls, in this order:

| Call | Symbols | Weight | Count per battle per tick | Shared across battles? |
|---|---|---|---|---|
| **History** `/eod/` 90 d (`getStockAnalysisData(..., forceRefresh)`, `:1042` → `marketDataCache.js:639`, `:354-357`) | `allSymbols` = held ∪ bench ∪ hotBench ∪ CPU-opponent held ∪ {SPY, QQQ, BTC-USD.CC} (`:1019-1031`) | 1 each | \|allSymbols\| | **No.** No memo across battles. `forceRefresh` also skips the 4 h Firestore copy. |
| **Quote** `/real-time/` (`marketDataCache.js:684-686`, `:744-745`) | same | 1 each | \|allSymbols\| | **No** |
| **Intraday** `/intraday/` 5m (`:1319` → `fetchIntradayBatch`, one request per symbol) | held (incl. crypto) | 5 each | \|held\| (0 for CPU-passive tournament seats, `:1279-1306`) | **No** |
| HotBench rebuild prices (`:1452`) | new hotBench tickers | 2 each | ≤ 15 (cap 20) on rebuild ticks | No |
| Catalyst additions (`:2486`) | ≤ 5 | 2 each | occasional | No |
| Proposal prices (`:4733`) | 2 | 2 each | occasional | No |
| Cascade qualification (`:760`) | per replacement | 5 | occasional; memoized per tick | No |
| Guard 3 reference (`agentSwapExecution.js:144`) | 1 per swap | 2 | per swap | No |
| Canonical-open sweep (`:382`) | uncaptured League legs | 1 each | per tick, once per leg | per group |

**Symbol counts per battle, from code**
- **BaggerBomb agent battle** (gameMode `baggerbomb_agent`, `src/constants/agentGameModes.js:36`):
  - held = 2 star + 2 core + 2 support stocks + 1 support crypto = 7 (`decide.js:1226-1228`; `agentBattleService.js:155-161`)
  - bench = 3 stocks + 1 crypto = 4 (`decide.js:1173-1183`)
  - hotBench = 15, soft cap 20 (`decide.js:622-633`; `agent-evaluate.js:1392-1406`)
  - CPU opponent = 6 stocks + 1 crypto = 7 (`cpuOpponentGenerator.js:61-75`)
  - macro = 3
  - Total **36 symbols**. Per tick: 2 × 36 + 5 × 7 = **107 calls**.
- **League flat6 agent battle** (`baggerbomb_tournament`, `src/constants/agentGameModes.js:37`):
  - held = 6 stocks, bench empty (`decide.js:1283-1287`)
  - hotBench populated by the eval cron's refresh, rival-held excluded (`decide.js:1273-1275`, `:1340-1343`; `agent-evaluate.js:1386-1391`)
  - no CPU opponent (`decide.js:1463`)
  - macro = 3
  - Total **24 symbols**. Per tick: 2 × 24 + 5 × 6 = **78 calls** (48 for a CPU-passive seat).
- **Per trading day** (26 evaluating ticks): **2,782 per BaggerBomb battle, 2,028 per League human seat, 1,248 per League CPU seat**.
  - The Sep 18 discovery measured ≈ 2,664 per active battle per day (`docs/audits/20260918_PHASE0_INTRADAY_DATA.md:25`). That was before intraday 5m bars were counted per held crypto and before flat6.

**Is any symbol fetched for more than one battle in the same tick? Yes, always.**
- SPY, QQQ and BTC-USD.CC are fetched once per battle per tick (`:1026`, `:1031`).
- Any symbol held by one battle and hotBenched by another is fetched for both.
- A battle that holds `BTC` fetches both `BTC` and `BTC-USD.CC`: the strings differ, the instrument is the same (`:1031`).
- The Sep 18 scaling discovery found the same: "Everything … 'computed once' is in fact computed per battle" (`docs/audits/20260918_PHASE0_EVAL_CRON_SCALING.md:140`).

**Throughput cap (UNKNOWN in the repo).**
- Battles beyond the 290 s budget are deferred and fetch nothing that tick (`agent-evaluate.js:425-438`).
- The only recorded per-battle time is about 2.5 s ("UNVERIFIED against logs", cited at `docs/audits/20260918_PHASE0_EVAL_CRON_SCALING.md:107`). At that rate all 88 battles of load (b) fit in one tick.
- At the 20–30 s per battle assumed elsewhere (`:197`), only 10–14 battles fit. That would cap `agent-evaluate` near 28,000 calls a day, but would leave most battles unevaluated on every tick.

### Q-07. Browser timers

Every timer below runs only while its screen is mounted. The shared mechanics are:
- The client cache is a per-tab singleton. Prices live 2 min while the market is open (`src/services/cacheService.js:37-41`, `:68`; `src/utils/marketSchedule.js:34`). So a 60 s poll reaches the network about every 120 s.
- Stock entries freeze until the next open while the market is closed, so stock polls cost nothing off-hours. **Crypto always refetches** (`marketSchedule.js:221-246`).
- Only uncached symbols go into the URL, in caller order (`eodhdAPI.js:143-150`, `:158-163`).
- There is no in-flight dedupe and no retry.

| # | file:line | Screen | Mounted? | Interval | Route | Symbols | Visibility / market gate | Server cache key in front | Two viewers of the same battle |
|---|---|---|---|---|---|---|---|---|---|
| A | `src/App.jsx:3443-3471` | **App root, every screen, including logged-out** | yes (`main.jsx:58-59`) | 5 min (`:3470`) | prices + crypto | **all 54 `STOCKS` + 33 `CRYPTO`** (`src/data/assets.js`; counted by loading the module) via `getPopularStocks` / `getPopularCrypto` (`eodhdAPI.js:263-264`, `:443-444`) | **visibility-gated** (`:3444`); no market gate (stocks freeze off-hours, crypto does not) | `stock_prices_<sorted>` / `crypto_prices_<sorted>` 60 s + CDN 60 s | Cold tabs send a byte-identical URL, so the CDN *can* share it. Tabs with partly warm caches send different subsets, so they cannot. |
| G | `src/screens/AgentBattleScreen.jsx:1493` | BaggerBomb agent battle | yes (`BattleViewScreen.jsx:43-53`) | 60 s (`:125`) | prices + crypto | player + CPU held (14), no bench (`:1380-1389`) | none | as above | owner only; 1 if same URL and warm |
| H | `src/components/Tournament/Flat6BattleView.jsx:150` | League Flat6 / classic / spectator | yes | 60 s (`:48`) | prices (crypto sent to the stock route, `:133`) | agent six | none | prices | same doc order: shareable |
| I | `src/components/League/battleArena/useArenaPriceContext.js:55` | **League arena (default ranked surface)** | yes (`useArenaModel.js:37`) | 60 s (`:23`) | prices | agent six ∪ **viewer's own** three picks (`useArenaModel.js:29-35`) | none | prices | **differs per owner: one upstream per pod member** |
| J | `src/components/League/battleArena/useLiveComposites.js:43` | arena rival orbs | yes; `LEAGUE_LIVE_ORB_ENABLED = true` (`featureFlags.js:282`) | 60 s (`:24`) | `/api/tournament/live-composites` | pod users' held ∪ dropped picks (server-chosen) | none | `arenaQuotes_<sorted>` **45 s, per instance; no CDN** | 1 per warm instance per 45 s, else 1 per member. **A lone viewer misses every poll (60 s > 45 s).** |
| K | `src/components/Research/useResearchData.js:785` | research modal extremes | when open | 60 s | prices (crypto sent to stock route, `:771`) | 1 | none | prices | shareable |
| L | `useResearchData.js:389-420` | research "spectate" 1m chart | when open | 15 s; client intraday cache 5 min | `/api/stocks/historical` 1m | 1 | market checked once at start | `historical_<SYM>_1m_1` **1 h** | shareable, and stale |
| M | `src/screens/DraftRoomScreen.jsx:176` | snake draft room | yes (`App.jsx:9250`) | 60 s | prices or crypto | whole available pool | none | prices | shareable |
| N | `src/components/draft/DraftBattleScreenV2.jsx:791` | snake draft standings | yes (`App.jsx:9353-9356`) | 60 s, **`clearCache()` first** (`:403-406`) | prices / crypto (+ thresholds) | all players' picks | none | prices | same order for all 4: 1 within 60 s, else up to 4 |
| O / P | `src/components/freeAgency/shared/useSwapLogic.js:216`; `useClaimsFreeAgency.js:192` | free-agency screens | yes | 60 s, plus re-key on 60 s data loads | prices / crypto | free agents + viewer's roster | none | prices | per viewer: 2 |
| Q | `src/hooks/useBaggerBombBattleV3.js:825` | V2/V3 PvP | yes (`BattleViewScreen.jsx:86-111`) | 60 s (`:37`), armed only if mounted 09:30–20:00 ET Mon–Fri (`:812-823`) | prices + crypto | both players' held | session gate, evaluated once | prices | URL order is `[mine, opp]`: **2** |
| R | `src/hooks/useBaggerBombBattleV4.js:1301` | V4 PvP | yes (`BattleViewScreen.jsx:57-82`) | 60 s, always (`:1299-1301`) | prices + crypto | both held + free agents | none | prices | viewer-relative order: 2 |
| S / T / U | `BaggerBombTrainingBattleViewV4.jsx:365`, `…TrainingBattleViewV3.jsx:156`, `BaggerBombBattleViewRedesign.jsx:209` | training / fallback views | yes | 60 s | prices + crypto | held (+ bench) both sides | none | prices | 1 viewer / 2 |
| B–F | `App.jsx:4919`, `:4979`, `:3893`, `:3769`, `:5337` | V1 battle, completion checks, dashboard training / draft polls, CPU free agency | conditional | 60 s – 30 min | prices / crypto | battle-specific | B–C none; D–E visibility-gated | prices | mostly shareable |

**Not mounted (no route reaches them):**
- `src/hooks/useBaggerBombBattle.js:508`
- `src/components/BaggerBomb/BaggerBombBattleView.jsx:205`
- ClashCard variants
- `useBaggerBombCardScore.js:233` and `useDashboardScores.js:353`, which are replaced by the Command dashboards
- `DraftBattleScreen.jsx:334`, `FreeAgencyScreen.jsx:67`, `StonkOptionsArenaV2.jsx:223`
- `wsCacheBridge.js:67`, which is never started
- `MarketBriefing.jsx` and `WatchlistNews.jsx`, which have no importer

**Two viewers of the same battle: one fetch or two?**
- **Server memory** is keyed order-insensitively but lives **per Vercel instance**.
- **The CDN** is keyed on the raw URL, which is in viewer order and contains only that tab's uncached subset.
- So two viewers produce **one upstream fetch only if** both send an identical URL within 60 s to the same edge, or both land on the same warm instance. Otherwise they produce **two**.
  - BaggerBomb PvP (rows Q, R, U) can never share: each viewer lists their own symbols first.
  - League pod members (row I) never share: each sends their own picks.
- Whether Vercel collapses concurrent misses at the edge is UNKNOWN (§8).

**Per-viewer unit costs while the market is open** (60 s polls reach the network about every 120 s; no CDN collapse):
- Row A: 87 symbols × 12 per hour = **1,044 per visible tab-hour**. Off-hours and weekends it is 33 crypto × 12 = **396 per tab-hour**.
- Row G: 14 × 30 = **420 per BaggerBomb screen-hour**.
- Row I: 9 × 30 = **270 per League screen-hour**.
- Row J: ≤ 12 × 60 = **720 per League screen-hour** for a lone viewer. With several members on one warm instance it falls to ≤ 960 per pod-hour.

---

## 4. The model

### Q-08. Daily call model (formula first)

**Variables**

| Symbol | Meaning |
|---|---|
| `N_bb` | BaggerBomb agent battles |
| `N_lg` | League pods; each pod is 4 flat6 agent battles (`GROUP_SIZE = 4`, `src/constants/leagueTournament.js:71`), of which `c` are CPU seats |
| `U_held`, `U_bench` | distinct held / bench-only stock symbols across all games |
| `A_s` | `U_held + U_bench` |
| `A_c` | distinct crypto, held ∪ bench |
| `H` | hotBench size; 15 |
| `U_universe` | **239**: the ranked universe `ALL_TICKERS` (`api/_utils/rankingConfig.js:15-82`, `:359`; counted by loading the module). The poller universe `U255` adds 16 ETFs. |
| `V` | battle-screen-hours during the regular session, split `V_bb` / `V_lg` |
| `T_rth` | 390 minutes (210 on an early close); `W = T_rth + 30`; `k = T_rth / 15` = 26 evaluating ticks |

```
Daily(trading day, UTC weekday) =
    F                                   fixed, load-independent           ≈ 31,660 (+0…1,360)
  + P_poll                              intraday poller, actionable tier
  + E                                   agent-evaluate
  + VL                                  voice-layer-cache
  + D                                   deploys (BaggerBomb via decide, League via orchestrator)
  + T                                   next-UTC-day settlement tails (steady state: every weekday carries one)
  + B                                   browser

F      = (W/5)·255                        poller universe tier          21,420
       + 2·256 + 7·(255+256)              compute-index-intelligence     4,089
       + 239·10 + 100 + 12                compute-rankings               2,502
       + 32·54                            scan-movers                    1,728
       + 4·136 + 2·136 (+10·misses)       mandate-evaluate                 816 (+0…1,360)
       + 3·216                            keep-warm workflow               648   (every day)
       + ≈457                             rest of FantasyTimes            ≈457  (+11·U_rc recap, +5 per mover)

P_poll = 336·|A_s ∩ U255| + 420·|A_s − U255| + 420·A_c + ≈7.5·A_s

E      = k · [ N_bb·(2·(7+4+H+7+3) + 5·7)
             + (4·N_lg − c)·(2·(6+H+3) + 5·6)
             + c·2·(6+H+3) ]
       = N_bb·2,782 + (4·N_lg − c)·2,028 + c·1,248          (H = 15, k = 26)
         (+ ≤ 2·H per battle per day on hotBench rebuild, catalysts, proposals, cascades, Guard 3)

VL     = 26 · (A_s + held crypto)                 (held crypto requested as "BTC.US", §7)

D      = 44·(BaggerBomb deploys) + 48·N_lg        (decide.js: 22 symbols × 2; 4 deploys × 6 × 2)

T      = 2·(U_held + held crypto)                 agent-daily-scores
       + 5·A_s                                    intraday-validate
       + 5·R                                      film-tape candles (R ≈ A_s + 13 ETFs and indexes)
       + S_TU (+ canonical opens ≤ one per leg)   League banking

B      = V_bb·(420 + 1,044) + V_lg·(270 + 720 + 1,044)     no CDN collapse (upper)
         row A collapses to at most ≈ 87 per minute per URL (≤ 33,930 per session) if the CDN shares
         + 396 per visible tab-hour off-hours and on weekends (crypto)
```

**Crypto and extended hours**
- The poller collects crypto only inside the stock session window. There is no 24/7 server collection (`pollRunner.js:198-199`).
- The poller collects from open to close + 30 min, classifying post-close prints as `post_close` (`intradayConfig.js:49-58`).
- No code polls pre-market.
- Browser crypto polls run 24/7 on every visible tab (row A).

### Q-09. Evaluation

#### (a) Current-code load

**Assumptions (all ASSUMED unless cited)**
- **7 concurrent BaggerBomb agent battles**, the scale the Build-1 contract models ("30 actionable ≈ 7 concurrent battles", `docs/specs/INTRADAY_DATA_BUILD_1_CONTRACT_V1_1.md:281`). The same figure is the oversize crossing (`intradayConfig.js:150`).
- Other figures in the repo:
  - "8 active battles" on Jul 22 (`docs/ARCHETYPE_CONTROL_CENSUS_REPORT_V1.md:256`)
  - a stated launch scale of about 20 users × 3 portfolios ≈ 60 (`docs/audits/20260921_INTRADAY_CALCVERSION_2.md:463-464`)
- N_lg = 0; A_s = 60 (63 slots, some overlap); A_c = 3; all A_s ⊂ U255.
- V = 7 screen-hours (each owner watches 1 h); 7 deploys a day; no mandate books.

| Term | Calls / trading day |
|---|---|
| F (fixed) | 31,660 (+0–1,360) |
| P_poll: 336·60 + 420·3 + 7.5·60 | 21,870 |
| E: 7 × 2,782 | 19,474 |
| VL: 26 × 63 | 1,638 |
| D: 7 × 44 | 308 |
| T: 86 + 300 + 365 | ≈ 751 |
| B: 7 × 1,464 | 10,248 |
| **Total** | **≈ 85,900** (≈ 87,300 on a mandate-fundamentals miss day) |

The poller alone (universe tier + actionable tier) is about 43,300 of this total. **Headroom is about 14%.**

#### (b) N_bb = 24, N_lg = 16

**Assumptions (all ASSUMED)**
- **Symbol slots.** BaggerBomb: 24 × (6 held + 3 bench) = 216 stock slots. League: 16 × 24 = 384 (exclusive within a pod, `AGENT_MARKET_SIZE = 24`, `leagueTournament.js:75`). That is 600 slots drawn from the 239-name universe.
- A uniform draw would give about 220 distinct symbols. Agents concentrate on top-ranked names, so I assume **U_held = 150, U_bench = 30 → A_s = 180**. Sensitivity runs from 120 to 239.
- **A_c = 5.**
- **c = 0** (all League seats human-owned; an upper bound). Each CPU seat saves 780.
- **V = 88 screen-hours:** 24 BaggerBomb owners × 1 h + 64 League members × 1 h.
- **Deploys:** 24 BaggerBomb deploys a day (1-day battles) and 16 × 4 League deploys.
- **S_TU ≈ 150.**

| Term | Calls / trading day |
|---|---|
| F (fixed) | 31,660 (+0–1,360) |
| P_poll: 336·180 + 420·5 + 7.5·180 | 63,930 |
| E: 24 × 2,782 + 64 × 2,028 | **196,560** |
| VL: 26 × 185 | 4,810 |
| D: 24 × 44 + 16 × 48 | 1,824 |
| T: 310 + 900 + 965 + 150 + ≈192 | ≈ 2,517 |
| **Server subtotal** | **≈ 301,300** |
| B (no CDN collapse): 24 × 1,464 + 64 × 2,034 | 165,312 |
| B (row A collapsed to ≤ 33,930) | ≈ 107,400 |
| **Total** | **≈ 408,700 – 466,600** |

**Verdict at (b): over 100,000 by about 201,000 on the server alone (3.0×), and by about 309,000–367,000 with the browser (4.1–4.7×).**

**Even under the worst throughput cap it stays over budget.** If `agent-evaluate` were held to 10–14 battles per tick (Q-06), E falls to about 28,000 and the server subtotal to about 133,000. That is still over budget, and most battles would go unevaluated.

**Sensitivity of P_poll** (poller total, including the universe tier):

| A_s | Poller total |
|---|---|
| 120 | 64,700 |
| 180 | 85,400 |
| 239 | 105,600 |

**Five largest consumers at (b)**

| Rank | Consumer | Calls / day | Share of 466,600 |
|---|---|---|---|
| 1 | `agent-evaluate` (§3 Q-06) | 196,560 | 42% |
| 2 | App-wide market-data poll, browser row A (`App.jsx:3443-3471`) | 91,872 no collapse (≤ 33,930 collapsed) | 20% |
| 3 | Intraday poller, both tiers (`intraday-poll`) | 85,350 | 18% |
| 4 | League live-composites, browser row J → `getCachedBatchQuotes` | 46,080 | 10% |
| 5 | League arena price poll, browser row I | 17,280 | 4% |

Next come the BaggerBomb agent screen (row G, 10,080), `voice-layer-cache` (4,810), `compute-index-intelligence` (4,089) and `compute-rankings` (2,502). **Counting server crons only, the top five are** `agent-evaluate`, the intraday poller, `voice-layer-cache`, `compute-index-intelligence` and `compute-rankings`.

**Measuring instead of modelling.** The poller writes its own measured units per day to `intradayBudget/{etDate}.unitsRequested` and `.unitsBySource` (`intradayStore.js:126-146`). The founder can read that document for any day and compare it with the dashboard. **No other consumer keeps a unit ledger.** `mandateUpstreamCalls/{date}` counts requests, not tickers (`mandateUniverseSnapshot.js:508`).

### Q-10. Duplication at load (b)

**Representative aligned minute: 10:00 ET** (14:00 UTC in EDT). The poller's universe sweep, `compute-index-intelligence` intraday, an `agent-evaluate` tick, `voice-layer-cache`, `scan-movers` and (ASSUMED) the mandate `open30` snapshot all fire in this minute.

| Consumer | Quote symbol-fetches this minute | Daily-bar (`/eod/`) fetches | Intraday 5m requests |
|---|---|---|---|
| intraday poller (universe + actionable + crypto) | 260 | — | — |
| compute-index-intelligence (intraday) | 255 | 256 | — |
| agent-evaluate (24 × 36 + 64 × 24) | 2,400 | 2,400 | 24 × 7 + 64 × 6 = 552 |
| voice-layer-cache | 185 | — | — |
| scan-movers | 54 | — | — |
| mandate open30 snapshot | 136 | — | — |
| browser (≈ 13.5 concurrent screens: rows A, G, I, J) | ≈ 423 | — | — |
| **Total** | **≈ 3,713** | **2,656** | **552** |
| **Distinct instruments** (ASSUMED ≈ 255 universe + crypto + about 40 off-universe) | ≈ 330 | ≈ 266 | ≈ 155 |
| **Duplicate fetches in this one minute** | **≈ 3,380** | **≈ 2,390** | **≈ 397 requests (1,985 units)** |

**Symbols fetched more than once by different consumers in that minute**
- **SPY and QQQ:** poller, `compute-index-intelligence`, `agent-evaluate` once per battle (88 times), `generate-econ` on recap minutes, and the browser row A popular list.
- **BTC:** poller crypto, `agent-evaluate` as `BTC-USD.CC` per battle **and** as `BTC` per holding battle, browser row A and the battle screens.
- **Every held, bench and hotBench stock:** poller, `agent-evaluate` (per battle), `voice-layer-cache`, `compute-index-intelligence` and the browser battle screens.
- **The 11 sector ETFs and 5 index ETFs:** poller and `compute-index-intelligence`.
- **53 of the 54 FantasyTimes tickers:** `scan-movers`, poller and `compute-index-intelligence`. TGT is the one not in `rankingConfig.js`.
- **The ≈ 120 mandate candidates in the universe:** mandate and poller (overlap ASSUMED).

**Typical non-aligned minute (e.g. 10:07 ET).** Only the poller (185) and the browser (≈ 423) run. About 100 browser symbol-fetches duplicate the poller's same-minute fetch: battle-screen held symbols plus any popular stocks that are actionable.

**Per trading day at (b): same-minute duplicates**

| Duplication | Per day |
|---|---|
| `agent-evaluate` quotes that the poller fetched in the same minute (26 ticks × 2,400) | 62,400 |
| `agent-evaluate` daily bars fetched by more than one battle in the same tick (26 × (2,400 − 240)) | 56,160 |
| `agent-evaluate` intraday 5m requests fetched by more than one battle (26 × 397 × 5 units) | 51,610 |
| Browser battle-screen held quotes that the poller fetched that minute (rows G + I) | 27,360 |
| `voice-layer-cache` vs poller (26 × 185) | 4,810 |
| `compute-index-intelligence` real-time vs poller universe (7 × 255) | 1,785 |
| `scan-movers` vs poller (30 in-window wakes × 53) | 1,590 |
| mandate vs poller (≈ 3–4 snapshots × ≈ 120, ASSUMED overlap) | ≈ 400 |
| **Total** | **≈ 206,000 symbol-fetch units a day (≈ 44% of the (b) total)** |

**The floor if one store fetched each symbol once per minute.** About 330 instruments × 390 minutes ≈ **128,700 a day**. That is still above 100,000. Even perfect REST dedupe at 1-minute freshness for every symbol does not fit. The poller's own design (1 minute for actionable, 5 minutes for the universe) fits at about 85,000 only if no other consumer fetches quotes. This arithmetic is evidence for the spec; it is not a proposal.

---

## 5. What exists

### Q-11. Firestore stores that hold a price, quote, bar or indicator with a timestamp

| # | Collection / doc | Writer | Reader(s) | Price fields | Freshness stamp | Session field | Could a Q-01 consumer read it instead? |
|---|---|---|---|---|---|---|---|
| 1 | `marketDataCache/{SYM}_{daily\|technicals\|fundamentals\|earnings\|news\|holders}` | `setCachedData` (`api/_utils/marketDataCache.js:186-194`); force-refresh writers `agent-evaluate.js:1042`, `:1452`, `:2486`, `:4733`, `agent-daily-scores.js:257` | `getCachedData` (`:127-181`); direct `_daily` read with **no age check** at `compute-institutional-intelligence.js:213-219`; any signed-in client (`firestore.rules:118-121`) | `_daily`: 90 d OHLCV incl. `rawClose` (`:327-338`); `_technicals` indicators; `_fundamentals` 52w/MA/target | `cachedAt`, `ttlType`, `ttlMs`, `expiresAt` (`:188-194`) | none at doc level; per-row `date` | **Partly.** The daily bars are exactly what `agent-evaluate` re-fetches per symbol per tick, but every `forceRefresh` caller bypasses them. **No live quote is ever stored.** |
| 2 | `intradaySnapshots/latest` | `publishSweep` (`api/_utils/intraday/intradayStore.js:216-231`) from `pollRunner.js:288` | `readIntradaySnapshot` (`evaluatorHook.js:29-35`), called only when `INTRADAY_DIAGNOSTIC_ENABLED`, which is **false** (`featureFlags.js:2630`). **No price consumer.** Server-only (no rules entry; `firestore.rules:1363-1365`). | per symbol `price{value, priceAsOf, snapshotTs, previousClose, change, changePercent}`; `indicators{vwap, sessionHL, volume, volumePace, sma20_5m, macd5m, rsi5m}` (`facts.js:19`, `:51-61`, `:93-103`) | doc `sweepId`, `sweepAt`, `publishedAt`, `generation`; per symbol `priceAsOf`, `availableAt` | doc `etDate`; per symbol `sessionEtDate` (`facts.js:100`) | **Yes, the strongest candidate.** It covers held ∪ bench every minute and 255 names every 5 minutes. A legacy-shape adapter exists and is tested but unused (`intraday/priceAdapter.js:29`); its switch `INTRADAY_PRICE_SOURCE` is `'legacy'` (`featureFlags.js:2653`). Consumer max-age tiers already exist (`CONSUMER_MAX_AGE_MS`, `intradayConfig.js:164-167`). |
| 3 | `intradayCalcState/{etDate}` and `/actionable/{sym}` | `intradayStore.js:164-178`, `:225-229` | poller only | accumulators, 5-min bucket ring, indicator state (`buckets.js:7-14`; `accumulator.js:26-31`) | `updatedAt`; bucket `maxPriceAsOf` | `etDate`; bucket `sessionEtDate` | Partly (working state) |
| 4 | `intradayBudget/{etDate}` (unit ledger) | `recordUnits` (`intradayStore.js:126-146`) | none | — | `updatedAt` | `etDate` | Not a price store; it is the only per-ticker EODHD ledger in the repo |
| 5 | `agentBattles/{id}/intradayViews/{evalId}` | `evaluatorHook.js:45-50` (dark) | `useIntradayView.js:31`; validator | copy of snapshot facts | `evaluatedAt`, `snapshotSweepAt` | via facts | No (audit trail) |
| 6 | `voiceLayerCache/{battleId}` | `voice-layer-cache.js:962-979` | `decide.js:1540`, `chat.js:591`, `ensure-opener.js:223`, `research.js:124`, `tournamentBoardAutoCommit.js:88`, `voiceLayerAnticipation.js:234`, `voiceLayerTradeNarration.js:113`, `src/App.jsx:3976`, `src/services/tournamentGroupService.js:520` | `portfolioBriefs[].price` (= close ?? previousClose, `:303`), `changePercent`, `thresholdProximity`, `intraday` (from `cronState.intradayMomentum`, `:396-406`); `benchBriefs[].price` | doc `updatedAt`; a static label `dataFreshness.prices: 'rest_15min'` (`:970-975`); **the vendor timestamp is fetched (`:81`) but not stored** | **none** | Partly. It is already shared by 9 readers, and its own fetch could come from row 2. |
| 7 | `indexIntelligence/{SPY,QQQ,DIA,IWM,RSP}` | `compute-index-intelligence.js:1207-1213` | `agent-evaluate.js:1324` (SPY); `useMarketContext.js:25`; public read | `price`, `change`, `changePercent`, SMA/RSI/MACD/ATR (`:446-468`) | `updatedAt` | none | Partly (hourly at best) |
| 8 | `indexIntelligence/marketContext` | `:1216-1240` | ≈ 18 readers (decide, chat, agent-evaluate, voice-layer-cache, regime brief, 5 client files) | index `price/change/changePercent`, `sectorSnapshot` | `updatedAt` | `mode` (premarket / intraday); no date | Partly. For example, SPY/QQQ for the econ recap, if hourly is acceptable. |
| 9 | `indexIntelligence/stockRankings` | `:1524-1559` | ≈ 20 readers | `levels`, `pivots`, returns, `atrPercentile`, `techRaw` (`:1409-1442`) | `computedAt`, `updatedAt`, `expiresAt` | `mode` | No (derived) |
| 10 | `stockTechnicalScores/{SYM}` (239) | `compute-index-intelligence.js:1244-1249` | `agent-evaluate.js:1316`, `voice-layer-cache.js:894`, `captureReceipt.js:147`, client | Bollinger bands, pivots, levels, RS, ATR% (`:1101-1120`) | `updatedAt` | none | Partly (indicators) |
| 11 | `priceHistory/{sectorId}` | `compute-rankings.js:313-321` | same cron | `days[]{date, prices{T: close}}`, 200 d | `updatedAt` | `days[].date` = **UTC run date, not bar date** (`:198`, `:300`) | Partly (dating hazard, §7) |
| 12 | `tournamentGroups/{g}` | canonical opens `canonicalOpen.js:107-136`; banking `tournamentBanking.js:439-447`; flips `flip.js` | client; `live-composites.js` | `canonicalOpens.{sym}{open, capturedAt, priceTimestamp, session}`; `players[].picks[].legs[]{baselinePrice, baselineCapturedAt, baselinePriceTimestamp, baselineSession}` (`leagueTournament.js:1240-1336`) | `capturedAt`, `priceTimestamp`, `recordedAt` | `canonicalOpens[].session`, `legs[].baselineSession`, `dailyScores.dayN.recordedDate` | No for live prices. These are frozen settlement prints. |
| 13 | `agentBattles/{id}` | create `agentBattleService.js:154-165`; cron state; daily scores | agent-evaluate, voice-layer-cache, client | `portfolio.startingPrices`, `swapPrice`, `cronState.intradayMomentum[sym]` (`agent-evaluate.js:1355`), `cronState.lastTickPrice`, evaluation evidence `px`. `livePriceBeacon` is **retired** but still read by fenced `agentSwapExecution.js:180-188`. | `cronState.lastEvaluatedAt`, `recordedAt` | `intradayMomentum[].sessionDate` | No (battle state) |
| 14 | `agentBattles/{id}/tape/{etDate}/series/{sym}` | `filmTape/candlePass.js:200-222` | export, client | `sessionOpen`, 10-min bars, `atChecks[]` | `writtenAt` | `etDate` | No (post-session) |
| 15 | `battles/{id}` (V3/V4 PvP), `drafts/{id}` (snake) | client services; V4 and snake crons | client, crons | starting / ending / session / daily close prices | `capturedAt`, `recordedAt` | `sessionPrices.{SESSION}`, `dayN` | No |
| 16 | `mandateUniverseSnapshots/{tickKey}`, `mandateUniverseDaily/{date}` | `mandateUniverseSnapshot.js:487-563` | `mandate-evaluate.js:284`, `:661`; `mandateBatchTransport.js:619` | `entries[sym]{price (raw close), priceAsOf, quoteTs, source, complete}` (`:139-171`) | `builtAt`, `priceAsOf` | `sessionDate`, `tickKey` | **Partly.** About 136–300 symbols per slot; mark max age 20 min (`mandateConfig.js:97`). It is the repo's second union-snapshot precedent. |
| 17 | `correlationIntelligence/{sha1}`, `moverCandidates/*`, `institutionalAggregates/latest`, earnings and options entries | various | various | derived | `computedAt` / `detectedAt` | some | No |

**Searched for and not found as collections:** `livePrices`, `prices`, `quotes`, `priceSnapshots`, `closePrices`, `frozenPrices`, `candles`, `levels`, `rankings`, `thresholds`, `baggerBombLevels`, `eodClose`, `baselines`.

### Q-12. The voice-layer union

**The pattern.** `voice-layer-cache` builds one `Set` across all active battles before fetching.
- Each battle contributes star/core/support, `watchlist.active` and bench stocks; bench crypto is excluded (`api/cron/voice-layer-cache.js:834-867`).
- It then fetches `/real-time/` in batches of 20 with 200 ms gaps (`:33`, `:43-96`, `:893-898`) and reads each battle's prices from the map (`:927-957`).

**Batching does not save billed calls.** `/real-time/` bills per symbol (prompt weights). The union saves calls only because it dedupes across battles; batching only cuts request count and latency.

**Consumers that already use a cross-battle union**
- The intraday poller (`universe.js:34-48`)
- Nightly tournament banking (`tournamentBanking.js:484-494`)
- `agent-daily-scores` (`:242-246`)
- The mandate snapshot (held ∪ candidates, `mandateUniverseSnapshot.js:470-508`)

**Consumers that could adopt it unchanged** (a per-battle or per-group loop over `/real-time/` stock quotes with no per-consumer freshness rule):
- **`agent-evaluate`'s quote fetch** (`:1038-1056`). Its `/eod/` leg and its per-battle `forceRefresh` semantics would not carry over unchanged.
- **The canonical-open sweep**, which runs once per group (`canonicalOpenSweep.js:237-247`).
- **`live-composites`**, which runs per pod (`live-composites.js:66-70`).
- **`scan-movers` and `generate-pulse`**. Each requests one symbol per call over overlapping fixed lists.

**Two limits on adopting it unchanged**
1. It requests every held symbol with a `.US` suffix, including a held crypto (§7).
2. It stores no vendor timestamp per price (`:300-303`, `:970-978`). A consumer that needs `priceAsOf` (Q-15) cannot take it as-is.

### Q-13. The August 2026 unified data delivery design

**It does not exist in this repository.**

**Filenames searched** for `UNIFIED*`, `*PRICE_AUTHORITY*`, `*PRICE_CACHE*`, `*DATA_DELIVERY*` and `*freshness*`:
- in `docs/` and the repo-root `*.md`
- in every path ever recorded in local git history (`git log --all --name-only`)
- in the shared checkout, including its untracked files.

The only hit is `src/components/optionsArena/PriceFreshnessIndicator.jsx`, which is unrelated.

**Text searched** for `UNIFIED_DATA_DELIVERY|UNIFIED_PRICE_CACHE|unified data delivery|freshness ladder|Price Authority|PRICE_AUTHORITY|shared price|price store`:
- The only real trace is a queue item in the LC unfreeze closeout: "score history → unified price cache → tournament structure" (`docs/audits/20260807_LC_UNFREEZE_ADJUDICATION_CLOSEOUT_V1.md:87`). That doc is dated 2026-08-07; its status line reads "Adjudicated. Unfreeze approved." (`:3-5`).

**Status line, date, author and proposed pieces: UNKNOWN.** The design was never committed to any branch this clone has seen.

**Pieces that exist in code today and would belong to such a design:**
- A platform-wide quote snapshot: `intradaySnapshots/latest` (§5 row 2).
- A legacy-shape consumer adapter with a source switch: `priceAdapter.js:29`; `INTRADAY_PRICE_SOURCE ∈ {legacy, snapshot}` (`featureFlags.js:2653-2656`).
- Per-consumer freshness tiers `CONSUMER_MAX_AGE_MS {display: 45 min, stage4: 25 min}` (`intradayConfig.js:164-167`), and a stall threshold `COLLECTION_STALL_MS = 5 min` (`:117`).
- A per-ticker unit ledger: `intradayBudget/{etDate}`.
- The two-layer `marketDataCache` and the 45 s `getCachedBatchQuotes`.
- **No hits** for `priceAuthority|unifiedPrice|priceStore|sharedPrice|freshnessLadder|dataDelivery|unifiedData` in `api/`, `src/`, `scripts/` or `firestore.rules`.

**The repo's earlier census-like work**, which this report supersedes for current numbers:
- `docs/audits/20260918_PHASE0_INTRADAY_DATA.md:25`: "Fixed weekday spend ≈ 6,530 calls; agent-evaluate adds ≈ 2,664 per active battle". This predates the poller.
- `docs/audits/20260918_PHASE0_INTRADAY_ADDENDA.md:79`, `:93`, `:106`.
- `docs/specs/INTRADAY_DATA_BUILD_1_CONTRACT_V1_1.md:250`: poller ≈ 31,800 units/day at 30 actionable.
- `docs/audits/20260918_PHASE0_EVAL_CRON_SCALING.md:219`: "at 60 battles that is ≈160,000/day".

### Q-14. WebSocket

| file:line | Reachable from a mounted screen? | Endpoint | Token source | What it writes |
|---|---|---|---|---|
| `src/services/websocketService.js:288` (stocks), `:386` (crypto) | **Code is mounted; the socket never opens.** It is subscribed via `useWebSocketPrices.js:66` from AgentBattleScreen (`:1398`), Flat6BattleView (`:126`), useArenaPriceContext (`:31`), DraftBattleScreenV2 (`:129`) and the BaggerBomb views. `captureRealtimePrices` (`:708`) runs on every activation. | whatever `/api/ws-config` returns. It now returns `{available: false}` (`api/ws-config.js:40`), which the client treats as terminal (`websocketService.js:116-149`, `:134-137`). | was the `/api/ws-config` body; now none | would emit `price` events into `_priceCache` / `_dailyHL` (`:479-511`). Today `useWebSocketPrices` flushes nothing; `wsCacheBridge` is never started. |

- **No other WebSocket client** exists in `api/`, `scripts/`, `research/`, `tracer/`, `tester/`, `test/`, `dkb/`, `discovery/`, `fixtures/` or `public/`. There is no `ws` or socket.io dependency.
- **No server-side bridge or relay exists in this repo.** `api/ws-config.js:11-13` says one "is intentionally NOT built".
- The CSP still allows `wss://ws.eodhistoricaldata.com` (`vercel.json:38`). No code can open it.
- **The repo's only statement of the vendor limit** treats it as a **connection** limit: "may be approaching EODHD concurrent connection limit (50 max)" (`websocketService.js:327`, `:422`). The Sep 18 discovery equated it with "the plan's 50-ticker stream allowance" (`docs/audits/20260918_PHASE0_INTRADAY_DATA.md:238`). See §9.
- The VPS daemons are outside the repo and not described here.

---

## 6. Freshness contract

### Q-15 and Q-16

**Need categories:** real-time · 1-minute · 5-minute · 15-minute tick · daily · event-fresh.

**Scoring-bearing (SB)** means the output enters a scored comparison, a banked score, a baseline or a threshold check.

| Consumer | Need | Code that establishes the need | SB? | Wrong under a 15-min-delayed consolidated quote vs a real-time single-exchange trade? (Q-16) |
|---|---|---|---|---|
| `agent-evaluate` scoring (current vs entry, threshold multiplier vs previousClose) | 15-minute tick | 26 ticks (`isMarketOpen`, `agent-evaluate.js:366`). The score is computed from `prices[sym].current` and `previousClose` (`:1118-1165`). **Badges bank on the multiplier sampled at each tick** (empty extremes passed, `:1159-1165`; `agentScoring.js:271-284`). | **SB** (banked badges, scoreState) | **Yes.** Touches are sampled, so the delay and venue of the sampled print decide which badges bank. A single-exchange print can touch a band the consolidated quote does not, and vice versa. `previousClose` must be the official close, not a venue's last trade. |
| `agent-evaluate` Guard 2 (`/real-time/` previousClose vs `/eod/` prior close) | daily (reference) + tick | `resolveBadgeBaseline` (`baselineValidation.js:219-233`), wired at `:1131-1146`, `:1185-1198` | **SB** (baseline) | Yes. It assumes both come from the same vendor vintage. |
| `agent-evaluate` VWAP floor / cascade (5m bars) | 5-minute | `fetchIntradayBatch` 5m (`:1319`), `calculateVWAP` (`:30`); freshness rule `isVwapSessionUsable` / `newestCandleAsOfMs` (`:1353-1355`, `:760-779`) | **SB** (forced exits) | **Yes.** VWAP is volume-weighted, and single-exchange volume is a fraction of consolidated volume. |
| `decide.js` deploy starting prices (Guard 1) | event-fresh | `fetchValidatedStartingPrices` (`:1036-1050`): the price is validated against today's [low, high] and the last daily `rawClose` | **SB** (baseline) | Yes. It needs one coherent quote (price, high, low) per symbol. |
| `executeSwapServer` Guard 3 reference (fenced) | daily | `agentSwapExecution.js:136-145` | **SB** | — |
| League canonical opens | event-fresh (official session open) | `canonicalOpen.js:68`; "official session open … captured once post-open and frozen" (`leagueTournament.js:1301-1307`); `LEAGUE_CANONICAL_OPEN_CAPTURE = true` (`featureFlags.js:375`) | **SB** (leg baselines) | **Yes.** The official open is the primary listing's opening auction. A single-exchange first trade differs. |
| League nightly banking | event-fresh (official close) | `bankAllTournamentGroups` at 21:15 UTC (`tournamentBanking.js:466-518`), `current = close ?? previousClose` (`tournamentPrices.js:75-81`) | **SB** (banked) | Yes (official close vs a venue's last trade) |
| League flip | event-fresh (live last) | `flip.js:106-125` requires the raw `close`, not the previousClose fallback | **SB** (new leg baseline) | **Yes.** A 15-min delay lets a user flip at a stale price they can already see elsewhere. |
| League live-composites | 1-minute | 60 s poll (`useLiveComposites.js:24`), 45 s cache | display of a scored quantity (BUILD_RULES §9) | must match the banking price class or the live composite and the banked score disagree |
| `agent-daily-scores`, V4 daily scores, levels, snake banking | daily / event-fresh close | crons at 01:15–01:45 UTC and 21:15 UTC | **SB** | Yes (official close) |
| Mandate marks | 15-minute (slot), max age 20 min | `MANDATE_MARK_MAX_AGE_MS` (`mandateConfig.js:97`); slots (`mandateSessionSlots.js:41`, `:79-100`) | **SB** (NAV) | Yes, within one slot: the delay decides the mark |
| Intraday poller | 1-minute (actionable), 5-minute (universe) | `intradayConfig.js:11-13`; cumulative-volume VWAP estimate (`:49-65`) | not today (all consumers dark: `featureFlags.js:2630`, `:2641`, `:2653`, `:2667`) | **Yes for VWAP and volume pace** (consolidated session volume, `:49-58`) |
| `voice-layer-cache` | 15-minute tick | `*/15` schedule; `dataFreshness.prices: 'rest_15min'` (`:970-975`) | no (prompt context); `thresholdProximity` mirrors scoring math (`:358-393`) | Display only |
| `compute-index-intelligence` intraday | hourly (between 15-minute and daily) | `0 14-20` | no (rankings, hotBench selection) | No |
| `compute-rankings`, fundamentals, holders | daily | `0 11 * * 1-5`; `0 1,2 * * 1` | no | No |
| `scan-movers`, `generate-pulse`, `generate-econ`, `generate-recap` | 15-minute / event | schedules | no (editorial) | No |
| `film-tape-candles` | daily (post-session 1m bars) | `candlePass.js:766` | no (replay; `LOCKED_BASIS = 'eodhd_realtime_delayed'`, `src/constants/filmTape.js:121-122`) | No; it records the basis explicitly |
| `intraday-validate` | daily (next day) | `validationRunner.js:95-134` | no | No |
| Browser battle screens (rows G, H, I, Q–U) | 1-minute | 60 s polls | **V3/V4 PvP hooks write live scores to Firestore** (`useBaggerBombBattleV3.js:360`, `useBaggerBombBattleV4.js:505`) | Yes, for those PvP modes |
| Browser activation capture (`captureBattlePrices`) | event-fresh | `eodhdAPI.js:973-993` | **SB** (PvP baselines) | Yes |
| App-wide market data (row A), research, news, earnings | 5-minute / daily | `App.jsx:3470`; route TTLs | no | No |

**Shared price class within one computation.** These computations combine prices that must come from one class (same vendor product, same delay, same venue):
- A `agent-evaluate` tick: scores, threshold multipliers, Guard 2 and VWAP inputs. All come from the same tick's `/real-time/` + `/eod/` + 5m fetch, so they are coherent today.
- A League composite: the agent half (`scoreState.currentScore` from the last tick) plus the user half (quotes fetched now). They are already two vintages (`live-composites.js:16-19`).
- League banking plus canonical opens plus flips: all `/real-time/` today.
- `decide.js` Guard 1: price, high, low and rawClose of one symbol.

**What delayed means here.** The repo itself states that `/real-time/` is delayed about 15–20 minutes: "the platform's quote, delayed about 15–20 minutes" (`src/constants/filmTape.js:116-122`). The poller's Live v2 is a *different* delayed product (`/us-quote-delayed`, `observation.js:76`). Scoring today never reads Live v2.

---

## 7. Hazards and observations

### Q-17. If every consumer read one shared store that fetches each symbol once per freshness window

1. **Two endpoints that look like one.** Scoring uses Live v1 `/real-time/` (`marketDataCache.js:744`; `tournamentPrices.js:64`). The poller uses Live v2 `/us-quote-delayed` (`intradayFetch.js:49`). A store that serves one under the other's name would mix price classes inside one computation, e.g. Guard 2's `previousClose` vs `/eod/` check. The adapter `toLegacyPriceShape` exists precisely to bridge them, and its switch is off (`featureFlags.js:2644-2653`).
2. **Badges would change.** Server badges bank on the tick-sampled multiplier (`agent-evaluate.js:1159-1165`). A store that refreshes on a different cadence, or exposes session high/low, changes which threshold touches are observed. That changes banked scores, not just display.
3. **Settlement moments need their own print:**
   - canonical opens (official open, frozen once: `leagueTournament.js:1301-1307`)
   - nightly banking (official close)
   - flips (raw last; `flip.js:113-124` deliberately refuses the previousClose fallback)
   - deploy Guard 1 (one coherent quote)
   - mandate close marks (`mandate-evaluate.js:661`)

   A cache hit within a freshness window must not stand in for these.
4. **Closed-session prices served as live:**
   - `getCachedData` extends a stock entry's TTL to the next open when the market is closed (`marketDataCache.js:131-132`; `marketSchedule.js:316-325`). A `_daily` doc cached before the close is served as fresh after it.
   - `fetchBatchQuotes` returns `current = close ?? previousClose` (`tournamentPrices.js:80`). A store that answers after the close with the prior session's close would read as current.
   - The poller already classifies after-close Live v2 prints as `post_close` and keeps them out of session aggregates (`intradayConfig.js:49-58`). Other consumers have no such rule.
5. **Crypto runs 24/7, the server stores do not.**
   - The poller collects crypto only inside the stock session window (`pollRunner.js:198-199`). A shared store built from it has no crypto price nights or weekends, while browser crypto polls run 24/7 (row A).
   - `voice-layer-cache` requests a held crypto as `BTC.US` (`voice-layer-cache.js:845-851`, `:55`). It formats every held symbol as `.US`; only bench crypto is excluded (`:834-837`). What EODHD returns for that code is UNKNOWN. A shared store keyed on raw symbols must normalise crypto first.
   - `agent-evaluate` keys the same instrument as both `BTC` and `BTC-USD.CC` (`:1026-1031`).
6. **Dating.**
   - `priceHistory` stamps bulk "last-day" closes with the UTC run date, not the bar date (`compute-rankings.js:198`, `:300`).
   - `voiceLayerCache` and the snake `closeScores` drop the vendor timestamp (`voice-layer-cache.js:81`; `snake-draft-daily-scores.js:202`).
   - A shared store needs `priceAsOf` per symbol. The poller snapshot has it (`facts.js:98-100`); most other stores do not.
7. **Fence.** Retired `livePriceBeacon` is still read by fenced `agentSwapExecution.js:180-188`. Any beacon-style shared price on `agentBattles` would be fence contact (BUILD_RULES §1).
8. **Oversize.** The poller's snapshot already refuses to publish at about 81 actionable symbols (`intradayConfig.js:146-157`). As built, one document cannot carry the 40-game set.
9. **Two prices fetched moments apart, assumed to share a source:**
   - League live composite: agent half from the last tick, user half from now (`live-composites.js:16-19`).
   - `decide.js` Guard 1: `/real-time/` high/low vs `/eod/` rawClose, fetched together per symbol.
   - Guard 2: `/real-time/` previousClose vs `/eod/` prior close.

### Q-18. Unbounded loops and uncapped retries

**Unbounded per-symbol loops**
- `agent-daily-scores.js:255`: sequential, 2 per symbol, grows with S_A.
- `compute-daily-baggerbomb-levels.js:133`: chunks of 20, count unbounded.
- `options/resolve-tournament.js:51`: sequential `/real-time/`, unbounded, unauthenticated POST.
- `earnings/sync-queue.js:157-167`: `/options/` at 10 each.
- `earnings/resolve-tournament.js:468-470` and `manual-resolve.js:246-247`: 11 each over all pending pairs.
- `generate-recap.js:329-343`: 11 per uncovered candidate, before the ceiling check.
- `academy/pull-chart-data.js:166`; `admin/backfill-snake-draft-day.js:50`.
- `mandateUniverseSnapshot.js:388-409`: held tickers are uncapped.
- `fetchEODClosePrices`, one request per symbol (`eodhdAPI.js:1045-1059`).
- `getMultipleStockNews`, one `/news` per symbol at 5 each, even though the route accepts a list (`eodhdAPI.js:586-601`; `api/news/stock.js:43`).

**Unchunked single URLs that grow with activity:**
- `fetchBatchQuotes` (`tournamentPrices.js:64`)
- `snake-draft-daily-scores.js:186`
- `baggerbomb-v4-daily-scores.js:106`
- `api/stocks/prices.js:94` and `api/crypto/prices.js:56` (no symbol cap)

**`agent-evaluate`'s price fan-out** is one unbounded `Promise.all` over every symbol of the battle (`:1038-1056`). **No `marketDataCache` fetch has a timeout or abort signal** (`marketDataCache.js:357`, `:745`, `:807`).

**Uncapped retries**
- `tournament-orchestrator` → `decide`: a `pricing_unavailable` 503 returns **after** the 12-call fetch and rolls back the cooldown (`decide.js:1410`, `:1421-1434`). The orchestrator retries every 10 min with no attempt count (`tournamentOrchestrator.js:509-511`). That is up to about 288 calls per stuck agent per day.
- Pending earnings resolutions repeat on every run with no backoff (`resolve-tournament.js:661`, `:769`).
- Low-confidence catalysts are stored but never reused, so they re-validate at 5 each (`generate-mover.js:137`; `validatedCatalystCache.js:188-194`).
- Browser fallbacks are never cached, so a symbol EODHD omits is re-requested on every poll (`eodhdAPI.js:196-208`).

**Capped retries:** `compute-estimates` (2, `:71`), film tape (3), `seasonEvalContext.fetchWithRetry` (3), the research level-study client (4 with backoff), the poller seeds (15 min × 2 h).

### Q-19. Other observations

1. **The keep-warm workflow is an unbudgeted EODHD consumer.**
   - It pings `/api/stocks/prices?symbols=AAPL`, `/api/crypto/prices?symbols=BTC-USD` and `/api/health` every 5 minutes 06:00–23:55 UTC, every day (`.github/workflows/main.yml:21`, `:36`, `:45`, `:54`).
   - Every ping outlives the 30–60 s caches, so it costs about **648 calls a day**.
   - Its header says "~288 pings/day per endpoint" and "Against your 100,000 EODHD daily budget, this is < 1%" (`:7-8`). The real figure is 216 per endpoint.
   - The crypto ping builds `BTC-USD-USD.CC` (`api/crypto/prices.js:55`).
   - Whether the workflow is enabled, and whether `trade-seven-cyan.vercel.app` is production, is UNKNOWN.
2. **The app-wide market poll is the largest browser consumer.**
   - Every visible tab, including logged-out visitors, fetches 54 stocks + 33 crypto every 5 minutes (`App.jsx:3443-3471`).
   - That is about 1,044 calls per tab-hour in session and 396 per tab-hour at nights and weekends. The weekend dashboard number therefore includes visitor traffic, not just crons.
3. **`compute-index-intelligence` re-fetches 256 daily histories every hour** (`:891`): 1,792 calls a day for data that does not change intraday.
   - Its two pre-market runs (10:30 and 11:30 UTC) both run fully. There is no DST no-op and no holiday gate.
   - Its 255 intraday quotes are the poller's exact universe (`universe.js:4-6`).
4. **`compute-rankings` pulls 239 fundamentals daily** (2,390 calls) for quarterly data, on holidays too. It shares no cache with `marketDataCache/{SYM}_fundamentals`.
5. **`mandate-evaluate` pays with zero books:** at least 816 calls a day, all three of its flags true.
6. **Unit accounting in the wrong unit**, i.e. requests or chunks instead of tickers:
   - `mandateConfig.js:110` ("≤3 calls/tick")
   - `mandateUniverseSnapshot.js:508`
   - `scripts/fetch-ticker-industries.js:40` ("~239 EODHD credits" for 2,390 calls)
   - `agent-evaluate.js:751-753` ("an orphaned EODHD GET costs nothing and bills nothing": the raced-out `/intraday/` request is billed 5 when served)
7. **Stale code comment.** `agent-evaluate.js:375-379` says the canonical-open sweep is inert because `LEAGUE_CANONICAL_OPEN_CAPTURE` is off. The flag is `true` (`featureFlags.js:375`).
8. **Stale route comment.** `api/tournament/live-composites.js:24` says "nothing consumes it yet". `useLiveComposites` polls it every 60 s on the default arena (`featureFlags.js:282`).
9. **Hard-coded 2026 holiday lists** in `snake-draft-daily-scores.js:69-73` and `compute-daily-baggerbomb-levels.js:52-56`; the latter is missing 2026-06-19. From 2027-01-01 these crons treat 2027 holidays as trading days. Report separately; not fixed here.
10. **Open fan-out routes.**
    - `testMode=true` skips auth on `earnings/resolve-tournament.js:182-183`, `sync-queue.js:105-109` and `verify-batch.js:44-49`.
    - `options/resolve-tournament.js` accepts an unauthenticated POST (`:205-215`).
    - `earnings-historical-range` is a public GET costing 500 calls per new date pair (`:70`, `:91`, `:114`).
11. **`DraftBattleScreenV2` clears the whole tab price cache every 60 s** (`:403-406`). Every other price consumer in that tab then refetches.
12. **The research "spectate" 1-minute chart** polls every 15 s, but is served from a 5-min client cache and a 1-hour server cache whose key ignores `from`/`to` (`api/stocks/historical.js:172`).
13. **Training-pod deploys skip the trading-day check** (`tournamentOrchestrator.js:860-945`).
14. **Production sourcemaps are published** (`vite.config.js:13-15`). They hold no secret.
15. **The poller's `publish_oversize` path keeps charging units while writing nothing** (`intradayConfig.js:151-155`). It is reachable today at about 7 concurrent battles.

---

## 8. Unknowns

| Unknown | Why the repo cannot answer |
|---|---|
| EODHD dashboard calls on the last full trading day and the last weekend day; plan tier; per-minute limit (`discovery/recon-log.json:17` shows `x-ratelimit-limit: 1200` from a past response) | vendor account |
| The WebSocket allowance: symbols per token vs connections | vendor docs; the code says "connection limit (50 max)" |
| Billing for `/us-quote-delayed` (counted at 1 per ticker per the repo's G1), `/calendar/*`, `/economic-events`, `/splits`, `/div`, `/eod-bulk-last-day` with no symbols, comma-path `/real-time/A,B` vs `?s=`, `/fundamentals/` with `filter=`, malformed or duplicate symbols | vendor billing |
| What EODHD returns for `BTC.US`, `BTC-USD-USD.CC`, and legacy `/api/earnings` | vendor behaviour |
| Deployed flag values (they equal HEAD only if `8c9ea5ef` is deployed) and env vars (`EODHD_API_KEY`, any `VITE_*` EODHD variable, `TOURNAMENT_DEPLOY_BASE_URL`) | Vercel settings |
| Live counts: active battles, pods, CPU seats, distinct held/bench symbols, overlaps, mandate books, uncovered recap candidates, movers per day, viewers and tab-hours | production Firestore and analytics. **Partial measurement exists:** `intradayBudget/{etDate}` holds the poller's actual units per day. |
| `agent-evaluate` per-battle wall time, which sets how many battles a tick reaches | never recorded (`docs/audits/20260918_PHASE0_EVAL_CRON_SCALING.md:286`) |
| Vercel CDN behaviour: whether `s-maxage` function responses are edge-cached, whether concurrent misses collapse, whether `Vary: Origin` fragments the cache; number of warm instances (L1 sharing) | platform behaviour |
| Whether the GitHub keep-warm workflow is enabled; whether `trade-seven-cyan.vercel.app` is production | GitHub and Vercel settings |
| Whether the key formerly returned by `/api/ws-config` was rotated | vendor account |
| The VPS daemons and the Hostinger "Codex CLI" pipeline (`api/fantasytimes/ingest-deepdive.js:5-9`) | outside the repo |
| Mandate candidate overlap with the poller universe | not computed |
| Which UTC/ET day boundary the EODHD dashboard uses | vendor UI |

---

## 9. Refuted assumptions (things in the prompt the code contradicts)

1. **"The last time this was designed (Aug 13, 2026, `UNIFIED_DATA_DELIVERY_DESIGN_V1`)".**
   - **No such document exists in the repo or in any local git ref.** No text mentions it beyond the LC-unfreeze queue line "unified price cache" (`docs/audits/20260807_LC_UNFREEZE_ADJUDICATION_CLOSEOUT_V1.md:87`).
   - If it exists, it lives outside this repository.
2. **"The weekend number is the baseline the crons burn with no battles; the difference is what games cost."**
   - **Wrong in three ways.**
   - (i) About **31,660 calls a weekday run with zero battles and never on weekends**: poller universe 21,420, index intelligence 4,089, rankings 2,502, scan-movers 1,728, mandate 816+, FantasyTimes ≈ 457. A Sunday's crons cost about 648. The weekday-minus-weekend difference therefore overstates game cost by about 31,000.
   - (ii) **Saturday UTC is not a no-battle day.** It carries Friday's settlement tails: agent-daily-scores, V4 scores and levels, the validator, film tape and estimates.
   - (iii) **Browser tabs cost money on weekends:** 33 crypto symbols every 5 minutes per visible tab, plus the keep-warm workflow.
   - A cleaner read is: the founder's weekday number minus about 31,700, minus the weekday browser load, compared with `intradayBudget/{etDate}` for the poller's share.
3. **"EODHD's docs currently describe it as 50 symbols per token … not 50 connections."** The repo cannot settle the vendor fact, but **the code assumes the opposite**: "may be approaching EODHD concurrent connection limit (50 max)" (`src/services/websocketService.js:327`, `:422`). Either way, the 40-game actionable tier (A_s + A_c ≈ 185) is far above 50 symbols.
4. **"Since then the intraday poller became the largest consumer."**
   - **True at today's scale** (≈ 43,300 of ≈ 85,900 at load (a)).
   - **False at 40 games.** There `agent-evaluate` (≈ 196,600) is 2.3× the poller (≈ 85,400). The poller dedupes across battles; `agent-evaluate` does not.
   - The poller's output also has **no price consumer**: every flag that would read it is off (`featureFlags.js:2630`, `:2641`, `:2653`, `:2667`).
5. **The supplied endpoint list and search terms omit the poller's stock endpoint.** It is Live v2 `/us-quote-delayed` (`intradayFetch.js:49`), not `/real-time/`. They also omit `/eod-bulk-last-day`, `/calendar/*`, `/economic-events`, `/splits`, `/div`, `/options/` and the legacy `/api/earnings`. All were found and inventoried.
6. **Q-05's premise "how it dedupes across battles":** it does dedupe. But its 255-symbol universe tier is **independent of battles**, about 21,420 units every trading day even with none (`pollRunner.js:210-212`).
7. **Q-07's "League projection" timer** does not exist as a separate projection poll. The League screen costs come from the arena price poll (row I) and the live-composites poll (row J). The route's header claims it is unconsumed; it is consumed.
8. **Q-12's framing of the voice-layer union as the pattern to copy.** The union is real (`voice-layer-cache.js:834-867`). But its **batching saves no billed calls** (`/real-time/` bills per symbol), it **mis-suffixes held crypto** as `.US`, and it **drops the vendor timestamp**.
9. **"`U_universe` the ranked universe size."** The ranked universe is **239** (`ALL_TICKERS`). The 255 used by the poller and index intelligence adds 16 ETFs.
10. **"Anything named like `livePrices`."** No such collection exists. The nearest, `livePriceBeacon`, is a retired field still read by a fenced file.
11. **The executor.** The prompt is addressed to Astra (Codex). It was executed by Claude Code (Opus 5.5) at the founder's request, from the same text. The repository named in the prompt, `fashraf94/TradeSeven`, is the origin of this checkout.

---

*End of report. Read-only. No fix proposed or begun.*
