# Battle Research — the field inventory (read-only discovery)

**Date:** Thursday, November 12, 2026 · **Author:** Claude Code (Opus) · **Kind:** Phase 0, read-only.
**Branch:** `claude/battle-research-field-inventory` (worktree branch `claude/battle-research-field-inventory-f8bbec`).
**HEAD at start:** `68a237a8a46ec47330837cd4faacf2dae37cfbe1`, the #1042 merge. That was also `origin/main` after `git fetch origin`, run first, before any comparison (BUILD_RULES §3). The tree was clean.
**What changed in the repo:** this report and one row in `docs/README.md`. No code, no flag and no rule changed.
**Production reads:** Admin SDK `get`, `select` and `count` only, between 1:32 PM and 1:44 PM ET, with the market open. Credentials were parsed in place from the main checkout's `.env.local` and never printed or copied. Every script passed a write-verb grep (`set`, `update`, `delete`, `add`, `create`, `commit`, `batch`, `runTransaction`, `fetch`, `http`) before it ran. Owners are labelled A, B, C… by first appearance, and no uid or email appears here.
**No provider call** (EODHD) and **no model call** (Anthropic, OpenRouter) was made. Two questions stopped there (§10).
**Markers:** **VERIFIED** means I read the code at that line in this session. **MEASURED** means a production read in this session. **ASSUMED** means inferred but not proven.

---

## 0. Executive verdict

| # | Field | Verdict | One line | Gate · provider cost |
|---|---|---|---|---|
| F1 | Technical rank (and score) | **one read away** | Every non-crypto name in every group has it, both universe-wide (1–228) and within its sector. It sits in one public Firestore document that the battle screen does not read yet. | None (public doc) · 0 provider calls; one 422 KB read |
| F2 | Today's move | **split** — book `ready` · persisted bench `one read away` · hot bench and watchlists `no path` | The screen polls prices for the held book only. The persisted bench's move is in the battle's 15-minute voice-layer cache. Hot-bench and watchlist names have no move a battle client can read. | Bench via the cache: owner-only read, 0 provider calls. The fix for the rest (§3.4): a server read of `intradaySnapshots/latest`, 0 new provider calls, but a build |
| F3 | Size of one scoring rung | **held `ready` · candidate `one read away` (proxy) · exact candidate `no path`** | A held measured stock carries its frozen % on the battle doc. For a candidate, the rankings' ATR % is the same formula: on the same bars it matched to two decimals for five of six held stocks, and COST, whose window holds a 0.15% price adjustment, was off by 0.01. The modal's preview draws a different number (§4.2). | 0 provider calls for the proxy; the exact number is measured only at swap time, with EODHD calls |
| F4 | Overlap with holdings | **no path** | No candidate-against-book result is stored anywhere a client can read. The Correlation Lab fetches bars from EODHD on a cache miss. `priceHistory` already holds 200 daily closes for every name (Admin-only), so a server build could compute overlap with 0 provider calls. | Lab: up to 11 EODHD fetches per candidate · `priceHistory` route: 0 |
| F5 | Game eligibility | **ready** (`no price` is one read away) | The rule the bench sheet uses (`canComeIn`) is pure, already bundled in the browser, and reads only the subscribed battle doc. | Cockpit-on battles for the sheet's own labels · 0 |
| F6 | Sector | **ready** | A static ticker→sector map is already imported by client code. It agrees with the rankings document on 228 of 228 names. | None · 0 reads |
| F7 | Bench and watchlist as groups | **bench lists `ready` · saved watchlists `one read away`** | The persisted bench, hot bench, monitoring list and equipped-list snapshot all ride the subscribed battle doc. The owner's saved lists are one owner-scoped query. | 0 provider calls · **which "watchlist" is meant is a founder question (Q1)** |
| F8 | The research record | **no path** (needs a schema version) | `researchWork` has no battle origin, no battle host, and no fields for a group, conditions, ordering or ranked rows. Production holds 0 records, and the Film Room reads none. | Writers are on (owner-gated), but no host session has run since they launched |

**The sample, stated plainly.** Production had **one live agent battle** at the read (`agGwb55Lok0Nc1N7yGd0`, owner A, BaggerBomb agent, measured model, 18 call records). Every coverage count for "a live battle" is that battle (MEASURED). The prompt asked for two or three. To show the group shapes hold, §1 adds owner A's three most recent **ended** battles and one ended League tournament battle. Their coverage is measured against **today's** rankings and their own last cache, so their lock counts and freshness mean nothing, and their F3 gaps are cross-day. Only one owner appears anywhere. Whether the battle screen's cockpit is on is **INFERRED**: no `cockpitConfig/release` document exists (MEASURED), so the cockpit is on only for owners on the server's allowlist variable, which is not in `.env.local`. The live battle holds call records, so it is on.

**Two prompt-vs-code disagreements (the code wins):**
1. The prompt names `api/cron/compute-rankings.js` as the writer of `indexIntelligence/stockRankings`. That file writes `peerRankings`, `sectorRankings`, `scannerSummary` and `priceHistory` (`compute-rankings.js:315`, `:1327`, `:1415-1426`, VERIFIED). `stockRankings` is written by **`api/cron/compute-index-intelligence.js:1524-1559`** (VERIFIED).
2. `api/_utils/sharedResearch/` does not exist at HEAD and never did (`git log --all -- api/_utils/sharedResearch` is empty). "Shared Research" is the `shared_research` origin inside `api/_utils/researchRecords/model.js:37-55` (VERIFIED), plus `api/_utils/hypothesisRecords/sharedResearchVersion.test.js` and its fixture.

---

## 1. The groups on the live battle (F7's numbers, used by every section)

The battle doc carries five lists (`selectSymbolRoster.js:10-16`, `battleUniverse.js:65-83`, VERIFIED). "Minus the book" is how the Bench pane counts them.

| Group | Where it lives | Live battle (13:32 ET) | Ended `jWQj…` | Ended `E0Tv…` | Ended `mgsS…` | Ended League `6pXV…` |
|---|---|---|---|---|---|---|
| Book (held) | `portfolio.{star,core,support}[]` | 7 (6 stocks + BTC) | 7 | 7 | 7 | 6 |
| Persisted bench | `portfolio.bench.stocks[]` | 6 (4 cooldown-locked) | 6 | 5 | 6 | **0** |
| Bench crypto | `portfolio.bench.crypto` | 1 | 1 | 1 | 1 | **0** |
| Hot bench | `watchlist.hotBench[]` (strings) | 15 | 15 | 19 | 20 | **0** |
| Monitoring | `watchlist.monitoring[]` (strings) | 18 | 18 | 18 | 18 | **0** |
| Equipped list (frozen at deploy) | `agentContext.equippedWatchlist.tickers[]` | 0 (none equipped) | 0 | 8 | 9 | 0 |
| Owner's saved lists | `watchlists/*` where `userId` = owner | 8 lists → **42 names** (26 in the 5 committed lists) | 45 | 43 | 43 | — |
| — of those, on the swap lists | | **2 of 42** (1 of 26 committed) | | | | |

All MEASURED. Rankings coverage on the three ended battles matched the live one: 100% of non-crypto names in every group.

**A League tournament battle starts with no bench lists, by design.** The prescribed deploy writes an empty persisted bench and an empty hot bench (`decide.js:1335-1350`, `:1431-1437`, VERIFIED; founder ruling D5). The evaluation cron then fills the hot bench during play, filtered by the group ledger (`agent-evaluate.js:1597-1660`, `:787-806`, VERIFIED). The one ended League battle read had every bench list empty (MEASURED on `6pXV…`). No League battle was live, so a live one was not counted. On a League battle the selector would therefore have the cron's hot bench and the owner's saved lists, but never a persisted bench (Q5).

---

## 2. F1 — Technical rank (and its score)

**2.1 Source.**
- **Writer:** `api/cron/compute-index-intelligence.js` (VERIFIED). It sorts every scored stock by `technicalScore` and assigns `technicalRank` 1…N **across the whole universe** (`:1138-1142`). It then ranks again **within each sector**, writing `sectorTechnicalRank` and `sectorTechnicalTotal` (`:1144-1158`).
- **Rankings row:** carries both ranks, the score and `sectorName` (`:1394-1397`, `:1310`). The doc is written in one batch (`:1524-1559`). **Both ranks exist on every row.**
- **Per-symbol twin:** `stockTechnicalScores/{symbol}`, written in the same run, carries `technicalRank`, `technicalScore`, `sectorTechnicalRank`, the factor scores and `updatedAt`. MEASURED key list: 31 keys, `updatedAt` 1:01 PM ET, the same instant as the rankings doc. It is read one symbol at a time by `src/components/Research/useTechnicalScore.js:21` (VERIFIED).
- **Weights:** `TECHNICAL_FACTOR_WEIGHTS` in `api/_utils/rankingConfig.js`, imported at `compute-index-intelligence.js:50` (VERIFIED). I did not re-derive the weights.
- **Readers today:**
  - the bench endpoint, which reads the rankings doc (`api/agent/cockpit-bench.js:239-244`, VERIFIED) and returns `rank: technicalRank` (`:187`);
  - the hot-bench rebuild in `agent-evaluate.js:1534`, `:1628-1637`;
  - the voice-layer cache (`voice-layer-cache.js:933`);
  - client reads in `CompeteTab.jsx:929`, `RankingsView.jsx:67`, `SectorETFRanksTab.jsx:18`, `useAtrPercentiles.js:46` and the research sheet's `useSheetView.js:61`. All VERIFIED by grep at those lines.

**2.2 Coverage** (MEASURED, live battle):

| | Book | Bench | Bench crypto | Hot bench | Monitoring | Saved lists |
|---|---|---|---|---|---|---|
| In rankings | 6/7 | 6/6 | 0/1 | 15/15 | 18/18 | 42/42 |

The doc has 228 rows; all carry `technicalRank`, `sectorTechnicalRank`, `technicalScore`, `techRaw.atrPercent` and `sectorName` (MEASURED). **Crypto has no rank**, which is one name per battle (BTC held, plus the bench crypto).

**2.3 Freshness.**
- **Pre-market runs** at 10:30 and 11:30 UTC (`vercel.json:149-150`, VERIFIED), which is 5:30 and 6:30 AM ET in winter.
- **Intraday recompute** hourly at 14:00–20:00 UTC (`vercel.json:153-154`), which is 9:00 AM–3:00 PM ET now and 10:00 AM–4:00 PM ET in summer. It splices a live real-time bar onto each history first (`compute-index-intelligence.js:5-9`, `:186-190`, `:737-749`, VERIFIED), so **ranks move during the day**.
- **`expiresAt`** is set to +75 minutes for an intraday run and +24 hours for pre-market (`:1546-1548`).
- **At the read:** `mode: intraday`, computed 1:01 PM ET, 31 minutes old (MEASURED).
- **Worst case:** about 60–75 minutes old in session. After the last intraday run it holds until the next morning's pre-market run.

**2.4 Access path in a live battle.**
- **Already held:** nothing. The battle screen does not read `stockRankings` or `stockTechnicalScores` (grep of `AgentBattleScreen.jsx`, VERIFIED).
- **On cockpit-on battles**, opening the bench sheet makes the one request the screen already has (`useCockpitBench.js:30-55` → `GET /api/agent/cockpit-bench`). It returns `rank` for the persisted bench and hot bench only (`swapListNames`, §6). It never returns rank for the owner's lists, the monitoring list or the equipped snapshot.
- **One existing read:** `getDoc(indexIntelligence/stockRankings)`. It is public-read (`firestore.rules:963-966`, VERIFIED) and made elsewhere in the app (2.1). It covers every group at once, at about 422 KB (MEASURED JSON size) and 0 provider calls. The research sheet makes this same read when its flag is on, but `RESEARCH_MODAL_SHEET_MODE` is `'off'` (`src/config/researchModalFlags.js:111`, VERIFIED).
- **No path today:** a rank for crypto.

**2.5 Verdict: `one read away`.** It is `ready` only for bench and hot-bench names, on cockpit-on battles, once the sheet has opened.

---

## 3. F2 — Today's move (% from the prior close, with its time)

**3.1 Source.** There are three sources, one per group.

- **Book: the 60-second poll.**
  - The poll interval is `PRICE_POLL_INTERVAL = 60000` (`AgentBattleScreen.jsx:148`, VERIFIED). Its symbol list is **the player's and the CPU's books only** (`:1466-1483`).
  - Each tick calls `stockAPI.getMultipleStockPrices(stockSymbols)` (`:1511`). That goes to `/api/stocks/prices` and then EODHD `real-time` (`api/stocks/prices.js:78-137`).
  - The screen keeps **`price` and `previousClose` only** (`AgentBattleScreen.jsx:1516-1519`). The quote's `timestamp` is dropped on this path.
  - The WebSocket layer is always off (`api/ws-config.js:40`), so `effectivePrices` is the poll (`AgentBattleScreen.jsx:1493-1496`).
  - The gated quote-integrity path that does keep a market time (`shadowCpuQuoteIntegrity.js:141-166`) is dark: `SHADOW_CPU_QUOTE_INTEGRITY_ENABLED = false` (`featureFlags.js:3124`, VERIFIED).
  - **On a measured battle the held row's own `priceChange` is "since fill" from the last scored check**, not "since prior close" (`AgentBattleScreen.jsx:256-262`, `stockThresholdModel.js:26-32`, VERIFIED). "Today's move" for a held name has to be computed from the two poll maps (`effectivePrices[sym]`, `previousClosePrices[sym]`).
- **Persisted bench: the voice-layer cache.**
  - `voiceLayerCache/{battleId}.benchBriefs[]` carries `price` and `changePercent` (`api/cron/voice-layer-cache.js:464-483`, `:566-575`, VERIFIED). These are EODHD `change_p` against EODHD's `previousClose` (`:47-100`).
  - **Only the persisted bench stocks are fetched** (`:870-895`). The bench crypto is excluded, and the hot bench is never collected.
  - A brief carries **no quote time**. The doc has `updatedAt` and `dataFreshness.prices: 'rest_15min'` (`:997-1015`).
  - The bench endpoint relays it as `changePct` (`cockpit-bench.js:137-145`, `:189`).
- **Every listed name: `intradaySnapshots/latest`** (not client-readable).
  - The Intraday Data poller writes it every minute (`api/cron/intraday-poll.js:1-13`; `INTRADAY_COLLECT_ENABLED = true`, `featureFlags.js:2640`, VERIFIED).
  - Its universe is the 228 ranked stocks plus indexes, sector ETFs and battle crypto (`api/_utils/intraday/universe.js:3-13`).
  - Each symbol carries `price.{value, priceAsOf, previousClose, change, changePercent}` (`facts.js:51-58`, VERIFIED; key list MEASURED).
  - **It has no rule in `firestore.rules`, so the default deny applies.** No endpoint returns it to a battle client (grep, VERIFIED): its readers are the mandate cron and the dark intraday evaluator hook.

**3.2 Coverage** (MEASURED, live battle):

| | Book | Bench | Bench crypto | Hot bench | Monitoring | Saved lists |
|---|---|---|---|---|---|---|
| Poll (client-held) | 7/7 by construction (ASSUMED from code) | — | — | — | — | — |
| Bench brief `changePercent` | — | 6/6 | 0/1 | 0/15 | 0/18 | 1/42 (the one also on the bench) |
| `intradaySnapshots` price + change + `priceAsOf` | 7/7 | 6/6 | 1/1 | 15/15 | 18/18 | 42/42 |

No rankings row carries a price or a day change (MEASURED key list, 37 keys). This confirms the note at `cockpit-bench.js:42-47`.

**3.3 Freshness.**
- **The poll** is held up to 60 seconds, plus three caches (`#1043` §1, re-VERIFIED here): the browser's per-symbol cache of 2 minutes (`src/services/cacheService.js:37-39`, `:68`; `eodhdAPI.js:143-150`), the server's memory cache of 60 seconds, and the CDN's `s-maxage` 60 seconds + SWR 30 seconds (`api/_utils/serverCache.js:114`; `prices.js:84-89`). Behind all of that sits the vendor's own delay.
- **The vendor delay**, measured on the same EODHD real-time feed in `intradaySnapshots` at 1:43 PM ET: median quote age 19 minutes, 90th percentile 20 minutes (MEASURED). Three symbols carry an older quote: PARA, WBD and SOL. None is ranked or in any of this battle's groups (MEASURED).
- **The bench brief** runs every 15 minutes, 13:00–20:45 UTC on weekdays (`vercel.json:173-174`), and only while the market state is OPEN or PRE_MARKET (`voice-layer-cache.js:851-855`). The last useful run is 3:45 PM ET, so the last 15 minutes of the session are never refreshed. At the read the cache was 2 minutes old, plus the vendor's ~19 minutes (MEASURED).
- **What `change_p` means before the open** cannot be settled without a provider call (§10, S1).
- **The intraday snapshot** was swept 1 minute before the read (MEASURED). It collects from the open until 30 minutes after the close (`intraday-poll.js:4-6`).

**3.4 Access path in a live battle.**
- **Already held (book):** price and previous close from the poll, without a quote time.
- **One read away (persisted bench):**
  - `getDoc(voiceLayerCache/{battleId})` is owner-only (`firestore.rules:1024-1028`, VERIFIED) and no provider call.
  - Alternatively, the bench endpoint's `changePct`, which is `ready` once the sheet opens on a cockpit-on battle.
- **No path (hot bench, monitoring, equipped, saved lists, bench crypto):**
  - Widening the 60-second poll to these names would use an existing request but **adds EODHD traffic**. The server cache key is the exact sorted set of uncached symbols (`prices.js:81-82`), so any new set is a miss and a new `real-time` call.
  - **The provider-free fix is a build:** a server read of `intradaySnapshots/latest` (one doc, about 312 KB, MEASURED), or a rules grant on it. It covers every group at 100%, with a quote time.

**3.5 Hazards for "up or down today"** (report only, nothing fixed):
- **H1: a missing quote reads as flat.**
  - On a fetch failure or an omitted symbol, `getMultipleStockPrices` fabricates `price = previousClose = FALLBACK_STOCK_PRICES[sym] || 100` and `isFallback: true` (`eodhdAPI.js:196-207`, `:215-231`, VERIFIED).
  - The battle screen's shipped path reads `data.price` and `data.previousClose` and never checks `isFallback` (`AgentBattleScreen.jsx:1516-1519`).
  - **A fallback name therefore shows a 0.00% move.** An "up or down today" filter must exclude it.
- **H2: the portfolio brief defaults a missing move to 0.**
  - It uses `price.change_p || 0` (`voice-layer-cache.js:154`), and the price route does the same (`prices.js:133`).
  - All 7 book briefs had a real price at the read (MEASURED), so it was not live today.
  - The bench brief is null-honest (`:569-572`).

**3.6 Verdict: split.**
- Book: **`ready`** (no quote time).
- Persisted bench: **`one read away`** (15-minute cache plus vendor delay; `ready` via the sheet on cockpit-on battles).
- Hot bench, monitoring, equipped and saved lists: **`no path`**. The build that closes it adds 0 provider calls.

---

## 4. F3 — The size of one scoring rung

**4.1 Source.** There are four numbers, not two.

| # | Number | Where | Formula | Used by |
|---|---|---|---|---|
| a | **`scoringPct`** | `portfolio.{tier}[].stockThresholdReceipt.scoringPct` and `scoring.stockRewardContexts.{side}.{positionId}.scoringPct` on the battle doc (key lists MEASURED) | ATR-14: the simple mean of 14 true ranges over 15 **fully adjusted** daily bars through the last completed session, ÷ last close × 100 (`measuredStockThreshold.js:73-80`); round-half-even to 6 dp (`stockThresholdAdmission.js:11-22`). **Measured once, at entry, with EODHD `eod` + `fundamentals` + `real-time` calls** (`stockThresholdMeasurementProvider.js:32-72`). A rung = fill × (1 + k × pct/100) (`stockThresholdModel.js:72`) | The scorer, the held Bomb ladder (`ladder.js:83-99`) |
| b | **`techRaw.atrPercent`** | `stockRankings.stocks[].techRaw.atrPercent` and `stockTechnicalScores/{sym}.atrPercent` | The same simple 14-TR mean ÷ latest close × 100, 2 dp (`technicalCalculations.js:285-310`). It uses **raw high and low with the adjusted close** (`marketDataCache.js:313-320`), and intraday it **includes today's live bar** (`compute-index-intelligence.js:186-190`) | The bench sheet's "ATR" column (`cockpit-bench.js:190`, `cockpit2bModel.js:654`) |
| c | **The Bomb tab's blend** | `GET /api/volatility/thresholds` via `getVolatilityThresholds` (`volatilityService.js:332-378`; 7-day localStorage cache, `:13-15`) | 0.7 × ATR14 % + 0.3 × ATR5 %, each the mean of **per-day TR ÷ that day's raw close**, clamped 1–15 for stocks, 2 dp (`api/volatility/thresholds.js:59`, `:84-117`, `:127-143`). Fetches 45 days of EODHD `eod` on a miss (`:207-221`) | The research modal **outside** a battle (`AssetResearchModal.jsx:436-446`, `BaggerBombTab.jsx:104-127`) |
| d | **The in-battle preview threshold** | `scoring.thresholds[sym].threshold`, else the asset's `baseATR`, else **2.5** (`researchAssetBuilder.js:6`, `:75-80`; the screen passes `useDefaultThreshold: true` at `AgentBattleScreen.jsx:3006-3016`) | `baseATR = atrPercentile × 8`, frozen at deploy (`decide.js:1259-1268`, `:1149-1162`; fenced, read only). **A percentile rank scaled to 0–8, not a % move.** | The modal's preview ladder for any **non-held** name opened in a battle (`bombView.js:31-45` → `ladder.js:160-164`) |

In a battle the modal never asks for (c). The asset always arrives with a threshold, and both fetch sites return early on `currentAsset?.threshold` (`AssetResearchModal.jsx:437-438`, `BaggerBombTab.jsx:108`, VERIFIED). A bench-row tap hands the modal a bare `{ symbol }` (`AgentBattleScreen.jsx:2808`, `:2859-2863`, VERIFIED), so (d) is what a bench, hot-bench or watchlist name's preview draws.

**4.2 Are they the same number for the same stock on the same day?** (MEASURED on the live battle. (c) was computed **offline** from each receipt's own stored bars, `stockThresholdInputs/{snapshotId}`, so no provider call was needed. Receipts measured today use bars through Nov 11.)

| Held stock | (a) `scoringPct` | (b)'s formula on the **same 15 bars** | (b) as stored now (1:01 PM ET, includes today's bar) | (c) the blend on the same bars | (d) the preview number |
|---|---|---|---|---|---|
| COST | 2.007686 | 2.00 | 1.96 | 2.12 | 0.64 |
| DLTR | 4.462661 | 4.46 | 4.29 | 4.83 | 6.64 |
| AMD | 7.744118 | 7.74 | 7.69 | 10.03 | 7.76 |
| RKLB | 7.819663 | 7.82 | 7.82 | 10.48 | 7.84 |
| JNJ | 2.585515 | 2.59 | 2.56 | 2.64 | 2.24 |
| AVGO | 5.174688 | 5.17 | 5.22 | 6.36 | 6.96 |

The recomputed (a) matched every stored `scoringPct` to 4 dp, which proves the bar read.

- **(a) vs (b), same bars:** equal to 2 dp on five of six.
  - **COST differs by 0.01:** 2.0077 rounds to 2.01, and the same-bars figure is 2.00. Its stored bars carry an adjustment factor of 0.9985–1.0 on the sessions before Oct 31 (MEASURED; a dividend, ASSUMED), and (b)'s mixed basis adjusts only the close.
  - The other five windows hold no adjustment (factor 1.0 throughout, MEASURED).
  - So the mixed raw-and-adjusted basis matters only when a dividend or split falls inside the 15-day window, and then only slightly.
- **(a) vs (b), as stored now:** within 0.17 points (DLTR, −3.9%). The gap comes from the window moving onto today's live bar, not from the formula.
- **(a) vs (c):** 0.05 to **2.66** points higher (RKLB +34%, AMD +30%, AVGO +23%), because 30% of the weight sits on the last 5 days.
- **(a) vs (d):** −1.37 (COST, a 0.08 percentile × 8 = 0.64 against a real 2.0%) to +2.18 (DLTR, 6.64 vs 4.46).
  - COST, JNJ and AVGO came in mid-battle and have no `scoring.thresholds` entry, so their (d) values are the row's own `baseATR`.
  - **No modal path draws (d) for a held measured stock.** The builder returns `threshold: null` for it (`researchAssetBuilder.js:72`), and the held ladder uses (a) (`bombView.js:36`).
  - For held rows, the (d) column is shown for comparison only.

For **bench names**, which have no receipt, the preview number (d) runs **1.7 to 2.4 points above** today's (b): CHTR 6.96 vs 5.25, ACN 6.48 vs 4.05, MOS 6.72 vs 4.89, NEM 6.40 vs 4.36, TTWO 6.08 vs 4.23, DHI 6.24 vs 4.20 (MEASURED). Hot-bench and watchlist names mostly have no thresholds entry (1/15, 1/18, 2/42), so they preview at the 2.5 default.

**Which one a candidate row should show:** (b). It is the scorer's own formula on nearly the same bars, so it is the closest provider-free stand-in for what the name's `scoringPct` would be if it came in today.

**BUILD_RULES §9 disagreement, reported and not fixed (H3):** the bench sheet shows (b) in its ATR column. The research modal opened from that same row draws its preview ladder from (d), a different quantity. Both are presented as the size of a move.

**4.3 Coverage** (MEASURED): (a) 6/6 held stocks (BTC is crypto and legacy-scored, so it has none). (b) as in F1: 100% of non-crypto names. (d) has a value for every name, because the 2.5 default always applies.

**4.4 Freshness:**
- (a) is frozen at entry, with `snapshotCapturedAt` and `sourceSession` on the receipt.
- (b) is hourly in session (F1).
- (d) is frozen at deploy.

**4.5 Access path.**
- **Held:** on the subscribed battle doc (`firestore.rules:470-472`, owner read).
- **Candidate:** (b) is one read (the rankings doc), or `ready` through the bench sheet for bench and hot-bench names on cockpit-on battles.
- **The exact candidate `scoringPct`:** no path without EODHD calls. It is measured only at swap time (`stockThresholdAdmission.js:250`).

**4.6 Verdict:**
- Held: **`ready`**.
- Candidate proxy: **`one read away`** (0 provider calls; within 0.17 points of the scorer today; on the same bars equal to 2 dp for five of six, with COST off by 0.01).
- Exact candidate number: **`no path`** (it needs a provider call by design).

---

## 5. F4 — Overlap with holdings

**5.1 Source.**
- **The Lab's scan** (`api/research/correlation-scan.js`, VERIFIED) correlates **one group** against **registry drivers**: 30 of them with `CORRELATION_EXTENDED_DRIVERS_ENABLED = true` (`featureFlags.js:1115`; 30 counted from `driverRegistry.js`, MEASURED by import). It is not candidate against holding.
- **The scan's tiers** (`:17-31`, `:194-199`):
  - *established*: |corr20| ≥ 0.20 **and** |corr60| ≥ 0.20, on 2-dp rounded values;
  - *emerging*: corr20 alone clears;
  - *weak*: everything else.
  - The floor is `SCAN_SIGNAL_FLOOR = 0.2` (`:111`). Strength bands are 0.15 / 0.40 / 0.70 (`correlationVerdict.js:28-35`).
- **The scan's cohesion number** is the average pairwise correlation **among the group's own members** (`correlationMath.js:174-197`; used at `correlation-scan.js:207-224`), not between a candidate and the book.
- **The deep dive with `driver: 'CUSTOM'`** (`api/research/correlation.js:248-268`) is the one existing request that answers "how does this one name move with my book": group = the book, driver = the candidate. Its cache key is sha1(sorted group | `CUSTOM:`symbol | lookback) (`correlationCacheKey.js:25-30`).
- **`priceHistory/{sectorId}`**, written by `compute-rankings.js:196-317` (VERIFIED), holds `days[] = { date, prices: { ticker: close } }`, newest first, capped at 200 (`:197`). These are **raw** daily closes from EODHD's bulk and `eod` rows (`:206-213`, `:240-275`). Only that cron reads it (grep, VERIFIED).

**5.2 Coverage.**
- **Lab cache:** 115 `correlationIntelligence` docs, **0 unexpired** at the read (MEASURED). Nothing current is cached for any group.
- **`priceHistory`:** 11 sector docs × 200 days, newest dated 2026-11-12 and oldest 2026-01-30. At least 61 closes for every non-crypto name: book 6/7, bench 6/6, hot bench 15/15, monitoring 18/18, saved lists 42/42 (MEASURED). That is enough for corr20 and corr60. The newest entry holds the bulk "last day" closes and is labelled with the run date (ASSUMED from `:206-213`, `:292-300`).

**5.3 Freshness.**
- **Lab results** last until the next close + 30 minutes (`correlationAssembly.js:139-161`).
- **`priceHistory`** is appended once a weekday at 11:00 UTC (`vercel.json:69-70`).

**5.4 Access path and cost.**
- **No client read:** `correlationIntelligence` and `priceHistory` have no rule in `firestore.rules`, so both are default deny (VERIFIED by grep).
- **Through the endpoint:**
  - A **deep dive** costs up to **11 EODHD `eod` fetches** on a miss: ≤10 members + 1 driver, each about 756 calendar days for the 504-day default (`correlation.js:99-101`; `fetchDriverSeries.js:1-18`, no series cache). That is about 5,500 daily bars **per candidate**. It is rate-limited to 10 a minute per IP (`correlation.js:233`).
  - A **scan** costs about 28–36 fetches: group + 30 drivers, deduped (`correlation-scan.js:99-101`).
  - A cache hit costs nothing, but the key is the exact (book, candidate) pair.
- **No stored pairwise or per-candidate result exists anywhere.**

**5.5 Verdict: `no path`.**
- Through the Lab it costs about 11 provider fetches per candidate.
- The provider-free build is a server computation of corr20/corr60 (candidate against each holding, or against the book composite) from `priceHistory`, reusing the Lab's pure math and tier rule.
- **Hazard H6:** `priceHistory` closes are unadjusted, so a split inside the window would corrupt that name's returns.

---

## 6. F5 — Game eligibility

**6.1 Source.** The bench sheet's states map to the server rule as follows (`cockpit-bench.js:154-196`, `cockpit2bModel.js:634-647`, VERIFIED):

| Sheet label | Status | Server rule | Readable client-side without a request? |
|---|---|---|---|
| **Pick ·●** | `available`, scoped to an exit call | `canComeIn(...).ok` (`swappable.js:88-105`) and, for a stock, a usable bench-brief price (`cockpit-bench.js:175`). The pick is offered only while a command is left (`cockpit2bModel.js:633`) | Yes. `canComeIn` is pure and imports nothing (`swappable.js:45`), and the client already imports it (`cockpit2bModel.js:37`, `:200`). The calls come from the subscribed `calls` subcollection (`firestore.rules:509-512`) |
| **locked until {t}** | `locked` | The bench row's `cooldownUntil` is after now (`swappable.js:76-80`, `:95`). The hot bench has no cooldown | Yes: `portfolio.bench.stocks[].cooldownUntil` on the battle doc |
| **can't come in** | `not_swappable` | `pick_is_symbol` · `pick_already_held` · `pick_not_on_bench` (only the persisted bench, bench crypto and hot bench count; **the equipped list alone does not**, `swappable.js:19-22`) · `pick_wrong_class` · the outgoing name already gone | Yes |
| **no price** | `no_price` | **A sheet-only display rule, not a server rule.** A stock with no usable `benchBriefs` price (`cockpit-bench.js:24-29`, `:175`). **Every hot-bench name is `no_price`**, and so is every stock before the battle's first cache run (`:48-55`) | One read: `voiceLayerCache/{battleId}` (owner-only) |
| **available** | browse | Not locked (`:177-182`) | Yes |

**6.2 What `canComeIn` does not cover.** "Available" is not "will execute":
- **Tournament exclusivity:** a name held by another agent in the group is filtered out of the hot bench in memory (`agent-evaluate.js:787-806`, VERIFIED) and policed by the reserve/confirm ledger (BUILD_RULES §7). Nothing on the battle doc shows it.
- **The sector-cap guardrail:** when the agent carries a `maxSectorWeight` rule, a swap is checked before execution (`agentGuardrails.js:355-372`, fenced, read only).
- **Measured admission at swap:**
  - the incoming name must be in the current rankings (`stockThresholdAdmission.js:34-38`, `:250`);
  - EODHD must return valid bars, an exchange identity and a fresh quote, or the swap is refused (`stockThresholdMeasurementProvider.js:55-72`).
- **The command budget**, shown by the sheet as "no commands left" (`cockpit2bModel.js:670`).

**6.3 Coverage** (MEASURED): locks are 4 of 6 bench rows at 1:32 PM ET. **40 of the owner's 42 saved-list names are `pick_not_on_bench`** (2 are on the swap lists).

**6.4 Freshness:** the battle doc updates live through its subscription. The lock instants are absolute.

**6.5 Verdict: `ready`.** It runs client-side with no request on any battle. The sheet's own labels are on cockpit-on battles only, and `no price` is one read away.

---

## 7. F6 — Sector

**7.1 Source.**
- **The bench sheet:** the rankings row's `sectorName`, else the bench row's `sector` (`cockpit-bench.js:186`, VERIFIED).
- **The bench row's `sector`:** stamped at deploy from the deploy-time sector map (`agentBattleService.js:164-173`; `decide.js:824-826`, both fenced, read only).
- **The bench brief:** `asset.sector || 'Unknown'` (`voice-layer-cache.js:557`).
- **The static map:** `TICKER_TO_SECTOR` plus `STOCK_UNIVERSE[id].name` (`api/_utils/rankingConfig.js:453-466`, VERIFIED). It is **already imported by client code** (`src/components/Forge/Watchlist/groupWatchlistTickers.js:22-25`, `:53`).

**7.2 Coverage** (MEASURED):
- **Rankings `sectorName`:** 100% of non-crypto names in every group.
- **The static map:** agrees with the rankings `sectorName` on **228 of 228 rows**, with the same 11 names.
- **The bench row's own `sector`:** present on only **2 of 6** live bench rows. The sheet falls back to rankings, so the display is unaffected. The likely cause is that swapped-out names return to the bench without the field (ASSUMED; H5).
- **Crypto:** `'Crypto'` on the bench crypto row.

**7.3 Freshness:** static. The rankings `sectorName` comes from `peerRankings`, else the static name (`compute-index-intelligence.js:1310`).

**7.4 Access path:** zero reads through the static import. The same label is also on the rankings read (F1).

**7.5 Verdict: `ready`.**

---

## 8. F7 — The bench and the watchlist as groups

**8.1 Source.**

| Group | Field | Row shape (MEASURED key lists) | How the screen gets it |
|---|---|---|---|
| Book | `portfolio.{star,core,support}[]` | `symbol, name, isCrypto, baseATR, positionId, slotVersion, stockThresholdReceipt, swapPrice, swappedInAt, swappedInDay`, plus price, previous close and points from the client's enrichment | Subscribed battle doc (`useAgentBattle`; `firestore.rules:470-472`) |
| Persisted bench | `portfolio.bench.stocks[]`, `.crypto` | `symbol, name, sector, baseATR, isCrypto` (+ `cooldownUntil` when locked) | Same doc |
| Hot bench | `watchlist.hotBench[]` | bare strings. Rebuilt from the rankings when a new trading day or a fresher rankings doc arrives: the top 15 by `baggerBombFit` outside the BaggerBomb archetype menu, equipped tickers unioned back up to 20 (`agent-evaluate.js:1586-1660`, VERIFIED). Last rebuilt 1:01 PM ET | Same doc |
| Monitoring | `watchlist.monitoring[]` | bare strings (the next 18) | Same doc |
| Equipped list | `agentContext.equippedWatchlist` | `{ watchlistId, name, tickers: string[] }`, **frozen at deploy** (`watchlistEquip.js:186-192`; `decide.js:381-390`, `:969-971`) | Same doc |
| Owner's saved lists | `watchlists/{id}` | `tickers[]` (objects with `symbol`), `name`, `status` (`committed` / `draft`) | **Not read by the battle screen.** One owner-scoped query (`firestore.rules:1209-1212`) |
| Dashboard watchlist | `localStorage` key `mc_watchlist_{uid}` | up to 30 strings (`src/services/watchlistService.js:4-36`, VERIFIED) | Device-local, never on the server, so not countable here |
| The bench sheet's row (endpoint) | — | `symbol, name, sector, rank, price, changePct, atrPct, status, lockedUntil` (`cockpit-bench.js:183-193`), plus the "On {Agent}'s list" marker from the newest evaluation's `candidates` and the Monitoring record (`cockpit2bModel.js:571-577`) and the agent's own note | `useCockpitBench` when the sheet opens, on cockpit-on battles |

**Two different "benches" exist in the code** (VERIFIED):
- the **bench sheet** lists the swap lists: persisted bench, bench crypto and hot bench (`swappable.js:131-140`);
- the **Bench pane** and the research universe add the equipped list (`battleUniverse.js:65-83`; `universePlace` names hot-bench and equipped names `'watchlist'`, `:137-147`).

They match on the live battle only because nothing is equipped (22 = 22, MEASURED). On `E0Tv…` they would differ by the 8 equipped names.

**8.2 Coverage, freshness:** §1 and the sections above.

**8.3 Verdict.**
- The battle's own lists: **`ready`**.
- The owner's saved lists: **`one read away`**.
- The dashboard list: device-local only.
- **Which group "the watchlist" means is a founder question (Q1).**

---

## 9. F8 — The research record

**9.1 Source.**
- **Store:** `researchWork/{id}`, written server-only through `api/_utils/researchRecords/store.js` and validated by `model.js` (VERIFIED). Schema version 1 (`model.js:81`). Owner-readable (`firestore.rules:1314`).
- **What it cannot hold today:**
  - **Origins** are closed to `signaldrop, theme, screener, analysis, manual, shared_research` (`src/constants/researchRecords.js:20`).
  - **Host collections and id prefixes** are closed to `watchlistSessions, researchSessions, analysisSessions, watchlists, sharedResearchSessions` (`model.js:95-104`). **There is no battle host**, and the id is derived from the host (`model.js:148-153`).
  - **Extension fields** are on `shared_research` records only: `question` ≤ 500 characters, `findings[]` ≤ 100 with a closed `kind` list (11 kinds, `model.js:633-637`) and a closed `source.recordKind` list (16, `findingRecordKinds.js:17-21`; it has `stockRankings` and `call` but **no `agentBattles`, `voiceLayerCache` or `intradaySnapshots`**), `summaryRevisions[]`, and `symbols[]` with a closed outcome list (`eligible, rejected, data_missing, cancelled, failed`).
  - **There is no field for a group selector, conditions, a sort order, or a ranked row with its reason.** Every closed list "grows only with a new schema version" (`model.js:60-62`).
- **What the Film Room reads:**
  - **No `researchWork`** (grep of `src/components/FilmRoom`, `FilmRoomScreen.jsx` and `api/_utils/filmTape`, VERIFIED).
  - Its chat shows only `chatExchanges` with `mode === 'review'` (`FilmRoomChat.jsx:145-153`).
  - The tape reads `chatExchanges` only for directive cards (`tapeAssemble.js:648-652`).
  - So a battle-scoped `research` exchange, the "Show it" pattern (`RESEARCH_MESSAGE_TYPE = 'research'`, `decisionRecord.js:527`; `SHOW_IT_ENABLED = false`, `featureFlags.js:2448`), would also not appear in the Film Room today.

**9.2 Coverage** (MEASURED):
- **`researchWork`: 0 documents** (0 for every origin, 0 at schema version 1). **`sharedResearchSessions`: 0.**
- **Why zero:** the writers are on. `HYPOTHESIS_RECORDS_ENABLED = true` since 2026-10-09 (`featureFlags.js:3208`), owner-gated through the cockpit allowlist (`:3169-3176`). But no host session has been created since then: `researchSessions` newest 2026-06-23, `analysisSessions` newest 2026-08-08, `watchlistSessions` 5 docs with no `createdAt`. No session or list carries a `researchWorkId`, and the owner's newest saved list dates from 2026-07-01 (all MEASURED).

**9.3 Freshness:** not applicable.

**9.4 Access path.** Storing a battle question with its group, conditions, ordering and result needs:
- a new origin and host (with an id prefix);
- new fields for selector, conditions, ordering and ranked rows;
- new `recordKind`s for its sources;
- a schema version 2, and a Film Room reader.

The alternative is the battle doc's own `chatExchanges`, but the Film Room does not render those either (Q4).

**9.5 Verdict: `no path`** (needs a schema version).

---

## 10. Questions that stopped on a provider call

- **S1. What EODHD's `real-time` `change_p` means before the open.** The voice-layer cache runs pre-market (`voice-layer-cache.js:853`). Whether a pre-market bench brief's change is yesterday's move or 0 can be answered only by calling EODHD. ASSUMED: yesterday's move.
- **S2. Whether EODHD's `eod` answer during the session includes today's partial bar.** If it does, the live Bomb-tab blend (F3 (c)) would use a window one day later than the receipts. The comparison in §4.2 used the receipts' own stored bars instead, so the comparison itself did **not** stop.

---

## 11. Founder questions

- **Q1. Which "watchlist" does the selector mean?** The candidates on the live battle:
  - (a) the owner's saved lists (`watchlists/*`): 8 lists, 42 names, 26 committed;
  - (b) the equipped-list snapshot on the battle: 0 names here, 8–9 on two ended battles;
  - (c) the agent's hot bench (`watchlist.hotBench`): 15;
  - (d) the monitoring list: 18;
  - (e) the device-local dashboard list.
- **Q2.** For today's move on hot-bench and watchlist names, should the first version include the server read of `intradaySnapshots/latest`? That is a build, with 0 provider calls. Or should it ship the move for the book and persisted bench only?
- **Q3.** Should a candidate row's "one rung" be the rankings ATR % (the scorer's formula)? And should the in-battle preview's percentile × 8 / 2.5 (H3) be put to a separate task?
- **Q4.** Where should a battle question be stored: a new `researchWork` schema version (origin, battle host, selector/conditions/ordering/rows), or the battle doc's `chatExchanges` (the Show-it shape)? And should the Film Room gain a reader for whichever it is?
- **Q5.** A League tournament battle never has a persisted bench; its hot bench is filled by the cron during play (§1). Should the first version cover League battles with the hot bench and saved lists only, or be agent-battle-only?

---

## 12. Found outside scope (reported for separate tasking, not fixed)

- **H1.** The client price fallback reads as a flat 0.00% on the battle screen (`eodhdAPI.js:196-231`; `AgentBattleScreen.jsx:1516-1519`).
- **H2.** `price.change_p || 0` in the portfolio brief (`voice-layer-cache.js:154`) and the price route (`prices.js:133`): a missing move is a 0.
- **H3.** In a battle, the research modal draws a non-held name's preview ladder from `atrPercentile × 8` (or 2.5), while the bench sheet beside it shows the ATR %. These are different quantities (BUILD_RULES §9).
- **H4.** Every hot-bench name is `no price` on the bench sheet (already a founder question in `cockpit-bench.js:48-55`). `intradaySnapshots/latest` would answer it with 0 provider calls.
- **H5.** 4 of 6 live bench rows carry no `sector`. The display is unaffected because of the rankings fallback.
- **H6.** `priceHistory` stores unadjusted closes. That matters to any return or correlation built on it.

---

## 13. Method and evidence

- **Fenced files** (BUILD_RULES §1): read, none edited.
  - Read: `api/agent/decide.js`, `api/_utils/agentBattleService.js`, `api/_utils/agentGuardrails.js`.
  - Seen only as grep hits: `agentScoring.js`, `agentRiskManager.js`, `agentSwapExecution.js`, `agentEvalPromptAssembly.js`.
- **Census scripts** (scratchpad, copied beside this report's Documents copy, each with its output JSON):
  - `census.cjs`: the live battle; with `CENSUS_RECENT=1`, the ended battles;
  - `keys.cjs`: field-name listings only;
  - `census3.cjs`: watchlist overlap, `intradaySnapshots`, `priceHistory`, the F3 bars, research hosts, the League battle;
  - `snapage.cjs` and `stale.cjs`: quote ages;
  - `factors.cjs`: the F3 receipts' adjustment factors;
  - `sectors.mjs`: sector agreement.
  - Each passed the write-verb grep shown in §0 before its run.
  - `stale.cjs` and `sectors.mjs` were first run with printed output, then re-run to save their JSON. The results were identical.
- **Read instants:** census 1:32:08 PM ET, ended battles 1:33:18 PM, pass 3 1:43:23 PM, quote ages 1:44 PM, factors and the re-runs shortly after (Node `Intl`, `America/New_York`).
- **The two code-vs-prompt disagreements** are in §0.

---

## 14. The eight fields

| # | Field | Verdict | Gate | Provider cost |
|---|---|---|---|---|
| F1 | Technical rank | **one read away** | none (public doc) | 0 |
| F2 | Today's move | **split:** book `ready` · persisted bench `one read away` · hot bench, monitoring, equipped, saved lists `no path` | bench cache owner-only; sheet on cockpit-on battles | 0 for book and bench. The build that closes the rest (`intradaySnapshots`) also adds 0. Widening the poll would add EODHD calls |
| F3 | One rung's size | **held `ready` · candidate proxy (ATR %) `one read away` · exact candidate `no path`** | none | 0 (proxy); the exact number costs EODHD at swap |
| F4 | Overlap with holdings | **no path** | — | Lab ≈ 11 fetches a candidate; a `priceHistory` build 0 |
| F5 | Game eligibility | **ready** (`no price`: one read away) | sheet labels cockpit-on only | 0 |
| F6 | Sector | **ready** | none | 0 |
| F7 | Bench and watchlist groups | **bench lists `ready` · saved lists `one read away`** | owner read | 0 |
| F8 | Research record | **no path** (schema version) | — | — |

## 15. What the first version can offer from `ready` and `one read away` alone

From the subscribed battle doc plus two reads it does not make yet, both free of provider calls (the public `stockRankings` doc and the owner-only `voiceLayerCache/{battleId}`), the first version can offer a **bench/watchlist selector** over the battle's own lists (persisted bench, hot bench and monitoring, plus the owner's saved lists through one query). It can **sort by technical rank**, universe-wide or within the sector, for every non-crypto name, **filter by sector** from the static map, and **filter by eligibility** with the bench sheet's own rule (locked, can't come in, available). "Available" still carries the §6.2 caveats, and 40 of 42 saved-list names will read "can't come in". It can show **an ATR % per row as "one rung"**, which is the scorer's formula. **Today's move, in either direction, and "up or down today"** can be offered only for the held book (the poll, with no quote time) and the persisted bench (the 15-minute cache plus about 19 minutes of vendor delay, with no per-quote time): 13–14 of the live battle's ~70 names, with fallback-priced names dropped (H1). For the hot bench and the watchlists, the move waits on a build that reads `intradaySnapshots/latest` server-side, with no new provider call. **Overlap lowest-first** is not available without a build; its provider-free route is `priceHistory`.
