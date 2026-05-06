# Crypto Universe Hygiene Audit (Read-Only Discovery)

**Branch:** `claude/audit-crypto-universe-RBEos` (cut from `origin/main` @ `04bf07e`)
**Scope:** Read-only investigation. No code changes. Single pass.
**Active universe:** `{ADA, BNB, BTC, DOGE, ETH, SOL, XRP}` (7 symbols)

---

## Q1 — Canonical Crypto Universe Definition

### 1.1 / 1.2 — Canonical sources (FOUND)

There are **two intentionally-mirrored canonical definitions** of the 7-symbol universe.

**API-side (server / Vercel functions):**
- `api/_utils/agentCryptoAssets.js:4-12` — `CRYPTO_ASSETS` array (7 entries)
- `api/_utils/agentCryptoAssets.js:14` — `VALID_CRYPTO_SYMBOLS = CRYPTO_ASSETS.map(c => c.symbol)`
- `api/_utils/agentCryptoAssets.js:16-17` — `getCryptoBySymbol()` lookup

**Client-side (Vite / browser):**
- `src/constants/cryptoPool.js:6-14` — `BAGGERBOMB_CRYPTO_POOL` (7 entries)
- `src/constants/cryptoPool.js:17-19` — `CRYPTO_POOL_SYMBOLS` (Set derived)
- `src/constants/cryptoPool.js:28-34` — `CASH_POSITION` (slot placeholder)

The duplicate is explicit: `agentCryptoAssets.js:2` says "Mirrors `src/constants/cryptoPool.js` — kept separate since API can't import from src/." The two lists are equal in symbols and `baseATR` values.

**Symbols in both lists (identical):** BTC, ETH, SOL, XRP, DOGE, ADA, BNB.

### 1.2 — Consumers of the canonical lists

**API-side `VALID_CRYPTO_SYMBOLS` / `CRYPTO_ASSETS` / `getCryptoBySymbol`:**
- `api/_utils/marketDataCache.js:21,79` — used by `isCryptoSymbol()` to detect crypto and route fetches to `*-USD.CC` suffix
- `api/agent/decide.js:5` (imports all three) — used at:
  - `decide.js:153-155` — building Haiku's crypto pick list in the portfolio prompt
  - `decide.js:357` — sector map (crypto sector label)
  - `decide.js:368` — passed to `generateCPUOpponent()`
  - `decide.js:543-548` — **hard validation** of `support_crypto` and `bench_crypto` in `validatePortfolio()`
  - `decide.js:627` — `enrichPortfolio()` resolves crypto tickers to full asset objects

**Client-side `BAGGERBOMB_CRYPTO_POOL` / `CRYPTO_POOL_SYMBOLS` / `CASH_POSITION`:**
- `src/components/BaggerBomb/SwapMarketModal.jsx:9`
- `src/components/BaggerBomb/SlotBasedBuilder.jsx:10`
- `src/services/swapServiceV4.js:19` (imports `CRYPTO_POOL_SYMBOLS`, `CASH_POSITION`)
- `src/services/freeAgentRotationService.js:6` (imports `CRYPTO_POOL_SYMBOLS` — used to *exclude* crypto from V5 free-agent stock pool, see `freeAgentRotationService.js:43-47`)
- `src/screens/BaggerBombBattleViewConnectedV4.jsx:15`
- `src/screens/BaggerBombTrainingBattleViewV4.jsx:28,173,179`

### 1.3 — Hardcoded crypto-symbol literals (NOT importing from canonical)

These are scattered references that re-state crypto symbols inline rather than importing the canonical list. Several of them are **wider than the 7-symbol universe**.

| File:line | Literal contents | Universe match? |
|---|---|---|
| `src/firebase/firebaseService.js:2346` | `['BTC','ETH','SOL','ADA','DOGE','XRP','AVAX','DOT','MATIC','LINK']` | **NO — 4 extras** (AVAX, DOT, MATIC, LINK) |
| `src/App.jsx:6529` | `['BTC','ETH','SOL','XRP','DOGE','ADA','BNB']` | Yes (matches universe, hardcoded literal) |
| `src/services/sessionScoringService.js:114-143` | `CRYPTO_SYMBOLS` Set, ~80 symbols | **NO — wide routing list** |
| `api/cron/compute-daily-baggerbomb-levels.js:232-252` | `CRYPTO_SYMBOLS` Set, ~80 symbols | **NO — wide routing list** (duplicate of above) |
| `src/services/draftAssets.js:139,167,195` | `STEADY_CRYPTO`/`RISKY_CRYPTO`/`DEFENSIVE_CRYPTO` (~75 symbols total) | **NO — Snake Draft pools** |
| `src/data/assets.js:88-137` | `CRYPTO` array (32 symbols) | **NO — generic crypto catalog** |
| `api/volatility/thresholds.js:29-56` | `CRYPTO_DEFAULTS` map (~70 symbols) | **NO — public endpoint defaults** |
| `api/crypto/metrics.js:212-218,253-254,264-270` | ATH map, market-cap rank map, name map | **NO — many extras (USDT, USDC, AVAX…)** |
| `api/ai-advisor.js:32` | Inline prompt string `"BTC, ETH, BNB, SOL, XRP, ADA, DOGE, AVAX, DOT, MATIC, LINK, UNI, ATOM, LTC"` | **NO — 7 extras in prompt** |
| `src/services/baggerBombRecommendationEngine.js:169` | `{ symbol: 'DOT', name: 'Polkadot', ... }` (inline list) | **NO — DOT** |

### 1.4 — Required spot checks

| File | Crypto definition? | Notes |
|---|---|---|
| `api/_utils/rankingConfig.js` | **None** — only stocks. `STOCK_UNIVERSE` lists 11 sectors / 239 tickers (lines 15-82). | No crypto in the ranking pipeline by design. |
| `api/_utils/marketDataCache.js` | Imports `VALID_CRYPTO_SYMBOLS`. `isCryptoSymbol()` (line 76-80) detects crypto for routing. | No literal crypto list defined here. |
| `api/cron/compute-index-intelligence.js` | **None.** Runs over `ALL_TICKERS` (rankingConfig.js). | No crypto handling at all. |
| `api/_utils/agentToolSchema.js` | **No constraint.** `support_crypto` / `bench_crypto` are typed `string` only — no `enum`. | Constraint lives in `decide.js:543-548` validator. |
| Other `api/_utils/` constants | `agentCryptoAssets.js` is the single API-side canonical source. No other constants files define crypto universes. | — |

---

## Q2 — Crypto Filtering Enforcement at Each Entry Point

### 2.1 — EODHD market data fetches (`api/_utils/marketDataCache.js`)

**Crypto-aware routing functions:**
- `isCryptoSymbol(symbol)` at `marketDataCache.js:76-80` — returns true for `*-USD.CC`, `*.CC`, or any symbol in `VALID_CRYPTO_SYMBOLS`. **Universe-aware** but only for the bare-symbol case; suffix-bearing inputs from any caller are also recognised.
- `formatEODHDSymbol(clean, isCrypto)` at `marketDataCache.js:86-90` — appends `-USD.CC` or `.US`.
- `getStockAnalysisData(symbol, options)` at `marketDataCache.js:427-...` — **no universe filter**. Whatever symbol the caller passes in is fetched (line 431) and written to `marketDataCache/{symbol}_{field}` (line 188).
- `fetchIntradayCandles(symbol, options)` at `marketDataCache.js:630-660` — **no universe filter**. Same routing, no Firestore write (memory cache only via `serverCache`).
- `fetchIntradayBatch(symbols, options)` at `marketDataCache.js:670-700` — same.
- `prefetchBatch(symbols)` at `marketDataCache.js:713-734` — calls `getStockAnalysisData` per symbol; no filter.

**Symbol-source logic — what determines which crypto gets fetched?**
The cache layer is **callsite-driven**: any caller that passes a crypto symbol fetches it. The 7-symbol universe is enforced upstream (battle creation), not at the cache layer.

Callers that pass crypto symbols today (search via `grep -rn "getStockAnalysisData"`):
- `api/agent/decide.js:391` — symbols come from `enrichedPortfolio` + CPU portfolio, both validated against `VALID_CRYPTO_SYMBOLS` upstream.
- `api/agent/debate.js:95` — `targetSymbol` is required to exist in the battle's portfolio (validated `debate.js:85-89`).
- `api/cron/agent-evaluate.js:230,430,742,1196` — symbols come from `agentBattles` portfolio + watchlist. Portfolio crypto is universe-constrained at creation; watchlist is built from stock-only `stockRankings`.
- `api/cron/agent-batch-review.js:97` — `veto.symbolIn` from a swap proposal (already-stored battle data; same constraint).
- `api/_utils/seasonEvalContext.js:41` — season tickers (no crypto in season eval).

**Conclusion:** The cache layer fetches whatever is asked for. Universe enforcement is upstream, primarily at `decide.js:543-548`.

### 2.2 — Battle creation crypto handling (`api/agent/decide.js`)

**Tool schema constraint (PORTFOLIO_TOOL):**
`api/_utils/agentToolSchema.js:75-90` declares `support_crypto: { type: 'string' }` and `bench_crypto: { type: 'string' }` — **no `enum` constraint** on either field. The schema does not constrain crypto picks to the universe.

**Validator constraint (hard):**
`api/agent/decide.js:543-548`:
```js
if (result.support_crypto && !VALID_CRYPTO_SYMBOLS.includes(result.support_crypto)) {
  errors.push(`Invalid crypto: ${result.support_crypto}`);
}
if (result.bench_crypto && !VALID_CRYPTO_SYMBOLS.includes(result.bench_crypto)) {
  errors.push(`Invalid crypto: ${result.bench_crypto}`);
}
```
On failure, `decide.js:188-218` retries Haiku once with the error feedback. If the retry also fails, `buildFallbackPortfolio()` (`decide.js:563-607`) substitutes deterministic picks `support_crypto: 'BTC'`, `bench_crypto: 'ETH'`.

**Where crypto enters the portfolio object:**
`enrichPortfolio()` at `decide.js:609-644` slots:
- `support_crypto` → into `portfolio.support[]` (alongside 2 support stocks) — line 637
- `bench_crypto` → into `portfolio.bench.crypto` — line 641

Net: **support tier in V4 always holds 2 stocks + 1 crypto** (3 entries).

**CPU opponent crypto (`cpuOpponentGenerator.js`):** receives `CRYPTO_ASSETS` directly from `decide.js:368`, so CPU picks are universe-constrained by construction.

### 2.3 — Index intelligence crypto computation

**File:** `api/cron/compute-index-intelligence.js`
**Universe input:** `ALL_TICKERS` from `rankingConfig.js:85` — only stocks (~239 tickers).
**Crypto handling:** **None.** A `grep -n "crypto\|CRYPTO\|.CC\|BTC\|ETH"` over both `compute-index-intelligence.js` and `indexIntelligence.js` returns zero hits.

**Writes:**
- `stockTechnicalScores/{symbol}` — line 666, written for every entry in `ALL_TICKERS`. Stock-only by construction.
- `indexIntelligence/stockRankings` (`.stocks[]` array) — line 850, built from `stockScores` (which is `ALL_TICKERS`-derived). Stock-only.

So `stockTechnicalScores` and the rankings doc cannot contain crypto symbols **from this cron**.

### 2.4 — Voice-layer-cache crypto handling

**File:** `api/cron/voice-layer-cache.js`

**`buildPortfolioBriefs()` (line 105-241):**
- Iterates `['star', 'core', 'support']` tiers (line 109). Because V4 puts the support_crypto into `portfolio.support[]`, the loop sees that crypto entry.
- Line 117: `if (!price) return;` — drops the entry if `priceMap[symbol]` is missing.
- `priceMap` is populated by `fetchBulkPrices()` (line 31-84), which appends `.US` to every symbol (line 43). EODHD returns nothing for `BTC.US`, so the support_crypto is **silently dropped from `portfolioBriefs[]`**. (Adjacent observation; not a universe-drift issue.)

**`buildBenchBriefs()` (line 253-369):**
- Explicitly iterates `bench.stocks` AND `bench.crypto` (line 258-261).
- Tags crypto entries with `assetClass: 'crypto'` (line 260) and emits a degraded brief with `price: null` when EODHD lookup fails (line 250-253 comment + line 273 `priceValue = price ? ... : null`).
- Crypto-aware sector default at line 340: `sector: ... 'Crypto' : 'Unknown'`.

**`buildScoutAlerts()` (line 374-...):**
- Operates on `battle.watchlist` entries.
- Watchlist is built in `decide.js:266-272` from stockUniverse (stock-only) and refreshed in `agent-evaluate.js:387-411` from `stockRankingsArray` (stock-only).
- **No crypto enters scoutAlerts** by construction.

**Tech-score lookup (line 554):**
`techScoreRefs = symbolArray.map(s => db.collection('stockTechnicalScores').doc(s))` — `symbolArray` is `[...allSymbols]`. Comments on lines 516-518 and 541 explicitly state bench crypto is excluded from this fetch (because `stockTechnicalScores` docs don't exist for crypto). The exclusion is implemented by **not adding bench crypto to `allSymbols`** (line 542-547 only adds bench stocks).

However, **support crypto IS added to `allSymbols`** (line 526-533 does not filter out crypto in support tier). So the `getAll()` fetch will include a `stockTechnicalScores/BTC` lookup that returns no doc — graceful no-op, but a wasted Firestore read. (Adjacent observation.)

---

## Q3 — Eval Cron's Crypto Symbol Sources

**File:** `api/cron/agent-evaluate.js`

### 3.1 — `portfolioSymbols` and `benchSymbols` construction

`agent-evaluate.js:210-223`:
```js
const flatPortfolio = flattenPortfolioServer(battle.portfolio);
const portfolioSymbols = flatPortfolio.map(a => a.symbol).filter(Boolean);
const benchAssets = [
  ...(battle.portfolio?.bench?.stocks || []),
  ...(battle.portfolio?.bench?.crypto ? [battle.portfolio.bench.crypto] : []),
].filter(Boolean);
const benchSymbols = benchAssets.map(a => a.symbol).filter(Boolean);
const macroSymbols = ['SPY', 'QQQ', 'BTC-USD.CC'];
let hotBenchSymbols = battle.watchlist?.hotBench || [];
const cpuPortfolioFlat = flattenPortfolioServer(battle.opponent?.portfolio);
const cpuSymbols = cpuPortfolioFlat.map(a => a.symbol).filter(Boolean);
const allSymbols = [...new Set([...portfolioSymbols, ...benchSymbols, ...hotBenchSymbols, ...cpuSymbols, ...macroSymbols])];
```

Notes:
- `flattenPortfolioServer` (`agentScoring.js:43-58`) iterates star/core/support — returns the support_crypto entry along with stocks.
- `portfolioSymbols` therefore contains the support_crypto symbol.
- `benchSymbols` explicitly includes the bench crypto.
- `macroSymbols` always includes the literal `'BTC-USD.CC'` regardless of universe — used as a macro benchmark, not as a portfolio holding (`agent-evaluate.js:244` reads `prices['BTC-USD.CC']?.changePercent` for `macroPrices.BTC`).
- Universe constraint on portfolio + bench crypto inherits from `decide.js:543-548` (battles can only be created with universe-symbol crypto).
- `hotBenchSymbols` is rebuilt daily from `stockRankingsArray` which is stock-only — cannot introduce crypto.

### 3.2 — `fetchIntradayBatch` invocation

`agent-evaluate.js:355`:
```js
fetchIntradayBatch(portfolioSymbols, { interval: '5m' })
```
Only `portfolioSymbols` (not `benchSymbols`) is passed. The support_crypto symbol IS included → routed to `BTC-USD.CC` (or whichever) by `marketDataCache.js:634-635`. EODHD intraday DOES return data for crypto, so VWAP / 5m-SMA20 are computed for the support_crypto.

Bench crypto is **not** passed to intraday fetch.

### 3.3 — Tech-score lookup

`agent-evaluate.js:351`:
```js
const allTechSymbols = [...new Set([...portfolioSymbols, ...benchSymbols])];
const techRefs = allTechSymbols.map(s => db.collection('stockTechnicalScores').doc(s));
```
This includes BOTH the support_crypto AND the bench_crypto symbols → both produce `stockTechnicalScores/BTC` (etc.) lookups that **return no document** (graceful no-op). Cost: 2 wasted Firestore reads per agent-eval cycle per active battle.

### 3.4 — Other crypto references in `agent-evaluate.js`

- `agent-evaluate.js:1184` — `findBenchAsset()` helper supports `bench.crypto` lookup by symbol. Universe-constrained (only sees what's stored on the battle).
- News fetch (`agent-evaluate.js:712-713`) calls `fetchRecentNews(db, allNewsTickers)` where `allNewsTickers` includes portfolio + bench + hotBench. Crypto symbols hit `fantasyTimesStories where tickers array-contains <crypto>` — typically empty result, no error.

**Q3 verdict:** Eval cron only sees universe-constrained crypto symbols (because portfolio + bench storage is universe-constrained at creation time). No off-universe crypto can enter eval via portfolio, bench, hotBench, or watchlist refresh. The macro `BTC-USD.CC` is hardcoded and intentional.

---

## Q4 — Stale Firestore Data Inspection

**Sandbox limitation:** This environment cannot reach Firestore. There is no `firebase` or `gcloud` CLI installed (`which firebase gcloud` returned empty), and no service-account credentials are exposed to the sandbox. The findings below are derived purely from code analysis; the user must run the listed commands to verify empirical state.

### 4.1 — Collections that potentially hold crypto-shaped data

| Collection | Source-of-truth writer | Crypto allowed? |
|---|---|---|
| `stockTechnicalScores/{symbol}` | `compute-index-intelligence.js:666` | **No** — written only for `ALL_TICKERS` (stocks). Any crypto entry is stale/foreign. |
| `indexIntelligence/stockRankings` (`.stocks[]`) | `compute-index-intelligence.js:850` | **No** — built from `stockScores` (stock-only). |
| `marketDataCache/{symbol}_{field}` | `marketDataCache.js:188` (any caller of `getStockAnalysisData`) | **Yes, by design** — every symbol fetched gets a doc. Can contain off-universe crypto if any caller has fetched it (e.g., during scratched game-mode usage). |
| `voiceLayerCache/{battleId}` | `voice-layer-cache.js:602` | Crypto bench appears as a `benchBriefs[]` entry tagged `assetClass: 'crypto'`. Universe-constrained via battle data. |
| `agentBattles/{id}` | `agent/decide.js` via `agentBattleService.createAgentBattle()` | Universe-constrained by `validatePortfolio` (decide.js:543-548). |
| `battles/{id}` | client-side BaggerBomb V4/V5 (`firebaseService.js`, `App.jsx`) | Crypto comes from `BAGGERBOMB_CRYPTO_POOL` (cryptoPool.js, 7 symbols). |
| `trainingBattles/{id}` | `firebaseService.js:2465` (`createTrainingBattle`) | **CPU portfolio uses the wider 10-symbol literal at `firebaseService.js:2346` (includes AVAX, DOT, MATIC, LINK).** See drift summary below. |
| `drafts/{id}` | client-side Snake Draft (`draftService.js`, `freeAgencyService.js`) | Crypto comes from `STEADY_CRYPTO`/`RISKY_CRYPTO`/`DEFENSIVE_CRYPTO` (`draftAssets.js`) — wide pool, ~75 symbols. |

### 4.2 / 4.3 — Firestore inspection commands (run these manually)

> **Note:** These commands assume `firebase-admin` credentials in your environment. The collection IDs and field paths come from the writer locations cited above. Adjust project ID as needed.

#### Find non-universe crypto in `stockTechnicalScores`
```bash
# Should return ZERO docs. Any crypto symbol present here is stale.
firebase firestore:query stockTechnicalScores \
  --project <project-id> \
  --where '__name__,in,["BTC","ETH","SOL","XRP","DOGE","ADA","BNB","AVAX","DOT","MATIC","LINK","UNI","ATOM","LTC","BCH","NEAR","APT","ARB","OP","SHIB","PEPE"]'
```
Or via Firebase console: navigate to `stockTechnicalScores`, sort by document ID, scan for any non-`A-Z`-stock symbol.

#### Inspect `indexIntelligence/stockRankings` for crypto entries
```bash
# Read the rankings doc and look for any .stocks[].symbol that is a crypto ticker.
firebase firestore:get indexIntelligence/stockRankings --project <project-id> \
  | jq '.stocks[] | select(.symbol | IN("BTC","ETH","SOL","XRP","DOGE","ADA","BNB","AVAX","DOT","MATIC","LINK","UNI","ATOM","LTC","BCH","NEAR","APT","ARB","OP","SHIB","PEPE","TRX","TON","XLM"))'
```
**Expected:** empty output (rankings is stock-only by design).

#### Inspect `marketDataCache` for off-universe crypto
The doc IDs use the form `{SYMBOL}_{daily|fundamentals|news|technicals|earnings}`. To find crypto entries:
```bash
# List all docs and filter by ID prefix matching off-universe crypto symbols
firebase firestore:query marketDataCache \
  --project <project-id> \
  --order-by __name__ --limit 5000 \
  | grep -E "^(AVAX|DOT|MATIC|LINK|UNI|ATOM|LTC|BCH|NEAR|APT|ARB|OP|SHIB|PEPE|TRX|TON|XLM|ALGO|FIL|AAVE|MKR|SAND|MANA|RNDR|RENDER|FET|TAO|USDT|USDC|FTM|EGLD|RUNE|KAVA|CELO|PENDLE|DYDX|CFX|SSV|MINA|STORJ|HIGH|TWT|WOO|OSMO|JOE|SEI|SUI|INJ|FLOKI|BONK|WIF|ASI|AGIX|AKT|1INCH|SUSHI|CAKE|DAI|FRAX|TUSD|LDO|RPL|FXS|CBETH|GRT|BAND|API3|CRO|KCS|OKB|LEO|ZEC|DASH|WBTC|ENS|QNT|THETA|HNT|AR|ICP|HBAR|XMR|ETC)_"
```
For each match returned, check the `cachedAt` timestamp — old entries (>24h) are stale and not being refreshed.

Universe-symbol crypto entries that ARE expected to exist (refreshed by `agent-evaluate.js`, `decide.js`, `voice-layer-cache.js`): doc IDs starting with `BTC_`, `ETH_`, `SOL_`, `ADA_`, `DOGE_`, `XRP_`, `BNB_`.

#### Inspect `voiceLayerCache` for crypto symbols
```bash
# Check each cached doc's portfolioBriefs / benchBriefs for non-universe crypto symbols.
# Universe-constrained at write time, but worth a sweep:
firebase firestore:query voiceLayerCache --project <project-id> --limit 500 \
  | jq '.portfolioBriefs[]?, .benchBriefs[]? | select(.assetClass == "crypto") | .symbol'
```
**Expected:** only symbols from `{BTC, ETH, SOL, ADA, DOGE, XRP, BNB}`.

#### Inspect `trainingBattles` for non-universe crypto in CPU portfolio
```bash
# CPU portfolio is generated by firebaseService.js:2344-2359 with the 10-symbol list.
firebase firestore:query trainingBattles --project <project-id> --limit 500 \
  | jq '.opponent.portfolio[]?.symbol' | sort -u
```
**Expected drift:** `AVAX`, `DOT`, `MATIC`, `LINK` will appear if any training battle was created with `assetType === 'crypto'` (see `firebaseService.js:2412`).

#### Inspect `drafts` for non-universe crypto in Snake Draft picks
```bash
firebase firestore:query drafts --project <project-id> \
  --where 'status,==,battle' --limit 500 \
  | jq '.players[]?.picks[]?' | sort -u
```
**Expected drift:** any of the ~75 symbols from `draftAssets.js` may appear in active Snake Draft battles.

#### Inspect `agentBattles` (sanity check — should be clean)
```bash
firebase firestore:query agentBattles --project <project-id> \
  --where 'status,==,active' --limit 500 \
  | jq '.portfolio.support[]?.symbol, .portfolio.bench.crypto?.symbol' \
  | sort -u
```
**Expected:** only `{BTC, ETH, SOL, ADA, DOGE, XRP, BNB}` plus stock symbols in support.

### 4.4 — Findings template (fill in after running commands)

```
| Collection                  | Universe symbols found | Off-universe symbols found | Last update timestamp range |
|-----------------------------|------------------------|----------------------------|-----------------------------|
| stockTechnicalScores        | (n/a — stock-only)     | <fill in>                  | <fill in>                   |
| indexIntelligence/stockRankings | (n/a — stock-only) | <fill in>                  | <fill in>                   |
| marketDataCache             | <fill in>              | <fill in>                  | <fill in>                   |
| voiceLayerCache             | <fill in>              | <fill in>                  | <fill in>                   |
| agentBattles (active)       | <fill in>              | <fill in>                  | <fill in>                   |
| trainingBattles             | <fill in>              | <fill in>                  | <fill in>                   |
| drafts (status=battle)      | <fill in>              | <fill in>                  | <fill in>                   |
```

---

## Q5 — Cross-Reference and Synthesis

### 5.1 — Drift origins, consumers, and operational impact

#### Drift A — `firebaseService.js` training battle CPU pool
- **Origin:** `src/firebase/firebaseService.js:2346` — hardcoded 10-element literal `['BTC','ETH','SOL','ADA','DOGE','XRP','AVAX','DOT','MATIC','LINK']` used by `generateCPUPortfolio('crypto')`.
- **Writer:** `firebaseService.js:2412` invokes `generateCPUPortfolio` and the result is persisted to the `trainingBattles` collection (`firebaseService.js:2465`).
- **Consumers:** training battle UI flow (`createTrainingBattle` at `firebaseService.js:2367` is exported on line 4601 and re-bound in `App.jsx:595`). Threshold computation calls `fetchAllThresholds(battleData.portfolio, [])` at `firebaseService.js:2388` — only the user portfolio is thresholded, not the CPU portfolio, so the off-universe symbols don't trigger threshold work.
- **Impact:** any training battle created with `assetType === 'crypto'` gets a CPU opponent containing AVAX/DOT/MATIC/LINK. These symbols then sit in `trainingBattles/{id}.opponent.portfolio[]`. Whether anything *reads* the CPU portfolio later depends on training-battle scoring; if scoring fetches prices for these symbols, EODHD may produce no data (price=0) and the CPU score stays at 0. Wasted EODHD calls if `volatilityService` is invoked on the CPU side.

#### Drift B — Snake Draft draftAssets pool
- **Origin:** `src/services/draftAssets.js:139,167,195` — `STEADY_CRYPTO` (25), `RISKY_CRYPTO` (25), `DEFENSIVE_CRYPTO` (25). Several dozen symbols outside the 7-universe.
- **Writers:** Snake Draft creation flow uses `draftService.js:21` (`getAssetPool`) and `freeAgencyService.js:8` (`getAssetPool`) to build draft pools written to `drafts/{id}`.
- **Consumers:**
  - `api/cron/snake-draft-daily-scores.js:461-497` — queries `drafts where status='battle'`, fetches prices for every pick. Fetches via `fetchStockPrices()` at `snake-draft-daily-scores.js:167-206` which uses **raw symbols without `.US`/`-USD.CC` suffix** (separate bug — see notable observation #4).
  - `api/cron/snake-draft-autopick.js` — runs every 10 minutes per cron schedule.
  - `src/screens/SnakeDraft/DraftCompleteScreen.jsx:9-12` — renders draft results.
- **Impact:** if Snake Draft battles exist with crypto picks, the cron is operating outside the 7-symbol universe. Whether this matters depends on whether Snake Draft is genuinely "scratched"; the cron is still scheduled in `vercel.json:26-32`.

#### Drift C — `compute-daily-baggerbomb-levels.js` routing list
- **Origin:** `api/cron/compute-daily-baggerbomb-levels.js:232-252` — `CRYPTO_SYMBOLS` Set with ~80 symbols, comment: "duplicated from src/services/sessionScoringService.js."
- **Use:** routing only — `isCrypto(symbol)` (line 254-256) decides whether a symbol gets `.US` or `-USD.CC` suffix in `fetchStockPrices` (line 120-126).
- **Consumer:** the cron itself, querying `battles where _v=4 and state.status='active'` (line 288-291). Symbols come from each battle's `creator.portfolio` and `opponent.portfolio` (line 313-318) — universe-constrained at battle creation.
- **Impact:** **inert in practice** — only stocks in the universe + 7-symbol crypto can reach this cron via active battles. The wide list is dead breadth. However, the symmetric src copy at `sessionScoringService.js:114-143` IS used by client-side scoring code (`isCrypto` is exported on line 154-156 and consumed by client services).

#### Drift D — `api/volatility/thresholds.js` CRYPTO_DEFAULTS
- **Origin:** `api/volatility/thresholds.js:29-56` — `CRYPTO_DEFAULTS` map with ~70 entries.
- **Use:** public HTTP endpoint `GET /api/volatility/thresholds?symbols=...&type=crypto` — returns thresholds for whatever symbols are passed. Fallback when EODHD fetch fails uses `CRYPTO_DEFAULTS[symbol]`.
- **Consumer:** anything that calls `volatilityService` (search shows `src/services/volatilityService.js`, `src/services/sessionScoringService.js:716`). For BaggerBomb V4 active battles, the universe-constrained portfolios mean only 7-symbol queries flow through; for off-universe lookups, this endpoint quietly serves results.
- **Impact:** no Firestore writes from this endpoint; in-memory cache only. Drift is in *what's queryable*, not *what's persisted*.

#### Drift E — `api/ai-advisor.js` prompt string
- **Origin:** `api/ai-advisor.js:32` — `"CRYPTO TICKERS in our system: BTC, ETH, BNB, SOL, XRP, ADA, DOGE, AVAX, DOT, MATIC, LINK, UNI, ATOM, LTC"`.
- **Use:** the LLM system prompt for the AI advisor — the model is told 14 crypto tickers are "in our system" when only 7 actually are.
- **Impact:** the advisor may discuss / recommend off-universe crypto in chat replies. No Firestore drift, but a UX/prompt-truth drift.

#### Drift F — `src/data/assets.js` CRYPTO catalog
- **Origin:** `src/data/assets.js:88-137` — 32-symbol CRYPTO array.
- **Use:** consumed by `src/services/freeAgentRotationService.js:4` (which then *excludes* the 7-symbol pool from free-agent generation in V5 — line 43-47 — making this effectively dead breadth for V5).
- **Impact:** low. V5 free agents are stock-only by design; the wider CRYPTO list isn't reaching the free-agent rotation surface.

#### Drift G — `api/crypto/metrics.js` per-symbol maps
- **Origin:** `api/crypto/metrics.js:212-218` (ATH map), `:253-254` (rank map), `:264-270` (name map). Each map covers 8-10 symbols, several outside the universe (USDT, USDC, AVAX).
- **Use:** public HTTP endpoint `/api/crypto/metrics?symbol=...` — caller-driven.
- **Impact:** no Firestore writes. Only matters if a UI calls this with off-universe symbols.

### 5.2 — Drift verdict

**Drift status:** Drift exists at multiple locations:

| # | Location | Type | Active path? |
|---|---|---|---|
| A | `src/firebase/firebaseService.js:2346` | Off-universe CPU symbols persisted to `trainingBattles` | Yes (createTrainingBattle is exported and used) |
| B | `src/services/draftAssets.js:139,167,195` | Off-universe symbols persisted to `drafts/{id}` | Yes if Snake Draft is still creatable |
| C | `api/cron/compute-daily-baggerbomb-levels.js:232` | Off-universe routing list (inert in V4 battles) | Inert |
| D | `api/volatility/thresholds.js:29` | Off-universe defaults at public endpoint | Caller-driven, no FS write |
| E | `api/ai-advisor.js:32` | Off-universe prompt content | Yes (prompt sent on each advisor call) |
| F | `src/data/assets.js:88` | Off-universe catalog (mostly dead in V5) | Largely dead |
| G | `api/crypto/metrics.js:212` | Off-universe maps at public endpoint | Caller-driven, no FS write |

The active 7-symbol universe is enforced HARD only at `api/agent/decide.js:543-548` for agent battles, and DECLARATIVELY at `src/constants/cryptoPool.js` for client-side V5 BaggerBomb battles. There is no central registry that all subsystems consult — multiple parallel lists exist.

### 5.3 — Notable related observations

1. **The 7-symbol universe is hardcoded in 3 places that should agree but don't reference each other:**
   - `api/_utils/agentCryptoAssets.js:4-12` (canonical API)
   - `src/constants/cryptoPool.js:6-14` (canonical client)
   - `src/App.jsx:6529` (`['BTC','ETH','SOL','XRP','DOGE','ADA','BNB']`) — duplicate literal in `createTrainingBattleV5BaggerBomb`-style code; could drift independently.

2. **Eval cron makes wasted Firestore reads for crypto tech-scores.** `agent-evaluate.js:351` builds `allTechSymbols` from `[...portfolioSymbols, ...benchSymbols]` and queries `stockTechnicalScores/{symbol}` for both. Crypto symbols (1-2 per battle: support_crypto, bench_crypto) always return non-existent docs — graceful but wasteful at scale.

3. **Voice-layer-cache silently drops support_crypto from `portfolioBriefs[]`.** `voice-layer-cache.js:117` (`if (!price) return;`) skips the entry because `fetchBulkPrices` (line 31-84) hardcodes `.US` suffix on every symbol — EODHD returns nothing for `BTC.US`, so support_crypto has no price and is omitted. The agent prompt thus loses any commentary on the support-tier crypto position. Worth flagging to the Phase 3 plumbing work.

4. **`api/cron/snake-draft-daily-scores.js:178` calls EODHD with raw symbols (no `.US` / `-USD.CC` suffix).** This appears to be a separate latent bug — not crypto-specific. Stock symbols also lack `.US` here. Either EODHD has a tolerant fallback or this cron has been quietly returning empty results.

5. **`src/services/sessionScoringService.js` exports `CRYPTO_SYMBOLS` (~80 symbols) used as `isCrypto()` type detector throughout client services.** Treats anything in the wide list as crypto for routing — but in V5 the actual playable universe is 7 symbols. The wide list is fine for "is this a known crypto ticker?" routing but is misleading as a name.

6. **`api/_utils/marketDataCache.js:79` defines `isCryptoSymbol()` to match `VALID_CRYPTO_SYMBOLS.includes(upper)` — but also accepts any `*-USD.CC` / `*.CC` suffix.** Combined with no upstream filter on `getStockAnalysisData`, ANY crypto symbol passed in (including off-universe) will be fetched and cached to `marketDataCache/{SYMBOL}_{field}`. The likelihood of stale off-universe entries depends on whether previous game-mode flows ever called this with non-universe symbols.

7. **`PORTFOLIO_TOOL` schema (`agentToolSchema.js:75-90`) is loose** — `support_crypto` / `bench_crypto` are `string` with no `enum`. Tightening to `enum: VALID_CRYPTO_SYMBOLS` would catch off-universe picks in the schema validator before Haiku's response reaches the JS validator. Currently relies on the post-hoc validator + retry loop.

8. **`compute-daily-baggerbomb-levels.js:230` says "duplicated from `src/services/sessionScoringService.js`."** If Phase 3 narrows the universe, both copies need updating in sync — there's no comment in `sessionScoringService.js` pointing back at the cron copy.

---

## Synthesis

The active crypto universe is enforced by:
- **`VALID_CRYPTO_SYMBOLS` (`api/_utils/agentCryptoAssets.js:14`)** at the **agent battle creation** layer (`api/agent/decide.js:543-548`, with single-retry feedback loop), and
- **`CRYPTO_POOL_SYMBOLS` / `BAGGERBOMB_CRYPTO_POOL` (`src/constants/cryptoPool.js`)** at the **client BaggerBomb V5** layer (slot builder, swap market, free-agent exclusion).

**Drift status: drift found at 7 locations** (table in §5.2). The most consequential are:
- (A) `firebaseService.js:2346` — writes off-universe symbols (AVAX/DOT/MATIC/LINK) into `trainingBattles` CPU portfolios.
- (B) `draftAssets.js:139,167,195` — persists wide crypto pool into `drafts` for Snake Draft mode.
- (E) `ai-advisor.js:32` — advisor prompt declares 14 crypto tickers, half of them off-universe.

Inert/low-impact drift: (C) routing list in BaggerBomb levels cron is dead breadth in V4; (D) and (G) are caller-driven public endpoints with no Firestore writes; (F) is largely dead in V5.

**Notable observations** (not strictly drift):
1. The 7-symbol universe is hardcoded in 3 places without cross-references.
2. `agent-evaluate.js` makes ~2 wasted `stockTechnicalScores` reads per active battle per cycle (one for support_crypto, one for bench_crypto).
3. `voice-layer-cache` silently drops support_crypto from `portfolioBriefs[]` because `fetchBulkPrices` hardcodes `.US` suffix.
4. `snake-draft-daily-scores.js:178` calls EODHD with no exchange suffix — separate latent bug.
5. `marketDataCache/getStockAnalysisData` has no universe filter — any historical off-universe crypto fetch persists in `marketDataCache/{SYMBOL}_{field}` until TTL expiry (4-24h).
6. `PORTFOLIO_TOOL` schema lacks an `enum` constraint on crypto fields — relies on post-hoc validator.

**Empirical Firestore state requires manual inspection** — see §4.2 for the commands. Until those queries are run, the report cannot confirm which stale entries currently exist; it only locates the writers that could produce them.

---

## Appendix — Files Read in This Audit

- `api/_utils/agentCryptoAssets.js`
- `api/_utils/rankingConfig.js`
- `api/_utils/agentToolSchema.js`
- `api/_utils/marketDataCache.js`
- `api/_utils/agentScoring.js` (flattenPortfolioServer/flattenBenchServer)
- `api/_utils/agentEvalPromptAssembly.js` (bench technical block)
- `api/_utils/agentTriggerGate.js` (fetchRecentNews)
- `api/agent/decide.js`
- `api/agent/debate.js` (targetSymbol guard)
- `api/cron/compute-index-intelligence.js`
- `api/cron/agent-evaluate.js`
- `api/cron/voice-layer-cache.js`
- `api/cron/pre-market-warmup.js`
- `api/cron/compute-daily-baggerbomb-levels.js`
- `api/cron/baggerbomb-v4-daily-scores.js` (header only)
- `api/cron/snake-draft-daily-scores.js`
- `api/crypto/prices.js`
- `api/volatility/thresholds.js`
- `api/ai-advisor.js` (header only)
- `src/constants/cryptoPool.js`
- `src/data/assets.js`
- `src/services/sessionScoringService.js` (CRYPTO_SYMBOLS region)
- `src/services/draftAssets.js` (crypto pools region)
- `src/services/freeAgentRotationService.js`
- `src/firebase/firebaseService.js` (training battles region)
- `src/App.jsx` (training battles + V5 crypto pool regions)
- `vercel.json`
- `firestore.rules` (collection list)
