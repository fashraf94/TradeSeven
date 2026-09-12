# Phase 0 — The index-intelligence cron's daily mapper

**§1 fence status (first line, as asked): NO file this fix would touch is inside the BUILD_RULES §1 calibration fence.** `api/cron/compute-index-intelligence.js`, `api/_utils/marketDataCache.js` and `api/_utils/indexIntelligence.js` are none of them on the §1 list (`docs/BUILD_RULES.md:14-24`, VERIFIED — read at those lines this session). Two caveats the founder should rule on rather than have me assume:

1. **§1's concept clause** (`BUILD_RULES.md:26`, VERIFIED) fences "the scoring engine … as concepts, not just files: changes that alter their behavior from non-fenced call sites are fence contact too." The cron *calls* the fenced `computeArchetypeRankings` (`archetypeScoring.js`) at `api/cron/compute-index-intelligence.js:1320` (VERIFIED), and the fenced `api/_utils/tournamentUserScoring.js:69` (VERIFIED) reads the doc this cron writes. **My read: this is not fence contact.** Calling exported fenced functions is explicitly permitted (`BUILD_RULES.md:12`, VERIFIED); the fix changes the *inputs* those scorers receive, not their behaviour — same function, same input→output mapping, corrected data. Nothing in the scoring engine is edited or re-wired.
2. Numbers the fenced scorers emit **will move** once the feed is corrected, because their inputs move. That is the disclosure, not a fence breach — but it is the founder's call whether a feed correction that moves fenced-scorer outputs warrants founder review anyway. **The report says so, as instructed.**

---

## Preamble (BUILD_RULES §3)

| Item | Value |
|---|---|
| `git fetch origin main` | Run as the first git action of this session (`0e04833..fcace00`) — §3 recorded |
| Branch | `claude/phase0-cron-mapper`, cut from `origin/main` |
| HEAD SHA | **`fcace00d4d572b8778ca218f51c96fa913c72045`** (`Merge pull request #836`, 2026-09-10) |
| Tree status | Clean at branch cut; this report is the only file added |
| Mode | READ-ONLY. No production code edited, no test edited, no lint run, no PR, no Firestore/GCS/EODHD call |
| Executed | Pure functions only, on committed fixtures, no network and no credentials (§7 of the prompt). Details in Q4 |
| Marker convention | **VERIFIED** = I read that code at that line at this HEAD in this session. **ASSUMED** = basis named inline |

---

## Executive verdict

| # | Question | Verdict |
|---|---|---|
| **Q1** | What the cron's mapper does with a bad row | **Unguarded, and strictly weaker than the research mapper.** `close: d.adjusted_close` (`:160`) with no finite check *and no `\|\| d.close` fallback*. A `null` becomes a silent 0 in every sum; an *absent* field becomes `undefined` → **NaN**, which corrupts the **cross-sectional RS ranking of the whole 239-name universe**. For an index symbol it **throws and 500s the entire run** |
| **Q2** | Can the cron share the reference fix | **Yes — import `mapDailyRows` as-is.** Same seven output fields, same names. Every field-level difference is either the fix itself or downstream-equivalent (each one verified below). One real adaptation: the cron's endpoint returns **oldest-first**, so it must keep its `.reverse()` |
| **Q3** | Who consumes the feed | **22 distinct read sites** across the eval cron, `decide.js`, the narrator, research, Search/Discover, the screener, Forge, five tournament services and six client surfaces. All named-field and null-guarded; **no reader iterates `factors` keys**, so a new `basis` key is safe |
| **Q4** | The defect, production-shaped | **Reproduced and measured** on the #833 fixture. One `null adjusted_close` moves SMA20 by **−6.14**, RSI by **+39.74 pts**, ATR% from 2.00 to 9.25 (regime `normal`→`extreme`), technicalScore 40→46, and flips `aboveSMA20` false→true. **But:** 33,163 real captured EODHD rows in `fixtures/daily/` contain **zero** nulls and **zero** symbol-specific gaps |
| **Q5** | Schedule and smoke | Premarket `30 10,11 * * 1-5` UTC **runs before** the eval cron's first tick (`13:00` UTC) — the first corrected feed reaches the decider the same morning. No cron slot needed (39/40 unchanged). The feed doc carries `computedAt` but **no code version**; one field fixes that |

**One disagreement with the brief, flagged per §6 ("do not relitigate; flag and STOP").** The brief states the cron "is live-wrong on every run until fixed." The captured-production evidence does not support *every run* — see Q4 §4.3. It supports something narrower and still worth fixing: **the cron is undefended, the blast radius of one bad row is universe-wide, and there is no detector.** The fix is right; the urgency framing should be "unguarded with a catastrophic tail", not "wrong every day."

---

## Q1 — What the cron's mapper does with a bad row

### 1.1 The fetch

| Fact | Evidence |
|---|---|
| Endpoint | `https://eodhd.com/api/eod/{sym}?period=d&from={date}&fmt=json&api_token=…` — `compute-index-intelligence.js:133` (VERIFIED) |
| Fields carried | `date, open, high, low, close, adjusted_close, volume` — confirmed against 17 **real captured responses** in `fixtures/daily/` (VERIFIED, Q4.3) |
| Window | `daysBack = 252`, widened by `Math.ceil(daysBack * 1.5)` = **378 calendar days** — `:130-132` (VERIFIED). Comment at `:132` reads "overshoot for weekends/holidays" |
| Per-call windows | stocks + indices 252 (`:186`, `:672`); TNX 30 (`:674`); sector ETFs 50 (`:676`) — all VERIFIED |
| Ordering | No `order=` param, so EODHD returns **oldest-first**; the cron reverses at `:155` (`data.reverse().map(...)`) (VERIFIED). Confirmed empirically: all 17 captures are oldest-first, 0 date-descending violations |
| Empty/error | `!response.ok` → throw (`:136-138`); non-array or length 0 → throw (`:140-142`) (VERIFIED). `fetchBatch` catches per-symbol and records an error (`:188-191`) |

**Does D-120's 90-day widening apply here? No — VERIFIED.** `DAILY_WINDOW_CALENDAR_DAYS = 90` lives in `marketDataCache.js:257` and is used **only** by `fetchDailyOHLCV` (`:353`). The cron builds its own URL and never imports it (`grep` over `compute-index-intelligence.js` imports, `:12-63`, VERIFIED — no `marketDataCache` import). **The two fetchers also differ in ordering:** `fetchDailyOHLCV` passes `&order=d` (`marketDataCache.js:354`, VERIFIED) and therefore does *not* reverse; the cron does. That is the one adaptation a shared helper needs (Q2.3).

Measured on the captured SPY series: a 90-day window yields **62** trading rows; the cron's 378-day window yields **260** — enough for SMA200 (VERIFIED, `probeGaps.mjs` output).

### 1.2 The mapping

The whole of it, `compute-index-intelligence.js:155-163` (VERIFIED):

```js
const ohlcv = data.reverse().map(d => ({
  date: d.date, open: d.open, high: d.high, low: d.low,
  close: d.adjusted_close,   // :160 — no finite check, NO raw fallback
  rawClose: d.close,         // :161
  volume: d.volume || 0,     // :162
}));
```

Per input shape, what `close` becomes (all VERIFIED by execution — Q4.2):

| `d.adjusted_close` is | `close` becomes | What happens downstream |
|---|---|---|
| `null` | `null` | Sums as **0** (`null + x === x`). `calculateSMA`'s `reduce((a,b)=>a+b,0)` (`technicalCalculations.js:22`) returns a **finite average low by `close/period`** |
| `undefined` (key absent) | `undefined` | Sums as **NaN** (`undefined + x === NaN`). Poisons every arithmetic reader *and* the cross-sectional sort (Q1.3, row 2) |
| a numeric string `"131.25"` | the **string** | `"131.25" + 0` concatenates → string-poisoned reduce. No coercion anywhere on this path |
| `0` | `0` | Kept as a real price of zero |
| **row absent for a trading day** | — | Series is simply one bar shorter. **Nothing detects it**; all bar-offset lookbacks (`closes[period]`, `HORIZON_BARS`) shift by one trading day |

**The cron is strictly weaker than the pre-#833 research mapper.** `fetchDailyOHLCV`'s shipped mapper was `close: d.adjusted_close || d.close` — a null adjusted close fell through to the raw print. The cron has **no such fallback** (`:160`, VERIFIED), so a row EODHD could still have made usable is poisoned outright.

**Does EODHD omit missing days, or emit nulls? — VERIFIED empirically, not assumed.** See Q4.3: across **33,163 real captured rows**, non-trading days are **omitted** (83 market-wide missing weekdays = NYSE holidays; **0** symbol-specific gaps) and **no field is ever null, absent, string, zero or negative.** The repo's two prose claims that a field "can come back null, absent, or as a string" (`marketDataCache.js:262-265`, VERIFIED) and "on a halted or otherwise broken session" (`dailyRowHygiene.test.js:6-8`, VERIFIED) are the #833 author's stated basis — **ASSUMED**, since every #833 fixture sets its nulls by hand and no captured payload in the tree exhibits one.

### 1.3 Every downstream computation, and what each bad row does to it

One table, as asked. "**zero row**" = one mid-series `null` close. "**short series**" = one row dropped/absent. All effects VERIFIED by execution (Q4.2) or by reading the cited guard.

| Computation | `file:line` | Effect of one zero (null) row | Effect of a missing row (shorter series) |
|---|---|---|---|
| `calculateSMA(closes,20/50/200)` | cron `:863-865`, math `technicalCalculations.js:19-24` | Finite, **low by `close/period`**. Measured **SMA20 −6.14, SMA50 −2.46** | Window slides one bar older; `<period` rows → honest `null` (`:20`) |
| `calculateRSI(closes,14)` | cron `:866`, `tc:61-97` | Wilder seeds on the oldest bars and smooths forward → **whole series moves. Measured +39.74 RSI points** (49.37 vs 9.63) — crosses both zone lines | Shorter warm-up moves the value (the `marketDataCache.js:246-255` EMA/RSI length note, VERIFIED); `<period+1` → `null` |
| `calculateMACD(closes)` | cron `:870`, `tc:194` | Seeds with the same `reduce(…,0)` → finite and wrong. **hist 1.4235 vs 0.0429** | `<35` rows → `null` |
| MACD `prevHistogram` / fresh-cross | cron `:875-893` | Both legs poisoned → `freshBullishCross` / `freshBearishCross` can fire spuriously | One-bar shift in the "previous" bar |
| `calculateATR(highs,lows,closes,14)` | cron `:897`, `tc:285-323` | `Math.abs(h[i] − c[i−1])` with `c=null` becomes `h[i]` — the **price level, not the range**. **ATR% 9.25 vs 2.00; regime `extreme` vs `normal`** | `<period+1` → `null` |
| `calculateBollingerBands(closes,20,2)` | cron `:903`, `tc:247-271` | Mean and σ both poisoned. **%B 0.5261 vs −0.0756; bandwidth 91.90 vs 4.69** | `<20` → `null` |
| `calculateNR7(highs,lows)` | cron `:900` | Unaffected by a bad **close** (reads highs/lows only) | Comparison window shifts |
| `calculateVolumeProfile(volumes,20)` | cron `:907`, `tc:336-347` | Unaffected by a bad close. **Measured identical (0.94 both)**. `filter(v => v > 0)` at `:342` already sheds null/0 volumes | Lookback shifts |
| `computeRS(closes, spyCloses, 20/50)` | cron `:816-817`, `indexIntelligence.js:185-199` | `:189` guards `stockCloses[0] === 0` but **`null !== 0`** → `null/spy = 0` → **`change = −100%`**, bottom of the universe. `undefined` → **`change = NaN`** | Index-based (`closes[period]`), so a dropped row silently compares **one trading day older** against an unshifted SPY |
| **RS percentile sort** | cron **`:824-831`** | **The universe-wide one.** A `NaN` `change` survives `filter(d => d.rs20)` (the object is truthy) and enters the comparator at `:826`. Measured on 239 shuffled symbols: the finite symbols' order is **genuinely broken** (first inversion at sorted position 119) and **up to 237 of 238 other symbols receive a different `rsPercentile`** than they should | One symbol ranked off a one-bar-stale ratio |
| `computeRSTrend(closes, spy, 10)` | cron `:818`, `ii:208-242` | `:216` guards `spyCloses[i] === 0` only. Measured **`falling`/−0.0545 vs `flat`/0** | Regression window shifts |
| Sector RS + per-sector percentile | cron `:841-853` | Same two mechanisms, inside the sector cohort | Same |
| `computeTechnicalScore(...)` | cron `:916-927`, `ii:398-544` | Everything above lands in one score. **Measured technicalScore 46 vs 40, smaScore 4 vs 0, `aboveSMA20` true vs false** | Score computed on a shifted window |
| `resolveSmaBasis` / the SMA flags | `ii:332-368`, `:424-426` | `:348-349` require **every** value finite, so one bad bar **silently reverts the whole symbol to the adjusted basis** — i.e. #833's fix is disabled by #833's other defect | `rawCloses.length < period` → that period falls back |
| `high52w` / `distTo52wkHigh` | `ii:452-460` | `Math.max` coerces `null`→0, so it survives; `currentPrice` poisoned → distance wrong | Shorter `Math.min(252, …)` window |
| Volume confirmation / `upDayVolRatio` | `ii:462-486`, `:502-512` | `closes[i] > closes[i+1]` mis-classifies the bad bar's two comparisons → up/down volume mis-attributed | Pairings shift |
| `sma200_position` | cron `:937-939` | Rides the poisoned average and price | Null when SMA200 is null |
| `trend.short/intermediate/long` | cron `:950-954` | Bound to the same poisoned `smaBasis` (§9-correct, jointly wrong) | Same |
| `findSwingHighsLows` / `findNearestLevels` | cron `:959-962` | Swing detection over a poisoned close series | Lookback shifts |
| `calculateRSISeries` + `detectRSIDivergence` | cron `:967-969` | Whole RSI series moves → divergence can appear or vanish | `<period+1` → `null` |
| `detectCandlePattern(opens,…)` | cron `:977`, `analyticalPrimitives.js:297-330` | **Null-safe**: `:302` returns `null` if any of `o0/h0/l0/c0` is null | Yesterday's bar is a different day |
| `computeMomentumRankings` | cron `:1040`, `momentumScoring.js` | Mixed: `:75` `if (!start \|\| !end) return null` catches an endpoint null; mid-series nulls flow into ID/KER path sums | Fixed-bar lookbacks (22/23/60/127) shift |
| `computeReturns` | cron `:1050`, `returnCalculations.js:30-36` | **Null-honest**: `Number.isFinite` on both endpoints (`:34`) | **Fixed BAR offsets** (`HORIZON_BARS`, `:19-24`) → 1W/1M/3M/12M each shift one trading day. `returnYTD` is **date-anchored** (`:44-58`) and therefore drop-safe |
| Ranks, sector ranks, composite | cron `:1004-1023`, `:1178-1183` | Sorted on a poisoned `technicalScore` — one bad symbol re-ranks its sector | Same |
| `computeGameModeFits` / `baggerBombFit` | cron `:1211-1216` | Consumes the poisoned factor scores **and** `atrPercentile` — and the ATR distortion is the largest single effect measured | Same |
| `deriveAxes` / `arch_scores` / `arch_scores_v2` | cron `:1309-1333` | Cross-sectional: computed over the whole poisoned universe | Same |
| **Index technicals** | cron `:326-411`, called `:727` | **HARD FAILURE.** `:394` does `Number(currentPrice.toFixed(2))` on `closes[0]`. `null.toFixed` / `undefined.toFixed` **throws TypeError** (VERIFIED by execution) → caught at `:1474` → **HTTP 500, whole run aborts, nothing written**. Also `Math.min(...lows)` coerces `null`→**0**, wrecking `range52w.low` | No length guard at all on this path |
| Sector snapshot | cron `:696-708` | `changePercent` = **−100** on a null today-close; a null **denominator** bar gives **±Infinity** for `weekChange`/`monthChange` (VERIFIED by execution) | Index-based `weekIdx`/`monthIdx` shift |
| Yield regime (TNX) | cron `:756`, `ii:153-176` | `null / 10 === 0` → reports **"10Y at 0.00% — accommodative"** (VERIFIED by execution) | — |
| Regime / breadth / leadership | cron `:739-782` | All derived from the index technicals above | — |

### 1.4 Guards the Sep 9 read missed

Three exist. **None of them is a finite check.**

| Guard | `file:line` | What it does — and doesn't |
|---|---|---|
| Minimum series length (stocks) | `:813` `if (!ohlcv \|\| ohlcv.length < 50) continue;` | VERIFIED. Skips thin symbols. **Blind to a poisoned value in a long series** |
| SPY minimum | `:799-801` `spyCloses.length < 50` | VERIFIED. Aborts RS computation entirely, records an error |
| Sector ETF minimum | `:839` `sectorETFCloses[sectorId].length < 22` | VERIFIED |
| Doc-size warn | `:508`, `:1389-1392` (`STOCK_RANKINGS_DOC_WARN_BYTES` = 60% of 1 MiB) | VERIFIED. Size only |
| `toNum` finite coercion | `:208-211` | VERIFIED — **exists in this very file**, but is wired **only** into `injectIntradayBar` (`:242,251-253`) and `fetchRealtimeQuotes` (`:300`). The EOD mapper at `:155-163` never calls it |
| Skip-symbol on bad data | — | **Does not exist** (VERIFIED by absence: no `isFinite`/`Number.isFinite` anywhere on the EOD mapping path) |
| Time/budget guard | — | **Does not exist.** Only `export const config = { maxDuration: 300 }` at `:67` (VERIFIED) |

One further consequence worth naming: `injectIntradayBar:256` sets `open: prev.close` when the quote has no open (VERIFIED), so a poisoned prior bar propagates into the synthetic intraday bar.

---

## Q2 — The reference fix, and whether the cron can share it

### 2.1 `mapDailyRows` — exact contract at HEAD

`api/_utils/marketDataCache.js:313-343` (VERIFIED), with `toFiniteNumber` at `:277-280` (VERIFIED).

| Property | At HEAD |
|---|---|
| **Exported?** | **Yes** — `export function mapDailyRows(data)` (`:313`) |
| Signature | `(data: Array) => { rows: Array, dropped: number }` |
| Coercion | `toFiniteNumber(v)`: `typeof v === 'number' ? v : parseFloat(v)`, then `Number.isFinite(n) ? n : null` (`:277-280`). **Numeric strings are coerced, not dropped** |
| **Drop criterion** | `close`, `high` **or** `low` non-finite → the **row is dropped** and `dropped++` (`:319-325`). Not zeroed, not nulled, not thrown |
| Non-criteria | `open`, `rawClose`, `volume` each become **`null`** rather than `undefined` (`:329,337,338`) — a value readers can test. None is a drop criterion |
| **Which close fields** | **Both.** `close = toFiniteNumber(d?.adjusted_close) \|\| toFiniteNumber(d?.close)` (`:318`) — adjusted-preferred with a raw fallback, **falsy-0 fallthrough preserved deliberately**. `rawClose = toFiniteNumber(d.close)` (`:337`) |
| Order | **Preserved**, not reversed. `fetchDailyOHLCV` gets newest-first from the API via `&order=d` (`:354`) |
| Logging | **Not in the helper.** The drop-count log lives in the caller, `fetchDailyOHLCV:370-372` (VERIFIED) |
| Output shape | `{date, open, high, low, close, rawClose, volume}` — **the same seven keys, same names, as the cron's mapper** (`compute-index-intelligence.js:155-163`) |

### 2.2 The raw-vs-raw SMA flags and the split guard (`26e88aad`)

| Element | `file:line` (all VERIFIED) | What it is |
|---|---|---|
| Basis chosen | `indexIntelligence.js:332-368` `resolveSmaBasis({closes, rawCloses, technicals})` | Per-period pick of **which series both sides of the comparison come from** |
| "Basis" means | `:326-328`, `:341`, `:364` | `'adjusted'` = the shipped comparison (live raw price vs an average of split/dividend-adjusted closes). `'raw'` = price **and** average both off the unadjusted tape print. **Price and average from the same series, or neither** |
| Price side | `:356` `out.price = rawCloses[0]` | Index 0 carries no corporate action after it, so raw and adjusted agree there |
| **Split guard** | `:269-280` `windowIsRedenominated(closes, rawCloses, period)` | Computes the per-bar factor `adjusted/raw` across the window; if `max/min > SPLIT_FACTOR_SPREAD` (**1.15**, `:254`) the window is re-denominated and **falls back to the adjusted basis**. A zero or non-finite factor also counts as re-denominated (`:275`) — falling back is always the shipped behaviour |
| Degradation | `:344-351` | If `rawCloses` is missing, a different length, or carries **any** non-finite value, the whole thing reverts to shipped, byte for byte |
| Flags read off it | `:424-426` | `aboveSMA20/50/200` |
| Averages published | `:532-534` | `factors.sma20/50/200` are the **same** averages the flags used (§9 display-agreement) |
| `basis` map | `:341`, `:361`, `:364` | Computed — **and discarded.** `computeTechnicalScore`'s returned `factors` (`:523-542`) carries **no `basis` key** (VERIFIED) |

**Where the raw series is wired into the scoring cron** (the Sep 10 confirmation), all VERIFIED:

- `compute-index-intelligence.js:161` — `rawClose: d.close` added to the EOD mapper.
- `:264` — `injectIntradayBar` sets `rawClose: price` on the synthetic bar (a live quote *is* raw).
- `:915` — `const rawCloses = d.ohlcv.map(o => o.rawClose ?? o.close);`
- `:926` — passed into `computeTechnicalScore`.
- `:936` — `const smaBasis = scoreResult.factors;` so `sma200_position` (`:937-939`) and `trend` (`:950-954`) read the **same** averages.
- `voice-layer-cache.js:129-131,180-182` — `smaRead(flag, value)` gates the narrator's trend sentence on the **readings**, not the booleans.

**So: does the cron compute its SMAs on the same basis?** For the **stock** universe, **yes** — `:863-865` computes on adjusted closes, then `resolveSmaBasis` re-derives on raw where the window permits. For the **index** documents, **no** — `computeIndexTechnicals:338-350` computes `sma20/50/200` on adjusted closes and compares `currentPrice > smaVal` at `:347` with no raw path at all, while intraday mode splices a raw live quote into `closes[0]` for indices too (`:651`, `:672`, `:170-173`). See "Outside the five questions", finding **O-1**.

### 2.3 Can the cron import `mapDailyRows` unchanged?

**Yes.** The field names already match exactly. There is no `adjusted_close`-vs-`close` mismatch to bridge: the helper maps **both** (`close` = adjusted-preferred-with-raw-fallback at `:318`, `rawClose` = raw at `:337`) — which is a **superset** of what the cron does today.

Import safety, checked (VERIFIED):

- `marketDataCache.js` has **no module-level side effects** — `getFirebaseAdmin()` is a lazily-called function (`:57-70`), never invoked at import.
- Its imports are `firebase-admin/{app,firestore}`, `serverCache.js`, `technicalCalculations.js`, `marketSchedule.js`, `agentCryptoAssets.js` (`:16-21`) — all `api/`-internal or firebase-admin, which the cron **already** imports (`compute-index-intelligence.js:12-13`). No BUILD_RULES §4 concern (that rule governs `api/`→`src/`).

The five behaviour differences, each checked:

| Difference | Today (cron) | With `mapDailyRows` | Verdict |
|---|---|---|---|
| Non-finite `close`/`high`/`low` | kept, poisons | **row dropped** | **This is the fix** |
| Null `adjusted_close`, good raw `close` | `close: null` (poison) | `close` = the raw print (`:318`) | **Strict improvement** — recovers a row the cron currently destroys |
| `volume` | `d.volume \|\| 0` → **0** | `toFiniteNumber` → **null** | **Downstream-equivalent, VERIFIED**: `calculateVolumeProfile:342` filters on `v > 0` (null and 0 both fail); `ii:467-476` and `:504-509` sum with `+` (null and 0 both add 0); `injectIntradayBar:248` already does `d.volume \|\| 0`; `computeIndexTechnicals:369-371` guards `volumes[0] > 0`. Persisted `volumeProfile` carries only `{ratio, avgVolume, tier}` (`:992`) — `currentVolume` is not written |
| `open` | `d.open` (may be `undefined`) | `null` | **Safe, VERIFIED**: the only consumer is `detectCandlePattern`, which null-guards `opens[0]` at `analyticalPrimitives.js:302` |
| **Ordering** | reverses (`:155`) because the cron's URL has **no** `order=` param (`:133`) | helper **preserves** order; `fetchDailyOHLCV` relies on `&order=d` (`:354`) | **The one real adaptation.** The cron must keep its `.reverse()`. Dropping is per-row and order-agnostic, so `mapDailyRows(data).rows.reverse()` and `mapDailyRows(data.reverse()).rows` are identical |

Two things the cron must supply itself, since they live in `fetchDailyOHLCV` and not in the helper: the **drop-count log** (`marketDataCache.js:370-372` is the pattern — per-symbol, so a symbol that starts shedding rows is visible before its readings drift) and its existing **throw-on-empty** semantics (`:140-142`), which `mapDailyRows` does not change.

**Recommendation: (a) import `mapDailyRows` as-is.** One mapper, no new surface, no new helper to keep in sync, and every field-level difference is either the fix or verified-equivalent. (b) is unnecessary — nothing needs extending. (c) would create exactly the second mapper the point of this task is to avoid. Inline validation in the cron is ruled out by the prompt and by §4's never-copy-the-math principle.

**A consequence worth stating: dropping shifts bar-offset lookbacks.** `computeRS` compares `stockCloses[period]` against `spyCloses[period]` **by index** (`ii:191-192`), so a symbol that drops a row is compared one trading day out of alignment with SPY; `HORIZON_BARS` in `returnCalculations.js:19-24` shifts the same way. This is a *smaller* error than a null (measured: `change = −100%` vs a one-bar drift) and the shipped code already has the exposure whenever EODHD omits a day for one symbol — but it is a real trade and the build should say so in the PR rather than have it discovered.

**A bonus the drop buys for free:** because `mapDailyRows` drops an unusable newest row, `closes[0]` is always a finite number, which makes the `computeIndexTechnicals:394` `null.toFixed` crash (Q1.3, last rows) **impossible** — and that path has no length guard of its own.

---

## Q3 — Who consumes the feed

### 3.1 Where the cron writes

| Doc | `file:line` | Shape |
|---|---|---|
| `indexIntelligence/{SPY,QQQ,DIA,IWM,RSP}` | `:1072-1078` | `computeIndexTechnicals` output + `updatedAt` |
| `indexIntelligence/marketContext` | `:1081-1105` | regime, breadth, leadership, yields, `sectorSnapshot`, **`technicalLeaders`/`technicalLaggards`** (top/bottom 5 by technicalScore, `:1057-1058`), `mode`, `updatedAt` |
| **`stockTechnicalScores/{symbol}`** | `:1109-1116` | one doc per scored symbol (239 at HEAD, VERIFIED via `ALL_TICKERS.length`) — the full `stockScores` entry incl. `factors`, `+ updatedAt` |
| **`indexIntelligence/stockRankings`** | `:1367-1393` | `{stocks[], totalTechStocks, sectors, industries, mode, axes_formula_version, axes_universe_size, universe_median_return1W, arch_scores_version, computedAt, expiresAt, updatedAt}` |
| `rankingSnapshots/{etDate}_{label}` | `:1408-1446` | ops-gated observation snapshot; carries `codeHead: process.env.VERCEL_GIT_COMMIT_SHA \|\| null` (`:1425`) |

All in **one atomic batch** (`:1068`, `:1398`) — 246 ops (`:1387`), so a size breach is a universe-wide silent-staleness event.

**The per-symbol `factors` shape** — `indexIntelligence.js:523-542` (VERIFIED), 14 keys:
`rsPercentile, sectorRSPercentile, aboveSMA20, aboveSMA50, aboveSMA200, sma20, sma50, sma200, distTo52wkHigh, upDayVolRatio, rsi, macdHistogram, macdAboveSignal, macdFreshBullishCross, macdFreshBearishCross`.

### 3.2 Every reader — the disclosure list

Each of these is a consumer whose numbers change from wrong to right. All `file:line` VERIFIED.

**`indexIntelligence/stockRankings` — 21 read sites**

| Consumer | `file:line` |
|---|---|
| **The eval cron** | `api/cron/agent-evaluate.js:948` |
| **The narrator** (voice-layer cache) | `api/cron/voice-layer-cache.js:891` |
| `decide.js` — legacy deploy | `api/agent/decide.js:318` |
| `decide.js` — prescribed tournament deploy | `api/agent/decide.js:1314` |
| **Research path** | `api/agent/research.js:143` |
| Scouting board | `api/agent/scouting-board.js:86` |
| **Screener / Discover chat** | `api/screener/chat.js:278` |
| Forge watchlist analysis | `api/forge/watchlist-analysis.js:372` |
| Tournament group service | `api/_utils/tournamentGroupService.js:323` |
| Tournament agent boards | `api/_utils/tournamentAgentBoards.js:412` |
| Tournament agent draft | `api/_utils/tournamentAgentDraft.js:250` |
| Tournament user scoring **(§1-fenced file)** | `api/_utils/tournamentUserScoring.js:69` |
| Tournament board auto-commit | `api/_utils/tournamentBoardAutoCommit.js:141` |
| Training lifecycle (autopick) | `api/_utils/trainingLifecycle.js:216` |
| **Search / Discover rankings view** | `src/components/Search/RankingsView.jsx:67` |
| Draft Compete tab | `src/components/draft/CompeteTab.jsx:925` |
| Research sector-ETF ranks tab | `src/components/Research/SectorETFRanksTab.jsx:18` |
| Tournament awaiting-open pod view | `src/components/Tournament/awaitingOpen/AwaitingOpenPodView.jsx:69` |
| League battle-arena ATR percentiles | `src/components/League/battleArena/useAtrPercentiles.js:46` |
| Training-draft hook | `src/hooks/useTrainingDraft.js:89` |
| (producer) | `api/cron/compute-index-intelligence.js:1367` |

**`stockTechnicalScores/{symbol}` — 4 read sites**

| Consumer | `file:line` |
|---|---|
| **The eval cron** (batch `getAll` over portfolio + bench) | `api/cron/agent-evaluate.js:944`, processed `:1131-1135` |
| **The narrator** | `api/cron/voice-layer-cache.js:886` |
| Learning capture receipt (replay/provenance) | `api/_utils/learning/captureReceipt.js:147` |
| Research technical-score card | `src/components/Research/useTechnicalScore.js:21` |

**Readers of `factors` specifically**

| Consumer | `file:line` | Fields read |
|---|---|---|
| **The narrator's technical snapshot** | `api/cron/voice-layer-cache.js:154,180-186,200,246,254,309-310,334-338,444,451,464` | `aboveSMA20/50/200`, `sma20/50/200`, `rsPercentile`, `macdAboveSignal`, `upDayVolRatio`, `distTo52wkHigh`, `macdFresh*` |
| `buildTechnicalSnapshot` (rides `proposalHistory[i].snapshot` / `trades[i].snapshot`) | `api/_utils/buildTechnicalSnapshot.js:28,48-54,74-78,82-83` | `rsi`, `macd*`, `upDayVolRatio`, `aboveSMA*`, `distTo52wkHigh`, `rs*` |
| `classifyStockRegime` (regime input to the decider) | `api/_utils/agentRegimeClassifier.js:26-36` | `aboveSMA20/50`, `rsi`, `macdHistogram`, `upDayVolRatio` |
| **Eval prompt assembly (§1-fenced)** | `api/_utils/agentEvalPromptAssembly.js:1607-1615,1665-1679` | `rsi`, `macdAboveSignal`, `rsPercentile`, `sectorRSPercentile` |
| Draft Compete tab | `src/components/draft/CompeteTab.jsx:49,51,60,64,66,68,696` | `rsPercentile`, `sectorRSPercentile`, `macdAboveSignal`, `distTo52wkHigh`, `upDayVolRatio`, `rsi` |

**Indirect: `indexIntelligence/marketContext`** — read by the eval cron (`agent-evaluate.js:951`) and the **Daily Regime Brief** (`api/cron/compute-daily-regime-brief.js:107,110,121-123`, which consumes `technicalLeaders`/`technicalLaggards` — derived from the same technicalScores).

### 3.3 Room for a per-window `basis` field?

**Yes, and no reader would be surprised — VERIFIED.**

- The data already exists: `resolveSmaBasis` returns `basis: {sma20, sma50, sma200}` (`ii:341,361,364`) and `computeTechnicalScore` throws it away (`:523-542` has no `basis` key). Publishing it is `basis: smaBasis.basis` — one line, zero new computation.
- **No reader iterates `factors` keys.** Searched for `Object.keys(factors)`, `Object.entries(factors)`, `...factors` and the `techFactors`/`tech.factors` variants across `api/` and `src/`: **zero non-test hits** (VERIFIED). Every reader in §3.2 uses named fields with `?.` / `?? null` / `!= null` / `=== true` guards.
- **No schema allowlist exists** — searched for `FACTOR_KEYS`/`ALLOWED_FACTOR`/`factorsSchema`/`validateFactors`: zero hits (VERIFIED).
- **Firestore rules are doc-level, not field-level**: `firestore.rules:682-690` grants `read: if true; write: if false` on both `indexIntelligence/{docId}` and `stockTechnicalScores/{symbol}` (VERIFIED) — a new key passes.
- Doc-size: `factors` gains three short strings per symbol × 239 symbols in `stockTechnicalScores` (separate docs, no shared ceiling). **`stockRankings` is unaffected** — `rankingStocks` entries do not carry `factors` (`:1221-1284`, VERIFIED), so the 60%-of-1-MiB warn line (`:508`) is untouched.

**Recommendation: yes, add it — but as a separate, clearly-labelled line of the build**, not folded into the mapper fix. It is the optional audit item; it is free; and it makes the split-guard fallback (Q2.2) observable in the console for the first time.

---

## Q4 — The defect, production-shaped

### 4.1 The fixture

**The #833 fixture exists and is cited: `api/_utils/dailyRowHygiene.test.js:36-52`, `eodPayload(n)`** (VERIFIED). It emits exactly the seven fields the cron's endpoint returns, including both `close` and `adjusted_close`.

**It needs one adaptation for the cron, and the build must not miss it.** `eodPayload` is **newest-first** (`date: new Date(today - i * DAY_MS)`, `:42`) because `fetchDailyOHLCV` passes `&order=d` (`marketDataCache.js:354`). The cron's URL has **no** `order=` param (`:133`) and reverses (`:155`), so **the cron's production-shaped payload is `eodPayload(n).reverse()`** — oldest-first. Confirmed against real captures: all 17 files in `fixtures/daily/` are oldest-first, 0 violations (VERIFIED).

The other #833 fixture, `api/_utils/rawVsAdjustedSmaFlags.test.js:42-60`, is a **mapped-array** fixture (closes arrays derived from a real 1% dividend) — it exercises `resolveSmaBasis`, **not** the mapper. It cannot serve as the mapper fixture.

Note for the build: that file's header cites `compute-index-intelligence.js:150` for `close: d.adjusted_close`; at this HEAD it is **`:160`** (VERIFIED). Lines drift — §3.

### 4.2 Current mapper vs reference mapper, run locally

Both are pure. Executed with **no network and no credentials**, per §7 of the prompt. `node_modules` is empty in this container, so `marketDataCache.js` (which imports `firebase-admin`) could not be imported directly; **`toFiniteNumber` + `mapDailyRows` were extracted mechanically with `sed -n '277,343p'`** and the extraction's SHA-256 was checked against the source slice — byte-identical (`4b0b9dbe…22b5c`). `technicalCalculations.js` and `indexIntelligence.js` were imported **directly from the tree** (both are dependency-free). The cron's mapper (`:155-163`) is not exported, so its map expression is transcribed verbatim in the probe.

**Input:** `eodPayload(90)`, victim at index 12 (#833's own victim), `adjusted_close = null`, **raw `close` left intact** — the shape the research mapper's `||` was written to recover from and the cron has no defence against.

```
=== CASE A — null adjusted_close, raw close present ===
cron  rows: 90   row[12].close = null
ref   rows: 90 (dropped 0)   row[12].close = 122.8378     ← recovered via `|| toFiniteNumber(d.close)`

metric           CRON (current)          REFERENCE (#833)
SMA20            117.1857                123.3276          delta=-6.1419
SMA50            126.3015                128.7582          delta=-2.4567
SMA200           null                    null
RSI14            49.37                   9.63              delta=+39.7400
MACD hist        1.4235                  0.0429            delta=+1.3806
ATR%             9.25                    2                 delta=+7.2500
ATR regime       extreme                 normal
BB %B            0.5261                  -0.0756           delta=+0.6017
BB bandwidth     91.9                    4.69              delta=+87.2100
RVOL ratio       0.94                    0.94              delta=0.0000

=== CASE B — null adjusted_close at index 0 (today), RS vs SPY ===
cron  rs20    = {"value":0,"change":-100}      ref = {"value":1,"change":0}
cron  rsTrend = {"trend":"falling","slope":-0.054545}   ref = {"trend":"flat","slope":0}

=== CASE C — adjusted_close key ABSENT at index 0 → undefined ===
cron  row[0].close = undefined
cron  rs20 = {value: NaN, change: NaN}   (Number.isNaN(change) === true)
cron  SMA20 = NaN
ref   rows = 90   dropped = 0

=== CASE D — one NaN rs20.change in the cross-sectional sort (cron :824-831) ===
n=239 (ALL_TICKERS at HEAD), values shuffled, one NaN injected, compared against
an otherwise-identical NaN-free control:
  NaN at input idx   0   finite-order still ascending: true    percentiles differing: 58/238
  NaN at input idx   1   finite-order still ascending: false (first inversion at sorted position 37)   134/238
  NaN at input idx   7   finite-order still ascending: false (inversion at 224)                         79/238
  NaN at input idx  60   finite-order still ascending: false (inversion at 179)                        231/238
  NaN at input idx 119   finite-order still ascending: false (inversion at 119)                        237/238
  NaN at input idx 200   finite-order still ascending: true                                             31/238
  NaN at input idx 238   finite-order still ascending: true                                             29/238
The poisoned symbol is still ranked and still persisted: rsPercentile = 50 → rsVsSpyScore 11/22.

=== CASE E — computeTechnicalScore, null adjusted_close at index 12 ===
cron technicalScore = 46   smaScore = 4   sma20 = 117.1857   sma50 = 126.3015
ref  technicalScore = 40   smaScore = 0   sma20 = 123.3276   sma50 = 128.7582
cron aboveSMA20/50 = true  false     |  ref = false false     ← the flag FLIPS
cron rsi(factors)  = 49.37            |  ref = 9.63
cron macdHistogram = 1.4235           |  ref = 0.0429
```

**This is the shown-failing-under-its-defect evidence the build's test must pin.** Note that every cron number is **finite** — no NaN, no null, no throw in Case A. That is the whole hazard: nothing downstream can tell.

**Case D is the finding that most changes the shape of the fix.** One `undefined` field in one symbol does not merely corrupt that symbol — it makes the comparator at `:826` return `NaN`, which breaks sort transitivity and, measured at the real universe size, **re-ranks up to 237 of the other 238 symbols.** `filter(d => d.rs20)` at `:825` does not catch it because `{value: NaN, change: NaN}` is a truthy object.

Three non-stock failure modes, verified by execution as language-level facts:

```
null  currentPrice.toFixed(2)     → THROWS TypeError   (cron :394 → 500, run aborts)
undef currentPrice.toFixed(2)     → THROWS TypeError
sector changePercent, close null  → -100               (cron :698)
sector weekChange, denom null     → Infinity           (cron :700; Number.isFinite === false)
TNX null/10                       → 0                  (ii:155 → "10Y at 0.00% — accommodative")
Math.min(...[430, null, 428])     → 0                  (cron :378 → range52w.low = 0)
[100, null, 100] reduce(+,0)      → 200                (the silent one)
[100, undefined, 100] reduce(+,0) → NaN                (the loud one)
```

### 4.3 How often does a gap occur — measured, not improvised

**The repo contains 17 real, byte-for-byte captured EODHD `/eod/` responses** at `fixtures/daily/` (`fixtures/README.md`: *"Raw, untouched EODHD API responses … never cleaned, re-ordered, or pretty-printed"*; fetch date 2026-07-10; API keys redacted). Reading them is read-only and needs no network. Measured across **all 17 files, 33,163 rows, 2018-01-02 → 2026-07-09**:

| Measurement | Result |
|---|---|
| Rows with a `null` in **any** of the 7 fields | **0** |
| Rows with an **absent** key | **0** |
| Rows with a **string**-typed numeric field | **0** |
| Rows with a **zero** or **negative** price/volume | **0** |
| Rows landing on a Saturday or Sunday | **0** |
| Weekdays missing from **every** live symbol (= NYSE holidays) | **83** |
| **Weekdays missing from some symbols but not others (= a real per-symbol data gap)** | **0** |
| Consecutive-row business-day gaps | 31,852 × 0-missing, 1,294 × exactly-1-missing, **0 × ≥2-missing** |

**Conclusion, VERIFIED from production-captured data: EODHD `/eod/` OMITS non-trading days and does not emit null-valued rows.** Every gap in 8.5 years × 17 symbols is a market-wide holiday. There is **no observed instance** of the null/absent/string input this fix defends against.

Other in-tree signals, all **ASSUMED** (they are prose, not captures): `marketDataCache.js:262-265` — "a field can come back null, absent, or as a string"; `dailyRowHygiene.test.js:6-8` — "on a halted or otherwise broken session"; `compute-index-intelligence.js:208-211` (`toNum`) — the real-time endpoint has evidently returned strings, which is why that coercion exists, but that is the **quote** endpoint, not `/eod/`. No log string, comment or test in the tree names an observed `/eod/` gap frequency. I did not improvise live-data access to find out.

**What this means for the build, stated plainly.** The defect is real and the fix is right — the cron has no validation, is strictly weaker than the research mapper, and the blast radius of a single bad row is universe-wide with no detector. But the brief's "live-wrong on every run" is not supported by the evidence available in this repo: the triggering input has never been observed in 33k captured rows. **The honest case for shipping is resilience and consistency (one mapper, one contract), not an active bleed.** That also means the smoke test (Q5) will show **no numeric change** on a clean day — which the founder needs to know in advance, or a correct deploy will look like a no-op.

---

## Q5 — When it runs, and what the smoke is

### 5.1 Schedule and budget

| Item | Value | Evidence |
|---|---|---|
| Pre-market run | **`30 10,11 * * 1-5` UTC** (~6:30 AM ET; dual hours for DST) | `vercel.json` crons[26] (VERIFIED); header comment `:4` |
| Intraday recompute | **`0 14,15,16,17,18,19,20 * * 1-5` UTC**, `?mode=intraday` | `vercel.json` crons[27] (VERIFIED) |
| `maxDuration` | **300 s** | `compute-index-intelligence.js:67` (VERIFIED) |
| Budget guard | **None exists.** No elapsed-time abort anywhere in the handler; only per-stage `markStage` timings (`:627-631`) and the doc-size warn at `:1389-1392` | VERIFIED by absence |
| Symbols per run | **239 stocks** (`ALL_TICKERS`) + 5 indices + 11 sector ETFs + TNX = **256**. Stocks fetched in batches of 10 with a 500 ms inter-batch delay (`:803`, `:177-201`); intraday quotes in batches of 20 × 300 ms (`:280`) | VERIFIED |
| Cron-slot cost of this fix | **Zero.** 39 entries at HEAD — matches BUILD_RULES §6's "39/40"; this cron already owns 2 of them | VERIFIED by counting `vercel.json` `crons` |
| Rate-limit / EODHD cost | **Unchanged** — the fix adds no call; the same payload is mapped differently | VERIFIED |

### 5.2 Does it run before the eval cron's first tick? — Yes

`agent-evaluate` is `*/15 13,14,…,21 * * 1-5` UTC (`vercel.json` crons[28], VERIFIED): **first tick 13:00 UTC**. The pre-market run at **10:30 / 11:30 UTC** precedes it by 90–150 minutes. **So the first corrected feed reaches the decider on the first pre-market run after deploy, in the same session.** A mid-session deploy is picked up by the next hourly intraday run (14:00–20:00 UTC), which runs the identical pipeline.

Crons do not run on Vercel preview (BUILD_RULES §6, VERIFIED at `:80`), so verification = unit tests on the mapper + observation of the first production run. The PR must say that rather than claim preview-tested.

### 5.3 Can the founder tell a pre-fix run from a post-fix run in the console?

| Field on `indexIntelligence/stockRankings` | `file:line` | Use |
|---|---|---|
| `computedAt` / `updatedAt` (serverTimestamp) | `:1379`, `:1383` | **Timestamp only** — tells you *when*, not *which code* |
| `expiresAt` | `:1382` | Freshness horizon (75 min intraday / 24 h premarket) |
| `mode` (`'intraday'` \| `'premarket'`) | `:1373` | Which run shape |
| `axes_formula_version`, `arch_scores_version` | `:1375`, `:1378` | Version **precedent already in this doc** |
| `stockTechnicalScores/{sym}` | `:1113` | **`updatedAt` only** — no version field at all |
| `rankingSnapshots/{id}.codeHead` | `:1425` | `VERCEL_GIT_COMMIT_SHA` — but it is **ops-gated** (`snapshotOps.enabled`, `:1408`), written to a *different* collection, and only on the premarket + last-intraday runs (`:1414`) |

**Verdict: no — a timestamp alone cannot distinguish pre-fix from post-fix**, because the founder would have to know the exact deploy minute and because on a clean day (Q4.3) the *numbers* will be identical.

**The one field the build should add:** `deploySha: globalThis.process?.env?.VERCEL_GIT_COMMIT_SHA || null` on the `stockRankings` payload, next to `arch_scores_version` at `:1378`. Exact in-repo precedent: `api/cron/agent-evaluate.js:1325` uses that literal expression on a persisted doc (VERIFIED), and this very cron already reads the same env var at `:1425`. One line, additive, no reader affected (§3.3). With it, the smoke is: open `indexIntelligence/stockRankings`, read `deploySha` — if it matches the merge commit, the corrected mapper produced this feed.

### 5.4 The smoke, concretely

1. Founder merges + deploys. Note the deploy SHA.
2. **First pre-market run** (10:30 or 11:30 UTC, Mon–Fri). Check the function logs for the new per-symbol drop line (`marketDataCache.js:370-372` pattern) — **expect `0 dropped` for all 256 symbols on a normal day**, per Q4.3.
3. Read `indexIntelligence/stockRankings` in the console: `deploySha` equals the deploy SHA, `mode: 'premarket'`, `computedAt` is today, `totalTechStocks` is **239** (not lower — a drop in this number means rows were shed past the `length < 50` guard at `:813`).
4. Spot-check one dividend payer's `stockTechnicalScores/{sym}.factors`: `sma20/50/200` present, `aboveSMA*` consistent with them, and — if the `basis` field ships — `basis.sma20/50/200` reading `'raw'` on ordinary windows.
5. Confirm the first eval tick at 13:00 UTC consumed it (`agent-evaluate.js:948`).

**Expected outcome on a clean day: identical numbers, `0 dropped`, a new `deploySha`.** That is success, not a no-op.

---

## For the design chat

**Q1.** The cron's mapper is `close: d.adjusted_close` with no finite check and — unlike the research mapper it was forked from — **no `|| d.close` fallback**, so a `null` becomes a silent 0 in every sum (measured: SMA20 −6.14, RSI +39.74, ATR regime `normal`→`extreme`), an *absent* field becomes `NaN` and corrupts the **cross-sectional RS ranking of up to 237 of the other 238 symbols**, and for an index symbol `Number(currentPrice.toFixed(2))` at `:394` **throws and 500s the whole run**; the only guards that exist are three minimum-length checks, and `toNum` — the finite coercion that already lives in this file at `:208-211` — is wired only into the intraday path.

**Q2.** `mapDailyRows` is exported at `marketDataCache.js:313`, produces the **same seven field names** the cron already uses, maps **both** `close` (adjusted-preferred, raw-fallback) and `rawClose`, and drops rather than zeroes a row whose `close`/`high`/`low` is non-finite — so the cron can **import it as-is (recommendation (a))**, the only real adaptation being that the cron's endpoint returns oldest-first and must keep its `.reverse()` (the `volume: 0`→`null` and `open: undefined`→`null` differences are verified downstream-equivalent, and the `|| d.close` fallback the cron gains is a strict improvement); the raw-vs-raw basis is chosen per-period in `resolveSmaBasis` (`indexIntelligence.js:332-368`) behind a 1.15 split-spread guard (`:254`, `:269-280`), is wired into the cron at `:161` / `:915` / `:926` / `:936`, and — importantly — **silently reverts to the adjusted basis whenever any raw close is non-finite** (`:348-349`), so this defect currently disables #833's other fix.

**Q3.** The cron writes `indexIntelligence/stockRankings`, `stockTechnicalScores/{symbol}` (239 docs), `marketContext` and the five index docs in one atomic 246-op batch, and **22 read sites** consume them — the eval cron (`agent-evaluate.js:944,948`), `decide.js` (`:318`, `:1314`), the narrator (`voice-layer-cache.js:886,891`), research (`research.js:143`), Search/Discover (`RankingsView.jsx:67`), the screener (`chat.js:278`), Forge, five tournament services (one of them the §1-fenced `tournamentUserScoring.js:69`), the DRB via `marketContext`, and six client surfaces — and **every one of them reads named fields with null guards, none iterates `factors` keys, no schema allowlist exists, and `firestore.rules:682-690` is doc-level**, so a per-window `basis` field is free and safe.

**Q4.** The #833 fixture `eodPayload` (`dailyRowHygiene.test.js:36-52`) is the right production shape but must be **reversed** for the cron (its endpoint is oldest-first); run locally on it, the current mapper and the reference mapper diverge on every metric while every current value stays **finite** (technicalScore 46 vs 40, `aboveSMA20` **flipped** true vs false) — and, measured across the repo's **33,163 real captured EODHD rows** in `fixtures/daily/`, there are **zero** nulls, **zero** absent keys, **zero** strings and **zero** symbol-specific gaps (83 market-wide missing weekdays = NYSE holidays), so the honest case for this build is resilience and one-mapper consistency, **not** the brief's "live-wrong on every run."

**Q5.** Pre-market `30 10,11 * * 1-5` UTC runs **90–150 minutes before** the eval cron's first 13:00 UTC tick, so the first corrected feed reaches the decider the same morning; `maxDuration` is 300 s, there is **no budget guard**, 256 symbols per run, and the fix costs **zero** cron slots (39/40 unchanged) — but the feed doc carries only `computedAt`/`updatedAt`, so the build should add **`deploySha: globalThis.process?.env?.VERCEL_GIT_COMMIT_SHA || null`** beside `arch_scores_version` (`:1378`), following `agent-evaluate.js:1325`, because on a clean day the corrected run's numbers will be identical and a timestamp alone cannot prove the fix is live.

### Recommended build shape (five lines)

1. **Files touched:** `api/cron/compute-index-intelligence.js` only, plus one new test file (`api/cron/cronDailyRowHygiene.test.js` or similar). No fenced file; no `marketDataCache.js` edit.
2. **Helper:** **(a) import `mapDailyRows` as-is** from `../_utils/marketDataCache.js`; replace `:155-163` with `mapDailyRows(data)`, keep the `.reverse()`, add the per-symbol `rows kept / dropped` log (`marketDataCache.js:370-372` pattern), and disclose the bar-offset-shift trade in the PR.
3. **`basis` field:** **yes** — `basis: smaBasis.basis` into `factors` (`indexIntelligence.js:523-542`); one line, data already computed and discarded, no reader affected, no `stockRankings` size impact.
4. **Fixture:** `eodPayload(90).reverse()` (oldest-first, from `dailyRowHygiene.test.js:36-52`) — one row with `adjusted_close: null` / raw intact, one with the key deleted, one string field, one whole row absent; assert the surviving series **equals** the same payload with the bad row never present, that each current-mapper value is **finite and different**, and mutation-check by reverting the mapper. The `undefined`→`NaN`→sort case (Case D) deserves its own row: it is the universe-wide one.
5. **Smoke:** first pre-market run after deploy — `deploySha` matches the merge commit, `0 dropped` across 256 symbols, `totalTechStocks: 239`, then the 13:00 UTC eval tick consumes it.

---

## Outside the five questions (BUILD_RULES §3 — reported for separate tasking, NOT fixed)

**O-1 — The index documents never got #833's raw-vs-raw fix, and the market-regime label rides on it.** `computeIndexTechnicals` computes `sma20/50/200` on the **adjusted** closes (`:338-340`) and compares `currentPrice > smaVal` at **`:347`** with no raw path at all — while intraday mode splices a **raw** live quote into `closes[0]` for indices too (`:651`, `:672`, `:170-173`, `:259`). This is the *exact* defect `26e88aad` fixed for the 239-name stock universe, left in place for SPY/QQQ/DIA/IWM/RSP. It propagates into `regime = classifyRegime(spyT.price, spyT.sma50.value, spyT.sma200.value)` (`:741`), then into `breadthComposite`/`breadthTier` (`:763-782`), `marketContext` (`:1082-1105`), the eval cron (`agent-evaluate.js:951`) and the Daily Regime Brief (`compute-daily-regime-brief.js:107-123`). SPY pays ~1.3%/yr quarterly, so the same one-signed bullish skew applies. All line references VERIFIED. **Suggested: its own task — `resolveSmaBasis` is already exported and index bars already carry `rawClose` (`:161`), so the ingredients are in hand.**

**O-2 — Twelve more files map `/eod/` payloads outside the two #833 touched.** `grep -rl adjusted_close` over `api/` + `src/`, excluding tests and the in-scope modules, returns: `api/research/fetchDriverSeries.js`, `api/earnings/odds.js`, `api/earnings/_helpers/getEarningsResult.js`, `api/stocks/earnings-history.js`, `api/stocks/historical.js`, `api/stocks/eod-close.js`, `api/volatility/thresholds.js`, `api/academy/pull-chart-data.js`, `src/components/Research/chartUtils.js`, `src/components/Search/SectorPerformanceTable.jsx`, `src/services/fantasyTimesDetector.js`, `src/services/sectorDataService.js` (the file list is VERIFIED by the grep; **each one's individual guard state is ASSUMED — none was read this session**). `mapDailyRows`'s own docstring already flags `fetchDriverSeries.js:60-69` as deliberately different (it wants the 0 preserved for single-print detection). **Suggested: a sweep task that inventories which of these need the same contract and which are deliberately different — not this build.**

**O-3 — `filter(d => d.rs20)` at `:825` is a truthiness check on an object, not a validity check on its number.** Even after the mapper fix, any future path that produces a non-finite `rs20.change` re-opens the Case-D universe-wide re-ranking. A two-word hardening (`&& Number.isFinite(d.rs20.change)`) would make the sort structurally safe. **Not in this build's scope; worth its own one-line task.**

**O-4 — The cron has no time budget.** `maxDuration: 300` with 256 sequential-batched EODHD fetches and no elapsed-time abort (VERIFIED by absence). A slow EODHD day truncates the run at the platform boundary mid-batch, and the failure mode is an uncommitted batch (the `batch.commit()` at `:1398` never runs) leaving readers on the previous day's doc. Not caused by, and not fixed by, this build.

**O-5 — Stale line citation.** `api/_utils/rawVsAdjustedSmaFlags.test.js:5` and `:30-31` of `26e88aad`'s message cite `compute-index-intelligence.js:150` and `:229-254`; at this HEAD they are `:160` and `:240-271` (VERIFIED). Harmless, but the build will be re-citing these lines and should refresh rather than inherit them (§3: "Re-verify inherited anchors — they drift").

---

*Report also written outside the repo tree per BUILD_RULES §3, at the session scratchpad, as a byte-exact artifact.*
